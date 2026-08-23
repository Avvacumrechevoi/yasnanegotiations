// ═══════════════════════════════════════════════════════════════════
// КАРТОЧКА МЕСТА — досье полки, а не подпись к ней.
//
// ЧТО ИЗМЕНИЛОСЬ И ПОЧЕМУ. Прежняя карточка повторяла то, что и так
// нарисовано на круге: три строки «← 2», «→ 4», «↔ 9» с номерами
// соседей. Номера видны на схеме, читать их второй раз незачем, а
// место они занимали всё. Ещё в ней был заголовок «Открыть в Ясне
// „…“ →» — обычный <div> без обработчика: нажать нечего, и вёл он в
// ту же ясну, которая уже открыта.
//
// Теперь карточка отвечает на единственный вопрос, ради которого её
// открывают: ПОЧЕМУ это явление стоит именно здесь и почему так
// называется. Соседи переехали в жест (смахивание по шапке), связь
// «напротив» — в блок словами, а числа остались только в кружке.
//
// Лестница содержимого совпадает с упорами шторки:
//   мини    — имя, паспорт места, суть одной строкой, одно действие;
//   средне  — иллюстрация, «почему здесь», самопроверка;
//   полно   — имя книги, «напротив», цитаты книги, реплики урока,
//             то же место в других яснах.
// Блок без источника не рисуется вовсе — ни заголовка, ни пустой рамки.
//
// Зависимости: window.YasnaData, window.YasnaDosye, window.YasnaShtorka.
// Экспорт: window.Info.
// ═══════════════════════════════════════════════════════════════════

(function(){

const { useState, useMemo, useEffect, useRef } = React;
const {
  CR, PR, REF, T,
  POS_DESC, CROSS_CTX, PRANA_CTX, OPP_DESC,
  gc, gp, opp
} = window.YasnaData;

/* ─── Мелкие части ──────────────────────────────────────────────── */

const Клеймо=({children})=><div className="dos-kleymo">{children}</div>;

const Цитата=({t,s,урок})=>(
  <blockquote className={'dos-citata'+(урок?' dos-citata--urok':'')}>
    <p>{t}</p>
    <cite>{s}{урок?<span className="dos-asr"> · расшифровка урока</span>:null}</cite>
  </blockquote>
);

/* Сцена суток: горизонт и солнце ровно в том положении, которое
   описывает это место. Рисуется из индекса — ни файлов, ни сети. */
const СЦЕНЫ=[
  {неб:['#070b1e','#131a3c'],звёзды:true},
  {неб:['#0a1030','#2a2350'],звёзды:true,заря:{x:64,сила:.45}},
  {неб:['#131a3c','#8a4a58'],заря:{x:72,сила:.9}},
  {неб:['#2a2140','#e0733a'],солнце:{x:72,y:92},заря:{x:72,сила:1}},
  {неб:['#3a3560','#f0a050'],солнце:{x:108,y:64}},
  {неб:['#4a5a90','#f7c46a'],солнце:{x:142,y:42}},
  {неб:['#5a9ad8','#cfe8ff'],солнце:{x:180,y:30}},
  {неб:['#5f92cc','#f6d08a'],солнце:{x:218,y:42}},
  {неб:['#4a4a80','#f0955a'],солнце:{x:252,y:64}},
  {неб:['#2a2140','#e05a3a'],солнце:{x:288,y:92},заря:{x:288,сила:1}},
  {неб:['#141a3c','#6a3a5e'],заря:{x:288,сила:.8}},
  {неб:['#0a1030','#2a2350'],звёзды:true,заря:{x:288,сила:.4}},
];
const ЗВЁЗДЫ=[[24,22],[58,38],[96,18],[132,44],[168,26],[204,40],[238,20],[276,36],[312,24],[336,46],[46,58],[300,58]];

function СценаСуток({i}){
  const с=СЦЕНЫ[i]||СЦЕНЫ[0];
  const gid='sky'+i;
  return (
    <svg className="dos-scena" viewBox="0 0 360 132" preserveAspectRatio="none" role="img"
         aria-label={'Схема неба для места '+i}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={с.неб[0]}/>
          <stop offset="1" stopColor={с.неб[1]}/>
        </linearGradient>
        {с.заря&&<radialGradient id={gid+'z'} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd08a" stopOpacity={с.заря.сила}/>
          <stop offset="1" stopColor="#ffd08a" stopOpacity="0"/>
        </radialGradient>}
      </defs>
      <rect x="0" y="0" width="360" height="132" fill={'url(#'+gid+')'}/>
      {с.звёзды&&ЗВЁЗДЫ.map((з,k)=><circle key={k} cx={з[0]} cy={з[1]} r={k%3?1:1.6} fill="#fff" opacity={k%3?.5:.8}/>)}
      {с.заря&&<ellipse cx={с.заря.x} cy="92" rx="78" ry="46" fill={'url(#'+gid+'z)'}/>}
      {с.солнце&&<circle cx={с.солнце.x} cy={с.солнце.y} r="14" fill="#ffd66b" stroke="#fff3c4" strokeWidth="2"/>}
      <rect x="0" y="92" width="360" height="40" fill="#1a1c22"/>
      <rect x="0" y="91" width="360" height="2" fill="#3c4049"/>
      <text x="12" y="114" fill="#9aa0aa" fontSize="12">восток</text>
      <text x="348" y="114" fill="#9aa0aa" fontSize="12" textAnchor="end">запад</text>
    </svg>
  );
}

/* Мини-круг: та же схема, но карманная — чтобы на полном экране,
   когда звезда скрыта шторкой, место не терялось из виду. */
function МиниКруг({i,p,cr,pr}){
  const R=48,cx=60,cy=60;
  const точка=(j)=>{const a=(270-j*30)*Math.PI/180;return{x:cx+R*Math.cos(a),y:cy-R*Math.sin(a)};};
  const тр=pr.p.map(точка);
  const о=точка(opp(i)),м=точка(i);
  return (
    <svg className="dos-krug" viewBox="0 0 120 120" role="img" aria-label={'Место '+i+' на круге'}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeWidth="1"/>
      <polygon points={тр.map(t=>t.x+','+t.y).join(' ')} fill={pr.c+'14'} stroke={pr.c+'55'} strokeWidth="1"/>
      <line x1={м.x} y1={м.y} x2={о.x} y2={о.y} stroke="var(--txt3)" strokeWidth="1" strokeDasharray="3 3"/>
      {Array.from({length:12},(_,j)=>{
        const т=точка(j);
        if(j===i) return <circle key={j} cx={т.x} cy={т.y} r="7" fill={cr.c}/>;
        if(j===opp(i)) return <circle key={j} cx={т.x} cy={т.y} r="5" fill="none" stroke="var(--txt2)" strokeWidth="1.5"/>;
        return <circle key={j} cx={т.x} cy={т.y} r="3" fill="var(--border)"/>;
      })}
      <text x={cx} y={cy+5} textAnchor="middle" fontSize="15" fontWeight="700" fill={cr.c}>{i}</text>
    </svg>
  );
}

/* ─── Самопроверка: один вопрос, собранный из устройства круга ──── */
function собратьВопрос(n,i,p,cr,pr,суточная){
  const label=p[i]||('место '+i);
  const oppLabel=p[opp(i)]||'';
  /* Ложные варианты берём с РАЗНЫХ сторон круга, а не первые попавшиеся:
     раньше .slice(0,2) всегда давал места 0 и 1, и вопрос запоминался
     не смыслом, а видом. */
  const свободные=[2,4,8,10,3,9,5,7,1,11]
    .map(ш=>(i+ш)%12)
    .filter(j=>j!==i&&j!==opp(i)&&p[j])
    .map(j=>p[j])
    .filter((т,k,м)=>м.indexOf(т)===k);
  const варианты=(верный,прочие)=>{
    const все=[верный].concat(прочие.slice(0,2));
    /* Перемешивание, зависящее только от i — ответ не «прыгает» при перерисовке */
    return все.map((т,k)=>({т,верно:k===0})).sort((a,b)=>((i*7+a.т.length)%5)-((i*7+b.т.length)%5));
  };
  if(n===0&&oppLabel&&свободные.length>=2){
    return {
      в:'Что стоит напротив места «'+label+'»?',
      о:варианты(oppLabel,свободные),
      р:'Полное противостояние идёт через центр круга: место отличается на шесть — '+i+' и '+opp(i)+'. '+(OPP_DESC[i<6?i:i-6]||''),
      и:суточная?'Ясна Суток, с. 28':null
    };
  }
  if(n===1){
    const долгое=i%2===0;
    return {
      в:'«'+label+'» — долгое время или короткий перелом?',
      о:[{т:'Долгое: обстановка меняется медленно',верно:долгое},
         {т:'Короткое: перелом, всё меняется быстро',верно:!долгое}],
      р:'Все чётные места круга — долгие, все нечётные — короткие переломные. Место '+i+' '+(долгое?'чётное':'нечётное')+'.',
      и:суточная?'Ясна Суток, с. 50':null
    };
  }
  /* Ложные варианты берём по КЛЮЧУ праны, а не по подписи: подписи в разных
     местах кода писались то «ШЭ», то «ШЕ», и правильный ответ попадал в список
     ложных вторым экземпляром — на местах 0, 4 и 8 человек видел «Земля ШЭ» и
     «Земля ШЕ» одновременно. */
  const свой=gp(i);
  const прочие=['she','fo','tsi','ha'].filter(k=>k!==свой).slice(0,2).map(k=>({т:PR[k].n,верно:false}));
  return {
    в:'Какая стихия у места «'+label+'»?',
    о:[{т:pr.n,верно:true}].concat(прочие)
        .sort((a,b)=>((i*5+a.т.length)%4)-((i*5+b.т.length)%4)),
    р:PRANA_CTX[свой],
    /* Страницу не ставим: этот разбор сшит из трёх разных мест книги
       (с. 64–65 — звук, с. 68 — свойство, с. 84 — треугольник). */
    и:null
  };
}

function Самопроверка({i,p,cr,pr,суточная}){
  const[открыт,setОткрыт]=useState(false);
  const[n,setN]=useState(i%3);
  useEffect(()=>{setN(i%3);},[i]);
  const[ответ,setОтвет]=useState(null);
  const в=useMemo(()=>собратьВопрос(n,i,p,cr,pr,суточная),[n,i,p,cr,pr,суточная]);
  useEffect(()=>{setОтвет(null);},[i,n]);
  if(!открыт) return (
    <button type="button" className="dos-knopka dos-knopka--tihaya" onClick={()=>setОткрыт(true)}>
      Проверить себя · 1 вопрос
    </button>
  );
  return (
    <section className="dos-blok dos-vopros">
      <Клеймо>Проверь себя</Клеймо>
      <p className="dos-vopros-t">{в.в}</p>
      <div className="dos-otvety">
        {в.о.map((о,k)=>(
          <button key={k} type="button"
            className={'dos-otvet'+(ответ===null?'':о.верно?' dos-otvet--verno':(ответ===k?' dos-otvet--mimo':''))}
            onClick={()=>ответ===null&&setОтвет(k)}>{о.т}</button>
        ))}
      </div>
      {ответ!==null&&<div className="dos-razbor">
        <p>{в.о[ответ]&&в.о[ответ].верно?'Верно. ':'Не так. '}{в.р}</p>
        {в.и&&<cite>{в.и}</cite>}
        <button type="button" className="dos-knopka dos-knopka--tihaya" onClick={()=>setN(k=>(k+1)%3)}>Ещё вопрос</button>
      </div>}
    </section>
  );
}

/* ─── Карточка ──────────────────────────────────────────────────── */

function Info({i,p,af=[],y={},overlay=null,onEdit,onClose,onSel,onLesson,onTour,onYasna,откуда}){
  if(i===null)return null;
  const cr=CR[gc(i)],pr=PR[gp(i)],ref=REF[i],label=p[i]||'',oppLabel=p[opp(i)]||'';
  const isLong=i%2===0;
  const oppPairIdx=i<6?i:i-6;
  const isEmpty=!label;
  const overlayLabel=overlay&&overlay.p?(overlay.p[i]||''):'';
  const дос=(window.YasnaDosye&&window.YasnaDosye.место)?window.YasnaDosye.место(y,i):null;
  const суточная=!!дос;

  /* ── Механики: показываем только то, что человек сам включил ── */
  const mechItems=[];
  af.forEach(fid=>{
    if(['support','right','left'].includes(fid)){
      if(CR[fid].p.includes(i)) mechItems.push({c:CR[fid].c,title:CR[fid].n+' · '+CR[fid].v,text:CROSS_CTX[fid][i]});
      else mechItems.push({c:'var(--txt3)',title:CR[fid].n,text:'Это место в крест не входит — в нём стоят '+CR[fid].p.join(', ')+'.',dim:true});
    }
    if(['she','fo','tsi','ha'].includes(fid)){
      if(PR[fid].p.includes(i)) mechItems.push({c:PR[fid].c,title:PR[fid].n,text:PRANA_CTX[fid]});
      else mechItems.push({c:'var(--txt3)',title:PR[fid].n,text:'Это место в треугольник не входит — в нём стоят '+PR[fid].p.join(', ')+'.',dim:true});
    }
    /* Механику «противоположности» в список не кладём: постоянный блок
       «Напротив» и так стоит ниже, и текст выходил дважды на одном экране. */
    if(fid==='rhythm'){
      const triples=[[2,3,4],[5,6,7],[8,9,10],[11,0,1]];
      const tri=triples.find(t=>t.includes(i));
      if(tri){
        const myK=tri.indexOf(i);
        const roles=[{r:'Вера',l:'подготовка',c:'#5B9CF6'},{r:'Бой',l:'событие',c:'#E8364F'},{r:'Победа',l:'итог',c:'#E8A834'}];
        const role=roles[myK];
        const triNames=['I','II','III','IV'];
        const steps=tri.map((j,k)=>({idx:j,role:roles[k],name:p[j]||'',active:k===myK}));
        mechItems.push({c:'#30A060',title:'Ритм · Тройка '+triNames[triples.indexOf(tri)]+' · '+role.r,steps});
      }
    }
    if(fid==='arcs'){
      const arcs=[[1,2,3,4,5],[5,6,7,8,9],[9,10,11,0,1]];
      const arcNames=['Дуга I (утренняя)','Дуга II (дневная)','Дуга III (ночная)'];
      const arcRoles=[{r:'ФО',l:'исток',c:'#4090D8'},{r:'ЦИ',l:'нагрев',c:'#70B8F0'},{r:'ХА',l:'пик',c:'#F06838'},{r:'ШЭ',l:'остыв.',c:'#C0943A'},{r:'ФО',l:'конец',c:'#4090D8'}];
      arcs.forEach((arc,ai)=>{
        if(arc.includes(i)){
          const myK=arc.indexOf(i);
          const steps=arc.map((j,k)=>({idx:j,role:arcRoles[k],name:p[j]||'',active:k===myK}));
          mechItems.push({c:['#4090D8','#9060D0','#30A060'][ai],title:arcNames[ai]+' · '+arcRoles[myK].r+' ('+arcRoles[myK].l+')',steps});
        }
      });
    }
    if(fid==='halves'){
      const isLight=[4,5,6,7,8].includes(i);
      const isDark=[10,11,0,1,2].includes(i);
      const isLeft=[1,2,3,4,5].includes(i);
      const isRight=[7,8,9,10,11].includes(i);
      mechItems.push({c:isLight?'#C0A030':isDark?'#5868B8':'var(--txt3)',
        title:isLight?'Чаша Света (верх)':isDark?'Чаша Тьмы (низ)':'Горизонт',
        text:isLight?'Явное, открытое, активное.':isDark?'Скрытое, закрытое, спокойное.':'Соединяет чаши. Точка борьбы и перехода.'});
      mechItems.push({c:isLeft?'#28A060':isRight?'#A046A0':'var(--txt3)',
        title:isLeft?'Левая половина (нарастание)':isRight?'Правая половина (спад)':'Ось Единства',
        text:isLeft?'Свет прибывает.':isRight?'Свет убывает.':'Вертикальная ось. Полюс '+(i===0?'тьмы':'света')+'.'});
    }
    if(fid==='error89'){
      const isMain=[8,9].includes(i);
      const isMirror=[2,3].includes(i);
      const opErrors={0:'Ошибка во сне: решение приходит во сне, но ты не уверен, было ли оно.',3:'Просмотрел: на востоке кажется, что всё точно, но деталь можно не заметить.',6:'Мираж: на вершине иллюзия полноты, а мир сложнее.',9:'Ошибка измерения: на западе мир показывает не то, что есть.'};
      if(isMain) mechItems.push({c:'#D946EF',title:'Зона ошибки 8 и 9',text:'Здесь путают соседние места: «'+(p[8]||'8')+'» выглядит как «'+(p[9]||'9')+'». В языке та же путаница: ДЕВять — ДЕВА, ВОСемь — ВЕСы.'});
      else if(isMirror) mechItems.push({c:'#D946EF',title:'Зеркало ошибки 2 и 3',text:'Если путаются 8 и 9, то и 2 с 3 тоже: «'+(p[2]||'2')+'» может содержать свойства «'+(p[3]||'3')+'».'});
      else if([0,6].includes(i)) mechItems.push({c:'#D946EF',title:'Ошибка Опорного креста',text:opErrors[i]});
    }
  });
  const activeMech=mechItems.filter(it=>!it.dim);
  const dimMech=mechItems.filter(it=>it.dim);

  /* ── Шторка ───────────────────────────────────────────────────── */
  const корень=useRef(null);
  const шт=useRef(null);
  const соседПоЖесту=useRef(null);
  соседПоЖесту.current=(шаг)=>{ if(onSel) onSel((i+(шаг>0?1:-1)+12)%12); };

  useEffect(()=>{
    if(!корень.current||!window.YasnaShtorka)return;
    const узел=корень.current.closest('aside.side-panel')||корень.current;
    /* Возврат из урока: человек ушёл с раскрытой карточки и с середины
       текста — возвращаем и ступень, и прокрутку. Метку кладёт app.js
       ровно на один разворот и мы её тут же съедаем. */
    const возврат=window.__yasnaВозврат; window.__yasnaВозврат=null;
    шт.current=window.YasnaShtorka.создать(узел,{
      старт:(возврат&&возврат.упор)||'мини',
      наУпор:(имя)=>{ if(имя!=='закрыто') window.__yasnaУпор=имя; },
      наЗакрытие:()=>{ if(onClose) onClose(); },
      наСоседа:(шаг)=>{ if(соседПоЖесту.current) соседПоЖесту.current(шаг); }
    });
    if(возврат&&возврат.скролл){
      setTimeout(()=>{
        const т=корень.current&&корень.current.querySelector('.sht-telo');
        if(т) т.scrollTop=возврат.скролл;
      },40);
    }
    return()=>{ if(шт.current){шт.current.снять();шт.current=null;} };
  },[]);

  const закрыть=()=>{ if(шт.current) шт.current.закрыть(); else if(onClose) onClose(); };

  /* Сменилось место или ясна — читаем сначала: содержимое другое, а
     прокрутка иначе осталась бы посреди чужого текста. Если карточка в этот
     миг уезжала вниз (человек закрыл её и тут же ткнул в другое место круга),
     возвращаем её на мини: иначе он выбрал место, а карточки не видно. */
  useEffect(()=>{
    const т=корень.current&&корень.current.querySelector('.sht-telo');
    if(т) т.scrollTop=0;
    if(шт.current&&шт.current.упор()==='закрыто') шт.current.кУпору('мини');
    /* Паспорт места на узком экране бывает в две строки: без пересчёта низ
       карточки гулял на 16px, и последняя строка уезжала под маску. */
    else if(шт.current) шт.current.пересчитать();
  },[i,y.name]);

  /* ── Первичное действие: первое подходящее, дальше не идём ────── */
  const урок=useMemo(()=>{
    const L=(window.YasnaLessons&&window.YasnaLessons.LESSONS)||[];
    if(!суточная) return null;
    const карта={0:'l2_night_foundation',1:'l3_morning',2:'l3_morning',3:'l3_morning'};
    const id=карта[i];
    if(!id) return null;
    const l=L.find(x=>x.id===id);
    return l?{id:l.id,t:l.title}:null;
  },[i,суточная]);
  const естьТур=!!(window.YasnaTours&&window.YasnaTours.has&&window.YasnaTours.has(y.name));

  let действие=null;
  if(isEmpty&&onEdit) действие={т:'Заполнить место '+i,на:()=>onEdit(i)};
  else if(урок&&onLesson) действие={т:'Урок · '+урок.t,на:()=>onLesson(урок.id)};
  else if(естьТур&&onTour) действие={т:'Пройти ясну по кругу',на:()=>onTour()};

  /* ── То же место в других яснах ───────────────────────────────── */
  const другие=useMemo(()=>{
    const своё=(y.name||'').replace(/\s*\(моя\)\s*$/,'').trim();
    const назад=откуда&&откуда.n;
    return (T||[]).filter(t=>t.rubrik&&t.p&&t.p[i]&&t.n!==своё&&t.n!==назад);
  },[i,y.name,откуда]);

  const паспорт=[isLong?'долгое':'короткое',pr.n,(ref.f||'').toLowerCase()].filter(Boolean).join(' · ');
  /* Для ясн без досье суть — первая фраза описания, а «почему здесь» —
     всё остальное: иначе одна и та же строка повторялась через полэкрана. */
  const описание=POS_DESC[i]||'';
  const точка=описание.indexOf('. ');
  const суть=дос?дос.sut:(точка>0?описание.slice(0,точка+1):описание);
  const почему=дос?дос.pochemu:(точка>0?описание.slice(точка+2):описание);

  return(
    <div className="sht-korpus" ref={корень}>
      <i className="sht-mera" aria-hidden="true"/>
      <div className="sht-ruchka" data-tyaga>
        <button type="button" className="sht-ruchka-knopka" aria-label="Развернуть или свернуть карточку"><span className="sht-bar"/></button>
      </div>

      <header className="sht-shapka" data-tyaga>
        <button type="button" className="sht-zakryt" onClick={закрыть} aria-label="Закрыть карточку" title="Закрыть">×</button>
        <div className="sht-ryad">
          {/* Обводка цветом креста, цифра — обычным текстом: цветом креста
              она давала 2.1–4.1:1 на белом, а это самый заметный знак шапки. */}
          <div className="sht-nomer" style={{borderColor:cr.c}}>{i}</div>
          <div className="sht-imena">
            <div className="sht-yasna">{y.name||''}</div>
            <h2 className="sht-imya">{label||<span className="sht-pusto">Место не заполнено</span>}</h2>
            <div className="sht-pasport">{паспорт}</div>
          </div>
        </div>
      </header>

      <div className="sht-telo">
        <p className="dos-sut">{суть}</p>

        {действие&&<button type="button" className="dos-knopka dos-knopka--glavnaya" onClick={действие.на}>{действие.т}</button>}
        {/* Метка нижнего края мини-упора: по ней шторка меряет, какой высоты
            хватит, чтобы поместились суть и одно действие. Раньше упор считался
            долей экрана, и на 360×800 кнопка уходила под наббар. */}
        <i className="sht-mini-kraj" aria-hidden="true"/>

        <section className="dos-blok">
          <Клеймо>Почему здесь</Клеймо>
          <p>{почему}</p>
        </section>

        <figure className="dos-risunok">
          {суточная?<СценаСуток i={i}/>:<МиниКруг i={i} p={p} cr={cr} pr={pr}/>}
          <figcaption>{суточная
            ?'Небо в это время. Восток слева, запад справа — как на чертеже книги.'
            :'Место '+i+' на круге: пунктир — то, что напротив, треугольник — своя стихия.'}</figcaption>
        </figure>

        {activeMech.length>0&&<section className="dos-blok">
          <Клеймо>Включённые механики</Клеймо>
          {activeMech.map((it,j)=><div key={j} className="dos-meh" style={{borderColor:it.c}}>
            <div className="dos-meh-t" style={{color:it.c}}>{it.title}</div>
            {it.steps
              ?<div className="dos-shagi">{it.steps.map((s,k)=><div key={k} className={'dos-shag'+(s.active?' dos-shag--tut':'')}>
                  <span className="dos-rol" style={{color:s.role.c,background:s.role.c+'18'}}>{s.role.r}</span>
                  <span className="dos-shag-imya">{s.name||'—'}</span>
                  <span className="dos-shag-rol">{s.role.l}</span>
                </div>)}</div>
              :<p>{it.text}</p>}
          </div>)}
          {dimMech.length>0&&<p className="dos-tihoe">Не входит: {dimMech.map(it=>it.title).join(' · ')}</p>}
        </section>}

        <Самопроверка i={i} p={p} cr={cr} pr={pr} суточная={суточная}/>

        {дос&&дос.kn&&дос.kn!==label&&<section className="dos-blok">
          <Клеймо>Как называется</Клеймо>
          <p>{label
            ?<>В приложении это место подписано «{label}». В книге у него имя «{дос.kn}».</>
            :<>Место не заполнено. В книге здесь стоит «{дос.kn}».</>}</p>
          <Цитата t={window.YasnaDosye.именаКниги.t} s={window.YasnaDosye.именаКниги.s}/>
        </section>}

        <section className="dos-blok">
          <Клеймо>Напротив</Клеймо>
          <p>{OPP_DESC[oppPairIdx]}</p>
          {oppLabel&&<button type="button" className="dos-knopka dos-knopka--tihaya" onClick={()=>onSel&&onSel(opp(i))}>
            Перейти к «{oppLabel}» →
          </button>}
        </section>

        {overlay&&overlayLabel&&<section className="dos-blok">
          <Клеймо>Наложение · {overlay.name||overlay.n||'вторая ясна'}</Клеймо>
          <p>На этом же месте: <b>{overlayLabel}</b></p>
        </section>}

        {дос&&дос.cit&&дос.cit.length>0&&<section className="dos-blok">
          <Клеймо>Из книги</Клеймо>
          {дос.cit.map((ц,k)=><Цитата key={k} t={ц.t} s={ц.s}/>)}
        </section>}

        {дос&&дос.urok&&дос.urok.length>0&&<section className="dos-blok">
          <Клеймо>Из урока</Клеймо>
          {дос.urok.map((ц,k)=><Цитата key={k} t={ц.t} s={ц.s} урок/>)}
        </section>}

        {другие.length>0&&<section className="dos-blok">
          <Клеймо>То же место в других яснах</Клеймо>
          <div className="dos-chipy">
            {откуда&&onYasna&&<button type="button" className="dos-chip dos-chip--nazad" onClick={()=>onYasna(откуда)}>
              <span className="dos-chip-y">← вернуться</span>
              <span className="dos-chip-p">{откуда.n} · {(откуда.p&&откуда.p[i])||''}</span>
            </button>}
            {другие.map(t=><button key={t.id||t.n} type="button" className="dos-chip" onClick={()=>onYasna&&onYasna(t)}>
              <span className="dos-chip-y">{t.n}</span>
              <span className="dos-chip-p">{t.p[i]}</span>
            </button>)}
          </div>
        </section>}

        {действие&&<button type="button" className="dos-knopka dos-knopka--glavnaya dos-knopka--niz" onClick={действие.на}>{действие.т}</button>}
        <div className="dos-hvost"/>
      </div>
    </div>);
}

window.Info = Info;

})();
