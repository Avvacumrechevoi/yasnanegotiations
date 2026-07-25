#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Деплой облачных функций Ясны в Yandex Cloud.
#
# ЗАЧЕМ СКРИПТ. Раньше бэкенд выкатывался руками по README, и это дало класс
# проблем «код в репо ≠ то, что в облаке»: whitelist gameId годами не знал
# действующих режимов, а сломанный SQL в лидерборде жил незамеченным.
# Плюс сам README врал про версию зависимости (см. ниже), из-за чего первая
# же попытка сборки падала.
#
# ЧТО ДЕЛАЕТ (для каждой функции):
#   1. собирает пакет: server/<file>.js → index.js + package.json с ТОЧНЫМИ
#      зависимостями (ydb-sdk + ОБЯЗАТЕЛЬНАЯ peer @yandex-cloud/nodejs-sdk);
#   2. переносит окружение и параметры 1:1 из текущей версии — ничего не теряя
#      (JWT_SECRET, YDB_*, ALLOW_ORIGIN живут только в облаке, в репо их нет);
#   3. создаёт новую версию (она становится $latest);
#   4. НЕ переключает прод: шлюз прибит к тегу stable (см. ниже). Промоушен —
#      отдельным шагом после проверки: --promote.
#
# ПОЧЕМУ ТЕГ stable. API Gateway ссылается на функцию с `tag: stable`, а не на
# $latest. Это даёт то, чего раньше не было — откат одной командой:
#   yc serverless function version set-tag --id <старая_версия> --tag stable
# Без этого сломанный деплой мгновенно уносил прод в 502 (проверено на себе).
#
# ЗАВИСИМОСТИ ФУНКЦИЙ — не менять наугад:
#   ydb-sdk                    ^5.11.1  (в npm НЕТ версии 7.x, README ошибался)
#   @yandex-cloud/nodejs-sdk   ^2.0.0   peer-зависимость ydb-sdk; без неё
#     функция стартует, но падает на metadata-авторизации:
#     «Cannot find module '@yandex-cloud/nodejs-sdk/dist/token-service/
#      metadata-token-service'» → 502 на всех путях, которые трогают БД.
#     Версию 3.x НЕ брать: ydb-sdk требует ^2.
#
# ИСПОЛЬЗОВАНИЕ:
#   ./scripts/deploy-backend.sh                      # все функции, без промоушена
#   ./scripts/deploy-backend.sh submit leaderboard   # только указанные
#   ./scripts/deploy-backend.sh --promote submit     # деплой + перевод stable
#
# Требуется: yc CLI с активным профилем (yc config list).
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SA_ID="${YC_SA_ID:-aje0k8v128i3gvatqah2}"
RUNTIME="${YC_RUNTIME:-nodejs16}"

# имя функции → файл исходника.
# БЕЗ `declare -A`: в macOS штатный bash — 3.2, ассоциативных массивов там нет,
# и скрипт падал ещё до первого деплоя («submit: unbound variable»).
# Держим POSIX-подобную форму, чтобы одинаково работало локально и в CI.
# progress здесь НЕТ намеренно: server/progress.js уезжает в пакете submit
# (extras_for), своей функции у него нет — квота serverless.functions.count
# исчерпана. Оставь его в списке — и деплой «всех функций» будет падать на
# попытке создать yasna-progress.
ALL_NAMES="submit leaderboard auth-telegram content-fetch content-publish"
src_for(){
  case "$1" in
    submit)          echo submit.js ;;
    leaderboard)     echo leaderboard.js ;;
    auth-telegram)   echo auth-telegram.js ;;
    content-fetch)   echo content-fetch.js ;;
    content-publish) echo content-publish.js ;;
    progress)        echo progress.js ;;
    *)               echo "" ;;
  esac
}
# Дополнительные модули в пакете функции. submit обслуживает ещё и /progress
# (квота на число функций в облаке исчерпана — разбор в шапке server/submit.js),
# поэтому progress.js уезжает вместе с ним и подключается через require.
extras_for(){
  case "$1" in
    submit) echo progress.js ;;
    *)      echo "" ;;
  esac
}

# Откуда взять окружение при ПЕРВОМ деплое функции: своих версий ещё нет, а
# YDB_*/JWT_SECRET/ALLOW_ORIGIN живут только в облаке (в репозитории их нет и
# быть не должно). Берём у уже настроенной функции с тем же набором.
env_donor_for(){
  case "$1" in
    progress) echo yasna-submit ;;
    *)        echo "" ;;
  esac
}

PROMOTE=0
TARGETS=""
for a in "$@"; do
  if [ "$a" = "--promote" ]; then PROMOTE=1; else TARGETS="$TARGETS $a"; fi
done
[ -n "$(echo "$TARGETS" | tr -d ' ')" ] || TARGETS="$ALL_NAMES"

command -v yc >/dev/null || { echo "yc CLI не найден в PATH"; exit 1; }

for short in $TARGETS; do
  file="$(src_for "$short")"
  [[ -n "$file" ]] || { echo "неизвестная функция: $short"; exit 1; }
  fn="yasna-$short"
  src="$REPO/server/$file"
  [[ -f "$src" ]] || { echo "нет исходника: $src"; exit 1; }

  echo "──────── $fn ────────"
  # node есть в CI, но не обязан быть на машине разработчика (на рабочем маке его
  # нет вообще — бандлы собираются в Actions). Проверяем синтаксис, если можем,
  # и не блокируем деплой из-за отсутствия интерпретатора.
  if command -v node >/dev/null; then
    node --check "$src" || { echo "  ✗ синтаксическая ошибка, пропускаю"; exit 1; }
  else
    echo "  ⓘ node не найден — проверка синтаксиса пропущена (в CI она выполняется)"
  fi

  dir="$(mktemp -d)"
  cp "$src" "$dir/index.js"
  for extra in $(extras_for "$short"); do
    [[ -f "$REPO/server/$extra" ]] || { echo "  ✗ нет доп. модуля: server/$extra"; exit 1; }
    cp "$REPO/server/$extra" "$dir/$extra"
    if command -v node >/dev/null; then node --check "$REPO/server/$extra" || exit 1; fi
    echo "  + модуль $extra"
  done
  cat > "$dir/package.json" <<JSON
{
  "name": "$fn",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "ydb-sdk": "^5.11.1",
    "@yandex-cloud/nodejs-sdk": "^2.0.0"
  }
}
JSON

  # функция может ещё не существовать (новый эндпоинт) — создаём
  if ! yc serverless function get --name "$fn" >/dev/null 2>&1; then
    echo "  + функции нет, создаю"
    yc serverless function create --name "$fn" >/dev/null
  fi

  # окружение и параметры берём из ДЕЙСТВУЮЩЕЙ версии, чтобы ничего не потерять;
  # при первом деплое — у функции-донора (см. env_donor_for)
  src_fn="$fn"
  if [ -z "$(yc serverless function version list --function-name "$fn" --format json | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')" ] \
     || [ "$(yc serverless function version list --function-name "$fn" --format json | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')" = "0" ]; then
    donor="$(env_donor_for "$short")"
    [[ -n "$donor" ]] || { echo "  ✗ у $fn нет версий и не задан донор окружения (env_donor_for)"; exit 1; }
    echo "  ⓘ первый деплой: окружение возьму у $donor"
    src_fn="$donor"
  fi
  cur="$(yc serverless function version list --function-name "$src_fn" --format json \
        | python3 -c "import sys,json;d=json.load(sys.stdin);d.sort(key=lambda x:x.get('created_at',''),reverse=True);print(d[0]['id'])")"
  yc serverless function version get "$cur" --format json > "$dir/cur.json"
  python3 - "$dir" <<'PY'
import json, sys, os
d = json.load(open(os.path.join(sys.argv[1], 'cur.json')))
env = d.get('environment', {}) or {}
bad = [k for k, v in env.items() if ',' in str(v)]
if bad:
    sys.exit(f'значение содержит запятую, нужен другой способ передачи: {bad}')
open(os.path.join(sys.argv[1], 'env.txt'), 'w').write(
    ','.join(f'{k}={v}' for k, v in env.items()))
open(os.path.join(sys.argv[1], 'meta.txt'), 'w').write(
    f"{d.get('execution_timeout','30s')}")
print('  окружение перенесено:', sorted(env.keys()))
PY

  ver="$(yc serverless function version create \
        --function-name "$fn" \
        --runtime "$RUNTIME" \
        --entrypoint index.handler \
        --memory 256m \
        --execution-timeout "$(cat "$dir/meta.txt")" \
        --service-account-id "$SA_ID" \
        --source-path "$dir" \
        --environment "$(cat "$dir/env.txt")" \
        --format json | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")"
  echo "  ✓ версия $ver (это \$latest; прод на теге stable)"

  if [[ "$PROMOTE" == "1" ]]; then
    yc serverless function version set-tag --id "$ver" --tag stable >/dev/null
    echo "  ⇧ promoted: stable → $ver"
  else
    echo "  ⓘ проверь \$latest, затем: yc serverless function version set-tag --id $ver --tag stable"
  fi
  rm -rf "$dir"
done

echo
echo "Готово. Прод отдаёт версии с тегом stable."
echo "Откат:  yc serverless function version list --function-name yasna-<имя>"
echo "        yc serverless function version set-tag --id <прежняя> --tag stable"
