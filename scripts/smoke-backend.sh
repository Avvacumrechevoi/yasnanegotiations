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

# 3. Прогресс: чтение по несуществующему устройству — пустой, но валидный ответ
check "GET /progress"         200 "$GW/progress?deviceId=smoke-check"

# 4. Контент Tier-2
check "GET /content"          200 "$GW/content"

# 5. Валидация submit: заведомо неполное тело обязано получить 400,
#    а не 500 — это отличает «функция работает» от «функция падает».
check "POST /submit (мусор)"  400 -X POST -H 'Content-Type: application/json' \
  --data-raw '{"nope":true}' "$GW/submit"

echo
if [ "$fails" = "0" ]; then echo "Все проверки прошли."; exit 0; fi
echo "Провалено проверок: $fails"; exit 1
