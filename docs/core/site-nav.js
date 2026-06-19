/* ═══════════════════════════════════════════════════════════════════
   site-nav.js — единый свитчер разделов (Вариант B).
   window.SiteNav.html(current)  → строка разметки бара (.ynav-* классы).
   window.SiteNav.mount(el, cur)  → впрыснуть бар в элемент (для статических
   страниц). React-страницы могут вызвать html() и dangerouslySetInnerHTML,
   либо рендерить те же классы нативно.
   current ∈ 'constructor' | 'game' | 'learn' | 'rating' | 'home' | ''
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  var SECTIONS = [
    { sec:'constructor', label:'Конструктор', href:'index.html'  },
    { sec:'game',        label:'Игра',        href:'duel.html', badge:'NEW' },
    { sec:'learn',       label:'Обучение',    href:'learn.html' },
    { sec:'trainers',    label:'Тренажёры',   href:'trainers.html' }
  ];
  var AVATAR_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.5-3.5 4.5-5 7-5s5.5 1.5 7 5"/></svg>';

  // Кнопка переключения темы — опциональна (opts.theme). Поведение/иконку
  // навешивает сама страница (см. negotiations.html), site-nav даёт только слот.
  var THEME_BTN = '<button class="ynav-theme" id="ynav-theme-btn" type="button"'
    + ' aria-label="Переключить светлую/тёмную тему" title="Светлая / тёмная тема">'
    + '<span class="ynav-theme-ico" aria-hidden="true">☀</span></button>';

  function html(current, opts){
    opts = opts || {};
    var links = SECTIONS.map(function(s){
      var active = s.sec === current ? ' is-active' : '';
      var badge  = s.badge ? '<span class="ynav-new">' + s.badge + '</span>' : '';
      return '<a class="ynav-item' + active + '" href="' + s.href + '" data-sec="' + s.sec + '">' + s.label + badge + '</a>';
    }).join('');
    return ''
      + '<a class="ynav-home" href="start.html" title="На главную — лендинг Ясны">'
      +   '<span class="ynav-mark" aria-hidden="true">✦</span>'
      +   '<span class="ynav-name">Ясна</span>'
      + '</a>'
      + '<nav class="ynav-links" aria-label="Разделы">' + links + '</nav>'
      + (opts.theme === false ? '' : THEME_BTN)   // кнопка темы по умолчанию ЕСТЬ на всех страницах
      + '<a class="ynav-login" href="duel.html#login" title="Войти — прогресс на любом устройстве">'
      +   '<span class="ynav-login-av">' + AVATAR_SVG + '</span>'
      +   '<span class="ynav-login-txt">Войти</span>'
      + '</a>';
  }

  // Иконка показывает, КУДА переключит: в тёмной — ☀ (на светлую), в светлой — 🌙.
  function syncThemeBtn() {
    var ico = document.querySelector('#ynav-theme-btn .ynav-theme-ico');
    if (!ico || !window.Theme) return;
    var dark = window.Theme.resolve() === 'dark';
    ico.textContent = dark ? '☀' : '🌑';
    var btn = document.getElementById('ynav-theme-btn');
    if (btn) btn.setAttribute('title', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
  }

  function wireTheme() {
    var btn = document.getElementById('ynav-theme-btn');
    if (!btn || !window.Theme) return;
    btn.addEventListener('click', function () { window.Theme.cycle(); });
    window.Theme.onChange(syncThemeBtn);
    syncThemeBtn();
  }

  function mount(el, current, opts){
    if (typeof el === 'string') el = document.getElementById(el);
    if (el) el.innerHTML = html(current, opts);
    wireTheme();
    return el;
  }

  window.SiteNav = { html: html, mount: mount, SECTIONS: SECTIONS, syncThemeBtn: syncThemeBtn };
})();
