// ═══════════════════════════════════════════════════════════════════
// Yandex Cloud Function: POST /submit
// Принимает результат матча, валидирует, сохраняет в YDB.
// JWT в Authorization optional — для анонимов user_id остаётся NULL.
// ═══════════════════════════════════════════════════════════════════
// Env vars: JWT_SECRET, YDB_ENDPOINT, YDB_DATABASE

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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function verifyJWT(token, secret){
  if(!token) return null;
  const [h, b, s] = token.split('.');
  if(!h || !b || !s) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
  if(expected !== s) return null;
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

  // Опциональная JWT-аутентификация
  let userId = null;
  const auth = event.headers?.Authorization || event.headers?.authorization;
  if(auth?.startsWith('Bearer ')){
    const payload = verifyJWT(auth.slice(7), process.env.JWT_SECRET);
    if(payload?.sub) userId = payload.sub;
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

  // Anti-cheat: time >= 1s, score <= maxScore, max 10 минут
  const t = parseInt(time, 10);
  if(t < 1000 || t > 600000){
    return { statusCode:400, headers:CORS, body: JSON.stringify({error:'unrealistic time'}) };
  }
  if(score != null && maxScore != null && score > maxScore){
    return { statusCode:400, headers:CORS, body: JSON.stringify({error:'score > maxScore'}) };
  }

  // IP hash для rate-limit (опционально)
  const ip = event.requestContext?.identity?.sourceIp || event.headers?.['X-Forwarded-For']?.split(',')[0]?.trim() || '';
  const ipHash = ip ? crypto.createHash('sha256').update(ip + (process.env.JWT_SECRET || '')).digest('hex').slice(0, 16) : '';

  const drv = await getDriver();
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
      '$id':   { type: {typeId:'UTF8'}, value: {textValue: String(matchId)} },
      '$uid':  userId ? { type: {optionalType:{item:{typeId:'UTF8'}}}, value:{textValue: userId} } : { type: {optionalType:{item:{typeId:'UTF8'}}}, value:{nullFlagValue:0} },
      '$dev':  { type: {typeId:'UTF8'}, value:{textValue: String(deviceId)} },
      '$nick': { type: {typeId:'UTF8'}, value:{textValue: String(nickname).slice(0,40)} },
      '$av':   avatar ? { type: {optionalType:{item:{typeId:'UTF8'}}}, value:{textValue: String(avatar).slice(0,200)} } : { type: {optionalType:{item:{typeId:'UTF8'}}}, value:{nullFlagValue:0} },
      '$game': { type: {typeId:'UTF8'}, value:{textValue: String(gameId)} },
      '$yasna':{ type: {typeId:'UTF8'}, value:{textValue: String(yasnaId)} },
      '$res':  { type: {typeId:'UTF8'}, value:{textValue: String(result)} },
      '$score':score != null ? { type:{optionalType:{item:{typeId:'INT32'}}}, value:{int32Value: parseInt(score,10)} } : { type:{optionalType:{item:{typeId:'INT32'}}}, value:{nullFlagValue:0} },
      '$max':  maxScore != null ? { type:{optionalType:{item:{typeId:'INT32'}}}, value:{int32Value: parseInt(maxScore,10)} } : { type:{optionalType:{item:{typeId:'INT32'}}}, value:{nullFlagValue:0} },
      '$time': { type: {typeId:'INT32'}, value:{int32Value: t} },
      '$transport': transport ? { type:{optionalType:{item:{typeId:'UTF8'}}}, value:{textValue: transport} } : { type:{optionalType:{item:{typeId:'UTF8'}}}, value:{nullFlagValue:0} },
      '$bot':  { type: {typeId:'BOOL'}, value:{boolValue: !!isBot} },
      '$surr': { type: {typeId:'BOOL'}, value:{boolValue: !!bySurrender} },
      '$iph':  ipHash ? { type:{optionalType:{item:{typeId:'UTF8'}}}, value:{textValue: ipHash} } : { type:{optionalType:{item:{typeId:'UTF8'}}}, value:{nullFlagValue:0} },
    });
  });

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok:true, userId }) };
};
