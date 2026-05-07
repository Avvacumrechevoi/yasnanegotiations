// ═══════════════════════════════════════════════════════════════════
// Игра по Ясне · главная страница (Касталия / Гессе)
// Layout v3: центральный Profile-Hero + карусель квестов + CTA
// ═══════════════════════════════════════════════════════════════════
(function(){
  const { useState, useEffect } = React;
  const _g = (n) => window[n];

  function renderAvatar(av, size){
    size = size || 24;
    if(typeof av === 'string' && av.startsWith('http')){
      return React.createElement('img', { src: av, alt: '',
        style: { width: size, height: size, borderRadius: size/2, objectFit: 'cover', display:'block' }
      });
    }
    return React.createElement('span', { style: { fontSize: size * 0.7 } }, av || '🦊');
  }

  // ─── Прогрессия ──────────────────────────────────────────
  const STUPENI = [
    { name: 'Послушник', emoji: '🌱', from: 0,      to: 1000 },
    { name: 'Студент',   emoji: '📜', from: 1000,   to: 3000 },
    { name: 'Игрок',     emoji: '⚗️', from: 3000,   to: 10000 },
    { name: 'Мастер',    emoji: '🗝️', from: 10000,  to: 30000 },
    { name: 'Магистр',   emoji: '⭐', from: 30000,  to: Infinity },
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

  // ─── Header ────────────────────────────────────────────
  function DPHeader({ user, onLoginClick, onLogout }){
    return React.createElement('header', { className: 'dp-header' },
      React.createElement('a', { href: 'index.html', className: 'dp-header-back', title: 'Вернуться к Ясне' },
        '←', React.createElement('span', null, ' Ясна')
      ),
      React.createElement('div', { className: 'dp-header-bread' },
        React.createElement('span', { className: 'dp-header-bread-sep' }, '/'),
        React.createElement('span', null, '🎼 Игра')
      ),
      React.createElement('div', { className: 'dp-header-spacer' }),
      React.createElement('div', { className: 'dp-header-auth' },
        user
          ? React.createElement('button', { className: 'dp-auth-btn-small', onClick: onLogout, style:{padding:'8px 14px',fontSize:13} },
              'Выйти'
            )
          : React.createElement('button', { className: 'dp-btn dp-btn-secondary', onClick: onLoginClick, style: {padding:'8px 16px',fontSize:13} },
              'Войти'
            )
      )
    );
  }

  // ─── Welcome (только для первого визита) ───────────────
  function DPWelcome({ onLoginClick, onAnonStart }){
    return React.createElement('section', { className: 'dp-welcome' },
      React.createElement('div', { className: 'dp-welcome-emoji' }, '🎼'),
      React.createElement('h1', { className: 'dp-welcome-title' }, 'Игра по Ясне'),
      React.createElement('p', { className: 'dp-welcome-sub' },
        '18 вопросов из 9 тем · одна Партия ≈ 6 минут · вход в Орден игроков'
      ),
      React.createElement('button', { className: 'dp-welcome-cta-primary', onClick: onLoginClick },
        '🌱 Войти в Орден'
      ),
      React.createElement('ul', { className: 'dp-welcome-perks' },
        React.createElement('li', null, 'Полный Архив'),
        React.createElement('li', null, 'Прогресс между устройствами'),
        React.createElement('li', null, 'Аватар из Telegram')
      ),
      React.createElement('button', { className: 'dp-welcome-cta-secondary', onClick: onAnonStart },
        'или сыграть Гостем →'
      ),
      React.createElement('p', { className: 'dp-welcome-note' },
        'Гость не остаётся в Архиве. Вступить в Орден можно потом.'
      )
    );
  }

  // ─── Центральный Profile-Hero (для залогиненного/гостя) ──
  function DPProfileHero({ user, profile, onLoginClick }){
    const me = user || profile;
    const isGuest = !user;
    const busey = totalBusey();
    const stupen = getStupen(busey);
    const pct = stupen.toNext === Infinity ? 100 :
      Math.min(100, ((busey - stupen.from) / (stupen.to - stupen.from)) * 100);
    const Storage = _g('YasnaDuelStorage');
    const data = Storage?.getOverallStats?.() || {};
    const streak = data.streaks?.daily?.current || 0;

    return React.createElement('section', { className: 'dp-hero' },
      React.createElement('div', { className: 'dp-hero-avatar-wrap' },
        React.createElement('div', { className: 'dp-hero-avatar' },
          renderAvatar(me.avatar, 80)
        ),
        React.createElement('div', { className: 'dp-hero-rank-badge' },
          stupen.emoji, ' ', toRoman(stupen.subLevel)
        )
      ),
      React.createElement('div', { className: 'dp-hero-name' },
        me.nickname,
        isGuest && React.createElement('span', { className: 'dp-hero-guest-tag' }, ' · Гость')
      ),
      React.createElement('div', { className: 'dp-hero-stupen' },
        stupen.name, ' ', toRoman(stupen.subLevel)
      ),
      // Прогресс-бар
      React.createElement('div', { className: 'dp-hero-progress' },
        React.createElement('div', { className: 'dp-hero-progress-bar' },
          React.createElement('div', { className: 'dp-hero-progress-fill', style: { width: pct + '%' } })
        ),
        React.createElement('div', { className: 'dp-hero-progress-text' },
          busey, ' / ', stupen.to === Infinity ? '∞' : stupen.to, ' бусин'
        )
      ),
      // Метки
      streak > 0 && React.createElement('div', { className: 'dp-hero-meta' },
        React.createElement('span', { className: 'dp-hero-meta-pill' }, '🎼 Ритм ', streak, ' дн.')
      ),
      // Гость → CTA войти
      isGuest && React.createElement('button', {
        className: 'dp-hero-guest-upsell',
        onClick: onLoginClick
      }, 'Войти через Telegram, чтобы попасть в Архив →')
    );
  }

  // ─── Карусель квестов ──────────────────────────────────
  function DPQuestsRow({ onPlay }){
    const Daily = _g('YasnaDailyChallenge');
    const today = Daily?.today?.();
    const themes = window.YasnaTrivia?.THEMES || [];
    const themeIdx = today ? parseInt(today.date.replace(/-/g, ''), 10) % themes.length : 0;
    const todayTheme = themes[themeIdx];
    const data = Daily?.load?.() || {};
    const todayPlayed = today && data.byDate?.[today.date];

    const quests = [
      {
        id: 'etude',
        emoji: '🌅',
        tag: 'Этюд дня',
        title: todayTheme ? todayTheme.name : 'Тема дня',
        sub: todayPlayed ? `Сыграно: ${todayPlayed.score}/${todayPlayed.maxScore}` : '1 попытка',
        accent: '#fef3c7', accentBorder: '#fde68a'
      },
      {
        id: 'gimn',
        emoji: '🎵',
        tag: 'Гимн',
        title: 'Каденция ×10',
        sub: '10 правильных подряд',
        accent: '#dbeafe', accentBorder: '#bfdbfe'
      },
      {
        id: 'fest',
        emoji: '💎',
        tag: 'Праздничная',
        title: 'Партия недели',
        sub: 'Особый режим',
        accent: '#ede9fe', accentBorder: '#ddd6fe'
      },
      {
        id: 'flash',
        emoji: '⚡',
        tag: 'Молния',
        title: 'Блиц 30 сек',
        sub: 'Скорость и точность',
        accent: '#fee2e2', accentBorder: '#fecaca'
      },
    ];

    return React.createElement('section', { className: 'dp-quests' },
      React.createElement('div', { className: 'dp-quests-row' },
        quests.map(q =>
          React.createElement('button', {
            key: q.id, className: 'dp-quest-card', onClick: onPlay,
            style: { background: q.accent, borderColor: q.accentBorder }
          },
            React.createElement('div', { className: 'dp-quest-tag' }, q.emoji, ' ', q.tag),
            React.createElement('div', { className: 'dp-quest-title' }, q.title),
            React.createElement('div', { className: 'dp-quest-sub' }, q.sub),
            React.createElement('div', { className: 'dp-quest-arrow' }, '→')
          )
        )
      )
    );
  }

  // ─── Главная кнопка «Новая Партия» ─────────────────────
  function DPMainCTA({ onPlay }){
    return React.createElement('div', { className: 'dp-main-cta' },
      React.createElement('button', { className: 'dp-cta-button', onClick: onPlay },
        React.createElement('span', { className: 'dp-cta-emoji' }, '🎼'),
        React.createElement('div', { className: 'dp-cta-textwrap' },
          React.createElement('div', { className: 'dp-cta-title' }, 'Новая Партия'),
          React.createElement('div', { className: 'dp-cta-sub' }, 'Тень · 6 минут · 18 вопросов')
        ),
        React.createElement('span', { className: 'dp-cta-arrow' }, '→')
      )
    );
  }

  // ─── Партитура (карта тем) ─────────────────────────────
  function DPPartitura(){
    const themes = window.YasnaTrivia?.THEMES || [];
    if(themes.length === 0) return null;
    const Storage = _g('YasnaDuelStorage');
    const data = Storage?.getOverallStats?.() || {};
    const masteryByTheme = data.masteryByTheme || {};

    return React.createElement('section', { className: 'dp-section' },
      React.createElement('div', { className: 'dp-section-h-row' },
        React.createElement('h2', { className: 'dp-section-h' }, '🎵 Партитура'),
        React.createElement('span', { className: 'dp-section-h-sub' },
          '9 тем мира «Сутки»'
        )
      ),
      React.createElement('div', { className: 'dp-partitura' },
        themes.map(t => {
          const pct = masteryByTheme[t.id] || 0;
          return React.createElement('div', { key: t.id, className: 'dp-theme-card' },
            React.createElement('div', { className: 'dp-theme-emoji' }, t.emoji),
            React.createElement('div', { className: 'dp-theme-name' }, t.name),
            React.createElement('div', { className: 'dp-theme-bar' },
              React.createElement('div', { className: 'dp-theme-bar-fill', style: { width: pct + '%' } })
            ),
            React.createElement('div', { className: 'dp-theme-pct' },
              pct > 0 ? pct + '%' : '—'
            )
          );
        })
      )
    );
  }

  // ─── Архив (лидерборд) ─────────────────────────────────
  function DPArchive({ onOpen }){
    const [items, setItems] = useState(null);
    useEffect(() => {
      const LB = _g('YasnaLeaderboardClient');
      if(!LB?.isEnabled?.()){ setItems([]); return; }
      LB.fetchLeaderboard({ gameId: 'turnir', yasnaId: 'суток', period: 'all', limit: 5 })
        .then(res => setItems(res?.items || []))
        .catch(() => setItems([]));
    }, []);

    const placeholder = [
      { nickname: 'Магистр I', score: 4520, avatar: '⭐' },
      { nickname: 'Игрок III', score: 3180, avatar: '⚗️' },
      { nickname: 'Студент IX', score: 2705, avatar: '📜' },
    ];

    return React.createElement('div', { className: 'dp-card' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, '📚 Архив недели')
      ),
      items === null
        ? React.createElement('div', { style: {fontSize:13, color:'#9b938a', textAlign:'center', padding:'16px 0'} }, 'Загрузка…')
        : items.length === 0
          ? React.createElement('div', null,
              React.createElement('div', { className: 'dp-lb-list', style: {opacity:0.5} },
                placeholder.map((row, idx) =>
                  React.createElement('div', { key: idx, className: 'dp-lb-row' },
                    React.createElement('span', { className: 'dp-lb-rank ' + (idx === 0 ? 'dp-lb-rank-1' : idx === 1 ? 'dp-lb-rank-2' : 'dp-lb-rank-3') },
                      idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'),
                    React.createElement('span', null, row.avatar),
                    React.createElement('span', { className: 'dp-lb-name' }, row.nickname),
                    React.createElement('span', { className: 'dp-lb-score' }, row.score)
                  )
                )
              ),
              React.createElement('p', { style: {fontSize:12, color:'#9b938a', textAlign:'center', marginTop:14, marginBottom:0} },
                'Сыграй Партию — попади в Архив'
              )
            )
          : React.createElement('div', { className: 'dp-lb-list' },
              items.map((row, idx) =>
                React.createElement('div', { key: row.deviceId || idx, className: 'dp-lb-row' },
                  React.createElement('span', { className: 'dp-lb-rank ' + (idx === 0 ? 'dp-lb-rank-1' : idx === 1 ? 'dp-lb-rank-2' : idx === 2 ? 'dp-lb-rank-3' : '') },
                    idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '#' + (idx + 1)),
                  React.createElement('span', null, row.avatar || '🦊'),
                  React.createElement('span', { className: 'dp-lb-name' }, row.nickname),
                  React.createElement('span', { className: 'dp-lb-score' }, row.score != null ? row.score : '—')
                )
              )
            )
    );
  }

  // ─── Знаки ─────────────────────────────────────────────
  function DPZnaki(){
    const Ach = _g('YasnaDuelAchievements');
    if(!Ach?.list || !Ach?.getUnlocked) return null;
    const all = Ach.list();
    const unlocked = Ach.getUnlocked() || [];
    if(!all.length) return null;
    return React.createElement('div', { className: 'dp-card' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, '🏅 Знаки Ордена'),
        React.createElement('span', { style: {color:'#9b938a', fontSize:13} },
          unlocked.length, ' / ', all.length
        )
      ),
      React.createElement('div', { className: 'dp-znaki-row' },
        all.slice(0, 6).map(a => {
          const got = unlocked.includes(a.id);
          return React.createElement('div', {
            key: a.id, className: 'dp-znak' + (got ? '' : ' dp-znak-locked')
          },
            React.createElement('span', { style: {fontSize:22} }, a.emoji || '🏅'),
            React.createElement('div', { style: {fontSize:10, marginTop:4, lineHeight:1.2} }, a.title)
          );
        })
      )
    );
  }

  // ─── Auth Modal ───────────────────────────────────────
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
        React.createElement('button', { className: 'dp-auth-x', onClick: onClose, 'aria-label': 'Закрыть' }, '✕'),
        React.createElement('div', { style: {fontSize:48, marginBottom:12} }, '🌱'),
        React.createElement('h2', null, 'Войти в Орден'),
        React.createElement('p', null, 'Через Telegram. Без паролей. Только имя и аватар.'),
        !baseUrl
          ? React.createElement('div', { style: {color:'#dc2626', fontSize:13} }, 'Архив временно недоступен')
          : !botUsername
            ? React.createElement('div', { style: {color:'#dc2626', fontSize:13} }, 'Бот не настроен')
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
        loading && React.createElement('div', { style: {fontSize:13, color:'#6e6e73'} }, 'Авторизация…'),
        error && React.createElement('div', { style: {fontSize:13, color:'#dc2626', marginTop:8} }, '❌ ', error)
      )
    );
  }

  // ─── Anon Onboarding ──────────────────────────────────
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
        React.createElement('button', { className: 'dp-auth-x', onClick: onCancel, 'aria-label': 'Отмена' }, '✕'),
        React.createElement('div', { style: {fontSize:48,marginBottom:8} }, avatar),
        React.createElement('h2', null, 'Как тебя называть?'),
        React.createElement('p', null, 'Это имя соперник увидит в Партии.'),
        React.createElement('input', {
          autoFocus: true, placeholder: 'Например, Иван',
          value: nickname, maxLength: 20,
          onChange: e => setNickname(e.target.value),
          onKeyDown: e => { if(e.key === 'Enter') submit(); },
          style: { width: '100%', padding: '12px 14px', fontSize: 16, border: '1.5px solid #e5e5ea', borderRadius: 10, margin: '0 0 16px', fontFamily: 'inherit', outline: 'none' }
        }),
        React.createElement('div', { style: {display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',marginBottom:16} },
          opts.map(em =>
            React.createElement('button', {
              key: em, onClick: () => setAvatar(em),
              style: { fontSize: 24, width: 40, height: 40, border: '1.5px solid ' + (avatar === em ? '#d4a574' : '#e5e5ea'), background: avatar === em ? '#fff8ec' : '#fff', borderRadius: 10, cursor: 'pointer' }
            }, em)
          )
        ),
        React.createElement('button', { className: 'dp-btn dp-btn-primary', onClick: submit, disabled: !nickname.trim(), style: {width:'100%'} }, 'Готово')
      )
    );
  }

  // ─── Main App ─────────────────────────────────────────
  function DuelPageApp(){
    const Auth = _g('YasnaDuelAuth');
    const Profile = _g('YasnaDuelProfile');
    const [user, setUser] = useState(() => Auth?.loadUser?.());
    const [profile, setProfile] = useState(() => Profile?.load?.());
    const [authModal, setAuthModal] = useState(false);
    const [anonModal, setAnonModal] = useState(false);
    const [turnirOpen, setTurnirOpen] = useState(false);
    const [, setTick] = useState(0);

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
          React.createElement('div', { style: {textAlign:'center', padding:60, color:'#6e6e73'} }, 'Загрузка…')
        );
      }
      const playerData = user
        ? { nickname: user.nickname, avatar: user.avatar || '🦊', rank: 'Студент II' }
        : { nickname: profile.nickname, avatar: profile.avatar || '🦊', rank: 'Гость' };
      return React.createElement(Turnir.TurnirGame, {
        player: playerData,
        opponentLevel: 'medium',
        onClose: () => { setTurnirOpen(false); setTick(t => t + 1); }
      });
    }

    return React.createElement('div', { className: 'dp-root' },
      React.createElement(DPHeader, { user, onLoginClick, onLogout }),

      isFirstTime
        ? React.createElement(DPWelcome, { onLoginClick, onAnonStart: () => setAnonModal(true) })
        : React.createElement(React.Fragment, null,
            React.createElement(DPProfileHero, { user, profile, onLoginClick }),
            React.createElement(DPQuestsRow, { onPlay: startTurnir }),
            React.createElement(DPMainCTA, { onPlay: startTurnir }),
            React.createElement(DPPartitura, null),
            React.createElement('section', { className: 'dp-section' },
              React.createElement('div', { className: 'dp-two-col' },
                React.createElement(DPArchive, { onOpen: startTurnir }),
                React.createElement(DPZnaki, null)
              )
            )
          ),

      React.createElement('footer', { className: 'dp-footer' },
        React.createElement('a', { href: 'index.html' }, '← Вернуться к Ясне'),
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
        if(root) ReactDOM.createRoot(root).render(React.createElement(DuelPageApp));
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
