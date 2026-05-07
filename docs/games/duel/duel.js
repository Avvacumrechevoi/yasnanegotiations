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

  // ─── LOBBY ─────────────────────────────────────────────────────────
  function Lobby({ onConnected }){
    const [step, setStep] = useState('pick-game'); // pick-game | configure | hosting | joining
    const [gameId, setGameId] = useState(null);
    const [yasnaId, setYasnaId] = useState(null);
    const [code, setCode] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [status, setStatus] = useState('');
    const transportRef = useRef(null);

    const games = window.YasnaDuels.list();
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
      setStatus('Жду подключения соперника...');
      const t = new DuelTransport(newCode);
      transportRef.current = t;
      t.startHeartbeat();
      const matchId = Math.random().toString(36).slice(2, 10);
      const off = t.on(msg => {
        if(msg.t === 'guest-hello'){
          // Принимаем только первого гостя (peerSessionId уже зафиксирован транспортом)
          t.send({ t:'host-ack', matchId, gameId, yasnaId: ya });
          setStatus('Соперник подключился!');
          setTimeout(() => {
            off();
            onConnected({ transport: t, role: 'host', game, yasnaId: ya, matchId });
          }, 600);
        }
      });
    };

    const startJoin = () => {
      const cleanCode = joinCode.toUpperCase().trim();
      if(cleanCode.length !== 6){ setStatus('Код должен быть из 6 символов'); return; }
      setCode(cleanCode);
      setStep('joining');
      setStatus('Подключаюсь к комнате ' + cleanCode + '...');
      const t = new DuelTransport(cleanCode);
      transportRef.current = t;
      t.startHeartbeat();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        setStatus('Хост не отвечает. Проверьте код или попросите создать заново.');
      }, 8000);
      const off = t.on(msg => {
        if(msg.t === 'host-ack'){
          if(timedOut) return;
          clearTimeout(timeout);
          const ackGame = window.YasnaDuels.get(msg.gameId);
          setStatus('Подключено! Готовимся...');
          setTimeout(() => {
            off();
            onConnected({ transport: t, role: 'guest', game: ackGame || game, yasnaId: msg.yasnaId, matchId: msg.matchId });
          }, 600);
        }
      });
      t.send({ t:'guest-hello' });
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
            <button className="duel-btn duel-btn-text" onClick={() => setStep('join-only')}>У меня есть код →</button>
          </div>
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

            <button className="duel-btn duel-btn-primary" onClick={create}>＋ Создать комнату</button>
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
              💡 Для превью — открой страницу в двух вкладках одного браузера. В одной создай комнату, во второй введи код.
              В продакшене будет реальный online через WebRTC.
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
  function DuelRunner({ transport, role, game, yasnaId, matchId, onPlayAgain, onClose }){
    const [phase, setPhase] = useState('countdown'); // countdown | playing | result
    const [countdown, setCountdown] = useState(3);
    const [result, setResult] = useState(null);
    const [disconnected, setDisconnected] = useState(false);
    const startRef = useRef(0);

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

    // Слушаем глобальные события: finish, disconnect, leave
    useEffect(() => {
      const off = transport.on(msg => {
        if(msg.matchId && msg.matchId !== matchId) return; // защита от стейл-сообщений
        if(msg.t === 'finish' && phase !== 'result'){
          // Соперник завершил
          setResult({
            winner: role === 'host' ? 'guest' : 'host',
            time: msg.time,
            iAmWinner: false,
            byDisconnect: false,
          });
          setPhase('result');
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

    // Колбэк, который игра вызывает когда игрок победил
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
              onSubmitFinish={submitFinish}
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
        <div className="duel-actions">
          <button className="duel-btn duel-btn-primary" onClick={onPlayAgain}>Сыграть ещё</button>
          <button className="duel-btn duel-btn-text" onClick={onClose}>Закрыть</button>
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
      @media (max-width: 768px) { .duel-frame { max-width: 100%; max-height: 100dvh; border-radius: 0; } }
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
