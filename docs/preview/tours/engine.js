// ═══════════════════════════════════════════════════════════════════
// TOUR ENGINE — generic runner для любых интерактивных гидов по Яснам
//
// Архитектура:
//   window.YasnaTours = {
//     registry: Map<yasnaName, tourConfig>,
//     register(yasnaName, config),
//     get(yasnaName),
//     Runner: GuideRunner component
//   }
//
// Каждая Ясна может иметь свой tour-{name}.js с registerTour(...).
// Engine рендерит контент в едином красивом UX.
//
// tourConfig:
//   {
//     id, source: {ref, desc, year?},
//     intro: {title, subtitle, lead, accent},
//     steps: [{ id, icon, title, subtitle, accent, body, insight,
//               af, highlight, hint, duration, illustration? }],
//     outro: {title, body, cta}
//   }
// ═══════════════════════════════════════════════════════════════════

(function(){
  const {useState, useEffect, useRef} = React;

  window.YasnaTours = window.YasnaTours || {
    registry: new Map(),
    register(name, config){ this.registry.set(name, config); },
    get(name){ return this.registry.get(name); },
    has(name){ return this.registry.has(name); },
  };

  // Inline SVG-иконки (красивые, единого стиля, не emoji)
  const ICONS = {
    star: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2 L14.5 9 L22 9 L16 14 L18.5 22 L12 17 L5.5 22 L8 14 L2 9 L9.5 9 Z"/></svg>,
    cross: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 V21 M3 12 H21"/></svg>,
    diamond: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 L21 12 L12 21 L3 12 Z"/></svg>,
    triangle: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 L21 19 L3 19 Z"/></svg>,
    flame: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3 C 9 8 7 11 7 14 C 7 18 9 21 12 21 C 15 21 17 18 17 14 C 17 11 15 9 13 7 C 13 9 12 11 11 11 C 11 9 12 6 12 3 Z"/></svg>,
    drop: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3 C 8 9 5 13 5 16 C 5 19 8 21 12 21 C 16 21 19 19 19 16 C 19 13 16 9 12 3 Z"/></svg>,
    wind: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 8 H14 M3 12 H19 M3 16 H11"/></svg>,
    earth: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12 H21 M12 3 V21 M5 7 Q12 11 19 7 M5 17 Q12 13 19 17"/></svg>,
    arrows: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 12 H21 M5 8 L3 12 L5 16 M19 8 L21 12 L19 16"/></svg>,
    halves: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12 H21" stroke="currentColor" strokeWidth="2"/></svg>,
    zodiac: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="12" cy="12" r="9"/><path d="M12 3 V21 M3 12 H21 M5.6 5.6 L18.4 18.4 M18.4 5.6 L5.6 18.4"/></svg>,
    scorpio: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 12 Q12 3 21 12 M3 12 Q12 21 21 12 M12 12 H17 L20 9"/></svg>,
    infinity: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 12 Q3 8 6 8 Q9 8 12 12 Q15 16 18 16 Q21 16 18 12 Q15 8 12 12 Q9 16 6 16 Q3 16 6 12 Z"/></svg>,
    accumulate: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 19 V13 M5 13 L8 16 M5 13 L2 16 M12 19 V9 M12 9 L15 12 M12 9 L9 12 M19 19 V5 M19 5 L22 8 M19 5 L16 8"/></svg>,
    rhythm: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 17 L9 7 L14 17 L19 7"/></svg>,
    warning: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3 L21 19 L3 19 Z M12 10 V14 M12 17 H12.01"/></svg>,
    grid: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="9" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/><rect x="15" y="9" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></svg>,
    sparkle: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3 V8 M12 16 V21 M3 12 H8 M16 12 H21 M5.6 5.6 L8 8 M16 16 L18.4 18.4 M18.4 5.6 L16 8 M5.6 18.4 L8 16"/></svg>,
    play: <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5 V19 L19 12 Z"/></svg>,
    pause: <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 5 H10 V19 H7 Z M14 5 H17 V19 H14 Z"/></svg>,
    arrowLeft: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6 L9 12 L15 18"/></svg>,
    arrowRight: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6 L15 12 L9 18"/></svg>,
    check: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12 L10 17 L19 7"/></svg>,
    close: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>,
  };

  window.YasnaTours.ICONS = ICONS;

  // Generic runner — рендерит любой tour config
  function GuideRunner({ tour, yasnaTpl, onClose, onLoadYasna }){
    const {Star, T} = window.YasnaCore;
    const [stepIdx, setStepIdx] = useState(-1); // -1 = intro, 0..N-1 = steps, N = outro
    const [playing, setPlaying] = useState(true);
    const timerRef = useRef(null);

    // Локальное состояние Ясны для отображения
    const [y] = useState(()=> yasnaTpl ? {
      name: yasnaTpl.n, p: [...yasnaTpl.p],
      th: yasnaTpl.th||'', bh: yasnaTpl.bh||'',
      lh: yasnaTpl.lh||'', rh: yasnaTpl.rh||''
    } : null);

    const totalCount = (tour.steps||[]).length;
    const isIntro = stepIdx === -1;
    const isOutro = stepIdx === totalCount;
    const isStep = stepIdx >= 0 && stepIdx < totalCount;
    const currentStep = isStep ? tour.steps[stepIdx] : null;
    const displayPos = isIntro ? 0 : (isOutro ? totalCount + 1 : stepIdx + 1);
    const displayTotal = totalCount + 1; // intro=1, steps, outro

    // Авто-progress
    useEffect(()=>{
      if(timerRef.current){ clearTimeout(timerRef.current); timerRef.current=null; }
      if(!playing || isOutro) return;
      const dur = isIntro ? 4500 : (currentStep?.duration || 6000);
      timerRef.current = setTimeout(()=> setStepIdx(i => Math.min(totalCount, i + 1)), dur);
      return ()=>{ if(timerRef.current){ clearTimeout(timerRef.current); timerRef.current=null; } };
    }, [stepIdx, playing]);

    // Keyboard nav
    useEffect(()=>{
      const onKey = (e)=>{
        if(e.key === 'ArrowRight' || e.key === ' '){ e.preventDefault(); setStepIdx(i => Math.min(totalCount, i+1)); setPlaying(false); }
        if(e.key === 'ArrowLeft'){ e.preventDefault(); setStepIdx(i => Math.max(-1, i-1)); setPlaying(false); }
        if(e.key === 'Escape'){ onClose(); }
      };
      window.addEventListener('keydown', onKey);
      return ()=> window.removeEventListener('keydown', onKey);
    }, []);

    if(!y) return null;

    // Текущие props для Star
    const af = currentStep?.af || (isOutro ? (tour.outro?.af || []) : []);
    const highlight = currentStep?.highlight || null;
    const accent = currentStep?.accent || tour.intro?.accent || '#a21caf';

    // Прогресс-точки
    const dots = [];
    for(let i = -1; i <= totalCount; i++){
      dots.push({ idx: i, active: i === stepIdx, completed: i < stepIdx });
    }

    return (
      <div style={{position:'fixed',inset:0,background:'radial-gradient(ellipse at top, #1a1a3a 0%, #08081a 60%, #050510 100%)',zIndex:200,display:'flex',flexDirection:'column',color:'#fff',fontFamily:'inherit',animation:'tourFadeIn .5s ease'}} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>

        {/* Top bar */}
        <div style={{padding:'14px 22px',display:'flex',alignItems:'center',gap:14,borderBottom:'1px solid rgba(255,255,255,.08)',flexShrink:0,background:'rgba(0,0,0,.25)',backdropFilter:'blur(10px)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,borderRadius:10,background:`linear-gradient(135deg,${accent},#3b82f6)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>✦</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,letterSpacing:.3}}>Гид по Ясне</div>
              <div style={{fontSize:11,opacity:.65,marginTop:1}}>{y.name}</div>
            </div>
          </div>

          {/* Прогресс-точки */}
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,minWidth:0,overflow:'hidden'}}>
            {dots.map((d,i)=>(
              <button key={i} onClick={()=>{ setStepIdx(d.idx); setPlaying(false); }}
                style={{padding:0,border:'none',background:'transparent',cursor:'pointer',height:8,
                       width: d.active ? 22 : 8,
                       borderRadius:4,
                       background: d.active ? 'linear-gradient(90deg,#60a5fa,#a21caf)' : (d.completed ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.18)'),
                       transition:'all .35s ease'}}
                title={d.idx===-1?'Вступление':d.idx===totalCount?'Завершение':`Шаг ${d.idx+1}: ${tour.steps[d.idx]?.title||''}`}/>
            ))}
          </div>

          <div style={{fontSize:12,opacity:.65,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>{displayPos} / {displayTotal}</div>
          <button onClick={onClose} style={{display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.16)',color:'#fff',padding:'7px 12px',borderRadius:14,fontSize:12,cursor:'pointer',fontWeight:500}}>{ICONS.close}<span style={{display:window.innerWidth<=600?'none':'inline'}}>Закрыть</span></button>
        </div>

        {/* Body — split layout (desktop) или stacked (mobile) */}
        <div style={{flex:1,display:'flex',minHeight:0,overflow:'hidden'}} className="tour-body">
          {/* Visualization area */}
          <div style={{flex:'1.4 1 0',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 20px',minWidth:0,position:'relative'}}>
            <div style={{width:'100%',maxWidth:680,aspectRatio:'900/700',background:'rgba(255,255,255,.02)',borderRadius:24,border:'1px solid rgba(255,255,255,.06)',overflow:'hidden',transition:'all .8s cubic-bezier(.4,0,.2,1)',boxShadow:'0 20px 60px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.05)'}}>
              <Star yy={y} sel={null} onSel={()=>{}} hl={highlight} af={af} showOpp={(af||[]).includes('opp')} overlay={null} mob={typeof window!=='undefined'&&window.innerWidth<=768}/>
            </div>

            {/* Floating mechanic-icon badge for current step */}
            {currentStep && currentStep.icon && ICONS[currentStep.icon] && (
              <div style={{position:'absolute',top:32,left:32,padding:'10px 14px',borderRadius:18,background:`linear-gradient(135deg,${accent}cc,${accent}88)`,backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,.2)',display:'flex',alignItems:'center',gap:8,boxShadow:'0 4px 16px rgba(0,0,0,.3)',animation:'badgeIn .5s ease'}} className="tour-badge">
                <span style={{display:'flex',alignItems:'center',color:'#fff'}}>{ICONS[currentStep.icon]}</span>
                <span style={{fontSize:13,fontWeight:700,letterSpacing:.3,color:'#fff'}}>Шаг {stepIdx+1}</span>
              </div>
            )}
          </div>

          {/* Side panel — content */}
          <div className="tour-panel" style={{flex:'1 1 0',maxWidth:480,padding:'30px 28px',overflowY:'auto',background:'rgba(0,0,0,.3)',borderLeft:'1px solid rgba(255,255,255,.08)',display:'flex',flexDirection:'column',justifyContent:'center'}}>
            {isIntro && (
              <div className="tour-card" style={{animation:'cardIn .55s cubic-bezier(.16,1,.3,1)'}}>
                <div style={{fontSize:11,letterSpacing:2,textTransform:'uppercase',opacity:.5,marginBottom:12}}>Вступление</div>
                <h1 style={{fontSize:34,fontWeight:800,lineHeight:1.15,marginBottom:12,letterSpacing:-.5}}>{tour.intro.title}</h1>
                <div style={{fontSize:15,opacity:.75,fontStyle:'italic',marginBottom:20,lineHeight:1.4}}>{tour.intro.subtitle}</div>
                <div style={{fontSize:14.5,lineHeight:1.65,opacity:.92,marginBottom:18}}>{tour.intro.lead}</div>
                {tour.source && (
                  <div style={{padding:'12px 14px',borderRadius:14,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',marginBottom:20}}>
                    <div style={{fontSize:10,letterSpacing:1.5,textTransform:'uppercase',opacity:.55,marginBottom:4}}>Источник</div>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{tour.source.ref}</div>
                    <div style={{fontSize:12,opacity:.7,lineHeight:1.4}}>{tour.source.desc}</div>
                  </div>
                )}
                {tour.intro.checkpoints && (
                  <div style={{marginTop:8}}>
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

            {isStep && currentStep && (
              <div className="tour-card" style={{animation:'cardIn .55s cubic-bezier(.16,1,.3,1)'}} key={stepIdx}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:42,height:42,borderRadius:14,background:`linear-gradient(135deg,${accent},${accent}99)`,color:'#fff',boxShadow:`0 4px 14px ${accent}66`}}>
                    {ICONS[currentStep.icon] || ICONS.sparkle}
                  </div>
                  <div>
                    <div style={{fontSize:11,letterSpacing:1.5,textTransform:'uppercase',opacity:.55}}>Шаг {stepIdx+1} · Механика</div>
                    <div style={{fontSize:11,opacity:.5}}>{stepIdx+1} из {totalCount}</div>
                  </div>
                </div>
                <h2 style={{fontSize:26,fontWeight:800,lineHeight:1.2,marginBottom:8,letterSpacing:-.3}}>{currentStep.title}</h2>
                <div style={{fontSize:14,opacity:.7,fontStyle:'italic',marginBottom:18,lineHeight:1.45}}>{currentStep.subtitle}</div>

                {currentStep.body && (
                  <div style={{fontSize:14,lineHeight:1.65,opacity:.92,marginBottom:16}}>{currentStep.body}</div>
                )}

                {currentStep.bullets && (
                  <ul style={{listStyle:'none',padding:0,margin:'12px 0 16px',display:'flex',flexDirection:'column',gap:8}}>
                    {currentStep.bullets.map((b,i)=>(
                      <li key={i} style={{fontSize:13.5,opacity:.88,display:'flex',gap:10,alignItems:'flex-start',lineHeight:1.5}}>
                        <span style={{flexShrink:0,width:6,height:6,borderRadius:'50%',background:accent,marginTop:8}}/>
                        <span dangerouslySetInnerHTML={{__html: b}}/>
                      </li>
                    ))}
                  </ul>
                )}

                {currentStep.insight && (
                  <div style={{padding:'14px 16px',borderRadius:14,background:`linear-gradient(135deg,${accent}22,${accent}11)`,border:`1px solid ${accent}44`,marginBottom:14}}>
                    <div style={{fontSize:10,letterSpacing:1.5,textTransform:'uppercase',color:accent,fontWeight:700,marginBottom:5,opacity:.95}}>Главное</div>
                    <div style={{fontSize:13.5,lineHeight:1.5,opacity:.95}}>{currentStep.insight}</div>
                  </div>
                )}

                {currentStep.hint && (
                  <div style={{fontSize:12,opacity:.55,fontStyle:'italic',display:'flex',gap:6,alignItems:'flex-start'}}>
                    <span>💡</span><span>{currentStep.hint}</span>
                  </div>
                )}
              </div>
            )}

            {isOutro && tour.outro && (
              <div className="tour-card" style={{animation:'cardIn .55s cubic-bezier(.16,1,.3,1)'}}>
                <div style={{fontSize:11,letterSpacing:2,textTransform:'uppercase',opacity:.5,marginBottom:12}}>Завершение</div>
                <h1 style={{fontSize:30,fontWeight:800,lineHeight:1.2,marginBottom:14,letterSpacing:-.3}}>{tour.outro.title}</h1>
                <div style={{fontSize:14.5,lineHeight:1.65,opacity:.92,marginBottom:20}}>{tour.outro.body}</div>
                {tour.outro.cta && (
                  <button onClick={()=>{ if(onLoadYasna) onLoadYasna(); onClose(); }} style={{padding:'14px 24px',borderRadius:18,border:'none',background:`linear-gradient(135deg,${accent},#3b82f6)`,color:'#fff',cursor:'pointer',fontSize:14,fontWeight:700,display:'flex',alignItems:'center',gap:8,boxShadow:`0 6px 22px ${accent}55`,transition:'transform .2s'}} onMouseDown={e=>e.currentTarget.style.transform='scale(.97)'} onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>{ICONS.check}<span>{tour.outro.cta}</span></button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom controls */}
        <div style={{padding:'14px 22px',background:'rgba(0,0,0,.4)',borderTop:'1px solid rgba(255,255,255,.08)',display:'flex',gap:10,alignItems:'center',flexShrink:0,backdropFilter:'blur(10px)'}}>
          <button disabled={isIntro} onClick={()=>{ setStepIdx(i=>Math.max(-1,i-1)); setPlaying(false); }} style={{padding:'10px 16px',borderRadius:14,border:'1px solid rgba(255,255,255,.18)',background:'rgba(255,255,255,.05)',color:'#fff',cursor:isIntro?'not-allowed':'pointer',opacity:isIntro?.35:1,fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>{ICONS.arrowLeft}<span>Назад</span></button>
          <button onClick={()=>setPlaying(p=>!p)} style={{padding:'10px 16px',borderRadius:14,border:'1px solid rgba(255,255,255,.18)',background:'rgba(255,255,255,.05)',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>{playing?ICONS.pause:ICONS.play}<span>{playing?'Пауза':'Авто'}</span></button>
          <div style={{flex:1,fontSize:11,opacity:.5,textAlign:'center'}}>
            <span style={{display:window.innerWidth<=600?'none':'inline'}}>Стрелки ← → или Пробел · Esc — закрыть</span>
          </div>
          {!isOutro && <button onClick={()=>{ setStepIdx(i=>Math.min(totalCount,i+1)); setPlaying(false); }} style={{padding:'10px 20px',borderRadius:14,border:'none',background:`linear-gradient(135deg,${accent},${accent}cc)`,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6,boxShadow:`0 4px 14px ${accent}44`}}><span>Дальше</span>{ICONS.arrowRight}</button>}
          {isOutro && tour.outro?.cta && <button onClick={()=>{ if(onLoadYasna) onLoadYasna(); onClose(); }} style={{padding:'10px 20px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#3b82f6,#a21caf)',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>{ICONS.check}<span>Перейти</span></button>}
        </div>

        {/* Animations */}
        <style>{`
          @keyframes tourFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes cardIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes badgeIn { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: scale(1); } }
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
