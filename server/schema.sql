-- ═══════════════════════════════════════════════════════════════════
-- YDB Schema для Дуэли — выполнить через `yc ydb sql`
-- ═══════════════════════════════════════════════════════════════════

-- Таблица пользователей. user_id — внутренний UUID.
-- Связь с провайдерами: один user может иметь TG+Yandex+VK одновременно.
CREATE TABLE users (
  user_id          Utf8 NOT NULL,
  nickname         Utf8 NOT NULL,
  avatar           Utf8,
  tg_user_id       Int64,
  yandex_user_id   Utf8,
  vk_user_id       Int64,
  email            Utf8,
  created_at       Timestamp NOT NULL,
  last_seen_at     Timestamp NOT NULL,
  PRIMARY KEY (user_id),
  INDEX users_by_tg     GLOBAL ON (tg_user_id),
  INDEX users_by_yandex GLOBAL ON (yandex_user_id),
  INDEX users_by_email  GLOBAL ON (email)
);

-- Привязка устройств к пользователю. Один user → много устройств.
CREATE TABLE device_links (
  device_id        Utf8 NOT NULL,
  user_id          Utf8 NOT NULL,
  linked_at        Timestamp NOT NULL,
  user_agent       Utf8,
  PRIMARY KEY (device_id),
  INDEX device_links_by_user GLOBAL ON (user_id)
);

-- Матчи. user_id nullable — анонимные матчи учитываются под device_id.
CREATE TABLE matches (
  id              Utf8 NOT NULL,
  user_id         Utf8,
  device_id       Utf8 NOT NULL,
  nickname        Utf8 NOT NULL,
  avatar          Utf8,
  game_id         Utf8 NOT NULL,
  yasna_id        Utf8 NOT NULL,
  result          Utf8 NOT NULL,
  score           Int32,
  max_score       Int32,
  time_ms         Int32 NOT NULL,
  transport       Utf8,
  is_bot          Bool,
  by_surrender    Bool,
  by_disconnect   Bool,
  ip_hash         Utf8,
  created_at      Timestamp NOT NULL,
  PRIMARY KEY (id),
  INDEX matches_by_game        GLOBAL ON (game_id, yasna_id, created_at),
  INDEX matches_by_user        GLOBAL ON (user_id, created_at),
  INDEX matches_by_device      GLOBAL ON (device_id, created_at)
);
