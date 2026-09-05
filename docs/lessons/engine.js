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

/* Текст только для чтеца. Глифы «✓ ✗ ✕» читаются вслух буквально
   («галочка», «знак умножения»), поэтому сам глиф прячем от чтеца, а
   смысл отдаём словом — видимая картинка при этом не меняется. */
const СКРЫТО={position:'absolute',width:1,height:1,margin:-1,padding:0,
  overflow:'hidden',clip:'rect(0 0 0 0)',whiteSpace:'nowrap',border:0};

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
        <line x1={cx-R-30} y1={cy} x2={cx+R+30} y2={cy} stroke="var(--outline-variant)" strokeWidth="1" strokeDasharray="3 4"/>
      </>}

      {/* Halves labels (only in halves mode) */}
      {mode==='halves'&&<>
        <text x={cx} y={cy-R-12} textAnchor="middle" fontSize="16" fontWeight="600" fill="var(--on-surface)">☀️ День · Свет</text>
        <text x={cx} y={cy+R+24} textAnchor="middle" fontSize="16" fontWeight="600" fill="var(--on-surface)">🌙 Ночь · Тьма</text>
      </>}

      {/* Circle */}
      {showCircle&&(mode==='cross-outline'||mode==='cross-labeled'||mode==='longs'||mode==='shorts'||mode==='full')&&<>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--outline-variant)" strokeWidth="1"/>
      </>}

      {/* Cross lines: in cross-labeled mode — ACCENT colors (visible cross);
          in other modes — technical dashed gray */}
      {mode==='cross-labeled'&&<>
        {/* Vertical (0↔6, foundations) — gold */}
        <line x1={cx} y1={cy-R-6} x2={cx} y2={cy+R+6} stroke="var(--tertiary)" strokeWidth="4" strokeLinecap="round"/>
        {/* Horizontal (3↔9, transitions) — blue */}
        <line x1={cx-R-6} y1={cy} x2={cx+R+6} y2={cy} stroke="var(--primary)" strokeWidth="4" strokeLinecap="round"/>
      </>}
      {(mode==='cross-outline'||mode==='longs'||mode==='shorts'||mode==='full')&&<>
        <line x1={cx} y1={cy-R-20} x2={cx} y2={cy+R+20} stroke="var(--outline-variant)" strokeWidth="1" strokeDasharray="3 4"/>
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
          <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke="var(--surface-container-low)" strokeWidth="2" style={{transition:'r .3s'}}/>
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
        return<text key={'l'+i} x={lp.x} y={lp.y+4} textAnchor={anch(i)} fontSize={isOpor?'24':'20'} fontWeight={inFocus?(isOpor?'700':'600'):'400'} fill={inFocus?'var(--on-surface)':'var(--on-surface-variant)'} opacity={opacity} style={{transition:'opacity .3s, font-weight .3s'}}>{lbl}</text>;
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
// Палитра: роли из core/tokeny.css — --surface под листом, --primary у
// действия, --surface-container у реплики, --tertiary-container у сценария.
// ═══════════════════════════════════════════════════════════════════

// Markdown-lite: **bold** + \n → <br>
/* ═══ ТЕРМИНЫ УРОКА ═══════════════════════════════════════════════
   Слова корпуса («опорный крест», «столб суток», «прана») объяснялись
   ТОЛЬКО по ходу: кто забыл их к шестой секции, не имел иного способа
   вспомнить, кроме прокрутки на восемь экранов вверх — Словарь и Справка
   живут на другом экране и из урока недостижимы. Теперь у термина два
   входа: тап по подчёркнутому слову в тексте и «⋮ → Словарь» в шапке.

   Длинные разборы здесь не дублируются: если у термина есть статья в
   общем словаре (GLOSS, core/data.js), она открывается по ссылке «гл» —
   один источник правды на приложение. Своими словами описаны только те
   термины, статей о которых в GLOSS нет. */
const ТЕРМИНЫ=[
  {имя:'Опорный крест', шаблон:'опорн(?:ый|ого|ому|ым|ом|ые|ых|ыми|ая|ой|ую)\\s+крест[а-яё]*',
   кратко:'Четыре главных места круга: 0, 3, 6, 9. Уберите любое — явление рассыплется.', гл:'support'},
  {имя:'Крест Управления', шаблон:'крест[а-яё]*\\s+управлени[а-яё]+',
   кратко:'Места 1, 4, 7, 10 — итоги: что получилось после опорного.', гл:'right'},
  {имя:'Крест Веры', шаблон:'крест[а-яё]*\\s+веры',
   кратко:'Места 2, 5, 8, 11 — подготовка к следующему опорному.', гл:'left'},
  {имя:'Линия Единства', шаблон:'лини[а-яё]*\\s+единства',
   кратко:'Вертикаль 0↔6. Делит круг на нарастание и спад.', гл:'support'},
  {имя:'Линия Борьбы', шаблон:'лини[а-яё]*\\s+борьбы',
   кратко:'Горизонт 3↔9. Делит круг на свет и тьму.', гл:'support'},
  {имя:'Столб суток', шаблон:'столб[а-яё]*\\s+(?:суток|врем[её]н)',
   кратко:'Вертикаль круга суток: Ночь (0) — День (6). Делит утреннюю сторону круга и вечернюю. Второе имя — столб времён.'},
  {имя:'Горизонт суток', шаблон:'горизонт[а-яё]*\\s+суток',
   кратко:'Линия 3—9 круга суток: Восход — Закат. Отделяет свет от тьмы.'},
  {имя:'Пятиминутка', шаблон:'пятиминутк[а-яё]*',
   кратко:'Восход (3) и Закат (9): солнечный диск идёт через горизонт около пяти минут — оттого и имя.'},
  {имя:'Прана', шаблон:'пран[аыуе](?![а-яё])',
   кратко:'Стихия места: ШЕ — земля, ФО — вода, ЦИ — воздух, ХА — огонь. Каждая занимает по три места круга.', гл:'she'},
  {имя:'Долгое время', шаблон:'долг(?:ое|ого|ому|им|ом)\\s+врем[яениё][а-яё]*',
   кратко:'Чётные места (0, 2, 4, 6, 8, 10) — там копится, тянется, длится.', гл:'type'},
  {имя:'Короткое время', шаблон:'коротк(?:ое|ого|ому|им|ом)\\s+врем[яениё][а-яё]*',
   кратко:'Нечётные места (1, 3, 5, 7, 9, 11) — там перелом: накопленное переходит в новое.', гл:'type'}
];

/* Один разбор на все термины: свой RegExp на каждый термин означал бы
   одиннадцать проходов по каждому абзацу урока. Скобки внутри шаблонов
   нарочно незахватывающие — номер сработавшей группы и есть номер
   термина. Хвостовой заслон (?![а-яё]) держит «пранатерапию» и «долгое
   времяпрепровождение» подальше от разметки. */
const ОБЩИЙ=new RegExp(ТЕРМИНЫ.map(т=>'('+т.шаблон+')').join('|')+'(?![а-яё])','gi');

function найтиТермин(слово){
  if(!слово)return null;
  const р=new RegExp('^(?:'+ТЕРМИНЫ.map(т=>т.шаблон).join('|')+')$','i');
  if(!р.test(слово.trim()))return null;
  const л=new RegExp(ОБЩИЙ.source,'i');
  const м=л.exec(слово);
  if(!м)return null;
  for(let k=1;k<м.length;k++)if(м[k]!==undefined)return ТЕРМИНЫ[k-1];
  return null;
}

/* Кто откроет объяснение. Урок на экране всегда один (lesson.html рисует
   ровно его), поэтому один общий обработчик честнее, чем контекст,
   протянутый через двадцать один тип блока. Ставит его ScrollLesson. */
let ОТКРЫТЬ_ТЕРМИН=null;

function Термин({термин,слово}){
  return(
    <button type='button'
      onClick={()=>{if(ОТКРЫТЬ_ТЕРМИН)ОТКРЫТЬ_ТЕРМИН(термин);}}
      aria-label={'Что такое «'+термин.имя+'» — открыть объяснение'}
      style={{font:'inherit',color:'inherit',background:'none',border:'none',padding:0,margin:0,
        cursor:'pointer',textDecoration:'underline',textDecorationStyle:'dotted',
        textDecorationColor:'var(--primary)',textUnderlineOffset:3}}>{слово}</button>);
}

/* Термин размечаем ОДИН раз на текст — первое вхождение. Подчеркнуть
   каждый «опорный крест» в абзаце значило бы превратить урок в гирлянду
   ссылок и увести глаз с самого текста. */
function разметить(текст,были){
  if(!текст)return[{т:текст}];
  const куски=[]; let конец=0, м;
  были=были||{};
  ОБЩИЙ.lastIndex=0;
  while((м=ОБЩИЙ.exec(текст))!==null){
    if(м[0]===''){ОБЩИЙ.lastIndex++;continue;}
    let н=-1;
    for(let k=1;k<м.length;k++)if(м[k]!==undefined){н=k-1;break;}
    if(н<0||были[н])continue;
    были[н]=true;
    if(м.index>конец)куски.push({т:текст.slice(конец,м.index)});
    куски.push({т:м[0],термин:ТЕРМИНЫ[н]});
    конец=м.index+м[0].length;
  }
  if(конец<текст.length)куски.push({т:текст.slice(конец)});
  return куски;
}

/* о.термины=true — размечать термины самим. Включено только там, где идёт
   сплошная речь урока (объяснение, говорящий, научная сноска): в вопросах
   и подписях подчёркивание спорило бы с ответами. Явная разметка [термин]
   работает везде и без флага. */
function renderRichText(text,о){
  if(!text) return null;
  const сам=!!(о&&о.термины);
  const parts=text.split(/(\*\*[^*]+\*\*|\[[^\][]+\])/g);
  const строки=(p,i)=>{
    const lines=p.split('\n');
    return lines.map((line,j)=>(
      <React.Fragment key={i+'_'+j}>
        {j>0&&<br/>}
        {line}
      </React.Fragment>
    ));
  };
  const были={};
  const термины=(текст,к)=>разметить(текст,были).map((ч,j)=>ч.термин
    ?<Термин key={к+'t'+j} термин={ч.термин} слово={ч.т}/>
    :<React.Fragment key={к+'p'+j}>{строки(ч.т,к+'p'+j)}</React.Fragment>);
  return parts.map((p,i)=>{
    if(p.startsWith('**')&&p.endsWith('**')){
      const жир=p.slice(2,-2);
      /* Термины ищем и в жирном тоже: уроки как раз и выделяют слово
         корпуса жирным в тот миг, когда вводят его («**столб суток**»).
         Без этого разметка обходила бы ровно те места, ради которых
         затевалась. */
      return<b key={i} style={{fontWeight:700,color:'var(--on-surface)'}}>{сам?термины(жир,i):жир}</b>;
    }
    if(p.startsWith('[')&&p.endsWith(']')&&p.length>2){
      const слово=p.slice(1,-1);
      const т=найтиТермин(слово);
      /* Скобки вокруг незнакомого слова — это опечатка, а не разметка:
         показываем слово, а не квадратные скобки. */
      return т?<Термин key={i} термин={т} слово={слово}/>:<React.Fragment key={i}>{слово}</React.Fragment>;
    }
    if(сам)return термины(p,i);
    return строки(p,i);
  });
}

// ───── Block components ─────

function HeroBlock({block}){
  return(
    <div style={{padding:'32px 24px 20px',maxWidth:680,margin:'0 auto'}}>
      {block.eyebrow&&<div style={{fontSize:11,color:'var(--primary)',textTransform:'uppercase',letterSpacing:1.1,fontWeight:700,marginBottom:16}}>{block.eyebrow}</div>}
      <h1 style={{fontSize:30,fontWeight:800,color:'var(--on-surface)',marginBottom:16,lineHeight:1.15,letterSpacing:'-0.5px'}}>{block.title}</h1>
      {block.lead&&<p style={{fontSize:16,color:'var(--on-surface)',lineHeight:1.6,fontWeight:400,marginBottom:0}}>{renderRichText(block.lead)}</p>}
      <div style={{height:2,width:48,background:'var(--primary)',marginTop:24,borderRadius:2}}/>
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
    let fill='var(--outline-variant)', stroke='none', strokeW=0, textFill='var(--on-surface-variant)';
    let dotR=5.5;
    if(isCurrent){
      fill='var(--primary)'; textFill='var(--on-primary)'; dotR=9; stroke='var(--surface-container-low)'; strokeW=2.5;
    } else if(isLearned){
      fill='var(--ok)'; textFill='var(--on-ok)'; dotR=6.5;
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
      <div style={{background:'var(--surface-container-low)',borderRadius:16,padding:'18px 20px',border:'1px solid var(--outline-variant)'}}>
        {block.eyebrow&&<div style={{fontSize:10.5,color:'var(--primary)',textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:4}}>{block.eyebrow}</div>}
        {block.title&&<div style={{fontSize:15,fontWeight:700,color:'var(--on-surface)',marginBottom:block.subtitle?2:12,lineHeight:1.35}}>{block.title}</div>}
        {block.subtitle&&<div style={{fontSize:12.5,color:'var(--on-surface-variant)',marginBottom:12,lineHeight:1.5}}>{block.subtitle}</div>}
        <div style={{display:'flex',gap:16,alignItems:'center'}}>
          <div style={{flexShrink:0}}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* Faint outer circle */}
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--outline-variant)" strokeWidth="1"/>
              {activePositions.length>1&&<path d={pathD} stroke="var(--primary)" strokeWidth="1.5" fill="none" opacity="0.3" strokeDasharray="3 3"/>}
              {dots}
            </svg>
          </div>
          <div style={{flex:1,minWidth:0,fontSize:12.5,lineHeight:1.55}}>
            {learnedArr.length>0&&(
              <div style={{marginBottom:8,display:'flex',gap:8,alignItems:'flex-start'}}>
                <span style={{flexShrink:0,marginTop:3,width:10,height:10,borderRadius:'50%',background:'var(--ok)',display:'inline-block'}}/>
                <div><b style={{color:'var(--on-surface)'}}>Уже знаешь:</b> <span style={{color:'var(--on-surface)'}}>{block.learnedLabels||'полочки '+learnedArr.join(', ')}</span></div>
              </div>
            )}
            {currentArr.length>0&&(
              <div style={{marginBottom:learnedArr.length>0?0:0,display:'flex',gap:8,alignItems:'flex-start'}}>
                <span style={{flexShrink:0,marginTop:3,width:10,height:10,borderRadius:'50%',background:'var(--primary)',display:'inline-block'}}/>
                <div><b style={{color:'var(--on-surface)'}}>Сегодня:</b> <span style={{color:'var(--on-surface)'}}>{block.currentLabels||'полочки '+currentArr.join(', ')}</span></div>
              </div>
            )}
            {block.upcomingLabels&&(
              <div style={{marginTop:8,display:'flex',gap:8,alignItems:'flex-start'}}>
                <span style={{flexShrink:0,marginTop:3,width:10,height:10,borderRadius:'50%',background:'var(--outline-variant)',display:'inline-block'}}/>
                <div><b style={{color:'var(--on-surface)'}}>Дальше:</b> <span style={{color:'var(--on-surface-variant)'}}>{block.upcomingLabels}</span></div>
              </div>
            )}
          </div>
        </div>
        {block.note&&<div style={{fontSize:12.5,color:'var(--on-surface)',lineHeight:1.6,marginTop:14,paddingTop:12,borderTop:'1px solid var(--outline-variant)'}}>{renderRichText(block.note)}</div>}
      </div>
    </div>);
}

function TocBlock({block}){
  return(
    <div style={{padding:'12px 24px 20px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'var(--surface-container-lowest)',border:'1px solid var(--outline-variant)',borderRadius:16,padding:'24px 24px',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        <div style={{fontSize:19,fontWeight:700,color:'var(--on-surface)',marginBottom:14,letterSpacing:'-0.2px'}}>{block.title||'Что в этом уроке'}</div>
        {block.intro&&<div style={{fontSize:14.5,color:'var(--on-surface)',lineHeight:1.65,marginBottom:16}}>{renderRichText(block.intro)}</div>}
        {block.items&&block.items.length>0&&(
          <>
            {block.itemsHeader&&<div style={{fontSize:14,color:'var(--on-surface)',fontWeight:600,marginBottom:10}}>{block.itemsHeader}</div>}
            <ul style={{listStyle:'none',padding:0,margin:0}}>
              {block.items.map((item,i)=>(
                <li key={i} style={{display:'flex',gap:10,marginBottom:10,fontSize:14,color:'var(--on-surface)',lineHeight:1.55}}>
                  <span style={{flexShrink:0,marginTop:1,color:'var(--primary)',fontWeight:700}}>{i+1}.</span>
                  <span>{renderRichText(item)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {block.outcomes&&block.outcomes.length>0&&(
          <div style={{marginTop:18,paddingTop:16,borderTop:'1px solid var(--outline-variant)'}}>
            <div style={{fontSize:13,color:'var(--on-surface)',fontWeight:600,marginBottom:10}}>{block.outcomesHeader||'После урока ты сможешь:'}</div>
            <ul style={{listStyle:'none',padding:0,margin:0}}>
              {block.outcomes.map((o,i)=>(
                <li key={i} style={{display:'flex',gap:10,marginBottom:8,fontSize:13.5,color:'var(--on-surface)',lineHeight:1.55}}>
                  <span style={{flexShrink:0,marginTop:2,color:'var(--ok)'}}>✓</span>
                  <span>{renderRichText(o)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {block.duration&&(
          <div style={{marginTop:18,paddingTop:14,borderTop:'1px solid var(--outline-variant)',display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--on-surface-variant)'}}>
            <span style={{fontSize:14}}>⏱</span>
            <span>Время прохождения: <b style={{color:'var(--on-surface)',fontWeight:600}}>{block.duration}</b></span>
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
        background:'var(--secondary-container)',border:'1px solid var(--outline-variant)',
        color:'var(--on-secondary-container)',fontSize:11.5,fontWeight:600,
        letterSpacing:0.2,
        cursor:'pointer',fontFamily:'inherit',flexShrink:0,
        minHeight:34,
        transition:'all .15s',
      }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--outline)';}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--outline-variant)';}}
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
      className="yl-lightscope"
      style={{
        position:'fixed',inset:0,zIndex:9999,colorScheme:'light dark',
        background:'rgba(15,27,42,.55)',
        display:'flex',alignItems:'flex-end',justifyContent:'center',
        animation:'scienceFade .2s ease-out',
      }}
    >
      <div
        style={{
          width:'100%',maxWidth:680,
          background:'var(--surface-container-lowest)',
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
            border:'none',background:'var(--surface-container)',
            color:'var(--on-surface-variant)',fontSize:20,fontWeight:400,
            cursor:'pointer',fontFamily:'inherit',
            display:'flex',alignItems:'center',justifyContent:'center',
            padding:0,lineHeight:1,zIndex:2,
          }}
        >×</button>

        {/* Drag handle */}
        <div style={{width:40,height:4,background:'var(--outline-variant)',borderRadius:2,margin:'0 auto 16px'}}/>

        {/* Area label */}
        {science.area&&(
          <div style={{fontSize:10.5,color:'var(--on-surface-variant)',textTransform:'uppercase',letterSpacing:1.1,fontWeight:700,marginBottom:8,display:'flex',alignItems:'center',gap:6,paddingRight:40}}>
            <span style={{fontSize:12}}>🔬</span>
            <span>Научная опора · {science.area}</span>
          </div>
        )}

        {/* Title */}
        {science.title&&<div style={{fontSize:17,fontWeight:700,color:'var(--on-surface)',marginBottom:4,lineHeight:1.3,letterSpacing:'-0.2px',paddingRight:40}}>{science.title}</div>}

        {/* Citation */}
        {science.citation&&<div style={{fontSize:12,color:'var(--on-surface-variant)',fontStyle:'italic',marginBottom:14}}>{science.citation}</div>}

        {/* Body */}
        <div style={{fontSize:14.5,color:'var(--on-surface)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{renderRichText(science.body||'')}</div>

        {/* Note */}
        {science.note&&<div style={{marginTop:14,padding:'12px 14px',background:'var(--surface-container)',borderRadius:10,border:'1px solid var(--outline-variant)',fontSize:13,color:'var(--on-surface-variant)',lineHeight:1.55}}>{renderRichText(science.note)}</div>}

        {/* Bottom close button */}
        <div style={{marginTop:22,textAlign:'center'}}>
          <button onClick={handleClose}
            style={{fontSize:14,fontWeight:600,padding:'12px 36px',borderRadius:12,border:'none',background:'var(--primary)',color:'var(--on-primary)',cursor:'pointer',fontFamily:'inherit',boxShadow:'var(--elev-3)'}}>
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
      <div style={{background:'var(--surface-container)',borderRadius:16,padding:'20px 22px',border:'1px solid var(--outline-variant)'}}>
        {block.science&&(
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <ScienceTag science={block.science} onOpen={()=>setPopup(true)}/>
          </div>
        )}
        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}>
          {useAvatarLogo
            ? <div style={{flexShrink:0,borderRadius:'50%',width:52,height:52,overflow:'hidden',background:'var(--surface-container-lowest)',border:'1px solid var(--outline-variant)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 3px rgba(15,27,42,.06)'}}><YasnaAvatar size={44}/></div>
            : <div style={{width:40,height:40,borderRadius:'50%',background:block.avatarColor||'var(--primary)',color:'var(--on-primary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,flexShrink:0,boxShadow:'var(--elev-3)'}}>{block.avatar||'?'}</div>
          }
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'var(--on-surface)',lineHeight:1.2}}>{block.name}</div>
            {block.role&&<div style={{fontSize:12,color:'var(--on-surface-variant)',marginTop:1}}>{block.role}</div>}
          </div>
        </div>
        <div style={{fontSize:15,color:'var(--on-surface)',lineHeight:1.65,whiteSpace:'pre-wrap'}}>{renderRichText(block.text,{термины:true})}</div>
      </div>
      {popup&&<SciencePopupSheet science={block.science} onClose={()=>setPopup(false)}/>}
    </div>);
}

function ExplanationBlock({block}){
  const[popup,setPopup]=useState(false);
  return(
    <div style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'var(--surface-container-lowest)',borderRadius:14,padding:'22px 24px',border:'1px solid var(--outline-variant)',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        {block.science&&(
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <ScienceTag science={block.science} onOpen={()=>setPopup(true)}/>
          </div>
        )}
        {block.title&&<div style={{fontSize:14,fontWeight:700,color:'var(--on-surface)',marginBottom:12,lineHeight:1.35}}>{block.title}</div>}
        <div style={{fontSize:14.5,color:'var(--on-surface)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{renderRichText(block.body,{термины:true})}</div>
      </div>
      {popup&&<SciencePopupSheet science={block.science} onClose={()=>setPopup(false)}/>}
    </div>);
}

function ScienceNoteBlock({block}){
  const phases=block.phases; // optional: [{label, type: 'hold'|'switch', desc}]
  return(
    <div style={{padding:'12px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'var(--surface-container)',borderRadius:12,padding:'18px 22px',border:'1px solid var(--outline-variant)',borderLeft:'3px solid var(--on-surface-variant)'}}>
        <div style={{fontSize:10.5,color:'var(--on-surface-variant)',textTransform:'uppercase',letterSpacing:1.1,fontWeight:700,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:12}}>🔬</span>
          <span>Научная сноска{block.subtitle?' · '+block.subtitle:''}</span>
        </div>
        {block.title&&<div style={{fontSize:13.5,fontWeight:700,color:'var(--on-surface)',marginBottom:8,lineHeight:1.4}}>{block.title}</div>}
        <div style={{fontSize:13.5,color:'var(--on-surface)',lineHeight:1.65,whiteSpace:'pre-wrap'}}>{renderRichText(block.body,{термины:true})}</div>

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
          const color=(type)=>type==='hold'?'var(--tertiary)':'var(--primary)';
          const colorLight=(type)=>type==='hold'?'var(--tertiary-container)':'var(--primary-container)';
          const labelY=(i)=>i<2?positions[i].y-36:positions[i].y+42;
          // Arrows between consecutive phases (rectangular path)
          const arrows=[
            {from:0,to:1,type:'horizontal',y:60},
            {from:1,to:2,type:'vertical',x:W*0.72},
            {from:2,to:3,type:'horizontal',y:175},
            {from:3,to:0,type:'vertical',x:W*0.28}
          ];
          return(
            <div style={{marginTop:14,marginBottom:4,background:'var(--surface-container-lowest)',borderRadius:10,padding:'14px 10px',border:'1px solid var(--outline-variant)'}}>
              {block.phasesTitle&&<div style={{fontSize:11,color:'var(--on-surface-variant)',textAlign:'center',marginBottom:4,fontWeight:600}}>{block.phasesTitle}</div>}
              <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block',maxHeight:260}}>
                {/* Arrows forming rectangular cycle */}
                {arrows.map((a,i)=>{
                  const from=positions[a.from],to=positions[a.to];
                  const isForward=(a.from+1)%4===a.to;
                  if(a.type==='horizontal'){
                    const x1=isForward?from.x+24:from.x-24;
                    const x2=isForward?to.x-24:to.x+24;
                    return<g key={'a'+i}>
                      <line x1={x1} y1={a.y} x2={x2} y2={a.y} stroke="var(--outline-variant)" strokeWidth="1.5" strokeDasharray="3 3"/>
                      {/* arrow head */}
                      <polygon points={`${x2},${a.y} ${x2-5},${a.y-3} ${x2-5},${a.y+3}`} fill="var(--outline-variant)" transform={isForward?'':`rotate(180 ${x2} ${a.y})`}/>
                    </g>;
                  }else{
                    const y1=isForward?from.y+24:from.y-24;
                    const y2=isForward?to.y-24:to.y+24;
                    return<g key={'a'+i}>
                      <line x1={a.x} y1={y1} x2={a.x} y2={y2} stroke="var(--outline-variant)" strokeWidth="1.5" strokeDasharray="3 3"/>
                      <polygon points={`${a.x},${y2} ${a.x-3},${y2-5} ${a.x+3},${y2-5}`} fill="var(--outline-variant)" transform={isForward?'':`rotate(180 ${a.x} ${y2})`}/>
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
                    <text key={'l'+i} x={p.x} y={labelY(i)} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--on-surface)">{ph.label}</text>
                  );
                })}
              </svg>
              {/* Legend */}
              <div style={{display:'flex',justifyContent:'center',gap:16,marginTop:4,fontSize:11,color:'var(--on-surface-variant)'}}>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:'var(--tertiary-container)',border:'2px solid var(--tertiary)'}}/>
                  <span>держится</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:'var(--primary-container)',border:'2px solid var(--primary)'}}/>
                  <span>меняется</span>
                </div>
              </div>
            </div>
          );
        })()}

        {block.citation&&<div style={{fontSize:11.5,color:'var(--on-surface-variant)',marginTop:10,fontStyle:'italic',lineHeight:1.5}}>{block.citation}</div>}
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
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 16px',borderRadius:20,background:'var(--ok-container)',color:'var(--on-ok-container)',fontSize:12,fontWeight:600}}>
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
            fontSize:15,fontWeight:600,color:'var(--on-surface-variant)',padding:'14px 32px',
            borderRadius:14,border:'1px solid var(--outline-variant)',background:'var(--surface-container)',
            cursor:'not-allowed',fontFamily:'inherit',transition:'all .2s'
          }}
        >{block.label||'Продолжить'} →</button>
        <div style={{fontSize:12,color:'var(--on-surface-variant)',textAlign:'center',lineHeight:1.5}}>↑ Сначала ответь на вопросы выше</div>
      </div>);
  }
  return(
    <div style={{padding:'28px 24px 32px',maxWidth:680,margin:'0 auto',display:'flex',justifyContent:'center'}}>
      <button
        onClick={onUnlock}
        className="gate-active"
        style={{
          fontSize:15,fontWeight:600,color:'var(--on-primary)',padding:'14px 32px',
          borderRadius:14,border:'none',background:'var(--primary)',cursor:'pointer',
          boxShadow:'var(--elev-3)',
          transition:'all .2s',fontFamily:'inherit'
        }}
        onMouseEnter={e=>{e.currentTarget.style.background='var(--primary)';e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='var(--elev-4)';}}
        onMouseLeave={e=>{e.currentTarget.style.background='var(--primary)';e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='var(--elev-3)';}}
      >{block.label||'Продолжить'} →</button>
    </div>);
}

/* начало / наОтвет — ответ переживает уход с экрана. Раньше выбор жил только
   в useState: после возврата в урок вопросы стояли пустыми, хотя шапка
   утверждала, что раздел пройден. Хранит и восстанавливает их ScrollLesson
   (yasna_znanie_v1[урок].поз.ответы), блок лишь отдаёт своё состояние. */
function CheckboxQuizBlock({block,blockId,onComplete,начало,наОтвет}){
  const[checked,setChecked]=useState(()=>(начало&&начало.checked)||{});
  const[touched,setTouched]=useState(()=>new Set((начало&&начало.touched)||[]));
  const[anyInteraction,setAnyInteraction]=useState(!!начало);
  /* Отклик на ответ появлялся обычным текстом под пунктом — чтец молчал, и
     незрячий не знал, принят ли выбор и верен ли он. Живая строка одна на
     блок и не пересоздаётся: только так объявление вообще случается. */
  const[отклик,setОтклик]=useState('');
  const single=!!block.single;
  const toggle=(id)=>{
    const пункт=(block.items||[]).find(x=>x.id===id);
    if(пункт){
      const станет=single?true:!checked[id];
      const верно=(станет===пункт.correct);
      const текст=станет?пункт.feedbackOn:пункт.feedbackOff;
      setОтклик((верно?'Верно. ':'Неверно. ')+(текст||пункт.label||''));
    }
    if(!anyInteraction){
      setAnyInteraction(true);
      if(onComplete)onComplete();
    }
    setTouched(prev=>{
      const next=new Set(prev);
      next.add(id);
      return next;
    });
    let следВыбор, следТронуто;
    if(single){
      // single-select: the newly picked item becomes the only checked one,
      // and we reset touched to just this item so previous picks don't show feedback
      следВыбор={[id]:true}; следТронуто=[id];
      setChecked(следВыбор);
      setTouched(new Set(следТронуто));
    } else {
      следВыбор={...checked,[id]:!checked[id]};
      следТронуто=[...new Set([...touched,id])];
      setChecked(следВыбор);
    }
    if(наОтвет)наОтвет({checked:следВыбор,touched:следТронуто});
  };
  return(
    <div style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'var(--surface-container-lowest)',borderRadius:14,padding:'22px 22px',border:'1px solid var(--outline-variant)',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        <div style={{fontSize:15,fontWeight:700,color:'var(--on-surface)',marginBottom:6,lineHeight:1.4}}>{block.question}</div>
        {block.hint&&<div style={{fontSize:13,color:'var(--on-surface-variant)',marginBottom:16,lineHeight:1.5}}>{block.hint}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {block.items.map(item=>{
            const isChecked=!!checked[item.id];
            const isTouched=touched.has(item.id);
            // Show feedback ONLY for items the user actually clicked
            const showFb=isTouched;
            const isRight=showFb&&(isChecked===item.correct);
            const borderColor=showFb?(isRight?'var(--ok)':'var(--error)'):'var(--outline-variant)';
            const fbColor=isRight?'var(--ok)':'var(--error)';
            const fbText=isChecked?item.feedbackOn:item.feedbackOff;
            return(
              <div key={item.id} style={{paddingLeft:12,borderLeft:'3px solid '+borderColor,transition:'border-color .3s',paddingBottom:showFb&&fbText?2:0}}>
                <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer',padding:'3px 0'}}>
                  <input
                    type={single?'radio':'checkbox'}
                    name={single?blockId:undefined}
                    checked={isChecked}
                    onChange={()=>toggle(item.id)}
                    style={{marginTop:3,cursor:'pointer',accentColor:'var(--primary)',width:16,height:16,flexShrink:0}}
                  />
                  <span style={{fontSize:14,color:'var(--on-surface)',lineHeight:1.5}}>{item.label}</span>
                </label>
                {showFb&&fbText&&(
                  <div style={{fontSize:12.5,color:fbColor,marginTop:4,marginLeft:26,lineHeight:1.55,animation:'slideDown .3s ease'}}>{fbText}</div>
                )}
              </div>);
          })}
        </div>
        <div role='status' aria-live='polite' style={СКРЫТО}>{отклик}</div>
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
function PillarsPickerBlock({block,onComplete,начало,наОтвет}){
  const numCorrect=block.numCorrect||4;
  /* начало / наОтвет — см. CheckboxQuizBlock: ответ переживает уход с экрана. */
  const[selected,setSelected]=useState(()=>new Set((начало&&начало.selected)||[]));
  const[submitted,setSubmitted]=useState(!!(начало&&начало.submitted));
  const[hintOpen,setHintOpen]=useState(false);
  const correct=new Set(block.correct||[]);
  const isCorrect=selected.size===numCorrect
    && [...selected].every(id=>correct.has(id))
    && [...correct].every(id=>selected.has(id));

  const toggle=(id)=>{
    if(submitted&&isCorrect)return; // locked after success
    const next=new Set(selected);
    if(next.has(id))next.delete(id);
    else next.add(id);
    setSelected(next);
    if(submitted)setSubmitted(false);
    if(наОтвет)наОтвет({selected:[...next],submitted:false});
  };
  const check=()=>{
    setSubmitted(true);
    if(наОтвет)наОтвет({selected:[...selected],submitted:true});
    // Call onComplete regardless of correctness — user can advance with
    // a wrong answer. Feedback will still show the right one; retry is
    // optional. This avoids the trap of forcing retries to unlock a gate.
    if(onComplete)onComplete();
  };
  const reset=()=>{
    setSelected(new Set());
    setSubmitted(false);
    if(наОтвет)наОтвет({selected:[],submitted:false});
  };

  return(
    <div style={{padding:'16px 20px',maxWidth:680,margin:'0 auto'}}>
      {/* Question card — black border, minimalist */}
      <div style={{background:'var(--surface-container-lowest)',border:'2px solid var(--outline)',borderRadius:4,padding:'22px 20px'}}>
        {/* Mode + Yasna label */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:block.mode==='guided'?'var(--tertiary)':'var(--primary)',letterSpacing:0.8,textTransform:'uppercase',marginBottom:6}}>
            {block.mode==='guided'?'Упражнение с подсказкой':'Практика'}
          </div>
          {block.yasna&&<div style={{fontSize:18,fontWeight:700,color:'var(--on-surface)',marginBottom:10,letterSpacing:'-0.2px',lineHeight:1.25}}>{block.yasna}</div>}
          {block.question&&<div style={{fontSize:15,color:'var(--on-surface)',lineHeight:1.55,fontWeight:400}}>{renderRichText(block.question)}</div>}
        </div>

        {/* Hint (guided only) — collapsed by default so users try
            themselves first before peeking. */}
        {block.mode==='guided'&&block.hint&&(
          <div style={{marginBottom:16}}>
            <button onClick={()=>setHintOpen(!hintOpen)}
              style={{
                display:'flex',alignItems:'center',gap:8,
                width:'100%',padding:'10px 14px',
                background:hintOpen?'var(--tertiary-container)':'var(--surface-container-low)',
                borderLeft:`3px solid ${hintOpen?'var(--tertiary)':'var(--outline-variant)'}`,
                borderTop:'none',borderRight:'none',borderBottom:'none',
                borderRadius:'0 4px 4px 0',
                cursor:'pointer',fontFamily:'inherit',textAlign:'left',
                fontSize:13,color:hintOpen?'var(--on-tertiary-container)':'var(--on-surface-variant)',fontWeight:600,
                transition:'all .15s'
              }}>
              <span style={{fontSize:14}}>💡</span>
              <span style={{flex:1}}>{hintOpen?'Подсказка':'Показать подсказку'}</span>
              <span style={{fontSize:11,color:hintOpen?'var(--on-tertiary-container)':'var(--on-surface-variant)',transition:'transform .2s',transform:hintOpen?'rotate(90deg)':'none'}}>▶</span>
            </button>
            {hintOpen&&(
              <div style={{padding:'10px 14px 12px 17px',background:'var(--tertiary-container)',borderLeft:'3px solid var(--tertiary)',borderRadius:'0 0 4px 0',fontSize:13.5,color:'var(--on-tertiary-container)',lineHeight:1.55,marginTop:-1}}>
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
            // Знак внутри кружка красится ПАРОЙ к своей заливке (--on-ok,
            // --on-error, --on-primary): в тёмной теме заливки светлые, и
            // общий белый знак на них было бы не различить.
            let rowColor='var(--on-surface)', rowWeight=400, indicatorBg='var(--surface-container-lowest)', indicatorBorder='var(--outline)', indicatorInk='var(--on-primary)', indicatorFill=null;
            if(submitted){
              if(isSelected && isRight){
                rowColor='var(--ok)'; rowWeight=600;
                indicatorBg='var(--ok)'; indicatorBorder='var(--ok)'; indicatorInk='var(--on-ok)'; indicatorFill='✓';
              } else if(isSelected && !isRight){
                rowColor='var(--error)'; rowWeight=500;
                indicatorBg='var(--error)'; indicatorBorder='var(--error)'; indicatorInk='var(--on-error)'; indicatorFill='✕';
              } else if(!isSelected && isRight){
                rowColor='var(--tertiary)'; rowWeight=500;
                indicatorBorder='var(--tertiary)'; indicatorFill=null;
              }
            } else if(isSelected){
              rowColor='var(--primary)'; rowWeight=600;
              indicatorBg='var(--primary)'; indicatorBorder='var(--primary)'; indicatorInk='var(--on-primary)'; indicatorFill='✓';
            }
            return(
              <button key={c.id} onClick={()=>toggle(c.id)}
                disabled={submitted&&isCorrect}
                style={{display:'flex',alignItems:'center',gap:14,padding:'14px 0',background:'transparent',border:'none',borderBottom:idx<block.candidates.length-1?'1px solid var(--outline-variant)':'none',cursor:submitted&&isCorrect?'default':'pointer',textAlign:'left',fontFamily:'inherit',width:'100%'}}>
                {/* Circular checkbox indicator */}
                <span style={{flexShrink:0,width:22,height:22,borderRadius:'50%',border:`2px solid ${indicatorBorder}`,background:indicatorBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:indicatorInk,transition:'all .15s'}}>
                  {indicatorFill}
                </span>
                <span style={{fontSize:15,color:rowColor,fontWeight:rowWeight,lineHeight:1.4,flex:1}}>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Counter + action */}
        {!submitted&&(
          <div style={{display:'flex',alignItems:'center',gap:12,marginTop:18,paddingTop:16,borderTop:'1px solid var(--outline-variant)'}}>
            <div style={{fontSize:12.5,color:'var(--on-surface-variant)',flex:1}}>Выбрано <b style={{color:selected.size===numCorrect?'var(--primary)':'var(--on-surface)'}}>{selected.size}</b> из {numCorrect}</div>
            <button onClick={check} disabled={selected.size!==numCorrect}
              style={{fontSize:13.5,fontWeight:600,padding:'10px 20px',borderRadius:4,border:'none',background:selected.size===numCorrect?'var(--primary)':'var(--surface-container-highest)',color:selected.size===numCorrect?'var(--on-primary)':'var(--on-surface-variant)',cursor:selected.size===numCorrect?'pointer':'default',fontFamily:'inherit',transition:'all .15s',letterSpacing:0.2}}>
              Проверить
            </button>
          </div>
        )}
      </div>

      {/* Feedback — OUTSIDE the question card, with coloured vertical bar on the left */}
      {/* Обёртка живёт всегда: чтец объявляет только то, что появилось
          ВНУТРИ существующего role=status; если родить сам узел с ролью, он
          промолчит. Внешний вид не меняется — обёртка пустая. */}
      <div role='status' aria-live='polite'>
      {submitted&&(
        <div style={{marginTop:14,padding:'16px 18px 16px 20px',borderLeft:`3px solid ${isCorrect?'var(--ok)':'var(--error)'}`,fontSize:14,lineHeight:1.65,color:'var(--on-surface)'}}>
          <div style={{fontWeight:700,marginBottom:8,color:isCorrect?'var(--ok)':'var(--error)'}}>
            {isCorrect?'Верно!':'Неверный ответ.'}
          </div>
          <div style={{whiteSpace:'pre-wrap'}}>{renderRichText(isCorrect?block.feedbackOk:block.feedbackError)}</div>
          {!isCorrect&&(
            <button onClick={reset}
              style={{marginTop:14,fontSize:13,fontWeight:500,padding:'8px 16px',borderRadius:4,border:'1px solid var(--outline)',background:'var(--surface-container-lowest)',color:'var(--on-surface)',cursor:'pointer',fontFamily:'inherit'}}>
              Попробовать снова
            </button>
          )}
        </div>
      )}
      </div>
    </div>);
}

function ScenarioBlock({block}){
  return(
    <div style={{padding:'20px 24px 4px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'var(--tertiary-container)',border:'1px solid var(--tertiary)',borderRadius:14,padding:'18px 20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,flexWrap:'wrap'}}>
          <div style={{fontSize:10.5,color:'var(--on-surface-variant)',textTransform:'uppercase',letterSpacing:1,fontWeight:700,background:'var(--surface-container-lowest)',padding:'3px 10px',borderRadius:6,border:'1px solid var(--outline-variant)'}}>{block.variant}</div>
          <div style={{fontSize:15,fontWeight:700,color:'var(--on-tertiary-container)'}}>{block.name}</div>
        </div>
        <div style={{fontSize:14,color:'var(--on-tertiary-container)',lineHeight:1.6}}>{block.context}</div>
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
      <div style={{background:'var(--surface-container-low)',borderRadius:16,padding:'20px 4px',border:'1px solid var(--outline-variant)',textAlign:'center'}}>
        {block.title&&<div style={{fontSize:14,fontWeight:700,color:'var(--on-surface)',marginBottom:12}}>{block.title}</div>}
        <div style={{width:'100%',margin:'0 auto',aspectRatio:'800/460'}}>
          <div className="yasna-star-pulse" style={{width:'100%',height:'100%'}}>
            <LessonStar mode={mode} highlighted={highlighted} labels={labels} focusType={focusType}/>
          </div>
        </div>
        {block.caption&&<div style={{fontSize:13,color:'var(--on-surface-variant)',marginTop:14,lineHeight:1.55,padding:'0 8px'}}>{block.caption}</div>}
      </div>
    </div>);
}

/* ПУТЬ СОЛНЦА — единственная картинка, которой уроку не хватало.
   Первый урок начинается с того, что человек встаёт лицом к югу и видит,
   как солнце идёт слева направо: выходит на востоке жёлтым, заходит на
   западе красным, а ночью продолжает путь под землёй, где его не видно.
   До сих пор это было сказано только словами — звезда рисует деление
   надвое, но ни востока, ни запада, ни дуги в ней нет, и текст опирался
   на картинку, которой не существовало.
   Данные берём ровно те, что есть в расшифровке: куда смотрим, откуда
   куда идёт дуга, рисовать ли скрытую часть и какого цвета полусолнца. */
function SunPathBlock({block}){
  const {from='восток',to='запад'}=block.arc||{};
  const метки=block.marks||[];
  const цвет=(где,запас)=>{
    const м=метки.find(x=>x.at===где);
    if(!м) return запас;
    return /красн/i.test(м.color)?'#C2410C':/жёлт|желт|золот/i.test(м.color)?'#E8A52B':запас;
  };
  const цвВосх=цвет(from,'#E8A52B'), цвЗах=цвет(to,'#C2410C');
  /* Полотно 640×300: земля по центру, дуга сверху, зеркальная — снизу. */
  const W=640,H=300,зем=190,лев=90,прав=550,верх=54,низ=зем+96;
  const дуга=(y)=>`M ${лев} ${зем} Q ${(лев+прав)/2} ${y} ${прав} ${зем}`;
  return(
    <div style={{padding:'20px 16px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'var(--surface-container-low)',borderRadius:16,padding:'20px 4px',border:'1px solid var(--outline-variant)',textAlign:'center'}}>
        {block.title&&<div style={{fontSize:14,fontWeight:700,color:'var(--on-surface)',marginBottom:12}}>{block.title}</div>}
        <div style={{width:'100%',margin:'0 auto',aspectRatio:'640/300'}}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'100%',display:'block'}}
               role="img" aria-label={`Путь солнца: восходит на стороне «${from}», заходит на стороне «${to}», ночью идёт под землёй`}>
            {/* Небо и земля: свет сверху, тьма снизу — как в самом уроке. */}
            <rect x="0" y="0" width={W} height={зем} fill="var(--primary-container)" opacity=".25"/>
            <rect x="0" y={зем} width={W} height={H-зем} fill="var(--on-surface)" opacity=".07"/>
            <line x1="24" y1={зем} x2={W-24} y2={зем} stroke="var(--on-surface)" strokeWidth="2" opacity=".55"/>
            {/* Видимая дуга — сплошная; скрытая часть пути — пунктиром. */}
            <path d={дуга(верх)} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round"/>
            {block.hiddenPath!==false&&
              <path d={дуга(низ)} fill="none" stroke="var(--on-surface-variant)" strokeWidth="2.5"
                    strokeLinecap="round" strokeDasharray="7 9" opacity=".75"/>}
            {/* Куда идёт солнце: стрелка на вершине дуги, слева направо. */}
            <path d={`M ${(лев+прав)/2 - 26} ${верх+38} l 52 0 m -13 -8 l 13 8 l -13 8`}
                  fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity=".85"/>
            {/* Полусолнца на концах: на востоке золотое, на западе красное. */}
            <path d={`M ${лев-30} ${зем} a 30 30 0 0 1 60 0 z`} fill={цвВосх}/>
            <path d={`M ${прав-30} ${зем} a 30 30 0 0 1 60 0 z`} fill={цвЗах}/>
            <text x={лев} y={зем+30} textAnchor="middle" fontSize="17" fontWeight="600"
                  fill="var(--on-surface)" fontFamily="var(--ya-font-display,var(--sans))">{from}</text>
            <text x={прав} y={зем+30} textAnchor="middle" fontSize="17" fontWeight="600"
                  fill="var(--on-surface)" fontFamily="var(--ya-font-display,var(--sans))">{to}</text>
            {block.facing&&
              <text x={W/2} y={H-14} textAnchor="middle" fontSize="15"
                    fill="var(--on-surface-variant)" fontFamily="var(--ya-font-display,var(--sans))">
                {`стоим лицом к ${block.facing === 'юг' ? 'югу' : block.facing}`}</text>}
          </svg>
        </div>
        {block.caption&&<div style={{fontSize:13,color:'var(--on-surface-variant)',marginTop:14,lineHeight:1.55,padding:'0 8px'}}>{block.caption}</div>}
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
      <div style={{background:'var(--tertiary-container)',border:'1px solid var(--tertiary)',borderRadius:16,padding:'22px 22px'}}>
        <div style={{fontSize:10.5,color:'var(--on-tertiary-container)',textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:10}}>Личные заметки</div>
        <div style={{fontSize:16,fontWeight:700,color:'var(--on-tertiary-container)',marginBottom:6}}>{block.title}</div>
        {block.intro&&<div style={{fontSize:13.5,color:'var(--on-tertiary-container)',opacity:.85,lineHeight:1.6,marginBottom:18}}>{block.intro}</div>}
        {(block.questions||[]).map(q=>(
          <div key={q.id} style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:13,fontWeight:600,color:'var(--on-tertiary-container)',marginBottom:6,lineHeight:1.4}}>{q.label}</label>
            <textarea
              value={answers[q.id]||''}
              onChange={e=>update(q.id,e.target.value)}
              placeholder={q.placeholder||''}
              rows={2}
              style={{width:'100%',padding:'10px 12px',fontSize:14,fontFamily:'inherit',color:'var(--on-surface)',border:'1px solid var(--outline)',borderRadius:8,outline:'none',resize:'vertical',lineHeight:1.5,background:'var(--surface-container-lowest)',boxSizing:'border-box'}}
            />
          </div>
        ))}
        {block.footer&&<div style={{fontSize:12,color:'var(--on-tertiary-container)',opacity:.85,lineHeight:1.5,marginTop:8,fontStyle:'italic'}}>{block.footer}</div>}
      </div>
    </div>);
}

function FinalQuizInlineBlock({block,onComplete,начало,наОтвет}){
  /* начало / наОтвет — см. CheckboxQuizBlock: ответ переживает уход с экрана. */
  const[answers,setAnswers]=useState(()=>(начало&&начало.answers)||{});
  useEffect(()=>{
    if(Object.keys(answers).length===block.questions.length&&onComplete){
      onComplete();
    }
  },[Object.keys(answers).length]);
  return(
    <div style={{padding:'20px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'var(--surface-container-lowest)',borderRadius:16,padding:'24px 24px',border:'1px solid var(--outline-variant)'}}>
        {block.title&&<div style={{fontSize:16,fontWeight:700,color:'var(--on-surface)',marginBottom:18}}>{block.title}</div>}
        {block.questions.map((q,qi)=>{
          const answeredIdx=answers[qi];
          const answered=answeredIdx!=null;
          return(
            <div key={qi} style={{marginBottom:22,paddingBottom:20,borderBottom:qi<block.questions.length-1?'1px solid var(--outline-variant)':'none'}}>
              <div style={{fontSize:14.5,fontWeight:600,color:'var(--on-surface)',marginBottom:12,lineHeight:1.45}}>{qi+1}. {q.q}</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {q.options.map((opt,oi)=>{
                  const isSelected=answeredIdx===oi;
                  const isCorrect=oi===q.correctIdx;
                  let bg='var(--surface-container-lowest)',border='var(--outline-variant)',color='var(--on-surface)';
                  if(answered){
                    if(isCorrect){bg='var(--ok-container)';border='var(--ok)';}
                    else if(isSelected){bg='var(--error-container)';border='var(--error)';}
                  }
                  return(
                    <button key={oi}
                      onClick={()=>{if(answered)return;const след={...answers,[qi]:oi};setAnswers(след);if(наОтвет)наОтвет({answers:след});}}
                      disabled={answered}
                      style={{textAlign:'left',padding:'11px 14px',fontSize:14,color,background:bg,border:'1.5px solid '+border,borderRadius:10,cursor:answered?'default':'pointer',transition:'all .2s',fontFamily:'inherit',lineHeight:1.4}}
                    >{opt}{answered&&isCorrect?<span style={{color:'var(--ok)',fontWeight:700,marginLeft:8}}><span aria-hidden='true'>✓</span><span style={СКРЫТО}> — верный ответ</span></span>:null}{answered&&isSelected&&!isCorrect?<span style={{color:'var(--error)',fontWeight:700,marginLeft:8}}><span aria-hidden='true'>✗</span><span style={СКРЫТО}> — ваш ответ, неверный</span></span>:null}</button>);
                })}
              </div>
              {/* Разбор появляется на месте, а не рождается вместе с ролью:
                  постоянный role=status объявляет его вслух сразу после
                  ответа. Вид не меняется — пустая обёртка ничего не рисует. */}
              <div role='status' aria-live='polite'>
              {answered&&q.explain&&(
                <div style={{marginTop:12,padding:'12px 14px',background:'var(--surface-container-low)',borderRadius:10,fontSize:13,color:'var(--on-surface)',lineHeight:1.6,borderLeft:'3px solid var(--primary)'}}>
                  <b style={{color:'var(--on-surface)'}}>Разбор:</b> {q.explain}
                </div>
              )}
              </div>
            </div>);
        })}
      </div>
    </div>);
}

/* ═══════════════════════════════════════════════════════════════════
   ВИДЕО И ЗВУК ВНУТРИ УРОКА

   ЗАЧЕМ. Вводный урок управления не обязан быть текстом: одно управление
   пришлёт запись беседы, другое — звуковую дорожку. Эти два блока дают
   уроку оба вида, не меняя его форму: тот же массив blocks, тот же
   порядок, та же прокрутка.

   ПОЧЕМУ ВИДЕО НЕ ВСТРОЕНО В СТРАНИЦУ. Встроенный плеер — это чужой код,
   загруженный с чужого сервера: сборщик витрины (app/sobrat-vitrinu.mjs)
   такие загрузки ловит и роняет сборку, а условия площадок разрешают показ
   записи только в их собственном проигрывателе. Поэтому здесь — обложка
   (своя, если управление её прислало), имя записи, длительность и кнопка,
   которая отдаёт адрес системному браузеру. Экран урока при этом остаётся
   на месте: человек возвращается на него из браузера.

   ПОЧЕМУ ЗВУК ИГРАЕТ ЗДЕСЬ. Звуковой файл лежит в нашем хранилище, адрес
   приходит из данных урока — чужого кода не появляется. Проигрыватель
   обычный, без автозапуска и без предзакачки (preload="none"): урок
   открывают и в дороге, качать дорожку без спроса нельзя. Если браузер
   формат не взял, под проигрывателем стоит запасная дверь «Открыть файл».

   ПОЛЯ БЛОКА video:
     {type:'video', title, body, src, cover, duration, platform, note}
       src      — адрес записи (внешний; открывается браузером);
       cover    — свой файл обложки; нет — рисуем знак;
       duration — «12 мин», «4:20» — как есть, строкой;
       platform — имя площадки; не задано — берём хост из адреса;
       note     — строка под кнопкой вместо строки по умолчанию.
   ПОЛЯ БЛОКА audio:
     {type:'audio', title, body, src, duration, note}
       src      — адрес звукового файла в нашем хранилище.
   ═══════════════════════════════════════════════════════════════════ */

/* Одна таблица стилей на оба блока. Инлайновым стилем не задать ни
   :focus-visible, ни поведение картинки-обложки, а второй источник правды
   о виде урока (см. lesson.html) заводить не хочется — поэтому крошечный
   лист вставляем один раз на страницу. */
const СТИЛИ_МЕДИА = `
.ur-media-kn:focus-visible,.ur-media-zapas:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.ur-media-zvuk:focus-visible{outline:2px solid var(--primary);outline-offset:3px;border-radius:10px}
.ur-media-oblozhka{display:block;width:100%;height:100%;object-fit:cover}
`;
function вставитьСтилиМедиа(){
  try{
    if(document.getElementById('ur-media-stili'))return;
    const л=document.createElement('style');
    л.id='ur-media-stili';л.textContent=СТИЛИ_МЕДИА;
    document.head.appendChild(л);
  }catch(_){}
}

/* Площадка по адресу — только чтобы человек знал, куда уходит. */
function площадкаПоАдресу(адрес){
  try{
    const хост=new URL(String(адрес)).host.replace(/^www\./,'');
    if(/rutube\.ru$/i.test(хост))return 'Rutube';
    if(/(^|\.)vk(video)?\.(com|ru)$/i.test(хост))return 'ВК Видео';
    if(/youtube\.com$|youtu\.be$/i.test(хост))return 'YouTube';
    if(/t\.me$/i.test(хост))return 'Телеграм';
    return хост;
  }catch(_){return '';}
}

function VideoBlock({block}){
  useEffect(вставитьСтилиМедиа,[]);
  const адрес=block.src||block.href||'';
  const площадка=block.platform||площадкаПоАдресу(адрес);
  const метка='Смотреть'+(block.title?' «'+block.title+'»':' запись')
    +(площадка?', '+площадка:'')+' — откроется в браузере';
  return(
    <div className='ur-media ur-media--video' style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'var(--surface-container-lowest)',borderRadius:14,border:'1px solid var(--outline-variant)',overflow:'hidden',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        {/* Обложка: своя картинка, если управление её прислало, иначе знак.
            Плашка с треугольником — примета записи, а не живой плеер: она
            не кликается, дверь наружу одна и подписана словами. */}
        <div style={{position:'relative',aspectRatio:'16 / 9',background:'var(--surface-container-high)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          {block.cover?(
            <React.Fragment>
              <img className='ur-media-oblozhka' src={block.cover} alt='' loading='lazy' decoding='async'/>
              {/* Плашка с треугольником — только поверх обложки: она говорит,
                  что картинка — это запись. Без обложки её место занимает
                  сам знак записи, и две приметы одного не спорят. */}
              <div aria-hidden='true' style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:58,height:58,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'var(--elev-3)'}}>
                <svg viewBox='0 0 24 24' style={{width:26,height:26,marginLeft:3}}><path d='M8.5 5.5 18.5 12l-10 6.5z' fill='var(--on-primary)'/></svg>
              </div>
            </React.Fragment>
          ):(
            <svg viewBox='0 0 96 60' aria-hidden='true' style={{width:112,height:70,opacity:.6}}>
              <rect x='3' y='7' width='64' height='46' rx='8' fill='none' stroke='var(--on-surface-variant)' strokeWidth='2.5'/>
              <path d='M69 24 92 13v34L69 36z' fill='none' stroke='var(--on-surface-variant)' strokeWidth='2.5' strokeLinejoin='round'/>
              <path d='M28 20l17 10-17 10z' fill='var(--on-surface-variant)'/>
            </svg>
          )}
          {block.duration&&(
            <div style={{position:'absolute',right:10,bottom:10,padding:'3px 9px',borderRadius:6,background:'rgba(0,0,0,.66)',color:'#FFFFFF',fontSize:11.5,fontWeight:700,letterSpacing:.2}}>{block.duration}</div>
          )}
        </div>
        <div style={{padding:'16px 20px 18px'}}>
          <div style={{fontSize:10.5,color:'var(--on-surface-variant)',textTransform:'uppercase',letterSpacing:1.1,fontWeight:700,marginBottom:8}}>
            Видео{площадка?' · '+площадка:''}{block.duration?' · '+block.duration:''}
          </div>
          {block.title&&<div style={{fontSize:15,fontWeight:700,color:'var(--on-surface)',marginBottom:8,lineHeight:1.35}}>{block.title}</div>}
          {block.body&&<div style={{fontSize:14,color:'var(--on-surface)',lineHeight:1.65,whiteSpace:'pre-wrap',marginBottom:14}}>{renderRichText(block.body,{термины:true})}</div>}
          {адрес?(
            <React.Fragment>
              <a className='ur-media-kn' href={адрес} target='_blank' rel='noopener noreferrer' aria-label={метка}
                 style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,minHeight:48,padding:'0 24px',borderRadius:12,background:'var(--primary)',color:'var(--on-primary)',fontSize:15,fontWeight:600,textDecoration:'none'}}>
                <svg viewBox='0 0 24 24' aria-hidden='true' style={{width:18,height:18,flexShrink:0}}><path d='M8.5 5.5 18.5 12l-10 6.5z' fill='currentColor'/></svg>
                <span>Смотреть</span>
              </a>
              <div style={{fontSize:12,color:'var(--on-surface-variant)',lineHeight:1.5,marginTop:10}}>
                {block.note||('Запись откроется в браузере'+(площадка?' на площадке '+площадка:'')+'. Урок останется здесь.')}
              </div>
            </React.Fragment>
          ):(
            <div style={{fontSize:13,color:'var(--on-surface-variant)',lineHeight:1.6}}>Адрес записи в уроке не указан.</div>
          )}
        </div>
      </div>
    </div>);
}

function AudioBlock({block}){
  useEffect(вставитьСтилиМедиа,[]);
  /* Браузер молчит по-разному: где-то не тянет формат, где-то файл не
     доехал. Человеку нужен один ответ — запасная дверь к файлу, — поэтому
     она стоит всегда, а при сбое над ней появляется строка с причиной. */
  const[сбой,setСбой]=useState(false);
  const адрес=block.src||block.href||'';
  const метка='Звуковая запись'+(block.title?' «'+block.title+'»':'')
    +(block.duration?', '+block.duration:'');
  return(
    <div className='ur-media ur-media--zvuk' style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'var(--surface-container-lowest)',borderRadius:14,border:'1px solid var(--outline-variant)',padding:'18px 20px 18px',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,fontSize:10.5,color:'var(--on-surface-variant)',textTransform:'uppercase',letterSpacing:1.1,fontWeight:700,marginBottom:8}}>
          <svg viewBox='0 0 24 24' aria-hidden='true' style={{width:15,height:15,flexShrink:0}}>
            <path d='M4 14v-2a8 8 0 0 1 16 0v2' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'/>
            <rect x='3' y='13.5' width='4.5' height='6.5' rx='2' fill='none' stroke='currentColor' strokeWidth='1.8'/>
            <rect x='16.5' y='13.5' width='4.5' height='6.5' rx='2' fill='none' stroke='currentColor' strokeWidth='1.8'/>
          </svg>
          <span>Звук{block.duration?' · '+block.duration:''}</span>
        </div>
        {block.title&&<div style={{fontSize:15,fontWeight:700,color:'var(--on-surface)',marginBottom:8,lineHeight:1.35}}>{block.title}</div>}
        {block.body&&<div style={{fontSize:14,color:'var(--on-surface)',lineHeight:1.65,whiteSpace:'pre-wrap',marginBottom:14}}>{renderRichText(block.body,{термины:true})}</div>}
        {адрес?(
          <React.Fragment>
            {/* Проигрыватель — родной, системный: его умеет и чтец, и наушники,
                и кнопки на гарнитуре. Без автозапуска и без предзакачки —
                звук начинается только по нажатию, дорожка качается только
                после него. Полосу проигрывателя рисует сама система (свой
                вид она берёт от системной темы, не от нашей), поэтому мы
                сажаем её на подложку: так она читается как часть карточки,
                а не как чужая деталь на ней. */}
            <div style={{background:'var(--surface-container)',borderRadius:14,padding:6,border:'1px solid var(--outline-variant)'}}>
              <audio className='ur-media-zvuk' controls preload='none' src={адрес}
                     aria-label={метка} onError={()=>setСбой(true)}
                     style={{display:'block',width:'100%',minHeight:44}}/>
            </div>
            {сбой&&(
              <div role='status' style={{marginTop:10,padding:'10px 12px',borderRadius:10,background:'var(--surface-container)',border:'1px solid var(--outline-variant)',fontSize:12.5,color:'var(--on-surface)',lineHeight:1.55}}>
                Здесь запись не проигралась. Откройте файл отдельно — ссылка ниже.
              </div>
            )}
            <div style={{marginTop:12,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <a className='ur-media-zapas' href={адрес} target='_blank' rel='noopener noreferrer'
                 aria-label={'Открыть звуковой файл отдельно'+(block.title?' — «'+block.title+'»':'')}
                 style={{display:'inline-flex',alignItems:'center',gap:7,minHeight:44,padding:'0 16px',borderRadius:11,border:'1px solid var(--outline-variant)',color:'var(--primary)',fontSize:14,fontWeight:600,textDecoration:'none'}}>
                <svg viewBox='0 0 24 24' aria-hidden='true' style={{width:16,height:16,flexShrink:0}}>
                  <path d='M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'/>
                </svg>
                <span>Открыть файл</span>
              </a>
              <span style={{fontSize:12,color:'var(--on-surface-variant)',lineHeight:1.5}}>{block.note||'Если проигрыватель молчит.'}</span>
            </div>
          </React.Fragment>
        ):(
          <div style={{fontSize:13,color:'var(--on-surface-variant)',lineHeight:1.6}}>Адрес звукового файла в уроке не указан.</div>
        )}
      </div>
    </div>);
}

function SummaryBlockInline({block}){
  return(
    <div style={{padding:'24px'}}>
      <div style={{maxWidth:680,margin:'0 auto',background:'var(--primary)',color:'var(--on-primary)',borderRadius:18,padding:'28px 28px',boxShadow:'var(--elev-3)'}}>
        <div style={{fontSize:11,color:'var(--on-primary)',opacity:.8,textTransform:'uppercase',letterSpacing:1.2,fontWeight:700,marginBottom:12}}>Главное из этого урока</div>
        <div style={{fontSize:22,fontWeight:700,marginBottom:18,lineHeight:1.25,letterSpacing:'-0.3px'}}>{block.title}</div>
        <ul style={{listStyle:'none',padding:0,margin:0}}>
          {/* points или items: половина уроков написана через items, и их
              итоговые пункты просто не выводились — 12 строк в трёх уроках. */}
          {(block.points||block.items||[]).map((p,i)=>(
            <li key={i} style={{display:'flex',gap:12,marginBottom:12,fontSize:14,lineHeight:1.6,color:'var(--on-primary)'}}>
              <span style={{flexShrink:0,marginTop:2,opacity:.9}}>—</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        {block.nextLabel&&(
          <div style={{marginTop:22,padding:'14px 16px',background:'var(--primary-container)',borderRadius:10,fontSize:13,color:'var(--on-primary-container)',lineHeight:1.55}}>{block.nextLabel}</div>
        )}
      </div>
    </div>);
}

function NextStepsBlockInline({block,onClose,onPickAnother,onRepeat,onOpenLesson,lesson}){
  /* Следующий урок предлагается, только если он РЕАЛЬНО написан: раньше
     битый nextLessonId молча открывал первый попавшийся урок (ALL[0]).
     Имя, подпись и объём тоже берём у самого урока и у его узла в дереве,
     а поля из финала оставляем запасными: набранные руками, они разъезжаются
     при первой правке соседа — чужое название, чужие минуты, «готовится»
     у давно написанного урока. */
  const все=(window.YasnaLessons&&window.YasnaLessons.lessons)||[];
  const след=useMemo(()=>{
    const урокПоId=id=>все.find(l=>l&&l.id===id)||null;
    const узелПоId=id=>{
      try{
        const Д=window.YasnaDerevo;if(!Д)return null;
        for(const в of Д.ВЕТВИ){
          const у=(в.узлы||[]).find(у=>у&&у.id===id);
          if(у)return у;
        }
      }catch(_){}
      return null;
    };
    // 1. Урок назвал следующего сам — но верим только написанному.
    let id=block.nextLessonId&&урокПоId(block.nextLessonId)?block.nextLessonId:null;
    // 2. Не назвал (или назвал несуществующего) — берём соседа по своей ветви.
    if(!id&&lesson){
      try{
        const Д=window.YasnaDerevo;
        if(Д)for(const в of Д.ВЕТВИ){
          const узлы=(в.узлы||[]).filter(у=>!у.нет&&у.адрес&&(у.жанр==='урок'||у.жанр==='разбор'));
          const i=узлы.findIndex(у=>у.id===lesson.id);
          if(i>=0&&узлы[i+1]&&урокПоId(узлы[i+1].id)){id=узлы[i+1].id;break;}
        }
      }catch(_){}
    }
    if(!id)return null;
    const у=урокПоId(id),н=узелПоId(id);
    return {id,
      имя:(у&&у.title)||(н&&н.имя)||block.nextLessonTitle||'',
      подпись:(у&&у.subtitle)||(н&&н.о)||block.nextLessonSubtitle||'',
      объём:(у&&у.duration)||(н&&н.объём)||block.nextLessonDuration||''};
  },[block.nextLessonId,lesson&&lesson.id]);
  /* Статус 'planned' из файла больше не гасит кнопку: урок либо написан
     (тогда он открывается), либо его нет — и об этом говорит подпись. */
  const canOpenNext=!!(след&&onOpenLesson);
  const открытьСлед=()=>onOpenLesson(след.id);
  // Пока урока нет — печатаем то, что набрано в финале: это единственный источник.
  const имяСлед=(след&&след.имя)||block.nextLessonTitle||'';
  const подписьСлед=(след&&след.подпись)||block.nextLessonSubtitle||'';
  const объёмСлед=(след&&след.объём)||block.nextLessonDuration||'';
  /* Практика после урока: раскладка своей ясны. Игра умеет вернуть на
     «Уроки» (otkuda=uroki) — единственный экран с корректным возвратом. */
  const ИГРОВЫЕ=['суток','двора','двора_животных','дома','кухни','круговорота_воды','года',
    'дерева','печи','завода_предприятия','колокольни','театра','фаз_жизни','kostra','emotsiy','удочки'];
  const практика=lesson&&lesson.yasna&&ИГРОВЫЕ.indexOf(lesson.yasna)>=0
    ?'games/krug/index.html?yasna='+encodeURIComponent(lesson.yasna)+'&otkuda=uroki':null;
  return(
    <div style={{padding:'16px 24px 60px',maxWidth:680,margin:'0 auto'}}>
      {/* Custom next-lesson promo (optional) — clickable card if nextLessonId provided */}
      {имяСлед&&(
        <div style={{background:'var(--surface-container-lowest)',border:'1px solid var(--outline-variant)',borderRadius:14,padding:'18px 18px',marginBottom:12,boxShadow:'0 1px 3px rgba(15,27,42,.05)'}}>
          {block.title&&<div style={{fontSize:10,fontWeight:700,color:'var(--primary)',textTransform:'uppercase',letterSpacing:0.8,marginBottom:6}}>{block.title}</div>}
          {block.intro&&<div style={{fontSize:13.5,color:'var(--on-surface)',lineHeight:1.55,marginBottom:14}}>{renderRichText(block.intro)}</div>}
          {canOpenNext?(
            <button
              onClick={открытьСлед}
              style={{display:'block',width:'100%',textAlign:'left',padding:'14px 14px',background:'var(--primary-container)',borderRadius:12,border:'1px solid var(--outline-variant)',cursor:'pointer',fontFamily:'inherit',transition:'all .2s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--outline)';e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='var(--elev-3)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--outline-variant)';e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}
            >
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:700,color:'var(--on-primary-container)',flex:1,minWidth:0}}>{имяСлед}</div>
                <span style={{fontSize:18,color:'var(--on-primary-container)',fontWeight:700,flexShrink:0}}>→</span>
              </div>
              {подписьСлед&&<div style={{fontSize:12.5,color:'var(--on-primary-container)',lineHeight:1.5,marginBottom:4}}>{подписьСлед}</div>}
              {объёмСлед&&<div style={{fontSize:11.5,color:'var(--on-primary-container)',opacity:.8}}>{объёмСлед}</div>}
            </button>
          ):(
            <div style={{padding:'14px 14px',background:'var(--primary-container)',borderRadius:12,border:'1px solid var(--outline-variant)'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:700,color:'var(--on-primary-container)',flex:1,minWidth:0}}>{имяСлед}</div>
                {/* Урока в приложении нет — так и говорим, без «скоро». */}
                <span style={{fontSize:10,fontWeight:700,color:'var(--on-surface-variant)',background:'var(--surface-container)',padding:'3px 8px',borderRadius:10,letterSpacing:0.3,whiteSpace:'nowrap'}}>в приложении пока нет</span>
              </div>
              {подписьСлед&&<div style={{fontSize:12.5,color:'var(--on-primary-container)',lineHeight:1.5,marginBottom:4}}>{подписьСлед}</div>}
              {объёмСлед&&<div style={{fontSize:11.5,color:'var(--on-primary-container)',opacity:.8}}>{объёмСлед}</div>}
            </div>
          )}
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {canOpenNext?(
          <>
            <button onClick={открытьСлед} style={{fontSize:15,fontWeight:600,padding:'14px 24px',borderRadius:12,border:'none',background:'var(--primary)',color:'var(--on-primary)',cursor:'pointer',boxShadow:'var(--elev-3)',fontFamily:'inherit'}}>{'Следующий урок →'}</button>
            {практика&&<a href={практика} style={{fontSize:14,fontWeight:600,padding:'12px 24px',borderRadius:12,border:'none',background:'var(--primary-container)',color:'var(--on-primary-container)',cursor:'pointer',fontFamily:'inherit',textAlign:'center',textDecoration:'none'}}>Разложить самому — закрепить</a>}
            <button onClick={onPickAnother} style={{fontSize:14,fontWeight:500,padding:'12px 24px',borderRadius:12,border:'1px solid var(--outline-variant)',background:'var(--surface-container-lowest)',color:'var(--on-surface)',cursor:'pointer',fontFamily:'inherit'}}>← Вернуться к «Урокам»</button>
            <button onClick={onRepeat} style={{fontSize:13,fontWeight:500,padding:'10px 24px',borderRadius:12,border:'none',background:'transparent',color:'var(--on-surface-variant)',cursor:'pointer',fontFamily:'inherit'}}>⟲ Пройти ещё раз</button>
          </>
        ):(
          <>
            {практика&&<a href={практика} style={{fontSize:15,fontWeight:600,padding:'14px 24px',borderRadius:12,border:'none',background:'var(--primary)',color:'var(--on-primary)',cursor:'pointer',boxShadow:'var(--elev-3)',fontFamily:'inherit',textAlign:'center',textDecoration:'none',display:'block'}}>Разложить самому — закрепить</a>}
            <button onClick={onPickAnother} style={практика?{fontSize:14,fontWeight:500,padding:'12px 24px',borderRadius:12,border:'1px solid var(--outline-variant)',background:'var(--surface-container-lowest)',color:'var(--on-surface)',cursor:'pointer',fontFamily:'inherit'}:{fontSize:15,fontWeight:600,padding:'14px 24px',borderRadius:12,border:'none',background:'var(--primary)',color:'var(--on-primary)',cursor:'pointer',boxShadow:'var(--elev-3)',fontFamily:'inherit'}}>← Вернуться к «Урокам»</button>
            <button onClick={onRepeat} style={{fontSize:14,fontWeight:500,padding:'12px 24px',borderRadius:12,border:'none',background:'transparent',color:'var(--on-surface-variant)',cursor:'pointer',fontFamily:'inherit'}}>⟲ Пройти ещё раз</button>
          </>
        )}
      </div>
    </div>);
}


// ─── Общий пульс анимационных сцен ──────────────────────────────────
// Каждая сцена раньше крутила бы свой setInterval без остановки. Один хук:
// уважает prefers-reduced-motion (в спокойном режиме часов нет вовсе, шаги
// листаются руками), встаёт на паузу за экраном и в скрытой вкладке,
// на 120 Гц идёт по requestAnimationFrame ровно.
function useШаги({стадий,мсНаСтадию}){
  const[кадр,ставь]=useState({i:0,ts:0});
  const[спок,ставьСпок]=useState(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}});
  const[ручной,ставьРучной]=useState(0);
  const узел=useRef(null),виден=useRef(true),t0=useRef(0),прошло=useRef(0);
  useEffect(()=>{
    let m;try{m=matchMedia('(prefers-reduced-motion: reduce)');}catch(_){return;}
    const h=e=>ставьСпок(e.matches);
    m.addEventListener?m.addEventListener('change',h):m.addListener(h);
    return()=>{m.removeEventListener?m.removeEventListener('change',h):m.removeListener(h);};
  },[]);
  useEffect(()=>{
    if(!узел.current||typeof IntersectionObserver==='undefined')return;
    const o=new IntersectionObserver(([e])=>{виден.current=e.isIntersecting;},{threshold:.2});
    o.observe(узел.current);return()=>o.disconnect();
  },[]);
  useEffect(()=>{
    if(спок)return;
    let id;const шаг=(t)=>{
      if(!t0.current)t0.current=t;
      if(виден.current&&!document.hidden){
        прошло.current=(t-t0.current)%(стадий*мсНаСтадию);
        ставь({i:Math.floor(прошло.current/мсНаСтадию),ts:(прошло.current%мсНаСтадию)/мсНаСтадию});
      }else{t0.current=t-прошло.current;}
      id=requestAnimationFrame(шаг);
    };
    id=requestAnimationFrame(шаг);return()=>cancelAnimationFrame(id);
  },[спок,стадий,мсНаСтадию]);
  if(спок)return{i:((ручной%стадий)+стадий)%стадий,ts:1,спок:true,узел,
    вперёд:()=>ставьРучной(v=>v+1),назад:()=>ставьРучной(v=>v-1)};
  return{i:кадр.i,ts:кадр.ts,спок:false,узел};
}

// ─── Круговорот воды: круг, развёрнутый в пейзаж ────────────────────
// Горизонт сцены = линия 3–9 круга: слева вода поднимается, справа
// спускается, и петля замыкается сама, без затемнения и перезапуска.
// Подземная ветка (промокание → пустоты → коллекторы → ключ) идёт вторым,
// приглушённым слоем под горизонтом — автор проговаривает её отдельно.
// Цвета внутри картинки (небо, земля, вода, туча, крыша) — это рисунок, а
// не интерфейс: он одинаков в обеих темах, как фотография на странице.
// Ролями взяты только карточка вокруг него, подписи и точки шагов.
function InlineWaterCycleBlock({block}){
  const МС=1500,СТАДИЙ=12;
  const ш=useШаги({стадий:СТАДИЙ,мсНаСтадию:МС});
  const яснаВоды=useMemo(()=>{
    try{return (Array.isArray(T)?T:Object.values(T)).find(y=>y.id==='круговорота_воды');}catch(_){return null;}
  },[]);
  // стадия k соответствует месту круга: 0-я стадия — место 3, дальше по кругу
  const МЕСТО=[3,4,5,6,7,8,9,10,11,0,1,2];
  const место=МЕСТО[ш.i];
  const имя=яснаВоды&&яснаВоды.p&&яснаВоды.p[место]?String(яснаВоды.p[место]).replace(/\n/g,' '):'';
  // п(k): 0 до стадии k, плавно 0→1 на стадии k, 1 после (до конца петли)
  const п=k=>ш.i>k?1:(ш.i===k?ш.ts:0);
  const вспышка=ш.i===4?(ш.ts<.15||( ш.ts>.3&&ш.ts<.45)?1:0):0;
  const волна=Math.sin((ш.i+ш.ts)*2.4);
  const цветТучи=ш.i>=4?'#7E8896':'#fff';
  return(
    <div ref={ш.узел} style={{padding:'8px 24px'}}>
      <div style={{maxWidth:680,margin:'0 auto',background:'var(--surface-container-lowest)',border:'1px solid var(--outline-variant)',borderRadius:16,overflow:'hidden'}}>
        {block.title&&<div style={{padding:'16px 18px 0',fontSize:16,fontWeight:700,color:'var(--on-surface)'}}>{block.title}</div>}
        <svg viewBox="0 0 400 250" style={{display:'block',width:'100%'}} aria-label="Круговорот воды по кругу Ясны">
          <rect width="400" height="150" fill="#F2F7FC"/>
          <rect y="150" width="400" height="100" fill="#EFE7DC"/>
          <path d="M0 150 H136 L150 250 H0 Z" fill="#BBD8EC"/>
          <line x1="0" y1="150" x2="400" y2="150" stroke="#8FA3B5" strokeDasharray="3 4"/>
          {/* 3 · поверхность: барашки */}
          {[16,44,72,100].map((x,j)=>(
            <path key={'b'+j} d={'M'+x+' 150 q6 '+(-4-волна*2)+' 12 0'} stroke="#2E86C1" strokeWidth="2" fill="none" opacity={.5+.5*п(0)}/>
          ))}
          {/* 4 · пар: столбик капель тает кверху */}
          {[0,1,2,3,4].map(j=>(
            <circle key={'p'+j} cx={38+j*11} cy={146-п(1)*(34+j*9)} r="3" fill="#9CC5E0" opacity={п(1)*(1-j*.16)}/>
          ))}
          {/* 5–7 · облако → караван → туча */}
          <g transform={'translate('+(120+п(3)*120)+' 72)'} opacity={п(2)}>
            <ellipse rx="26" ry="13" fill={цветТучи}/>
            <ellipse cx="-18" cy="4" rx="15" ry="9" fill={цветТучи}/>
            <ellipse cx="17" cy="5" rx="13" ry="8" fill={цветТучи}/>
            <ellipse cx="-42" cy="6" rx="11" ry="7" fill={цветТучи} opacity={п(3)}/>
            <ellipse cx="40" cy="7" rx="9" ry="6" fill={цветТучи} opacity={п(3)}/>
          </g>
          <path d="M262 62 l-8 16 h8 l-7 15" stroke="#F6C64A" strokeWidth="3" fill="none" opacity={вспышка}/>
          {/* 8 · дождь: косые струи */}
          {[0,1,2,3,4,5].map(j=>(
            <line key={'d'+j} x1={226+j*13} y1={88+((ш.i+ш.ts)*37+j*17)%52} x2={222+j*13} y2={100+((ш.i+ш.ts)*37+j*17)%52}
              stroke="#2E86C1" strokeWidth="2" opacity={п(5)*.8}/>
          ))}
          {/* 9 · касание: крыша и всплески */}
          <path d="M236 150 L266 128 L296 150 Z" fill="#B5764A"/>
          {[248,266,284].map((x,j)=>(
            <path key={'v'+j} d={'M'+x+' '+(140-j*4)+' q3 -5 6 0'} stroke="#5BA3D0" strokeWidth="2" fill="none" opacity={п(6)}/>
          ))}
          {/* 10 · стекание по скату */}
          <path d="M266 130 L294 150 L318 164" stroke="#5BA3D0" strokeWidth={2.5*п(7)} fill="none" opacity={п(7)}/>
          {/* 11 · лужа + подземная пустота */}
          <ellipse cx="330" cy="168" rx={26*п(8)} ry={5*п(8)} fill="#5BA3D0"/>
          <ellipse cx="330" cy="214" rx={18*п(8)} ry={7*п(8)} fill="#7FA8C4" opacity=".4"/>
          {/* 0 · грязь: поток влево */}
          <path d={'M330 172 H'+(330-160*п(9))+' q-6 8 4 12 H330 Z'} fill="#8B6B4A" opacity={.85*п(9)}/>
          {/* 1 · болото и ключ */}
          <ellipse cx="150" cy="200" rx={34*п(10)} ry={9*п(10)} fill="#6E8B5A"/>
          {[0,1,2].map(j=>(
            <circle key={'k'+j} cx={144+j*6} cy={198-((ш.i+ш.ts)*23+j*7)%14} r="2" fill="#BBD8EC" opacity={п(10)}/>
          ))}
          {/* 2 · река назад в водоём */}
          <path d="M148 196 C120 192, 100 180, 84 166" stroke="#2E86C1" strokeWidth={4*п(11)} fill="none" strokeDasharray="10 8" opacity={п(11)}/>
          {/* подземная ветка приглушённо */}
          <path d="M318 170 C300 205, 220 220, 160 204" stroke="#7FA8C4" strokeWidth="2" strokeDasharray="4 6" fill="none" opacity={.35*п(8)}/>
        </svg>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 18px 16px'}}>
          {ш.спок&&<button onClick={ш.назад} aria-label="Предыдущий шаг" style={{minWidth:44,minHeight:44,border:'1px solid var(--outline-variant)',borderRadius:10,background:'var(--surface-container-lowest)',fontSize:16,cursor:'pointer'}}>‹</button>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--primary)',letterSpacing:.6}}>МЕСТО {место}</div>
            <div style={{fontSize:14.5,fontWeight:600,color:'var(--on-surface)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{имя||('стадия '+(ш.i+1))}</div>
          </div>
          <div style={{display:'flex',gap:3}} aria-hidden="true">
            {МЕСТО.map((м,j)=>(
              <span key={м} style={{width:6,height:6,borderRadius:3,background:j===ш.i?'var(--primary)':'var(--outline-variant)'}}/>
            ))}
          </div>
          {ш.спок&&<button onClick={ш.вперёд} aria-label="Следующий шаг" style={{minWidth:44,minHeight:44,border:'1px solid var(--outline-variant)',borderRadius:10,background:'var(--surface-container-lowest)',fontSize:16,cursor:'pointer'}}>›</button>}
        </div>
        {block.caption&&<div style={{padding:'0 18px 16px',fontSize:12.5,color:'var(--on-surface-variant)',lineHeight:1.5}}>{block.caption}</div>}
      </div>
    </div>);
}

// ─── Animated sunrise with rising cortisol curve ───
// Солнце и линия горизонта остаются своими цветами по той же причине, что и
// круговорот воды: это рисунок. Карточка, подписи и оси — роли.
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
      <div style={{background:'var(--surface-container-low)',borderRadius:16,padding:'20px 18px',border:'1px solid var(--outline-variant)'}}>
        {block.title&&<div style={{fontSize:15,fontWeight:700,color:'var(--on-surface)',marginBottom:4,textAlign:'center'}}>{block.title}</div>}
        {block.caption&&<div style={{fontSize:13,color:'var(--on-surface-variant)',marginBottom:14,textAlign:'center',lineHeight:1.5}}>{block.caption}</div>}

        <svg viewBox="0 0 400 220" style={{width:'100%',height:200,display:'block'}}>
          {/* Horizon */}
          <line x1="10" y1="170" x2="390" y2="170" stroke="#B8874A" strokeWidth="1.5" strokeDasharray="2 3"/>

          {/* Cortisol curve — monotonic dashed blue line */}
          <path
            d={`M 20 170 Q ${60+t*150} ${170-cortisolH*80} ${sunX} ${170-cortisolH*125}`}
            fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeDasharray="4 4" opacity={0.75*fade}
          />

          {/* Sun */}
          <circle cx={sunX} cy={sunY} r={20} fill="#FFB020" opacity={0.3*fade}/>
          <circle cx={sunX} cy={sunY} r={14} fill="#FFB020" opacity={fade}/>

          {/* Axis labels */}
          <text x="20" y="190" fontSize="10" fill="var(--on-surface-variant)">~3:00</text>
          <text x="200" y="190" fontSize="10" fill="var(--on-surface-variant)" textAnchor="middle">~6:30</text>
          <text x="380" y="190" fontSize="10" fill="var(--on-surface-variant)" textAnchor="end">~9:00</text>

          {/* Legend */}
          <g transform="translate(10, 208)">
            <line x1="0" y1="0" x2="16" y2="0" stroke="var(--primary)" strokeWidth="2" strokeDasharray="3 3"/>
            <text x="22" y="3" fontSize="9" fill="var(--on-surface-variant)">кортизол</text>
            <circle cx="80" cy="0" r="4" fill="#FFB020"/>
            <text x="90" y="3" fontSize="9" fill="var(--on-surface-variant)">солнце</text>
          </g>
        </svg>

        <div style={{display:'flex',justifyContent:'space-around',marginTop:8,gap:6}}>
          {shelfLabels.map(s=>{
            const isActive=activeShelf===s.num;
            return(
              <div key={s.num} style={{flex:1,textAlign:'center',padding:'8px 6px',borderRadius:10,background:isActive?'var(--surface-container-lowest)':'transparent',border:'1.5px solid '+(isActive?'var(--primary)':'transparent'),transition:'all .3s'}}>
                <div style={{fontSize:16,fontWeight:800,color:isActive?'var(--primary)':'var(--on-surface-variant)',transition:'color .3s'}}>{s.num}</div>
                <div style={{fontSize:11.5,fontWeight:700,color:isActive?'var(--on-surface)':'var(--on-surface-variant)',marginTop:2,transition:'color .3s'}}>{s.name}</div>
                <div style={{fontSize:10.5,color:'var(--on-surface-variant)',marginTop:1,lineHeight:1.3}}>{s.desc}</div>
              </div>);
          })}
        </div>
      </div>
    </div>);
}

// ─── Tap-to-assign: place elements on 3 shelves ───
function InlineThreeShelvesBlock({block,onComplete,начало,наОтвет}){
  /* начало / наОтвет — см. CheckboxQuizBlock: ответ переживает уход с экрана. */
  const[assignments,setAssignments]=useState(()=>(начало&&начало.assignments)||{});
  const[interacted,setInteracted]=useState(!!начало);

  const assign=(itemId,shelfNum)=>{
    if(!interacted){setInteracted(true);if(onComplete)onComplete();}
    const след={...assignments,[itemId]:shelfNum};
    setAssignments(след);
    if(наОтвет)наОтвет({assignments:след});
  };

  return(
    <div style={{padding:'16px 24px',maxWidth:680,margin:'0 auto'}}>
      <div style={{background:'var(--surface-container-lowest)',borderRadius:14,padding:'22px 22px',border:'1px solid var(--outline-variant)',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        <div style={{fontSize:15,fontWeight:700,color:'var(--on-surface)',marginBottom:6,lineHeight:1.4}}>{block.question}</div>
        {block.hint&&<div style={{fontSize:13,color:'var(--on-surface-variant)',marginBottom:16,lineHeight:1.5}}>{block.hint}</div>}

        {/* Shelf legend */}
        <div style={{display:'flex',gap:8,marginBottom:16,padding:'12px 10px',background:'var(--surface-container)',borderRadius:12}}>
          {block.shelves.map(s=>(
            <div key={s.num} style={{flex:1,textAlign:'center'}}>
              <div style={{fontSize:16,fontWeight:800,color:'var(--primary)'}}>{s.num}</div>
              <div style={{fontSize:12,fontWeight:700,color:'var(--on-surface)',marginTop:2}}>{s.name}</div>
            </div>
          ))}
        </div>

        {/* Items */}
        {block.items.map(item=>{
          const assigned=assignments[item.id];
          const attempted=assigned!=null;
          const isCorrect=assigned===item.correct;
          const cardBg=attempted?(isCorrect?'var(--ok-container)':'var(--error-container)'):'var(--surface-container-lowest)';
          const cardBorder=attempted?(isCorrect?'var(--ok)':'var(--error)'):'var(--outline-variant)';
          return(
            <div key={item.id} style={{marginBottom:10,padding:'14px 14px',background:cardBg,border:'1px solid '+cardBorder,borderRadius:12,transition:'all .25s'}}>
              <div style={{fontSize:14,color:attempted?(isCorrect?'var(--on-ok-container)':'var(--on-error-container)'):'var(--on-surface)',marginBottom:10,lineHeight:1.45}}>{item.label}</div>
              <div style={{display:'flex',gap:6}}>
                {block.shelves.map(s=>{
                  const selected=assigned===s.num;
                  const correctBtn=attempted&&s.num===item.correct;
                  let bg='var(--surface-container-lowest)',color='var(--on-surface)',border='var(--outline-variant)';
                  if(attempted){
                    if(selected&&isCorrect){bg='var(--ok)';color='var(--on-ok)';border='var(--ok)';}
                    else if(selected&&!isCorrect){bg='var(--error)';color='var(--on-error)';border='var(--error)';}
                    else if(correctBtn){bg='var(--surface-container-lowest)';color='var(--ok)';border='var(--ok)';}
                  }
                  return(
                    <button key={s.num}
                      onClick={()=>!attempted&&assign(item.id,s.num)}
                      disabled={attempted}
                      style={{flex:1,padding:'9px 10px',fontSize:13.5,fontWeight:700,color,background:bg,border:'1.5px solid '+border,borderRadius:8,cursor:attempted?'default':'pointer',fontFamily:'inherit',transition:'all .15s'}}
                    >{s.num}</button>);
                })}
              </div>
              <div role='status' aria-live='polite'>
              {attempted&&item.explain&&(
                <div style={{fontSize:12.5,color:isCorrect?'var(--on-ok-container)':'var(--on-error-container)',marginTop:10,lineHeight:1.55}}>
                  {isCorrect?<span><span aria-hidden='true'>✓ </span><span style={СКРЫТО}>Верно. </span></span>:'Правильно — '+item.correct+'. '}{item.explain}
                </div>
              )}
              </div>
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
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeOpacity=".2" strokeWidth="1" strokeDasharray="2 3"/>
        {/* cross lines: 0↔6 (vertical) and 3↔9 (horizontal) */}
        {[[0,6],[3,9]].map(([a,b],i)=>{
          const pa=pt(a), pb=pt(b);
          return<line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={color} strokeOpacity=".33" strokeWidth="1.5"/>;
        })}
        {/* 12 dots — only 4 pillars are colored, rest are muted */}
        {Array.from({length:12}).map((_,i)=>{
          const p=pt(i);
          const isPillar=pillarPositions.includes(i);
          return<circle key={i} cx={p.x} cy={p.y} r={isPillar?8:3} fill={isPillar?color:'var(--outline-variant)'}/>;
        })}
        {/* pillar position numbers inside colored dots */}
        {pillars.map(p=>{
          const pos=pt(p.pos);
          return<text key={'n'+p.pos} x={pos.x} y={pos.y+3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--on-primary)">{p.pos}</text>;
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
        {block.title&&<div style={{fontSize:15,fontWeight:700,color:'var(--on-surface)',marginBottom:4}}>{block.title}</div>}
        {block.hint&&<div style={{fontSize:13,color:'var(--on-surface-variant)',lineHeight:1.5}}>{block.hint}</div>}
      </div>
      <div
        ref={ref}
        onScroll={onScroll}
        style={{display:'flex',gap:12,overflowX:'auto',scrollSnapType:'x mandatory',padding:'4px 24px 12px',WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}
      >
        {block.items.map((item,i)=>(
          <div key={i} style={{flex:'0 0 78%',maxWidth:320,scrollSnapAlign:'start',background:'var(--surface-container-low)',borderRadius:14,padding:'18px 18px',border:'1px solid var(--outline-variant)',boxShadow:'none'}}>
            {item.emoji&&<div style={{fontSize:26,marginBottom:8}}>{item.emoji}</div>}
            <div style={{fontSize:15,fontWeight:700,color:'var(--on-surface)',marginBottom:3,lineHeight:1.3}}>{item.title}</div>
            {item.subtitle&&<div style={{fontSize:11.5,color:'var(--on-surface-variant)',marginBottom:12,textTransform:'uppercase',letterSpacing:0.6,fontWeight:600}}>{item.subtitle}</div>}
            {item.pillars && <div style={{padding:'12px 0 8px'}}><PillarsMini pillars={item.pillars} color={'var(--primary)'}/></div>}
            {item.body && <div style={{fontSize:13.5,color:'var(--on-surface)',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{renderRichText(item.body)}</div>}
          </div>
        ))}
      </div>
      {/* dots */}
      <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:8}}>
        {block.items.map((_,i)=>(
          <div key={i} style={{width:activeIdx===i?18:6,height:6,borderRadius:3,background:activeIdx===i?'var(--primary)':'var(--outline-variant)',transition:'all .25s'}}/>
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
      <div style={{background:'var(--surface-container-lowest)',borderRadius:14,padding:'22px 22px',border:'1px solid var(--outline-variant)',boxShadow:'0 1px 3px rgba(15,27,42,.04)'}}>
        {block.title&&<div style={{fontSize:14,fontWeight:700,color:'var(--on-surface)',marginBottom:6}}>{block.title}</div>}
        {block.caption&&<div style={{fontSize:12.5,color:'var(--on-surface-variant)',marginBottom:20,lineHeight:1.55}}>{block.caption}</div>}
        <div style={{display:'flex',gap:16,alignItems:'flex-end',height:170,paddingBottom:8}}>
          {block.bars.map((b,i)=>{
            const minVisible=6; // always show at least a sliver for zero/tiny values
            const h=max>0?Math.max(minVisible,(b.value/max)*130):minVisible;
            return(
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:'100%',minWidth:0}}>
                <div style={{width:'100%',maxWidth:72,height:(mounted?h:0)+'px',background:b.color||'var(--primary)',borderRadius:'6px 6px 0 0',transition:'height .7s cubic-bezier(0.16,1,0.3,1) '+(i*150)+'ms'}}/>
              </div>);
          })}
        </div>
        {/* Value labels row — below bars, clear of overlap */}
        <div style={{display:'flex',gap:16,marginTop:8}}>
          {block.bars.map((b,i)=>(
            <div key={i} style={{flex:1,textAlign:'center',minWidth:0}}>
              <div style={{fontSize:11.5,fontWeight:700,color:b.color||'var(--primary)',lineHeight:1.35,wordBreak:'break-word'}}>{b.valueLabel||b.value}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:16,marginTop:12,borderTop:'1px solid var(--outline-variant)',paddingTop:12}}>
          {block.bars.map((b,i)=>(
            <div key={i} style={{flex:1,textAlign:'center',minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--on-surface)'}}>{b.label}</div>
              {b.sublabel&&<div style={{fontSize:11,color:'var(--on-surface-variant)',marginTop:2,lineHeight:1.4}}>{b.sublabel}</div>}
            </div>
          ))}
        </div>
        {block.footer&&<div style={{fontSize:12,color:'var(--on-surface-variant)',marginTop:16,lineHeight:1.55,textAlign:'center',fontStyle:'italic'}}>{block.footer}</div>}
      </div>
    </div>);
}

/* ─── СЛОВАРЬ ПОВЕРХ УРОКА ──────────────────────────────────────────
   Лист, а не переход: уходить с урока за одним словом — значит терять
   место, на котором остановился. Слой поднимается НАД уроком (у урока
   zIndex 130), поэтому 160. Роль диалога, гашение фона и возврат фокуса
   берём у общего помощника core/dialogs.js — второго такого механизма в
   приложении быть не должно. */
function ЛистСловаря({термины,выбран,onClose}){
  const[открыт,setОткрыт]=useState(выбран?выбран.имя:null);
  const узел=useRef(null);
  useEffect(()=>{
    const с=window.YasnaOkna&&window.YasnaOkna.слой;
    if(!с||!узел.current)return;
    return с(узел.current,{наЗакрытие:onClose});
  },[]);
  /* Аппаратная «назад» закрывает ВЕРХНИЙ слой — по договору навигации. Без
     этого перехвата она закрыла бы весь урок, и человек, заглянувший в
     словарь за одним словом, вылетал бы на «Уроки». */
  const закрытьРеф=useRef(onClose);
  закрытьРеф.current=onClose;
  useEffect(()=>{
    const назад=(e)=>{if(e.defaultPrevented)return;e.preventDefault();закрытьРеф.current();};
    window.addEventListener('yasna:назад',назад);
    return()=>window.removeEventListener('yasna:назад',назад);
  },[]);
  const строка=(имя,кратко,подробно,ключ)=>{
    const это=открыт===имя;
    const нутро=(
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:700,color:'var(--on-surface)',lineHeight:1.35}}>{имя}</div>
        <div style={{fontSize:13,color:'var(--on-surface-variant)',lineHeight:1.5,marginTop:3}}>{кратко}</div>
      </div>);
    return(
      <div key={ключ} style={{borderBottom:'1px solid var(--outline-variant)'}}>
        {/* Строка без разбора — не кнопка: нажимать её незачем, а мнимая
            кнопка врёт и пальцу, и чтецу. */}
        {подробно?(
          <button type='button' onClick={()=>setОткрыт(это?null:имя)} aria-expanded={это}
            style={{width:'100%',minHeight:48,display:'flex',alignItems:'flex-start',gap:10,
              padding:'12px 4px',background:'none',border:'none',textAlign:'left',cursor:'pointer',fontFamily:'inherit'}}>
            {нутро}
            <span aria-hidden='true' style={{fontSize:16,color:'var(--on-surface-variant)',flexShrink:0,
              transform:это?'rotate(90deg)':'none',transition:'transform .2s',marginTop:2}}>›</span>
          </button>
        ):(
          <div style={{minHeight:48,display:'flex',padding:'12px 4px'}}>{нутро}</div>
        )}
        {это&&подробно?<div style={{padding:'0 4px 14px',fontSize:13.5,color:'var(--on-surface)',lineHeight:1.65,whiteSpace:'pre-wrap'}}>{подробно}</div>:null}
      </div>);
  };
  return(
    <div ref={узел} style={{position:'fixed',left:0,right:0,bottom:0,top:'8%',zIndex:160,
      background:'var(--surface-container-low)',borderRadius:'28px 28px 0 0',
      display:'flex',flexDirection:'column',boxShadow:'0 -8px 28px rgba(0,0,0,.18)'}}>
      <div style={{padding:'8px 8px 0',flexShrink:0}}>
        <div aria-hidden='true' style={{width:32,height:4,borderRadius:2,background:'var(--outline-variant)',margin:'0 auto 6px'}}/>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 8px 8px'}}>
          <div data-ya-zag style={{flex:1,fontSize:18,fontWeight:700,color:'var(--on-surface)'}}>Словарь</div>
          <button type='button' onClick={onClose} aria-label='Закрыть словарь'
            style={{width:48,height:48,border:'none',background:'none',cursor:'pointer',color:'var(--on-surface)',fontSize:16,flexShrink:0}}>
            <span aria-hidden='true'>✕</span>
          </button>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'0 20px 28px'}}>
        {термины.length?(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,textTransform:'uppercase',
              color:'var(--on-surface-variant)',margin:'8px 0 4px'}}>В этом уроке</div>
            {термины.map((т,i)=>строка(т.имя,т.кратко,т.гл?статьяСловаря(т.гл):null,'т'+i))}
          </div>
        ):null}
        <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,textTransform:'uppercase',
          color:'var(--on-surface-variant)',margin:'8px 0 4px'}}>Круг и его механики</div>
        {(GLOSS||[]).map((г,i)=>строка(г.title,г.what,[г.why,г.how].filter(Boolean).join('\n\n'),'г'+i))}
      </div>
    </div>);
}

/* Подробное объяснение термина берём из общей статьи GLOSS, а не пишем
   второй раз своими словами: разойдутся на первой же правке корпуса. */
function статьяСловаря(ид){
  const г=(GLOSS||[]).find(x=>x.id===ид);
  if(!г)return null;
  return [г.what,г.why].filter(Boolean).join('\n\n');
}

/* ─── МЕНЮ ШАПКИ УРОКА ──────────────────────────────────────────────
   Три действия, которым нет места в шапке шириной с телефон. Попап
   привязан к кнопке, закрывается тапом мимо, Escape и выбором пункта. */
function МенюУрока({пункты}){
  const[открыто,setОткрыто]=useState(false);
  const первый=useRef(null);
  useEffect(()=>{
    if(!открыто)return;
    const кл=(e)=>{if(e.key==='Escape'){e.stopPropagation();setОткрыто(false);}};
    /* «Назад» при открытом меню закрывает меню, а не урок. */
    const назад=(e)=>{if(e.defaultPrevented)return;e.preventDefault();setОткрыто(false);};
    document.addEventListener('keydown',кл,true);
    window.addEventListener('yasna:назад',назад);
    if(первый.current)try{первый.current.focus();}catch(_){}
    return()=>{
      document.removeEventListener('keydown',кл,true);
      window.removeEventListener('yasna:назад',назад);
    };
  },[открыто]);
  return(
    <div style={{position:'relative',flexShrink:0}}>
      <button type='button' onClick={()=>setОткрыто(о=>!о)}
        aria-label='Ещё: словарь, заново, весь текст' aria-haspopup='menu' aria-expanded={открыто}
        style={{width:48,height:48,margin:'-8px 0',padding:0,border:'none',background:'none',
          cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
          color:'var(--on-surface)',fontSize:18,lineHeight:1}}>
        <span aria-hidden='true'>⋮</span>
      </button>
      {открыто&&(
        <React.Fragment>
          {/* Тап мимо меню закрывает его — иначе меню жило бы до
              перезагрузки экрана и перекрывало первый абзац урока. */}
          <div onClick={()=>setОткрыто(false)} aria-hidden='true'
            style={{position:'fixed',inset:0,zIndex:140,background:'transparent'}}/>
          <div role='menu' aria-label='Действия урока'
            style={{position:'absolute',top:44,right:0,zIndex:141,minWidth:200,
              background:'var(--surface-container-high)',border:'1px solid var(--outline-variant)',
              borderRadius:8,padding:'6px 0',boxShadow:'0 6px 20px rgba(0,0,0,.18)'}}>
            {пункты.map((п,i)=>(
              <button key={i} role='menuitem' type='button' ref={i===0?первый:null}
                onClick={()=>{setОткрыто(false);п.делать();}}
                style={{display:'block',width:'100%',minHeight:48,padding:'0 18px',border:'none',
                  background:'none',textAlign:'left',cursor:'pointer',fontFamily:'inherit',
                  fontSize:15,color:'var(--on-surface)'}}>{п.имя}</button>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>);
}

/* Отступ блока от начала ПРОКРУЧИВАЕМОГО СПИСКА, а не от слоя урока.
   offsetTop сам по себе меряется от ближайшего позиционированного предка —
   а это слой урока целиком, вместе с шапкой. Разница ровно в её высоту, и
   на неё промахивались обе стороны: возврат ставил разделитель под шапку,
   за край видимого, а счёт прочитанного считал блоки ниже, чем они есть. */
function верхВПотоке(эл,список){
  return эл.offsetTop-список.offsetTop;
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

  // unlockedGates: количество раскрытых секций. Старт = 1 (первая секция + её gate видны).
  // Позиция сохраняется в yasna_znanie_v1[id].поз: раньше выход на 14% означал
  // «начать заново», и «Продолжить» на «Уроках» было обещанием, а не правдой.
  //
  // ВТОРАЯ ПОЛОВИНА ТОЙ ЖЕ ПРАВДЫ. Ворота возвращались, а прокрутка и ответы —
  // нет: человек после звонка попадал на первый экран урока, шапка обещала
  // «100 %», а под ней стояли чистые радиокнопки. Поэтому в «поз» теперь
  // лежит всё, из чего состоит место в уроке: ворота, зачтённые блоки,
  // ОТВЕТЫ по блокам, прокрутка, номер верхнего блока и докуда дочитано.
  const сохранённая=useMemo(()=>{
    try{
      const з=JSON.parse(localStorage.getItem('yasna_znanie_v1')||'{}');
      const п=(з[lesson.id]||{}).поз;
      if(п&&(п.ворота>1||п.прокрутка>0))return {
        ворота:Math.max(1,п.ворота||1), блоки:new Set(п.блоки||[]),
        ответы:п.ответы||{}, прокрутка:п.прокрутка||0,
        блок:п.блок==null?null:п.блок, прочитано:п.прочитано||0};
    }catch(_){}
    return null;
  },[lesson.id]);
  const[unlockedGates,setUnlockedGates]=useState(()=>сохранённая?сохранённая.ворота:1);
  const[completedBlocks,setCompletedBlocks]=useState(()=>сохранённая?сохранённая.блоки:new Set());
  /* Ответы по номеру блока. Рядом с ответом лежит ТИП блока: уроки правятся,
     и блок №7 завтра может оказаться другим — чужой ответ подставлять нельзя. */
  const[ответы,setОтветы]=useState(()=>сохранённая?сохранённая.ответы:{});
  /* Докуда дочитано — номер последнего блока, показанного целиком. Из него
     считается прогресс (см. ниже), и он же переживает уход с экрана. */
  const[прочитано,setПрочитано]=useState(()=>сохранённая?сохранённая.прочитано:0);
  const местоРеф=useRef({прокрутка:сохранённая?сохранённая.прокрутка:0,блок:сохранённая?сохранённая.блок:null});

  const записатьОтвет=useCallback((i,тип,знач)=>{
    setОтветы(prev=>{
      const след=Object.assign({},prev);
      след[i]={т:тип,з:знач};
      return след;
    });
  },[]);

  /* Один писарь на все части места. Прокрутка приходит из обработчика
     прокрутки (без перерисовки, через ссылку), остальное — из состояния;
     если бы писали в двух местах, одно затирало бы другое. */
  const состояниеРеф=useRef(null);
  состояниеРеф.current={ворота:unlockedGates,блоки:completedBlocks,ответы:ответы,прочитано:прочитано};
  const сохранить=useCallback(()=>{
    const с=состояниеРеф.current; if(!с)return;
    try{
      const з=JSON.parse(localStorage.getItem('yasna_znanie_v1')||'{}');
      з[lesson.id]=Object.assign({},з[lesson.id],{поз:{
        ворота:с.ворота, блоки:[...с.блоки], ответы:с.ответы,
        прокрутка:Math.round(местоРеф.current.прокрутка||0),
        блок:местоРеф.current.блок, прочитано:с.прочитано
      },когда:Date.now()});
      localStorage.setItem('yasna_znanie_v1',JSON.stringify(з));
    }catch(_){}
  },[lesson.id]);
  useEffect(()=>{сохранить();},[unlockedGates,completedBlocks,ответы,прочитано,lesson.id]);

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

  // ПРОГРЕСС — ПО ПРОЧИТАННОМУ, а не по воротам. Ворота давали 100 % в тот
  // миг, когда человек нажимал «Подвести итог»: сам итог, финальный опрос и
  // «куда дальше» были ещё впереди, а шкала уже говорила «всё». И после
  // возврата в урок те же 100 % стояли над пустыми вопросами. Теперь доля —
  // это блоки урока, показанные целиком, из ВСЕХ блоков урока: пока нижние
  // секции не раскрыты и не прочитаны, до сотни не дойти.
  const всегоБлоков=lesson.blocks.length;
  const progress=всегоБлоков>0?Math.min(100,Math.max(0,прочитано/всегоБлоков*100)):100;
  const разделов=Math.max(1,totalGates);
  const раздел=Math.min(разделов,Math.max(1,unlockedGates));

  // «Пройдено» ставится, когда человек ДОШЁЛ до низа раскрытого урока,
  // а не в момент нажатия последних ворот: после них ещё финальный опрос,
  // итоги и «куда дальше» — раньше всё это оставалось непрочитанным,
  // а урок уже значился пройденным.
  const[дочитан,setДочитан]=useState(false);
  useEffect(()=>{
    if(!fullyDone||дочитан)return;
    const узел=scrollRef.current;
    if(!узел)return;
    const проверить=()=>{
      if(узел.scrollTop+узел.clientHeight>=узел.scrollHeight-160)setДочитан(true);
    };
    проверить();
    узел.addEventListener('scroll',проверить,{passive:true});
    return()=>узел.removeEventListener('scroll',проверить);
  },[fullyDone,дочитан]);
  useEffect(()=>{
    if(fullyDone&&дочитан&&onComplete)onComplete(lesson.id);
  },[fullyDone,дочитан]);

  /* Урок — лист поверх Разбора. Раньше это был просто div: TalkBack свайпом
     читал экран ПОД уроком («3D», «Механики», наббар), Tab шесть раз попадал
     на перекрытые кнопки, прежде чем дойти до ✕, а фокус после открытия
     оставался на body. Помощник «слой» (core/dialogs.js) ставит роль диалога,
     гасит соседей через inert (на #root его вешать нельзя — урок живёт
     ВНУТРИ него), уводит фокус в заголовок урока и возвращает его на кнопку,
     которая урок открыла. Escape закрывает урок там же — отдельный слушатель
     отсюда убран, чтобы дорога наружу осталась одна.
     Список зависимостей пуст нарочно: иначе слой переоткрывался бы на каждой
     перерисовке урока и каждый раз уводил фокус в заголовок. Свежий onClose
     держим в ссылке. */
  const слойРеф=useRef(null);
  const закрытьРеф=useRef(onClose);
  закрытьРеф.current=onClose;
  useEffect(()=>{
    const с=window.YasnaOkna&&window.YasnaOkna.слой;
    if(!с||!слойРеф.current)return;
    return с(слойРеф.current,{наЗакрытие:()=>{const f=закрытьРеф.current;if(f)f();}});
  },[]);

  /* ВОЗВРАТ НА СВОЁ МЕСТО. Раньше здесь стояло scrollTop=0 без условий: урок
     всегда открывался с первого экрана, и «Продолжить» с «Уроков» означало
     «начни сначала» — до нужных ворот приходилось листать до десяти экранов.
     Теперь возвращаемся к блоку, на котором ушли, и ставим над ним видимый
     разделитель. Место ищем ПО БЛОКУ, а не по числу пикселей: высота блоков
     зависит от ширины экрана и кегля системного шрифта, и сохранённые
     пиксели после поворота телефона указали бы в другой абзац. */
  const[остановка,setОстановка]=useState(()=>{
    const м=местоРеф.current;
    return (м&&м.блок!=null&&м.блок>0)?м.блок:null;
  });
  const восстановитьРеф=useRef(остановка!=null||(местоРеф.current&&местоРеф.current.прокрутка>0));
  useEffect(()=>{
    const узел=scrollRef.current;
    if(!узел)return;
    if(!восстановитьРеф.current){узел.scrollTop=0;return;}
    восстановитьРеф.current=false;
    const цель=остановка, пикс=местоРеф.current.прокрутка||0;
    /* Три кадра: блоки дорисовываются анимацией появления, и высота
       последнего успевает измениться уже после первого кадра. */
    let кадров=0;
    const ставить=()=>{
      const эл=цель!=null?blockRefs.current[цель]:null;
      /* Целимся в РАЗДЕЛИТЕЛЬ, а не в сам блок: он стоит прямо над блоком, и
         прокрутка к блоку прятала бы его выше края экрана — человек видел бы
         урок, открывшийся с середины, и ни слова о том, почему. */
      const над=(эл&&эл.previousElementSibling&&эл.previousElementSibling.getAttribute('role')==='note')
        ? эл.previousElementSibling : эл;
      узел.scrollTop=над?Math.max(0,верхВПотоке(над,узел)-8):пикс;
      if(++кадров<3)requestAnimationFrame(ставить);
    };
    requestAnimationFrame(ставить);
  },[lesson.id]);

  /* ЧТО ПРОЧИТАНО И ГДЕ МЫ СЕЙЧАС — один обработчик прокрутки на урок.
     Он же убирает разделитель «Вы остановились здесь»: человек тронулся с
     места — напоминание больше не нужно. Первые 900 мс прокрутка наша
     собственная (возврат на место), её не считаем за движение. */
  const пишуРеф=useRef(0);
  const открытоРеф=useRef(Date.now());
  useEffect(()=>{
    const узел=scrollRef.current;
    if(!узел)return;
    let ждём=0;
    const считать=()=>{
      ждём=0;
      const низ=узел.scrollTop+узел.clientHeight;
      let верхний=0, целиком=0;
      for(let i=0;i<blockRefs.current.length;i++){
        const э=blockRefs.current[i];
        if(!э)continue;
        const верх=верхВПотоке(э,узел);
        if(верх<=узел.scrollTop+80)верхний=i;
        if(верх+э.offsetHeight<=низ+16)целиком=i+1;
      }
      местоРеф.current={прокрутка:узел.scrollTop,блок:верхний};
      setПрочитано(п=>Math.max(п,целиком));
      /* Запись раз в 400 мс: писать в localStorage на каждый кадр прокрутки
         значит дёргать диск сотни раз на экран. */
      if(!пишуРеф.current)пишуРеф.current=setTimeout(()=>{пишуРеф.current=0;сохранить();},400);
    };
    const наПрокрутку=()=>{
      if(остановка!=null&&Date.now()-открытоРеф.current>900)setОстановка(null);
      if(!ждём)ждём=requestAnimationFrame(считать);
    };
    считать();
    узел.addEventListener('scroll',наПрокрутку,{passive:true});
    return()=>{
      узел.removeEventListener('scroll',наПрокрутку);
      if(ждём)cancelAnimationFrame(ждём);
      if(пишуРеф.current){clearTimeout(пишуРеф.current);пишуРеф.current=0;}
      сохранить();                 /* уходя с урока — записать место точно */
    };
  },[lesson.id,остановка,unlockedGates]);

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
    /* Заново — значит заново: ответы и место тоже стираем, иначе урок
       начался бы с начала, но с уже отмеченными вопросами. */
    setОтветы({});
    setПрочитано(0);
    setОстановка(null);
    местоРеф.current={прокрутка:0,блок:null};
    if(scrollRef.current)scrollRef.current.scrollTop=0;
  };

  /* ⋮ в шапке урока. Из урока не было дороги ни в Словарь, ни к началу:
     термины объяснялись только по ходу, а «Заново» лежало в самом низу, за
     всем текстом урока. Три пункта — ровно те, что нужны на середине
     занятия. «Текст целиком» снимает постепенное раскрытие: кто ищет
     забытое слово, не обязан проходить ворота заново. */
  const[словарьОткрыт,setСловарьОткрыт]=useState(false);
  const[выбранныйТермин,setВыбранныйТермин]=useState(null);
  useEffect(()=>{
    ОТКРЫТЬ_ТЕРМИН=(т)=>{setВыбранныйТермин(т);setСловарьОткрыт(true);};
    return()=>{ОТКРЫТЬ_ТЕРМИН=null;};
  },[]);
  /* Какие термины урок вводит на самом деле — ищем по его же тексту.
     Список руками пришлось бы держать в каждом из полусотни уроков. */
  const терминыУрока=useMemo(()=>{
    let текст='';
    try{текст=JSON.stringify(lesson.blocks||[]);}catch(_){return[];}
    return ТЕРМИНЫ.filter(т=>new RegExp(т.шаблон,'i').test(текст));
  },[lesson.id]);
  const пунктыМеню=[
    {имя:'Словарь',делать:()=>{setВыбранныйТермин(null);setСловарьОткрыт(true);}},
    {имя:'Заново',делать:()=>{
      const с=window.YasnaOkna&&window.YasnaOkna.спросить;
      /* Стереть ответы — потеря, а не переключение вида: спрашиваем. */
      if(с)с({заголовок:'Начать урок заново?',текст:'Ответы и место, на котором вы остановились, будут стёрты.',
             да:'Начать заново',нет:'Отмена',опасно:true,наДа:repeat});
      else repeat();
    }},
    {имя:'Текст целиком',делать:()=>setUnlockedGates(totalGates+1)}
  ];

  return(
    /* Урок больше не «светлый остров»: фон и все цвета блоков — роли из
       core/tokeny.css, поэтому тема урока совпадает с темой приложения и не
       мигает при открытии. colorScheme здесь инлайном нарочно: правило
       .yl-lightscope{color-scheme:light} в vk-tech-tokens.css принудительно
       светлило элементы формы и полосы прокрутки, а инлайн сильнее его. */
    <div className="yl-lightscope" ref={слойРеф} style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'var(--surface)',zIndex:130,display:'flex',flexDirection:'column',colorScheme:'light dark'}}>
      {/* Sticky header */}
      <div style={{padding:'10px 16px',borderBottom:'1px solid var(--outline-variant)',flexShrink:0,display:'flex',alignItems:'center',gap:10,background:'var(--surface-container-lowest)',position:'relative',boxShadow:'0 1px 2px rgba(0,0,0,.02)'}}>
        {/* data-ya-zag — по нему помощник «слой» берёт имя урока и ставит
            сюда фокус при открытии: вслух читается ровно то, что видно. */}
        <div data-ya-zag style={{flex:1,minWidth:0}}>
          {/* 10 px капителью — ниже нижней границы читаемости (label-small
              начинается с 11). Строка одна: без ellipsis 11 px переносился
              бы на вторую и растил шапку. */}
          <div style={{fontSize:11,color:'var(--on-surface-variant)',textTransform:'uppercase',letterSpacing:0.6,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lesson.module?'Урок '+lesson.order+' · '+lesson.module:'Урок '+lesson.order}</div>
          <div style={{fontSize:14,fontWeight:600,color:'var(--on-surface)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lesson.title}</div>
        </div>
        {/* Процента на экране нет: продукт нигде не меряет себя долями, и
            «50 %» в шапке урока — единственное место, где он оставался
            (ревью 8.8). Вместо доли — раздел, который человек проверяет
            глазами по воротам; у уроков без ворот в шапке не стоит ничего.
            Цифру прячем от чтеца: её же называет полоса ниже. */}
        {totalGates>0 && <div aria-hidden='true' style={{fontSize:11,color:'var(--on-surface-variant)',fontWeight:600,marginRight:2,whiteSpace:'nowrap'}}>{раздел} / {разделов}</div>}
        <МенюУрока пункты={пунктыМеню}/>
        {/* Один выход из урока: ✕, Esc и аппаратная «назад» зовут один и тот
            же onClose (закрытьУрок в app.js) — разных дорог наружу быть не
            может. Имя кнопке нужно: без него TalkBack читал «крестик». */}
        {/* Палец промахивался: квадрат 32×32 вдвое меньше нормы 48. Рамка
            осталась прежней (внутренний квадрат 32), а нажимается 48 —
            отрицательные поля съедают прирост, поэтому шапка не выросла и
            крестик стоит там же. */}
        <button onClick={onClose} aria-label='Закрыть урок' style={{width:48,height:48,margin:'-8px -8px -8px 0',padding:0,border:'none',background:'none',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span aria-hidden='true' style={{width:32,height:32,borderRadius:8,border:'1px solid var(--outline-variant)',background:'var(--surface-container-lowest)',color:'var(--on-surface)',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</span>
        </button>
        {/* Полоса была просто двумя div: чтец о продвижении по уроку не
            говорил вовсе. Теперь это прогресс с долей и словами. */}
        <div role='progressbar' aria-label='Прогресс урока'
             aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}
             aria-valuetext={totalGates>0?('раздел '+раздел+' из '+разделов):undefined}
             style={{position:'absolute',left:0,bottom:-1,height:3,width:'100%',background:'var(--surface-container-high)'}}>
          <div style={{height:'100%',width:progress+'%',background:'var(--primary)',transition:'width .35s ease'}}/>
        </div>
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',background:'var(--surface)'}}>
        {visibleBlocks.map((block,i)=>{
          const setRef=(el)=>{blockRefs.current[i]=el;};
          const animClass=i>=(gateIndices[unlockedGates-2]!=null?gateIndices[unlockedGates-2]+1:0)?'scroll-lesson-block-appear':'';
          /* Разделитель «Вы остановились здесь» — только при возврате и
             только над тем блоком, на котором ушли: без него человек не
             понимает, почему урок открылся с середины. Уходит с первой
             прокруткой (см. обработчик выше). */
          const wrap=(content)=>(
            <React.Fragment key={i}>
              {остановка===i?(
                <div role='note' style={{display:'flex',alignItems:'center',gap:10,maxWidth:680,margin:'8px auto 0',padding:'0 24px'}}>
                  <div aria-hidden='true' style={{flex:1,height:1,background:'var(--primary)',opacity:.35}}/>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--primary)',whiteSpace:'nowrap'}}>Вы остановились здесь</div>
                  <div aria-hidden='true' style={{flex:1,height:1,background:'var(--primary)',opacity:.35}}/>
                </div>
              ):null}
              <div ref={setRef} className={animClass}>{content}</div>
            </React.Fragment>
          );
          /* Ответ подставляем только если на этом номере стоит блок того же
             типа: уроки правятся, и вчерашний ответ чужого блока показал бы
             галочки не там, где человек их ставил. */
          const прошлый=(ответы[i]&&ответы[i].т===block.type)?ответы[i].з:null;
          const записать=(з)=>записатьОтвет(i,block.type,з);
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
            case 'checkbox-quiz': return wrap(<CheckboxQuizBlock block={block} blockId={'b'+i} onComplete={()=>markBlockComplete(i)} начало={прошлый} наОтвет={записать}/>);
            case 'pillars-picker': return wrap(<PillarsPickerBlock block={block} onComplete={()=>markBlockComplete(i)} начало={прошлый} наОтвет={записать}/>);
            case 'scenario': return wrap(<ScenarioBlock block={block}/>);
            case 'yasna-star': return wrap(<YasnaStarBlock block={block}/>);
            case 'reflection': return wrap(<ReflectionBlock block={block} lessonId={lesson.id}/>);
            case 'final-quiz-inline': return wrap(<FinalQuizInlineBlock block={block} onComplete={()=>markBlockComplete(i)} начало={прошлый} наОтвет={записать}/>);
            case 'sunrise-animation': return wrap(<InlineSunriseBlock block={block}/>);
            case 'sun-path': return wrap(<SunPathBlock block={block}/>);
            case 'water-cycle-animation': return wrap(<InlineWaterCycleBlock block={block}/>);
            case 'three-shelves': return wrap(<InlineThreeShelvesBlock block={block} onComplete={()=>markBlockComplete(i)} начало={прошлый} наОтвет={записать}/>);
            case 'carousel': return wrap(<InlineCarouselBlock block={block}/>);
            case 'bar-chart': return wrap(<InlineBarChartBlock block={block}/>);
            /* Видео и звук: вводный урок управления может быть записью. */
            case 'video': return wrap(<VideoBlock block={block}/>);
            case 'audio': return wrap(<AudioBlock block={block}/>);
            case 'summary-block': return wrap(<SummaryBlockInline block={block}/>);
            case 'next-steps-block': return wrap(<NextStepsBlockInline block={block} lesson={lesson} onClose={onClose} onPickAnother={onPickAnother} onRepeat={repeat} onOpenLesson={onOpenLesson}/>);
            default: return wrap(<div style={{padding:20,color:'var(--on-surface-variant)',textAlign:'center'}}>Блок '{block.type}' не реализован</div>);
          }
        })}
        {/* bottom padding */}
        <div style={{height:40}}/>
      </div>
      {словарьОткрыт&&(
        <ЛистСловаря термины={терминыУрока} выбран={выбранныйТермин}
          onClose={()=>{setСловарьОткрыт(false);setВыбранныйТермин(null);}}/>
      )}
    </div>);
}

// Main Lesson component — all lessons use scroll format
function Lesson({lessonId,onClose,onComplete,onPickAnother,onOpenLesson}){
  // ВАЖНО: в esbuild-бандле каждый файл обёрнут в IIFE, поэтому голый
  // LESSONS из lessons-index.js здесь НЕ виден (в babel-standalone «протекал»).
  // Берём список из window.YasnaLessons.lessons — он populated к моменту рендера.
  const ALL=(window.YasnaLessons&&window.YasnaLessons.lessons)||[];
  const lesson=ALL.find(l=>l.id===lessonId);
  /* Урока нет — говорим прямо. Раньше стояло ||ALL[0]: битая ссылка молча
     открывала «Что такое Ясна?», и человек не понимал, куда попал. */
  if(!lesson)return(
    <div style={{position:'fixed',inset:0,zIndex:150,background:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{maxWidth:420,textAlign:'center'}}>
        <div style={{fontSize:20,fontWeight:700,color:'var(--on-surface)',marginBottom:10}}>Этот урок ещё не написан</div>
        <div style={{fontSize:14,color:'var(--on-surface)',lineHeight:1.6,marginBottom:22}}>Ссылка ведёт на занятие, которого в приложении пока нет.</div>
        <button onClick={onPickAnother||onClose} style={{fontSize:15,fontWeight:600,padding:'13px 26px',borderRadius:12,border:'none',background:'var(--primary)',color:'var(--on-primary)',cursor:'pointer',fontFamily:'inherit'}}>← К «Урокам»</button>
      </div>
    </div>);
  return<ScrollLesson key={lesson.id} lesson={lesson} onClose={onClose} onComplete={onComplete} onPickAnother={onPickAnother} onOpenLesson={onOpenLesson}/>;
}


/* ── Ленивая загрузка текстов уроков ───────────────────────────────
   Движок едет в основном бандле, а сами уроки — в dist/uroki.min.js.
   Причина простая: уроков теперь по серии на каждое явление, и держать
   их в app.min.js значит платить их весом при каждом открытии
   конструктора, даже если человек пришёл разложить круг.

   загрузить() возвращает обещание и зовётся столько раз, сколько нужно:
   файл подтягивается один раз. Версия ?v= проставляется сборкой
   (window.__yasnaУрокиВерсия), иначе браузер отдавал бы старый файл. */
window.YasnaLessons.загружены = function(){
  var л = window.YasnaLessons.lessons;
  return !!(л && л.length);
};
window.YasnaLessons.загрузить = (function(){
  var обещание = null;
  return function(){
    if (window.YasnaLessons.загружены()) return Promise.resolve(true);
    if (обещание) return обещание;
    обещание = new Promise(function(готово){
      var v = window.__yasnaУрокиВерсия || '';
      var s = document.createElement('script');
      /* Адрес считаем от страницы: конструктор лежит и в docs/, и в
         app/www/ — относительный путь верен в обоих случаях. */
      s.src = 'dist/uroki.min.js' + (v ? '?v=' + v : '');
      s.async = true;
      s.onload = function(){ готово(true); };
      s.onerror = function(){ обещание = null; готово(false); };
      document.head.appendChild(s);
    });
    return обещание;
  };
})();

// Expose engine pieces
Object.assign(window.YasnaLessons, {
  Lesson,
  renderRichText, LessonStar
});
