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
    '.yk-nav .yk-zver{width:23px;height:23px;border-radius:50%;display:flex;' +
      'align-items:center;justify-content:center;font-size:15px;line-height:1;' +
      'background:var(--yk-fon-akt);border:1px solid var(--yk-kayma)}' +
    '.yk-nav a.yk-tut .yk-zver{border-color:var(--yk-syn)}' +
    '.yk-nav a svg{width:23px;height:23px;stroke:currentColor;fill:none;' +
      'stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
    '.yk-nav a.yk-tut{color:var(--yk-syn)}' +
    '.yk-nav a:active{background:var(--yk-fon-akt)}' +
    'body{padding-bottom:calc(70px + var(--yk-snizu)) !important}' +
    /* Сайтовая шапка: разделы и тема переехали (наббар / Профиль→Вид). */
    '.ynav{display:none !important}' +
    '.dp-header{display:none !important}' +
    /* Шапка конструктора («Разбор»): в ней жили те же разделы, что в наббаре,
       вход через Telegram (в приложении не работает), переключатель темы (он
       в Профиле) и справка. Справка переехала на «Уроки» и открывается по
       якорю konstruktor.html#spravka, поэтому шапку в приложении убираем —
       на сайте она остаётся, туда этот файл не попадает. */
    '.hdr{display:none !important}' +
    /* Та же история на «Уроках»: своя шапка .l-header дублирует наббар. */
    '.l-header{display:none !important}' +
    /* «Рейтинг»: ссылка «← к Ясне» вела на сайтовую главную и в приложении
       дублировала вкладку наббара. */
    '.rt-back{display:none !important}' +
    /* Панель «Редактор» в Разборе — во всю высоту окна, и её кнопка выхода
       оказывалась ровно под наббаром: закрыть редактор было нечем. */
    '.editor-panel{height:calc(100vh - 70px - var(--yk-snizu)) !important;z-index:129 !important}' +
    /* Без шапки полотно конструктора начиналось вплотную к строке состояния. */
    '.wrap-outer,.app-root,#root>div{padding-top:0}' +
    /* Плавающие кнопки «Отзыв» — над наббаром, а не под ним. */
    '.tr-fab-fb,.neg-fab-fb{bottom:calc(84px + var(--yk-snizu)) !important}' +
    /* 404: разделы уже в наббаре — остаётся одна дверь «На главную». */
    '.e-links .e-btn:not(.e-btn--primary){display:none}' +
    '.yk-nav.yk-klava{display:none}';
  (document.head || document.documentElement).appendChild(st);

  /* Свой знак вместо человечка: если человек назвался или вошёл по почте,
     вкладка «Профиль» показывает его зверя — как аватар в мессенджерах. */
  var мойЗверь = (function () {
    try {
      var п = JSON.parse(localStorage.getItem('yasna_duel_profile') || 'null');
      if (!п || !п.avatar) return null;
      var вошёл = !!(localStorage.getItem('yasna_duel_token') && localStorage.getItem('yasna_duel_user'));
      var назвался = п.nickname && п.nickname !== 'Гость';
      return (вошёл || назвался) ? п.avatar : null;
    } catch (e) { return null; }
  })();

  var nav = document.createElement('nav');
  nav.className = 'yk-nav';
  nav.setAttribute('aria-label', 'Разделы');
  nav.innerHTML = ПУНКТЫ.map(function (п) {
    var тут = п[0] === текущий;
    return '<a href="' + вверх + п[0] + '"' +
      (тут ? ' class="yk-tut" aria-current="page"' : '') + '>' +
      (п[0] === 'profil.html' && мойЗверь
        ? '<span class="yk-zver" aria-hidden="true">' + мойЗверь + '</span>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true">' + п[2] + '</svg>') +
      п[1] + '</a>';
  }).join('');
  /* Переключение вкладок НЕ копит историю (правило нижней навигации):
     иначе десять переходов по вкладкам = десять нажатий «назад».
     Заходы вглубь (урок, партия, круг) остаются обычными переходами. */
  nav.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    /* Тап по УЖЕ активной вкладке — не перезагрузка, а наверх (стандарт). */
    if (a.getAttribute('aria-current') === 'page') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    location.replace(a.href);
  });

  /* Клавиатура: медиазапрос по высоте ловил не все телефоны (высокие экраны
     с клавиатурой оставались «высокими») и гасил навигацию в сплит-скрине.
     Честный признак — вьюпорт просел ощутимо ниже своего максимума за
     сессию: Android resize'ит WebView под клавиатуру. */
  var максВысота = window.innerHeight;
  window.addEventListener('resize', function () {
    if (window.innerHeight > максВысота) максВысота = window.innerHeight;
    nav.classList.toggle('yk-klava', window.innerHeight < максВысота * 0.72);
  });
  document.body.appendChild(nav);

  /* Профиль сохраняет имя и зверя на этой же странице — событие storage
     в своей вкладке не приходит, поэтому даём ему прямой способ обновить
     вкладку, не перезагружая экран. */
  window.yasnaNavbarObnovi = function () {
    var а = nav.querySelector('a[href$="profil.html"]');
    if (!а) return;
    var зверь = null;
    try {
      var п = JSON.parse(localStorage.getItem('yasna_duel_profile') || 'null');
      var вошёл = !!(localStorage.getItem('yasna_duel_token') && localStorage.getItem('yasna_duel_user'));
      if (п && п.avatar && (вошёл || (п.nickname && п.nickname !== 'Гость'))) зверь = п.avatar;
    } catch (e) {}
    var было = а.querySelector('.yk-zver, svg');
    if (!было) return;
    if (зверь) {
      if (было.classList.contains('yk-zver')) { было.textContent = зверь; return; }
      var s = document.createElement('span');
      s.className = 'yk-zver'; s.setAttribute('aria-hidden', 'true'); s.textContent = зверь;
      а.replaceChild(s, было);
    }
  };
})();
