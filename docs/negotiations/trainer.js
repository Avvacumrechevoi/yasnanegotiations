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

  // ═══ bootstrap ════════════════════════════════════════════════════
  function init() {
    var mapRoot = document.getElementById('neg-map-root');
    var drillRoot = document.getElementById('neg-drill-root');
    if (mapRoot) renderMap(mapRoot);
    if (drillRoot) { startDrill(); renderDrill(drillRoot); }
    refreshStats();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
