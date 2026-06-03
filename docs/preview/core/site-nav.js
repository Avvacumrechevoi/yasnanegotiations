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
    { sec:'rating',      label:'Рейтинг',     href:'rating.html' }
  ];
  var AVATAR_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.5-3.5 4.5-5 7-5s5.5 1.5 7 5"/></svg>';

  function html(current){
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
      + '<a class="ynav-login" href="duel.html#login" title="Войти — прогресс на любом устройстве">'
      +   '<span class="ynav-login-av">' + AVATAR_SVG + '</span>'
      +   '<span class="ynav-login-txt">Войти</span>'
      + '</a>';
  }

  function mount(el, current){
    if (typeof el === 'string') el = document.getElementById(el);
    if (el) el.innerHTML = html(current);
    return el;
  }

  window.SiteNav = { html: html, mount: mount, SECTIONS: SECTIONS };
})();
