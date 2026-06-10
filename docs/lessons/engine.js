// ═══════════════════════════════════════════════════════════════════
// LESSONS ENGINE — Layer 2
// All block components (Hero, Speaker, Explanation, Science, Gate, etc.)
// + orchestrators: ScrollLesson, Lesson, LessonPicker
// + helpers: renderRichText, YasnaAvatar, ScienceTag, SciencePopupSheet
// ═══════════════════════════════════════════════════════════════════

const{useState,useMemo,useEffect,useRef,useCallback}=React;


// Pull required constants from core
const {T, CR, PR, REF, FL, POS_DESC, CROSS_CTX, PRANA_CTX, OPP_DESC, GLOSS} = window.YasnaCore;
const {Star, Info, OverlayLegend, Editor, OverlayPicker, Picker, Verification} = window.YasnaCore;

// Initialize lessons namespace
window.YasnaLessons = window.YasnaLessons || {lessons: []};

// ═══════════════════════════════════════════════════════════════════
// LESSON COMPONENTS
// ═══════════════════════════════════════════════════════════════════

// Simplified star for lesson visualization — shows only what's needed per mode
function LessonStar({mode,highlighted=[],labels={},visiblePositions=null,showNumbers=true,showCircle=true,showLabels=true,starLines=false,transformProgress=0,focusType=null,newPositions=[]}){
  // mode: 'empty' | 'halves' | 'cross-outline' | 'cross-labeled' | 'longs' | 'shorts' | 'full' | 'star'
  // visiblePositions: null = use mode default; array = only show these (for step-by-step animation)
  // transformProgress: 0..1 — for animation from circle to star (used in 'star' mode)
  const S=400,cx=S/2,cy=S/2,R=140;
  const angDeg=(i)=>270-i*30;
  const xy=(i)=>{const a=angDeg(i)*Math.PI/180;return{x:cx+R*Math.cos(a),y:cy-R*Math.sin(a)};};
  const pts=Array.from({length:12},(_,i)=>xy(i));
  const labelXY=(i)=>{const a=angDeg(i)*Math.PI/180;const LR=R+50;return{x:cx+LR*Math.cos(a),y:cy-LR*Math.sin(a)};};
  const anch=(i)=>{const x=labelXY(i).x;return Math.abs(x-cx)<8?'middle':x<cx?'end':'start';};

  // Default labels from Ясна Суток (full 12)
  const sutokLabels={0:'Ночь',1:'Искра',2:'Заря',3:'Утро',4:'Восход',5:'Утр.Салют',6:'День',7:'Обед',8:'Закат',9:'Вечер',10:'Сумерки',11:'Веч.Салют'};

  // Which positions show as opornyi (red filled)
  const opornyi=[0,3,6,9];
  // Long (даже) and short (нечётные)
  const longs=[0,2,4,6,8,10];
  const shorts=[1,3,5,7,9,11];

  const isVisible=(i)=>{
    if(visiblePositions)return visiblePositions.includes(i);
    if(mode==='cross-outline'||mode==='cross-labeled')return opornyi.includes(i);
    if(mode==='longs')return longs.includes(i);
    if(mode==='shorts')return true; // shows both — longs dimmed + shorts
    if(mode==='full'||mode==='star')return true;
    return false;
  };
  const isHighlighted=(i)=>highlighted.length===0?true:highlighted.includes(i);

  // For star mode — draw connecting lines
  const showStarLines=starLines||mode==='star';

  return(
    <svg viewBox={`-200 -30 ${S+400} ${S+60}`} style={{width:'100%',height:'100%',display:'block'}}>
      {/* Halves background — only for halves mode (subtle bg tint), not for cross-labeled */}
      {(mode==='halves'||mode==='cross-outline'||mode==='longs'||mode==='shorts'||mode==='full')&&<>
        <path d={`M ${cx-R-30} ${cy} A ${R+30} ${R+30} 0 0 1 ${cx+R+30} ${cy} Z`} fill="rgba(255,200,40,.07)"/>
        <path d={`M ${cx-R-30} ${cy} A ${R+30} ${R+30} 0 0 0 ${cx+R+30} ${cy} Z`} fill="rgba(40,60,160,.05)"/>
        <line x1={cx-R-30} y1={cy} x2={cx+R+30} y2={cy} stroke="#e5e5ea" strokeWidth="1" strokeDasharray="3 4"/>
      </>}

      {/* Halves labels (only in halves mode) */}
      {mode==='halves'&&<>
        <text x={cx} y={cy-R-12} textAnchor="middle" fontSize="16" fontWeight="600" fill="#c07800">☀️ День · Свет</text>
        <text x={cx} y={cy+R+24} textAnchor="middle" fontSize="16" fontWeight="600" fill="#4060a0">🌙 Ночь · Тьма</text>
      </>}

      {/* Circle */}
      {showCircle&&(mode==='cross-outline'||mode==='cross-labeled'||mode==='longs'||mode==='shorts'||mode==='full')&&<>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e5e5ea" strokeWidth="1"/>
      </>}

      {/* Cross lines: in cross-labeled mode — ACCENT colors (visible cross);
          in other modes — technical dashed gray */}
      {mode==='cross-labeled'&&<>
        {/* Vertical (0↔6, foundations) — gold */}
        <line x1={cx} y1={cy-R-6} x2={cx} y2={cy+R+6} stroke="#E8A52B" strokeWidth="4" strokeLinecap="round"/>
        {/* Horizontal (3↔9, transitions) — blue */}
        <line x1={cx-R-6} y1={cy} x2={cx+R+6} y2={cy} stroke="#3B7BC7" strokeWidth="4" strokeLinecap="round"/>
      </>}
      {(mode==='cross-outline'||mode==='longs'||mode==='shorts'||mode==='full')&&<>
        <line x1={cx} y1={cy-R-20} x2={cx} y2={cy+R+20} stroke="#e5e5ea" strokeWidth="1" strokeDasharray="3 4"/>
      </>}

      {/* Star connecting lines — two overlapping hexagons make the Ясна-Звезда */}
      {showStarLines&&<>
        {/* Hexagon through even (long) positions: 0, 2, 4, 6, 8, 10 */}
        <polygon points={[0,2,4,6,8,10].map(i=>`${pts[i].x},${pts[i].y}`).join(' ')} fill="none" stroke="#FFB020" strokeWidth="1.8" opacity={mode==='star'?.85:.45}/>
        {/* Hexagon through odd (short) positions: 1, 3, 5, 7, 9, 11 */}
        <polygon points={[1,3,5,7,9,11].map(i=>`${pts[i].x},${pts[i].y}`).join(' ')} fill="none" stroke="#4090D8" strokeWidth="1.8" opacity={mode==='star'?.85:.45}/>
      </>}

      {/* Individual position dots */}
      {Array.from({length:12}).map((_,i)=>{
        if(!isVisible(i))return null;
        const p=pts[i];
        const isOpor=opornyi.includes(i);
        const isLong=i%2===0;
        const isNew=newPositions.includes(i);
        // Focus logic: if focusType set, dim positions that aren't in focus
        let focusOpacity=1;
        if(focusType==='longs'&&!isLong)focusOpacity=.18;
        if(focusType==='shorts'&&isLong)focusOpacity=.18;
        const highlighted=isHighlighted(i);
        const opacity=highlighted?focusOpacity:.25;
        // Colors: opor red, long orange, short blue  (simplified pedagogical palette)
        const fill=isOpor?'#E8364F':(isLong?'#FFB020':'#4090D8');
        // In focus: focused type a bit bigger, non-focused smaller
        let r=isOpor?18:(isLong?14:12);
        if(focusType==='shorts'&&!isLong)r=isOpor?19:15;
        if(focusType==='longs'&&isLong)r=isOpor?19:16;
        return<g key={i} opacity={opacity} style={{transition:'opacity .3s'}}>
          {/* Pulse glow for newly added (freshly animated in) positions */}
          {isNew&&<circle cx={p.x} cy={p.y} r={r+8} fill={fill} opacity=".18">
            <animate attributeName="r" values={`${r+4};${r+14};${r+4}`} dur="1.4s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values=".25;.05;.25" dur="1.4s" repeatCount="indefinite"/>
          </circle>}
          <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke="#fff" strokeWidth="2" style={{transition:'r .3s'}}/>
          {showNumbers&&<text x={p.x} y={p.y+5} textAnchor="middle" fontSize={isOpor?'16':'13'} fontWeight="700" fill="#fff">{i}</text>}
        </g>;
      })}

      {/* Position labels */}
      {showLabels&&Array.from({length:12}).map((_,i)=>{
        if(!isVisible(i))return null;
        const lp=labelXY(i);
        const isOpor=opornyi.includes(i);
        const isLong=i%2===0;
        // Always show label for any visible position
        const lbl=labels[i]||sutokLabels[i];
        if(!lbl)return null;
        let focusOpacity=1;
        if(focusType==='longs'&&!isLong)focusOpacity=.2;
        if(focusType==='shorts'&&isLong)focusOpacity=.2;
        const highlighted=isHighlighted(i);
        const opacity=highlighted?focusOpacity:.3;
        // Focused labels slightly bolder
        const inFocus=!focusType||(focusType==='longs'&&isLong)||(focusType==='shorts'&&!isLong);
        return<text key={'l'+i} x={lp.x} y={lp.y+4} textAnchor={anch(i)} fontSize={isOpor?'24':'20'} fontWeight={inFocus?(isOpor?'700':'600'):'400'} fill={inFocus?'#1d1d1f':'#6e6e73'} opacity={opacity} style={{transition:'opacity .3s, font-weight .3s'}}>{lbl}</text>;
      })}
    </svg>);
}

// Step 1: Intro screen
// Step 2: Animation showing Sun's path
// Step 3: Drag-n-drop halves
// Step 4: Animation — four pillars (Опорный Крест) appear
// Step router
// Step 5: DnD — place opornyi on 4 positions
// Step 6: Animate the 6 long states appearing (all even positions: 0, 2, 4, 6, 8, 10)
// Step 7: Shorts animation + inline quiz
// Step 8: Transform circle → star
// Step 9: Carousel of examples
// Animated ring showing a cyclical phenomenon — each position lights up in sequence
// with a theme-specific centerpiece (sun for day, heart for life, flame for fire).
// Step 10: Final quiz
// Step 11: Summary of achievements
// Step 12: Next steps after completion
// Main Lesson component
// ═══════════════════════════════════════════════════════════════════
// SCROLL-FORMAT LESSON — progressive disclosure (gate-based)
// Palette: #FBFAF7 bg, #0071e3 accent, #F2F7FD speaker bg, охра для сценариев
// ═══════════════════════════════════════════════════════════════════

// Markdown-lite: **bold** + \n → <br>
function renderRichText(text){
  if(!text) return null;
  const parts=text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p,i)=>{
    if(p.startsWith('**')&&p.endsWith('**'))
      return<b key={i} style={{fontWeight:700,color:'#0D1B2A'}}>{p.slice(2,-2)}</b>;
    const lines=p.split('\n');
    return lines.map((line,j)=>(
      <React.Fragment key={i+'_'+j}>
        {j>0&&<br/>}
        {line}
      </React.Fragment>
    ));
  });
}

// ───── Block components ─────

function HeroBlock({block}){
  return(
    <div style={{padding:'32px 24px 20px',maxWidth:680,margin:'0 auto'}}>
      {block.eyebrow&&<div style={{fontSize:11,color:'#0071e3',textTransform:'uppercase',letterSpacing:1.1,fontWeight:700,marginBottom:16}}>{block.eyebrow}</div>}
      <h1 style={{fontSize:30,fontWeight:800,color:'#0D1B2A',marginBottom:16,lineHeight:1.15,letterSpacing:'-0.5px'}}>{block.title}</h1>
      {block.lead&&<p style={{fontSize:16,color:'#3D4852',lineHeight:1.6,fontWeight:400,marginBottom:0}}>{renderRichText(block.lead)}</p>}
      <div style={{height:2,width:48,background:'#0071e3',marginTop:24,borderRadius:2}}/>
    </div>);
}

// ─── SpiralMap — course progress star ───
// Показывает 12 полочек; learned (серые ✓), current (цветные), locked (блёклые).
// Используется в начале и конце каждого урока как якорь концентрической спирали.
function SpiralMap({block}){
  const size=170;
  const cx=size/2, cy=size/2;
  const r=size*0.38;
  const learned=new Set(block.learned||[]);
  const current=new Set(block.current||[]);
  // Position 0 at bottom, 6 at top, 3 at left, 9 at right (canonical Yasna orientation)
  // Clockwise: i=0 bottom → i=3 LEFT → i=6 top → i=9 RIGHT
  const posAngle=(i)=>-Math.PI/2 - (i/12)*Math.PI*2; // i=0 → bottom, clockwise
  const dots=[];
  for(let i=0;i<12;i++){
    const ang=posAngle(i);
    const x=cx+Math.cos(ang)*r;
    const y=cy-Math.sin(ang)*r;
    const isLearned=learned.has(i);
    const isCurrent=current.has(i);
    let fill='#E0E5EA', stroke='none', strokeW=0, textFill='#B0B8C0';
    let dotR=5.5;
    if(isCurrent){
      fill='#0071e3'; textFill='#fff'; dotR=9; stroke='#fff'; strokeW=2.5;
    } else if(isLearned){
      fill='#4A9D68'; textFill='#fff'; dotR=6.5;
    }
    dots.push(
      <g key={i}>
        <circle cx={x} cy={y} r={dotR} fill={fill} stroke={stroke} strokeWidth={strokeW}/>
        {(isLearned||isCurrent)&&<text x={x} y={y} fontSize={isCurrent?9:8} fill={textFill} textAnchor="middle" dominantBaseline="central" fontWeight="700">{i}</text>}
      </g>
    );
  }
  // Connect learned + current with a subtle path
  const activePositions=[...learned,...current].sort((a,b)=>a-b);
  let pathD='';
  activePositions.forEach((i,idx)=>{
    const ang=posAngle(i);
    const x=cx+Math.cos(ang)*r;
    const y=cy-Math.sin(ang)*r;
    pathD+=(idx===0?'M':'L')+' '+x+' '+y+' ';
  });

  const currentArr=[...current].sort((a,b)=>a-b);
  const learnedArr=[...learned].sort((a,b)=>a-b);

  return(
    <div style={{padding:'12px 24px 16px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#F8FAFC',borderRadius:16,padding:'18px 20px',border:'1px solid #E5E9EF'}}>
        {block.eyebrow&&<div style={{fontSize:10.5,color:'#0071e3',textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:4}}>{block.eyebrow}</div>}
        {block.title&&<div style={{fontSize:15,fontWeight:700,color:'#0D1B2A',marginBottom:block.subtitle?2:12,lineHeight:1.35}}>{block.title}</div>}
        {block.subtitle&&<div style={{fontSize:12.5,color:'#6E7781',marginBottom:12,lineHeight:1.5}}>{block.subtitle}</div>}
        <div style={{display:'flex',gap:16,alignItems:'center'}}>
          <div style={{flexShrink:0}}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* Faint outer circle */}
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E9EF" strokeWidth="1"/>
              {activePositions.length>1&&<path d={pathD} stroke="#0071e3" strokeWidth="1.5" fill="none" opacity="0.3" strokeDasharray="3 3"/>}
              {dots}
            </svg>
          </div>
          <div style={{flex:1,minWidth:0,fontSize:12.5,lineHeight:1.55}}>
            {learnedArr.length>0&&(
              <div style={{marginBottom:8,display:'flex',gap:8,alignItems:'flex-start'}}>
                <span style={{flexShrink:0,marginTop:3,width:10,height:10,borderRadius:'50%',background:'#4A9D68',display:'inline-block'}}/>
                <div><b style={{color:'#0D1B2A'}}>Уже знаешь:</b> <span style={{color:'#3D4852'}}>{block.learnedLabels||'полочки '+learnedArr.join(', ')}</span></div>
              </div>
            )}
            {currentArr.length>0&&(
              <div style={{marginBottom:learnedArr.length>0?0:0,display:'flex',gap:8,alignItems:'flex-start'}}>
                <span style={{flexShrink:0,marginTop:3,width:10,height:10,borderRadius:'50%',background:'#0071e3',display:'inline-block'}}/>
                <div><b style={{color:'#0D1B2A'}}>Сегодня:</b> <span style={{color:'#3D4852'}}>{block.currentLabels||'полочки '+currentArr.join(', ')}</span></div>
              </div>
            )}
            {block.upcomingLabels&&(
              <div style={{marginTop:8,display:'flex',gap:8,alignItems:'flex-start'}}>
                <span style={{flexShrink:0,marginTop:3,width:10,height:10,borderRadius:'50%',background:'#E0E5EA',display:'inline-block'}}/>
                <div><b style={{color:'#0D1B2A'}}>Дальше:</b> <span style={{color:'#6E7781'}}>{block.upcomingLabels}</span></div>
              </div>
            )}
          </div>
        </div>
        {block.note&&<div style={{fontSize:12.5,color:'#3D4852',lineHeight:1.6,marginTop:14,paddingTop:12,borderTop:'1px solid #E5E9EF'}}>{renderRichText(block.note)}</div>}
      </div>
    </div>);
}

function TocBlock({block}){
  return(
    <div style={{padding:'12px 24px 20px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#fff',border:'1px solid #E5E5EA',borderRadius:16,padding:'24px 24px',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        <div style={{fontSize:19,fontWeight:700,color:'#0D1B2A',marginBottom:14,letterSpacing:'-0.2px'}}>{block.title||'Что в этом уроке'}</div>
        {block.intro&&<div style={{fontSize:14.5,color:'#3D4852',lineHeight:1.65,marginBottom:16}}>{renderRichText(block.intro)}</div>}
        {block.items&&block.items.length>0&&(
          <>
            {block.itemsHeader&&<div style={{fontSize:14,color:'#0D1B2A',fontWeight:600,marginBottom:10}}>{block.itemsHeader}</div>}
            <ul style={{listStyle:'none',padding:0,margin:0}}>
              {block.items.map((item,i)=>(
                <li key={i} style={{display:'flex',gap:10,marginBottom:10,fontSize:14,color:'#3D4852',lineHeight:1.55}}>
                  <span style={{flexShrink:0,marginTop:1,color:'#0071e3',fontWeight:700}}>{i+1}.</span>
                  <span>{renderRichText(item)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {block.outcomes&&block.outcomes.length>0&&(
          <div style={{marginTop:18,paddingTop:16,borderTop:'1px solid #F0F0F2'}}>
            <div style={{fontSize:13,color:'#0D1B2A',fontWeight:600,marginBottom:10}}>{block.outcomesHeader||'После урока ты сможешь:'}</div>
            <ul style={{listStyle:'none',padding:0,margin:0}}>
              {block.outcomes.map((o,i)=>(
                <li key={i} style={{display:'flex',gap:10,marginBottom:8,fontSize:13.5,color:'#3D4852',lineHeight:1.55}}>
                  <span style={{flexShrink:0,marginTop:2,color:'#2D7A4A'}}>✓</span>
                  <span>{renderRichText(o)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {block.duration&&(
          <div style={{marginTop:18,paddingTop:14,borderTop:'1px solid #F0F0F2',display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#6E7781'}}>
            <span style={{fontSize:14}}>⏱</span>
            <span>Время прохождения: <b style={{color:'#0D1B2A',fontWeight:600}}>{block.duration}</b></span>
          </div>
        )}
      </div>
    </div>);
}

// Custom avatar: tiny Ясна star fragment — geometric identity mark
function YasnaAvatar({size=40}){
  // Real logo from the brand guide (docs/assets/logo-yasna.png).
  // Replaces the earlier procedural SVG — PNG gives precise visual match.
  return(
    <img
      src="assets/logo-yasna.png"
      alt="Ясна"
      width={size}
      height={size}
      style={{display:'block',width:size,height:size,objectFit:'contain'}}
    />);
}

// ─── Science Tag + Popup ───────────────────────────────────────
// Compact "🔬 Научно" chip in the corner of an explanation/speaker block.
// Tapping opens a bottom-sheet popup with the research details.
// Data shape for the parent block:
//   science: {
//     area: 'Когнитивная психология',
//     title: 'Эвристика доступности',
//     citation: 'Tversky & Kahneman, 1973',
//     body: '...'
//   }
function ScienceTag({science,onOpen}){
  if(!science)return null;
  return(
    <button onClick={onOpen}
      style={{
        display:'inline-flex',alignItems:'center',gap:6,
        padding:'7px 12px',borderRadius:20,
        background:'#EEF4FD',border:'1px solid #B8D4F5',
        color:'#0060C0',fontSize:11.5,fontWeight:600,
        letterSpacing:0.2,
        cursor:'pointer',fontFamily:'inherit',flexShrink:0,
        minHeight:34,
        transition:'all .15s',
        boxShadow:'0 1px 2px rgba(0,96,192,.08)',
      }}
      onMouseEnter={e=>{e.currentTarget.style.background='#DEEAFB';e.currentTarget.style.borderColor='#7FB0E8';}}
      onMouseLeave={e=>{e.currentTarget.style.background='#EEF4FD';e.currentTarget.style.borderColor='#B8D4F5';}}
      aria-label="Открыть научное обоснование"
    >
      <span style={{fontSize:13}}>🔬</span>
      <span>Наука</span>
      <span style={{fontSize:13,fontWeight:700,marginLeft:-2}}>→</span>
    </button>
  );
}

function SciencePopupSheet({science,onClose}){
  // Lock body scroll while open
  useEffect(()=>{
    const prev=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=prev;};
  },[]);
  // Close on Escape
  useEffect(()=>{
    const h=(e)=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',h);
    return()=>window.removeEventListener('keydown',h);
  },[onClose]);

  // Prevent bubbling explicitly — use mousedown+click pair
  const handleClose=(e)=>{
    if(e){e.preventDefault();e.stopPropagation();}
    onClose();
  };
  const handleOverlayClick=(e)=>{
    // Only close if the actual overlay itself was clicked, not any child
    if(e.target===e.currentTarget){
      handleClose(e);
    }
  };

  // Render the popup via Portal into document.body. Reason: any ancestor
  // using `transform`, `filter`, `perspective` or `will-change` creates
  // a new containing block for position:fixed. Our lesson blocks use
  // `transform: translateY(...)` animation (scroll-lesson-block-appear)
  // which would trap fixed positioning inside the block container,
  // leaving the popup covering only part of the viewport.
  // Portal guarantees the popup is always a direct child of <body>.

  const popupElement=(
    <div
      onClick={handleOverlayClick}
      style={{
        position:'fixed',inset:0,zIndex:9999,
        background:'rgba(15,27,42,.55)',
        display:'flex',alignItems:'flex-end',justifyContent:'center',
        animation:'scienceFade .2s ease-out',
      }}
    >
      <div
        style={{
          width:'100%',maxWidth:680,
          background:'#fff',
          borderTopLeftRadius:20,borderTopRightRadius:20,
          padding:'20px 22px 32px',
          maxHeight:'85vh',overflowY:'auto',
          boxShadow:'0 -10px 40px rgba(15,27,42,.2)',
          animation:'scienceSlide .25s ease-out',
          position:'relative',
        }}
      >
        {/* Close X button — always visible at top right */}
        <button
          onClick={handleClose}
          aria-label="Закрыть"
          style={{
            position:'absolute',top:14,right:14,
            width:36,height:36,borderRadius:'50%',
            border:'none',background:'#F2F4F7',
            color:'#5C6A80',fontSize:20,fontWeight:400,
            cursor:'pointer',fontFamily:'inherit',
            display:'flex',alignItems:'center',justifyContent:'center',
            padding:0,lineHeight:1,zIndex:2,
          }}
        >×</button>

        {/* Drag handle */}
        <div style={{width:40,height:4,background:'#D1D5DB',borderRadius:2,margin:'0 auto 16px'}}/>

        {/* Area label */}
        {science.area&&(
          <div style={{fontSize:10.5,color:'#5C6A80',textTransform:'uppercase',letterSpacing:1.1,fontWeight:700,marginBottom:8,display:'flex',alignItems:'center',gap:6,paddingRight:40}}>
            <span style={{fontSize:12}}>🔬</span>
            <span>Научная опора · {science.area}</span>
          </div>
        )}

        {/* Title */}
        {science.title&&<div style={{fontSize:17,fontWeight:700,color:'#0D1B2A',marginBottom:4,lineHeight:1.3,letterSpacing:'-0.2px',paddingRight:40}}>{science.title}</div>}

        {/* Citation */}
        {science.citation&&<div style={{fontSize:12,color:'#6B7A90',fontStyle:'italic',marginBottom:14}}>{science.citation}</div>}

        {/* Body */}
        <div style={{fontSize:14.5,color:'#1F2933',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{renderRichText(science.body||'')}</div>

        {/* Note */}
        {science.note&&<div style={{marginTop:14,padding:'12px 14px',background:'#F4F7FC',borderRadius:10,border:'1px solid #DCE6F2',fontSize:13,color:'#3D5A80',lineHeight:1.55}}>{renderRichText(science.note)}</div>}

        {/* Bottom close button */}
        <div style={{marginTop:22,textAlign:'center'}}>
          <button onClick={handleClose}
            style={{fontSize:14,fontWeight:600,padding:'12px 36px',borderRadius:12,border:'none',background:'#0071E3',color:'#fff',cursor:'pointer',fontFamily:'inherit',boxShadow:'0 2px 8px rgba(0,113,227,.25)'}}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(popupElement,document.body);
}

function SpeakerBlock({block}){
  const useAvatarLogo=block.avatar==='logo';
  const[popup,setPopup]=useState(false);
  return(
    <div style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#F4F8FD',borderRadius:16,padding:'20px 22px',border:'1px solid #E0ECF7'}}>
        {block.science&&(
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <ScienceTag science={block.science} onOpen={()=>setPopup(true)}/>
          </div>
        )}
        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}>
          {useAvatarLogo
            ? <div style={{flexShrink:0,borderRadius:'50%',width:52,height:52,overflow:'hidden',background:'#fff',border:'1px solid #E0ECF7',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 3px rgba(15,27,42,.06)'}}><YasnaAvatar size={44}/></div>
            : <div style={{width:40,height:40,borderRadius:'50%',background:block.avatarColor||'#0071e3',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,flexShrink:0,boxShadow:'0 2px 6px rgba(0,113,227,.25)'}}>{block.avatar||'?'}</div>
          }
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'#0D1B2A',lineHeight:1.2}}>{block.name}</div>
            {block.role&&<div style={{fontSize:12,color:'#6E7781',marginTop:1}}>{block.role}</div>}
          </div>
        </div>
        <div style={{fontSize:15,color:'#1F2933',lineHeight:1.65,whiteSpace:'pre-wrap'}}>{renderRichText(block.text)}</div>
      </div>
      {popup&&<SciencePopupSheet science={block.science} onClose={()=>setPopup(false)}/>}
    </div>);
}

function ExplanationBlock({block}){
  const[popup,setPopup]=useState(false);
  return(
    <div style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#fff',borderRadius:14,padding:'22px 24px',border:'1px solid #E8E3D9',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        {block.science&&(
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <ScienceTag science={block.science} onOpen={()=>setPopup(true)}/>
          </div>
        )}
        {block.title&&<div style={{fontSize:14,fontWeight:700,color:'#0D1B2A',marginBottom:12,lineHeight:1.35}}>{block.title}</div>}
        <div style={{fontSize:14.5,color:'#3D4852',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{renderRichText(block.body)}</div>
      </div>
      {popup&&<SciencePopupSheet science={block.science} onClose={()=>setPopup(false)}/>}
    </div>);
}

function ScienceNoteBlock({block}){
  const phases=block.phases; // optional: [{label, type: 'hold'|'switch', desc}]
  return(
    <div style={{padding:'12px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#F2F4F7',borderRadius:12,padding:'18px 22px',border:'1px solid #D9DEE5',borderLeft:'3px solid #6B7A90'}}>
        <div style={{fontSize:10.5,color:'#5C6A80',textTransform:'uppercase',letterSpacing:1.1,fontWeight:700,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:12}}>🔬</span>
          <span>Научная сноска{block.subtitle?' · '+block.subtitle:''}</span>
        </div>
        {block.title&&<div style={{fontSize:13.5,fontWeight:700,color:'#1F2933',marginBottom:8,lineHeight:1.4}}>{block.title}</div>}
        <div style={{fontSize:13.5,color:'#3D4852',lineHeight:1.65,whiteSpace:'pre-wrap'}}>{renderRichText(block.body)}</div>

        {/* Optional 4-phase diagram */}
        {phases&&phases.length===4&&(()=>{
          // 2x2 grid layout for labels to never overflow
          // Positions: [top-left, top-right, bottom-right, bottom-left]
          // Cycle direction: TL → TR → BR → BL → TL (clockwise)
          const W=320, H=260;
          const positions=[
            {x:W*0.28, y:60},    // top-left
            {x:W*0.72, y:60},    // top-right
            {x:W*0.72, y:175},   // bottom-right
            {x:W*0.28, y:175}    // bottom-left
          ];
          const color=(type)=>type==='hold'?'#E8A52B':'#3B7BC7';
          const colorLight=(type)=>type==='hold'?'#FBEFD3':'#DEEBF9';
          const labelY=(i)=>i<2?positions[i].y-36:positions[i].y+42;
          // Arrows between consecutive phases (rectangular path)
          const arrows=[
            {from:0,to:1,type:'horizontal',y:60},
            {from:1,to:2,type:'vertical',x:W*0.72},
            {from:2,to:3,type:'horizontal',y:175},
            {from:3,to:0,type:'vertical',x:W*0.28}
          ];
          return(
            <div style={{marginTop:14,marginBottom:4,background:'#fff',borderRadius:10,padding:'14px 10px',border:'1px solid #E0E4EA'}}>
              {block.phasesTitle&&<div style={{fontSize:11,color:'#6B7A90',textAlign:'center',marginBottom:4,fontWeight:600}}>{block.phasesTitle}</div>}
              <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block',maxHeight:260}}>
                {/* Arrows forming rectangular cycle */}
                {arrows.map((a,i)=>{
                  const from=positions[a.from],to=positions[a.to];
                  const isForward=(a.from+1)%4===a.to;
                  if(a.type==='horizontal'){
                    const x1=isForward?from.x+24:from.x-24;
                    const x2=isForward?to.x-24:to.x+24;
                    return<g key={'a'+i}>
                      <line x1={x1} y1={a.y} x2={x2} y2={a.y} stroke="#C7CED6" strokeWidth="1.5" strokeDasharray="3 3"/>
                      {/* arrow head */}
                      <polygon points={`${x2},${a.y} ${x2-5},${a.y-3} ${x2-5},${a.y+3}`} fill="#C7CED6" transform={isForward?'':`rotate(180 ${x2} ${a.y})`}/>
                    </g>;
                  }else{
                    const y1=isForward?from.y+24:from.y-24;
                    const y2=isForward?to.y-24:to.y+24;
                    return<g key={'a'+i}>
                      <line x1={a.x} y1={y1} x2={a.x} y2={y2} stroke="#C7CED6" strokeWidth="1.5" strokeDasharray="3 3"/>
                      <polygon points={`${a.x},${y2} ${a.x-3},${y2-5} ${a.x+3},${y2-5}`} fill="#C7CED6" transform={isForward?'':`rotate(180 ${a.x} ${y2})`}/>
                    </g>;
                  }
                })}

                {/* Phase circles with numbers */}
                {phases.map((ph,i)=>{
                  const p=positions[i];
                  return(
                    <g key={'ph'+i}>
                      <circle cx={p.x} cy={p.y} r={22} fill={colorLight(ph.type)} stroke={color(ph.type)} strokeWidth="2.5"/>
                      <text x={p.x} y={p.y+5} textAnchor="middle" fontSize="13" fontWeight="700" fill={color(ph.type)}>{i+1}</text>
                    </g>
                  );
                })}

                {/* Phase labels above top row, below bottom row */}
                {phases.map((ph,i)=>{
                  const p=positions[i];
                  return(
                    <text key={'l'+i} x={p.x} y={labelY(i)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1F2933">{ph.label}</text>
                  );
                })}
              </svg>
              {/* Legend */}
              <div style={{display:'flex',justifyContent:'center',gap:16,marginTop:4,fontSize:11,color:'#5C6A80'}}>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:'#FBEFD3',border:'2px solid #E8A52B'}}/>
                  <span>держится</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:'#DEEBF9',border:'2px solid #3B7BC7'}}/>
                  <span>меняется</span>
                </div>
              </div>
            </div>
          );
        })()}

        {block.citation&&<div style={{fontSize:11.5,color:'#6B7A90',marginTop:10,fontStyle:'italic',lineHeight:1.5}}>{block.citation}</div>}
      </div>
    </div>);
}

function GateBlock({block,isActive,isUnlocked,canUnlock,onUnlock}){
  // isUnlocked: этот gate уже пройден (следующая секция раскрыта)
  // isActive: этот gate — текущий (кнопка активна)
  // canUnlock: все требуемые активности в текущей секции выполнены
  if(isUnlocked){
    return(
      <div style={{padding:'20px 24px',maxWidth:680,margin:'0 auto',display:'flex',alignItems:'center',gap:10,justifyContent:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 16px',borderRadius:20,background:'#E8F3EA',color:'#2D7A4A',fontSize:12,fontWeight:600}}>
          <span style={{fontSize:14}}>✓</span>
          <span>{block.label}</span>
        </div>
      </div>);
  }
  if(!canUnlock){
    return(
      <div style={{padding:'28px 24px 32px',maxWidth:680,margin:'0 auto',display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
        <button
          disabled
          style={{
            fontSize:15,fontWeight:600,color:'#A8A8B0',padding:'14px 32px',
            borderRadius:14,border:'1px solid #E5E5EA',background:'#F5F5F7',
            cursor:'not-allowed',fontFamily:'inherit',transition:'all .2s'
          }}
        >{block.label||'Продолжить'} →</button>
        <div style={{fontSize:12,color:'#8A8A8F',textAlign:'center',lineHeight:1.5}}>↑ Сначала ответь на вопросы выше</div>
      </div>);
  }
  return(
    <div style={{padding:'28px 24px 32px',maxWidth:680,margin:'0 auto',display:'flex',justifyContent:'center'}}>
      <button
        onClick={onUnlock}
        className="gate-active"
        style={{
          fontSize:15,fontWeight:600,color:'#fff',padding:'14px 32px',
          borderRadius:14,border:'none',background:'#0071e3',cursor:'pointer',
          boxShadow:'0 4px 16px rgba(0,113,227,.32)',
          transition:'all .2s',fontFamily:'inherit'
        }}
        onMouseEnter={e=>{e.currentTarget.style.background='#005bb5';e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(0,113,227,.4)';}}
        onMouseLeave={e=>{e.currentTarget.style.background='#0071e3';e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 4px 16px rgba(0,113,227,.32)';}}
      >{block.label||'Продолжить'} →</button>
    </div>);
}

function CheckboxQuizBlock({block,blockId,onComplete}){
  const[checked,setChecked]=useState({});
  const[touched,setTouched]=useState(()=>new Set());
  const[anyInteraction,setAnyInteraction]=useState(false);
  const single=!!block.single;
  const toggle=(id)=>{
    if(!anyInteraction){
      setAnyInteraction(true);
      if(onComplete)onComplete();
    }
    setTouched(prev=>{
      const next=new Set(prev);
      next.add(id);
      return next;
    });
    if(single){
      // single-select: the newly picked item becomes the only checked one,
      // and we reset touched to just this item so previous picks don't show feedback
      setChecked({[id]:true});
      setTouched(new Set([id]));
    } else {
      setChecked(prev=>({...prev,[id]:!prev[id]}));
    }
  };
  return(
    <div style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#fff',borderRadius:14,padding:'22px 22px',border:'1px solid #E5E5EA',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        <div style={{fontSize:15,fontWeight:700,color:'#0D1B2A',marginBottom:6,lineHeight:1.4}}>{block.question}</div>
        {block.hint&&<div style={{fontSize:13,color:'#6E7781',marginBottom:16,lineHeight:1.5}}>{block.hint}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {block.items.map(item=>{
            const isChecked=!!checked[item.id];
            const isTouched=touched.has(item.id);
            // Show feedback ONLY for items the user actually clicked
            const showFb=isTouched;
            const isRight=showFb&&(isChecked===item.correct);
            const borderColor=showFb?(isRight?'#4A9D68':'#D46B6B'):'#E5E5EA';
            const fbColor=isRight?'#2D7A4A':'#B8464D';
            const fbText=isChecked?item.feedbackOn:item.feedbackOff;
            return(
              <div key={item.id} style={{paddingLeft:12,borderLeft:'3px solid '+borderColor,transition:'border-color .3s',paddingBottom:showFb&&fbText?2:0}}>
                <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer',padding:'3px 0'}}>
                  <input
                    type={single?'radio':'checkbox'}
                    name={single?blockId:undefined}
                    checked={isChecked}
                    onChange={()=>toggle(item.id)}
                    style={{marginTop:3,cursor:'pointer',accentColor:'#0071e3',width:16,height:16,flexShrink:0}}
                  />
                  <span style={{fontSize:14,color:'#1F2933',lineHeight:1.5}}>{item.label}</span>
                </label>
                {showFb&&fbText&&(
                  <div style={{fontSize:12.5,color:fbColor,marginTop:4,marginLeft:26,lineHeight:1.55,animation:'slideDown .3s ease'}}>{fbText}</div>
                )}
              </div>);
          })}
        </div>
      </div>
    </div>);
}

// PillarsPickerBlock v2 — practice exercise for Lesson 2 (meaning-first).
// User selects N of M candidates that are TRUE pillars
// (things without which the phenomenon doesn't exist).
// Props:
//   title           — section label (usually not shown if yasna is given)
//   yasna           — phenomenon name (big header)
//   question        — actual exercise question
//   mode            — 'guided' | 'practice'
//   hint            — string, shown only in guided mode
//   candidates      — [{id, label}, ...]
//   correct         — array of ids that are correct
//   numCorrect      — how many user must select (default 4, stages 1-2 use 2)
//   feedbackOk, feedbackError
function PillarsPickerBlock({block,onComplete}){
  const numCorrect=block.numCorrect||4;
  const[selected,setSelected]=useState(()=>new Set());
  const[submitted,setSubmitted]=useState(false);
  const[hintOpen,setHintOpen]=useState(false);
  const correct=new Set(block.correct||[]);
  const isCorrect=selected.size===numCorrect
    && [...selected].every(id=>correct.has(id))
    && [...correct].every(id=>selected.has(id));

  const toggle=(id)=>{
    if(submitted&&isCorrect)return; // locked after success
    setSelected(prev=>{
      const next=new Set(prev);
      if(next.has(id))next.delete(id);
      else next.add(id);
      return next;
    });
    if(submitted)setSubmitted(false);
  };
  const check=()=>{
    setSubmitted(true);
    // Call onComplete regardless of correctness — user can advance with
    // a wrong answer. Feedback will still show the right one; retry is
    // optional. This avoids the trap of forcing retries to unlock a gate.
    if(onComplete)onComplete();
  };
  const reset=()=>{
    setSelected(new Set());
    setSubmitted(false);
  };

  return(
    <div style={{padding:'16px 20px',maxWidth:680,margin:'0 auto'}}>
      {/* Question card — black border, minimalist */}
      <div style={{background:'#fff',border:'2px solid #0D1B2A',borderRadius:4,padding:'22px 20px'}}>
        {/* Mode + Yasna label */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:block.mode==='guided'?'#B8560E':'#0071E3',letterSpacing:0.8,textTransform:'uppercase',marginBottom:6}}>
            {block.mode==='guided'?'Упражнение с подсказкой':'Практика'}
          </div>
          {block.yasna&&<div style={{fontSize:18,fontWeight:700,color:'#0D1B2A',marginBottom:10,letterSpacing:'-0.2px',lineHeight:1.25}}>{block.yasna}</div>}
          {block.question&&<div style={{fontSize:15,color:'#1F2933',lineHeight:1.55,fontWeight:400}}>{renderRichText(block.question)}</div>}
        </div>

        {/* Hint (guided only) — collapsed by default so users try
            themselves first before peeking. */}
        {block.mode==='guided'&&block.hint&&(
          <div style={{marginBottom:16}}>
            <button onClick={()=>setHintOpen(!hintOpen)}
              style={{
                display:'flex',alignItems:'center',gap:8,
                width:'100%',padding:'10px 14px',
                background:hintOpen?'#FFF8EC':'#FAFBFC',
                borderLeft:`3px solid ${hintOpen?'#E8A52B':'#D1D5DB'}`,
                borderTop:'none',borderRight:'none',borderBottom:'none',
                borderRadius:'0 4px 4px 0',
                cursor:'pointer',fontFamily:'inherit',textAlign:'left',
                fontSize:13,color:hintOpen?'#6B4E15':'#5C6A80',fontWeight:600,
                transition:'all .15s'
              }}>
              <span style={{fontSize:14}}>💡</span>
              <span style={{flex:1}}>{hintOpen?'Подсказка':'Показать подсказку'}</span>
              <span style={{fontSize:11,color:hintOpen?'#B8852A':'#8A95A5',transition:'transform .2s',transform:hintOpen?'rotate(90deg)':'none'}}>▶</span>
            </button>
            {hintOpen&&(
              <div style={{padding:'10px 14px 12px 17px',background:'#FFF8EC',borderLeft:'3px solid #E8A52B',borderRadius:'0 0 4px 0',fontSize:13.5,color:'#6B4E15',lineHeight:1.55,marginTop:-1}}>
                {renderRichText(block.hint)}
              </div>
            )}
          </div>
        )}

        {/* Candidate rows — borderless, single-line, with circular checkboxes */}
        <div style={{display:'flex',flexDirection:'column',marginBottom:0}}>
          {(block.candidates||[]).map((c,idx)=>{
            const isSelected=selected.has(c.id);
            const isRight=correct.has(c.id);
            let rowColor='#1F2933', rowWeight=400, indicatorBg='#fff', indicatorBorder='#C7C7CC', indicatorFill=null;
            if(submitted){
              if(isSelected && isRight){
                rowColor='#1B5D35'; rowWeight=600;
                indicatorBg='#4A9D68'; indicatorBorder='#4A9D68'; indicatorFill='✓';
              } else if(isSelected && !isRight){
                rowColor='#8A3939'; rowWeight=500;
                indicatorBg='#D46B6B'; indicatorBorder='#D46B6B'; indicatorFill='✕';
              } else if(!isSelected && isRight){
                rowColor='#6B5018'; rowWeight=500;
                indicatorBorder='#C89030'; indicatorFill=null;
              }
            } else if(isSelected){
              rowColor='#004EB5'; rowWeight=600;
              indicatorBg='#0071E3'; indicatorBorder='#0071E3'; indicatorFill='✓';
            }
            return(
              <button key={c.id} onClick={()=>toggle(c.id)}
                disabled={submitted&&isCorrect}
                style={{display:'flex',alignItems:'center',gap:14,padding:'14px 0',background:'transparent',border:'none',borderBottom:idx<block.candidates.length-1?'1px solid #F0F0F2':'none',cursor:submitted&&isCorrect?'default':'pointer',textAlign:'left',fontFamily:'inherit',width:'100%'}}>
                {/* Circular checkbox indicator */}
                <span style={{flexShrink:0,width:22,height:22,borderRadius:'50%',border:`2px solid ${indicatorBorder}`,background:indicatorBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',transition:'all .15s'}}>
                  {indicatorFill}
                </span>
                <span style={{fontSize:15,color:rowColor,fontWeight:rowWeight,lineHeight:1.4,flex:1}}>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Counter + action */}
        {!submitted&&(
          <div style={{display:'flex',alignItems:'center',gap:12,marginTop:18,paddingTop:16,borderTop:'1px solid #F0F0F2'}}>
            <div style={{fontSize:12.5,color:'#6E7781',flex:1}}>Выбрано <b style={{color:selected.size===numCorrect?'#0071E3':'#0D1B2A'}}>{selected.size}</b> из {numCorrect}</div>
            <button onClick={check} disabled={selected.size!==numCorrect}
              style={{fontSize:13.5,fontWeight:600,padding:'10px 20px',borderRadius:4,border:'none',background:selected.size===numCorrect?'#0D1B2A':'#E5E5EA',color:selected.size===numCorrect?'#fff':'#AEAEB2',cursor:selected.size===numCorrect?'pointer':'default',fontFamily:'inherit',transition:'all .15s',letterSpacing:0.2}}>
              Проверить
            </button>
          </div>
        )}
      </div>

      {/* Feedback — OUTSIDE the question card, with coloured vertical bar on the left */}
      {submitted&&(
        <div style={{marginTop:14,padding:'16px 18px 16px 20px',borderLeft:`3px solid ${isCorrect?'#4A9D68':'#D46B6B'}`,fontSize:14,lineHeight:1.65,color:'#1F2933'}}>
          <div style={{fontWeight:700,marginBottom:8,color:isCorrect?'#1B5D35':'#8A3939'}}>
            {isCorrect?'Верно!':'Неверный ответ.'}
          </div>
          <div style={{whiteSpace:'pre-wrap'}}>{renderRichText(isCorrect?block.feedbackOk:block.feedbackError)}</div>
          {!isCorrect&&(
            <button onClick={reset}
              style={{marginTop:14,fontSize:13,fontWeight:500,padding:'8px 16px',borderRadius:4,border:'1px solid #D1D5DB',background:'#fff',color:'#3D4852',cursor:'pointer',fontFamily:'inherit'}}>
              Попробовать снова
            </button>
          )}
        </div>
      )}
    </div>);
}

function ScenarioBlock({block}){
  return(
    <div style={{padding:'20px 24px 4px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#FFF7E8',border:'1px solid #F2E1BF',borderRadius:14,padding:'18px 20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,flexWrap:'wrap'}}>
          <div style={{fontSize:10.5,color:'#A26B1F',textTransform:'uppercase',letterSpacing:1,fontWeight:700,background:'#fff',padding:'3px 10px',borderRadius:6,border:'1px solid #F2E1BF'}}>{block.variant}</div>
          <div style={{fontSize:15,fontWeight:700,color:'#0D1B2A'}}>{block.name}</div>
        </div>
        <div style={{fontSize:14,color:'#3D4852',lineHeight:1.6}}>{block.context}</div>
      </div>
    </div>);
}

function YasnaStarBlock({block}){
  const highlighted=block.highlightPositions!=null
    ? block.highlightPositions
    : block.highlighted!=null
      ? block.highlighted
      : (block.highlightPos!=null ? [block.highlightPos] : []);
  const labels=block.labels||{};
  const mode=block.mode||'full';
  const focusType=block.focusType!==undefined?block.focusType:(mode==='full'?'longs':null);
  return(
    <div style={{padding:'20px 16px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#F8FAFC',borderRadius:16,padding:'20px 4px',border:'1px solid #E5E9EF',textAlign:'center'}}>
        {block.title&&<div style={{fontSize:14,fontWeight:700,color:'#0D1B2A',marginBottom:12}}>{block.title}</div>}
        <div style={{width:'100%',margin:'0 auto',aspectRatio:'800/460'}}>
          <div className="yasna-star-pulse" style={{width:'100%',height:'100%'}}>
            <LessonStar mode={mode} highlighted={highlighted} labels={labels} focusType={focusType}/>
          </div>
        </div>
        {block.caption&&<div style={{fontSize:13,color:'#6E7781',marginTop:14,lineHeight:1.55,padding:'0 8px'}}>{block.caption}</div>}
      </div>
    </div>);
}

function ReflectionBlock({block,lessonId}){
  const storageKey='yasna_reflection_'+lessonId+'_'+(block.id||'default');
  const[answers,setAnswers]=useState(()=>{
    try{const s=localStorage.getItem(storageKey);return s?JSON.parse(s):{};}catch(e){return{};}
  });
  const update=(qid,val)=>{
    const next={...answers,[qid]:val};
    setAnswers(next);
    try{localStorage.setItem(storageKey,JSON.stringify(next));}catch(e){}
  };
  return(
    <div style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#FFFBF0',border:'1px solid #F2E3C7',borderRadius:16,padding:'22px 22px'}}>
        <div style={{fontSize:10.5,color:'#A26B1F',textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:10}}>Личные заметки</div>
        <div style={{fontSize:16,fontWeight:700,color:'#0D1B2A',marginBottom:6}}>{block.title}</div>
        {block.intro&&<div style={{fontSize:13.5,color:'#5C5C63',lineHeight:1.6,marginBottom:18}}>{block.intro}</div>}
        {(block.questions||[]).map(q=>(
          <div key={q.id} style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:13,fontWeight:600,color:'#0D1B2A',marginBottom:6,lineHeight:1.4}}>{q.label}</label>
            <textarea
              value={answers[q.id]||''}
              onChange={e=>update(q.id,e.target.value)}
              placeholder={q.placeholder||''}
              rows={2}
              style={{width:'100%',padding:'10px 12px',fontSize:14,fontFamily:'inherit',color:'#1F2933',border:'1px solid #E8D8AE',borderRadius:8,outline:'none',resize:'vertical',lineHeight:1.5,background:'#fff',boxSizing:'border-box'}}
            />
          </div>
        ))}
        {block.footer&&<div style={{fontSize:12,color:'#8A7D4F',lineHeight:1.5,marginTop:8,fontStyle:'italic'}}>{block.footer}</div>}
      </div>
    </div>);
}

function FinalQuizInlineBlock({block,onComplete}){
  const[answers,setAnswers]=useState({});
  useEffect(()=>{
    if(Object.keys(answers).length===block.questions.length&&onComplete){
      onComplete();
    }
  },[Object.keys(answers).length]);
  return(
    <div style={{padding:'20px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#fff',borderRadius:16,padding:'24px 24px',border:'1px solid #E5E5EA'}}>
        {block.title&&<div style={{fontSize:16,fontWeight:700,color:'#0D1B2A',marginBottom:18}}>{block.title}</div>}
        {block.questions.map((q,qi)=>{
          const answeredIdx=answers[qi];
          const answered=answeredIdx!=null;
          return(
            <div key={qi} style={{marginBottom:22,paddingBottom:20,borderBottom:qi<block.questions.length-1?'1px solid #F0F0F2':'none'}}>
              <div style={{fontSize:14.5,fontWeight:600,color:'#0D1B2A',marginBottom:12,lineHeight:1.45}}>{qi+1}. {q.q}</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {q.options.map((opt,oi)=>{
                  const isSelected=answeredIdx===oi;
                  const isCorrect=oi===q.correctIdx;
                  let bg='#fff',border='#E5E5EA',color='#1F2933';
                  if(answered){
                    if(isCorrect){bg='#F0F8F3';border='#4A9D68';}
                    else if(isSelected){bg='#FDF2F2';border='#D46B6B';}
                  }
                  return(
                    <button key={oi}
                      onClick={()=>!answered&&setAnswers(prev=>({...prev,[qi]:oi}))}
                      disabled={answered}
                      style={{textAlign:'left',padding:'11px 14px',fontSize:14,color,background:bg,border:'1.5px solid '+border,borderRadius:10,cursor:answered?'default':'pointer',transition:'all .2s',fontFamily:'inherit',lineHeight:1.4}}
                    >{opt}{answered&&isCorrect?<span style={{color:'#2D7A4A',fontWeight:700,marginLeft:8}}>✓</span>:null}{answered&&isSelected&&!isCorrect?<span style={{color:'#B8464D',fontWeight:700,marginLeft:8}}>✗</span>:null}</button>);
                })}
              </div>
              {answered&&q.explain&&(
                <div style={{marginTop:12,padding:'12px 14px',background:'#F8FAFC',borderRadius:10,fontSize:13,color:'#3D4852',lineHeight:1.6,borderLeft:'3px solid #0071e3'}}>
                  <b style={{color:'#0D1B2A'}}>Разбор:</b> {q.explain}
                </div>
              )}
            </div>);
        })}
      </div>
    </div>);
}

function SummaryBlockInline({block}){
  return(
    <div style={{padding:'24px'}}>
      <div style={{maxWidth:680,margin:'0 auto',background:'linear-gradient(135deg,#0071e3 0%,#004EB5 100%)',color:'#fff',borderRadius:18,padding:'28px 28px',boxShadow:'0 8px 28px rgba(0,78,181,.25)'}}>
        <div style={{fontSize:11,color:'rgba(255,255,255,.75)',textTransform:'uppercase',letterSpacing:1.2,fontWeight:700,marginBottom:12}}>Главное из этого урока</div>
        <div style={{fontSize:22,fontWeight:700,marginBottom:18,lineHeight:1.25,letterSpacing:'-0.3px'}}>{block.title}</div>
        <ul style={{listStyle:'none',padding:0,margin:0}}>
          {(block.points||[]).map((p,i)=>(
            <li key={i} style={{display:'flex',gap:12,marginBottom:12,fontSize:14,lineHeight:1.6,color:'rgba(255,255,255,.94)'}}>
              <span style={{flexShrink:0,marginTop:2,opacity:.9}}>—</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        {block.nextLabel&&(
          <div style={{marginTop:22,padding:'14px 16px',background:'rgba(255,255,255,.12)',borderRadius:10,fontSize:13,color:'rgba(255,255,255,.9)',lineHeight:1.55}}>{block.nextLabel}</div>
        )}
      </div>
    </div>);
}

function NextStepsBlockInline({block,onClose,onPickAnother,onRepeat,onOpenLesson}){
  const canOpenNext=block.nextLessonId&&block.nextLessonStatus!=='planned'&&onOpenLesson;
  return(
    <div style={{padding:'16px 24px 60px',maxWidth:680,margin:'0 auto'}}>
      {/* Custom next-lesson promo (optional) — clickable card if nextLessonId provided */}
      {block.nextLessonTitle&&(
        <div style={{background:'#fff',border:'1px solid #E5E5EA',borderRadius:14,padding:'18px 18px',marginBottom:12,boxShadow:'0 1px 3px rgba(15,27,42,.05)'}}>
          {block.title&&<div style={{fontSize:10,fontWeight:700,color:'#0071e3',textTransform:'uppercase',letterSpacing:0.8,marginBottom:6}}>{block.title}</div>}
          {block.intro&&<div style={{fontSize:13.5,color:'#3D4852',lineHeight:1.55,marginBottom:14}}>{renderRichText(block.intro)}</div>}
          {canOpenNext?(
            <button
              onClick={()=>onOpenLesson(block.nextLessonId)}
              style={{display:'block',width:'100%',textAlign:'left',padding:'14px 14px',background:'#F0F7FF',borderRadius:12,border:'1px solid #C6E0FA',cursor:'pointer',fontFamily:'inherit',transition:'all .2s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='#E3EFFE';e.currentTarget.style.borderColor='#95C2F0';e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 14px rgba(0,113,227,.15)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='#F0F7FF';e.currentTarget.style.borderColor='#C6E0FA';e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}
            >
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:700,color:'#0D1B2A',flex:1,minWidth:0}}>{block.nextLessonTitle}</div>
                <span style={{fontSize:18,color:'#0071e3',fontWeight:700,flexShrink:0}}>→</span>
              </div>
              {block.nextLessonSubtitle&&<div style={{fontSize:12.5,color:'#3D4852',lineHeight:1.5,marginBottom:4}}>{block.nextLessonSubtitle}</div>}
              {block.nextLessonDuration&&<div style={{fontSize:11.5,color:'#6E7781'}}>{block.nextLessonDuration}</div>}
            </button>
          ):(
            <div style={{padding:'14px 14px',background:'#F0F7FF',borderRadius:12,border:'1px solid #C6E0FA'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:700,color:'#0D1B2A',flex:1,minWidth:0}}>{block.nextLessonTitle}</div>
                {block.nextLessonStatus==='planned'&&<span style={{fontSize:10,fontWeight:700,color:'#6E7781',background:'#EEF0F3',padding:'3px 8px',borderRadius:10,letterSpacing:0.3,textTransform:'uppercase',whiteSpace:'nowrap'}}>скоро</span>}
              </div>
              {block.nextLessonSubtitle&&<div style={{fontSize:12.5,color:'#3D4852',lineHeight:1.5,marginBottom:4}}>{block.nextLessonSubtitle}</div>}
              {block.nextLessonDuration&&<div style={{fontSize:11.5,color:'#6E7781'}}>{block.nextLessonDuration}</div>}
            </div>
          )}
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {canOpenNext?(
          <>
            <button onClick={()=>onOpenLesson(block.nextLessonId)} style={{fontSize:15,fontWeight:600,padding:'14px 24px',borderRadius:12,border:'none',background:'#0071e3',color:'#fff',cursor:'pointer',boxShadow:'0 4px 14px rgba(0,113,227,.3)',fontFamily:'inherit'}}>Перейти к следующему уроку →</button>
            <button onClick={onPickAnother} style={{fontSize:14,fontWeight:500,padding:'12px 24px',borderRadius:12,border:'1px solid #E5E5EA',background:'#fff',color:'#3D4852',cursor:'pointer',fontFamily:'inherit'}}>← Вернуться к списку уроков</button>
            <button onClick={onRepeat} style={{fontSize:13,fontWeight:500,padding:'10px 24px',borderRadius:12,border:'none',background:'transparent',color:'#6E7781',cursor:'pointer',fontFamily:'inherit'}}>⟲ Пройти ещё раз</button>
          </>
        ):(
          <>
            <button onClick={onPickAnother} style={{fontSize:15,fontWeight:600,padding:'14px 24px',borderRadius:12,border:'none',background:'#0071e3',color:'#fff',cursor:'pointer',boxShadow:'0 4px 14px rgba(0,113,227,.3)',fontFamily:'inherit'}}>← Вернуться к списку уроков</button>
            <button onClick={onRepeat} style={{fontSize:14,fontWeight:500,padding:'12px 24px',borderRadius:12,border:'1px solid #E5E5EA',background:'#fff',color:'#3D4852',cursor:'pointer',fontFamily:'inherit'}}>⟲ Пройти ещё раз</button>
          </>
        )}
      </div>
    </div>);
}

// ─── Animated sunrise with rising cortisol curve ───
function InlineSunriseBlock({block}){
  const[tick,setTick]=useState(0);
  useEffect(()=>{
    const t=setInterval(()=>setTick(v=>(v+1)%360),60);
    return()=>clearInterval(t);
  },[]);
  // Animation phases:
  //   0.00–0.70 → sun rising (t from 0 to 1)
  //   0.70–0.90 → hold at top
  //   0.90–1.00 → fade out, restart
  const raw=tick/360;
  let t;
  let fade=1;
  if(raw<0.7){t=raw/0.7;}
  else if(raw<0.9){t=1;}
  else {t=1;fade=1-(raw-0.9)/0.1;}
  // Sun moves up-right along an arc that only goes up
  const sunX=30+t*340;
  const sunY=170-t*130;
  // Cortisol rises monotonically 15% → 75%
  const cortisolH=0.15+t*0.6;
  const activeShelf=t<0.38?1:t<0.72?2:3;
  const shelfLabels=[
    {num:1,name:'Искра',desc:'кортизол пошёл вверх'},
    {num:2,name:'Заря',desc:'первый свет, глаза открылись'},
    {num:3,name:'Утро',desc:'ты встал, день пошёл'}
  ];

  return(
    <div style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'linear-gradient(180deg,#F8FAFC 0%,#FFF6E8 60%,#FFEBD9 100%)',borderRadius:16,padding:'20px 18px',border:'1px solid #F2E1BF'}}>
        {block.title&&<div style={{fontSize:15,fontWeight:700,color:'#0D1B2A',marginBottom:4,textAlign:'center'}}>{block.title}</div>}
        {block.caption&&<div style={{fontSize:13,color:'#6E7781',marginBottom:14,textAlign:'center',lineHeight:1.5}}>{block.caption}</div>}

        <svg viewBox="0 0 400 220" style={{width:'100%',height:200,display:'block'}}>
          {/* Horizon */}
          <line x1="10" y1="170" x2="390" y2="170" stroke="#B8874A" strokeWidth="1.5" strokeDasharray="2 3"/>

          {/* Cortisol curve — monotonic dashed blue line */}
          <path
            d={`M 20 170 Q ${60+t*150} ${170-cortisolH*80} ${sunX} ${170-cortisolH*125}`}
            fill="none" stroke="#0071e3" strokeWidth="2.5" strokeDasharray="4 4" opacity={0.75*fade}
          />

          {/* Sun */}
          <circle cx={sunX} cy={sunY} r={20} fill="#FFB020" opacity={0.3*fade}/>
          <circle cx={sunX} cy={sunY} r={14} fill="#FFB020" opacity={fade}/>

          {/* Axis labels */}
          <text x="20" y="190" fontSize="10" fill="#6E7781">~3:00</text>
          <text x="200" y="190" fontSize="10" fill="#6E7781" textAnchor="middle">~6:30</text>
          <text x="380" y="190" fontSize="10" fill="#6E7781" textAnchor="end">~9:00</text>

          {/* Legend */}
          <g transform="translate(10, 208)">
            <line x1="0" y1="0" x2="16" y2="0" stroke="#0071e3" strokeWidth="2" strokeDasharray="3 3"/>
            <text x="22" y="3" fontSize="9" fill="#6E7781">кортизол</text>
            <circle cx="80" cy="0" r="4" fill="#FFB020"/>
            <text x="90" y="3" fontSize="9" fill="#6E7781">солнце</text>
          </g>
        </svg>

        <div style={{display:'flex',justifyContent:'space-around',marginTop:8,gap:6}}>
          {shelfLabels.map(s=>{
            const isActive=activeShelf===s.num;
            return(
              <div key={s.num} style={{flex:1,textAlign:'center',padding:'8px 6px',borderRadius:10,background:isActive?'#fff':'transparent',border:'1.5px solid '+(isActive?'#0071e3':'transparent'),transition:'all .3s'}}>
                <div style={{fontSize:16,fontWeight:800,color:isActive?'#0071e3':'#B0B8C0',transition:'color .3s'}}>{s.num}</div>
                <div style={{fontSize:11.5,fontWeight:700,color:isActive?'#0D1B2A':'#8A8A8F',marginTop:2,transition:'color .3s'}}>{s.name}</div>
                <div style={{fontSize:10.5,color:'#6E7781',marginTop:1,lineHeight:1.3}}>{s.desc}</div>
              </div>);
          })}
        </div>
      </div>
    </div>);
}

// ─── Tap-to-assign: place elements on 3 shelves ───
function InlineThreeShelvesBlock({block,onComplete}){
  const[assignments,setAssignments]=useState({});
  const[interacted,setInteracted]=useState(false);

  const assign=(itemId,shelfNum)=>{
    if(!interacted){setInteracted(true);if(onComplete)onComplete();}
    setAssignments(prev=>({...prev,[itemId]:shelfNum}));
  };

  return(
    <div style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#fff',borderRadius:14,padding:'22px 22px',border:'1px solid #E5E5EA',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        <div style={{fontSize:15,fontWeight:700,color:'#0D1B2A',marginBottom:6,lineHeight:1.4}}>{block.question}</div>
        {block.hint&&<div style={{fontSize:13,color:'#6E7781',marginBottom:16,lineHeight:1.5}}>{block.hint}</div>}

        {/* Shelf legend */}
        <div style={{display:'flex',gap:8,marginBottom:16,padding:'12px 10px',background:'#F5F8FC',borderRadius:12}}>
          {block.shelves.map(s=>(
            <div key={s.num} style={{flex:1,textAlign:'center'}}>
              <div style={{fontSize:16,fontWeight:800,color:'#0071e3'}}>{s.num}</div>
              <div style={{fontSize:12,fontWeight:700,color:'#0D1B2A',marginTop:2}}>{s.name}</div>
            </div>
          ))}
        </div>

        {/* Items */}
        {block.items.map(item=>{
          const assigned=assignments[item.id];
          const attempted=assigned!=null;
          const isCorrect=assigned===item.correct;
          const cardBg=attempted?(isCorrect?'#F0F8F3':'#FDF3F3'):'#fff';
          const cardBorder=attempted?(isCorrect?'#4A9D68':'#D46B6B'):'#E5E5EA';
          return(
            <div key={item.id} style={{marginBottom:10,padding:'14px 14px',background:cardBg,border:'1px solid '+cardBorder,borderRadius:12,transition:'all .25s'}}>
              <div style={{fontSize:14,color:'#1F2933',marginBottom:10,lineHeight:1.45}}>{item.label}</div>
              <div style={{display:'flex',gap:6}}>
                {block.shelves.map(s=>{
                  const selected=assigned===s.num;
                  const correctBtn=attempted&&s.num===item.correct;
                  let bg='#fff',color='#3D4852',border='#E5E5EA';
                  if(attempted){
                    if(selected&&isCorrect){bg='#4A9D68';color='#fff';border='#4A9D68';}
                    else if(selected&&!isCorrect){bg='#D46B6B';color='#fff';border='#D46B6B';}
                    else if(correctBtn){bg='#fff';color='#4A9D68';border='#4A9D68';}
                  }
                  return(
                    <button key={s.num}
                      onClick={()=>!attempted&&assign(item.id,s.num)}
                      disabled={attempted}
                      style={{flex:1,padding:'9px 10px',fontSize:13.5,fontWeight:700,color,background:bg,border:'1.5px solid '+border,borderRadius:8,cursor:attempted?'default':'pointer',fontFamily:'inherit',transition:'all .15s'}}
                    >{s.num}</button>);
                })}
              </div>
              {attempted&&item.explain&&(
                <div style={{fontSize:12.5,color:isCorrect?'#2D7A4A':'#B8464D',marginTop:10,lineHeight:1.55}}>
                  {isCorrect?'✓ ':'Правильно — '+item.correct+'. '}{item.explain}
                </div>
              )}
            </div>);
        })}
      </div>
    </div>);
}

// ─── Horizontal carousel of example cards ───
function InlineCarouselBlock({block}){
  const ref=useRef(null);
  const[activeIdx,setActiveIdx]=useState(0);

  const onScroll=()=>{
    const el=ref.current;
    if(!el)return;
    const w=el.clientWidth-48; // minus padding
    const i=Math.round(el.scrollLeft/(w*0.85+12));
    setActiveIdx(Math.min(i,block.items.length-1));
  };

  // Mini-star for pillars visualization
  const PillarsMini=({pillars,color})=>{
    // Orientation canon (matches LessonStar): 0→bottom, 3→left, 6→top, 9→right
    // angDeg(i) = 270 - i*30 (math convention, SVG y-flipped via -sin)
    const size=200, cx=size/2, cy=size/2, r=size*0.32;
    const angDeg=(i)=>270 - i*30;
    const rad=(d)=>d*Math.PI/180;
    const pt=(i)=>{const a=rad(angDeg(i));return{x:cx+Math.cos(a)*r, y:cy-Math.sin(a)*r};};
    const pillarPositions=pillars.map(p=>p.pos);
    // Use extended viewBox so side labels ("Утро" on left, "Вечер" on right) don't clip.
    // Extend horizontally by ~38px on each side; vertical doesn't need as much (top/bottom labels are centered).
    const vbPadX=44, vbPadY=22;
    return(
      <svg viewBox={`${-vbPadX} ${-vbPadY} ${size+vbPadX*2} ${size+vbPadY*2}`} style={{width:'100%',maxWidth:260,display:'block',margin:'0 auto'}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color+'33'} strokeWidth="1" strokeDasharray="2 3"/>
        {/* cross lines: 0↔6 (vertical) and 3↔9 (horizontal) */}
        {[[0,6],[3,9]].map(([a,b],i)=>{
          const pa=pt(a), pb=pt(b);
          return<line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={color+'55'} strokeWidth="1.5"/>;
        })}
        {/* 12 dots — only 4 pillars are colored, rest are muted */}
        {Array.from({length:12}).map((_,i)=>{
          const p=pt(i);
          const isPillar=pillarPositions.includes(i);
          return<circle key={i} cx={p.x} cy={p.y} r={isPillar?8:3} fill={isPillar?color:'#D1D1D6'}/>;
        })}
        {/* pillar position numbers inside colored dots */}
        {pillars.map(p=>{
          const pos=pt(p.pos);
          return<text key={'n'+p.pos} x={pos.x} y={pos.y+3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{p.pos}</text>;
        })}
        {/* pillar labels outside — anchored by position to avoid clipping at sides */}
        {pillars.map(p=>{
          const outR=r+22;
          const a=rad(angDeg(p.pos));
          const lx=cx+Math.cos(a)*outR, ly=cy-Math.sin(a)*outR;
          // Anchor by side: top/bottom → middle; left → end; right → start
          const anchor=p.pos===0||p.pos===6?'middle':p.pos===3?'end':'start';
          // Slight offset for side labels so they sit next to the dot, not overlap
          const dx=p.pos===3?-6:p.pos===9?6:0;
          const dy=p.pos===0?14:p.pos===6?-6:4;
          return(
            <text key={'l'+p.pos} x={lx+dx} y={ly+dy} textAnchor={anchor} fontSize="13" fontWeight="700" fill={color}>{p.label}</text>
          );
        })}
      </svg>);
  };

  return(
    <div style={{padding:'16px 0',maxWidth:680,margin:'0 auto'}}>
      <div style={{padding:'0 24px',marginBottom:14}}>
        {block.title&&<div style={{fontSize:15,fontWeight:700,color:'#0D1B2A',marginBottom:4}}>{block.title}</div>}
        {block.hint&&<div style={{fontSize:13,color:'#6E7781',lineHeight:1.5}}>{block.hint}</div>}
      </div>
      <div
        ref={ref}
        onScroll={onScroll}
        style={{display:'flex',gap:12,overflowX:'auto',scrollSnapType:'x mandatory',padding:'4px 24px 12px',WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}
      >
        {block.items.map((item,i)=>(
          <div key={i} style={{flex:'0 0 78%',maxWidth:320,scrollSnapAlign:'start',background:item.bg||'#fff',borderRadius:14,padding:'18px 18px',border:'1px solid '+(item.color||item.accent||'#E5E5EA')+'40',boxShadow:'0 1px 3px rgba(15,27,42,.05)'}}>
            {item.emoji&&<div style={{fontSize:26,marginBottom:8}}>{item.emoji}</div>}
            <div style={{fontSize:15,fontWeight:700,color:'#0D1B2A',marginBottom:3,lineHeight:1.3}}>{item.title}</div>
            {item.subtitle&&<div style={{fontSize:11.5,color:'#6E7781',marginBottom:12,textTransform:'uppercase',letterSpacing:0.6,fontWeight:600}}>{item.subtitle}</div>}
            {item.pillars && <div style={{padding:'12px 0 8px'}}><PillarsMini pillars={item.pillars} color={item.color||'#0071e3'}/></div>}
            {item.body && <div style={{fontSize:13.5,color:'#3D4852',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{renderRichText(item.body)}</div>}
          </div>
        ))}
      </div>
      {/* dots */}
      <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:8}}>
        {block.items.map((_,i)=>(
          <div key={i} style={{width:activeIdx===i?18:6,height:6,borderRadius:3,background:activeIdx===i?'#0071e3':'#D1D1D6',transition:'all .25s'}}/>
        ))}
      </div>
    </div>);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SCROLL LESSON — gate-based progressive disclosure
// ═══════════════════════════════════════════════════════════════════

// ─── Simple animated bar chart ───
function InlineBarChartBlock({block}){
  const[mounted,setMounted]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setMounted(true),80);return()=>clearTimeout(t);},[]);
  const max=Math.max(...block.bars.map(b=>b.value));
  return(
    <div style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'#fff',borderRadius:14,padding:'22px 22px',border:'1px solid #E5E5EA',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        {block.title&&<div style={{fontSize:14,fontWeight:700,color:'#0D1B2A',marginBottom:6}}>{block.title}</div>}
        {block.caption&&<div style={{fontSize:12.5,color:'#6E7781',marginBottom:20,lineHeight:1.55}}>{block.caption}</div>}
        <div style={{display:'flex',gap:16,alignItems:'flex-end',height:170,paddingBottom:8}}>
          {block.bars.map((b,i)=>{
            const minVisible=6; // always show at least a sliver for zero/tiny values
            const h=max>0?Math.max(minVisible,(b.value/max)*130):minVisible;
            return(
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:'100%',minWidth:0}}>
                <div style={{width:'100%',maxWidth:72,height:(mounted?h:0)+'px',background:b.color||'#0071e3',borderRadius:'6px 6px 0 0',transition:'height .7s cubic-bezier(0.16,1,0.3,1) '+(i*150)+'ms'}}/>
              </div>);
          })}
        </div>
        {/* Value labels row — below bars, clear of overlap */}
        <div style={{display:'flex',gap:16,marginTop:8}}>
          {block.bars.map((b,i)=>(
            <div key={i} style={{flex:1,textAlign:'center',minWidth:0}}>
              <div style={{fontSize:11.5,fontWeight:700,color:b.color||'#0071e3',lineHeight:1.35,wordBreak:'break-word'}}>{b.valueLabel||b.value}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:16,marginTop:12,borderTop:'1px solid #F0F0F2',paddingTop:12}}>
          {block.bars.map((b,i)=>(
            <div key={i} style={{flex:1,textAlign:'center',minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:'#0D1B2A'}}>{b.label}</div>
              {b.sublabel&&<div style={{fontSize:11,color:'#6E7781',marginTop:2,lineHeight:1.4}}>{b.sublabel}</div>}
            </div>
          ))}
        </div>
        {block.footer&&<div style={{fontSize:12,color:'#6E7781',marginTop:16,lineHeight:1.55,textAlign:'center',fontStyle:'italic'}}>{block.footer}</div>}
      </div>
    </div>);
}

function ScrollLesson({lesson,onClose,onComplete,onPickAnother,onOpenLesson}){
  const scrollRef=useRef(null);
  const blockRefs=useRef([]);

  // Find all gate indices
  const gateIndices=useMemo(()=>{
    const res=[];
    lesson.blocks.forEach((b,i)=>{if(b.type==='gate')res.push(i);});
    return res;
  },[lesson.id]);

  // For each gate: list of block indices that must be completed before it can unlock
  const gateRequirements=useMemo(()=>{
    return gateIndices.map((gateBlockIdx,gi)=>{
      const prevGateBlockIdx=gi>0?gateIndices[gi-1]:-1;
      const required=[];
      for(let j=prevGateBlockIdx+1;j<gateBlockIdx;j++){
        const bt=lesson.blocks[j].type;
        if(bt==='checkbox-quiz'||bt==='final-quiz-inline'||bt==='three-shelves'||bt==='pillars-picker'){
          required.push(j);
        }
      }
      return required;
    });
  },[lesson.id]);

  // unlockedGates: количество раскрытых секций. Старт = 1 (первая секция + её gate видны)
  const[unlockedGates,setUnlockedGates]=useState(1);
  const[completedBlocks,setCompletedBlocks]=useState(()=>new Set());

  const markBlockComplete=useCallback((blockIdx)=>{
    setCompletedBlocks(prev=>{
      if(prev.has(blockIdx))return prev;
      const next=new Set(prev);
      next.add(blockIdx);
      return next;
    });
  },[]);

  const canUnlockGate=(gateNum)=>{
    const required=gateRequirements[gateNum-1]||[];
    return required.every(idx=>completedBlocks.has(idx));
  };

  const totalGates=gateIndices.length;
  const fullyDone=unlockedGates>totalGates;

  // Индекс последнего видимого блока
  const lastVisibleIdx=fullyDone
    ? lesson.blocks.length-1
    : gateIndices[unlockedGates-1];

  const visibleBlocks=lesson.blocks.slice(0,lastVisibleIdx+1);

  // Прогресс: по количеству раскрытых gates
  const progress=Math.min(100,(unlockedGates/(totalGates+1))*100);

  useEffect(()=>{
    if(fullyDone&&onComplete)onComplete(lesson.id);
  },[fullyDone]);

  // Guarantee scroll starts at top when lesson opens (belt + suspenders;
  // key prop should already remount component on lesson.id change)
  useEffect(()=>{
    if(scrollRef.current){
      scrollRef.current.scrollTop=0;
    }
  },[lesson.id]);

  const unlockGate=(gateNum)=>{
    setUnlockedGates(prev=>Math.max(prev,gateNum+1));
    setTimeout(()=>{
      const nextIdx=gateIndices[gateNum-1]+1;
      const el=blockRefs.current[nextIdx];
      if(el){
        const rect=el.getBoundingClientRect();
        const scrollEl=scrollRef.current;
        if(scrollEl){
          const top=scrollEl.scrollTop+rect.top-70;
          scrollEl.scrollTo({top,behavior:'smooth'});
        }
      }
    },120);
  };

  // Gate progression is ALWAYS manual — user must tap the gate button
  // to move to the next section. Answering a question (even correctly)
  // only unlocks the gate button; it does NOT advance automatically.
  //
  // Rationale: auto-advance surprises the user and removes control. The
  // answer+feedback moment is when the user is still absorbing what they
  // got right or wrong; if the gate jumps on its own 800ms later, they
  // feel like the lesson is running past them. Let them reread, retry,
  // or linger as long as they want — the transition is their decision.

  const repeat=()=>{
    setUnlockedGates(1);
    setCompletedBlocks(new Set());
    if(scrollRef.current)scrollRef.current.scrollTop=0;
  };

  return(
    <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'#F8F8F9',zIndex:70,display:'flex',flexDirection:'column'}}>
      {/* Sticky header */}
      <div style={{padding:'10px 16px',borderBottom:'1px solid #ECECEE',flexShrink:0,display:'flex',alignItems:'center',gap:10,background:'#fff',position:'relative',boxShadow:'0 1px 2px rgba(0,0,0,.02)'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:'#6E7781',textTransform:'uppercase',letterSpacing:0.6,fontWeight:600}}>{lesson.module?'Урок '+lesson.order+' · '+lesson.module:'Урок '+lesson.order}</div>
          <div style={{fontSize:14,fontWeight:600,color:'#0D1B2A',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lesson.title}</div>
        </div>
        <div style={{fontSize:11,color:'#6E7781',fontWeight:600,marginRight:6}}>{Math.round(progress)}%</div>
        <button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:'1px solid #E5E5EA',background:'#fff',cursor:'pointer',color:'#3D4852',fontSize:14}}>✕</button>
        <div style={{position:'absolute',left:0,bottom:-1,height:3,width:'100%',background:'#ECECEE'}}>
          <div style={{height:'100%',width:progress+'%',background:'linear-gradient(90deg,#0071e3,#2D94F0)',transition:'width .35s ease'}}/>
        </div>
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',background:'#F8F8F9'}}>
        {visibleBlocks.map((block,i)=>{
          const setRef=(el)=>{blockRefs.current[i]=el;};
          const animClass=i>=(gateIndices[unlockedGates-2]!=null?gateIndices[unlockedGates-2]+1:0)?'scroll-lesson-block-appear':'';
          const wrap=(content)=>(
            <div key={i} ref={setRef} className={animClass}>{content}</div>
          );
          switch(block.type){
            case 'hero': return wrap(<HeroBlock block={block}/>);
            case 'spiral-map': return wrap(<SpiralMap block={block}/>);
            case 'toc': return wrap(<TocBlock block={block}/>);
            case 'speaker': return wrap(<SpeakerBlock block={block}/>);
            case 'explanation': return wrap(<ExplanationBlock block={block}/>);
            case 'science-note': return wrap(<ScienceNoteBlock block={block}/>);
            case 'gate': {
              const gateNum=block.gateNum;
              const isUnlocked=unlockedGates>gateNum;
              const isActive=unlockedGates===gateNum;
              const canUnlock=canUnlockGate(gateNum);
              return wrap(<GateBlock block={block} isActive={isActive} isUnlocked={isUnlocked} canUnlock={canUnlock} onUnlock={()=>unlockGate(gateNum)}/>);
            }
            case 'checkbox-quiz': return wrap(<CheckboxQuizBlock block={block} blockId={'b'+i} onComplete={()=>markBlockComplete(i)}/>);
            case 'pillars-picker': return wrap(<PillarsPickerBlock block={block} onComplete={()=>markBlockComplete(i)}/>);
            case 'scenario': return wrap(<ScenarioBlock block={block}/>);
            case 'yasna-star': return wrap(<YasnaStarBlock block={block}/>);
            case 'reflection': return wrap(<ReflectionBlock block={block} lessonId={lesson.id}/>);
            case 'final-quiz-inline': return wrap(<FinalQuizInlineBlock block={block} onComplete={()=>markBlockComplete(i)}/>);
            case 'sunrise-animation': return wrap(<InlineSunriseBlock block={block}/>);
            case 'three-shelves': return wrap(<InlineThreeShelvesBlock block={block} onComplete={()=>markBlockComplete(i)}/>);
            case 'carousel': return wrap(<InlineCarouselBlock block={block}/>);
            case 'bar-chart': return wrap(<InlineBarChartBlock block={block}/>);
            case 'summary-block': return wrap(<SummaryBlockInline block={block}/>);
            case 'next-steps-block': return wrap(<NextStepsBlockInline block={block} onClose={onClose} onPickAnother={onPickAnother} onRepeat={repeat} onOpenLesson={onOpenLesson}/>);
            default: return wrap(<div style={{padding:20,color:'#B0B0B8',textAlign:'center'}}>Блок '{block.type}' не реализован</div>);
          }
        })}
        {/* bottom padding */}
        <div style={{height:40}}/>
      </div>
    </div>);
}

// Main Lesson component — all lessons use scroll format
function Lesson({lessonId,onClose,onComplete,onPickAnother,onOpenLesson}){
  // ВАЖНО: в esbuild-бандле каждый файл обёрнут в IIFE, поэтому голый
  // LESSONS из lessons-index.js здесь НЕ виден (в babel-standalone «протекал»).
  // Берём список из window.YasnaLessons.lessons — он populated к моменту рендера.
  const ALL=(window.YasnaLessons&&window.YasnaLessons.lessons)||[];
  const lesson=ALL.find(l=>l.id===lessonId)||ALL[0];
  return<ScrollLesson key={lesson.id} lesson={lesson} onClose={onClose} onComplete={onComplete} onPickAnother={onPickAnother} onOpenLesson={onOpenLesson}/>;
}


// Expose engine pieces
Object.assign(window.YasnaLessons, {
  Lesson,
  renderRichText, LessonStar
});
