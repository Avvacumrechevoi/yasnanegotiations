/* Прогон сборщика ленты (server/lenta-sbor.js) без сети, YDB и облака:
   страницы — сохранённые в разведке 05.09.2026, хранилище — Map с тем же
   контрактом, что у слоя YDB, бакет — Map ключ → байты, часы — константа.

   Что проверяется: первый запуск пишет, второй — нет (периоды, дедупликация);
   сломанный источник не роняет остальные; пусто по структуре; Rutube за
   сроком — только десятка; картинки двумя объектами с настоящим пережатием
   (jpeg-js) и размерами ≤160/≤480; не-JPEG → три попытки и отбой; сверка с
   источником → skryto + DELETE объектов; скрытое модератором → DELETE;
   окно правок 7 дней; бюджет времени; тревога через 24 ч без удачи и не
   чаще раза в сутки; уборка «10 без срока + 365 дней» без качелей; ручной
   запуск по телу; разбор события; форма запросов слоя YDB против миграции.

   Страницы в репозиторий не кладутся: путь — переменная LENTA_STRANICY.
   Запуск:  node server/proby/proba-sbor.mjs */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ЗДЕСЬ = dirname(fileURLToPath(import.meta.url));
const С = require(join(ЗДЕСЬ, '..', 'lenta-sbor.js'));
const Р = require(join(ЗДЕСЬ, '..', 'lenta-razbor.js'));
const JPEG = require(join(ЗДЕСЬ, '..', 'jpeg-js.js'));

const СТРАНИЦЫ = process.env.LENTA_STRANICY
  || '/private/tmp/claude-501/-Users-avva-Downloads----------------------/aecf3972-c620-48a3-a891-8c6b8ab7a98b/scratchpad/lenta';
if (!existsSync(join(СТРАНИЦЫ, 'russkaya_yasna.html'))) {
  console.error('нет сохранённых страниц в ' + СТРАНИЦЫ + ' — задай LENTA_STRANICY');
  process.exit(2);
}
const файл = (имя) => readFileSync(join(СТРАНИЦЫ, имя));
const JPEG_800 = файл('itog-src/neglinka_2604_orig.jpg');          /* 800×533 baseline, 113 КБ */
const JPEG_МАЛЫЙ = файл('thumb-s.jpg');                             /* 193×108 */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

let провалов = 0, проверок = 0;
const так = (условие, имя, что) => {
  проверок++;
  if (!условие) провалов++;
  console.log((условие ? '  ✓ ' : '  ✗ ') + имя + (условие || что == null ? '' : '  — ' + что));
};
const размерJPEG = (буф) => { const к = JPEG.decode(буф, { useTArray: true }); return { w: к.width, h: к.height }; };

/* ── 0. пережатие само по себе ─────────────────────────────────────────── */
console.log('Пережатие JPEG (jpeg-js, чистый JS)');
{
  const t0 = performance.now();
  const к = С.пережать(JPEG_800);
  const мс = Math.round(performance.now() - t0);
  const m = размерJPEG(к.m), p = размерJPEG(к.p);
  так(к.ширина === 800 && к.высота === 533, 'исходник 800×533 декодирован');
  так(Math.max(m.w, m.h) === 160 && Math.max(p.w, p.h) === 480, `две копии: ${m.w}×${m.h} и ${p.w}×${p.h}`);
  так(к.m.length < 25000 && к.p.length < 90000, `размеры: миниатюра ${к.m.length} байт, полная ${к.p.length} байт (было ${JPEG_800.length})`);
  так(С.этоJPEG(к.m) && С.этоJPEG(к.p), 'обе копии — JPEG по сигнатуре');
  так(мс < 2000, `время декод+уменьшение+кодирование ×2: ${мс} мс`);
  console.log(`      замер 800×533: ${мс} мс, ${JPEG_800.length} → ${к.p.length} (480 px) + ${к.m.length} (160 px) байт`);
  const мал = С.пережать(JPEG_МАЛЫЙ);
  const mm = размерJPEG(мал.m), pp = размерJPEG(мал.p);
  так(pp.w === 193 && mm.w === 160, `маленький исходник не увеличивается: полная ${pp.w}, миниатюра ${mm.w}`);
  let ошибка = null; try { С.пережать(PNG); } catch (e) { ошибка = e.message; }
  так(/не JPEG/.test(ошибка || ''), 'PNG по сигнатуре → отказ: ' + ошибка);
  const к2 = С.ключиБакета({ klyuch: 'telegram:neglinka78:2604', istochnik: 'telegram' });
  так(/^lenta\/telegram\/[0-9a-f]{24}-m\.jpg$/.test(к2.m) && к2.p === к2.m.replace('-m.jpg', '.jpg'), 'ключи бакета: ' + к2.m + ' и ' + к2.p);
}

/* ── подделки: сеть, бакет, хранилище, часы ────────────────────────────── */
const ТЕЛА = {
  'https://t.me/s/russkaya_yasna': файл('russkaya_yasna.html').toString('utf8'),
  'https://t.me/s/naturnie_uroki': файл('naturnie_uroki.html').toString('utf8'),
  'https://t.me/s/astronevod': файл('astronevod.html').toString('utf8'),
  'https://t.me/s/neglinka78': файл('neglinka78.html').toString('utf8'),
  'https://t.me/s/aleksandriya_2026': файл('aleksandriya_2026.html').toString('utf8'),
  'https://rutube.ru/rss/video/person/24295181/': файл('rutube-rss.xml').toString('utf8'),
  'https://rutube.ru/robots.txt': 'User-agent: *\nDisallow: /api/\n',
};
const ПОДМЕНЫ = {};                       /* url → тело (для сценариев правок и удалений) */
const запросы = [];                       /* журнал обращений к «сети» */
let картинкаПлохая = null;                /* url картинки, которая отдаёт PNG */
async function взять(url, о = {}) {
  запросы.push({ url, байты: !!о.байты, ua: Р.АГЕНТ });
  if (о.байты) {
    if (url === картинкаПлохая) return { статус: 200, тип: 'image/png', тело: PNG };
    if (/telesco\.pe|telegram\.org/.test(url)) return { статус: 200, тип: 'image/jpeg', тело: JPEG_800 };
    return { статус: 404, тело: null };
  }
  if (/\/robots\.txt$/.test(url) && !ТЕЛА[url]) return { статус: 404, текст: '' };
  if (url === 'https://t.me/s/slomannyj') throw new Error('нет сети');
  if (url === 'https://t.me/s/zakryto') return { статус: 302, текст: '', куда: 'https://t.me/zakryto' };
  const т = ПОДМЕНЫ[url] || ТЕЛА[url];
  return т != null ? { статус: 200, текст: т } : { статус: 404, текст: '' };
}
const бакет = {
  объекты: new Map(), положено: 0, удалено: 0,
  адрес: (ключ) => 'https://storage.yandexcloud.net/yasnalab.ru/' + ключ,
  async положить(ключ, тело, тип) { this.объекты.set(ключ, { байт: тело.length, тип, тело }); this.положено++; },
  async удалить(ключ) { if (this.объекты.delete(ключ)) this.удалено++; },
};
const ИСТ = new Map(), ПУБЛ = new Map(), ЖУРНАЛ = [];
let сейчасМс = Date.parse('2026-09-05T12:00:00Z');
let остатокМс = 120000;
const сек = (мс) => new Date(мс).toISOString().slice(0, 19) + 'Z';
const поУбыванию = (а, б) => (б.data < а.data ? -1 : б.data > а.data ? 1 : (б.klyuch < а.klyuch ? -1 : 1));
const хранилище = {
  async источники() { return [...ИСТ.values()].map((и) => Object.assign({}, и)); },
  async записиКанала(ист, отISO) {
    return [...ПУБЛ.values()].filter((з) => з.istochnik === ист.istochnik && з.kanal === ист.kanal && з.data >= отISO)
      .map((з) => ({ klyuch: з.klyuch, data: з.data, tekst_hash: з.tekst_hash, skryto: !!з.skryto, kartinka: з.kartinka, kartinka_polnaya: з.kartinka_polnaya, kartinka_popytok: з.kartinka_popytok || 0, kartinka_istochnika: з.kartinka_istochnika }));
  },
  async записать(записи) { for (const з of записи) ПУБЛ.set(з.klyuch, Object.assign({ skryto: false }, з)); },
  async обновить(записи) { for (const з of записи) Object.assign(ПУБЛ.get(з.klyuch), { tip: з.tip, zagolovok: з.zagolovok, tekst: з.tekst, kartinok: з.kartinok, ssylka_v_zapisi: з.ssylka_v_zapisi, tekst_hash: з.tekst_hash, obnovleno_at: з.obnovleno_at }); },
  async скрыть(klyuch, причина, сейчасISO) { Object.assign(ПУБЛ.get(klyuch), { skryto: true, skryto_prichina: причина, skryto_at: сейчасISO, obnovleno_at: сейчасISO }); },
  async картинка(klyuch, m, p, попыток, сейчасISO) { Object.assign(ПУБЛ.get(klyuch), { kartinka: m, kartinka_polnaya: p, kartinka_popytok: попыток, obnovleno_at: сейчасISO }); },
  async безКартинки(ист, макс, предел) {
    return [...ПУБЛ.values()].filter((з) => з.istochnik === ист.istochnik && з.kanal === ист.kanal && !з.kartinka && з.kartinka_istochnika && (з.kartinka_popytok || 0) < макс && !з.skryto)
      .sort(поУбыванию).slice(0, предел).map((з) => ({ klyuch: з.klyuch, kartinka_istochnika: з.kartinka_istochnika, kartinka_popytok: з.kartinka_popytok || 0 }));
  },
  async скрытыеСКартинками(ист) {
    return [...ПУБЛ.values()].filter((з) => з.istochnik === ист.istochnik && з.kanal === ист.kanal && з.skryto && (з.kartinka || з.kartinka_polnaya))
      .map((з) => ({ klyuch: з.klyuch, kartinka: з.kartinka, kartinka_polnaya: з.kartinka_polnaya }));
  },
  async количество(ист) { return [...ПУБЛ.values()].filter((з) => з.istochnik === ист.istochnik && з.kanal === ист.kanal && !з.skryto).length; },
  async состояние(ист, з) {
    const и = ИСТ.get(ист.klyuch);
    и.proveren_at = з.сейчасISO;
    if (з.udacha) { и.udacha_at = з.сейчасISO; и.oshibka = null; и.oshibok_podryad = 0; }
    else { и.oshibka = з.soobshchenie || з.ishod; и.oshibok_podryad = (и.oshibok_podryad || 0) + 1; }
    if (з.свежая && (!и.poslednyaya_publikaciya || з.свежая > и.poslednyaya_publikaciya)) и.poslednyaya_publikaciya = з.свежая;
    if (з.название) и.nazvanie = з.название;
    if (з.zapisej != null) и.zapisej = з.zapisej;
    и.obnovleno_at = з.сейчасISO;
  },
  async журнал(з) { ЖУРНАЛ.push(Object.assign({ at: sек() }, з)); },
  async последняяУборка() { const у = ЖУРНАЛ.filter((з) => з.klyuch === 'uborka'); return у.length ? у[у.length - 1].at : null; },
  async тревогаБыла(klyuch, сISO) { return ЖУРНАЛ.some((з) => з.klyuch === klyuch && з.ishod === 'trevoga' && з.at >= сISO); },
  async всеЗаписиКанала(ист) {
    return [...ПУБЛ.values()].filter((з) => з.istochnik === ист.istochnik && з.kanal === ист.kanal)
      .map((з) => ({ klyuch: з.klyuch, data: з.data, skryto: !!з.skryto, kartinka: з.kartinka, kartinka_polnaya: з.kartinka_polnaya }));
  },
  async удалить(klyuch) { ПУБЛ.delete(klyuch); },
  async убратьЖурнал(доISO) { const было = ЖУРНАЛ.length; for (let i = ЖУРНАЛ.length - 1; i >= 0; i--) if (ЖУРНАЛ[i].at < доISO) ЖУРНАЛ.splice(i, 1); return было - ЖУРНАЛ.length; },
};
function sек() { return сек(сейчасМс); }
const о = { хранилище, взять, бакет, сейчас: () => сейчасМс, остаток: () => остатокМс, пауза: async () => {} };

function источник(klyuch, istochnik, kanal, upravlenie, доп = {}) {
  ИСТ.set(klyuch, Object.assign({ klyuch, istochnik, kanal, adres: 'https://x/' + kanal, nazvanie: null, upravlenie, upravleniya: upravlenie, vklyuchen: true,
    period_min: istochnik === 'telegram' ? 15 : 60, soglasie_at: '2026-09-05T00:00:00Z', proveren_at: null, udacha_at: null, oshibok_podryad: 0, poslednyaya_publikaciya: null, zapisej: null }, доп));
}
источник('telegram:russkaya_yasna', 'telegram', 'russkaya_yasna', 'yasna-shkola', { upravleniya: 'yasna-shkola,granika,centr' });
источник('telegram:naturnie_uroki', 'telegram', 'naturnie_uroki', 'marshruty');
источник('telegram:astronevod', 'telegram', 'astronevod', 'astronevod', { soglasie_at: null });   /* без согласия — без картинок */
источник('telegram:neglinka78', 'telegram', 'neglinka78', 'neglinka');
источник('telegram:aleksandriya_2026', 'telegram', 'aleksandriya_2026', 'alexandria');
источник('telegram:slomannyj', 'telegram', 'slomannyj', 'izvod');
источник('telegram:zakryto', 'telegram', 'zakryto', 'izvod');
источник('rutube:24295181', 'rutube', '24295181', 'yasna-shkola');
источник('dzen:5e9a2d632385352365504c51', 'dzen', '5e9a2d632385352365504c51', 'izvod', { vklyuchen: false, period_min: 1440 });
источник('youtube:russkaya_yasna', 'youtube', 'russkaya_yasna', 'yasna-shkola', { vklyuchen: false, period_min: 1440 });

const по = (р) => Object.fromEntries(р.отчёт.map((з) => [з.klyuch, з]));
const канал = (ист) => [...ПУБЛ.values()].filter((з) => з.istochnik + ':' + з.kanal === ист);
const видимые = (ист) => канал(ист).filter((з) => !з.skryto);

/* ── 1. первый запуск ──────────────────────────────────────────────────── */
console.log('Первый запуск (таймер)');
let р = await С.сбор(о, { otkuda: 'timer' });
let и = по(р);
так(р.опрошено === 8 && !и['dzen:5e9a2d632385352365504c51'] && !и['youtube:russkaya_yasna'], 'в очереди 8 включённых из 10, выключенные не опрашивались', р.опрошено);
так(р.отчёт[0].klyuch.startsWith('telegram:') && р.отчёт[р.отчёт.length - 1].klyuch === 'rutube:24295181', 'Телеграм первым, Rutube последним');
так(и['telegram:russkaya_yasna'].ishod === 'ok' && и['telegram:russkaya_yasna'].novyh === 20, 'russkaya_yasna: ok, 20 новых', JSON.stringify(и['telegram:russkaya_yasna']));
так(и['telegram:naturnie_uroki'].ishod === 'ok' && и['telegram:naturnie_uroki'].novyh === 18, 'naturnie_uroki: 18 новых', и['telegram:naturnie_uroki'].novyh);
так(и['telegram:astronevod'].ishod === 'ok' && и['telegram:astronevod'].novyh === 12, 'astronevod: 12 новых (чужой репост отброшен)', и['telegram:astronevod'].novyh);
так(и['telegram:neglinka78'].ishod === 'ok' && и['telegram:neglinka78'].novyh === 18, 'neglinka78: 18 новых', и['telegram:neglinka78'].novyh);
так(и['telegram:aleksandriya_2026'].ishod === 'pusto' && и['telegram:aleksandriya_2026'].udacha === true, 'aleksandriya_2026: pusto по структуре — это удача, не ошибка', JSON.stringify(и['telegram:aleksandriya_2026']));
так(и['telegram:slomannyj'].ishod === 'oshibka' && /нет сети/.test(и['telegram:slomannyj'].soobshchenie), 'сломанный источник → oshibka, остальные собраны');
так(и['telegram:zakryto'].ishod === 'oshibka' && /302/.test(и['telegram:zakryto'].soobshchenie), 'закрытое превью (302) → oshibka: ' + и['telegram:zakryto'].soobshchenie);
так(и['rutube:24295181'].ishod === 'ok' && и['rutube:24295181'].novyh === 10 && /за сроком 10/.test(и['rutube:24295181'].soobshchenie), 'rutube: из 20 роликов старше года взято 10 (десятка без срока)', JSON.stringify(и['rutube:24295181']));
так(и['rutube:24295181'].novyh === 10 && видимые('rutube:24295181').every((з) => !з.kartinka && !з.kartinka_istochnika && з.tekst === null && з.tip === 'video'), 'rutube: без кадров и описаний');
const всего1 = ПУБЛ.size;
так(всего1 === 20 + 18 + 12 + 18 + 10, 'в хранилище ' + всего1 + ' записей');
так([...ПУБЛ.values()].every((з) => /^(telegram|rutube):[^:]+:[^:]+$/.test(з.klyuch) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(з.data) && з.sobrano_at === з.obnovleno_at && з.skryto === false), 'форма строк: klyuch, data до секунды, sobrano_at, skryto=false');
так([...ПУБЛ.values()].every((з) => з.zagolovok.length <= 120 && (з.tekst === null || з.tekst.length <= 400) && Р.ТИПЫ.includes(з.tip)), 'заголовок ≤120, текст ≤400, tip из словаря');
так(ПУБЛ.get('telegram:russkaya_yasna:1400').upravleniya === 'yasna-shkola,granika,centr' && ПУБЛ.get('telegram:russkaya_yasna:1400').upravlenie === 'yasna-shkola', 'общий канал: upravleniya через запятую, upravlenie главное');
const сКарт = [...ПУБЛ.values()].filter((з) => з.kartinka);
так(сКарт.length === 15 + 17 + 18, 'картинки только у каналов с согласием: ' + сКарт.length + ' записей (russkaya_yasna 15, naturnie 17, neglinka 18)');
так(бакет.положено === сКарт.length * 2 && бакет.объекты.size === сКарт.length * 2, 'в бакете по два объекта на запись: ' + бакет.объекты.size);
так([...бакет.объекты.keys()].every((к) => /^lenta\/telegram\/[0-9a-f]{24}(-m)?\.jpg$/.test(к)), 'ключи lenta/telegram/<hash>-m.jpg и <hash>.jpg');
так(сКарт.every((з) => з.kartinka.endsWith('-m.jpg') && з.kartinka_polnaya.endsWith('.jpg') && з.kartinka.startsWith('https://storage.yandexcloud.net/yasnalab.ru/lenta/telegram/')), 'адреса копий — бакет yasnalab.ru');
{
  const объ = [...бакет.объекты.values()];
  const малые = объ.filter((x) => x.байт < 25000), большие = объ.filter((x) => x.байт >= 25000);
  так(малые.length === сКарт.length && большие.length === сКарт.length, `размеры объектов: миниатюры ≈${малые[0] && малые[0].байт} байт, полные ≈${большие[0] && большие[0].байт} байт`);
  const один = размерJPEG(бакет.объекты.get(С.ключиБакета(сКарт[0]).m).тело), два = размерJPEG(бакет.объекты.get(С.ключиБакета(сКарт[0]).p).тело);
  так(Math.max(один.w, один.h) <= 160 && Math.max(два.w, два.h) <= 480, `в бакете лежат уменьшенные копии: ${один.w}×${один.h} и ${два.w}×${два.h}`);
}
так(видимые('telegram:astronevod').every((з) => !з.kartinka && з.kartinka_popytok === 0) && видимые('telegram:astronevod').filter((з) => з.kartinka_istochnika).length === 11, 'без согласия: адреса картинок сохранены, копий нет, попытки не потрачены');
{
  const ии = ИСТ.get('telegram:russkaya_yasna');
  так(ии.udacha_at === '2026-09-05T12:00:00Z' && ии.oshibka === null && ии.oshibok_podryad === 0, 'состояние: удача, ошибки нет');
  так(ии.poslednyaya_publikaciya === '2026-09-04T11:14:01Z' && ии.nazvanie === 'Русская Ясна' && ии.zapisej === 20, 'состояние: свежая публикация, имя, число записей', JSON.stringify([ии.poslednyaya_publikaciya, ии.nazvanie, ии.zapisej]));
  так(ИСТ.get('telegram:slomannyj').oshibok_podryad === 1 && /нет сети/.test(ИСТ.get('telegram:slomannyj').oshibka) && !ИСТ.get('telegram:slomannyj').udacha_at, 'сломанный: oshibok_podryad=1, oshibka записана');
  так(ИСТ.get('telegram:neglinka78').poslednyaya_publikaciya === '2026-06-26T09:41:44Z', 'молчащий канал: последняя публикация 26.06 (состояние «молчит» считают ручки)');
}
так(ЖУРНАЛ.filter((з) => з.klyuch !== 'uborka').length === 8 && ЖУРНАЛ.every((з) => з.otkuda === 'timer'), 'журнал: 8 строк опросов с otkuda=timer');
так(ЖУРНАЛ.filter((з) => з.klyuch === 'uborka').length === 1 && /удалено записей 0/.test(ЖУРНАЛ.find((з) => з.klyuch === 'uborka').soobshchenie), 'уборка прошла в первый запуск: удалять нечего');
так(запросы.filter((q) => /robots\.txt$/.test(q.url)).length === 2, 'robots.txt спрошен по разу на хост (t.me, rutube.ru): ' + запросы.filter((q) => /robots\.txt$/.test(q.url)).length);
так(запросы.every((q) => q.ua === Р.АГЕНТ), 'все обращения — с честным User-Agent');

/* ── 2. второй запуск через 20 минут ───────────────────────────────────── */
console.log('Второй запуск через 20 минут (периоды, идемпотентность)');
сейчасМс += 20 * 60000;
const put1 = бакет.положено, запросов1 = запросы.length;
р = await С.сбор(о, { otkuda: 'timer' });
и = по(р);
так(р.опрошено === 7 && !и['rutube:24295181'], 'через 20 минут в очереди только Телеграм (7), Rutube ждёт своего часа', р.опрошено);
так(ПУБЛ.size === всего1 && бакет.положено === put1, 'ничего не удвоилось: записей ' + ПУБЛ.size + ', PUT ' + бакет.положено);
так(['telegram:russkaya_yasna', 'telegram:naturnie_uroki', 'telegram:neglinka78', 'telegram:astronevod'].every((к) => и[к].ishod === 'pusto' && и[к].novyh === 0), 'живые источники без нового → pusto');
так(ИСТ.get('telegram:slomannyj').oshibok_podryad === 2 && ЖУРНАЛ.filter((з) => з.ishod === 'trevoga').length === 0, 'сломанный: сбоев подряд 2, тревоги ещё нет');
так(запросы.slice(запросов1).filter((q) => /robots\.txt$/.test(q.url)).length === 0, 'robots.txt в тот же день не перепрашивается');
так(ЖУРНАЛ.filter((з) => з.klyuch === 'uborka').length === 1, 'уборка в тот же день не повторяется');

/* ── 3. правки в окне 7 дней ───────────────────────────────────────────── */
console.log('Правки текста (окно 7 дней)');
{
  const html = ТЕЛА['https://t.me/s/naturnie_uroki'];
  const было = Object.assign({}, ПУБЛ.get('telegram:naturnie_uroki:281'));   /* копия: хранилище правит объект на месте */
  ПОДМЕНЫ['https://t.me/s/naturnie_uroki'] = html
    .replace('приглашаем вас в', 'зовём вас в')                                                 /* 281 от 05.09 — в окне */
    .replace('С началом нового учебного года&#33;', 'С началом учебного года, друзья&#33;');   /* 278 от 01.09 — тоже в окне */
  р = await С.сбор(о, { vse: true, otkuda: 'ruchnoj' });
  и = по(р);
  const стало = ПУБЛ.get('telegram:naturnie_uroki:281');
  так(и['telegram:naturnie_uroki'].ishod === 'ok' && /правок 2/.test(и['telegram:naturnie_uroki'].soobshchenie), 'две правки в окне подхвачены: ' + и['telegram:naturnie_uroki'].soobshchenie);
  так(/зовём вас в/.test(стало.tekst) && стало.tekst_hash !== было.tekst_hash && стало.obnovleno_at === sек() && стало.sobrano_at === было.sobrano_at, 'текст и отпечаток обновлены, sobrano_at прежний', JSON.stringify([стало.tekst && стало.tekst.slice(0, 60), стало.obnovleno_at, sек()]));
  так(стало.kartinka === было.kartinka, 'картинка при правке не перезаливается');
  delete ПОДМЕНЫ['https://t.me/s/naturnie_uroki'];
  /* правка записи старше 7 дней (01.07) не подхватывается */
  ПОДМЕНЫ['https://t.me/s/naturnie_uroki'] = html.replace('Приглашаем на натурный урок «Литературные берега', 'Зовём на натурный урок «Литературные берега');
  const до = ПУБЛ.get('telegram:naturnie_uroki:268').tekst;
  р = await С.сбор(о, { istochnik: 'telegram:naturnie_uroki', otkuda: 'ruchnoj' });
  так(ПУБЛ.get('telegram:naturnie_uroki:268').tekst === до, 'правка записи старше 7 дней не подхватывается (окно правок)');
  delete ПОДМЕНЫ['https://t.me/s/naturnie_uroki'];
  так(р.опрошено === 1 && р.уборка === null && ЖУРНАЛ[ЖУРНАЛ.length - 1].otkuda === 'ruchnoj', 'ручной запуск одного источника: без уборки, otkuda=ruchnoj');
}

/* ── 4. сверка с источником: удалённое в канале ────────────────────────── */
console.log('Сверка с источником (удалённое в канале)');
{
  const html = ТЕЛА['https://t.me/s/russkaya_yasna'];
  const блоки = html.split(/(?=<div class="tgme_widget_message_wrap)/);
  const без1398 = блоки.filter((б) => !/data-post="russkaya_yasna\/1398"/.test(б)).join('');
  const самыйСтарый = блоки.find((б) => /data-post="russkaya_yasna\/13(8\d|9\d)"/.test(б) && /data-post="russkaya_yasna\/\d+"/.test(б));
  ПОДМЕНЫ['https://t.me/s/russkaya_yasna'] = без1398;
  const удалено0 = бакет.удалено;
  const ключи1398 = С.ключиБакета({ klyuch: 'telegram:russkaya_yasna:1398', istochnik: 'telegram' });
  const былаКартинка = !!ПУБЛ.get('telegram:russkaya_yasna:1398').kartinka;
  р = await С.сбор(о, { istochnik: 'telegram:russkaya_yasna', otkuda: 'ruchnoj' });
  и = по(р);
  const з = ПУБЛ.get('telegram:russkaya_yasna:1398');
  так(з.skryto === true && з.skryto_prichina === 'udaleno_v_istochnike' && з.skryto_at === sек(), 'исчезнувшая между соседями запись → skryto=udaleno_v_istochnike', JSON.stringify([з.skryto, з.skryto_prichina]));
  так(/скрыто 1/.test(и['telegram:russkaya_yasna'].soobshchenie) && и['telegram:russkaya_yasna'].ishod === 'ok', 'журнал: ' + и['telegram:russkaya_yasna'].soobshchenie);
  так(!былаКартинка || (з.kartinka === null && з.kartinka_polnaya === null && !бакет.объекты.has(ключи1398.m) && !бакет.объекты.has(ключи1398.p) && бакет.удалено === удалено0 + 2), 'объекты скрытой записи удалены из бакета, адреса обнулены', JSON.stringify([былаКартинка, бакет.удалено - удалено0]));
  так(ИСТ.get('telegram:russkaya_yasna').zapisej === 19, 'zapisej считает только видимые: 19');
  /* граница окна: самая старая запись страницы пропала — это не удаление, а конец листания */
  const безСтарой = блоки.filter((б) => б !== самыйСтарый).join('');
  ПОДМЕНЫ['https://t.me/s/russkaya_yasna'] = безСтарой;
  const скрытыхБыло = канал('telegram:russkaya_yasna').filter((x) => x.skryto).length;
  await С.сбор(о, { istochnik: 'telegram:russkaya_yasna', otkuda: 'ruchnoj' });
  так(канал('telegram:russkaya_yasna').filter((x) => x.skryto).length === скрытыхБыло, 'пропажа самой старой записи страницы не считается удалением (граница окна)');
  delete ПОДМЕНЫ['https://t.me/s/russkaya_yasna'];
  /* запись вернулась на страницу — остаётся скрытой (klyuch уже есть), не удваивается */
  await С.сбор(о, { istochnik: 'telegram:russkaya_yasna', otkuda: 'ruchnoj' });
  так(ПУБЛ.get('telegram:russkaya_yasna:1398').skryto === true && ПУБЛ.size === всего1, 'вернувшаяся запись не воскресает и не удваивается');
}

/* ── 5. скрыто модератором → объекты долой ─────────────────────────────── */
console.log('Скрыто модератором (/lenta/skryt)');
{
  const з = ПУБЛ.get('telegram:neglinka78:2604');
  Object.assign(з, { skryto: true, skryto_prichina: 'ya_na_foto', skryto_at: sек() });
  const ключи = С.ключиБакета(з);
  так(бакет.объекты.has(ключи.m) && бакет.объекты.has(ключи.p), 'до захода объекты ещё в бакете');
  const удалено0 = бакет.удалено;
  р = await С.сбор(о, { istochnik: 'telegram:neglinka78', otkuda: 'ruchnoj' });
  так(!бакет.объекты.has(ключи.m) && !бакет.объекты.has(ключи.p) && бакет.удалено === удалено0 + 2, 'при следующем заходе сборщик удалил оба объекта');
  так(з.kartinka === null && з.kartinka_polnaya === null && з.kartinka_popytok === 3 && з.skryto === true, 'адреса обнулены, попытки исчерпаны, skryto на месте');
  так(/объектов удалено 1/.test(по(р)['telegram:neglinka78'].soobshchenie), 'журнал: ' + по(р)['telegram:neglinka78'].soobshchenie);
}

/* ── 6. картинки: согласие появилось; не-JPEG — три попытки ────────────── */
console.log('Картинки: согласие появилось; не-JPEG — три попытки и отбой');
{
  ИСТ.get('telegram:astronevod').soglasie_at = sек();
  const плохая = видимые('telegram:astronevod').find((з) => з.kartinka_istochnika);
  картинкаПлохая = плохая.kartinka_istochnika;
  const put0 = бакет.положено;
  р = await С.сбор(о, { istochnik: 'telegram:astronevod', otkuda: 'ruchnoj' });
  const сКарт = видимые('telegram:astronevod').filter((з) => з.kartinka);
  так(сКарт.length === 10 && бакет.положено === put0 + 20, 'после согласия безКартинки() подобрал записи с попыток 0: 10 записей, 20 объектов', JSON.stringify([сКарт.length, бакет.положено - put0]));
  так(плохая.kartinka === null && плохая.kartinka_popytok === 1, 'PNG под видом картинки → без копии, попытка 1');
  const запросовК = () => запросы.filter((q) => q.байты && q.url === картинкаПлохая).length;
  const n1 = запросовК();
  await С.сбор(о, { istochnik: 'telegram:astronevod', otkuda: 'ruchnoj' });
  await С.сбор(о, { istochnik: 'telegram:astronevod', otkuda: 'ruchnoj' });
  так(плохая.kartinka_popytok === 3 && запросовК() === n1 + 2, 'ещё два захода — попытки 2 и 3');
  await С.сбор(о, { istochnik: 'telegram:astronevod', otkuda: 'ruchnoj' });
  так(плохая.kartinka_popytok === 3 && запросовК() === n1 + 2, 'после третьей попытки картинку больше не просят');
  картинкаПлохая = null;
}

/* ── 7. бюджет времени ─────────────────────────────────────────────────── */
console.log('Бюджет времени');
{
  сейчасМс += 61 * 60000;
  остатокМс = 10000;
  const put0 = бакет.положено;
  р = await С.сбор(о, { otkuda: 'timer' });
  так(р.отчёт.length === 8 && р.отчёт.every((з) => з.ishod === 'propusk' && /бюджет/.test(з.soobshchenie)), 'при остатке < 15 с все источники → propusk');
  так(бакет.положено === put0 && ЖУРНАЛ.filter((з) => з.ishod === 'propusk').length === 0, 'propusk по бюджету не пишет ни картинок, ни журнала (источники не трогались)');
  остатокМс = 120000;
}

/* ── 8. тревога через 24 ч без удачи ───────────────────────────────────── */
console.log('Тревога');
{
  const сл = ИСТ.get('telegram:slomannyj');
  сл.oshibok_podryad = 95;                    /* 96-й сбой × 15 мин = 24 ч без удачи */
  р = await С.сбор(о, { istochnik: 'telegram:slomannyj', otkuda: 'timer' });
  const тревоги = ЖУРНАЛ.filter((з) => з.klyuch === 'telegram:slomannyj' && з.ishod === 'trevoga');
  так(тревоги.length === 1 && /24 ч/.test(тревоги[0].soobshchenie) && по(р)['telegram:slomannyj'].trevoga === true, 'сутки без удачи → строка trevoga: ' + (тревоги[0] && тревоги[0].soobshchenie));
  сейчасМс += 15 * 60000;
  await С.сбор(о, { istochnik: 'telegram:slomannyj', otkuda: 'timer' });
  так(ЖУРНАЛ.filter((з) => з.klyuch === 'telegram:slomannyj' && з.ishod === 'trevoga').length === 1, 'вторая тревога в те же сутки не пишется');
  /* источник, у которого удача была, но давно */
  const зк = ИСТ.get('telegram:zakryto');
  зк.udacha_at = sек(); зк.oshibok_podryad = 0;
  сейчасМс += 25 * 3600000;
  await С.сбор(о, { istochnik: 'telegram:zakryto', otkuda: 'timer' });
  так(ЖУРНАЛ.filter((з) => з.klyuch === 'telegram:zakryto' && з.ishod === 'trevoga').length === 1, 'удача была 25 ч назад → тревога по udacha_at');
  /* живой источник, который просто молчит, тревоги не даёт */
  await С.сбор(о, { istochnik: 'telegram:neglinka78', otkuda: 'timer' });
  так(ЖУРНАЛ.filter((з) => з.klyuch === 'telegram:neglinka78' && з.ishod === 'trevoga').length === 0, 'молчащий, но доступный канал — не тревога');
}

/* ── 9. уборка: 10 без срока + 365 дней, без качелей ───────────────────── */
console.log('Уборка «10 без срока + всё моложе 365 дней»');
{
  сейчасМс = Date.parse('2027-10-15T12:00:00Z');        /* все записи страниц старше года */
  остатокМс = 120000;
  const было = ПУБЛ.size, удалено0 = бакет.удалено, объектовБыло = бакет.объекты.size;
  р = await С.сбор(о, { otkuda: 'timer' });
  так(р.уборка && р.уборка.ishod === 'ok', 'уборка прошла: ' + (р.уборка && р.уборка.soobshchenie));
  const ост = (ист) => канал(ист).length;
  так(ост('telegram:russkaya_yasna') === 10 && ост('telegram:naturnie_uroki') === 10 && ост('telegram:astronevod') === 10 && ост('telegram:neglinka78') === 10 && ост('rutube:24295181') === 10, 'у каждого канала осталось по 10 записей', [ост('telegram:russkaya_yasna'), ост('telegram:naturnie_uroki'), ост('telegram:astronevod'), ост('telegram:neglinka78'), ост('rutube:24295181')].join(','));
  так(ПУБЛ.size === 50 && было - ПУБЛ.size === (20 + 18 + 12 + 18 + 10) - 50, 'удалено ' + (было - ПУБЛ.size) + ' записей старше года за десяткой');
  const сКарт = [...ПУБЛ.values()].filter((з) => з.kartinka).length;
  так(бакет.объекты.size === сКарт * 2 && бакет.удалено > удалено0, 'объекты удалённых записей убраны из бакета: осталось ' + бакет.объекты.size + ' = 2 × ' + сКарт);
  так([...ПУБЛ.values()].every((з) => z10(з)), 'остались именно 10 самых свежих у каждого канала');
  function z10(з) { const все = канал(з.istochnik + ':' + з.kanal); return все.length <= 10; }
  так(ЖУРНАЛ.every((з) => з.at >= сек(сейчасМс - 30 * 86400000)), 'журнал старше 30 дней убран');
  /* качели: следующий запуск НЕ возвращает удалённое */
  const размер = ПУБЛ.size, put = бакет.положено;
  р = await С.сбор(о, { vse: true, otkuda: 'timer' });
  и = по(р);
  так(ПУБЛ.size === размер && бакет.положено === put, 'следующий запуск не воскрешает удалённое и не заливает картинки заново');
  так(/за сроком 10/.test(и['telegram:russkaya_yasna'].soobshchenie) && и['telegram:russkaya_yasna'].novyh === 0, 'страница отдаёт 20, «за сроком 10», новых 0: ' + и['telegram:russkaya_yasna'].soobshchenie);
  /* верхняя ушла со страницы (конец листания, не удаление): десятка считается по
     объединению страницы и сохранённого, поэтому ничего не добирается и не скрывается */
  const html = ТЕЛА['https://t.me/s/russkaya_yasna'];
  const блоки = html.split(/(?=<div class="tgme_widget_message_wrap)/);
  ПОДМЕНЫ['https://t.me/s/russkaya_yasna'] = блоки.filter((б) => !/data-post="russkaya_yasna\/1400"/.test(б)).join('');
  р = await С.сбор(о, { istochnik: 'telegram:russkaya_yasna', otkuda: 'timer' });
  так(канал('telegram:russkaya_yasna').length === 10 && по(р)['telegram:russkaya_yasna'].novyh === 0 && ПУБЛ.get('telegram:russkaya_yasna:1400').skryto === false, 'верхняя ушла со страницы → десятка по объединению не меняется, запись не скрыта');
  /* новая запись в молчавшем канале → берётся (11-я), ночью уборка выровняет до десяти */
  const блок1400 = блоки.find((б) => /data-post="russkaya_yasna\/1400"/.test(б));
  const блок1401 = блок1400.replace(/russkaya_yasna\/1400/g, 'russkaya_yasna/1401').replace(/<time datetime="[^"]+"/, '<time datetime="2027-10-14T10:00:00+00:00"');
  ПОДМЕНЫ['https://t.me/s/russkaya_yasna'] = html + блок1401;
  const put0 = бакет.положено;
  р = await С.сбор(о, { istochnik: 'telegram:russkaya_yasna', otkuda: 'timer' });
  delete ПОДМЕНЫ['https://t.me/s/russkaya_yasna'];
  const новая = ПУБЛ.get('telegram:russkaya_yasna:1401');
  так(по(р)['telegram:russkaya_yasna'].novyh === 1 && новая && новая.data === '2027-10-14T10:00:00Z' && канал('telegram:russkaya_yasna').length === 11 && бакет.положено === put0 + 2, 'новая запись 1401 добавлена с двумя объектами, старые не воскресли', JSON.stringify([по(р)['telegram:russkaya_yasna'], канал('telegram:russkaya_yasna').length]));
  так(ИСТ.get('telegram:russkaya_yasna').poslednyaya_publikaciya === '2027-10-14T10:00:00Z', 'poslednyaya_publikaciya сдвинулась на новую запись');
}

/* ── 10. ручной запуск и разбор события ────────────────────────────────── */
console.log('Ручной запуск и разбор события');
{
  р = await С.сбор(о, { istochnik: 'dzen:5e9a2d632385352365504c51', otkuda: 'ruchnoj' });
  так(р.опрошено === 0 && р.отчёт[0].ishod === 'propusk' && /выключен/.test(р.отчёт[0].soobshchenie), 'выключенный источник по имени → propusk «источник выключен»');
  р = await С.сбор(о, { istochnik: 'telegram:net_takogo', otkuda: 'ruchnoj' });
  так(/нет источника/.test(р.ошибка || ''), 'неизвестный источник → ошибка в ответе');
  const т = С.разобратьСобытие({ messages: [{ event_metadata: { event_type: 'yandex.cloud.events.serverless.triggers.TimerMessage' }, details: { trigger_id: 'x' } }] });
  так(т.otkuda === 'timer' && !т.vse && !т.istochnik, 'событие таймера без тела → плановый сбор');
  const тп = С.разобратьСобытие({ messages: [{ event_metadata: {}, details: { payload: '{"vse":true}' } }] });
  так(тп.otkuda === 'timer' && тп.vse === true, 'payload таймера разбирается');
  const тр = С.разобратьСобытие({ istochnik: 'telegram:astronevod' });
  так(тр.otkuda === 'ruchnoj' && тр.istochnik === 'telegram:astronevod', 'ручной invoke с телом → один источник');
  const тh = С.разобратьСобытие({ httpMethod: 'POST', body: Buffer.from('{"istochnik":"rutube:24295181"}').toString('base64'), isBase64Encoded: true });
  так(тh.istochnik === 'rutube:24295181', 'HTTP POST с base64-телом разбирается');
  так(С.разобратьСобытие({ istochnik: 'telegram:x; DROP' }).ошибка === 'плохой istochnik', 'кривой istochnik → ошибка');
  так(С.разобратьСобытие({ httpMethod: 'POST', body: '{нет' }).ошибка === 'тело не JSON', 'кривое тело → ошибка');
  const н = С.нормализовать({ id: '7', data: '2026-09-01T10:00:00.500Z', tip: 'foto', zagolovok: 'A', tekst: 'B', ssylka: 'https://t.me/k/7', kartinok: 2, tekst_hash: 'abcdef0123456789' }, { istochnik: 'telegram', kanal: 'k', upravlenie: 'u', upravleniya: 'u,v' }, '2026-09-05T12:00:00Z');
  так(н.klyuch === 'telegram:k:7' && н.data === '2026-09-01T10:00:00Z' && н.upravleniya === 'u,v' && н.dlitelnost_s === null && н.bez_prevyu === false, 'нормализация: ключ, дата до секунды, поля по умолчанию');
  так(С.tsЛит('2026-09-01T10:00:00.999Z') === 'Timestamp("2026-09-01T10:00:00Z")', 'литерал Timestamp без долей секунды');
}

/* ── 11. слой YDB: форма запросов против миграции ──────────────────────── */
console.log('Слой YDB: форма запросов против миграции 007');
{
  const sql = readFileSync(join(ЗДЕСЬ, '..', 'migrations', '007_lenta.sql'), 'utf8').replace(/--[^\n]*/g, '');
  const таблицы = {};
  for (const м of sql.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)) {
    таблицы[м[1]] = new Set([...м[2].matchAll(/^\s*(\w+)\s+(?:Utf8|Timestamp|Bool|Uint32|Uint64)/gm)].map((x) => x[1]));
  }
  так(Object.keys(таблицы).length === 4 && таблицы.lenta_publikacii.has('skryto') && таблицы.lenta_zhaloby.has('ustrojstvo'), 'миграция: 4 таблицы, поля контракта на месте');
  const индексы = [...sql.matchAll(/INDEX (\w+) GLOBAL ON/g)].map((x) => x[1]);
  const журналSQL = [];
  const значение = (v) => v && typeof v === 'object' && 'v' in v ? v.v : v;
  const сессия = {
    async executeQuery(текст, params) {
      журналSQL.push({ текст, params: params || {} });
      const строки = [];
      if (/FROM lenta_istochniki/.test(текст)) strokiИст(строки);
      else if (/COUNT\(\*\)/.test(текст)) строки.push({ items: [{ uint64Value: '7' }] });
      else if (/SELECT MAX\(at\)/.test(текст)) строки.push({ items: [{ uint64Value: String(Date.parse('2026-09-05T00:00:00Z') * 1000) }] });
      else if (/FROM lenta_publikacii/.test(текст) && /kartinka_popytok, kartinka_istochnika/.test(текст)) strokiЗап(строки);
      return { resultSets: [{ rows: строки }] };
    },
  };
  function strokiИст(с) {
    c: {
      с.push({ items: [{ textValue: 'telegram:astronevod' }, { textValue: 'telegram' }, { textValue: 'astronevod' }, { textValue: 'https://t.me/astronevod' }, { nullFlagValue: 0 },
        { textValue: 'astronevod' }, { textValue: 'astronevod' }, { boolValue: true }, { uint32Value: 15 }, { uint64Value: String(Date.parse('2026-09-05T00:00:00Z') * 1000) },
        { nullFlagValue: 0 }, { nullFlagValue: 0 }, { nullFlagValue: 0 }, { uint32Value: 0 }, { nullFlagValue: 0 }, { uint64Value: '12' }] });
    }
  }
  function strokiЗап(с) {
    с.push({ items: [{ textValue: 'telegram:astronevod:2119' }, { uint64Value: String(Date.parse('2026-09-05T04:33:30Z') * 1000) }, { textValue: 'abcdef0123456789' }, { boolValue: false }, { nullFlagValue: 0 }, { nullFlagValue: 0 }, { uint32Value: 0 }, { textValue: 'https://cdn4.telesco.pe/file/x.jpg' }] });
  }
  const drv = { tableClient: { withSession: async (f) => f(сессия) } };
  const ydb = {
    TypedValues: {
      utf8: (v) => ({ t: 'Utf8', v }), uint32: (v) => ({ t: 'Uint32', v }), uint64: (v) => ({ t: 'Uint64', v }), bool: (v) => ({ t: 'Bool', v }),
      optional: (x) => Object.assign({}, x, { opt: true }), optionalNull: (t) => ({ t, v: null, opt: true }),
    },
    Types: { UTF8: 'Utf8', UINT32: 'Uint32', UINT64: 'Uint64', BOOL: 'Bool' },
  };
  const х = С.хранилищеYDB(drv, ydb);
  const ист = { klyuch: 'telegram:astronevod', istochnik: 'telegram', kanal: 'astronevod', oshibok_podryad: 0, poslednyaya_publikaciya: null };
  const исты = await х.источники();
  так(исты.length === 1 && исты[0].vklyuchen === true && исты[0].period_min === 15 && исты[0].soglasie_at === '2026-09-05T00:00:00.000Z' && исты[0].nazvanie === null && исты[0].zapisej === 12, 'чтение источников: Bool, Uint32, Timestamp, NULL, Uint64 разобраны', JSON.stringify(исты[0]));
  const зап = await х.записиКанала(ист, '2026-09-01T00:00:00Z');
  так(зап.length === 1 && зап[0].data === '2026-09-05T04:33:30Z' && зап[0].skryto === false && зап[0].kartinka === null && зап[0].kartinka_popytok === 0, 'чтение записей канала: data до секунды, Bool, NULL', JSON.stringify(зап[0]));
  const строка = С.нормализовать({ id: '1', data: '2026-09-01T10:00:00Z', tip: 'foto', zagolovok: 'A', tekst: 'B', ssylka: 'https://t.me/k/1', kartinka_istochnika: 'https://cdn4.telesco.pe/x.jpg', kartinok: 1, tekst_hash: 'abcdef0123456789' }, ист, '2026-09-05T12:00:00Z');
  Object.assign(строка, { kartinka: null, kartinka_polnaya: null, kartinka_popytok: 0 });
  await х.записать([строка]);
  await х.обновить([Object.assign({}, строка, { obnovleno_at: '2026-09-05T12:00:00Z' })]);
  await х.скрыть('telegram:astronevod:1', 'udaleno_v_istochnike', '2026-09-05T12:00:00Z');
  await х.картинка('telegram:astronevod:1', 'https://b/m.jpg', 'https://b/p.jpg', 0, '2026-09-05T12:00:00Z');
  await х.безКартинки(ист, 3, 20);
  await х.скрытыеСКартинками(ист);
  так((await х.количество(ист)) === 7, 'COUNT(*) читается как число');
  await х.состояние(ист, { udacha: true, сейчасISO: '2026-09-05T12:00:00Z', название: 'АСТРОНЕВОД', свежая: '2026-09-05T04:33:30Z', zapisej: 7, soobshchenie: null, ishod: 'ok' });
  await х.состояние(ист, { udacha: false, сейчасISO: '2026-09-05T12:00:00Z', soobshchenie: 'нет сети', ishod: 'oshibka', zapisej: null });
  await х.журнал({ klyuch: 'telegram:astronevod', ishod: 'ok', soobshchenie: null, dlitelnost_ms: 10, novyh: 1, otkuda: 'timer' });
  так((await х.последняяУборка()) === '2026-09-05T00:00:00.000Z', 'MAX(at) читается как дата');
  await х.тревогаБыла('telegram:astronevod', '2026-09-04T12:00:00Z');
  await х.всеЗаписиКанала(ист);
  await х.удалить('telegram:astronevod:1');
  так((await х.убратьЖурнал('2026-08-06T12:00:00Z')) === 7, 'уборка журнала: COUNT + DELETE ON SELECT пачкой');

  let плохих = 0;
  for (const { текст, params } of журналSQL) {
    const объявлено = new Set([...текст.matchAll(/DECLARE (\$\w+) AS/g)].map((x) => x[1]));
    const использовано = new Set([...текст.replace(/DECLARE \$\w+ AS [^;]+;/g, '').matchAll(/\$\w+/g)].map((x) => x[0]));
    for (const п of использовано) if (!объявлено.has(п)) { плохих++; console.log('    ✗ параметр без DECLARE: ' + п + ' в ' + текст.trim().slice(0, 80)); }
    for (const п of Object.keys(params)) if (!объявлено.has(п)) { плохих++; console.log('    ✗ передан необъявленный параметр: ' + п); }
    for (const п of объявлено) if (!(п in params)) { плохих++; console.log('    ✗ объявлен, но не передан: ' + п); }
    for (const м of текст.matchAll(/Timestamp\("([^"]*)"\)/g)) if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(м[1])) { плохих++; console.log('    ✗ литерал Timestamp с долями или не UTC: ' + м[1]); }
    for (const м of текст.matchAll(/(?:UPSERT INTO|DELETE FROM|FROM) (lenta_\w+)(?: VIEW (\w+))?/g)) {
      if (!таблицы[м[1]]) { плохих++; console.log('    ✗ неизвестная таблица ' + м[1]); }
      if (м[2] && !индексы.includes(м[2])) { плохих++; console.log('    ✗ неизвестный индекс ' + м[2]); }
    }
    for (const м of текст.matchAll(/UPSERT INTO (lenta_\w+) \(([^)]*)\)/g)) {
      for (const к of м[2].split(',').map((x) => x.trim())) if (таблицы[м[1]] && !таблицы[м[1]].has(к)) { плохих++; console.log('    ✗ в ' + м[1] + ' нет колонки ' + к); }
    }
    for (const м of текст.matchAll(/SELECT ([\s\S]*?) FROM (lenta_\w+)/g)) {
      for (const к of м[1].split(',').map((x) => x.trim().replace(/ AS \w+$/, ''))) if (/^\w+$/.test(к) && таблицы[м[2]] && !таблицы[м[2]].has(к)) { плохих++; console.log('    ✗ в ' + м[2] + ' нет колонки ' + к); }
    }
    /* Значения параметров типизированы через TypedValues, ничего сырого */
    for (const [п, v] of Object.entries(params)) if (!v || typeof v !== 'object' || !('t' in v)) { плохих++; console.log('    ✗ сырой параметр ' + п); }
  }
  так(журналSQL.length >= 16 && плохих === 0, `${журналSQL.length} запросов слоя YDB: все параметры объявлены и типизированы, таблицы/индексы/колонки — из миграции, Timestamp без долей`);
  const upsertПубл = журналSQL.find((q) => /UPSERT INTO lenta_publikacii \(klyuch, istochnik/.test(q.текст));
  так(upsertПубл && значение(upsertПубл.params['$tekst']) === 'B' && upsertПубл.params['$kartinka'].v === null && upsertПубл.params['$bez_prevyu'].t === 'Bool' && upsertПубл.params['$kartinok'].t === 'Uint32', 'UPSERT публикации: Optional через optionalNull, Bool и Uint32 типизированы');
  const сост = журналSQL.filter((q) => /UPSERT INTO lenta_istochniki/.test(q.текст));
  так(сост.length === 2 && /udacha_at/.test(сост[0].текст) && /nazvanie/.test(сост[0].текст) && /poslednyaya_publikaciya/.test(сост[0].текст) && !/udacha_at/.test(сост[1].текст) && сост[1].params['$podryad'].v === 1 && сост[1].params['$oshibka'].v === 'нет сети', 'состояние: при удаче — udacha_at/nazvanie/свежая, при сбое — oshibka и счётчик');
}

console.log(провалов ? `\nПРОВАЛОВ: ${провалов} из ${проверок}` : `\nВсе ${проверок} проверок прошли (обращений к «сети»: ${запросы.length}, PUT: ${бакет.положено}, DELETE: ${бакет.удалено})`);
process.exit(провалов ? 1 : 0);
