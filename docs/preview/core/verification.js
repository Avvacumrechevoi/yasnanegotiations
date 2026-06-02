// ═══════════════════════════════════════════════════════════════════
// VERIFICATION — Express + Полная проверка Ясны
// Extracted from core/yasna-star.js (Layer 2 component).
// Зависимости: window.YasnaData (только PR — праны).
// Экспорт: window.Verification.
// ═══════════════════════════════════════════════════════════════════

(function(){

const { useState, useEffect } = React;
const { PR } = window.YasnaData;

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

window.Verification = Verification;

})();
