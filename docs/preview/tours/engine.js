// ═══════════════════════════════════════════════════════════════════
// TOUR ENGINE — generic runner для интерактивных гидов по Яснам.
//
// Методологический каркас (по образцу подачи в «Ясна Суток»):
//   1. HOOK     — провокация: вопрос, а не ответ
//   2. GROUND   — связка с прожитым опытом
//   3. REVEAL   — последовательное раскрытие через stages[]
//   4. NAME     — формальное имя закона/механики
//   5. INSIGHT  — главное в одну строку
//   6. PITFALL  — антипаттерн
//   7. BRIDGE   — связка к следующему шагу
//
// stages[]: [{ at: ms, hl: [polki], af: [mechanics], note? }]
//   Engine последовательно применяет состояния, давая визуальный пульс.
//
// API:
//   window.YasnaTours.register(yasnaName, tourConfig)
// ═══════════════════════════════════════════════════════════════════

(function(){
  const {useState, useEffect, useRef} = React;

  window.YasnaTours = window.YasnaTours || {
    registry: new Map(),
    register(name, config){ this.registry.set(name, config); },
    get(name){ return this.registry.get(name); },
    has(name){ return this.registry.has(name); },
  };

  // ───────── Outline SVG-иконки ─────────
  const I = (path, opts) => { opts = opts||{}; return <svg viewBox="0 0 24 24" width={opts.size||22} height={opts.size||22} fill={opts.fill||'none'} stroke="currentColor" strokeWidth={opts.sw||1.6} strokeLinecap="round" strokeLinejoin="round">{path}</svg>; };
  const ICONS = {
    star:       I(<path d="M12 2 L14.5 9 L22 9 L16 14 L18.5 22 L12 17 L5.5 22 L8 14 L2 9 L9.5 9 Z"/>),
    cross:      I(<path d="M12 3 V21 M3 12 H21"/>, {sw:1.8}),
    diamond:    I(<path d="M12 3 L21 12 L12 21 L3 12 Z"/>, {sw:1.8}),
    triangle:   I(<path d="M12 3 L21 19 L3 19 Z"/>, {sw:1.8}),
    flame:      I(<path d="M12 3 C 9 8 7 11 7 14 C 7 18 9 21 12 21 C 15 21 17 18 17 14 C 17 11 15 9 13 7 C 13 9 12 11 11 11 C 11 9 12 6 12 3 Z"/>),
    drop:       I(<path d="M12 3 C 8 9 5 13 5 16 C 5 19 8 21 12 21 C 16 21 19 19 19 16 C 19 13 16 9 12 3 Z"/>),
    wind:       I(<path d="M3 8 H14 M3 12 H19 M3 16 H11"/>),
    earth:      I(<g><circle cx="12" cy="12" r="9"/><path d="M3 12 H21 M12 3 V21 M5 7 Q12 11 19 7 M5 17 Q12 13 19 17"/></g>),
    arrows:     I(<path d="M3 12 H21 M5 8 L3 12 L5 16 M19 8 L21 12 L19 16"/>, {sw:1.8}),
    halves:     I(<g><circle cx="12" cy="12" r="9"/><path d="M3 12 H21" strokeWidth="2.4"/></g>),
    zodiac:     I(<g><circle cx="12" cy="12" r="9"/><path d="M12 3 V21 M3 12 H21 M5.6 5.6 L18.4 18.4 M18.4 5.6 L5.6 18.4"/></g>, {sw:1.4}),
    scorpio:    I(<path d="M3 12 Q12 3 21 12 M3 12 Q12 21 21 12 M12 12 H17 L20 9"/>),
    infinity:   I(<path d="M6 12 Q3 8 6 8 Q9 8 12 12 Q15 16 18 16 Q21 16 18 12 Q15 8 12 12 Q9 16 6 16 Q3 16 6 12 Z"/>, {sw:1.8}),
    accumulate: I(<path d="M5 19 V13 M5 13 L8 16 M5 13 L2 16 M12 19 V9 M12 9 L15 12 M12 9 L9 12 M19 19 V5 M19 5 L22 8 M19 5 L16 8"/>),
    rhythm:     I(<path d="M4 17 L9 7 L14 17 L19 7"/>),
    warning:    I(<path d="M12 3 L21 19 L3 19 Z M12 10 V14 M12 17 H12.01"/>),
    grid:       I(<g><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="9" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/><rect x="15" y="9" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></g>, {sw:1.4}),
    sparkle:    I(<path d="M12 3 V8 M12 16 V21 M3 12 H8 M16 12 H21 M5.6 5.6 L8 8 M16 16 L18.4 18.4 M18.4 5.6 L16 8 M5.6 18.4 L8 16"/>),
    play:       I(<path d="M8 5 V19 L19 12 Z" fill="currentColor"/>, {size:14}),
    pause:      I(<g><path d="M7 5 H10 V19 H7 Z" fill="currentColor"/><path d="M14 5 H17 V19 H14 Z" fill="currentColor"/></g>, {size:14}),
    arrowLeft:  I(<path d="M15 6 L9 12 L15 18"/>, {size:16, sw:2.2}),
    arrowRight: I(<path d="M9 6 L15 12 L9 18"/>, {size:16, sw:2.2}),
    check:      I(<path d="M5 12 L10 17 L19 7"/>, {size:16, sw:2.4}),
    close:      I(<path d="M6 6 L18 18 M18 6 L6 18"/>, {size:16, sw:2.2}),
    question:   I(<g><circle cx="12" cy="12" r="9"/><path d="M9 9 Q9 6 12 6 Q15 6 15 9 Q15 11 12 12 V14 M12 17 H12.01"/></g>),
    bridge:     I(<path d="M3 18 H21 M5 18 V12 Q12 6 19 12 V18 M9 14 V18 M15 14 V18"/>),
  };
  window.YasnaTours.ICONS = ICONS;

  function resolveStage(stages, t){
    if(!stages || !stages.length) return { hl:null, af:[], stageIdx:0, totalStages:0, note:null };
    let cur = stages[0]; let idx = 0;
    for(let i=0;i<stages.length;i++){
      if(t >= (stages[i].at||0)){ cur = stages[i]; idx = i; } else break;
    }
    return { hl:cur.hl||null, af:cur.af||[], note:cur.note||null, stageIdx:idx, totalStages:stages.length };
  }

  function GuideRunner({ tour, yasnaTpl, onClose, onLoadYasna }){
    const {Star} = window.YasnaCore;
    const [stepIdx, setStepIdx] = useState(-1);
    const [stageT, setStageT] = useState(0);
    const [playing, setPlaying] = useState(true);
    const stepStartRef = useRef(performance.now());
    const rafRef = useRef(null);

    const [y] = useState(()=> yasnaTpl ? {
      name: yasnaTpl.n, p:[...yasnaTpl.p],
      th:yasnaTpl.th||'', bh:yasnaTpl.bh||'', lh:yasnaTpl.lh||'', rh:yasnaTpl.rh||''
    } : null);

    const total = (tour.steps||[]).length;
    const isIntro = stepIdx === -1;
    const isOutro = stepIdx === total;
    const isStep  = stepIdx >= 0 && stepIdx < total;
    const step    = isStep ? tour.steps[stepIdx] : null;

    useEffect(()=>{ stepStartRef.current = performance.now(); setStageT(0); }, [stepIdx]);

    useEffect(()=>{
      if(!playing){ if(rafRef.current){ cancelAnimationFrame(rafRef.current); rafRef.current=null; } return; }
      const tick = (now)=>{
        const elapsed = now - stepStartRef.current;
        setStageT(elapsed);
        const totalDur = isIntro ? (tour.intro?.duration||5500) : (isOutro ? Infinity : (step?.totalDuration||13000));
        if(elapsed >= totalDur && stepIdx < total){ setStepIdx(i=>Math.min(total, i+1)); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return ()=>{ if(rafRef.current){ cancelAnimationFrame(rafRef.current); rafRef.current=null; } };
    }, [playing, stepIdx]);

    // Helpers: advance forward через sub-stages, потом next step
    const advanceForward = ()=>{
      const curStep = (stepIdx>=0 && stepIdx<total) ? tour.steps[stepIdx] : null;
      if(curStep && curStep.stages && curStep.stages.length>1){
        const t = stageT;
        // Найти следующую stage с at > t
        const nextStage = curStep.stages.find(st => (st.at||0) > t + 50);
        if(nextStage){
          stepStartRef.current = performance.now() - (nextStage.at||0);
          setStageT(nextStage.at||0);
          setPlaying(false);
          return;
        }
        // Все stages пройдены, но текстовый контент мог не успеть — добежим до конца шага если ещё рано
        const stepDur = curStep.totalDuration || 13000;
        if(t < stepDur * 0.9){
          stepStartRef.current = performance.now() - stepDur;
          setStageT(stepDur);
          setPlaying(false);
          return;
        }
      }
      setStepIdx(i=>Math.min(total, i+1));
      setPlaying(false);
    };
    const advanceBack = ()=>{
      const curStep = (stepIdx>=0 && stepIdx<total) ? tour.steps[stepIdx] : null;
      if(curStep && curStep.stages && curStep.stages.length>1){
        const t = stageT;
        // Найти предыдущую stage
        let prevAt = -1;
        for(const st of curStep.stages){ if((st.at||0) < t - 50){ prevAt = st.at||0; } else break; }
        if(prevAt >= 0){
          stepStartRef.current = performance.now() - prevAt;
          setStageT(prevAt);
          setPlaying(false);
          return;
        }
      }
      setStepIdx(i=>Math.max(-1, i-1));
      setPlaying(false);
    };

    useEffect(()=>{
      const onKey = (e)=>{
        if(e.key==='ArrowRight'||e.key===' '){ e.preventDefault(); advanceForward(); }
        if(e.key==='ArrowLeft'){ e.preventDefault(); advanceBack(); }
        if(e.key==='Escape'){ onClose(); }
      };
      window.addEventListener('keydown', onKey);
      return ()=> window.removeEventListener('keydown', onKey);
    }, [stepIdx, stageT]);

    if(!y) return null;

    const stageState = step?.stages
      ? resolveStage(step.stages, stageT)
      : { hl:step?.highlight||null, af:step?.af||[], stageIdx:0, totalStages:1, note:null };
    const af = isOutro ? (tour.outro?.af||[]) : stageState.af;
    const highlight = stageState.hl;
    const accent = step?.accent || tour.intro?.accent || '#a21caf';

    const stepDur = step?.totalDuration||13000;
    const sp = Math.min(1, stageT / stepDur);
    const showHook=true, showBody=sp>=0.12, showBullets=sp>=0.28, showInsight=sp>=0.45, showPitfall=sp>=0.65, showBridge=sp>=0.82;

    const dots = [];
    for(let i=-1; i<=total; i++) dots.push({idx:i, active:i===stepIdx, completed:i<stepIdx});

    return (
      <div style={{position:'fixed',inset:0,background:'radial-gradient(ellipse at top, #1a1a3a 0%, #08081a 60%, #050510 100%)',zIndex:200,display:'flex',flexDirection:'column',color:'#fff',fontFamily:'inherit',animation:'tourFadeIn .5s ease'}} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>

        {/* TOP */}
        <div style={{padding:'14px 22px',display:'flex',alignItems:'center',gap:14,borderBottom:'1px solid rgba(255,255,255,.08)',flexShrink:0,background:'rgba(0,0,0,.25)',backdropFilter:'blur(10px)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,borderRadius:10,background:`linear-gradient(135deg,${accent},#3b82f6)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>✦</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,letterSpacing:.3}}>Гид по Ясне</div>
              <div style={{fontSize:11,opacity:.65,marginTop:1}}>{y.name}</div>
            </div>
          </div>
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,minWidth:0,overflow:'hidden'}}>
            {dots.map((d,i)=>(
              <button key={i} onClick={()=>{ setStepIdx(d.idx); setPlaying(false); }}
                style={{padding:0,border:'none',cursor:'pointer',height:8,width:d.active?28:8,borderRadius:4,background:d.active?`linear-gradient(90deg,#60a5fa,${accent})`:(d.completed?'rgba(255,255,255,.5)':'rgba(255,255,255,.18)'),transition:'all .35s ease'}}
                title={d.idx===-1?'Вступление':d.idx===total?'Завершение':`Шаг ${d.idx+1}: ${tour.steps[d.idx]?.title||''}`}/>
            ))}
          </div>
          <div style={{fontSize:12,opacity:.65,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>{stepIdx+2} / {total+2}</div>
          <button onClick={onClose} style={{display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.16)',color:'#fff',padding:'7px 12px',borderRadius:14,fontSize:12,cursor:'pointer',fontWeight:500}}>{ICONS.close}<span style={{display:typeof window!=='undefined'&&window.innerWidth<=600?'none':'inline'}}>Закрыть</span></button>
        </div>

        {/* BODY */}
        <div style={{flex:1,display:'flex',minHeight:0,overflow:'hidden'}} className="tour-body">
          {/* Canvas */}
          <div style={{flex:'1.4 1 0',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 20px',minWidth:0,position:'relative'}}>
            <div style={{width:'100%',maxWidth:680,aspectRatio:'900/700',background:'rgba(255,255,255,.02)',borderRadius:24,border:'1px solid rgba(255,255,255,.06)',overflow:'hidden',transition:'all .8s cubic-bezier(.4,0,.2,1)',boxShadow:'0 20px 60px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.05)'}}>
              <Star yy={y} sel={null} onSel={()=>{}} hl={highlight} af={af} showOpp={(af||[]).includes('opp')} overlay={null} mob={typeof window!=='undefined'&&window.innerWidth<=768}/>
            </div>
            {step && step.icon && ICONS[step.icon] && (
              <div className="tour-badge" style={{position:'absolute',top:32,left:32,padding:'10px 14px',borderRadius:20,background:`linear-gradient(135deg,${accent}cc,${accent}88)`,backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,.2)',display:'flex',alignItems:'center',gap:8,boxShadow:'0 4px 16px rgba(0,0,0,.3)',animation:'badgeIn .5s ease'}}>
                <span style={{display:'flex',alignItems:'center',color:'#fff'}}>{ICONS[step.icon]}</span>
                <span style={{fontSize:13,fontWeight:700,letterSpacing:.3,color:'#fff'}}>Шаг {stepIdx+1}</span>
              </div>
            )}
            {step && step.stages && step.stages.length>1 && (
              <div style={{position:'absolute',bottom:32,left:'50%',transform:'translateX(-50%)',display:'flex',gap:5,padding:'6px 10px',borderRadius:20,background:'rgba(0,0,0,.4)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,.08)'}}>
                {step.stages.map((_,i)=>(
                  <div key={i} style={{width:i<=stageState.stageIdx?22:12,height:4,borderRadius:2,background:i<=stageState.stageIdx?accent:'rgba(255,255,255,.18)',transition:'all .4s ease'}}/>
                ))}
              </div>
            )}
            {stageState.note && (
              <div key={`${stepIdx}-${stageState.stageIdx}`} style={{position:'absolute',bottom:64,left:'50%',transform:'translateX(-50%)',padding:'8px 16px',borderRadius:14,background:'rgba(0,0,0,.6)',backdropFilter:'blur(8px)',border:`1px solid ${accent}55`,fontSize:12.5,fontWeight:600,color:'#fff',animation:'noteIn .4s ease',maxWidth:'90%',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {stageState.note}
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="tour-panel" style={{flex:'1 1 0',maxWidth:480,padding:'30px 28px',overflowY:'auto',background:'rgba(0,0,0,.32)',borderLeft:'1px solid rgba(255,255,255,.08)',display:'flex',flexDirection:'column'}}>

            {isIntro && tour.intro && (
              <div className="tour-card" style={{animation:'cardIn .55s cubic-bezier(.16,1,.3,1)'}}>
                <div style={{fontSize:11,letterSpacing:2,textTransform:'uppercase',opacity:.5,marginBottom:12}}>Вступление</div>
                <h1 style={{fontSize:32,fontWeight:800,lineHeight:1.18,marginBottom:12,letterSpacing:-.5}}>{tour.intro.title}</h1>
                <div style={{fontSize:15,opacity:.75,fontStyle:'italic',marginBottom:18,lineHeight:1.4}}>{tour.intro.subtitle}</div>
                <div style={{fontSize:14.5,lineHeight:1.65,opacity:.92,marginBottom:18}}>{tour.intro.lead}</div>
                {tour.source && (
                  <div style={{padding:'12px 14px',borderRadius:14,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',marginBottom:20}}>
                    <div style={{fontSize:10,letterSpacing:1.5,textTransform:'uppercase',opacity:.55,marginBottom:4}}>Источник</div>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{tour.source.ref}</div>
                    <div style={{fontSize:12,opacity:.7,lineHeight:1.4}}>{tour.source.desc}</div>
                  </div>
                )}
                {tour.intro.checkpoints && (
                  <div>
                    <div style={{fontSize:11,letterSpacing:1.5,textTransform:'uppercase',opacity:.55,marginBottom:10}}>Что увидим</div>
                    <ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:8}}>
                      {tour.intro.checkpoints.map((c,i)=>(
                        <li key={i} style={{fontSize:13,opacity:.85,display:'flex',gap:10,alignItems:'flex-start'}}>
                          <span style={{flexShrink:0,width:22,height:22,borderRadius:'50%',background:'rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:accent}}>{i+1}</span>
                          <span style={{lineHeight:1.45}}>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {isStep && step && (
              <div className="tour-card" key={stepIdx} style={{animation:'cardIn .5s cubic-bezier(.16,1,.3,1)'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:42,height:42,borderRadius:14,background:`linear-gradient(135deg,${accent},${accent}99)`,color:'#fff',boxShadow:`0 4px 14px ${accent}66`}}>
                    {ICONS[step.icon] || ICONS.sparkle}
                  </div>
                  <div>
                    <div style={{fontSize:11,letterSpacing:1.5,textTransform:'uppercase',opacity:.55}}>Механика {stepIdx+1} из {total}</div>
                    {step.lawNum && <div style={{fontSize:11,opacity:.5,fontStyle:'italic'}}>Закон №{step.lawNum}</div>}
                  </div>
                </div>

                <h2 style={{fontSize:25,fontWeight:800,lineHeight:1.2,marginBottom:8,letterSpacing:-.3}}>{step.title}</h2>
                <div style={{fontSize:14,opacity:.7,fontStyle:'italic',marginBottom:18,lineHeight:1.45}}>{step.subtitle}</div>

                {step.hook && showHook && (
                  <div style={{padding:'14px 16px',borderRadius:14,background:`linear-gradient(135deg,${accent}26,${accent}10)`,border:`1px solid ${accent}55`,marginBottom:16,display:'flex',gap:10,alignItems:'flex-start',animation:'fadeUp .4s ease'}}>
                    <div style={{flexShrink:0,marginTop:1,color:accent}}>{ICONS.question}</div>
                    <div style={{fontSize:14,fontWeight:600,lineHeight:1.5,fontStyle:'italic'}}>{step.hook}</div>
                  </div>
                )}

                {step.body && showBody && (
                  <div style={{fontSize:14,lineHeight:1.65,opacity:.92,marginBottom:14,animation:'fadeUp .4s ease'}}>{step.body}</div>
                )}

                {step.bullets && showBullets && (
                  <ul style={{listStyle:'none',padding:0,margin:'10px 0 16px',display:'flex',flexDirection:'column',gap:8,animation:'fadeUp .4s ease'}}>
                    {step.bullets.map((b,i)=>(
                      <li key={i} style={{fontSize:13.5,opacity:.88,display:'flex',gap:10,alignItems:'flex-start',lineHeight:1.5}}>
                        <span style={{flexShrink:0,width:6,height:6,borderRadius:'50%',background:accent,marginTop:8}}/>
                        <span dangerouslySetInnerHTML={{__html: b}}/>
                      </li>
                    ))}
                  </ul>
                )}

                {step.insight && showInsight && (
                  <div style={{padding:'14px 16px',borderRadius:14,background:`linear-gradient(135deg,${accent}1f,${accent}0a)`,border:`1px solid ${accent}40`,marginBottom:14,animation:'fadeUp .4s ease'}}>
                    <div style={{fontSize:10,letterSpacing:1.8,textTransform:'uppercase',color:accent,fontWeight:700,marginBottom:5,opacity:.95,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{color:accent,display:'flex'}}>{ICONS.sparkle}</span>
                      <span>Главное</span>
                    </div>
                    <div style={{fontSize:14,lineHeight:1.5,opacity:.95,fontWeight:500}}>{step.insight}</div>
                  </div>
                )}

                {step.pitfall && showPitfall && (
                  <div style={{padding:'12px 14px',borderRadius:12,background:'rgba(220,38,38,.08)',border:'1px solid rgba(220,38,38,.25)',marginBottom:14,animation:'fadeUp .4s ease'}}>
                    <div style={{fontSize:10,letterSpacing:1.5,textTransform:'uppercase',color:'#fca5a5',fontWeight:700,marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{color:'#fca5a5',display:'flex'}}>{ICONS.warning}</span>
                      <span>Ловушка</span>
                    </div>
                    <div style={{fontSize:13,lineHeight:1.5,opacity:.92}}>{step.pitfall}</div>
                  </div>
                )}

                {step.bridge && showBridge && (
                  <div style={{padding:'10px 14px',borderRadius:12,background:'rgba(96,165,250,.08)',border:'1px solid rgba(96,165,250,.25)',marginBottom:8,animation:'fadeUp .4s ease',display:'flex',gap:8,alignItems:'flex-start'}}>
                    <span style={{flexShrink:0,marginTop:1,color:'#93c5fd',display:'flex'}}>{ICONS.bridge}</span>
                    <div style={{fontSize:12.5,lineHeight:1.5,opacity:.85,fontStyle:'italic'}}>{step.bridge}</div>
                  </div>
                )}

                {step.hint && showBridge && (
                  <div style={{fontSize:11.5,opacity:.5,fontStyle:'italic',display:'flex',gap:6,alignItems:'flex-start',marginTop:8,animation:'fadeUp .4s ease'}}>
                    <span>💡</span><span>{step.hint}</span>
                  </div>
                )}
              </div>
            )}

            {isOutro && tour.outro && (
              <div className="tour-card" style={{animation:'cardIn .55s cubic-bezier(.16,1,.3,1)'}}>
                <div style={{fontSize:11,letterSpacing:2,textTransform:'uppercase',opacity:.5,marginBottom:12}}>Завершение</div>
                <h1 style={{fontSize:30,fontWeight:800,lineHeight:1.2,marginBottom:14,letterSpacing:-.3}}>{tour.outro.title}</h1>
                <div style={{fontSize:14.5,lineHeight:1.65,opacity:.92,marginBottom:20}}>{tour.outro.body}</div>
                {tour.outro.summary && (
                  <ul style={{listStyle:'none',padding:0,margin:'12px 0 18px',display:'flex',flexDirection:'column',gap:8}}>
                    {tour.outro.summary.map((s,i)=>(
                      <li key={i} style={{fontSize:13,opacity:.88,display:'flex',gap:10,alignItems:'flex-start',lineHeight:1.5}}>
                        <span style={{flexShrink:0,color:'#22c55e',display:'flex',marginTop:1}}>{ICONS.check}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {tour.outro.cta && (
                  <button onClick={()=>{ if(onLoadYasna) onLoadYasna(); onClose(); }} style={{padding:'14px 24px',borderRadius:18,border:'none',background:`linear-gradient(135deg,${accent},#3b82f6)`,color:'#fff',cursor:'pointer',fontSize:14,fontWeight:700,display:'flex',alignItems:'center',gap:8,boxShadow:`0 6px 22px ${accent}55`,transition:'transform .2s'}} onMouseDown={e=>e.currentTarget.style.transform='scale(.97)'} onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>{ICONS.check}<span>{tour.outro.cta}</span></button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM */}
        <div style={{padding:'14px 22px',background:'rgba(0,0,0,.4)',borderTop:'1px solid rgba(255,255,255,.08)',display:'flex',gap:10,alignItems:'center',flexShrink:0,backdropFilter:'blur(10px)'}}>
          <button disabled={isIntro} onClick={advanceBack} style={{padding:'10px 16px',borderRadius:14,border:'1px solid rgba(255,255,255,.18)',background:'rgba(255,255,255,.05)',color:'#fff',cursor:isIntro?'not-allowed':'pointer',opacity:isIntro?.35:1,fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>{ICONS.arrowLeft}<span>Назад</span></button>
          <button onClick={()=>setPlaying(p=>!p)} style={{padding:'10px 16px',borderRadius:14,border:'1px solid rgba(255,255,255,.18)',background:'rgba(255,255,255,.05)',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>{playing?ICONS.pause:ICONS.play}<span>{playing?'Пауза':'Авто'}</span></button>
          <div style={{flex:1,fontSize:11,opacity:.5,textAlign:'center'}}>
            <span style={{display:typeof window!=='undefined'&&window.innerWidth<=600?'none':'inline'}}>← →  Пробел — следующий шаг анимации · Esc — закрыть</span>
          </div>
          {!isOutro && <button onClick={advanceForward} style={{padding:'10px 20px',borderRadius:14,border:'none',background:`linear-gradient(135deg,${accent},${accent}cc)`,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6,boxShadow:`0 4px 14px ${accent}44`}}><span>Дальше</span>{ICONS.arrowRight}</button>}
          {isOutro && tour.outro?.cta && <button onClick={()=>{ if(onLoadYasna) onLoadYasna(); onClose(); }} style={{padding:'10px 20px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#3b82f6,#a21caf)',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>{ICONS.check}<span>Перейти</span></button>}
        </div>

        <style>{`
          @keyframes tourFadeIn { from { opacity:0; } to { opacity:1; } }
          @keyframes cardIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
          @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
          @keyframes badgeIn { from { opacity:0; transform:scale(.7); } to { opacity:1; transform:scale(1); } }
          @keyframes noteIn { from { opacity:0; transform:translate(-50%,6px); } to { opacity:1; transform:translate(-50%,0); } }
          @media (max-width: 768px) {
            .tour-body { flex-direction: column !important; }
            .tour-panel { max-width: none !important; max-height: 50vh; padding: 22px 18px !important; border-left: none !important; border-top: 1px solid rgba(255,255,255,.08); }
          }
        `}</style>
      </div>
    );
  }

  window.YasnaTours.GuideRunner = GuideRunner;
})();
