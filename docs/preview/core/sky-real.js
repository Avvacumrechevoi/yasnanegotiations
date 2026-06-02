// ═══════════════════════════════════════════════════════════════════
//  sky-real.js — реальное звёздное небо поверх модели Ясны (3D).
//  window.YasnaSkyReal: загрузка каталога + построение THREE-объектов.
//  ──────────────────────────────────────────────────────────────────
//  Координаты сцены (см. yasna-3d.js): ось Y — ось мира (Полярная в +Y),
//  экватор — плоскость XZ, точка весеннего равноденствия (RA=0) — +X,
//  RA растёт ВЕСНА(+X)→ЛЕТО(+Z)→ОСЕНЬ(−X)→ЗИМА(−Z) (как эклиптика модели).
//      X = R·cosδ·cos(α) ; Y = R·sinδ ; Z = R·cosδ·sin(α) ; α=RA(рад)
//  Звёзды лежат внутри wheelGroup → суточное вращение наследуется само.
//  ──────────────────────────────────────────────────────────────────
//  Данные: HYG (CC0, до 6.5ᵐ) + линии созвездий d3-celestial (BSD-2,
//  © Olaf Frohn). Загружаются лениво из data/sky-*.json (не в бандле).
// ═══════════════════════════════════════════════════════════════════
(function(){
  'use strict';

  // RA в ГРАДУСАХ, Dec в градусах → вектор на сфере радиуса R.
  function raDecToVec(raDeg, decDeg, R){
    const a = raDeg * Math.PI/180, d = decDeg * Math.PI/180;
    const cd = Math.cos(d);
    return [ R*cd*Math.cos(a), R*Math.sin(d), R*cd*Math.sin(a) ];
  }

  // ─── ленивая загрузка JSON (кэш) ───
  const _cache = {};
  function loadJSON(url){
    if(_cache[url]) return _cache[url];
    _cache[url] = fetch(url).then(r => { if(!r.ok) throw new Error('fetch '+url+' '+r.status); return r.json(); });
    return _cache[url];
  }
  const loadStars = () => loadJSON('data/sky-stars.json');
  const loadConstellations = () => loadJSON('data/sky-constellations.json');

  // ─── цвет звезды по индексу B−V (ci) ───
  function bvToRGB(ci){
    if(ci == null || isNaN(ci)) ci = 0.5;
    // мягкая аппроксимация: горячие (B−V<0) — голубые, холодные (>1.4) — красно-оранжевые
    let r,g,b;
    if(ci < 0.0){ r=0.66; g=0.74; b=1.0; }
    else if(ci < 0.3){ r=0.82; g=0.86; b=1.0; }
    else if(ci < 0.58){ r=0.97; g=0.97; b=1.0; }
    else if(ci < 0.81){ r=1.0; g=0.97; b=0.86; }
    else if(ci < 1.15){ r=1.0; g=0.89; b=0.70; }
    else if(ci < 1.5){ r=1.0; g=0.80; b=0.58; }
    else { r=1.0; g=0.72; b=0.52; }
    return [r,g,b];
  }

  // ─── шейдер круглых точек: per-vertex size + color, аддитивное свечение ───
  function starMaterial(THREE){
    return new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      uniforms:{ uPix:{ value: 260.0 } },
      vertexShader:`
        attribute float size; attribute vec3 color; varying vec3 vColor; uniform float uPix;
        void main(){ vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize = size * (uPix / -mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`
        varying vec3 vColor;
        void main(){ vec2 c=gl_PointCoord-vec2(0.5); float d=length(c); if(d>0.5) discard;
          float a=smoothstep(0.5,0.08,d); gl_FragColor=vec4(vColor,a); }`
    });
  }

  // ─── звёздное поле (THREE.Points) ───
  function buildStars(THREE, R, cat){
    const stars = cat.stars; const n = stars.length;
    const pos = new Float32Array(n*3), col = new Float32Array(n*3), siz = new Float32Array(n);
    const Rs = R + 2; // чуть снаружи каркаса
    for(let i=0;i<n;i++){
      const s = stars[i]; // [raHours, dec, mag, ci, hip]
      const v = raDecToVec(s[0]*15, s[1], Rs);
      pos[i*3]=v[0]; pos[i*3+1]=v[1]; pos[i*3+2]=v[2];
      const c = bvToRGB(s[3]); col[i*3]=c[0]; col[i*3+1]=c[1]; col[i*3+2]=c[2];
      // размер по звёздной величине: ярче → крупнее (mag −1.5…6.5)
      siz[i] = Math.max(0.7, 4.6 - 0.62*(s[2]+1.5));
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geom.setAttribute('color', new THREE.BufferAttribute(col,3));
    geom.setAttribute('size', new THREE.BufferAttribute(siz,1));
    const pts = new THREE.Points(geom, starMaterial(THREE));
    pts.frustumCulled = false;
    return pts;
  }

  // ─── линии созвездий (THREE.LineSegments) ───
  function buildConstellations(THREE, R, con){
    const segPos = [];
    const Rc = R + 1;
    con.constellations.forEach(c => {
      c.paths.forEach(path => {
        for(let i=0;i+1<path.length;i++){
          const a = raDecToVec(path[i][0],   path[i][1],   Rc);
          const b = raDecToVec(path[i+1][0], path[i+1][1], Rc);
          segPos.push(a[0],a[1],a[2], b[0],b[1],b[2]);
        }
      });
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segPos),3));
    const mat = new THREE.LineBasicMaterial({ color:0x5aa0ff, transparent:true, opacity:0.34 });
    const seg = new THREE.LineSegments(geom, mat);
    seg.frustumCulled = false;
    return seg;
  }

  // ─── подписи ярких звёзд (sprite-метки) ───
  function buildNames(THREE, R, cat, makeLabelSprite, maxMag){
    const g = new THREE.Group();
    if(!makeLabelSprite) return g;
    maxMag = (maxMag==null) ? 2.2 : maxMag;
    const byHip = {};
    cat.stars.forEach(s => { if(s[4]) byHip[s[4]] = s; });
    Object.keys(cat.names).forEach(hip => {
      const s = byHip[hip]; if(!s || s[2] > maxMag) return;
      const v = raDecToVec(s[0]*15, s[1], R + 6);
      const sp = makeLabelSprite(cat.names[hip], { color:'#cfe0ff', fontSize:38, weight:'600', depthTest:false });
      if(!sp) return;
      sp.position.set(v[0], v[1], v[2]);
      const h = 7; sp.scale.set(h*(sp.userData.aspect||4), h, 1);
      g.add(sp);
    });
    return g;
  }

  // ═══ Эфемериды: Солнце, Луна, планеты (геоцентрические RA/Dec) ═══
  // Планеты — кеплеровы элементы JPL (1800-2050), точность ~угл.минуты.
  const D2R = Math.PI/180, R2D = 180/Math.PI;
  function julianDay(date){ return date.getTime()/86400000 + 2440587.5; }
  function rev(x){ x = x % 360; return x < 0 ? x+360 : x; }
  function obliquity(T){ return 23.439291 - 0.0130042*T; } // град

  // a(au),e,I,L,ϖ,Ω + их вековые скорости (JPL approx elements)
  const PLAN = {
    Mercury:[0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593, 0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081],
    Venus:  [0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255, 0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418],
    Earth:  [1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0.0, 0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0.0],
    Mars:   [1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891, 0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343],
    Jupiter:[5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909, -0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106],
    Saturn: [9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448, -0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794],
    Uranus: [19.18916464,0.04725744,0.77263783,313.23810451,170.95427630,74.01692503, -0.00196176,-0.00004397,-0.00242939,428.48202785,0.40805281,0.04240589],
    Neptune:[30.06992276,0.00859048,1.77004347,-55.12002969,44.96476227,131.78422574, 0.00026291,0.00005105,0.00035372,218.45945325,-0.32241464,-0.00508664],
  };
  function helio(name, T){
    const E = PLAN[name];
    const a=E[0]+E[6]*T, e=E[1]+E[7]*T, I=(E[2]+E[8]*T)*D2R,
          L=E[3]+E[9]*T, peri=E[4]+E[10]*T, node=E[5]+E[11]*T;
    const M=rev(L-peri)*D2R, w=(peri-node)*D2R, Om=node*D2R;
    let Ecc=M; for(let k=0;k<10;k++){ Ecc = Ecc-(Ecc-e*Math.sin(Ecc)-M)/(1-e*Math.cos(Ecc)); }
    const xv=a*(Math.cos(Ecc)-e), yv=a*Math.sqrt(1-e*e)*Math.sin(Ecc);
    const cw=Math.cos(w),sw=Math.sin(w),cO=Math.cos(Om),sO=Math.sin(Om),ci=Math.cos(I),si=Math.sin(I);
    return [ (cw*cO-sw*sO*ci)*xv + (-sw*cO-cw*sO*ci)*yv,
             (cw*sO+sw*cO*ci)*xv + (-sw*sO+cw*cO*ci)*yv,
             (sw*si)*xv + (cw*si)*yv ];
  }
  function eclToRaDec(x,y,z,T){
    const eps=obliquity(T)*D2R;
    const ye=y*Math.cos(eps)-z*Math.sin(eps), ze=y*Math.sin(eps)+z*Math.cos(eps);
    return { ra: rev(Math.atan2(ye,x)*R2D), dec: Math.atan2(ze, Math.sqrt(x*x+ye*ye))*R2D };
  }
  function planetRaDec(name, jd){
    const T=(jd-2451545)/36525, e=helio('Earth',T), p=helio(name,T);
    return eclToRaDec(p[0]-e[0], p[1]-e[1], p[2]-e[2], T);
  }
  function sunRaDec(jd){
    const T=(jd-2451545)/36525, e=helio('Earth',T);
    return eclToRaDec(-e[0],-e[1],-e[2], T);
  }
  function moonRaDec(jd){ // Meeus, сокращённые главные члены
    const T=(jd-2451545)/36525;
    const Lp=218.3164477+481267.88123421*T, D=297.8501921+445267.1114034*T,
          M=357.5291092+35999.0502909*T, Mp=134.9633964+477198.8675055*T, F=93.272095+483202.0175233*T;
    const d=rev(D)*D2R,m=rev(M)*D2R,mp=rev(Mp)*D2R,f=rev(F)*D2R;
    const lon=(Lp + 6.289*Math.sin(mp) + 1.274*Math.sin(2*d-mp) + 0.658*Math.sin(2*d)
      + 0.214*Math.sin(2*mp) - 0.186*Math.sin(m) - 0.114*Math.sin(2*f))*D2R;
    const lat=(5.128*Math.sin(f) + 0.281*Math.sin(mp+f) + 0.278*Math.sin(mp-f) + 0.173*Math.sin(2*d-f))*D2R;
    return eclToRaDec(Math.cos(lat)*Math.cos(lon), Math.cos(lat)*Math.sin(lon), Math.sin(lat), T);
  }

  // ─── Солнечная система: маркеры Солнца/Луны/планет на дату ───
  function buildSolarSystem(THREE, R, date, makeLabelSprite){
    const g = new THREE.Group();
    const jd = julianDay(date || new Date());
    const bodies = [
      {n:'Солнце', f:()=>sunRaDec(jd),            c:0xFFD24A, s:6.0},
      {n:'Луна',   f:()=>moonRaDec(jd),           c:0xD7DEE8, s:4.6},
      {n:'Меркурий',f:()=>planetRaDec('Mercury',jd),c:0xB7A98E, s:2.6},
      {n:'Венера', f:()=>planetRaDec('Venus',jd),   c:0xF5E7B6, s:3.6},
      {n:'Марс',   f:()=>planetRaDec('Mars',jd),    c:0xE3673B, s:3.0},
      {n:'Юпитер', f:()=>planetRaDec('Jupiter',jd), c:0xE9C79C, s:4.2},
      {n:'Сатурн', f:()=>planetRaDec('Saturn',jd),  c:0xEAD9A2, s:3.8},
      {n:'Уран',   f:()=>planetRaDec('Uranus',jd),  c:0xA6DCE6, s:2.6},
      {n:'Нептун', f:()=>planetRaDec('Neptune',jd), c:0x6E86E6, s:2.6},
    ];
    bodies.forEach(b=>{
      const rd=b.f(); const v=raDecToVec(rd.ra, rd.dec, R+3);
      const m=new THREE.Mesh(new THREE.SphereGeometry(b.s,18,12),
        new THREE.MeshBasicMaterial({color:b.c}));
      m.position.set(v[0],v[1],v[2]); g.add(m);
      if(makeLabelSprite){
        const sp=makeLabelSprite(b.n, {color:'#'+b.c.toString(16).padStart(6,'0'), fontSize:40, weight:'700', depthTest:false});
        if(sp){ const vl=raDecToVec(rd.ra, rd.dec, R+13); sp.position.set(vl[0],vl[1],vl[2]);
          const h=8; sp.scale.set(h*(sp.userData.aspect||4), h, 1); g.add(sp); }
      }
    });
    return g;
  }

  window.YasnaSkyReal = {
    raDecToVec, loadStars, loadConstellations,
    buildStars, buildConstellations, buildNames,
    julianDay, sunRaDec, moonRaDec, planetRaDec, buildSolarSystem,
  };
})();
