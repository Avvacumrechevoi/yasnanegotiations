// ═══════════════════════════════════════════════════════════════════
// Yandex Cloud Function: GET /leaderboard?gameId=&yasnaId=&period=&limit=
// Возвращает топ-N с агрегацией: лучший результат игрока
// (по score desc → time asc → first match).
// ═══════════════════════════════════════════════════════════════════
// Env vars: YDB_ENDPOINT, YDB_DATABASE

const { Driver, getCredentialsFromEnv, TypedValues } = require('ydb-sdk');

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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

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
  if(event.httpMethod === 'OPTIONS') return { statusCode:200, headers: CORS, body:'' };

  const params = event.queryStringParameters || {};
  const gameId = String(params.gameId || '');
  const yasnaId = String(params.yasnaId || '');
  const period = String(params.period || 'all');
  const limit = Math.max(1, Math.min(100, parseInt(params.limit, 10) || 50));
  const myDeviceId = String(params.deviceId || '');

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
          MIN_BY(time_ms, score) AS best_time,
          MIN_BY(nickname, score) AS nickname,
          MIN_BY(avatar, score) AS avatar,
          MIN_BY(user_id, score) AS user_id,
          MIN_BY(device_id, score) AS device_id,
          MIN_BY(created_at, score) AS created_at
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
        return {
          rank: idx + 1,
          score: score != null ? score : null,
          time: time != null ? time : null,
          nickname: cols[3]?.textValue || 'аноним',
          avatar: cols[4]?.textValue || '🦊',
          user_id: cols[5]?.textValue || null,
          deviceId: cols[6]?.textValue || null,
        };
      });

      // myEntry — найти запись текущего пользователя
      if(myDeviceId){
        myEntry = items.find(r => r.deviceId === myDeviceId) || null;
        if(!myEntry){
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
              deviceId: myDeviceId,
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
