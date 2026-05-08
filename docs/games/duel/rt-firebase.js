// ═══════════════════════════════════════════════════════════════════
// Real-time PvP transport — Firebase Realtime Database
//
// Заменяет старый polling-relay через Yandex Cloud Functions.
// Преимущества:
//   • WebSocket под капотом (latency 100–300 мс vs 500–700)
//   • Никакой серверной логики (вся работа клиентская)
//   • Бесплатный free tier (до 100 одновр. подключений)
//   • Никаких типов и миграций — просто JSON-дерево
//
// Структура данных:
//   rooms/<KASTA-XXXX>/
//     meta:    { status, createdAt, version }
//     host:    { deviceId, nickname, avatar, lastSeen }
//     guest:   { deviceId, nickname, avatar, lastSeen }   ← после join
//     messages/<pushId>: { from, type, payload, ts }
//
// Экспортирует window.YasnaRT с тем же API что у старого транспорта:
//   createRoom({deviceId, nickname, avatar}) → { code }
//   joinRoom(code, {deviceId, nickname, avatar}) → { host }
//   waitForGuest(code, {timeoutMs}) → { nickname, avatar }
//   makeTransport({code, deviceId, role}) → { send, on, close, startHeartbeat }
// ═══════════════════════════════════════════════════════════════════

(function(){
  'use strict';

  // ─── Конфиг (публичные ключи — безопасно) ────────────────────────
  const firebaseConfig = {
    apiKey: "AIzaSyDQzZ2yrMkWGCAKi_zHoOWcgmoHWtlkIEc",
    authDomain: "yasna-rt.firebaseapp.com",
    databaseURL: "https://yasna-rt-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "yasna-rt",
    storageBucket: "yasna-rt.firebasestorage.app",
    messagingSenderId: "790612199351",
    appId: "1:790612199351:web:4c42d8facfe1c582fcca32"
  };

  // ─── Инициализация (ленивая, при первом обращении) ───────────────
  let app = null;
  let db = null;
  let auth = null;
  let authPromise = null;

  function init(){
    if(app) return;
    if(typeof firebase === 'undefined'){
      throw new Error('Firebase SDK не загружен. Проверь script-теги в duel.html.');
    }
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    auth = firebase.auth();
  }

  function ensureAuth(){
    if(authPromise) return authPromise;
    init();
    authPromise = new Promise((resolve, reject) => {
      const unsub = auth.onAuthStateChanged((user) => {
        if(user){
          unsub();
          resolve(user);
        }
      });
      auth.signInAnonymously().catch(err => {
        console.error('[firebase] anon auth failed', err);
        reject(err);
      });
      // Защита от вечного зависания
      setTimeout(() => reject(new Error('auth timeout')), 10000);
    });
    return authPromise;
  }

  // ─── Генерация KASTA-кода ────────────────────────────────────────
  const ROOM_CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ23456789';
  function genRoomCode(){
    let s = 'KASTA-';
    for(let i = 0; i < 4; i++) s += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    return s;
  }

  function validCode(code){
    return /^KASTA-[A-Z0-9]{4}$/.test(String(code || '').toUpperCase());
  }

  // ─── HOST: создание комнаты ──────────────────────────────────────
  async function createRoom({ deviceId, nickname, avatar }){
    if(!deviceId || !nickname) throw new Error('deviceId и nickname обязательны');
    await ensureAuth();

    // Подбираем уникальный код (до 5 попыток)
    let code = null;
    for(let i = 0; i < 5; i++){
      const candidate = genRoomCode();
      const snap = await db.ref('rooms/' + candidate + '/meta').get();
      if(!snap.exists()){
        code = candidate;
        break;
      }
    }
    if(!code) throw new Error('Не удалось сгенерировать уникальный код');

    const TS = firebase.database.ServerValue.TIMESTAMP;

    // Атомарная запись комнаты
    await db.ref('rooms/' + code).set({
      meta: {
        status: 'waiting',
        createdAt: TS,
        version: 2,
      },
      host: {
        deviceId: String(deviceId),
        nickname: String(nickname).slice(0, 40),
        avatar: avatar ? String(avatar).slice(0, 200) : null,
        lastSeen: TS,
      },
    });

    // Если хост закроет вкладку — статус автоматически станет 'closed'
    db.ref('rooms/' + code + '/meta/status').onDisconnect().set('closed');

    console.log('[firebase] room created', code);
    return { code };
  }

  // ─── HOST: ожидание прихода гостя ────────────────────────────────
  // Возвращает promise, резолвится когда guest появится в /rooms/<code>/guest.
  // На таймауте — reject('timeout'). На закрытии комнаты — reject('closed').
  function waitForGuest(code, { timeoutMs = 5 * 60 * 1000 } = {}){
    return new Promise((resolve, reject) => {
      init();
      const guestRef = db.ref('rooms/' + code + '/guest');
      const statusRef = db.ref('rooms/' + code + '/meta/status');
      let done = false;

      const timer = setTimeout(() => {
        if(done) return;
        done = true;
        guestRef.off();
        statusRef.off();
        reject(new Error('timeout'));
      }, timeoutMs);

      const onGuest = guestRef.on('value', (snap) => {
        if(done) return;
        if(snap.exists()){
          done = true;
          clearTimeout(timer);
          guestRef.off('value', onGuest);
          statusRef.off('value', onStatus);
          resolve(snap.val());
        }
      });

      const onStatus = statusRef.on('value', (snap) => {
        if(done) return;
        if(snap.val() === 'closed'){
          done = true;
          clearTimeout(timer);
          guestRef.off('value', onGuest);
          statusRef.off('value', onStatus);
          reject(new Error('closed'));
        }
      });
    });
  }

  // ─── GUEST: вход в комнату ───────────────────────────────────────
  async function joinRoom(rawCode, { deviceId, nickname, avatar }){
    if(!deviceId || !nickname) throw new Error('deviceId и nickname обязательны');
    const code = String(rawCode || '').trim().toUpperCase();
    if(!validCode(code)) throw new Error('invalid_code_format');

    await ensureAuth();

    const roomRef = db.ref('rooms/' + code);
    const snap = await roomRef.get();
    if(!snap.exists()) throw new Error('not_found');

    const room = snap.val();
    if(room.meta?.status === 'closed') throw new Error('closed');

    // Если гость уже занят и это не мы (re-join) — отказ
    if(room.guest && room.guest.deviceId && room.guest.deviceId !== String(deviceId)){
      throw new Error('room_full');
    }
    // Если хост — это тот же deviceId (создавал и сразу пытается войти) — отказ
    if(room.host?.deviceId === String(deviceId)){
      throw new Error('cant_join_own_room');
    }

    const TS = firebase.database.ServerValue.TIMESTAMP;

    // Записываем guest + переключаем статус
    await roomRef.update({
      'guest/deviceId':  String(deviceId),
      'guest/nickname':  String(nickname).slice(0, 40),
      'guest/avatar':    avatar ? String(avatar).slice(0, 200) : null,
      'guest/lastSeen':  TS,
      'meta/status':     'playing',
    });

    // На дисконнект — закрываем комнату
    db.ref('rooms/' + code + '/meta/status').onDisconnect().set('closed');

    console.log('[firebase] joined room', code);
    return { host: room.host };
  }

  // ─── Транспорт (общий для host и guest) ──────────────────────────
  // API совместим со старым makePollingTransport:
  //   send(msg)         — msg = {t: 'partiya-init', ...payload}
  //   on(fn)            — fn получает {t: 'partiya-init', ...payload}
  //   close()
  //   startHeartbeat()  — no-op (Firebase сам держит соединение)
  function makeTransport({ code, deviceId, role }){
    init();
    const handlers = new Set();
    // Буфер — сообщения, пришедшие до того как TurnirGame.useEffect
    // зарегистрировал свой transport.on(...). Без буфера partiya-init
    // от хоста теряется (race между Firebase WebSocket и React-кадрами).
    const buffer = [];
    let stopped = false;

    const messagesRef = db.ref('rooms/' + code + '/messages');
    const statusRef   = db.ref('rooms/' + code + '/meta/status');

    function onMsg(snap){
      if(stopped) return;
      const m = snap.val();
      if(!m || m.from === deviceId) return;
      const reconstructed = Object.assign({ t: m.type }, m.payload || {});
      if(handlers.size === 0){
        buffer.push(reconstructed);
      } else {
        handlers.forEach(fn => { try { fn(reconstructed); } catch(_){} });
      }
    }
    messagesRef.on('child_added', onMsg);

    // Слушаем закрытие комнаты — отправляем opp-leave
    function onStatus(snap){
      if(stopped) return;
      if(snap.val() === 'closed'){
        handlers.forEach(fn => { try { fn({ t: 'opp-leave' }); } catch(_){} });
      }
    }
    statusRef.on('value', onStatus);

    // Heartbeat: обновляем lastSeen каждые 10 секунд (видно сопернику)
    const presenceRef = db.ref('rooms/' + code + '/' + role + '/lastSeen');
    const heartbeat = setInterval(() => {
      if(!stopped) presenceRef.set(firebase.database.ServerValue.TIMESTAMP);
    }, 10000);

    return {
      role,
      async send(msg){
        if(stopped) return;
        const { t, ...rest } = msg || {};
        try {
          await messagesRef.push({
            from: String(deviceId),
            type: t || 'unknown',
            payload: Object.keys(rest).length > 0 ? rest : null,
            ts: firebase.database.ServerValue.TIMESTAMP,
          });
        } catch(e){
          console.warn('[firebase] send error', e?.message || e);
        }
      },
      on(fn){
        handlers.add(fn);
        // Слить буфер при первом подключении handler'а — иначе пропустим
        // сообщения, пришедшие за время монтирования React-компонента.
        if(buffer.length > 0){
          const toFlush = buffer.splice(0, buffer.length);
          // Используем setTimeout(0) чтобы handler не вызвался синхронно
          // во время рендера (это сломало бы React).
          setTimeout(() => {
            toFlush.forEach(msg => { try { fn(msg); } catch(_){} });
          }, 0);
        }
        return () => handlers.delete(fn);
      },
      close(){
        stopped = true;
        clearInterval(heartbeat);
        try { messagesRef.off('child_added', onMsg); } catch(_){}
        try { statusRef.off('value', onStatus); } catch(_){}
        // Помечаем комнату закрытой — соперник получит opp-leave
        try { statusRef.set('closed'); } catch(_){}
      },
      startHeartbeat(){ /* интервал уже запущен в makeTransport */ },
    };
  }

  // ─── Экспорт ─────────────────────────────────────────────────────
  window.YasnaRT = {
    createRoom,
    joinRoom,
    waitForGuest,
    makeTransport,
    validCode,
  };

  console.log('[YasnaRT] Firebase real-time transport loaded');
})();
