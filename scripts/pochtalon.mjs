/* ═══════════════════════════════════════════════════════════════════════════
   ПОЧТАЛЬОН ЛЕНТЫ — качает страницы t.me/s и превью-картинки и кладёт их
   сырьём в бакет yasnalab.ru, откуда сборщик ленты берёт их, когда сам до
   площадки не дотянулся.

   ЗАЧЕМ. t.me из облака Яндекса отвечает через раз: в бою 05.09.2026 —
   две удачи из одиннадцати заходов, у всех четырёх каналов udacha_at пустой,
   лента стоит. С обычной машины те же страницы приходят за 0,3–0,8 с. Режут
   не нас, а путь, поэтому ни VPC, ни NAT, ни статический адрес не помогают.
   Значит, страницу должен привезти тот, у кого дорога есть: задача GitHub
   Actions (.github/workflows/lenta-pochtalon.yml) на раннере вне России.
   Репозиторий публичный — минуты бесплатны, ничего просить у руководителей
   каналов не нужно.

   ЧТО КЛАДЁТСЯ (префикс на канал — lenta/vhod/<канал>/):
     stranica.html         страница https://t.me/s/<канал> как есть, без правок
     kartinki/<sha1>.jpg   превью; sha1 — от АДРЕСА картинки у источника
     meta.json             { versiya, kanal, snyato, zapisej, blokov,
                             bajt_stranicy, kartinok, kartinki:[{sha1,bajt}] }

   ПОЧЕМУ ИМЕНА СХОДЯТСЯ САМИ. Адрес картинки почтальон берёт тем же
   разборщиком (server/lenta-razbor.js), что и сборщик, а имя файла считает
   той же функцией (server/lenta-sbor.js: ключиВхода/сырьёSha1). Никакого
   отдельного договора между ними нет — есть один код на обе стороны.

   ПОРЯДОК ЗАПИСИ ВАЖЕН: сначала картинки, потом stranica.html и только в
   самом конце meta.json. Сборщик смотрит на meta.json (свежесть и канал), и
   если бы отметка «снято» легла раньше страницы, он в эту секунду прочитал
   бы вчерашнюю страницу как сегодняшнюю.

   ЧЕГО ПОЧТАЛЬОН НЕ ДЕЛАЕТ. Не разбирает ленту (сборщик перечитывает
   разметку сам и не верит сырью на слово), не ходит в базу, не знает о YDB,
   не подделывает браузер (User-Agent честный, robots.txt площадки
   соблюдается), не листает назад по ?before= (сборщик доберёт пропуски сам,
   когда его дорога откроется).

   ЗАПУСК:
     node scripts/pochtalon.mjs            — качает и кладёт в бакет
     node scripts/pochtalon.mjs --proba    — качает, НО в бакет не кладёт,
                                             печатает, что положил бы
     node scripts/pochtalon.mjs --kanal=astronevod   — один канал
   ОКРУЖЕНИЕ (в сухом режиме не нужно ничего):
     YC_STATIC_KEY_ID + YC_STATIC_KEY — статический ключ доступа СВОЕГО
       сервисного аккаунта почтальона; он подписывает запросы сам (AWS SigV4)
       и наружу за токеном не ходит. Предпочтительный путь: из-за границы
       управляющий контур облака недоступен (см. ниже), а хранилище — доступно.
     YC_POCHTALON_SA_KEY — json авторизованного ключа того же аккаунта.
       Запасной путь, идёт через IAM.
     LENTA_BUCKET — имя бакета, по умолчанию yasnalab.ru.

   ЧЕЙ КЛЮЧ КЛАДУТ В СЕКРЕТЫ — ЭТО ГЛАВНЫЙ ВОПРОС ЭТОГО ФАЙЛА. Только
   отдельного аккаунта yasna-pochtalon, у которого одно право: storage.uploader
   на бакет, и политика бакета разрешает ему PUT только по префиксу
   lenta/vhod/*. Ключ деплоя (YC_SA_KEY, аккаунт yasna-ci) сюда брать НЕЛЬЗЯ:
   у него serverless.functions.admin и api-gateway.editor, а бакет yasnalab.ru
   — это сам живой сайт, и статический ключ дал бы право переписать index.html
   и docs/core/*.js платформы. Ключ лежит в секретах ПУБЛИЧНОГО репозитория и
   ездит раз в час — прав у него должно быть ровно на то, что почтальон
   делает, а не на всё, что умеет деплой.

   ЗАВИСИМОСТЕЙ НЕТ: Node 20+ (глобальный fetch), node:crypto для подписи
   JWT (Yandex IAM требует PS256) и два модуля сервера.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), '..');
const Р = require(join(КОРЕНЬ, 'server', 'lenta-razbor.js'));
const С = require(join(КОРЕНЬ, 'server', 'lenta-sbor.js'));

/* Список каналов. ДОЛЖЕН СОВПАДАТЬ с включёнными строками lenta_istochniki
   (istochnik='telegram'): почтальон возит сырьё только для тех каналов, за
   которыми ходит сборщик. Лишний канал здесь — зря потраченные минуты и
   объекты в бакете; недостающий — канал, который в облаке так и не
   наполнится. Пока источников четыре, список держится здесь: у почтальона
   нет и не должно быть доступа к базе. */
const КАНАЛЫ = ['russkaya_yasna', 'astronevod', 'naturnie_uroki', 'neglinka78'];

const БАКЕТ = process.env.LENTA_BUCKET || 'yasnalab.ru';
const ХРАНИЛИЩЕ = 'https://storage.yandexcloud.net/';
const IAM = 'https://iam.api.cloud.yandex.net/iam/v1/tokens';

/* Честный User-Agent. Имя робота то же, что у сборщика (до косой черты —
   'YasnaLenta'), поэтому правила robots.txt площадки применяются к нам
   одинаково, кто бы ни ехал; хвост '(pochtalon)' нужен, чтобы в чужих логах
   было видно, что это подвоз, а не сама лента. */
const АГЕНТ = Р.АГЕНТ + ' (pochtalon)';
const СРОК_СТРАНИЦЫ_МС = 30000;
const СРОК_КАРТИНКИ_МС = 20000;
const СРОК_БАКЕТА_МС = 30000;
const ПОПЫТОК_СТРАНИЦЫ = 3;         /* раннер за границей отвечает уверенно, но сеть есть сеть */
const ПАУЗА_ПОПЫТКИ_МС = 2000;
const ПАУЗА_МЕЖДУ_КАНАЛАМИ_МС = 800;
const КАРТИНОК_НА_КАНАЛ = 20;
const КАРТИНКА_МАКС_БАЙТ = 600 * 1024;
const СТРАНИЦА_МАКС_БАЙТ = 8 * 1024 * 1024;
const ВЕРСИЯ_СЫРЬЯ = 1;
/* Сырьё живёт до следующей поездки — кэшировать его нельзя ни секунды,
   иначе сборщик получит вчерашнюю страницу под сегодняшней отметкой. */
const БЕЗ_КЭША = 'no-cache, max-age=0';

/* ─── доводы командной строки ────────────────────────────────────────────── */
function доводы(argv) {
  const д = { проба: false, каналы: КАНАЛЫ.slice() };
  for (const а of argv) {
    if (а === '--proba' || а === '--dry-run') д.проба = true;
    else if (а.startsWith('--kanal=')) д.каналы = [а.slice(8)];
    else if (а === '--pomoshch' || а === '--help' || а === '-h') д.помощь = true;
    else { д.ошибка = 'непонятный довод: ' + а; }
  }
  for (const к of д.каналы) if (!/^[A-Za-z0-9_]{3,64}$/.test(к)) д.ошибка = 'плохое имя канала: ' + к;
  return д;
}

/* ─── как почтальон доказывает бакету, что он свой ───────────────────────── */
/* ДВЕ ДОРОГИ, И ЭТО НЕ ПРИХОТЬ. Object Storage принимает и «Authorization:
   Bearer <IAM-токен>» (так делает сама функция сборщика), и обычную подпись
   AWS SigV4 статическим ключом доступа. Разница в том, ГДЕ их берут:

     IAM-токен  — обменом JWT в iam.api.cloud.yandex.net (управляющий контур);
     SigV4      — считается на месте, наружу ходить не надо вовсе.

   Проверено 06.09.2026 с зарубежного адреса: storage.yandexcloud.net отвечает
   за 0,4 с, а iam.api.cloud.yandex.net, api.cloud.yandex.net и
   serverless-functions.api.cloud.yandex.net не отдают даже TCP-соединения.
   Управляющий контур из-за границы недоступен, хранилище — доступно. Раннеры
   GitHub стоят там же, за границей, поэтому дорога через IAM у почтальона
   может не открыться ни разу.

   Отсюда порядок: если заведён статический ключ (YC_STATIC_KEY_ID +
   YC_STATIC_KEY) — подписываем сами и наружу не ходим; иначе пробуем IAM по
   ключу аккаунта почтальона (YC_POCHTALON_SA_KEY — СВОЙ ключ, не деплойный).
   Если IAM не ответил, почтальон говорит человеку ровно то, что надо сделать,
   а не «fetch failed». */

/* Статический ключ доступа СВОЕГО аккаунта почтальона:
     yc iam service-account create --name yasna-pochtalon
     yc storage bucket update yasnalab.ru --acl-grants ...   (или политика
       бакета: Allow s3:PutObject на arn ...:yasnalab.ru/lenta/vhod/* этому
       аккаунту — и больше ничего)
     yc iam access-key create --service-account-id <id yasna-pochtalon>
   даёт key_id и secret; их кладут в секреты репозитория YC_STATIC_KEY_ID и
   YC_STATIC_KEY. Ни то ни другое в лог не попадает.
   Ключ аккаунта деплоя (yasna-ci, aje30jts5erm5c4r1cdh) здесь НЕ годится: см.
   шапку — им можно переписать сам сайт. */
function статическийКлюч() {
  const ид = (process.env.YC_STATIC_KEY_ID || '').trim();
  const секрет = (process.env.YC_STATIC_KEY || '').trim();
  return ид && секрет ? { ид, секрет } : null;
}

/* Подпись AWS Signature V4 для Object Storage. Считается целиком на месте:
   цепочка HMAC-SHA256 от секрета, ничего наружу не спрашивается. Подписываем
   минимум заголовков (host, x-amz-content-sha256, x-amz-date) — остальные
   (Content-Type, Cache-Control) идут неподписанными, это допустимо. */
const РЕГИОН = 'ru-central1';
function sha256hex(б) { return crypto.createHash('sha256').update(б).digest('hex'); }
function hmac(ключ, данные) { return crypto.createHmac('sha256', ключ).update(данные).digest(); }
function подписьSigV4(ключ, метод, хост, путь, тело, когда) {
  const дата = когда.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');   /* 20260906T101500Z */
  const день = дата.slice(0, 8);
  const хешТела = sha256hex(тело || Buffer.alloc(0));
  const подписанные = 'host;x-amz-content-sha256;x-amz-date';
  const канонический = [метод, путь, '',
    'host:' + хост, 'x-amz-content-sha256:' + хешТела, 'x-amz-date:' + дата, '',
    подписанные, хешТела].join('\n');
  const область = день + '/' + РЕГИОН + '/s3/aws4_request';
  const кПодписи = ['AWS4-HMAC-SHA256', дата, область, sha256hex(Buffer.from(канонический, 'utf8'))].join('\n');
  const к = hmac(hmac(hmac(hmac('AWS4' + ключ.секрет, день), РЕГИОН), 's3'), 'aws4_request');
  const подпись = crypto.createHmac('sha256', к).update(кПодписи).digest('hex');
  return {
    Authorization: 'AWS4-HMAC-SHA256 Credential=' + ключ.ид + '/' + область
      + ', SignedHeaders=' + подписанные + ', Signature=' + подпись,
    'x-amz-date': дата,
    'x-amz-content-sha256': хешТела,
  };
}

/* IAM-токен по ключу сервисного аккаунта. Подпись JWT именно PS256
   (RSASSA-PSS), не RS256: RS256 площадка не принимает. Всё есть в
   node:crypto, CLI ради одного токена тащить незачем. */
function jwtДляIAM(ключ) {
  const сейчас = Math.floor(Date.now() / 1000);
  const b64 = (б) => Buffer.from(б).toString('base64url');
  const заголовок = b64(JSON.stringify({ typ: 'JWT', alg: 'PS256', kid: ключ.id }));
  const тело = b64(JSON.stringify({ aud: IAM, iss: ключ.service_account_id, iat: сейчас, exp: сейчас + 3600 }));
  /* В файле ключа перед PEM стоит строка-предупреждение «PLEASE DO NOT
     REMOVE THIS LINE!» — до неё createPrivateKey не доберётся, режем. */
  const pem = String(ключ.private_key || '');
  const срез = pem.indexOf('-----BEGIN');
  if (срез < 0) throw new Error('в ключе нет PEM (private_key)');
  const подпись = crypto.sign('sha256', Buffer.from(заголовок + '.' + тело), {
    key: crypto.createPrivateKey(pem.slice(срез)),
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });
  return заголовок + '.' + тело + '.' + подпись.toString('base64url');
}

const СОВЕТ_ПРО_КЛЮЧ = 'Заведи статический ключ доступа ОТДЕЛЬНОГО аккаунта почтальона'
  + ' (yc iam service-account create --name yasna-pochtalon, дай ему storage.uploader на бакет'
  + ' yasnalab.ru с политикой «PUT только под lenta/vhod/*», затем yc iam access-key create'
  + ' --service-account-id <id yasna-pochtalon>) и положи его в секреты репозитория как'
  + ' YC_STATIC_KEY_ID и YC_STATIC_KEY: тогда почтальон подписывает запросы сам, и управляющий'
  + ' контур облака ему не нужен вовсе. Ключ деплоя (yasna-ci) сюда не берут: им можно переписать'
  + ' сам сайт, который лежит в том же бакете.';
/* Отказ бакета словами. 403 у почтальона значит одно из двух: у аккаунта нет
   роли на бакет или политика не пускает под этот префикс. В логе Actions видно
   только строку — значит, строка и должна отвечать на вопрос «что делать». */
const СОВЕТ_ПРО_ПРАВО = 'Бакет отказал (403). Проверь, что у аккаунта, чей ключ лежит в секретах,'
  + ' есть storage.uploader на бакет ' + БАКЕТ + ' и что политика бакета разрешает ему PUT под'
  + ' префиксом ' + С.КОНСТАНТЫ.ПРЕФИКС_ВХОДА + '. Права аккаунта видно так:'
  + ' yc resource-manager folder list-access-bindings --id <folder>.';

async function iamТокен() {
  const сырой = process.env.YC_POCHTALON_SA_KEY;
  if (!сырой || !сырой.trim()) throw new Error('нет ни YC_STATIC_KEY_ID/YC_STATIC_KEY, ни YC_POCHTALON_SA_KEY');
  let ключ;
  try { ключ = JSON.parse(сырой); } catch (e) { throw new Error('YC_POCHTALON_SA_KEY не JSON'); }
  if (!ключ.id || !ключ.service_account_id || !ключ.private_key) throw new Error('в YC_POCHTALON_SA_KEY нет id / service_account_id / private_key');
  let о;
  try {
    о = await fetch(IAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jwt: jwtДляIAM(ключ) }),
      signal: AbortSignal.timeout(СРОК_БАКЕТА_МС),
    });
  } catch (e) {
    throw new Error('управляющий контур облака (' + new URL(IAM).host + ') не отвечает с этой машины'
      + ' — обычное дело для адреса вне России, а раннер GitHub стоит именно там. ' + СОВЕТ_ПРО_КЛЮЧ);
  }
  /* Тело отказа не печатаем целиком: там бывает эхо запроса. Ни ключ, ни
     токен в лог не попадают никогда. */
  if (о.status !== 200) throw new Error('IAM отказал: HTTP ' + о.status);
  const д = await о.json().catch(() => null);
  if (!д || !д.iamToken) throw new Error('IAM не вернул токен');
  return д.iamToken;
}

/* ─── бакет ──────────────────────────────────────────────────────────────── */
async function открытьБакет(проба) {
  if (проба) return Object.assign(бакет(null), { как: 'сухой прогон (в бакет не пишем)' });
  const стат = статическийКлюч();
  if (стат) return Object.assign(бакет(стат), { как: 'статический ключ, подпись AWS SigV4 (управляющий контур не нужен)' });
  const токен = await iamТокен();
  return Object.assign(бакет(токен), { как: 'IAM-токен по ключу сервисного аккаунта' });
}

function бакет(доступ) {
  const основа = ХРАНИЛИЩЕ + БАКЕТ + '/';
  const хост = new URL(ХРАНИЛИЩЕ).host;
  const заголовкиДоступа = (метод, ключ, тело) => {
    if (!доступ) return {};
    if (typeof доступ === 'string') return { Authorization: 'Bearer ' + доступ };
    return подписьSigV4(доступ, метод, хост, '/' + БАКЕТ + '/' + ключ, тело, new Date());
  };
  return {
    адрес: (ключ) => основа + ключ,
    /* Объект уже лежит? Картинка по адресу Телеграма неизменна (в адресе —
       идентификатор файла), поэтому лежащее не перекачиваем: каждый час
       заново возить одни и те же двадцать превью незачем. Чтение бакета
       анонимное (он открыт на чтение), доказывать что-либо для HEAD не надо. */
    async есть(ключ) {
      try {
        const о = await fetch(основа + ключ, { method: 'HEAD', signal: AbortSignal.timeout(СРОК_БАКЕТА_МС) });
        return о.status === 200;
      } catch (e) { return false; }
    },
    async положить(ключ, тело, тип) {
      const о = await fetch(основа + ключ, {
        method: 'PUT',
        headers: Object.assign(заголовкиДоступа('PUT', ключ, тело), {
          'Content-Type': тип,
          'Cache-Control': БЕЗ_КЭША,
          'Content-Length': String(тело.length),
        }),
        body: тело,
        signal: AbortSignal.timeout(СРОК_БАКЕТА_МС),
      });
      if (о.status === 403) throw new Error('бакет PUT ' + ключ + ': HTTP 403. ' + СОВЕТ_ПРО_ПРАВО);
      if (о.status !== 200) throw new Error('бакет PUT ' + ключ + ': HTTP ' + о.status);
    },
  };
}

/* ─── сеть ───────────────────────────────────────────────────────────────── */
async function взять(url, п = {}) {
  const о = await fetch(url, {
    headers: {
      'user-agent': АГЕНТ,
      'accept-language': 'ru,en;q=0.8',
      accept: п.байты ? 'image/jpeg,image/*;q=0.8,*/*;q=0.5' : 'text/html,*/*;q=0.5',
    },
    redirect: 'manual',          /* закрытое превью отвечает 302 — это ответ, а не страница */
    signal: AbortSignal.timeout(п.срок || СРОК_СТРАНИЦЫ_МС),
  });
  const длина = Number(о.headers.get('content-length') || 0);
  if (п.максБайт && длина > п.максБайт) return { статус: о.status, велик: длина };
  if (о.status !== 200) return { статус: о.status, куда: о.headers.get('location') || null };
  const тело = Buffer.from(await о.arrayBuffer());
  if (п.максБайт && тело.length > п.максБайт) return { статус: о.status, велик: тело.length };
  return { статус: 200, тело };
}

const подождать = (мс) => new Promise((р) => setTimeout(р, мс));

async function страницаКанала(канал) {
  const адрес = Р.РАЗБОРЩИКИ.telegram.адрес({ kanal: канал });
  let последняя = null;
  for (let п = 1; п <= ПОПЫТОК_СТРАНИЦЫ; п++) {
    try {
      const о = await взять(адрес, { срок: СРОК_СТРАНИЦЫ_МС, байты: true, максБайт: СТРАНИЦА_МАКС_БАЙТ });
      if (о.велик) return { беда: 'страница больше предела: ' + о.велик + ' байт' };
      if (о.статус === 200) return { тело: о.тело, адрес };
      /* Ответ со смыслом (302 у закрытого превью, 404 у переименованного
         канала) повторять незачем — он не изменится через две секунды. */
      return { беда: 'ответ ' + о.статус + (о.куда ? ' → ' + о.куда : '') };
    } catch (e) {
      последняя = e;
      if (п < ПОПЫТОК_СТРАНИЦЫ) await подождать(ПАУЗА_ПОПЫТКИ_МС * п);
    }
  }
  return { беда: 'сеть: ' + String(последняя && последняя.message || последняя).slice(0, 160) };
}

/* ─── один канал ─────────────────────────────────────────────────────────── */
async function обойти(канал, б, роботы, проба) {
  const шаг = { канал, картинок: 0, ужеБыло: 0, пропущено: 0, байт: 0 };
  if (!Р.роботРазрешает(роботы, Р.РАЗБОРЩИКИ.telegram.путьРобота({ kanal: канал }), АГЕНТ)) {
    шаг.беда = 'robots.txt площадки запрещает /s/' + канал;
    return шаг;
  }
  const стр = await страницаКанала(канал);
  if (стр.беда) { шаг.беда = стр.беда; return шаг; }
  const html = стр.тело.toString('utf8');
  шаг.байт = стр.тело.length;

  /* Похоже ли это вообще на превью канала. По дороге из-за границы бывает
     подсунута заглушка провайдера или страница «включите JavaScript» — везти
     такое в бакет нельзя: сборщик, не дотянувшись сам, разобрал бы её как
     пустой канал. Своя разметка узнаётся по тем же признакам, что у
     разборщика. */
  if (!/tgme_channel_info|tgme_widget_message_wrap|data-post="/.test(html)) {
    шаг.беда = 'это не страница превью (' + шаг.байт + ' байт)';
    return шаг;
  }

  /* Разбор — только чтобы узнать адреса превью и посчитать записи для
     meta.json. Решения по ленте принимает сборщик, он же перечитает разметку
     заново; здесь ошибка разбора поездку не отменяет. */
  let разбор = { записи: [], здоровье: {} };
  try {
    разбор = Р.РАЗБОРЩИКИ.telegram.разобрать(html, { kanal: канал }, { своиКаналы: КАНАЛЫ, сейчасМс: Date.now() });
  } catch (e) { шаг.разборНеВышел = String(e && e.message || e).slice(0, 120); }

  const адреса = [];
  for (const з of разбор.записи) {
    if (!з.kartinka_istochnika || адреса.includes(з.kartinka_istochnika)) continue;
    адреса.push(з.kartinka_istochnika);
    if (адреса.length >= КАРТИНОК_НА_КАНАЛ) break;
  }

  const к = С.ключиВхода(канал);
  const картинки = [];
  for (const адрес of адреса) {
    const ключ = к.картинка(адрес);
    const sha1 = ключ.slice(ключ.lastIndexOf('/') + 1, -4);
    if (!проба && await б.есть(ключ)) { шаг.ужеБыло++; картинки.push({ sha1, bajt: null }); continue; }
    /* Одна повторная попытка на обрыв: в сухих прогонах 06.09.2026 cdn
       телеграма изредка рвал соединение на одном-двух превью из пятнадцати,
       а через минуту отдавал их же. Не довезённая картинка попытку у записи
       не тратит (сборщик считает «нет в сырье» отдельно), но и висеть без
       картинки лишний час ленте незачем. */
    let о = null;
    for (let п = 1; п <= 2 && !о; п++) {
      try { о = await взять(адрес, { срок: СРОК_КАРТИНКИ_МС, байты: true, максБайт: КАРТИНКА_МАКС_БАЙТ }); }
      catch (e) { if (п === 2) break; await подождать(ПАУЗА_ПОПЫТКИ_МС); }
    }
    if (!о) { шаг.пропущено++; continue; }
    if (о.велик || о.статус !== 200 || !о.тело || !о.тело.length) { шаг.пропущено++; continue; }
    /* Не-JPEG сборщик всё равно отвергнет (он проверяет сигнатуру перед
       пережатием) — незачем возить и хранить. */
    if (!С.этоJPEG(о.тело)) { шаг.пропущено++; continue; }
    if (!проба) await б.положить(ключ, о.тело, 'image/jpeg');
    картинки.push({ sha1, bajt: о.тело.length });
    шаг.картинок++;
    шаг.байт += о.тело.length;
  }

  const meta = {
    versiya: ВЕРСИЯ_СЫРЬЯ,
    kanal: канал,
    snyato: new Date().toISOString().slice(0, 19) + 'Z',
    zapisej: разбор.записи.length,
    blokov: (разбор.здоровье && разбор.здоровье.блоков) || 0,
    bajt_stranicy: стр.тело.length,
    kartinok: картинки.length,
    kartinki: картинки,
  };
  const metaТело = Buffer.from(JSON.stringify(meta, null, 2), 'utf8');

  /* Сначала страница, meta.json — последним: отметка «снято» не должна
     обогнать то, что она описывает. */
  if (!проба) {
    await б.положить(к.stranica, стр.тело, 'text/html; charset=utf-8');
    await б.положить(к.meta, metaТело, 'application/json; charset=utf-8');
  }
  шаг.записей = meta.zapisej;
  шаг.положилБы = [
    { ключ: к.stranica, байт: стр.тело.length, тип: 'text/html' },
    { ключ: к.meta, байт: metaТело.length, тип: 'application/json' },
  ];
  return шаг;
}

/* ─── поездка ────────────────────────────────────────────────────────────── */
async function поездка(д) {
  console.log('Почтальон ленты: каналов ' + д.каналы.length + ', бакет ' + БАКЕТ + (д.проба ? ', СУХОЙ ПРОГОН (в бакет не кладём)' : ''));
  const б = await открытьБакет(д.проба);
  console.log('Доступ к бакету: ' + б.как);

  /* ПРОБНОЕ КАСАНИЕ. Права проверяем ДО того, как выкачаем шесть мегабайт
     превью: иначе первый боевой запуск на каждом канале сначала качал бы
     пятнадцать картинок и только потом падал на первом PUT. Объект крошечный
     и лежит там же, где сырьё, — под lenta/vhod/, куда почтальону и разрешено
     писать; сборщик его не читает (он смотрит только stranica.html и
     meta.json в папке канала). */
  if (!д.проба) {
    const метка = Buffer.from('pochtalon ' + new Date().toISOString() + '\n', 'utf8');
    try {
      await б.положить(С.КОНСТАНТЫ.ПРЕФИКС_ВХОДА + 'proba-dostupa.txt', метка, 'text/plain; charset=utf-8');
      console.log('Пробное касание бакета: можно писать под ' + С.КОНСТАНТЫ.ПРЕФИКС_ВХОДА);
    } catch (e) {
      console.error('Пробное касание бакета не прошло: ' + String(e && e.message || e));
      console.error('Ничего не качаю: без права записи поездка бессмысленна.');
      return 1;
    }
  }

  /* robots.txt площадки — один раз на поездку. Нет файла или нет сети —
     считаем, что можно (то же правило, что у сборщика). */
  let роботы = '';
  try {
    const о = await взять('https://t.me/robots.txt', { срок: 8000, байты: true, максБайт: 1024 * 1024 });
    if (о.статус === 200 && о.тело) роботы = о.тело.toString('utf8');
  } catch (e) { роботы = ''; }

  const шаги = [];
  let первый = true;
  for (const канал of д.каналы) {
    if (!первый) await подождать(ПАУЗА_МЕЖДУ_КАНАЛАМИ_МС);
    первый = false;
    const t0 = Date.now();
    let шаг;
    try { шаг = await обойти(канал, б, роботы, д.проба); }
    catch (e) { шаг = { канал, беда: String(e && e.message || e).slice(0, 200) }; }
    шаг.мс = Date.now() - t0;
    шаги.push(шаг);
    if (шаг.беда) {
      console.log('  ✗ ' + канал + ': ' + шаг.беда + ' (' + шаг.мс + ' мс)');
      continue;
    }
    console.log('  ✓ ' + канал + ': страница ' + шаг.положилБы[0].байт + ' байт, записей в разметке ' + шаг.записей
      + ', картинок ' + шаг.картинок + (шаг.ужеБыло ? ' (уже лежало ' + шаг.ужеБыло + ')' : '')
      + (шаг.пропущено ? ', пропущено ' + шаг.пропущено : '') + ' — ' + шаг.мс + ' мс');
    if (д.проба) for (const о of шаг.положилБы) console.log('      положил бы: ' + о.ключ + '  ' + о.байт + ' байт  ' + о.тип);
    if (д.проба && шаг.картинок) console.log('      положил бы: ' + С.КОНСТАНТЫ.ПРЕФИКС_ВХОДА + канал + '/kartinki/<sha1>.jpg × ' + шаг.картинок);
    if (шаг.разборНеВышел) console.log('      ⓘ разбор не вышел (страницу всё равно везём): ' + шаг.разборНеВышел);
  }

  const удачных = шаги.filter((ш) => !ш.беда).length;
  const картинок = шаги.reduce((с, ш) => с + (ш.картинок || 0), 0);
  const байт = шаги.reduce((с, ш) => с + (ш.байт || 0), 0);
  console.log('\nИтог: страниц ' + удачных + ' из ' + шаги.length + ', картинок ' + картинок
    + ', всего ' + Math.round(байт / 1024) + ' КиБ' + (д.проба ? ' (ничего не положено: --proba)' : ' положено в ' + БАКЕТ));
  /* Красным становимся, только когда не привезли НИЧЕГО: один упавший канал
     из четырёх — не повод будить человека, лента переживёт до следующего
     часа, а состояние источника всё равно видно в /lenta/istochniki. */
  return удачных === 0 ? 1 : 0;
}

const д = доводы(process.argv.slice(2));
if (д.помощь) {
  console.log('node scripts/pochtalon.mjs [--proba] [--kanal=<имя>]\n'
    + '  --proba          качает страницы и картинки, но в бакет ничего не кладёт\n'
    + '  --kanal=<имя>    только один канал (по умолчанию: ' + КАНАЛЫ.join(', ') + ')');
  process.exit(0);
}
if (д.ошибка) { console.error(д.ошибка); process.exit(2); }
/* Ошибку показываем человеку строкой, а не стеком undici: почтальон живёт в
   логе GitHub Actions, и там важно прочитать причину, а не разбирать вывод. */
try {
  process.exit(await поездка(д));
} catch (e) {
  console.error('Почтальон не поехал: ' + String(e && e.message || e));
  process.exit(1);
}
