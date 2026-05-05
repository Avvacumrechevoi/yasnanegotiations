// ═══════════════════════════════════════════════════════════════════
// APP — root component + CURRICULUM + render
// Depends on: window.YasnaCore, window.YasnaLessons
// ═══════════════════════════════════════════════════════════════════

const{useState,useMemo,useEffect,useRef,useCallback}=React;


// Pull what App needs from core + lessons
const {Star, Yasna3DView, Info, OverlayLegend, Editor, OverlayPicker, Picker, Verification, GLOSS} = window.YasnaCore;
const {Lesson, LESSONS} = window.YasnaLessons;


// Lesson Picker — splash to pick a lesson
// Curriculum structure — defines modules, their lessons, and planned future lessons
// ═══════════════════════════════════════════════════════════════════
// CURRICULUM STRUCTURE v5 — two paths
//
// Путь 1 — Метод Ясны (освоение самого метода как навыка мышления):
//   • Базовый · Крест       — скелет: 4 опоры, пары противопол-й,
//                             базовые законы (9 уроков · ~3 часа)
//   • Стандарт · Восьмёрка  — долгие состояния и их пары
//                             (8 уроков · ~3 часа)        [в разработке]
//   • Продвинутый · Звезда  — переходы, три Креста, ошибки,
//                             вложенность (10 уроков · ~4 часа) [в разработке]
//
// Путь 2 — Ясны явлений (применение метода к областям):
//   • Ясна Суток — детально        [в разработке]
//   • Ясна Дома                    [в разработке]
//   • Ясна Круговорота Воды        [в разработке]
//   • … (остальные по мере готовности)
//
// Архив — ранние черновики, убраны из основной навигации.
// Существующие уроки l2_night_foundation и l3_morning — именно туда.
// ═══════════════════════════════════════════════════════════════════

const CURRICULUM={
  paths:[
    // ─────────────────────────────────────────────────────────────
    // ПУТЬ 1 — Метод Ясны
    // ─────────────────────────────────────────────────────────────
    {
      id:'path_method',
      title:'Метод Ясны',
      subtitle:'Учимся видеть устройство любого явления',
      icon:'🧭',
      courses:[
        {
          id:'course_basic',
          title:'Базовый · Крест',
          subtitle:'Скелет: 4 опоры, пары противоположностей, базовые законы',
          level:4,
          duration:'~3 часа',
          status:'active',
          // Intro-урок Базового (существующий l1_intro). Остальные — планируются.
          lessons:[
            {id:'l1_intro',status:'ready'},
            {id:'b2_four_pillars',status:'ready'},
            {id:'b3_two_lines',status:'ready'},
            {id:'b4_line_names',status:'ready'},
            {id:'b5_archetypes',status:'planned',
              title:'Четыре архетипа: Союз, Война, Союз, Мир',
              subtitle:'Содержание каждой из четырёх опор',
              duration:'~22 мин',
              mechanics:['Тайный союз в 0','Война в 3','Явный союз в 6','Мир в 9']},
            {id:'b6_practice',status:'planned',
              title:'Собери свою ясну',
              subtitle:'Финальная практика — твой Крест на личном явлении',
              duration:'~25 мин',
              mechanics:['Метод самостоятельного разбора','Проверка и цикл']}
          ]
        },
        {
          id:'course_standard',
          title:'Стандарт · Восьмёрка',
          subtitle:'Добавляем долгие состояния и их пары между опорами',
          level:8,
          duration:'~3 часа',
          status:'planned',
          note:'Откроется после Базового',
          lessons:[
            {id:'s1_refresher',status:'planned',title:'Возвращение к Кресту',duration:'~5 мин'},
            {id:'s2_long_states',status:'planned',title:'Природа долгих состояний',duration:'~22 мин'},
            {id:'s3_build_eight',status:'planned',title:'Достраиваем до восьмёрки',duration:'~22 мин'},
            {id:'s4_pairs_long',status:'planned',title:'Пары долгих (2↔8, 4↔10)',duration:'~18 мин'},
            {id:'s5_two_triangles',status:'planned',title:'Треугольники Земли и Воздуха',duration:'~22 мин'},
            {id:'s6_quality_law',status:'planned',title:'Закон Перехода Количества в Качество',duration:'~18 мин'},
            {id:'s7_mirror',status:'planned',title:'Зеркальность половин',duration:'~20 мин'},
            {id:'s8_practice',status:'planned',title:'Восьмёрка твоего явления',duration:'~35 мин'}
          ]
        },
        {
          id:'course_advanced',
          title:'Продвинутый · Звезда',
          subtitle:'Переходы, три Креста, ошибки, вложенность',
          level:12,
          duration:'~4 часа',
          status:'planned',
          note:'Откроется после Стандарта',
          lessons:[
            {id:'a1_refresher',status:'planned',title:'Возвращение к Восьмёрке',duration:'~5 мин'},
            {id:'a2_short_transitions',status:'planned',title:'Короткие переходы',duration:'~22 мин'},
            {id:'a3_build_twelve',status:'planned',title:'Достраиваем до двенадцати',duration:'~22 мин'},
            {id:'a4_four_triangles',status:'planned',title:'Все четыре Треугольника стихий',duration:'~25 мин'},
            {id:'a5_right_cross',status:'planned',title:'Правый Крест (Тепловой · Крест Победы)',duration:'~28 мин'},
            {id:'a6_left_cross',status:'planned',title:'Левый Крест (Крест Веры)',duration:'~28 мин'},
            {id:'a7_star',status:'planned',title:'Звезда Ясна — три Креста вместе',duration:'~22 мин'},
            {id:'a8_error_nine',status:'planned',title:'Ошибка 9 как свойство мира',duration:'~22 мин'},
            {id:'a9_nested',status:'planned',title:'Ясна в Ясне — вложенность',duration:'~25 мин'},
            {id:'a10_practice',status:'planned',title:'Полная Ясна твоего явления',duration:'~45 мин'}
          ]
        }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // ПУТЬ 2 — Ясны явлений (углубления)
    // ─────────────────────────────────────────────────────────────
    {
      id:'path_specific',
      title:'Ясны явлений',
      subtitle:'Применяем метод к отдельным областям — после Базового',
      icon:'📚',
      lockedHint:'Откроется после Базового',
      modules:[
        {id:'mod_sutok',title:'Ясна Суток',subtitle:'Детальный разбор цикла дня и ночи',status:'planned',
          themes:['Полочка 0 — Ночь','Полочки 1-2-3 — Утро','Полочки 4-5-6 — Подъём и День','Полочки 7-8-9 — Спад и Вечер','Полочки 10-11 — Сумерки']},
        {id:'mod_doma',title:'Ясна Дома',subtitle:'12 комнат и их смысл',status:'planned'},
        {id:'mod_vody',title:'Ясна Круговорота Воды',subtitle:'От грязи к облаку и обратно',status:'planned'},
        {id:'mod_dereva',title:'Ясна Дерева',subtitle:'От корня до ветки и обратно',status:'planned'},
        {id:'mod_mesyacev',title:'Ясна Месяцев',subtitle:'Годовой цикл в 12 частях',status:'planned'},
        {id:'mod_tela',title:'Ясна Тела',subtitle:'Устройство тела человека',status:'planned'},
        {id:'mod_kuhni',title:'Ясна Кухни',subtitle:'Как готовится еда — от входа до подачи',status:'planned'},
        {id:'mod_dvora',title:'Ясна Двора и Домашних Животных',subtitle:'Кто где живёт во дворе',status:'planned'},
        {id:'mod_pechi',title:'Ясна Печи',subtitle:'12 частей правильной печи',status:'planned'},
        {id:'mod_zavoda',title:'Ясна Завода',subtitle:'Структура предприятия',status:'planned'},
        {id:'mod_teatra',title:'Ясна Театра',subtitle:'От коридора до гримёрки',status:'planned'}
      ]
    }
  ],

  // ─────────────────────────────────────────────────────────────
  // АРХИВ — ранние черновики, убраны из основной навигации
  // ─────────────────────────────────────────────────────────────
  archive:{
    id:'archive_drafts',
    title:'Ранние черновики',
    subtitle:'Первые эксперименты с глубоким разбором отдельных полочек',
    note:'Эти уроки дали ценные находки, которые войдут в «Ясну Суток — детально» (Путь 2). Пока оставлены для справки.',
    lessons:[
      {id:'l2_night_foundation',status:'draft'},
      {id:'l3_morning',status:'draft'}
    ]
  }
};

function LessonPicker({onSelectLesson,onClose,completedLessons=[]}){
  const lessonsMap=Object.fromEntries(LESSONS.map(l=>[l.id,l]));
  const[showArchive,setShowArchive]=useState(false);

  // ── primitives ──
  const statusPill=(status,note)=>{
    const c=status==='ready'?{bg:'#E8F5EE',fg:'#1B7A3F',t:'готов'}
          :status==='in_progress'?{bg:'#FFF4E0',fg:'#B8560E',t:'идёт'}
          :status==='draft'?{bg:'#F3E9F8',fg:'#6B3A8A',t:'черновик'}
          :{bg:'#EEF0F3',fg:'#6E7781',t:note||'скоро'};
    return<span style={{display:'inline-block',fontSize:10,fontWeight:700,color:c.fg,background:c.bg,padding:'3px 8px',borderRadius:10,letterSpacing:0.3,textTransform:'uppercase',whiteSpace:'nowrap'}}>{c.t}</span>;
  };

  // ── ready lesson card (clickable) ──
  const ReadyLesson=({l,idx})=>{
    const done=completedLessons.includes(l.id);
    return(
      <button onClick={()=>onSelectLesson(l.id)} style={{display:'flex',width:'100%',padding:'13px 14px',marginBottom:7,background:'#fff',border:'1px solid #E5E5EA',borderRadius:12,textAlign:'left',cursor:'pointer',gap:11,alignItems:'center',transition:'all .15s',fontFamily:'inherit'}}>
        <div style={{width:30,height:30,borderRadius:'50%',background:done?'#30A060':'#0071E3',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>{done?'✓':idx}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:'#0D1B2A',marginBottom:1,lineHeight:1.3}}>{l.title}</div>
          <div style={{fontSize:11.5,color:'#6E7781',lineHeight:1.4}}>{l.subtitle} · {l.duration}</div>
        </div>
        <div style={{color:'#AEAEB2',fontSize:18,flexShrink:0}}>›</div>
      </button>
    );
  };

  // ── planned lesson card (non-clickable, muted) ──
  const PlannedLesson=({l,idx})=>(
    <div style={{display:'flex',width:'100%',padding:'12px 14px',marginBottom:7,background:'#F8F8F9',border:'1px dashed #DCDEE3',borderRadius:12,gap:11,alignItems:'center',cursor:'not-allowed'}}>
      <div style={{width:30,height:30,borderRadius:'50%',background:'#D1D1D6',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{idx}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13.5,fontWeight:600,color:'#6E7781',lineHeight:1.3,marginBottom:1}}>{l.title}</div>
        <div style={{fontSize:11.5,color:'#AEAEB2',lineHeight:1.4}}>{l.subtitle||(l.mechanics&&l.mechanics.join(' · '))||'В разработке'}{l.duration?' · '+l.duration:''}</div>
      </div>
      <div style={{flexShrink:0}}>{statusPill('planned','скоро')}</div>
    </div>
  );

  // ── course block (Базовый / Стандарт / Продвинутый) ──
  const CourseBlock=({course,pathLocked})=>{
    const readyLessons=course.lessons.filter(cl=>cl.status==='ready').map(cl=>({...cl,...lessonsMap[cl.id]}));
    const plannedLessons=course.lessons.filter(cl=>cl.status==='planned');
    const completedCount=readyLessons.filter(l=>completedLessons.includes(l.id)).length;
    const total=course.lessons.length;
    const isLocked=course.status==='planned'||pathLocked;

    const accent=course.level===4?'#0071E3':course.level===8?'#8B60D3':'#D6502B';

    return(
      <div style={{marginBottom:20,background:'#fff',border:'1px solid #E5E5EA',borderRadius:16,overflow:'hidden'}}>
        {/* Course header */}
        <div style={{padding:'14px 16px 12px',background:`linear-gradient(135deg,${accent}08,${accent}16)`,borderBottom:'1px solid '+accent+'22'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:4}}>
            <div style={{fontSize:10,fontWeight:700,color:accent,letterSpacing:0.8,textTransform:'uppercase'}}>Уровень {course.level} · {course.duration}</div>
            {isLocked?statusPill('planned',course.note?'скоро':'в разработке'):null}
          </div>
          <div style={{fontSize:16,fontWeight:800,color:'#0D1B2A',letterSpacing:'-0.2px',marginBottom:3}}>{course.title}</div>
          <div style={{fontSize:12.5,color:'#3D4852',lineHeight:1.45}}>{course.subtitle}</div>
          {!isLocked&&total>0&&(
            <div style={{marginTop:10}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <div style={{fontSize:11,color:accent,fontWeight:600}}>Прогресс</div>
                <div style={{fontSize:11,color:accent,fontWeight:600}}>{completedCount} из {total}</div>
              </div>
              <div style={{height:4,background:accent+'22',borderRadius:2,overflow:'hidden'}}>
                <div style={{width:(completedCount/total*100)+'%',height:'100%',background:accent,transition:'width .4s'}}/>
              </div>
            </div>
          )}
        </div>
        {/* Lessons list */}
        <div style={{padding:'12px 14px'}}>
          {course.lessons.map((cl,i)=>{
            if(cl.status==='ready'){
              const full=lessonsMap[cl.id];
              if(!full) return null;
              return<ReadyLesson key={cl.id} l={full} idx={i+1}/>;
            }
            return<PlannedLesson key={cl.id} l={cl} idx={i+1}/>;
          })}
          {isLocked&&course.note&&(
            <div style={{marginTop:8,padding:'10px 12px',background:'#F8F8F9',borderRadius:10,fontSize:11.5,color:'#6E7781',textAlign:'center'}}>
              🔒 {course.note}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── specific Yasna module card (one for each Ясна) ──
  const YasnaModule=({m})=>(
    <div style={{display:'flex',padding:'12px 14px',marginBottom:7,background:'#F8F8F9',border:'1px dashed #DCDEE3',borderRadius:12,gap:11,alignItems:'center'}}>
      <div style={{fontSize:20,flexShrink:0}}>📖</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13.5,fontWeight:600,color:'#6E7781',marginBottom:1}}>{m.title}</div>
        <div style={{fontSize:11.5,color:'#AEAEB2',lineHeight:1.4}}>{m.subtitle}</div>
      </div>
      <div style={{flexShrink:0}}>{statusPill('planned')}</div>
    </div>
  );

  // ── path block (top level) ──
  const PathBlock=({path})=>{
    const locked=path.id==='path_specific';
    return(
      <div style={{marginBottom:30}}>
        <div style={{padding:'0 4px',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:4}}>
            <span style={{fontSize:20}}>{path.icon}</span>
            <div style={{fontSize:15,fontWeight:800,color:'#0D1B2A',letterSpacing:'-0.1px'}}>{path.title}</div>
            {locked&&statusPill('planned','скоро')}
          </div>
          <div style={{fontSize:12.5,color:'#6E7781',lineHeight:1.5,paddingLeft:29}}>{path.subtitle}</div>
        </div>
        {path.courses&&path.courses.map(c=><CourseBlock key={c.id} course={c} pathLocked={false}/>)}
        {path.modules&&(
          <div style={{padding:'4px 2px'}}>
            {locked&&path.lockedHint&&(
              <div style={{padding:'11px 14px',background:'#FFF9E8',border:'1px solid #F0D98A',borderRadius:12,marginBottom:10,fontSize:12,color:'#8A6400',lineHeight:1.5}}>
                🔒 {path.lockedHint}
              </div>
            )}
            {path.modules.map(m=><YasnaModule key={m.id} m={m}/>)}
          </div>
        )}
      </div>
    );
  };

  return(
    <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'#F5F5F7',zIndex:70,display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{padding:'14px 20px',borderBottom:'1px solid #E5E5EA',flexShrink:0,display:'flex',alignItems:'center',gap:10,background:'#fff'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:'#86868B',textTransform:'uppercase',letterSpacing:0.6,fontWeight:700,marginBottom:2}}>🎓 Интерактивный курс</div>
          <h2 style={{fontSize:18,fontWeight:800,color:'#0D1B2A',letterSpacing:'-0.2px'}}>Курс по Ясне</h2>
        </div>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:10,border:'1px solid #E5E5EA',background:'#fff',cursor:'pointer',color:'#424245',fontSize:14}}>✕</button>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto',padding:'18px 16px 24px',maxWidth:700,margin:'0 auto',width:'100%',boxSizing:'border-box'}}>
        <div style={{padding:'14px 16px',background:'#fff',border:'1px solid #E5E5EA',borderRadius:14,marginBottom:22,fontSize:13,color:'#3D4852',lineHeight:1.6}}>
          Любое явление можно разобрать на части. День, разговор, проект, дом — всё устроено по одной и той же схеме.<br/><br/>Эту схему можно увидеть на разной глубине: <b>4 полочки</b>, если смотреть крупно. <b>8 полочек</b>, если присмотреться. <b>12 полочек</b>, если разобрать детально.<br/><br/>Эта схема и есть <b>Ясна</b> — одна для всего, что есть в мире. Базовый курс учит видеть Ясну в любом явлении.<br/><br/>А кому интересно, как Ясна работает в конкретном явлении, — есть отдельные курсы: Ясна Суток, Ясна Года, Ясна Жизни и другие разборы.
        </div>

        {CURRICULUM.paths.map(p=><PathBlock key={p.id} path={p}/>)}

        {/* Archive toggle */}
        <div style={{marginTop:20,padding:'14px 16px',background:'#FAFAFB',border:'1px solid #ECECEE',borderRadius:14}}>
          <button onClick={()=>setShowArchive(!showArchive)} style={{display:'flex',width:'100%',background:'none',border:'none',padding:0,cursor:'pointer',alignItems:'center',gap:10,fontFamily:'inherit',textAlign:'left'}}>
            <div style={{fontSize:18,flexShrink:0,color:'#86868B'}}>📦</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:'#424245',marginBottom:1}}>{CURRICULUM.archive.title}</div>
              <div style={{fontSize:11.5,color:'#86868B',lineHeight:1.4}}>{CURRICULUM.archive.subtitle}</div>
            </div>
            <div style={{color:'#AEAEB2',fontSize:14,flexShrink:0,transition:'transform .2s',transform:showArchive?'rotate(90deg)':'none'}}>›</div>
          </button>
          {showArchive&&(
            <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid #ECECEE'}}>
              <div style={{fontSize:11.5,color:'#86868B',lineHeight:1.55,marginBottom:10,fontStyle:'italic'}}>{CURRICULUM.archive.note}</div>
              {CURRICULUM.archive.lessons.map((al,i)=>{
                const full=lessonsMap[al.id];
                if(!full)return null;
                return(
                  <button key={al.id} onClick={()=>onSelectLesson(al.id)} style={{display:'flex',width:'100%',padding:'11px 13px',marginBottom:6,background:'#fff',border:'1px solid #E5E5EA',borderRadius:10,textAlign:'left',cursor:'pointer',gap:10,alignItems:'center',fontFamily:'inherit'}}>
                    <div style={{width:26,height:26,borderRadius:'50%',background:'#9098A3',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#424245',marginBottom:1}}>{full.title}</div>
                      <div style={{fontSize:11,color:'#86868B'}}>{full.subtitle} · {full.duration}</div>
                    </div>
                    {statusPill('draft')}
                  </button>);
              })}
            </div>
          )}
        </div>

        <div style={{marginTop:20,padding:'0 8px',fontSize:11.5,color:'#AEAEB2',lineHeight:1.6,textAlign:'center'}}>
          Курс выстроен как спираль: каждый уровень расширяет структуру на более точное разрешение.
        </div>
      </div>
    </div>);
}

function Instruction({onClose}){
  const Step=({n,title,children})=><div style={{display:'flex',gap:16,marginBottom:28}}>
    <div style={{width:40,height:40,borderRadius:'50%',background:'#0071e3',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,flexShrink:0}}>{n}</div>
    <div style={{flex:1}}><h3 style={{fontSize:17,fontWeight:700,color:'#1d1d1f',marginBottom:6}}>{title}</h3><div style={{fontSize:13,color:'#424245',lineHeight:1.7}}>{children}</div></div>
  </div>;
  const Check=({children})=><div style={{display:'flex',gap:8,alignItems:'flex-start',padding:'6px 0'}}><span style={{color:'#30A060',fontSize:14,flexShrink:0}}>✓</span><div style={{fontSize:13,color:'#424245',lineHeight:1.6}}>{children}</div></div>;
  const Card=({title,color,children})=><div style={{padding:'16px 18px',background:color+'06',border:'1px solid '+color+'20',borderRadius:12,marginBottom:12}}><div style={{fontSize:13,fontWeight:700,color:color,marginBottom:8}}>{title}</div>{children}</div>;

  return(
    <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'#fff',zIndex:70,display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',padding:'14px 24px',borderBottom:'1px solid #e5e5ea',flexShrink:0}}>
        <h2 style={{fontSize:24,fontWeight:700,color:'#1d1d1f',flex:1}}>Инструкция по составлению Ясны</h2>
        <button onClick={onClose} style={{fontSize:13,color:'#0071e3',padding:'8px 20px',border:'1px solid #0071e3',borderRadius:8}}>Закрыть</button>
      </div>
      <div className='fullpage-content' style={{flex:1,overflowY:'auto',padding:'24px',maxWidth:760,margin:'0 auto',width:'100%'}}>

        {/* INTRO */}
        <div style={{padding:'20px 24px',background:'linear-gradient(135deg,#f0f5ff,#faf5ff)',borderRadius:16,marginBottom:32}}>
          <div style={{fontSize:20,fontWeight:700,color:'#1d1d1f',marginBottom:8}}>Что такое Ясна?</div>
          <div style={{fontSize:14,color:'#424245',lineHeight:1.7}}>
            Ясна — это 12-частная циклическая структура, описывающая любое явление. Как циферблат часов, но вместо часов — этапы процесса. Каждый элемент стоит на своей «полочке» и связан с остальными через набор правил (механик). Если все 12 элементов расставлены правильно — Ясна «звучит», как настроенный инструмент.
          </div>
        </div>

        {/* 7 STEPS */}
        <div style={{fontSize:22,fontWeight:700,color:'#1d1d1f',marginBottom:20}}>11 шагов составления</div>

        <Step n="1" title="Назовите явление">
          Выберите то, что хотите разложить на 12 частей. Это может быть что угодно: профессия, процесс, место, система. Важно: явление должно быть <b>циклическим</b> — иметь начало и конец, которые замыкаются в круг.
          <div style={{padding:'10px 14px',background:'var(--bg2)',borderRadius:8,marginTop:8,fontSize:12,color:'#6e6e73'}}>
            Пример — Круговорот воды: вода проходит цикл от грязи на земле через испарение, облака, дождь — и возвращается обратно в грязь. Цикл замкнут ✓
          </div>
        </Step>

        <Step n="2" title="Найдите 4 опоры (Опорный Крест · Крест Бытия · Надежда)">
          Определите 4 главных состояния/события вашего явления. Они встанут на Опорный Крест, он же Крест Бытия, Крест Надежды:<br/>
          <b>Позиция 0</b> — Минимум параметра. В книге: <b>Сила Тьмы</b>, дно Чаши Тьмы, скрытая основа.<br/>
          <b>Позиция 3</b> — Горизонт рождения. В книге: <b>Проявление Света</b>, Восход, <b>Стрелка Весов</b>, Точка Истины.<br/>
          <b>Позиция 6</b> — Максимум параметра. В книге: <b>Сила Света</b>, дно Чаши Света, Чистый Свет.<br/>
          <b>Позиция 9</b> — Горизонт завершения. В книге: <b>Проявление Тьмы</b>, Закат, <b>Планка Весов</b>, Точка Розыгрыша.<br/>
          <div style={{padding:'10px 14px',background:'#E8364F08',borderLeft:'3px solid #E8364F',borderRadius:8,marginTop:8,fontSize:12,color:'#6e6e73'}}>
            Проверка: 0 и 6 — полярные противоположности (Линия Единства, §249). 3 и 9 — тоже противоположности (Линия Борьбы, §164). Если антипод не читается — позиции перепутаны.
          </div>
          <div style={{padding:'10px 14px',background:'#f0f5ff',borderRadius:8,marginTop:8,fontSize:12,color:'#424245',lineHeight:1.6}}>
            <b>Круговорот воды:</b><br/>
            0 = Грязь (минимум чистоты — скрытая основа) ✓<br/>
            3 = Поверхность водоёма (вода вышла наружу — рождение) ✓<br/>
            6 = Холод / Перенос (максимум высоты — вершина) ✓<br/>
            9 = Касание воды (вода вернулась к земле — завершение) ✓<br/>
            Проверка: Грязь(0) ↔ Перенос(6) = земля↔небо ✓. Поверхность(3) ↔ Касание(9) = подъём↔спуск ✓
          </div>
        </Step>

        <Step n="3" title="Расставьте результаты (Крест Управления · Исхода · Любовь)">
          Также называется: Правый Крест, Тепловой Крест, Крест Исхода, Крест Победы, Крест Любви (§446-447, §498, §502, §523). Для каждой Опорной найдите <b>результат</b> (исход) — что получается ПОСЛЕ неё:<br/>
          0→<b>1</b>: исход из Тьмы (самый холод). 3→<b>4</b>: исход утреннего боя. 6→<b>7</b>: исход труда (пик тепла). 9→<b>10</b>: исход вечернего боя.
          <div style={{padding:'10px 14px',background:'#f0f5ff',borderRadius:8,marginTop:8,fontSize:12,color:'#424245',lineHeight:1.6}}>
            <b>Круговорот воды:</b><br/>
            0(Грязь) → <b>1 = Болото/Родник</b> — результат: из грязи родился источник ✓<br/>
            3(Поверхность) → <b>4 = Пар</b> — результат: вода испарилась ✓<br/>
            6(Перенос) → <b>7 = Гроза/Молния</b> — результат: облака разрядились ✓<br/>
            9(Касание) → <b>10 = Стекание</b> — результат: вода потекла по земле ✓
          </div>
        </Step>

        <Step n="4" title="Расставьте подготовку (Крест Веры · Левит · Вера)">
          Также называется: Левый Крест, Крест Левит, Крест Духа, Крест Свежести (§452, §499). Для каждой Опорной найдите <b>подготовку/ожидание/веру</b> — что готовит душу к следующей опоре:<br/>
          <b>2</b>→3: вера в победу Света перед боем. <b>5</b>→6: вера в свои силы перед трудом. <b>8</b>→9: вера в жизнь перед боем. <b>11</b>→0: вера в завтра, новый цикл.
          <div style={{padding:'10px 14px',background:'#f0f5ff',borderRadius:8,marginTop:8,fontSize:12,color:'#424245',lineHeight:1.6}}>
            <b>Круговорот воды:</b><br/>
            <b>2 = Река</b> → 3(Поверхность) — река несёт воду к открытой поверхности, готовит ✓<br/>
            <b>5 = Облако</b> → 6(Перенос) — облако копится перед переносом ✓<br/>
            <b>8 = Дождь</b> → 9(Касание) — дождь падает, готовит касание ✓<br/>
            <b>11 = Лужа</b> → 0(Грязь) — лужа впитывается, возвращается в грязь ✓
          </div>
        </Step>

        <Step n="5" title="Проверьте тип (Долгое/Короткое — Грани/Углы)">
          Чётные позиции (0,2,4,6,8,10) — <b>долгие, «грани»</b>: процессы, зоны, состояния, накопления.<br/>
          Нечётные (1,3,5,7,9,11) — <b>короткие, «углы/переломы»</b>: моменты, переломы, вспышки, скачки.<br/>
          <b>Основной Закон Ясны</b> (§290): переход количества в качество. Долгое копит, короткое скачком превращает накопленное в новое качество.<br/>
          Если на чётной стоит «момент» или на нечётной «процесс» — переместите.
          <div style={{padding:'10px 14px',background:'#f0f5ff',borderRadius:8,marginTop:8,fontSize:12,color:'#424245',lineHeight:1.6}}>
            <b>Круговорот воды:</b><br/>
            Долгие грани: 0=Грязь, 2=Река, 4=Пар, 6=Перенос, 8=Дождь, 10=Стекание — все длительные ✓<br/>
            Короткие углы: 1=Родник(пробился!), 3=Поверхность(вышла!), 5=Облако(собралось!), 7=Гроза(ударила!), 9=Касание(коснулась!), 11=Лужа(собралась!) — все мгновенные ✓
          </div>
        </Step>

        <Step n="6" title="Лёгкие / Тяжёлые / Ожидания (§275-277)">
          Из всех 6 долгих позиций три типа по характеру изменения:<br/>
          <b>Лёгкие</b> (2, 8) — свет меняется с <b>ускорением</b>. Заря разгорается быстрее, Спуск ускоряется к закату.<br/>
          <b>Тяжёлые</b> (4, 10) — свет меняется с <b>замедлением</b>. Подъём замедляется к зениту, Сумерки замедляются.<br/>
          <b>Ожидания</b> (0, 6) — свет <b>не меняется</b>. Ночь и День — накапливается что-то другое (холод / жар).
          <div style={{padding:'10px 14px',background:'#f0f5ff',borderRadius:8,marginTop:8,fontSize:12,color:'#424245',lineHeight:1.6}}>
            <b>Проверка:</b> на позициях 2 и 8 ваш элемент должен быть «лёгким, ускоряющимся». На 4 и 10 — «тяжёлым, замедляющимся». На 0 и 6 — «неподвижным ожиданием», в котором копится что-то невидимое.
          </div>
        </Step>

        <Step n="7" title="Проверьте стихии — 4 Праны (§648-653, §583-584)">
          Три позиции каждой Праны должны быть похожи «по духу». У каждой праны — глухой и звонкий глас:<br/>
          <b>Земля ШЭ / ЭЛ</b> (0, 4, 8): все устойчивые. <b>Вода ФО / ОМ</b> (1, 5, 9): все текучие.<br/>
          <b>Воздух ЦИ / ИНЬ</b> (2, 6, 10): все переходные. <b>Огонь ХА / АНГ</b> (3, 7, 11): все яркие.
          <div style={{padding:'10px 14px',background:'#f0f5ff',borderRadius:8,marginTop:8,fontSize:12,color:'#424245',lineHeight:1.6}}>
            <b>Круговорот воды:</b><br/>
            Земля ШЭ (0,4,8): Грязь, Пар, Дождь — устойчивые состояния воды ✓<br/>
            Вода ФО (1,5,9): Родник, Облако, Касание — моменты перемен, текучие ✓<br/>
            Воздух ЦИ (2,6,10): Река, Перенос, Стекание — каналы, несущие среды ✓<br/>
            Огонь ХА (3,7,11): Поверхность(вскипает), Гроза(молния!), Лужа(последняя вспышка) ✓
          </div>
        </Step>

        <Step n="8" title="Прочитайте вслух по кругу">
          Пройдите 0→1→2→...→11→0. Каждый переход должен быть плавным и логичным. Если где-то «спотыкаетесь» — там ошибка.
          <div style={{padding:'10px 14px',background:'#f0f5ff',borderRadius:8,marginTop:8,fontSize:12,color:'#424245',lineHeight:1.6}}>
            <b>Круговорот воды — читаем по кругу:</b><br/>
            Грязь → Родник → Река → Поверхность → Пар → Облако → Перенос → Гроза → Дождь → Касание → Стекание → Лужа → Грязь...<br/>
            Каждый переход плавный, логика не ломается ✓
          </div>
        </Step>

        <Step n="9" title="Проверьте 6 пар противоположностей (полные противостояния)">
          Из книги §227: «Полное противостояние есть противостояние относительно центра диаграммы». Каждая пара N↔(N+6) должна быть реальными антиподами — максимум и минимум одного параметра:
          <div style={{padding:'10px 14px',background:'#ff950008',borderLeft:'3px solid #ff9500',borderRadius:8,marginTop:8,fontSize:12,color:'#424245',lineHeight:1.6}}>
            <b>0↔6:</b> Линия Единства. Сила Тьмы ↔ Сила Света<br/>
            <b>1↔7:</b> Первый результат ↔ Главный результат. Самый холод ↔ Самый жар<br/>
            <b>2↔8:</b> Подготовка нарастания ↔ Подготовка спада. Оба — «лёгкие времена»<br/>
            <b>3↔9:</b> Линия Борьбы. Проявление Света (Стрелка, Истина) ↔ Проявление Тьмы (Планка, Розыгрыш)<br/>
            <b>4↔10:</b> Результат нарастания ↔ Результат спада. Оба — «тяжёлые времена»<br/>
            <b>5↔11:</b> Обещание максимума ↔ Обещание покоя
          </div>
          <div style={{padding:'10px 14px',background:'#f0f5ff',borderRadius:8,marginTop:8,fontSize:12,color:'#6e6e73'}}>
            <b>Проверка для каждой пары:</b> «Можете точно назвать, в чём именно они противоположны? Одно невозможно при другом?»
          </div>
        </Step>

        <Step n="10" title="Найдите системную ошибку 8↔9 (§ Урок 3 Суток)">
          <b>Это свойство мира</b>, а не баг Ясны. Цитата из книги: «Девятка ясно — есть ошибка. Ошибка — это свойство мира. Во всех остальных яснах эта ошибка присутствует». На границе полочек 8 и 9 существует встроенная ПУТАНИЦА — элемент 8 может «притворяться» 9 и наоборот.
          <div style={{padding:'10px 14px',background:'#D946EF0C',borderLeft:'3px solid #D946EF',borderRadius:8,marginTop:8,fontSize:12,color:'#424245',lineHeight:1.6}}>
            <b>Лингвистическое доказательство:</b> ДЕ<b>ВА</b>ть(9) содержит «ДЕВА» (знак зодиака на позиции 8!). ВО<b>С</b>емь(8) содержит «ВЕС-» (Весы — знак на позиции 9!). Слова намеренно перепутаны. Само слово «девиация» (отклонение стрелки весов) — от того же корня.
          </div>
          <div style={{padding:'10px 14px',background:'#f0f5ff',borderRadius:8,marginTop:8,fontSize:12,color:'#424245',lineHeight:1.6}}>
            <b>Три вопроса для проверки:</b><br/>
            1. Что на вашей полочке 8 может быть перепутано с 9? (Пример в Доме: лазарет — лежишь как в спальне-9, но не спишь как в женской-8)<br/>
            2. Есть ли зеркальная путаница 2↔3? (Пример: бар в столовой — по сути кухня-3, но находится в столовой-2)<br/>
            3. Определены ли 4 типа ошибок на Опорном Кресте? 0=ошибка во сне, 3=просмотрел, 6=мираж, 9=ошибка измерения
          </div>
        </Step>

        <Step n="11" title="Сверьтесь с рубрикатором">
          Каждая полочка проверяется на соответствие с другими проверенными Яснами. Откройте вкладку «+ ещё» и посмотрите, что стоит на вашей позиции в других ясн:
          <div style={{padding:'10px 14px',background:'#f0f5ff',borderRadius:8,marginTop:8,fontSize:12,color:'#424245',lineHeight:1.6}}>
            <b>Эталонные Ясны для сверки:</b> Суток, Круговорот Воды, Цветов радуги, Животных двора, Дома, Кухни, Атмосферы, Облачности, Осадков, Примет погоды.<br/><br/>
            Для каждой позиции: «Есть ли смысловая связь между моим элементом и элементами на этой же полочке в других Яснах?»
          </div>
        </Step>

        {/* CHECKLIST: POSITION */}
        <div style={{fontSize:22,fontWeight:700,color:'#1d1d1f',marginBottom:16,marginTop:40,paddingTop:20,borderTop:'1px solid #e5e5ea'}}>Чек-лист полочки (8 проверок)</div>
        <p style={{fontSize:13,color:'#6e6e73',marginBottom:16,lineHeight:1.6}}>Каждый элемент на каждой позиции должен пройти все 8 проверок. Для позиций 8 и 9 — дополнительная, 9-я проверка на системную ошибку.</p>

        <Card title="1. Тип" color="#1d1d1f">
          <Check>Чётная позиция → элемент является процессом, состоянием, зоной?</Check>
          <Check>Нечётная позиция → элемент является моментом, переломом, вспышкой?</Check>
        </Card>
        <Card title="2. Прана (стихия)" color="#C0943A">
          <Check>Позиции 0,4,8 → элемент устойчивый, земной, фундаментальный?</Check>
          <Check>Позиции 1,5,9 → элемент текучий, водный, переменчивый?</Check>
          <Check>Позиции 2,6,10 → элемент воздушный, промежуточный, переходный?</Check>
          <Check>Позиции 3,7,11 → элемент огненный, яркий, взрывной?</Check>
        </Card>
        <Card title="3. Крест" color="#E8364F">
          <Check>Опорная (0,3,6,9) → это одно из 4 главных событий? Без него всё рассыпется?</Check>
          <Check>Правая (1,4,7,10) → это результат предыдущей Опорной?</Check>
          <Check>Левая (2,5,8,11) → это подготовка к следующей Опорной?</Check>
        </Card>
        <Card title="4. Противоположность" color="#ff9500">
          <Check>Элемент [i] и элемент [i+6] — зеркально противоположны?</Check>
          <Check>Можете назвать, в чём именно противоположность?</Check>
        </Card>
        <Card title="5. Соседство" color="#30A060">
          <Check>Переход [i-1] → [i] → [i+1] читается плавно?</Check>
          <Check>Нет «разрывов» — логика не ломается?</Check>
        </Card>
        <Card title="6. Половина (зоны Чаш)" color="#6366f1">
          <Check>Верхний элемент (4-8), Чаша Света → про явное, открытое, дневное?</Check>
          <Check>Нижний элемент (10-2), Чаша Тьмы → про скрытое, закрытое, ночное?</Check>
          <Check>Левый (1-5) → про рост? Правый (7-11) → про спад?</Check>
        </Card>
        <Card title="7. Аналогия с эталонами" color="#9060D0">
          <Check>Элемент выполняет ту же функцию, что и элементы на этой позиции в других Яснах?</Check>
          <Check>Примеры для сравнения: Суток, Дома, Кухни, Круговорота воды, Цветов радуги, Животных</Check>
        </Card>
        <Card title="8. Системная ошибка (для 8 и 9 обязательно)" color="#D946EF">
          <Check>Для полочки 8: есть ли в элементе что-то, что может быть принято за элемент 9?</Check>
          <Check>Для полочки 9: есть ли в элементе что-то, что может быть принято за элемент 8?</Check>
          <Check>Зеркально: есть ли аналогичная путаница между 2 и 3?</Check>
          <Check>Для 0,3,6,9: определён ли тип ошибки (во сне / просмотрел / мираж / измерения)?</Check>
        </Card>

        {/* CHECKLIST: MECHANICS */}
        <div style={{fontSize:22,fontWeight:700,color:'#1d1d1f',marginBottom:16,marginTop:40,paddingTop:20,borderTop:'1px solid #e5e5ea'}}>Чек-лист механик (10 проверок)</div>
        <p style={{fontSize:13,color:'#6e6e73',marginBottom:16,lineHeight:1.6}}>Проверьте каждую механику на всей Ясне целиком.</p>

        <Card title="Опорный Крест (Бытия · Надежда)" color="#E8364F">
          <Check>4 Опоры (0,3,6,9) — самые важные элементы? Остальные без них теряют смысл?</Check>
          <Check>0↔6 противоположны (Линия Единства)? 3↔9 противоположны (Линия Борьбы)?</Check>
        </Card>
        <Card title="Крест Управления (Правый · Исхода · Любви)" color="#E8A834">
          <Check>Каждый из 4 элементов (1,4,7,10) — результат/исход предыдущей Опорной?</Check>
        </Card>
        <Card title="Крест Веры (Левый · Левит · Духа)" color="#5B9CF6">
          <Check>Каждый из 4 элементов (2,5,8,11) — подготовка/вера перед следующей Опорной?</Check>
        </Card>
        <Card title="4 тройки ритма" color="#30A060">
          <Check>Тройка 2→3→4: читается как Вера→Бой→Победа?</Check>
          <Check>Тройка 5→6→7: читается как Вера→Бой→Победа?</Check>
          <Check>Тройка 8→9→10: читается как Вера→Бой→Победа?</Check>
          <Check>Тройка 11→0→1: читается как Вера→Бой→Победа?</Check>
        </Card>
        <Card title="4 треугольника стихий" color="#C0943A">
          <Check>Земля (0,4,8) — все три про устойчивость? Связаны по духу?</Check>
          <Check>Вода (1,5,9) — все три про текучесть? Связаны?</Check>
          <Check>Воздух (2,6,10) — все три переходные? Связаны?</Check>
          <Check>Огонь (3,7,11) — все три яркие/острые? Связаны?</Check>
        </Card>
        <Card title="6 противоположностей" color="#ff9500">
          <Check>Все 6 пар (0↔6, 1↔7, 2↔8, 3↔9, 4↔10, 5↔11) — зеркальны?</Check>
        </Card>
        <Card title="3 Дуги Тепла" color="#9060D0">
          <Check>Дуга I (1→2→3→4→5): плавная последовательность ФО→ЦИ→ХА→ШЭ→ФО?</Check>
          <Check>Дуга II (5→6→7→8→9): плавная последовательность?</Check>
          <Check>Дуга III (9→10→11→0→1): плавная последовательность?</Check>
          <Check>Середина каждой дуги (ХА) — самый яркий элемент из пяти?</Check>
        </Card>
        <Card title="Системная ошибка 8↔9" color="#D946EF">
          <Check>Найдена зона путаницы между полочками 8 и 9?</Check>
          <Check>Найдена зеркальная путаница между 2 и 3?</Check>
          <Check>Определены 4 типа ошибок на Опорном Кресте (0, 3, 6, 9)?</Check>
        </Card>

        {/* TYPICAL ERRORS */}
        <div style={{fontSize:22,fontWeight:700,color:'#1d1d1f',marginBottom:16,marginTop:40,paddingTop:20,borderTop:'1px solid #e5e5ea'}}>Типичные ошибки при составлении</div>
        <p style={{fontSize:13,color:'#6e6e73',marginBottom:16,lineHeight:1.6}}>Восемь наиболее частых промахов. Если Ясна «не звучит» — скорее всего, один из этих.</p>

        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
          <div style={{padding:'12px 16px',background:'#fff5f5',border:'1px solid #ffd4d4',borderRadius:10}}>
            <div style={{fontSize:13,fontWeight:700,color:'#c62828',marginBottom:4}}>1. Процесс вместо состояния</div>
            <div style={{fontSize:12,color:'#424245',lineHeight:1.6}}>Ошибка: «Сначала А, потом Б…». Это хронология, не Ясна. Правильно: 12 ТИПОВ одновременно существующих состояний, упорядоченных по параметру.</div>
          </div>
          <div style={{padding:'12px 16px',background:'#fff5f5',border:'1px solid #ffd4d4',borderRadius:10}}>
            <div style={{fontSize:13,fontWeight:700,color:'#c62828',marginBottom:4}}>2. Несимметричные полюсы 0↔6</div>
            <div style={{fontSize:12,color:'#424245',lineHeight:1.6}}>0 и 6 — «просто разные вещи». Правильно: 0 и 6 на ОДНОЙ шкале (например: света, нестабильности), но на разных концах.</div>
          </div>
          <div style={{padding:'12px 16px',background:'#fff5f5',border:'1px solid #ffd4d4',borderRadius:10}}>
            <div style={{fontSize:13,fontWeight:700,color:'#c62828',marginBottom:4}}>3. Дублирование с существующей Ясной</div>
            <div style={{fontSize:12,color:'#424245',lineHeight:1.6}}>Новая Ясна повторяет содержание существующей. Каждая Ясна должна иметь уникальную предметную область.</div>
          </div>
          <div style={{padding:'12px 16px',background:'#fff5f5',border:'1px solid #ffd4d4',borderRadius:10}}>
            <div style={{fontSize:13,fontWeight:700,color:'#c62828',marginBottom:4}}>4. Нарушение структуры Пран</div>
            <div style={{fontSize:12,color:'#424245',lineHeight:1.6}}>На позиции ШЭ (0,4,8) стоит что-то резкое и скачкообразное. Праны — неизменная структура. Если элемент не соответствует пране — он стоит не на своей полочке.</div>
          </div>
          <div style={{padding:'12px 16px',background:'#fff5f5',border:'1px solid #ffd4d4',borderRadius:10}}>
            <div style={{fontSize:13,fontWeight:700,color:'#c62828',marginBottom:4}}>5. Слабые противоположности</div>
            <div style={{fontSize:12,color:'#424245',lineHeight:1.6}}>Пара N↔(N+6) — не противоположности, а просто «разные вещи». Каждая пара должна быть максимумом и минимумом одного параметра.</div>
          </div>
          <div style={{padding:'12px 16px',background:'#fff5f5',border:'1px solid #ffd4d4',borderRadius:10}}>
            <div style={{fontSize:13,fontWeight:700,color:'#c62828',marginBottom:4}}>6. Разрыв цикла 11→0</div>
            <div style={{fontSize:12,color:'#424245',lineHeight:1.6}}>Переход 11→0 «рвётся», нелогичный. Если цикл не замыкается — неверно выбран 0 или 11.</div>
          </div>
          <div style={{padding:'12px 16px',background:'#fff5f5',border:'1px solid #ffd4d4',borderRadius:10}}>
            <div style={{fontSize:13,fontWeight:700,color:'#c62828',marginBottom:4}}>7. Игнорирование системной ошибки 8↔9</div>
            <div style={{fontSize:12,color:'#424245',lineHeight:1.6}}>Составитель не проверил зону путаницы между 8 и 9. В каждой Ясне ДОЛЖНА быть описана такая зона. Если не нашли — значит, плохо искали. Это свойство мира, не дефект Ясны.</div>
          </div>
          <div style={{padding:'12px 16px',background:'#fff5f5',border:'1px solid #ffd4d4',borderRadius:10}}>
            <div style={{fontSize:13,fontWeight:700,color:'#c62828',marginBottom:4}}>8. Пренебрежение Дугами и Ритмом</div>
            <div style={{fontSize:12,color:'#424245',lineHeight:1.6}}>Проверили Кресты и Праны, но не прочитали 3 дуги как плавные циклы и 4 тройки как мини-истории. Дуги и Ритм — проверки связности. Если дуга читается рывками — элементы в ней не связаны.</div>
          </div>
        </div>

        {/* FINAL CHECKLIST */}
        <div style={{fontSize:22,fontWeight:700,color:'#1d1d1f',marginBottom:16,marginTop:40,paddingTop:20,borderTop:'1px solid #e5e5ea'}}>Финальная проверка всей Ясны</div>

        <div style={{padding:'20px 24px',background:'var(--bg2)',borderRadius:16,marginBottom:20}}>
          <Check>Все 12 позиций заполнены?</Check>
          <Check>Ясна читается по кругу 0→1→...→11→0 без разрывов?</Check>
          <Check>Все 6 противоположностей зеркальны?</Check>
          <Check>4 Опоры — действительно главные? Без них всё теряет смысл?</Check>
          <Check>Чётные — процессы, нечётные — моменты? (12 проверок)</Check>
          <Check>Треугольники стихий — элементы внутри каждого похожи? (4 проверки)</Check>
          <Check>4 тройки ритма — каждая читается как мини-история?</Check>
          <Check>Верхние элементы (4-8) явные? Нижние (10-2) скрытые?</Check>
          <Check>Левые (1-5) растут? Правые (7-11) убывают?</Check>
          <Check>Можете объяснить каждый элемент не-эксперту за 1 предложение?</Check>
          <Check>Описана ли системная ошибка 8↔9? Что на полочке 8 может быть перепутано с 9? Есть ли зеркало на 2↔3?</Check>
        </div>

        <div style={{padding:'20px 24px',background:'linear-gradient(135deg,#f0fff5,#f0f5ff)',borderRadius:16,marginBottom:32}}>
          <div style={{fontSize:16,fontWeight:700,color:'#1d1d1f',marginBottom:8}}>Когда Ясна готова?</div>
          <div style={{fontSize:14,color:'#424245',lineHeight:1.7}}>
            Ясна готова, когда все проверки пройдены и вы можете объяснить логику размещения каждого элемента. Идеальная Ясна — та, где невозможно поменять местами ни одну пару элементов без потери смысла. Каждый стоит на единственно возможном месте.
          </div>
        </div>

      </div>
    </div>
  );
}

function Glossary({onClose}){
  const[open,setOpen]=useState(null);
  const Section=({label,children})=><div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:600,color:'#86868b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6}}>{label}</div>{children}</div>;
  const Tip=({children})=><div style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:6}}><span style={{color:'#30A060',fontSize:14,lineHeight:1,flexShrink:0}}>→</span><div style={{fontSize:13,color:'#424245',lineHeight:1.6}}>{children}</div></div>;
  const Warn=({children})=><div style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:6}}><span style={{color:'#ff9500',fontSize:13,lineHeight:1,flexShrink:0}}>⚠</span><div style={{fontSize:12,color:'#6e6e73',lineHeight:1.5}}>{children}</div></div>;

  return(
    <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'#fff',zIndex:70,display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',padding:'14px 24px',borderBottom:'1px solid #e5e5ea',flexShrink:0}}>
        <h2 style={{fontSize:24,fontWeight:700,color:'#1d1d1f',flex:1}}>Глоссарий</h2>
        <button onClick={onClose} style={{fontSize:13,color:'#0071e3',padding:'8px 20px',border:'1px solid #0071e3',borderRadius:8}}>Закрыть</button>
      </div>
      <div className='fullpage-content' style={{flex:1,overflowY:'auto',padding:'20px 24px',maxWidth:720,margin:'0 auto',width:'100%'}}>
        <p style={{fontSize:14,color:'#6e6e73',marginBottom:24,lineHeight:1.7}}>
          Ясна — это способ описать любое явление через 12 позиций, расположенных по кругу. Каждая позиция имеет свойства и связана с другими через механики. Понимание механик — ключ к составлению правильных Ясен.
        </p>

        {GLOSS.map(g=>{const isOpen=open===g.id;return(
          <div key={g.id} style={{marginBottom:10,border:'1px solid '+(isOpen?g.color+'30':'#e5e5ea'),borderRadius:14,overflow:'hidden',transition:'all .2s',boxShadow:isOpen?'0 2px 12px rgba(0,0,0,.04)':'none'}}>
            <button onClick={()=>setOpen(isOpen?null:g.id)} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'16px 20px',textAlign:'left',background:isOpen?g.color+'06':'#fff'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:g.color,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:600,color:'#1d1d1f'}}>{g.title}</div>
                {g.positions&&<div style={{fontSize:11,color:'#86868b',marginTop:2}}>Позиции: {g.positions}</div>}
                {!isOpen&&<div style={{fontSize:12,color:'#aeaeb2',marginTop:4}}>{g.what.slice(0,80)}...</div>}
              </div>
              <span style={{fontSize:18,color:'#c7c7cc',transform:isOpen?'rotate(90deg)':'none',transition:'transform .2s'}}>›</span>
            </button>
            {isOpen&&<div style={{padding:'4px 20px 20px'}}>

              <div style={{padding:'14px 16px',background:'var(--bg2)',borderRadius:12,marginBottom:16}}>
                <div style={{fontSize:14,color:'#1d1d1f',lineHeight:1.65,fontWeight:500}}>{g.what}</div>
              </div>

              <Section label="Зачем нужно">
                <div style={{fontSize:13,color:'#424245',lineHeight:1.65}}>{g.why}</div>
              </Section>

              <Section label="Как работает">
                <div style={{fontSize:13,color:'#424245',lineHeight:1.65}}>{g.how}</div>
              </Section>

              <Section label="Как применять при составлении">
                <Tip>{g.apply}</Tip>
                {g.questions&&g.questions.map((q,qi)=><Tip key={qi}>{q}</Tip>)}
              </Section>

              {g.mistakes&&<Section label="Частые ошибки">
                {g.mistakes.map((m,mi)=><Warn key={mi}>{m}</Warn>)}
              </Section>}

              {g.related&&<Section label="Связанные механики">
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {g.related.map(r=>{const gl=GLOSS.find(x=>x.id===r);return gl?<button key={r} onClick={()=>setOpen(r)} style={{padding:'4px 12px',borderRadius:16,fontSize:11,background:gl.color+'10',color:gl.color,border:`1px solid ${gl.color}25`}}>{gl.title}</button>:null;})}
                </div>
              </Section>}

              <div style={{padding:'12px 14px',background:g.color+'06',borderLeft:`3px solid ${g.color}`,borderRadius:8,marginTop:4}}>
                <div style={{fontSize:10,fontWeight:600,color:g.color,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Пример</div>
                <div style={{fontSize:13,color:'#424245',lineHeight:1.6}}>{g.example}</div>
              </div>

            </div>}
          </div>);})}
      </div>
    </div>);
}

function App(){
  const defPinned=['суток','круговорота_воды','цветов','знаки_з.','дома','кухни'];
  const initT=T.find(t=>t.id==='суток')||T[0];
  const[y,setY]=useState({name:initT.n,p:[...initT.p],th:initT.th||'',bh:initT.bh||'',lh:initT.lh||'',rh:initT.rh||'',custom:!!initT.custom});
  const[sel,setSel]=useState(null);
  const[yasna2Drill,setYasna2Drill]=useState(null);
  const[subData,setSubData]=useState(()=>{try{return JSON.parse(localStorage.getItem('yasna2_subdata')||'{}');}catch{return{};}});
  const[drillEditing,setDrillEditing]=useState(false);
  const[starRotation,setStarRotation]=useState(null);
  const[rotationSpeed,setRotationSpeed]=useState(48);
  const[rotPanelOpen,setRotPanelOpen]=useState(false);
  const[is3D,setIs3D]=useState(false);
  // Авто-выключение 3D при открытии drill (для удобства редактирования sub-Ясны)
  // 3D drill-down теперь работает в 3D — не делаем авто-fallback в 2D
  const impulseTimerRef=useRef(null);
  const impulseRotation=(dir)=>{
    if(yasna2Drill!=null)return;
    if(impulseTimerRef.current){clearTimeout(impulseTimerRef.current);}
    setStarRotation(dir);
    impulseTimerRef.current=setTimeout(()=>{setStarRotation(null);impulseTimerRef.current=null;},rotationSpeed*1000+50);
  };
  // Авто-стоп вращения при выборе полки (sel) для чтения Info-карточки
  useEffect(()=>{ if(sel!==null&&starRotation){setStarRotation(null);if(impulseTimerRef.current){clearTimeout(impulseTimerRef.current);impulseTimerRef.current=null;}} },[sel]);
  // Cleanup таймера при размонтировании или сбросе
  useEffect(()=>{ if(!starRotation&&impulseTimerRef.current){clearTimeout(impulseTimerRef.current);impulseTimerRef.current=null;} },[starRotation]);

  useEffect(()=>{try{localStorage.setItem('yasna2_subdata',JSON.stringify(subData));}catch{}},[subData]);
  const subKey=(name,idx)=>name+'_'+idx;
  const getSubPolki=(name,idx)=>(subData[subKey(name,idx)]||Array(12).fill(''));
  const setSubPolkaAt=(name,idx,j,val)=>{const k=subKey(name,idx);setSubData(prev=>{const cur=[...(prev[k]||Array(12).fill(''))];cur[j]=val;return{...prev,[k]:cur};});};
  const setSubPolkiAll=(name,idx,arr)=>{setSubData(prev=>({...prev,[subKey(name,idx)]:[...arr]}));};
  const clearSub=(name,idx)=>{setSubData(prev=>{const next={...prev};delete next[subKey(name,idx)];return next;});};
  const[af,setAf]=useState([]);
  const[ed,setEd]=useState(false);
  const[glossary,setGlossary]=useState(false);
  const[instr,setInstr]=useState(false);
  const[verif,setVerif]=useState(false);
  const[menu,setMenu]=useState(false);
  const[filtersOpen,setFiltersOpen]=useState(false);
  const[fullStar,setFullStar]=useState(false);
  const[vState,setVState]=useState({});
  const[overlay,setOverlay]=useState(null);
  const[showOverlayPicker,setShowOverlayPicker]=useState(false);
  const[picker,setPicker]=useState(false);
  const[pinned,setPinned]=useState(defPinned);
  const[lessonPicker,setLessonPicker]=useState(false);
  const[showTour,setShowTour]=useState(false);
  const[helpOpen,setHelpOpen]=useState(false);
  const[activeLesson,setActiveLesson]=useState(null);
  const[completedLessons,setCompletedLessons]=useState([]);
  // Auto-close burger menu when any modal/panel opens
  useEffect(()=>{ if(!af.includes('mb_yasna2')){setYasna2Drill(null);setDrillEditing(false);} },[af]);
  useEffect(()=>{ if(yasna2Drill!=null) setStarRotation(null); },[yasna2Drill]);

  // Rotation теперь управляется внутри Star через ref + rAF (см. yasna-star.js)
  useEffect(()=>{
    if(ed||glossary||instr||verif||fullStar||picker||showOverlayPicker||lessonPicker||activeLesson){
      setMenu(false);
      // Закрываем Info-карточку (FI), чтобы её состояние fi-full не оставалось
      // под модалкой и не держало body:has(.fi-full) → .hdr{max-height:0} активным.
      // Без этого после возврата из модалки шапка остаётся свёрнутой и некликабельной.
      setSel(null);
    }
  },[ed,glossary,instr,verif,fullStar,picker,showOverlayPicker,lessonPicker,activeLesson]);
  const load=t=>{setY({name:t.n,p:[...t.p],th:t.th||'',bh:t.bh||'',lh:t.lh||'',rh:t.rh||'',custom:!!t.custom});setSel(null);setAf([]);setYasna2Drill(null);};
  const tog=f=>setAf(p=>p.includes(f)?p.filter(x=>x!==f):[...p,f]);
  const togglePin=id=>setPinned(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const hl=useMemo(()=>{if(!af.length)return null;const all=new Set();af.forEach(id=>{const f=FL.find(x=>x.id===id);if(f?.p)f.p.forEach(x=>all.add(x));});return all.size?[...all]:null;},[af]);
  const pinnedTemplates=pinned.map(id=>T.find(t=>t.id===id)).filter(Boolean);
  return(
    <div style={{background:'var(--bg)',height:'100vh',display:'flex',flexDirection:'column'}}>
      <div className='hdr' style={{display:'flex',alignItems:'center',padding:'10px 20px',background:'var(--bg2)',borderBottom:'1px solid rgba(0,0,0,.06)',flexShrink:0,minHeight:56}}>
        <span style={{fontSize:20,color:'#0071e3',marginRight:6}}>✦</span>
        <span className='hdr-brand-desk' style={{fontFamily:'var(--serif)',fontSize:17,color:'#1d1d1f',fontWeight:700,marginRight:12,letterSpacing:-0.3}}>Ясна</span>
        {/* y.name удалён — он дублирует активный таб ниже */}
        <span className='hdr-title-mob' style={{display:'none',fontFamily:'var(--serif)',fontSize:20,color:'#1d1d1f',fontWeight:700,marginRight:6,letterSpacing:-0.2}}>Ясна</span>
        
        <div style={{flex:1}}/>
        <div className='hdr-btns' style={{display:'flex',gap:6,alignItems:'center'}}>
        {/* Уроки — secondary outline */}
        <button onClick={()=>setLessonPicker(true)} title='Уроки по методу Ясны' style={{border:'1px solid #d2d2d7',color:'#424245',padding:'7px 14px',borderRadius:8,fontSize:13,background:'#fff',cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:5}}>
          <span style={{fontSize:14}}>🎓</span>
          <span>Уроки</span>
        </button>
        {/* Гид по Ясне — secondary outline (если зарегистрирован для текущей Ясны) */}
        {y && window.YasnaTours && window.YasnaTours.has(y.name) && <button onClick={()=>setShowTour(true)} title='Интерактивный гид с пояснением каждой механики' style={{border:'1px solid #d2d2d7',color:'#424245',padding:'7px 14px',borderRadius:8,fontSize:13,background:'#fff',cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:5}}><span style={{fontSize:11,color:'#a21caf'}}>✦</span><span>Гид</span></button>}
        <button onClick={()=>setVerif(true)} style={{border:'1px solid #d2d2d7',color:'#424245',padding:'7px 14px',borderRadius:8,fontSize:13,background:'#fff',cursor:'pointer',fontWeight:500}}>Проверка</button>
        {/* Справка ▾ — объединяет Инструкция + Глоссарий */}
        <div style={{position:'relative'}}>
          <button onClick={()=>setHelpOpen(o=>!o)} title='Инструкция и Глоссарий' style={{border:`1px solid ${helpOpen?'rgba(0,113,227,.4)':'#d2d2d7'}`,color:helpOpen?'#0058b8':'#424245',padding:'7px 12px',borderRadius:8,fontSize:13,background:helpOpen?'rgba(0,113,227,.06)':'#fff',cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:5}}>
            <span>Справка</span>
            <span style={{fontSize:9,display:'inline-block',transform:helpOpen?'rotate(180deg)':'none',transition:'transform .2s'}}>▼</span>
          </button>
          {helpOpen && <>
            <div onClick={()=>setHelpOpen(false)} style={{position:'fixed',inset:0,zIndex:99}}/>
            <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,minWidth:160,background:'#fff',border:'1px solid #d2d2d7',borderRadius:10,boxShadow:'0 6px 24px rgba(0,0,0,.12)',zIndex:100,overflow:'hidden'}}>
              <button onClick={()=>{setInstr(true);setHelpOpen(false)}} style={{display:'block',width:'100%',padding:'10px 14px',fontSize:13,color:'#1d1d1f',border:'none',borderBottom:'1px solid #f5f5f7',background:'#fff',textAlign:'left',cursor:'pointer'}}>📖 Инструкция</button>
              <button onClick={()=>{setGlossary(true);setHelpOpen(false)}} style={{display:'block',width:'100%',padding:'10px 14px',fontSize:13,color:'#1d1d1f',border:'none',background:'#fff',textAlign:'left',cursor:'pointer'}}>📚 Глоссарий</button>
            </div>
          </>}
        </div>
        {/* Совместить — компактная иконка */}
        <button onClick={()=>overlay?setOverlay(null):setShowOverlayPicker(true)} title={overlay?'Снять совмещение':'Совместить две Ясны'} style={{border:`1px solid ${overlay?'rgba(175,82,222,.4)':'#d2d2d7'}`,color:overlay?'#af52de':'#424245',padding:'7px 11px',borderRadius:8,fontSize:15,background:overlay?'rgba(175,82,222,.06)':'#fff',cursor:'pointer',minWidth:36}}>{overlay?'⊗':'⊕'}</button>
        <button onClick={()=>setFullStar(true)} title="Во весь экран" style={{border:'1px solid #d2d2d7',color:'#424245',padding:'7px 11px',borderRadius:8,fontSize:15,background:'#fff',cursor:'pointer',minWidth:36}}>⤢</button>
        </div>
        <div className='hdr-mob-tools' style={{display:'none',gap:6,alignItems:'center',marginRight:8}}>
          <button onClick={()=>setLessonPicker(true)} title="Уроки" style={{position:'relative',fontSize:15,padding:'8px 11px',border:'1px solid rgba(0,122,255,.35)',borderRadius:10,background:'rgba(0,122,255,.06)',color:'#0071e3',whiteSpace:'nowrap',fontWeight:600,minHeight:36,display:'flex',alignItems:'center',gap:5}}>
            <span style={{fontSize:15,lineHeight:1}}>🎓</span>
            <span className="lesson-label" style={{fontSize:13,fontWeight:600}}>Уроки</span>
            <span style={{position:'absolute',top:-3,right:-3,width:8,height:8,borderRadius:'50%',background:'#E8364F',border:'1.5px solid #fff'}}/>
          </button>
          <button onClick={()=>setFiltersOpen(!filtersOpen)} title="Механики" style={{fontSize:15,padding:'8px 11px',border:`1px solid ${filtersOpen||af.length>0?'rgba(0,122,255,.35)':'#d2d2d7'}`,borderRadius:10,background:filtersOpen||af.length>0?'rgba(0,122,255,.06)':'#fff',color:filtersOpen||af.length>0?'#0071e3':'#6e6e73',whiteSpace:'nowrap',fontWeight:af.length>0?600:500,minHeight:36,display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:16,lineHeight:1}}>⊞</span>
            {af.length>0&&<span style={{fontSize:13,fontWeight:600}}>{af.length}</span>}
            <span style={{fontSize:9,display:'inline-block',transform:filtersOpen?'rotate(180deg)':'none',transition:'transform .2s',marginLeft:1}}>▼</span>
          </button>
          <button onClick={()=>setFullStar(true)} style={{fontSize:16,padding:'8px 11px',border:'1px solid #d2d2d7',borderRadius:10,background:'#fff',color:'#6e6e73',minHeight:36,minWidth:36}}>⤢</button>
        </div>
        <div className='hdr-burger' style={{position:'relative'}}>
          <button onClick={()=>setMenu(!menu)} style={{fontSize:20,padding:'6px 12px',border:'1px solid #d2d2d7',borderRadius:10,background:menu?'#f5f5f7':'#fff',color:'#424245',minHeight:36,minWidth:40}}>☰</button>
          {menu&&<div onClick={()=>setMenu(false)} style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',zIndex:79}}/>}
          {menu&&<div style={{position:'absolute',top:'100%',right:0,marginTop:4,background:'#fff',border:'1px solid #e5e5ea',borderRadius:12,boxShadow:'0 8px 30px rgba(0,0,0,.12)',zIndex:80,minWidth:200,maxWidth:'calc(100vw - 24px)',overflow:'hidden'}}>
            <button onClick={()=>{setLessonPicker(true);setMenu(false)}} style={{display:'flex',width:'100%',padding:'12px 16px',fontSize:14,color:'#0071e3',border:'none',borderBottom:'1px solid #f5f5f7',background:'linear-gradient(90deg,rgba(0,122,255,.04),transparent)',textAlign:'left',alignItems:'center',gap:8,cursor:'pointer',fontWeight:500}}>
              <span style={{fontSize:15}}>🎓</span>
              <span style={{flex:1}}>Уроки</span>
              <span style={{fontSize:10,padding:'2px 7px',background:'#0071e3',color:'#fff',borderRadius:8,fontWeight:600,letterSpacing:0.3,textTransform:'uppercase'}}>new</span>
            </button>
            <button onClick={()=>{setVerif(true);setMenu(false)}} style={{display:'block',width:'100%',padding:'12px 16px',fontSize:14,color:'#1d1d1f',border:'none',borderBottom:'1px solid #f5f5f7',background:'#fff',textAlign:'left'}}>Проверка</button>
            <button onClick={()=>{setInstr(true);setMenu(false)}} style={{display:'block',width:'100%',padding:'12px 16px',fontSize:14,color:'#1d1d1f',border:'none',borderBottom:'1px solid #f5f5f7',background:'#fff',textAlign:'left'}}>Инструкция</button>
            <button onClick={()=>{setGlossary(true);setMenu(false)}} style={{display:'block',width:'100%',padding:'12px 16px',fontSize:14,color:'#1d1d1f',border:'none',borderBottom:'1px solid #f5f5f7',background:'#fff',textAlign:'left'}}>Глоссарий</button>
            <button onClick={()=>{if(overlay){setOverlay(null)}else{setShowOverlayPicker(true)};setMenu(false)}} style={{display:'block',width:'100%',padding:'12px 16px',fontSize:14,color:overlay?'#af52de':'#1d1d1f',border:'none',borderBottom:'1px solid #f5f5f7',background:'#fff',textAlign:'left'}}>{overlay?'⊗ Снять совмещение':'⊕ Совместить ясны'}</button>
            <button onClick={()=>{setEd(!ed);setMenu(false)}} style={{display:'block',width:'100%',padding:'12px 16px',fontSize:14,color:'#1d1d1f',border:'none',borderBottom:'1px solid #f5f5f7',background:'#fff',textAlign:'left'}}>Редактировать текущую</button>
            <button onClick={()=>{setY({name:'Новая',p:Array(12).fill(''),th:'',bh:'',lh:'',rh:'',custom:true});setSel(null);setEd(true);setMenu(false);}} style={{display:'block',width:'100%',padding:'12px 16px',fontSize:14,color:'#6e6e73',border:'none',background:'#fafafa',textAlign:'left'}}>+ Создать новую Ясну</button>
          </div>}
        </div>
      </div>
      <div className='nav-tabs' style={{display:'flex',alignItems:'center',padding:'8px 0 8px 20px',background:'var(--bg2)',borderBottom:'1px solid #d2d2d7',flexShrink:0}}>
        <div style={{flex:1,display:'flex',alignItems:'center',gap:4,overflowX:'auto',minWidth:0,scrollbarWidth:'none',msOverflowStyle:'none'}} className="hide-scroll">
        {pinnedTemplates.length===0
          ?<span className="nav-empty" style={{fontSize:13,color:'#aeaeb2',padding:'6px 14px',whiteSpace:'nowrap',fontStyle:'italic'}}>Нет выбранных ясн — нажмите «+ ещё»</span>
          :pinnedTemplates.map(t=>{const active=y.name===t.n;return<button key={t.id} onClick={()=>load(t)} style={{position:'relative',padding:t.rubrik?'7px 14px 7px 18px':'7px 14px',borderRadius:16,fontSize:13,whiteSpace:'nowrap',background:active?'rgba(0,113,227,.14)':'transparent',color:active?'#0058b8':'var(--txt2)',border:active?'1.5px solid rgba(0,113,227,.55)':'1px solid transparent',flexShrink:0,fontWeight:active?700:400,cursor:'pointer',overflow:'hidden',transition:'background .15s, border-color .15s, color .15s',boxShadow:active?'0 1px 3px rgba(0,113,227,.12)':'none'}}>{t.rubrik&&<span style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:'#30A060'}} title="Проверена"/>}{t.n}</button>;})}
        </div>
        <div className='nav-right' style={{display:'flex',alignItems:'center',gap:5,paddingRight:20,paddingLeft:10,flexShrink:0,background:'var(--bg2)',borderLeft:'1px solid #e5e5ea'}}>
        {/* Только + ещё и + Создать остаются в nav-right (компактнее) */}
        <button onClick={()=>setPicker(true)} style={{padding:'6px 12px',borderRadius:16,fontSize:13,color:'#6e6e73',border:'1px dashed var(--border)',whiteSpace:'nowrap',background:'transparent',cursor:'pointer'}} title='Все доступные Ясны'><span className='desk-only'>+ ещё ({Math.max(0, T.length - pinnedTemplates.length)})</span><span className='mob-only'>☰</span></button>
        <button className='desk-only' onClick={()=>{setY({name:'Новая',p:Array(12).fill(''),th:'',bh:'',lh:'',rh:'',custom:true});setSel(null);setEd(true);}} style={{padding:'7px 16px',borderRadius:16,fontSize:13,color:'#fff',border:'none',whiteSpace:'nowrap',background:'#0071e3',cursor:'pointer',fontWeight:600,boxShadow:'0 1px 3px rgba(0,113,227,.25)'}} title='Создать новую Ясну'>+ Создать</button>
        </div>
      </div>
      <div className='filters-toggle' style={{display:'none',padding:'4px 10px',borderBottom:'1px solid #e5e5ea',flexShrink:0}}>
        <button onClick={()=>setFiltersOpen(!filtersOpen)} style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'#6e6e73',border:'none',background:'none',padding:'4px 0'}}>
          <span style={{transform:filtersOpen?'rotate(90deg)':'none',transition:'transform .2s',display:'inline-block'}}>▶</span>
          Механики{af.length>0?` (${af.length})`:''} 
        </button>
      </div>
      {/* МЕХАНИКИ — двухуровневая структура: header (toggle + active chips + toolbar) + collapsible body */}
      <div style={{display:'flex',flexDirection:'column',flexShrink:0,position:'relative',background:'var(--bg2)',borderBottom:'1px solid rgba(0,0,0,.04)'}}>
        {/* Header — always visible */}
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 20px',flexWrap:'wrap'}}>
          <button onClick={()=>setFiltersOpen(o=>!o)} title='Развернуть/свернуть список механик' style={{padding:'6px 14px',borderRadius:16,fontSize:13,whiteSpace:'nowrap',background:filtersOpen?'rgba(0,113,227,.10)':'#fff',color:filtersOpen?'#0058b8':'#424245',border:`1px solid ${filtersOpen?'rgba(0,113,227,.4)':'#d2d2d7'}`,cursor:'pointer',fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:14,lineHeight:1}}>⊞</span>
            <span>Механики</span>
            {af.length>0&&<span style={{fontSize:11,padding:'1px 7px',background:'#0071e3',color:'#fff',borderRadius:8,fontWeight:700,minWidth:18,textAlign:'center'}}>{af.length}</span>}
            <span style={{fontSize:9,display:'inline-block',transform:filtersOpen?'rotate(180deg)':'none',transition:'transform .2s'}}>▼</span>
          </button>
          {/* Active chips inline (when collapsed) */}
          {!filtersOpen && af.length>0 && af.length<FL.length && <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center',minWidth:0,flex:'1 1 auto'}}>
            {af.map(id=>{const f=FL.find(x=>x.id===id);if(!f)return null;return<button key={id} onClick={()=>tog(id)} title='Снять фильтр' style={{padding:'4px 10px',borderRadius:14,fontSize:12,whiteSpace:'nowrap',background:`${f.c}22`,color:f.c,border:`1px solid ${f.c}55`,cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:4}}>{f.l}<span style={{fontSize:10,opacity:.6}}>×</span></button>;})}
          </div>}
          {!filtersOpen && af.length===FL.length && <span style={{fontSize:12,color:'#0058b8',fontWeight:600,padding:'4px 10px',background:'rgba(0,113,227,.10)',borderRadius:14}}>Все механики ({FL.length})</span>}
          {/* Spacer (toolbar переехал в угол диаграммы — Спринт 3) */}
          {(filtersOpen || af.length===0) && <div style={{flex:1}}/>}
        </div>
        {/* Collapsible chips body */}
        {filtersOpen && <div className='filters-mobile-backdrop' onClick={()=>setFiltersOpen(false)} style={{display:'none'}}/>}
        {filtersOpen && <div className='filters filters-collapsible hide-scroll' style={{display:'flex',gap:5,padding:'4px 20px 12px',flexWrap:'wrap',alignItems:'center',animation:'slideDown .25s ease'}}>
          {af.length===FL.length?
            <button onClick={()=>setAf([])} style={{padding:'6px 14px',borderRadius:16,fontSize:13,whiteSpace:'nowrap',background:'#0071e322',color:'#0071e3',border:'1px solid #0071e355',fontWeight:600,cursor:'pointer'}}>Все</button>
            :<button onClick={()=>setAf(FL.map(f=>f.id))} style={{padding:'6px 14px',borderRadius:16,fontSize:13,whiteSpace:'nowrap',background:'transparent',color:'#86868b',border:'1px solid #d2d2d7',cursor:'pointer'}}>Все</button>
          }
          {FL.map((f,fi)=>{const a=af.includes(f.id);const prevG=fi>0?FL[fi-1].g:'';const showSep=f.g!==prevG&&fi>0;return<React.Fragment key={f.id}>{showSep&&<div className='sep' style={{width:1,height:18,background:'#d2d2d7',margin:'0 4px',flexShrink:0}}/>}<button onClick={()=>tog(f.id)} title={'Применить фильтр: '+f.l} style={{padding:'6px 14px',borderRadius:16,fontSize:13,whiteSpace:'nowrap',background:a?`${f.c}22`:'transparent',color:a?f.c:'#86868b',border:`1px solid ${a?f.c+'55':'#d2d2d7'}`,cursor:'pointer',fontWeight:a?600:400,transition:'background .15s, color .15s'}}>{f.l}</button></React.Fragment>;})}
        </div>}
      </div>
      {/* Ясна² Drill: панель управления внутренней Ясной (только когда mb_yasna2 + клик по полке) */}
      {yasna2Drill!=null&&<div className='drill-bar' style={{padding:'10px 16px',background:'linear-gradient(90deg,rgba(162,28,175,.06),rgba(162,28,175,.02))',borderBottom:'1px solid rgba(162,28,175,.25)',display:'flex',gap:8,alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
        <button onClick={()=>{setYasna2Drill(null);setDrillEditing(false);}} style={{padding:'6px 14px',borderRadius:9,border:'1px solid #a21caf',background:'#fff',color:'#a21caf',fontWeight:600,fontSize:12.5,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>← Назад</button>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,color:'#581c87',minWidth:0,flex:'1 1 auto'}}>
          <span style={{color:'#86868b',whiteSpace:'nowrap'}}>{y.name}</span>
          <span style={{color:'#a21caf'}}>→</span>
          <span style={{fontWeight:700,whiteSpace:'nowrap'}}>Полка {yasna2Drill}</span>
          {y.p[yasna2Drill]&&<span style={{color:'#581c87',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>: {y.p[yasna2Drill]}</span>}
        </div>
        <select value="" onChange={e=>{const tpl=T.find(t=>t.id===e.target.value);if(tpl){setSubPolkiAll(y.name,yasna2Drill,tpl.p);}e.target.value="";}} style={{padding:'6px 10px',fontSize:12.5,border:'1px solid #a21caf',borderRadius:9,background:'#fff',color:'#581c87',cursor:'pointer',fontWeight:500}}>
          <option value="">📥 Импорт из шаблона…</option>
          {T.filter(t=>t.p&&t.p.length===12).map(t=><option key={t.id} value={t.id}>{t.n}</option>)}
        </select>
        <button onClick={()=>{if(confirm('Очистить sub-полки этой Полки?'))clearSub(y.name,yasna2Drill);}} title="Очистить" style={{padding:'6px 10px',borderRadius:9,border:'1px solid #d2d2d7',background:'#fff',cursor:'pointer',fontSize:13}}>🧹 Очистить</button>
        <button onClick={()=>setDrillEditing(v=>!v)} style={{padding:'6px 14px',borderRadius:9,border:`1px solid ${drillEditing?'#a21caf':'#a21caf66'}`,background:drillEditing?'#a21caf':'#fff',color:drillEditing?'#fff':'#a21caf',fontWeight:600,fontSize:12.5,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>{drillEditing?'✓ Готово':'✏️ Редактировать'}</button>
      </div>}
      {/* app-body: flex row с workspace и side-panel — Решение 1+3 */}
      <div className={'app-body'+(sel!==null?' app-body-with-panel':'')} style={{display:'flex',flex:1,minHeight:0,position:'relative'}}>
        <div className='workspace' style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,position:'relative'}}>
            <div className={'star-area'+(starRotation?' star-rotating-'+starRotation:'')+(is3D?' star-3d-active':'')} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden','--rotation-speed':rotationSpeed+'s'}} onClick={e=>{if(e.target===e.currentTarget)setSel(null)}}>
        <button className='fullstar-btn' onClick={()=>setFullStar(true)} style={{display:'none',position:'absolute',top:8,right:8,width:32,height:32,borderRadius:8,border:'1px solid #e5e5ea',background:'rgba(255,255,255,.8)',fontSize:16,zIndex:5,alignItems:'center',justifyContent:'center'}}>⤢</button>
        {/* Floating mini-toolbar в углу диаграммы (Спринт 3) */}
        <div className='diag-corner-toolbar' style={{position:'absolute',top:10,right:10,display:'flex',gap:4,zIndex:6,background:'rgba(255,255,255,.94)',backdropFilter:'blur(8px)',border:'1px solid #e5e5ea',borderRadius:12,padding:'4px 5px',boxShadow:'0 2px 10px rgba(0,0,0,.06)'}}>
          <button disabled={yasna2Drill!=null} onClick={()=>setStarRotation(r=>r==='ccw'?null:'ccw')} title={yasna2Drill!=null?'Недоступно при открытой sub-Ясне':(starRotation==='ccw'?'Остановить вращение':'Вращать против часовой')} style={{width:30,height:30,borderRadius:8,border:'1px solid '+(starRotation==='ccw'?'#a21caf':'#e5e5ea'),background:starRotation==='ccw'?'#a21caf':'#fff',color:starRotation==='ccw'?'#fff':'#86868b',fontSize:15,cursor:yasna2Drill!=null?'not-allowed':'pointer',opacity:yasna2Drill!=null?.4:1,display:'flex',alignItems:'center',justifyContent:'center'}}>↺</button>
          <button disabled={yasna2Drill!=null} onClick={()=>setStarRotation(r=>r==='cw'?null:'cw')} title={yasna2Drill!=null?'Недоступно при открытой sub-Ясне':(starRotation==='cw'?'Остановить вращение':'Вращать по часовой')} style={{width:30,height:30,borderRadius:8,border:'1px solid '+(starRotation==='cw'?'#a21caf':'#e5e5ea'),background:starRotation==='cw'?'#a21caf':'#fff',color:starRotation==='cw'?'#fff':'#86868b',fontSize:15,cursor:yasna2Drill!=null?'not-allowed':'pointer',opacity:yasna2Drill!=null?.4:1,display:'flex',alignItems:'center',justifyContent:'center'}}>↻</button>
          <button onClick={()=>setIs3D(v=>!v)} title={is3D?'Плоская проекция':'Объёмный режим (3D)'} style={{width:30,height:30,borderRadius:8,border:'1px solid '+(is3D?'#a21caf':'#e5e5ea'),background:is3D?'#a21caf':'#fff',color:is3D?'#fff':'#86868b',fontSize:10.5,fontWeight:700,letterSpacing:.5,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>3D</button>
          <button onClick={()=>setRotPanelOpen(o=>!o)} title='Скорость вращения и режимы' style={{width:30,height:30,borderRadius:8,border:'1px solid '+(rotPanelOpen?'#a21caf':'#e5e5ea'),background:rotPanelOpen?'#a21caf':'#fff',color:rotPanelOpen?'#fff':'#86868b',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>⋯</button>
        </div>
        {rotPanelOpen && <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:50,right:10,width:240,zIndex:7,background:'#fff',border:'1px solid #d2d2d7',borderRadius:12,boxShadow:'0 6px 24px rgba(0,0,0,.12)',padding:'12px 14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontWeight:600,fontSize:11,color:'#581c87',letterSpacing:.5,textTransform:'uppercase'}}>Скорость</span>
            <span style={{color:'#a21caf',fontWeight:700,fontVariantNumeric:'tabular-nums',fontSize:12}}>{rotationSpeed}s/оборот</span>
          </div>
          <input type='range' min='5' max='120' value={rotationSpeed} onChange={e=>setRotationSpeed(+e.target.value)} style={{width:'100%'}}/>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:9.5,color:'#86868b',marginTop:-2,marginBottom:8}}>
            <span>быстро</span><span>медитативно</span>
          </div>
          <div style={{fontWeight:600,fontSize:11,color:'#581c87',letterSpacing:.5,textTransform:'uppercase',marginBottom:6}}>Один оборот</div>
          <div style={{display:'flex',gap:6}}>
            <button disabled={yasna2Drill!=null||starRotation!==null} onClick={()=>impulseRotation('ccw')} style={{flex:1,padding:'7px',borderRadius:8,border:'1px solid #e5e5ea',background:'#fff',color:'#581c87',fontSize:11.5,cursor:'pointer'}}>⟲ Против</button>
            <button disabled={yasna2Drill!=null||starRotation!==null} onClick={()=>impulseRotation('cw')} style={{flex:1,padding:'7px',borderRadius:8,border:'1px solid #e5e5ea',background:'#fff',color:'#581c87',fontSize:11.5,cursor:'pointer'}}>⟳ По часовой</button>
          </div>
          {is3D && <div style={{marginTop:10,padding:'7px 9px',background:'rgba(162,28,175,.08)',borderRadius:8,fontSize:10.5,color:'#581c87',lineHeight:1.45}}>
            <b style={{color:'#a21caf'}}>3D режим.</b> Drag — вращение, колесо — zoom, клик по шару — выбор.
          </div>}
        </div>}
        <div className="star-svg-wrap" style={{width:'100%',height:'100%',maxWidth:1100,maxHeight:"78vh"}}>{is3D ? <Yasna3DView y={y} af={af} sel={sel} onSel={setSel} rotationOn={starRotation} speedSec={rotationSpeed} drill={yasna2Drill} onDrill={setYasna2Drill} subPolki={yasna2Drill!=null?getSubPolki(y.name,yasna2Drill):null}/> : <Star yy={y} sel={sel} onSel={setSel} hl={hl} af={af} showOpp={af.includes('opp')} overlay={overlay} mob={typeof window!=='undefined'&&window.innerWidth<=768} drill={yasna2Drill} onDrill={setYasna2Drill} subPolki={yasna2Drill!=null?getSubPolki(y.name,yasna2Drill):null} starRotation={starRotation} rotationSpeed={rotationSpeed}/>}</div>
        <OverlayLegend y={y} overlay={overlay} onClear={()=>setOverlay(null)}/>
            </div>
        </div>
        {/* side-panel: flex-сосед workspace на десктопе, overlay на планшете, скрыт на мобильном (там bottom-sheet) */}
        {sel!==null && <aside className='side-panel' aria-label='Карточка полки'>
          <Info i={sel} p={y.p} af={af} y={y} overlay={overlay} onEdit={()=>setEd(true)} onClose={()=>setSel(null)}/>
        </aside>}
      </div>
      {/* Ясна² Drill Editor: bottom-panel с 12 inputs для sub-полок */}
      {yasna2Drill!=null&&drillEditing&&<div style={{flexShrink:0,padding:'14px 18px',background:'linear-gradient(180deg,rgba(162,28,175,.04),rgba(162,28,175,.08))',borderTop:'1px solid rgba(162,28,175,.25)',maxHeight:'40vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <div style={{fontSize:10,color:'#a21caf',fontWeight:700,letterSpacing:1.5,textTransform:'uppercase'}}>Sub-Полки внутренней Ясны Полки {yasna2Drill}</div>
          <div style={{fontSize:11,color:'#86868b'}}>· сохраняется автоматически</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:8}}>
          {Array.from({length:12},(_,j)=>{const v=getSubPolki(y.name,yasna2Drill)[j]||'';return(
            <div key={j} style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{width:24,height:24,borderRadius:'50%',border:'1.5px solid #a21caf',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#a21caf',flexShrink:0,background:'#fff'}}>{j}</span>
              <input value={v} onChange={e=>setSubPolkaAt(y.name,yasna2Drill,j,e.target.value)} placeholder="название sub-полки" style={{flex:1,padding:'6px 10px',border:'1px solid #d2d2d7',borderRadius:7,fontSize:12.5,fontFamily:'inherit',outline:'none',background:'#fff'}} onFocus={e=>{e.target.style.borderColor='#a21caf';e.target.style.boxShadow='0 0 0 3px rgba(162,28,175,.1)'}} onBlur={e=>{e.target.style.borderColor='#d2d2d7';e.target.style.boxShadow='none'}}/>
            </div>
          );})}
        </div>
      </div>}
      {fullStar&&<>
        <div className={'fullstar'+(starRotation?' star-rotating-'+starRotation:'')+(is3D?' star-3d-active':'')} style={{display:'flex',alignItems:'center',justifyContent:'center','--rotation-speed':rotationSpeed+'s'}}>
          <div style={{width:'100%',height:'100%',maxWidth:'100vw',maxHeight:'100vh'}}>{is3D ? <Yasna3DView y={y} af={af} sel={sel} onSel={setSel} rotationOn={starRotation} speedSec={rotationSpeed} drill={yasna2Drill} onDrill={setYasna2Drill} subPolki={yasna2Drill!=null?getSubPolki(y.name,yasna2Drill):null}/> : <Star yy={y} sel={sel} onSel={setSel} hl={hl} af={af} showOpp={af.includes('opp')} overlay={overlay} mob={typeof window!=='undefined'&&window.innerWidth<=768} drill={yasna2Drill} onDrill={setYasna2Drill} subPolki={yasna2Drill!=null?getSubPolki(y.name,yasna2Drill):null} starRotation={starRotation} rotationSpeed={rotationSpeed}/>}</div>
        </div>
        <button className='fullstar-close' onClick={()=>setFullStar(false)}>✕</button>
      </>}
      {ed&&<Editor y={y} setY={setY} onClose={()=>setEd(false)}/>}
      {showOverlayPicker&&<OverlayPicker currentName={y.name} overlay={overlay} onSelect={setOverlay} onClose={()=>setShowOverlayPicker(false)}/>}
      {verif&&<Verification y={y} vs={vState} setVs={setVState} onClose={()=>setVerif(false)}/>}
      {instr&&<Instruction onClose={()=>setInstr(false)}/>}
      {lessonPicker&&<LessonPicker onSelectLesson={(id)=>{setActiveLesson(id);setLessonPicker(false);}} onClose={()=>setLessonPicker(false)} completedLessons={completedLessons}/>}
      {showTour&&window.YasnaTours&&window.YasnaTours.has(y.name)&&(()=>{
        const tour=window.YasnaTours.get(y.name);
        const tpl=T.find(t=>t.n===y.name);
        // Авто-загрузка шаблона: если текущая Ясна — кастомная или другая, грузим эталон тура
        if(tpl && y.name===tpl.n && (!y.p || y.p.length!==12 || !y.p[0])){
          load(tpl);
        }
        return React.createElement(window.YasnaTours.GuideRunner,{tour,yasnaTpl:tpl,onClose:()=>setShowTour(false),onLoadYasna:()=>{if(tpl)load(tpl);}});
      })()}
      {activeLesson&&<Lesson lessonId={activeLesson} onClose={()=>setActiveLesson(null)} onComplete={(id)=>setCompletedLessons(prev=>prev.includes(id)?prev:[...prev,id])} onPickAnother={()=>{setActiveLesson(null);setLessonPicker(true);}} onOpenLesson={(id)=>setActiveLesson(id)}/>}
      {glossary&&<Glossary onClose={()=>setGlossary(false)}/>}
      {picker&&<Picker pinned={pinned} onTogglePin={togglePin} onClear={()=>setPinned([])} onClose={()=>setPicker(false)}/>}
    </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));

