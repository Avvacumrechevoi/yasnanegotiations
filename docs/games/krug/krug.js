/* ═══════════════════════════════════════════════════════════════════
   Круг · «Поставь на место»
   Тренировка Ясны: элемент в руке — тап по доле круга, где он живёт.
   Нитка через середину вспыхивает сама, когда заняты оба конца оси.

   Режимы: одному · вдвоём на одном телефоне · по ссылке (та же раздача).
   Ясна выбирается из списка либо случайная.

   Данные — из docs/core/data.js (массив T, POS_DESC). Никаких выдуманных
   элементов: игра показывает то, что лежит в корпусе.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ─── что берём из корпуса ────────────────────────────────────────
   Из 44 строк в игру идут те, у которых есть урок автора либо verified,
   и у которых все двенадцать элементов различимы. Строка с повтором
   элемента неиграбельна в принципе: два места нечем развести.          */
/* Короткий латинский код явления для ссылки: id в корпусе кириллические, и
   ?y=%D0%B3%D0%BE%D0%B4%D0%B0 разворачивается в три строки нечитаемого текста.
   Старые ссылки с процентным id продолжают открываться — см. route(). */
const SLUG = { 'суток':'sut','двора':'dvor','двора_животных':'zhiv','дома':'dom',
  'кухни':'kuh','круговорота_воды':'voda','года':'god','дерева':'drev','печи':'pech',
  'завода_предприятия':'zavod','колокольни':'kolok','театра':'teatr','фаз_жизни':'zhizn',
  'kostra':'koster','emotsiy':'emo','удочки':'udoch' };
const UNSLUG = Object.fromEntries(Object.entries(SLUG).map(([k,v])=>[v,k]));

const FROM_LESSON = ['суток','двора','двора_животных','дома','кухни','круговорота_воды'];
const FROM_CORPUS = ['года','дерева','печи','завода_предприятия','колокольни','театра',
                     'фаз_жизни','kostra','emotsiy','удочки'];

/* Короткие функции мест — сжатие POS_DESC. Показываются в разборе, чтобы
   промах объяснялся контрастом: где живёт правильное и что за место выбрал ты. */
const POS=[
  'дно круга, скрытая основа и покой',
  'первый просвет после дна',
  'нарастание, подготовка к главному',
  'главное событие — проявление света',
  'рост после главного события',
  'сбор перед вершиной',
  'вершина, здесь всё видно',
  'первый перелом после вершины',
  'спад, света всё меньше',
  'второе главное событие — проявление тьмы',
  'угасание',
  'последний перелом перед дном'
];

/* ─── геометрия ───────────────────────────────────────────────────── */
/* Подписи вынесены НАРУЖУ кольца — как в конструкторе. Плашки поверх долей
   закрывали сам круг: двенадцать тёмных прямоугольников сходились в сплошное
   кольцо, и грамматика «внизу темно, наверху светло» пропадала. Снаружи они
   не мешают цвету, и круг можно сделать крупнее. */
const C=170,R=132,Ri=78,Rn=150,NS='http://www.w3.org/2000/svg';
const VB={x:-78,y:-34,w:420,h:372};
const ang=i=>90+30*i;
const pa=(r,a)=>[C+r*Math.cos(a*Math.PI/180),C+r*Math.sin(a*Math.PI/180)];
const pp=(r,i)=>pa(r,ang(i));
const pcx=x=>((x-VB.x)/VB.w*100)+'%', pcy=y=>((y-VB.y)/VB.h*100)+'%';
const wide=i=>i%2===0;
function arc(i,w,ro,ri){
  const a0=ang(i)-w/2,a1=ang(i)+w/2;
  const [x0,y0]=pa(ro,a0),[x1,y1]=pa(ro,a1),[x2,y2]=pa(ri,a1),[x3,y3]=pa(ri,a0);
  return `M${x0} ${y0}A${ro} ${ro} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 0 0 ${x3} ${y3}Z`;
}

/* Палитра. У суток она своя, природная. У остальных явлений природного цвета
   нет, поэтому берём грамматику самого круга: внизу темно, наверху светло,
   слева холоднее (свет набирает), справа теплее (свет отдаёт).             */
const PAL_SUTKI=['#131A30','#1B2545','#2F4472','#4D74B4','#8AA6D4','#D3C493',
                 '#F5CF74','#EAB35C','#D8894A','#C06A3C','#7A4634','#3B2A33'];
function palette(id){
  if(id==='суток') return PAL_SUTKI;
  const out=[];
  for(let i=0;i<12;i++){
    const up=i<=6? i/6 : (12-i)/6;              /* 0 внизу → 1 наверху */
    const L=10+up*62;                            /* светлота */
    const warm=i>=7&&i<=11;                      /* правая половина теплее */
    const H=warm?26:214, S=warm?38-up*10:34-up*14;
    out.push(hsl(H,S,L));
  }
  return out;
}
function hsl(h,s,l){
  s/=100; l/=100;
  const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l);
  const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  const to=v=>Math.round(255*v).toString(16).padStart(2,'0');
  return '#'+to(f(0))+to(f(8))+to(f(4));
}

/* ─── сид и перемешивание (одинаковая раздача по ссылке) ─────────── */
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; } }
function shuffled(arr,rnd){ const a=arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]] }
  return a; }


/* ═══════════ прогресс: свой ключ, локально ═══════════
   Пишем в СВОЙ ключ, а не в yasna_duel_data: схема того ключа принадлежит движку
   «Партии» (recordMatch в duel.js), он на этой странице не подключён, и писать туда
   руками — верный способ разъехаться с ним при первой же его правке.
   На сервер не отправляем ничего: ключ ответов лежит в data.js на этой же странице,
   значит счёт самоотчётный и в общий рейтинг ему нельзя.                          */
const LS='yasna_krug_v1', HIST_MAX=60;
function load(){
  try{ const d=JSON.parse(localStorage.getItem(LS)||'null');
       if(d&&d.v===1&&Array.isArray(d.games)&&d.best&&typeof d.best==='object') return d; }catch(_){}
  return { v:1, games:[], best:{} };
}
function save(d){ try{ localStorage.setItem(LS,JSON.stringify(d)) }catch(_){} }
function record(g){
  const d=load();
  /* Партия вдвоём — не личный результат: рекорд и счётчик разобранных явлений
     она портить не должна. И брошенная партия, добитая случайными тапами,
     не должна выставлять рекорд — у «Партии» такой фильтр есть, у Круга не было. */
  const personal = g.mode!=='duo' && g.ms>=5000 && g.total>=10;
  d.games.unshift(g);
  if(d.games.length>HIST_MAX) d.games.length=HIST_MAX;
  if(personal){ const b=d.best[g.yasna];
    if(b===undefined||g.clean>b) d.best[g.yasna]=g.clean; }
  save(d); return d;
}
const bestOf=id=>{ const b=load().best[id]; return b===undefined?null:b };
const played=()=>Object.keys(load().best).length;
function fmtDate(t){
  const dt=new Date(t), n=new Date(), d0=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  const dd=Math.round((d0-new Date(dt.getFullYear(),dt.getMonth(),dt.getDate()))/86400000);
  const hm=String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
  return dd===0?('сегодня '+hm):dd===1?('вчера '+hm):
    (dt.getDate()+' '+['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'][dt.getMonth()]);
}
const MODE_RU={solo:'одному',duo:'вдвоём',link:'общая раздача'};

/* ─── состояние ───────────────────────────────────────────────────── */
const S={ scr:'setup', yasna:null, seed:0, mode:'solo', preset:false,
          deck:[], i:0, placed:[], first:[], by:[], miss:{}, turn:0, hits:[0,0], tries:[0,0], els:[0,0], axBy:[], players:['Золотой','Синий'] };
let LIST=[];

/* ─── узлы круга: создаются один раз ──────────────────────────────── */
const N={w:[],h:[],c:[],n:[],mid:null,wrap:null};
function buildRing(host,onTap){
  const wrap=document.createElement('div'); wrap.id='wrap';
  wrap.innerHTML='<svg id="ring" viewBox="-78 -34 420 372"></svg>';
  host.appendChild(wrap);
  const sv=wrap.querySelector('svg');
  N.w=[];N.h=[];N.c=[];N.n=[];N.wrap=wrap;
  const pal=palette(S.yasna.id);
  for(let i=0;i<12;i++){
    const p=document.createElementNS(NS,'path');
    p.setAttribute('class','wedge'); p.setAttribute('d',arc(i,wide(i)?34:22,R,Ri));
    p.setAttribute('fill',pal[i]); p.setAttribute('fill-opacity','.34');
    sv.appendChild(p); N.w.push(p);
  }
  for(let k=0;k<6;k++){
    const [x1,y1]=pp(Ri-4,k),[x2,y2]=pp(Ri-4,k+6);
    const l=document.createElementNS(NS,'line'); l.setAttribute('class','chord');
    l.setAttribute('x1',x1);l.setAttribute('y1',y1);l.setAttribute('x2',x2);l.setAttribute('y2',y2);
    l.setAttribute('stroke','var(--k-gold)'); l.style.opacity=0; sv.appendChild(l); N.c.push(l);
  }
  /* хитбокс шире самой доли: у узких мест дуга около 34 px, пальцу мало */
  for(let i=0;i<12;i++){
    const h=document.createElementNS(NS,'path');
    h.setAttribute('class','hit');
    /* Хитбокс обязан совпадать с ВИДИМОЙ долей. Было 30° у всех при заливке
       34°/22° — тап по краю широкой доли уходил соседней, то есть игра
       наказывала за верный ответ. 17+13=30 замощает кольцо без нахлёста. */
    h.setAttribute('d',arc(i, wide(i)?34:26, R+16, Ri-12));
    h.setAttribute('tabindex','0'); h.setAttribute('role','button');
    h.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onTap&&onTap(i) } });
    h.addEventListener('click',()=>onTap&&onTap(i));
    sv.appendChild(h); N.h.push(h);
  }
  for(let i=0;i<12;i++){
    const [x,y]=pp(Rn,i);
    const d=document.createElement('div');
    /* слева от круга подпись прижата вправо, справа — влево, сверху и снизу
       по центру: иначе двенадцать блоков наезжают друг на друга */
    const side = Math.abs(x-C)<26 ? 'c' : (x<C ? 'l' : 'r');
    d.className='nm nm-'+side;
    d.style.left=pcx(x); d.style.top=pcy(y);
    wrap.appendChild(d); N.n.push(d);
  }
  N.mid=document.createElement('div'); N.mid.className='mid'; wrap.appendChild(N.mid);
  return wrap;
}
function light(i,by){
  N.w[i].setAttribute('fill-opacity','1'); N.w[i].dataset.on='1';
  const full=S.yasna.p[i];
  N.n[i].textContent=shortName(full); N.n[i].title=full;
  N.n[i].classList.add('on');
  N.h[i].setAttribute('aria-label','Место '+(i+1)+': '+full);
  if(by===0||by===1) N.n[i].dataset.by=by; else delete N.n[i].dataset.by;
}
function tie(k,col,free){ N.c[k].setAttribute('stroke',col||'var(--k-gold-ink)');
  if(free) N.c[k].classList.add('free');
  N.c[k].style.opacity=1; N.c[k].classList.add('on'); }
function shake(){ if(!N.wrap) return; N.wrap.classList.remove('shake');
  void N.wrap.offsetWidth; N.wrap.classList.add('shake'); }

/* ─── помощники разметки ──────────────────────────────────────────── */
const app=()=>document.getElementById('app');
const el=h=>{const d=document.createElement('div');d.innerHTML=h.trim();return d.firstElementChild};
/* Названия в корпусе бывают до 41 знака и с вариантами через « / » —
   на дольку шириной 58 px влезает только главное слово. Полное остаётся
   в title, в карточке в руке и в таблице разбора. */
function shortName(s){
  let a=String(s).split(' / ')[0].replace(/\s*\([^)]*\)\s*/g,' ').trim();
  if(a.length>22) a=a.slice(0,21).replace(/[\s,.;:-]+$/,'')+'…';
  return a||String(s);
}
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* ═══════════ ЭКРАН 1 · НАСТРОЙКА ═══════════ */
function setup(){
  S.scr='setup';
  app().innerHTML=''; app().classList.remove('duo-col');
  app().appendChild(el(`<div><h2>Поставь на место</h2>
    <div class="sub">Берёшь элемент явления и ставишь его на ту долю круга, где он живёт.
    Нитка через середину вспыхивает сама, когда заняты оба конца.${
      S.preset?'<br><b style="color:var(--k-tx2)">Режим: '+
      ({solo:'одному',duo:'вдвоём на одном телефоне',link:'компанией по ссылке'}[S.mode])+
      '</b>':''}</div></div>`));

  const d=load(), k=played();
  if(d.games.length){
    const row=el(`<div class="stats">
      <span><b>${k}</b> из ${LIST.length} явлений</span>
      <span><b>${d.games.length}</b> ${plural(d.games.length,'партия','партии','партий')}</span>
      <button class="lnk" type="button">История →</button></div>`);
    row.querySelector('button').onclick=history_;
    app().appendChild(row);
  }
  app().appendChild(el(`<div class="sect">Какую Ясну раскладываем</div>`));
  const g=el(`<div class="grid"></div>`);
  const rnd=el(`<button class="tile rnd"><b>Случайная</b><i>из ${LIST.length} доступных</i></button>`);
  rnd.onclick=()=>{ pickYasna(LIST[Math.floor(Math.random()*LIST.length)], true) };
  g.appendChild(rnd);
  LIST.forEach(y=>{
    const bb=bestOf(y.id);
    const b=el(`<button class="tile"><b>${esc(y.n)}</b><i>${
      bb===null ? (y.lesson?'есть урок автора':'из корпуса')
                : 'лучшее: '+bb+' из 10'
    }</i>${bb!==null?'<span class="dot"></span>':''}</button>`);
    b.onclick=()=>pickYasna(y,false);
    g.appendChild(b);
  });
  app().appendChild(g);
  app().appendChild(el(`<div class="note">В списке только те явления, у которых все двенадцать
    элементов различимы. Строки с повтором элемента в игру не идут: два места нечем развести.</div>`));
}

function pickYasna(y,isRandom){
  S.yasna=y; S.seed=(Math.random()*1e9)|0; S.random=!!isRandom;
  if(S.preset) return S.mode==='link'?share():start();
  mode();
}

/* ═══════════ ИСТОРИЯ ═══════════ */
function history_(){
  S.scr='history'; app().innerHTML=''; app().classList.remove('duo-col');
  const d=load();
  app().appendChild(el(`<div><h2>История</h2>
    <div class="sub">Партии хранятся на этом устройстве и никуда не отправляются.</div></div>`));
  if(!d.games.length){
    app().appendChild(el(`<div class="say"><div class="hd">Пока пусто</div>
      <div class="bd">Разложи первый круг — партия появится здесь.</div></div>`));
  } else {
    const bestRows=LIST.filter(y=>d.best[y.id]!==undefined)
      .sort((a,b)=>d.best[b.id]-d.best[a.id])
      .map(y=>`<tr><td>${esc(y.n)}</td><td>${d.best[y.id]} из 10</td></tr>`).join('');
    app().appendChild(el(`<div class="say"><div class="hd">Лучшее по явлениям</div>
      <table class="res">${bestRows}</table></div>`));
    const rows=d.games.slice(0,20).map(g=>`<tr><td>${esc(g.name||g.yasna)}
      <span style="color:var(--k-tx3)"> · ${MODE_RU[g.mode]||g.mode}</span></td>
      <td>${g.clean} из ${g.total}<span style="color:var(--k-tx3)"> · ${fmtDate(g.t)}</span></td></tr>`).join('');
    app().appendChild(el(`<div class="say"><div class="hd">Последние партии</div>
      <table class="res">${rows}</table></div>`));
  }
  const back=el(`<button class="go">← К выбору Ясны</button>`); back.onclick=setup;
  app().appendChild(back);
  if(d.games.length){
    const clr=el(`<button class="gh">Очистить историю</button>`);
    clr.onclick=()=>{ if(confirm('Удалить все записи партий с этого устройства?')){
      try{ localStorage.removeItem(LS) }catch(_){} setup(); } };
    app().appendChild(clr);
  }
}

/* ═══════════ ЭКРАН 2 · РЕЖИМ ═══════════ */
function mode(){
  S.scr='mode'; app().innerHTML=''; app().classList.remove('duo-col');
  app().appendChild(el(`<div><h2>Ясна ${esc(S.yasna.n)}</h2>
    <div class="sub">${S.random?'Выпала случайно. ':''}Двенадцать элементов, шесть осей.
    Как играем?</div></div>`));
  const opts=[
    ['solo','Одному','сам себе, ~2 минуты'],
    ['duo','Вдвоём на одном телефоне','ходите по очереди, телефон между вами'],
    ['link','Компанией по ссылке','всем достаётся одна и та же раздача']
  ];
  opts.forEach(([id,t,s])=>{
    const b=el(`<button class="tile" style="min-height:56px"><b>${t}</b><i>${s}</i></button>`);
    b.onclick=()=>{ S.mode=id; id==='link'?share():start() };
    app().appendChild(b);
  });
  app().appendChild(el(`<button class="gh" onclick="location.reload()">← Другая Ясна</button>`));
}

/* ═══════════ ССЫЛКА НА ОДНУ РАЗДАЧУ ═══════════ */
function share(){
  S.scr='share'; app().innerHTML=''; app().classList.remove('duo-col');
  const q='?y='+(SLUG[S.yasna.id]||encodeURIComponent(S.yasna.id))+'&s='+S.seed;
  const url=location.origin+location.pathname+q;
  /* адрес хоста тоже переписываем: иначе после перезагрузки ссылку не переслать */
  try{ history.replaceState(null,'',q) }catch(_){}
  app().appendChild(el(`<div><h2>Одна раздача на всех</h2>
    <div class="sub">Отправь ссылку — у каждого будет та же Ясна и тот же порядок элементов.
    Каждый раскладывает у себя, потом сверяете, кто где промахнулся.</div></div>`));
  app().appendChild(el(`<div class="say"><div class="hd">Ссылка</div>
    <div class="bd" style="word-break:break-all;font-size:12.5px">${esc(url)}</div></div>`));
  const cp=el(`<button class="go">Скопировать ссылку</button>`);
  cp.onclick=async()=>{ try{ await navigator.clipboard.writeText(url); cp.textContent='Скопировано ✓' }
    catch(e){ cp.textContent='Скопируй вручную ↑' } };
  app().appendChild(cp);
  app().appendChild(el(`<button class="gh" id="kgo">Начать свою раскладку →</button>`));
  document.getElementById('kgo').onclick=start;
  app().appendChild(el(`<div class="note">Живая комната, где ответы всех видно сразу, —
    следующий шаг: она пойдёт через тот же транспорт, что и «Партия».</div>`));
}

/* ═══════════ ПАРТИЯ ═══════════ */
function start(){
  S.scr='play'; S.i=0; S.placed=new Array(12).fill(false);
  S.first=new Array(12).fill(null); S.by=new Array(12).fill(null); S.miss={}; S.turn=0;
  S.hits=[0,0]; S.tries=[0,0]; S.els=[0,0]; S.axBy=new Array(6).fill(null);
  S.t0=Date.now(); S.logged=false;
  const rnd=mulberry(S.seed);
  /* ноль и шестёрка выдаются даром: это опоры круга, от них считается всё остальное */
  S.deck=shuffled([1,2,3,4,5,7,8,9,10,11],rnd);
  render();
  place(0,true); place(6,true);
  say('ok','Низ и верх выдаём',
    `<b>${esc(S.yasna.p[0])}</b> — ${POS[0]}. Напротив, на вершине, — <b>${esc(S.yasna.p[6])}</b>.
     Остальные десять поставь сам.`, 'Начали →', ()=>hand());
}

function render(){
  app().innerHTML=''; app().classList.add('duo-col');
  const top=el(`<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
    <div style="font-weight:650">${esc(S.yasna.n)}</div>
    <div style="font-size:12.5px;color:var(--k-tx3)">${S.mode==='duo'?'вдвоём':S.mode==='link'?'общая раздача':'одному'}</div></div>`);
  app().appendChild(top);
  buildRing(app(),onTap);
  app().appendChild(el(`<div id="kbot"></div>`));
  /* восстановить уже поставленное (перерисовка круга) */
  for(let i=0;i<12;i++) if(S.placed[i]) light(i, S.by[i]===null?undefined:S.by[i]);
  for(let k=0;k<6;k++) if(S.placed[k]&&S.placed[k+6]) tie(k, chordCol(k));
  hand();
}
function chordCol(k){
  if(S.mode==='duo' && S.axBy[k]===null) return 'var(--k-grey)';
  if(S.mode!=='duo') return (S.first[k]===false||S.first[k+6]===false)?'var(--k-grey)':'var(--k-gold-ink)';
  const who = S.axBy[k];
  return who===1?'var(--k-acc)':'var(--k-gold-ink)';
}
function bot(){ return document.getElementById('kbot') }

function hand(){
  const b=bot(); b.innerHTML='';
  if(S.i>=S.deck.length) return finish();
  const t=S.deck[S.i];
  b.appendChild(el(`<div class="hand">
    ${S.mode==='duo'?`<div class="turnbar t${S.turn}">Ходит ${esc(S.players[S.turn])}</div>`:''}
    <div class="el">${esc(S.yasna.p[t])}</div>
    <div class="q">куда на круге?</div></div>`));
  b.appendChild(prog());
  N.mid.innerHTML='<b>'+(S.i+1)+' / '+S.deck.length+'</b>элементов';
}
function prog(){
  const p=el('<div class="prog"></div>');
  S.deck.forEach((t,k)=>{
    const i=document.createElement('i');
    if(k<S.i) i.className=S.first[t]===true?'d':'m';
    p.appendChild(i);
  });
  return p;
}
function say(kind,hd,bd,btn,fn){
  const b=bot(); b.innerHTML='';
  b.appendChild(el(`<div class="say ${kind}"><div class="hd">${hd}</div><div class="bd">${bd}</div></div>`));
  const g=el(`<button class="go">${btn||'Дальше →'}</button>`);
  g.onclick=fn||(()=>{ S.i++; if(S.mode==='duo') S.turn=1-S.turn; hand(); });
  b.appendChild(g);
}

function place(i,free){
  S.placed[i]=true; S.first[i]=free?null:S.first[i];
  S.by[i]=free?null:S.turn;
  light(i,(S.mode==='duo'&&!free)?S.turn:undefined);
  const k=i%6;
  if(S.placed[k]&&S.placed[k+6]){
    /* Ось принадлежит тому, кто поставил ВТОРОЙ её конец, — он её и замкнул.
       Считать по владельцу верхнего конца нельзя: это лотерея, кому какой
       элемент выпал, а не заслуга игрока. */
    if(S.axBy[k]===null||S.axBy[k]===undefined) S.axBy[k]=free?null:S.turn;
    tie(k, chordCol(k), S.mode==='duo'&&S.axBy[k]===null);
  }
}

function onTap(i){
  if(S.scr!=='play') return;
  if(!bot()||!bot().querySelector('.hand')) return;      /* сейчас показан разбор */
  if(S.placed[i]){ shake(); return }
  const t=S.deck[S.i], ok=(i===t);
  if(S.mode==='duo'){ S.tries[S.turn]++; if(ok){ S.els[S.turn]++; if(S.first[t]!==false) S.hits[S.turn]++; } }
  S.first[t]= (S.first[t]===false)?false:ok;             /* «с первого раза» помним навсегда */
  if(!ok){
    S.first[t]=false; S.miss[t]=(S.miss[t]||[]).concat(i);
    shake();
    say('no','Не сюда',
      `Место ${i} — ${POS[i]}. Там живёт что-то другое.<br><br>
       «<b>${esc(S.yasna.p[t])}</b>» ищи там, где ${POS[t]}.`,
      'Попробовать ещё →', ()=>hand());
    return;
  }
  place(t);
  const k=t%6, closed=S.placed[k]&&S.placed[k+6];
  say('ok', closed?'Ось сошлась':'На месте',
    closed
      ? `«<b>${esc(S.yasna.p[k])}</b>» и «<b>${esc(S.yasna.p[k+6])}</b>» — два конца одной нитки.
         ${POS[k].charAt(0).toUpperCase()+POS[k].slice(1)} — и ровно напротив ${POS[k+6]}.`
      : `«<b>${esc(S.yasna.p[t])}</b>» — ${POS[t]}. Напротив пока пусто.`);
}

function plural(n,a,b,c){ const x=Math.abs(n)%100,y=x%10;
  if(x>10&&x<20) return c; if(y>1&&y<5) return b; if(y===1) return a; return c; }

/* ═══════════ ИТОГ ═══════════ */
function finish(){
  S.scr='end';
  const b=bot(); b.innerHTML='';
  N.mid.innerHTML='<b>Круг собран</b>';
  const clean=S.deck.filter(t=>S.first[t]===true).length;
  const prevBest=bestOf(S.yasna.id);
  if(!S.logged){                      /* один раз на партию, а не на каждый рендер */
    S.logged=true;
    record({ t:Date.now(), yasna:S.yasna.id, name:S.yasna.n, mode:S.mode,
             clean:clean, total:S.deck.length, ms:Math.max(0,Date.now()-S.t0) });
  }
  const missed=S.deck.filter(t=>S.first[t]===false);

  let body=`Все двенадцать на местах, шесть ниток протянуты.`;
  if(S.mode!=='duo'){
    body+=` С первого раза — <b>${clean}</b> из ${S.deck.length}.`;
  } else {
    /* нитку засчитываем тому, кто поставил её второй конец — он её и замкнул */
    const ax=[0,0];
    for(let k=0;k<6;k++){ const w=S.axBy[k]; if(w===0||w===1) ax[w]++; }
    const lead = ax[0]===ax[1] ? null : (ax[0]>ax[1]?0:1);
    body += `<br><br>Ось низ–верх дана даром, остальные пять замыкали вы.
      <b>${esc(S.players[0])}</b> замкнул ${ax[0]} ${plural(ax[0],'ось','оси','осей')},
      <b>${esc(S.players[1])}</b> — ${ax[1]}.`;
    body += lead===null
      ? ' Поровну.'
      : ` Круг больше собрал <b>${esc(S.players[lead])}</b>.`;
    body += `<br>С первого раза: ${esc(S.players[0])} — ${S.hits[0]} из ${S.els[0]},
      ${esc(S.players[1])} — ${S.hits[1]} из ${S.els[1]}. Тапов всего: ${S.tries[0]} и ${S.tries[1]}.`;
  }
  b.appendChild(el(`<div class="say ok"><div class="hd">Готово</div><div class="bd">${body}</div></div>`));

  if(missed.length){
    const t=el(`<div class="say"><div class="hd">Что путал</div>
      <table class="res"></table>
      <div class="bd" style="margin-top:8px;font-size:12.5px;color:var(--k-tx3)">
      Слева — элемент, справа — куда ты его отправил в первый раз.</div></div>`);
    /* строки собираем строкой: <tr>, вставленный через div-обёртку, парсер выбрасывает */
    t.querySelector('table').innerHTML = missed.map(x=>{
      const w=(S.miss[x]||[])[0];
      return `<tr><td>${esc(S.yasna.p[x])}</td><td>${
        w!==undefined ? esc(S.yasna.p[w]||('место '+w)) : '—'}</td></tr>`;
    }).join('');
    b.appendChild(t);
  } else {
    b.appendChild(el(`<div class="say"><div class="hd">Ни одного промаха</div>
      <div class="bd">Эта Ясна у тебя уже читается. Возьми ту, которую не разбирал, —
      круг там тот же, меняется только оболочка.</div></div>`));
  }

  if(S.mode!=='duo'){
    const nowBest=bestOf(S.yasna.id);
    b.appendChild(el(`<div class="note" style="margin-top:10px">${
      prevBest===null ? 'Это твоя первая раскладка Ясны '+esc(S.yasna.n)+'.'
      : (clean>prevBest ? 'Личный рекорд на этой Ясне: было '+prevBest+', стало <b>'+clean+'</b>.'
                        : 'Твой лучший результат на этой Ясне: '+nowBest+' из '+S.deck.length+'.')
    }</div>`));
  }
  const again=el(`<button class="go">Ещё Ясна →</button>`);
  again.onclick=()=>{ try{ history.replaceState(null,'',location.pathname) }catch(_){}
    S.invited=false; S.preset=false; setup() };
  b.appendChild(again);
  const same=el(`<button class="gh">${S.mode==='link'?'Ту же раздачу заново':'Эту же Ясну ещё раз'}</button>`);
  /* в режиме общей ссылки сид менять нельзя: раздача обязана совпадать у всех */
  same.onclick=()=>{ if(S.mode!=='link') S.seed=(Math.random()*1e9)|0; start() };
  b.appendChild(same);
}

/* ═══════════ СТАРТ ═══════════ */
function boot(){
  const D=window.YasnaData;
  if(!D||!D.T){ app().innerHTML='<div class="say no"><div class="hd">Нет данных</div>'+
    '<div class="bd">Не загрузился core/data.js — без него играть нечем.</div></div>'; return }
  const by={}; D.T.forEach(y=>by[y.id]=y);
  const mk=(id,lesson)=>{
    const y=by[id]; if(!y||!y.p||y.p.length!==12) return null;
    const clean=y.p.map(s=>String(s).trim());
    if(new Set(clean).size!==12) return null;            /* повтор элемента = неиграбельно */
    return { id:y.id, n:y.n, p:clean, lesson:lesson };
  };
  LIST=[].concat(FROM_LESSON.map(id=>mk(id,true)), FROM_CORPUS.map(id=>mk(id,false))).filter(Boolean);

  route();
}
/* Разбор адреса в ОДНОМ месте — иначе состояние расходится между холодным
   заходом и сменой хэша на уже открытой вкладке. */
function route(){
  const u=new URLSearchParams(location.search||'');
  const yid=u.get('y'), sd=u.get('s');
  if(yid){
    const realId = UNSLUG[yid] || yid;          /* и короткий код, и старый id */
    const y=LIST.find(x=>x.id===realId);
    if(!y||!/^\d+$/.test(sd||'')) return badLink();
    S.yasna=y; S.seed=parseInt(sd,10)|0; S.mode='link'; S.invited=true; return start();
  }
  const pre=(location.hash||'').replace('#','');
  S.invited=false;
  if(pre==='solo'||pre==='duo'||pre==='link'){ S.mode=pre; S.preset=true; S.yasna=null; }
  else { S.preset=false; }
  setup();
}
function badLink(){
  app().innerHTML='';
  app().appendChild(el(`<div class="say no"><div class="hd">Эта раздача не открывается</div>
    <div class="bd">Ссылка старая либо из другой версии игры: такой Ясны в списке нет.
    Выбери явление сам — партия будет та же, только раздача своя.</div></div>`));
  const b=el(`<button class="go">Выбрать Ясну →</button>`);
  b.onclick=()=>{ history.replaceState(null,'',location.pathname); S.preset=false; setup() };
  app().appendChild(b);
}

let booted=false;
function once(){ if(booted) return; booted=true; boot(); }
/* Кнопки карточки ведут на #solo/#duo/#link. Если вкладка уже открыта, браузер меняет
   только хэш и страницу не перезагружает — без этого слушателя режим не переключался,
   и «вдвоём» выглядело точно как «одному». */
window.addEventListener('hashchange',route);

/* Смена темы: часть браузеров не переобсчитывает var() у узлов, созданных до
   переключения — проверено, свежесозданная кнопка красится верно, а стоявшая
   на экране остаётся в прежней теме. Перерисовываем текущий экран сами. */
new MutationObserver(()=>{
  /* ТОЛЬКО служебные экраны. Игровой не трогаем: заливка долей принадлежит
     явлению и от темы не зависит, а render() заканчивается hand() — при смене
     темы поверх экрана разбора в руку возвращался уже поставленный элемент,
     и партия зависала без выхода. */
  if(S.scr==='setup') setup();
  else if(S.scr==='history') history_();
}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','style']});
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',once);
else once();
})();
