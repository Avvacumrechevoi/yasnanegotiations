// ═══════════════════════════════════════════════════════════════════
// YASNA 3D VIEW — Three.js-based interactive sphere
// Extracted from core/yasna-star.js (Layer 2 component).
// Зависимости: window.YasnaData (для opp, rad), window.THREE (Three.js r128).
// Экспортирует: window.Yasna3DView, window.YasnaSprites { makeTextSprite,
//                makeLabelSprite, makeDigitSprite }.
// ═══════════════════════════════════════════════════════════════════

(function(){

const { opp, rad } = window.YasnaData;

function Yasna3DView({ y, af, sel, onSel, rotationOn, speedSec, drill, onDrill, subPolki, solidMech, showCage }){
  const canvasRef = React.useRef(null);
  // На мобиле стартовый camDist больше — чтобы весь шар помещался в узкую portrait-область
  const initCamDist = (typeof window!=='undefined' && window.innerWidth <= 768) ? 820 : 560;
  const stateRef = React.useRef({
    camAzim: 0, camElev: 24, camDist: initCamDist,
    isDragging: false, lastX: 0, lastY: 0,
  });
  const sceneRefs = React.useRef(null);
  // Свежие props для animate-loop (избегаем stale closure)
  const liveRef = React.useRef({ rotationOn, speedSec, sel, drill, af, solidMech, showCage });
  React.useEffect(()=>{ liveRef.current = { rotationOn, speedSec, sel, drill, af, solidMech, showCage }; }, [rotationOn, speedSec, sel, drill, solidMech, showCage, JSON.stringify(af||[])]);

  React.useEffect(()=>{
    if(typeof window==='undefined' || !window.THREE) return;
    const THREE = window.THREE;
    const canvas = canvasRef.current;
    if(!canvas) return;

    // Адаптация под устройство — экономим ресурсы на мобильных и слабых машинах
    const isMobile = window.innerWidth <= 768;
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const lowPerf = isMobile || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    const Q = lowPerf ? {
      pxRatio: 2,
      polkaSegW: 56, polkaSegH: 40,
      auraSegW: 20, auraSegH: 14,
      poleSegW: 32, poleSegH: 24,
      cageSegW: 28, cageSegH: 18,
      torusTubeSegs: 80, torusTube: 12,
      stars: 700,
    } : {
      pxRatio: 3,
      polkaSegW: 96, polkaSegH: 64,
      auraSegW: 32, auraSegH: 24,
      poleSegW: 48, poleSegH: 36,
      cageSegW: 40, cageSegH: 28,
      torusTubeSegs: 144, torusTube: 16,
      stars: 1500,
    };

    // alpha: true — canvas прозрачный, фон страницы виден сквозь него.
    // Это устраняет «прямоугольник» более тёмного цвета внутри тёмной страницы.
    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, Q.pxRatio));
    renderer.setClearColor(0x000000, 0);  // прозрачный clear color
    if(THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    // Кинематографический tone mapping
    if(THREE.ACESFilmicToneMapping !== undefined){
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.92;
    }

    const scene = new THREE.Scene();
    // НЕ ставим scene.background — пусть фон страницы (body) просвечивает.
    // Туман оставляем — он работает на дальние объекты (звёзды) для глубины.
    scene.fog = new THREE.Fog(0x0a0b0d, 600, 2000);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 5000);

    // ──────────────── Звёздное поле (1500 звёзд на дальней сфере) ────────────────
    {
      const starsGeom = new THREE.BufferGeometry();
      const positions = [];
      const colors = [];
      for(let i = 0; i < Q.stars; i++){
        const r = 1400 + Math.random() * 800;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        positions.push(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        );
        // Лёгкий разброс по цвету: голубоватые/белые/тёплые звёзды
        const t = Math.random();
        if(t < 0.1){ colors.push(0.9, 0.85, 1.0); }      // голубые
        else if(t < 0.25){ colors.push(1.0, 0.95, 0.85); } // тёплые
        else { colors.push(1.0, 1.0, 1.0); }              // белые
      }
      starsGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      starsGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const starsMat = new THREE.PointsMaterial({
        size: 2.8, sizeAttenuation: true, transparent: true, opacity: 0.92,
        vertexColors: true,
      });
      scene.add(new THREE.Points(starsGeom, starsMat));
    }
    // Туманность — лёгкое свечение на дальнем плане
    {
      const nebulaGeom = new THREE.SphereGeometry(1800, 32, 24);
      const nebulaMat = new THREE.MeshBasicMaterial({
        color: 0x2a1a4a, transparent: true, opacity: 0.18, side: THREE.BackSide,
      });
      scene.add(new THREE.Mesh(nebulaGeom, nebulaMat));
    }

    // ──────────────── Освещение (премиум-качество) ────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
    keyLight.position.set(3, 5, 4); scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x6088ee, 0.38);
    fillLight.position.set(-4, 2, -2); scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffba88, 0.55);
    rimLight.position.set(0, -3, -5); scene.add(rimLight);
    scene.add(new THREE.HemisphereLight(0xc0d0ff, 0x202032, 0.18));
    // Простой env-map для качественных металлических отражений (без зависимостей)
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const skyScene = new THREE.Scene();
      skyScene.background = new THREE.Color(0x141828);
      const envMap = pmremGenerator.fromScene(skyScene, 0.02).texture;
      scene.environment = envMap;
      pmremGenerator.dispose();
    } catch(e) { /* env-map опционален */ }

    // ──────────────── Геометрия конструкции ────────────────
    const R = 200;
    const polkaR = 11;
    const POLE_Y = R * 0.65;
    const wheelGroup = new THREE.Group();
    scene.add(wheelGroup);

    const equatorPos = (i) => {
      const a = (270 - i*30) * Math.PI/180;
      return new THREE.Vector3(R*Math.cos(a), 0, -R*Math.sin(a));
    };
    const NORTH = new THREE.Vector3(0, POLE_Y, 0);
    const SOUTH = new THREE.Vector3(0, -POLE_Y, 0);

    const makeTube = (a, b, radius, material) => {
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      if(len < 0.1) return null;
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const geom = new THREE.CylinderGeometry(radius, radius, len, 10, 1, false);
      const mesh = new THREE.Mesh(geom, material);
      mesh.position.copy(mid);
      const axis = new THREE.Vector3(0,1,0);
      const norm = dir.clone().normalize();
      const cross = new THREE.Vector3().crossVectors(axis, norm);
      const dot = axis.dot(norm);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if(cross.lengthSq() > 0.0001) mesh.setRotationFromAxisAngle(cross.normalize(), angle);
      return mesh;
    };

    // ──────────────── Каркасная сфера-обёртка ────────────────
    const cageGeom = new THREE.SphereGeometry(R+polkaR*1.5, Q.cageSegW, Q.cageSegH);
    const cageMat = new THREE.MeshBasicMaterial({ color:0x6068a0, wireframe:true, transparent:true, opacity:0.07 });
    const cageMesh = new THREE.Mesh(cageGeom, cageMat);
    wheelGroup.add(cageMesh);

    const equatorTube = new THREE.Mesh(
      new THREE.TorusGeometry(R, 0.7, Q.torusTube, Q.torusTubeSegs),
      new THREE.MeshStandardMaterial({ color:0xb8a8d8, opacity:0.75, transparent:true, metalness:0.7, roughness:0.25, emissive:0x4030a0, emissiveIntensity:0.10 })
    );
    equatorTube.rotation.x = Math.PI/2;
    wheelGroup.add(equatorTube);
    // Сохраняем ссылку для adaptive opacity (при многих активных механиках — приглушаем)


    for(let i=0; i<12; i+=3){
      const p = equatorPos(i);
      const meridianMat = new THREE.MeshBasicMaterial({ color:0xb8a8d8, transparent:true, opacity:0.20 });
      const t1 = makeTube(NORTH, p, 0.35, meridianMat); if(t1) wheelGroup.add(t1);
      const t2 = makeTube(p, SOUTH, 0.35, meridianMat); if(t2) wheelGroup.add(t2);
    }

    const pillar = makeTube(
      new THREE.Vector3(0, POLE_Y*1.05, 0),
      new THREE.Vector3(0, -POLE_Y*1.05, 0),
      0.9,
      new THREE.MeshStandardMaterial({ color:0x8a4dad, opacity:0.55, transparent:true, metalness:0.6, roughness:0.2, emissive:0x6c3a8e, emissiveIntensity:0.16 })
    );
    if(pillar) wheelGroup.add(pillar);

    const poleMat = new THREE.MeshStandardMaterial({
      color:0x8a4dad, roughness:0.18, metalness:0.7,
      emissive:0x8a4dad, emissiveIntensity:0.18,
    });
    const poleGeom = new THREE.SphereGeometry(polkaR*0.7, Q.poleSegW, Q.poleSegH);
    const northBall = new THREE.Mesh(poleGeom, poleMat);
    northBall.position.copy(NORTH); wheelGroup.add(northBall);
    const southBall = new THREE.Mesh(poleGeom, poleMat);
    southBall.position.copy(SOUTH); wheelGroup.add(southBall);

    const npLabel = makeTextSprite('Зенит', '#d8b8ff', 56, '600');
    npLabel.position.set(0, POLE_Y + polkaR*1.8, 0);
    npLabel.scale.set(80, 20, 1); wheelGroup.add(npLabel);
    const spLabel = makeTextSprite('Надир', '#d8b8ff', 56, '600');
    spLabel.position.set(0, -POLE_Y - polkaR*1.8, 0);
    spLabel.scale.set(80, 20, 1); wheelGroup.add(spLabel);

    // ──────────────── 12 шаров-полок ────────────────
    // Премиум-палитра планетных цветов:
    //   Опорный  — глубокий карминовый (как Марс)
    //   Управления — янтарь / золото (как Сатурн)
    //   Веры     — глубокий кобальт (как Нептун)
    const polkaColor = (i) => {
      if([0,3,6,9].includes(i)) return 0xb83547;       // Crimson Mars
      if([1,4,7,10].includes(i)) return 0xd4a23c;      // Saturn Amber
      return 0x4a7ec0;                                  // Neptune Cobalt
    };

    const polki = [];
    for(let i=0; i<12; i++){
      const pos = equatorPos(i);
      const baseColor = polkaColor(i);
      const planetMat = new THREE.MeshStandardMaterial({
        color: baseColor, roughness: 0.32, metalness: 0.55,
        emissive: baseColor, emissiveIntensity: 0.15,
      });
      const planet = new THREE.Mesh(new THREE.SphereGeometry(polkaR, Q.polkaSegW, Q.polkaSegH), planetMat);
      planet.position.copy(pos);
      planet.userData.polkaIdx = i;
      wheelGroup.add(planet);

      const auraMat = new THREE.MeshBasicMaterial({
        color: baseColor, transparent:true, opacity:0.16, side:THREE.BackSide
      });
      const aura = new THREE.Mesh(new THREE.SphereGeometry(polkaR*1.22, Q.auraSegW, Q.auraSegH), auraMat);
      planet.add(aura);

      // Цифра полки — высококонтрастная, читается с любого ракурса
      const num = makeDigitSprite(i, { size: 256, color: '#ffffff', stroke: 'rgba(15,8,30,0.95)', depthTest: false });
      num.position.set(0, 0, polkaR*0.05);  // прямо в центре, sprite всегда повёрнут к камере
      num.scale.set(polkaR*1.7, polkaR*1.7, 1);
      planet.add(num);

      const label = (y && y.p && y.p[i]) || '';
      if(label){
        // Полное название — без обрезки. Шрифт крупный + обводка + halo для контраста
        const lbl = makeLabelSprite(label, {
          fontSize: isMobile ? 72 : 64,
          weight: '700',
          color: '#ffffff',
          depthTest: false,  // всегда поверх — не скрывается за каркасом или полкой
        });
        const direction = pos.clone().normalize();
        const offsetMul = isMobile ? 4.4 : 3.8;
        const lblPos = pos.clone().add(direction.multiplyScalar(polkaR*offsetMul));
        lbl.position.copy(lblPos);
        lbl.position.y = isMobile ? 26 : 20;
        // World-height пропорциональна полке, ширина — по aspect-ratio canvas
        const lblH = isMobile ? 18 : 16;
        const lblW = lblH * lbl.userData.aspect;
        lbl.scale.set(lblW, lblH, 1);
        wheelGroup.add(lbl);
      }
      polki.push(planet);
    }

    // ──────────────── Mechanics — 3D-полиэдры ────────────────
    const mechGroup = new THREE.Group();
    wheelGroup.add(mechGroup);

    const tubeMat = (color, opacity) => new THREE.MeshStandardMaterial({
      color, transparent:true, opacity, metalness:0.7, roughness:0.15,
      emissive:color, emissiveIntensity:0.45,
      depthWrite: false,  // избегаем z-fighting между прозрачными трубками
    });

    function makeBipyramid(indices, color, opacity, solid){
      const grp = new THREE.Group();
      const pts = indices.map(i => equatorPos(i));
      const mat = tubeMat(color, opacity);
      // Каркас рёбер
      for(let k=0; k<pts.length; k++){
        const next = pts[(k+1) % pts.length];
        const t = makeTube(pts[k], next, solid?0.6:1.1, mat); if(t) grp.add(t);
        const tN = makeTube(pts[k], NORTH, solid?0.5:0.9, mat); if(tN) grp.add(tN);
        const tS = makeTube(pts[k], SOUTH, solid?0.5:0.9, mat); if(tS) grp.add(tS);
      }
      const apexGeom = new THREE.SphereGeometry(2.2, 16, 12);
      const apexMat = tubeMat(color, Math.min(opacity*1.5, 1));
      const apexN = new THREE.Mesh(apexGeom, apexMat); apexN.position.copy(NORTH); grp.add(apexN);
      const apexS = new THREE.Mesh(apexGeom.clone(), apexMat); apexS.position.copy(SOUTH); grp.add(apexS);
      // ── Сплошная заливка: треугольные грани бипирамиды ──
      // Бипирамида имеет 2N треугольников: N верхних (NORTH-a-b) + N нижних (SOUTH-b-a).
      // Геометрия строится через BufferGeometry с авто-нормалями.
      if(solid){
        const positions = [];
        const N = pts.length;
        for(let k=0; k<N; k++){
          const a = pts[k];
          const b = pts[(k+1) % N];
          // Верхний треугольник: NORTH → a → b (CCW снаружи)
          positions.push(NORTH.x, NORTH.y, NORTH.z);
          positions.push(a.x,     a.y,     a.z);
          positions.push(b.x,     b.y,     b.z);
          // Нижний треугольник: SOUTH → b → a (CCW снаружи, обратный порядок)
          positions.push(SOUTH.x, SOUTH.y, SOUTH.z);
          positions.push(b.x,     b.y,     b.z);
          positions.push(a.x,     a.y,     a.z);
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.computeVertexNormals();
        const fillMat = new THREE.MeshStandardMaterial({
          color, transparent:true, opacity: 0.55,
          metalness: 0.55, roughness: 0.30,
          emissive: color, emissiveIntensity: 0.20,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const fillMesh = new THREE.Mesh(geom, fillMat);
        grp.add(fillMesh);
      }
      return grp;
    }

    function makeTetrahedron(p1, p2, p3, p4, color, opacity){
      const grp = new THREE.Group();
      const mat = tubeMat(color, opacity);
      const edges = [[p1,p2],[p2,p3],[p3,p1],[p1,p4],[p2,p4],[p3,p4]];
      edges.forEach(([a,b])=>{ const t=makeTube(a,b,0.55,mat); if(t)grp.add(t); });
      return grp;
    }

    // ──────────────── Sub-Yasna (drill-down 3D) ────────────────
    // Группа вложенной мини-Ясны, появляется при drill !== null у позиции выбранной полки.
    const drillGroup = new THREE.Group();
    drillGroup.visible = false;
    drillGroup.scale.set(0.001, 0.001, 0.001);
    wheelGroup.add(drillGroup);

    const subPolkiArr = []; // sub-шары для raycasting
    const subPolkiLabels = [];

    // Палитра sub-полок — мягче основных, чтобы был контраст
    const subPolkaColor = (i) => {
      if([0,3,6,9].includes(i)) return 0xff6478;
      if([1,4,7,10].includes(i)) return 0xfac266;
      return 0x80aae0;
    };

    function buildDrillGroup(drillIdx, subData){
      // Очищаем старое — disposeм рекурсивно (защита от утечки текстур цифр)
      while(drillGroup.children.length){
        const c = drillGroup.children[0];
        c.traverse(node=>{
          if(node.geometry) node.geometry.dispose();
          if(node.material){
            const disp = (m)=>{
              if(m.map && typeof m.map.dispose === 'function') m.map.dispose();
              m.dispose();
            };
            if(Array.isArray(node.material)) node.material.forEach(disp); else disp(node.material);
          }
        });
        drillGroup.remove(c);
      }
      subPolkiArr.length = 0;
      subPolkiLabels.length = 0;
      if(drillIdx == null) return;

      // Размер мини-Ясны: компактный, не пересекается с основным экватором
      const subR = polkaR * 2.8;
      const subPolkaR = polkaR * 0.40;

      // Каркасная сфера (тонкая, для глубины)
      const subCage = new THREE.Mesh(
        new THREE.SphereGeometry(subR + subPolkaR*1.2, 18, 12),
        new THREE.MeshBasicMaterial({ color:0xa388e0, wireframe:true, transparent:true, opacity:0.18 })
      );
      drillGroup.add(subCage);

      // Экватор
      const subEquator = new THREE.Mesh(
        new THREE.TorusGeometry(subR, 0.4, 10, 64),
        new THREE.MeshStandardMaterial({ color:0xa388e0, opacity:0.7, transparent:true, metalness:0.6, roughness:0.3, emissive:0x6c4dad, emissiveIntensity:0.3 })
      );
      subEquator.rotation.x = Math.PI/2;
      drillGroup.add(subEquator);

      // Маленький столп вверх-вниз
      const subPoleY = subR * 0.65;
      const pillarMat = new THREE.MeshStandardMaterial({ color:0xb88de0, opacity:0.5, transparent:true, metalness:0.55, roughness:0.25, emissive:0x6c3a8e, emissiveIntensity:0.3 });
      const pillarGeom = new THREE.CylinderGeometry(0.4, 0.4, subPoleY*2.2, 8, 1, false);
      const subPillar = new THREE.Mesh(pillarGeom, pillarMat);
      drillGroup.add(subPillar);

      // 12 sub-полок-шариков на экваторе
      for(let i=0; i<12; i++){
        const a = (270 - i*30) * Math.PI/180;
        const px = subR*Math.cos(a), pz = -subR*Math.sin(a);
        const baseColor = subPolkaColor(i);
        const subMat = new THREE.MeshStandardMaterial({
          color: baseColor, roughness: 0.4, metalness: 0.45,
          emissive: baseColor, emissiveIntensity: 0.45,
        });
        const subBall = new THREE.Mesh(new THREE.SphereGeometry(subPolkaR, 32, 24), subMat);
        subBall.position.set(px, 0, pz);
        subBall.userData.subIdx = i;
        drillGroup.add(subBall);
        subPolkiArr.push(subBall);

        // Аура
        const subAura = new THREE.Mesh(
          new THREE.SphereGeometry(subPolkaR*1.4, 16, 12),
          new THREE.MeshBasicMaterial({ color: baseColor, transparent:true, opacity:0.32, side:THREE.BackSide })
        );
        subBall.add(subAura);

        // Номер
        const num = makeDigitSprite(i, { size: 192, color: '#ffffff', stroke: 'rgba(15,8,30,0.95)', depthTest: false });
        num.position.set(0, 0, subPolkaR*0.05);
        num.scale.set(subPolkaR*1.7, subPolkaR*1.7, 1);
        subBall.add(num);

        // Подпись sub-полки (если есть) — полный текст, обводка, всегда поверх
        const subLabel = subData && subData[i] ? subData[i] : '';
        if(subLabel){
          const lbl = makeLabelSprite(subLabel, { fontSize: 52, weight: '700', color: '#ffffff', depthTest: false });
          const dir = new THREE.Vector3(px, 0, pz).normalize();
          const lblPos = new THREE.Vector3(px, 0, pz).add(dir.multiplyScalar(subPolkaR*3.4));
          lblPos.y = 5;
          lbl.position.copy(lblPos);
          const subH = subPolkaR*1.4;
          lbl.scale.set(subH * lbl.userData.aspect, subH, 1);
          drillGroup.add(lbl);
          subPolkiLabels.push(lbl);
        }
      }

      // Полюса
      const subPoleMat = new THREE.MeshStandardMaterial({ color:0xb88de0, roughness:0.22, metalness:0.6, emissive:0xb88de0, emissiveIntensity:0.4 });
      const subPoleGeom = new THREE.SphereGeometry(subPolkaR*0.6, 24, 18);
      const subN = new THREE.Mesh(subPoleGeom, subPoleMat); subN.position.set(0, subPoleY, 0); drillGroup.add(subN);
      const subS = new THREE.Mesh(subPoleGeom.clone(), subPoleMat); subS.position.set(0, -subPoleY, 0); drillGroup.add(subS);

      // Заголовок полки сверху
      const titleText = (y && y.p && y.p[drillIdx]) ? `Полка ${drillIdx}: ${y.p[drillIdx].slice(0,18)}` : `Полка ${drillIdx}`;
      const title = makeTextSprite(titleText, '#e8d8ff', 60, '700');
      title.position.set(0, subPoleY + subPolkaR*2.6, 0);
      title.scale.set(180, 30, 1);
      drillGroup.add(title);

      // Позиционируем drillGroup в позиции выбранной полки
      const a0 = (270 - drillIdx*30) * Math.PI/180;
      drillGroup.position.set(R*Math.cos(a0), 0, -R*Math.sin(a0));
      // Отодвигаем наружу так, чтобы внутренний край мини-Ясны был СНАРУЖИ от экватора
      const dirOut = new THREE.Vector3(drillGroup.position.x, 0, drillGroup.position.z).normalize();
      drillGroup.position.add(dirOut.multiplyScalar(subR*1.1));
    }

    // Raycaster для hover-detect и click
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    function rebuildMechanics(active){
      // Disposeм геометрии и текстуры старых children (защита от утечки CanvasTexture)
      while(mechGroup.children.length){
        const ch = mechGroup.children[0];
        ch.traverse(node=>{
          if(node.geometry) node.geometry.dispose();
          if(node.material){
            const disp = (m)=>{
              if(m.map && typeof m.map.dispose === 'function') m.map.dispose();
              m.dispose();
            };
            if(Array.isArray(node.material)) node.material.forEach(disp); else disp(node.material);
          }
        });
        mechGroup.remove(ch);
      }
      mechGroup.userData.zodiacCoinsAnim = false;
      // Адаптивная видимость каркаса — приглушаем при многих активных механиках
      const N = (active||[]).length;
      cageMat.opacity = N === 0 ? 0.07 : N <= 2 ? 0.04 : 0.02;
      equatorTube.material.opacity = N === 0 ? 0.75 : N <= 2 ? 0.6 : 0.35;

      // Палитра по VK Tech — синхронизирована с data.js / yasna-star.js
      const solidMode = !!(liveRef.current && liveRef.current.solidMech);
      const baseOp = solidMode ? 0.92 : 0.65;
      const crossDefs = [
        {id:'support', col:0xE8364F, idx:[0,3,6,9]},   // VK Crimson
        {id:'right',   col:0xE8A834, idx:[1,4,7,10]},  // VK Yellow
        {id:'left',    col:0x5B9CF6, idx:[2,5,8,11]},  // VK Light Blue
      ];
      crossDefs.forEach(c=>{
        if(active.includes(c.id)) mechGroup.add(makeBipyramid(c.idx, c.col, baseOp, solidMode));
      });

      const pranaDefs = [
        {id:'she', col:0xC0943A, idx:[0,4,8]},   // Земля
        {id:'fo',  col:0x2563EB, idx:[1,5,9]},   // Вода
        {id:'tsi', col:0x06B6D4, idx:[2,6,10]},  // Воздух
        {id:'ha',  col:0xF06838, idx:[3,7,11]},  // Огонь
      ];
      pranaDefs.forEach(p=>{
        if(active.includes(p.id)) mechGroup.add(makeBipyramid(p.idx, p.col, solidMode?0.88:0.6, solidMode));
      });

      if(active.includes('opp')){
        const grp = new THREE.Group();
        const mat = tubeMat(0xffb030, 0.55);
        for(let i=0;i<6;i++){
          const t = makeTube(equatorPos(i), equatorPos(i+6), 0.4, mat);
          if(t) grp.add(t);
        }
        mechGroup.add(grp);
      }

      if(active.includes('rhythm')){
        const triples = [[2,3,4],[5,6,7],[8,9,10],[11,0,1]];
        const center = new THREE.Vector3(0,0,0);
        triples.forEach(tr=>{
          const [a,b,c] = tr.map(i=>equatorPos(i));
          mechGroup.add(makeTetrahedron(a,b,c,center, 0x30A060, 0.55));
        });
      }

      if(active.includes('arcs')){
        const arcsList = [[1,3,5],[5,7,9],[9,11,1]];
        const cols = [0x4090D8, 0x9060D0, 0x30A060];
        arcsList.forEach((arc,ai)=>{
          const [a,b,c] = arc.map(i=>equatorPos(i));
          const mid = b.clone(); mid.y = R * 0.18;
          const curve = new THREE.CatmullRomCurve3([a, mid, c]);
          const tubeGeom = new THREE.TubeGeometry(curve, 32, 0.9, 8, false);
          const m = new THREE.Mesh(tubeGeom, tubeMat(cols[ai], 0.7));
          mechGroup.add(m);
        });
      }

      if(active.includes('halves')){
        // Solid-режим — заполненная сфера с двусторонним рендерингом
        const wf = !solidMode;
        const op = solidMode ? 0.32 : 0.18;
        const upper = new THREE.Mesh(
          new THREE.SphereGeometry(R*1.02, 32, 16, 0, Math.PI*2, 0, Math.PI/2),
          new THREE.MeshBasicMaterial({ color:0xC0943A, wireframe:wf, transparent:true, opacity:op, side:THREE.DoubleSide })
        );
        const lower = new THREE.Mesh(
          new THREE.SphereGeometry(R*1.02, 32, 16, 0, Math.PI*2, Math.PI/2, Math.PI/2),
          new THREE.MeshBasicMaterial({ color:0x2563EB, wireframe:wf, transparent:true, opacity:op, side:THREE.DoubleSide })
        );
        mechGroup.add(upper); mechGroup.add(lower);
      }

      if(active.includes('error89')){
        const ringMat = new THREE.MeshBasicMaterial({ color:0xD946EF, transparent:true, opacity:0.7 });
        [8,9,2,3].forEach(i=>{
          const ring = new THREE.Mesh(new THREE.TorusGeometry(polkaR*1.7, 1.0, 8, 24), ringMat);
          ring.position.copy(equatorPos(i));
          ring.rotation.x = Math.PI/2;
          mechGroup.add(ring);
        });
        const cMat = tubeMat(0xD946EF, 0.45);
        const mid89 = equatorPos(8).clone().lerp(equatorPos(9), 0.5);
        const mid23 = equatorPos(2).clone().lerp(equatorPos(3), 0.5);
        const t = makeTube(mid89, mid23, 0.5, cMat); if(t) mechGroup.add(t);
      }

      if(active.includes('mb_zodiac')){
        const ZS=['♑','♒','♓','♈','♉','♊','♋','♌','♍','♎','♏','♐'];
        // 3D-монеты с гравированным знаком: цилиндр с малой толщиной,
        // металлический ободок + текстурированная грань (CanvasTexture с глифом)
        // Ориентируем ось цилиндра радиально наружу, чтобы лицевая грань смотрела на наблюдателя
        const coinR = polkaR*0.85;
        const coinThick = polkaR*0.28;
        const sideMat = new THREE.MeshStandardMaterial({
          color:0x6b21a8, metalness:0.85, roughness:0.22,
          emissive:0x4c1d95, emissiveIntensity:0.32,
        });
        ZS.forEach((sym, i)=>{
          // Текстура с глифом — рисуем на canvas
          const cv = document.createElement('canvas');
          cv.width = 256; cv.height = 256;
          const ctx = cv.getContext('2d');
          // Фон с радиальным градиентом (золото-фиолет)
          const grad = ctx.createRadialGradient(128,128,20, 128,128,140);
          grad.addColorStop(0, '#f5e9ff');
          grad.addColorStop(0.55, '#c5a8e8');
          grad.addColorStop(1, '#5b21a8');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(128,128,128,0,Math.PI*2); ctx.fill();
          // Тонкий ободок
          ctx.strokeStyle = 'rgba(255,255,255,.55)';
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(128,128,118,0,Math.PI*2); ctx.stroke();
          // Глиф
          ctx.font = 'bold 168px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Apple Color Emoji", sans-serif';
          ctx.fillStyle = '#3a0d6e';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Лёгкая тень для объёма
          ctx.shadowColor = 'rgba(255,255,255,0.6)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = -2;
          ctx.fillText(sym, 128, 138);
          ctx.shadowColor = 'transparent';
          const tex = new THREE.CanvasTexture(cv);
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          if(THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
          const faceMat = new THREE.MeshStandardMaterial({
            map: tex, metalness: 0.3, roughness: 0.5,
            emissive: 0x6c3aad, emissiveIntensity: 0.38,
          });
          // Cylinder: [side, top(+Y), bottom(-Y)]
          const coinGeom = new THREE.CylinderGeometry(coinR, coinR, coinThick, 40, 1, false);
          const coin = new THREE.Mesh(coinGeom, [sideMat, faceMat, faceMat.clone()]);

          // Позиция: на радиусе чуть дальше полки, поднята над экватором
          const dir = equatorPos(i).clone().normalize();
          const pos = equatorPos(i).clone().add(dir.clone().multiplyScalar(polkaR*2.0));
          pos.y = polkaR*1.6;
          coin.position.copy(pos);

          // Ориентируем ось цилиндра по радиальному вектору (наружу),
          // чтобы лицевая грань смотрела от центра — её будет видно с любой стороны drag-камеры
          const axisFrom = new THREE.Vector3(0,1,0);
          const q = new THREE.Quaternion().setFromUnitVectors(axisFrom, dir);
          coin.setRotationFromQuaternion(q);

          // Лёгкое самовращение каждой монеты вокруг радиальной оси даёт «живой» 3D-эффект
          coin.userData.spinAxis = dir.clone();
          coin.userData.spinSpeed = 0.0004 + (i%3)*0.0001;

          mechGroup.add(coin);
        });
        // Регистрируем callback для самовращения монет в animate-loop
        mechGroup.userData.zodiacCoinsAnim = true;
      }

      if(active.includes('mb_scorpio_spider')){
        const top = new THREE.Mesh(
          new THREE.SphereGeometry(R*1.02, 32, 16, 0, Math.PI*2, 0, Math.PI/2),
          new THREE.MeshStandardMaterial({ color:0x2563eb, transparent:true, opacity:0.18, roughness:0.5, metalness:0.2, side:THREE.DoubleSide })
        );
        mechGroup.add(top);
        const bot = new THREE.Mesh(
          new THREE.SphereGeometry(R*1.02, 32, 16, 0, Math.PI*2, Math.PI/2, Math.PI/2),
          new THREE.MeshStandardMaterial({ color:0xdc2626, transparent:true, opacity:0.18, roughness:0.5, metalness:0.2, side:THREE.DoubleSide })
        );
        mechGroup.add(bot);
      }

      if(active.includes('mb_mobius')){
        const curve = new THREE.CatmullRomCurve3([
          equatorPos(11),
          new THREE.Vector3(R*0.5, -R*0.45, R*0.45),
          new THREE.Vector3(0, -R*0.6, R*0.65),
          new THREE.Vector3(-R*0.5, -R*0.45, R*0.45),
          equatorPos(1),
        ], false, 'catmullrom', 0.5);
        const tubeGeom = new THREE.TubeGeometry(curve, 80, 1.6, 12, false);
        const mat = new THREE.MeshStandardMaterial({
          color:0x14b8d4, transparent:true, opacity:0.95,
          roughness:0.18, metalness:0.65,
          emissive:0x14b8d4, emissiveIntensity:0.55,
        });
        mechGroup.add(new THREE.Mesh(tubeGeom, mat));
      }

      if(active.includes('mb_accumulation')){
        [0,3,6,9].forEach(i=>{
          const base = equatorPos(i);
          const apex = base.clone(); apex.y = R*0.35;
          const t = makeTube(base, apex, 1.2, tubeMat(0x22c850, 0.85)); if(t) mechGroup.add(t);
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(polkaR*1.4, 0.7, 8, 32),
            new THREE.MeshStandardMaterial({ color:0x22c850, transparent:true, opacity:0.85, metalness:0.6, roughness:0.2, emissive:0x22c850, emissiveIntensity:0.4 })
          );
          ring.position.copy(base); ring.rotation.x = Math.PI/2;
          mechGroup.add(ring);
        });
      }

      if(active.includes('mb_yasna2')){
        // Перформанс: 144 отдельных Mesh = 144 draw calls. Заменяем на InstancedMesh —
        // одна геометрия, один материал, 144 instance matrix = 1 draw call.
        const microMat = new THREE.MeshStandardMaterial({ color:0xa21caf, transparent:true, opacity:0.7, metalness:0.4, roughness:0.3, emissive:0xa21caf, emissiveIntensity:0.1 });
        const microGeom = new THREE.SphereGeometry(1.4, 10, 6); // меньше сегментов — у этих микро-шаров не нужна высокая детализация
        const instCount = 144;
        const instMesh = new THREE.InstancedMesh(microGeom, microMat, instCount);
        const dummy = new THREE.Object3D();
        let idx = 0;
        for(let i=0;i<12;i++){
          const center = equatorPos(i);
          for(let j=0;j<12;j++){
            const a = (270-j*30)*Math.PI/180;
            const localPos = new THREE.Vector3((polkaR+5)*Math.cos(a), 0, -(polkaR+5)*Math.sin(a));
            const microPos = center.clone().add(localPos);
            dummy.position.copy(microPos);
            dummy.updateMatrix();
            instMesh.setMatrixAt(idx++, dummy.matrix);
          }
        }
        instMesh.instanceMatrix.needsUpdate = true;
        mechGroup.add(instMesh);
      }
    }
    rebuildMechanics(af||[]);

    // ──────────────── Контролы ────────────────
    const updateCamera = () => {
      const { camAzim, camElev, camDist } = stateRef.current;
      const azR = camAzim*Math.PI/180, elR = camElev*Math.PI/180;
      camera.position.x = camDist*Math.cos(elR)*Math.sin(azR);
      camera.position.y = camDist*Math.sin(elR);
      camera.position.z = camDist*Math.cos(elR)*Math.cos(azR);
      camera.up.set(0,1,0);
      camera.lookAt(0,0,0);
    };

    const onPointerDown = (e)=>{
      stateRef.current.isDragging = true;
      stateRef.current.dragStartT = performance.now();
      stateRef.current.dragMoved = 0;
      stateRef.current.lastX = e.clientX; stateRef.current.lastY = e.clientY;
      canvas.style.cursor = 'grabbing'; e.preventDefault();
      // Pointer capture — drag не залипает если отпустить кнопку вне канваса
      if(e.pointerId != null && canvas.setPointerCapture){
        try { canvas.setPointerCapture(e.pointerId); } catch(_){}
      }
    };
    const onPointerMove = (e)=>{
      if(stateRef.current.isDragging){
        const dx = e.clientX - stateRef.current.lastX;
        const dy = e.clientY - stateRef.current.lastY;
        stateRef.current.dragMoved += Math.abs(dx) + Math.abs(dy);
        stateRef.current.camAzim -= dx*0.4;
        stateRef.current.camElev = Math.max(-89, Math.min(89, stateRef.current.camElev - dy*0.35));
        stateRef.current.lastX = e.clientX; stateRef.current.lastY = e.clientY;
      } else {
        // Hover-detect: меняем курсор на pointer когда наводимся на шар
        const rect = canvas.getBoundingClientRect();
        ndc.x = ((e.clientX-rect.left)/rect.width)*2 - 1;
        ndc.y = -((e.clientY-rect.top)/rect.height)*2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(polki);
        canvas.style.cursor = hits.length ? 'pointer' : 'grab';
      }
    };
    const onPointerUp = ()=>{
      stateRef.current.isDragging = false;
      canvas.style.cursor = 'grab';
      // dragMoved оставляем — onClick его проверит и сбросит
    };
    const onWheel = (e)=>{
      e.preventDefault();
      stateRef.current.camDist = Math.max(280, Math.min(1600, stateRef.current.camDist + e.deltaY*0.5));
    };

    // Touch pinch-to-zoom — отслеживаем 2 пальца
    let pinchActive = false, lastPinchDist = 0;
    const touchDist = (touches)=>{
      if(touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx*dx + dy*dy);
    };
    const onTouchStart = (e)=>{
      if(e.touches.length === 2){
        pinchActive = true;
        lastPinchDist = touchDist(e.touches);
        stateRef.current.isDragging = false; // отменяем drag во время pinch
        e.preventDefault();
      }
    };
    const onTouchMove = (e)=>{
      if(pinchActive && e.touches.length === 2){
        const d = touchDist(e.touches);
        const dz = (lastPinchDist - d) * 1.8; // знак: расхождение = zoom in
        stateRef.current.camDist = Math.max(280, Math.min(1600, stateRef.current.camDist + dz));
        lastPinchDist = d;
        e.preventDefault();
      }
    };
    const onTouchEnd = (e)=>{
      if(e.touches.length < 2){ pinchActive = false; }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, {passive:false});
    canvas.addEventListener('touchstart', onTouchStart, {passive:false});
    canvas.addEventListener('touchmove', onTouchMove, {passive:false});
    canvas.addEventListener('touchend', onTouchEnd);

    const raycaster_local = new THREE.Raycaster();
    const ndc_local = new THREE.Vector2();
    const onClick = (e)=>{
      if(stateRef.current.dragMoved > (isTouch ? 12 : 5)){
        stateRef.current.dragMoved = 0;
        return; // считаем что было drag — игнор
      }

      const rect = canvas.getBoundingClientRect();
      ndc_local.x = ((e.clientX-rect.left)/rect.width)*2 - 1;
      ndc_local.y = -((e.clientY-rect.top)/rect.height)*2 + 1;
      raycaster_local.setFromCamera(ndc_local, camera);
      const live = liveRef.current;
      // Если drill открыт — обработка кликов с приоритетом sub-полок
      if(live.drill != null && sceneRefs.current && sceneRefs.current.subPolki){
        // 1. Клик по sub-полке — визуальный pulse (без изменения state)
        const subHits = raycaster_local.intersectObjects(sceneRefs.current.subPolki);
        if(subHits.length){
          const ball = subHits[0].object;
          const origScale = ball.scale.x;
          ball.scale.set(origScale*1.4, origScale*1.4, origScale*1.4);
          setTimeout(()=>{ try{ ball.scale.set(origScale,origScale,origScale);}catch(e){} },280);
          return;
        }
        // 2. Клик по внешней полке — переключиться на её sub-Ясну
        const outerHits = raycaster_local.intersectObjects(polki);
        if(outerHits.length){
          const idx = outerHits[0].object.userData.polkaIdx;
          if(idx !== live.drill && typeof onDrill === 'function'){
            onDrill(idx);
          }
          return;
        }
        // 3. Клик по пустому фону — закрыть drill
        if(typeof onDrill === 'function') onDrill(null);
        return;
      }
      const hits = raycaster_local.intersectObjects(polki);
      if(hits.length){
        const idx = hits[0].object.userData.polkaIdx;
        // Если активна mb_yasna2 — вместо выбора открываем drill
        if((live.af||[]).includes('mb_yasna2') && typeof onDrill === 'function'){
          onDrill(idx);
        } else if(typeof onSel === 'function'){
          onSel(idx);
        }
      }
    };
    canvas.addEventListener('click', onClick);

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if(!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w/h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement || canvas);

    let raf, lastT = performance.now();
    let pulsePhase = 0;
    const animate = (now)=>{
      const dt = now - lastT; lastT = now;
      const live = liveRef.current;
      // Вращение колеса (читаем свежие props через ref)
      if(live.rotationOn){
        const dir = live.rotationOn==='cw' ? -1 : 1;
        const speedDeg = 360 / ((live.speedSec||24) * 1000);
        wheelGroup.rotation.y += dir * dt * speedDeg * Math.PI/180;
      }
      // Selected polka — пульсация emissive + лёгкое увеличение
      pulsePhase += dt * 0.003;
      const drilling = live.drill != null;
      polki.forEach((p, i) => {
        if(drilling){
          // Если drill активен — выбранная полка скрывается (внутрь неё разворачивается мини-Ясна),
          // остальные приглушаются
          if(i === live.drill){
            p.scale.lerp(new THREE.Vector3(0.4,0.4,0.4), 0.12);
            p.material.emissiveIntensity = 0.08;
            p.material.opacity = 0.4;
            p.material.transparent = true;
          } else {
            p.scale.lerp(new THREE.Vector3(0.7,0.7,0.7), 0.12);
            p.material.emissiveIntensity = 0.10;
            p.material.opacity = 0.55;
            p.material.transparent = true;
          }
        } else {
          if(i === live.sel){
            const pulse = 0.5 + 0.4 * Math.sin(pulsePhase * 2);
            p.material.emissiveIntensity = pulse;
            p.scale.lerp(new THREE.Vector3(1.4,1.4,1.4), 0.1);
          } else {
            p.material.emissiveIntensity = 0.15;
            p.scale.lerp(new THREE.Vector3(1,1,1), 0.1);
          }
          p.material.opacity = 1;
          p.material.transparent = false;
        }
      });

      // Самовращение зодиакальных монет (если активны)
      if(mechGroup.userData.zodiacCoinsAnim){
        mechGroup.children.forEach(ch=>{
          if(ch.userData && ch.userData.spinAxis){
            ch.rotateOnAxis(ch.userData.spinAxis, ch.userData.spinSpeed * dt);
          }
        });
      }

      // Анимация drillGroup: появление/исчезновение через scale-lerp
      if(drilling){
        if(!drillGroup.visible) drillGroup.visible = true;
        drillGroup.scale.lerp(new THREE.Vector3(1,1,1), 0.12);
        drillGroup.rotation.y += dt * 0.0001; // лёгкое самовращение
        // Пульсация sub-sel
        subPolkiArr.forEach((sb, i)=>{
          if(i === live.sel){
            const pulse = 0.5 + 0.4 * Math.sin(pulsePhase * 2);
            sb.material.emissiveIntensity = pulse;
            sb.scale.lerp(new THREE.Vector3(1.4,1.4,1.4), 0.1);
          } else {
            sb.material.emissiveIntensity = 0.45;
            sb.scale.lerp(new THREE.Vector3(1,1,1), 0.1);
          }
        });
      } else {
        if(drillGroup.scale.x > 0.05){
          drillGroup.scale.lerp(new THREE.Vector3(0.001,0.001,0.001), 0.18);
        } else if(drillGroup.visible){
          drillGroup.visible = false;
        }
      }

      updateCamera();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    sceneRefs.current = { rebuildMechanics, buildDrillGroup, subPolki: subPolkiArr, cageMesh, equatorTube };

    return ()=>{
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('click', onClick);
      renderer.dispose();
      scene.traverse(o=>{
        if(o.geometry) o.geometry.dispose();
        if(o.material){
          const disposeMat = (m)=>{
            if(!m) return;
            // Disposem связанные текстуры (CanvasTexture от зодиак-монет, цифр, sprite-меток)
            if(m.map && typeof m.map.dispose === 'function') m.map.dispose();
            if(m.envMap && typeof m.envMap.dispose === 'function') m.envMap.dispose();
            m.dispose();
          };
          if(Array.isArray(o.material)) o.material.forEach(disposeMat); else disposeMat(o.material);
        }
      });
      // env-map не входит в scene-graph — disposeим вручную
      if(scene.environment && typeof scene.environment.dispose === 'function'){
        scene.environment.dispose();
      }
    };
  }, [y]);

  React.useEffect(()=>{
    if(sceneRefs.current && sceneRefs.current.rebuildMechanics){
      sceneRefs.current.rebuildMechanics(af||[]);
    }
  }, [JSON.stringify(af||[]), solidMech]);

  // Каркас-купол (wireframe sphere) — показ/скрытие
  React.useEffect(()=>{
    if(sceneRefs.current && sceneRefs.current.cageMesh){
      sceneRefs.current.cageMesh.visible = !!showCage;
    }
  }, [showCage]);

  // Перестроение drillGroup при смене drill / subPolki
  // Используем стабильный signature вместо JSON.stringify на каждый render
  const subPolkiSig = (subPolki||[]).join('|');
  React.useEffect(()=>{
    if(sceneRefs.current && sceneRefs.current.buildDrillGroup){
      sceneRefs.current.buildDrillGroup(drill, subPolki);
    }
  }, [drill, subPolkiSig]);

  return <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block',cursor:'grab',outline:'none',touchAction:'none'}}/>;
}

function makeTextSprite(text, color, fontSize, weight){
  const THREE = window.THREE;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = `${weight||'normal'} ${fontSize||64}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map:tex, transparent:true });
  return new THREE.Sprite(mat);
}

// Универсальный label-sprite: автоматически подбирает ширину canvas под текст,
// рендерит обводку + halo для контраста на любом фоне, всегда поверх (depthTest:false).
// Возвращает Sprite вместе с aspect ratio для корректного world-scale.
function makeLabelSprite(text, opts){
  const THREE = window.THREE;
  const o = opts || {};
  const fontSize = o.fontSize || 64;
  const padding = Math.floor(fontSize * 0.6);
  const weight = o.weight || '700';
  const font = `${weight} ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif`;
  // Меряем ширину
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = font;
  const tw = Math.ceil(meas.measureText(text).width);
  const c = document.createElement('canvas');
  c.width = tw + padding*2;
  c.height = Math.floor(fontSize * 1.6) + padding;
  const ctx = c.getContext('2d');
  // Halo (тёмный градиент за текстом — для контраста на белых бликах сфер)
  if(o.halo !== false){
    const hg = ctx.createRadialGradient(c.width/2, c.height/2, fontSize*0.3, c.width/2, c.height/2, c.width/2);
    hg.addColorStop(0, 'rgba(8,4,20,0.62)');
    hg.addColorStop(0.55, 'rgba(8,4,20,0.30)');
    hg.addColorStop(1, 'rgba(8,4,20,0.0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Обводка
  ctx.lineWidth = Math.max(4, Math.floor(fontSize*0.10));
  ctx.strokeStyle = o.stroke || 'rgba(10,5,25,0.95)';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(text, c.width/2, c.height/2);
  // Заливка
  ctx.fillStyle = o.color || '#ffffff';
  ctx.fillText(text, c.width/2, c.height/2);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if(THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  const mat = new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest: o.depthTest !== false, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.userData.aspect = c.width / c.height; // для корректного scale
  return sp;
}

// Спрайт цифры с обводкой — высокий контраст на любом фоне (для шаров-полок)
// Квадратный canvas, не растягивается, читается с любого ракурса
function makeDigitSprite(digit, opts){
  const THREE = window.THREE;
  const o = opts || {};
  const size = o.size || 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  // Лёгкое svечение/halo за цифрой (повышает контраст на ярких сферах)
  if(o.halo !== false){
    const halo = ctx.createRadialGradient(size/2, size/2, size*0.05, size/2, size/2, size*0.45);
    halo.addColorStop(0, 'rgba(0,0,0,0.55)');
    halo.addColorStop(0.6, 'rgba(0,0,0,0.18)');
    halo.addColorStop(1, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(size/2, size/2, size*0.5, 0, Math.PI*2); ctx.fill();
  }
  const fontSize = o.fontSize || Math.floor(size*0.78);
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Тёмная обводка снаружи (контраст с белым шаром)
  ctx.lineWidth = Math.max(8, Math.floor(fontSize*0.12));
  ctx.strokeStyle = o.stroke || 'rgba(20,10,38,0.92)';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(String(digit), size/2, size/2 + size*0.02);
  // Заливка — белый/тёплый цвет
  ctx.fillStyle = o.color || '#ffffff';
  ctx.fillText(String(digit), size/2, size/2 + size*0.02);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if(THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  // depthTest: false — цифра всегда поверх шара (не уйдёт за поверхность)
  const mat = new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest: o.depthTest !== false, depthWrite:false });
  const spr = new THREE.Sprite(mat);
  return spr;
}



window.Yasna3DView = Yasna3DView;
window.YasnaSprites = { makeTextSprite, makeLabelSprite, makeDigitSprite };

})();
