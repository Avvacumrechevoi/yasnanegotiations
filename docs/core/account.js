// ═══════════════════════════════════════════════════════════════════
// Аккаунт: вход по почте и профиль. Работает на ЛЮБОЙ странице.
//
// ПОЧЕМУ ОТДЕЛЬНЫЙ МОДУЛЬ, А НЕ ЭКРАН В ИГРЕ. Вход раньше жил только внутри
// собранного бандла игры, а кнопка «Войти» в шапке просто уводила на
// duel.html#login. То есть человек, читающий урок, для входа выбрасывался в
// другой раздел. Здесь тот же приём, что с темой и хранилищем: один модуль в
// core/, подключённый на всех страницах, — и вход доступен там, где человек
// находится. Бандлы при этом не трогаются: это обычный скрипт, без React.
//
// ЧТО УМЕЕТ:
//   YasnaAccount.openLogin()    вход по одноразовому коду из письма
//   YasnaAccount.openProfile()  профиль: имя, фамилия, телефон, выход, удаление
//   YasnaAccount.user()         текущий пользователь или null
//   YasnaAccount.isLoggedIn()
//
// СВЯЗЫВАНИЕ АККАУНТОВ. Если человек уже вошёл (например, через Telegram) и
// подтверждает почту, запрос уходит С ТОКЕНОМ — сервер прикрепляет адрес к тому
// же аккаунту. Без токена вход по почте создаёт отдельный аккаунт, и это
// правильно: иначе любой, кто знает чужую почту, присоединялся бы к чужому
// прогрессу. Поэтому в профиле есть отдельная кнопка «Привязать почту».
//
// ОФОРМЛЕНИЕ — через CSS с селекторами html[data-theme], а не через инлайновые
// цвета: тема на сайте переключается без перезагрузки, и инлайновые значения
// пришлось бы пересчитывать вручную.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var TOKEN_KEY = 'yasna_duel_token';
  var USER_KEY = 'yasna_duel_user';
  var CODE_LEN = 6;

  function ls() { try { return window.localStorage; } catch (_) { return null; } }
  function getRaw(k) { var s = ls(); if (!s) return null; try { return s.getItem(k); } catch (_) { return null; } }
  function setRaw(k, v) { var s = ls(); if (!s) return; try { s.setItem(k, v); } catch (_) {} }
  function del(k) { var s = ls(); if (!s) return; try { s.removeItem(k); } catch (_) {} }

  function apiBase() {
    try {
      var el = document.querySelector('meta[name="yasna:api"]');
      return (el && el.getAttribute('content')) || window.YASNA_LEADERBOARD_API || '';
    } catch (_) { return ''; }
  }
  function token() { return getRaw(TOKEN_KEY) || ''; }
  function user() {
    try { var raw = getRaw(USER_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }
  function isLoggedIn() { return !!token(); }
  function deviceId() {
    try {
      if (window.YasnaStorage && window.YasnaStorage.sync && window.YasnaStorage.sync.status) {
        // storage.js создаёт единый id устройства; берём его же, чтобы гостевой
        // прогресс привязался к аккаунту, а не остался «чужим»
        var s = window.YasnaStorage.sync.status();
        if (s && s.ownerKey && s.ownerKey.indexOf('dev:') === 0) return s.ownerKey.slice(4);
      }
    } catch (_) {}
    return getRaw('yasna_device_id_v1') || null;
  }

  function api(path, opts) {
    var o = opts || {};
    var base = apiBase();
    if (!base) return Promise.reject(new Error('на этой странице не задан адрес API'));
    var headers = { 'Content-Type': 'application/json' };
    if (o.auth !== false && token()) headers.Authorization = 'Bearer ' + token();
    return fetch(base + path, {
      method: o.method || 'GET',
      headers: headers,
      body: o.body ? JSON.stringify(o.body) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var d = null;
        try { d = t ? JSON.parse(t) : null; } catch (_) {}
        if (!r.ok) {
          var e = new Error((d && (d.detail || d.reason || d.error)) || ('HTTP ' + r.status));
          e.code = r.status; e.data = d;
          throw e;
        }
        return d || {};
      });
    });
  }

  // ─── оформление ────────────────────────────────────────────────────
  var CSS = [
    '.yac-back{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.5);',
    '  display:flex;align-items:center;justify-content:center;padding:16px;',
    '  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}',
    '.yac-card{width:100%;max-width:420px;background:#fff;color:#1d1d1f;border-radius:16px;',
    '  padding:22px;box-shadow:0 18px 50px rgba(0,0,0,.28);max-height:88vh;overflow:auto;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
    'html[data-theme="dark"] .yac-card{background:#1c1c1e;color:#fefefe;',
    '  box-shadow:0 18px 50px rgba(0,0,0,.6)}',
    '.yac-h{font-size:19px;font-weight:600;margin:0 0 6px}',
    '.yac-sub{font-size:13px;line-height:1.5;color:#6e6e73;margin:0 0 16px}',
    'html[data-theme="dark"] .yac-sub{color:rgba(255,255,255,.66)}',
    '.yac-lbl{display:block;font-size:12px;color:#6e6e73;margin:12px 0 5px}',
    'html[data-theme="dark"] .yac-lbl{color:rgba(255,255,255,.66)}',
    '.yac-in{width:100%;box-sizing:border-box;padding:11px 12px;font-size:16px;border-radius:10px;',
    '  border:1px solid #d2d2d7;background:#fff;color:#1d1d1f}',
    'html[data-theme="dark"] .yac-in{border-color:rgba(255,255,255,.24);',
    '  background:rgba(255,255,255,.06);color:#fefefe}',
    '.yac-in:focus{outline:2px solid #0071e3;outline-offset:1px}',
    '.yac-code{letter-spacing:.34em;font-size:22px;text-align:center;font-variant-numeric:tabular-nums}',
    '.yac-row{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap}',
    '.yac-btn{flex:1 1 auto;padding:11px 16px;font-size:15px;border-radius:10px;cursor:pointer;',
    '  border:1px solid #d2d2d7;background:#f5f5f7;color:#1d1d1f;font-weight:500}',
    'html[data-theme="dark"] .yac-btn{border-color:rgba(255,255,255,.2);',
    '  background:rgba(255,255,255,.1);color:#fefefe}',
    '.yac-btn--main{background:#1d1d1f;border-color:#1d1d1f;color:#fff}',
    'html[data-theme="dark"] .yac-btn--main{background:#fefefe;border-color:#fefefe;color:#151515}',
    '.yac-btn--danger{color:#a12d2d;border-color:#e8b4b4;background:#fdf2f2;flex:0 0 auto}',
    'html[data-theme="dark"] .yac-btn--danger{color:#ff9a9a;border-color:rgba(255,90,90,.35);',
    '  background:rgba(255,90,90,.12)}',
    '.yac-btn[disabled]{opacity:.55;cursor:default}',
    '.yac-msg{margin-top:14px;padding:10px 12px;border-radius:10px;font-size:13.5px;line-height:1.45}',
    '.yac-msg--bad{background:#fdecec;color:#8c2020}',
    'html[data-theme="dark"] .yac-msg--bad{background:rgba(255,90,90,.14);color:#ffb0b0}',
    '.yac-msg--ok{background:#e6f6ec;color:#1c6b3c}',
    'html[data-theme="dark"] .yac-msg--ok{background:rgba(60,200,120,.14);color:#8fe3b0}',
    '.yac-meta{font-size:12.5px;line-height:1.6;color:#6e6e73;margin-top:4px}',
    'html[data-theme="dark"] .yac-meta{color:rgba(255,255,255,.62)}',
    '.yac-x{position:absolute;top:10px;right:12px;border:0;background:transparent;font-size:22px;',
    '  line-height:1;cursor:pointer;color:#8a8a8e;padding:6px}',
    '.yac-wrap{position:relative}',
    '.yac-chk{display:flex;gap:9px;align-items:flex-start;margin-top:14px;font-size:13px;line-height:1.45}',
    '.yac-chk input{margin-top:2px;flex:0 0 auto}'
  ].join('');

  var cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    cssDone = true;
    var st = document.createElement('style');
    st.setAttribute('data-yasna', 'account');
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ─── каркас окна ───────────────────────────────────────────────────
  var current = null;
  function closeModal() {
    if (current && current.parentNode) current.parentNode.removeChild(current);
    current = null;
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') closeModal(); }

  function modal(build) {
    ensureCss();
    closeModal();
    var back = document.createElement('div');
    back.className = 'yac-back';
    back.addEventListener('click', function (e) { if (e.target === back) closeModal(); });
    var card = document.createElement('div');
    card.className = 'yac-card yac-wrap';
    var x = document.createElement('button');
    x.className = 'yac-x'; x.type = 'button'; x.setAttribute('aria-label', 'Закрыть');
    x.textContent = '×';
    x.addEventListener('click', closeModal);
    card.appendChild(x);
    var body = document.createElement('div');
    card.appendChild(body);
    back.appendChild(card);
    document.body.appendChild(back);
    current = back;
    document.addEventListener('keydown', onEsc);
    build(body);
    return body;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function say(host, text, bad) {
    var old = host.querySelector('.yac-msg');
    if (old) old.parentNode.removeChild(old);
    if (!text) return;
    var m = el('div', 'yac-msg ' + (bad ? 'yac-msg--bad' : 'yac-msg--ok'), text);
    host.appendChild(m);
  }

  // ─── вход по почте ─────────────────────────────────────────────────
  function openLogin(opts) {
    var o = opts || {};
    // linkMode = «привязать почту к текущему аккаунту»: запрос уходит с токеном,
    // и сервер прикрепляет адрес к тому же аккаунту, а не создаёт второй.
    var linkMode = !!o.link && isLoggedIn();
    modal(function (b) {
      b.appendChild(el('h2', 'yac-h', linkMode ? 'Привязать почту' : 'Вход по почте'));
      b.appendChild(el('p', 'yac-sub', linkMode
        ? 'Пришлём код на этот адрес. После подтверждения почта будет привязана к вашему аккаунту — прогресс останется тем же.'
        : 'Пришлём код из шести цифр. Пароль придумывать не нужно: код подтверждает и вход, и саму почту.'));

      var lbl = el('label', 'yac-lbl', 'Электронная почта');
      var mail = el('input', 'yac-in');
      mail.type = 'email'; mail.autocomplete = 'email'; mail.placeholder = 'you@example.com';
      mail.setAttribute('inputmode', 'email');
      b.appendChild(lbl); b.appendChild(mail);

      // Согласие спрашивается ОДИН раз, при первом входе: имя, фамилия и телефон
      // в профиле — персональные данные.
      var chkWrap = null, chk = null;
      if (!linkMode) {
        chkWrap = el('label', 'yac-chk');
        chk = document.createElement('input');
        chk.type = 'checkbox';
        chkWrap.appendChild(chk);
        chkWrap.appendChild(el('span', null,
          'Согласен на обработку моих данных: почты и того, что заполню в профиле. Аккаунт можно удалить в любой момент.'));
        b.appendChild(chkWrap);
      }

      var row = el('div', 'yac-row');
      var go = el('button', 'yac-btn yac-btn--main', 'Получить код');
      row.appendChild(go);
      b.appendChild(row);

      function askCode() {
        var addr = (mail.value || '').trim();
        if (!addr || addr.indexOf('@') < 1) { say(b, 'Проверьте адрес почты.', true); mail.focus(); return; }
        if (chk && !chk.checked) { say(b, 'Без согласия на обработку данных завести аккаунт нельзя.', true); return; }
        go.disabled = true; go.textContent = 'Отправляю…';
        say(b, '');
        api('/auth/email/request', { method: 'POST', auth: linkMode, body: { email: addr, consent: chk ? chk.checked : undefined } })
          .then(function () { showCodeStep(addr, chk ? chk.checked : false, linkMode); })
          .catch(function (e) {
            go.disabled = false; go.textContent = 'Получить код';
            // Тексты разные не для красоты: «слишком часто» и «почта не настроена»
            // требуют разных действий, и человек должен понимать, ждать ему или нет.
            if (e.code === 429) say(b, 'Код уже отправляли несколько раз. Проверьте почту, включая «Спам», и попробуйте через 15 минут.', true);
            else if (e.code === 503) say(b, 'Отправка писем на сервере ещё не настроена. Войдите через Telegram или напишите нам.', true);
            else say(b, e.message || 'Не получилось отправить код.', true);
          });
      }
      go.addEventListener('click', askCode);
      mail.addEventListener('keydown', function (e) { if (e.key === 'Enter') askCode(); });
      setTimeout(function () { mail.focus(); }, 60);
    });
  }

  function showCodeStep(addr, consent, linkMode) {
    modal(function (b) {
      b.appendChild(el('h2', 'yac-h', 'Введите код'));
      b.appendChild(el('p', 'yac-sub', 'Отправили письмо на ' + addr + '. Код действует 10 минут. Если письма нет — посмотрите в «Спаме».'));

      var code = el('input', 'yac-in yac-code');
      code.type = 'text'; code.inputMode = 'numeric'; code.autocomplete = 'one-time-code';
      code.maxLength = CODE_LEN; code.placeholder = '······';
      b.appendChild(code);

      var row = el('div', 'yac-row');
      var go = el('button', 'yac-btn yac-btn--main', linkMode ? 'Привязать' : 'Войти');
      var again = el('button', 'yac-btn', 'Другой адрес');
      row.appendChild(go); row.appendChild(again);
      b.appendChild(row);
      again.addEventListener('click', function () { openLogin({ link: linkMode }); });

      function submit() {
        var val = (code.value || '').replace(/\D/g, '');
        if (val.length !== CODE_LEN) { say(b, 'Код состоит из шести цифр.', true); return; }
        go.disabled = true; go.textContent = 'Проверяю…';
        say(b, '');
        api('/auth/email/verify', {
          method: 'POST', auth: true,
          body: { email: addr, code: val, consent: consent, deviceId: deviceId() }
        }).then(function (d) {
          if (d.token) setRaw(TOKEN_KEY, d.token);
          if (d.user) setRaw(USER_KEY, JSON.stringify(d.user));
          // Прогресс подтягиваем сразу: владелец записей сменился с устройства
          // на аккаунт, и состояние синхронизации должно это увидеть.
          try {
            if (window.YasnaStorage && window.YasnaStorage.sync) {
              window.YasnaStorage.sync.pull().then(function () { window.YasnaStorage.sync.push(); });
            }
          } catch (_) {}
          renderNav();
          openProfile({ welcome: d.isNew ? 'Аккаунт создан. Здесь можно заполнить имя и фамилию — это видно только вам и администратору.' : 'Вы вошли.' });
        }).catch(function (e) {
          go.disabled = false; go.textContent = linkMode ? 'Привязать' : 'Войти';
          if (e.code === 429) say(b, 'Код заблокирован после нескольких неверных попыток. Запросите новый.', true);
          else say(b, e.message || 'Код не подошёл.', true);
          var left = e.data && e.data.attemptsLeft;
          if (typeof left === 'number' && left > 0) say(b, (e.message || 'Код не подошёл.') + ' Осталось попыток: ' + left + '.', true);
        });
      }
      go.addEventListener('click', submit);
      code.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      // Автоотправка на шестой цифре: код вводят с одного взгляда на письмо,
      // лишнее нажатие тут только мешает.
      code.addEventListener('input', function () {
        if ((code.value || '').replace(/\D/g, '').length === CODE_LEN) submit();
      });
      setTimeout(function () { code.focus(); }, 60);
    });
  }

  // ─── профиль ───────────────────────────────────────────────────────
  function openProfile(opts) {
    var o = opts || {};
    if (!isLoggedIn()) { openLogin(); return; }
    modal(function (b) {
      b.appendChild(el('h2', 'yac-h', 'Мой профиль'));
      var meta = el('div', 'yac-meta', 'Загружаю…');
      b.appendChild(meta);
      if (o.welcome) say(b, o.welcome, false);

      api('/account').then(function (d) {
        var u = d.user || {};
        meta.textContent = '';
        var lines = [];
        if (u.email) lines.push('Почта: ' + u.email + (u.emailVerified ? ' (подтверждена)' : ' (не подтверждена)'));
        if (u.hasTelegram) lines.push('Привязан Telegram');
        if (u.createdAt) lines.push('С нами с ' + new Date(u.createdAt).toLocaleDateString('ru-RU'));
        lines.forEach(function (t) { meta.appendChild(el('div', null, t)); });

        var fields = [
          ['firstName', 'Имя', u.firstName || '', 'text'],
          ['lastName', 'Фамилия', u.lastName || '', 'text'],
          ['phone', 'Телефон — по желанию', u.phone || '', 'tel']
        ];
        var inputs = {};
        fields.forEach(function (f) {
          b.appendChild(el('label', 'yac-lbl', f[1]));
          var i = el('input', 'yac-in');
          i.type = f[3]; i.value = f[2];
          if (f[0] === 'phone') i.placeholder = '+7 900 000-00-00';
          b.appendChild(i);
          inputs[f[0]] = i;
        });

        var row = el('div', 'yac-row');
        var save = el('button', 'yac-btn yac-btn--main', 'Сохранить');
        row.appendChild(save);
        if (!u.email) {
          var link = el('button', 'yac-btn', 'Привязать почту');
          link.addEventListener('click', function () { openLogin({ link: true }); });
          row.appendChild(link);
        }
        var out = el('button', 'yac-btn', 'Выйти');
        out.addEventListener('click', function () {
          // Ждём очистки, а не закрываем окно сразу: человек должен видеть, что
          // выход не мгновенный, потому что перед стиранием идёт отправка.
          out.disabled = true; out.textContent = 'Выхожу…';
          logout().then(function () { closeModal(); });
        });
        row.appendChild(out);
        b.appendChild(row);

        save.addEventListener('click', function () {
          save.disabled = true; save.textContent = 'Сохраняю…';
          api('/account', {
            method: 'PUT',
            body: {
              firstName: inputs.firstName.value,
              lastName: inputs.lastName.value,
              phone: inputs.phone.value
            }
          }).then(function () {
            save.disabled = false; save.textContent = 'Сохранить';
            say(b, 'Сохранено.', false);
          }).catch(function (e) {
            save.disabled = false; save.textContent = 'Сохранить';
            say(b, e.message || 'Не удалось сохранить.', true);
          });
        });

        // Удаление — в отдельной строке и с подтверждением: действие
        // необратимое, и рядом с «Сохранить» ему не место.
        var danger = el('div', 'yac-row');
        var kill = el('button', 'yac-btn yac-btn--danger', 'Удалить аккаунт');
        kill.addEventListener('click', function () {
          if (!window.confirm('Удалить аккаунт? Личные данные и привязка почты будут стёрты. Отменить это нельзя.')) return;
          kill.disabled = true; kill.textContent = 'Удаляю…';
          api('/account/delete', { method: 'POST' })
            .then(function () { logout(); closeModal(); window.alert('Аккаунт удалён.'); })
            .catch(function (e) {
              kill.disabled = false; kill.textContent = 'Удалить аккаунт';
              say(b, e.message || 'Не удалось удалить.', true);
            });
        });
        danger.appendChild(kill);
        b.appendChild(danger);
        b.appendChild(el('div', 'yac-meta',
          'При выходе прогресс на этом устройстве стирается — он остаётся на сервере и вернётся при входе. ' +
          'Так сделано, чтобы на общем компьютере ваши уроки и заметки не достались следующему.'));
      }).catch(function (e) {
        meta.textContent = '';
        if (e.code === 401) {
          // Токен истёк или отозван — честно говорим и предлагаем войти заново,
          // а не показываем пустой профиль.
          logout();
          say(b, 'Сессия истекла. Войдите заново.', true);
          var again = el('button', 'yac-btn yac-btn--main', 'Войти');
          again.addEventListener('click', function () { openLogin(); });
          var r = el('div', 'yac-row'); r.appendChild(again); b.appendChild(r);
        } else {
          say(b, e.message || 'Не удалось загрузить профиль.', true);
        }
      });
    });
  }

  // ВЫХОД СТИРАЕТ ЛОКАЛЬНУЮ КОПИЮ ПРОГРЕССА. Это не перестраховка: прежняя
  // версия убирала только токен, и на общем компьютере (семья, офис, класс)
  // следующий вошедший отправлял на сервер прогресс и ЛИЧНЫЕ ЗАМЕТКИ
  // предыдущего — уже под своим аккаунтом. Проверено на живом сервере: во
  // втором аккаунте оказались уроки и заметка первого человека.
  //
  // Потери данных здесь нет: перед стиранием YasnaStorage.sync.clearSynced()
  // отправляет несохранённое на сервер, а при следующем входе всё вернётся.
  // Что НЕ стираем: id устройства и его секрет — они не про человека, а про
  // браузер, и нужны, чтобы гостевой прогресс не «отвязался»; настройки темы;
  // очередь неотправленных матчей.
  function logout() {
    del(TOKEN_KEY);
    del(USER_KEY);
    renderNav();
    var st = (window.YasnaStorage && window.YasnaStorage.sync) || null;
    if (!st || typeof st.clearSynced !== 'function') {
      // Старый storage.js без очистки — тогда хотя бы не оставляем состояние
      // синхронизации, чтобы чужие версии не сравнивались с новыми.
      del('yasna_sync_state_v1');
      return Promise.resolve();
    }
    return st.clearSynced().then(function (r) {
      try { st.pull(); } catch (_) {}
      return r;
    });
  }

  // ─── кнопка в шапке ────────────────────────────────────────────────
  // Раньше это была ссылка на duel.html#login: человек, читающий урок,
  // выбрасывался в раздел игры. Теперь окно открывается на месте.
  function renderNav() {
    var a = document.querySelector('.ynav-login');
    if (!a) return;
    var u = user();
    var txt = a.querySelector('.ynav-login-txt');
    if (isLoggedIn()) {
      var name = (u && (u.nickname || u.firstName)) || 'Профиль';
      if (txt) txt.textContent = String(name).slice(0, 14);
      a.setAttribute('title', 'Мой профиль');
    } else {
      if (txt) txt.textContent = 'Войти';
      a.setAttribute('title', 'Войти — прогресс на любом устройстве');
    }
    if (a.getAttribute('data-yac') === '1') return;
    a.setAttribute('data-yac', '1');
    a.setAttribute('href', 'javascript:void(0)');
    a.addEventListener('click', function (e) {
      e.preventDefault();
      if (isLoggedIn()) openProfile(); else openLogin();
    });
  }

  function boot() {
    renderNav();
    // Шапка рисуется скриптом site-nav.js, порядок загрузки не гарантирован —
    // поэтому пробуем ещё раз после отрисовки.
    setTimeout(renderNav, 300);
    setTimeout(renderNav, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.YasnaAccount = {
    openLogin: openLogin,
    openProfile: openProfile,
    logout: logout,
    user: user,
    isLoggedIn: isLoggedIn,
    refreshNav: renderNav
  };
})();
