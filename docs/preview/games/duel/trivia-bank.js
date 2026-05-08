// ═══════════════════════════════════════════════════════════════════
// Банк вопросов · Игра по Ясне (MVP)
// 9 Тем × 5 вопросов = 45 вопросов · Мир «Сутки»
// ═══════════════════════════════════════════════════════════════════
(function(){
  const THEMES = [
    { id: 'gimny',     name: 'Гимны и Веда',         emoji: '🌟', short: 'Гимны' },
    { id: 'sutki',     name: 'Описание Суток',        emoji: '⏰', short: 'Сутки' },
    { id: 'zerno',     name: 'Зерно Познания',        emoji: '💎', short: 'Зерно' },
    { id: 'antipody',  name: 'Антиподы',              emoji: '⚖️', short: 'Антиподы' },
    { id: 'skorpion',  name: 'Скорпион / Паук',       emoji: '🪐', short: 'Скорпион' },
    { id: 'chashi',    name: 'Чаши Света и Тьмы',     emoji: '🏺', short: 'Чаши' },
    { id: 'prana',     name: 'Прана и Стихии',        emoji: '🔥', short: 'Прана' },
    { id: 'zerkalo',   name: 'Зеркало Девы',          emoji: '🪞', short: 'Зеркало' },
    { id: 'skrizhal',  name: 'Изумрудная Скрижаль',   emoji: '🏔', short: 'Скрижаль' },
  ];

  const QUESTIONS = [
    // ── Тема 1: Гимны и Веда ─────────────────────────────────────
    { id:'gimny-1', theme:'gimny', diff:1,
      text:'Ясна — это…',
      options:['Древнее предсказание погоды','Книга-Чертёж устройства мира','Сборник народных песен','Боевой устав'],
      correct:1,
      hint:'Ясна — методологический корпус из трёх книг (Сутки, Года, Жизни), где каждый день/год/жизнь рассматриваются как Чертёж в форме Звезды.' },
    { id:'gimny-2', theme:'gimny', diff:2,
      text:'Что роднит слова «Ясна» и «Веда»?',
      options:['Оба означают «знание / ясное понимание»','Оба — имена святых','Оба — названия рек','Оба пришли из греческого'],
      correct:0,
      hint:'«Ясна» от древнего корня «яс-» (ясный, явь), «Веда» от «вед-» (ведать, знать).' },
    { id:'gimny-3', theme:'gimny', diff:2,
      text:'Гимн в Ясне — это…',
      options:['Молитва перед сном','Государственный символ','Восхваление, текст-ключ к Чертежу','Только музыкальное произведение'],
      correct:2,
      hint:'Гимны — текстовые ключи, которыми открываются темы Ясны.' },
    { id:'gimny-4', theme:'gimny', diff:1,
      text:'Сколько книг в корпусе Ясны?',
      options:['Одна (общая)','Две (земля и небо)','Три (Сутки, Года, Жизни)','Двенадцать'],
      correct:2,
      hint:'Сутки → ритм дня; Года → ритм круглого года; Жизни → весь жизненный путь.' },
    { id:'gimny-5', theme:'gimny', diff:2,
      text:'Какое из этих утверждений о Ясне НЕВЕРНО?',
      options:['Это методология','Использует образ Звезды','Это религия с обрядами','Применяется к разным предметам'],
      correct:2,
      hint:'Ясна — методология анализа, а не религиозная практика.' },

    // ── Тема 2: Описание Суток ───────────────────────────────────
    { id:'sutki-1', theme:'sutki', diff:1,
      text:'Сколько полок в Ясне Суток?',
      options:['7','10','12','24'],
      correct:2,
      hint:'12 полок = 24 часа / 2. На одной полке — два часа суточного цикла.' },
    { id:'sutki-2', theme:'sutki', diff:1,
      text:'Какая полка соответствует полночи?',
      options:['0 (она же 12)','6','3','9'],
      correct:0,
      hint:'Полночь — точка полного покоя, начало нового цикла, полка 0/12.' },
    { id:'sutki-3', theme:'sutki', diff:1,
      text:'Какая полка соответствует полудню?',
      options:['0','6','12','18'],
      correct:1,
      hint:'Полдень — пик светового дня, противоположная полночи полка 6.' },
    { id:'sutki-4', theme:'sutki', diff:1,
      text:'Сколько часов на одной полке Суток?',
      options:['1','2','3','4'],
      correct:1,
      hint:'24 часа делятся на 12 полок → по 2 часа на каждую.' },
    { id:'sutki-5', theme:'sutki', diff:2,
      text:'Какая ось Суток разделяет день и ночь?',
      options:['0 ↔ 6 (полночь–полдень)','3 ↔ 9','1 ↔ 7','2 ↔ 8'],
      correct:0,
      hint:'Это вертикальная ось Чертежа, разделяющая тёмное и светлое время Суток.' },

    // ── Тема 3: Зерно Познания ───────────────────────────────────
    { id:'zerno-1', theme:'zerno', diff:2,
      text:'Что в Ясне называется «Гранитом Науки»?',
      options:['Твёрдое, проверенное знание корпуса','Учебник по геологии','Каменный памятник','Оценка ученика'],
      correct:0,
      hint:'Гранит Науки — образ незыблемой, проверенной части знания.' },
    { id:'zerno-2', theme:'zerno', diff:1,
      text:'Зерно Познания — это метафора чего?',
      options:['Конца обучения','Начала роста знания','Награды за победу','Денежной единицы'],
      correct:1,
      hint:'Зерно содержит весь рост — нужно лишь «посадить» и поливать вниманием.' },
    { id:'zerno-3', theme:'zerno', diff:3,
      text:'Где обычно «прорастает» Зерно Познания?',
      options:['На крайних полках','В центре Чертежа','В корне Звезды','На антиподах'],
      correct:1,
      hint:'Центр — точка, откуда исходят все лучи и темы.' },
    { id:'zerno-4', theme:'zerno', diff:2,
      text:'Гранит Науки в Ясне противопоставляется чему?',
      options:['Воде','Огню','Зыби, домыслу, неточности','Пустоте'],
      correct:2,
      hint:'Знание противоположно зыбкому, неточному «кажется».' },
    { id:'zerno-5', theme:'zerno', diff:2,
      text:'Какое утверждение о Зерне НЕВЕРНО?',
      options:['Зерно может прорасти','Зерно лежит в основе обучения','Зерно нельзя разделить','Зерно — это начало знания'],
      correct:2,
      hint:'Зерно как раз делится — отсюда и рост многих побегов.' },

    // ── Тема 4: Антиподы ─────────────────────────────────────────
    { id:'antipody-1', theme:'antipody', diff:1,
      text:'Антипод полки 0 в Ясне Суток — это полка…',
      options:['6','3','9','12'],
      correct:0,
      hint:'Антипод — полка ровно напротив на круге, отстоящая на 6 шагов.' },
    { id:'antipody-2', theme:'antipody', diff:1,
      text:'Что такое антипод?',
      options:['Враг','Дубликат','Противоположная полка по оси','Соседняя полка'],
      correct:2,
      hint:'Антипод — полка, симметричная относительно центра Звезды.' },
    { id:'antipody-3', theme:'antipody', diff:2,
      text:'Сколько пар антиподов всего в Ясне Суток?',
      options:['3','4','6','12'],
      correct:2,
      hint:'12 полок ÷ 2 = 6 пар противоположностей.' },
    { id:'antipody-4', theme:'antipody', diff:1,
      text:'Антипод полки 1 — это…',
      options:['5','11','7','13'],
      correct:2,
      hint:'1 + 6 = 7. Каждый антипод отстоит ровно на 6 полок.' },
    { id:'antipody-5', theme:'antipody', diff:2,
      text:'Антиподы используются для…',
      options:['Только эстетики Чертежа','Понимания противоположных смыслов в одной паре','Подсчёта зёрен','Соединения двух Звёзд'],
      correct:1,
      hint:'Каждая пара антиподов — два полюса одного смыслового поля.' },

    // ── Тема 5: Скорпион / Паук ──────────────────────────────────
    { id:'skorpion-1', theme:'skorpion', diff:3,
      text:'Скорпион в Ясне — это…',
      options:['Знак Зодиака на полке 7','Особая точка между полками, мост-связка','Имя главного героя','Время в году'],
      correct:1,
      hint:'Скорпион — особая механика, точка вне регулярных 12 полок.' },
    { id:'skorpion-2', theme:'skorpion', diff:3,
      text:'Паук связан со Скорпионом потому что…',
      options:['Они оба насекомые','Образуют пару особых точек на Чертеже','У них один цвет','Они враги'],
      correct:1,
      hint:'Скорпион и Паук — парные особые механики, дополняющие 12 полок.' },
    { id:'skorpion-3', theme:'skorpion', diff:3,
      text:'Сколько Пауков на Чертеже Суток?',
      options:['4','1','6','12'],
      correct:1,
      hint:'Один Паук — единственная точка такого рода, противоположная Скорпиону.' },
    { id:'skorpion-4', theme:'skorpion', diff:3,
      text:'Что НЕ относится к механике Скорпиона / Паука?',
      options:['Это особые точки','Они нарушают регулярность 12 полок','Они появляются в каждой Ясне (Сутки, Года, Жизни)','Они показаны вне круга'],
      correct:2,
      hint:'Скорпион/Паук — особенность именно Ясны Суток, не во всех Яснах одинаково.' },
    { id:'skorpion-5', theme:'skorpion', diff:3,
      text:'На какой паре полок «работает» Скорпион Суток?',
      options:['7 ↔ 1','0 ↔ 6','3 ↔ 9','5 ↔ 11'],
      correct:0,
      hint:'Скорпион появляется на оси 7↔1, нарушая обычную симметрию антиподов.' },

    // ── Тема 6: Чаши Света/Тьмы ─────────────────────────────────
    { id:'chashi-1', theme:'chashi', diff:2,
      text:'Чаша в Ясне — это образ…',
      options:['Пустого сосуда','Резервуара силы (света или тьмы)','Соревнования','Награды'],
      correct:1,
      hint:'Чаша наполняется силой по мере прохождения полок Суток.' },
    { id:'chashi-2', theme:'chashi', diff:2,
      text:'Когда Чаша Тьмы наполнена максимально?',
      options:['В полночь (полка 0)','В полдень (полка 6)','На рассвете (полка 3)','Никогда полностью'],
      correct:0,
      hint:'Полночь — пик ночи, когда Чаша Тьмы заполнена до краёв.' },
    { id:'chashi-3', theme:'chashi', diff:2,
      text:'Когда Чаша Света наполнена максимально?',
      options:['В полночь','В полдень','Ночью','В сумерках'],
      correct:1,
      hint:'Полдень — зеркальная точка, пик света и наполненности соответствующей Чаши.' },
    { id:'chashi-4', theme:'chashi', diff:1,
      text:'Сколько Чаш в Ясне Суток?',
      options:['Одна (общая)','Две (Света и Тьмы)','Четыре (по сторонам)','Двенадцать (по полкам)'],
      correct:1,
      hint:'Две Чаши — Свет и Тьма — попеременно наполняются и опустошаются за Сутки.' },
    { id:'chashi-5', theme:'chashi', diff:3,
      text:'Чаши заполняются по какому принципу?',
      options:['По мере перехода через полки Суток','Случайно','По воле наблюдателя','Никогда не меняются'],
      correct:0,
      hint:'Каждая полка отдаёт каплю в Чашу: Свет растёт от полночи к полудню, Тьма — наоборот.' },

    // ── Тема 7: Прана и Стихии ───────────────────────────────────
    { id:'prana-1', theme:'prana', diff:1,
      text:'Сколько основных Стихий в Ясне?',
      options:['3','4 (Огонь, Вода, Земля, Воздух)','5','12'],
      correct:1,
      hint:'Четыре Стихии — классическое первоначало, согласованное с четвертями Чертежа.' },
    { id:'prana-2', theme:'prana', diff:2,
      text:'Прана — это…',
      options:['Имя древнего бога','Дыхательный поток / поток жизни','Магическое заклинание','Часть тела'],
      correct:1,
      hint:'Прана пронизывает Чертёж как дыхательная, жизненная сила.' },
    { id:'prana-3', theme:'prana', diff:3,
      text:'Сколько основных Магистралей Праны в Ясне?',
      options:['3','7','12','1'],
      correct:0,
      hint:'Закон Трёх Магистралей — три потока, по которым движется Прана через Чертёж.' },
    { id:'prana-4', theme:'prana', diff:2,
      text:'Какая Стихия НЕ является основной в Ясне?',
      options:['Огонь','Вода','Металл','Воздух'],
      correct:2,
      hint:'Металл — пятый элемент в восточной традиции, не входит в четвёрку Ясны.' },
    { id:'prana-5', theme:'prana', diff:3,
      text:'Стихии связаны с Чертежом по принципу…',
      options:['Каждой стихии — одна полка','Каждой стихии — три полки (тригон)','Стихии вне Чертежа','Стихии случайно распределены'],
      correct:1,
      hint:'Тригон Стихии — три полки, образующие равносторонний треугольник на круге.' },

    // ── Тема 8: Зеркало Девы ─────────────────────────────────────
    { id:'zerkalo-1', theme:'zerkalo', diff:2,
      text:'Зеркало Девы — это…',
      options:['Образ симметрии в Ясне','Реальное зеркало','Знак Зодиака','Имя книги'],
      correct:0,
      hint:'Зеркало — метафора симметричной части Чертежа, отражающей одно через другое.' },
    { id:'zerkalo-2', theme:'zerkalo', diff:3,
      text:'Что отражает Зеркало Девы?',
      options:['Прошлое','Лицо ученика','Симметричную часть Чертежа','Будущие события'],
      correct:2,
      hint:'Через Зеркало Девы видна симметрия — каждая полка имеет своё отражение.' },
    { id:'zerkalo-3', theme:'zerkalo', diff:3,
      text:'Зеркало Девы относится к узлу про…',
      options:['Опорный Крест','Зодиак','Прану и Стихии','Гимны'],
      correct:2,
      hint:'Зеркало — часть учения о Пране, Стихиях и тонком устройстве Чертежа.' },
    { id:'zerkalo-4', theme:'zerkalo', diff:3,
      text:'Зеркало в Ясне — это образ…',
      options:['Двойственности','Самопознания через симметрию','Лжи','Иллюзии'],
      correct:1,
      hint:'Глядя в Зеркало Чертежа, ученик видит и себя, и устройство мира одновременно.' },
    { id:'zerkalo-5', theme:'zerkalo', diff:2,
      text:'Что НЕ относится к Зеркалу Девы?',
      options:['Образ симметрии','Связь с Праной','Связь с торговлей','Отражение'],
      correct:2,
      hint:'Зеркало — про познание и симметрию, не про обмен или коммерцию.' },

    // ── Тема 9: Изумрудная Скрижаль ──────────────────────────────
    { id:'skrizhal-1', theme:'skrizhal', diff:2,
      text:'Сакральные Горы в Ясне — это…',
      options:['Высшие точки Чертежа, ориентиры','Уральские Горы','Ступени иерархии','Имя бога'],
      correct:0,
      hint:'Сакральные Горы — три высших ориентира, видных издалека на Чертеже.' },
    { id:'skrizhal-2', theme:'skrizhal', diff:3,
      text:'Изумрудная Скрижаль — это…',
      options:['Обычная книга','Свод законов / итог корпуса','Артефакт из Толкина','Часть Звезды'],
      correct:1,
      hint:'Скрижаль — итог Ясны Суток, фиксирующий главные законы корпуса.' },
    { id:'skrizhal-3', theme:'skrizhal', diff:3,
      text:'Что говорит Закон Трёх Магистралей?',
      options:['Можно идти только одной дорогой','Прана движется по трём основным потокам','Звезда имеет три луча','Три полки — главные'],
      correct:1,
      hint:'Три потока Праны — закон движения жизненной силы по Чертежу.' },
    { id:'skrizhal-4', theme:'skrizhal', diff:3,
      text:'Сколько Сакральных Гор в Ясне Суток?',
      options:['1','4','3','12'],
      correct:2,
      hint:'Три Сакральные Горы соответствуют Трём Магистралям Праны.' },
    { id:'skrizhal-5', theme:'skrizhal', diff:3,
      text:'Что находится в финале Ясны Суток?',
      options:['Чертёж 144 полок','Только зодиак','Сутки Рыболова — итоговая интеграция','Описание ума'],
      correct:2,
      hint:'«Сутки Рыболова» — финальная глава, где все темы сходятся в единую картину.' },
  ];

  // ═══ ИСТОЧНИК КОНТЕНТА ═════════════════════════════════════════════
  // Если подгружен content.bundle.js (window.YasnaContent) и в нём ≥6 тем
  // и ≥18 single-choice вопросов — переключаемся полностью на новый банк.
  // Иначе работает legacy-хардкод выше (back-compat пока банк наполняется).
  //
  // Это даёт плавный переход: по мере добавления тем T2…T10 в content/,
  // движок автоматически перейдёт на атомизированный контент.
  // ───────────────────────────────────────────────────────────────────
  const NEW = (typeof window !== 'undefined' && window.YasnaContent) || null;
  const NEW_THEMES = NEW?.THEMES || [];
  const NEW_QUESTIONS = NEW?.QUESTIONS || [];
  const NEW_QUESTIONS_FULL = NEW?.QUESTIONS_FULL || [];
  const NEW_ATOMS = NEW?.ATOMS || [];

  // Фильтруем темы: T10 «Сутки Рыболова» помечена themes_in_partia=false
  // (финальный обзор, не самостоятельная тема для партии).
  const NEW_THEMES_FOR_PARTIYA = NEW_THEMES.filter(t => t.includeInPartiya !== false);

  const useNew = NEW_THEMES_FOR_PARTIYA.length >= 6 && NEW_QUESTIONS.length >= 18;

  // ─── Гибрид: новые вопросы подмешиваются к legacy-темам по slug ───
  // Цель: пока банк маленький, не терять новые типы вопросов (true-false,
  // fill-blank). Они мерджатся в legacy QUESTIONS под legacy theme id, если
  // совпадают слаги (например, T1 «chto-est-yasna» → legacy 'gimny' через
  // дополнительный мап). Это временно, пока useNew=false.
  const SLUG_TO_LEGACY = {
    'chto-est-yasna': 'gimny',
    // следующие пустые — заполнить когда T2-T10 наполнятся:
    'opisanie-sutok': 'sutki',
    'granit-nauki': 'zerno',
    'osi-kresty': 'antipody'
  };

  let MERGED_QUESTIONS = QUESTIONS;
  if(!useNew && NEW_QUESTIONS.length > 0){
    const remapped = NEW_QUESTIONS.map(q => {
      const legacyTheme = SLUG_TO_LEGACY[q.theme];
      return legacyTheme ? { ...q, theme: legacyTheme } : null;
    }).filter(Boolean);
    if(remapped.length > 0){
      MERGED_QUESTIONS = [...QUESTIONS, ...remapped];
    }
  }

  // Для партии используем фильтрованный список (без T10).
  // Все темы доступны через getAllThemes() для UI / Партитуры.
  const ACTIVE_THEMES = useNew ? NEW_THEMES_FOR_PARTIYA : THEMES;
  const ACTIVE_QUESTIONS = useNew ? NEW_QUESTIONS : MERGED_QUESTIONS;

  if(NEW){
    console.log('[YasnaTrivia] Контент-bundle:',
      NEW.buildInfo?.themes, 'тем,',
      NEW.buildInfo?.questionsTotal, 'вопросов (legacy-conv:',
      NEW.buildInfo?.questionsLegacy + ').',
      useNew
        ? 'Используется новый банк полностью.'
        : 'Hybrid: legacy + ' + (MERGED_QUESTIONS.length - QUESTIONS.length) + ' новых вопросов.'
    );
  }

  // ─── API ────────────────────────────────────────────────────
  function getThemes(){ return ACTIVE_THEMES; }
  function getTheme(id){ return ACTIVE_THEMES.find(t => t.id === id); }
  function getQuestionsForTheme(themeId){ return ACTIVE_QUESTIONS.filter(q => q.theme === themeId); }
  function getAllQuestions(){ return ACTIVE_QUESTIONS; }

  // Атомы и расширенный банк — только из нового контента, для будущего движка
  function getAtoms(){ return NEW_ATOMS; }
  function getQuestionsFull(){ return NEW_QUESTIONS_FULL; }

  // Конфигурация по режимам — длительность партии
  const MODE_CONFIG = {
    blitz:    { themes: 5, qPerTheme: 2 },  // 10 вопросов · ~2 мин
    standard: { themes: 6, qPerTheme: 3 },  // 18 вопросов · ~5 мин
    expert:   { themes: 6, qPerTheme: 5 }   // 30 вопросов · ~9 мин
  };

  // ─── Anti-repeat: история показанных вопросов ────────────────────
  // localStorage key: yasna_seen_questions = { qId: timestampMs }
  // TTL: 30 дней. Окно anti-repeat — последние ~3 партии × ~18 = 50 qId.
  // При построении партии исключаем qId которые видели за последние N часов
  // (mode-зависимо). Если после фильтра пул < нужного — расширяем окно.
  const SEEN_KEY = 'yasna_seen_questions';
  const SEEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;          // 30 дней
  const ANTI_REPEAT_WINDOW_MS = {
    blitz:    2 * 60 * 60 * 1000,    // 2 часа — Блиц короткий, ок повторам быстрее
    standard: 12 * 60 * 60 * 1000,   // 12 часов
    expert:   24 * 60 * 60 * 1000    // 24 часа — Эксперт хочет максимум разнообразия
  };

  function loadSeen(){
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if(!raw) return {};
      const parsed = JSON.parse(raw);
      // Чистим устаревшие записи
      const now = Date.now();
      let dirty = false;
      for(const k in parsed){
        if(now - parsed[k] > SEEN_TTL_MS){ delete parsed[k]; dirty = true; }
      }
      if(dirty){ try { localStorage.setItem(SEEN_KEY, JSON.stringify(parsed)); } catch(_){} }
      return parsed;
    } catch(_){ return {}; }
  }

  function markSeen(qIds){
    try {
      const seen = loadSeen();
      const now = Date.now();
      for(const id of qIds){ if(id) seen[id] = now; }
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch(_){}
  }

  // Случайный набор для партии.
  // mode: 'blitz' | 'standard' | 'expert' — длительность
  // themesFilter: null (все) или массив theme.id (кастомный набор)
  function generatePartiya(seed, mode, themesFilter){
    const cfg = MODE_CONFIG[mode] || MODE_CONFIG.standard;
    const seen = loadSeen();
    const win = ANTI_REPEAT_WINDOW_MS[mode] || ANTI_REPEAT_WINDOW_MS.standard;
    const cutoff = Date.now() - win;
    const isFresh = (qId) => !seen[qId] || seen[qId] < cutoff;

    const rng = seedRandom(seed || Date.now());
    // Если задан кастомный набор тем — фильтруем
    const eligibleThemes = themesFilter
      ? ACTIVE_THEMES.filter(t => themesFilter.includes(t.id))
      : ACTIVE_THEMES;
    const shuffled = [...eligibleThemes].sort(() => rng() - 0.5);
    const chosen = shuffled.slice(0, cfg.themes);

    const partiya = chosen.map(theme => {
      const themeQs = ACTIVE_QUESTIONS.filter(q => q.theme === theme.id);
      // Сначала берём только свежие, если их достаточно
      const fresh = themeQs.filter(q => isFresh(q.id));
      const shFresh = [...fresh].sort(() => rng() - 0.5);
      let picked = shFresh.slice(0, cfg.qPerTheme);
      // Если свежих мало — добиваем из всего пула (исключая уже выбранные)
      if(picked.length < cfg.qPerTheme){
        const fallback = themeQs.filter(q => !picked.find(p => p.id === q.id));
        const shAll = [...fallback].sort(() => rng() - 0.5);
        picked = [...picked, ...shAll.slice(0, cfg.qPerTheme - picked.length)];
      }
      return { theme, questions: picked };
    });

    // Помечаем все выбранные qId как «показанные»
    const allIds = partiya.flatMap(r => r.questions.map(q => q.id));
    markSeen(allIds);

    return partiya;
  }

  function seedRandom(seed){
    let x = seed;
    return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  }

  window.YasnaTrivia = {
    THEMES: ACTIVE_THEMES,
    QUESTIONS: ACTIVE_QUESTIONS,
    getThemes, getTheme, getQuestionsForTheme, getAllQuestions, generatePartiya,
    // расширенный API (новый контент)
    getAtoms, getQuestionsFull,
    MODE_CONFIG,
    // флаг для UI: показывать ли «Атомизированный контент» индикатор
    isUsingNewBank: useNew,
    contentVersion: NEW?.version || 'legacy-1.0'
  };
})();
