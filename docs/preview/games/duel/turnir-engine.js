// ═══════════════════════════════════════════════════════════════════
// Движок Партии (Турнир) · Игра по Ясне
// 6 Тем × 3 вопроса = 18 вопросов · Игрок vs Тень
// ═══════════════════════════════════════════════════════════════════
(function(){
  const { useState, useEffect, useRef } = React;

  const QUESTION_TIME = 15; // секунд на вопрос
  const SHOW_FEEDBACK_MS = 1800;
  const SHOW_VS_MS = 1500;
  const SHOW_ROUND_INTRO_MS = 1500;

  const TEN_LEVELS = {
    easy:   { name: 'Лёгкая Тень', accuracy: 0.55, minTime: 4, maxTime: 8, avatar: '🌫' },
    medium: { name: 'Тень',        accuracy: 0.75, minTime: 3, maxTime: 6, avatar: '👤' },
    hard:   { name: 'Старшая Тень', accuracy: 0.92, minTime: 1, maxTime: 3, avatar: '🗿' },
  };

  function buseyForCorrect(timeMs, total){
    const baseScore = 10;
    const speedBonus = Math.max(0, Math.round(5 * (1 - timeMs / (QUESTION_TIME * 1000))));
    return baseScore + speedBonus;
  }

  // ─── Vs-экран ───────────────────────────────────────────────────
  function VsScreen({ player, opponent, themes, onReady }){
    useEffect(() => {
      const t = setTimeout(onReady, SHOW_VS_MS);
      return () => clearTimeout(t);
    }, []);
    return React.createElement('div', { className: 'tn-fullscreen' },
      React.createElement('div', { className: 'tn-vs' },
        React.createElement('div', { className: 'tn-vs-title' }, 'Готовимся к Партии…'),
        React.createElement('div', { className: 'tn-vs-row' },
          React.createElement('div', { className: 'tn-vs-side tn-vs-left' },
            React.createElement('div', { className: 'tn-vs-avatar' }, player.avatar || '🦊'),
            React.createElement('div', { className: 'tn-vs-name' }, player.nickname),
            React.createElement('div', { className: 'tn-vs-rank' }, player.rank || 'Послушник')
          ),
          React.createElement('div', { className: 'tn-vs-mid' }, '⚡'),
          React.createElement('div', { className: 'tn-vs-side tn-vs-right' },
            React.createElement('div', { className: 'tn-vs-avatar' }, opponent.avatar || '👤'),
            React.createElement('div', { className: 'tn-vs-name' }, opponent.name),
            React.createElement('div', { className: 'tn-vs-rank' }, opponent.subtitle || '')
          )
        ),
        React.createElement('div', { className: 'tn-vs-themes' },
          React.createElement('div', { className: 'tn-vs-themes-label' }, 'Темы Партии:'),
          React.createElement('div', { className: 'tn-vs-themes-list' },
            themes.map((th, i) =>
              React.createElement('span', { key: th.theme.id, className: 'tn-vs-theme', style: { animationDelay: (i*0.15)+'s' } },
                th.theme.emoji
              )
            )
          )
        )
      )
    );
  }

  // ─── Round Intro ────────────────────────────────────────────────
  function RoundIntro({ roundNum, theme, onReady }){
    useEffect(() => {
      const t = setTimeout(onReady, SHOW_ROUND_INTRO_MS);
      return () => clearTimeout(t);
    }, []);
    return React.createElement('div', { className: 'tn-fullscreen' },
      React.createElement('div', { className: 'tn-round-intro' },
        React.createElement('div', { className: 'tn-round-num' }, 'Раунд ', roundNum, ' / 6'),
        React.createElement('div', { className: 'tn-round-emoji' }, theme.emoji),
        React.createElement('div', { className: 'tn-round-name' }, theme.name)
      )
    );
  }

  // ─── Question ───────────────────────────────────────────────────
  function Question({ q, theme, qIndex, totalInRound, scoreP, scoreO, opponent, onAnswer }){
    const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
    const [chosen, setChosen] = useState(null);
    const [oppAnswered, setOppAnswered] = useState(false);
    const startedAt = useRef(Date.now());

    // Симуляция ответа Тени
    useEffect(() => {
      const t = TEN_LEVELS[opponent.level] || TEN_LEVELS.medium;
      const oppTime = (t.minTime + Math.random() * (t.maxTime - t.minTime)) * 1000;
      const oppCorrect = Math.random() < t.accuracy;
      const tm = setTimeout(() => {
        setOppAnswered(true);
        onOppFinished(oppCorrect, oppTime);
      }, oppTime);
      return () => clearTimeout(tm);
    }, []);

    // Таймер
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

    const oppFinishedRef = useRef(null);
    function onOppFinished(correct, time){
      oppFinishedRef.current = { correct, time };
    }

    function handleTimeout(){
      if(chosen != null) return;
      setChosen(-1); // никакого ответа
      setTimeout(() => onAnswer({
        playerCorrect: false, playerTime: QUESTION_TIME * 1000,
        oppCorrect: oppFinishedRef.current?.correct ?? false,
        oppTime: oppFinishedRef.current?.time ?? QUESTION_TIME * 1000,
      }), SHOW_FEEDBACK_MS);
    }

    function pick(idx){
      if(chosen != null) return;
      setChosen(idx);
      const playerTime = Date.now() - startedAt.current;
      const playerCorrect = idx === q.correct;
      // Если Тень не успела — ждём её
      const finishOnce = () => onAnswer({
        playerCorrect, playerTime,
        oppCorrect: oppFinishedRef.current?.correct ?? false,
        oppTime: oppFinishedRef.current?.time ?? playerTime + 500,
      });
      setTimeout(finishOnce, SHOW_FEEDBACK_MS);
    }

    const showFeedback = chosen != null;
    return React.createElement('div', { className: 'tn-fullscreen tn-question-screen' },
      // Header
      React.createElement('div', { className: 'tn-q-header' },
        React.createElement('div', { className: 'tn-q-counter' },
          'Вопрос ', qIndex + 1, ' / ', totalInRound
        ),
        React.createElement('div', { className: 'tn-q-score' },
          React.createElement('span', null, '🦊 ', scoreP),
          React.createElement('span', { style: {opacity:0.4} }, ' vs '),
          React.createElement('span', null, scoreO, ' ', opponent.avatar || '👤')
        )
      ),
      // Theme tag
      React.createElement('div', { className: 'tn-q-theme' },
        theme.emoji, ' ', theme.name
      ),
      // Question text
      React.createElement('div', { className: 'tn-q-text' }, q.text),
      // Timer
      React.createElement('div', { className: 'tn-q-timer' },
        React.createElement('div', {
          className: 'tn-q-timer-bar' + (timeLeft <= 5 ? ' tn-q-timer-bar-low' : ''),
          style: { width: (timeLeft / QUESTION_TIME * 100) + '%' }
        }),
        React.createElement('div', { className: 'tn-q-timer-text' },
          showFeedback ? '' : timeLeft + ' сек'
        )
      ),
      // Options
      React.createElement('div', { className: 'tn-q-options' },
        q.options.map((opt, i) => {
          let cls = 'tn-q-opt';
          if(showFeedback){
            if(i === q.correct) cls += ' tn-q-opt-correct';
            else if(i === chosen && i !== q.correct) cls += ' tn-q-opt-wrong';
            else cls += ' tn-q-opt-dim';
          }
          return React.createElement('button', {
            key: i, className: cls,
            disabled: showFeedback,
            onClick: () => pick(i)
          }, opt);
        })
      ),
      // Hint после ответа
      showFeedback && React.createElement('div', {
        className: 'tn-q-hint ' + (chosen === q.correct ? 'tn-q-hint-good' : 'tn-q-hint-bad')
      },
        chosen === q.correct
          ? React.createElement('strong', null, '✓ Верно')
          : (chosen === -1
              ? React.createElement('strong', null, '⏰ Время вышло')
              : React.createElement('strong', null, '✗ Не верно')
          ),
        React.createElement('div', { style: {marginTop:8, fontWeight:400} }, q.hint || '')
      )
    );
  }

  // ─── Final Result ───────────────────────────────────────────────
  function FinalResult({ partiyaLog, scoreP, scoreO, totalBusey, opponent, onClose, onAgain }){
    const won = scoreP > scoreO;
    const draw = scoreP === scoreO;
    const correctCount = partiyaLog.filter(r => r.playerCorrect).length;
    const totalQ = partiyaLog.length;

    return React.createElement('div', { className: 'tn-fullscreen tn-final' },
      React.createElement('div', { className: 'tn-final-title' },
        won ? 'Партия пройдена' : draw ? 'Ничья' : 'Близкая Партия'
      ),
      React.createElement('div', { className: 'tn-final-stars' },
        '★ ', correctCount, ' / ', totalQ
      ),
      React.createElement('div', { className: 'tn-final-score' },
        React.createElement('span', null, '🦊 ', scoreP),
        React.createElement('span', { style: {opacity:0.4, margin:'0 8px'} }, ' vs '),
        React.createElement('span', null, scoreO, ' ', opponent.avatar || '👤')
      ),
      React.createElement('div', { className: 'tn-final-busey' },
        '+', totalBusey, ' бусин'
      ),
      React.createElement('div', { className: 'tn-final-actions' },
        React.createElement('button', { className: 'dp-btn dp-btn-primary dp-btn-large', onClick: onAgain }, 'Новая Партия'),
        React.createElement('button', { className: 'dp-btn dp-btn-secondary', onClick: onClose }, 'В Партитуру')
      )
    );
  }

  // ─── Main Engine ────────────────────────────────────────────────
  function TurnirGame({ player, opponentLevel, onClose }){
    const opponent = TEN_LEVELS[opponentLevel || 'medium'];
    const [phase, setPhase] = useState('vs'); // vs | intro | question | round-end | final
    const [partiya] = useState(() => window.YasnaTrivia.generatePartiya(Date.now()));
    const [roundIdx, setRoundIdx] = useState(0);
    const [qIdx, setQIdx] = useState(0);
    const [scoreP, setScoreP] = useState(0);
    const [scoreO, setScoreO] = useState(0);
    const [totalBusey, setTotalBusey] = useState(0);
    const [partiyaLog, setPartiyaLog] = useState([]);

    const currentRound = partiya[roundIdx];
    const currentQ = currentRound?.questions[qIdx];

    function onAnswer(result){
      // Считаем очки
      let dp = 0, doO = 0, dB = 0;
      if(result.playerCorrect){
        const b = buseyForCorrect(result.playerTime, currentQ.options.length);
        dp = b;
        dB = 5 + Math.floor(b / 4); // бусины: 5 базовых + бонус за скорость/правильность
      }
      if(result.oppCorrect){
        doO = buseyForCorrect(result.oppTime, currentQ.options.length);
      }
      const newScoreP = scoreP + dp;
      const newScoreO = scoreO + doO;
      const newBusey = totalBusey + dB;

      setScoreP(newScoreP);
      setScoreO(newScoreO);
      setTotalBusey(newBusey);
      setPartiyaLog(log => [...log, {
        themeId: currentRound.theme.id,
        qId: currentQ.id,
        playerCorrect: result.playerCorrect,
        oppCorrect: result.oppCorrect,
        playerTime: result.playerTime,
      }]);

      // Следующий вопрос или раунд
      if(qIdx < currentRound.questions.length - 1){
        setQIdx(qIdx + 1);
      } else if(roundIdx < partiya.length - 1){
        setRoundIdx(roundIdx + 1);
        setQIdx(0);
        setPhase('intro');
      } else {
        // Конец партии
        finishPartiya(newScoreP, newScoreO, newBusey);
      }
    }

    function finishPartiya(finalP, finalO, finalB){
      // Сохранить в storage
      const Storage = window.YasnaDuelStorage;
      if(Storage?.recordMatch){
        const matchData = {
          matchId: 'turnir-' + Date.now(),
          gameId: 'turnir',
          yasnaId: 'суток',
          result: finalP > finalO ? 'win' : (finalP === finalO ? 'draw' : 'loss'),
          score: finalP,
          maxScore: 18 * 15, // максимум 18 правильных × 15 (10 base + 5 max bonus)
          time: partiyaLog.reduce((s, r) => s + r.playerTime, 0),
          transport: 'bot',
          isBot: true,
          bySurrender: false,
        };
        try { Storage.recordMatch(matchData); } catch(_){}
      }
      // Отправить в leaderboard если есть
      const LB = window.YasnaLeaderboardClient;
      if(LB?.submitMatch){
        LB.submitMatch({
          matchId: 'turnir-' + Date.now(),
          deviceId: window.YasnaDuelProfile?.load?.()?.deviceId,
          nickname: player.nickname,
          avatar: typeof player.avatar === 'string' ? player.avatar : '🦊',
          gameId: 'turnir',
          yasnaId: 'суток',
          result: finalP > finalO ? 'win' : 'loss',
          score: finalP,
          maxScore: 270,
          time: partiyaLog.reduce((s, r) => s + r.playerTime, 0),
          transport: 'bot',
          isBot: true,
        }).catch(() => {});
      }
      setPhase('final');
    }

    function startAgain(){
      onClose(); // просто закрываем — пользователь снова жмёт кнопку
    }

    // Render
    if(phase === 'vs'){
      return React.createElement(VsScreen, {
        player, opponent: { name: opponent.name, avatar: opponent.avatar, subtitle: opponent.level === 'easy' ? 'Лёгкая' : (opponent.level === 'hard' ? 'Сильная' : 'Средняя') },
        themes: partiya,
        onReady: () => setPhase('intro')
      });
    }
    if(phase === 'intro'){
      return React.createElement(RoundIntro, {
        roundNum: roundIdx + 1,
        theme: currentRound.theme,
        onReady: () => setPhase('question')
      });
    }
    if(phase === 'question'){
      return React.createElement(Question, {
        q: currentQ, theme: currentRound.theme,
        qIndex: qIdx, totalInRound: currentRound.questions.length,
        scoreP, scoreO, opponent: { avatar: opponent.avatar, level: opponentLevel || 'medium' },
        onAnswer
      });
    }
    if(phase === 'final'){
      return React.createElement(FinalResult, {
        partiyaLog, scoreP, scoreO, totalBusey,
        opponent: { avatar: opponent.avatar },
        onClose, onAgain: startAgain
      });
    }
    return null;
  }

  window.YasnaTurnir = { TurnirGame };
})();
