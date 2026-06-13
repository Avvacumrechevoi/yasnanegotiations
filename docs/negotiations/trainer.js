/* ═══════════════════════════════════════════════════════════════════
   negotiations/trainer.js — логика тренажёра переговоров (vanilla JS).
   Контент берётся из window.NegContent (scenarios.js).
   Прогресс изолирован в namespace localStorage 'yasna_neg_*'.
   Никаких зависимостей от бандла конструктора — раздел автономен.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var C = window.NegContent;
  if (!C) { console.error('[neg] scenarios.js не загружен'); return; }

  var STAGES = C.STAGES;
  var DRILL = C.DRILL;
  var GUIDE = C.GUIDE || [];
  var STAGE_BY_ID = {};
  STAGES.forEach(function (s) { STAGE_BY_ID[s.id] = s; });

  var GROUP_LABEL = {
    'вход':       'Вход',
    'нарастание': 'Нарастание контакта',
    'вершина':    'Вершина',
    'спад':       'Спад: понимание или срыв',
    'итог':       'Итог'
  };

  // ── persistence (изолированный namespace) ───────────────────────
  var KEY = 'yasna_neg_progress_v1';
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (_) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (_) {}
  }
  var progress = loadProgress();
  if (typeof progress.answered !== 'number') progress.answered = 0;
  if (typeof progress.correct !== 'number') progress.correct = 0;
  if (typeof progress.bestStreak !== 'number') progress.bestStreak = 0;

  // ── helpers ──────────────────────────────────────────────────────
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  // Детерминированная «случайность» без Math.random в чистом виде —
  // используем seed по индексу, чтобы порядок был стабилен в рамках сессии.
  function shuffleDeck(n, seed) {
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(i);
    // Fisher–Yates с линейным конгруэнтным генератором от seed
    var s = (seed || 1) >>> 0;
    for (var k = arr.length - 1; k > 0; k--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      var j = s % (k + 1);
      var t = arr[k]; arr[k] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ═══ 0. Гид по дуге переговоров (5 фаз, шаг за шагом) ══════════════
  var guidePos = 0;

  function renderGuide(root) {
    if (!GUIDE.length) return;
    root.innerHTML = '';
    var p = GUIDE[guidePos];

    // рейка-дуга: 5 фаз, текущая подсвечена, пройденные залиты
    var rail = el('div', 'neg-guide-rail');
    GUIDE.forEach(function (g, i) {
      var cls = 'neg-guide-seg neg-guide-seg--' + g.key;
      if (i === guidePos) cls += ' is-active';
      else if (i < guidePos) cls += ' is-done';
      var seg = el('button', cls);
      seg.setAttribute('type', 'button');
      seg.setAttribute('aria-label', 'Фаза ' + (i + 1) + ': ' + g.title);
      seg.innerHTML =
        '<span class="neg-guide-seg-dot"></span>' +
        '<span class="neg-guide-seg-lbl">' + g.arc + '</span>';
      seg.addEventListener('click', function () { guidePos = i; renderGuide(root); });
      rail.appendChild(seg);
    });
    root.appendChild(rail);

    // карточка фазы
    var card = el('div', 'neg-guide-card neg-guide-card--' + p.key);
    card.innerHTML =
      '<div class="neg-guide-top">' +
        '<span class="neg-guide-badge">' + p.stages + '</span>' +
        '<span class="neg-guide-step">Фаза ' + (guidePos + 1) + ' / ' + GUIDE.length + '</span>' +
      '</div>' +
      '<h3 class="neg-guide-title">' + p.title + '</h3>' +
      '<div class="neg-guide-block"><span class="neg-guide-lbl">Что происходит</span><p>' + p.what + '</p></div>' +
      '<div class="neg-guide-block"><span class="neg-guide-lbl neg-guide-lbl--you">Твой ход</span><p>' + p.you + '</p></div>';
    root.appendChild(card);

    // навигация
    var nav = el('div', 'neg-guide-nav');
    var back = el('button', 'neg-guide-btn neg-guide-btn--ghost', '← Назад');
    back.setAttribute('type', 'button');
    back.disabled = guidePos === 0;
    back.addEventListener('click', function () {
      if (guidePos > 0) { guidePos -= 1; renderGuide(root); }
    });
    nav.appendChild(back);

    var fwd;
    if (guidePos < GUIDE.length - 1) {
      fwd = el('button', 'neg-guide-btn neg-guide-btn--primary', 'Дальше →');
      fwd.addEventListener('click', function () { guidePos += 1; renderGuide(root); });
    } else {
      fwd = el('button', 'neg-guide-btn neg-guide-btn--primary', 'Все 12 стадий ↓');
      fwd.addEventListener('click', function () {
        var m = document.getElementById('neg-map-root');
        if (m && m.scrollIntoView) m.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    fwd.setAttribute('type', 'button');
    nav.appendChild(fwd);
    root.appendChild(nav);
  }

  // ═══ 1. Карта 12 стадий ═══════════════════════════════════════════
  function renderMap(root) {
    var wrap = el('div', 'neg-map');
    var lastGroup = null;
    STAGES.forEach(function (s) {
      if (s.group !== lastGroup) {
        lastGroup = s.group;
        wrap.appendChild(el('div', 'neg-map-group', GROUP_LABEL[s.group] || s.group));
      }
      var card = el('button', 'neg-stage neg-stage--' + s.group);
      card.setAttribute('type', 'button');
      card.setAttribute('aria-expanded', 'false');
      card.innerHTML =
        '<span class="neg-stage-num">' + s.id + '</span>' +
        '<span class="neg-stage-body">' +
          '<span class="neg-stage-name">' + s.name + '</span>' +
          '<span class="neg-stage-role">' + s.role + '</span>' +
          '<span class="neg-stage-desc">' + s.desc + '</span>' +
        '</span>';
      card.addEventListener('click', function () {
        var open = card.classList.toggle('is-open');
        card.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      wrap.appendChild(card);
    });
    root.appendChild(wrap);
  }

  // ═══ 2. Дрилл «Определи стадию» ═══════════════════════════════════
  var drillState = { deck: [], pos: 0, streak: 0, locked: false };

  function startDrill() {
    // seed по числу уже отвеченных, чтобы при возврате порядок менялся
    drillState.deck = shuffleDeck(DRILL.length, 7 + progress.answered);
    drillState.pos = 0;
    drillState.streak = 0;
    drillState.locked = false;
  }

  function optionsFor(correctStageId, seed) {
    // 4 варианта: верный + 3 соседних/случайных стадии
    var ids = STAGES.map(function (s) { return s.id; }).filter(function (id) { return id !== correctStageId; });
    var order = shuffleDeck(ids.length, seed + 31);
    var picks = [correctStageId, STAGE_BY_ID[ids[order[0]]].id, STAGE_BY_ID[ids[order[1]]].id, STAGE_BY_ID[ids[order[2]]].id];
    var posOrder = shuffleDeck(4, seed + 91);
    var out = [];
    posOrder.forEach(function (i) { out.push(picks[i]); });
    return out;
  }

  function renderDrill(panel) {
    panel.innerHTML = '';
    if (drillState.pos >= drillState.deck.length) { renderDrillSummary(panel); return; }

    var item = DRILL[drillState.deck[drillState.pos]];
    var correct = item.stage;

    // прогресс-строка
    var head = el('div', 'neg-drill-head');
    head.innerHTML =
      '<span class="neg-drill-count">Реплика ' + (drillState.pos + 1) + ' / ' + drillState.deck.length + '</span>' +
      '<span class="neg-drill-streak">серия: ' + drillState.streak + '</span>';
    panel.appendChild(head);

    panel.appendChild(el('div', 'neg-drill-line', item.line));
    panel.appendChild(el('div', 'neg-drill-ask', 'Какая это стадия переговоров?'));

    var opts = el('div', 'neg-drill-opts');
    var optionIds = optionsFor(correct, drillState.deck[drillState.pos] + 1);
    optionIds.forEach(function (sid) {
      var s = STAGE_BY_ID[sid];
      var b = el('button', 'neg-opt');
      b.setAttribute('type', 'button');
      b.innerHTML = '<span class="neg-opt-num">' + s.id + '</span>' + s.name;
      b.addEventListener('click', function () { answer(sid, correct, item, opts, fb); });
      opts.appendChild(b);
    });
    panel.appendChild(opts);

    var fb = el('div', 'neg-drill-fb');
    panel.appendChild(fb);
    drillState.locked = false;
  }

  function answer(picked, correct, item, opts, fb) {
    if (drillState.locked) return;
    drillState.locked = true;
    var ok = picked === correct;

    // визуальная подсветка
    [].forEach.call(opts.querySelectorAll('.neg-opt'), function (b) {
      var num = parseInt(b.querySelector('.neg-opt-num').textContent, 10);
      b.disabled = true;
      if (num === correct) b.classList.add('is-correct');
      else if (num === picked) b.classList.add('is-wrong');
    });

    // счёт
    progress.answered += 1;
    if (ok) {
      progress.correct += 1;
      drillState.streak += 1;
      if (drillState.streak > progress.bestStreak) progress.bestStreak = drillState.streak;
    } else {
      drillState.streak = 0;
    }
    saveProgress(progress);
    refreshStats();

    var s = STAGE_BY_ID[correct];
    fb.className = 'neg-drill-fb is-show ' + (ok ? 'is-ok' : 'is-no');
    fb.innerHTML =
      '<div class="neg-fb-verdict">' + (ok ? '✓ Верно' : '✗ Это стадия «' + s.name + '»') + '</div>' +
      '<div class="neg-fb-why">' + item.why + '</div>' +
      '<button type="button" class="neg-next">Дальше →</button>';
    fb.querySelector('.neg-next').addEventListener('click', function () {
      drillState.pos += 1;
      renderDrill(fb.parentNode);
    });
    fb.querySelector('.neg-next').focus();
  }

  function renderDrillSummary(panel) {
    var pct = progress.answered ? Math.round(progress.correct / progress.answered * 100) : 0;
    panel.appendChild(el('div', 'neg-drill-done',
      '<div class="neg-done-title">Круг пройден</div>' +
      '<div class="neg-done-sub">Всего ответов: ' + progress.answered +
      ' · точность ' + pct + '% · лучшая серия ' + progress.bestStreak + '</div>'));
    var again = el('button', 'neg-btn neg-btn--primary', 'Ещё круг →');
    again.setAttribute('type', 'button');
    again.addEventListener('click', function () { startDrill(); renderDrill(panel); });
    panel.appendChild(again);
  }

  // ═══ статистика в шапке дрилла ════════════════════════════════════
  function refreshStats() {
    var a = document.getElementById('neg-stat-answered');
    var c = document.getElementById('neg-stat-acc');
    var b = document.getElementById('neg-stat-streak');
    if (a) a.textContent = progress.answered;
    if (c) c.textContent = (progress.answered ? Math.round(progress.correct / progress.answered * 100) : 0) + '%';
    if (b) b.textContent = progress.bestStreak;
  }

  // ═══ 3. Практикумы: «ситуация → выбор хода → разбор» ══════════════
  // Один универсальный движок на все ситуационные дриллы.
  // Контент — window.NegContent.PRACTICE (массив банков из scenarios.js).
  var PRACTICE = C.PRACTICE || [];

  // прогресс практикумов — отдельный namespace, чтобы не мешать дриллу стадий
  var PKEY = 'yasna_neg_practice_v1';
  function loadPractice() { try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (_) { return {}; } }
  function savePractice(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (_) {} }
  var practice = loadPractice();

  var TAG_VERDICT = { good: '✓ В точку', mid: '~ Полумера', bad: '✗ Мимо' };

  var elHub = null, elEx = null;
  function showHub() { if (elHub) elHub.hidden = false; if (elEx) elEx.hidden = true; }
  function showEx()  { if (elHub) elHub.hidden = true;  if (elEx) elEx.hidden = false; }

  function newEx() { return { bank: null, deck: [], pos: 0, correct: 0, locked: false }; }
  var ex = newEx();

  function startEx(bank) {
    ex = newEx();
    ex.bank = bank;
    var prev = (practice[bank.id] && practice[bank.id].plays) || 0;
    ex.deck = shuffleDeck(bank.items.length, 13 + prev * 7);
  }

  function pctVerdict(p) {
    if (p >= 90) return 'Мастерски';
    if (p >= 70) return 'Хорошо';
    if (p >= 50) return 'Неплохо, но есть куда расти';
    return 'Стоит пройти ещё круг';
  }

  // ── список упражнений (хаб) ──────────────────────────────────────
  function renderHub() {
    if (!elHub) return;
    elHub.innerHTML = '';

    // несущая мысль (P0-теория): три режима контакта
    var memo = el('div', 'neg-memo');
    memo.innerHTML =
      '<div class="neg-memo-h">Главное: держи резонанс</div>' +
      '<p class="neg-memo-p">Любые переговоры идут в одном из трёх режимов. Лови режим — и не дожимай там, где контакт рвётся.</p>' +
      '<div class="neg-memo-modes">' +
        '<span class="neg-memo-mode neg-memo-mode--ok"><b>Резонанс</b> — слышите друг друга, тон теплеет, он повторяет твои слова своими.</span>' +
        '<span class="neg-memo-mode neg-memo-mode--mid"><b>Монолог</b> — говоришь только ты, второй закрылся. Остановись и проверь интерес.</span>' +
        '<span class="neg-memo-mode neg-memo-mode--no"><b>Срыв</b> — контакт оборвался. Оставь мост, не дави.</span>' +
      '</div>';
    elHub.appendChild(memo);

    if (!PRACTICE.length) return;

    var grid = el('div', 'neg-hub');
    PRACTICE.forEach(function (bank) {
      var st = practice[bank.id] || {};
      var badge = st.plays
        ? '<span class="neg-hub-badge">лучшее ' + (st.best || 0) + '/' + bank.items.length + '</span>'
        : '<span class="neg-hub-badge neg-hub-badge--new">новое</span>';
      var card = el('button', 'neg-hub-card');
      card.setAttribute('type', 'button');
      card.innerHTML =
        '<span class="neg-hub-card-h">' + bank.title + '</span>' +
        '<span class="neg-hub-card-sub">' + bank.intro + '</span>' +
        '<span class="neg-hub-card-foot">' + badge + '<span class="neg-hub-go">Начать →</span></span>';
      card.addEventListener('click', function () {
        startEx(bank); renderEx(); showEx();
        if (elEx && elEx.scrollIntoView) elEx.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      grid.appendChild(card);
    });
    elHub.appendChild(grid);
  }

  // ── активное упражнение ──────────────────────────────────────────
  function renderEx() {
    if (!elEx) return;
    elEx.innerHTML = '';
    var bank = ex.bank;
    if (!bank) { showHub(); return; }

    var head = el('div', 'neg-ex-head');
    var back = el('button', 'neg-ex-back', '← к списку');
    back.setAttribute('type', 'button');
    back.addEventListener('click', function () { ex = newEx(); showHub(); renderHub(); });
    head.appendChild(back);
    head.appendChild(el('span', 'neg-ex-name', bank.title));
    elEx.appendChild(head);

    if (ex.pos >= ex.deck.length) { renderExSummary(); return; }

    var item = bank.items[ex.deck[ex.pos]];

    var prog = el('div', 'neg-ex-prog');
    prog.innerHTML =
      '<span>' + (ex.pos + 1) + ' / ' + ex.deck.length + '</span>' +
      '<span class="neg-ex-score">верно: ' + ex.correct + '</span>';
    elEx.appendChild(prog);

    var card = el('div', 'neg-drill-card');
    if (item.scene) card.appendChild(el('div', 'neg-ex-scene', item.scene));
    card.appendChild(el('div', 'neg-ex-line', item.line));
    card.appendChild(el('div', 'neg-ex-ask', item.ask));

    var opts = el('div', 'neg-ex-opts');
    var order = shuffleDeck(item.options.length, ex.deck[ex.pos] + 17 + ex.pos);
    var fb = el('div', 'neg-ex-fb');
    order.forEach(function (oi) {
      var o = item.options[oi];
      var b = el('button', 'neg-ex-opt');
      b.setAttribute('type', 'button');
      b.setAttribute('data-tag', o.tag);
      b.textContent = o.text;
      b._opt = o;
      b.addEventListener('click', function () { answerEx(o, item, opts, fb); });
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(fb);
    elEx.appendChild(card);
    ex.locked = false;
  }

  function answerEx(picked, item, opts, fb) {
    if (ex.locked) return;
    ex.locked = true;
    var goodOpt = null;
    item.options.forEach(function (o) { if (o.tag === 'good') goodOpt = o; });
    var isGood = picked.tag === 'good';
    if (isGood) ex.correct += 1;

    [].forEach.call(opts.querySelectorAll('.neg-ex-opt'), function (b) {
      b.disabled = true;
      if (b._opt && b._opt.tag === 'good') b.classList.add('is-good');
      else if (b._opt === picked) b.classList.add(picked.tag === 'bad' ? 'is-bad' : 'is-mid');
    });

    fb.className = 'neg-ex-fb is-show is-' + picked.tag;
    var html =
      '<div class="neg-ex-fb-v">' + (TAG_VERDICT[picked.tag] || '') + '</div>' +
      '<div class="neg-ex-fb-why">' + picked.why + '</div>';
    if (!isGood && goodOpt) {
      html += '<div class="neg-ex-fb-good"><b>В точку:</b> ' + goodOpt.text + ' — ' + goodOpt.why + '</div>';
    }
    html += '<button type="button" class="neg-next neg-ex-next">Дальше →</button>';
    fb.innerHTML = html;
    var nx = fb.querySelector('.neg-ex-next');
    nx.addEventListener('click', function () { ex.pos += 1; renderEx(); });
    nx.focus();
  }

  function renderExSummary() {
    var bank = ex.bank;
    var total = ex.deck.length;
    var pct = total ? Math.round(ex.correct / total * 100) : 0;

    var st = practice[bank.id] || { best: 0, plays: 0 };
    st.plays = (st.plays || 0) + 1;
    if (ex.correct > (st.best || 0)) st.best = ex.correct;
    practice[bank.id] = st;
    savePractice(practice);

    var done = el('div', 'neg-ex-done');
    done.innerHTML =
      '<div class="neg-done-title">' + bank.title + ' · ' + ex.correct + '/' + total + '</div>' +
      '<div class="neg-done-sub">' + pctVerdict(pct) + ' · лучший результат: ' + st.best + '/' + total + '</div>';
    elEx.appendChild(done);

    var row = el('div', 'neg-ex-done-actions');
    var again = el('button', 'neg-btn neg-btn--primary', 'Ещё раз →');
    again.setAttribute('type', 'button');
    again.addEventListener('click', function () { startEx(bank); renderEx(); });
    var toList = el('button', 'neg-ex-back', '← к списку');
    toList.setAttribute('type', 'button');
    toList.addEventListener('click', function () { ex = newEx(); showHub(); renderHub(); });
    row.appendChild(again);
    row.appendChild(toList);
    elEx.appendChild(row);
  }

  // ═══ bootstrap ════════════════════════════════════════════════════
  function init() {
    var guideRoot = document.getElementById('neg-guide-root');
    var mapRoot = document.getElementById('neg-map-root');
    var drillRoot = document.getElementById('neg-drill-root');
    elHub = document.getElementById('neg-practice-hub');
    elEx = document.getElementById('neg-practice-ex');
    if (guideRoot) renderGuide(guideRoot);
    if (mapRoot) renderMap(mapRoot);
    if (drillRoot) { startDrill(); renderDrill(drillRoot); }
    if (elHub) { renderHub(); showHub(); }
    refreshStats();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
