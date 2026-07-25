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

const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || 'https://avvacumrechevoi.github.io';
const CORS = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

exports.handler = async (event) => {
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
