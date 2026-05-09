# Архитектура контента Ясны · v3

Документ описывает 3-уровневое хранилище контента (темы / вопросы / атомы) и его поведение в trust- и failure-сценариях.

## Зачем три уровня

Один источник правды плох под наш профиль использования:

- **Контент меняется редко** (раз в день или реже)
- **Читается часто** (~100 запросов в минуту в пиковый момент)
- **Должен пережить падение бэкенда** (игрок открыл duel, бэкенд лежит — игра обязана работать)
- **Админка должна публиковать без редеплоя** (текущий процесс: правка JSON → git commit → CI build → CDN — ~2-5 минут на изменение)

Решение — кэш с 3 уровнями hot/warm/cold.

## Три уровня

```
┌──────────────────────────────────────────────────────────────┐
│  TIER 1 · BASELINE (immutable, CDN)                          │
│                                                              │
│  Source: content/*.json (10 файлов в репо)                   │
│  Build:  scripts/build-content.mjs → content.bundle.js       │
│  Serve:  GitHub Pages CDN, кэш 1 день                        │
│  Size:   ~280 KB raw, ~70 KB gzip                            │
│  Latency: 0ms (HTTP cache) или 1×CDN-RTT                     │
│  Editable by: разработчик через git commit                   │
└──────────────────────────────────────────────────────────────┘
                              ↓ merge
┌──────────────────────────────────────────────────────────────┐
│  TIER 2 · LIVE OVERRIDES (mutable, YDB)                      │
│                                                              │
│  Source: content_revisions table в YDB                       │
│  Serve:  /content endpoint (Yandex Cloud Function)           │
│  Cache:  client localStorage 5 мин + ETag для 304            │
│  Size:   зависит от объёма правок (обычно <10 KB)            │
│  Latency: 1×API-RTT при miss, 0 при hit                      │
│  Editable by: admin через /preview/admin.html + пароль       │
└──────────────────────────────────────────────────────────────┘
                              ↓ resolved
┌──────────────────────────────────────────────────────────────┐
│  RESOLVED CONTENT (in-memory)                                │
│  window.YasnaContentResolved = {                             │
│    THEMES, QUESTIONS, QUESTIONS_FULL, ATOMS, _meta           │
│  }                                                           │
│                                                              │
│  Игровой движок (turnir-engine, trivia-bank) читает отсюда.  │
└──────────────────────────────────────────────────────────────┘
```

## Tier 3 (отдельно)

`Tier 3 — Runtime PvP state` живёт в Firebase RTDB и НЕ относится к контенту: это room state, ход игры, ответы игроков, `is_online` флаги. См. `rt-firebase.js`.

## Поток данных при загрузке игры

1. **Браузер → CDN**: `content.bundle.js` (1 RTT, кэш 1 день). Парсит, ставит `window.YasnaContent`.
2. **content-store.js**: `init()` синхронно
   - читает `window.YasnaContent` → baseline
   - читает `localStorage[yasna_content_overrides_cache_v1]` → cached overrides
   - публикует `window.YasnaContentResolved` (baseline + cached merge)
   - emit `yasna-content-updated` event
3. **trivia-bank.js**: подписан на event, вызывает `rebuild()`. Игра готова работать **без сети**.
4. **content-store.js**: запускает `refresh()` асинхронно
   - `GET /content` с `If-None-Match: <cached.dataHash>`
   - 304 → ничего не делаем, кэш свеж
   - 200 → обновляем cache + публикуем YasnaContentResolved + emit event
5. **trivia-bank.js**: `rebuild()` снова на свежих данных. `console.log` сообщает.

## Поток публикации (admin)

1. Admin правит вопросы в `/preview/admin.html`. Изменения хранятся в `localStorage[yasna_admin_overrides]`.
2. Нажимает «⬆ Опубликовать в БД». Модалка просит пароль.
3. `ContentStore.publish(data, {password})`:
   - POST `/content/publish` с `Authorization: Bearer <password>`
   - body: `{data, publishedBy, notes}`
4. **Backend** (`content-publish.js`):
   - Constant-time compare пароля с `ADMIN_PASSWORD` env
   - Валидация структуры (added/edited/deleted) + per-question валидация (та же что во frontend)
   - Лимит 5 MB на JSON
   - Транзакция YDB: `UPDATE ... SET is_current=false WHERE is_current=true; INSERT новой строки is_current=true`
   - Возвращает `{revisionId, dataHash, publishedAt, size}`
5. Admin client: `refresh()` подтягивает свежую ревизию, очищает локальные overrides.
6. Игрок открывает /duel → `content-store.refresh()` находит новый dataHash → загружает → переразрешает контент.

## Failure-режимы

| Сценарий | Поведение |
|----------|-----------|
| Backend недоступен | Игра работает на baseline + last cached overrides |
| YDB недоступен | `content-fetch` отдаёт пустые overrides (200 OK) |
| Кэш переполнен | `localStorage.setItem` молча падает, in-memory остаётся |
| Битая overrides-запись | `isQuestionValid` отфильтровывает, остальные работают |
| Пароль украден | Ротация: меняешь `ADMIN_PASSWORD` env → переразвёртывание Cloud Function |
| Конкурентная публикация | Последний publish побеждает (атомарная транзакция YDB) |
| Откат | `UPDATE content_revisions SET is_current=true WHERE revision_id='<old>'` (вручную в YDB CLI) |

## ETag и кэширование

Каждая ревизия имеет `dataHash = sha256(JSON.stringify(data))`.

```
Client: GET /content
        If-None-Match: "abc123..."

Server: проверяет hash актуальной ревизии
        совпадает → 304 Not Modified (0 байт ответа)
        отличается → 200 + ETag: "def456..." + body
```

Это даёт:
- **304 при отсутствии изменений** — пользователь играет 30 минут, опросы /content идут каждые 5 мин, все 6 — 304 без передачи payload.
- **Авто-инвалидация кэша** — после publish все клиенты увидят 200 + новый body на первом же refresh.

## Безопасность

**Текущая итерация** (MVP):
- Пароль в `ADMIN_PASSWORD` env var Cloud Function
- Constant-time compare защищает от timing attack по длине
- HTTPS обязателен (API Gateway)
- CORS открытый (любой origin может GET; POST требует пароль)

**Следующая итерация** (если будет нужно):
- JWT токены для админа (как у обычных юзеров через `/auth/telegram`)
- Роли: `viewer` (читать ревизии) / `editor` (publish) / `admin` (rollback)
- Audit log: кто что когда менял (отдельная таблица `content_audit`)
- Rate-limit: 1 publish в 10 сек на IP

## Производительность

Цель: **TTI игры < 1 сек** даже при холодном старте.

- baseline: 70 KB gzip → ~50ms на 4G, ~10ms на WiFi
- overrides cached: 0 ms (localStorage)
- overrides fresh: 1 RTT (50-200ms) — async, не блокирует игру
- Cloud Function cold start: 200-500 ms — затрагивает только первого игрока после простоя

Для backend стоимость:
- 100 игроков/мин × 12 calls/час = 72k API calls/день
- При 304 (95% случаев) — почти ноль на API Gateway billing
- YDB чтение: 1 row, индексированный SELECT — <5 ms

## Команды

**Как админу опубликовать изменения:**
1. Открой `/preview/admin.html`
2. Внеси правки (добавь/измени/удали вопросы)
3. Жми «⬆ Опубликовать в БД» → введи пароль
4. Все клиенты увидят изменения в течение 5 минут (или сразу при F5)

**Как разработчику внести baseline-изменения:**
1. Правь `content/*.json`
2. `npm run build` — соберёт `content.bundle.js`
3. `git commit && git push`
4. CDN отдаст обновлённый bundle (cache-bust через `?v=` в URL)

**Как откатить ревизию:**
```sql
-- Найти текущую и нужную ревизию
SELECT revision_id, published_at, published_by, notes FROM content_revisions ORDER BY published_at DESC LIMIT 10;
-- Откатиться на конкретную
UPDATE content_revisions SET is_current = false WHERE is_current = true;
UPDATE content_revisions SET is_current = true  WHERE revision_id = 'rev-abc123';
```

## Деплой backend

Развёртывание новых функций описано в `server/README.md`. Кратко для контента:

```bash
# 1. Создать таблицу
yc ydb sql --execute "$(cat server/schema.sql | grep -A 20 content_revisions)"

# 2. Загрузить функции
yc serverless function version create \
  --function-name yasna-content-fetch \
  --source-path server/content-fetch.js \
  --entrypoint content-fetch.handler \
  --environment YDB_ENDPOINT=...,YDB_DATABASE=...

yc serverless function version create \
  --function-name yasna-content-publish \
  --source-path server/content-publish.js \
  --entrypoint content-publish.handler \
  --environment YDB_ENDPOINT=...,YDB_DATABASE=...,ADMIN_PASSWORD=...

# 3. Обновить API Gateway (через консоль или yc CLI)
# Добавить /content и /content/publish в api-gateway.yaml,
# подставить function_id, передеплоить gateway
```
