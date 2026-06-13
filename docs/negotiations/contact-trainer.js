/* ═══════════════════════════════════════════════════════════════════
   negotiations/contact-trainer.js — тренажёр «Вход в контакт» (vanilla JS).
   CJM: встреча → определи тип (ХА/ФО/ЦИ/ШЭ) → выбери заход → разбор →
   следующая встреча → финальный дебриф. Контент — window.NegContact.
   Автономен (без бандла), прогресс в namespace localStorage 'yasna_negc_*'.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var C = window.NegContact;
  if (!C) { console.error('[negc] contact-content.js не загружен'); return; }
  var TYPES = C.types;
  var TYPE_BY_ID = {};
  TYPES.forEach(function (t) { TYPE_BY_ID[t.id] = t; });

  // ── helpers ──────────────────────────────────────────────────────
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  // Детерминированный shuffle (Fisher–Yates + LCG от seed) — без Math.random.
  function shuffle(n, seed) {
    var arr = [], i; for (i = 0; i < n; i++) arr.push(i);
    var s = (seed || 1) >>> 0;
    for (var k = arr.length - 1; k > 0; k--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      var j = s % (k + 1), t = arr[k]; arr[k] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ── persistence ──────────────────────────────────────────────────
  var KEY = 'yasna_negc_v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; } }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (_) {} }
  var prog = load();
  if (typeof prog.sessions !== 'number') prog.sessions = 0;
  if (typeof prog.bestContacts !== 'number') prog.bestContacts = 0;

  // ═══ Справка: 4 карточки типов ════════════════════════════════════
  function renderTypes(root) {
    var grid = el('div', 'neg-c-types');
    TYPES.forEach(function (t) {
      var card = el('button', 'neg-c-type neg-c-type--' + t.id);
      card.type = 'button';
      card.setAttribute('aria-expanded', 'false');
      card.innerHTML =
        '<span class="neg-c-type-head">' +
          '<span class="neg-c-type-glyph">' + t.glyph + '</span>' +
          '<span class="neg-c-type-id">' + esc(t.id) + '</span>' +
          '<span class="neg-c-type-name">' + esc(t.name) + '</span>' +
        '</span>' +
        '<span class="neg-c-type-one">' + esc(t.oneLiner) + '</span>' +
        '<span class="neg-c-type-more">' +
          '<span class="neg-c-type-lbl">Как распознать</span>' +
          '<ul class="neg-c-type-cues"><li>' + t.readCues.map(esc).join('</li><li>') + '</li></ul>' +
          '<span class="neg-c-type-lbl">Как входить</span><p>' + esc(t.openApproach) + '</p>' +
          '<span class="neg-c-type-lbl neg-c-type-lbl--no">Что отталкивает</span><p>' + esc(t.avoid) + '</p>' +
        '</span>';
      card.addEventListener('click', function () {
        var open = card.classList.toggle('is-open');
        card.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      grid.appendChild(card);
    });
    root.appendChild(grid);
  }

  // ═══ Сценарий ═════════════════════════════════════════════════════
  var S = { deck: [], pos: 0, step: 'type', locked: false,
            contacts: 0, typeRight: 0, missType: {}, missOpen: {}, onDone: null };

  function startSession() {
    S.deck = shuffle(C.encounters.length, 7 + prog.sessions * 13);
    S.pos = 0; S.step = 'type'; S.locked = false;
    S.contacts = 0; S.typeRight = 0; S.missType = {}; S.missOpen = {};
  }

  function curEnc() { return C.encounters[S.deck[S.pos]]; }

  function render(root) {
    root.innerHTML = '';
    if (S.pos >= S.deck.length) { renderSummary(root); return; }
    var enc = curEnc();

    // прогресс
    var head = el('div', 'neg-c-head');
    head.innerHTML =
      '<span class="neg-c-count">Встреча ' + (S.pos + 1) + ' / ' + S.deck.length + '</span>' +
      '<span class="neg-c-score">контакт ' + S.contacts + ' · тип ' + S.typeRight + '</span>';
    root.appendChild(head);

    // карточка человека
    var person = el('div', 'neg-c-person');
    person.innerHTML =
      '<div class="neg-c-setting">' + esc(enc.setting) + '</div>' +
      '<div class="neg-c-line">' + esc(enc.personLine) + '</div>';
    root.appendChild(person);

    var stage = el('div', 'neg-c-stage');
    root.appendChild(stage);
    renderTypeStep(stage, enc, root);
  }

  // — шаг 1: определи тип —
  function renderTypeStep(stage, enc, root) {
    stage.appendChild(el('div', 'neg-c-ask', 'Кто перед тобой?'));
    var opts = el('div', 'neg-c-typeopts');
    TYPES.forEach(function (t) {
      var b = el('button', 'neg-c-typebtn');
      b.type = 'button';
      b.innerHTML = '<span class="neg-c-typebtn-glyph">' + t.glyph + '</span>' +
                    '<span class="neg-c-typebtn-id">' + esc(t.id) + '</span>' +
                    '<span class="neg-c-typebtn-name">' + esc(t.name) + '</span>';
      b.addEventListener('click', function () { pickType(t.id, enc, opts, stage, root); });
      opts.appendChild(b);
    });
    stage.appendChild(opts);
  }

  function pickType(picked, enc, opts, stage, root) {
    if (S.locked) return;
    S.locked = true;
    var ok = picked === enc.correctType;
    if (ok) S.typeRight += 1; else S.missType[enc.correctType] = true;

    [].forEach.call(opts.querySelectorAll('.neg-c-typebtn'), function (b) {
      var id = b.querySelector('.neg-c-typebtn-id').textContent;
      b.disabled = true;
      if (id === enc.correctType) b.classList.add('is-correct');
      else if (id === picked) b.classList.add('is-wrong');
    });

    var t = TYPE_BY_ID[enc.correctType];
    var fb = el('div', 'neg-c-fb ' + (ok ? 'is-ok' : 'is-no'));
    fb.innerHTML =
      '<div class="neg-c-fb-verdict">' + (ok ? '✓ Верно — это ' : '✗ Это ') + t.glyph + ' ' + esc(t.id) + ' · ' + esc(t.name) + '</div>' +
      '<div class="neg-c-fb-why">' + esc(enc.typeWhy) + '</div>';
    stage.appendChild(fb);

    // переход к шагу 2
    S.locked = false;
    renderOpenStep(stage, enc, root);
  }

  // — шаг 2: выбери заход —
  function renderOpenStep(stage, enc, root) {
    stage.appendChild(el('div', 'neg-c-ask neg-c-ask--2', 'Твой заход — вход в контакт:'));
    var opts = el('div', 'neg-c-openopts');
    var order = shuffle(enc.openings.length, S.deck[S.pos] * 17 + 5);
    order.forEach(function (idx) {
      var o = enc.openings[idx];
      var b = el('button', 'neg-c-openbtn');
      b.type = 'button';
      b.textContent = o.text;
      b.addEventListener('click', function () { pickOpen(o, enc, opts, stage, root); });
      opts.appendChild(b);
    });
    stage.appendChild(opts);
    opts.scrollIntoView ? opts.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) : 0;
  }

  function pickOpen(chosen, enc, opts, stage, root) {
    if (S.locked) return;
    S.locked = true;
    if (chosen.verdict === 'resonate') S.contacts += 1;
    else S.missOpen[enc.correctType] = true;

    [].forEach.call(opts.querySelectorAll('.neg-c-openbtn'), function (b) {
      b.disabled = true;
      if (b.textContent === chosen.text) b.classList.add('is-' + chosen.verdict);
    });

    var V = { resonate: { cls: 'is-ok', t: '✓ Контакт установлен' },
              neutral:  { cls: 'is-mid', t: '~ Вяло: контакт не сорван, но и не построен' },
              repel:    { cls: 'is-no', t: '✗ Контакт потерян' } }[chosen.verdict];
    var fb = el('div', 'neg-c-fb neg-c-openfb ' + V.cls);
    fb.innerHTML =
      '<div class="neg-c-fb-verdict">' + V.t + '</div>' +
      '<div class="neg-c-fb-why">' + esc(chosen.feedback) + '</div>' +
      '<button type="button" class="neg-btn neg-btn--primary neg-c-next">' +
        (S.pos + 1 >= S.deck.length ? 'К разбору →' : 'Следующая встреча →') + '</button>';
    stage.appendChild(fb);
    var next = fb.querySelector('.neg-c-next');
    next.addEventListener('click', function () { S.pos += 1; S.locked = false; render(root); });
    next.focus();
  }

  // ═══ Финальный дебриф ═════════════════════════════════════════════
  function renderSummary(root) {
    prog.sessions += 1;
    if (S.contacts > prog.bestContacts) prog.bestContacts = S.contacts;
    save(prog);

    var n = S.deck.length;
    var wrap = el('div', 'neg-c-summary');
    var verdict = S.contacts >= 6 ? 'Мастер контакта' : S.contacts >= 4 ? 'Хорошо читаешь людей' : 'Есть куда расти';
    wrap.appendChild(el('div', 'neg-c-sum-title', verdict));
    wrap.appendChild(el('div', 'neg-c-sum-stats',
      '<span><b>' + S.contacts + '</b> / ' + n + ' контактов установлено</span>' +
      '<span><b>' + S.typeRight + '</b> / ' + n + ' типов угадано</span>'));

    // адресные советы по типам, где были промахи
    var weak = {};
    Object.keys(S.missType).forEach(function (k) { weak[k] = true; });
    Object.keys(S.missOpen).forEach(function (k) { weak[k] = true; });
    var ids = Object.keys(weak);
    if (ids.length) {
      var tips = el('div', 'neg-c-tips');
      tips.appendChild(el('div', 'neg-c-tips-h', 'Над чем поработать'));
      ids.forEach(function (id) {
        var t = TYPE_BY_ID[id];
        tips.appendChild(el('div', 'neg-c-tip',
          '<span class="neg-c-tip-id">' + t.glyph + ' ' + esc(id) + '</span>' + esc(C.debrief[id])));
      });
      wrap.appendChild(tips);
    } else {
      wrap.appendChild(el('div', 'neg-c-tips',
        '<div class="neg-c-tip">Чисто: ты верно прочитал каждый тип и зашёл в резонанс. ✦</div>'));
    }

    var again = el('button', 'neg-btn neg-btn--primary', 'Пройти ещё раз →');
    again.type = 'button';
    again.addEventListener('click', function () { startSession(); render(root); });
    wrap.appendChild(again);
    root.appendChild(wrap);

    if (S.onDone) { try { S.onDone(S.contacts, n); } catch (_) {} }
  }

  // ── публичный мост для движка уроков (lessons-neg.js) ────────────
  function mountPractice(root, onDone) {
    startSession();
    S.onDone = onDone || null;
    render(root);
  }
  window.NegContactUI = { renderTypes: renderTypes, mountPractice: mountPractice };

  // ═══ Табы: сначала Теория, потом Практика ════════════════════════
  function setupTabs() {
    var tabs = document.getElementById('neg-c-tabs');
    if (!tabs) return;
    var paneT = document.getElementById('neg-c-pane-theory');
    var paneP = document.getElementById('neg-c-pane-practice');
    function show(name) {
      [].forEach.call(tabs.querySelectorAll('.neg-c-tab'), function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-tab') === name);
      });
      if (paneT) paneT.hidden = name !== 'theory';
      if (paneP) paneP.hidden = name !== 'practice';
      try { localStorage.setItem('yasna_negc_tab', name); } catch (_) {}
    }
    [].forEach.call(tabs.querySelectorAll('.neg-c-tab'), function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-tab')); });
    });
    var toP = document.getElementById('neg-c-to-practice');
    if (toP) toP.addEventListener('click', function () {
      show('practice');
      if (tabs.scrollIntoView) tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // Новичок (не играл и не выбирал вкладку) → Теория; иначе последняя выбранная / Практика.
    var saved = null; try { saved = localStorage.getItem('yasna_negc_tab'); } catch (_) {}
    show(saved || (prog.sessions > 0 ? 'practice' : 'theory'));
  }

  // ═══ bootstrap ════════════════════════════════════════════════════
  function init() {
    var typesRoot = document.getElementById('neg-types-root');
    var contactRoot = document.getElementById('neg-contact-root');
    if (typesRoot) renderTypes(typesRoot);
    if (contactRoot) { startSession(); render(contactRoot); }
    setupTabs();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
