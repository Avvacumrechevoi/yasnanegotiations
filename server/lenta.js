/* ═══════════════════════════════════════════════════════════════════════════
   ЛЕНТА ПУБЛИКАЦИЙ УПРАВЛЕНИЙ — ручки чтения, жалоба и скрытие (миграция 007).

   GET  /lenta?n=20&kursor=&upravlenie=&tip=&posle=&otkuda=  — страница ленты
   GET  /lenta/istochniki                                     — состояние сбора (право)
   POST /lenta/skryt   { id, prichina }                       — скрыть запись (право)
   POST /lenta/zhaloba { id, prichina, tekst?, kontakt?, deviceId? } — жалоба на запись
        (X-Device-Secret привязанного устройства; deviceId ускоряет проверку)

   РУЧКИ НИКОГДА НЕ ХОДЯТ К ПЛОЩАДКАМ. Здесь — только чтение и запись YDB.
   Источники опрашивает отдельная функция yasna-lenta-sbor по таймеру; она же
   кладёт копии картинок в бакет и убирает их, когда запись скрыта. Поэтому
   ручке скрытия доступ к бакету не нужен: она ставит признак skryto, а
   объекты уходят при следующем заходе сборщика.

   ПОЧЕМУ В ПАКЕТЕ auth-telegram. Тут живой драйвер YDB, разбор токена и
   модуль прав — ровно то, что нужно четырём ручкам. Заводить под них свою
   функцию — лишний холодный старт и лишняя строка квоты.

   ЗАВИСИМОСТИ НЕ ИМПОРТИРУЕМ, А ПОЛУЧАЕМ (ctx.д) — как zayavki.js/druzya.js.
   Диспетчер auth-email.js передаёт: { method, path, body, event, query,
   д: { TypedValues, Types, ok, fail, txt, num, ts, clean, ipHash, throttleHit,
        verifyJWT, loadProfile, mailer } }.

   ВРЕМЯ. В базе только UTC. Литералы Timestamp("YYYY-MM-DDTHH:MM:SSZ") без
   долей секунды — параметры типа Timestamp репозиторий сознательно обходит
   (см. access.js tsLiteral, auth-email.js ~401). Отсюда и точность data до
   секунды, и курсор «ISO-секунды|klyuch».

   КУРСОР. Непрозрачен для клиента: base64url от «ISO|klyuch». Порядок ленты
   (data DESC, klyuch DESC); klyuch разводит записи с одной секундой (альбом
   в Телеграме даёт несколько записей с одной меткой).

   ПЕРЕМЕЖЕНИЕ. Не больше двух записей подряд от одного канала внутри страницы:
   третью отодвигает ближайшая запись другого канала, если она не старше семи
   дней. Переставляются только записи уже выбранной страницы, поэтому курсор
   dalshe считается по хронологическому порядку, и стыки страниц не рвутся.

   RUTUBE — только под видом «Видео». Видеотека Ясна-Школы — перезаливки
   2021–2023, и в общей хронологии они глушили бы живые каналы (разбор в
   отчёте §4). Поэтому без tip=video записи rutube не отдаются вовсе.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const crypto = require('crypto');

const СТРАНИЦА = 20;             /* записей по умолчанию */
const ПРЕДЕЛ = 50;               /* больше не отдаём: экран столько не покажет */
const ПРЕДЕЛ_НОВЫХ = 50;         /* счётчик «есть новое» дальше не считаем */
const МАКС_УПРАВЛЕНИЕ = 40;
const МАКС_КУРСОР = 200;
const МАКС_ID = 200;
const МАКС_ЗАГОЛОВОК = 120;
const МАКС_ТЕКСТ = 400;
const МАКС_ТЕКСТ_ЖАЛОБЫ = 500;
const МАКС_КОНТАКТ = 120;
const МАКС_ПРИЧИНА_СКРЫТИЯ = 200;
const МАКС_СЕКРЕТ = 200;

const ТИПЫ = ['tekst', 'foto', 'video', 'ssylka', 'statya', 'anons'];
const ОТКУДА = ['segodnya', 'biblioteka', 'upravleniya', 'lenta'];
const ПРИЧИНЫ_ЖАЛОБ = ['ya_na_foto', 'prava', 'reklama', 'drugoe'];

/* Пять жалоб в час с одного устройства. Больше — это не человек, которому
   нужен разбор, а кто-то, кому нужна наша таблица. Устройство — только
   ПРИВЯЗАННОЕ (строка в device_auth, как у /submit): случайный секрет — не
   новое устройство, а 403. Сверху — общий лимит на адрес (за NAT школы
   тридцать жалоб в час хватит всем) и потолок неразобранных жалоб: когда
   разбор не поспевает, новые не копим. */
const ЖАЛОБ_В_ЧАС = 5;
const ЖАЛОБ_В_ЧАС_С_АДРЕСА = 30;
const ПОТОЛОК_НОВЫХ_ЖАЛОБ = 300;
const ОКНО_ЖАЛОБ_МС = 60 * 60 * 1000;
const СРОК_ЖАЛОБЫ = '3 дня';
const МАКС_DEVICE_ID = 128;

const ПЕРЕМЕЖЕНИЕ_МС = 7 * 86400000;      /* третью подряд отодвигает запись не старше недели */
const МОЛЧИТ_ДНЕЙ = 56;                   /* восемь недель без записей — «молчит» (§4) */
const ТРЕВОГА_МС = 24 * 60 * 60 * 1000;   /* сутки без удачного опроса — «тревога» */
const ЖУРНАЛ_НА_ИСТОЧНИК = 5;
const ЖАЛОБ_В_СОСТОЯНИИ = 50;

const ИСТОЧНИКИ_ЖИВУТ_МС = 5 * 60 * 1000; /* кэш списка каналов в экземпляре */
const КЭШ_ОТВЕТА = 'public, max-age=120'; /* сборщик ходит раз в четверть часа */

const ПРАВО_ИСТОЧНИКИ = 'cap:lenta.istochniki';
const ПРАВО_МОДЕРАЦИИ = 'cap:lenta.moderate';

const ПОЛЯ = `klyuch, istochnik, kanal, id, data, upravlenie, upravleniya, tip, zagolovok, tekst, ssylka,
              kartinka, kartinka_polnaya, kartinok, dlitelnost_s, bez_prevyu, ssylka_v_zapisi`;

/* ─── мелочи ─────────────────────────────────────────────────────────────── */
/* Точность до секунды — и в базе, и в курсоре, и в ответе. */
function секунды(iso) { return iso ? String(iso).slice(0, 19) + 'Z' : null; }
function да(в) { return !!(в && в.boolValue === true); }
function каналКлюч(istochnik, kanal) { return istochnik + ':' + kanal; }

/* Чужой текст режем по слову с «…». Сборщик делает это сам; здесь — вторая
   линия, чтобы контракт (120/400) держался даже при сбое сборщика. */
function обрезать(с, макс) {
  if (с == null) return null;
  const т = String(с);
  if (т.length <= макс) return т;
  const кусок = т.slice(0, макс - 1);
  let край = кусок;
  /* Если срез пришёлся посреди слова — отступаем к пробелу; на границе
     слова (следующий знак — пробел) слово целое, его не режем. */
  if (!/\s/.test(т.charAt(макс - 1))) {
    const пробел = кусок.lastIndexOf(' ');
    if (пробел > макс / 2) край = кусок.slice(0, пробел);
  }
  return край.replace(/[\s,;:—-]+$/, '') + '…';
}

/* Из ссылки в записи наружу уходит только хост: клиенту нужна подпись
   «ссылка в записи: vkvideo.ru», а не сам адрес. */
function хост(с) {
  if (!с) return null;
  const т = String(с).trim();
  try { return new URL(т).hostname || null; } catch (_) {}
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(т) ? т.toLowerCase() : null;
}

/* ─── курсор ─────────────────────────────────────────────────────────────── */
function курсорИз(з) {
  return Buffer.from(з.data + '|' + з.klyuch, 'utf8').toString('base64url');
}
/* null — курсора нет; undefined — курсор битый (→ 400). Доли секунды в
   курсоре терпим и отбрасываем: база хранит секунды. */
function курсорВ(строка) {
  if (!строка) return null;
  if (строка.length > МАКС_КУРСОР || !/^[A-Za-z0-9_-]+$/.test(строка)) return undefined;
  let раз;
  try { раз = Buffer.from(строка, 'base64url').toString('utf8'); } catch (_) { return undefined; }
  const и = раз.indexOf('|');
  if (и < 0) return undefined;
  const м = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.\d{1,6})?Z$/.exec(раз.slice(0, и));
  const klyuch = раз.slice(и + 1);
  if (!м || !klyuch || klyuch.length > МАКС_ID || /[\u0000-\u001f\u007f]/.test(klyuch)) return undefined;
  const data = м[1] + 'Z';
  if (Number.isNaN(Date.parse(data))) return undefined;
  return { data, klyuch };
}

/* ─── база ───────────────────────────────────────────────────────────────── */
/* Любой отказ базы — 503 с причиной, а не 500 «internal»: клиентский транспорт
   различает «сервер не отвечает» и «сервер сломан», и человеку говорят разное. */
async function вБазе(drv, f) {
  try {
    return await drv.tableClient.withSession(f);
  } catch (e) {
    const ошибка = new Error('db unavailable');
    ошибка.код = 503;
    ошибка.detail = String((e && e.message) || e).slice(0, 200);
    throw ошибка;
  }
}

/* ─── источники (список каналов) ─────────────────────────────────────────── */
/* Читаем раз в пять минут на экземпляр: строк меньше двадцати, а нужны они
   на каждый запрос — чтобы знать каналы управления, подписать запись именем
   канала и ведущего и решить, можно ли отдавать картинки (только с согласием). */
let источникиКэш = { когда: 0, список: [] };

function строкаИсточника(и, д) {
  const { txt, ts, num } = д;
  return {
    klyuch: txt(и[0]), istochnik: txt(и[1]), kanal: txt(и[2]), adres: txt(и[3]),
    nazvanie: txt(и[4]), upravlenie: txt(и[5]),
    upravleniya: String(txt(и[6]) || '').split(',').map((x) => x.trim()).filter(Boolean),
    vklyuchen: да(и[7]), period_min: num(и[8]) || 0, zametka: txt(и[9]),
    soglasie_at: секунды(ts(и[10])), licenziya_ssylka: txt(и[11]), vedushchij: txt(и[12]),
    proveren_at: секунды(ts(и[13])), udacha_at: секунды(ts(и[14])), oshibka: txt(и[15]),
    oshibok_podryad: num(и[16]) || 0, poslednyaya_publikaciya: секунды(ts(и[17])),
    zapisej: num(и[18]) || 0,
  };
}

async function источники(drv, д, свежие) {
  if (!свежие && Date.now() - источникиКэш.когда < ИСТОЧНИКИ_ЖИВУТ_МС) return источникиКэш.список;
  const список = [];
  await вБазе(drv, async (s) => {
    const r = await s.executeQuery(`
      SELECT klyuch, istochnik, kanal, adres, nazvanie, upravlenie, upravleniya, vklyuchen,
             period_min, zametka, soglasie_at, licenziya_ssylka, vedushchij,
             proveren_at, udacha_at, oshibka, oshibok_podryad, poslednyaya_publikaciya, zapisej
      FROM lenta_istochniki;`, {});
    for (const row of ((r.resultSets[0] || {}).rows || [])) список.push(строкаИсточника(row.items, д));
  });
  источникиКэш = { когда: Date.now(), список };
  return список;
}
function сброситьИсточники() { источникиКэш = { когда: 0, список: [] }; }

function собраноAt(список) {
  let м = null;
  for (const и of список) if (и.udacha_at && (!м || и.udacha_at > м)) м = и.udacha_at;
  return м;
}

/* Управления, у которых есть записи, — по ГЛАВНОМУ управлению канала.
   Общий канал russkaya_yasna читается и под Граникой (?upravlenie=granika),
   но чип «Граника» не показывается: иначе чужой канал выдавался бы за её
   ленту (§7 п. 8). Считаем по zapisej из lenta_istochniki — его ведёт сборщик,
   и это дешевле, чем считать строки на каждый запрос. */
function управленияСЗаписями(список) {
  const итог = [];
  for (const и of список) {
    if (!(и.zapisej > 0) || !и.upravlenie) continue;
    if (итог.indexOf(и.upravlenie) < 0) итог.push(и.upravlenie);
  }
  return итог;
}

/* ─── строка → запись ────────────────────────────────────────────────────── */
function записьИз(и, д, поКаналу) {
  const { txt, ts, num } = д;
  const istochnik = txt(и[1]), kanal = txt(и[2]);
  const источник = поКаналу.get(каналКлюч(istochnik, kanal)) || null;
  const своиУправления = String(txt(и[6]) || '').split(',').map((x) => x.trim()).filter(Boolean);
  const upravlenie = txt(и[5]) || (источник && источник.upravlenie) || null;
  /* Копии картинок — только у Телеграма и только у канала с согласием
     правообладателя. Сборщик и так их не кладёт, но если согласие отозвано
     (soglasie_at убрали), картинки должны пропасть из ленты сразу, а не
     после следующего захода сборщика. */
  const картинкиМожно = istochnik === 'telegram' && !!(источник && источник.soglasie_at);
  const kartinka = картинкиМожно ? (txt(и[11]) || null) : null;
  const kartinka_polnaya = картинкиМожно ? (txt(и[12]) || null) : null;
  const картинок = num(и[13]);
  const дл = num(и[14]);
  return {
    klyuch: txt(и[0]),
    kanal_klyuch: каналКлюч(istochnik, kanal),
    id: txt(и[0]),
    istochnik, kanal,
    kanal_nazvanie: (источник && источник.nazvanie) || kanal,
    upravlenie,
    upravleniya: своиУправления.length ? своиУправления
      : (источник ? источник.upravleniya.slice() : (upravlenie ? [upravlenie] : [])),
    tip: txt(и[7]),
    zagolovok: обрезать(txt(и[8]) || '', МАКС_ЗАГОЛОВОК),
    /* У Rutube — только заголовок, длительность и ссылка: условия площадки. */
    tekst: istochnik === 'rutube' ? null : обрезать(txt(и[9]), МАКС_ТЕКСТ),
    ssylka: txt(и[10]),
    kartinka, kartinka_polnaya,
    kartinok: картинок != null ? картинок : (kartinka ? 1 : 0),
    data: секунды(ts(и[4])),
    dlitelnost_s: дл || null,
    bez_prevyu: да(и[15]),
    ssylka_v_zapisi: хост(txt(и[16])),
    vedushchij: (источник && источник.vedushchij) || null,
  };
}

/* Наружу — вместе с курсором записи: клиент запоминает курсор самой свежей
   увиденной и спрашивает ?posle=… про новое, не разбирая курсор сам. */
function наружу(з) {
  const о = Object.assign({}, з);
  delete о.klyuch;
  delete о.kanal_klyuch;
  о.kursor = курсорИз(з);
  return о;
}

function сравнить(a, b) {
  /* (data DESC, klyuch DESC) — ровно как в запросе, иначе курсор поедет */
  if (a.data !== b.data) return a.data < b.data ? 1 : -1;
  return a.klyuch < b.klyuch ? 1 : (a.klyuch > b.klyuch ? -1 : 0);
}

/* Не больше двух подряд от одного канала. Работает на уже выбранной странице,
   поэтому набор записей не меняется — только их порядок. */
function перемежить(список) {
  const итог = [], ост = список.slice();
  while (ост.length) {
    let к = 0;
    const л = итог.length;
    if (л >= 2 && итог[л - 1].kanal_klyuch === итог[л - 2].kanal_klyuch
        && ост[0].kanal_klyuch === итог[л - 1].kanal_klyuch) {
      for (let i = 1; i < ост.length; i++) {
        if (ост[i].kanal_klyuch !== ост[0].kanal_klyuch
            && (Date.parse(ост[0].data) - Date.parse(ост[i].data)) <= ПЕРЕМЕЖЕНИЕ_МС) { к = i; break; }
      }
    }
    итог.push(ост.splice(к, 1)[0]);
  }
  return итог;
}

/* ─── чтение страницы ────────────────────────────────────────────────────── */
/* Условие курсора одно для общей ленты и для канала; для «есть новое» знак
   разворачивается. Время — литералом Timestamp("…Z") прямо в тексте запроса:
   строка прошла регулярку курсора и состоит из цифр, дефисов, T, двоеточий
   и Z, ничего другого туда не попадёт. klyuch идёт параметром. */
function условиеКурсора(к, новее) {
  const T = 'Timestamp("' + к.data + '")';
  return новее
    ? `(data > ${T} OR (data = ${T} AND klyuch > $kk))`
    : `(data < ${T} OR (data = ${T} AND klyuch < $kk))`;
}

/* DECLARE только для параметров, которые в запросе есть: лишний DECLARE в
   YQL — в лучшем случае предупреждение, проверять это в бою незачем. */
async function страница(s, д, { канал, курсор, n, tip, безRutube, новее }) {
  const { TypedValues } = д;
  const декл = ['DECLARE $n AS Uint64'];
  const где = ['(skryto IS NULL OR skryto = false)'];
  const парам = { '$n': TypedValues.uint64(n) };
  if (канал) {
    декл.push('DECLARE $i AS Utf8', 'DECLARE $c AS Utf8');
    где.push('istochnik = $i', 'kanal = $c');
    парам['$i'] = TypedValues.utf8(канал.istochnik);
    парам['$c'] = TypedValues.utf8(канал.kanal);
  }
  if (курсор) {
    декл.push('DECLARE $kk AS Utf8');
    где.push(условиеКурсора(курсор, новее));
    парам['$kk'] = TypedValues.utf8(курсор.klyuch);
  }
  if (tip) {
    декл.push('DECLARE $tip AS Utf8');
    где.push('tip = $tip');
    парам['$tip'] = TypedValues.utf8(tip);
  }
  if (безRutube) где.push('istochnik <> "rutube"u');
  const вид = канал ? 'lenta_publikacii_po_kanalu' : 'lenta_publikacii_po_data';
  const r = await s.executeQuery(`${декл.join('; ')};
    SELECT ${ПОЛЯ} FROM lenta_publikacii VIEW ${вид}
    WHERE ${где.join(' AND ')}
    ORDER BY data DESC, klyuch DESC LIMIT $n;`, парам);
  return ((r.resultSets[0] || {}).rows || []);
}

/* ok() ставит Cache-Control: no-store на общем объекте заголовков. Лента —
   публичная и меняется раз в четверть часа, ей уместен короткий кэш. Копия,
   а не правка общего объекта: он один на весь экземпляр функции. */
function ответ(ok, тело) {
  const о = ok(тело);
  о.headers = Object.assign({}, о.headers, { 'Cache-Control': КЭШ_ОТВЕТА });
  return о;
}

/* Метка «откуда открыли» — в журнал, лучшими стараниями: счётчик не должен
   ломать ленту. Ключ klient:<otkuda> — чтобы считать по префиксу ключа,
   не пересекаясь со строками сборщика. */
async function вЖурнал(drv, д, otkuda, сообщение, сколько, началоМс) {
  const { TypedValues } = д;
  try {
    await drv.tableClient.withSession(async (s) => {
      await s.executeQuery(`
        DECLARE $k AS Utf8; DECLARE $s AS Utf8; DECLARE $o AS Utf8;
        DECLARE $n AS Uint32; DECLARE $d AS Uint32;
        UPSERT INTO lenta_zhurnal (istochnik_klyuch, at, ishod, soobshchenie, dlitelnost_ms, novyh, otkuda)
        VALUES ($k, CurrentUtcTimestamp(), "prosmotr"u, $s, $d, $n, $o);`, {
          '$k': TypedValues.utf8('klient:' + otkuda),
          '$s': TypedValues.utf8(сообщение.slice(0, 200)),
          '$o': TypedValues.utf8(otkuda),
          '$n': TypedValues.uint32(Math.max(0, Math.min(сколько, 65535))),
          '$d': TypedValues.uint32(Math.max(0, Math.min(Date.now() - началоМс, 65535))),
        });
    });
  } catch (e) {
    console.warn('[lenta] журнал не записан', String((e && e.message) || e).slice(0, 120));
  }
}

async function лента(drv, ctx) {
  const { query, д } = ctx;
  const { ok, fail, clean } = д;
  const начало = Date.now();

  const upravlenie = clean(query.upravlenie, МАКС_УПРАВЛЕНИЕ + 1);
  if (upravlenie && !/^[a-z0-9-]{1,40}$/.test(upravlenie)) return fail(400, 'bad upravlenie');
  const tip = clean(query.tip, 20);
  if (tip && ТИПЫ.indexOf(tip) < 0) return fail(400, 'bad tip', { detail: 'tip: ' + ТИПЫ.join(', ') });
  const otkuda = clean(query.otkuda, 20);
  if (otkuda && ОТКУДА.indexOf(otkuda) < 0) return fail(400, 'bad otkuda', { detail: 'otkuda: ' + ОТКУДА.join(', ') });
  const сыройN = query.n == null ? '' : String(query.n).trim();
  let n = СТРАНИЦА;
  if (сыройN !== '') {
    if (!/^\d{1,4}$/.test(сыройN)) return fail(400, 'bad n', { detail: 'n: целое 0…' + ПРЕДЕЛ });
    n = Math.min(Number(сыройN), ПРЕДЕЛ);
  }
  const курсор = курсорВ(clean(query.kursor, МАКС_КУРСОР + 1));
  if (курсор === undefined) return fail(400, 'bad kursor');
  const после = курсорВ(clean(query.posle, МАКС_КУРСОР + 1));
  if (после === undefined) return fail(400, 'bad posle');
  if (курсор && после) return fail(400, 'kursor and posle together');

  const список = await источники(drv, д);
  const поКаналу = new Map(список.map((и) => [каналКлюч(и.istochnik, и.kanal), и]));
  const общее = {
    upravleniya_s_zapisyami: управленияСЗаписями(список),
    sobrano_at: собраноAt(список),
    upravlenie: upravlenie || null,
    tip: tip || null,
  };
  const безRutube = tip !== 'video';

  /* Каналы управления: все, где оно есть в upravleniya (выключенный источник
     опрашивать перестают, но его прежние записи из ленты не пропадают).
     Управление без каналов — пустая лента сразу, без запроса к таблице. */
  let каналы = null;
  if (upravlenie) {
    каналы = список.filter((и) => и.upravleniya.indexOf(upravlenie) >= 0
                                && !(безRutube && и.istochnik === 'rutube'));
  }

  const пусто = (novyh) => ответ(ok, Object.assign({ zapisi: [], dalshe: null, novyh }, общее));
  if (n === 0 && !после) return пусто(null);
  if (каналы && !каналы.length) {
    if (otkuda) await вЖурнал(drv, д, otkuda, `upravlenie=${upravlenie} bez-kanalov`, 0, начало);
    return пусто(после ? 0 : null);
  }

  /* Читаем на одну строку больше, чем отдадим: так «есть ли ещё» известно
     точно, а не по совпадению «страница полная». Для «есть новое» — на одну
     больше предела счётчика, чтобы честно отдать 50, а не врать числом. */
  const взять = после ? Math.max(ПРЕДЕЛ_НОВЫХ, n) + 1 : n + 1;
  const курсорЗапроса = после || курсор;
  const новее = !!после;

  let строки = [];
  await вБазе(drv, async (s) => {
    if (!каналы) {
      строки = await страница(s, д, { курсор: курсорЗапроса, n: взять, tip, безRutube, новее });
      return;
    }
    /* По каналу — своя страница, потом слияние: индекс po_kanalu держит
       порядок внутри канала, а управлений с пятью каналами — единицы. */
    for (const к of каналы) {
      const ч = await страница(s, д, { канал: к, курсор: курсорЗапроса, n: взять, tip, безRutube: false, новее });
      строки = строки.concat(ч);
    }
  });

  let записи = строки.map((row) => записьИз(row.items, д, поКаналу));
  записи.sort(сравнить);

  /* Каждый канал отдал до «взять» строк; после слияния «больше n» означает,
     что за срезом ещё что-то есть — в общей ленте или в любом из каналов. */
  const всего = записи.length;
  const естьЕщё = всего > n;
  записи = записи.slice(0, n);
  const dalshe = естьЕщё && записи.length ? курсорИз(записи[записи.length - 1]) : null;
  const novyh = после ? Math.min(всего, ПРЕДЕЛ_НОВЫХ) : null;

  if (otkuda) {
    await вЖурнал(drv, д, otkuda,
      `upravlenie=${upravlenie || '-'} tip=${tip || '-'} kursor=${курсор ? 'da' : 'net'} posle=${после ? 'da' : 'net'} n=${n}`,
      записи.length, начало);
  }
  return ответ(ok, Object.assign({
    zapisi: перемежить(записи).map(наружу),
    dalshe, novyh,
  }, общее));
}

/* ─── кто с правом ───────────────────────────────────────────────────────── */
/* Без токена — 401, с токеном без права — 403: разные действия для человека
   («войдите» против «вам сюда нельзя»). Права читаем через access.js, а не
   своей выборкой из role_grants: единственное место, где они считаются. */
async function ктоСПравом(drv, ctx, право) {
  const { event, д } = ctx;
  const авт = (event.headers && (event.headers.Authorization || event.headers.authorization)) || '';
  const токен = авт.startsWith('Bearer ') ? д.verifyJWT(авт.slice(7), process.env.JWT_SECRET) : null;
  if (!токен || !токен.sub) return { код: 401, error: 'unauthorized' };
  let доступ = null;
  try {
    доступ = await require('./access.js').resolveAccess(drv, { userId: String(токен.sub) });
  } catch (e) {
    /* Модуль прав не доехал в пакет или база молчит — закрываем, а не
       открываем: ошибка развёртывания не должна становиться дырой. */
    console.error('[lenta] права не прочитаны', e);
    return { код: 403, error: 'forbidden', detail: 'права не прочитаны' };
  }
  if (доступ && (доступ.isSuperadmin || (доступ.caps || []).indexOf(право) >= 0)) {
    return { userId: String(токен.sub) };
  }
  return { код: 403, error: 'forbidden', detail: 'нужно право ' + право };
}

/* ─── состояние сбора для владельца ──────────────────────────────────────── */
function состояниеИсточника(и, сейчасМс) {
  const днейНазад = (t) => (t ? Math.floor((сейчасМс - Date.parse(t)) / 86400000) : null);
  const прошло = (t) => (t ? сейчасМс - Date.parse(t) : Infinity);
  /* Тревога — когда удачи нет дольше суток или двух периодов опроса (у
     суточных источников сутки — это один пропуск, а не беда). */
  const тревогаЧерез = Math.max(ТРЕВОГА_МС, 2 * (и.period_min || 0) * 60 * 1000);
  let sostoyanie = 'zhiv';
  if (!и.vklyuchen) sostoyanie = 'vyklyuchen';
  else if (!и.proveren_at) sostoyanie = 'ne_proveren';
  else if (прошло(и.udacha_at) > тревогаЧерез) sostoyanie = 'trevoga';
  else if (и.oshibok_podryad >= 3) sostoyanie = 'oshibka';
  else if (днейНазад(и.poslednyaya_publikaciya) == null || днейНазад(и.poslednyaya_publikaciya) > МОЛЧИТ_ДНЕЙ) sostoyanie = 'molchit';
  return Object.assign({}, и, {
    sostoyanie,
    molchit_dnej: днейНазад(и.poslednyaya_publikaciya),
    proveren_dnej_nazad: днейНазад(и.proveren_at),
  });
}

async function состояние(drv, ctx) {
  const { д } = ctx;
  const { ok, fail, txt, ts, num, TypedValues } = д;
  const кто = await ктоСПравом(drv, ctx, ПРАВО_ИСТОЧНИКИ);
  if (кто.код) return fail(кто.код, кто.error, кто.detail ? { detail: кто.detail } : undefined);

  const список = await источники(drv, д, true);
  const сейчас = Date.now();
  const итог = список.map((и) => состояниеИсточника(и, сейчас));

  const жалобы = [];
  await вБазе(drv, async (s) => {
    /* Последние пять записей журнала на источник — чтобы видеть не только
       «сломан», но и с какого раза. Ключ (istochnik_klyuch, at) — это
       первичный ключ, чтение по префиксу. */
    for (const и of итог) {
      const r = await s.executeQuery(`DECLARE $k AS Utf8; DECLARE $n AS Uint64;
        SELECT at, ishod, soobshchenie, dlitelnost_ms, novyh FROM lenta_zhurnal
        WHERE istochnik_klyuch = $k ORDER BY at DESC LIMIT $n;`,
        { '$k': TypedValues.utf8(и.klyuch), '$n': TypedValues.uint64(ЖУРНАЛ_НА_ИСТОЧНИК) });
      и.zhurnal = ((r.resultSets[0] || {}).rows || []).map((row) => ({
        at: секунды(ts(row.items[0])), ishod: txt(row.items[1]), soobshchenie: txt(row.items[2]),
        dlitelnost_ms: num(row.items[3]), novyh: num(row.items[4]),
      }));
    }
    /* Новые жалобы. Индекса по состоянию нет — таблица на десятки строк,
       полный обход дешевле индекса. */
    const rж = await s.executeQuery(`DECLARE $s AS Utf8; DECLARE $n AS Uint64;
      SELECT klyuch, at, prichina, tekst, kontakt, ustrojstvo, sostoyanie FROM lenta_zhaloby
      WHERE sostoyanie = $s LIMIT $n;`,
      { '$s': TypedValues.utf8('novaya'), '$n': TypedValues.uint64(ЖАЛОБ_В_СОСТОЯНИИ * 4) });
    for (const row of ((rж.resultSets[0] || {}).rows || [])) {
      const и = row.items;
      жалобы.push({
        id: txt(и[0]), at: секунды(ts(и[1])), prichina: txt(и[2]), tekst: txt(и[3]),
        kontakt: txt(и[4]), ustrojstvo: txt(и[5]), sostoyanie: txt(и[6]),
      });
    }
    жалобы.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    жалобы.splice(ЖАЛОБ_В_СОСТОЯНИИ);
    /* Разбирающему нужно видеть, на что жалуются: заголовок и ссылка записи.
       Ключей — единицы, чтение по первичному ключу. */
    const карточки = new Map();
    for (const ж of жалобы) {
      if (!ж.id || карточки.has(ж.id)) continue;
      const r = await s.executeQuery(`DECLARE $k AS Utf8;
        SELECT klyuch, zagolovok, ssylka, skryto FROM lenta_publikacii WHERE klyuch = $k;`,
        { '$k': TypedValues.utf8(ж.id) });
      const row = ((r.resultSets[0] || {}).rows || [])[0];
      карточки.set(ж.id, row ? { zagolovok: txt(row.items[1]), ssylka: txt(row.items[2]), skryto: да(row.items[3]) } : null);
    }
    for (const ж of жалобы) {
      const к = карточки.get(ж.id);
      ж.zagolovok = к ? к.zagolovok : null;
      ж.ssylka = к ? к.ssylka : null;
      ж.skryto = к ? к.skryto : null;
      ж.zapis_est = !!к;
    }
  });

  return ok({ istochniki: итог, zhaloby: жалобы, sobrano_at: собраноAt(список) });
}

/* ─── запись по ключу (есть ли такая) ────────────────────────────────────── */
async function публикация(drv, д, klyuch) {
  const { TypedValues, txt } = д;
  let з = null;
  await вБазе(drv, async (s) => {
    const r = await s.executeQuery(`DECLARE $k AS Utf8;
      SELECT klyuch, zagolovok, ssylka, skryto FROM lenta_publikacii WHERE klyuch = $k;`,
      { '$k': TypedValues.utf8(klyuch) });
    const row = ((r.resultSets[0] || {}).rows || [])[0];
    if (row) з = { klyuch: txt(row.items[0]), zagolovok: txt(row.items[1]), ssylka: txt(row.items[2]), skryto: да(row.items[3]) };
  });
  return з;
}

function ключЗаписи(clean, сырой) {
  const id = clean(сырой, МАКС_ID + 1);
  if (!id || id.length > МАКС_ID || !/^[a-z]+:[^:\s]+:\S+$/.test(id)) return null;
  return id;
}

/* ─── скрыть запись (модератор) ──────────────────────────────────────────── */
/* Только признак: объекты картинок из бакета уберёт сборщик на следующем
   заходе по skryto, ему для этого ничего не нужно, кроме самой строки.
   Жалобы на запись при этом становятся разобранными — иначе они висели бы
   в списке владельца после того, как решение уже принято. */
async function скрыть(drv, ctx) {
  const { body, д } = ctx;
  const { TypedValues, ok, fail, clean } = д;
  const кто = await ктоСПравом(drv, ctx, ПРАВО_МОДЕРАЦИИ);
  if (кто.код) return fail(кто.код, кто.error, кто.detail ? { detail: кто.detail } : undefined);

  const id = ключЗаписи(clean, body && body.id);
  if (!id) return fail(400, 'bad id', { detail: 'id записи: istochnik:kanal:id' });
  const prichina = clean(body && body.prichina, МАКС_ПРИЧИНА_СКРЫТИЯ) || 'moderator';

  const з = await публикация(drv, д, id);
  if (!з) return fail(404, 'not found', { detail: 'такой записи в ленте нет' });

  await вБазе(drv, async (s) => {
    await s.executeQuery(`
      DECLARE $k AS Utf8; DECLARE $p AS Utf8;
      UPDATE lenta_publikacii SET skryto = true, skryto_prichina = $p,
             skryto_at = CurrentUtcTimestamp(), obnovleno_at = CurrentUtcTimestamp()
      WHERE klyuch = $k;
      UPDATE lenta_zhaloby SET sostoyanie = "razobrana"u WHERE klyuch = $k;`,
      { '$k': TypedValues.utf8(id), '$p': TypedValues.utf8(prichina) });
  });
  console.log('[lenta] скрыто', id, 'кем', кто.userId, 'почему', prichina);
  return ok({ ok: true, id, skryto: true, uzhe_bylo: з.skryto });
}

/* ─── устройство по секрету ──────────────────────────────────────────────── */
/* Секрет должен быть уже привязан к устройству (device_auth, миграция 002):
   привязку делает /progress при первой синхронизации, и у человека с
   приложением она есть. Здесь привязки при первом обращении НЕТ нарочно —
   иначе каждый случайный секрет становился бы «новым устройством» с квотой
   пять жалоб, и лимит не значил бы ничего.
   Ищем двумя путями: с deviceId в теле — по первичному ключу, как /submit
   (server/submit.js checkDeviceSecret); без него — по хешу через индекс
   device_auth_po_secret_hash (миграция 007). Сравнение хешей — в постоянное
   время. Возвращает хеш (ключ лимита и поле ustrojstvo) или null. */
async function устройствоПоСекрету(drv, д, секрет, deviceId) {
  const { TypedValues, txt } = д;
  const хеш = crypto.createHash('sha256').update(String(секрет)).digest('hex');
  let привязано = false;
  await вБазе(drv, async (s) => {
    if (deviceId) {
      const r = await s.executeQuery(`DECLARE $d AS Utf8;
        SELECT secret_hash FROM device_auth WHERE device_id = $d;`, { '$d': TypedValues.utf8(deviceId) });
      const row = ((r.resultSets[0] || {}).rows || [])[0];
      const свой = row ? txt(row.items[0]) : null;
      if (свой) {
        const a = Buffer.from(String(свой)), b = Buffer.from(хеш);
        привязано = a.length === b.length && crypto.timingSafeEqual(a, b);
      }
      return;
    }
    const r = await s.executeQuery(`DECLARE $h AS Utf8;
      SELECT device_id FROM device_auth VIEW device_auth_po_secret_hash WHERE secret_hash = $h LIMIT 1;`,
      { '$h': TypedValues.utf8(хеш) });
    привязано = (((r.resultSets[0] || {}).rows || []).length) > 0;
  });
  return привязано ? хеш.slice(0, 32) : null;
}

/* Потолок неразобранных: таблица на десятки строк, индекса по состоянию нет —
   полный обход дешевле индекса (то же в состояние()). */
async function новыхЖалоб(drv, д) {
  const { TypedValues, num } = д;
  let n = 0;
  await вБазе(drv, async (s) => {
    const r = await s.executeQuery(`DECLARE $s AS Utf8;
      SELECT COUNT(*) AS n FROM lenta_zhaloby WHERE sostoyanie = $s;`, { '$s': TypedValues.utf8('novaya') });
    const row = ((r.resultSets[0] || {}).rows || [])[0];
    n = row ? (num(row.items[0]) || 0) : 0;
  });
  return n;
}

/* ─── частота жалоб ──────────────────────────────────────────────────────── */
/* Та же таблица auth_throttle, что у throttleHit из auth-email.js, но своё
   окно: там оно зашито в 15 минут, а жалобам обещано «5 в час». Окно не
   скользит: начинается с первой жалобы и через час обнуляется. */
async function частотаЖалоб(drv, д, ведро, предел) {
  const { TypedValues, num } = д;
  const лимит = предел || ЖАЛОБ_В_ЧАС;
  let можно = true;
  await вБазе(drv, async (s) => {
    const r = await s.executeQuery(`DECLARE $b AS Utf8;
      SELECT window_start, hits FROM auth_throttle WHERE bucket = $b;`,
      { '$b': TypedValues.utf8(ведро) });
    const row = ((r.resultSets[0] || {}).rows || [])[0];
    const сейчас = Date.now();
    const началоМс = row ? Number(String((row.items[0] || {}).uint64Value || 0)) / 1000 : 0;
    const было = row ? (num(row.items[1]) || 0) : 0;
    const заново = !row || (сейчас - началоМс) > ОКНО_ЖАЛОБ_МС;
    if (!заново && было >= лимит) { можно = false; return; }
    if (заново) {
      await s.executeQuery(`DECLARE $b AS Utf8; DECLARE $h AS Uint32;
        UPSERT INTO auth_throttle (bucket, window_start, hits) VALUES ($b, CurrentUtcTimestamp(), $h);`,
        { '$b': TypedValues.utf8(ведро), '$h': TypedValues.uint32(1) });
    } else {
      /* window_start не трогаем: UPSERT части колонок оставляет остальные. */
      await s.executeQuery(`DECLARE $b AS Utf8; DECLARE $h AS Uint32;
        UPSERT INTO auth_throttle (bucket, hits) VALUES ($b, $h);`,
        { '$b': TypedValues.utf8(ведро), '$h': TypedValues.uint32(было + 1) });
    }
  });
  return можно;
}

/* ─── жалоба на запись ───────────────────────────────────────────────────── */
/* Публично, но с секретом устройства (тот же X-Device-Secret, что у /submit):
   без него 403, с непривязанным — тоже 403. Сам секрет не храним — только
   хеш, он же ключ лимита. deviceId в теле необязателен: с ним проверка идёт
   по первичному ключу device_auth, без него — по индексу хеша. */
async function жалоба(drv, ctx) {
  const { body, event, д } = ctx;
  const { TypedValues, Types, ok, fail, clean } = д;
  const секрет = (event.headers && (event.headers['X-Device-Secret'] || event.headers['x-device-secret'])) || '';
  if (!секрет || String(секрет).length > МАКС_СЕКРЕТ)
    return fail(403, 'forbidden', { detail: 'нужен секрет устройства' });

  const id = ключЗаписи(clean, body && body.id);
  if (!id) return fail(400, 'bad id', { detail: 'id записи: istochnik:kanal:id' });
  const prichina = String((body && body.prichina) || '');
  if (ПРИЧИНЫ_ЖАЛОБ.indexOf(prichina) < 0)
    return fail(400, 'bad prichina', { detail: 'prichina: ' + ПРИЧИНЫ_ЖАЛОБ.join(', ') });
  const tekst = clean(body && body.tekst, МАКС_ТЕКСТ_ЖАЛОБЫ);
  const kontakt = clean(body && body.kontakt, МАКС_КОНТАКТ);
  const deviceId = clean(body && body.deviceId, МАКС_DEVICE_ID + 1);
  if (deviceId && deviceId.length > МАКС_DEVICE_ID) return fail(400, 'bad deviceId');

  const устройство = await устройствоПоСекрету(drv, д, секрет, deviceId);
  if (!устройство)
    return fail(403, 'forbidden', { detail: 'устройство не привязано: откройте приложение с сетью и попробуйте снова' });

  if (!(await частотаЖалоб(drv, д, 'lenta-zhaloba:' + устройство)))
    return fail(429, 'too many', { detail: 'жалобы с этого устройства уже приняты — подождите час' });
  const адрес = typeof д.ipHash === 'function' ? д.ipHash(event) : null;
  if (адрес && !(await частотаЖалоб(drv, д, 'lenta-zhaloba-ip:' + адрес, ЖАЛОБ_В_ЧАС_С_АДРЕСА)))
    return fail(429, 'too many', { detail: 'жалоб с этого адреса уже много — подождите час' });
  if ((await новыхЖалоб(drv, д)) >= ПОТОЛОК_НОВЫХ_ЖАЛОБ)
    return fail(429, 'too many', { detail: 'неразобранных жалоб слишком много — попробуйте через день' });

  const з = await публикация(drv, д, id);
  if (!з) return fail(404, 'not found', { detail: 'такой записи в ленте нет' });

  const опц = (v) => (v ? TypedValues.optional(TypedValues.utf8(v)) : TypedValues.optionalNull(Types.UTF8));
  await вБазе(drv, async (s) => {
    await s.executeQuery(`
      DECLARE $k AS Utf8; DECLARE $p AS Utf8; DECLARE $t AS Optional<Utf8>;
      DECLARE $c AS Optional<Utf8>; DECLARE $u AS Utf8; DECLARE $s AS Utf8;
      UPSERT INTO lenta_zhaloby (klyuch, at, prichina, tekst, kontakt, ustrojstvo, sostoyanie)
      VALUES ($k, CurrentUtcTimestamp(), $p, $t, $c, $u, $s);`, {
        '$k': TypedValues.utf8(id),
        '$p': TypedValues.utf8(prichina),
        '$t': опц(tekst),
        '$c': опц(kontakt),
        '$u': TypedValues.utf8(устройство),
        '$s': TypedValues.utf8('novaya'),
      });
  });
  return ok({ ok: true, srok: СРОК_ЖАЛОБЫ });
}

/* ─── маршруты ───────────────────────────────────────────────────────────── */
exports.route = async function route(drv, ctx) {
  const { method, path, д } = ctx;
  const { ok, fail } = д;
  /* auth-email.js отвечает на OPTIONS сам, до диспетчера; здесь — на случай
     прямого вызова модуля, чтобы CORS не зависел от порядка проверок. */
  if (method === 'OPTIONS') { const о = ok({}); о.body = ''; return о; }
  try {
    if (/\/lenta\/istochniki(\/|\?|$)/.test(path)) {
      if (method !== 'GET') return fail(405, 'method not allowed');
      return await состояние(drv, ctx);
    }
    if (/\/lenta\/skryt(\/|\?|$)/.test(path)) {
      if (method !== 'POST') return fail(405, 'method not allowed');
      return await скрыть(drv, ctx);
    }
    if (/\/lenta\/zhaloba(\/|\?|$)/.test(path)) {
      if (method !== 'POST') return fail(405, 'method not allowed');
      return await жалоба(drv, ctx);
    }
    if (/\/lenta(\/|\?|$)/.test(path)) {
      if (method !== 'GET') return fail(405, 'method not allowed');
      return await лента(drv, ctx);
    }
    return fail(404, 'not found', { path });
  } catch (e) {
    if (e && e.код === 503) return fail(503, 'db unavailable', { detail: e.detail || 'база не отвечает' });
    throw e;   /* остальное — 500 в auth-email.js, с записью в лог */
  }
};

exports.ПРАВО_ИСТОЧНИКИ = ПРАВО_ИСТОЧНИКИ;
exports.ПРАВО_МОДЕРАЦИИ = ПРАВО_МОДЕРАЦИИ;
exports.ТИПЫ = ТИПЫ;
exports.ПРИЧИНЫ_ЖАЛОБ = ПРИЧИНЫ_ЖАЛОБ;
exports.курсорИз = курсорИз;
exports.курсорВ = курсорВ;
exports.перемежить = перемежить;
exports.обрезать = обрезать;
exports.хост = хост;
exports.состояниеИсточника = состояниеИсточника;
exports.сброситьИсточники = сброситьИсточники;
