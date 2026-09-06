/* Прогон server/druzya.js на поддельной базе в памяти: сети и YDB не нужно.
   Поддельная сессия разбирает ровно те запросы, которые шлёт модуль, и держит
   две «таблицы» — druzya_ludi и druzhba — обычными Map и массивом.

   ЧТО ЗДЕСЬ ВАЖНО ДЕРЖАТЬ ВИДИМЫМ
   • Ввод кода делает друзьями СРАЗУ и у обоих: проверяем ОБЕ строки связи,
     а не только ответ ручки.
   • Право на строку: голого pid мало, голого непривязанного секрета — тоже.
     До миграции 012 сюда пускал любой непустой заголовок X-Device-Secret,
     а чужой pid знает каждый, кто есть у человека в друзьях.
   • Запрос без токена не обнуляет уже записанный user_id.
   • Счётчик заявок стоит НИЖЕ поиска кода: опечатки не должны съедать право
     добавлять друзей.
   • Картинка: вес, подпись файла, растущая версия, вечный кэш только по
     совпавшей метке, двоичный ответ шлюза (base64 + isBase64Encoded).

   Как настоящая YDB, поддельная сессия отвергает UPSERT без всех NOT NULL
   колонок — из-за этого частичная запись возможна только через UPDATE.

   Запуск:  node server/proby/proba-druzya.mjs   (PATH с node 22, см. README) */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const здесь = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(здесь, '..', 'druzya.js'));
const Д = require('./druzya.js');

/* ── таблицы ───────────────────────────────────────────────────────────── */
const ЛЮДИ = new Map();     /* pid → строка druzya_ludi */
const СВЯЗИ = [];           /* строки druzhba */
const ЧАСТОТА = new Map();  /* ведро → число обращений в окне */

const НЕ_NULL = {
  druzya_ludi: ['pid', 'nick', 'kod', 'created_at', 'updated_at'],
  druzhba: ['pid', 'drug_pid', 'sostoyanie', 'created_at', 'updated_at'],
};

const т = (s) => ({ textValue: s == null ? null : String(s) });
const ч64 = (n) => (n == null ? {} : { uint64Value: String(n) });
const ч32 = (n) => (n == null ? {} : { uint32Value: n });
const мкс = (iso) => (iso ? { uint64Value: String(Date.parse(iso) * 1000) } : {});
const бй = (b) => (b == null ? {} : { bytesValue: b });

const связь = (a, b) => СВЯЗИ.find((с) => с.pid === a && с.drug_pid === b) || null;
function поставитьСвязь(a, b, состояние) {
  const с = связь(a, b);
  if (с) { с.sostoyanie = состояние; return; }
  СВЯЗИ.push({ pid: a, drug_pid: b, sostoyanie: состояние, created_at: new Date().toISOString() });
}
function стеретьСвязь(a, b) {
  const i = СВЯЗИ.findIndex((с) => с.pid === a && с.drug_pid === b);
  if (i >= 0) СВЯЗИ.splice(i, 1);
}

let запросов = 0;
const уступить = () => new Promise((r) => setImmediate(r));

const сессия = {
  async executeQuery(sql, p = {}) {
    await уступить();
    запросов++;
    const v = (k) => (p[k] ? (p[k].v === undefined ? null : p[k].v) : null);

    /* Каждый параметр объявлен, каждое объявление использовано: расхождение
       здесь в бою даёт «Parameter not declared», а не тихую ошибку. */
    const объявлено = [...sql.matchAll(/DECLARE (\$\w+)/g)].map((m) => m[1]);
    for (const k of Object.keys(p)) if (объявлено.indexOf(k) < 0) throw new Error('параметр без DECLARE: ' + k);
    for (const k of объявлено) if (!(k in p)) throw new Error('DECLARE без параметра: ' + k);

    /* Как настоящая YDB: UPSERT обязан нести все NOT NULL колонки таблицы. */
    for (const м of sql.matchAll(/UPSERT INTO (\w+) \(([^)]*)\)/g)) {
      const есть = new Set(м[2].split(',').map((x) => x.trim()));
      for (const к of (НЕ_NULL[м[1]] || []))
        if (!есть.has(к)) throw new Error('BadRequest (code 400010): Missing not null column in input: ' + к);
    }

    /* ── druzya_ludi ─────────────────────────────────────────────────── */
    if (/SELECT pid, user_id, device_id, nick, avatar, kod, secret_hash, kartinka_v, kartinka_bajt/.test(sql)) {
      const л = ЛЮДИ.get(v('$p'));
      return { resultSets: [{ rows: л ? [{ items: [
        т(л.pid), т(л.user_id), т(л.device_id), т(л.nick), т(л.avatar), т(л.kod), т(л.secret_hash),
        ч64(л.kartinka_v), ч32(л.kartinka_bajt),
      ] }] : [] }] };
    }
    if (/SELECT pid, nick, avatar, kartinka_v, kartinka_bajt FROM druzya_ludi WHERE pid = \$p/.test(sql)) {
      const л = ЛЮДИ.get(v('$p'));
      return { resultSets: [{ rows: л ? [{ items: [т(л.pid), т(л.nick), т(л.avatar), ч64(л.kartinka_v), ч32(л.kartinka_bajt)] }] : [] }] };
    }
    if (/SELECT kartinka, kartinka_tip, kartinka_v FROM druzya_ludi WHERE pid = \$p/.test(sql)) {
      const л = ЛЮДИ.get(v('$p'));
      return { resultSets: [{ rows: л ? [{ items: [бй(л.kartinka), т(л.kartinka_tip), ч64(л.kartinka_v)] }] : [] }] };
    }
    if (/VIEW druzya_ludi_by_user WHERE user_id = \$u/.test(sql)) {
      const л = [...ЛЮДИ.values()].find((x) => x.user_id && x.user_id === v('$u'));
      return { resultSets: [{ rows: л ? [{ items: [т(л.pid)] }] : [] }] };
    }
    if (/VIEW druzya_ludi_by_kod WHERE kod = \$k/.test(sql)) {
      const л = [...ЛЮДИ.values()].find((x) => x.kod === v('$k'));
      return { resultSets: [{ rows: л ? [{ items: [т(л.pid)] }] : [] }] };
    }
    if (/UPSERT INTO druzya_ludi/.test(sql)) {
      const было = ЛЮДИ.get(v('$p')) || { pid: v('$p'), created_at: new Date().toISOString() };
      /* UPSERT в YDB трогает только перечисленные колонки — остальные живут. */
      Object.assign(было, {
        user_id: v('$u'), device_id: v('$d'), nick: v('$n'), avatar: v('$a'),
        kod: v('$k'), secret_hash: v('$h'), updated_at: new Date().toISOString(),
      });
      ЛЮДИ.set(было.pid, было);
      return { resultSets: [] };
    }
    if (/UPDATE druzya_ludi SET secret_hash = \$h/.test(sql)) {
      const л = ЛЮДИ.get(v('$p'));
      if (л) л.secret_hash = v('$h');
      return { resultSets: [] };
    }
    if (/UPDATE druzya_ludi SET user_id = \$u/.test(sql)) {
      const л = ЛЮДИ.get(v('$p'));
      if (л) Object.assign(л, { user_id: v('$u'), device_id: v('$d'), nick: v('$n'), avatar: v('$a'), kod: v('$k') });
      return { resultSets: [] };
    }
    if (/UPDATE druzya_ludi SET kartinka = \$b/.test(sql)) {
      const л = ЛЮДИ.get(v('$p'));
      /* Условие «версия и правда выросла» — как в настоящей YDB: строка, не
         прошедшая условие, просто не меняется. Ради этого проба и знает про
         WHERE: без него две одновременные записи получали одну метку. */
      const условно = /AND \(kartinka_v IS NULL OR kartinka_v < \$v\)/.test(sql);
      if (л && условно && л.kartinka_v != null && !(л.kartinka_v < Number(v('$v'))))
        return { resultSets: [] };
      if (л) Object.assign(л, {
        kartinka: v('$b'), kartinka_tip: v('$t'),
        kartinka_v: v('$v') == null ? null : Number(v('$v')),
        kartinka_bajt: v('$n') == null ? null : Number(v('$n')),
      });
      return { resultSets: [] };
    }
    if (/DELETE FROM druzya_ludi WHERE pid = \$p/.test(sql)) {
      ЛЮДИ.delete(v('$p'));
      return { resultSets: [] };
    }

    /* ── druzhba ─────────────────────────────────────────────────────── */
    if (/SELECT drug_pid, sostoyanie, created_at FROM druzhba WHERE pid = \$p/.test(sql)) {
      const ряд = СВЯЗИ.filter((с) => с.pid === v('$p'));
      return { resultSets: [{ rows: ряд.map((с) => ({ items: [т(с.drug_pid), т(с.sostoyanie), мкс(с.created_at)] })) }] };
    }
    if (/SELECT drug_pid, sostoyanie FROM druzhba WHERE pid = \$p/.test(sql)) {
      const ряд = СВЯЗИ.filter((с) => с.pid === v('$p'));
      return { resultSets: [{ rows: ряд.map((с) => ({ items: [т(с.drug_pid), т(с.sostoyanie)] })) }] };
    }
    if (/SELECT sostoyanie FROM druzhba WHERE pid = \$p AND drug_pid = \$d/.test(sql)) {
      const с = связь(v('$p'), v('$d'));
      return { resultSets: [{ rows: с ? [{ items: [т(с.sostoyanie)] }] : [] }] };
    }
    if (/SELECT COUNT\(\*\) AS n FROM \$ryad/.test(sql)) {
      if (!/LIMIT \$n/.test(sql)) throw new Error('счёт связей без предела — обход всей половины таблицы');
      const n = СВЯЗИ.filter((с) => с.pid === v('$p') && с.sostoyanie === v('$s')).slice(0, Number(v('$n'))).length;
      return { resultSets: [{ rows: [{ items: [ч64(n)] }] }] };
    }
    if (/UPSERT INTO druzhba/.test(sql)) {
      /* Обе половины — одним запросом: иначе они разъедутся ровно так, как
         разъезжались в дереве. */
      if ((sql.match(/UPSERT INTO druzhba/g) || []).length !== 2)
        throw new Error('половины пары пишутся разными запросами');
      поставитьСвязь(v('$ja'), v('$on'), v('$moe'));
      поставитьСвязь(v('$on'), v('$ja'), v('$ego'));
      return { resultSets: [] };
    }
    if (/DELETE FROM druzhba/.test(sql)) {
      if ((sql.match(/DELETE FROM druzhba/g) || []).length !== 2)
        throw new Error('стирается только своя половина пары');
      стеретьСвязь(v('$ja'), v('$on'));
      стеретьСвязь(v('$on'), v('$ja'));
      return { resultSets: [] };
    }

    throw new Error('поддельная база не знает запроса: ' + sql.trim().slice(0, 90));
  },
};
const drv = { tableClient: { withSession: async (f) => f(сессия) } };

/* ── помощники, как в auth-email.js (общий объект заголовков!) ─────────── */
const CORS = {
  'Access-Control-Allow-Origin': 'https://yasnalab.ru',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const ТОКЕНЫ = { 'token-A': 'user-A', 'token-B': 'user-B', 'token-C': 'user-C' };
const д = {
  TypedValues: {
    utf8: (v) => ({ v }), uint64: (v) => ({ v }), uint32: (v) => ({ v }), bool: (v) => ({ v }),
    bytes: (v) => ({ v }), optional: (v) => v, optionalNull: () => ({ v: null }),
  },
  Types: { UTF8: 'utf8', BYTES: 'bytes', UINT64: 'uint64', UINT32: 'uint32' },
  ok: (obj, code) => ({ statusCode: code || 200, headers: CORS, body: JSON.stringify(obj) }),
  fail: (code, error, extra) => ({ statusCode: code, headers: CORS, body: JSON.stringify(Object.assign({ error }, extra || {})) }),
  txt: (x) => (x == null ? null : (x.textValue ?? null)),
  num: (x) => { const y = x?.uint64Value ?? x?.uint32Value ?? x?.int64Value ?? x?.int32Value; return y == null ? null : Number(String(y)); },
  ts: (x) => { const y = x?.uint64Value ?? x?.int64Value; return y == null ? null : new Date(Number(String(y)) / 1000).toISOString(); },
  clean: (raw, max) => { if (raw == null) return null; const s = String(raw).replace(/[\u0000-\u001f\u007f]/g, '').trim(); return s ? s.slice(0, max) : null; },
  /* В бою адрес ставит шлюз заголовком X-Forwarded-For. Здесь он приходит из
     заголовков пробы: без разных адресов счёт частоты нечем проверить. */
  ipHash: (event) => ((event && event.headers && event.headers['X-Forwarded-For']) || null),
  /* Тот же договор, что у auth-email.throttleHit: истина — «можно», и на
     отказе счётчик не растёт. */
  throttleHit: async (_drv, ведро, предел) => {
    const было = ЧАСТОТА.get(ведро) || 0;
    if (было >= предел) return false;
    ЧАСТОТА.set(ведро, было + 1);
    return true;
  },
  verifyJWT: (t) => (ТОКЕНЫ[t] ? { sub: ТОКЕНЫ[t] } : null),
  loadProfile: async () => null,
  mailer: { isConfigured: () => false },
};

const зов = async (method, путь, { query = {}, headers = {}, body = {} } = {}) => {
  const r = await Д.route(drv, { method, path: путь, query, body, event: { headers }, д });
  let тело = null;
  if (r.isBase64Encoded) тело = null;
  else { try { тело = r.body ? JSON.parse(r.body) : null; } catch (_) { тело = { нечитаемо: String(r.body).slice(0, 60) }; } }
  return { statusCode: r.statusCode, headers: r.headers, тело, сырое: r.body, base64: !!r.isBase64Encoded };
};

/* Люди стенда. Секрет — заголовком, как в приложении. */
const A = { pid: 'pid-aaaaaaaa', секрет: 'sekret-A', ip: '10.0.0.1' };
const B = { pid: 'pid-bbbbbbbb', секрет: 'sekret-B', ip: '10.0.0.2' };
const C = { pid: 'pid-cccccccc', секрет: 'sekret-C', ip: '10.0.0.3' };
const с = (ч) => ({ 'X-Device-Secret': ч.секрет, 'X-Forwarded-For': ч.ip || '10.0.0.9' });
const ст = (ч, токен) => Object.assign(с(ч), { Authorization: 'Bearer ' + токен });

/* ── счёт проверок ─────────────────────────────────────────────────────── */
let провалов = 0, всего = 0;
function так(усл, имя, что) {
  всего++;
  console.log((усл ? '  ✓ ' : '  ✗ ') + имя + (усл || что === undefined ? '' : '  — ' + (typeof что === 'string' ? что : JSON.stringify(что)).slice(0, 300)));
  if (!усл) провалов++;
}

/* ── картинки для проб ─────────────────────────────────────────────────── */
const jpeg = (байт) => Buffer.concat([
  Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(Math.max(120, байт - 6), 0x41), Buffer.from([0xFF, 0xD9]),
]);
const ПОРТРЕТ = jpeg(900);
const ПОРТРЕТ2 = jpeg(1500);
const ТЯЖЁЛЫЙ = jpeg(41 * 1024);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(400, 7)]);
const б64 = (б) => б.toString('base64');

/* ═══════════════════════════════════════════════════════════════════════ */
console.log('Объявиться');
let r = await зов('POST', '/druzya/ya', { headers: с(A), body: { pid: A.pid, nick: 'Аня', avatar: '🦊' } });
так(r.statusCode === 200 && r.тело.pid === A.pid, 'A объявился', r.тело);
A.kod = r.тело.kod;
так(/^[BCDFGHJKLMNPQRSTVWXZ23456789]{6}$/.test(A.kod || ''), 'код — шесть знаков алфавита', A.kod);
так(r.тело.kartinka_v === null, 'у новой карточки метки картинки нет', r.тело.kartinka_v);
так(ЛЮДИ.get(A.pid).secret_hash === createHash('sha256').update(A.секрет).digest('hex'),
  'секрет привязан к строке (sha256), а не принят на веру');

r = await зов('POST', '/druzya/ya', { headers: с(B), body: { pid: B.pid, nick: 'Боря' } });
B.kod = r.тело.kod;
так(r.statusCode === 200 && B.kod && B.kod !== A.kod, 'B объявился, код другой', B.kod);

r = await зов('POST', '/druzya/ya', { headers: с(C), body: { pid: C.pid, nick: 'Вера' } });
C.kod = r.тело.kod;
так(r.statusCode === 200 && C.kod, 'C объявился', C.kod);

console.log('Право на строку (дыра в опознании, druzya.js:64 до 012)');
r = await зов('POST', '/druzya/ya', { headers: { 'X-Device-Secret': 'chuzhoj-sekret' }, body: { pid: A.pid, nick: 'Не Аня' } });
так(r.statusCode === 401, 'чужой секрет с чужим pid → 401 (раньше проходил любой непустой)', r.тело);
так(ЛЮДИ.get(A.pid).nick === 'Аня', 'имя A не подменено');
r = await зов('GET', '/druzya', { query: { pid: A.pid }, headers: { 'X-Device-Secret': 'chuzhoj-sekret' } });
так(r.statusCode === 401, 'чужой не читает список A', r.тело);
r = await зов('POST', '/druzya/pozvat', { headers: { 'X-Device-Secret': 'chuzhoj-sekret' }, body: { pid: A.pid, kod: C.kod } });
так(r.statusCode === 401, 'от чужого имени не позвать', r.тело);
r = await зов('POST', '/druzya/zabyt', { headers: { 'X-Device-Secret': 'chuzhoj-sekret' }, body: { pid: A.pid, drugPid: B.pid } });
так(r.statusCode === 401, 'от чужого имени не убрать друга', r.тело);
r = await зов('POST', '/druzya/ya', { headers: {}, body: { pid: A.pid, nick: 'Никто' } });
так(r.statusCode === 401, 'без токена и без секрета → 401', r.тело);

console.log('Ввёл код — друзья сразу');
r = await зов('POST', '/druzya/pozvat', { headers: с(B), body: { pid: B.pid, kod: A.kod } });
так(r.statusCode === 200 && r.тело.sostoyanie === 'druzya' && r.тело.podruzhilis === true,
  'B ввёл код A → сразу дружба, без заявки', r.тело);
так(!!r.тело.drug && r.тело.drug.pid === A.pid && r.тело.drug.nick === 'Аня' && r.тело.drug.avatar === '🦊',
  'в ответе карточка нового друга — экрану хватит без второго запроса', r.тело.drug);
так('kartinka_v' in (r.тело.drug || {}), 'в карточке есть метка версии картинки', r.тело.drug);
так(связь(B.pid, A.pid)?.sostoyanie === 'druzya' && связь(A.pid, B.pid)?.sostoyanie === 'druzya',
  'ОБЕ строки связи в druzya (проверено в таблице, а не по ответу)',
  { b: связь(B.pid, A.pid), a: связь(A.pid, B.pid) });
r = await зов('GET', '/druzya', { query: { pid: A.pid }, headers: с(A) });
так(r.тело.druzya.length === 1 && r.тело.druzya[0].pid === B.pid, 'A видит B у себя в друзьях сразу', r.тело);
так(r.тело.vhodyashchie.length === 0 && r.тело.poslannye.length === 0, 'никаких висящих заявок не появилось', r.тело);
так(r.тело.ya && r.тело.ya.pid === A.pid && 'kartinka_v' in r.тело.ya, 'состояние несёт и мою карточку', r.тело.ya);

console.log('Отказы, которые остаются');
r = await зов('POST', '/druzya/pozvat', { headers: с(A), body: { pid: A.pid, kod: A.kod } });
так(r.statusCode === 400 && r.тело.error === 'self', 'свой код → «это ваш собственный код»', r.тело);
r = await зов('POST', '/druzya/pozvat', { headers: с(B), body: { pid: B.pid, kod: A.kod } });
так(r.statusCode === 200 && r.тело.uzhe === 'druzya', 'повтор того же кода → «вы уже друзья»', r.тело);
так(СВЯЗИ.filter((x) => x.pid === B.pid && x.drug_pid === A.pid).length === 1, 'повтор не удвоил связь');
r = await зов('POST', '/druzya/pozvat', { headers: с(B), body: { pid: B.pid, kod: 'ZZZZZZ' } });
так(r.statusCode === 404 && r.тело.error === 'no such code', 'неизвестный код → «такого кода нет»', r.тело);
r = await зов('POST', '/druzya/pozvat', { headers: с(B), body: { pid: B.pid, kod: 'ABC' } });
так(r.statusCode === 400 && r.тело.error === 'short code', 'короткий код → 400', r.тело);

console.log('Счётчик заявок считает заявки, а не опечатки (druzya.js:237)');
ЧАСТОТА.clear();
let опечаток = 0;
for (let i = 0; i < 12; i++) {
  const о = await зов('POST', '/druzya/pozvat', { headers: с(A), body: { pid: A.pid, kod: 'QQQQQ' + (i % 8 + 2) } });
  if (о.statusCode === 404) опечаток++;
}
так(опечаток === 12, 'двенадцать опечаток подряд — все двенадцать «такого кода нет»', опечаток);
r = await зов('POST', '/druzya/pozvat', { headers: с(A), body: { pid: A.pid, kod: C.kod } });
так(r.statusCode === 200 && r.тело.sostoyanie === 'druzya',
  'после дюжины опечаток настоящее добавление всё ещё проходит', r.тело);
так((ЧАСТОТА.get('druzya:a:' + A.ip) || 0) === 1, 'в счёт заявок попала ровно одна — настоящая',
  ЧАСТОТА.get('druzya:a:' + A.ip));
так((ЧАСТОТА.get('druzya-kod:a:' + A.ip) || 0) === 12, 'опечатки считаются своим, щедрым счётом',
  ЧАСТОТА.get('druzya-kod:a:' + A.ip));
так((ЧАСТОТА.get('druzya:u:h' + createHash('sha256').update(A.секрет).digest('hex').slice(0, 32)) || 0) === 1,
  'и то же самое посчитано вторым счётом — по устройству', [...ЧАСТОТА.keys()]);
так([...ЧАСТОТА.keys()].every((к) => к.indexOf(A.pid) < 0),
  'ни одно ведро не ключуется на pid из тела запроса', [...ЧАСТОТА.keys()]);
/* Стена для перебора всё-таки есть. */
for (let i = 0; i < 60; i++) await зов('POST', '/druzya/pozvat', { headers: с(A), body: { pid: A.pid, kod: 'WWWWW' + (i % 8 + 2) } });
r = await зов('POST', '/druzya/pozvat', { headers: с(A), body: { pid: A.pid, kod: 'WWWWW2' } });
так(r.statusCode === 429, 'перебор кодов упирается в стену', r.тело);
ЧАСТОТА.clear();

console.log('Старая висящая заявка принимается по-прежнему');
поставитьСвязь(C.pid, B.pid, 'poslal');
поставитьСвязь(B.pid, C.pid, 'prishla');
r = await зов('GET', '/druzya', { query: { pid: B.pid }, headers: с(B) });
так(r.тело.vhodyashchie.length === 1 && r.тело.vhodyashchie[0].pid === C.pid, 'B видит старую входящую заявку', r.тело.vhodyashchie);
r = await зов('POST', '/druzya/prinyat', { headers: с(B), body: { pid: B.pid, drugPid: C.pid } });
так(r.statusCode === 200 && r.тело.sostoyanie === 'druzya' && r.тело.drug?.pid === C.pid, 'prinyat всё ещё работает', r.тело);
так(связь(B.pid, C.pid)?.sostoyanie === 'druzya' && связь(C.pid, B.pid)?.sostoyanie === 'druzya', 'обе половины стали дружбой');
r = await зов('POST', '/druzya/prinyat', { headers: с(B), body: { pid: B.pid, drugPid: 'pid-nikogo1' } });
так(r.statusCode === 409, 'принять несуществующую заявку нельзя', r.тело);
r = await зов('POST', '/druzya/zabyt', { headers: с(B), body: { pid: B.pid, drugPid: C.pid } });
так(!связь(B.pid, C.pid) && !связь(C.pid, B.pid), 'zabyt убирает у ОБОИХ');

console.log('Картинка аватара');
r = await зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, dannye: б64(ПОРТРЕТ) } });
так(r.statusCode === 200 && r.тело.kartinka_v > 0, 'картинка положена (поле dannye), вернулась метка версии', r.тело);
так(r.тело.avatarV === r.тело.kartinka_v && r.тело.v === r.тело.kartinka_v,
  'метка отдана всеми тремя именами — стенд и экран зовут её avatarV', r.тело);
const версия1 = r.тело.kartinka_v;
так(r.тело.bajt === ПОРТРЕТ.length, 'вес записан честно', r.тело.bajt);
так(Buffer.isBuffer(ЛЮДИ.get(A.pid).kartinka) && ЛЮДИ.get(A.pid).kartinka.length === ПОРТРЕТ.length,
  'байты легли в саму строку базы, а не в бакет');
так(ЛЮДИ.get(A.pid).nick === 'Аня' && ЛЮДИ.get(A.pid).kod === A.kod, 'запись картинки не тронула имя и код');

r = await зов('GET', '/druzya/avatar', { query: { pid: A.pid, v: String(версия1) } });
так(r.statusCode === 200 && r.base64 === true, 'картинка отдаётся двоично (isBase64Encoded)', r.statusCode);
так(Buffer.from(r.сырое, 'base64').equals(ПОРТРЕТ), 'отдано ровно то, что положено');
так(r.headers['Content-Type'] === 'image/jpeg', 'тип ответа — image/jpeg', r.headers['Content-Type']);
так(/immutable/.test(r.headers['Cache-Control'] || '') && /31536000/.test(r.headers['Cache-Control'] || ''),
  'по совпавшей метке — вечный кэш', r.headers['Cache-Control']);
так(r.headers['Access-Control-Allow-Origin'] === 'https://yasnalab.ru', 'CORS на двоичном ответе на месте', r.headers);
так(CORS['Content-Type'] === 'application/json' && CORS['Cache-Control'] === 'no-store',
  'общий объект заголовков не тронут (иначе весь пакет отвечал бы картинкой)', CORS);
r = await зов('GET', '/druzya/avatar', { query: { pid: A.pid, v: '1' } });
так(r.statusCode === 200 && !/immutable/.test(r.headers['Cache-Control'] || ''),
  'по чужой метке вечного кэша НЕ даём (иначе смена аватара не доедет)', r.headers['Cache-Control']);
r = await зов('GET', '/druzya/avatar', { query: { pid: B.pid } });
так(r.statusCode === 404, 'у кого картинки нет — 404, а не пустой ответ', r.тело);
r = await зов('GET', '/druzya/avatar', { query: {} });
так(r.statusCode === 400, 'без pid — 400', r.тело);
r = await зов('GET', '/druzya/avatar', { query: { pid: A.pid } });
так(r.statusCode === 200 && r.base64, 'чужую картинку отдаём любому, кто знает pid (это то же, что имя и знак)');

console.log('Картинка: отказы');
r = await зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, kartinka: б64(ТЯЖЁЛЫЙ) } });
так(r.statusCode === 413, 'тяжелее 40 КБ — вежливый отказ', r.тело);
так(/КБ/.test(r.тело.detail || ''), 'в отказе сказано про вес по-русски', r.тело.detail);
r = await зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, kartinka: б64(PNG) } });
так(r.statusCode === 415 && r.тело.error === 'not jpeg', 'не-JPEG отвергается по подписи файла', r.тело);
r = await зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, kartinka: 'не base64 вовсе!!' } });
так(r.statusCode === 400, 'мусор вместо base64 — 400', r.тело);
r = await зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, kartinka: б64(Buffer.alloc(300, 5)) } });
так(r.statusCode === 415, 'случайные байты без подписи JPEG — 415', r.тело);
так(Buffer.isBuffer(ЛЮДИ.get(A.pid).kartinka) && ЛЮДИ.get(A.pid).kartinka.equals(ПОРТРЕТ),
  'после всех отказов в базе лежит прежняя картинка');
так(ЛЮДИ.get(A.pid).kartinka_v === версия1, 'и версия не сдвинулась', ЛЮДИ.get(A.pid).kartinka_v);

console.log('Картинка: чужой не подменит, версия растёт');
r = await зов('POST', '/druzya/avatar', { headers: с(B), body: { pid: A.pid, kartinka: б64(ПОРТРЕТ2) } });
так(r.statusCode === 401, 'друг знает pid — но подменить картинку не может', r.тело);
так(ЛЮДИ.get(A.pid).kartinka.equals(ПОРТРЕТ), 'картинка A на месте');
r = await зов('POST', '/druzya/avatar', { headers: {}, body: { pid: A.pid, kartinka: б64(ПОРТРЕТ2) } });
так(r.statusCode === 401, 'голого pid недостаточно', r.тело);
r = await зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, kartinka: б64(ПОРТРЕТ2) } });
так(r.statusCode === 200 && r.тело.kartinka_v > версия1, 'своя новая картинка — версия строго выросла',
  { было: версия1, стало: r.тело.kartinka_v });
const версия2 = r.тело.kartinka_v;
r = await зов('GET', '/druzya', { query: { pid: B.pid }, headers: с(B) });
так(r.тело.druzya.find((x) => x.pid === A.pid)?.kartinka_v === версия2,
  'друг видит новую метку в списке — гадать запросом не нужно', r.тело.druzya);
так(r.тело.druzya.find((x) => x.pid === A.pid)?.avatarV === версия2, 'и то же число под именем avatarV');
r = await зов('POST', '/druzya/avatar/ubrat', { headers: с(B), body: { pid: A.pid } });
так(r.statusCode === 401, 'чужой не снимет мою картинку', r.тело);
r = await зов('POST', '/druzya/avatar/ubrat', { headers: с(A), body: { pid: A.pid } });
так(r.statusCode === 200 && r.тело.kartinka_v === null && r.тело.avatarV === 0 && r.тело.snyato === true,
  'картинку можно снять отдельным путём (ubrat)', r.тело);
r = await зов('GET', '/druzya/avatar', { query: { pid: A.pid, v: String(версия2) } });
так(r.statusCode === 404, 'снятая картинка больше не отдаётся', r.тело);
r = await зов('GET', '/druzya', { query: { pid: B.pid }, headers: с(B) });
так(r.тело.druzya.find((x) => x.pid === A.pid)?.kartinka_v === null
  && r.тело.druzya.find((x) => x.pid === A.pid)?.avatarV === 0, 'у друга метка пропала — вернулся знак');
r = await зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, kartinka: б64(ПОРТРЕТ) } });
так(r.тело.kartinka_v > версия2, 'после снятия и новой загрузки версия всё равно больше прежней', r.тело.kartinka_v);
r = await зов('POST', '/druzya/avatar', { headers: с(C), body: { pid: 'pid-nikogo1', kartinka: б64(ПОРТРЕТ) } });
так(r.statusCode === 401 || r.statusCode === 404, 'картинка без карточки не кладётся', r.тело);

console.log('Вход: токен старше секрета, гостевая карточка сливается');
/* Прежняя жизнь: у человека уже есть строка под аккаунтом user-B. */
r = await зов('POST', '/druzya/ya', { headers: ст(B, 'token-B'), body: { pid: B.pid, nick: 'Боря' } });
так(ЛЮДИ.get(B.pid).user_id === 'user-B', 'вход привязал строку к аккаунту', ЛЮДИ.get(B.pid).user_id);
r = await зов('POST', '/druzya/ya', { headers: с(B), body: { pid: B.pid, nick: 'Боря' } });
так(ЛЮДИ.get(B.pid).user_id === 'user-B',
  'запрос БЕЗ токена не обнулил user_id (прежний UPSERT это делал, druzya.js:169)', ЛЮДИ.get(B.pid).user_id);
r = await зов('POST', '/druzya/ya', { headers: ст(B, 'token-C'), body: { pid: B.pid, nick: 'Не Боря' } });
так(r.statusCode === 401, 'чужой аккаунт не откроет карточку вошедшего', r.тело);
r = await зов('POST', '/druzya/ya', { headers: { Authorization: 'Bearer token-C', 'X-Device-Secret': 'chuzhoj-sekret' },
  body: { pid: A.pid, nick: 'Не Аня' } });
так(r.statusCode === 401, 'вошедший с чужим секретом не заберёт себе гостевую карточку', r.тело);
так(ЛЮДИ.get(A.pid) && !ЛЮДИ.get(A.pid).user_id, 'гостевая карточка A осталась гостевой', ЛЮДИ.get(A.pid)?.user_id);

/* Новый телефон того же человека: приложение сочинило гостевой pid, гость
   успел подружиться, потом человек вошёл. */
const Г = { pid: 'pid-gostevoy', секрет: 'sekret-G', ip: '10.0.0.7' };
r = await зов('POST', '/druzya/ya', { headers: с(Г), body: { pid: Г.pid, nick: 'Боря на новом' } });
Г.kod = r.тело.kod;
r = await зов('POST', '/druzya/pozvat', { headers: с(C), body: { pid: C.pid, kod: Г.kod } });
так(связь(C.pid, Г.pid)?.sostoyanie === 'druzya', 'C подружился с гостевой карточкой');
поставитьСвязь('pid-starayaz', Г.pid, 'poslal');
поставитьСвязь(Г.pid, 'pid-starayaz', 'prishla');
r = await зов('POST', '/druzya/ya', { headers: ст(Г, 'token-B'), body: { pid: Г.pid, nick: 'Боря' } });
так(r.statusCode === 200 && r.тело.pid === B.pid, 'вошедший получил свой прежний адрес, а не гостевой', r.тело);
так(!ЛЮДИ.has(Г.pid), 'брошенная гостевая карточка убрана — её код больше никуда не ведёт');
так(связь(C.pid, B.pid)?.sostoyanie === 'druzya' && связь(B.pid, C.pid)?.sostoyanie === 'druzya',
  'дружба C перенесена на прежний адрес');
так(!связь(C.pid, Г.pid) && !связь(Г.pid, C.pid), 'связей с брошенным адресом не осталось');
так(связь(B.pid, 'pid-starayaz')?.sostoyanie === 'prishla' && связь('pid-starayaz', B.pid)?.sostoyanie === 'poslal',
  'висевшая заявка тоже переехала — она больше не висит на пустом месте',
  { мой: связь(B.pid, 'pid-starayaz'), его: связь('pid-starayaz', B.pid) });
r = await зов('GET', '/druzya', { query: { pid: C.pid }, headers: с(C) });
так(r.тело.druzya.some((x) => x.pid === B.pid) && !r.тело.druzya.some((x) => x.pid === Г.pid),
  'у C в списке живой адрес, а не брошенный', r.тело.druzya.map((x) => x.pid));

console.log('Предел числа друзей');
const М = { pid: 'pid-mnogo000', секрет: 'sekret-M', ip: '10.0.0.8' };
r = await зов('POST', '/druzya/ya', { headers: с(М), body: { pid: М.pid, nick: 'Многодруг' } });
М.kod = r.тело.kod;
for (let i = 0; i < Д.ПРЕДЕЛ; i++) {
  поставитьСвязь(М.pid, 'pid-tolpa' + String(i).padStart(4, '0'), 'druzya');
  поставитьСвязь('pid-tolpa' + String(i).padStart(4, '0'), М.pid, 'druzya');
}
ЧАСТОТА.clear();
r = await зов('POST', '/druzya/pozvat', { headers: с(М), body: { pid: М.pid, kod: A.kod } });
так(r.statusCode === 409 && r.тело.error === 'too many friends', 'свой предел друзей проверяется (300 объявлены с первого выпуска)', r.тело);
r = await зов('POST', '/druzya/pozvat', { headers: с(A), body: { pid: A.pid, kod: М.kod } });
так(r.statusCode === 409 && r.тело.error === 'their limit', 'чужой предел тоже: дружба сразу наполняет и чужой список', r.тело);
так(!связь(A.pid, М.pid), 'при отказе связь не завелась');

console.log('Перенос из прежнего дерева');
ЧАСТОТА.clear();
const П = { pid: 'pid-perenos1', секрет: 'sekret-P', ip: '10.0.0.6' };
await зов('POST', '/druzya/ya', { headers: с(П), body: { pid: П.pid, nick: 'Пётр' } });
r = await зов('POST', '/druzya/perenos', { headers: с(П), body: { pid: П.pid, pids: [C.pid, 'pid-neizvest', П.pid, 'мусор'] } });
так(r.statusCode === 200 && r.тело.zaveli === 2, 'перенос завёл заявки, себя и мусор пропустил', r.тело);
так(связь(П.pid, C.pid)?.sostoyanie === 'poslal' && связь(C.pid, П.pid)?.sostoyanie === 'prishla',
  'перенос заводит именно заявку: кода второй стороны у приложения нет');
for (let i = 0; i < Д.ВХОДЯЩИХ_ПРЕДЕЛ; i++) поставитьСвязь('pid-zavalen1', 'pid-stuchit' + String(i).padStart(4, '0'), 'prishla');
r = await зов('POST', '/druzya/perenos', { headers: с(П), body: { pid: П.pid, pids: ['pid-zavalen1'] } });
так(r.тело.otkazano === 1 && !связь(П.pid, 'pid-zavalen1'),
  'чужой ящик входящих не набивается сверх предела (раньше он не считался вовсе)', r.тело);

console.log('Смена своего pid больше не обнуляет счёт (druzya.js:519)');
/* ПОЧЕМУ ЭТО ЗДЕСЬ. Все три ведра частоты звались 'druzya:' + я.pid, а pid —
   это то, что присылает сам обращающийся. Проверено на этой же поддельной
   базе: 200 попыток чужого кода с новым pid каждый раз дошли до поиска все до
   единой, а 320 обращений с кодом одного человека завели ему 300 дружб с
   призраками — список забит навсегда, и настоящий друг получал 409. */
{
  ЧАСТОТА.clear();
  const Ж = { pid: 'pid-zhertva1', секрет: 'sekret-Zh', ip: '10.0.0.20' };
  r = await зов('POST', '/druzya/ya', { headers: с(Ж), body: { pid: Ж.pid, nick: 'Жертва' } });
  Ж.kod = r.тело.kod;
  const ВОР = '10.0.0.66';
  let карточек = 0, подружились = 0;
  for (let i = 0; i < 200; i++) {
    const свежий = 'pid-vor' + String(i).padStart(5, '0');
    const ш = { 'X-Device-Secret': 'sekret-vor-' + i, 'X-Forwarded-For': ВОР };
    if ((await зов('POST', '/druzya/ya', { headers: ш, body: { pid: свежий, nick: 'Вор' } })).statusCode === 200) карточек++;
    if ((await зов('POST', '/druzya/pozvat', { headers: ш, body: { pid: свежий, kod: Ж.kod } })).statusCode === 200) подружились++;
  }
  console.log('   из 200 попыток: карточек заведено ' + карточек + ', дружб с жертвой ' + подружились);
  так(карточек <= 120, '200 попыток завести карточку с новым pid — упёрлось в предел адреса', карточек);
  так(подружились <= 50, 'и подружиться с жертвой удалось не больше 50 раз (было — все 200)', подружились);
  const уЖертвы = СВЯЗИ.filter((x) => x.pid === Ж.pid && x.sostoyanie === 'druzya').length;
  так(уЖертвы <= 50 && уЖертвы < Д.ПРЕДЕЛ, 'список жертвы не забит до предела 300', уЖертвы);
  так(карточек < 200 && !ЛЮДИ.has('pid-vor00199'),
    'карточек, которых счёт не пропустил, в базе нет — отказ не пишет строку', карточек);

  /* Перебор шестизначного кода тем же приёмом. */
  ЧАСТОТА.clear();
  let дошло = 0;
  for (let i = 0; i < 200; i++) {
    const свежий = 'pid-perebor' + String(i).padStart(4, '0');
    const ш = { 'X-Device-Secret': 'sekret-per-' + i, 'X-Forwarded-For': '10.0.0.67' };
    await зов('POST', '/druzya/ya', { headers: ш, body: { pid: свежий, nick: 'Пере' } });
    const о = await зов('POST', '/druzya/pozvat', { headers: ш, body: { pid: свежий, kod: 'ZZZZZ' + (i % 8 + 2) } });
    /* Считаем только те попытки, что ДОШЛИ ДО ПОИСКА КОДА: 404 «no card» —
       это отказ ещё на входе, а не проверенный код. */
    if (о.тело && о.тело.error === 'no such code') дошло++;
  }
  console.log('   из 200 подобранных кодов до поиска дошло ' + дошло);
  так(дошло <= 120, 'перебор кода тоже упёрся в предел адреса (было — все 200 попыток)', дошло);

  /* Своё ведро жертвы наказанием быть не должно: окно прошло — всё работает. */
  ЧАСТОТА.clear();
  r = await зов('POST', '/druzya/pozvat', { headers: с(C), body: { pid: C.pid, kod: Ж.kod } });
  так(r.statusCode === 200 && r.тело.sostoyanie === 'druzya',
    'после окна настоящий друг добавляется как ни в чём не бывало', r.тело);
}

console.log('Класс на общем вайфае: тесный счёт по адресу был бы поломкой');
/* Тридцать человек в одной комнате обмениваются кодами с ОДНОГО адреса —
   ровно тот случай, ради которого раздел и сделан. Счёт по адресу обязан
   быть щедрым, а тесный — по устройству. */
{
  ЧАСТОТА.clear();
  const ВАЙФАЙ = '10.0.0.50';
  const класс = [];
  for (let i = 0; i < 30; i++) {
    const ч = { pid: 'pid-uchenik' + String(i).padStart(3, '0'), секрет: 'sekret-uch-' + i, ip: ВАЙФАЙ };
    const о = await зов('POST', '/druzya/ya', { headers: с(ч), body: { pid: ч.pid, nick: 'Ученик ' + i } });
    ч.kod = о.тело && о.тело.kod;
    класс.push(ч);
  }
  так(класс.every((ч) => !!ч.kod), 'все тридцать завели себе карточку с общего вайфая',
    класс.filter((ч) => !ч.kod).length);
  let подружились = 0;
  for (let i = 1; i < 30; i++) {
    const о = await зов('POST', '/druzya/pozvat', { headers: с(класс[i]), body: { pid: класс[i].pid, kod: класс[0].kod } });
    if (о.statusCode === 200) подружились++;
  }
  так(подружились === 29, 'все двадцать девять добавились к ведущему с общего вайфая', подружились);
}

console.log('Карточку из прежней жизни не увести навсегда (druzya.js:287)');
/* Строка, заведённая до миграции 012: secret_hash пуст. Прежде первый
   пришедший секрет привязывался молча — чужой объявлялся за владельца, менял
   ему имя и ставил ему свою картинку, а владелец получал 401 и не мог
   вернуть НИЧЕГО: дорожки назад в коде не было. */
{
  ЧАСТОТА.clear();
  const Д1 = { pid: 'pid-dedushka', секрет: 'sekret-DED', ip: '10.0.0.30' };
  const час = new Date().toISOString();
  ЛЮДИ.set(Д1.pid, { pid: Д1.pid, user_id: null, device_id: 'telefon-deda', nick: 'Дед',
    avatar: '🦉', kod: 'BCDFGH', secret_hash: null, created_at: час, updated_at: час });
  const вор = { 'X-Device-Secret': 'sekret-VORA', 'X-Forwarded-For': '10.0.0.66' };
  r = await зов('POST', '/druzya/ya', { headers: вор, body: { pid: Д1.pid, nick: 'Взломано' } });
  так(r.statusCode === 401, 'чужой с одним лишь pid за деда не объявится', r.тело);
  так(ЛЮДИ.get(Д1.pid).nick === 'Дед', 'имя деда не подменено');
  так(ЛЮДИ.get(Д1.pid).secret_hash === null, 'и чужой секрет к строке НЕ привязан');
  r = await зов('POST', '/druzya/avatar', { headers: вор, body: { pid: Д1.pid, kartinka: б64(ПОРТРЕТ) } });
  так(r.statusCode === 401, 'и картинку деду чужой не поставит', r.тело);
  r = await зов('POST', '/druzya/ya', { headers: с(Д1), body: { pid: Д1.pid, deviceId: 'telefon-deda', nick: 'Дед' } });
  так(r.statusCode === 200 && ЛЮДИ.get(Д1.pid).secret_hash === createHash('sha256').update(Д1.секрет).digest('hex'),
    'владелец со своим device_id заходит и привязывает секрет', r.тело);
  r = await зов('GET', '/druzya', { query: { pid: Д1.pid }, headers: вор });
  так(r.statusCode === 401, 'после привязки чужой не читает список деда', r.тело);

  /* Строка без device_id: доказательство — свой код дружбы. */
  const Б1 = { pid: 'pid-babushka', секрет: 'sekret-BAB', ip: '10.0.0.31' };
  ЛЮДИ.set(Б1.pid, { pid: Б1.pid, user_id: null, device_id: null, nick: 'Баба',
    avatar: '🦢', kod: 'JKLMNP', secret_hash: null, created_at: час, updated_at: час });
  r = await зов('POST', '/druzya/ya', { headers: вор, body: { pid: Б1.pid, nick: 'Взломано' } });
  так(r.statusCode === 401, 'без кода и без device_id — 401', r.тело);
  r = await зов('POST', '/druzya/ya', { headers: с(Б1), body: { pid: Б1.pid, kod: 'JKLMNP', nick: 'Баба' } });
  так(r.statusCode === 200 && ЛЮДИ.get(Б1.pid).secret_hash, 'свой код дружбы открывает свою старую строку', r.тело);

  /* ДОРОЖКА НАЗАД. Секрет привязан не тем (так уже случилось у тех, кто не
     успел зайти первым) — владелец возвращает строку себе. */
  ЧАСТОТА.clear();
  ЛЮДИ.get(Д1.pid).secret_hash = createHash('sha256').update('sekret-VORA').digest('hex');
  r = await зов('POST', '/druzya/ya', { headers: с(Д1), body: { pid: Д1.pid, nick: 'Дед' } });
  так(r.statusCode === 401, 'пока привязан чужой секрет, владелец не входит', r.тело);
  r = await зов('POST', '/druzya/otvyazat', { headers: вор, body: { pid: Д1.pid } });
  так(r.statusCode === 403, 'вор вернуть себе чужую карточку не может', r.тело);
  r = await зов('POST', '/druzya/otvyazat', { headers: с(Д1), body: { pid: Д1.pid, deviceId: 'telefon-deda' } });
  так(r.statusCode === 200 && r.тело.privyazan === true, 'владелец по device_id забирает карточку обратно', r.тело);
  r = await зов('GET', '/druzya', { query: { pid: Д1.pid }, headers: с(Д1) });
  так(r.statusCode === 200, 'и снова читает свой список', r.статус);
  for (let i = 0; i < 6; i++) await зов('POST', '/druzya/otvyazat', { headers: вор, body: { pid: Д1.pid, kod: 'ZZZZZZ' } });
  r = await зов('POST', '/druzya/otvyazat', { headers: вор, body: { pid: Д1.pid, kod: 'BCDFGH' } });
  так(r.statusCode === 429, 'перебор кода через отвязку упирается в стену на самой карточке', r.тело);
}

console.log('Частота на картинку (druzya.js:630)');
{
  ЧАСТОТА.clear();
  let принято = 0;
  for (let i = 0; i < 50; i++) {
    const о = await зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, dannye: б64(ПОРТРЕТ) } });
    if (о.statusCode === 200) принято++;
  }
  так(принято <= 12 && принято > 0, '50 загрузок подряд — принято не больше дюжины (было: все 50)', принято);
  так([...ЧАСТОТА.keys()].some((к) => к.indexOf('druzya-avatar:') === 0), 'ведро на запись картинки заведено',
    [...ЧАСТОТА.keys()]);
  так(принято === 12, 'принято ровно столько, сколько разрешено устройству', принято);
  ЧАСТОТА.clear();
  r = await зов('GET', '/druzya/avatar', { query: { pid: A.pid }, headers: { 'X-Forwarded-For': '10.0.0.5' } });
  так(ЧАСТОТА.get('druzya-avatar-dat:10.0.0.5') === 1, 'отдача картинки тоже считается — по адресу, а не по pid',
    [...ЧАСТОТА.keys()]);
  ЧАСТОТА.clear();
  r = await зов('POST', '/druzya/avatar/ubrat', { headers: с(A), body: { pid: A.pid } });
  так((ЧАСТОТА.get('druzya-avatar:a:' + A.ip) || 0) === 1, 'снятие — такая же запись и тот же счёт',
    [...ЧАСТОТА.keys()]);
  ЧАСТОТА.clear();
  await зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, dannye: б64(ПОРТРЕТ) } });
}

console.log('Метка версии картинки не повторяется (druzya.js:661)');
{
  ЧАСТОТА.clear();
  const [о1, о2] = await Promise.all([
    зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, dannye: б64(ПОРТРЕТ) } }),
    зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, dannye: б64(ПОРТРЕТ2) } }),
  ]);
  так(о1.statusCode === 200 && о2.statusCode === 200, 'обе одновременные записи приняты', [о1.statusCode, о2.statusCode]);
  так(о1.тело.kartinka_v !== о2.тело.kartinka_v,
    'МЕТКИ РАЗНЫЕ — иначе на вечном кэше один из двоих видел бы чужую картинку год',
    [о1.тело.kartinka_v, о2.тело.kartinka_v]);
  так(ЛЮДИ.get(A.pid).kartinka_v === Math.max(о1.тело.kartinka_v, о2.тело.kartinka_v),
    'в базе осталась бо́льшая метка', ЛЮДИ.get(A.pid).kartinka_v);

  /* Чужая запись вклинилась и ушла вперёд: ручка обязана перечитать строку и
     поставить метку БОЛЬШЕ, а не потерять картинку молча. */
  const далеко = Date.now() * 1000 + 5000000;
  ЛЮДИ.get(A.pid).kartinka_v = далеко;
  ЧАСТОТА.clear();
  r = await зов('POST', '/druzya/avatar', { headers: с(A), body: { pid: A.pid, dannye: б64(ПОРТРЕТ2) } });
  так(r.statusCode === 200 && r.тело.kartinka_v > далеко, 'после чужой записи метка перечитана и выросла',
    [далеко, r.тело.kartinka_v]);
  так(ЛЮДИ.get(A.pid).kartinka.equals(ПОРТРЕТ2), 'и в базе лежит именно новая картинка');
}

console.log('Удаление аккаунта уносит и карточку дружбы (auth-email.js:526)');
{
  ЧАСТОТА.clear();
  const У = { pid: 'pid-uhodyash', секрет: 'sekret-U', ip: '10.0.0.40' };
  r = await зов('POST', '/druzya/ya', { headers: ст(У, 'token-C'), body: { pid: У.pid, nick: 'Уходящий' } });
  У.kod = r.тело.kod;
  await зов('POST', '/druzya/avatar', { headers: с(У), body: { pid: У.pid, dannye: б64(ПОРТРЕТ) } });
  r = await зов('POST', '/druzya/pozvat', { headers: с(C), body: { pid: C.pid, kod: У.kod } });
  так(r.statusCode === 200, 'у уходящего есть друг и есть картинка', r.тело);
  const итог = await Д.убратьПриУдалении(drv, д, 'user-C');
  так(итог.pid === У.pid && итог.svyazej >= 1, 'уборка нашла карточку по аккаунту', итог);
  так(!ЛЮДИ.has(У.pid), 'карточка (имя, знак, код и ФОТОГРАФИЯ) убрана из базы');
  так(!связь(C.pid, У.pid) && !связь(У.pid, C.pid), 'обе половины связей стёрты');
  r = await зов('GET', '/druzya/avatar', { query: { pid: У.pid } });
  так(r.statusCode === 404, 'лицо больше не отдаётся никому, кто знает pid', r.тело);
  const пусто = await Д.убратьПриУдалении(drv, д, 'user-nikogo');
  так(пусто.pid === null, 'у кого карточки не было — уборка молча ничего не делает', пусто);
}

console.log('Договор ответов');
r = await зов('GET', '/druzya', { query: { pid: 'коротко' }, headers: с(A) });
так(r.statusCode === 401, 'кривой pid не проходит', r.тело);
r = await зов('POST', '/druzya/nevedomo', { headers: с(A), body: { pid: A.pid } });
так(r.statusCode === 404 && r.тело.error === 'not found', 'неизвестный путь → 404', r.тело);
r = await зов('GET', '/druzya', { query: { pid: A.pid }, headers: с(A) });
так(r.headers['Cache-Control'] === 'no-store', 'состояние не кэшируется', r.headers['Cache-Control']);
так(r.тело.druzya.every((x) => 'pid' in x && 'nick' in x && 'avatar' in x && 'kartinka_v' in x && 'ts' in x),
  'карточка друга — по договору', r.тело.druzya[0]);

console.log('');
console.log(провалов ? '✗ провалов: ' + провалов + ' из ' + всего : '✓ все ' + всего + ' проверок прошли');
console.log('  запросов к базе за прогон: ' + запросов);
process.exit(провалов ? 1 : 0);
