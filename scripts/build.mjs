// ════════════════════════════════════════════════════════════════════
// Build script — собирает app.js и duel.js в один минифицированный файл
//
// Зачем: без bundle браузер качает babel-standalone (~3 MB gzip) и
// компилирует JSX на клиенте. First-paint 2–5 секунд на 4G.
// С bundle вместо ~10 MB загружается ~200 KB пре-компилированного JS.
//
// Стратегия:
//   1. Каждый исходник оборачиваем в IIFE — так top-level const'ы не
//      коллидируют между файлами (например 'useState' определён и в
//      yasna-star.js и в app.js)
//   2. JSX → React.createElement через esbuild loader='jsx'
//   3. Конкатенация в порядке загрузки из index.html / duel.html
//   4. Минификация финального бандла
// ════════════════════════════════════════════════════════════════════

import esbuild from 'esbuild';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');

const isDev = process.argv.includes('--dev');
const isWatch = process.argv.includes('--watch');

// ─── Source order — должен совпадать с <script> тегами в index.html / duel.html

const APP_FILES = [
  'core/data.js',
  'core/content-store.js', // ← Tier-1 + Tier-2 merge layer (должен быть ДО trivia-bank)
  'core/sky-real.js',      // ← реальное звёздное небо (window.YasnaSkyReal) — до yasna-3d.js
  'core/yasna-3d.js',
  'core/astro-panel.js',
  'core/verification.js',
  'core/dialogs.js',
  'core/shtorka.js',   // ← шторка с упорами (window.YasnaShtorka) — до info-card
  'core/dosye.js',     // ← досье мест из книги и уроков (window.YasnaDosye)
  'core/info-card.js',
  'core/yasna-star.js',
  'lessons/engine.js',   // ← сами уроки в отдельном бандле uroki.min.js (грузится по требованию)
  'tours/engine.js',
  'tours/tour-atm.js',
  'tours/tour-atm-skrytyh.js',
  'tours/tour-sutok.js',
  'tours/tour-goda.js',
  'tours/tour-zhizni.js',
  'tours/tour-peregovorov.js',
  'tours/tour-pechi.js',
  'games/duel/duel.js',
  'games/duel/duel-games.js',
  'games/duel/duel-game-quiz.js',
  'games/duel/duel-game-mirror.js',
  'games/duel/duel-game-speed.js',
  'app.js',
];

const DUEL_FILES = [
  'core/data.js',
  'core/content-store.js',  // ← Tier-1+Tier-2 merge (для duel-page тоже)
  'core/yasna-3d.js',
  'core/verification.js',
  'core/dialogs.js',
  'core/shtorka.js',   // ← шторка с упорами (window.YasnaShtorka) — до info-card
  'core/dosye.js',     // ← досье мест из книги и уроков (window.YasnaDosye)
  'core/info-card.js',
  'core/yasna-star.js',
  'games/duel/duel.js',
  'games/duel/duel-games.js',
  'games/duel/duel-game-quiz.js',
  'games/duel/duel-game-mirror.js',
  'games/duel/duel-game-speed.js',
  'games/duel/content.bundle.js',  // ← АВТОГЕН из content/*.json (build-content.mjs)
  'games/duel/trivia-bank.js',
  'games/duel/turnir-engine.js',
  'games/duel/rt-firebase.js',
  'games/duel/group-engine.js',   // ← режим «С коллективом» (после turnir-engine: использует __shared)
  'games/duel/duel-page.js',
];

/* ─── Уроки: отдельный бандл, грузится по требованию ────────────────
   Уроков становится много (по явлению — своя серия), и держать их все в
   app.min.js значит платить их весом при каждом открытии конструктора,
   даже когда человек пришёл просто разложить круг. Поэтому: движок
   (lessons/engine.js) остаётся в основном бандле, а тексты уроков живут
   в uroki.min.js — его подтягивает window.YasnaLessons.загрузить().
   Список собирается с диска: добавил файл урока — он в сборке. */
async function файлыУроков(){
  const { readdir } = await import('node:fs/promises');
  const имена = (await readdir(path.join(PROJECT,'docs','lessons')))
    .filter(n => /^lesson-.+\.js$/.test(n))
    .sort((a,b) => a.localeCompare(b,'ru',{numeric:true}));
  return имена.map(n => 'lessons/' + n).concat(['lessons/lessons-index.js']);
}

/* ─── Паспорта уроков: docs/core/pasporta.js ────────────────────────
   Каждый урок был описан дважды: в своём файле и рукой в дереве
   (core/derevo-dannye.js). На шести уроках расхождений уже два
   («Учимся находить опоры» ↔ «Четыре опоры»). На сорока шести рукопись
   разошлась бы гарантированно. Теперь сборка читает файлы уроков и
   выпускает лёгкий паспорт (id, имя, подзаголовок, часть, минуты,
   места) — дерево берёт имена оттуда, а рукой в дереве остаётся только
   то, чего файл урока не знает: ветвь, источник, «о». */
async function собратьПаспорта(){
  const { readdir } = await import('node:fs/promises');
  const vm = await import('node:vm');
  const каталог = path.join(PROJECT,'docs','lessons');
  const имена = (await readdir(каталог)).filter(n => /^lesson-.+\.js$/.test(n)).sort();
  const песок = { window: { YasnaLessons: { lessons: [] } } };
  vm.createContext(песок);
  for(const имя of имена){
    const код = await readFile(path.join(каталог,имя),'utf8');
    try { vm.runInContext(код, песок, { timeout: 5000 }); }
    catch(e){ console.warn(`  ⚠ паспорт: ${имя} не выполнился — ${e.message.slice(0,80)}`); }
  }
  const паспорта = песок.window.YasnaLessons.lessons.map(l => {
    const места = new Set();
    for(const б of (l.blocks||[])){
      for(const ключ of ['highlightPositions','highlighted']){
        if(Array.isArray(б[ключ])) б[ключ].forEach(м => { if(Number.isInteger(м)) места.add(м); });
      }
    }
    return {
      id: l.id, имя: l.title || l.id, под: l.subtitle || '',
      часть: l.module || '', порядок: l.moduleOrder || l.order || 0,
      объём: l.duration || (l.blocks ? l.blocks.length + ' шагов' : ''),
      ясна: l.yasna || null, места: [...места].sort((а,б)=>а-б)
    };
  });
  const из = `/* АВТОГЕН scripts/build.mjs — НЕ ПРАВИТЬ РУКАМИ.\n   Паспорта уроков, прочитанные из docs/lessons/lesson-*.js. */\n`
    + 'window.YasnaPasporta = ' + JSON.stringify(паспорта, null, 1) + ';\n';
  await writeFile(path.join(PROJECT,'docs','core','pasporta.js'), из);
  return паспорта.length;
}

// ─── Helpers ────────────────────────────────────────────────────────

async function fileExists(p){
  try { await stat(p); return true; } catch { return false; }
}

async function transformFile(srcPath, relPath){
  const code = await readFile(srcPath, 'utf8');
  // Скипаем, если файл и так не содержит JSX и top-level `const` (CommonJS-IIFE)
  // Но для надёжности гоняем все через esbuild — он быстрый.
  const result = await esbuild.transform(code, {
    loader: 'jsx',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'es2018',
    charset: 'utf8',     // ← иначе кириллица уезжает в \uXXXX и текст толстеет втрое
    sourcefile: relPath, // для красивого источника в sourcemap'ах
    sourcemap: false,    // в финальном бандле sourcemap'ы делаем отдельно
  });
  return result.code;
}

async function buildBundle(name, files, srcRoot, distRoot, преамбула = ''){
  const parts = [];
  for(const rel of files){
    const abs = path.join(srcRoot, rel);
    if(!await fileExists(abs)){
      console.warn(`  ⚠ skip ${rel} — нет файла`);
      continue;
    }
    const transformed = await transformFile(abs, rel);
    // Каждый файл в свою IIFE — иначе top-level `const useState = ...`
    // в одном файле конфликтует с тем же `const useState` в другом.
    // type="text/babel" в браузере делал то же самое неявно (eval per script).
    parts.push(`/* ─── ${rel} ─── */\n;(function(){\n${transformed}\n})();`);
  }
  const combined = `/* Yasna bundle: ${name}.js — собран ${new Date().toISOString()} */\n`
    + (преамбула ? преамбула + '\n' : '') + parts.join('\n');

  await mkdir(distRoot, { recursive: true });

  /* Dev-сборка: без минификации, для отладки. Кладём ВНЕ docs/, потому что
     docs/ публикуется целиком: раньше эти два файла (3,5 МБ полностью
     читаемого исходника) уезжали в интернет, хотя на них не ссылается ни одна
     страница — страницы грузят только .min.js. Убрать их из git оказалось
     мало: CI пересобирает бандлы перед публикацией и создавал их заново. */
  const devRoot = path.join(PROJECT, '.build', 'dev');
  await mkdir(devRoot, { recursive: true });
  const devOut = path.join(devRoot, `${name}.js`);
  await writeFile(devOut, combined);

  // Prod-сборка: минифицированная
  const min = await esbuild.transform(combined, {
    minify: true,
    target: 'es2018',
    /* Без charset:'utf8' esbuild пишет каждую русскую букву как \uXXXX —
       шесть байт вместо двух. На наших бандлах это была треть веса.
       Страницы объявляют <meta charset="utf-8">, файлы свои — безопасно. */
    charset: 'utf8',
    legalComments: 'none',
  });
  const minOut = path.join(distRoot, `${name}.min.js`);
  await writeFile(minOut, min.code);

  return {
    name,
    files: files.length,
    devSize: combined.length,
    minSize: min.code.length,
    out: minOut,
  };
}

function fmt(bytes){
  if(bytes < 1024) return bytes + ' B';
  if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(2) + ' MB';
}

// ─── Авто-штамповка кэш-версий ?v= по хэшу содержимого ──────────────
// БЫЛО: ?v= правились РУКАМИ в каждом html. Это давало устойчивый класс багов —
// файл изменён, версия та же, браузер отдаёт старое (за одну сессию наступали
// на это многократно), либо наоборот версия бампнута там, но не в preview.
// СТАЛО: после сборки для каждой локальной ссылки с ?v= подставляется первые
// 8 символов sha256 самого файла. Свойства:
//   • изменился файл → изменилась версия, всегда и автоматически;
//   • не изменился → версия та же, кэш не сбрасывается зря;
//   • внешние ссылки (шрифты, CDN) не трогаются — их нет на диске;
//   • CI запускает build перед деплоем, поэтому в прод уезжают верные версии
//     даже если локально забыли пересобрать.
async function stampCacheVersions(root, label){
  const { readdir } = await import('node:fs/promises');
  const crypto = await import('node:crypto');
  let files;
  try {
    // Обход обязан быть РЕКУРСИВНЫМ: страницы игр лежат в подпапках docs/games,
    // и при плоском readdir им никогда не обновлялся ?v= — вернувшийся браузер
    // продолжал отдавать старый js из кэша. Ровно на этом обжёгся «Круг»:
    // парная игра была написана и выложена, а игрок видел прежнюю версию.
    const walk = async (dir) => {
      const out = [];
      for(const d of await readdir(dir, { withFileTypes: true })){
        if(d.name === 'dist' || d.name === 'node_modules' || d.name.startsWith('.')) continue;
        const full = path.join(dir, d.name);
        if(d.isDirectory()) out.push(...await walk(full));
        else if(d.name.endsWith('.html')) out.push(path.relative(root, full));
      }
      return out;
    };
    files = await walk(root);
  } catch(_){ return 0; }

  const hashCache = new Map();
  async function hashOf(abs){
    if(hashCache.has(abs)) return hashCache.get(abs);
    const buf = await readFile(abs);
    const h = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
    hashCache.set(abs, h);
    return h;
  }

  let stamped = 0, touched = 0;
  const changes = [];
  for(const name of files){
    const htmlPath = path.join(root, name);
    const src = await readFile(htmlPath, 'utf8');
    let out = '';
    let lastIndex = 0;
    // src="..." / href="..." с уже существующим ?v=<что-угодно>
    const re = /((?:src|href)=")([^"?#\s]+)\?v=([^"#\s]*)(")/g;
    let m;
    while((m = re.exec(src)) !== null){
      const [full, pre, rel, oldV, post] = m;
      out += src.slice(lastIndex, m.index);
      lastIndex = m.index + full.length;
      // абсолютные и протокольные ссылки пропускаем
      if(/^(https?:)?\/\//.test(rel) || rel.startsWith('data:')){ out += full; continue; }
      const abs = path.resolve(path.dirname(htmlPath), rel);
      if(!await fileExists(abs)){ out += full; continue; }   // битую ссылку не молчим — оставляем как есть
      const v = await hashOf(abs);
      out += pre + rel + '?v=' + v + post;
      if(v !== oldV){ stamped++; changes.push(name + ' → ' + rel + ': ' + oldV + ' → ' + v); }
    }
    out += src.slice(lastIndex);
    if(out !== src){ await writeFile(htmlPath, out, 'utf8'); touched++; }
  }
  if(stamped){
    console.log(`  ↻ [${label}] кэш-версии обновлены: ${stamped} в ${touched} html`);
    changes.slice(0, 8).forEach(s => console.log('     · ' + s));
    if(changes.length > 8) console.log(`     · … и ещё ${changes.length - 8}`);
  }
  return stamped;
}

async function buildAll(){
  const start = Date.now();
  const targets = [
    { src: 'docs', dist: 'docs/dist', label: 'prod' },
  ];

  for(const t of targets){
    const srcRoot = path.join(PROJECT, t.src);
    const distRoot = path.join(PROJECT, t.dist);

    if(!await fileExists(srcRoot)){
      console.log(`▷ skip ${t.label} (${t.src} не существует)`);
      continue;
    }

    console.log(`▶ build [${t.label}] ${t.src}/ → ${t.dist}/`);
    /* Уроки собираем первыми: их хэш уезжает в основной бандл, чтобы
       ленивая загрузка просила именно свежий файл, а не то, что осело в
       кэше браузера. Руками такие версии мы уже забывали бампать. */
    const r0 = await buildBundle('uroki', await файлыУроков(), srcRoot, distRoot);
    const пасп = await собратьПаспорта();
    console.log(`  ✓ pasporta.js  ${пасп} уроков`);
    const { createHash } = await import('node:crypto');
    const версияУроков = createHash('sha256')
      .update(await readFile(path.join(distRoot,'uroki.min.js')))
      .digest('hex').slice(0,8);

    const r1 = await buildBundle('app', APP_FILES, srcRoot, distRoot,
      `window.__yasnaУрокиВерсия=${JSON.stringify(версияУроков)};`);
    const r2 = await buildBundle('duel', DUEL_FILES, srcRoot, distRoot);

    console.log(`  ✓ uroki.min.js${fmt(r0.minSize).padStart(8)} (${r0.files} файлов, версия ${версияУроков})`);
    console.log(`  ✓ app.min.js  ${fmt(r1.minSize).padStart(8)} (dev ${fmt(r1.devSize)}, ${r1.files} файлов)`);
    console.log(`  ✓ duel.min.js ${fmt(r2.minSize).padStart(8)} (dev ${fmt(r2.devSize)}, ${r2.files} файлов)`);

    // Кэш-версии считаем ПОСЛЕ сборки бандлов: их хэш должен быть от свежего dist.
    await stampCacheVersions(srcRoot, t.label);
  }

  console.log(`\n✅ Готово за ${Date.now() - start} мс`);
}

// ─── Watch mode ─────────────────────────────────────────────────────

async function watchMode(){
  const { default: chokidarPkg } = await import('chokidar').catch(() => ({ default: null }));
  if(!chokidarPkg){
    console.warn('chokidar не установлен — watch без хот-релоада. Поставь: npm i -D chokidar');
    console.warn('Пока что просто пересборка раз в 2 секунды.');
    while(true){
      await buildAll().catch(err => console.error(err));
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// ─── Entry ──────────────────────────────────────────────────────────

if(isWatch){
  watchMode().catch(err => { console.error(err); process.exit(1); });
} else {
  buildAll().catch(err => { console.error(err); process.exit(1); });
}
