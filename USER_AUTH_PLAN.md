# План регистрации пользователей и хранения дуэлей

Дата: 2026-05-07. Контекст: дуэль работает на анонимном `deviceId`. Хотим добавить «настоящих» пользователей.

## TL;DR

**Рекомендую трёхуровневую систему:**

```
LEVEL 0: Anonymous (deviceId)        ← текущее состояние, играть можно
   ↓ (опционально, в любой момент)
LEVEL 1: Telegram Login              ← один клик, 80% аудитории в РФ
   ↓ (опционально, для не-Telegram)
LEVEL 2: Yandex ID                   ← резерв для тех у кого нет TG
```

Игрок может играть без регистрации. Когда захочет лидерборд / cross-device sync / friends — привязывает Telegram (1 клик). Прогресс не теряется (existing deviceId линкуется к новому user_id).

**Бэкенд:** Yandex Cloud Function проверяет подпись провайдера → создаёт/находит user в YDB → выдаёт JWT. Клиент шлёт JWT с каждым POST `/submit`.

## 1. Что значит «регистрация» в дуэле

Не классическая «введите email и пароль». Современная регистрация решает 4 задачи:

| Задача | Как решается |
|---|---|
| **Уникальная идентификация** | OAuth-провайдер (Telegram/Yandex) выдаёт устойчивый ID |
| **Защита от дублей** | На сервере смотрим по `(provider, provider_user_id)` |
| **Восстановление при потере устройства** | Логинись через того же провайдера на новом устройстве |
| **Защита приватности** | Не храним пароли (нечего терять) |

## 2. Опции для российской аудитории

### 🥇 Telegram Login Widget (рекомендую)

**Что это:** Виджет, который Telegram размещает на твоём сайте. Клик → открывает Telegram → подтверждаешь авторизацию → возвращает JSON с подписью.

**Что получаем:**
```json
{
  "id": 12345678,                    // telegram user_id
  "first_name": "Алиса",
  "last_name": "",
  "username": "alice_durov",
  "photo_url": "https://t.me/i/userpic/320/...",
  "auth_date": 1778140678,
  "hash": "..."                       // HMAC-SHA256 для проверки на сервере
}
```

**Плюсы:**
- 100% работает в РФ (Telegram не блокирован)
- ~80 миллионов активных пользователей в РФ
- Нулевая стоимость, никаких лимитов
- Авто-фото профиля (не надо выбирать аватар)
- Один клик авторизации

**Минусы:**
- Нужен Telegram Bot (5 минут создать через @BotFather)
- Не у всех есть Telegram (~5-10% не используют)

**Реализация:**
1. Создаёшь бота через @BotFather, получаешь token
2. Через @BotFather: `/setdomain` → указываешь свой домен
3. На сайте `<script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="YasnaDuelBot" data-onauth="onTelegramAuth(user)">`
4. Сервер проверяет подпись через HMAC с bot_token → возвращает JWT

### 🥈 Yandex ID (резерв)

**Что это:** OAuth провайдер от Яндекса. Аналог «Войти через Google», но российский.

**Что получаем:**
```json
{
  "id": "1234567890",                // yandex user_id
  "login": "alice",
  "real_name": "Алиса Иванова",
  "first_name": "Алиса",
  "last_name": "Иванова",
  "default_email": "alice@yandex.ru",
  "is_avatar_empty": false,
  "default_avatar_id": "..."
}
```

**Плюсы:**
- Российский провайдер
- Бесплатный, без лимитов
- Аудитория Яндекс-сервисов (~80M)
- Получаем email (опционально)

**Минусы:**
- Чуть сложнее интеграция (OAuth 2.0 redirect flow)
- Нужно регистрировать app в Yandex OAuth Console

### 🥉 VK ID (опционально)

Аналогично Yandex, но через ВКонтакте. Тоже OAuth 2.0. Не критично, можно добавить позже.

### Email + Magic Link (universal fallback)

**Что это:** Игрок вводит email → сервер шлёт ссылку с одноразовым токеном → клик → авторизован.

**Плюсы:**
- Работает у всех с email
- Без паролей
- Низкая friction

**Минусы:**
- Нужен email-провайдер (Yandex SES, Resend, ~бесплатно до 100/день)
- 5-10% писем попадают в спам
- Friction выше чем у Telegram

### Phone + SMS-код

Для России есть SMS-провайдеры (SMS.ru, SMSC). ~1.5₽ за SMS. **Не рекомендую для MVP** — слишком дорого + лишний шаг.

### Анонимный режим (текущее состояние)

`deviceId` UUID v4. Работает для одиночных целей. Сохраняется как fallback — кто не хочет регистрироваться, играет так. **Оставляем!**

## 3. Сравнительная таблица

| Опция | Friction | Cost | Reach в РФ | Recommended |
|---|---|---|---|---|
| Anonymous (deviceId) | 0 кликов | $0 | 100% | ✅ Default |
| Telegram Login | 1 клик | $0 | ~80% | ✅ Primary |
| Yandex ID | 2 клика (OAuth redirect) | $0 | ~70% | ✅ Secondary |
| VK ID | 2 клика | $0 | ~80% | ⚠️ позже |
| Email magic link | 3 шага (ввести email, открыть письмо) | ~$0 | ~95% | ⚠️ universal fallback |
| Phone SMS | 3 шага | $0.02/SMS | ~99% | ❌ дорого |
| Email + пароль | 4 шага + восстановление | ~$0 | 100% | ❌ устарело |

**Вывод:** Telegram + Yandex ID + Anonymous закрывают ~99% аудитории.

## 4. Schema YDB

### Таблица `users`
```sql
CREATE TABLE users (
  user_id          String NOT NULL,    -- внутренний UUID
  nickname         Utf8 NOT NULL,
  avatar           Utf8,
  
  -- Привязки к провайдерам (один или несколько может быть)
  tg_user_id       Int64,              -- telegram id (если связан)
  yandex_user_id   String,             -- yandex id
  vk_user_id       Int64,              -- vk id (на будущее)
  email            Utf8,               -- если регистрировался по email
  
  -- Исходные deviceId (для миграции — какие устройства принадлежат user)
  -- Хранится в отдельной таблице device_links
  
  created_at       Timestamp NOT NULL,
  last_seen_at     Timestamp NOT NULL,
  
  PRIMARY KEY (user_id)
);

-- Индексы для быстрого поиска по провайдеру
CREATE INDEX users_by_tg ON users(tg_user_id);
CREATE INDEX users_by_yandex ON users(yandex_user_id);
CREATE INDEX users_by_email ON users(email);
```

### Таблица `device_links`
```sql
-- Привязка deviceId → user_id. Один user может иметь много устройств.
CREATE TABLE device_links (
  device_id        String NOT NULL,    -- UUID v4 из browser localStorage
  user_id          String NOT NULL,
  linked_at        Timestamp NOT NULL,
  user_agent       Utf8,               -- для анти-фрода (опционально)
  PRIMARY KEY (device_id)
);

CREATE INDEX device_links_by_user ON device_links(user_id);
```

### Таблица `matches` (обновлённая)
```sql
CREATE TABLE matches (
  id              String NOT NULL,
  user_id         String,                -- nullable — для анонимных матчей
  device_id       String NOT NULL,       -- всегда есть
  game_id         String NOT NULL,
  yasna_id        String NOT NULL,
  result          String NOT NULL,
  score           Int32,
  max_score       Int32,
  time_ms         Int32 NOT NULL,
  transport       String,
  is_bot          Bool DEFAULT false,
  by_surrender    Bool DEFAULT false,
  signature       String,
  created_at      Timestamp NOT NULL,
  PRIMARY KEY (id)
);

CREATE INDEX matches_by_user_game ON matches(user_id, game_id, yasna_id, created_at);
CREATE INDEX matches_by_game ON matches(game_id, yasna_id, created_at);
```

**Ключевое решение:** `user_id` nullable. Анонимные игроки попадают в leaderboard под deviceId-based записью; зарегистрированные — под user_id.

### Таблица `auth_tokens` (для refresh)
```sql
CREATE TABLE auth_tokens (
  jti              String NOT NULL,    -- JWT id
  user_id          String NOT NULL,
  issued_at        Timestamp NOT NULL,
  expires_at       Timestamp NOT NULL,
  revoked          Bool DEFAULT false,
  PRIMARY KEY (jti)
);

CREATE INDEX tokens_by_user ON auth_tokens(user_id, expires_at);
```

## 5. Auth flow

### 5.1 Anonymous → Registered (Telegram)

```
1. Игрок играет в дуэль анонимно (deviceId UUID).
2. Хочет лидерборд → жмёт "Войти через Telegram".
3. Telegram Widget: один клик подтвердить → возвращает JSON с hash.
4. Клиент: POST /auth/telegram { telegram_data, device_id }
5. Сервер:
   a. Проверяет HMAC подпись (через bot_token)
   b. Проверяет auth_date < 5 минут (anti-replay)
   c. Ищет users WHERE tg_user_id = X
   d. Если нет — создаёт user(user_id=uuid, tg_user_id, nickname=first_name, avatar=photo_url)
   e. INSERT device_links(device_id, user_id) — связываем устройство с user
   f. Опционально: UPDATE matches SET user_id = X WHERE device_id = Y AND user_id IS NULL — привязываем старые матчи
   g. Выдаёт JWT с claim {sub: user_id, exp: now+30days}
6. Клиент: сохраняет JWT в localStorage 'yasna_duel_token', включает в Authorization header
```

### 5.2 Cross-device login

```
1. На втором устройстве — другой deviceId
2. Жмёт "Войти через Telegram" → тот же telegram_user_id
3. Сервер находит user_id по tg_user_id → возвращает JWT
4. INSERT device_links(new_device_id, user_id) — теперь у user два устройства
5. История матчей user видна с обоих
```

### 5.3 Сервер-side проверка JWT при submit

```js
async function handleSubmit(req){
  let userId = null;
  const auth = req.headers.authorization;
  if(auth?.startsWith('Bearer ')){
    const token = auth.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.sub;
    } catch(_){ /* invalid token, treat as anonymous */ }
  }
  
  await ydb.execute(`
    INSERT INTO matches (id, user_id, device_id, ...)
    VALUES ($id, $user_id, $device_id, ...)
  `, { id: req.body.matchId, user_id: userId, device_id: req.body.deviceId, ... });
  
  return { ok: true };
}
```

## 6. Что хранится где

### Browser localStorage (без изменений + добавляется token)
```
yasna_duel_profile    { nickname, avatar, deviceId, createdAt }
yasna_duel_token      <JWT строка>     ← NEW
yasna_duel_user       { user_id, tg_user_id?, nickname, avatar }  ← NEW (snapshot)
yasna_duel_data       { matches[], records, streaks, totals }
yasna_duel_pending    [matches to send]
yasna_duel_achievements
yasna_duel_daily
```

### YDB (на сервере)
```
users         (user_id, провайдеры, nickname, avatar, ...)
device_links  (device_id, user_id)
matches       (id, user_id?, device_id, game_id, ...)
auth_tokens   (jti, user_id, expires_at)
```

## 7. Миграция существующих deviceId-only пользователей

**Автоматическая** (при первом логине):

1. Игрок играл анонимно → 50 матчей в `yasna_duel_data` под deviceId X
2. Логинится через Telegram впервые
3. Сервер: создаёт user_id Y, INSERT device_links(X, Y)
4. Сервер: UPDATE matches SET user_id = Y WHERE device_id = X AND user_id IS NULL
5. Все 50 матчей теперь под Y. Топ-100 лидерборда видит Алису.

**Никаких потерь данных.**

## 8. UI добавления (~150 строк)

### 8.1 Кнопка «Войти» в Stats Screen
```
┌──────────────────────────────────────┐
│ 📊 Ваша статистика                   │
│                                      │
│ 50 матчей · 32 победы · 64% винрейт │
│                                      │
│ ⚠ Вы играете анонимно. Прогресс    │
│   доступен только на этом устройстве.│
│                                      │
│ [📱 Войти через Telegram]           │
│ [🌐 Войти через Yandex ID]          │
│                                      │
└──────────────────────────────────────┘
```

После логина:
```
┌──────────────────────────────────────┐
│ 📊 Ваша статистика                   │
│                                      │
│ Привет, 🦊 alice (@alice_durov)!    │
│                                      │
│ 50 матчей · 32 победы · 64% винрейт │
│                                      │
│ Вы #142 в глобальном рейтинге       │
│                                      │
│ [Выйти]                              │
└──────────────────────────────────────┘
```

### 8.2 Telegram Login Widget
Один тег, остальное Telegram делает сам:
```html
<script async src="https://telegram.org/js/telegram-widget.js?22"
        data-telegram-login="YasnaDuelBot"
        data-size="medium"
        data-onauth="onTelegramAuth(user)"
        data-request-access="write">
</script>
<script>
  window.onTelegramAuth = (user) => {
    fetch(API_BASE + '/auth/telegram', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ ...user, device_id: getDeviceId() })
    }).then(r => r.json()).then(data => {
      localStorage.setItem('yasna_duel_token', data.token);
      localStorage.setItem('yasna_duel_user', JSON.stringify(data.user));
      window.location.reload();
    });
  };
</script>
```

### 8.3 Изменения в YasnaLeaderboardClient
Включаем Authorization header:
```js
async _fetch(path, opts){
  const headers = opts?.headers || {};
  const token = localStorage.getItem('yasna_duel_token');
  if(token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(this.baseUrl + path, { ...opts, headers });
}
```

## 9. Бэкенд (~200 строк Cloud Function)

```js
// /auth/telegram
async function authTelegram(req){
  const { id, first_name, photo_url, auth_date, hash, device_id } = req.body;
  
  // 1. Verify HMAC
  const dataCheckString = Object.entries({ id, first_name, photo_url, auth_date })
    .filter(([k, v]) => v != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = createHash('sha256').update(BOT_TOKEN).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if(expectedHash !== hash) throw new Error('Invalid hash');
  
  // 2. Anti-replay
  if(Date.now()/1000 - auth_date > 300) throw new Error('Auth data too old');
  
  // 3. Find or create user
  let user = await ydb.queryOne('SELECT * FROM users WHERE tg_user_id = ?', [id]);
  if(!user){
    const userId = crypto.randomUUID();
    await ydb.execute(
      'INSERT INTO users (user_id, tg_user_id, nickname, avatar, created_at, last_seen_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [userId, id, first_name, photo_url]
    );
    user = { user_id: userId, tg_user_id: id, nickname: first_name, avatar: photo_url };
  } else {
    await ydb.execute('UPDATE users SET last_seen_at = NOW() WHERE user_id = ?', [user.user_id]);
  }
  
  // 4. Link device
  await ydb.execute(
    'UPSERT INTO device_links (device_id, user_id, linked_at) VALUES (?, ?, NOW())',
    [device_id, user.user_id]
  );
  
  // 5. Migrate previous anonymous matches
  await ydb.execute(
    'UPDATE matches SET user_id = ? WHERE device_id = ? AND user_id IS NULL',
    [user.user_id, device_id]
  );
  
  // 6. Issue JWT
  const token = jwt.sign({
    sub: user.user_id,
    nickname: user.nickname,
    iat: Math.floor(Date.now()/1000),
    exp: Math.floor(Date.now()/1000) + 30*24*3600,
  }, JWT_SECRET);
  
  return { token, user };
}
```

## 10. Privacy / 152-ФЗ

| Что | Как обрабатываем |
|---|---|
| Имя | Хранится (никнейм публичный) |
| Email | Только для magic-link, не публикуется |
| Phone | Не используем |
| IP | Хешируем для rate-limit, не храним полным |
| Telegram username | Публичный по природе (можно показать или скрыть) |
| Photo | URL ссылка на CDN Telegram, мы её не копируем |
| Право на удаление | DELETE user → каскадный delete во всех таблицах |
| Cookie consent | Не нужен (используем localStorage не cookies) |

**152-ФЗ:** дуэль обрабатывает минимум персональных данных, под закон попадает слабо. Если будет вопрос — оформляем согласие в форме регистрации (одна галочка).

## 11. План реализации

### Фаза 1: Anonymous registration (P0, без provider) — ~2 часа
- ✅ Уже сделано: deviceId есть, профиль с nickname+avatar есть
- Сейчас можно играть анонимно

### Фаза 2: Сервер базовый (P1) — ~3 часа
- Yandex Cloud + YDB
- Tables: users, device_links, matches
- Cloud Functions: /submit, /leaderboard
- Anonymous матчи попадают в БД через deviceId
- Лидерборд работает (без аккаунтов)

### Фаза 3: Telegram Login (P2) — ~2 часа
- Создание Telegram Bot через @BotFather
- /auth/telegram endpoint
- Виджет на сайте
- JWT token в localStorage
- Migration: при логине UPDATE matches SET user_id

### Фаза 4: Yandex ID (P3, опционально) — ~3 часа
- Регистрация app в Yandex OAuth Console
- /auth/yandex endpoint (callback handler)
- Redirect flow
- Аналогичная миграция

### Фаза 5: Account management (P4, опционально) — ~2 часа
- Изменить ник
- Сменить аватар
- Привязать второй провайдер (TG + Yandex одновременно)
- Выйти / удалить аккаунт

**Итого:** ~12 часов для полноценной системы регистрации с двумя провайдерами.

## 12. Стоимость

| Фаза | Cost |
|---|---|
| Anonymous (current) | $0 |
| YDB + Cloud Functions | $0 (free tier) |
| Telegram Login | $0 |
| Yandex ID | $0 |
| Email magic link (если делать) | ~$0–10/мес (Yandex SES) |

**Аутентификация полностью бесплатная для российской аудитории.**

## 13. Ответ на вопрос: как вести учет пользователей

**Вкратце:**

```
1. Каждый игрок имеет deviceId (UUID) с момента первой игры — анонимный учёт уже работает.

2. На сервере таблица users: user_id + связи с провайдерами (telegram_id / yandex_id).
   Таблица device_links: одно устройство привязано к одному user_id.

3. Игрок может играть без регистрации — учитываемся под deviceId.

4. Когда захочет — нажимает "Войти через Telegram" (1 клик).
   Сервер автоматически создаёт user, привязывает существующий deviceId,
   мигрирует все прошлые матчи под новый user_id.

5. На втором устройстве — снова логин через Telegram — находим user по telegram_id,
   привязываем новый deviceId, история матчей доступна с обоих.

6. Дуэль шлёт JWT-токен в Authorization header с каждым POST /submit.
   Сервер декодирует → знает user_id → INSERT в matches с user_id.

7. Лидерборд группирует по user_id (если есть) или по device_id (если анонимный).
```

**Что нужно от тебя для запуска:**
1. Yandex Cloud аккаунт + биллинг (15 минут, бесплатно через СБП)
2. Telegram Bot через @BotFather (5 минут, бесплатно): `/newbot` → имя → username → token
3. (Опционально) Yandex OAuth app (10 минут): https://oauth.yandex.ru → register

После — можно начинать имплементацию (могу написать всё за ~3-4 часа моей работы).

## 14. Что я могу сделать сейчас

**Опция A:** Дописать клиентскую часть auth (Telegram widget, JWT хранение, миграция UI). Сервер останется stub — кнопка «Войти через TG» будет, но без серверной части не работает. ~1 час.

**Опция B:** Написать ВЕСЬ серверный код (Cloud Function + YDB schema + миграции + Telegram verify + JWT). Тебе деплой через `yc cli`. ~3 часа.

**Опция C:** Полная имплементация обеих сторон. Готовый продукт. ~4 часа.

Скажи **«клиент»**, **«сервер»** или **«полный»** — продолжу.
