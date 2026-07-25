-- ═══════════════════════════════════════════════════════════════════
-- Миграция 003 — роли и разграничение доступа.
--
-- ЗАЧЕМ СЕЙЧАС, А НЕ «КОГДА ЗАФИНАЛИМ РАЗДЕЛЫ». Здесь ставится замок и
-- ключница; решение «какие двери запереть» — это строки в role_grants и
-- entitlements, оно принимается позже и меняется без кода и без деплоя.
-- Отложить нельзя две вещи: сейчас публикация контента защищена ОДНИМ общим
-- паролем, а автор ревизии берётся из тела запроса (то есть подделывается), и
-- страница админки не закрыта вообще. Это не «нет ролей», это открытая ручка
-- записи в живой контент, и от незафиналенных разделов она уже не станет.
--
-- ПОЧЕМУ РОЛИ НЕ ЖИВУТ В entitlements. Соблазн был: таблица есть, ключ
-- свободный — записать роль как owner_key='role:user'. Так делать НЕЛЬЗЯ:
-- 002_device_auth.sql уже зафиксировал в истории миграций инвариант
--   DELETE FROM entitlements WHERE NOT (owner_key LIKE "usr:%" OR owner_key LIKE "dev:%")
-- Скопировать эти строки в следующую чистку — естественный жест, и он молча
-- снесёт все роли. Поэтому роли — отдельные таблицы, а entitlements остаётся
-- тем, чем задумана: персональные доступы по owner_key.
--
-- И ВТОРОЕ: ручка выдачи прав ПИШЕТ в entitlements. Если там же держать «кто
-- может выдавать», любая ошибка валидации превращается в самоповышение.
-- Поэтому полномочия (cap:*) живут в role_grants, а сервер жёстко отказывает
-- на попытку выдать через ручку доступов ключ с префиксом role:/cap:/admin:.
-- ═══════════════════════════════════════════════════════════════════

-- Роли-шаблоны. Роль = набор галочек, она же шаблон для «открыть как у…».
CREATE TABLE roles (
  role_id     Utf8 NOT NULL,        -- 'user' | 'admin' | 'superadmin' | далее любые
  title       Utf8 NOT NULL,        -- человекочитаемо, для интерфейса
  rank_level  Uint32 NOT NULL,      -- 0 user … 90 admin … 100 superadmin.
                                    -- rank НЕ подходит как имя: в YQL это функция.
  is_default  Bool NOT NULL,        -- роль для тех, у кого строки нет (ровно одна true)
  updated_at  Timestamp NOT NULL,
  updated_by  Utf8,
  PRIMARY KEY (role_id)
);

-- «У id есть роль». Отсутствие строки = роль с is_default.
-- Ключ — users.user_id, а НЕ owner_key: роль бывает только у аккаунта.
-- Гостю (dev:*) роль не выдаётся, ему выдаются персональные доступы.
CREATE TABLE user_roles (
  user_id     Utf8 NOT NULL,
  role_id     Utf8 NOT NULL,
  granted_by  Utf8 NOT NULL,        -- 'usr:<id>' | 'bootstrap:ydb-cli'
  granted_at  Timestamp NOT NULL,
  note        Utf8,
  PRIMARY KEY (user_id),
  -- индекс нужен для проверки «не остаться без суперадминов»
  INDEX user_roles_by_role GLOBAL ON (role_id)
);

-- Галочки роли. Это и есть «админу открыто то, что суперадмин отметил».
-- feature может быть и разделом ('section:learn'), и полномочием ('cap:*').
CREATE TABLE role_grants (
  role_id     Utf8 NOT NULL,
  feature     Utf8 NOT NULL,
  granted     Bool NOT NULL,        -- true открыть / false закрыть
  updated_by  Utf8 NOT NULL,
  updated_at  Timestamp NOT NULL,
  PRIMARY KEY (role_id, feature)
);

-- Каталог возможностей: снимок того, что объявляет клиент.
-- Смысл — чтобы новый тренажёр НЕ требовал правки бэкенда: он объявляет свои
-- узлы, они публикуются сюда, и сами появляются в матрице суперадмина.
-- sensitive=true означает «закрытие реально проверяется сервером»; для всего
-- остального клиентский гейт — витрина, потому что docs/ раздаётся статикой.
CREATE TABLE features (
  feature        Utf8 NOT NULL,     -- 'section:learn' | 'game:partiya' | 'cap:content.publish'
  area           Utf8 NOT NULL,     -- 'constructor'|'course'|'game'|'trainers'|'rating'|'admin'
  parent         Utf8,              -- ключ родителя, для дерева
  title          Utf8 NOT NULL,
  kind           Utf8 NOT NULL,     -- 'section'|'mode'|'lesson'|'theme'|'widget'|'cap'
  default_access Utf8 NOT NULL,     -- 'open' | 'account' | 'closed'
  status         Utf8 NOT NULL,     -- 'live' | 'wip'
  sensitive      Bool NOT NULL,
  declared_at    Utf8,              -- откуда узел взялся, напр. 'docs/learn.html:1263'
  seen_at        Timestamp NOT NULL,
  PRIMARY KEY (feature),
  INDEX features_by_area GLOBAL ON (area)
);

-- Журнал. Append-only: ни UPDATE, ни DELETE. Пишутся И ОТКАЗЫ — иначе
-- украденный токен не видно вообще: успешные действия выглядят штатно, а
-- серия отказов — единственный след попытки.
CREATE TABLE access_audit (
  id           Utf8 NOT NULL,
  at           Timestamp NOT NULL,
  actor        Utf8 NOT NULL,       -- 'usr:<id>' | 'bootstrap:ydb-cli' | 'anon'
  action       Utf8 NOT NULL,       -- 'grant'|'revoke'|'role.set'|'catalog.publish'|'content.publish'
  target       Utf8,                -- owner_key либо role_id
  feature      Utf8,
  result       Utf8 NOT NULL,       -- 'ok' | 'denied' | 'error'
  reason       Utf8,                -- почему отказ
  payload_json Utf8,                -- before/after для разбора спорных случаев
  PRIMARY KEY (id),
  INDEX audit_by_time GLOBAL ON (at),
  INDEX audit_by_actor GLOBAL ON (actor, at)
);

-- ─── стартовые роли ────────────────────────────────────────────────
-- Ровно одна роль с is_default=true: её получают все, у кого нет строки в
-- user_roles, включая тех, кто ещё не входил.
UPSERT INTO roles (role_id, title, rank_level, is_default, updated_at, updated_by) VALUES
  ("user",       "Пользователь", 0u,   true,  CurrentUtcTimestamp(), "migration:003"),
  ("admin",      "Админ",        90u,  false, CurrentUtcTimestamp(), "migration:003"),
  ("superadmin", "Суперадмин",   100u, false, CurrentUtcTimestamp(), "migration:003");

-- ─── полномочия ролей ──────────────────────────────────────────────
-- Суперадмину открыто всё — включая право управлять ролями.
UPSERT INTO role_grants (role_id, feature, granted, updated_by, updated_at) VALUES
  ("superadmin", "cap:content.publish", true, "migration:003", CurrentUtcTimestamp()),
  ("superadmin", "cap:access.grant",    true, "migration:003", CurrentUtcTimestamp()),
  ("superadmin", "cap:people.view",     true, "migration:003", CurrentUtcTimestamp()),
  ("superadmin", "cap:audit.view",      true, "migration:003", CurrentUtcTimestamp()),
  ("superadmin", "cap:catalog.edit",    true, "migration:003", CurrentUtcTimestamp()),
  ("superadmin", "cap:roles.manage",    true, "migration:003", CurrentUtcTimestamp());

-- Админу по умолчанию — только публикация контента. Остальное суперадмин
-- отмечает галочками сам; это ровно то поведение, которое просил владелец.
UPSERT INTO role_grants (role_id, feature, granted, updated_by, updated_at) VALUES
  ("admin", "cap:content.publish", true,  "migration:003", CurrentUtcTimestamp()),
  ("admin", "cap:people.view",     true,  "migration:003", CurrentUtcTimestamp()),
  ("admin", "cap:access.grant",    false, "migration:003", CurrentUtcTimestamp()),
  ("admin", "cap:audit.view",      false, "migration:003", CurrentUtcTimestamp()),
  ("admin", "cap:catalog.edit",    false, "migration:003", CurrentUtcTimestamp()),
  ("admin", "cap:roles.manage",    false, "migration:003", CurrentUtcTimestamp());

-- ─── первый суперадмин ─────────────────────────────────────────────
-- Курица и яйцо: выдать роль через интерфейс нельзя, пока нет ни одного, кто
-- имеет право выдавать. Поэтому первый выдаётся здесь, по user_id владельца
-- аккаунта (tg_user_id 262692592). Строка в журнале обязательна: выдача роли
-- без следа — ровно то, чего журнал не должен допускать.
UPSERT INTO user_roles (user_id, role_id, granted_by, granted_at, note) VALUES
  ("bc011e34-ca30-44e6-89d5-5e8c5b161b73", "superadmin", "bootstrap:ydb-cli",
   CurrentUtcTimestamp(), "первый суперадмин, миграция 003");

UPSERT INTO access_audit (id, at, actor, action, target, feature, result, reason, payload_json) VALUES
  ("bootstrap-003", CurrentUtcTimestamp(), "bootstrap:ydb-cli", "role.set",
   "usr:bc011e34-ca30-44e6-89d5-5e8c5b161b73", NULL, "ok",
   "первичная выдача роли суперадмина при миграции 003",
   '{"role":"superadmin","tg_user_id":262692592}');
