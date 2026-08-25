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
/* Адрес для приглашений. В приложении (метка YasnaApp в строке браузера)
   location.origin — это https://localhost: ссылка, собранная из него, мертва
   у получателя. Подставляем живой адрес сайта; на сайте ветка не работает. */
function inviteBase(){
  if (/YasnaApp\//.test(navigator.userAgent))
    return 'https://avvacumrechevoi.github.io/yasnanegotiations' +
      (location.pathname.startsWith('/games/') ? location.pathname : '/duel.html');
  return window.location.origin + window.location.pathname;
}
/* Наружу: тем же адресом пользуется группа (group-engine.js) — файлы бандла
   не видят функций друг друга напрямую. */
try { window.YasnaInviteBase = inviteBase; } catch (_) {}
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
    'dzhiva-serdtse':       { color: '#E63950', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z"/></svg>' },
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

  // «1 партия», «2 партии», «5 партий» — без этого в полосе ступени
  // выходило «1 партий».
  function склонПартий(n){
    const д = n % 10, с = n % 100;
    if (д === 1 && с !== 11) return 'партия';
    if (д >= 2 && д <= 4 && (с < 12 || с > 14)) return 'партии';
    return 'партий';
  }

  function склонВопросов(n){
    const д = n % 10, с = n % 100;
    if (д === 1 && с !== 11) return 'вопрос';
    if (д >= 2 && д <= 4 && (с < 12 || с > 14)) return 'вопроса';
    return 'вопросов';
  }

  // ─── Прогрессия (Орден Касталии) ──────────────────────────────────
  const STUPENI = [
    { name: 'Послушник', rod: 'Послушника', from: 0,      to: 1000 },
    { name: 'Студент',   rod: 'Студента',   from: 1000,   to: 3000 },
    { name: 'Игрок',     rod: 'Игрока',     from: 3000,   to: 10000 },
    { name: 'Мастер',    rod: 'Мастера',    from: 10000,  to: 30000 },
    { name: 'Магистр',   rod: 'Магистра',   from: 30000,  to: Infinity },
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
      React.createElement('a', { href: 'index.html', className: 'ynav-home dp-header-home', title: 'На главную — лендинг Ясны' },
        React.createElement('span', { className: 'ynav-mark', 'aria-hidden': 'true' }, '✦'),
        React.createElement('span', { className: 'ynav-name' }, 'Ясна')
      ),
      // Свитчер разделов (Вариант B) — «Игра» активна.
      React.createElement('nav', { className: 'ynav-links dp-switch', style: { flex: '0 1 auto' }, 'aria-label': 'Разделы' },
        React.createElement('a', { className: 'ynav-item', href: 'konstruktor.html' }, 'Конструктор'),
        React.createElement('a', { className: 'ynav-item is-active', href: 'duel.html' }, 'Игры', React.createElement('span', { className: 'ynav-new' }, 'NEW')),
        React.createElement('a', { className: 'ynav-item', href: 'learn.html' }, 'Обучение'),
        React.createElement('a', { className: 'ynav-item', href: 'negotiations.html' }, 'Разговор')
        // «Рейтинг» убран из свитчера: канонический набор разделов — четыре
        // (core/site-nav.js SECTIONS), а здесь был пятый пункт. Из-за расхождения
        // на 375px последний раздел обрезался контейнером (right 350 > край 346),
        // что и поймал тест nav-responsive. Страница рейтинга остаётся достижима
        // ссылками с главного экрана игры (см. ниже href:'rating.html' ×2).
      ),
      React.createElement('div', { className: 'dp-header-spacer' }),
      React.createElement('nav', { className: 'dp-header-nav' },
        // «Рейтинг» переехал в общий свитчер разделов (см. .dp-switch выше).
        // Якорные ссылки ведут на секции главного экрана (#hronika/#zhurnal/#znaki).
        // На приветственном экране (первый визит) этих секций нет — без условия
        // ссылки были бы «мёртвыми» (клик ничего не делает). Показываем их только
        // когда отрисован главный экран (вернувшийся игрок / после онбординга).
        !isFirstTime && React.createElement('a', { href: '#hronika', onClick: onAnchorClick('hronika') }, 'Рейтинг'),
        !isFirstTime && React.createElement('a', { href: '#zhurnal', onClick: onAnchorClick('zhurnal') }, 'История'),
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
        onClick: () => { location.href = 'games/krug/index.html'; },
        type: 'button',
        'aria-label': 'Открыть «Разложи по Ясне»'
      },
        React.createElement('span', { className: 'dp-hero-cta-icon', 'aria-hidden': 'true' }, '◎'),
        React.createElement('span', { className: 'dp-hero-cta-body' },
          React.createElement('span', { className: 'dp-hero-cta-title' }, 'Разложи по Ясне'),
          React.createElement('span', { className: 'dp-hero-cta-sub' }, 'Поставь элемент на своё место')
        )
      )
    );
  }

  // ─── Headline на главной ─────────────────────────────────────────
  function DPCastaliaTitle(){
    const вПрилож = /YasnaApp\//.test(navigator.userAgent);
    return React.createElement('div', { className: 'dp-castalia-title' },
      !вПрилож && React.createElement('div', { className: 'dp-castalia-eyebrow' }, '✦  Тренажёр Ясны'),
      вПрилож
        ? React.createElement('h1', { className: 'dp-castalia-h1' }, 'Мастерство в игре')
        : React.createElement('h1', { className: 'dp-castalia-h1' },
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
        'Учись модели Ясны Суток через игровые партии. 10 тем · 5 типов заданий. Выбираешь длину (Блиц 10 / Стандарт 18 / Эксперт 30) и соперника — Тень или живой друг по ссылке. За верный ответ — 10 бусин, до +5 за скорость, серия из 3+ верных даёт множитель.'
      ),
      React.createElement('div', { className: 'dp-welcome-actions' },
        /* В приложении виджет Telegram не работает (домен в BotFather +
           браузерное окружение) — кнопку не показываем, честнее строка. */
        /YasnaApp\//.test(navigator.userAgent)
          ? React.createElement('button', { className: 'dp-btn dp-btn-cta',
              onClick: function(){ if (window.YasnaAccount) window.YasnaAccount.openLogin(); } }, 'Войти по почте')
          : React.createElement('button', { className: 'dp-btn dp-btn-cta', onClick: onLoginClick }, 'Войти через Telegram'),
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

  // ─── Позвать своих: список друзей прямо в лобби ──────────────────
  // Раньше единственным способом позвать человека была пересылка кода
  // через мессенджер. Теперь друзья (core/druzya.js, та же база, что и
  // комнаты) получают зов внутри приложения и видят его у себя.
  function DPZvatDruzey({ code, kind }){
    const [список, setСписок] = React.useState(() =>
      (window.YasnaDruzya && window.YasnaDruzya.списокЛокально()) || []);
    const [позваны, setПозваны] = React.useState({});
    const [беда, setБеда] = React.useState('');

    const [естьМодуль, setЕстьМодуль] = React.useState(!!window.YasnaDruzya);
    React.useEffect(() => {
      /* Модуль друзей на экран Игры приезжает лениво (app/zovy.js), поэтому
         ждём его появления, а не решаем судьбу блока при первом рендере. */
      let жив = true;
      const взяться = () => {
        const Д = window.YasnaDruzya;
        if(!Д || !жив) return false;
        setЕстьМодуль(true);
        Д.друзья().then(с => жив && setСписок(с)).catch(() => {});
        Д.объявиться().catch(() => {});
        return true;
      };
      if(взяться()) return () => { жив = false; };
      const таймер = setInterval(() => { if(взяться()) clearInterval(таймер); }, 700);
      setTimeout(() => clearInterval(таймер), 12000);
      return () => { жив = false; clearInterval(таймер); };
    }, []);

    if(!естьМодуль) return null;
    if(!список.length){
      return React.createElement('div', { className: 'dp-zvat dp-zvat--pusto' },
        'Друзья появятся здесь: обменяйтесь кодами на экране «Профиль» — и звать можно будет одним касанием.');
    }
    const позвать = (ч) => {
      setПозваны(п => Object.assign({}, п, { [ч.deviceId]: 'идёт' }));
      window.YasnaDruzya.позватьВКомнату(ч.deviceId, code, kind || '2p')
        .then(() => setПозваны(п => Object.assign({}, п, { [ч.deviceId]: 'позван' })))
        .catch(() => {
          setПозваны(п => Object.assign({}, п, { [ч.deviceId]: '' }));
          setБеда('Не получилось позвать — проверьте связь.');
        });
    };
    return React.createElement('div', { className: 'dp-zvat' },
      React.createElement('div', { className: 'dp-zvat-zag' }, 'Позвать своих'),
      React.createElement('div', { className: 'dp-zvat-spisok' },
        список.map(ч => React.createElement('div', { className: 'dp-zvat-chel', key: ч.deviceId },
          React.createElement('span', { className: 'dp-zvat-zver' }, ч.avatar || '✦'),
          React.createElement('span', { className: 'dp-zvat-imya' }, ч.nick || 'Игрок'),
          React.createElement('button', {
            className: 'dp-zvat-kn' + (позваны[ч.deviceId] === 'позван' ? ' is-est' : ''),
            type: 'button',
            disabled: !!позваны[ч.deviceId],
            onClick: () => позвать(ч),
          }, позваны[ч.deviceId] === 'позван' ? 'Позван ✓'
            : позваны[ч.deviceId] === 'идёт' ? '…' : 'Позвать')
        ))
      ),
      беда && React.createElement('div', { className: 'dp-zvat-beda' }, беда)
    );
  }

  /* Тот же список нужен групповому лобби (group-engine.js) — отдаём наружу. */
  window.YasnaZvatDruzey = DPZvatDruzey;

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
      /* Два числа с одним знаком рядом («✦ 420» набрано / «580 ✦» осталось)
         путали — теперь ясно, что это остаток и до кого. */
      return next ? ('ещё ' + stupen.toNext + ' ✦ до ' + (next.rod || next.name)) : '';
    })();

    const вПрилож = /YasnaApp\//.test(navigator.userAgent);
    if (вПрилож) {
      const естьСчёт = busey > 0 || games > 0;
      /* Кликабельна вся полоса: пилюля — метка, а не кнопка (она выглядела
         кнопкой и просилась в нажатие сильнее самой партии). */
      return React.createElement('a', { className: 'dp-hero dp-hero--stupen', href: 'rating.html',
          'aria-label': 'Ступень ' + stupen.name + ' — как считается рейтинг' },
        React.createElement('div', { className: 'dp-hero-body' },
          React.createElement('div', { className: 'dp-hero-name-row' },
            React.createElement('span', { className: 'dp-hero-rank-pill' }, stupen.name, ' ', toRoman(stupen.subLevel)),
            естьСчёт && React.createElement('span', { className: 'dp-hero-stats' },
              React.createElement('span', { className: 'dp-hero-bead' }, '✦ ', busey),
              React.createElement('span', { className: 'dp-hero-stats-sep' }, '·'),
              React.createElement('span', null, games, ' ', склонПартий(games))
            )
          ),
          React.createElement('div', { className: 'dp-hero-podpis' }, 'Твой прогресс'),
          React.createElement('div', { className: 'dp-hero-progress', 'aria-label': 'Прогресс ступени' },
            React.createElement('div', { className: 'dp-hero-progress-fill', style: { width: pct + '%' } })
          ),
          React.createElement('div', { className: 'dp-hero-next' },
            естьСчёт ? nextStupenLabel : 'Сыграй первую партию — пойдут бусины\u00A0✦')
        )
      );
    }

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
        nextStupenLabel && React.createElement('div', { style: { fontSize: 12, color: 'var(--text-3)', marginTop: 4, fontVariantNumeric: 'tabular-nums' } }, nextStupenLabel)
      ),
      /* В приложении «Войти» открывает окно почты прямо здесь. Раньше это
         была ссылка на Профиль с подсказкой в title — на Android title тачем
         не всплывает вовсе, а Профиль отсылал обратно сюда. */
      isGuest && (/YasnaApp\//.test(navigator.userAgent)
        ? React.createElement('button', { className: 'dp-hero-cta',
            onClick: function(){ if (window.YasnaAccount) window.YasnaAccount.openLogin(); } }, 'Войти по почте →')
        : React.createElement('button', { className: 'dp-hero-cta', onClick: onLoginClick, title: 'Войди — попадёшь в Хронику' }, 'Войти →')),
      !isGuest && remoteProfile && React.createElement('div', {
        className: 'dp-hero-synced',
        // Прогресс уже на сервере (server/progress.js): формулировка ниже
        // (в БД есть только users/device_links/matches — таблицы прогресса нет,
        // и GET /profile не реализован). Telegram-вход сейчас даёт участие в
        // Хронике и рейтинге по партиям, а не перенос прогресса между устройствами.
        title: 'Вход выполнен: партии учитываются в Хронике и рейтинге. Прогресс обучения пока хранится в этом браузере'
      }, '✓ в Хронике')
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
    // Выгрузка снапшота прогресса файлом — страховка до появления серверного
    // хранения (см. core/storage.js: реестр 44 ключей, секреты и кэш не входят).
    const downloadProgress = () => {
      const S = _g('YasnaStorage');
      if(!S || !S.exportAll){ alert('Модуль хранения не загрузился. Обнови страницу.'); return; }
      try {
        const snap = S.exportAll();
        const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'yasna-progress-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch(_){} }, 1000);
      } catch(e){
        console.warn('[progress] выгрузка не удалась', e);
        alert('Не удалось сохранить файл: ' + ((e && e.message) || e));
      }
    };
    return React.createElement(React.Fragment, null,
      // ─── Light: оригинальный плашка-уведомление ───
      // Класс vk-light-only убран: в тёмной теме плашки не было вовсе, хотя
      // сказать ей есть что. Текст переписан по факту: серверное хранение
      // прогресса появилось (server/progress.js, owner_key usr:/dev:), и
      // прежнее «перенос между устройствами не сделан» стало неправдой.
      React.createElement('div', { className: 'dp-sync-notice', role: 'note' },
        React.createElement('div', { className: 'dp-sync-notice-icon', 'aria-hidden': 'true' }, '◷'),
        React.createElement('div', { className: 'dp-sync-notice-body' },
          React.createElement('div', { className: 'dp-sync-notice-title' }, 'Прогресс сохраняется на сервере'),
          React.createElement('div', { className: 'dp-sync-notice-text' },
            'Уроки и разборы уже лежат на сервере — пока для этого устройства.',
            React.createElement('br'),
            'Войди по почте, и они привяжутся к тебе: вернутся после переустановки и откроются на другом телефоне. Бусины и история партий пока живут только здесь.'
          )
        ),
        React.createElement('div', { className: 'dp-sync-notice-actions' },
          React.createElement('button', { className: 'dp-sync-notice-cta', onClick: downloadProgress, type: 'button' }, 'Скачать копию'),
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
      document.addEventListener('touchstart', onDocClick, { passive: true });
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('mousedown', onDocClick);
        document.removeEventListener('touchstart', onDocClick);
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
      open && React.createElement('div', { className: 'dp-howto-scrim', 'aria-hidden': 'true', onClick: () => setOpen(false) }),
      open && React.createElement('div', { className: 'dp-howto-popover', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Как проходит Партия' },
        React.createElement('div', { className: 'dp-howto-arrow', 'aria-hidden': 'true' }),
        React.createElement('button', { type: 'button', className: 'dp-howto-close', 'aria-label': 'Закрыть', onClick: () => setOpen(false) }, '×'),
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
  // ─── Превью Круга: та же картинка, что в игре ────────────────────
  // Геометрия и палитра взяты из docs/games/krug/krug.js один в один
  // (C=170, R=132, Ri=78, доли 34°/22°, палитра Суток), только без подписей
  // и хитбоксов: человек должен узнать поле до того, как войдёт. Четыре
  // «хода» подряд — доля занимается; когда занялись оба конца оси, между
  // ними вспыхивает золотая нить. Ровно то, что происходит в партии.
  function DPKrugPreview(){
    return React.createElement('div', { className: 'kp' },
      React.createElement('svg', { className: 'kp-svg', viewBox: '30 30 280 280', 'aria-hidden': 'true' },
        React.createElement('path', { key: 'w0', className: 'kp-dolya kp-hod-1', d: 'M208.6 296.2A132 132 0 0 1 131.4 296.2L147.2 244.6A78 78 0 0 0 192.8 244.6Z', fill: '#131A30' }),
        React.createElement('path', { key: 'w1', className: 'kp-dolya', d: 'M127.0 294.8A132 132 0 0 1 83.4 269.6L118.8 228.9A78 78 0 0 0 144.6 243.8Z', fill: '#1B2545' }),
        React.createElement('path', { key: 'w2', className: 'kp-dolya', d: 'M80.0 266.5A132 132 0 0 1 41.4 199.7L94.0 187.5A78 78 0 0 0 116.8 227.0Z', fill: '#2F4472' }),
        React.createElement('path', { key: 'w3', className: 'kp-dolya kp-hod-3', d: 'M40.4 195.2A132 132 0 0 1 40.4 144.8L93.4 155.1A78 78 0 0 0 93.4 184.9Z', fill: '#4D74B4' }),
        React.createElement('path', { key: 'w4', className: 'kp-dolya', d: 'M41.4 140.3A132 132 0 0 1 80.0 73.5L116.8 113.0A78 78 0 0 0 94.0 152.5Z', fill: '#8AA6D4' }),
        React.createElement('path', { key: 'w5', className: 'kp-dolya', d: 'M83.4 70.4A132 132 0 0 1 127.0 45.2L144.6 96.2A78 78 0 0 0 118.8 111.1Z', fill: '#D3C493' }),
        React.createElement('path', { key: 'w6', className: 'kp-dolya kp-hod-2', d: 'M131.4 43.8A132 132 0 0 1 208.6 43.8L192.8 95.4A78 78 0 0 0 147.2 95.4Z', fill: '#F5CF74' }),
        React.createElement('path', { key: 'w7', className: 'kp-dolya', d: 'M213.0 45.2A132 132 0 0 1 256.6 70.4L221.2 111.1A78 78 0 0 0 195.4 96.2Z', fill: '#EAB35C' }),
        React.createElement('path', { key: 'w8', className: 'kp-dolya', d: 'M260.0 73.5A132 132 0 0 1 298.6 140.3L246.0 152.5A78 78 0 0 0 223.2 113.0Z', fill: '#D8894A' }),
        React.createElement('path', { key: 'w9', className: 'kp-dolya kp-hod-4', d: 'M299.6 144.8A132 132 0 0 1 299.6 195.2L246.6 184.9A78 78 0 0 0 246.6 155.1Z', fill: '#C06A3C' }),
        React.createElement('path', { key: 'w10', className: 'kp-dolya', d: 'M298.6 199.7A132 132 0 0 1 260.0 266.5L223.2 227.0A78 78 0 0 0 246.0 187.5Z', fill: '#7A4634' }),
        React.createElement('path', { key: 'w11', className: 'kp-dolya', d: 'M256.6 269.6A132 132 0 0 1 213.0 294.8L195.4 243.8A78 78 0 0 0 221.2 228.9Z', fill: '#3B2A33' }),
        React.createElement('line', { key: 'c0', className: 'kp-nit kp-nit-1', x1: 170.0, y1: 244.0, x2: 170.0, y2: 96.0 }),
        React.createElement('line', { key: 'c1', className: 'kp-nit kp-nit-2', x1: 96.0, y1: 170.0, x2: 244.0, y2: 170.0 }),
        React.createElement('circle', { className: 'kp-obod', cx: 170, cy: 170, r: 132 })
      ),
    );
  }

  /* ─── Превью Партии: настоящие вопросы, три формата ───────────────
     Раньше здесь была схема из прямоугольников: «карточка вопроса» и
     «четыре ответа». Она показывала форму, но не дело. Теперь берём из
     банка НАСТОЯЩИЕ вопросы — по одному на каждый формат партии — и
     проигрываем их по кругу: вопрос → выбор → верный загорается → смена.
     Ни одного выдуманного текста: если в банке подходящего вопроса нет,
     формат просто не показывается.

     Тема «Джива» из показа исключена: она не из книг Ясны (см. карту
     корпуса), и встречать человека ею на витрине нечестно. */
  function короткий(т, предел){
    if (!т) return '';
    const с = String(т).trim();
    return с.length > предел ? с.slice(0, предел - 1).trimEnd() + '…' : с;
  }

  function DPPartiyaPreview(){
    const сцены = useMemo(() => {
      const все = (window.YasnaTrivia && window.YasnaTrivia.getAllQuestions && window.YasnaTrivia.getAllQuestions()) || [];
      const годные = все.filter(q => q && q.theme !== 'dzhiva-serdtse' && q.text && q.text.length <= 92);
      const выбрать = (тип, проверка) => {
        const сп = годные.filter(q => q.type === тип && проверка(q));
        return сп.length ? сп[Math.floor(Math.random() * сп.length)] : null;
      };
      const один = выбрать('single-choice', q =>
        Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => o && o.length <= 30));
      const данет = выбрать('true-false', q => Array.isArray(q.options) && q.options.length === 2);
      const пары = выбрать('match-pair', q =>
        Array.isArray(q.pairsLeft) && q.pairsLeft.length >= 2 &&
        q.pairsLeft.every(o => o && o.length <= 18) &&
        Array.isArray(q.pairsRight) && q.pairsRight.every(o => o && o.length <= 26));
      const сп = [];
      if (один) сп.push({ вид: 'выбор', q: один });
      if (данет) сп.push({ вид: 'данет', q: данет });
      if (пары) сп.push({ вид: 'пары', q: пары });
      return сп;
    }, []);

    const [шаг, setШаг] = useState(0);       /* какая сцена */
    const [фаза, setФаза] = useState(0);     /* 0 — вопрос, 1 — ответ виден */

    useEffect(() => {
      if (сцены.length === 0) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setФаза(1); return;
      }
      /* Медленно и без рывков: вопрос читается 2,4 с, ответ горит ещё 4 с,
         потом сцена уходит плавно и только затем сменяется. Раньше цикл был
         4,2 с целиком — глаз не успевал дочитать вопрос, а смена выглядела
         рывком, потому что старая сцена исчезала мгновенно. */
      let живо = true;
      const т1 = setTimeout(() => { if (живо) setФаза(1); }, 2400);
      const т2 = setTimeout(() => { if (живо) setФаза(2); }, 6600);   /* уходит */
      const т3 = setTimeout(() => {
        if (!живо) return;
        setФаза(0);
        setШаг(ш => (ш + 1) % сцены.length);
      }, 7400);
      return () => { живо = false; clearTimeout(т1); clearTimeout(т2); clearTimeout(т3); };
    }, [шаг, сцены.length]);

    if (сцены.length === 0) return null;
    const сцена = сцены[шаг];
    const q = сцена.q;
    const ключ = сцена.вид + шаг;   /* ключ не меняем на фазах — иначе сцена перерисовывается заново и мигает */

    const подпись = { выбор: 'выбрать ответ', данет: 'верно или нет', пары: 'соединить пары' }[сцена.вид];

    let тело = null;
    if (сцена.вид === 'выбор' || сцена.вид === 'данет') {
      const верный = typeof q.correct === 'number' ? q.correct : 0;
      тело = React.createElement('div', { className: 'pq-otvety' + (сцена.вид === 'данет' ? ' pq-otvety--dva' : '') },
        q.options.map((о, i) => React.createElement('div', {
          key: i,
          className: 'pq-otvet' + (фаза >= 1 && i === верный ? ' pq-otvet--verno' : '') +
                     (фаза >= 1 && i !== верный ? ' pq-otvet--mimo' : '')
        },
          короткий(о, 30),
          фаза >= 1 && i === верный ? React.createElement('span', { className: 'pq-galka' }, '✓') : null
        ))
      );
    } else {
      const пары = (q.pairsLeft || []).slice(0, 3);
      const справа = (q.pairsRight || []).slice(0, 3);
      тело = React.createElement('div', { className: 'pq-pary' },
        пары.map((л, i) => React.createElement('div', { key: i, className: 'pq-para' + (фаза >= 1 ? ' pq-para--svyazana' : ''),
          style: { transitionDelay: (i * 260) + 'ms' } },
          React.createElement('span', { className: 'pq-para-l' }, короткий(л, 18)),
          React.createElement('span', { className: 'pq-para-nit' }),
          React.createElement('span', { className: 'pq-para-r' }, короткий(справа[i], 26))
        ))
      );
    }

    return React.createElement('div', { className: 'pq' },
      React.createElement('div', { className: 'pq-ryad' },
        React.createElement('span', { className: 'pq-vid' }, подпись),
        React.createElement('span', { className: 'pq-tochki' },
          сцены.map((_, i) => React.createElement('i', { key: i, className: i === шаг ? 'est' : '' }))
        )
      ),
      React.createElement('div', { className: 'pq-ekran' + (фаза === 2 ? ' pq-ekran--uhodit' : ''), key: ключ },
        React.createElement('div', { className: 'pq-vopros' }, короткий(q.text, 92)),
        тело
      )
    );
  }

  function DPMainGames({ onPartiya, onUzor, onProsto }){
    return React.createElement('section', { className: 'dp-section', role: 'region', 'aria-label': 'Режимы игр' },
      React.createElement('div', { style: { marginBottom: 'var(--space-5)' } },
        React.createElement('h2', { className: 'dp-section-h', style: { fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.005em' } },
          'Режимы игр'
        )
      ),
      React.createElement('div', { className: 'dp-games-grid' },
        React.createElement('div', { className: 'dp-game-card dp-game-primary' },
          React.createElement('div', { className: 'dp-game-eyebrow' }, 'Тренажёр · 2 минуты'),
          React.createElement('div', { className: 'dp-game-title-row' },
            React.createElement('div', { className: 'dp-game-title' }, 'Разложи по Ясне')
          ),
          /YasnaApp\//.test(navigator.userAgent) && React.createElement(DPKrugPreview, null),
          React.createElement('div', { className: 'dp-game-sub' },
            'Тренируйся расставлять по полочкам.'
          ),
          React.createElement('ul', { className: 'dp-game-bullets' },
            React.createElement('li', null, '16 Ясн на выбор — или случайная'),
            React.createElement('li', null, 'Ставишь тапом по самому кругу, а не по кнопкам под ним'),
            React.createElement('li', null, 'Нитка через середину вспыхивает сама, когда ось сошлась')
          ),
          React.createElement('div', { className: 'dp-cta-row' },
            React.createElement('button', {
              type: 'button', className: 'dp-cta dp-cta--solo',
              onClick: (e) => { e.stopPropagation(); location.href = 'games/krug/index.html'; },
              'aria-label': 'Играть в «Разложи по Ясне»'
            },
              React.createElement('span', { className: 'dp-cta__icon', 'aria-hidden': 'true' },
                React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
                  React.createElement('circle', { cx: 12, cy: 12, r: 8 }),
                  React.createElement('path', { d: 'M12 4v16M4 12h16' })
                )
              ),
              React.createElement('span', { className: 'dp-cta__body' },
                React.createElement('span', { className: 'dp-cta__title' }, 'Играть'),
                React.createElement('span', { className: 'dp-cta__sub' }, 'одному или с друзьями')
              )
            )
          )
        ),
        // (карточка «Переговоры» живёт на своём экране — negotiations.html)
        React.createElement('div', { className: 'dp-game-card' },
          React.createElement('div', { className: 'dp-game-eyebrow' }, 'Викторина · 5 минут'),
          React.createElement('div', { className: 'dp-game-title-row' },
            React.createElement('div', { className: 'dp-game-title' }, 'Партия'),
            React.createElement(DPPartiyaHowTooltip, null)
          ),
          /YasnaApp\//.test(navigator.userAgent) && React.createElement(DPPartiyaPreview, null),
          React.createElement('div', { className: 'dp-game-sub' },
            'Вопросы по книге: выбрать ответ, верно или нет, соединить пары.'
          ),
          React.createElement('ul', { className: 'dp-game-bullets' },
            React.createElement('li', null, '10 · 18 · 30 вопросов на выбор'),
            React.createElement('li', null, '4 формата: выбор из 4 · верно/нет · несколько верных · соедини пары'),
            React.createElement('li', null, 'В финале — разбор ошибок с цитатами из книги')
          ),
          /* Одна кнопка: с кем играть — следующим шагом, в окне настройки.
             Три равные плитки заставляли выбирать соперника раньше, чем
             человек решил играть, и «Компанией» не помещалось на 360. */
          /* Две двери: «Просто играть» — сразу партия с Тенью на обычной
             длине, «Выбрать партию» — длительность, темы и соперник.
             Раньше единственная кнопка звалась «Играть», но вела в настройку:
             человек хотел играть, а попадал в форму. */
          React.createElement('div', { className: 'dp-cta-row' },
            React.createElement('button', {
              type: 'button', className: 'dp-cta dp-cta--solo',
              onClick: (e) => { e.stopPropagation(); onProsto && onProsto(); },
              'aria-label': 'Быстрая игра — партия с Тенью'
            },
              React.createElement('span', { className: 'dp-cta__icon', 'aria-hidden': 'true' },
                React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
                  React.createElement('path', { d: 'M6 4l12 8-12 8z' })
                )
              ),
              React.createElement('span', { className: 'dp-cta__body' },
                React.createElement('span', { className: 'dp-cta__title' }, 'Быстрая игра'),
                React.createElement('span', { className: 'dp-cta__sub' }, 'с Тенью, обычная длина')
              )
            ),
            React.createElement('button', {
              type: 'button', className: 'dp-cta dp-cta--vybor',
              onClick: (e) => { e.stopPropagation(); onPartiya('shadow'); },
              'aria-label': 'Настроить партию: длительность, темы, соперник'
            },
              React.createElement('span', { className: 'dp-cta__icon', 'aria-hidden': 'true' },
                React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
                  React.createElement('path', { d: 'M4 7h16M4 12h10M4 17h7' })
                )
              ),
              React.createElement('span', { className: 'dp-cta__body' },
                React.createElement('span', { className: 'dp-cta__title' }, 'Настроить партию'),
                React.createElement('span', { className: 'dp-cta__sub' }, 'длина, темы, соперник')
              )
            )
          )
        ),
      )
    );
  }

  // ─── Тема дня ────────────────────────────────────────────────────
  // Было две плитки: «Вызов дня» и запертая «Тема дня» с подписью «формат
  // ещё готовится», плюс счётчик «1 доступно · 1 в подготовке» — экран
  // сообщал о себе, а не о деле. Осталась одна карточка, и она работает:
  // тема выбирается по дате (у всех одна и та же), нажатие открывает блиц
  // ровно по этой теме, снизу видно, играл ли ты сегодня.
  function DPTemaDnya({ onTema }){
    const themes = (window.YasnaTrivia && window.YasnaTrivia.getThemes && window.YasnaTrivia.getThemes()) || [];
    if(!themes.length) return null;
    const д = new Date();
    const ключДня = д.getFullYear() + '-' + String(д.getMonth()+1).padStart(2,'0') + '-' + String(д.getDate()).padStart(2,'0');
    const номер = parseInt(ключДня.replace(/-/g, ''), 10) % themes.length;
    const тема = themes[номер];
    const вопросов = (window.YasnaTrivia.getQuestionsForTheme
      ? window.YasnaTrivia.getQuestionsForTheme(тема.id).length : 0);

    /* Освоение этой темы — из тех же чисел, что показывает статистика. */
    const Storage = _g('YasnaDuelStorage');
    const общее = Storage?.getOverallStats?.() || {};
    const освоено = (общее.masteryByTheme || {})[тема.id] || 0;

    /* «Играл сегодня» берём из истории партий: своего сигнала у темы дня
       нет, и выдумывать его нечестно. */
    const история = Storage?.getMatchHistory?.() || [];
    const началоДня = new Date(); началоДня.setHours(0,0,0,0);
    const сегодняПартий = история.filter(m => m && m.date >= началоДня.getTime()).length;

    return React.createElement('section', { className: 'dp-section', role: 'region', 'aria-label': 'Тема дня' },
      React.createElement('div', { className: 'dp-section-h-row' },
        React.createElement('h2', { className: 'dp-section-h' }, IconCalendar(), ' Тема дня')
      ),
      React.createElement('button', {
        type: 'button', className: 'dp-tema', onClick: () => onTema && onTema(тема.id),
        'aria-label': 'Пройти тему дня: ' + тема.name
      },
        React.createElement('div', { className: 'dp-tema-verh' },
          React.createElement('span', { className: 'dp-tema-metka' }, 'Сегодня'),
          освоено > 0 && React.createElement('span', { className: 'dp-tema-osvoeno' }, 'освоено ' + освоено + '%')
        ),
        React.createElement('div', { className: 'dp-tema-imya' }, тема.name),
        React.createElement('div', { className: 'dp-tema-o' },
          вопросов ? ('Блиц по этой теме · ' + вопросов + ' ' + склонВопросов(вопросов) + ' в запасе') : 'Блиц по этой теме'),
        React.createElement('div', { className: 'dp-tema-niz' },
          React.createElement('span', { className: 'dp-tema-knopka' }, 'Пройти тему'),
          React.createElement('span', { className: 'dp-tema-fakt' },
            сегодняПартий ? ('сегодня сыграно: ' + сегодняПартий + ' ' + склонПартий(сегодняПартий)) : 'сегодня ещё не играл')
        )
      )
    );
  }

  // ─── Статистика ──────────────────────────────────────────────────
  // Было «Освоение тем» — сетка из одиннадцати полосок сразу на экране, и
  // непонятно, что с ней делать. Освоение тем — это подробность, а не
  // главное: наверх выносим четыре числа о себе, а темы раскрываются по
  // нажатию. Сами темы — про книгу, поэтому в строке сказано, откуда они.
  function DPStatistika(){
    const themes = (window.YasnaTrivia && window.YasnaTrivia.getThemes && window.YasnaTrivia.getThemes()) || [];
    const Storage = _g('YasnaDuelStorage');
    const общее = Storage?.getOverallStats?.() || {};
    const мастерство = общее.masteryByTheme || {};
    const открыто = themes.filter(t => (мастерство[t.id] || 0) > 0).length;
    const [раскрыто, setРаскрыто] = useState(false);

    const итоги = общее.totals || {};
    const партий = итоги.played || 0;
    const побед = итоги.wins || 0;
    const бусины = общее.beads != null ? общее.beads : (общее.busey || 0);
    const серия = (общее.streak && (общее.streak.best || общее.streak.current)) || итоги.bestStreak || 0;

    const числа = [
      { n: партий, п: 'партий' },
      { n: побед, п: 'побед' },
      { n: бусины, п: 'бусин' },
      { n: открыто + ' / ' + themes.length, п: 'тем открыто' }
    ];

    return React.createElement('section', { className: 'dp-section', role: 'region', 'aria-label': 'Статистика' },
      React.createElement('div', { className: 'dp-section-h-row' },
        React.createElement('h2', { className: 'dp-section-h' }, IconGrid(), ' Статистика')
      ),
      React.createElement('div', { className: 'dp-chisla' },
        числа.map((ч, i) => React.createElement('div', { key: i, className: 'dp-chislo' },
          React.createElement('div', { className: 'dp-chislo-n' }, String(ч.n)),
          React.createElement('div', { className: 'dp-chislo-p' }, ч.п)
        ))
      ),
      React.createElement('button', {
        type: 'button', className: 'dp-temy-knopka', onClick: () => setРаскрыто(в => !в),
        'aria-expanded': раскрыто ? 'true' : 'false'
      },
        React.createElement('span', null, 'Прогресс освоения тем'),
        React.createElement('span', { className: 'dp-temy-shevron' }, раскрыто ? '⌃' : '⌄')
      ),
      раскрыто && React.createElement('div', { className: 'dp-temy' },
        React.createElement('p', { className: 'dp-temy-o' },
          'Темы — главы книги «Ясна Суток». Освоение растёт от верных ответов в партиях по этой теме.'),
        themes.map(t => {
          const pct = мастерство[t.id] || 0;
          return React.createElement('div', { key: t.id, className: 'dp-tema-stroka' },
            React.createElement('div', { className: 'dp-tema-stroka-verh' },
              React.createElement('span', { className: 'dp-tema-stroka-imya' }, t.name),
              React.createElement('span', { className: 'dp-tema-stroka-pct' }, pct ? pct + '%' : 'не открыта')
            ),
            React.createElement('div', { className: 'dp-tema-stroka-polosa' },
              React.createElement('div', { className: 'dp-tema-stroka-fill', style: { width: Math.max(2, pct) + '%' } })
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
    // Признак «это я» считает сервер (leaderboard.js): идентификаторы игроков
    // наружу не отдаются, сравнивать их на клиенте больше нечем.
    const myInTop = items && items.find(r => r.isMe);
    const myRank = myInTop ? items.findIndex(r => r.isMe) + 1 : null;

    return React.createElement('div', { className: 'dp-card', id: 'hronika' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, IconScroll(), ' ',
          Term('Рейтинг игроков', 'Кто заработал больше бусин за эту неделю. Обнуляется в субботу 23:59.'),
          React.createElement('span', { className: 'dp-card-h-sub' }, 'за неделю')
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
                    const isMe = !!row.isMe;
                    const rankCls = idx === 0 ? 'dp-td-rank-1' : idx === 1 ? 'dp-td-rank-2' : idx === 2 ? 'dp-td-rank-3' : '';
                    return React.createElement('tr', {
                      key: idx,
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
                /* Ссылка обещала полный список и не делала ничего: href='#'
                   и preventDefault. Экран рейтинга в приложении есть. */
                myDeviceId && !myInTop && React.createElement('a', { href: 'rating.html', style: { color: 'var(--info)', textDecoration: 'none' } }, 'все →')
              )
            )
    );
  }

  // ─── Знаки Магистра ──────────────────────────────────────────────
  // ─── Достижения ──────────────────────────────────────────────────
  // Было восемь безымянных кружков с римскими цифрами: взятые «I II III»,
  // невзятые «·». Человек не мог узнать ни что он получил, ни за что дают
  // остальные. Теперь это список: знак, имя, за что даётся и сколько
  // осталось. Взятые сверху, следующие — за ними, с полосой прогресса.
  function DPZnaki(){
    const Ach = _g('YasnaDuelAchievements');
    const Storage = _g('YasnaDuelStorage');
    const [всё, setВсё] = useState(false);
    const [открыт, setОткрыт] = useState(null);   /* какой знак раскрыт */
    if(!Ach?.list) return null;

    const данные = Storage?.getOverallStats?.() || {};
    const список = (Ach.list() || []).map(a => {
      let сделано = 0;
      try { сделано = a.progress ? (a.progress(данные) || 0) : 0; } catch(_) {}
      return { a, взят: !!a.unlocked, цель: a.goal || 0, сделано: сделано };
    });
    const взятые = список.filter(з => з.взят);
    const впереди = список.filter(з => !з.взят)
      .sort((x, y) => (y.цель ? y.сделано / y.цель : 0) - (x.цель ? x.сделано / x.цель : 0));
    const показать = всё ? взятые.concat(впереди) : взятые.concat(впереди).slice(0, 5);

    /* Что знак значит — по семье условий. Достижения в данных описаны
       условием («25 партий»), но не смыслом; человек спрашивает не «сколько»,
       а «зачем». Собираем объяснение из id — данные не трогаем. */
    function смысл(a){
      const i = a.id || '';
      if (/^first/.test(i)) return 'Первый шаг: знак ставится сразу, как только сыграна партия.';
      if (/^matches/.test(i)) return 'За постоянство: сколько партий сыграно всего, побед не требуется.';
      if (/^wins/.test(i)) return 'За результат: считаются только выигранные партии, с любым соперником.';
      if (/^streak/.test(i)) return 'За серию: победы подряд, без единого поражения между ними.';
      if (/^perfect|accuracy|precise/.test(i)) return 'За точность: партия без единой ошибки.';
      if (/sprint|fast|speed/.test(i)) return 'За скорость: ответы быстрее обычного темпа.';
      if (/shadow|bot/.test(i)) return 'За победу над Тенью — так зовут соперника-бота.';
      if (/theme|tema/.test(i)) return 'За широту: вопросы разных тем книги.';
      if (/daily|day/.test(i)) return 'За возвращения: играть в разные дни.';
      return 'Знак за упорство в игре.';
    }

    return React.createElement('div', { className: 'dp-card', id: 'znaki' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, IconStar(), ' ',
          Term('Достижения', 'Знаки за упорство: серии партий, точные ответы, победы над Тенью.')
        ),
        React.createElement('span', { className: 'dp-card-meta' }, взятые.length, ' из ', список.length)
      ),
      React.createElement('div', { className: 'dp-znaki' },
        показать.map(({ a, взят, цель, сделано }) =>
          React.createElement('button', {
            key: a.id, type: 'button',
            className: 'dp-znak-stroka' + (взят ? ' est' : '') + (открыт === a.id ? ' raskryt' : ''),
            onClick: () => setОткрыт(т => (т === a.id ? null : a.id)),
            'aria-expanded': открыт === a.id ? 'true' : 'false'
          },
            React.createElement('span', { className: 'dp-znak-ikonka', 'aria-hidden': 'true' }, a.icon || '✦'),
            React.createElement('span', { className: 'dp-znak-telo' },
              React.createElement('span', { className: 'dp-znak-imya' }, a.title),
              React.createElement('span', { className: 'dp-znak-o' },
                взят ? 'получен' : (a.desc || '')),
              !взят && цель > 0 && React.createElement('span', { className: 'dp-znak-polosa' },
                React.createElement('i', { style: { width: Math.min(100, Math.round(сделано / цель * 100)) + '%' } })
              ),
              открыт === a.id && React.createElement('span', { className: 'dp-znak-tolk' },
                React.createElement('span', { className: 'dp-znak-tolk-t' }, смысл(a)),
                React.createElement('span', { className: 'dp-znak-tolk-k' },
                  взят ? 'Знак уже ваш.'
                       : (цель > 0
                          ? ('Как получить: ' + (a.desc || '') + '. Сейчас ' + Math.min(сделано, цель) + ' из ' + цель + '.')
                          : ('Как получить: ' + (a.desc || ''))))
              )
            ),
            !взят && цель > 0 && React.createElement('span', { className: 'dp-znak-schet' },
              Math.min(сделано, цель), ' / ', цель)
          )
        )
      ),
      список.length > 5 && React.createElement('button', {
        type: 'button', className: 'dp-znaki-esche', onClick: () => setВсё(в => !в)
      }, всё ? 'Свернуть' : ('Показать все ' + список.length))
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
        React.createElement('h3', null, IconJournal(), ' ', Term('История игры', 'Твои последние партии: соперник, счёт, точность.')),
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
  function DPLobbyV2({ onClose, profile, onConnected, initialMode, initialCode, onNeedNickname, onConfigureHost }){
    const [mode, setMode] = useState(initialMode || 'choose');
    const [roomCode, setRoomCode] = useState('');
    const [roomId, setRoomId] = useState('');
    const [inputCode, setInputCode] = useState(initialCode || '');
    const [error, setError] = useState(null);
    const [statusText, setStatusText] = useState('Жду собеседника…');
    const [copyFallbackLink, setCopyFallbackLink] = useState('');  // если авто-копирование не удалось — показываем выделяемую ссылку
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
      // Хост приходит сюда уже после конфига партии (picker) → создаём комнату
      // сразу, минуя экран выбора. См. choose-first флоу в DPMainPage.
      if(initialMode === 'host'){
        setTimeout(() => doCreate(), 100);
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
            /* Раньше сюда попадал сырой текст Firebase («PERMISSION_DENIED:
               Permission denied») — человеку он ничего не говорит. */
            console.warn('[комната] ожидание:', e);
            setError('Что-то пошло не так, пока мы ждали второго игрока. Попробуйте создать комнату заново.');
          }
          setMode('error');
        }
      } catch(e){
        console.error('[lobby/create] exception', e);
        console.warn('[комната] создание:', e);
        setError(/permission/i.test(String(e && e.message))
          ? 'Не удалось открыть комнату — сервер игры отказал. Попробуйте ещё раз через минуту.'
          : 'Не удалось создать комнату. Проверьте связь и попробуйте ещё раз.');
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
        } else if(e.message === 'wrong_kind_group'){
          setError('Это код комнаты «С коллективом», а не для двоих. Зайди через «С коллективом» → «Войти по коду».');
        } else if(e.message === 'cant_join_own_room'){
          setError('Нельзя войти в свою же комнату. Открой ссылку с другого устройства.');
        } else if(e.message === 'invalid_code_format'){
          setError('Код должен быть в формате KASTA-XXXX');
        } else {
          console.warn('[комната] вход:', e);
          setError(/permission/i.test(String(e && e.message))
            ? 'Комната не пускает — возможно, она уже закрыта. Попросите новый код.'
            : 'Не удалось подключиться. Проверьте связь и попробуйте ещё раз.');
        }
        setMode('error');
      }
    }

    function copyLink(){
      const link = inviteBase() + '?room=' + encodeURIComponent(roomCode);
      window.YasnaClipboard(link,
        () => {
          // реальный успех (промис writeText зарезолвился ИЛИ execCommand скопировал)
          setCopyFallbackLink('');
          setStatusText('✓ Ссылка скопирована · жду собеседника…');
          setTimeout(() => setStatusText('Жду собеседника…'), 2500);
        },
        () => {
          // ни один путь не скопировал — показываем выделяемую ссылку (не prompt:
          // его глушат in-app браузеры мессенджеров)
          setCopyFallbackLink(link);
        }
      );
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
            React.createElement('button', { className: 'dp-lobby-opt', onClick: () => { if(onConfigureHost) onConfigureHost(); else doCreate(); } },
              React.createElement('div', { className: 'dp-lobby-opt-icon' }, '◯'),
              React.createElement('div', { className: 'dp-lobby-opt-title' }, 'Создать'),
              React.createElement('div', { className: 'dp-lobby-opt-sub' }, 'Настроишь партию, получишь код для друга.')
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
              React.createElement('button', { className: 'dp-lobby-code-link', onClick: copyLink }, 'Скопировать ссылку'),
              React.createElement(DPZvatDruzey, { code: roomCode, kind: '2p' }),
              copyFallbackLink && React.createElement('div', { className: 'dp-lobby-code-fallback' },
                React.createElement('div', { className: 'dp-lobby-code-fallback-hint' }, 'Не удалось скопировать автоматически — выдели ссылку и скопируй вручную:'),
                React.createElement('input', {
                  className: 'dp-lobby-code-fallback-input',
                  type: 'text', readOnly: true, value: copyFallbackLink, autoFocus: true,
                  onFocus: e => e.target.select(),
                  onClick: e => e.target.select(),
                  'aria-label': 'Ссылка для собеседника'
                })
              )
            ),
            React.createElement('div', { className: 'dp-lobby-status' },
              React.createElement('div', { className: 'dp-loader', 'aria-hidden': 'true' }),
              React.createElement('div', { className: 'dp-lobby-status-title' }, statusText)
            )
          ) : React.createElement('div', { className: 'dp-lobby-status' },
            React.createElement('div', { className: 'dp-loader', 'aria-hidden': 'true' }),
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
          React.createElement('div', { className: 'dp-loader', 'aria-hidden': 'true' }),
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
      // Примечание: DPLobby — устаревший дубликат DPLobbyV2 (не используется в
      // рендере), оставлен в синхроне ради консистентности.
      const link = inviteBase() + '?room=' + encodeURIComponent(roomCode);
      window.YasnaClipboard(link,
        () => {
          setStatusText('✓ Ссылка скопирована · жду собеседника…');
          setTimeout(() => setStatusText('Жду собеседника…'), 2500);
        }
        // onFail не передаём → helper покажет выделяемую панель с ссылкой
      );
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
            React.createElement('div', { className: 'dp-loader', 'aria-hidden': 'true' }),
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
          React.createElement('div', { className: 'dp-loader', 'aria-hidden': 'true' }),
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
    /* Приложение узнаётся по своей метке в строке браузера — её ставит
       Capacitor (appendUserAgent в capacitor.config.json). */
    const вПриложении = () => /YasnaApp\//.test(navigator.userAgent);
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

        // ─── Состояние успеха ───
        // Было «Прогресс синхронизирован. Партии с других устройств подтянутся
        // автоматически» — это неправда: серверного прогресса нет (в схеме только
        // users/device_links/matches), GET /profile не реализован. Обещать перенос
        // между устройствами нельзя, пока нет таблицы прогресса и ручки чтения.
        phase === 'success' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'dp-auth-success-icon', 'aria-hidden': 'true' }, '✦'),
          React.createElement('h2', { className: 'dp-auth-success-title' }, 'Привет, ', welcomeName, '.'),
          React.createElement('p', { className: 'dp-auth-success-text' }, 'Теперь партии попадают в Хронику и рейтинг под твоим именем, а уроки и бусины привязаны к аккаунту — откроются на любом устройстве.')
        ),

        // ─── Idle / loading / error ───
        phase !== 'success' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'dp-auth-eyebrow' }, '✦  Войти'),
          /* В приложении виджет Telegram не работает вовсе, поэтому и заголовок,
             и объяснение — про почту. Рекламировать способ, который тут же
             объявлен невозможным, значит впустую тратить внимание человека. */
          React.createElement('h2', null, вПриложении() ? 'Вход по почте' : 'Сохрани прогресс между устройствами'),
          React.createElement('p', null, вПриложении()
            ? 'Пришлём код из шести цифр — пароля нет. Уроки, разбор и бусины привяжутся к вам, а не к этому телефону.'
            : 'Войди через Telegram. Бусины, серии и история партий будут жить с твоим аккаунтом.'),

          // ─── Light: оригинальный список перков ───
          !вПриложении() && React.createElement('ul', { className: 'dp-auth-perks vk-light-only' },
            React.createElement('li', null, 'Партии с любого устройства — общий счёт'),
            React.createElement('li', null, 'Без паролей. Только имя и аватар из Telegram'),
            React.createElement('li', null, 'Гостевой прогресс сохранится — при логине он добавится к твоему')
          ),
          // ─── Dark: VK-Scheme — как работает синхронизация (только сайт) ───
          !вПриложении() && React.createElement('div', { className: 'vk-scheme-block' },
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
            : вПриложении()
              /* Виджет Telegram привязан и к домену в BotFather, и к
                 браузерному окружению: внутри приложения он не заработает
                 никогда. Показывать неработающую кнопку — врать; показывать
                 отладочное «Бот не настроен» — врать вдвойне. Говорим прямо
                 и оставляем вход по почте, который в приложении работает. */
              /* Раньше здесь была ссылка «Открыть Профиль →», а Профиль вёл
                 сюда же — круг замыкался, и войти в приложении было нельзя.
                 core/account.js на этой странице уже загружен, поэтому окно
                 входа по почте открывается прямо отсюда. */
              ? React.createElement('button', {
                  className: 'dp-btn dp-btn-cta',
                  style: { display: 'block', width: '100%', marginTop: 4 },
                  onClick: function(){
                    if (onClose) onClose();
                    if (window.YasnaAccount) window.YasnaAccount.openLogin();
                  }
                }, 'Войти по почте')
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
          React.createElement('div', { className: 'dp-auth-foot' }, вПриложении()
            ? 'Храним почту и то, что вы сами напишете в профиле. Аккаунт можно удалить в любой момент.'
            : 'Передаём только Telegram-имя и фото. Личные сообщения нам недоступны.')
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
    // Режим «С коллективом»: ?kroom=CODE → авто-вход гостем в групповую комнату.
    const urlKroom = useMemo(() => {
      try {
        const p = new URLSearchParams(window.location.search);
        const r = (p.get('kroom') || '').trim().toUpperCase();
        return /^KASTA-[A-Z0-9]{4}$/.test(r) ? r : null;
      } catch(_){ return null; }
    }, []);
    // groupLobby = null | { initialMode?: 'choose'|'join'|'create', code? }
    const [groupLobby, setGroupLobby] = useState(urlKroom ? { initialMode: 'join', code: urlKroom } : null);
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
      _g('YasnaDuelAuth')?.logout?.();          // чистит только токен и user
      setUser(null);
      // ВАЖНО: НЕ удаляем yasna_duel_profile. В нём лежит deviceId — ключ, к
      // которому привязан ВЕСЬ локальный прогресс (партии, достижения, дневной
      // вызов) и связь device_links на сервере. Раньше выход стирал профиль, и
      // человек терял историю просто потому, что вышел из аккаунта. Гостевой
      // профиль — независимая личность по дизайну (см. duel.js/loginWithTelegram),
      // после выхода корректно вернуться к нему, а не обнулять.
      try {
        const P = _g('YasnaDuelProfile');
        setProfile((P && P.load && P.load()) || null);
      } catch(_){ setProfile(null); }
      setTick(t => t + 1);
    };

    // Сетевым режимам (PvP «С другом», группа) нужен НЕ просто «залогинен», а
    // пригодный профиль: ник + deviceId (deviceId — ключ слота в комнате Firebase).
    // У Telegram-user'а deviceId НЕТ (см. коммент к meBase ниже), а profile может
    // быть null → «Создать комнату» уходило в ветку без ника, открывало онбординг
    // БЕЗ продолжения и молча ничего не делало («комната не создаётся»).
    // Достраиваем недостающее из того, что есть, и персистим: save() без deviceId,
    // затем load() — он сам догенерит deviceId (см. duel.js/loadProfile).
    const ensureNetProfile = () => {
      const P = _g('YasnaDuelProfile');
      const stored = (P && P.load && P.load()) || null;
      if(stored && stored.deviceId && stored.nickname) return stored;
      const src = profile || user || {};
      const nickname = src.nickname || src.firstName || src.username || src.name || null;
      if(!nickname) return null;                // ника взять негде → честный онбординг
      if(P && P.save){
        P.save({
          nickname: String(nickname).slice(0, 40),
          avatar: src.avatar || (_g('YasnaDuelProfile')?.AVATAR_OPTIONS || ['🦊'])[0],
          deviceId: (stored && stored.deviceId) || (src.deviceId || undefined),
        });
        return (P.load && P.load()) || null;    // load() досыпет deviceId, если его не было
      }
      return null;
    };

    const requireProfile = (cb) => {
      const ready = ensureNetProfile();
      if(ready){
        // синхронизируем React-состояние, чтобы лобби получило полный профиль
        if(!profile || profile.deviceId !== ready.deviceId) setProfile(ready);
        cb();
        return;
      }
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

    /* Второй игрок получал код от друга, а ввести его было негде: единственная
       кнопка всегда создавала НОВУЮ комнату. Открываем лобби в режиме гостя —
       там уже есть поле кода. */
    const startPartiyaGuest = () => {
      const partiyaMode = partiyaPicker?.mode || 'standard';
      setPartiyaPicker(null);
      setLobby({ game: 'turnir', lobbyMode: 'guest', partiyaMode });
    };

    const startPartiyaPvP = () => {
      const partiyaMode = partiyaPicker?.mode || 'standard';
      const selectedThemes = partiyaPicker?.selectedThemes || null;
      setPartiyaPicker(null);
      // lobbyMode:'host' → DPLobbyV2 сразу создаёт комнату (минуя choose).
      // partiyaMode (не mode!) — иначе конфликт с lobbyMode внутри DPLobbyV2.
      setLobby({ game: 'turnir', lobbyMode: 'host', partiyaMode, selectedThemes });
    };

    // ─── PvP-вход: choose-first ───────────────────────────────────────
    // Раньше «Играть с другом» открывало конфиг партии («Какая партия?»),
    // и единственная кнопка «Создать комнату» прятала за собой выбор
    // Создать/Войти — гостю было некуда ввести код. Теперь сначала выбор:
    //   • Создать → конфиг партии (picker) → комната + код + ссылка;
    //   • Войти по коду → ввод кода (конфиг наследуется от хоста).
    const startPvP = () => {
      requireProfile(() => setLobby({ game: 'turnir', lobbyMode: 'choose' }));
    };
    // Из choose «Создать» → открыть конфиг партии, затем хостить.
    const configureHostThenCreate = () => {
      setLobby(null);
      askPartiyaMode('pvp');
    };
    // ─── Вход «С коллективом» (отдельный режим, N=3..8) ───────────────
    // GroupApp сам разводит choose → Создать (конфиг) / Войти по коду.
    const startGroup = () => {
      requireProfile(() => setGroupLobby({ initialMode: 'choose' }));
    };
    // Роутер карточек DPMainGames: соло → конфиг сразу; PvP → choose-first;
    // группа → GroupApp (choose-first).
    const onPartiyaCTA = (opp) => {
      if(opp === 'pvp'){ startPvP(); }
      else if(opp === 'group'){ startGroup(); }
      else { askPartiyaMode(opp); }
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

    // Аналогично для ?kroom= (групповая комната)
    useEffect(() => {
      if(urlKroom && !user && !profile){
        setAnonModal(true);
        window.__dpPendingPlay = () => setGroupLobby({ initialMode: 'join', code: urlKroom });
      }
    }, [urlKroom]);

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

    // ─── Режим «С коллективом» — отдельный движок (лобби + игра внутри) ───
    if(groupLobby){
      const Group = _g('YasnaGroup');
      const meBase = profile || user;   // profile первый — у залогиненного user нет deviceId
      // deviceId живёт в гостевом профиле (YasnaDuelProfile); user (Telegram) его не несёт.
      const gid = (profile && profile.deviceId) || (user && user.deviceId) ||
                  (_g('YasnaDuelProfile') && _g('YasnaDuelProfile').load && (_g('YasnaDuelProfile').load() || {}).deviceId);
      if(Group && meBase && gid){
        const meG = { nickname: meBase.nickname, avatar: meBase.avatar, deviceId: gid };
        return React.createElement(DPErrorBoundary, null,
          React.createElement(Group.GroupApp, {
            profile: meG,
            initialMode: groupLobby.initialMode || 'choose',
            initialCode: groupLobby.code || null,
            onNeedNickname: () => {                  // онбординг + продолжение (не тупик)
              window.__dpPendingPlay = () => setGroupLobby(Object.assign({}, groupLobby));
              setAnonModal(true);
            },
            onClose: () => {
              setGroupLobby(null);
              try { window.history.replaceState({}, '', window.location.pathname); } catch(_){}
              setTick(t => t + 1);
            },
          })
        );
      }
      // нет профиля/движка — проваливаемся на главную; анон-модал откроет эффект urlKroom/requireProfile
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
            React.createElement(DPMainGames, { onPartiya: onPartiyaCTA, onUzor: startUzorPvP,
              onProsto: () => startPartiyaWithShadow('medium', 'standard', null) }),
            React.createElement(DPTemaDnya, { onTema: (themeId) => startPartiyaWithShadow('medium', 'blitz', [themeId]) }),
            React.createElement(DPStatistika, null),
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
        // Переключатель темы (оформление) — здесь, а не в хедере, чтобы не
        // загромождать навигацию. Тогглит класс vk-light на body + color-scheme.
        /* Переключатель темы снят с подвала: в приложении тема живёт в Профиле
           (Настройки → Вид), и две ручки для одного спорили между собой. */
        !/YasnaApp\//.test(navigator.userAgent) && React.createElement('button', {
          className: 'dp-theme-switch', type: 'button',
          'aria-label': 'Переключить тему оформления',
          onClick: () => {
            const goDark = document.body.classList.contains('vk-light'); // сейчас светлая → в тёмную
            document.body.classList.toggle('vk-light', !goDark);
            try { document.documentElement.style.colorScheme = goDark ? 'dark' : 'light'; } catch(_){}
            try { localStorage.setItem('yasna_theme_vk_dark', goDark ? '1' : '0'); } catch(_){}
            setTick(t => t + 1);
          },
        },
          document.body.classList.contains('vk-light') ? '🌙  Тёмная тема' : '☀  Светлая тема'
        ),
        React.createElement('div', { className: 'dp-footer-quote' },
          '«В Ясне не выигрывают и не проигрывают.', React.createElement('br'),
          'Здесь играют — это и есть смысл.»'
        ),
        /* Ссылку на репозиторий убрали намеренно: она указывала на исходники
           прямо из подвала, то есть выдавала и площадку, и точное имя проекта
           тому, кто вообще не искал. */
        React.createElement('div', null,
          React.createElement('a', { href: 'index.html' }, 'К Ясне')
        ),
        /* Версия была вписана руками («v2.0 · мая 2026») и устарела на четыре
           выпуска, да ещё в кривом падеже. В приложении берём настоящую у
           Capacitor, на сайте не показываем вовсе. */
        React.createElement('div', { className: 'dp-footer-version', ref: el => {
          if(!el || el.dataset.v) return; el.dataset.v='1';
          try{
            var П=(window.Capacitor&&window.Capacitor.Plugins)||{};
            if(П.App&&П.App.getInfo){ П.App.getInfo().then(function(i){ el.textContent='Ясна · '+i.version; }); }
            else el.textContent='';
          }catch(_){ el.textContent=''; }
        } }, 'Ясна')
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
        // не мог выбрать пустую тему. См. docs-internal/CONTENT_ARCHITECTURE.md.
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
        const оппонент = partiyaPicker.preferredOpponent || 'shadow';
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
              React.createElement('div', { className: 'dp-picker-section-eyebrow' }, '◷  Длина партии'),
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

            // ═════ СЕКЦИЯ 2: С кем играем ═════
            // Раньше соперник выбирался кнопкой на карточке — теперь он часть
            // настройки партии, как длина и темы.
            React.createElement('section', { className: 'dp-picker-section' },
              React.createElement('div', { className: 'dp-picker-section-eyebrow' }, '◐  С кем играем'),
              React.createElement('div', { className: 'dp-mode-grid' },
                [
                  { id: 'shadow', label: 'Один', sub: 'против Тени' },
                  { id: 'pvp',    label: 'С другом', sub: 'по ссылке' },
                  { id: 'group',  label: 'Компанией', sub: '3–8 человек' },
                ].map(о =>
                  React.createElement('button', {
                    key: о.id,
                    type: 'button',
                    className: 'dp-mode-btn dp-mode-btn--opp' + (оппонент === о.id ? ' dp-mode-btn-active' : ''),
                    onClick: () => setPartiyaPicker(Object.assign({}, partiyaPicker, { preferredOpponent: о.id })),
                  },
                    React.createElement('div', { className: 'dp-mode-btn-label' }, о.label),
                    React.createElement('div', { className: 'dp-mode-btn-time' }, о.sub)
                  )
                )
              )
            ),

            // ═════ СЕКЦИЯ 3: Темы ═════
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
              /* Обещали «все 30 вопросов из выбранной темы», а в банке темы их
                 бывает девять — партия молча выходила втрое короче. Считаем
                 фактический пул и говорим как есть. */
              selectedCount === 1 && (function(){
                var ид = isAllSelected ? (allThemes[0] && allThemes[0].id) : selectedThemes[0];
                var есть = 0;
                try {
                  var банк = window.YasnaTrivia && window.YasnaTrivia.getQuestionsForTheme;
                  есть = банк ? (банк(ид) || []).length : 0;
                } catch(_){}
                var текст = (!есть || есть >= cur.count)
                  ? 'Все ' + cur.count + ' вопросов будут из выбранной темы.'
                  : 'В этой теме ' + есть + ' ' + (есть % 10 === 1 && есть % 100 !== 11 ? 'вопрос'
                      : ([2,3,4].indexOf(есть % 10) > -1 && [12,13,14].indexOf(есть % 100) === -1 ? 'вопроса' : 'вопросов'))
                    + ' — партия будет короче.';
                return React.createElement('div', { className: 'dp-themes-hint',
                  style: { fontSize:12, color:'#86868b', marginTop:6, lineHeight:1.5 } }, текст);
              })()
            ),

            // ═════ Footer: одна большая CTA-кнопка ═════
            // Соперник выбран на карточке (Solo/PvP), здесь только запуск.
            (() => {
              const handleStart = () => {
                if(!enoughThemes) return;
                if(оппонент === 'pvp'){ startPartiyaPvP(); return; }
                if(оппонент === 'group'){ setPartiyaPicker(null); startGroup(); return; }
                setPartiyaPicker(null);
                startPartiyaWithShadow('medium', mode, selectedThemes);
              };
              const надпись = оппонент === 'pvp' ? 'Создать комнату →'
                : оппонент === 'group' ? 'Собрать компанию →' : 'Начать партию →';
              return React.createElement('section', { className: 'dp-picker-footer' },
                React.createElement('button', {
                  className: 'dp-picker-footer-cta',
                  onClick: handleStart,
                  disabled: !enoughThemes,
                  type: 'button'
                }, надпись),
                /* Вторая дверь для того, кому код УЖЕ прислали. */
                оппонент === 'pvp' && React.createElement('button', {
                  className: 'dp-btn dp-btn-ghost',
                  style: { display: 'block', width: '100%', marginTop: 10 },
                  onClick: startPartiyaGuest,
                  type: 'button'
                }, 'У меня есть код комнаты')
              );
            })()
          )
        );
      })(),

      // ─── Lobby для PvP (polling-relay через Yandex Cloud) ───
      lobby && React.createElement(DPLobbyV2, {
        // nonce в key — чтобы повтор после онбординга ника ремаунтил лобби и
        // авто-эффект (doCreate/doJoin) отработал заново
        key: (lobby.lobbyMode || 'choose') + ':' + (lobby.nonce || 0),
        initialMode: lobby.lobbyMode || null,    // 'choose'/'guest'/'host' — внутреннее состояние лобби
        initialCode: lobby.code || null,
        onClose: () => setLobby(null),
        // ВАЖНО: раньше было `profile || user` — у Telegram-user'а нет deviceId,
        // и doCreate молча уходил в онбординг без продолжения (комната не создавалась).
        // Достаём deviceId из гостевого профиля, как это делает групповой режим.
        profile: (function(){
          const P = _g('YasnaDuelProfile');
          const stored = (P && P.load && P.load()) || null;
          const base = (profile && profile.deviceId) ? profile : (stored || profile || user);
          if(base && !base.deviceId && stored && stored.deviceId){
            return Object.assign({}, base, { deviceId: stored.deviceId });
          }
          return base;
        })(),
        onConnected: onLobbyConnected,
        onConfigureHost: configureHostThenCreate,  // choose «Создать» → конфиг партии → хост
        onNeedNickname: () => {                    // нет ника → онбординг И продолжение действия
          window.__dpPendingPlay = () => setLobby(Object.assign({}, lobby, { nonce: Date.now() }));
          setAnonModal(true);
        }
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
