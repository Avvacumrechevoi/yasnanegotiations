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
  var TYPES = (window.NegContact && window.NegContact.types) || [];
  function typeById(code) { var r = null; TYPES.forEach(function (t) { if (t.id === code) r = t; }); return r; }

  // ═══ Конфиг «Живого спарринга»: уровни × навыки × типы ════════════
  // model — СЛУЖЕБНОЕ поле, в UI НЕ показывается (юзер видит только уровень).
  var CFG = {
    naming: {
      title: 'Живой спарринг',
      sub: 'Веди настоящий разговор: выбери, кого тренируешь, какой навык качаешь и насколько жёстко играть — и заходи. Отвечай своими словами, собеседник реагирует по-живому, как человек напротив.'
    },
    levels: [
      { id: 'easy',   label: 'Разминка',     emoji: '🟢', model: 'claude-haiku-4-5',
        desc: 'Дружелюбный: прощает шероховатости и сам подсказывает, куда вести.',
        behavior: 'Уровень РАЗМИНКА. Ты настроен доброжелательно и искренне хочешь, чтобы разговор сложился. Прощай неуклюжие формулировки и мелкие промахи: если ход в целом в нужную сторону — теплей и иди навстречу. На явную ошибку реагируй мягко, без обиды, и сам приоткрывай зацепку, за которую игроку удобно ухватиться («меня вот что на самом деле волнует…»). Сопротивляйся слабо, из контакта не выходи. Дай игроку почувствовать прогресс. Держись своего характера, но в его тёплой, расположенной версии.' },
      { id: 'medium', label: 'Переговоры',   emoji: '🟡', model: 'claude-sonnet-4-6',
        desc: 'Реалистичный: за верный заход теплеет, на промах холодеет — как в жизни.',
        behavior: 'Уровень ПЕРЕГОВОРЫ. Веди себя как живой деловой человек этой роли — без поблажек и без злого умысла. Точный ход — теплей и шаг навстречу; вода, давление или мимо твоего характера — холодней, держи дистанцию, переспрашивай, можешь усомниться вслух. Ничего не подсказывай и не подыгрывай. Контакт растёт только за реальную работу игрока; одна-две грубые ошибки подряд — и ты заметно отстраняешься.' },
      { id: 'hard',   label: 'Жёсткий стол', emoji: '🔴', model: 'claude-opus-4-8',
        desc: 'Тёртый и недоверчивый: цепляется к неточностям, легко встаёт из-за стола.',
        behavior: 'Уровень ЖЁСТКИЙ СТОЛ. Ты опытный, недоверчивый и не расположенный собеседник; время и терпение на исходе. Ловишь любую неточность, штамп, манипуляцию и несоответствие своему характеру — называешь это вслух и давишь сильнее. Теплеешь скупо и только за по-настоящему сильный, точный ход, и даже тогда не до конца. На слабый или давящий ход — холодеешь резко: можешь оборвать тему, поставить ультиматум или встать из-за стола. Никаких подсказок и поблажек — пусть игрок вытаскивает разговор сам.' }
    ],
    skills: [
      { id: 'contact',  label: 'Вход в контакт', sub: 'Расположить с первых фраз и считать, кто перед тобой.',
        goal: 'Игрок тренирует ВХОД В КОНТАКТ: расположить собеседника с первых реплик, по поведению считать его тип и выбрать верный заход вместо шаблонного. Награждай ходы, где игрок сперва настраивается на тебя (вопрос о тебе или твоём контексте, верный тон, темп под тебя), и холодей на разогнавшийся с порога питч или заход не в твою волну. Свой тип проявляй с первых реплик, чтобы было что считывать.',
        success: 'первые 1–2 хода попали в волну собеседника, тип распознан и заход подобран под него' },
      { id: 'resonance', label: 'Резонанс', sub: 'Поймать волну и не питчить раньше времени.',
        goal: 'Игрок тренирует РЕЗОНАНС: поймать твою волну — темп, тему, настроение — и удержаться от преждевременного питча. Награждай отзеркаливание, уточняющие вопросы и движение в твоём темпе; холодей, если игрок перескакивает к продаже, деньгам или решению раньше, чем построен контакт.',
        success: 'игрок шёл в твоём темпе, развивал твою тему и не сорвался в питч' },
      { id: 'give-take', label: 'Дать-взять', sub: 'На каждое «беру» — своё «даю, если».',
        goal: 'Игрок тренирует ЧЕСТНЫЙ ОБМЕН: на каждое твоё «беру» называть встречное «даю, если» и привязывать уступку к проверяемому условию. Дави односторонне — проси уступок, про встречное молчи; награждай ровный обмен, остывай и на капитуляцию «лишь бы закрыть», и на встречный продавливающий ультиматум.',
        success: 'ни одной уступки даром, каждая привязана к условию, без капитуляции и без пережима' },
      { id: 'status',    label: 'Дело vs статус', sub: 'Понять, что задето: условия или самолюбие.',
        goal: 'Игрок тренирует РАЗЛИЧЕНИЕ ДРАЙВЕРА: услышать, в чём настоящий корень недовольства — деловые условия или задетое самолюбие и статус — и попасть в настоящую причину. Подавай жалобу про «цену» или «условия», за которой на деле задето отношение к тебе; награждай прощупывающие вопросы и признание твоего статуса, холодей, когда игрок лечит задетое самолюбие скидкой или цифрой.',
        success: 'игрок не клюнул на ложный повод, прощупал и попал в настоящий драйвер' },
      { id: 'repair',    label: 'Починить недопонимание', sub: 'Развернуть холодеющий разговор без обвинений.',
        goal: 'Игрок тренирует ПОЧИНКУ НЕДОПОНИМАНИЯ: развернуть холодеющий или сорвавшийся разговор обратно к пониманию — без оправданий и встречных обвинений. Будь холоден, поминай прошлый промах или обиду; награждай прямое признание факта без оправданий и возврат к твоему интересу, резко закрывайся на перевод стрелок и отмашку «всякое бывает».',
        success: 'игрок признал проблему без оправданий и перевода вины — холод сменился готовностью продолжать' },
      { id: 'exit',      label: 'Выйти красиво', sub: 'Завершить — даже при отказе — с чистым следом.',
        goal: 'Игрок тренирует КРАСИВЫЙ ВЫХОД: завершить разговор — в том числе при твоём отказе — так, чтобы остался чистый след и открытая дверь. Веди дело к завершению или к отказу; награждай чёткую фиксацию договорённого, спокойное принятие «нет» и оставленную дверь, остывай на дожим после отказа, на обиду и на затянутый финал.',
        success: 'итог зафиксирован или отказ принят ровно, без дожима и обиды, дверь оставлена открытой' }
    ],
    typeRole: { 'ХА': 'нетерпеливый руководитель', 'ФО': 'аналитик-скептик', 'ЦИ': 'человек смысла и тепла', 'ШЭ': 'практик до мозга костей' },
    typePrompt: {
      'ХА': 'Тип ХА «Командир» (метка: Огонь · Воля, 🔥). Ты руководитель, привыкший решать и отвечать за результат. Нетерпелив: «у меня пять минут», всё нужно было ещё вчера; говоришь рублеными короткими фразами и сразу про дело. Тебя заводят: суть в первой фразе, выгода и конкретная цифра, готовый выбор как команда («бери вариант А или Б»). Тебя бесят и охлаждают: вода, долгие вступления и благодарности, теория и психология, неуверенность («наверное», «не знаю»), эмоции и лесть вместо результата. Зашли коротко и по выгоде — разворачиваешься и решаешь быстро.',
      'ФО': 'Тип ФО «Аналитик» (метка: Вода · Ум, 💧). Ты скептик с внутренней бритвой: «пока не доказано — не считается». Сух, держишь дистанцию, проверяешь каждое утверждение. Тебя заводят: факты, цифры, ссылка на источник или замер, признание твоей экспертизы, честное «не знаю» вместо блефа. Тебя бесят и закрывают: «поверьте», «мы лучшие», эмоции вместо доказательств, общие слова и регалии, ранний питч. Доверие даёшь медленно и только за проверяемое; на пустое обещание каменеешь.',
      'ЦИ': 'Тип ЦИ «Душевный» (метка: Воздух · Душа, ✦). Для тебя «зачем» и «с кем» важнее, чем «сколько». Ты человек смысла и тепла, ценишь отношения и личный контакт, говоришь живо, порой уходишь в истории. Тебя заводят: разговор по-человечески, искренний интерес к тебе, сначала контакт и смысл — потом дело, признание твоей истории. Тебя ранят и отталкивают: сухой питч с порога, давление и спешка, обезличенность («вы как все»), сведение всего к деньгам. Чувствуешь, что тебя слышат как человека, — раскрываешься.',
      'ШЭ': 'Тип ШЭ «Практик» (метка: Земля · Тело, ⬢). Веришь только тому, что можно потрогать и проверить руками: «покажи готовое, а не рассказывай». Конкретен, приземлён, теорию пропускаешь мимо ушей. Тебя заводят: демо, живой кейс, цифры и факты, пошаговая конкретика. Тебя бесят и охлаждают: абстракции и «вообще», концепции и методологии, обещания без доказательства, «в перспективе». Пока не увидел или не пощупал — не веришь; увидел конкретное — включаешься.'
    }
  };
  function levelById(id) { var r = CFG.levels[1]; CFG.levels.forEach(function (l) { if (l.id === id) r = l; }); return r; }
  function skillById(id) { var r = CFG.skills[0]; CFG.skills.forEach(function (s) { if (s.id === id) r = s; }); return r; }

  // боль + связь с уроком (JTBD): спарринг = «живая» версия навыка из урока
  var SPAR_META = {
    rezonans:        { when: 'Собеседник пришёл холодным скептиком, а ты по привычке хочешь сразу питчить.', from: 'Урок 2' },
    'type-ha':       { when: 'Перед тобой нетерпеливый командир: «у меня пять минут», давит на результат.', from: 'Урок 1' },
    'give-take':     { when: 'Оппонент давит односторонне — требует уступок, а взамен молчит.', from: 'Урок 3' },
    'status-benefit':{ when: 'Клиент твердит «дорого», но на деле его задело отношение.', from: 'Урок 3' },
    protivostoyanie: { when: 'Пик: ультиматум, голос на пределе — «или цена падает, или мы уходим».', from: 'Урок 2' },
    hidden:          { when: 'За вежливым «дорого» прячется настоящая причина — страх рискнуть.', from: 'Урок 2' }
  };

  // ── хранилище ────────────────────────────────────────────────────
  var SKEY = 'yasna_neg_spar_v1';
  function loadProg() { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (_) { return {}; } }
  function saveProg(p) { try { localStorage.setItem(SKEY, JSON.stringify(p)); } catch (_) {} }
  var prog = loadProg();

  function getEngine() { try { return localStorage.getItem('yasna_neg_engine') || 'script'; } catch (_) { return 'script'; } }
  function setEngine(v) { try { localStorage.setItem('yasna_neg_engine', v); } catch (_) {} }
  function getKey() { try { return localStorage.getItem('yasna_neg_aikey') || ''; } catch (_) { return ''; } }
  function setKey(v) { try { v ? localStorage.setItem('yasna_neg_aikey', v) : localStorage.removeItem('yasna_neg_aikey'); } catch (_) {} }
  // Уровень сложности → модель (служебно). Юзер выбирает только уровень.
  function getLevel() { try { return localStorage.getItem('yasna_neg_level') || 'medium'; } catch (_) { return 'medium'; } }
  function setLevel(v) { try { localStorage.setItem('yasna_neg_level', v); } catch (_) {} }
  function getModel() { return levelById(getLevel()).model; }
  function getSparType() { try { return localStorage.getItem('yasna_neg_spar_type') || 'ХА'; } catch (_) { return 'ХА'; } }
  function setSparType(v) { try { localStorage.setItem('yasna_neg_spar_type', v); } catch (_) {} }
  function getSparSkill() { try { return localStorage.getItem('yasna_neg_spar_skill') || CFG.skills[0].id; } catch (_) { return CFG.skills[0].id; } }
  function setSparSkill(v) { try { localStorage.setItem('yasna_neg_spar_skill', v); } catch (_) {} }

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
      // на вкладке спарринга герой-CTA гасится в ghost (одна акцентная кнопка на вкладку)
      try { document.documentElement.setAttribute('data-neg-mode', mode); } catch (_) {}
      try { localStorage.setItem('yasna_neg_mode', mode); } catch (_) {}
    }
    [].forEach.call(tabs.querySelectorAll('.neg-mode-tab'), function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-mode')); });
    });
    var saved = null; try { saved = localStorage.getItem('yasna_neg_mode'); } catch (_) {}
    show(saved === 'spar' ? 'spar' : 'lessons');
  }

  var sparRoot = null;

  // ═══ экран выбора: собеседники (движок ИИ — за ссылкой) ═══════════
  var aiSetupOpen = false;

  function renderSelector() {
    if (!sparRoot) return;
    sparRoot.innerHTML = '';

    // ── конструктор: тип × навык × уровень ──
    var cfg = el('div', 'neg-cfg');
    var curType = getSparType(), curSkill = getSparSkill(), curLvl = getLevel();

    cfg.appendChild(el('div', 'neg-cfg-label', '1 · С кем тренируешься'));
    var typeRow = el('div', 'neg-cfg-types');
    TYPES.forEach(function (t) {
      var b = el('button', 'neg-cfg-type neg-c-type--' + t.id + (t.id === curType ? ' is-on' : ''));
      b.type = 'button';
      b.innerHTML =
        '<span class="neg-cfg-type-glyph">' + esc(t.glyph) + '</span>' +
        '<span class="neg-cfg-type-name">' + esc(t.label || t.id) + '</span>' +
        '<span class="neg-cfg-type-role">' + esc(CFG.typeRole[t.id] || '') + '</span>';
      b.addEventListener('click', function () { setSparType(t.id); renderSelector(); });
      typeRow.appendChild(b);
    });
    cfg.appendChild(typeRow);

    cfg.appendChild(el('div', 'neg-cfg-label', '2 · Какой навык качаешь'));
    var skillRow = el('div', 'neg-cfg-skills');
    CFG.skills.forEach(function (s) {
      var b = el('button', 'neg-cfg-skill' + (s.id === curSkill ? ' is-on' : ''));
      b.type = 'button';
      b.innerHTML = '<span class="neg-cfg-skill-h">' + esc(s.label) + '</span>' +
        '<span class="neg-cfg-skill-d">' + esc(s.sub) + '</span>';
      b.addEventListener('click', function () { setSparSkill(s.id); renderSelector(); });
      skillRow.appendChild(b);
    });
    cfg.appendChild(skillRow);

    cfg.appendChild(el('div', 'neg-cfg-label', '3 · Насколько жёстко'));
    var lvlRow = el('div', 'neg-cfg-levels');
    CFG.levels.forEach(function (l) {
      var b = el('button', 'neg-cfg-level neg-cfg-level--' + l.id + (l.id === curLvl ? ' is-on' : ''));
      b.type = 'button';
      b.innerHTML = '<span class="neg-cfg-level-h">' + l.emoji + ' ' + esc(l.label) + '</span>' +
        '<span class="neg-cfg-level-d">' + esc(l.desc) + '</span>';
      b.addEventListener('click', function () { setLevel(l.id); renderSelector(); });
      lvlRow.appendChild(b);
    });
    cfg.appendChild(lvlRow);

    var tt = typeById(curType) || {}, sk = skillById(curSkill);
    var cta = el('button', 'neg-cfg-start', 'Начать спарринг: ' + esc(tt.label || '') + ' · ' + esc(sk.label) + ' →');
    cta.type = 'button';
    cta.addEventListener('click', onStartConfigured);
    cfg.appendChild(cta);
    sparRoot.appendChild(cfg);

    // ключ для живого диалога (BYOK) — панель или ссылка
    if (aiSetupOpen || getKey()) sparRoot.appendChild(renderKeyPanel());
    else {
      var link = el('button', 'neg-spar-ailink', '🔑 Для живого диалога нужен свой ключ Anthropic — подключить →');
      link.type = 'button';
      link.addEventListener('click', function () { aiSetupOpen = true; renderSelector(); });
      sparRoot.appendChild(link);
    }

    // ── готовые сценарии: быстрый старт без настройки и без ключа ──
    if (SPAR.length) {
      sparRoot.appendChild(el('div', 'neg-spar-pick-label', 'Или готовый сценарий — сразу, без настройки и ключа:'));
      var grid = el('div', 'neg-spar-grid');
      SPAR.forEach(function (sc, idx) {
        var st = prog[sc.id] || {};
        var badge = st.plays
          ? '<span class="neg-spar-card-badge">лучшее ' + (st.best || 0) + '/' + sc.beats.length + '</span>'
          : '<span class="neg-spar-card-badge neg-spar-card-badge--new">тренировать →</span>';
        var meta = SPAR_META[sc.id] || {};
        var card = el('button', 'neg-spar-card');
        card.type = 'button';
        card.innerHTML =
          '<span class="neg-spar-card-glyph">' + esc(sc.persona.glyph) + '</span>' +
          '<span class="neg-spar-card-body">' +
            '<span class="neg-spar-card-title">' + esc(sc.title) + '</span>' +
            (meta.when ? '<span class="neg-spar-card-when">Когда: ' + esc(meta.when) + '</span>' : '') +
            '<span class="neg-spar-card-persona">' + esc(sc.persona.name) + ' · ' + esc(sc.persona.role) +
              (meta.from ? ' <span class="neg-spar-card-from">из «' + esc(meta.from) + '»</span>' : '') + '</span>' +
          '</span>' +
          '<span class="neg-spar-card-foot">' + badge + '</span>';
        card.addEventListener('click', function () { startScriptChat(sc); });
        grid.appendChild(card);
      });
      sparRoot.appendChild(grid);
    }
  }

  // Старт настроенного живого диалога. Без ключа — открываем панель ключа.
  function onStartConfigured() {
    if (!getKey()) {
      aiSetupOpen = true; renderSelector();
      var i = document.getElementById('neg-spar-key-input');
      if (i) { try { i.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {} i.focus(); }
      return;
    }
    startAIChat(buildScenario(getSparType(), getSparSkill()));
  }

  // Сборка «сценария» из выбора конструктора (для живого диалога).
  function buildScenario(typeCode, skillId) {
    var t = typeById(typeCode) || {};
    var sk = skillById(skillId);
    return {
      _configured: true, _typeCode: typeCode, _skillId: skillId,
      persona: { name: (t.label || typeCode), role: (CFG.typeRole[typeCode] || ''), glyph: (t.glyph || '💬') },
      setting: 'Деловой разговор один на один.',
      param: sk.label, goal: sk.sub, skill: sk
    };
  }

  function renderKeyPanel() {
    var wrap = el('div', 'neg-spar-key');
    var hasKey = !!getKey();
    if (hasKey) {
      wrap.innerHTML =
        '<div class="neg-spar-key-row"><span class="neg-spar-key-ok">✓ Ключ сохранён</span> ' +
        '<span class="neg-spar-key-sub">в этом браузере · уровень задаёт сложность собеседника</span></div>' +
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
        '<button type="button" class="neg-spar-key-save" id="neg-spar-key-save">Сохранить и начать</button>' +
      '</div>' +
      '<p class="neg-spar-key-note neg-spar-key-note--lvl">Сложность собеседника выбирается уровнем выше (🟢 / 🟡 / 🔴) — модель подбирается автоматически.</p>';
    wrap.querySelector('#neg-spar-key-save').addEventListener('click', function () {
      var v = (wrap.querySelector('#neg-spar-key-input').value || '').trim();
      if (!v) { wrap.querySelector('#neg-spar-key-input').focus(); return; }
      setKey(v); startAIChat(buildScenario(getSparType(), getSparSkill()));
    });
    return wrap;
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
    var lv = levelById(getLevel());
    AI.msgs = chatShell(sc, lv.emoji + ' ' + lv.label);   // ярлык уровня, без «ИИ» и без модели

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

  // Системный промпт собирается из выбора конструктора: тип × навык × уровень.
  function aiSystem(sc) {
    var typeName = sc.persona.name;
    var typeBehavior = (sc._typeCode && CFG.typePrompt[sc._typeCode]) || (typeName + ' — ' + sc.persona.role + '.');
    var skillGoal = (sc.skill && sc.skill.goal) || ('Игрок тренирует «' + sc.param + '»: ' + sc.goal);
    var difficultyBehavior = levelById(getLevel()).behavior;
    return 'Ты играешь РОЛЬ собеседника на деловых переговорах, а НЕ ассистента и НЕ тренера. Ты — живой человек этой роли, с её характером и интересами.\n\n' +
      'ТВОЙ ХАРАКТЕР (' + typeName + ') — держи его в каждой реплике:\n' + typeBehavior + '\n\n' +
      'ЧТО ТРЕНИРУЕТ ИГРОК НАПРОТИВ — на это реагируй прежде всего:\n' + skillGoal + '\n\n' +
      'НАСКОЛЬКО ЖЁСТКО ИГРАТЬ:\n' + difficultyBehavior + '\n\n' +
      'КАК ОТВЕЧАТЬ:\n' +
      '- По-русски, коротко — 1–3 фразы, как в живой устной речи.\n' +
      '- Главное: реагируй на КАЧЕСТВО хода игрока — и по тренируемому навыку, и по своему характеру. Точный, сильный ход — теплей и шаг навстречу; вода, давление, манипуляция или мимо твоего типа — холодней и сопротивляйся, вплоть до выхода из контакта (насколько резко — по уровню жёсткости выше).\n' +
      '- Будь эмоционально достоверным: характер (' + typeName + ') виден всегда, даже когда теплеешь или злишься.\n' +
      '- НИКОГДА не выходи из роли: не объясняй правила, не оценивай ход игрока вслух, не давай советов, подсказок и мета-комментариев, не называй «правильный ответ». Только реплики и реакции персонажа.\n' +
      '- Не повторяй слова игрока дословно и не уходи в монолог — отвечай как в настоящем диалоге.';
  }
  async function callClaude(messages, system, maxTokens) {
    return callWithModel(getModel(), messages, system, maxTokens, true);
  }
  // Если у ключа нет доступа к выбранной модели (часто на «Жёстком столе» = Opus) —
  // тихо откатываемся на Sonnet, чтобы уровень всё равно работал.
  async function callWithModel(model, messages, system, maxTokens, allowFallback) {
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': getKey(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: model, max_tokens: maxTokens || 320, system: system, messages: messages })
    });
    if (!res.ok) {
      var t = ''; try { t = await res.text(); } catch (_) {}
      var modelIssue = (res.status === 404) || (res.status === 400 && /model/i.test(t));
      if (allowFallback && modelIssue && model !== 'claude-sonnet-4-6') {
        return callWithModel('claude-sonnet-4-6', messages, system, maxTokens, false);
      }
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
      var crit = (AI.sc.skill && AI.sc.skill.success) ? ' Критерий «хорошо»: ' + AI.sc.skill.success + '.' : '';
      hist.push({ role: 'user', content: 'Выйди из роли. Как тренер оцени, как я провёл этот разговор по навыку «' + AI.sc.param + '».' + crit + ' ' +
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

  // ═══ публичный мост: открыть спарринг по id (зов из урока) ════════
  window.NegSparUI = {
    open: function (id) {
      var st = document.querySelector('#neg-mode-tabs [data-mode="spar"]');
      if (st) st.click();
      if (!sparRoot) sparRoot = document.getElementById('neg-spar-root');
      var sc = null;
      SPAR.forEach(function (s) { if (s.id === id) sc = s; });
      if (sc) startScriptChat(sc); else renderSelector();
      if (sparRoot && sparRoot.scrollIntoView) sparRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ═══ bootstrap ════════════════════════════════════════════════════
  function init() {
    sparRoot = document.getElementById('neg-spar-root');
    setupModeTabs();
    if (sparRoot) renderSelector();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
