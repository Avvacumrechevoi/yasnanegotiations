/* ═══════════════════════════════════════════════════════════════════════════
   РАЗБОРЩИКИ ЛЕНТЫ УПРАВЛЕНИЙ: страница превью Телеграма и RSS Rutube →
   единый вид записи. CommonJS, без зависимостей; сети здесь нет — модуль
   получает уже скачанное тело и отдаёт записи, признаки здоровья разметки и
   счётчики отброшенного. Кто ходит в сеть — lenta-sbor.js.

   ЕДИНЫЙ ВИД ЗАПИСИ (то, что дальше ложится в lenta_publikacii):
     { id, data (ISO UTC до секунды), tip ∈ tekst|foto|video|ssylka|statya|anons,
       zagolovok (≤120, '' если заголовка нет), tekst (≤400 | null), ssylka,
       kartinka_istochnika (адрес превью у источника | null), kartinok,
       dlitelnost_s (| null), bez_prevyu, ssylka_v_zapisi (только хост | null),
       tekst_hash }

   ПРАВИЛА, КОТОРЫЕ ЗДЕСЬ ЖИВУТ (условия выкатки из отчёта §5):
     • запись без валидной даты ОТБРАСЫВАЕТСЯ, а не получает 1970 год;
     • чужие репосты не собираются; свои схлопываются к оригиналу (тоже
       пропуск: оригинал собирается из своего канала);
     • стоп-слова ЧУЖОЙ рекламы (erid как целое слово, реклам-, партнёрск-,
       промокод) — пропуск; «erid» ищется словом, иначе ловится «meridian» в
       почте 38_meridian@inbox.ru (так и было в первом прогоне). Слова
       «скидка» в стоп-словах НЕТ (решение владельца 8.8): управления сами
       пишут «для детей скидка на натурный урок», и такие записи — свои
       анонсы, а не чужая реклама; они помечаются типом anons;
     • запись без содержания (пустой текст с картинкой; только приветствие и
       ссылка) — «Фото» / «Запись со ссылкой» без выдержки; совсем пустая —
       пропуск;
     • премиум-эмодзи вместо буквы в первой строке («🔠егодня»: за эмодзи
       без пробела идёт строчная буква) — без заголовка: zagolovok = '',
       остаётся выдержка. Эмодзи-украшение («⚡️ Приглашаем», «🌞Друзья»)
       заголовка не отнимает;
     • цена, скидка или «Записаться» — tip anons;
     • ссылка на чужой домен (не центр) — картинка превью ссылки не берётся,
       остаётся только хост в ssylka_v_zapisi;
     • Rutube: только заголовок, длительность, ссылка и дата из официального
       RSS; ни кадров, ни описаний (условия площадки, п. 2.4). Дата в RSS —
       дата загрузки ролика (created), а не «выкладки»: у перезалитых уроков
       она честнее.

   ЗДОРОВЬЕ РАЗМЕТКИ. Частичная смена вёрстки Телеграма проходила как «ok»:
   пропажа datetime давала 20 записей 1970 года, переименование класса текста
   — 20 пустых «Фото». Поэтому разборщик считает доли записей без даты, без
   текста и без картинки при наличии photo_wrap; сборщик при доле > 50 % на
   живой странице ставит исход «oshibka: разметка частично» и пачку не пишет.
   Отсутствие контейнера текста у ВСЕХ записей считается поломкой только
   вместе с пустыми записями: канал из одних фотографий без подписей
   разобран целиком и здоров (остаток F01, см. здоровьеПлохое).
   Признак «пусто» — по структуре (все data-post служебные), не по строке
   «Channel created».
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const crypto = require('crypto');

const АГЕНТ = 'YasnaLenta/1.0 (+https://yasnalab.ru)';
const ЗАГОЛОВОК_МАКС = 120;
const ТЕКСТ_МАКС = 400;
const ТИПЫ = ['tekst', 'foto', 'video', 'ssylka', 'statya', 'anons'];
const ПОРОГ_ЗДОРОВЬЯ = 0.5;
const МИН_ЗАПИСЕЙ_ДЛЯ_ПОРОГА = 3;
/* Домены центра: превью ссылки на них — своё содержание, его копировать
   можно; всё остальное — чужое, остаётся хостом в ssylka_v_zapisi. */
const ДОМЕНЫ_ЦЕНТРА = ['yasna.center', 'yasnalab.ru', 'zolotoj-yasen.ru', 'yasna-shkola.ru', 't.me'];
/* Стоп-слова — признаки ЧУЖОЙ рекламы. «Скидк-» отсюда убрано (решение
   владельца, ревью 8.8): собственный анонс управления «для детей скидка на
   натурный урок» — не реклама, а событие центра, и терять его нельзя. */
const СТОП_СЛОВА = [/(^|[^a-zа-яё0-9_])erid([^a-zа-яё0-9_]|$)/i, /реклам/i, /партн[её]рск/i, /промокод/i];
/* Признаки собственного анонса: зовут записаться, называют цену или скидку. */
const ПРИЗНАКИ_АНОНСА = [/записаться|записывайтесь|запись по ссылке|запись обязательна|регистрация по ссылке|зарегистрир/i, /\d\s*(₽|руб\.|руб\b|рублей|р\.)/i, /скидк/i, /\bцена\b|стоимость/i];
/* Приветствие ищем ТОЛЬКО в начале строки, пропуская знаки и эмодзи, но не
   буквы: прежнее \W* без флага u не считало кириллицу буквой и находило
   «дорог» внутри «изучаем старинные дороги Москвы» — содержательная строка
   объявлялась приветствием и пропадала (ревью 8.8, F06). */
const ПРИВЕТСТВИЕ = /^[^\p{L}\p{N}]*(дорог|здравств|добр(ый|ого|ое|ой)|привет|друзья|товарищ)/iu;

/* ─── текст ──────────────────────────────────────────────────────────────── */
const СУЩНОСТИ = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…' };

function раскодировать(с) {
  return String(с == null ? '' : с).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (вся, имя) => {
    const и = имя.toLowerCase();
    if (СУЩНОСТИ[и] !== undefined) return СУЩНОСТИ[и];
    try {
      if (/^#x/.test(и)) return String.fromCodePoint(parseInt(и.slice(2), 16));
      if (/^#/.test(и)) return String.fromCodePoint(parseInt(и.slice(1), 10));
    } catch (e) { /* кривой код — оставляем как есть */ }
    return вся;
  });
}

/* HTML текста сообщения → простой текст с переводами строк. Эмодзи Телеграма
   (<i class="emoji"><b>…</b></i>, в том числе внутри <tg-emoji>) остаются
   символами. */
function вТекст(html) {
  if (!html) return '';
  const т = String(html)
    .replace(/<i class="emoji"[^>]*><b>([^<]*)<\/b><\/i>/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return раскодировать(т).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* Управляющие байты вычищаем всегда: они делают строку «бинарной» для grep и
   инструментов и в таблице никому не нужны. Класс записан escape-кодами —
   сырые байты в исходнике запрещает deploy-backend.sh. */
function чистая(с) {
  return String(с == null ? '' : с).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

function однойСтрокой(с) {
  return чистая(с).replace(/\s+/g, ' ').trim();
}

/* Обрезка по слову с «…»: если пробел слишком далеко от края — режем по знаку. */
function обрезатьПоСлову(с, предел) {
  с = однойСтрокой(с);
  if (с.length <= предел) return с;
  const кусок = с.slice(0, предел - 1);
  const пробел = кусок.lastIndexOf(' ');
  return (пробел > предел * 0.6 ? кусок.slice(0, пробел) : кусок).replace(/[\s,:;\-–—(«"']+$/, '') + '…';
}

function безАдресов(с) {
  return String(с || '').replace(/https?:\/\/\S+/gi, ' ').replace(/(^|\s)www\.\S+/gi, ' ');
}

function хост(url) {
  try { return new URL(String(url)).host.replace(/^www\./, '').toLowerCase() || null; } catch (e) { return null; }
}

function свойДомен(h) {
  if (!h) return false;
  return ДОМЕНЫ_ЦЕНТРА.some((д) => h === д || h.endsWith('.' + д));
}

function естьСтопСлова(текст) {
  const т = String(текст || '');
  return СТОП_СЛОВА.some((р) => р.test(т));
}

function похожеНаАнонс(текст) {
  const т = String(текст || '');
  return ПРИЗНАКИ_АНОНСА.some((р) => р.test(т));
}

/* Дата к секунде в UTC; невалидная → null (никаких new Date(null) = 1970).
   «Сейчас» передаётся снаружи, чтобы прогон был воспроизводим. */
function датаISO(с, сейчасМс) {
  if (!с) return null;
  const т = Date.parse(String(с).trim());
  const теперь = Number.isFinite(сейчасМс) ? сейчасМс : Date.now();
  if (!Number.isFinite(т) || т < Date.UTC(2000, 0, 1) || т > теперь + 366 * 86400000) return null;
  return new Date(т).toISOString().slice(0, 19) + 'Z';
}

function хешТекста(з) {
  return crypto.createHash('sha1').update([з.tip, з.zagolovok, з.tekst || '', String(з.kartinok || 0)].join('\n')).digest('hex').slice(0, 16);
}

/* «Есть ли содержание»: без адресов, упоминаний, хэштегов, эмодзи и
   приветственных строк остаётся ли хоть дюжина букв. */
function содержательныйТекст(полный) {
  return String(полный || '')
    .split('\n')
    .filter((с) => !(ПРИВЕТСТВИЕ.test(с) && с.trim().length <= 60))
    .join('\n')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/(^|\s)[@#]\S+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/* Длительность «1:03» / «1:02:03» → секунды. */
function длительность(с) {
  if (!с) return null;
  const ч = String(с).trim().split(':').map((x) => parseInt(x, 10));
  if (!ч.length || ч.some((x) => !Number.isFinite(x))) return null;
  return ч.reduce((а, x) => а * 60 + x, 0) || null;
}

/* ─── robots.txt ─────────────────────────────────────────────────────────── */
/* Минимальный разбор: группа для нашего агента, иначе для «*»; правило —
   самое длинное совпадение, Allow при равной длине побеждает. Нет файла (404)
   или нет правил — можно. */
function роботРазрешает(текстRobots, путь, агент) {
  if (!текстRobots) return true;
  const имя = String(агент || АГЕНТ).split('/')[0].toLowerCase();
  const группы = [];
  let текущая = null;
  for (const сырая of String(текстRobots).split(/\r?\n/)) {
    const строка = сырая.replace(/#.*$/, '').trim();
    if (!строка) continue;
    const м = строка.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!м) continue;
    const поле = м[1].toLowerCase(), значение = м[2].trim();
    if (поле === 'user-agent') {
      if (!текущая || текущая.правила.length) { текущая = { агенты: [], правила: [] }; группы.push(текущая); }
      текущая.агенты.push(значение.toLowerCase());
    } else if ((поле === 'disallow' || поле === 'allow') && текущая) {
      текущая.правила.push({ разрешить: поле === 'allow', путь: значение });
    }
  }
  const своя = группы.find((г) => г.агенты.some((а) => а !== '*' && имя.includes(а)))
    || группы.find((г) => г.агенты.includes('*'));
  if (!своя) return true;
  let лучшее = null;
  for (const п of своя.правила) {
    if (!п.путь) continue;
    const шаблон = п.путь.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const регулярка = new RegExp('^' + шаблон);
    if (!регулярка.test(путь)) continue;
    if (!лучшее || п.путь.length > лучшее.путь.length || (п.путь.length === лучшее.путь.length && п.разрешить)) лучшее = п;
  }
  return !лучшее || лучшее.разрешить;
}

/* ─── Телеграм: превью t.me/s/<канал> ────────────────────────────────────── */
function вырезать(html, регулярка) {
  const м = html.match(регулярка);
  return м ? м[1] : undefined;
}

function блокиТелеграма(html) {
  return String(html).split(/(?=<div class="tgme_widget_message_wrap)/).filter((ч) => ч.startsWith('<div class="tgme_widget_message_wrap'));
}

function шапкаТелеграма(html) {
  const название = вТекст(вырезать(html, /<meta property="og:title" content="([^"]*)"/) || '');
  return { название: название || null };
}

/* Заголовок: первая содержательная строка (строки из одной ссылки или
   упоминания пропускаем). Возвращает { текст, премиум } — премиум=true, если
   в этой строке премиум-эмодзи стоит вплотную к букве. */
function перваяСтрока(текстHtml) {
  const строки = String(текстHtml || '').split(/<br\s*\/?>/i);
  for (const сыраяHtml of строки) {
    const т = вТекст(сыраяHtml).replace(/\n+/g, ' ').trim();
    if (т.length <= 1) continue;
    if (/^(https?:\/\/\S+|@\S+)$/i.test(т)) continue;
    /* «Вместо буквы» — когда сразу за премиум-эмодзи без пробела идёт
       строчная буква («🔠егодня»): слово с пропавшей заглавной. Эмодзи,
       приклеенный к слову с заглавной («🌞Друзья»), — украшение, заголовок
       остаётся. */
    const премиум = /<\/tg-emoji>\p{Ll}/u.test(сыраяHtml);
    return { текст: т, премиум };
  }
  return { текст: '', премиум: false };
}

function разобратьБлокТелеграма(блок, ист, о) {
  const здоровье = о.здоровье, отброшено = о.отброшено;
  const пост = вырезать(блок, /data-post="([^"]+)"/);
  if (!пост) return null;
  const id = пост.split('/')[1];
  /* Всё, что есть на странице, — в наСтранице ДО любых фильтров: сверка
     сборщика считает удалённой только запись, которой на странице нет вовсе,
     а не ту, что он на этот раз не смог прочитать или отсеял. */
  if (id && /^\d+$/.test(id)) о.наСтранице.add(id);
  if (/class="tgme_widget_message [^"]*service_message/.test(блок)) { здоровье.служебных++; return null; }
  здоровье.блоков++;
  /* Есть ли у записи контейнер текста — неважно, пустой или с подписью. Ноль
     таких на всю страницу значит, что Телеграм переименовал класс и текст мы
     больше не читаем. Фото без подписи контейнера просто не содержит, и это
     не поломка (ревью 8.8, F01). */
  if (/tgme_widget_message_text/.test(блок)) здоровье.s_tekstom++;
  if (!id || !/^\d+$/.test(id)) { отброшено.bez_id++; return null; }
  const ssylka = 'https://t.me/' + пост;

  const data = датаISO(вырезать(блок, /<time datetime="([^"]+)"/), о.сейчасМс);
  if (!data) { здоровье.bez_daty++; отброшено.bez_daty++; return null; }

  /* Репосты: чужие не собираем, свои схлопываем к оригиналу. И то и другое —
     пропуск, различается только счётчик. */
  const репост = вырезать(блок, /<a class="tgme_widget_message_forwarded_from_name" href="([^"]+)"/)
    || (/tgme_widget_message_forwarded_from/.test(блок) ? 'unknown' : null);
  if (репост) {
    const канал = (репост.match(/^https?:\/\/t\.me\/([^/?#]+)/i) || [])[1];
    if (канал && о.своиКаналы.has(канал.toLowerCase())) отброшено.svoj_repost++; else отброшено.chuzhoj_repost++;
    return null;
  }

  /* Текст заканчивается там, где начинается следующий блок сообщения
     (реакции, подвал, превью ссылки, фото, видео, плашка «открой в
     Телеграме»); иначе ленивый разбор захватывал бы соседние блоки. */
  const текстHtml = вырезать(блок, /<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="tgme_widget_message_(?:reactions|footer|link_preview|inline|photo|video|grouped|document|poll|sticker|voice|roundvideo)|<a class="tgme_widget_message_(?:link_preview|photo_wrap|video_player)|<div class="message_media_not_supported)/)
    ?? вырезать(блок, /<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/);
  const полныйТекст = вТекст(текстHtml).replace(/Please open Telegram to view this post\.?/gi, '').trim();

  const фото = [...блок.matchAll(/class="tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)/g)].map((м) => м[1]);
  const photoWrap = (блок.match(/tgme_widget_message_photo_wrap/g) || []).length;
  if (photoWrap) { здоровье.photo_wrap += photoWrap; if (!фото.length) здоровье.bez_kartinki += photoWrap; }
  const видеоПревью = [...блок.matchAll(/class="tgme_widget_message_video_thumb"[^>]*style="[^"]*background-image:url\('([^']+)'\)/g)].map((м) => м[1]);
  const видеоЕсть = /tgme_widget_message_video_player|tgme_widget_message_video_wrap|<video /.test(блок) || видеоПревью.length > 0;
  const кружок = /tgme_widget_message_roundvideo/.test(блок);
  const dlitelnost_s = длительность(вырезать(блок, /class="message_video_duration[^"]*">([^<]*)</));
  const ссылкаПревью = вырезать(блок, /<a class="tgme_widget_message_link_preview" href="([^"]+)"/);
  const картинкаПревью = вырезать(блок, /class="link_preview_(?:right_)?image"[^>]*style="[^"]*background-image:url\('([^']+)'\)/);
  const документ = вТекст(вырезать(блок, /<div class="tgme_widget_message_document_title[^"]*">([\s\S]*?)<\/div>/) || '');
  const опрос = /tgme_widget_message_poll/.test(блок);
  /* Стикер, голосовое, кружок — превью не показывает («Please open Telegram
     to view this post»). Та же плашка добавляется к записям с премиум-эмодзи,
     поэтому считаем её только при пустом остальном. */
  const bez_prevyu = !полныйТекст && !фото.length && !видеоЕсть && /message_media_not_supported_wrap/.test(блок);

  /* Здоровье: «текст пропал» — это запись, в которой НЕТ НИЧЕГО: ни слов,
     ни фото, ни видео, ни документа, ни опроса. Фото и видео без подписи —
     обычное дело, а не поломка разметки: прежнее правило считало их за
     пропавший текст, и канал, где два фото из трёх без подписи, отвергался
     целиком (ревью 8.8, F01). */
  if (!полныйТекст && !bez_prevyu && !документ && !опрос && !фото.length && !видеоЕсть) здоровье.bez_teksta++;

  if (естьСтопСлова(полныйТекст)) { отброшено.reklama++; о.отброшеноId.reklama.push(id); return null; }

  const адресВТексте = (полныйТекст.match(/https?:\/\/[^\s<>"']+/i) || [])[0];
  const внешняя = ссылкаПревью || адресВТексте || null;
  const хостСсылки = внешняя ? хост(раскодировать(внешняя)) : null;
  const ssylka_v_zapisi = хостСсылки && хостСсылки !== 't.me' ? хостСсылки : null;

  const содержание = содержательныйТекст(полныйТекст);
  const естьСодержание = содержание.length >= 12;

  let tip = 'tekst';
  if (видеоЕсть || кружок) tip = 'video';
  else if (фото.length) tip = 'foto';
  else if (ссылкаПревью || адресВТексте) tip = 'ssylka';

  let zagolovok = '', tekst = null;
  if (естьСодержание) {
    const первая = перваяСтрока(текстHtml);
    zagolovok = первая.премиум ? '' : обрезатьПоСлову(безАдресов(первая.текст), ЗАГОЛОВОК_МАКС);
    tekst = обрезатьПоСлову(безАдресов(полныйТекст.replace(/\n+/g, ' ')), ТЕКСТ_МАКС) || null;
    if (похожеНаАнонс(полныйТекст)) tip = 'anons';
  } else if (документ) {
    zagolovok = обрезатьПоСлову(документ, ЗАГОЛОВОК_МАКС);
  } else if (опрос) {
    zagolovok = 'Опрос';
  } else if (bez_prevyu) {
    zagolovok = 'Запись в Телеграме';
  } else if (tip === 'video') {
    zagolovok = 'Видео';
  } else if (tip === 'foto') {
    zagolovok = 'Фото';
  } else if (tip === 'ssylka') {
    zagolovok = 'Запись со ссылкой';
  } else {
    отброшено.bez_soderzhaniya++;
    return null;
  }

  /* Картинка: своё фото или превью своего видео. Картинка превью чужой
     ссылки — чужая, её не берём. */
  let kartinka_istochnika = фото[0] || видеоПревью[0] || null;
  if (!kartinka_istochnika && картинкаПревью && свойДомен(хостСсылки)) kartinka_istochnika = картинкаПревью;
  if (kartinka_istochnika) kartinka_istochnika = раскодировать(kartinka_istochnika);
  if (kartinka_istochnika && !/^https?:\/\//i.test(kartinka_istochnika)) kartinka_istochnika = null;

  const з = {
    id, data, tip, zagolovok, tekst, ssylka,
    kartinka_istochnika,
    kartinok: фото.length,
    dlitelnost_s: tip === 'video' ? dlitelnost_s : null,
    bez_prevyu: !!bez_prevyu,
    ssylka_v_zapisi,
  };
  з.tekst_hash = хешТекста(з);
  return з;
}

/* Разбор страницы превью. ист — строка lenta_istochniki (нужен kanal);
   параметры.своиКаналы — имена каналов Телеграма из lenta_istochniki (для
   схлопывания своих репостов), параметры.сейчасМс — «сейчас» для проверки дат. */
function разобратьТелеграм(html, ист, параметры) {
  const п = параметры || {};
  const своиКаналы = new Set([...(п.своиКаналы || [])].map((к) => String(к).toLowerCase()));
  const о = {
    своиКаналы,
    сейчасМс: п.сейчасМс,
    здоровье: { блоков: 0, служебных: 0, s_tekstom: 0, bez_daty: 0, bez_teksta: 0, photo_wrap: 0, bez_kartinki: 0 },
    отброшено: { chuzhoj_repost: 0, svoj_repost: 0, reklama: 0, bez_soderzhaniya: 0, bez_daty: 0, bez_id: 0 },
    наСтранице: new Set(),
    отброшеноId: { reklama: [] },
  };
  const записи = [];
  const видели = new Set();
  for (const блок of блокиТелеграма(html)) {
    const з = разобратьБлокТелеграма(блок, ист, о);
    if (!з || видели.has(з.id)) continue;
    видели.add(з.id);
    записи.push(з);
  }
  записи.sort((а, б) => (б.data < а.data ? -1 : б.data > а.data ? 1 : Number(б.id) - Number(а.id)));
  const структураЕсть = /tgme_widget_message_wrap|tgme_channel_info|data-post="/.test(String(html));
  return {
    название: шапкаТелеграма(html).название,
    /* Пусто — по структуре: разметка канала на месте, а все записи служебные. */
    пусто: структураЕсть && о.здоровье.блоков === 0 && о.здоровье.служебных > 0,
    записи,
    здоровье: о.здоровье,
    отброшено: о.отброшено,
    /* Все id со страницы (и служебные, и отброшенные) — для сверки сборщика. */
    наСтранице: о.наСтранице,
    /* id записей, отсеянных стоп-словами: сборщик скрывает их с причиной
       'reklama', а не 'udaleno_v_istochnike'. */
    отброшеноId: о.отброшеноId,
  };
}

/* ─── Rutube: официальный RSS канала ─────────────────────────────────────── */
function полеXML(кусок, имя) {
  const м = кусок.match(new RegExp('<' + имя + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + имя + '>', 'i'));
  if (!м) return '';
  return раскодировать(м[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')).trim();
}

function разобратьRutube(xml, ист, параметры) {
  const п = параметры || {};
  const т = String(xml || '');
  const здоровье = { блоков: 0, служебных: 0, bez_daty: 0, bez_teksta: 0, photo_wrap: 0, bez_kartinki: 0 };
  const отброшено = { chuzhoj_repost: 0, svoj_repost: 0, reklama: 0, bez_soderzhaniya: 0, bez_daty: 0, bez_id: 0 };
  const естьКанал = /<rss[\s>]/i.test(т) && /<channel[\s>]/i.test(т);
  const названиеКанала = естьКанал ? полеXML(т.split(/<item[\s>]/i)[0], 'title').replace(/^Видеоролики\s+/i, '').replace(/\s+на\s+Rutube$/i, '').trim() : '';
  const записи = [];
  const видели = new Set();
  const наСтранице = new Set();
  const отброшеноId = { reklama: [] };
  for (const м of т.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const кусок = м[1];
    здоровье.блоков++;
    const guid = полеXML(кусок, 'guid');
    const link = полеXML(кусок, 'link');
    const id = (guid.match(/"video_id"\s*:\s*"([0-9a-f]{8,64})"/i) || link.match(/\/video\/([0-9a-f]{8,64})\/?/i) || [])[1];
    if (!id) { отброшено.bez_id++; continue; }
    наСтранице.add(id);
    const data = датаISO(полеXML(кусок, 'pubDate'), п.сейчасМс);
    if (!data) { здоровье.bez_daty++; отброшено.bez_daty++; continue; }
    const title = однойСтрокой(полеXML(кусок, 'title'));
    if (!title) { здоровье.bez_teksta++; отброшено.bez_soderzhaniya++; continue; }
    if (естьСтопСлова(title)) { отброшено.reklama++; отброшеноId.reklama.push(id); continue; }
    const длит = parseInt((guid.match(/"duration"\s*:\s*(\d+)/) || [])[1], 10);
    if (видели.has(id)) continue;
    видели.add(id);
    const з = {
      id, data, tip: 'video',
      zagolovok: обрезатьПоСлову(title, ЗАГОЛОВОК_МАКС),
      tekst: null,                                   /* описание не берём: условия площадки */
      ssylka: /^https?:\/\/rutube\.ru\//i.test(link) ? link : 'https://rutube.ru/video/' + id + '/',
      kartinka_istochnika: null,                     /* кадры не берём: условия площадки */
      kartinok: 0,
      dlitelnost_s: Number.isFinite(длит) && длит > 0 ? длит : null,
      bez_prevyu: false,
      ssylka_v_zapisi: null,
    };
    з.tekst_hash = хешТекста(з);
    записи.push(з);
  }
  записи.sort((а, б) => (б.data < а.data ? -1 : б.data > а.data ? 1 : (б.id < а.id ? -1 : 1)));
  return {
    название: названиеКанала || null,
    пусто: естьКанал && здоровье.блоков === 0,
    записи,
    здоровье,
    отброшено,
    наСтранице,
    отброшеноId,
  };
}

/* ─── общее ──────────────────────────────────────────────────────────────── */
const РАЗБОРЩИКИ = {
  telegram: {
    адрес: (ист) => 'https://t.me/s/' + encodeURIComponent(String(ист.kanal)),
    /* Страница назад: превью отдаёт записи СТАРШЕ указанного id. Нужна для
       добора пропусков после простоя (ревью 8.8, F05); путь для robots.txt
       тот же, что у первой страницы — правила площадки не смотрят на запрос. */
    дальше: (ист, доId) => 'https://t.me/s/' + encodeURIComponent(String(ист.kanal)) + '?before=' + encodeURIComponent(String(доId)),
    путьРобота: (ист) => '/s/' + String(ист.kanal),
    разобрать: разобратьТелеграм,
    картинки: true,
  },
  rutube: {
    адрес: (ист) => 'https://rutube.ru/rss/video/person/' + encodeURIComponent(String(ист.kanal)) + '/',
    путьРобота: (ист) => '/rss/video/person/' + String(ист.kanal) + '/',
    разобрать: разобратьRutube,
    картинки: false,
  },
};

/* Строка причины, если разметка нездорова, иначе null. Доли считаются только
   при достаточном числе блоков — на канале из двух записей проценты ничего
   не значат. */
function здоровьеПлохое(з) {
  if (!з) return null;
  const части = [];
  if (з.блоков >= МИН_ЗАПИСЕЙ_ДЛЯ_ПОРОГА) {
    if (з.bez_daty / з.блоков > ПОРОГ_ЗДОРОВЬЯ) части.push('без даты ' + з.bez_daty + ' из ' + з.блоков);
    /* Две разные беды. Первая: контейнера текста нет ни у одной записи И при
       этом часть записей вышла ПУСТОЙ — ни слов, ни картинок, ни видео: так
       выглядит переименованный класс текста. Вторая: пустых записей больше
       половины при живом контейнере.

       Почему одного «s_tekstom = 0» мало (остаток F01). Канал, где ни у одной
       фотографии нет подписи, даёт ровно тот же признак — и отвергался
       целиком, хотя разобран весь: 12 записей «Фото» с адресами картинок,
       bez_teksta = 0. Пустых записей там нет, потому что содержание у них
       есть — картинка. Поэтому решает не сам по себе отсутствующий контейнер,
       а пустые записи рядом с ним: у сломанной разметки текстовые записи
       остаются вовсе без содержания, у фотоканала — нет.

       Что этой проверке всё ещё не видно: канал, где КАЖДАЯ запись с фото или
       видео и подписи пропали все разом. По разметке он неотличим от честного
       фотоканала без подписей, и такую пропажу поймает только человек. */
    if (з.s_tekstom === 0 && з.bez_teksta > 0) части.push('без текста: контейнер не найден ни в одной из ' + з.блоков + ' записей, ' + з.bez_teksta + ' записей пусты');
    else if (з.bez_teksta / з.блоков > ПОРОГ_ЗДОРОВЬЯ) части.push('без текста ' + з.bez_teksta + ' из ' + з.блоков + ' записей пусты');
  }
  if (з.photo_wrap >= 2 && з.bez_kartinki / з.photo_wrap > ПОРОГ_ЗДОРОВЬЯ) части.push('без картинки ' + з.bez_kartinki + ' из ' + з.photo_wrap + ' фото');
  return части.length ? 'разметка частично: ' + части.join(', ') : null;
}

function разобрать(ист, тело, параметры) {
  const р = РАЗБОРЩИКИ[ист && ист.istochnik];
  if (!р) throw new Error('нет разборщика для ' + (ист && ист.istochnik));
  return р.разобрать(тело, ист, параметры);
}

module.exports = {
  АГЕНТ, ТИПЫ, ЗАГОЛОВОК_МАКС, ТЕКСТ_МАКС, ДОМЕНЫ_ЦЕНТРА, РАЗБОРЩИКИ,
  разобрать, разобратьТелеграм, разобратьRutube, здоровьеПлохое, роботРазрешает,
  раскодировать, вТекст, обрезатьПоСлову, однойСтрокой, чистая, хост, свойДомен,
  естьСтопСлова, похожеНаАнонс, датаISO, хешТекста, длительность, содержательныйТекст, перваяСтрока,
};
