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
  'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
  'Content-Type': 'application/json',
  // Кэш на 5 минут с возможностью revalidate через ETag
  'Cache-Control': 'public, max-age=300, must-revalidate',
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
const ALLOWED_ORIGINS = [
  'https://avvacumrechevoi.github.io',   // прежний адрес, живёт до конца переезда
  'https://yasnalab.ru',                 // свой домен
  'https://www.yasnalab.ru',
].concat(
  /* ALLOW_ORIGIN здесь ДОБАВЛЯЕТ адрес, а не заменяет список. Так вышло не из
     красоты: scripts/deploy-backend.sh переносит окружение со старой версии и
     запрещает запятые в значениях (--environment сам разделяется запятыми),
     поэтому передать список переменной невозможно. Домены сайта — не секрет,
     им место в коде; переменная остаётся для разового адреса вроде превью. */
  String(process.env.ALLOW_ORIGIN || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
).filter((v, i, a) => a.indexOf(v) === i);

function applyCors(event){
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin || '';
  CORS['Access-Control-Allow-Origin'] =
    ALLOWED_ORIGINS.indexOf(origin) > -1 ? origin : ALLOWED_ORIGINS[0];
  CORS['Vary'] = 'Origin';
}

const EMPTY_RESPONSE = {
  revisionId: null,
  dataHash: 'empty',
  publishedAt: null,
  publishedBy: null,
  data: { added: [], edited: {}, deleted: [] },
};

exports.handler = async (event) => {
  applyCors(event);
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
    // ОШИБКА БД — ЭТО 503, А НЕ 200 С ПУСТЫМИ ДАННЫМИ.
    //
    // Прежнее поведение выглядело безобидно («клиент поработает на baseline»),
    // но ответ был синтаксически неотличим от легального «оверрайдов нет»:
    // core/content-store.js считает успехом любой ok-ответ, поле error не
    // читает — и записывает пустые overrides в кэш localStorage, затирая
    // последнюю известную ревизию. Последствия: у игроков разом исчезают
    // добавленные вопросы, откатываются правки, «оживают» удалённые; кэш для
    // offline тоже уничтожен. А если в этот момент открыта админка, то
    // mergeWithPublished склеит локальную дельту с ПУСТЫМ опубликованным
    // набором, и следующая публикация заменит ревизию целиком — весь ранее
    // опубликованный Tier-2 контент пропадёт из прода. Ровно этот класс потери
    // уже описан в шапке mergeWithPublished (admin.js).
    //
    // С 503 клиент попадает в ветку http-error, СОХРАНЯЕТ кэш и продолжает
    // работать на последних известных данных — то есть ведёт себя так, как
    // обещает docs/CONTENT_ARCHITECTURE.md.
    //
    // Cache-Control здесь тоже недопустим: сбой кэшировался на 5 минут.
    return {
      statusCode: 503,
      headers: { ...CORS, 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: 'content store unavailable', stale: true }),
    };
  }
};
