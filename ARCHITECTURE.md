# Архитектурный аудит yasnanegotiations

Обновлён: 2026-05-07 · ветка `main` · текущий коммит preview/prod в синхроне.

## 1. Структура репозитория

```
docs/                          ← prod (https://avvacumrechevoi.github.io/yasnanegotiations/)
├── index.html                 — подключает CDN React + babel + локальные скрипты
├── styles.css                 — глобальные стили + breakpoints
├── app.js                     — главный <App> (1042 строки)
├── core/
│   ├── data.js                ★ NEW — все константы (T, FL, CR, PR, GLOSS, ...) + helpers геометрии
│   └── yasna-star.js          — Star, Info, Editor, Picker, OverlayPicker, OverlayLegend, Verification, Yasna3DView (2492 строки)
├── lessons/                   — модульная система уроков (engine.js + lesson-*.js)
└── tours/                     — модульная система гидов (engine.js + tour-*.js)

docs/preview/                  ← staging (та же структура, обновляется первой, мирится через cp)
```

**Принцип деплоя:** все правки идут в `docs/preview/` → smoke-test на превью → синхрон в `docs/` (prod) через `cp`.

## 2. Слоистая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 4 — Туры и уроки (per-yasna контент)                      │
│   tours/tour-sutok.js · tour-goda.js · tour-zhizni.js · ...     │
│   lessons/lesson-1-…js · lesson-2-…js · ...                     │
│   • Регистрация в реестры через window.YasnaTours.register()    │
└─────────────────────────────────────────────────────────────────┘
                           ↑ потребляет
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3 — Движки                                                │
│   tours/engine.js   — GuideRunner: рендер шагов, narrative,     │
│                       автоскролл, sticky-mobile, swipe          │
│   lessons/engine.js — LessonPlayer: сцены, навигация            │
└─────────────────────────────────────────────────────────────────┘
                           ↑ использует
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2 — Компоненты (UI)                                       │
│   <App> (app.js)    — оркестратор, layout, фильтры, drill, режимы│
│   <Star>            — 2D SVG-диаграмма Ясны (12-полочная)       │
│   <Yasna3DView>     — 3D через Three.js (sphere + bipyramids)   │
│   <Info>            — карточка выбранной полки                  │
│   <Editor>          — редактирование шаблона                    │
│   <Picker>          — выбор Ясны (закреплённые + все)           │
│   <OverlayPicker>   — выбор второй Ясны для overlay-сравнения   │
│   <Verification>    — Express + Полная проверка Ясны            │
└─────────────────────────────────────────────────────────────────┘
                           ↑ читает
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1 — Данные и геометрия                                    │
│   core/data.js      ★ window.YasnaData = {                      │
│                          T (60+ шаблонов Ясн),                  │
│                          FL (18 механик),                       │
│                          CR (3 креста), PR (4 праны),           │
│                          COMP (4-стихийная композиция),         │
│                          POS_DESC[12] · CROSS_CTX · PRANA_CTX · │
│                          OPP_DESC, GLOSS,                       │
│                          gc/gp/opp/angDeg/rad/xy (геометрия)    │
│                        }                                        │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Контракты (для дальнейшей работы)

### `window.YasnaData` (core/data.js)

| ключ | тип | смысл |
|---|---|---|
| `T` | array | 60+ шаблонов Ясн `{id, n, p[12], rubrik?, starter?, verified?, th?/bh?/lh?/rh?, custom?}` |
| `FL` | array | 18 механик `{id, l, c, p[]?, g, related?, questions?, mistakes?}` |
| `CR` | object | 3 креста: `support`/`right`/`left` → `{n, p[], c, v, questions, mistakes, related}` |
| `PR` | object | 4 праны: `she`/`fo`/`tsi`/`ha` → `{n, p[3], c, el, ...}` |
| `COMP` | array | 12 строк ×4 колонки — % смеси стихий по полкам |
| `COMP_COLORS`/`COMP_NAMES` | array | `['Земля','Вода','Воздух','Огонь']` + цвета |
| `POS_DESC` | array[12] | развёрнутые описания каждой позиции |
| `CROSS_CTX` | object | контекст-описание полок по принадлежности к крестам |
| `PRANA_CTX` | object | контекст-описание для каждой праны |
| `OPP_DESC` | object | контекст для противоположных пар (0↔6, 1↔7, ...) |
| `GLOSS` | array | глоссарий с `what/why/how/apply/example/questions/mistakes/related` |
| `gc(i)` | helper | какой крест у полки `i`: `'support'\|'right'\|'left'` |
| `gp(i)` | helper | какая прана у полки `i`: `'she'\|'fo'\|'tsi'\|'ha'` |
| `opp(i)` | helper | противоположная полка: `(i+6)%12` |
| `angDeg(i)` | helper | угол полки в градусах |
| `rad(d)` | helper | градусы→радианы |
| `xy(i,cx,cy,r)` | helper | координата полки на круге радиуса `r` |

### `window.YasnaCore` (core/yasna-star.js)
Реэкспортирует данные + компоненты:
```
{ CR, PR, REF, T, FL, POS_DESC, CROSS_CTX, PRANA_CTX, OPP_DESC, GLOSS,
  Star, Info, Editor, Picker, OverlayPicker, OverlayLegend, Verification, Yasna3DView }
```

### `window.YasnaTours` (tours/engine.js)
```
register(name, config)        — регистрирует тур
has(name) → bool
get(name) → config
list() → [name]
validate(config) → [errors]
GuideRunner — React-компонент, читает по hash-маршруту #tour=ID
```

### `window.YasnaLessons` (lessons/engine.js)
Аналогично турам, но для пошаговых уроков.

## 4. Технический долг (priorities)

| # | Проблема | Где | Сложность | Приоритет |
|---|---|---|---|---|
| 1 | ~~`yasna-star.js` 2859 строк, смешаны 8+ компонентов~~ ★ Шаг 1 сделан: данные вынесены в `core/data.js` (-367 строк) | done | — | ✅ |
| 2 | Следующий шаг — вынести `Yasna3DView` + sprite helpers в `core/yasna-3d.js` (~1050 строк, изолирован) | `yasna-star.js` 1441–2486 | средняя | P1 |
| 3 | Затем — `Verification` в `core/verification.js` (~495 строк, чистый компонент) | `yasna-star.js` 945–1437 | низкая | P1 |
| 4 | `app.js` 1042 строки с inline-styles и большим state | `app.js` | средняя | P2 |
| 5 | Inline styles повсеместно — почти всё через `style={{...}}` | везде | долгая мигра | P3 |
| 6 | Тестов нет совсем | — | средняя | P1 |
| 7 | localStorage без миграций — формат `yasna2_subdata` | `app.js` | низкая | P2 |
| 8 | Babel-standalone в браузере — медленный first-paint | `index.html` | большая | P3 |
| 9 | Tour `tour-atm.js` использует старую schema (hook/body/bullets), новые туры — stages+narrative | `tours/tour-atm.js` | низкая | P2 |
| 10 | Дублирование `docs/` и `docs/preview/` — синхрон руками через `cp` | весь репо | средняя | P2 |

## 5. Roadmap расщепления `core/yasna-star.js`

Текущий размер после шага 1: **2492 строки** (было 2859).

| # | Что вынести | Куда | Эффект | Риск |
|---|---|---|---|---|
| 1 ✅ | Данные (T/FL/CR/PR/COMP/POS_DESC/...) + helpers | `core/data.js` | 2859 → 2492 (-367) | низкий, выполнено |
| 2 | `Yasna3DView` + makeTextSprite/makeLabelSprite/makeDigitSprite | `core/yasna-3d.js` | 2492 → ~1440 строк | средний (Three.js, лотс state) |
| 3 | `Verification` | `core/verification.js` | ~1440 → ~945 строк | низкий (изолированный) |
| 4 | `Editor`/`Picker`/`OverlayPicker`/`OverlayLegend` | `core/dialogs.js` | ~945 → ~645 строк | низкий |
| 5 | `Info` | `core/info-card.js` | ~645 → ~355 строк | низкий |
| 6 | финал: `core/yasna-star.js` содержит ТОЛЬКО `<Star>` | — | ~355 строк | — |

После всех шагов:
```
core/
├── data.js          ~410 строк  (данные + геометрия)
├── yasna-star.js    ~360 строк  (только <Star>)
├── yasna-3d.js     ~1050 строк  (3D-вид + sprites)
├── verification.js  ~500 строк  (Express + Полная проверка)
├── info-card.js     ~290 строк  (карточка полки)
└── dialogs.js       ~300 строк  (Editor/Picker/OverlayPicker)
```

Каждый файл ≤ 1100 строк. `index.html` подгружает их в порядке зависимостей.

## 6. Контрольные точки регрессии

После каждого расщепления проверять:
1. Ясна Суток отрисовалась — 12 полок, цифры, подписи
2. Клик на полку — Info-карточка открылась
3. Включить механику (Опорный крест) — overlay появился
4. Перейти в 3D — сфера + биполярные конусы
5. Включить вращение — плавно крутится без мерцания
6. Drill-down (Ясна²) — клик на сектор открывает sub-Ясну
7. Гид → Ясна Суток — все 14 шагов прокручиваются
8. Мобильная версия (380×760) — sticky-диаграмма, нет пустых зон
9. Проверка → Express — все 7 правил работают

## 7. Соглашения для дальнейшей работы

- **Не плодить inline-стили** в новых компонентах. Использовать CSS classes из `styles.css` или CSS variables.
- **Каждый новый компонент** живёт в своём файле, регистрируется в `window.YasnaCore` или соответствующий реестр.
- **Каждый новый шаблон Ясны** — добавить в `core/data.js#T`, при необходимости подвязать к гиду в `tours/`.
- **Каждая новая механика** — добавить в `core/data.js#FL`, добавить рендер в `<Star>` и обработку в `<App>`.
- **`docs/preview/` → `docs/`** — после превью-теста синхронизировать одинаковым файловым составом (`cp`) и пушить одним коммитом.
- **Mobile-first проверка**: все правки UI должны быть проверены на ≤768px ДО синка в prod.

## 8. Текущее состояние после рефакторинга 2026-05-07

- ✅ Mobile-фиксы гида (bubble pill, sticky-aware autoscroll, h2 не уезжает)
- ✅ Desktop-bump font sizes ×1.18 после расширения viewBox
- ✅ `lpsRot` увеличен до `lr+32` на десктопе чтобы подписи не лезли на цифры при вращении
- ✅ Шаг 1 расщепления: данные вынесены в `core/data.js`, `yasna-star.js` -367 строк
