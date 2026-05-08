// ═══════════════════════════════════════════════════════════════════
// Движок Партии · Касталия Ясны · v3
// 6 Тем × 3 вопроса = 18 вопросов
// Соперник: Тень трёх ликов (бот) или живой собеседник (PvP через transport)
// ═══════════════════════════════════════════════════════════════════
(function(){
  const { useState, useEffect, useRef } = React;

  const QUESTION_TIME = 15;
  const SHOW_FEEDBACK_MS = 1500;
  const SHOW_VS_MS = 2200;
  const SHOW_ROUND_INTRO_MS = 1800;

  // Три именованных лика Тени (плюс PvP — режим живого собеседника)
  const TEN_LEVELS = {
    easy:   { name: 'Тень Послушника',  subtitle: 'легко',  glyph: '🌅',
              accuracy: 0.55, minTime: 4, maxTime: 8, level: 'easy' },
    medium: { name: 'Тень Игрока',      subtitle: 'средне', glyph: '🌗',
              accuracy: 0.75, minTime: 3, maxTime: 6, level: 'medium' },
    hard:   { name: 'Тень Магистра',    subtitle: 'сильно', glyph: '🌑',
              accuracy: 0.92, minTime: 1, maxTime: 3, level: 'hard' },
  };

  function buseyForCorrect(timeMs){
    const baseScore = 10;
    const speedBonus = Math.max(0, Math.round(5 * (1 - timeMs / (QUESTION_TIME * 1000))));
    return baseScore + speedBonus;
  }

  function avatarInitials(name){
    if(!name) return '·';
    return String(name).trim().slice(0, 1).toUpperCase();
  }

  function renderTnAvatar(av, name){
    if(typeof av === 'string' && av.startsWith('http')){
      return React.createElement('img', { src: av, alt: '' });
    }
    if(typeof av === 'string' && av.length > 0 && av.length <= 4){
      return av;
    }
    return avatarInitials(name);
  }

  // ─── Quit Button ────────────────────────────────────────────────
  function TnQuitButton({ onQuit }){
    const handle = () => {
      if(!onQuit) return;
      if(confirm('Закончить эту Партию досрочно?')) onQuit();
    };
    return React.createElement('button', { className: 'tn-quit', onClick: handle }, 'Сдаться');
  }

  // ─── Top bar (eyebrow + quit) ───────────────────────────────────
  function TnTopBar({ eyebrow }){
    return React.createElement('div', { className: 'tn-topbar' },
      React.createElement('span', { className: 'tn-eyebrow' }, eyebrow),
      React.createElement(TnQuitButton, { onQuit: window.__tnOnClose })
    );
  }

  // ─── Vs-screen ───────────────────────────────────────────────────
  function VsScreen({ player, opponent, themes, onReady }){
    useEffect(() => {
      const t = setTimeout(onReady, SHOW_VS_MS);
      return () => clearTimeout(t);
    }, []);
    const themeNames = themes.map(t => t.theme.name).join(' · ');
    return React.createElement('div', { className: 'tn-fullscreen' },
      React.createElement('div', { className: 'tn-container' },
        React.createElement(TnTopBar, { eyebrow: '✦ Партия начинается' }),
        React.createElement('div', { className: 'tn-round-intro' },
          React.createElement('div', { className: 'tn-round-eyebrow' }, 'Партия для двоих'),
          React.createElement('div', { className: 'tn-versus', style: { justifyContent: 'center', gap: 48, margin: '16px 0 40px' } },
            React.createElement('div', { className: 'tn-player' },
              React.createElement('div', { className: 'tn-avatar' }, renderTnAvatar(player.avatar, player.nickname)),
              React.createElement('div', null,
                React.createElement('div', { className: 'tn-player-name' }, player.nickname),
                React.createElement('div', { className: 'tn-player-stats' }, player.rank || 'Послушник')
              )
            ),
            React.createElement('span', { className: 'tn-vs', style: { fontFamily: 'ui-serif, Georgia, serif', fontStyle: 'italic', fontSize: 22, opacity: 0.6 } }, 'против'),
            React.createElement('div', { className: 'tn-player tn-player-right' },
              React.createElement('div', { className: 'tn-avatar' }, opponent.glyph || '◐'),
              React.createElement('div', null,
                React.createElement('div', { className: 'tn-player-name' }, opponent.name),
                React.createElement('div', { className: 'tn-player-stats' }, opponent.subtitle || '')
              )
            )
          ),
          React.createElement('div', { className: 'tn-round-eyebrow', style: { marginTop: 32, fontSize: 11, letterSpacing: '0.16em' } }, '☷ Шесть тем · восемнадцать вопросов'),
          React.createElement('div', { style: { fontSize: 13, color: '#8a8470', maxWidth: 520, margin: '6px auto 0', lineHeight: 1.7, fontStyle: 'italic' } }, themeNames)
        )
      )
    );
  }

  // ─── Round Intro ─────────────────────────────────────────────────
  function RoundIntro({ roundNum, theme, onReady }){
    useEffect(() => {
      const t = setTimeout(onReady, SHOW_ROUND_INTRO_MS);
      return () => clearTimeout(t);
    }, []);
    return React.createElement('div', { className: 'tn-fullscreen' },
      React.createElement('div', { className: 'tn-container' },
        React.createElement(TnTopBar, { eyebrow: '✦ Раунд ' + roundNum + ' из 6' }),
        React.createElement('div', { className: 'tn-round-intro' },
          React.createElement('div', { className: 'tn-round-eyebrow', style: { letterSpacing: '0.16em', opacity: 0.7 } }, 'Гимн ', roundNum, '-й'),
          React.createElement('h1', { className: 'tn-round-title', style: { fontFamily: 'ui-serif, Georgia, serif', fontWeight: 500, letterSpacing: '-0.01em' } }, theme.name),
          React.createElement('div', { className: 'tn-round-sub', style: { fontStyle: 'italic', opacity: 0.7 } }, 'три вопроса по теме')
        )
      )
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Question — декомпозиция UI на компоненты
  // ═══════════════════════════════════════════════════════════════════

  // ─── Прогресс по партии (1/18) ──────────────────────────────────
  function TnGameProgress({ qOverall, totalOverall }){
    const pct = ((qOverall + 1) / totalOverall) * 100;
    return React.createElement('div', { className: 'tn-game-progress', role: 'progressbar', 'aria-valuenow': qOverall + 1, 'aria-valuemax': totalOverall },
      React.createElement('div', { className: 'tn-game-progress-fill', style: { width: pct + '%' } })
    );
  }

  // ─── Шапка с двумя сторонами и счётом ───────────────────────────
  function TnVsHeader({ player, scoreP, opponent, scoreO }){
    return React.createElement('div', { className: 'tn-vs-header' },
      React.createElement('div', { className: 'tn-vs-side' },
        React.createElement('div', { className: 'tn-vs-avatar' }, renderTnAvatar(player.avatar, player.nickname)),
        React.createElement('div', { className: 'tn-vs-info' },
          React.createElement('div', { className: 'tn-vs-name' }, player.nickname),
          React.createElement('div', { className: 'tn-vs-score' }, scoreP, ' бусин')
        )
      ),
      React.createElement('div', { className: 'tn-vs-divider' }, 'vs'),
      React.createElement('div', { className: 'tn-vs-side tn-vs-side-right' },
        React.createElement('div', { className: 'tn-vs-avatar' }, opponent.glyph || renderTnAvatar(opponent.avatar, opponent.name) || '◐'),
        React.createElement('div', { className: 'tn-vs-info' },
          React.createElement('div', { className: 'tn-vs-name' }, opponent.name || 'Тень'),
          React.createElement('div', { className: 'tn-vs-score' }, scoreO, ' бусин')
        )
      )
    );
  }

  // ─── Прогресс-бар обратного отсчёта по времени ──────────────────
  // Заполняется на 100% в начале, уменьшается до 0% за QUESTION_TIME сек.
  // Цвет меняется: зелёный → оранжевый → красный (последние секунды).
  function TnTimerBar({ timeLeft, paused }){
    const pct = (timeLeft / QUESTION_TIME) * 100;
    let cls = 'tn-timer-fill';
    if(timeLeft <= 5) cls += ' tn-timer-warn';
    if(timeLeft <= 2) cls += ' tn-timer-danger';
    if(paused) cls += ' tn-timer-paused';
    return React.createElement('div', { className: 'tn-timer-bar', role: 'timer', 'aria-label': 'Осталось ' + timeLeft + ' секунд' },
      React.createElement('div', { className: cls, style: { width: pct + '%' } })
    );
  }

  // ─── Карточка вопроса (тема + текст) ────────────────────────────
  function TnQuestionCard({ qOverall, totalOverall, themeName, text, timeLeft, showFeedback, qType }){
    const typeLabel =
      qType === 'true-false' ? 'Верно или нет?' :
      qType === 'fill-blank' ? 'Заполни пропуск' : null;
    return React.createElement('article', { className: 'tn-q-card' },
      React.createElement('div', { className: 'tn-q-meta' },
        React.createElement('span', { className: 'tn-q-meta-num' }, 'Вопрос ', qOverall + 1, ' / ', totalOverall),
        React.createElement('span', { className: 'tn-q-meta-dot' }, '·'),
        React.createElement('span', { className: 'tn-q-meta-theme' }, themeName),
        typeLabel && React.createElement('span', { className: 'tn-q-meta-dot' }, '·'),
        typeLabel && React.createElement('span', { className: 'tn-q-meta-type' }, typeLabel),
        !showFeedback && React.createElement('span', { className: 'tn-q-meta-time' },
          React.createElement('span', { 'aria-hidden': 'true' }, '◷ '), timeLeft, ' с'
        )
      ),
      React.createElement('h2', { className: 'tn-q-text' }, text)
    );
  }

  // ─── Кнопка варианта ответа ─────────────────────────────────────
  // Состояния: default / hover / chosen-correct / chosen-wrong / not-chosen-correct / disabled
  function TnOption({ index, label, text, state, onClick }){
    let cls = 'tn-option tn-option-' + state;
    const isClickable = state === 'default';
    return React.createElement('button', {
      className: cls,
      disabled: !isClickable,
      onClick: isClickable ? onClick : undefined,
      'aria-label': label + '. ' + text + (state === 'correct' ? '. Правильный ответ' : '') + (state === 'wrong' ? '. Ваш неверный ответ' : ''),
    },
      React.createElement('span', { className: 'tn-option-letter', 'aria-hidden': 'true' }, label),
      React.createElement('span', { className: 'tn-option-text' }, text),
      (state === 'correct' || state === 'shown-correct') && React.createElement('span', { className: 'tn-option-mark', 'aria-hidden': 'true' }, '✓'),
      state === 'wrong' && React.createElement('span', { className: 'tn-option-mark tn-option-mark-wrong', 'aria-hidden': 'true' }, '✕')
    );
  }

  function TnOptions({ options, chosen, correctIdx, showFeedback, onPick }){
    const labels = ['A','B','C','D','E','F'];
    return React.createElement('div', { className: 'tn-options', role: 'group' },
      options.map((opt, i) => {
        let state = 'default';
        if(showFeedback){
          if(i === correctIdx && i === chosen) state = 'correct';
          else if(i === correctIdx) state = 'shown-correct';
          else if(i === chosen) state = 'wrong';
          else state = 'disabled';
        }
        return React.createElement(TnOption, {
          key: i, index: i, label: labels[i] || (i+1), text: opt,
          state, onClick: () => onPick(i),
        });
      })
    );
  }

  // ─── True/False — две большие кнопки «Верно / Не верно» ─────────
  function TnTrueFalse({ chosen, correctIdx, showFeedback, onPick }){
    const items = [
      { idx: 0, label: 'Верно', sym: '✓' },
      { idx: 1, label: 'Не верно', sym: '✕' }
    ];
    return React.createElement('div', { className: 'tn-options tn-options-tf', role: 'group' },
      items.map(it => {
        let state = 'default';
        if(showFeedback){
          if(it.idx === correctIdx && it.idx === chosen) state = 'correct';
          else if(it.idx === correctIdx) state = 'shown-correct';
          else if(it.idx === chosen) state = 'wrong';
          else state = 'disabled';
        }
        const isClickable = state === 'default';
        return React.createElement('button', {
          key: it.idx,
          className: 'tn-option tn-option-tf tn-option-' + state,
          disabled: !isClickable,
          onClick: isClickable ? () => onPick(it.idx) : undefined,
          'aria-label': it.label
        },
          React.createElement('span', { className: 'tn-option-tf-sym', 'aria-hidden': 'true' }, it.sym),
          React.createElement('span', { className: 'tn-option-tf-text' }, it.label)
        );
      })
    );
  }

  // ─── Fill-blank — текстовое поле + кнопка отправить ─────────────
  // Нормализация ответа: lowercase, trim, ё→е, убираем знаки препинания.
  // correct может быть строкой, может быть {correct, alternatives[]}.
  function normalizeFillAnswer(s){
    return String(s || '')
      .toLowerCase()
      .trim()
      .replace(/ё/g, 'е')
      .replace(/[.,!?;:"'()\[\]]/g, '')
      .replace(/\s+/g, ' ');
  }

  function TnFillBlank({ correct, alternatives, chosen, showFeedback, onSubmit }){
    const [val, setVal] = useState('');
    useEffect(() => { setVal(''); }, [correct]);

    const acceptable = [correct, ...(alternatives || [])].map(normalizeFillAnswer);
    const isCorrect = chosen != null && acceptable.includes(normalizeFillAnswer(chosen));

    function submit(){
      const trimmed = val.trim();
      if(!trimmed || showFeedback) return;
      onSubmit(trimmed);
    }

    if(showFeedback){
      // После ответа — показать что ввёл игрок и что было правильно
      return React.createElement('div', { className: 'tn-fill', role: 'group' },
        React.createElement('div', {
          className: 'tn-fill-result tn-fill-' + (isCorrect ? 'correct' : 'wrong')
        },
          React.createElement('div', { className: 'tn-fill-result-label' }, 'Твой ответ:'),
          React.createElement('div', { className: 'tn-fill-result-text' }, chosen || '—'),
          !isCorrect && React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'tn-fill-result-label', style: { marginTop: 8 } }, 'Правильный ответ:'),
            React.createElement('div', { className: 'tn-fill-result-text tn-fill-result-correct' }, correct)
          )
        )
      );
    }

    return React.createElement('div', { className: 'tn-fill', role: 'group' },
      React.createElement('input', {
        type: 'text',
        className: 'tn-fill-input',
        value: val,
        onChange: e => setVal(e.target.value),
        onKeyDown: e => { if(e.key === 'Enter') submit(); },
        autoFocus: true,
        placeholder: 'Введи слово или фразу',
        'aria-label': 'Ваш ответ'
      }),
      React.createElement('button', {
        className: 'tn-fill-submit',
        onClick: submit,
        disabled: !val.trim()
      }, 'Ответить →')
    );
  }

  // ─── Баннер обратной связи (после ответа) ───────────────────────
  function TnFeedbackBanner({ kind, busey }){
    if(kind === 'correct'){
      return React.createElement('div', { className: 'tn-feedback tn-feedback-correct' },
        React.createElement('span', { className: 'tn-feedback-icon', 'aria-hidden': 'true' }, '✦'),
        React.createElement('span', { className: 'tn-feedback-text' }, 'Верно'),
        busey > 0 && React.createElement('span', { className: 'tn-feedback-busey' }, '+', busey, ' бусин')
      );
    }
    if(kind === 'wrong'){
      return React.createElement('div', { className: 'tn-feedback tn-feedback-wrong' },
        React.createElement('span', { className: 'tn-feedback-icon', 'aria-hidden': 'true' }, '◯'),
        React.createElement('span', { className: 'tn-feedback-text' }, 'Не верно')
      );
    }
    return React.createElement('div', { className: 'tn-feedback tn-feedback-timeout' },
      React.createElement('span', { className: 'tn-feedback-icon', 'aria-hidden': 'true' }, '◷'),
      React.createElement('span', { className: 'tn-feedback-text' }, 'Время вышло')
    );
  }

  // ─── Question — основной компонент игрового вопроса ─────────────
  function Question({ q, theme, qIndex, totalInRound, qOverall, totalOverall, roundNum, scoreP, scoreO, player, opponent, onAnswer, isPvP, transport, oppAnswersRef }){
    const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
    const [chosen, setChosen] = useState(null);
    const startedAt = useRef(Date.now());
    const oppFinishedRef = useRef(null);
    const answeredRef = useRef(false);

    // Пересоздание состояния при смене вопроса
    useEffect(() => {
      setTimeLeft(QUESTION_TIME);
      setChosen(null);
      startedAt.current = Date.now();
      oppFinishedRef.current = null;
      answeredRef.current = false;
      // НЕ сбрасываем oppAnswersRef — это map per-qId, ответ соперника
      // на текущий вопрос мог уже прилететь раньше (Firebase push быстрее).
      // Лежит под ключом q.id, никогда не путается с другими вопросами.
    }, [q?.id]);

    // Бот-Тень в shadow-режиме: симулируем ответ соперника таймером
    useEffect(() => {
      if(isPvP) return;
      const t = TEN_LEVELS[opponent.level] || TEN_LEVELS.medium;
      const oppTime = (t.minTime + Math.random() * (t.maxTime - t.minTime)) * 1000;
      const oppCorrect = Math.random() < t.accuracy;
      const tm = setTimeout(() => {
        oppFinishedRef.current = { correct: oppCorrect, time: oppTime };
      }, oppTime);
      return () => clearTimeout(tm);
    }, [q?.id, opponent.level, isPvP]);

    // Таймер обратного отсчёта
    useEffect(() => {
      if(chosen != null) return;
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if(prev <= 1){
            clearInterval(interval);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }, [chosen]);

    function safeAnswer(payload){
      if(answeredRef.current) return;
      answeredRef.current = true;
      onAnswer(payload);
    }

    // ─── Ожидание ответа соперника + продвижение ────────────────
    // Ключевая логика синхронизации PvP: оба клиента ждут ответ
    // друг друга перед переходом к следующему вопросу. Без этого
    // тот кто отвечает быстрее не учитывает бусины соперника
    // (рассинхрон счёта на N бусин в каждом раунде).
    function waitForOppAndAdvance(playerCorrect, playerTime, isTimeout){
      const waitStartedAt = Date.now();
      const MAX_WAIT_MS = 5000; // максимум ждём ответ соперника 5 секунд

      function tryAdvance(){
        if(answeredRef.current) return;
        // PvP: ищем ответ соперника по qId — изоляция между вопросами.
        const oppPvP = isPvP && oppAnswersRef?.current ? oppAnswersRef.current[q.id] : null;
        const oppShadow = oppFinishedRef.current;
        const oppHasAnswered = isPvP ? (oppPvP != null) : (oppShadow != null);
        const elapsed = Date.now() - waitStartedAt;
        const minFeedbackElapsed = elapsed >= SHOW_FEEDBACK_MS;
        const maxWaitElapsed = elapsed >= MAX_WAIT_MS;

        if((oppHasAnswered && minFeedbackElapsed) || maxWaitElapsed){
          const oppData = isPvP
            ? (oppPvP || { correct: false, time: QUESTION_TIME * 1000 })
            : (oppShadow || { correct: false, time: isTimeout ? QUESTION_TIME * 1000 : playerTime + 500 });
          safeAnswer({
            playerCorrect, playerTime,
            oppCorrect: oppData.correct,
            oppTime: oppData.time,
          });
        } else {
          setTimeout(tryAdvance, 150);
        }
      }
      // Первая попытка через SHOW_FEEDBACK_MS (минимум показать feedback)
      setTimeout(tryAdvance, SHOW_FEEDBACK_MS);
    }

    function handleTimeout(){
      if(chosen != null || answeredRef.current) return;
      setChosen(-1);
      // При timeout тоже шлём opp-answer чтобы соперник знал
      if(isPvP && transport){
        try {
          transport.send({ t: 'opp-answer', correct: false, time: QUESTION_TIME * 1000, qId: q.id });
        } catch(_){}
      }
      waitForOppAndAdvance(false, QUESTION_TIME * 1000, true);
    }

    function pick(idx){
      if(chosen != null || answeredRef.current) return;
      setChosen(idx);
      const playerTime = Date.now() - startedAt.current;
      const playerCorrect = idx === q.correct;

      if(isPvP && transport){
        try {
          transport.send({ t: 'opp-answer', correct: playerCorrect, time: playerTime, qId: q.id });
        } catch(_){}
      }

      waitForOppAndAdvance(playerCorrect, playerTime, false);
    }

    // pick для fill-blank — принимает строку, проверяет нормализованно
    function pickFill(text){
      if(chosen != null || answeredRef.current) return;
      const acceptable = [q.correct, ...(q.alternatives || [])].map(s =>
        String(s || '').toLowerCase().trim()
          .replace(/ё/g, 'е')
          .replace(/[.,!?;:"'()\[\]]/g, '')
          .replace(/\s+/g, ' ')
      );
      const normalized = String(text || '').toLowerCase().trim()
        .replace(/ё/g, 'е')
        .replace(/[.,!?;:"'()\[\]]/g, '')
        .replace(/\s+/g, ' ');
      const playerCorrect = acceptable.includes(normalized);
      setChosen(text);
      const playerTime = Date.now() - startedAt.current;
      if(isPvP && transport){
        try { transport.send({ t: 'opp-answer', correct: playerCorrect, time: playerTime, qId: q.id }); } catch(_){}
      }
      waitForOppAndAdvance(playerCorrect, playerTime, false);
    }

    const showFeedback = chosen != null;
    const qType = q.type || 'single-choice';
    let playerCorrect, feedbackKind;

    if(qType === 'fill-blank'){
      const acceptable = [q.correct, ...(q.alternatives || [])].map(s =>
        String(s || '').toLowerCase().trim()
          .replace(/ё/g, 'е').replace(/[.,!?;:"'()\[\]]/g, '').replace(/\s+/g, ' ')
      );
      const normalized = String(chosen || '').toLowerCase().trim()
        .replace(/ё/g, 'е').replace(/[.,!?;:"'()\[\]]/g, '').replace(/\s+/g, ' ');
      playerCorrect = chosen != null && acceptable.includes(normalized);
      feedbackKind = chosen == null ? 'timeout' : (playerCorrect ? 'correct' : 'wrong');
    } else {
      playerCorrect = chosen === q.correct;
      feedbackKind = chosen === -1 ? 'timeout' : (playerCorrect ? 'correct' : 'wrong');
    }
    const playerBusey = playerCorrect ? buseyForCorrect(Date.now() - startedAt.current) : 0;

    return React.createElement('div', { className: 'tn-fullscreen' },
      React.createElement('div', { className: 'tn-container' },
        React.createElement(TnTopBar, { eyebrow: 'Партия · Раунд ' + roundNum + ' / 6' }),
        React.createElement(TnGameProgress, { qOverall, totalOverall }),
        React.createElement(TnVsHeader, { player, scoreP, opponent, scoreO }),
        React.createElement(TnTimerBar, { timeLeft, paused: showFeedback }),
        React.createElement(TnQuestionCard, {
          qOverall, totalOverall, themeName: theme.name,
          text: q.text, timeLeft, showFeedback,
          qType
        }),
        // ─── Роутер по типу вопроса ───
        qType === 'true-false' && React.createElement(TnTrueFalse, {
          chosen, correctIdx: q.correct, showFeedback, onPick: pick,
        }),
        qType === 'fill-blank' && React.createElement(TnFillBlank, {
          correct: q.correct, alternatives: q.alternatives,
          chosen, showFeedback, onSubmit: pickFill,
        }),
        (qType === 'single-choice' || !qType) && React.createElement(TnOptions, {
          options: q.options, chosen, correctIdx: q.correct, showFeedback, onPick: pick,
        }),
        showFeedback && React.createElement(TnFeedbackBanner, { kind: feedbackKind, busey: playerBusey }),
        !showFeedback && React.createElement('div', { className: 'tn-foot' },
          React.createElement('span', { className: 'tn-foot-hint' }, 'Чем быстрее верный ответ — тем больше бусин')
        )
      )
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Final Result — экран завершения Партии (декомпозиция)
  // ═══════════════════════════════════════════════════════════════════

  // ─── Заголовок и церемониальная подпись ─────────────────────────
  function TnFinalHeadline({ kind, headline, sub }){
    const eyebrowLabel = kind === 'win' ? 'Победа' : kind === 'draw' ? 'Ничья' : kind === 'leave' ? 'Партия прервана' : 'Поражение';
    return React.createElement('header', { className: 'tn-final-head' },
      React.createElement('div', { className: 'tn-final-eyebrow tn-final-eyebrow-' + kind }, '✦  ', eyebrowLabel),
      React.createElement('h1', { className: 'tn-final-headline' }, headline),
      React.createElement('p', { className: 'tn-final-sub' }, sub)
    );
  }

  // ─── Большие цифры счёта (ты vs соперник) ──────────────────────
  function TnFinalVs({ playerName, scoreP, opponentName, scoreO, kind }){
    const playerWin = kind === 'win';
    const oppWin = kind === 'lose';
    return React.createElement('div', { className: 'tn-final-vs' },
      React.createElement('div', { className: 'tn-final-vs-side ' + (playerWin ? 'tn-final-vs-side-winner' : oppWin ? 'tn-final-vs-side-loser' : '') },
        React.createElement('div', { className: 'tn-final-vs-name' }, playerName || 'Игрок'),
        React.createElement('div', { className: 'tn-final-vs-num' }, scoreP),
        React.createElement('div', { className: 'tn-final-vs-unit' }, 'бусин ✦')
      ),
      React.createElement('div', { className: 'tn-final-vs-divider' }, ':'),
      React.createElement('div', { className: 'tn-final-vs-side ' + (oppWin ? 'tn-final-vs-side-winner' : playerWin ? 'tn-final-vs-side-loser' : '') },
        React.createElement('div', { className: 'tn-final-vs-name' }, opponentName || 'Тень'),
        React.createElement('div', { className: 'tn-final-vs-num' }, scoreO),
        React.createElement('div', { className: 'tn-final-vs-unit' }, 'бусин ✦')
      )
    );
  }

  // ─── Статистика партии (точность · скорость · бусины) ──────────
  function TnFinalStats({ correctCount, totalQ, avgTimeMs, totalBusey }){
    const accuracyPct = totalQ > 0 ? Math.round(correctCount / totalQ * 100) : 0;
    const avgSec = avgTimeMs > 0 ? (avgTimeMs / 1000).toFixed(1) : '—';
    return React.createElement('div', { className: 'tn-final-stats' },
      React.createElement('div', { className: 'tn-final-stat' },
        React.createElement('div', { className: 'tn-final-stat-label' }, 'Точность'),
        React.createElement('div', { className: 'tn-final-stat-value' }, correctCount, ' / ', totalQ),
        React.createElement('div', { className: 'tn-final-stat-sub' }, accuracyPct, '% верных')
      ),
      React.createElement('div', { className: 'tn-final-stat' },
        React.createElement('div', { className: 'tn-final-stat-label' }, 'Скорость'),
        React.createElement('div', { className: 'tn-final-stat-value' }, avgSec, ' с'),
        React.createElement('div', { className: 'tn-final-stat-sub' }, 'средний ответ')
      ),
      React.createElement('div', { className: 'tn-final-stat tn-final-stat-accent' },
        React.createElement('div', { className: 'tn-final-stat-label' }, 'Бусины'),
        React.createElement('div', { className: 'tn-final-stat-value' }, '+', totalBusey),
        React.createElement('div', { className: 'tn-final-stat-sub' }, 'в Хронику')
      )
    );
  }

  // ─── Объяснение скоринга (помогает понять смысл игры) ──────────
  function TnFinalScoring(){
    return React.createElement('div', { className: 'tn-final-scoring' },
      React.createElement('div', { className: 'tn-final-scoring-eyebrow' }, '◷  Как считаются бусины'),
      React.createElement('div', { className: 'tn-final-scoring-text' },
        React.createElement('strong', null, '10 бусин'), ' за верный ответ. ',
        '+ до ', React.createElement('strong', null, '5 бусин'), ' за быстрый ответ. ',
        React.createElement('em', null, 'Точность важнее скорости.')
      )
    );
  }

  // ─── «Где увидеть результат» ───────────────────────────────────
  // Light theme: классический список с буллитами.
  // Dark theme (theme-vk-dark): VK-Scheme — 3 пронумерованных шага.
  function TnFinalArchive(){
    return React.createElement('div', { className: 'tn-final-archive' },
      // ─── Light: оригинальный список, скрыт в Dark ───
      React.createElement('div', { className: 'vk-light-only' },
        React.createElement('div', { className: 'tn-final-archive-eyebrow' }, '☷  Партия записана в'),
        React.createElement('ul', { className: 'tn-final-archive-list' },
          React.createElement('li', null, React.createElement('strong', null, 'Хронику'), ' — список твоих партий'),
          React.createElement('li', null, React.createElement('strong', null, 'Достижения'), ' — открыты звания и серии'),
          React.createElement('li', null, React.createElement('strong', null, 'Партитуру'), ' — мастерство по темам Ясны')
        )
      ),
      // ─── Dark: VK-Scheme — куда уходит партия ───
      React.createElement('div', { className: 'vk-scheme-block' },
        React.createElement('div', { className: 'vk-scheme' },
          React.createElement('div', { className: 'vk-scheme-canvas' },
            React.createElement('div', { className: 'vk-scheme-header' },
              React.createElement('h3', { className: 'vk-scheme-header-title' }, 'Партия записана в три места'),
              React.createElement('span', { className: 'vk-scheme-tag vk-scheme-tag--mute' }, '✦  итог')
            ),
            React.createElement('ol', { className: 'vk-scheme-steps' },
              React.createElement('li', { className: 'vk-scheme-step' },
                React.createElement('div', { className: 'vk-scheme-num' },
                  React.createElement('div', { className: 'vk-scheme-num-inner' }, '01')
                ),
                React.createElement('div', { className: 'vk-scheme-desc' },
                  React.createElement('div', { className: 'vk-scheme-desc-title' }, 'Хроника'),
                  React.createElement('div', { className: 'vk-scheme-desc-text' }, 'Список всех твоих партий — кто, когда, со счётом')
                )
              ),
              React.createElement('li', { className: 'vk-scheme-step' },
                React.createElement('div', { className: 'vk-scheme-num' },
                  React.createElement('div', { className: 'vk-scheme-num-inner' }, '02')
                ),
                React.createElement('div', { className: 'vk-scheme-desc' },
                  React.createElement('div', { className: 'vk-scheme-desc-title' }, 'Достижения'),
                  React.createElement('div', { className: 'vk-scheme-desc-text' }, 'Открываются звания и серии — отметки твоего пути')
                )
              ),
              React.createElement('li', { className: 'vk-scheme-step' },
                React.createElement('div', { className: 'vk-scheme-num' },
                  React.createElement('div', { className: 'vk-scheme-num-inner' }, '03')
                ),
                React.createElement('div', { className: 'vk-scheme-desc' },
                  React.createElement('div', { className: 'vk-scheme-desc-title' }, 'Партитура'),
                  React.createElement('div', { className: 'vk-scheme-desc-text' }, 'Растёт мастерство по шести темам Ясны')
                )
              )
            ),
            React.createElement('div', { className: 'vk-scheme-foot' },
              'Прогресс зачитывается сразу после завершения партии.')
          )
        )
      )
    );
  }

  // ─── Разбор ошибок с цитатами из книги ────────────────────────
  // Каждая ошибка раскрывается отдельной карточкой: вопрос + правильный
  // ответ + дословная цитата из источника (атома). Если ошибок > 0 —
  // блок появляется в финале, иначе — поздравительная плашка.
  function TnFinalRecap({ partiyaLog }){
    const wrongs = partiyaLog.filter(r => !r.playerCorrect);
    const total = partiyaLog.length;

    if(wrongs.length === 0){
      // Все верно — поздравительная плашка вместо разбора
      return React.createElement('div', { className: 'tn-final-recap tn-final-recap-perfect' },
        React.createElement('div', { className: 'tn-final-recap-eyebrow' }, '✦  Безупречно'),
        React.createElement('div', { className: 'tn-final-recap-title' }, 'Все ', total, ' вопросов верно'),
        React.createElement('div', { className: 'tn-final-recap-text' },
          'Ты прошёл партию без единой ошибки. Это редкость — Тень оценила.'
        )
      );
    }

    return React.createElement('div', { className: 'tn-final-recap' },
      React.createElement('div', { className: 'tn-final-recap-eyebrow' }, '☷  Разбор · ', wrongs.length, ' ошиб', wrongs.length === 1 ? 'ка' : (wrongs.length < 5 ? 'ки' : 'ок')),
      React.createElement('div', { className: 'tn-final-recap-title' }, 'Что говорит книга'),
      React.createElement('ul', { className: 'tn-final-recap-list' },
        wrongs.map((r, i) => {
          const correctText = (r.qOptions && typeof r.qCorrect === 'number')
            ? r.qOptions[r.qCorrect]
            : (typeof r.qCorrect === 'string' ? r.qCorrect : '—');
          return React.createElement('li', { key: i, className: 'tn-final-recap-item' },
            React.createElement('div', { className: 'tn-final-recap-q' },
              React.createElement('span', { className: 'tn-final-recap-q-num' }, '№', i + 1),
              React.createElement('span', { className: 'tn-final-recap-q-theme' }, r.themeName || r.themeId),
              React.createElement('span', { className: 'tn-final-recap-q-text' }, r.qText)
            ),
            React.createElement('div', { className: 'tn-final-recap-answer' },
              React.createElement('span', { className: 'tn-final-recap-answer-label' }, 'Правильно: '),
              React.createElement('strong', null, correctText)
            ),
            r.qHint && React.createElement('blockquote', { className: 'tn-final-recap-quote' }, r.qHint)
          );
        })
      )
    );
  }

  // ─── Кнопки действий ───────────────────────────────────────────
  function TnFinalActions({ onAgain, onClose }){
    return React.createElement('div', { className: 'tn-final-actions' },
      React.createElement('button', {
        className: 'tn-final-btn tn-final-btn-primary',
        onClick: onAgain,
        type: 'button',
      }, 'Новая Партия'),
      React.createElement('button', {
        className: 'tn-final-btn',
        onClick: onClose,
        type: 'button',
      }, 'На главную')
    );
  }

  // ─── Final Result ──────────────────────────────────────────────
  function FinalResult({ partiyaLog, scoreP, scoreO, totalBusey, player, opponent, isPvP, oppDisconnected, onClose, onAgain }){
    const won = scoreP > scoreO;
    const draw = scoreP === scoreO;
    const correctCount = partiyaLog.filter(r => r.playerCorrect).length;
    const totalQ = partiyaLog.length;
    const totalTime = partiyaLog.reduce((s, r) => s + (r.playerTime || 0), 0);
    const avgTimeMs = totalQ > 0 ? totalTime / totalQ : 0;

    let kind, headline, sub;
    if(oppDisconnected){
      kind = 'leave';
      headline = 'Собеседник вышел';
      sub = 'Партия не завершена. Бусины не зачтены — сыграй заново.';
    } else if(won){
      kind = 'win';
      headline = 'Партия твоя.';
      sub = isPvP
        ? 'Ты опередил собеседника. Бусины зачтены в Хронику.'
        : 'Ты опередил Тень. Бусины зачтены в Хронику.';
    } else if(draw){
      kind = 'draw';
      headline = 'Равная Партия.';
      sub = 'Партия равная. Сыграй ещё — следующий ход за тобой.';
    } else {
      kind = 'lose';
      headline = isPvP ? 'Собеседник обогнал.' : 'Тень обогнала.';
      sub = 'В игре нет проигравших — есть те, кто знает чуть меньше. Знаки помнят твой путь. Завтра — новая Партия.';
    }

    // System Message при PvP-disconnect — заменяет привычный финал на пояснение
    var disconnectMsg = oppDisconnected && React.createElement('div', { className: 'vk-scheme-block' },
      React.createElement('div', { className: 'vk-sysmsg vk-sysmsg--warn' },
        React.createElement('div', { className: 'vk-sysmsg-icon', 'aria-hidden': 'true' }, '↯'),
        React.createElement('div', { className: 'vk-sysmsg-body' },
          React.createElement('div', { className: 'vk-sysmsg-title' }, 'Связь с собеседником прервана'),
          React.createElement('div', { className: 'vk-sysmsg-text' },
            'Партия не засчитывается, бусины не начисляются. Открой комнату заново или сыграй с Тенью.'
          )
        )
      )
    );

    return React.createElement('div', { className: 'tn-fullscreen' },
      React.createElement('div', { className: 'tn-container tn-container-final' },
        React.createElement(TnTopBar, { eyebrow: 'Партия завершена' }),
        React.createElement('div', { className: 'tn-final' },
          React.createElement(TnFinalHeadline, { kind, headline, sub }),
          disconnectMsg,
          !oppDisconnected && React.createElement(TnFinalVs, {
            playerName: player.nickname,
            scoreP,
            opponentName: opponent.name,
            scoreO,
            kind,
          }),
          !oppDisconnected && React.createElement(TnFinalStats, {
            correctCount, totalQ, avgTimeMs, totalBusey,
          }),
          !oppDisconnected && React.createElement(TnFinalRecap, { partiyaLog }),
          !oppDisconnected && React.createElement(TnFinalScoring, null),
          !oppDisconnected && React.createElement(TnFinalArchive, null),
          React.createElement(TnFinalActions, { onAgain, onClose })
        )
      )
    );
  }

  // ─── Main Engine ─────────────────────────────────────────────────
  function TurnirGame({ player, opponentLevel, onClose, opponentMode, transport, role, oppData }){
    React.useEffect(() => { window.__tnOnClose = onClose; return () => { delete window.__tnOnClose; }; }, [onClose]);

    const isPvP = opponentMode === 'pvp' && transport;

    // Для PvP: opponent — это живой игрок; для shadow — Тень
    const opp = isPvP
      ? {
          name: oppData?.nickname || 'Собеседник',
          subtitle: 'real-time',
          glyph: oppData?.avatar || '◐',
          level: 'pvp',
        }
      : TEN_LEVELS[opponentLevel || 'medium'];

    const [phase, setPhase] = useState('vs');

    // Для PvP: хост генерирует Партию, шлёт её гостю; гость ждёт.
    // Для shadow: каждый раз новый seed.
    const [partiya, setPartiya] = useState(() => {
      if(!isPvP || role === 'host') {
        return window.YasnaTrivia.generatePartiya(Date.now());
      }
      return null; // гость ждёт от хоста
    });

    const [roundIdx, setRoundIdx] = useState(0);
    const [qIdx, setQIdx] = useState(0);
    const [scoreP, setScoreP] = useState(0);
    const [scoreO, setScoreO] = useState(0);
    const [totalBusey, setTotalBusey] = useState(0);
    const [partiyaLog, setPartiyaLog] = useState([]);
    const [oppDisconnected, setOppDisconnected] = useState(false);

    // ─── PvP: Sync Партии и обмен ответами ───
    // Map по qId — каждый ответ соперника привязан к конкретному вопросу.
    // Это решает race-condition: если ответ на вопрос N приходит когда мы
    // уже на N+1, он не попадает в "не тот вопрос".
    const oppAnswersRef = useRef({});
    useEffect(() => {
      if(!isPvP || !transport) return;

      const off = transport.on(msg => {
        // debug: console.log('[turnir/recv] type=' + msg.t + ' role=' + role);
        if(msg.t === 'partiya-init' && role === 'guest'){
          const restored = msg.partiya.map(r => {
            const theme = window.YasnaTrivia.getTheme(r.theme.id) || r.theme;
            const allQs = window.YasnaTrivia.getQuestionsForTheme(r.theme.id);
            const questions = r.questions.map(qid => allQs.find(q => q.id === qid)).filter(Boolean);
            return { theme, questions };
          });
          // debug: console.log('[turnir/recv] restored ' + restored.length + ' rounds');
          setPartiya(restored);
        }
        if(msg.t === 'opp-answer'){
          // Пишем в map по qId. Никогда не перезаписываем чужие.
          if(msg.qId){
            oppAnswersRef.current[msg.qId] = { correct: msg.correct, time: msg.time };
          }
        }
        if(msg.t === 'opp-leave'){
          setOppDisconnected(true);
        }
      });

      // Хост отправляет Партию гостю
      if(role === 'host' && partiya){
        const seed = Date.now();
        const newPartiya = window.YasnaTrivia.generatePartiya(seed);
        setPartiya(newPartiya);
        // Пушим сразу, без setTimeout — буфер на гостя поймает если он ещё не готов
        transport.send({ t: 'partiya-init', seed, partiya: newPartiya.map(r => ({
          theme: { id: r.theme.id, name: r.theme.name },
          questions: r.questions.map(q => q.id),
        })) });
      }

      return off;
    }, [isPvP, transport, role]);

    // ─── Guard: гость в PvP может ещё не получить partiya-init от хоста.
    // partiya === null → показываем loading и ждём хоста.
    // Без этого падает `partiya[roundIdx]` → TypeError reading '0'.
    if(isPvP && role === 'guest' && !partiya){
      return React.createElement('div', { className: 'tn-overlay' },
        React.createElement('div', { className: 'tn-card', style: { textAlign: 'center', padding: '40px 24px' } },
          React.createElement('div', { className: 'tn-eyebrow' }, '✦  Ожидаем хозяина'),
          React.createElement('h2', { style: { margin: '12px 0 8px' } }, 'Хозяин готовит Партию…'),
          React.createElement('p', { style: { color: 'var(--ts-muted, #888)' } },
            'Сейчас он отправит начальную раскладку, и мы стартуем.'),
          React.createElement('div', { style: { marginTop: 24, fontSize: 32, opacity: 0.6 } }, '◐  ◑'),
        )
      );
    }

    const currentRound = partiya[roundIdx];
    const currentQ = currentRound?.questions[qIdx];
    const totalOverall = partiya.reduce((sum, r) => sum + r.questions.length, 0);
    const qOverall = partiya.slice(0, roundIdx).reduce((sum, r) => sum + r.questions.length, 0) + qIdx;

    function onAnswer(result){
      let dp = 0, doO = 0, dB = 0;
      if(result.playerCorrect){
        const b = buseyForCorrect(result.playerTime);
        dp = b;
        dB = 5 + Math.floor(b / 4);
      }
      if(result.oppCorrect){
        doO = buseyForCorrect(result.oppTime);
      }
      const newScoreP = scoreP + dp;
      const newScoreO = scoreO + doO;
      const newBusey = totalBusey + dB;

      const logEntry = {
        themeId: currentRound.theme.id,
        themeName: currentRound.theme.name,
        qId: currentQ.id,
        qText: currentQ.text,
        qOptions: currentQ.options,
        qCorrect: currentQ.correct,
        qHint: currentQ.hint,                // explanation.quote из контента
        qType: currentQ.type || 'single-choice',
        playerCorrect: result.playerCorrect,
        oppCorrect: result.oppCorrect,
        playerTime: result.playerTime,
      };
      const newLog = [...partiyaLog, logEntry];

      setScoreP(newScoreP);
      setScoreO(newScoreO);
      setTotalBusey(newBusey);
      setPartiyaLog(newLog);

      if(qIdx < currentRound.questions.length - 1){
        setQIdx(qIdx + 1);
      } else if(roundIdx < partiya.length - 1){
        setRoundIdx(roundIdx + 1);
        setQIdx(0);
        setPhase('intro');
      } else {
        // newLog содержит ВСЕ записи включая последнюю (state ещё не обновился)
        finishPartiya(newScoreP, newScoreO, newBusey, newLog);
      }
    }

    function finishPartiya(finalP, finalO, finalB, finalLog){
      const log = finalLog || partiyaLog;
      const totalTime = log.reduce((s, r) => s + (r.playerTime || 0), 0);
      const sharedMatchId = 'turnir-' + Date.now();
      const Storage = window.YasnaDuelStorage;
      if(Storage?.recordMatch){
        const matchData = {
          matchId: sharedMatchId,
          gameId: 'turnir',
          yasnaId: 'суток',
          result: finalP > finalO ? 'win' : (finalP === finalO ? 'draw' : 'loss'),
          score: finalP,
          maxScore: 18 * 15,
          time: totalTime,
          transport: 'bot',
          isBot: true,
          bySurrender: false,
          themesPlayed: log.map(r => r.themeId),
          correctByTheme: log.reduce((acc, r) => {
            acc[r.themeId] = acc[r.themeId] || { correct:0, total:0 };
            acc[r.themeId].total++;
            if(r.playerCorrect) acc[r.themeId].correct++;
            return acc;
          }, {}),
        };
        try { Storage.recordMatch(matchData); } catch(_){}
      }
      // Обновим masteryByTheme и daily-streak (отдельно от recordMatch)
      try { updateMasteryAndDaily(log); } catch(_){}

      const LB = window.YasnaLeaderboardClient;
      if(LB?.submitMatch){
        LB.submitMatch({
          matchId: sharedMatchId,
          deviceId: window.YasnaDuelProfile?.load?.()?.deviceId,
          nickname: player.nickname,
          avatar: typeof player.avatar === 'string' ? player.avatar : '·',
          gameId: 'turnir',
          yasnaId: 'суток',
          result: finalP > finalO ? 'win' : 'loss',
          score: finalP,
          maxScore: 270,
          time: totalTime,
          transport: 'bot',
          isBot: true,
        }).catch(() => {});
      }
      setPhase('final');
    }

    // Обновляем мастерство по темам и daily-стрик прямо в localStorage.
    // recordMatch их не трогает, а duel-page читает их в Партитуре и Hero.
    function updateMasteryAndDaily(log){
      const KEY = 'yasna_duel_data';
      let raw;
      try { raw = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(_){ raw = {}; }
      raw.masteryByTheme = raw.masteryByTheme || {};
      // counter: сколько было верных по теме / сколько было всего
      const counter = log.reduce((acc, r) => {
        acc[r.themeId] = acc[r.themeId] || { c:0, t:0 };
        acc[r.themeId].t++;
        if(r.playerCorrect) acc[r.themeId].c++;
        return acc;
      }, {});
      // EMA: новое значение = 0.6 * старое + 0.4 * текущее_в_партии (в %).
      Object.keys(counter).forEach(tid => {
        const cur = counter[tid].t > 0 ? Math.round(counter[tid].c / counter[tid].t * 100) : 0;
        const prev = raw.masteryByTheme[tid] || 0;
        raw.masteryByTheme[tid] = Math.round(prev * 0.6 + cur * 0.4);
      });
      // Daily streak — если играл вчера или сегодня, продолжаем; если разрыв — обнуляем.
      raw.streaks = raw.streaks || {};
      raw.streaks.daily = raw.streaks.daily || { current: 0, best: 0, lastDay: null };
      const today = new Date().toISOString().slice(0, 10);
      const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const last = raw.streaks.daily.lastDay;
      if(last === today){
        // уже считали сегодня — ничего
      } else if(last === yest){
        raw.streaks.daily.current = (raw.streaks.daily.current || 0) + 1;
      } else {
        raw.streaks.daily.current = 1;
      }
      raw.streaks.daily.lastDay = today;
      if(raw.streaks.daily.current > (raw.streaks.daily.best || 0)){
        raw.streaks.daily.best = raw.streaks.daily.current;
      }
      try { localStorage.setItem(KEY, JSON.stringify(raw)); } catch(_){}
    }

    function startAgain(){ onClose(); }

    if(phase === 'vs'){
      return React.createElement(VsScreen, {
        player,
        opponent: { name: opp.name, subtitle: opp.level === 'easy' ? 'Лёгкая' : (opp.level === 'hard' ? 'Сильная' : 'Средняя') },
        themes: partiya,
        onReady: () => setPhase('intro')
      });
    }
    if(phase === 'intro'){
      return React.createElement(RoundIntro, {
        key: 'intro-' + roundIdx,
        roundNum: roundIdx + 1,
        theme: currentRound.theme,
        onReady: () => setPhase('question')
      });
    }
    if(phase === 'question'){
      // КРИТИЧНО: key на основе вопроса — React гарантированно пересоздаёт
      // компонент при смене вопроса. Без этого state (chosen/timer) переносится
      // между вопросами и игра ломается после первого клика.
      return React.createElement(Question, {
        key: 'q-' + roundIdx + '-' + qIdx,
        q: currentQ, theme: currentRound.theme,
        qIndex: qIdx, totalInRound: currentRound.questions.length,
        qOverall, totalOverall, roundNum: roundIdx + 1,
        scoreP, scoreO,
        player,
        opponent: { name: opp.name, level: opponentLevel || 'medium' },
        onAnswer,
        isPvP, transport, oppAnswersRef,
      });
    }
    if(phase === 'final'){
      return React.createElement(FinalResult, {
        partiyaLog, scoreP, scoreO, totalBusey,
        player,
        opponent: { name: opp.name },
        isPvP,
        oppDisconnected,
        onClose, onAgain: startAgain
      });
    }
    return null;
  }

  window.YasnaTurnir = { TurnirGame };
})();
