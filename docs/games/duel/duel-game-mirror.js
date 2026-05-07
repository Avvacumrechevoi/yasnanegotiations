// ═══════════════════════════════════════════════════════════════════
// DUEL GAME — Mirror «Заполни Ясну»
// Mode: 'score' — оба заполняют Ясну параллельно, сравнение по score+time.
// 12 перемешанных меток в пуле — расставь по правильным позициям.
// ═══════════════════════════════════════════════════════════════════

(function(){
  if(!window.YasnaDuels){ console.warn('[duel-game-mirror] registry missing'); return; }
  const { useState, useEffect, useRef, useMemo } = React;

  // Стабильный shuffle через seed (оба клиента получают одинаковую перестановку)
  function seededShuffle(arr, seed){
    let s = seed | 0;
    const rng = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 1000) / 1000; };
    const out = arr.slice();
    for(let i = out.length - 1; i > 0; i--){
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function MirrorFillYasna({ transport, role, yasnaId, matchId, isPlaying, startTime, onSubmitResult, waitingForOpponent }){
    const Tdata = window.YasnaData && window.YasnaData.T;
    const yasna = Tdata && (Tdata.find(t => t.id === yasnaId) || Tdata.find(t => t.n === yasnaId));
    const correctLabels = yasna ? yasna.p.slice(0, 12) : [];

    // Хост генерирует seed для shuffle, гость синхронизируется
    const [seed, setSeed] = useState(null);
    const [pool, setPool] = useState([]); // labels available [{ label, originalIdx }]
    const [placement, setPlacement] = useState(Array(12).fill(null)); // labels placed at index i
    const [selectedLabel, setSelectedLabel] = useState(null); // string or null
    const [oppPlaced, setOppPlaced] = useState(0); // how many opp has placed
    const submittedRef = useRef(false);

    // Init
    useEffect(() => {
      if(!isPlaying) return;
      if(role === 'host' && !seed && correctLabels.length === 12){
        const newSeed = (performance.now() * 1000) | 0;
        const labels = correctLabels.map((l, i) => ({ label: l, originalIdx: i }));
        const shuffled = seededShuffle(labels, newSeed);
        setSeed(newSeed);
        setPool(shuffled);
        transport.send({ t:'mirror-init', matchId, seed: newSeed, labels: correctLabels });
      }
    }, [isPlaying, role, seed, correctLabels.length]);

    // Listener
    useEffect(() => {
      const off = transport.on(msg => {
        if(msg.matchId && msg.matchId !== matchId) return;
        if(msg.t === 'mirror-init' && role === 'guest'){
          const labels = (msg.labels || []).map((l, i) => ({ label: l, originalIdx: i }));
          const shuffled = seededShuffle(labels, msg.seed);
          setSeed(msg.seed);
          setPool(shuffled);
        }
        if(msg.t === 'mirror-progress'){
          setOppPlaced(msg.placed || 0);
        }
      });
      return off;
    }, [matchId, role, transport]);

    const placedCount = placement.filter(x => x).length;

    // Auto-submit when all 12 placed
    useEffect(() => {
      if(!isPlaying || submittedRef.current) return;
      if(placedCount !== 12) return;
      submittedRef.current = true;
      const correct = placement.filter((label, i) => label === correctLabels[i]).length;
      onSubmitResult({ score: correct, maxScore: 12, payload: { placement } });
    }, [placedCount, isPlaying]);

    // Handlers
    const onPickPool = (label) => {
      if(!isPlaying || submittedRef.current) return;
      setSelectedLabel(label === selectedLabel ? null : label);
    };

    const onClickPosition = (i) => {
      if(!isPlaying || submittedRef.current) return;
      if(placement[i]){
        // Remove placed label back to pool
        const removed = placement[i];
        const newPlacement = placement.slice();
        newPlacement[i] = null;
        setPlacement(newPlacement);
        setPool([...pool, { label: removed, originalIdx: correctLabels.indexOf(removed) }]);
        return;
      }
      if(!selectedLabel) return;
      // Place selectedLabel at position i
      const newPlacement = placement.slice();
      newPlacement[i] = selectedLabel;
      setPlacement(newPlacement);
      const newPool = pool.filter(p => p.label !== selectedLabel);
      setPool(newPool);
      setSelectedLabel(null);
      transport.send({ t:'mirror-progress', matchId, placed: newPlacement.filter(x => x).length });
    };

    const earlySubmit = () => {
      if(!isPlaying || submittedRef.current) return;
      submittedRef.current = true;
      const correct = placement.filter((label, i) => label === correctLabels[i]).length;
      onSubmitResult({ score: correct, maxScore: 12, payload: { placement } });
    };

    if(!yasna) return <div className="duel-result"><h1>Шаблон Ясны не найден</h1></div>;
    if(!seed && role === 'guest') return <div className="duel-result"><h1 style={{fontSize:18,color:'#6e6e73'}}>Загрузка вопросов…</h1></div>;

    // Render: positions arranged in clock layout
    const cx = 200, cy = 200, R = 140;
    const angDeg = (i) => 270 - i * 30;
    const rad = (d) => d * Math.PI / 180;
    const xy = (i, r) => ({ x: cx + r * Math.cos(rad(angDeg(i))), y: cy - r * Math.sin(rad(angDeg(i))) });

    const myCorrect = placement.filter((l, i) => l === correctLabels[i]).length;

    if(waitingForOpponent){
      return (
        <div className="duel-result">
          <div style={{fontSize:48,marginBottom:16}}>⏳</div>
          <h1 className="duel-result-title">Ваш расклад принят</h1>
          <div className="duel-result-time">Правильно: <strong>{myCorrect} из 12</strong></div>
          <div className="duel-result-time" style={{color:'#6e6e73'}}>Ждём пока соперник доиграет ({oppPlaced}/12)…</div>
        </div>
      );
    }

    return (
      <>
        <div className="duel-status-bar">
          <div className="duel-player-card" style={{borderColor:'#d4a574'}}>
            <div className="duel-player-label" style={{color:'#d4a574'}}>◉ Вы</div>
            <div className="duel-player-stats">
              <span style={{color:'#1d1d1f'}}>{placedCount}/12</span>
              {selectedLabel && <span style={{fontSize:11,color:'#6e6e73',fontWeight:500}}>выбрано: {selectedLabel}</span>}
            </div>
          </div>
          <div className="duel-player-card" style={{borderColor:'#7c3aed'}}>
            <div className="duel-player-label" style={{color:'#7c3aed'}}>Соперник</div>
            <div className="duel-player-stats">
              <span style={{color:'#1d1d1f'}}>{oppPlaced}/12</span>
            </div>
          </div>
        </div>

        <div className="duel-task" style={{textAlign:'center'}}>
          🧩 <strong>Расставь 12 меток</strong> Ясны «{yasna.n}» по своим позициям. Кликни метку из пула, потом кликни нужную позицию.
        </div>

        <div className="duel-mirror-canvas">
          <svg viewBox="0 0 400 400" style={{width:'100%',maxWidth:400,maxHeight:'40vh'}}>
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#d2d2d7" strokeWidth="1.5"/>
            {Array.from({length:12}, (_, i) => {
              const p = xy(i, R);
              const placed = placement[i];
              const isCorrectPlaced = placed && placed === correctLabels[i];
              const fill = placed ? (isCorrectPlaced ? '#d4a574' : '#9ca3af') : '#fff';
              const stroke = placed ? (isCorrectPlaced ? '#a87a4a' : '#6b7280') : '#d2d2d7';
              return (
                <g key={i} onClick={() => onClickPosition(i)} style={{cursor:'pointer'}}>
                  <circle cx={p.x} cy={p.y} r={20} fill={fill} stroke={stroke} strokeWidth="2"/>
                  <text x={p.x} y={p.y+5} textAnchor="middle" fontSize="14" fontWeight="700" fill={placed ? '#fff' : '#1d1d1f'}>{i}</text>
                  {placed && (
                    <text x={p.x} y={p.y + 36} textAnchor="middle" fontSize="9" fill="#1d1d1f" style={{fontWeight:600,pointerEvents:'none'}}>
                      {placed.length > 12 ? placed.slice(0, 11) + '…' : placed}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="duel-mirror-pool">
          <div style={{fontSize:11,letterSpacing:1,textTransform:'uppercase',color:'#6e6e73',fontWeight:700,marginBottom:6}}>Пул меток ({pool.length})</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {pool.map(({ label, originalIdx }, k) => (
              <button
                key={`${originalIdx}-${k}`}
                onClick={() => onPickPool(label)}
                className={'duel-pool-chip' + (selectedLabel === label ? ' duel-pool-chip-selected' : '')}
                style={{
                  padding: '6px 11px', fontSize: 12, borderRadius: 999,
                  border: '1.5px solid ' + (selectedLabel === label ? '#d4a574' : '#e5e5ea'),
                  background: selectedLabel === label ? 'rgba(212,165,116,.15)' : '#fff',
                  cursor: 'pointer', fontWeight: 500,
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        {placedCount > 0 && placedCount < 12 && (
          <div style={{textAlign:'center',marginTop:8}}>
            <button className="duel-btn duel-btn-text" onClick={earlySubmit} style={{fontSize:11,opacity:.6}}>
              Сдать как есть ({placedCount}/12)
            </button>
          </div>
        )}
      </>
    );
  }

  window.YasnaDuels.register({
    id: 'mirror-fill',
    category: 'mirror',
    title: 'Заполни Ясну',
    subtitle: 'Расставь 12 перемешанных меток',
    description: 'Все 12 меток одной Ясны разбросаны в пуле. Расставь их на правильные позиции. Очко за каждую правильную. При равенстве — кто быстрее.',
    yasnaIds: ['суток', 'года', 'фаз_жизни'],
    defaultYasna: 'суток',
    difficulty: 3,
    estimatedSec: 90,
    mode: 'score',
    Component: MirrorFillYasna,
  });
})();
