// ════════════════════════════════════════════════════════════════════
// Сборщик контентного дерева Ясны → bundle для duel-страницы
//
// Что делает:
//   1. Читает content/0X_тема_*.json (атомизированные темы)
//   2. Склеивает в единый bundle
//   3. Производит legacy-формат для текущего trivia-bank.js (single-choice)
//   4. Экспортирует расширенный формат для будущих типов вопросов
//   5. Записывает в docs/{,preview/}games/duel/content.bundle.js
//
// Запуск: node scripts/build-content.mjs
// Перед: scripts/validate-content.mjs (выполняется автоматически)
// ════════════════════════════════════════════════════════════════════

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(PROJECT, 'content');
const OUT_FILES = [
  path.join(PROJECT, 'docs/games/duel/content.bundle.js'),
  path.join(PROJECT, 'docs/preview/games/duel/content.bundle.js')
];

// ─── Маппинг тем (book + theme.id) на короткий алиас для совместимости ──
// Старый trivia-bank.js использовал короткие 'gimny', 'sutki' и т.п.
// Новые темы в JSON имеют id вроде 'T1', 'T2'. Мап ниже даёт каждой
// теме UI-метаданные (emoji, short label).
const THEME_META = {
  'T1':  { emoji: '✦',  short: 'Что есть Ясна' },
  'T2':  { emoji: '◴',  short: 'Чертёж' },
  'T3':  { emoji: '◇',  short: 'Гранит' },
  'T4':  { emoji: '⊕',  short: 'Оси' },
  'T5':  { emoji: '◐',  short: 'Скорости' },
  'T6':  { emoji: '⚖',  short: 'Чаши' },
  'T7':  { emoji: '⛪',  short: 'Храм' },
  'T8':  { emoji: '⚜',  short: 'Прана' },
  'T9':  { emoji: '◉',  short: 'Цвета' },
  'T10': { emoji: '✺',  short: 'Финал' }
};

const DIFF_MAP = { easy: 1, medium: 2, hard: 3 };

async function main(){
  // 1) Читаем тематические файлы
  const files = (await readdir(CONTENT_DIR))
    .filter(f => f.endsWith('.json') && /^\d{2}_/.test(f))
    .sort();

  if(!files.length){
    console.error('❌ No theme JSON files in', CONTENT_DIR);
    process.exit(1);
  }

  const themesRaw = [];
  for(const file of files){
    const data = JSON.parse(await readFile(path.join(CONTENT_DIR, file), 'utf-8'));
    themesRaw.push(data);
  }

  // 2) Преобразуем в legacy-формат + расширенный
  const THEMES = [];
  const QUESTIONS = [];          // legacy: single-choice only
  const QUESTIONS_FULL = [];     // все типы для будущей версии движка
  const ATOMS = [];              // плоский список атомов для аналитики/master

  let totalAtoms = 0;
  let totalQuestions = 0;
  let totalSingleChoice = 0;

  for(const data of themesRaw){
    const t = data.theme;
    const meta = THEME_META[t.id] || { emoji: '◇', short: t.title };

    // legacy-короткий id для совместимости — слаг темы
    const themeShortId = t.slug || t.id.toLowerCase();

    THEMES.push({
      id: themeShortId,            // 'chto-est-yasna'
      idFull: t.id,                // 'T1'
      book: data.book || 'sutki',
      name: t.title,
      short: meta.short,
      emoji: meta.emoji,
      summary: t.summary || '',
      itemsRange: t.items_range || '',
      pdfPages: t.pdf_pages || '',
      categoriesCount: (data.categories || []).length,
      atomsCount: (data.stats?.atoms_count) || 0,
      includeInPartiya: t.themes_in_partia !== false
    });

    // плоские атомы
    for(const cat of (data.categories || [])){
      for(const atom of (cat.atoms || [])){
        ATOMS.push({
          id: atom.id,
          theme: themeShortId,
          themeFull: t.id,
          category: cat.id,
          kind: atom.kind,
          term: atom.term || null,
          quote: atom.quote,
          source: atom.source,
          isKeystone: !!atom.meta?.is_keystone
        });
        totalAtoms++;
      }
    }

    // вопросы
    for(const q of (data.questions || [])){
      totalQuestions++;
      const baseQ = {
        id: q.id,
        idFull: q.id,
        theme: themeShortId,
        themeFull: t.id,
        type: q.type,
        difficulty: q.difficulty,
        diff: DIFF_MAP[q.difficulty] || 2,
        stem: q.stem,
        correct: q.correct,
        options: q.options || null,
        explanation: q.explanation || null,
        sourceAtoms: q.source_atoms || [],
        tags: q.tags || []
      };
      QUESTIONS_FULL.push(baseQ);

      // Legacy-формат — single-choice / true-false / fill-blank
      // Movok поддерживает их через q.type. Multi-choice и match-pair — позже.
      const hint = q.explanation?.quote || '';

      if(q.type === 'single-choice' && Array.isArray(q.options) && q.options.length === 4){
        const correctIdx = q.options.indexOf(q.correct);
        if(correctIdx === -1){
          console.warn(`⚠  ${q.id}: correct not in options, skipping for legacy`);
          continue;
        }
        QUESTIONS.push({
          id: q.id, theme: themeShortId, type: 'single-choice',
          diff: DIFF_MAP[q.difficulty] || 2,
          text: q.stem, options: q.options, correct: correctIdx, hint
        });
        totalSingleChoice++;
      } else if(q.type === 'true-false' && typeof q.correct === 'boolean'){
        // 2-кнопка «Верно / Не верно» — рендерится отдельным шаблоном.
        // В legacy совмещаем с single-choice через options=['Верно','Не верно']
        // и correct=0|1, чтобы движок работал без правок.
        QUESTIONS.push({
          id: q.id, theme: themeShortId, type: 'true-false',
          diff: DIFF_MAP[q.difficulty] || 2,
          text: q.stem,
          options: ['Верно', 'Не верно'],
          correct: q.correct ? 0 : 1,
          hint
        });
      } else if(q.type === 'fill-blank' && typeof q.correct === 'string'){
        // Текстовый ввод. Сравнение через нормализованный correct.
        // В options кладём принимаемые синонимы (если будут), пока — только основной.
        QUESTIONS.push({
          id: q.id, theme: themeShortId, type: 'fill-blank',
          diff: DIFF_MAP[q.difficulty] || 2,
          text: q.stem,
          correct: q.correct,
          alternatives: q.correct_alternatives || [],
          hint
        });
      }
      // multi-choice и match-pair — пока пропускаем, отдельный заход.
    }
  }

  // 3) Sanity-проверка: в каждой теме должно быть ≥1 single-choice вопрос
  // (иначе тема не может попасть в Партию текущего движка)
  const themesWithLegacyQs = new Set(QUESTIONS.map(q => q.theme));
  const themesWithoutLegacy = THEMES.filter(t => t.includeInPartiya && !themesWithLegacyQs.has(t.id));
  if(themesWithoutLegacy.length){
    console.warn(`⚠  Темы без single-choice вопросов (не попадут в Партию):`);
    for(const t of themesWithoutLegacy) console.warn(`     ${t.idFull} · ${t.name}`);
  }

  // 4) Собираем bundle
  const buildInfo = {
    builtAt: new Date().toISOString(),
    contentVersion: '1.1.0',
    files: files.length,
    themes: THEMES.length,
    atomsTotal: totalAtoms,
    questionsTotal: totalQuestions,
    questionsLegacy: totalSingleChoice
  };

  const bundleContent = `// АВТОГЕНЕРИРОВАННЫЙ ФАЙЛ — НЕ РЕДАКТИРОВАТЬ
// Источник: content/*.json
// Сборщик: scripts/build-content.mjs
// Build: ${buildInfo.builtAt}
// Themes: ${buildInfo.themes} · Atoms: ${buildInfo.atomsTotal} · Questions: ${buildInfo.questionsTotal} (single-choice: ${buildInfo.questionsLegacy})

;(function(){
  const BUILD_INFO = ${JSON.stringify(buildInfo)};
  const THEMES = ${JSON.stringify(THEMES, null, 2)};
  const QUESTIONS = ${JSON.stringify(QUESTIONS, null, 2)};
  const QUESTIONS_FULL = ${JSON.stringify(QUESTIONS_FULL, null, 2)};
  const ATOMS = ${JSON.stringify(ATOMS, null, 2)};

  window.YasnaContent = {
    version: '1.1.0',
    buildInfo: BUILD_INFO,
    THEMES,
    QUESTIONS,        // legacy: только single-choice, преобразовано к старому формату
    QUESTIONS_FULL,   // все вопросы со всеми типами (для нового движка)
    ATOMS
  };
})();
`;

  // 5) Пишем
  for(const out of OUT_FILES){
    await writeFile(out, bundleContent);
    const kb = (bundleContent.length / 1024).toFixed(1);
    const rel = path.relative(PROJECT, out);
    console.log(`  ✓ ${rel} (${kb} KB)`);
  }

  console.log('');
  console.log(`📦 Bundle: ${buildInfo.themes} тем · ${buildInfo.atomsTotal} атомов · ${buildInfo.questionsTotal} вопросов`);
  console.log(`   Из них single-choice (готовы к Партии): ${buildInfo.questionsLegacy}`);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
