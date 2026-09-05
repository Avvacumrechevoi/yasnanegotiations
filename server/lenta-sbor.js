/* ═══════════════════════════════════════════════════════════════════════════
   СБОРЩИК ЛЕНТЫ УПРАВЛЕНИЙ — функция yasna-lenta-sbor (nodejs22, 256 МБ,
   120 с), таймер yasna-lenta-timer '3/15 * * * ? *' на тег stable.

   ЗАЧЕМ СВОЯ ФУНКЦИЯ. Сборщику нужны срок до 120 с (auth-telegram живёт с
   30), выход к t.me, cdn*.telesco.pe и rutube.ru, право писать в бакет
   yasnalab.ru и таймер. Ничего из этого функции идентичности не нужно, а
   лишнее право писать в бакет у неё — лишний риск. Ручки чтения (/lenta)
   живут в пакете auth-telegram (server/lenta.js): им нужен тёплый драйвер и
   права, а не сеть наружу.

   ОДИН ЗАПУСК:
     1. читает lenta_istochniki; берёт включённые, у которых proveren_at +
        period_min уже позади (Телеграм 15 мин, Rutube 60); Телеграм первым;
        ручной запуск {"istochnik":"telegram:astronevod"} — один источник,
        {"vse":true} — все включённые без учёта периода;
     2. на источник — robots.txt площадки (раз в сутки на хост), один запрос
        первой страницы с честным User-Agent, разбор (lenta-razbor.js), порог
        здоровья разметки: при доле > 50 % записей без даты/текста/картинки
        исход «oshibka: разметка частично», пачка не пишется;
     3. сверка первой страницы с YDB того же окна: запись, которой на
        странице нет ВОВСЕ (ни среди разобранных, ни среди отброшенных) и
        которая лежит между более старой и более новой на странице, —
        skryto='udaleno_v_istochnike'. Запись, которую на этот раз не удалось
        прочитать (нет даты) или отсеял фильтр, удалённой не считается: первая
        не трогается, вторая скрывается своей причиной ('reklama'). Если хоть
        одна запись страницы без даты — сверка пропускается: границы окна
        неизвестны. Авто-скрытая запись, снова прочитанная со страницы,
        воскресает (skryto снимается, картинки собираются заново); скрытую
        модератором сборщик не воскрешает никогда;
     4. UPSERT новых и правок (окно правок 7 дней по tekst_hash — анонсы
        натурных уроков правят датами);
     5. картинки — только Телеграм и только у источника с soglasie_at: два
        объекта в бакете (≤160 px миниатюра и ≤480 px раскрытие), пережатие
        чистым JS (jpeg-js.js), три попытки, потом насовсем без картинки;
        у скрытых записей (модератором или сверкой) объекты удаляются.
        Удаление требует у сервисного аккаунта роли storage.editor (uploader
        объекты не удаляет — только незавершённые составные загрузки); при
        403 на DELETE сборщик пишет в журнал источника строку «trevoga»
        (не чаще раза в сутки), чтобы отказ прав был виден в /lenta/istochniki;
     6. состояние источника и строка журнала при любом исходе; ошибка одного
        источника остальных не останавливает; при 24 ч без удачи — строка
        «trevoga» в журнале (не чаще раза в сутки);
     7. бюджет времени — context.getRemainingTimeInMillis(): когда остаётся
        меньше 15 с, остальные источники ждут следующего запуска;
     8. раз в сутки — уборка: у каждого канала остаются «последние 10 записей
        без срока + всё моложе 365 дней», журнал — 30 дней.

   СРОК ХРАНЕНИЯ И ПОВТОРНЫЙ СБОР. Если бы уборка просто удаляла старое, а
   сбор — писал всё со страницы, у молчащего канала (Неглинка, Rutube) записи
   за десяткой удалялись бы ночью и возвращались утром, каждый раз с новой
   загрузкой картинок. Поэтому правило одно на обе стороны: запись старше
   365 дней берётся, только если входит в десятку самых свежих у канала
   (по объединению страницы и уже сохранённого), и удаляется, только если
   в десятку не входит.

   ЗАВИСИМОСТИ ВНЕДРЯЮТСЯ (сеть, бакет, хранилище, часы) — прогон
   server/proby/proba-sbor.mjs идёт на сохранённых страницах без сети и без
   облака; слой YDB там проверяется поддельной сессией на форму запросов.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const crypto = require('crypto');
const Р = require('./lenta-razbor.js');

/* Сроки — по опыту первых заходов 05.09.2026: t.me из облака Яндекса
   отвечает нестабильно, страница то приходит за секунду, то висит; при
   10 с каждый второй заход обрывался. Страница ждёт до 30 с и при обрыве
   пробуется ещё раз, robots.txt — коротко, а потолок функции поднят до
   300 с (scripts/deploy-backend.sh, timeout_for), чтобы пять источников
   успевали даже в плохую минуту. */
const СРОК_ЗАПРОСА_МС = 30000;
const СРОК_РОБОТОВ_МС = 8000;
const СРОК_КАРТИНКИ_МС = 15000;
const ПОВТОР_СТРАНИЦЫ = 1;                 /* ещё одна попытка за страницей при обрыве */
const МИН_ОСТАТОК_МС = 40000;              /* меньше — источники ждут следующего запуска */
const МИН_ОСТАТОК_КАРТИНКИ_МС = 8000;      /* меньше — картинки ждут следующего запуска */
const ПАУЗА_МЕЖДУ_КАНАЛАМИ_МС = 400;
const ОКНО_ПРАВОК_ДНЕЙ = 7;
const ХРАНИТЬ_ДНЕЙ = 365;
const БЕЗ_СРОКА_ЗАПИСЕЙ = 10;
const ЖУРНАЛ_ДНЕЙ = 30;
const УБОРКА_РАЗ_В_ЧАСОВ = 24;
const ТРЕВОГА_ЧАСОВ = 24;
const КАРТИНКА_ПОПЫТОК = 3;
const КАРТИНКА_МАКС_БАЙТ = 2 * 1024 * 1024;
const КАРТИНОК_ЗА_ЗАХОД = 20;
const МИНИАТЮРА_PX = 160;
const ПОЛНАЯ_PX = 480;
const КАЧЕСТВО_JPEG = 82;
const ПРЕФИКС_БАКЕТА = 'lenta/';
const CACHE_CONTROL_КАРТИНОК = 'public, max-age=604800';   /* 7 дней: отозванная копия не живёт год в кэше телефонов */
const ROBOTS_КЭШ_МС = 24 * 3600 * 1000;
/* Причины скрытия, которые ставит сам сборщик. Только их он и снимает, когда
   запись снова читается со страницы; причина модератора — не его дело. */
const АВТО_ПРИЧИНЫ = ['udaleno_v_istochnike', 'reklama'];
const ТРЕВОГА_БАКЕТА = 'бакет: нет права удалять объекты';

/* ─── помощники ──────────────────────────────────────────────────────────── */
function сек(iso) {                          /* ISO → до секунды, UTC */
  const т = Date.parse(iso);
  if (!Number.isFinite(т)) throw new Error('плохая дата: ' + iso);
  return new Date(т).toISOString().slice(0, 19) + 'Z';
}
function isoМс(мс) { return сек(new Date(мс).toISOString()); }
/* YQL-литерал Timestamp без долей секунды (как access.js tsLiteral): значение
   всегда из Date#toISOString, подстановка в текст запроса безопасна. */
function tsЛит(iso) { return 'Timestamp("' + сек(iso) + '")'; }
function хеш24(с) { return crypto.createHash('sha1').update(String(с)).digest('hex').slice(0, 24); }
function поУбыванию(а, б) { return б.data < а.data ? -1 : б.data > а.data ? 1 : (б.klyuch < а.klyuch ? -1 : б.klyuch > а.klyuch ? 1 : 0); }
function коротко(с, n) { return String(с == null ? '' : с).slice(0, n || 300); }

/* Единый вид записи → строка lenta_publikacii. */
function нормализовать(з, ист, сейчасISO) {
  return {
    klyuch: ист.istochnik + ':' + ист.kanal + ':' + з.id,
    istochnik: ист.istochnik, kanal: ист.kanal, id: String(з.id),
    data: сек(з.data),
    upravlenie: ист.upravlenie,
    upravleniya: ист.upravleniya || ист.upravlenie,
    tip: Р.ТИПЫ.includes(з.tip) ? з.tip : 'tekst',
    zagolovok: Р.обрезатьПоСлову(з.zagolovok || '', Р.ЗАГОЛОВОК_МАКС),
    tekst: з.tekst ? Р.обрезатьПоСлову(з.tekst, Р.ТЕКСТ_МАКС) : null,
    ssylka: з.ssylka,
    kartinka_istochnika: з.kartinka_istochnika || null,
    kartinok: Number(з.kartinok) || 0,
    dlitelnost_s: Number(з.dlitelnost_s) > 0 ? Math.round(Number(з.dlitelnost_s)) : null,
    bez_prevyu: !!з.bez_prevyu,
    ssylka_v_zapisi: з.ssylka_v_zapisi || null,
    tekst_hash: з.tekst_hash || Р.хешТекста(з),
    sobrano_at: сейчасISO,
    obnovleno_at: сейчасISO,
  };
}

/* ─── картинки: JPEG → две уменьшенные копии ─────────────────────────────── */
function этоJPEG(б) {
  return !!б && б.length > 3 && б[0] === 0xff && б[1] === 0xd8 && б[2] === 0xff;
}

/* Уменьшение усреднением по блокам (area average): для уменьшения в 2–8 раз
   даёт ровную картинку без муара; для увеличения не используется. */
function уменьшить(кадр, макс) {
  const { width: w, height: h, data } = кадр;
  const k = Math.max(w, h) / макс;
  if (k <= 1) return кадр;
  const W = Math.max(1, Math.round(w / k)), H = Math.max(1, Math.round(h / k));
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y * h / H), y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / H));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * w / W), x1 = Math.max(x0 + 1, Math.floor((x + 1) * w / W));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        let i = (yy * w + x0) * 4;
        for (let xx = x0; xx < x1; xx++) { r += data[i]; g += data[i + 1]; b += data[i + 2]; i += 4; n++; }
      }
      const o = (y * W + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return { width: W, height: H, data: out };
}

/* Буфер JPEG → { m: Buffer ≤160 px, p: Buffer ≤480 px, ширина, высота }.
   Не-JPEG (по сигнатуре байтов, не по Content-Type) — ошибка: без картинки. */
function пережать(буфер, о) {
  if (!этоJPEG(буфер)) throw new Error('картинка: не JPEG по сигнатуре');
  const jpeg = (о && о.jpeg) || require('./jpeg-js.js');
  const кадр = jpeg.decode(буфер, { useTArray: true, formatAsRGBA: true, tolerantDecoding: true, maxResolutionInMP: 24, maxMemoryUsageInMB: 96 });
  if (!кадр || !кадр.width || !кадр.height) throw new Error('картинка: не декодируется');
  const полная = уменьшить(кадр, ПОЛНАЯ_PX);
  const малая = уменьшить(полная, МИНИАТЮРА_PX);
  return {
    p: Buffer.from(jpeg.encode(полная, КАЧЕСТВО_JPEG).data),
    m: Buffer.from(jpeg.encode(малая, КАЧЕСТВО_JPEG).data),
    ширина: кадр.width, высота: кадр.height,
  };
}

function ключиБакета(з) {
  const х = хеш24(з.klyuch);
  const папка = ПРЕФИКС_БАКЕТА + з.istochnik + '/';
  return { m: папка + х + '-m.jpg', p: папка + х + '.jpg' };
}

async function картинкиВБакет(з, о) {
  const ответ = await о.взять(з.kartinka_istochnika, { срок: СРОК_КАРТИНКИ_МС, байты: true, максБайт: КАРТИНКА_МАКС_БАЙТ });
  if (!ответ || ответ.статус !== 200 || !ответ.тело || !ответ.тело.length) throw new Error('картинка: статус ' + (ответ && ответ.статус));
  if (ответ.тело.length > КАРТИНКА_МАКС_БАЙТ) throw new Error('картинка: ' + ответ.тело.length + ' байт, больше предела');
  const к = пережать(ответ.тело, о);
  const ключи = ключиБакета(з);
  await о.бакет.положить(ключи.m, к.m, 'image/jpeg');
  await о.бакет.положить(ключи.p, к.p, 'image/jpeg');
  return { kartinka: о.бакет.адрес(ключи.m), kartinka_polnaya: о.бакет.адрес(ключи.p), ширина: к.ширина, высота: к.высота };
}

/* Удалить оба объекта записи из бакета. Ключи считаются от klyuch, поэтому
   адрес в строке не нужен; 404 — тоже успех. */
async function удалитьОбъекты(з, о) {
  if (!о.бакет) return;
  const ключи = ключиБакета(з);
  await о.бакет.удалить(ключи.m);
  await о.бакет.удалить(ключи.p);
}

/* 403 на DELETE — это не сбой сети, а отсутствие права (storage.uploader
   вместо storage.editor). Такое не лечится повтором через 15 минут, и
   владелец должен увидеть это в состоянии источника, а не в логе функции. */
function нетПрава(e) { return !!(e && (e.код === 403 || /DELETE 403/.test(String(e.message || '')))); }

async function тревогаБакета(о, klyuch, сколько) {
  const сейчасМс = о.сейчас();
  const была = await о.хранилище.тревогаБыла(klyuch, isoМс(сейчасМс - ТРЕВОГА_ЧАСОВ * 3600000), ТРЕВОГА_БАКЕТА);
  if (была) return false;
  await о.хранилище.журнал({ klyuch, ishod: 'trevoga', novyh: 0, dlitelnost_ms: 0, otkuda: о.otkuda || 'timer',
    soobshchenie: ТРЕВОГА_БАКЕТА + ' (DELETE 403, не удалено ' + сколько + '): сервисному аккаунту нужна роль storage.editor' });
  return true;
}

/* ─── robots.txt ─────────────────────────────────────────────────────────── */
const роботы = new Map();      /* host → { когда, текст } — на жизнь экземпляра */
async function роботРазрешает(адрес, путь, о) {
  let host;
  try { host = new URL(адрес).host; } catch (e) { return { можно: false, почему: 'плохой адрес' }; }
  const мс = о.сейчас();
  let з = роботы.get(host);
  if (!з || мс - з.когда > ROBOTS_КЭШ_МС) {
    let текст = '';
    try {
      const р = await о.взять('https://' + host + '/robots.txt', { срок: СРОК_РОБОТОВ_МС });
      if (р && р.статус === 200 && р.текст) текст = р.текст;
    } catch (e) { текст = ''; /* нет файла или сети — считаем, что можно; сам заход покажет */ }
    з = { когда: мс, текст };
    роботы.set(host, з);
  }
  return Р.роботРазрешает(з.текст, путь, Р.АГЕНТ) ? { можно: true } : { можно: false, почему: 'robots.txt запрещает ' + путь };
}

/* ─── один источник ──────────────────────────────────────────────────────── */
async function собратьИсточник(ист, о) {
  const начало = Date.now();
  const сейчасМс = о.сейчас();
  const сейчасISO = isoМс(сейчасМс);
  const х = о.хранилище;
  const разборщик = Р.РАЗБОРЩИКИ[ист.istochnik];
  if (!разборщик) return итог(ист, о, начало, 'propusk', 'нет разборщика для ' + ист.istochnik, 0);

  const адрес = разборщик.адрес(ист);
  const робот = await роботРазрешает(адрес, разборщик.путьРобота(ист), о);
  if (!робот.можно) return итог(ист, о, начало, 'otkaz_robots', робот.почему, 0);

  let ответ, сбой = null;
  for (let попытка = 0; попытка <= ПОВТОР_СТРАНИЦЫ; попытка++) {
    сбой = null;
    try { ответ = await о.взять(адрес, { срок: СРОК_ЗАПРОСА_МС }); break; }
    catch (e) { сбой = e; }
    /* Обрыв или отказ сети — пробуем ещё раз, если бюджет позволяет; ответ
       со статусом (403, 302) — не повод повторять. */
    if (попытка < ПОВТОР_СТРАНИЦЫ && о.остаток() > МИН_ОСТАТОК_МС + СРОК_ЗАПРОСА_МС) continue;
    break;
  }
  if (сбой) return итог(ист, о, начало, 'oshibka', 'сеть: ' + коротко(сбой && сбой.message || сбой), 0);
  if (!ответ || ответ.статус !== 200) {
    return итог(ист, о, начало, 'oshibka', 'ответ ' + (ответ && ответ.статус) + (ответ && ответ.куда ? ' → ' + коротко(ответ.куда, 120) : ''), 0);
  }

  let сырьё;
  try { сырьё = разборщик.разобрать(ответ.текст, ист, { своиКаналы: о.своиКаналы, сейчасМс }); }
  catch (e) { return итог(ист, о, начало, 'oshibka', 'разбор: ' + коротко(e && e.message || e), 0); }

  const плохо = Р.здоровьеПлохое(сырьё.здоровье);
  if (плохо) return итог(ист, о, начало, 'oshibka', плохо, 0, { название: сырьё.название });
  if (!сырьё.записи.length && !сырьё.пусто) return итог(ист, о, начало, 'oshibka', 'разметка: ни одной записи', 0, { название: сырьё.название });
  if (сырьё.пусто) return итог(ист, о, начало, 'pusto', 'в канале нет записей', 0, { название: сырьё.название });

  const записи = сырьё.записи.map((з) => нормализовать(з, ист, сейчасISO));
  const самаяСтарая = записи.reduce((м, з) => (м && м < з.data ? м : з.data), null);
  const самаяНовая = записи.reduce((м, з) => (м && м > з.data ? м : з.data), null);
  const ключ = (id) => ист.istochnik + ':' + ист.kanal + ':' + id;
  const прочитано = new Set(записи.map((з) => з.klyuch));
  /* Всё, что есть на странице до фильтров: разобранное, служебное, без даты,
     отсеянное стоп-словами. Разборщик отдаёт множество id; если его нет
     (чужой разборщик) — считаем страницей только прочитанное. */
  const наСтранице = new Set(сырьё.наСтранице ? [...сырьё.наСтранице].map(ключ) : прочитано);
  const реклама = new Set(((сырьё.отброшеноId && сырьё.отброшеноId.reklama) || []).map(ключ));
  const отб = сырьё.отброшено || {};

  /* Что уже лежит за то же окно — одним чтением по индексу канала. */
  const есть = new Map((await х.записиКанала(ист, самаяСтарая)).map((р) => [р.klyuch, р]));

  /* 1. Сверка. Удалённой считается запись, которой на странице НЕТ ВОВСЕ и
        которая лежит строго между самой старой и самой новой прочитанной:
        границы окна не трогаем — там могло просто закончиться листание.
        Запись, которую на этот раз не удалось прочитать (блок без даты),
        на странице есть — она не удалена, и трогать её нельзя; если таких
        блоков хоть один, границы окна неизвестны — сверку пропускаем целиком.
        Запись, отсеянная стоп-словами после того, как её уже собрали, —
        скрывается своей причиной 'reklama'. Авто-скрытая запись, снова
        прочитанная со страницы, воскресает: пропажа была сбоем разметки или
        площадки, а не удалением. */
  const сверкаМожно = !(отб.bez_daty > 0 || отб.bez_id > 0);
  let скрыто = 0, воскрешено = 0;
  for (const р of есть.values()) {
    if (наСтранице.has(р.klyuch)) {
      if (р.skryto && АВТО_ПРИЧИНЫ.includes(р.skryto_prichina) && прочитано.has(р.klyuch)) {
        await х.показать(р.klyuch, сейчасISO);
        р.skryto = false; р.skryto_prichina = null; р.kartinka_popytok = 0;
        воскрешено++;
      } else if (!р.skryto && реклама.has(р.klyuch)) {
        await х.скрыть(р.klyuch, 'reklama', сейчасISO);
        р.skryto = true; р.skryto_prichina = 'reklama';
        скрыто++;
      }
      continue;
    }
    if (р.skryto || !сверкаМожно) continue;
    if (р.data > самаяСтарая && р.data < самаяНовая) {
      await х.скрыть(р.klyuch, 'udaleno_v_istochnike', сейчасISO);
      р.skryto = true; р.skryto_prichina = 'udaleno_v_istochnike';
      скрыто++;
    }
  }

  /* 2. Новые — с оглядкой на срок хранения (см. шапку: правило то же, что у
        уборки, иначе молчащий канал качался бы туда-сюда). */
  const порогХранения = isoМс(сейчасМс - ХРАНИТЬ_ДНЕЙ * 86400000);
  const объединение = записи.map((з) => ({ klyuch: з.klyuch, data: з.data }))
    .concat([...есть.values()].filter((р) => !наСтранице.has(р.klyuch) && !р.skryto).map((р) => ({ klyuch: р.klyuch, data: р.data })))
    .sort(поУбыванию);
  const место = new Map(объединение.map((з, i) => [з.klyuch, i]));
  const новые = записи.filter((з) => !есть.has(з.klyuch) && (з.data >= порогХранения || место.get(з.klyuch) < БЕЗ_СРОКА_ЗАПИСЕЙ));
  const заСроком = записи.filter((з) => !есть.has(з.klyuch)).length - новые.length;

  /* 3. Правки: окно 7 дней, по отпечатку текста. Скрытые не правим. */
  const порогПравок = isoМс(сейчасМс - ОКНО_ПРАВОК_ДНЕЙ * 86400000);
  const правки = записи.filter((з) => {
    const р = есть.get(з.klyuch);
    return р && !р.skryto && з.data >= порогПравок && р.tekst_hash !== з.tekst_hash;
  });

  /* 4. Картинки новых — только у площадки с картинками и только под
        согласием правообладателя. Без согласия адрес источника всё равно
        сохраняется: как только согласие будет записано, безКартинки() их подберёт. */
  const картинкиМожно = !!(разборщик.картинки && ист.soglasie_at && о.бакет);
  let картинок = 0, картинокОшибок = 0;
  for (const з of новые) { з.kartinka = null; з.kartinka_polnaya = null; з.kartinka_popytok = 0; }
  if (картинкиМожно) {
    for (const з of новые) {
      if (!з.kartinka_istochnika) continue;
      if (о.остаток() < МИН_ОСТАТОК_КАРТИНКИ_МС) break;      /* остальные — в следующий раз, попытка не тратится */
      try {
        const к = await картинкиВБакет(з, о);
        з.kartinka = к.kartinka; з.kartinka_polnaya = к.kartinka_polnaya; картинок++;
      } catch (e) {
        з.kartinka_popytok = 1; картинокОшибок++;
        console.warn('[lenta-sbor] ' + з.klyuch + ': ' + коротко(e && e.message || e, 200));
      }
    }
  }
  if (новые.length) await х.записать(новые);
  if (правки.length) await х.обновить(правки.map((з) => Object.assign({}, з, { obnovleno_at: сейчасISO })));

  /* 5. Вторые и третьи попытки за картинками; после третьей — насовсем. */
  if (картинкиМожно) {
    const ждут = await х.безКартинки(ист, КАРТИНКА_ПОПЫТОК, КАРТИНОК_ЗА_ЗАХОД);
    for (const з of ждут) {
      if (о.остаток() < МИН_ОСТАТОК_КАРТИНКИ_МС) break;
      const попыток = Number(з.kartinka_popytok) || 0;
      try {
        const к = await картинкиВБакет(Object.assign({ istochnik: ист.istochnik }, з), о);
        await х.картинка(з.klyuch, к.kartinka, к.kartinka_polnaya, попыток, сейчасISO); картинок++;
      } catch (e) {
        await х.картинка(з.klyuch, null, null, попыток + 1, сейчасISO); картинокОшибок++;
        console.warn('[lenta-sbor] ' + з.klyuch + ': попытка ' + (попыток + 1) + ': ' + коротко(e && e.message || e, 200));
      }
    }
  }

  /* 6. Скрытые (модератором через /lenta/skryt или сверкой) — объекты долой.
        Ручке доступ к бакету не нужен: убираем здесь по признаку skryto.
        403 на DELETE — нет права: строка «trevoga» в журнал источника раз в
        сутки, попытки не трогаем — как только право появится, уберём. */
  let объектовУдалено = 0, объектовНеУдалено = 0, безПрава = false;
  if (о.бакет) {
    const скрытые = await х.скрытыеСКартинками(ист);
    for (const р of скрытые) {
      try {
        await удалитьОбъекты(Object.assign({ istochnik: ист.istochnik }, р), о);
        await х.картинка(р.klyuch, null, null, КАРТИНКА_ПОПЫТОК, сейчасISO);
        объектовУдалено++;
      } catch (e) {
        объектовНеУдалено++;
        if (нетПрава(e)) безПрава = true;
        console.warn('[lenta-sbor] ' + р.klyuch + ': удаление объектов: ' + коротко(e && e.message || e, 200));
      }
    }
    if (безПрава) await тревогаБакета(о, ист.klyuch, объектовНеУдалено);
  }

  const свежая = записи.reduce((м, з) => (м && м > з.data ? м : з.data), null);
  const части = [];
  if (скрыто) части.push('скрыто ' + скрыто);
  if (воскрешено) части.push('воскрешено ' + воскрешено);
  if (правки.length) части.push('правок ' + правки.length);
  if (картинок) части.push('картинок ' + картинок);
  if (картинокОшибок) части.push('картинок не вышло ' + картинокОшибок);
  if (объектовУдалено) части.push('объектов удалено ' + объектовУдалено);
  if (объектовНеУдалено) части.push('объектов не удалено ' + объектовНеУдалено + (безПрава ? ' (нет права)' : ''));
  if (заСроком) части.push('за сроком ' + заСроком);
  const отброшеноВсего = Object.values(отб).reduce((а, n) => а + (n || 0), 0);
  if (отброшеноВсего) части.push('отброшено ' + Object.entries(отб).filter(([, n]) => n).map(([k, n]) => k + ' ' + n).join(', '));
  const изменилось = новые.length || правки.length || скрыто || воскрешено;
  return итог(ист, о, начало, изменилось ? 'ok' : 'pusto', части.length ? части.join('; ') : null, новые.length,
    { свежая, название: сырьё.название || null });
}

/* Состояние источника и строка журнала — при ЛЮБОМ исходе. Здесь же тревога:
   24 ч без удачи → строка «trevoga», не чаще раза в сутки. */
async function итог(ист, о, начало, исход, сообщение, новых, доп) {
  доп = доп || {};
  const сейчасМс = о.сейчас();
  const удача = исход === 'ok' || исход === 'pusto';
  const запись = {
    klyuch: ист.klyuch, ishod: исход, soobshchenie: сообщение ? коротко(сообщение, 300) : null, novyh: новых || 0,
    dlitelnost_ms: Math.max(0, Date.now() - начало), udacha: удача, otkuda: о.otkuda || 'timer',
    свежая: доп.свежая || null, название: доп.название || null,
  };
  let zapisej = null;
  try { zapisej = await о.хранилище.количество(ист); } catch (e) { zapisej = null; }
  await о.хранилище.состояние(ист, Object.assign({ zapisej, сейчасISO: isoМс(сейчасМс) }, запись));
  await о.хранилище.журнал(запись);
  if (!удача && исход !== 'propusk') {
    const безУдачиМс = ист.udacha_at
      ? сейчасМс - Date.parse(ист.udacha_at)
      : ((Number(ист.oshibok_podryad) || 0) + 1) * (Number(ист.period_min) || 15) * 60000;
    if (безУдачиМс >= ТРЕВОГА_ЧАСОВ * 3600000) {
      const была = await о.хранилище.тревогаБыла(ист.klyuch, isoМс(сейчасМс - ТРЕВОГА_ЧАСОВ * 3600000));
      if (!была) {
        await о.хранилище.журнал({ klyuch: ист.klyuch, ishod: 'trevoga', novyh: 0, dlitelnost_ms: 0, otkuda: запись.otkuda,
          soobshchenie: 'нет удачного опроса ' + Math.round(безУдачиМс / 3600000) + ' ч: ' + (запись.soobshchenie || исход) });
        запись.trevoga = true;
      }
    }
  }
  return запись;
}

/* ─── уборка раз в сутки ─────────────────────────────────────────────────── */
async function уборка(о, источники) {
  const х = о.хранилище;
  const сейчасМс = о.сейчас();
  const последняя = await х.последняяУборка();
  if (последняя && сейчасМс - Date.parse(последняя) < УБОРКА_РАЗ_В_ЧАСОВ * 3600000) return null;
  const начало = Date.now();
  const порог = isoМс(сейчасМс - ХРАНИТЬ_ДНЕЙ * 86400000);
  let удалено = 0, объектов = 0, неУдалено = 0, безПрава = false;
  for (const ист of источники) {
    if (о.остаток() < МИН_ОСТАТОК_МС) break;
    const строки = (await х.всеЗаписиКанала(ист)).slice().sort(поУбыванию);
    for (let i = БЕЗ_СРОКА_ЗАПИСЕЙ; i < строки.length; i++) {
      const р = строки[i];
      if (р.data >= порог) continue;
      /* Строка без объектов не удаляется: иначе копии в бакете осиротеют. */
      if (о.бакет && (р.kartinka || р.kartinka_polnaya)) {
        try { await удалитьОбъекты(Object.assign({ istochnik: ист.istochnik }, р), о); объектов++; }
        catch (e) {
          неУдалено++;
          if (нетПрава(e)) безПрава = true;
          console.warn('[lenta-sbor] уборка ' + р.klyuch + ': ' + коротко(e && e.message || e, 200));
          continue;
        }
      }
      await х.удалить(р.klyuch);
      удалено++;
    }
  }
  if (безПрава) await тревогаБакета(о, 'uborka', неУдалено);
  const журнала = await х.убратьЖурнал(isoМс(сейчасМс - ЖУРНАЛ_ДНЕЙ * 86400000));
  const запись = { klyuch: 'uborka', ishod: 'ok', novyh: 0, dlitelnost_ms: Date.now() - начало, otkuda: о.otkuda || 'timer',
    soobshchenie: 'удалено записей ' + удалено + ', объектов ' + объектов
      + (неУдалено ? ', объектов не удалено ' + неУдалено + (безПрава ? ' (нет права)' : '') : '')
      + ', строк журнала ' + (журнала == null ? '?' : журнала) };
  await х.журнал(запись);
  return запись;
}

/* ─── весь запуск ────────────────────────────────────────────────────────── */
async function сбор(о, задание) {
  задание = задание || {};
  const х = о.хранилище;
  const все = await х.источники();
  о.своиКаналы = все.filter((и) => и.istochnik === 'telegram').map((и) => и.kanal);
  о.otkuda = задание.otkuda || 'timer';
  const т = о.сейчас();

  let очередь;
  const отчёт = [];
  if (задание.istochnik) {
    const и = все.find((x) => x.klyuch === задание.istochnik);
    if (!и) return { всего: все.length, опрошено: 0, отчёт: [], ошибка: 'нет источника ' + задание.istochnik };
    if (!и.vklyuchen) { отчёт.push({ klyuch: и.klyuch, ishod: 'propusk', soobshchenie: 'источник выключен' }); очередь = []; }
    else очередь = [и];
  } else if (задание.vse) {
    очередь = все.filter((и) => и.vklyuchen);
  } else {
    очередь = все.filter((и) => и.vklyuchen && (!и.proveren_at || Date.parse(и.proveren_at) + (Number(и.period_min) || 15) * 60000 <= т));
  }
  /* Телеграм первым: у него самые живые каналы; если бюджет кончится, пусть
     отстанет Rutube. Внутри — кто дольше ждал. */
  очередь.sort((a, b) => ((a.istochnik === 'telegram' ? 0 : 1) - (b.istochnik === 'telegram' ? 0 : 1))
    || (Date.parse(a.proveren_at || 0) - Date.parse(b.proveren_at || 0)));

  let первый = true;
  for (const ист of очередь) {
    if (о.остаток() < МИН_ОСТАТОК_МС) { отчёт.push({ klyuch: ист.klyuch, ishod: 'propusk', soobshchenie: 'кончился бюджет времени' }); continue; }
    if (!первый && о.пауза) await о.пауза(ПАУЗА_МЕЖДУ_КАНАЛАМИ_МС);
    первый = false;
    try { отчёт.push(await собратьИсточник(ист, о)); }
    catch (e) {
      /* Сюда попадает только сбой самого хранилища: журнал мог не записаться,
         поэтому хотя бы в лог. */
      console.error('[lenta-sbor] ' + ист.klyuch, e);
      отчёт.push({ klyuch: ист.klyuch, ishod: 'oshibka', soobshchenie: коротко(e && e.message || e) });
    }
  }

  let убрано = null;
  if (!задание.istochnik) {
    try { убрано = await уборка(о, все); }
    catch (e) { console.error('[lenta-sbor] уборка', e); убрано = { ishod: 'oshibka', soobshchenie: коротко(e && e.message || e) }; }
  }
  return { всего: все.length, опрошено: очередь.length, отчёт, уборка: убрано };
}

/* ─── событие → задание ──────────────────────────────────────────────────── */
/* Таймер: { messages: [{ event_metadata: { event_type: '…TimerMessage' },
   details: { trigger_id, payload? } }] }. Ручной invoke: тело как есть
   ({"istochnik":"telegram:astronevod"} или {"vse":true}). HTTP-вызов (если
   маршрут будет заведён): тело запроса. */
function разобратьСобытие(event) {
  const з = { otkuda: 'ruchnoj' };
  let тело = null;
  if (event && Array.isArray(event.messages)) {
    з.otkuda = 'timer';
    const д = event.messages[0] && event.messages[0].details;
    if (д && typeof д.payload === 'string' && д.payload.trim()) { try { тело = JSON.parse(д.payload); } catch (e) { тело = null; } }
  } else if (event && event.httpMethod) {
    if (event.httpMethod === 'POST' && event.body) {
      try { тело = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); } catch (e) { return { ошибка: 'тело не JSON' }; }
    }
  } else if (event && typeof event === 'object') {
    тело = event;
  }
  if (тело && typeof тело === 'object') {
    if (тело.vse === true) з.vse = true;
    if (тело.istochnik != null) {
      const и = String(тело.istochnik).trim();
      if (!/^[a-z]+:[A-Za-z0-9_+\-]{1,80}$/.test(и)) return { ошибка: 'плохой istochnik' };
      з.istochnik = и;
    }
  }
  return з;
}

/* ─── вход функции ───────────────────────────────────────────────────────── */
exports.handler = async function handler(event, context) {
  const задание = разобратьСобытие(event);
  if (задание.ошибка) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: задание.ошибка }) };
  const о = await exports.окружениеОблака(context);
  const р = await сбор(о, задание);
  console.log('[lenta-sbor] ' + JSON.stringify(р));
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(р) };
};

/* ─── настоящие зависимости ──────────────────────────────────────────────── */
/* Сеть: глобальный fetch (nodejs22), честный User-Agent, без cookie и без
   подделки браузера; редиректы не следуем (закрытое превью t.me/s отвечает
   302 — это ошибка источника, а не страница). */
async function взятьИзСети(url, п) {
  п = п || {};
  const ctrl = new AbortController();
  const таймер = setTimeout(() => ctrl.abort(), п.срок || СРОК_ЗАПРОСА_МС);
  try {
    const ответ = await fetch(url, {
      headers: Object.assign({
        'user-agent': Р.АГЕНТ,
        'accept-language': 'ru,en;q=0.8',
        accept: п.байты ? 'image/jpeg,image/*;q=0.8,*/*;q=0.5' : 'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.5',
      }, п.заголовки || {}),
      redirect: 'manual',
      signal: ctrl.signal,
    });
    const тип = ответ.headers.get('content-type') || '';
    const куда = ответ.headers.get('location') || undefined;
    if (п.байты) {
      const длина = Number(ответ.headers.get('content-length') || 0);
      if (п.максБайт && длина > п.максБайт) throw new Error('картинка: ' + длина + ' байт по Content-Length, больше предела');
      const тело = ответ.status === 200 ? Buffer.from(await ответ.arrayBuffer()) : null;
      return { статус: ответ.status, тип, тело, куда };
    }
    return { статус: ответ.status, тип, текст: ответ.status === 200 ? await ответ.text() : '', куда };
  } finally {
    clearTimeout(таймер);
  }
}

/* Бакет через IAM-токен функции, без ключей в окружении. Документированный
   способ для Object Storage — «Authorization: Bearer <IAM-токен>»
   (storage/api-ref/authentication); X-YaCloud-SubjectToken — прежний
   заголовок из старых описаний, шлём его рядом на переходный период: лишний
   заголовок площадка не замечает, а без Bearer каждый PUT мог бы отдать 403 и
   сжечь все три попытки. Объекты публичны по настройке бакета (анонимное
   чтение). Удаление объектов требует роли storage.editor у сервисного
   аккаунта — uploader объекты не удаляет. */
function бакетОблака(п) {
  const основа = 'https://storage.yandexcloud.net/' + п.имя + '/';
  const заголовок = () => {
    if (!п.токен) throw new Error('бакет: нет токена сервисного аккаунта (context.token)');
    return { Authorization: 'Bearer ' + п.токен, 'X-YaCloud-SubjectToken': п.токен };
  };
  return {
    адрес: (ключ) => основа + ключ,
    async положить(ключ, тело, тип) {
      const р = await fetch(основа + ключ, {
        method: 'PUT',
        headers: Object.assign(заголовок(), { 'Content-Type': тип || 'image/jpeg', 'Cache-Control': CACHE_CONTROL_КАРТИНОК, 'Content-Length': String(тело.length) }),
        body: тело,
        signal: AbortSignal.timeout(СРОК_КАРТИНКИ_МС),
      });
      if (р.status !== 200) throw new Error('бакет PUT ' + р.status + ' ' + коротко(await р.text().catch(() => ''), 120));
    },
    async удалить(ключ) {
      const р = await fetch(основа + ключ, { method: 'DELETE', headers: заголовок(), signal: AbortSignal.timeout(СРОК_КАРТИНКИ_МС) });
      if (р.status !== 204 && р.status !== 200 && р.status !== 404) {
        const e = new Error('бакет DELETE ' + р.status);
        e.код = р.status;          /* 403 сборщик отличает от сетевого сбоя: нет права */
        throw e;
      }
    },
  };
}

/* Слой YDB. Все запросы — параметрами через TypedValues; Timestamp — литералом
   без долей секунды (репозиторий обходит параметры-Timestamp, см. access.js).
   Читаем не больше 1000 строк на запрос — потолок ответа YDB; у канала
   строк сотни, этого хватает. */
function хранилищеYDB(drv, ydb) {
  const { TypedValues, Types } = ydb;
  const txt = (v) => (v == null ? null : (v.textValue ?? null));
  const num = (v) => { const x = v?.uint64Value ?? v?.uint32Value ?? v?.int64Value ?? v?.int32Value; return x == null ? null : Number(String(x)); };
  const ts = (v) => { const x = v?.uint64Value ?? v?.int64Value; return x == null ? null : new Date(Number(String(x)) / 1000).toISOString(); };
  const bool = (v) => !!(v && v.boolValue);
  const u = (v) => TypedValues.utf8(String(v));
  const uOpt = (v) => (v == null || v === '' ? TypedValues.optionalNull(Types.UTF8) : TypedValues.optional(TypedValues.utf8(String(v))));
  const u32 = (v) => TypedValues.uint32(Math.max(0, Number(v) || 0));
  const u32Opt = (v) => (v == null ? TypedValues.optionalNull(Types.UINT32) : TypedValues.optional(TypedValues.uint32(Math.max(0, Number(v) || 0))));
  const u64 = (v) => TypedValues.uint64(Math.max(0, Number(v) || 0));
  const b = (v) => TypedValues.bool(!!v);

  async function запрос(sql, params) {
    let строки = [];
    await drv.tableClient.withSession(async (s) => {
      const r = await s.executeQuery(sql, params || {});
      строки = (r.resultSets && r.resultSets[0] && r.resultSets[0].rows) || [];
    });
    return строки;
  }
  const канал = (ист) => ({ '$i': u(ист.istochnik), '$k': u(ист.kanal) });
  const КАНАЛ = 'DECLARE $i AS Utf8; DECLARE $k AS Utf8;';

  return {
    async источники() {
      const строки = await запрос(`SELECT klyuch, istochnik, kanal, adres, nazvanie, upravlenie, upravleniya, vklyuchen, period_min,
        soglasie_at, vedushchij, proveren_at, udacha_at, oshibok_podryad, poslednyaya_publikaciya, zapisej FROM lenta_istochniki;`);
      return строки.map((r) => { const и = r.items; return {
        klyuch: txt(и[0]), istochnik: txt(и[1]), kanal: txt(и[2]), adres: txt(и[3]), nazvanie: txt(и[4]),
        upravlenie: txt(и[5]), upravleniya: txt(и[6]), vklyuchen: bool(и[7]), period_min: num(и[8]) || 15,
        soglasie_at: ts(и[9]), vedushchij: txt(и[10]), proveren_at: ts(и[11]), udacha_at: ts(и[12]),
        oshibok_podryad: num(и[13]) || 0, poslednyaya_publikaciya: ts(и[14]), zapisej: num(и[15]),
      }; });
    },
    async записиКанала(ист, отISO) {
      const строки = await запрос(`${КАНАЛ}
        SELECT klyuch, data, tekst_hash, skryto, kartinka, kartinka_polnaya, kartinka_popytok, kartinka_istochnika, skryto_prichina
        FROM lenta_publikacii VIEW lenta_publikacii_po_kanalu
        WHERE istochnik = $i AND kanal = $k AND data >= ${tsЛит(отISO)} LIMIT 1000;`, канал(ист));
      return строки.map((r) => { const и = r.items; return {
        klyuch: txt(и[0]), data: сек(ts(и[1])), tekst_hash: txt(и[2]), skryto: bool(и[3]),
        kartinka: txt(и[4]), kartinka_polnaya: txt(и[5]), kartinka_popytok: num(и[6]) || 0, kartinka_istochnika: txt(и[7]),
        skryto_prichina: txt(и[8]),
      }; });
    },
    async записать(записи) {
      await drv.tableClient.withSession(async (s) => {
        for (const з of записи) {
          await s.executeQuery(`
            DECLARE $klyuch AS Utf8; DECLARE $istochnik AS Utf8; DECLARE $kanal AS Utf8; DECLARE $id AS Utf8;
            DECLARE $upravlenie AS Utf8; DECLARE $upravleniya AS Optional<Utf8>; DECLARE $tip AS Utf8;
            DECLARE $zagolovok AS Utf8; DECLARE $tekst AS Optional<Utf8>; DECLARE $ssylka AS Utf8;
            DECLARE $kartinka AS Optional<Utf8>; DECLARE $kartinka_polnaya AS Optional<Utf8>; DECLARE $kartinka_istochnika AS Optional<Utf8>;
            DECLARE $kartinka_popytok AS Uint32; DECLARE $kartinok AS Uint32; DECLARE $dlitelnost_s AS Optional<Uint32>;
            DECLARE $bez_prevyu AS Bool; DECLARE $ssylka_v_zapisi AS Optional<Utf8>; DECLARE $tekst_hash AS Utf8;
            UPSERT INTO lenta_publikacii (klyuch, istochnik, kanal, id, data, upravlenie, upravleniya, tip, zagolovok, tekst, ssylka,
              kartinka, kartinka_polnaya, kartinka_istochnika, kartinka_popytok, kartinok, dlitelnost_s, bez_prevyu, ssylka_v_zapisi,
              skryto, tekst_hash, sobrano_at, obnovleno_at)
            VALUES ($klyuch, $istochnik, $kanal, $id, ${tsЛит(з.data)}, $upravlenie, $upravleniya, $tip, $zagolovok, $tekst, $ssylka,
              $kartinka, $kartinka_polnaya, $kartinka_istochnika, $kartinka_popytok, $kartinok, $dlitelnost_s, $bez_prevyu, $ssylka_v_zapisi,
              false, $tekst_hash, ${tsЛит(з.sobrano_at)}, ${tsЛит(з.obnovleno_at)});`, {
            '$klyuch': u(з.klyuch), '$istochnik': u(з.istochnik), '$kanal': u(з.kanal), '$id': u(з.id),
            '$upravlenie': u(з.upravlenie), '$upravleniya': uOpt(з.upravleniya), '$tip': u(з.tip),
            '$zagolovok': u(з.zagolovok || ''), '$tekst': uOpt(з.tekst), '$ssylka': u(з.ssylka),
            '$kartinka': uOpt(з.kartinka), '$kartinka_polnaya': uOpt(з.kartinka_polnaya), '$kartinka_istochnika': uOpt(з.kartinka_istochnika),
            '$kartinka_popytok': u32(з.kartinka_popytok), '$kartinok': u32(з.kartinok), '$dlitelnost_s': u32Opt(з.dlitelnost_s),
            '$bez_prevyu': b(з.bez_prevyu), '$ssylka_v_zapisi': uOpt(з.ssylka_v_zapisi), '$tekst_hash': u(з.tekst_hash),
          });
        }
      });
    },
    async обновить(записи) {
      await drv.tableClient.withSession(async (s) => {
        for (const з of записи) {
          await s.executeQuery(`
            DECLARE $klyuch AS Utf8; DECLARE $tip AS Utf8; DECLARE $zagolovok AS Utf8; DECLARE $tekst AS Optional<Utf8>;
            DECLARE $kartinok AS Uint32; DECLARE $ssylka_v_zapisi AS Optional<Utf8>; DECLARE $tekst_hash AS Utf8;
            UPDATE lenta_publikacii SET tip = $tip, zagolovok = $zagolovok, tekst = $tekst, kartinok = $kartinok,
              ssylka_v_zapisi = $ssylka_v_zapisi, tekst_hash = $tekst_hash, obnovleno_at = ${tsЛит(з.obnovleno_at)}
            WHERE klyuch = $klyuch;`, {
            '$klyuch': u(з.klyuch), '$tip': u(з.tip), '$zagolovok': u(з.zagolovok || ''), '$tekst': uOpt(з.tekst),
            '$kartinok': u32(з.kartinok), '$ssylka_v_zapisi': uOpt(з.ssylka_v_zapisi), '$tekst_hash': u(з.tekst_hash),
          });
        }
      });
    },
    async скрыть(klyuch, причина, сейчасISO) {
      await запрос(`DECLARE $klyuch AS Utf8; DECLARE $prichina AS Utf8;
        UPDATE lenta_publikacii SET skryto = true, skryto_prichina = $prichina, skryto_at = ${tsЛит(сейчасISO)}, obnovleno_at = ${tsЛит(сейчасISO)}
        WHERE klyuch = $klyuch;`, { '$klyuch': u(klyuch), '$prichina': u(причина) });
    },
    /* Снять авто-скрытие: запись снова читается со страницы. Попытки за
       картинками обнуляются — объекты уже удалены, их надо собрать заново.
       Пустые значения — типизированные Nothing(T?): голый NULL в YQL типа не имеет. */
    async показать(klyuch, сейчасISO) {
      await запрос(`DECLARE $klyuch AS Utf8;
        UPDATE lenta_publikacii SET skryto = false, skryto_prichina = Nothing(Utf8?), skryto_at = Nothing(Timestamp?),
               kartinka_popytok = 0u, obnovleno_at = ${tsЛит(сейчасISO)}
        WHERE klyuch = $klyuch;`, { '$klyuch': u(klyuch) });
    },
    async картинка(klyuch, m, p, попыток, сейчасISO) {
      await запрос(`DECLARE $klyuch AS Utf8; DECLARE $kartinka AS Optional<Utf8>; DECLARE $kartinka_polnaya AS Optional<Utf8>; DECLARE $popytok AS Uint32;
        UPDATE lenta_publikacii SET kartinka = $kartinka, kartinka_polnaya = $kartinka_polnaya, kartinka_popytok = $popytok, obnovleno_at = ${tsЛит(сейчасISO)}
        WHERE klyuch = $klyuch;`,
        { '$klyuch': u(klyuch), '$kartinka': uOpt(m), '$kartinka_polnaya': uOpt(p), '$popytok': u32(попыток) });
    },
    async безКартинки(ист, макс, предел) {
      const строки = await запрос(`${КАНАЛ} DECLARE $maks AS Uint32;
        SELECT klyuch, kartinka_istochnika, kartinka_popytok FROM lenta_publikacii VIEW lenta_publikacii_po_kanalu
        WHERE istochnik = $i AND kanal = $k AND kartinka IS NULL AND kartinka_istochnika IS NOT NULL
          AND COALESCE(kartinka_popytok, 0u) < $maks AND COALESCE(skryto, false) = false
        ORDER BY data DESC LIMIT ${Math.max(1, Math.min(100, Number(предел) || КАРТИНОК_ЗА_ЗАХОД))};`,
        Object.assign(канал(ист), { '$maks': u32(макс) }));
      return строки.map((r) => ({ klyuch: txt(r.items[0]), kartinka_istochnika: txt(r.items[1]), kartinka_popytok: num(r.items[2]) || 0 }));
    },
    async скрытыеСКартинками(ист) {
      const строки = await запрос(`${КАНАЛ}
        SELECT klyuch, kartinka, kartinka_polnaya FROM lenta_publikacii VIEW lenta_publikacii_po_kanalu
        WHERE istochnik = $i AND kanal = $k AND skryto = true AND (kartinka IS NOT NULL OR kartinka_polnaya IS NOT NULL) LIMIT 50;`, канал(ист));
      return строки.map((r) => ({ klyuch: txt(r.items[0]), kartinka: txt(r.items[1]), kartinka_polnaya: txt(r.items[2]) }));
    },
    async количество(ист) {
      const строки = await запрос(`${КАНАЛ}
        SELECT COUNT(*) AS n FROM lenta_publikacii VIEW lenta_publikacii_po_kanalu
        WHERE istochnik = $i AND kanal = $k AND COALESCE(skryto, false) = false;`, канал(ист));
      return строки.length ? (num(строки[0].items[0]) || 0) : 0;
    },
    /* Везде UPDATE, а не UPSERT части колонок: YDB требует в UPSERT все
       NOT NULL колонки строки («Missing not null column in input: adres») —
       на этом упал первый заход 05.09.2026, и итоги источников не писались,
       а настоящие исходы каналов были скрыты этой ошибкой. Строка источника
       всегда есть (её читали), строка публикации — тоже (её писали целиком). */
    async состояние(ист, з) {
      const поля = ['proveren_at = ' + tsЛит(з.сейчасISO), 'oshibka = $oshibka', 'oshibok_podryad = $podryad', 'obnovleno_at = ' + tsЛит(з.сейчасISO)];
      const параметры = {
        '$klyuch': u(ист.klyuch),
        '$oshibka': uOpt(з.udacha ? null : (з.soobshchenie || з.ishod)),
        '$podryad': u32(з.udacha ? 0 : (Number(ист.oshibok_podryad) || 0) + 1),
      };
      let объявления = 'DECLARE $klyuch AS Utf8; DECLARE $oshibka AS Optional<Utf8>; DECLARE $podryad AS Uint32;';
      if (з.udacha) поля.push('udacha_at = ' + tsЛит(з.сейчасISO));
      if (з.название) { поля.push('nazvanie = $nazvanie'); параметры['$nazvanie'] = u(з.название); объявления += ' DECLARE $nazvanie AS Utf8;'; }
      const свежая = з.свежая && (!ист.poslednyaya_publikaciya || з.свежая > сек(ист.poslednyaya_publikaciya)) ? з.свежая : null;
      if (свежая) поля.push('poslednyaya_publikaciya = ' + tsЛит(свежая));
      if (з.zapisej != null) { поля.push('zapisej = $zapisej'); параметры['$zapisej'] = u64(з.zapisej); объявления += ' DECLARE $zapisej AS Uint64;'; }
      await запрос(`${объявления}
        UPDATE lenta_istochniki SET ${поля.join(', ')} WHERE klyuch = $klyuch;`, параметры);
    },
    async журнал(з) {
      await запрос(`DECLARE $k AS Utf8; DECLARE $ishod AS Utf8; DECLARE $s AS Optional<Utf8>; DECLARE $d AS Uint32; DECLARE $n AS Uint32; DECLARE $otkuda AS Optional<Utf8>;
        UPSERT INTO lenta_zhurnal (istochnik_klyuch, at, ishod, soobshchenie, dlitelnost_ms, novyh, otkuda)
        VALUES ($k, CurrentUtcTimestamp(), $ishod, $s, $d, $n, $otkuda);`, {
        '$k': u(з.klyuch), '$ishod': u(з.ishod), '$s': uOpt(з.soobshchenie), '$d': u32(з.dlitelnost_ms), '$n': u32(з.novyh), '$otkuda': uOpt(з.otkuda),
      });
    },
    async последняяУборка() {
      const строки = await запрос(`DECLARE $k AS Utf8;
        SELECT MAX(at) AS at FROM lenta_zhurnal WHERE istochnik_klyuch = $k;`, { '$k': u('uborka') });
      return строки.length ? ts(строки[0].items[0]) : null;
    },
    /* префикс — начало сообщения: тревога «нет удачного опроса» и тревога
       «бакет: нет права» считаются порознь, иначе одна глушила бы другую. */
    async тревогаБыла(klyuch, сISO, префикс) {
      const где = префикс ? ' AND soobshchenie LIKE $p' : '';
      const параметры = { '$k': u(klyuch), '$ishod': u('trevoga') };
      if (префикс) параметры['$p'] = u(String(префикс).replace(/[%_]/g, '') + '%');
      const строки = await запрос(`DECLARE $k AS Utf8; DECLARE $ishod AS Utf8;${префикс ? ' DECLARE $p AS Utf8;' : ''}
        SELECT at FROM lenta_zhurnal WHERE istochnik_klyuch = $k AND ishod = $ishod AND at >= ${tsЛит(сISO)}${где} LIMIT 1;`,
        параметры);
      return строки.length > 0;
    },
    async всеЗаписиКанала(ист) {
      const строки = await запрос(`${КАНАЛ}
        SELECT klyuch, data, skryto, kartinka, kartinka_polnaya FROM lenta_publikacii VIEW lenta_publikacii_po_kanalu
        WHERE istochnik = $i AND kanal = $k LIMIT 1000;`, канал(ист));
      return строки.map((r) => ({ klyuch: txt(r.items[0]), data: сек(ts(r.items[1])), skryto: bool(r.items[2]), kartinka: txt(r.items[3]), kartinka_polnaya: txt(r.items[4]) }));
    },
    async удалить(klyuch) {
      await запрос(`DECLARE $k AS Utf8; DELETE FROM lenta_publikacii WHERE klyuch = $k;`, { '$k': u(klyuch) });
    },
    async убратьЖурнал(доISO) {
      /* Через индекс по at и пачками по 500: полный скан журнала (тысячи
         строк за 30 дней) и большая транзакция удаления здесь ни к чему. */
      let всего = 0;
      for (let i = 0; i < 5; i++) {
        const n = await запрос(`SELECT COUNT(*) AS n FROM lenta_zhurnal VIEW lenta_zhurnal_po_at WHERE at < ${tsЛит(доISO)};`);
        const сколько = n.length ? (num(n[0].items[0]) || 0) : 0;
        if (!сколько) break;
        await запрос(`DELETE FROM lenta_zhurnal ON SELECT istochnik_klyuch, at FROM lenta_zhurnal VIEW lenta_zhurnal_po_at WHERE at < ${tsЛит(доISO)} LIMIT 500;`);
        всего += Math.min(500, сколько);
        if (сколько <= 500) break;
      }
      return всего;
    },
  };
}

let драйвер = null;
async function драйверYDB(ydb) {
  if (драйвер) return драйвер;
  const d = new ydb.Driver({
    endpoint: process.env.YDB_ENDPOINT,
    database: process.env.YDB_DATABASE,
    authService: ydb.getCredentialsFromEnv(),
  });
  /* В кэш — только после успешной готовности (как в submit.js): неудачная
     инициализация не должна залипать в тёплом экземпляре. */
  if (!await d.ready(10000)) {
    try { await d.destroy(); } catch (e) { /* уже мёртв */ }
    throw new Error('YDB not ready');
  }
  драйвер = d;
  return драйвер;
}

exports.окружениеОблака = async function окружениеОблака(context) {
  const ydb = require('ydb-sdk');
  const drv = await драйверYDB(ydb);
  const токен = context && context.token && context.token.access_token;
  return {
    хранилище: хранилищеYDB(drv, ydb),
    взять: взятьИзСети,
    бакет: бакетОблака({ имя: process.env.LENTA_BUCKET || 'yasnalab.ru', токен }),
    сейчас: () => Date.now(),
    остаток: () => (context && typeof context.getRemainingTimeInMillis === 'function' ? context.getRemainingTimeInMillis() : 120000),
    пауза: (мс) => new Promise((р) => setTimeout(р, мс)),
  };
};

exports.сбор = сбор;
exports.собратьИсточник = собратьИсточник;
exports.уборка = уборка;
exports.нормализовать = нормализовать;
exports.пережать = пережать;
exports.уменьшить = уменьшить;
exports.этоJPEG = этоJPEG;
exports.ключиБакета = ключиБакета;
exports.картинкиВБакет = картинкиВБакет;
exports.разобратьСобытие = разобратьСобытие;
exports.хранилищеYDB = хранилищеYDB;
exports.бакетОблака = бакетОблака;
exports.взятьИзСети = взятьИзСети;
exports.tsЛит = tsЛит;
exports.КОНСТАНТЫ = { СРОК_ЗАПРОСА_МС, МИН_ОСТАТОК_МС, МИН_ОСТАТОК_КАРТИНКИ_МС, ОКНО_ПРАВОК_ДНЕЙ, ХРАНИТЬ_ДНЕЙ, БЕЗ_СРОКА_ЗАПИСЕЙ, ЖУРНАЛ_ДНЕЙ, УБОРКА_РАЗ_В_ЧАСОВ, ТРЕВОГА_ЧАСОВ, КАРТИНКА_ПОПЫТОК, МИНИАТЮРА_PX, ПОЛНАЯ_PX, КАЧЕСТВО_JPEG, ПРЕФИКС_БАКЕТА, CACHE_CONTROL_КАРТИНОК };
