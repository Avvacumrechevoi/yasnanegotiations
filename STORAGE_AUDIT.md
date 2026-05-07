# Аудит хранилищ проекта + готовность к серверу

Дата: 2026-05-07. Скоп: всё, что хранит данные (постоянно или временно).

## TL;DR

**База данных в проекте есть, и не одна — но все они в браузере (localStorage).** Реальной серверной БД нет. Для лидерборда нужна — это РЕЗОН для подключения Yandex Cloud + YDB.

**7 «БД» в проекте:**

| Ключ | Что хранит | Кем используется | Volume | Нужен сервер? |
|---|---|---|---|---|
| `yasna_duel_profile` | Никнейм + аватар + deviceId | Дуэль | ~120 байт | ⚠️ Удобно sync-ать между устройствами, но не критично |
| `yasna_duel_data` | История матчей до 200 + рекорды + serias | Дуэль | ~50 КБ макс | ⚠️ Для cross-device sync |
| `yasna_duel_pending` | Очередь на отправку на сервер | Дуэль | ~30 КБ макс | ✅ Существует ради сервера |
| `yasna_duel_achievements` | Разблокированные ачивки | Дуэль | ~1 КБ | ❌ Локально OK |
| `yasna_duel_daily` | Daily challenge история | Дуэль | ~5 КБ | ❌ Локально OK |
| `yasna2_subdata` | Ясна² 144 sub-полки | Главное приложение | до 100 КБ | ⚠️ Pro feature: cloud-sync |
| `yasna_reflection_*` | Размышления уроков | Уроки | varies | ⚠️ Pro feature: cloud-sync |

**Embedded constants (не БД, но похоже):**
- `core/data.js` — 60+ шаблонов Ясн (`T`), 18 механик (`FL`), глоссарий (`GLOSS`), всё read-only. ~400 строк. Это «справочник», не БД.

## 1. Подробно: localStorage в проекте

### 1.1 `yasna_duel_profile` (Дуэль)
```json
{
  "nickname": "alice",
  "avatar": "🦊",
  "deviceId": "279fc166-68da-4a30-9f49-b7dc0d8e9f7b",
  "createdAt": 1778140678874
}
```
- ~120 байт
- Создаётся при первом запуске Дуэли через ProfileOnboarding
- deviceId — UUID v4, не меняется никогда
- Migration: автоматически добавляется deviceId если его не было (для backward compat)

### 1.2 `yasna_duel_data` (Дуэль)
```js
{
  version: 1,
  matches: [    // до 200 последних
    { id, date, gameId, yasnaId, role, transport, result, time, score, maxScore, opponentName, isBot, botLevel, bySurrender, byDisconnect },
    ...
  ],
  records: {    // лучшее по комбинации режим+Ясна
    'race-cross': {
      'суток': { played, wins, losses, bestTime, bestTimeDate, bestScore, ... },
      'года': { ... },
    },
    ...
  },
  streaks: { overall: { current, best }, 'race-cross': { ... }, ... },
  totals: { played, wins, losses }
}
```
- При 200 матчах: ~50 КБ
- Версионирована (`version: 1`)
- Если version не совпадает → reset (не migration)

### 1.3 `yasna_duel_pending` (Дуэль)
```js
[
  { matchId, deviceId, nickname, avatar, gameId, yasnaId, result, score, maxScore, time, transport, ... },
  ...   // до 200 непросмотренных
]
```
- Накапливаются, когда сервер недоступен или не настроен (сейчас `null`)
- При появлении `window.YASNA_LEADERBOARD_API` → автоматический flush на window.load
- Дедуп по `matchId`

### 1.4 `yasna_duel_achievements` (Дуэль)
```js
['first-duel', 'first-win', 'matches-5', 'sutok-win', ...]
```
- Просто массив ID разблокированных
- Условия проверяются от `yasna_duel_data` (history) после каждого матча
- ~1 КБ при всех 32 ачивках

### 1.5 `yasna_duel_daily` (Дуэль)
```js
{
  byDate: {
    '2026-05-07': { gameId, yasnaId, score, maxScore, time, ts },
    '2026-05-06': { ... },
    ...
  },
  streak: { current, best, lastDate }
}
```
- ~50 байт за день. За год — ~18 КБ
- Лучший результат за день перезаписывается, не накапливается

### 1.6 `yasna2_subdata` (главное приложение)
```js
{
  'суток_0': { name: 'Глубокая ночь', p: ['...', ...], custom: true },
  'суток_3_5': { ... },
  ...   // ключ — yasnaId_polkaIdx[_subPolkaIdx]
}
```
- Для каждой Ясны: пользовательские данные о вложенных 144 sub-полках
- При активном использовании: до 50-100 КБ
- Используется в `app.js` через `useState(() => JSON.parse(localStorage.getItem('yasna2_subdata') || '{}'))`

### 1.7 `yasna_reflection_<lessonId>_<blockId>` (уроки)
```js
"Текст размышления пользователя..."
```
- Размышления, написанные при прохождении уроков
- Один ключ на каждый блок размышлений
- Объём — что напишет пользователь

## 2. Лимиты браузера

| | Хром / Edge / Сафари | Файрфокс |
|---|---|---|
| Per-origin localStorage | 5–10 MB | 10 MB |
| Per-key | без жёсткого лимита, но вписывается в общий |
| Quota exceeded behavior | `setItem` бросит исключение |

**Текущее использование при активном игроке:**
- profile: 0.1 КБ
- data: до 50 КБ (200 матчей)
- pending: до 30 КБ (если без сервера)
- achievements: 1 КБ
- daily: до 20 КБ (за год)
- yasna2_subdata: до 100 КБ
- reflections: ~5–20 КБ

**Итого:** ~200 КБ на активного пользователя. **2% от лимита.** Запас огромный.

## 3. Что localStorage НЕ может (нужен сервер)

| Фича | Почему нужен сервер |
|---|---|
| 🌐 Глобальный лидерборд | Данные разных игроков не пересекаются |
| 👥 Поиск/list игроков | Каждый видит только себя |
| 🤝 Friends + presence | Нет shared state |
| 🛡 Anti-cheat ranked | Клиент сам себе судья |
| 📱 Cross-device sync | Каждое устройство отдельная история |
| 🏆 Tournament daily у всех | Каждый сам себе чемпион |
| 📊 Аналитика DAU | Не считается |
| 🔄 Замена устройства | Прогресс теряется |

## 4. Что localStorage даёт (бесплатно)

| Фича | Реально работает |
|---|---|
| Личная история | ✅ |
| Личные рекорды | ✅ |
| Достижения | ✅ |
| Daily challenge с deterministic seed | ✅ |
| Профиль (ник + аватар + deviceId) | ✅ |
| Уроки + размышления | ✅ |
| Pinned Ясны | ✅ |
| Ясна² (144 sub-полки) | ✅ |
| Replay (если бы был) | можно реализовать |

## 5. Архитектурный смысл

Текущая схема — **client-first**. Браузер играет роль СУБД для пользователя:
- Все его данные принадлежат ему (privacy by default)
- Работает без интернета (offline-first)
- Нулевая стоимость хостинга
- Нет рисков GDPR / 152-ФЗ ПД

Минусы:
- Очистка истории браузера = всё стирается
- Нельзя сравнить с другими игроками
- Нельзя залогиниться на другом устройстве

**Сервер нужен ровно для тех фич, которые не работают без shared state.** Не для замены текущего, а как ДОПОЛНЕНИЕ.

## 6. Готовность к подключению сервера (Yandex Cloud + YDB)

### ✅ Готово (90%)

1. **Schema совместима с YDB 1-в-1.** `yasna_duel_data.matches[]` маппится на таблицу `matches(id, device_id, game_id, yasna_id, ...)` без трансформаций.

2. **deviceId уже устойчивый.** UUID v4 при первом входе, mishmae-compat для старых профилей.

3. **HTTP-клиент `YasnaLeaderboardClient` написан.** Работает в режиме «no-op если baseUrl=null».

4. **Retry queue работает.** Накапливает в `yasna_duel_pending`, авто-flush на window.load.

5. **Hook в `recordMatch` есть.** Только peerjs-матчи попадают в очередь.

6. **Leaderboard UI готов.** Состояния not-configured / loading / error / empty / data.

7. **Анти-cheat baseline на клиенте.** time >= 1s, бот-матчи фильтруются.

8. **Версионирование данных.** `yasna_duel_data.version = 1` — при изменении схемы можно мигрировать.

### ⚠️ Не готово (10%)

1. **Centralized storage keys.** Сейчас 5 разных констант в duel.js, разбросанные по разным IIFE. Refactor — собрать в один объект `KEYS`.

2. **Migration framework.** Если изменим формат `yasna_duel_data`, старые пользователи получат reset. Нужен upgrade path.

3. **Storage size monitoring.** Нет проверки квоты. При 5 MB активной игры setItem выбросит ошибку — пока не обработано.

4. **Atomic transactions.** Между read и write можем потерять данные при двух одновременных вкладках. Маловероятно, но возможно.

## 7. Refactoring предложения

### 7.1 Централизация ключей (5 минут)

Сейчас:
```js
const PROFILE_KEY = 'yasna_duel_profile';     // в одной IIFE
const STORAGE_KEY = 'yasna_duel_data';         // в другой
const LB_QUEUE_KEY = 'yasna_duel_pending';
const ACHIEVEMENTS_KEY = 'yasna_duel_achievements';
const DAILY_KEY = 'yasna_duel_daily';
```

Лучше:
```js
window.YasnaStorage = {
  KEYS: {
    PROFILE: 'yasna_duel_profile',
    DATA: 'yasna_duel_data',
    PENDING: 'yasna_duel_pending',
    ACHIEVEMENTS: 'yasna_duel_achievements',
    DAILY: 'yasna_duel_daily',
    YASNA2: 'yasna2_subdata',
    REFLECTION_PREFIX: 'yasna_reflection_',
  },
  get(key) { ... },
  set(key, value) { ... },
  remove(key) { ... },
  size() { ... },     // суммарный размер
  exportAll() { ... }, // для бэкапа
  reset() { ... },
};
```

**Польза:** для будущего export/import + диагностики.

### 7.2 Migration framework (20 минут)

Сейчас при `version !== 1` data сбрасывается. Лучше:

```js
const MIGRATIONS = {
  '0->1': (data) => ({ ...data, version: 1, totals: { played: data.matches?.length || 0, wins: 0 } }),
  '1->2': (data) => ({ ...data, version: 2, /* добавили новое поле */ }),
};

function migrate(data){
  while(data.version < CURRENT_VERSION){
    const fn = MIGRATIONS[`${data.version}->${data.version+1}`];
    if(!fn) break;
    data = fn(data);
  }
  return data;
}
```

**Польза:** при добавлении новых полей старые пользователи не теряют прогресс.

### 7.3 Storage quota monitoring (10 минут)

```js
function safeSet(key, value){
  try {
    localStorage.setItem(key, value);
    return true;
  } catch(e){
    if(e.name === 'QuotaExceededError'){
      // Обрезаем historу до 50 матчей
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if(data.matches?.length > 50){
        data.matches = data.matches.slice(0, 50);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      try { localStorage.setItem(key, value); return true; } catch(_){ return false; }
    }
    return false;
  }
}
```

**Польза:** не падаем при заполнении lокаlStorage.

### 7.4 Cross-tab sync (опционально, 30 минут)

Сейчас две вкладки могут перезаписать друг друга. Решение через `storage` event:

```js
window.addEventListener('storage', (e) => {
  if(e.key === STORAGE_KEY && e.newValue){
    // Внешняя вкладка обновила данные — перечитать
    cachedData = JSON.parse(e.newValue);
  }
});
```

**Польза:** при игре в двух вкладках (как для текущего демо BroadcastChannel) данные не теряются.

## 8. Концептуальный ответ: нужны ли БД в проекте?

### Сейчас

**ЕСТЬ — браузерные** (localStorage 7 «таблиц»). Они выполняют свою работу: личный прогресс, история, профиль, ачивки, размышления, Ясна². **Достаточно для одиночного использования.**

**НЕТ — серверных.** Все данные изолированы внутри браузера каждого пользователя.

### Нужны ли серверные БД?

**Зависит от целей продукта:**

| Если хочешь | Нужен сервер? |
|---|---|
| Личный тренажёр Ясны | ❌ Нет |
| Дуэль с другом по коду (1 раз) | ❌ Нет (PeerJS работает без БД) |
| Глобальный лидерборд топ-100 | ✅ Да (YDB или Postgres) |
| Турниры с призами | ✅ Да |
| Сообщество, форум, чат | ✅ Да |
| Cross-device — играть с телефона и десктопа под одним именем | ✅ Да (нужен auth + sync) |
| Анти-чит для рейтинга | ✅ Да |
| Аналитика поведения / A/B-тесты | ✅ Да (или ClickHouse если масштаб) |

**Минимальная роль сервера для нашей дуэли:**
- Принимать матчи (`POST /submit`)
- Отдавать топ-N (`GET /leaderboard`)
- ~120 строк кода Yandex Cloud Function + 1 таблица YDB

**Ничто другое НЕ переезжает на сервер.** Личный профиль остаётся локальным; на сервере только публичные результаты под deviceId.

## 9. Итоговая readiness-метрика

```
КЛИЕНТСКАЯ СТОРОНА:
  Schema совместимость       ████████████████████ 100%
  HTTP client                ████████████████████ 100%
  Retry queue                ████████████████████ 100%
  Profile с deviceId         ████████████████████ 100%
  Leaderboard UI             ████████████████████ 100%
  Anti-cheat baseline        ██████░░░░░░░░░░░░░░  30%   (только client-side)
  Storage centralization     ██░░░░░░░░░░░░░░░░░░  10%   ← refactor opportunity
  Migration framework        ██░░░░░░░░░░░░░░░░░░  10%   ← refactor opportunity
  Quota monitoring           ░░░░░░░░░░░░░░░░░░░░   0%   ← refactor opportunity

СЕРВЕРНАЯ СТОРОНА:
  Yandex Cloud account       ░░░░░░░░░░░░░░░░░░░░   0%   ← user action
  YDB schema                 ░░░░░░░░░░░░░░░░░░░░   0%   ← код готов в YANDEX_CLOUD_AUDIT.md
  Cloud Function code        ░░░░░░░░░░░░░░░░░░░░   0%   ← можно написать
  API Gateway                ░░░░░░░░░░░░░░░░░░░░   0%
  Deploy                     ░░░░░░░░░░░░░░░░░░░░   0%

ОБЩАЯ ГОТОВНОСТЬ ПОДКЛЮЧЕНИЯ:  ~75%
```

## 10. Что предлагаю сделать

**Опция 1 (рекомендую):** Сделаю 3 рефакторинга (centralize keys + migrations + quota safe-set) в дуэле. Это ~45 минут моей работы, доводит client до 95% готовности. После — ждём только серверного кода.

**Опция 2:** Пишу полный серверный код для Yandex Cloud (Cloud Function + YDB schema + API Gateway YAML + README). Готов к деплою. Тебе остаётся регистрация в YC и `yc cli` команды по инструкции. ~3 часа моей работы.

**Опция 3:** Делаю и то и другое. Полная готовность 100% обоих сторон. ~4 часа.

Скажи **«рефакторим»**, **«серверный код»** или **«всё сразу»** — продолжу.
