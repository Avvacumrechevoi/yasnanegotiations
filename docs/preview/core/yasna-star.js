// ═══════════════════════════════════════════════════════════════════
// YASNA CORE — Layer 1
// The interactive 12-position star, constants (CR/PR/REF/T/FL),
// Editor, Picker, Verification, Glossary. This is the product itself.
// Do not edit while editing lessons.
// ═══════════════════════════════════════════════════════════════════

const{useState,useMemo,useEffect,useRef,useCallback}=React;


// Data layer extracted to core/data.js — destructure здесь чтобы дальше код
// (Star, Info, Verification, Yasna3DView и т.д.) пользовался без префикса.
const {
  CR, PR, REF, T, FL,
  COMP, COMP_COLORS, COMP_NAMES,
  POS_DESC, CROSS_CTX, PRANA_CTX, OPP_DESC,
  GLOSS,
  gc, gp, opp, angDeg, rad, xy
} = window.YasnaData;

function Star({yy,sel,onSel,hl,af=[],showOpp,overlay,mob,drill,onDrill,subPolki,starRotation,rotationSpeed,showComposition}){
  const isMob=typeof window!=="undefined"&&window.innerWidth<=768;
  const p=yy.p||[];
  const S=900,W=700,cx=S/2,cy=W/2,R=isMob?215:280,nr=isMob?28:32,lr=(isMob?215:280)+(isMob?62:70);
  // ВРАЩЕНИЕ ЧЕРЕЗ ПЕРЕРЕНДЕР ПОЗИЦИЙ — Star обновляет угол через rAF на 60fps.
  // Округление до 0.5px — резко уменьшает sub-pixel re-rasterization текста
  // (на 0.5px шаге глиф закрепляется на той же raster-grid, не плавает).
  const [rotAngle, setRotAngle] = React.useState(0);
  const speedRef = React.useRef(rotationSpeed||24);
  React.useEffect(()=>{ speedRef.current = rotationSpeed||24; }, [rotationSpeed]);
  React.useEffect(()=>{
    if(!starRotation){ setRotAngle(0); return; }
    let raf, lastT = null;
    const animate = (now)=>{
      if(lastT === null) lastT = now;
      const dt = (now - lastT) / 1000;
      lastT = now;
      const dir = starRotation === 'cw' ? 1 : -1;
      setRotAngle(a => a + dir * (dt / Math.max(1, speedRef.current)) * 360);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return ()=> cancelAnimationFrame(raf);
  }, [starRotation]);
  // xy с поворотом + snap к 0.5px sub-grid — глифы стабильно прицепляются к одной
  // raster-сетке, текст перестаёт "плыть"
  const xyRot = (i, c1, c2, r) => {
    const deg = angDeg(i) - rotAngle;
    const x = c1 + r*Math.cos(rad(deg));
    const y = c2 - r*Math.sin(rad(deg));
    return { x: Math.round(x*2)/2, y: Math.round(y*2)/2 };
  };
  const pts = Array.from({length:12},(_,i)=>xyRot(i,cx,cy,R))
  const lps = Array.from({length:12},(_,i)=>xyRot(i,cx,cy,lr))
  // При вращении подписи отодвигаем дальше — иначе наезжают на полки при динамичных переходах
  const lpsRot = Array.from({length:12},(_,i)=>xyRot(i,cx,cy,lr+(isMob?15:32)))
  const olps = Array.from({length:12},(_,i)=>xyRot(i,cx,cy,lr+24))
  const ilps = Array.from({length:12},(_,i)=>xyRot(i,cx,cy,lr-16))
  // Static (без rotation) — для wrap-g механик: error89, scorpio_spider, mobius
  const staticPts = Array.from({length:12},(_,i)=>xy(i,cx,cy,R))
  const hasMech=af.length>0;
  const nc=i=>(hl&&!hl.includes(i))?'#e0e0e8':CR[gc(i)].c;
  const no=i=>(hl&&!hl.includes(i))?.15:1;
  const anch=i=>{const x=lps[i].x;return Math.abs(x-cx)<25?'middle':x<cx?'end':'start';};
  return(
    <svg viewBox={mob?`40 -10 820 720`:`-80 -50 1060 800`} preserveAspectRatio="xMidYMid meet" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <filter id="gw"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="ns"><feDropShadow dx="0" dy="1" stdDeviation="2.5" floodOpacity=".07"/></filter>
      </defs>
      <rect x="-80" y="-50" width="1060" height="800" fill="#fff"/>
      <g className="yasna-wheel">
      {/* Decorative outer ring */}
      <circle cx={cx} cy={cy} r={R+10} fill="none" stroke="#ececee" strokeWidth=".5"/>
      {/* Main orbit */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#d0d0d5" strokeWidth="1.2"/>
      {/* Inner orbits - hidden when mechanics active */}
      {!hasMech&&<><circle cx={cx} cy={cy} r={R*.7} fill="none" stroke="#e4e4e8" strokeWidth=".7"/>
      <circle cx={cx} cy={cy} r={R*.4} fill="none" stroke="#eee" strokeWidth=".5"/></>}
      {/* Hexagon of LONG positions 0-2-4-6-8-10 */}
      {!hasMech&&<polygon points={[0,2,4,6,8,10].map(i=>`${pts[i].x},${pts[i].y}`).join(' ')} fill="none" stroke="#d8d8dd" strokeWidth=".8"/>}
      {/* Hexagram of SHORT positions 1-3-5-7-9-11 */}
      {!hasMech&&<polygon points={[1,3,5,7,9,11].map(i=>`${pts[i].x},${pts[i].y}`).join(' ')} fill="none" stroke="#d8d8dd" strokeWidth=".8"/>}
      {/* 12 rays from center - hidden when mechanics active */}
      {!hasMech&&Array.from({length:12},(_,i)=>{const s=[0,3,6,9].includes(i);return<line key={`ry${i}`} x1={cx} y1={cy} x2={pts[i].x} y2={pts[i].y} stroke={s?'#c0c0c5':'#d8d8dd'} strokeWidth={s?.9:.4}/>;})}
      {/* Crossbars and ticks - hidden when mechanics active */}
      {!hasMech&&[0,3,6,9].map(i=>{const t=pts[i],a=rad(angDeg(i)+90),bw=17;return<line key={`cb${i}`} x1={t.x+bw*Math.cos(a)} y1={t.y-bw*Math.sin(a)} x2={t.x-bw*Math.cos(a)} y2={t.y+bw*Math.sin(a)} stroke="#b8b8be" strokeWidth="1.2" strokeLinecap="round"/>;})}
      {!hasMech&&[1,2,4,5,7,8,10,11].map(i=>{const t=pts[i],a=rad(angDeg(i)+60),tw=11;return<line key={`tk${i}`} x1={t.x+tw*Math.cos(a)} y1={t.y-tw*Math.sin(a)} x2={t.x-tw*Math.cos(a)} y2={t.y+tw*Math.sin(a)} stroke="#c8c8cd" strokeWidth=".7" strokeLinecap="round"/>;})}
      {af.includes('halves')&&(yy.th||yy.bh)&&<line x1={pts[3].x} y1={pts[3].y} x2={pts[9].x} y2={pts[9].y} stroke="#d2d2d7" strokeWidth="1" strokeDasharray="8 4" opacity=".6"/>}
      {af.includes('halves')&&(yy.lh||yy.rh)&&<line x1={pts[0].x} y1={pts[0].y} x2={pts[6].x} y2={pts[6].y} stroke="#d2d2d7" strokeWidth="1" strokeDasharray="8 4" opacity=".6"/>}
      
      {showOpp&&Array.from({length:6},(_,i)=><g key={`o${i}`}><line x1={pts[i].x} y1={pts[i].y} x2={pts[i+6].x} y2={pts[i+6].y} stroke="#ea580c" strokeWidth="1.8" opacity=".55" strokeDasharray="6 4" strokeLinecap="round"/><circle cx={(pts[i].x+pts[i+6].x)/2} cy={(pts[i].y+pts[i+6].y)/2} r="3.5" fill="#ea580c" opacity=".7"/></g>)}
      {/* Rhythm: 4 triples Вера→Бой→Победа */}
      {af.includes('rhythm')&&[[2,3,4],[5,6,7],[8,9,10],[11,0,1]].map((tr,ti)=>{
        const col='#30A060';const d=tr.map((idx,j)=>`${j===0?'M':'L'}${pts[idx].x},${pts[idx].y}`).join(' ');
        return<g key={`rh${ti}`}>
          <path d={d} fill="none" stroke={col} strokeWidth="3.5" opacity=".7" strokeLinecap="round"/>
          <circle cx={pts[tr[1]].x} cy={pts[tr[1]].y} r={nr+6} fill={col} opacity=".12"/>
          {tr.map((idx,j)=><text key={j} x={pts[idx].x} y={pts[idx].y-nr-6} textAnchor="middle" fill={col} fontSize="12" fontWeight="800" opacity=".9" style={{pointerEvents:'none'}}>{['В','Б','П'][j]}</text>)}
        </g>;
      })}
      {/* Three arcs: ФО→ЦИ→ХА→ШЭ→ФО */}
      {af.includes('arcs')&&[[1,2,3,4,5],[5,6,7,8,9],[9,10,11,0,1]].map((arc,ai)=>{
        const cols=['#4090D8','#9060D0','#30A060'];const col=cols[ai];
        const d=arc.map((idx,j)=>{const p=pts[idx];return`${j===0?'M':'L'}${p.x},${p.y}`;}).join(' ');
        return<path key={`arc${ai}`} d={d} fill="none" stroke={col} strokeWidth="4" opacity=".6" strokeLinecap="round"/>;
      })}
      {/* Halves */}
      {af.includes('halves')&&(()=>{
        // Halves теперь рендерятся через wrap-g с rotate-transform.
        // Path-d вычисляются от статичных позиций (cx-R, cy) и т.п.,
        // а rotation применяется ОДНИМ атрибутом на wrap <g>. iOS Safari не
        // пересоздаёт растровый кеш path при изменении только transform на родителе.
        // Плюс: подписи внутри wrap тоже rotate'ятся, но мы хотим чтобы они
        // оставались upright — counter-rotate обратно через inner <g>.
        // Полки в xyRot используют (angDeg - rotAngle), что в SVG y-down даёт CW визуально
        // для положительного rotAngle. SVG rotate(positive) тоже CW. Без инверсии.
        return<g transform={`rotate(${rotAngle.toFixed(2)},${cx},${cy})`}>
          {/* Top: Чаша Света — arc от static(cx-R,cy) до static(cx+R,cy) через верх */}
          <path d={`M${cx-R},${cy} A${R},${R} 0 0,0 ${cx+R},${cy}`} fill="rgba(255,180,0,.08)" stroke="rgba(200,150,0,.45)" strokeWidth="2.5"/>
          {/* Bottom: Чаша Тьмы — arc от static(cx+R,cy) до static(cx-R,cy) через низ */}
          <path d={`M${cx+R},${cy} A${R},${R} 0 0,0 ${cx-R},${cy}`} fill="rgba(80,100,200,.08)" stroke="rgba(80,100,200,.4)" strokeWidth="2.5"/>
          {/* Left/Right: Нарастание — arc от static(cx,cy+R) до static(cx,cy-R) через лево */}
          <path d={`M${cx},${cy+R} A${R},${R} 0 0,0 ${cx},${cy-R}`} fill="rgba(40,180,100,.05)" stroke="rgba(40,160,90,.25)" strokeWidth="1.2"/>
          <path d={`M${cx},${cy-R} A${R},${R} 0 0,0 ${cx},${cy+R}`} fill="rgba(180,80,180,.05)" stroke="rgba(160,70,160,.25)" strokeWidth="1.2"/>
          {/* Axes — статичные линии */}
          <line x1={cx-R} y1={cy} x2={cx+R} y2={cy} stroke="#86868b" strokeWidth="1" strokeDasharray="6 4" opacity=".25"/>
          <line x1={cx} y1={cy-R} x2={cx} y2={cy+R} stroke="#86868b" strokeWidth="1" strokeDasharray="6 4" opacity=".25"/>
          {/* Подписи: counter-rotate чтобы оставались upright при вращении wrap-g */}
          <g transform={`rotate(${(-rotAngle).toFixed(2)},${cx},${cy-R*.5})`}><text x={cx} y={cy-R*.5} textAnchor="middle" fill="rgba(170,130,0,.6)" fontSize="11" fontFamily="var(--sans)" fontWeight="600">Чаша Света</text></g>
          <g transform={`rotate(${(-rotAngle).toFixed(2)},${cx},${cy+R*.55})`}><text x={cx} y={cy+R*.55} textAnchor="middle" fill="rgba(70,80,170,.5)" fontSize="11" fontFamily="var(--sans)" fontWeight="600">Чаша Тьмы</text></g>
          <g transform={`rotate(${(-rotAngle).toFixed(2)},${cx-R*.5},${cy})`}><text x={cx-R*.5} y={cy+6} textAnchor="middle" fill="rgba(40,140,80,.45)" fontSize="10" fontFamily="var(--sans)" fontWeight="500" transform={`rotate(-90 ${cx-R*.5} ${cy})`}>Нарастание ↑</text></g>
          <g transform={`rotate(${(-rotAngle).toFixed(2)},${cx+R*.5},${cy})`}><text x={cx+R*.5} y={cy+6} textAnchor="middle" fill="rgba(140,60,140,.4)" fontSize="10" fontFamily="var(--sans)" fontWeight="500" transform={`rotate(90 ${cx+R*.5} ${cy})`}>Спад ↓</text></g>
        </g>;
      })()}
      {/* Error 8↔9: zone of confusion. Wrap-g + static d — корректно вращается без re-raster */}
      {af.includes('error89')&&(()=>{
        const sp=staticPts;
        return<g transform={`rotate(${rotAngle.toFixed(2)},${cx},${cy})`}>
          {/* Primary zone 8↔9 */}
          <path d={`M${sp[8].x},${sp[8].y} A${R},${R} 0 0,1 ${sp[9].x},${sp[9].y}`} fill="rgba(217,70,239,.06)" stroke="#D946EF" strokeWidth="4" strokeDasharray="8 4"/>
          <line x1={sp[8].x} y1={sp[8].y} x2={sp[9].x} y2={sp[9].y} stroke="#D946EF" strokeWidth="3" opacity=".5" strokeDasharray="6 4"/>
          {/* Mirror zone 2↔3 */}
          <path d={`M${sp[2].x},${sp[2].y} A${R},${R} 0 0,0 ${sp[3].x},${sp[3].y}`} fill="rgba(217,70,239,.03)" stroke="#D946EF" strokeWidth="2.5" strokeDasharray="6 4" opacity=".6"/>
          <line x1={sp[2].x} y1={sp[2].y} x2={sp[3].x} y2={sp[3].y} stroke="#D946EF" strokeWidth="2" opacity=".4" strokeDasharray="6 4"/>
          {/* 4 error types: counter-rotate чтобы оставались upright */}
          {[[0,'Ошибка во сне',0,nr+30],[3,'Просмотрел',(sp[2].x-sp[3].x)/2-70,(sp[2].y-sp[3].y)/2-12],[6,'Мираж',0,-nr-22],[9,'Ошибка измерения',(sp[8].x-sp[9].x)/2+70,(sp[8].y-sp[9].y)/2-12]].map(([idx,label,dx,dy])=>{
            const p=sp[idx];
            const tx=p.x+dx, ty=p.y+dy;
            return<g key={`e${idx}`} transform={`rotate(${(-rotAngle).toFixed(2)},${tx},${ty})`}><text x={tx} y={ty} textAnchor="middle" fill="#D946EF" fontSize="10" fontWeight="700" fontFamily="var(--sans)" opacity=".85" style={{pointerEvents:'none'}}>{label}</text></g>;
          })}
          {/* Connection line 8↔9 → 2↔3 */}
          <line x1={(sp[8].x+sp[9].x)/2} y1={(sp[8].y+sp[9].y)/2} x2={(sp[2].x+sp[3].x)/2} y2={(sp[2].y+sp[3].y)/2} stroke="#D946EF" strokeWidth="1.5" opacity=".25" strokeDasharray="4 6"/>
        </g>;
      })()}

      {/* M-К-005 Зодиак: знаки рендерятся НА полке (вместо цифры) — см. код полок ниже. */}

      {/* M-Ж-118 Скорпион↔Паук — wrap-g + static d, плавно вращается с колесом */}
      {af.includes('mb_scorpio_spider')&&(()=>{
        const sp=staticPts;
        const cr=`${(-rotAngle).toFixed(2)}`; // counter-rotation для подписей
        return<g transform={`rotate(${rotAngle.toFixed(2)},${cx},${cy})`}>
          <path d={`M${sp[3].x},${sp[3].y} A${R},${R} 0 0,1 ${sp[9].x},${sp[9].y} L${sp[3].x},${sp[3].y} Z`}
                fill="rgba(37,99,235,.08)" stroke="rgba(37,99,235,.4)" strokeWidth="1.2" strokeDasharray="6 4"/>
          {/* Подписи top: counter-rotate индивидуально вокруг своего якоря */}
          <g transform={`rotate(${cr},${cx},${cy-90})`}><text x={cx} y={cy-90} textAnchor="middle" fontSize="14" fill="#1d4ed8" fontWeight="700" stroke="#fff" strokeWidth="3" paintOrder="stroke">Головной Паук · Сам</text></g>
          <g transform={`rotate(${cr},${cx},${cy-72})`}><text x={cx} y={cy-72} textAnchor="middle" fontSize="11" fill="#1e3a8a" opacity=".85" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">верх · идея · мозг</text></g>
          <path d={`M${sp[3].x},${sp[3].y} A${R},${R} 0 0,0 ${sp[9].x},${sp[9].y} L${sp[3].x},${sp[3].y} Z`}
                fill="rgba(220,38,38,.08)" stroke="rgba(220,38,38,.4)" strokeWidth="1.2" strokeDasharray="6 4"/>
          <g transform={`rotate(${cr},${cx},${cy+72})`}><text x={cx} y={cy+72} textAnchor="middle" fontSize="14" fill="#b91c1c" fontWeight="700" stroke="#fff" strokeWidth="3" paintOrder="stroke">Грудной Скорпион · Особа</text></g>
          <g transform={`rotate(${cr},${cx},${cy+90})`}><text x={cx} y={cy+90} textAnchor="middle" fontSize="11" fill="#7f1d1d" opacity=".85" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">низ · тело · импульс</text></g>
          <line x1={sp[3].x-26} y1={sp[3].y} x2={sp[9].x+26} y2={sp[9].y} stroke="#7c2d12" strokeWidth="2" strokeDasharray="3 4" opacity=".55"/>
          {/* ПОЛЕ БОЯ rect+text — counter-rotate */}
          <g transform={`rotate(${cr},${cx},${cy})`}>
            <rect x={cx-78} y={cy-12} width="156" height="24" rx="12" fill="#fff" stroke="#7c2d12" strokeWidth="1.4"/>
            <text x={cx} y={cy+5} textAnchor="middle" fontSize="11" fill="#7c2d12" fontWeight="700" letterSpacing="1.5">↑ ПОЛЕ БОЯ ↓</text>
          </g>
        </g>;
      })()}

      {/* M-Г-050 Лента Мёбиуса — wrap-g + static d, орбитирует с полкой 0 */}
      {af.includes('mb_mobius')&&(()=>{
        const sp=staticPts;
        const infY=cy+R-25;
        return<g transform={`rotate(${rotAngle.toFixed(2)},${cx},${cy})`}>
          <path d={`M${sp[11].x},${sp[11].y} A${R},${R} 0 0,1 ${sp[1].x},${sp[1].y}`}
                fill="none" stroke="#0891b2" strokeWidth="4" strokeLinecap="round" opacity=".75"/>
          <path d={`M${sp[11].x},${sp[11].y} A${R},${R} 0 0,1 ${sp[1].x},${sp[1].y}`}
                fill="none" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="6 6" opacity=".9"
                style={{animation:'dashFlow 3s linear infinite'}}/>
          {/* ∞ counter-rotate чтобы оставался upright */}
          <g transform={`rotate(${(-rotAngle).toFixed(2)},${cx},${infY})`}>
            <text x={cx} y={infY} textAnchor="middle" fontSize="18" fill="#0891b2" fontWeight="700"
                  stroke="#fff" strokeWidth="4" paintOrder="stroke" style={{pointerEvents:'none'}}>∞</text>
          </g>
        </g>;
      })()}

      {/* M-К-007 Накопление→Переход: длинные копят, короткие — точки перелива */}
      {af.includes('mb_accumulation')&&(()=>{
        return<g>
          <defs><marker id="acc-arr-pv" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#16a34a"/></marker></defs>
          {[0,3,6,9].map(i=>{const p=pts[i];const np1=pts[(i+1)%12];const np2=pts[(i+11)%12];
            return<g key={`acc${i}`}>
              <circle cx={p.x} cy={p.y} r="42" fill="rgba(22,163,74,.16)" stroke="#16a34a" strokeWidth="1.6" strokeDasharray="3 3"/>
              <circle cx={p.x} cy={p.y} r="62" fill="none" stroke="#16a34a" strokeWidth=".8" opacity=".4"/>
              <line x1={p.x} y1={p.y} x2={np1.x} y2={np1.y} stroke="#16a34a" strokeWidth="2" markerEnd="url(#acc-arr-pv)" opacity=".7" strokeDasharray="4 3"/>
              <line x1={p.x} y1={p.y} x2={np2.x} y2={np2.y} stroke="#16a34a" strokeWidth="2" markerEnd="url(#acc-arr-pv)" opacity=".7" strokeDasharray="4 3"/>
            </g>;})}
        </g>;
      })()}

      {/* M-Г-066 Ясна² (144 Полки): вокруг каждой полки — мини-кольцо из 12 точек.
         12 главных × 12 вложенных = 144 ячейки. Источник: Ясна Года узел 9. */}
      {af.includes('mb_yasna2')&&(()=>{
        const subR = nr + 14;
        // Перформанс: при вращении 144 микро-точки дают огромную нагрузку на React
        // reconciliation (SVG re-render всех cx/cy 60 раз в сек). Скрываем точки во
        // время вращения, оставляем только 12 dashed-rings — визуальный маркер сохраняется
        const showMicro = !starRotation;
        return<g>
          {pts.map((p,i)=>(
            <g key={`y2_${i}`}>
              <circle cx={p.x} cy={p.y} r={subR+2} fill="none" stroke="#a21caf" strokeWidth=".9" strokeDasharray="2 3" opacity=".55"/>
              {showMicro&&Array.from({length:12},(_,j)=>{
                const a=(270-j*30)*Math.PI/180;
                const sx=p.x+subR*Math.cos(a);
                const sy=p.y-subR*Math.sin(a);
                return <circle key={j} cx={sx} cy={sy} r="2.2" fill="#a21caf" opacity=".7"/>;
              })}
            </g>
          ))}
          {/* Подпись по центру (если ПОЛЕ БОЯ Скорпиона не активно — иначе уйдёт ниже) */}
          {!af.includes('mb_scorpio_spider')&&<>
            <text x={cx} y={cy-6} textAnchor="middle" fontSize="14" fontWeight="700" fill="#a21caf"
                  stroke="#fff" strokeWidth="3.5" paintOrder="stroke">Ясна² = 144</text>
            <text x={cx} y={cy+12} textAnchor="middle" fontSize="10.5" fill="#86198f"
                  stroke="#fff" strokeWidth="2.5" paintOrder="stroke">12 × 12 — каждая Полка раскрывается в свою Ясну</text>
          </>}
        </g>;
      })()}

      {/* Opposition line на выбранной полке — только при активной механике "opp" */}
      {sel!==null && af.includes('opp') && <line x1={pts[sel].x} y1={pts[sel].y} x2={pts[opp(sel)].x} y2={pts[opp(sel)].y} stroke="#ea580c" strokeWidth="2.2" opacity=".75" strokeDasharray="6 4" strokeLinecap="round"/>}
      {/* Multi-mechanic layers */}
      {(()=>{const activeLayers=af.filter(id=>!['opp','axes'].includes(id)).length;
        const opaScale=activeLayers<=1?1:activeLayers<=2?.85:activeLayers<=4?.7:.55;
        return af.filter(id=>!['opp','axes'].includes(id)).map(id=>{const f=FL.find(x=>x.id===id);if(!f||!f.p)return null;
        const isCross=f.p.length===4;
        const d=f.p.map((idx,j)=>`${j===0?'M':'L'}${pts[idx].x},${pts[idx].y}`).join(' ')+'Z';
        return(<g key={id}>
          <path d={d} fill={f.c+'06'} stroke={f.c} strokeWidth={['she','fo','tsi','ha'].includes(id)?2.5:1.8} opacity={.4*opaScale} strokeDasharray={id==='she'?'none':id==='fo'?'8 4':id==='tsi'?'4 4':id==='ha'?'12 3 3 3':'none'} strokeLinecap="round"/>
          {isCross&&<><line x1={pts[f.p[0]].x} y1={pts[f.p[0]].y} x2={pts[f.p[2]].x} y2={pts[f.p[2]].y} stroke={f.c} strokeWidth="1.2" opacity={.2*opaScale} strokeDasharray="6 4"/>
          <line x1={pts[f.p[1]].x} y1={pts[f.p[1]].y} x2={pts[f.p[3]].x} y2={pts[f.p[3]].y} stroke={f.c} strokeWidth="1.2" opacity={.2*opaScale} strokeDasharray="6 4"/></>}
          {f.p.map(idx=><g key={idx}>
            <circle cx={pts[idx].x} cy={pts[idx].y} r={nr+6} fill={f.c} opacity={.06*opaScale}/>
            {['she','fo','tsi','ha'].includes(id)&&<circle cx={pts[idx].x} cy={pts[idx].y} r={nr+4} fill="none" stroke={f.c} strokeWidth=".8" opacity={.2*opaScale} strokeDasharray="3 5" style={{animation:'dashFlow 3s linear infinite'}}/>}
          </g>)}
        </g>);});})()}
      
      {/* Центр Звезды освобождён — название Ясны дублирует хедер. Здесь рабочая зона для overlay-механик (Поле Боя, ∞ и т.д.). */}
      {af.includes('halves')&&yy.th&&<text x={cx} y={34} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600">{yy.th}</text>}
      {af.includes('halves')&&yy.bh&&<text x={cx} y={W-22} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600">{yy.bh}</text>}
      {af.includes('halves')&&yy.lh&&<text x={20} y={cy} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600" transform={`rotate(-90 20 ${cy})`}>{yy.lh}</text>}
      {af.includes('halves')&&yy.rh&&<text x={S-20} y={cy} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600" transform={`rotate(90 ${S-20} ${cy})`}>{yy.rh}</text>}
      {/* Composition — мини-пироги внутри круга при showComposition */}
      {showComposition && pts.map((pt,i)=>{
        const r=COMP[i]; const total=100;
        // Pie center: между центром и Полкой на радиусе 0.62R
        const dx=(pt.x-cx)/R, dy=(pt.y-cy)/R;
        const px=Math.round((cx+dx*R*0.62)*2)/2;
        const py=Math.round((cy+dy*R*0.62)*2)/2;
        const pr=26;        // радиус пирога
        const ph=pr*0.46;   // дырка по центру (donut hole)
        const dim = hl&&!hl.includes(i)?.18:1;
        let aStart=-Math.PI/2; // старт сверху
        const segs=r.map((pct,j)=>{
          const aSeg=(pct/total)*2*Math.PI;
          const x1=px+pr*Math.cos(aStart), y1=py+pr*Math.sin(aStart);
          const aEnd=aStart+aSeg;
          const x2=px+pr*Math.cos(aEnd), y2=py+pr*Math.sin(aEnd);
          const large=aSeg>Math.PI?1:0;
          const d=`M ${px} ${py} L ${x1} ${y1} A ${pr} ${pr} 0 ${large} 1 ${x2} ${y2} Z`;
          const seg=<path key={j} d={d} fill={COMP_COLORS[j]} stroke="#fff" strokeWidth="1.5" opacity={pct>=50?1:.85}>
            <title>{`${COMP_NAMES[j]}: ${pct}%`}</title>
          </path>;
          aStart=aEnd;
          return seg;
        });
        // Find dominant prana for label color
        const maxIdx=r.indexOf(Math.max(...r));
        return <g key={`comp${i}`} style={{pointerEvents:'none',opacity:dim,transition:'opacity .25s'}}>
          {segs}
          {/* центральный круг (donut hole) */}
          <circle cx={px} cy={py} r={ph} fill="#fff" stroke="rgba(0,0,0,.08)" strokeWidth=".8"/>
          {/* номер Полки в центре пирога */}
          <text x={px} y={py+1.5} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill={COMP_COLORS[maxIdx]} fontFamily="var(--sans)">{i}</text>
          {/* доминирующая прана % под номером */}
          <text x={px} y={py+ph+8} textAnchor="middle" fontSize="9" fontWeight="600" fill={COMP_COLORS[maxIdx]} fontFamily="var(--sans)">{r[maxIdx]}%</text>
        </g>;
      })}
      {pts.map((pt,i)=>{const isSel=sel===i,c=nc(i),o=no(i);const lbl=p[i]||'';const tipText=lbl?`Полка ${i}: ${lbl}`:`Полка ${i}`;return(
        <g key={i} onClick={()=>{if(af.includes('mb_yasna2')&&drill==null&&onDrill){onDrill(i);}else{onSel(sel===i?null:i);}}} style={{cursor:'pointer'}}>
          <title>{tipText}</title>
          <circle cx={pt.x} cy={pt.y} r={nr+14} fill="transparent" stroke="none"/>
          {isSel&&<circle cx={pt.x} cy={pt.y} r={nr+10} fill={c} opacity=".14" filter="url(#gw)"/>}
          {isSel&&<circle cx={pt.x} cy={pt.y} r={nr+6} fill='none' stroke={c} strokeWidth="1.6" opacity=".55"/>}
          <circle cx={pt.x} cy={pt.y} r={isSel?nr+3:nr} fill="#fff" stroke={c} strokeWidth={isSel?4:2.2} opacity={o} filter={isSel?"url(#gw)":"url(#ns)"} style={{pointerEvents:'none',transition:'r 180ms ease, stroke-width 180ms ease'}}/>
          <text x={pt.x} y={pt.y+(af.includes('mb_zodiac')?7:6)} textAnchor="middle" fill={af.includes('mb_zodiac')?'#7c3aed':(hl&&!hl.includes(i))?'#c0c0c5':'#1f2937'} fontSize={af.includes('mb_zodiac')?(isMob?(isSel?"24":"22"):(isSel?"32":"30")):(isMob?(isSel?"22":"20"):(isSel?"30":"28"))} fontWeight={af.includes('mb_zodiac')?"600":"700"} fontFamily="var(--sans)" opacity={o} style={{pointerEvents:'none'}}>{af.includes('mb_zodiac')?['♑','♒','♓','♈','♉','♊','♋','♌','♍','♎','♏','♐'][i]:i}</text>
        </g>);})}
      {!overlay&&(starRotation?lpsRot:lps).map((pt,i)=>{const lOrig=p[i]||'';if(!lOrig)return null;let dy=5;if(!starRotation){if(i===0)dy=16;if(i===6)dy=-7;}
        // Trim incomplete trailing tokens (e.g. '("кита' or '(без свинст') — likely data-import artifacts
        let l=lOrig.replace(/\s*\([^)]*$/,'').replace(/\s*\/\s*$/,'').trim();
        // Cap each line to fit the canvas
        const maxLine=isMob?14:18;
        let parts=null;
        if(l.includes(' ')){const w=l.split(' ');const m=Math.ceil(w.length/2);parts=[w.slice(0,m).join(' '),w.slice(m).join(' ')];}
        else if(l.includes('-')&&l.length>10){const hi=l.indexOf('-');parts=[l.slice(0,hi+1),l.slice(hi+1)];}
        else if(l.includes('/')&&l.length>10){const si=l.indexOf('/');parts=[l.slice(0,si+1),l.slice(si+1).trim()];}
        else if(l.length>12){const m=Math.ceil(l.length/2);parts=[l.slice(0,m)+'-',l.slice(m)];}
        if(parts){parts=parts.map(s=>s.length>maxLine?s.slice(0,maxLine-1).trimEnd()+'…':s);}
        else if(l.length>maxLine)l=l.slice(0,maxLine-1).trimEnd()+'…';
        // Во время вращения per-index offsets дают резкие скачки (они спроектированы
        // под статичный layout). Используем единый layout — middle anchor, без xOff,
        // базовый dy. Лейблы плавно орбитируют вместе с полками.
        const isRotating = !!starRotation;
        const xOff = isRotating ? 0 : (i===3?14:i===9?-14:i===4?8:i===8?-8:0);
        const dyEff = isRotating ? 5 : dy;
        const anchEff = isRotating ? 'middle' : anch(i);
        const fs=isMob?(sel===i?'24':'22'):(sel===i?'26':'24'); // desktop +1.18× после расширения viewBox
        const fsW=isMob?(sel===i?'24':'22'):(sel===i?'26':'24');if(parts){return<text key={`l${i}`} x={pt.x+xOff} y={pt.y+dyEff-9} textAnchor={anchEff} fill={'#000'} fontSize={fsW} fontFamily="var(--serif)" fontWeight={sel===i?'700':'600'} style={{pointerEvents:'none'}}><tspan x={pt.x+xOff} dy="0">{parts[0]}</tspan><tspan x={pt.x+xOff} dy={isMob?22:22}>{parts[1]}</tspan></text>;}
        return<text key={`l${i}`} x={pt.x+xOff} y={pt.y+dyEff} textAnchor={anchEff} fill={'#000'} fontSize={fs} fontFamily="var(--serif)" fontWeight={sel===i?'700':'600'} style={{pointerEvents:'none'}}>{l}</text>;})}
      {overlay&&<>
        {/* Outer orbit - more visible, solid thin line */}
        <circle cx={cx} cy={cy} r={lr+12} fill="none" stroke="rgba(147,51,234,.18)" strokeWidth="1" strokeDasharray="2 4"/>
        {/* Satellite dots on outer orbit showing overlay structure */}
        {Array.from({length:12},(_,i)=>{const op=xy(i,cx,cy,lr+12);return<circle key={`os${i}`} cx={op.x} cy={op.y} r="3" fill={sel===i?'#7c3aed':'#9333ea'} opacity={sel===i?.9:.5}/>;})}
        {/* Thin connector lines between inner point and outer satellite */}
        {Array.from({length:12},(_,i)=>{const op=xy(i,cx,cy,lr+12);return<line key={`oc${i}`} x1={pts[i].x} y1={pts[i].y} x2={op.x} y2={op.y} stroke="rgba(147,51,234,.15)" strokeWidth="1" strokeDasharray="2 3"/>;})}
        {/* Primary Yasna labels - inner ring */}
        {ilps.map((pt,i)=>{const l=p[i]||'';if(!l)return null;const a=angDeg(i);let dy=4;if(!starRotation){if(i===0)dy=12;if(i===6)dy=-5;}return<text key={`p${i}`} x={pt.x} y={pt.y+dy} textAnchor={starRotation?'middle':anch(i)} fill={sel===i?'#1d1d1f':'rgba(0,122,255,.8)'} fontSize={sel===i?"16":"14"} fontFamily="var(--serif)" fontWeight={sel===i?'700':'500'} style={{pointerEvents:'none'}}>{l}</text>;})}
        {/* Overlay Yasna labels - outer ring */}
        {olps.map((pt,i)=>{const l=(overlay.p||[])[i]||'';if(!l)return null;let dy=22;if(!starRotation){if(i===0)dy=34;if(i===6)dy=-22;if([3,9].includes(i))dy=26;if([2,10].includes(i))dy=26;if([4,8].includes(i))dy=34;if([1,11].includes(i))dy=28;if([5,7].includes(i))dy=24;}return<text key={`o${i}`} x={pt.x} y={pt.y+dy} textAnchor={starRotation?'middle':anch(i)} fill={sel===i?'#7c3aed':'#9333ea'} fontSize={sel===i?"17":"15"} fontFamily="var(--serif)" fontWeight={sel===i?'700':'500'} fontStyle="italic" style={{pointerEvents:'none'}}>{l}</text>;})}
      </>}
      {/* M-Г-066 Ясна² Drill-down: клик по полке открывает её внутреннюю Ясну */}
      {drill!=null&&(()=>{
        const dCol='#a21caf';
        // Карточка занимает почти весь viewBox 900×700
        const cardX=10, cardY=8, cardW=S-20, cardH=W-16;
        // Центрируем sub-Ясну между низом шапки (cardY+135) и низом карточки
        const subCenterY=Math.round((cardY+135+cardY+cardH-20)/2);
        // Размеры подобраны так, чтобы длинные подписи (subLr+labelWidth) умещались внутри карточки cardX..cardX+cardW
        const subR=isMob?170:200;
        const subNr=isMob?28:32;
        const subLr=subR+(isMob?52:58);
        const SUB_PRANA_COLOR=['#C0943A','#4090D8','#06B6D4','#F06838','#C0943A','#4090D8','#06B6D4','#F06838','#C0943A','#4090D8','#06B6D4','#F06838'];
        return<g className="drill-popup" style={{animation:'drillPopup .42s cubic-bezier(.16,1,.3,1)',transformOrigin:`${cx}px ${cy}px`}}>
          {/* Карточка-попап — занимает почти весь viewBox, без backdrop */}
          <rect x={cardX} y={cardY} width={cardW} height={cardH} rx="24" ry="24"
                fill="#ffffff" stroke="rgba(162,28,175,.22)" strokeWidth="2"
                style={{filter:'drop-shadow(0 24px 56px rgba(15,23,42,.32))'}}
                />
          {/* Декоративная верхняя полоса с градиентом */}
          <defs>
            <linearGradient id="drillHdrGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fdf4ff"/>
              <stop offset="0.5" stopColor="#ede1f8"/>
              <stop offset="1" stopColor="#fdf4ff"/>
            </linearGradient>
          </defs>
          <path d={`M ${cardX} ${cardY+24} A 24 24 0 0 1 ${cardX+24} ${cardY} L ${cardX+cardW-24} ${cardY} A 24 24 0 0 1 ${cardX+cardW} ${cardY+24} L ${cardX+cardW} ${cardY+92} L ${cardX} ${cardY+92} Z`} fill="url(#drillHdrGrad)"/>
          {/* Бэйдж */}
          <rect x={cx-100} y={cardY+22} width="200" height="26" rx="13" fill="#a21caf"/>
          <text x={cx} y={cardY+39} textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="2.4" fill="#fff" fontFamily="var(--sans)">ВЛОЖЕННАЯ ЯСНА²</text>
          {/* Главный заголовок попапа */}
          <text x={cx} y={cardY+76} textAnchor="middle" fontSize={isMob?26:32} fontWeight="700" fill="#1d1d1f" fontFamily="var(--serif)">{(p[drill]||`Полка ${drill}`)}</text>
          {/* Подзаголовок-путь */}
          <text x={cx} y={cardY+102} textAnchor="middle" fontSize="12" fill="#86868b" fontFamily="var(--sans)">{(yy.name.length>26?yy.name.slice(0,24)+'…':yy.name)} · Полка {drill}</text>
          {/* Декоративный разделитель */}
          <line x1={cx-100} y1={cardY+118} x2={cx+100} y2={cardY+118} stroke="rgba(162,28,175,.22)" strokeWidth="1"/>
          {/* Close-кнопка ✕ в правом верхнем углу */}
          <g style={{cursor:'pointer'}} onClick={()=>onDrill&&onDrill(null)}>
            <circle cx={cardX+cardW-32} cy={cardY+32} r="22" fill="#fff" stroke="rgba(162,28,175,.35)" strokeWidth="1.5"/>
            <text x={cardX+cardW-32} y={cardY+39} textAnchor="middle" fontSize="22" fontWeight="500" fill="#a21caf" fontFamily="var(--sans)" style={{userSelect:'none'}}>×</text>
          </g>
          {/* Внешнее кольцо sub-Ясны */}
          <circle cx={cx} cy={subCenterY} r={subR} fill="none" stroke={dCol} strokeWidth="1.2" strokeDasharray="5 7" opacity=".35"/>
          {/* Внутреннее декоративное кольцо */}
          <circle cx={cx} cy={subCenterY} r={subR*0.55} fill="rgba(162,28,175,.03)" stroke={dCol} strokeWidth=".8" strokeDasharray="2 6" opacity=".35"/>
          {/* Sub-полки */}
          {Array.from({length:12},(_,j)=>{
            const sa=(270-j*30)*Math.PI/180;
            const sx=Math.round((cx+subR*Math.cos(sa))*2)/2;
            const sy=Math.round((subCenterY-subR*Math.sin(sa))*2)/2;
            const subName=(subPolki&&subPolki[j])||'';
            const pranaColor=SUB_PRANA_COLOR[j];
            // Top (j=6) и Bottom (j=0) sub-полки: лейбл ВНУТРИ ring (safe-zone от шапки и от низа карточки)
            const isTop=j===6, isBot=j===0;
            let lx, ly, anchor;
            if(isTop){
              lx=sx; ly=sy+subNr+(isMob?22:26); anchor='middle';
            } else if(isBot){
              lx=sx; ly=sy-subNr-(isMob?14:18); anchor='middle';
            } else {
              lx=Math.round((cx+subLr*Math.cos(sa))*2)/2;
              ly=Math.round((subCenterY-subLr*Math.sin(sa))*2)/2;
              anchor=Math.abs(lx-cx)<25?'middle':lx<cx?'end':'start';
            }
            // Длинные подписи разбиваем на 2 строки
            let parts=null;
            if(subName.length>13){
              if(subName.includes(' ')){const w=subName.split(' ');const m=Math.ceil(w.length/2);parts=[w.slice(0,m).join(' '),w.slice(m).join(' ')];}
              else if(subName.includes('/')){const si=subName.indexOf('/');parts=[subName.slice(0,si).trim(),subName.slice(si+1).trim()];}
            }
            return<g key={`sub${j}`}>
              {/* Кружок sub-полки */}
              <circle cx={sx} cy={sy} r={subNr+3} fill="rgba(255,255,255,.95)" stroke="rgba(162,28,175,.15)" strokeWidth="0.8"/>
              <circle cx={sx} cy={sy} r={subNr} fill="#fff" stroke={pranaColor} strokeWidth={isMob?2.8:3}/>
              {/* Цифра sub-полки */}
              <text x={sx} y={sy+(isMob?8:9)} textAnchor="middle" fontSize={isMob?28:32} fontWeight="700" fill="#1f2937" fontFamily="var(--sans)">{j}</text>
              {/* Подпись sub-полки — снаружи кольца */}
              {subName && parts ? (
                <text x={lx} y={ly-9} textAnchor={anchor} fontSize={isMob?17:20} fill="#1d1d1f" fontWeight="600" fontFamily="var(--serif)">
                  <tspan x={lx} dy="0">{parts[0]}</tspan>
                  <tspan x={lx} dy={isMob?20:24}>{parts[1]}</tspan>
                </text>
              ) : subName ? (
                <text x={lx} y={ly+7} textAnchor={anchor} fontSize={isMob?17:20} fill="#1d1d1f" fontWeight="600" fontFamily="var(--serif)">{subName}</text>
              ) : null}
            </g>;
          })}
          {/* Центральный декор: круглый якорь */}
          <circle cx={cx} cy={subCenterY} r="14" fill="#fff" stroke={dCol} strokeWidth="1.5" opacity=".4"/>
          <circle cx={cx} cy={subCenterY} r="6" fill={dCol} opacity=".25"/>
          <circle cx={cx} cy={subCenterY} r="3" fill={dCol}/>
        </g>;
      })()}
    </g>
    </svg>);
}


// (POS_DESC / CROSS_CTX / PRANA_CTX / OPP_DESC — вынесены в core/data.js)


// (Info вынесен в core/info-card.js)
const Info = window.Info;


// (Editor / Picker / OverlayPicker / OverlayLegend вынесены в core/dialogs.js)
const { Editor, Picker, OverlayPicker, OverlayLegend } = window.YasnaDialogs;




// (GLOSS — вынесен в core/data.js)


// (Verification вынесена в core/verification.js)
const Verification = window.Verification;

const Yasna3DView = window.Yasna3DView;

// Expose to global namespace for lessons + app to use
window.YasnaCore = {
  CR, PR, REF, T, FL,
  Star, Yasna3DView, Info, OverlayLegend, Editor, OverlayPicker, Picker, Verification,
  POS_DESC, CROSS_CTX, PRANA_CTX, OPP_DESC, GLOSS
};
