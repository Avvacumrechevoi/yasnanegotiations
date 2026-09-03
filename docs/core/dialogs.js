// ═══════════════════════════════════════════════════════════════════
// DIALOGS — Editor + Picker + OverlayPicker + OverlayLegend
// Extracted from core/yasna-star.js (Layer 2 components).
// Зависимости: window.YasnaData (CR, REF, T, GLOSS, gc).
// Экспорт: window.YasnaDialogs { Editor, Picker, OverlayPicker, OverlayLegend }.
// ═══════════════════════════════════════════════════════════════════

/* ═══════════════════════════════════════════════════════════════════
   ОКНА — Dialog · Snackbar · Banner · EmptyState.
   Экспорт: window.YasnaOkna { спросить, тост, полоса, пусто, значок }.

   ЗАЧЕМ. Этих четырёх вещей в приложении не было вовсе. На вопрос
   «удалить ясну?» отвечал системный confirm: «OK» и «Cancel»
   по-английски и одинаково на любой вопрос — человек читает «OK» и
   заново гадает, что он сейчас нажмёт. Сообщение о сделанном
   существовало ровно одно и только в Книге. Полосу-сообщение и пустой
   список каждый экран рисовал заново.

   ПОЧЕМУ ЗДЕСЬ. В этом файле уже живут попапы Разбора, и он попадает
   в оба бандла (app.min.js и duel.min.js) — то есть на те экраны, где
   вопросы и сообщения нужны первыми. Помощник написан на голом JS и
   стоит ОТДЕЛЬНОЙ обёрткой выше React-части: если React или
   window.YasnaData не поднялись, окна всё равно работают.

   ГЛАГОЛЫ НА КНОПКАХ. Договор тот же, что у вопроса в Круге
   (docs/games/krug/krug.js): {заголовок, текст, да, нет, наДа} —
   на кнопках стоят глаголы того действия, о котором спрашивают, отказ
   слева и держит фокус, закрытие без ответа считается отказом. Круг
   пока держит свою копию: его страница не грузит бандл. Когда общий
   помощник будет подключён и там, копию из krug.js можно снять.
   ═══════════════════════════════════════════════════════════════════ */

(function(){
if (window.YasnaOkna) return;

const экр = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const узел = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };

/* Значок — один набор из komponenty.css: сетка 24, обводка 2,
   currentColor. Юникод-глифы в роли значков сюда не возвращаются. */
const значок = (имя, доп) => '<span class="ya-ik ya-ik--' + имя + (доп ? ' ' + доп : '') + '"></span>';

/* Стили компонентов лежат в core/komponenty.css. Пока строка подключения не
   проставлена на страницах руками, дописываем её сами — адрес берём у уже
   подключённого core/tokeny.css, иначе на вложенной странице путь не сойдётся.
   Когда подключение появится в разметке, эта проверка ничего не делает. */
function стили(){
  if (document.querySelector('link[href*="core/komponenty.css"]')) return;
  let адрес = 'core/komponenty.css';
  const ссылки = document.querySelectorAll('link[rel="stylesheet"]');
  for (let i = 0; i < ссылки.length; i++) {
    const h = ссылки[i].getAttribute('href') || '';
    if (/core\/tokeny\.css/.test(h)) { адрес = h.replace(/tokeny\.css.*$/, 'komponenty.css'); break; }
  }
  const л = document.createElement('link');
  л.rel = 'stylesheet'; л.href = адрес;
  (document.head || document.documentElement).appendChild(л);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', стили);
else стили();

/* ─── ВОПРОС (Dialog) ─────────────────────────────────────────────── */
let ВОПРОС = null;

function закрытьВопрос(){
  if (!ВОПРОС) return;
  const в = ВОПРОС; ВОПРОС = null;
  window.removeEventListener('yasna:назад', в.назад);
  document.removeEventListener('keydown', в.клавиша, true);
  if (в.корень && в.корень.parentNode) в.корень.parentNode.removeChild(в.корень);
  try { if (в.фокус && в.фокус.focus) в.фокус.focus(); } catch(_){}
  if (в.наНет && !в.отвечено) в.наНет();
}

/* о: {заголовок, текст, да:'Удалить', нет:'Оставить', наДа, наНет, опасно} */
function спросить(о){
  if (ВОПРОС) return;              /* два вопроса разом — это уже не вопрос */
  стили();
  const корень = узел(
    '<div class="ya-dialog"><div class="ya-dialog__karta" role="dialog" aria-modal="true"' +
      ' aria-labelledby="ya-dialog-zag" aria-describedby="ya-dialog-txt">' +
      '<h2 class="ya-dialog__zag" id="ya-dialog-zag">' + экр(о.заголовок) + '</h2>' +
      '<p class="ya-dialog__txt" id="ya-dialog-txt">' + экр(о.текст || '') + '</p>' +
      '<div class="ya-dialog__ryad">' +
        '<button class="ya-btn ya-btn--text" type="button" data-ya="нет">' + экр(о.нет || 'Отменить') + '</button>' +
        '<button class="ya-btn ya-btn--text' + (о.опасно ? ' ya-btn--opasno' : '') +
          '" type="button" data-ya="да">' + экр(о.да || 'Продолжить') + '</button>' +
      '</div></div></div>');
  const состояние = { корень: корень, фокус: document.activeElement, наНет: о.наНет, отвечено: false };
  корень.querySelector('[data-ya="да"]').onclick = () => {
    состояние.отвечено = true; закрытьВопрос(); if (о.наДа) о.наДа();
  };
  корень.querySelector('[data-ya="нет"]').onclick = закрытьВопрос;
  корень.addEventListener('click', (e) => { if (e.target === корень) закрытьВопрос(); });
  состояние.клавиша = (e) => { if (e.key === 'Escape') { e.preventDefault(); закрытьВопрос(); } };
  /* Пока висит вопрос, «назад» отвечает на него, а не уводит с экрана. */
  состояние.назад = (e) => { e.preventDefault(); закрытьВопрос(); };
  document.addEventListener('keydown', состояние.клавиша, true);
  window.addEventListener('yasna:назад', состояние.назад);
  ВОПРОС = состояние;
  document.body.appendChild(корень);
  try { корень.querySelector('[data-ya="нет"]').focus(); } catch(_){}
}

/* ─── СООБЩЕНИЕ О СДЕЛАННОМ (Snackbar) ───────────────────────────── */
let ТОСТ = null;

function убратьТост(){
  if (!ТОСТ) return;
  const т = ТОСТ; ТОСТ = null;
  clearTimeout(т.часы);
  т.корень.classList.add('ya-snack--uhodit');
  setTimeout(() => { if (т.корень.parentNode) т.корень.parentNode.removeChild(т.корень); }, 320);
}

/* тост('Скопировано') · тост('Ясна убрана', {действие:'Вернуть', приДействии:fn}) */
function тост(текст, о){
  о = о || {};
  стили();
  убратьТост();
  const корень = узел(
    '<div class="ya-snack" role="status" aria-live="polite">' +
      '<span class="ya-snack__txt">' + экр(текст) + '</span>' +
      (о.действие ? '<button class="ya-btn ya-btn--text" type="button" data-ya="действие">' + экр(о.действие) + '</button>' : '') +
    '</div>');
  if (о.действие) корень.querySelector('[data-ya="действие"]').onclick = () => {
    убратьТост(); if (о.приДействии) о.приДействии();
  };
  document.body.appendChild(корень);
  ТОСТ = { корень: корень, часы: setTimeout(убратьТост, (о.секунд || 4) * 1000) };
  return корень;
}

/* ─── ПОЛОСА-СООБЩЕНИЕ (Banner) ──────────────────────────────────────
   Возвращает узел — куда его поставить, решает экран.
   о: {заголовок, текст, знак:'info', вид:'внимание', действия:[{подпись,при}], приЗакрытии} */
function полоса(о){
  стили();
  о = о || {};
  const действия = (о.действия || []).map((д, i) =>
    '<button class="ya-btn ya-btn--text" type="button" data-ya="д' + i + '">' + экр(д.подпись) + '</button>').join('');
  const корень = узел(
    '<div class="ya-banner' + (о.вид === 'внимание' ? ' ya-banner--vnimanie' : '') + '">' +
      значок(о.знак || 'info', 'ya-banner__znak') +
      '<div class="ya-banner__telo">' +
        (о.заголовок ? '<p class="ya-banner__zag">' + экр(о.заголовок) + '</p>' : '') +
        (о.текст ? '<p class="ya-banner__txt">' + экр(о.текст) + '</p>' : '') +
        (действия ? '<div class="ya-banner__ryad">' + действия + '</div>' : '') +
      '</div>' +
      (о.приЗакрытии ? '<button class="ya-ib" type="button" data-ya="закрыть" aria-label="Закрыть">' + значок('zakryt') + '</button>' : '') +
    '</div>');
  (о.действия || []).forEach((д, i) => {
    const к = корень.querySelector('[data-ya="д' + i + '"]');
    if (к) к.onclick = д.при;
  });
  const кз = корень.querySelector('[data-ya="закрыть"]');
  if (кз) кз.onclick = () => { корень.remove(); о.приЗакрытии(); };
  return корень;
}

/* ─── ПУСТОЕ СОСТОЯНИЕ (EmptyState) ──────────────────────────────────
   Слова остаются те же, что были абзацем на экране, — меняется оправа.
   о: {заголовок, текст, знак, действие:{подпись, при}} */
function пусто(о){
  стили();
  о = о || {};
  const корень = узел(
    '<div class="ya-empty">' +
      значок(о.знак || 'pusto', 'ya-ik--48 ya-empty__znak') +
      (о.заголовок ? '<p class="ya-empty__zag">' + экр(о.заголовок) + '</p>' : '') +
      (о.текст ? '<p class="ya-empty__txt">' + экр(о.текст) + '</p>' : '') +
      (о.действие ? '<button class="ya-btn ya-btn--tonal" type="button" data-ya="действие">' + экр(о.действие.подпись) + '</button>' : '') +
    '</div>');
  if (о.действие) корень.querySelector('[data-ya="действие"]').onclick = о.действие.при;
  return корень;
}

window.YasnaOkna = { спросить, тост, полоса, пусто, значок, закрытьВопрос, убратьТост };

})();

(function(){

const { useState, useMemo } = React;
const { CR, REF, T, GLOSS, gc } = window.YasnaData;

function OverlayLegend({y,overlay,onClear}){
  if(!overlay)return null;
  return(
    <div className="overlay-legend" style={{position:'absolute',top:50,right:12,background:'var(--vk-bg-elevated,rgba(255,255,255,.95))',border:'1px solid var(--vk-border,rgba(0,0,0,.06))',borderRadius:12,padding:'10px 14px',backdropFilter:'blur(16px)',minWidth:180,zIndex:10}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontSize:10,color:'#6e6e73',textTransform:'uppercase',letterSpacing:1}}>Совмещение</span>
        {/* Глиф «✕» рисовался системным шрифтом и не красился ролью; цель была 14px. */}
        <button onClick={onClear} className="ya-ib" type="button" aria-label="Убрать совмещение"
          style={{color:'var(--on-surface-variant)'}}><span className="ya-ik ya-ik--zakryt ya-ik--18"/></button>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
        <div style={{width:12,height:3,borderRadius:2,background:'rgba(0,122,255,.6)'}}/>
        <span style={{fontSize:11,color:'var(--vk-text-primary,#1d1d1f)'}}>{y.name}</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <div style={{width:12,height:3,borderRadius:2,background:'rgba(175,82,222,.5)'}}/>
        <span style={{fontSize:11,color:'#af52de',fontStyle:'italic'}}>{overlay.name||overlay.n}</span>
      </div>
    </div>);
}

function Editor({y,setY,onClose,мест}){
  /* «Заполнить место N» из карточки открывало редактор на первом поле, и
     человек искал нужную строку глазами. Ставим на неё фокус и подводим
     панель к ней. */
  const полеРеф=React.useRef(null);
  React.useEffect(()=>{
    if(мест==null) return;
    const t=setTimeout(()=>{
      const э=полеРеф.current;
      if(!э) return;
      try{ э.scrollIntoView({block:'center'}); э.focus({preventScroll:true}); }catch(_){ }
    },60);
    return()=>clearTimeout(t);
  },[мест]);
  return(
    <div className='editor-panel' style={{position:'fixed',top:0,right:0,width:370,height:'100vh',background:'var(--vk-bg-surface,rgba(255,255,255,.98))',borderLeft:'1px solid var(--vk-border,rgba(0,0,0,.08))',zIndex:50,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <h3 style={{fontFamily:'var(--serif)',fontSize:18,color:'var(--vk-text-primary,#1d1d1f)',fontWeight:600}}>Редактор</h3>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:11,color:'#34c759',fontWeight:500,letterSpacing:.3}}>● автосохранение</span>
          {/* Выход был один — кнопка в самом низу панели, а на телефоне низ
              закрыт наббаром: закрыть редактор было нечем. Крестик 44×44. */}
          <button onClick={onClose} aria-label='Закрыть редактор' title='Закрыть'
            className="ya-ib" type="button" style={{color:'var(--on-surface-variant)'}}><span className="ya-ik ya-ik--zakryt ya-ik--18"/></button>
        </div>
      </div>
      <div style={{padding:'12px 18px',overflowY:'auto',flex:1}}>
        <input value={y.name} onChange={e=>setY({...y,name:e.target.value})} placeholder="Название"
          style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--vk-text-primary,#1d1d1f)',padding:'9px 12px',borderRadius:7,fontFamily:'var(--serif)',fontSize:17,fontWeight:700,marginBottom:10,outline:'none'}}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:14}}>
          {[['th','Верх'],['bh','Низ'],['lh','Лево'],['rh','Право']].map(([k,ph])=>
            <input key={k} placeholder={ph} value={y[k]||''} onChange={e=>setY({...y,[k]:e.target.value})}
              style={{background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--txt)',padding:'5px 8px',borderRadius:5,fontSize:10,outline:'none'}}/>
          )}
        </div>
        {y.p.map((l,i)=>{const c=CR[gc(i)].c;return(
          <div key={i} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
            <div style={{width:26,height:26,borderRadius:'50%',border:`2px solid ${c}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:c,flexShrink:0}}>{i}</div>
            <input ref={i===мест?полеРеф:null} value={l} onChange={e=>{const np=[...y.p];np[i]=e.target.value;setY({...y,p:np});}} placeholder={(REF[i]||{}).f||''}
              style={{flex:1,background:'var(--bg)',border:i===мест?`1px solid ${c}`:'1px solid var(--border)',boxShadow:i===мест?`0 0 0 3px ${c}22`:'none',color:'var(--vk-text-primary,#1d1d1f)',padding:'7px 10px',borderRadius:5,fontSize:12,outline:'none'}}
              onFocus={e=>e.target.style.borderColor=c} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          </div>);})}
      </div>
      <div style={{padding:'12px 18px',borderTop:'1px solid var(--border)',display:'flex',gap:8,flexShrink:0,background:'var(--vk-bg-elevated,#fafafa)'}}>
        <button onClick={onClose} type="button" className="ya-btn ya-btn--filled" style={{flex:1}}><span className="ya-ik ya-ik--galochka ya-ik--18"/>Сохранить и закрыть</button>
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
      {active&&<span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'#af52de',display:'flex'}}><span className="ya-ik ya-ik--galochka ya-ik--18"/></span>}
    </button>);};

  const Section=({title,items})=>items.length===0?null:(
    <div style={{marginBottom:18}}>
      <div style={{fontSize:11,fontWeight:600,color:'#6e6e73',textTransform:'uppercase',letterSpacing:1,marginBottom:8,paddingLeft:4}}>{title} <span style={{color:'#aeaeb2',fontWeight:400}}>· {items.length}</span></div>
      <div className='picker-grid' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {items.map(t=><Card key={t.id} t={t}/>)}
      </div>
    </div>);

  return(
    <div className="popup-overlay" style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(0,0,0,.25)',zIndex:130,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}} onClick={onClose}>
      <div className='picker-inner' style={{background:'rgba(255,255,255,.99)',border:'1px solid rgba(175,82,222,.15)',borderRadius:20,boxShadow:'0 20px 60px rgba(0,0,0,.15)',padding:0,width:'100%',maxWidth:600,height:'82vh',maxHeight:720,display:'flex',flexDirection:'column',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        {/* HEADER */}
        <div style={{padding:'18px 22px 14px',borderBottom:'1px solid #f0f0f2',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div style={{flex:1,minWidth:0,paddingRight:10}}>
              <h3 style={{fontFamily:'var(--serif)',fontSize:20,color:'#af52de',fontWeight:700,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Совместить «{currentName}» с…</h3>
              <div style={{fontSize:12,color:'#86868b'}}>Выберите вторую Ясну — её подписи появятся вторым кольцом вокруг.</div>
            </div>
            <button onClick={onClose} className="ya-ib" type="button" aria-label="Закрыть"
              style={{color:'var(--on-surface-variant)',flexShrink:0}}><span className="ya-ik ya-ik--zakryt ya-ik--18"/></button>
          </div>
          {/* SEARCH */}
          <div style={{position:'relative'}}>
            <span className="ya-ik ya-ik--poisk ya-ik--18" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--on-surface-variant)',pointerEvents:'none'}}/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск по названию..."
              style={{width:'100%',padding:'9px 14px 9px 36px',borderRadius:10,border:'1px solid #d2d2d7',fontSize:16,fontFamily:'var(--sans)',outline:'none',background:'#fff',color:'#1d1d1f',boxSizing:'border-box'}}
              onFocus={e=>e.target.style.borderColor='#af52de'}
              onBlur={e=>e.target.style.borderColor='#d2d2d7'}/>
            {q&&<button onClick={()=>setQ('')} className="ya-ib" type="button" aria-label="Очистить поиск"
              style={{position:'absolute',right:0,top:'50%',transform:'translateY(-50%)',color:'var(--on-surface-variant)'}}><span className="ya-ik ya-ik--zakryt ya-ik--18"/></button>}
          </div>
        </div>
        {/* LIST */}
        <div style={{flex:1,overflowY:'auto',padding:'14px 22px 18px'}}>
          {filtered.length===0?
            <div className="ya-empty">
              <span className="ya-ik ya-ik--poisk ya-ik--48 ya-empty__znak"/>
              <p className="ya-empty__zag">Ничего не найдено по запросу «{q}»</p>
            </div>
            :<>
              <Section title="Проверенные" items={rubrikList}/>
              <Section title="Встречи (кастомные)" items={customList}/>
              <Section title="Прочие" items={otherList}/>
            </>}
        </div>
      </div>
    </div>);
}

function Picker({pinned,onTogglePin,onClear,onClose,customs=[],onOpenCustom,onDeleteCustom}){
  const[q,setQ]=useState('');
  const filtered=T.filter(t=>t.n.toLowerCase().includes(q.toLowerCase()));
  const myList=customs.filter(c=>((c.n||c.name)||'').toLowerCase().includes(q.toLowerCase()));
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
      {active&&<span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'#0071e3',display:'flex'}}><span className="ya-ik ya-ik--galochka ya-ik--18"/></span>}
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
    <div className="popup-overlay" style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(0,0,0,.25)',zIndex:130,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}} onClick={onClose}>
      <div className='picker-inner' style={{background:'rgba(255,255,255,.99)',border:'1px solid rgba(0,0,0,.08)',borderRadius:20,boxShadow:'0 20px 60px rgba(0,0,0,.15)',padding:0,width:'100%',maxWidth:600,height:'82vh',maxHeight:720,display:'flex',flexDirection:'column',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        {/* HEADER */}
        <div style={{padding:'18px 22px 14px',borderBottom:'1px solid #f0f0f2',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div>
              <h3 style={{fontFamily:'var(--serif)',fontSize:20,color:'#1d1d1f',fontWeight:700,marginBottom:2}}>Готовые круги</h3>
              <div style={{fontSize:12,color:'#86868b'}}>Выбрано <b style={{color:'#0071e3'}}>{pinnedCount}</b> из {total} · показываются во вкладках</div>
            </div>
            <button onClick={onClose} className="ya-ib" type="button" aria-label="Закрыть"
              style={{color:'var(--on-surface-variant)',flexShrink:0}}><span className="ya-ik ya-ik--zakryt ya-ik--18"/></button>
          </div>
          {/* SEARCH */}
          <div style={{position:'relative',marginBottom:10}}>
            <span className="ya-ik ya-ik--poisk ya-ik--18" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--on-surface-variant)',pointerEvents:'none'}}/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск по названию..."
              style={{width:'100%',padding:'9px 14px 9px 36px',borderRadius:10,border:'1px solid #d2d2d7',fontSize:16,fontFamily:'var(--sans)',outline:'none',background:'#fff',color:'#1d1d1f'}}
              onFocus={e=>e.target.style.borderColor='#0071e3'}
              onBlur={e=>e.target.style.borderColor='#d2d2d7'}/>
            {q&&<button onClick={()=>setQ('')} className="ya-ib" type="button" aria-label="Очистить поиск"
              style={{position:'absolute',right:0,top:'50%',transform:'translateY(-50%)',color:'var(--on-surface-variant)'}}><span className="ya-ik ya-ik--zakryt ya-ik--18"/></button>}
          </div>
          {/* ACTIONS */}
          <div className="picker-actions" style={{display:'flex',gap:6,alignItems:'center'}}>
            {pinnedCount===total?
              <button onClick={onClear} type="button" style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'rgba(0,122,255,.08)',cursor:'pointer',fontWeight:600}}><span className="ya-ik ya-ik--galochka ya-ik--18"/>Все выбраны — снять</button>
              :<button onClick={()=>{T.forEach(t=>{if(!pinned.includes(t.id))onTogglePin(t.id);});}} type="button" style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'transparent',cursor:'pointer'}}><span className="ya-ik ya-ik--galochka ya-ik--18"/>Выбрать все</button>}
            {(()=>{const starterIds=T.filter(t=>t.starter).map(t=>t.id);const allStarterSelected=starterIds.every(id=>pinned.includes(id));return allStarterSelected?
              <button onClick={()=>{starterIds.forEach(id=>{if(pinned.includes(id))onTogglePin(id);});}} type="button" style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'rgba(0,122,255,.08)',cursor:'pointer',fontWeight:600}}><span className="ya-ik ya-ik--zvezda ya-ik--18"/>Стартовые — снять</button>
              :<button onClick={()=>{starterIds.forEach(id=>{if(!pinned.includes(id))onTogglePin(id);});}} type="button" style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'transparent',cursor:'pointer'}}><span className="ya-ik ya-ik--zvezda ya-ik--18"/>Только стартовые</button>;})()}
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
          {/* МОИ ЯСНЫ — пользовательские, из localStorage (yasna_custom_v1) */}
          {myList.length>0&&(
            <div style={{marginBottom:18}} data-testid="my-yasnas">
              <div style={{marginBottom:8,paddingLeft:4}}>
                <div style={{fontSize:11,fontWeight:600,color:'#6e6e73',textTransform:'uppercase',letterSpacing:1}}>Мои Ясны <span style={{color:'#aeaeb2',fontWeight:400}}>· {myList.length}</span></div>
                <div style={{fontSize:11,color:'#aeaeb2',marginTop:2}}>Созданные вами · хранятся в этом браузере · клик — открыть</div>
              </div>
              <div className='picker-grid' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {myList.map(c=>{const active=pinned.includes(c.id);const nm=c.n||c.name;return(
                  <div key={c.id} style={{position:'relative',display:'flex',alignItems:'center',background:active?'#e6f0fa':'#f5f5f7',borderRadius:10,border:`1px solid ${active?'rgba(0,122,255,.4)':'transparent'}`,overflow:'hidden'}}>
                    <span style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:'#af52de'}} title="Моя Ясна"/>
                    <button onClick={()=>onOpenCustom&&onOpenCustom(c)} title={'Открыть «'+nm+'»'}
                      style={{flex:1,minWidth:0,textAlign:'left',padding:'11px 4px 11px 16px',background:'transparent',border:'none',fontSize:14,color:active?'#0071e3':'#1d1d1f',fontWeight:active?600:400,cursor:'pointer',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nm}</button>
                    <button onClick={()=>onTogglePin(c.id)} type="button" title={active?'Убрать из вкладок':'Закрепить во вкладках'}
                      style={{border:'none',background:'transparent',cursor:'pointer',color:active?'#0071e3':'var(--on-surface-variant)',padding:'8px 2px',flexShrink:0,display:'flex'}}><span className="ya-ik ya-ik--bulavka ya-ik--18"/></button>
                    <button onClick={()=>{
                      /* Системный confirm рисует «OK» и «Cancel» — по-английски и
                         одинаково на любой вопрос. Здесь на кнопках стоят глаголы. */
                      const спросить=window.YasnaOkna&&window.YasnaOkna.спросить;
                      const удалить=()=>onDeleteCustom&&onDeleteCustom(c.id);
                      if(спросить) спросить({заголовок:'Удалить ясну «'+nm+'»?',текст:'Вернуть её будет нельзя.',
                        да:'Удалить',нет:'Оставить',опасно:true,наДа:удалить});
                      else if(window.confirm('Удалить ясну «'+nm+'»? Вернуть её будет нельзя.')) удалить();
                    }} type="button" title='Удалить'
                      style={{border:'none',background:'transparent',cursor:'pointer',color:'var(--error)',padding:'8px 12px 8px 2px',flexShrink:0,display:'flex'}}><span className="ya-ik ya-ik--korzina ya-ik--18"/></button>
                  </div>);})}
              </div>
            </div>)}
          {filtered.length===0&&myList.length===0?
            <div className="ya-empty">
              <span className="ya-ik ya-ik--poisk ya-ik--48 ya-empty__znak"/>
              <p className="ya-empty__zag">Ничего не найдено по запросу «{q}»</p>
            </div>
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

window.YasnaDialogs = { Editor, Picker, OverlayPicker, OverlayLegend };

})();
