// ═══════════════════════════════════════════════════════════════════
// Регистрация и вход по почте + профиль пользователя.
//
//   POST /auth/email/request  { email, consent }        → отправить код
//   POST /auth/email/verify   { email, code, deviceId } → войти/зарегистрироваться
//   GET  /account                                       → свой профиль
//   PUT  /account   { firstName, lastName, phone, nickname } → правка профиля
//   POST /account/delete                                → мягкое удаление
//
// ПОЧЕМУ КОД, А НЕ ПАРОЛЬ. Вход по одноразовому коду закрывает вход и
// подтверждение почты одним механизмом: адрес подтверждается самим фактом
// получения кода. Пароли не хранятся — нечему утечь, не нужен «забыл пароль»,
// не нужны требования к сложности. Колонка password_hash заведена миграцией 004
// на будущее и здесь не пишется.
//
// ЧТО ЗДЕСЬ ЗАЩИЩЕНО ОСОЗНАННО:
// • Перечисление адресов. Ответ на /request ВСЕГДА одинаковый — «письмо
//   отправлено», независимо от того, есть такой человек или нет. Иначе форма
//   входа превращается в проверялку «зарегистрирован ли этот человек».
// • Спам на чужой ящик и перебор адресов: частота считается в двух разрезах —
//   по адресу и по IP.
// • Перебор кода: 6 цифр это 10^6, поэтому попытки ограничены пятью, после
//   чего код мёртв; сам код не хранится, только sha256 с перцем.
// • Склейка аккаунтов. Если человек сначала вошёл через Telegram, а потом по
//   почте — получились бы ДВА аккаунта и два прогресса, и выяснилось бы это
//   репликой «у меня пропали уроки». Поэтому: адрес ищется по индексу
//   users_by_email, а если запрос принёс действующий токен, почта прикрепляется
//   к ТОМУ ЖЕ аккаунту, а не создаёт новый.
//
// ПЕРСОНАЛЬНЫЕ ДАННЫЕ. Имя, фамилия, телефон — ПД. Согласие фиксируется при
// регистрации (consent_at), удаление аккаунта поддерживается (deleted_at) и
// отвязывает почту, чтобы адрес можно было зарегистрировать заново.
// Телефон НЕ обязателен.
// ═══════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const { Driver, getCredentialsFromEnv, TypedValues, Types } = require('ydb-sdk');
const mailer = require('./mailer.js');

let driver = null;
async function getDriver(){
  if(driver) return driver;
  // В модульный кэш — только после успешной готовности (см. разбор в progress.js).
  const d = new Driver({
    endpoint: process.env.YDB_ENDPOINT,
    database: process.env.YDB_DATABASE,
    authService: getCredentialsFromEnv(),
  });
  if(!await d.ready(10000)){
    try { await d.destroy(); } catch(_){}
    throw new Error('YDB not ready');
  }
  driver = d;
  return driver;
}

const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || 'https://avvacumrechevoi.github.io';
const CORS = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const CODE_TTL_MIN     = 10;
const CODE_MAX_ATTEMPTS = 5;
const EMAIL_WINDOW_MIN = 15;
const EMAIL_MAX_IN_WINDOW = 3;    // писем на один адрес за окно
const IP_MAX_IN_WINDOW    = 12;   // запросов с одного IP за окно
const TOKEN_TTL_DAYS   = 30;
const MAX_NAME = 60;
const MAX_PHONE = 24;

const ok   = (obj, code) => ({ statusCode: code || 200, headers: CORS, body: JSON.stringify(obj) });
const fail = (code, error, extra) => ({ statusCode: code, headers: CORS, body: JSON.stringify(Object.assign({ error }, extra || {})) });

const txt = (v) => (v == null ? null : (v.textValue ?? null));
const num = (v) => { const x = v?.uint64Value ?? v?.uint32Value ?? v?.int64Value ?? v?.int32Value; return x == null ? null : Number(String(x)); };
const ts  = (v) => { const x = v?.uint64Value ?? v?.int64Value; return x == null ? null : new Date(Number(String(x)) / 1000).toISOString(); };

function verifyJWT(token, secret){
  if(!token || !secret) return null;
  const [h, b, s] = token.split('.');
  if(!h || !b || !s) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
  const expBuf = Buffer.from(expected), sigBuf = Buffer.from(s);
  if(expBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expBuf, sigBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if(payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch(_){ return null; }
}

function signJWT(payload, secret){
  const header = Buffer.from(JSON.stringify({ alg:'HS256', typ:'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

// Нормализация адреса. Регистр не значим, пробелы по краям убираем. Точки в
// локальной части НЕ трогаем: это правило Gmail, а не стандарт, и «сгладив»
// адрес, можно склеить двух разных людей на своём почтовом сервере.
function normEmail(raw){
  const s = String(raw || '').trim().toLowerCase();
  if(s.length < 6 || s.length > 254) return null;
  if(!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(s)) return null;
  return s;
}

// Код — 6 цифр из криптографического источника. Math.random для кода входа
// не годится: он предсказуем.
function genCode(){
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
// Перец — уже существующий секрет функции: отдельный секрет = ещё одна
// переменная, которую забудут перенести при деплое.
function hashCode(code, email){
  return crypto.createHmac('sha256', process.env.JWT_SECRET || 'no-secret')
    .update(String(email) + ':' + String(code)).digest('hex');
}
function ipHash(event){
  const ip = event?.headers?.['X-Forwarded-For'] || event?.headers?.['x-forwarded-for'] || '';
  const first = String(ip).split(',')[0].trim();
  if(!first) return null;
  return crypto.createHash('sha256').update(first).digest('hex').slice(0, 32);
}
function nickFromEmail(email){
  const local = String(email).split('@')[0].replace(/[._-]+/g, ' ').trim();
  if(!local) return 'Ученик';
  return local.charAt(0).toUpperCase() + local.slice(1, 30);
}
// Телефон необязателен, поэтому проверка мягкая: приводим к «+ и цифры» и
// смотрим только длину. Строгие маски по странам отсекают живые номера.
function normPhone(raw){
  if(raw == null || String(raw).trim() === '') return { ok:true, value:null };
  const s = String(raw).trim();
  if(s.length > MAX_PHONE) return { ok:false };
  const digits = s.replace(/[^\d]/g, '');
  if(digits.length < 10 || digits.length > 15) return { ok:false };
  return { ok:true, value: (s.startsWith('+') ? '+' : '') + digits };
}
function clean(raw, max){
  if(raw == null) return null;
  const s = String(raw).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return s ? s.slice(0, max) : null;
}

// ─── частота обращений ───────────────────────────────────────────────
// Окно скользящее «по-простому»: если окно истекло, счётчик обнуляется.
// Отдельная таблица (а не память процесса) обязательна: функция живёт в
// нескольких экземплярах, и счётчик в памяти защищает только один из них.
async function throttleHit(drv, bucket, limit){
  let allowed = true;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $b AS Utf8;
      SELECT window_start, hits FROM auth_throttle WHERE bucket = $b;`,
      { '$b': TypedValues.utf8(bucket) });
    const row = r.resultSets[0]?.rows?.[0];
    const now = Date.now();
    const startMs = row ? Number(String(row.items[0]?.uint64Value ?? 0)) / 1000 : 0;
    const hits = row ? (num(row.items[1]) || 0) : 0;
    const fresh = !row || (now - startMs) > EMAIL_WINDOW_MIN * 60 * 1000;

    if(!fresh && hits >= limit){ allowed = false; return; }

    const nextHits = fresh ? 1 : hits + 1;
    await s.executeQuery(`
      DECLARE $b AS Utf8; DECLARE $h AS Uint32; DECLARE $fresh AS Bool;
      UPSERT INTO auth_throttle (bucket, window_start, hits)
      VALUES ($b, IF($fresh, CurrentUtcTimestamp(), CurrentUtcTimestamp()), $h);`,
      {
        '$b': TypedValues.utf8(bucket),
        '$h': TypedValues.uint32(nextHits),
        '$fresh': TypedValues.bool(fresh),
      });
  });
  return allowed;
}

// ─── поиск пользователя ──────────────────────────────────────────────
async function findUserByEmail(drv, email){
  let user = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $e AS Utf8;
      SELECT user_id, nickname, avatar, email, email_verified, deleted_at
      FROM users VIEW users_by_email WHERE email = $e LIMIT 1;`,
      { '$e': TypedValues.utf8(email) });
    const row = r.resultSets[0]?.rows?.[0];
    if(row){
      user = {
        userId: txt(row.items[0]), nickname: txt(row.items[1]),
        avatar: txt(row.items[2]), email: txt(row.items[3]),
        emailVerified: !!row.items[4]?.boolValue, deletedAt: ts(row.items[5]),
      };
    }
  });
  return user;
}

async function loadProfile(drv, userId){
  let p = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $u AS Utf8;
      SELECT user_id, nickname, avatar, email, email_verified, first_name, last_name,
             phone, registered_via, consent_at, created_at, last_seen_at, deleted_at,
             tg_user_id
      FROM users WHERE user_id = $u;`,
      { '$u': TypedValues.utf8(userId) });
    const row = r.resultSets[0]?.rows?.[0];
    if(!row) return;
    const i = row.items;
    p = {
      userId: txt(i[0]), nickname: txt(i[1]), avatar: txt(i[2]),
      email: txt(i[3]), emailVerified: !!i[4]?.boolValue,
      firstName: txt(i[5]), lastName: txt(i[6]), phone: txt(i[7]),
      registeredVia: txt(i[8]), consentAt: ts(i[9]),
      createdAt: ts(i[10]), lastSeenAt: ts(i[11]), deletedAt: ts(i[12]),
      hasTelegram: i[13]?.int64Value != null || i[13]?.uint64Value != null,
    };
  });
  return p;
}

// ─── POST /auth/email/request ────────────────────────────────────────
async function handleRequest(drv, { body, event }){
  const email = normEmail(body.email);
  if(!email) return fail(400, 'invalid email', { detail:'проверьте адрес почты' });

  if(!mailer.isConfigured()){
    // Честный отказ вместо «письмо отправлено»: иначе человек будет ждать
    // письмо, которого физически нет. Настройка — scripts/set-mail-env.sh.
    console.error('[auth-email] SMTP не настроен');
    return fail(503, 'mail not configured', {
      detail:'отправка писем ещё не настроена на сервере',
    });
  }

  const iph = ipHash(event);
  const okEmail = await throttleHit(drv, 'email:' + email, EMAIL_MAX_IN_WINDOW);
  const okIp = iph ? await throttleHit(drv, 'ip:' + iph, IP_MAX_IN_WINDOW) : true;
  if(!okEmail || !okIp){
    return fail(429, 'too many requests', {
      detail:`слишком часто, попробуйте через ${EMAIL_WINDOW_MIN} минут`,
    });
  }

  const code = genCode();
  await drv.tableClient.withSession(async (s) => {
    // Срок жизни задаётся ЛИТЕРАЛЬНЫМ интервалом в самом запросе, а не
    // параметром типа Interval: так не нужно полагаться на то, что в этой
    // версии SDK есть TypedValues.interval — а проверять это в бою поздно.
    await s.executeQuery(`
      DECLARE $e AS Utf8; DECLARE $h AS Utf8; DECLARE $ip AS Optional<Utf8>;
      UPSERT INTO email_codes (email, purpose, code_hash, attempts, expires_at, created_at, ip_hash)
      VALUES ($e, "login", $h, 0u,
              CurrentUtcTimestamp() + Interval("PT${CODE_TTL_MIN}M"),
              CurrentUtcTimestamp(), $ip);`,
      {
        '$e':   TypedValues.utf8(email),
        '$h':   TypedValues.utf8(hashCode(code, email)),
        '$ip':  iph ? TypedValues.optional(TypedValues.utf8(iph)) : TypedValues.optionalNull(Types.UTF8),
      });
  });

  const letter = mailer.loginCodeLetter(code, CODE_TTL_MIN);
  try {
    await mailer.send({ to: email, subject: letter.subject, text: letter.text, html: letter.html });
  } catch(e){
    console.error('[auth-email] письмо не отправлено', e?.message || e);
    return fail(502, 'mail send failed', { detail:'не удалось отправить письмо, попробуйте позже' });
  }

  // Ответ одинаковый и для существующих, и для новых адресов — см. шапку.
  return ok({ sent: true, ttlMinutes: CODE_TTL_MIN });
}

// ─── POST /auth/email/verify ─────────────────────────────────────────
async function handleVerify(drv, { body, event }){
  const email = normEmail(body.email);
  const code = String(body.code || '').replace(/\D/g, '');
  if(!email || code.length !== 6) return fail(400, 'invalid input', { detail:'нужен адрес и код из шести цифр' });

  let row = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $e AS Utf8;
      SELECT code_hash, attempts, expires_at FROM email_codes
      WHERE email = $e AND purpose = "login";`,
      { '$e': TypedValues.utf8(email) });
    const x = r.resultSets[0]?.rows?.[0];
    if(x) row = { hash: txt(x.items[0]), attempts: num(x.items[1]) || 0, expiresAt: ts(x.items[2]) };
  });
  if(!row) return fail(400, 'code not found', { detail:'запросите код заново' });
  if(row.attempts >= CODE_MAX_ATTEMPTS) return fail(429, 'too many attempts', { detail:'код заблокирован, запросите новый' });
  if(new Date(row.expiresAt).getTime() < Date.now()) return fail(400, 'code expired', { detail:'код истёк, запросите новый' });

  const given = hashCode(code, email);
  const a = Buffer.from(String(row.hash)), b = Buffer.from(given);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if(!match){
    await drv.tableClient.withSession(async (s) => {
      await s.executeQuery(`DECLARE $e AS Utf8; DECLARE $n AS Uint32;
        UPSERT INTO email_codes (email, purpose, attempts) VALUES ($e, "login", $n);`,
        { '$e': TypedValues.utf8(email), '$n': TypedValues.uint32(row.attempts + 1) });
    });
    return fail(400, 'wrong code', { detail:'код не подошёл', attemptsLeft: Math.max(0, CODE_MAX_ATTEMPTS - row.attempts - 1) });
  }

  // Код верный — гасим его сразу, чтобы повторное использование не работало.
  await drv.tableClient.withSession(async (s) => {
    await s.executeQuery(`DECLARE $e AS Utf8;
      DELETE FROM email_codes WHERE email = $e AND purpose = "login";`,
      { '$e': TypedValues.utf8(email) });
  });

  // Кому принадлежит адрес. Три случая, и третий — тот, из-за которого
  // появлялись бы два аккаунта у одного человека.
  const auth = event.headers?.Authorization || event.headers?.authorization;
  const payload = auth?.startsWith('Bearer ') ? verifyJWT(auth.slice(7), process.env.JWT_SECRET) : null;
  const currentUserId = payload?.sub ? String(payload.sub) : null;

  const byEmail = await findUserByEmail(drv, email);
  let userId, nickname, isNew = false;

  if(byEmail && !byEmail.deletedAt){
    userId = byEmail.userId;
    nickname = byEmail.nickname;
  } else if(currentUserId){
    // человек уже вошёл (например, через Telegram) и подтверждает свою почту —
    // прикрепляем адрес к СУЩЕСТВУЮЩЕМУ аккаунту, а не создаём второй
    const cur = await loadProfile(drv, currentUserId);
    if(cur && !cur.deletedAt){
      userId = cur.userId;
      nickname = cur.nickname;
    }
  }

  if(!userId){
    userId = crypto.randomUUID();
    nickname = nickFromEmail(email);
    isNew = true;
  }

  const consent = body.consent === true || body.consent === 'true';

  // Существующие значения читаем ОТДЕЛЬНЫМ запросом и решаем в коде.
  // Скалярные подзапросы внутри VALUES (COALESCE((SELECT …))) в YQL —
  // конструкция ненадёжная, а проверять это на живом входе поздно: человек
  // просто не сможет войти. UPSERT в YDB обновляет только перечисленные
  // колонки, поэтому неупомянутые поля профиля (имя, телефон) не затрутся.
  const existing = isNew ? null : await loadProfile(drv, userId);
  const registeredVia = (existing && existing.registeredVia) || 'email';
  const setConsent = consent || !!(existing && existing.consentAt);

  await drv.tableClient.withSession(async (s) => {
    if(isNew){
      // consent_at ставится ЧЕРЕЗ CurrentUtcTimestamp(), а не параметром типа
      // Timestamp: не полагаемся на наличие TypedValues.timestamp в этой версии
      // SDK. Если согласия нет — колонку просто не перечисляем.
      const cols = 'user_id, nickname, email, email_verified, registered_via, created_at, last_seen_at'
        + (consent ? ', consent_at' : '');
      const vals = '$u, $nick, $e, true, "email", CurrentUtcTimestamp(), CurrentUtcTimestamp()'
        + (consent ? ', CurrentUtcTimestamp()' : '');
      await s.executeQuery(`
        DECLARE $u AS Utf8; DECLARE $e AS Utf8; DECLARE $nick AS Utf8;
        UPSERT INTO users (${cols}) VALUES (${vals});`,
        {
          '$u': TypedValues.utf8(userId),
          '$e': TypedValues.utf8(email),
          '$nick': TypedValues.utf8(String(nickname || nickFromEmail(email))),
        });
    } else {
      // created_at и nickname у существующего аккаунта не трогаем вовсе.
      // UPDATE, а не UPSERT: UPSERT в YDB требует перечислить ВСЕ NOT NULL
      // колонки (в users это nickname и created_at), иначе запрос отвергается
      // ещё на разборе типов — «Type annotation, code 1030». Частичное
      // обновление существующей строки делается только UPDATE. Проверено в бою:
      // на этом падала правка профиля, и точно так же упал бы вход по почте
      // для уже существующего аккаунта.
      await s.executeQuery(`
        DECLARE $u AS Utf8; DECLARE $e AS Utf8; DECLARE $via AS Utf8;
        UPDATE users SET email = $e, email_verified = true,
                         registered_via = $via, last_seen_at = CurrentUtcTimestamp()
        WHERE user_id = $u;`,
        {
          '$u': TypedValues.utf8(userId),
          '$e': TypedValues.utf8(email),
          '$via': TypedValues.utf8(registeredVia),
        });
      if(setConsent && !(existing && existing.consentAt)){
        await s.executeQuery(`
          DECLARE $u AS Utf8;
          UPDATE users SET consent_at = CurrentUtcTimestamp() WHERE user_id = $u;`,
          { '$u': TypedValues.utf8(userId) });
      }
    }
  });

  // Привязка устройства и перенос анонимных матчей — необязательные шаги,
  // выдача токена от них не зависит (тот же принцип, что в auth-telegram).
  const deviceId = body.deviceId ? String(body.deviceId).slice(0, 128) : null;
  if(deviceId){
    try {
      await drv.tableClient.withSession(async (s) => {
        await s.executeQuery(`
          DECLARE $d AS Utf8; DECLARE $u AS Utf8;
          UPSERT INTO device_links (device_id, user_id, linked_at)
          VALUES ($d, $u, CurrentUtcTimestamp());`,
          { '$d': TypedValues.utf8(deviceId), '$u': TypedValues.utf8(userId) });
        await s.executeQuery(`
          DECLARE $d AS Utf8; DECLARE $u AS Utf8;
          UPDATE matches SET user_id = $u WHERE device_id = $d AND user_id IS NULL;`,
          { '$d': TypedValues.utf8(deviceId), '$u': TypedValues.utf8(userId) });
      });
    } catch(e){
      console.error('[auth-email] привязка устройства не удалась', e?.message || e);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signJWT({ sub: userId, nick: nickname, iat: now, exp: now + TOKEN_TTL_DAYS * 24 * 3600 },
    process.env.JWT_SECRET);
  const profile = await loadProfile(drv, userId);
  return ok({ token, user: profile, isNew });
}

// ─── GET /account, PUT /account ──────────────────────────────────────
async function handleAccount(drv, { method, body, event }){
  const auth = event.headers?.Authorization || event.headers?.authorization;
  const payload = auth?.startsWith('Bearer ') ? verifyJWT(auth.slice(7), process.env.JWT_SECRET) : null;
  if(!payload?.sub) return fail(401, 'unauthorized');
  const userId = String(payload.sub);

  if(method === 'GET'){
    const p = await loadProfile(drv, userId);
    if(!p || p.deletedAt) return fail(404, 'not found');
    return ok({ user: p });
  }

  const first = clean(body.firstName, MAX_NAME);
  const last  = clean(body.lastName, MAX_NAME);
  const nick  = clean(body.nickname, 40);
  const ph = normPhone(body.phone);
  if(!ph.ok) return fail(400, 'invalid phone', { detail:'телефон: от 10 до 15 цифр' });

  // Ник меняем ТОЛЬКО если его прислали. Иначе UPSERT затёр бы его пустым:
  // nickname в users объявлен NOT NULL, и «сохранить телефон» уронило бы весь
  // запрос либо стёрло имя. Отдельными запросами — надёжнее любой COALESCE
  // с подзапросом внутри VALUES (в YQL такое лучше не использовать вовсе).
  await drv.tableClient.withSession(async (s) => {
    await s.executeQuery(`
      DECLARE $u AS Utf8; DECLARE $f AS Optional<Utf8>; DECLARE $l AS Optional<Utf8>;
      DECLARE $p AS Optional<Utf8>;
      UPDATE users SET first_name = $f, last_name = $l, phone = $p,
                       last_seen_at = CurrentUtcTimestamp()
      WHERE user_id = $u;`,
      {
        '$u': TypedValues.utf8(userId),
        '$f': first ? TypedValues.optional(TypedValues.utf8(first)) : TypedValues.optionalNull(Types.UTF8),
        '$l': last ? TypedValues.optional(TypedValues.utf8(last)) : TypedValues.optionalNull(Types.UTF8),
        '$p': ph.value ? TypedValues.optional(TypedValues.utf8(ph.value)) : TypedValues.optionalNull(Types.UTF8),
      });
    if(nick){
      await s.executeQuery(`
        DECLARE $u AS Utf8; DECLARE $n AS Utf8;
        UPDATE users SET nickname = $n WHERE user_id = $u;`,
        { '$u': TypedValues.utf8(userId), '$n': TypedValues.utf8(nick) });
    }
  });
  const p = await loadProfile(drv, userId);
  return ok({ user: p, saved: true });
}

// ─── POST /account/delete ────────────────────────────────────────────
// Мягкое удаление: строка остаётся (на неё ссылаются матчи и журнал), но
// личные поля стираются, а почта отвязывается — иначе адрес нельзя было бы
// зарегистрировать заново, и «удалите мои данные» выполнялось бы наполовину.
async function handleDelete(drv, { event }){
  const auth = event.headers?.Authorization || event.headers?.authorization;
  const payload = auth?.startsWith('Bearer ') ? verifyJWT(auth.slice(7), process.env.JWT_SECRET) : null;
  if(!payload?.sub) return fail(401, 'unauthorized');
  const userId = String(payload.sub);

  await drv.tableClient.withSession(async (s) => {
    await s.executeQuery(`
      DECLARE $u AS Utf8;
      UPDATE users SET nickname = "удалённый аккаунт", email = NULL, email_verified = false,
                       first_name = NULL, last_name = NULL, phone = NULL,
                       deleted_at = CurrentUtcTimestamp(), last_seen_at = CurrentUtcTimestamp()
      WHERE user_id = $u;`,
      { '$u': TypedValues.utf8(userId) });
    await s.executeQuery(`DECLARE $u AS Utf8;
      DELETE FROM device_links WHERE user_id = $u;`,
      { '$u': TypedValues.utf8(userId) });
  });
  return ok({ deleted: true });
}

// ─── GET /auth/email/selftest ────────────────────────────────────────
// Проверка настроек почты ИЗ ОБЛАКА, без отправки письма. Доступна только
// суперадмину: ответ содержит адрес отправителя и текст ошибки сервера, то
// есть сведения о конфигурации, которые незачем показывать кому попало.
async function handleSelftest(drv, { event }){
  const auth = event.headers?.Authorization || event.headers?.authorization;
  const payload = auth?.startsWith('Bearer ') ? verifyJWT(auth.slice(7), process.env.JWT_SECRET) : null;
  if(!payload?.sub) return fail(401, 'unauthorized');

  let isSuper = false;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $u AS Utf8;
      SELECT role_id FROM user_roles WHERE user_id = $u;`,
      { '$u': TypedValues.utf8(String(payload.sub)) });
    isSuper = txt(r.resultSets[0]?.rows?.[0]?.items?.[0]) === 'superadmin';
  });
  if(!isSuper) return fail(403, 'forbidden', { detail:'самопроверка почты доступна суперадмину' });

  const res = await mailer.verifyLogin();
  if(!res.ok){
    // Текст ошибки сервера отдаём как есть: «неверный пароль» и «сеть недоступна»
    // требуют разных действий, и скрывать разницу — значит заставлять гадать.
    return { statusCode: 502, headers: CORS, body: JSON.stringify({
      ok: false, error: res.error, code: res.code,
      hint: 'если сервер пишет про authentication — нужен пароль приложения, а не обычный пароль от почты',
    }) };
  }
  return ok({ ok: true, host: res.host, port: res.port, user: res.user, from: res.from,
              detail: 'почтовый сервер принял логин и пароль, письмо не отправлялось' });
}

// ─── маршрутизация ───────────────────────────────────────────────────
function reqPath(event){
  return String(event?.path || event?.url ||
    event?.requestContext?.http?.path || event?.requestContext?.path || '');
}

exports.handler = async (event) => {
  const method = String(event.httpMethod || 'GET').toUpperCase();
  if(method === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' };

  let body = {};
  if(event.body){
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
    catch(_){ return fail(400, 'invalid json'); }
  }
  const path = reqPath(event);

  let drv;
  try { drv = await getDriver(); }
  catch(e){ console.error('[auth-email] YDB недоступна', e); return fail(503, 'db unavailable'); }

  try {
    if(/\/auth\/email\/selftest/.test(path) && method === 'GET') return await handleSelftest(drv, { event });
    if(/\/auth\/email\/request/.test(path) && method === 'POST') return await handleRequest(drv, { body, event });
    if(/\/auth\/email\/verify/.test(path)  && method === 'POST') return await handleVerify(drv, { body, event });
    if(/\/account\/delete/.test(path)      && method === 'POST') return await handleDelete(drv, { event });
    if(/\/account/.test(path) && (method === 'GET' || method === 'PUT')) return await handleAccount(drv, { method, body, event });
    return fail(404, 'not found', { path });
  } catch(e){
    // Наружу 500, а не «как будто получилось»: молчаливые ошибки в этом
    // проекте уже прятали сломанный SQL месяцами.
    console.error('[auth-email] ошибка', e);
    return fail(500, 'internal', { detail: String(e?.message || e).slice(0, 200) });
  }
};

exports.isMailConfigured = () => mailer.isConfigured();
