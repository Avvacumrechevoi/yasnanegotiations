/* ═══════════════════════════════════════════════════════════════════════════
   СКВОЗНАЯ ОБОЛОЧКА ПРИЛОЖЕНИЯ: одна шапка сверху, один наббар снизу,
   один стек «откуда я пришёл».

   Почему файл переписан. Об «откуда» в приложении говорили ЧЕТЫРЕ независимых
   источника: document.referrer, метка yasna_otkuda_v1, ключ yasna_urok_otkuda
   и параметр ?otkuda. Они противоречили друг другу, и отсюда росли все жалобы
   навигации разом: на самом экране «Уроки» всплывала кнопка «‹ Уроки», после
   переключения вкладок на корневом экране появлялась «‹ предыдущая вкладка»
   и сдвигала содержимое на 52 px, подпись обещала одно, а нажатие уводило в
   другое. Теперь источник один — стек в sessionStorage (window.yasnaNav), и
   подпись возврата берётся ТОЛЬКО из него.

   ДОГОВОР (на него опираются экраны):

   1) Тип экрана страница объявляет САМА — атрибутами на <body>:
        data-yk-tip="корень|дочерний|слой"   (латиницей тоже понимается)
        data-yk-imya="Уроки"                 — имя экрана: заголовок и подпись
        data-yk-roditel="learn.html"         — чья вкладка подсвечена
        data-yk-imya-iz="#узел"              — брать заголовок из узла страницы
        data-yk-holst                        — оболочка ровно во весь экран
        data-yk-deystvie   (на кнопке)       — переехать в действия шапки
      Экран, который НИЧЕГО не объявил, считается корнем: кнопки возврата на
      нём не будет никогда. Атрибуты известным экранам проставляет сборщик
      app/sobrat-vitrinu.mjs — страницы витрины о приложении не знают.

   2) Переходы — через window.yasnaNav:
        yasnaNav.корень(файл)          переключение вкладки: стек пуст, replace
        yasnaNav.вглубь(адрес, {имя})  заход вглубь: кладём себя в стек
        yasnaNav.назад()               снять верх стека и вернуться
        yasnaNav.верх()                {файл, путь, имя} или null
        yasnaNav.объявить({тип,имя})   переобъявить экран на ходу (открыт слой)
        yasnaNav.заголовок(текст)      сменить заголовок шапки
        yasnaNav.действия()            контейнер действий справа в шапке
      Событие yasna:назад (аппаратная кнопка и стрелка шапки) остаётся: слой
      обязан закрыть себя сам и отменить событие.

   Свои токены (--yk-*): страницы витрины стилизованы по-разному, и оболочка
   не может полагаться на чужие переменные. Тёмная тема — по html[data-theme],
   который выставляет core/theme.js на каждой странице.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (document.querySelector('.yk-nav')) return;
  var КОРЕНЬ_HTML = document.documentElement;
  КОРЕНЬ_HTML.classList.add('yk-est');

  /* Глубина текущей страницы относительно корня витрины: у games/krug/ ссылки
     должны начинаться с ../../, иначе уведут в несуществующие файлы. */
  var часть = location.pathname.split('/').filter(Boolean);
  var вверх = new Array(Math.max(0, часть.length - 1)).join('../') +
              (часть.length > 1 ? '../' : '');
  var файл = часть.length ? часть[часть.length - 1] : 'index.html';

  /* ПЯТЬ ВКЛАДОК ПО РЕШЕНИЮ ВЛАДЕЛЬЦА (решение от 03.09).
     Было: Главная · Игры · Уроки · Разбор · Профиль — нарезка по техническим
     страницам, а не по делам человека. Главная собирала 12–14 чужих ссылок,
     трём книгам не досталось двери вовсе, а Профиль — это «я», а не раздел,
     и занимал пятое место наравне с занятиями.
     Стало: «Сегодня» отвечает на вопрос «что делать сейчас», «Практика»
     собирает все занятия (Партия, круг, Переговоры, рейтинг), «Библиотека» —
     все книги и справочники. Профиль ушёл в правый угол общей шапки
     аватаром (см. аватарВШапке): он доступен с любой вкладки и не отнимает
     у занятий место. */
  var ПУНКТЫ = [
    ['index.html', 'Сегодня',
      '<path d="M4 11.2 12 4l8 7.2M6 9.8V20h12V9.8"/>'],
    ['learn.html', 'Уроки',
      '<path d="M12 4 2.8 8.4 12 12.8l9.2-4.4zM6 10.6V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-5.4"/>'],
    ['praktika.html', 'Практика',
      '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>'],
    ['biblioteka.html', 'Библиотека',
      '<path d="M12 6.7C10.9 5.6 9.3 5 7.6 5H4v12.2h3.6c1.7 0 3.3.6 4.4 1.7M12 6.7C13.1 5.6 14.7 5 16.4 5H20v12.2h-3.6c-1.7 0-3.3.6-4.4 1.7M12 6.7V18.9"/>'],
    ['konstruktor.html', 'Разбор',
      '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4v17.2M3.4 12h17.2"/>'],
  ];
  function корневой(имяФайла) {
    for (var i = 0; i < ПУНКТЫ.length; i++) if (ПУНКТЫ[i][0] === имяФайла) return true;
    return false;
  }
  /* Корневая вкладка — только та, что лежит в корне витрины. У Круга файл
     тоже index.html (games/krug/index.html), и по одному имени файла он
     считался Главной: отсюда «‹ Главная» после Круга и подсветка не той
     вкладки. Смотрим на путь целиком. */
  var вПодпапке = часть.length > 1;
  function самКорень() { return !вПодпапке && корневой(файл); }

  /* Экраны вне пятёрки подсвечивают ближайший по смыслу раздел. Книга сюда
     добавлена не для красоты: без неё на экране книги не была подсвечена ни
     одна вкладка — человек не понимал, в каком он разделе.
     Партия (duel.html) и Рейтинг теперь тоже здесь: своей вкладки у них
     больше нет, они живут внутри «Практики». Профиля в таблице НЕТ нарочно —
     в него входят с любой вкладки, и подсвечивать надо ту, откуда вошли; об
     этом говорит стек (см. «текущий» ниже), а не таблица. */
  var РОДИЧ = { 'duel.html': 'praktika.html',
                'rating.html': 'praktika.html',
                'negotiations.html': 'praktika.html',
                'lesson.html': 'learn.html',
                'kniga.html': 'biblioteka.html',
                'upravleniya.html': 'biblioteka.html' };
  /* Круг открывают из трёх мест, и подсвечивать надо то, ОТКУДА пришли, а не
     «Практику» всегда: «Разложить Сутки» на Уроках уводил в Круг, а наббар
     показывал чужой раздел. Метку ставит ссылка (?otkuda=…). Старое значение
     igra остаётся понятным: ссылки с ним живут в игровых страницах, и
     ломаться при переименовании вкладки они не должны. */
  var ПО_ОТКУДА = { uroki: 'learn.html', igra: 'praktika.html',
                    praktika: 'praktika.html', glavnaya: 'index.html' };

  var ИМЕНА = { 'index.html': 'Сегодня', 'learn.html': 'Уроки',
                'praktika.html': 'Практика', 'biblioteka.html': 'Библиотека',
                'konstruktor.html': 'Разбор',
                'duel.html': 'Игры', 'profil.html': 'Профиль',
                'rating.html': 'Рейтинг', 'negotiations.html': 'Переговоры',
                'lesson.html': 'Урок', 'kniga.html': 'Книга',
                'upravleniya.html': 'Управления' };

  /* Имя считаем по ПОЛНОМУ пути, а не по последнему сегменту: у Круга файл
     тоже index.html, и по имени файла он читался как «Главная». */
  function имяПути(путь) {
    if (!путь) return '';
    var чистый = String(путь).split('#')[0].split('?')[0];
    if (чистый.indexOf('/krug/') >= 0) return 'Разложи по кругу';
    return ИМЕНА[чистый.split('/').pop() || 'index.html'] || '';
  }

  /* ══ 1. ОБЪЯВЛЕНИЕ ЭКРАНА ═══════════════════════════════════════════════
     Страница говорит о себе сама. Латиница понимается наравне с кириллицей:
     атрибуты проставляют и сборщик, и руки, и путать людей написанием
     незачем. Ничего не объявила — считаем корнем: на корне кнопки возврата
     не бывает, и это самое безопасное умолчание. */
  var ТИПЫ = { 'корень': 'корень', 'koren': 'корень', 'root': 'корень',
               'дочерний': 'дочерний', 'дочка': 'дочерний', 'dochka': 'дочерний',
               'dochernij': 'дочерний', 'child': 'дочерний',
               'слой': 'слой', 'sloy': 'слой', 'layer': 'слой' };
  var тело = document.body;
  function атрибут(имя) { return (тело && тело.getAttribute(имя)) || ''; }

  var объявлено = {
    тип: ТИПЫ[атрибут('data-yk-tip').toLowerCase()] || 'корень',
    имя: атрибут('data-yk-imya') || атрибут('data-yk-zagolovok') || имяПути(location.pathname),
    родитель: атрибут('data-yk-roditel') || '',
    холст: тело ? тело.hasAttribute('data-yk-holst') : false
  };
  /* Переобъявление на ходу (страница открыла слой поверх себя). */
  var сейчас = { тип: объявлено.тип, имя: объявлено.имя, закрыть: null };

  /* ══ 2. СТЕК «ОТКУДА» ══════════════════════════════════════════════════
     Один список на всё приложение. Внизу — экран, с которого начали, вверху
     — тот, куда вернёт «назад». Текущего экрана в стеке НЕТ.

     sessionStorage не переживает убийство процесса, поэтому есть зеркало в
     localStorage со сроком 30 минут: человек, вернувшийся в приложение через
     минуту, не должен обнаружить, что «назад» вести некуда. */
  var КЛЮЧ = 'yasna_stek_v1';
  var КЛЮЧ_ЗЕРКАЛО = 'yasna_stek_zerkalo_v1';
  var СРОК = 30 * 60 * 1000;

  function прочитать() {
    var с = null;
    try { с = JSON.parse(sessionStorage.getItem(КЛЮЧ) || 'null'); } catch (_) {}
    if (!Array.isArray(с)) {
      try {
        var з = JSON.parse(localStorage.getItem(КЛЮЧ_ЗЕРКАЛО) || 'null');
        if (з && Array.isArray(з.стек) && (Date.now() - (з.когда || 0)) < СРОК) с = з.стек;
      } catch (_) {}
    }
    return Array.isArray(с) ? с : [];
  }
  function записать(с) {
    try { sessionStorage.setItem(КЛЮЧ, JSON.stringify(с)); } catch (_) {}
    try { localStorage.setItem(КЛЮЧ_ЗЕРКАЛО, JSON.stringify({ стек: с, когда: Date.now() })); } catch (_) {}
    /* ВРЕМЕННОЕ ЗЕРКАЛО в старый ключ yasna_otkuda_v1. Его читает
       домойЕслиРадиОкна() в docs/app.js: окно Справки/Словаря, открытое
       якорем с «Уроков», возвращает человека на «Уроки». Ключ больше не
       источник правды — только отражение вершины стека, поэтому противоречия
       с ним быть не может. Снять, когда Разбор перейдёт на yasnaNav.назад(). */
    try {
      var в = с.length ? с[с.length - 1] : null;
      if (в) sessionStorage.setItem('yasna_otkuda_v1',
        JSON.stringify({ файл: в.файл, путь: в.путь, имя: в.имя }));
      else sessionStorage.removeItem('yasna_otkuda_v1');
    } catch (_) {}
  }

  var стек = прочитать();

  /* Приведение стека к правде при каждой загрузке документа.
     — корневая вкладка обнуляет стек: под «домом» ничего не лежит;
     — если наверху стека мы сами (вернулись по истории) — снять. Иначе на
       экране «Уроки» после системного «назад» из урока появлялась кнопка
       «‹ Уроки», ведущая на себя же. */
  (function привести() {
    var изменилось = false;
    if (самКорень() && стек.length) { стек = []; изменилось = true; }
    while (стек.length && стек[стек.length - 1].файл === файл &&
           (стек[стек.length - 1].путь || '').split('?')[0] === location.pathname) {
      стек.pop(); изменилось = true;
    }
    if (изменилось) записать(стек);
  })();

  function адресОт(куда) {
    if (!куда) return вверх + 'index.html';
    if (/^[a-z]+:|^\//i.test(куда)) return куда;      /* уже полный адрес */
    return вверх + куда;
  }
  function файлИз(адрес) {
    return String(адрес || '').split('#')[0].split('?')[0].split('/').pop() || 'index.html';
  }
  /* Куда вести и чью вкладку подсвечивать, когда стек пуст (пришли прямой
     ссылкой или после холодного запуска). Первой спрашиваем метку ?otkuda:
     она говорит о ЖИВОМ переходе, а объявленный родитель — только о том, где
     экран живёт вообще. Круг открывают и из Игр, и из Уроков, и подсвечивать
     «Игры» всегда — значит врать половине переходов. */
  function запаснойРодитель() {
    var откуда = '';
    try { откуда = new URLSearchParams(location.search).get('otkuda') || ''; } catch (_) {}
    if (ПО_ОТКУДА[откуда]) return ПО_ОТКУДА[откуда];
    if (объявлено.родитель) return объявлено.родитель;
    if (РОДИЧ[файл]) return РОДИЧ[файл];
    return 'index.html';
  }

  var yasnaNav = {
    файл: function () { return файл; },
    корневой: function (кто) { return кто ? корневой(кто) : самКорень(); },
    тип: function () { return сейчас.тип; },
    имя: function () { return сейчас.имя; },
    верх: function () { return стек.length ? стек[стек.length - 1] : null; },
    стек: function () { return стек.slice(); },

    /* Переключение вкладки: стек обнуляется, история не копится (правило
       нижней навигации — иначе десять переходов по вкладкам = десять
       нажатий «назад»). */
    корень: function (куда) {
      стек = []; записать(стек);
      var адрес = адресОт(куда);
      if (файлИз(адрес) === файл && адрес.indexOf('?') < 0) return;
      location.replace(адрес);
    },

    /* Заход вглубь: кладём в стек ТЕКУЩИЙ экран — туда и вернёмся. */
    вглубь: function (куда, о) {
      о = о || {};
      var я = location.pathname + location.search;
      /* Себя дважды не кладём: переход мог не состояться (кто-то отменил
         клик позже нас), и тогда в стеке остался бы двойник — «назад»
         возвращала бы на тот же экран. */
      while (стек.length && стек[стек.length - 1].путь === я) стек.pop();
      стек.push({ файл: файл, путь: я, корень: самКорень(),
                  имя: о.откуда || сейчас.имя || имяПути(location.pathname) || 'Назад',
                  история: true });
      записать(стек);
      if (куда) location.assign(адресОт(куда));
    },

    /* Возврат ровно на один уровень. history.back() — только когда верх
       стека мы туда и положили переходом: он сохраняет прокрутку экрана. */
    назад: function () {
      var кто = стек.pop();
      записать(стек);
      if (!кто) {
        if (!самКорень()) { location.replace(адресОт(запаснойРодитель())); }
        return;
      }
      if (кто.история && history.length > 1) { history.back(); return; }
      location.replace(адресОт(кто.путь || кто.файл));
    },

    /* Экран переобъявляет себя на ходу: открыл слой поверх себя (урок, глава,
       партия) — шапка меняет ← на ✕, наббар прячется. объявить(null) —
       вернуться к тому, что написано в разметке. */
    объявить: function (о) {
      if (!о) сейчас = { тип: объявлено.тип, имя: объявлено.имя, закрыть: null };
      else сейчас = { тип: ТИПЫ[String(о.тип || '').toLowerCase()] || сейчас.тип,
                      имя: о.имя || сейчас.имя,
                      закрыть: typeof о.закрыть === 'function' ? о.закрыть : null };
      обновитьШапку();
    },
    /* Слой, объявленный с обработчиком закрытия, закрывает себя и по
       аппаратной «назад» — чтобы у ✕ и системной кнопки был один путь. */
    закрытьСлой: function () {
      if (сейчас.тип === 'слой' && сейчас.закрыть) { сейчас.закрыть(); return true; }
      return false;
    },
    заголовок: function (текст) { сейчас.имя = текст || сейчас.имя; обновитьШапку(); },
    шапка: function () { return шапка; },
    действия: function () { return действия; }
  };
  window.yasnaNav = yasnaNav;

  /* ══ 3. СТИЛИ ══════════════════════════════════════════════════════════ */
  var ВЫС_ШАПКИ = 64, ВЫС_НАВ = 80;
  var st = document.createElement('style');
  st.textContent =
    /* Android WebView «удобно» раздувает шрифты (font boosting): заголовки
       20px рендерились как 32px. Приложение задаёт размеры само. */
    'html{-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
    ':root{--yk-kart:#ffffff;--yk-kayma:rgba(16,20,24,.08);--yk-ink1:#101418;--yk-ink2:#5c6570;' +
      '--yk-syn:#0071e3;--yk-fon-akt:#d7e6fb;' +
      '--yk-sverhu:var(--safe-area-inset-top, env(safe-area-inset-top, 0px));' +
      '--yk-snizu:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));' +
      '--yk-shapka:calc(' + ВЫС_ШАПКИ + 'px + var(--yk-sverhu));' +
      '--yk-nav:calc(' + ВЫС_НАВ + 'px + var(--yk-snizu))}' +
    'html[data-theme="dark"]{--yk-kart:#1a1d21;--yk-kayma:rgba(232,235,238,.12);' +
      '--yk-ink1:#e8ebee;--yk-ink2:#9aa3ad;--yk-syn:#3d96f0;--yk-fon-akt:#20344d}' +

    /* ── НАББАР ПО СПЕЦИФИКАЦИИ M3 ────────────────────────────────────────
       Было 63 dp без индикатора: активная вкладка отличалась ТОЛЬКО оттенком
       синего от серого — разница светлот 1.26:1, то есть в оттенках серого и
       при дальтонизме её нет вовсе. Стало: 80 dp, под иконкой активной —
       пилюля 64×32, подпись потолще. Форма, а не только цвет. */
    '.yk-nav{position:fixed;left:0;right:0;bottom:0;z-index:120;display:flex;' +
      'background:var(--yk-kart);border-top:1px solid var(--yk-kayma);' +
      'padding:12px 2px calc(16px + var(--yk-snizu))}' +
    /* min-width:0 обязателен: пять вкладок на 360 dp дают по 70 dp, и без
       него flex-элемент не даёт подписи «Библиотека» ужаться — полоса
       разъезжается шире экрана. Кегль 11 — нижняя граница читаемости, ниже
       не опускаемся; подпись в одну строку с многоточием. */
    '.yk-nav a{flex:1 1 0;min-width:0;display:flex;flex-direction:column;' +
      'align-items:center;gap:4px;text-decoration:none;color:var(--yk-ink2);' +
      'font:500 11px/14px Manrope,Inter,system-ui,sans-serif}' +
    '.yk-nav .yk-podpis{max-width:100%;white-space:nowrap;overflow:hidden;' +
      'text-overflow:ellipsis}' +
    '.yk-nav .yk-znak{width:min(64px,100%);height:32px;border-radius:16px;display:flex;' +
      'align-items:center;justify-content:center;transition:background .12s ease}' +
    '.yk-nav a.yk-tut .yk-znak{background:var(--yk-fon-akt)}' +
    '.yk-nav a.yk-tut{color:var(--yk-syn);font-weight:700}' +
    '.yk-nav a svg{width:24px;height:24px;stroke:currentColor;fill:none;' +
      'stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
    '.yk-nav a.yk-tut svg{stroke-width:2.3}' +
    '.yk-nav a:active .yk-znak{background:var(--yk-fon-akt)}' +
    'body{padding-bottom:calc(' + (ВЫС_НАВ + 4) + 'px + var(--yk-snizu)) !important}' +
    /* Клавиатура закрывает нижнюю треть экрана — полосе там не место. */
    '.yk-nav.yk-klava{display:none}' +
    /* В слое наббара нет вовсе: занятие занимает экран целиком. */
    'html.yk-sloy .yk-nav{display:none}' +
    'html.yk-sloy body{padding-bottom:0 !important}' +

    /* ── ОДНА ШАПКА НА ВСЕ ЭКРАНЫ ─────────────────────────────────────────
       Восемь паттернов шапки было в приложении: где-то h1 по центру, где-то
       «‹ Уроки» подписью (это паттерн iOS), где-то шапки не было вовсе, а
       возврат висел плавающей пилюлей поверх содержимого и наезжал на
       заголовки. Теперь одна: 64 dp, прилипшая, слева 48×48 (← у дочернего,
       ✕ у слоя, ничего у корня), заголовок, действия справа. */
    '.yk-shapka{position:fixed;left:0;right:0;top:0;z-index:119;display:flex;' +
      'align-items:center;gap:4px;height:var(--yk-shapka);padding:var(--yk-sverhu) 8px 0;' +
      'background:var(--yk-kart);border-bottom:1px solid var(--yk-kayma);' +
      'box-sizing:border-box}' +
    '.yk-shapka-zag{flex:1 1 auto;min-width:0;margin:0;padding:0 4px;' +
      'font:600 21px/1.25 Manrope,Inter,system-ui,sans-serif;color:var(--yk-ink1);' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.yk-shapka-nazad{flex:0 0 auto;width:48px;height:48px;display:flex;' +
      'align-items:center;justify-content:center;border:0;background:transparent;' +
      'color:var(--yk-ink1);border-radius:24px;cursor:pointer;padding:0}' +
    '.yk-shapka-nazad svg{width:24px;height:24px;stroke:currentColor;fill:none;' +
      'stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.yk-shapka-nazad:active{background:var(--yk-fon-akt)}' +
    /* На корне кнопки возврата нет — и места под неё тоже: правило класса
       сильнее браузерного [hidden], без этой строки заголовок корневых
       экранов был отодвинут на 48 px пустотой. */
    '.yk-shapka-nazad[hidden]{display:none !important}' +
    '.yk-shapka-dela{flex:0 0 auto;display:flex;align-items:center;gap:2px}' +
    /* Действия страницы переезжают в шапку как есть, со своими обработчиками;
       выравниваем только размер цели — 48 dp. */
    '.yk-shapka .yk-deystvie{min-width:48px;min-height:48px;padding:0 10px;' +
      'display:inline-flex;align-items:center;justify-content:center;' +
      'border:0;background:transparent;color:var(--yk-ink1);border-radius:24px;' +
      'box-shadow:none;margin:0;font:600 15px/1 Manrope,Inter,system-ui,sans-serif}' +
    '.yk-shapka .yk-deystvie:active{background:var(--yk-fon-akt)}' +
    /* Скрытое остаётся скрытым: правило класса сильнее браузерного [hidden],
       и «История» Круга (её показывают, когда история появилась) без этой
       строки висела в шапке всегда. */
    '.yk-shapka .yk-deystvie[hidden]{display:none !important}' +
    '.yk-shapka .yk-deystvie svg{width:24px;height:24px}' +
    /* АВАТАР ПРОФИЛЯ. Профиль перестал быть вкладкой: его место — правый
       угол шапки на каждой корневой вкладке. Картинка 40 dp (столько просил
       владелец), нажимается 48 — правило целей, а не только вид. Правила
       ниже правил .yk-deystvie нарочно: у них одинаковая сила, и выигрывает
       последнее — иначе аватар остался бы 24 dp. */
    '.yk-shapka .yk-avatar{padding:0 4px}' +
    '.yk-shapka .yk-avatar .yk-zver,.yk-shapka .yk-avatar svg{width:40px;height:40px;' +
      'border-radius:20px;background:var(--yk-fon-akt);color:var(--yk-ink1);' +
      'display:flex;align-items:center;justify-content:center}' +
    '.yk-shapka .yk-avatar .yk-zver{font-size:22px;line-height:1}' +
    '.yk-shapka .yk-avatar svg{padding:8px;box-sizing:border-box}' +
    /* Содержимое начинается под шапкой. Исключение — экраны, чья оболочка
       ровно во весь экран (data-yk-holst): им отступ создал бы прокрутку и
       увёл низ под наббар, поэтому там шапка лежит поверх. */
    'html.yk-shapka-est:not(.yk-holst) body{padding-top:var(--yk-shapka) !important}' +

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
    /* Ниже — экраны, чьи собственные шапки повторяют общую. Прячем их тем же
       способом: заголовок и возврат теперь рисует оболочка, а нужные кнопки
       («Аа», «История», лупа) переезжают в действия шапки по метке
       data-yk-deystvie. */
    'html.yk-shapka-est .dr-shapka-ryad{display:none !important}' +   /* Уроки: h1 + лупа */
    'html.yk-shapka-est .kn-shapka{display:none !important}' +        /* Книга */
    'html.yk-shapka-est .khd{display:none !important}' +              /* Круг */
    'html.yk-shapka-est .dp-castalia-h1{display:none !important}' +   /* Игры: h1 по центру */
    'html.yk-shapka-est body>header .shapka{display:none !important}' + /* Главная: привет */
    /* :not(.yk-shapka) обязателен — иначе правило гасит заголовок своей же
       шапки: она тоже <header> первым ребёнком body. */
    'html.yk-shapka-est body>header:not(.yk-shapka)>h1{display:none !important}' + /* Профиль */
    /* «Рейтинг»: ссылка «← к Ясне» вела на сайтовую главную и в приложении
       дублировала вкладку наббара. */
    '.rt-back{display:none !important}' +
    /* Панель «Редактор» в Разборе — во всю высоту окна, и её кнопка выхода
       оказывалась ровно под наббаром: закрыть редактор было нечем. */
    '.editor-panel{height:calc(100vh - var(--yk-nav)) !important;z-index:129 !important}' +
    /* Без шапки полотно конструктора начиналось вплотную к строке состояния. */
    '.wrap-outer,.app-root,#root>div{padding-top:0}' +
    /* Экраны-полотна: их собственные прилипшие ленты живут под общей шапкой. */
    'html.yk-shapka-est .raz-imya-polosa,html.yk-shapka-est .dp-sticky,' +
      'html.yk-shapka-est .rt-top{top:calc(var(--yk-shapka) + 6px) !important}' +
    /* Плавающий тулбар Разбора висит в углу полотна (top:10 инлайном) и
       оказался бы ровно под шапкой — опускаем его под ленту с именем ясны. */
    'html.yk-shapka-est .diag-corner-toolbar{top:calc(var(--yk-shapka) + 68px) !important}' +
    /* Плавающие кнопки «Отзыв» — над наббаром, а не под ним. */
    '.tr-fab-fb,.neg-fab-fb{bottom:calc(var(--yk-nav) + 14px) !important}' +
    /* 404: разделы уже в наббаре — остаётся одна дверь «На главную». */
    '.e-links .e-btn:not(.e-btn--primary){display:none}';
  (document.head || document.documentElement).appendChild(st);

  /* ══ 4. ШАПКА ══════════════════════════════════════════════════════════ */
  var шапка = null, заголовокУзел = null, кнопкаНазад = null, действия = null;

  function рисоватьШапку() {
    if (!сейчас.имя) return;                 /* имени нет — шапки не будет */
    шапка = document.createElement('header');
    шапка.className = 'yk-shapka';
    кнопкаНазад = document.createElement('button');
    кнопкаНазад.type = 'button';
    кнопкаНазад.className = 'yk-shapka-nazad';
    кнопкаНазад.hidden = true;
    кнопкаНазад.addEventListener('click', уйтиНазад);
    заголовокУзел = document.createElement('h1');
    заголовокУзел.className = 'yk-shapka-zag';
    действия = document.createElement('div');
    действия.className = 'yk-shapka-dela';
    шапка.appendChild(кнопкаНазад);
    шапка.appendChild(заголовокУзел);
    шапка.appendChild(действия);
    document.body.insertBefore(шапка, document.body.firstChild);
    КОРЕНЬ_HTML.classList.add('yk-shapka-est');
    if (объявлено.холст) КОРЕНЬ_HTML.classList.add('yk-holst');
    обновитьШапку();
    забратьДействия();
  }

  var СТРЕЛКА = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>';
  var КРЕСТ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function обновитьШапку() {
    if (!шапка) return;
    заголовокУзел.textContent = сейчас.имя || '';
    КОРЕНЬ_HTML.classList.toggle('yk-sloy', сейчас.тип === 'слой');
    if (сейчас.тип === 'корень') {           /* корень не рисует возврат НИКОГДА */
      кнопкаНазад.hidden = true;
      return;
    }
    кнопкаНазад.hidden = false;
    кнопкаНазад.innerHTML = сейчас.тип === 'слой' ? КРЕСТ : СТРЕЛКА;
    /* Подпись — только в aria-label: текстовая подпись обязана совпадать с
       целью, а цель в многостраничном приложении зависит от истории, которой
       подписи не видно. Стрелка + заголовок экрана ничего не обещают словами. */
    var куда = yasnaNav.верх();
    var имяЦели = (куда && куда.имя) || имяПути(запаснойРодитель()) || '';
    кнопкаНазад.setAttribute('aria-label',
      сейчас.тип === 'слой' ? ('Закрыть: ' + (сейчас.имя || ''))
                            : ('Назад' + (имяЦели ? ': ' + имяЦели : '')));
  }

  /* Действия страницы (лупа «Уроков», «Аа» книги, «История» Круга) переезжают
     в шапку вместе со своими обработчиками — их ставит сама страница. */
  function забратьДействия() {
    if (!действия) return;
    var список = document.querySelectorAll('[data-yk-deystvie]');
    for (var i = 0; i < список.length; i++) {
      var э = список[i];
      if (э.parentNode === действия) continue;
      э.classList.add('yk-deystvie');
      действия.appendChild(э);
    }
  }

  /* АВАТАР ПРОФИЛЯ В ШАПКЕ. Профиль — это «я», а не раздел: своей вкладки у
     него больше нет, и вход в него стоит там, где его ищут на телефоне —
     в правом углу шапки, на КАЖДОЙ корневой вкладке. Приём не новый: такой
     же зверь рисовался во вкладке наббара, он просто переехал.
     Переход кладём в стек руками. Перехватчик ссылок ниже пропускает всё,
     что лежит в шапке («оболочка ходит сама»), и без этой строки «назад» из
     Профиля возвращала бы всегда на «Сегодня» — а вернуться человек должен
     на ту вкладку, с которой вошёл (решение владельца).
     Зовётся ниже, когда посчитан зверь. */
  function аватарВШапке() {
    if (!действия || сейчас.тип !== 'корень' || !самКорень()) return;
    var a = document.createElement('a');
    a.className = 'yk-deystvie yk-avatar';
    a.href = вверх + 'profil.html';
    a.setAttribute('aria-label', 'Профиль');
    a.innerHTML = мойЗверь
      ? '<span class="yk-zver" aria-hidden="true">' + мойЗверь + '</span>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
        'stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.6"/>' +
        '<path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>';
    a.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
      e.preventDefault();
      yasnaNav.вглубь('profil.html', { откуда: сейчас.имя });
    });
    действия.appendChild(a);
  }

  function уйтиНазад() {
    /* Сперва спрашиваем страницу: у неё может быть свой уровень вглубь
       (открытая глава, раскрытый лист). Отменила событие — разобралась сама. */
    var соб;
    try { соб = new CustomEvent('yasna:назад', { cancelable: true }); }
    catch (_) {
      соб = document.createEvent('CustomEvent');
      соб.initCustomEvent('yasna:назад', false, true, null);
    }
    window.dispatchEvent(соб);
    if (соб.defaultPrevented) return;
    if (сейчас.тип === 'слой' && сейчас.закрыть) { сейчас.закрыть(); return; }
    yasnaNav.назад();
  }

  рисоватьШапку();
  /* Заголовок, живущий на самой странице (имя книги, имя разложенной ясны),
     ведём за ней: страница указывает узел атрибутом data-yk-imya-iz. */
  (function заголовокИзУзла() {
    var сел = атрибут('data-yk-imya-iz');
    if (!сел || !шапка) return;
    var узел = null;
    try { узел = document.querySelector(сел); } catch (_) {}
    if (!узел) return;
    var снять = function () {
      var т = (узел.textContent || '').trim();
      if (т && т !== сейчас.имя) { сейчас.имя = т; обновитьШапку(); }
    };
    снять();
    try { new MutationObserver(снять).observe(узел, { childList: true, characterData: true, subtree: true }); } catch (_) {}
  })();

  /* ══ 5. НАББАР ═════════════════════════════════════════════════════════ */
  /* Свой знак вместо человечка: если человек назвался или вошёл по почте,
     аватар в шапке показывает его зверя — как в мессенджерах. */
  var мойЗверь = (function () {
    try {
      var п = JSON.parse(localStorage.getItem('yasna_duel_profile') || 'null');
      if (!п || !п.avatar) return null;
      var вошёл = !!(localStorage.getItem('yasna_duel_token') && localStorage.getItem('yasna_duel_user'));
      var назвался = п.nickname && п.nickname !== 'Гость';
      return (вошёл || назвался) ? п.avatar : null;
    } catch (e) { return null; }
  })();
  аватарВШапке();

  /* Активна вкладка РОДИТЕЛЯ, а не файла. Порядок источников: объявление
     страницы → таблица родичей → метка ?otkuda (Круг) → низ стека. Экрана
     без подсвеченной вкладки быть не должно. */
  var текущий = (function () {
    if (самКорень()) return файл;
    /* Живой переход знает лучше любой таблицы: ищем ближайший корень в стеке
       (сверху вниз) — из него мы сюда и пришли. */
    for (var i = стек.length - 1; i >= 0; i--) if (стек[i].корень) return стек[i].файл;
    var запас = запаснойРодитель();
    return корневой(запас) ? запас : '';
  })();

  var nav = document.createElement('nav');
  nav.className = 'yk-nav';
  nav.setAttribute('aria-label', 'Разделы');
  nav.innerHTML = ПУНКТЫ.map(function (п) {
    var тут = п[0] === текущий;
    return '<a href="' + вверх + п[0] + '"' +
      (тут ? ' class="yk-tut" aria-current="page"' : '') + '>' +
      '<span class="yk-znak">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + п[2] + '</svg>' +
      '</span><span class="yk-podpis">' + п[1] + '</span></a>';
  }).join('');

  nav.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    /* Партию, урок и живую сцену вкладка не крадёт молча: экран может
       отменить уход и спросить сам («Прервать партию?»). Механизм тот же,
       что у аппаратной «назад», — отменяемое событие. */
    var уход;
    try { уход = new CustomEvent('yasna:уход', { cancelable: true, detail: { куда: a.getAttribute('href') } }); }
    catch (_) {
      уход = document.createEvent('CustomEvent');
      уход.initCustomEvent('yasna:уход', false, true, { куда: a.getAttribute('href') });
    }
    window.dispatchEvent(уход);
    if (уход.defaultPrevented) return;
    /* Тап по УЖЕ активной вкладке — наверх (стандарт нижней навигации).
       Но подсвеченной вкладка бывает и на «дочернем» экране (Переговоры и
       Книга подсвечивают «Уроки», Рейтинг — «Игры»): там прокрутка наверх
       выглядела так, будто вкладка сломана. С дочернего уходим на раздел. */
    if (a.getAttribute('aria-current') === 'page') {
      var свой = a.getAttribute('href');
      if (свой && свой.split('/').pop() !== файл) { yasnaNav.корень(свой); return; }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    yasnaNav.корень(a.getAttribute('href'));
  });
  document.body.appendChild(nav);

  /* ══ 6. ССЫЛКИ СТРАНИЦ ═════════════════════════════════════════════════
     Ссылка на корневой файл — это переключение вкладки, а не заход вглубь:
     иначе после карточки «Игры» на Главной экран Игр становился «дочерним»,
     с кнопкой возврата и полосой 52 px, которых на вкладке быть не может.
     Всё остальное — заход вглубь: кладём себя в стек и идём обычным переходом
     (браузер сам сохранит историю, а мы — имя, откуда пришли). */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (a.closest('.yk-nav') || a.closest('.yk-shapka')) return;   /* оболочка ходит сама */
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    var сюда = файлИз(href);
    if (сюда === файл && href.indexOf('?') < 0) return;            /* тот же экран */
    if (корневой(сюда) && href.indexOf('/krug/') < 0) {
      e.preventDefault();
      yasnaNav.корень(a.href);
      return;
    }
    yasnaNav.вглубь(null);                                          /* переход сделает браузер */
  }, true);

  /* Вернулись по истории — верх стека уже не про нас. Приведение делает то
     же, что при загрузке: снимает с вершины экран, на котором мы стоим. */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    стек = прочитать();
    while (стек.length && стек[стек.length - 1].файл === файл) стек.pop();
    записать(стек);
    обновитьШапку();
  });

  /* ══ 7. КЛАВИАТУРА ═════════════════════════════════════════════════════
     Было: «вьюпорт ниже 72 % от своего максимума — значит клавиатура». В
     разделённом экране (и в любом низком окне) наббар от этого исчезал
     совсем — уйти с экрана было нечем. Считаем по инсету IME: сколько
     нижней части окна отъела всплывшая панель. Родное событие с моста
     (yasna:клавиатура) главнее — оно знает правду от системы. */
  var сНатива = null;
  var vv = window.visualViewport;
  function проверитьКлавиатуру() {
    var видна;
    if (сНатива !== null) видна = сНатива;
    else if (vv) видна = (КОРЕНЬ_HTML.clientHeight - (vv.height + vv.offsetTop)) > 140;
    else видна = false;
    nav.classList.toggle('yk-klava', !!видна);
  }
  if (vv) {
    vv.addEventListener('resize', проверитьКлавиатуру);
    vv.addEventListener('scroll', проверитьКлавиатуру);
  }
  window.addEventListener('yasna:клавиатура', function (e) {
    сНатива = !!(e && e.detail && e.detail.видна);
    проверитьКлавиатуру();
  });
  проверитьКлавиатуру();

  /* Профиль сохраняет имя и зверя на этой же странице — событие storage
     в своей вкладке не приходит, поэтому даём ему прямой способ обновить
     аватар, не перезагружая экран. Имя функции прежнее: его зовёт
     app/profil.html, и переименование сломало бы вызов молча. */
  window.yasnaNavbarObnovi = function () {
    var а = действия && действия.querySelector('.yk-avatar');
    if (!а) return;
    var зверь = null;
    try {
      var п = JSON.parse(localStorage.getItem('yasna_duel_profile') || 'null');
      var вошёл = !!(localStorage.getItem('yasna_duel_token') && localStorage.getItem('yasna_duel_user'));
      if (п && п.avatar && (вошёл || (п.nickname && п.nickname !== 'Гость'))) зверь = п.avatar;
    } catch (e) {}
    var было = а.querySelector('.yk-zver, svg');
    if (!было || !зверь) return;
    if (было.classList.contains('yk-zver')) { было.textContent = зверь; return; }
    var s = document.createElement('span');
    s.className = 'yk-zver'; s.setAttribute('aria-hidden', 'true'); s.textContent = зверь;
    а.replaceChild(s, было);
  };
})();
