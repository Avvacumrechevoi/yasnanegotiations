// ═══════════════════════════════════════════════════════════════════
// Игра по Ясне · главная страница
// Касталийский Орден стиль (Гессе): Партия, Бусины, Темы, Архив, Этюд
// ═══════════════════════════════════════════════════════════════════
(function(){
  const { useState, useEffect } = React;
  const _g = (n) => window[n];

  function renderAvatar(av, size){
    size = size || 24;
    if(typeof av === 'string' && av.startsWith('http')){
      return React.createElement('img', { src: av, alt: '',
        style: { width: size, height: size, borderRadius: size/2, objectFit: 'cover', display:'inline-block', verticalAlign:'middle' }
      });
    }
    return av || '🦊';
  }

  // ─── Прогрессия (ступени Ордена) ────────────────────────────────
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
    // Считаем как сумму очков по всем матчам
    return s.totals?.score || (s.totals?.wins || 0) * 50 + (s.totals?.losses || 0) * 5;
  }

  // ─── Header ────────────────────────────────────────────────────
  function DPHeader({ user, onLoginClick, onLogout }){
    const stupen = user ? getStupen(totalBusey()) : null;
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
          ? React.createElement('div', { className: 'dp-auth-chip' },
              React.createElement('span', { className: 'dp-auth-chip-avatar' }, renderAvatar(user.avatar, 24)),
              React.createElement('span', null, user.nickname),
              stupen && React.createElement('span', { className: 'dp-auth-chip-source' },
                '· ', stupen.emoji, ' ', stupen.name, ' ', toRoman(stupen.subLevel)
              ),
              React.createElement('button', { className: 'dp-auth-btn-small', onClick: onLogout }, 'Выйти')
            )
          : React.createElement('button', { className: 'dp-btn dp-btn-secondary', onClick: onLoginClick, style: {padding:'8px 16px',fontSize:13} }, 'Войти')
      )
    );
  }

  function toRoman(n){
    const r = ['','I','II','III','IV','V','VI','VII','VIII','IX','X'];
    return r[n] || (n + '');
  }

  // ─── Hero ──────────────────────────────────────────────────────
  function DPHero({ isFirstTime, onLoginClick, onAnonStart }){
    if(isFirstTime){
      return React.createElement('section', { className: 'dp-hero' },
        React.createElement('span', { className: 'dp-hero-emoji' }, '🎼'),
        React.createElement('h1', null, 'Игра по Ясне'),
        React.createElement('p', { className: 'dp-hero-sub' },
          '18 вопросов из 9 тем · одна Партия ≈ 6 минут · Орден из десятков игроков'
        ),
        React.createElement('div', { className: 'dp-hero-cta' },
          React.createElement('button', { className: 'dp-btn dp-btn-primary dp-btn-large', onClick: onLoginClick },
            '🌱 Войти в Орден'
          ),
          React.createElement('ul', { className: 'dp-hero-perks' },
            React.createElement('li', null, 'Полный Архив'),
            React.createElement('li', null, 'Прогресс между устройствами'),
            React.createElement('li', null, 'Аватар из Telegram')
          ),
          React.createElement('button', { className: 'dp-btn dp-btn-text', onClick: onAnonStart, style: {marginTop:4} },
            'или сыграть Гостем →'
          ),
          React.createElement('p', { className: 'dp-hero-anon-note' },
            'Гость не остаётся в Архиве. Вступить в Орден можно потом.'
          )
        )
      );
    }
    return React.createElement('section', { className: 'dp-hero dp-hero-compact' },
      React.createElement('h1', null, '🎼 Игра по Ясне'),
      React.createElement('p', { className: 'dp-hero-sub' },
        'Партия из 9 тем. Темы из мира «Сутки».'
      )
    );
  }

  // ─── Профиль (компактная карточка вверху для залогиненного) ────
  function DPProfileBar({ user, profile }){
    const busey = totalBusey();
    const stupen = getStupen(busey);
    const pct = stupen.toNext === Infinity ? 100 :
      Math.min(100, ((busey - stupen.from) / (stupen.to - stupen.from)) * 100);
    const Storage = _g('YasnaDuelStorage');
    const data = Storage?.getOverallStats?.() || {};
    const streak = data.streaks?.daily?.current || 0;

    return React.createElement('div', { className: 'dp-profile-bar' },
      React.createElement('div', { className: 'dp-profile-avatar' },
        renderAvatar(user?.avatar || profile?.avatar || '🦊', 40)
      ),
      React.createElement('div', { className: 'dp-profile-main' },
        React.createElement('div', { className: 'dp-profile-name' },
          user?.nickname || profile?.nickname || 'Гость',
          React.createElement('span', { className: 'dp-profile-stupen' },
            ' · ', stupen.emoji, ' ', stupen.name, ' ', toRoman(stupen.subLevel)
          )
        ),
        React.createElement('div', { className: 'dp-profile-progress' },
          React.createElement('div', { className: 'dp-profile-progress-bar' },
            React.createElement('div', { className: 'dp-profile-progress-fill', style: { width: pct + '%' } })
          ),
          React.createElement('div', { className: 'dp-profile-progress-text' },
            busey, ' бусин',
            stupen.toNext !== Infinity && ['  ·  до ', stupen.name, ' ', toRoman(stupen.subLevel + 1), ': ', stupen.toNext, ' бусин']
          )
        ),
        React.createElement('div', { className: 'dp-profile-meta' },
          streak > 0 && React.createElement('span', null, '🎼 Ритм ', streak, ' дн.'),
        )
      )
    );
  }

  // ─── Upsell для гостя ──────────────────────────────────────────
  function DPUpsell({ profile, onLoginClick }){
    return React.createElement('div', { className: 'dp-upsell' },
      React.createElement('span', { className: 'dp-upsell-icon' }, renderAvatar(profile?.avatar, 28)),
      React.createElement('div', { className: 'dp-upsell-text' },
        React.createElement('div', { className: 'dp-upsell-title' },
          'Ты пока Гость · ', React.createElement('strong', null, profile?.nickname || 'без имени')
        ),
        React.createElement('div', { className: 'dp-upsell-sub' },
          'Войди в Орден через Telegram, чтобы попасть в Архив и сохранять Партитуру между устройствами.'
        )
      ),
      React.createElement('button', { className: 'dp-btn dp-btn-primary', onClick: onLoginClick, style: {flexShrink:0} },
        'Войти в Орден'
      )
    );
  }

  // ─── Главная кнопка «Новая Партия» ────────────────────────────
  function DPMainCTA({ onPlay }){
    return React.createElement('div', { className: 'dp-main-cta' },
      React.createElement('button', { className: 'dp-cta-button', onClick: onPlay },
        React.createElement('span', { className: 'dp-cta-emoji' }, '🎼'),
        React.createElement('span', { className: 'dp-cta-title' }, 'Новая Партия'),
        React.createElement('span', { className: 'dp-cta-sub' }, 'Тень · ~6 минут')
      )
    );
  }

  // ─── Этюд дня ──────────────────────────────────────────────────
  function DPEtude({ onPlay }){
    const Daily = _g('YasnaDailyChallenge');
    const today = Daily?.today?.();
    if(!today) return null;
    const data = Daily.load?.() || {};
    const todayPlayed = data.byDate?.[today.date];
    const themes = window.YasnaTrivia?.THEMES || [];
    // Выбираем тему дня (по дате)
    const themeIdx = parseInt(today.date.replace(/-/g, ''), 10) % themes.length;
    const theme = themes[themeIdx];
    if(!theme) return null;

    return React.createElement('section', { className: 'dp-section dp-section-narrow' },
      React.createElement('div', { className: 'dp-etude' },
        React.createElement('div', { className: 'dp-etude-content' },
          React.createElement('div', { className: 'dp-etude-tag' }, '🌅 Этюд дня'),
          React.createElement('h2', { className: 'dp-etude-title' },
            'Сегодня в Этюде: ', theme.name
          ),
          React.createElement('p', { className: 'dp-etude-sub' },
            'У тебя одна попытка в день. Постарайся сделать рекорд.'
          ),
          React.createElement('div', { className: 'dp-etude-meta' },
            data.streak?.current > 0 && React.createElement('span', { className: 'dp-etude-streak' },
              '🎼 Ритм: ', data.streak.current, ' дн.'),
            todayPlayed
              ? React.createElement('span', { className: 'dp-etude-played' }, '✓ Сыграно: ', todayPlayed.score, '/', todayPlayed.maxScore)
              : React.createElement('span', null, 'Не сыграно')
          ),
          React.createElement('button', { className: 'dp-btn dp-btn-primary', onClick: onPlay },
            todayPlayed ? 'Сыграть ещё раз →' : 'Сыграть Этюд →'
          )
        )
      )
    );
  }

  // ─── Партитура (карта мастерства по темам) ────────────────────
  function DPPartitura(){
    const themes = window.YasnaTrivia?.THEMES || [];
    if(themes.length === 0) return null;
    const Storage = _g('YasnaDuelStorage');
    const data = Storage?.getOverallStats?.() || {};
    // На MVP просто показываем темы с 0% (потом добавим расчёт по матчам)
    const masteryByTheme = data.masteryByTheme || {};

    return React.createElement('section', { className: 'dp-section' },
      React.createElement('div', { className: 'dp-section-title' }, '🎵 Твоя Партитура'),
      React.createElement('h2', { className: 'dp-section-h' }, '9 тем мира «Сутки»'),
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
              pct > 0 ? 'Освоение: ' + pct + '%' : 'Не сыграна'
            )
          );
        })
      )
    );
  }

  // ─── Архив (лидерборд) ────────────────────────────────────────
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
        React.createElement('h3', null, '📚 Архив недели'),
        items?.length > 0 && React.createElement('button', { className: 'dp-card-link', onClick: onOpen }, 'Полный →')
      ),
      items === null
        ? React.createElement('p', { style: {fontSize:13, color:'#999', textAlign:'center', padding:'24px 0'} }, 'Загрузка…')
        : items.length === 0
          ? React.createElement('div', null,
              React.createElement('div', { className: 'dp-lb-list', style: {opacity:0.45} },
                placeholder.map((row, idx) =>
                  React.createElement('div', { key: idx, className: 'dp-lb-row' },
                    React.createElement('span', { className: 'dp-lb-rank' },
                      idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'),
                    React.createElement('span', null, row.avatar),
                    React.createElement('span', { className: 'dp-lb-name' }, row.nickname),
                    React.createElement('span', { className: 'dp-lb-score' }, row.score)
                  )
                )
              ),
              React.createElement('p', { style: {fontSize:12, color:'#666', textAlign:'center', marginTop:12, marginBottom:0} },
                'Пока пусто. Сыграй Партию и стань первым в Архиве.'
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

  // ─── Знаки (Достижения) ───────────────────────────────────────
  function DPZnaki({ onOpen }){
    const Ach = _g('YasnaDuelAchievements');
    if(!Ach?.list || !Ach?.getUnlocked) return null;
    const all = Ach.list();
    const unlocked = Ach.getUnlocked() || [];
    if(!all.length) return null;
    return React.createElement('div', { className: 'dp-card' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, '🏅 Знаки Ордена'),
        React.createElement('span', { style: {color:'#6e6e73', fontSize:13} },
          unlocked.length, ' / ', all.length
        )
      ),
      React.createElement('div', { className: 'dp-znaki-row' },
        all.slice(0, 4).map(a => {
          const got = unlocked.includes(a.id);
          return React.createElement('div', {
            key: a.id, className: 'dp-znak' + (got ? '' : ' dp-znak-locked')
          },
            React.createElement('span', { style: {fontSize:24} }, a.emoji || '🏅'),
            React.createElement('div', { style: {fontSize:11, marginTop:4} }, a.title)
          );
        })
      ),
      React.createElement('button', { className: 'dp-card-link', onClick: onOpen,
        style: {marginTop:12, alignSelf:'flex-start'} },
        'Все Знаки →'
      )
    );
  }

  // ─── Auth Modal ────────────────────────────────────────────────
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

  // ─── Anon Onboarding ──────────────────────────────────────────
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

  // ─── Main App ──────────────────────────────────────────────────
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

    // Render Turnir as fullscreen
    if(turnirOpen){
      const Turnir = _g('YasnaTurnir');
      if(!Turnir){
        return React.createElement('div', { className: 'dp-root' },
          React.createElement('div', { style: {textAlign:'center', padding:60} }, 'Загрузка движка Партии…')
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
      React.createElement(DPHero, { isFirstTime, onLoginClick, onAnonStart: () => setAnonModal(true) }),

      (user || profile) && React.createElement('div', { style: {padding:'0 24px', maxWidth: 920, margin:'0 auto', width:'100%'} },
        React.createElement(DPProfileBar, { user, profile })
      ),

      (user || profile) && React.createElement(DPMainCTA, { onPlay: startTurnir }),

      !user && profile && React.createElement('div', { style: {padding:'0 24px'} },
        React.createElement(DPUpsell, { profile, onLoginClick })
      ),

      (user || profile) && React.createElement(DPEtude, { onPlay: startTurnir }),

      (user || profile) && React.createElement(DPPartitura, null),

      (user || profile) && React.createElement('section', { className: 'dp-section' },
        React.createElement('div', { className: 'dp-two-col' },
          React.createElement(DPArchive, { onOpen: startTurnir }),
          React.createElement(DPZnaki, { onOpen: startTurnir })
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
      if(ready){
        const root = document.getElementById('duel-page-root');
        if(root) ReactDOM.createRoot(root).render(React.createElement(DuelPageApp));
      } else if(attempts++ < 50){
        setTimeout(check, 100);
      } else {
        const root = document.getElementById('duel-page-root');
        if(root) ReactDOM.createRoot(root).render(React.createElement(DuelPageApp));
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
