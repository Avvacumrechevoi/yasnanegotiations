/* ═══════════════════════════════════════════════════════════════════════════
   ДРУЗЬЯ В ТАБЛИЦАХ (миграции 006 и 012).

   Раньше дружба жила в дереве Firebase, а личностью человека была запись в
   памяти телефона. Разбор бед — в шапке миграции; здесь важно одно следствие:
   ОБЕ ПОЛОВИНЫ ПАРЫ ВСЕГДА МЕНЯЮТСЯ ВМЕСТЕ, одним запросом. Из-за того, что
   в дереве это было невозможно, «убрать друга» работало только у себя, а
   согласие лежало в ящике, пока второй не откроет приложение.

   КОД — ЭТО И ЕСТЬ СОГЛАСИЕ. Один человек дал свой код, второй его ввёл:
   спрашивать после этого «принять заявку?» не у кого и не о чем. Поэтому
   /druzya/pozvat заводит дружбу НЕМЕДЛЯ у обоих и возвращает карточку нового
   друга, чтобы экран показал его без второго запроса. Ручки prinyat и zabyt
   остаются: заявки, посланные прежними выпусками, у людей уже висят в базе, и
   принять их надо по-прежнему.

   КТО ТАКОЙ ЧЕЛОВЕК ЗДЕСЬ. Публичный адрес pid — случайный, приходит от
   приложения (у существующих людей он уже есть, и мы его не меняем: иначе
   переезд стёр бы всех друзей). Право на строку доказывается токеном
   вошедшего либо секретом устройства, ПРИВЯЗАННЫМ К ЭТОЙ СТРОКЕ (миграция
   012). Голого pid недостаточно, и голого секрета тоже: до 012 сюда пускал
   любой непустой заголовок X-Device-Secret, а pid знает каждый, кто есть у
   человека в друзьях, — то есть от чужого имени можно было звать, убирать
   друзей и править карточку.
   У СТРОК БЕЗ ЗАПИСАННОГО СЕКРЕТА право доказывается device_id телефона либо
   своим кодом дружбы: первый пришедший секрет не привязывается молча, иначе
   карточку (вместе с лицом и кодом) уводили бы навсегда. Дорожка назад —
   POST /druzya/otvyazat.

   ЧТО ОСТАЁТСЯ В FIREBASE. Зовы в Партию: им нужна секунда доставки, а не
   таблица.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const crypto = require('crypto');

const АЛФАВИТ = 'BCDFGHJKLMNPQRSTVWXZ23456789';   /* тот же, что у комнат: без похожих букв */
const ДЛИНА_КОДА = 6;
const МАКС_ИМЯ = 40;
const МАКС_ЗВЕРЬ = 16;
const МАКС_PID = 64;
const МАКС_СЕКРЕТ = 200;
/* Добавлений за окно с ОДНОГО УСТРОЙСТВА. Дерево частоту не считало вовсе —
   тот, кто узнал чужой код, мог слать заявки в цикле. */
const ЗАЯВОК_ЗА_ОКНО = 10;
/* Отдельный, щедрый счёт для НЕНАЙДЕННЫХ кодов. Раньше счётчик стоял выше
   поиска: десять опечаток — и человек получал «Слишком много заявок подряд»,
   не отправив ни одной. Совсем без счёта тоже нельзя — перебор кодов должен
   упираться в стену. */
const ОПЕЧАТОК_ЗА_ОКНО = 60;
const ДРУЗЕЙ_ПРЕДЕЛ = 300;
/* Входящих заявок раньше не считал никто: список чужого экрана можно было
   набить переносом. Новые заявки больше не заводятся вовсе (код = согласие),
   предел остался ради /druzya/perenos. */
const ВХОДЯЩИХ_ПРЕДЕЛ = 100;

/* ─── НА ЧЁМ КЛЮЧУЕТСЯ СЧЁТ ЧАСТОТЫ ──────────────────────────────────────
   НЕ на pid из тела запроса. Прежде все три ведра звались 'druzya:' + я.pid,
   'druzya-kod:' + я.pid и 'perenos:' + я.pid, а pid — это произвольные 8–64
   знака, которые присылает САМ обращающийся: новый pid — новое ведро, и
   счёта не было вовсе. Проверено на поддельной базе: 200 попыток чужого кода
   с новым pid каждый раз прошли все до единой, а 320 обращений с кодом
   одного человека завели ему 300 дружб-призраков и забили список навсегда.

   Ключуем на том, чего нападающий не выбирает: хеш адреса (его считает
   ipHash по заголовку X-Forwarded-For, который ставит шлюз) и хеш секрета
   устройства. Сверх этого — ведро на ЦЕЛЬ (того, кого добавляют): его
   нападающий не выбирает тем более, и смена своего адреса его не обнуляет.

   СЧЁТ ДВОЙНОЙ: по адресу и по устройству, и пройти надо оба.
   ПО АДРЕСУ пределы щедрые: за одним адресом сидит целый класс, который
   обменивается кодами на общем вайфае, а мобильный оператор прячет за ним и
   тысячи людей. Тесный счёт по адресу был бы не защитой, а поломкой ровно в
   том случае, ради которого всё и сделано.
   ПО УСТРОЙСТВУ пределы тесные: одному человеку больше и не нужно. Секрет
   нападающий сменить может, но каждая смена тратит запас АДРЕСА, а к одному
   человеку сверх К_ОДНОМУ_ЗА_ОКНО не пройти вовсе — это ведро висит на том,
   кого добавляют.
   ЧЕСТНО О ТОМ, ЧТО ЗДЕСЬ ЧТО ДЕРЖИТ. По-настоящему беду закрывают три
   вещи: своя карточка обязана существовать, ведро на цель и тесный счёт по
   устройству. Счёт по адресу — грубый заслон от потока записей в базу, и
   пределы у него нарочно такие, чтобы курс на общем вайфае в него не
   упирался никогда. */
const ЗАЯВОК_С_АДРЕСА = 400;
const ОПЕЧАТОК_С_АДРЕСА = 600;
/* Сколько человек могут добавиться К ОДНОМУ за окно. Это главный заслон:
   ведро висит на том, кого добавляют, и сменой своего адреса или телефона не
   обнуляется. Число выбрано по живому случаю, а не по красоте: группа на
   курсе обменивается кодами с ведущим разом, и упереться в предел там
   означало бы сломать ровно то, ради чего раздел сделан. Полсотни за
   четверть часа группа не переберёт, а нападающему, чтобы забить чужой
   список до трёхсот, нужны часы работы — и каждую призрачную дружбу человек
   у себя видит и убирает. */
const К_ОДНОМУ_ЗА_ОКНО = 50;
const КАРТОЧЕК_ЗА_ОКНО = 5;       /* новых карточек с одного устройства */
const КАРТОЧЕК_С_АДРЕСА = 120;
const ПЕРЕНОСОВ_ЗА_ОКНО = 3;
const ПЕРЕНОСОВ_С_АДРЕСА = 60;
const ОТВЯЗОК_ЗА_ОКНО = 5;        /* попыток вернуть себе карточку */

/* ─── картинка аватара (миграция 012) ────────────────────────────────────── */
/* Режет её ТЕЛЕФОН: квадрат 256 на 256, JPEG, не тяжелее 40 КБ. Сервер
   проверяет вес и подпись файла и отказывает вежливо — доверять клиенту
   размер нельзя, а разжимать картинку в облачной функции незачем. */
const КАРТИНКА_БАЙТ = 40 * 1024;
const КАРТИНКА_ТИП = 'image/jpeg';
/* Base64 длиннее байтов на треть; лишний запас — на приставку data: и
   переносы строк. Строку отсекаем ДО разбора: разбирать мегабайт, чтобы потом
   сказать «тяжело», — это работа впустую. */
const КАРТИНКА_СТРОКА = 64 * 1024;
const ГОД_СЕКУНД = 31536000;
/* Смен картинки за окно. Раньше запись картинки не считалась ВОВСЕ: 50
   подряд загрузок по 39 КБ от одного человека проходили все пятьдесят —
   неограниченная запись двоичных строк в YDB (счёт за операции и за место).
   Живому человеку дюжины смен за окно хватает с большим запасом. */
const КАРТИНОК_ЗА_ОКНО = 12;
const КАРТИНОК_С_АДРЕСА = 200;
/* Отдача картинки — счёт мягкий: её тянет обычный <img>, и у человека с
   полусотней друзей первый заход честно просит полсотни картинок. */
const ОТДАЧ_ЗА_ОКНО = 600;

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

/* Сравнение хешей — в постоянное время, как в /progress и в ленте. */
function хешСекрета(с) {
  return crypto.createHash('sha256').update(String(с)).digest('hex');
}
function хешиРавны(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* Кто обращается — для счёта, а не для права. Адрес считает ipHash по
   заголовку, который ставит шлюз; устройство — по хешу секрета либо по
   аккаунту. Ни то, ни другое не берётся из тела запроса. */
function адресОбращения(ctx) {
  const д = ctx.д;
  try { return (typeof д.ipHash === 'function' ? д.ipHash(ctx.event) : null) || null; }
  catch (e) { return null; }
}
function устройствоОбращения(я) {
  if (я && я.хеш) return 'h' + String(я.хеш).slice(0, 32);
  if (я && я.userId) return 'u' + String(я.userId).slice(0, 40);
  return null;
}

/* Истина — «можно», как у throttleHit. Проходить надо ОБА счёта; чего нет
   (адреса за шлюзом может и не оказаться), того и не считаем — но совсем без
   имени, ни адреса, ни устройства, не пускаем никого. */
async function частота(drv, ctx, я, имя, поАдресу, поУстройству) {
  const д = ctx.д;
  const адрес = адресОбращения(ctx);
  const устройство = устройствоОбращения(я);
  if (!адрес && !устройство) return false;
  if (адрес && !(await д.throttleHit(drv, имя + ':a:' + адрес, поАдресу))) return false;
  if (устройство && !(await д.throttleHit(drv, имя + ':u:' + устройство, поУстройству))) return false;
  return true;
}

/* Чем ещё, кроме секрета, доказывается право на СТАРУЮ строку (у которой
   secret_hash пуст). Тем, чего в списке друзей нет и наружу не отдаёт ни
   одна ручка: device_id этого телефона, а если его в строке не записано —
   своим кодом дружбы. Оба лежат в памяти телефона и живут ровно столько же,
   сколько сам pid: потерявший их потерял и pid, и заводит новую карточку. */
function своя(было, ctx, deviceId) {
  if (!было) return false;
  if (было.deviceId) return !!(deviceId && было.deviceId === deviceId);
  const код = кодРовный((ctx.body && ctx.body.kod) || (ctx.query && ctx.query.kod));
  return !!(было.kod && код && код === было.kod);
}
const НЕЧЕМ_ДОКАЗАТЬ = 'карточка заведена другим телефоном: назовите свой код дружбы';

/* Байты из ответа YDB: колонка String приходит полем bytesValue. */
function байты(x) {
  const b = x && (x.bytesValue !== undefined ? x.bytesValue : x.bytes_value);
  if (b === undefined || b === null) return null;
  if (Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') return Buffer.from(b, 'base64');
  return Buffer.from(b);
}
/* И обратно. Имя метода у ydb-sdk за версии менялось (bytes / string), а
   ошибиться здесь — значит уронить запись картинки уже в бою. */
function значениеБайтов(д, буфер) {
  const { TypedValues, Types } = д;
  if (typeof TypedValues.bytes === 'function') return TypedValues.bytes(буфер);
  if (typeof TypedValues.string === 'function') return TypedValues.string(буфер);
  return TypedValues.fromNative((Types && (Types.BYTES || Types.STRING)) || 'string', буфер);
}
function пустоТекст(д) {
  const { TypedValues, Types } = д;
  return TypedValues.optionalNull(Types.UTF8);
}

/* ─── чтение карточки ────────────────────────────────────────────────────── */
/* Без самих байтов картинки: они нужны ровно одной ручке, а таскать их в
   каждый список — это лишние сорок килобайт на каждого друга. */
async function карточкаПоPid(drv, д, pid) {
  const { TypedValues } = д;
  let к = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $p AS Utf8;
      SELECT pid, user_id, device_id, nick, avatar, kod, secret_hash, kartinka_v, kartinka_bajt
      FROM druzya_ludi WHERE pid = $p;`,
      { '$p': TypedValues.utf8(pid) });
    const row = r.resultSets[0]?.rows?.[0];
    if (!row) return;
    const и = row.items;
    к = { pid: д.txt(и[0]), userId: д.txt(и[1]), deviceId: д.txt(и[2]),
          nick: д.txt(и[3]), avatar: д.txt(и[4]), kod: д.txt(и[5]),
          secretHash: д.txt(и[6]), kartinkaV: д.num(и[7]), kartinkaBajt: д.num(и[8]) };
  });
  return к;
}

/* То, что видит другой человек: имя, знак и метка версии картинки. Метка
   нужна экрану, чтобы знать, У КОГО картинка есть, и не гадать запросом.

   ПОЧЕМУ СМОТРИМ НА ВЕС, А НЕ НА ВЕРСИЮ. Снятая картинка оставляет версию в
   строке (иначе после «снял и положил заново» в ту же миллисекунду версия
   повторилась бы, а на ней висит вечный кэш — друг с прежним адресом в кэше
   так и остался бы со старой картинкой). Признак «картинка есть» — вес. */
function наружу(к, pid) {
  const есть = !!(к && к.kartinkaBajt);
  const в = есть ? (к.kartinkaV || 0) : 0;
  /* Имя метки двойное нарочно. Подставной шлюз стенда и экраны приложения
     писались по полю avatarV (ноль — картинки нет), договор ручек здесь — по
     kartinka_v (пусто — картинки нет). Отдаём оба и не заставляем ни одну
     сторону переучиваться на выкладке. */
  return { pid, nick: (к && к.nick) || 'Игрок', avatar: (к && к.avatar) || '✦',
           kartinka_v: в || null, avatarV: в };
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

/* ─── связи ──────────────────────────────────────────────────────────────── */
async function состояниеСвязи(drv, д, мой, чужой) {
  const { TypedValues } = д;
  let с = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $p AS Utf8; DECLARE $d AS Utf8;
      SELECT sostoyanie FROM druzhba WHERE pid = $p AND drug_pid = $d;`,
      { '$p': TypedValues.utf8(мой), '$d': TypedValues.utf8(чужой) });
    const row = r.resultSets[0]?.rows?.[0];
    if (row) с = д.txt(row.items[0]);
  });
  return с;
}

/* Сколько у человека связей в этом состоянии. Читаем НЕ БОЛЬШЕ предела строк:
   сверх него ответ всё равно один и тот же, а обход всей половины таблицы —
   нет. Тот же приём, что у потолка жалоб в ленте. */
async function сколько(drv, д, pid, состояние, предел) {
  const { TypedValues } = д;
  let n = 0;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $p AS Utf8; DECLARE $s AS Utf8; DECLARE $n AS Uint64;
      $ryad = SELECT drug_pid FROM druzhba WHERE pid = $p AND sostoyanie = $s LIMIT $n;
      SELECT COUNT(*) AS n FROM $ryad;`,
      { '$p': TypedValues.utf8(pid), '$s': TypedValues.utf8(состояние),
        '$n': TypedValues.uint64(предел) });
    const row = r.resultSets[0]?.rows?.[0];
    n = row ? (д.num(row.items[0]) || 0) : 0;
  });
  return n;
}

const зеркало = (с) => (с === ПОСЛАЛ ? ПРИШЛА : с === ПРИШЛА ? ПОСЛАЛ : с);

/* ОБЕ ПОЛОВИНЫ ОДНИМ ЗАПРОСОМ. Ради этого дружба и переехала в таблицы:
   в дереве чужую половину тронуть было нельзя, и заявка ложилась в ящик. */
async function записатьПару(drv, д, мой, чужой, состояние) {
  const { TypedValues } = д;
  await drv.tableClient.withSession(async (s) => {
    await s.executeQuery(`
      DECLARE $ja AS Utf8; DECLARE $on AS Utf8;
      DECLARE $moe AS Utf8; DECLARE $ego AS Utf8;
      UPSERT INTO druzhba (pid, drug_pid, sostoyanie, created_at, updated_at)
      VALUES ($ja, $on, $moe, CurrentUtcTimestamp(), CurrentUtcTimestamp());
      UPSERT INTO druzhba (pid, drug_pid, sostoyanie, created_at, updated_at)
      VALUES ($on, $ja, $ego, CurrentUtcTimestamp(), CurrentUtcTimestamp());`,
      { '$ja': TypedValues.utf8(мой), '$on': TypedValues.utf8(чужой),
        '$moe': TypedValues.utf8(состояние), '$ego': TypedValues.utf8(зеркало(состояние)) });
  });
}

/* Стираем ОБЕ половины. Это и есть лечение «убрал только у себя»: в дереве
   чужую строку правило не отдавало, и убранный продолжал видеть и звать. */
async function стеретьПару(drv, д, мой, чужой) {
  const { TypedValues } = д;
  await drv.tableClient.withSession(async (s) => {
    await s.executeQuery(`
      DECLARE $ja AS Utf8; DECLARE $on AS Utf8;
      DELETE FROM druzhba WHERE pid = $ja AND drug_pid = $on;
      DELETE FROM druzhba WHERE pid = $on AND drug_pid = $ja;`,
      { '$ja': TypedValues.utf8(мой), '$on': TypedValues.utf8(чужой) });
  });
}

/* ─── кто обращается ─────────────────────────────────────────────────────── */
/* Возвращает {ok:true, pid, userId, deviceId, хеш, было} либо {ok:false, pochemu}.
   ПРАВО НА СТРОКУ:
     • токен вошедшего старше секрета: свой аккаунт открывает свою строку
       всегда, чужую — никогда;
     • гостевая строка открывается секретом, привязанным к НЕЙ. У строк,
       заведённых до миграции 012, секрета ещё нет — и первый пришедший НЕ
       привязывается молча: нужен device_id этой строки либо свой код дружбы
       (см. своя()). Молчаливая привязка уводила карточку навсегда;
     • строку вошедшего голый секрет НЕ открывает, пока в ней не записан
       именно этот секрет. Иначе, узнав чужой pid из списка друзей, любой мог
       бы привязать к чужой строке свой секрет и говорить от чужого имени. */
async function ктоЭто(drv, ctx) {
  const { event, body, query, д } = ctx;
  const авт = event.headers?.Authorization || event.headers?.authorization;
  const токен = авт?.startsWith('Bearer ') ? д.verifyJWT(авт.slice(7), process.env.JWT_SECRET) : null;
  const userId = токен?.sub ? String(токен.sub) : null;
  const сыройСекрет = event.headers?.['X-Device-Secret'] || event.headers?.['x-device-secret'] || null;
  const секрет = д.clean(сыройСекрет, МАКС_СЕКРЕТ);
  const deviceId = д.clean((body && body.deviceId) || (query && query.deviceId), 80);
  const pid = pidРовный((body && body.pid) || (query && query.pid), д.clean);
  if (!pid) return { ok: false, pochemu: 'нужен правильный pid' };
  if (!userId && !секрет) return { ok: false, pochemu: 'нужен вход или секрет устройства' };

  const хеш = секрет ? хешСекрета(секрет) : null;
  const было = await карточкаПоPid(drv, д, pid);
  let привязать = false;

  if (было) {
    if (было.userId) {
      if (userId) {
        if (было.userId !== userId) return { ok: false, pochemu: 'это чужая карточка' };
        /* Свой аккаунт на новом телефоне: секрет этого телефона в строке ещё
           не записан — записываем, чтобы дальше человек обходился без токена. */
        if (хеш && !было.secretHash) привязать = true;
      } else if (!хешиРавны(было.secretHash, хеш)) {
        return { ok: false, pochemu: 'этой карточкой владеет вошедший — нужен токен' };
      }
    } else if (было.secretHash) {
      if (!хешиРавны(было.secretHash, хеш)) return { ok: false, pochemu: 'секрет устройства не совпадает' };
    } else {
      /* СТРОКА ИЗ ПРЕЖНЕЙ ЖИЗНИ: секрета в ней ещё нет. Первый пришедший
         секрет мы больше НЕ привязываем молча. Так карточку уводили
         НАВСЕГДА: pid отдаёт GET /druzya каждому другу, чужой объявлялся за
         владельца, менял ему имя и ставил ему свою картинку, а настоящий
         владелец получал 401 «секрет устройства не совпадает» и не мог
         вернуть ни карточку, ни свой код дружбы, ни список друзей, ни лицо.
         Дорожки назад в коде не было вовсе.
         Пускаем только по тому, чего в чужих руках нет: device_id этого
         телефона либо свой код дружбы. Не сошлось — 401 со словами, что
         делать; вернуть себе строку можно ручкой /druzya/otvyazat. */
      if (!хеш) return { ok: false, pochemu: 'нужен секрет устройства' };
      if (!своя(было, ctx, deviceId)) return { ok: false, pochemu: НЕЧЕМ_ДОКАЗАТЬ };
      привязать = true;
    }
  }

  if (привязать) await привязатьСекрет(drv, д, pid, хеш);
  return { ok: true, pid, userId, deviceId, секрет, хеш, было };
}

/* Частичная запись — только UPDATE: UPSERT в YDB требует ВСЕ NOT NULL
   колонки таблицы, и «допишу одно поле» здесь физически невозможно. */
async function привязатьСекрет(drv, д, pid, хеш) {
  const { TypedValues } = д;
  await drv.tableClient.withSession(async (s) => {
    await s.executeQuery(`DECLARE $p AS Utf8; DECLARE $h AS Utf8;
      UPDATE druzya_ludi SET secret_hash = $h, updated_at = CurrentUtcTimestamp()
      WHERE pid = $p;`,
      { '$p': TypedValues.utf8(pid), '$h': TypedValues.utf8(хеш) });
  });
}

/* ─── POST /druzya/otvyazat — вернуть себе карточку ──────────────────────
   ДОРОЖКА НАЗАД. Пока секрет привязывался первым пришедшим, увести карточку
   можно было навсегда: сбросить чужую привязку было нечем. Теперь она есть.
   Доказательство то же, что и при первой привязке (device_id этого телефона
   либо свой код дружбы), а у карточки вошедшего — только его токен.
   Счёт двойной: по адресу и по САМОЙ КАРТОЧКЕ, иначе перебор кода дружбы
   упирался бы только в свой адрес, а сменить адрес дешевле, чем угадать
   шесть знаков. */
async function отвязать(drv, ctx) {
  const { body, event, д } = ctx;
  const { ok, fail, throttleHit } = д;
  const pid = pidРовный(body && body.pid, д.clean);
  if (!pid) return fail(400, 'no pid', { detail: 'нужен правильный pid' });
  const сырой = event.headers?.['X-Device-Secret'] || event.headers?.['x-device-secret'] || null;
  const секрет = д.clean(сырой, МАКС_СЕКРЕТ);
  if (!секрет) return fail(400, 'no secret', { detail: 'нужен секрет устройства' });
  const хеш = хешСекрета(секрет);

  if (!(await частота(drv, ctx, { хеш }, 'druzya-otvyaz', ОТВЯЗОК_ЗА_ОКНО * 4, ОТВЯЗОК_ЗА_ОКНО)))
    return fail(429, 'too many', { detail: 'Слишком много попыток подряд. Попробуйте позже.' });
  if (!(await throttleHit(drv, 'druzya-otvyaz-pid:' + pid, ОТВЯЗОК_ЗА_ОКНО)))
    return fail(429, 'too many', { detail: 'Слишком много попыток подряд. Попробуйте позже.' });

  const было = await карточкаПоPid(drv, д, pid);
  if (!было) return fail(404, 'no card', { detail: 'Такой карточки нет.' });

  const авт = event.headers?.Authorization || event.headers?.authorization;
  const токен = авт?.startsWith('Bearer ') ? д.verifyJWT(авт.slice(7), process.env.JWT_SECRET) : null;
  const userId = токен?.sub ? String(токен.sub) : null;
  const токеном = !!(userId && было.userId && было.userId === userId);

  /* Карточка вошедшего возвращается только его токеном: у неё есть хозяин,
     и код дружбы, который человек кому-то разослал, хозяином не делает. */
  if (было.userId && !токеном)
    return fail(403, 'forbidden', { detail: 'Этой карточкой владеет вошедший — войдите по почте.' });
  if (!токеном && !своя(было, ctx, д.clean(body && body.deviceId, 80)))
    return fail(403, 'forbidden',
      { detail: 'Назовите свой код дружбы — он показан в разделе «Свои люди» на вашем телефоне.' });

  await привязатьСекрет(drv, д, pid, хеш);
  return ok({ pid, privyazan: true });
}

/* ─── слияние брошенной гостевой карточки ────────────────────────────────── */
/* Человек играл гостем (строка с одним pid и своим кодом), потом вошёл — и у
   него нашлась прежняя строка по аккаунту. Раньше код просто подменял pid, а
   гостевая карточка оставалась жить со своим кодом: заявка, посланная на неё,
   висела вечно, потому что владелец кода в эту строку больше не заглядывал.
   Поэтому связи переносим на прежний pid, а брошенную карточку убираем. */
async function слить(drv, д, изPid, вPid) {
  const { TypedValues } = д;
  const связи = [];
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $p AS Utf8;
      SELECT drug_pid, sostoyanie FROM druzhba WHERE pid = $p LIMIT 500;`,
      { '$p': TypedValues.utf8(изPid) });
    for (const row of (r.resultSets[0]?.rows || []))
      связи.push({ pid: д.txt(row.items[0]), sostoyanie: д.txt(row.items[1]) });
  });

  for (const ч of связи) {
    /* Дружба с самим собой невозможна: две мои же карточки просто расцепляем. */
    if (ч.pid === вPid) { await стеретьПару(drv, д, изPid, ч.pid); continue; }
    const уже = await состояниеСвязи(drv, д, вPid, ч.pid);
    /* Что сильнее: дружба сильнее заявки, а встречные заявки — это согласие
       обоих, то есть тоже дружба. */
    let итог = уже || ч.sostoyanie;
    if (уже === ДРУЗЬЯ || ч.sostoyanie === ДРУЗЬЯ) итог = ДРУЗЬЯ;
    else if (уже && уже !== ч.sostoyanie) итог = ДРУЗЬЯ;
    if (итог !== уже) await записатьПару(drv, д, вPid, ч.pid, итог);
    await стеретьПару(drv, д, изPid, ч.pid);
  }

  await drv.tableClient.withSession(async (s) => {
    await s.executeQuery(`DECLARE $p AS Utf8;
      DELETE FROM druzya_ludi WHERE pid = $p;`,
      { '$p': TypedValues.utf8(изPid) });
  });
  return связи.length;
}

/* ─── POST /druzya/ya — объявиться ───────────────────────────────────────── */
/* Заводит или обновляет свою карточку и отдаёт код. Зовётся при заходе в
   раздел и после смены имени. Пишем только при расхождении: имя и зверь
   меняются раз в жизни, а лишняя запись в базу — это лишняя запись в базу. */
async function объявиться(drv, ctx) {
  const { body, д } = ctx;
  const { TypedValues, Types, ok, fail, clean } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я.ok) return fail(401, 'unauthorized', { detail: я.pochemu });

  const ник = clean(body.nick, МАКС_ИМЯ) || 'Игрок';
  const зверь = clean(body.avatar, МАКС_ЗВЕРЬ) || '✦';

  /* ВОШЁЛ — ЗНАЧИТ УЖЕ МОЖЕТ БЫТЬ ЗДЕСЬ. На новом телефоне приложение
     сочиняет себе новый адрес: он лежит в памяти телефона, а её на новом
     устройстве нет. Если бы мы завели по нему вторую строку, человек пришёл
     бы в свой аккаунт и не нашёл ни одного друга — ровно та беда, ради
     которой дружба и переезжала. Поэтому у вошедшего сначала спрашиваем
     базу: есть его строка — работаем с НЕЙ, а присланную карточку сливаем в
     неё и убираем. Приложение получает свой настоящий адрес в ответе. */
  let слито = 0;
  if (я.userId) {
    const прежний = await pidПоАккаунту(drv, д, я.userId);
    if (прежний && прежний !== я.pid) {
      if (я.было) слито = await слить(drv, д, я.pid, прежний);
      я.pid = прежний;
      я.было = await карточкаПоPid(drv, д, прежний);
    }
  }

  const было = я.было;
  /* НОВАЯ КАРТОЧКА СТОИТ ОБРАЩЕНИЯ. Без этого счёта нападающий заводил себе
     свежий pid на каждый запрос — а с ним и свежую строку в базе — и этим
     обнулял любое наказание. Счёт по адресу, не по pid: см. шапку вёдер. */
  if (!было && !(await частота(drv, ctx, я, 'druzya-ya', КАРТОЧЕК_С_АДРЕСА, КАРТОЧЕК_ЗА_ОКНО)))
    return fail(429, 'too many', { detail: 'Слишком много новых карточек подряд. Попробуйте позже.' });

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
      const п = кодСлучайный(crypto);
      if (!(await pidПоКоду(drv, д, п))) код = п;
    }
    if (!код) return fail(503, 'no code', { detail: 'не удалось подобрать свободный код, попробуйте позже' });
  }

  /* Кому принадлежит строка, запрос БЕЗ ТОКЕНА не решает. Прежде здесь стоял
     UPSERT, который писал user_id из запроса как есть: гостевое обращение с
     тем же pid обнуляло привязку к аккаунту, и на новом телефоне человек
     терял всех друзей — ту самую беду, ради которой дружба переезжала. */
  const хозяин = я.userId || было?.userId || null;
  const устройство = я.deviceId || было?.deviceId || null;
  const тоЖе = было && было.nick === ник && было.avatar === зверь
    && было.kod === код && было.userId === хозяин && было.deviceId === устройство;

  if (!тоЖе) {
    await drv.tableClient.withSession(async (s) => {
      if (было) {
        /* Строка есть — правим её поля. Секрет и картинка при этом остаются
           нетронутыми: их здесь не упоминают вовсе. */
        await s.executeQuery(`
          DECLARE $p AS Utf8; DECLARE $u AS Optional<Utf8>; DECLARE $d AS Optional<Utf8>;
          DECLARE $n AS Utf8; DECLARE $a AS Optional<Utf8>; DECLARE $k AS Utf8;
          UPDATE druzya_ludi SET user_id = $u, device_id = $d, nick = $n, avatar = $a,
                 kod = $k, updated_at = CurrentUtcTimestamp()
          WHERE pid = $p;`,
          {
            '$p': TypedValues.utf8(я.pid),
            '$u': хозяин ? TypedValues.optional(TypedValues.utf8(хозяин)) : пустоТекст(д),
            '$d': устройство ? TypedValues.optional(TypedValues.utf8(устройство)) : пустоТекст(д),
            '$n': TypedValues.utf8(ник),
            '$a': TypedValues.optional(TypedValues.utf8(зверь)),
            '$k': TypedValues.utf8(код),
          });
      } else {
        await s.executeQuery(`
          DECLARE $p AS Utf8; DECLARE $u AS Optional<Utf8>; DECLARE $d AS Optional<Utf8>;
          DECLARE $n AS Utf8; DECLARE $a AS Optional<Utf8>; DECLARE $k AS Utf8;
          DECLARE $h AS Optional<Utf8>;
          UPSERT INTO druzya_ludi (pid, user_id, device_id, nick, avatar, kod, secret_hash,
                                   created_at, updated_at)
          VALUES ($p, $u, $d, $n, $a, $k, $h, CurrentUtcTimestamp(), CurrentUtcTimestamp());`,
          {
            '$p': TypedValues.utf8(я.pid),
            '$u': хозяин ? TypedValues.optional(TypedValues.utf8(хозяин)) : пустоТекст(д),
            '$d': устройство ? TypedValues.optional(TypedValues.utf8(устройство)) : пустоТекст(д),
            '$n': TypedValues.utf8(ник),
            '$a': TypedValues.optional(TypedValues.utf8(зверь)),
            '$k': TypedValues.utf8(код),
            '$h': я.хеш ? TypedValues.optional(TypedValues.utf8(я.хеш)) : пустоТекст(д),
          });
      }
    });
  }
  return ok({ pid: я.pid, kod: код, nick: ник, avatar: зверь,
              kartinka_v: наружу(было, я.pid).kartinka_v,
              avatarV: наружу(было, я.pid).avatarV,
              slito: слито || 0, obnovleno: !тоЖе });
}

/* ─── GET /druzya — мои друзья и заявки ──────────────────────────────────── */
/* Одно чтение по началу ключа отдаёт и друзей, и обе стороны незавершённых
   заявок: раскладываем по состоянию уже здесь. Карточки подтягиваем следом —
   имя человек мог сменить, и друг не должен видеть старое вечно. */
async function список(drv, ctx) {
  const { д } = ctx;
  const { TypedValues, ok, fail } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я.ok) return fail(401, 'unauthorized', { detail: я.pochemu });
  const мояКарточка = наружу(я.было, я.pid);

  const связи = [];
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $p AS Utf8;
      SELECT drug_pid, sostoyanie, created_at FROM druzhba WHERE pid = $p LIMIT 500;`,
      { '$p': TypedValues.utf8(я.pid) });
    for (const row of (r.resultSets[0]?.rows || []))
      связи.push({ pid: д.txt(row.items[0]), sostoyanie: д.txt(row.items[1]), ts: д.ts(row.items[2]) });
  });
  if (!связи.length) return ok({ ya: мояКарточка, druzya: [], vhodyashchie: [], poslannye: [] });

  /* Карточки — одним запросом на всех, а не по одной на каждого. */
  const карточки = new Map();
  await drv.tableClient.withSession(async (s) => {
    for (const ч of связи) {
      const r = await s.executeQuery(`DECLARE $p AS Utf8;
        SELECT pid, nick, avatar, kartinka_v, kartinka_bajt FROM druzya_ludi WHERE pid = $p;`,
        { '$p': TypedValues.utf8(ч.pid) });
      const row = r.resultSets[0]?.rows?.[0];
      if (row) карточки.set(д.txt(row.items[0]),
        { nick: д.txt(row.items[1]), avatar: д.txt(row.items[2]),
          kartinkaV: д.num(row.items[3]), kartinkaBajt: д.num(row.items[4]) });
    }
  });

  const одеть = (ч) => Object.assign(наружу(карточки.get(ч.pid), ч.pid), { ts: ч.ts });
  return ok({
    ya: мояКарточка,
    druzya:      связи.filter((ч) => ч.sostoyanie === ДРУЗЬЯ).map(одеть),
    vhodyashchie: связи.filter((ч) => ч.sostoyanie === ПРИШЛА).map(одеть),
    poslannye:   связи.filter((ч) => ч.sostoyanie === ПОСЛАЛ).map(одеть),
  });
}

/* ─── POST /druzya/pozvat — ввёл код, стали друзьями ─────────────────────── */
/* Заявок здесь больше нет. Владелец сказал прямо: «я же ввёл код, друг должен
   добавиться сразу». Код знает только тот, кому его дали, — значит согласие
   уже есть у обоих, и второй шаг «принять» был шагом ни о чём. */
async function позвать(drv, ctx) {
  const { body, д } = ctx;
  const { ok, fail, throttleHit } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я.ok) return fail(401, 'unauthorized', { detail: я.pochemu });
  /* СВОЯ КАРТОЧКА ОБЯЗАНА СУЩЕСТВОВАТЬ. Без этого хватало произвольного pid,
     под которым в базе ещё нет строки: привязывать нечего, ктоЭто пропускал,
     и каждый запрос шёл от нового «человека». Так и набивались 300 дружб с
     призраками, которых в druzya_ludi нет вовсе («Игрок ✦» в списке). */
  if (!я.было) return fail(404, 'no card', { detail: 'Сначала объявитесь: POST /druzya/ya.' });

  const код = кодРовный(body.kod);
  if (код.length !== ДЛИНА_КОДА) return fail(400, 'short code', { detail: 'Код — шесть знаков.' });

  /* СЧЁТЧИК — НИЖЕ ПОИСКА. Раньше он стоял выше, и десять опечаток подряд
     закрывали человеку добавление друзей, хотя он не отправил ни одной
     заявки. Ненайденный код считается своим, щедрым счётом: он тут не
     наказание, а стена для перебора. */
  const цель = await pidПоКоду(drv, д, код);
  if (!цель) {
    if (!(await частота(drv, ctx, я, 'druzya-kod', ОПЕЧАТОК_С_АДРЕСА, ОПЕЧАТОК_ЗА_ОКНО)))
      return fail(429, 'too many', { detail: 'Слишком много попыток подряд. Попробуйте позже.' });
    return fail(404, 'no such code', { detail: 'Такого кода нет. Проверьте буквы.' });
  }
  if (цель === я.pid) return fail(400, 'self', { detail: 'Это ваш собственный код.' });

  const сейчас = await состояниеСвязи(drv, д, я.pid, цель);
  if (сейчас === ДРУЗЬЯ) {
    const к = await карточкаПоPid(drv, д, цель);
    return ok({ uzhe: 'druzya', sostoyanie: ДРУЗЬЯ, pid: цель, drug: наружу(к, цель),
                detail: 'Вы уже друзья.' });
  }

  if (!(await частота(drv, ctx, я, 'druzya', ЗАЯВОК_С_АДРЕСА, ЗАЯВОК_ЗА_ОКНО)))
    return fail(429, 'too many', { detail: 'Слишком много добавлений подряд. Попробуйте позже.' });
  /* Ведро НА ЦЕЛЬ. Своё ведро нападающий обнуляет сменой адреса, а это —
     нет: оно висит на том, кого добавляют. Именно им и закрыт случай, когда
     чужой список забивают до предела в 300 и настоящий друг больше не
     помещается. */
  if (!(await throttleHit(drv, 'druzya-cel:' + цель, К_ОДНОМУ_ЗА_ОКНО)))
    return fail(429, 'too many', { detail: 'Этого человека сейчас добавляют слишком часто. Попробуйте позже.' });

  /* Предел числа друзей проверяем у ОБОИХ: дружба теперь заводится сразу, и
     чужой список она наполняет так же, как свой. Объявлен предел был ещё в
     первом выпуске, а не проверялся нигде. */
  if ((await сколько(drv, д, я.pid, ДРУЗЬЯ, ДРУЗЕЙ_ПРЕДЕЛ)) >= ДРУЗЕЙ_ПРЕДЕЛ)
    return fail(409, 'too many friends',
      { detail: 'У вас уже предельно много друзей — ' + ДРУЗЕЙ_ПРЕДЕЛ + '. Уберите кого-нибудь.' });
  if ((await сколько(drv, д, цель, ДРУЗЬЯ, ДРУЗЕЙ_ПРЕДЕЛ)) >= ДРУЗЕЙ_ПРЕДЕЛ)
    return fail(409, 'their limit',
      { detail: 'У этого человека уже предельно много друзей.' });

  /* Прежняя висящая заявка (в любую сторону) этим же и закрывается: обе
     половины переписываются в дружбу одним запросом. */
  await записатьПару(drv, д, я.pid, цель, ДРУЗЬЯ);
  const к = await карточкаПоPid(drv, д, цель);
  return ok({ podruzhilis: true, sostoyanie: ДРУЗЬЯ, pid: цель, drug: наружу(к, цель),
              bylo: сейчас || null });
}

/* ─── принять или отклонить ──────────────────────────────────────────────── */
/* Ручки остаются ради заявок, посланных прежними выпусками: они у людей уже
   висят в базе, и принять их надо по-прежнему. */
async function решить(drv, ctx, мой, чужой, принять) {
  const { д } = ctx;
  const { ok } = д;
  if (принять) await записатьПару(drv, д, мой, чужой, ДРУЗЬЯ);
  else await стеретьПару(drv, д, мой, чужой);
  const к = принять ? await карточкаПоPid(drv, д, чужой) : null;
  return ok(принять
    ? { sostoyanie: ДРУЗЬЯ, pid: чужой, drug: наружу(к, чужой) }
    : { sostoyanie: null, pid: чужой });
}

async function ответить(drv, ctx, принять) {
  const { body, д } = ctx;
  const { ok, fail } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я.ok) return fail(401, 'unauthorized', { detail: я.pochemu });
  const чужой = pidРовный(body.drugPid, д.clean);
  if (!чужой) return fail(400, 'no pid');

  /* Принять можно только то, что действительно пришло: иначе достаточно было
     бы знать чужой адрес, чтобы навязать себя в друзья. */
  if (принять) {
    const сост = await состояниеСвязи(drv, д, я.pid, чужой);
    if (сост === ДРУЗЬЯ) {
      const к = await карточкаПоPid(drv, д, чужой);
      return ok({ sostoyanie: ДРУЗЬЯ, pid: чужой, drug: наружу(к, чужой) });
    }
    if (сост !== ПРИШЛА) return fail(409, 'no request', { detail: 'Такой заявки нет.' });
    if ((await сколько(drv, д, я.pid, ДРУЗЬЯ, ДРУЗЕЙ_ПРЕДЕЛ)) >= ДРУЗЕЙ_ПРЕДЕЛ)
      return fail(409, 'too many friends',
        { detail: 'У вас уже предельно много друзей — ' + ДРУЗЕЙ_ПРЕДЕЛ + '. Уберите кого-нибудь.' });
  }
  return await решить(drv, ctx, я.pid, чужой, принять);
}

/* ─── картинка аватара ───────────────────────────────────────────────────── */
/* Подпись файла: FFD8FF в начале и FFD9 в хвосте. Разжимать картинку в
   облачной функции незачем — вес и подпись отсекают и чужой формат, и
   «картинку» из случайных байтов, а больше сервер тут решать не должен:
   квадрат 256 на 256 режет телефон. */
function этоJPEG(б) {
  if (!б || б.length < 125) return false;
  if (!(б[0] === 0xFF && б[1] === 0xD8 && б[2] === 0xFF)) return false;
  for (let i = б.length - 2; i >= б.length - 8 && i >= 0; i--)
    if (б[i] === 0xFF && б[i + 1] === 0xD9) return true;
  return false;
}

/* МЕТКА ВЕРСИИ: секунды эпохи и СЛУЧАЙНЫЙ ХВОСТ в миллион.
   Голые миллисекунды двум одновременным запросам достаются одни и те же
   (проверено: два POST вернули 1788685758370 и 1788685758370), а на
   совпавшей метке ручка отдачи ставит вечный кэш — тот, кто успел скачать
   первую картинку, видел бы её ГОД, и сменой аватара это уже не лечится.
   Хвост случайный, поэтому две разные картинки одну метку получить не могут;
   на нём же держится проверка записи ниже — по своей метке запрос узнаёт,
   его ли картинка легла.
   Метка обязана СТРОГО расти: Math.max с прежней это и хранит, а хвост
   прибавляется СВЕРХ неё, чтобы «было + 1» у двух запросов не совпало.
   Прежние метки были в миллисекундах (около 1,8e12), новые — около 1,8e15:
   рост не нарушен, и в Uint64 они лежат с большим запасом. */
const МЕТКА_ХВОСТ = 1000000;
function меткаВерсии(было) {
  const посекундно = Math.floor(Date.now() / 1000) * МЕТКА_ХВОСТ;
  return Math.max(посекундно, (было || 0) + 1) + Math.floor(Math.random() * МЕТКА_ХВОСТ);
}

/* условно = писать, только если версия и правда выросла. Снятие картинки
   версию не двигает вовсе, и условие там было бы вечно ложным. */
async function записатьКартинку(drv, д, pid, буфер, версия, условно) {
  const { TypedValues, Types } = д;
  await drv.tableClient.withSession(async (s) => {
    /* UPDATE, а не UPSERT: строка уже есть, а UPSERT потребовал бы все
       NOT NULL колонки карточки. */
    await s.executeQuery(`
      DECLARE $p AS Utf8; DECLARE $b AS Optional<String>; DECLARE $t AS Optional<Utf8>;
      DECLARE $v AS Optional<Uint64>; DECLARE $n AS Optional<Uint32>;
      UPDATE druzya_ludi SET kartinka = $b, kartinka_tip = $t, kartinka_v = $v,
             kartinka_bajt = $n, updated_at = CurrentUtcTimestamp()
      WHERE pid = $p${условно ? ' AND (kartinka_v IS NULL OR kartinka_v < $v)' : ''};`,
      {
        '$p': TypedValues.utf8(pid),
        '$b': буфер ? TypedValues.optional(значениеБайтов(д, буфер)) : TypedValues.optionalNull(Types.BYTES || Types.STRING),
        '$t': буфер ? TypedValues.optional(TypedValues.utf8(КАРТИНКА_ТИП)) : пустоТекст(д),
        '$v': версия ? TypedValues.optional(TypedValues.uint64(версия)) : TypedValues.optionalNull(Types.UINT64),
        '$n': буфер ? TypedValues.optional(TypedValues.uint32(буфер.length)) : TypedValues.optionalNull(Types.UINT32),
      });
  });
}

/* POST /druzya/avatar — положить свою картинку (или снять её: snyat, а ещё
   отдельным путём /druzya/avatar/ubrat).
   Право доказывается так же, как в остальных ручках: токен либо привязанный
   секрет устройства. Голого pid недостаточно — иначе картинку человеку менял
   бы любой его друг. */
async function картинкуПоложить(drv, ctx) {
  const { body, д } = ctx;
  const { ok, fail } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я.ok) return fail(401, 'unauthorized', { detail: я.pochemu });
  if (!я.было) return fail(404, 'no card', { detail: 'Сначала объявитесь: POST /druzya/ya.' });
  /* СЧЁТ — ДО РАЗБОРА. Прежде запись картинки не считалась вовсе: 50 подряд
     загрузок по 39 КБ проходили все пятьдесят. Считаем раньше, чем разбираем
     полсотни килобайт base64: разбирать, чтобы потом отказать, — работа
     впустую. */
  if (!(await частота(drv, ctx, я, 'druzya-avatar', КАРТИНОК_С_АДРЕСА, КАРТИНОК_ЗА_ОКНО)))
    return fail(429, 'too many', { detail: 'Слишком часто меняете картинку. Попробуйте позже.' });

  if (body.snyat === true || body.kartinka === null || body.dannye === null) return await снять(drv, д, я, ok);

  /* dannye — имя поля, на котором сошлись подставной шлюз стенда и экран;
     kartinka оставлено для прямых обращений к ручке. */
  const сыро = typeof body.dannye === 'string' ? body.dannye
    : typeof body.kartinka === 'string' ? body.kartinka : '';
  if (!сыро) return fail(400, 'no image', { detail: 'нужна картинка в base64 (поле dannye)' });
  if (сыро.length > КАРТИНКА_СТРОКА)
    return fail(413, 'too big', { detail: 'Картинка тяжелее ' + (КАРТИНКА_БАЙТ / 1024) + ' КБ.' });

  const чистая = сыро.replace(/^data:[^,]{0,80},/, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(чистая))
    return fail(400, 'bad base64', { detail: 'картинка должна быть в base64' });
  const буфер = Buffer.from(чистая, 'base64');
  if (!буфер.length) return fail(400, 'bad base64', { detail: 'картинка пустая' });
  if (буфер.length > КАРТИНКА_БАЙТ)
    return fail(413, 'too big', { detail: 'Картинка тяжелее ' + (КАРТИНКА_БАЙТ / 1024) + ' КБ. Обрежьте её на телефоне.' });
  if (!этоJPEG(буфер))
    return fail(415, 'not jpeg', { detail: 'Нужен JPEG. Другие форматы сервер не принимает.' });

  /* ЗАПИСЬ УСЛОВНАЯ И ПРОВЕРЕННАЯ. Два телефона одного человека читают
     «было» ДО того, как записал хоть один, — значит одной проверки перед
     записью мало. Пишем с условием «только если версия выросла», потом
     перечитываем строку: наша метка на месте — получилось; чужая — читаем
     заново и пробуем от неё. */
  let версия = 0, было = я.было, попыток = 0;
  for (;;) {
    версия = меткаВерсии(было && было.kartinkaV);
    await записатьКартинку(drv, д, я.pid, буфер, версия, true);
    const стало = await карточкаПоPid(drv, д, я.pid);
    if (стало && стало.kartinkaV === версия) break;
    if (++попыток >= 4)
      return fail(409, 'busy', { detail: 'Картинку меняют с другого устройства. Попробуйте ещё раз.' });
    было = стало;
  }
  return ok({ pid: я.pid, kartinka_v: версия, avatarV: версия, v: версия,
              bajt: буфер.length, tip: КАРТИНКА_ТИП });
}

/* Снять картинку — вернуться к знаку. Версию ОСТАВЛЯЕМ в строке: она обязана
   расти и дальше (на ней висит вечный кэш), а признаком «картинка есть»
   служит вес. Наружу метка при этом пустая. */
async function снять(drv, д, я, ok) {
  if (!я.было.kartinkaBajt) return ok({ pid: я.pid, kartinka_v: null, avatarV: 0, v: 0, snyato: false });
  await записатьКартинку(drv, д, я.pid, null, я.было.kartinkaV || null);
  return ok({ pid: я.pid, kartinka_v: null, avatarV: 0, v: 0, snyato: true });
}

/* POST /druzya/avatar/ubrat — то же снятие отдельным путём: так его зовёт
   подставной шлюз стенда и экран приложения. */
async function картинкуСнять(drv, ctx) {
  const { д } = ctx;
  const { ok, fail } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я.ok) return fail(401, 'unauthorized', { detail: я.pochemu });
  if (!я.было) return fail(404, 'no card', { detail: 'Сначала объявитесь: POST /druzya/ya.' });
  /* Снятие — такая же запись в базу, как и загрузка, и в тот же счёт. */
  if (!(await частота(drv, ctx, я, 'druzya-avatar', КАРТИНОК_С_АДРЕСА, КАРТИНОК_ЗА_ОКНО)))
    return fail(429, 'too many', { detail: 'Слишком часто меняете картинку. Попробуйте позже.' });
  return await снять(drv, д, я, ok);
}

/* GET /druzya/avatar?pid=…&v=… — отдать картинку.
   Чужую картинку отдаём любому, кто знает pid: это то же самое, что имя и
   знак в списке друзей, — их GET /druzya и так отдаёт. */
async function картинкуОтдать(drv, ctx) {
  const { query, д } = ctx;
  const { TypedValues, fail } = д;
  const pid = pidРовный(query && query.pid, д.clean);
  if (!pid) return fail(400, 'no pid', { detail: 'нужен pid' });
  /* Мягкий счёт на отдачу: сорок килобайт наружу на каждый запрос любому,
     кто знает pid, — и раньше их никто не считал. Ключ — адрес; адреса нет
     (в бою его ставит шлюз) — тогда хотя бы тот, чью картинку просят. */
  const чей = адресОбращения(ctx);
  if (typeof д.throttleHit === 'function'
      && !(await д.throttleHit(drv, 'druzya-avatar-dat:' + (чей || 'p' + pid), ОТДАЧ_ЗА_ОКНО)))
    return fail(429, 'too many', { detail: 'Слишком много картинок подряд. Попробуйте позже.' });

  let буфер = null, тип = null, версия = null;
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $p AS Utf8;
      SELECT kartinka, kartinka_tip, kartinka_v FROM druzya_ludi WHERE pid = $p;`,
      { '$p': TypedValues.utf8(pid) });
    const row = r.resultSets[0]?.rows?.[0];
    if (!row) return;
    буфер = байты(row.items[0]);
    тип = д.txt(row.items[1]);
    версия = д.num(row.items[2]);
  });
  if (!буфер || !буфер.length) return fail(404, 'no image', { detail: 'у этого человека нет картинки' });

  /* Вечный кэш — ТОЛЬКО когда метка в адресе совпала с той, что в базе. Иначе
     старый адрес навсегда запомнил бы новую картинку, и следующая смена
     аватара не доехала бы ни до кого. */
  const просят = д.clean(query.v, 32);
  const совпало = !!просят && String(версия || '') === String(просят);
  const заголовки = Object.assign({}, д.ok({}).headers, {
    'Content-Type': тип || КАРТИНКА_ТИП,
    'Cache-Control': совпало ? 'public, max-age=' + ГОД_СЕКУНД + ', immutable' : 'public, max-age=60',
    'X-Kartinka-V': String(версия || ''),
  });
  /* На шлюзе двоичный ответ — это base64 с isBase64Encoded. */
  return { statusCode: 200, headers: заголовки, body: буфер.toString('base64'), isBase64Encoded: true };
}

/* ─── POST /druzya/perenos — забрать дружбу из прежнего дерева ───────────── */
/* У людей, заведённых до переезда, друзья лежат в дереве Firebase, и в
   таблицах их нет. Без переноса обновление молча оставило бы человека с
   пустым списком — это потеря данных, а не переезд.

   ПОЧЕМУ НЕ ЗАПИСЫВАЕМ СРАЗУ ДРУЗЬЯМИ. Приложение здесь ЗАЯВЛЯЕТ, с кем оно
   дружило, а проверить это по дереву сервер не может. Поверить на слово —
   значит дать любому вписать себя в друзья к любому, чей адрес он знает.
   Кода второй стороны у него при этом нет — а код и есть согласие. Поэтому
   каждая пара заводится как ЗАЯВКА. Дальше работает то же правило, что и у
   встречных заявок: когда вторая сторона тоже обновится и пришлёт свой
   список, обе половины сойдутся и станут дружбой сами, без единого касания.
   Если вторая сторона не обновится — человек увидит «вы позвали, ждём
   ответа», и это честно: связи в таблицах действительно ещё нет. */
const ПЕРЕНОС_ПРЕДЕЛ = 100;
async function перенос(drv, ctx) {
  const { body, д } = ctx;
  const { ok, fail, throttleHit } = д;
  const я = await ктоЭто(drv, ctx);
  if (!я.ok) return fail(401, 'unauthorized', { detail: я.pochemu });
  /* Та же дыра, что и в позвать(): с новым pid каждый раз перенос навязывал
     человеку сорок входящих заявок, зная о нём только адрес. Своя карточка
     обязана быть, а счёт ключуется на адресе, не на присланном pid. */
  if (!я.было) return fail(404, 'no card', { detail: 'Сначала объявитесь: POST /druzya/ya.' });
  if (!(await частота(drv, ctx, я, 'perenos', ПЕРЕНОСОВ_С_АДРЕСА, ПЕРЕНОСОВ_ЗА_ОКНО)))
    return fail(429, 'too many');

  const список = Array.isArray(body.pids) ? body.pids.slice(0, ПЕРЕНОС_ПРЕДЕЛ) : [];
  let завели = 0, сошлось = 0, отказано = 0;
  let моих = await сколько(drv, д, я.pid, ДРУЗЬЯ, ДРУЗЕЙ_ПРЕДЕЛ);
  for (const сырой of список) {
    const другой = pidРовный(сырой, д.clean);
    if (!другой || другой === я.pid) continue;

    const моё = await состояниеСвязи(drv, д, я.pid, другой);
    if (моё === ДРУЗЬЯ) continue;
    if (моё === ПОСЛАЛ) continue;
    if (моё === ПРИШЛА) {
      if (моих >= ДРУЗЕЙ_ПРЕДЕЛ) { отказано++; continue; }
      await записатьПару(drv, д, я.pid, другой, ДРУЗЬЯ);
      моих++; сошлось++; continue;
    }

    /* Предел входящих — у ТОЙ стороны: заявки набивают чужой экран, а не
       свой, и раньше их число не считал никто. */
    if (моих >= ДРУЗЕЙ_ПРЕДЕЛ) { отказано++; continue; }
    if ((await сколько(drv, д, другой, ПРИШЛА, ВХОДЯЩИХ_ПРЕДЕЛ)) >= ВХОДЯЩИХ_ПРЕДЕЛ) { отказано++; continue; }
    await записатьПару(drv, д, я.pid, другой, ПОСЛАЛ);
    завели++;
  }
  return ok({ zaveli: завели, soshlos: сошлось, otkazano: отказано, vsego: список.length });
}

/* ─── маршруты ───────────────────────────────────────────────────────────── */
exports.route = async function route(drv, ctx) {
  const { method, path, д } = ctx;
  const { fail } = д;
  /* Картинка — ПЕРЕД общим /druzya: иначе GET картинки попал бы в список. */
  if (/\/druzya\/avatar(\/|\?|$)/.test(path) && method === 'GET') return await картинкуОтдать(drv, ctx);
  if (/\/druzya\/avatar\/ubrat(\/|\?|$)/.test(path) && method === 'POST') return await картинкуСнять(drv, ctx);
  if (/\/druzya\/avatar(\/|\?|$)/.test(path) && method === 'POST') return await картинкуПоложить(drv, ctx);
  if (/\/druzya\/ya(\/|\?|$)/.test(path) && method === 'POST') return await объявиться(drv, ctx);
  if (/\/druzya\/pozvat(\/|\?|$)/.test(path) && method === 'POST') return await позвать(drv, ctx);
  if (/\/druzya\/prinyat(\/|\?|$)/.test(path) && method === 'POST') return await ответить(drv, ctx, true);
  if (/\/druzya\/zabyt(\/|\?|$)/.test(path) && method === 'POST') return await ответить(drv, ctx, false);
  if (/\/druzya\/otvyazat(\/|\?|$)/.test(path) && method === 'POST') return await отвязать(drv, ctx);
  if (/\/druzya\/perenos(\/|\?|$)/.test(path) && method === 'POST') return await перенос(drv, ctx);
  if (/\/druzya(\/|\?|$)/.test(path) && method === 'GET') return await список(drv, ctx);
  return fail(404, 'not found', { path });
};

/* ─── удаление аккаунта: убрать и карточку дружбы ────────────────────────
   POST /account/delete чистил users и device_links и не трогал ни
   druzya_ludi, ни druzhba. До миграции 012 там оставались имя и знак; теперь
   там остаётся ФОТОГРАФИЯ ЛИЦА, и её по-прежнему отдавал GET /druzya/avatar
   любому, кто знает pid, — то есть каждому, кто когда-либо был у человека в
   друзьях. Оператор персональных данных — живое юридическое лицо с
   опубликованной политикой, и «удалите мои данные» обязано доходить и сюда.

   Убираем строку целиком, а не обезличиваем: в ней и картинка, и имя, и код
   дружбы, а связи всё равно надо стирать поимённо — обе половины каждой. */
exports.убратьПриУдалении = async function убратьПриУдалении(drv, д, userId) {
  const { TypedValues } = д;
  const pid = await pidПоАккаунту(drv, д, String(userId || ''));
  if (!pid) return { pid: null, svyazej: 0 };

  const связи = [];
  await drv.tableClient.withSession(async (s) => {
    const r = await s.executeQuery(`DECLARE $p AS Utf8;
      SELECT drug_pid, sostoyanie FROM druzhba WHERE pid = $p LIMIT 500;`,
      { '$p': TypedValues.utf8(pid) });
    for (const row of (r.resultSets[0]?.rows || [])) связи.push(д.txt(row.items[0]));
  });
  for (const ч of связи) await стеретьПару(drv, д, pid, ч);

  await drv.tableClient.withSession(async (s) => {
    await s.executeQuery(`DECLARE $p AS Utf8;
      DELETE FROM druzya_ludi WHERE pid = $p;`, { '$p': TypedValues.utf8(pid) });
  });
  return { pid, svyazej: связи.length };
};

exports.ПРЕДЕЛ = ДРУЗЕЙ_ПРЕДЕЛ;
exports.ВХОДЯЩИХ_ПРЕДЕЛ = ВХОДЯЩИХ_ПРЕДЕЛ;
exports.КАРТИНКА_БАЙТ = КАРТИНКА_БАЙТ;
exports.этоJPEG = этоJPEG;
