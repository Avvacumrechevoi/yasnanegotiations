// ═══════════════════════════════════════════════════════════════════
// Duel Page — full-page entry для дуэлей.
// Заменяет модалку как основной вход. Использует window.DuelApp
// внутри fullscreen-режима для самого матча.
// ═══════════════════════════════════════════════════════════════════
(function(){
  const { useState, useEffect } = React;
  const Auth = window.YasnaDuelAuth;
  const Storage = window.YasnaDuelStorage;
  const Daily = window.YasnaDailyChallenge;
  const Leaderboard = window.YasnaLeaderboardClient;
  const Profile = window.YasnaDuelProfile;

  function getYasnaName(id){
    const T = window.YasnaData?.T || [];
    return T.find(t => t.id === id)?.n || id;
  }

  // ─── Header ────────────────────────────────────────────────────
  function DPHeader({ user, onLoginClick, onLogout }){
    return React.createElement('header', { className: 'dp-header' },
      React.createElement('a', { href: 'index.html', className: 'dp-header-brand' },
        React.createElement('span', { className: 'dp-header-brand-icon' }, '✦'),
        'Ясна'
      ),
      React.createElement('div', { className: 'dp-header-bread' },
        React.createElement('span', { className: 'dp-header-bread-sep' }, '/'),
        React.createElement('span', null, '⚔️ Дуэль')
      ),
      React.createElement('div', { className: 'dp-header-spacer' }),
      React.createElement('div', { className: 'dp-header-auth' },
        user
          ? React.createElement('div', { className: 'dp-auth-chip' },
              React.createElement('span', { className: 'dp-auth-chip-avatar' },
                user.avatar?.startsWith('http')
                  ? React.createElement('img', { src: user.avatar, alt: '' })
                  : (user.avatar || '🦊')
              ),
              React.createElement('span', null, user.nickname),
              React.createElement('span', { className: 'dp-auth-chip-source' }, '· Telegram'),
              React.createElement('button', { className: 'dp-auth-btn-small', onClick: onLogout }, 'Выйти')
            )
          : React.createElement('button', { className: 'dp-btn dp-btn-secondary', onClick: onLoginClick, style: {padding:'8px 16px',fontSize:13} }, '🔵 Войти')
      )
    );
  }

  // ─── Hero ──────────────────────────────────────────────────────
  function DPHero({ isFirstTime, onLoginClick, onAnonStart }){
    if(isFirstTime){
      return React.createElement('section', { className: 'dp-hero' },
        React.createElement('span', { className: 'dp-hero-emoji' }, '⚔️'),
        React.createElement('h1', null, 'Дуэль по Ясне'),
        React.createElement('p', { className: 'dp-hero-sub' },
          'Проверь, насколько хорошо ты знаешь Ясну. Играй с другом онлайн, тренируйся с ботом или участвуй в челлендже дня.'
        ),
        React.createElement('div', { className: 'dp-hero-cta' },
          React.createElement('button', { className: 'dp-btn dp-btn-primary dp-btn-large', onClick: onLoginClick },
            '🔵 Войти через Telegram'
          ),
          React.createElement('ul', { className: 'dp-hero-perks' },
            React.createElement('li', null, 'Глобальный лидерборд'),
            React.createElement('li', null, 'Синхронизация устройств'),
            React.createElement('li', null, 'Аватар из Telegram')
          ),
          React.createElement('button', { className: 'dp-btn dp-btn-text', onClick: onAnonStart, style: {marginTop:8} },
            'или Играть анонимно →'
          ),
          React.createElement('p', { className: 'dp-hero-anon-note' },
            'Прогресс будет только на этом устройстве. Можно войти потом.'
          )
        )
      );
    }
    return React.createElement('section', { className: 'dp-hero' },
      React.createElement('span', { className: 'dp-hero-emoji' }, '⚔️'),
      React.createElement('h1', null, 'Дуэль по Ясне'),
      React.createElement('p', { className: 'dp-hero-sub' },
        'Выбери режим, играй с другом или ботом, попадай в лидерборд.'
      )
    );
  }

  // ─── Anon Upsell ───────────────────────────────────────────────
  function DPUpsell({ profile, onLoginClick }){
    return React.createElement('div', { className: 'dp-upsell' },
      React.createElement('span', { className: 'dp-upsell-icon' }, profile?.avatar || '🦊'),
      React.createElement('div', { className: 'dp-upsell-text' },
        React.createElement('div', { className: 'dp-upsell-title' },
          'Вы играете анонимно как ', React.createElement('strong', null, profile?.nickname || 'Игрок')
        ),
        React.createElement('div', { className: 'dp-upsell-sub' },
          'Войдите через Telegram, чтобы попасть в глобальный лидерборд и сохранять прогресс между устройствами.'
        )
      ),
      React.createElement('button', { className: 'dp-btn dp-btn-primary', onClick: onLoginClick, style: {flexShrink:0} }, 'Войти →')
    );
  }

  // ─── Daily Challenge ───────────────────────────────────────────
  function DPDaily({ onPlay }){
    const today = Daily?.today?.();
    if(!today) return null;
    const game = window.YasnaDuels?.get?.(today.gameId);
    if(!game) return null;
    const data = Daily.load?.() || {};
    const todayPlayed = data.byDate?.[today.date];
    return React.createElement('section', { className: 'dp-section dp-section-narrow' },
      React.createElement('div', { className: 'dp-daily' },
        React.createElement('div', { className: 'dp-daily-content' },
          React.createElement('div', { className: 'dp-daily-tag' }, '🌅 Челлендж дня'),
          React.createElement('h2', { className: 'dp-daily-title' }, game.title, ' · ', getYasnaName(today.yasnaId)),
          React.createElement('p', { className: 'dp-daily-sub' },
            'Сегодня все играют один режим. У тебя одна попытка в день — постарайся сделать рекорд.'
          ),
          React.createElement('div', { className: 'dp-daily-meta' },
            data.streak?.current > 0 && React.createElement('span', { className: 'dp-daily-streak' }, '🔥 Серия: ', data.streak.current, ' дн.'),
            todayPlayed
              ? React.createElement('span', { className: 'dp-daily-played' }, '✓ Сегодня: ', todayPlayed.score, '/', todayPlayed.maxScore)
              : React.createElement('span', null, 'Сегодня ещё не играли')
          ),
          React.createElement('button', { className: 'dp-btn dp-btn-primary', onClick: onPlay },
            todayPlayed ? 'Сыграть ещё раз →' : 'Играть челлендж →'
          )
        )
      )
    );
  }

  // ─── Game Catalog ──────────────────────────────────────────────
  function DPGameCatalog({ onSelect }){
    const games = (window.YasnaDuels?.list?.() || []).slice().sort((a, b) => {
      const da = (a.difficulty || 1) - (b.difficulty || 1);
      if(da) return da;
      return (a.estimatedSec || 0) - (b.estimatedSec || 0);
    });
    if(games.length === 0) return null;
    const emojiMap = {
      'race-cross': '🏁','race-mngmt': '🎯','race-faith': '✨',
      'quiz-antipodes': '⚖️','mirror-fill': '🪞','speed-cross-yesno': '⚡',
    };
    return React.createElement('section', { className: 'dp-section' },
      React.createElement('div', { className: 'dp-section-title' }, '🎮 Режимы игры'),
      React.createElement('h2', { className: 'dp-section-h' }, 'Выбери режим'),
      React.createElement('div', { className: 'dp-games' },
        games.map(g =>
          React.createElement('button', { key: g.id, className: 'dp-game-card', onClick: () => onSelect(g) },
            React.createElement('div', { className: 'dp-game-card-cat' }, g.category),
            React.createElement('div', { className: 'dp-game-card-emoji' }, emojiMap[g.id] || '⚔️'),
            React.createElement('h3', { className: 'dp-game-card-title' }, g.title),
            React.createElement('p', { className: 'dp-game-card-sub' }, g.description || g.subtitle || ''),
            React.createElement('div', { className: 'dp-game-card-meta' },
              React.createElement('span', null, '≈', g.estimatedSec, 's'),
              React.createElement('span', null, '·'),
              React.createElement('span', { className: 'dp-game-card-stars' }, '★'.repeat(g.difficulty || 1)),
              React.createElement('span', { className: 'dp-game-card-cta', style: {marginLeft: 'auto'} }, 'Играть →')
            )
          )
        )
      )
    );
  }

  // ─── Join + How to ─────────────────────────────────────────────
  function DPJoinAndHowto({ onJoin }){
    const [code, setCode] = useState('');
    return React.createElement('section', { className: 'dp-section' },
      React.createElement('div', { className: 'dp-join-grid' },
        React.createElement('div', { className: 'dp-join-card' },
          React.createElement('h3', null, '📥 Войти по коду друга'),
          React.createElement('p', { style: {fontSize:13, color:'#6e6e73', margin:'0 0 12px'} },
            'Если друг создал комнату и прислал код'
          ),
          React.createElement('div', { className: 'dp-join-input-row' },
            React.createElement('input', {
              className: 'dp-join-input',
              placeholder: 'КОД', value: code, maxLength: 6,
              onChange: e => setCode(e.target.value.toUpperCase())
            }),
            React.createElement('button', {
              className: 'dp-btn dp-btn-primary',
              disabled: code.length !== 6,
              onClick: () => onJoin(code)
            }, 'Войти')
          )
        ),
        React.createElement('div', { className: 'dp-join-card' },
          React.createElement('h3', null, '✨ Как играть с другом'),
          React.createElement('div', { className: 'dp-howto' },
            React.createElement('ol', null,
              React.createElement('li', null, 'Выбери режим выше'),
              React.createElement('li', null, 'Создай комнату — получишь 6-значный код'),
              React.createElement('li', null, 'Отправь код другу в любом мессенджере'),
              React.createElement('li', null, 'Играйте 1 на 1 в реальном времени')
            ),
            React.createElement('p', { style: {fontSize:13, color:'#6e6e73', marginTop:12} },
              'Без друга? Тренируйся с ботом или жди ', React.createElement('strong', null, 'челленджа дня'), '.'
            )
          )
        )
      )
    );
  }

  // ─── Stats Preview ─────────────────────────────────────────────
  function DPStatsPreview({ onOpen }){
    if(!Storage?.getOverallStats) return null;
    const data = Storage.getOverallStats();
    const totals = data.totals || {};
    const winRate = totals.played ? Math.round((totals.wins / totals.played) * 100) : 0;
    const hasMatches = (totals.played || 0) > 0;
    return React.createElement('div', { className: 'dp-card' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, '📊 Твоя статистика'),
        React.createElement('button', { className: 'dp-card-link', onClick: onOpen }, 'Подробнее →')
      ),
      hasMatches
        ? React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'dp-stats-row' },
              React.createElement('div', { className: 'dp-stat' },
                React.createElement('div', { className: 'dp-stat-num' }, totals.played || 0),
                React.createElement('div', { className: 'dp-stat-label' }, 'Матчей')
              ),
              React.createElement('div', { className: 'dp-stat' },
                React.createElement('div', { className: 'dp-stat-num dp-stat-num-good' }, totals.wins || 0),
                React.createElement('div', { className: 'dp-stat-label' }, 'Побед')
              ),
              React.createElement('div', { className: 'dp-stat' },
                React.createElement('div', { className: 'dp-stat-num dp-stat-num-bad' }, totals.losses || 0),
                React.createElement('div', { className: 'dp-stat-label' }, 'Пораж.')
              ),
              React.createElement('div', { className: 'dp-stat' },
                React.createElement('div', { className: 'dp-stat-num' }, winRate + '%'),
                React.createElement('div', { className: 'dp-stat-label' }, 'Винрейт')
              )
            ),
            data.streaks?.overall?.current > 0 &&
              React.createElement('div', { style: {fontSize:13, color:'#6e6e73', textAlign:'center'} },
                '🔥 Серия: ',
                React.createElement('strong', { style: {color:'#dc2626'} }, data.streaks.overall.current),
                ' · Лучшая: ',
                React.createElement('strong', { style: {color:'#d4a574'} }, data.streaks.overall.best || 0)
              )
          )
        : React.createElement('p', { style: {textAlign:'center', color:'#999', fontSize:14, padding:'16px 0'} },
            'Сыграй первый матч — статистика появится здесь.'
          )
    );
  }

  // ─── Leaderboard Preview ───────────────────────────────────────
  function DPLeaderboardPreview({ onOpen }){
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(false);
    useEffect(() => {
      if(!Leaderboard?.isEnabled?.()){ setLoading(false); return; }
      setEnabled(true);
      Leaderboard.fetchLeaderboard({ gameId: 'race-cross', yasnaId: 'суток', period: 'all', limit: 5 })
        .then(res => { setItems(res?.items || []); setLoading(false); })
        .catch(() => setLoading(false));
    }, []);
    return React.createElement('div', { className: 'dp-card' },
      React.createElement('div', { className: 'dp-card-h' },
        React.createElement('h3', null, '🏆 Лидерборд'),
        React.createElement('button', { className: 'dp-card-link', onClick: onOpen }, 'Все режимы →')
      ),
      !enabled
        ? React.createElement('p', { style: {fontSize:13, color:'#999', textAlign:'center', padding:'16px 0'} }, 'Сервер временно недоступен')
        : loading
          ? React.createElement('p', { style: {fontSize:13, color:'#999', textAlign:'center', padding:'16px 0'} }, 'Загрузка…')
          : items.length === 0
            ? React.createElement('p', { style: {fontSize:13, color:'#999', textAlign:'center', padding:'16px 0'} }, 'Лидерборд пуст. Стань первым!')
            : React.createElement('div', { className: 'dp-lb-list' },
                items.map((row, idx) =>
                  React.createElement('div', { key: row.deviceId || idx, className: 'dp-lb-row' },
                    React.createElement('span', {
                      className: 'dp-lb-rank ' + (idx === 0 ? 'dp-lb-rank-1' : idx === 1 ? 'dp-lb-rank-2' : idx === 2 ? 'dp-lb-rank-3' : '')
                    }, idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '#' + (idx + 1)),
                    React.createElement('span', null, row.avatar || '🦊'),
                    React.createElement('span', { className: 'dp-lb-name' }, row.nickname),
                    React.createElement('span', { className: 'dp-lb-score' }, row.score != null ? row.score : '—')
                  )
                )
              ),
      React.createElement('p', { style: {fontSize:11, color:'#999', textAlign:'center', marginTop:12} },
        'Топ-5 в режиме «Кросс» · Ясна Суток'
      )
    );
  }

  // ─── How to Play ───────────────────────────────────────────────
  function DPHowToPlay(){
    const steps = [
      { num: 1, t: 'Выбери режим', d: 'Шесть режимов: гонки, тесты, drag-and-drop. От 30 секунд до 5 минут.' },
      { num: 2, t: 'Создай комнату', d: 'Получишь 6-значный код. Или присоединяйся по коду друга.' },
      { num: 3, t: 'Играйте 1на1', d: 'WebRTC соединение напрямую между браузерами. Без задержек.' },
      { num: 4, t: 'Попади в лидерборд', d: 'После победы результат улетает в глобальный топ. Войди через Telegram, чтобы тебя там видели.' }
    ];
    return React.createElement('section', { className: 'dp-section' },
      React.createElement('div', { className: 'dp-section-title' }, '✨ Как играть'),
      React.createElement('h2', { className: 'dp-section-h' }, '4 шага к первой дуэли'),
      React.createElement('div', { className: 'dp-howto-grid' },
        steps.map(s =>
          React.createElement('div', { key: s.num, className: 'dp-howto-step' },
            React.createElement('div', { className: 'dp-howto-step-num' }, s.num),
            React.createElement('div', { className: 'dp-howto-step-title' }, s.t),
            React.createElement('div', { className: 'dp-howto-step-text' }, s.d)
          )
        )
      )
    );
  }

  // ─── Achievements ──────────────────────────────────────────────
  function DPAchievements(){
    const Ach = window.YasnaDuelAchievements;
    if(!Ach?.list || !Ach?.getUnlocked) return null;
    const all = Ach.list();
    const unlocked = Ach.getUnlocked() || [];
    if(!all.length) return null;
    return React.createElement('section', { className: 'dp-section' },
      React.createElement('div', { className: 'dp-card-h', style: {marginBottom:8} },
        React.createElement('h2', { className: 'dp-section-h', style: {margin:0} }, '🏅 Достижения'),
        React.createElement('span', { style: {color:'#6e6e73', fontSize:14} },
          unlocked.length, ' / ', all.length
        )
      ),
      React.createElement('div', { className: 'dp-ach-progress-bar' },
        React.createElement('div', { className: 'dp-ach-progress-fill', style: { width: (unlocked.length / all.length * 100) + '%' } })
      ),
      React.createElement('div', { className: 'dp-achievements' },
        all.slice(0, 12).map(a => {
          const got = unlocked.includes(a.id);
          return React.createElement('div', {
            key: a.id, className: 'dp-ach' + (got ? '' : ' dp-ach-locked'), title: a.description
          },
            React.createElement('span', { className: 'dp-ach-emoji' }, a.emoji || '🏅'),
            React.createElement('div', { style: {fontWeight:600,fontSize:12} }, a.title),
            React.createElement('div', { style: {fontSize:10,color:'#999',marginTop:2} },
              got ? 'Получено' : (a.hint || 'Заблокировано')
            )
          );
        })
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
        const res = await Auth.loginWithTelegram(tgUser);
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
        React.createElement('div', { style: {fontSize:48, marginBottom:12} }, '🔵'),
        React.createElement('h2', null, 'Войти через Telegram'),
        React.createElement('p', null, 'Безопасный вход без паролей. Telegram передаст только имя и аватар.'),
        !baseUrl
          ? React.createElement('div', { style: {color:'#dc2626', fontSize:13} }, 'Сервер не настроен')
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

  // ─── Anon Onboarding ───────────────────────────────────────────
  function DPAnonOnboard({ onSave, onCancel }){
    const [nickname, setNickname] = useState('');
    const [avatar, setAvatar] = useState('🦊');
    const opts = window.YasnaDuelProfile?.AVATAR_OPTIONS || ['🦊'];
    const submit = () => {
      const nick = (nickname || '').trim().slice(0, 20);
      if(!nick) return;
      const profile = {
        nickname: nick, avatar,
        deviceId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'dev-' + Date.now()
      };
      Profile.save(profile);
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
        React.createElement('p', null, 'Это имя увидит соперник в матче. Можно поменять потом.'),
        React.createElement('input', {
          autoFocus: true, placeholder: 'Например, Иван',
          value: nickname, maxLength: 20,
          onChange: e => setNickname(e.target.value),
          onKeyDown: e => { if(e.key === 'Enter') submit(); },
          style: { width: '100%', padding: '12px 14px', fontSize: 16, border: '1.5px solid #e5e5ea', borderRadius: 10, margin: '0 0 16px', fontFamily: 'inherit', outline: 'none' }
        }),
        React.createElement('div', {
          style: {display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',marginBottom:16}
        },
          opts.map(em =>
            React.createElement('button', {
              key: em, onClick: () => setAvatar(em),
              style: {
                fontSize: 24, width: 40, height: 40,
                border: '1.5px solid ' + (avatar === em ? '#d4a574' : '#e5e5ea'),
                background: avatar === em ? '#fff8ec' : '#fff',
                borderRadius: 10, cursor: 'pointer'
              }
            }, em)
          )
        ),
        React.createElement('button', {
          className: 'dp-btn dp-btn-primary',
          onClick: submit, disabled: !nickname.trim(),
          style: {width:'100%'}
        }, 'Готово')
      )
    );
  }

  // ─── Main App ──────────────────────────────────────────────────
  function DuelPageApp(){
    const [user, setUser] = useState(() => Auth?.loadUser?.());
    const [profile, setProfile] = useState(() => Profile?.load?.());
    const [authModal, setAuthModal] = useState(false);
    const [anonModal, setAnonModal] = useState(false);
    const [duelOpen, setDuelOpen] = useState(false);
    const [, setTick] = useState(0);

    const isFirstTime = !user && !profile;

    const onLoginClick = () => setAuthModal(true);
    const onLoggedIn = (u) => {
      setUser(u);
      setProfile(Profile?.load?.());
      setAuthModal(false);
    };
    const onLogout = () => {
      Auth.logout();
      setUser(null);
      setTick(t => t + 1);
    };

    const requireProfile = (cb) => {
      if(user || profile){ cb(); return; }
      setAnonModal(true);
      window.__dpPendingPlay = cb;
    };
    const onAnonSaved = (p) => {
      setProfile(p);
      setAnonModal(false);
      const pending = window.__dpPendingPlay;
      delete window.__dpPendingPlay;
      if(pending) pending();
    };

    const openDuel = () => {
      requireProfile(() => setDuelOpen(true));
    };

    useEffect(() => {
      if(!duelOpen || !window.DuelApp) return;
      const div = document.createElement('div');
      div.id = 'duel-portal';
      document.body.appendChild(div);
      const root = ReactDOM.createRoot(div);
      const close = () => {
        try { root.unmount(); } catch(_){}
        div.remove();
        setDuelOpen(false);
        setTick(t => t + 1);
      };
      root.render(React.createElement(window.DuelApp, { onClose: close }));
      return () => { try { root.unmount(); } catch(_){} div.remove(); };
    }, [duelOpen]);

    return React.createElement('div', { className: 'dp-root' },
      React.createElement(DPHeader, { user, onLoginClick, onLogout }),
      React.createElement(DPHero, { isFirstTime, onLoginClick, onAnonStart: () => setAnonModal(true) }),
      !user && profile &&
        React.createElement('div', { style: {padding: '0 24px'} },
          React.createElement(DPUpsell, { profile, onLoginClick })
        ),
      React.createElement(DPDaily, { onPlay: openDuel }),
      React.createElement(DPGameCatalog, { onSelect: openDuel }),
      React.createElement(DPJoinAndHowto, { onJoin: openDuel }),
      React.createElement('section', { className: 'dp-section' },
        React.createElement('div', { className: 'dp-two-col' },
          React.createElement(DPStatsPreview, { onOpen: openDuel }),
          React.createElement(DPLeaderboardPreview, { onOpen: openDuel })
        )
      ),
      React.createElement(DPHowToPlay, null),
      React.createElement(DPAchievements, null),
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

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('duel-page-root');
    if(!root) return;
    ReactDOM.createRoot(root).render(React.createElement(DuelPageApp));
  });
})();
