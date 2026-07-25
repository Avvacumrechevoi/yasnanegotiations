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

    // ── учебный прогресс ──
    yasna_completed_lessons_v1: { scope: 'progress', json: true,  owner: 'app.js',             about: 'пройденные уроки курса' },
    yasna_course_progress:      { scope: 'progress', json: true,  owner: 'learn.html',         about: 'прогресс по карте курса' },
    yasna_path_stats:           { scope: 'progress', json: true,  owner: 'start.html',         about: 'статистика пути' },
    yasna_learn_intro_done_v1:  { scope: 'progress', json: false, owner: 'learn.html',         about: 'вводный экран обучения пройден' },
    yasna_visited:              { scope: 'progress', json: false, owner: 'start.html',         about: 'был ли первый визит' },

    // ── игровой прогресс ──
    yasna_duel_data:            { scope: 'progress', json: true,  owner: 'games/duel/duel.js', about: 'история партий, бусины, мастерство по темам' },
    yasna_duel_achievements:    { scope: 'progress', json: true,  owner: 'games/duel/duel.js', about: 'достижения' },
    yasna_duel_daily:           { scope: 'progress', json: true,  owner: 'games/duel/duel.js', about: 'дневной вызов и streak' },
    yasna_seen_questions:       { scope: 'progress', json: true,  owner: 'games/duel/trivia-bank.js', about: 'история показов вопросов (антиповтор)' },

    // ── прогресс тренажёра переговоров ──
    yasna_neg_progress_v1:      { scope: 'progress', json: true,  owner: 'negotiations/trainer.js',        about: 'прогресс дриллов по стадиям' },
    yasna_neg_lessons_v1:       { scope: 'progress', json: true,  owner: 'negotiations/lessons-neg.js',    about: 'пройденные сценарии' },
    yasna_neg_practice_v1:      { scope: 'progress', json: true,  owner: 'negotiations/trainer.js',        about: 'ситуационная практика' },
    yasna_neg_spar_v1:          { scope: 'progress', json: true,  owner: 'negotiations/spar.js',           about: 'прогресс живого спарринга' },
    yasna_negc_v1:              { scope: 'progress', json: true,  owner: 'negotiations/contact-trainer.js', about: 'вход в контакт: встречи' },
    yasna_neg_onb_v1:           { scope: 'progress', json: false, owner: 'negotiations/lessons-neg.js',    about: 'онбординг тренажёра пройден' },

    // ── идентичность ──
    yasna_duel_profile:         { scope: 'identity', json: true,  owner: 'games/duel/duel.js', about: 'гостевой профиль: ник, аватар, deviceId — КЛЮЧ ко всему прогрессу' },
    yasna_duel_user:            { scope: 'identity', json: true,  owner: 'games/duel/duel.js', about: 'залогиненный пользователь (Telegram)' },
    yasna_duel_token:           { scope: 'identity', json: false, owner: 'games/duel/duel.js', about: 'JWT сессии', sensitive: true },

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

    // ── производное / не выгружаем ──
    yasna_duel_pending:            { scope: 'cache',  json: true,  owner: 'games/duel/duel.js',        about: 'очередь неотправленных матчей' },
    yasna_content_overrides_cache_v1: { scope: 'cache', json: true, owner: 'core/content-store.js',    about: 'кэш Tier-2 контента' },
    yasna_admin_overrides:         { scope: 'cache',  json: true,  owner: 'admin.js',                  about: 'черновики админки (не прогресс игрока)' },
    yasna2:                        { scope: 'cache',  json: true,  owner: 'core/yasna-star.js',        about: 'состояние звезды' },

    // ── секреты: НИКОГДА не попадают в экспорт ──
    yasna_admin_pwd_v1:         { scope: 'secret', json: false, owner: 'admin.js',                about: 'пароль публикации контента', sensitive: true },
    yasna_neg_aikey:            { scope: 'secret', json: false, owner: 'negotiations/spar.js',     about: 'пользовательский ключ LLM', sensitive: true }
  };

  // Динамические ключи по префиксу — их нельзя перечислить заранее.
  var PREFIXES = [
    { prefix: 'yasna_reflection_', scope: 'progress', json: false, owner: 'lessons/engine.js', about: 'личные заметки к уроку (по одному ключу на урок)' }
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
    if (prof) out.identity = { yasna_duel_profile: prof };
    // динамические ключи (заметки к урокам)
    try {
      for (i = 0; i < s.length; i++) {
        var key = s.key(i);
        if (!key) continue;
        for (var p = 0; p < PREFIXES.length; p++) {
          if (key.indexOf(PREFIXES[p].prefix) === 0) out.data[key] = getRaw(key);
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
      if (!m || m.sensitive || m.scope === 'cache' || m.scope === 'secret') { res.rejected++; continue; }
      if (merge && getRaw(k) !== null) { res.skipped++; continue; }
      if (setRaw(k, String(snapshot.data[k]))) res.written++;
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
    SNAPSHOT_VERSION: SNAPSHOT_VERSION
  };

  try { runMigrations(); } catch (_) {}
})();
