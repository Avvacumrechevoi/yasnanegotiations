// ═══════════════════════════════════════════════════════════════════
// Yandex Cloud Function: /spar/* — серверный прокси «Живого спарринга».
//
// ЗАЧЕМ. Раньше спарринг работал только по BYOK: человек вставлял СВОЙ
// ключ Anthropic в браузер. Для обычной аудитории это мёртвый сценарий,
// а привычка вставлять API-ключи в чужие страницы — вредная. Теперь ключ
// один и живёт здесь, в окружении функции (ANTHROPIC_API_KEY, ставится
// скриптом scripts/set-spar-env.sh — терминал → облако, минуя репозиторий).
//
// ПОЧЕМУ ПРОМПТ СОБИРАЕТСЯ НА СЕРВЕРЕ. Если принимать system от клиента,
// прокси превращается в бесплатный ретранслятор Claude для чего угодно.
// Клиент присылает только ИДЕНТИФИКАТОРЫ (level/type/skill) и реплики
// диалога; сервер знает тексты ролей сам. Тексты — ТОЧНАЯ КОПИЯ из
// docs/negotiations/spar.js (CFG): правишь там — правь и здесь.
//
// ЗАЩИТА. Гость обязан предъявить X-Device-Secret (та же device_auth, что
// у /progress и /submit), залогиненный — JWT. Частота: SPAR_PER_HOUR на
// устройство (по умолчанию 40 реплик/час) и SPAR_GLOBAL_PER_HOUR на всех
// (300/час) — это потолок расходов владельца, а не UX-параметр. Уровни
// объявлены в каталоге доступов sensitive:true — здесь их закрытие
// проверяется ПО-НАСТОЯЩЕМУ (галочка в матрице реально запрещает вызов).
//
// Endpoints:
//   GET  /spar/status → { configured } — настроен ли ключ (для UI).
//   POST /spar/chat   → { reply }      — одна реплика собеседника.
// ═══════════════════════════════════════════════════════════════════
// Env: ANTHROPIC_API_KEY, JWT_SECRET, YDB_ENDPOINT, YDB_DATABASE,
//      ALLOW_ORIGIN, SPAR_PER_HOUR?, SPAR_GLOBAL_PER_HOUR?, SPAR_MODEL_<LVL>?

const crypto = require('crypto');
const https = require('https');
const { Driver, getCredentialsFromEnv, TypedValues } = require('ydb-sdk');

let driver = null;
async function getDriver(){
  if(driver) return driver;
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

const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || 'https://avvacumrechevoi.github.io';
const CORS = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Secret',
  'Content-Type': 'application/json',
};
const ok   = (b) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(b) });
const fail = (code, error, extra) => ({ statusCode: code, headers: CORS, body: JSON.stringify(Object.assign({ error }, extra || {})) });

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

// ─── тексты ролей: ТОЧНАЯ КОПИЯ docs/negotiations/spar.js (CFG) ───────
const LEVELS = {
  'easy': { model: 'claude-haiku-4-5',
    behavior: 'Уровень РАЗМИНКА. Ты настроен доброжелательно и искренне хочешь, чтобы разговор сложился. Прощай неуклюжие формулировки и мелкие промахи: если ход в целом в нужную сторону — теплей и иди навстречу. На явную ошибку реагируй мягко, без обиды, и сам приоткрывай зацепку, за которую игроку удобно ухватиться («меня вот что на самом деле волнует…»). Сопротивляйся слабо, из контакта не выходи. Дай игроку почувствовать прогресс. Держись своего характера, но в его тёплой, расположенной версии.' },
  'medium': { model: 'claude-sonnet-4-6',
    behavior: 'Уровень ПЕРЕГОВОРЫ. Веди себя как живой деловой человек этой роли — без поблажек и без злого умысла. Точный ход — теплей и шаг навстречу; вода, давление или мимо твоего характера — холодней, держи дистанцию, переспрашивай, можешь усомниться вслух. Ничего не подсказывай и не подыгрывай. Контакт растёт только за реальную работу игрока; одна-две грубые ошибки подряд — и ты заметно отстраняешься.' },
  'hard': { model: 'claude-opus-4-8',
    behavior: 'Уровень ЖЁСТКИЙ СТОЛ. Ты опытный, недоверчивый и не расположенный собеседник; время и терпение на исходе. Ловишь любую неточность, штамп, манипуляцию и несоответствие своему характеру — называешь это вслух и давишь сильнее. Теплеешь скупо и только за по-настоящему сильный, точный ход, и даже тогда не до конца. На слабый или давящий ход — холодеешь резко: можешь оборвать тему, поставить ультиматум или встать из-за стола. Никаких подсказок и поблажек — пусть игрок вытаскивает разговор сам.' }
};
const SKILLS = {
  'contact': 'Игрок тренирует ВХОД В КОНТАКТ: расположить собеседника с первых реплик, по поведению считать его тип и выбрать верный заход вместо шаблонного. Награждай ходы, где игрок сперва настраивается на тебя (вопрос о тебе или твоём контексте, верный тон, темп под тебя), и холодей на разогнавшийся с порога питч или заход не в твою волну. Свой тип проявляй с первых реплик, чтобы было что считывать.',
  'resonance': 'Игрок тренирует РЕЗОНАНС: поймать твою волну — темп, тему, настроение — и удержаться от преждевременного питча. Награждай отзеркаливание, уточняющие вопросы и движение в твоём темпе; холодей, если игрок перескакивает к продаже, деньгам или решению раньше, чем построен контакт.',
  'give-take': 'Игрок тренирует ЧЕСТНЫЙ ОБМЕН: на каждое твоё «беру» называть встречное «даю, если» и привязывать уступку к проверяемому условию. Дави односторонне — проси уступок, про встречное молчи; награждай ровный обмен, остывай и на капитуляцию «лишь бы закрыть», и на встречный продавливающий ультиматум.',
  'status': 'Игрок тренирует РАЗЛИЧЕНИЕ ДРАЙВЕРА: услышать, в чём настоящий корень недовольства — деловые условия или задетое самолюбие и статус — и попасть в настоящую причину. Подавай жалобу про «цену» или «условия», за которой на деле задето отношение к тебе; награждай прощупывающие вопросы и признание твоего статуса, холодей, когда игрок лечит задетое самолюбие скидкой или цифрой.',
  'repair': 'Игрок тренирует ПОЧИНКУ НЕДОПОНИМАНИЯ: развернуть холодеющий или сорвавшийся разговор обратно к пониманию — без оправданий и встречных обвинений. Будь холоден, поминай прошлый промах или обиду; награждай прямое признание факта без оправданий и возврат к твоему интересу, резко закрывайся на перевод стрелок и отмашку «всякое бывает».',
  'exit': 'Игрок тренирует КРАСИВЫЙ ВЫХОД: завершить разговор — в том числе при твоём отказе — так, чтобы остался чистый след и открытая дверь. Веди дело к завершению или к отказу; награждай чёткую фиксацию договорённого, спокойное принятие «нет» и оставленную дверь, остывай на дожим после отказа, на обиду и на затянутый финал.'
};
const TYPE_PROMPT = {
  'ХА': 'нетерпеливый руководитель',
  'ФО': 'аналитик-скептик',
  'ЦИ': 'человек смысла и тепла',
  'ШЭ': 'практик до мозга костей'
};
const TYPE_NAME = { 'ХА': 'Командир', 'ФО': 'Аналитик', 'ЦИ': 'Душевный', 'ШЭ': 'Практик' };
const TYPE_ROLE = { 'ХА': 'нетерпеливый руководитель', 'ФО': 'аналитик-скептик', 'ЦИ': 'человек смысла и тепла', 'ШЭ': 'практик до мозга костей' };

function modelFor(level){
  const envName = 'SPAR_MODEL_' + level.toUpperCase();
  return process.env[envName] || LEVELS[level].model;
}

// Та же сборка, что aiSystem() на клиенте, — только из серверных копий.
function systemFor(level, type, skill){
  const typeName = TYPE_NAME[type];
  const typeBehavior = TYPE_PROMPT[type] || (typeName + ' — ' + (TYPE_ROLE[type] || '') + '.');
  const skillGoal = SKILLS[skill];
  const difficultyBehavior = LEVELS[level].behavior;
  return 'Ты играешь РОЛЬ собеседника на деловых переговорах, а НЕ ассистента и НЕ тренера. Ты — живой человек этой роли, с её характером и интересами.\n\n' +
    'ТВОЙ ХАРАКТЕР (' + typeName + ') — держи его в каждой реплике:\n' + typeBehavior + '\n\n' +
    'ЧТО ТРЕНИРУЕТ ИГРОК НАПРОТИВ — на это реагируй прежде всего:\n' + skillGoal + '\n\n' +
    'НАСКОЛЬКО ЖЁСТКО ИГРАТЬ:\n' + difficultyBehavior + '\n\n' +
    'КАК ОТВЕЧАТЬ:\n' +
    '- По-русски, коротко — 1–3 фразы, как в живой устной речи.\n' +
    '- Главное: реагируй на КАЧЕСТВО хода игрока — и по тренируемому навыку, и по своему характеру. Точный, сильный ход — теплей и шаг навстречу; вода, давление, манипуляция или мимо твоего типа — холодней и сопротивляйся, вплоть до выхода из контакта (насколько резко — по уровню жёсткости выше).\n' +
    '- Будь эмоционально достоверным: характер (' + typeName + ') виден всегда, даже когда теплеешь или злишься.\n' +
    '- НИКОГДА не выходи из роли: не объясняй правила, не оценивай ход игрока вслух, не давай советов, подсказок и мета-комментариев, не называй «правильный ответ». Только реплики и реакции персонажа.\n' +
    '- Не повторяй слова игрока дословно и не уходи в монолог — отвечай как в настоящем диалоге.';
}

// ─── доказательство устройства (та же device_auth, что у /progress) ──
async function checkDeviceSecret(drv, deviceId, secret){
  if(!deviceId || !secret) return false;
  const hash = crypto.createHash('sha256').update(String(secret)).digest('hex');
  let stored = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $d AS Utf8;
      SELECT secret_hash FROM device_auth WHERE device_id = $d;`,
      { '$d': TypedValues.utf8(deviceId) });
    const row = r.resultSets[0]?.rows?.[0];
    if(row) stored = row.items[0]?.textValue ?? null;
  });
  if(stored === null){
    await drv.tableClient.withSession(async (s) => {
      await s.executeQuery(`
        DECLARE $d AS Utf8; DECLARE $h AS Utf8;
        UPSERT INTO device_auth (device_id, secret_hash, created_at)
        VALUES ($d, $h, CurrentUtcTimestamp());`,
        { '$d': TypedValues.utf8(deviceId), '$h': TypedValues.utf8(hash) });
    });
    return true;
  }
  const a = Buffer.from(String(stored)), b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Окно НЕ скользит: window_start обновляется только при новом окне
// (разбор — server/submit.js, там та же схема).
async function rateOk(drv, bucket, limit){
  let allowed = true;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $b AS Utf8;
      SELECT window_start, hits FROM auth_throttle WHERE bucket = $b;`,
      { '$b': TypedValues.utf8(bucket) });
    const row = r.resultSets[0]?.rows?.[0];
    const startMs = row ? Number(String(row.items[0]?.uint64Value ?? 0)) / 1000 : 0;
    const hits = row ? Number(String(row.items[1]?.uint32Value ?? 0)) : 0;
    const fresh = !row || (Date.now() - startMs) > 3600 * 1000;
    if(!fresh && hits >= limit){ allowed = false; return; }
    if(fresh){
      await s.executeQuery(`
        DECLARE $b AS Utf8; DECLARE $h AS Uint32;
        UPSERT INTO auth_throttle (bucket, window_start, hits)
        VALUES ($b, CurrentUtcTimestamp(), $h);`,
        { '$b': TypedValues.utf8(bucket), '$h': TypedValues.uint32(1) });
    } else {
      await s.executeQuery(`
        DECLARE $b AS Utf8; DECLARE $h AS Uint32;
        UPDATE auth_throttle SET hits = $h WHERE bucket = $b;`,
        { '$b': TypedValues.utf8(bucket), '$h': TypedValues.uint32(hits + 1) });
    }
  });
  return allowed;
}

// ─── закрытие уровней: единственное МЕСТО, где sensitive проверяется ──
// по-настоящему. Порядок повторяет клиентский резолвер (core/access.js):
// суперадмин → явные строки (галочки роли + личные исключения, длиннейший
// префикс, при равной длине запрет) → каталог (wip/closed/account) → открыто.
function matchLen(key, feature){
  if(key === feature) return key.length;
  if(key.charAt(key.length - 1) !== '*') return -1;
  const base = key.slice(0, key.length - 1);
  if(base === '') return 0;
  if(feature.length > base.length && feature.indexOf(base) === 0) return base.length;
  const bare = base.replace(/[:.\-\/]+$/, '');
  if(bare && feature === bare) return bare.length;
  return -1;
}
async function levelAllowed(drv, acc, userId, feature){
  if(acc.isSuperadmin) return { allowed: true };
  let best = null, bestLen = -1;
  for(const key of Object.keys(acc.features || {})){
    const len = matchLen(key, feature);
    if(len < 0) continue;
    const granted = !!acc.features[key];
    if(len > bestLen || (len === bestLen && !granted)){ bestLen = len; best = granted; }
  }
  if(best !== null) return { allowed: best, why: best ? 'granted' : 'closed' };
  let node = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $f AS Utf8;
      SELECT default_access, status FROM features WHERE feature = $f;`,
      { '$f': TypedValues.utf8(feature) });
    const row = r.resultSets[0]?.rows?.[0];
    if(row) node = { defaultAccess: row.items[0]?.textValue ?? 'open', status: row.items[1]?.textValue ?? 'live' };
  });
  if(node){
    if(node.status === 'wip') return { allowed: false, why: 'wip' };
    if(node.defaultAccess === 'closed') return { allowed: false, why: 'closed' };
    if(node.defaultAccess === 'account') return { allowed: !!userId, why: userId ? 'granted' : 'account' };
  }
  return { allowed: true };
}

// ─── вызов Anthropic (Node 16 — без fetch, через https) ──────────────
function anthropic(model, system, messages, maxTokens){
  const payload = JSON.stringify({ model, max_tokens: maxTokens, system, messages });
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-length': Buffer.byteLength(payload),
      },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('timeout', () => { req.destroy(new Error('anthropic timeout')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function callWithFallback(level, system, messages, maxTokens){
  const primary = modelFor(level);
  let r = await anthropic(primary, system, messages, maxTokens);
  const modelIssue = r.status === 404 || (r.status === 400 && /model/i.test(r.body));
  if(modelIssue && primary !== 'claude-sonnet-4-6'){
    r = await anthropic('claude-sonnet-4-6', system, messages, maxTokens);
  }
  return r;
}

// ─── handler ─────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  const path = String(event?.path || event?.url || event?.requestContext?.http?.path || '');
  const configured = !!process.env.ANTHROPIC_API_KEY;

  if(/\/spar\/status(\?|$)/.test(path)) return ok({ configured });

  if(event.httpMethod !== 'POST') return fail(405, 'method not allowed');

  let body;
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {}); }
  catch(_){ return fail(400, 'invalid json'); }

  // Идентификаторы строго по словарям — никакого свободного текста в system.
  const level = String(body.level || '');
  const type = String(body.type || '');
  const skill = String(body.skill || '');
  if(!LEVELS[level]) return fail(400, 'bad level');
  if(!TYPE_PROMPT[type]) return fail(400, 'bad type');
  if(!SKILLS[skill]) return fail(400, 'bad skill');

  // Реплики: только роли user/assistant, разумные размеры.
  const raw = Array.isArray(body.messages) ? body.messages : null;
  if(!raw || !raw.length) return fail(400, 'messages required');
  if(raw.length > 60) return fail(413, 'too many messages');
  const messages = [];
  let total = 0;
  for(const m of raw){
    const role = m && m.role === 'assistant' ? 'assistant' : (m && m.role === 'user' ? 'user' : null);
    const content = m ? String(m.content || '').slice(0, 1500) : '';
    if(!role || !content) return fail(400, 'bad message');
    total += content.length;
    messages.push({ role, content });
  }
  if(total > 30000) return fail(413, 'dialog too long');

  // Кто спрашивает: токен либо секрет устройства.
  let userId = null;
  const auth = event.headers?.Authorization || event.headers?.authorization;
  if(auth?.startsWith('Bearer ')){
    const payload = verifyJWT(auth.slice(7), process.env.JWT_SECRET);
    if(payload?.sub) userId = String(payload.sub);
  }
  const hdrSecret = String(event.headers?.['X-Device-Secret'] || event.headers?.['x-device-secret'] || '').slice(0, 200);
  const deviceId = String(body.deviceId || '').slice(0, 128);

  let drv;
  try { drv = await getDriver(); }
  catch(e){ console.error('[spar] YDB недоступна', e); return fail(503, 'db unavailable'); }

  let ownerBucket;
  if(userId){
    ownerBucket = 'spar:usr:' + userId;
  } else {
    if(!deviceId || !hdrSecret) return fail(401, 'proof required', { detail: 'нужен вход или секрет устройства — обновите страницу' });
    const okSecret = await checkDeviceSecret(drv, deviceId, hdrSecret);
    if(!okSecret) return fail(403, 'bad device secret', { detail: 'это устройство не подтверждено' });
    ownerBucket = 'spar:dev:' + deviceId;
  }

  // Закрытие уровня — настоящее, серверное.
  let acc = { isSuperadmin: false, features: {} };
  try {
    const access = require('./access.js');
    acc = await access.resolveAccess(drv, { userId, ownerKeys: deviceId ? ['dev:' + deviceId] : [] });
  } catch(e){ console.warn('[spar] resolveAccess не сработал:', (e && e.message) || e); }
  const gate = await levelAllowed(drv, acc, userId, 'neg:spar:level:' + level);
  if(!gate.allowed){
    return fail(403, 'level closed', { why: gate.why || 'closed', detail: 'этот уровень спарринга для вас закрыт' });
  }

  // Частота: личный потолок и общий (деньги владельца).
  const perHour = parseInt(process.env.SPAR_PER_HOUR || '40', 10);
  const globalPerHour = parseInt(process.env.SPAR_GLOBAL_PER_HOUR || '300', 10);
  if(!await rateOk(drv, ownerBucket, perHour)){
    return fail(429, 'too many turns', { detail: 'слишком много реплик за час — передохните' });
  }
  if(!await rateOk(drv, 'spar:global', globalPerHour)){
    return fail(429, 'busy', { detail: 'спарринг сейчас перегружен — попробуйте позже' });
  }

  // Проверка ключа — В КОНЦЕ конвейера, а не в начале: так каждый отказ
  // (400/401/403/429) проверяется на проде ещё ДО того, как владелец
  // настроил ключ, и включение ключа не открывает непроверенных веток.
  if(!configured) return fail(503, 'not configured', { detail: 'спарринг на сервере не настроен — используйте свой ключ' });

  const maxTokens = body.kick ? 200 : 320;
  let r;
  try { r = await callWithFallback(level, systemFor(level, type, skill), messages, maxTokens); }
  catch(e){ console.error('[spar] anthropic error', e); return fail(502, 'llm unavailable', { detail: 'собеседник не отвечает — попробуйте ещё раз' }); }

  if(r.status !== 200){
    console.error('[spar] anthropic HTTP', r.status, String(r.body).slice(0, 300));
    if(r.status === 429) return fail(429, 'llm rate limited', { detail: 'собеседник перегружен — попробуйте через минуту' });
    if(r.status === 401) return fail(503, 'bad server key', { detail: 'ключ на сервере не работает — сообщите владельцу' });
    return fail(502, 'llm error', { detail: 'собеседник не отвечает — попробуйте ещё раз' });
  }
  let reply = '';
  try {
    const data = JSON.parse(r.body);
    reply = (data.content && data.content[0] && data.content[0].text) ? String(data.content[0].text).trim() : '';
  } catch(_){}
  if(!reply) return fail(502, 'empty reply', { detail: 'собеседник промолчал — попробуйте ещё раз' });
  return ok({ reply });
};
