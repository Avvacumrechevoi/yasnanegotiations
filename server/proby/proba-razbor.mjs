/* Прогон разборщиков ленты (server/lenta-razbor.js) без сети: страницы
   превью Телеграма и RSS Rutube плюс синтетические блоки на правила фильтров.

   Страницы лежат в репозитории (server/proby/stranicy): разметка настоящая,
   тексты выдуманы — чужие посты в публичный репозиторий класть нельзя.
   Переменная LENTA_STRANICY даёт прогнать те же проверки на живых страницах.

   Запуск:  node server/proby/proba-razbor.mjs
   Выход 0 — все проверки прошли; 1 — есть провалы; 2 — нет страниц. */
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { страница, есть, своиСтраницы, нуженКаталог } from './obshee.mjs';

const require = createRequire(import.meta.url);
const Р = require(join(dirname(fileURLToPath(import.meta.url)), '..', 'lenta-razbor.js'));

нуженКаталог('russkaya_yasna.html', 'astronevod.html', 'astronevod_before.html', 'naturnie_uroki.html', 'neglinka78.html', 'aleksandriya_2026.html', 'rutube-rss.xml');
const СЕЙЧАС = Date.parse('2026-09-05T12:00:00Z');
const СВОИ = ['russkaya_yasna', 'astronevod', 'naturnie_uroki', 'neglinka78'];

let провалов = 0, проверок = 0;
const так = (условие, имя, что) => {
  проверок++;
  if (!условие) провалов++;
  console.log((условие ? '  ✓ ' : '  ✗ ') + имя + (условие || что == null ? '' : '  — ' + что));
};
const тг = (имя, канал) => Р.разобратьТелеграм(страница(/\.html$/.test(имя) ? имя : имя + '.html'), { istochnik: 'telegram', kanal: канал || имя.replace(/\.html$/, '') }, { своиКаналы: СВОИ, сейчасМс: СЕЙЧАС });
const секунды = (iso) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(iso);
const убывает = (з) => з.every((x, i) => i === 0 || з[i - 1].data >= x.data);
const формаЗаписи = (з) => секунды(з.data) && Р.ТИПЫ.includes(з.tip) && typeof з.zagolovok === 'string' && з.zagolovok.length <= 120
  && (з.tekst === null || (typeof з.tekst === 'string' && з.tekst.length <= 400 && з.tekst.length > 0))
  && /^https?:\/\//.test(з.ssylka) && /^[0-9a-f]{16}$/.test(з.tekst_hash) && typeof з.bez_prevyu === 'boolean'
  && (з.kartinka_istochnika === null || /^https:\/\//.test(з.kartinka_istochnika))
  && (з.ssylka_v_zapisi === null || !/[\/:]/.test(з.ssylka_v_zapisi));

/* ── 1. страницы Телеграма ─────────────────────────────────────────────── */
console.log('Страницы Телеграма');
{
  const р = тг('russkaya_yasna');
  так(р.записи.length === 20, 'russkaya_yasna: 20 записей', р.записи.length);
  так(р.название === 'Русская Ясна', 'название из шапки: ' + р.название);
  так(!р.пусто && Р.здоровьеПлохое(р.здоровье) === null, 'разметка здорова', JSON.stringify(р.здоровье));
  так(р.записи.every(формаЗаписи), 'форма записей по контракту (даты до секунды, ≤120/≤400, hash, хост)');
  так(убывает(р.записи), 'порядок data DESC');
  так(р.записи[0].data === '2026-09-04T11:14:01Z' && р.записи[0].id === '1400', 'верхняя: 1400 от 2026-09-04T11:14:01Z', р.записи[0].data);
  так(р.записи.every((з) => з.data.startsWith('2026-')), 'все даты 2026 года (никаких 1970)');
  так(р.записи.filter((з) => з.kartinka_istochnika).length === 15, 'картинок у источника: 15', р.записи.filter((з) => з.kartinka_istochnika).length);
  так(р.записи.every((з) => !з.kartinka_istochnika || /telesco\.pe|telegram\.org/.test(з.kartinka_istochnika)), 'картинки только с cdn Телеграма');
  const фото = р.записи.find((з) => з.id === '1397');
  так(фото && фото.zagolovok === 'Фото' && фото.tekst === null && фото.tip === 'foto', 'пустая запись с фото → «Фото» без выдержки', JSON.stringify(фото));
  const ссылка = р.записи.find((з) => з.id === '1399');
  так(ссылка && ссылка.ssylka_v_zapisi === 'vkvideo.ru', 'ссылка в записи — только хост: ' + (ссылка && ссылка.ssylka_v_zapisi));
  так(р.записи.filter((з) => з.tip === 'anons').length >= 2, 'анонсы с «Записаться» помечены: ' + р.записи.filter((з) => з.tip === 'anons').length);
  так(р.записи.every((з) => !/https?:\/\//.test(з.tekst || '') && !/https?:\/\//.test(з.zagolovok)), 'адресов в тексте и заголовке нет');
}
{
  const р = тг('astronevod');
  так(р.записи.length === 12 && р.отброшено.chuzhoj_repost === 1, 'astronevod: 12 записей, чужой репост отброшен', JSON.stringify(р.отброшено));
  так(р.записи.every(формаЗаписи) && убывает(р.записи), 'форма и порядок');
  const меры = р.записи.find((з) => з.id === '2119');
  так(меры && /🔠родолжая/.test(меры.tekst) && меры.zagolovok === '#меры /25', 'премиум-эмодзи в теле остаётся символом, первая строка — заголовок', JSON.stringify(меры && меры.zagolovok));
  так(р.записи.filter((з) => з.kartinok > 1).length >= 3, 'альбомы: kartinok > 1 у ' + р.записи.filter((з) => з.kartinok > 1).length);
}
{
  const р = тг('astronevod_before.html', 'astronevod');
  так(р.записи.length === 13 && р.отброшено.svoj_repost === 1, 'astronevod (старее): 13 записей, свой репост схлопнут', JSON.stringify(р.отброшено));
  const видео = р.записи.filter((з) => з.tip === 'video');
  так(видео.length === 2 && видео.every((з) => з.dlitelnost_s > 0 && з.kartinka_istochnika), 'два видео с длительностью и превью: ' + видео.map((з) => з.dlitelnost_s).join(', '));
}
{
  const р = тг('naturnie_uroki');
  так(р.записи.length === 18 && р.здоровье.служебных === 2, 'naturnie_uroki: 18 записей, 2 служебных пропущены', JSON.stringify(р.здоровье));
  так(р.записи.filter((з) => з.tip === 'anons').length >= 10, 'анонсы натурных уроков: ' + р.записи.filter((з) => з.tip === 'anons').length);
  const первая = р.записи.find((з) => з.id === '281');
  так(первая && /^⚡️Приглашаем/.test(первая.zagolovok), 'эмодзи-украшение заголовка не отнимает: ' + JSON.stringify(первая && первая.zagolovok));
  так(р.записи.every((з) => з.zagolovok.length > 0), 'заголовки на месте у всех 18');
}
{
  const р = тг('neglinka78');
  так(р.записи.length === 18 && р.отброшено.chuzhoj_repost === 1, 'neglinka78: 18 записей, 1 чужой репост', JSON.stringify(р.отброшено));
  так(р.отброшено.reklama === 0, '«meridian» в почте не ловится как erid', р.отброшено.reklama);
  так(р.записи[0].data === '2026-06-26T09:41:44Z', 'самая свежая — 26.06.2026 (канал молчит)', р.записи[0].data);
}
{
  const р = тг('aleksandriya_2026');
  так(р.пусто === true && р.записи.length === 0 && р.здоровье.служебных === 1, 'aleksandriya_2026: пусто по структуре (одна служебная запись)', JSON.stringify(р.здоровье));
}

/* ── 2. Rutube RSS ─────────────────────────────────────────────────────── */
console.log('RSS Rutube');
{
  const р = Р.разобратьRutube(страница('rutube-rss.xml'), { istochnik: 'rutube', kanal: '24295181' }, { сейчасМс: СЕЙЧАС });
  так(р.записи.length === 20 && !р.пусто, 'rutube: 20 записей первой страницы', р.записи.length);
  так(р.название === 'Русская Ясна', 'название канала: ' + р.название);
  так(р.записи.every(формаЗаписи) && убывает(р.записи), 'форма и порядок');
  так(р.записи.every((з) => з.tip === 'video' && з.dlitelnost_s > 0), 'все — видео с длительностью');
  так(р.записи.every((з) => з.tekst === null && з.kartinka_istochnika === null && з.kartinok === 0), 'ни описаний, ни кадров (условия площадки)');
  так(р.записи.every((з) => /^https:\/\/rutube\.ru\/video\/[0-9a-f]{32}\/$/.test(з.ssylka)), 'ссылки на rutube.ru/video/<id>/');
  так(р.записи[0].id === 'e249d3c74e2e55d991dbdc8832204ab7' && р.записи[0].data === '2024-09-03T04:05:58Z' && р.записи[0].dlitelnost_s === 2251, 'первая: id, дата загрузки, длительность из guid', JSON.stringify([р.записи[0].id, р.записи[0].data, р.записи[0].dlitelnost_s]));
  так(р.записи.every((з) => з.data < '2025-09-05'), 'все даты старше 365 дней — канал живёт как архив (десятка без срока)');
  const пусто = Р.разобратьRutube('<?xml version="1.0"?><rss version="2.0"><channel><title>Видеоролики X на Rutube</title></channel></rss>', { istochnik: 'rutube', kanal: '1' });
  так(пусто.пусто === true && пусто.записи.length === 0, 'RSS без item → пусто');
  const неRSS = Р.разобратьRutube('<html><body>QRATOR</body></html>', { istochnik: 'rutube', kanal: '1' });
  так(неRSS.пусто === false && неRSS.записи.length === 0, 'не RSS → не пусто, ни одной записи (сборщик поставит oshibka)');
}

/* ── 3. четыре сценария смены вёрстки (skeptik-verstka) ────────────────── */
console.log('Смена вёрстки Телеграма — порог здоровья');
{
  const html0 = страница('russkaya_yasna.html');
  const ист = { istochnik: 'telegram', kanal: 'russkaya_yasna' };
  const п = { своиКаналы: СВОИ, сейчасМс: СЕЙЧАС };
  const варианты = {
    'нет атрибута datetime': html0.replace(/<time datetime="/g, '<time data-dt="'),
    'переименован класс текста': html0.replace(/tgme_widget_message_text js-message_text/g, 'tgme_widget_message_body js-message_body'),
    'переименован класс обёртки': html0.replace(/tgme_widget_message_wrap/g, 'tgme_widget_msg_wrap'),
    'фото без background-image': html0.replace(/background-image:url\('/g, "background:url('"),
  };
  const р0 = Р.разобратьТелеграм(html0, ист, п);
  так(Р.здоровьеПлохое(р0.здоровье) === null && р0.записи.length === 20, 'как есть → здорово, 20 записей');
  const р1 = Р.разобратьТелеграм(варианты['нет атрибута datetime'], ист, п);
  так(р1.записи.length === 0 && /без даты 20 из 20/.test(Р.здоровьеПлохое(р1.здоровье) || ''), 'нет datetime → 0 записей и «без даты 20 из 20»', Р.здоровьеПлохое(р1.здоровье));
  const р2 = Р.разобратьТелеграм(варианты['переименован класс текста'], ист, п);
  так(/без текста/.test(Р.здоровьеПлохое(р2.здоровье) || ''), 'класс текста переименован → «без текста …»', Р.здоровьеПлохое(р2.здоровье));
  const р3 = Р.разобратьТелеграм(варианты['переименован класс обёртки'], ист, п);
  так(р3.записи.length === 0 && р3.пусто === false, 'класс обёртки переименован → ни одной записи и НЕ пусто', JSON.stringify([р3.записи.length, р3.пусто]));
  const р4 = Р.разобратьТелеграм(варианты['фото без background-image'], ист, п);
  так(/без картинки 15 из 15/.test(Р.здоровьеПлохое(р4.здоровье) || ''), 'фото без background-image → «без картинки 15 из 15 фото»', Р.здоровьеПлохое(р4.здоровье));
  /* Те же четыре поломки лежат готовыми файлами: их можно открыть браузером и
     увидеть глазами, что именно сломалось. Сверяем, что файлы не разошлись с
     подстановкой (пересобираются node server/proby/stranicy/sozdat.mjs). */
  const файлыПоломок = {
    'нет атрибута datetime': 'slom_bez_datetime.html',
    'переименован класс текста': 'slom_klass_teksta.html',
    'переименован класс обёртки': 'slom_klass_obertki.html',
    'фото без background-image': 'slom_foto_bez_fona.html',
  };
  for (const [имя, файлПоломки] of Object.entries(файлыПоломок)) {
    if (!есть(файлПоломки)) continue;
    так(страница(файлПоломки) === варианты[имя], 'файл ' + файлПоломки + ' совпадает с подстановкой «' + имя + '»');
  }
}

/* ── 3-бис. крайние виды каналов (файлы страниц) ───────────────────────── */
/* Канал из одних фото без подписей и канал с чужим репостом и чужой рекламой:
   на живых каналах такое встречается, а на разведочных страницах отдельно не
   лежало. Проверки идут только на своих страницах — у чужого каталога этих
   файлов нет. */
if (своиСтраницы) {
  console.log('Крайние виды каналов');
  {
    const html = страница('foto_bez_podpisej.html');
    const ист = { istochnik: 'telegram', kanal: 'foto_bez_podpisej' };
    const п = { своиКаналы: СВОИ, сейчасМс: СЕЙЧАС };
    const р = Р.разобратьТелеграм(html, ист, п);
    так(р.записи.length === 12 && р.записи.every((з) => з.tip === 'foto' && з.zagolovok === 'Фото' && з.tekst === null && з.kartinka_istochnika), 'канал из одних фото без подписей: 12 записей «Фото» с адресами картинок');
    так(р.здоровье.bez_teksta === 0, 'фото без подписи не считается пропавшим текстом (F01): bez_teksta = ' + р.здоровье.bez_teksta);
    /* Одна подпись на весь канал — и он снова здоров. Это и есть проверка F01:
       до правки 11 фото без подписи из 12 отвергали канал целиком. */
    const сПодписью = html.replace('<div class="tgme_widget_message_reactions', '<div class="tgme_widget_message_text js-message_text" dir="auto">Снимок с прошлого обхода</div><div class="tgme_widget_message_reactions');
    const р2 = Р.разобратьТелеграм(сПодписью, ист, п);
    так(р2.здоровье.s_tekstom === 1 && Р.здоровьеПлохое(р2.здоровье) === null, 'одна подпись на 12 записей → разметка здорова (11 фото без подписи канал не роняют)', JSON.stringify(р2.здоровье));
    /* Остаток F01 закрыт: канал СОВСЕМ без подписей больше не отвергается.
       Прежде «s_tekstom = 0» само по себе читалось как «Телеграм переименовал
       класс текста», и фотоканал не собирался вовсе, хотя разобран целиком. */
    так(р.здоровье.s_tekstom === 0 && Р.здоровьеПлохое(р.здоровье) === null, 'канал совсем без подписей разбирается и здоров (остаток F01 закрыт)', JSON.stringify(р.здоровье));
    /* Но настоящую поломку это не прячет. Отнимем у одной записи и картинку
       (как будто там был текст, а класс переименовали): запись выходит пустой
       — ни слов, ни картинки, — и порог снова срабатывает. Именно пустые
       записи рядом с пропавшим контейнером отличают смену вёрстки от
       фотоканала без подписей. */
    const безОдногоФото = html.replace(/<a class="tgme_widget_message_photo_wrap[\s\S]*?<\/a>/, '');
    const р3 = Р.разобратьТелеграм(безОдногоФото, ист, п);
    так(р3.здоровье.bez_teksta === 1 && /контейнер не найден/.test(Р.здоровьеПлохое(р3.здоровье) || ''), 'пустая запись рядом с пропавшим контейнером — это поломка разметки', Р.здоровьеПлохое(р3.здоровье));
  }
  {
    const р = тг('repost_i_reklama.html', 'repost_i_reklama');
    так(р.записи.length === 3 && р.отброшено.chuzhoj_repost === 1 && р.отброшено.reklama === 3, 'чужой репост и три чужие рекламы отброшены, осталось 3 записи', JSON.stringify([р.записи.length, р.отброшено]));
    так(р.отброшеноId.reklama.length === 3 && р.отброшеноId.reklama.every((id) => ['11', '12', '13'].includes(id)), 'id отсеянной рекламы отданы сборщику: ' + р.отброшеноId.reklama.join(','));
    так(р.записи.filter((з) => з.tip === 'anons').length === 2, 'цена и «Записаться» → anons, остальное — обычная запись', JSON.stringify(р.записи.map((з) => з.id + ':' + з.tip)));
  }
}

/* ── 4. синтетические блоки: правила фильтров ──────────────────────────── */
console.log('Правила фильтров на синтетических блоках');
function блок(о) {
  const дата = о.дата === undefined ? '2026-09-01T10:00:00+00:00' : о.дата;
  return '<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message text_not_supported_wrap js-widget_message" data-post="k/' + о.id + '">'
    + (о.форвард ? '<div class="tgme_widget_message_forwarded_from accent_color">Forwarded from&nbsp;<a class="tgme_widget_message_forwarded_from_name" href="' + о.форвард + '"><span dir="auto">Кто-то</span></a></div>' : '')
    + (о.фото || []).map((u, i) => '<a class="tgme_widget_message_photo_wrap 1 2" href="https://t.me/k/' + о.id + '?single" style="width:453px;background-image:url(\'' + u + '\')"></a>').join('')
    + (о.видео ? '<div class="tgme_widget_message_video_player"><i class="tgme_widget_message_video_thumb" style="background-image:url(\'' + о.видео + '\')"></i><time class="message_video_duration js-message_video_duration">1:03</time></div>' : '')
    + (о.текст ? '<div class="tgme_widget_message_text js-message_text" dir="auto">' + о.текст + '</div>' : '')
    + (о.превью ? '<a class="tgme_widget_message_link_preview" href="' + о.превью + '"><i class="link_preview_image" style="background-image:url(\'https://cdn4.telesco.pe/file/preview.jpg\')"></i></a>' : '')
    + (о.плашка ? '<div class="message_media_not_supported_wrap"><div class="message_media_not_supported"><div class="message_media_not_supported_label">Please open Telegram to view this post</div></div></div>' : '')
    + '<div class="tgme_widget_message_footer compact js-message_footer"><span class="tgme_widget_message_meta"><a class="tgme_widget_message_date" href="https://t.me/k/' + о.id + '">'
    + (дата ? '<time datetime="' + дата + '" class="time">10:00</time>' : '<span>10:00</span>') + '</a></span></div></div></div>';
}
const премиум = (эмодзи) => '<tg-emoji emoji-id="1"><i class="emoji" style="background-image:url(\'//telegram.org/img/emoji/40/x.png\')"><b>' + эмодзи + '</b></i></tg-emoji>';
const страницаИз = (...блоки) => '<html><head><meta property="og:title" content="Проба"></head><body><div class="tgme_channel_info"></div>' + блоки.join('') + '</body></html>';
const разбор = (...блоки) => Р.разобратьТелеграм(страницаИз(...блоки), { istochnik: 'telegram', kanal: 'k' }, { своиКаналы: ['k', 'svoj'], сейчасМс: СЕЙЧАС });
{
  const р = разбор(
    блок({ id: 1, текст: премиум('🔠') + 'егодня Солнце входит в знак Девы, и это заметно по длине тени<br/>Вторая строка про меры и вес' }),
    блок({ id: 2, текст: премиум('🌞') + 'Друзья, приглашаем на натурный урок в Коломенском в это воскресенье' }),
    блок({ id: 3, текст: 'Обычная запись с ' + премиум('⭐') + ' звездой в середине первой строки и продолжением' }),
  );
  const [з3, з2, з1] = р.записи;
  так(з1.id === '1' && з1.zagolovok === '' && /^🔠егодня/.test(з1.tekst), 'премиум-эмодзи вместо буквы → без заголовка, выдержка остаётся', JSON.stringify([з1.zagolovok, з1.tekst && з1.tekst.slice(0, 20)]));
  так(з2.id === '2' && /^🌞Друзья/.test(з2.zagolovok), 'премиум-эмодзи перед заглавной — украшение, заголовок остаётся', JSON.stringify(з2.zagolovok));
  так(з3.id === '3' && /звездой/.test(з3.zagolovok), 'премиум-эмодзи с пробелами — заголовок остаётся', JSON.stringify(з3.zagolovok));
}
{
  const р = разбор(
    блок({ id: 10, текст: 'Реклама. ООО Ромашка, erid: 2VtzqwAbc. Покупайте наши окна по акции' }),
    блок({ id: 11, текст: 'Промокод ЯСНА даёт доступ к курсу по особой цене только сегодня' }),
    блок({ id: 12, текст: 'Партнёрский материал о том, как выбрать стройматериалы правильно' }),
    блок({ id: 13, текст: 'Скидки на экскурсии до конца недели для всех подписчиков канала' }),
    блок({ id: 14, текст: 'Пишите на 38_meridian@inbox.ru по вопросам сотрудничества и уроков' }),
    блок({ id: 15, текст: 'Вход 500 ₽, дети бесплатно. Собираемся у метро Таганская в полдень, урок два часа' }),
    блок({ id: 16, текст: 'Записаться на урок можно у Лидии, места ещё есть, приходите семьями' }),
  );
  const ид = р.записи.map((з) => з.id).sort();
  так(р.отброшено.reklama === 3 && ид.join(',') === '13,14,15,16', 'стоп-слова erid/промокод/партнёрск → пропуск; meridian не в счёт', JSON.stringify([р.отброшено, ид]));
  /* Решение владельца 8.8: «скидка» — слово из собственных анонсов управлений
     («для детей скидка на натурный урок»), а не признак чужой рекламы. */
  так(р.записи.find((з) => з.id === '13') && р.записи.find((з) => з.id === '13').tip === 'anons', 'скидка НЕ отбрасывается, а помечается анонсом', JSON.stringify(р.записи.find((з) => з.id === '13')));
  так(р.записи.find((з) => з.id === '15').tip === 'anons' && р.записи.find((з) => з.id === '16').tip === 'anons', 'цена и «Записаться» → anons');
  так(р.записи.find((з) => з.id === '14').tip === 'tekst', 'обычный текст → tekst');
  так(Р.естьСтопСлова('Скидка 20 % на натурный урок для детей') === false && Р.похожеНаАнонс('Скидка 20 % на натурный урок для детей') === true, 'своя скидка: не стоп-слово, но анонс');
  так(Р.естьСтопСлова('Промокод ЯСНА') === true && Р.естьСтопСлова('Реклама. ООО Ромашка') === true, 'чужая реклама по-прежнему отбрасывается');
}
{
  const р = разбор(
    блок({ id: 20, текст: '', фото: ['https://cdn4.telesco.pe/file/a.jpg', 'https://cdn4.telesco.pe/file/b.jpg'] }),
    блок({ id: 21, текст: 'Дорогие друзья, доброго дня!<br/>https://vk.com/video-1_2', превью: 'https://vk.com/video-1_2' }),
    блок({ id: 22, текст: '' }),
    блок({ id: 23, текст: '', плашка: true }),
    блок({ id: 24, текст: 'Смотрите разбор на сайте центра: https://zolotoj-yasen.ru/bolshoy-list/ там всё подробно расписано', превью: 'https://zolotoj-yasen.ru/bolshoy-list/' }),
    блок({ id: 25, текст: 'Дорогие друзья! Обсуждение затмения на видео https://vkvideo.ru/video-1_3 смотрите и делитесь', превью: 'https://vkvideo.ru/video-1_3' }),
    блок({ id: 26, текст: 'Запись с видео, ничего особенного, просто кадры натурного урока в парке', видео: 'https://cdn4.telesco.pe/file/v.jpg' }),
  );
  const по = Object.fromEntries(р.записи.map((з) => [з.id, з]));
  так(по[20] && по[20].zagolovok === 'Фото' && по[20].tekst === null && по[20].kartinok === 2 && по[20].kartinka_istochnika === 'https://cdn4.telesco.pe/file/a.jpg', 'альбом без текста → «Фото», kartinok 2, первая картинка', JSON.stringify(по[20]));
  так(по[21] && по[21].zagolovok === 'Запись со ссылкой' && по[21].tekst === null && по[21].tip === 'ssylka' && по[21].ssylka_v_zapisi === 'vk.com' && по[21].kartinka_istochnika === null, 'приветствие + ссылка на VK → «Запись со ссылкой», картинка чужого превью не берётся', JSON.stringify(по[21]));
  так(!по[22] && р.отброшено.bez_soderzhaniya === 1, 'совсем пустая запись → пропуск');
  так(по[23] && по[23].bez_prevyu === true && по[23].zagolovok === 'Запись в Телеграме' && по[23].tekst === null, 'стикер/голосовое → bez_prevyu', JSON.stringify(по[23]));
  так(по[24] && по[24].tip === 'ssylka' && по[24].kartinka_istochnika === 'https://cdn4.telesco.pe/file/preview.jpg' && по[24].ssylka_v_zapisi === 'zolotoj-yasen.ru', 'ссылка на домен центра → tip ssylka, превью своё, берётся', JSON.stringify(по[24]));
  так(по[25] && по[25].tip === 'ssylka' && по[25].kartinka_istochnika === null && по[25].ssylka_v_zapisi === 'vkvideo.ru' && !/https?:/.test(по[25].tekst), 'ссылка на чужой домен → tip ssylka, без превью, адрес из текста убран', JSON.stringify(по[25]));
  так(по[26] && по[26].tip === 'video' && по[26].dlitelnost_s === 63 && по[26].kartinka_istochnika === 'https://cdn4.telesco.pe/file/v.jpg', 'своё видео → video, 1:03 = 63 с, превью видео', JSON.stringify(по[26]));
}
{
  const р = разбор(
    блок({ id: 30, текст: 'Запись без даты в разметке, такого быть не должно', дата: null }),
    блок({ id: 31, текст: 'Запись с кривой датой, парсер обязан её отбросить', дата: 'вчера' }),
    блок({ id: 32, текст: 'Запись из далёкого будущего, тоже не годится', дата: '2031-01-01T00:00:00+00:00' }),
    блок({ id: 33, текст: 'Нормальная запись, московское время переводится в UTC', дата: '2026-09-01T13:00:00+03:00' }),
    блок({ id: 34, текст: 'Чужой репост, его не собираем', форвард: 'https://t.me/vrema_znat/3660' }),
    блок({ id: 35, текст: 'Свой репост, оригинал в своём канале', форвард: 'https://t.me/svoj/12' }),
  );
  так(р.записи.length === 1 && р.записи[0].id === '33' && р.записи[0].data === '2026-09-01T10:00:00Z', 'без даты / кривая / будущее → отброшены; +03:00 → UTC', JSON.stringify(р.записи.map((з) => з.id + ' ' + з.data)));
  так(р.отброшено.bez_daty === 3 && р.отброшено.chuzhoj_repost === 1 && р.отброшено.svoj_repost === 1, 'счётчики отброшенного', JSON.stringify(р.отброшено));
  так(/без даты 3 из 6/.test(Р.здоровьеПлохое(р.здоровье) || '') === false, 'доля без даты 3 из 6 = 50 % — порог ещё не сработал (строго больше)', Р.здоровьеПлохое(р.здоровье));
}
{
  const длинный = 'Слово '.repeat(120).trim();
  const р = разбор(блок({ id: 40, текст: длинный + '<br/>' + длинный }));
  const з = р.записи[0];
  так(з.zagolovok.length <= 120 && /…$/.test(з.zagolovok) && !/ …$/.test(з.zagolovok), 'заголовок обрезан по слову до 120 с «…»: ' + з.zagolovok.length);
  так(з.tekst.length <= 400 && /…$/.test(з.tekst), 'текст обрезан по слову до 400 с «…»: ' + з.tekst.length);
  так(Р.обрезатьПоСлову('Дорогие товарищи, друзья и подруги! У нас большая радость', 30) === 'Дорогие товарищи, друзья и…', 'обрезка по слову без висячей запятой');
  так(Р.обрезатьПоСлову('коротко', 30) === 'коротко', 'короткое не трогаем');
  так(Р.вТекст('a &amp; b &lt;c&gt; &#1044;&#x430; &laquo;x&raquo;') === 'a & b <c> Да «x»', 'сущности HTML раскодированы');
  так(Р.чистая('a\u0000b\u0007c\u001fd\tе') === 'abcd\tе', 'управляющие байты вычищены, табуляция остаётся');
  так(Р.датаISO('2026-09-01T10:00:00.789+00:00') === '2026-09-01T10:00:00Z', 'дата к секунде, без долей');
  так(Р.датаISO('Tue, 03 Sep 2024 04:05:58 -0000') === '2024-09-03T04:05:58Z', 'дата RSS (RFC 822) → ISO UTC');
  так(Р.длительность('1:02:03') === 3723 && Р.длительность('0:40') === 40 && Р.длительность('') === null, 'длительность ч:м:с → секунды');
}

/* ── 5. robots.txt ─────────────────────────────────────────────────────── */
console.log('robots.txt');
{
  const роботы = 'User-agent: *\nDisallow: /api/\nDisallow: /private\nAllow: /api/public\n\nUser-agent: YasnaLenta\nDisallow: /s/zakryto\n';
  так(Р.роботРазрешает(роботы, '/s/russkaya_yasna') === true, 'своя группа: /s/russkaya_yasna можно');
  так(Р.роботРазрешает(роботы, '/s/zakryto') === false, 'своя группа: /s/zakryto нельзя');
  так(Р.роботРазрешает('User-agent: *\nDisallow: /api/\nAllow: /api/public\n', '/api/video/person/1/') === false, 'группа *: /api/ нельзя');
  так(Р.роботРазрешает('User-agent: *\nDisallow: /api/\nAllow: /api/public\n', '/api/public/x') === true, 'группа *: длинный Allow побеждает');
  так(Р.роботРазрешает('User-agent: *\nDisallow: /api/\n', '/rss/video/person/24295181/') === true, 'группа *: /rss/ можно');
  так(Р.роботРазрешает('', '/s/x') === true && Р.роботРазрешает(null, '/s/x') === true, 'нет файла → можно');
  так(Р.роботРазрешает('User-agent: *\nDisallow: /\n', '/s/x') === false, 'Disallow: / → нельзя');
  так(Р.РАЗБОРЩИКИ.telegram.адрес({ kanal: 'astronevod' }) === 'https://t.me/s/astronevod' && Р.РАЗБОРЩИКИ.rutube.адрес({ kanal: '24295181' }) === 'https://rutube.ru/rss/video/person/24295181/', 'адреса площадок');
  так(Р.АГЕНТ === 'YasnaLenta/1.0 (+https://yasnalab.ru)', 'честный User-Agent');
}

console.log(провалов ? `\nПРОВАЛОВ: ${провалов} из ${проверок}` : `\nВсе ${проверок} проверок прошли`);
process.exit(провалов ? 1 : 0);
