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
          React.createElement('div', { className: 'tn-round-eyebrow' }, 'Касталия зовёт двоих'),
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

  // ─── Question ────────────────────────────────────────────────────
  function Question({ q, theme, qIndex, totalInRound, qOverall, totalOverall, roundNum, scoreP, scoreO, player, opponent, onAnswer, isPvP, transport, oppAnswerRef }){
    const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
    const [chosen, setChosen] = useState(null);
    const startedAt = useRef(Date.now());
    const oppFinishedRef = useRef(null);
    const answeredRef = useRef(false); // защита от двойного onAnswer (race timer vs click)

    useEffect(() => {
      setTimeLeft(QUESTION_TIME);
      setChosen(null);
      startedAt.current = Date.now();
      oppFinishedRef.current = null;
      answeredRef.current = false;
      if(oppAnswerRef) oppAnswerRef.current = null;
    }, [q?.id]);

    // Бот-Тень: симулируем ответ соперника через таймер
    // PvP: ждём реальный ответ соперника через transport
    useEffect(() => {
      if(isPvP) return; // ничего не делаем — ответ соперника прилетит через transport

      const t = TEN_LEVELS[opponent.level] || TEN_LEVELS.medium;
      const oppTime = (t.minTime + Math.random() * (t.maxTime - t.minTime)) * 1000;
      const oppCorrect = Math.random() < t.accuracy;
      const tm = setTimeout(() => {
        oppFinishedRef.current = { correct: oppCorrect, time: oppTime };
      }, oppTime);
      return () => clearTimeout(tm);
    }, [q?.id, opponent.level, isPvP]);

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

    function handleTimeout(){
      if(chosen != null || answeredRef.current) return;
      setChosen(-1);
      setTimeout(() => safeAnswer({
        playerCorrect: false, playerTime: QUESTION_TIME * 1000,
        oppCorrect: oppFinishedRef.current?.correct ?? false,
        oppTime: oppFinishedRef.current?.time ?? QUESTION_TIME * 1000,
      }), SHOW_FEEDBACK_MS);
    }

    function pick(idx){
      if(chosen != null || answeredRef.current) return;
      setChosen(idx);
      const playerTime = Date.now() - startedAt.current;
      const playerCorrect = idx === q.correct;

      // PvP: отправляем свой ответ сопернику
      if(isPvP && transport){
        try {
          transport.send({ t: 'opp-answer', correct: playerCorrect, time: playerTime, qId: q.id });
        } catch(_){}
      }

      setTimeout(() => {
        // Для PvP: используем реальный ответ соперника (если пришёл) или fallback
        const oppData = isPvP
          ? (oppAnswerRef?.current || { correct: false, time: QUESTION_TIME * 1000 })
          : (oppFinishedRef.current || { correct: false, time: playerTime + 500 });
        safeAnswer({
          playerCorrect, playerTime,
          oppCorrect: oppData.correct,
          oppTime: oppData.time,
        });
      }, SHOW_FEEDBACK_MS);
    }

    const showFeedback = chosen != null;
    const optLabels = ['A','B','C','D'];
    const progressPct = ((qOverall + 1) / totalOverall) * 100;

    return React.createElement('div', { className: 'tn-fullscreen' },
      React.createElement('div', { className: 'tn-container' },
        React.createElement(TnTopBar, { eyebrow: 'Партия · Раунд ' + roundNum + ' / 6' }),
        React.createElement('div', { className: 'tn-progress-bar' },
          React.createElement('div', { className: 'tn-progress-fill', style: { width: progressPct + '%' } })
        ),
        React.createElement('div', { className: 'tn-versus' },
          React.createElement('div', { className: 'tn-player' },
            React.createElement('div', { className: 'tn-avatar' }, renderTnAvatar(player.avatar, player.nickname)),
            React.createElement('div', null,
              React.createElement('div', { className: 'tn-player-name' }, player.nickname),
              React.createElement('div', { className: 'tn-player-stats' }, scoreP, ' очков')
            )
          ),
          React.createElement('span', { className: 'tn-vs' }, 'vs'),
          React.createElement('div', { className: 'tn-player tn-player-right' },
            React.createElement('div', { className: 'tn-avatar' }, '◐'),
            React.createElement('div', null,
              React.createElement('div', { className: 'tn-player-name' }, opponent.name || 'Тень'),
              React.createElement('div', { className: 'tn-player-stats' }, scoreO, ' очков')
            )
          )
        ),
        React.createElement('div', { className: 'tn-question-num' },
          'Вопрос ', qOverall + 1, ' из ', totalOverall, ' · ', theme.name
        ),
        React.createElement('div', { className: 'tn-question-text' }, q.text),
        React.createElement('div', { className: 'tn-options' },
          q.options.map((opt, i) => {
            let cls = 'tn-option';
            if(showFeedback){
              if(i === q.correct) cls += ' tn-option-correct';
              else if(i === chosen && i !== q.correct) cls += ' tn-option-wrong';
              else cls += ' tn-option-disabled';
            }
            return React.createElement('button', {
              key: i, className: cls,
              disabled: showFeedback,
              onClick: () => pick(i)
            }, optLabels[i] || (i+1), ' · ', opt, showFeedback && i === q.correct ? '  ✓' : '');
          })
        ),
        React.createElement('div', { className: 'tn-foot' },
          React.createElement('span', null,
            showFeedback
              ? (chosen === q.correct ? 'Верно' : (chosen === -1 ? 'Время вышло' : 'Не верно'))
              : 'Бусины: +10 базовых · бонус за скорость'
          ),
          React.createElement('span', null, showFeedback ? '' : 'Время: ' + timeLeft + ' с')
        )
      )
    );
  }

  // ─── Final Result ────────────────────────────────────────────────
  function FinalResult({ partiyaLog, scoreP, scoreO, totalBusey, player, opponent, isPvP, oppDisconnected, onClose, onAgain }){
    const won = scoreP > scoreO;
    const draw = scoreP === scoreO;
    const correctCount = partiyaLog.filter(r => r.playerCorrect).length;
    const totalQ = partiyaLog.length;

    // Церемониальный copy в духе Гессе
    let headline, sub;
    if(oppDisconnected){
      headline = 'Собеседник вышел';
      sub = 'Партия не завершена. Бусины не учтены.';
    } else if(won){
      headline = 'Партия твоя.';
      sub = isPvP
        ? 'Ты опередил собеседника. Бусины зачтены в Хронику. Магистр Игры запомнит этот узор.'
        : 'Ты опередил Тень. Бусины зачтены в Хронику.';
    } else if(draw){
      headline = 'Равная Партия.';
      sub = 'Узор сложился симметрично. Сыграй ещё.';
    } else {
      headline = isPvP ? 'Собеседник обогнал.' : 'Тень обогнала.';
      sub = 'В игре нет проигравших — есть те, кто знает чуть меньше. Знаки помнят твой путь. Завтра — новая Партия.';
    }

    return React.createElement('div', { className: 'tn-fullscreen' },
      React.createElement('div', { className: 'tn-container' },
        React.createElement(TnTopBar, { eyebrow: '✦ Партия завершена' }),
        React.createElement('div', { className: 'tn-final' },
          React.createElement('div', { className: 'tn-final-eyebrow', style: { letterSpacing: '0.16em' } }, won ? 'Победа' : draw ? 'Ничья' : 'Поражение'),
          React.createElement('h1', { className: 'tn-final-headline', style: { fontFamily: 'ui-serif, Georgia, serif', fontWeight: 500, fontSize: 38, letterSpacing: '-0.01em' } }, headline),
          React.createElement('div', { className: 'tn-final-sub', style: { maxWidth: 540, margin: '0 auto', lineHeight: 1.7, fontStyle: 'italic', opacity: 0.85 } }, sub),
          React.createElement('div', { className: 'tn-final-score-row' },
            React.createElement('div', { className: 'tn-final-score' },
              React.createElement('div', { className: 'tn-final-score-num' }, scoreP),
              React.createElement('div', { className: 'tn-final-score-label' }, player.nickname || 'Игрок')
            ),
            React.createElement('div', { className: 'tn-final-score' },
              React.createElement('div', { className: 'tn-final-score-num' }, scoreO),
              React.createElement('div', { className: 'tn-final-score-label' }, opponent.name || 'Тень')
            ),
            React.createElement('div', { className: 'tn-final-score' },
              React.createElement('div', { className: 'tn-final-score-num' }, '+' + totalBusey),
              React.createElement('div', { className: 'tn-final-score-label' }, 'бусин ✦')
            ),
            React.createElement('div', { className: 'tn-final-score' },
              React.createElement('div', { className: 'tn-final-score-num' }, correctCount + ' / ' + totalQ),
              React.createElement('div', { className: 'tn-final-score-label' }, 'верных')
            )
          ),
          React.createElement('div', { className: 'tn-final-actions' },
            React.createElement('button', { className: 'tn-final-btn tn-final-btn-primary', onClick: onAgain }, 'Новая Партия'),
            React.createElement('button', { className: 'tn-final-btn', onClick: onClose }, 'В Касталию')
          )
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
    const oppAnswerRef = useRef(null);
    useEffect(() => {
      if(!isPvP || !transport) return;

      // Хост отправляет Партию гостю как только подключение готово
      if(role === 'host' && partiya){
        // Отправим seed-партии: gen её на основе seed для повтора
        const seed = Date.now();
        const newPartiya = window.YasnaTrivia.generatePartiya(seed);
        setPartiya(newPartiya);
        setTimeout(() => {
          transport.send({ t: 'partiya-init', seed, partiya: newPartiya.map(r => ({
            theme: { id: r.theme.id, name: r.theme.name },
            questions: r.questions.map(q => q.id),
          })) });
        }, 500);
      }

      const off = transport.on(msg => {
        if(msg.t === 'partiya-init' && role === 'guest'){
          // Восстанавливаем Партию из seed
          const restored = msg.partiya.map(r => {
            const theme = window.YasnaTrivia.getTheme(r.theme.id) || r.theme;
            const allQs = window.YasnaTrivia.getQuestionsForTheme(r.theme.id);
            const questions = r.questions.map(qid => allQs.find(q => q.id === qid)).filter(Boolean);
            return { theme, questions };
          });
          setPartiya(restored);
        }
        if(msg.t === 'opp-answer'){
          oppAnswerRef.current = { correct: msg.correct, time: msg.time };
        }
        if(msg.t === 'opp-leave'){
          setOppDisconnected(true);
        }
      });
      return off;
    }, [isPvP, transport, role]);

    // Guard: гость в PvP может ещё не получить partiya-init от хоста.
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
        qId: currentQ.id,
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
        isPvP, transport, oppAnswerRef,
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
