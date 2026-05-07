// ═══════════════════════════════════════════════════════════════════
// Игра по Ясне · главная страница (layout v4 · профессиональный)
// Welcome / Profile-Hero / Quests / CTA / Партитура / Архив + Знаки
// ═══════════════════════════════════════════════════════════════════
(function(){
  const { useState, useEffect } = React;
  const _g = (n) => window[n];

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
    return React.createElement('header', { className: 'dp-header' },
      React.createElement('a', { href: 'index.html', className: 'dp-header-back' },
        React.createElement('span', { className: 'dp-header-back-arrow' }, '←'),
        React.createElement('span', null, 'Ясна')
      ),
      React.createElement('div', { className: 'dp-header-spacer' }),
      React.createElement('nav', { className: 'dp-header-nav' },
        React.createElement('a', { href: '#archive' }, 'Архив'),
        React.createElement('a', { href: '#znaki' }, 'Знаки'),
        user
          ? React.createElement('button', { className: 'dp-btn-text', onClick: onLogout }, 'Выйти')
          : React.createElement('button', { className: 'dp-btn dp-btn-primary', onClick: onLoginClick, style: { padding: '7px 14px', fontSize: 13 } }, 'Войти')
      )
    );
  }

  // ─── Welcome (только для первого визита) ────────────────
  function DPWelcome({ onLoginClick, onAnonStart }){
    return React.createElement('section', { className: 'dp-welcome' },
      React.createElement('div', { className: 'dp-welcome-eyebrow' }, 'Касталия Ясны'),
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
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, 'Партия'),
          React.createElement('div', { className: 'dp-welcome-pillar-text' }, '18 вопросов · 6 тем · 5–7 минут')
        ),
        React.createElement('div', { className: 'dp-welcome-pillar' },
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, 'Тень'),
          React.createElement('div', { className: 'dp-welcome-pillar-text' }, 'Бот-соперник с тремя ритмами')
        ),
        React.createElement('div', { className: 'dp-welcome-pillar' },
          React.createElement('div', { className: 'dp-welcome-pillar-label' }, 'Ступени'),
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
          React.createElement('span', null, busey, ' бусин'),
          React.createElement('span', { className: 'dp-hero-stats-sep' }, '·'),
          React.createElement('span', null, games, ' партий'),
          streak > 0 && React.createElement(React.Fragment, null,
            React.createElement('span', { className: 'dp-hero-stats-sep' }, '·'),
            React.createElement('span', { className: 'dp-hero-streak' }, 'серия ', streak)
          )
        ),
        React.createElement('div', { className: 'dp-hero-progress' },
          React.createElement('div', { className: 'dp-hero-progress-fill', style: { width: pct + '%' } })
        ),
        React.createElement('div', { className: 'dp-hero-progress-meta' },
          React.createElement('span', null, stupen.name, ' ', toRoman(stupen.subLevel)),
          React.createElement('span', null, stupen.to === Infinity ? 'высшая ступень' : 'до ' + STUPENI[STUPENI.indexOf(STUPENI.find(x => x.name === stupen.name)) + 1]?.name + ' · ' + toNext + ' бусин')
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

    const quests = [
      {
        id: 'etude',
        tag: 'Этюд',
        title: 'Один шанс\nв день',
        foot: todayPlayed ? 'Сыграно: ' + todayPlayed.score : '+30 бусин',
        footMute: !!todayPlayed
      },
      {
        id: 'gimn',
        tag: 'Гимн',
        title: 'Тема\n' + (todayTheme?.name || 'дня'),
        foot: '+15 бусин',
        footMute: false
      },
      {
        id: 'flash',
        tag: 'Молния',
        title: '9 вопросов\nна скорость',
        foot: '+20 бусин',
        footMute: false
      },
      {
        id: 'guest',
        tag: 'Гость',
        title: 'Партия\nс другом',
        foot: 'по коду',
        footMute: true
      },
    ];

    return React.createElement('section', { className: 'dp-section' },
      React.createElement('div', { className: 'dp-section-h-row' },
        React.createElement('h2', { className: 'dp-section-h' }, 'Сегодня'),
        React.createElement('span', { className: 'dp-section-h-sub' }, quests.length, ' задания')
      ),
      React.createElement('div', { className: 'dp-quests' },
        quests.map(q =>
          React.createElement('button', { key: q.id, className: 'dp-quest', onClick: onPlay },
            React.createElement('div', { className: 'dp-quest-tag' }, q.tag),
            React.createElement('div', { className: 'dp-quest-title' }, q.title.split('\n').map((l, i) =>
              React.createElement('span', { key: i }, l, i === 0 && q.title.includes('\n') ? React.createElement('br') : null)
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
        React.createElement('div', { className: 'dp-cta-sub' }, '6 тем · 18 вопросов · соперник Тень')
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
        React.createElement('h2', { className: 'dp-section-h' }, 'Партитура · 9 тем'),
        React.createElement('span', { className: 'dp-section-h-sub' }, 'Освоено ', opened, ' из ', themes.length)
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

  // ─── Архив (лидерборд) ───────────────────────────────────
  function DPArchive({ user }){
    const [items, setItems] = useState(null);
    useEffect(() => {
      const LB = _g('YasnaLeaderboardClient');
      if(!LB?.isEnabled?.()){ setItems([]); return; }
      LB.fetchLeaderboard({ gameId: 'turnir', yasnaId: 'суток', period: 'all', limit: 6 })
        .then(res => setItems(res?.items || []))
        .catch(() => setItems([]));
    }, []);

    const myDeviceId = user?.deviceId || _g('YasnaDuelProfile')?.load?.()?.deviceId;

    return React.createElement('div', { className: 'dp-card', id: 'archive' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, 'Архив недели'),
        React.createElement('span', { className: 'dp-card-meta' }, 'Сб 23:59')
      ),
      items === null
        ? React.createElement('div', { className: 'dp-lb-empty' }, 'Загрузка…')
        : items.length === 0
          ? React.createElement('div', { className: 'dp-lb-empty' }, 'Сыграй Партию — попади в Архив')
          : items.slice(0, 5).map((row, idx) => {
              const isMe = myDeviceId && row.deviceId === myDeviceId;
              return React.createElement('div', {
                key: row.deviceId || idx,
                className: 'dp-lb-row' + (isMe ? ' dp-lb-row-me' : '')
              },
                React.createElement('div', { className: 'dp-lb-left' },
                  React.createElement('span', { className: 'dp-lb-rank' }, idx + 1),
                  React.createElement('span', { className: 'dp-lb-name' }, row.nickname || 'Игрок')
                ),
                React.createElement('span', { className: 'dp-lb-score' }, row.score != null ? row.score : '—')
              );
            })
    );
  }

  // ─── Знаки ───────────────────────────────────────────────
  function DPZnaki(){
    const Ach = _g('YasnaDuelAchievements');
    if(!Ach?.list || !Ach?.getUnlocked) return React.createElement('div', { className: 'dp-card', id: 'znaki' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, 'Знаки'),
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
        React.createElement('h3', null, 'Знаки'),
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
