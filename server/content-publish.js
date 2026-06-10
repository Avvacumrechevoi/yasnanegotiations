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
const { Driver, getCredentialsFromEnv } = require('ydb-sdk');

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

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
  if(event.httpMethod === 'OPTIONS') return { statusCode:200, headers: CORS, body:'' };
  if(event.httpMethod !== 'POST'){
    return { statusCode:405, headers:CORS, body: JSON.stringify({error:'method not allowed'}) };
  }

  // ─── Auth ───────────────────────────────────────────────
  const auth = event.headers?.Authorization || event.headers?.authorization || '';
  const expected = process.env.ADMIN_PASSWORD || '';
  if(!expected){
    console.error('[content-publish] ADMIN_PASSWORD not configured');
    return { statusCode:500, headers:CORS, body: JSON.stringify({error:'server misconfigured'}) };
  }
  const provided = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  // Constant-time compare чтобы не leak'ать длину пароля через timing
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if(a.length !== b.length || !crypto.timingSafeEqual(a, b)){
    return { statusCode:401, headers:CORS, body: JSON.stringify({error:'unauthorized'}) };
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
  const publishedByStr = (publishedBy || 'admin').toString().slice(0, 80);
  const notesStr = (notes || '').toString().slice(0, 500);

  try {
    const drv = await getDriver();
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
        '$rev':   { type:{typeId:'UTF8'}, value:{textValue: revisionId} },
        '$data':  { type:{typeId:'UTF8'}, value:{textValue: dataJson} },
        '$hash':  { type:{typeId:'UTF8'}, value:{textValue: dataHash} },
        '$by':    publishedByStr
                  ? { type:{optionalType:{item:{typeId:'UTF8'}}}, value:{textValue: publishedByStr} }
                  : { type:{optionalType:{item:{typeId:'UTF8'}}}, value:{nullFlagValue:0} },
        '$notes': notesStr
                  ? { type:{optionalType:{item:{typeId:'UTF8'}}}, value:{textValue: notesStr} }
                  : { type:{optionalType:{item:{typeId:'UTF8'}}}, value:{nullFlagValue:0} },
      });
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
