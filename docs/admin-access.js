// ═══════════════════════════════════════════════════════════════════
// Вкладка «Доступы» в админке: люди и реестр регистраций, роли,
// полномочия, персональные доступы, каталог возможностей, журнал.
//
// ПОЧЕМУ ФАЙЛ ПЕРЕПИСАН С НУЛЯ. Первая версия (1780 строк) была признана
// негодной целиком: ни один её запрос не совпадал с сервером. Она звала
// /access/owners, когда сервер отдаёт /people; читала журнал из поля, которого
// в ответе нет; требовала обязательную «Причину», которую сервер не читал
// вовсе; считала суперадминов по параметру ?role, которого сервер не
// поддерживает. Причина расхождения — код писался по ОПИСАНИЮ контракта, а не
// по работающим ручкам. Эта версия написана под контракт, снятый с
// задеплоенного server/access.js, и намеренно короче: меньше кода — меньше
// мест, где можно разойтись.
//
// ФАКТИЧЕСКИЙ КОНТРАКТ (проверен в проде):
//   GET  /access/me       → { role, roleTitle, rankLevel, caps[], isSuperadmin, features{} }
//   GET  /access/people?q=→ { people[{userId,nickname,role,explicit,email,emailVerified,
//                             registeredVia,createdAt,lastSeenAt,deleted,fullName,phone}],
//                             roles[{roleId,title,rankLevel,isDefault}], truncated }
//   GET  /access/catalog  → { features[], roleGrants{role:{feature:bool}}, roles[] }
//   GET  /access/audit    → { entries[] }
//   POST /access/role       { userId, roleId, note }
//   POST /access/grant      { ownerKey, feature, granted, source, expiresAt }
//   POST /access/revoke     { ownerKey, feature }
//   POST /access/role-grant { roleId, feature, granted }
//   POST /access/catalog    { features[] }
//
// ЧЕГО ЗДЕСЬ НЕТ СОЗНАТЕЛЬНО: полей, которые сервер не читает. Обещать
// человеку, что его текст уйдёт в журнал, и тихо его выбрасывать — хуже, чем
// не спрашивать вовсе. Причина отправляется только там, где сервер её принимает
// (смена роли).
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var h = React.createElement;

  var CAPS = [
    { key: 'cap:content.publish', title: 'Публиковать контент' },
    { key: 'cap:access.grant',    title: 'Выдавать доступы' },
    { key: 'cap:people.view',     title: 'Видеть людей' },
    { key: 'cap:audit.view',      title: 'Видеть журнал' },
    { key: 'cap:catalog.edit',    title: 'Править каталог' },
    { key: 'cap:roles.manage',    title: 'Управлять ролями' }
  ];

  // ─── цвета под тему ────────────────────────────────────────────────
  // На admin.html тёмная тема сделана ПРЯМЫМИ переопределениями, а переменные
  // --txt/--bg при этом остаются светлыми. Значит опираться на них нельзя:
  // жёстко заданный серый #3a3a3c на тёмном фоне читается как чёрный по
  // чёрному. Палитра выбирается по data-theme, а при переключении темы вкладка
  // перерисовывается (см. useThemeTick).
  function isDark() {
    try { return document.documentElement.getAttribute('data-theme') === 'dark'; }
    catch (_) { return false; }
  }
  function C() {
    var d = isDark();
    return {
      dim:  d ? 'rgba(255,255,255,.62)' : '#6e6e73',
      // Приглушённый серый подобран по КОНТРАСТУ, а не на глаз: #8a8a8e на белом
      // даёт 3.16:1 — ниже AA для мелкого текста, а .45 белого на #151515 даёт
      // 4.25:1, тоже мало. Проверено измерением на живой странице.
      faint: d ? 'rgba(255,255,255,.52)' : '#6b6f74',
      body: d ? 'rgba(255,255,255,.86)' : '#3a3a3c',
      line: d ? 'rgba(255,255,255,.14)' : '#e5e5ea',
      lineSoft: d ? 'rgba(255,255,255,.08)' : '#f0f0f3',
      fieldBg: d ? 'rgba(255,255,255,.06)' : '#ffffff',
      fieldBorder: d ? 'rgba(255,255,255,.22)' : '#d2d2d7',
      warnText: d ? '#f0c274' : '#8a5a12',
      badText: d ? '#ff9a9a' : '#a12d2d',
      rowBad: d ? 'rgba(255,90,90,.10)' : '#fff7f7',
      rowWarn: d ? 'rgba(240,180,80,.10)' : '#fffaf0',
      dot: d ? 'rgba(255,255,255,.30)' : '#c7c7cc',
      tabOnBg: d ? '#fefefe' : '#1d1d1f',
      tabOnText: d ? '#151515' : '#ffffff',
      tabOffBg: d ? 'rgba(255,255,255,.08)' : '#f5f5f7',
      noticeGoodBg: d ? 'rgba(60,200,120,.14)' : '#e4f6ea',
      noticeGoodText: d ? '#8fe3b0' : '#1c6b3c',
      noticeBadBg: d ? 'rgba(255,90,90,.14)' : '#fde8e8',
      noticeBadText: d ? '#ffa8a8' : '#8c2020',
      badge: {
        neutral: d ? ['rgba(255,255,255,.10)', 'rgba(255,255,255,.85)'] : ['#eceff3', '#3a3a3c'],
        good:    d ? ['rgba(60,200,120,.16)', '#7fe0a6'] : ['#e4f6ea', '#1c7a44'],
        warn:    d ? ['rgba(240,180,80,.16)', '#f0c274'] : ['#fdf1dd', '#8a5a12'],
        bad:     d ? ['rgba(255,90,90,.16)', '#ff9a9a'] : ['#fde8e8', '#a12d2d'],
        accent:  d ? ['rgba(90,150,255,.18)', '#9dc0ff'] : ['#e8effd', '#1e4fa3']
      }
    };
  }
  // Переключение темы на странице не перезагружает её, поэтому инлайновые
  // цвета иначе остались бы от прежней темы.
  function useThemeTick() {
    var t = React.useState(0);
    React.useEffect(function () {
      var obs = new MutationObserver(function () { t[1](function (n) { return n + 1; }); });
      try { obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (_) {}
      return function () { try { obs.disconnect(); } catch (_) {} };
    }, []);
    return t[0];
  }

  function apiBase() {
    try {
      var el = document.querySelector('meta[name="yasna:api"]');
      return (el && el.getAttribute('content')) || window.YASNA_LEADERBOARD_API || '';
    } catch (_) { return ''; }
  }
  function token() {
    try { return localStorage.getItem('yasna_duel_token') || ''; } catch (_) { return ''; }
  }

  // Все запросы через одну функцию: единая обработка ошибок. Ошибку НЕ глотаем
  // и не показываем пустым списком — молчаливые ошибки в этом проекте уже
  // прятали сломанный SQL месяцами.
  function api(path, opts) {
    var o = opts || {};
    var base = apiBase();
    if (!base) return Promise.reject(new Error('адрес API не задан на странице'));
    var headers = { 'Content-Type': 'application/json' };
    var t = token();
    if (t) headers.Authorization = 'Bearer ' + t;
    return fetch(base + path, {
      method: o.method || 'GET',
      headers: headers,
      body: o.body ? JSON.stringify(o.body) : undefined
    }).then(function (r) {
      return r.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) {}
        if (!r.ok) {
          var msg = (data && (data.reason || data.detail || data.error)) || ('HTTP ' + r.status);
          var err = new Error(msg);
          err.code = r.status;
          throw err;
        }
        return data || {};
      });
    });
  }

  function human(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return String(iso).slice(0, 16); }
  }
  function dateOnly(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('ru-RU'); } catch (_) { return String(iso).slice(0, 10); }
  }
  function roleTitle(roles, roleId) {
    for (var i = 0; i < (roles || []).length; i++) if (roles[i].roleId === roleId) return roles[i].title;
    return roleId || '—';
  }

  function Badge(props) {
    var c = C();
    var colors = c.badge[props.tone || 'neutral'] || c.badge.neutral;
    return h('span', {
      style: {
        display: 'inline-block', padding: '2px 8px', borderRadius: 999,
        background: colors[0], color: colors[1], fontSize: 12, whiteSpace: 'nowrap'
      }
    }, props.children);
  }

  function Notice(props) {
    if (!props.text) return null;
    var bad = props.tone === 'bad';
    var c = C();
    return h('div', {
      style: {
        margin: '10px 0', padding: '10px 12px', borderRadius: 10, fontSize: 14,
        background: bad ? c.noticeBadBg : c.noticeGoodBg,
        color: bad ? c.noticeBadText : c.noticeGoodText
      }
    }, props.text);
  }

  // ─── люди и реестр регистраций ──────────────────────────────────────
  // Это один экран намеренно: «реестр регистраций» и «список людей» — одни и те
  // же строки, разница лишь в том, на какие колонки смотреть. Два экрана с
  // одними данными пришлось бы держать в согласии вручную.
  function PeopleView(props) {
    var me = props.me;
    var st = React.useState({ q: '', loading: true, error: null, people: [], roles: [], truncated: false });
    var state = st[0], set = st[1];
    var selSt = React.useState(null);
    var sel = selSt[0], setSel = selSt[1];
    var msgSt = React.useState(null);
    var msg = msgSt[0], setMsg = msgSt[1];

    function load(q) {
      set(function (s) { return Object.assign({}, s, { loading: true, error: null }); });
      api('/access/people' + (q ? '?q=' + encodeURIComponent(q) : ''))
        .then(function (d) {
          set({ q: q || '', loading: false, error: null, people: d.people || [],
                roles: d.roles || [], truncated: !!d.truncated });
        })
        .catch(function (e) {
          set(function (s) { return Object.assign({}, s, { loading: false, error: e.message }); });
        });
    }
    React.useEffect(function () { load(''); }, []);

    if (me.caps.indexOf('cap:people.view') < 0) {
      return h('div', null,
        h('div', { style: { fontSize: 15 } }, 'Нет полномочия «Видеть людей».'),
        h('div', { style: { fontSize: 13, color: C().dim, marginTop: 6 } },
          'Его выдаёт суперадмин на этой же вкладке.'));
    }

    var superCount = state.people.filter(function (p) { return p.role === 'superadmin'; }).length;
    var byEmail = state.people.filter(function (p) { return p.registeredVia === 'email'; }).length;

    return h('div', null,
      h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' } },
        h('input', {
          type: 'search', placeholder: 'Ник, почта или user_id — и Enter',
          defaultValue: state.q,
          onKeyDown: function (e) { if (e.key === 'Enter') load(e.target.value.trim()); },
          style: { flex: '1 1 220px', minWidth: 180, padding: '8px 10px', borderRadius: 8, border: '1px solid ' + C().fieldBorder, background: C().fieldBg, color: 'inherit' }
        }),
        h('button', { className: 'ad-btn', onClick: function () { load(state.q); } }, 'Обновить'),
        h('span', { style: { fontSize: 13, color: C().dim } },
          'всего: ' + state.people.length + (state.truncated ? ' (показаны не все)' : '') + ' · по почте: ' + byEmail),
        h(Badge, { tone: superCount > 1 ? 'good' : 'warn' }, 'суперадминов: ' + superCount)
      ),
      superCount === 1 ? h('div', { style: { fontSize: 13, color: C().warnText, marginBottom: 10 } },
        'Суперадмин один. Если потерять доступ к этому аккаунту, управление платформой придётся восстанавливать через базу — стоит выдать роль кому-то ещё.') : null,
      state.error ? h(Notice, { tone: 'bad', text: 'Не удалось загрузить: ' + state.error }) : null,
      msg ? h(Notice, { tone: msg.tone, text: msg.text }) : null,
      state.loading ? h('div', { style: { color: C().dim } }, 'Загружаю…') : null,

      h('div', { style: { overflowX: 'auto' } },
        h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 14 } },
          h('thead', null, h('tr', { style: { textAlign: 'left', color: C().dim, fontSize: 12 } },
            ['Человек', 'Почта', 'Как пришёл', 'Роль', 'Регистрация', 'Последний вход', ''].map(function (t, i) {
              return h('th', { key: i, style: { padding: '8px 10px', borderBottom: '1px solid ' + C().line, whiteSpace: 'nowrap' } }, t);
            }))),
          h('tbody', null, state.people.map(function (p) {
            return h('tr', { key: p.userId, style: { borderBottom: '1px solid ' + C().lineSoft, opacity: p.deleted ? 0.5 : 1 } },
              h('td', { style: { padding: '8px 10px' } },
                h('div', { style: { fontWeight: 500 } }, p.nickname || '—',
                  p.deleted ? h('span', { style: { fontSize: 11, color: C().badText } }, ' удалён') : null),
                p.fullName ? h('div', { style: { fontSize: 12, color: C().dim } }, p.fullName) : null,
                p.phone ? h('div', { style: { fontSize: 12, color: C().dim } }, p.phone) : null,
                h('div', { style: { fontSize: 11, color: C().faint, fontFamily: 'ui-monospace, monospace' } }, String(p.userId).slice(0, 8) + '…')),
              h('td', { style: { padding: '8px 10px' } },
                p.email
                  ? h('div', null, h('div', null, p.email),
                      h(Badge, { tone: p.emailVerified ? 'good' : 'warn' }, p.emailVerified ? 'подтверждена' : 'не подтверждена'))
                  : h('span', { style: { color: C().faint } }, '—')),
              h('td', { style: { padding: '8px 10px' } },
                h(Badge, { tone: p.registeredVia === 'email' ? 'accent' : 'neutral' },
                  p.registeredVia === 'email' ? 'почта' : 'Telegram')),
              h('td', { style: { padding: '8px 10px' } },
                h(Badge, { tone: p.role === 'superadmin' ? 'bad' : (p.role === 'admin' ? 'accent' : 'neutral') },
                  roleTitle(state.roles, p.role)),
                p.explicit ? null : h('div', { style: { fontSize: 11, color: C().faint, marginTop: 3 } }, 'по умолчанию')),
              h('td', { style: { padding: '8px 10px', whiteSpace: 'nowrap' } }, dateOnly(p.createdAt)),
              h('td', { style: { padding: '8px 10px', whiteSpace: 'nowrap', color: C().dim } }, human(p.lastSeenAt)),
              h('td', { style: { padding: '8px 10px' } },
                h('button', { className: 'ad-btn', onClick: function () { setSel(p); setMsg(null); } }, 'Открыть')));
          }))
        )
      ),

      sel ? h(OwnerCard, {
        owner: sel, roles: state.roles, me: me, catalog: props.catalog,
        superCount: superCount,
        onClose: function () { setSel(null); },
        onDone: function (text) { setMsg({ tone: 'good', text: text }); load(state.q); },
        onError: function (text) { setMsg({ tone: 'bad', text: text }); }
      }) : null
    );
  }

  // ─── карточка человека ──────────────────────────────────────────────
  function OwnerCard(props) {
    var owner = props.owner, me = props.me;
    var roleSt = React.useState(owner.role);
    var role = roleSt[0], setRole = roleSt[1];
    var noteSt = React.useState('');
    var note = noteSt[0], setNote = noteSt[1];
    var busySt = React.useState(false);
    var busy = busySt[0], setBusy = busySt[1];

    var canRoles = me.caps.indexOf('cap:roles.manage') >= 0;
    var canGrant = me.caps.indexOf('cap:access.grant') >= 0;
    // Сервер отклонит понижение последнего суперадмина с 409. Показываем это ДО
    // нажатия: человек не должен ловить ошибку на действии, которое заведомо
    // не пройдёт.
    var lastSuper = owner.role === 'superadmin' && props.superCount <= 1 && role !== 'superadmin';

    function saveRole() {
      setBusy(true);
      api('/access/role', { method: 'POST', body: { userId: owner.userId, roleId: role, note: note || undefined } })
        .then(function () { setBusy(false); props.onDone('Роль изменена: ' + roleTitle(props.roles, role)); })
        .catch(function (e) { setBusy(false); props.onError('Роль не изменена: ' + e.message); });
    }

    return h('div', { style: { marginTop: 16, border: '1px solid ' + C().fieldBorder, borderRadius: 12, padding: 16 } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' } },
        h('div', null,
          h('div', { style: { fontSize: 17, fontWeight: 600 } }, owner.nickname || owner.userId),
          h('div', { style: { fontSize: 12, color: C().faint, fontFamily: 'ui-monospace, monospace' } }, 'usr:' + owner.userId),
          owner.email ? h('div', { style: { fontSize: 13, color: C().body, marginTop: 4 } },
            owner.email + (owner.emailVerified ? ' · подтверждена' : ' · не подтверждена')) : null),
        h('button', { className: 'ad-btn', onClick: props.onClose }, 'Закрыть')),

      h('div', { style: { marginTop: 16 } },
        h('div', { style: { fontWeight: 600, marginBottom: 8 } }, 'Роль'),
        !canRoles
          ? h('div', { style: { fontSize: 13, color: C().dim } }, 'Менять роли может только тот, у кого есть полномочие «Управлять ролями».')
          : h('div', null,
              props.roles.map(function (r) {
                return h('label', { key: r.roleId, style: { display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 16, cursor: 'pointer' } },
                  h('input', { type: 'radio', name: 'role-' + owner.userId, checked: role === r.roleId,
                    onChange: function () { setRole(r.roleId); } }),
                  h('span', null, r.title),
                  r.isDefault ? h('span', { style: { fontSize: 11, color: C().faint } }, '(по умолчанию)') : null);
              }),
              h('div', { style: { marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
                h('input', {
                  placeholder: 'Причина — попадёт в журнал', value: note,
                  onChange: function (e) { setNote(e.target.value); },
                  style: { flex: '1 1 240px', padding: '7px 10px', borderRadius: 8, border: '1px solid ' + C().fieldBorder, background: C().fieldBg, color: 'inherit' }
                }),
                h('button', {
                  className: 'ad-btn', disabled: busy || role === owner.role || lastSuper,
                  onClick: saveRole
                }, busy ? 'Сохраняю…' : 'Сохранить роль')),
              lastSuper ? h('div', { style: { marginTop: 6, fontSize: 13, color: C().badText } },
                'Это последний суперадмин — сначала выдайте роль кому-то ещё, иначе платформа останется без управления.') : null)),

      h('div', { style: { marginTop: 20 } },
        h('div', { style: { fontWeight: 600, marginBottom: 4 } }, 'Полномочия роли «' + roleTitle(props.roles, role) + '»'),
        h('div', { style: { fontSize: 12, color: C().dim, marginBottom: 8 } },
          'Галочки относятся к РОЛИ, а не к одному человеку: меняя их, вы меняете права всех, у кого эта роль.'),
        h(RoleCaps, { roleId: role, me: me, catalog: props.catalog, onError: props.onError, onDone: props.onDone })),

      h('div', { style: { marginTop: 20 } },
        h('div', { style: { fontWeight: 600, marginBottom: 4 } }, 'Персональные доступы'),
        h('div', { style: { fontSize: 12, color: C().dim, marginBottom: 8 } },
          '«Наследовать» — как у роли. «Открыть» и «Закрыть» — исключение именно для этого человека.'),
        !canGrant
          ? h('div', { style: { fontSize: 13, color: C().dim } }, 'Нужно полномочие «Выдавать доступы».')
          : h(OwnerFeatures, { ownerKey: 'usr:' + owner.userId, catalog: props.catalog,
                               onError: props.onError, onDone: props.onDone })));
  }

  function RoleCaps(props) {
    var canManage = props.me.caps.indexOf('cap:roles.manage') >= 0;
    var grants = (props.catalog && props.catalog.roleGrants && props.catalog.roleGrants[props.roleId]) || {};
    var localSt = React.useState({});
    var local = localSt[0], setLocal = localSt[1];

    function toggle(cap, next) {
      if (!canManage) return;
      var patch = {}; patch[cap] = next;
      setLocal(Object.assign({}, local, patch));
      api('/access/role-grant', { method: 'POST', body: { roleId: props.roleId, feature: cap, granted: next } })
        .then(function () { props.onDone('Полномочие обновлено у роли «' + props.roleId + '»'); })
        .catch(function (e) {
          // Возвращаем галочку обратно: показывать «включено», когда сервер
          // отказал, — значит врать человеку о состоянии прав.
          var revert = {}; revert[cap] = !next;
          setLocal(Object.assign({}, local, revert));
          props.onError('Полномочие не изменено: ' + e.message);
        });
    }

    return h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 8 } },
      CAPS.map(function (c) {
        var on = local[c.key] !== undefined ? local[c.key] : !!grants[c.key];
        var locked = !canManage || (props.roleId === 'superadmin' && c.key === 'cap:roles.manage');
        return h('label', { key: c.key, style: { display: 'flex', alignItems: 'center', gap: 8, opacity: locked ? 0.6 : 1, cursor: locked ? 'default' : 'pointer' } },
          h('input', { type: 'checkbox', checked: on, disabled: locked,
            onChange: function (e) { toggle(c.key, e.target.checked); } }),
          h('span', null, c.title,
            locked && props.roleId === 'superadmin' && c.key === 'cap:roles.manage'
              ? h('span', { style: { fontSize: 11, color: C().faint } }, ' — снять нельзя') : null));
      }));
  }

  function OwnerFeatures(props) {
    var features = (props.catalog && props.catalog.features) || [];
    var stateSt = React.useState({ loading: false, error: null, note: null });
    var s = stateSt[0], setS = stateSt[1];

    if (!features.length) {
      return h('div', { style: { fontSize: 13, color: C().dim } },
        'Каталог возможностей пуст: разделы ещё не объявили, что можно открывать и закрывать. Опубликуйте каталог на подвкладке «Каталог».');
    }

    function act(feature, mode) {
      setS({ loading: true, error: null, note: null });
      var req = mode === 'inherit'
        ? api('/access/revoke', { method: 'POST', body: { ownerKey: props.ownerKey, feature: feature } })
        : api('/access/grant', { method: 'POST', body: { ownerKey: props.ownerKey, feature: feature, granted: mode === 'open', source: 'manual' } });
      req.then(function () {
        setS({ loading: false, error: null,
               note: feature + ' → ' + (mode === 'inherit' ? 'наследует роль' : (mode === 'open' ? 'открыт' : 'закрыт')) });
        props.onDone('Доступ обновлён: ' + feature);
      }).catch(function (e) {
        setS({ loading: false, error: e.message, note: null });
        props.onError('Доступ не изменён: ' + e.message);
      });
    }

    return h('div', null,
      s.error ? h(Notice, { tone: 'bad', text: s.error }) : null,
      s.note ? h(Notice, { text: s.note }) : null,
      features.slice(0, 200).map(function (f) {
        return h('div', { key: f.feature, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid ' + C().lineSoft, flexWrap: 'wrap' } },
          h('div', { style: { flex: '1 1 220px' } },
            h('div', null, f.title || f.feature),
            h('div', { style: { fontSize: 11, color: C().faint, fontFamily: 'ui-monospace, monospace' } },
              f.feature + (f.sensitive ? ' · проверяется сервером' : ' · только витрина'))),
          ['inherit', 'open', 'closed'].map(function (m) {
            return h('button', { key: m, className: 'ad-btn', disabled: s.loading,
              onClick: function () { act(f.feature, m); }, style: { fontSize: 12 } },
              m === 'inherit' ? 'наследовать' : (m === 'open' ? 'открыть' : 'закрыть'));
          }));
      }));
  }

  // ─── матрица роли × возможности ─────────────────────────────────────
  function MatrixView(props) {
    var cat = props.catalog;
    if (!cat) return h('div', { style: { color: C().dim } }, 'Загружаю каталог…');
    var roles = cat.roles || [];
    var keys = CAPS.map(function (c) { return c.key; })
      .concat((cat.features || []).map(function (f) { return f.feature; }));
    if (!keys.length || !roles.length) return h('div', { style: { color: C().dim } }, 'Нечего показывать: каталог пуст.');

    return h('div', null,
      h('div', { style: { fontSize: 13, color: C().dim, marginBottom: 10 } },
        '✓ открыто роли, ✕ закрыто явно, · не задано (действует правило по умолчанию).'),
      h('div', { style: { overflowX: 'auto' } },
        h('table', { style: { borderCollapse: 'collapse', fontSize: 13 } },
          h('thead', null, h('tr', null,
            h('th', { style: { textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid ' + C().line } }, 'Возможность'),
            roles.map(function (r) {
              return h('th', { key: r.roleId, style: { padding: '6px 10px', borderBottom: '1px solid ' + C().line, whiteSpace: 'nowrap' } }, r.title);
            }))),
          h('tbody', null, keys.map(function (k) {
            return h('tr', { key: k, style: { borderBottom: '1px solid ' + C().lineSoft } },
              h('td', { style: { padding: '6px 10px', fontFamily: k.indexOf('cap:') === 0 ? 'inherit' : 'ui-monospace, monospace' } }, k),
              roles.map(function (r) {
                var g = (cat.roleGrants && cat.roleGrants[r.roleId]) || {};
                var v = g[k];
                return h('td', { key: r.roleId, style: { padding: '6px 10px', textAlign: 'center' } },
                  v === true ? '✓' : (v === false ? '✕' : h('span', { style: { color: C().dot } }, '·')));
              }));
          })))));
  }

  // ─── каталог ────────────────────────────────────────────────────────
  // Черновики узлов живут НА СТРАНИЦАХ (каждый раздел объявляет себя через
  // YasnaAccess.declare() там, где он и так перечислен). Поэтому «Собрать
  // каталог» открывает страницы в скрытых iframe того же origin, читает
  // из каждого YasnaAccess.declared() и сливает. Плюс накопленный черновик
  // localStorage этой страницы (catalog() с source != 'server').
  var HARVEST_PAGES = ['konstruktor.html', 'duel.html', 'learn.html',
                       'index.html', 'rating.html', 'negotiations.html'];

  function pickNode(n) {
    return { feature: n.feature, area: n.area, parent: n.parent, title: n.title,
             kind: n.kind, defaultAccess: n.defaultAccess, status: n.status,
             sensitive: !!n.sensitive, declaredAt: n.declaredAt || null };
  }

  function CatalogView(props) {
    var cat = props.catalog;
    var stSt = React.useState({ busy: null, msg: null, err: null, harvest: null, log: [] });
    var st = stSt[0], setSt = stSt[1];
    var canEdit = props.me.caps.indexOf('cap:catalog.edit') >= 0;

    function localDraft(into) {
      try {
        (window.YasnaAccess && window.YasnaAccess.catalog ? window.YasnaAccess.catalog() : [])
          .forEach(function (n) { if (n.source !== 'server') into[n.feature] = pickNode(n); });
      } catch (_) {}
    }

    function harvest() {
      var collected = {};
      localDraft(collected);
      var log = [], idx = 0;
      setSt({ busy: 'Собираю каталог со страниц…', msg: null, err: null, harvest: null, log: [] });

      function done() {
        var nodes = Object.keys(collected).sort().map(function (k) { return collected[k]; });
        var onServer = {};
        ((cat && cat.features) || []).forEach(function (f) { onServer[f.feature] = f; });
        var fresh = nodes.filter(function (n) { return !onServer[n.feature]; }).length;
        setSt({ busy: null, err: null, harvest: nodes, log: log,
                msg: 'Собрано узлов: ' + nodes.length + ' (новых для сервера: ' + fresh + '). Проверь список и публикуй.' });
      }

      function next() {
        if (idx >= HARVEST_PAGES.length) { done(); return; }
        var page = HARVEST_PAGES[idx++];
        var fr = document.createElement('iframe');
        fr.style.cssText = 'position:absolute;width:2px;height:2px;border:0;visibility:hidden';
        var settled = false;
        var timer = setTimeout(function () { finish('таймаут 20с'); }, 20000);
        function finish(note) {
          if (settled) return; settled = true; clearTimeout(timer);
          var got = 0;
          try {
            var A = fr.contentWindow && fr.contentWindow.YasnaAccess;
            var nodes = (A && typeof A.declared === 'function') ? (A.declared() || []) : [];
            nodes.forEach(function (n) { collected[n.feature] = pickNode(n); });
            got = nodes.length;
          } catch (e) { note = (note ? note + '; ' : '') + ((e && e.message) || e); }
          log.push(page + ' — узлов: ' + got + (note ? ' (' + note + ')' : ''));
          setSt(function (prev) { return Object.assign({}, prev, { log: log.slice() }); });
          try { fr.parentNode && fr.parentNode.removeChild(fr); } catch (_) {}
          next();
        }
        // После load ждём ещё немного: declare() пишет черновик отложенно
        // (setTimeout(0)), а тяжёлые страницы регистрируют режимы при
        // выполнении бандла.
        fr.onload = function () { setTimeout(function () { finish(null); }, 1500); };
        fr.onerror = function () { finish('не загрузилась'); };
        fr.src = page + '?harvest=1';
        document.body.appendChild(fr);
      }
      next();
    }

    function publish() {
      var nodes = st.harvest;
      if (!nodes || !nodes.length) {
        setSt(function (prev) { return Object.assign({}, prev, {
          err: 'Сначала нажми «Собрать каталог» — публикуется именно собранный список.' }); });
        return;
      }
      setSt(function (prev) { return Object.assign({}, prev, { busy: 'Публикую…', msg: null, err: null }); });
      api('/access/catalog', { method: 'POST', body: { features: nodes } })
        .then(function (d) {
          setSt(function (prev) { return Object.assign({}, prev, { busy: null, err: null,
                  msg: 'Опубликовано узлов: ' + d.upserted + (d.rejected && d.rejected.length ? ', отклонено: ' + d.rejected.length : '') }); });
          props.reload();
        })
        .catch(function (e) { setSt(function (prev) { return Object.assign({}, prev, { busy: null, msg: null, err: e.message }); }); });
    }

    var list = (cat && cat.features) || [];
    var serverByKey = {};
    list.forEach(function (f) { serverByKey[f.feature] = f; });

    return h('div', null,
      h('div', { style: { fontSize: 13, color: C().dim, marginBottom: 10 } },
        'Каталог — список того, что вообще можно открывать и закрывать. Разделы объявляют свои узлы сами (YasnaAccess.declare), поэтому новый тренажёр появляется здесь без правки кода прав. Публикация ничего не закрывает: доступ меняется только галочками в Матрице.'),
      st.err ? h(Notice, { tone: 'bad', text: st.err }) : null,
      st.msg ? h(Notice, { text: st.msg }) : null,
      canEdit
        ? h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            h('button', { className: 'ad-btn', disabled: !!st.busy, onClick: harvest },
              st.busy === 'Собираю каталог со страниц…' ? st.busy : 'Собрать каталог со страниц'),
            h('button', { className: 'ad-btn', disabled: !!st.busy || !st.harvest || !st.harvest.length, onClick: publish },
              st.busy === 'Публикую…' ? st.busy : 'Опубликовать собранное'))
        : h('div', { style: { fontSize: 13, color: C().dim } }, 'Для публикации нужно полномочие «Править каталог».'),
      st.log.length
        ? h('div', { style: { marginTop: 8, fontSize: 12, color: C().dim, fontFamily: 'ui-monospace, monospace' } },
            st.log.map(function (l, i) { return h('div', { key: i }, l); }))
        : null,
      st.harvest
        ? h('div', { style: { marginTop: 12 } },
            h('div', { style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, 'Собрано (' + st.harvest.length + '):'),
            st.harvest.slice(0, 400).map(function (n) {
              var known = serverByKey[n.feature];
              return h('div', { key: n.feature, style: { padding: '4px 0', borderBottom: '1px solid ' + C().lineSoft, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
                h('span', { style: { fontFamily: 'ui-monospace, monospace', fontSize: 12, flex: '1 1 240px' } }, n.feature),
                h(Badge, { tone: known ? 'neutral' : 'good' }, known ? 'на сервере' : 'новый'),
                n.status === 'wip' ? h(Badge, { tone: 'warn' }, 'wip') : null,
                n.sensitive ? h(Badge, { tone: 'accent' }, 'сервер') : null,
                h('span', { style: { fontSize: 12, color: C().dim } }, n.title || ''));
            }))
        : null,
      h('div', { style: { marginTop: 12, fontSize: 13 } },
        list.length ? ('Узлов на сервере: ' + list.length) : 'На сервере каталог пуст.'),
      h('div', { style: { marginTop: 8 } }, list.slice(0, 300).map(function (f) {
        return h('div', { key: f.feature, style: { padding: '5px 0', borderBottom: '1px solid ' + C().lineSoft, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
          h('span', { style: { fontFamily: 'ui-monospace, monospace', fontSize: 12, flex: '1 1 240px' } }, f.feature),
          h(Badge, { tone: f.defaultAccess === 'closed' ? 'bad' : (f.defaultAccess === 'account' ? 'warn' : 'good') }, f.defaultAccess || '—'),
          h(Badge, { tone: f.status === 'live' ? 'neutral' : 'warn' }, f.status || '—'),
          f.sensitive ? h(Badge, { tone: 'accent' }, 'сервер') : null,
          h('span', { style: { fontSize: 12, color: C().dim } }, f.title || ''));
      })));
  }

  // ─── журнал ─────────────────────────────────────────────────────────
  function AuditView(props) {
    var stSt = React.useState({ loading: true, error: null, entries: [] });
    var st = stSt[0], setSt = stSt[1];
    var canView = props.me.caps.indexOf('cap:audit.view') >= 0;

    React.useEffect(function () {
      if (!canView) { setSt({ loading: false, error: null, entries: [] }); return; }
      api('/access/audit?limit=100')
        .then(function (d) { setSt({ loading: false, error: null, entries: d.entries || [] }); })
        .catch(function (e) { setSt({ loading: false, error: e.message, entries: [] }); });
    }, [canView]);

    if (!canView) return h('div', { style: { fontSize: 14, color: C().dim } }, 'Нужно полномочие «Видеть журнал».');

    return h('div', null,
      h('div', { style: { fontSize: 13, color: C().dim, marginBottom: 10 } },
        'Пишутся и успешные действия, и ОТКАЗЫ: по одним успехам украденный токен неотличим от обычной работы.'),
      st.error ? h(Notice, { tone: 'bad', text: st.error }) : null,
      st.loading ? h('div', { style: { color: C().dim } }, 'Загружаю…') : null,
      h('div', { style: { overflowX: 'auto' } },
        h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 } },
          h('thead', null, h('tr', { style: { textAlign: 'left', color: C().dim, fontSize: 12 } },
            ['Когда', 'Кто', 'Что', 'Над кем', 'Итог', 'Почему'].map(function (t, i) {
              return h('th', { key: i, style: { padding: '7px 10px', borderBottom: '1px solid ' + C().line, whiteSpace: 'nowrap' } }, t);
            }))),
          h('tbody', null, st.entries.map(function (e, i) {
            var denied = e.result === 'denied', error = e.result === 'error';
            return h('tr', { key: e.id || i, style: { borderBottom: '1px solid ' + C().lineSoft, background: denied ? C().rowBad : (error ? C().rowWarn : 'transparent') } },
              h('td', { style: { padding: '7px 10px', whiteSpace: 'nowrap' } }, human(e.at)),
              h('td', { style: { padding: '7px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 11 } }, String(e.actor || '').slice(0, 26)),
              h('td', { style: { padding: '7px 10px' } }, e.action || '—'),
              h('td', { style: { padding: '7px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 11 } }, String(e.target || '—').slice(0, 26)),
              h('td', { style: { padding: '7px 10px' } },
                h(Badge, { tone: denied ? 'bad' : (error ? 'warn' : 'good') }, e.result || '—')),
              h('td', { style: { padding: '7px 10px', color: C().body } }, e.reason || ''));
          })))));
  }

  // ─── корень вкладки ─────────────────────────────────────────────────
  function AccessTab() {
    useThemeTick();   // перерисовка при переключении темы страницы
    var meSt = React.useState(null);
    var me = meSt[0], setMe = meSt[1];
    var errSt = React.useState(null);
    var err = errSt[0], setErr = errSt[1];
    var catSt = React.useState(null);
    var cat = catSt[0], setCat = catSt[1];
    var viewSt = React.useState('people');
    var view = viewSt[0], setView = viewSt[1];

    function loadCatalog() {
      api('/access/catalog').then(setCat).catch(function (e) {
        // Каталог не критичен для списка людей: показываем причину в консоли и
        // работаем дальше с пустым, но НЕ прячем весь экран.
        console.warn('[access] каталог не загружен:', e.message);
        setCat({ features: [], roleGrants: {}, roles: [] });
      });
    }

    React.useEffect(function () {
      api('/access/me').then(function (d) {
        setMe(d);
        if ((d.caps || []).length) loadCatalog();
      }).catch(function (e) { setErr(e.message); });
    }, []);

    if (err) return h(Notice, { tone: 'bad', text: 'Не удалось узнать свои права: ' + err });
    if (!me) return h('div', { style: { color: C().dim, padding: 20 } }, 'Загружаю…');

    if (!token()) {
      return h('div', { style: { padding: 20 } },
        h('div', { style: { fontSize: 16, fontWeight: 600, marginBottom: 8 } }, 'Нужен вход'),
        h('div', { style: { fontSize: 14, color: C().body } },
          'Доступами управляет тот, кто вошёл в аккаунт. Войдите на странице игры и вернитесь сюда.'),
        h('a', { href: 'duel.html#login', className: 'ad-btn', style: { display: 'inline-block', marginTop: 12 } }, 'Перейти ко входу'));
    }
    if (!(me.caps || []).length) {
      return h('div', { style: { padding: 20 } },
        h('div', { style: { fontSize: 16, fontWeight: 600, marginBottom: 8 } }, 'Доступа нет'),
        h('div', { style: { fontSize: 14, color: C().body } },
          'Ваша роль — «' + (me.roleTitle || me.role) + '», административных полномочий у неё нет. Их выдаёт суперадмин.'));
    }

    var tabs = [['people', 'Люди и регистрации'], ['matrix', 'Матрица'], ['catalog', 'Каталог'], ['audit', 'Журнал']];

    return h('div', null,
      h('div', { style: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 } },
        h('span', { style: { fontSize: 14 } }, 'Вы: ', h('b', null, me.roleTitle || me.role)),
        h(Badge, { tone: me.isSuperadmin ? 'bad' : 'accent' }, me.isSuperadmin ? 'суперадмин' : 'админ'),
        h('span', { style: { fontSize: 12, color: C().dim } }, 'полномочий: ' + (me.caps || []).length),
        h('button', { className: 'ad-btn', onClick: loadCatalog, style: { marginLeft: 'auto' } }, 'Обновить каталог')),

      h('div', { style: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' } },
        tabs.map(function (t) {
          var on = view === t[0];
          return h('button', {
            key: t[0], onClick: function () { setView(t[0]); }, className: 'ad-btn',
            style: { background: on ? C().tabOnBg : C().tabOffBg, color: on ? C().tabOnText : 'inherit' }
          }, t[1]);
        })),

      view === 'people'  ? h(PeopleView,  { me: me, catalog: cat }) : null,
      view === 'matrix'  ? h(MatrixView,  { catalog: cat }) : null,
      view === 'catalog' ? h(CatalogView, { me: me, catalog: cat, reload: loadCatalog }) : null,
      view === 'audit'   ? h(AuditView,   { me: me }) : null
    );
  }

  window.YasnaAccessTab = AccessTab;
})();
