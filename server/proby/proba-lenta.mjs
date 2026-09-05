/* Прогон server/lenta.js на поддельной базе в памяти: сети и YDB не нужно.
   Поддельная сессия разбирает ровно те запросы, которые шлёт модуль, и
   держит четыре «таблицы» обычными массивами. Модуль прав (access.js) тянет
   ydb-sdk, которого на машине нет, — подменяем его через require.cache.

   Запуск:  node server/proby/proba-lenta.mjs   (PATH с node 22, см. README)   */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const здесь = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(здесь, '..', 'lenta.js'));

/* ── подмена прав ──────────────────────────────────────────────────────── */
let ПРАВА = { isSuperadmin: false, caps: [] };
let праваЛомаются = false;
const путьПрав = require.resolve('./access.js');
require.cache[путьПрав] = {
  id: путьПрав, filename: путьПрав, loaded: true,
  exports: { resolveAccess: async () => { if (праваЛомаются) throw new Error('права недоступны'); return ПРАВА; } },
};
const Л = require('./lenta.js');

/* ── данные ────────────────────────────────────────────────────────────── */
const СЕЙЧАС = Date.parse('2026-09-05T12:00:00Z');
const iso = (мс) => new Date(мс).toISOString().slice(0, 19) + 'Z';
const назад = (дней, часов = 0) => iso(СЕЙЧАС - дней * 86400000 - часов * 3600000);

const ИСТ = [
  { klyuch: 'telegram:russkaya_yasna', istochnik: 'telegram', kanal: 'russkaya_yasna', adres: 'https://t.me/russkaya_yasna',
    nazvanie: 'Русская Ясна', upravlenie: 'yasna-shkola', upravleniya: 'yasna-shkola,granika,centr', vklyuchen: true, period_min: 15,
    soglasie_at: назад(30), vedushchij: null, proveren_at: назад(0, 1), udacha_at: назад(0, 1), oshibka: null, oshibok_podryad: 0,
    posl: назад(0, 2), zapisej: 30 },
  { klyuch: 'telegram:astronevod', istochnik: 'telegram', kanal: 'astronevod', adres: 'https://t.me/astronevod',
    nazvanie: 'Астроневод', upravlenie: 'astronevod', upravleniya: 'astronevod', vklyuchen: true, period_min: 15,
    soglasie_at: null, vedushchij: 'Иван Петров', proveren_at: назад(0, 1), udacha_at: назад(0, 1), oshibka: null, oshibok_podryad: 0,
    posl: назад(1), zapisej: 15 },
  { klyuch: 'telegram:naturnie_uroki', istochnik: 'telegram', kanal: 'naturnie_uroki', adres: 'https://t.me/naturnie_uroki',
    nazvanie: 'Натурные уроки', upravlenie: 'marshruty', upravleniya: 'marshruty', vklyuchen: true, period_min: 15,
    soglasie_at: назад(20), vedushchij: null, proveren_at: назад(0, 1), udacha_at: назад(0, 1), oshibka: null, oshibok_podryad: 0,
    posl: назад(2), zapisej: 12 },
  { klyuch: 'telegram:neglinka78', istochnik: 'telegram', kanal: 'neglinka78', adres: 'https://t.me/neglinka78',
    nazvanie: 'Неглинка', upravlenie: 'neglinka', upravleniya: 'neglinka', vklyuchen: true, period_min: 15,
    soglasie_at: назад(20), vedushchij: null, proveren_at: назад(0, 1), udacha_at: назад(0, 1), oshibka: null, oshibok_podryad: 0,
    posl: назад(71), zapisej: 8 },
  { klyuch: 'rutube:24295181', istochnik: 'rutube', kanal: '24295181', adres: 'https://rutube.ru/channel/24295181',
    nazvanie: 'Русская Ясна', upravlenie: 'yasna-shkola', upravleniya: 'yasna-shkola', vklyuchen: true, period_min: 60,
    soglasie_at: null, vedushchij: null, proveren_at: назад(0, 3), udacha_at: назад(0, 3), oshibka: null, oshibok_podryad: 0,
    posl: назад(160), zapisej: 5 },
  /* сломанный: три сбоя подряд, удача была 3 часа назад */
  { klyuch: 'telegram:aleksandriya_2026', istochnik: 'telegram', kanal: 'aleksandriya_2026', adres: 'https://t.me/aleksandriya_2026',
    nazvanie: null, upravlenie: 'alexandria', upravleniya: 'alexandria', vklyuchen: true, period_min: 60,
    soglasie_at: null, vedushchij: null, proveren_at: назад(0, 1), udacha_at: назад(0, 3), oshibka: 'HTTP 429', oshibok_podryad: 3,
    posl: null, zapisej: 0 },
  /* тревога: опрашивается, но удачи не было двое суток */
  { klyuch: 'dzen:5e9a2d632385352365504c51', istochnik: 'dzen', kanal: '5e9a2d632385352365504c51', adres: 'https://dzen.ru/id/5e9a',
    nazvanie: null, upravlenie: 'izvod', upravleniya: 'izvod', vklyuchen: true, period_min: 60,
    soglasie_at: null, vedushchij: null, proveren_at: назад(0, 1), udacha_at: назад(2), oshibka: 'разметка', oshibok_podryad: 40,
    posl: null, zapisej: 0 },
  /* не проверен: ни разу не опрашивался */
  { klyuch: 'telegram:novyj', istochnik: 'telegram', kanal: 'novyj', adres: 'https://t.me/novyj',
    nazvanie: null, upravlenie: 'dzhiva', upravleniya: 'dzhiva', vklyuchen: true, period_min: 15,
    soglasie_at: null, vedushchij: null, proveren_at: null, udacha_at: null, oshibka: null, oshibok_podryad: 0,
    posl: null, zapisej: 0 },
  { klyuch: 'youtube:UCHR0m', istochnik: 'youtube', kanal: 'UCHR0m', adres: 'https://youtube.com/@russkaya_yasna',
    nazvanie: null, upravlenie: 'yasna-shkola', upravleniya: 'yasna-shkola', vklyuchen: false, period_min: 1440,
    soglasie_at: null, vedushchij: null, proveren_at: null, udacha_at: null, oshibka: null, oshibok_podryad: 0,
    posl: null, zapisej: 0 },
];

const ПУБЛ = [];
let счёт = 0;
function пуб(istochnik, kanal, data, доп = {}) {
  const id = String(1000 + (++счёт));
  const з = Object.assign({
    klyuch: istochnik + ':' + kanal + ':' + id, istochnik, kanal, id, data,
    upravlenie: null, upravleniya: null, tip: 'tekst',
    zagolovok: 'Запись ' + id + ' канала ' + kanal, tekst: 'Текст записи ' + id + ' — несколько слов о том, что случилось.',
    ssylka: 'https://t.me/' + kanal + '/' + id, kartinka: null, kartinka_polnaya: null, kartinok: null,
    dlitelnost_s: null, bez_prevyu: false, ssylka_v_zapisi: null, skryto: false,
  }, доп);
  ПУБЛ.push(з);
  return з;
}
/* russkaya_yasna: густо за последние дни (9 из верхних 20 — один канал) */
for (let i = 0; i < 12; i++) пуб('telegram', 'russkaya_yasna', назад(0, 2 + i * 5), {
  tip: i % 3 === 0 ? 'foto' : 'tekst', upravleniya: 'yasna-shkola,granika,centr', upravlenie: 'yasna-shkola',
  kartinka: i % 3 === 0 ? 'https://storage.yandexcloud.net/yasnalab.ru/lenta/telegram/r' + i + '-m.jpg' : null,
  kartinka_polnaya: i % 3 === 0 ? 'https://storage.yandexcloud.net/yasnalab.ru/lenta/telegram/r' + i + '.jpg' : null,
  kartinok: i % 3 === 0 ? 2 : null,
});
for (let i = 0; i < 18; i++) пуб('telegram', 'russkaya_yasna', назад(4 + i * 3), { upravleniya: 'yasna-shkola,granika,centr', upravlenie: 'yasna-shkola' });
/* astronevod: без согласия — картинка в базе есть, наружу не идёт */
for (let i = 0; i < 15; i++) пуб('telegram', 'astronevod', назад(1 + i * 2, 3), {
  tip: 'foto', upravlenie: 'astronevod', upravleniya: 'astronevod',
  kartinka: 'https://storage.yandexcloud.net/yasnalab.ru/lenta/telegram/a' + i + '-m.jpg',
  kartinka_polnaya: 'https://storage.yandexcloud.net/yasnalab.ru/lenta/telegram/a' + i + '.jpg', kartinok: 1,
});
for (let i = 0; i < 12; i++) пуб('telegram', 'naturnie_uroki', назад(2 + i * 4, 7), {
  tip: i === 0 ? 'ssylka' : 'anons', upravlenie: 'marshruty', upravleniya: 'marshruty',
  ssylka_v_zapisi: i === 0 ? 'https://vkvideo.ru/video-123_456?ref=1' : null,
});
for (let i = 0; i < 8; i++) пуб('telegram', 'neglinka78', назад(71 + i * 9, 1), { upravlenie: 'neglinka', upravleniya: 'neglinka' });
for (let i = 0; i < 5; i++) пуб('rutube', '24295181', назад(160 + i * 200, 5), {
  tip: 'video', upravlenie: 'yasna-shkola', upravleniya: 'yasna-shkola', zagolovok: 'Урок ' + (i + 1),
  tekst: 'описание, которого наружу быть не должно', ssylka: 'https://rutube.ru/video/x' + i + '/', dlitelnost_s: 1800 + i,
});
/* два видео в Телеграме — под «Видео» вместе с Rutube */
пуб('telegram', 'russkaya_yasna', назад(9, 4), { tip: 'video', dlitelnost_s: 95, upravleniya: 'yasna-shkola,granika,centr', upravlenie: 'yasna-shkola' });
пуб('telegram', 'astronevod', назад(12, 4), { tip: 'video', dlitelnost_s: 61, upravlenie: 'astronevod', upravleniya: 'astronevod' });
/* альбом: три записи с одной секундой — курсор разводит по klyuch */
const секундаАльбома = назад(3, 1);
for (let i = 0; i < 3; i++) пуб('telegram', 'naturnie_uroki', секундаАльбома, { tip: 'foto', upravlenie: 'marshruty', upravleniya: 'marshruty' });
/* самые свежие — скрытые: наружу не идут никогда */
const СКРЫТАЯ = пуб('telegram', 'astronevod', назад(0, 0), { skryto: true, upravlenie: 'astronevod', upravleniya: 'astronevod' });
пуб('telegram', 'russkaya_yasna', назад(0, 1), { skryto: true, upravleniya: 'yasna-shkola,granika,centr', upravlenie: 'yasna-shkola' });
/* длинные тексты — обрезка контрактом */
const ДЛИННАЯ = пуб('telegram', 'naturnie_uroki', назад(0, 6), {
  upravlenie: 'marshruty', upravleniya: 'marshruty',
  zagolovok: 'Заголовок '.repeat(20), tekst: 'слово '.repeat(120),
});

const видимые = () => ПУБЛ.filter((з) => !з.skryto);
const сравн = (a, b) => (a.data !== b.data ? (a.data < b.data ? 1 : -1) : (a.klyuch < b.klyuch ? 1 : a.klyuch > b.klyuch ? -1 : 0));

/* ── поддельная база ───────────────────────────────────────────────────── */
const мкс = (iso) => (iso ? { uint64Value: String(Date.parse(iso) * 1000) } : {});
const т = (s) => ({ textValue: s == null ? null : String(s) });
const ч = (n) => (n == null ? {} : { uint32Value: n });
const б = (v) => (v == null ? {} : { boolValue: !!v });

const ЖУРНАЛ = [], ЖАЛОБЫ = [], ЧАСТОТА = new Map();
/* device_auth (миграция 002): привязанные устройства — device_id → sha256(секрет).
   Жалобу принимает только привязанное устройство; чужой секрет — 403. */
const хешСекрета = (с) => createHash('sha256').update(с).digest('hex');
const УСТРОЙСТВА = new Map([
  ['dev-1', хешСекрета('секрет-устройства-1')],
  ['dev-2', хешСекрета('другое-устройство')],
  ['dev-3', хешСекрета('третье-устройство')],
]);
let базаЛежит = false, запросовПубликаций = 0, журналЛомается = false, обращенийКУстройствам = 0;

const сессия = {
  async executeQuery(sql, p = {}) {
    if (базаЛежит) throw new Error('Transport unavailable: connection refused');
    const v = (k) => (p[k] ? (p[k].v === undefined ? null : p[k].v) : null);
    if (/FROM lenta_istochniki/.test(sql)) {
      return { resultSets: [{ rows: ИСТ.map((и) => ({ items: [
        т(и.klyuch), т(и.istochnik), т(и.kanal), т(и.adres), т(и.nazvanie), т(и.upravlenie), т(и.upravleniya), б(и.vklyuchen),
        ч(и.period_min), т(null), мкс(и.soglasie_at), т(null), т(и.vedushchij),
        мкс(и.proveren_at), мкс(и.udacha_at), т(и.oshibka), ч(и.oshibok_podryad), мкс(и.posl), { uint64Value: String(и.zapisej) },
      ] })) }] };
    }
    if (/FROM lenta_publikacii VIEW/.test(sql)) {
      запросовПубликаций++;
      if (!/\(skryto IS NULL OR skryto = false\)/.test(sql)) throw new Error('запрос без условия skryto');
      if (!/ORDER BY data DESC, klyuch DESC LIMIT \$n/.test(sql)) throw new Error('запрос без порядка/предела');
      const объявлено = [...sql.matchAll(/DECLARE (\$\w+)/g)].map((m) => m[1]);
      for (const k of Object.keys(p)) if (объявлено.indexOf(k) < 0) throw new Error('параметр без DECLARE: ' + k);
      for (const k of объявлено) if (!(k in p)) throw new Error('DECLARE без параметра: ' + k);
      let ряд = ПУБЛ.slice();
      if (/VIEW lenta_publikacii_po_kanalu/.test(sql)) {
        if (!/istochnik = \$i AND kanal = \$c/.test(sql)) throw new Error('канал без условия');
        ряд = ряд.filter((з) => з.istochnik === v('$i') && з.kanal === v('$c'));
      }
      if (/tip = \$tip/.test(sql)) ряд = ряд.filter((з) => з.tip === v('$tip'));
      if (/istochnik <> "rutube"u/.test(sql)) ряд = ряд.filter((з) => з.istochnik !== 'rutube');
      const м = /data ([<>]) Timestamp\("(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)"\)/.exec(sql);
      if (м) {
        const kd = м[2], kk = v('$kk');
        if (/Timestamp\("[^"]*\.\d/.test(sql)) throw new Error('литерал Timestamp с долями секунды');
        ряд = м[1] === '<'
          ? ряд.filter((з) => з.data < kd || (з.data === kd && з.klyuch < kk))
          : ряд.filter((з) => з.data > kd || (з.data === kd && з.klyuch > kk));
      } else if (/\$kk/.test(sql)) throw new Error('курсор без литерала Timestamp');
      ряд = ряд.filter((з) => !з.skryto);
      ряд.sort(сравн);
      ряд = ряд.slice(0, Number(v('$n')));
      return { resultSets: [{ rows: ряд.map((з) => ({ items: [
        т(з.klyuch), т(з.istochnik), т(з.kanal), т(з.id), мкс(з.data), т(з.upravlenie), т(з.upravleniya), т(з.tip),
        т(з.zagolovok), т(з.tekst), т(з.ssylka), т(з.kartinka), т(з.kartinka_polnaya), ч(з.kartinok), ч(з.dlitelnost_s),
        б(з.bez_prevyu), т(з.ssylka_v_zapisi),
      ] })) }] };
    }
    if (/SELECT klyuch, zagolovok, ssylka, skryto FROM lenta_publikacii WHERE klyuch = \$k/.test(sql)) {
      const з = ПУБЛ.find((x) => x.klyuch === v('$k'));
      return { resultSets: [{ rows: з ? [{ items: [т(з.klyuch), т(з.zagolovok), т(з.ssylka), б(з.skryto)] }] : [] }] };
    }
    if (/UPDATE lenta_publikacii SET skryto = true/.test(sql)) {
      const з = ПУБЛ.find((x) => x.klyuch === v('$k'));
      if (з) { з.skryto = true; з.skryto_prichina = v('$p'); }
      if (/UPDATE lenta_zhaloby SET sostoyanie = "razobrana"u WHERE klyuch = \$k/.test(sql))
        for (const ж of ЖАЛОБЫ) if (ж.klyuch === v('$k')) ж.sostoyanie = 'razobrana';
      return { resultSets: [] };
    }
    if (/UPSERT INTO lenta_zhaloby/.test(sql)) {
      ЖАЛОБЫ.push({ klyuch: v('$k'), at: iso(Date.now()), prichina: v('$p'), tekst: v('$t'), kontakt: v('$c'), ustrojstvo: v('$u'), sostoyanie: v('$s') });
      return { resultSets: [] };
    }
    if (/SELECT COUNT\(\*\) AS n FROM lenta_zhaloby WHERE sostoyanie = \$s/.test(sql)) {
      return { resultSets: [{ rows: [{ items: [{ uint64Value: String(ЖАЛОБЫ.filter((ж) => ж.sostoyanie === v('$s')).length) }] }] }] };
    }
    if (/SELECT secret_hash FROM device_auth WHERE device_id = \$d/.test(sql)) {
      obращ();
      const х = УСТРОЙСТВА.get(v('$d'));
      return { resultSets: [{ rows: х ? [{ items: [т(х)] }] : [] }] };
    }
    if (/SELECT device_id FROM device_auth VIEW device_auth_po_secret_hash WHERE secret_hash = \$h/.test(sql)) {
      obращ();
      const д = [...УСТРОЙСТВА.entries()].find(([, х]) => х === v('$h'));
      return { resultSets: [{ rows: д ? [{ items: [т(д[0])] }] : [] }] };
    }
    if (/UPSERT INTO device_auth/.test(sql)) throw new Error('жалоба не должна привязывать устройство (TOFU здесь — дыра в лимите)');
    if (/FROM lenta_zhaloby/.test(sql)) {
      const ряд = ЖАЛОБЫ.filter((ж) => ж.sostoyanie === v('$s')).slice(0, Number(v('$n')));
      return { resultSets: [{ rows: ряд.map((ж) => ({ items: [т(ж.klyuch), мкс(ж.at), т(ж.prichina), т(ж.tekst), т(ж.kontakt), т(ж.ustrojstvo), т(ж.sostoyanie)] })) }] };
    }
    if (/FROM lenta_zhurnal/.test(sql)) {
      const ряд = ЖУРНАЛ.filter((з) => з.klyuch === v('$k')).slice(0, Number(v('$n')));
      return { resultSets: [{ rows: ряд.map((з) => ({ items: [мкс(з.at), т(з.ishod), т(з.soobshchenie), ч(з.dlitelnost_ms), ч(з.novyh)] })) }] };
    }
    if (/UPSERT INTO lenta_zhurnal/.test(sql)) {
      if (журналЛомается) throw new Error('журнал недоступен');
      ЖУРНАЛ.push({ klyuch: v('$k'), at: iso(Date.now()), ishod: 'prosmotr', soobshchenie: v('$s'), dlitelnost_ms: v('$d'), novyh: v('$n'), otkuda: v('$o') });
      return { resultSets: [] };
    }
    if (/SELECT window_start, hits FROM auth_throttle/.test(sql)) {
      const з = ЧАСТОТА.get(v('$b'));
      return { resultSets: [{ rows: з ? [{ items: [{ uint64Value: String(з.start * 1000) }, ч(з.hits)] }] : [] }] };
    }
    if (/UPSERT INTO auth_throttle \(bucket, window_start, hits\)/.test(sql)) {
      ЧАСТОТА.set(v('$b'), { start: Date.now(), hits: v('$h') }); return { resultSets: [] };
    }
    if (/UPSERT INTO auth_throttle \(bucket, hits\)/.test(sql)) {
      const з = ЧАСТОТА.get(v('$b')); if (!з) throw new Error('hits без окна'); з.hits = v('$h'); return { resultSets: [] };
    }
    throw new Error('поддельная база не знает запроса: ' + sql.trim().slice(0, 90));
  },
};
function obращ() { обращенийКУстройствам++; }
const drv = { tableClient: { withSession: async (f) => f(сессия) } };

/* ── помощники — как в auth-email.js (общий объект заголовков!) ─────────── */
const CORS = { 'Access-Control-Allow-Origin': 'https://yasnalab.ru', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const д = {
  TypedValues: {
    utf8: (v) => ({ v }), uint64: (v) => ({ v }), uint32: (v) => ({ v }), bool: (v) => ({ v }),
    optional: (v) => v, optionalNull: () => ({ v: null }),
  },
  Types: { UTF8: 'utf8' },
  ok: (obj, code) => ({ statusCode: code || 200, headers: CORS, body: JSON.stringify(obj) }),
  fail: (code, error, extra) => ({ statusCode: code, headers: CORS, body: JSON.stringify(Object.assign({ error }, extra || {})) }),
  txt: (x) => (x == null ? null : (x.textValue ?? null)),
  num: (x) => { const y = x?.uint64Value ?? x?.uint32Value ?? x?.int64Value ?? x?.int32Value; return y == null ? null : Number(String(y)); },
  ts: (x) => { const y = x?.uint64Value ?? x?.int64Value; return y == null ? null : new Date(Number(String(y)) / 1000).toISOString(); },
  clean: (raw, max) => { if (raw == null) return null; const s = String(raw).replace(/[\u0000-\u001f\u007f]/g, '').trim(); return s ? s.slice(0, max) : null; },
  ipHash: (event) => ((event && event.headers && event.headers['X-Forwarded-For']) || 'ip'),
  throttleHit: async () => true,
  verifyJWT: (t) => (t === 'token-ok' ? { sub: 'user-1' } : null),
  loadProfile: async () => null,
  mailer: { isConfigured: () => false },
};

const зов = async (method, path, query = {}, headers = {}, body = {}) => {
  const r = await Л.route(drv, { method, path, query, body, event: { headers }, д });
  let тело = null;
  try { тело = r.body ? JSON.parse(r.body) : null; } catch (_) { тело = { нечитаемо: r.body }; }
  return { statusCode: r.statusCode, headers: r.headers, тело, сырое: r.body };
};
const ТОКЕН = { Authorization: 'Bearer token-ok' };
const СЕКРЕТ = { 'X-Device-Secret': 'секрет-устройства-1' };

/* ── проверки ─────────────────────────────────────────────────────────── */
let провалов = 0, всего = 0;
function так(усл, имя, что) {
  всего++;
  console.log((усл ? '  ✓ ' : '  ✗ ') + имя + (усл || что === undefined ? '' : '  — ' + (typeof что === 'string' ? что : JSON.stringify(что)).slice(0, 300)));
  if (!усл) провалов++;
}
const безТретьихПодряд = (з) => з.every((x, i, a) => i < 2 || !(a[i - 1].kanal === x.kanal && a[i - 2].kanal === x.kanal && a[i - 1].istochnik === x.istochnik));

console.log('Общая лента');
let r = await зов('GET', '/lenta');
так(r.statusCode === 200, 'GET /lenta → 200', r.тело);
так(Array.isArray(r.тело.zapisi) && r.тело.zapisi.length === 20, '20 записей по умолчанию', r.тело.zapisi.length);
так(r.headers['Cache-Control'] === 'public, max-age=120', 'Cache-Control: public, max-age=120', r.headers);
так(CORS['Cache-Control'] === 'no-store' && д.ok({}).headers['Cache-Control'] === 'no-store', 'общий объект заголовков не тронут');
так(r.headers['Access-Control-Allow-Origin'] === 'https://yasnalab.ru', 'CORS-заголовки на месте');
так(typeof r.тело.dalshe === 'string' && r.тело.dalshe.length <= 200, 'dalshe — курсор ≤200 знаков', r.тело.dalshe);
так(r.тело.novyh === null, 'без posle novyh = null', r.тело.novyh);
так(JSON.stringify(r.тело.upravleniya_s_zapisyami) === JSON.stringify(['yasna-shkola', 'astronevod', 'marshruty', 'neglinka']),
  'upravleniya_s_zapisyami — по главному управлению, без granika/centr', r.тело.upravleniya_s_zapisyami);
так(r.тело.sobrano_at === назад(0, 1), 'sobrano_at — свежайшая удача источников', r.тело.sobrano_at);
const з0 = r.тело.zapisi[0];
const ПОЛЯ_ЗАПИСИ = ['id', 'istochnik', 'kanal', 'kanal_nazvanie', 'upravlenie', 'upravleniya', 'tip', 'zagolovok', 'tekst', 'ssylka',
  'kartinka', 'kartinka_polnaya', 'kartinok', 'data', 'dlitelnost_s', 'bez_prevyu', 'ssylka_v_zapisi', 'vedushchij', 'kursor'];
так(ПОЛЯ_ЗАПИСИ.every((п) => п in з0) && !('klyuch' in з0) && !('kanal_klyuch' in з0), 'запись — все поля контракта, без служебных', Object.keys(з0));
так(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(з0.data), 'data — ISO UTC до секунды', з0.data);
так(Л.курсорВ(з0.kursor).klyuch === з0.id && Л.курсорВ(з0.kursor).data === з0.data, 'курсор записи ходит туда и обратно');
так(r.тело.zapisi.every((з) => !з.id.includes(СКРЫТАЯ.id)) && !r.тело.zapisi.some((з) => з.data > назад(0, 2)), 'скрытые (самые свежие) не отданы');
так(r.тело.zapisi.every((з) => з.istochnik !== 'rutube'), 'Rutube в общей ленте нет');
так(безТретьихПодряд(r.тело.zapisi), 'перемежение: нет трёх подряд от одного канала', r.тело.zapisi.map((з) => з.kanal));
{
  const ожид = видимые().filter((з) => з.istochnik !== 'rutube').sort(сравн).slice(0, 20);
  так(new Set(r.тело.zapisi.map((з) => з.id)).size === 20 && ожид.every((з) => r.тело.zapisi.some((x) => x.id === з.klyuch)),
    'набор страницы = хронологический топ-20 (переставлен, не подменён)');
  так(r.тело.dalshe === Л.курсорИз({ data: ожид[19].data, klyuch: ожид[19].klyuch }), 'dalshe — по хронологически последней, а не по показанной');
  так(ожид.filter((з) => з.kanal === 'russkaya_yasna').length >= 9, 'в топ-20 один канал даёт ≥9 записей (есть что перемежать)', ожид.filter((з) => з.kanal === 'russkaya_yasna').length);
}

console.log('Листание');
{
  const всё = []; let к = null, страниц = 0;
  do {
    const с = await зов('GET', '/lenta', { n: '25', kursor: к || undefined });
    всё.push(...с.тело.zapisi); к = с.тело.dalshe; страниц++;
  } while (к && страниц < 30);
  const ожид = видимые().filter((з) => з.istochnik !== 'rutube').length;
  так(всё.length === ожид, 'обход курсором собрал все ' + ожид + ' видимых записей', всё.length);
  так(new Set(всё.map((з) => з.id)).size === всё.length, 'без дублей на стыках страниц');
  так(!всё.some((з) => ПУБЛ.find((x) => x.klyuch === з.id).skryto), 'скрытых нет ни на одной странице');
  const альбом = всё.filter((з) => з.data === секундаАльбома);
  так(альбом.length === 3, 'три записи одной секунды (альбом) все пришли', альбом.length);
}

console.log('Управление');
r = await зов('GET', '/lenta', { upravlenie: 'granika' });
так(r.statusCode === 200 && r.тело.zapisi.length > 0 && r.тело.zapisi.every((з) => з.kanal === 'russkaya_yasna'), 'granika читает общий канал russkaya_yasna', r.тело.zapisi.length);
так(r.тело.zapisi[0].upravleniya.join(',') === 'yasna-shkola,granika,centr' && r.тело.zapisi[0].upravlenie === 'yasna-shkola', 'upravleniya записи — список, upravlenie — главное');
так(r.тело.zapisi[0].kanal_nazvanie === 'Русская Ясна', 'kanal_nazvanie из источника', r.тело.zapisi[0].kanal_nazvanie);
r = await зов('GET', '/lenta', { upravlenie: 'yasna-shkola', n: '40' });
так(r.тело.zapisi.every((з) => з.istochnik === 'telegram'), 'yasna-shkola без tip=video — только Телеграм (Rutube под «Видео»)');
r = await зов('GET', '/lenta', { upravlenie: 'yasna-shkola', tip: 'video', n: '40' });
так(r.тело.zapisi.some((з) => з.istochnik === 'rutube') && r.тело.zapisi.some((з) => з.istochnik === 'telegram'), 'yasna-shkola + tip=video сливает Телеграм и Rutube');
так(r.тело.zapisi.every((з, i, a) => !i || a[i - 1].data >= з.data), 'слияние каналов упорядочено');
{
  const всеШ = []; let к = null;
  do { const с = await зов('GET', '/lenta', { upravlenie: 'marshruty', n: '7', kursor: к || undefined }); всеШ.push(...с.тело.zapisi); к = с.тело.dalshe; } while (к);
  const ожид = видимые().filter((з) => з.kanal === 'naturnie_uroki').length;
  так(всеШ.length === ожид && new Set(всеШ.map((з) => з.id)).size === ожид, 'обход управления по каналу полный (' + ожид + ')', всеШ.length);
  r = await зов('GET', '/lenta', { upravlenie: 'marshruty', n: String(ожид) });
  так(r.тело.zapisi.length === ожид && r.тело.dalshe === null, 'страница ровно со всеми записями → dalshe null');
}
r = await зов('GET', '/lenta', { upravlenie: 'dzhiva' });
так(r.statusCode === 200 && r.тело.zapisi.length === 0 && r.тело.dalshe === null && r.тело.novyh === null, 'управление без записей → пусто, 200, без запроса', r.тело);
r = await зов('GET', '/lenta', { upravlenie: 'Neglinka!' });
так(r.statusCode === 400, 'мусор в upravlenie → 400', r.тело);

console.log('Вид, пределы, курсор');
r = await зов('GET', '/lenta', { tip: 'video', n: '50' });
так(r.тело.zapisi.length === 7 && r.тело.zapisi.every((з) => з.tip === 'video'), 'tip=video: 5 Rutube + 2 Телеграм', r.тело.zapisi.length);
{
  const рт = r.тело.zapisi.find((з) => з.istochnik === 'rutube');
  так(рт && рт.tekst === null && рт.dlitelnost_s >= 1800 && рт.kartinka === null, 'Rutube: заголовок + длительность, tekst и картинка null', рт);
}
r = await зов('GET', '/lenta', { tip: 'foto', n: '50' });
так(r.тело.zapisi.every((з) => з.tip === 'foto'), 'tip=foto фильтрует');
{
  const а = r.тело.zapisi.find((з) => з.kanal === 'astronevod');
  const ря = r.тело.zapisi.find((з) => з.kanal === 'russkaya_yasna');
  так(а && а.kartinka === null && а.kartinka_polnaya === null, 'без soglasie_at картинки не отдаются (astronevod)', а);
  так(а && а.vedushchij === 'Иван Петров', 'vedushchij из источника', а && а.vedushchij);
  так(ря && /-m\.jpg$/.test(ря.kartinka) && /\.jpg$/.test(ря.kartinka_polnaya) && ря.kartinok === 2, 'с согласием — две копии и kartinok', ря);
}
r = await зов('GET', '/lenta', { tip: 'gif' });
так(r.statusCode === 400, 'чужой tip → 400', r.тело);
r = await зов('GET', '/lenta', { n: '500' });
так(r.statusCode === 200 && r.тело.zapisi.length === 50, 'n режется до 50', r.тело.zapisi && r.тело.zapisi.length);
for (const n of ['-1', 'abc', '1.5', '1e1']) { r = await зов('GET', '/lenta', { n }); так(r.statusCode === 400, 'n=' + n + ' → 400', r.тело); }
r = await зов('GET', '/lenta', { kursor: 'не-курсор' });
так(r.statusCode === 400, 'битый курсор → 400', r.тело);
r = await зов('GET', '/lenta', { kursor: Buffer.from('2026-09-05|', 'utf8').toString('base64url') });
так(r.statusCode === 400, 'курсор без klyuch → 400', r.тело);
r = await зов('GET', '/lenta', { kursor: 'A'.repeat(201) });
так(r.statusCode === 400, 'курсор длиннее 200 → 400', r.тело);
r = await зов('GET', '/lenta', { kursor: Buffer.from('2026-09-05T10:00:00.123Z|telegram:x:1', 'utf8').toString('base64url'), n: '3' });
так(r.statusCode === 200, 'курсор с долями секунды терпим (режется до секунды)', r.тело);
r = await зов('GET', '/lenta', { otkuda: 'kosmos' });
так(r.statusCode === 400, 'чужой otkuda → 400', r.тело);
{
  const дл = (await зов('GET', '/lenta', { upravlenie: 'marshruty', n: '3' })).тело.zapisi.find((з) => з.id === ДЛИННАЯ.klyuch);
  так(дл && дл.zagolovok.length <= 120 && дл.zagolovok.endsWith('…') && дл.tekst.length <= 400 && дл.tekst.endsWith('…'), 'заголовок ≤120 и текст ≤400 с «…» по слову', дл && [дл.zagolovok.length, дл.tekst.length]);
  const сс = (await зов('GET', '/lenta', { tip: 'ssylka' })).тело.zapisi[0];
  так(сс && сс.ssylka_v_zapisi === 'vkvideo.ru', 'ssylka_v_zapisi — только хост', сс && сс.ssylka_v_zapisi);
}

console.log('Есть новое');
{
  const стр = await зов('GET', '/lenta', { n: '5' });
  const хрон = видимые().filter((з) => з.istochnik !== 'rutube').sort(сравн);
  const видено = Л.курсорИз({ data: хрон[4].data, klyuch: хрон[4].klyuch });
  r = await зов('GET', '/lenta', { posle: видено, n: '0' });
  так(r.statusCode === 200 && r.тело.novyh === 4 && r.тело.zapisi.length === 0, 'posle=пятая, n=0 → novyh=4, записей 0', { novyh: r.тело.novyh, z: r.тело.zapisi.length });
  так(r.тело.upravleniya_s_zapisyami.length === 4 && r.тело.sobrano_at, 'n=0 отдаёт upravleniya_s_zapisyami и sobrano_at');
  r = await зов('GET', '/lenta', { posle: видено, n: '2' });
  так(r.тело.zapisi.length === 2 && r.тело.novyh === 4 && typeof r.тело.dalshe === 'string', 'posle с n=2 → две новейшие, novyh 4, dalshe для добора');
  так(r.тело.zapisi.every((з) => з.data > хрон[4].data || (з.data === хрон[4].data && з.id > хрон[4].klyuch)), 'все отданные новее увиденной');
  const было = запросовПубликаций;
  r = await зов('GET', '/lenta', { n: '0' });
  так(r.statusCode === 200 && r.тело.zapisi.length === 0 && r.тело.novyh === null && запросовПубликаций === было, 'n=0 без posle → пусто, novyh null, к таблице не ходили');
  const старый = Л.курсорИз({ data: '2020-01-01T00:00:00Z', klyuch: 'a' });
  r = await зов('GET', '/lenta', { posle: старый, n: '0' });
  так(r.тело.novyh === 50, 'много нового → novyh = 50 (предел)', r.тело.novyh);
  r = await зов('GET', '/lenta', { posle: видено, kursor: видено });
  так(r.statusCode === 400, 'posle вместе с kursor → 400', r.тело);
  r = await зов('GET', '/lenta', { posle: видено, n: '0', upravlenie: 'neglinka' });
  так(r.тело.novyh === 0, 'posle с фильтром считает новое в этом же срезе (neglinka → 0)', r.тело.novyh);
  так(стр.тело.zapisi.length === 5, 'страница n=5 (для сравнения)');
}

console.log('Журнал «откуда»');
{
  const было = ЖУРНАЛ.length;
  r = await зов('GET', '/lenta', { n: '3', otkuda: 'segodnya', upravlenie: 'astronevod' });
  так(r.statusCode === 200 && ЖУРНАЛ.length === было + 1 && ЖУРНАЛ[было].klyuch === 'klient:segodnya' && ЖУРНАЛ[было].otkuda === 'segodnya' && ЖУРНАЛ[было].novyh === 3,
    'otkuda=segodnya → строка журнала klient:segodnya с числом записей', ЖУРНАЛ[было]);
  r = await зов('GET', '/lenta', { n: '3' });
  так(ЖУРНАЛ.length === было + 1, 'без otkuda журнал не пишется');
  журналЛомается = true;
  r = await зов('GET', '/lenta', { n: '3', otkuda: 'lenta' });
  журналЛомается = false;
  так(r.statusCode === 200 && r.тело.zapisi.length === 3, 'сломанный журнал не ломает ленту');
}

console.log('Состояние сбора');
r = await зов('GET', '/lenta/istochniki');
так(r.statusCode === 401, 'без токена → 401', r.тело);
r = await зов('GET', '/lenta/istochniki', {}, ТОКЕН);
так(r.statusCode === 403, 'с токеном без права → 403', r.тело);
ПРАВА = { isSuperadmin: false, caps: ['cap:lenta.istochniki'] };
r = await зов('GET', '/lenta/istochniki', {}, ТОКЕН);
так(r.statusCode === 200 && r.тело.istochniki.length === ИСТ.length && Array.isArray(r.тело.zhaloby), 'с правом → 200, все источники и список жалоб', r.тело.istochniki && r.тело.istochniki.length);
{
  const по = Object.fromEntries(r.тело.istochniki.map((и) => [и.klyuch, и]));
  так(по['telegram:russkaya_yasna'].sostoyanie === 'zhiv', 'russkaya_yasna жив', по['telegram:russkaya_yasna'].sostoyanie);
  так(по['telegram:neglinka78'].sostoyanie === 'molchit' && по['telegram:neglinka78'].molchit_dnej === 71, 'neglinka78 молчит 71 день', [по['telegram:neglinka78'].sostoyanie, по['telegram:neglinka78'].molchit_dnej]);
  так(по['telegram:aleksandriya_2026'].sostoyanie === 'oshibka', 'три сбоя подряд → oshibka', по['telegram:aleksandriya_2026'].sostoyanie);
  так(по['dzen:5e9a2d632385352365504c51'].sostoyanie === 'trevoga', 'двое суток без удачи → trevoga', по['dzen:5e9a2d632385352365504c51'].sostoyanie);
  так(по['telegram:novyj'].sostoyanie === 'ne_proveren', 'ни разу не опрошен → ne_proveren', по['telegram:novyj'].sostoyanie);
  так(по['youtube:UCHR0m'].sostoyanie === 'vyklyuchen', 'выключенный → vyklyuchen', по['youtube:UCHR0m'].sostoyanie);
  так(['klyuch', 'istochnik', 'kanal', 'nazvanie', 'upravlenie', 'vklyuchen', 'sostoyanie', 'molchit_dnej', 'proveren_at', 'udacha_at', 'oshibka', 'zapisej', 'poslednyaya_publikaciya', 'zhurnal']
    .every((п) => п in по['telegram:astronevod']), 'поля источника по контракту', Object.keys(по['telegram:astronevod']));
  так(по['telegram:russkaya_yasna'].proveren_at === назад(0, 1) && Array.isArray(по['telegram:russkaya_yasna'].zhurnal), 'даты до секунды, журнал приложен');
}
r = await зов('POST', '/lenta/istochniki', {}, ТОКЕН);
так(r.statusCode === 405, 'POST /lenta/istochniki → 405', r.тело);
ПРАВА = { isSuperadmin: true, caps: [] };
r = await зов('GET', '/lenta/istochniki', {}, ТОКЕН);
так(r.statusCode === 200, 'суперадмин без cap проходит');
праваЛомаются = true;
r = await зов('GET', '/lenta/istochniki', {}, ТОКЕН);
праваЛомаются = false;
так(r.statusCode === 403, 'права не прочитались → 403 (закрываем, а не открываем)', r.тело);

console.log('Жалоба');
const ЦЕЛЬ = видимые().find((з) => з.kanal === 'astronevod' && з.tip === 'foto').klyuch;
r = await зов('POST', '/lenta/zhaloba', {}, {}, { id: ЦЕЛЬ, prichina: 'ya_na_foto' });
так(r.statusCode === 403, 'без секрета устройства → 403', r.тело);
{
  /* Секрет сверяется с device_auth ДО счётчика: случайный секрет — не новое
     устройство с квотой 5, а 403; ни жалобы, ни ведра лимита не появляется. */
  const жалобБыло = ЖАЛОБЫ.length, вёдерБыло = ЧАСТОТА.size;
  const коды = [];
  for (let i = 0; i < 30; i++) коды.push((await зов('POST', '/lenta/zhaloba', {}, { 'X-Device-Secret': 'случайный-' + i }, { id: ЦЕЛЬ, prichina: 'drugoe' })).statusCode);
  так(коды.every((к) => к === 403) && ЖАЛОБЫ.length === жалобБыло && ЧАСТОТА.size === вёдерБыло, '30 случайных секретов → 30×403, жалоб и вёдер лимита не прибавилось', коды.join(','));
  так(обращенийКУстройствам >= 30, 'каждый секрет сверен с device_auth', обращенийКУстройствам);
  const с = await зов('POST', '/lenta/zhaloba', {}, { 'X-Device-Secret': 'секрет-устройства-1' }, { id: 'telegram:astronevod:999999', prichina: 'drugoe', deviceId: 'dev-2' });
  так(с.statusCode === 403, 'deviceId в теле с чужим секретом → 403 (сверка по первичному ключу)', с.тело);
  const с2 = await зов('POST', '/lenta/zhaloba', {}, { 'X-Device-Secret': 'секрет-устройства-1' }, { id: 'telegram:astronevod:999999', prichina: 'drugoe', deviceId: 'dev-9' });
  так(с2.statusCode === 403, 'deviceId без строки в device_auth → 403, привязки при первом обращении нет', с2.тело);
}
r = await зов('POST', '/lenta/zhaloba', {}, СЕКРЕТ, { id: ЦЕЛЬ, prichina: 'obida' });
так(r.statusCode === 400, 'чужая prichina → 400', r.тело);
r = await зов('POST', '/lenta/zhaloba', {}, СЕКРЕТ, { id: 'мусор', prichina: 'drugoe' });
так(r.statusCode === 400, 'мусорный id → 400', r.тело);
r = await зов('POST', '/lenta/zhaloba', {}, СЕКРЕТ, { id: 'telegram:astronevod:999999', prichina: 'drugoe' });
так(r.statusCode === 404, 'несуществующая запись → 404', r.тело);
r = await зов('POST', '/lenta/zhaloba', {}, СЕКРЕТ, { id: ЦЕЛЬ, prichina: 'ya_na_foto', tekst: 'это я на втором фото', kontakt: 'a@b.ru' });
так(r.statusCode === 200 && r.тело.ok === true && r.тело.srok === '3 дня', 'жалоба принята → { ok, srok }', r.тело);
{
  const ж = ЖАЛОБЫ[ЖАЛОБЫ.length - 1];
  const хеш = createHash('sha256').update('секрет-устройства-1').digest('hex').slice(0, 32);
  так(ж && ж.klyuch === ЦЕЛЬ && ж.sostoyanie === 'novaya' && ж.ustrojstvo === хеш && ж.tekst === 'это я на втором фото' && ж.kontakt === 'a@b.ru',
    'строка lenta_zhaloby: novaya, ustrojstvo = sha256 секрета', ж);
  так(!JSON.stringify(ЖАЛОБЫ).includes('секрет-устройства-1'), 'сам секрет в базу не попал');
}
{
  /* Лимит считает ПОПЫТКИ, а не принятые жалобы: счётчик стоит до проверки
     записи, чтобы мусорные id не дёргали базу бесплатно. С этого устройства
     уже было две попытки (404 на несуществующую и принятая), значит ещё
     три пройдут, а дальше — 429. */
  const ведро = 'lenta-zhaloba:' + createHash('sha256').update('секрет-устройства-1').digest('hex').slice(0, 32);
  так(ЧАСТОТА.get(ведро) && ЧАСТОТА.get(ведро).hits === 2, 'счётчик попыток устройства = 2 (404 тоже попытка)', ЧАСТОТА.get(ведро));
  const коды = [];
  for (let i = 0; i < 6; i++) { const с = await зов('POST', '/lenta/zhaloba', {}, СЕКРЕТ, { id: ЦЕЛЬ, prichina: 'drugoe' }); коды.push(с.statusCode); }
  так(коды.join(',') === '200,200,200,429,429,429', 'лимит 5 в час на устройство: пятая попытка проходит, шестая и дальше 429', коды);
  так(ЧАСТОТА.get(ведро).hits === 5, 'отказ не наращивает счётчик', ЧАСТОТА.get(ведро));
  const другое = await зов('POST', '/lenta/zhaloba', {}, { 'X-Device-Secret': 'другое-устройство' }, { id: ЦЕЛЬ, prichina: 'reklama' });
  так(другое.statusCode === 200, 'другое устройство не задето лимитом', другое.тело);
  ЧАСТОТА.get(ведро).start = Date.now() - 61 * 60 * 1000;
  const снова = await зов('POST', '/lenta/zhaloba', {}, СЕКРЕТ, { id: ЦЕЛЬ, prichina: 'drugoe' });
  так(снова.statusCode === 200 && ЧАСТОТА.get(ведро).hits === 1, 'через час окно открывается заново', [снова.statusCode, ЧАСТОТА.get(ведро)]);
  /* с deviceId в теле — тот же путь, но по первичному ключу */
  const сId = await зов('POST', '/lenta/zhaloba', {}, СЕКРЕТ, { id: ЦЕЛЬ, prichina: 'drugoe', deviceId: 'dev-1' });
  так(сId.statusCode === 200, 'свой deviceId + свой секрет → 200', сId.тело);
}
{
  /* Общий лимит на адрес: три привязанных устройства за одним адресом — 30 в
     час на всех. Ведро адреса считается отдельно от вёдер устройств. */
  const адрес = { 'X-Forwarded-For': '10.0.0.7' };
  const секреты = ['секрет-устройства-1', 'другое-устройство', 'третье-устройство'];
  for (const с of секреты) { const в = 'lenta-zhaloba:' + createHash('sha256').update(с).digest('hex').slice(0, 32); ЧАСТОТА.delete(в); }
  ЧАСТОТА.set('lenta-zhaloba-ip:10.0.0.7', { start: Date.now(), hits: 29 });
  const а1 = await зов('POST', '/lenta/zhaloba', {}, Object.assign({ 'X-Device-Secret': секреты[0] }, адрес), { id: ЦЕЛЬ, prichina: 'drugoe' });
  const а2 = await зов('POST', '/lenta/zhaloba', {}, Object.assign({ 'X-Device-Secret': секреты[1] }, адрес), { id: ЦЕЛЬ, prichina: 'drugoe' });
  так(а1.statusCode === 200 && а2.statusCode === 429 && /адреса/.test(а2.тело.detail), 'лимит 30 в час на адрес: тридцатая проходит, тридцать первая — 429 даже с другого устройства', [а1.statusCode, а2.statusCode]);
  ЧАСТОТА.delete('lenta-zhaloba-ip:10.0.0.7');
}
{
  /* Потолок неразобранных: 300 новых — новые не копим */
  const было = ЖАЛОБЫ.length;
  for (let i = 0; i < 300; i++) ЖАЛОБЫ.push({ klyuch: 'telegram:x:' + i, at: iso(Date.now()), prichina: 'drugoe', ustrojstvo: 'x', sostoyanie: 'novaya' });
  const в = 'lenta-zhaloba:' + createHash('sha256').update('третье-устройство').digest('hex').slice(0, 32); ЧАСТОТА.delete(в);
  const п = await зов('POST', '/lenta/zhaloba', {}, { 'X-Device-Secret': 'третье-устройство' }, { id: ЦЕЛЬ, prichina: 'drugoe' });
  так(п.statusCode === 429 && /неразобранных/.test(п.тело.detail) && ЖАЛОБЫ.length === было + 300, 'потолок 300 неразобранных → 429, жалоба не записана', п.тело);
  ЖАЛОБЫ.splice(было, 300);
  ЧАСТОТА.delete(в);
}

console.log('Скрытие');
ПРАВА = { isSuperadmin: false, caps: ['cap:lenta.istochniki'] };
r = await зов('POST', '/lenta/skryt', {}, {}, { id: ЦЕЛЬ, prichina: 'жалоба' });
так(r.statusCode === 401, 'без токена → 401', r.тело);
r = await зов('POST', '/lenta/skryt', {}, ТОКЕН, { id: ЦЕЛЬ, prichina: 'жалоба' });
так(r.statusCode === 403, 'право istochniki не даёт скрывать → 403', r.тело);
ПРАВА = { isSuperadmin: false, caps: ['cap:lenta.moderate'] };
r = await зов('POST', '/lenta/skryt', {}, ТОКЕН, { id: 'telegram:astronevod:999999', prichina: 'жалоба' });
так(r.statusCode === 404, 'скрыть несуществующую → 404', r.тело);
r = await зов('POST', '/lenta/skryt', {}, ТОКЕН, { id: ЦЕЛЬ, prichina: 'жалоба: человек на фото' });
так(r.statusCode === 200 && r.тело.ok === true, 'скрытие → { ok:true }', r.тело);
{
  const з = ПУБЛ.find((x) => x.klyuch === ЦЕЛЬ);
  так(з.skryto === true && з.skryto_prichina === 'жалоба: человек на фото', 'skryto=true и причина записаны', з);
  так(ЖАЛОБЫ.filter((ж) => ж.klyuch === ЦЕЛЬ).every((ж) => ж.sostoyanie === 'razobrana'), 'жалобы на скрытую запись стали razobrana');
  const всё = [];
  let к = null;
  do { const с = await зов('GET', '/lenta', { tip: 'foto', n: '50', kursor: к || undefined }); всё.push(...с.тело.zapisi); к = с.тело.dalshe; } while (к);
  так(!всё.some((x) => x.id === ЦЕЛЬ), 'скрытая запись из ленты пропала');
  r = await зов('POST', '/lenta/skryt', {}, ТОКЕН, { id: ЦЕЛЬ });
  так(r.statusCode === 200 && r.тело.uzhe_bylo === true, 'повторное скрытие — ok с uzhe_bylo');
}
r = await зов('GET', '/lenta/skryt', {}, ТОКЕН);
так(r.statusCode === 405, 'GET /lenta/skryt → 405', r.тело);
r = await зов('GET', '/lenta/istochniki', {}, ТОКЕН);
так(r.statusCode === 403, 'право moderate не даёт смотреть состояние → 403 (права раздельные)', r.тело);
{
  /* новая жалоба на другую, живую запись — с третьего устройства */
  const ДРУГАЯ = видимые().find((з) => з.kanal === 'russkaya_yasna' && !з.skryto).klyuch;
  const с = await зов('POST', '/lenta/zhaloba', {}, { 'X-Device-Secret': 'третье-устройство' }, { id: ДРУГАЯ, prichina: 'prava', tekst: 'мой текст' });
  так(с.statusCode === 200, 'жалоба на другую запись принята', с.тело);
  ПРАВА = { isSuperadmin: true, caps: [] };
  r = await зов('GET', '/lenta/istochniki', {}, ТОКЕН);
  const ж = r.тело.zhaloby;
  так(ж.length === 1 && ж[0].id === ДРУГАЯ && ж[0].sostoyanie === 'novaya' && ж[0].zagolovok && ж[0].ssylka && ж[0].skryto === false && ж[0].zapis_est === true,
    'в состоянии — только новые жалобы (разобранные ушли), с заголовком и ссылкой записи', ж);
}

console.log('Прочее');
r = await зов('OPTIONS', '/lenta/zhaloba');
так(r.statusCode === 200 && r.сырое === '' && r.headers['Access-Control-Allow-Origin'], 'OPTIONS → 200 с CORS, пустое тело');
r = await зов('POST', '/lenta');
так(r.statusCode === 405, 'POST /lenta → 405', r.тело);
r = await зов('GET', '/lenta/zhaloba');
так(r.statusCode === 405, 'GET /lenta/zhaloba → 405', r.тело);
r = await зов('GET', '/lentochka');
так(r.statusCode === 404, 'чужой путь → 404', r.тело);
базаЛежит = true; Л.сброситьИсточники();
r = await зов('GET', '/lenta');
так(r.statusCode === 503 && r.тело.error === 'db unavailable' && /connection refused/.test(r.тело.detail), 'база лежит → 503 {error, detail}', r.тело);
r = await зов('POST', '/lenta/zhaloba', {}, СЕКРЕТ, { id: ЦЕЛЬ, prichina: 'drugoe' });
так(r.statusCode === 503, 'жалоба при лежащей базе → 503', r.тело);
базаЛежит = false;

console.log('Чистые функции');
так(Л.обрезать('раз два три четыре', 12) === 'раз два три…' || Л.обрезать('раз два три четыре', 12).length <= 12, 'обрезать — по слову с «…»', Л.обрезать('раз два три четыре', 12));
так(Л.хост('https://vkvideo.ru/video-1?x=1') === 'vkvideo.ru' && Л.хост('vkvideo.ru') === 'vkvideo.ru' && Л.хост('не адрес') === null, 'хост — только хост');
так(Л.курсорВ(Л.курсорИз({ data: '2026-09-05T10:53:00Z', klyuch: 'telegram:a:1' })).klyuch === 'telegram:a:1', 'курсор ходит туда и обратно');
так(Л.курсорВ('') === null && Л.курсорВ('***') === undefined, 'курсор: пусто → null, мусор → undefined');
{
  const п = Л.перемежить([
    { kanal_klyuch: 'a', data: '2026-09-05T10:00:00Z', n: 1 }, { kanal_klyuch: 'a', data: '2026-09-05T09:00:00Z', n: 2 },
    { kanal_klyuch: 'a', data: '2026-09-05T08:00:00Z', n: 3 }, { kanal_klyuch: 'b', data: '2026-09-04T08:00:00Z', n: 4 },
    { kanal_klyuch: 'a', data: '2026-09-03T08:00:00Z', n: 5 }, { kanal_klyuch: 'c', data: '2026-08-01T08:00:00Z', n: 6 },
  ]).map((x) => x.n);
  так(п.join(',') === '1,2,4,3,5,6', 'перемежить: третью отодвигает b (не старше недели), c (месяц) не трогает', п);
}

console.log(`\n${всего} проверок, провалов: ${провалов}`);
process.exit(провалов ? 1 : 0);
