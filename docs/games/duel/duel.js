// ═══════════════════════════════════════════════════════════════════
// DUEL CORE — engine для онлайн-дуэлей (P0+stability)
//
// Содержит:
//   • DuelTransport       — BroadcastChannel + heartbeat + disconnect detection
//   • window.YasnaDuels   — реестр режимов дуэлей (.register / .get / .list)
//   • DuelApp             — главный React-компонент-оркестратор
//   • Lobby               — выбор режима + Ясны + комнаты
//   • DuelRunner          — countdown → game → result
//   • ResultScreen        — победа/поражение/disconnect
//
// Игры регистрируются через window.YasnaDuels.register({...}) — см. duel-games.js.
// При замене BroadcastChannel на WebRTC интерфейс DuelTransport не меняется.
// ═══════════════════════════════════════════════════════════════════

(function(){
  const { useState, useEffect, useRef, useMemo } = React;

  // ─── PROFILE ───────────────────────────────────────────────────────
  // Локальный профиль гостя — никнейм + emoji-аватар. Хранится в localStorage.
  // Первый вход → онбординг с выбором ника. Передаётся в hello/host-ack —
  // соперник видит твоё имя в player-card во время дуэли.
  const PROFILE_KEY = 'yasna_duel_profile';
  const AVATAR_OPTIONS = ['🦊','🐺','🦁','🐯','🐻','🐼','🦉','🦅','🐉','🦄','⚔️','🎯'];
  function loadProfile(){
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if(!raw) return null;
      const p = JSON.parse(raw);
      if(p && p.nickname) return p;
    } catch(_){}
    return null;
  }
  function saveProfile(profile){
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch(_){}
  }
  window.YasnaDuelProfile = { load: loadProfile, save: saveProfile, AVATAR_OPTIONS };

  // ─── PERSISTENCE (P3 — история, рекорды, статистика) ──────────────
  // Локально в localStorage без сервера. Лимит 200 матчей.
  const STORAGE_KEY = 'yasna_duel_data';
  const MAX_MATCHES = 200;
  const STORAGE_VERSION = 1;

  function _emptyData(){
    return { version: STORAGE_VERSION, matches: [], records: {}, streaks: {}, totals: { played:0, wins:0, losses:0 } };
  }
  function _loadData(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return _emptyData();
      const d = JSON.parse(raw);
      if(d.version !== STORAGE_VERSION) return _emptyData();
      return Object.assign(_emptyData(), d);
    } catch(_){ return _emptyData(); }
  }
  function _saveData(d){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e){ console.warn('[storage] save failed', e); }
  }

  function recordMatch(m){
    const data = _loadData();
    const match = {
      id: m.matchId || ('m-' + Date.now()),
      date: Date.now(),
      gameId: m.gameId,
      yasnaId: m.yasnaId,
      role: m.role,
      transport: m.transport || 'unknown',
      result: m.result, // 'win' | 'loss'
      time: m.time || 0,
      score: m.score != null ? m.score : null,
      maxScore: m.maxScore != null ? m.maxScore : null,
      opponentName: m.opponentName || '',
      isBot: !!m.isBot,
      botLevel: m.botLevel || null,
      bySurrender: !!m.bySurrender,
      byDisconnect: !!m.byDisconnect,
    };
    // Анти-мусор: матч короче 1с не считаем
    if(match.time && match.time < 1000) return null;
    data.matches.unshift(match);
    if(data.matches.length > MAX_MATCHES) data.matches = data.matches.slice(0, MAX_MATCHES);

    // Updates totals
    data.totals.played = (data.totals.played || 0) + 1;
    if(match.result === 'win') data.totals.wins = (data.totals.wins || 0) + 1;
    else if(match.result === 'loss') data.totals.losses = (data.totals.losses || 0) + 1;

    // Updates per-game/yasna records (только не-бот матчи учитываются как «личные рекорды»)
    if(!match.isBot){
      data.records[match.gameId] = data.records[match.gameId] || {};
      data.records[match.gameId][match.yasnaId] = data.records[match.gameId][match.yasnaId] || { played:0, wins:0, losses:0 };
      const rec = data.records[match.gameId][match.yasnaId];
      rec.played = (rec.played || 0) + 1;
      if(match.result === 'win') rec.wins = (rec.wins || 0) + 1;
      else if(match.result === 'loss') rec.losses = (rec.losses || 0) + 1;
      // Best time (только для побед)
      if(match.result === 'win' && match.time > 0 && (!rec.bestTime || match.time < rec.bestTime)){
        rec.bestTime = match.time;
        rec.bestTimeDate = match.date;
        match.isNewRecord = true;
      }
      // Best score (для score-mode)
      if(match.score != null && (rec.bestScore == null || match.score > rec.bestScore)){
        rec.bestScore = match.score;
        rec.maxScore = match.maxScore;
        rec.bestScoreDate = match.date;
        match.isNewRecord = true;
      }
    }

    // Streaks (общая, не зависит от gameId — серия побед подряд)
    data.streaks.overall = data.streaks.overall || { current:0, best:0 };
    if(match.result === 'win'){
      data.streaks.overall.current = (data.streaks.overall.current || 0) + 1;
      if(data.streaks.overall.current > (data.streaks.overall.best || 0)){
        data.streaks.overall.best = data.streaks.overall.current;
      }
    } else if(match.result === 'loss'){
      data.streaks.overall.current = 0;
    }
    // Per-game streak
    data.streaks[match.gameId] = data.streaks[match.gameId] || { current:0, best:0 };
    if(match.result === 'win'){
      data.streaks[match.gameId].current = (data.streaks[match.gameId].current || 0) + 1;
      if(data.streaks[match.gameId].current > (data.streaks[match.gameId].best || 0)){
        data.streaks[match.gameId].best = data.streaks[match.gameId].current;
      }
    } else if(match.result === 'loss'){
      data.streaks[match.gameId].current = 0;
    }

    _saveData(data);
    return match;
  }

  function getStats(gameId, yasnaId){
    const data = _loadData();
    const rec = data.records[gameId]?.[yasnaId];
    return rec || null;
  }

  function getMatchHistory(limit){
    const data = _loadData();
    return data.matches.slice(0, limit || 50);
  }

  function getOverallStats(){
    const d = _loadData();
    return {
      totals: d.totals,
      streaks: d.streaks,
      records: d.records,
    };
  }

  function exportJSON(){ return JSON.stringify(_loadData(), null, 2); }
  function importJSON(json){
    try {
      const d = JSON.parse(json);
      if(d.version !== STORAGE_VERSION) throw new Error('Несовместимая версия данных');
      _saveData(d);
      return true;
    } catch(e){ return false; }
  }
  function resetData(){ _saveData(_emptyData()); }

  window.YasnaDuelStorage = { recordMatch, getStats, getMatchHistory, getOverallStats, exportJSON, importJSON, reset: resetData, _load: _loadData };

  // ─── ACHIEVEMENTS (P6.1 — 30+ значков) ─────────────────────────────
  // Условия проверяются по match-history после каждого матча.
  // Каждое: { id, icon, title, desc, check(data, lastMatch), goal, progress(data) }
  const ACHIEVEMENTS = [
    // Foundational
    { id:'first-duel', icon:'🎯', title:'Первая дуэль', desc:'Сыграйте свой первый матч',
      check:d => d.totals.played >= 1 },
    { id:'first-win', icon:'🏆', title:'Первая победа', desc:'Выиграйте первый матч',
      check:d => d.totals.wins >= 1 },
    { id:'matches-5', icon:'🎮', title:'Игрок', desc:'Сыграйте 5 матчей',
      check:d => d.totals.played >= 5, goal:5, progress:d => d.totals.played },
    { id:'matches-25', icon:'🥉', title:'Постоянный', desc:'25 матчей',
      check:d => d.totals.played >= 25, goal:25, progress:d => d.totals.played },
    { id:'matches-100', icon:'🥇', title:'Ветеран', desc:'100 матчей',
      check:d => d.totals.played >= 100, goal:100, progress:d => d.totals.played },
    { id:'wins-5', icon:'⭐', title:'Победитель', desc:'5 побед',
      check:d => d.totals.wins >= 5, goal:5, progress:d => d.totals.wins },
    { id:'wins-25', icon:'🌟', title:'Чемпион', desc:'25 побед',
      check:d => d.totals.wins >= 25, goal:25, progress:d => d.totals.wins },
    { id:'wins-100', icon:'💫', title:'Мастер', desc:'100 побед',
      check:d => d.totals.wins >= 100, goal:100, progress:d => d.totals.wins },

    // Streaks
    { id:'streak-3', icon:'🔥', title:'Разгорается', desc:'3 победы подряд',
      check:d => (d.streaks?.overall?.best || 0) >= 3 },
    { id:'streak-5', icon:'🔥', title:'Триумф', desc:'5 побед подряд',
      check:d => (d.streaks?.overall?.best || 0) >= 5 },
    { id:'streak-10', icon:'🔥', title:'Легенда', desc:'10 побед подряд',
      check:d => (d.streaks?.overall?.best || 0) >= 10 },
    { id:'streak-20', icon:'⚡', title:'Непобедимый', desc:'20 побед подряд',
      check:d => (d.streaks?.overall?.best || 0) >= 20 },

    // Race-specific
    { id:'sprinter', icon:'💨', title:'Спринтер', desc:'Race быстрее 6 секунд',
      check:(d, m) => m && m.gameId.startsWith('race-') && m.result === 'win' && m.time < 6000 },
    { id:'lightning', icon:'⚡', title:'Молниеносный', desc:'Race быстрее 4 секунд',
      check:(d, m) => m && m.gameId.startsWith('race-') && m.result === 'win' && m.time < 4000 },
    { id:'race-master-cross', icon:'✚', title:'Мастер опорных', desc:'10 побед в Race-Cross',
      check:d => (d.records?.['race-cross']?.['суток']?.wins || 0) + (d.records?.['race-cross']?.['года']?.wins || 0) + (d.records?.['race-cross']?.['фаз_жизни']?.wins || 0) >= 10 },
    { id:'race-master-mngmt', icon:'⚙', title:'Мастер управления', desc:'10 побед в Race-Mngmt',
      check:d => (d.records?.['race-mngmt']?.['суток']?.wins || 0) + (d.records?.['race-mngmt']?.['года']?.wins || 0) + (d.records?.['race-mngmt']?.['фаз_жизни']?.wins || 0) >= 10 },
    { id:'race-master-faith', icon:'🕊', title:'Мастер веры', desc:'10 побед в Race-Faith',
      check:d => (d.records?.['race-faith']?.['суток']?.wins || 0) + (d.records?.['race-faith']?.['года']?.wins || 0) + (d.records?.['race-faith']?.['фаз_жизни']?.wins || 0) >= 10 },
    { id:'three-crosses', icon:'👑', title:'Три креста', desc:'Победите хотя бы раз в каждом из трёх Race-режимов',
      check:d => ['race-cross','race-mngmt','race-faith'].every(g => Object.values(d.records?.[g] || {}).some(r => (r.wins || 0) > 0)) },

    // Quiz / Mirror / Speed
    { id:'quiz-perfect', icon:'💯', title:'Идеальная пятёрка', desc:'Все 5 правильных в Quiz',
      check:(d, m) => m && m.gameId === 'quiz-antipodes' && m.score === 5 },
    { id:'mirror-perfect', icon:'🧩', title:'Точная копия', desc:'Все 12 меток на местах',
      check:(d, m) => m && m.gameId === 'mirror-fill' && m.score === 12 },
    { id:'speed-master', icon:'🚀', title:'Скорость света', desc:'≥20 правильных в Speed за 30 сек',
      check:(d, m) => m && m.gameId === 'speed-cross-yesno' && m.score >= 20 },

    // Yasna mastery
    { id:'sutok-win', icon:'🌅', title:'Знаток Суток', desc:'Победите на Ясне Суток',
      check:d => Object.entries(d.records || {}).some(([g, byY]) => (byY?.['суток']?.wins || 0) > 0) },
    { id:'goda-win', icon:'🌗', title:'Знаток Года', desc:'Победите на Ясне Года',
      check:d => Object.entries(d.records || {}).some(([g, byY]) => (byY?.['года']?.wins || 0) > 0) },
    { id:'zhizni-win', icon:'🧬', title:'Знаток Жизни', desc:'Победите на Ясне Жизни',
      check:d => Object.entries(d.records || {}).some(([g, byY]) => (byY?.['фаз_жизни']?.wins || 0) > 0) },
    { id:'all-yasnas', icon:'🌌', title:'Все три Ясны', desc:'Победите на каждой из трёх Ясн',
      check:d => ['суток','года','фаз_жизни'].every(y => Object.values(d.records || {}).some(byY => (byY?.[y]?.wins || 0) > 0)) },

    // Mode mastery
    { id:'all-modes', icon:'🎨', title:'Универсал', desc:'Выиграйте во всех 6 режимах',
      check:d => ['race-cross','race-mngmt','race-faith','quiz-antipodes','mirror-fill','speed-cross-yesno']
        .every(g => Object.values(d.records?.[g] || {}).some(r => (r.wins || 0) > 0)) },

    // Bot challenges
    { id:'beat-easy-bot', icon:'😊', title:'Лёгкий — пройден', desc:'Победить лёгкого бота',
      check:(d, m) => m && m.isBot && m.botLevel === 'easy' && m.result === 'win' },
    { id:'beat-medium-bot', icon:'🙂', title:'Средний — пройден', desc:'Победить среднего бота',
      check:(d, m) => m && m.isBot && m.botLevel === 'medium' && m.result === 'win' },
    { id:'beat-hard-bot', icon:'😈', title:'Магистр повержен', desc:'Победить сложного бота',
      check:(d, m) => m && m.isBot && m.botLevel === 'hard' && m.result === 'win' },

    // Social
    { id:'first-online', icon:'🌐', title:'Свобода', desc:'Сыграйте первый онлайн-матч',
      check:(d, m) => m && m.transport === 'peerjs' },
    { id:'online-win', icon:'🎖', title:'Онлайн-чемпион', desc:'Выиграйте онлайн',
      check:(d, m) => m && m.transport === 'peerjs' && m.result === 'win' },

    // Comeback
    { id:'comeback', icon:'🔄', title:'Возвращение', desc:'Победить после 3 поражений подряд',
      check:(d, m) => {
        if(!m || m.result !== 'win') return false;
        const recent = d.matches?.slice(0, 4) || [];
        return recent.length >= 4 && recent[0].result === 'win' && recent[1].result === 'loss' && recent[2].result === 'loss' && recent[3].result === 'loss';
      }
    },
  ];

  const ACHIEVEMENTS_KEY = 'yasna_duel_achievements';

  function loadUnlocked(){
    try { return new Set(JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '[]')); }
    catch(_){ return new Set(); }
  }
  function saveUnlocked(set){
    try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(Array.from(set))); } catch(_){}
  }

  function checkAchievements(lastMatch){
    const data = window.YasnaDuelStorage.getOverallStats();
    data.matches = window.YasnaDuelStorage.getMatchHistory(50);
    const unlocked = loadUnlocked();
    const newlyUnlocked = [];
    for(const ach of ACHIEVEMENTS){
      if(unlocked.has(ach.id)) continue;
      try {
        if(ach.check(data, lastMatch)){
          unlocked.add(ach.id);
          newlyUnlocked.push(ach);
        }
      } catch(_){}
    }
    if(newlyUnlocked.length){
      saveUnlocked(unlocked);
    }
    return newlyUnlocked;
  }

  function getAchievementsList(){
    const data = window.YasnaDuelStorage.getOverallStats();
    data.matches = window.YasnaDuelStorage.getMatchHistory(50);
    const unlocked = loadUnlocked();
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: unlocked.has(a.id),
      progress: a.progress ? Math.min(a.goal, a.progress(data)) : null,
    }));
  }

  window.YasnaDuelAchievements = {
    DEFINITIONS: ACHIEVEMENTS,
    check: checkAchievements,
    list: getAchievementsList,
    reset: () => { try { localStorage.removeItem(ACHIEVEMENTS_KEY); } catch(_){} },
  };

  // ─── REGISTRY ──────────────────────────────────────────────────────
  const _registry = new Map();
  window.YasnaDuels = {
    version: '0.2.0',
    register(config){
      const errs = this.validate(config);
      if(errs.length){ console.warn('[YasnaDuels] invalid config', config?.id, errs); return false; }
      _registry.set(config.id, config);
      return true;
    },
    get(id){ return _registry.get(id); },
    list(){ return Array.from(_registry.values()); },
    listByCategory(cat){ return this.list().filter(g => g.category === cat); },
    validate(c){
      const e = [];
      if(!c) return ['config required'];
      if(!c.id) e.push('id required');
      if(!c.title) e.push('title required');
      if(typeof c.Component !== 'function') e.push('Component must be a React component (function)');
      if(!Array.isArray(c.yasnaIds) || !c.yasnaIds.length) e.push('yasnaIds[] required');
      return e;
    },
  };

  // ─── TRANSPORT ─────────────────────────────────────────────────────
  // Wrapper над BroadcastChannel с heartbeat + disconnect detection +
  // unique session-id (защита от мусорных сообщений между матчами).
  // Тот же API будет у WebRTC-варианта в продакшене.
  const HEARTBEAT_MS = 1500;
  const DISCONNECT_MS = 6000;

  class DuelTransport {
    constructor(roomCode){
      this.roomCode = roomCode;
      this.channel = new BroadcastChannel('yasna-duel-' + roomCode);
      this.sessionId = Math.random().toString(36).slice(2, 10);
      this.peerSessionId = null;
      this.handlers = new Set();
      this.lastSeenPeer = 0;
      this.hbInterval = null;
      this.disconnectTimer = null;
      this.closed = false;

      this.channel.onmessage = (e) => {
        const msg = e.data;
        if(!msg || typeof msg !== 'object') return;
        // Игнорируем собственные эхо-сообщения
        if(msg.from === this.sessionId) return;
        // Если впервые увидели соперника — фиксируем его sessionId
        if(!this.peerSessionId && msg.from){
          this.peerSessionId = msg.from;
        }
        // Если уже есть зафиксированный соперник — игнорируем сообщения от других sessionId
        // (защита от 3+ вкладок / стейл-сообщений)
        if(this.peerSessionId && msg.from && msg.from !== this.peerSessionId){
          return;
        }
        this.lastSeenPeer = Date.now();
        // Heartbeat обрабатываем тихо
        if(msg.t === '__hb') return;
        // Передаём наверх
        this.handlers.forEach(fn => { try { fn(msg); } catch(e){ console.error(e); } });
      };
    }

    startHeartbeat(){
      if(this.hbInterval) return;
      this.hbInterval = setInterval(() => {
        if(this.closed) return;
        this._raw({ t:'__hb' });
        // Проверяем не пропал ли соперник
        if(this.peerSessionId && this.lastSeenPeer && (Date.now() - this.lastSeenPeer > DISCONNECT_MS)){
          this.handlers.forEach(fn => fn({ t:'__disconnect', reason:'timeout' }));
          this.peerSessionId = null;
          this.lastSeenPeer = 0;
        }
      }, HEARTBEAT_MS);
    }

    _raw(msg){
      if(this.closed) return;
      try { this.channel.postMessage({ ...msg, from: this.sessionId, ts: Date.now() }); } catch(_){}
    }

    send(msg){ this._raw(msg); }

    on(fn){ this.handlers.add(fn); return () => this.handlers.delete(fn); }

    close(){
      if(this.closed) return;
      this.closed = true;
      try { this._raw({ t:'__leave' }); } catch(_){}
      if(this.hbInterval){ clearInterval(this.hbInterval); this.hbInterval = null; }
      try { this.channel.close(); } catch(_){}
    }
  }

  window.DuelTransport = DuelTransport;

  // ─── PEERJS TRANSPORT (реальный online через WebRTC) ──────────────
  // Тот же интерфейс что у DuelTransport (on/send/close/startHeartbeat),
  // но соединяется через WebRTC peer-to-peer. Signaling через
  // публичный peerjs.com broker (бесплатный free-tier, ~99% uptime).
  // Если NAT не пропускает — TURN-relay не делается на P0; падаем с ошибкой.
  class PeerJsTransport {
    constructor(roomCode, role){
      this.roomCode = roomCode;
      this.role = role; // 'host' | 'guest'
      this.handlers = new Set();
      this.peer = null;
      this.conn = null;
      this.closed = false;
      this.hbInterval = null;
      this.lastSeenPeer = 0;
      this.connectedFired = false;
      this._init();
    }

    _init(){
      if(typeof window.Peer === 'undefined'){
        console.error('[PeerJsTransport] window.Peer отсутствует — подключите CDN script');
        // Эмитим ошибку асинхронно чтобы handlers успели подписаться
        setTimeout(() => {
          this.handlers.forEach(fn => fn({ t:'__error', message:'PeerJS не загрузился' }));
        }, 0);
        return;
      }
      const hostPeerId = 'yasna-d-' + this.roomCode;
      const myPeerId = this.role === 'host'
        ? hostPeerId
        : 'yasna-d-' + this.roomCode + '-g-' + Math.random().toString(36).slice(2, 8);

      try {
        this.peer = new window.Peer(myPeerId);
      } catch(e){
        setTimeout(() => this.handlers.forEach(fn => fn({ t:'__error', message:'Peer init failed' })), 0);
        return;
      }

      this.peer.on('open', () => {
        if(this.role === 'host'){
          this.peer.on('connection', (conn) => {
            if(this.conn) return; // только первый гость
            this.conn = conn;
            conn.on('open', () => this._wireConn());
          });
        } else {
          const conn = this.peer.connect(hostPeerId, { reliable: true, serialization:'json' });
          conn.on('open', () => {
            this.conn = conn;
            this._wireConn();
          });
          conn.on('error', (e) => {
            this.handlers.forEach(fn => fn({ t:'__error', message: e?.message || 'Не удалось подключиться к хосту' }));
          });
        }
      });

      this.peer.on('error', (e) => {
        let msg = e?.type || 'unknown';
        if(e?.type === 'unavailable-id') msg = 'Эта комната уже занята другим хостом';
        else if(e?.type === 'peer-unavailable') msg = 'Комната не найдена. Проверьте код или попросите создать заново.';
        else if(e?.type === 'network') msg = 'Нет связи с сервером сигналинга PeerJS';
        else if(e?.type === 'browser-incompatible') msg = 'Браузер не поддерживает WebRTC';
        else if(e?.type === 'disconnected') msg = 'Соединение прервано';
        else if(e?.type === 'webrtc') msg = 'Ошибка WebRTC: NAT/firewall блокирует подключение';
        this.handlers.forEach(fn => fn({ t:'__error', message: msg }));
      });
    }

    _wireConn(){
      if(!this.conn) return;
      this.lastSeenPeer = Date.now();
      this.conn.on('data', (data) => {
        if(!data || typeof data !== 'object') return;
        if(data.t === '__hb'){ this.lastSeenPeer = Date.now(); return; }
        this.lastSeenPeer = Date.now();
        this.handlers.forEach(fn => { try { fn(data); } catch(e){ console.error(e); } });
      });
      this.conn.on('close', () => {
        this.handlers.forEach(fn => fn({ t:'__leave' }));
      });
      // Сразу шлём служебный 'hello' — соперник узнает что коннект жив (для UI лобби)
      // Ничего не делаем — application-level guest-hello/host-ack пройдут поверху как раньше.
    }

    startHeartbeat(){
      if(this.hbInterval) return;
      const HB_MS = 2000, TIMEOUT_MS = 8000;
      this.hbInterval = setInterval(() => {
        if(this.closed) return;
        if(this.conn && this.conn.open){
          try { this.conn.send({ t:'__hb', from:this.peer?.id, ts:Date.now() }); } catch(_){}
        }
        if(this.lastSeenPeer && (Date.now() - this.lastSeenPeer > TIMEOUT_MS)){
          this.handlers.forEach(fn => fn({ t:'__disconnect', reason:'timeout' }));
        }
      }, HB_MS);
    }

    send(msg){
      if(this.closed || !this.conn || !this.conn.open) return;
      try { this.conn.send({ ...msg, ts: Date.now() }); } catch(e){ console.warn('[peerjs send]', e); }
    }

    on(fn){ this.handlers.add(fn); return () => this.handlers.delete(fn); }

    close(){
      if(this.closed) return;
      this.closed = true;
      if(this.hbInterval){ clearInterval(this.hbInterval); this.hbInterval = null; }
      try { this.send({ t:'__leave' }); } catch(_){}
      try { this.conn?.close(); } catch(_){}
      try { this.peer?.destroy(); } catch(_){}
    }
  }
  window.PeerJsTransport = PeerJsTransport;

  // ─── BOT TRANSPORT (одиночная тренировка vs ИИ) ────────────────────
  // Имитирует противника. Не использует BroadcastChannel —
  // эмитит сообщения по таймерам, вызывая обработчики локально.
  // Поддерживает все 6 режимов через распознавание gameId.
  class BotTransport {
    constructor(gameId, level){
      this.gameId = gameId;
      this.level = level || 'easy';
      this.handlers = new Set();
      this.timers = [];
      this.closed = false;
      this.scheduled = false;
    }
    on(fn){ this.handlers.add(fn); return () => this.handlers.delete(fn); }
    startHeartbeat(){ /* no-op */ }

    send(msg){
      if(this.closed || msg.t === '__hb' || msg.t === '__leave') return;
      // При первом сообщении хоста (host-ack от lobby) — стартуем бота.
      // Но lobby при vs-bot мы скипаем, поэтому первый send будет от игры —
      // именно с него и считаем "матч начался".
      if(!this.scheduled){
        this.scheduled = true;
        // Получаем matchId из первого сообщения (любого), либо генерируем сами
        const matchId = msg.matchId || ('bot-' + Date.now());
        this._scheduleBotActions(matchId);
      }
      // Если игра прислала mirror-init — нужно отзеркалить (бот же гость, должен бы получить от хоста)
      // На самом деле с ботом всё локально, можно ничего не делать.
    }

    _emit(msg, delay){
      if(this.closed) return;
      const id = setTimeout(() => {
        if(!this.closed){
          this.handlers.forEach(fn => { try { fn(msg); } catch(_){} });
        }
      }, delay);
      this.timers.push(id);
    }

    _scheduleBotActions(matchId){
      // Профили сложности: время до финиша + точность (0..1)
      const profiles = {
        easy:   { time: 22000, acc: 0.55, jitter: 0.4 },
        medium: { time: 13000, acc: 0.85, jitter: 0.2 },
        hard:   { time: 7000,  acc: 0.95, jitter: 0.1 },
      };
      const p = profiles[this.level] || profiles.easy;
      const T = p.time;

      // ── RACE games ───────────────────────────────────────
      const raceTargets = {
        'race-cross':  [0, 3, 6, 9],
        'race-mngmt':  [1, 4, 7, 10],
        'race-faith':  [2, 5, 8, 11],
      };
      if(raceTargets[this.gameId]){
        const target = raceTargets[this.gameId];
        // Постепенно отмечаем правильные полки
        target.forEach((idx, i) => {
          const t = T * (i + 1) / 4 * (1 + (Math.random() - 0.5) * p.jitter);
          this._emit({ t:'progress', matchId, solved: target.slice(0, i + 1) }, t);
        });
        // Финиш — бот побеждает (если игрок не успел раньше)
        this._emit({ t:'finish', matchId, time: T }, T + 200);
        return;
      }

      // ── QUIZ ANTIPODES ───────────────────────────────────
      if(this.gameId === 'quiz-antipodes'){
        const score = Math.round(5 * p.acc);
        for(let q = 1; q <= 5; q++){
          this._emit({ t:'quiz-progress', matchId, done: q }, T * q / 5);
        }
        this._emit({ t:'result', matchId, score, maxScore: 5, time: T, payload: {} }, T + 200);
        return;
      }

      // ── MIRROR FILL ──────────────────────────────────────
      if(this.gameId === 'mirror-fill'){
        const score = Math.round(12 * p.acc);
        for(let pl = 1; pl <= 12; pl++){
          this._emit({ t:'mirror-progress', matchId, placed: pl }, T * pl / 12);
        }
        this._emit({ t:'result', matchId, score, maxScore: 12, time: T, payload: {} }, T + 300);
        return;
      }

      // ── SPEED CROSS YES/NO ───────────────────────────────
      if(this.gameId === 'speed-cross-yesno'){
        // 30 секунд фиксированных
        const finalCorrect = Math.round(20 * p.acc);
        for(let c = 1; c <= finalCorrect; c++){
          this._emit({ t:'speed-progress', matchId, correct: c }, c * (28000 / finalCorrect));
        }
        this._emit({ t:'result', matchId, score: finalCorrect, maxScore: 30, time: 30000, payload: {} }, 30200);
        return;
      }

      // Fallback — ничего не делаем (для незнакомых режимов бот молчит)
    }

    close(){
      if(this.closed) return;
      this.closed = true;
      this.timers.forEach(t => clearTimeout(t));
      this.timers = [];
    }
  }

  window.BotTransport = BotTransport;

  // ─── ONBOARDING (первый вход — выбор ника + аватара) ───────────────
  function ProfileOnboarding({ onSave }){
    const [nickname, setNickname] = useState('');
    const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
    const submit = () => {
      const trimmed = nickname.trim().slice(0, 20);
      if(!trimmed) return;
      const profile = { nickname: trimmed, avatar, createdAt: Date.now() };
      saveProfile(profile);
      onSave(profile);
    };
    return (
      <div className="duel-lobby">
        <div className="duel-title">
          <span className="duel-emoji">⚔️</span>
          <h1>Добро пожаловать!</h1>
          <p>Выбери имя и аватар — соперник увидит их в дуэли</p>
        </div>
        <div className="duel-choose">
          <input
            placeholder="Никнейм (1-20 символов)"
            value={nickname}
            onChange={e => setNickname(e.target.value.slice(0, 20))}
            maxLength={20}
            autoFocus
            style={{padding:'12px 14px',fontSize:16,border:'1.5px solid #d2d2d7',borderRadius:10,outline:'none',width:'100%',boxSizing:'border-box'}}
          />
          <div>
            <div className="duel-label" style={{marginBottom:8}}>Аватар:</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {AVATAR_OPTIONS.map(em => (
                <button key={em}
                  onClick={() => setAvatar(em)}
                  style={{
                    width:48, height:48, fontSize:24,
                    border: '1.5px solid ' + (avatar === em ? '#d4a574' : '#e5e5ea'),
                    background: avatar === em ? 'rgba(212,165,116,.15)' : '#fff',
                    borderRadius:12, cursor:'pointer',
                  }}>{em}</button>
              ))}
            </div>
          </div>
          <button className="duel-btn duel-btn-primary" onClick={submit} disabled={!nickname.trim()}>
            Готово
          </button>
        </div>
      </div>
    );
  }

  // ─── LOBBY ─────────────────────────────────────────────────────────
  function Lobby({ onConnected }){
    const [profile, setProfile] = useState(() => loadProfile());
    const [step, setStep] = useState('pick-game'); // pick-game | configure | hosting | joining
    const [gameId, setGameId] = useState(null);
    const [yasnaId, setYasnaId] = useState(null);
    const [code, setCode] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [status, setStatus] = useState('');
    // Транспорт: 'peerjs' (реальный online) | 'broadcast' (две вкладки одного браузера)
    const peerjsAvailable = typeof window.Peer !== 'undefined';
    const [transportType, setTransportType] = useState(peerjsAvailable ? 'peerjs' : 'broadcast');
    const transportRef = useRef(null);
    const TransportClass = (transportType === 'peerjs' && peerjsAvailable) ? window.PeerJsTransport : DuelTransport;

    // Если профиля нет — сначала онбординг
    if(!profile){
      return <ProfileOnboarding onSave={setProfile}/>;
    }

    // Сортировка: по сложности → по estimatedSec
    const games = window.YasnaDuels.list().slice().sort((a, b) => {
      const da = (a.difficulty || 1) - (b.difficulty || 1);
      if(da) return da;
      return (a.estimatedSec || 0) - (b.estimatedSec || 0);
    });
    const game = gameId ? window.YasnaDuels.get(gameId) : null;

    const generateCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      return Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    };

    const cleanup = () => {
      if(transportRef.current){ transportRef.current.close(); transportRef.current = null; }
    };

    const create = () => {
      if(!game) return;
      const ya = yasnaId || game.defaultYasna || game.yasnaIds[0];
      setYasnaId(ya);
      const newCode = generateCode();
      setCode(newCode);
      setStep('hosting');
      setStatus(transportType === 'peerjs' ? 'Открываю канал PeerJS…' : 'Жду подключения соперника...');
      const t = new TransportClass(newCode, 'host');
      transportRef.current = t;
      t.startHeartbeat();
      const matchId = Math.random().toString(36).slice(2, 10);
      let opponentProfile = null;
      const off = t.on(msg => {
        if(msg.t === '__error'){
          setStatus('❌ ' + msg.message);
          return;
        }
        if(msg.t === 'guest-hello'){
          opponentProfile = msg.profile || null;
          t.send({ t:'host-ack', matchId, gameId, yasnaId: ya, profile });
          setStatus('Соперник подключился: ' + (opponentProfile ? opponentProfile.avatar + ' ' + opponentProfile.nickname : '...'));
          setTimeout(() => {
            off();
            onConnected({ transport: t, role: 'host', game, yasnaId: ya, matchId, myProfile: profile, oppProfile: opponentProfile });
          }, 800);
        }
      });
      // Для PeerJS обновим статус когда канал откроется (но соперник ещё не пришёл)
      if(transportType === 'peerjs'){
        const interval = setInterval(() => {
          if(t.closed){ clearInterval(interval); return; }
          if(t.peer && t.peer.id){
            setStatus('Канал открыт. Жду подключения соперника...');
            clearInterval(interval);
          }
        }, 200);
      }
    };

    const startJoin = () => {
      const cleanCode = joinCode.toUpperCase().trim();
      if(cleanCode.length !== 6){ setStatus('Код должен быть из 6 символов'); return; }
      setCode(cleanCode);
      setStep('joining');
      setStatus('Подключаюсь к комнате ' + cleanCode + '...');
      const t = new TransportClass(cleanCode, 'guest');
      transportRef.current = t;
      t.startHeartbeat();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        setStatus('Хост не отвечает. Проверьте код или попросите создать заново.');
      }, 12000);
      const off = t.on(msg => {
        if(msg.t === '__error'){
          clearTimeout(timeout);
          setStatus('❌ ' + msg.message);
          return;
        }
        if(msg.t === 'host-ack'){
          if(timedOut) return;
          clearTimeout(timeout);
          const ackGame = window.YasnaDuels.get(msg.gameId);
          setStatus('Подключено: ' + (msg.profile ? msg.profile.avatar + ' ' + msg.profile.nickname : 'хост') + '. Готовимся...');
          setTimeout(() => {
            off();
            onConnected({ transport: t, role: 'guest', game: ackGame || game, yasnaId: msg.yasnaId, matchId: msg.matchId, myProfile: profile, oppProfile: msg.profile || null });
          }, 800);
        }
      });
      t.send({ t:'guest-hello', profile });
    };

    const startVsBot = (level) => {
      if(!game) return;
      const ya = yasnaId || game.defaultYasna || game.yasnaIds[0];
      setYasnaId(ya);
      const bot = new BotTransport(game.id, level);
      transportRef.current = bot;
      const matchId = 'bot-' + Math.random().toString(36).slice(2, 10);
      const botNames = { easy: '😊 Андрей', medium: '🙂 Катя', hard: '😈 Магистр' };
      onConnected({
        transport: bot, role: 'host', game, yasnaId: ya, matchId,
        myProfile: profile,
        oppProfile: { nickname: botNames[level] || '🤖 Бот', avatar: '🤖', isBot: true },
      });
    };

    const cancel = () => {
      cleanup();
      setStep('pick-game');
      setStatus('');
      setCode('');
      setJoinCode('');
    };

    const copyCode = () => {
      try { navigator.clipboard?.writeText(code); setStatus('Код скопирован! Перешли его другу.'); } catch(_){}
    };

    return (
      <div className="duel-lobby">
        <div className="duel-title">
          <span className="duel-emoji">⚔️</span>
          <h1>Дуэль 1v1</h1>
          {step === 'pick-game' && <p>Выбери режим</p>}
          {step === 'configure' && <p>{game.title}</p>}
          {(step === 'hosting' || step === 'joining') && <p>{game?.title}</p>}
        </div>

        {step === 'pick-game' && (
          <div className="duel-game-list">
            {games.length === 0 && <div className="duel-empty">Нет зарегистрированных игр</div>}
            {games.map(g => (
              <button key={g.id} className="duel-game-card" onClick={() => { setGameId(g.id); setStep('configure'); }}>
                <div className="duel-game-cat">{g.category}</div>
                <div className="duel-game-title">{g.title}</div>
                <div className="duel-game-sub">{g.subtitle || ''}</div>
                <div className="duel-game-meta">
                  <span>≈{g.estimatedSec}s</span>
                  <span>•</span>
                  <span>{'★'.repeat(g.difficulty || 1)}</span>
                </div>
              </button>
            ))}
            <div style={{display:'flex',gap:8,marginTop:6}}>
              <button className="duel-btn duel-btn-text" onClick={() => setStep('join-only')} style={{flex:1}}>📥 У меня есть код</button>
              <button className="duel-btn duel-btn-text" onClick={() => setStep('stats')} style={{flex:1}}>📊 Моя статистика</button>
            </div>
          </div>
        )}

        {step === 'stats' && (
          <StatsScreen onClose={() => setStep('pick-game')}/>
        )}

        {step === 'join-only' && (
          <div className="duel-choose">
            <p style={{color:'#6e6e73',marginTop:0}}>Введите код, который прислал соперник</p>
            <div className="duel-join">
              <input
                placeholder="КОД"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{textTransform:'uppercase'}}
                autoFocus
              />
              <button className="duel-btn duel-btn-secondary" onClick={startJoin} disabled={joinCode.length !== 6}>
                Войти
              </button>
            </div>
            {status && <div className="duel-status">{status}</div>}
            <button className="duel-btn duel-btn-text" onClick={() => { setStep('pick-game'); setStatus(''); }}>← Назад</button>
          </div>
        )}

        {step === 'configure' && game && (
          <div className="duel-choose">
            <div className="duel-game-desc">{game.description}</div>

            {game.yasnaIds.length > 1 && (
              <div className="duel-yasna-pick">
                <div className="duel-label">Ясна:</div>
                <div className="duel-yasna-options">
                  {game.yasnaIds.map(id => {
                    const t = window.YasnaData.T.find(x => x.id === id) || window.YasnaData.T.find(x => x.n === id);
                    if(!t) return null;
                    const sel = (yasnaId || game.defaultYasna || game.yasnaIds[0]) === id;
                    return (
                      <button key={id}
                        className={'duel-pill ' + (sel ? 'duel-pill-active' : '')}
                        onClick={() => setYasnaId(id)}>
                        {t.n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {peerjsAvailable && (
              <div className="duel-transport-toggle">
                <div className="duel-label" style={{textAlign:'center',marginBottom:6}}>Тип соединения</div>
                <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                  <button className={'duel-btn duel-pill ' + (transportType === 'peerjs' ? 'duel-pill-active' : '')} onClick={() => setTransportType('peerjs')} title="Реальный online через WebRTC">🌐 Online</button>
                  <button className={'duel-btn duel-pill ' + (transportType === 'broadcast' ? 'duel-pill-active' : '')} onClick={() => setTransportType('broadcast')} title="Только в одном браузере (две вкладки)">🖥 Эта вкладка</button>
                </div>
              </div>
            )}

            <button className="duel-btn duel-btn-primary" onClick={create}>＋ Создать комнату</button>

            <div className="duel-bot-section">
              <div className="duel-label" style={{textAlign:'center',marginBottom:6}}>🤖 Тренировка с ботом</div>
              <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                <button className="duel-btn duel-pill" onClick={() => startVsBot('easy')} title="Лёгкий бот">😊 Лёгкий</button>
                <button className="duel-btn duel-pill" onClick={() => startVsBot('medium')} title="Средний бот">🙂 Средний</button>
                <button className="duel-btn duel-pill" onClick={() => startVsBot('hard')} title="Сложный бот">😈 Сложный</button>
              </div>
            </div>

            <div className="duel-or">— или —</div>
            <div className="duel-join">
              <input
                placeholder="Код друга"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{textTransform:'uppercase'}}
              />
              <button className="duel-btn duel-btn-secondary" onClick={startJoin} disabled={joinCode.length !== 6}>
                Войти
              </button>
            </div>
            <button className="duel-btn duel-btn-text" onClick={() => setStep('pick-game')}>← Другой режим</button>
            <div className="duel-hint">
              {transportType === 'peerjs' ? (
                <>🌐 Реальный online через WebRTC. Дай другу 6-значный код — он сможет подключиться с любого устройства, любой страны.</>
              ) : (
                <>🖥 Демо-режим: соединение работает только между вкладками одного браузера. Открой страницу в двух вкладках, в одной создай, во второй введи код.</>
              )}
            </div>
          </div>
        )}

        {step === 'hosting' && (
          <div className="duel-hosting">
            <div className="duel-code">{code}</div>
            <button className="duel-btn duel-btn-primary" onClick={copyCode}>📋 Копировать код</button>
            <div className="duel-status">{status}</div>
            <button className="duel-btn duel-btn-text" onClick={cancel}>Отмена</button>
          </div>
        )}

        {step === 'joining' && (
          <div className="duel-hosting">
            <div className="duel-status duel-status-large">{status}</div>
            <button className="duel-btn duel-btn-text" onClick={cancel}>Отмена</button>
          </div>
        )}
      </div>
    );
  }

  // ─── RUNNER (countdown → game → result) ────────────────────────────
  function DuelRunner({ transport, role, game, yasnaId, matchId, myProfile, oppProfile, onPlayAgain, onClose }){
    const [phase, setPhase] = useState('countdown'); // countdown | playing | result
    const [countdown, setCountdown] = useState(3);
    const [result, setResult] = useState(null);
    const [disconnected, setDisconnected] = useState(false);
    const [myResultMsg, setMyResultMsg] = useState(null); // для score-based режимов
    const [oppResultMsg, setOppResultMsg] = useState(null);
    const startRef = useRef(0);
    const matchMode = game.mode || 'race'; // 'race' (first wins) | 'score' (compare scores)

    // Countdown 3 → 2 → 1 → playing
    useEffect(() => {
      if(phase !== 'countdown') return;
      if(countdown > 0){
        const tm = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(tm);
      }
      startRef.current = performance.now();
      setPhase('playing');
    }, [phase, countdown]);

    // Слушаем глобальные события: finish, result, disconnect, leave
    useEffect(() => {
      const off = transport.on(msg => {
        if(msg.matchId && msg.matchId !== matchId) return; // защита от стейл-сообщений
        if(msg.t === 'finish' && phase !== 'result'){
          // Race: соперник завершил первым → проигрыш
          setResult({
            winner: role === 'host' ? 'guest' : 'host',
            time: msg.time,
            iAmWinner: false,
            byDisconnect: false,
            bySurrender: !!msg.surrender,
          });
          setPhase('result');
        }
        if(msg.t === 'result' && phase !== 'result'){
          // Score: соперник сдал результат, ждём пока я тоже
          setOppResultMsg(msg);
        }
        if(msg.t === '__disconnect' || msg.t === '__leave'){
          if(phase === 'playing'){
            // Соперник ушёл во время игры — мы выигрываем по неявке
            setDisconnected(true);
            setResult({
              winner: role,
              iAmWinner: true,
              byDisconnect: true,
            });
            setPhase('result');
          } else if(phase === 'countdown'){
            // Ушёл до начала — закрываем
            setDisconnected(true);
            onClose();
          }
        }
      });
      return off;
    }, [phase, role, matchId, transport, onClose]);

    // Для score-based: когда оба прислали result — считаем победителя
    useEffect(() => {
      if(phase !== 'playing') return;
      if(!myResultMsg || !oppResultMsg) return;
      // Сравниваем по score, при равенстве — по времени (меньше=лучше)
      let iWin;
      if(myResultMsg.score !== oppResultMsg.score){
        iWin = myResultMsg.score > oppResultMsg.score;
      } else if(myResultMsg.time !== oppResultMsg.time){
        iWin = myResultMsg.time < oppResultMsg.time;
      } else {
        // Полный паритет — host выигрывает по правилу tiebreaker
        iWin = role === 'host';
      }
      setResult({
        winner: iWin ? role : (role === 'host' ? 'guest' : 'host'),
        iAmWinner: iWin,
        time: myResultMsg.time,
        myScore: myResultMsg.score,
        oppScore: oppResultMsg.score,
        myMaxScore: myResultMsg.maxScore,
        byDisconnect: false,
      });
      setPhase('result');
    }, [myResultMsg, oppResultMsg, phase, role]);

    // Колбэк для race-mode: первый прислал = победитель
    const submitFinish = (payload) => {
      if(phase !== 'playing') return;
      const time = performance.now() - startRef.current;
      transport.send({ t:'finish', matchId, time, payload });
      setResult({
        winner: role,
        time,
        iAmWinner: true,
        byDisconnect: false,
      });
      setPhase('result');
    };

    // Колбэк для score-mode: оба заканчивают, потом сравниваем
    const submitResult = ({ score, maxScore, payload }) => {
      if(phase !== 'playing') return;
      if(myResultMsg) return; // уже отправлен
      const time = performance.now() - startRef.current;
      const msg = { t:'result', matchId, score, maxScore, time, payload };
      transport.send(msg);
      setMyResultMsg(msg);
    };

    // Поражение по сдаче
    const surrender = () => {
      if(phase !== 'playing') return;
      transport.send({ t:'finish', matchId, surrender: true });
      setResult({
        winner: role === 'host' ? 'guest' : 'host',
        iAmWinner: false,
        bySurrender: true,
      });
      setPhase('result');
    };

    // Запись матча в storage когда переходим в result-фазу
    const recordedRef = useRef(false);
    useEffect(() => {
      if(phase !== 'result' || !result || recordedRef.current) return;
      recordedRef.current = true;
      const isBot = !!(oppProfile && oppProfile.isBot);
      const transportName = (transport && transport.constructor && transport.constructor.name) || 'unknown';
      const transport_t = transportName === 'PeerJsTransport' ? 'peerjs'
                        : transportName === 'BotTransport' ? 'bot'
                        : transportName === 'DuelTransport' ? 'broadcast' : 'unknown';
      const recorded = window.YasnaDuelStorage.recordMatch({
        matchId, gameId: game.id, yasnaId, role,
        transport: transport_t,
        result: result.iAmWinner ? 'win' : 'loss',
        time: result.time || 0,
        score: result.myScore != null ? result.myScore : null,
        maxScore: result.myMaxScore != null ? result.myMaxScore : null,
        opponentName: oppProfile ? oppProfile.nickname : '',
        isBot,
        botLevel: isBot ? (oppProfile.nickname.includes('Андрей') ? 'easy' : oppProfile.nickname.includes('Катя') ? 'medium' : 'hard') : null,
        bySurrender: result.bySurrender,
        byDisconnect: result.byDisconnect,
      });
      if(recorded && recorded.isNewRecord){
        result.isNewRecord = true;
      }
      // Проверяем ачивки на основе записанного матча
      if(recorded && window.YasnaDuelAchievements){
        const unlocked = window.YasnaDuelAchievements.check(recorded);
        if(unlocked.length) result.newAchievements = unlocked;
      }
    }, [phase, result]);

    if(phase === 'result' && result){
      return (
        <ResultScreen
          result={result}
          gameTitle={game.title}
          onPlayAgain={onPlayAgain}
          onClose={onClose}
        />
      );
    }

    const GameComponent = game.Component;
    const isPlaying = phase === 'playing';

    return (
      <div className="duel-runner">
        <div className="duel-runner-head">
          <div className="duel-runner-title">{game.title}</div>
          {isPlaying && (
            <button className="duel-btn duel-btn-text duel-surrender" onClick={surrender} title="Сдаться">
              Сдаться
            </button>
          )}
        </div>
        <div className="duel-runner-body">
          {GameComponent && (
            <GameComponent
              transport={transport}
              role={role}
              yasnaId={yasnaId}
              matchId={matchId}
              isPlaying={isPlaying}
              startTime={startRef.current}
              matchMode={matchMode}
              myProfile={myProfile}
              oppProfile={oppProfile}
              onSubmitFinish={submitFinish}
              onSubmitResult={submitResult}
              waitingForOpponent={!!myResultMsg && !oppResultMsg}
            />
          )}
        </div>
        {phase === 'countdown' && (
          <div className="duel-overlay-countdown">
            <div className="duel-countdown-big">{countdown || 'GO!'}</div>
            {countdown > 0 && <div>Приготовьтесь...</div>}
          </div>
        )}
      </div>
    );
  }

  // ─── RESULT ────────────────────────────────────────────────────────
  function ResultScreen({ result, gameTitle, onPlayAgain, onClose }){
    const won = result.iAmWinner;
    let title = won ? 'Победа!' : 'Поражение';
    let emoji = won ? '🏆' : '😔';
    let subtitle = '';
    if(result.byDisconnect){ title = 'Победа по неявке'; emoji = '🚪'; subtitle = 'Соперник отключился'; }
    if(result.bySurrender){ title = won ? 'Победа' : 'Сдача'; emoji = won ? '🏆' : '🏳️'; subtitle = won ? 'Соперник сдался' : 'Вы сдались'; }
    return (
      <div className="duel-result">
        <div className="duel-result-emoji">{emoji}</div>
        <h1 className="duel-result-title">{title}</h1>
        <div className="duel-result-subtitle">{gameTitle}</div>
        {subtitle && <div className="duel-result-time" style={{color:'#6e6e73',fontStyle:'italic'}}>{subtitle}</div>}
        {result.time && !result.byDisconnect && !result.bySurrender && (
          <div className="duel-result-time">
            {won ? 'Ваше время' : 'Время соперника'}: <strong>{(result.time/1000).toFixed(1)}s</strong>
          </div>
        )}
        {result.myScore != null && (
          <div className="duel-result-time">
            Счёт: <strong>{result.myScore}/{result.myMaxScore}</strong>
            {result.oppScore != null && <span style={{color:'#6e6e73'}}> · Соперник: {result.oppScore}/{result.myMaxScore}</span>}
          </div>
        )}
        {result.isNewRecord && won && (
          <div style={{
            padding:'8px 14px',
            background:'linear-gradient(135deg, rgba(255,215,0,.2), rgba(212,165,116,.2))',
            border:'1.5px solid #d4a574',
            borderRadius:999,
            fontSize:14,
            fontWeight:700,
            color:'#7a5e25',
            marginTop:8,
          }}>⭐ Новый рекорд!</div>
        )}
        {result.newAchievements && result.newAchievements.length > 0 && (
          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:12,maxWidth:360}}>
            <div style={{fontSize:11,letterSpacing:1,textTransform:'uppercase',color:'#7a5e25',fontWeight:700,textAlign:'center'}}>🏅 Получено достижений:</div>
            {result.newAchievements.map(a => (
              <div key={a.id} style={{
                display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
                background:'linear-gradient(135deg, rgba(212,165,116,.15), rgba(124,58,237,.08))',
                border:'1px solid rgba(212,165,116,.4)', borderRadius:10,
                animation:'duelAchievementIn .5s ease',
              }}>
                <div style={{fontSize:24}}>{a.icon}</div>
                <div style={{flex:1,textAlign:'left'}}>
                  <div style={{fontWeight:700,fontSize:13}}>{a.title}</div>
                  <div style={{fontSize:11,color:'#6e6e73'}}>{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="duel-actions">
          <button className="duel-btn duel-btn-primary" onClick={onPlayAgain}>Сыграть ещё</button>
          <button className="duel-btn duel-btn-text" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    );
  }

  // ─── STATS SCREEN ──────────────────────────────────────────────────
  function StatsScreen({ onClose }){
    const data = window.YasnaDuelStorage.getOverallStats();
    const matches = window.YasnaDuelStorage.getMatchHistory(20);
    const totals = data.totals;
    const winRate = totals.played ? Math.round((totals.wins / totals.played) * 100) : 0;
    const Tdata = window.YasnaData?.T || [];
    const yasnaName = (id) => Tdata.find(t => t.id === id)?.n || id;
    const gameTitle = (id) => window.YasnaDuels?.get(id)?.title || id;

    const fmtTime = (ms) => ms ? (ms/1000).toFixed(1) + 's' : '—';
    const fmtDate = (ts) => {
      const d = new Date(ts);
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    };

    return (
      <div className="duel-stats" style={{padding:'40px 24px',overflowY:'auto'}}>
        <div className="duel-title">
          <span className="duel-emoji">📊</span>
          <h1>Ваша статистика</h1>
        </div>

        {/* Общие итоги */}
        <div className="duel-stats-totals">
          <div className="duel-stat-card">
            <div className="duel-stat-num">{totals.played || 0}</div>
            <div className="duel-stat-label">Матчей</div>
          </div>
          <div className="duel-stat-card">
            <div className="duel-stat-num" style={{color:'#16a34a'}}>{totals.wins || 0}</div>
            <div className="duel-stat-label">Побед</div>
          </div>
          <div className="duel-stat-card">
            <div className="duel-stat-num" style={{color:'#dc2626'}}>{totals.losses || 0}</div>
            <div className="duel-stat-label">Поражений</div>
          </div>
          <div className="duel-stat-card">
            <div className="duel-stat-num">{winRate}%</div>
            <div className="duel-stat-label">Винрейт</div>
          </div>
        </div>

        {/* Серия побед */}
        {data.streaks?.overall && (
          <div className="duel-stats-section">
            <div className="duel-label">🔥 Серия побед</div>
            <div style={{display:'flex',gap:10,marginTop:6}}>
              <div className="duel-stat-card" style={{flex:1}}>
                <div className="duel-stat-num">{data.streaks.overall.current || 0}</div>
                <div className="duel-stat-label">Текущая</div>
              </div>
              <div className="duel-stat-card" style={{flex:1}}>
                <div className="duel-stat-num" style={{color:'#d4a574'}}>{data.streaks.overall.best || 0}</div>
                <div className="duel-stat-label">Лучшая</div>
              </div>
            </div>
          </div>
        )}

        {/* Личные рекорды по режимам */}
        {Object.keys(data.records || {}).length > 0 && (
          <div className="duel-stats-section">
            <div className="duel-label">🏆 Личные рекорды</div>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:6}}>
              {Object.entries(data.records).map(([gid, byYasna]) => (
                Object.entries(byYasna).map(([yid, rec]) => (
                  <div key={gid+'-'+yid} className="duel-record-row">
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>{gameTitle(gid)} · {yasnaName(yid)}</div>
                      <div style={{fontSize:11,color:'#6e6e73'}}>{rec.played} матчей · {rec.wins || 0}🏆 · {rec.losses || 0}💔</div>
                    </div>
                    <div style={{textAlign:'right',fontSize:13}}>
                      {rec.bestTime && <div>⏱ <strong>{fmtTime(rec.bestTime)}</strong></div>}
                      {rec.bestScore != null && <div>⭐ <strong>{rec.bestScore}/{rec.maxScore}</strong></div>}
                    </div>
                  </div>
                ))
              ))}
            </div>
          </div>
        )}

        {/* История матчей */}
        {matches.length > 0 && (
          <div className="duel-stats-section">
            <div className="duel-label">📜 Последние матчи (топ 20)</div>
            <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:6,maxHeight:280,overflowY:'auto'}}>
              {matches.map((m, idx) => (
                <div key={m.id+idx} style={{
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'8px 12px',borderRadius:8,
                  background: m.result === 'win' ? 'rgba(22,163,74,.06)' : 'rgba(220,38,38,.04)',
                  borderLeft:'3px solid '+(m.result === 'win' ? '#16a34a' : '#dc2626'),
                  fontSize:12,
                }}>
                  <div>
                    <span style={{fontWeight:600}}>{m.result === 'win' ? '🏆' : '💔'} {gameTitle(m.gameId)}</span>
                    <span style={{color:'#6e6e73'}}> · {yasnaName(m.yasnaId)}</span>
                    {m.isBot && <span style={{fontSize:10,color:'#7c3aed',marginLeft:4}}>🤖{m.botLevel}</span>}
                    {m.bySurrender && <span style={{color:'#dc2626',marginLeft:4}}>(сдача)</span>}
                    {m.byDisconnect && <span style={{color:'#dc2626',marginLeft:4}}>(дисконнект)</span>}
                  </div>
                  <div style={{color:'#6e6e73',fontSize:11}}>
                    {m.score != null ? `${m.score}/${m.maxScore} · ` : ''}{m.time ? fmtTime(m.time) : ''} · {fmtDate(m.date)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {totals.played === 0 && (
          <div style={{textAlign:'center',padding:32,color:'#6e6e73'}}>
            Сыграйте свой первый матч — статистика появится здесь.
          </div>
        )}

        {/* Достижения */}
        {(() => {
          const achievements = window.YasnaDuelAchievements?.list() || [];
          const unlockedCount = achievements.filter(a => a.unlocked).length;
          return (
            <div className="duel-stats-section">
              <div className="duel-label">🏅 Достижения · {unlockedCount} / {achievements.length}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8,marginTop:6}}>
                {achievements.map(a => (
                  <div key={a.id} style={{
                    padding:'10px 8px',
                    border: '1.5px solid '+(a.unlocked ? '#d4a574' : '#e5e5ea'),
                    background: a.unlocked ? 'linear-gradient(135deg, rgba(212,165,116,.12), rgba(124,58,237,.05))' : '#fafafa',
                    borderRadius:10, textAlign:'center', position:'relative',
                    opacity: a.unlocked ? 1 : 0.55,
                  }} title={a.desc}>
                    <div style={{fontSize:24,filter: a.unlocked ? 'none' : 'grayscale(1)'}}>{a.icon}</div>
                    <div style={{fontSize:11,fontWeight:700,color:a.unlocked?'#1d1d1f':'#6e6e73',marginTop:4,lineHeight:1.2}}>{a.title}</div>
                    <div style={{fontSize:10,color:'#6e6e73',marginTop:2,lineHeight:1.3}}>{a.desc}</div>
                    {a.progress != null && a.goal && !a.unlocked && (
                      <div style={{marginTop:6,height:3,background:'#e5e5ea',borderRadius:2,overflow:'hidden'}}>
                        <div style={{height:'100%',width:Math.round(a.progress/a.goal*100)+'%',background:'#d4a574'}}/>
                      </div>
                    )}
                    {a.progress != null && a.goal && !a.unlocked && (
                      <div style={{fontSize:10,color:'#6e6e73',marginTop:3}}>{a.progress} / {a.goal}</div>
                    )}
                    {a.unlocked && <div style={{position:'absolute',top:4,right:4,fontSize:10,color:'#16a34a'}}>✓</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:24,flexWrap:'wrap'}}>
          <button className="duel-btn duel-btn-text" onClick={() => {
            const json = window.YasnaDuelStorage.exportJSON();
            navigator.clipboard?.writeText(json);
            alert('Статистика скопирована в буфер обмена. Сохраните файл .json для бэкапа.');
          }}>📋 Экспорт</button>
          <button className="duel-btn duel-btn-text" onClick={() => {
            if(confirm('Очистить всю статистику и историю? Действие необратимо.')){
              window.YasnaDuelStorage.reset();
              onClose();
            }
          }} style={{color:'#dc2626'}}>🗑 Сбросить</button>
          <button className="duel-btn duel-btn-primary" onClick={onClose}>Назад в лобби</button>
        </div>
      </div>
    );
  }

  // ─── DUEL APP ──────────────────────────────────────────────────────
  function DuelApp({ onClose }){
    const [match, setMatch] = useState(null); // { transport, role, game, yasnaId, matchId }

    const handleConnected = (m) => setMatch(m);
    const handlePlayAgain = () => {
      if(match?.transport) match.transport.close();
      setMatch(null);
    };
    const handleClose = () => {
      if(match?.transport) match.transport.close();
      onClose();
    };

    // Cleanup on unmount
    useEffect(() => {
      return () => { if(match?.transport) match.transport.close(); };
    }, [match]);

    return (
      <div className="duel-modal" onClick={(e) => { if(e.target === e.currentTarget) handleClose(); }}>
        <div className="duel-frame">
          <button className="duel-x" onClick={handleClose} aria-label="Закрыть">✕</button>
          {!match && <Lobby onConnected={handleConnected}/>}
          {match && (
            <DuelRunner
              transport={match.transport}
              role={match.role}
              game={match.game}
              yasnaId={match.yasnaId}
              matchId={match.matchId}
              myProfile={match.myProfile}
              oppProfile={match.oppProfile}
              onPlayAgain={handlePlayAgain}
              onClose={handleClose}
            />
          )}
        </div>
        <DuelStyles/>
      </div>
    );
  }

  // ─── EMBEDDED STYLES ───────────────────────────────────────────────
  function DuelStyles(){
    return <style>{`
      .duel-modal { position: fixed; inset: 0; z-index: 250; background: rgba(14,16,25,.86); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; animation: duelFadeIn .3s ease; }
      @keyframes duelFadeIn { from { opacity:0; } to { opacity:1; } }
      .duel-frame { position: relative; width: 100%; max-width: 760px; max-height: 92vh; background: #fff; border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,.4); overflow: hidden; display: flex; flex-direction: column; }
      @media (max-width: 768px) {
        .duel-frame { max-width: 100%; max-height: 100dvh; border-radius: 0; }
        .duel-lobby { padding: 36px 16px 24px; gap: 18px; }
        .duel-title h1 { font-size: 20px; }
        .duel-emoji { font-size: 40px; }
        .duel-game-card { padding: 12px 14px; }
        .duel-game-title { font-size: 15px; }
        .duel-runner-body { padding: 10px 12px; gap: 8px; }
        .duel-status-bar { gap: 8px; }
        .duel-player-card { padding: 8px 10px; }
        .duel-player-stats { font-size: 14px; }
        .duel-timer { font-size: 22px; min-width: 60px; }
        .duel-task { font-size: 12px; padding: 6px 10px; }
        .duel-star-wrap { min-height: 280px; }
        .duel-star-wrap > div { max-height: 50dvh; }
        .duel-code { font-size: 38px; letter-spacing: 5px; padding: 16px 20px; }
        .duel-result { padding: 32px 20px; }
        .duel-result-emoji { font-size: 72px; }
        .duel-result-title { font-size: 24px; }
        .duel-mirror-canvas svg { max-height: 38dvh; }
      }
      .duel-x { position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; border-radius: 16px; background: rgba(0,0,0,.05); border: none; color: #424245; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; z-index: 10; }
      .duel-x:hover { background: rgba(0,0,0,.1); }

      .duel-lobby { padding: 48px 32px 32px; display: flex; flex-direction: column; align-items: stretch; gap: 24px; overflow-y: auto; }
      .duel-title { text-align: center; }
      .duel-emoji { font-size: 48px; display: block; margin-bottom: 8px; }
      .duel-title h1 { font-size: 24px; margin: 0 0 8px; color: #1d1d1f; font-weight: 700; }
      .duel-title p { font-size: 14px; color: #6e6e73; margin: 0; }

      .duel-game-list { display: flex; flex-direction: column; gap: 10px; max-width: 480px; margin: 0 auto; width: 100%; }
      .duel-empty { color: #6e6e73; text-align: center; padding: 16px; }
      .duel-game-card { padding: 14px 16px; border-radius: 12px; border: 1.5px solid #e5e5ea; background: #fff; cursor: pointer; text-align: left; transition: border-color .15s, transform .1s; display: flex; flex-direction: column; gap: 4px; }
      .duel-game-card:hover { border-color: #d4a574; }
      .duel-game-card:active { transform: scale(.98); }
      .duel-game-cat { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #d4a574; font-weight: 700; }
      .duel-game-title { font-size: 16px; font-weight: 600; color: #1d1d1f; }
      .duel-game-sub { font-size: 13px; color: #6e6e73; }
      .duel-game-meta { display: flex; gap: 6px; font-size: 11px; color: #a1a1a6; margin-top: 4px; }

      .duel-game-desc { font-size: 14px; color: #424245; padding: 12px 14px; background: #f5f5f7; border-radius: 10px; line-height: 1.5; }
      .duel-yasna-pick { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
      .duel-label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #6e6e73; font-weight: 700; }
      .duel-yasna-options { display: flex; flex-wrap: wrap; gap: 6px; }
      .duel-bot-section { padding: 12px 14px; background: linear-gradient(135deg, rgba(124,58,237,.06), rgba(212,165,116,.06)); border-radius: 12px; border: 1px dashed rgba(124,58,237,.25); }
      .duel-transport-toggle { padding: 10px 14px; border-radius: 10px; background: #f5f5f7; }
      .duel-stats-totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0; }
      .duel-stat-card { padding: 12px 8px; border: 1.5px solid #e5e5ea; border-radius: 10px; text-align: center; background: #fff; }
      .duel-stat-num { font-size: 22px; font-weight: 700; color: #1d1d1f; line-height: 1; }
      .duel-stat-label { font-size: 11px; color: #6e6e73; margin-top: 4px; }
      .duel-stats-section { margin: 18px 0; }
      .duel-record-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #fff; border: 1.5px solid #e5e5ea; border-radius: 10px; }
      @media (max-width: 768px) {
        .duel-stats-totals { grid-template-columns: repeat(2, 1fr); }
        .duel-stat-num { font-size: 20px; }
      }
      .duel-pill { padding: 6px 12px; font-size: 13px; border: 1.5px solid #e5e5ea; background: #fff; border-radius: 999px; cursor: pointer; transition: all .15s; }
      .duel-pill:hover { border-color: #d4a574; }
      .duel-pill-active { background: #d4a574; color: #fff; border-color: #d4a574; }

      .duel-choose { display: flex; flex-direction: column; align-items: stretch; gap: 14px; max-width: 420px; margin: 0 auto; width: 100%; }
      .duel-or { font-size: 13px; color: #a1a1a6; text-align: center; }
      .duel-join { display: flex; gap: 8px; }
      .duel-join input { flex: 1; padding: 12px 14px; font-size: 16px; border: 1.5px solid #d2d2d7; border-radius: 10px; font-family: ui-monospace, monospace; letter-spacing: 4px; text-align: center; font-weight: 600; outline: none; transition: border-color .15s; }
      .duel-join input:focus { border-color: #d4a574; }

      .duel-btn { padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 10px; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 6px; justify-content: center; transition: transform .1s, background .15s; }
      .duel-btn:active { transform: scale(.97); }
      .duel-btn:disabled { opacity: .4; cursor: not-allowed; }
      .duel-btn-primary { background: #d4a574; color: #1d1d1f; }
      .duel-btn-primary:hover:not(:disabled) { background: #c89764; }
      .duel-btn-secondary { background: #1d1d1f; color: #fff; }
      .duel-btn-secondary:hover:not(:disabled) { background: #2d2d2f; }
      .duel-btn-text { background: transparent; color: #6e6e73; padding: 8px 14px; }
      .duel-btn-text:hover { color: #1d1d1f; }
      .duel-hint { font-size: 12px; color: #6e6e73; padding: 12px 16px; background: #f5f5f7; border-radius: 10px; line-height: 1.5; }

      .duel-code { font-size: 56px; font-weight: 700; letter-spacing: 8px; font-family: ui-monospace, monospace; background: linear-gradient(180deg, #f5f5f7 0%, #e8e8ec 100%); padding: 24px 32px; border-radius: 16px; color: #1d1d1f; border: 2px dashed #d4a574; align-self: center; }
      .duel-hosting { display: flex; flex-direction: column; align-items: center; gap: 16px; max-width: 400px; margin: 0 auto; width: 100%; }
      .duel-status { font-size: 14px; color: #6e6e73; min-height: 20px; text-align: center; }
      .duel-status-large { font-size: 18px; color: #1d1d1f; font-weight: 500; }

      /* RUNNER */
      .duel-runner { display: flex; flex-direction: column; flex: 1; position: relative; min-height: 480px; max-height: 92vh; }
      .duel-runner-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px 0; }
      .duel-runner-title { font-size: 13px; font-weight: 700; color: #1d1d1f; letter-spacing: .3px; }
      .duel-surrender { font-size: 12px !important; color: #dc2626 !important; padding: 4px 10px !important; }
      .duel-runner-body { flex: 1; padding: 16px 24px; display: flex; flex-direction: column; gap: 12px; min-height: 0; }

      /* Game-shared CSS variables */
      .duel-status-bar { display: flex; align-items: center; gap: 14px; justify-content: space-between; }
      .duel-player-card { flex: 1; padding: 10px 14px; border-radius: 12px; border: 2px solid; background: #fff; display: flex; flex-direction: column; gap: 4px; }
      .duel-player-label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
      .duel-player-stats { display: flex; gap: 12px; align-items: center; font-size: 16px; font-weight: 600; }
      .duel-stat-correct { color: #16a34a; }
      .duel-stat-errors { color: #dc2626; }
      .duel-timer { font-size: 26px; font-weight: 700; font-family: ui-monospace, monospace; color: #1d1d1f; min-width: 80px; text-align: center; }

      .duel-task { text-align: center; font-size: 14px; color: #424245; padding: 8px 16px; background: #fef8e7; border-radius: 8px; border-left: 3px solid #d4a574; }
      .duel-star-wrap { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 320px; }
      .duel-star-wrap > div { width: 100%; height: 100%; max-height: 50vh; }

      .duel-overlay-countdown { position: absolute; inset: 0; background: rgba(255,255,255,.92); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 5; color: #424245; pointer-events: none; }
      .duel-countdown-big { font-size: 144px; font-weight: 700; color: #d4a574; font-family: ui-monospace, monospace; line-height: 1; animation: duelPulse .9s ease-out; }
      @keyframes duelPulse { 0% { transform: scale(.5); opacity: 0; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes duelAchievementIn { 0% { transform: scale(.7) translateY(20px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }

      .duel-result { padding: 56px 32px 40px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; flex: 1; justify-content: center; }
      .duel-result-emoji { font-size: 96px; }
      .duel-result-title { font-size: 32px; margin: 0; color: #1d1d1f; font-weight: 700; }
      .duel-result-subtitle { font-size: 14px; color: #6e6e73; }
      .duel-result-time { font-size: 16px; color: #424245; }
      .duel-actions { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; justify-content: center; }
    `}</style>;
  }

  window.DuelApp = DuelApp;
  // Backward compat: код, который ещё ожидает DuelApp на старом слоте, найдёт его.
})();
