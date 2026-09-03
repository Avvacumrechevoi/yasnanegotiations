/* ═══════════════════════════════════════════════════════════════════
   «Разложи по кругу» — тренировка Ясны
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


/* ─── Значки явлений ──────────────────────────────────────────────
   Каждой Ясне — свой знак: в списке из шестнадцати одинаковых плиток
   человек искал строку глазами по тексту. Рисуем линией в одном
   стиле (24×24, stroke), цвет берёт карточка. */
const ZNAK = {
  'суток':'<circle cx="12" cy="12" r="5"/><path d="M12 1.6v3M12 19.4v3M1.6 12h3M19.4 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1"/>',
  'года':'<circle cx="12" cy="12" r="8.4"/><path d="M12 3.6v16.8M3.6 12h16.8"/><path d="M12 12 12 3.6A8.4 8.4 0 0 1 20.4 12z" fill="currentColor" stroke="none" opacity=".55"/>',
  'фаз_жизни':'<path d="M12 21.4c0-5 2-8 5.4-9.6-3.4-.6-5.4 1-5.4 4"/><path d="M12 21.4c0-6.4-2.3-9.8-6.2-11.4C9.7 9.3 12 11.3 12 15"/><path d="M12 21.4V8.6"/><circle cx="12" cy="5.2" r="2.6"/>',
  'печи':'<path d="M4.6 20.6V7.4a2 2 0 0 1 2-2h8.8a2 2 0 0 1 2 2v13.2z"/><path d="M17.4 9.6h1.8V4.6h1.6"/><rect x="7.4" y="8.4" width="7.2" height="5.2" rx="1"/><path d="M9.8 12.2c1-.7 1-1.7.4-2.4 1.4.5 2 1.7 1.3 2.7"/><path d="M7.4 16.8h7.2"/>',
  'дерева':'<path d="M12 21v-6"/><path d="M12 15c-3.6 0-6-2.2-6-5.4C6 6 8.6 3.4 12 3.4s6 2.6 6 6.2c0 3.2-2.4 5.4-6 5.4z"/><path d="M12 15V8.6M12 11.4 9.4 9M12 12.6l2.6-2.4"/>',
  'завода_предприятия':'<path d="M3.4 20.6V11l5 3.2V11l5 3.2V6.4h7.2v14.2z"/><path d="M16 10.6v3M19 10.6v3"/>',
  'удочки':'<path d="M4.4 3.6c5.6 1.4 9.4 5.4 11 11.4"/><path d="M15.4 15c0 2.2-1.6 4-3.6 4s-3.4-1.4-3.4-3.2"/><path d="M4.4 3.6H8"/><circle cx="11.8" cy="21" r="1"/>',
  'колокольни':'<path d="M6.6 17.6c0-5.4 1.6-8.4 5.4-9.4 3.8 1 5.4 4 5.4 9.4z"/><path d="M4.6 17.6h14.8"/><path d="M12 8.2V5.4"/><circle cx="12" cy="4" r="1.4"/><path d="M10.6 20.4c.4.8 2.4.8 2.8 0"/>',
  'театра':'<path d="M4.4 6.6h9.2v6.8a4.6 4.6 0 0 1-9.2 0z"/><path d="M6.8 9.6h.01M11.2 9.6h.01M7.4 12.4c.9 1 2.3 1 3.2 0"/><path d="M10.4 6.6V5.4h9.2v6.8a4.6 4.6 0 0 1-3.4 4.4"/>',
  'дома':'<path d="M3.6 11.4 12 4l8.4 7.4"/><path d="M5.8 9.6V20h12.4V9.6"/><path d="M9.6 20v-5.4h4.8V20"/>',
  'двора':'<path d="M3.4 20.4h17.2"/><path d="M5.6 20.4v-6.8l3.8-3 3.8 3v6.8"/><path d="M13.2 20.4v-4.6h5.2v4.6"/><path d="M8.2 20.4v-3.2h2.4v3.2"/><path d="M15.2 13.4h1.6"/>',
  'двора_животных':'<path d="M12 20.4c-2.6 0-4.4-1.6-4.4-3.6 0-2.2 2-3.4 4.4-3.4s4.4 1.2 4.4 3.4c0 2-1.8 3.6-4.4 3.6z"/><ellipse cx="6.6" cy="10.4" rx="1.8" ry="2.4"/><ellipse cx="17.4" cy="10.4" rx="1.8" ry="2.4"/><ellipse cx="9.8" cy="6.4" rx="1.7" ry="2.2"/><ellipse cx="14.2" cy="6.4" rx="1.7" ry="2.2"/>',
  'кухни':'<path d="M4.6 10.4h14.8v3.2a7.4 7.4 0 0 1-14.8 0z"/><path d="M19.4 11.6h1.8a1.6 1.6 0 0 1 0 3.2h-1.8"/><path d="M8.6 7.4c0-1.4 1-1.8 1-3M12 7.4c0-1.4 1-1.8 1-3M15.4 7.4c0-1.4 1-1.8 1-3"/>',
  'круговорота_воды':'<path d="M12 3.4c2.8 3.4 4.4 5.8 4.4 8a4.4 4.4 0 1 1-8.8 0c0-2.2 1.6-4.6 4.4-8z"/><path d="M4 18.6c1.6 1.4 3.4 1.4 5 0s3.4-1.4 5 0 3.4 1.4 5 0"/>',
  'kostra':'<path d="M12 3.4c3.4 3.6 5.4 6.2 5.4 9a5.4 5.4 0 1 1-10.8 0c0-2.8 2-5.4 5.4-9z"/><path d="M12 17.4c-1.4-1.2-2-2.2-2-3.2 0-1.2.8-2.2 2-3.4 1.2 1.2 2 2.2 2 3.4 0 1-.6 2-2 3.2z"/>',
  'emotsiy':'<circle cx="12" cy="12" r="8.6"/><path d="M8.6 9.8h.01M15.4 9.8h.01"/><path d="M8.2 14.4c1 1.6 2.4 2.4 3.8 2.4s2.8-.8 3.8-2.4"/>',
  '__slucha':'<path d="M4.6 8.6 12 4.4l7.4 4.2v6.8L12 19.6l-7.4-4.2z"/><path d="M9.4 11.4h.01M14.6 11.4h.01M12 14.6h.01"/>',
  '__default':'<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4v17.2M3.4 12h17.2"/>',
};
function znak(id){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
       + 'stroke-linecap="round" stroke-linejoin="round">' + (ZNAK[id] || ZNAK.__default) + '</svg>';
}

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
const C=170,R=155,Ri=92,Rn=178,NS='http://www.w3.org/2000/svg';
/* Холст держит пропорцию 452×380: по ней же CSS считает высоту контейнера,
   а подписи — свои проценты (pcx/pcy). Менять числа только вместе. */
const VB={x:-56,y:-32,w:452,h:380};
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
  /* viewBox ОБЯЗАН строиться из VB: подписи и счётчик позиционируются формулами
     pcx/pcy по тому же VB, и зашитая копия чисел разъезжается с ними при любой
     правке холста — весь текстовый слой уезжал на 56 px влево от центра. */
  wrap.innerHTML='<svg id="ring" viewBox="'+VB.x+' '+VB.y+' '+VB.w+' '+VB.h+'"></svg>';
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
    /* Ширина подписи зависит от места на круге: у вершины и дна есть простор
       вбок, у боков — нет, а по диагоналям соседи стоят ближе всего, и именно
       там двухсловные имена («Утренний Салют», «Вечерняя Заря») наезжали
       друг на друга. Раньше ширина была одна на все двенадцать. */
    const рядом = (i%6===0) ? 'verh' : (i===3||i===9 ? 'bok' : 'kosoj');
    d.className='nm nm-'+side+' nm--'+рядом;
    d.style.left=pcx(x); d.style.top=pcy(y);
    d.dataset.mesto=String(i);
    wrap.appendChild(d); N.n.push(d);
  }
  /* Подписи крайних мест (ровно слева и справа от кольца) вылезали за экран:
     их бокс фиксированной ширины откладывается от точки на радиусе Rn, а на
     телефоне до края остаётся меньше этой ширины. Ставим их по факту: после
     раскладки прижимаем к краю холста, если не помещаются. */
  function поправитьКрая(){
    if(!wrap.clientWidth) return;
    /* Два прохода: сначала снимаем прежние сдвиги у ВСЕХ подписей, потом
       меряем — иначе замер идёт по уже сдвинутым соседям и одна подпись
       каждый раз оставалась за краем. */
    N.n.forEach(function(d){ d.style.removeProperty('margin-left'); });
    const к=wrap.getBoundingClientRect();
    N.n.forEach(function(d){
      const r=d.getBoundingClientRect();
      if(r.width<2) return;
      const слева=r.left-к.left, справа=к.right-r.right;
      if(слева<2) d.style.marginLeft=(2-слева)+'px';
      else if(справа<2) d.style.marginLeft=-(2-справа)+'px';
    });
  }
  N.поправитьКрая=поправитьКрая;
  if(window.ResizeObserver){ try{ new ResizeObserver(поправитьКрая).observe(wrap) }catch(_){} }

  N.mid=document.createElement('div'); N.mid.className='mid';
  /* Центр кольца в канве не совпадает с центром блока: viewBox смещён, чтобы
     дать место подписям. Позицию считаем той же формулой, что и подписи, —
     зашитые 50%/47.4% уводили счётчик влево и вверх, и его подложка
     выгрызала белое пятно из левой доли. */
  N.mid.style.left=pcx(C); N.mid.style.top=pcy(C);
  wrap.appendChild(N.mid);
  return wrap;
}
function light(i,by){
  /* подпись только что появилась — проверим, помещается ли она в холст */
  if(N.поправитьКрая){ requestAnimationFrame(function(){ N.поправитьКрая();
    setTimeout(N.поправитьКрая, 260); }); }
  N.w[i].setAttribute('fill-opacity','1'); N.w[i].dataset.on='1';
  const full=S.yasna.p[i];
  N.n[i].textContent=shortName(full); N.n[i].title=full;
  N.n[i].classList.add('on');
  N.h[i].setAttribute('aria-label','Место '+i+': '+full); /* канон: Полки 0…11 */
  if(by===0||by===1) N.n[i].dataset.by=by; else delete N.n[i].dataset.by;
}
function tie(k,col,free){ N.c[k].setAttribute('stroke',col||'var(--k-gold-ink)');
  N.c[k].classList.toggle('free',!!free);
  /* инлайновый opacity перебивал .chord.free{opacity:.55}: подаренная ось
     рисовалась пунктиром, но в полную силу — как заслуженная */
  N.c[k].style.opacity=free?.55:1; N.c[k].classList.add('on'); }
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

/* ═══════════ ВОПРОС С ГЛАГОЛАМИ НА КНОПКАХ ═══════════
   Вместо window.confirm(). В приложении системный confirm рисует «OK» и
   «Cancel» — по-английски и одинаково на любой вопрос: на «Выйти из партии?»
   человек читает «OK» и заново гадает, что он сейчас нажмёт. Здесь на кнопках
   стоят глаголы того самого действия, о котором спрашивают, отказ стоит
   слева и держит фокус, а само окно закрывается по «назад» и по Escape.

   Своя вёрстка, а не общая на приложение: эта страница грузит только krug.js
   и core/*, общего окна в оболочке пока нет (см. поле foreign в отчёте). */
let ВОПРОС=null;
function вопросЖивёт(){ return !!ВОПРОС; }
function стилиВопроса(){
  if(document.getElementById('krug-stili-voprosa')) return;
  const s=document.createElement('style');
  s.id='krug-stili-voprosa';
  s.textContent=
    '.kvopr{position:fixed;inset:0;z-index:9600;display:flex;align-items:center;'+
      'justify-content:center;padding:24px;background:rgba(10,12,16,.32);'+
      '--kv-karta:#fff;--kv-tx:#101418;--kv-akc:#0071e3}'+
    'html[data-theme="dark"] .kvopr{--kv-karta:#232830;--kv-tx:#e8ebee;--kv-akc:#6f9bff}'+
    '@media (prefers-color-scheme:dark){html:not([data-theme]) .kvopr'+
      '{--kv-karta:#232830;--kv-tx:#e8ebee;--kv-akc:#6f9bff}}'+
    '.kvopr-karta{width:100%;max-width:340px;border-radius:28px;padding:22px 22px 10px;'+
      'background:var(--kv-karta);color:var(--kv-tx);'+
      'box-shadow:0 14px 44px rgba(10,12,16,.34)}'+
    '.kvopr-zag{margin:0 0 8px;font-size:20px;line-height:1.28;font-weight:700}'+
    '.kvopr-txt{margin:0;font-size:14.5px;line-height:1.45;opacity:.78}'+
    '.kvopr-ryad{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:6px;margin-top:14px}'+
    '.kvopr-kn{min-height:48px;padding:0 16px;border:0;border-radius:24px;'+
      'background:transparent;color:var(--kv-akc);font-weight:600;font-size:15px;cursor:pointer}'+
    '.kvopr-kn:active{background:color-mix(in srgb,var(--kv-akc) 14%,transparent)}';
  (document.head||document.documentElement).appendChild(s);
}
/* Закрытие без действия — это отказ: так уходит «назад», Escape и тап по фону.
   Фокус возвращается на кнопку, с которой вопрос начался. */
function закрытьВопрос(){
  if(!ВОПРОС) return;
  const в=ВОПРОС; ВОПРОС=null;
  window.removeEventListener('yasna:назад',в.назад);
  document.removeEventListener('keydown',в.клавиша,true);
  if(в.корень&&в.корень.parentNode) в.корень.parentNode.removeChild(в.корень);
  try{ if(в.фокус&&в.фокус.focus) в.фокус.focus(); }catch(_){}
}
/* о: {заголовок, текст, да:'Выйти', нет:'Остаться', наДа} */
function спросить(о){
  if(ВОПРОС) return;                 /* два вопроса разом — это уже не вопрос */
  стилиВопроса();
  const корень=document.createElement('div');
  корень.className='kvopr';
  корень.innerHTML=`<div class="kvopr-karta" role="dialog" aria-modal="true"
      aria-labelledby="kvopr-zag" aria-describedby="kvopr-txt">
    <h2 class="kvopr-zag" id="kvopr-zag">${esc(о.заголовок)}</h2>
    <p class="kvopr-txt" id="kvopr-txt">${esc(о.текст||'')}</p>
    <div class="kvopr-ryad">
      <button class="kvopr-kn" type="button" data-kv="нет">${esc(о.нет)}</button>
      <button class="kvopr-kn" type="button" data-kv="да">${esc(о.да)}</button>
    </div></div>`;
  const состояние={ корень:корень, фокус:document.activeElement };
  корень.querySelector('[data-kv="да"]').onclick=()=>{ закрытьВопрос(); if(о.наДа) о.наДа(); };
  корень.querySelector('[data-kv="нет"]').onclick=закрытьВопрос;
  корень.addEventListener('click',e=>{ if(e.target===корень) закрытьВопрос(); });
  состояние.клавиша=e=>{ if(e.key==='Escape'){ e.preventDefault(); закрытьВопрос(); } };
  /* Пока висит вопрос, «назад» отвечает на него, а не уводит с экрана. */
  состояние.назад=e=>{ e.preventDefault(); закрытьВопрос(); };
  document.addEventListener('keydown',состояние.клавиша,true);
  window.addEventListener('yasna:назад',состояние.назад);
  ВОПРОС=состояние;
  document.body.appendChild(корень);
  try{ корень.querySelector('[data-kv="нет"]').focus(); }catch(_){}
}

/* ═══════════ ЭКРАН 1 · НАСТРОЙКА ═══════════ */
/* Заголовок в шапке — это ответ на вопрос «где я сейчас». Меняется вместе
   с экраном: выбор → название игры, поле → имя разложенной ясны, история →
   «История». Раньше он был неподвижной строкой «Круг · поставь на место». */
function шапка(текст){
  const з=document.getElementById('krug-zagolovok');
  if(з) з.textContent=текст;
}
const ИМЯ_ИГРЫ='Разложи по кругу';

/* Кнопка «История» живёт только на экране выбора: на поле и в самой истории
   ей нечего делать, а место в шапке дорогое. */
function прятатьИсторию(){
  const к=document.getElementById('krug-istoriya');
  if(к) к.hidden=true;
}

function setup(){
  try{ window.scrollTo(0,0) }catch(_){}
  S.scr='setup';
  app().innerHTML=''; app().classList.remove('duo-col');
  шапка(ИМЯ_ИГРЫ);

  /* История переехала в шапку: на экране выбора не должно быть ничего,
     кроме заголовка «Выберите ясну» и самих ясен. */
  const d=load();
  const кнИст=document.getElementById('krug-istoriya');
  if(кнИст){
    кнИст.hidden=!d.games.length;
    кнИст.onclick=history_;
  }

  app().appendChild(el(`<div class="sect">Выберите ясну</div>`));
  const g=el(`<div class="grid"></div>`);
  /* Случайная — такая же карточка, только знак кубика и акцентный тон:
     раньше она отличалась лишь цветом слова и терялась среди прочих. */
  const rnd=el(`<button class="tile tile--rnd" type="button">
    <span class="tile-znak">${znak('__slucha')}</span>
    <span class="tile-txt"><b>Случайная</b></span></button>`);
  rnd.onclick=()=>{ pickYasna(LIST[Math.floor(Math.random()*LIST.length)], true) };
  g.appendChild(rnd);
  LIST.forEach(y=>{
    const bb=bestOf(y.id);
    /* Только название. Подписи «урок автора» / «из материалов» / «лучшее:
       6 из 10» убраны: выбирают ясну по имени, а происхождение строки и
       прошлый счёт к этому выбору отношения не имеют. Освоенное отмечено
       без слов — золотым знаком и тонкой полоской доли верных. */
    const b=el(`<button class="tile${bb!==null?' tile--est':''}" type="button"
      ${bb!==null?`title="лучшее: ${bb} из 10"`:''}>
      <span class="tile-znak">${znak(y.id)}</span>
      <span class="tile-txt"><b>${esc(y.n)}</b></span>
      ${bb!==null?`<span class="tile-put" aria-hidden="true"><i style="width:${bb*10}%"></i></span>`:''}
    </button>`);
    b.onclick=()=>pickYasna(y,false);
    g.appendChild(b);
  });
  app().appendChild(g);
}

function pickYasna(y,isRandom){
  S.yasna=y; S.seed=(Math.random()*1e9)|0; S.random=!!isRandom;
  if(S.preset) return S.mode==='link'?share():start();
  mode();
}

/* ═══════════ ИСТОРИЯ ═══════════ */
function history_(){
  try{ window.scrollTo(0,0) }catch(_){}
  S.scr='history'; app().innerHTML=''; app().classList.remove('duo-col');
  шапка('История'); прятатьИсторию();
  const d=load();
  app().appendChild(el(`<div class="sub" style="margin-top:2px">Партии хранятся на этом
    устройстве и никуда не отправляются.</div>`));
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
  const back=el(`<button class="go">← К выбору ясны</button>`); back.onclick=setup;
  app().appendChild(back);
  if(d.games.length){
    const clr=el(`<button class="gh">Очистить историю</button>`);
    clr.onclick=()=>спросить({
      заголовок:'Удалить историю партий?',
      текст:'Записи хранятся только на этом устройстве — вернуть их будет неоткуда.',
      нет:'Оставить', да:'Удалить',
      наДа:()=>{ try{ localStorage.removeItem(LS) }catch(_){} setup(); }
    });
    app().appendChild(clr);
  }
}

/* ═══════════ ЭКРАН 2 · РЕЖИМ ═══════════ */
function mode(){
  try{ window.scrollTo(0,0) }catch(_){}
  S.scr='mode'; app().innerHTML=''; app().classList.remove('duo-col');
  шапка('Ясна ' + S.yasna.n); прятатьИсторию();
  app().appendChild(el(`<div><h2>Как играем?</h2>
    <div class="sub">${S.random?'Ясна выпала случайно. ':''}Двенадцать мест, шесть осей.</div></div>`));
  const opts=[
    ['solo','Одному','сам себе, ~2 минуты'],
    ['duo','Вдвоём на одном телефоне','ходите по очереди, телефон между вами'],
    ['link','Компанией по ссылке','всем достаётся одна и та же раздача']
  ];
  opts.forEach(([id,t,s])=>{
    const b=el(`<button class="tile" style="min-height:56px;width:100%"><b>${t}</b><i>${s}</i></button>`);
    b.onclick=()=>{ S.mode=id; id==='link'?share():start() };
    app().appendChild(b);
  });
  /* Была перезагрузка страницы, а в адресе к этому моменту мог остаться
     ?y=…&s=… от экрана ссылки — route() поднимал по нему партию, и человек
     получал ясну, которую не выбирал. Чистим адрес и состояние сами. */
  const другая=el(`<button class="gh">← Выбрать другую ясну</button>`);
  другая.onclick=()=>{
    try{ history.replaceState(null,'',location.pathname); }catch(_){}
    S.preset=false; S.invited=false; S.mode=null; S.yasna=null;
    setup();
  };
  app().appendChild(другая);
}

/* ═══════════ ССЫЛКА НА ОДНУ РАЗДАЧУ ═══════════ */
function share(){
  S.scr='share'; app().innerHTML=''; app().classList.remove('duo-col');
  const q='?y='+(SLUG[S.yasna.id]||encodeURIComponent(S.yasna.id))+'&s='+S.seed;
  /* В приложении origin = https://localhost — ссылка мертва у получателя.
     Подставляем живой адрес сайта; на сайте ветка не работает. Домен —
     yasnalab.ru: старый GitHub Pages из московских сетей не открывается. */
  const url=(/YasnaApp\//.test(navigator.userAgent)
    ? 'https://yasnalab.ru/games/krug/index.html'
    : location.origin+location.pathname)+q;
  /* адрес хоста тоже переписываем: иначе после перезагрузки ссылку не переслать */
  try{ history.replaceState(null,'',q) }catch(_){}
  app().appendChild(el(`<div><h2>Одна раздача на всех</h2>
    <div class="sub">Отправь ссылку — у каждого будет та же Ясна и тот же порядок имён.
    Каждый раскладывает у себя.</div></div>`));
  app().appendChild(el(`<div class="say"><div class="hd">Ссылка</div>
    <div class="bd" style="word-break:break-all;font-size:12.5px">${esc(url)}</div></div>`));
  const cp=el(`<button class="go">Скопировать ссылку</button>`);
  cp.onclick=async()=>{ try{ await navigator.clipboard.writeText(url); cp.textContent='Скопировано ✓' }
    catch(e){ cp.textContent='Скопируй вручную ↑' } };
  app().appendChild(cp);
  app().appendChild(el(`<button class="gh" id="kgo">Начать свою раскладку →</button>`));
  document.getElementById('kgo').onclick=start;
  /* Сноска обещала общую комнату «следующим шагом» — срока нет и обещать нечего.
     Говорим, чего нет, и как обойтись тем, что есть. */
  app().appendChild(el(`<div class="note">Общей комнаты, где ответы всех видно сразу,
    в приложении пока нет: итоги сверяйте между собой.</div>`));
}

/* ═══════════ ПАРТИЯ ═══════════ */
function start(){
  S.scr='play'; шапка('Ясна ' + S.yasna.n); прятатьИсторию(); S.i=0; S.placed=new Array(12).fill(false);
  S.first=new Array(12).fill(null); S.by=new Array(12).fill(null); S.miss={}; S.turn=0;
  S.hits=[0,0]; S.tries=[0,0]; S.els=[0,0]; S.axBy=new Array(6).fill(null);
  S.t0=Date.now(); S.logged=false;
  const rnd=mulberry(S.seed);
  /* ноль и шестёрка выдаются даром: это опоры круга, от них считается всё остальное */
  S.deck=shuffled([1,2,3,4,5,7,8,9,10,11],rnd);
  render();
  place(0,true); place(6,true);
  S.vstuplenie=true;
  say('ok','Низ и верх выдаём',
    `<b>${esc(S.yasna.p[0])}</b> — ${POS[0]}. Напротив, на вершине, — <b>${esc(S.yasna.p[6])}</b>.
     Остальные десять поставь сам.`, 'Начали →', ()=>hand());
}

function render(){
  app().innerHTML=''; app().classList.add('duo-col');
  /* Название ясны стоит в шапке экрана, поэтому здесь его больше нет —
     раньше оно повторялось дважды подряд. Остаётся только режим партии:
     во «вдвоём» это подсказка, чей сейчас ход. */
  if(S.mode!=='solo'){
    app().appendChild(el(`<div class="rezhim">${S.mode==='duo'?'вдвоём на одном телефоне':'общая раздача'}</div>`));
  }
  buildRing(app(),onTap);
  app().appendChild(el(`<div id="kbot"></div>`));
  /* восстановить уже поставленное (перерисовка круга) */
  for(let i=0;i<12;i++) if(S.placed[i]) light(i, S.by[i]===null?undefined:S.by[i]);
  /* перерисовка теряла признак подаренной оси — передаём его так же, как в игре */
  for(let k=0;k<6;k++) if(S.placed[k]&&S.placed[k+6])
    tie(k, chordCol(k), S.mode==='duo'&&S.axBy[k]===null);
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
  b.appendChild(prog());
  b.appendChild(el(`<div class="hand">
    ${S.mode==='duo'?`<div class="turnbar t${S.turn}">Ходит ${esc(S.players[S.turn])}</div>`:''}
    <div class="hand-k">имя ${S.i+1} из ${S.deck.length}</div>
    <div class="el">${esc(S.yasna.p[t])}</div>
    <div class="q">Куда на круге?</div></div>`));
  N.mid.innerHTML='<b>'+(S.i+1)+' / '+S.deck.length+'</b>имён';
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
/* Разбор показываем ПОД карточкой элемента, а не вместо неё: раньше в
   момент объяснения исчезало то, о чём объясняют, и приходилось вспоминать,
   какой элемент был в руке. Карточка при этом гаснет — ход уже сделан. */
function say(kind,hd,bd,btn,fn){
  const b=bot();
  const рука=b.querySelector('.hand');
  const прог=b.querySelector('.prog');
  b.innerHTML='';
  if(прог) b.appendChild(прог);
  if(рука){ if(!S.vstuplenie) рука.classList.add('hand--proshlo'); b.appendChild(рука); }
  S.vstuplenie=false;
  const блок=el(`<div class="say ${kind}"><div class="hd">${hd}</div><div class="bd">${bd}</div></div>`);
  b.appendChild(блок);
  const g=el(`<button class="go">${btn||'Дальше →'}</button>`);
  g.onclick=fn||(()=>{ S.i++; if(S.mode==='duo') S.turn=1-S.turn; hand(); });
  b.appendChild(g);
  /* Кнопка теперь липкая, и её низ ВСЕГДА равен экрану минус отступ — прежняя
     проверка «низ кнопки ниже экрана» не срабатывала никогда, а сама кнопка
     стояла поверх карточки разбора. Смотрим на низ КАРТОЧКИ и подводим её к
     глазам, если она уходит под кнопку. */
  /* scrollIntoView({block:'end'}) равняет низ карточки по низу ЭКРАНА, а над
     ним ещё стоит липкая кнопка — последние строки разбора так и оставались
     под ней. Докручиваем ровно на перекрытие. */
  try{
    requestAnimationFrame(function(){
      const кн=g.getBoundingClientRect(), карт=блок.getBoundingClientRect();
      const перекрытие = карт.bottom - кн.top + 12;
      if(перекрытие > 0) window.scrollBy({top: перекрытие, behavior:'smooth'});
    });
  }catch(_){}
}

function place(i,free){
  /* Элемент встал — подсказка промаха про эту долю больше не нужна. */
  if(N.w[i]) N.w[i].classList.remove('podskazka');
  /* Пульс на доле и на её подписи: момент попадания должен быть виден
     боковым зрением, иначе ход «проваливается» в текст разбора. */
  if(!free && N.w[i]){
    N.w[i].classList.remove('sel'); void N.w[i].getBBox;
    N.w[i].classList.add('sel');
    setTimeout(function(){ N.w[i] && N.w[i].classList.remove('sel') }, 620);
    if(N.n[i]){ N.n[i].classList.add('nm-nov');
      setTimeout(function(){ N.n[i] && N.n[i].classList.remove('nm-nov') }, 700); }
  }
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
  /* Показан разбор — круг не принимает ходов. Признак теперь сам разбор:
     карточка элемента при нём остаётся на экране (приглушённой), и проверка
     по её наличию пропускала тап, ломая партию. */
  if(!bot() || bot().querySelector('.say')) return;
  if(S.placed[i]){
    /* Тряска — тот же сигнал, что и у промаха, но там есть разбор, а здесь
       не было ни слова: человек тапал, экран дёргался, и было непонятно,
       ошибся он или место занято. Промах при этом не засчитываем. */
    shake();
    if(N.w[i]){ N.w[i].classList.add('zanyato');
      setTimeout(function(){ N.w[i] && N.w[i].classList.remove('zanyato') }, 620); }
    if(N.n[i]) N.n[i].classList.add('on');
    const кто=S.yasna.p[i];
    say('no','Место занято',
      `Здесь уже стоит «<b>${esc(кто)}</b>». Выберите свободное место.`,
      'Понятно →', ()=>hand());
    return;
  }
  const t=S.deck[S.i], ok=(i===t);
  if(S.mode==='duo'){ S.tries[S.turn]++; if(ok){ S.els[S.turn]++; if(S.first[t]!==false) S.hits[S.turn]++; } }
  S.first[t]= (S.first[t]===false)?false:ok;             /* «с первого раза» помним навсегда */
  if(!ok){
    S.first[t]=false; S.miss[t]=(S.miss[t]||[]).concat(i);
    shake();
    if(N.w[i]){ N.w[i].classList.add('mimo');
      setTimeout(function(){ N.w[i] && N.w[i].classList.remove('mimo') }, 620); }
    /* Разбор называл нужное место словами («первый просвет после дна»), а на
       круге номеров нет — отсчитывать доли в уме приходилось самому. Мягко
       подсвечиваем ту долю, о которой идёт речь: не цветом «верно», а пульсом.
       Таймера нет: пока человек читает разбор, подсказка обязана ждать его —
       снимет её place(), когда элемент действительно встанет на место. */
    if(N.w[t]) N.w[t].classList.add('podskazka');
    say('no','Не сюда',
      `Место ${i}: ${POS[i]}. Там живёт что-то другое.<br><br>
       «<b>${esc(S.yasna.p[t])}</b>» ищи там, где ${POS[t]} — место подсвечено на круге.`,
      'Понял, ставлю →', ()=>hand());
    return;
  }
  place(t);
  const k=t%6, closed=S.placed[k]&&S.placed[k+6];
  say('ok', closed?'Ось сошлась':'На месте',
    closed
      ? `«<b>${esc(S.yasna.p[k])}</b>» и «<b>${esc(S.yasna.p[k+6])}</b>» — два конца одной нитки.<br><br>
         Одно место: ${POS[k]}.<br>Ровно напротив: ${POS[k+6]}.`
      : `«<b>${esc(S.yasna.p[t])}</b>» стоит там, где ${POS[t]}. Напротив пока пусто.`);
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
    /* Нитка засчитывалась тому, кто поставил её второй конец, и по этому
       числу объявлялся победитель — но кому достанется второй конец, решает
       порядок перетасованной колоды, а не игра. Победителя теперь считаем
       по сопоставимому: сколько поставлено с первого раза (при равенстве —
       у кого меньше тапов). Оси остаются как есть, но без вердикта. */
    const ax=[0,0];
    for(let k=0;k<6;k++){ const w=S.axBy[k]; if(w===0||w===1) ax[w]++; }
    const доля=i=>S.els[i]?S.hits[i]/S.els[i]:0;
    let lead=null;
    if(доля(0)!==доля(1)) lead = доля(0)>доля(1) ? 0 : 1;
    else if(S.tries[0]!==S.tries[1]) lead = S.tries[0]<S.tries[1] ? 0 : 1;
    body += `<br><br>С первого раза: <b>${esc(S.players[0])}</b> — ${S.hits[0]} из ${S.els[0]},
      <b>${esc(S.players[1])}</b> — ${S.hits[1]} из ${S.els[1]}. Тапов всего: ${S.tries[0]} и ${S.tries[1]}.`;
    body += lead===null
      ? '<br>Поровну.'
      : `<br>Точнее собирал <b>${esc(S.players[lead])}</b>.`;
    body += `<br><br>Оси замыкали: ${esc(S.players[0])} — ${ax[0]}, ${esc(S.players[1])} — ${ax[1]}
      <span style="color:var(--k-tx3)">(кому достанется второй конец, решает раздача)</span>.`;
  }
  b.appendChild(el(`<div class="say ok"><div class="hd">Готово</div><div class="bd">${body}</div></div>`));

  if(missed.length){
    const t=el(`<div class="say"><div class="hd">Что путал</div>
      <table class="res"></table>
      <div class="bd" style="margin-top:8px;font-size:12.5px;color:var(--k-tx3)">
      Слева — имя, справа — место, куда ты его отправил в первый раз.</div></div>`);
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
  /* ?yasna=<id> — заход с «Уроков» и из финалов уроков: одиночная партия
     по выбранному явлению со случайной раздачей. Раньше эту метку не читал
     никто, и «Разложить Сутки» открывало экран выбора ясны. */
  const прямо=u.get('yasna');
  if(прямо){
    const y=LIST.find(x=>x.id===прямо||x.id===decodeURIComponent(прямо));
    if(y){ S.yasna=y; S.seed=(Math.random()*1e9)|0; S.mode='solo'; S.invited=false; return start(); }
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
  // Кнопка «назад» телефона: регистрируем ОДИН раз (раньше — внутри route(),
  // и каждый hashchange добавлял дубликат слушателя).
  window.addEventListener('yasna:назад', function (e) {
    if (e.defaultPrevented) return;
    /* Вопрос уже висит — на него и отвечает «назад» (окно гасит событие само,
       см. спросить). Иначе второе нажатие открыло бы второй такой же вопрос. */
    if (вопросЖивёт()) return;
    if (S.scr && S.scr !== 'setup') { e.preventDefault(); назадНаВыбор(); }
  });

  /* Вкладка наббара партию не крадёт. Оболочка перед сменой вкладки шлёт
     отменяемое yasna:уход — тем же способом, что и «назад». Раньше промах по
     нижней полосе стирал раскладку молча, а стрелка в шапке о том же самом
     спрашивала: одно действие вело себя двумя способами. */
  window.addEventListener('yasna:уход', function (e) {
    if (e.defaultPrevented) return;
    if (вопросЖивёт()) { e.preventDefault(); return; }
    if (!(S.scr === 'play' && S.i > 0)) return;
    e.preventDefault();
    var куда = (e.detail && e.detail.куда) || '';
    спросить({
      заголовок: 'Выйти из партии?', текст: 'Раскладка не сохранится.',
      нет: 'Остаться', да: 'Выйти',
      наДа: function () {
        if (window.yasnaNav) window.yasnaNav.корень(куда);
        else if (куда) location.href = куда;
      }
    });
  });

  /* Стрелка в шапке вела на Главную с любого экрана — из середины партии она
     выбрасывала наружу, и раскладка пропадала без вопроса (запись в историю
     делает только finish). Теперь стрелка ведёт себя как системная «назад»:
     с игровых экранов возвращает к выбору ясны, и только с самого выбора —
     наружу. Из начатой партии спрашиваем подтверждение. */
  function назадНаВыбор(){
    /* Пришли из «Уроков» (?otkuda=uroki) и не поставили ни одного элемента:
       экрана «Выберите ясну» человек не видел, вести туда — тупик. Первый
       «Назад» возвращает в уроки; после первого хода — обычный путь. */
    try{
      if (new URLSearchParams(location.search||'').get('otkuda') === 'uroki'
          && S.scr === 'play' && S.i === 0) {
        location.href = '../../learn.html'; return;
      }
    }catch(_){}
    if (S.scr === 'play' && S.i > 0) {
      спросить({
        заголовок: 'Выйти из партии?', текст: 'Раскладка не сохранится.',
        нет: 'Остаться', да: 'Выйти', наДа: кВыбору
      });
      return;
    }
    кВыбору();
  }
  /* Сам выход: отдельно от вопроса, потому что вопрос отвечает не сразу и
     звать его надо из двух мест — из кнопки окна и напрямую. */
  function кВыбору(){
    try { history.replaceState(null, '', location.pathname); } catch (_) {}
    S.preset = false; S.invited = false;
    setup(); window.scrollTo(0, 0);
  }
  (function стрелка(){
    const кн = document.getElementById('krug-nazad');
    if (!кн) return;
    кн.addEventListener('click', function (e) {
      if (S.scr && S.scr !== 'setup') { e.preventDefault(); назадНаВыбор(); }
    });
  })();
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
