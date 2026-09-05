/* ═══════════════════════════════════════════════════════════════════════════
   ДРУЗЬЯ — свои люди в Ясне: код, заявки, список, приглашение в комнату.

   Почему так, а не иначе:
   • Сервера под друзей нет (квота функций 10/10, /profile правится только в
     облаке), зато есть рабочая Firebase RTDB, на которой уже живут комнаты.
   • Человека в RTDB нечем адресовать: анонимный auth.uid у одного и того же
     человека РАЗНЫЙ на сайте и в приложении (разный origin) и теряется при
     очистке данных. Поэтому идентичность друга — deviceId (ключ
     yasna_device_id_v1), тот самый, которым игрок уже подписан в комнатах.
   • Владение своим узлом доказывается как у слотов комнаты: первый, кто
     застолбил lyudi/<deviceId>, пишет туда свой uid, и дальше писать может
     только он (TOFU — доверие первому). Тот же приём проверен правилами
     комнат и адверсарным аудитом 23.06.2026.

   Дерево (см. firebase-rules.json):
     lyudi/<deviceId>            { nick, avatar, uid, ts }      — карточка
     kody/<КОД>                  { deviceId, uid, ts }          — код → человек
     zayavki/<кому>/<откого>     { nick, avatar, uid, ts }      — заявка
     otvety/<кому>/<откого>      { ok, nick, avatar, uid, ts }  — ответ на заявку
     druzya/<чей>/<друг>         { nick, avatar, ts }           — свой список
     zovy/<кому>/<pushId>        { code, kind, ot{…}, ts }      — зов в комнату

   Взаимность без записи в чужой список: принявший пишет ответ, а заявитель,
   увидев ответ, добавляет друга себе сам. Каждый пишет только в своё
   поддерево — правило остаётся простым и не даёт спамить чужие списки.

   Приглашать в комнату может только тот, кто уже в друзьях у адресата
   (проверка в правиле). Код комнаты = право её читать, поэтому раздавать
   его кому попало нельзя.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var КЛЮЧ_PID = 'yasna_pid_v1';            /* мой публичный id в базе друзей */
  var КЛЮЧ_КОД = 'yasna_moy_kod_v1';        /* мой код дружбы */
  var КЛЮЧ_ДРУЗЬЯ = 'yasna_druzya_v1';      /* зеркало списка: работает офлайн */
  var КЛЮЧ_СЛЕПОК = 'yasna_druzya_kartochka_v1'; /* что уже лежит в базе */
  var АЛФАВИТ = 'BCDFGHJKLMNPQRSTVWXZ23456789';   /* тот же, что у кодов комнат */

  var db = null, uid = null, готово = null;

  function профиль() {
    try { return JSON.parse(localStorage.getItem('yasna_duel_profile') || 'null') || {}; }
    catch (e) { return {}; }
  }
  /* Публичный id — СЛУЧАЙНЫЙ, не deviceId. deviceId светится в комнатах
     (rooms открыты на чтение любому вошедшему), и если бы адрес друга
     совпадал с ним, любой сосед по партии мог бы занять чужую карточку
     первым или завалить её заявками. Случайный pid знают только те, кому
     человек сам дал код. */
  function мойId() {
    try {
      var есть = localStorage.getItem(КЛЮЧ_PID);
      if (есть) return есть;
      var новый = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 20)
        : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(КЛЮЧ_PID, новый);
      return новый;
    } catch (e) { return null; }
  }
  function читать(ключ, поум) {
    try { var v = localStorage.getItem(ключ); return v ? JSON.parse(v) : поум; } catch (e) { return поум; }
  }
  function писать(ключ, знач) {
    try { localStorage.setItem(ключ, JSON.stringify(знач)); } catch (e) {}
  }

  /* Firebase поднимаем сами: rt-firebase.js живёт только на экране Игры, а
     друзья нужны и в Профиле, и на главной. Конфиг тот же — один проект. */
  var КОНФИГ = {
    apiKey: 'AIzaSyDQzZ2yrMkWGCAKi_zHoOWcgmoHWtlkIEc',
    authDomain: 'yasna-rt.firebaseapp.com',
    databaseURL: 'https://yasna-rt-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'yasna-rt',
    storageBucket: 'yasna-rt.firebasestorage.app',
    messagingSenderId: '790612199351',
    appId: '1:790612199351:web:4c42d8facfe1c582fcca32'
  };

  function подключиться() {
    if (готово) return готово;
    готово = new Promise(function (ок, нет) {
      if (typeof firebase === 'undefined') { нет(new Error('нет-sdk')); return; }
      var app;
      try { app = firebase.app(); } catch (e) { app = firebase.initializeApp(КОНФИГ); }
      db = firebase.database(app);
      var auth = firebase.auth(app);
      var срок = setTimeout(function () { нет(new Error('время-вышло')); }, 10000);
      auth.onAuthStateChanged(function (u) {
        if (!u) return;
        clearTimeout(срок); uid = u.uid; ок(true);
      });
      auth.signInAnonymously().catch(function (e) { clearTimeout(срок); нет(e); });
    });
    return готово;
  }

  function случайныйКод() {
    var к = '', б = new Uint8Array(6);
    try { (window.crypto || {}).getRandomValues && crypto.getRandomValues(б); }
    catch (e) { for (var q = 0; q < 6; q++) б[q] = Math.floor(Math.random() * 256); }
    for (var i2 = 0; i2 < 6; i2++) к += АЛФАВИТ[б[i2] % АЛФАВИТ.length];
    return к;
  }

  /* ══ ДРУЖБА ЖИВЁТ В ТАБЛИЦАХ ══════════════════════════════════════════
     Раньше она лежала в дереве Firebase, и оттуда следовали все беды: адрес
     человека был записью в памяти телефона (переустановил — стал другим),
     «убрать друга» правило разрешало только в своей половине (убранный
     продолжал видеть и звать), согласие ложилось в ящик otvety и дружба
     завершалась лишь тогда, когда позвавший сам откроет приложение, а мусор
     от прежних личностей оставался в дереве навсегда.

     Теперь всё это — две таблицы (миграция 006) и пять ручек сервера. Обе
     половины пары меняются ОДНИМ запросом, поэтому разойтись не могут.

     ЗАЧЕМ ДЕРЕВО ВСЁ-ТАКИ ОСТАЛОСЬ. Зовы в Партию живут в нём: им нужна
     секунда доставки. Их правило требует, чтобы ПОЛУЧАТЕЛЬ имел зовущего в
     СВОЁМ узле druzya/. Написать туда может только сам получатель — значит
     каждый отражает свой список друзей в дерево сам. Это тень, а не правда:
     правда в таблицах. Когда владелец опубликует правило зовов без проверки
     дружбы, тень можно снять. */

  var КЛЮЧ_СПИСОК_ТЕНЬ = 'yasna_druzya_ten_v1';

  function адресAPI() {
    var м = document.querySelector('meta[name="yasna:api"]');
    return (м && м.getAttribute('content')) || '';
  }
  /* Право на свой pid доказываем так же, как весь остальной бэкенд: токеном
     вошедшего либо секретом устройства. Голого адреса серверу мало — иначе,
     узнав чужой pid из заявки, можно было бы говорить от его имени. */
  function шапка() {
    var ш = { 'Content-Type': 'application/json' };
    try {
      var т = localStorage.getItem('yasna_duel_token');
      if (т) ш.Authorization = 'Bearer ' + т;
    } catch (e) {}
    try {
      if (window.YasnaStorage && window.YasnaStorage.deviceSecret)
        ш['X-Device-Secret'] = window.YasnaStorage.deviceSecret();
    } catch (e) {}
    return ш;
  }
  function зовAPI(путь, как, тело) {
    var база = адресAPI();
    if (!база) return Promise.reject(new Error('нет-api'));
    var url = база + путь;
    var П = (window.Capacitor && window.Capacitor.Plugins) || {};
    /* В приложении — нативным запросом: тот же приём, что у проверки
       обновлений, и он не зависит от настроек CORS. */
    if (П.CapacitorHttp) {
      var з = (как === 'POST')
        ? П.CapacitorHttp.post({ url: url, headers: шапка(), data: тело || {} })
        : П.CapacitorHttp.get({ url: url, headers: шапка() });
      return з.then(function (r) {
        var д = typeof r.data === 'string' ? JSON.parse(r.data || '{}') : (r.data || {});
        if (r.status >= 400) { var e = new Error(д.detail || д.error || ('код ' + r.status)); e.код = r.status; throw e; }
        return д;
      });
    }
    return fetch(url, { method: как, headers: шапка(),
                        body: тело ? JSON.stringify(тело) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (д) {
          if (!r.ok) { var e = new Error(д.detail || д.error || ('код ' + r.status)); e.код = r.status; throw e; }
          return д;
        });
      });
  }

  /* ── Мой код ─────────────────────────────────────────────────────────
     Код теперь выдаёт сервер и хранит таблица. Локальную копию держим, чтобы
     показать его сразу, не дожидаясь сети, — но истина на сервере. */
  function мойКод() { return читать(КЛЮЧ_КОД, null); }

  /* ── Объявиться ──────────────────────────────────────────────────────
     Заводит или обновляет карточку и отдаёт код. Прежний код передаём с
     собой: у людей, заведённых до переезда, он уже разослан друзьям, и менять
     его — значит рвать связь с теми, кто его записал. */
  function объявиться() {
    var id = мойId(), п = профиль();
    if (!id) return Promise.reject(new Error('нет-профиля'));
    var д = '';
    try { д = localStorage.getItem('yasna_device_id_v1') || ''; } catch (e) {}
    return зовAPI('/druzya/ya', 'POST', {
      pid: id, deviceId: д,
      nick: (п.nickname || 'Игрок').slice(0, 40),
      avatar: (п.avatar || '✦').slice(0, 8),
      kod: читать(КЛЮЧ_КОД, null) || undefined
    }).then(function (о) {
      /* СЕРВЕР МОГ ВЕРНУТЬ ДРУГОЙ АДРЕС. Так бывает у вошедшего на новом
         телефоне: здесь приложение сочинило себе новый адрес, а в базе уже
         лежит его прежний — с друзьями. Принимаем настоящий и запоминаем,
         иначе человек пришёл бы в свой аккаунт и не нашёл никого. Зеркала
         при смене адреса сбрасываем: они от прежней жизни. */
      if (о && о.pid && о.pid !== id) {
        try { localStorage.setItem(КЛЮЧ_PID, о.pid); } catch (e) {}
        писать(КЛЮЧ_ДРУЗЬЯ, []);
        писать(КЛЮЧ_СПИСОК_ТЕНЬ, []);
        писать(КЛЮЧ_СЛЕПОК, null);
        кэш = null;
        id = о.pid;
      }
      if (о && о.kod) писать(КЛЮЧ_КОД, о.kod);
      /* Тень в дереве: без карточки lyudi/<pid> правило зовов не пустит. */
      теньКарточки(id, п).catch(function () {});
      return о && о.kod;
    });
  }

  /* Тень карточки в дереве. Пишем только при расхождении: слепок держим у
     себя, и сошёлся — сеть не трогаем. */
  function слепок(id, п) {
    return [id, (п.nickname || 'Игрок').slice(0, 40),
            (п.avatar || '✦').slice(0, 8), uid].join('\u0001');
  }
  function теньКарточки(id, п) {
    return подключиться().then(function () {
      if (читать(КЛЮЧ_СЛЕПОК, null) === слепок(id, п)) return true;
      return db.ref('lyudi/' + id).update({
        nick: (п.nickname || 'Игрок').slice(0, 40),
        avatar: (п.avatar || '✦').slice(0, 8), uid: uid, ts: Date.now()
      }).then(function () { писать(КЛЮЧ_СЛЕПОК, слепок(id, п)); return true; });
    });
  }

  /* Тень списка друзей. Правило зовов смотрит в узел ПОЛУЧАТЕЛЯ, а писать
     туда может только он сам — поэтому каждый отражает свой список. Пишем
     только разницу: список меняется редко, а лишняя запись в общую базу
     стоит денег и подключений. */
  function теньСписка(мои) {
    var id = мойId();
    if (!id) return Promise.resolve();
    var было = читать(КЛЮЧ_СПИСОК_ТЕНЬ, []) || [];
    var стало = мои.map(function (ч) { return ч.pid; }).sort();
    if (было.join(',') === стало.join(',')) return Promise.resolve();
    return подключиться().then(function () {
      var дела = мои.map(function (ч) {
        return db.ref('druzya/' + id + '/' + ч.pid)
          .update({ nick: ч.nick, avatar: ч.avatar, ts: Date.now() })
          .catch(function () {});
      });
      было.forEach(function (p) {
        if (стало.indexOf(p) < 0) дела.push(db.ref('druzya/' + id + '/' + p).remove().catch(function () {}));
      });
      return Promise.all(дела).then(function () { писать(КЛЮЧ_СПИСОК_ТЕНЬ, стало); });
    }).catch(function () {});
  }

  /* ── Разовый перенос дружбы из прежнего дерева ───────────────────────
     У людей, заведённых до переезда, друзья лежат в зеркале списка (и в
     дереве), а в таблицах их нет. Без этого шага обновление оставило бы
     человека с пустым списком — потеря, а не переезд.

     Сервер заводит пары ЗАЯВКАМИ, а не дружбой: поверить приложению на слово,
     с кем оно дружило, нельзя. Когда вторая сторона тоже обновится и пришлёт
     свой список, половины сойдутся сами — это тот же путь, что у встречных
     заявок. Делаем один раз: метка остаётся, даже если перенос ничего не
     нашёл, иначе запрос уходил бы при каждом заходе. */
  var КЛЮЧ_ПЕРЕНОС = 'yasna_druzya_perenos_v1';
  function перенести() {
    try { if (localStorage.getItem(КЛЮЧ_ПЕРЕНОС)) return Promise.resolve(null); } catch (e) {}
    var старые = (списокЛокально() || [])
      .map(function (ч) { return ч.pid || ч.deviceId; })
      .filter(function (p) { return !!p; });
    var пометить = function () {
      try { localStorage.setItem(КЛЮЧ_ПЕРЕНОС, String(Date.now())); } catch (e) {}
    };
    if (!старые.length) { пометить(); return Promise.resolve(null); }
    return зовAPI('/druzya/perenos', 'POST', { pid: мойId(), pids: старые })
      .then(function (о) { пометить(); кэш = null; return о; })
      /* Не вышло — метку НЕ ставим: попробуем в следующий раз. Потерять
         список из-за одного неудачного запроса нельзя. */
      .catch(function () { return null; });
  }

  /* ── Состояние: друзья, входящие, посланные ──────────────────────────
     Одним запросом. Держим его несколько секунд: экран профиля спрашивает и
     друзей, и заявки подряд, а это один и тот же ответ. */
  var кэш = null, кэшКогда = 0;
  var КЭШ_ЖИВЁТ = 5000;
  function состояние(свежее) {
    if (!свежее && кэш && (Date.now() - кэшКогда) < КЭШ_ЖИВЁТ) return Promise.resolve(кэш);
    var id = мойId();
    if (!id) return Promise.resolve({ druzya: [], vhodyashchie: [], poslannye: [] });
    return зовAPI('/druzya?pid=' + encodeURIComponent(id), 'GET').then(function (о) {
      кэш = { druzya: о.druzya || [], vhodyashchie: о.vhodyashchie || [], poslannye: о.poslannye || [] };
      кэшКогда = Date.now();
      /* Зеркало для показа без сети + тень для зовов. */
      писать(КЛЮЧ_ДРУЗЬЯ, кэш.druzya.map(одеть));
      теньСписка(кэш.druzya);
      return кэш;
    });
  }
  /* Поле deviceId оставлено ИМЕНЕМ ради тех, кто читает список (Партия,
     главная): значение — тот же публичный адрес, что и был. Переименовать
     его — отдельная правка, и делать её заодно с переездом базы не стоит. */
  function одеть(ч) {
    return { pid: ч.pid, deviceId: ч.pid, nick: ч.nick || 'Игрок',
             avatar: ч.avatar || '✦', ts: ч.ts || 0 };
  }

  function списокЛокально() { return читать(КЛЮЧ_ДРУЗЬЯ, []) || []; }

  function друзья() {
    return состояние(true).then(function (с) {
      return с.druzya.map(одеть).sort(function (a, b) {
        return (a.nick || '').localeCompare(b.nick || '');
      });
    }).catch(function () { return списокЛокально(); });
  }

  function заявки() {
    return состояние(false).then(function (с) { return с.vhodyashchie.map(одеть); })
      .catch(function () { return []; });
  }
  /* Кому я сам написал и жду ответа. Раньше это жило только в памяти
     телефона и никому не показывалось. */
  function посланные() {
    return состояние(false).then(function (с) { return с.poslannye.map(одеть); })
      .catch(function () { return []; });
  }

  function позвать(код) {
    var К = String(код || '').trim().toUpperCase().replace(/\s+/g, '');
    if (К.length !== 6) return Promise.reject(new Error('короткий-код'));
    if (К === мойКод()) return Promise.reject(new Error('это-я'));
    return объявиться().then(function () {
      return зовAPI('/druzya/pozvat', 'POST', { pid: мойId(), kod: К });
    }).then(function (о) {
      кэш = null;
      return о;
    });
  }

  function принять(другId) {
    return зовAPI('/druzya/prinyat', 'POST', { pid: мойId(), drugPid: другId })
      .then(function () { кэш = null; return друзья(); });
  }
  function отклонить(другId) {
    return зовAPI('/druzya/zabyt', 'POST', { pid: мойId(), drugPid: другId })
      .then(function () { кэш = null; });
  }
  function забыть(другId) {
    /* Убираем из зеркала сразу: иначе при недоступном сервере человек жмёт
       «Убрать», видит ошибку и того же друга на месте. */
    писать(КЛЮЧ_ДРУЗЬЯ, списокЛокально().filter(function (ч) {
      return ч.pid !== другId && ч.deviceId !== другId;
    }));
    return зовAPI('/druzya/zabyt', 'POST', { pid: мойId(), drugPid: другId })
      .then(function () { кэш = null; return друзья(); })
      .catch(function () { return списокЛокально(); });
  }
  /* Ящик ответов исчез вместе с переездом: согласие теперь ложится обеим
     сторонам сразу. Имя оставлено, чтобы не ломать тех, кто его звал, — но
     делает оно ровно одно: перечитывает список. */
  function забратьОтветы() { return друзья().then(function (с) { return с.length; }); }

  /* ── Зов в комнату ──────────────────────────────────────────────────── */
  function позватьВКомнату(другId, код, вид) {
    var id = мойId(), п = профиль();
    return подключиться().then(function () {
      return db.ref('zovy/' + другId).push({
        code: String(код).slice(0, 16),
        kind: (вид || '2p').slice(0, 16),
        ot: { pid: id, nick: (п.nickname || 'Игрок').slice(0, 40), avatar: (п.avatar || '✦').slice(0, 8) },
        ts: Date.now()
      });
    });
  }

  /* Слушать зовы, адресованные мне. Возвращает функцию отписки. */
  function слушатьЗовы(при) {
    var id = мойId();
    if (!id) return function () {};
    var ссылка = null;
    подключиться().then(function () {
      ссылка = db.ref('zovy/' + id);
      ссылка.on('child_added', function (сн) {
        var з = сн.val() || {};
        /* Протухшие зовы (старше получаса) молча убираем: у Firebase на
           бесплатном тарифе нет ни планировщика, ни TTL. */
        if (Date.now() - (з.ts || 0) > 30 * 60000) { сн.ref.remove(); return; }
        при(Object.assign({ id: сн.key, снять: function () { сн.ref.remove(); } }, з));
      });
    }).catch(function () {});
    return function () { if (ссылка) ссылка.off(); };
  }

  window.YasnaDruzya = {
    мойКод: мойКод,
    объявиться: объявиться,
    перенести: перенести,
    друзья: друзья,
    списокЛокально: списокЛокально,
    позвать: позвать,
    заявки: заявки,
    принять: принять,
    отклонить: отклонить,
    забратьОтветы: забратьОтветы,
    посланные: посланные,
    забыть: забыть,
    позватьВКомнату: позватьВКомнату,
    слушатьЗовы: слушатьЗовы,
    доступно: function () { return typeof firebase !== 'undefined'; }
  };
})();
