// ═══════════════════════════════════════════════════════════════════
// Касталия Ясны · главная страница (v5 · Apple × Гессе)
//
// Структура:
//   Header → Касталия headline → Welcome (новые) или Hero (вернувшиеся)
//   → Главный ритуал (2 игры × 2 режима)
//   → Этюды дня → Партитура → Хроника + Знаки Магистра → Журнал → Footer
//
// Real-time PvP реализован через PeerJS, см. RealTimeLobby.
// ═══════════════════════════════════════════════════════════════════
(function(){
  const { useState, useEffect, useRef, useMemo } = React;
  const _g = (n) => window[n];

  // ─── Error Boundary ─────────────────────────────────────────────────
  class DPErrorBoundary extends React.Component {
    constructor(p){ super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err){ return { err }; }
    componentDidCatch(err, info){ try{ console.error('[Касталия]', err, info); }catch(_){} }
    render(){
      if(this.state.err){
        return React.createElement('div', {
          style: { padding: '60px 24px', maxWidth: 480, margin: '60px auto', textAlign: 'center', fontFamily: 'inherit' }
        },
          React.createElement('div', { style: { fontSize: 32, marginBottom: 16, fontFamily: 'ui-serif, Georgia, serif' } }, '☷'),
          React.createElement('h2', { style: { fontSize: 22, marginBottom: 12, fontFamily: 'ui-serif, Georgia, serif', fontWeight: 500 } }, 'Что-то ускользнуло'),
          React.createElement('p', { style: { fontSize: 14, color: '#5f5d57', lineHeight: 1.6, marginBottom: 24 } },
            'Страница не смогла отрисоваться. Попробуй перезагрузить или вернись к Ясне.'
          ),
          React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' } },
            React.createElement('button', {
              onClick: () => window.location.reload(),
              className: 'dp-btn'
            }, 'Перезагрузить'),
            React.createElement('a', {
              href: 'index.html',
              className: 'dp-btn dp-btn-primary',
              style: { textDecoration: 'none' }
            }, 'К Ясне')
          ),
          this.state.err && React.createElement('details', { style: { marginTop: 32, fontSize: 11, color: '#6e6e73', textAlign: 'left' } },
            React.createElement('summary', null, 'Подробности'),
            React.createElement('pre', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8, fontSize: 10 } },
              String(this.state.err.stack || this.state.err.message || this.state.err)
            )
          )
        );
      }
      return this.props.children;
    }
  }

  // ─── Inline SVG icons ─────────────────────────────────────────────
  const Icon = (path) => () => React.createElement('svg', {
    className: 'dp-icon',
    width: 14, height: 14, viewBox: '0 0 16 16',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
    strokeLinecap: 'round', strokeLinejoin: 'round'
  }, React.createElement('path', { d: path }));

  const IconCalendar = Icon('M3 5h10v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Zm0 0V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1M5 2v3M11 2v3M3 8h10');
  const IconGrid     = Icon('M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z');
  const IconScroll   = Icon('M3 4h10M3 8h10M3 12h10');
  const IconStar     = Icon('M8 2.5l1.7 3.5 3.8.5-2.7 2.7.7 3.8L8 11.2 4.5 13l.7-3.8L2.5 6.5l3.8-.5L8 2.5Z');
  const IconJournal  = Icon('M3 3h10v10H3zM3 6h10M6 3v10');

  // ─── Term tooltip ─────────────────────────────────────────────────
  const Term = (label, tip) => React.createElement('span', {
    className: 'dp-term', tabIndex: 0, 'data-tip': tip
  }, label);

  // ─── Аватары ──────────────────────────────────────────────────────
  function avatarInitials(name){
    if(!name) return '·';
    const t = String(name).trim();
    if(!t) return '·';
    return t.slice(0, 1).toUpperCase();
  }
  function renderAvatar(av, name){
    if(typeof av === 'string' && av.startsWith('http')){
      return React.createElement('img', { src: av, alt: '' });
    }
    if(typeof av === 'string' && av.length > 0 && av.length <= 4){
      return av;
    }
    return avatarInitials(name);
  }

  // ─── Прогрессия (Орден Касталии) ──────────────────────────────────
  const STUPENI = [
    { name: 'Послушник', from: 0,      to: 1000 },
    { name: 'Студент',   from: 1000,   to: 3000 },
    { name: 'Игрок',     from: 3000,   to: 10000 },
    { name: 'Мастер',    from: 10000,  to: 30000 },
    { name: 'Магистр',   from: 30000,  to: Infinity },
  ];
  function getStupen(busey){
    const s = STUPENI.find(s => busey < s.to);
    if(!s) return STUPENI[STUPENI.length - 1];
    const inLevel = busey - s.from;
    const total = s.to - s.from;
    const subLevel = total === Infinity ? 1 : Math.min(9, Math.floor(inLevel / total * 10));
    return { ...s, subLevel: subLevel + 1, busey, toNext: s.to - busey };
  }
  function totalBusey(){
    const s = _g('YasnaDuelStorage')?.getOverallStats?.();
    if(!s) return 0;
    return s.totals?.score || (s.totals?.wins || 0) * 50 + (s.totals?.losses || 0) * 5;
  }
  function toRoman(n){
    const r = ['','I','II','III','IV','V','VI','VII','VIII','IX','X'];
    return r[n] || (n + '');
  }

  // ═══════════════════════════════════════════════════════════════════
  // КОМПОНЕНТЫ
  // ═══════════════════════════════════════════════════════════════════

  // ─── Header ──────────────────────────────────────────────────────
  function DPHeader({ user, onLoginClick, onLogout }){
    const [helpOpen, setHelpOpen] = useState(false);
    const helpRef = useRef(null);
    useEffect(() => {
      const onDoc = (e) => {
        if(helpRef.current && !helpRef.current.contains(e.target)) setHelpOpen(false);
      };
      if(helpOpen) document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, [helpOpen]);

    const onAnchorClick = (id) => (e) => {
      e.preventDefault();
      const el = document.getElementById(id);
      if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return React.createElement('header', { className: 'dp-header' },
      React.createElement('a', { href: 'index.html', className: 'dp-header-back', title: 'К Ясне', 'aria-label': 'Вернуться к Ясне' },
        React.createElement('span', { className: 'dp-header-back-arrow', 'aria-hidden': 'true' }, '←'),
        React.createElement('span', null, 'Ясна')
      ),
      React.createElement('div', { className: 'dp-header-spacer' }),
      React.createElement('nav', { className: 'dp-header-nav' },
        React.createElement('a', { href: '#hronika', onClick: onAnchorClick('hronika') }, 'Хроника'),
        React.createElement('a', { href: '#zhurnal', onClick: onAnchorClick('zhurnal') }, 'Журнал'),
        React.createElement('a', { href: '#znaki', onClick: onAnchorClick('znaki') }, 'Знаки'),
        React.createElement('div', { className: 'dp-header-auth', ref: helpRef, style: { position: 'relative' } },
          React.createElement('button', {
            className: 'dp-help-btn',
            onClick: () => setHelpOpen(v => !v),
            'aria-label': 'Что это за страница?',
            'aria-expanded': helpOpen
          }, '?'),
          helpOpen && React.createElement('div', { className: 'dp-help-popover' },
            React.createElement('h4', null, 'Касталия Ясны'),
            React.createElement('div', null, 'Тихое место, где играют в бисер. Партия — восемнадцать вопросов из шести случайных тем. Соперник — Тень или живой собеседник.'),
            React.createElement('ul', null,
              React.createElement('li', null, React.createElement('strong', null, 'Бусины ✦'), ' — твои очки. За верный ответ + бонус скорости.'),
              React.createElement('li', null, React.createElement('strong', null, 'Ступень'), ' — от Послушника до Магистра.'),
              React.createElement('li', null, React.createElement('strong', null, 'Партитура'), ' — карта девяти тем мира.'),
              React.createElement('li', null, React.createElement('strong', null, 'Хроника'), ' — летопись Магистров недели.')
            )
          ),
          user
            ? React.createElement('button', { className: 'dp-btn-text', onClick: onLogout, style: { marginLeft: 6 } }, 'Выйти')
            : React.createElement('button', {
                className: 'dp-btn dp-btn-primary',
                onClick: onLoginClick,
                style: { padding: '8px 16px', fontSize: 13, marginLeft: 6 }
              }, 'Войти')
        )
      )
    );
  }

  // ─── Касталия headline ───────────────────────────────────────────
  function DPCastaliaTitle(){
    return React.createElement('div', { className: 'dp-castalia-title' },
      React.createElement('div', { className: 'dp-castalia-eyebrow' }, '✦  Касталия Ясны'),
      React.createElement('h1', { className: 'dp-castalia-h1' },
        React.createElement('span', null, 'Игра в бисер,'),
        React.createElement('br'),
        React.createElement('span', null, 'по-русски.')
      )
    );
  }

  // ─── Welcome (первый визит) ──────────────────────────────────────
  function DPWelcome({ onLoginClick, onAnonStart }){
    return React.createElement('section', { className: 'dp-welcome', role: 'region', 'aria-label': 'Приветствие' },
      React.createElement('div', { className: 'dp-welcome-eyebrow' }, '✦  Касталия Ясны'),
      React.createElement('h1', { className: 'dp-welcome-title' }, 'Игра в бисер,', React.createElement('br'), 'по-русски.'),
      React.createElement('p', { className: 'dp-welcome-sub' },
        'Партия из восемнадцати вопросов. Шесть тем мира. Соперник — Тень или живой собеседник. Тренируй память, собирай бусины, поднимайся по ступеням Ордена.'
      ),
      React.createElement('div', { className: 'dp-welcome-actions' },
        React.createElement('button', { className: 'dp-btn dp-btn-cta', onClick: onLoginClick }, 'Войти через Telegram'),
        React.createElement('button', { className: 'dp-btn dp-btn-ghost', onClick: onAnonStart }, 'Сыграть гостем')
      ),
      React.createElement('div', { className: 'dp-welcome-pillars' },
        React.createElement('div', { className: 'dp-welcome-pillar' },
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, '◷  Партия'),
          React.createElement('div', { className: 'dp-welcome-pillar-text' }, 'Восемнадцать вопросов · шесть тем · пять минут')
        ),
        React.createElement('div', { className: 'dp-welcome-pillar' },
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, '◐  Тень'),
          React.createElement('div', { className: 'dp-welcome-pillar-text' }, 'Бот трёх ликов: Послушник, Игрок, Магистр')
        ),
        React.createElement('div', { className: 'dp-welcome-pillar' },
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, '✦  Бусины'),
          React.createElement('div', { className: 'dp-welcome-pillar-text' }, 'Очки игры. Хроника недели — топ Магистров')
        )
      )
    );
  }

  // ─── Profile-Hero (упрощённый — 4 блока) ─────────────────────────
  function DPProfileHero({ user, profile, onLoginClick }){
    const me = user || profile;
    const isGuest = !user;
    const busey = totalBusey();
    const stupen = getStupen(busey);
    const pct = stupen.to === Infinity ? 100 :
      Math.min(100, ((busey - stupen.from) / (stupen.to - stupen.from)) * 100);
    const Storage = _g('YasnaDuelStorage');
    const data = Storage?.getOverallStats?.() || {};
    const games = data.totals?.matches || data.totals?.played || 0;

    const avatarContent = (typeof me.avatar === 'string' && me.avatar.startsWith('http'))
      ? React.createElement('img', { src: me.avatar, alt: '' })
      : (typeof me.avatar === 'string' && me.avatar.length > 0 && me.avatar.length <= 4)
        ? me.avatar
        : avatarInitials(me.nickname);

    const nextStupenLabel = (() => {
      if(stupen.to === Infinity) return 'высшая ступень';
      const curIdx = STUPENI.findIndex(x => x.name === stupen.name);
      const next = STUPENI[curIdx + 1];
      return next ? ('до ' + next.name + ' · ' + stupen.toNext + ' ✦') : '';
    })();

    return React.createElement('section', { className: 'dp-hero', role: 'region', 'aria-label': 'Профиль игрока' },
      React.createElement('div', { className: 'dp-hero-avatar' }, avatarContent),
      React.createElement('div', { className: 'dp-hero-body' },
        React.createElement('div', { className: 'dp-hero-name-row' },
          React.createElement('span', { className: 'dp-hero-name' }, me.nickname),
          React.createElement('span', { className: 'dp-hero-rank-pill' }, stupen.name, ' ', toRoman(stupen.subLevel))
        ),
        React.createElement('div', { className: 'dp-hero-stats' },
          React.createElement('span', { className: 'dp-hero-bead' }, '✦ ', busey),
          React.createElement('span', { className: 'dp-hero-stats-sep' }, '·'),
          React.createElement('span', null, games, ' ', Term('партий', 'Партия — игровая сессия из восемнадцати вопросов по шести темам.'))
        ),
        React.createElement('div', { className: 'dp-hero-progress', 'aria-label': 'Прогресс ступени' },
          React.createElement('div', { className: 'dp-hero-progress-fill', style: { width: pct + '%' } })
        ),
        nextStupenLabel && React.createElement('div', { style: { fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontVariantNumeric: 'tabular-nums' } }, nextStupenLabel)
      ),
      isGuest && React.createElement('button', { className: 'dp-hero-cta', onClick: onLoginClick, title: 'Войди — попадёшь в Хронику' }, 'Войти →')
    );
  }

  // ─── Главный ритуал · 2 игры ─────────────────────────────────────
  function DPMainGames({ onPartiya, onUzor }){
    return React.createElement('section', { className: 'dp-section', role: 'region', 'aria-label': 'Главный ритуал' },
      React.createElement('div', { style: { marginBottom: 'var(--space-5)' } },
        React.createElement('div', { className: 'dp-eyebrow' }, 'Главный ритуал'),
        React.createElement('h2', { className: 'dp-section-h', style: { fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.005em' } },
          'Партия и Узор'
        ),
        React.createElement('p', { className: 'dp-section-desc', style: { marginTop: 6 } },
          'Две игры мира Касталии. ',
          React.createElement('strong', { style: { color: 'var(--text-1)', fontWeight: 500 } }, 'Партия'), ' — длинная, размышление. ',
          React.createElement('strong', { style: { color: 'var(--text-1)', fontWeight: 500 } }, 'Узор'), ' — короткая, схватывание.'
        )
      ),
      React.createElement('div', { className: 'dp-games-grid' },
        React.createElement('button', { className: 'dp-game-card dp-game-primary', onClick: onPartiya },
          React.createElement('div', { className: 'dp-game-eyebrow' }, 'Партия · ≈5 минут'),
          React.createElement('div', { className: 'dp-game-title' }, 'Партия'),
          React.createElement('div', { className: 'dp-game-sub' }, 'Шесть тем, восемнадцать вопросов. Соперник — Тень трёх ликов или живой собеседник.'),
          React.createElement('div', { className: 'dp-game-meta' },
            React.createElement('span', null, 'с Тенью'),
            React.createElement('span', null, '·'),
            React.createElement('span', { className: 'dp-game-meta-pvp' }, 'вдвоём ✦')
          )
        ),
        React.createElement('button', { className: 'dp-game-card', onClick: onUzor },
          React.createElement('div', { className: 'dp-game-eyebrow' }, 'Узор · ≈90 секунд'),
          React.createElement('div', { className: 'dp-game-title' }, 'Узор'),
          React.createElement('div', { className: 'dp-game-sub' }, 'Расставить двенадцать элементов по полочкам Ясны быстрее соперника. Только живой соперник.'),
          React.createElement('div', { className: 'dp-game-meta' },
            React.createElement('span', { className: 'dp-game-meta-pvp' }, 'только вдвоём ✦')
          )
        )
      )
    );
  }

  // ─── Сегодня · этюды дня ─────────────────────────────────────────
  function DPQuestsRow({ onEtude }){
    const Daily = _g('YasnaDailyChallenge');
    const today = Daily?.today?.();
    const themes = window.YasnaTrivia?.THEMES || [];
    const themeIdx = today ? parseInt(today.date.replace(/-/g, ''), 10) % Math.max(1, themes.length) : 0;
    const todayTheme = themes[themeIdx];
    const data = Daily?.load?.() || {};
    const todayPlayed = today && data.byDate?.[today.date];

    const quests = [
      {
        id: 'etude',
        tag: 'Этюд',
        title: 'Один шанс в день',
        foot: todayPlayed ? 'Сыграно: ' + todayPlayed.score + ' ✦' : '+30 ✦ · повторить нельзя',
        footMute: !!todayPlayed,
        ready: true
      },
      {
        id: 'gimn',
        tag: 'Гимн',
        title: 'Тема: ' + (todayTheme?.name || 'дня'),
        foot: 'готовится',
        footMute: true,
        ready: false
      },
    ];

    return React.createElement('section', { className: 'dp-section' },
      React.createElement('div', { className: 'dp-section-h-row' },
        React.createElement('h2', { className: 'dp-section-h' }, IconCalendar(), ' Сегодня'),
        React.createElement('span', { className: 'dp-section-h-sub' }, quests.filter(q => q.ready).length + ' готов · ' + (quests.length - quests.filter(q => q.ready).length) + ' в подготовке')
      ),
      React.createElement('p', { className: 'dp-section-desc' },
        'Короткие практики. Каждая — короче полной Партии.'
      ),
      React.createElement('div', { className: 'dp-quests' },
        quests.map(q =>
          React.createElement('button', {
            key: q.id,
            className: 'dp-quest' + (q.ready ? '' : ' dp-quest-locked'),
            onClick: q.ready ? onEtude : undefined,
            disabled: !q.ready,
            'aria-disabled': !q.ready,
            title: q.ready ? '' : 'Этот формат скоро появится'
          },
            React.createElement('div', { className: 'dp-quest-tag' }, q.tag),
            React.createElement('div', { className: 'dp-quest-title' }, q.title),
            React.createElement('div', {
              className: 'dp-quest-foot' + (q.footMute ? ' dp-quest-foot-mute' : '')
            }, q.foot)
          )
        )
      )
    );
  }

  // ─── Партитура (карта тем с прогрессом) ──────────────────────────
  function DPPartitura(){
    const themes = window.YasnaTrivia?.THEMES || [];
    if(themes.length === 0) return null;
    const Storage = _g('YasnaDuelStorage');
    const data = Storage?.getOverallStats?.() || {};
    const masteryByTheme = data.masteryByTheme || {};
    const opened = themes.filter(t => (masteryByTheme[t.id] || 0) > 0).length;

    // Текущая тема — та, что максимально освоена но < 100, либо первая открытая.
    const sortedByMastery = themes.map(t => ({ ...t, pct: masteryByTheme[t.id] || 0 })).sort((a, b) => b.pct - a.pct);
    const currentTheme = sortedByMastery.find(t => t.pct > 0 && t.pct < 100) || sortedByMastery[0];

    return React.createElement('section', { className: 'dp-section', role: 'region', 'aria-label': 'Партитура — карта тем' },
      React.createElement('div', { className: 'dp-section-h-row' },
        React.createElement('h2', { className: 'dp-section-h' }, IconGrid(), ' Партитура'),
        React.createElement('span', { className: 'dp-section-h-sub' }, 'Освоено ', opened, ' из ', themes.length)
      ),
      React.createElement('p', { className: 'dp-section-desc' },
        'Девять тем мира «Сутки». Темы открываются по мере того, как они выпадают в Партии.'
      ),
      React.createElement('div', { className: 'dp-partitura' },
        themes.map(t => {
          const pct = masteryByTheme[t.id] || 0;
          const isLocked = pct === 0;
          const isCurrent = currentTheme && currentTheme.id === t.id && pct > 0;
          return React.createElement('div', {
            key: t.id,
            className: 'dp-theme' + (isLocked ? ' dp-theme-locked' : '') + (isCurrent ? ' dp-theme-current' : '')
          },
            React.createElement('div', { className: 'dp-theme-name' },
              React.createElement('span', null, t.name),
              isCurrent
                ? React.createElement('span', { className: 'dp-theme-current-badge' }, 'сейчас')
                : isLocked && React.createElement('span', { className: 'dp-theme-locked-icon' }, '🔒')
            ),
            !isLocked && React.createElement('div', { className: 'dp-theme-bar' },
              React.createElement('div', { className: 'dp-theme-bar-fill', style: { width: pct + '%' } })
            ),
            React.createElement('div', { className: 'dp-theme-meta' },
              React.createElement('span', null, isLocked ? 'не открыто' : pct + '%')
            )
          );
        })
      )
    );
  }

  // ─── Хроника (бывш. лидерборд) ──────────────────────────────────
  function DPHronika({ user }){
    const [items, setItems] = useState(null);
    useEffect(() => {
      const LB = _g('YasnaLeaderboardClient');
      if(!LB?.isEnabled?.()){ setItems([]); return; }
      LB.fetchLeaderboard({ gameId: 'turnir', yasnaId: 'суток', period: 'week', limit: 8 })
        .then(res => setItems(res?.items || []))
        .catch(() => setItems([]));
    }, []);

    const myDeviceId = user?.deviceId || _g('YasnaDuelProfile')?.load?.()?.deviceId;
    const myInTop = items && myDeviceId && items.find(r => r.deviceId === myDeviceId);
    const myRank = myInTop ? items.findIndex(r => r.deviceId === myDeviceId) + 1 : null;

    return React.createElement('div', { className: 'dp-card', id: 'hronika' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, IconScroll(), ' ',
          Term('Хроника недели', 'Хроника — летопись Магистров недели по бусинам. Обнуляется в субботу 23:59.')
        ),
        React.createElement('span', { className: 'dp-card-meta' }, 'Сб 23:59')
      ),
      items === null
        ? React.createElement('div', { className: 'dp-card-empty' }, 'Касталия открывает врата…')
        : items.length === 0
          ? React.createElement('div', { className: 'dp-card-empty' }, 'Хроника ждёт первой записи.', React.createElement('br'), 'Сыграй Партию.')
          : React.createElement(React.Fragment, null,
              React.createElement('table', { className: 'dp-table' },
                React.createElement('thead', null,
                  React.createElement('tr', null,
                    React.createElement('th', { className: 'dp-th-rank' }, '#'),
                    React.createElement('th', null, 'Игрок'),
                    React.createElement('th', { className: 'dp-th-num dp-th-games' }, 'Партий'),
                    React.createElement('th', { className: 'dp-th-num' }, 'Бусины')
                  )
                ),
                React.createElement('tbody', null,
                  items.slice(0, 5).map((row, idx) => {
                    const isMe = myDeviceId && row.deviceId === myDeviceId;
                    const rankCls = idx === 0 ? 'dp-td-rank-1' : idx === 1 ? 'dp-td-rank-2' : idx === 2 ? 'dp-td-rank-3' : '';
                    return React.createElement('tr', {
                      key: row.deviceId || idx,
                      className: isMe ? 'dp-tr-me' : ''
                    },
                      React.createElement('td', { className: 'dp-td-rank ' + rankCls }, idx + 1),
                      React.createElement('td', { className: 'dp-td-name' }, row.nickname || 'Игрок'),
                      React.createElement('td', { className: 'dp-td-num dp-td-games' }, row.matches || row.games || '—'),
                      React.createElement('td', { className: 'dp-td-num-strong' }, row.score != null ? '✦ ' + row.score : '—')
                    );
                  })
                )
              ),
              React.createElement('div', { className: 'dp-table-foot' },
                React.createElement('span', null,
                  myInTop ? 'Ты на ' + myRank + '-й позиции'
                          : (myDeviceId ? 'Ты пока вне топ-5' : 'Сыграй, чтобы попасть в Хронику')
                ),
                myDeviceId && !myInTop && React.createElement('a', { href: '#', style: { color: 'var(--info)', textDecoration: 'none' }, onClick: e => e.preventDefault() }, 'все →')
              )
            )
    );
  }

  // ─── Знаки Магистра ──────────────────────────────────────────────
  function DPZnaki(){
    const Ach = _g('YasnaDuelAchievements');
    if(!Ach?.list || !Ach?.getUnlocked) return React.createElement('div', { className: 'dp-card', id: 'znaki' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, IconStar(), ' Знаки Магистра'),
        React.createElement('span', { className: 'dp-card-meta' }, '0 / 0')
      ),
      React.createElement('div', { className: 'dp-card-empty' }, 'Касталия открывает врата…')
    );
    const all = Ach.list();
    const unlocked = Ach.getUnlocked() || [];
    const items = all.slice(0, 8).map(a => ({
      a, got: unlocked.includes(a.id)
    }));
    const lastUnlocked = all.filter(a => unlocked.includes(a.id)).slice(-1)[0];

    return React.createElement('div', { className: 'dp-card', id: 'znaki' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, IconStar(), ' ',
          Term('Знаки Магистра', 'Знаки — церемониальные титулы. Открываются за упорство, серии и победы.')
        ),
        React.createElement('span', { className: 'dp-card-meta' }, unlocked.length, ' / ', all.length)
      ),
      React.createElement('div', { className: 'dp-znaki-grid' },
        items.map(({ a, got }, i) =>
          React.createElement('div', {
            key: a.id,
            className: 'dp-znak' + (got ? ' dp-znak-on' : ''),
            title: got ? a.title : 'Не открыто',
            'aria-label': got ? 'Знак: ' + a.title : 'Знак не открыт'
          }, got ? toRoman(i + 1) : '·')
        )
      ),
      React.createElement('div', { className: 'dp-znaki-foot' },
        unlocked.length === 0
          ? 'Знак ждёт первой Партии.'
          : (lastUnlocked
              ? React.createElement(React.Fragment, null, React.createElement('strong', null, 'Последний:'), ' ', lastUnlocked.title)
              : 'Сыграй первую партию')
      )
    );
  }

  // ─── Журнал Партий ───────────────────────────────────────────────
  function DPJournal(){
    const Storage = _g('YasnaDuelStorage');
    const matches = Storage?.getMatchHistory?.(5) || [];

    function fmtWhen(date){
      const now = Date.now();
      const diff = now - date;
      const dayMs = 86400000;
      if(diff < dayMs && new Date(now).getDate() === new Date(date).getDate()) return 'сегодня';
      if(diff < dayMs * 2) return 'вчера';
      const daysAgo = Math.floor(diff / dayMs);
      if(daysAgo < 7) return daysAgo + ' дн назад';
      const d = new Date(date);
      return d.getDate() + '.' + (d.getMonth() + 1).toString().padStart(2, '0');
    }

    function fmtMatchName(m){
      if(m.gameId === 'turnir') {
        const lvl = m.botLevel || 'Тень';
        const tNames = { easy: 'Тенью Послушника', medium: 'Тенью Игрока', hard: 'Тенью Магистра' };
        return 'Партия с ' + (tNames[lvl] || (m.opponentName || 'Тенью'));
      }
      if(m.gameId?.startsWith('race-')) return 'Race ' + m.gameId.replace('race-', '');
      if(m.gameId === 'mirror-fill') return 'Узор';
      return m.gameId || 'Игра';
    }

    return React.createElement('div', { className: 'dp-card', id: 'zhurnal' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, IconJournal(), ' ', Term('Журнал', 'Журнал — твоя личная летопись последних партий.')),
        React.createElement('span', { className: 'dp-card-meta' }, matches.length > 0 ? matches.length + ' последних' : '')
      ),
      matches.length === 0
        ? React.createElement('div', { className: 'dp-card-empty' }, 'Партий ещё не было.', React.createElement('br'), 'Начни — здесь появится первая запись.')
        : React.createElement(React.Fragment, null,
            matches.map((m, i) =>
              React.createElement('div', { key: m.id || i, className: 'dp-journal-row' },
                React.createElement('span', { className: 'dp-journal-when' }, fmtWhen(m.date)),
                React.createElement('span', { className: 'dp-journal-name' }, fmtMatchName(m)),
                React.createElement('span', {
                  className: 'dp-journal-result ' + (m.result === 'win' ? 'dp-journal-win' : 'dp-journal-loss')
                }, m.result === 'win' ? '+ ' : '', m.score != null ? m.score + ' ✦' : '—')
              )
            )
          )
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // REAL-TIME LOBBY · PvP через PeerJS + TURN
  //
  // Архитектура:
  // - Public PeerJS broker (peerjs.com/peer) — даёт signaling
  // - STUN-серверы Google (для NAT-discovery)
  // - TURN от Open Relay Project (free, без регистрации) — relay когда STUN не помогает
  //
  // Без TURN ~30-50% соединений не проходят (симметричный NAT, corporate WiFi).
  // С Open Relay TURN — ~95%.
  // ═══════════════════════════════════════════════════════════════════

  // ICE servers — stun + turn
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Open Relay Project — бесплатный публичный TURN (https://www.metered.ca/tools/openrelay/)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
  ];

  const PEER_OPTIONS = {
    debug: 2,
    config: { iceServers: ICE_SERVERS },
  };

  const CONNECT_TIMEOUT_MS = 30000;

  function genRoomCode(){
    const c = 'BCDFGHJKLMNPQRSTVWXZ23456789';
    let suffix = '';
    for(let i = 0; i < 4; i++) suffix += c[Math.floor(Math.random() * c.length)];
    return 'KASTA-' + suffix;
  }
  function peerIdFromCode(code){
    // 'KASTA-XWQ6' → 'yasna-kasta-xwq6'
    // префикс 'yasna-' чтобы не пересекаться с другими PeerJS-приложениями
    return 'yasna-' + code.toLowerCase();
  }

  function DPLobby({ onClose, profile, onConnected, initialMode, initialCode }){
    const [mode, setMode] = useState(initialMode || 'choose'); // choose | host | guest | waiting | error
    const [roomCode, setRoomCode] = useState('');
    const [inputCode, setInputCode] = useState(initialCode || '');
    const [error, setError] = useState(null);
    const [statusText, setStatusText] = useState('Жду собеседника…');
    const transportRef = useRef(null);
    const timeoutRef = useRef(null);

    function cleanup(){
      if(timeoutRef.current){ clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      try { transportRef.current?.close?.(); } catch(_){}
      transportRef.current = null;
    }
    useEffect(() => () => cleanup(), []);

    // Авто-старт guest-mode если код пришёл из URL
    useEffect(() => {
      if(initialMode === 'guest' && initialCode){
        // дать React mount, потом jstart
        setTimeout(() => startGuest(initialCode), 100);
      }
    }, []);

    function startHost(){
      if(!window.Peer){ setError('Сервис подключения недоступен. Проверь интернет.'); return; }
      const code = genRoomCode();
      setRoomCode(code);
      setMode('host');
      setStatusText('Создаю комнату…');
      setError(null);
      console.log('[lobby/host] starting, code=' + code);

      try {
        const peerId = peerIdFromCode(code);
        const peer = new window.Peer(peerId, PEER_OPTIONS);

        // Timeout: если за CONNECT_TIMEOUT_MS никто не подключился — error
        // (только timeout на первичное peer.open и connection)
        let openCalled = false;
        timeoutRef.current = setTimeout(() => {
          if(!openCalled){
            console.error('[lobby/host] timeout creating peer');
            setError('Не удалось создать комнату за 30с. Проверь интернет или попробуй позже.');
            setMode('error');
            try { peer.destroy(); } catch(_){}
          }
        }, CONNECT_TIMEOUT_MS);

        peer.on('open', (id) => {
          openCalled = true;
          if(timeoutRef.current){ clearTimeout(timeoutRef.current); timeoutRef.current = null; }
          console.log('[lobby/host] peer open, id=' + id);
          setStatusText('Жду собеседника…');
        });

        peer.on('connection', (conn) => {
          console.log('[lobby/host] connection request from ' + conn.peer);
          let connOpened = false;
          // Timeout для самого conn.open — если NAT/firewall
          const connTimer = setTimeout(() => {
            if(!connOpened){
              console.error('[lobby/host] conn open timeout (NAT issue?)');
              setError('Не удалось установить P2P-соединение (возможно, NAT/firewall). Попробуй другой Wi-Fi.');
              setMode('error');
              try { conn.close(); } catch(_){}
            }
          }, 20000);

          conn.on('open', () => {
            connOpened = true;
            clearTimeout(connTimer);
            console.log('[lobby/host] conn opened, going to game');
            transportRef.current = { peer, conn, role: 'host', close: () => { try{conn.close()}catch(_){}; try{peer.destroy()}catch(_){} } };
            const transport = makeTransport(conn, 'host');
            onConnected({
              transport, role: 'host', roomCode: code,
              opponent: { nickname: 'Собеседник', avatar: '◐', isPvP: true }
            });
          });
          conn.on('error', (err) => {
            console.error('[lobby/host] conn error', err);
          });
        });

        peer.on('error', (err) => {
          console.error('[lobby/host] peer error', err?.type, err);
          if(err?.type === 'unavailable-id'){
            setError('Этот код уже занят. Закрой и попробуй снова.');
          } else if(err?.type === 'network' || err?.type === 'server-error' || err?.type === 'socket-error') {
            setError('Сервис подключения недоступен. Проверь интернет.');
          } else {
            setError('Ошибка комнаты: ' + (err?.type || err?.message || 'неизвестная'));
          }
          setMode('error');
        });
      } catch(e) {
        console.error('[lobby/host] exception', e);
        setError('Не удалось создать комнату. ' + e.message);
        setMode('error');
      }
    }

    function startGuest(codeOverride){
      const code = (codeOverride || inputCode).trim().toUpperCase();
      if(!/^KASTA-[A-Z0-9]{4}$/.test(code)){
        setError('Код должен быть в формате KASTA-XXXX');
        return;
      }
      if(!window.Peer){ setError('Сервис подключения недоступен.'); return; }
      setInputCode(code);
      setMode('waiting');
      setStatusText('Подключаюсь к ' + code + '…');
      setError(null);
      console.log('[lobby/guest] starting, target=' + code);

      try {
        const myPeerId = 'yasna-guest-' + Math.random().toString(36).slice(2, 8);
        const peer = new window.Peer(myPeerId, PEER_OPTIONS);
        const hostId = peerIdFromCode(code);

        let connectAttempted = false;

        // Master timeout
        timeoutRef.current = setTimeout(() => {
          if(!connectAttempted){
            console.error('[lobby/guest] master timeout — peer not opened');
            setError('Не удалось подключиться к серверу. Проверь интернет.');
            setMode('error');
            try { peer.destroy(); } catch(_){}
          }
        }, CONNECT_TIMEOUT_MS);

        peer.on('open', (id) => {
          connectAttempted = true;
          if(timeoutRef.current){ clearTimeout(timeoutRef.current); timeoutRef.current = null; }
          console.log('[lobby/guest] peer open, id=' + id + ', connecting to ' + hostId);

          const conn = peer.connect(hostId, { reliable: true });

          // Timeout для conn.open
          let connOpened = false;
          const connTimer = setTimeout(() => {
            if(!connOpened){
              console.error('[lobby/guest] conn open timeout');
              setError('Хозяин не отвечает. Проверь код или попроси создать новую комнату.');
              setMode('error');
              try { conn.close(); } catch(_){}
              try { peer.destroy(); } catch(_){}
            }
          }, 25000);

          conn.on('open', () => {
            connOpened = true;
            clearTimeout(connTimer);
            console.log('[lobby/guest] conn opened, going to game');
            transportRef.current = { peer, conn, role: 'guest', close: () => { try{conn.close()}catch(_){}; try{peer.destroy()}catch(_){} } };
            const transport = makeTransport(conn, 'guest');
            onConnected({
              transport, role: 'guest', roomCode: code,
              opponent: { nickname: 'Хозяин', avatar: '◑', isPvP: true }
            });
          });
          conn.on('error', (err) => {
            console.error('[lobby/guest] conn error', err);
            clearTimeout(connTimer);
            if(!connOpened){
              setError('Не удалось установить P2P-соединение. ' + (err?.type || err?.message || ''));
              setMode('error');
            }
          });
        });

        peer.on('error', (err) => {
          console.error('[lobby/guest] peer error', err?.type, err);
          if(err?.type === 'peer-unavailable'){
            setError('Комната не найдена. Проверь код — возможно, опечатка или хозяин закрыл вкладку.');
          } else if(err?.type === 'network' || err?.type === 'server-error') {
            setError('Сервис подключения недоступен. Проверь интернет.');
          } else {
            setError('Ошибка подключения: ' + (err?.type || err?.message || 'неизвестная'));
          }
          setMode('error');
        });
      } catch(e){
        console.error('[lobby/guest] exception', e);
        setError('Не удалось подключиться. ' + e.message);
        setMode('error');
      }
    }

    function copyLink(){
      const link = window.location.origin + window.location.pathname + '?room=' + roomCode;
      try {
        navigator.clipboard.writeText(link);
        setStatusText('✓ Ссылка скопирована · жду собеседника…');
        setTimeout(() => setStatusText('Жду собеседника…'), 2500);
      } catch(_){
        // Fallback — выделить текст пользователю
        prompt('Скопируй ссылку:', link);
      }
    }

    return React.createElement('div', { className: 'dp-lobby-overlay', onClick: e => { if(e.target === e.currentTarget) onClose(); } },
      React.createElement('div', { className: 'dp-lobby', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lobby-h' },
        React.createElement('button', { className: 'dp-lobby-x', onClick: onClose, 'aria-label': 'Закрыть' }, '×'),
        React.createElement('div', { className: 'dp-lobby-eyebrow' }, '✦  Партия вдвоём'),
        React.createElement('h2', { id: 'lobby-h' }, 'Касталия зовёт двоих'),

        mode === 'choose' && React.createElement(React.Fragment, null,
          React.createElement('p', { className: 'dp-lobby-sub' },
            'Создай комнату и поделись кодом · или войди по коду собеседника.'
          ),
          React.createElement('div', { className: 'dp-lobby-options' },
            React.createElement('button', { className: 'dp-lobby-opt', onClick: startHost },
              React.createElement('div', { className: 'dp-lobby-opt-icon' }, '◯'),
              React.createElement('div', { className: 'dp-lobby-opt-title' }, 'Создать'),
              React.createElement('div', { className: 'dp-lobby-opt-sub' }, 'Получишь код. Покажи его другу.')
            ),
            React.createElement('button', { className: 'dp-lobby-opt', onClick: () => setMode('guest') },
              React.createElement('div', { className: 'dp-lobby-opt-icon' }, '◐'),
              React.createElement('div', { className: 'dp-lobby-opt-title' }, 'Войти по коду'),
              React.createElement('div', { className: 'dp-lobby-opt-sub' }, 'Введи код, что прислал друг.')
            )
          ),
          error && React.createElement('div', { className: 'dp-lobby-error' }, error)
        ),

        mode === 'host' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'dp-lobby-code-block' },
            React.createElement('div', { className: 'dp-lobby-code-label' }, 'Код комнаты'),
            React.createElement('div', { className: 'dp-lobby-code' }, roomCode),
            React.createElement('div', { className: 'dp-lobby-code-hint' }, 'Покажи этот код собеседнику или скопируй ссылку'),
            React.createElement('button', { className: 'dp-lobby-code-link', onClick: copyLink }, 'Скопировать ссылку')
          ),
          React.createElement('div', { className: 'dp-lobby-status' },
            React.createElement('div', { className: 'dp-lobby-status-icon' }, '◷'),
            React.createElement('div', { className: 'dp-lobby-status-title' }, statusText)
          )
        ),

        mode === 'guest' && React.createElement(React.Fragment, null,
          React.createElement('p', { className: 'dp-lobby-sub' }, 'Введи код от собеседника'),
          React.createElement('input', {
            className: 'dp-lobby-input',
            placeholder: 'KASTA-XXXX',
            value: inputCode,
            maxLength: 10,
            autoFocus: true,
            onChange: e => setInputCode(e.target.value),
            onKeyDown: e => { if(e.key === 'Enter') startGuest(); }
          }),
          React.createElement('button', {
            className: 'dp-btn dp-btn-cta',
            onClick: startGuest,
            disabled: !inputCode.trim(),
            style: { width: '100%' }
          }, 'Войти →'),
          error && React.createElement('div', { className: 'dp-lobby-error' }, error)
        ),

        mode === 'waiting' && React.createElement('div', { className: 'dp-lobby-status' },
          React.createElement('div', { className: 'dp-lobby-status-icon' }, '◷'),
          React.createElement('div', { className: 'dp-lobby-status-title' }, statusText),
          React.createElement('div', { className: 'dp-lobby-status-sub' }, 'Это занимает несколько секунд')
        ),

        mode === 'error' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'dp-lobby-status' },
            React.createElement('div', { className: 'dp-lobby-status-icon', style: { color: 'var(--danger)' } }, '○'),
            React.createElement('div', { className: 'dp-lobby-status-title' }, 'Не получилось'),
            React.createElement('div', { className: 'dp-lobby-status-sub' }, error || 'Попробуй ещё раз')
          ),
          React.createElement('button', {
            className: 'dp-btn',
            onClick: () => { cleanup(); setMode('choose'); setError(null); },
            style: { width: '100%' }
          }, 'Назад')
        )
      )
    );
  }

  // Простой transport-обёртка над PeerJS dataconnection
  function makeTransport(conn, role){
    const handlers = new Set();
    conn.on('data', (data) => {
      handlers.forEach(fn => { try { fn(data); } catch(_){} });
    });
    return {
      role,
      send(msg){ try{ conn.send(msg); }catch(_){} },
      on(fn){ handlers.add(fn); return () => handlers.delete(fn); },
      close(){ try{ conn.close(); }catch(_){} },
      startHeartbeat(){ /* PeerJS делает свой */ },
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // MODALS · Auth + Anon Onboarding
  // ═══════════════════════════════════════════════════════════════════
  function DPAuthModal({ onClose, onLoggedIn }){
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const baseUrl = window.YASNA_LEADERBOARD_API;
    const botUsername = window.YASNA_TG_BOT;
    useEffect(() => {
      window.onTelegramAuth = async (tgUser) => {
        setLoading(true); setError(null);
        const res = await _g('YasnaDuelAuth').loginWithTelegram(tgUser);
        setLoading(false);
        if(res.ok) onLoggedIn(res.user);
        else setError(res.error || 'Не удалось войти');
      };
      return () => { delete window.onTelegramAuth; };
    }, []);
    return React.createElement('div', {
      className: 'dp-auth-overlay',
      onClick: e => { if(e.target === e.currentTarget) onClose(); }
    },
      React.createElement('div', { className: 'dp-auth-modal', role: 'dialog', 'aria-modal': 'true' },
        React.createElement('button', { className: 'dp-auth-x', onClick: onClose, 'aria-label': 'Закрыть' }, '×'),
        React.createElement('div', { className: 'dp-auth-eyebrow' }, '✦  Войти в Орден'),
        React.createElement('h2', null, 'Войти'),
        React.createElement('p', null, 'Через Telegram. Без паролей. Только имя и аватар.'),
        !baseUrl
          ? React.createElement('div', { style: { color: 'var(--danger)', fontSize: 13 } }, 'Хроника временно недоступна')
          : !botUsername
            ? React.createElement('div', { style: { color: 'var(--danger)', fontSize: 13 } }, 'Бот не настроен')
            : React.createElement('div', {
                className: 'dp-auth-tg-widget',
                ref: el => {
                  if(!el || el.children.length) return;
                  const s = document.createElement('script');
                  s.async = true;
                  s.src = 'https://telegram.org/js/telegram-widget.js?22';
                  s.setAttribute('data-telegram-login', botUsername);
                  s.setAttribute('data-size', 'large');
                  s.setAttribute('data-onauth', 'onTelegramAuth(user)');
                  s.setAttribute('data-request-access', 'write');
                  el.appendChild(s);
                }
              }),
        loading && React.createElement('div', { style: { fontSize: 13, color: 'var(--text-2)', marginTop: 8 } }, 'Авторизация…'),
        error && React.createElement('div', { style: { fontSize: 13, color: 'var(--danger)', marginTop: 8 } }, error)
      )
    );
  }

  function DPAnonOnboard({ onSave, onCancel }){
    const [nickname, setNickname] = useState('');
    const [avatar, setAvatar] = useState('🦊');
    const Profile = _g('YasnaDuelProfile');
    const opts = Profile?.AVATAR_OPTIONS || ['🦊','🐺','🦁','🐯','🐻','🐼','🦉','🦅'];
    const submit = () => {
      const nick = (nickname || '').trim().slice(0, 20);
      if(!nick) return;
      const profile = {
        nickname: nick, avatar,
        deviceId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'dev-' + Date.now()
      };
      Profile?.save?.(profile);
      onSave(profile);
    };
    return React.createElement('div', {
      className: 'dp-auth-overlay',
      onClick: e => { if(e.target === e.currentTarget) onCancel(); }
    },
      React.createElement('div', { className: 'dp-auth-modal', role: 'dialog', 'aria-modal': 'true' },
        React.createElement('button', { className: 'dp-auth-x', onClick: onCancel, 'aria-label': 'Отмена' }, '×'),
        React.createElement('div', { className: 'dp-auth-eyebrow' }, '✦  Послушник'),
        React.createElement('h2', null, 'Как тебя называть?'),
        React.createElement('p', null, 'Это имя соперник увидит в Партии.'),
        React.createElement('input', {
          className: 'dp-auth-input',
          autoFocus: true, placeholder: 'Например, Иван',
          value: nickname, maxLength: 20,
          onChange: e => setNickname(e.target.value),
          onKeyDown: e => { if(e.key === 'Enter') submit(); }
        }),
        React.createElement('div', { className: 'dp-avatar-grid' },
          opts.map(em =>
            React.createElement('button', {
              key: em, onClick: () => setAvatar(em),
              className: 'dp-avatar-opt' + (avatar === em ? ' dp-avatar-opt-active' : '')
            }, em)
          )
        ),
        React.createElement('button', {
          className: 'dp-btn dp-btn-cta',
          onClick: submit, disabled: !nickname.trim(),
          style: { width: '100%' }
        }, 'Готово →')
      )
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN APP
  // ═══════════════════════════════════════════════════════════════════
  function DuelPageApp(){
    const Auth = _g('YasnaDuelAuth');
    const Profile = _g('YasnaDuelProfile');
    const [user, setUser] = useState(() => Auth?.loadUser?.());
    const [profile, setProfile] = useState(() => Profile?.load?.());
    const [authModal, setAuthModal] = useState(false);
    const [anonModal, setAnonModal] = useState(false);
    const [game, setGame] = useState(null); // { type: 'turnir', opponent: 'shadow'|'pvp', shadowLevel?, transport?, role?, opponent? }

    // Auto-detect ?room= в URL — открываем сразу как guest
    const urlRoom = useMemo(() => {
      try {
        const p = new URLSearchParams(window.location.search);
        const r = (p.get('room') || '').trim().toUpperCase();
        return /^KASTA-[A-Z0-9]{4}$/.test(r) ? r : null;
      } catch(_){ return null; }
    }, []);
    const [lobby, setLobby] = useState(urlRoom ? { game: 'turnir', mode: 'guest', code: urlRoom } : null); // null | { game, mode?, code? }
    const [, setTick] = useState(0);
    const [orientHidden, setOrientHidden] = useState(() => {
      try { return localStorage.getItem('yasna_dp_orient_hidden') === '1'; } catch(_){ return false; }
    });
    const dismissOrient = () => {
      setOrientHidden(true);
      try { localStorage.setItem('yasna_dp_orient_hidden', '1'); } catch(_){}
    };

    const isFirstTime = !user && !profile;
    const onLoginClick = () => setAuthModal(true);
    const onLoggedIn = (u) => { setUser(u); setProfile(_g('YasnaDuelProfile')?.load?.()); setAuthModal(false); };
    const onLogout = () => {
      _g('YasnaDuelAuth')?.logout?.();
      setUser(null);
      try { localStorage.removeItem('yasna_duel_profile'); } catch(_){}
      setProfile(null);
      setTick(t => t + 1);
    };

    const requireProfile = (cb) => {
      if(user || profile){ cb(); return; }
      setAnonModal(true);
      window.__dpPendingPlay = cb;
    };
    const onAnonSaved = (p) => {
      setProfile(p); setAnonModal(false);
      const pending = window.__dpPendingPlay;
      delete window.__dpPendingPlay;
      if(pending) pending();
    };

    // ─── Старт игры с Тенью (бот) ───
    const startPartiyaWithShadow = (level) => {
      requireProfile(() => setGame({ type: 'turnir', opponent: 'shadow', shadowLevel: level || 'medium' }));
    };

    // ─── Старт Партии · диалог выбора (Тень или вдвоём) ───
    const [partiyaPicker, setPartiyaPicker] = useState(false);

    const askPartiyaMode = () => {
      requireProfile(() => setPartiyaPicker(true));
    };

    const startPartiyaPvP = () => {
      setPartiyaPicker(false);
      setLobby({ game: 'turnir' });
    };

    const startUzorPvP = () => {
      requireProfile(() => setLobby({ game: 'uzor' }));
    };

    const onLobbyConnected = ({ transport, role, opponent }) => {
      setLobby(null);
      // Очистим ?room= из URL чтобы при перезагрузке страницы не зайти повторно
      try { window.history.replaceState({}, '', window.location.pathname); } catch(_){}
      setGame({ type: 'turnir', opponent: 'pvp', transport, role, opp: opponent });
    };

    // Если есть room в URL — нужно убедиться что профиль есть
    useEffect(() => {
      if(urlRoom && !user && !profile){
        // Просим анонимный onboarding
        setAnonModal(true);
        window.__dpPendingPlay = () => setLobby({ game: 'turnir', mode: 'guest', code: urlRoom });
      }
    }, [urlRoom]);

    // ─── Если игра запущена — отображаем её ───
    if(game){
      const Turnir = _g('YasnaTurnir');
      if(!Turnir){
        return React.createElement('div', { className: 'dp-root' },
          React.createElement('div', { style: { textAlign: 'center', padding: 60, color: 'var(--text-3)' } }, 'Касталия открывает врата…')
        );
      }
      const me = user || profile;
      const playerData = {
        nickname: me.nickname,
        avatar: me.avatar || avatarInitials(me.nickname),
        rank: user ? 'Игрок' : 'Гость',
        deviceId: me.deviceId
      };
      return React.createElement(DPErrorBoundary, null,
        React.createElement(Turnir.TurnirGame, {
          player: playerData,
          opponentLevel: game.shadowLevel || 'medium',
          opponentMode: game.opponent, // 'shadow' or 'pvp'
          transport: game.transport,
          role: game.role,
          oppData: game.opp,
          onClose: () => { setGame(null); setTick(t => t + 1); }
        })
      );
    }

    return React.createElement('div', { className: 'dp-root' },
      React.createElement('a', { href: '#main', className: 'dp-skip' }, 'Пропустить к главному'),
      React.createElement(DPHeader, { user, onLoginClick, onLogout }),

      isFirstTime
        ? React.createElement(DPWelcome, { onLoginClick, onAnonStart: () => setAnonModal(true) })
        : React.createElement('main', { id: 'main' },
            React.createElement(DPCastaliaTitle, null),
            React.createElement(DPProfileHero, { user, profile, onLoginClick }),
            React.createElement(DPMainGames, { onPartiya: askPartiyaMode, onUzor: startUzorPvP }),
            React.createElement(DPQuestsRow, { onEtude: () => startPartiyaWithShadow('easy') }),
            React.createElement(DPPartitura, null),
            React.createElement('section', { className: 'dp-section' },
              React.createElement('div', { className: 'dp-two-col' },
                React.createElement(DPHronika, { user }),
                React.createElement(DPZnaki, null)
              )
            ),
            React.createElement('section', { className: 'dp-section' },
              React.createElement(DPJournal, null)
            )
          ),

      React.createElement('footer', { className: 'dp-footer' },
        React.createElement('div', { className: 'dp-footer-quote' },
          '«В Касталии не выигрывают и не проигрывают.', React.createElement('br'),
          'Здесь играют — это и есть смысл.»'
        ),
        React.createElement('div', null,
          React.createElement('a', { href: 'index.html' }, 'К Ясне'),
          ' · ',
          React.createElement('a', { href: 'https://github.com/Avvacumrechevoi/yasnanegotiations', target: '_blank', rel: 'noopener' }, 'GitHub')
        ),
        React.createElement('div', { className: 'dp-footer-version' }, 'Касталия Ясны · v2.0 · мая 2026')
      ),

      authModal && React.createElement(DPAuthModal, { onClose: () => setAuthModal(false), onLoggedIn }),
      anonModal && React.createElement(DPAnonOnboard, {
        onSave: onAnonSaved,
        onCancel: () => { setAnonModal(false); delete window.__dpPendingPlay; }
      }),

      // ─── Диалог выбора режима Партии (с Тенью / вдвоём) ───
      partiyaPicker && React.createElement('div', {
        className: 'dp-auth-overlay',
        onClick: e => { if(e.target === e.currentTarget) setPartiyaPicker(false); }
      },
        React.createElement('div', { className: 'dp-auth-modal', role: 'dialog', 'aria-modal': 'true' },
          React.createElement('button', { className: 'dp-auth-x', onClick: () => setPartiyaPicker(false), 'aria-label': 'Отмена' }, '×'),
          React.createElement('div', { className: 'dp-auth-eyebrow' }, '✦  Партия'),
          React.createElement('h2', null, 'С кем играешь?'),
          React.createElement('p', null, 'Тень — бот трёх ликов. Собеседник — живой игрок в реальном времени.'),
          React.createElement('div', { style: { display: 'grid', gap: 8, marginTop: 16 } },
            React.createElement('button', {
              className: 'dp-btn',
              onClick: () => { setPartiyaPicker(false); startPartiyaWithShadow('easy'); },
              style: { padding: '14px 18px', justifyContent: 'flex-start', textAlign: 'left' }
            }, '🌅  ', React.createElement('span', { style: { fontWeight: 500, marginLeft: 4 } }, 'Тень Послушника'),
              React.createElement('span', { style: { fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' } }, '· легко')),
            React.createElement('button', {
              className: 'dp-btn',
              onClick: () => { setPartiyaPicker(false); startPartiyaWithShadow('medium'); },
              style: { padding: '14px 18px', justifyContent: 'flex-start', textAlign: 'left' }
            }, '🌗  ', React.createElement('span', { style: { fontWeight: 500, marginLeft: 4 } }, 'Тень Игрока'),
              React.createElement('span', { style: { fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' } }, '· средне')),
            React.createElement('button', {
              className: 'dp-btn',
              onClick: () => { setPartiyaPicker(false); startPartiyaWithShadow('hard'); },
              style: { padding: '14px 18px', justifyContent: 'flex-start', textAlign: 'left' }
            }, '🌑  ', React.createElement('span', { style: { fontWeight: 500, marginLeft: 4 } }, 'Тень Магистра'),
              React.createElement('span', { style: { fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' } }, '· сильно')),
            React.createElement('div', { style: { borderTop: '0.5px solid var(--border-2)', marginTop: 8, paddingTop: 8 } }),
            React.createElement('button', {
              className: 'dp-btn dp-btn-primary',
              onClick: startPartiyaPvP,
              style: { padding: '14px 18px', justifyContent: 'flex-start', textAlign: 'left' }
            }, '◐◑  ', React.createElement('span', { style: { fontWeight: 500, marginLeft: 4 } }, 'Живой собеседник'),
              React.createElement('span', { style: { fontSize: 12, opacity: 0.85, marginLeft: 'auto' } }, '· real-time'))
          )
        )
      ),

      // ─── Lobby для PvP ───
      lobby && React.createElement(DPLobby, {
        initialMode: lobby.mode || null,
        initialCode: lobby.code || null,
        onClose: () => setLobby(null),
        profile: profile || user,
        onConnected: onLobbyConnected
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // MOUNT
  // ═══════════════════════════════════════════════════════════════════
  function waitAndMount(){
    let attempts = 0;
    const check = () => {
      const ready = window.YasnaDuelAuth && window.YasnaTrivia && window.YasnaTurnir;
      if(ready || attempts++ > 50){
        const root = document.getElementById('duel-page-root');
        if(root){
          ReactDOM.createRoot(root).render(
            React.createElement(DPErrorBoundary, null,
              React.createElement(DuelPageApp)
            )
          );
        }
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', waitAndMount);
  } else {
    waitAndMount();
  }
})();
