# Tour Engine — архитектура и API

Универсальный интерактивный гид для любой Ясны. Файловая структура:

```
docs/preview/tours/
├── engine.js        — generic GuideRunner (рендер + анимация + UX)
├── tour-sutok.js    — контент для Ясны Суток
├── tour-atm.js      — контент для Ясны Атмосферных явлений
└── README.md        — этот файл
```

## Принципы изоляции

1. **Engine ничего не знает о конкретных Яснах.** Он принимает tour-config и рендерит его.
2. **Контент полностью отделён от движка.** Каждый `tour-*.js` — самостоятельный файл, регистрирующий config через `window.YasnaTours.register(name, config)`.
3. **Один accent на весь тур.** Цветовая палитра задаётся ОДНИМ значением `tour.accent`. Engine использует opacity и размер для иерархии.
4. **Storytelling-first.** Текст течёт абзацами, синхронизирован со stages анимации.
5. **Auto-scroll.** Панель сама подъезжает к новому абзацу.
6. **Deep-link.** URL hash `#tour=<id>&step=<n>` сохраняет позицию.
7. **Reset on close.** При закрытии hash чистится, состояние сбрасывается.

## Public API

```js
// Регистрация тура
window.YasnaTours.register('Имя Ясны', config);

// Метаданные
window.YasnaTours.version;          // '2.0.0'
window.YasnaTours.speed;             // 2.0 (мн-ль авто-прокрутки)
window.YasnaTours.list();           // ['Атмосферных явлений', 'Суток', ...]
window.YasnaTours.has(name);        // true/false
window.YasnaTours.get(name);        // config или undefined

// Валидация
window.YasnaTours.validate(config); // [] или ['errors']

// Компонент-runner (использует app.js)
React.createElement(window.YasnaTours.GuideRunner, {
  tour: window.YasnaTours.get(name),
  yasnaTpl: T.find(t=>t.n===name),
  onClose: ()=>setShowTour(false),
  onLoadYasna: ()=>load(tpl),
});
```

## Tour Config Schema

```js
{
  id: 'sutki',                  // [required] уникальный id для URL hash
  accent: '#d4a574',            // [optional] единый акцент для всего тура

  source: {                     // [optional] карточка источника во вступлении
    ref: 'Ясна Суток',
    desc: '12 Полок · 4 опоры · 13 механик',
  },

  intro: {                      // [required] вступительный экран (stepIdx === -1)
    title: 'Сутки — корень всего',
    subtitle: '...',
    lead: '...',                // основной абзац
    duration: 7000,             // ms (без множителя SPEED)
    checkpoints: [              // [optional] список «что увидим»
      'Сначала разберём...',
      'Потом — четыре опоры...',
    ],
  },

  steps: [                      // [required] массив шагов (stepIdx 0..N-1)
    {
      id: 'support',            // [required] id шага
      node: 'Закон 1 · Опорный Крест',  // [optional] подзаголовок-маркер
      title: 'Опорный Крест',
      subtitle: '...',

      // Анимация на канвасе — последовательная подсветка/механики
      stages: [
        { at: 0,    hl: null,         af: [],          note: 'Чистый круг' },
        { at: 2500, hl: [0],          af: [],          note: 'Ночь' },
        { at: 5500, hl: [0, 6],       af: [],          note: 'День' },
        { at: 11500,hl: [0,3,6,9],    af: ['support'], note: 'Крест собран' },
      ],

      // Storytelling-абзацы. Каждый появляется в свой момент.
      narrative: [
        { stageIdx: 0, text: 'Возьмём первый закон. Спроси себя...' },
        { stageIdx: 1, text: 'Сначала — Ночь...' },
        { stageIdx: 4, text: 'И четвёртая — Вечер.' },
        // commentary после всех stages с offset
        { stageIdx: 4, offset: 4000, text: 'Главное...', kind: 'key' },
        { stageIdx: 4, offset: 8500, text: 'Не путай...', kind: 'caveat' },
        { stageIdx: 4, offset: 13000, text: 'Дальше — что между опорами?', kind: 'bridge' },
      ],

      // [optional] кросс-ссылки на другие шаги (рендерятся как кнопки-чипы)
      crossRefs: [
        { id: 'opp', note: 'Их противоположности' },
        { id: 'pranas', note: 'Их праны' },
      ],

      totalDuration: 30000,     // ms полного шага (без множителя SPEED)
    },
    // ...
  ],

  outro: {                      // [required] завершающий экран (stepIdx === N)
    title: 'Ясна собрана',
    body: '...',
    cta: 'Перейти к Ясне',     // [optional] подпись CTA-кнопки
    af: [...],                  // [optional] финальный набор механик
    summary: [                  // [optional] чек-лист итогов
      'Опорный Крест: ...',
      '4 праны: ...',
    ],
  },
}
```

## Narrative kinds (визуальные стили)

| `kind` | Применение | Визуал |
|---|---|---|
| (нет) | основной абзац | Обычный текст |
| `key` | главная мысль | Жирнее, левая полоса accent |
| `note` | пояснение | Курсив, opacity .62 |
| `caveat` | антипаттерн | Левая граница, лейбл «Важно не путать» |
| `quote` | прямая цитата | Курсив на surface-фоне |
| `mnemonic` | школьная фраза | Тёплая пунктирная рамка, лейбл «Запомни» |
| `bridge` | связка к следующему | Сверху пунктирная разделительная линия |

## Stages (анимация Ясны)

Stage = {at: ms-от-старта-шага, hl: [полки], af: [механики], note?: 'caption'}

- `hl` — массив индексов полок 0-11, которые подсветить (engine добавляет spotlight-маску)
- `af` — массив id механик из FL (отображаются на круге как обычно)
- `note` — короткая подпись над прогресс-точками (опц.)

## Stage ↔ Narrative синхронизация

Каждый narrative-абзац может быть привязан к stage по индексу:

```js
{ stageIdx: 1, text: '...' }  // появится когда сработает stages[1]
{ stageIdx: 1, offset: 2000, text: '...' }  // через 2с после stages[1]
```

Это гарантирует, что когда абзац говорит «Ночь — точка покоя», полка 0 одновременно светится.

## Как добавить тур для новой Ясны

1. Создай файл `tour-NAME.js` в `docs/preview/tours/`
2. Зарегистрируй tour-config через `window.YasnaTours.register('Имя Ясны', {...})`
3. Подключи скрипт в `index.html` после `tours/engine.js`
4. Кнопка «✦ Гид по Ясне» появится автоматически в шапке когда выбрана эта Ясна

Никаких изменений в `engine.js` или `app.js` не требуется.

## Управление и навигация

- **←/→ или Пробел** — следующий шаг анимации (внутри шага), потом следующий шаг
- **Esc** — закрыть гид (сбрасывает состояние и URL hash)
- **Кликабельные точки прогресса** — прыжок на конкретный шаг
- **Кнопки внизу** — Назад / Пауза/Авто / Дальше
- **`window.YasnaTours.speed = X`** — изменить скорость авто-прокрутки (default 2.0)

## Версионирование

`window.YasnaTours.version` — текущая версия движка. Семантически совместимые
изменения (добавление полей в config) — minor. Несовместимые (удаление полей,
изменение типов) — major.
