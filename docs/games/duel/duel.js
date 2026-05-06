// ═══════════════════════════════════════════════════════════════════
// DUEL — 1v1 онлайн-дуэль (P0 MVP)
// Режим: Race-A1 — найди Опорный Крест на Ясне Суток быстрее соперника.
// Транспорт: BroadcastChannel API (две вкладки одного браузера).
// В продакшене будет WebRTC через PeerJS/Trystero, протокол идентичный.
// ═══════════════════════════════════════════════════════════════════

(function(){
  const { useState, useEffect, useRef } = React;

  // ─── TRANSPORT ─────────────────────────────────────────────────────
  // BroadcastChannel — две вкладки одного браузера обмениваются по имени канала.
  // В продакшене заменится на WebRTC peer без изменения API.
  class DuelTransport {
    constructor(roomCode){
      this.roomCode = roomCode;
      this.channel = new BroadcastChannel('yasna-duel-' + roomCode);
      this.listeners = new Set();
      this.channel.onmessage = (e) => this.listeners.forEach(fn => fn(e.data));
    }
    send(msg){ this.channel.postMessage(msg); }
    on(fn){ this.listeners.add(fn); return () => this.listeners.delete(fn); }
    close(){ this.channel.close(); }
  }

  // ─── LOBBY ────────────────────────────────────────────────────────
  function Lobby({ onConnected }){
    const [step, setStep] = useState('choose'); // choose | hosting | joining
    const [code, setCode] = useState('');
    const [status, setStatus] = useState('');
    const transportRef = useRef(null);

    const generateCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      return Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    };

    const create = () => {
      const newCode = generateCode();
      setCode(newCode);
      setStep('hosting');
      setStatus('Жду подключения соперника...');
      const t = new DuelTransport(newCode);
      transportRef.current = t;
      // Хост слушает 'guest-hello', отвечает 'host-ack', начинает игру
      const off = t.on(msg => {
        if(msg.t === 'guest-hello'){
          t.send({ t:'host-ack', startsAt: Date.now() + 2000 });
          setStatus('Соперник подключился!');
          setTimeout(() => { off(); onConnected(t, 'host'); }, 800);
        }
      });
    };

    const join = () => {
      const cleanCode = code.toUpperCase().trim();
      if(cleanCode.length !== 6) { setStatus('Код должен быть 6 символов'); return; }
      setStep('joining');
      setStatus('Подключаюсь к комнате ' + cleanCode + '...');
      const t = new DuelTransport(cleanCode);
      transportRef.current = t;
      // Гость отправляет 'guest-hello', ждёт 'host-ack'
      const off = t.on(msg => {
        if(msg.t === 'host-ack'){
          setStatus('Подключено!');
          setTimeout(() => { off(); onConnected(t, 'guest'); }, 800);
        }
      });
      t.send({ t:'guest-hello' });
      // Таймаут если хост не ответил
      setTimeout(() => {
        if(step === 'joining'){
          setStatus('Хост не отвечает. Проверьте код.');
        }
      }, 5000);
    };

    const cancel = () => {
      if(transportRef.current){ transportRef.current.close(); transportRef.current = null; }
      setStep('choose');
      setStatus('');
      setCode('');
    };

    const copyCode = () => {
      navigator.clipboard?.writeText(code);
      setStatus('Код скопирован! Перешли его другу.');
    };

    return (
      <div className="duel-lobby">
        <div className="duel-title">
          <span className="duel-emoji">⚔️</span>
          <h1>Дуэль · Гонка за Опорным Крестом</h1>
          <p>Найдите 4 опорные полки на Ясне Суток быстрее соперника.</p>
        </div>

        {step === 'choose' && (
          <div className="duel-choose">
            <button className="duel-btn duel-btn-primary" onClick={create}>
              <span style={{fontSize:18}}>＋</span> Создать комнату
            </button>
            <div className="duel-or">— или —</div>
            <div className="duel-join">
              <input
                placeholder="Код комнаты"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{textTransform:'uppercase'}}
              />
              <button className="duel-btn duel-btn-secondary" onClick={join} disabled={!code}>
                Войти
              </button>
            </div>
            <div className="duel-hint">
              💡 Для превью — открой эту страницу в двух вкладках одного браузера.
              В одной создай комнату, во второй введи код.
            </div>
          </div>
        )}

        {step === 'hosting' && (
          <div className="duel-hosting">
            <div className="duel-code">{code}</div>
            <button className="duel-btn duel-btn-primary" onClick={copyCode}>
              📋 Копировать код
            </button>
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

  // ─── RACE GAME ─────────────────────────────────────────────────────
  const CORRECT = [0, 3, 6, 9]; // Опорный Крест Суток

  function RaceA1({ transport, role, onFinish }){
    const Star = window.YasnaCore && window.YasnaCore.Star;
    const T = window.YasnaData && window.YasnaData.T;
    const yasna = T && T.find(t => t.id === 'sutok');

    const [mySolved, setMySolved] = useState([]);
    const [oppSolved, setOppSolved] = useState([]);
    const [oppCorrect, setOppCorrect] = useState(0);
    const [oppErrors, setOppErrors] = useState(0);
    const [countdown, setCountdown] = useState(3);
    const [started, setStarted] = useState(false);
    const [time, setTime] = useState(0);
    const startRef = useRef(0);
    const finishedRef = useRef(false);

    // Listen for opponent
    useEffect(() => {
      const off = transport.on(msg => {
        if(msg.t === 'progress'){
          setOppSolved(msg.solved || []);
          setOppCorrect((msg.solved||[]).filter(x => CORRECT.includes(x)).length);
          setOppErrors((msg.solved||[]).filter(x => !CORRECT.includes(x)).length);
        }
        if(msg.t === 'finish' && !finishedRef.current){
          finishedRef.current = true;
          // Соперник победил
          onFinish({ winner: role === 'host' ? 'guest' : 'host', oppTime: msg.time });
        }
      });
      return off;
    }, []);

    // Countdown 3 → 2 → 1 → GO
    useEffect(() => {
      if(countdown > 0){
        const tm = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(tm);
      }
      if(!started){
        setStarted(true);
        startRef.current = performance.now();
      }
    }, [countdown]);

    // Live timer
    useEffect(() => {
      if(!started) return;
      const tm = setInterval(() => {
        if(!finishedRef.current) setTime(performance.now() - startRef.current);
      }, 80);
      return () => clearInterval(tm);
    }, [started]);

    const togglePolka = (i) => {
      if(!started || finishedRef.current) return;
      const next = mySolved.includes(i)
        ? mySolved.filter(x => x !== i)
        : [...mySolved, i];
      setMySolved(next);
      transport.send({ t:'progress', solved: next });

      // Win check: ровно 4 полки и все правильные
      const correct = next.filter(x => CORRECT.includes(x));
      const errors = next.filter(x => !CORRECT.includes(x));
      if(correct.length === 4 && errors.length === 0 && !finishedRef.current){
        finishedRef.current = true;
        const elapsed = performance.now() - startRef.current;
        transport.send({ t:'finish', time: elapsed });
        setTimeout(() => onFinish({ winner: role, time: elapsed }), 200);
      }
    };

    const myCorrect = mySolved.filter(x => CORRECT.includes(x)).length;
    const myErrors = mySolved.filter(x => !CORRECT.includes(x)).length;

    if(!yasna || !Star) return <div>Загрузка...</div>;

    return (
      <div className="duel-race">
        <div className="duel-status-bar">
          <PlayerCard label="Вы" correct={myCorrect} errors={myErrors} accent="#d4a574" you/>
          <div className="duel-timer">
            {countdown > 0 ? (
              <div className="duel-countdown">{countdown}</div>
            ) : (
              <div>{(time/1000).toFixed(1)}<span style={{fontSize:14,opacity:.6}}>s</span></div>
            )}
          </div>
          <PlayerCard label="Соперник" correct={oppCorrect} errors={oppErrors} accent="#7c3aed"/>
        </div>

        <div className="duel-canvas">
          <div className="duel-task">
            Найди <strong>4 полки Опорного Креста</strong>: Ночь · Проявление Света · День · Проявление Тьмы
          </div>
          <div className="duel-star-wrap">
            <Star
              yy={yasna}
              sel={null}
              onSel={togglePolka}
              hl={mySolved.length ? mySolved : null}
              af={[]}
              showOpp={false}
              overlay={null}
              mob={false}
            />
          </div>
        </div>

        {countdown > 0 && (
          <div className="duel-overlay-countdown">
            <div className="duel-countdown-big">{countdown}</div>
            <div>Приготовьтесь...</div>
          </div>
        )}
      </div>
    );
  }

  function PlayerCard({ label, correct, errors, accent, you }){
    return (
      <div className="duel-player-card" style={{ borderColor: accent }}>
        <div className="duel-player-label" style={{ color: accent }}>
          {you && '◉ '}{label}
        </div>
        <div className="duel-player-stats">
          <span className="duel-stat-correct">✓ {correct}/4</span>
          {errors > 0 && <span className="duel-stat-errors">✗ {errors}</span>}
        </div>
      </div>
    );
  }

  // ─── RESULT SCREEN ─────────────────────────────────────────────────
  function ResultScreen({ result, role, onPlayAgain, onClose }){
    const won = result.winner === role;
    return (
      <div className="duel-result">
        <div className="duel-result-emoji">{won ? '🏆' : '😔'}</div>
        <h1 className="duel-result-title">{won ? 'Победа!' : 'Поражение'}</h1>
        {won && <div className="duel-result-time">Ваше время: {(result.time/1000).toFixed(1)}s</div>}
        {!won && result.oppTime && <div className="duel-result-time">Соперник справился за {(result.oppTime/1000).toFixed(1)}s</div>}
        <div className="duel-actions">
          <button className="duel-btn duel-btn-primary" onClick={onPlayAgain}>Сыграть ещё</button>
          <button className="duel-btn duel-btn-text" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    );
  }

  // ─── DUEL APP ──────────────────────────────────────────────────────
  function DuelApp({ onClose }){
    const [view, setView] = useState('lobby'); // lobby | race | result
    const [transport, setTransport] = useState(null);
    const [role, setRole] = useState(null);
    const [result, setResult] = useState(null);

    const handleConnected = (t, r) => {
      setTransport(t);
      setRole(r);
      setView('race');
    };

    const handleFinish = (res) => {
      setResult(res);
      setView('result');
    };

    const handlePlayAgain = () => {
      if(transport){ transport.close(); }
      setTransport(null);
      setRole(null);
      setResult(null);
      setView('lobby');
    };

    const handleClose = () => {
      if(transport){ transport.close(); }
      onClose();
    };

    return (
      <div className="duel-modal" onClick={(e) => { if(e.target === e.currentTarget) handleClose(); }}>
        <div className="duel-frame">
          <button className="duel-x" onClick={handleClose} aria-label="Закрыть">✕</button>
          {view === 'lobby' && <Lobby onConnected={handleConnected}/>}
          {view === 'race' && transport && <RaceA1 transport={transport} role={role} onFinish={handleFinish}/>}
          {view === 'result' && <ResultScreen result={result} role={role} onPlayAgain={handlePlayAgain} onClose={handleClose}/>}
        </div>
        <style>{`
          .duel-modal {
            position: fixed; inset: 0; z-index: 250;
            background: rgba(14,16,25,.86); backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            animation: duelFadeIn .3s ease;
          }
          @keyframes duelFadeIn { from { opacity:0; } to { opacity:1; } }
          .duel-frame {
            position: relative;
            width: 100%; max-width: 720px; max-height: 92vh;
            background: #fff;
            border-radius: 18px;
            box-shadow: 0 24px 80px rgba(0,0,0,.4);
            overflow: hidden;
            display: flex; flex-direction: column;
          }
          @media (max-width: 768px) {
            .duel-frame { max-width: 100%; max-height: 100dvh; border-radius: 0; }
          }
          .duel-x {
            position: absolute; top: 12px; right: 12px;
            width: 32px; height: 32px; border-radius: 16px;
            background: rgba(0,0,0,.05); border: none;
            color: #424245; cursor: pointer; font-size: 18px;
            display: flex; align-items: center; justify-content: center;
            z-index: 10;
          }
          .duel-x:hover { background: rgba(0,0,0,.1); }

          /* LOBBY */
          .duel-lobby {
            padding: 56px 32px 40px;
            display: flex; flex-direction: column; align-items: center; gap: 24px;
          }
          .duel-title { text-align: center; }
          .duel-emoji { font-size: 48px; display: block; margin-bottom: 8px; }
          .duel-title h1 { font-size: 24px; margin: 0 0 8px; color: #1d1d1f; font-weight: 700; }
          .duel-title p { font-size: 14px; color: #6e6e73; margin: 0; }
          .duel-choose { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; max-width: 360px; }
          .duel-or { font-size: 13px; color: #a1a1a6; }
          .duel-join { display: flex; gap: 8px; width: 100%; }
          .duel-join input {
            flex: 1; padding: 12px 14px; font-size: 16px;
            border: 1.5px solid #d2d2d7; border-radius: 10px;
            font-family: ui-monospace, monospace; letter-spacing: 4px;
            text-align: center; font-weight: 600;
            outline: none; transition: border-color .15s;
          }
          .duel-join input:focus { border-color: #d4a574; }
          .duel-btn {
            padding: 12px 24px; font-size: 14px; font-weight: 600;
            border-radius: 10px; cursor: pointer; border: none;
            display: inline-flex; align-items: center; gap: 6px;
            transition: transform .1s, background .15s;
          }
          .duel-btn:active { transform: scale(.97); }
          .duel-btn:disabled { opacity: .4; cursor: not-allowed; }
          .duel-btn-primary { background: #d4a574; color: #1d1d1f; }
          .duel-btn-primary:hover { background: #c89764; }
          .duel-btn-secondary { background: #1d1d1f; color: #fff; }
          .duel-btn-secondary:hover { background: #2d2d2f; }
          .duel-btn-text { background: transparent; color: #6e6e73; padding: 8px 14px; }
          .duel-hint { font-size: 12px; color: #6e6e73; padding: 12px 16px; background: #f5f5f7; border-radius: 10px; line-height: 1.5; max-width: 360px; }
          .duel-code {
            font-size: 56px; font-weight: 700; letter-spacing: 8px;
            font-family: ui-monospace, monospace;
            background: linear-gradient(180deg, #f5f5f7 0%, #e8e8ec 100%);
            padding: 24px 32px; border-radius: 16px; color: #1d1d1f;
            border: 2px dashed #d4a574;
          }
          .duel-hosting { display: flex; flex-direction: column; align-items: center; gap: 16px; }
          .duel-status { font-size: 14px; color: #6e6e73; min-height: 20px; text-align: center; }
          .duel-status-large { font-size: 18px; color: #1d1d1f; font-weight: 500; }

          /* RACE */
          .duel-race { display: flex; flex-direction: column; flex: 1; padding: 24px; gap: 16px; position: relative; }
          .duel-status-bar { display: flex; align-items: center; gap: 16px; justify-content: space-between; }
          .duel-player-card {
            flex: 1; padding: 12px 14px; border-radius: 12px;
            border: 2px solid; background: #fff;
            display: flex; flex-direction: column; gap: 4px;
          }
          .duel-player-label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
          .duel-player-stats { display: flex; gap: 12px; align-items: center; font-size: 16px; font-weight: 600; }
          .duel-stat-correct { color: #16a34a; }
          .duel-stat-errors { color: #dc2626; }
          .duel-timer {
            font-size: 28px; font-weight: 700;
            font-family: ui-monospace, monospace;
            color: #1d1d1f; min-width: 80px; text-align: center;
          }
          .duel-countdown { font-size: 32px; color: #d4a574; }
          .duel-canvas { flex: 1; display: flex; flex-direction: column; gap: 12px; min-height: 360px; }
          .duel-task { text-align: center; font-size: 14px; color: #424245; padding: 8px 16px; background: #fef8e7; border-radius: 8px; border-left: 3px solid #d4a574; }
          .duel-star-wrap { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 320px; }
          .duel-star-wrap > div { width: 100%; height: 100%; max-height: 50vh; }
          .duel-overlay-countdown {
            position: absolute; inset: 0;
            background: rgba(255,255,255,.92);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 5;
            color: #424245;
          }
          .duel-countdown-big {
            font-size: 144px; font-weight: 700; color: #d4a574;
            font-family: ui-monospace, monospace;
            line-height: 1;
            animation: duelPulse .9s ease-out;
          }
          @keyframes duelPulse {
            0% { transform: scale(.5); opacity: 0; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }

          /* RESULT */
          .duel-result {
            padding: 56px 32px 40px;
            display: flex; flex-direction: column; align-items: center; gap: 16px;
            text-align: center;
          }
          .duel-result-emoji { font-size: 96px; }
          .duel-result-title { font-size: 32px; margin: 0; color: #1d1d1f; font-weight: 700; }
          .duel-result-time { font-size: 16px; color: #6e6e73; }
          .duel-actions { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; justify-content: center; }
        `}</style>
      </div>
    );
  }

  window.DuelApp = DuelApp;
})();
