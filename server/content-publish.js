// ═══════════════════════════════════════════════════════════════════
// Yandex Cloud Function: POST /content/publish
//
// Публикует новую ревизию контентных overrides (Tier-2).
//
// Auth: header `Authorization: Bearer <ADMIN_PASSWORD>` (env var).
// Future: заменить на полноценный JWT/OAuth (см. ARCHITECTURE.md).
//
// Body:
//   {
//     data: { added: [...], edited: {...}, deleted: [...] },
//     publishedBy: "nickname",        // optional, default 'admin'
//     notes: "почему опубликовал"     // optional, для истории
//   }
//
// Семантика:
//   1. Валидация структуры data (added массив, edited объект, deleted массив)
//   2. Валидация каждого вопроса (тип, обязательные поля)
//   3. Транзакция YDB:
//      a) UPDATE content_revisions SET is_current=false WHERE is_current=true
//      b) INSERT новой строки с is_current=true
//   4. Возврат revisionId + dataHash
//
// Env vars: ADMIN_PASSWORD, YDB_ENDPOINT, YDB_DATABASE
// ═══════════════════════════════════════════════════════════════════

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
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

// Тот же разбор токена, что в progress.js/submit.js: HMAC-SHA256, подпись
// сравнивается constant-time, exp проверяется.
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

// Полномочие читается ИЗ БД по user_id из токена — ничего из тела запроса.
// Роль по умолчанию берётся из roles.is_default, поэтому «нет строки в
// user_roles» означает обычного пользователя, а не отказ в обслуживании.
async function hasCap(drv, userId, cap){
  let granted = false;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`
      DECLARE $u AS Utf8; DECLARE $c AS Utf8;
      $role = (
        SELECT COALESCE(
          (SELECT role_id FROM user_roles WHERE user_id = $u),
          (SELECT role_id FROM roles WHERE is_default = true LIMIT 1)
        ) AS role_id
      );
      SELECT g.granted AS granted
      FROM role_grants AS g
      WHERE g.role_id = (SELECT role_id FROM $role) AND g.feature = $c;`,
      { '$u': TypedValues.utf8(String(userId)), '$c': TypedValues.utf8(String(cap)) });
    const row = r.resultSets[0]?.rows?.[0];
    granted = !!(row && row.items[0]?.boolValue);
  });
  return granted;
}

// Журнал доступа: пишем и успехи, и ОТКАЗЫ. Без записи отказов украденный
// токен не виден вообще — успешные действия выглядят штатно.
async function audit(drv, entry){
  try {
    await drv.tableClient.withSession(async (s) => {
      await s.executeQuery(`
        DECLARE $id AS Utf8; DECLARE $a AS Utf8; DECLARE $act AS Utf8;
        DECLARE $t AS Optional<Utf8>; DECLARE $res AS Utf8;
        DECLARE $why AS Optional<Utf8>; DECLARE $p AS Optional<Utf8>;
        UPSERT INTO access_audit (id, at, actor, action, target, feature, result, reason, payload_json)
        VALUES ($id, CurrentUtcTimestamp(), $a, $act, $t, NULL, $res, $why, $p);`,
        {
          '$id':  TypedValues.utf8(crypto.randomUUID()),
          '$a':   TypedValues.utf8(String(entry.actor || 'anon')),
          '$act': TypedValues.utf8(String(entry.action)),
          '$t':   entry.target ? TypedValues.optional(TypedValues.utf8(String(entry.target))) : TypedValues.optionalNull(Types.UTF8),
          '$res': TypedValues.utf8(String(entry.result)),
          '$why': entry.reason ? TypedValues.optional(TypedValues.utf8(String(entry.reason).slice(0,400))) : TypedValues.optionalNull(Types.UTF8),
          '$p':   entry.payload ? TypedValues.optional(TypedValues.utf8(JSON.stringify(entry.payload).slice(0,4000))) : TypedValues.optionalNull(Types.UTF8),
        });
    });
  } catch(e){
    // Журнал не должен ронять публикацию, но молчать о его поломке нельзя.
    console.error('[content-publish] audit failed', e?.message || e);
  }
}

// ─── Валидация одного вопроса ────────────────────────────────────────
// Та же логика что во frontend isQuestionValid — дублируем для безопасности
// (никогда не доверяем клиенту).
const DISABLED_TYPES = new Set(['fill-blank', 'order']);
function isQuestionValid(q){
  if(!q || typeof q !== 'object') return false;
  if(!q.id || typeof q.id !== 'string') return false;
  if(!q.theme || typeof q.theme !== 'string') return false;
  const text = q.text || q.stem;
  if(!text || typeof text !== 'string' || text.length > 500) return false;
  const type = q.type || 'single-choice';
  if(DISABLED_TYPES.has(type)) return false;
  if(type === 'single-choice'){
    if(!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) return false;
    if(typeof q.correct !== 'number' || q.correct < 0 || q.correct >= q.options.length) return false;
    return true;
  }
  if(type === 'true-false'){
    return q.correct === 0 || q.correct === 1;
  }
  if(type === 'multi-choice'){
    if(!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8) return false;
    if(!Array.isArray(q.correct) || q.correct.length === 0) return false;
    return q.correct.every(i => typeof i === 'number' && i >= 0 && i < q.options.length);
  }
  if(type === 'match-pair'){
    if(!Array.isArray(q.pairsLeft) || !Array.isArray(q.pairsRight)) return false;
    if(q.pairsLeft.length !== q.pairsRight.length) return false;
    if(q.pairsLeft.length < 2 || q.pairsLeft.length > 6) return false;
    return true;
  }
  return false;
}

function validateOverrides(data){
  if(!data || typeof data !== 'object') return 'data must be an object';
  const { added, edited, deleted } = data;
  if(added != null && !Array.isArray(added)) return 'added must be array';
  if(edited != null && (typeof edited !== 'object' || Array.isArray(edited))) return 'edited must be object';
  if(deleted != null && !Array.isArray(deleted)) return 'deleted must be array';
  // Валидация каждого добавленного / изменённого вопроса
  for(const q of (added || [])){
    if(!isQuestionValid(q)) return 'invalid added question: ' + (q?.id || 'unknown');
  }
  for(const id in (edited || {})){
    if(!isQuestionValid({ id, ...edited[id] })) return 'invalid edited question: ' + id;
  }
  for(const id of (deleted || [])){
    if(typeof id !== 'string') return 'deleted must be array of string ids';
  }
  return null;
}

function newRevisionId(){
  // Простой UUID-подобный — достаточно для уникальности между ревизиями
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return 'rev-' + t + '-' + r;
}

exports.handler = async (event) => {
  applyCors(event);
  if(event.httpMethod === 'OPTIONS') return { statusCode:200, headers: CORS, body:'' };
  if(event.httpMethod !== 'POST'){
    return { statusCode:405, headers:CORS, body: JSON.stringify({error:'method not allowed'}) };
  }

  // ─── Auth ───────────────────────────────────────────────
  // ПОЧЕМУ ПЕРЕДЕЛАНО. Прежняя проверка была ровно одна: Bearer сверялся с
  // ОДНИМ общим ADMIN_PASSWORD. Последствия, проверенные по коду:
  //   • кто угодно, узнав пароль, перезаписывает вопросы всем игрокам;
  //   • автор ревизии брался из ТЕЛА запроса (publishedBy ниже) — то есть
  //     content_revisions.published_by подделывался, и «кто это сделал»
  //     установить было нельзя;
  //   • страница docs/admin.html при этом не закрыта вообще (монтируется без
  //     проверки), пароль спрашивался только в модалке публикации.
  // Теперь основной путь — личный JWT с полномочием cap:content.publish,
  // роль читается из БД, автор берётся из токена.
  //
  // Пароль ОСТАВЛЕН аварийным входом: он же единственный способ опубликовать,
  // если токен потерян или роль случайно снята с самого себя. Каждое такое
  // использование пишется в журнал как emergency — молчаливого чёрного хода
  // быть не должно.
  const auth = event.headers?.Authorization || event.headers?.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if(!bearer){
    return { statusCode:401, headers:CORS, body: JSON.stringify({error:'unauthorized'}) };
  }

  let actorUserId = null, actorNick = null, viaEmergency = false;
  const payload = verifyJWT(bearer, process.env.JWT_SECRET);
  if(payload?.sub){
    actorUserId = String(payload.sub);
    actorNick = payload.nick ? String(payload.nick) : null;
  } else {
    // не токен — сверяем с аварийным паролем
    const expected = process.env.ADMIN_PASSWORD || '';
    const a = Buffer.from(bearer), b = Buffer.from(expected);
    if(!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)){
      return { statusCode:401, headers:CORS, body: JSON.stringify({error:'unauthorized'}) };
    }
    viaEmergency = true;
    console.warn('[content-publish] публикация аварийным паролем');
  }

  // ─── Body parsing ───────────────────────────────────────
  let body;
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
  catch(_){ return { statusCode:400, headers:CORS, body: JSON.stringify({error:'invalid json'}) }; }

  const { data, publishedBy, notes } = body || {};
  const error = validateOverrides(data);
  if(error){
    return { statusCode:400, headers:CORS, body: JSON.stringify({ error }) };
  }

  // Лимит на размер JSON — защита от DoS
  const dataJson = JSON.stringify(data);
  if(dataJson.length > 5 * 1024 * 1024){  // 5 MB
    return { statusCode:413, headers:CORS, body: JSON.stringify({error:'data too large (max 5MB)'}) };
  }

  const revisionId = newRevisionId();
  const dataHash = crypto.createHash('sha256').update(dataJson).digest('hex');
  // published_by уходит в ПУБЛИЧНЫЙ ответ GET /content, поэтому туда кладём
  // отображаемое имя из токена, а не идентификатор аккаунта: иначе публичный
  // эндпоинт начал бы раздавать user_id админов. Настоящий user_id пишется в
  // access_audit — он не публичный, и именно он отвечает на вопрос «кто это
  // сделал». Присланный клиентом publishedBy игнорируется полностью: раньше
  // именно из него бралось авторство, то есть подпись подделывалась.
  const publishedByStr = viaEmergency
    ? 'аварийный доступ'
    : (actorNick || 'админ').toString().slice(0, 80);
  const notesStr = (notes || '').toString().slice(0, 500);
  const actorKey = actorUserId ? ('usr:' + actorUserId) : 'emergency:password';

  try {
    const drv = await getDriver();

    // Полномочие проверяем ПОСЛЕ подключения к БД и ДО записи.
    if(!viaEmergency){
      const allowed = await hasCap(drv, actorUserId, 'cap:content.publish');
      if(!allowed){
        await audit(drv, {
          actor: actorKey, action: 'content.publish', target: revisionId,
          result: 'denied', reason: 'нет полномочия cap:content.publish',
        });
        return { statusCode:403, headers:CORS, body: JSON.stringify({
          error:'forbidden', detail:'нет полномочия на публикацию контента' }) };
      }
    }
    await drv.tableClient.withSession(async (session) => {
      // Атомарно: помечаем все is_current=false, потом INSERT новой
      // YDB поддерживает транзакции через executeQuery с явным commit
      await session.executeQuery(`
        DECLARE $rev AS Utf8;
        DECLARE $data AS Utf8;
        DECLARE $hash AS Utf8;
        DECLARE $by AS Optional<Utf8>;
        DECLARE $notes AS Optional<Utf8>;
        UPDATE content_revisions SET is_current = false WHERE is_current = true;
        INSERT INTO content_revisions
          (revision_id, data_json, data_hash, published_by, published_at, is_current, notes)
        VALUES
          ($rev, $data, $hash, $by, CurrentUtcTimestamp(), true, $notes);
      `, {
        // Только TypedValues. Ручной формат ({type:{typeId:'UTF8'}}) не биндится:
        // typeId ожидает числовой enum, а не строку. А для Optional-полей
        // вариант optionalType+nullFlagValue вообще валил запрос с
        // «ImportTypeFromProto unknown type id: 0» — на этих же граблях в
        // submit.js INSERT не проходил никогда. Публикация контента шла тем же
        // путём, поэтому её тоже переводим на TypedValues.
        '$rev':   TypedValues.utf8(revisionId),
        '$data':  TypedValues.utf8(dataJson),
        '$hash':  TypedValues.utf8(dataHash),
        '$by':    publishedByStr
                  ? TypedValues.optional(TypedValues.utf8(publishedByStr))
                  : TypedValues.optionalNull(Types.UTF8),
        '$notes': notesStr
                  ? TypedValues.optional(TypedValues.utf8(notesStr))
                  : TypedValues.optionalNull(Types.UTF8),
      });
    });

    // След в журнале — кто именно опубликовал. Здесь настоящий user_id,
    // в отличие от публичного published_by.
    await audit(drv, {
      actor: actorKey, action: 'content.publish', target: revisionId,
      result: 'ok', reason: viaEmergency ? 'аварийный пароль' : null,
      payload: { revisionId, dataHash, size: dataJson.length, notes: notesStr || null },
    });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        revisionId,
        dataHash,
        publishedAt: new Date().toISOString(),
        publishedBy: publishedByStr,
        size: dataJson.length,
        viaEmergency,
      }),
    };
  } catch(err){
    console.error('[content-publish]', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error:'publish failed', details: String(err.message || err) }),
    };
  }
};
