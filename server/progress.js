// ═══════════════════════════════════════════════════════════════════
// Yandex Cloud Function: /progress — учебный прогресс на сервере.
//
//   GET  /progress?deviceId=…   → всё, что сервер знает про владельца
//   PUT  /progress              → залить пачку изменений (идемпотентно)
//
// ЗАЧЕМ. До этого прогресс жил ТОЛЬКО в localStorage (44 ключа, реестр в
// docs/core/storage.js): пройденные уроки, курс, достижения, тренажёры,
// заметки и собственные Ясны. Очистка кэша или другой браузер = потеря всего,
// а «мой прогресс на телефоне и на ноутбуке» был невозможен в принципе.
//
// КЛЮЧ ВЛАДЕЛЬЦА (owner_key). user_id, если пришёл валидный JWT, иначе
// deviceId. Гостевой вход — важный сценарий продукта, ломать его нельзя:
// гость играет и его прогресс уже хранится на сервере, а при первом входе
// через Telegram прогресс устройства ПЕРЕНОСИТСЯ на аккаунт (claim ниже).
//
// РАЗРЕШЕНИЕ КОНФЛИКТОВ. Хранить учебный прогресс как единый JSON на ключ и
// сливать его по полям — значит придумывать правила слияния для каждого
// раздела и переписывать их с каждым новым тренажёром. Поэтому: одна строка
// на ключ, last-write-wins с проверкой rev. Клиент присылает rev, который он
// последним видел; если на сервере уже больше — это конфликт: сервер НЕ
// перезаписывает свою версию и возвращает её клиенту. Клиент принимает
// серверную и складывает свою в локальный «карман» конфликтов, чтобы
// ничего не пропало молча.
// ═══════════════════════════════════════════════════════════════════
// Env: YDB_ENDPOINT, YDB_DATABASE, JWT_SECRET, ALLOW_ORIGIN

const crypto = require('crypto');
const { Driver, getCredentialsFromEnv, TypedValues, Types } = require('ydb-sdk');

let driver = null;
async function getDriver(){
  if(driver) return driver;
  driver = new Driver({
    endpoint: process.env.YDB_ENDPOINT,
    database: process.env.YDB_DATABASE,
    authService: getCredentialsFromEnv(),
  });
  if(!await driver.ready(10000)) throw new Error('YDB not ready');
  return driver;
}

const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || 'https://avvacumrechevoi.github.io';
const CORS = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Тот же разбор токена, что в submit.js/content-publish.js.
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

// Границы. Эндпоинт публичный, поэтому размер входа ограничен явно, а не
// «сколько влезет»: иначе одним запросом можно набить базу мусором.
const MAX_ITEMS  = 300;
const MAX_NOTES  = 300;
const MAX_STATE  = 32 * 1024;   // на одно значение
const MAX_NOTE   = 16 * 1024;
const MAX_ID     = 128;
// Разрешённые scope: только то, что реально синхронизируется. prefs/cache/secret
// на сервер не уезжают (тема и черновики админки там не нужны, ключи LLM — тем
// более), см. scope в реестре docs/core/storage.js.
const VALID_SCOPES = new Set(['progress','creation','lesson','course','trainer','achievement','stat']);

const ok   = (obj) => ({ statusCode:200, headers:CORS, body: JSON.stringify(obj) });
const fail = (code, error, extra) => ({ statusCode:code, headers:CORS, body: JSON.stringify(Object.assign({error}, extra||{})) });

const txt  = (v) => (v == null ? null : v.textValue ?? null);
const num  = (v) => { const x = v?.uint64Value ?? v?.uint32Value ?? v?.int64Value ?? v?.int32Value; return x == null ? null : Number(String(x)); };
// Timestamp в YDB — микросекунды от эпохи.
const ts   = (v) => { const x = v?.uint64Value ?? v?.int64Value; return x == null ? null : new Date(Number(String(x))/1000).toISOString(); };

exports.handler = async (event) => {
  const method = String(event.httpMethod || 'GET').toUpperCase();
  if(method === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' };

  let body = {};
  if(event.body){
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
    catch(_){ return fail(400, 'invalid json'); }
  }
  const query = event.queryStringParameters || {};

  // Идентичность. Ник/идентификатор берём ИЗ ТОКЕНА, а не из тела — иначе
  // любой может назваться чужим user_id и читать чужой прогресс.
  const auth = event.headers?.Authorization || event.headers?.authorization;
  const payload = auth?.startsWith('Bearer ') ? verifyJWT(auth.slice(7), process.env.JWT_SECRET) : null;
  const userId = payload?.sub ? String(payload.sub) : null;

  const deviceId = String(query.deviceId || body.deviceId || '').slice(0, MAX_ID);
  if(!userId && !deviceId) return fail(400, 'deviceId required');
  const ownerKey = userId || deviceId;

  let drv;
  try { drv = await getDriver(); }
  catch(e){ console.error('[progress] YDB unavailable', e); return fail(503, 'db unavailable'); }

  try {
    if(method === 'GET')  return await handleGet(drv, { ownerKey, userId, deviceId });
    if(method === 'PUT' || method === 'POST') return await handlePut(drv, { ownerKey, userId, deviceId, body });
    return fail(405, 'method not allowed');
  } catch(e){
    // Наружу — 500, чтобы падение было видно, а не выглядело «просто пусто»
    // (именно так годами прятался сломанный SQL в лидерборде).
    console.error('[progress] failed', e);
    return fail(500, 'db error', { detail: String(e?.message || e).slice(0, 300) });
  }
};

// ─── чтение ──────────────────────────────────────────────────────────
async function handleGet(drv, { ownerKey, userId, deviceId }){
  if(userId && deviceId) await claimDeviceProgress(drv, userId, deviceId);

  const out = { ownerKey, isUser: !!userId, items: [], notes: [], entitlements: [] };
  await drv.tableClient.withSession(async (s) => {
    const p = { '$o': TypedValues.utf8(ownerKey) };
    const r = await s.executeQuery(`DECLARE $o AS Utf8;
      SELECT scope, item_id, state_json, rev, updated_at FROM progress WHERE owner_key = $o;`, p);
    out.items = (r.resultSets[0]?.rows || []).map(row => ({
      scope: txt(row.items[0]), itemId: txt(row.items[1]), state: txt(row.items[2]),
      rev: num(row.items[3]), updatedAt: ts(row.items[4]),
    }));

    const rn = await s.executeQuery(`DECLARE $o AS Utf8;
      SELECT item_id, text, updated_at FROM user_notes WHERE owner_key = $o;`, p);
    out.notes = (rn.resultSets[0]?.rows || []).map(row => ({
      itemId: txt(row.items[0]), text: txt(row.items[1]), updatedAt: ts(row.items[2]),
    }));

    const re = await s.executeQuery(`DECLARE $o AS Utf8;
      SELECT feature, granted, source, expires_at FROM entitlements WHERE owner_key = $o;`, p);
    out.entitlements = (re.resultSets[0]?.rows || []).map(row => ({
      feature: txt(row.items[0]), granted: !!row.items[1]?.boolValue,
      source: txt(row.items[2]), expiresAt: ts(row.items[3]),
    }));
  });
  await logSync(drv, ownerKey, deviceId, 'pull', out.items.length);
  return ok(out);
}

// ─── запись ──────────────────────────────────────────────────────────
async function handlePut(drv, { ownerKey, userId, deviceId, body }){
  const items = Array.isArray(body.items) ? body.items : [];
  const notes = Array.isArray(body.notes) ? body.notes : [];
  if(items.length > MAX_ITEMS) return fail(413, 'too many items', { max: MAX_ITEMS });
  if(notes.length > MAX_NOTES) return fail(413, 'too many notes', { max: MAX_NOTES });
  if(userId && deviceId) await claimDeviceProgress(drv, userId, deviceId);

  const conflicts = [], revs = {}, rejected = [];
  let saved = 0, notesSaved = 0;

  await drv.tableClient.withSession(async (s) => {
    // Текущие rev — одним запросом, чтобы не читать по строке на каждый ключ.
    const cur = new Map();
    const r = await s.executeQuery(`DECLARE $o AS Utf8;
      SELECT scope, item_id, rev, state_json FROM progress WHERE owner_key = $o;`,
      { '$o': TypedValues.utf8(ownerKey) });
    for(const row of (r.resultSets[0]?.rows || [])){
      cur.set(txt(row.items[0]) + ' ' + txt(row.items[1]),
              { rev: num(row.items[2]) || 0, state: txt(row.items[3]) });
    }

    for(const it of items){
      const scope  = String(it?.scope || '').slice(0, 64);
      const itemId = String(it?.itemId ?? it?.item_id ?? '').slice(0, MAX_ID);
      const state  = it?.state == null ? null : (typeof it.state === 'string' ? it.state : JSON.stringify(it.state));
      if(!scope || !itemId || state == null){ rejected.push({ scope, itemId, why:'missing fields' }); continue; }
      if(!VALID_SCOPES.has(scope)){ rejected.push({ scope, itemId, why:'scope not synced' }); continue; }
      if(state.length > MAX_STATE){ rejected.push({ scope, itemId, why:'state too large' }); continue; }

      const key = scope + ' ' + itemId;
      const existing = cur.get(key);
      const sentRev = Number.isFinite(+it?.rev) ? Math.max(0, parseInt(it.rev, 10)) : null;

      // Конфликт: на сервере версия новее той, которую видел клиент.
      // sentRev === null трактуем как «клиент не знает про версию» — это
      // импорт/первая заливка, тогда серверную версию не трогаем, если она есть.
      if(existing && (sentRev === null || existing.rev > sentRev)){
        if(existing.state !== state){
          conflicts.push({ scope, itemId, rev: existing.rev, state: existing.state });
          revs[scope + '/' + itemId] = existing.rev;
          continue;
        }
        revs[scope + '/' + itemId] = existing.rev;
        continue;
      }

      const newRev = (existing?.rev || 0) + 1;
      await s.executeQuery(`
        DECLARE $o AS Utf8; DECLARE $s AS Utf8; DECLARE $i AS Utf8;
        DECLARE $j AS Utf8; DECLARE $r AS Uint64; DECLARE $d AS Optional<Utf8>;
        UPSERT INTO progress (owner_key, scope, item_id, state_json, rev, updated_at, device_id)
        VALUES ($o, $s, $i, $j, $r, CurrentUtcTimestamp(), $d);`,
        {
          '$o': TypedValues.utf8(ownerKey),
          '$s': TypedValues.utf8(scope),
          '$i': TypedValues.utf8(itemId),
          '$j': TypedValues.utf8(state),
          '$r': TypedValues.uint64(newRev),
          '$d': deviceId ? TypedValues.optional(TypedValues.utf8(deviceId)) : TypedValues.optionalNull(Types.UTF8),
        });
      revs[scope + '/' + itemId] = newRev;
      saved++;
    }

    // Заметки к урокам — отдельная таблица, версий не держим: текст пишет
    // сам человек, последняя правка и есть верная.
    for(const n of notes){
      const itemId = String(n?.itemId ?? n?.item_id ?? '').slice(0, MAX_ID);
      const text = n?.text == null ? null : String(n.text);
      if(!itemId || text == null){ continue; }
      if(text.length > MAX_NOTE){ rejected.push({ itemId, why:'note too large' }); continue; }
      await s.executeQuery(`
        DECLARE $o AS Utf8; DECLARE $i AS Utf8; DECLARE $t AS Utf8;
        UPSERT INTO user_notes (owner_key, item_id, text, updated_at)
        VALUES ($o, $i, $t, CurrentUtcTimestamp());`,
        { '$o': TypedValues.utf8(ownerKey), '$i': TypedValues.utf8(itemId), '$t': TypedValues.utf8(text) });
      notesSaved++;
    }
  });

  await logSync(drv, ownerKey, deviceId, 'push', saved + notesSaved);
  return ok({ ownerKey, isUser: !!userId, saved, notesSaved, revs, conflicts, rejected });
}

// ─── перенос гостевого прогресса на аккаунт ──────────────────────────
// Гость играл под deviceId, потом вошёл через Telegram. Строки устройства
// копируем на user_id ТОЛЬКО там, где у аккаунта ещё ничего нет — иначе
// вход с нового устройства затирал бы накопленное в аккаунте. Строки
// устройства не удаляем: они безвредны и остаются страховкой.
// Разницу считаем в коде, а не одним запросом: коррелированный NOT EXISTS
// со ссылкой на внешний алиас YQL не поддерживает («Column d is not in source
// column set»), а LEFT ONLY JOIN здесь пришлось бы сочетать с чтением и
// записью одной и той же таблицы в одной транзакции. Строк единицы-десятки,
// так что явный проход понятнее и надёжнее любой хитрой конструкции.
async function claimDeviceProgress(drv, userId, deviceId){
  if(!userId || !deviceId || userId === deviceId) return;
  await drv.tableClient.withSession(async (s) => {
    const read = async (sql, key) => {
      const r = await s.executeQuery(sql, { '$o': TypedValues.utf8(key) });
      return r.resultSets[0]?.rows || [];
    };
    const Q_PROG = `DECLARE $o AS Utf8;
      SELECT scope, item_id, state_json, rev FROM progress WHERE owner_key = $o;`;
    const Q_NOTE = `DECLARE $o AS Utf8;
      SELECT item_id, text FROM user_notes WHERE owner_key = $o;`;

    const mine = new Set((await read(Q_PROG, userId)).map(r => txt(r.items[0]) + ' ' + txt(r.items[1])));
    for(const row of await read(Q_PROG, deviceId)){
      const scope = txt(row.items[0]), itemId = txt(row.items[1]);
      if(mine.has(scope + ' ' + itemId)) continue;   // у аккаунта уже своё — не трогаем
      await s.executeQuery(`
        DECLARE $o AS Utf8; DECLARE $s AS Utf8; DECLARE $i AS Utf8;
        DECLARE $j AS Utf8; DECLARE $r AS Uint64; DECLARE $d AS Optional<Utf8>;
        UPSERT INTO progress (owner_key, scope, item_id, state_json, rev, updated_at, device_id)
        VALUES ($o, $s, $i, $j, $r, CurrentUtcTimestamp(), $d);`,
        {
          '$o': TypedValues.utf8(userId),
          '$s': TypedValues.utf8(scope),
          '$i': TypedValues.utf8(itemId),
          '$j': TypedValues.utf8(txt(row.items[2]) || ''),
          '$r': TypedValues.uint64(num(row.items[3]) || 1),
          '$d': TypedValues.optional(TypedValues.utf8(deviceId)),
        });
    }

    const myNotes = new Set((await read(Q_NOTE, userId)).map(r => txt(r.items[0])));
    for(const row of await read(Q_NOTE, deviceId)){
      const itemId = txt(row.items[0]);
      if(myNotes.has(itemId)) continue;
      await s.executeQuery(`
        DECLARE $o AS Utf8; DECLARE $i AS Utf8; DECLARE $t AS Utf8;
        UPSERT INTO user_notes (owner_key, item_id, text, updated_at)
        VALUES ($o, $i, $t, CurrentUtcTimestamp());`,
        {
          '$o': TypedValues.utf8(userId),
          '$i': TypedValues.utf8(itemId),
          '$t': TypedValues.utf8(txt(row.items[1]) || ''),
        });
    }
  });
}

// Журнал синхронизаций: без него спор «прогресс пропал» неразрешим.
async function logSync(drv, ownerKey, deviceId, action, items){
  try {
    await drv.tableClient.withSession(async (s) => {
      await s.executeQuery(`
        DECLARE $id AS Utf8; DECLARE $o AS Utf8; DECLARE $d AS Optional<Utf8>;
        DECLARE $a AS Utf8; DECLARE $n AS Optional<Uint32>;
        UPSERT INTO progress_sync_log (id, owner_key, device_id, action, items, created_at)
        VALUES ($id, $o, $d, $a, $n, CurrentUtcTimestamp());`,
        {
          '$id': TypedValues.utf8(crypto.randomUUID()),
          '$o':  TypedValues.utf8(ownerKey),
          '$d':  deviceId ? TypedValues.optional(TypedValues.utf8(deviceId)) : TypedValues.optionalNull(Types.UTF8),
          '$a':  TypedValues.utf8(action),
          '$n':  TypedValues.optional(TypedValues.uint32(Math.max(0, items|0))),
        });
    });
  } catch(e){
    // Журнал не должен ломать синхронизацию — логируем и идём дальше.
    console.error('[progress] sync log failed', e?.message || e);
  }
}
