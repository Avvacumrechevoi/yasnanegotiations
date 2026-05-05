// ═══════════════════════════════════════════════════════════════════
// ONBOARDING — Ясна Атмосферных явлений (preview-only)
// 15-шаговый интерактивный тур по Ясне с анимацией каждой механики.
// Использует window.YasnaCore.Star + Yasna3DView для рендера.
// ═══════════════════════════════════════════════════════════════════

window.YasnaOnboardingAtm = (function(){
  const {useState, useEffect, useRef} = React;
  const {Star, T} = window.YasnaCore;

  // 15 шагов онбординга
  const STEPS = [
    {
      title: '✦ Ясна Атмосферных явлений',
      sub: 'Источник: А.Д. Заморский «Атмосферные явления» (1954)',
      desc: 'Все 11 глав книги ровно ложатся на 12 Полок Ясны: от тихой росы через ливни и грозы к буре, ветру и сиянию. Сейчас покажу каждую механику в действии.',
      af: [], highlight: null, dur: 4500,
    },
    {
      title: '1. Опорный Крест',
      sub: 'Роса · Дождь · Гроза · Буря — 4 архетипа атмосферы',
      desc: 'Это четыре главных категории: статика на земле (Роса), жидкие осадки (Дождь), электричество неба (Гроза), кинетика ветра (Буря).',
      af: ['support'], highlight: [0,3,6,9], dur: 5500,
    },
    {
      title: '2. Крест Управления',
      sub: 'Иней · Снег · Радуга · Смерч — узнаваемые «фигурные» явления',
      desc: 'Каждое имеет свою чёткую эстетику: кристалл-снежинка, луч-радуга, спираль-смерч. Это эстетический крест.',
      af: ['right'], highlight: [1,4,7,10], dur: 5500,
    },
    {
      title: '3. Крест Веры',
      sub: 'Изморозь · Град · Гало · Сияние — преломления и иллюзии',
      desc: 'Подготовительные явления: изморозь готовит лёд, град — водяная агрессия, гало — оптическая иллюзия, сияние — электрическая прелюдия.',
      af: ['left'], highlight: [2,5,8,11], dur: 5500,
    },
    {
      title: '4. Праны (стихии)',
      sub: 'Огонь · Вода · Воздух · Земля',
      desc: 'Огонь (Дождь, Радуга, Сияние) — свет и разряд. Вода (Иней, Град, Буря) — разрушительная сила. Воздух (Изморозь, Гроза, Смерч) — движение. Земля (Роса, Снег, Гало) — оседающее.',
      af: ['ha','fo','tsi','she'], highlight: null, dur: 6500,
    },
    {
      title: '5. Противоположности',
      sub: 'Каждая Полка имеет своё зеркало через диаметр',
      desc: 'Роса ↔ Гроза (микро-тишина ↔ макро-разряд). Дождь ↔ Буря (вертикаль воды ↔ горизонталь ветра). Иней ↔ Радуга (мутный кристалл ↔ прозрачный спектр).',
      af: ['opp'], highlight: null, dur: 6500,
    },
    {
      title: '6. Половины — Чаши Света и Тьмы',
      sub: 'Активное небо vs Тихая земля',
      desc: 'Верх (через 6) — активная атмосфера: Снег → Град → Гроза → Радуга → Гало. Низ (через 0) — тихие отложения: Иней → Роса → Сияние.',
      af: ['halves'], highlight: null, dur: 6000,
    },
    {
      title: '7. Зодиак на Полках',
      sub: '12 знаков как универсальное адресное пространство',
      desc: 'Кардинальные знаки совпадают с опорами: ♑ Козерог = Роса (зимняя точка), ♈ Овен = Дождь (весеннее начало), ♋ Рак = Гроза (пик лета), ♎ Весы = Буря (осенний слом).',
      af: ['mb_zodiac'], highlight: null, dur: 6000,
    },
    {
      title: '8. Скорпион ↔ Паук',
      sub: 'Сам/Идея (верх) — Особа/Тело (низ) — Поле Боя (3↔9)',
      desc: 'Активная погода (что мы видим в небе: Гроза, Радуга, Гало) vs приземные явления (что нас касается: Роса, Иней, Изморозь). Поле Боя 3↔9 = главное противоречие Дождь vs Буря.',
      af: ['mb_scorpio_spider'], highlight: null, dur: 7000,
    },
    {
      title: '9. Замыкание ∞',
      sub: 'Сияние → Роса → Иней — атмосфера всегда возвращается',
      desc: 'Полярное сияние замыкает цикл: после яростной грозы и бури небо успокаивается, излучает в высоте, и снова оседает на землю росой. Атмосфера — вечный круг.',
      af: ['mb_mobius'], highlight: null, dur: 6500,
    },
    {
      title: '10. Накопление → Переход',
      sub: 'Длинные Полки копят, короткие переливают',
      desc: 'Роса копит влагу → Иней замораживает. Дождь копит количество → Снег твердеет. Гроза копит электричество → Радуга разряжает в свет. Буря копит силу ветра → Смерч концентрирует.',
      af: ['mb_accumulation'], highlight: null, dur: 6500,
    },
    {
      title: '11. Ритм Вера → Бой → Победа',
      sub: '4 тройки: подготовка → действие → итог',
      desc: 'Самая красивая тройка: Град (готовит) → Гроза (бьётся) → Радуга (торжествует). Также: Изморозь→Дождь→Снег, Гало→Буря→Смерч, Сияние→Роса→Иней.',
      af: ['rhythm'], highlight: null, dur: 6500,
    },
    {
      title: '12. Ошибка 8↔9',
      sub: 'Зона спутывания иллюзии и реальности',
      desc: '8 (Гало/Мираж) — иллюзия восприятия. 9 (Буря) — реальная разрушительная сила. Их легко перепутать. Зеркальная зона 2↔3: Изморозь (видимость замерзания) vs Дождь (точно жидкое).',
      af: ['error89'], highlight: null, dur: 6500,
    },
    {
      title: '13. Ясна² (144 ячейки)',
      sub: 'Каждая Полка раскрывается во вложенную Ясну',
      desc: 'Роса² — 12 видов росы. Дождь² — 12 видов дождя (морось, ливень, ситный, грибной...). Гроза² — 12 типов грозы. Кликни по любой Полке чтобы открыть её внутреннюю Ясну.',
      af: ['mb_yasna2'], highlight: null, dur: 7000,
    },
    {
      title: '✦ Готово! Ясна построена',
      sub: '14 механик — 14 проверок пройдены',
      desc: 'Ты увидел, как все механики каркаса работают на Ясне Атмосферных явлений. Все опоры, кресты, праны, противоположности, оси и циклы корректны. Можешь продолжать исследовать самостоятельно.',
      af: ['support','right','left','ha','fo','tsi','she','opp','halves','mb_zodiac','mb_scorpio_spider','mb_mobius','mb_accumulation','rhythm','error89','mb_yasna2'],
      highlight: null, dur: 0,
    },
  ];

  function OnboardingAtm({onClose, onLoadAtm}){
    const[stepIdx, setStepIdx] = useState(0);
    const[playing, setPlaying] = useState(true);
    const timerRef = useRef(null);
    const step = STEPS[stepIdx];

    // Загружаем шаблон Атмосферных явлений в локальное состояние
    const atmTpl = T.find(t=>t.id==='atm_yavl');
    const[y] = useState(()=> atmTpl ? {name: atmTpl.n, p: [...atmTpl.p], th: atmTpl.th||'', bh: atmTpl.bh||'', lh: atmTpl.lh||'', rh: atmTpl.rh||''} : null);

    useEffect(()=>{
      if(timerRef.current){ clearTimeout(timerRef.current); timerRef.current=null; }
      if(playing && step.dur > 0 && stepIdx < STEPS.length-1){
        timerRef.current = setTimeout(()=> setStepIdx(i => Math.min(STEPS.length-1, i+1)), step.dur);
      }
      return ()=>{ if(timerRef.current){ clearTimeout(timerRef.current); timerRef.current=null; } };
    }, [stepIdx, playing]);

    if(!y) return null;

    const isLast = stepIdx === STEPS.length-1;
    const progress = ((stepIdx+1) / STEPS.length) * 100;

    return (
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(8,12,28,.96)',zIndex:200,display:'flex',flexDirection:'column',color:'#fff',fontFamily:'inherit'}} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
        {/* Header bar */}
        <div style={{padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid rgba(255,255,255,.1)',flexShrink:0}}>
          <div style={{fontSize:14,fontWeight:600,opacity:.85,letterSpacing:.5}}>ОНБОРДИНГ · Ясна Атмосферных явлений</div>
          <div style={{flex:1,height:4,background:'rgba(255,255,255,.12)',borderRadius:2,overflow:'hidden',maxWidth:400}}>
            <div style={{height:'100%',background:'linear-gradient(90deg,#60a5fa,#a21caf)',width:`${progress}%`,transition:'width .6s ease'}}/>
          </div>
          <div style={{fontSize:12,opacity:.65,fontVariantNumeric:'tabular-nums'}}>{stepIdx+1} / {STEPS.length}</div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',color:'#fff',padding:'6px 12px',borderRadius:8,fontSize:13,cursor:'pointer'}}>✕ Закрыть</button>
        </div>

        {/* Main canvas */}
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',minHeight:0,overflow:'hidden'}}>
          <div style={{width:'100%',maxWidth:720,aspectRatio:'900/700',background:'rgba(255,255,255,.03)',borderRadius:16,border:'1px solid rgba(255,255,255,.08)',overflow:'hidden',transition:'all .6s ease'}}>
            <Star yy={y} sel={null} onSel={()=>{}} hl={step.highlight} af={step.af||[]} showOpp={(step.af||[]).includes('opp')} overlay={null} mob={typeof window!=='undefined'&&window.innerWidth<=768}/>
          </div>
        </div>

        {/* Description card */}
        <div style={{padding:'18px 20px 22px',background:'rgba(0,0,0,.4)',borderTop:'1px solid rgba(255,255,255,.1)',flexShrink:0}}>
          <div style={{maxWidth:720,margin:'0 auto'}}>
            <div style={{fontSize:11,letterSpacing:1.5,textTransform:'uppercase',opacity:.6,marginBottom:6}}>Шаг {stepIdx+1}</div>
            <div style={{fontSize:21,fontWeight:700,marginBottom:6,lineHeight:1.25}}>{step.title}</div>
            <div style={{fontSize:13,opacity:.75,marginBottom:12,fontStyle:'italic'}}>{step.sub}</div>
            <div style={{fontSize:14,lineHeight:1.55,opacity:.92,marginBottom:18}}>{step.desc}</div>
            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <button disabled={stepIdx===0} onClick={()=>{ setStepIdx(i=>Math.max(0,i-1)); setPlaying(false); }} style={{padding:'10px 18px',borderRadius:8,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.06)',color:'#fff',cursor:stepIdx===0?'not-allowed':'pointer',opacity:stepIdx===0?.4:1,fontSize:13,fontWeight:500}}>← Назад</button>
              <button onClick={()=> setPlaying(p=>!p)} style={{padding:'10px 18px',borderRadius:8,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.06)',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:500}}>{playing?'⏸ Пауза':'▶ Авто'}</button>
              {!isLast && <button onClick={()=>{ setStepIdx(i=>Math.min(STEPS.length-1,i+1)); setPlaying(false); }} style={{padding:'10px 22px',borderRadius:8,border:'1px solid #a21caf',background:'#a21caf',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>Дальше →</button>}
              {isLast && <button onClick={()=>{ if(onLoadAtm) onLoadAtm(); onClose(); }} style={{padding:'10px 22px',borderRadius:8,border:'1px solid #60a5fa',background:'#3b82f6',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>✓ Перейти к Ясне</button>}
              <div style={{flex:1}}/>
              <div style={{fontSize:11,opacity:.5}}>{playing && step.dur>0 ? `Авто-переход через ${(step.dur/1000).toFixed(1)}с` : 'Ручной режим'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return OnboardingAtm;
})();
