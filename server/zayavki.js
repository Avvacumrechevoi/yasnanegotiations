/* ═══════════════════════════════════════════════════════════════════════════
   ЗАЯВКИ «ПОСЧИТАТЬ ИМЯ».

   Человек просит, чтобы имя посчитала команда Ясны. Это разговор, а не
   функция: у него есть состояние, и обе стороны должны его видеть. Поэтому
   заявка живёт в таблице (миграция 005), а письмо команде — только
   уведомление. Кнопка, которая молча отправляет и ничего не обещает, здесь
   не годится: человек оставляет имя и дату рождения и вправе знать, что с
   ними стало.

   ПОЧЕМУ НЕ СВОЯ ФУНКЦИЯ. Модуль уезжает в пакете yasna-auth-telegram вместе
   с auth-email.js: там уже есть и почта (mailer.js), и разбор токена, и живой
   драйвер YDB. Заводить восьмую облачную функцию ради трёх обработчиков —
   лишний холодный старт и лишняя строка в шлюзе.

   ЗАВИСИМОСТИ НЕ ИМПОРТИРУЕМ, А ПОЛУЧАЕМ. Все помощники (TypedValues, ok/fail,
   throttleHit, verifyJWT, clean) приходят из auth-email.js параметром. Свои
   копии разошлись бы с оригиналом на первой же правке — так уже было с
   whitelist gameId, который годами не знал действующих режимов.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const МАКС_ИМЯ = 80;
const МАКС_СВЯЗЬ = 120;
const МАКС_ВОПРОС = 500;
const МАКС_РОЖДЕНИЕ = 40;
const МАКС_ОТВЕТ = 2000;
/* Три заявки за окно с устройства. Больше — это не человек, которому нужен
   ответ, а кто-то, кому нужна наша почта. */
const ЗАЯВОК_ЗА_ОКНО = 3;

const СОСТОЯНИЯ = ['novaya', 'v_rabote', 'otvecheno'];

/* Способ связи проверяем мягко: либо похоже на почту, либо в строке хватает
   цифр для телефона. Строгая проверка здесь вредна — человек может написать
   «телеграм @ivan», и это тоже способ связи. Отказывать ему незачем, ответить
   по такому мы сможем. */
function связьГодится(с) {
  if (!с) return false;
  if (/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(с)) return true;
  const цифр = (с.match(/\d/g) || []).length;
  if (цифр >= 10) return true;
  return с.length >= 3;
}

function строкаЗаявки(и, txt, ts) {
  return {
    id: txt(и[0]),
    vid: txt(и[1]),
    imya: txt(и[2]),
    rozhdenie: txt(и[3]),
    svyaz: txt(и[4]),
    vopros: txt(и[5]),
    sostoyanie: txt(и[6]),
    otvet: txt(и[7]),
    createdAt: ts(и[8]),
    updatedAt: ts(и[9]),
  };
}

const ПОЛЯ = `zayavka_id, vid, imya, rozhdenie, svyaz, vopros, sostoyanie, otvet,
              created_at, updated_at`;

/* ─── создать ────────────────────────────────────────────────────────────── */
async function создать(drv, ctx) {
  const { body, event, д } = ctx;
  const { TypedValues, Types, ok, fail, clean, ipHash, throttleHit } = д;

  /* Согласие — не формальность: здесь собираются имя и дата рождения. Без
     отметки заявку не создаём вовсе, и говорим почему. */
  if (body.soglasie !== true)
    return fail(400, 'no consent', { detail: 'нужно согласие на обработку данных' });

  const имя = clean(body.imya, МАКС_ИМЯ);
  const связь = clean(body.svyaz, МАКС_СВЯЗЬ);
  const рождение = clean(body.rozhdenie, МАКС_РОЖДЕНИЕ);
  const вопрос = clean(body.vopros, МАКС_ВОПРОС);
  const устройство = clean(body.deviceId, 80);

  if (!имя) return fail(400, 'no name', { detail: 'без имени считать нечего' });
  if (!связьГодится(связь))
    return fail(400, 'no contact', { detail: 'оставьте почту или телефон — иначе ответить некуда' });

  const авт = event.headers?.Authorization || event.headers?.authorization;
  const токен = авт?.startsWith('Bearer ') ? д.verifyJWT(авт.slice(7), process.env.JWT_SECRET) : null;
  const человек = токен?.sub ? String(токен.sub) : null;

  /* Считаем по устройству, а не по человеку: вошедших мало, а перебирать
     форму будут именно гости. */
  const ведро = 'zayavka:' + (устройство || человек || ipHash(event) || 'net');
  if (!(await throttleHit(drv, ведро, ЗАЯВОК_ЗА_ОКНО)))
    return fail(429, 'too many', { detail: 'вы уже оставили заявку — мы ответим, подождите немного' });

  const id = (require('crypto').randomUUID && require('crypto').randomUUID())
    || ('z-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));

  await drv.tableClient.withSession(async (s) => {
    await s.executeQuery(`
      DECLARE $id AS Utf8; DECLARE $vid AS Utf8;
      DECLARE $u AS Optional<Utf8>; DECLARE $d AS Optional<Utf8>;
      DECLARE $imya AS Utf8; DECLARE $rozh AS Optional<Utf8>;
      DECLARE $svyaz AS Utf8; DECLARE $vopros AS Optional<Utf8>;
      DECLARE $sost AS Utf8; DECLARE $ip AS Optional<Utf8>;
      UPSERT INTO zayavki (zayavka_id, vid, user_id, device_id, imya, rozhdenie,
                           svyaz, vopros, sostoyanie, created_at, updated_at,
                           consent_at, ip_hash)
      VALUES ($id, $vid, $u, $d, $imya, $rozh, $svyaz, $vopros, $sost,
              CurrentUtcTimestamp(), CurrentUtcTimestamp(), CurrentUtcTimestamp(), $ip);`,
      {
        '$id': TypedValues.utf8(id),
        '$vid': TypedValues.utf8('imya'),
        '$u': человек ? TypedValues.optional(TypedValues.utf8(человек)) : TypedValues.optionalNull(Types.UTF8),
        '$d': устройство ? TypedValues.optional(TypedValues.utf8(устройство)) : TypedValues.optionalNull(Types.UTF8),
        '$imya': TypedValues.utf8(имя),
        '$rozh': рождение ? TypedValues.optional(TypedValues.utf8(рождение)) : TypedValues.optionalNull(Types.UTF8),
        '$svyaz': TypedValues.utf8(связь),
        '$vopros': вопрос ? TypedValues.optional(TypedValues.utf8(вопрос)) : TypedValues.optionalNull(Types.UTF8),
        '$sost': TypedValues.utf8('novaya'),
        '$ip': TypedValues.optional(TypedValues.utf8(String(ipHash(event) || '').slice(0, 64))),
      });
  });

  /* Уведомление команде — попытка, а не условие. Заявка уже в базе; если
     почта не настроена или письмо не ушло, обращение не теряется, и человеку
     об этом сообщать нечего. */
  const кому = process.env.ZAYAVKI_EMAIL;
  if (кому && д.mailer && д.mailer.isConfigured && д.mailer.isConfigured()) {
    try {
      await д.mailer.send({
        to: кому,
        subject: 'Ясна: заявка «Посчитать имя» — ' + имя,
        text: [
          'Имя: ' + имя,
          'Дата рождения: ' + (рождение || '—'),
          'Связь: ' + связь,
          'Вопрос: ' + (вопрос || '—'),
          'Вошёл: ' + (человек ? 'да' : 'нет'),
          'Номер обращения: ' + id,
        ].join('\n'),
      });
    } catch (e) { console.error('[zayavki] письмо не ушло', e); }
  }

  return ok({
    zayavka: { id, sostoyanie: 'novaya', imya: имя, svyaz: связь },
    detail: 'заявка принята',
  }, 201);
}

/* ─── свои заявки ────────────────────────────────────────────────────────── */
/* Гость находит их по устройству, вошедший — по себе. Отдаём и то и другое,
   если известно и то и другое: человек мог оставить заявку гостем, а потом
   войти, и терять её из виду он не должен. */
async function свои(drv, ctx) {
  const { event, query, д } = ctx;
  const { TypedValues, ok, txt, ts, clean } = д;

  const авт = event.headers?.Authorization || event.headers?.authorization;
  const токен = авт?.startsWith('Bearer ') ? д.verifyJWT(авт.slice(7), process.env.JWT_SECRET) : null;
  const человек = токен?.sub ? String(токен.sub) : null;
  const устройство = clean(query.deviceId, 80);

  if (!человек && !устройство) return ok({ zayavki: [] });

  const собрано = new Map();
  await drv.tableClient.withSession(async (s) => {
    if (человек) {
      const r = await s.executeQuery(`DECLARE $u AS Utf8;
        SELECT ${ПОЛЯ} FROM zayavki VIEW zayavki_by_user WHERE user_id = $u LIMIT 20;`,
        { '$u': TypedValues.utf8(человек) });
      for (const row of (r.resultSets[0]?.rows || [])) {
        const з = строкаЗаявки(row.items, txt, ts); собрано.set(з.id, з);
      }
    }
    if (устройство) {
      const r = await s.executeQuery(`DECLARE $d AS Utf8;
        SELECT ${ПОЛЯ} FROM zayavki VIEW zayavki_by_device WHERE device_id = $d LIMIT 20;`,
        { '$d': TypedValues.utf8(устройство) });
      for (const row of (r.resultSets[0]?.rows || [])) {
        const з = строкаЗаявки(row.items, txt, ts); собрано.set(з.id, з);
      }
    }
  });

  /* Сортируем здесь, а не в запросе: порядок по created_at через вторичный
     индекс YDB не даёт, а заявок у человека единицы. */
  const список = [...собрано.values()].sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return ok({ zayavki: список });
}

/* ─── разбор: список для команды ─────────────────────────────────────────── */
async function разбор(drv, ctx) {
  const { query, д } = ctx;
  const { TypedValues, ok, txt, ts } = д;
  const состояние = СОСТОЯНИЯ.indexOf(String(query.sostoyanie || '')) >= 0
    ? String(query.sostoyanie) : 'novaya';

  const список = [];
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $s AS Utf8;
      SELECT ${ПОЛЯ} FROM zayavki VIEW zayavki_by_sostoyanie WHERE sostoyanie = $s LIMIT 200;`,
      { '$s': TypedValues.utf8(состояние) });
    for (const row of (r.resultSets[0]?.rows || [])) список.push(строкаЗаявки(row.items, txt, ts));
  });
  список.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  return ok({ zayavki: список, sostoyanie: состояние });
}

/* ─── разбор: изменить состояние ─────────────────────────────────────────── */
async function пометить(drv, ctx) {
  const { body, д } = ctx;
  const { TypedValues, Types, ok, fail, clean } = д;
  const id = clean(body.id, 80);
  const сост = String(body.sostoyanie || '');
  if (!id) return fail(400, 'no id');
  if (СОСТОЯНИЯ.indexOf(сост) < 0)
    return fail(400, 'bad state', { detail: 'состояние: ' + СОСТОЯНИЯ.join(', ') });
  const ответ = clean(body.otvet, МАКС_ОТВЕТ);

  await drv.tableClient.withSession(async (s) => {
    await s.executeQuery(`
      DECLARE $id AS Utf8; DECLARE $s AS Utf8; DECLARE $o AS Optional<Utf8>;
      UPDATE zayavki SET sostoyanie = $s, otvet = $o, updated_at = CurrentUtcTimestamp()
      WHERE zayavka_id = $id;`,
      {
        '$id': TypedValues.utf8(id),
        '$s': TypedValues.utf8(сост),
        '$o': ответ ? TypedValues.optional(TypedValues.utf8(ответ)) : TypedValues.optionalNull(Types.UTF8),
      });
  });
  return ok({ saved: true, id, sostoyanie: сост });
}

/* ─── маршруты ───────────────────────────────────────────────────────────── */
/* Разбор закрыт правом, а не «знанием адреса»: в заявках лежат имя, дата
   рождения и телефон живых людей. Право отдельное (cap:zayavki.read), чтобы
   его можно было выдать разбирающему, не делая его суперадмином. */
const ПРАВО = 'cap:zayavki.read';

async function можноРазбирать(drv, ctx) {
  const { event, д } = ctx;
  const авт = event.headers?.Authorization || event.headers?.authorization;
  const токен = авт?.startsWith('Bearer ') ? д.verifyJWT(авт.slice(7), process.env.JWT_SECRET) : null;
  if (!токен?.sub) return false;
  let доступ = null;
  try {
    const access = require('./access.js');
    доступ = await access.resolveAccess(drv, { userId: String(токен.sub) });
  } catch (e) {
    /* Модуль прав не доехал в пакет — закрываем, а не открываем. Ошибка
       развёртывания не должна становиться дырой в персональных данных. */
    console.error('[zayavki] права не прочитаны', e);
    return false;
  }
  return !!(доступ && (доступ.isSuperadmin || (доступ.caps || []).indexOf(ПРАВО) >= 0));
}

exports.route = async function route(drv, ctx) {
  const { method, path, д } = ctx;
  const { fail } = д;

  if (/\/zayavki(\/|\?|$)/.test(path)) {
    if (!(await можноРазбирать(drv, ctx))) return fail(403, 'forbidden');
    if (method === 'GET') return await разбор(drv, ctx);
    if (method === 'PUT' || method === 'POST') return await пометить(drv, ctx);
    return fail(405, 'method not allowed');
  }
  if (/\/zayavka(\/|\?|$)/.test(path)) {
    if (method === 'POST') return await создать(drv, ctx);
    if (method === 'GET') return await свои(drv, ctx);
    return fail(405, 'method not allowed');
  }
  return fail(404, 'not found', { path });
};

exports.ПРАВО = ПРАВО;
