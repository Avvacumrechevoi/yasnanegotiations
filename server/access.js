// ═══════════════════════════════════════════════════════════════════
// Yandex Cloud Function (модуль в пакете yasna-submit): /access/* — роли,
// полномочия, персональные доступы и журнал.
//
//   GET  /access/me          кто я и что мне открыто (без токена — тоже 200)
//   GET  /access/people?q=   список аккаунтов с ролями        cap:people.view
//   POST /access/role        сменить роль аккаунту            cap:roles.manage
//   POST /access/grant       персональный доступ (entitlements) cap:access.grant
//   POST /access/revoke      снять персональное исключение    cap:access.grant
//   POST /access/role-grant  галочка полномочия у роли        cap:roles.manage
//   GET  /access/audit       журнал, новые сверху             cap:audit.view
//   POST /access/catalog     публикация каталога возможностей cap:catalog.edit
//
// ЗАЧЕМ ФАЙЛ, А НЕ ФУНКЦИЯ. Квота serverless.functions.count в облаке
// исчерпана (10 из 10) — новую функцию создать нельзя. Модуль подсаживается в
// пакет yasna-submit и вызывается из server/submit.js разводкой по пути, ровно
// как server/progress.js и server/rooms-legacy.js. Если квоту поднимут, файл
// уезжает в свою функцию без правки логики.
//
// ГЛАВНОЕ ПРАВИЛО. Роль и полномочия читаются ТОЛЬКО из БД по user_id из
// проверенного JWT. Из тела запроса не берётся ничего, что влияет на права:
// ни роль, ни user_id актора, ни «я админ». Тело запроса описывает лишь ОБЪЕКТ
// действия (кому и что), а право на действие всегда вычисляется заново здесь.
//
// ПОЧЕМУ cap:* НЕ ЖИВУТ В entitlements. Ручка выдачи доступов пишет в
// entitlements. Если бы там же лежало «кто может выдавать», любая ошибка
// валидации превращалась бы в самоповышение: выдал сам себе cap:access.grant —
// и стал раздающим. Поэтому полномочия живут в role_grants, ручка /access/grant
// жёстко отказывает на префиксы cap:/role:/admin:, а resolveAccess вообще
// игнорирует такие строки в entitlements, даже если их занесли руками через SQL
// (defense in depth: одна дыра не должна давать эскалацию).
//
// ЖУРНАЛ. В access_audit пишется КАЖДОЕ действие, включая ОТКАЗЫ
// (result='denied'). Без записи отказов украденный токен не виден вообще:
// успешные действия выглядят штатно, а серия отказов — единственный след
// перебора. Журнал append-only: ни UPDATE, ни DELETE.
//
// ГОСТЬ. dev:<device_id> — полноценный сценарий продукта. Гостю роль не
// выдаётся (роль бывает только у аккаунта), но персональные доступы —
// выдаются, и resolveAccess умеет считать права для гостевого ключа.
// ═══════════════════════════════════════════════════════════════════
// Env: YDB_ENDPOINT, YDB_DATABASE, JWT_SECRET, ALLOW_ORIGIN

const crypto = require('crypto');
const { Driver, getCredentialsFromEnv, TypedValues, Types } = require('ydb-sdk');

let driver = null;
async function getDriver(){
  if(driver) return driver;
  // Драйвер попадает в модульный кэш ТОЛЬКО после успешной готовности.
  // Раньше присваивание шло до ready(), и одна неудачная инициализация
  // «залипала» в тёплом контейнере: последующие вызовы проверку минуют и
  // работают с дохлым драйвером, пока контейнер не переедет.
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

const CORS = {
  // адрес проставляется на запрос в applyCors(), см. ниже
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Secret',
  'Content-Type': 'application/json',
  // Права нельзя кэшировать по пути: понижение роли должно действовать сразу.
  'Cache-Control': 'no-store',
};

/* ── CORS для нескольких доменов ──────────────────────────────────────
   Раньше здесь был ОДИН адрес, и он же уходил в ответ независимо от того,
   кто спрашивает. Пока сайт жил только на github.io, это работало; при
   переезде на свой домен браузер начал бы резать все запросы — вход, роли,
   рейтинг, — а на сайте это выглядит как «всё сломалось без причины».
   Список нужен именно списком: во время переезда оба адреса живые
   одновременно, и закрыть один ради другого нельзя.
   ALLOW_ORIGIN можно переопределить через переменную окружения — несколько
   адресов через запятую.

   Заголовок ставится на общий объект в начале обработчика. Это безопасно,
   потому что экземпляр функции обслуживает один запрос за раз; если когда-то
   включите параллелизм внутри экземпляра — переделать на возврат копии.
   Vary: Origin обязателен, иначе промежуточный кэш отдаст чужому домену
   ответ, выписанный для нашего. */
const ALLOWED_ORIGINS = (process.env.ALLOW_ORIGIN
  || 'https://avvacumrechevoi.github.io,https://yasnalab.ru,https://www.yasnalab.ru')
  .split(',').map(s => s.trim()).filter(Boolean);

function applyCors(event){
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin || '';
  CORS['Access-Control-Allow-Origin'] =
    ALLOWED_ORIGINS.indexOf(origin) > -1 ? origin : ALLOWED_ORIGINS[0];
  CORS['Vary'] = 'Origin';
}

const ok   = (obj) => ({ statusCode:200, headers:CORS, body: JSON.stringify(obj) });
const fail = (code, error, extra) => ({ statusCode:code, headers:CORS, body: JSON.stringify(Object.assign({error}, extra||{})) });

// ─── границы входа ───────────────────────────────────────────────────
const MAX_ID       = 128;
const MAX_FEATURE  = 200;
const MAX_NOTE     = 400;
const MAX_SOURCE   = 40;
const MAX_QUERY    = 80;
const PEOPLE_LIMIT = 100;
const AUDIT_LIMIT  = 200;
const AUDIT_DEFAULT = 50;
const CATALOG_MAX  = 500;
const CATALOG_CHUNK = 20;   // строк в одном UPSERT ... VALUES
const IDS_CHUNK    = 50;    // id в одном WHERE user_id IN (...)

const OWNER_USER = 'usr:';
const OWNER_DEV  = 'dev:';
const DEFAULT_ROLE = 'user';        // страховка, если в roles нет строки is_default
const SUPERADMIN_ROLE = 'superadmin';
const CAP_ROLES_MANAGE = 'cap:roles.manage';

// Ключ возможности: только ASCII и только безопасные символы. Не косметика:
// без этого ' cap:roles.manage' (пробел), 'CAP:roles.manage' (регистр) или
// 'сap:' (кириллическая «с») проходили бы мимо проверки запрещённых префиксов.
// '*' допустима ТОЛЬКО как хвост ':*' или как один символ целиком. Раньше
// звёздочка разрешалась в любом месте, и это давало обход запрета ниже:
// ключи 'cap*', 'role*', 'admin*' не содержат двоеточия, поэтому проходили
// и через RESERVED_RE, и через фильтр в resolveAccess — то есть выдача
// «доступа» превращалась в выдачу полномочия.
const FEATURE_RE  = /^(\*|[A-Za-z0-9][A-Za-z0-9:._-]{0,197}(:\*)?)$/;
// Префиксы, которые НЕЛЬЗЯ выдать через /access/grant: это полномочия и роли,
// они живут в role_grants/user_roles. Иначе выдача доступа = самоповышение.
// Совпадение по ИМЕНИ ПРОСТРАНСТВА, а не по «слово с двоеточием»: иначе
// 'cap*', 'capX', 'admin-panel' проскакивали мимо запрета.
const RESERVED_RE = /^(cap|role|admin)([:._*-]|$)/i;

// ─── JWT ─────────────────────────────────────────────────────────────
// Та же функция, что в progress.js/submit.js/content-publish.js, БЕЗ изменений:
// HMAC-SHA256, constant-time сравнение подписи, проверка exp.
function verifyJWT(token, secret){
  if(!token || !secret) return null;
  const [h, b, s] = token.split('.');
  if(!h || !b || !s) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
  const expBuf = Buffer.from(expected), sigBuf = Buffer.from(s);
  if(expBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expBuf, sigBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if(payload.exp && payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch(_){ return null; }
}

// ─── чтение строк YDB ────────────────────────────────────────────────
const txt  = (v) => (v == null ? null : v.textValue ?? null);
const bool = (v) => !!(v && v.boolValue);
const num  = (v) => { const x = v?.uint64Value ?? v?.uint32Value ?? v?.int64Value ?? v?.int32Value; return x == null ? null : Number(String(x)); };
// Timestamp в YDB — микросекунды от эпохи.
const ts   = (v) => { const x = v?.uint64Value ?? v?.int64Value; return x == null ? null : new Date(Number(String(x))/1000).toISOString(); };

const rowsOf = (rs, i) => (rs?.resultSets?.[i || 0]?.rows || []);

async function q1(drv, sql, params){
  let rs = null;
  await drv.tableClient.withSession(async (s) => { rs = await s.executeQuery(sql, params || {}); });
  return rs;
}

// Несколько вариантов одного запроса: первый — основной, дальше страховки на
// случай, если YQL-конструкция не поддерживается в этой версии YDB (в этом
// проекте на такое уже наступали: NULLS LAST, коррелированный NOT EXISTS,
// GROUP BY по выражению). Ошибку последнего варианта ПРОБРАСЫВАЕМ — падение
// должно быть видно как 5xx, а не притворяться пустым ответом.
async function tryQueries(drv, variants){
  let last = null;
  for(const v of variants){
    try {
      const rs = await q1(drv, v.sql, v.params);
      if(v.note) console.warn('[access] использован запасной запрос:', v.note);
      return rs;
    } catch(e){
      last = e;
      console.error('[access] вариант запроса не прошёл', v.note || 'основной', e?.message || e);
    }
  }
  throw last || new Error('no query variants');
}

// YQL-литерал Timestamp. Миллисекунды парсер литерала не принимает, поэтому
// режем до секунд — ровно как в leaderboard.js. Значение всегда получено из
// Date#toISOString (формат фиксирован), подстановка в текст запроса безопасна;
// все данные от клиента идут параметрами через TypedValues.
function tsLiteral(d){ return 'Timestamp("' + d.toISOString().slice(0,19) + 'Z")'; }

// ═══════════════════════════════════════════════════════════════════
// resolveAccess — единственное место, где вычисляются эффективные права.
// Экспортируется: progress.js отдаёт role/features клиенту вместе с прогрессом,
// чтобы витрина (гейты разделов) не требовала второго запроса.
//
//   resolveAccess(drv, { userId, ownerKeys }) →
//     { role, roleTitle, rankLevel, isSuperadmin, caps:[], features:{k:bool}, ownerKeys:[] }
//
// features = галочки роли (role_grants), перекрытые персональными строками
// entitlements (с учётом expires_at). Отсутствие ключа означает «явного
// решения нет» — тогда действует default_access из каталога, это решает
// вызывающий, а не эта функция.
// ═══════════════════════════════════════════════════════════════════
async function resolveAccess(drv, opts){
  const o = opts || {};
  const userId = o.userId ? String(o.userId).slice(0, MAX_ID) : null;
  const keys = ownerKeysFor(userId, o.ownerKeys);

  const out = {
    role: DEFAULT_ROLE, roleTitle: DEFAULT_ROLE, rankLevel: 0,
    isSuperadmin: false, caps: [], features: {}, ownerKeys: keys,
  };

  await drv.tableClient.withSession(async (s) => {
    // 1. Справочник ролей. Три строки, читаем целиком: нужен и rank_level
    //    выбранной роли, и роль по умолчанию.
    const rRoles = await s.executeQuery(`SELECT role_id, title, rank_level, is_default FROM roles;`, {});
    const roles = new Map();
    let defaultRole = null;
    for(const row of rowsOf(rRoles)){
      const rec = {
        roleId: txt(row.items[0]),
        title: txt(row.items[1]) || txt(row.items[0]),
        rankLevel: num(row.items[2]) || 0,
        isDefault: bool(row.items[3]),
      };
      if(rec.roleId) roles.set(rec.roleId, rec);
      if(rec.isDefault && !defaultRole) defaultRole = rec;
    }
    if(!defaultRole){
      // Инвариант миграции 003 — ровно одна роль с is_default=true. Если его
      // нарушили, безопасное направление одно: минимальные права.
      console.warn('[access] в roles нет строки is_default=true — беру', DEFAULT_ROLE);
      defaultRole = roles.get(DEFAULT_ROLE) || { roleId: DEFAULT_ROLE, title: DEFAULT_ROLE, rankLevel: 0 };
    }

    // 2. Персональная строка роли. Только по user_id из проверенного токена.
    let mine = null;
    if(userId){
      const rMine = await s.executeQuery(
        `DECLARE $u AS Utf8; SELECT role_id FROM user_roles WHERE user_id = $u;`,
        { '$u': TypedValues.utf8(userId) });
      const row = rowsOf(rMine)[0];
      if(row) mine = txt(row.items[0]);
    }

    let rec = mine ? roles.get(mine) : null;
    if(mine && !rec){
      // Роль удалили, а строка осталась. Понижаем до роли по умолчанию —
      // «неизвестная роль» не должна означать «пускать куда попало».
      console.warn('[access] user_roles ссылается на несуществующую роль:', mine);
    }
    if(!rec) rec = defaultRole;

    out.role = rec.roleId;
    out.roleTitle = rec.title;
    out.rankLevel = rec.rankLevel;
    out.isSuperadmin = rec.roleId === SUPERADMIN_ROLE;

    // 3. Галочки роли.
    const rG = await s.executeQuery(
      `DECLARE $r AS Utf8; SELECT feature, granted FROM role_grants WHERE role_id = $r;`,
      { '$r': TypedValues.utf8(out.role) });
    for(const row of rowsOf(rG)){
      const f = txt(row.items[0]);
      if(f) out.features[f] = bool(row.items[1]);
    }

    // 4. Персональные исключения. Порядок ключей в ownerKeysFor: сначала
    //    гостевые (dev:), последним — аккаунт (usr:), чтобы строка аккаунта
    //    перебивала унаследованную от устройства.
    const now = Date.now();
    for(const key of keys){
      const rE = await s.executeQuery(
        `DECLARE $o AS Utf8; SELECT feature, granted, expires_at FROM entitlements WHERE owner_key = $o;`,
        { '$o': TypedValues.utf8(key) });
      for(const row of rowsOf(rE)){
        const f = txt(row.items[0]);
        if(!f) continue;
        if(RESERVED_RE.test(f)){
          // Такой строки здесь быть не должно: ручка /access/grant её не
          // пропустит. Если она появилась (ручной SQL, старая миграция) —
          // это НЕ повод выдать полномочие. Игнорируем и шумим в логи.
          console.warn('[access] в entitlements строка с запрещённым префиксом, игнорирую:', key.slice(0,40), f.slice(0,60));
          continue;
        }
        const exp = ts(row.items[2]);
        if(exp && Date.parse(exp) <= now) continue;   // истекло = строки нет
        out.features[f] = bool(row.items[1]);
      }
    }
  });

  // caps считаются ПОСЛЕ слияния, но строки с cap:* из entitlements выше
  // отброшены — значит полномочия приходят только из role_grants.
  out.caps = Object.keys(out.features).filter(f => f.indexOf('cap:') === 0 && out.features[f] === true).sort();
  return out;
}

// Какие owner_key имеет право читать этот вызов. Гостевые ключи берём как
// есть (их проверил вызывающий — progress.js требует X-Device-Secret), а вот
// 'usr:' допускаем ТОЛЬКО свой: иначе неосторожный вызов
// resolveAccess(drv,{ownerKeys:['usr:чужой']}) отдал бы чужие доступы.
function ownerKeysFor(userId, extra){
  const out = [], seen = new Set();
  const push = (k) => { if(k && !seen.has(k)){ seen.add(k); out.push(k); } };
  const list = Array.isArray(extra) ? extra : (extra ? [extra] : []);
  for(const raw of list){
    const key = String(raw || '').slice(0, MAX_ID + 8);
    if(!key) continue;
    if(key.indexOf(OWNER_DEV) === 0 && key.length > OWNER_DEV.length){ push(key); continue; }
    if(userId && key === OWNER_USER + userId) continue;      // добавится ниже, последним
    console.warn('[access] ownerKey отброшен (не своё пространство):', key.slice(0, 40));
  }
  if(userId) push(OWNER_USER + userId);
  return out;
}

// ─── журнал ──────────────────────────────────────────────────────────
// Пишем и успехи, и отказы. Поломка журнала не должна ронять уже сделанное
// действие, но и молчать о ней нельзя: возвращаем признак, ответ его несёт
// полем audited:false — иначе «действие было, записи нет» никто не заметит.
async function audit(drv, entry){
  try {
    await q1(drv, `
      DECLARE $id AS Utf8; DECLARE $a AS Utf8; DECLARE $act AS Utf8;
      DECLARE $t AS Optional<Utf8>; DECLARE $f AS Optional<Utf8>;
      DECLARE $res AS Utf8; DECLARE $why AS Optional<Utf8>; DECLARE $p AS Optional<Utf8>;
      UPSERT INTO access_audit (id, at, actor, action, target, feature, result, reason, payload_json)
      VALUES ($id, CurrentUtcTimestamp(), $a, $act, $t, $f, $res, $why, $p);`,
      {
        '$id':  TypedValues.utf8(crypto.randomUUID()),
        '$a':   TypedValues.utf8(String(entry.actor || 'anon').slice(0, MAX_ID + 8)),
        '$act': TypedValues.utf8(String(entry.action).slice(0, 64)),
        '$t':   entry.target  ? TypedValues.optional(TypedValues.utf8(String(entry.target).slice(0, MAX_ID + 8))) : TypedValues.optionalNull(Types.UTF8),
        '$f':   entry.feature ? TypedValues.optional(TypedValues.utf8(String(entry.feature).slice(0, MAX_FEATURE))) : TypedValues.optionalNull(Types.UTF8),
        '$res': TypedValues.utf8(String(entry.result || 'ok')),
        '$why': entry.reason  ? TypedValues.optional(TypedValues.utf8(String(entry.reason).slice(0, MAX_NOTE))) : TypedValues.optionalNull(Types.UTF8),
        '$p':   entry.payload ? TypedValues.optional(TypedValues.utf8(safeJson(entry.payload).slice(0, 8000))) : TypedValues.optionalNull(Types.UTF8),
      });
    return true;
  } catch(e){
    console.error('[access] ЖУРНАЛ НЕ ЗАПИСАН', entry?.action, entry?.result, e?.message || e);
    return false;
  }
}

function safeJson(v){
  try { return JSON.stringify(v); } catch(_){ return '"unserializable"'; }
}

// Отказ = ответ + запись в журнал. Возвращаем причину клиенту: она нужна
// админке («не хватает cap:roles.manage», «последний суперадмин») и секретом
// не является — тот, кому отказали, и так знает, что он делал.
async function deny(drv, ctx, code, action, opts){
  const o = opts || {};
  // Состояние токена в записи об отказе — тот самый след, ради которого отказы
  // и пишутся: 'invalid' значит, что кто-то ходит с ПОДДЕЛАННЫМ или истёкшим
  // токеном (по одному 'anon' это неотличимо от обычного гостя без токена).
  const payload = Object.assign({ token: ctx.tokenInvalid ? 'invalid' : (ctx.userId ? 'ok' : 'absent') }, o.payload || {});
  const audited = await audit(drv, {
    actor: ctx.actor, action, target: o.target, feature: o.feature,
    result: 'denied', reason: o.reason, payload,
  });
  return fail(code, o.error || 'forbidden', { reason: o.reason, audited });
}

// ─── разбор пути ─────────────────────────────────────────────────────
function reqPath(event){
  return String(
    event?.path || event?.url ||
    event?.requestContext?.http?.path || event?.requestContext?.path || ''
  );
}
function routeOf(event){
  const p = reqPath(event).split('?')[0].replace(/\/+$/, '');
  const i = p.lastIndexOf('/access');
  if(i < 0) return null;
  const rest = p.slice(i + '/access'.length);
  if(rest === '') return '/';
  const m = /^\/([A-Za-z0-9._-]{1,40})$/.exec(rest);
  return m ? '/' + m[1] : null;
}

// ═══════════════════════════════════════════════════════════════════
// handler
// ═══════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  applyCors(event);
  const method = String(event?.httpMethod || 'GET').toUpperCase();
  if(method === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' };

  const route = routeOf(event);
  if(!route || route === '/') return fail(404, 'unknown access route');

  let body = {};
  if(event.body){
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
    catch(_){ return fail(400, 'invalid json'); }
    if(!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'body must be an object');
  }
  const query = event.queryStringParameters || {};

  let drv;
  try { drv = await getDriver(); }
  catch(e){ console.error('[access] YDB unavailable', e); return fail(503, 'db unavailable'); }

  try {
    // Идентичность — только из проверенного токена. Ни ник, ни user_id, ни
    // роль из тела/заголовков не участвуют.
    const auth = event.headers?.Authorization || event.headers?.authorization;
    const hasBearer = !!(auth && auth.startsWith('Bearer '));
    const payload = hasBearer ? verifyJWT(auth.slice(7), process.env.JWT_SECRET) : null;
    const userId = payload?.sub ? String(payload.sub).slice(0, MAX_ID) : null;

    // БЕЗ ТОКЕНА — сразу 401, ДО обращений к БД и ДО записи в журнал.
    // Раньше любой POST без токена запускал resolveAccess (3-4 запроса к YDB)
    // и добавлял строку в access_audit: цикл curl без единого пароля раздувал
    // журнал и грузил базу. Единственное исключение — /me: «кто я и что мне
    // открыто» это не секрет, и гостю там честно отвечают ролью по умолчанию.
    if(!userId && route !== '/me'){
      return fail(401, 'unauthorized', {
        reason: hasBearer ? 'токен недействителен или истёк' : 'нужен вход',
      });
    }

    // Права актора вычисляются на каждом запросе, из БД. Кэша нет намеренно:
    // понижение роли должно действовать сразу, а не «когда протухнет токен».
    const access = await resolveAccess(drv, { userId });
    const ctx = Object.assign({}, access, {
      userId,
      actor: userId ? OWNER_USER + userId : 'anon',
      tokenInvalid: hasBearer && !userId,
      has(cap){ return this.caps.indexOf(cap) >= 0; },
    });

    if(route === '/me')         return method === 'GET'  ? handleMe(ctx) : fail(405, 'method not allowed');
    if(route === '/people')     return method === 'GET'  ? await handlePeople(drv, ctx, query) : fail(405, 'method not allowed');
    if(route === '/audit')      return method === 'GET'  ? await handleAudit(drv, ctx, query) : fail(405, 'method not allowed');
    if(route === '/role')       return method === 'POST' ? await handleRole(drv, ctx, body) : fail(405, 'method not allowed');
    if(route === '/grant')      return method === 'POST' ? await handleGrant(drv, ctx, body) : fail(405, 'method not allowed');
    if(route === '/revoke')     return method === 'POST' ? await handleRevoke(drv, ctx, body) : fail(405, 'method not allowed');
    if(route === '/role-grant') return method === 'POST' ? await handleRoleGrant(drv, ctx, body) : fail(405, 'method not allowed');
    if(route === '/catalog'){
      if(method === 'GET')  return await handleCatalogRead(drv, ctx);
      if(method === 'POST') return await handleCatalog(drv, ctx, body);
      return fail(405, 'method not allowed');
    }
    return fail(404, 'unknown access route');
  } catch(e){
    // Ошибка БД — это 5xx, а не «успешно, ничего нет». Пустой ответ на
    // сломанном запросе однажды уже выглядел как «прав нет»: клиент затирал
    // кэш и раздел исчезал у всех.
    console.error('[access] failed', route, e);
    return fail(500, 'db error', { detail: String(e?.message || e).slice(0, 300) });
  }
};

// ─── GET /access/me ──────────────────────────────────────────────────
// Без токена — тоже 200 с ролью по умолчанию: это не секрет, а клиенту нужно
// знать, что показывать. 401 здесь только мешал бы: гость — штатный сценарий.
function handleMe(ctx){
  return ok({
    role: ctx.role,
    roleTitle: ctx.roleTitle,
    rankLevel: ctx.rankLevel,
    caps: ctx.caps,
    isSuperadmin: ctx.isSuperadmin,
    // features отдаём тем же ответом: клиентские гейты разделов иначе
    // потребовали бы второго запроса за теми же строками.
    features: ctx.features,
    isUser: !!ctx.userId,
  });
}

// ─── GET /access/people?q= ───────────────────────────────────────────
// Наружу только то, без чего админка не работает: ник, роль, когда заходил,
// user_id (им же адресуется смена роли). tg_user_id, email, avatar НЕ отдаём —
// это чужие персональные данные, а для управления доступом они не нужны.
// Искать по tg_user_id можно, отдавать его наружу — нет.
async function handlePeople(drv, ctx, query){
  if(!ctx.has('cap:people.view')){
    return deny(drv, ctx, 403, 'people.view', { reason: 'cap:people.view required' });
  }
  const q = String(query.q || '').trim().slice(0, MAX_QUERY);
  const tg = /^\d{1,18}$/.test(q) ? q : '-1';           // -1 — заведомо несуществующий tg_user_id
  const like = '%' + q + '%';

  // Регистронезависимый поиск по нику — через Unicode::ToLower (ник кириллицей,
  // ASCII-функции здесь бесполезны). Если модуля Unicode в этой сборке YDB нет,
  // остаётся регистрозависимый LIKE: поиск станет хуже, но не исчезнет.
  // Символы % и _ в запросе работают как шаблон LIKE — для админского поиска
  // это скорее удобно, и подстановки тут нет: значение идёт параметром.
  //
  // Пустой запрос НЕ отдельной веткой условия: при q='' шаблон равен '%', и
  // `nickname LIKE '%'` истинен для всех строк (nickname — NOT NULL). Так в
  // тексте нет сравнения параметра Utf8 со строковым литералом, из-за которого
  // YQL мог бы заспорить о типах.
  const sql = (nick) => `
    DECLARE $q AS Utf8; DECLARE $like AS Utf8; DECLARE $tg AS Int64; DECLARE $n AS Uint64;
    SELECT user_id, nickname, last_seen_at, email, email_verified,
           registered_via, created_at, deleted_at, first_name, last_name, phone
    FROM users
    WHERE user_id = $q OR tg_user_id = $tg OR ${nick} LIKE $like
    ORDER BY last_seen_at DESC
    LIMIT $n;`;
  const params = {
    '$q':    TypedValues.utf8(q),
    '$like': TypedValues.utf8(q ? like.toLowerCase() : '%'),
    '$tg':   TypedValues.int64(parseInt(tg, 10)),
    '$n':    TypedValues.uint64(PEOPLE_LIMIT),
  };
  const rs = await tryQueries(drv, [
    { sql: sql('Unicode::ToLower(nickname)'), params },
    { sql: sql('nickname'), note: 'people: LIKE без Unicode::ToLower',
      params: Object.assign({}, params, { '$like': TypedValues.utf8(q ? like : '%') }) },
  ]);

  // Реестр регистраций и список людей — один и тот же ответ: отдельная ручка
  // потребовала бы отдельной функции, а квота исчерпана. Почта и способ
  // регистрации отдаются ТОЛЬКО здесь, под cap:people.view — это внутренний
  // экран администратора. tg_user_id по-прежнему не отдаём: он не нужен ни для
  // одного действия в интерфейсе, а утекать ему незачем.
  const found = rowsOf(rs).map(row => ({
    userId: txt(row.items[0]),
    nickname: txt(row.items[1]),
    lastSeenAt: ts(row.items[2]),
    email: txt(row.items[3]),
    emailVerified: !!row.items[4]?.boolValue,
    registeredVia: txt(row.items[5]) || (txt(row.items[3]) ? 'email' : 'telegram'),
    createdAt: ts(row.items[6]),
    deleted: ts(row.items[7]) != null,
    fullName: [txt(row.items[8]), txt(row.items[9])].filter(Boolean).join(' ') || null,
    phone: txt(row.items[10]),
  })).filter(p => p.userId);

  const rolesByUser = await rolesForUsers(drv, found.map(p => p.userId));
  const roles = await readRoles(drv);
  const defaultRole = roles.find(r => r.isDefault) || { roleId: DEFAULT_ROLE };

  const people = found.map(p => ({
    userId: p.userId,
    nickname: p.nickname,
    lastSeenAt: p.lastSeenAt,
    email: p.email,
    emailVerified: p.emailVerified,
    registeredVia: p.registeredVia,
    createdAt: p.createdAt,
    deleted: p.deleted,
    fullName: p.fullName,
    phone: p.phone,
    role: rolesByUser.get(p.userId) || defaultRole.roleId,
    // explicit=false значит «роли не выдавали, действует та, что по умолчанию»:
    // в интерфейсе это разные состояния, иначе снятие роли неотличимо от
    // «никогда не выдавали».
    explicit: rolesByUser.has(p.userId),
  }));

  // Справочник ролей — тем же ответом: выпадающий список в админке иначе
  // потребовал бы отдельной ручки (а квота на функции исчерпана).
  return ok({
    people, roles, q,
    limit: PEOPLE_LIMIT,
    truncated: people.length >= PEOPLE_LIMIT,
  });
}

async function readRoles(drv){
  const rs = await q1(drv, `SELECT role_id, title, rank_level, is_default FROM roles;`, {});
  return rowsOf(rs).map(row => ({
    roleId: txt(row.items[0]),
    title: txt(row.items[1]),
    rankLevel: num(row.items[2]) || 0,
    isDefault: bool(row.items[3]),
  })).filter(r => r.roleId).sort((a, b) => a.rankLevel - b.rankLevel);
}

// Роли только для найденных id: `WHERE user_id IN ($u0,…,$u49)`. Читать
// user_roles целиком было бы проще, но тогда при росте таблицы часть людей
// молча показывалась бы с ролью по умолчанию — то есть админка врала бы.
async function rolesForUsers(drv, ids){
  const out = new Map();
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  for(let i = 0; i < uniq.length; i += IDS_CHUNK){
    const part = uniq.slice(i, i + IDS_CHUNK);
    const decl = part.map((_, k) => `DECLARE $u${k} AS Utf8;`).join(' ');
    const list = part.map((_, k) => `$u${k}`).join(', ');
    const params = {};
    part.forEach((id, k) => { params['$u' + k] = TypedValues.utf8(String(id)); });
    const ors = part.map((_, k) => `user_id = $u${k}`).join(' OR ');
    const rs = await tryQueries(drv, [
      { sql: `${decl}\nSELECT user_id, role_id FROM user_roles WHERE user_id IN (${list});`, params },
      // Страховка: если IN со списком параметров чем-то не устроит планировщик,
      // цепочка равенств по PK работает всегда.
      { sql: `${decl}\nSELECT user_id, role_id FROM user_roles WHERE ${ors};`, params,
        note: 'rolesForUsers: OR вместо IN' },
    ]);
    for(const row of rowsOf(rs)) out.set(txt(row.items[0]), txt(row.items[1]));
  }
  return out;
}

// ─── POST /access/role ───────────────────────────────────────────────
async function handleRole(drv, ctx, body){
  const action = 'role.set';
  if(!ctx.has(CAP_ROLES_MANAGE)){
    return deny(drv, ctx, 403, action, { reason: CAP_ROLES_MANAGE + ' required' });
  }

  // Роль — только аккаунту. 'dev:*' отвергаем явно: у гостевого устройства
  // роли не бывает (см. миграцию 003), ему выдают персональные доступы.
  const rawTarget = String(body.userId || '').trim();
  if(rawTarget.indexOf(OWNER_DEV) === 0){
    return deny(drv, ctx, 400, action, { target: rawTarget.slice(0, MAX_ID), error: 'bad request',
      reason: 'роль выдаётся только аккаунту, устройству — нет' });
  }
  const targetId = (rawTarget.indexOf(OWNER_USER) === 0 ? rawTarget.slice(OWNER_USER.length) : rawTarget).slice(0, MAX_ID);
  const roleId = String(body.roleId || '').trim().slice(0, 64);
  if(!targetId || !roleId){
    return deny(drv, ctx, 400, action, { error: 'bad request', reason: 'userId и roleId обязательны' });
  }
  const note = body.note == null ? null : String(body.note).slice(0, MAX_NOTE);
  const target = OWNER_USER + targetId;

  const roles = await readRoles(drv);
  const next = roles.find(r => r.roleId === roleId);
  if(!next){
    return deny(drv, ctx, 400, action, { target, error: 'bad request', reason: 'нет такой роли: ' + roleId });
  }

  // Аккаунт должен существовать: иначе в user_roles накапливаются строки на
  // выдуманные id, и «последнего суперадмина» можно накрутить пустышками.
  const rU = await q1(drv, `DECLARE $u AS Utf8; SELECT nickname FROM users WHERE user_id = $u;`,
    { '$u': TypedValues.utf8(targetId) });
  if(!rowsOf(rU)[0]){
    return deny(drv, ctx, 404, action, { target, error: 'not found', reason: 'аккаунт не найден' });
  }

  const rCur = await q1(drv, `DECLARE $u AS Utf8; SELECT role_id FROM user_roles WHERE user_id = $u;`,
    { '$u': TypedValues.utf8(targetId) });
  const curRoleId = rowsOf(rCur)[0] ? txt(rowsOf(rCur)[0].items[0]) : null;
  const defaultRole = roles.find(r => r.isDefault) || { roleId: DEFAULT_ROLE, rankLevel: 0 };
  const cur = (curRoleId && roles.find(r => r.roleId === curRoleId)) || defaultRole;

  // Нельзя выдать больше, чем имеешь сам.
  if(next.rankLevel > ctx.rankLevel){
    return deny(drv, ctx, 403, action, { target, reason: 'нельзя выдать роль выше своей (' + next.rankLevel + ' > ' + ctx.rankLevel + ')' });
  }
  // …и нельзя тронуть того, кто выше тебя. Без этой проверки админ (90) снимал
  // бы суперадмина (100), «понижая» — формально выдавая роль ниже своей.
  if(cur.rankLevel > ctx.rankLevel){
    return deny(drv, ctx, 403, action, { target, reason: 'нельзя менять роль у аккаунта выше своего ранга' });
  }

  // Последний суперадмин. Считаем по индексу user_roles_by_role.
  // null (не смогли посчитать) трактуем как «он последний»: сомнение здесь
  // должно работать в сторону отказа, а не в сторону потери управления.
  const demoting = curRoleId === SUPERADMIN_ROLE && roleId !== SUPERADMIN_ROLE;
  if(demoting){
    const left = await countRole(drv, SUPERADMIN_ROLE);
    if(left == null || left <= 1){
      return deny(drv, ctx, 409, action, { target, error: 'conflict',
        reason: 'это последний суперадмин — сначала выдайте роль кому-то ещё' });
    }
  }

  await q1(drv, `
    DECLARE $u AS Utf8; DECLARE $r AS Utf8; DECLARE $by AS Utf8; DECLARE $note AS Optional<Utf8>;
    UPSERT INTO user_roles (user_id, role_id, granted_by, granted_at, note)
    VALUES ($u, $r, $by, CurrentUtcTimestamp(), $note);`,
    {
      '$u':    TypedValues.utf8(targetId),
      '$r':    TypedValues.utf8(roleId),
      '$by':   TypedValues.utf8(ctx.actor),
      '$note': note ? TypedValues.optional(TypedValues.utf8(note)) : TypedValues.optionalNull(Types.UTF8),
    });

  // Проверка ПОСЛЕ записи. Между countRole и UPSERT есть окно: два
  // одновременных понижения двух последних суперадминов оба увидят «нас
  // двое» и оба пройдут. Транзакции здесь нет (в проекте её нет нигде),
  // поэтому компенсируем: если суперадминов не осталось — возвращаем роль
  // назад. Восстановление идемпотентно, параллельные компенсации безвредны.
  if(demoting && (await countRole(drv, SUPERADMIN_ROLE)) === 0){
    await q1(drv, `
      DECLARE $u AS Utf8; DECLARE $r AS Utf8; DECLARE $by AS Utf8;
      UPSERT INTO user_roles (user_id, role_id, granted_by, granted_at, note)
      VALUES ($u, $r, $by, CurrentUtcTimestamp(), "откат: без суперадминов система неуправляема");`,
      { '$u': TypedValues.utf8(targetId), '$r': TypedValues.utf8(SUPERADMIN_ROLE), '$by': TypedValues.utf8(ctx.actor) });
    return deny(drv, ctx, 409, action, { target, error: 'conflict',
      reason: 'гонка: суперадминов не осталось, роль возвращена',
      payload: { attempted: roleId, restored: SUPERADMIN_ROLE } });
  }

  const audited = await audit(drv, {
    actor: ctx.actor, action, target, result: 'ok',
    reason: note || null,
    payload: { before: curRoleId, beforeEffective: cur.roleId, after: roleId, explicitBefore: !!curRoleId },
  });
  return ok({ ok:true, userId: targetId, role: roleId, before: curRoleId, audited });
}

async function countRole(drv, roleId){
  // COUNT(*) с алиасом: GROUP BY здесь нет, но алиас всё равно обязателен для
  // читаемого чтения строки. Индекс user_roles_by_role добавлен в 003 ровно
  // под эту проверку.
  const rs = await tryQueries(drv, [
    { sql: `DECLARE $r AS Utf8; SELECT COUNT(*) AS cnt FROM user_roles VIEW user_roles_by_role WHERE role_id = $r;`,
      params: { '$r': TypedValues.utf8(roleId) } },
    { sql: `DECLARE $r AS Utf8; SELECT COUNT(*) AS cnt FROM user_roles WHERE role_id = $r;`,
      note: 'countRole: без VIEW user_roles_by_role',
      params: { '$r': TypedValues.utf8(roleId) } },
  ]);
  const row = rowsOf(rs)[0];
  // null = «посчитать не удалось». Возвращаем его как есть, чтобы вызывающий
  // сам решил, как трактовать неизвестность: перед понижением — «он
  // последний» (отказ), в проверке после записи — «откат не нужен».
  return row ? num(row.items[0]) : null;
}

// ─── POST /access/grant ──────────────────────────────────────────────
async function handleGrant(drv, ctx, body){
  const action = 'grant';
  if(!ctx.has('cap:access.grant')){
    return deny(drv, ctx, 403, action, { reason: 'cap:access.grant required' });
  }

  const ownerKey = String(body.ownerKey || '').trim().slice(0, MAX_ID + 8);
  const okOwner = (ownerKey.indexOf(OWNER_USER) === 0 || ownerKey.indexOf(OWNER_DEV) === 0)
    && ownerKey.length > OWNER_DEV.length;
  if(!okOwner){
    return deny(drv, ctx, 400, action, { target: ownerKey || null, error: 'bad request',
      reason: 'ownerKey обязан начинаться с usr: или dev: (инвариант миграции 002)' });
  }

  const feature = String(body.feature || '').trim();
  if(!FEATURE_RE.test(feature)){
    return deny(drv, ctx, 400, action, { target: ownerKey, feature: feature.slice(0, MAX_FEATURE),
      error: 'bad request', reason: 'ключ возможности вне допустимого набора символов' });
  }
  // Главный запрет ручки: выдать полномочие или роль через доступы нельзя.
  if(RESERVED_RE.test(feature)){
    return deny(drv, ctx, 403, action, { target: ownerKey, feature,
      reason: 'через выдачу доступов нельзя выдать cap:/role:/admin: — полномочия живут в role_grants' });
  }

  const granted = parseBool(body.granted);
  if(granted === null){
    return deny(drv, ctx, 400, action, { target: ownerKey, feature, error: 'bad request',
      reason: 'granted должен быть true или false' });
  }
  // Нельзя выдать больше, чем имеешь сам: то, что ЗАКРЫТО тебе, ты не
  // открываешь другим. Отсутствие ключа не запрет — это «решения нет».
  // Суперадмин исключён намеренно: он корень доверия и настраивает в том числе
  // то, что закрыл себе сам (иначе разовый минус в матрице запирал бы раздел
  // для всей системы без пути назад).
  if(granted === true && ctx.features[feature] === false && !ctx.isSuperadmin){
    return deny(drv, ctx, 403, action, { target: ownerKey, feature,
      reason: 'нельзя открыть то, что закрыто тебе самому' });
  }

  const source = String(body.source || 'manual').trim().slice(0, MAX_SOURCE) || 'manual';
  const exp = parseExpires(body.expiresAt);
  if(!exp.ok){
    return deny(drv, ctx, 400, action, { target: ownerKey, feature, error: 'bad request', reason: exp.why });
  }

  const before = await readEntitlement(drv, ownerKey, feature);
  await q1(drv, `
    DECLARE $o AS Utf8; DECLARE $f AS Utf8; DECLARE $g AS Bool;
    DECLARE $s AS Optional<Utf8>; DECLARE $by AS Optional<Utf8>;
    UPSERT INTO entitlements (owner_key, feature, granted, source, granted_by, expires_at, created_at)
    VALUES ($o, $f, $g, $s, $by, ${exp.date ? tsLiteral(exp.date) : 'NULL'}, CurrentUtcTimestamp());`,
    {
      '$o':  TypedValues.utf8(ownerKey),
      '$f':  TypedValues.utf8(feature),
      '$g':  TypedValues.bool(granted),
      '$s':  TypedValues.optional(TypedValues.utf8(source)),
      '$by': TypedValues.optional(TypedValues.utf8(ctx.actor)),
    });

  const audited = await audit(drv, {
    actor: ctx.actor, action, target: ownerKey, feature, result: 'ok',
    payload: { before, after: { granted, source, expiresAt: exp.date ? exp.date.toISOString() : null } },
  });
  return ok({ ok:true, ownerKey, feature, granted, source, expiresAt: exp.date ? exp.date.toISOString() : null, before, audited });
}

// ─── POST /access/revoke ─────────────────────────────────────────────
// Снимаем СТРОКУ, а не ставим granted=false. Это разные вещи: false — явный
// запрет поверх роли, отсутствие строки — «как у всех с этой ролью». Иначе
// «убрать исключение» навсегда закрывало бы раздел, который роль открывает.
async function handleRevoke(drv, ctx, body){
  const action = 'revoke';
  if(!ctx.has('cap:access.grant')){
    return deny(drv, ctx, 403, action, { reason: 'cap:access.grant required' });
  }
  const ownerKey = String(body.ownerKey || '').trim().slice(0, MAX_ID + 8);
  const okOwner = (ownerKey.indexOf(OWNER_USER) === 0 || ownerKey.indexOf(OWNER_DEV) === 0)
    && ownerKey.length > OWNER_DEV.length;
  if(!okOwner){
    return deny(drv, ctx, 400, action, { target: ownerKey || null, error: 'bad request',
      reason: 'ownerKey обязан начинаться с usr: или dev:' });
  }
  const feature = String(body.feature || '').trim();
  if(!FEATURE_RE.test(feature)){
    return deny(drv, ctx, 400, action, { target: ownerKey, error: 'bad request',
      reason: 'ключ возможности вне допустимого набора символов' });
  }
  // Запрещённые префиксы здесь НЕ блокируем: удаление ничего не открывает, а
  // подчистить занесённую руками строку 'cap:*' из entitlements надо уметь.

  const before = await readEntitlement(drv, ownerKey, feature);
  await q1(drv, `
    DECLARE $o AS Utf8; DECLARE $f AS Utf8;
    DELETE FROM entitlements WHERE owner_key = $o AND feature = $f;`,
    { '$o': TypedValues.utf8(ownerKey), '$f': TypedValues.utf8(feature) });

  const audited = await audit(drv, {
    actor: ctx.actor, action, target: ownerKey, feature, result: 'ok',
    reason: before ? null : 'строки не было',
    payload: { before, existed: !!before },
  });
  return ok({ ok:true, ownerKey, feature, existed: !!before, before, audited });
}

async function readEntitlement(drv, ownerKey, feature){
  const rs = await q1(drv, `
    DECLARE $o AS Utf8; DECLARE $f AS Utf8;
    SELECT granted, source, granted_by, expires_at FROM entitlements
    WHERE owner_key = $o AND feature = $f;`,
    { '$o': TypedValues.utf8(ownerKey), '$f': TypedValues.utf8(feature) });
  const row = rowsOf(rs)[0];
  if(!row) return null;
  return {
    granted: bool(row.items[0]),
    source: txt(row.items[1]),
    grantedBy: txt(row.items[2]),
    expiresAt: ts(row.items[3]),
  };
}

// ─── POST /access/role-grant ─────────────────────────────────────────
// Здесь cap:* РАЗРЕШЕНЫ: это и есть настройка полномочий роли.
async function handleRoleGrant(drv, ctx, body){
  const action = 'role.grant';
  if(!ctx.has(CAP_ROLES_MANAGE)){
    return deny(drv, ctx, 403, action, { reason: CAP_ROLES_MANAGE + ' required' });
  }
  const roleId = String(body.roleId || '').trim().slice(0, 64);
  const feature = String(body.feature || '').trim();
  const granted = parseBool(body.granted);
  if(!roleId || !FEATURE_RE.test(feature) || granted === null){
    return deny(drv, ctx, 400, action, { target: roleId || null, feature: feature.slice(0, MAX_FEATURE),
      error: 'bad request', reason: 'нужны roleId, корректный feature и granted=true|false' });
  }

  const roles = await readRoles(drv);
  const role = roles.find(r => r.roleId === roleId);
  if(!role){
    return deny(drv, ctx, 400, action, { target: roleId, feature, error: 'bad request', reason: 'нет такой роли' });
  }
  // Роль выше своей не настраиваем: иначе админ переписал бы полномочия
  // суперадмина, а через них — свои.
  if(role.rankLevel > ctx.rankLevel){
    return deny(drv, ctx, 403, action, { target: roleId, feature,
      reason: 'нельзя настраивать роль выше своей' });
  }
  // Суперадмин без права управлять ролями = система, в которой роли больше
  // никто не выдаёт. Снимать эту галочку не даём никому, включая суперадмина.
  if(roleId === SUPERADMIN_ROLE && feature === CAP_ROLES_MANAGE && granted === false){
    return deny(drv, ctx, 409, action, { target: roleId, feature, error: 'conflict',
      reason: 'у роли superadmin нельзя снять ' + CAP_ROLES_MANAGE });
  }
  // Нельзя выдать больше, чем имеешь сам. Для суперадмина исключение: он —
  // корень доверия, и НОВЫЙ ключ (только что объявленный каталогом) не держит
  // никто — иначе включить его было бы некому и матрица встала бы намертво.
  if(granted === true && !ctx.isSuperadmin){
    const own = feature.indexOf('cap:') === 0 ? ctx.has(feature) : ctx.features[feature] !== false;
    if(!own){
      return deny(drv, ctx, 403, action, { target: roleId, feature,
        reason: 'нельзя выдать роли то, чего нет у тебя самого' });
    }
  }

  const rBefore = await q1(drv, `
    DECLARE $r AS Utf8; DECLARE $f AS Utf8;
    SELECT granted FROM role_grants WHERE role_id = $r AND feature = $f;`,
    { '$r': TypedValues.utf8(roleId), '$f': TypedValues.utf8(feature) });
  const beforeRow = rowsOf(rBefore)[0];
  const before = beforeRow ? bool(beforeRow.items[0]) : null;

  await q1(drv, `
    DECLARE $r AS Utf8; DECLARE $f AS Utf8; DECLARE $g AS Bool; DECLARE $by AS Utf8;
    UPSERT INTO role_grants (role_id, feature, granted, updated_by, updated_at)
    VALUES ($r, $f, $g, $by, CurrentUtcTimestamp());`,
    {
      '$r':  TypedValues.utf8(roleId),
      '$f':  TypedValues.utf8(feature),
      '$g':  TypedValues.bool(granted),
      '$by': TypedValues.utf8(ctx.actor),
    });

  const audited = await audit(drv, {
    actor: ctx.actor, action, target: roleId, feature, result: 'ok',
    payload: { before, after: granted },
  });
  return ok({ ok:true, roleId, feature, granted, before, audited });
}

// ─── GET /access/audit?limit= ────────────────────────────────────────
async function handleAudit(drv, ctx, query){
  if(!ctx.has('cap:audit.view')){
    return deny(drv, ctx, 403, 'audit.view', { reason: 'cap:audit.view required' });
  }
  const raw = parseInt(query.limit, 10);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, AUDIT_LIMIT) : AUDIT_DEFAULT;

  const cols = `id, at, actor, action, target, feature, result, reason, payload_json`;
  // Сортировка по at DESC — по индексу audit_by_time; страховка на случай,
  // если чтение неиндексированных колонок через VIEW окажется недоступным.
  // NULLS LAST в YQL нет, но и не нужен: at — NOT NULL.
  const rs = await tryQueries(drv, [
    { sql: `DECLARE $n AS Uint64; SELECT ${cols} FROM access_audit VIEW audit_by_time ORDER BY at DESC LIMIT $n;`,
      params: { '$n': TypedValues.uint64(limit) } },
    { sql: `DECLARE $n AS Uint64; SELECT ${cols} FROM access_audit ORDER BY at DESC LIMIT $n;`,
      note: 'audit: без VIEW audit_by_time (полный проход)',
      params: { '$n': TypedValues.uint64(limit) } },
  ]);

  const entries = rowsOf(rs).map(row => ({
    id: txt(row.items[0]),
    at: ts(row.items[1]),
    actor: txt(row.items[2]),
    action: txt(row.items[3]),
    target: txt(row.items[4]),
    feature: txt(row.items[5]),
    result: txt(row.items[6]),
    reason: txt(row.items[7]),
    payloadJson: txt(row.items[8]),
  }));
  return ok({ entries, limit });
}

// ─── POST /access/catalog ────────────────────────────────────────────
// Снимок того, что объявляет клиент. Смысл — чтобы новый тренажёр НЕ требовал
// правки бэкенда: он объявляет свои узлы, они появляются в матрице суперадмина.
// Здесь cap:* допустимы как ОПИСАНИЕ узла — каталог ничего не открывает.
// ─── GET /access/catalog: каталог возможностей + матрица ролей ────────
// Отдельной ручкой это не сделать (квота функций), поэтому GET и POST живут на
// одном пути. Читать может любой, у кого есть хоть одно административное
// полномочие: без каталога вкладка «Доступы» показывать нечего, а сам список
// разделов секретом не является.
async function handleCatalogRead(drv, ctx){
  const allowed = ctx.has('cap:catalog.edit') || ctx.has('cap:access.grant')
    || ctx.has('cap:people.view') || ctx.has('cap:roles.manage');
  if(!allowed){
    return deny(drv, ctx, 403, 'catalog.view', { reason:'нужно любое административное полномочие' });
  }
  const rs = await q1(drv, `SELECT feature, area, parent, title, kind, default_access,
                                   status, sensitive, declared_at, seen_at
                            FROM features;`, {});
  const features = rowsOf(rs).map(r => ({
    feature: txt(r.items[0]), area: txt(r.items[1]), parent: txt(r.items[2]),
    title: txt(r.items[3]), kind: txt(r.items[4]), defaultAccess: txt(r.items[5]),
    status: txt(r.items[6]), sensitive: bool(r.items[7]),
    declaredAt: txt(r.items[8]), seenAt: ts(r.items[9]),
  })).filter(f => f.feature);

  const rg = await q1(drv, 'SELECT role_id, feature, granted FROM role_grants;', {});
  const roleGrants = {};
  for(const r of rowsOf(rg)){
    const role = txt(r.items[0]), feat = txt(r.items[1]);
    if(!role || !feat) continue;
    (roleGrants[role] = roleGrants[role] || {})[feat] = bool(r.items[2]);
  }

  const roles = await readRoles(drv);
  return ok({ features, roleGrants, roles });
}

async function handleCatalog(drv, ctx, body){
  const action = 'catalog.publish';
  if(!ctx.has('cap:catalog.edit')){
    return deny(drv, ctx, 403, action, { reason: 'cap:catalog.edit required' });
  }
  const list = Array.isArray(body.features) ? body.features : null;
  if(!list){
    return deny(drv, ctx, 400, action, { error: 'bad request', reason: 'features должен быть массивом' });
  }
  if(list.length > CATALOG_MAX){
    return deny(drv, ctx, 413, action, { error: 'too many features',
      reason: 'узлов больше ' + CATALOG_MAX, payload: { count: list.length } });
  }

  const VALID_ACCESS = new Set(['open','account','closed']);
  const VALID_STATUS = new Set(['live','wip']);
  const rows = [], rejected = [];
  const seen = new Set();
  for(const raw of list){
    const f = String(raw?.feature || '').trim();
    if(!FEATURE_RE.test(f)){ rejected.push({ feature: String(raw?.feature || '').slice(0,60), why:'bad feature key' }); continue; }
    if(seen.has(f)){ rejected.push({ feature: f, why:'duplicate in batch' }); continue; }
    const area  = String(raw?.area || '').trim().slice(0, 40);
    const title = String(raw?.title || '').trim().slice(0, 200);
    const kind  = String(raw?.kind || '').trim().slice(0, 20);
    const acc   = String(raw?.defaultAccess ?? raw?.default_access ?? '').trim();
    const st    = String(raw?.status || '').trim();
    if(!area || !title || !kind){ rejected.push({ feature: f, why:'area/title/kind required' }); continue; }
    // defaultAccess и status НЕОБЯЗАТЕЛЬНЫ. Раньше они требовались, и это
    // ломало публикацию каталога: страница объявляет, ЧТО у неё есть, а
    // «открыто или закрыто» — решение владельца, оно живёт в features и
    // правится в матрице. Пустое значение = не трогать существующее.
    if(acc && !VALID_ACCESS.has(acc)){ rejected.push({ feature: f, why:'defaultAccess must be open|account|closed' }); continue; }
    if(st && !VALID_STATUS.has(st)){ rejected.push({ feature: f, why:'status must be live|wip' }); continue; }
    const parent = raw?.parent == null || raw.parent === '' ? null : String(raw.parent).slice(0, MAX_FEATURE);
    const declaredAt = raw?.declaredAt ?? raw?.declared_at;
    seen.add(f);
    rows.push({
      feature: f, area, title, kind,
      defaultAccess: acc || null, status: st || null,
      sensitive: raw?.sensitive == null ? null : (parseBool(raw.sensitive) === true),
      parent,
      declaredAt: declaredAt == null || declaredAt === '' ? null : String(declaredAt).slice(0, 200),
    });
  }

  let upserted = 0;
  // Новые узлы и уже существующие обрабатываются РАЗДЕЛЬНО, и это не
  // придирка: UPSERT в YDB требует перечислить все NOT NULL колонки (в features
  // это default_access, status, sensitive). Значит «просто обновить название
  // раздела» через UPSERT либо не пройдёт разбор типов, либо перезапишет
  // политику владельца значениями со страницы. Поэтому:
  //   • новый узел  → UPSERT с безопасными значениями по умолчанию (открыт);
  //   • известный   → UPDATE только описательных полей, а default_access,
  //                   status и sensitive трогаем ЛИШЬ если их прислали явно.
  const known = new Set();
  {
    const rs = await q1(drv, 'SELECT feature FROM features;', {});
    for(const r of rowsOf(rs)) known.add(txt(r.items[0]));
  }
  const fresh = rows.filter(r => !known.has(r.feature));
  const stale = rows.filter(r => known.has(r.feature));

  for(let i = 0; i < fresh.length; i += CATALOG_CHUNK){
    const part = fresh.slice(i, i + CATALOG_CHUNK);
    const decl = [], vals = [], params = {};
    part.forEach((r, k) => {
      decl.push(`DECLARE $f${k} AS Utf8; DECLARE $a${k} AS Utf8; DECLARE $p${k} AS Optional<Utf8>;`
        + ` DECLARE $t${k} AS Utf8; DECLARE $k${k} AS Utf8; DECLARE $d${k} AS Utf8;`
        + ` DECLARE $s${k} AS Utf8; DECLARE $x${k} AS Bool; DECLARE $q${k} AS Optional<Utf8>;`);
      vals.push(`($f${k}, $a${k}, $p${k}, $t${k}, $k${k}, $d${k}, $s${k}, $x${k}, $q${k}, CurrentUtcTimestamp())`);
      params['$f' + k] = TypedValues.utf8(r.feature);
      params['$a' + k] = TypedValues.utf8(r.area);
      params['$p' + k] = r.parent ? TypedValues.optional(TypedValues.utf8(r.parent)) : TypedValues.optionalNull(Types.UTF8);
      params['$t' + k] = TypedValues.utf8(r.title);
      params['$k' + k] = TypedValues.utf8(r.kind);
      // По умолчанию узел ОТКРЫТ и не считается чувствительным: механизм
      // выкатывается раньше политики и не имеет права что-либо закрыть сам.
      params['$d' + k] = TypedValues.utf8(r.defaultAccess || 'open');
      params['$s' + k] = TypedValues.utf8(r.status || 'live');
      params['$x' + k] = TypedValues.bool(r.sensitive === true);
      params['$q' + k] = r.declaredAt ? TypedValues.optional(TypedValues.utf8(r.declaredAt)) : TypedValues.optionalNull(Types.UTF8);
    });
    await q1(drv, decl.join('\n') + `
      UPSERT INTO features (feature, area, parent, title, kind, default_access, status, sensitive, declared_at, seen_at)
      VALUES ` + vals.join(',\n             ') + ';', params);
    upserted += part.length;
  }

  // Несколько UPDATE в одном запросе — чтобы не делать по обращению к БД на
  // каждый узел: 500 запросов в одном вызове функции упираются в её таймаут.
  for(let i = 0; i < stale.length; i += CATALOG_CHUNK){
    const part = stale.slice(i, i + CATALOG_CHUNK);
    const decl = [], stmts = [], params = {};
    part.forEach((r, k) => {
      decl.push(`DECLARE $f${k} AS Utf8; DECLARE $a${k} AS Utf8; DECLARE $p${k} AS Optional<Utf8>;`
        + ` DECLARE $t${k} AS Utf8; DECLARE $k${k} AS Utf8; DECLARE $q${k} AS Optional<Utf8>;`);
      const sets = [`area = $a${k}`, `parent = $p${k}`, `title = $t${k}`,
                    `kind = $k${k}`, `declared_at = $q${k}`, 'seen_at = CurrentUtcTimestamp()'];
      params['$f' + k] = TypedValues.utf8(r.feature);
      params['$a' + k] = TypedValues.utf8(r.area);
      params['$p' + k] = r.parent ? TypedValues.optional(TypedValues.utf8(r.parent)) : TypedValues.optionalNull(Types.UTF8);
      params['$t' + k] = TypedValues.utf8(r.title);
      params['$k' + k] = TypedValues.utf8(r.kind);
      params['$q' + k] = r.declaredAt ? TypedValues.optional(TypedValues.utf8(r.declaredAt)) : TypedValues.optionalNull(Types.UTF8);
      if(r.defaultAccess){ decl.push(`DECLARE $d${k} AS Utf8;`); sets.push(`default_access = $d${k}`); params['$d' + k] = TypedValues.utf8(r.defaultAccess); }
      if(r.status){ decl.push(`DECLARE $s${k} AS Utf8;`); sets.push(`status = $s${k}`); params['$s' + k] = TypedValues.utf8(r.status); }
      if(r.sensitive !== null && r.sensitive !== undefined){ decl.push(`DECLARE $x${k} AS Bool;`); sets.push(`sensitive = $x${k}`); params['$x' + k] = TypedValues.bool(r.sensitive === true); }
      stmts.push(`UPDATE features SET ${sets.join(', ')} WHERE feature = $f${k};`);
    });
    await q1(drv, decl.join('\n') + '\n' + stmts.join('\n'), params);
    upserted += part.length;
  }

  // Журнал одной записью: 500 строк в access_audit на каждую публикацию
  // каталога сделали бы журнал нечитаемым — а он нужен для разбора ЧУЖИХ
  // действий, а не для дифа контента.
  const audited = await audit(drv, {
    actor: ctx.actor, action, target: 'catalog', result: 'ok',
    reason: upserted + ' узлов, отклонено ' + rejected.length,
    payload: { upserted, rejected: rejected.slice(0, 40), sample: rows.slice(0, 20).map(r => r.feature) },
  });
  return ok({ ok:true, upserted, rejected, audited });
}

// ─── разбор скалярных полей ──────────────────────────────────────────
// Строго: !!granted превратил бы строку 'false' в true, то есть «закрыть»
// молча становилось бы «открыть».
function parseBool(v){
  if(typeof v === 'boolean') return v;
  if(v === 'true'  || v === 1 || v === '1') return true;
  if(v === 'false' || v === 0 || v === '0') return false;
  return null;
}

// expiresAt: ISO-строка или epoch-миллисекунды. Некорректную дату отвергаем,
// а не обнуляем: молча выданный бессрочный доступ вместо временного — худший
// исход из возможных.
function parseExpires(v){
  if(v == null || v === '') return { ok:true, date:null };
  const t = typeof v === 'number' ? v : Date.parse(String(v));
  if(!Number.isFinite(t)) return { ok:false, why:'expiresAt не разбирается как дата' };
  const now = Date.now();
  if(t <= now) return { ok:false, why:'expiresAt в прошлом' };
  if(t > now + 100 * 365 * 24 * 3600 * 1000) return { ok:false, why:'expiresAt слишком далеко в будущем' };
  return { ok:true, date: new Date(t) };
}

// resolveAccess нужен progress.js: он отдаёт клиенту роль и эффективные права
// вместе с прогрессом, чтобы витрина не делала второй запрос.
exports.resolveAccess = resolveAccess;
// verifyJWT/ownerKeysFor — для тех же соседних модулей, чтобы не расползались копии.
exports.verifyJWT = verifyJWT;
exports.ownerKeysFor = ownerKeysFor;
