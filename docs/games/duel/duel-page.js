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

  // ─── Иконки и цвета тем — для banner-cards в picker'е ───────────────
  // Каждая тема имеет уникальный hue + line-style SVG. Цвета — из VK Tech
  // палитры (--vk-accent, --vk-accent-2/3, --vk-success, --vk-warning, ...).
  const THEME_VISUALS = {
    // ─ Новый банк (T1-T10) ─
    'chto-est-yasna':       { color: '#0077FF', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4"/></svg>' },
    'sutki-chertyozh':      { color: '#00D3E6', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>' },
    'granit-nauki':         { color: '#C0943A', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8l6-5 6 5v8l-6 5-6-5z"/><path d="M6 8h12M12 3v18"/></svg>' },
    'osi-kresty':           { color: '#F06838', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M5 5l14 14M19 5L5 19"/></svg>' },
    'skorosti-nakopleniya': { color: '#59A840', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18l6-8 5 4 7-9"/><path d="M14 5h7v7"/></svg>' },
    'chashi-vesy':          { color: '#E1334E', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 8h14M5 8l-3 6h6zM19 8l3 6h-6z"/></svg>' },
    'khram-tri-kresta-sofiya': { color: '#9966EA', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V10l9-6 9 6v11M9 21v-7h6v7M12 4v6"/></svg>' },
    'prana-stihii':         { color: '#FF3985', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10z"/></svg>' },
    'tsveta-ogon-dugi-sezony': { color: '#F6C64A', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>' },
    // ─ Legacy банк (T1.legacy → gimny etc.) ─
    'gimny':    { color: '#0077FF', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/></svg>' },
    'sutki':    { color: '#00D3E6', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>' },
    'zerno':    { color: '#C0943A', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 8l6-5 6 5v8l-6 5-6-5z"/></svg>' },
    'antipody': { color: '#F06838', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v18M3 12h18"/></svg>' },
    'skorpion': { color: '#9966EA', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12c4 0 7-3 7-7M19 12c-4 0-7-3-7-7M12 12v9"/></svg>' },
    'chashi':   { color: '#E1334E', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v18M5 8h14"/></svg>' },
    'prana':    { color: '#FF3985', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10z"/></svg>' },
    'zerkalo':  { color: '#5B9CF6', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="3" width="12" height="18" rx="2"/></svg>' },
    'skrizhal': { color: '#59A840', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>' },
    // ─ Fallback ─
    '__default': { color: '#0077FF', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/></svg>' },
  };

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
              href: 'start.html',
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

  // ─── VK System Message — компонент-плашка из VK DS ────────────────
  // kind: 'info' | 'success' | 'warn' | 'error' (default: 'info')
  // size: 'm' | 's' (default: 'm' — с заголовком; 's' — компактный без)
  // icon: символ или emoji в круглой иконке (default: '⚙')
  // title, text — содержимое
  // action: { label, onClick, variant: 'accent'|'ghost' } — опц. кнопка справа
  function VkSysMsg({ kind = 'info', size = 'm', icon = '⚙', title, text, action }){
    const cls = ['vk-sysmsg', 'vk-sysmsg--' + kind];
    if(size === 's') cls.push('vk-sysmsg--s');
    return React.createElement('div', { className: cls.join(' '), role: 'status' },
      React.createElement('div', { className: 'vk-sysmsg-icon', 'aria-hidden': 'true' }, icon),
      React.createElement('div', { className: 'vk-sysmsg-body' },
        title && React.createElement('div', { className: 'vk-sysmsg-title' }, title),
        text && React.createElement('div', { className: 'vk-sysmsg-text' }, text)
      ),
      action && React.createElement('button', {
        type: 'button',
        onClick: action.onClick,
        className: 'vk-sysmsg-action' + (action.variant === 'accent' ? ' vk-sysmsg-action--accent' : '')
      }, action.label)
    );
  }

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
  function DPHeader({ user, onLoginClick, onLogout, isFirstTime }){
    const onAnchorClick = (id) => (e) => {
      e.preventDefault();
      const el = document.getElementById(id);
      if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return React.createElement('header', { className: 'dp-header' },
      // Лого = «домой» (на лендинг) — единая конвенция со всеми страницами.
      React.createElement('a', { href: 'start.html', className: 'ynav-home dp-header-home', title: 'На главную — лендинг Ясны' },
        React.createElement('span', { className: 'ynav-mark', 'aria-hidden': 'true' }, '✦'),
        React.createElement('span', { className: 'ynav-name' }, 'Ясна')
      ),
      // Свитчер разделов (Вариант B) — «Игра» активна.
      React.createElement('nav', { className: 'ynav-links dp-switch', style: { flex: '0 1 auto' }, 'aria-label': 'Разделы' },
        React.createElement('a', { className: 'ynav-item', href: 'index.html' }, 'Конструктор'),
        React.createElement('a', { className: 'ynav-item is-active', href: 'duel.html' }, 'Игра', React.createElement('span', { className: 'ynav-new' }, 'NEW')),
        React.createElement('a', { className: 'ynav-item', href: 'learn.html' }, 'Обучение'),
        React.createElement('a', { className: 'ynav-item', href: 'rating.html' }, 'Рейтинг')
      ),
      React.createElement('div', { className: 'dp-header-spacer' }),
      React.createElement('nav', { className: 'dp-header-nav' },
        // «Рейтинг» переехал в общий свитчер разделов (см. .dp-switch выше).
        // Якорные ссылки ведут на секции главного экрана (#hronika/#zhurnal/#znaki).
        // На приветственном экране (первый визит) этих секций нет — без условия
        // ссылки были бы «мёртвыми» (клик ничего не делает). Показываем их только
        // когда отрисован главный экран (вернувшийся игрок / после онбординга).
        !isFirstTime && React.createElement('a', { href: '#hronika', onClick: onAnchorClick('hronika') }, 'Топ недели'),
        !isFirstTime && React.createElement('a', { href: '#zhurnal', onClick: onAnchorClick('zhurnal') }, 'Журнал'),
        !isFirstTime && React.createElement('a', { href: '#znaki', onClick: onAnchorClick('znaki') }, 'Достижения'),
        React.createElement('div', { className: 'dp-header-auth' },
          user
            ? React.createElement('button', { className: 'dp-btn-text', onClick: onLogout }, 'Выйти')
            : React.createElement('button', {
                className: 'dp-btn dp-btn-primary',
                onClick: onLoginClick,
                style: { padding: '8px 16px', fontSize: 13 }
              }, 'Войти')
        )
      )
    );
  }

  // ─── Hero CTA — крупные кнопки «играть прямо сейчас» (только Dark) ─
  // Видно сразу под H1, до карточки профиля. Цель — чтобы первое
  // намерение «как сыграть» решалось одним кликом.
  function DPHeroCTA({ onPartiya, onUzor }){
    return React.createElement('div', { className: 'vk-scheme-block dp-hero-cta-row' },
      React.createElement('button', {
        className: 'dp-hero-cta-btn dp-hero-cta-btn--primary',
        onClick: onPartiya,
        type: 'button',
        'aria-label': 'Начать партию'
      },
        React.createElement('span', { className: 'dp-hero-cta-icon', 'aria-hidden': 'true' }, '▶'),
        React.createElement('span', { className: 'dp-hero-cta-body' },
          React.createElement('span', { className: 'dp-hero-cta-title' }, 'Играть Партию'),
          React.createElement('span', { className: 'dp-hero-cta-sub' }, 'Выбор: Блиц 10 · Стандарт 18 · Эксперт 30')
        )
      ),
      React.createElement('button', {
        className: 'dp-hero-cta-btn dp-hero-cta-btn--ghost',
        onClick: onUzor,
        type: 'button',
        disabled: true,
        title: 'Игра в разработке'
      },
        React.createElement('span', { className: 'dp-hero-cta-icon', 'aria-hidden': 'true' }, '◷'),
        React.createElement('span', { className: 'dp-hero-cta-body' },
          React.createElement('span', { className: 'dp-hero-cta-title' }, 'Расклад'),
          React.createElement('span', { className: 'dp-hero-cta-sub' }, 'PvP · скоро')
        )
      )
    );
  }

  // ─── Headline на главной ─────────────────────────────────────────
  function DPCastaliaTitle(){
    return React.createElement('div', { className: 'dp-castalia-title' },
      React.createElement('div', { className: 'dp-castalia-eyebrow' }, '✦  Тренажёр Ясны'),
      React.createElement('h1', { className: 'dp-castalia-h1' },
        React.createElement('span', null, 'Ясна —'),
        React.createElement('br'),
        React.createElement('span', null, 'мастерство в игре.')
      )
    );
  }

  // ─── Welcome (первый визит) ──────────────────────────────────────
  function DPWelcome({ onLoginClick, onAnonStart }){
    return React.createElement('section', { className: 'dp-welcome', id: 'main', role: 'region', 'aria-label': 'Приветствие' },
      React.createElement('div', { className: 'dp-welcome-eyebrow' }, '✦  Тренажёр Ясны'),
      React.createElement('h1', { className: 'dp-welcome-title' }, 'Ясна —', React.createElement('br'), 'мастерство в игре.'),
      React.createElement('p', { className: 'dp-welcome-sub' },
        'Учись модели Ясны Суток через игровые партии. 9 тем · 124 вопроса · 5 типов заданий. Выбираешь длину (Блиц 10 / Стандарт 18 / Эксперт 30) и соперника — Тень или живой друг по ссылке. За верный ответ — 10 бусин, до +5 за скорость, серия из 3+ верных даёт множитель.'
      ),
      React.createElement('div', { className: 'dp-welcome-actions' },
        React.createElement('button', { className: 'dp-btn dp-btn-cta', onClick: onLoginClick }, 'Войти через Telegram'),
        React.createElement('button', { className: 'dp-btn dp-btn-ghost', onClick: onAnonStart }, 'Сыграть гостем')
      ),
      React.createElement('div', { className: 'dp-welcome-pillars' },
        React.createElement('div', { className: 'dp-welcome-pillar' },
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, '◷  Партия'),
          React.createElement('div', { className: 'dp-welcome-pillar-text' }, '18 вопросов · 6 тем · около 5 минут')
        ),
        React.createElement('div', { className: 'dp-welcome-pillar' },
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, '◐  Соперник'),
          React.createElement('div', { className: 'dp-welcome-pillar-text' }, 'Бот-соперник или живой друг в реальном времени')
        ),
        React.createElement('div', { className: 'dp-welcome-pillar' },
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, '✦  Бусины'),
          React.createElement('div', { className: 'dp-welcome-pillar-text' }, '10 за верный ответ, +5 за быстрый. Хроника недели — топ игроков')
        )
      )
    );
  }

  // ─── Profile-Hero (упрощённый — 4 блока) ─────────────────────────
  function DPProfileHero({ user, profile, onLoginClick, remoteProfile }){
    const me = user || profile;
    const isGuest = !user;
    const localBusey = totalBusey();
    // Серверные данные перекрывают локальные если их больше
    // (например, пользователь играл с другого устройства).
    const remoteBusey = remoteProfile?.totalBusey || 0;
    const busey = Math.max(localBusey, remoteBusey);
    const stupen = getStupen(busey);
    const pct = stupen.to === Infinity ? 100 :
      Math.min(100, ((busey - stupen.from) / (stupen.to - stupen.from)) * 100);
    const Storage = _g('YasnaDuelStorage');
    const data = Storage?.getOverallStats?.() || {};
    const localGames = data.totals?.matches || data.totals?.played || 0;
    const remoteGames = remoteProfile?.totalMatches || 0;
    const games = Math.max(localGames, remoteGames);

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
          React.createElement('a', {
            className: 'dp-hero-rank-pill dp-tip',
            href: 'rating.html',
            'data-tip': 'Ступень — твой уровень в Ясне. Растёт с каждой партией. Нажми, чтобы узнать про шкалы прогресса.',
            style: { textDecoration: 'none' },
          }, stupen.name, ' ', toRoman(stupen.subLevel))
        ),
        React.createElement('div', { className: 'dp-hero-stats' },
          React.createElement('a', {
            className: 'dp-hero-bead dp-tip',
            href: 'rating.html',
            'data-tip': 'Бусины ✦ — очки за партии. Нажми, чтобы узнать, как считается рейтинг.',
            style: { textDecoration: 'none' },
          }, '✦ ', busey),
          React.createElement('span', { className: 'dp-hero-stats-sep' }, '·'),
          React.createElement('span', null, games, ' ', Term('партий', 'Партия — викторина из 10/18/30 вопросов на темы Ясны. Блиц ~2 мин · Стандарт ~5 мин · Эксперт ~9 мин.'))
        ),
        React.createElement('div', { className: 'dp-hero-progress', 'aria-label': 'Прогресс ступени' },
          React.createElement('div', { className: 'dp-hero-progress-fill', style: { width: pct + '%' } })
        ),
        nextStupenLabel && React.createElement('div', { style: { fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontVariantNumeric: 'tabular-nums' } }, nextStupenLabel)
      ),
      isGuest && React.createElement('button', { className: 'dp-hero-cta', onClick: onLoginClick, title: 'Войди — попадёшь в Хронику' }, 'Войти →'),
      !isGuest && remoteProfile && React.createElement('div', {
        className: 'dp-hero-synced',
        title: 'Прогресс синхронизирован через Telegram-аккаунт'
      }, '✓ синхр.')
    );
  }

  // ─── Sync Notice — где хранится прогресс ─────────────────────────
  // Видна только гостям (без Telegram-логина) и пока не закрыта.
  // Объясняет где хранится прогресс и зачем входить через Telegram.
  function DPSyncNotice({ user, onLoginClick }){
    const [dismissed, setDismissed] = useState(() => {
      try { return localStorage.getItem('yasna_sync_notice_dismissed') === '1'; }
      catch(_){ return false; }
    });
    if(user) return null;       // авторизованным не нужно
    if(dismissed) return null;  // закрыли вручную
    const dismiss = () => {
      try { localStorage.setItem('yasna_sync_notice_dismissed', '1'); } catch(_){}
      setDismissed(true);
    };
    return React.createElement(React.Fragment, null,
      // ─── Light: оригинальный плашка-уведомление ───
      React.createElement('div', { className: 'dp-sync-notice vk-light-only', role: 'note' },
        React.createElement('div', { className: 'dp-sync-notice-icon', 'aria-hidden': 'true' }, '◷'),
        React.createElement('div', { className: 'dp-sync-notice-body' },
          React.createElement('div', { className: 'dp-sync-notice-title' }, 'Прогресс хранится в этом браузере'),
          React.createElement('div', { className: 'dp-sync-notice-text' },
            'Бусины, серии и история партий — здесь, локально. Очистишь кеш или сменишь устройство — потеряешь.',
            React.createElement('br'),
            'Войди через Telegram, чтобы прогресс жил между устройствами.'
          )
        ),
        React.createElement('div', { className: 'dp-sync-notice-actions' },
          React.createElement('button', { className: 'dp-sync-notice-cta', onClick: onLoginClick, type: 'button' }, 'Войти'),
          React.createElement('button', { className: 'dp-sync-notice-x', onClick: dismiss, type: 'button', 'aria-label': 'Закрыть' }, '×')
        )
      )
    );
  }

  // ─── Tooltip: «Как проходит Партия» — popover вместо большого блока ─
  // Trigger — маленькая «(i)» кнопка в инлайне с описанием. Контент тот же
  // 5 шагов, но компактнее и не занимает место постоянно.
  // Закрывается по клику вне, по Escape или по повторному клику trigger.
  function DPPartiyaHowTooltip(){
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      if(!open) return;
      const onDocClick = (e) => {
        if(ref.current && !ref.current.contains(e.target)) setOpen(false);
      };
      const onKey = (e) => { if(e.key === 'Escape') setOpen(false); };
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('mousedown', onDocClick);
        document.removeEventListener('keydown', onKey);
      };
    }, [open]);

    const STEPS = [
      ['01', 'Выбор длительности и тем', '10 / 18 / 30 вопросов · все темы или узкий набор'],
      ['02', 'Соперник — Тень или друг', 'Бот разной силы или живой собеседник по ссылке-комнате'],
      ['03', '4 типа вопросов · таймер', 'Выбор из 4 · «верно/нет» · несколько верных · соедини пары'],
      ['04', 'Бусины · streak ×1.2 … ×2.0', '+10 за верный, до +5 за скорость. 3/5/7 верных подряд — множитель'],
      ['05', 'Финал · разбор с цитатами', 'Каждая ошибка — с цитатой из книги. Партитура освоения растёт'],
    ];

    return React.createElement('span', { ref, className: 'dp-howto', style: { position:'relative', display:'inline-block' } },
      React.createElement('button', {
        type: 'button',
        className: 'dp-howto-trigger',
        onClick: () => setOpen(o => !o),
        'aria-expanded': open,
        'aria-label': 'Как проходит Партия',
        title: 'Как проходит Партия',
      }, 'i'),
      open && React.createElement('div', { className: 'dp-howto-popover', role: 'dialog', 'aria-label': 'Как проходит Партия' },
        React.createElement('div', { className: 'dp-howto-arrow', 'aria-hidden': 'true' }),
        React.createElement('div', { className: 'dp-howto-head' },
          React.createElement('h3', { className: 'dp-howto-title' }, 'Как проходит одна Партия'),
          React.createElement('span', { className: 'dp-howto-tag' }, 'Блиц / Стандарт / Эксперт')
        ),
        React.createElement('ol', { className: 'dp-howto-steps' },
          STEPS.map(([num, title, text]) =>
            React.createElement('li', { key: num, className: 'dp-howto-step' },
              React.createElement('div', { className: 'dp-howto-num' }, num),
              React.createElement('div', { className: 'dp-howto-desc' },
                React.createElement('div', { className: 'dp-howto-desc-title' }, title),
                React.createElement('div', { className: 'dp-howto-desc-text' }, text)
              )
            )
          )
        )
      )
    );
  }

  // ─── Главный ритуал · 2 игры ─────────────────────────────────────
  // Header: только заголовок (без eyebrow «Игры Ясны» — мы уже на странице
  // /duel, это контекст). Описание убрано из header'а — оно теперь в
  // tooltip'ах внутри каждой карточки рядом с её названием.
  function DPMainGames({ onPartiya, onUzor }){
    return React.createElement('section', { className: 'dp-section', role: 'region', 'aria-label': 'Игровые практики' },
      React.createElement('div', { style: { marginBottom: 'var(--space-5)' } },
        React.createElement('h2', { className: 'dp-section-h', style: { fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.005em' } },
          'Игровые практики'
        )
      ),
      React.createElement('div', { className: 'dp-games-grid' },
        React.createElement('div', { className: 'dp-game-card dp-game-primary' },
          React.createElement('div', { className: 'dp-game-eyebrow' }, '✦  Доступна · ~5 минут'),
          React.createElement('div', { className: 'dp-game-title-row' },
            React.createElement('div', { className: 'dp-game-title' }, 'Партия'),
            React.createElement(DPPartiyaHowTooltip, null)
          ),
          React.createElement('div', { className: 'dp-game-sub' },
            'Викторина по темам Ясны. Выбираешь длительность и темы — играешь против Тени или с другом.'
          ),
          React.createElement('ul', { className: 'dp-game-bullets' },
            React.createElement('li', null, '10 · 18 · 30 вопросов на выбор'),
            React.createElement('li', null, '4 формата: выбор из 4 · верно/нет · несколько верных · соедини пары'),
            React.createElement('li', null, 'В финале — разбор ошибок с цитатами из книги')
          ),
          // ─── Две CTA-кнопки: Соло (с Тенью) или PvP (с другом по ссылке) ───
          React.createElement('div', { className: 'dp-cta-row' },
            React.createElement('button', {
              type: 'button',
              className: 'dp-cta dp-cta--solo',
              onClick: (e) => { e.stopPropagation(); onPartiya('shadow'); },
              'aria-label': 'Играть соло с Тенью',
            },
              React.createElement('span', { className: 'dp-cta__icon', 'aria-hidden': 'true' },
                React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
                  React.createElement('circle', { cx: 12, cy: 8, r: 3.5 }),
                  React.createElement('path', { d: 'M5 21c0-3.866 3.134-7 7-7s7 3.134 7 7' })
                )
              ),
              React.createElement('span', { className: 'dp-cta__body' },
                React.createElement('span', { className: 'dp-cta__title' }, 'Играть соло'),
                React.createElement('span', { className: 'dp-cta__sub' }, 'против Тени')
              )
            ),
            React.createElement('button', {
              type: 'button',
              className: 'dp-cta dp-cta--pvp',
              onClick: (e) => { e.stopPropagation(); onPartiya('pvp'); },
              'aria-label': 'Играть вдвоём по ссылке',
            },
              React.createElement('span', { className: 'dp-cta__icon', 'aria-hidden': 'true' },
                React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
                  React.createElement('circle', { cx: 8, cy: 9, r: 3 }),
                  React.createElement('circle', { cx: 17, cy: 10, r: 2.5 }),
                  React.createElement('path', { d: 'M2 20c0-3.314 2.686-6 6-6s6 2.686 6 6' }),
                  React.createElement('path', { d: 'M14 20c.4-2.4 2.4-4.2 4.8-4.2s4.4 1.8 4.8 4.2' })
                )
              ),
              React.createElement('span', { className: 'dp-cta__body' },
                React.createElement('span', { className: 'dp-cta__title' }, 'С другом'),
                React.createElement('span', { className: 'dp-cta__sub' }, 'по ссылке-комнате')
              ),
              React.createElement('span', { className: 'dp-cta__badge', 'aria-hidden': 'true' }, '✦')
            )
          )
        ),
        React.createElement('button', { className: 'dp-game-card dp-game-soon', onClick: onUzor, disabled: true, style: { opacity: 0.6, cursor: 'not-allowed' } },
          React.createElement('div', { className: 'dp-game-eyebrow' }, '◷  В разработке'),
          React.createElement('div', { className: 'dp-game-title-row' },
            React.createElement('div', { className: 'dp-game-title' }, 'Расклад')
          ),
          React.createElement('div', { className: 'dp-game-sub' },
            'Гонка против соперника: разложить 12 элементов по своим местам быстрее.'
          ),
          React.createElement('ul', { className: 'dp-game-bullets' },
            React.createElement('li', null, '12 полок Ясны — твоё игровое поле'),
            React.createElement('li', null, 'Кто первый правильно соберёт — победил'),
            React.createElement('li', null, 'Только PvP · скоро')
          ),
          React.createElement('div', { className: 'dp-game-meta' },
            React.createElement('span', { className: 'dp-game-meta-pvp' }, 'PvP · скоро')
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
        tag: 'Вызов дня',
        title: 'Один шанс в сутки',
        foot: todayPlayed ? 'Сыграно: ' + todayPlayed.score + ' ✦' : '+30 ✦ если справишься. Одна ошибка — проигрыш',
        footMute: !!todayPlayed,
        ready: true
      },
      {
        id: 'gimn',
        tag: 'Тема дня',
        title: (todayTheme?.name || 'Тема готовится'),
        foot: '3 вопроса по этой теме · откроется в полночь',
        footMute: true,
        ready: false
      },
    ];

    return React.createElement('section', { className: 'dp-section' },
      React.createElement('div', { className: 'dp-section-h-row' },
        React.createElement('h2', { className: 'dp-section-h' }, IconCalendar(), ' Сегодня'),
        React.createElement('span', { className: 'dp-section-h-sub' }, quests.filter(q => q.ready).length + ' доступно · ' + (quests.length - quests.filter(q => q.ready).length) + ' в подготовке')
      ),
      React.createElement('p', { className: 'dp-section-desc' },
        'Ежедневные короткие практики (3 вопроса, не больше минуты).'
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
    const isFresh = opened === 0;

    // Текущая тема — та, что максимально освоена но < 100, либо первая открытая.
    const sortedByMastery = themes.map(t => ({ ...t, pct: masteryByTheme[t.id] || 0 })).sort((a, b) => b.pct - a.pct);
    const currentTheme = sortedByMastery.find(t => t.pct > 0 && t.pct < 100) || sortedByMastery[0];

    return React.createElement('section', { className: 'dp-section', role: 'region', 'aria-label': 'Освоение тем' },
      React.createElement('div', { className: 'dp-section-h-row' },
        React.createElement('h2', { className: 'dp-section-h' }, IconGrid(), ' Освоение тем'),
        React.createElement('span', { className: 'dp-section-h-sub' },
          isFresh ? 'Сыграй первую Партию' : ('Открыто ' + opened + ' из ' + themes.length))
      ),
      React.createElement('p', { className: 'dp-section-desc' },
        isFresh
          ? 'Карта 9 тем модели Ясны Суток. Темы открываются по мере того, как ты отвечаешь на их вопросы в Партиях. Чем чаще тема выпадает и чем больше верных ответов — тем выше мастерство.'
          : '9 тем модели «Сутки». Мастерство по теме растёт от верных ответов в Партиях. Чем чаще тема выпадала — тем шире прогресс.'
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
          Term('Топ недели', 'Лидерборд — кто заработал больше бусин за эту неделю. Обнуляется в субботу 23:59.')
        ),
        React.createElement('span', { className: 'dp-card-meta' }, 'Сб 23:59')
      ),
      items === null
        ? React.createElement('div', { className: 'dp-card-empty' }, 'Пока пусто. Сыграй Партию.')
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
        React.createElement('h3', null, IconStar(), ' Достижения'),
        React.createElement('span', { className: 'dp-card-meta' }, '0 / 0')
      ),
      React.createElement('div', { className: 'dp-card-empty' }, 'Пока пусто. Сыграй Партию.')
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
          Term('Достижения', 'Знаки за упорство — серии партий, точные ответы, победы над Тенью разной сложности.')
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
        const opp = m.transport === 'peerjs' || m.transport === 'broadcast' ? 'другом' : 'Тенью';
        return 'Партия с ' + opp;
      }
      if(m.gameId?.startsWith('race-')) return 'Тренировка · ' + m.gameId.replace('race-', '');
      if(m.gameId === 'mirror-fill') return 'Расклад';
      return m.gameId || 'Игра';
    }

    function fmtAccuracy(m){
      // Если score есть и это turnir — попробуем оценить точность
      if(m.gameId !== 'turnir' || m.score == null || m.maxScore == null) return null;
      // 18 вопросов × 15 max = 270. Точность примерно: правильных = score / ~12.5
      // Грубая оценка: правильных ≈ score / 12 (10-15 бусин за верный)
      const approxCorrect = Math.round(m.score / 12);
      const totalQ = 18;
      return Math.min(approxCorrect, totalQ) + '/' + totalQ + ' верных';
    }

    function fmtResult(m){
      if(m.result === 'win')  return 'Победа';
      if(m.result === 'loss') return 'Поражение';
      if(m.result === 'draw') return 'Ничья';
      return null;
    }

    return React.createElement('div', { className: 'dp-card', id: 'zhurnal' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, IconJournal(), ' ', Term('Журнал', 'История твоих последних партий — соперник, счёт, точность.')),
        React.createElement('span', { className: 'dp-card-meta' }, matches.length > 0 ? matches.length + ' последних' : '')
      ),
      matches.length === 0
        ? React.createElement('div', { className: 'dp-card-empty' }, 'Партий ещё не было.', React.createElement('br'), 'Начни — здесь появится первая запись.')
        : React.createElement(React.Fragment, null,
            matches.map((m, i) => {
              const acc = fmtAccuracy(m);
              const res = fmtResult(m);
              return React.createElement('div', { key: m.id || i, className: 'dp-journal-row' },
                React.createElement('span', { className: 'dp-journal-when' }, fmtWhen(m.date)),
                React.createElement('span', { className: 'dp-journal-name' },
                  fmtMatchName(m),
                  acc && React.createElement('span', { className: 'dp-journal-acc' }, ' · ', acc),
                  res && React.createElement('span', { className: 'dp-journal-res ' + (m.result === 'win' ? 'dp-journal-res-win' : m.result === 'draw' ? 'dp-journal-res-draw' : 'dp-journal-res-loss') }, ' · ', res)
                ),
                React.createElement('span', {
                  className: 'dp-journal-result ' + (m.result === 'win' ? 'dp-journal-win' : 'dp-journal-loss')
                }, m.result === 'win' ? '+ ' : '', m.score != null ? m.score + ' ✦' : '—')
              );
            })
          )
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // REAL-TIME LOBBY · PvP через Yandex Cloud Polling-relay
  //
  // Архитектура (надёжная — работает через любой NAT, corp WiFi, VPN):
  // 1. POST /rooms/create  → получить roomId + code
  // 2. POST /rooms/join    → присоединиться по code
  // 3. POST /rooms/send    → отправить сообщение
  // 4. GET  /rooms/poll    → получить сообщения соперника (раз в ~500ms)
  //
  // Latency ~500-700ms — достаточно для пошаговой Партии (feedback 1500ms).
  //
  // Существующий PeerJS-код оставлен ниже (не используется в production)
  // как референс для будущей P2P-оптимизации Узора.
  // ═══════════════════════════════════════════════════════════════════

  // ─── Polling Transport — основной транспорт ─────────────────────
  // Совместим по API с PeerJS-transport (send / on / close).
  function makePollingTransport({ roomId, deviceId, role, apiUrl }){
    const handlers = new Set();
    let lastTs = 0;
    let pollTimer = null;
    let stopped = false;

    async function poll(){
      if(stopped) return;
      try {
        const url = apiUrl + '/rooms/poll?roomId=' + encodeURIComponent(roomId)
                  + '&deviceId=' + encodeURIComponent(deviceId)
                  + '&since=' + lastTs;
        const r = await fetch(url, { method: 'GET' });
        if(!r.ok){
          console.warn('[polling] poll failed', r.status);
        } else {
          const data = await r.json();
          const msgs = data?.messages || [];
          for(const m of msgs){
            if(m.ts > lastTs) lastTs = m.ts;
            // Воссоздаём «PeerJS-style» сообщение: type + payload поля
            const reconstructed = Object.assign({ t: m.type }, m.payload || {});
            handlers.forEach(fn => { try { fn(reconstructed); } catch(_){} });
          }
          // Если room.status === 'closed' — уведомляем
          if(data?.room?.status === 'closed'){
            handlers.forEach(fn => { try { fn({ t: 'opp-leave' }); } catch(_){} });
            stopped = true;
          }
        }
      } catch(e){
        console.warn('[polling] poll error', e?.message || e);
      }
      if(!stopped){
        pollTimer = setTimeout(poll, 500);
      }
    }

    // Старт цикла polling
    poll();

    return {
      role,
      async send(msg){
        if(stopped) return;
        // PeerJS-style msg = { t: 'partiya-init', ...payload }.
        // Преобразуем в формат сервера: { type, payload }
        const { t, ...rest } = msg || {};
        try {
          await fetch(apiUrl + '/rooms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId, deviceId,
              type: t || 'unknown',
              payload: Object.keys(rest).length > 0 ? rest : null,
            }),
          });
        } catch(e){
          console.warn('[polling] send error', e?.message || e);
        }
      },
      on(fn){ handlers.add(fn); return () => handlers.delete(fn); },
      close(){
        stopped = true;
        if(pollTimer){ clearTimeout(pollTimer); pollTimer = null; }
        // Уведомить сервер что мы вышли
        try {
          fetch(apiUrl + '/rooms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, deviceId, type: 'leave', payload: null }),
            keepalive: true,
          });
        } catch(_){}
      },
      startHeartbeat(){ /* polling сам и есть heartbeat */ },
    };
  }

  // ─── Lobby UI · использует polling-transport ─────────────────────
  function DPLobbyV2({ onClose, profile, onConnected, initialMode, initialCode, onNeedNickname }){
    const [mode, setMode] = useState(initialMode || 'choose');
    const [roomCode, setRoomCode] = useState('');
    const [roomId, setRoomId] = useState('');
    const [inputCode, setInputCode] = useState(initialCode || '');
    const [error, setError] = useState(null);
    const [statusText, setStatusText] = useState('Жду собеседника…');
    const transportRef = useRef(null);
    const waitingPollTimer = useRef(null);
    const me = profile;

    const apiUrl = window.YASNA_LEADERBOARD_API || '';

    function cleanup(){
      if(waitingPollTimer.current){ clearTimeout(waitingPollTimer.current); waitingPollTimer.current = null; }
      try { transportRef.current?.close?.(); } catch(_){}
      transportRef.current = null;
    }
    useEffect(() => () => cleanup(), []);

    useEffect(() => {
      if(initialMode === 'guest' && initialCode){
        setTimeout(() => doJoin(initialCode), 100);
      }
    }, []);

    // Хост: создать комнату через Firebase RTDB и ждать гостя
    async function doCreate(){
      if(!window.YasnaRT){
        setError('Real-time транспорт не загрузился. Обнови страницу.');
        setMode('error');
        return;
      }
      if(!me?.deviceId || !me?.nickname){
        if(onNeedNickname){ onNeedNickname(); return; }  // открыть онбординг ника, не тупик
        setError('Сначала укажи никнейм.');
        setMode('error');
        return;
      }
      setMode('host');
      setStatusText('Создаю комнату…');
      setError(null);
      console.log('[lobby/create] requesting...');

      try {
        const { code } = await window.YasnaRT.createRoom({
          deviceId: me.deviceId,
          nickname: me.nickname,
          avatar: me.avatar || null,
        });
        console.log('[lobby/create] room created', code);
        setRoomCode(code);
        setRoomId(code);
        setStatusText('Жду собеседника…');

        // Ждём гостя — Firebase сам пушнёт когда guest появится
        try {
          const guest = await window.YasnaRT.waitForGuest(code, { timeoutMs: 5 * 60 * 1000 });
          console.log('[lobby/create] guest joined', guest);
          const transport = window.YasnaRT.makeTransport({
            code, deviceId: me.deviceId, role: 'host',
          });
          // ВАЖНО: НЕ кладём в transportRef — иначе cleanup() при unmount
          // закроет Firebase listener до того как TurnirGame успеет
          // зарегистрировать handler. Транспорт теперь принадлежит TurnirGame.
          onConnected({
            transport, role: 'host', roomCode: code,
            opponent: { nickname: guest.nickname, avatar: guest.avatar || '◐', isPvP: true }
          });
        } catch(e){
          if(e.message === 'timeout'){
            setError('Никто не пришёл за 5 минут. Создай новую комнату.');
          } else if(e.message === 'closed'){
            setError('Комната закрыта.');
          } else {
            setError('Ошибка ожидания: ' + e.message);
          }
          setMode('error');
        }
      } catch(e){
        console.error('[lobby/create] exception', e);
        setError('Ошибка создания комнаты: ' + e.message);
        setMode('error');
      }
    }

    async function doJoin(codeOverride){
      const code = (codeOverride || inputCode).trim().toUpperCase();
      if(!/^KASTA-[A-Z0-9]{4}$/.test(code)){
        setError('Код должен быть в формате KASTA-XXXX');
        return;
      }
      if(!window.YasnaRT){
        setError('Real-time транспорт не загрузился. Обнови страницу.');
        setMode('error');
        return;
      }
      if(!me?.deviceId || !me?.nickname){
        if(onNeedNickname){ onNeedNickname(); return; }  // открыть онбординг ника, не тупик
        setError('Сначала укажи никнейм.');
        setMode('error');
        return;
      }
      setInputCode(code);
      setMode('waiting');
      setStatusText('Подключаюсь к ' + code + '…');
      setError(null);
      console.log('[lobby/join] requesting', code);

      try {
        const { host } = await window.YasnaRT.joinRoom(code, {
          deviceId: me.deviceId,
          nickname: me.nickname,
          avatar: me.avatar || null,
        });
        console.log('[lobby/join] joined', code, 'host:', host);
        const transport = window.YasnaRT.makeTransport({
          code, deviceId: me.deviceId, role: 'guest',
        });
        // ВАЖНО: НЕ кладём в transportRef — иначе cleanup() при unmount
        // закроет Firebase listener до того как TurnirGame успеет
        // зарегистрировать handler. Транспорт теперь принадлежит TurnirGame.
        onConnected({
          transport, role: 'guest', roomCode: code,
          opponent: { nickname: host?.nickname || 'Хозяин', avatar: host?.avatar || '◑', isPvP: true }
        });
      } catch(e){
        console.error('[lobby/join] exception', e);
        if(e.message === 'not_found'){
          setError('Комната не найдена. Проверь код или попроси создать новую.');
        } else if(e.message === 'room_full'){
          setError('В комнате уже два игрока. Попроси создать новую.');
        } else if(e.message === 'closed'){
          setError('Комната закрыта. Попроси создать новую.');
        } else if(e.message === 'cant_join_own_room'){
          setError('Нельзя войти в свою же комнату. Открой ссылку с другого устройства.');
        } else if(e.message === 'invalid_code_format'){
          setError('Код должен быть в формате KASTA-XXXX');
        } else {
          setError('Ошибка подключения: ' + e.message);
        }
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
        prompt('Скопируй ссылку:', link);
      }
    }

    return React.createElement('div', { className: 'dp-lobby-overlay', onClick: e => { if(e.target === e.currentTarget) onClose(); } },
      React.createElement('div', { className: 'dp-lobby', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lobby-h' },
        React.createElement('button', { className: 'dp-lobby-x', onClick: onClose, 'aria-label': 'Закрыть' }, '×'),
        React.createElement('div', { className: 'dp-lobby-eyebrow' }, '✦  Партия вдвоём'),
        React.createElement('h2', { id: 'lobby-h' }, 'Партия для двоих'),

        mode === 'choose' && React.createElement(React.Fragment, null,
          React.createElement('p', { className: 'dp-lobby-sub' },
            'Создай комнату и поделись кодом · или войди по коду собеседника.'
          ),
          React.createElement('div', { className: 'dp-lobby-options' },
            React.createElement('button', { className: 'dp-lobby-opt', onClick: doCreate },
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
          roomCode ? React.createElement(React.Fragment, null,
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
          ) : React.createElement('div', { className: 'dp-lobby-status' },
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
            onKeyDown: e => { if(e.key === 'Enter') doJoin(); }
          }),
          React.createElement('button', {
            className: 'dp-btn dp-btn-cta',
            onClick: () => doJoin(),
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


  // ═══════════════════════════════════════════════════════════════════
  // ─── DEPRECATED · PeerJS Lobby (оставлен как референс)
  // Не используется в production — слишком много NAT-ошибок.
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
        React.createElement('h2', { id: 'lobby-h' }, 'Партия для двоих'),

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
    const [phase, setPhase] = useState('idle'); // idle | loading | success | error
    const [error, setError] = useState(null);
    const [welcomeName, setWelcomeName] = useState('');
    const baseUrl = window.YASNA_LEADERBOARD_API;
    const botUsername = window.YASNA_TG_BOT;
    useEffect(() => {
      window.onTelegramAuth = async (tgUser) => {
        setPhase('loading'); setError(null);
        const res = await _g('YasnaDuelAuth').loginWithTelegram(tgUser);
        if(res.ok){
          setWelcomeName(res.user?.nickname || res.user?.first_name || 'игрок');
          setPhase('success');
          // Закрываем после короткой "приветственной" паузы
          setTimeout(() => onLoggedIn(res.user), 1400);
        } else {
          setPhase('error');
          setError(res.error || 'Не удалось войти');
        }
      };
      return () => { delete window.onTelegramAuth; };
    }, []);

    return React.createElement('div', {
      className: 'dp-auth-overlay',
      onClick: e => { if(e.target === e.currentTarget && phase !== 'loading' && phase !== 'success') onClose(); }
    },
      React.createElement('div', { className: 'dp-auth-modal', role: 'dialog', 'aria-modal': 'true' },
        phase !== 'success' && phase !== 'loading' && React.createElement('button', { className: 'dp-auth-x', onClick: onClose, 'aria-label': 'Закрыть' }, '×'),

        // ─── Состояние успеха: «Привет, X. Прогресс синхронизирован.» ───
        phase === 'success' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'dp-auth-success-icon', 'aria-hidden': 'true' }, '✦'),
          React.createElement('h2', { className: 'dp-auth-success-title' }, 'Привет, ', welcomeName, '.'),
          React.createElement('p', { className: 'dp-auth-success-text' }, 'Прогресс синхронизирован. Партии с других устройств подтянутся автоматически.')
        ),

        // ─── Idle / loading / error ───
        phase !== 'success' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'dp-auth-eyebrow' }, '✦  Войти'),
          React.createElement('h2', null, 'Сохрани прогресс между устройствами'),
          React.createElement('p', null,
            'Войди через Telegram. Бусины, серии и история партий будут жить с твоим аккаунтом.'),

          // ─── Light: оригинальный список перков ───
          React.createElement('ul', { className: 'dp-auth-perks vk-light-only' },
            React.createElement('li', null, 'Партии с любого устройства — общий счёт'),
            React.createElement('li', null, 'Без паролей. Только имя и аватар из Telegram'),
            React.createElement('li', null, 'Гостевой прогресс сохранится — при логине он добавится к твоему')
          ),
          // ─── Dark: VK-Scheme — как работает синхронизация ───
          React.createElement('div', { className: 'vk-scheme-block' },
            React.createElement('div', { className: 'vk-scheme' },
              React.createElement('div', { className: 'vk-scheme-canvas' },
                React.createElement('div', { className: 'vk-scheme-header' },
                  React.createElement('h3', { className: 'vk-scheme-header-title' }, 'Что даёт вход через Telegram')
                ),
                React.createElement('ol', { className: 'vk-scheme-steps' },
                  React.createElement('li', { className: 'vk-scheme-step' },
                    React.createElement('div', { className: 'vk-scheme-num' },
                      React.createElement('div', { className: 'vk-scheme-num-inner' }, '01')
                    ),
                    React.createElement('div', { className: 'vk-scheme-desc' },
                      React.createElement('div', { className: 'vk-scheme-desc-title' }, 'Общий счёт между устройствами'),
                      React.createElement('div', { className: 'vk-scheme-desc-text' }, 'Бусины и серии живут с твоим аккаунтом, а не с браузером')
                    )
                  ),
                  React.createElement('li', { className: 'vk-scheme-step' },
                    React.createElement('div', { className: 'vk-scheme-num' },
                      React.createElement('div', { className: 'vk-scheme-num-inner' }, '02')
                    ),
                    React.createElement('div', { className: 'vk-scheme-desc' },
                      React.createElement('div', { className: 'vk-scheme-desc-title' }, 'Без паролей'),
                      React.createElement('div', { className: 'vk-scheme-desc-text' }, 'Берём только имя и аватар из Telegram. Сообщения нам недоступны')
                    )
                  ),
                  React.createElement('li', { className: 'vk-scheme-step' },
                    React.createElement('div', { className: 'vk-scheme-num' },
                      React.createElement('div', { className: 'vk-scheme-num-inner' }, '03')
                    ),
                    React.createElement('div', { className: 'vk-scheme-desc' },
                      React.createElement('div', { className: 'vk-scheme-desc-title' }, 'Гостевой прогресс не теряется'),
                      React.createElement('div', { className: 'vk-scheme-desc-text' }, 'При логине бусины из этой сессии добавятся к твоему счёту')
                    )
                  )
                )
              )
            )
          ),

          !baseUrl
            ? VkSysMsg({ kind: 'error', icon: '⚠', title: 'Сервер временно недоступен', text: 'Зайди через несколько минут — мы уже чиним.' })
            : !botUsername
              ? VkSysMsg({ kind: 'error', icon: '⚙', title: 'Бот не настроен', text: 'Это превью-сборка. Авторизация через Telegram отключена.' })
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
          phase === 'loading' && VkSysMsg({ kind: 'info', icon: '◷', size: 's', text: 'Авторизация в Telegram…' }),
          error && VkSysMsg({ kind: 'error', icon: '⚠', title: 'Не получилось войти', text: error }),
          React.createElement('div', { className: 'dp-auth-foot' },
            'Передаём только Telegram-имя и фото. Личные сообщения нам недоступны.')
        )
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
    // lobby = { game, lobbyMode?: 'guest'|'host', code?, partiyaMode?: 'blitz'|'standard'|'expert', selectedThemes? }
    // lobbyMode — внутреннее состояние лобби (для url-room автогостем)
    // partiyaMode — длительность партии, передаётся в TurnirGame после connected
    const [lobby, setLobby] = useState(urlRoom ? { game: 'turnir', lobbyMode: 'guest', code: urlRoom } : null);
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

    // «Войти» из общего свитчера навигации ведёт на duel.html#login —
    // открываем окно авторизации сразу при наличии этого хэша (и при hashchange).
    useEffect(() => {
      const openIfLogin = () => { if (window.location.hash === '#login') setAuthModal(true); };
      openIfLogin();
      window.addEventListener('hashchange', openIfLogin);
      return () => window.removeEventListener('hashchange', openIfLogin);
    }, []);

    // ─── Remote profile sync ───────────────────────────────────────
    // При логине через Telegram (или при наличии deviceId для гостя)
    // дёргаем /profile и подмешиваем серверные данные в UI.
    // Если серверные значения больше — они становятся источником истины
    // (например пользователь играл с другого устройства).
    // НЕ перетираем localStorage агрессивно — UI берёт max(local, remote).
    const [remoteProfile, setRemoteProfile] = useState(null);
    useEffect(() => {
      const LB = _g('YasnaLeaderboardClient');
      if(!LB?.fetchProfile) return;
      const userId = user?.userId || user?.id || null;
      const deviceId = profile?.deviceId || null;
      if(!userId && !deviceId) return;
      let cancelled = false;
      LB.fetchProfile({ userId, deviceId, limit: 20 }).then(data => {
        if(cancelled || !data || data.ok === false) return;
        setRemoteProfile(data);
      }).catch(() => {});
      return () => { cancelled = true; };
    }, [user, profile?.deviceId]);

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
    // mode: 'blitz' | 'standard' | 'expert' — определяет длину партии
    // selectedThemes: null (все) или массив theme.id для кастом-выбора
    const startPartiyaWithShadow = (level, mode, selectedThemes) => {
      requireProfile(() => setGame({
        type: 'turnir',
        opponent: 'shadow',
        shadowLevel: level || 'medium',
        mode: mode || 'standard',
        selectedThemes: selectedThemes || null
      }));
    };

    // ─── Старт Партии · диалог выбора (длительность + темы + соперник) ───
    // partiyaPicker = null | { mode, expanded: bool, selectedThemes: Set<id>|null }
    const [partiyaPicker, setPartiyaPicker] = useState(null);

    // preferredOpponent: 'shadow' | 'pvp' | null — какая опция предвыделена.
    // По умолчанию выбрана ОДНА тема (первая) — пользователь сам расширяет.
    // Раньше было null (все темы) — это перегружало пул и игрок видел много
    // несвязанных тем. С одной темой опыт сфокусированнее: пришёл изучать
    // конкретное — играй на одной теме.
    const askPartiyaMode = (preferredOpponent) => {
      const allThemes = (window.YasnaTrivia && window.YasnaTrivia.getThemes && window.YasnaTrivia.getThemes()) || [];
      const firstTheme = allThemes[0]?.id;
      requireProfile(() => setPartiyaPicker({
        mode: 'standard',
        expanded: false,
        selectedThemes: firstTheme ? [firstTheme] : null,
        preferredOpponent: preferredOpponent || null,
      }));
    };

    const startPartiyaPvP = () => {
      const partiyaMode = partiyaPicker?.mode || 'standard';
      const selectedThemes = partiyaPicker?.selectedThemes || null;
      setPartiyaPicker(null);
      // partiyaMode (не mode!) — иначе конфликт с lobbyMode внутри DPLobbyV2
      setLobby({ game: 'turnir', partiyaMode, selectedThemes });
    };

    const startUzorPvP = () => {
      requireProfile(() => setLobby({ game: 'uzor' }));
    };

    const onLobbyConnected = ({ transport, role, opponent }) => {
      // Перенесём partiyaMode/selectedThemes из lobby в game,
      // чтобы TurnirGame знал длину партии и набор тем
      const partiyaMode = lobby?.partiyaMode || 'standard';
      const selectedThemes = lobby?.selectedThemes || null;
      setLobby(null);
      // Очистим ?room= из URL чтобы при перезагрузке страницы не зайти повторно
      try { window.history.replaceState({}, '', window.location.pathname); } catch(_){}
      setGame({
        type: 'turnir', opponent: 'pvp', transport, role, opp: opponent,
        mode: partiyaMode,
        selectedThemes
      });
    };

    // Если есть room в URL — нужно убедиться что профиль есть
    useEffect(() => {
      if(urlRoom && !user && !profile){
        // Просим анонимный onboarding
        setAnonModal(true);
        window.__dpPendingPlay = () => setLobby({ game: 'turnir', lobbyMode: 'guest', code: urlRoom });
      }
    }, [urlRoom]);

    // ─── Если игра запущена — отображаем её ───
    if(game){
      const Turnir = _g('YasnaTurnir');
      if(!Turnir){
        return React.createElement('div', { className: 'dp-root' },
          React.createElement('div', { style: { textAlign: 'center', padding: 60, color: 'var(--text-3)' } }, 'Пока пусто. Сыграй Партию.')
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
          mode: game.mode || 'standard', // 'blitz' | 'standard' | 'expert'
          selectedThemes: game.selectedThemes || null, // null = все темы
          transport: game.transport,
          role: game.role,
          oppData: game.opp,
          onClose: () => { setGame(null); setTick(t => t + 1); }
        })
      );
    }

    return React.createElement('div', { className: 'dp-root' },
      React.createElement('a', { href: '#main', className: 'dp-skip' }, 'Пропустить к главному'),
      React.createElement(DPHeader, { user, onLoginClick, onLogout, isFirstTime }),

      isFirstTime
        ? React.createElement(DPWelcome, { onLoginClick, onAnonStart: () => setAnonModal(true) })
        : React.createElement('main', { id: 'main' },
            React.createElement(DPCastaliaTitle, null),
            // DPHeroCTA удалён — дублировал карточки в DPMainGames с собственными
            // CTA кнопками («Играть соло» / «С другом»). Карточки богаче по
            // содержимому, чем shortcut-кнопки сверху, и видны без скролла.
            React.createElement(DPProfileHero, { user, profile, onLoginClick, remoteProfile }),
            React.createElement(DPSyncNotice, { user, onLoginClick }),
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
          '«В Ясне не выигрывают и не проигрывают.', React.createElement('br'),
          'Здесь играют — это и есть смысл.»'
        ),
        React.createElement('div', null,
          React.createElement('a', { href: 'start.html' }, 'К Ясне'),
          ' · ',
          React.createElement('a', { href: 'https://github.com/Avvacumrechevoi/yasnanegotiations', target: '_blank', rel: 'noopener' }, 'GitHub')
        ),
        React.createElement('div', { className: 'dp-footer-version' }, 'Ясна · v2.0 · мая 2026')
      ),

      authModal && React.createElement(DPAuthModal, { onClose: () => setAuthModal(false), onLoggedIn }),
      anonModal && React.createElement(DPAnonOnboard, {
        onSave: onAnonSaved,
        onCancel: () => { setAnonModal(false); delete window.__dpPendingPlay; }
      }),

      // ─── Диалог выбора режима Партии (длительность + темы + соперник) ───
      partiyaPicker && (() => {
        const mode = partiyaPicker.mode;
        const expanded = partiyaPicker.expanded;
        const selectedThemes = partiyaPicker.selectedThemes; // null = все
        const setMode = (m) => setPartiyaPicker({ ...partiyaPicker, mode: m });
        const setExpanded = (v) => setPartiyaPicker({ ...partiyaPicker, expanded: v });
        const setSelectedThemes = (s) => setPartiyaPicker({ ...partiyaPicker, selectedThemes: s });

        // ─── Источник тем ────────────────────────────────────────
        // window.YasnaTrivia.getThemes() возвращает getter-свойство ACTIVE_THEMES
        // из trivia-bank.js. trivia-bank подписан на 'yasna-content-updated' →
        // при публикации правок в админке (Tier-2 overrides из YDB) ACTIVE_THEMES
        // пересобирается. Темы баседайн (фиксированы в content/*.json), но если
        // у темы 0 вопросов после правок — отфильтровываем здесь, чтобы игрок
        // не мог выбрать пустую тему. См. docs/CONTENT_ARCHITECTURE.md.
        const allThemesRaw = (window.YasnaTrivia && window.YasnaTrivia.getThemes()) || [];
        const allThemes = allThemesRaw.filter(t => {
          const qs = window.YasnaTrivia?.getQuestionsForTheme?.(t.id) || [];
          return qs.length > 0;
        });

        // selectedThemes:
        //   null  — backward-compat «все темы»
        //   []    — сброшено пользователем, ничего не выбрано (требует выбор)
        //   [...] — выбранные id
        const isAllSelected = selectedThemes === null;
        const isEmpty = Array.isArray(selectedThemes) && selectedThemes.length === 0;
        const selectedSet = (selectedThemes && Array.isArray(selectedThemes)) ? new Set(selectedThemes) : null;
        const selectedCount = isAllSelected ? allThemes.length : (selectedThemes?.length || 0);

        const toggleTheme = (themeId) => {
          if(isAllSelected){
            // первый клик в кастоме — оставляем выбранной только эту тему
            setSelectedThemes([themeId]);
          } else {
            const ns = new Set(selectedThemes || []);
            if(ns.has(themeId)) ns.delete(themeId); else ns.add(themeId);
            setSelectedThemes([...ns]);
          }
        };
        // Сбросить — очищает выбор (а не выбирает все). Логичнее: жмёшь reset,
        // получаешь чистое состояние, а не «выбраны все 9».
        const resetThemes = () => setSelectedThemes([]);

        const modes = [
          { id: 'blitz',    label: 'Блиц',     count: 10, time: '~2 мин', sub: 'разогрев' },
          { id: 'standard', label: 'Стандарт', count: 18, time: '~5 мин', sub: 'основной' },
          { id: 'expert',   label: 'Эксперт',  count: 30, time: '~9 мин', sub: 'глубокий' }
        ];
        const cur = modes.find(m => m.id === mode);

        // ─── Минимум тем = 1 ────────────────────────────────────────
        // Раньше блокировали Партию пока не выбраны 5+ тем. Теперь
        // движок умеет распределять total вопросов на любое N≥1 тем
        // (см. generatePartiya). Поэтому блокируем только при 0.
        const enoughThemes = selectedCount >= 1;
        // Тем меньше чем по умолчанию ожидает режим — сообщаем мягко
        const idealThemesCount = { blitz: 5, standard: 6, expert: 6 }[mode] || 6;
        const fewThemes = selectedCount < idealThemesCount && selectedCount >= 1;

        return React.createElement('div', {
          className: 'dp-auth-overlay',
          onClick: e => { if(e.target === e.currentTarget) setPartiyaPicker(null); }
        },
          React.createElement('div', { className: 'dp-auth-modal dp-partiya-picker dp-partiya-picker--v2', role: 'dialog', 'aria-modal': 'true' },
            React.createElement('button', { className: 'dp-auth-x', onClick: () => setPartiyaPicker(null), 'aria-label': 'Отмена' }, '×'),

            // ─── Heading ───
            React.createElement('div', { className: 'dp-picker-head' },
              React.createElement('div', { className: 'dp-auth-eyebrow' }, '✦  Партия'),
              React.createElement('h2', null, 'Какая партия?')
            ),

            // ═════ СЕКЦИЯ 1: Количество вопросов ═════
            React.createElement('section', { className: 'dp-picker-section' },
              React.createElement('div', { className: 'dp-picker-section-eyebrow' }, '◷  Количество вопросов'),
              React.createElement('div', { className: 'dp-mode-grid' },
                modes.map(m =>
                  React.createElement('button', {
                    key: m.id,
                    className: 'dp-mode-btn' + (mode === m.id ? ' dp-mode-btn-active' : ''),
                    onClick: () => setMode(m.id),
                    type: 'button'
                  },
                    React.createElement('div', { className: 'dp-mode-btn-count' }, m.count),
                    React.createElement('div', { className: 'dp-mode-btn-label' }, m.label),
                    React.createElement('div', { className: 'dp-mode-btn-time' }, m.time)
                  )
                )
              ),
              // Подпись «Основной режим. 6 тем по 3 вопроса» удалена —
              // избыточна, цифры режима уже видно на самой кнопке.
            ),

            // ═════ СЕКЦИЯ 2: Темы ═════
            React.createElement('section', { className: 'dp-picker-section' },
              React.createElement('div', { className: 'dp-picker-section-head' },
                React.createElement('div', { className: 'dp-picker-section-eyebrow' }, '☷  Темы'),
                React.createElement('div', { className: 'dp-picker-section-meta' },
                  isAllSelected
                    ? 'все ' + allThemes.length
                    : selectedCount + ' из ' + allThemes.length,
                  // Сбросить — только если что-то выбрано (selectedCount > 0)
                  selectedCount > 0 && React.createElement('button', {
                    className: 'dp-themes-reset',
                    onClick: resetThemes,
                    type: 'button',
                    title: 'Очистить выбор',
                  }, '↺ сбросить')
                )
              ),
              // Темы как компактные банеры в сетке 3×3 — все 9 видны без скролла
              React.createElement('div', { className: 'dp-themes-list dp-themes-list--banners' },
                allThemes.map(t => {
                  const checked = isAllSelected || selectedSet.has(t.id);
                  const meta = THEME_VISUALS[t.id] || THEME_VISUALS.__default;
                  return React.createElement('button', {
                    key: t.id,
                    type: 'button',
                    onClick: () => toggleTheme(t.id),
                    className: 'dp-theme-banner' + (checked ? ' is-checked' : ''),
                    style: { '--theme-color': meta.color },
                    'aria-pressed': checked
                  },
                    React.createElement('span', {
                      className: 'dp-theme-banner__icon',
                      'aria-hidden': 'true',
                      dangerouslySetInnerHTML: { __html: meta.svg }
                    }),
                    React.createElement('span', { className: 'dp-theme-banner__name' }, t.short || t.name),
                    checked && React.createElement('span', { className: 'dp-theme-banner__check', 'aria-hidden': 'true' }, '✓')
                  );
                })
              ),
              !enoughThemes && React.createElement('div', { className: 'dp-themes-warn' },
                '⚠  Выбери хотя бы одну тему.'
              ),
              // Hint когда выбрана только 1 тема — показываем что все вопросы
              // будут из неё. Это норм поведение, не ограничение.
              selectedCount === 1 && React.createElement('div', { className: 'dp-themes-hint',
                style: { fontSize:11, color:'#86868b', marginTop:6, lineHeight:1.5 } },
                'Все ', cur.count, ' вопросов будут из выбранной темы.'
              )
            ),

            // ═════ Footer: одна большая CTA-кнопка ═════
            // Соперник выбран на карточке (Solo/PvP), здесь только запуск.
            (() => {
              const opp = partiyaPicker.preferredOpponent || 'shadow';
              const isPvp = opp === 'pvp';
              const handleStart = () => {
                if(!enoughThemes) return;
                if(isPvp){
                  startPartiyaPvP();
                } else {
                  setPartiyaPicker(null);
                  startPartiyaWithShadow('medium', mode, selectedThemes);
                }
              };
              return React.createElement('section', { className: 'dp-picker-footer' },
                React.createElement('button', {
                  className: 'dp-picker-footer-cta',
                  onClick: handleStart,
                  disabled: !enoughThemes,
                  type: 'button'
                }, isPvp ? 'Создать комнату →' : 'Начать партию →')
              );
            })()
          )
        );
      })(),

      // ─── Lobby для PvP (polling-relay через Yandex Cloud) ───
      lobby && React.createElement(DPLobbyV2, {
        initialMode: lobby.lobbyMode || null,    // 'guest'/'host' — внутреннее состояние лобби
        initialCode: lobby.code || null,
        onClose: () => setLobby(null),
        profile: profile || user,
        onConnected: onLobbyConnected,
        onNeedNickname: () => setAnonModal(true)   // нет ника → онбординг (не тупик «Назад»)
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
