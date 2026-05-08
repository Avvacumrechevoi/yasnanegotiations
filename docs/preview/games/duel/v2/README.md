# Trivia-bank v2 · контент из дерева

Параллельная версия `trivia-bank.js`, которая загружает реальный контентный фундамент из `content/sutki/99_СВОДКА.json` вместо хардкоженных вопросов.

## Что меняется

| | v1 (текущий продакшн) | v2 (эта папка) |
|---|---|---|
| Источник вопросов | Хардкод в `trivia-bank.js` (~700 строк) | `content/sutki/99_СВОДКА.json` (249 KB) |
| Адаптируемых вопросов | ~45 | **47** (single-choice 45 + true-false 2) |
| Цитаты-первоисточники | нет | **126** с № пункта и стр. PDF |
| Метаданные доступны | нет | глоссарий 160 терминов · 39 иллюстраций · 63 связи · 179 keystone |
| Размер `trivia-bank.js` | ~700 строк | ~150 строк (тонкий адаптер) |
| Обновление контента | git-релиз | подмена JSON-файла |

> **Важно:** v2 пока конвертирует только `single-choice` и `true-false`. Остальные 4 типа вопросов (multi-choice, fill-blank, match-pair, order — это 79 вопросов) в дереве есть, но требуют новых UI-компонентов в `turnir-engine.js`. Это следующий шаг (v3).

## Структура файлов

```
games/duel/
├── trivia-bank.js        ← v1, продакшн (НЕ ТРОГАТЬ)
├── turnir-engine.js
├── duel-page.js
├── duel-page.css
├── content/sutki/...     ← контентное дерево (общее для v1 и v2)
└── v2/                   ← эта папка
    ├── trivia-bank.js    ← новый адаптер
    ├── duel.html         ← тестовая страница
    └── README.md         ← этот файл
```

## Как протестировать

### Локально

```bash
cd docs/preview
python3 -m http.server 8000
```

Открыть в браузере:
- **v1 продакшн:** `http://localhost:8000/duel.html`
- **v2 preview:** `http://localhost:8000/games/duel/v2/duel.html`

В правом верхнем углу v2-страницы — оранжевый бейдж `v2 · контент из дерева`.

### В консоли браузера

После загрузки страницы:

```js
// Проверка что банк загружен
window.YasnaTrivia.version          // "v2"
window.YasnaTrivia.loaded            // true

// Сколько вопросов адаптировано
window.YasnaTrivia.getAllQuestions().length    // 47

// Доступ к расширенному API
window.YasnaTrivia.v2.summary.totals
// → { atoms: 324, questions: 126, keystone_atoms: 178, ... }

// Поиск термина в глоссарии
window.YasnaTrivia.v2.findTerm('Ясна')
// → { term: 'Ясна', definitions: [{atom_id: 'T1.K1.A1', kind: 'definition', quote_short: '...'}, ...]}

// Иллюстрации темы T7 (Храм)
window.YasnaTrivia.v2.getIllustrations('T7')
// → 6 иллюстраций V-031, V-032, V-033, V-034, V-035, V-036
```

## API совместимости

Старый turnir-engine.js работает без изменений потому что v2 экспортирует тот же интерфейс:

```js
window.YasnaTrivia = {
  THEMES,                       // массив тем (для случайной выборки в Партию)
  QUESTIONS,                    // словарь themeId → [вопросы]
  getThemes(),                  // → THEMES
  getTheme(id),                 // → одна тема
  getQuestionsForTheme(id),     // → вопросы темы
  getAllQuestions(),            // → все вопросы
  generatePartiya(seed),        // → 6 тем × 3 вопроса
  // НОВОЕ в v2:
  v2: { summary, keystoneAtoms, illustrations, glossary, links, findTerm, getLinks, getIllustrations }
};
```

Поле `correct` теперь индекс (как ждёт движок), а не строка. Конвертация делается в адаптере `adaptQuestion()`.

## Дальнейшие шаги

- **v2.1** — добавить адаптацию `multi-choice` (12 вопросов) и `fill-blank` (31 вопрос). Для fill-blank нужно расширить движок: input-поле и нормализация ответа через `correct_alternatives`.
- **v2.2** — `match-pair` (25 вопросов) и `order` (3 вопроса) — нужны drag-and-drop UI.
- **v2.3** — экран «Объяснение» после ответа: показ цитаты `explanation.quote` с источником `explanation.source`. Превращает квиз в учебник.
- **v2.4** — иллюстрации в вопросах: подключить `illustrations_index` к вопросам через `references_illustration`.
- **v2.5** — % освоения по `atoms` вместо абстрактных «бусин» в Партитуре.

После того как v2 устаканится в продакшене — переименовать v1 → `legacy/`, v2 → `games/duel/`, удалить дублирование.

## Что дальше прямо сейчас

Если v2-страница загружается и Партия играется — можно копировать в прод:

```bash
cp docs/preview/games/duel/v2/* docs/games/duel/v2/
```

Или раскатать через смену пути в основном `duel.html` — заменить
```html
<script src="games/duel/trivia-bank.js"></script>
```
на
```html
<script src="games/duel/v2/trivia-bank.js"></script>
```

При этом `turnir-engine.js`, `duel-page.js` и весь UI остаются прежними. Контент станет богаче автоматически.
