// ════════════════════════════════════════════════════════════════════
// Админка контента Ясны (MVP, v1)
//
// Что делает:
//   • Просмотр всех тем и вопросов из window.YasnaContent
//   • Добавление новых вопросов всех типов (single-choice, true-false,
//     multi-choice, match-pair) — fill-blank СПЕЦИАЛЬНО НЕ поддерживаем
//     (UX-провал, см. user research)
//   • Редактирование/удаление вопросов
//   • Экспорт всех изменений как JSON-патч → пастишь в content/*.json
//
// Архитектура без сервера:
//   • Все правки живут в localStorage под ключом yasna_admin_overrides
//   • При запуске игры (next iteration) overrides будут мерджиться
//   • Постоянное сохранение — через export → ручной commit JSON
//
// Auth:
//   • Сейчас ничего, страница доступна по прямой ссылке /preview/admin.html
//   • Следующая итерация: пароль в localStorage или Yandex Cloud auth
// ════════════════════════════════════════════════════════════════════
(function(){
'use strict';
const React = window.React;
const ReactDOM = window.ReactDOM;
const { useState, useEffect, useMemo } = React;

const OVERRIDES_KEY = 'yasna_admin_overrides';

// ─── Storage helpers ────────────────────────────────────────────────
function loadOverrides(){
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if(!raw) return { added: [], edited: {}, deleted: [] };
    const parsed = JSON.parse(raw);
    return {
      added: parsed.added || [],
      edited: parsed.edited || {},
      deleted: parsed.deleted || [],
    };
  } catch(_){ return { added: [], edited: {}, deleted: [] }; }
}
function saveOverrides(ov){
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(ov)); }
  catch(e){ alert('Не удалось сохранить (localStorage переполнен): ' + e.message); }
}

// ─── Merge content + overrides ──────────────────────────────────────
function getMergedQuestions(){
  const content = window.YasnaContent;
  if(!content) return [];
  const ov = loadOverrides();
  const deletedSet = new Set(ov.deleted);
  // Базовые вопросы (с применением edited и без удалённых)
  const base = (content.QUESTIONS || [])
    .filter(q => !deletedSet.has(q.id))
    .map(q => ov.edited[q.id] ? { ...q, ...ov.edited[q.id] } : q);
  // Добавленные вопросы (помечаем флагом для UI)
  const added = (ov.added || []).map(q => ({ ...q, _isNew: true }));
  return [...base, ...added];
}

// ─── ID generator для новых вопросов ────────────────────────────────
function genNewId(themeId){
  const prefix = (themeId || 'Q').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0, 6);
  return prefix + '.NEW.' + Date.now().toString(36).toUpperCase();
}

// ─── Question type metadata ─────────────────────────────────────────
const TYPES = [
  { id: 'single-choice', label: 'Выбор одного', icon: '◉' },
  { id: 'true-false',    label: 'Верно / Не верно', icon: '✓' },
  { id: 'multi-choice',  label: 'Множественный выбор', icon: '☷' },
  { id: 'match-pair',    label: 'Соединить пары', icon: '⇄' },
];

// ─── Validation ─────────────────────────────────────────────────────
function validateQuestion(q){
  if(!q.text || !q.text.trim()) return 'Введи текст вопроса';
  if(!q.theme) return 'Выбери тему';
  if(q.type === 'single-choice'){
    if(!Array.isArray(q.options) || q.options.length < 2) return 'Минимум 2 варианта';
    if(q.options.some(o => !o || !o.trim())) return 'Все варианты должны быть заполнены';
    if(typeof q.correct !== 'number' || q.correct < 0 || q.correct >= q.options.length)
      return 'Выбери правильный вариант';
  } else if(q.type === 'true-false'){
    if(q.correct !== 0 && q.correct !== 1) return 'Выбери правильный ответ';
  } else if(q.type === 'multi-choice'){
    if(!Array.isArray(q.options) || q.options.length < 2) return 'Минимум 2 варианта';
    if(q.options.some(o => !o || !o.trim())) return 'Все варианты должны быть заполнены';
    if(!Array.isArray(q.correct) || q.correct.length === 0) return 'Отметь хотя бы один правильный';
  } else if(q.type === 'match-pair'){
    if(!Array.isArray(q.pairsLeft) || q.pairsLeft.length < 2) return 'Минимум 2 пары';
    if(q.pairsLeft.length !== q.pairsRight.length) return 'Левая и правая колонки должны быть равной длины';
    if(q.pairsLeft.some(p => !p || !p.trim()) || q.pairsRight.some(p => !p || !p.trim()))
      return 'Все ячейки должны быть заполнены';
  } else {
    return 'Неизвестный тип';
  }
  return null;
}

// ─── Question Editor Modal ──────────────────────────────────────────
function QuestionEditor({ question, themes, onSave, onCancel, onDelete }){
  const [q, setQ] = useState(() => ({
    id: question.id || '',
    theme: question.theme || (themes[0] && themes[0].id) || '',
    type: question.type || 'single-choice',
    text: question.text || question.stem || '',
    diff: question.diff || 1,
    hint: question.hint || '',
    options: question.options ? [...question.options] : ['', '', '', ''],
    correct: question.correct ?? 0,
    pairsLeft: question.pairsLeft ? [...question.pairsLeft] : ['', ''],
    pairsRight: question.pairsRight ? [...question.pairsRight] : ['', ''],
  }));
  const [err, setErr] = useState(null);

  // При смене типа сбрасываем correct в дефолтный для типа
  useEffect(() => {
    setQ(prev => {
      if(prev.type === 'true-false') return { ...prev, correct: 0, options: ['Верно', 'Не верно'] };
      if(prev.type === 'multi-choice') return { ...prev, correct: Array.isArray(prev.correct) ? prev.correct : [] };
      if(prev.type === 'single-choice') return { ...prev, correct: typeof prev.correct === 'number' ? prev.correct : 0 };
      return prev;
    });
  }, [q.type]);

  function save(){
    // Очищаем структуру под тип
    const out = { id: q.id, theme: q.theme, type: q.type, text: q.text.trim(), diff: q.diff, hint: q.hint.trim() };
    if(q.type === 'single-choice'){
      out.options = q.options.filter(o => o.trim()).map(o => o.trim());
      out.correct = Math.min(q.correct, out.options.length - 1);
    } else if(q.type === 'true-false'){
      out.options = ['Верно', 'Не верно'];
      out.correct = q.correct;
    } else if(q.type === 'multi-choice'){
      out.options = q.options.filter(o => o.trim()).map(o => o.trim());
      out.correct = Array.isArray(q.correct) ? q.correct.filter(i => i < out.options.length) : [];
    } else if(q.type === 'match-pair'){
      const validPairs = q.pairsLeft.map((l, i) => ({ l: l.trim(), r: (q.pairsRight[i] || '').trim() }))
        .filter(p => p.l && p.r);
      out.pairsLeft = validPairs.map(p => p.l);
      out.pairsRight = validPairs.map(p => p.r);
      out.correct = validPairs.map(p => [p.l, p.r]);
    }
    const error = validateQuestion(out);
    if(error){ setErr(error); return; }
    onSave(out);
  }

  return React.createElement('div', { className:'ad-modal-overlay', onClick: e => { if(e.target === e.currentTarget) onCancel(); } },
    React.createElement('div', { className:'ad-modal' },
      React.createElement('h3', null, question.id ? 'Редактировать вопрос' : 'Новый вопрос'),
      err && React.createElement('div', { className:'ad-warning' }, '⚠ ', err),

      React.createElement('div', { className:'ad-form' },
        React.createElement('div', null,
          React.createElement('label', null, 'Тип'),
          React.createElement('select', { value: q.type, onChange: e => setQ({ ...q, type: e.target.value }) },
            TYPES.map(t => React.createElement('option', { key: t.id, value: t.id }, t.icon + ' ' + t.label))
          )
        ),

        React.createElement('div', null,
          React.createElement('label', null, 'Тема'),
          React.createElement('select', { value: q.theme, onChange: e => setQ({ ...q, theme: e.target.value }) },
            themes.map(t => React.createElement('option', { key: t.id, value: t.id }, (t.name || t.title || t.id)))
          )
        ),

        React.createElement('div', null,
          React.createElement('label', null, 'Текст вопроса'),
          React.createElement('textarea', { value: q.text, onChange: e => setQ({ ...q, text: e.target.value }), placeholder:'Например: Сколько полок в Ясне Суток?' })
        ),

        // ─── Options for single-choice / true-false ─────────────────
        (q.type === 'single-choice') && React.createElement('div', null,
          React.createElement('label', null, 'Варианты ответов (выбери правильный)'),
          React.createElement('div', { className:'ad-options-list' },
            q.options.map((opt, i) =>
              React.createElement('div', { key: i, className:'ad-option-row' },
                React.createElement('input', {
                  type:'radio', name:'correct', checked: q.correct === i,
                  onChange: () => setQ({ ...q, correct: i }),
                }),
                React.createElement('input', {
                  type:'text', value: opt,
                  onChange: e => setQ({ ...q, options: q.options.map((o, j) => j === i ? e.target.value : o) }),
                  placeholder:'Вариант ' + (i+1),
                }),
                q.options.length > 2 && React.createElement('button', {
                  className:'ad-btn ad-btn-danger', type:'button',
                  onClick: () => setQ({
                    ...q,
                    options: q.options.filter((_, j) => j !== i),
                    correct: q.correct >= i && q.correct > 0 ? q.correct - 1 : q.correct,
                  }),
                }, '×')
              )
            ),
            q.options.length < 6 && React.createElement('button', {
              className:'ad-btn', type:'button',
              onClick: () => setQ({ ...q, options: [...q.options, ''] }),
            }, '+ Добавить вариант')
          )
        ),

        (q.type === 'true-false') && React.createElement('div', null,
          React.createElement('label', null, 'Правильный ответ'),
          React.createElement('div', { className:'ad-options-list' },
            ['Верно', 'Не верно'].map((label, i) =>
              React.createElement('label', { key: i, className:'ad-option-row', style: { cursor:'pointer' } },
                React.createElement('input', {
                  type:'radio', name:'tf', checked: q.correct === i,
                  onChange: () => setQ({ ...q, correct: i }),
                }),
                React.createElement('span', { style: { fontSize: 14 } }, label)
              )
            )
          )
        ),

        // ─── Multi-choice ───────────────────────────────────────────
        (q.type === 'multi-choice') && React.createElement('div', null,
          React.createElement('label', null, 'Варианты (отметь все правильные)'),
          React.createElement('div', { className:'ad-options-list' },
            q.options.map((opt, i) => {
              const checked = Array.isArray(q.correct) && q.correct.includes(i);
              return React.createElement('div', { key: i, className:'ad-option-row' },
                React.createElement('input', {
                  type:'checkbox', checked,
                  onChange: () => {
                    const cur = Array.isArray(q.correct) ? q.correct : [];
                    setQ({ ...q, correct: checked ? cur.filter(x => x !== i) : [...cur, i].sort((a,b) => a-b) });
                  },
                }),
                React.createElement('input', {
                  type:'text', value: opt,
                  onChange: e => setQ({ ...q, options: q.options.map((o, j) => j === i ? e.target.value : o) }),
                  placeholder:'Вариант ' + (i+1),
                }),
                q.options.length > 2 && React.createElement('button', {
                  className:'ad-btn ad-btn-danger', type:'button',
                  onClick: () => setQ({
                    ...q,
                    options: q.options.filter((_, j) => j !== i),
                    correct: (Array.isArray(q.correct) ? q.correct : [])
                      .filter(x => x !== i).map(x => x > i ? x - 1 : x),
                  }),
                }, '×')
              );
            }),
            q.options.length < 8 && React.createElement('button', {
              className:'ad-btn', type:'button',
              onClick: () => setQ({ ...q, options: [...q.options, ''] }),
            }, '+ Добавить вариант')
          )
        ),

        // ─── Match-pair ─────────────────────────────────────────────
        (q.type === 'match-pair') && React.createElement('div', null,
          React.createElement('label', null, 'Пары (соответствия по строкам)'),
          React.createElement('div', { className:'ad-options-list' },
            q.pairsLeft.map((l, i) =>
              React.createElement('div', { key: i, className:'ad-option-row' },
                React.createElement('input', {
                  type:'text', value: l,
                  onChange: e => setQ({ ...q, pairsLeft: q.pairsLeft.map((x, j) => j === i ? e.target.value : x) }),
                  placeholder:'Левый ' + (i+1),
                }),
                React.createElement('span', { style: { color:'#86868b' } }, '↔'),
                React.createElement('input', {
                  type:'text', value: q.pairsRight[i] || '',
                  onChange: e => setQ({ ...q, pairsRight: q.pairsRight.map((x, j) => j === i ? e.target.value : x) }),
                  placeholder:'Правый ' + (i+1),
                }),
                q.pairsLeft.length > 2 && React.createElement('button', {
                  className:'ad-btn ad-btn-danger', type:'button',
                  onClick: () => setQ({
                    ...q,
                    pairsLeft: q.pairsLeft.filter((_, j) => j !== i),
                    pairsRight: q.pairsRight.filter((_, j) => j !== i),
                  }),
                }, '×')
              )
            ),
            q.pairsLeft.length < 6 && React.createElement('button', {
              className:'ad-btn', type:'button',
              onClick: () => setQ({
                ...q,
                pairsLeft: [...q.pairsLeft, ''],
                pairsRight: [...q.pairsRight, ''],
              }),
            }, '+ Добавить пару')
          )
        ),

        React.createElement('div', null,
          React.createElement('label', null, 'Подсказка / цитата (опционально)'),
          React.createElement('textarea', { value: q.hint, onChange: e => setQ({ ...q, hint: e.target.value }), placeholder:'Из книги: …' })
        ),

        React.createElement('div', null,
          React.createElement('label', null, 'Сложность (1=лёгкая, 2=средняя, 3=сильная)'),
          React.createElement('select', { value: q.diff, onChange: e => setQ({ ...q, diff: parseInt(e.target.value, 10) }) },
            React.createElement('option', { value: 1 }, '1 · Лёгкая'),
            React.createElement('option', { value: 2 }, '2 · Средняя'),
            React.createElement('option', { value: 3 }, '3 · Сильная')
          )
        )
      ),

      React.createElement('div', { className:'ad-modal-actions' },
        question.id && onDelete && React.createElement('button', {
          className:'ad-btn ad-btn-danger', type:'button',
          onClick: () => { if(confirm('Удалить вопрос?')) onDelete(); },
          style: { marginRight:'auto' }
        }, '🗑 Удалить'),
        React.createElement('button', { className:'ad-btn', type:'button', onClick: onCancel }, 'Отмена'),
        React.createElement('button', { className:'ad-btn ad-btn-primary', type:'button', onClick: save },
          question.id ? 'Сохранить' : 'Создать')
      )
    )
  );
}

// ─── Export Modal (выводит JSON-патч) ───────────────────────────────
function ExportModal({ overrides, onClose }){
  const json = useMemo(() => JSON.stringify(overrides, null, 2), [overrides]);
  const totalChanges = (overrides.added?.length || 0) +
    Object.keys(overrides.edited || {}).length +
    (overrides.deleted?.length || 0);

  return React.createElement('div', { className:'ad-modal-overlay', onClick: e => { if(e.target === e.currentTarget) onClose(); } },
    React.createElement('div', { className:'ad-modal' },
      React.createElement('h3', null, 'Экспорт изменений'),
      React.createElement('div', { className:'ad-info' },
        React.createElement('strong', null, totalChanges, ' изменени', totalChanges === 1 ? 'е' : 'й'), ' · ',
        'добавлено: ', overrides.added?.length || 0, ' · ',
        'отредактировано: ', Object.keys(overrides.edited || {}).length, ' · ',
        'удалено: ', overrides.deleted?.length || 0
      ),
      React.createElement('p', { style: { fontSize:13, color:'#424245', lineHeight:1.6 } },
        'Скопируй JSON и передай разработчику для коммита в репозиторий. ',
        'После мержа изменения станут видны всем игрокам.'
      ),
      React.createElement('pre', { className:'ad-export-pre' }, json),
      React.createElement('div', { className:'ad-modal-actions' },
        React.createElement('button', {
          className:'ad-btn', type:'button',
          onClick: () => {
            navigator.clipboard.writeText(json).then(
              () => alert('JSON скопирован в буфер'),
              () => alert('Не удалось скопировать — выдели и скопируй вручную')
            );
          }
        }, '📋 Скопировать'),
        React.createElement('button', { className:'ad-btn ad-btn-primary', type:'button', onClick: onClose }, 'Закрыть')
      )
    )
  );
}

// ─── Main App ───────────────────────────────────────────────────────
function AdminApp(){
  const content = window.YasnaContent;
  if(!content){
    return React.createElement('div', { className:'ad-shell' },
      React.createElement('div', { className:'ad-warning' },
        'Контент не загружен. Проверь что файл games/duel/content.bundle.js доступен.'
      )
    );
  }

  const themes = content.THEMES || [];
  const [activeTheme, setActiveTheme] = useState(themes[0]?.id || null);
  const [overrides, setOverrides] = useState(loadOverrides);
  const [editingQ, setEditingQ] = useState(null);  // { ...question } или null
  const [showExport, setShowExport] = useState(false);

  // Сохраняем overrides в localStorage при изменении
  useEffect(() => { saveOverrides(overrides); }, [overrides]);

  const allQuestions = useMemo(() => getMergedQuestions(), [overrides]);
  const questionsForTheme = useMemo(
    () => allQuestions.filter(q => q.theme === activeTheme),
    [allQuestions, activeTheme]
  );

  const totalChanges = (overrides.added?.length || 0) +
    Object.keys(overrides.edited || {}).length +
    (overrides.deleted?.length || 0);

  function handleSaveQuestion(q){
    if(q.id && (overrides.added.find(a => a.id === q.id) || allQuestions.find(a => a.id === q.id && !a._isNew))){
      // Существующий вопрос → правка
      const existsInBase = (content.QUESTIONS || []).find(b => b.id === q.id);
      if(existsInBase){
        setOverrides({ ...overrides, edited: { ...overrides.edited, [q.id]: q } });
      } else {
        // Это NEW (added) — обновляем в added
        setOverrides({ ...overrides, added: overrides.added.map(a => a.id === q.id ? q : a) });
      }
    } else {
      // Новый вопрос
      const newQ = { ...q, id: q.id || genNewId(q.theme) };
      setOverrides({ ...overrides, added: [...overrides.added, newQ] });
    }
    setEditingQ(null);
  }

  function handleDeleteQuestion(qId){
    const isAdded = overrides.added.find(a => a.id === qId);
    if(isAdded){
      setOverrides({ ...overrides, added: overrides.added.filter(a => a.id !== qId) });
    } else {
      // Базовый вопрос → помечаем удалённым
      const newEdited = { ...overrides.edited };
      delete newEdited[qId];
      setOverrides({
        ...overrides,
        edited: newEdited,
        deleted: [...new Set([...overrides.deleted, qId])],
      });
    }
    setEditingQ(null);
  }

  function clearOverrides(){
    if(!confirm('Сбросить все локальные изменения? Это нельзя отменить.')) return;
    setOverrides({ added: [], edited: {}, deleted: [] });
  }

  // ─── Render ─────────────────────────────────────────────────────
  return React.createElement('div', { className:'ad-shell' },
    React.createElement('header', { className:'ad-hdr' },
      React.createElement('div', null,
        React.createElement('h1', null, '✦ Админка контента'),
        React.createElement('div', { className:'ad-hdr-meta' }, 'Ясна · ', themes.length, ' тем · ', allQuestions.length, ' вопросов')
      ),
      React.createElement('div', { style: { display:'flex', gap:8, alignItems:'center' } },
        totalChanges > 0 && React.createElement('span', { className:'ad-stat',
          style: { fontSize:11, color:'#0058b8' } },
          totalChanges, ' изменени', totalChanges === 1 ? 'е' : 'й'),
        React.createElement('button', { className:'ad-btn', onClick: clearOverrides, disabled: totalChanges === 0 },
          'Сбросить'),
        React.createElement('button', { className:'ad-btn ad-btn-primary', onClick: () => setShowExport(true), disabled: totalChanges === 0 },
          '⬇ Экспорт')
      )
    ),

    React.createElement('div', { className:'ad-info' },
      React.createElement('strong', null, 'Это локальная песочница. '),
      'Изменения хранятся только в твоём браузере (localStorage). ',
      'Чтобы они стали видны всем игрокам — нажми «Экспорт», скопируй JSON и передай разработчику для commit в репо.'
    ),

    React.createElement('div', { className:'ad-grid' },
      // ─── Список тем ───
      React.createElement('aside', { className:'ad-themes' },
        themes.map(t => {
          const count = allQuestions.filter(q => q.theme === t.id).length;
          return React.createElement('div', {
            key: t.id,
            className: 'ad-theme-row' + (activeTheme === t.id ? ' is-active' : ''),
            onClick: () => setActiveTheme(t.id),
          },
            React.createElement('span', null, t.name || t.title || t.id),
            React.createElement('span', { className:'ad-theme-count' }, count)
          );
        })
      ),

      // ─── Список вопросов выбранной темы ───
      React.createElement('main', { className:'ad-questions' },
        React.createElement('div', { className:'ad-q-toolbar' },
          React.createElement('button', {
            className:'ad-btn ad-btn-primary',
            onClick: () => setEditingQ({ theme: activeTheme, type:'single-choice' }),
          }, '+ Добавить вопрос')
        ),
        React.createElement('div', { className:'ad-stats' },
          React.createElement('span', { className:'ad-stat' },
            React.createElement('strong', null, questionsForTheme.length), ' вопросов'),
          ...TYPES.map(t => {
            const c = questionsForTheme.filter(q => (q.type || 'single-choice') === t.id).length;
            return c > 0 && React.createElement('span', { key: t.id, className:'ad-stat' },
              t.icon, ' ', t.label, ': ', React.createElement('strong', null, c));
          }).filter(Boolean)
        ),

        questionsForTheme.length === 0
          ? React.createElement('div', { className:'ad-empty' }, 'В этой теме пока нет вопросов. Нажми «+ Добавить вопрос».')
          : questionsForTheme.map(q => {
              const type = TYPES.find(t => t.id === (q.type || 'single-choice'));
              return React.createElement('div', { key: q.id, className:'ad-q' },
                React.createElement('div', { className:'ad-q-type' }, type ? (type.icon + ' ' + type.label.toLowerCase()) : (q.type || '?')),
                React.createElement('div', { className:'ad-q-text' },
                  React.createElement('strong', null, q.text || q.stem || '(без текста)'),
                  q._isNew && React.createElement('small', { style: { color:'#0058b8' } }, '✦ Новый (локально)'),
                  overrides.edited[q.id] && React.createElement('small', { style: { color:'#c0943a' } }, '✎ Изменён локально'),
                  q.hint && React.createElement('small', null, '«', q.hint.slice(0, 80), q.hint.length > 80 ? '…»' : '»')
                ),
                React.createElement('div', { className:'ad-q-actions' },
                  React.createElement('button', {
                    className:'ad-q-action',
                    onClick: () => setEditingQ(q),
                  }, 'Править')
                )
              );
            })
      )
    ),

    editingQ && React.createElement(QuestionEditor, {
      question: editingQ, themes,
      onSave: handleSaveQuestion,
      onCancel: () => setEditingQ(null),
      onDelete: editingQ.id ? () => handleDeleteQuestion(editingQ.id) : null,
    }),

    showExport && React.createElement(ExportModal, {
      overrides,
      onClose: () => setShowExport(false),
    })
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(AdminApp)
);

})();
