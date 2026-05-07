// ═══════════════════════════════════════════════════════════════════
// DUEL GAME — Quiz «Антиподы»
// Mode: 'score' — оба отвечают на 5 вопросов, потом сравниваем счёт.
// При равном счёте — побеждает кто быстрее справился (меньшее время).
// ═══════════════════════════════════════════════════════════════════

(function(){
  if(!window.YasnaDuels){ console.warn('[duel-game-quiz] YasnaDuels registry missing'); return; }
  const { useState, useEffect, useRef, useMemo } = React;

  const TOTAL_Q = 5;
  // Стабильный seed-RNG (LCG) — оба клиента генерируют одинаковые вопросы из одного seed
  function seededRandom(seed){
    let s = seed | 0;
    return () => {
      s = (s * 1664525 + 1013904223) | 0;
      return ((s >>> 0) % 1000) / 1000;
    };
  }
  function generateQuestions(seed){
    const rng = seededRandom(seed);
    const used = new Set();
    const qs = [];
    while(qs.length < TOTAL_Q){
      const i = Math.floor(rng() * 12);
      if(used.has(i)) continue;
      used.add(i);
      qs.push(i);
    }
    return qs;
  }
  const opp = (i) => (i + 6) % 12;

  function PlayerCard({ label, correct, total, accent, you, doneCount }){
    return (
      <div className="duel-player-card" style={{ borderColor: accent }}>
        <div className="duel-player-label" style={{ color: accent }}>
          {you && '◉ '}{label}
        </div>
        <div className="duel-player-stats">
          <span className="duel-stat-correct">✓ {correct}/{total}</span>
          <span style={{color:'#6e6e73',fontSize:13}}>{doneCount}/{TOTAL_Q}</span>
        </div>
      </div>
    );
  }

  function QuizAntipodes({ transport, role, yasnaId, matchId, isPlaying, startTime, onSubmitResult, waitingForOpponent }){
    const Star = window.YasnaCore && window.YasnaCore.Star;
    const Tdata = window.YasnaData && window.YasnaData.T;
    const yasna = Tdata && (Tdata.find(t => t.id === yasnaId) || Tdata.find(t => t.n === yasnaId));

    // Хост генерирует seed и шлёт гостю; гость ждёт seed
    const [seed, setSeed] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [qIdx, setQIdx] = useState(0);
    const [myAnswers, setMyAnswers] = useState([]); // [{ guess, correct, time }]
    const [oppDone, setOppDone] = useState(0);
    const [feedback, setFeedback] = useState(null); // { correct, expected, guess }
    const submittedRef = useRef(false);

    // Инициализация: host генерирует, guest ждёт
    useEffect(() => {
      if(!isPlaying) return;
      if(role === 'host' && !seed){
        const newSeed = (performance.now() * 1000) | 0;
        const qs = generateQuestions(newSeed);
        setSeed(newSeed);
        setQuestions(qs);
        transport.send({ t:'quiz-init', matchId, seed: newSeed, questions: qs });
      }
    }, [isPlaying, role, matchId, transport, seed]);

    // Listener на прогресс соперника + получение seed (для guest)
    useEffect(() => {
      const off = transport.on(msg => {
        if(msg.matchId && msg.matchId !== matchId) return;
        if(msg.t === 'quiz-init' && role === 'guest'){
          setSeed(msg.seed);
          setQuestions(msg.questions || []);
        }
        if(msg.t === 'quiz-progress'){
          setOppDone(msg.done || 0);
        }
      });
      return off;
    }, [matchId, role, transport]);

    // Клик по полке — записать ответ
    const onClickPolka = (i) => {
      if(!isPlaying || submittedRef.current) return;
      if(qIdx >= questions.length) return;
      if(feedback) return; // ждём окончания feedback
      const expected = opp(questions[qIdx]);
      const correct = i === expected;
      const time = performance.now() - startTime;
      const ans = { guess: i, correct, time, expected };
      const nextAnswers = [...myAnswers, ans];
      setMyAnswers(nextAnswers);
      setFeedback({ correct, expected, guess: i });
      transport.send({ t:'quiz-progress', matchId, done: nextAnswers.length });

      // Через 1.2с убираем feedback и переходим к следующему вопросу или финишируем
      setTimeout(() => {
        setFeedback(null);
        if(nextAnswers.length >= TOTAL_Q){
          // Финиш — submitResult
          if(submittedRef.current) return;
          submittedRef.current = true;
          const score = nextAnswers.filter(a => a.correct).length;
          onSubmitResult({ score, maxScore: TOTAL_Q, payload: { answers: nextAnswers } });
        } else {
          setQIdx(qIdx + 1);
        }
      }, 1200);
    };

    if(!yasna || !Star) return <div className="duel-result"><h1>Загрузка Ясны…</h1></div>;
    if(!questions.length){
      return (
        <div className="duel-result">
          <h1 style={{fontSize:18,color:'#6e6e73'}}>Загрузка вопросов…</h1>
        </div>
      );
    }

    const myCorrect = myAnswers.filter(a => a.correct).length;
    const oppCorrect = '?'; // не раскрываем сопернику свой реальный счёт до финиша
    const currentQ = questions[qIdx];
    const polkaName = yasna.p?.[currentQ] || ('Полка ' + currentQ);

    if(waitingForOpponent){
      return (
        <div className="duel-result">
          <div style={{fontSize:48,marginBottom:16}}>⏳</div>
          <h1 className="duel-result-title">Ваши ответы засчитаны</h1>
          <div className="duel-result-time">Ваш счёт: <strong>{myCorrect} из {TOTAL_Q}</strong></div>
          <div className="duel-result-time" style={{color:'#6e6e73'}}>Ждём пока соперник закончит ({oppDone}/{TOTAL_Q})…</div>
        </div>
      );
    }

    return (
      <>
        <div className="duel-status-bar">
          <PlayerCard label="Вы" correct={myCorrect} total={TOTAL_Q} accent="#d4a574" you doneCount={myAnswers.length}/>
          <div className="duel-timer" style={{fontSize:18}}>
            <div style={{fontSize:11,color:'#6e6e73',letterSpacing:1,fontWeight:600,textTransform:'uppercase'}}>Вопрос</div>
            <div>{Math.min(qIdx+1, TOTAL_Q)} / {TOTAL_Q}</div>
          </div>
          <PlayerCard label="Соперник" correct={oppCorrect} total={TOTAL_Q} accent="#7c3aed" doneCount={oppDone}/>
        </div>

        <div className="duel-task" style={{textAlign:'center'}}>
          🎯 <strong>Назови антипод полки «{polkaName}»</strong> ({currentQ}). Кликни на её противоположность.
        </div>

        <div className="duel-star-wrap">
          <Star
            yy={yasna}
            sel={feedback ? feedback.guess : null}
            onSel={onClickPolka}
            hl={feedback ? [feedback.expected, feedback.guess].filter((v, i, a) => a.indexOf(v) === i) : [currentQ]}
            af={[]}
            showOpp={false}
            overlay={null}
            mob={false}
          />
        </div>

        {feedback && (
          <div className="duel-quiz-feedback" style={{
            textAlign:'center',
            padding:'10px 16px',
            borderRadius:8,
            background: feedback.correct ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)',
            border: feedback.correct ? '1px solid rgba(22,163,74,.3)' : '1px solid rgba(220,38,38,.3)',
            color: feedback.correct ? '#16a34a' : '#dc2626',
            fontSize:14, fontWeight:600,
          }}>
            {feedback.correct ? '✓ Правильно!' : `✗ Антипод полки ${currentQ} — это ${feedback.expected}`}
          </div>
        )}
      </>
    );
  }

  window.YasnaDuels.register({
    id: 'quiz-antipodes',
    category: 'quiz',
    title: 'Антиподы',
    subtitle: '5 вопросов на знание противоположных полок',
    description: 'Дано 5 случайных полок. На каждую назови её антипод (полку напротив через центр круга). Очко за правильный ответ. При равенстве — кто быстрее.',
    yasnaIds: ['суток', 'года', 'фаз_жизни'],
    defaultYasna: 'суток',
    difficulty: 2,
    estimatedSec: 60,
    mode: 'score',
    Component: QuizAntipodes,
  });
})();
