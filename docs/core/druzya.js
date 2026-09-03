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
  var КЛЮЧ_ИСХОД = 'yasna_zayavki_out_v1';  /* кому я сам отправлял заявки */
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

  /* ── Моя карточка и мой код ─────────────────────────────────────────── */
  function мойКод() {
    var есть = читать(КЛЮЧ_КОД, null);
    if (есть) return есть;
    var id = мойId();
    if (!id) return null;
    var к = случайныйКод();
    писать(КЛЮЧ_КОД, к);
    return к;
  }

  /* Публикуем себя: карточку и код. Без этого друг не найдёт по коду.

     Пишем ТОЛЬКО когда карточка разошлась с тем, что уже лежит в базе.
     Раньше объявиться() звали на каждом заходе на экран, и каждый заход
     стоил двух записей в общую базу — при том, что имя и зверь меняются
     раз в жизни, а код и подавно. Слепок держим у себя: сошёлся — сеть не
     трогаем вовсе. В слепок входит и uid: после очистки данных вход даёт
     новый uid, и карточку надо переподписать, иначе правило TOFU перестанет
     признавать узел своим. */
  function слепок(id, код, п) {
    return [id, код, (п.nickname || 'Игрок').slice(0, 40),
            (п.avatar || '✦').slice(0, 8), uid].join('\u0001');
  }

  function объявиться() {
    var id = мойId(), к = мойКод(), п = профиль();
    if (!id || !к) return Promise.reject(new Error('нет-профиля'));
    return подключиться().then(function () {
      if (читать(КЛЮЧ_СЛЕПОК, null) === слепок(id, к, п)) return true;
      var карточка = { nick: (п.nickname || 'Игрок').slice(0, 40),
                       avatar: (п.avatar || '✦').slice(0, 8), uid: uid, ts: Date.now() };
      /* Раздельно: если код кем-то занят (совпадение), карточка всё равно
         должна встать — иначе у человека отваливаются и друзья, и зовы. */
      return db.ref('lyudi/' + id).update(карточка).then(function () {
        return db.ref('kody/' + к).update({ pid: id, uid: uid, ts: Date.now() })
          .then(function () { return к; })
          .catch(function () {
            /* Код занят — берём новый и пробуем ещё раз (один раз). */
            var н = случайныйКод(); писать(КЛЮЧ_КОД, н);
            return db.ref('kody/' + н).update({ pid: id, uid: uid, ts: Date.now() })
              .then(function () { return н; });
          });
      }).then(function (кодИтог) {
        /* Слепок ставим только после удачной записи: сорвалось — в
           следующий раз попробуем снова, а не промолчим навсегда. */
        писать(КЛЮЧ_СЛЕПОК, слепок(id, кодИтог, п));
        return true;
      });
    });
  }

  /* ── Список друзей: зеркало в localStorage + свежесть из базы ───────── */
  function списокЛокально() { return читать(КЛЮЧ_ДРУЗЬЯ, []) || []; }

  function друзья() {
    var id = мойId();
    if (!id) return Promise.resolve(списокЛокально());
    return подключиться().then(function () {
      return db.ref('druzya/' + id).once('value');
    }).then(function (снимок) {
      var из = снимок.val() || {}, список = [];
      Object.keys(из).forEach(function (did) {
        список.push({ deviceId: did, nick: из[did].nick || 'Игрок', avatar: из[did].avatar || '✦', ts: из[did].ts || 0 });
      });
      список.sort(function (a, b) { return (a.nick || '').localeCompare(b.nick || ''); });
      писать(КЛЮЧ_ДРУЗЬЯ, список);
      /* Имя и зверь в списке — копия на момент дружбы. Подтягиваем свежие
         карточки: человек мог переименоваться, и друг не должен видеть
         старое имя вечно. Ошибки чтения не мешают показать список. */
      Promise.all(список.map(function (ч) {
        return db.ref('lyudi/' + ч.deviceId).once('value').then(function (к) {
          var v = к.val(); if (!v) return;
          if ((v.nick && v.nick !== ч.nick) || (v.avatar && v.avatar !== ч.avatar)) {
            ч.nick = v.nick || ч.nick; ч.avatar = v.avatar || ч.avatar;
            return db.ref('druzya/' + id + '/' + ч.deviceId)
              .update({ nick: ч.nick, avatar: ч.avatar });
          }
        }).catch(function () {});
      })).then(function () { писать(КЛЮЧ_ДРУЗЬЯ, список); }).catch(function () {});
      return список;
    }).catch(function () { return списокЛокально(); });
  }

  /* ── Заявка в друзья по коду ────────────────────────────────────────── */
  function позвать(код) {
    var К = String(код || '').trim().toUpperCase().replace(/\s+/g, '');
    if (К.length !== 6) return Promise.reject(new Error('короткий-код'));
    if (К === мойКод()) return Promise.reject(new Error('это-я'));
    var id = мойId(), п = профиль();
    return объявиться().then(function () {
      return db.ref('kody/' + К).once('value');
    }).then(function (с) {
      var знач = с.val();
      if (!знач || !знач.pid) throw new Error('нет-такого');
      var цель = знач.pid;
      if (цель === id) throw new Error('это-я');
      return db.ref('zayavki/' + цель + '/' + id).set({
        nick: (п.nickname || 'Игрок').slice(0, 40),
        avatar: (п.avatar || '✦').slice(0, 8), uid: uid, ts: Date.now()
      }).then(function () {
        /* Помним, кому написали: чужой «ответ» без нашей заявки — попытка
           навязать дружбу, и мы его не примем. */
        var исход = читать(КЛЮЧ_ИСХОД, {}) || {};
        исход[цель] = Date.now();
        писать(КЛЮЧ_ИСХОД, исход);
        return { deviceId: цель };
      });
    });
  }

  /* Мои входящие заявки (кто просится ко мне) */
  function заявки() {
    var id = мойId();
    if (!id) return Promise.resolve([]);
    return подключиться().then(function () {
      return db.ref('zayavki/' + id).once('value');
    }).then(function (с) {
      var из = с.val() || {};
      return Object.keys(из).map(function (did) {
        return { deviceId: did, nick: из[did].nick || 'Игрок', avatar: из[did].avatar || '✦', ts: из[did].ts || 0 };
      });
    }).catch(function () { return []; });
  }

  function принять(другId, ник, аватар) {
    var id = мойId(), п = профиль();
    return подключиться().then(function () {
      /* Порядок важен: правило разрешает ответ, только пока жива заявка,
         поэтому сносим её последней. */
      return db.ref('otvety/' + другId + '/' + id).set({
        ok: true, nick: (п.nickname || 'Игрок').slice(0, 40),
        avatar: (п.avatar || '✦').slice(0, 8), uid: uid, ts: Date.now()
      }).then(function () {
        return db.ref('druzya/' + id + '/' + другId)
          .set({ nick: ник || 'Игрок', avatar: аватар || '✦', ts: Date.now() });
      }).then(function () {
        return db.ref('zayavki/' + id + '/' + другId).remove();
      });
    }).then(друзья);
  }

  function отклонить(другId) {
    var id = мойId();
    return подключиться().then(function () {
      return db.ref('zayavki/' + id + '/' + другId).remove();
    });
  }

  /* Ответы на мои заявки: подтверждённых переношу к себе в список */
  function забратьОтветы() {
    var id = мойId();
    if (!id) return Promise.resolve(0);
    return подключиться().then(function () {
      return db.ref('otvety/' + id).once('value');
    }).then(function (с) {
      var из = с.val() || {}, все = Object.keys(из);
      var исход = читать(КЛЮЧ_ИСХОД, {}) || {};
      /* Чужой ответ без нашей заявки — навязанная дружба: стираем молча. */
      var чужие = все.filter(function (k) { return !исход[k]; });
      чужие.forEach(function (k) { db.ref('otvety/' + id + '/' + k).remove().catch(function () {}); });
      var ключи = все.filter(function (k) { return !!исход[k] && из[k] && из[k].ok === true; });
      if (!ключи.length) return 0;
      var дела = ключи.map(function (did) {
        return db.ref('druzya/' + id + '/' + did)
          .set({ nick: из[did].nick || 'Игрок', avatar: из[did].avatar || '✦', ts: Date.now() })
          .then(function () { return db.ref('otvety/' + id + '/' + did).remove(); })
          .then(function () {
            var и2 = читать(КЛЮЧ_ИСХОД, {}) || {}; delete и2[did]; писать(КЛЮЧ_ИСХОД, и2);
          });
      });
      return Promise.all(дела).then(function () { return ключи.length; });
    }).catch(function () { return 0; });
  }

  function забыть(другId) {
    var id = мойId();
    /* Убираем из зеркала сразу: иначе при закрытой базе человек жмёт
       «Убрать», видит ошибку и того же друга на месте. */
    писать(КЛЮЧ_ДРУЗЬЯ, списокЛокально().filter(function (ч) { return ч.deviceId !== другId; }));
    return подключиться().then(function () {
      return db.ref('druzya/' + id + '/' + другId).remove();
    }).then(друзья).catch(function () { return списокЛокально(); });
  }

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
    друзья: друзья,
    списокЛокально: списокЛокально,
    позвать: позвать,
    заявки: заявки,
    принять: принять,
    отклонить: отклонить,
    забратьОтветы: забратьОтветы,
    забыть: забыть,
    позватьВКомнату: позватьВКомнату,
    слушатьЗовы: слушатьЗовы,
    доступно: function () { return typeof firebase !== 'undefined'; }
  };
})();
