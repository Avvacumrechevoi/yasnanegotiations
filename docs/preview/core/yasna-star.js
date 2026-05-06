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
          {isSel&&<circle cx={pt.x} cy={pt.y} r={nr+8} fill={c} opacity=".06" filter="url(#gw)"/>}
          <circle cx={pt.x} cy={pt.y} r={isSel?nr+3:nr} fill="#fff" stroke={c} strokeWidth={isSel?3.2:2.2} opacity={o} filter={isSel?"url(#gw)":"url(#ns)"} style={{pointerEvents:'none',transition:'r 150ms ease'}}/>
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


function Info({i,p,af=[],y={},overlay=null,onEdit,onClose,onSel}){
  if(i===null)return null;
  const cr=CR[gc(i)],pr=PR[gp(i)],ref=REF[i],label=p[i]||'',oppLabel=p[opp(i)]||'';
  const prevL=p[(i+11)%12]||'',nextL=p[(i+1)%12]||'';
  const isLong=i%2===0;
  const oppPairIdx=i<6?i:i-6;
  const hasMech=af.length>0;
  const isEmpty=!label;
  // Polarity relation: which pole does this position belong to?
  const poleVert=[0,1,11].includes(i)?'bh':[5,6,7].includes(i)?'th':null;
  const poleHoriz=[2,3,4].includes(i)?'lh':[8,9,10].includes(i)?'rh':null;
  const overlayLabel=overlay&&overlay.p?(overlay.p[i]||''):'';

  const mechItems=[];
  af.forEach(fid=>{
    if(['support','right','left'].includes(fid)){
      if(CR[fid].p.includes(i)) mechItems.push({c:CR[fid].c,title:CR[fid].n+' · '+CR[fid].v,text:CROSS_CTX[fid][i]});
      else mechItems.push({c:'#aeaeb2',title:CR[fid].n,text:'Позиция '+i+' не входит в этот крест ('+CR[fid].p.join('·')+')',dim:true});
    }
    if(['she','fo','tsi','ha'].includes(fid)){
      if(PR[fid].p.includes(i)) mechItems.push({c:PR[fid].c,title:PR[fid].n,text:PRANA_CTX[fid]});
      else mechItems.push({c:'#aeaeb2',title:PR[fid].n,text:'Позиция '+i+' не входит в треугольник ('+PR[fid].p.join('·')+')',dim:true});
    }
    if(fid==='opp') mechItems.push({c:'#ff9500',title:'↔ ['+i+'] — ['+opp(i)+']',text:OPP_DESC[oppPairIdx]+(oppLabel?' «'+label+'» ↔ «'+oppLabel+'»':'')});
    if(fid==='rhythm'){
      const triples=[[2,3,4],[5,6,7],[8,9,10],[11,0,1]];
      const tri=triples.find(t=>t.includes(i));
      if(tri){
        const myK=tri.indexOf(i);
        const roles=[{r:'Вера',l:'подготовка',c:'#5B9CF6'},{r:'Бой',l:'событие',c:'#E8364F'},{r:'Победа',l:'итог',c:'#E8A834'}];
        const role=roles[myK];
        const triIdx=triples.indexOf(tri)+1;
        const triNames=['I','II','III','IV'];
        const steps=tri.map((j,k)=>({idx:j,role:roles[k],name:p[j]||'',active:k===myK}));
        mechItems.push({c:'#30A060',title:'Ритм · Тройка '+triNames[triIdx-1]+' · '+role.r,steps});
      }
    }
    if(fid==='arcs'){
      const arcs=[[1,2,3,4,5],[5,6,7,8,9],[9,10,11,0,1]];
      const arcNames=['Дуга I (утренняя)','Дуга II (дневная)','Дуга III (ночная)'];
      const arcRoles=[{r:'ФО',l:'исток',c:'#4090D8'},{r:'ЦИ',l:'нагрев',c:'#70B8F0'},{r:'ХА',l:'пик',c:'#F06838'},{r:'ШЭ',l:'остыв.',c:'#C0943A'},{r:'ФО',l:'конец',c:'#4090D8'}];
      arcs.forEach((arc,ai)=>{
        if(arc.includes(i)){
          const myK=arc.indexOf(i);
          const role=arcRoles[myK];
          const steps=arc.map((j,k)=>({idx:j,role:arcRoles[k],name:p[j]||'',active:k===myK}));
          mechItems.push({c:['#4090D8','#9060D0','#30A060'][ai],title:arcNames[ai]+' · '+role.r+' ('+role.l+')',steps});
        }
      });
    }
    if(fid==='halves'){
      const isLight=[4,5,6,7,8].includes(i);
      const isDark=[10,11,0,1,2].includes(i);
      const isHoriz=[3,9].includes(i);
      const isLeft=[1,2,3,4,5].includes(i);
      const isRight=[7,8,9,10,11].includes(i);
      const isVert=[0,6].includes(i);
      mechItems.push({c:isLight?'#C0A030':isDark?'#5868B8':'#86868b',
        title:isLight?'Чаша Света (верх)':isDark?'Чаша Тьмы (низ)':'Горизонт',
        text:isLight?'Явное, открытое, активное. Позиции 4-5-6-7-8.':isDark?'Скрытое, закрытое, пассивное. Позиции 10-11-0-1-2.':'Соединяет чаши. Точка борьбы и перехода.'});
      mechItems.push({c:isLeft?'#28A060':isRight?'#A046A0':'#86868b',
        title:isLeft?'Левая половина (нарастание)':isRight?'Правая половина (спад)':'Ось Единства',
        text:isLeft?'Энергия растёт, свет нарастает. Позиции 1-2-3-4-5.':isRight?'Энергия падает, свет убывает. Позиции 7-8-9-10-11.':'Вертикальная ось. Полюс '+(i===0?'Тьмы':'Света')+'.'});
    }
    if(fid==='error89'){
      const isMain=[8,9].includes(i);
      const isMirror=[2,3].includes(i);
      const isOpCross=[0,3,6,9].includes(i);
      const opErrors={0:'Ошибка во сне: решение приходит во сне, но ты не уверен, было ли оно.',3:'Просмотрел: на Востоке (Истина) кажется всё точно, но можно просмотреть деталь.',6:'Мираж: на вершине (День) иллюзия полноты, но реальность сложнее.',9:'Ошибка измерения: на Западе (Розыгрыш) мир показывает не то, что есть.'};
      if(isMain) mechItems.push({c:'#D946EF',title:'Зона ошибки 8↔9',text:'Элементы полочек 8 и 9 могут быть перепутаны. «'+( p[8]||'[8]')+' » выглядит как «'+(p[9]||'[9]')+'» и наоборот. ДЕВять содержит ДЕВА(8), ВОСемь содержит ВЕСы(9) — язык хранит эту путаницу.'});
      else if(isMirror) mechItems.push({c:'#D946EF',title:'Зеркало ошибки 2↔3',text:'Если 8↔9 путаются, то и 2↔3 тоже. «'+(p[2]||'[2]')+'» может содержать свойства «'+(p[3]||'[3]')+'». Пример: бар(2) по сути кухня(3), но в столовой.'});
      else if(isOpCross) mechItems.push({c:'#D946EF',title:'Ошибка Опорного креста',text:opErrors[i]});
      else mechItems.push({c:'#D946EF44',title:'Ошибка 8↔9',text:'Позиция '+i+' не в зоне основной ошибки. Главная путаница — между 8 и 9 (и зеркально 2↔3).',dim:true});
    }
    if(fid==='__none__'){
      if([0,6].includes(i)) mechItems.push({c:'#86868b',title:'Линия Единства (0↔6)',text:'Вертикальная ось. Позиция '+i+' — '+(i===0?'полюс Тьмы':'полюс Света')+'.'});
      else if([3,9].includes(i)) mechItems.push({c:'#86868b',title:'Линия Борьбы (3↔9)',text:'Горизонтальная ось. Позиция '+i+' — '+(i===3?'Восток (Истина)':'Запад (Розыгрыш)')+'.'});
      else mechItems.push({c:'#aeaeb2',title:'Оси',text:'Позиция '+i+' не на осях.',dim:true});
    }
  });

  const Tag=({color,children})=><span style={{display:'inline-block',padding:'1px 8px',borderRadius:10,fontSize:10,fontWeight:500,background:color+'12',color:color,border:`1px solid ${color}25`}}>{children}</span>;

  // Split mechItems into active and dim; collapse dim into one line when there are many
  const activeMech=mechItems.filter(it=>!it.dim);
  const dimMech=mechItems.filter(it=>it.dim);
  const collapseDim=dimMech.length>3;

  // Scroll indicator: show only when content overflows
  const[scrollHint,setScrollHint]=useState(false);
  const scrollRef=(el)=>{
    if(!el)return;
    const check=()=>{
      const overflowing=el.scrollHeight>el.clientHeight+4;
      const atBottom=el.scrollTop+el.clientHeight>=el.scrollHeight-8;
      setScrollHint(overflowing&&!atBottom);
    };
    check();
    el.onscroll=check;
    // re-check after mechItems might re-render
    setTimeout(check,50);
  };

  // Card size state: 'compact' | 'mid' | 'full' (mobile only)
  const[cardSize,setCardSize]=useState('compact');
  const sizeHeights={compact:0.32,mid:0.60,full:0.90}; // vh fractions

  // Drag state kept in ref to avoid stale closure + re-render churn
  const dragRef=React.useRef(null);

  // Cycle through states on tap of handle
  const cycleSize=()=>{
    setCardSize(s=>s==='compact'?'mid':s==='mid'?'full':'compact');
  };

  useEffect(()=>{
    const handle=document.querySelector('.fi-handle');
    if(!handle)return;

    const onDown=(e)=>{
      // Don't start drag on close button or interactive children
      if(e.target.closest('button'))return;
      const y=e.touches?e.touches[0].clientY:e.clientY;
      const h=window.innerHeight;
      // Mark if the touch started on the narrow handle (tap here cycles sizes)
      const fromHandle=e.currentTarget.classList.contains('fi-handle');
      dragRef.current={startY:y,startH:sizeHeights[cardSize]*h,h,moved:false,curH:null,tapStart:Date.now(),fromHandle};
      // add window listeners
      window.addEventListener('touchmove',onMove,{passive:false});
      window.addEventListener('touchend',onUp);
      window.addEventListener('touchcancel',onUp);
      window.addEventListener('mousemove',onMove);
      window.addEventListener('mouseup',onUp);
    };
    const onMove=(e)=>{
      const d=dragRef.current;
      if(!d)return;
      const y=e.touches?e.touches[0].clientY:e.clientY;
      const dy=d.startY-y;
      const newH=Math.max(d.h*0.20, Math.min(d.h*0.92, d.startH+dy));
      const el=document.querySelector('.fi');
      if(el){ el.style.height=newH+'px'; el.style.maxHeight=newH+'px'; el.classList.add('fi-dragging'); }
      d.curH=newH;
      d.moved=Math.abs(dy)>5;
      if(e.cancelable)e.preventDefault();
    };
    const onUp=()=>{
      const d=dragRef.current;
      if(!d){cleanup();return;}
      const el=document.querySelector('.fi');
      const wasTap=!d.moved&&(Date.now()-d.tapStart)<300;
      if(wasTap&&d.fromHandle){
        // Only cycle on handle tap
        if(el){ el.style.height=''; el.style.maxHeight=''; el.classList.remove('fi-dragging'); }
        cycleSize();
      } else if(d.curH!=null){
        const frac=d.curH/d.h;
        let target='compact';
        if(frac>0.75) target='full';
        else if(frac>0.45) target='mid';
        setCardSize(target);
        if(el){ el.style.height=''; el.style.maxHeight=''; el.classList.remove('fi-dragging'); }
      } else {
        if(el){ el.style.height=''; el.style.maxHeight=''; el.classList.remove('fi-dragging'); }
      }
      dragRef.current=null;
      cleanup();
    };
    const cleanup=()=>{
      window.removeEventListener('touchmove',onMove);
      window.removeEventListener('touchend',onUp);
      window.removeEventListener('touchcancel',onUp);
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
    };

    handle.addEventListener('touchstart',onDown,{passive:true});
    handle.addEventListener('mousedown',onDown);
    // Also attach to header zone for bigger swipe target
    const headerZone=document.querySelector('.fi-header-zone');
    if(headerZone){
      headerZone.addEventListener('touchstart',onDown,{passive:true});
      headerZone.addEventListener('mousedown',onDown);
    }
    return()=>{
      handle.removeEventListener('touchstart',onDown);
      handle.removeEventListener('mousedown',onDown);
      if(headerZone){
        headerZone.removeEventListener('touchstart',onDown);
        headerZone.removeEventListener('mousedown',onDown);
      }
      cleanup();
    };
  },[cardSize]);

  // Reset card size when selecting a new position
  useEffect(()=>{setCardSize('compact');},[i]);

  return(
    <div className={"fi fi-"+cardSize+" fi-sidepanel"} style={{width:'100%',height:'100%',background:'rgba(255,255,255,.98)',display:'flex',flexDirection:'column'}}>
      <div className="fi-handle" style={{display:'flex',justifyContent:'center',flexShrink:0}}>
        <div className="fi-handle-bar" style={{width:36,height:4,borderRadius:2,background:'#d2d2d7'}}/>
      </div>
      <div className="fi-header-zone" style={{padding:'4px 18px 8px',flexShrink:0,position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:2,right:12,width:28,height:28,borderRadius:'50%',border:'1px solid #e5e5ea',background:'#f5f5f7',fontSize:14,color:'#86868b',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:1}}>✕</button>
        <div style={{display:'flex',alignItems:'center',gap:12,paddingRight:34}}>
          <div style={{width:36,height:36,borderRadius:'50%',border:`2px solid ${cr.c}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,color:cr.c,flexShrink:0}}>{i}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,color:'#1d1d1f',fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label||<span style={{color:'#aeaeb2'}}>Не заполнено</span>}</div>
            <div style={{display:'flex',alignItems:'center',gap:4,marginTop:3,flexWrap:'wrap'}}>
              {ref.f&&<span style={{fontSize:9,color:'#6e6e73',textTransform:'uppercase',letterSpacing:0.5,fontWeight:700,marginRight:4}}>{ref.f}</span>}
              <Tag color={cr.c}>{cr.v}</Tag>
              <Tag color={pr.c}>{pr.n.split(' ')[0]}</Tag>
              <Tag color="#86868b">{isLong?'Долгое':'Короткое'}</Tag>
            </div>
          </div>
        </div>
      </div>
      <div ref={scrollRef} style={{flex:1,overflowY:'auto',padding:'0 18px 16px',position:'relative'}}>
        {/* Соседи — 3 кликабельных строки (Block 2.4) */}
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12,paddingBottom:10,borderBottom:'1px solid #f0f0f2'}}>
          <button onClick={()=>onSel&&onSel((i+11)%12)} title='Перейти к предыдущей полке' style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#424245',background:'transparent',border:'none',padding:'4px 6px',borderRadius:6,cursor:'pointer',textAlign:'left',width:'100%'}} onMouseEnter={e=>e.currentTarget.style.background='#f5f5f7'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <span style={{color:'#86868b',fontSize:14,fontWeight:600,minWidth:14}}>←</span>
            <span style={{color:'#aeaeb2',fontSize:10,fontWeight:600,minWidth:14}}>{(i+11)%12}</span>
            <span style={{color:prevL?'#1d1d1f':'#c0c0c5',fontStyle:prevL?'normal':'italic'}}>{prevL||'—'}</span>
          </button>
          <button onClick={()=>onSel&&onSel((i+1)%12)} title='Перейти к следующей полке' style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#424245',background:'transparent',border:'none',padding:'4px 6px',borderRadius:6,cursor:'pointer',textAlign:'left',width:'100%'}} onMouseEnter={e=>e.currentTarget.style.background='#f5f5f7'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <span style={{color:'#86868b',fontSize:14,fontWeight:600,minWidth:14}}>→</span>
            <span style={{color:'#aeaeb2',fontSize:10,fontWeight:600,minWidth:14}}>{(i+1)%12}</span>
            <span style={{color:nextL?'#1d1d1f':'#c0c0c5',fontStyle:nextL?'normal':'italic'}}>{nextL||'—'}</span>
          </button>
          <button onClick={()=>onSel&&onSel(opp(i))} title='Перейти к противоположной полке' style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#424245',background:'transparent',border:'none',padding:'4px 6px',borderRadius:6,cursor:'pointer',textAlign:'left',width:'100%'}} onMouseEnter={e=>e.currentTarget.style.background='#fef8e7'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <span style={{color:'#ff9500',fontSize:14,fontWeight:600,minWidth:14}}>↔</span>
            <span style={{color:'#aeaeb2',fontSize:10,fontWeight:600,minWidth:14}}>{opp(i)}</span>
            <span style={{color:oppLabel?'#1d1d1f':'#c0c0c5',fontStyle:oppLabel?'normal':'italic'}}>{oppLabel||'—'}</span>
          </button>
          {overlay&&<div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#af52de',flexWrap:'wrap'}}>
            <span style={{fontWeight:600}}>⊕</span>
            <span style={{color:'#aeaeb2',fontSize:10,fontWeight:600,fontStyle:'italic'}}>{overlay.name||overlay.n||'наложение'}:</span>
            <span style={{color:overlayLabel?'#af52de':'#c0c0c5',fontStyle:overlayLabel?'normal':'italic'}}>{overlayLabel||'—'}</span>
          </div>}
        </div>
        <div style={{fontSize:13,color:'#424245',lineHeight:1.6,marginBottom:10,padding:'10px 12px',background:'var(--bg2)',borderRadius:10}}>
          {POS_DESC[i]}
        </div>
      {isEmpty&&onEdit&&<button onClick={onEdit} style={{width:'100%',padding:'9px 12px',marginBottom:10,background:'rgba(0,122,255,.06)',border:'1px dashed rgba(0,122,255,.35)',borderRadius:10,color:'#0071e3',fontSize:12,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
        <span style={{fontSize:14}}>✎</span>
        <span>Заполнить позицию {i}</span>
      </button>}
      {(poleVert||poleHoriz)&&(y.th||y.bh||y.lh||y.rh)&&<div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:10,padding:'8px 10px',background:'#faf7ff',borderRadius:8,border:'1px solid #ece3f7'}}>
        <div style={{fontSize:12,fontWeight:600,color:'#0058b8',marginBottom:4}}>Открыть в Ясне «{y.name}» →</div>
        {poleVert==='th'&&y.th&&<div style={{fontSize:11,color:'#424245'}}><span style={{color:'#86868b'}}>▲ ближе к верху:</span> <b>{y.th}</b></div>}
        {poleVert==='bh'&&y.bh&&<div style={{fontSize:11,color:'#424245'}}><span style={{color:'#86868b'}}>▼ ближе к низу:</span> <b>{y.bh}</b></div>}
        {poleHoriz==='lh'&&y.lh&&<div style={{fontSize:11,color:'#424245'}}><span style={{color:'#86868b'}}>◀ ближе к лево:</span> <b>{y.lh}</b></div>}
        {poleHoriz==='rh'&&y.rh&&<div style={{fontSize:11,color:'#424245'}}><span style={{color:'#86868b'}}>▶ ближе к право:</span> <b>{y.rh}</b></div>}
      </div>}
      {activeMech.length>0&&<div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:6}}>
        {activeMech.map((it,j)=><div key={j} style={{padding:'6px 10px',background:it.c+'08',borderRadius:8,borderLeft:`3px solid ${it.c}`,flexShrink:0}}>
          <div style={{fontSize:10,fontWeight:600,color:it.c,marginBottom:it.steps?4:1}}>{it.title}</div>
          {it.steps
            ?<div style={{display:'flex',flexDirection:'column',gap:2,marginTop:2}}>
              {it.steps.map((s,k)=><div key={k} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,padding:s.active?'3px 6px':'2px 6px',background:s.active?'#ffffff':'transparent',borderRadius:4,border:s.active?'1px solid '+it.c+'40':'1px solid transparent'}}>
                <span style={{fontSize:9,color:s.role.c,fontWeight:700,minWidth:22,padding:'1px 4px',background:s.role.c+'14',borderRadius:3,textAlign:'center'}}>{s.role.r}</span>
                <span style={{fontSize:9,color:'#86868b',minWidth:14}}>[{s.idx}]</span>
                <span style={{color:s.active?'#1d1d1f':'#424245',fontWeight:s.active?600:400,flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name||<span style={{color:'#c0c0c5',fontStyle:'italic'}}>—</span>}</span>
                <span style={{fontSize:9,color:'#aeaeb2'}}>{s.role.l}</span>
              </div>)}
            </div>
            :<div style={{fontSize:11,color:'#424245',lineHeight:1.45}}>{it.text}</div>
          }
        </div>)}
      </div>}
      {dimMech.length>0&&(collapseDim
        ?<div style={{padding:'6px 10px',background:'#fafafa',borderRadius:8,border:'1px dashed #e5e5ea',fontSize:10,color:'#aeaeb2',lineHeight:1.5,marginBottom:6}}>
          <span style={{fontWeight:600}}>Не входит в:</span> {dimMech.map(it=>it.title).join(' · ')}
        </div>
        :<div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:6}}>
          {dimMech.map((it,j)=><div key={'d'+j} style={{padding:'6px 10px',background:'#fafafa',borderRadius:8,borderLeft:'3px solid #e5e5ea',opacity:.55}}>
            <div style={{fontSize:10,fontWeight:600,color:'#aeaeb2',marginBottom:1}}>{it.title}</div>
            <div style={{fontSize:11,color:'#aeaeb2',lineHeight:1.45}}>{it.text}</div>
          </div>)}
        </div>
      )}
      </div>
      {scrollHint&&<div style={{position:'absolute',bottom:0,left:0,right:0,height:28,background:'linear-gradient(transparent,rgba(255,255,255,.95))',display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:4,pointerEvents:'none'}}>
        <span style={{fontSize:10,color:'#aeaeb2',animation:'bounce 1.5s infinite'}}>↓</span>
      </div>}
    </div>);
}

function OverlayLegend({y,overlay,onClear}){
  if(!overlay)return null;
  return(
    <div className="overlay-legend" style={{position:'absolute',top:50,right:12,background:'rgba(255,255,255,.95)',border:'1px solid rgba(0,0,0,.06)',borderRadius:12,padding:'10px 14px',backdropFilter:'blur(16px)',minWidth:180,zIndex:10}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontSize:10,color:'#6e6e73',textTransform:'uppercase',letterSpacing:1}}>Совмещение</span>
        <button onClick={onClear} style={{fontSize:14,color:'#6e6e73',padding:'0 4px'}}>✕</button>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
        <div style={{width:12,height:3,borderRadius:2,background:'rgba(0,122,255,.6)'}}/>
        <span style={{fontSize:11,color:'#1d1d1f'}}>{y.name}</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <div style={{width:12,height:3,borderRadius:2,background:'rgba(175,82,222,.5)'}}/>
        <span style={{fontSize:11,color:'#af52de',fontStyle:'italic'}}>{overlay.name||overlay.n}</span>
      </div>
    </div>);
}

function Editor({y,setY,onClose}){
  return(
    <div className='editor-panel' style={{position:'fixed',top:0,right:0,width:370,height:'100vh',background:'rgba(255,255,255,.98)',borderLeft:'1px solid rgba(0,0,0,.08)',zIndex:50,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <h3 style={{fontFamily:'var(--serif)',fontSize:18,color:'#1d1d1f',fontWeight:600}}>Редактор</h3>
        <span style={{fontSize:11,color:'#34c759',fontWeight:500,letterSpacing:.3}}>● автосохранение</span>
      </div>
      <div style={{padding:'12px 18px',overflowY:'auto',flex:1}}>
        <input value={y.name} onChange={e=>setY({...y,name:e.target.value})} placeholder="Название"
          style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',color:'#1d1d1f',padding:'9px 12px',borderRadius:7,fontFamily:'var(--serif)',fontSize:17,fontWeight:700,marginBottom:10,outline:'none'}}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:14}}>
          {[['th','▲ Верх'],['bh','▼ Низ'],['lh','◀ Лево'],['rh','▶ Право']].map(([k,ph])=>
            <input key={k} placeholder={ph} value={y[k]||''} onChange={e=>setY({...y,[k]:e.target.value})}
              style={{background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--txt)',padding:'5px 8px',borderRadius:5,fontSize:10,outline:'none'}}/>
          )}
        </div>
        {y.p.map((l,i)=>{const c=CR[gc(i)].c;return(
          <div key={i} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
            <div style={{width:26,height:26,borderRadius:'50%',border:`2px solid ${c}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:c,flexShrink:0}}>{i}</div>
            <input value={l} onChange={e=>{const np=[...y.p];np[i]=e.target.value;setY({...y,p:np});}} placeholder={(REF[i]||{}).f||''}
              style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',color:'#1d1d1f',padding:'7px 10px',borderRadius:5,fontSize:12,outline:'none'}}
              onFocus={e=>e.target.style.borderColor=c} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          </div>);})}
      </div>
      <div style={{padding:'12px 18px',borderTop:'1px solid var(--border)',display:'flex',gap:8,flexShrink:0,background:'#fafafa'}}>
        <button onClick={onClose} style={{flex:1,padding:'11px 14px',borderRadius:9,fontSize:14,fontWeight:600,background:'#0071e3',color:'#fff',border:'none',cursor:'pointer',boxShadow:'0 1px 3px rgba(0,113,227,.2)'}}>✓ Сохранить и закрыть</button>
      </div>
    </div>);
}

function OverlayPicker({currentName,overlay,onSelect,onClose}){
  const[q,setQ]=useState('');
  const filtered=T.filter(t=>t.n!==currentName&&t.n.toLowerCase().includes(q.toLowerCase()));
  const rubrikList=filtered.filter(t=>t.rubrik);
  const customList=filtered.filter(t=>t.custom&&!t.rubrik);
  const otherList=filtered.filter(t=>!t.rubrik&&!t.custom);

  const Card=({t})=>{const active=overlay&&overlay.name===t.n;return(
    <button key={t.id} onClick={()=>{onSelect({name:t.n,p:[...t.p]});onClose();}}
      style={{position:'relative',padding:'11px 14px',paddingLeft:t.rubrik?18:14,paddingRight:active?36:14,borderRadius:10,fontSize:14,textAlign:'left',
        background:active?'rgba(175,82,222,.12)':'#f5f5f7',
        color:active?'#af52de':'#1d1d1f',
        border:`1px solid ${active?'rgba(175,82,222,.4)':'transparent'}`,
        fontWeight:active?600:400,
        fontStyle:active?'italic':'normal',
        transition:'all .12s',cursor:'pointer',overflow:'hidden'}}>
      {t.rubrik&&<span style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:'#30A060'}} title="Проверена"/>}
      {t.n}
      {active&&<span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'#af52de',fontSize:15,fontWeight:700}}>✓</span>}
    </button>);};

  const Section=({title,items})=>items.length===0?null:(
    <div style={{marginBottom:18}}>
      <div style={{fontSize:11,fontWeight:600,color:'#6e6e73',textTransform:'uppercase',letterSpacing:1,marginBottom:8,paddingLeft:4}}>{title} <span style={{color:'#aeaeb2',fontWeight:400}}>· {items.length}</span></div>
      <div className='picker-grid' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {items.map(t=><Card key={t.id} t={t}/>)}
      </div>
    </div>);

  return(
    <div className="popup-overlay" style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(0,0,0,.25)',zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}} onClick={onClose}>
      <div className='picker-inner' style={{background:'rgba(255,255,255,.99)',border:'1px solid rgba(175,82,222,.15)',borderRadius:20,boxShadow:'0 20px 60px rgba(0,0,0,.15)',padding:0,width:'100%',maxWidth:600,height:'82vh',maxHeight:720,display:'flex',flexDirection:'column',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        {/* HEADER */}
        <div style={{padding:'18px 22px 14px',borderBottom:'1px solid #f0f0f2',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div style={{flex:1,minWidth:0,paddingRight:10}}>
              <h3 style={{fontFamily:'var(--serif)',fontSize:20,color:'#af52de',fontWeight:700,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Совместить «{currentName}» с…</h3>
              <div style={{fontSize:12,color:'#86868b'}}>Выберите вторую Ясну — её подписи появятся вторым кольцом вокруг.</div>
            </div>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:'50%',background:'#f5f5f7',border:'none',fontSize:16,color:'#6e6e73',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
          </div>
          {/* SEARCH */}
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#aeaeb2',fontSize:14,pointerEvents:'none'}}>🔍</span>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск по названию..."
              style={{width:'100%',padding:'9px 14px 9px 36px',borderRadius:10,border:'1px solid #d2d2d7',fontSize:16,fontFamily:'var(--sans)',outline:'none',background:'#fff',color:'#1d1d1f',boxSizing:'border-box'}}
              onFocus={e=>e.target.style.borderColor='#af52de'}
              onBlur={e=>e.target.style.borderColor='#d2d2d7'}/>
            {q&&<button onClick={()=>setQ('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',width:22,height:22,borderRadius:'50%',border:'none',background:'#e5e5ea',color:'#6e6e73',fontSize:11,cursor:'pointer'}}>✕</button>}
          </div>
        </div>
        {/* LIST */}
        <div style={{flex:1,overflowY:'auto',padding:'14px 22px 18px'}}>
          {filtered.length===0?
            <div style={{textAlign:'center',padding:'60px 20px',color:'#aeaeb2',fontSize:13}}>Ничего не найдено по запросу «{q}»</div>
            :<>
              <Section title="Проверенные" items={rubrikList}/>
              <Section title="Встречи (кастомные)" items={customList}/>
              <Section title="Прочие" items={otherList}/>
            </>}
        </div>
      </div>
    </div>);
}

function Picker({pinned,onTogglePin,onClear,onClose}){
  const[q,setQ]=useState('');
  const filtered=T.filter(t=>t.n.toLowerCase().includes(q.toLowerCase()));
  const starterList=filtered.filter(t=>t.starter);
  const additionalList=filtered.filter(t=>t.rubrik&&!t.starter);
  const customList=filtered.filter(t=>t.custom&&!t.rubrik);
  const otherList=filtered.filter(t=>!t.rubrik&&!t.custom);
  const pinnedCount=pinned.length;
  const total=T.length;

  const Card=({t})=>{const active=pinned.includes(t.id);return(
    <button key={t.id} onClick={()=>onTogglePin(t.id)}
      style={{position:'relative',padding:'11px 14px',paddingLeft:t.rubrik?18:14,paddingRight:active?36:14,borderRadius:10,fontSize:14,textAlign:'left',
        background:active?'#e6f0fa':'#f5f5f7',
        color:active?'#0071e3':'#1d1d1f',
        border:`1px solid ${active?'rgba(0,122,255,.4)':'transparent'}`,
        fontWeight:active?600:400,
        transition:'all .12s',
        cursor:'pointer',
        overflow:'hidden'}}>
      {t.starter&&<span style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:'#0071e3'}} title="Стартовая Ясна"/>}
      {t.rubrik&&!t.starter&&<span style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:'#30A060'}} title="Из рубрикатора Ясн"/>}
      {t.n}
      {active&&<span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'#0071e3',fontSize:15,fontWeight:700}}>✓</span>}
    </button>);};

  const Section=({title,subtitle,items,empty})=>items.length===0?(empty?null:null):(
    <div style={{marginBottom:18}}>
      <div style={{marginBottom:8,paddingLeft:4}}>
        <div style={{fontSize:11,fontWeight:600,color:'#6e6e73',textTransform:'uppercase',letterSpacing:1}}>{title} <span style={{color:'#aeaeb2',fontWeight:400}}>· {items.length}</span></div>
        {subtitle&&<div style={{fontSize:11,color:'#aeaeb2',marginTop:2,textTransform:'none',letterSpacing:0}}>{subtitle}</div>}
      </div>
      <div className='picker-grid' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {items.map(t=><Card key={t.id} t={t}/>)}
      </div>
    </div>);

  return(
    <div className="popup-overlay" style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(0,0,0,.25)',zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}} onClick={onClose}>
      <div className='picker-inner' style={{background:'rgba(255,255,255,.99)',border:'1px solid rgba(0,0,0,.08)',borderRadius:20,boxShadow:'0 20px 60px rgba(0,0,0,.15)',padding:0,width:'100%',maxWidth:600,height:'82vh',maxHeight:720,display:'flex',flexDirection:'column',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        {/* HEADER */}
        <div style={{padding:'18px 22px 14px',borderBottom:'1px solid #f0f0f2',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div>
              <h3 style={{fontFamily:'var(--serif)',fontSize:20,color:'#1d1d1f',fontWeight:700,marginBottom:2}}>Все Ясны</h3>
              <div style={{fontSize:12,color:'#86868b'}}>Выбрано <b style={{color:'#0071e3'}}>{pinnedCount}</b> из {total} · показываются во вкладках</div>
            </div>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:'50%',background:'#f5f5f7',border:'none',fontSize:16,color:'#6e6e73',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
          {/* SEARCH */}
          <div style={{position:'relative',marginBottom:10}}>
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#aeaeb2',fontSize:14,pointerEvents:'none'}}>🔍</span>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск по названию..."
              style={{width:'100%',padding:'9px 14px 9px 36px',borderRadius:10,border:'1px solid #d2d2d7',fontSize:16,fontFamily:'var(--sans)',outline:'none',background:'#fff',color:'#1d1d1f'}}
              onFocus={e=>e.target.style.borderColor='#0071e3'}
              onBlur={e=>e.target.style.borderColor='#d2d2d7'}/>
            {q&&<button onClick={()=>setQ('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',width:22,height:22,borderRadius:'50%',border:'none',background:'#e5e5ea',color:'#6e6e73',fontSize:11,cursor:'pointer'}}>✕</button>}
          </div>
          {/* ACTIONS */}
          <div className="picker-actions" style={{display:'flex',gap:6,alignItems:'center'}}>
            {pinnedCount===total?
              <button onClick={onClear} style={{fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'rgba(0,122,255,.08)',cursor:'pointer',fontWeight:600}}>✓ Все выбраны — снять</button>
              :<button onClick={()=>{T.forEach(t=>{if(!pinned.includes(t.id))onTogglePin(t.id);});}} style={{fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'transparent',cursor:'pointer'}}>✓ Выбрать все</button>}
            {(()=>{const starterIds=T.filter(t=>t.starter).map(t=>t.id);const allStarterSelected=starterIds.every(id=>pinned.includes(id));return allStarterSelected?
              <button onClick={()=>{starterIds.forEach(id=>{if(pinned.includes(id))onTogglePin(id);});}} style={{fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'rgba(0,122,255,.08)',cursor:'pointer',fontWeight:600}}>★ Стартовые — снять</button>
              :<button onClick={()=>{starterIds.forEach(id=>{if(!pinned.includes(id))onTogglePin(id);});}} style={{fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'transparent',cursor:'pointer'}}>★ Только стартовые</button>;})()}
            {pinnedCount>0&&pinnedCount<total&&<button onClick={onClear} style={{fontSize:11,color:'#E8364F',border:'1px solid rgba(232,54,79,.3)',padding:'4px 12px',borderRadius:12,background:'transparent',cursor:'pointer'}}>Снять все</button>}
            <div style={{flex:1}}/>
            <span className="picker-legend" style={{fontSize:10,color:'#aeaeb2',display:'flex',alignItems:'center',gap:10}}>
              <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:3,height:14,background:'#0071e3',display:'inline-block',borderRadius:1}}/> стартовая</span>
              <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:3,height:14,background:'#30A060',display:'inline-block',borderRadius:1}}/> из рубрикатора</span>
            </span>
          </div>
        </div>
        {/* LIST */}
        <div style={{flex:1,overflowY:'auto',padding:'14px 22px 18px'}}>
          {filtered.length===0?
            <div style={{textAlign:'center',padding:'60px 20px',color:'#aeaeb2',fontSize:13}}>Ничего не найдено по запросу «{q}»</div>
            :<>
              <Section title="Стартовые" subtitle="Шесть Ясн для первого знакомства — самые наглядные и связанные с опытом" items={starterList}/>
              <Section title="Дополнительные" subtitle="Остальные Ясны для углубления" items={additionalList}/>
              <Section title="Встречи (кастомные)" items={customList}/>
              <Section title="Прочие" items={otherList}/>
            </>}
        </div>
      </div>
    </div>);
}



// (GLOSS — вынесен в core/data.js)


function Verification({y,vs,setVs,onClose}){
  const p=y.p||[];
  const[tab,setTab]=useState('fast');
  const[hidePassed,setHidePassed]=useState(false);
  const[openInfo,setOpenInfo]=useState(null);
  const[showIntro,setShowIntro]=useState(null);
  const[copyFeedback,setCopyFeedback]=useState('');
  const k=(id)=>y.name+'_'+id;
  const ans=(id,v)=>setVs(s=>({...s,[k(id)]:v}));
  const get=(id)=>vs[k(id)];

  const yasnaKeys=Object.keys(vs).filter(kk=>kk.startsWith(y.name+'_'));
  const hasAnyAnswer=yasnaKeys.length>0;

  useEffect(()=>{
    if(showIntro===null)setShowIntro(!hasAnyAnswer);
  },[]);

  const W={КРИТ:3,ВАЖ:2,ЖЕЛ:1};
  const scoreCount=(checks)=>{let pass=0,failed=0;checks.forEach(c=>{const v=get(c.id);if(v===true)pass++;else if(v===false)failed++});return{pass,failed,done:pass+failed,total:checks.length}};

  const emptyPos=[];
  for(let i=0;i<12;i++)if(!p[i])emptyPos.push(i);
  const hasEmpties=emptyPos.length>0;
  const lbl=(i)=>p[i]||'?';

  const Check=({id,weight,q,info,hint})=>{const v=get(id);const dim=hidePassed&&v===true;
    if(dim)return null;
    const wColor=weight==='КРИТ'?'#E8364F':weight==='ВАЖ'?'#E8A834':'#86868b';
    const isOpen=openInfo===id;
    return(
    <div data-check-id={id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 0',borderBottom:'1px solid #f0f0f2'}}>
      <div style={{display:'flex',gap:4,flexShrink:0,marginTop:1}}>
        <button onClick={()=>ans(id,v===true?null:true)} title="Да" style={{width:28,height:28,borderRadius:6,border:`1.5px solid ${v===true?'#30A060':'#d2d2d7'}`,background:v===true?'#30A06012':'#fff',fontSize:13,color:v===true?'#30A060':'#c7c7cc',cursor:'pointer',fontWeight:600}}>✓</button>
        <button onClick={()=>ans(id,v===false?null:false)} title="Нет" style={{width:28,height:28,borderRadius:6,border:`1.5px solid ${v===false?'#E8364F':'#d2d2d7'}`,background:v===false?'#E8364F12':'#fff',fontSize:13,color:v===false?'#E8364F':'#c7c7cc',cursor:'pointer',fontWeight:600}}>✗</button>
        <button onClick={()=>ans(id,v==='na'?null:'na')} title="Не применимо" style={{width:28,height:28,borderRadius:6,border:`1.5px solid ${v==='na'?'#86868b':'#d2d2d7'}`,background:v==='na'?'#86868b12':'#fff',fontSize:12,color:v==='na'?'#86868b':'#c7c7cc',cursor:'pointer',fontWeight:600}}>—</button>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:6,marginBottom:2}}>
          {weight&&<span style={{fontSize:9,fontWeight:700,color:wColor,padding:'1px 5px',border:`1px solid ${wColor}40`,borderRadius:3,letterSpacing:0.3,flexShrink:0,marginTop:2}}>{weight}</span>}
          <div style={{fontSize:13,color:'#1d1d1f',lineHeight:1.5,flex:1}}>{q}</div>
          {info&&<button onClick={()=>setOpenInfo(isOpen?null:id)} title="Подробнее"
            style={{width:20,height:20,borderRadius:'50%',border:'1.5px solid #c7c7cc',background:isOpen?'#0071e3':'#fff',color:isOpen?'#fff':'#86868b',fontSize:11,cursor:'pointer',fontWeight:700,flexShrink:0,marginTop:1,lineHeight:1,padding:0,fontFamily:'Georgia,serif',fontStyle:'italic'}}>i</button>}
        </div>
        {info&&isOpen&&<div style={{fontSize:12,color:'#424245',marginTop:6,padding:'8px 10px',background:'#f0f5ff',border:'1px solid #d4e4fb',borderRadius:6,lineHeight:1.55}} dangerouslySetInnerHTML={{__html:info.replace(/\*\*([^*]+)\*\*/g,'<b style="color:#1d1d1f">$1</b>')}}/>}
        {hint&&v===false&&<div style={{fontSize:11,color:'#c07800',marginTop:4,padding:'6px 10px',background:'#fff8e8',borderRadius:5,borderLeft:'2px solid #E8A834',lineHeight:1.5}}>💡 {hint}</div>}
      </div>
    </div>);};

  // ==================== ШАГ 0 — БЫСТРАЯ ПРОВЕРКА (7 пунктов) ====================
  // Прямая опора на канон Сутки № 88-97 + авторский алгоритм Год № 11-16
  const expressChecks=[
    {id:'ex_horizon',w:'КРИТ',
      q:'Линия Горизонта определена? Что в этом явлении противостоит чему?',
      info:'**Ясна Года №16:** «Построение Опорного Креста явления начинается с определения Горизонта этого явления.» В Ясне Суток это свет/тьма, в Ясне Года — тепло/холод, в Ясне Жизни — Сам/Особа.'},
    {id:'ex_kresty',w:'КРИТ',
      q:'Опорный Крест 0/3/6/9 — четыре опоры, без которых явление рассыпается?',
      info:'**Ясна Года №11:** «Построение Ясны какого-либо явления начинается с построения Опорного Креста этого явления.» **Ясна Года №12:** «Опорный Крест Явления есть Крест линии Горизонта этого явления и линии его Единения.»'},
    {id:'ex_twelve',w:'КРИТ',
      q:'Ровно 12 различных полок — не больше и не меньше?',
      info:'**Ясна Суток №88:** «Вот таким получилось полное описание суток. Всего двенадцать пунктов.» **Ясна Суток №90:** «Сутки есть двенадцать различных времён.»'},
    {id:'ex_alternation',w:'КРИТ',
      q:'Чередование 6 долгих + 6 коротких? Чётные (0,2,4,6,8,10) — долгие, нечётные (1,3,5,7,9,11) — короткие.',
      info:'**Ясна Суток №92:** «Сутки есть чередование шести долгих и шести коротких времён.»'},
    {id:'ex_closure',w:'КРИТ',
      q:'Цикл замыкается: Полка 11 переходит в Полку 0 = новое начало?',
      info:'**Ясна Суток №73:** «Откуда солнце ушло, туда и вернулось. Поэтому тринадцатый пункт в этом списке — это есть пункт первый.» **Ясна Года узел 8 №569–570:** Лента Мёбиуса.'},
    {id:'ex_param',w:'ВАЖ',
      q:'Один параметр для всех 12 полок (например, свет, тепло, возраст)?',
      info:'**Ясна Года №3:** «Закон устройства всех явлений природы.» Один параметр — то, что нарастает к Полке 6 и убывает к Полке 0.'},
    {id:'ex_unique',w:'ВАЖ',
      q:'Эта Ясна не повторяет уже существующую в той же области?',
      info:'**Ясна Года №5:** «внутреннее устройство всех вещей одинаково» — но каждая Ясна должна давать новую проекцию, не повторяя существующую.'}
  ];

  // ==================== I. ОПОРНЫЙ КРЕСТ — 6 проверок ====================
  // Год № 11-16 + Сутки узлы 4 и 7
  const krestChecks=[
    {id:'k_horizon_clear',w:'КРИТ',
      q:'Линия Горизонта видна явно? Можно показать, какие 2 точки лежат на ней.',
      info:'**Ясна Года №16:** «Опорный Крест начинается с определения Горизонта явления.» В Сутках — точка выхода и точка захода солнца.'},
    {id:'k_3_9_horizon',w:'КРИТ',
      q:`Полки 3 («${lbl(3)}») и 9 («${lbl(9)}») лежат на Линии Горизонта — главные точки противоборства?`,
      info:'**Ясна Суток №48–49:** «Точку выхода солнца поместим слева, точку захода — справа.» (3 = Восток, 9 = Запад). **Ясна Года №35:** Весеннее (3) и Осеннее (9) Равноденствия.'},
    {id:'k_unity_clear',w:'КРИТ',
      q:'Линия Единения определена — между точками минимума и максимума параметра?',
      info:'**Ясна Года №12:** «Опорный Крест есть Крест линии Горизонта и линии Единения.» **Ясна Суток узел 4, №249:** Линия Единства — вертикаль 0↔6.'},
    {id:'k_0_6_unity',w:'КРИТ',
      q:`Полки 0 («${lbl(0)}») и 6 («${lbl(6)}») — крайности параметра, антиподы по Линии Единения?`,
      info:'**Ясна Суток №249:** Линия Единства разделяет нарастание и спад. **Ясна Года №35:** Зимнее Солнцестояние (0=Юг, минимум) и Летнее Солнцестояние (6=Север, максимум).'},
    {id:'k_supports_essential',w:'КРИТ',
      q:'Если убрать любую из 4 опор (0, 3, 6, 9) — явление разваливается?',
      info:'**Ясна Суток №433–460:** Опорный Крест = Крест Бытия. **Ясна Года №14:** «Опорный Крест есть Закон Единства и Борьбы Противоположностей.» **Ясна Года №15:** «Крест Противостояния и Противовода».'},
    {id:'k_isomorphy',w:'ВАЖ',
      q:'Опоры совпадают с образцами трёх Ясн? 0 = Полночь / Зима / Зачатие · 3 = Утро / Весна / Рождение · 6 = Полдень / Лето / Зрелость · 9 = Закат / Осень / Старость',
      info:'**Ясна Года узел 6 №278:** «Шестиугольник Года имеет 12 пронумерованных точек, устроенных так же, как у Сутoк.» **Ясна Жизни узел 12 №952:** все три книги показывают одинаковое устройство — Сутки, Год и Жизнь.'}
  ];

  // ==================== II. 12 ПОЛОК — 9 проверок ====================
  // Сутки № 88-97 — самая компактная и однозначная формулировка
  const polkiChecks=[
    {id:'p_count',w:'КРИТ',
      q:'Ровно 12 элементов в круге?',
      info:'**Ясна Суток №88:** «Вот таким получилось полное описание суток. Всего двенадцать пунктов.»'},
    {id:'p_distinct',w:'КРИТ',
      q:'Все 12 различны — каждый отличается от других?',
      info:'**Ясна Суток №90:** «Сутки есть двенадцать различных времён.»'},
    {id:'p_alternation',w:'КРИТ',
      q:'Чередование длинного и короткого без исключений?',
      info:'**Ясна Суток №91:** «Времена сутки чередуются по длительности.» **Ясна Суток №92:** «Сутки есть чередование шести долгих и шести коротких времён.»'},
    {id:'p_each_property',w:'КРИТ',
      q:'Каждая полка имеет своё уникальное свойство?',
      info:'**Ясна Суток №93:** «Каждое время имеет своё собственное свойство.»'},
    {id:'p_each_event',w:'ВАЖ',
      q:'В каждой полке происходит конкретное событие?',
      info:'**Ясна Суток №94:** «В каждом из времён происходит некое событие.»'},
    {id:'p_long_smooth',w:'КРИТ',
      q:'Все 6 долгих полок (0,2,4,6,8,10) — времена плавных, медленных изменений обстановки?',
      info:'**Ясна Суток №95:** «Все долгие времена сутки есть времена медленных изменений общей обстановки.» На чертеже — стороны шестиугольника.',
      hint:'Если на чётной полке мгновенное событие — она не долгая. Переформулируйте.'},
    {id:'p_short_transition',w:'КРИТ',
      q:'Все 6 коротких полок (1,3,5,7,9,11) — переходы от одного долгого к следующему?',
      info:'**Ясна Суток №96:** «Все короткие времена есть времена быстрых изменений… короткие переходные времена от одного долгого времени к следующему.» На чертеже — углы шестиугольника.',
      hint:'Если на нечётной полке длительный процесс — она не короткая. Переформулируйте.'},
    {id:'p_short_distinct',w:'ВАЖ',
      q:'Все 6 коротких отличаются друг от друга смыслом происходящих событий?',
      info:'**Ясна Суток №97:** «Все короткие времена сутки отличаются друг от друга смыслом происходящих в них событий.»'},
    {id:'p_closure',w:'КРИТ',
      q:'Полка 11 → Полка 0 = переход в новый цикл (замыкание есть)?',
      info:'**Ясна Суток №73:** «Тринадцатый пункт в этом списке — это есть пункт первый. Правда, надо понимать, что это пункт первый следующих суток.» **Ясна Года узел 8 №569:** Змей Питон, заглотивший хвост — Лента Мёбиуса.'}
  ];

  // ==================== III. КРЕСТЫ + ПРАНЫ — 8 проверок ====================
  // Сутки узлы 7 (Кресты) и 8 (Праны) + Год узел 9 (порядок Пран)
  const krestyAndPranChecks=[
    {id:'kp_right',w:'КРИТ',
      q:`Крест Управления (1,4,7,10): «${lbl(1)}», «${lbl(4)}», «${lbl(7)}», «${lbl(10)}» — все результаты/исходы предыдущих опор?`,
      info:'**Ясна Суток №446–447, 502:** Крест Управления / Любви — следствия. 0→1, 3→4, 6→7, 9→10. Каждый элемент = результат предыдущего опорного.'},
    {id:'kp_left',w:'КРИТ',
      q:`Крест Веры (2,5,8,11): «${lbl(2)}», «${lbl(5)}», «${lbl(8)}», «${lbl(11)}» — все подготовки к следующим опорам?`,
      info:'**Ясна Суток №452, 499:** Крест Веры / Левит — подготовка. 2→3, 5→6, 8→9, 11→0. Каждый элемент готовит следующий опорный.'},
    {id:'kp_triples',w:'ВАЖ',
      q:'Все 4 тройки В→Б→П (2-3-4, 5-6-7, 8-9-10, 11-0-1) читаются как мини-истории «подготовка→действие→результат»?',
      info:'**Ясна Суток узел 7:** Ритм Вера→Бой→Победа. Каждая тройка — мини-цикл цикла. Прочитайте вслух — должна звучать как связное предложение.'},
    {id:'kp_she',w:'ВАЖ',
      q:`Земля ШЕ (0,4,8): «${lbl(0)}», «${lbl(4)}», «${lbl(8)}» — все устойчивые/тяжёлые/основа?`,
      info:'**Ясна Суток №631–633:** Земля ШЕ — устойчивые состояния вещества. **Ясна Года №739:** «Чередование Пран: ШЕ – ХА – ЦИ – ФО – ШЕ».'},
    {id:'kp_fo',w:'ВАЖ',
      q:`Вода ФО (1,5,9): «${lbl(1)}», «${lbl(5)}», «${lbl(9)}» — все текучие/спадающие/переходные?`,
      info:'**Ясна Суток узел 8:** Вода ФО — текучие, спадающие, ищущие низ. На Зодиаке: ♒ Водолей, ♊ Близнецы, ♎ Весы.'},
    {id:'kp_tsi',w:'ВАЖ',
      q:`Воздух ЦИ (2,6,10): «${lbl(2)}», «${lbl(6)}», «${lbl(10)}» — все промежуточные/парящие?`,
      info:'**Ясна Суток узел 8:** Воздух ЦИ — промежуточные, неустойчивый покой. На Зодиаке: ♓ Рыбы, ♋ Рак, ♏ Скорпион.'},
    {id:'kp_ha',w:'ВАЖ',
      q:`Огонь ХА (3,7,11): «${lbl(3)}», «${lbl(7)}», «${lbl(11)}» — все резкие/взрывные/яркие?`,
      info:'**Ясна Суток узел 8:** Огонь ХА — яркие, взрывные моменты. На Зодиаке: ♈ Овен, ♌ Лев, ♐ Стрелец.'},
    {id:'kp_arcs',w:'ЖЕЛ',
      q:'Три Дуги (1-2-3-4-5, 5-6-7-8-9, 9-10-11-0-1) — каждая описывает плавный полный поворот через 5 элементов?',
      info:'**Ясна Суток №899:** «Три Дуги времён сyтoк подобны друг другу. Все они подобны по смыслу. Во всех чередованиях Прав. Но всё-таки они различны по смыслу.»'}
  ];

  // ==================== IV. КОРПУСНЫЕ УНИВЕРСАЛЫ + ЦЕЛОЕ — 8 проверок ====================
  const wholeChecks=[
    {id:'w_isomorphy',w:'ВАЖ',
      q:'Опоры этой Ясны устроены так же, как в Ясне Суток / Года / Жизни? 0 = начало (минимум), 3 = восход, 6 = вершина (максимум), 9 = закат',
      info:'**Ясна Года №5:** «внутреннее устройство всех вещей в природе одинаково». **Ясна Года узел 6 №278:** «Шестиугольник Года устроен так же, как у Сутoк».'},
    {id:'w_mobius',w:'ВАЖ',
      q:'Замыкание (Лента Мёбиуса): Полка 11 готовит Полку 0 = 12 как один цикл?',
      info:'**Ясна Года узел 8 №569–570:** «Змей Питон, заглотивший хвост — древняя Лента Мёбиуса». **Ясна Жизни узел 12 №952:** Полка 0 = Зачатие нового цикла.'},
    {id:'w_accumulation',w:'ВАЖ',
      q:'Закон Накопление→Переход: длинные полки копят, соседние короткие — точки перелива?',
      info:'**Ясна Суток узел 5:** Закон скоростей света/тьмы — переход количества в качество. Долгая фаза — резервуар, короткая — клапан.'},
    {id:'w_chertyozh_yasna',w:'ЖЕЛ',
      q:'Понимаю, что чертёж — лишь начало; Ясна шире чертежа (учение о смыслах, именах, законах)?',
      info:'**Ясна Суток №121:** «Чертёж суток есть только самое начало построения Ясны суток.» **Ясна Суток №122:** «Ясна есть древнее славянское учение об устройстве всего мира.»'},
    {id:'w_param_unique',w:'КРИТ',
      q:'Параметр действительно ОДИН и тот же на всех 12 полках, нигде не «соскакивает» на другую шкалу?',
      info:'**Ясна Года №3:** Ясна как закон устройства одного явления. Параметр должен называться одним словом (свет, тепло, возраст, температура и т.д.).',
      hint:'Если параметр «гуляет» от полки к полке — Ясна построена по двум разным шкалам сразу.'},
    {id:'w_no_dup',w:'ВАЖ',
      q:'Эта Ясна не повторяет существующую в той же области?',
      info:'Каждая Ясна — это новый взгляд на явление. Откройте «+ ещё» и сравните, нет ли уже такой же.'},
    {id:'w_coherent',w:'ВАЖ',
      q:'Прочитав 12 полок подряд — получаю цельный образ явления?',
      info:'Простая проверка на цельность. Если после 12 полок остаётся ощущение разрозненности — не все полки на своих местах.'},
    {id:'w_explain',w:'ЖЕЛ',
      q:'Могу за 3 минуты объяснить эту Ясну не-эксперту, и он поймёт суть?',
      info:'Если объяснил просто — значит понял. Расскажите про параметр, 4 опоры, 2 главные пары противоположностей. Если не получается — формулировки слишком абстрактные.'}
  ];

  // ========== Aggregations ==========
  const fastScore=scoreCount(expressChecks);
  const krestScore=scoreCount(krestChecks);
  const polkiScore=scoreCount(polkiChecks);
  const kprScore=scoreCount(krestyAndPranChecks);
  const wholeScore=scoreCount(wholeChecks);

  const allChecks=[...expressChecks,...krestChecks,...polkiChecks,...krestyAndPranChecks,...wholeChecks];
  const critChecks=allChecks.filter(c=>c.w==='КРИТ');
  const vazhChecks=allChecks.filter(c=>c.w==='ВАЖ');
  const zhelChecks=allChecks.filter(c=>c.w==='ЖЕЛ');
  const critS=scoreCount(critChecks);
  const vazhS=scoreCount(vazhChecks);
  const zhelS=scoreCount(zhelChecks);

  // Verdict
  const expressDone=expressChecks.every(c=>get(c.id)!==undefined);
  const expressPassed=expressChecks.every(c=>{const v=get(c.id);return v===true||v==='na';});
  const allCritDone=critChecks.every(c=>get(c.id)!==undefined);
  const allCritPassed=critChecks.every(c=>{const v=get(c.id);return v===true||v==='na';});

  let status='Не начато',statusColor='#86868b',statusDesc='Начните с Шага 0 (Быстрая проверка) — 7 проверок ядра по правилам автора.';
  if(expressDone&&expressPassed&&!allCritDone){
    status='Шаг 0 ✓ Быстрая проверка пройдена';statusColor='#0071e3';
    statusDesc='Быстрая проверка пройдена. Для глубокой — пройдите Шаги 1–4.';
  }
  if(critS.failed>0){
    status='Не пройдена';statusColor='#E8364F';
    statusDesc=`Провалено ${critS.failed} критических. Структура Ясны не соответствует канону.`;
  }else if(vazhS.failed>0&&allCritDone){
    status='С оговорками';statusColor='#E8A834';
    statusDesc=`Все КРИТ пройдены, но ${vazhS.failed} ВАЖ нарушений. Безупречной — нет.`;
  }
  if(allCritDone&&allCritPassed&&vazhS.failed===0&&vazhS.done>0){
    status='Проверена ✓';statusColor='#30A060';
    statusDesc='Все критические и важные пройдены. Безупречно.';
  }

  const totalDone=critS.done+vazhS.done+zhelS.done;
  const totalCount=critChecks.length+vazhChecks.length+zhelChecks.length;
  const totalFailed=critS.failed+vazhS.failed+zhelS.failed;

  // Export
  const exportReport=()=>{
    const lines=[`# Проверка Ясны «${y.name}»`,'',`Статус: **${status}**`,`Прогресс: ${totalDone}/${totalCount} (${totalCount>0?Math.round(totalDone/totalCount*100):0}%)`,'',`КРИТ: ${critS.pass}/${critChecks.length}` + (critS.failed?` (провал ${critS.failed})`:''),`ВАЖ: ${vazhS.pass}/${vazhChecks.length}` + (vazhS.failed?` (провал ${vazhS.failed})`:''),`ЖЕЛ: ${zhelS.pass}/${zhelChecks.length}`,''];
    [['Шаг 0. Быстрая проверка',expressChecks],['Шаг 1. Опорный Крест',krestChecks],['Шаг 2. 12 Полок',polkiChecks],['Шаг 3. Кресты + Праны',krestyAndPranChecks],['Шаг 4. Целое',wholeChecks]].forEach(([name,checks])=>{
      lines.push(`## ${name}`);checks.forEach(c=>{const v=get(c.id);const m=v===true?'✓':v===false?'✗':v==='na'?'—':'·';lines.push(`- ${m} [${c.w||'—'}] ${c.q}`);});lines.push('');
    });
    const text=lines.join('\n');
    if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>{setCopyFeedback('Скопировано');setTimeout(()=>setCopyFeedback(''),2000);}).catch(()=>{setCopyFeedback('Ошибка');setTimeout(()=>setCopyFeedback(''),2000);});}
    else{setCopyFeedback('Буфер недоступен');setTimeout(()=>setCopyFeedback(''),2000);}
  };

  // Jump to next failed/unanswered
  const jumpToNextIssue=()=>{
    const order=['fast','krest','polki','kpr','whole'];
    const groups={fast:expressChecks,krest:krestChecks,polki:polkiChecks,kpr:krestyAndPranChecks,whole:wholeChecks};
    for(const t of order){
      const issue=groups[t].find(c=>{const v=get(c.id);return v===false||v===undefined;});
      if(issue){
        if(tab!==t)setTab(t);
        setTimeout(()=>{
          const el=document.querySelector(`[data-check-id="${issue.id}"]`);
          if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.animation='pulse 1.2s ease-in-out 2';setTimeout(()=>{if(el)el.style.animation=''},2500);}
        },120);
        return;
      }
    }
  };

  const TabBtn=({id,label,s})=><button onClick={()=>setTab(id)} style={{padding:'7px 12px',borderRadius:8,fontSize:12,fontWeight:tab===id?600:500,color:tab===id?'#0071e3':'#6e6e73',background:tab===id?'rgba(0,122,255,.08)':'transparent',border:'none',display:'flex',alignItems:'center',gap:6,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>
    <span>{label}</span>
    {s&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:tab===id?'rgba(0,122,255,.15)':'#f0f0f2',color:tab===id?'#0071e3':'#86868b',fontWeight:600}}>{s.done}/{s.total}</span>}
  </button>;

  // INTRO SCREEN
  if(showIntro===true){
    return(
      <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'#fff',zIndex:70,display:'flex',flexDirection:'column'}}>
        <div style={{padding:'12px 20px',borderBottom:'1px solid #f0f0f2',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:10,color:'#86868b',textTransform:'uppercase',letterSpacing:0.8,fontWeight:600,marginBottom:2}}>Проверка</div>
            <h2 style={{fontSize:18,fontWeight:700,color:'#1d1d1f',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{y.name}</h2>
          </div>
          <button onClick={onClose} style={{width:36,height:36,borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',fontSize:16,color:'#424245',cursor:'pointer',flexShrink:0}}>✕</button>
        </div>
        <div className='fullpage-content' style={{flex:1,overflowY:'auto',padding:'24px 20px',maxWidth:680,margin:'0 auto',width:'100%'}}>
          <div style={{fontSize:24,fontWeight:700,color:'#1d1d1f',marginBottom:10,lineHeight:1.25}}>Проверка Ясны</div>
          <div style={{fontSize:14,color:'#6e6e73',lineHeight:1.6,marginBottom:16}}>
            Каждый вопрос — с прямой цитатой из книг «Ясна Суток / Ясна Года / Ясна Жизни». <b>Шаг 0 — Быстрая проверка</b>: 7 главных пунктов, ~3 минуты. <b>Шаги 1–4</b> — глубокая проверка по способу построения из книг.
          </div>

          {hasEmpties&&<div style={{padding:'12px 14px',background:'#fff8e8',border:'1px solid #E8A83440',borderRadius:10,marginBottom:20,fontSize:13,color:'#424245',lineHeight:1.55}}>
            <div style={{fontWeight:700,color:'#c07800',marginBottom:4}}>⚠ Не заполнены: {emptyPos.join(', ')}</div>
            Сначала заполните все 12 позиций в Редакторе.
          </div>}

          <div style={{fontSize:13,fontWeight:700,color:'#1d1d1f',marginBottom:10,textTransform:'uppercase',letterSpacing:0.5}}>Пять шагов проверки</div>

          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
            <div style={{padding:'14px 16px',background:'rgba(0,122,255,.04)',borderRadius:12,borderLeft:'3px solid #0071e3'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#0071e3',letterSpacing:1}}>ШАГ 0</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Быстрая проверка · 7 пунктов · ~3 минуты</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Самое важное одной обоймой: Горизонт → Опорный Крест → 12 полок → чередование → замыкание → параметр → уникальность.</div>
            </div>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #6e6e73'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#424245',letterSpacing:1}}>ШАГ 1</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Опорный Крест ({krestChecks.length})</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Способ построения из Ясны Года, узел 1, пп. 11–16: Линия Горизонта × Линия Единения = 4 опоры (0/3/6/9).</div>
            </div>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #6e6e73'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#424245',letterSpacing:1}}>ШАГ 2</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>12 Полок ({polkiChecks.length})</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Главные свойства полок из Ясны Суток, узел 2, пп. 88–97: 12 различных, 6 долгих + 6 коротких, у каждой свойство и событие, цикл замыкается.</div>
            </div>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #6e6e73'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#424245',letterSpacing:1}}>ШАГ 3</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Кресты + Праны ({krestyAndPranChecks.length})</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Кресты Управления и Веры, тройки Вера→Бой→Победа, 4 стихии и Три Дуги. Источники: Ясна Суток узлы 7–8 + Ясна Года узел 9.</div>
            </div>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #6e6e73'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#424245',letterSpacing:1}}>ШАГ 4</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Целое ({wholeChecks.length})</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Законы, общие для всех Ясн: одинаковое устройство, замыкание Мёбиуса, накопление→переход, общий параметр, цельный образ.</div>
            </div>
          </div>

          <div style={{fontSize:13,fontWeight:700,color:'#1d1d1f',marginBottom:10,textTransform:'uppercase',letterSpacing:0.5}}>Веса проверок</div>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:24}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#fff5f5',borderRadius:8,border:'1px solid #E8364F20'}}>
              <span style={{fontSize:10,fontWeight:700,color:'#E8364F',padding:'2px 6px',border:'1px solid #E8364F40',borderRadius:4,flexShrink:0}}>КРИТ</span>
              <span style={{fontSize:13,color:'#424245'}}>Без неё Ясна не считается верной. Цитата из книги всегда указана.</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#fff8e8',borderRadius:8,border:'1px solid #E8A83420'}}>
              <span style={{fontSize:10,fontWeight:700,color:'#E8A834',padding:'2px 6px',border:'1px solid #E8A83440',borderRadius:4,flexShrink:0}}>ВАЖ</span>
              <span style={{fontSize:13,color:'#424245'}}>Влияет на итог: «безупречно / с оговорками».</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#f5f5f7',borderRadius:8,border:'1px solid #d2d2d7'}}>
              <span style={{fontSize:10,fontWeight:700,color:'#86868b',padding:'2px 6px',border:'1px solid #86868b40',borderRadius:4,flexShrink:0}}>ЖЕЛ</span>
              <span style={{fontSize:13,color:'#424245'}}>Желательно, но не обязательно для итога.</span>
            </div>
          </div>

          <div style={{fontSize:13,fontWeight:700,color:'#1d1d1f',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>Подсказки</div>
          <ul style={{fontSize:13,color:'#424245',lineHeight:1.65,marginLeft:18,marginBottom:18}}>
            <li>Каждая проверка имеет кнопку <b>i</b> — раскрывает цитату из конкретного пункта книги.</li>
            <li>Кнопка «—» ставит «не применимо» (например, для абстрактных Ясн без явного Горизонта).</li>
            <li>Можно прятать пройденные через «Скрыть ✓» — фокус только на проблемах.</li>
            <li>Внизу — кнопка «📋 Отчёт» копирует протокол в буфер.</li>
          </ul>
        </div>
        <div style={{padding:'14px 20px',borderTop:'1px solid #f0f0f2',background:'#fff',flexShrink:0,boxShadow:'0 -4px 16px rgba(0,0,0,.04)'}}>
          <div style={{maxWidth:680,margin:'0 auto',display:'flex',gap:10,justifyContent:'flex-end',flexWrap:'wrap'}}>
            <button onClick={onClose} style={{fontSize:14,padding:'10px 18px',borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',color:'#424245',cursor:'pointer'}}>Отмена</button>
            <button onClick={()=>setShowIntro(false)} style={{fontSize:14,fontWeight:600,padding:'10px 20px',borderRadius:10,border:'1px solid #0071e3',background:'#0071e3',color:'#fff',cursor:'pointer',flex:'1 1 auto',minWidth:200}}>Начать с Шага 0 (Быстро) →</button>
          </div>
        </div>
      </div>);
  }

  return(
    <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'#fff',zIndex:70,display:'flex',flexDirection:'column'}}>
      {/* HEADER */}
      <div className="verif-header" style={{display:'flex',alignItems:'center',padding:'12px 20px',borderBottom:'1px solid #f0f0f2',flexShrink:0,gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:'#86868b',textTransform:'uppercase',letterSpacing:0.8,fontWeight:600,marginBottom:2}}>Проверка</div>
          <h2 className="verif-title" style={{fontSize:18,fontWeight:700,color:'#1d1d1f',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{y.name}</h2>
        </div>
        <button onClick={()=>setShowIntro(true)} className="verif-help" title="Показать инструкцию" style={{width:36,height:36,borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',fontSize:15,color:'#424245',cursor:'pointer',flexShrink:0,fontFamily:'Georgia,serif',fontStyle:'italic',fontWeight:700}}>?</button>
        <button onClick={onClose} className="verif-close" style={{width:36,height:36,borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',fontSize:16,color:'#424245',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
      </div>

      {/* STATUS + PROGRESS */}
      <div className="verif-sub" style={{padding:'8px 20px',borderBottom:'1px solid #f0f0f2',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
          <span style={{fontSize:13,color:statusColor,fontWeight:600}}>{status}</span>
          <span style={{fontSize:11,color:'#86868b'}}>
            <span style={{color:'#E8364F'}}>КРИТ {critS.pass}/{critChecks.length}</span>
            {' · '}<span style={{color:'#c07800'}}>ВАЖ {vazhS.pass}/{vazhChecks.length}</span>
            {' · '}<span>ЖЕЛ {zhelS.pass}/{zhelChecks.length}</span>
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{flex:1,height:6,background:'#f0f0f2',borderRadius:3,overflow:'hidden',position:'relative'}}>
            <div style={{position:'absolute',top:0,left:0,height:'100%',width:(totalCount>0?((totalDone-totalFailed)/totalCount*100):0)+'%',background:'#30A060',transition:'width .3s'}}/>
            <div style={{position:'absolute',top:0,left:(totalCount>0?((totalDone-totalFailed)/totalCount*100):0)+'%',height:'100%',width:(totalCount>0?(totalFailed/totalCount*100):0)+'%',background:'#E8364F',transition:'width .3s'}}/>
          </div>
          <span style={{fontSize:11,color:'#86868b',fontWeight:600,minWidth:52,textAlign:'right'}}>{totalDone}/{totalCount}</span>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="verif-actions-row" style={{padding:'6px 20px 8px',borderBottom:'1px solid #f0f0f2',flexShrink:0,display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
        {(totalFailed>0||totalDone<totalCount)&&<button onClick={jumpToNextIssue} style={{fontSize:11,color:'#0071e3',padding:'5px 10px',border:'1px solid #0071e320',borderRadius:7,background:'rgba(0,122,255,.06)',cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:4}}>
          <span>→</span><span>К следующему</span>
        </button>}
        <button onClick={()=>setHidePassed(v=>!v)} style={{fontSize:11,color:hidePassed?'#0071e3':'#6e6e73',padding:'5px 10px',border:`1px solid ${hidePassed?'#0071e3':'#e5e5ea'}`,borderRadius:7,background:hidePassed?'rgba(0,122,255,.06)':'#fff',cursor:'pointer',fontWeight:500}}>{hidePassed?'Показать все':'Скрыть ✓'}</button>
        {totalDone>0&&<button onClick={exportReport} style={{fontSize:11,color:'#424245',padding:'5px 10px',border:'1px solid #e5e5ea',borderRadius:7,background:'#fff',cursor:'pointer',fontWeight:500}}>{copyFeedback||'📋 Отчёт'}</button>}
        <div style={{flex:1}}/>
        <button onClick={()=>{if(confirm('Сбросить все ответы для этой Ясны?')){const keys=Object.keys(vs).filter(k=>k.startsWith(y.name+'_'));const nv={...vs};keys.forEach(k=>delete nv[k]);setVs(nv);setShowIntro(true);}}} style={{fontSize:11,color:'#E8364F',padding:'5px 10px',border:'1px solid #E8364F30',borderRadius:7,background:'#fff',cursor:'pointer'}}>Сбросить</button>
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:4,padding:'8px 20px',borderBottom:'1px solid #f0f0f2',flexShrink:0,overflowX:'auto'}}>
        <TabBtn id="fast" label="⚡ Шаг 0 · Быстро" s={fastScore}/>
        <TabBtn id="krest" label="Шаг 1 · Опорный Крест" s={krestScore}/>
        <TabBtn id="polki" label="Шаг 2 · 12 Полок" s={polkiScore}/>
        <TabBtn id="kpr" label="Шаг 3 · Кресты + Праны" s={kprScore}/>
        <TabBtn id="whole" label="Шаг 4 · Целое" s={wholeScore}/>
      </div>

      <div className='fullpage-content' style={{flex:1,overflowY:'auto',padding:'16px 20px',maxWidth:820,margin:'0 auto',width:'100%'}}>
        {hasEmpties&&<div style={{padding:'10px 14px',background:'#fff8e8',border:'1px solid #E8A83440',borderRadius:10,marginBottom:14,fontSize:12,color:'#424245',lineHeight:1.55}}>
          <div style={{fontWeight:700,color:'#c07800',marginBottom:4}}>⚠ Не заполнены позиции: {emptyPos.join(', ')}</div>
          Проверка достоверна только на полной Ясне. Сначала заполните все 12 позиций в Редакторе.
        </div>}

        <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#f5f5f7',borderRadius:10,marginBottom:14,fontSize:11,color:'#6e6e73',flexWrap:'wrap'}}>
          <span style={{fontWeight:600,color:'#424245'}}>Как отвечать:</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:16,height:16,borderRadius:4,border:'1.5px solid #30A060',background:'#30A06012',color:'#30A060',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>✓</span>верно</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:16,height:16,borderRadius:4,border:'1.5px solid #E8364F',background:'#E8364F12',color:'#E8364F',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>✗</span>неверно</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:16,height:16,borderRadius:4,border:'1.5px solid #86868b',background:'#86868b12',color:'#86868b',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>—</span>n/a</span>
          <span style={{color:'#aeaeb2'}}>· нажмите <span style={{display:'inline-flex',width:14,height:14,borderRadius:'50%',border:'1px solid #c7c7cc',color:'#86868b',fontSize:9,alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif',fontStyle:'italic',fontWeight:700}}>i</span> чтобы увидеть цитату из книги</span>
        </div>

        {tab==='fast'&&<>
          <div style={{fontSize:12,color:'#1d4ed8',marginBottom:12,lineHeight:1.55,padding:'10px 12px',background:'rgba(0,122,255,.06)',borderRadius:8,borderLeft:'3px solid #0071e3'}}>
            <b>⚡ Шаг 0. Быстрая проверка</b> — 7 пунктов ядра. Прямой проход по канону: алгоритм Дианоме (Ясна Года №11–16) + свойства 12 полок (Ясна Суток №88–97) + замыкание (Ясна Суток №73). ~3 минуты.
          </div>
          <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px'}}>
            {expressChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
          </div>
          {expressDone&&expressPassed&&<div style={{marginTop:14,padding:'14px 16px',background:'rgba(0,113,227,.06)',border:'1px solid rgba(0,113,227,.3)',borderRadius:12,fontSize:13,color:'#1d4ed8',lineHeight:1.55}}>
            <b>Быстрая проверка пройдена ✓</b> — базовая структура соответствует канону. Для глубокой проверки → Шаг 1 (Опорный Крест) и далее.
          </div>}
        </>}

        {tab==='krest'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Шаг 1. Опорный Крест</b> — авторский алгоритм построения Ясны (Ясна Года №11–16). Линия Горизонта × Линия Единения = 4 опоры (0/3/6/9).
          </div>
          <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px'}}>
            {krestChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
          </div>
        </>}

        {tab==='polki'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Шаг 2. 12 Полок</b> — ключевые определения автора из Ясны Суток, узел 2, пункты 88–97. Самая короткая формулировка во всех трёх книгах.
          </div>
          <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px'}}>
            {polkiChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
          </div>
        </>}

        {tab==='kpr'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Шаг 3. Кресты + Праны</b> — Кресты Управления и Веры, тройки Вера→Бой→Победа, 4 стихии (Земля/Вода/Воздух/Огонь). Ясна Суток узлы 7–8 + Ясна Года узел 9.
          </div>
          <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px'}}>
            {krestyAndPranChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
          </div>
        </>}

        {tab==='whole'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Шаг 4. Целое</b> — общие для всех Ясн законы (одинаковое устройство, Лента Мёбиуса, Накопление→Переход) + проверка на цельность.
          </div>
          <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px',marginBottom:14}}>
            {wholeChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
          </div>

          <div style={{padding:'16px 20px',background:`linear-gradient(135deg,${statusColor}08,${statusColor}14)`,border:`1px solid ${statusColor}40`,borderRadius:14,marginTop:20}}>
            <div style={{fontSize:11,fontWeight:700,color:statusColor,letterSpacing:0.5,textTransform:'uppercase',marginBottom:6}}>Итоговый вердикт</div>
            <div style={{fontSize:18,fontWeight:700,color:'#1d1d1f',marginBottom:8}}>{status}</div>
            <div style={{fontSize:13,color:'#424245',lineHeight:1.6,marginBottom:10}}>{statusDesc}</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:11,color:'#6e6e73'}}>
              <span><b style={{color:'#E8364F'}}>КРИТ:</b> {critS.pass}/{critChecks.length}{critS.failed>0?`, ${critS.failed} провалено`:''}</span>
              <span><b style={{color:'#E8A834'}}>ВАЖ:</b> {vazhS.pass}/{vazhChecks.length}</span>
              <span><b style={{color:'#86868b'}}>ЖЕЛ:</b> {zhelS.pass}/{zhelChecks.length}</span>
            </div>
          </div>
        </>}
      </div>
    </div>);
}




// ═══════════════════════════════════════════════════════════════════
// Yasna3DView — настоящий 3D через Three.js (prod)
// Премиум-сфера: 12 полок-планет на экваторе, N/S полюса,
// механики как платоновы тела (октаэдр, бипирамида, тетраэдр)
// ═══════════════════════════════════════════════════════════════════


// (Yasna3DView + sprite-хелперы вынесены в core/yasna-3d.js)
const Yasna3DView = window.Yasna3DView;

// Expose to global namespace for lessons + app to use
window.YasnaCore = {
  CR, PR, REF, T, FL,
  Star, Yasna3DView, Info, OverlayLegend, Editor, OverlayPicker, Picker, Verification,
  POS_DESC, CROSS_CTX, PRANA_CTX, OPP_DESC, GLOSS
};
