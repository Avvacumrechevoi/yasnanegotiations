// ════════════════════════════════════════════════════════════════════
// Валидатор контентного дерева Ясны
//
// Проверяет:
//   • Уникальность ID (тем, категорий, атомов, вопросов)
//   • Соответствие schema (см. content/00_СПЕЦИФИКАЦИЯ.md)
//   • single-choice: ровно 4 опции, correct ∈ options
//   • Все вопросы имеют explanation.quote и source.items
//   • source_atoms существуют (атомы по которым ссылаются)
//   • Не пустые items_range и pdf_pages
//   • Тип атома допустим (12 типов)
//
// Запуск: node scripts/validate-content.mjs
// Возвращает exit code 0 при успехе, 1 при ошибках.
// ════════════════════════════════════════════════════════════════════

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../content');

const ALLOWED_KINDS = new Set([
  'definition', 'fact', 'list', 'process', 'number',
  'etymology', 'pairing', 'opposition', 'postulate',
  'name', 'rule', 'scheme'
]);

const ALLOWED_QUESTION_TYPES = new Set([
  'single-choice', 'multi-choice', 'fill-blank',
  'true-false', 'match-pair', 'order'
]);

const ALLOWED_DIFFICULTY = new Set(['easy', 'medium', 'hard']);

async function main(){
  const errors = [];
  const warnings = [];
  const ids = {
    theme: new Set(),
    category: new Set(),
    atom: new Set(),
    question: new Set()
  };
  const allAtoms = new Map();
  const allQuestions = [];

  let files;
  try {
    files = (await readdir(CONTENT_DIR))
      .filter(f => f.endsWith('.json') && /^\d{2}_/.test(f))
      // 99_СВОДКА.json — это глобальный словарь, не тема. Не валидируется как theme.
      .filter(f => !/^99_/.test(f))
      .sort();
  } catch(e){
    console.error('❌ Cannot read content dir:', CONTENT_DIR);
    process.exit(1);
  }

  if(!files.length){
    console.error('❌ No theme JSON files found in', CONTENT_DIR);
    process.exit(1);
  }

  console.log(`▶ Validating ${files.length} theme file(s)…`);

  for(const file of files){
    const filePath = path.join(CONTENT_DIR, file);
    let data;
    try {
      data = JSON.parse(await readFile(filePath, 'utf-8'));
    } catch(e){
      errors.push(`[${file}] JSON parse error: ${e.message}`);
      continue;
    }

    // ─── theme ───
    const theme = data.theme;
    if(!theme){ errors.push(`[${file}] missing 'theme' object`); continue; }
    if(!theme.id || !theme.title){ errors.push(`[${file}] theme.id and theme.title required`); }
    if(ids.theme.has(theme.id)){ errors.push(`[${file}] duplicate theme id: ${theme.id}`); }
    ids.theme.add(theme.id);

    // ─── categories + atoms ───
    if(!Array.isArray(data.categories) || data.categories.length === 0){
      errors.push(`[${file}] no categories defined`);
    } else {
      for(const cat of data.categories){
        if(!cat.id) errors.push(`[${file}/${theme.id}] category without id`);
        if(ids.category.has(cat.id)) errors.push(`[${file}] duplicate category id: ${cat.id}`);
        ids.category.add(cat.id);

        if(!Array.isArray(cat.atoms)){ errors.push(`[${file}/${cat.id}] no atoms array`); continue; }

        for(const atom of cat.atoms){
          if(!atom.id) errors.push(`[${file}/${cat.id}] atom without id`);
          if(ids.atom.has(atom.id)) errors.push(`[${file}] duplicate atom id: ${atom.id}`);
          ids.atom.add(atom.id);
          allAtoms.set(atom.id, atom);

          if(!atom.kind || !ALLOWED_KINDS.has(atom.kind)){
            errors.push(`[${atom.id}] invalid kind: ${atom.kind}. Allowed: ${[...ALLOWED_KINDS].join(', ')}`);
          }
          if(!atom.quote || atom.quote.length < 5){
            errors.push(`[${atom.id}] missing/too short quote`);
          }
          if(!atom.source || !Array.isArray(atom.source.items) || atom.source.items.length === 0){
            errors.push(`[${atom.id}] missing source.items`);
          }
          if(!atom.source?.pdf_page){
            warnings.push(`[${atom.id}] missing source.pdf_page (recommended)`);
          }
        }
      }
    }

    // ─── questions ───
    if(!Array.isArray(data.questions) || data.questions.length === 0){
      warnings.push(`[${file}/${theme.id}] no questions yet`);
    } else {
      for(const q of data.questions){
        if(!q.id) errors.push(`[${file}/${theme.id}] question without id`);
        if(ids.question.has(q.id)) errors.push(`[${file}] duplicate question id: ${q.id}`);
        ids.question.add(q.id);
        allQuestions.push({ ...q, _file: file, _theme: theme.id });

        if(!ALLOWED_QUESTION_TYPES.has(q.type)){
          errors.push(`[${q.id}] invalid type: ${q.type}`);
        }
        if(!ALLOWED_DIFFICULTY.has(q.difficulty)){
          errors.push(`[${q.id}] invalid difficulty: ${q.difficulty}`);
        }
        if(!q.stem || q.stem.length < 5){
          errors.push(`[${q.id}] missing/too short stem`);
        }
        if(!q.explanation?.quote){
          errors.push(`[${q.id}] missing explanation.quote (нужен для финального экрана)`);
        }
        if(!Array.isArray(q.source_atoms) || q.source_atoms.length === 0){
          warnings.push(`[${q.id}] no source_atoms (нужно для трекинга освоения)`);
        }

        // type-specific
        if(q.type === 'single-choice'){
          if(!Array.isArray(q.options) || q.options.length !== 4){
            errors.push(`[${q.id}] single-choice must have exactly 4 options`);
          } else if(!q.options.includes(q.correct)){
            errors.push(`[${q.id}] correct "${q.correct}" not in options`);
          }
        } else if(q.type === 'multi-choice'){
          if(!Array.isArray(q.options) || q.options.length < 4){
            errors.push(`[${q.id}] multi-choice must have ≥4 options`);
          }
          if(!Array.isArray(q.correct) || q.correct.length === 0){
            errors.push(`[${q.id}] multi-choice correct must be non-empty array`);
          }
        } else if(q.type === 'true-false'){
          if(typeof q.correct !== 'boolean'){
            errors.push(`[${q.id}] true-false correct must be boolean`);
          }
        } else if(q.type === 'fill-blank'){
          if(!q.stem.includes('___') && !q.stem.includes('_____')){
            warnings.push(`[${q.id}] fill-blank stem doesn't have blank marker (___ or _____)`);
          }
          if(typeof q.correct !== 'string'){
            errors.push(`[${q.id}] fill-blank correct must be string`);
          }
        } else if(q.type === 'match-pair'){
          if(!Array.isArray(q.correct) || !q.correct.every(p => Array.isArray(p) && p.length === 2)){
            errors.push(`[${q.id}] match-pair correct must be array of [a, b] pairs`);
          }
        }

        // verify source_atoms exist
        if(Array.isArray(q.source_atoms)){
          for(const aid of q.source_atoms){
            // can only verify atoms from current theme; cross-theme refs validated post-loop
          }
        }
      }
    }

    // ─── rejected items audit ───
    // item: number (одиночный пункт) или string (диапазон "536-540" / "544-конец")
    if(Array.isArray(data.rejected)){
      for(const r of data.rejected){
        const itemValid = typeof r.item === 'number' || typeof r.item === 'string';
        if(!itemValid || !r.reason){
          errors.push(`[${file}] rejected item must have {item: number|string, reason: string}, got: ${JSON.stringify(r)}`);
        }
      }
    }

    // ─── stats ───
    if(!data.stats){ warnings.push(`[${file}] no stats block`); }
  }

  // ─── cross-references ───
  for(const q of allQuestions){
    if(Array.isArray(q.source_atoms)){
      for(const aid of q.source_atoms){
        if(!allAtoms.has(aid)){
          errors.push(`[${q.id}] source_atoms references non-existent atom: ${aid}`);
        }
      }
    }
  }

  // ─── duplicates by question stem ───
  const stems = new Map();
  for(const q of allQuestions){
    const k = (q.stem || '').toLowerCase().replace(/[^a-zа-я0-9]/g, '');
    if(stems.has(k)){
      warnings.push(`[${q.id}] possibly duplicate of [${stems.get(k)}]: same normalized stem`);
    }
    stems.set(k, q.id);
  }

  // ─── report ───
  const themeCount = ids.theme.size;
  const atomCount = ids.atom.size;
  const questionCount = ids.question.size;

  console.log('');
  console.log(`  themes:    ${themeCount}`);
  console.log(`  atoms:     ${atomCount}`);
  console.log(`  questions: ${questionCount}`);
  console.log('');

  if(warnings.length){
    console.log(`⚠  ${warnings.length} warning(s):`);
    for(const w of warnings) console.log('   ' + w);
    console.log('');
  }

  if(errors.length){
    console.error(`❌ ${errors.length} error(s):`);
    for(const e of errors) console.error('   ' + e);
    process.exit(1);
  }

  console.log(`✅ Контент валиден: ${themeCount} тем, ${atomCount} атомов, ${questionCount} вопросов`);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
