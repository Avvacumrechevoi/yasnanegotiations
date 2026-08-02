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
const C=170,R=142,Ri=86,Rn=114,NS='http://www.w3.org/2000/svg';
const VB={x:-22,y:-12,w:384};
const ang=i=>90+30*i;
const pa=(r,a)=>[C+r*Math.cos(a*Math.PI/180),C+r*Math.sin(a*Math.PI/180)];
const pp=(r,i)=>pa(r,ang(i));
const pcx=x=>((x-VB.x)/VB.w*100)+'%', pcy=y=>((y-VB.y)/VB.w*100)+'%';
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

/* ─── состояние ───────────────────────────────────────────────────── */
const S={ scr:'setup', yasna:null, seed:0, mode:'solo', preset:false,
          deck:[], i:0, placed:[], first:[], by:[], miss:{}, turn:0, players:['Первый','Второй'] };
let LIST=[];

/* ─── узлы круга: создаются один раз ──────────────────────────────── */
const N={w:[],h:[],c:[],n:[],mid:null,wrap:null};
function buildRing(host,onTap){
  const wrap=document.createElement('div'); wrap.id='wrap';
  wrap.innerHTML='<svg id="ring" viewBox="-22 -12 384 384"></svg>';
  host.appendChild(wrap);
  const sv=wrap.querySelector('svg');
  N.w=[];N.h=[];N.c=[];N.n=[];N.wrap=wrap;
  const pal=palette(S.yasna.id);
  for(let i=0;i<12;i++){
    const p=document.createElementNS(NS,'path');
    p.setAttribute('class','wedge'); p.setAttribute('d',arc(i,wide(i)?34:22,R,Ri));
    p.setAttribute('fill',pal[i]); p.style.opacity=.34;
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
    h.setAttribute('class','hit'); h.setAttribute('d',arc(i,30,R+16,Ri-12));
    h.addEventListener('click',()=>onTap&&onTap(i));
    sv.appendChild(h); N.h.push(h);
  }
  for(let i=0;i<12;i++){
    const [x,y]=pp(Rn,i);
    const d=document.createElement('div'); d.className='nm';
    d.style.left=pcx(x); d.style.top=pcy(y); d.style.opacity=0;
    wrap.appendChild(d); N.n.push(d);
  }
  N.mid=document.createElement('div'); N.mid.className='mid'; wrap.appendChild(N.mid);
  return wrap;
}
function light(i,by){
  N.w[i].style.opacity=1;
  N.n[i].textContent=S.yasna.p[i]; N.n[i].style.opacity=1;
  if(by!==undefined) N.n[i].dataset.by=by;
}
function tie(k,col){ N.c[k].setAttribute('stroke',col||'var(--k-gold)');
  N.c[k].style.opacity=1; N.c[k].classList.add('on'); }
function shake(){ if(!N.wrap) return; N.wrap.classList.remove('shake');
  void N.wrap.offsetWidth; N.wrap.classList.add('shake'); }

/* ─── помощники разметки ──────────────────────────────────────────── */
const app=()=>document.getElementById('app');
const el=h=>{const d=document.createElement('div');d.innerHTML=h.trim();return d.firstElementChild};
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* ═══════════ ЭКРАН 1 · НАСТРОЙКА ═══════════ */
function setup(){
  S.scr='setup'; document.body.classList.remove('playing');
  app().innerHTML='';
  app().appendChild(el(`<div><h2>Поставь на место</h2>
    <div class="sub">Берёшь элемент явления и ставишь его на ту долю круга, где он живёт.
    Нитка через середину вспыхивает сама, когда заняты оба конца.${
      S.preset?'<br><b style="color:var(--k-tx2)">Режим: '+
      ({solo:'одному',duo:'вдвоём на одном телефоне',link:'компанией по ссылке'}[S.mode])+
      '</b>':''}</div></div>`));

  app().appendChild(el(`<div class="sect">Какую Ясну раскладываем</div>`));
  const g=el(`<div class="grid"></div>`);
  const rnd=el(`<button class="tile rnd"><b>Случайная</b><i>из ${LIST.length} доступных</i></button>`);
  rnd.onclick=()=>{ pickYasna(LIST[Math.floor(Math.random()*LIST.length)], true) };
  g.appendChild(rnd);
  LIST.forEach(y=>{
    const b=el(`<button class="tile"><b>${esc(y.n)}</b><i>${y.lesson?'есть урок автора':'из корпуса'}</i></button>`);
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

/* ═══════════ ЭКРАН 2 · РЕЖИМ ═══════════ */
function mode(){
  S.scr='mode'; app().innerHTML='';
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
  S.scr='share'; app().innerHTML='';
  const url=location.origin+location.pathname+'#'+S.yasna.id+'.'+S.seed;
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
  app().innerHTML='';
  const top=el(`<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
    <div style="font-weight:650">${esc(S.yasna.n)}</div>
    <div style="font-size:12.5px;color:var(--k-tx3)">${S.mode==='duo'?'вдвоём':S.mode==='link'?'общая раздача':'одному'}</div></div>`);
  app().appendChild(top);
  buildRing(app(),onTap);
  app().appendChild(el(`<div id="kbot"></div>`));
  /* восстановить уже поставленное (перерисовка круга) */
  for(let i=0;i<12;i++) if(S.placed[i]) light(i,S.by[i]);
  for(let k=0;k<6;k++) if(S.placed[k]&&S.placed[k+6]) tie(k, chordCol(k));
  hand();
}
function chordCol(k){
  if(S.mode!=='duo') return (S.first[k]===false||S.first[k+6]===false)?'var(--k-grey)':'var(--k-gold)';
  /* в парной игре нитка окрашена по тому, кто поставил ВТОРОЙ её конец */
  const who = S.by[k+6]!==null ? S.by[k+6] : S.by[k];
  return who===1?'var(--k-acc)':'var(--k-gold)';
}
function bot(){ return document.getElementById('kbot') }

function hand(){
  const b=bot(); b.innerHTML='';
  if(S.i>=S.deck.length) return finish();
  const t=S.deck[S.i];
  b.appendChild(el(`<div class="hand">
    ${S.mode==='duo'?`<div class="who">Ходит ${esc(S.players[S.turn])}</div>`:''}
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
  light(i, S.mode==='duo'?S.turn:undefined);
  const k=i%6;
  if(S.placed[k]&&S.placed[k+6]) tie(k, chordCol(k));
}

function onTap(i){
  if(S.scr!=='play') return;
  if(!bot()||!bot().querySelector('.hand')) return;      /* сейчас показан разбор */
  if(S.placed[i]){ shake(); return }
  const t=S.deck[S.i], ok=(i===t);
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

/* ═══════════ ИТОГ ═══════════ */
function finish(){
  S.scr='end';
  const b=bot(); b.innerHTML='';
  N.mid.innerHTML='<b>Круг собран</b>';
  const clean=S.deck.filter(t=>S.first[t]===true).length;
  const missed=S.deck.filter(t=>S.first[t]===false);

  let body=`Все двенадцать на местах, шесть ниток протянуты.`;
  if(S.mode!=='duo'){
    body+=` С первого раза — <b>${clean}</b> из ${S.deck.length}.`;
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

  const again=el(`<button class="go">Ещё Ясна →</button>`); again.onclick=()=>{ location.hash=''; setup() };
  b.appendChild(again);
  const same=el(`<button class="gh">Эту же ещё раз</button>`);
  same.onclick=()=>{ S.seed=(Math.random()*1e9)|0; start() };
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

  /* пришли по ссылке с общей раздачей: #<id>.<seed> */
  const m=/^#([^.]+)\.(\d+)$/.exec(location.hash||'');
  if(m){
    const y=LIST.find(x=>x.id===decodeURIComponent(m[1]));
    if(y){ S.yasna=y; S.seed=parseInt(m[2],10)|0; S.mode='link'; return start() }
  }
  /* пришли с карточки практик: режим уже выбран, спрашиваем только Ясну */
  const pre=(location.hash||'').replace('#','');
  if(pre==='solo'||pre==='duo'||pre==='link'){ S.mode=pre; S.preset=true; }
  setup();
}
let booted=false;
function once(){ if(booted) return; booted=true; boot(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',once);
else once();
})();
