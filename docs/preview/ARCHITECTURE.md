# Архитектурный аудит yasnanegotiations

Дата: 2026-05-06 · ветка: main · последний коммит preview: 7cc995d

## 1. Структура репозитория

```
docs/                  ← prod (https://avvacumrechevoi.github.io/yasnanegotiations/)
├── app.js             — главный компонент <App>
├── styles.css
├── index.html         — подключает CDN React + babel + локальные скрипты
├── core/yasna-star.js — Star, Yasna3DView, Info, Verification, FL, T, GLOSS
├── lessons/           — модульная система уроков
└── tours/             — модульная система гидов (engine + per-yasna)

docs/preview/          ← staging (та же структура, обновляется первой)
```

**Принцип:** все правки идут в `docs/preview/` сначала, тестируются, затем
синхронизируются в `docs/` (prod). Mirror через `cp -r`.

## 2. Текущее состояние (после 7cc995d)

### Сильные стороны

- **Модульность гидов и уроков** — каждый гид/урок отдельный файл, регистрация
  через `window.YasnaTours.register()` и `window.YasnaLessons.register()`.
- **Чёткие brand colors** — `--bg`, `--bg2`, `--txt`, `--txt2`, `--border` в CSS variables.
- **3 брейкпоинта layout** — ≥1280 flex-сосед / 1024-1279 overlay / <1024 bottom-sheet.
- **Все 14 механик гейтятся** — каждая через `af.includes('id')` без false-positive.
- **2D и 3D режимы** живут параллельно, переключение через `setIs3D`.
- **Drill-down Ясна²** — drill-bar + sub-полки с persist в localStorage.

### Технический долг (prioritized)

| # | Проблема | Приоритет | Где | Решение |
|---|---|---|---|---|
| 1 | `core/yasna-star.js` — 2712 строк, смешаны 8+ компонентов и константы | P1 | `core/yasna-star.js` | Разбить: `data/templates.js`, `data/mechanics.js`, `data/glossary.js`, `components/Star.js`, `components/Info.js`, `components/Yasna3DView.js`, `components/Verification.js` |
| 2 | `app.js` — 1000 строк с inline-styles и много локального state | P2 | `app.js` | Вытащить `<Picker>`, `<Editor>`, `<OverlayPicker>` в отдельные файлы |
| 3 | Inline styles повсеместно — почти всё через `style={{...}}`, не через CSS classes | P2 | везде | Постепенно мигрировать в `styles.css` — упростит a11y и hover-states |
| 4 | Тестов нет вообще | P1 | — | Добавить минимум: snapshot-тесты Star, smoke-тесты Tour engine |
| 5 | Auto-collapse side-panel при открытии popover механик — пока только CSS-класс, JS не выставляется | P2 | `app.js` | Добавить `<div className={'app-body' + (filtersOpen?' mech-popover-open':'')}>` |
| 6 | Babel-standalone в браузере — медленный first-paint | P3 | `index.html` | На v2.x перейти на pre-build с esbuild/vite |
| 7 | localStorage без миграций — при изменении формата `yasna2_subdata` пользовательские данные могут поломаться | P2 | `app.js`, `lessons/` | Ввести `localStorage version key` и migrate-функции |
| 8 | Tour `tour-atm.js` использует старую schema (hook/body/bullets), `tour-sutok.js` — новую (stages+narrative). Engine fallback есть, но это hack | P2 | `tours/` | Переписать `tour-atm.js` на новую schema |

## 3. Ключевые контракты (для дальнейшей работы)

### `window.YasnaTours`
```js
register(yasnaName, { intro, steps, version, speed })
has(yasnaName) → boolean
get(yasnaName) → tour config
list() → [yasnaName]
validate(config) → { ok, errors }
```

### `window.YasnaLessons`
```js
register(lessonId, { title, scenes, ... })
has(lessonId) → boolean
list() → [{id, title}]
```

### Star props
`yy, sel, onSel, hl, af=[], showOpp, overlay, mob, drill, onDrill, subPolki, starRotation, rotationSpeed`

### Info props
`i, p, af=[], y={}, overlay=null, onEdit, onClose`

### Yasna3DView props
`y, af, sel, onSel, rotationOn, speedSec, drill, onDrill, subPolki`

## 4. Глобальные данные (в `core/yasna-star.js`)

- `T[]` — 60+ шаблонов Ясн (id, n, p[12], rubrik, starter, verified, th/bh/lh/rh)
- `FL[]` — 18 механик (id, l, c, p[]?, g, related?, questions?, mistakes?)
- `CR{}` — 3 креста (support/right/left)
- `PR{}` — 4 праны (she/fo/tsi/ha)
- `GLOSS[]` — глоссарий
- `MECHANICS_DOCS[]` — расширенная документация механик
- `REF[]`, `POS_DESC[]`, `OPP_DESC[]`, `PRANA_CTX{}`, `CROSS_CTX{}` — справочные тексты

## 5. Чек-лист для следующих доработок

- [ ] Auto-collapse side-panel на планшете при открытии popover механик (JS-связка)
- [ ] FAB «+ Создать» на mobile (Спринт 4 plan)
- [ ] Полный fullscreen-modal для popover механик на mobile (вместо bottom-sheet)
- [ ] Mobile tabs — fade-края для индикации горизонтального скролла
- [ ] Burger-меню — пересобрать с группировкой (Уроки/Гид/Проверка → Помощь)
- [ ] Разбить `yasna-star.js` на модули (см. долг #1)
- [ ] Тесты на gating всех 14 механик
- [ ] Переписать `tour-atm.js` на новую schema stages+narrative
- [ ] localStorage versioning (см. долг #7)

## 6. Workflow для следующих правок

1. Все изменения → `docs/preview/`
2. Локально протестировать (открыть `docs/preview/index.html` в браузере)
3. Коммит в `main` с префиксом `preview-only:` или `fix(preview):`
4. После проверки — синхронизация в `docs/` через
   `cp docs/preview/{app.js,styles.css} docs/ && cp docs/preview/core/yasna-star.js docs/core/`
5. Коммит с префиксом `prod:` или `deploy:`
6. Push origin/main → GitHub Pages автоматически

## 7. Точки входа для новых разработчиков

- **Добавить новую механику** → `FL[]` в `core/yasna-star.js:93` + render-секция в Star
- **Добавить новую Ясну** → `T[]` в `core/yasna-star.js:41`
- **Добавить новый гид** → создать `tours/tour-NAME.js`, зарегистрировать через `window.YasnaTours.register('Имя Ясны', config)`, подключить в `index.html`
- **Добавить урок** → создать `lessons/lesson-NAME.js`, зарегистрировать в `lessons-index.js`
- **Поменять стилистику** → `styles.css` (CSS vars в `:root`)
