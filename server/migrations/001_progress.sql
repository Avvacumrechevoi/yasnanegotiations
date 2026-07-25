-- ═══════════════════════════════════════════════════════════════════
-- Миграция 001 — прогресс пользователя на сервере.
--
-- ЗАЧЕМ. До этого в БД были только идентичность (users, device_links),
-- журнал матчей (matches) и ревизии контента (content_revisions). Учебного
-- прогресса не существовало вообще: пройденные уроки, курс, достижения,
-- прогресс тренажёров, личные заметки и СОБСТВЕННЫЕ Ясны жили только в
-- localStorage (44 ключа, см. docs/core/storage.js). Очистка кэша или смена
-- устройства = потеря всего. Из-за этого были невозможны: «прогресс на любом
-- устройстве», роли, постепенное открытие разделов, кураторские программы.
--
-- ПРИНЦИПЫ:
-- • Ключ прогресса — (owner_key, scope, item_id). owner_key = user_id, если
--   человек залогинен, иначе device_id. Это позволяет писать прогресс ГОСТЮ,
--   не требуя регистрации (гостевой вход — важный сценарий, ломать нельзя),
--   а потом связать устройство с аккаунтом через device_links.
-- • state_json — произвольное состояние раздела. Схему намеренно не
--   фиксируем на уровне БД: у разделов пять разных форматов, и жёсткая
--   схема потребует миграции на каждый новый тренажёр.
-- • updated_at + rev — для разрешения конфликтов при синхронизации
--   (last-write-wins с проверкой rev; клиент присылает известную ему rev).
-- • Ничего не удаляем и не переименовываем: миграция ТОЛЬКО добавляет.
--
-- Применяется скриптом scripts/apply-migrations.sh (ydb CLI). Файл —
-- ЕДИНСТВЕННЫЙ источник правды о схеме; факт применения пишется в
-- schema_migrations. YDB не знает IF NOT EXISTS для CREATE TABLE, поэтому
-- раннер сам считает «объект уже существует» успехом.
--
-- НЕ применять через ydb-sdk (session.createTable): schemeClient и tableClient
-- приписывают database к пути сами, и абсолютный путь удваивается — таблицы
-- уезжают в /<db>/ru-central1/<cloud>/<db>/<имя>, где их видит scheme-клиент,
-- но НЕ видит query-движок (SELECT → «Cannot find table» при рабочем
-- describeTable). Подробный разбор — в шапке scripts/apply-migrations.sh.
-- ═══════════════════════════════════════════════════════════════════

-- Прогресс по разделам. Одна строка = одна единица прогресса.
--   scope   : 'lesson' | 'course' | 'trainer' | 'achievement' | 'stat' | 'note' | 'creation'
--   item_id : id урока/станции/тренажёра/достижения; для агрегатов — 'default'
CREATE TABLE progress (
  owner_key    Utf8 NOT NULL,          -- user_id или device_id
  scope        Utf8 NOT NULL,
  item_id      Utf8 NOT NULL,
  state_json   Utf8 NOT NULL,          -- сериализованное состояние
  rev          Uint64 NOT NULL,        -- версия записи, растёт при каждой записи
  updated_at   Timestamp NOT NULL,
  device_id    Utf8,                   -- откуда пришла последняя запись (диагностика)
  PRIMARY KEY (owner_key, scope, item_id),
  INDEX progress_by_owner GLOBAL ON (owner_key, updated_at)
);

-- Личные заметки к урокам вынесены отдельно: они объёмнее, приватнее и их
-- не нужно тянуть вместе с остальным прогрессом на каждый запрос.
CREATE TABLE user_notes (
  owner_key    Utf8 NOT NULL,
  item_id      Utf8 NOT NULL,          -- id урока (ключ yasna_reflection_<id>)
  text         Utf8 NOT NULL,
  updated_at   Timestamp NOT NULL,
  PRIMARY KEY (owner_key, item_id)
);

-- Права и постепенное открытие. Отсутствие строки = доступ по общим правилам;
-- строка с granted=false = явный запрет, с granted=true = явное открытие
-- (купленный доступ, выдача преподавателем, ручное открытие раздела).
CREATE TABLE entitlements (
  owner_key    Utf8 NOT NULL,
  feature      Utf8 NOT NULL,          -- 'trainer:negotiations' | 'course:stop3' | …
  granted      Bool NOT NULL,
  source       Utf8,                   -- 'purchase' | 'teacher' | 'promo' | 'manual'
  granted_by   Utf8,                   -- кто выдал (user_id) — для аудита
  expires_at   Timestamp,              -- NULL = бессрочно
  created_at   Timestamp NOT NULL,
  PRIMARY KEY (owner_key, feature)
);

-- Журнал синхронизаций — чтобы видеть, что реально доезжает с клиентов,
-- и уметь разобрать спорные случаи «прогресс пропал».
CREATE TABLE progress_sync_log (
  id           Utf8 NOT NULL,          -- uuid
  owner_key    Utf8 NOT NULL,
  device_id    Utf8,
  action       Utf8 NOT NULL,          -- 'pull' | 'push' | 'import'
  items        Uint32,                 -- сколько единиц затронуто
  created_at   Timestamp NOT NULL,
  PRIMARY KEY (id),
  INDEX sync_by_owner GLOBAL ON (owner_key, created_at)
);
