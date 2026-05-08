// ═══════════════════════════════════════════════════════════════════
// trivia-bank · v2 · АДАПТЕР контентного дерева под движок турниров
// Читает 99_СВОДКА.json + темы по запросу. API совместим с v1.
//
// v1 (старая) держала ~45 хардкоженных вопросов в коде.
// v2 (эта)    тянет 126+ вопросов с цитатами, иллюстрациями,
//             keystone-разметкой и графом связей из контентного дерева.
//
// Сетевой бюджет на загрузку: ≈250 KB (один fetch).
// API сохранён 1-в-1 чтобы старый turnir-engine.js продолжил работать.
// ═══════════════════════════════════════════════════════════════════

(function(){
  'use strict';

  const CONTENT_BASE = '../content/sutki';
  const SUMMARY_URL  = CONTENT_BASE + '/99_СВОДКА.json';

  // ─── Хеш-сид для детерминированной генерации Партии ──────────────
  function hashSeed(seed){
    let h = 2166136261;
    const s = String(seed || Date.now());
    for(let i = 0; i < s.length; i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function shuffle(arr, seed){
    const a = [...arr];
    let s = hashSeed(seed);
    for(let i = a.length - 1; i > 0; i--){
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ─── Эмодзи-маркеры тем (косметика для UI) ────────────────────────
  const THEME_EMOJI = {
    T1: '🌅', T2: '◷', T3: '💎', T4: '⚔️', T5: '🌊',
    T6: '⚖️', T7: '✦', T8: '🜂', T9: '🌈', T10: '🎣'
  };

  // ─── Адаптер: вопрос из дерева → формат turnir-engine ──────────────
  function adaptQuestion(q, themeId){
    if(q.type === 'single-choice'){
      const correctIdx = q.options.indexOf(q.correct);
      if(correctIdx < 0) return null; // битый вопрос — пропускаем
      return {
        id: q.id,
        text: q.stem,
        options: q.options,
        correct: correctIdx,
        hint: q.explanation?.quote || '',
        source: q.explanation?.source || {},
        difficulty: q.difficulty || 'medium',
        tags: q.tags || [],
        themeId,
        sourceAtoms: q.source_atoms || []
      };
    }
    if(q.type === 'true-false'){
      return {
        id: q.id,
        text: q.stem,
        options: ['Верно', 'Не верно'],
        correct: q.correct === true ? 0 : 1,
        hint: q.explanation?.quote || '',
        source: q.explanation?.source || {},
        difficulty: q.difficulty || 'medium',
        tags: q.tags || [],
        themeId,
        sourceAtoms: q.source_atoms || []
      };
    }
    // multi-choice / fill-blank / match-pair / order — пока пропускаем
    // (нужны отдельные UI-компоненты в turnir-engine v3)
    return null;
  }

  // ─── Загрузка контента ──────────────────────────────────────────────
  let _resolved = false;
  async function loadContent(){
    try{
      const summary = await fetch(SUMMARY_URL).then(r => {
        if(!r.ok) throw new Error('SUMMARY HTTP ' + r.status);
        return r.json();
      });

      // Загружаем все темы параллельно
      const themeFiles = await Promise.all(
        summary.themes_index.map(t =>
          fetch(CONTENT_BASE + '/' + t.file)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );

      // ─── Темы (для случайной выборки в Партию) ─────────────────────
      const THEMES = summary.themes_index
        .filter(t => t.themes_in_partia !== false)
        .map(t => ({
          id: t.id.toLowerCase(),
          codeId: t.id,
          name: t.title,
          emoji: THEME_EMOJI[t.id] || '·',
          slug: t.slug,
          itemsRange: t.items_range,
          atomsCount: t.atoms_count,
          keystoneCount: t.keystone_count
        }));

      // ─── Вопросы по темам (адаптированные под движок) ─────────────
      const QUESTIONS = {};
      let totalAdapted = 0, totalSkipped = 0;

      themeFiles.forEach(themeData => {
        if(!themeData) return;
        const themeId = themeData.theme.id.toLowerCase();
        QUESTIONS[themeId] = [];
        themeData.questions.forEach(q => {
          const adapted = adaptQuestion(q, themeId);
          if(adapted){
            QUESTIONS[themeId].push(adapted);
            totalAdapted++;
          } else {
            totalSkipped++;
          }
        });
      });

      // ─── Партия: 6 тем × 3 вопроса ────────────────────────────────
      function generatePartiya(seed){
        const candidates = THEMES.filter(t => (QUESTIONS[t.id] || []).length >= 3);
        const six = shuffle(candidates, seed).slice(0, 6);
        return six.map(theme => ({
          theme,
          questions: shuffle(QUESTIONS[theme.id], seed + ':' + theme.id).slice(0, 3)
        }));
      }

      // ─── Финальный экспорт (совместимость с v1) ───────────────────
      window.YasnaTrivia = {
        version: 'v2',
        loaded: true,

        // Старый API (используется turnir-engine.js)
        THEMES,
        QUESTIONS,
        getThemes:           () => THEMES,
        getTheme:            (id) => THEMES.find(t => t.id === String(id).toLowerCase()),
        getQuestionsForTheme:(id) => QUESTIONS[String(id).toLowerCase()] || [],
        getAllQuestions:     () => Object.values(QUESTIONS).flat(),
        generatePartiya,

        // Новый v2-API (для дополнительных фич)
        v2: {
          summary,
          themesIndex:    summary.themes_index,
          keystoneAtoms:  summary.keystone_atoms,
          illustrations:  summary.illustrations_index,
          glossary:       summary.glossary,
          links:          summary.links_graph,

          // Поиск по глоссарию
          findTerm: (term) => summary.glossary.find(g =>
            g.term.toLowerCase() === String(term).toLowerCase()
          ),

          // Связанные атомы
          getLinks: (atomId, type) => summary.links_graph.filter(l =>
            l.from === atomId && (!type || l.type === type)
          ),

          // Иллюстрации темы
          getIllustrations: (themeId) => summary.illustrations_index.filter(i =>
            i.theme_id === String(themeId).toUpperCase()
          )
        }
      };

      _resolved = true;
      console.log(
        '[trivia-bank v2] ✓ загружено: ' +
        summary.totals.atoms + ' атомов · ' +
        totalAdapted + ' вопросов адаптировано (' + totalSkipped + ' пропущено) · ' +
        THEMES.length + ' тем · ' +
        summary.totals.illustrations + ' иллюстраций'
      );

      // Сигнал для движков на ожидание
      window.dispatchEvent(new CustomEvent('yasna-trivia-ready', { detail: { version: 'v2' } }));
    } catch(err){
      console.error('[trivia-bank v2] ✗ ошибка загрузки:', err);
      // Заглушка чтобы движок не падал
      window.YasnaTrivia = {
        version: 'v2-error',
        loaded: false,
        error: String(err),
        THEMES: [], QUESTIONS: {},
        getThemes: () => [], getTheme: () => null,
        getQuestionsForTheme: () => [], getAllQuestions: () => [],
        generatePartiya: () => []
      };
    }
  }

  // Запускаем загрузку немедленно
  if(typeof fetch === 'undefined'){
    console.error('[trivia-bank v2] fetch недоступен (нужен HTTP-сервер, а не file://)');
    return;
  }
  loadContent();
})();
