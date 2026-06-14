/* ═══════════════════════════════════════════════════════════════════
   negotiations/spar.js — режим «Спарринг»: чат-диалог с собеседником.
   Два движка:
     · «Готовый сценарий» — скриптовый диалог на правилах (window.NegSpar),
       без сети и ключа. Выбор реплики кнопками ИЛИ свободный ввод (по стемам).
     · «Реальный ИИ» — живой LLM по СВОЕМУ ключу (BYOK). Ключ хранится только
       в браузере (localStorage), НЕ в коде/репозитории. Браузер сам зовёт
       Claude API (anthropic-dangerous-direct-browser-access).

   Владеет верхними вкладками «Сценарии | Спарринг».
   Прогресс сценариев — localStorage 'yasna_neg_spar_v1'.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c];
    });
  }

  var SPAR = window.NegSpar || [];

  // ── хранилище ────────────────────────────────────────────────────
  var SKEY = 'yasna_neg_spar_v1';
  function loadProg() { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (_) { return {}; } }
  function saveProg(p) { try { localStorage.setItem(SKEY, JSON.stringify(p)); } catch (_) {} }
  var prog = loadProg();

  function getEngine() { try { return localStorage.getItem('yasna_neg_engine') || 'script'; } catch (_) { return 'script'; } }
  function setEngine(v) { try { localStorage.setItem('yasna_neg_engine', v); } catch (_) {} }
  function getKey() { try { return localStorage.getItem('yasna_neg_aikey') || ''; } catch (_) { return ''; } }
  function setKey(v) { try { v ? localStorage.setItem('yasna_neg_aikey', v) : localStorage.removeItem('yasna_neg_aikey'); } catch (_) {} }
  function getModel() { try { return localStorage.getItem('yasna_neg_aimodel') || 'claude-haiku-4-5'; } catch (_) { return 'claude-haiku-4-5'; } }
  function setModel(v) { try { localStorage.setItem('yasna_neg_aimodel', v); } catch (_) {} }

  // ═══ верхние вкладки режимов ══════════════════════════════════════
  function setupModeTabs() {
    var tabs = document.getElementById('neg-mode-tabs');
    if (!tabs) return;
    var paneL = document.getElementById('neg-mode-lessons');
    var paneS = document.getElementById('neg-mode-spar');
    function show(mode) {
      [].forEach.call(tabs.querySelectorAll('.neg-mode-tab'), function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-mode') === mode);
      });
      if (paneL) paneL.hidden = mode !== 'lessons';
      if (paneS) paneS.hidden = mode !== 'spar';
      try { localStorage.setItem('yasna_neg_mode', mode); } catch (_) {}
    }
    [].forEach.call(tabs.querySelectorAll('.neg-mode-tab'), function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-mode')); });
    });
    var saved = null; try { saved = localStorage.getItem('yasna_neg_mode'); } catch (_) {}
    show(saved === 'spar' ? 'spar' : 'lessons');
  }

  var sparRoot = null;

  // ═══ экран выбора: движок + ключ + параметры ══════════════════════
  function renderSelector() {
    if (!sparRoot) return;
    sparRoot.innerHTML = '';
    var engine = getEngine();

    // 1) как это работает
    sparRoot.appendChild(el('p', 'neg-section-sub',
      'Тренируй параметр встречи в живом диалоге. Шаг 1 — выбери движок. Шаг 2 — выбери параметр. Дальше веди разговор: отвечай в чате.'));

    // 2) выбор движка
    var eng = el('div', 'neg-spar-engine');
    eng.innerHTML =
      '<button type="button" class="neg-spar-eng-btn' + (engine === 'script' ? ' is-active' : '') + '" data-eng="script">' +
        '<span class="neg-spar-eng-h">📋 Готовый сценарий</span>' +
        '<span class="neg-spar-eng-d">Без ключа и интернета. Реплики на правилах, выбор кнопками или текстом.</span>' +
      '</button>' +
      '<button type="button" class="neg-spar-eng-btn' + (engine === 'ai' ? ' is-active' : '') + '" data-eng="ai">' +
        '<span class="neg-spar-eng-h">🤖 Реальный ИИ</span>' +
        '<span class="neg-spar-eng-d">Живой собеседник на твоём API-ключе. Пишешь свободно, ИИ отвечает в роли.</span>' +
      '</button>';
    [].forEach.call(eng.querySelectorAll('.neg-spar-eng-btn'), function (b) {
      b.addEventListener('click', function () { setEngine(b.getAttribute('data-eng')); renderSelector(); });
    });
    sparRoot.appendChild(eng);

    // 3) панель ключа (только для ИИ)
    if (engine === 'ai') sparRoot.appendChild(renderKeyPanel());

    // 4) карточки параметров
    if (!SPAR.length) { sparRoot.appendChild(el('div', 'neg-ex-empty', 'Сценарии не загружены.')); return; }
    sparRoot.appendChild(el('div', 'neg-spar-pick-label', 'Выбери параметр встречи:'));
    var grid = el('div', 'neg-spar-grid');
    SPAR.forEach(function (sc) {
      var st = prog[sc.id] || {};
      var badge = (engine === 'script' && st.plays)
        ? '<span class="neg-spar-card-badge">лучшее ' + (st.best || 0) + '/' + sc.beats.length + '</span>'
        : '<span class="neg-spar-card-badge neg-spar-card-badge--new">тренировать →</span>';
      var card = el('button', 'neg-spar-card');
      card.type = 'button';
      card.innerHTML =
        '<span class="neg-spar-card-glyph">' + esc(sc.persona.glyph) + '</span>' +
        '<span class="neg-spar-card-body">' +
          '<span class="neg-spar-card-param">' + esc(sc.param) + '</span>' +
          '<span class="neg-spar-card-title">' + esc(sc.title) + '</span>' +
          '<span class="neg-spar-card-persona">' + esc(sc.persona.name) + ' · ' + esc(sc.persona.role) + '</span>' +
        '</span>' +
        '<span class="neg-spar-card-foot">' + badge + '</span>';
      card.addEventListener('click', function () { openScenario(sc); });
      grid.appendChild(card);
    });
    sparRoot.appendChild(grid);
  }

  function renderKeyPanel() {
    var wrap = el('div', 'neg-spar-key');
    var hasKey = !!getKey();
    if (hasKey) {
      wrap.innerHTML =
        '<div class="neg-spar-key-row"><span class="neg-spar-key-ok">✓ Ключ сохранён</span> ' +
        '<span class="neg-spar-key-sub">в этом браузере · модель: ' + esc(getModel()) + '</span></div>' +
        '<div class="neg-spar-key-actions">' +
          '<button type="button" class="neg-spar-key-link" data-act="edit">Сменить ключ</button>' +
          '<button type="button" class="neg-spar-key-link" data-act="del">Удалить</button>' +
        '</div>';
      wrap.querySelector('[data-act="del"]').addEventListener('click', function () { setKey(''); renderSelector(); });
      wrap.querySelector('[data-act="edit"]').addEventListener('click', function () { setKey(''); renderSelector(); });
      return wrap;
    }
    wrap.innerHTML =
      '<div class="neg-spar-key-title">🔑 Вставь свой Anthropic API-ключ</div>' +
      '<p class="neg-spar-key-note">Ключ хранится <b>только в этом браузере</b> (localStorage) и шлётся напрямую в Claude API — он не попадает на наш сервер и не в код сайта. ' +
      'Получить ключ: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>.</p>' +
      '<div class="neg-spar-key-form">' +
        '<input type="password" class="neg-spar-key-input" id="neg-spar-key-input" placeholder="sk-ant-..." autocomplete="off"/>' +
        '<select class="neg-spar-key-model" id="neg-spar-key-model">' +
          '<option value="claude-haiku-4-5">Haiku (быстрее/дешевле)</option>' +
          '<option value="claude-sonnet-4-6">Sonnet (умнее)</option>' +
        '</select>' +
        '<button type="button" class="neg-spar-key-save" id="neg-spar-key-save">Сохранить</button>' +
      '</div>';
    wrap.querySelector('#neg-spar-key-save').addEventListener('click', function () {
      var v = (wrap.querySelector('#neg-spar-key-input').value || '').trim();
      var m = wrap.querySelector('#neg-spar-key-model').value;
      if (!v) { wrap.querySelector('#neg-spar-key-input').focus(); return; }
      setModel(m); setKey(v); renderSelector();
    });
    return wrap;
  }

  function openScenario(sc) {
    if (getEngine() === 'ai') {
      if (!getKey()) { renderSelector(); var i = document.getElementById('neg-spar-key-input'); if (i) i.focus(); return; }
      startAIChat(sc);
    } else {
      startScriptChat(sc);
    }
  }

  // ═══ общий каркас чата ════════════════════════════════════════════
  function chatShell(sc, engineLabel) {
    sparRoot.innerHTML = '';
    var head = el('div', 'neg-spar-head');
    head.innerHTML =
      '<button type="button" class="neg-spar-back">← К выбору</button>' +
      '<div class="neg-spar-persona">' +
        '<span class="neg-spar-persona-glyph">' + esc(sc.persona.glyph) + '</span>' +
        '<span class="neg-spar-persona-meta">' +
          '<span class="neg-spar-persona-name">' + esc(sc.persona.name) + '</span>' +
          '<span class="neg-spar-persona-role">' + esc(sc.persona.role) + '</span>' +
        '</span>' +
      '</div>' +
      '<span class="neg-spar-engine-tag">' + engineLabel + '</span>';
    head.querySelector('.neg-spar-back').addEventListener('click', function () { renderSelector(); });
    sparRoot.appendChild(head);

    var goal = el('div', 'neg-spar-goal');
    goal.innerHTML =
      '<div class="neg-spar-setting">' + esc(sc.setting) + '</div>' +
      '<div class="neg-spar-goal-text"><b>Твоя цель:</b> ' + esc(sc.goal) + '</div>';
    sparRoot.appendChild(goal);

    var msgs = el('div', 'neg-spar-msgs');
    sparRoot.appendChild(msgs);
    return msgs;
  }

  function bubble(msgs, side, text, glyph) {
    var m = el('div', 'neg-spar-msg neg-spar-msg--' + side);
    if (side === 'ai') m.appendChild(el('span', 'neg-spar-avatar', glyph || '💬'));
    m.appendChild(el('div', 'neg-spar-bubble', esc(text)));
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  }
  function coach(msgs, tag, why) {
    if (!why) return;
    var sign = tag === 'good' ? '✓' : tag === 'bad' ? '✗' : '~';
    msgs.appendChild(el('div', 'neg-spar-coach neg-spar-coach--' + tag, sign + ' ' + esc(why)));
    msgs.scrollTop = msgs.scrollHeight;
  }

  /* ═══════════════ ДВИЖОК 1: готовый сценарий ════════════════════ */
  var SS = null;
  function startScriptChat(sc) {
    SS = { sc: sc, beat: 0, good: 0, meter: Math.floor(sc.beats.length / 2), locked: false, msgs: null };
    SS.msgs = chatShell(sc, '📋 Сценарий');

    var meter = el('div', 'neg-spar-meter');
    meter.innerHTML = '<span class="neg-spar-meter-lbl">' + esc(sc.meterLabel) + '</span>' +
      '<span class="neg-spar-meter-bar"><span class="neg-spar-meter-fill" id="neg-spar-meter-fill"></span></span>';
    SS.msgs.parentNode.insertBefore(meter, SS.msgs);

    // композер
    var comp = el('div', 'neg-spar-composer');
    comp.innerHTML =
      '<div class="neg-spar-hint" id="neg-spar-hint"></div>' +
      '<div class="neg-spar-opts-label">Твой ход — нажми реплику:</div>' +
      '<div class="neg-spar-opts" id="neg-spar-opts"></div>' +
      '<div class="neg-spar-or"><span>или напиши свой ответ</span></div>' +
      '<div class="neg-spar-typebar">' +
        '<textarea class="neg-spar-ta" id="neg-spar-ta" rows="1" placeholder="Свой ответ…"></textarea>' +
        '<button type="button" class="neg-spar-send" id="neg-spar-send" title="Отправить">→</button>' +
      '</div>';
    sparRoot.appendChild(comp);
    var ta = comp.querySelector('#neg-spar-ta');
    comp.querySelector('#neg-spar-send').addEventListener('click', function () { ssSubmitText(ta); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ssSubmitText(ta); } });

    ssMeter();
    bubble(SS.msgs, 'ai', sc.beats[0].ai, sc.persona.glyph);
    ssShowBeat();
  }
  function ssMeter() { var f = document.getElementById('neg-spar-meter-fill'); if (f) f.style.width = Math.round(SS.meter / SS.sc.beats.length * 100) + '%'; }
  function ssSubmitText(ta) {
    var t = (ta.value || '').trim(); if (!t || SS.locked) return; ta.value = '';
    ssStep(ssClassify(t, SS.sc.beats[SS.beat].moves), t);
  }
  function ssClassify(text, moves) {
    var t = text.toLowerCase(), best = null, bestScore = -1, midM = null, first = moves[0];
    moves.forEach(function (m) {
      if (m.tag === 'mid' && !midM) midM = m;
      var s = 0; (m.keywords || []).forEach(function (kw) { if (kw && t.indexOf(String(kw).toLowerCase()) >= 0) s += 1; });
      if (s > bestScore) { bestScore = s; best = m; }
    });
    return bestScore <= 0 ? (midM || first) : best;
  }
  function ssShowBeat() {
    var beat = SS.sc.beats[SS.beat];
    var hintEl = document.getElementById('neg-spar-hint');
    var optsEl = document.getElementById('neg-spar-opts');
    if (hintEl) hintEl.innerHTML = beat.hint ? '💡 ' + esc(beat.hint) : '';
    if (!optsEl) return;
    optsEl.innerHTML = '';
    beat.moves.forEach(function (m) {
      var b = el('button', 'neg-spar-opt');
      b.type = 'button';
      b.innerHTML = '<span class="neg-spar-opt-mark">›</span><span class="neg-spar-opt-text">' + esc(m.text) + '</span>';
      b.addEventListener('click', function () { ssStep(m, m.text); });
      optsEl.appendChild(b);
    });
  }
  function ssStep(move, userText) {
    if (SS.locked) return;
    bubble(SS.msgs, 'me', userText);
    if (move.tag === 'good') { SS.good += 1; SS.meter += 1; } else if (move.tag === 'bad') { SS.meter -= 1; }
    SS.meter = Math.max(0, Math.min(SS.sc.beats.length, SS.meter));
    ssMeter();
    coach(SS.msgs, move.tag, move.why);
    bubble(SS.msgs, 'ai', move.reply, SS.sc.persona.glyph);
    SS.beat += 1;
    if (SS.beat >= SS.sc.beats.length) { setTimeout(ssDebrief, 80); return; }
    bubble(SS.msgs, 'ai', SS.sc.beats[SS.beat].ai, SS.sc.persona.glyph);
    ssShowBeat();
  }
  function ssDebrief() {
    var sc = SS.sc, n = sc.beats.length;
    var tier = SS.good >= n - 1 ? 'good' : (SS.good <= 1 ? 'bad' : 'mid');
    var title = tier === 'good' ? 'Отличный спарринг' : tier === 'bad' ? 'Контакт потерян' : 'Неплохо, есть куда расти';
    var st = prog[sc.id] || { best: 0, plays: 0 };
    st.plays = (st.plays || 0) + 1; if (SS.good > (st.best || 0)) st.best = SS.good; prog[sc.id] = st; saveProg(prog);
    showDebrief(SS.msgs, tier, title + ' · ' + SS.good + '/' + n, sc.debrief[tier], 'Лучший результат: ' + st.best + '/' + n,
      function () { startScriptChat(sc); });
    SS.locked = true;
  }

  /* ═══════════════ ДВИЖОК 2: реальный ИИ (BYOK) ══════════════════ */
  var AI = null;
  function startAIChat(sc) {
    AI = { sc: sc, history: [], turns: 0, busy: false, msgs: null };
    AI.msgs = chatShell(sc, '🤖 ИИ · ' + getModel().replace('claude-', ''));

    var comp = el('div', 'neg-spar-composer');
    comp.innerHTML =
      '<div class="neg-spar-hint">💡 Пиши собеседнику свободно — он ответит в роли. Когда захочешь итог — нажми «Завершить».</div>' +
      '<div class="neg-spar-typebar">' +
        '<textarea class="neg-spar-ta" id="neg-spar-ta" rows="1" placeholder="Напиши собеседнику…"></textarea>' +
        '<button type="button" class="neg-spar-send" id="neg-spar-send" title="Отправить">→</button>' +
      '</div>' +
      '<button type="button" class="neg-spar-finish" id="neg-spar-finish" hidden>Завершить и получить разбор</button>';
    sparRoot.appendChild(comp);
    var ta = comp.querySelector('#neg-spar-ta');
    comp.querySelector('#neg-spar-send').addEventListener('click', function () { aiSend(ta); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend(ta); } });
    comp.querySelector('#neg-spar-finish').addEventListener('click', aiFinish);

    // первая реплика собеседника
    aiKick();
  }

  function aiSystem(sc) {
    return 'Ты играешь РОЛЬ собеседника на деловых переговорах, НЕ ассистента. ' +
      'Персона: ' + sc.persona.name + ' — ' + sc.persona.role + '. Обстановка: ' + sc.setting + ' ' +
      'Пользователь — переговорщик напротив; он тренирует параметр «' + sc.param + '»: ' + sc.goal + ' ' +
      'Веди себя как живой человек этой роли: отвечай коротко (1–3 фразы), по-русски, эмоционально достоверно. ' +
      'Реагируй на КАЧЕСТВО его хода по сути параметра: ведёт верно — теплей и двигайся навстречу; давит/мимо — холодней, сопротивляйся, можешь и уйти из контакта. ' +
      'Никогда не выходи из роли, не объясняй правила, не давай советов и мета-комментариев. Только реплики персонажа.';
  }
  async function callClaude(messages, system, maxTokens) {
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': getKey(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: getModel(), max_tokens: maxTokens || 320, system: system, messages: messages })
    });
    if (!res.ok) {
      var t = ''; try { t = await res.text(); } catch (_) {}
      throw new Error('HTTP ' + res.status + (t ? ' · ' + t.slice(0, 160) : ''));
    }
    var data = await res.json();
    return (data.content && data.content[0] && data.content[0].text) ? data.content[0].text.trim() : '(пустой ответ)';
  }
  function aiTyping(on) {
    var ex = AI.msgs.querySelector('.neg-spar-typing');
    if (on && !ex) {
      var m = el('div', 'neg-spar-msg neg-spar-msg--ai neg-spar-typing');
      m.appendChild(el('span', 'neg-spar-avatar', AI.sc.persona.glyph));
      m.appendChild(el('div', 'neg-spar-bubble', '<span class="neg-spar-dots"><i></i><i></i><i></i></span>'));
      AI.msgs.appendChild(m); AI.msgs.scrollTop = AI.msgs.scrollHeight;
    } else if (!on && ex) { ex.remove(); }
  }
  function aiSetBusy(b) {
    AI.busy = b;
    var send = document.getElementById('neg-spar-send'); var ta = document.getElementById('neg-spar-ta');
    if (send) send.disabled = b; if (ta) ta.disabled = b;
  }
  async function aiKick() {
    aiSetBusy(true); aiTyping(true);
    try {
      var msgs = [{ role: 'user', content: 'Начни встречу: скажи свою первую реплику в роли, коротко.' }];
      var reply = await callClaude(msgs, aiSystem(AI.sc), 200);
      AI.history.push({ role: 'user', content: '[начало встречи]' }, { role: 'assistant', content: reply });
      aiTyping(false); bubble(AI.msgs, 'ai', reply, AI.sc.persona.glyph);
    } catch (e) {
      aiTyping(false); aiError(e);
    } finally { aiSetBusy(false); }
  }
  async function aiSend(ta) {
    if (AI.busy) return;
    var t = (ta.value || '').trim(); if (!t) return; ta.value = '';
    bubble(AI.msgs, 'me', t);
    AI.history.push({ role: 'user', content: t });
    AI.turns += 1;
    var fin = document.getElementById('neg-spar-finish'); if (fin && AI.turns >= 1) fin.hidden = false;
    aiSetBusy(true); aiTyping(true);
    try {
      var reply = await callClaude(AI.history.slice(), aiSystem(AI.sc), 320);
      AI.history.push({ role: 'assistant', content: reply });
      aiTyping(false); bubble(AI.msgs, 'ai', reply, AI.sc.persona.glyph);
    } catch (e) { aiTyping(false); aiError(e); } finally { aiSetBusy(false); }
  }
  async function aiFinish() {
    if (AI.busy) return;
    aiSetBusy(true); aiTyping(true);
    try {
      var hist = AI.history.slice();
      hist.push({ role: 'user', content: 'Выйди из роли. Как тренер оцени, как я провёл этот разговор по параметру «' + AI.sc.param + '» (' + AI.sc.goal + '). ' +
        'Дай короткий разбор (2–4 фразы): что сработало, что улучшить. Начни ПЕРВОЙ строкой ровно так: «Оценка: N/5» (N — целое 0–5).' });
      var verdict = await callClaude(hist, 'Ты — наставник по переговорам. Отвечай по-русски, по делу, без воды.', 400);
      aiTyping(false);
      var tier = 'mid'; var mscore = verdict.match(/(\d)\s*\/\s*5/); var n = mscore ? parseInt(mscore[1], 10) : null;
      if (n != null) tier = n >= 4 ? 'good' : (n <= 1 ? 'bad' : 'mid');
      showDebrief(AI.msgs, tier, 'Разбор спарринга', verdict, '', null);
      var fin = document.getElementById('neg-spar-finish'); if (fin) fin.hidden = true;
      var tb = sparRoot.querySelector('.neg-spar-typebar'); if (tb) tb.style.display = 'none';
    } catch (e) { aiTyping(false); aiError(e); } finally { aiSetBusy(false); }
  }
  function aiError(e) {
    var msg = (e && e.message) ? e.message : 'неизвестная ошибка';
    var box = el('div', 'neg-spar-aierr');
    box.innerHTML = '⚠ Не удалось получить ответ ИИ: ' + esc(msg) +
      '<br><span class="neg-spar-aierr-sub">Проверь API-ключ и доступ к модели. Можно сменить ключ в «← К выбору».</span>';
    AI.msgs.appendChild(box); AI.msgs.scrollTop = AI.msgs.scrollHeight;
  }

  // ═══ общий разбор ═════════════════════════════════════════════════
  function showDebrief(msgs, tier, title, text, sub, onAgain) {
    var box = el('div', 'neg-spar-debrief neg-spar-debrief--' + tier);
    box.innerHTML =
      '<div class="neg-spar-deb-title">' + esc(title) + '</div>' +
      '<div class="neg-spar-deb-text">' + esc(text).replace(/\n/g, '<br>') + '</div>' +
      (sub ? '<div class="neg-spar-deb-sub">' + esc(sub) + '</div>' : '');
    var actions = el('div', 'neg-spar-deb-actions');
    if (onAgain) {
      var again = el('button', 'neg-btn neg-btn--primary', 'Ещё раз →'); again.type = 'button';
      again.addEventListener('click', onAgain); actions.appendChild(again);
    }
    var other = el('button', 'neg-spar-back', '← К выбору'); other.type = 'button';
    other.addEventListener('click', function () { renderSelector(); });
    actions.appendChild(other);
    box.appendChild(actions);
    msgs.appendChild(box); msgs.scrollTop = msgs.scrollHeight;

    // спрятать композер сценария
    var comp = sparRoot.querySelector('.neg-spar-composer');
    if (comp && onAgain) {
      var opts = comp.querySelector('.neg-spar-opts'); var orr = comp.querySelector('.neg-spar-or');
      var tb = comp.querySelector('.neg-spar-typebar'); var hint = comp.querySelector('.neg-spar-hint');
      var lbl = comp.querySelector('.neg-spar-opts-label');
      [opts, orr, tb, hint, lbl].forEach(function (n) { if (n) n.style.display = 'none'; });
    }
  }

  // ═══ bootstrap ════════════════════════════════════════════════════
  function init() {
    sparRoot = document.getElementById('neg-spar-root');
    setupModeTabs();
    if (sparRoot) renderSelector();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
