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
  var SKILL_BY_STAGE = {};
  (C.STAGE_SKILLS || []).forEach(function (x) { SKILL_BY_STAGE[x.stage] = x; });

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
  // Плавный скролл к только что добавленной карточке (длинный скролл практики).
  function scrollToCard(card) {
    if (!card || !card.getBoundingClientRect || !window.scrollTo) return;
    var y = card.getBoundingClientRect().top + window.pageYOffset - 80;
    try { window.scrollTo({ top: y, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, y); }
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

    if (guidePos < GUIDE.length - 1) {
      var fwd = el('button', 'neg-guide-btn neg-guide-btn--primary', 'Дальше →');
      fwd.setAttribute('type', 'button');
      fwd.addEventListener('click', function () { guidePos += 1; renderGuide(root); });
      nav.appendChild(fwd);
    } else {
      var end = el('span', 'neg-guide-end', 'Это вся дуга. Прокрути ниже.');
      nav.appendChild(end);
    }
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
      var sk = SKILL_BY_STAGE[s.id];
      var card = el('button', 'neg-stage neg-stage--' + s.group);
      card.setAttribute('type', 'button');
      card.setAttribute('aria-expanded', 'false');
      card.innerHTML =
        '<span class="neg-stage-num">' + s.id + '</span>' +
        '<span class="neg-stage-body">' +
          '<span class="neg-stage-name">' + s.name + '</span>' +
          '<span class="neg-stage-role">' + s.role + '</span>' +
          (sk ? '<span class="neg-stage-skill">🎯 ' + sk.skill + '</span>' +
                '<span class="neg-stage-where">↳ ' + sk.where + '</span>' : '') +
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
  var drillState = { deck: [], pos: 0, streak: 0, right: 0, locked: false, limit: 0, onDone: null, root: null };

  function startDrill(limit) {
    // seed по числу уже отвеченных, чтобы при возврате порядок менялся
    var deck = shuffleDeck(DRILL.length, 7 + progress.answered);
    drillState.limit = limit || 0;
    drillState.deck = (limit && limit < deck.length) ? deck.slice(0, limit) : deck;
    drillState.pos = 0;
    drillState.streak = 0;
    drillState.right = 0;
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

  // Длинный скролл: каждая реплика — отдельная карточка, добавляется вниз,
  // отвеченные остаются (можно прокрутить вверх и увидеть свои ответы).
  function renderDrill(panel) {
    if (panel) drillState.root = panel;
    var root = drillState.root; if (!root) return;
    if (drillState.pos >= drillState.deck.length) { renderDrillSummary(); return; }

    var item = DRILL[drillState.deck[drillState.pos]];
    var correct = item.stage;
    var idx = drillState.pos;

    var card = el('div', 'neg-drill-card neg-ex-card neg-l-appear');
    var head = el('div', 'neg-drill-head');
    head.innerHTML =
      '<span class="neg-drill-count">Реплика ' + (idx + 1) + ' / ' + drillState.deck.length + '</span>' +
      '<span class="neg-drill-streak">серия: ' + drillState.streak + '</span>';
    card.appendChild(head);
    card.appendChild(el('div', 'neg-drill-line', item.line));
    card.appendChild(el('div', 'neg-drill-ask', 'Какая это стадия переговоров?'));

    var opts = el('div', 'neg-drill-opts');
    var fb = el('div', 'neg-drill-fb');
    var optionIds = optionsFor(correct, drillState.deck[idx] + 1);
    optionIds.forEach(function (sid) {
      var s = STAGE_BY_ID[sid];
      var b = el('button', 'neg-opt');
      b.setAttribute('type', 'button');
      b.innerHTML = '<span class="neg-opt-num">' + s.id + '</span>' + s.name;
      b.addEventListener('click', function () { answer(sid, correct, item, opts, fb); });
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(fb);
    root.appendChild(card);
    drillState.locked = false;
    if (idx > 0) scrollToCard(card);
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
      drillState.right += 1;
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
    var nx = fb.querySelector('.neg-next');
    nx.addEventListener('click', function () {
      if (nx.disabled) return;
      nx.disabled = true; nx.style.display = 'none';   // отвеченная карточка остаётся, кнопка прячется
      drillState.pos += 1;
      renderDrill();
    });
    nx.focus();
  }

  function renderDrillSummary() {
    var root = drillState.root; if (!root) return;
    var total = drillState.deck.length;
    var done = el('div', 'neg-drill-done neg-ex-card',
      '<div class="neg-done-title">Круг пройден · ' + drillState.right + '/' + total + '</div>' +
      '<div class="neg-done-sub">Лучшая серия за всё время: ' + progress.bestStreak + '</div>');
    root.appendChild(done);
    var again = el('button', 'neg-btn neg-btn--primary', 'Пройти ещё раз →');
    again.setAttribute('type', 'button');
    again.addEventListener('click', function () { root.innerHTML = ''; startDrill(drillState.limit); renderDrill(); });
    root.appendChild(again);
    if (drillState.onDone) { try { drillState.onDone(drillState.right, total); } catch (_) {} }
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
  // Универсальный движок на все ситуационные дриллы. Монтируется движком
  // уроков (lessons-neg.js) в произвольный контейнер; по завершении круга
  // зовёт onDone(right,total). Контент — window.NegContent.PRACTICE.
  var PRACTICE = C.PRACTICE || [];

  var PKEY = 'yasna_neg_practice_v1';
  function loadPractice() { try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (_) { return {}; } }
  function savePractice(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (_) {} }
  var practice = loadPractice();

  var TAG_VERDICT = { good: '✓ В точку', mid: '~ Полумера', bad: '✗ Мимо' };

  function newEx() { return { bank: null, deck: [], pos: 0, correct: 0, locked: false, root: null, onDone: null }; }
  var ex = newEx();

  function pctVerdict(p) {
    if (p >= 90) return 'Мастерски';
    if (p >= 70) return 'Хорошо';
    if (p >= 50) return 'Неплохо, есть куда расти';
    return 'Стоит пройти ещё раз';
  }

  // Смонтировать дрилл по id банка в контейнер; count — ограничение длины.
  function mountDrill(root, bankId, onDone, count) {
    var bank = null;
    PRACTICE.forEach(function (b) { if (b.id === bankId) bank = b; });
    if (!bank) { root.innerHTML = '<div class="neg-ex-empty">Практика недоступна.</div>'; if (onDone) onDone(0, 0); return; }
    ex = newEx();
    ex.bank = bank;
    ex.root = root;
    ex.onDone = onDone || null;
    var plays = (practice[bank.id] && practice[bank.id].plays) || 0;
    var full = shuffleDeck(bank.items.length, 13 + plays * 7);
    ex.deck = (count && count < full.length) ? full.slice(0, count) : full;
    root.innerHTML = '';
    renderEx();
  }

  // Длинный скролл: карточка реплики добавляется вниз; отвеченные остаются.
  function renderEx() {
    var root = ex.root; if (!root) return;
    var bank = ex.bank;
    if (ex.pos >= ex.deck.length) { renderExSummary(); return; }

    var item = bank.items[ex.deck[ex.pos]];
    var idx = ex.pos;

    var card = el('div', 'neg-drill-card neg-ex-card neg-l-appear');
    card.appendChild(el('div', 'neg-ex-prog', '<span>Реплика ' + (idx + 1) + ' / ' + ex.deck.length + '</span>'));
    if (item.scene) card.appendChild(el('div', 'neg-ex-scene', item.scene));
    card.appendChild(el('div', 'neg-ex-line', item.line));
    card.appendChild(el('div', 'neg-ex-ask', item.ask));

    var opts = el('div', 'neg-ex-opts');
    var order = shuffleDeck(item.options.length, ex.deck[idx] + 17 + idx);
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
    root.appendChild(card);
    ex.locked = false;
    if (idx > 0) scrollToCard(card);
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
    nx.addEventListener('click', function () {
      if (nx.disabled) return;
      nx.disabled = true; nx.style.display = 'none';   // карточка остаётся, кнопка прячется
      ex.pos += 1;
      renderEx();
    });
    nx.focus();
  }

  function renderExSummary() {
    var root = ex.root, bank = ex.bank;
    var total = ex.deck.length;
    var pct = total ? Math.round(ex.correct / total * 100) : 0;

    var st = practice[bank.id] || { best: 0, plays: 0 };
    st.plays = (st.plays || 0) + 1;
    if (ex.correct > (st.best || 0)) st.best = ex.correct;
    practice[bank.id] = st;
    savePractice(practice);

    var done = el('div', 'neg-ex-done neg-ex-card');
    done.innerHTML =
      '<div class="neg-done-title">' + ex.correct + ' / ' + total + ' · ' + pctVerdict(pct) + '</div>' +
      '<div class="neg-done-sub">Лучший результат: ' + st.best + '/' + total + '</div>';
    root.appendChild(done);

    var again = el('button', 'neg-btn neg-btn--primary neg-ex-again', 'Пройти ещё раз →');
    again.setAttribute('type', 'button');
    again.addEventListener('click', function () {
      var full = shuffleDeck(bank.items.length, 13 + st.plays * 7);
      ex.deck = (ex.deck.length < full.length) ? full.slice(0, ex.deck.length) : full;
      ex.pos = 0; ex.correct = 0; root.innerHTML = ''; renderEx();
    });
    root.appendChild(again);

    if (ex.onDone) { try { ex.onDone(ex.correct, total); } catch (_) {} }
  }

  // ═══ 4. Памятка «три режима контакта» (теория-виджет) ═════════════
  function renderModes(root) {
    var memo = el('div', 'neg-memo');
    memo.innerHTML =
      '<div class="neg-memo-h">Три режима контакта</div>' +
      '<p class="neg-memo-p">Любой разговор идёт в одном из трёх режимов. Лови режим — и веди себя по нему, а не по своему плану.</p>' +
      '<div class="neg-memo-modes">' +
        '<span class="neg-memo-mode neg-memo-mode--ok"><b>Резонанс</b> — слышите друг друга, тон теплеет, он повторяет твои слова своими. Веди дальше.</span>' +
        '<span class="neg-memo-mode neg-memo-mode--mid"><b>Монолог</b> — говоришь только ты, второй закрылся. Остановись и проверь интерес.</span>' +
        '<span class="neg-memo-mode neg-memo-mode--no"><b>Срыв</b> — контакт оборвался. Оставь мост, не дави.</span>' +
      '</div>';
    root.appendChild(memo);
  }

  // ═══ публичный мост для движка уроков (lessons-neg.js) ════════════
  window.NegTrainerUI = {
    renderArc:  function (root) { guidePos = 0; renderGuide(root); },
    renderMap:  function (root) { renderMap(root); },
    renderModes: renderModes,
    mountDrill: mountDrill,
    mountStageDrill: function (root, onDone, count) {
      drillState.onDone = onDone || null;
      startDrill(count);
      drillState.root = root;
      root.innerHTML = '';
      renderDrill();
    }
  };

  // ═══ bootstrap (обратная совместимость со старой разметкой) ═══════
  function init() {
    var guideRoot = document.getElementById('neg-guide-root');
    var mapRoot = document.getElementById('neg-map-root');
    var drillRoot = document.getElementById('neg-drill-root');
    if (guideRoot) renderGuide(guideRoot);
    if (mapRoot) renderMap(mapRoot);
    if (drillRoot) { startDrill(); drillState.root = drillRoot; drillRoot.innerHTML = ''; renderDrill(); }
    refreshStats();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
