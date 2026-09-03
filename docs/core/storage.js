/* ═══════════════════════════════════════════════════════════════════
   YasnaStorage — единая точка доступа к состоянию пользователя.

   ЗАЧЕМ. Прогресс размазан по 44 ключам localStorage и ~148 разрозненным
   вызовам, у каждого свой парсинг и молчаливый catch. Из-за этого:
   • нельзя перечислить, что вообще составляет «прогресс пользователя»;
   • некуда прикрутить серверную синхронизацию — нет ни одной точки, через
     которую проходили бы записи;
   • нельзя выгрузить/перенести прогресс (смена устройства = потеря всего,
     включая СОБСТВЕННЫЕ Ясны из конструктора и личные заметки к урокам);
   • при переполнении квоты (Safari private mode) запись молча теряется.

   ЭТОТ МОДУЛЬ АДДИТИВНЫЙ. Он НЕ переписывает существующие вызовы — это
   отдельный, рискованный шаг. Здесь: правдивый реестр ключей, типизированный
   доступ, экспорт/импорт снапшота и каркас миграций. На него будут опираться
   серверный прогресс (Фаза 2) и миграция гостей в аккаунты (Фаза 3).

   Грузится обычным script-тегом, экспорт — window.YasnaStorage.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SNAPSHOT_VERSION = 1;

  // ─── РЕЕСТР КЛЮЧЕЙ ───────────────────────────────────────────────
  // scope: 'progress' — учебный/игровой прогресс, ГЛАВНОЕ, что нельзя терять
  //        'creation' — созданное пользователем (ценнее прогресса: не воспроизвести)
  //        'identity' — кто он (deviceId, токен) — переносить осторожно
  //        'prefs'    — настройки интерфейса, потеря не критична
  //        'cache'    — производное, восстановимо, в снапшот НЕ идёт
  //        'secret'   — не выгружать никогда
  var KEYS = {
    // ── созданное пользователем ──
    yasna_custom_v1:            { scope: 'creation', json: true,  owner: 'core/dialogs.js',    about: 'собственные Ясны, собранные в конструкторе' },
    yasna_pinned_v1:            { scope: 'creation', json: true,  owner: 'app.js',             about: 'закреплённые механики' },
    yasna2_subdata:             { scope: 'creation', json: true,  owner: 'app.js',             about: 'пользовательские подданные звезды' },
    // Список друзей — зеркало своего поддерева в базе. Человек собирал его
    // руками, по одному коду: без него переустановка означает «начни знакомиться
    // заново», хотя карточки друзей в базе никуда не делись.
    yasna_druzya_v1:            { scope: 'creation', json: true,  owner: 'core/druzya.js',     about: 'свой список друзей (зеркало базы, работает офлайн)' },
    yasna_zayavki_out_v1:       { scope: 'creation', json: true,  owner: 'core/druzya.js',     about: 'кому я сам отправлял заявки в друзья' },

    // ── учебный прогресс ──
    yasna_completed_lessons_v1: { scope: 'progress', json: true,  owner: 'app.js',             about: 'пройденные уроки курса' },
    yasna_course_progress:      { scope: 'progress', json: true,  owner: 'learn.html',         about: 'прогресс по карте курса' },
    yasna_path_stats:           { scope: 'progress', json: true,  owner: 'index.html',         about: 'статистика пути' },
    yasna_learn_intro_done_v1:  { scope: 'progress', json: false, owner: 'learn.html',         about: 'вводный экран обучения пройден' },
    yasna_znanie_v1:            { scope: 'progress', json: true,  owner: 'core/znanie.js',     about: 'что открывали и что досмотрели: уроки, разборы — общий след для дерева знаний' },
    yasna_visited:              { scope: 'progress', json: false, owner: 'index.html',         about: 'был ли первый визит' },

    // ── игровой прогресс ──
    yasna_duel_data:            { scope: 'progress', json: true,  owner: 'games/duel/duel.js', about: 'история партий, бусины, мастерство по темам' },
    yasna_duel_achievements:    { scope: 'progress', json: true,  owner: 'games/duel/duel.js', about: 'достижения' },
    yasna_duel_daily:           { scope: 'progress', json: true,  owner: 'games/duel/duel.js', about: 'дневной вызов и streak' },
    yasna_seen_questions:       { scope: 'progress', json: true,  owner: 'games/duel/trivia-bank.js', about: 'история показов вопросов (антиповтор)' },
    yasna_krug_v1:              { scope: 'progress', json: true,  owner: 'games/krug/krug.js', about: 'круг: собранные ясны и история партий' },

    // ── прогресс тренажёра переговоров ──
    yasna_neg_progress_v1:      { scope: 'progress', json: true,  owner: 'negotiations/trainer.js',        about: 'прогресс дриллов по стадиям' },
    yasna_neg_lessons_v1:       { scope: 'progress', json: true,  owner: 'negotiations/lessons-neg.js',    about: 'пройденные сценарии' },
    yasna_neg_practice_v1:      { scope: 'progress', json: true,  owner: 'negotiations/trainer.js',        about: 'ситуационная практика' },
    yasna_neg_spar_v1:          { scope: 'progress', json: true,  owner: 'negotiations/spar.js',           about: 'прогресс живого спарринга' },
    yasna_negc_v1:              { scope: 'progress', json: true,  owner: 'negotiations/contact-trainer.js', about: 'вход в контакт: встречи' },
    yasna_neg_onb_v1:           { scope: 'progress', json: false, owner: 'negotiations/lessons-neg.js',    about: 'онбординг тренажёра пройден' },

    // ── идентичность ──
    yasna_duel_profile:         { scope: 'identity', json: true,  owner: 'games/duel/duel.js', about: 'гостевой профиль: ник, аватар, deviceId — КЛЮЧ ко всему прогрессу' },
    yasna_device_id_v1:         { scope: 'identity', json: false, owner: 'core/storage.js',    about: 'единый id устройства для серверной синхронизации (общий с профилем игры)' },
    yasna_device_secret_v1:     { scope: 'identity', json: false, owner: 'core/storage.js',    about: 'секрет устройства: доказывает право на гостевой прогресс', sensitive: true },
    yasna_duel_user:            { scope: 'identity', json: true,  owner: 'games/duel/duel.js', about: 'залогиненный пользователь (Telegram)' },
    yasna_duel_token:           { scope: 'identity', json: false, owner: 'games/duel/duel.js', about: 'JWT сессии', sensitive: true },
    // Свой адрес в базе друзей. НЕ синхронизируем нарочно: узел lyudi/<pid>
    // принадлежит тому uid, который застолбил его первым (TOFU, см. druzya.js).
    // Второе устройство с тем же pid просто не смогло бы записать свою карточку
    // — друзья видели бы её застывшей. Новая установка честно берёт новый pid.
    yasna_pid_v1:               { scope: 'identity', json: false, owner: 'core/druzya.js',     about: 'мой публичный id в базе друзей' },
    yasna_moy_kod_v1:           { scope: 'identity', json: false, owner: 'core/druzya.js',     about: 'мой код дружбы (по нему меня находят)' },

    // ── настройки ──
    yasna_theme:                { scope: 'prefs', json: false, owner: 'core/theme.js',            about: 'единая тема light|dark|auto' },
    yasna_theme_vk_dark:        { scope: 'prefs', json: false, owner: 'core/theme.js',            about: 'легаси-зеркало темы (конструктор/игра)' },
    yasna_neg_theme:            { scope: 'prefs', json: false, owner: 'core/theme.js',            about: 'легаси-зеркало темы (переговоры)' },
    yasna_astro_mode:           { scope: 'prefs', json: false, owner: 'core/astro-panel.js',      about: 'режим астро-панели' },
    yasna_astro_layers:         { scope: 'prefs', json: true,  owner: 'core/astro-panel.js',      about: 'включённые слои' },
    yasna_astro_collapsed:      { scope: 'prefs', json: false, owner: 'core/astro-panel.js',      about: 'панель свёрнута' },
    yasna_show_cage:            { scope: 'prefs', json: false, owner: 'app.js',                   about: 'показывать сетку' },
    yasna_solid_mech:           { scope: 'prefs', json: false, owner: 'app.js',                   about: 'плотная отрисовка механик' },
    yasna_dp_orient_hidden:     { scope: 'prefs', json: false, owner: 'games/duel/duel-page.js',  about: 'подсказка ориентации скрыта' },
    yasna_sync_notice_dismissed:{ scope: 'prefs', json: false, owner: 'games/duel/duel-page.js',  about: 'уведомление о хранении скрыто' },
    yasna_neg_mode:             { scope: 'prefs', json: false, owner: 'negotiations/spar.js',     about: 'вкладка тренажёра' },
    yasna_neg_level:            { scope: 'prefs', json: false, owner: 'negotiations/spar.js',     about: 'уровень сложности спарринга' },
    yasna_neg_spar_type:        { scope: 'prefs', json: false, owner: 'negotiations/spar.js',     about: 'тип собеседника' },
    yasna_neg_spar_skill:       { scope: 'prefs', json: false, owner: 'negotiations/spar.js',     about: 'тренируемый навык' },
    yasna_neg_engine:           { scope: 'prefs', json: false, owner: 'negotiations/spar.js',     about: 'движок спарринга' },
    yasna_negc_tab:             { scope: 'prefs', json: false, owner: 'negotiations/contact-trainer.js', about: 'активная вкладка' },
    yasna_nedavnie_v1:          { scope: 'prefs', json: true,  owner: 'app.js',                  about: 'недавно открытые ясны' },
    yasna_skrytye_v1:           { scope: 'prefs', json: true,  owner: 'app.js',                  about: 'скрытые карточки' },
    yasna_citata_push:          { scope: 'prefs', json: false, owner: 'app/citaty.js',           about: 'утренняя цитата включена' },

    // ── производное / не выгружаем ──
    yasna_duel_pending:            { scope: 'cache',  json: true,  owner: 'games/duel/duel.js',        about: 'очередь неотправленных матчей' },
    yasna_content_overrides_cache_v1: { scope: 'cache', json: true, owner: 'core/content-store.js',    about: 'кэш Tier-2 контента' },
    yasna_admin_overrides:         { scope: 'cache',  json: true,  owner: 'admin.js',                  about: 'черновики админки (не прогресс игрока)' },
    yasna2:                        { scope: 'cache',  json: true,  owner: 'core/yasna-star.js',        about: 'состояние звезды' },
    yasna_sync_state_v1:           { scope: 'cache',  json: true,  owner: 'core/storage.js',           about: 'состояние синхронизации: rev и подписи по ключам' },
    yasna_sync_conflicts_v1:       { scope: 'cache',  json: true,  owner: 'core/storage.js',           about: 'журнал расхождений: локальные версии, вытесненные серверными' },
    yasna_access_declared_v1:      { scope: 'cache',  json: true,  owner: 'core/access.js',            about: 'черновик каталога доступов, объявленный разделами' },
    yasna_spar_proxy_v1:           { scope: 'cache',  json: false, owner: 'negotiations/spar.js',      about: 'найденный адрес прокси спарринга' },
    yasna_druzya_kartochka_v1:     { scope: 'cache',  json: true,  owner: 'core/druzya.js',            about: 'слепок своей карточки: что уже записано в базе' },
    yasna_obnova_kogda:            { scope: 'cache',  json: false, owner: 'app/obnovlenie.js',         about: 'когда последний раз смотрели, не вышла ли версия' },
    yasna_obnova_otlozheno:        { scope: 'cache',  json: false, owner: 'app/obnovlenie.js',         about: 'версия, обновление до которой отложили' },
    yasna_obnova_kesh:             { scope: 'cache',  json: true,  owner: 'app/obnovlenie.js',         about: 'последний прочитанный манифест версии' },
    yasna_stek_zerkalo_v1:         { scope: 'cache',  json: true,  owner: 'app/navigatsiya.js',        about: 'зеркало стека «назад» на полчаса (WebView убивают вместе с сессией)' },

    // ── живёт в sessionStorage: до закрытия вкладки, в снапшот не идёт ──
    // Держим в реестре, чтобы перечень ключей был полным: иначе линтер сборки
    // ругался бы на них при каждом чтении, а человек — гадал, что это за ключи.
    yasna_stek_v1:                 { scope: 'cache', json: true,  store: 'session', owner: 'app/navigatsiya.js', about: 'стек «назад» по экранам' },
    yasna_otkuda_v1:               { scope: 'cache', json: true,  store: 'session', owner: 'app/navigatsiya.js', about: 'вершина стека для окон Справки и Словаря' },
    yasna_urok_otkuda:             { scope: 'cache', json: false, store: 'session', owner: 'learn.html',         about: 'урок открыт с экрана «Уроки»' },
    yasna_zastavka:                { scope: 'cache', json: false, store: 'session', owner: 'app/glavnaya.html',  about: 'заставку в этот заход уже показали' },

    // ── секреты: НИКОГДА не попадают в экспорт ──
    yasna_admin_pwd_v1:         { scope: 'secret', json: false, owner: 'admin.js',                about: 'пароль публикации контента', sensitive: true },
    yasna_neg_aikey:            { scope: 'secret', json: false, owner: 'negotiations/spar.js',     about: 'пользовательский ключ LLM', sensitive: true },
    // Признак «пароль сайта введён». Не выгружаем и не принимаем из снапшота:
    // иначе файл снапшота работал бы ключом от закрытых страниц.
    yasna_gate_pass:            { scope: 'secret', json: false, owner: 'core/gate.js',             about: 'пароль сайта введён на этом устройстве', sensitive: true }
  };

  // Динамические ключи по префиксу — их нельзя перечислить заранее.
  var PREFIXES = [
    { prefix: 'yasna_reflection_', scope: 'progress', json: false, owner: 'lessons/engine.js', about: 'личные заметки к уроку (по одному ключу на урок)' },
    // Прогресс чтения книг: ключ на книгу (yasna_kniga_v1 — Сутки,
    // yasna_kniga_goda_v1, yasna_kniga_zhizni_v1 и все следующие). Книг будет
    // больше, поэтому префикс, а не три литерала.
    { prefix: 'yasna_kniga_',      scope: 'progress', json: true,  owner: 'kniga.html',        about: 'прочитанные узлы книги и кегль' },
    { prefix: 'yasna_ekran_v1:',   scope: 'cache',    json: true,  owner: 'core/pamyat-ekrana.js', about: 'память экрана: прокрутка и раскрытые части' },
    { prefix: 'yasna_storage_migrated_v', scope: 'cache', json: false, owner: 'core/storage.js', about: 'отметка о выполненной миграции' }
  ];

  var SCOPES_IN_SNAPSHOT = { creation: 1, progress: 1, prefs: 1 };

  // ─── низкоуровневый доступ ───────────────────────────────────────
  function ls() {
    try { return window.localStorage; } catch (_) { return null; }
  }
  // Доступен ли storage вообще (Safari private mode, отключённые куки)
  function available() {
    var s = ls();
    if (!s) return false;
    try { s.setItem('__yasna_probe', '1'); s.removeItem('__yasna_probe'); return true; }
    catch (_) { return false; }
  }

  function meta(key) {
    if (KEYS[key]) return KEYS[key];
    for (var i = 0; i < PREFIXES.length; i++) {
      if (key.indexOf(PREFIXES[i].prefix) === 0) return PREFIXES[i];
    }
    return null;
  }

  function getRaw(key) {
    var s = ls(); if (!s) return null;
    try { return s.getItem(key); } catch (_) { return null; }
  }

  function setRaw(key, str) {
    var s = ls(); if (!s) return false;
    try { s.setItem(key, str); return true; }
    catch (e) {
      // Раньше подобные ошибки глотались молча и данные терялись без следа.
      console.warn('[storage] не удалось записать ' + key + ': ' + ((e && e.name) || e));
      return false;
    }
  }

  function get(key, fallback) {
    var m = meta(key);
    var raw = getRaw(key);
    if (raw === null || raw === undefined) return fallback;
    if (m && m.json) {
      try { return JSON.parse(raw); } catch (_) { return fallback; }
    }
    return raw;
  }

  function set(key, value) {
    var m = meta(key);
    var str = (m && m.json) ? JSON.stringify(value) : String(value);
    return setRaw(key, str);
  }

  function remove(key) {
    var s = ls(); if (!s) return;
    try { s.removeItem(key); } catch (_) {}
  }

  // ─── экспорт снапшота ────────────────────────────────────────────
  // Страховка ДО любых миграций и основа для «перенести прогресс в аккаунт».
  // Секреты и кэш не выгружаем: первое — небезопасно, второе — восстановимо.
  function exportAll() {
    var s = ls();
    var out = { version: SNAPSHOT_VERSION, exportedAt: new Date().toISOString(), data: {} };
    if (!s) return out;
    var k, i;
    for (k in KEYS) {
      if (!SCOPES_IN_SNAPSHOT[KEYS[k].scope] || KEYS[k].sensitive) continue;
      var raw = getRaw(k);
      if (raw !== null && raw !== undefined) out.data[k] = raw;
    }
    // идентичность — отдельно и осознанно (нужна, чтобы связать устройство)
    var prof = getRaw('yasna_duel_profile');
    var dev = getRaw('yasna_device_id_v1');
    var devSecret = getRaw('yasna_device_secret_v1');
    if (prof || dev) {
      out.identity = {};
      if (prof) out.identity.yasna_duel_profile = prof;
      // без id устройства перенесённый снапшот отвязан от серверного прогресса
      if (dev) out.identity.yasna_device_id_v1 = dev;
      // Секрет устройства кладём осознанно, хотя ключ и помечен sensitive:
      // без него перенос на другое устройство получит 403 на своём же гостевом
      // прогрессе. Значит файл снапшота — личный: он и так содержит весь
      // прогресс и заметки, а теперь ещё и доступ к серверной копии.
      if (devSecret) out.identity.yasna_device_secret_v1 = devSecret;
    }
    // динамические ключи (заметки к урокам, прогресс чтения книг)
    // Scope у префиксов проверяем так же, как у реестровых ключей: среди них
    // есть и производные (память экрана, отметки миграций) — им в снапшоте
    // делать нечего, а импорт всё равно отверг бы их как cache.
    try {
      for (i = 0; i < s.length; i++) {
        var key = s.key(i);
        if (!key) continue;
        for (var p = 0; p < PREFIXES.length; p++) {
          if (key.indexOf(PREFIXES[p].prefix) !== 0) continue;
          if (!SCOPES_IN_SNAPSHOT[PREFIXES[p].scope] || PREFIXES[p].sensitive) continue;
          out.data[key] = getRaw(key);
        }
      }
    } catch (_) {}
    return out;
  }

  // Импорт снапшота. merge=true (по умолчанию) — НЕ затирать существующее:
  // при переносе на устройство, где уже что-то есть, потеря недопустима.
  function importAll(snapshot, opts) {
    var o = opts || {};
    var merge = o.merge !== false;
    var res = { written: 0, skipped: 0, rejected: 0 };
    if (!snapshot || !snapshot.data || typeof snapshot.data !== 'object') {
      res.error = 'снапшот пустой или неверного формата';
      return res;
    }
    if (snapshot.version > SNAPSHOT_VERSION) {
      res.error = 'снапшот версии ' + snapshot.version + ' новее поддерживаемой (' + SNAPSHOT_VERSION + ')';
      return res;
    }
    for (var k in snapshot.data) {
      var m = meta(k);
      // store:'session' — ключ живёт в sessionStorage; писать его в localStorage
      // значит завести двойника, который переживёт вкладку и начнёт спорить.
      if (!m || m.sensitive || m.store === 'session' || m.scope === 'cache' || m.scope === 'secret') { res.rejected++; continue; }
      if (merge && getRaw(k) !== null) { res.skipped++; continue; }
      if (setRaw(k, String(snapshot.data[k]))) res.written++;
    }

    // Идентичность лежит в отдельном блоке snapshot.identity, и раньше импорт
    // её просто НЕ ЧИТАЛ: снапшот восстанавливался, но устройство оставалось
    // «другим», то есть отвязанным от своей же серверной копии прогресса.
    // Восстанавливаем только по явному запросу и только если своей идентичности
    // ещё нет — иначе перенос затирал бы аккаунт на рабочем устройстве.
    if (o.identity && snapshot.identity && typeof snapshot.identity === 'object') {
      res.identity = { written: 0, skipped: 0 };
      var idKeys = ['yasna_device_id_v1', 'yasna_device_secret_v1', 'yasna_duel_profile'];
      for (var j = 0; j < idKeys.length; j++) {
        var ik = idKeys[j];
        if (!snapshot.identity[ik]) continue;
        if (getRaw(ik) !== null) { res.identity.skipped++; continue; }
        if (setRaw(ik, String(snapshot.identity[ik]))) res.identity.written++;
      }
      // Версии синхронизации относятся к прежнему устройству — сбрасываем,
      // чтобы следующий pull сравнивал с чистого листа.
      if (res.identity.written) remove(SYNC_STATE_KEY);
    }
    return res;
  }

  // ─── каркас миграций ────────────────────────────────────────────
  // Пока пуст сознательно: переименования ключей появятся при переходе на
  // серверный прогресс. Важно, что точка для них уже есть и вызывается один раз.
  var MIGRATIONS = [];
  var MIGRATION_KEY = 'yasna_storage_migrated_v';
  function runMigrations() {
    for (var i = 0; i < MIGRATIONS.length; i++) {
      var mk = MIGRATION_KEY + (i + 1);
      if (getRaw(mk)) continue;
      try { MIGRATIONS[i](); setRaw(mk, '1'); }
      catch (e) { console.warn('[storage] миграция ' + (i + 1) + ' не удалась: ' + ((e && e.message) || e)); break; }
    }
  }

  // ─── наблюдение (в т.ч. между вкладками) ────────────────────────
  var subs = [];
  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    subs.push(cb);
    return function () { var i = subs.indexOf(cb); if (i > -1) subs.splice(i, 1); };
  }
  try {
    window.addEventListener('storage', function (e) {
      if (!e || !e.key || e.key.indexOf('yasna') !== 0) return;
      subs.forEach(function (cb) { try { cb(e.key, e.newValue); } catch (_) {} });
    });
  } catch (_) {}

  // ─── диагностика ────────────────────────────────────────────────
  function report() {
    var s = ls();
    var r = { available: available(), byScope: {}, unknown: [], totalBytes: 0 };
    if (!s) return r;
    try {
      for (var i = 0; i < s.length; i++) {
        var key = s.key(i); if (!key || key.indexOf('yasna') !== 0) continue;
        var raw = getRaw(key) || '';
        r.totalBytes += key.length + raw.length;
        var m = meta(key);
        if (!m) { r.unknown.push(key); continue; }   // ключ есть в проде, но не в реестре
        r.byScope[m.scope] = (r.byScope[m.scope] || 0) + 1;
      }
    } catch (_) {}
    return r;
  }

  // ═══════════════════════════════════════════════════════════════
  // СИНХРОНИЗАЦИЯ С СЕРВЕРОМ (GET/PUT /progress)
  //
  // Уезжают только scope progress и creation. Тема, черновики админки,
  // очередь неотправленных матчей и пользовательские ключи LLM остаются
  // локальными: серверу они не нужны, а секреты там и вовсе не должны быть.
  //
  // ВЛАДЕЛЕЦ ЗАПИСИ на сервере — user_id, если есть валидный токен, иначе
  // deviceId. Поэтому гость тоже сохраняется, а при первом входе через
  // Telegram сервер переносит прогресс устройства на аккаунт.
  //
  // ПЕРВАЯ СИНХРОНИЗАЦИЯ на устройстве, где ЕСТЬ локальные данные и на
  // сервере ТОЖЕ есть данные по этому ключу — единственный по-настоящему
  // спорный случай. Автоматически «угадывать», где прогресс «больше»,
  // нельзя: у пяти разделов пять разных форматов. Поэтому берём серверную
  // версию (она общая для всех устройств), а локальную НЕ выбрасываем —
  // складываем в yasna_sync_conflicts_v1, откуда её можно вернуть
  // (sync.resolveKeepLocal). Молча потерянных данных не остаётся.
  // ═══════════════════════════════════════════════════════════════
  var SYNC_SCOPES = { progress: 1, creation: 1 };
  var SYNC_STATE_KEY = 'yasna_sync_state_v1';
  var SYNC_CONFLICTS_KEY = 'yasna_sync_conflicts_v1';
  var NOTE_PREFIX = 'yasna_reflection_';
  var PUSH_DEBOUNCE_MS = 4000;
  var POLL_MS = 45000;          // тихая проверка «что-то изменилось?»

  function apiBase() {
    try {
      var el = document.querySelector('meta[name="yasna:api"]');
      var fromMeta = el ? el.getAttribute('content') : '';
      return fromMeta || window.YASNA_LEADERBOARD_API || '';
    } catch (_) { return ''; }
  }

  function syncState() {
    var st = get(SYNC_STATE_KEY, null);
    if (!st || typeof st !== 'object') st = {};
    if (!st.revs) st.revs = {};
    if (!st.sigs) st.sigs = {};
    if (!st.noteAt) st.noteAt = {};
    return st;
  }
  function saveSyncState(st) { set(SYNC_STATE_KEY, st); }

  // Дешёвая подпись значения — чтобы не гонять на сервер неизменившееся.
  function sig(str) {
    var h = 5381, i;
    for (i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return String(str.length) + ':' + h;
  }

  // ЕДИНЫЙ идентификатор устройства.
  // Раньше deviceId существовал только внутри профиля игры (yasna_duel_profile),
  // а он создаётся при онбординге в «Партии». Человек, который проходит только
  // уроки и в игры не заходит, deviceId не получал вовсе — то есть его прогресс
  // синхронизировать было НЕЧЕМ. Поэтому идентификатор вынесен в отдельный ключ:
  //   • если профиль игры уже есть — берём его deviceId (у действующих
  //     пользователей идентичность не меняется) и зеркалим в общий ключ;
  //   • если профиля нет — создаём общий ключ сами, а duel.js его подхватывает
  //     (_genDeviceId), поэтому позже профиль игры получит ТОТ ЖЕ id и прогресс
  //     гостя не расщепится на два владельца.
  var DEVICE_KEY = 'yasna_device_id_v1';
  function genDeviceId() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
    return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function deviceId() {
    var prof = get('yasna_duel_profile', null);
    var fromProfile = (prof && prof.deviceId) || null;
    var shared = getRaw(DEVICE_KEY);
    if (fromProfile) {
      if (shared !== fromProfile) setRaw(DEVICE_KEY, fromProfile);
      return fromProfile;
    }
    if (shared) return shared;
    var fresh = genDeviceId();
    setRaw(DEVICE_KEY, fresh);
    return fresh;
  }

  // Секрет устройства — доказательство «это то же устройство» для гостевого
  // прогресса. Без него хватало ЗНАНИЯ deviceId, чтобы прочитать и затереть
  // чужой прогресс: дыра была воспроизведена на живом сервере. Секрет создаётся
  // здесь, на сервер уходит только его sha256 (заголовок X-Device-Secret,
  // не query — строки запроса попадают в логи шлюза).
  var DEVICE_SECRET_KEY = 'yasna_device_secret_v1';
  function deviceSecret() {
    var s = getRaw(DEVICE_SECRET_KEY);
    if (s) return s;
    var fresh = '';
    try {
      if (window.crypto && crypto.getRandomValues) {
        var buf = new Uint8Array(32);
        crypto.getRandomValues(buf);
        for (var i = 0; i < buf.length; i++) fresh += ('0' + buf[i].toString(16)).slice(-2);
      }
    } catch (_) {}
    if (!fresh) fresh = 'r' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    setRaw(DEVICE_SECRET_KEY, fresh);
    return fresh;
  }

  function identity() {
    var tok = getRaw('yasna_duel_token') || null;
    var st = syncState();
    // deviceId вместе с ТОКЕНОМ отправляем только до первого успешного переноса
    // гостевого прогресса на аккаунт. Раньше он уходил в каждом запросе, а
    // сервер на каждом обращении копировал строки dev:<id> в аккаунт там, где у
    // аккаунта пусто. На общем компьютере это означало, что гостевые данные
    // предыдущего человека подливались следующему вошедшему — раз за разом.
    var claimDone = tok && st.claimedBy && st.ownerKey && st.claimedBy === st.ownerKey;
    return {
      deviceId: (tok && claimDone) ? null : deviceId(),
      secret: deviceSecret(),
      token: tok
    };
  }

  // Динамический ключ, который надо синхронизировать как обычный item.
  // Заметки к урокам сюда не входят: у них свой канал (user_notes).
  // Нужно затем, что прогресс чтения книг живёт по префиксу yasna_kniga_*, а
  // раньше синхронизация перебирала ТОЛЬКО реестровые ключи — и книги молча
  // оставались на одном устройстве, хотя реестр заведён ровно против этого.
  function prefixSync(key) {
    for (var p = 0; p < PREFIXES.length; p++) {
      var pf = PREFIXES[p];
      if (pf.prefix === NOTE_PREFIX) continue;
      if (key.indexOf(pf.prefix) !== 0) continue;
      if (!SYNC_SCOPES[pf.scope] || pf.sensitive || pf.store === 'session') return null;
      return pf;
    }
    return null;
  }

  // Локальные ключи, подлежащие синхронизации: реестровые нужных scope,
  // динамические по префиксу (прогресс чтения книг) плюс заметки к урокам
  // (они уезжают в user_notes).
  function localSyncable() {
    var s = ls(), items = [], notes = [], k, i;
    for (k in KEYS) {
      if (!SYNC_SCOPES[KEYS[k].scope] || KEYS[k].sensitive || KEYS[k].store === 'session') continue;
      var raw = getRaw(k);
      if (raw === null || raw === undefined) continue;
      items.push({ scope: KEYS[k].scope, itemId: k, state: raw });
    }
    if (s) {
      try {
        for (i = 0; i < s.length; i++) {
          var key = s.key(i);
          if (!key) continue;
          if (key.indexOf(NOTE_PREFIX) === 0) {
            var text = getRaw(key);
            if (text === null) continue;
            notes.push({ itemId: key.slice(NOTE_PREFIX.length), text: text });
            continue;
          }
          var pf = prefixSync(key);
          if (!pf) continue;
          var praw = getRaw(key);
          if (praw === null || praw === undefined) continue;
          items.push({ scope: pf.scope, itemId: key, state: praw });
        }
      } catch (_) {}
    }
    return { items: items, notes: notes };
  }

  function request(method, path, payload) {
    var base = apiBase();
    if (!base) return Promise.resolve(null);
    var id = identity();
    var url = base + path;
    var headers = { 'Content-Type': 'application/json' };
    if (id.token) headers.Authorization = 'Bearer ' + id.token;
    if (id.secret) headers['X-Device-Secret'] = id.secret;
    var opts = { method: method, headers: headers };
    if (payload) opts.body = JSON.stringify(payload);
    return fetch(url, opts).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 120)); });
      return r.json();
    });
  }

  function stashConflict(key, localValue, serverValue) {
    var list = get(SYNC_CONFLICTS_KEY, null);
    if (!Array.isArray(list)) list = [];
    list.push({ key: key, local: localValue, server: serverValue, at: new Date().toISOString() });
    if (list.length > 50) list = list.slice(-50);   // журнал, а не хранилище
    set(SYNC_CONFLICTS_KEY, list);
  }

  var syncing = false;

  // Забрать серверное состояние и применить то, что новее известного нам.
  function pull() {
    if (!available()) return Promise.resolve({ skipped: 'storage unavailable' });
    var id = identity();
    if (!id.deviceId && !id.token) return Promise.resolve({ skipped: 'нет ни deviceId, ни токена' });
    var qs = id.deviceId ? ('?deviceId=' + encodeURIComponent(id.deviceId)) : '';
    return request('GET', '/progress' + qs, null).then(function (data) {
      if (!data) return { skipped: 'нет адреса API' };
      var st = syncState();
      var applied = 0, conflicts = 0, i;

      // Смена владельца (гость вошёл в аккаунт или вышел) обнуляет версии:
      // rev'ы принадлежат КОНКРЕТНОМУ владельцу, и сравнивать их с версиями
      // другого — значит принимать чужой прогресс за свой либо, наоборот,
      // считать своё уже отправленным. После сброса подписи тоже пусты,
      // поэтому следующий push отправит локальные значения целиком.
      if (data.ownerKey && st.ownerKey && data.ownerKey !== st.ownerKey) {
        st.revs = {}; st.sigs = {}; st.noteAt = {};
      }
      st.ownerKey = data.ownerKey || st.ownerKey;

      for (i = 0; i < (data.items || []).length; i++) {
        var it = data.items[i];
        if (!it || !it.itemId) continue;
        var localRaw = getRaw(it.itemId);
        var knownRev = st.revs[it.itemId] || 0;
        var took = false;   // приняли ли мы серверное значение

        if (localRaw === null || localRaw === undefined) {          // локально нет — просто берём
          if (setRaw(it.itemId, it.state)) { applied++; took = true; }
        } else if (localRaw === it.state) {                          // совпадает — нечего делать
          took = true;
        } else if (it.rev > knownRev) {
          // Сервер новее того, что мы видели. Если наша копия отличалась от
          // последней синхронизированной — это расхождение, локальную версию
          // сохраняем в журнал конфликтов, а не выбрасываем.
          if (st.sigs[it.itemId] && st.sigs[it.itemId] !== sig(localRaw)) {
            stashConflict(it.itemId, localRaw, it.state); conflicts++;
          } else if (!st.sigs[it.itemId]) {
            stashConflict(it.itemId, localRaw, it.state); conflicts++;   // первая синхронизация
          }
          if (setRaw(it.itemId, it.state)) { applied++; took = true; }
        }

        // ВЕРСИЮ И ПОДПИСЬ ОБНОВЛЯЕМ ТОЛЬКО ТАМ, ГДЕ СЕРВЕРНОЕ ЗНАЧЕНИЕ ПРИНЯТО.
        // Раньше обе строки стояли безусловно, и в случае «локально другое, но
        // сервер не новее» подпись подделывалась под ЛОКАЛЬНОЕ значение. Push
        // отбирает изменения ровно по этой подписи — значит неотправленные
        // правки (офлайн, упавший запрос, закрытая вкладка) навсегда считались
        // отправленными и не уезжали никогда. А поскольку pull в start() идёт
        // ПЕРЕД push, каждая загрузка страницы затирала подписи до отправки.
        if (took) {
          st.revs[it.itemId] = it.rev;
          st.sigs[it.itemId] = sig(getRaw(it.itemId) || '');
        }
      }

      for (i = 0; i < (data.notes || []).length; i++) {
        var n = data.notes[i];
        if (!n || !n.itemId) continue;
        var nk = NOTE_PREFIX + n.itemId;
        var localText = getRaw(nk);
        var seenAt = st.noteAt[n.itemId] || '';
        if (localText === null || localText === undefined) { if (setRaw(nk, n.text)) applied++; }
        else if (localText !== n.text && String(n.updatedAt || '') > seenAt) {
          stashConflict(nk, localText, n.text); conflicts++;
          if (setRaw(nk, n.text)) applied++;
        }
        st.noteAt[n.itemId] = n.updatedAt || new Date().toISOString();
      }

      st.entitlements = data.entitlements || [];
      // Права — готовое решение сервера (роль, полномочия, маски, каталог).
      // core/access.js читает их ОТСЮДА: своих запросов у него нет. Поля
      // пишем только когда сервер их прислал: старая версия функции без них
      // не должна затирать уже известные права пустотой.
      if (data.role !== undefined || data.access !== undefined) {
        st.role = data.role || null;
        st.caps = data.caps || [];
        st.access = data.access || {};
        st.accessWhy = data.accessWhy || {};
        st.features = data.features || [];
      }
      st.isUser = !!data.isUser;
      // Перенос гостевых данных на аккаунт нужен ОДИН раз; дальше deviceId не
      // отправляем (см. identity), иначе чужой гостевой прогресс подливается.
      if (data.isUser && data.ownerKey) st.claimedBy = data.ownerKey;
      st.lastPull = new Date().toISOString();
      st.lastError = null;
      saveSyncState(st);
      return { applied: applied, conflicts: conflicts, items: (data.items || []).length };
    }).catch(function (e) {
      var st = syncState(); st.lastError = String(e && e.message || e); saveSyncState(st);
      return { error: st.lastError };
    });
  }

  // Отправить то, что изменилось с прошлой отправки.
  function push(opts) {
    var o = opts || {};
    if (!available()) return Promise.resolve({ skipped: 'storage unavailable' });
    var id = identity();
    if (!id.deviceId && !id.token) return Promise.resolve({ skipped: 'нет ни deviceId, ни токена' });

    var st = syncState();
    var local = localSyncable();
    var items = [], notes = [], i;

    for (i = 0; i < local.items.length; i++) {
      var it = local.items[i];
      var s2 = sig(it.state);
      if (!o.force && st.sigs[it.itemId] === s2) continue;      // не изменилось
      items.push({ scope: it.scope, itemId: it.itemId, state: it.state, rev: st.revs[it.itemId] || 0 });
    }
    for (i = 0; i < local.notes.length; i++) {
      var n = local.notes[i];
      var nsig = sig(n.text);
      if (!o.force && st.sigs[NOTE_PREFIX + n.itemId] === nsig) continue;
      notes.push({ itemId: n.itemId, text: n.text });
    }
    if (!items.length && !notes.length) return Promise.resolve({ saved: 0, nothing: true });

    var payload = { items: items, notes: notes };
    if (id.deviceId) payload.deviceId = id.deviceId;

    // Снимок ОТПРАВЛЕННЫХ значений. Подпись после ответа считается по нему, а
    // не по тому, что лежит в localStorage в момент ответа: пока запрос летит,
    // человек продолжает играть, и прежний код помечал синхронизированным
    // значение, которое сервер никогда не видел — эти правки терялись.
    var sentItems = {}, sentNotes = {};
    for (i = 0; i < items.length; i++) sentItems[items[i].itemId] = items[i].state;
    for (i = 0; i < notes.length; i++) sentNotes[notes[i].itemId] = notes[i].text;

    return request('PUT', '/progress', payload).then(function (data) {
      if (!data) return { skipped: 'нет адреса API' };
      var st2 = syncState(), k;
      for (k in (data.revs || {})) {
        var itemId = k.slice(k.indexOf('/') + 1);
        st2.revs[itemId] = data.revs[k];
        if (Object.prototype.hasOwnProperty.call(sentItems, itemId)) {
          st2.sigs[itemId] = sig(sentItems[itemId]);
        }
      }
      // Конфликты: сервер вернул свою версию — принимаем её, свою сохраняем.
      for (var c = 0; c < (data.conflicts || []).length; c++) {
        var cf = data.conflicts[c];
        var cur = getRaw(cf.itemId);
        if (cur !== null && cur !== cf.state) stashConflict(cf.itemId, cur, cf.state);
        setRaw(cf.itemId, cf.state);
        st2.revs[cf.itemId] = cf.rev;
        st2.sigs[cf.itemId] = sig(cf.state);
      }
      // Отвергнутое сервером (слишком большое, неподдерживаемый scope) помечаем,
      // чтобы не гонять его в каждом цикле синхронизации бесконечно. Причина
      // видна в sync.status().rejected — молчания здесь быть не должно.
      st2.rejected = {};
      for (var r = 0; r < (data.rejected || []).length; r++) {
        var rj = data.rejected[r];
        var rid = rj.itemId || rj.item_id;
        if (!rid) continue;
        st2.rejected[rid] = rj.why || 'отвергнуто сервером';
        if (Object.prototype.hasOwnProperty.call(sentItems, rid)) {
          st2.sigs[rid] = sig(sentItems[rid]);
        }
      }
      for (var m = 0; m < notes.length; m++) {
        if (st2.rejected[NOTE_PREFIX + notes[m].itemId]) continue;
        st2.sigs[NOTE_PREFIX + notes[m].itemId] = sig(sentNotes[notes[m].itemId]);
        st2.noteAt[notes[m].itemId] = new Date().toISOString();
      }
      st2.lastPush = new Date().toISOString();
      st2.lastError = null;
      st2.isUser = !!data.isUser;
      if (data.isUser && data.ownerKey) st2.claimedBy = data.ownerKey;
      st2.ownerKey = data.ownerKey || st2.ownerKey;
      saveSyncState(st2);
      return {
        saved: data.saved || 0, notesSaved: data.notesSaved || 0,
        conflicts: (data.conflicts || []).length, rejected: (data.rejected || []).length
      };
    }).catch(function (e) {
      var st3 = syncState(); st3.lastError = String(e && e.message || e); saveSyncState(st3);
      return { error: st3.lastError };
    });
  }

  // Стереть ВСЁ, что относится к учебному прогрессу этого человека.
  //
  // ЗАЧЕМ. Выход из аккаунта раньше убирал только токен, и на общем компьютере
  // это приводило к утечке: ключи прогресса и личные заметки оставались в
  // localStorage, а следующий вошедший отправлял их на сервер уже под СВОИМ
  // аккаунтом. Проверено на живом сервере: во втором аккаунте оказались уроки и
  // заметка первого человека. Поэтому при выходе локальная копия обязана
  // исчезнуть — на сервере она уже сохранена и вернётся при следующем входе.
  //
  // Сначала ОТПРАВЛЯЕМ несохранённое, потом стираем: иначе выход в офлайне
  // означал бы потерю того, что человек только что прошёл.
  function clearSynced(opts) {
    var o = opts || {};
    var doClear = function () {
      var s = ls();
      var removed = 0, k, i;
      for (k in KEYS) {
        if (!SYNC_SCOPES[KEYS[k].scope] || KEYS[k].store === 'session') continue;
        if (getRaw(k) !== null) { remove(k); removed++; }
      }
      if (s) {
        var kill = [];
        try {
          for (i = 0; i < s.length; i++) {
            var key = s.key(i);
            if (!key) continue;
            // И заметки, и прогресс чтения книг: на общем телефоне следующий
            // вошедший не должен увидеть, докуда дочитал предыдущий.
            if (key.indexOf(NOTE_PREFIX) === 0 || prefixSync(key)) kill.push(key);
          }
        } catch (_) {}
        for (i = 0; i < kill.length; i++) { remove(kill[i]); removed++; }
      }
      remove(SYNC_STATE_KEY);
      remove(SYNC_CONFLICTS_KEY);
      return { removed: removed };
    };
    if (o.push === false || !apiBase()) return Promise.resolve(doClear());
    // push может не пройти (нет сети) — стираем всё равно: держать чужие данные
    // в браузере опаснее, чем потерять несинхронизированный хвост.
    return push().then(doClear, doClear);
  }

  // Вернуть локальную версию из журнала конфликтов и навязать её серверу.
  function resolveKeepLocal(key) {
    var list = get(SYNC_CONFLICTS_KEY, null);
    if (!Array.isArray(list)) return { error: 'конфликтов нет' };
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].key !== key) continue;
      setRaw(key, list[i].local);
      var st = syncState();
      // rev не трогаем: следующий push отправит с известным rev, и сервер
      // примет запись, если с тех пор его версия не менялась.
      st.sigs[key] = null;
      saveSyncState(st);
      list.splice(i, 1);
      set(SYNC_CONFLICTS_KEY, list);
      return push({ force: false });
    }
    return { error: 'для ключа ' + key + ' конфликта не найдено' };
  }

  // Обратное решение: серверная версия уже применена при pull, поэтому
  // здесь достаточно убрать отложенную локальную копию из журнала.
  function resolveKeepServer(key) {
    var list = get(SYNC_CONFLICTS_KEY, null);
    if (!Array.isArray(list)) return { error: 'конфликтов нет' };
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].key !== key) continue;
      list.splice(i, 1);
      set(SYNC_CONFLICTS_KEY, list);
      return { ok: true };
    }
    return { error: 'для ключа ' + key + ' конфликта не найдено' };
  }

  function conflicts() { var l = get(SYNC_CONFLICTS_KEY, null); return Array.isArray(l) ? l : []; }
  function status() {
    var st = syncState();
    return {
      ownerKey: st.ownerKey || null, isUser: !!st.isUser,
      lastPull: st.lastPull || null, lastPush: st.lastPush || null,
      lastError: st.lastError || null, conflicts: conflicts().length,
      // отвергнутое сервером видно наружу: молча терять данные нельзя
      rejected: st.rejected || {},
      entitlements: st.entitlements || [], configured: !!apiBase()
    };
  }

  // ─── автосинхронизация ───────────────────────────────────────────
  // События 'storage' срабатывают ТОЛЬКО для других вкладок, поэтому на них
  // одних полагаться нельзя: свои же изменения так не поймать. Отсюда тихий
  // опрос подписей раз в POLL_MS плюс отправка при уходе со страницы.
  var pushTimer = null, started = false;
  function schedule(delay) {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      if (syncing) return;
      syncing = true;
      push().then(function () { syncing = false; }, function () { syncing = false; });
    }, delay == null ? PUSH_DEBOUNCE_MS : delay);
  }

  function start() {
    if (started || !available()) return;
    started = true;
    setTimeout(function () { pull().then(function () { schedule(1500); }); }, 1200);
    setInterval(function () { schedule(0); }, POLL_MS);
    onChange(function () { schedule(); });
    try {
      window.addEventListener('pagehide', function () { push(); });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') push();
      });
    } catch (_) {}
  }

  window.YasnaStorage = {
    KEYS: KEYS,
    PREFIXES: PREFIXES,
    available: available,
    get: get,
    set: set,
    remove: remove,
    exportAll: exportAll,
    importAll: importAll,
    runMigrations: runMigrations,
    onChange: onChange,
    report: report,
    // Секрет устройства нужен и играм: /submit требует доказательство
    // (JWT либо X-Device-Secret), иначе рейтинг набивался curl'ом.
    // Функция сама создаёт секрет при первом вызове — игра без единой
    // синхронизации прогресса всё равно получит рабочее доказательство.
    deviceSecret: deviceSecret,
    SNAPSHOT_VERSION: SNAPSHOT_VERSION,
    sync: {
      pull: pull,
      push: push,
      start: start,
      schedule: schedule,
      status: status,
      conflicts: conflicts,
      resolveKeepLocal: resolveKeepLocal,
      resolveKeepServer: resolveKeepServer,
      clearSynced: clearSynced,
      SCOPES: SYNC_SCOPES
    }
  };

  try { runMigrations(); } catch (_) {}
  try { start(); } catch (e) { console.warn('[storage] автосинхронизация не запустилась: ' + ((e && e.message) || e)); }
})();
