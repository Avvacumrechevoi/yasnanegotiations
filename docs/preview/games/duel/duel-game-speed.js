// ═══════════════════════════════════════════════════════════════════
// DUEL GAME — Speed «Молния»
// Mode: 'score' — 30 секунд, оба отвечают на ✓/✗ для случайных полок.
// «Это полка Опорного Креста?» — да/нет.
// Очко за правильный, штраф −1 за неправильный.
// ═══════════════════════════════════════════════════════════════════

(function(){
  if(!window.YasnaDuels){ console.warn('[duel-game-speed] registry missing'); return; }
  const { useState, useEffect, useRef } = React;

  const DURATION_MS = 30000; // 30 секунд
  const TARGET_SET = new Set([0, 3, 6, 9]); // Опорный Крест

  // Seeded RNG для синхронной последовательности у обоих игроков
  function seededRandom(seed){
    let s = seed | 0;
    return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 1000) / 1000; };
  }
  function generateSequence(seed, length){
    const rng = seededRandom(seed);
    return Array.from({ length }, () => Math.floor(rng() * 12));
  }

  function SpeedLightning({ transport, role, yasnaId, matchId, isPlaying, startTime, onSubmitResult, waitingForOpponent }){
    const Tdata = window.YasnaData && window.YasnaData.T;
    const yasna = Tdata && (Tdata.find(t => t.id === yasnaId) || Tdata.find(t => t.n === yasnaId));

    const [seed, setSeed] = useState(null);
    const [sequence, setSequence] = useState([]); // массив полок
    const [idx, setIdx] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [wrong, setWrong] = useState(0);
    const [timeLeft, setTimeLeft] = useState(DURATION_MS);
    const [oppCorrect, setOppCorrect] = useState(0);
    const [feedback, setFeedback] = useState(null); // 'right' | 'wrong'
    const submittedRef = useRef(false);
    // Refs на correct/wrong — чтобы таймер не пересоздавался при каждом ответе.
    // Без этого setInterval(100ms) пересоздаётся на каждое изменение score → лаги.
    const correctRef = useRef(0);
    const wrongRef = useRef(0);

    // Init
    useEffect(() => {
      if(!isPlaying) return;
      if(role === 'host' && !seed){
        const newSeed = (performance.now() * 1000) | 0;
        const seq = generateSequence(newSeed, 200); // запас на быстрые игроки
        setSeed(newSeed);
        setSequence(seq);
        transport.send({ t:'speed-init', matchId, seed: newSeed });
      }
    }, [isPlaying, role, seed]);

    // Listener
    useEffect(() => {
      const off = transport.on(msg => {
        if(msg.matchId && msg.matchId !== matchId) return;
        if(msg.t === 'speed-init' && role === 'guest'){
          setSeed(msg.seed);
          setSequence(generateSequence(msg.seed, 200));
        }
        if(msg.t === 'speed-progress'){
          setOppCorrect(msg.correct || 0);
        }
      });
      return off;
    }, [matchId, role, transport]);

    // Countdown timer — НЕ зависит от correct/wrong (читаем из refs),
    // иначе setInterval пересоздаётся на каждый ответ.
    useEffect(() => {
      if(!isPlaying || !seed || submittedRef.current) return;
      const tm = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const left = Math.max(0, DURATION_MS - elapsed);
        setTimeLeft(left);
        if(left <= 0 && !submittedRef.current){
          submittedRef.current = true;
          onSubmitResult({
            score: Math.max(0, correctRef.current - Math.floor(wrongRef.current / 2)),
            maxScore: 30,
            payload: { correct: correctRef.current, wrong: wrongRef.current },
          });
        }
      }, 100);
      return () => clearInterval(tm);
    }, [isPlaying, seed, startTime]);

    const answer = (yes) => {
      if(!isPlaying || submittedRef.current || feedback) return;
      if(idx >= sequence.length) return;
      const polka = sequence[idx];
      const isTarget = TARGET_SET.has(polka);
      const isCorrect = (yes === isTarget);
      const newCorrect = correct + (isCorrect ? 1 : 0);
      const newWrong = wrong + (isCorrect ? 0 : 1);
      correctRef.current = newCorrect;
      wrongRef.current = newWrong;
      setCorrect(newCorrect);
      setWrong(newWrong);
      setFeedback(isCorrect ? 'right' : 'wrong');
      transport.send({ t:'speed-progress', matchId, correct: newCorrect });

      // Через 250ms убираем feedback и идём дальше
      setTimeout(() => {
        setFeedback(null);
        setIdx(i => i + 1);
      }, 250);
    };

    if(!yasna) return <div className="duel-result"><h1>Шаблон Ясны не найден</h1></div>;
    if(!seed) return <div className="duel-result"><h1 style={{fontSize:18,color:'#6e6e73'}}>Загрузка вопросов…</h1></div>;

    const polka = idx < sequence.length ? sequence[idx] : null;
    const polkaName = polka != null ? (yasna.p?.[polka] || 'Полка ' + polka) : '';

    if(waitingForOpponent){
      return (
        <div className="duel-result">
          <div style={{fontSize:48,marginBottom:16}}>⏳</div>
          <h1 className="duel-result-title">Время вышло</h1>
          <div className="duel-result-time">Правильно: <strong>{correct}</strong>, неправильно: {wrong}</div>
          <div className="duel-result-time" style={{color:'#6e6e73'}}>Ждём пока соперник доиграет…</div>
        </div>
      );
    }

    const secondsLeft = Math.ceil(timeLeft / 1000);
    const tlPct = (timeLeft / DURATION_MS) * 100;

    return (
      <>
        <div className="duel-status-bar">
          <div className="duel-player-card" style={{borderColor:'#d4a574'}}>
            <div className="duel-player-label" style={{color:'#d4a574'}}>◉ Вы</div>
            <div className="duel-player-stats">
              <span className="duel-stat-correct">✓ {correct}</span>
              {wrong > 0 && <span className="duel-stat-errors">✗ {wrong}</span>}
              <span style={{fontSize:11,color:'#86868b',marginLeft:6}} title="Очки = верных − ошибки/2">
                = {Math.max(0, correct - Math.floor(wrong / 2))}
              </span>
            </div>
          </div>
          <div className="duel-timer" style={{minWidth:100}}>
            <div style={{fontSize:11,color:'#6e6e73',letterSpacing:1,fontWeight:600,textTransform:'uppercase'}}>Осталось</div>
            <div style={{color: secondsLeft <= 5 ? '#dc2626' : '#1d1d1f'}}>{secondsLeft}<span style={{fontSize:14,opacity:.6}}>s</span></div>
          </div>
          <div className="duel-player-card" style={{borderColor:'#7c3aed'}}>
            <div className="duel-player-label" style={{color:'#7c3aed'}}>Соперник</div>
            <div className="duel-player-stats">
              <span className="duel-stat-correct">✓ {oppCorrect}</span>
            </div>
          </div>
        </div>

        {/* Прогресс-бар времени */}
        <div style={{height:4,background:'#e5e5ea',borderRadius:2,overflow:'hidden'}}>
          <div style={{height:'100%',width:tlPct+'%',background: secondsLeft <= 5 ? '#dc2626' : '#d4a574',transition:'width .1s linear'}}/>
        </div>

        <div className="duel-task" style={{textAlign:'center',fontSize:15}}>
          🎯 Полка <strong>«{polkaName}»</strong> ({polka}) — это <strong>Опорный Крест</strong>?
        </div>

        <div style={{display:'flex',gap:14,justifyContent:'center',padding:'24px 0'}}>
          <button
            className="duel-btn duel-btn-primary"
            onClick={() => answer(true)}
            disabled={!!feedback}
            style={{
              minWidth:120,minHeight:80,fontSize:32,
              background: feedback === 'right' ? '#16a34a' : '#d4a574',
              color: feedback === 'right' ? '#fff' : '#1d1d1f',
              opacity: feedback ? 1 : (!!feedback ? .5 : 1),
            }}
          >✓ Да</button>
          <button
            className="duel-btn duel-btn-secondary"
            onClick={() => answer(false)}
            disabled={!!feedback}
            style={{
              minWidth:120,minHeight:80,fontSize:32,
              background: feedback === 'wrong' ? '#dc2626' : '#1d1d1f',
              color: '#fff',
              opacity: feedback ? 1 : 1,
            }}
          >✗ Нет</button>
        </div>

        <div style={{textAlign:'center',fontSize:11,color:'#6e6e73'}}>
          Опорный Крест = полки 0, 3, 6, 9. <span style={{color:'#a1a1a6'}}>Штраф −½ балла за каждую ошибку.</span>
        </div>
      </>
    );
  }

  window.YasnaDuels.register({
    id: 'speed-cross-yesno',
    category: 'speed',
    title: 'Молния',
    subtitle: '30 секунд — ✓/✗ за каждую полку',
    description: '30 секунд. Случайная полка → отвечаешь ✓ или ✗ в ответ на «это Опорный Крест?». Очко за правильный, минус за ошибку. Кто наберёт больше — тот победил.',
    yasnaIds: ['суток', 'года', 'фаз_жизни'],
    defaultYasna: 'суток',
    difficulty: 1,
    estimatedSec: 30,
    mode: 'score',
    Component: SpeedLightning,
  });
})();
