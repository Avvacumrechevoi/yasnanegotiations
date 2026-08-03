// ═══════════════════════════════════════════════════════════════════
// Заглушка legacy-транспорта PvP: /rooms/create, /rooms/join, /rooms/send,
// /rooms/poll.
//
// ЗАЧЕМ. Раньше «Партия с другом» работала через поллинг сервера: четыре
// отдельные облачные функции держали комнаты и очередь сообщений. Действующий
// транспорт — Firebase RTDB (docs/games/duel/rt-firebase.js), и в собранных
// бандлах обращений к /rooms/* больше нет ни одного. Четыре функции при этом
// продолжали занимать слоты в исчерпанной квоте serverless.functions.count
// (10 из 10), из-за которой новый эндпоинт нельзя вынести отдельно.
//
// Просто снести маршруты нельзя: у кого-то может быть открыта страница,
// загруженная до перехода на Firebase. Такой клиент должен получить ЯСНЫЙ
// ответ, а не тишину или 404 от шлюза, поэтому здесь честный 410 Gone с
// человеческим текстом и признаком reload, по которому клиент может сам
// предложить обновить страницу.
//
// Обслуживается функцией submit по пути (см. разводку в server/submit.js) —
// своей функции у заглушки нет намеренно: смысл был как раз в освобождении
// слотов.
// ═══════════════════════════════════════════════════════════════════

const CORS = {
  // адрес проставляется на запрос в applyCors(), см. ниже
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
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

exports.handler = async (event) => {
  applyCors(event);
  if(String(event.httpMethod || '').toUpperCase() === 'OPTIONS'){
    return { statusCode: 200, headers: CORS, body: '' };
  }
  return {
    statusCode: 410,
    headers: CORS,
    body: JSON.stringify({
      error: 'transport_gone',
      message: 'Этот способ игры по сети больше не используется. Обновите страницу — Партия перейдёт на новый транспорт.',
      reload: true,
    }),
  };
};
