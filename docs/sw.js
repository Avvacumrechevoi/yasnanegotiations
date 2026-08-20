/* ═══════════════════════════════════════════════════════════════════════════
   ОФЛАЙН. Раньше без сети любая из девяти страниц показывала «нет интернета»:
   service worker в проекте отсутствовал полностью. Теперь открытое однажды
   открывается и без сети — и это же условие, при котором магазины принимают
   приложение-обёртку: «просто показывает сайт» они отклоняют.

   ТРИ ПРАВИЛА, И ОНИ РАЗНЫЕ ПО ПРИЧИНЕ, А НЕ ПО ВКУСУ.

   1. Страницы (переходы) — сначала сеть, кэш про запас. Содержание меняется,
      и человек должен видеть свежее; кэш вступает, только когда сети нет.
   2. Своё добро (бандлы, библиотеки, шрифты, картинки, данные) — сначала кэш,
      обновление в фоне. Эти файлы у нас с версией в адресе (?v=…), поэтому
      старый ответ не может «залипнуть»: изменился файл — изменился адрес.
   3. Обращения к серверу (шлюз API) — только сеть, никогда не кэш. Прогресс,
      рейтинг и отправка матчей обязаны быть настоящими; отдать вчерашний
      прогресс хуже, чем не отдать никакого.

   ЧЕГО ЗДЕСЬ СОЗНАТЕЛЬНО НЕТ: skipWaiting(). Новый работник ждёт, пока
   закроются все вкладки со старым. Иначе на середине занятия подменились бы
   бандлы, а страница осталась бы прежней — это худший вид поломки, потому что
   человек не понимает, что произошло.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Меняется при выкладке — scripts/build.mjs подставляет сюда отпечаток
   содержимого. Смена имени кэша и есть механизм обновления. */
const ВЕРСИЯ = 'yasna-v1';
const КЭШ_ОБОЛОЧКА = ВЕРСИЯ + '-obolochka';
const КЭШ_ХОДОВОЕ  = ВЕРСИЯ + '-hodovoe';

/* Оболочка: то немногое, без чего не показать вообще ничего. Держим её
   маленькой — восемь мегабайт при установке никто ждать не станет, а
   остальное само осядет в кэше при первом обращении. */
const ОБОЛОЧКА = [
  './',
  './index.html',
  './offline.html',
  './styles.css',
  './vendor/fonts/shrifty.css',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/favicon-32.png'
];

/* Куда ходить только по сети. Всё, что меняет или читает состояние человека. */
function этоСервер(url) {
  return url.hostname.endsWith('apigw.yandexcloud.net')
      || url.hostname.endsWith('firebaseio.com')
      || url.hostname.endsWith('googleapis.com');
}

/* Что можно держать в кэше надолго: наше собственное добро. */
function этоХодовое(url) {
  return url.origin === self.location.origin
      && /\.(js|css|woff2?|png|jpe?g|svg|webp|json|ico)$/i.test(url.pathname);
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(КЭШ_ОБОЛОЧКА)
      /* Поштучно, а не addAll: addAll валится целиком, если не открылся один
         адрес, и тогда офлайна не будет вовсе — из-за одной картинки. */
      .then(function (c) {
        return Promise.all(ОБОЛОЧКА.map(function (u) {
          return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
        }));
      })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names
        .filter(function (n) { return n.indexOf(ВЕРСИЯ) !== 0; })
        .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  /* Единственный способ обновиться немедленно — по прямой просьбе страницы,
     когда человек сам нажал «обновить». Сам по себе работник не торопится. */
  if (e.data === 'обновись') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (этоСервер(url)) return;                    /* сервер — мимо кэша */
  if (url.origin !== self.location.origin) return;

  /* ── Страницы: сначала сеть ── */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (r) {
          const копия = r.clone();
          caches.open(КЭШ_ХОДОВОЕ).then(function (c) { c.put(req, копия); });
          return r;
        })
        .catch(function () {
          return caches.match(req)
            .then(function (r) { return r || caches.match('./offline.html'); })
            .then(function (r) {
              return r || new Response(
                '<meta charset="utf-8"><p>Нет сети, и эта страница ещё не сохранена.',
                { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 });
            });
        })
    );
    return;
  }

  /* ── Своё добро: сначала кэш, обновление в фоне ── */
  if (этоХодовое(url)) {
    e.respondWith(
      caches.match(req).then(function (изКэша) {
        const изСети = fetch(req).then(function (r) {
          if (r && r.status === 200 && r.type === 'basic') {
            const копия = r.clone();
            caches.open(КЭШ_ХОДОВОЕ).then(function (c) { c.put(req, копия); });
          }
          return r;
        }).catch(function () { return изКэша; });
        return изКэша || изСети;
      })
    );
  }
});
