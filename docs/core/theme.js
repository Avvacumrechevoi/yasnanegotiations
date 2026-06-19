/* ═══════════════════════════════════════════════════════════════════
   core/theme.js — ЕДИНЫЙ источник истины темы для всего сайта Ясны.
   Один ключ localStorage: 'yasna_theme' = 'light' | 'dark' | 'auto'.
   - apply(): ставит <html data-theme="light|dark"> + style.colorScheme.
   - set(mode)/cycle(): сохраняет выбор и применяет.
   - onChange(cb): подписка (cb получает 'light'|'dark').
   - Миграция со старых ключей (yasna_theme_vk_dark '1'/'0', yasna_neg_theme).
   - Зеркалит выбор обратно в старые ключи — чтобы НЕ переписывать рендер-
     механику конструктора (theme-vk-dark), игры (vk-light) и тренажёра
     (neg-light): их inline-guard'ы читают единый ключ и зовут адаптер.
   - Live-синк между вкладками (storage) + режим auto (matchMedia).
   Страница может задать window.YasnaThemeAdapter = function(d){…} ДО загрузки
   модуля — он вызовется при каждом применении (для body-классов движков).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var KEY = 'yasna_theme';
  var mql = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')) || null;
  var subs = [];

  function read() { try { return localStorage.getItem(KEY); } catch (_) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (_) {} }

  // Одноразовый импорт старых ключей в единый (если единого ещё нет).
  function migrate() {
    if (read()) return;
    try {
      var vk = localStorage.getItem('yasna_theme_vk_dark');   // '1'=тёмная, '0'=светлая
      var ng = localStorage.getItem('yasna_neg_theme');       // 'dark' | 'light'
      var m = null;
      if (vk === '1') m = 'dark'; else if (vk === '0') m = 'light';
      if (!m && (ng === 'dark' || ng === 'light')) m = ng;
      if (m) write(m);
    } catch (_) {}
  }

  function mode() { return read() || 'auto'; }
  function resolve() {
    var m = mode();
    if (m === 'auto') return (mql && mql.matches) ? 'dark' : 'light';
    return m === 'dark' ? 'dark' : 'light';
  }
  // Зеркало в старые ключи — чтобы любой не-переписанный читатель работал.
  function mirror(d) {
    try {
      localStorage.setItem('yasna_theme_vk_dark', d === 'dark' ? '1' : '0');
      localStorage.setItem('yasna_neg_theme', d);
    } catch (_) {}
  }

  function apply() {
    var d = resolve();
    var e = document.documentElement;
    e.setAttribute('data-theme', d);
    try { e.style.colorScheme = d; } catch (_) {}
    if (typeof window.YasnaThemeAdapter === 'function') { try { window.YasnaThemeAdapter(d); } catch (_) {} }
    for (var i = 0; i < subs.length; i++) { try { subs[i](d); } catch (_) {} }
  }

  function set(m) { write(m); mirror(resolve()); apply(); }
  function cycle() { set(resolve() === 'dark' ? 'light' : 'dark'); }   // 2 позиции: свет ⇄ тьма
  function onChange(cb) { if (typeof cb === 'function') { subs.push(cb); } }

  // init: импорт старого выбора + применение (на случай миграции/иного источника)
  migrate();
  mirror(resolve());
  apply();
  if (mql && mql.addEventListener) {
    mql.addEventListener('change', function () { if (mode() === 'auto') apply(); });
  }
  window.addEventListener('storage', function (ev) { if (!ev.key || ev.key === KEY) apply(); });
  // если модуль загружен до <body> — повторим адаптер, когда body появится
  if (!document.body && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  }

  window.Theme = { mode: mode, resolve: resolve, set: set, cycle: cycle, onChange: onChange, apply: apply };
})();
