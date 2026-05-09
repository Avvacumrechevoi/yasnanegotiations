// ════════════════════════════════════════════════════════════════════
// Converter: fill-blank → single-choice, order → match-pair
//
// Запуск: node scripts/convert-unsupported.mjs
//
// Логика:
//   1. Читает content/*.json
//   2. Для каждого fill-blank — превращает в single-choice, добавляя 3
//      качественных дистрактора (мапа DISTRACTORS ниже, для каждого qId
//      вручную подобраны)
//   3. Для каждого order — превращает в match-pair: pairsLeft = позиции
//      («Сначала», «Затем», ...), pairsRight = correct в правильном порядке
//   4. Пишет обратно в JSON, сохраняя форматирование
//
// После запуска:
//   npm run build   # пересобирает content.bundle.js
//   git diff content/   # проверить изменения
// ════════════════════════════════════════════════════════════════════

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '..', 'content');

// ─── Дистракторы для каждого fill-blank — подобраны вручную ───────────
// Формат: { 'T<theme>.Q<num>': ['distractor1', 'distractor2', 'distractor3'] }
// Они должны быть грамматически согласованы с correct, и хотя бы немного
// правдоподобны (форсируют думать, а не угадывать).
const DISTRACTORS = {
  'T1.Q4':  ['различно', 'хаотично', 'случайно'],
  'T1.Q8':  ['может только в гимнах', 'может с разрешением мудреца', 'может при переводе'],
  'T2.Q7':  ['востоку', 'югу', 'зениту'],
  'T2.Q8':  ['шесть', 'двадцать четыре', 'восемь'],
  'T2.Q9':  ['светлых и тёмных', 'тёплых и холодных', 'явных и тайных'],
  'T2.Q13': ['светлых и тёмных', 'явных и тайных', 'мужских и женских'],
  'T3.Q3':  ['край', 'место', 'предел'],
  'T3.Q5':  ['основа', 'твердыня', 'начало'],
  'T4.Q4':  ['Стихий', 'Времён', 'Сил'],
  'T4.Q8':  ['разделение', 'удвоение', 'продолжение'],
  'T4.Q12': ['Тёмном', 'Звёздном', 'Едином'],
  'T5.Q5':  ['Тяжёлые', 'Долгие', 'Медленные'],
  'T5.Q6':  ['Покоя', 'Сна', 'Скорости'],
  'T5.Q7':  ['три и три', 'двенадцать и двенадцать', 'четыре и четыре'],
  'T5.Q9':  ['силы', 'тьмы', 'движения'],
  'T5.Q12': ['тепло', 'движение', 'жизнь'],
  'T6.Q3':  ['медленно', 'с ожиданием', 'постепенно'],
  'T6.Q10': ['дня', 'тьмы', 'движения'],
  'T6.Q11': ['тьма', 'покой', 'неведение'],
  'T7.Q1':  ['Тайное', 'Народное', 'Звёздное'],
  'T7.Q4':  ['нечётные и чётные', 'малые и большие', 'светлые и тёмные'],
  'T7.Q9':  ['Звезда', 'Тарелка', 'Сила'],
  'T7.Q13': ['Гранями', 'Лучами', 'Углами'],
  'T7.Q16': ['ноль и шесть', 'один и семь', 'два и восемь'],
  'T8.Q7':  ['Двойного', 'Противоположности', 'Стихий'],
  'T8.Q14': ['6 и 2', '3 и 4', '12 и 1'],
  'T9.Q4':  ['Огня', 'Тьмы', 'Света'],
  'T9.Q7':  ['тьма', 'земля', 'душа'],
  'T10.Q3': ['поймаешь', 'найдёшь', 'увидишь'],
  'T10.Q4': ['каждой третьей', 'противоположной', 'связанной'],
  'T10.Q6': ['Звезда', 'Истина', 'Свет'],
};

// ─── Метки позиций для match-pair (order) ────────────────────────────
function orderPositionLabel(idx, total){
  if(total === 4) return ['Первое', 'Второе', 'Третье', 'Последнее'][idx];
  if(total === 6) return ['Первое', 'Второе', 'Третье', 'Четвёртое', 'Пятое', 'Шестое'][idx];
  return (idx + 1) + '-е';
}

// ─── Конвертеры ──────────────────────────────────────────────────────
function convertFillBlank(q){
  const distractors = DISTRACTORS[q.id];
  if(!distractors){
    console.warn(`  ⚠ ${q.id}: нет распракторов в маппинге, пропускаем`);
    return null;
  }
  if(!q.correct){
    console.warn(`  ⚠ ${q.id}: нет correct, пропускаем`);
    return null;
  }
  const correct = q.correct;
  const options = [correct, ...distractors];
  // ВАЖНО: в исходных JSON `correct` для single-choice — это СТРОКА с текстом
  // правильного ответа (не индекс). build-content.mjs конвертит её в индекс
  // позже. Поэтому оставляем correct = строка, такая же как первая option.
  return {
    ...q,
    type: 'single-choice',
    correct: correct,
    options,
    alternatives: undefined,
  };
}

function convertOrder(q){
  if(!Array.isArray(q.correct) || q.correct.length === 0){
    console.warn(`  ⚠ ${q.id}: bad correct array`);
    return null;
  }
  const total = q.correct.length;
  const pairsLeft = q.correct.map((_, i) => orderPositionLabel(i, total));
  const pairsRight = [...q.correct];
  // Для match-pair движок проверяет index-equality (left[i] ↔ right[i]).
  // correct остаётся как [[left, right], ...] для совместимости с UI.
  const correctPairs = pairsLeft.map((l, i) => [l, pairsRight[i]]);
  return {
    ...q,
    type: 'match-pair',
    pairsLeft,
    pairsRight,
    correct: correctPairs,
    // stem обогащаем — добавляем подсказку «соотнеси»
    stem: q.stem.replace(/^Расставьте/, 'Соотнесите позицию и элемент').replace(/^Расставь/, 'Соотнеси позицию и элемент'),
  };
}

// ─── Удаляем undefined-поля для чистого JSON ─────────────────────────
function cleanUndefined(obj){
  if(Array.isArray(obj)) return obj.map(cleanUndefined);
  if(obj && typeof obj === 'object'){
    const out = {};
    for(const k of Object.keys(obj)){
      if(obj[k] !== undefined) out[k] = cleanUndefined(obj[k]);
    }
    return out;
  }
  return obj;
}

// ─── Main ────────────────────────────────────────────────────────────
async function main(){
  const fs = await import('node:fs/promises');
  const allFiles = await fs.readdir(CONTENT_DIR);
  const themeFiles = allFiles.filter(f => f.endsWith('.json') && f !== '99_СВОДКА.json');

  let totalConverted = { fillBlank: 0, order: 0, skipped: 0 };

  for(const fname of themeFiles.sort()){
    const fp = path.join(CONTENT_DIR, fname);
    const raw = await readFile(fp, 'utf8');
    const data = JSON.parse(raw);
    if(!Array.isArray(data.questions)) continue;

    let changed = 0;
    const newQs = [];
    for(const q of data.questions){
      if(q.type === 'fill-blank'){
        const converted = convertFillBlank(q);
        if(converted){
          newQs.push(cleanUndefined(converted));
          totalConverted.fillBlank++;
          changed++;
        } else {
          newQs.push(q);  // оставляем как есть если не смогли
          totalConverted.skipped++;
        }
      } else if(q.type === 'order'){
        const converted = convertOrder(q);
        if(converted){
          newQs.push(cleanUndefined(converted));
          totalConverted.order++;
          changed++;
        } else {
          newQs.push(q);
          totalConverted.skipped++;
        }
      } else {
        newQs.push(q);
      }
    }

    if(changed > 0){
      data.questions = newQs;
      await writeFile(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`✓ ${fname}: конвертировано ${changed} вопросов`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`Конвертировано fill-blank → single-choice: ${totalConverted.fillBlank}`);
  console.log(`Конвертировано order → match-pair: ${totalConverted.order}`);
  console.log(`Пропущено: ${totalConverted.skipped}`);
  console.log('═══════════════════════════════════════');
  console.log('\nДальше:');
  console.log('  1. npm run build  — пересобрать bundle');
  console.log('  2. Проверить admin / duel что вопросы корректные');
  console.log('  3. git diff content/  — посмотреть изменения');
}

main().catch(err => { console.error(err); process.exit(1); });
