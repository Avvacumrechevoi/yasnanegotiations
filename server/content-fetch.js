// ═══════════════════════════════════════════════════════════════════
// Yandex Cloud Function: GET /content
//
// Возвращает текущую ревизию overrides (Tier-2 контента).
// Поддерживает If-None-Match → 304 Not Modified для эффективного кэша.
//
// Ответ 200:
//   {
//     revisionId: "uuid",
//     dataHash: "sha256-hex",       ← используется как ETag
//     publishedAt: "ISO8601",
//     publishedBy: "admin",
//     data: { added: [...], edited: {}, deleted: [] }
//   }
//
// Ответ 304: пусто (ETag совпадает)
// Ответ 200 + пустые overrides: если нет ни одной ревизии (свежий setup)
//
// Env vars: YDB_ENDPOINT, YDB_DATABASE
// ═══════════════════════════════════════════════════════════════════

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
  'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
  'Content-Type': 'application/json',
  // Кэш на 5 минут с возможностью revalidate через ETag
  'Cache-Control': 'public, max-age=300, must-revalidate',
};

const EMPTY_RESPONSE = {
  revisionId: null,
  dataHash: 'empty',
  publishedAt: null,
  publishedBy: null,
  data: { added: [], edited: {}, deleted: [] },
};

exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode:200, headers: CORS, body:'' };

  // Извлекаем If-None-Match для 304 fast-path
  const ifNoneMatch = event.headers?.['If-None-Match'] || event.headers?.['if-none-match'] || '';

  try {
    const drv = await getDriver();
    let row = null;

    await drv.tableClient.withSession(async (session) => {
      const { resultSets } = await session.executeQuery(`
        SELECT revision_id, data_json, data_hash, published_by, published_at
        FROM content_revisions
        WHERE is_current = true
        LIMIT 1;
      `);
      if(resultSets[0]?.rows?.length){
        const r = resultSets[0].rows[0];
        row = {
          revisionId:  r.items[0].textValue,
          dataJson:    r.items[1].textValue,
          dataHash:    r.items[2].textValue,
          publishedBy: r.items[3]?.textValue || null,
          publishedAt: r.items[4]?.uint64Value
            ? new Date(Number(r.items[4].uint64Value) / 1000).toISOString()
            : null,
        };
      }
    });

    if(!row){
      // Никаких ревизий нет — отдаём пустые overrides с ETag 'empty'
      const headers = { ...CORS, 'ETag': '"empty"' };
      if(ifNoneMatch === '"empty"') return { statusCode:304, headers, body:'' };
      return { statusCode:200, headers, body: JSON.stringify(EMPTY_RESPONSE) };
    }

    // Проверяем ETag против data_hash
    const etag = '"' + row.dataHash + '"';
    const headers = { ...CORS, 'ETag': etag };
    if(ifNoneMatch === etag){
      return { statusCode:304, headers, body:'' };
    }

    let data;
    try { data = JSON.parse(row.dataJson); }
    catch(_){ data = { added: [], edited: {}, deleted: [] }; }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        revisionId: row.revisionId,
        dataHash:   row.dataHash,
        publishedAt: row.publishedAt,
        publishedBy: row.publishedBy,
        data,
      }),
    };
  } catch(err){
    console.error('[content-fetch]', err);
    // На любой ошибке отдаём пустые overrides — клиент работает на baseline
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ...EMPTY_RESPONSE, error: 'fetch failed, using empty' }),
    };
  }
};
