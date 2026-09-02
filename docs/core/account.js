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

  /* Приложение узнаётся по метке Capacitor в строке браузера. Тексты про
     Telegram в приложении бессмысленны: виджет там не работает вовсе. */
  function вПриложении() {
    try { return /YasnaApp\//.test(navigator.userAgent); } catch (_) { return false; }
  }

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

  // Таймаут и человеческий текст сетевой ошибки. Без них при отсутствии
  // связи (в приложении это обычное дело) кнопка «Отправляю…» висела до
  // упора, а в сообщении показывалось английское «Failed to fetch».
  var СЕТЬ_ЖДЁМ_МС = 15000;

  function api(path, opts) {
    var o = opts || {};
    var base = apiBase();
    if (!base) return Promise.reject(new Error('на этой странице не задан адрес API'));
    var headers = { 'Content-Type': 'application/json' };
    if (o.auth !== false && token()) headers.Authorization = 'Bearer ' + token();
    var стоп = null, срок = null;
    try { стоп = new AbortController(); } catch (_) {}
    if (стоп) срок = setTimeout(function () { try { стоп.abort(); } catch (_) {} }, СЕТЬ_ЖДЁМ_МС);
    return fetch(base + path, {
      method: o.method || 'GET',
      headers: headers,
      body: o.body ? JSON.stringify(o.body) : undefined,
      signal: стоп ? стоп.signal : undefined
    }).catch(function (e) {
      if (срок) clearTimeout(срок);
      var сеть = new Error(
        (e && e.name === 'AbortError')
          ? 'Сервер не ответил за 15 секунд. Проверьте связь и попробуйте ещё раз.'
          : 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
      сеть.code = 0;
      throw сеть;
    }).then(function (r) {
      if (срок) clearTimeout(срок);
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
    /* Окно прижато к низу: так до кнопок дотягивается большой палец, и при
       открытой клавиатуре видна именно нижняя, рабочая часть карточки. */
    '.yac-back{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.5);',
    '  display:flex;align-items:flex-end;justify-content:center;overscroll-behavior:contain;',
    '  padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));',
    '  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}',
    '@media (min-width:560px){.yac-back{align-items:center}}',
    /* dvh, а не vh: с выехавшей клавиатурой vh на Android считается от полной
       высоты экрана, и низ карточки уходит под клавиатуру. color-scheme —
       чтобы каретка, галочка и системная прокрутка были в цвет темы. */
    '.yac-card{width:100%;max-width:420px;background:#fff;color:#1d1d1f;border-radius:18px;',
    '  padding:22px;box-shadow:0 18px 50px rgba(0,0,0,.28);max-height:88dvh;overflow:auto;',
    '  color-scheme:light;',
    '  font-family:Manrope,Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
    'html[data-theme="dark"] .yac-card{background:#1c1c1e;color:#fefefe;color-scheme:dark;',
    '  box-shadow:0 18px 50px rgba(0,0,0,.6)}',
    '.yac-card .yac-h,.akkaunt .yac-h{font-size:21px;font-weight:700;margin:0 0 6px;padding-right:44px;line-height:1.25}',
    '.yac-sub{font-size:14.5px;line-height:1.5;color:#6e6e73;margin:0 0 16px}',
    'html[data-theme="dark"] .yac-sub{color:rgba(255,255,255,.66)}',
    '.yac-lbl{display:block;font-size:13px;color:#6e6e73;margin:12px 0 5px}',
    'html[data-theme="dark"] .yac-lbl{color:rgba(255,255,255,.66)}',
    '.yac-card .yac-in,.akkaunt .yac-in{width:100%;box-sizing:border-box;padding:12px;min-height:48px;',
    '  font:400 16px/1.3 inherit;border-radius:12px;',
    '  border:1px solid #d2d2d7;background:#fff;color:#1d1d1f}',
    /* Тёмная тема прописывается КАЖДОЙ половине списка. Пока вторая половина
       была просто «.akkaunt .yac-in», её специфичность совпадала со светлым
       правилом выше, а стояла она позже — и поля встроенной формы (Профиль
       приложения) в светлой теме выходили белым по белому. */
    'html[data-theme="dark"] .yac-card .yac-in,html[data-theme="dark"] .akkaunt .yac-in{',
    '  border-color:rgba(255,255,255,.24);background:rgba(255,255,255,.06);color:#fefefe}',
    '.yac-card .yac-in:focus,.akkaunt .yac-in:focus{outline:2px solid #0071e3;outline-offset:1px}',
    '.yac-card .yac-code,.akkaunt .yac-code{letter-spacing:.34em;font-size:26px;font-weight:600;text-align:center;',
    '  min-height:58px;font-variant-numeric:tabular-nums}',
    '.yac-row{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap}',
    '.yac-card .yac-btn,.akkaunt .yac-btn{flex:1 1 auto;min-height:48px;padding:12px 16px;font-size:15px;border-radius:12px;',
    '  cursor:pointer;border:1px solid #d2d2d7;background:#f5f5f7;color:#1d1d1f;font-weight:500}',
    'html[data-theme="dark"] .yac-btn{border-color:rgba(255,255,255,.2);',
    '  background:rgba(255,255,255,.1);color:#fefefe}',
    '.yac-card .yac-btn--main,.akkaunt .yac-btn--main{background:#1d1d1f;border-color:#1d1d1f;color:#fff}',
    /* Та же беда была у главной кнопки: «Сохранить» в светлой теме рисовалась
       белым по белой карточке — форму нельзя было закончить. */
    'html[data-theme="dark"] .yac-card .yac-btn--main,html[data-theme="dark"] .akkaunt .yac-btn--main{',
    '  background:#fefefe;border-color:#fefefe;color:#151515}',
    '.yac-btn--danger{color:#a12d2d;border-color:#e8b4b4;background:#fdf2f2;flex:0 0 auto}',
    'html[data-theme="dark"] .yac-btn--danger{color:#ff9a9a;border-color:rgba(255,90,90,.35);',
    '  background:rgba(255,90,90,.12)}',
    '.yac-btn[disabled]{opacity:.55;cursor:default}',
    '.yac-msg{margin-top:14px;padding:11px 13px;border-radius:12px;font-size:14px;line-height:1.45}',
    '.yac-msg--bad{background:#fdecec;color:#8c2020}',
    'html[data-theme="dark"] .yac-msg--bad{background:rgba(255,90,90,.14);color:#ffb0b0}',
    '.yac-msg--ok{background:#e6f6ec;color:#1c6b3c}',
    'html[data-theme="dark"] .yac-msg--ok{background:rgba(60,200,120,.14);color:#8fe3b0}',
    '.yac-meta{font-size:13px;line-height:1.6;color:#6e6e73;margin-top:4px}',
    'html[data-theme="dark"] .yac-meta{color:rgba(255,255,255,.62)}',
    '.yac-sync{margin-top:14px;padding-top:10px;border-top:1px solid rgba(0,0,0,.08)}',
    'html[data-theme="dark"] .yac-sync{border-top-color:rgba(255,255,255,.10)}',
    '.yac-sync-bad{font-size:13px;line-height:1.55;color:#a12d2d;margin-top:6px}',
    'html[data-theme="dark"] .yac-sync-bad{color:#ff9a9a}',
    '.yac-sync-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}',
    '.yac-sync-key{font-family:ui-monospace,monospace;font-size:12px;color:#6e6e73;flex:1 1 140px;word-break:break-all}',
    'html[data-theme="dark"] .yac-sync-key{color:rgba(255,255,255,.55)}',
    '.yac-card .yac-btn--mini,.akkaunt .yac-btn--mini{min-height:36px;padding:6px 12px;font-size:13px}',
    '.yac-card .yac-btn--wide,.akkaunt .yac-btn--wide{flex:1 1 100%}',
    /* Крестик был 34×34 при норме 44 — на телефоне в него не попадали. */
    '.yac-x{position:absolute;top:6px;right:6px;border:0;background:transparent;font-size:24px;',
    '  line-height:1;cursor:pointer;color:#8a8a8e;padding:0;width:44px;height:44px;',
    '  display:flex;align-items:center;justify-content:center}',
    '.yac-wrap{position:relative}',
    '.yac-chk{display:flex;gap:11px;align-items:flex-start;margin-top:14px;font-size:13.5px;line-height:1.5}',
    '.yac-chk input{margin-top:1px;flex:0 0 auto;width:22px;height:22px;accent-color:#0071e3}'
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
  var фокусДо = null;
  function closeModal() {
    if (current && current.parentNode) current.parentNode.removeChild(current);
    current = null;
    document.removeEventListener('keydown', onEsc);
    window.removeEventListener('yasna:назад', наНазад);
    // Возвращаем фокус туда, откуда окно открыли, — иначе на телефоне
    // фокус остаётся в никуда, а на клавиатуре теряется место.
    try { if (фокусДо && фокусДо.focus) фокусДо.focus(); } catch (_) {}
    фокусДо = null;
  }
  function onEsc(e) { if (e.key === 'Escape') closeModal(); }
  /* Аппаратная «назад» в приложении (событие из app/pribavka.js). Без этого
     «назад» на шаге ввода кода уносила с экрана целиком, и код пропадал. */
  function наНазад(e) {
    if (e.defaultPrevented) return;
    e.preventDefault();
    closeModal();
  }

  function modal(build) {
    ensureCss();
    closeModal();
    var back = document.createElement('div');
    back.className = 'yac-back';
    back.addEventListener('click', function (e) { if (e.target === back) closeModal(); });
    try { фокусДо = document.activeElement; } catch (_) { фокусДо = null; }
    var card = document.createElement('div');
    card.className = 'yac-card yac-wrap';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('tabindex', '-1');
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
    window.addEventListener('yasna:назад', наНазад);
    build(body);
    return body;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // Экран, на котором открыли окно (например, Профиль приложения), должен
  // узнать о входе и выходе: иначе под закрывшейся модалкой остаётся
  // надпись «Вы играете гостем» до перезагрузки страницы.
  // detail нужен экрану, чтобы отличить свежий вход от выхода и сказать об
  // этом своими словами (снэкбар в приложении вместо второго окна).
  function сообщитьОбАккаунте(детали) {
    try { window.dispatchEvent(new CustomEvent('yasna:аккаунт', { detail: детали || null })); } catch (_) {}
  }

  function say(host, text, bad) {
    var old = host.querySelector('.yac-msg');
    if (old) old.parentNode.removeChild(old);
    if (!text) return;
    var m = el('div', 'yac-msg ' + (bad ? 'yac-msg--bad' : 'yac-msg--ok'), text);
    m.setAttribute('role', bad ? 'alert' : 'status');
    // Ставим НАД рядом кнопок: на шаге кода при открытой клавиатуре низ окна
    // не виден, и ошибка внизу просто не попадалась на глаза.
    var ряд = host.querySelector('.yac-row');
    if (ряд) ряд.parentNode.insertBefore(m, ряд); else host.appendChild(m);
  }

  // ─── вход по почте ─────────────────────────────────────────────────
  // Адрес живёт между шагами: с шага кода можно вернуться и поправить опечатку,
  // не набирая почту заново.
  var последнийАдрес = '';

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
      mail.id = 'yac-mail-' + Date.now();
      lbl.setAttribute('for', mail.id);
      mail.value = o.email || последнийАдрес || '';
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
          'Даю согласие на обработку почты, а также имени, фамилии и телефона, если заполню их в профиле. ' +
          'Нужно, чтобы входить и вести профиль. Аккаунт и все данные можно удалить в любой момент — кнопка в профиле.'));
        b.appendChild(chkWrap);
      }

      var row = el('div', 'yac-row');
      var go = el('button', 'yac-btn yac-btn--main yac-btn--wide', 'Получить код');
      row.appendChild(go);
      b.appendChild(row);

      function askCode() {
        // Enter в поле и нажатие кнопки успевали дать два запроса подряд;
        // второй отвечал «запросите код заново» — и человек оставался ни с чем.
        if (go.disabled) return;
        var addr = (mail.value || '').trim();
        if (!addr || addr.indexOf('@') < 1) { say(b, 'Проверьте адрес почты.', true); mail.focus(); return; }
        if (chk && !chk.checked) { say(b, 'Без согласия на обработку данных завести аккаунт нельзя.', true); return; }
        последнийАдрес = addr;
        go.disabled = true; go.textContent = 'Отправляю…';
        say(b, '');
        api('/auth/email/request', { method: 'POST', auth: linkMode, body: { email: addr, consent: chk ? chk.checked : undefined } })
          .then(function () { showCodeStep(addr, chk ? chk.checked : false, linkMode); })
          .catch(function (e) {
            go.disabled = false; go.textContent = 'Получить код';
            // Тексты разные не для красоты: «слишком часто» и «почта не настроена»
            // требуют разных действий, и человек должен понимать, ждать ему или нет.
            if (e.code === 429) say(b, 'Код уже отправляли несколько раз. Проверьте почту, включая «Спам», и попробуйте через 15 минут.', true);
            else if (e.code === 503) say(b, вПриложении()
              ? 'Письма с кодом сейчас не уходят — это на нашей стороне. Учиться и играть можно и без входа, попробуйте позже.'
              : 'Отправка писем на сервере ещё не настроена. Войдите через Telegram или напишите нам.', true);
            else if (e.code === 0) say(b, e.message, true);
            else {
              // Сервер отвечает строчной буквой («проверьте адрес почты») —
              // в окне это выглядит обрывком, а не фразой.
              var т = e.message || 'Не получилось отправить код.';
              if (т.slice(-1) !== '.') т += '.';
              say(b, т.charAt(0).toUpperCase() + т.slice(1), true);
            }
          });
      }
      go.addEventListener('click', askCode);
      mail.addEventListener('keydown', function (e) { if (e.key === 'Enter') askCode(); });
      // Гость тоже синхронизируется (пространство устройства): если что-то
      // разошлось или сервер отвергает записи — видно и без входа.
      syncSection(b, true);
      setTimeout(function () { mail.focus(); }, 60);
    });
  }

  function showCodeStep(addr, consent, linkMode) {
    modal(function (b) {
      b.appendChild(el('h2', 'yac-h', 'Введите код'));
      b.appendChild(el('p', 'yac-sub', 'Отправили письмо на ' + addr + '. Код действует 10 минут. Если письма нет — посмотрите в «Спаме».'));

      var code = el('input', 'yac-in yac-code');
      code.type = 'text'; code.inputMode = 'numeric'; code.autocomplete = 'one-time-code';
      /* maxLength снят намеренно: код обычно вставляют из письма вместе с
         пробелами или куском строки, и поле молча обрезало вставку до шести
         первых символов — включая пробел. Лишнее убираем сами, ниже. */
      code.placeholder = '······';
      code.setAttribute('aria-label', 'Код из письма, шесть цифр');
      b.appendChild(code);

      var row = el('div', 'yac-row');
      var go = el('button', 'yac-btn yac-btn--main yac-btn--wide', linkMode ? 'Привязать' : 'Войти');
      var opyat = el('button', 'yac-btn', 'Прислать ещё раз');
      var again = el('button', 'yac-btn', 'Изменить адрес');
      row.appendChild(go); row.appendChild(opyat); row.appendChild(again);
      b.appendChild(row);
      again.addEventListener('click', function () { openLogin({ link: linkMode, email: addr }); });

      /* Повторная отправка. Раньше, если письмо не пришло, выхода не было
         вовсе: оставалось закрыть окно и начать сначала. Отсчёт — чтобы не
         жечь серверный лимит (три письма на адрес за 15 минут). */
      var ждать = 0, тик = null;
      function рисоватьЖдать() {
        if (ждать > 0) { opyat.disabled = true; opyat.textContent = 'Ещё раз через ' + ждать + ' с'; }
        else { opyat.disabled = false; opyat.textContent = 'Прислать ещё раз'; }
      }
      function отсчёт(сек) {
        ждать = сек; рисоватьЖдать();
        if (тик) clearInterval(тик);
        тик = setInterval(function () {
          ждать--; рисоватьЖдать();
          if (ждать <= 0) { clearInterval(тик); тик = null; }
        }, 1000);
      }
      отсчёт(60);
      opyat.addEventListener('click', function () {
        if (opyat.disabled) return;
        opyat.disabled = true; opyat.textContent = 'Отправляю…';
        say(b, '');
        api('/auth/email/request', { method: 'POST', auth: linkMode, body: { email: addr, consent: consent } })
          .then(function () { say(b, 'Отправили письмо ещё раз. Проверьте почту и «Спам».', false); отсчёт(60); })
          .catch(function (e) {
            отсчёт(30);
            if (e.code === 429) say(b, 'Больше трёх писем на один адрес за 15 минут не отправляем. Проверьте «Спам» и подождите.', true);
            else say(b, e.message || 'Не получилось отправить письмо ещё раз.', true);
          });
      });

      function submit() {
        if (go.disabled) return;
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
          // Где поля аккаунта уже стоят прямо на экране (узел .akkaunt —
          // Профиль приложения), окно «Мой профиль» дало бы вторую копию той
          // же формы поверх первой: два «Имя», две «Фамилии», разные подписи
          // и непонятно, какая настоящая. Там просто закрываем окно, а экран
          // сам скажет о входе и покажет свою карточку.
          var естьСвояФорма = !!document.querySelector('.akkaunt');
          if (естьСвояФорма) closeModal();
          сообщитьОбАккаунте({ вошли: true, почта: addr, новый: !!d.isNew });
          if (!естьСвояФорма) {
            openProfile({ welcome: d.isNew ? 'Аккаунт создан. Здесь можно заполнить имя и фамилию — это видно только вам и администратору.' : 'Вы вошли.' });
          }
        }).catch(function (e) {
          go.disabled = false; go.textContent = linkMode ? 'Привязать' : 'Войти';
          // Одно сообщение, а не два подряд: раньше сначала показывалось
          // «Код не подошёл.», а следом оно же со счётчиком попыток.
          var left = e.data && e.data.attemptsLeft;
          var текст;
          if (e.code === 429) текст = 'Код заблокирован: было пять неверных попыток. Нажмите «Прислать ещё раз».';
          else if (e.code === 0) текст = e.message;
          else {
            текст = e.message || 'Код не подошёл.';
            if (текст.slice(-1) !== '.') текст += '.';
            текст = текст.charAt(0).toUpperCase() + текст.slice(1);
            if (typeof left === 'number' && left > 0) текст += ' Осталось попыток: ' + left + '.';
          }
          say(b, текст, true);
        });
      }
      go.addEventListener('click', submit);
      code.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      // Автоотправка на шестой цифре: код вводят с одного взгляда на письмо,
      // лишнее нажатие тут только мешает.
      code.addEventListener('input', function () {
        var d = (code.value || '').replace(/\D/g, '').slice(0, CODE_LEN);
        if (d !== code.value) code.value = d;
        if (d.length === CODE_LEN) submit();
      });
      setTimeout(function () { code.focus(); }, 60);
    });
  }

  // ─── синхронизация: видимое состояние ──────────────────────────────
  // Раньше конфликты и отвергнутые ключи жили только в консоли — человек
  // не мог узнать, что его заметка «проиграла» серверной версии. Блок
  // показывает последний обмен, ошибку и конфликты с кнопками решения.
  function fmtAgo(iso) {
    if (!iso) return 'ещё не было';
    var t = Date.parse(iso);
    if (!isFinite(t)) return iso;
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'только что';
    if (s < 3600) return Math.round(s / 60) + ' мин назад';
    if (s < 86400) return Math.round(s / 3600) + ' ч назад';
    return new Date(t).toLocaleString('ru-RU');
  }

  // quiet: показывать только если есть проблема (для окна входа гостя —
  // гость тоже синхронизируется, но пугать его служебным блоком незачем).
  function syncSection(b, quiet) {
    var sync = window.YasnaStorage && window.YasnaStorage.sync;
    if (!sync || !sync.status) return;
    var host = el('div', 'yac-sync');
    b.appendChild(host);
    render();

    function render() {
      host.textContent = '';
      host.style.display = 'none';
      var st;
      try { st = sync.status(); } catch (_) { return; }
      if (!st.configured) return;                      // нет адреса API — нечего показывать
      /* Отсутствие сети — не «проблема синхронизации», а обычное состояние
         телефона в метро. Гостю в окне входа показывать из-за этого
         служебный блок незачем: про связь ему уже сказано сообщением выше. */
      var толькоСеть = st.lastError && /failed to fetch|networkerror|load failed|нет связи|не ответил/i.test(String(st.lastError));
      if (quiet && (толькоСеть || !st.lastError) && !st.conflicts && !Object.keys(st.rejected || {}).length) return;
      host.style.display = '';
      host.appendChild(el('div', 'yac-lbl', 'Синхронизация'));
      var meta = el('div', 'yac-meta');
      meta.appendChild(el('div', null, 'Получено с сервера: ' + fmtAgo(st.lastPull)));
      meta.appendChild(el('div', null, 'Отправлено на сервер: ' + fmtAgo(st.lastPush)));
      /* Сообщения fetch («Failed to fetch», «Load failed») по-английски и
         человеку ничего не говорят — переводим в понятную причину. */
      if (st.lastError) {
        /* Сюда попадали куски ответа сервера — «HTTP 500», JSON с
           RESOURCE_EXHAUSTED. Человеку это ничего не объясняет, а выглядит
           как поломка приложения. Разводим на три понятные причины, всё
           остальное уходит в консоль. */
        var сырое = String(st.lastError);
        try { console.warn('[синхронизация]', сырое); } catch (_) {}
        var текст;
        if (/failed to fetch|networkerror|load failed|нет связи|не ответил/i.test(сырое))
          текст = 'Последняя попытка не удалась: не было связи с сервером.';
        else if (/\b(5\d\d)\b|resource_exhausted|unavailable|timeout/i.test(сырое))
          текст = 'Сервер сейчас не отвечает. Записи сохранены на телефоне и уйдут, когда он ответит.';
        else if (/\b(401|403)\b|unauthorized|forbidden/i.test(сырое))
          текст = 'Сервер не принял записи этого устройства. Попробуйте войти по почте.';
        else
          текст = 'Обмен с сервером не удался. Записи сохранены на телефоне.';
        meta.appendChild(el('div', 'yac-sync-bad', текст));
      }
      var rejectedKeys = Object.keys(st.rejected || {});
      if (rejectedKeys.length) {
        meta.appendChild(el('div', 'yac-sync-bad',
          'Сервер отверг ключей: ' + rejectedKeys.length + ' (' + rejectedKeys.slice(0, 3).join(', ') + (rejectedKeys.length > 3 ? '…' : '') + ')'));
      }
      host.appendChild(meta);

      var list = [];
      try { list = sync.conflicts() || []; } catch (_) {}
      if (list.length) {
        host.appendChild(el('div', 'yac-sync-bad',
          'Расхождения: ' + list.length + '. На этом устройстве и на сервере оказались разные версии — сейчас действует серверная, ваша сохранена здесь.'));
        list.slice(0, 8).forEach(function (c) {
          var row = el('div', 'yac-sync-row');
          row.appendChild(el('span', 'yac-sync-key', c.key));
          var mine = el('button', 'yac-btn yac-btn--mini', 'Вернуть мою');
          mine.addEventListener('click', function () {
            mine.disabled = true;
            Promise.resolve(sync.resolveKeepLocal(c.key)).then(render, render);
          });
          var srv = el('button', 'yac-btn yac-btn--mini', 'Оставить серверную');
          srv.addEventListener('click', function () {
            srv.disabled = true;
            sync.resolveKeepServer && sync.resolveKeepServer(c.key);
            render();
          });
          row.appendChild(mine);
          row.appendChild(srv);
          host.appendChild(row);
        });
      }
    }
  }

  // ─── профиль ───────────────────────────────────────────────────────
  /* ═══ ПОЛЯ АККАУНТА ПРЯМО НА ЭКРАНЕ ═══════════════════════════════
     Раньше имя, фамилия, телефон, привязка почты и удаление аккаунта жили
     только в модальном окне за кнопкой «Мой аккаунт»: человек не видел, что
     у него вообще заполнено, пока не откроет окно. Эта функция рисует те же
     поля в переданный узел — окно остаётся для сайта, а в приложении поля
     стоят на экране.

     Проверка полей: имя и фамилия — до 40 знаков, пусто допустимо (это не
     обязательные поля); телефон — цифры, пробелы, скобки, плюс и дефис,
     10–18 знаков; при ошибке говорим, что именно не так, и не даём сохранить. */
  function встроить(узел, опции) {
    if (!узел) return;
    ensureCss();
    var о = опции || {};
    узел.innerHTML = '';
    if (!isLoggedIn()) return;

    var сост = el('div', 'yac-meta', 'Загружаю…');
    узел.appendChild(сост);

    api('/account').then(function (d) {
      var u = d.user || {};
      сост.textContent = '';
      if (u.email) сост.appendChild(el('div', null, u.email + (u.emailVerified ? '' : ' · не подтверждена')));
      else сост.appendChild(el('div', null, 'Почта не привязана'));

      var поля = [
        ['firstName', 'Имя', u.firstName || '', 'text', 'given-name'],
        ['lastName', 'Фамилия', u.lastName || '', 'text', 'family-name'],
        ['phone', 'Телефон', u.phone || '', 'tel', 'tel']
      ];
      var входы = {};
      поля.forEach(function (ф) {
        var л = el('label', 'yac-lbl', ф[1]);
        var и = el('input', 'yac-in');
        и.type = ф[3]; и.value = ф[2]; и.autocomplete = ф[4];
        и.maxLength = ф[0] === 'phone' ? 18 : 40;
        if (ф[0] === 'phone') { и.placeholder = '+7 900 000-00-00'; и.setAttribute('inputmode', 'tel'); }
        и.id = 'yac-pole-' + ф[0];
        л.setAttribute('for', и.id);
        узел.appendChild(л); узел.appendChild(и);
        входы[ф[0]] = и;
      });

      function проверить() {
        var т = (входы.phone.value || '').trim();
        if (т && !/^[+()\d\s-]{10,18}$/.test(т)) return 'Телефон: только цифры, пробелы, скобки, «+» и «-», от 10 знаков.';
        if ((входы.firstName.value || '').trim().length > 40) return 'Имя длиннее 40 знаков.';
        if ((входы.lastName.value || '').trim().length > 40) return 'Фамилия длиннее 40 знаков.';
        return null;
      }

      var ряд = el('div', 'yac-row');
      var сохр = el('button', 'yac-btn yac-btn--main yac-btn--wide', 'Сохранить');
      ряд.appendChild(сохр);
      if (!u.email) {
        var привязать = el('button', 'yac-btn', 'Привязать почту');
        привязать.addEventListener('click', function () { openLogin({ link: true }); });
        ряд.appendChild(привязать);
      }
      var выйти = el('button', 'yac-btn', 'Выйти');
      выйти.addEventListener('click', function () {
        выйти.disabled = true; выйти.textContent = 'Выхожу…';
        Promise.resolve(logout()).then(function () {
          выйти.disabled = false; выйти.textContent = 'Выйти';
          if (о.приВыходе) о.приВыходе();
        });
      });
      ряд.appendChild(выйти);
      узел.appendChild(ряд);

      сохр.addEventListener('click', function () {
        var беда = проверить();
        if (беда) { say(узел, беда, true); return; }
        сохр.disabled = true; сохр.textContent = 'Сохраняю…';
        api('/account', { method: 'PUT', body: {
          firstName: входы.firstName.value.trim(),
          lastName: входы.lastName.value.trim(),
          phone: входы.phone.value.trim()
        } }).then(function () {
          сохр.disabled = false; сохр.textContent = 'Сохранить';
          say(узел, 'Сохранено.', false);
          setTimeout(function () { say(узел, ''); }, 2500);
        }).catch(function (e) {
          сохр.disabled = false; сохр.textContent = 'Сохранить';
          try { console.warn('[аккаунт]', e); } catch (_) {}
          say(узел, (e && e.code === 0) ? e.message : 'Не удалось сохранить. Попробуйте позже.', true);
        });
      });

      var опасно = el('div', 'yac-row');
      var удалить = el('button', 'yac-btn yac-btn--danger', 'Удалить аккаунт');
      удалить.addEventListener('click', function () {
        if (!window.confirm('Удалить аккаунт? Личные данные и привязка почты будут стёрты. Отменить это нельзя.')) return;
        удалить.disabled = true; удалить.textContent = 'Удаляю…';
        api('/account/delete', { method: 'POST' })
          .then(function () { logout(); if (о.приВыходе) о.приВыходе(); })
          .catch(function (e) {
            удалить.disabled = false; удалить.textContent = 'Удалить аккаунт';
            say(узел, 'Не удалось удалить. Попробуйте позже.', true);
          });
      });
      опасно.appendChild(удалить);
      узел.appendChild(опасно);
    }).catch(function (e) {
      сост.textContent = '';
      if (e && e.code === 401) { logout(); if (о.приВыходе) о.приВыходе(); return; }
      try { console.warn('[аккаунт]', e); } catch (_) {}
      say(узел, (e && e.code === 0) ? e.message : 'Не удалось загрузить данные аккаунта.', true);
    });
  }

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
        syncSection(b);
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
          try { console.warn('[профиль]', e); } catch (_) {}
          say(b, (e && e.code === 0) ? e.message : 'Не удалось загрузить профиль. Попробуйте позже.', true);
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
    сообщитьОбАккаунте();
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
    встроить: встроить,
    logout: logout,
    user: user,
    isLoggedIn: isLoggedIn,
    refreshNav: renderNav
  };
})();
