// ═══════════════════════════════════════════════════════════════════
// Режим «С коллективом» · Касталия Ясны · групповая Партия (N=3..8)
// ───────────────────────────────────────────────────────────────────
// ОТДЕЛЬНЫЙ режим: своя кнопка, своё лобби-комната, свой движок.
// 2p-движок (TurnirGame / scoreP / scoreO) НЕ затрагивается.
//
// Архитектура:
//   • Комната rooms/<code> с meta.kind='group' и мапой players/<deviceId>
//     (см. window.YasnaRT.createGroupRoom/joinGroupRoom/watchPlayers/watchMeta).
//   • Одна детерминированная партия на всех: хост пишет meta.seed, каждый
//     локально строит ИДЕНТИЧНУЮ партию через generatePartiya(seed,...).
//   • Каждый отвечает в своём темпе (15с/вопрос). Свой счёт игрок пишет в
//     свой слот players/<id> — табло у всех обновляется через watchPlayers.
//     /messages в MVP не используем (нет O(N²) трафика).
//   • Итог: хост-судья пишет meta.results (ранжирование) → у всех подиум.
//
// Презентационные компоненты вопроса берём из window.YasnaTurnir.__shared,
// логику правильности — из __shared.checkAnswer (та же, что в 2p).
// ═══════════════════════════════════════════════════════════════════
(function(){
  const { useState, useEffect, useRef, useMemo } = React;

  const FINISH_WAIT_MS = 20000;     // сколько ждать отставших после первого финиша
  const HEARTBEAT_MS = 12000;       // обновление lastSeen в лобби/игре
  const ONLINE_TTL_MS = 30000;      // игрок считается онлайн если online!==false и lastSeen свежий

  // Ленивый доступ к общим компонентам движка (turnir-engine грузится раньше).
  function S(){ return (window.YasnaTurnir && window.YasnaTurnir.__shared) || {}; }
  function RT(){ return window.YasnaRT; }

  function nowMs(){ return Date.now(); }
  function isOnline(p){
    if(!p || p.online === false) return false;
    if(p.lastSeen && (nowMs() - p.lastSeen) > ONLINE_TTL_MS) return false;
    return true;
  }
  // Партия как плоский список { q, theme } из раундов generatePartiya.
  function flattenPartiya(partiya){
    const flat = [];
    (partiya || []).forEach(r => {
      (r.questions || []).forEach(q => flat.push({ q, theme: r.theme }));
    });
    return flat;
  }
  function rankPlayers(playersMap){
    return Object.values(playersMap || {})
      .slice()
      .sort((a, b) =>
        (b.score || 0) - (a.score || 0) ||
        (b.correct || 0) - (a.correct || 0) ||
        (a.joinedAt || 0) - (b.joinedAt || 0)
      );
  }

  // ───────────────────────────────────────────────────────────────────
  // GroupQuestion — один вопрос, независимый темп. Сообщает результат
  // родителю после показа фидбэка. Без логики соперника (это не 2p).
  // ───────────────────────────────────────────────────────────────────
  function GroupQuestion({ q, theme, qOverall, totalOverall, onAnswer }){
    const sh = S();
    const QUESTION_TIME = sh.QUESTION_TIME || 15;
    const SHOW_FEEDBACK_MS = sh.SHOW_FEEDBACK_MS || 1500;
    const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
    const [chosen, setChosen] = useState(null);
    const startedAt = useRef(nowMs());
    const answeredRef = useRef(false);

    useEffect(() => {
      setTimeLeft(QUESTION_TIME);
      setChosen(null);
      startedAt.current = nowMs();
      answeredRef.current = false;
    }, [q && q.id]);

    useEffect(() => {
      if(chosen != null) return;
      const iv = setInterval(() => {
        setTimeLeft(prev => {
          if(prev <= 1){ clearInterval(iv); handleTimeout(); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(iv);
    }, [chosen]);

    function finish(value, correct){
      const timeMs = nowMs() - startedAt.current;
      setTimeout(() => { try { onAnswer({ correct, timeMs, value }); } catch(_){} }, SHOW_FEEDBACK_MS);
    }
    function submit(value){
      if(chosen != null || answeredRef.current) return;
      answeredRef.current = true;
      setChosen(value);
      finish(value, sh.checkAnswer(q, value));
    }
    function handleTimeout(){
      if(chosen != null || answeredRef.current) return;
      answeredRef.current = true;
      setChosen(-1);
      finish(-1, false);
    }

    const showFeedback = chosen != null;
    const qType = (q && q.type) || 'single-choice';

    return React.createElement('div', { className: 'tn-fullscreen' },
      React.createElement('div', { className: 'tn-container' },
        sh.TnTopBar && React.createElement(sh.TnTopBar, { eyebrow: 'Каста · вопрос ' + (qOverall + 1) + ' / ' + totalOverall }),
        sh.TnGameProgress && React.createElement(sh.TnGameProgress, { qOverall, totalOverall }),
        sh.TnTimerBar && React.createElement(sh.TnTimerBar, { timeLeft, paused: showFeedback }),
        sh.TnQuestionCard && React.createElement(sh.TnQuestionCard, {
          qOverall, totalOverall, themeName: theme && theme.name,
          text: q && q.text, timeLeft, showFeedback, qType,
        }),
        qType === 'true-false' && React.createElement(sh.TnTrueFalse, {
          chosen, correctIdx: q.correct, showFeedback, onPick: submit,
        }),
        qType === 'fill-blank' && React.createElement(sh.TnFillBlank, {
          correct: q.correct, alternatives: q.alternatives, chosen, showFeedback, onSubmit: submit,
        }),
        qType === 'multi-choice' && React.createElement(sh.TnMultiChoice, {
          options: q.options, correctIdxs: q.correct, chosen, showFeedback, onSubmit: submit,
        }),
        qType === 'match-pair' && React.createElement(sh.TnMatchPair, {
          pairsLeft: q.pairsLeft, pairsRight: q.pairsRight, correct: q.correct, chosen, showFeedback, onSubmit: submit,
        }),
        (qType === 'single-choice' || !qType) && React.createElement(sh.TnOptions, {
          options: q.options, chosen, correctIdx: q.correct, showFeedback, onPick: submit,
        }),
        showFeedback && chosen === -1 && React.createElement('div', { className: 'tn-foot' },
          React.createElement('span', { className: 'tn-foot-timeout' }, '◷ Время вышло')
        )
      )
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // GroupScoreboard — живое табло (сортировка по очкам). meId подсвечен.
  // ───────────────────────────────────────────────────────────────────
  function GroupScoreboard({ players, meId, compact }){
    const sh = S();
    const ranked = rankPlayers(players);
    return React.createElement('div', { className: 'dp-group-board' + (compact ? ' dp-group-board--compact' : '') },
      ranked.map((p, i) => React.createElement('div', {
        key: p.deviceId,
        className: 'dp-group-board-row' + (p.deviceId === meId ? ' is-me' : '') + (isOnline(p) ? '' : ' is-off'),
      },
        React.createElement('span', { className: 'dp-group-board-rank' }, i + 1),
        React.createElement('span', { className: 'dp-group-board-av' }, (sh.renderTnAvatar ? sh.renderTnAvatar(p.avatar, p.nickname) : '◐')),
        React.createElement('span', { className: 'dp-group-board-name' },
          p.nickname || 'Игрок',
          p.finished && React.createElement('span', { className: 'dp-group-board-done', title: 'финишировал' }, ' ✓'),
          !isOnline(p) && React.createElement('span', { className: 'dp-group-board-off', title: 'отключился' }, ' ◌')
        ),
        React.createElement('span', { className: 'dp-group-board-score' }, (p.score || 0))
      ))
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // GroupResults — подиум + полный список. results из meta (или локально).
  // ───────────────────────────────────────────────────────────────────
  function GroupResults({ results, players, meId, onClose, onAgain, canAgain }){
    const sh = S();
    const list = (results && results.length) ? results : rankPlayers(players).map((p, i) => ({
      deviceId: p.deviceId, nickname: p.nickname, avatar: p.avatar, score: p.score || 0, correct: p.correct || 0, rank: i + 1,
    }));
    const medals = ['🥇', '🥈', '🥉'];
    const myRank = (list.find(r => r.deviceId === meId) || {}).rank;
    return React.createElement('div', { className: 'tn-fullscreen' },
      React.createElement('div', { className: 'tn-container', style: { maxWidth: 560, margin: '0 auto' } },
        React.createElement('header', { className: 'tn-final-head' },
          React.createElement('div', { className: 'tn-final-eyebrow tn-final-eyebrow-win' }, '✦  Итоги Касты'),
          React.createElement('h1', { className: 'tn-final-headline' },
            myRank === 1 ? 'Ты первый!' : (myRank ? ('Ты ' + myRank + '-й') : 'Партия завершена')
          )
        ),
        React.createElement('div', { className: 'dp-group-results' },
          list.map((r, i) => React.createElement('div', {
            key: r.deviceId,
            className: 'dp-group-results-row' + (r.deviceId === meId ? ' is-me' : '') + (i < 3 ? ' is-podium' : ''),
          },
            React.createElement('span', { className: 'dp-group-results-rank' }, i < 3 ? medals[i] : (i + 1)),
            React.createElement('span', { className: 'dp-group-board-av' }, (sh.renderTnAvatar ? sh.renderTnAvatar(r.avatar, r.nickname) : '◐')),
            React.createElement('span', { className: 'dp-group-results-name' }, r.nickname || 'Игрок'),
            React.createElement('span', { className: 'dp-group-results-score' }, (r.score || 0), ' ✦')
          ))
        ),
        React.createElement('div', { className: 'tn-final-actions', style: { display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' } },
          canAgain && React.createElement('button', { className: 'dp-btn dp-btn-cta', onClick: onAgain }, 'Сыграть ещё'),
          React.createElement('button', { className: 'dp-btn', onClick: onClose }, 'На главную')
        )
      )
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // GroupRoom — комната: фазы lobby → playing → finished по meta.status.
  // ───────────────────────────────────────────────────────────────────
  function GroupRoom({ code, deviceId, profile, onClose }){
    const sh = S();
    const rt = RT();
    const [players, setPlayers] = useState({});
    const [meta, setMeta] = useState(null);
    const [copyFallback, setCopyFallback] = useState('');

    // Игровое локальное состояние
    const [qIdx, setQIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [streak, setStreak] = useState(0);
    const [localPhase, setLocalPhase] = useState('lobby'); // lobby|playing|done
    const submittedResultRef = useRef(false);   // federated submitMatch один раз
    const judgedRef = useRef(false);            // хост пишет results один раз
    const finishTimerRef = useRef(null);

    const isHost = meta ? (meta.hostDeviceId === deviceId) : false;
    const status = meta ? meta.status : 'lobby';

    // ── Подписки: players + meta ──
    useEffect(() => {
      const offP = rt.watchPlayers(code, setPlayers);
      const offM = rt.watchMeta(code, m => setMeta(m || {}));
      return () => { try { offP(); } catch(_){} try { offM(); } catch(_){} };
    }, [code]);

    // ── Heartbeat + online ──
    useEffect(() => {
      const iv = setInterval(() => {
        try { rt.updatePlayer(code, deviceId, { lastSeen: nowMs() }); } catch(_){}
      }, HEARTBEAT_MS);
      return () => {
        clearInterval(iv);
        try { rt.updatePlayer(code, deviceId, { online: false }); } catch(_){}
      };
    }, [code, deviceId]);

    // ── Старт партии: как только в meta появился seed+playing — строим партию ──
    const partiya = useMemo(() => {
      if(!meta || !meta.seed || !window.YasnaTrivia) return null;
      try {
        return window.YasnaTrivia.generatePartiya(meta.seed, meta.partiyaMode || 'standard', meta.themes || null);
      } catch(_){ return null; }
    }, [meta && meta.seed, meta && meta.partiyaMode]);
    const flat = useMemo(() => flattenPartiya(partiya), [partiya]);
    const totalQ = flat.length;

    // Переход lobby→playing когда хост стартовал
    useEffect(() => {
      if(status === 'playing' && localPhase === 'lobby' && totalQ > 0){
        setLocalPhase('playing');
        setQIdx(0); setScore(0); setCorrectCount(0); setStreak(0);
        submittedResultRef.current = false;
      }
    }, [status, totalQ]);

    // ── Хост-судья: когда все онлайн доиграли или прошёл таймаут — пишем results ──
    useEffect(() => {
      if(!isHost || status !== 'playing' || judgedRef.current) return;
      const arr = Object.values(players || {});
      const online = arr.filter(isOnline);
      const anyFinished = arr.some(p => p.finished);
      const allOnlineFinished = online.length > 0 && online.every(p => p.finished);
      function writeResults(){
        if(judgedRef.current) return;
        judgedRef.current = true;
        const ranked = rankPlayers(players).map((p, i) => ({
          deviceId: p.deviceId, nickname: p.nickname || 'Игрок',
          avatar: typeof p.avatar === 'string' ? p.avatar : null,
          score: p.score || 0, correct: p.correct || 0, rank: i + 1,
        }));
        try { rt.updateGroupMeta(code, { status: 'finished', results: ranked, finishedAt: nowMs() }); } catch(_){}
      }
      if(allOnlineFinished){
        if(finishTimerRef.current){ clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
        writeResults();
      } else if(anyFinished && !finishTimerRef.current){
        finishTimerRef.current = setTimeout(writeResults, FINISH_WAIT_MS);
      }
    }, [isHost, status, players]);

    // ── Federated запись своего результата в storage/leaderboard (один раз) ──
    useEffect(() => {
      if(status !== 'finished' || submittedResultRef.current) return;
      submittedResultRef.current = true;
      const results = (meta && meta.results) || [];
      const mine = results.find(r => r.deviceId === deviceId);
      const myRank = mine ? mine.rank : null;
      const total = results.length || Object.keys(players).length;
      const matchId = 'group-' + code + '-' + (meta && meta.seed || '');
      try {
        window.YasnaDuelStorage && window.YasnaDuelStorage.recordMatch && window.YasnaDuelStorage.recordMatch({
          matchId, gameId: 'group', yasnaId: 'суток',
          result: myRank === 1 ? 'win' : 'loss',
          score: score, maxScore: totalQ * 15,
          time: 0, transport: 'group', isBot: false, bySurrender: false,
          themesPlayed: flat.map(f => f.theme && f.theme.id).filter(Boolean),
        });
      } catch(_){}
      try {
        window.YasnaLeaderboardClient && window.YasnaLeaderboardClient.submitMatch && window.YasnaLeaderboardClient.submitMatch({
          matchId, deviceId,
          nickname: profile && profile.nickname, avatar: (profile && typeof profile.avatar === 'string') ? profile.avatar : '·',
          gameId: 'group', yasnaId: 'суток',
          result: myRank === 1 ? 'win' : 'loss',
          score: score, maxScore: totalQ * 15, time: 0,
          transport: 'group', isBot: false, players: total, rank: myRank,
        }).catch(() => {});
      } catch(_){}
    }, [status]);

    // ── Действия ──
    function startGame(){
      if(!isHost) return;
      const onlineCount = Object.values(players).filter(isOnline).length;
      const minP = (meta && meta.minPlayers) || 3;
      if(onlineCount < minP) return;
      try { rt.updateGroupMeta(code, { seed: nowMs(), status: 'playing', startedAt: nowMs() }); } catch(_){}
    }
    function onAnswer(res){
      const newStreak = res.correct ? streak + 1 : 0;
      const gained = res.correct ? Math.round(sh.buseyForCorrect(res.timeMs) * sh.streakMultiplier(newStreak)) : 0;
      const newScore = score + gained;
      const newCorrect = correctCount + (res.correct ? 1 : 0);
      setStreak(newStreak); setScore(newScore); setCorrectCount(newCorrect);
      const isLast = qIdx + 1 >= totalQ;
      try {
        rt.updatePlayer(code, deviceId, {
          score: newScore, correct: newCorrect, streak: newStreak,
          finished: isLast, lastSeen: nowMs(),
        });
      } catch(_){}
      if(isLast){ setLocalPhase('done'); }
      else { setQIdx(qIdx + 1); }
    }
    function hostAgain(){
      if(!isHost) return;
      judgedRef.current = false;
      // сброс счёта всех — каждый сам обнулит при входе в playing; хост чистит results
      try { rt.updateGroupMeta(code, { status: 'lobby', seed: null, results: null, startedAt: null }); } catch(_){}
      try { rt.updatePlayer(code, deviceId, { score: 0, correct: 0, streak: 0, finished: false }); } catch(_){}
      setLocalPhase('lobby'); setQIdx(0); setScore(0); setCorrectCount(0); setStreak(0);
    }
    function copyLink(){
      const link = window.location.origin + window.location.pathname + '?kroom=' + encodeURIComponent(code);
      window.YasnaClipboard(link,
        () => { setCopyFallback(''); },
        () => { setCopyFallback(link); }
      );
    }

    // Когда хост обнулил партию (Сыграть ещё) — игроки тоже сбрасывают свой слот при возврате в lobby
    useEffect(() => {
      if(status === 'lobby' && localPhase === 'done'){
        setLocalPhase('lobby'); setQIdx(0); setScore(0); setCorrectCount(0); setStreak(0);
        try { rt.updatePlayer(code, deviceId, { score: 0, correct: 0, streak: 0, finished: false }); } catch(_){}
      }
    }, [status]);

    // ── РЕНДЕР ──
    // finished → подиум
    if(status === 'finished'){
      return React.createElement(GroupResults, {
        results: meta && meta.results, players, meId: deviceId,
        onClose, onAgain: hostAgain, canAgain: isHost,
      });
    }
    // playing → вопрос (или «ждём остальных» если доиграл)
    if(status === 'playing' && localPhase !== 'lobby'){
      if(localPhase === 'done' || qIdx >= totalQ){
        return React.createElement('div', { className: 'tn-fullscreen' },
          React.createElement('div', { className: 'tn-container', style: { maxWidth: 560, margin: '0 auto' } },
            React.createElement('div', { style: { textAlign: 'center', padding: '24px 0' } },
              React.createElement('div', { style: { fontSize: 30, marginBottom: 8 } }, '◷'),
              React.createElement('h2', { style: { fontSize: 18, fontWeight: 600 } }, 'Готово! Ждём остальных…'),
              React.createElement('p', { style: { color: '#86868b', fontSize: 13 } }, 'Твой счёт: ' + score + ' ✦')
            ),
            React.createElement(GroupScoreboard, { players, meId: deviceId })
          )
        );
      }
      const cur = flat[qIdx];
      const QEB = sh.QuestionErrorBoundary;
      const qEl = React.createElement(GroupQuestion, {
        key: (cur.q && cur.q.id) || qIdx,
        q: cur.q, theme: cur.theme, qOverall: qIdx, totalOverall: totalQ, onAnswer,
      });
      return React.createElement('div', { className: 'dp-group-play' },
        React.createElement(GroupScoreboard, { players, meId: deviceId, compact: true }),
        QEB ? React.createElement(QEB, { onSkip: () => onAnswer({ correct: false, timeMs: 15000, value: -1 }) }, qEl) : qEl
      );
    }

    // lobby (или ждём seed) → комната ожидания
    const onlinePlayers = Object.values(players).filter(isOnline);
    const minP = (meta && meta.minPlayers) || 3;
    const cap = (meta && meta.capacity) || 8;
    const canStart = isHost && onlinePlayers.length >= minP;
    return React.createElement('div', { className: 'dp-lobby-overlay', onClick: e => { if(e.target === e.currentTarget) onClose(); } },
      React.createElement('div', { className: 'dp-lobby', role: 'dialog', 'aria-modal': 'true' },
        React.createElement('button', { className: 'dp-lobby-x', onClick: onClose, 'aria-label': 'Закрыть' }, '×'),
        React.createElement('div', { className: 'dp-lobby-eyebrow' }, '✦  Каста · вдесятером веселее'),
        React.createElement('h2', null, 'Партия на компанию'),
        React.createElement('div', { className: 'dp-lobby-code-block' },
          React.createElement('div', { className: 'dp-lobby-code-label' }, 'Код комнаты'),
          React.createElement('div', { className: 'dp-lobby-code' }, code),
          React.createElement('div', { className: 'dp-lobby-code-hint' }, 'Разошли код или ссылку — пусть подключаются'),
          React.createElement('button', { className: 'dp-lobby-code-link', onClick: copyLink }, 'Скопировать ссылку'),
          copyFallback && React.createElement('div', { className: 'dp-lobby-code-fallback' },
            React.createElement('div', { className: 'dp-lobby-code-fallback-hint' }, 'Скопируй ссылку вручную:'),
            React.createElement('input', {
              className: 'dp-lobby-code-fallback-input', type: 'text', readOnly: true, value: copyFallback, autoFocus: true,
              onFocus: e => e.target.select(), onClick: e => e.target.select(),
            })
          )
        ),
        React.createElement('div', { className: 'dp-group-lobby-head' },
          React.createElement('span', { className: 'dp-group-lobby-count' }, onlinePlayers.length + ' / ' + cap),
          React.createElement('span', { className: 'dp-group-lobby-hint' }, 'игроков в комнате')
        ),
        React.createElement('div', { className: 'dp-group-lobby-list' },
          rankPlayers(players).map(p => React.createElement('div', {
            key: p.deviceId, className: 'dp-group-lobby-player' + (isOnline(p) ? '' : ' is-off'),
          },
            React.createElement('span', { className: 'dp-group-board-av' }, (sh.renderTnAvatar ? sh.renderTnAvatar(p.avatar, p.nickname) : '◐')),
            React.createElement('span', { className: 'dp-group-lobby-pname' },
              p.nickname || 'Игрок',
              p.role === 'host' && React.createElement('span', { className: 'dp-group-lobby-badge' }, ' хозяин')
            )
          ))
        ),
        isHost
          ? React.createElement(React.Fragment, null,
              React.createElement('button', {
                className: 'dp-btn dp-btn-cta', onClick: startGame, disabled: !canStart,
                style: { width: '100%', marginTop: 8 },
              }, canStart ? 'Начать партию →' : ('Нужно ещё ' + Math.max(0, minP - onlinePlayers.length) + ' (мин. ' + minP + ')')),
            )
          : React.createElement('div', { className: 'dp-lobby-status' },
              React.createElement('div', { className: 'dp-lobby-status-icon' }, '◷'),
              React.createElement('div', { className: 'dp-lobby-status-title' }, 'Ждём, пока хозяин начнёт…')
            )
      )
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // GroupApp — точка входа: choose (Создать/Войти) → create/join → room.
  // initialMode: 'join'|'create'|null ; initialCode: код для deep-link.
  // ───────────────────────────────────────────────────────────────────
  function GroupApp({ profile, initialMode, initialCode, onClose, onNeedNickname }){
    const me = profile;
    const [mode, setMode] = useState(initialMode || 'choose'); // choose|create|join|room|error
    const [code, setCode] = useState(initialCode || '');
    const [inputCode, setInputCode] = useState(initialCode || '');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    // конфиг создания
    const [cfgMode, setCfgMode] = useState('standard');
    const [cfgCap, setCfgCap] = useState(8);

    const rt = window.YasnaRT;

    function needNick(){
      if(me && me.deviceId && me.nickname) return false;
      if(onNeedNickname){ onNeedNickname(); }
      return true;
    }

    async function doCreate(){
      if(needNick()) return;
      setBusy(true); setError(null);
      try {
        const { code: c } = await rt.createGroupRoom({
          deviceId: me.deviceId, nickname: me.nickname, avatar: me.avatar || null,
          capacity: cfgCap, minPlayers: 3, partiyaMode: cfgMode, themes: null,
        });
        setCode(c); setMode('room');
      } catch(e){
        setError('Не удалось создать комнату: ' + (e && e.message)); setMode('error');
      } finally { setBusy(false); }
    }

    async function doJoin(codeOverride){
      const c = String(codeOverride || inputCode).trim().toUpperCase();
      if(!/^KASTA-[A-Z0-9]{4}$/.test(c)){ setError('Код должен быть в формате KASTA-XXXX'); return; }
      if(needNick()) return;
      setBusy(true); setError(null); setMode('join'); setInputCode(c);
      try {
        await rt.joinGroupRoom(c, { deviceId: me.deviceId, nickname: me.nickname, avatar: me.avatar || null });
        setCode(c); setMode('room');
      } catch(e){
        const m = e && e.message;
        if(m === 'not_found') setError('Комната не найдена. Проверь код.');
        else if(m === 'room_full') setError('Комната заполнена.');
        else if(m === 'already_started') setError('Партия уже идёт — попроси код на следующую.');
        else if(m === 'closed') setError('Комната закрыта.');
        else if(m === 'wrong_kind') setError('Это код обычной Партии, не Касты.');
        else setError('Ошибка входа: ' + m);
        setMode('error');
      } finally { setBusy(false); }
    }

    // deep-link: ?kroom=CODE → авто-join
    useEffect(() => {
      if(initialMode === 'join' && initialCode){
        setTimeout(() => doJoin(initialCode), 100);
      }
    }, []);

    if(mode === 'room' && code){
      return React.createElement(GroupRoom, { code, deviceId: me.deviceId, profile: me, onClose });
    }

    const overlay = (children) => React.createElement('div', {
      className: 'dp-lobby-overlay', onClick: e => { if(e.target === e.currentTarget) onClose(); },
    }, React.createElement('div', { className: 'dp-lobby', role: 'dialog', 'aria-modal': 'true' },
        React.createElement('button', { className: 'dp-lobby-x', onClick: onClose, 'aria-label': 'Закрыть' }, '×'),
        React.createElement('div', { className: 'dp-lobby-eyebrow' }, '✦  Каста · компанией'),
        React.createElement('h2', null, 'Партия на компанию'),
        children
      ));

    if(mode === 'choose'){
      return overlay(React.createElement(React.Fragment, null,
        React.createElement('p', { className: 'dp-lobby-sub' }, 'Собери компанию 3–8 человек по одной ссылке.'),
        React.createElement('div', { className: 'dp-lobby-options' },
          React.createElement('button', { className: 'dp-lobby-opt', onClick: () => setMode('create') },
            React.createElement('div', { className: 'dp-lobby-opt-icon' }, '◯'),
            React.createElement('div', { className: 'dp-lobby-opt-title' }, 'Создать'),
            React.createElement('div', { className: 'dp-lobby-opt-sub' }, 'Настроишь партию, позовёшь друзей.')
          ),
          React.createElement('button', { className: 'dp-lobby-opt', onClick: () => setMode('join') },
            React.createElement('div', { className: 'dp-lobby-opt-icon' }, '◐'),
            React.createElement('div', { className: 'dp-lobby-opt-title' }, 'Войти по коду'),
            React.createElement('div', { className: 'dp-lobby-opt-sub' }, 'Введи код, что прислал друг.')
          )
        ),
        error && React.createElement('div', { className: 'dp-lobby-error' }, error)
      ));
    }

    if(mode === 'create'){
      const modes = [
        { id: 'blitz', label: 'Блиц', count: 10 },
        { id: 'standard', label: 'Стандарт', count: 18 },
        { id: 'expert', label: 'Эксперт', count: 30 },
      ];
      return overlay(React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'dp-picker-section-eyebrow', style: { marginTop: 4 } }, '◷  Сколько вопросов'),
        React.createElement('div', { className: 'dp-mode-grid' },
          modes.map(m => React.createElement('button', {
            key: m.id, type: 'button',
            className: 'dp-mode-btn' + (cfgMode === m.id ? ' dp-mode-btn-active' : ''),
            onClick: () => setCfgMode(m.id),
          },
            React.createElement('div', { className: 'dp-mode-btn-count' }, m.count),
            React.createElement('div', { className: 'dp-mode-btn-label' }, m.label)
          ))
        ),
        React.createElement('div', { className: 'dp-picker-section-eyebrow', style: { marginTop: 14 } }, '☷  Сколько игроков (макс.)'),
        React.createElement('div', { className: 'dp-group-cap' },
          React.createElement('button', { type: 'button', className: 'dp-group-cap-btn', onClick: () => setCfgCap(Math.max(3, cfgCap - 1)) }, '−'),
          React.createElement('span', { className: 'dp-group-cap-val' }, cfgCap),
          React.createElement('button', { type: 'button', className: 'dp-group-cap-btn', onClick: () => setCfgCap(Math.min(8, cfgCap + 1)) }, '+')
        ),
        React.createElement('button', {
          className: 'dp-btn dp-btn-cta', onClick: doCreate, disabled: busy,
          style: { width: '100%', marginTop: 16 },
        }, busy ? 'Создаём…' : 'Создать комнату →'),
        error && React.createElement('div', { className: 'dp-lobby-error' }, error)
      ));
    }

    if(mode === 'join'){
      return overlay(React.createElement(React.Fragment, null,
        React.createElement('p', { className: 'dp-lobby-sub' }, busy ? ('Подключаюсь к ' + inputCode + '…') : 'Введи код от хозяина'),
        !busy && React.createElement('input', {
          className: 'dp-lobby-input', placeholder: 'KASTA-XXXX', value: inputCode, maxLength: 10, autoFocus: true,
          onChange: e => setInputCode(e.target.value),
          onKeyDown: e => { if(e.key === 'Enter') doJoin(); },
        }),
        !busy && React.createElement('button', {
          className: 'dp-btn dp-btn-cta', onClick: () => doJoin(), disabled: !inputCode.trim(), style: { width: '100%' },
        }, 'Войти →'),
        error && React.createElement('div', { className: 'dp-lobby-error' }, error)
      ));
    }

    // error
    return overlay(React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'dp-lobby-status' },
        React.createElement('div', { className: 'dp-lobby-status-icon', style: { color: 'var(--danger)' } }, '○'),
        React.createElement('div', { className: 'dp-lobby-status-title' }, 'Не получилось'),
        React.createElement('div', { className: 'dp-lobby-status-sub' }, error || 'Попробуй ещё раз')
      ),
      React.createElement('button', { className: 'dp-btn', onClick: () => { setError(null); setMode('choose'); }, style: { width: '100%' } }, 'Назад')
    ));
  }

  window.YasnaGroup = { GroupApp };
})();
