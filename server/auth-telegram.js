// ═══════════════════════════════════════════════════════════════════
// Yandex Cloud Function: POST /auth/telegram
// Принимает signed JSON от Telegram Login Widget, верифицирует HMAC,
// upsert user в YDB, link device, выдаёт JWT.
// ═══════════════════════════════════════════════════════════════════
// Env vars (задаются в YC Function settings):
//   BOT_TOKEN     — токен бота от @BotFather
//   JWT_SECRET    — длинная случайная строка (минимум 32 символа)
//   YDB_ENDPOINT  — например grpcs://ydb.serverless.yandexcloud.net:2135
//   YDB_DATABASE  — путь к базе вида /ru-central1/b1g.../etn...

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

function verifyTelegramAuth(data, botToken){
  const { hash, ...fields } = data;
  if(!hash) return false;
  const dataCheckString = Object.keys(fields)
    .filter(k => fields[k] !== null && fields[k] !== undefined && k !== 'device_id' && k !== 'local_nickname' && k !== 'local_avatar')
    .sort()
    .map(k => `${k}=${fields[k]}`)
    .join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return expected === hash;
}

function signJWT(payload, secret){
  const header = Buffer.from(JSON.stringify({alg:'HS256', typ:'JWT'})).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  let body;
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
  catch(_){ return { statusCode: 400, headers: CORS, body: JSON.stringify({error:'invalid json'}) }; }

  const { id, first_name, last_name, username, photo_url, auth_date, hash, device_id, local_nickname, local_avatar } = body || {};
  if(!id || !auth_date || !hash || !device_id){
    return { statusCode: 400, headers: CORS, body: JSON.stringify({error:'missing fields'}) };
  }

  // 1. Verify HMAC
  const ok = verifyTelegramAuth({ id, first_name, last_name, username, photo_url, auth_date, hash }, process.env.BOT_TOKEN);
  if(!ok) return { statusCode: 401, headers: CORS, body: JSON.stringify({error:'invalid signature'}) };

  // 2. Anti-replay (5 минут)
  if(Math.floor(Date.now()/1000) - parseInt(auth_date, 10) > 300){
    return { statusCode: 401, headers: CORS, body: JSON.stringify({error:'auth data too old'}) };
  }

  const drv = await getDriver();

  // 3. Find or create user
  let userId, nickname, avatar;
  await drv.tableClient.withSession(async (session) => {
    const found = await session.executeQuery(`
      DECLARE $tg_id AS Int64;
      SELECT user_id, nickname, avatar FROM users VIEW users_by_tg WHERE tg_user_id = $tg_id LIMIT 1;
    `, { '$tg_id': { type: { typeId: 'INT64' }, value: { int64Value: parseInt(id, 10) } } });
    const rows = found.resultSets[0]?.rows || [];
    if(rows.length){
      userId = rows[0].items[0].textValue;
      nickname = rows[0].items[1].textValue;
      avatar = rows[0].items[2]?.textValue || photo_url;
      // Update last_seen_at
      await session.executeQuery(`
        DECLARE $uid AS Utf8;
        UPDATE users SET last_seen_at = CurrentUtcTimestamp() WHERE user_id = $uid;
      `, { '$uid': { type: { typeId: 'UTF8' }, value: { textValue: userId } } });
    } else {
      // Create new
      userId = crypto.randomUUID();
      nickname = first_name || local_nickname || username || 'Игрок';
      avatar = photo_url || local_avatar || '🦊';
      await session.executeQuery(`
        DECLARE $uid AS Utf8;
        DECLARE $tg AS Int64;
        DECLARE $nick AS Utf8;
        DECLARE $av AS Utf8;
        UPSERT INTO users (user_id, tg_user_id, nickname, avatar, created_at, last_seen_at)
        VALUES ($uid, $tg, $nick, $av, CurrentUtcTimestamp(), CurrentUtcTimestamp());
      `, {
        '$uid': { type: { typeId: 'UTF8' }, value: { textValue: userId } },
        '$tg': { type: { typeId: 'INT64' }, value: { int64Value: parseInt(id, 10) } },
        '$nick': { type: { typeId: 'UTF8' }, value: { textValue: nickname } },
        '$av': { type: { typeId: 'UTF8' }, value: { textValue: avatar } },
      });
    }

    // 4. Link device
    await session.executeQuery(`
      DECLARE $dev AS Utf8;
      DECLARE $uid AS Utf8;
      UPSERT INTO device_links (device_id, user_id, linked_at)
      VALUES ($dev, $uid, CurrentUtcTimestamp());
    `, {
      '$dev': { type: { typeId: 'UTF8' }, value: { textValue: device_id } },
      '$uid': { type: { typeId: 'UTF8' }, value: { textValue: userId } },
    });

    // 5. Migrate prior anonymous matches (без user_id) → теперь с user_id
    await session.executeQuery(`
      DECLARE $dev AS Utf8;
      DECLARE $uid AS Utf8;
      UPDATE matches SET user_id = $uid WHERE device_id = $dev AND user_id IS NULL;
    `, {
      '$dev': { type: { typeId: 'UTF8' }, value: { textValue: device_id } },
      '$uid': { type: { typeId: 'UTF8' }, value: { textValue: userId } },
    });
  });

  // 6. Issue JWT (валиден 30 дней)
  const now = Math.floor(Date.now()/1000);
  const token = signJWT({
    sub: userId,
    nick: nickname,
    iat: now,
    exp: now + 30*24*3600,
  }, process.env.JWT_SECRET);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      token,
      user: { user_id: userId, nickname, avatar, tg_user_id: parseInt(id, 10) },
    }),
  };
};
