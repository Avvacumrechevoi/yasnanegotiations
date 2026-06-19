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

  // ── Наставник (аватар-помощник) ──────────────────────────────────
  var COACH_NAME = 'Наставник';
  var COACH_ROLE = 'ведёт тебя по сценарию';
  var COACH_AVATAR =
    '<span class="neg-coach-av" aria-hidden="true">' +
      '<svg viewBox="0 0 44 44" width="44" height="44">' +
        '<defs><linearGradient id="negCoachG" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#16A7FF"/><stop offset="1" stop-color="#0077FF"/>' +
        '</linearGradient></defs>' +
        '<circle cx="22" cy="22" r="22" fill="url(#negCoachG)"/>' +
        '<text x="22" y="29" text-anchor="middle" font-size="20" fill="#fff">✦</text>' +
      '</svg>' +
    '</span>';
  function coachBlock(line) {
    var c = el('div', 'neg-l-coach');
    c.innerHTML = COACH_AVATAR +
      '<span class="neg-l-coach-body">' +
        '<span class="neg-l-coach-name">' + COACH_NAME + ' <span class="neg-l-coach-role">· ' + COACH_ROLE + '</span></span>' +
        '<span class="neg-l-coach-line">' + richText(line) + '</span>' +
      '</span>';
    return c;
  }

  // ── прогресс (пройденные сценарии) ───────────────────────────────
  var LKEY = 'yasna_neg_lessons_v1';
  function loadDone() { try { return JSON.parse(localStorage.getItem(LKEY)) || []; } catch (_) { return []; } }
  function markDone(id) {
    var d = loadDone();
    if (d.indexOf(id) < 0) { d.push(id); try { localStorage.setItem(LKEY, JSON.stringify(d)); } catch (_) {} }
  }

  // ── онбординг: один вопрос по боли → рекомендованный сценарий ─────
  var ONBKEY = 'yasna_neg_onb_v1';
  function loadOnb() { try { return localStorage.getItem(ONBKEY); } catch (_) { return null; } }
  function saveOnb(v) { try { localStorage.setItem(ONBKEY, v); } catch (_) {} }
  var PAINS = [
    { lesson: 'l1', label: 'Не считываю человека — один и тот же довод одного цепляет, другого отталкивает' },
    { lesson: 'l2', label: 'Разговор уходит в хаос — теряю нить, не знаю, давить или слушать' },
    { lesson: 'l3', label: 'Прогибаюсь по деньгам и условиям — боюсь назвать цифру и отдать всё даром' },
    { lesson: 'l4', label: 'Расстаёмся на осадке — разговор скатывается, остаётся неприятный след' }
  ];
  function lessonById(id) { var r = null; LESSONS.forEach(function (l) { if (l.id === id) r = l; }); return r; }

  // ═══ КОНТЕНТ: 4 сценария ══════════════════════════════════════════
  var LESSONS = [
    {
      id: 'l1', n: 1, title: 'Кто передо мной', sparId: 'type-ha',
      outcome: 'Читать людей: командир, аналитик, душевный, практик — и заходить верно', duration: '~7 мин',
      when: 'Когда заходишь к новому человеку и не понимаешь, почему один и тот же довод одного зажигает, а другого отталкивает.',
      skill: 'Читать тип собеседника по первым репликам и за одну фразу выбирать заход под него — командиру суть и цифру, аналитику факты, душевному смысл, практику показать руками.',
      segments: [
        { type: 'intro', coach: 'Прежде чем доставать аргументы — посмотри, кто напротив. Дальше всё решает это.', body: 'Один и тот же довод одного зажигает, другого бесит — потому что напротив **разные люди**, а не разные настроения. Здесь ты за пару реплик научишься различать четыре типа — командир, аналитик, душевный, практик — и под каждого выбирать заход, который сближает.', example: 'Заходишь с тёплым «давайте по-человечески» — душевный растает, а командир услышит, что ты тянешь время, и закроется ещё до сути.', takeaway: 'Сначала прочитай человека — потом выбирай слова.' },
        { type: 'theory', title: 'Почему это первый шаг', coach: 'Объясню, почему чтение типа — это не разминка, а сама работа.', body: 'Универсальной фразы нет: что для одного **аргумент**, для другого раздражитель. Сильные переговорщики не зубрят формулировки — они читают человека и подгоняют заход: командиру суть и цифру, аналитику факты, душевному смысл, практику показать руками.', example: 'Аналитику бросаешь «поверьте, у нас всё надёжно» — он слышит «доказательств нет». Дай ему ту же мысль цифрой и со ссылкой на источник — и он сам начнёт тебе помогать.', takeaway: 'Не ищи лучшую фразу — ищи фразу под этого человека.' },
        { type: 'widget', widget: 'types', title: 'Четыре типа', note: 'Нажми на карточку — раскроется: как распознать, как входить и что отталкивает.' },
        { type: 'practice', bank: 'RECON', count: 5, title: 'Практика · собери досье', note: 'Сильную позицию готовят ДО встречи. По обрывку информации реши, что он даёт и что выяснить.' },
        { type: 'contact', title: 'Практика · вход в контакт', note: 'Семь встреч. На каждой определи тип по реплике, затем выбери заход: один резонирует, другой рвёт контакт.' },
        { type: 'practice', bank: 'TYPESTAGE', count: 6, title: 'Практика · заход под характер', note: 'Сложнее: дан тип и момент разговора — выбери ход, верный именно для этого человека.' },
        { type: 'summary', body: 'Готово. Ты различаешь четыре типа и заходишь под каждый. Дальше — как ведётся **сам разговор**: от первого слова до результата.' }
      ]
    },
    {
      id: 'l2', n: 2, title: 'Как ведётся разговор', sparId: 'rezonans',
      outcome: 'Видеть, куда движется разговор, и не терять контакт', duration: '~9 мин',
      when: 'Когда разговор кажется хаосом — теряешь нить и не понимаешь, какой ход уместен сейчас: давить, слушать, фиксировать или отступить.',
      skill: 'Видеть разговор как дугу из 12 стадий, определять текущую стадию по реплике и ловить режим контакта — резонанс это или назревающий срыв.',
      segments: [
        { type: 'intro', coach: 'Прочитал человека — теперь смотрим, как движется сам разговор. Тут перестаёшь теряться.', body: 'Разговор — не хаос реплик, а **дуга**: вход, нарастание, вершина, спад, итог. Видишь, на какой ты сейчас, — понимаешь, какой ход уместен: давить, слушать, фиксировать или отступить, а не палить наугад.', example: 'Дожимаешь цену, а разговор всего на входе — человек ещё греется. Тот же напор на вершине сработал бы, а тут только спугнул.', takeaway: 'Увидишь стадию — перестанешь давить не вовремя.' },
        { type: 'theory', title: 'Где мы сейчас', coach: 'Один вопрос держи в голове весь разговор: «где мы сейчас?» Он один меняет всё.', body: '**Стадия** подсказывает, какой ход сработает именно сейчас: сильный довод на раннем этапе звучит как наезд, а на позднем — как опора. Ещё стадия ловит режим контакта — разговор разогревается к согласию или тихо назревает срыв.', example: 'Собеседник вдруг сухо роняет «давайте к делу» — это не грубость, а сигнал стадии: пора фиксировать, а не убеждать дальше.', takeaway: 'Сначала пойми, где разговор, потом ходи.' },
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
      id: 'l3', n: 3, title: 'Договориться честно', sparId: 'give-take',
      outcome: 'Строить честный обмен и не путать дело со статусом', duration: '~8 мин',
      when: 'Когда нужно договориться, но боишься либо отдать всё даром под давлением, либо лечить недовольство не тем — скидкой там, где задето самолюбие.',
      skill: 'Строить честный обмен — на каждое «беру» называть своё «даю, если» под проверяемое условие; отличать спор о деле от спора о статусе; и в концовке наносить решающий ход.',
      segments: [
        { type: 'intro', coach: 'Тут начинается самое вкусное — переходим от слов к настоящей сделке. Идём.', body: 'Любая сделка держится на честном **обмене**: на каждое «беру» у тебя готово «даю взамен». Отдельно держи разницу между спором о деле и спором о статусе — это разные конфликты, и лечат их по-разному.', example: 'Тебе дожимают скидку. Можно молча уступить и злиться, а можно дать её в обмен на объём или предоплату. Разница между этими ходами и есть переговоры.', takeaway: 'Меняй, а не отдавай — и бей точно в корень.' },
        { type: 'theory', title: 'Дать и взять', coach: 'Запомни одну рамку — и перестанешь отдавать даром под давлением.', body: 'Перед уступкой ответь себе на четыре вопроса: что я **беру**, что **даю** взамен, что реально нужно ему, что он готов дать. Берёшь и ничего не кладёшь на стол — это не сделка, а продавливание, и он это запомнит.', example: '«Скидку дам — но при заказе от десяти штук и оплате вперёд». Уступка есть, но привязана к условию, а не подарена в воздух.', takeaway: 'На каждое «беру» называй своё «даю, если».' },
        { type: 'practice', bank: 'DEALPLAY', count: 6, title: 'Практика · собери сделку', note: 'Посмотри на обмен и реши, что сделать, чтобы он стал честным.' },
        { type: 'theory', title: 'Дело или статус', coach: 'Половина тупиков — вообще не про цифры. Сейчас научишься это различать.', body: 'Раздели конфликт надвое. Спор о **деле** — это условия, цифры, сроки. Спор о **статусе** — кого услышали, чьё слово весит, кто решает. Беда в том, что лечат их крест-накрест: скидкой унимают задетое самолюбие, а вежливым «извини» — реальную дыру в цене.', example: 'Клиент кипит: «вы со мной даже не посоветовались». Денег это не стоит — стоит признания: «Ты прав, решили без тебя, давай сейчас вместе». Скидка тут обидела бы сильнее.', takeaway: 'Сначала пойми, о чём злость — о деле или об уважении.' },
        { type: 'practice', bank: 'STATUS', count: 6, title: 'Практика · дело или статус', note: 'На реплике недовольства реши, в чём корень, и выбери ход.' },
        { type: 'practice', bank: 'STRIKE', count: 5, title: 'Практика · реши исход одним ходом', note: 'Сделка почти созрела. Выбери решающий ход — не пересолить и не упустить.' },
        { type: 'summary', body: 'Ты строишь честный обмен, видишь спор о деле и об уважении и умеешь дожать. Остался последний навык — **удержать контакт и красиво выйти**.' }
      ]
    },
    {
      id: 'l4', n: 4, title: 'Удержать и выйти', sparId: 'protivostoyanie',
      outcome: 'Чинить недопонимание и оставлять чистый след', duration: '~7 мин',
      when: 'Когда разговор после пика покатился вниз — тон холодеет, слова поняли по-разному — и есть риск, что недопонимание превратится в разрыв, а встреча закончится осадком.',
      skill: 'Чинить недопонимание на ходу и удерживать рвущийся контакт; завершать встречу так, чтобы даже при отказе остался чистый след — благодарность и открытая дверь вместо дожима и обиды.',
      segments: [
        { type: 'intro', coach: 'Самое сложное — не разогнать разговор, а посадить его. Этому почти никто не учится.', body: 'После пика разговор катится вниз — вопрос только куда: к пониманию или к срыву. Здесь ты научишься чинить **недопонимание** на ходу и выходить так, чтобы остался чистый **след** — даже когда договориться не вышло.', example: 'Всё шло гладко, а на цене собеседник сухо роняет «ну, я подумаю» — и ты не поймёшь: вежливый отказ или ты что-то не так сказал. Вот эти моменты и разберём.', takeaway: 'Спасай разговор на спаде и уходи без осадка.' },
        { type: 'theory', title: 'Развилка', coach: 'Не путай две вещи: когда тебя не поняли — и когда с тобой не хотят иметь дела.', body: '**Недопонимание** — это когда одни и те же слова вы прочитали по-разному; это ещё не срыв, а сбой связи. Чини сразу: переспроси смысл и назови расхождение без обвинения — и разговор свернёт к пониманию, а не к разрыву.', example: 'Клиент напрягся на слове «предоплата». Вместо спора: «Кажется, предоплата звучит как риск для тебя — давай уточню, что я имел в виду». Напряжение спадает за одну фразу.', takeaway: 'Не понял тебя — не значит против тебя. Уточняй, не обвиняй.' },
        { type: 'practice', bank: 'REPAIR', count: 6, title: 'Практика · почини недопонимание', note: 'Тон холодеет — выбери ход, который разворачивает к пониманию.' },
        { type: 'practice', bank: 'BREAK', count: 5, title: 'Практика · контакт рвётся', note: 'Собеседник встал и уходит. Выбери ход, который вернёт за стол, а не добьёт.' },
        { type: 'theory', title: 'След после встречи', coach: 'Разговор кончится, а память о тебе останется. Вот за неё и борись на финале.', body: 'Даже при отказе не расходись врагами: финал — это **будущая история**, которую о тебе расскажут. Чистый шаг и благодарность оставляют имя и **открытую дверь**, а дожим и обида — осадок, к которому уже не вернутся.', example: 'Сделка не сложилась. «Жаль, в этот раз не совпало — спасибо за честный разговор, я на связи» работает в разы лучше, чем «вы ещё пожалеете»: через полгода с первым перезвонят, со вторым — нет.', takeaway: 'Уходи так, чтобы захотели вернуться. Дверь оставляй открытой.' },
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

  function firstUndoneIndex() {
    var done = loadDone();
    for (var k = 0; k < LESSONS.length; k++) { if (done.indexOf(LESSONS[k].id) < 0) return k; }
    return -1; // всё пройдено
  }

  // ── каталог сценариев: маршрут + карточки ────────────────────────
  function renderCatalog() {
    if (!catalogList) return;
    catalogList.innerHTML = '';
    var done = loadDone();
    var hereIdx = firstUndoneIndex();

    // маршрут «ты здесь»: дорожка 1→2→3→4
    var route = el('div', 'neg-route');
    var rail = el('div', 'neg-route-rail');
    LESSONS.forEach(function (l, k) {
      var isDone = done.indexOf(l.id) >= 0;
      var here = (k === hereIdx);
      var seg = el('button', 'neg-route-step' + (isDone ? ' is-done' : '') + (here ? ' is-here' : ''));
      seg.type = 'button';
      seg.innerHTML =
        '<span class="neg-route-dot">' + (isDone ? '✓' : l.n) + '</span>' +
        '<span class="neg-route-lbl">' + l.title + '</span>';
      seg.addEventListener('click', function () { openLesson(l); });
      rail.appendChild(seg);
    });
    route.appendChild(rail);
    route.appendChild(el('div', 'neg-route-meta', 'Пройдено ' + done.length + ' из ' + LESSONS.length + ' · ~30 мин · можно по порядку или открыть нужный'));
    catalogList.appendChild(route);

    var reco = loadOnb();
    var list = el('div', 'neg-cat');
    LESSONS.forEach(function (lesson, k) {
      var isDone = done.indexOf(lesson.id) >= 0;
      var isHere = (k === hereIdx);
      var isReco = (reco && reco === lesson.id);
      var card = el('button', 'neg-cat-card' + (isDone ? ' is-done' : '') + (isHere ? ' is-here' : '') + (isReco ? ' is-reco' : ''));
      card.type = 'button';
      card.innerHTML =
        '<span class="neg-cat-num">' + (isDone ? '✓' : lesson.n) + '</span>' +
        '<span class="neg-cat-body">' +
          (isReco ? '<span class="neg-cat-here neg-cat-reco">Тебе сюда</span>' : (isHere ? '<span class="neg-cat-here">Вы здесь</span>' : '')) +
          '<span class="neg-cat-title">' + lesson.title + '</span>' +
          '<span class="neg-cat-outcome">Научишься: ' + lesson.outcome + '</span>' +
          (lesson.when ? '<span class="neg-cat-when">' + richText(lesson.when) + '</span>' : '') +
          '<span class="neg-cat-meta">' + lesson.duration + ' · ' + lesson.segments.length + ' шагов' + (isDone ? ' · ✓ пройдено' : '') + '</span>' +
        '</span>' +
        '<span class="neg-cat-go">' + (isHere ? 'Начать здесь' : (isDone ? 'Повторить' : 'Начать')) + ' →</span>';
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
    var tw = el('div', 'neg-l-head-tw');
    tw.innerHTML =
      '<div class="neg-l-head-kicker">Сценарий ' + lesson.n + ' из ' + LESSONS.length + '</div>' +
      '<div class="neg-l-head-title">' + lesson.title + '</div>';
    head.appendChild(tw);
    var barWrap = el('div', 'neg-l-bar');
    var bar = el('div', 'neg-l-bar-fill');
    barWrap.appendChild(bar);
    head.appendChild(barWrap);
    var stepText = el('div', 'neg-l-step');
    head.appendChild(stepText);
    state.bar = bar;
    state.stepText = stepText;
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
    var total = state.lesson.segments.length;
    if (state.bar) state.bar.style.width = Math.round((i + 1) / total * 100) + '%';
    if (state.stepText) state.stepText.textContent = 'Шаг ' + (i + 1) + ' из ' + total;
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
    // микроцель прямым языком — что именно делать на этом шаге
    if (seg.todo) block.appendChild(el('div', 'neg-l-todo', '▸ Что делать: ' + seg.todo));

    // итоговый экран
    if (seg.type === 'summary') { renderSummary(block, seg); return; }

    // проза (intro/theory) — голос наставника + суть + пример + правило
    if (seg.type === 'intro' || seg.type === 'theory') {
      if (seg.coach) block.appendChild(coachBlock(seg.coach));
      block.appendChild(el('div', 'neg-l-prose' + (seg.type === 'intro' ? ' neg-l-prose--lead' : ''), richText(seg.body)));
      if (seg.example) {
        block.appendChild(el('div', 'neg-l-example',
          '<span class="neg-l-example-lbl">Пример</span><span class="neg-l-example-txt">' + richText(seg.example) + '</span>'));
      }
      if (seg.takeaway) {
        block.appendChild(el('div', 'neg-l-takeaway',
          '<span class="neg-l-takeaway-lbl">Правило</span><span class="neg-l-takeaway-txt">' + richText(seg.takeaway) + '</span>'));
      }
    }
    // на вводном шаге — явная цель урока (коротко)
    if (seg.type === 'intro' && lesson.outcome) {
      block.appendChild(el('div', 'neg-l-skilltag', '🎯 Навык на выходе: ' + lesson.outcome));
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
    var unlock = function () { if (gate) { gate.disabled = false; gate.classList.remove('is-wait'); gate.classList.add('is-ready'); gate.textContent = 'Дальше →'; } };
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
      if (needsDone) { gate.disabled = true; gate.classList.add('is-wait'); gate.textContent = 'Сначала пройди практику ↓'; }
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

    // отработать тот же навык вживую в спарринге
    if (state.lesson.sparId && window.NegSparUI && window.NegSparUI.open) {
      var spar = el('button', 'neg-l-spar-link', '🤖 Отработать вживую в диалоге →');
      spar.type = 'button';
      var sid = state.lesson.sparId;
      spar.addEventListener('click', function () { window.NegSparUI.open(sid); });
      block.appendChild(spar);
    }
  }

  // ── вводный экран первого визита ─────────────────────────────────
  function renderOnboarding() {
    var host = document.getElementById('neg-onb-root');
    if (!host) return;
    var ov = el('div', 'neg-onb');
    var card = el('div', 'neg-onb-card');
    card.innerHTML =
      '<div class="neg-onb-eyebrow">Тренажёр переговоров</div>' +
      '<div class="neg-onb-value">Переговоры — это навык. 4 коротких сценария, ~30 минут.</div>' +
      '<div class="neg-onb-sub">Один вопрос — и подскажем, с чего начать именно тебе. Или просто пройди по порядку.</div>' +
      '<div class="neg-onb-q">Что у тебя сейчас горит?</div>';
    var opts = el('div', 'neg-onb-opts');
    PAINS.forEach(function (p) {
      var b = el('button', 'neg-onb-opt');
      b.type = 'button';
      b.textContent = p.label;
      b.addEventListener('click', function () {
        saveOnb(p.lesson);
        host.innerHTML = '';
        var l = lessonById(p.lesson);
        if (l) openLesson(l);
      });
      opts.appendChild(b);
    });
    card.appendChild(opts);
    var skip = el('button', 'neg-onb-skip', 'Не уверен — просто веди по порядку →');
    skip.type = 'button';
    skip.addEventListener('click', function () { saveOnb('skip'); host.innerHTML = ''; renderCatalog(); });
    card.appendChild(skip);
    ov.appendChild(card);
    host.appendChild(ov);
  }

  // ═══ bootstrap ════════════════════════════════════════════════════
  function init() {
    catalogSec = document.getElementById('neg-catalog');
    catalogList = document.getElementById('neg-catalog-list');
    lessonRoot = document.getElementById('neg-lesson');
    if (!catalogList || !lessonRoot) return;
    showCatalog();
    renderCatalog();
    if (!loadOnb()) renderOnboarding();

    // главная кнопка-вход в герое: продолжить с первого непройденного
    var heroStart = document.getElementById('neg-hero-start');
    if (heroStart) heroStart.addEventListener('click', function () {
      var idx = firstUndoneIndex();
      var target = LESSONS[idx < 0 ? 0 : idx];
      var lt = document.querySelector('#neg-mode-tabs [data-mode="lessons"]');
      if (lt) lt.click();
      openLesson(target);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
