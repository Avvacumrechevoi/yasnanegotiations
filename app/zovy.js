/* ═══════════════════════════════════════════════════════════════════════════
   ЗОВЫ ДРУЗЕЙ — «тебя зовут в комнату» на любом экране приложения.

   Друг нажал «Позвать» в лобби → в базе появился зов на моё имя. Этот файл
   показывает карточку поверх экрана: «Ратибор зовёт в Партию» с кнопками
   «Войти» и «Позже». Войти — открывает ту самую комнату по коду.

   Firebase грузим ОТЛОЖЕННО и только там, где его ещё нет: на экране Игры
   SDK уже подключён страницей, а главную и прочие экраны нельзя утяжелять
   до первой отрисовки — зов не настолько срочен, чтобы задерживать старт.

   И только там, где есть кому звать. Раньше этот файл поднимал базу на
   КАЖДОМ экране — на Книге, на Круге, на «не найдено»: 330 кБ разбора,
   анонимный вход, три обращения к Google и постоянный сокет в Европу, — и
   всё это ради ящика, который у большинства людей пуст всегда. Пуст он не
   случайно: позвать в комнату может только тот, кто УЖЕ у меня в друзьях
   (так написано правило базы), а друзья заводятся обменом кодами на
   Профиле. Значит:
     • экран не Профиль и не Игры — не трогаем сеть вовсе;
     • Профиль и Игры без друзей — поднимаем только core/druzya.js (10 кБ,
       без Firebase): экран покажет пустой список и подсказку про коды;
     • есть друзья или отправленная заявка — как прежде, со слушателем.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (!/YasnaApp\//.test(navigator.userAgent)) return;   /* только приложение */

  var ФАЙЛЫ = [
    'vendor/js/firebase-app-compat-10.13.2.js',
    'vendor/js/firebase-auth-compat-10.13.2.js',
    'vendor/js/firebase-database-compat-10.13.2.js',
    /* Транспорт грузим ПЕРЕД друзьями: они через него ходят на сервер. */
    'core/svyaz.js',
    'core/druzya.js'
  ];

  function путьВверх() {
    var части = location.pathname.split('/').filter(Boolean);
    return части.length > 1 ? '../'.repeat(части.length - 1) : '';
  }

  /* Есть ли в хранилище хоть один свой человек. Список друзей — зеркало из
     core/druzya.js, оно же работает офлайн; исходящие заявки считаем тоже:
     пока ответ не забран, дружбы ещё нет, а база уже нужна. */
  function непусто(ключ) {
    try {
      var сырое = localStorage.getItem(ключ);
      if (!сырое) return false;
      var знач = JSON.parse(сырое);
      return Array.isArray(знач) ? знач.length > 0
                                 : !!(знач && Object.keys(знач).length);
    } catch (e) { return false; }
  }
  function естьСвои() {
    /* Раньше сюда входил и список исходящих заявок. После переезда дружбы в
       таблицы его никто не пишет, да он и не был нужен: зов приходит только
       от друга, а значит достаточно списка друзей. */
    return непусто('yasna_druzya_v1');
  }

  /* Экраны, где зов уместен: Профиль (там живут свои люди — код, заявки,
     список) и Игры (оттуда зовут в комнату). На Книге или в Круге карточка
     «тебя зовут» всё равно уводит с экрана, а база стоит дорого. */
  function экранЗовов() {
    var файл = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return файл === 'profil.html' || файл === 'duel.html';
  }

  function подгрузить(список) {
    return список.reduce(function (цепь, файл) {
      return цепь.then(function () {
        return new Promise(function (ок) {
          var s = document.createElement('script');
          s.src = путьВверх() + файл;
          s.onload = function () { ок(); };
          s.onerror = function () { ок(); };   /* нет файла — просто без зовов */
          document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
  }

  function стили() {
    if (document.getElementById('yz-stili')) return;
    var st = document.createElement('style');
    st.id = 'yz-stili';
    st.textContent =
      '.yz-zov{position:fixed;left:12px;right:12px;top:calc(12px + env(safe-area-inset-top,0px));' +
        'z-index:140;display:flex;align-items:center;gap:11px;border-radius:16px;padding:11px 12px;' +
        'background:#1a1d21;border:1px solid #0077FF;color:#f2f4f7;' +
        'box-shadow:0 12px 30px rgba(0,0,0,.34);animation:yz-in .28s cubic-bezier(.2,.9,.3,1) both}' +
      '@media (prefers-color-scheme: light){:root:not([data-theme="dark"]) .yz-zov{background:#fff;color:#101418;' +
        'box-shadow:0 12px 28px rgba(16,20,24,.18)}}' +
      ':root[data-theme="light"] .yz-zov{background:#fff;color:#101418;box-shadow:0 12px 28px rgba(16,20,24,.18)}' +
      '@keyframes yz-in{from{opacity:0;transform:translateY(-10px)}}' +
      '.yz-zver{width:34px;height:34px;flex:0 0 auto;border-radius:50%;background:rgba(127,140,160,.18);' +
        'display:flex;align-items:center;justify-content:center;font-size:18px}' +
      '.yz-txt{flex:1;min-width:0;display:block}' +
      '.yz-kto{display:block;font:600 14px/1.2 Manrope,system-ui,sans-serif}' +
      '.yz-chto{display:block;font-size:12.5px;opacity:.72;margin-top:2px}' +
      '.yz-kn{display:flex;gap:6px;flex:0 0 auto}' +
      '.yz-kn button{min-height:38px;padding:0 12px;border-radius:11px;border:0;' +
        'font:600 12.5px/1 Manrope,system-ui,sans-serif;cursor:pointer}' +
      '.yz-kn .da{background:#0077FF;color:#fff}' +
      '.yz-kn .net{background:transparent;color:inherit;opacity:.7}';
    document.head.appendChild(st);
  }

  var очередь = [];

  function карточка(зов) {
    стили();
    /* Второй зов ждёт своей очереди, а не пропадает молча. */
    if (document.querySelector('.yz-zov')) { очередь.push(зов); return; }
    var д = document.createElement('div');
    д.className = 'yz-zov';
    д.setAttribute('role', 'status');
    var кто = (зов.ot && зов.ot.nick) || 'Друг';
    var зверь = (зов.ot && зов.ot.avatar) || '✦';
    var что = зов.kind === 'group' ? 'зовёт в партию с компанией' : 'зовёт сыграть партию';
    д.innerHTML =
      '<span class="yz-zver" aria-hidden="true"></span>' +
      '<span class="yz-txt"><span class="yz-kto"></span><span class="yz-chto"></span></span>' +
      '<span class="yz-kn"><button type="button" class="da">Войти</button>' +
      '<button type="button" class="net">Позже</button></span>';
    д.querySelector('.yz-zver').textContent = зверь;
    д.querySelector('.yz-kto').textContent = кто;
    д.querySelector('.yz-chto').textContent = что;
    д.querySelector('.da').onclick = function () {
      зов.снять();   /* вошли — зов отработал */
      var парам = зов.kind === 'group' ? 'kroom' : 'room';
      location.href = путьВверх() + 'duel.html?' + парам + '=' + encodeURIComponent(зов.code);
    };
    д.querySelector('.net').onclick = function () { закрыть(д); };
    function закрыть(узел) {
      узел.remove();
      var следующий = очередь.shift();
      if (следующий) setTimeout(function () { карточка(следующий); }, 320);
    }
    document.body.appendChild(д);
    /* Через полторы минуты карточка уходит сама: комната всё равно живёт
       ограниченное время, а висящая плашка перекрывает шапку экрана. */
    setTimeout(function () { if (д.isConnected) закрыть(д); }, 90000);
  }

  function запустить() {
    if (!window.YasnaDruzya) return;
    /* Модуль подняли ради самого экрана (пустой список и подсказка про
       коды), а сеть тут ни при чём: звать некому. */
    if (!естьСвои()) return;
    /* Объявиться нужно, иначе правила базы не признают ящик своим. */
    /* Слушаем зовы СРАЗУ и независимо: право читать свой ящик не зависит
       от того, удалось ли обновить карточку, а прежняя цепочка молча
       глотала приглашения при любом сбое записи. */
    try { window.YasnaDruzya.слушатьЗовы(карточка); } catch (e) {}
    window.YasnaDruzya.объявиться()
      /* Подтверждения заявок забираем здесь же: иначе дружба появлялась бы
         у отправителя только после захода в Профиль. */
      .then(function () { return window.YasnaDruzya.забратьОтветы(); })
      .then(function () { return window.YasnaDruzya.друзья(); })
      .catch(function () {});
  }

  function начать() {
    /* Книга, Круг, Уроки, Разбор, «не найдено» — сюда зов не приходит.
       Раньше они всё равно платили за Firebase на каждом переходе. */
    if (!экранЗовов()) return;
    var свои = естьСвои();
    if (window.YasnaDruzya && (!свои || typeof firebase !== 'undefined')) { запустить(); return; }
    подгрузить(ФАЙЛЫ.filter(function (ф) {
      /* Без друзей SDK не нужен: модуль сам ответит из зеркала в хранилище. */
      if (/firebase/.test(ф) && (!свои || typeof firebase !== 'undefined')) return false;
      if (/druzya/.test(ф) && window.YasnaDruzya) return false;
      return true;
    })).then(запустить);
  }

  /* После первой отрисовки и с запасом: старт экрана важнее зова. */
  if (document.readyState === 'complete') setTimeout(начать, 1200);
  else window.addEventListener('load', function () { setTimeout(начать, 1200); });
})();
