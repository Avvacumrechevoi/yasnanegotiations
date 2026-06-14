/* ═══════════════════════════════════════════════════════════════════
   negotiations/lessons-neg.js — движок УРОКОВ переговоров (vanilla).
   Каталог сценариев → урок с вертикальным скроллом и порционной подачей
   через «гейты» (по образцу уроков основного продукта).

   Делегирует рендер интерактива готовым движкам:
     · NegContactUI  (contact-trainer.js) — 4 типа + практика «вход в контакт»
     · NegTrainerUI  (trainer.js)         — дуга, карта стадий, режимы, дриллы

   Грузится ПОСЛЕДНИМ. Прогресс — localStorage 'yasna_neg_lessons_v1'.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── helpers ──────────────────────────────────────────────────────
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function richText(s) {
    s = String(s == null ? '' : s);
    s = s.replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }
  function scrollToBlock(block) {
    if (!block) return;
    var y = block.getBoundingClientRect().top + window.pageYOffset - 80;
    if (window.scrollTo) window.scrollTo({ top: y, behavior: 'smooth' });
  }

  // ── прогресс (пройденные сценарии) ───────────────────────────────
  var LKEY = 'yasna_neg_lessons_v1';
  function loadDone() { try { return JSON.parse(localStorage.getItem(LKEY)) || []; } catch (_) { return []; } }
  function markDone(id) {
    var d = loadDone();
    if (d.indexOf(id) < 0) { d.push(id); try { localStorage.setItem(LKEY, JSON.stringify(d)); } catch (_) {} }
  }

  // ═══ КОНТЕНТ: 4 сценария ══════════════════════════════════════════
  var LESSONS = [
    {
      id: 'l1', n: 1, title: 'Кто передо мной',
      outcome: 'Читать 4 типа людей и заходить верно', duration: '~7 мин',
      when: 'Когда заходишь к новому человеку и не понимаешь, почему один и тот же довод одного зажигает, а другого отталкивает.',
      skill: 'Читать тип собеседника по первым репликам и за одну фразу выбирать заход под него — командиру суть и цифру, аналитику факты, душевному смысл, практику показать руками.',
      segments: [
        { type: 'intro', body: 'Прежде чем что-то предлагать, надо понять, **кто** перед тобой. Люди по сути делятся на четыре типа — командир, аналитик, душевный, практик — и к каждому свой заход. Здесь ты учишься читать тип по первым словам и сразу выбирать верный ход: спутал тип — даже правильный довод не сработает. Это фундамент любого контакта.' },
        { type: 'theory', title: 'Почему это первый шаг', body: 'Один и тот же аргумент одного зажигает, другого отталкивает. Сильные переговорщики не заучивают универсальные фразы — они **читают человека** и подстраивают заход. С этого начинается контакт.' },
        { type: 'widget', widget: 'types', title: 'Четыре типа', note: 'Нажми на карточку — раскроется: как распознать, как входить и что отталкивает.' },
        { type: 'practice', bank: 'RECON', count: 5, title: 'Практика · собери досье', note: 'Сильную позицию готовят ДО встречи. По обрывку информации реши, что он даёт и что выяснить.' },
        { type: 'contact', title: 'Практика · вход в контакт', note: 'Семь встреч. На каждой определи тип по реплике, затем выбери заход: один резонирует, другой рвёт контакт.' },
        { type: 'practice', bank: 'TYPESTAGE', count: 6, title: 'Практика · заход под характер', note: 'Сложнее: дан тип и момент разговора — выбери ход, верный именно для этого человека.' },
        { type: 'summary', body: 'Готово. Ты различаешь четыре типа и заходишь под каждый. Дальше — как ведётся **сам разговор**: от первого слова до результата.' }
      ]
    },
    {
      id: 'l2', n: 2, title: 'Как ведётся разговор',
      outcome: 'Видеть дугу из 12 стадий и держать резонанс', duration: '~9 мин',
      when: 'Когда разговор кажется хаосом — теряешь нить и не понимаешь, какой ход уместен сейчас: давить, слушать, фиксировать или отступить.',
      skill: 'Видеть разговор как дугу из 12 стадий, определять текущую стадию по реплике и ловить режим контакта — резонанс это или назревающий срыв.',
      segments: [
        { type: 'intro', body: 'Разговор — не хаос, а **дуга**: вход, нарастание, вершина, спад, итог. Если видишь, на какой ты стадии, понимаешь, какой ход делать. Здесь ты разбираешь все 12 стадий и учишься ловить режим контакта — когда между вами резонанс, а когда назревает срыв. Это навигатор: знаешь карту — не заблудишься в любом разговоре.' },
        { type: 'widget', widget: 'arc', title: 'Дуга разговора', note: 'Пять фаз. Пройди по ним шаг за шагом.' },
        { type: 'widget', widget: 'stages', title: 'Все 12 стадий', note: 'Полная карта: у каждой стадии — свой навык и где его тренировать. Нажми стадию для разбора. Справочник, к нему можно возвращаться.' },
        { type: 'stagedrill', count: 8, title: 'Практика · определи стадию', note: 'Реплика или ход — определи, какая это стадия переговоров. Сразу разбор.' },
        { type: 'practice', bank: 'OFFER', count: 5, title: 'Практика · заяви позицию ясно', note: 'Пора назвать предложение. Выбери формулировку: внятную, без тумана и без извинений.' },
        { type: 'widget', widget: 'modes' },
        { type: 'practice', bank: 'RESONANCE', count: 6, title: 'Практика · резонанс или срыв', note: 'Поймай режим разговора и выбери верный ход.' },
        { type: 'summary', body: 'Ты видишь дугу разговора и ловишь режим контакта. Дальше — самое острое: **как договориться по-честному**.' }
      ]
    },
    {
      id: 'l3', n: 3, title: 'Договориться честно',
      outcome: 'Строить честный обмен и не путать дело со статусом', duration: '~8 мин',
      when: 'Когда нужно договориться, но боишься либо отдать всё даром под давлением, либо лечить недовольство не тем — скидкой там, где задето самолюбие.',
      skill: 'Строить честный обмен — на каждое «беру» называть своё «даю, если» под проверяемое условие; отличать спор о деле от спора о статусе; и в концовке наносить решающий ход.',
      segments: [
        { type: 'intro', body: 'Сделка держится на **обмене**: у каждого есть что взять и что дать. Спроси себя — что я беру, что даю взамен, что нужно ему. Берёшь и ничего не даёшь — это не сделка, а продавливание. И вторая половина: часть конфликта про **дело** (цифры, сроки), а часть про **статус** (кого уважили). Не путай — скидкой не лечат задетое самолюбие. Здесь ты тренируешь и то, и другое, и решающий ход в концовке.' },
        { type: 'theory', title: 'Дать и взять', body: 'Спроси себя: что я **беру**, что **даю** взамен, что нужно **ему**, что он готов дать. Берёшь и ничего не даёшь — это не сделка, а продавливание. Обещай только то, что выдержит проверку.' },
        { type: 'practice', bank: 'DEALPLAY', count: 6, title: 'Практика · собери сделку', note: 'Посмотри на обмен и реши, что сделать, чтобы он стал честным.' },
        { type: 'theory', title: 'Дело или статус', body: 'Часть конфликта — про **дело** (условия, цифры, сроки). Часть — про **статус** (кого уважили, кто решает). Не путай: скидкой не лечат задетое самолюбие, а извинением — реальную проблему в цене.' },
        { type: 'practice', bank: 'STATUS', count: 6, title: 'Практика · дело или статус', note: 'На реплике недовольства реши, в чём корень, и выбери ход.' },
        { type: 'practice', bank: 'STRIKE', count: 5, title: 'Практика · реши исход одним ходом', note: 'Сделка почти созрела. Выбери решающий ход — не пересолить и не упустить.' },
        { type: 'summary', body: 'Ты строишь честный обмен, видишь спор о деле и об уважении и умеешь дожать. Остался последний навык — **удержать контакт и красиво выйти**.' }
      ]
    },
    {
      id: 'l4', n: 4, title: 'Удержать и выйти',
      outcome: 'Чинить недопонимание и оставлять чистый след', duration: '~7 мин',
      when: 'Когда разговор после пика покатился вниз — тон холодеет, слова поняли по-разному — и есть риск, что недопонимание превратится в разрыв, а встреча закончится осадком.',
      skill: 'Чинить недопонимание на ходу и удерживать рвущийся контакт; завершать встречу так, чтобы даже при отказе остался чистый след — благодарность и открытая дверь вместо дожима и обиды.',
      segments: [
        { type: 'intro', body: 'После вершины разговор катится вниз — но по двум склонам: к пониманию или к срыву. Недопонимание (слова поняли по-разному) — ещё не разрыв: почини сразу, уточни, назови расхождение без обвинения. И помни — переговоры не кончаются на последнем слове, остаётся **след**. Чистый шаг и благодарность оставляют имя, дожим и обида — осадок. Здесь ты учишься удерживать контакт и выходить так, чтобы дверь осталась открытой.' },
        { type: 'theory', title: 'Развилка', body: 'Недопонимание (слова поняли по-разному) — ещё не срыв. Почини сразу: уточни, переспроси смысл, назови расхождение без обвинения — и разговор свернёт к пониманию, а не к разрыву.' },
        { type: 'practice', bank: 'REPAIR', count: 6, title: 'Практика · почини недопонимание', note: 'Тон холодеет — выбери ход, который разворачивает к пониманию.' },
        { type: 'practice', bank: 'BREAK', count: 5, title: 'Практика · контакт рвётся', note: 'Собеседник встал и уходит. Выбери ход, который вернёт за стол, а не добьёт.' },
        { type: 'theory', title: 'След после встречи', body: 'Даже при отказе не расходись врагами. Финал — это **будущая история**: чистый шаг и благодарность оставляют имя, дожим и обида — осадок. Дверь оставляй открытой.' },
        { type: 'practice', bank: 'TRACE', count: 6, title: 'Практика · какой след', note: 'Встреча закончилась — выбери фразу, которая оставит чистый след.' },
        { type: 'summary', body: 'Ты прошёл весь путь: прочитать человека → провести разговор → договориться честно → удержать и выйти. Это и есть переговоры как **мышление**, а не набор трюков.' }
      ]
    }
  ];

  function nextLesson(id) {
    var i = -1;
    LESSONS.forEach(function (l, k) { if (l.id === id) i = k; });
    return (i >= 0 && i + 1 < LESSONS.length) ? LESSONS[i + 1] : null;
  }

  // ═══ DOM-узлы ═════════════════════════════════════════════════════
  var catalogSec = null, catalogList = null, lessonRoot = null;
  var state = { lesson: null, segWrap: null, bar: null };

  function showCatalog() { if (catalogSec) catalogSec.hidden = false; if (lessonRoot) lessonRoot.hidden = true; }
  function showLesson() { if (catalogSec) catalogSec.hidden = true; if (lessonRoot) lessonRoot.hidden = false; }

  // ── каталог сценариев ────────────────────────────────────────────
  function renderCatalog() {
    if (!catalogList) return;
    catalogList.innerHTML = '';
    var done = loadDone();
    var list = el('div', 'neg-cat');
    LESSONS.forEach(function (lesson) {
      var isDone = done.indexOf(lesson.id) >= 0;
      var card = el('button', 'neg-cat-card' + (isDone ? ' is-done' : ''));
      card.type = 'button';
      card.innerHTML =
        '<span class="neg-cat-num">' + lesson.n + '</span>' +
        '<span class="neg-cat-body">' +
          '<span class="neg-cat-title">' + lesson.title + '</span>' +
          (lesson.when ? '<span class="neg-cat-when">' + richText(lesson.when) + '</span>' : '') +
          '<span class="neg-cat-outcome">→ ' + lesson.outcome + '</span>' +
          '<span class="neg-cat-meta">' + lesson.duration + ' · ' + lesson.segments.length + ' шагов' + (isDone ? ' · ✓ пройдено' : '') + '</span>' +
        '</span>' +
        '<span class="neg-cat-go">' + (isDone ? 'Повторить' : 'Начать') + ' →</span>';
      card.addEventListener('click', function () { openLesson(lesson); });
      list.appendChild(card);
    });
    catalogList.appendChild(list);
  }

  // ── открыть урок ─────────────────────────────────────────────────
  function openLesson(lesson) {
    state = { lesson: lesson, segWrap: null, bar: null };
    lessonRoot.innerHTML = '';

    var head = el('div', 'neg-l-head');
    var back = el('button', 'neg-l-back', '← Сценарии');
    back.type = 'button';
    back.addEventListener('click', backToCatalog);
    head.appendChild(back);
    head.appendChild(el('div', 'neg-l-head-title', lesson.n + '. ' + lesson.title));
    var barWrap = el('div', 'neg-l-bar');
    var bar = el('div', 'neg-l-bar-fill');
    barWrap.appendChild(bar);
    head.appendChild(barWrap);
    state.bar = bar;
    lessonRoot.appendChild(head);

    state.segWrap = el('div', 'neg-l-segs');
    lessonRoot.appendChild(state.segWrap);

    showLesson();
    window.scrollTo(0, 0);
    appendSegment(0);
  }

  function backToCatalog() {
    if (lessonRoot) { lessonRoot.hidden = true; lessonRoot.innerHTML = ''; }
    showCatalog();
    renderCatalog();
    window.scrollTo(0, 0);
  }

  function updateBar(i) {
    if (state.bar) state.bar.style.width = Math.round((i + 1) / state.lesson.segments.length * 100) + '%';
  }

  // ── один сегмент урока + его гейт ────────────────────────────────
  function appendSegment(i) {
    var lesson = state.lesson;
    var seg = lesson.segments[i];
    var isLast = i === lesson.segments.length - 1;
    var block = el('div', 'neg-l-block neg-l-appear');
    state.segWrap.appendChild(block);
    updateBar(i);

    // заголовок шага (не для intro/summary)
    if (seg.title) block.appendChild(el('div', 'neg-l-seg-title', seg.title));
    if (seg.note) block.appendChild(el('div', 'neg-l-seg-note', seg.note));

    // итоговый экран
    if (seg.type === 'summary') { renderSummary(block, seg); return; }

    // проза (intro/theory)
    if (seg.type === 'intro' || seg.type === 'theory') {
      block.appendChild(el('div', 'neg-l-prose' + (seg.type === 'intro' ? ' neg-l-prose--lead' : ''), richText(seg.body)));
    }
    // на вводном шаге — явная цель урока (навык на выходе)
    if (seg.type === 'intro' && lesson.skill) {
      block.appendChild(el('div', 'neg-l-skilltag', '🎯 Навык на выходе: ' + richText(lesson.skill)));
    }

    // точка монтажа интерактива
    var mount = el('div', 'neg-l-mount');
    block.appendChild(mount);

    // гейт
    var gate = isLast ? null : el('button', 'neg-gate', 'Дальше →');
    if (gate) {
      gate.type = 'button';
      gate.addEventListener('click', function () {
        if (gate.disabled) return;
        gate.disabled = true;
        gate.classList.add('is-used');
        gate.textContent = '✓ Пройдено';
        appendSegment(i + 1);
      });
    }
    var unlock = function () { if (gate) { gate.disabled = false; gate.classList.remove('is-wait'); gate.classList.add('is-ready'); } };
    var onDone = function () { unlock(); };

    var needsDone = (seg.type === 'practice' || seg.type === 'contact' || seg.type === 'stagedrill');

    switch (seg.type) {
      case 'widget':
        if (seg.widget === 'types' && window.NegContactUI) window.NegContactUI.renderTypes(mount);
        else if (seg.widget === 'arc' && window.NegTrainerUI) window.NegTrainerUI.renderArc(mount);
        else if (seg.widget === 'stages' && window.NegTrainerUI) window.NegTrainerUI.renderMap(mount);
        else if (seg.widget === 'modes' && window.NegTrainerUI) window.NegTrainerUI.renderModes(mount);
        break;
      case 'practice':
        if (window.NegTrainerUI) window.NegTrainerUI.mountDrill(mount, seg.bank, onDone, seg.count || 0);
        else { mount.textContent = 'Практика недоступна.'; needsDone = false; }
        break;
      case 'contact':
        if (window.NegContactUI) window.NegContactUI.mountPractice(mount, onDone);
        else { mount.textContent = 'Практика недоступна.'; needsDone = false; }
        break;
      case 'stagedrill':
        if (window.NegTrainerUI) window.NegTrainerUI.mountStageDrill(mount, onDone, seg.count || 0);
        else { mount.textContent = 'Практика недоступна.'; needsDone = false; }
        break;
    }

    if (gate) {
      if (needsDone) { gate.disabled = true; gate.classList.add('is-wait'); }
      else { unlock(); }
      block.appendChild(gate);
    }

    if (i > 0) scrollToBlock(block);
  }

  // ── итоговый экран сценария ──────────────────────────────────────
  function renderSummary(block, seg) {
    markDone(state.lesson.id);
    updateBar(state.lesson.segments.length - 1);

    block.appendChild(el('div', 'neg-l-sum-badge', '✓ Сценарий пройден'));
    if (seg.body) block.appendChild(el('div', 'neg-l-prose', richText(seg.body)));

    var actions = el('div', 'neg-l-sum-actions');
    var nx = nextLesson(state.lesson.id);
    if (nx) {
      var nb = el('button', 'neg-btn neg-btn--primary', 'Следующий: ' + nx.title + ' →');
      nb.type = 'button';
      nb.addEventListener('click', function () { openLesson(nx); });
      actions.appendChild(nb);
    }
    var back = el('button', 'neg-l-back', '← Ко всем сценариям');
    back.type = 'button';
    back.addEventListener('click', backToCatalog);
    actions.appendChild(back);
    block.appendChild(actions);
  }

  // ═══ bootstrap ════════════════════════════════════════════════════
  function init() {
    catalogSec = document.getElementById('neg-catalog');
    catalogList = document.getElementById('neg-catalog-list');
    lessonRoot = document.getElementById('neg-lesson');
    if (!catalogList || !lessonRoot) return;
    showCatalog();
    renderCatalog();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
