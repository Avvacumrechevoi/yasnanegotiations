// ═══════════════════════════════════════════════════════════════════
// Yandex Cloud Function: POST /submit
// Принимает результат матча, валидирует, сохраняет в YDB.
// JWT в Authorization optional — для анонимов user_id остаётся NULL.
// ═══════════════════════════════════════════════════════════════════
// Env vars: JWT_SECRET, YDB_ENDPOINT, YDB_DATABASE

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

// CORS: разрешаем только свой домен (env ALLOW_ORIGIN), а не '*'.
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || 'https://avvacumrechevoi.github.io';
const CORS = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function verifyJWT(token, secret){
  if(!token) return null;
  const [h, b, s] = token.split('.');
  if(!h || !b || !s) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
  // Constant-time сравнение подписи — без утечки через timing (как в content-publish.js).
  const expBuf = Buffer.from(expected), sigBuf = Buffer.from(s);
  if(expBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expBuf, sigBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if(payload.exp && payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch(_){ return null; }
}

const VALID_GAMES = new Set(['race-cross','race-mngmt','race-faith','quiz-antipodes','mirror-fill','speed-cross-yesno']);
const VALID_YASNAS = new Set(['суток','года','фаз_жизни']);
const VALID_RESULTS = new Set(['win','loss']);
const VALID_TRANSPORTS = new Set(['peerjs','broadcast','bot','solo']);

exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode:200, headers: CORS, body:'' };

  let body;
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
  catch(_){ return { statusCode:400, headers:CORS, body: JSON.stringify({error:'invalid json'}) }; }

  // Опциональная JWT-аутентификация.
  // Для аутентифицированных берём ник/идентичность ИЗ ТОКЕНА, игнорируя
  // присланные в теле — иначе любой мог подставить чужой ник/user_id.
  let userId = null, authNick = null;
  const auth = event.headers?.Authorization || event.headers?.authorization;
  if(auth?.startsWith('Bearer ')){
    const payload = verifyJWT(auth.slice(7), process.env.JWT_SECRET);
    if(payload?.sub){ userId = payload.sub; if(payload.nick) authNick = String(payload.nick); }
  }

  // Валидация полей
  const { matchId, deviceId, nickname, avatar, gameId, yasnaId, result, score, maxScore, time, transport, isBot, bySurrender } = body || {};
  if(!matchId || !deviceId || !nickname || !gameId || !yasnaId || !result || time == null){
    return { statusCode:400, headers:CORS, body: JSON.stringify({error:'missing required fields'}) };
  }
  if(!VALID_GAMES.has(gameId)) return { statusCode:400, headers:CORS, body: JSON.stringify({error:'invalid gameId'}) };
  if(!VALID_YASNAS.has(yasnaId)) return { statusCode:400, headers:CORS, body: JSON.stringify({error:'invalid yasnaId'}) };
  if(!VALID_RESULTS.has(result)) return { statusCode:400, headers:CORS, body: JSON.stringify({error:'invalid result'}) };
  if(transport && !VALID_TRANSPORTS.has(transport)) return { statusCode:400, headers:CORS, body: JSON.stringify({error:'invalid transport'}) };

  // Anti-cheat: time >= 1s, score <= maxScore, max 10 минут.
  // Number.isFinite — иначе нечисловое time даёт NaN, проходит сравнения
  // (NaN<1000 и NaN>600000 оба false) и уходит в YDB как int32Value:NaN.
  const t = parseInt(time, 10);
  if(!Number.isFinite(t) || t < 1000 || t > 600000){
    return { statusCode:400, headers:CORS, body: JSON.stringify({error:'unrealistic time'}) };
  }
  if(score != null && !Number.isFinite(parseInt(score, 10))){
    return { statusCode:400, headers:CORS, body: JSON.stringify({error:'invalid score'}) };
  }
  if(maxScore != null && !Number.isFinite(parseInt(maxScore, 10))){
    return { statusCode:400, headers:CORS, body: JSON.stringify({error:'invalid maxScore'}) };
  }
  if(score != null && maxScore != null && parseInt(score,10) > parseInt(maxScore,10)){
    return { statusCode:400, headers:CORS, body: JSON.stringify({error:'score > maxScore'}) };
  }

  // IP hash для rate-limit (опционально)
  const ip = event.requestContext?.identity?.sourceIp || event.headers?.['X-Forwarded-For']?.split(',')[0]?.trim() || '';
  const ipHash = ip ? crypto.createHash('sha256').update(ip + (process.env.JWT_SECRET || '')).digest('hex').slice(0, 16) : '';

  const drv = await getDriver();
  try {
  await drv.tableClient.withSession(async (session) => {
    await session.executeQuery(`
      DECLARE $id AS Utf8;
      DECLARE $uid AS Optional<Utf8>;
      DECLARE $dev AS Utf8;
      DECLARE $nick AS Utf8;
      DECLARE $av AS Optional<Utf8>;
      DECLARE $game AS Utf8;
      DECLARE $yasna AS Utf8;
      DECLARE $res AS Utf8;
      DECLARE $score AS Optional<Int32>;
      DECLARE $max AS Optional<Int32>;
      DECLARE $time AS Int32;
      DECLARE $transport AS Optional<Utf8>;
      DECLARE $bot AS Bool;
      DECLARE $surr AS Bool;
      DECLARE $iph AS Optional<Utf8>;
      INSERT INTO matches (id, user_id, device_id, nickname, avatar, game_id, yasna_id, result, score, max_score, time_ms, transport, is_bot, by_surrender, ip_hash, created_at)
      VALUES ($id, $uid, $dev, $nick, $av, $game, $yasna, $res, $score, $max, $time, $transport, $bot, $surr, $iph, CurrentUtcTimestamp());
    `, {
      // ВАЖНО: типизированные значения строим через TypedValues/Types из ydb-sdk,
      // а не ручными protobuf-объектами. Ручной формат для Optional-полей
      // (optionalType+nullFlagValue) ломался: YDB отвечал «ImportTypeFromProto
      // unknown type id: 0» (BadRequest 400010) — INSERT никогда не проходил.
      '$id':   TypedValues.utf8(String(matchId)),
      '$uid':  userId ? TypedValues.optional(TypedValues.utf8(String(userId))) : TypedValues.optionalNull(Types.UTF8),
      '$dev':  TypedValues.utf8(String(deviceId)),
      '$nick': TypedValues.utf8(String(authNick || nickname).slice(0,40)),
      '$av':   avatar ? TypedValues.optional(TypedValues.utf8(String(avatar).slice(0,200))) : TypedValues.optionalNull(Types.UTF8),
      '$game': TypedValues.utf8(String(gameId)),
      '$yasna':TypedValues.utf8(String(yasnaId)),
      '$res':  TypedValues.utf8(String(result)),
      '$score':score != null ? TypedValues.optional(TypedValues.int32(parseInt(score,10))) : TypedValues.optionalNull(Types.INT32),
      '$max':  maxScore != null ? TypedValues.optional(TypedValues.int32(parseInt(maxScore,10))) : TypedValues.optionalNull(Types.INT32),
      '$time': TypedValues.int32(t),
      '$transport': transport ? TypedValues.optional(TypedValues.utf8(String(transport))) : TypedValues.optionalNull(Types.UTF8),
      '$bot':  TypedValues.bool(!!isBot),
      '$surr': TypedValues.bool(!!bySurrender),
      '$iph':  ipHash ? TypedValues.optional(TypedValues.utf8(String(ipHash))) : TypedValues.optionalNull(Types.UTF8),
    });
  });
  } catch(e){
    // INSERT с уже существующим matchId (PK) → дубль/повторная отправка.
    // Идемпотентно отвечаем 409, а не 500: один матч засчитывается один раз.
    const msg = String(e?.message || e);
    if(/PRECONDITION_FAILED|already exists|duplicate|constraint/i.test(msg)){
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ error:'duplicate matchId', userId }) };
    }
    console.error('[submit] YDB insert failed', msg);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error:'db error' }) };
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok:true, userId }) };
};
