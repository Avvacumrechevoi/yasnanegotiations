#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Проверка живости бэкенда через API Gateway.
#
# ЗАЧЕМ. Автодеплой переводит тег stable сам, без человека. Чтобы это было
# не страшно, после перевода прод проверяется этим скриптом, и при провале
# workflow возвращает прежние версии. Ровно этого не хватило в тот раз,
# когда деплой с недостающей peer-зависимостью увёл все обращения к БД
# в 502 и заметно это стало уже на живых запросах.
#
# Проверки намеренно НЕ пишут данных: только чтения и одна заведомо
# невалидная отправка, которая должна получить 400.
#
# ИСПОЛЬЗОВАНИЕ:  ./scripts/smoke-backend.sh [базовый_url]
# ═══════════════════════════════════════════════════════════════════
set -uo pipefail

GW="${1:-${YASNA_API:-https://d5dmdje8c5mk8811il5j.iwzqm34r.apigw.yandexcloud.net}}"
fails=0

check(){                       # check <название> <ожидаемый_код> <curl-аргументы...>
  local name="$1" want="$2"; shift 2
  local body code
  body="$(curl -sS -m 25 -w '\n%{http_code}' "$@" 2>&1)" || { echo "  ✗ $name — запрос не выполнился"; fails=$((fails+1)); return; }
  code="$(printf '%s' "$body" | tail -1)"
  body="$(printf '%s' "$body" | sed '$d')"
  if [ "$code" = "$want" ]; then
    echo "  ✓ $name (HTTP $code)"
    printf '%s' "$body" | head -c 100 | sed 's/^/      /'
    echo
  else
    echo "  ✗ $name — ожидался HTTP $want, получен $code"
    printf '%s' "$body" | head -c 300 | sed 's/^/      /'
    echo
    fails=$((fails+1))
  fi
}

echo "Проверяю $GW"

# 1. Лидерборд: живой SQL + доступ к БД. Пустой список — это тоже успех,
#    важен код 200 (раньше сломанный запрос отдавал 200 с пустым items —
#    поэтому ниже отдельно смотрим, что в ответе есть поле items).
check "GET /leaderboard"      200 "$GW/leaderboard?gameId=turnir&yasnaId=%D1%81%D1%83%D1%82%D0%BE%D0%BA&period=all&limit=3"
curl -sS -m 25 "$GW/leaderboard?gameId=turnir&yasnaId=%D1%81%D1%83%D1%82%D0%BE%D0%BA&limit=3" \
  | grep -q '"items"' || { echo "  ✗ в ответе лидерборда нет поля items"; fails=$((fails+1)); }

# 2. Профиль игрока
check "GET /profile"          200 "$GW/profile?deviceId=smoke-check&limit=5"

# 3. Прогресс. Гостевое пространство требует секрет устройства, поэтому
#    проверяем ОБЕ стороны: со своим секретом пускает, с чужим — нет.
#    Отказ здесь так же важен, как допуск: до введения секрета чужой прогресс и
#    личные заметки читались и затирались по одному лишь знанию идентификатора
#    (воспроизведено на живом проде).
check "GET /progress (свой секрет)" 200 -H 'X-Device-Secret: smoke-secret-do-not-reuse' \
      "$GW/progress?deviceId=smoke-check"
# Контракт прав: клиентский core/access.js читает роль из ответа /progress.
# Если поле пропало (откат на старую версию, сломанный resolveAccess) —
# гейты у всех тихо уходят в fail-open, и заметить это можно только здесь.
body=$(curl -s -H 'X-Device-Secret: smoke-secret-do-not-reuse' "$GW/progress?deviceId=smoke-check")
if printf '%s' "$body" | grep -q '"role"'; then
  echo "  ✓ GET /progress отдаёт role (контракт core/access.js)"
else
  echo "  ✗ GET /progress БЕЗ поля role — клиентские гейты ослепли"; fails=$((fails+1))
fi
check "GET /progress (чужой секрет → 403)" 403 -H 'X-Device-Secret: wrong-secret' \
      "$GW/progress?deviceId=smoke-check"
check "GET /progress (без секрета → 403)" 403 "$GW/progress?deviceId=smoke-check"

# 4. Контент Tier-2
check "GET /content"          200 "$GW/content"

# 5. Валидация submit: заведомо неполное тело обязано получить 400,
#    а не 500 — это отличает «функция работает» от «функция падает».
check "POST /submit (мусор)"  400 -X POST -H 'Content-Type: application/json' \
  --data-raw '{"nope":true}' "$GW/submit"

# 5а. Целостность рейтинга: корректное по форме тело БЕЗ доказательства
#     (ни JWT, ни X-Device-Secret) обязано получить 401. Именно эта дыра
#     позволяла набить рейтинг одной командой curl. Проверка ничего не пишет:
#     отказ происходит до обращения к таблице matches.
check "POST /submit (без доказательства → 401)" 401 -X POST -H 'Content-Type: application/json' \
  --data-raw '{"matchId":"smoke-no-proof","deviceId":"smoke-check","nickname":"smoke","gameId":"turnir","yasnaId":"суток","result":"win","time":5000}' \
  "$GW/submit"
# 5б-0. Чужой секрет к известному устройству — 403, а не запись матча.
check "POST /submit (чужой секрет → 403)" 403 -X POST -H 'Content-Type: application/json' \
  -H 'X-Device-Secret: wrong-secret' \
  --data-raw '{"matchId":"smoke-bad-secret","deviceId":"smoke-check","nickname":"smoke","gameId":"turnir","yasnaId":"суток","result":"win","time":5000}' \
  "$GW/submit"

# 5б. НОВЫЕ ЭНДПОИНТЫ. Раньше проверка их не касалась вовсе — а откат в CI
# срабатывает ТОЛЬКО по её результату. То есть сломанный вход по почте, профиль
# или роли уехали бы в прод и остались там: smoke зелёный, откат не сработал.
# Проверяем отказы (они не пишут данных) и один безопасный ответ.
check "GET /access/me (публично)"        200 "$GW/access/me"
check "GET /access/people без токена"    401 "$GW/access/people"
check "GET /account без токена"          401 "$GW/account"
check "GET /auth/email/selftest без токена" 401 "$GW/auth/email/selftest"
check "POST /auth/email/request (мусор)" 400 -X POST -H 'Content-Type: application/json' \
      --data-raw '{"email":"не-почта"}' "$GW/auth/email/request"
check "POST /content/publish без пароля" 401 -X POST -H 'Content-Type: application/json' \
      --data-raw '{"data":{}}' "$GW/content/publish"
# Метод именно POST: в спеке шлюза у /rooms/create объявлен post, и GET даёт
# 405 от самого шлюза, не доходя до заглушки.
check "POST /rooms/create (легаси → 410)" 410 -X POST -H 'Content-Type: application/json' \
      --data-raw '{}' "$GW/rooms/create"

# 6. ГЛУБОКАЯ проверка входа через Telegram.
#
# Зачем именно так. Проверка «невалидная подпись → 401» бесполезна: функция
# падала ПОСЛЕ проверки подписи, на первом обращении к БД, и вход был мёртв в
# проде (BadRequest 400010 «Unsupported data type: PRIMITIVE_TYPE_ID_UNSPECIFIED»
# из-за ручного формата параметров). Поэтому логинимся по-настоящему:
# подписываем данные ботовым токеном, который берём из окружения функции.
# Тестовая личность одна и та же (tg id 999000111, «Проверка») — на первом
# прогоне она создаётся, дальше проверяется ветка поиска существующего
# пользователя. Тело ответа не печатаем: там JWT.
if command -v yc >/dev/null 2>&1 && [ "${SMOKE_DEEP:-1}" = "1" ]; then
  ver="$(yc serverless function version list --function-name yasna-auth-telegram --format json 2>/dev/null \
        | python3 -c "import sys,json;d=json.load(sys.stdin);d.sort(key=lambda x:x.get('created_at',''),reverse=True);print(d[0]['id'])" 2>/dev/null || true)"
  bt=""
  [ -n "$ver" ] && bt="$(yc serverless function version get "$ver" --format json 2>/dev/null \
        | python3 -c "import sys,json;print(json.load(sys.stdin).get('environment',{}).get('BOT_TOKEN',''))" 2>/dev/null || true)"
  if [ -n "$bt" ]; then
    payload="$(BT="$bt" python3 - <<'PY'
import hmac, hashlib, json, os, time
bt = os.environ['BT'].encode()
f = {'id': 999000111, 'first_name': 'Проверка', 'username': 'smoke_probe', 'auth_date': int(time.time())}
dcs = '\n'.join('%s=%s' % (k, f[k]) for k in sorted(f))
f['hash'] = hmac.new(hashlib.sha256(bt).digest(), dcs.encode(), hashlib.sha256).hexdigest()
f['device_id'] = 'smoke-login-probe'
print(json.dumps(f, ensure_ascii=False))
PY
)"
    code="$(curl -sS -m 25 -o /tmp/.smoke_login -w '%{http_code}' -X POST \
            -H 'Content-Type: application/json' --data-raw "$payload" "$GW/auth/telegram" 2>&1 || echo 000)"
    if [ "$code" = "200" ] && grep -q '"token"' /tmp/.smoke_login; then
      echo "  ✓ POST /auth/telegram — реальный вход выдал токен"
    else
      echo "  ✗ POST /auth/telegram — вход не работает (HTTP $code)"
      head -c 300 /tmp/.smoke_login | sed 's/^/      /'; echo
      fails=$((fails+1))
    fi
    rm -f /tmp/.smoke_login
  else
    echo "  ⓘ BOT_TOKEN недоступен — глубокая проверка входа пропущена"
  fi
else
  echo "  ⓘ yc CLI нет (или SMOKE_DEEP=0) — глубокая проверка входа пропущена"
fi

echo
if [ "$fails" = "0" ]; then echo "Все проверки прошли."; exit 0; fi
echo "Провалено проверок: $fails"; exit 1
