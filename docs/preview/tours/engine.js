// ═══════════════════════════════════════════════════════════════════
// TOUR ENGINE — minimal · storytelling · auto-scroll
//
// Principles:
//   1. ОДИН accent на весь тур (не на каждый шаг) — глаз не утомляется
//   2. Narrative-first — сторителлинг вместо callout-каскада
//   3. Auto-scroll — панель сама подъезжает к новому контенту
//   4. Discrete reveal — каждый narrative-абзац появляется в свой момент
//
// Step.narrative[] — массив абзацев истории:
//   [{ at: ms, text: '...', kind: 'default'|'key'|'note'|'caveat'|'quote'|'bridge' }]
// kind влияет на тонкое визуальное выделение (без пёстрых цветов).
//
// Stages[] (визуальная анимация Ясны) — без изменений.
// Опциональные блоки intro/outro/illustration/node — поддерживаются.
// ═══════════════════════════════════════════════════════════════════

(function(){
  const {useState, useEffect, useRef} = React;

  window.YasnaTours = window.YasnaTours || {
    registry: new Map(),
    register(name, config){ this.registry.set(name, config); },
    get(name){ return this.registry.get(name); },
    has(name){ return this.registry.has(name); },
  };

  // Минимум иконок — большинство выдержано в тексте
  const I = (path, opts) => { opts = opts||{}; return <svg viewBox="0 0 24 24" width={opts.size||16} height={opts.size||16} fill="none" stroke="currentColor" strokeWidth={opts.sw||1.6} strokeLinecap="round" strokeLinejoin="round">{path}</svg>; };
  const ICONS = {
    play:       I(<path d="M8 5 V19 L19 12 Z" fill="currentColor"/>, {size:13}),
    pause:      I(<g><path d="M7 5 H10 V19 H7 Z" fill="currentColor"/><path d="M14 5 H17 V19 H14 Z" fill="currentColor"/></g>, {size:13}),
    arrowLeft:  I(<path d="M15 6 L9 12 L15 18"/>, {size:14, sw:2}),
    arrowRight: I(<path d="M9 6 L15 12 L9 18"/>, {size:14, sw:2}),
    check:      I(<path d="M5 12 L10 17 L19 7"/>, {size:14, sw:2.4}),
    close:      I(<path d="M6 6 L18 18 M18 6 L6 18"/>, {size:14, sw:2}),
    book:       I(<path d="M4 4 H20 V20 H4 Z M4 4 H11 V20 M7 8 H8 M7 12 H8 M14 8 H17 M14 12 H17"/>, {size:13, sw:1.4}),
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

  function parseHash(){
    if(typeof window === 'undefined') return null;
    const h = window.location.hash || '';
    const m = h.match(/tour=([\w-]+)(?:&step=(-?\d+))?/);
    if(!m) return null;
    return { tour: m[1], step: m[2] != null ? parseInt(m[2], 10) : -1 };
  }

  // SPEED — глобальный множитель авто-прокрутки (2× медленнее по умолчанию)
  const SPEED = 2.0;

  function GuideRunner({ tour, yasnaTpl, onClose, onLoadYasna }){
    const {Star} = window.YasnaCore;

    // ОДИН accent на весь тур (warm gold для Sutki, blue для Atm)
    const ACCENT = tour.accent || tour.intro?.accent || '#d4a574';
    // Производные оттенки одного цвета (без новых hue) — RGBA с разной opacity
    const accent = ACCENT;

    const initialStep = (()=>{
      const h = parseHash();
      if(h && h.tour === tour.id) return h.step;
      return -1;
    })();
    const [stepIdx, setStepIdx] = useState(initialStep);
    const [stageT, setStageT] = useState(0);
    const [playing, setPlaying] = useState(true);
    const stepStartRef = useRef(performance.now());
    const rafRef = useRef(null);
    const panelRef = useRef(null);
    const [revealedCount, setRevealedCount] = useState(0);

    const [y] = useState(()=> yasnaTpl ? {
      name: yasnaTpl.n, p:[...yasnaTpl.p],
      th:yasnaTpl.th||'', bh:yasnaTpl.bh||'', lh:yasnaTpl.lh||'', rh:yasnaTpl.rh||''
    } : null);

    const total = (tour.steps||[]).length;
    const isIntro = stepIdx === -1;
    const isOutro = stepIdx === total;
    const isStep  = stepIdx >= 0 && stepIdx < total;
    const step    = isStep ? tour.steps[stepIdx] : null;

    useEffect(()=>{
      stepStartRef.current = performance.now();
      setStageT(0);
      setRevealedCount(0);
      // scroll panel to top на новом шаге
      if(panelRef.current) panelRef.current.scrollTop = 0;
      // Update URL hash
      if(typeof window !== 'undefined' && window.history){
        const newHash = `#tour=${tour.id}&step=${stepIdx}`;
        if(window.location.hash !== newHash){
          window.history.replaceState(null, '', newHash);
        }
      }
    }, [stepIdx]);

    useEffect(()=>{
      if(!playing){ if(rafRef.current){ cancelAnimationFrame(rafRef.current); rafRef.current=null; } return; }
      const tick = (now)=>{
        const elapsed = now - stepStartRef.current;
        setStageT(elapsed);
        const baseDur = isIntro ? (tour.intro?.duration||5500) : (step?.totalDuration||13000);
        const totalDur = isOutro ? Infinity : baseDur * SPEED;
        if(elapsed >= totalDur && stepIdx < total){ setStepIdx(i=>Math.min(total, i+1)); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return ()=>{ if(rafRef.current){ cancelAnimationFrame(rafRef.current); rafRef.current=null; } };
    }, [playing, stepIdx]);

    // Автопрокрутка панели к новому narrative-абзацу
    useEffect(()=>{
      if(!step?.narrative) return;
      const visible = step.narrative.filter(e => stageT >= (e.at||0) * SPEED).length;
      if(visible > revealedCount){
        setRevealedCount(visible);
        // дать React-у дорисовать, потом скроллить
        requestAnimationFrame(()=>{
          if(!panelRef.current) return;
          const entries = panelRef.current.querySelectorAll('.narrative-entry');
          const last = entries[entries.length-1];
          if(last){
            // мягкий скролл к концу абзаца с отступом
            const targetTop = last.offsetTop - 80;
            panelRef.current.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
          }
        });
      }
    }, [stageT, stepIdx]);

    // Smart navigation: stage→stage внутри шага, потом step→step
    const advanceForward = ()=>{
      const cs = (stepIdx>=0 && stepIdx<total) ? tour.steps[stepIdx] : null;
      if(cs && cs.stages && cs.stages.length>1){
        const next = cs.stages.find(st => (st.at||0)*SPEED > stageT + 50);
        if(next){
          const target = (next.at||0)*SPEED;
          stepStartRef.current = performance.now() - target;
          setStageT(target);
          setPlaying(false);
          return;
        }
        // also check narrative
        if(cs.narrative){
          const nextNarr = cs.narrative.find(e => (e.at||0)*SPEED > stageT + 50);
          if(nextNarr){
            const target = (nextNarr.at||0)*SPEED;
            stepStartRef.current = performance.now() - target;
            setStageT(target);
            setPlaying(false);
            return;
          }
        }
        const stepDurEff = (cs.totalDuration || 13000) * SPEED;
        if(stageT < stepDurEff * 0.95){
          stepStartRef.current = performance.now() - stepDurEff;
          setStageT(stepDurEff);
          setPlaying(false);
          return;
        }
      }
      setStepIdx(i=>Math.min(total, i+1));
      setPlaying(false);
    };
    const advanceBack = ()=>{
      const cs = (stepIdx>=0 && stepIdx<total) ? tour.steps[stepIdx] : null;
      if(cs){
        const allTimes = [];
        if(cs.stages) cs.stages.forEach(s => allTimes.push((s.at||0)*SPEED));
        if(cs.narrative) cs.narrative.forEach(s => allTimes.push((s.at||0)*SPEED));
        allTimes.sort((a,b)=>a-b);
        let prev = -1;
        for(const t of allTimes){ if(t < stageT - 50) prev = t; else break; }
        if(prev >= 0){
          stepStartRef.current = performance.now() - prev;
          setStageT(prev);
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
      ? resolveStage(step.stages, stageT/SPEED)
      : { hl:step?.highlight||null, af:step?.af||[], stageIdx:0, totalStages:1, note:null };
    const af = isOutro ? (tour.outro?.af||[]) : stageState.af;
    const highlight = stageState.hl;

    const stepDur = (step?.totalDuration||13000) * SPEED;
    const sp = Math.min(1, stageT / stepDur);

    const dots = [];
    for(let i=-1; i<=total; i++) dots.push({idx:i, active:i===stepIdx, completed:i<stepIdx});

    // Минималистичная палитра — neutral базовая, accent для активного
    const BG = '#0e1019';
    const FG = 'rgba(255,255,255,.94)';
    const FG_MUTED = 'rgba(255,255,255,.62)';
    const FG_DIM = 'rgba(255,255,255,.38)';
    const BORDER = 'rgba(255,255,255,.08)';
    const SURFACE = 'rgba(255,255,255,.025)';
    const SURFACE_RAISED = 'rgba(255,255,255,.04)';

    return (
      <div style={{position:'fixed',inset:0,background:BG,zIndex:200,display:'flex',flexDirection:'column',color:FG,fontFamily:'inherit',animation:'tourFadeIn .5s ease'}} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>

        {/* TOP — minimal */}
        <div style={{padding:'14px 24px',display:'flex',alignItems:'center',gap:14,borderBottom:'1px solid '+BORDER,flexShrink:0,background:BG}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:26,height:26,borderRadius:7,background:accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#0e1019',fontWeight:700}}>✦</div>
            <div>
              <div style={{fontSize:12.5,fontWeight:600,letterSpacing:.2,color:FG}}>Гид по Ясне</div>
              <div style={{fontSize:11,color:FG_DIM,marginTop:1}}>{y.name}</div>
            </div>
          </div>
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,minWidth:0,overflow:'hidden'}}>
            {dots.map((d,i)=>(
              <button key={i} onClick={()=>{ setStepIdx(d.idx); setPlaying(false); }}
                style={{padding:0,border:'none',cursor:'pointer',height:6,width:d.active?22:6,borderRadius:3,
                       background:d.active?accent:(d.completed?'rgba(255,255,255,.32)':'rgba(255,255,255,.12)'),
                       transition:'all .35s ease'}}
                title={d.idx===-1?'Вступление':d.idx===total?'Завершение':`${d.idx+1}. ${tour.steps[d.idx]?.title||''}`}/>
            ))}
          </div>
          <div style={{fontSize:11.5,color:FG_DIM,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>{stepIdx+2} / {total+2}</div>
          <button onClick={onClose} style={{display:'flex',alignItems:'center',gap:5,background:'transparent',border:'1px solid '+BORDER,color:FG_MUTED,padding:'6px 11px',borderRadius:8,fontSize:12,cursor:'pointer',fontWeight:500}}>{ICONS.close}<span style={{display:typeof window!=='undefined'&&window.innerWidth<=600?'none':'inline'}}>Закрыть</span></button>
        </div>

        {/* BODY split */}
        <div style={{flex:1,display:'flex',minHeight:0,overflow:'hidden'}} className="tour-body">

          {/* CANVAS */}
          <div style={{flex:'1.5 1 0',display:'flex',alignItems:'center',justifyContent:'center',padding:'30px 24px',minWidth:0,position:'relative'}}>
            <div style={{position:'relative',width:'100%',maxWidth:680,aspectRatio:'900/700',background:SURFACE,borderRadius:18,border:'1px solid '+BORDER,overflow:'hidden',transition:'all .8s cubic-bezier(.4,0,.2,1)'}}>
              <Star yy={y} sel={null} onSel={()=>{}} hl={highlight} af={af} showOpp={(af||[]).includes('opp')} overlay={null} mob={typeof window!=='undefined'&&window.innerWidth<=768}/>
              {/* SPOTLIGHT — затемняем фон, оставляем «окна» на подсвеченных полках */}
              {highlight && highlight.length > 0 && highlight.length < 12 && (
                <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',transition:'opacity .5s ease'}} viewBox="0 0 900 700" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <mask id={`spot-${stepIdx}-${(highlight||[]).join(',')}`}>
                      <rect width="900" height="700" fill="white"/>
                      {highlight.map((idx,k)=>{
                        const a = (270 - idx*30) * Math.PI / 180;
                        const x = 450 + 215 * Math.cos(a);
                        const yc = 350 - 215 * Math.sin(a);
                        return <g key={k}>
                          <circle cx={x} cy={yc} r="58" fill="black"/>
                          <circle cx={x} cy={yc} r="80" fill="rgba(0,0,0,.4)"/>
                        </g>;
                      })}
                    </mask>
                  </defs>
                  <rect width="900" height="700" fill="rgba(8,10,18,.45)" mask={`url(#spot-${stepIdx}-${(highlight||[]).join(',')})`} style={{transition:'all .5s ease',animation:'spotFade .5s ease'}}/>
                </svg>
              )}
            </div>

            {/* Stage progress dots — над канвасом, минимально */}
            {step && step.stages && step.stages.length>1 && (
              <div style={{position:'absolute',bottom:30,left:'50%',transform:'translateX(-50%)',display:'flex',gap:5,padding:'5px 9px',borderRadius:14,background:SURFACE_RAISED,border:'1px solid '+BORDER}}>
                {step.stages.map((_,i)=>(
                  <div key={i} style={{width:i<=stageState.stageIdx?16:8,height:3,borderRadius:2,background:i<=stageState.stageIdx?accent:'rgba(255,255,255,.18)',transition:'all .35s ease'}}/>
                ))}
              </div>
            )}

            {/* Stage caption — минимальный */}
            {stageState.note && (
              <div key={`${stepIdx}-${stageState.stageIdx}`} style={{position:'absolute',bottom:60,left:'50%',transform:'translateX(-50%)',padding:'7px 14px',borderRadius:10,background:'rgba(0,0,0,.55)',backdropFilter:'blur(6px)',border:'1px solid '+BORDER,fontSize:12,fontWeight:500,color:FG,animation:'noteIn .35s ease',maxWidth:'80%',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {stageState.note}
              </div>
            )}
          </div>

          {/* SIDE PANEL — narrative storytelling */}
          <div ref={panelRef} className="tour-panel" style={{flex:'1 1 0',maxWidth:520,padding:'40px 36px 60px',overflowY:'auto',background:SURFACE,borderLeft:'1px solid '+BORDER,scrollBehavior:'smooth'}}>

            {isIntro && tour.intro && (
              <div className="tour-card" style={{animation:'cardIn .6s cubic-bezier(.16,1,.3,1)',maxWidth:440}}>
                <div style={{fontSize:11,letterSpacing:1.8,textTransform:'uppercase',color:FG_DIM,marginBottom:14,fontWeight:600}}>Вступление</div>
                <h1 style={{fontSize:30,fontWeight:700,lineHeight:1.18,marginBottom:14,letterSpacing:-.5,color:FG}}>{tour.intro.title}</h1>
                <div style={{fontSize:14.5,color:FG_MUTED,fontStyle:'italic',marginBottom:22,lineHeight:1.5}}>{tour.intro.subtitle}</div>
                <div style={{fontSize:15,lineHeight:1.7,color:FG,marginBottom:24}}>{tour.intro.lead}</div>
                {tour.source && (
                  <div style={{padding:'14px 16px',borderLeft:'2px solid '+accent,background:SURFACE_RAISED,marginBottom:24,borderRadius:'2px 8px 8px 2px'}}>
                    <div style={{fontSize:11,color:FG_DIM,marginBottom:4,letterSpacing:.5,fontWeight:600,textTransform:'uppercase'}}>Источник</div>
                    <div style={{fontSize:13.5,fontWeight:600,marginBottom:4,color:FG}}>{tour.source.ref}</div>
                    <div style={{fontSize:12.5,color:FG_MUTED,lineHeight:1.45}}>{tour.source.desc}</div>
                  </div>
                )}
                {tour.intro.checkpoints && (
                  <div>
                    <div style={{fontSize:11,letterSpacing:1.8,textTransform:'uppercase',color:FG_DIM,marginBottom:12,fontWeight:600}}>Что увидим</div>
                    <ol style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:10}}>
                      {tour.intro.checkpoints.map((c,i)=>(
                        <li key={i} style={{fontSize:13.5,color:FG,display:'flex',gap:14,alignItems:'flex-start',lineHeight:1.5}}>
                          <span style={{flexShrink:0,fontSize:11,fontVariantNumeric:'tabular-nums',color:accent,fontWeight:700,minWidth:14,marginTop:2}}>{String(i+1).padStart(2,'0')}</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}

            {isStep && step && (
              <div className="tour-card" key={stepIdx} style={{animation:'cardIn .5s cubic-bezier(.16,1,.3,1)',maxWidth:440}}>
                {/* Header — minimal */}
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18,fontSize:11,letterSpacing:1.5,textTransform:'uppercase',color:FG_DIM,fontWeight:600}}>
                  <span>Глава {stepIdx+1}</span>
                  <span style={{color:'rgba(255,255,255,.18)'}}>·</span>
                  <span>{stepIdx+1} из {total}</span>
                  {step.node && <>
                    <span style={{color:'rgba(255,255,255,.18)'}}>·</span>
                    <span style={{display:'inline-flex',alignItems:'center',gap:5,color:FG_MUTED}}>{ICONS.book}<span>{step.node}</span></span>
                  </>}
                </div>

                <h2 style={{fontSize:28,fontWeight:700,lineHeight:1.2,marginBottom:8,letterSpacing:-.4,color:FG}}>{step.title}</h2>
                <div style={{fontSize:14,color:FG_MUTED,fontStyle:'italic',marginBottom:28,lineHeight:1.45}}>{step.subtitle}</div>

                {/* LEGACY FALLBACK: если у шага нет narrative но есть старые поля — собираем их в narrative динамически */}
                {!step.narrative && (step.hook || step.body) && (()=>{
                  const arr = [];
                  let t = 0;
                  if(step.hook){ arr.push({at:t, text:step.hook, kind:'note'}); t += 2500; }
                  if(step.body){ arr.push({at:t, text:step.body}); t += 4000; }
                  if(step.bullets){ arr.push({at:t, text: step.bullets.map(b=>'• '+b).join('<br/><br/>')}); t += 4000; }
                  if(step.quote){ arr.push({at:t, text:step.quote.text||step.quote, kind:'quote', ref:step.quote.ref}); t += 3000; }
                  if(step.insight){ arr.push({at:t, text:step.insight, kind:'key'}); t += 3500; }
                  if(step.paradox){ arr.push({at:t, text: step.paradox, kind:'note'}); t += 3000; }
                  if(step.pitfall){ arr.push({at:t, text:step.pitfall, kind:'caveat'}); t += 3000; }
                  if(step.mnemonic){ arr.push({at:t, text:step.mnemonic, kind:'mnemonic'}); t += 2500; }
                  if(step.bridge){ arr.push({at:t, text:step.bridge, kind:'bridge'}); }
                  return (
                    <div style={{display:'flex',flexDirection:'column',gap:18}}>
                      {arr.map((entry,i)=>{
                        const visible = stageT >= (entry.at||0) * SPEED;
                        if(!visible) return null;
                        const kind = entry.kind || 'default';
                        let style = { fontSize:15.5, lineHeight:1.7, color:FG };
                        let prefix = null;
                        if(kind === 'key'){ style = { ...style, fontWeight:600, fontSize:16.5, padding:'18px 0 18px 20px', borderLeft:'3px solid '+accent, marginLeft:-2 }; }
                        else if(kind === 'note'){ style = { ...style, fontSize:14.5, color:FG_MUTED, fontStyle:'italic' }; }
                        else if(kind === 'caveat'){ style = { ...style, fontSize:14, color:FG_MUTED, padding:'10px 0 10px 16px', borderLeft:'2px solid rgba(255,255,255,.18)' }; prefix = <span style={{display:'block',fontSize:10.5,letterSpacing:1.5,textTransform:'uppercase',color:FG_DIM,marginBottom:5,fontWeight:600}}>Важно не путать</span>; }
                        else if(kind === 'quote'){ style = { ...style, fontSize:15, fontStyle:'italic', padding:'18px 22px',background:SURFACE_RAISED,borderRadius:8,borderLeft:'2px solid '+accent }; prefix = entry.ref ? <span style={{display:'block',fontSize:10.5,letterSpacing:1.5,textTransform:'uppercase',color:FG_DIM,marginBottom:8,fontWeight:600}}>{entry.ref}</span> : null; }
                        else if(kind === 'mnemonic'){ style = { ...style, fontSize:14, fontWeight:500, padding:'12px 16px',background:'rgba(212,165,116,.06)',borderRadius:8,border:'1px dashed rgba(212,165,116,.3)' }; prefix = <span style={{display:'block',fontSize:10,letterSpacing:1.8,textTransform:'uppercase',color:accent,marginBottom:5,fontWeight:700,opacity:.8}}>Запомни</span>; }
                        else if(kind === 'bridge'){ style = { ...style, fontSize:14, color:FG_DIM, fontStyle:'italic', marginTop:8, paddingTop:18, borderTop:'1px dashed '+BORDER }; }
                        return (<div key={i} className="narrative-entry" style={{...style, animation:'fadeUp .55s cubic-bezier(.16,1,.3,1)'}}>{prefix}<span dangerouslySetInnerHTML={{__html: entry.text}}/></div>);
                      })}
                    </div>
                  );
                })()}

                {/* NARRATIVE — flowing storytelling. Resolve at via stageIdx if specified */}
                {step.narrative && (()=>{
                  const resolved = step.narrative.map(e => {
                    if(e.stageIdx != null && step.stages && step.stages[e.stageIdx]){
                      return { ...e, at: (step.stages[e.stageIdx].at||0) + (e.offset||0) };
                    }
                    return e;
                  });
                  return (
                  <div style={{display:'flex',flexDirection:'column',gap:18}}>
                    {resolved.map((entry, i)=>{
                      const visible = stageT >= (entry.at||0) * SPEED;
                      if(!visible) return null;
                      const kind = entry.kind || 'default';
                      let style = { fontSize:15.5, lineHeight:1.7, color:FG };
                      let inner = entry.text;
                      let prefix = null;
                      if(kind === 'key'){
                        style = { ...style, fontWeight:600, fontSize:16.5, padding:'18px 0 18px 20px', borderLeft:'3px solid '+accent, marginLeft:-2 };
                      } else if(kind === 'note'){
                        style = { ...style, fontSize:14.5, color:FG_MUTED, fontStyle:'italic' };
                      } else if(kind === 'caveat'){
                        style = { ...style, fontSize:14, color:FG_MUTED, padding:'10px 0 10px 16px', borderLeft:'2px solid rgba(255,255,255,.18)' };
                        prefix = <span style={{display:'block',fontSize:10.5,letterSpacing:1.5,textTransform:'uppercase',color:FG_DIM,marginBottom:5,fontWeight:600}}>Важно не путать</span>;
                      } else if(kind === 'quote'){
                        style = { ...style, fontSize:15, fontStyle:'italic', padding:'18px 22px',background:SURFACE_RAISED,borderRadius:8,borderLeft:'2px solid '+accent };
                        prefix = entry.ref ? <span style={{display:'block',fontSize:10.5,letterSpacing:1.5,textTransform:'uppercase',color:FG_DIM,marginBottom:8,fontWeight:600}}>{entry.ref}</span> : null;
                      } else if(kind === 'mnemonic'){
                        style = { ...style, fontSize:14, fontWeight:500, padding:'12px 16px',background:'rgba(212,165,116,.06)',borderRadius:8,border:'1px dashed rgba(212,165,116,.3)' };
                        prefix = <span style={{display:'block',fontSize:10,letterSpacing:1.8,textTransform:'uppercase',color:accent,marginBottom:5,fontWeight:700,opacity:.8}}>Запомни</span>;
                      } else if(kind === 'bridge'){
                        style = { ...style, fontSize:14, color:FG_DIM, fontStyle:'italic', marginTop:8, paddingTop:18, borderTop:'1px dashed '+BORDER };
                      }
                      return (
                        <div key={i} className="narrative-entry" style={{...style, animation:'fadeUp .55s cubic-bezier(.16,1,.3,1)'}}>
                          {prefix}
                          <span dangerouslySetInnerHTML={{__html: inner}}/>
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}

                {/* Cross-references — minimal chips */}
                {step.crossRefs && step.crossRefs.length > 0 && stageT >= stepDur * 0.7 && (
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:22,paddingTop:18,borderTop:'1px solid '+BORDER,animation:'fadeUp .5s ease'}}>
                    {step.crossRefs.map((cr,i)=>{
                      const targetIdx = tour.steps.findIndex(s=>s.id===cr.id);
                      if(targetIdx<0) return null;
                      return (
                        <button key={i} onClick={()=>{ setStepIdx(targetIdx); setPlaying(false); }} style={{padding:'5px 10px',borderRadius:14,background:'transparent',border:'1px solid '+BORDER,color:FG_MUTED,fontSize:11.5,cursor:'pointer',fontWeight:500,transition:'all .2s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor=accent; e.currentTarget.style.color=FG;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER; e.currentTarget.style.color=FG_MUTED;}}>
                          → {tour.steps[targetIdx].title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {isOutro && tour.outro && (
              <div className="tour-card" style={{animation:'cardIn .6s cubic-bezier(.16,1,.3,1)',maxWidth:440}}>
                <div style={{fontSize:11,letterSpacing:1.8,textTransform:'uppercase',color:FG_DIM,marginBottom:14,fontWeight:600}}>Завершение</div>
                <h1 style={{fontSize:28,fontWeight:700,lineHeight:1.22,marginBottom:18,letterSpacing:-.4,color:FG}}>{tour.outro.title}</h1>
                <div style={{fontSize:15,lineHeight:1.7,color:FG,marginBottom:26}}>{tour.outro.body}</div>
                {tour.outro.summary && (
                  <ol style={{listStyle:'none',padding:0,margin:'18px 0 28px',display:'flex',flexDirection:'column',gap:10}}>
                    {tour.outro.summary.map((s,i)=>(
                      <li key={i} style={{fontSize:13.5,color:FG,display:'flex',gap:12,alignItems:'flex-start',lineHeight:1.55}}>
                        <span style={{flexShrink:0,color:accent,marginTop:2}}>{ICONS.check}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {tour.outro.cta && (
                  <button onClick={()=>{ if(onLoadYasna) onLoadYasna(); onClose(); }} style={{padding:'14px 22px',borderRadius:12,border:'none',background:accent,color:'#0e1019',cursor:'pointer',fontSize:14,fontWeight:700,display:'flex',alignItems:'center',gap:8,transition:'transform .15s'}} onMouseDown={e=>e.currentTarget.style.transform='scale(.97)'} onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>{ICONS.check}<span>{tour.outro.cta}</span></button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM */}
        <div style={{padding:'14px 24px',background:BG,borderTop:'1px solid '+BORDER,display:'flex',gap:10,alignItems:'center',flexShrink:0}}>
          <button disabled={isIntro} onClick={advanceBack} style={{padding:'9px 14px',borderRadius:10,border:'1px solid '+BORDER,background:'transparent',color:isIntro?FG_DIM:FG_MUTED,cursor:isIntro?'not-allowed':'pointer',opacity:isIntro?.4:1,fontSize:12.5,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>{ICONS.arrowLeft}<span>Назад</span></button>
          <button onClick={()=>setPlaying(p=>!p)} style={{padding:'9px 14px',borderRadius:10,border:'1px solid '+BORDER,background:'transparent',color:FG_MUTED,cursor:'pointer',fontSize:12.5,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>{playing?ICONS.pause:ICONS.play}<span>{playing?'Пауза':'Авто'}</span></button>
          <div style={{flex:1,fontSize:11,color:FG_DIM,textAlign:'center'}}>
            <span style={{display:typeof window!=='undefined'&&window.innerWidth<=600?'none':'inline'}}>← →  Пробел — следующий шаг анимации · Esc — закрыть</span>
          </div>
          {!isOutro && <button onClick={advanceForward} style={{padding:'9px 18px',borderRadius:10,border:'none',background:accent,color:'#0e1019',cursor:'pointer',fontSize:12.5,fontWeight:700,display:'flex',alignItems:'center',gap:6}}><span>Дальше</span>{ICONS.arrowRight}</button>}
          {isOutro && tour.outro?.cta && <button onClick={()=>{ if(onLoadYasna) onLoadYasna(); onClose(); }} style={{padding:'9px 18px',borderRadius:10,border:'none',background:accent,color:'#0e1019',cursor:'pointer',fontSize:12.5,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>{ICONS.check}<span>Перейти</span></button>}
        </div>

        <style>{`
          @keyframes tourFadeIn { from { opacity:0; } to { opacity:1; } }
          @keyframes cardIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
          @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
          @keyframes noteIn { from { opacity:0; transform:translate(-50%,4px); } to { opacity:1; transform:translate(-50%,0); } }
          @keyframes spotFade { from { opacity:0; } to { opacity:1; } }
          .tour-panel::-webkit-scrollbar { width: 6px; }
          .tour-panel::-webkit-scrollbar-track { background: transparent; }
          .tour-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 3px; }
          @media (max-width: 768px) {
            .tour-body { flex-direction: column !important; }
            .tour-panel { max-width: none !important; max-height: 50vh; padding: 24px 20px !important; border-left: none !important; border-top: 1px solid rgba(255,255,255,.08); }
          }
        `}</style>
      </div>
    );
  }

  window.YasnaTours.GuideRunner = GuideRunner;
})();
