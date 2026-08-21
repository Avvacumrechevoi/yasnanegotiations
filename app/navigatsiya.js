/* ═══════════════════════════════════════════════════════════════════════════
   СКВОЗНАЯ НАВИГАЦИЯ ПРИЛОЖЕНИЯ — нижний наббар на каждом экране.

   До этого наббар был только у главной и Профиля, а остальные экраны жили
   с сайтовой шапкой: мелкие ссылки сверху, бургер, «Войти» — на телефоне это
   читается как «сайт в рамке». Приняты правила платформы: основная навигация
   мобильного приложения — нижняя полоса, одинаковая на всех экранах.

   Этот файл (кладёт сборщик app/sobrat-vitrinu.mjs на все страницы витрины):
     — рисует один и тот же наббар из пяти разделов; текущий подсвечен;
     — прячет сайтовую шапку (.ynav) — её роли переехали: разделы сюда,
       тема — в Профиль («Вид»), вход — в Профиль;
     — отодвигает низ страницы, чтобы содержимое не пряталось за наббаром;
     — прячется, когда открыта клавиатура (вьюпорт становится низким) —
       иначе полоса всплывала бы над клавиатурой в чатах и формах.

   Свои токены (--yk-*): страницы витрины стилизованы по-разному, и наббар
   не может полагаться на чужие переменные. Тёмная тема — по html[data-theme],
   который выставляет core/theme.js на каждой странице.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (document.querySelector('.yk-nav')) return;
  document.documentElement.classList.add('yk-est');

  /* Глубина текущей страницы относительно корня витрины: у games/krug/ ссылки
     должны начинаться с ../../, иначе уведут в несуществующие файлы. */
  var часть = location.pathname.split('/').filter(Boolean);
  var вверх = new Array(Math.max(0, часть.length - 1)).join('../') +
              (часть.length > 1 ? '../' : '');
  var файл = часть.length ? часть[часть.length - 1] : 'index.html';

  var ПУНКТЫ = [
    ['index.html', 'Главная',
      '<path d="M4 11.2 12 4l8 7.2M6 9.8V20h12V9.8"/>'],
    ['duel.html', 'Игра',
      '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>'],
    ['learn.html', 'Уроки',
      '<path d="M12 4 2.8 8.4 12 12.8l9.2-4.4zM6 10.6V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-5.4"/>'],
    ['konstruktor.html', 'Разбор',
      '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4v17.2M3.4 12h17.2"/>'],
    ['profil.html', 'Профиль',
      '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>'],
  ];
  /* Экраны вне пятёрки подсвечивают ближайший по смыслу раздел. */
  var РОДИЧ = { 'rating.html': 'duel.html', 'trainers.html': 'learn.html',
                'negotiations.html': 'learn.html' };
  var текущий = РОДИЧ[файл] || файл;
  if (часть.indexOf('krug') >= 0) текущий = 'duel.html';

  var st = document.createElement('style');
  st.textContent =
    /* Android WebView «удобно» раздувает шрифты (font boosting): заголовки
       20px рендерились как 32px. Приложение задаёт размеры само. */
    'html{-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
    ':root{--yk-kart:#ffffff;--yk-kayma:rgba(16,20,24,.08);--yk-ink2:#5c6570;' +
      '--yk-syn:#0071e3;--yk-fon-akt:#eaf2fe;' +
      '--yk-snizu:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))}' +
    'html[data-theme="dark"]{--yk-kart:#1a1d21;--yk-kayma:rgba(232,235,238,.12);' +
      '--yk-ink2:#9aa3ad;--yk-syn:#3d96f0;--yk-fon-akt:#1f2b3d}' +
    '.yk-nav{position:fixed;left:0;right:0;bottom:0;z-index:120;display:flex;' +
      'background:var(--yk-kart);border-top:1px solid var(--yk-kayma);' +
      'padding:6px 6px calc(6px + var(--yk-snizu))}' +
    '.yk-nav a{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;' +
      'padding:6px 2px;text-decoration:none;color:var(--yk-ink2);' +
      'font:500 11.5px/1 Manrope,Inter,system-ui,sans-serif;border-radius:12px;' +
      'min-height:48px;justify-content:center}' +
    '.yk-nav a svg{width:23px;height:23px;stroke:currentColor;fill:none;' +
      'stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
    '.yk-nav a.yk-tut{color:var(--yk-syn)}' +
    '.yk-nav a:active{background:var(--yk-fon-akt)}' +
    'body{padding-bottom:calc(70px + var(--yk-snizu)) !important}' +
    /* Сайтовая шапка: разделы и тема переехали (наббар / Профиль→Вид). */
    '.ynav{display:none !important}' +
    '.dp-header{display:none !important}' +
    /* Клавиатура открыта → вьюпорт низкий → наббар не всплывает над ней. */
    /* Плавающие кнопки «Отзыв» — над наббаром, а не под ним. */
    '.tr-fab-fb,.neg-fab-fb{bottom:calc(84px + var(--yk-snizu)) !important}' +
    /* 404: разделы уже в наббаре — остаётся одна дверь «На главную». */
    '.e-links .e-btn:not(.e-btn--primary){display:none}' +
    '@media (max-height:450px){.yk-nav{display:none}body{padding-bottom:0 !important}}';
  (document.head || document.documentElement).appendChild(st);

  var nav = document.createElement('nav');
  nav.className = 'yk-nav';
  nav.setAttribute('aria-label', 'Разделы');
  nav.innerHTML = ПУНКТЫ.map(function (п) {
    var тут = п[0] === текущий;
    return '<a href="' + вверх + п[0] + '"' +
      (тут ? ' class="yk-tut" aria-current="page"' : '') + '>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + п[2] + '</svg>' +
      п[1] + '</a>';
  }).join('');
  document.body.appendChild(nav);
})();
