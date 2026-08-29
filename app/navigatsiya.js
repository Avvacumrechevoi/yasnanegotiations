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
    ['duel.html', 'Игры',
      '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>'],
    ['learn.html', 'Уроки',
      '<path d="M12 4 2.8 8.4 12 12.8l9.2-4.4zM6 10.6V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-5.4"/>'],
    ['konstruktor.html', 'Разбор',
      '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4v17.2M3.4 12h17.2"/>'],
    ['profil.html', 'Профиль',
      '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>'],
  ];
  /* Экраны вне пятёрки подсвечивают ближайший по смыслу раздел. */
  var РОДИЧ = { 'rating.html': 'duel.html',
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
    '.yk-nav.yk-klava{display:none}' +
    /* ВОЗВРАТ ИЗ ЗАХОДА ВГЛУБЬ.
       Правило платформы: переключение вкладок — без истории, а заход вглубь
       (карточка «Уроков» открыла «Разбор», рейтинг открыт из игры) обязан
       иметь видимый выход назад. Своей шапки у экранов витрины нет, поэтому
       кнопку рисует наббар — одну и ту же на всех экранах. */
    /* z-index 210, а не 118: уроки рисуются слоем 130, разборы — 200, и
       кнопка возврата физически лежала под ними. Человек, ушедший в занятие
       из «Уроков», не видел выхода и уходил аппаратной «назад» с экрана. */
    '.yk-nazad{position:fixed;z-index:210;left:calc(8px + env(safe-area-inset-left,0px));' +
      'top:calc(8px + var(--yk-sverhu));display:inline-flex;align-items:center;gap:6px;' +
      'height:40px;padding:0 14px 0 10px;border-radius:20px;border:1px solid var(--yk-kayma);' +
      'background:var(--yk-kart);color:var(--yk-ink2);font:600 13.5px/1 Manrope,Inter,sans-serif;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.10);cursor:pointer;text-decoration:none}' +
    '.yk-nazad svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;' +
      'stroke-linecap:round;stroke-linejoin:round}' +
    '.yk-nazad:active{transform:scale(.96)}' +
    /* Кнопка, севшая в шапку страницы: без тени и фиксации, едет со строкой. */
    '.yk-nazad--v-shapke{position:static;box-shadow:none;background:transparent;' +
      'border-color:transparent;padding:0 10px 0 6px;height:44px;color:var(--yk-ink2)}' +
    '.yk-nazad--v-shapke span{max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    /* ПОЛОСА ПОД КНОПКОЙ ВОЗВРАТА.
       Кнопка висит в левом верхнем углу и наезжала на заголовки экранов:
       «Уроки», «Профиль», «Мастерство в игре», «✦ Рейтинг» — проверено
       замером, наложение до 2600 px². Раз кнопка занимает верхнюю полосу,
       полосу надо отдать ей целиком: содержимое страницы начинается ниже.
       Так же, как наббар внизу получает свои 70px. */
    /* Базовый воздух сверху: без него заголовок экрана лип к строке
       состояния и всё выглядело приплюснутым. Ставится только страницам,
       которые и так прокручиваются, — экраны с оболочкой ровно во весь
       экран («Разбор») от лишнего отступа поехали бы под наббар. */
    'html.yk-verh body{padding-top:calc(14px + var(--yk-sverhu)) !important}' +
    'html.yk-nazad-est body{padding-top:calc(52px + var(--yk-sverhu)) !important}' +
    /* Экраны, у которых своя верхняя лента приклеена к окну (её body-отступ
       не двигает) — сдвигаем саму ленту. */
    'html.yk-nazad-est .raz-imya-polosa,html.yk-nazad-est .dp-sticky,' +
      'html.yk-nazad-est .rt-top{top:calc(52px + var(--yk-sverhu)) !important}' +
    /* Пока поверх экрана открыт лист во весь экран (карточка места, «Все 12
       мест», поиск), кнопка мешает его собственной шапке — прячем. Признак
       ставит страница: html.yk-bez-nazad. */
    'html.yk-bez-nazad .yk-nazad{display:none !important}' +
    ':root{--yk-sverhu:var(--safe-area-inset-top, env(safe-area-inset-top, 0px))}';
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
    /* Переключение вкладок — это смена «дома», а не заход вглубь: метку
       «откуда» снимаем, иначе кнопка возврата всплыла бы на самой вкладке. */
    try { sessionStorage.removeItem('yasna_otkuda_v1'); } catch (_) {}
    /* Тап по УЖЕ активной вкладке — наверх (стандарт нижней навигации).
       Но подсвеченной вкладка бывает и на «дочернем» экране (Тренажёры и
       Переговоры подсвечивают «Уроки», Рейтинг — «Игру»): там прокрутка
       наверх выглядела так, будто вкладка сломана. С дочернего экрана
       уходим на сам раздел. */
    if (a.getAttribute('aria-current') === 'page') {
      var свой = a.getAttribute('href');
      if (свой && свой.split('/').pop() !== файл) { location.replace(свой); return; }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    location.replace(a.href);
  });

  /* ══ ВОЗВРАТ ИЗ ЗАХОДА ВГЛУБЬ ═══════════════════════════════════════
     Как это принято: пять вкладок — это пять «домов», переключение между
     ними историю не копит. Всё остальное — заход вглубь: из «Уроков» в
     «Разбор» за инструкцией, из «Игры» в «Рейтинг», из главной в практику.
     У такого перехода обязан быть видимый выход назад — раньше его не было
     вовсе: человек уходил в «Разбор» и мог вернуться только вкладкой,
     потеряв место, откуда пришёл.

     Помним ОТКУДА пришли (sessionStorage, живёт до закрытия приложения):
     метку ставит сам переход по ссылке, а переключение вкладок её стирает. */
  var КЛЮЧ_ОТКУДА = 'yasna_otkuda_v1';
  var ИМЕНА = { 'index.html': 'Главная', 'duel.html': 'Игры', 'learn.html': 'Уроки',
                'konstruktor.html': 'Разбор', 'profil.html': 'Профиль',
                'rating.html': 'Рейтинг', 'negotiations.html': 'Переговоры',
                };

  function имяЭкрана(имяФайла) {
    if (!имяФайла) return 'назад';
    if (имяФайла.indexOf('krug') >= 0) return 'Разложи по кругу';
    return ИМЕНА[имяФайла] || 'назад';
  }
  function прочитатьОткуда() {
    try { return JSON.parse(sessionStorage.getItem(КЛЮЧ_ОТКУДА) || 'null'); } catch (_) { return null; }
  }
  function записатьОткуда(з) {
    try { з ? sessionStorage.setItem(КЛЮЧ_ОТКУДА, JSON.stringify(з))
            : sessionStorage.removeItem(КЛЮЧ_ОТКУДА); } catch (_) {}
  }

  /* Любой переход по ссылке внутри приложения (кроме наббара) — заход вглубь.
     Ставим метку до ухода: на новой странице она уже будет. */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || a.closest('.yk-nav')) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;
    if (a.target === '_blank') return;
    var сюда = href.split('#')[0].split('?')[0].split('/').pop();
    if (!сюда || сюда === файл) return;              /* тот же экран — не заход */
    записатьОткуда({ файл: файл, путь: location.pathname + location.search, имя: имяЭкрана(файл) });
  }, true);

  (function кнопкаНазад() {
    /* МЕСТО В ШАПКЕ. Плавающая кнопка искалась глазами по всему экрану —
       особенно на длинных страницах, где шапка липкая, а кнопка уехала со
       скроллом. Если страница даёт место (data-yk-nazad-mesto="файл|Имя"),
       кнопка садится туда и едет вместе с шапкой. Значение атрибута — куда
       вести, когда человек пришёл прямой ссылкой и «откуда» пусто. */
    var место = document.querySelector('[data-yk-nazad-mesto]');
    var запасной = null;
    if (место) {
      var зн = (место.getAttribute('data-yk-nazad-mesto') || '').split('|');
      if (зн[0]) запасной = { файл: зн[0], имя: зн[1] || 'Назад', путь: вверх + зн[0] };
    }
    /* Подпись обязана совпадать с тем, куда кнопка реально уведёт. Нажатие
       сперва идёт по истории, поэтому имя берём с предыдущей страницы, а
       метку «откуда» — только когда истории нет. Иначе кнопка обещала
       «Главная», а возвращала на «Уроки». */
    var поИстории = null;
    try {
      if (document.referrer && history.length > 1) {
        var р = new URL(document.referrer);
        if (р.origin === location.origin) {
          var ф = (р.pathname.split('/').pop() || 'index.html');
          if (ф !== файл && ИМЕНА[ф]) поИстории = { файл: ф, имя: ИМЕНА[ф], путь: вверх + ф };
        }
      }
    } catch (_) {}
    var откуда = поИстории || прочитатьОткуда() || запасной;
    if (!откуда || (откуда.файл === файл && !место)) return;
    /* На «Круге» своя стрелка в шапке — второй кнопки не надо. */
    if (часть.indexOf('krug') >= 0 || document.getElementById('krug-nazad')) return;
    var кн = document.createElement('a');
    кн.className = 'yk-nazad';
    кн.href = откуда.путь || (вверх + откуда.файл);
    кн.setAttribute('aria-label', 'Назад: ' + откуда.имя);
    кн.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>' +
                   '<span>' + откуда.имя + '</span>';
    кн.addEventListener('click', function (e) {
      e.preventDefault();
      /* Сперва спрашиваем страницу: у неё может быть свой уровень вглубь
         (открытая глава книги, раскрытый лист). Отменила событие — значит
         разобралась сама, и с экрана уходить рано. */
      var соб;
      try {
        соб = new CustomEvent('yasna:назад', { cancelable: true });
      } catch (_) {
        соб = document.createEvent('CustomEvent');
        соб.initCustomEvent('yasna:назад', false, true, null);
      }
      window.dispatchEvent(соб);
      if (соб.defaultPrevented) return;
      записатьОткуда(null);
      /* Настоящая история лучше: сохраняет прокрутку и состояние экрана. */
      if (history.length > 1) { history.back(); return; }
      location.replace(кн.href);
    });
    if (место) {
      /* В шапке кнопка — часть строки, а не карточка поверх экрана. */
      кн.classList.add('yk-nazad--v-shapke');
      место.appendChild(кн);
      return;                       /* размещать по экрану больше нечего */
    }
    document.body.appendChild(кн);

    /* ══ ГДЕ СТОЯТЬ КНОПКЕ ═══════════════════════════════════════════════
       Кнопка висит в левом верхнем углу и наезжала на заголовки: «Уроки»,
       «Профиль», «Мастерство в игре», «✦ Рейтинг» (замер: наложение до
       2600 px²). Место выбираем не на глаз, а проверкой:

         1. Если под кнопкой ничего нет — оставляем как есть.
         2. Если есть — отдаём ей верхнюю полосу: содержимое страницы
            начинается на 52px ниже (класс yk-nazad-est).
         3. Полоса не годится экранам, чья оболочка ровно во весь экран
            («Разбор»): страница станет на 52px выше себя и поедет под
            наббар. Там вместо полосы сдвигаем саму кнопку — сначала ниже
            помехи, потом правее.

       Проверка повторяется после отрисовки и при повороте: заголовки
       появляются позже первого кадра. */
    var корень = document.documentElement;
    var ПОЛОСА = 52;

    function помехи() {
      var r = кн.getBoundingClientRect();
      var сп = [];
      var узлы = document.body.querySelectorAll('*');
      for (var i = 0; i < узлы.length; i++) {
        var э = узлы[i];
        if (э === кн || кн.contains(э) || э.contains(кн)) continue;
        var cs = getComputedStyle(э);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (parseFloat(cs.opacity) < 0.05) continue;
        var свой = false, д = э.childNodes;
        for (var j = 0; j < д.length; j++) {
          if (д[j].nodeType === 3 && д[j].textContent.trim()) { свой = true; break; }
        }
        var интер = /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(э.tagName);
        if (!свой && !интер) continue;
        var rr = э.getBoundingClientRect();
        if (!rr.width || !rr.height) continue;
        if (rr.right < r.left || rr.left > r.right || rr.bottom < r.top || rr.top > r.bottom) continue;
        сп.push(rr);
      }
      return сп;
    }

    /* Оболочка ровно во весь экран — значит страница не прокручивается и
       полосу отдавать нельзя. */
    function оболочкаВоВесьЭкран() {
      return document.body.scrollHeight <= window.innerHeight + 2;
    }

    function разместить() {
      кн.style.top = ''; кн.style.left = '';
      корень.classList.remove('yk-nazad-est');
      if (!помехи().length) return;

      var жёсткая = оболочкаВоВесьЭкран();
      if (!жёсткая) {
        корень.classList.add('yk-nazad-est');
        if (!помехи().length) return;
        корень.classList.remove('yk-nazad-est');
      }

      /* Сдвигаем кнопку: сначала ниже самой низкой помехи. */
      var сп = помехи();
      var низ = 0;
      сп.forEach(function (rr) { if (rr.bottom > низ) низ = rr.bottom; });
      var предел = Math.round(window.innerHeight * 0.34);
      var новыйВерх = Math.min(Math.round(низ + 8), предел);
      кн.style.top = новыйВерх + 'px';
      if (!помехи().length) return;

      /* Не помогло — уходим правее всего, что мешает. */
      сп = помехи();
      var право = 0;
      сп.forEach(function (rr) { if (rr.right > право) право = rr.right; });
      var шир = кн.getBoundingClientRect().width;
      var лево = Math.min(Math.round(право + 8), Math.max(8, window.innerWidth - шир - 8));
      кн.style.left = лево + 'px';
    }

    var ждём = false;
    function пересмотретьМесто() {
      if (ждём) return;
      ждём = true;
      requestAnimationFrame(function () { ждём = false; разместить(); });
    }
    пересмотретьМесто();
    setTimeout(пересмотретьМесто, 400);
    setTimeout(пересмотретьМесто, 1500);
    window.addEventListener('resize', пересмотретьМесто);
    window.addEventListener('orientationchange', пересмотретьМесто);

    /* Метку не снимаем по аппаратной «назад»: то же событие приходит и когда
       она всего лишь закрывает окно поверх экрана. Метка безвредна — кнопка
       рисуется, только если экран в ней отличается от текущего, а переключение
       вкладок стирает её само. */

    /* ПОКА ПОВЕРХ ЭКРАНА ЛЕЖИТ ЛИСТ ВО ВЕСЬ ЭКРАН — КНОПКУ ПРЯЧЕМ.
       Урок, разбор автора, карточка места на полном упоре, «Все 12 мест»,
       поиск, редактор — у каждого своя шапка со своим крестиком, и кнопка
       возврата наезжала на их заголовки (замер: до 2600 px² наложения на
       заголовке урока). Признак ищем по виду, а не по имени класса: любой
       слой position:fixed с z-index ≥ 129, который накрывает почти весь
       экран. Так правило работает и для листов, которых ещё нет.
       Аппаратная «назад» и крестик такие листы закрывают — выход есть. */
    var корень = document.documentElement;
    function накрытоЛистом() {
      /* Обходим всё поддерево: карточка места лежит четвёртым уровнем от
         body (#root > .app > .app-body > aside), и обход «на три уровня»
         её не видел. Экраны небольшие (275–500 узлов), а сам обход зажат
         в один кадр и не слушает правки inline-стиля — иначе он срабатывал
         бы на каждом кадре перетаскивания шторки. */
      var узлы = document.body.querySelectorAll('*');
      var W = window.innerWidth, H = window.innerHeight;
      for (var i = 0; i < узлы.length; i++) {
        var э = узлы[i];
        if (э.classList && э.classList.contains('yk-nazad')) continue;
        var cs = getComputedStyle(э);
        if (cs.position !== 'fixed') continue;
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (parseFloat(cs.opacity) < 0.02) continue;
        if ((+cs.zIndex || 0) < 129) continue;
        var r = э.getBoundingClientRect();
        if (r.width >= W * 0.9 && r.height >= H * 0.8) return true;
      }
      return false;
    }
    var ждёмКадр = false;
    function пересмотреть() {
      if (ждёмКадр) return;
      ждёмКадр = true;
      requestAnimationFrame(function () {
        ждёмКадр = false;
        корень.classList.toggle('yk-bez-nazad', накрытоЛистом());
      });
    }
    пересмотреть();
    try {
      new MutationObserver(пересмотреть).observe(document.body, {
        childList: true, subtree: true,
        attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden', 'data-upor']
      });
    } catch (_) {}
    window.addEventListener('resize', пересмотреть);
    window.addEventListener('hashchange', пересмотреть);
  })();

  /* ── Базовый отступ сверху для всех экранов ─────────────────────────
     Кнопка возврата отдаёт странице свои 52px, но её на экране может и не
     быть — а воздух сверху нужен всегда. Ставим 14px тем страницам, которые
     прокручиваются: у экранов с оболочкой во весь экран лишний отступ
     создал бы прокрутку и увёл низ под наббар. */
  (function верхнийОтступ() {
    var корень = document.documentElement;
    function решить() {
      if (корень.classList.contains('yk-nazad-est')) { корень.classList.remove('yk-verh'); return; }
      var прокручивается = document.body.scrollHeight > window.innerHeight + 2;
      корень.classList.toggle('yk-verh', прокручивается);
    }
    решить();
    setTimeout(решить, 500);
    setTimeout(решить, 1600);
    window.addEventListener('resize', решить);
    window.addEventListener('orientationchange', решить);
  })();

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
