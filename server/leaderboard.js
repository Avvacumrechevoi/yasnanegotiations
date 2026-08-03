// ═══════════════════════════════════════════════════════════════════
// Yandex Cloud Function: GET /leaderboard?gameId=&yasnaId=&period=&limit=
// Возвращает топ-N с агрегацией: лучший результат игрока
// (по score desc → time asc → first match).
// ═══════════════════════════════════════════════════════════════════
// Env vars: YDB_ENDPOINT, YDB_DATABASE

const crypto = require('crypto');
const { Driver, getCredentialsFromEnv, TypedValues } = require('ydb-sdk');

// Тот же разбор токена, что в submit.js/progress.js — нужен, чтобы найти
// СВОЮ запись в топе у залогиненного игрока.
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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

// Те же списки, что в submit.js (см. подробный коммент там). Держать в двух
// функциях синхронно — известный минус: чтение лидерборда для gameId 'turnir'
// отвечало 400 'invalid filters', поэтому «Топ недели» и Хроника были пусты
// даже если бы записи доезжали. Env-расширение — чтобы новый режим не требовал
// правки кода в двух местах.
function validSet(envName, defaults){
  const extra = String(process.env[envName] || '').split(',').map(s => s.trim()).filter(Boolean);
  return new Set(defaults.concat(extra));
}
const VALID_GAMES = validSet('EXTRA_GAMES', [
  'turnir', 'group',
  'race-cross','race-mngmt','race-faith','quiz-antipodes','mirror-fill','speed-cross-yesno',
]);
const VALID_YASNAS = validSet('EXTRA_YASNAS', ['суток','года','фаз_жизни']);

function periodToFilter(period){
  if(period === 'daily'){
    const start = new Date(); start.setUTCHours(0,0,0,0);
    return `AND created_at >= Timestamp("${start.toISOString().slice(0,19)}Z")`;
  }
  if(period === 'weekly'){
    const start = new Date(); start.setUTCDate(start.getUTCDate() - 7); start.setUTCHours(0,0,0,0);
    return `AND created_at >= Timestamp("${start.toISOString().slice(0,19)}Z")`;
  }
  return '';
}

exports.handler = async (event) => {
  applyCors(event);
  if(event.httpMethod === 'OPTIONS') return { statusCode:200, headers: CORS, body:'' };

  const params = event.queryStringParameters || {};
  const gameId = String(params.gameId || '');
  const yasnaId = String(params.yasnaId || '');
  const period = String(params.period || 'all');
  const limit = Math.max(1, Math.min(100, parseInt(params.limit, 10) || 50));
  const myDeviceId = String(params.deviceId || '');
  // Опционально читаем токен: после входа через Telegram матчи пишутся с
  // user_id, и поиск «меня» только по device_id перестаёт находить свою же
  // запись — залогиненный не видел себя в топе.
  const myUserId = (() => {
    const auth = event.headers?.Authorization || event.headers?.authorization;
    if(!auth?.startsWith('Bearer ')) return null;
    const p = verifyJWT(auth.slice(7), process.env.JWT_SECRET);
    return p?.sub ? String(p.sub) : null;
  })();

  if(!VALID_GAMES.has(gameId) || !VALID_YASNAS.has(yasnaId)){
    return { statusCode: 400, headers: CORS, body: JSON.stringify({error:'invalid filters'}) };
  }

  const filter = periodToFilter(period);
  const drv = await getDriver();

  let items = [];
  let myEntry = null;
  let queryError = null;   // если запрос упал — отдаём 500, а не тихий пустой список

  await drv.tableClient.withSession(async (session) => {
    // Топ-N: для game_score-mode (Quiz/Mirror/Speed) — по score desc, при равенстве time asc.
    // Для race-mode (без score) — по time asc.
    // Делаем универсальный SELECT с ORDER BY: score DESC NULLS LAST, time_ms ASC.
    // Группировка по user_id (или device_id если user_id NULL) — берём BEST результат игрока.
    const query = `
      DECLARE $game AS Utf8;
      DECLARE $yasna AS Utf8;
      DECLARE $limit AS Uint64;

      $best_per_player = (
        SELECT
          -- player_key приходит из GROUP BY ... AS player_key (см. ниже).
          -- Повторять здесь COALESCE(user_id, device_id) нельзя: YQL считает
          -- user_id негруппированной колонкой и валит весь запрос
          -- (Column user_id must either be a key column in GROUP BY ...).
          player_key,
          MAX(score) AS best_score,
          -- MAX_BY, а не MIN_BY. Раньше лучший счёт брался как MAX(score), а
          -- время, ник, аватар и дата — из матча с МИНИМАЛЬНЫМ счётом, то есть
          -- строка в топе смешивала лучший результат игрока с подробностями его
          -- худшей партии: рядом с 10/10 могло стоять время из партии на 1/10.
          MAX_BY(time_ms, score) AS best_time,
          MAX_BY(nickname, score) AS nickname,
          MAX_BY(avatar, score) AS avatar,
          MAX_BY(user_id, score) AS user_id,
          MAX_BY(device_id, score) AS device_id,
          MAX_BY(created_at, score) AS created_at
        -- БЕЗ хинта VIEW matches_by_game: индекс покрывает только
        -- (game_id, yasna_id, created_at) + PK, а запросу нужны result, is_bot,
        -- score, time_ms, nickname, avatar, user_id, device_id. Чтение через
        -- некрывающий индекс не даёт этих колонок, и выборка молча возвращалась
        -- ПУСТОЙ (проверено: тот же WHERE по основной таблице даёт 3 строки).
        -- Таблица матчей небольшая; если понадобится — сделать индекс COVERING.
        FROM matches
        WHERE game_id = $game AND yasna_id = $yasna AND result = "win" AND is_bot = false ${filter}
        GROUP BY COALESCE(user_id, device_id) AS player_key
      );

      SELECT player_key, best_score, best_time, nickname, avatar, user_id, device_id, created_at
      FROM $best_per_player
      -- NULLS LAST УБРАН: YQL такого синтаксиса не знает и валил ВЕСЬ запрос
      -- («extraneous input 'NULLS' expecting {<EOF>, ';'}», код 400080). Ошибка
      -- глотался catch'ем ниже → HTTP 200 с пустым items, поэтому лидерборд
      -- выглядел «просто пустым» и баг жил незамеченным. В YQL NULL меньше любого
      -- значения, поэтому при DESC он и так оказывается в конце.
      ORDER BY best_score DESC, best_time ASC
      LIMIT $limit;
    `;

    const params = {
      // ВАЖНО: только TypedValues из ydb-sdk. Раньше параметры собирались
      // вручную — { type:{typeId:'UTF8'}, value:{textValue: …} } — и НЕ
      // биндились: typeId ожидает числовой enum, а не строку, поэтому фильтр
      // game_id/yasna_id не совпадал НИКОГДА и лидерборд всегда отдавал пустой
      // список, даже когда матчи в таблице есть (проверено диагностикой: 3 строки
      // turnir/суток/win при пустом ответе). Тот же грабли уже задокументированы
      // в submit.js — там от ручного формата ушли, здесь забыли.
      '$game':  TypedValues.utf8(String(gameId)),
      '$yasna': TypedValues.utf8(String(yasnaId)),
      '$limit': TypedValues.uint64(limit),
    };
    try {
      const r = await session.executeQuery(query, params);
      const rows = r.resultSets[0]?.rows || [];
      items = rows.map((row, idx) => {
        const cols = row.items;
        const score = cols[1]?.int32Value;
        const time = cols[2]?.int32Value;
        const uid = cols[5]?.textValue || null;
        const dev = cols[6]?.textValue || null;
        return {
          rank: idx + 1,
          score: score != null ? score : null,
          time: time != null ? time : null,
          nickname: cols[3]?.textValue || 'аноним',
          avatar: cols[4]?.textValue || '🦊',
          // user_id и deviceId наружу НЕ отдаём. Раньше отдавались — то есть
          // публичный эндпоинт без всякой авторизации выдавал идентификаторы
          // всех игроков топа. Пока /progress различал владельцев по одному
          // deviceId, этого хватало, чтобы прочитать и затереть чужой прогресс
          // (проверено на живом проде). Клиенту нужен только признак «это я»,
          // и вычислить его — дело сервера.
          isMe: (!!myDeviceId && dev === myDeviceId) || (!!myUserId && uid === myUserId),
          _uid: undefined, _dev: undefined,
        };
      });
      // сырые идентификаторы нужны только здесь, для поиска myEntry
      const rawIds = rows.map(r => ({ uid: r.items[5]?.textValue || null, dev: r.items[6]?.textValue || null }));

      // myEntry — найти запись текущего пользователя
      if(myDeviceId || myUserId){
        const myIdx = rawIds.findIndex(x =>
          (myDeviceId && x.dev === myDeviceId) || (myUserId && x.uid === myUserId));
        myEntry = myIdx >= 0 ? items[myIdx] : null;
        if(!myEntry && myDeviceId){
          // Не в топе — посмотреть отдельно
          const myQuery = `
            DECLARE $game AS Utf8;
            DECLARE $yasna AS Utf8;
            DECLARE $dev AS Utf8;
            SELECT MAX(score) AS best_score, MIN(time_ms) AS best_time, MAX(nickname) AS nickname, MAX(avatar) AS avatar
            FROM matches WHERE game_id = $game AND yasna_id = $yasna AND device_id = $dev AND result = "win" AND is_bot = false ${filter};
          `;
          const r2 = await session.executeQuery(myQuery, {
            // см. коммент выше — только TypedValues, иначе биндинг молча пустой
            '$game':  TypedValues.utf8(String(gameId)),
            '$yasna': TypedValues.utf8(String(yasnaId)),
            '$dev':   TypedValues.utf8(String(myDeviceId)),
          });
          const myRow = r2.resultSets[0]?.rows?.[0];
          if(myRow && myRow.items[0]?.int32Value !== undefined){
            myEntry = {
              rank: '?',
              score: myRow.items[0]?.int32Value,
              time: myRow.items[1]?.int32Value,
              nickname: myRow.items[2]?.textValue,
              avatar: myRow.items[3]?.textValue || '🦊',
              isMe: true,
            };
          }
        }
      }
    } catch(e){
      // РАНЬШЕ ошибка только логировалась, и наружу уходил HTTP 200 с пустым
      // items — из-за этого сломанный SQL (NULLS LAST) годами выглядел как
      // «лидерборд пока пустой». Отдаём 500: пусть падение будет видно.
      console.error('YDB query failed', e);
      queryError = String((e && e.message) || e);
    }
  });

  if(queryError){
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error:'db query failed', detail: queryError.slice(0, 300) }) };
  }
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ items, myEntry }) };
};
