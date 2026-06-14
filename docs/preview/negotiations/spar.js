/* ═══════════════════════════════════════════════════════════════════
   negotiations/spar.js — режим «Спарринг»: чат-диалог с ИИ-собеседником
   на правилах (без сети и ключа). Тренирует параметры встречи.

   Контент — window.NegSpar (spar-content.js): массив сценариев, каждый —
   ветвящийся диалог из ходов (beats); свободный ввод распознаётся по
   стемам-ключам, плюс быстрые реплики-подсказки.

   Также владеет верхними вкладками «Сценарии | Спарринг».
   Прогресс — localStorage 'yasna_neg_spar_v1'.
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

  // ── прогресс ─────────────────────────────────────────────────────
  var SKEY = 'yasna_neg_spar_v1';
  function loadProg() { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (_) { return {}; } }
  function saveProg(p) { try { localStorage.setItem(SKEY, JSON.stringify(p)); } catch (_) {} }
  var prog = loadProg();

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

  // ═══ выбор параметра (карточки) ═══════════════════════════════════
  var sparRoot = null;

  function renderSelector() {
    if (!sparRoot) return;
    sparRoot.innerHTML = '';
    if (!SPAR.length) { sparRoot.appendChild(el('div', 'neg-ex-empty', 'Сценарии спарринга не загружены.')); return; }

    var intro = el('div', 'neg-spar-intro');
    intro.innerHTML =
      '<p class="neg-section-sub">Живой диалог с собеседником-ИИ. Выбери параметр встречи — и тренируй его в разговоре: ' +
      'отвечай своими словами или жми подсказки. Собеседник реагирует на твой ход, в конце — разбор.</p>';
    sparRoot.appendChild(intro);

    var grid = el('div', 'neg-spar-grid');
    SPAR.forEach(function (sc) {
      var st = prog[sc.id] || {};
      var badge = st.plays
        ? '<span class="neg-spar-card-badge">лучшее ' + (st.best || 0) + '/' + sc.beats.length + '</span>'
        : '<span class="neg-spar-card-badge neg-spar-card-badge--new">новое</span>';
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
      card.addEventListener('click', function () { startSpar(sc); });
      grid.appendChild(card);
    });
    sparRoot.appendChild(grid);
  }

  // ═══ чат-сессия ═══════════════════════════════════════════════════
  var S = null; // { sc, beat, good, meter, msgsEl, locked }

  function startSpar(sc) {
    S = { sc: sc, beat: 0, good: 0, meter: Math.floor(sc.beats.length / 2), locked: false, msgsEl: null };
    renderChat();
  }

  function renderChat() {
    sparRoot.innerHTML = '';
    var sc = S.sc;

    // шапка собеседника
    var head = el('div', 'neg-spar-head');
    head.innerHTML =
      '<button type="button" class="neg-spar-back">← К параметрам</button>' +
      '<div class="neg-spar-persona">' +
        '<span class="neg-spar-persona-glyph">' + esc(sc.persona.glyph) + '</span>' +
        '<span class="neg-spar-persona-meta">' +
          '<span class="neg-spar-persona-name">' + esc(sc.persona.name) + '</span>' +
          '<span class="neg-spar-persona-role">' + esc(sc.persona.role) + '</span>' +
        '</span>' +
      '</div>';
    head.querySelector('.neg-spar-back').addEventListener('click', function () { renderSelector(); });
    sparRoot.appendChild(head);

    // цель + сеттинг
    var goal = el('div', 'neg-spar-goal');
    goal.innerHTML =
      '<div class="neg-spar-setting">' + esc(sc.setting) + '</div>' +
      '<div class="neg-spar-goal-text"><b>Цель:</b> ' + esc(sc.goal) + '</div>';
    sparRoot.appendChild(goal);

    // метр
    var meter = el('div', 'neg-spar-meter');
    meter.innerHTML =
      '<span class="neg-spar-meter-lbl">' + esc(sc.meterLabel) + '</span>' +
      '<span class="neg-spar-meter-bar"><span class="neg-spar-meter-fill" id="neg-spar-meter-fill"></span></span>';
    sparRoot.appendChild(meter);

    // лента сообщений
    S.msgsEl = el('div', 'neg-spar-msgs');
    sparRoot.appendChild(S.msgsEl);

    // зона ввода
    var input = el('div', 'neg-spar-input');
    input.innerHTML =
      '<div class="neg-spar-hint" id="neg-spar-hint"></div>' +
      '<div class="neg-spar-chips" id="neg-spar-chips"></div>' +
      '<div class="neg-spar-typebar">' +
        '<textarea class="neg-spar-ta" id="neg-spar-ta" rows="1" placeholder="Ответь своими словами…"></textarea>' +
        '<button type="button" class="neg-spar-send" id="neg-spar-send">→</button>' +
      '</div>';
    sparRoot.appendChild(input);

    var ta = input.querySelector('#neg-spar-ta');
    var send = input.querySelector('#neg-spar-send');
    send.addEventListener('click', function () { submitText(ta); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitText(ta); }
    });

    updateMeter();
    // первая реплика собеседника
    addMsg('ai', sc.beats[0].ai);
    showBeat();
  }

  function submitText(ta) {
    var t = (ta.value || '').trim();
    if (!t) return;
    ta.value = '';
    var move = classify(t, S.sc.beats[S.beat].moves);
    step(move, t);
  }

  function classify(text, moves) {
    var t = text.toLowerCase();
    var best = null, bestScore = -1, midMove = null, firstMove = moves[0];
    moves.forEach(function (m) {
      if (m.tag === 'mid' && !midMove) midMove = m;
      var sc = 0;
      (m.keywords || []).forEach(function (kw) {
        if (kw && t.indexOf(String(kw).toLowerCase()) >= 0) sc += 1;
      });
      if (sc > bestScore) { bestScore = sc; best = m; }
    });
    if (bestScore <= 0) return midMove || firstMove; // не распознали — нейтральный по умолчанию
    return best;
  }

  function showBeat() {
    var beat = S.sc.beats[S.beat];
    var hintEl = document.getElementById('neg-spar-hint');
    var chipsEl = document.getElementById('neg-spar-chips');
    if (hintEl) hintEl.innerHTML = beat.hint ? '💡 ' + esc(beat.hint) : '';
    if (!chipsEl) return;
    chipsEl.innerHTML = '';
    beat.moves.forEach(function (m) {
      var chip = el('button', 'neg-spar-chip');
      chip.type = 'button';
      chip.textContent = m.text;
      chip.addEventListener('click', function () { step(m, m.text); });
      chipsEl.appendChild(chip);
    });
  }

  function step(move, userText) {
    if (S.locked) return;
    // ход игрока
    addMsg('me', userText);
    if (move.tag === 'good') { S.good += 1; S.meter += 1; }
    else if (move.tag === 'bad') { S.meter -= 1; }
    if (S.meter < 0) S.meter = 0;
    if (S.meter > S.sc.beats.length) S.meter = S.sc.beats.length;
    updateMeter();

    // микро-разбор
    addCoach(move.tag, move.why);

    // ответ собеседника
    addMsg('ai', move.reply);

    S.beat += 1;
    if (S.beat >= S.sc.beats.length) { setTimeout(debrief, 60); return; }
    // следующая реплика собеседника
    addMsg('ai', S.sc.beats[S.beat].ai);
    showBeat();
  }

  function addMsg(side, text) {
    var m = el('div', 'neg-spar-msg neg-spar-msg--' + side);
    m.appendChild(el('div', 'neg-spar-bubble', esc(text)));
    S.msgsEl.appendChild(m);
    scrollMsgs();
  }
  function addCoach(tag, why) {
    if (!why) return;
    var sign = tag === 'good' ? '✓' : tag === 'bad' ? '✗' : '~';
    var c = el('div', 'neg-spar-coach neg-spar-coach--' + tag, sign + ' ' + esc(why));
    S.msgsEl.appendChild(c);
    scrollMsgs();
  }
  function scrollMsgs() {
    if (S.msgsEl) S.msgsEl.scrollTop = S.msgsEl.scrollHeight;
  }
  function updateMeter() {
    var f = document.getElementById('neg-spar-meter-fill');
    if (f) f.style.width = Math.round(S.meter / S.sc.beats.length * 100) + '%';
  }

  function debrief() {
    var sc = S.sc, n = sc.beats.length;
    var tier = S.good >= n - 1 ? 'good' : (S.good <= 1 ? 'bad' : 'mid');
    var title = tier === 'good' ? 'Отличный спарринг' : tier === 'bad' ? 'Контакт потерян' : 'Неплохо, но есть куда расти';

    var st = prog[sc.id] || { best: 0, plays: 0 };
    st.plays = (st.plays || 0) + 1;
    if (S.good > (st.best || 0)) st.best = S.good;
    prog[sc.id] = st;
    saveProg(prog);

    var box = el('div', 'neg-spar-debrief neg-spar-debrief--' + tier);
    box.innerHTML =
      '<div class="neg-spar-deb-title">' + title + ' · ' + S.good + '/' + n + '</div>' +
      '<div class="neg-spar-deb-text">' + esc(sc.debrief[tier]) + '</div>' +
      '<div class="neg-spar-deb-sub">Лучший результат: ' + st.best + '/' + n + '</div>';
    S.msgsEl.appendChild(box);
    scrollMsgs();

    // спрятать ввод, показать действия
    var hintEl = document.getElementById('neg-spar-hint');
    var chipsEl = document.getElementById('neg-spar-chips');
    var typebar = sparRoot.querySelector('.neg-spar-typebar');
    if (hintEl) hintEl.innerHTML = '';
    if (typebar) typebar.style.display = 'none';
    if (chipsEl) {
      chipsEl.innerHTML = '';
      var again = el('button', 'neg-btn neg-btn--primary', 'Ещё раз →');
      again.type = 'button';
      again.addEventListener('click', function () { startSpar(sc); });
      var other = el('button', 'neg-spar-chip neg-spar-chip--alt', '← Другой параметр');
      other.type = 'button';
      other.addEventListener('click', function () { renderSelector(); });
      chipsEl.appendChild(again);
      chipsEl.appendChild(other);
    }
    S.locked = true;
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
