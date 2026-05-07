// ═══════════════════════════════════════════════════════════════════
// Yandex Cloud Function: GET /leaderboard?gameId=&yasnaId=&period=&limit=
// Возвращает топ-N с агрегацией: лучший результат игрока
// (по score desc → time asc → first match).
// ═══════════════════════════════════════════════════════════════════
// Env vars: YDB_ENDPOINT, YDB_DATABASE

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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const VALID_GAMES = new Set(['race-cross','race-mngmt','race-faith','quiz-antipodes','mirror-fill','speed-cross-yesno']);
const VALID_YASNAS = new Set(['суток','года','фаз_жизни']);

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
          COALESCE(user_id, device_id) AS player_key,
          MAX(score) AS best_score,
          MIN_BY(time_ms, score) AS best_time,
          MIN_BY(nickname, score) AS nickname,
          MIN_BY(avatar, score) AS avatar,
          MIN_BY(user_id, score) AS user_id,
          MIN_BY(device_id, score) AS device_id,
          MIN_BY(created_at, score) AS created_at
        FROM matches VIEW matches_by_game
        WHERE game_id = $game AND yasna_id = $yasna AND result = "win" AND is_bot = false ${filter}
        GROUP BY COALESCE(user_id, device_id)
      );

      SELECT player_key, best_score, best_time, nickname, avatar, user_id, device_id, created_at
      FROM $best_per_player
      ORDER BY best_score DESC NULLS LAST, best_time ASC
      LIMIT $limit;
    `;

    const params = {
      '$game':  { type:{typeId:'UTF8'}, value:{textValue: gameId} },
      '$yasna': { type:{typeId:'UTF8'}, value:{textValue: yasnaId} },
      '$limit': { type:{typeId:'UINT64'}, value:{uint64Value: limit} },
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
            '$game':  { type:{typeId:'UTF8'}, value:{textValue: gameId} },
            '$yasna': { type:{typeId:'UTF8'}, value:{textValue: yasnaId} },
            '$dev':   { type:{typeId:'UTF8'}, value:{textValue: myDeviceId} },
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
      console.error('YDB query failed', e);
    }
  });

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ items, myEntry }) };
};
