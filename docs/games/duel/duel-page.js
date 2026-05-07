// ═══════════════════════════════════════════════════════════════════
// Игра по Ясне · главная страница (layout v4 · профессиональный)
// Welcome / Profile-Hero / Quests / CTA / Партитура / Архив + Знаки
// ═══════════════════════════════════════════════════════════════════
(function(){
  const { useState, useEffect, useRef } = React;
  const _g = (n) => window[n];

  // ─── Error Boundary ───────────────────────────────────────
  // Чтобы один сломавшийся компонент не клал всю страницу.
  // Без этого typo в данных = белый экран дуэли.
  class DPErrorBoundary extends React.Component {
    constructor(p){ super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err){ return { err }; }
    componentDidCatch(err, info){ try{ console.error('[Duel]', err, info); }catch(_){} }
    render(){
      if(this.state.err){
        return React.createElement('div', {
          style: { padding: '40px 20px', maxWidth: 480, margin: '40px auto', textAlign: 'center', fontFamily: 'inherit' }
        },
          React.createElement('div', { style: { fontSize: 32, marginBottom: 12 } }, '⚠️'),
          React.createElement('h2', { style: { fontSize: 18, marginBottom: 8 } }, 'Что-то сломалось'),
          React.createElement('p', { style: { fontSize: 13, color: '#6e6e73', lineHeight: 1.6, marginBottom: 16 } },
            'Дуэль не смогла отрисоваться. Попробуй перезагрузить страницу или вернись на главную.'
          ),
          React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'center' } },
            React.createElement('button', {
              onClick: () => window.location.reload(),
              style: { padding: '8px 18px', borderRadius: 8, border: '1px solid #d2d2d7', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }
            }, 'Перезагрузить'),
            React.createElement('a', {
              href: 'index.html',
              style: { padding: '8px 18px', borderRadius: 8, border: '1px solid #0071e3', background: '#0071e3', color: '#fff', textDecoration: 'none', fontFamily: 'inherit', fontSize: 13 }
            }, 'На главную')
          ),
          this.state.err && React.createElement('details', { style: { marginTop: 24, fontSize: 11, color: '#86868b', textAlign: 'left' } },
            React.createElement('summary', null, 'Подробности'),
            React.createElement('pre', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6, fontSize: 10 } },
              String(this.state.err.stack || this.state.err.message || this.state.err)
            )
          )
        );
      }
      return this.props.children;
    }
  }

  // ─── Inline SVG icons (стрики 14×14) ─────────────────────
  const Icon = (path) => (props) => React.createElement('svg', {
    className: 'dp-icon ' + (props?.cls || ''),
    width: 14, height: 14, viewBox: '0 0 16 16',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
    strokeLinecap: 'round', strokeLinejoin: 'round'
  }, React.createElement('path', { d: path }));

  const IconCalendar = Icon('M3 5h10v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Zm0 0V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1M5 2v3M11 2v3M3 8h10');
  const IconGrid     = Icon('M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z');
  const IconList     = Icon('M3 4h10M3 8h10M3 12h10');
  const IconStar     = Icon('M8 2.5l1.7 3.5 3.8.5-2.7 2.7.7 3.8L8 11.2 4.5 13l.7-3.8L2.5 6.5l3.8-.5L8 2.5Z');
  const IconBolt     = Icon('M9 2L4 9h3l-1 5 5-7H8l1-5Z');
  const IconBead     = Icon('M8 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12ZM8 5v2M8 9v2');
  const IconDrop     = Icon('M8 2c-2.5 3-4.5 5-4.5 7.5a4.5 4.5 0 0 0 9 0C12.5 7 10.5 5 8 2Z');
  const IconUsers    = Icon('M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2 13c0-2 1.3-3 3-3s3 1 3 3M8 13c0-2 1.3-3 3-3s3 1 3 3');
  const IconShield   = Icon('M8 2L3 4v4c0 3 2 5 5 6 3-1 5-3 5-6V4L8 2Z');
  const IconQuestion = Icon('M6 6a2 2 0 1 1 4 0c0 1-1 1.5-1.5 2V9M8 12v.01');

  // ─── Тултип-терм: short helper ───────────────────────────
  const Term = (label, tip) => React.createElement('span', {
    className: 'dp-term', tabIndex: 0, 'data-tip': tip
  }, label);

  function renderAvatar(av, size){
    size = size || 24;
    if(typeof av === 'string' && av.startsWith('http')){
      return React.createElement('img', { src: av, alt: '' });
    }
    if(typeof av === 'string' && av.length > 0 && av.length <= 4){
      return React.createElement('span', { style: { fontSize: size * 0.6, lineHeight: 1 } }, av);
    }
    return React.createElement('span', { style: { fontSize: size * 0.6 } }, av || '·');
  }

  // Initials helper for letter-based avatars
  function avatarInitials(name){
    if(!name) return '·';
    const t = String(name).trim();
    if(!t) return '·';
    return t.slice(0, 1).toUpperCase();
  }

  // ─── Прогрессия ──────────────────────────────────────────
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

  // ─── Header ──────────────────────────────────────────────
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
      React.createElement('a', { href: 'index.html', className: 'dp-header-back', title: 'Вернуться к Ясне' },
        React.createElement('span', { className: 'dp-header-back-arrow' }, '←'),
        React.createElement('span', null, 'Ясна')
      ),
      React.createElement('div', { className: 'dp-header-spacer' }),
      React.createElement('nav', { className: 'dp-header-nav' },
        React.createElement('a', { href: '#archive', onClick: onAnchorClick('archive') }, 'Таблица'),
        React.createElement('a', { href: '#znaki', onClick: onAnchorClick('znaki') }, 'Знаки'),
        React.createElement('div', { className: 'dp-header-auth', ref: helpRef },
          React.createElement('button', {
            className: 'dp-help-btn',
            onClick: () => setHelpOpen(v => !v),
            title: 'Что это за страница?'
          }, '?'),
          helpOpen && React.createElement('div', { className: 'dp-help-popover' },
            React.createElement('h4', null, 'Игра по Ясне'),
            React.createElement('div', null, 'Тренажёр памяти по корпусу Ясны. Партия — 18 вопросов из 6 случайных тем. Соперник — Тень.'),
            React.createElement('ul', null,
              React.createElement('li', null, React.createElement('strong', null, 'Бусины'), ' — твои очки. Накапливаются за верные ответы.'),
              React.createElement('li', null, React.createElement('strong', null, 'Ступень'), ' — от Послушника до Магистра, зависит от бусин.'),
              React.createElement('li', null, React.createElement('strong', null, 'Партитура'), ' — 9 тем с твоим прогрессом по каждой.'),
              React.createElement('li', null, React.createElement('strong', null, 'Турнирная таблица'), ' — топ игроков недели по бусинам, обнуляется Сб 23:59.')
            )
          ),
          user
            ? React.createElement('button', { className: 'dp-btn-text', onClick: onLogout, style: { marginLeft: 6 } }, 'Выйти')
            : React.createElement('button', {
                className: 'dp-btn dp-btn-primary',
                onClick: onLoginClick,
                style: { padding: '7px 14px', fontSize: 13, marginLeft: 6 }
              }, 'Войти')
        )
      )
    );
  }

  // ─── Orientation banner (для залогиненного, dismissible) ─
  function DPOrient({ onClose }){
    return React.createElement('div', { className: 'dp-orient' },
      React.createElement('div', { className: 'dp-orient-icon' }, 'i'),
      React.createElement('div', { className: 'dp-orient-text' },
        'Ты в ', React.createElement('strong', null, 'Кабинете игрока'),
        '. Ниже — твой профиль, ', Term('Партии', 'Партия — игровая сессия из 18 вопросов по 6 темам, ≈6 минут.'),
        ' дня и Архив. Главное — нажать ', React.createElement('strong', null, 'Новая Партия'), '.'
      ),
      React.createElement('button', {
        className: 'dp-orient-close',
        onClick: onClose,
        title: 'Скрыть подсказку'
      }, '×')
    );
  }

  // ─── Welcome (только для первого визита) ────────────────
  function DPWelcome({ onLoginClick, onAnonStart }){
    return React.createElement('section', { className: 'dp-welcome' },
      React.createElement('div', { className: 'dp-welcome-eyebrow' }, 'Тренажёр памяти'),
      React.createElement('h1', { className: 'dp-welcome-title' }, 'Игра по Ясне'),
      React.createElement('p', { className: 'dp-welcome-sub' },
        'Партия из 18 вопросов. Шесть тем, три уровня глубины. Тренируй память — собирай бусины — поднимайся по ступеням.'
      ),
      React.createElement('div', { className: 'dp-welcome-actions' },
        React.createElement('button', { className: 'dp-btn dp-btn-primary', onClick: onLoginClick }, 'Войти через Telegram'),
        React.createElement('button', { className: 'dp-btn dp-btn-ghost', onClick: onAnonStart }, 'Сыграть анонимно')
      ),
      React.createElement('div', { className: 'dp-welcome-pillars' },
        React.createElement('div', { className: 'dp-welcome-pillar' },
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, '◷  Партия'),
          React.createElement('div', { className: 'dp-welcome-pillar-text' }, '18 вопросов · 6 тем · 5–7 минут')
        ),
        React.createElement('div', { className: 'dp-welcome-pillar' },
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, '◐  Тень'),
          React.createElement('div', { className: 'dp-welcome-pillar-text' }, 'Бот-соперник с тремя ритмами')
        ),
        React.createElement('div', { className: 'dp-welcome-pillar' },
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, '◇  Ступени'),
          React.createElement('div', { className: 'dp-welcome-pillar-text' }, 'Послушник → Магистр')
        )
      )
    );
  }

  // ─── Profile-Hero (горизонтальная полоса) ────────────────
  function DPProfileHero({ user, profile, onLoginClick }){
    const me = user || profile;
    const isGuest = !user;
    const busey = totalBusey();
    const stupen = getStupen(busey);
    const pct = stupen.to === Infinity ? 100 :
      Math.min(100, ((busey - stupen.from) / (stupen.to - stupen.from)) * 100);
    const Storage = _g('YasnaDuelStorage');
    const data = Storage?.getOverallStats?.() || {};
    const streak = data.streaks?.daily?.current || 0;
    const games = data.totals?.matches || 0;
    const toNext = stupen.to === Infinity ? 0 : Math.max(0, stupen.to - busey);

    const avatarContent = (typeof me.avatar === 'string' && me.avatar.startsWith('http'))
      ? React.createElement('img', { src: me.avatar, alt: '' })
      : (typeof me.avatar === 'string' && me.avatar.length > 0 && me.avatar.length <= 4)
        ? me.avatar
        : avatarInitials(me.nickname);

    return React.createElement('section', { className: 'dp-hero' },
      React.createElement('div', { className: 'dp-hero-avatar' }, avatarContent),
      React.createElement('div', { className: 'dp-hero-body' },
        React.createElement('div', { className: 'dp-hero-name-row' },
          React.createElement('span', { className: 'dp-hero-name' }, me.nickname),
          React.createElement('span', { className: 'dp-hero-rank-pill' }, stupen.name, ' ', toRoman(stupen.subLevel)),
          isGuest && React.createElement('span', { className: 'dp-hero-guest-tag' }, '· Гость')
        ),
        React.createElement('div', { className: 'dp-hero-stats' },
          React.createElement('span', null,
            busey, ' ', Term('бусин', 'Бусины — главная валюта Игры. Начисляются за верные ответы (10 базовых + бонус за скорость).')
          ),
          React.createElement('span', { className: 'dp-hero-stats-sep' }, '·'),
          React.createElement('span', null, games, ' ', Term('партий', 'Партия — одна игровая сессия из 18 вопросов.')),
          streak > 0 && React.createElement(React.Fragment, null,
            React.createElement('span', { className: 'dp-hero-stats-sep' }, '·'),
            React.createElement('span', { className: 'dp-hero-streak' },
              Term('серия', 'Серия — сколько дней подряд ты играешь без пропуска.'),
              ' ', streak
            )
          )
        ),
        React.createElement('div', { className: 'dp-hero-progress' },
          React.createElement('div', { className: 'dp-hero-progress-fill', style: { width: pct + '%' } })
        ),
        React.createElement('div', { className: 'dp-hero-progress-meta' },
          React.createElement('span', null, stupen.name, ' ', toRoman(stupen.subLevel)),
          React.createElement('span', null, (function(){
            if(stupen.to === Infinity) return 'высшая ступень';
            const curIdx = STUPENI.findIndex(x => x.name === stupen.name);
            const next = STUPENI[curIdx + 1];
            return next ? ('до ' + next.name + ' · ' + toNext + ' бусин') : ('+' + toNext + ' бусин');
          })())
        ),
        isGuest && React.createElement('button', {
          className: 'dp-hero-upsell',
          onClick: onLoginClick
        },
          React.createElement('span', null, 'Войди через Telegram, чтобы попасть в Архив'),
          React.createElement('span', null, '→')
        )
      )
    );
  }

  // ─── Quests (Сегодня) ────────────────────────────────────
  function DPQuestsRow({ onPlay }){
    const Daily = _g('YasnaDailyChallenge');
    const today = Daily?.today?.();
    const themes = window.YasnaTrivia?.THEMES || [];
    const themeIdx = today ? parseInt(today.date.replace(/-/g, ''), 10) % Math.max(1, themes.length) : 0;
    const todayTheme = themes[themeIdx];
    const data = Daily?.load?.() || {};
    const todayPlayed = today && data.byDate?.[today.date];

    // Только «Этюд» сейчас реально работает — он запускает обычную Партию.
    // Остальные форматы (Гимн/Молния/Гость) пока в разработке —
    // показываем «скоро», чтобы не вводить в заблуждение, как было раньше:
    // 4 одинаково ведущие кнопки = ощущение, что страница ломается.
    const quests = [
      {
        id: 'etude',
        tag: 'Этюд',
        title: 'Один шанс\nв день',
        foot: todayPlayed ? 'Сыграно: ' + todayPlayed.score : '+30 бусин',
        footMute: !!todayPlayed,
        ready: true
      },
      {
        id: 'gimn',
        tag: 'Гимн',
        title: 'Тема\n' + (todayTheme?.name || 'дня'),
        foot: 'скоро',
        footMute: true,
        ready: false
      },
      {
        id: 'flash',
        tag: 'Молния',
        title: '9 вопросов\nна скорость',
        foot: 'скоро',
        footMute: true,
        ready: false
      },
      {
        id: 'guest',
        tag: 'Гость',
        title: 'Партия\nс другом',
        foot: 'скоро',
        footMute: true,
        ready: false
      },
    ];

    return React.createElement('section', { className: 'dp-section' },
      React.createElement('div', { className: 'dp-section-h-row' },
        React.createElement('h2', { className: 'dp-section-h' }, IconCalendar(), ' Сегодня'),
        React.createElement('span', { className: 'dp-section-h-sub' }, quests.filter(q => q.ready).length, ' доступно из ', quests.length)
      ),
      React.createElement('p', { className: 'dp-section-desc' },
        'Быстрые форматы, чтобы поддержать ритм. Каждое задание — короче полной Партии.'
      ),
      React.createElement('div', { className: 'dp-quests' },
        quests.map(q =>
          React.createElement('button', {
            key: q.id,
            className: 'dp-quest' + (q.ready ? '' : ' dp-quest-locked'),
            onClick: q.ready ? onPlay : undefined,
            disabled: !q.ready,
            title: q.ready ? '' : 'Этот формат скоро появится'
          },
            React.createElement('div', { className: 'dp-quest-tag' }, q.tag),
            React.createElement('div', { className: 'dp-quest-title' }, q.title.split('\n').map((l, i) =>
              React.createElement('span', { key: i }, l, i === 0 && q.title.includes('\n') ? React.createElement('br', { key: 'br' + i }) : null)
            )),
            React.createElement('div', {
              className: 'dp-quest-foot' + (q.footMute ? ' dp-quest-foot-mute' : '')
            }, q.foot)
          )
        )
      )
    );
  }

  // ─── Главная кнопка «Новая Партия» ───────────────────────
  function DPMainCTA({ onPlay }){
    return React.createElement('section', { className: 'dp-cta-block' },
      React.createElement('div', null,
        React.createElement('div', { className: 'dp-cta-text-eyebrow' }, 'Главное действие'),
        React.createElement('div', { className: 'dp-cta-title' }, 'Новая Партия'),
        React.createElement('div', { className: 'dp-cta-sub' },
          '6 тем · 18 вопросов · соперник ',
          Term('Тень', 'Тень — бот-соперник. Отвечает с заданной точностью (Лёгкая 55%, Средняя 75%, Сильная 92%) и реальной задержкой.')
        )
      ),
      React.createElement('button', { className: 'dp-btn dp-btn-cta', onClick: onPlay },
        'Начать ', React.createElement('span', { style: { marginLeft: 4 } }, '→')
      )
    );
  }

  // ─── Партитура (карта тем) ───────────────────────────────
  function DPPartitura(){
    const themes = window.YasnaTrivia?.THEMES || [];
    if(themes.length === 0) return null;
    const Storage = _g('YasnaDuelStorage');
    const data = Storage?.getOverallStats?.() || {};
    const masteryByTheme = data.masteryByTheme || {};
    const opened = themes.filter(t => (masteryByTheme[t.id] || 0) > 0).length;

    return React.createElement('section', { className: 'dp-section' },
      React.createElement('div', { className: 'dp-section-h-row' },
        React.createElement('h2', { className: 'dp-section-h' }, IconGrid(), ' Партитура'),
        React.createElement('span', { className: 'dp-section-h-sub' }, 'Освоено ', opened, ' из ', themes.length)
      ),
      React.createElement('p', { className: 'dp-section-desc' },
        '9 тем мира «Сутки». Процент — твоё освоение. Темы открываются по мере того, как они выпадают в Партиях.'
      ),
      React.createElement('div', { className: 'dp-partitura' },
        themes.map(t => {
          const pct = masteryByTheme[t.id] || 0;
          const isLocked = pct === 0;
          const fillCls = pct >= 60 ? '' : pct >= 25 ? ' dp-theme-bar-fill-mid' : ' dp-theme-bar-fill-low';
          return React.createElement('div', {
            key: t.id,
            className: 'dp-theme' + (isLocked ? ' dp-theme-locked' : '')
          },
            React.createElement('div', { className: 'dp-theme-name' }, t.name),
            isLocked
              ? React.createElement('div', { style: { fontSize: 11, color: 'var(--text-3)' } }, 'не открыто')
              : React.createElement('div', { className: 'dp-theme-bar-row' },
                  React.createElement('div', { className: 'dp-theme-bar' },
                    React.createElement('div', {
                      className: 'dp-theme-bar-fill' + fillCls,
                      style: { width: pct + '%' }
                    })
                  ),
                  React.createElement('span', { className: 'dp-theme-pct' }, pct + '%')
                )
          );
        })
      )
    );
  }

  // ─── Турнирная таблица (бывш. Архив) ─────────────────────
  function DPArchive({ user }){
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

    return React.createElement('div', { className: 'dp-card', id: 'archive' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          IconList(), ' ',
          Term('Турнирная таблица', 'Турнирная таблица — топ игроков недели по сумме бусин. Обновляется в субботу 23:59.')
        ),
        React.createElement('span', { className: 'dp-card-meta' }, 'Неделя')
      ),
      items === null
        ? React.createElement('div', { className: 'dp-lb-empty' }, 'Загрузка…')
        : items.length === 0
          ? React.createElement('div', { className: 'dp-lb-empty' }, 'Пока пусто. Сыграй Партию — попади в таблицу.')
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
                      React.createElement('td', { className: 'dp-td-num-strong' }, row.score != null ? row.score : '—')
                    );
                  })
                )
              ),
              React.createElement('div', { className: 'dp-table-foot' },
                React.createElement('span', null,
                  myInTop ? 'Ты на ' + myRank + '-й позиции'
                          : (myDeviceId ? 'Ты пока вне топ-5' : 'Сыграй, чтобы попасть в таблицу')
                ),
                React.createElement('span', null, 'обновляется Сб 23:59')
              )
            )
    );
  }

  // ─── Знаки ───────────────────────────────────────────────
  function DPZnaki(){
    const Ach = _g('YasnaDuelAchievements');
    if(!Ach?.list || !Ach?.getUnlocked) return React.createElement('div', { className: 'dp-card', id: 'znaki' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, IconStar(), ' Знаки'),
        React.createElement('span', { className: 'dp-card-meta' }, '0 / 0')
      ),
      React.createElement('div', { className: 'dp-znaki-foot' }, 'Загрузка…')
    );
    const all = Ach.list();
    const unlocked = Ach.getUnlocked() || [];
    const items = all.slice(0, 6).map(a => ({
      a, got: unlocked.includes(a.id)
    }));
    const lastUnlocked = all.filter(a => unlocked.includes(a.id)).slice(-1)[0];

    return React.createElement('div', { className: 'dp-card', id: 'znaki' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, IconStar(),
          ' ', Term('Знаки', 'Знаки — достижения. Открываются за упорство, серии и результаты Партий.')
        ),
        React.createElement('span', { className: 'dp-card-meta' }, unlocked.length, ' / ', all.length)
      ),
      React.createElement('div', { className: 'dp-znaki-row' },
        items.map(({ a, got }, i) =>
          React.createElement('div', {
            key: a.id,
            className: 'dp-znak' + (got ? '' : ' dp-znak-locked'),
            title: a.title || ''
          }, got ? toRoman(i + 1) : '·')
        )
      ),
      React.createElement('div', { className: 'dp-znaki-foot' },
        lastUnlocked ? ('Последний: ' + lastUnlocked.title) : 'Сыграй первую партию'
      )
    );
  }

  // ─── Auth Modal ──────────────────────────────────────────
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
      React.createElement('div', { className: 'dp-auth-modal' },
        React.createElement('button', { className: 'dp-auth-x', onClick: onClose, 'aria-label': 'Закрыть' }, '×'),
        React.createElement('div', { className: 'dp-auth-eyebrow' }, 'Касталия Ясны'),
        React.createElement('h2', null, 'Войти'),
        React.createElement('p', null, 'Через Telegram. Без паролей. Только имя и аватар.'),
        !baseUrl
          ? React.createElement('div', { style: {color:'var(--danger)', fontSize:13} }, 'Архив временно недоступен')
          : !botUsername
            ? React.createElement('div', { style: {color:'var(--danger)', fontSize:13} }, 'Бот не настроен')
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
        loading && React.createElement('div', { style: {fontSize:13, color:'var(--text-2)', marginTop:8} }, 'Авторизация…'),
        error && React.createElement('div', { style: {fontSize:13, color:'var(--danger)', marginTop:8} }, error)
      )
    );
  }

  // ─── Anon Onboarding ─────────────────────────────────────
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
      React.createElement('div', { className: 'dp-auth-modal' },
        React.createElement('button', { className: 'dp-auth-x', onClick: onCancel, 'aria-label': 'Отмена' }, '×'),
        React.createElement('div', { className: 'dp-auth-eyebrow' }, 'Гость'),
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
          className: 'dp-btn dp-btn-primary',
          onClick: submit, disabled: !nickname.trim(),
          style: { width: '100%' }
        }, 'Готово')
      )
    );
  }

  // ─── Main App ────────────────────────────────────────────
  function DuelPageApp(){
    const Auth = _g('YasnaDuelAuth');
    const Profile = _g('YasnaDuelProfile');
    const [user, setUser] = useState(() => Auth?.loadUser?.());
    const [profile, setProfile] = useState(() => Profile?.load?.());
    const [authModal, setAuthModal] = useState(false);
    const [anonModal, setAnonModal] = useState(false);
    const [turnirOpen, setTurnirOpen] = useState(false);
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
    const startTurnir = () => requireProfile(() => setTurnirOpen(true));

    if(turnirOpen){
      const Turnir = _g('YasnaTurnir');
      if(!Turnir){
        return React.createElement('div', { className: 'dp-root' },
          React.createElement('div', { style: {textAlign:'center', padding:60, color:'var(--text-3)'} }, 'Загрузка…')
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
          opponentLevel: 'medium',
          onClose: () => { setTurnirOpen(false); setTick(t => t + 1); }
        })
      );
    }

    return React.createElement('div', { className: 'dp-root' },
      React.createElement(DPHeader, { user, onLoginClick, onLogout }),

      isFirstTime
        ? React.createElement(DPWelcome, { onLoginClick, onAnonStart: () => setAnonModal(true) })
        : React.createElement(React.Fragment, null,
            !orientHidden && React.createElement(DPOrient, { onClose: dismissOrient }),
            React.createElement(DPProfileHero, { user, profile, onLoginClick }),
            React.createElement(DPQuestsRow, { onPlay: startTurnir }),
            React.createElement(DPMainCTA, { onPlay: startTurnir }),
            React.createElement(DPPartitura, null),
            React.createElement('section', { className: 'dp-section' },
              React.createElement('div', { className: 'dp-two-col' },
                React.createElement(DPArchive, { user }),
                React.createElement(DPZnaki, null)
              )
            )
          ),

      React.createElement('footer', { className: 'dp-footer' },
        React.createElement('a', { href: 'index.html' }, 'Вернуться к Ясне'),
        ' · ',
        React.createElement('a', { href: 'https://github.com/Avvacumrechevoi/yasnanegotiations', target: '_blank', rel: 'noopener' }, 'GitHub')
      ),

      authModal && React.createElement(DPAuthModal, { onClose: () => setAuthModal(false), onLoggedIn }),
      anonModal && React.createElement(DPAnonOnboard, {
        onSave: onAnonSaved,
        onCancel: () => { setAnonModal(false); delete window.__dpPendingPlay; }
      })
    );
  }

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
