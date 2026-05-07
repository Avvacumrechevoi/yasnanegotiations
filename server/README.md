# Деплой Yasna Duel Backend в Yandex Cloud

Полная инструкция от регистрации до работающего лидерборда. **Время: ~1.5 часа.** Стоимость в первый месяц: **0₽** (free tier).

## Файлы в этой папке

```
server_schema.sql                    — YDB-таблицы
server_function_auth_telegram.js     — Cloud Function: Telegram Login
server_function_submit.js            — Cloud Function: запись матча
server_function_leaderboard.js       — Cloud Function: чтение топ-N
server_api_gateway.yaml              — API Gateway конфиг
server_README.md                     — этот файл
```

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
  "dependencies": { "ydb-sdk": "^7.0.0" }
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
