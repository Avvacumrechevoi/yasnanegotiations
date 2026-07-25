# NOTES — Тренажёр переговоров «Вход в контакт» (рабочая заметка)

Последнее: 13.06.2026, commit `08a2bd2` (запушен в main, на проде).
Раздел изолированный: `docs/negotiations.html` (vanilla JS, НЕ в esbuild-бандле).
Заход с главной игры — карточка «Переговоры» (`.dp-game-card--neg`) в `DPMainGames` → `negotiations.html`.

## 1) Что уже сделано
- Секция `#contact` в `negotiations.html` переделана в **две вкладки Теория / Практика**:
  - `.neg-c-tabs` с кнопками `[data-tab="theory"]` и `[data-tab="practice"]`;
  - панель `#neg-c-pane-theory` (4 карточки типов в `#neg-types-root` + кнопка `#neg-c-to-practice`);
  - панель `#neg-c-pane-practice` (`hidden`) со сценарием в `#neg-contact-root`.
- Логика табов — `setupTabs()` в `docs/negotiations/contact-trainer.js`:
  - `show(name)` тогглит `.is-active` на табах и `hidden` на панелях, пишет `localStorage['yasna_negc_tab']`;
  - дефолт: новичок (`prog.sessions === 0` и нет сохранённой вкладки) → **theory**; иначе сохранённая / **practice**;
  - кнопка «Перейти к практике» (`#neg-c-to-practice`) → `show('practice')` + скролл к табам.
- Сам сценарий (7 встреч → определи тип → выбери заход → разбор → финальный дебриф) — рабочий, проигран до конца в preview (7/7).
- CSS табов — `.neg-c-tabs/.neg-c-tab/.neg-c-pane/.neg-c-go-practice` в `docs/negotiations/trainer.css`.
- Hero-подводка согласована (сначала вход в контакт → потом 12 стадий).
- Контент: `window.NegContact = {types[4: ХА/ФО/ЦИ/ШЭ], encounters[7], debrief}` в `docs/negotiations/contact-content.js`.

## 2) Что осталось доделать (опции, НЕ начаты) и где
Файлы: движок `docs/negotiations/contact-trainer.js`, вёрстка `docs/negotiations.html`, стили `docs/negotiations/trainer.css`, контент `docs/negotiations/contact-content.js`.
- **Гейт практики**: открыть «Практику» только после раскрытия всех 4 карточек типов.
  Где: `renderTypes()` (считать раскрытые `.neg-c-type.is-open`), `setupTabs()` (блокировать таб/кнопку practice пока не открыты все 4).
- **Мини «как это работает»** перед практикой: короткий интро-экран в `#neg-c-pane-practice` до первой встречи (или шаг в `render()` при `S.pos===0`).
- **Карта 12 стадий — 3-й таб**: сейчас отдельная секция `#map` ниже. Перенести в третий таб `[data-tab="map"]` (HTML + `setupTabs.show()` + панель). Движок карты — `docs/negotiations/trainer.js` (`renderMap`), контент — `scenarios.js`.
- **2-й ход в встрече** («углубление контакта»): добавить шаг после `pickOpen()` в `contact-trainer.js` + поле в `encounters[].deepen` в `contact-content.js`.
- **Очки/прогресс по типам, серия**: расширить `prog` (localStorage `yasna_negc_v1`) и финал `renderSummary()`.
- **Полный спарринг** (подготовка «креста» → диалог по 12 стадиям) — по исходному прототипу `~/Downloads/yasna-trainer_1.html`. Большой объём, новый модуль.

## 3) Как протестировать
- **Локально**: node не в PATH → `export PATH="$HOME/.local/node-v20.20.2-darwin-arm64/bin:$PATH"`. Дев-сервер — launch.json «yasna-pr» (порт 8090, отдаёт `docs/`). Открыть `http://localhost:8090/negotiations.html`.
  - Новичок: очистить `localStorage` ключи `yasna_negc_tab` и `yasna_negc_v1` → перезагрузка → по умолчанию вкладка **Теория**.
  - Клик «Перейти к практике» / таб «Практика» → сценарий; пройти 7 встреч → сводка «Мастер контакта / …». Перезагрузка → попадаешь на последнюю вкладку.
  - Карточка-CTA: `localhost:8090/duel.html` (нужен профиль — есть гостевой) → меню игр → карточка «Переговоры» → ведёт на negotiations.html.
- **Прод**: `https://avvacumrechevoi.github.io/yasnanegotiations/negotiations.html` (hard-refresh / инкогнито).

## ВАЖНО про правки и деплой
- `negotiations.*` существуют в ДВУХ местах — `docs/` и `docs/preview/` — **синхронизировать обе** (`cp` после правок). Кэш-версии в `negotiations.html`: `trainer.css?v=2`, `contact-trainer.js?v=2`, `contact-content.js?v=1` — бить при изменении файла.
- negotiations standalone → `npm run build` НЕ нужен (build только для duel-бандла `docs/dist/duel.min.js`). После правки `duel-page.js` (карточка-CTA) — нужен build + bump `duel.min.js?v=`.
- Деплой: push в `main`. Вшитый в git-remote PAT МЁРТВ — пушить через keychain:
  `KCTOK=$(printf "protocol=https\nhost=github.com\n\n" | git credential-osxkeychain get | sed -n 's/^password=//p'); git push "https://x-access-token:${KCTOK}@github.com/Avvacumrechevoi/yasnanegotiations.git" main`
  GitHub Pages отдаёт `docs/` (~1–2 мин). Канон владельца — `Avvacumrechevoi` (заглавная A).
