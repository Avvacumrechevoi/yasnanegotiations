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
// TypedValues обязательны: ручной формат параметров ({type:{typeId:'UTF8'}, …})
// не биндится — typeId ожидает числовой enum, а не строку. В лидерборде это
// уже стоило пустого рейтинга при полной таблице матчей, а здесь ломает вход:
// подпись Telegram проверяется успешно, а на первом же обращении к БД функция
// падает и шлюз отдаёт 502. Проверено на живом проде (см. коммит).
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
   Один зашитый адрес отдавался в ответ независимо от того, кто спрашивает.
   Пока сайт жил только на github.io, это работало; при переезде на свой
   домен браузер начал бы резать все запросы. Список нужен именно списком:
   во время переезда оба адреса живые одновременно.
   ALLOW_ORIGIN переопределяется переменной окружения — адреса через запятую.
   Заголовок ставится на общий объект в начале обработчика: экземпляр функции
   обслуживает один запрос за раз. Vary: Origin обязателен, иначе кэш отдаст
   чужому домену ответ, выписанный для нашего. */
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

// ─── маршрутизация: эта функция обслуживает ещё и вход по почте с профилем ──
// Квота serverless.functions.count в облаке исчерпана (10 из 10), поэтому
// эндпоинты подсаживаются к существующим функциям. Вход по почте и профиль
// живут ЗДЕСЬ намеренно: это функция про идентичность, у неё уже есть
// JWT_SECRET, и рассылка писем (nodemailer) не тащится в submit, который
// вызывается на каждый матч. Неизвестный путь трактуется как вход через
// Telegram — поведение прода не меняется, даже если шлюз перестанет
// передавать path.
let emailModule = null;
function emailHandler(){
  if(!emailModule){ emailModule = require('./auth-email.js'); }
  return emailModule.handler;
}
function reqPath(event){
  return String(event?.path || event?.url ||
    event?.requestContext?.http?.path || event?.requestContext?.path || '');
}
function isEmailPath(event){
  const p = reqPath(event);
  return /\/auth\/email\//.test(p) || /\/account(\/|\?|$)/.test(p);
}

exports.handler = async (event) => {
  applyCors(event);
  if(isEmailPath(event)) return emailHandler()(event);

  if(event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  let body;
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
  catch(_){ return { statusCode: 400, headers: CORS, body: JSON.stringify({error:'invalid json'}) }; }

  const { id, first_name, last_name, username, photo_url, auth_date, hash, device_id, local_nickname, local_avatar } = body || {};
  // device_id НЕ обязателен. Раньше он требовался, и первый вход был невозможен
  // в принципе: deviceId создаётся только внутри уже существующего гостевого
  // профиля (duel.js, loadProfile), а новый посетитель жмёт «Войти» с welcome-
  // экрана, когда профиля ещё нет — уходило device_id: undefined, поле выпадало
  // из JSON, и сервер отвечал 400 при полностью валидной подписи Telegram.
  // Привязка устройства и перенос анонимных матчей — необязательные шаги,
  // выдача токена от них не зависит.
  if(!id || !auth_date || !hash){
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
    `, { '$tg_id': TypedValues.int64(parseInt(id, 10)) });
    const rows = found.resultSets[0]?.rows || [];
    if(rows.length){
      userId = rows[0].items[0].textValue;
      nickname = rows[0].items[1].textValue;
      avatar = rows[0].items[2]?.textValue || photo_url;
      // Update last_seen_at
      await session.executeQuery(`
        DECLARE $uid AS Utf8;
        UPDATE users SET last_seen_at = CurrentUtcTimestamp() WHERE user_id = $uid;
      `, { '$uid': TypedValues.utf8(userId) });
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
        '$uid':  TypedValues.utf8(userId),
        '$tg':   TypedValues.int64(parseInt(id, 10)),
        '$nick': TypedValues.utf8(String(nickname)),
        '$av':   TypedValues.utf8(String(avatar)),
      });
    }

    // 4-5. Привязка устройства и перенос анонимных матчей — ТОЛЬКО если клиент
    // прислал device_id. Оба шага не влияют на выдачу токена: вход обязан
    // работать и у того, кто пришёл впервые и никакого устройства ещё не имеет.
    if(device_id){
      const devStr = String(device_id).slice(0, 128);
      await session.executeQuery(`
        DECLARE $dev AS Utf8;
        DECLARE $uid AS Utf8;
        UPSERT INTO device_links (device_id, user_id, linked_at)
        VALUES ($dev, $uid, CurrentUtcTimestamp());
      `, {
        '$dev': TypedValues.utf8(devStr),
        '$uid': TypedValues.utf8(userId),
      });

      await session.executeQuery(`
        DECLARE $dev AS Utf8;
        DECLARE $uid AS Utf8;
        UPDATE matches SET user_id = $uid WHERE device_id = $dev AND user_id IS NULL;
      `, {
        '$dev': TypedValues.utf8(devStr),
        '$uid': TypedValues.utf8(userId),
      });
    }
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
