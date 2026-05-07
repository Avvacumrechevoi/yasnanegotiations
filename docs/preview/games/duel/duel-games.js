// ═══════════════════════════════════════════════════════════════════
// DUEL GAMES — конкретные режимы дуэлей.
// Регистрируются через window.YasnaDuels.register({...}) — см. duel-core.js.
// Каждый режим = config + React-компонент.
// ═══════════════════════════════════════════════════════════════════

(function(){
  if(!window.YasnaDuels){ console.warn('[duel-games] YasnaDuels registry not loaded'); return; }
  const { useState, useEffect, useRef } = React;

  // ─── HELPER: Player card (общий для всех Race-режимов) ────────────
  function PlayerCard({ label, correct, errors, total, accent, you }){
    return (
      <div className="duel-player-card" style={{ borderColor: accent }}>
        <div className="duel-player-label" style={{ color: accent }}>
          {you && '◉ '}{label}
        </div>
        <div className="duel-player-stats">
          <span className="duel-stat-correct">✓ {correct}/{total}</span>
          {errors > 0 && <span className="duel-stat-errors">✗ {errors}</span>}
        </div>
      </div>
    );
  }

  // ─── GENERIC RACE GAME ─────────────────────────────────────────────
  // Параметризуется через config: { target:[i...], hint:string, total:number }.
  // Подходит для любой Race-задачи — найди X полок Y на Ясне Z.
  function makeRaceGame({ target, hint }){
    const TOTAL = target.length;
    const TARGET_SET = new Set(target);

    return function RaceGame({ transport, role, yasnaId, matchId, isPlaying, startTime, onSubmitFinish, myProfile, oppProfile }){
      const Star = window.YasnaCore && window.YasnaCore.Star;
      const Tdata = window.YasnaData && window.YasnaData.T;
      const yasna = Tdata && (Tdata.find(t => t.id === yasnaId) || Tdata.find(t => t.n === yasnaId));

      const [mySolved, setMySolved] = useState([]);
      const [oppSolved, setOppSolved] = useState([]);
      const [time, setTime] = useState(0);
      const finishedRef = useRef(false);

      // Слушаем прогресс соперника
      useEffect(() => {
        const off = transport.on(msg => {
          if(msg.matchId && msg.matchId !== matchId) return;
          if(msg.t === 'progress'){
            setOppSolved(msg.solved || []);
          }
        });
        return off;
      }, [matchId, transport]);

      // Live timer (после старта)
      useEffect(() => {
        if(!isPlaying) return;
        const tm = setInterval(() => {
          if(!finishedRef.current) setTime(performance.now() - startTime);
        }, 80);
        return () => clearInterval(tm);
      }, [isPlaying, startTime]);

      const togglePolka = (i) => {
        if(!isPlaying || finishedRef.current) return;
        const next = mySolved.includes(i) ? mySolved.filter(x => x !== i) : [...mySolved, i];
        setMySolved(next);
        transport.send({ t:'progress', matchId, solved: next });

        const correct = next.filter(x => TARGET_SET.has(x));
        const errors = next.filter(x => !TARGET_SET.has(x));
        if(correct.length === TOTAL && errors.length === 0){
          finishedRef.current = true;
          onSubmitFinish({ solved: next });
        }
      };

      const myCorrect = mySolved.filter(x => TARGET_SET.has(x)).length;
      const myErrors = mySolved.filter(x => !TARGET_SET.has(x)).length;
      const oppCorrect = oppSolved.filter(x => TARGET_SET.has(x)).length;
      const oppErrors = oppSolved.filter(x => !TARGET_SET.has(x)).length;

      if(!yasna){
        return <div className="duel-result"><h1>Шаблон Ясны не найден: {yasnaId}</h1></div>;
      }
      if(!Star){
        return <div className="duel-result"><h1>Star-компонент ещё не загрузился</h1></div>;
      }

      return (
        <>
          <div className="duel-status-bar">
            <PlayerCard label={myProfile?.avatar+" "+myProfile?.nickname || "Вы"} correct={myCorrect} errors={myErrors} total={TOTAL} accent="#d4a574" you/>
            <div className="duel-timer">{(time/1000).toFixed(1)}<span style={{fontSize:14,opacity:.6}}>s</span></div>
            <PlayerCard label={oppProfile?.avatar+" "+oppProfile?.nickname || "Соперник"} correct={oppCorrect} errors={oppErrors} total={TOTAL} accent="#7c3aed"/>
          </div>
          <div className="duel-task">{hint}</div>
          <div className="duel-star-wrap">
            <Star yy={yasna} sel={null} onSel={togglePolka} hl={mySolved.length ? mySolved : null} af={[]} showOpp={false} overlay={null} mob={false}/>
          </div>
        </>
      );
    };
  }

  // ─── REGISTRATIONS ─────────────────────────────────────────────────
  window.YasnaDuels.register({
    id: 'race-cross',
    category: 'race',
    title: 'Опорный Крест',
    subtitle: 'Найди 4 опорные полки быстрее',
    description: 'Кликни 4 полки Опорного Креста (0/3/6/9). Без ошибок и быстрее соперника.',
    yasnaIds: ['суток', 'года', 'фаз_жизни'],
    defaultYasna: 'суток',
    difficulty: 1,
    estimatedSec: 30,
    Component: makeRaceGame({
      target: [0, 3, 6, 9],
      hint: '🎯 Найди 4 полки Опорного Креста: позиции 0/3/6/9',
    }),
  });

  window.YasnaDuels.register({
    id: 'race-mngmt',
    category: 'race',
    title: 'Крест Управления',
    subtitle: 'Найди 4 полки Управления',
    description: 'Кликни 4 полки Креста Управления (1/4/7/10) — те, что СЛЕДУЮТ за опорными.',
    yasnaIds: ['суток', 'года', 'фаз_жизни'],
    defaultYasna: 'суток',
    difficulty: 2,
    estimatedSec: 35,
    Component: makeRaceGame({
      target: [1, 4, 7, 10],
      hint: '⚙️ Найди 4 полки Креста Управления: позиции 1/4/7/10',
    }),
  });

  window.YasnaDuels.register({
    id: 'race-faith',
    category: 'race',
    title: 'Крест Веры',
    subtitle: 'Найди 4 полки Веры',
    description: 'Кликни 4 полки Креста Веры (2/5/8/11) — те, что ПРЕДШЕСТВУЮТ опорным.',
    yasnaIds: ['суток', 'года', 'фаз_жизни'],
    defaultYasna: 'суток',
    difficulty: 2,
    estimatedSec: 35,
    Component: makeRaceGame({
      target: [2, 5, 8, 11],
      hint: '🕊 Найди 4 полки Креста Веры: позиции 2/5/8/11',
    }),
  });

  // ─── PLACEHOLDER для будущих режимов ──────────────────────────────
  // Quiz / Mirror / Bidding регистрируются здесь же — добавь новые
  // window.YasnaDuels.register({...}) когда будет готов компонент.
})();
