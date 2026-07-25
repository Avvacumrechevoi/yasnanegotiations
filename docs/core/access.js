/* ═══════════════════════════════════════════════════════════════════
   core/access.js — клиентский резолвер прав. Экспорт: window.YasnaAccess.

   ╔═══════════════════════════════════════════════════════════════════╗
   ║  КЛИЕНТСКИЙ ГЕЙТ — ЭТО ВИТРИНА, А НЕ ЗАЩИТА.                      ║
   ║                                                                   ║
   ║  docs/ раздаётся СТАТИКОЙ с публичных GitHub Pages: lessons/*.js, ║
   ║  negotiations/*.js, content.bundle.js, dist/*.min.js качаются по   ║
   ║  прямому URL, GET /content публичен, а любая скрытая кнопка        ║
   ║  возвращается из DevTools одной строкой. Всё, что делает этот      ║
   ║  файл — РИСУЕТ состояние «закрыто» и не даёт человеку ткнуться в   ║
   ║  тупик. Ни одного секрета здесь нет и быть не может.              ║
   ║                                                                   ║
   ║  ПРОДАВАТЬ МОЖНО ТОЛЬКО УЗЛЫ С sensitive:true — те, за которыми    ║
   ║  стоит настоящая серверная проверка (сегодня это публикация        ║
   ║  контента, все /access/*, роль в /progress). Для остальных узлов   ║
   ║  «закрыто» снимается выключением JS, и закрывать их имеет смысл    ║
   ║  только чтобы не показывать недоделанное.                         ║
   ╚═══════════════════════════════════════════════════════════════════╝

   FAIL-OPEN, И ЭТО РЕШЕНИЕ, А НЕ НЕДОРАБОТКА.
   Механизм выкатывается на живой трафик РАНЬШЕ политики: таблица features
   ещё пуста, ни одна галочка не расставлена. Поэтому:
     • нет данных о правах, нет сети, ответ не пришёл, ключ неизвестен,
       внутри резолвера что-то упало → can() возвращает true;
     • закрывает РОВНО ДВА источника: явное granted=false (готовый ответ
       сервера или персональный entitlement) и default_access='closed'
       (плюс status='wip') в ИЗВЕСТНОМ, то есть опубликованном сервером
       каталоге;
     • то, что раздел объявил про себя сам через declare(), НЕ закрывает
       ничего никогда — это черновик каталога, у него нуль полномочий.
   Итог на момент включения: закрытых разделов ноль, визуально ничего не
   меняется. Первое закрытие появляется только после того, как владелец
   опубликовал каталог и поставил галочку.

   БЕЗ СЕТИ И СИНХРОННО. can() читает то, что уже лежит в
   yasna_sync_state_v1 (ключ реестра core/storage.js, туда пишет pull()
   после GET /progress). Своих запросов этот модуль не делает ни одного:
   права — побочный груз уже существующего запроса прогресса.

   КОНТРАКТ resolveAccess — что сервер добавляет в ответ GET /progress
   (считает ОН, клиент политику из кусочков не складывает):
     role:      {id:'user'|'admin'|'superadmin'|…, title:'…', rank:0|90|100}
     caps:      ['cap:content.publish', …]   — только ОТКРЫТЫЕ полномочия
     access:    {'<feature>': true|false, 'game:partiya:*': false}
                готовый ответ: роль + маски + дефолты, уже разрешённые
     accessWhy: {'<feature>': 'open'|'account'|'closed'|'wip'} — для бейджей
     features:  [{feature, area, parent, title, kind, defaultAccess,
                  status, sensitive}] — опубликованный каталог (нужен, чтобы
                различать «закрыто» и «Скоро» и знать sensitive)
     entitlements: как сейчас — [{feature, granted, source, expiresAt}]
   Любое из полей может отсутствовать (старая версия функции ещё в проде) —
   тогда его источник просто не участвует в разрешении.

   ПОРЯДОК РАЗРЕШЕНИЯ (повторяет серверный, но только для отрисовки):
     1. нет данных о правах вообще            → ОТКРЫТО (fail-open)
     2. роль superadmin                        → ОТКРЫТО
     3. персональный доступ (entitlements)     — длиннейший префикс,
        при равной длине побеждает запрет, истёкший срок = нет строки
     4. готовый ответ сервера access[feature]  — те же правила префиксов
     5. каталог: wip → закрыто, closed → закрыто,
        account → открыто при наличии аккаунта
     6. ключа нет нигде                        → ОТКРЫТО

   МАСКИ. Ключ с '*' покрывает поддерево: 'game:partiya:*' закрывает и
   'game:partiya', и 'game:partiya:solo:5'. Побеждает самый длинный
   совпавший префикс; при равной длине побеждает запрет.

   API (всё синхронно, кроме явно оговорённого):
     role()            → {id,title,rank} | null
     caps()            → ['cap:…', …] (копия)
     can(f[, st])      → true|false     — главный вопрос, fail-open
     why(f[, st])      → {allowed, reason, source, hint, sensitive, …}
     isSuperadmin()    → true|false
     onChange(cb)      → unsubscribe
     declare(nodes)    → {accepted, rejected:[…]} — раздел объявляет узлы
     declared()        → узлы, объявленные НА ЭТОЙ странице (для харвеста
                         каталога из скрытых iframe в админке)
     catalog()         → каталог: сервер + черновик, с ответом can() у каждого
     gate(el|sel, f)   → true|false, ставит data-yasna-locked, НЕ прячет
     refresh([opts])   → перечитать состояние; {pull:true} — попросить
                         core/storage.js сделать свой обычный pull
     state()           → диагностика
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VERSION = 1;

  // Ключ, в который core/storage.js кладёт ответ GET /progress.
  var SYNC_STATE_KEY = 'yasna_sync_state_v1';
  // Черновик каталога: то, что разделы объявили через declare().
  var DECLARED_KEY = 'yasna_access_declared_v1';
  var DECLARED_VERSION = 1;

  var POLL_MS = 5000;        // тихая сверка подписи состояния, без сети
  var PULL_MIN_MS = 10000;   // не чаще одного делегированного pull
  var MAX_NODES = 500;       // черновик каталога не должен съесть квоту
  var MAX_GATES = 400;       // столько мест помним для перерисовки

  // Формат ключа возможности — тот же, что проверяет сервер.
  var KEY_RE = /^[a-z][a-z0-9:._*-]{1,63}$/;

  var VALID_DEFAULT = { open: 1, account: 1, closed: 1 };
  var VALID_STATUS = { live: 1, wip: 1 };
  // Причины, которые сервер вправе прислать в accessWhy.
  var VALID_WHY = { open: 1, account: 1, closed: 1, wip: 1 };

  // Ранги и названия — ТОЛЬКО подстановка, когда сервер их не прислал.
  // Источник истины — таблица roles, здесь ничего не решается.
  var RANKS = { user: 0, admin: 90, superadmin: 100 };
  var TITLES = { user: 'Пользователь', admin: 'Админ', superadmin: 'Суперадмин' };

  // Текст для закрытого места. Страница может подменить своим:
  // window.YasnaAccessHints = { closed: '…' } — до или после загрузки модуля.
  var DEFAULT_HINTS = {
    wip: 'Раздел ещё готовится — скоро откроем.',
    account: 'Войдите через Telegram — прогресс сохранится на любом устройстве.',
    closed: 'Открывается по доступу — напишите @YasnaDuelBot.',
    denied: 'Открывается по доступу — напишите @YasnaDuelBot.'
  };

  function hintFor(reason) {
    var over = null;
    try { over = window.YasnaAccessHints || null; } catch (_) { over = null; }
    if (over && typeof over[reason] === 'string') return over[reason];
    return DEFAULT_HINTS[reason] || null;
  }

  function warn(msg) {
    try { console.warn('[access] ' + msg); } catch (_) {}
  }

  // ─── низкоуровневый доступ ───────────────────────────────────────
  // Ключи читаем НАПРЯМУЮ, не через YasnaStorage: гейт обязан работать
  // даже если storage.js не загрузился или ключ выпал из реестра.
  // Писать в yasna_sync_state_v1 отсюда нельзя — им владеет storage.js.
  function rawGet(key) {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  }
  function rawSet(key, str) {
    try { window.localStorage.setItem(key, str); return true; }
    catch (e) { warn('не удалось записать ' + key + ': ' + ((e && e.name) || e)); return false; }
  }
  function parse(raw) {
    if (typeof raw !== 'string' || !raw) return null;
    try {
      var v = JSON.parse(raw);
      return (v && typeof v === 'object') ? v : null;
    } catch (_) { return null; }
  }
  // Дешёвая подпись — та же схема, что в core/storage.js.
  function sig(str) {
    var h = 5381, i;
    if (typeof str !== 'string') return '0';
    for (i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return String(str.length) + ':' + h;
  }
  function isoNow() { return new Date().toISOString(); }

  // ─── нормализация того, что прислал сервер ───────────────────────
  function normRole(r) {
    if (!r) return null;
    if (typeof r === 'string') {
      if (!r) return null;
      return { id: r, title: TITLES[r] || r, rank: RANKS[r] == null ? null : RANKS[r] };
    }
    if (typeof r !== 'object') return null;
    var id = r.id || r.roleId || r.role_id || null;
    if (!id) return null;
    id = String(id);
    var rank = r.rank;
    if (rank == null) rank = r.rankLevel;
    if (rank == null) rank = r.rank_level;
    if (typeof rank === 'string' && rank !== '') rank = Number(rank);
    if (typeof rank !== 'number' || rank !== rank) rank = (RANKS[id] == null ? null : RANKS[id]);
    return { id: id, title: String(r.title || TITLES[id] || id), rank: rank };
  }

  // caps приходят массивом ['cap:…'], но принимаем и карту {'cap:…':true}.
  function normCaps(src, role) {
    var out = [], i, k;
    var raw = src;
    if (!raw && role && typeof role === 'object') raw = role.caps;
    if (Array.isArray(raw)) {
      for (i = 0; i < raw.length; i++) {
        if (typeof raw[i] === 'string' && raw[i]) out.push(raw[i]);
        else if (raw[i] && typeof raw[i] === 'object' && raw[i].feature && raw[i].granted !== false) out.push(String(raw[i].feature));
      }
    } else if (raw && typeof raw === 'object') {
      for (k in raw) { if (Object.prototype.hasOwnProperty.call(raw, k) && raw[k]) out.push(k); }
    }
    return out;
  }

  // access: {feature: bool} либо [{feature, granted}] → карта feature→bool.
  function normRules(src) {
    var out = {}, i, k, it;
    if (Array.isArray(src)) {
      for (i = 0; i < src.length; i++) {
        it = src[i];
        if (!it || !it.feature) continue;
        out[String(it.feature)] = !(it.granted === false);
      }
    } else if (src && typeof src === 'object') {
      for (k in src) {
        if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
        out[k] = !!src[k];
      }
    }
    return out;
  }

  // Истёкший срок ведёт себя как ОТСУТСТВИЕ строки (возврат к правилам
  // роли), а не как запрет — иначе окончание промо-доступа закрывало бы
  // человеку то, что открыто всем.
  function alive(expiresAt) {
    if (!expiresAt) return true;
    var t = Date.parse(String(expiresAt));
    if (t !== t) return true;               // не разобрали дату — не наказываем
    return t > Date.now();
  }

  function normEnts(src) {
    var out = {}, i, e;
    if (!Array.isArray(src)) return out;
    for (i = 0; i < src.length; i++) {
      e = src[i];
      if (!e || !e.feature) continue;
      if (!alive(e.expiresAt || e.expires_at)) continue;
      out[String(e.feature)] = !(e.granted === false);
    }
    return out;
  }

  function normNodeFromServer(n) {
    if (!n || !n.feature) return null;
    var da = n.defaultAccess || n.default_access || 'open';
    if (!VALID_DEFAULT[da]) da = 'open';
    var st = n.status || 'live';
    if (!VALID_STATUS[st]) st = 'live';
    return {
      feature: String(n.feature),
      area: n.area ? String(n.area) : '',
      parent: n.parent ? String(n.parent) : null,
      title: n.title ? String(n.title) : String(n.feature),
      kind: n.kind ? String(n.kind) : '',
      defaultAccess: da,
      status: st,
      sensitive: !!n.sensitive
    };
  }

  // Каталог принимаем и массивом (как отдаёт сервер), и картой
  // feature → узел: у карты ключ сильнее поля feature внутри значения.
  function normCatalog(src) {
    var out = {}, i, n, k, raw;
    if (Array.isArray(src)) {
      for (i = 0; i < src.length; i++) {
        n = normNodeFromServer(src[i]);
        if (n) out[n.feature] = n;
      }
      return out;
    }
    if (src && typeof src === 'object') {
      for (k in src) {
        if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
        raw = (src[k] && typeof src[k] === 'object') ? src[k] : {};
        n = normNodeFromServer({
          feature: k,
          area: raw.area, parent: raw.parent, title: raw.title, kind: raw.kind,
          defaultAccess: raw.defaultAccess || raw.default_access,
          status: raw.status, sensitive: raw.sensitive
        });
        if (n) out[n.feature] = n;
      }
    }
    return out;
  }

  // ─── состояние прав ─────────────────────────────────────────────
  var snap = null;        // разобранный снимок
  var stateSig = null;    // подпись сырого yasna_sync_state_v1
  var answers = {};       // кэш ответов can()/why() до следующего изменения

  function emptySnap() {
    return {
      hasData: false, isUser: false, ownerKey: null,
      role: null, caps: [], rules: {}, why: {}, catalog: {}, ents: {},
      lastPull: null, lastError: null
    };
  }

  function build(st) {
    var s = emptySnap();
    if (!st) return s;
    s.isUser = !!st.isUser;
    s.ownerKey = st.ownerKey || null;
    s.lastPull = st.lastPull || null;
    s.lastError = st.lastError || null;
    s.role = normRole(st.role);
    s.caps = normCaps(st.caps, st.role);
    s.rules = normRules(st.access);
    s.catalog = normCatalog(st.features || st.catalog);
    s.ents = normEnts(st.entitlements);
    if (st.accessWhy && typeof st.accessWhy === 'object') {
      var k;
      for (k in st.accessWhy) {
        if (!Object.prototype.hasOwnProperty.call(st.accessWhy, k)) continue;
        if (VALID_WHY[st.accessWhy[k]]) s.why[k] = st.accessWhy[k];
      }
    }
    // «Данные о правах есть» = сервер прислал ХОТЬ ЧТО-ТО про права.
    // Пустой pull без этих полей (старая версия функции) данными не считается:
    // иначе fail-open превратился бы в «всё открыто по решению», а мы бы
    // перестали отличать «прав нет» от «прав не знаем».
    s.hasData = !!(s.role
      || countKeys(s.rules)
      || countKeys(s.catalog)
      || countKeys(s.ents)
      || s.caps.length);
    return s;
  }

  function countKeys(o) { return o ? Object.keys(o).length : 0; }

  // Перечитать состояние. Возвращает true, если оно изменилось.
  function reload() {
    var raw = rawGet(SYNC_STATE_KEY);
    var s2 = sig(raw || '');
    if (snap && s2 === stateSig) return false;
    stateSig = s2;
    snap = build(parse(raw));
    answers = {};
    return true;
  }

  function current() {
    if (!snap) reload();
    return snap;
  }

  // ─── разрешение ─────────────────────────────────────────────────
  // Совпадение ключа правила с возможностью. Ключ без '*' совпадает точно;
  // ключ с '*' покрывает поддерево И сам узел без хвостового разделителя
  // ('game:partiya:*' покрывает 'game:partiya'). Длина совпадения нужна,
  // чтобы точный ключ побеждал маску, а длинная маска — короткую.
  function matchLen(key, feature) {
    if (key === feature) return key.length;
    if (key.charAt(key.length - 1) !== '*') return -1;
    var base = key.slice(0, key.length - 1);               // 'game:partiya:'
    if (base === '') return 0;                             // '*' — совсем общая маска
    if (feature.length > base.length && feature.indexOf(base) === 0) return base.length;
    var bare = base.replace(/[:.\-\/]+$/, '');             // 'game:partiya'
    if (bare && feature === bare) return bare.length;
    return -1;
  }

  function matchRule(map, feature) {
    var keys = Object.keys(map), i, len, best = null, bestLen = -1, granted;
    for (i = 0; i < keys.length; i++) {
      len = matchLen(keys[i], feature);
      if (len < 0) continue;
      granted = !!map[keys[i]];
      // При РАВНОЙ длине побеждает запрет: галочка «открыть ветку» не должна
      // молча снимать точечное «закрыть» той же длины.
      if (len > bestLen || (len === bestLen && !granted)) {
        bestLen = len;
        best = { key: keys[i], granted: granted };
      }
    }
    return best;
  }

  function verdict(feature, allowed, reason, source, matched, node) {
    var v = {
      feature: feature,
      allowed: !!allowed,
      reason: reason,
      source: source,
      matched: matched || null,
      sensitive: !!(node && node.sensitive),
      title: (node && node.title) || null,
      status: (node && node.status) || null,
      hint: null
    };
    if (!v.allowed) v.hint = hintFor(reason);
    return v;
  }

  function resolve(feature, s) {
    var f = (feature == null) ? '' : String(feature);
    if (!f) return verdict(f, true, 'no-key', 'fail-open', null, null);
    var node = s.catalog[f] || null;

    // Прав не знаем — открыто. Это и есть fail-open: ни сеть, ни недоехавший
    // деплой, ни первый заход не имеют права ничего закрыть.
    if (!s.hasData) return verdict(f, true, 'no-data', 'fail-open', null, node);

    // Суперадмину открыто всё — включая узлы, которых нет в каталоге.
    if (s.role && (s.role.id === 'superadmin' || (typeof s.role.rank === 'number' && s.role.rank >= 100))) {
      return verdict(f, true, 'superadmin', 'role', null, node);
    }

    // Персональный доступ владельца сильнее правил роли.
    var ent = matchRule(s.ents, f);
    if (ent) {
      return verdict(f, ent.granted, ent.granted ? 'granted' : 'closed', 'entitlement', ent.key, node);
    }

    // Готовый ответ сервера: роль, маски и дефолты там уже сведены.
    var srv = matchRule(s.rules, f);
    if (srv) {
      var reason = srv.granted ? 'open' : (VALID_WHY[s.why[f]] && s.why[f] !== 'open' ? s.why[f] : 'closed');
      return verdict(f, srv.granted, reason, 'server', srv.key, node);
    }

    // Каталог как последний известный источник. Только ОПУБЛИКОВАННЫЙ:
    // локальные declare() сюда не попадают и закрыть ничего не могут.
    if (node) {
      if (node.status === 'wip') return verdict(f, false, 'wip', 'catalog', f, node);
      if (node.defaultAccess === 'closed') return verdict(f, false, 'closed', 'catalog', f, node);
      if (node.defaultAccess === 'account') {
        return verdict(f, !!s.isUser, s.isUser ? 'open' : 'account', 'catalog', f, node);
      }
      return verdict(f, true, 'open', 'catalog', f, node);
    }

    // Ключ неизвестен — открыто. Новый раздел не должен исчезать до того,
    // как каталог опубликован.
    return verdict(f, true, 'unknown', 'fail-open', null, null);
  }

  // Кэш ответов: can() зовут в циклах отрисовки, лишний разбор не нужен.
  function ask(feature, altState) {
    if (altState) return resolve(feature, build(altState));
    var f = (feature == null) ? '' : String(feature);
    var s = current();
    if (Object.prototype.hasOwnProperty.call(answers, f)) return answers[f];
    var v = resolve(f, s);
    answers[f] = v;
    return v;
  }

  // ─── публичные вопросы ──────────────────────────────────────────
  // Любая внутренняя ошибка обязана давать true: сломанный резолвер не
  // имеет права закрыть человеку продукт.
  function can(feature, altState) {
    try { return ask(feature, altState).allowed; }
    catch (e) { warn('can(' + feature + ') упал: ' + ((e && e.message) || e)); return true; }
  }
  function why(feature, altState) {
    try { return ask(feature, altState); }
    catch (e) {
      warn('why(' + feature + ') упал: ' + ((e && e.message) || e));
      return verdict(String(feature || ''), true, 'error', 'fail-open', null, null);
    }
  }
  function role() {
    var r = current().role;
    return r ? { id: r.id, title: r.title, rank: r.rank } : null;
  }
  function caps() { return current().caps.slice(); }
  function isSuperadmin() {
    var r = current().role;
    return !!(r && (r.id === 'superadmin' || (typeof r.rank === 'number' && r.rank >= 100)));
  }

  // ─── подписка ───────────────────────────────────────────────────
  var subs = [];
  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    subs.push(cb);
    return function () { var i = subs.indexOf(cb); if (i > -1) subs.splice(i, 1); };
  }
  function notify() {
    var st = state(), i;
    for (i = 0; i < subs.length; i++) {
      try { subs[i](st); } catch (e) { warn('подписчик упал: ' + ((e && e.message) || e)); }
    }
  }

  // ─── черновик каталога (declare) ────────────────────────────────
  // Раздел объявляет свои узлы там, где он и так их перечисляет. Это НЕ
  // права: черновик лежит в localStorage, чтобы админка собрала каталог
  // одной кнопкой (POST /access/features). На can() он не влияет вообще —
  // иначе любая страница закрывала бы себя сама, без ведома владельца.
  var declaredHere = {};   // объявлено НА ЭТОЙ странице — для харвеста из iframe
  var declStore = null;    // весь черновик (память + localStorage)
  var pending = null;      // что ещё не записано
  var flushTimer = null;

  function loadDecl() {
    if (declStore) return declStore;
    var v = parse(rawGet(DECLARED_KEY));
    if (!v || !v.nodes || typeof v.nodes !== 'object') v = { version: DECLARED_VERSION, updatedAt: null, nodes: {} };
    declStore = v;
    return declStore;
  }

  function whereAmI() {
    try {
      var p = String(window.location.pathname || '');
      var i = p.lastIndexOf('/');
      var name = i > -1 ? p.slice(i + 1) : p;
      return name || 'index.html';
    } catch (_) { return null; }
  }

  function normDeclared(n) {
    if (!n || typeof n !== 'object') return null;
    var f = n.feature == null ? '' : String(n.feature);
    // Формат ключа — тот же, что проверяет сервер. Мусорный ключ лучше
    // отвергнуть здесь: опечатка в каталоге превращается в право-призрак.
    if (!KEY_RE.test(f)) return null;
    var da = n.defaultAccess || n.default_access || 'open';
    if (!VALID_DEFAULT[da]) da = 'open';
    var st = n.status || 'live';
    if (!VALID_STATUS[st]) st = 'live';
    return {
      feature: f,
      area: n.area ? String(n.area).slice(0, 40) : 'other',
      parent: n.parent ? String(n.parent).slice(0, 64) : null,
      title: String(n.title || f).slice(0, 200),
      kind: n.kind ? String(n.kind).slice(0, 24) : 'section',
      defaultAccess: da,
      status: st,
      sensitive: !!n.sensitive,
      declaredAt: n.declaredAt ? String(n.declaredAt).slice(0, 160) : whereAmI(),
      at: isoNow()
    };
  }

  // Запись отложена: declare() зовут в циклах по 30–40 узлов, и писать
  // localStorage на каждый вызов — заметный тормоз на слабом телефоне.
  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flushDecl(); }, 0);
  }

  function flushDecl() {
    if (!pending) return;
    var store = loadDecl(), k, keys, i;
    for (k in pending) {
      if (Object.prototype.hasOwnProperty.call(pending, k)) store.nodes[k] = pending[k];
    }
    pending = null;
    keys = Object.keys(store.nodes);
    if (keys.length > MAX_NODES) {
      // Черновик — не хранилище. Режем самое старое по времени объявления.
      keys.sort(function (a, b) {
        var ta = String(store.nodes[a].at || ''), tb = String(store.nodes[b].at || '');
        return ta < tb ? -1 : (ta > tb ? 1 : 0);
      });
      for (i = 0; i < keys.length - MAX_NODES; i++) delete store.nodes[keys[i]];
      warn('черновик каталога обрезан до ' + MAX_NODES + ' узлов');
    }
    store.version = DECLARED_VERSION;
    store.updatedAt = isoNow();
    rawSet(DECLARED_KEY, JSON.stringify(store));
  }

  function declare(nodes) {
    var res = { accepted: 0, rejected: [] };
    try {
      var list = Array.isArray(nodes) ? nodes : [nodes];
      var i, n;
      for (i = 0; i < list.length; i++) {
        n = normDeclared(list[i]);
        if (!n) {
          res.rejected.push({
            feature: (list[i] && list[i].feature) || null,
            why: 'ключ не проходит ' + String(KEY_RE)
          });
          continue;
        }
        declaredHere[n.feature] = n;
        if (!pending) pending = {};
        pending[n.feature] = n;
        res.accepted++;
      }
      if (res.accepted) scheduleFlush();
      if (res.rejected.length) warn('declare: отвергнуто узлов — ' + res.rejected.length);
    } catch (e) {
      warn('declare упал: ' + ((e && e.message) || e));
    }
    return res;
  }

  function declared() {
    var out = [], k;
    for (k in declaredHere) {
      if (Object.prototype.hasOwnProperty.call(declaredHere, k)) out.push(declaredHere[k]);
    }
    out.sort(function (a, b) { return a.feature < b.feature ? -1 : (a.feature > b.feature ? 1 : 0); });
    return out;
  }

  // Каталог наружу: опубликованное сервером + черновик, у каждого узла
  // готовый ответ can() и причина. Отсюда живут диф в админке и экран
  // «Как увидит» — оба считают ТЕМ ЖЕ резолвером, что и продукт.
  function catalog() {
    var s = current();
    var store = loadDecl();
    var seen = {}, out = [], k, n, v;
    for (k in s.catalog) {
      if (!Object.prototype.hasOwnProperty.call(s.catalog, k)) continue;
      seen[k] = 1;
      n = s.catalog[k];
      v = why(k);
      out.push({
        feature: k, area: n.area, parent: n.parent, title: n.title, kind: n.kind,
        defaultAccess: n.defaultAccess, status: n.status, sensitive: n.sensitive,
        declaredAt: (store.nodes[k] && store.nodes[k].declaredAt) || null,
        source: store.nodes[k] ? 'both' : 'server',
        allowed: v.allowed, reason: v.reason
      });
    }
    for (k in store.nodes) {
      if (!Object.prototype.hasOwnProperty.call(store.nodes, k) || seen[k]) continue;
      n = store.nodes[k];
      v = why(k);
      out.push({
        feature: k, area: n.area, parent: n.parent, title: n.title, kind: n.kind,
        defaultAccess: n.defaultAccess, status: n.status, sensitive: n.sensitive,
        declaredAt: n.declaredAt || null,
        source: 'local',                  // объявлено, но ещё НЕ опубликовано
        allowed: v.allowed, reason: v.reason
      });
    }
    out.sort(function (a, b) { return a.feature < b.feature ? -1 : (a.feature > b.feature ? 1 : 0); });
    return out;
  }

  // ─── gate: пометить, но НЕ спрятать ─────────────────────────────
  // Человек должен видеть, что раздел существует и закрыт: исчезнувшая
  // карточка читается как поломка сайта и убивает будущий апсейл.
  // Здесь ставится только атрибут — вид задаёт CSS страницы.
  var gates = [];

  function toElements(target) {
    var out = [], i, found;
    if (!target) return out;
    if (typeof target === 'string') {
      try { found = document.querySelectorAll(target); } catch (_) { return out; }
      for (i = 0; i < found.length; i++) out.push(found[i]);
      return out;
    }
    if (target.nodeType === 1) { out.push(target); return out; }
    if (typeof target.length === 'number') {
      for (i = 0; i < target.length; i++) {
        if (target[i] && target[i].nodeType === 1) out.push(target[i]);
      }
    }
    return out;
  }

  function applyGate(el, feature, v) {
    if (!el || el.nodeType !== 1) return;
    try {
      el.setAttribute('data-yasna-feature', feature);
      if (v.allowed) {
        el.removeAttribute('data-yasna-locked');
        // подсказку снимаем только СВОЮ, чужой title не трогаем
        if (el.getAttribute('data-yasna-hint') === '1') {
          el.removeAttribute('title');
          el.removeAttribute('data-yasna-hint');
        }
        return;
      }
      // Значение атрибута — причина: 'closed' | 'account' | 'wip'.
      // Это разные состояния, и путать их в интерфейсе нельзя.
      el.setAttribute('data-yasna-locked', v.reason);
      if (v.hint && !el.getAttribute('title')) {
        el.setAttribute('title', v.hint);
        el.setAttribute('data-yasna-hint', '1');
      }
    } catch (e) { warn('gate: не удалось пометить элемент — ' + ((e && e.message) || e)); }
  }

  function remember(entry) {
    var i;
    for (i = 0; i < gates.length; i++) {
      if (gates[i].feature !== entry.feature) continue;
      if (entry.sel && gates[i].sel === entry.sel) return;
      if (entry.el && gates[i].el === entry.el) return;
    }
    if (gates.length >= MAX_GATES) gates.shift();
    gates.push(entry);
  }

  function gate(target, feature) {
    try {
      var v = ask(feature, null);
      var els = toElements(target), i;
      for (i = 0; i < els.length; i++) applyGate(els[i], feature, v);
      if (typeof target === 'string') remember({ sel: target, el: null, feature: feature });
      else for (i = 0; i < els.length; i++) remember({ sel: null, el: els[i], feature: feature });
      return v.allowed;
    } catch (e) {
      warn('gate(' + feature + ') упал: ' + ((e && e.message) || e));
      return true;
    }
  }

  // Права могли измениться (доехал pull, вошли в аккаунт) — перерисовать
  // уже помеченные места. Ушедшие из DOM забываем: React перерисовывает.
  function regate() {
    var keep = [], i, g, els, j, v;
    for (i = 0; i < gates.length; i++) {
      g = gates[i];
      v = ask(g.feature, null);
      if (g.sel) {
        els = toElements(g.sel);
        for (j = 0; j < els.length; j++) applyGate(els[j], g.feature, v);
        keep.push(g);
        continue;
      }
      if (g.el && (g.el.isConnected === undefined || g.el.isConnected)) {
        applyGate(g.el, g.feature, v);
        keep.push(g);
      }
    }
    gates = keep;
  }

  // ─── обновление состояния ───────────────────────────────────────
  var lastPullAt = 0;

  function state() {
    var s = current();
    return {
      version: VERSION,
      hasData: s.hasData,
      failOpen: !s.hasData,
      isUser: s.isUser,
      ownerKey: s.ownerKey,
      role: s.role ? { id: s.role.id, title: s.role.title, rank: s.role.rank } : null,
      caps: s.caps.slice(),
      rules: countKeys(s.rules),
      catalogNodes: countKeys(s.catalog),
      entitlements: countKeys(s.ents),
      declaredHere: Object.keys(declaredHere).length,
      declaredTotal: countKeys(loadDecl().nodes),
      lastPull: s.lastPull,
      lastError: s.lastError
    };
  }

  // Перечитать локальное состояние. Сети не касается.
  // refresh({pull:true}) — попросить core/storage.js сделать его ОБЫЧНЫЙ
  // pull (GET /progress). Своих запросов у access.js нет: новый запрос из
  // браузера здесь не появляется ни при каких опциях.
  function refresh(opts) {
    var o = opts || {};
    var changed = false;
    try { changed = reload(); } catch (e) { warn('refresh упал: ' + ((e && e.message) || e)); }
    if (changed) { regate(); notify(); }
    if (o.pull) {
      var now = Date.now();
      if (now - lastPullAt >= PULL_MIN_MS) {
        lastPullAt = now;
        try {
          var sync = window.YasnaStorage && window.YasnaStorage.sync;
          if (sync && typeof sync.pull === 'function') {
            sync.pull().then(function () { refresh(); }, function () { refresh(); });
          }
        } catch (e) { warn('делегированный pull не запустился: ' + ((e && e.message) || e)); }
      }
    }
    return state();
  }

  // ─── запуск ─────────────────────────────────────────────────────
  reload();

  // Событие 'storage' приходит ТОЛЬКО от других вкладок, поэтому одного
  // его мало: свой же pull так не поймать. Отсюда тихая сверка подписи —
  // сравнение строки, без разбора JSON и без запросов.
  try {
    window.addEventListener('storage', function (e) {
      if (!e || !e.key) return;
      if (e.key === SYNC_STATE_KEY) refresh();
      else if (e.key === DECLARED_KEY) declStore = null;
    });
  } catch (_) {}

  try {
    setInterval(function () {
      if (document.hidden) return;      // в фоне сверять нечего
      refresh();
    }, POLL_MS);
  } catch (_) {}

  try {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') refresh();
    });
    // Селекторные гейты могли сработать до появления разметки.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { regate(); });
    }
    // Черновик каталога не должен потеряться, если страницу закрыли
    // в том же тике, в котором раздел объявил свои узлы.
    window.addEventListener('pagehide', function () { flushDecl(); });
  } catch (_) {}

  window.YasnaAccess = {
    VERSION: VERSION,
    DECLARED_KEY: DECLARED_KEY,
    role: role,
    caps: caps,
    can: can,
    why: why,
    isSuperadmin: isSuperadmin,
    onChange: onChange,
    declare: declare,
    declared: declared,
    catalog: catalog,
    gate: gate,
    refresh: refresh,
    state: state
  };
})();
