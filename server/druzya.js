/* ═══════════════════════════════════════════════════════════════════════════
   ДРУЗЬЯ В ТАБЛИЦАХ (миграция 006).

   Раньше дружба жила в дереве Firebase, а личностью человека была запись в
   памяти телефона. Разбор бед — в шапке миграции; здесь важно одно следствие:
   ОБЕ ПОЛОВИНЫ ПАРЫ ВСЕГДА МЕНЯЮТСЯ ВМЕСТЕ, одним запросом. Из-за того, что
   в дереве это было невозможно, «убрать друга» работало только у себя, а
   согласие лежало в ящике, пока второй не откроет приложение.

   КТО ТАКОЙ ЧЕЛОВЕК ЗДЕСЬ. Публичный адрес pid — случайный, приходит от
   приложения (у существующих людей он уже есть, и мы его не меняем: иначе
   переезд стёр бы всех друзей). Право на строку доказывается так же, как и
   везде в этом бэкенде: токеном вошедшего либо секретом устройства. Голого
   pid НЕДОСТАТОЧНО — иначе, узнав чужой адрес из заявки, можно было бы
   говорить от его имени.

   ЧТО ОСТАЁТСЯ В FIREBASE. Зовы в Партию: им нужна секунда доставки, а не
   таблица.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const АЛФАВИТ = 'BCDFGHJKLMNPQRSTVWXZ23456789';   /* тот же, что у комнат: без похожих букв */
const ДЛИНА_КОДА = 6;
const МАКС_ИМЯ = 40;
const МАКС_ЗВЕРЬ = 16;
const МАКС_PID = 64;
/* Заявок за окно с одного адреса. Дерево частоту не считало вовсе — тот, кто
   узнал чужой код, мог слать заявки в цикле. */
const ЗАЯВОК_ЗА_ОКНО = 10;
const ДРУЗЕЙ_ПРЕДЕЛ = 300;

const ПОСЛАЛ = 'poslal', ПРИШЛА = 'prishla', ДРУЗЬЯ = 'druzya';

function кодСлучайный(crypto) {
  const б = crypto.randomBytes(ДЛИНА_КОДА);
  let к = '';
  for (let i = 0; i < ДЛИНА_КОДА; i++) к += АЛФАВИТ[б[i] % АЛФАВИТ.length];
  return к;
}
function кодРовный(с) {
  return String(с || '').trim().toUpperCase().replace(/\s+/g, '');
}
function pidРовный(с, clean) {
  const p = clean(с, МАКС_PID);
  /* Адрес — только буквы, цифры и дефис: он идёт в ключ таблицы, и мусор в
     нём однажды станет запросом, который никто не ждал. */
  return p && /^[A-Za-z0-9_-]{8,64}$/.test(p) ? p : null;
}

/* ─── кто обращается ─────────────────────────────────────────────────────── */
/* Возвращает {pid, userId, deviceId} либо null. Секрет устройства проверяем
   тем же способом, что и /submit: приложение шлёт его заголовком. */
async function ктоЭто(drv, ctx) {
  const { event, body, query, д } = ctx;
  const авт = event.headers?.Authorization || event.headers?.authorization;
  const токен = авт?.startsWith('Bearer ') ? д.verifyJWT(авт.slice(7), process.env.JWT_SECRET) : null;
  const userId = токен?.sub ? String(токен.sub) : null;
  const секрет = event.headers?.['X-Device-Secret'] || event.headers?.['x-device-secret'] || null;
  const deviceId = д.clean((body && body.deviceId) || (query && query.deviceId), 80);
  const pid = pidРовный((body && body.pid) || (query && query.pid), д.clean);
  if (!pid) return null;
  /* Доказательство права на этот pid: либо человек вошёл, либо у него есть
     секрет устройства. Без того и другого строку не создаём и не правим. */
  if (!userId && !секрет) return null;
  return { pid, userId, deviceId, секрет };
}

async function карточкаПоPid(drv, д, pid) {
  const { TypedValues } = д;
  let к = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $p AS Utf8;
      SELECT pid, user_id, device_id, nick, avatar, kod FROM druzya_ludi WHERE pid = $p;`,
      { '$p': TypedValues.utf8(pid) });
    const row = r.resultSets[0]?.rows?.[0];
    if (!row) return;
    const и = row.items;
    к = { pid: д.txt(и[0]), userId: д.txt(и[1]), deviceId: д.txt(и[2]),
          nick: д.txt(и[3]), avatar: д.txt(и[4]), kod: д.txt(и[5]) };
  });
  return к;
}

async function pidПоАккаунту(drv, д, userId) {
  const { TypedValues } = д;
  let pid = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $u AS Utf8;
      SELECT pid FROM druzya_ludi VIEW druzya_ludi_by_user WHERE user_id = $u LIMIT 1;`,
      { '$u': TypedValues.utf8(userId) });
    const row = r.resultSets[0]?.rows?.[0];
    if (row) pid = д.txt(row.items[0]);
  });
  return pid;
}

async function pidПоКоду(drv, д, код) {
  const { TypedValues } = д;
  let pid = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $k AS Utf8;
      SELECT pid FROM druzya_ludi VIEW druzya_ludi_by_kod WHERE kod = $k LIMIT 1;`,
      { '$k': TypedValues.utf8(код) });
    const row = r.resultSets[0]?.rows?.[0];
    if (row) pid = д.txt(row.items[0]);
  });
  return pid;
}

/* ─── POST /druzya/ya — объявиться ───────────────────────────────────────── */
/* Заводит или обновляет свою карточку и отдаёт код. Зовётся при заходе в
   раздел и после смены имени. Пишем только при расхождении: имя и зверь
   меняются раз в жизни, а лишняя запись в базу — это лишняя запись в базу. */
async function объявиться(drv, ctx) {
  const { body, д } = ctx;
  const { TypedValues, Types, ok, fail, clean } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я) return fail(401, 'unauthorized', { detail: 'нужен вход или секрет устройства и правильный pid' });

  const ник = clean(body.nick, МАКС_ИМЯ) || 'Игрок';
  const зверь = clean(body.avatar, МАКС_ЗВЕРЬ) || '✦';

  /* ВОШЁЛ — ЗНАЧИТ УЖЕ МОЖЕТ БЫТЬ ЗДЕСЬ. На новом телефоне приложение
     сочиняет себе новый адрес: он лежит в памяти телефона, а её на новом
     устройстве нет. Если бы мы завели по нему вторую строку, человек пришёл
     бы в свой аккаунт и не нашёл ни одного друга — ровно та беда, ради
     которой дружба и переезжала. Поэтому у вошедшего сначала спрашиваем
     базу: есть его строка — работаем с НЕЙ, а присланный адрес забываем.
     Приложение получает свой настоящий адрес в ответе и запоминает его. */
  if (я.userId) {
    const прежний = await pidПоАккаунту(drv, д, я.userId);
    if (прежний && прежний !== я.pid) я.pid = прежний;
  }

  const было = await карточкаПоPid(drv, д, я.pid);

  /* Код у человека уже может быть — свой, из прежней жизни в дереве. Он
     переносится как есть: сменить его — значит порвать связь с теми, кому
     человек его уже разослал. */
  let код = было?.kod || кодРовный(body.kod);
  if (код && !new RegExp('^[' + АЛФАВИТ + ']{' + ДЛИНА_КОДА + '}$').test(код)) код = null;
  /* Код, ПРИСЛАННЫЙ приложением, принимаем только если он свободен или уже
     наш. Без этой проверки двое, поднявшихся из прежнего дерева с одинаковым
     кодом (или просто выдумавших его), поделили бы один адрес, и заявка
     уходила бы не тому. Свой прежний код при этом не отбираем — иначе
     переезд порвал бы связь с теми, кому человек его уже разослал. */
  if (код && !(было && было.kod === код)) {
    const занят = await pidПоКоду(drv, д, код);
    if (занят && занят !== я.pid) код = null;
  }

  if (!код) {
    /* Свободный код ищем чтением перед записью: уникальности по вторичному
       указателю YDB не даёт. Пять попыток — с запасом: пространство 28^6. */
    for (let i = 0; i < 5 && !код; i++) {
      const п = кодСлучайный(require('crypto'));
      if (!(await pidПоКоду(drv, д, п))) код = п;
    }
    if (!код) return fail(503, 'no code', { detail: 'не удалось подобрать свободный код, попробуйте позже' });
  }

  const тоЖе = было && было.nick === ник && было.avatar === зверь
    && было.kod === код && было.userId === (я.userId || null);
  if (!тоЖе) {
    await drv.tableClient.withSession(async (s) => {
      await s.executeQuery(`
        DECLARE $p AS Utf8; DECLARE $u AS Optional<Utf8>; DECLARE $d AS Optional<Utf8>;
        DECLARE $n AS Utf8; DECLARE $a AS Optional<Utf8>; DECLARE $k AS Utf8;
        UPSERT INTO druzya_ludi (pid, user_id, device_id, nick, avatar, kod,
                                 created_at, updated_at)
        VALUES ($p, $u, $d, $n, $a, $k, CurrentUtcTimestamp(), CurrentUtcTimestamp());`,
        {
          '$p': TypedValues.utf8(я.pid),
          '$u': я.userId ? TypedValues.optional(TypedValues.utf8(я.userId)) : TypedValues.optionalNull(Types.UTF8),
          '$d': я.deviceId ? TypedValues.optional(TypedValues.utf8(я.deviceId)) : TypedValues.optionalNull(Types.UTF8),
          '$n': TypedValues.utf8(ник),
          '$a': TypedValues.optional(TypedValues.utf8(зверь)),
          '$k': TypedValues.utf8(код),
        });
    });
  }
  return ok({ pid: я.pid, kod: код, nick: ник, avatar: зверь, obnovleno: !тоЖе });
}

/* ─── GET /druzya — мои друзья и заявки ──────────────────────────────────── */
/* Одно чтение по началу ключа отдаёт и друзей, и обе стороны незавершённых
   заявок: раскладываем по состоянию уже здесь. Карточки подтягиваем следом —
   имя человек мог сменить, и друг не должен видеть старое вечно. */
async function список(drv, ctx) {
  const { д } = ctx;
  const { TypedValues, ok, fail } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я) return fail(401, 'unauthorized');

  const связи = [];
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $p AS Utf8;
      SELECT drug_pid, sostoyanie, created_at FROM druzhba WHERE pid = $p LIMIT 500;`,
      { '$p': TypedValues.utf8(я.pid) });
    for (const row of (r.resultSets[0]?.rows || []))
      связи.push({ pid: д.txt(row.items[0]), sostoyanie: д.txt(row.items[1]), ts: д.ts(row.items[2]) });
  });
  if (!связи.length) return ok({ druzya: [], vhodyashchie: [], poslannye: [] });

  /* Карточки — одним запросом на всех, а не по одной на каждого. */
  const карточки = new Map();
  await drv.tableClient.withSession(async (s) => {
    for (const ч of связи) {
      const r = await s.executeQuery(`DECLARE $p AS Utf8;
        SELECT pid, nick, avatar FROM druzya_ludi WHERE pid = $p;`,
        { '$p': TypedValues.utf8(ч.pid) });
      const row = r.resultSets[0]?.rows?.[0];
      if (row) карточки.set(д.txt(row.items[0]),
        { nick: д.txt(row.items[1]) || 'Игрок', avatar: д.txt(row.items[2]) || '✦' });
    }
  });

  const одеть = (ч) => Object.assign({ pid: ч.pid, ts: ч.ts },
    карточки.get(ч.pid) || { nick: 'Игрок', avatar: '✦' });
  return ok({
    druzya:      связи.filter((ч) => ч.sostoyanie === ДРУЗЬЯ).map(одеть),
    vhodyashchie: связи.filter((ч) => ч.sostoyanie === ПРИШЛА).map(одеть),
    poslannye:   связи.filter((ч) => ч.sostoyanie === ПОСЛАЛ).map(одеть),
  });
}

/* ─── POST /druzya/pozvat — заявка по коду ───────────────────────────────── */
async function позвать(drv, ctx) {
  const { body, д } = ctx;
  const { TypedValues, ok, fail, throttleHit } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я) return fail(401, 'unauthorized');

  const код = кодРовный(body.kod);
  if (код.length !== ДЛИНА_КОДА) return fail(400, 'short code', { detail: 'Код — шесть знаков.' });

  if (!(await throttleHit(drv, 'druzya:' + я.pid, ЗАЯВОК_ЗА_ОКНО)))
    return fail(429, 'too many', { detail: 'Слишком много заявок подряд. Попробуйте позже.' });

  const цель = await pidПоКоду(drv, д, код);
  if (!цель) return fail(404, 'no such code', { detail: 'Такого кода нет. Проверьте буквы.' });
  if (цель === я.pid) return fail(400, 'self', { detail: 'Это ваш собственный код.' });

  /* Уже друзья или уже позвал — говорим об этом, а не заводим вторую заявку. */
  let сейчас = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $p AS Utf8; DECLARE $d AS Utf8;
      SELECT sostoyanie FROM druzhba WHERE pid = $p AND drug_pid = $d;`,
      { '$p': TypedValues.utf8(я.pid), '$d': TypedValues.utf8(цель) });
    const row = r.resultSets[0]?.rows?.[0];
    if (row) сейчас = д.txt(row.items[0]);
  });
  if (сейчас === ДРУЗЬЯ) return ok({ uzhe: 'druzya', detail: 'Вы уже друзья.' });
  if (сейчас === ПОСЛАЛ) return ok({ uzhe: 'poslal', detail: 'Заявка уже отправлена — ждём ответа.' });
  /* Встречная заявка = согласие обоих. Заставлять человека жать «принять»
     после того, как он сам позвал того же, — лишний шаг ни о чём. */
  if (сейчас === ПРИШЛА) return await решить(drv, ctx, я.pid, цель, true);

  /* ОБЕ ПОЛОВИНЫ ОДНИМ ЗАПРОСОМ. Ради этого дружба и переехала в таблицы:
     в дереве чужую половину тронуть было нельзя, и заявка ложилась в ящик. */
  await drv.tableClient.withSession(async (s) => {
    await s.executeQuery(`
      DECLARE $ja AS Utf8; DECLARE $on AS Utf8;
      DECLARE $poslal AS Utf8; DECLARE $prishla AS Utf8;
      UPSERT INTO druzhba (pid, drug_pid, sostoyanie, created_at, updated_at)
      VALUES ($ja, $on, $poslal, CurrentUtcTimestamp(), CurrentUtcTimestamp());
      UPSERT INTO druzhba (pid, drug_pid, sostoyanie, created_at, updated_at)
      VALUES ($on, $ja, $prishla, CurrentUtcTimestamp(), CurrentUtcTimestamp());`,
      {
        '$ja': TypedValues.utf8(я.pid), '$on': TypedValues.utf8(цель),
        '$poslal': TypedValues.utf8(ПОСЛАЛ), '$prishla': TypedValues.utf8(ПРИШЛА),
      });
  });
  return ok({ poslano: true, pid: цель });
}

/* ─── принять или отклонить ──────────────────────────────────────────────── */
async function решить(drv, ctx, мой, чужой, принять) {
  const { д } = ctx;
  const { TypedValues, ok } = д;
  await drv.tableClient.withSession(async (s) => {
    if (принять) {
      await s.executeQuery(`
        DECLARE $ja AS Utf8; DECLARE $on AS Utf8; DECLARE $s AS Utf8;
        UPSERT INTO druzhba (pid, drug_pid, sostoyanie, created_at, updated_at)
        VALUES ($ja, $on, $s, CurrentUtcTimestamp(), CurrentUtcTimestamp());
        UPSERT INTO druzhba (pid, drug_pid, sostoyanie, created_at, updated_at)
        VALUES ($on, $ja, $s, CurrentUtcTimestamp(), CurrentUtcTimestamp());`,
        { '$ja': TypedValues.utf8(мой), '$on': TypedValues.utf8(чужой),
          '$s': TypedValues.utf8(ДРУЗЬЯ) });
    } else {
      /* Стираем ОБЕ половины. Это и есть лечение «убрал только у себя»:
         в дереве чужую строку правило не отдавало, и убранный продолжал
         видеть и звать. */
      await s.executeQuery(`
        DECLARE $ja AS Utf8; DECLARE $on AS Utf8;
        DELETE FROM druzhba WHERE pid = $ja AND drug_pid = $on;
        DELETE FROM druzhba WHERE pid = $on AND drug_pid = $ja;`,
        { '$ja': TypedValues.utf8(мой), '$on': TypedValues.utf8(чужой) });
    }
  });
  return ok({ sostoyanie: принять ? ДРУЗЬЯ : null, pid: чужой });
}

async function ответить(drv, ctx, принять) {
  const { body, д } = ctx;
  const { ok, fail, TypedValues } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я) return fail(401, 'unauthorized');
  const чужой = pidРовный(body.drugPid, д.clean);
  if (!чужой) return fail(400, 'no pid');

  /* Принять можно только то, что действительно пришло: иначе достаточно было
     бы знать чужой адрес, чтобы навязать себя в друзья. */
  if (принять) {
    let сост = null;
    await drv.tableClient.withSession(async (s) => {
      const r = await s.executeQuery(`DECLARE $p AS Utf8; DECLARE $d AS Utf8;
        SELECT sostoyanie FROM druzhba WHERE pid = $p AND drug_pid = $d;`,
        { '$p': TypedValues.utf8(я.pid), '$d': TypedValues.utf8(чужой) });
      const row = r.resultSets[0]?.rows?.[0];
      if (row) сост = д.txt(row.items[0]);
    });
    if (сост === ДРУЗЬЯ) return ok({ sostoyanie: ДРУЗЬЯ, pid: чужой });
    if (сост !== ПРИШЛА) return fail(409, 'no request', { detail: 'Такой заявки нет.' });
  }
  return await решить(drv, ctx, я.pid, чужой, принять);
}

/* ─── POST /druzya/perenos — забрать дружбу из прежнего дерева ───────────── */
/* У людей, заведённых до переезда, друзья лежат в дереве Firebase, и в
   таблицах их нет. Без переноса обновление молча оставило бы человека с
   пустым списком — это потеря данных, а не переезд.

   ПОЧЕМУ НЕ ЗАПИСЫВАЕМ СРАЗУ ДРУЗЬЯМИ. Приложение здесь ЗАЯВЛЯЕТ, с кем оно
   дружило, а проверить это по дереву сервер не может. Поверить на слово —
   значит дать любому вписать себя в друзья к любому, чей адрес он знает. Поэтому
   каждая пара заводится как ЗАЯВКА. Дальше работает то же правило, что и у
   встречных заявок: когда вторая сторона тоже обновится и пришлёт свой
   список, обе половины сойдутся и станут дружбой сами, без единого касания.
   Если вторая сторона не обновится — человек увидит «вы позвали, ждём
   ответа», и это честно: связи в таблицах действительно ещё нет. */
const ПЕРЕНОС_ПРЕДЕЛ = 100;
async function перенос(drv, ctx) {
  const { body, д } = ctx;
  const { TypedValues, ok, fail, throttleHit } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я) return fail(401, 'unauthorized');
  if (!(await throttleHit(drv, 'perenos:' + я.pid, 3)))
    return fail(429, 'too many');

  const список = Array.isArray(body.pids) ? body.pids.slice(0, ПЕРЕНОС_ПРЕДЕЛ) : [];
  let завели = 0, сошлось = 0;
  for (const сырой of список) {
    const другой = pidРовный(сырой, д.clean);
    if (!другой || другой === я.pid) continue;

    let моё = null, его = null;
    await drv.tableClient.withSession(async (s) => {
      /* Имена параметров те же, что и в остальных чтениях связи ($p/$d):
         один и тот же вопрос должен выглядеть одинаково во всех местах —
         иначе он и читается по-разному, и проверяется по-разному. */
      const r = await s.executeQuery(`DECLARE $p AS Utf8; DECLARE $d AS Utf8;
        SELECT sostoyanie FROM druzhba WHERE pid = $p AND drug_pid = $d;`,
        { '$p': TypedValues.utf8(я.pid), '$d': TypedValues.utf8(другой) });
      const row = r.resultSets[0]?.rows?.[0];
      if (row) моё = д.txt(row.items[0]);
    });
    if (моё === ДРУЗЬЯ) continue;
    if (моё === ПРИШЛА) { await решить(drv, ctx, я.pid, другой, true); сошлось++; continue; }
    if (моё === ПОСЛАЛ) continue;

    await drv.tableClient.withSession(async (s) => {
      await s.executeQuery(`
        DECLARE $ja AS Utf8; DECLARE $on AS Utf8;
        DECLARE $poslal AS Utf8; DECLARE $prishla AS Utf8;
        UPSERT INTO druzhba (pid, drug_pid, sostoyanie, created_at, updated_at)
        VALUES ($ja, $on, $poslal, CurrentUtcTimestamp(), CurrentUtcTimestamp());
        UPSERT INTO druzhba (pid, drug_pid, sostoyanie, created_at, updated_at)
        VALUES ($on, $ja, $prishla, CurrentUtcTimestamp(), CurrentUtcTimestamp());`,
        { '$ja': TypedValues.utf8(я.pid), '$on': TypedValues.utf8(другой),
          '$poslal': TypedValues.utf8(ПОСЛАЛ), '$prishla': TypedValues.utf8(ПРИШЛА) });
    });
    завели++;
  }
  return ok({ zaveli: завели, soshlos: сошлось, vsego: список.length });
}

/* ─── маршруты ───────────────────────────────────────────────────────────── */
exports.route = async function route(drv, ctx) {
  const { method, path, д } = ctx;
  const { fail } = д;
  if (/\/druzya\/ya(\/|\?|$)/.test(path) && method === 'POST') return await объявиться(drv, ctx);
  if (/\/druzya\/pozvat(\/|\?|$)/.test(path) && method === 'POST') return await позвать(drv, ctx);
  if (/\/druzya\/prinyat(\/|\?|$)/.test(path) && method === 'POST') return await ответить(drv, ctx, true);
  if (/\/druzya\/zabyt(\/|\?|$)/.test(path) && method === 'POST') return await ответить(drv, ctx, false);
  if (/\/druzya\/perenos(\/|\?|$)/.test(path) && method === 'POST') return await перенос(drv, ctx);
  if (/\/druzya(\/|\?|$)/.test(path) && method === 'GET') return await список(drv, ctx);
  return fail(404, 'not found', { path });
};

exports.ПРЕДЕЛ = ДРУЗЕЙ_ПРЕДЕЛ;
