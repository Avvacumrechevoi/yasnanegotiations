# Бэкенд Ясны в Yandex Cloud

Ниже — сначала как всё устроено и обслуживается **сейчас**, потом историческая
инструкция «с нуля» (она пригодится, если разворачивать окружение заново).

## Файлы в этой папке

```
progress.js          — /progress: учебный прогресс, заметки, права (в пакете submit)
access.js            — /access/*: роли, полномочия, доступы, журнал (в пакете submit)
rooms-legacy.js      — /rooms/*: заглушка 410, старый транспорт PvP (в пакете submit)
auth-email.js        — /auth/email/*, /account: вход по почте и профиль (в пакете auth-telegram)
mailer.js            — отправка писем по SMTP (в пакете auth-telegram)
submit.js            — /submit: запись матча + разводка путей на progress/access/rooms
leaderboard.js       — /leaderboard: топ-N
auth-telegram.js     — /auth/telegram: вход через Telegram
content-fetch.js     — /content: Tier-2 overrides контента
content-publish.js   — /content/publish: публикация ревизии (только админ)
lenta-sbor.js        — функция yasna-lenta-sbor: обход каналов по таймеру
lenta-razbor.js      — разбор страниц t.me/s и RSS Rutube (без сети и базы)
lenta.js             — /lenta/*: чтение ленты и жалобы (в пакете auth-telegram)
proby/*.mjs          — прогоны ленты без сети и облака: node server/proby/proba-sbor.mjs
api-gateway.yaml     — спецификация шлюза, ИСТОЧНИК ПРАВДЫ
migrations/*.sql     — схема БД, применяется по порядку
schema.sql           — историческое описание первых таблиц
README.md            — этот файл
```

Исходника `/profile` здесь нет: функция `yasna-profile` живёт только в облаке.
Её нельзя переразвернуть, не переписав заново — учитывать при правках.

## Обслуживание

**Автодеплой.** `push` в `main`, задевающий `server/**`, выкатывает бэкенд сам
(`.github/workflows/deploy-backend.yml`): миграции → функции → тег `stable` →
спека шлюза → проверка прода. Если проверка не прошла, теги возвращаются на
прежние версии.

**Единственная ручная настройка** — секрет репозитория `YC_SA_KEY` со
авторизованным ключом сервисного аккаунта **`yasna-ci`** (`aje30jts5erm5c4r1cdh`):
Settings → Secrets and variables → Actions → `YC_SA_KEY`, значение — всё
содержимое json-файла ключа. Без секрета workflow не краснеет, а тихо
пропускается.

Выпустить ключ заново:

```bash
yc iam key create --service-account-id aje30jts5erm5c4r1cdh --output sa-key.json
```

`yasna-ci` — **отдельный** аккаунт от того, под которым работают функции
(`aje0k8v128i3gvatqah2`, у него только `invoker` + `ydb.editor` и деплоить он
не может). Права `yasna-ci`: `serverless.functions.admin`, `api-gateway.editor`,
`ydb.editor`, `iam.serviceAccounts.user`.

**Руками, если нужно:**

```bash
./scripts/apply-migrations.sh --status        # что применено из migrations/*.sql
./scripts/deploy-backend.sh submit            # собрать версию, прод не трогая
./scripts/deploy-backend.sh --promote submit  # и перевести stable
./scripts/deploy-gateway.sh --dry-run         # что изменится в шлюзе
./scripts/smoke-backend.sh                    # живость прода
```

**Откат — одна команда** (шлюз ссылается на тег, не на `$latest`):

```bash
yc serverless function version list --function-name yasna-submit
yc serverless function version set-tag --id <прежняя_версия> --tag stable
```

## Почтальон ленты (t.me из облака отвечает через раз)

`t.me` из облака Яндекса режется по пути (ТСПУ): 05.09.2026 у сборщика ленты
вышло **две удачи из одиннадцати** заходов, у всех четырёх каналов `udacha_at`
пустой. С обычной машины те же страницы приходят за 0,3–0,8 с. Ни VPC, ни NAT,
ни статический адрес этого не лечат — режут не нас, а дорогу.

Поэтому страницы возит **почтальон** — `scripts/pochtalon.mjs` по расписанию
`.github/workflows/lenta-pochtalon.yml` (раз в час, раннеры GitHub стоят вне
России, репозиторий публичный — минуты бесплатны). Он кладёт сырьё в тот же
бакет:

```
lenta/vhod/<канал>/stranica.html         страница t.me/s как есть
lenta/vhod/<канал>/kartinki/<sha1>.jpg   превью, sha1 от адреса картинки
lenta/vhod/<канал>/meta.json             когда снято, сколько записей
```

Сборщик работает по правилу **сначала сам, потом почтальон**: прямой заход
остаётся главным, сырьё берётся, только если своей дороги нет (обрыв или 5xx),
оно не старше **трёх часов** и канал в `meta.json` совпал с тем, за которым
шли. Разбирается сырьё тем же разборщиком — на слово ему не верят. В журнале
источника такой заход помечен `otkuda='pochtalon'`, картинки берутся из того же
сырья, а копии по-прежнему ложатся в `lenta/telegram/` (для ленты и телефонов
ничего не меняется). Ответ со смыслом (302 у закрытого превью, 404) почтальоном
не подменяется: причину надо видеть, а не прятать.

**Список каналов у почтальона зашит в файл** (`КАНАЛЫ` в `scripts/pochtalon.mjs`)
и должен совпадать с включёнными телеграм-строками `lenta_istochniki`: доступа к
базе у него нет и быть не должно.

**Чем почтальон доказывает бакету, что он свой.** Проверено 06.09.2026 с
зарубежного адреса: `storage.yandexcloud.net` отвечает за 0,4 с, а
`iam.api.cloud.yandex.net` и `api.cloud.yandex.net` не отдают даже
TCP-соединения. Раннеры GitHub стоят там же. Поэтому:

1. **`YC_STATIC_KEY_ID` + `YC_STATIC_KEY`** — статический ключ доступа
   **своего** аккаунта почтальона (`yasna-pochtalon`), подпись AWS SigV4
   считается на месте, наружу ходить не надо. Предпочтительный путь. Завести:
   `yc iam service-account create --name yasna-pochtalon`, дать ему
   `storage.uploader` на бакет с политикой «PUT только под `lenta/vhod/*`»,
   затем `yc iam access-key create --service-account-id <id yasna-pochtalon>`.
2. **`YC_POCHTALON_SA_KEY`** — авторизованный ключ того же аккаунта; путь через
   IAM, с раннера может не открыться. Если не открылся, почтальон пишет в лог,
   что делать.

**Ключ деплоя (`YC_SA_KEY`, аккаунт `yasna-ci`) почтальону не дают.** Бакет
`yasnalab.ru` — это сам живой сайт: статический ключ этого аккаунта в секретах
публичного репозитория означал бы право переписать `index.html` и
`docs/core/*.js` и выкатить любую функцию. Код почтальона пишет только под
`lenta/vhod/`, но ключ этой аккуратностью не ограничен. Перед первой поездкой
права стоит проверить: `yc resource-manager folder list-access-bindings --id
<folder>`; сам почтальон делает пробное касание бакета до всякой качки, поэтому
при нехватке права поездка краснеет сразу, а не после шести мегабайт превью.

Без обоих секретов задача идёт **сухим прогоном** (`--proba`): страницы
качаются, в бакет ничего не пишется. Тот же флаг — для проверки руками:

```bash
node scripts/pochtalon.mjs --proba                 # все каналы, ничего не кладём
node scripts/pochtalon.mjs --proba --kanal=neglinka78
```

## Грабли, которые уже стоили времени

- **Зависимости функций.** `ydb-sdk` — `^5.11.1` (версии 7.x в npm нет, README
  раньше врал). Обязательна peer-зависимость `@yandex-cloud/nodejs-sdk` **^2.0.0**:
  без неё функция стартует, но падает на metadata-авторизации и все обращения к
  БД дают 502. Версию 3.x не брать.
- **Миграции только через `ydb` CLI.** У `ydb-sdk` scheme- и table-клиенты сами
  приписывают `database` к пути, поэтому абсолютный путь удваивается и таблицы
  уезжают в `/<db>/ru-central1/<cloud>/<db>/<имя>`. Там их видит `describeTable`,
  но не видит query-движок: `SELECT` падает с «Cannot find table».
- **`ydb` CLI на macOS** не разрешает DNS через c-ares. Нужен
  `GRPC_DNS_RESOLVER=native` (скрипты выставляют сами).
- **Квота `serverless.functions.count` — 10, занято 6.** Было 10 из 10, поэтому
  `/progress`, `/access/*` и `/rooms/*` обслуживаются функцией `submit`, а вход
  по почте с профилем — функцией `auth-telegram` (`extras_for` в скрипте деплоя
  кладёт нужные модули в их пакеты). Четыре слота освободились после удаления
  legacy-функций `yasna-rooms-*`: их пути отвечает заглушка
  `server/rooms-legacy.js` честным 410 «обновите страницу». Новые эндпоинты
  теперь можно выносить в свои функции — логика для этого уже разделена по
  файлам.
- **YQL.** Нет `NULLS LAST`; в `GROUP BY` по выражению нужен алиас
  (`GROUP BY COALESCE(a,b) AS k`) и обращение по нему; коррелированный
  `NOT EXISTS` со ссылкой на внешний алиас не поддерживается; параметры
  строить только через `TypedValues` — ручные `{type:{typeId:'UTF8'}}` молча
  не биндятся.
- **Ошибки нельзя глотать.** Сломанный SQL в лидерборде годами отдавал HTTP 200
  с пустым списком и выглядел как «пока никто не играл».

## Шаг 0. Что нужно

- Российская карта или СБП (для подтверждения аккаунта YC, оплат не будет)
- Telegram (для создания бота через @BotFather)
- Терминал с установленным `yc` CLI ([инструкция установки](https://yandex.cloud/ru/docs/cli/quickstart))

## Шаг 1. Регистрация в Yandex Cloud (15 минут)

1. Перейди на [yandex.cloud](https://yandex.cloud) → войти через Yandex ID
2. Активировать **Free Tier** (бесплатный пробный период + бесконечные free лимиты)
3. Установи `yc` CLI:
   ```bash
   curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
   yc init
   ```
4. Запомни `cloud-id` и `folder-id` — пригодятся.

## Шаг 2. Создание YDB Serverless БД (10 минут)

```bash
yc ydb database create yasna-duel-db \
  --serverless \
  --location ru-central1
```

Получишь `endpoint` и `database` path, например:
```
endpoint:    grpcs://ydb.serverless.yandexcloud.net:2135
database:    /ru-central1/b1g.../etn.../yasna-duel-db
```

**Запомни эти значения — они нужны как ENV в функциях.**

Создай таблицы:
```bash
yc ydb sql --endpoint=<endpoint> --database=<database> \
  --file=server_schema.sql
```

(Или через UI: YC Console → YDB → база → SQL editor → вставь содержимое `server_schema.sql`).

## Шаг 3. Telegram Bot (5 минут)

1. В Telegram открой [@BotFather](https://t.me/BotFather)
2. Команда `/newbot`
3. Имя бота: `Ясна-Дуэль` (отображаемое)
4. Username: `YasnaDuelBot` (должен быть уникальный, оканчиваться на `Bot`)
5. **Запиши `bot_token`** — он секретный, никому не показывай.
6. Команда `/setdomain` → выбери своего бота → введи свой домен:
   ```
   avvacumrechevoi.github.io
   ```
   (Telegram разрешит Login Widget только с этого домена.)
7. (Опц.) `/setjoingroups Disable`, `/setdescription` — настройки бота.

## Шаг 4. Service Account для функций (5 минут)

```bash
yc iam service-account create yasna-duel-sa
yc resource-manager folder add-access-binding <FOLDER_ID> \
  --role serverless.functions.invoker \
  --subject serviceAccount:<SA_ID>
yc resource-manager folder add-access-binding <FOLDER_ID> \
  --role ydb.editor \
  --subject serviceAccount:<SA_ID>
```

## Шаг 5. Деплой Cloud Functions (20 минут)

Сгенерируй случайный JWT_SECRET (32+ байт):
```bash
JWT_SECRET=$(openssl rand -hex 32)
echo $JWT_SECRET   # сохрани, понадобится в трёх функциях
```

Для каждой функции:

### auth-telegram

```bash
mkdir -p /tmp/fn-auth && cd /tmp/fn-auth
cp <PATH>/server_function_auth_telegram.js index.js
cat > package.json <<EOF
{
  "name": "yasna-auth-telegram",
  "version": "1.0.0",
  "dependencies": { "ydb-sdk": "^5.11.1", "@yandex-cloud/nodejs-sdk": "^2.0.0" }
}
EOF

yc serverless function create --name yasna-auth-telegram
yc serverless function version create \
  --function-name yasna-auth-telegram \
  --runtime nodejs18 \
  --entrypoint index.handler \
  --memory 256m \
  --execution-timeout 10s \
  --service-account-id <SA_ID> \
  --source-path . \
  --environment BOT_TOKEN=<твой_bot_token>,JWT_SECRET=$JWT_SECRET,YDB_ENDPOINT=<endpoint>,YDB_DATABASE=<database>
```

### submit

Аналогично, без `BOT_TOKEN`:
```bash
mkdir -p /tmp/fn-submit && cd /tmp/fn-submit
cp <PATH>/server_function_submit.js index.js
cp /tmp/fn-auth/package.json .

yc serverless function create --name yasna-submit
yc serverless function version create \
  --function-name yasna-submit \
  --runtime nodejs18 \
  --entrypoint index.handler \
  --memory 256m \
  --execution-timeout 10s \
  --service-account-id <SA_ID> \
  --source-path . \
  --environment JWT_SECRET=$JWT_SECRET,YDB_ENDPOINT=<endpoint>,YDB_DATABASE=<database>
```

### leaderboard

```bash
mkdir -p /tmp/fn-lb && cd /tmp/fn-lb
cp <PATH>/server_function_leaderboard.js index.js
cp /tmp/fn-auth/package.json .

yc serverless function create --name yasna-leaderboard
yc serverless function version create \
  --function-name yasna-leaderboard \
  --runtime nodejs18 \
  --entrypoint index.handler \
  --memory 256m \
  --execution-timeout 10s \
  --service-account-id <SA_ID> \
  --source-path . \
  --environment YDB_ENDPOINT=<endpoint>,YDB_DATABASE=<database>
```

Запомни `function_id` каждой — нужны для API Gateway.

## Шаг 6. API Gateway (15 минут)

1. Открой `server_api_gateway.yaml` в любом редакторе
2. Замени плейсхолдеры:
   - `{AUTH_TELEGRAM_FUNCTION_ID}` → ID функции `yasna-auth-telegram`
   - `{SUBMIT_FUNCTION_ID}` → ID функции `yasna-submit`
   - `{LEADERBOARD_FUNCTION_ID}` → ID функции `yasna-leaderboard`
   - `{SERVICE_ACCOUNT_ID}` → ID сервисного аккаунта
3. Создай API Gateway:
   ```bash
   yc serverless api-gateway create \
     --name yasna-duel-api \
     --spec=server_api_gateway.yaml
   ```
4. Получишь URL вида `https://d5dXXXXXXXX.apigw.yandexcloud.net`

## Шаг 7. Подключить клиент (1 минута)

В `docs/preview/index.html` найди:
```html
<script>
  window.YASNA_LEADERBOARD_API = null;
  window.YASNA_TG_BOT = null;
</script>
```

Замени:
```html
<script>
  window.YASNA_LEADERBOARD_API = "https://d5dXXXXXXXX.apigw.yandexcloud.net";
  window.YASNA_TG_BOT = "YasnaDuelBot";
</script>
```

Пушнуть в репо:
```bash
git add docs/preview/index.html docs/index.html
git commit -m "feat: connect Yandex Cloud backend"
git push
```

GitHub Pages развернёт через 1-2 минуты. **Готово!**

## Проверка

1. Открой https://avvacumrechevoi.github.io/yasnanegotiations/preview/
2. Жми ⚔️ Дуэль → 📊 Статистика
3. Должна появиться плашка «Войти через Telegram» с виджетом
4. Нажми → разрешить → видишь свой ник + аватар
5. Сыграй один онлайн-матч (PeerJS) — должен прилететь в БД
6. Открой 🏆 Лидерборд — твой матч в топе

## Curl-тесты (для отладки)

```bash
# Submit anonymous
curl -X POST https://d5dXXX.apigw.yandexcloud.net/submit \
  -H "Content-Type: application/json" \
  -d '{
    "matchId":"test-1",
    "deviceId":"test-device",
    "nickname":"TestUser",
    "avatar":"🦊",
    "gameId":"race-cross",
    "yasnaId":"суток",
    "result":"win",
    "time":5400,
    "transport":"peerjs"
  }'

# Get leaderboard
curl "https://d5dXXX.apigw.yandexcloud.net/leaderboard?gameId=race-cross&yasnaId=суток&period=all&limit=10"
```

## Стоимость

После настройки free tier покрывает:
- **Cloud Functions**: 1M вызовов / месяц
- **YDB Serverless**: 1M операций / месяц + 10 GB хранилище
- **API Gateway**: 1M запросов / месяц

Расход на 1000 DAU ≈ 100k запросов/месяц = **0₽**.

Если перерастёшь free tier (десятки тысяч DAU): ~30–50₽/месяц.

## Troubleshooting

| Проблема | Причина | Решение |
|---|---|---|
| "Эта комната уже занята" в дуэли | PeerJS broker conflict | Перегенерировать код |
| 401 от /submit | Истёк JWT (30 дней) | Логин повторно |
| YDB query timeout | Cold start функции | Прогрева не делаем, при следующем запросе быстрее |
| "invalid signature" в /auth/telegram | Неверный BOT_TOKEN или Telegram изменил что-то | Проверь env var в функции |
| CORS error в браузере | API Gateway не отдаёт OPTIONS | Проверь YAML, что для каждого пути есть `options:` |

## Что НЕ делает этот backend (намеренно)

- ❌ Не хранит пароли (используем OAuth-провайдеров)
- ❌ Не синхронизирует историю матчей с локальной (только submit, не fetch)
- ❌ Не валидирует ход за ходом — только финальный результат
- ❌ Не проверяет ELO / ranking — простой sort by score+time

Эти фичи добавляются отдельным этапом (P5) при необходимости.
