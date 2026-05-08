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
  'core/yasna-3d.js',
  'core/verification.js',
  'core/dialogs.js',
  'core/info-card.js',
  'core/yasna-star.js',
  'lessons/engine.js',
  'lessons/lesson-1-what-is-yasna.js',
  'lessons/lesson-2-four-pillars.js',
  'lessons/lesson-3-two-lines.js',
  'lessons/lesson-4-line-names.js',
  'lessons/lesson-l2-night.js',
  'lessons/lesson-l3-morning.js',
  'lessons/lessons-index.js',
  'tours/engine.js',
  'tours/tour-atm.js',
  'tours/tour-atm-skrytyh.js',
  'tours/tour-sutok.js',
  'tours/tour-goda.js',
  'tours/tour-zhizni.js',
  'tours/tour-peregovorov.js',
  'games/duel/duel.js',
  'games/duel/duel-games.js',
  'games/duel/duel-game-quiz.js',
  'games/duel/duel-game-mirror.js',
  'games/duel/duel-game-speed.js',
  'app.js',
];

const DUEL_FILES = [
  'core/data.js',
  'core/yasna-3d.js',
  'core/verification.js',
  'core/dialogs.js',
  'core/info-card.js',
  'core/yasna-star.js',
  'games/duel/duel.js',
  'games/duel/duel-games.js',
  'games/duel/duel-game-quiz.js',
  'games/duel/duel-game-mirror.js',
  'games/duel/duel-game-speed.js',
  'games/duel/trivia-bank.js',
  'games/duel/turnir-engine.js',
  'games/duel/rt-firebase.js',
  'games/duel/duel-page.js',
];

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
    sourcefile: relPath, // для красивого источника в sourcemap'ах
    sourcemap: false,    // в финальном бандле sourcemap'ы делаем отдельно
  });
  return result.code;
}

async function buildBundle(name, files, srcRoot, distRoot){
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
  const combined = `/* Yasna bundle: ${name}.js — собран ${new Date().toISOString()} */\n` + parts.join('\n');

  await mkdir(distRoot, { recursive: true });

  // Dev-сборка: без минификации, для отладки
  const devOut = path.join(distRoot, `${name}.js`);
  await writeFile(devOut, combined);

  // Prod-сборка: минифицированная
  const min = await esbuild.transform(combined, {
    minify: true,
    target: 'es2018',
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

async function buildAll(){
  const start = Date.now();
  const targets = [
    { src: 'docs', dist: 'docs/dist', label: 'prod' },
    { src: 'docs/preview', dist: 'docs/preview/dist', label: 'preview' },
  ];

  for(const t of targets){
    const srcRoot = path.join(PROJECT, t.src);
    const distRoot = path.join(PROJECT, t.dist);

    if(!await fileExists(srcRoot)){
      console.log(`▷ skip ${t.label} (${t.src} не существует)`);
      continue;
    }

    console.log(`▶ build [${t.label}] ${t.src}/ → ${t.dist}/`);
    const r1 = await buildBundle('app', APP_FILES, srcRoot, distRoot);
    const r2 = await buildBundle('duel', DUEL_FILES, srcRoot, distRoot);

    console.log(`  ✓ app.min.js  ${fmt(r1.minSize).padStart(8)} (dev ${fmt(r1.devSize)}, ${r1.files} файлов)`);
    console.log(`  ✓ duel.min.js ${fmt(r2.minSize).padStart(8)} (dev ${fmt(r2.devSize)}, ${r2.files} файлов)`);
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
