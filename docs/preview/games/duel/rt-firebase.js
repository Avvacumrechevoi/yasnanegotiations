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
    const user = await ensureAuth();

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

    // Атомарная запись комнаты — через update(), а НЕ set() на родителя.
    // ВАЖНО: правила RTDB заданы на детях (meta/host/guest), без .write на
    // самом узле rooms/$code. set() на родителя Firebase ОТКЛОНЯЕТ
    // (PERMISSION_DENIED — нет .write на уровне записи и выше). update() же
    // оценивает права по каждому ребёнку (meta/host) отдельно — и проходит.
    await db.ref('rooms/' + code).update({
      meta: {
        status: 'waiting',
        createdAt: TS,
        version: 2,
      },
      host: {
        deviceId: String(deviceId),
        nickname: String(nickname).slice(0, 40),
        avatar: avatar ? String(avatar).slice(0, 200) : null,
        uid: user.uid,        // привязка владельца слота — для правил RTDB (auth.uid)
        lastSeen: TS,
      },
    });

    // ВАЖНО: НЕ ставим onDisconnect → 'closed' для ожидающей комнаты.
    // Причина: на мобильных браузерах (особенно iOS Safari) переход
    // в фоновый режим (например, открыть Telegram → отправить ссылку →
    // вернуться) убивает WebSocket-соединение, Firebase считает хоста
    // отключённым и закрывает комнату через onDisconnect. Гость потом
    // получает ошибку «Комната закрыта». Реальное состояние —
    // комната жива, хост просто свернул вкладку.
    //
    // Вместо этого: TTL по lastSeen + heartbeat (см. waitForGuest).
    // Комната считается мёртвой если createdAt > 30 минут назад
    // (проверка в joinRoom через createdAt timestamp).
    db.ref('rooms/' + code + '/host/online').onDisconnect().set(false);

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

    const user = await ensureAuth();

    const roomRef = db.ref('rooms/' + code);
    const snap = await roomRef.get();
    if(!snap.exists()) throw new Error('not_found');

    const room = snap.val();
    if(room.meta?.status === 'closed') throw new Error('closed');

    // TTL — orphan room cleanup. Если комната создана > 30 минут назад
    // и до сих пор в waiting (никто не зашёл) — считаем мёртвой.
    if(room.meta?.status === 'waiting' && room.meta?.createdAt){
      const ageMs = Date.now() - room.meta.createdAt;
      if(ageMs > 30 * 60 * 1000) throw new Error('closed');
    }

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
      'guest/uid':       user.uid,   // привязка владельца слота — для правил RTDB
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
  // presencePath — куда писать lastSeen (default = role, т.е. host/guest для 2p).
  //   для группы передаём 'players/<deviceId>'.
  // kind — '2p' (default) | 'group'. Для группы close() НЕ закрывает комнату
  //   (уход одного игрока ≠ конец партии) — только гасит свой online-флаг.
  function makeTransport({ code, deviceId, role, presencePath, kind }){
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
      if(!m){ return; }
      if(m.from === deviceId){
        // console.log('[firebase/recv] own msg type=' + m.type + ' (filtered)');
        return;
      }
      // console.log('[firebase/recv] from=opp type=' + m.type + ' handlers=' + handlers.size);
      const reconstructed = Object.assign({ t: m.type, from: m.from }, m.payload || {});
      if(handlers.size === 0){
        // debug: buffering;
        buffer.push(reconstructed);
      } else {
        handlers.forEach(fn => {
          try { fn(reconstructed); }
          catch(e){ console.error('[firebase/recv] handler threw:', e); }
        });
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
    const presenceRef = db.ref('rooms/' + code + '/' + (presencePath || role) + '/lastSeen');
    const heartbeat = setInterval(() => {
      if(!stopped) presenceRef.set(firebase.database.ServerValue.TIMESTAMP);
    }, 10000);

    return {
      role,
      async send(msg){
        if(stopped) return;
        const { t, ...rest } = msg || {};
        const payload = Object.keys(rest).length > 0 ? rest : null;
        // console.log('[firebase/send] type=' + (t || 'unknown') + ' payload=' + (payload ? 'yes' : 'null'));
        try {
          await messagesRef.push({
            from: String(deviceId),
            type: t || 'unknown',
            payload: payload,
            ts: firebase.database.ServerValue.TIMESTAMP,
          });
          // console.log('[firebase/send] ok type=' + (t || 'unknown'));
        } catch(e){
          console.error('[firebase/send] error', e?.message || e);
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
        if(kind === 'group'){
          // Группа: НЕ закрываем комнату при выходе одного игрока — партия
          // продолжается у остальных. Гасим только свой online-флаг.
          try { db.ref('rooms/' + code + '/players/' + deviceId + '/online').set(false); } catch(_){}
        } else {
          // 2p: помечаем комнату закрытой — соперник получит opp-leave.
          try { statusRef.set('closed'); } catch(_){}
        }
      },
      startHeartbeat(){ /* интервал уже запущен в makeTransport */ },
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // ─── РЕЖИМ ГРУППЫ «С коллективом» (N=3..8) ──────────────────────────
  // Отдельный API поверх той же комнаты rooms/<code>. Вместо host/guest —
  // мапа players/<deviceId>. meta.kind='group' разделяет режимы (старый
  // joinRoom сюда не попадёт). Транспорт (makeTransport) переиспользуется
  // как есть — он уже broadcast на N слушателей.
  // ═══════════════════════════════════════════════════════════════════

  // HOST: создать комнату-группу (status='lobby', хост ждёт игроков и стартует кнопкой)
  async function createGroupRoom({ deviceId, nickname, avatar, capacity = 8, minPlayers = 3, partiyaMode = 'standard', themes = null }){
    if(!deviceId || !nickname) throw new Error('deviceId и nickname обязательны');
    const user = await ensureAuth();

    let code = null;
    for(let i = 0; i < 5; i++){
      const candidate = genRoomCode();
      const snap = await db.ref('rooms/' + candidate + '/meta').get();
      if(!snap.exists()){ code = candidate; break; }
    }
    if(!code) throw new Error('Не удалось сгенерировать уникальный код');

    const TS = firebase.database.ServerValue.TIMESTAMP;
    const cap = Math.max(2, Math.min(12, capacity | 0));
    const updates = {
      meta: {
        status: 'lobby',
        kind: 'group',
        version: 3,
        createdAt: TS,
        hostDeviceId: String(deviceId),
        hostUid: user.uid,           // правилам RTDB: только хост меняет meta
        capacity: cap,
        minPlayers: Math.max(2, Math.min(cap, minPlayers | 0)),
        partiyaMode: String(partiyaMode),
        themes: (themes && themes.length) ? themes.map(String) : null,
        seed: null,
        startedAt: null,
      },
    };
    updates['players/' + deviceId] = {
      deviceId: String(deviceId),
      uid: user.uid,
      nickname: String(nickname).slice(0, 40),
      avatar: avatar ? String(avatar).slice(0, 200) : null,
      role: 'host',
      joinedAt: TS,
      lastSeen: TS,
      online: true,
      score: 0, correct: 0, streak: 0, finished: false,
    };
    await db.ref('rooms/' + code).update(updates);

    // Уход хоста ≠ закрытие комнаты — гасим только свой online-флаг.
    db.ref('rooms/' + code + '/players/' + deviceId + '/online').onDisconnect().set(false);
    console.log('[firebase] group room created', code);
    return { code };
  }

  // GUEST: войти в комнату-группу. Возвращает { meta, players, code }.
  async function joinGroupRoom(rawCode, { deviceId, nickname, avatar }){
    if(!deviceId || !nickname) throw new Error('deviceId и nickname обязательны');
    const code = String(rawCode || '').trim().toUpperCase();
    if(!validCode(code)) throw new Error('invalid_code_format');
    const user = await ensureAuth();

    const roomRef = db.ref('rooms/' + code);
    const snap = await roomRef.get();
    if(!snap.exists()) throw new Error('not_found');
    const room = snap.val();
    if(room.meta?.kind !== 'group') throw new Error('wrong_kind');
    if(room.meta?.status === 'closed' || room.meta?.status === 'finished') throw new Error('closed');
    if(room.meta?.createdAt && (Date.now() - room.meta.createdAt) > 30 * 60 * 1000) throw new Error('closed');

    const players = room.players || {};
    const prev = players[deviceId];
    const already = !!prev;
    // late-join после старта запрещён в MVP (re-join своего слота разрешён)
    if(!already && room.meta?.status !== 'lobby') throw new Error('already_started');
    if(!already && Object.keys(players).length >= (room.meta?.capacity || 8)) throw new Error('room_full');

    const TS = firebase.database.ServerValue.TIMESTAMP;
    await roomRef.child('players/' + deviceId).update({
      deviceId: String(deviceId),
      uid: user.uid,
      nickname: String(nickname).slice(0, 40),
      avatar: avatar ? String(avatar).slice(0, 200) : null,
      role: already ? (prev.role || 'player') : 'player',
      joinedAt: already ? (prev.joinedAt || TS) : TS,
      lastSeen: TS,
      online: true,
      score: already ? (prev.score || 0) : 0,
      correct: already ? (prev.correct || 0) : 0,
      streak: already ? (prev.streak || 0) : 0,
      finished: already ? !!prev.finished : false,
    });
    db.ref('rooms/' + code + '/players/' + deviceId + '/online').onDisconnect().set(false);
    return { meta: room.meta, players, code };
  }

  // Подписка на мапу игроков (лобби + табло). Один listener на всю мапу.
  function watchPlayers(code, cb){
    init();
    const ref = db.ref('rooms/' + code + '/players');
    const handler = ref.on('value', (snap) => { try { cb(snap.val() || {}); } catch(_){} });
    return () => { try { ref.off('value', handler); } catch(_){} };
  }

  // Подписка на meta (status/seed/results — старт партии и финальная таблица).
  function watchMeta(code, cb){
    init();
    const ref = db.ref('rooms/' + code + '/meta');
    const handler = ref.on('value', (snap) => { try { cb(snap.val() || {}); } catch(_){} });
    return () => { try { ref.off('value', handler); } catch(_){} };
  }

  // Хост: патч meta (старт партии: seed/status/startedAt; финал: results/status).
  async function updateGroupMeta(code, patch){
    init();
    await db.ref('rooms/' + code + '/meta').update(patch || {});
  }

  // Игрок: патч своего слота (score/correct/streak/finished/lastSeen).
  async function updatePlayer(code, deviceId, patch){
    init();
    await db.ref('rooms/' + code + '/players/' + deviceId).update(patch || {});
  }

  // ─── Экспорт ─────────────────────────────────────────────────────
  window.YasnaRT = {
    createRoom,
    joinRoom,
    waitForGuest,
    makeTransport,
    validCode,
    // группа «С коллективом»
    createGroupRoom,
    joinGroupRoom,
    watchPlayers,
    watchMeta,
    updateGroupMeta,
    updatePlayer,
  };

  // console.log('[YasnaRT] Firebase real-time transport loaded');
})();
