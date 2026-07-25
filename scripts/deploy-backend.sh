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
    # access.js ПОКА НЕ ЗДЕСЬ: разбор нашёл в нём 6 blocker'ов (обход запрета
    # масками вида 'cap*' без двоеточия, запись в БД по запросу без токена,
    # расхождение контракта с вкладкой админки). Добавить обратно после правок.
    submit)        echo "progress.js rooms-legacy.js" ;;
    auth-telegram) echo "mailer.js auth-email.js" ;;
    *)             echo "" ;;
  esac
}

# Дополнительные npm-зависимости конкретной функции. Общие (ydb-sdk и его
# обязательная peer @yandex-cloud/nodejs-sdk) добавляются всем; здесь только
# то, что нужно одной функции. nodemailer тащить в submit нельзя: submit
# вызывается на каждый матч, и лишний холодный старт там не нужен.
deps_for(){
  case "$1" in
    auth-telegram) echo '"nodemailer": "^6.9.14"' ;;
    *)             echo "" ;;
  esac
}

# Переменные окружения, которые функция ОБЯЗАНА иметь, но которых у неё может
# не быть. Формат: «ИМЯ:функция-донор». Значение в репозиторий не попадает —
# берётся у донора, где оно уже задано.
#
# ЗАЧЕМ. content-publish исторически знал только ADMIN_PASSWORD. Когда публикация
# контента перешла на личный JWT, verifyJWT получил secret=undefined, молча
# возвращал null, и КАЖДЫЙ токен проваливался в ветку аварийного пароля — то
# есть новая авторизация не работала бы вообще, а выглядело бы как «пароль
# по-прежнему нужен». Такие требования должны быть объявлены здесь, а не
# донастроены руками в облаке.
extra_env_for(){
  case "$1" in
    content-publish) echo "JWT_SECRET:yasna-submit" ;;
    *)               echo "" ;;
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

# Сырые управляющие байты в исходниках делают файл БИНАРНЫМ для инструментов:
# file(1) видит «data», а grep молча пропускает такой файл целиком. Это уже
# случалось дважды — в progress.js (разделитель ключа записали байтом NUL) и в
# auth-email.js (класс символов в регулярке). Второй раз обнаружилось только
# потому, что поиск «где читаются entitlements» не находил НИ ОДНОЙ строки в
# файле, который их читает. Проверяем перед каждым деплоем.
badfiles="$(python3 - "$REPO" <<'PY'
import glob, os, sys
bad = []
for f in sorted(glob.glob(os.path.join(sys.argv[1], 'server', '*.js'))):
    d = open(f, 'rb').read()
    ctrl = [b for b in d if b < 0x09 or b in (0x0b, 0x0c) or (0x0e <= b <= 0x1f) or b == 0x7f]
    if ctrl:
        bad.append('%s (%d байт)' % (os.path.basename(f), len(ctrl)))
print('; '.join(bad))
PY
)"
if [ -n "$badfiles" ]; then
  echo "✗ сырые управляющие байты в исходниках: $badfiles"
  echo "  Замени их escape-последовательностями (\\u0000 и т.п.) — иначе grep и file"
  echo "  считают файл бинарным и молча его пропускают."
  exit 1
fi

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
  extra_deps="$(deps_for "$short")"
  [ -n "$extra_deps" ] && extra_deps=",
    $extra_deps"
  cat > "$dir/package.json" <<JSON
{
  "name": "$fn",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "ydb-sdk": "^5.11.1",
    "@yandex-cloud/nodejs-sdk": "^2.0.0"$extra_deps
  }
}
JSON
  [ -n "$extra_deps" ] && echo "  + зависимости:$(echo "$extra_deps" | tr -d '\n,' )"

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

  # обязательные переменные, которых может не быть — доносим от донора
  : > "$dir/extra_env.json"
  echo '{}' > "$dir/extra_env.json"
  for spec in $(extra_env_for "$short"); do
    var="${spec%%:*}"; donor="${spec##*:}"
    have="$(python3 -c "
import json,sys
d=json.load(open('$dir/cur.json'))
print('yes' if '$var' in (d.get('environment') or {}) else 'no')")"
    [ "$have" = "yes" ] && { echo "  ⓘ $var уже задана"; continue; }
    dver="$(yc serverless function version list --function-name "$donor" --format json \
          | python3 -c "import sys,json;d=json.load(sys.stdin);d.sort(key=lambda x:x.get('created_at',''),reverse=True);print(d[0]['id'])")"
    yc serverless function version get "$dver" --format json > "$dir/donor.json"
    python3 - "$dir" "$var" <<'PY'
import json, os, sys
dirp, var = sys.argv[1], sys.argv[2]
donor = json.load(open(os.path.join(dirp, 'donor.json'))).get('environment', {}) or {}
extra = json.load(open(os.path.join(dirp, 'extra_env.json')))
if var in donor:
    extra[var] = donor[var]
    json.dump(extra, open(os.path.join(dirp, 'extra_env.json'), 'w'))
    print('  + %s донесена от донора' % var)
else:
    sys.exit('  ✗ у донора нет переменной %s' % var)
PY
  done

  python3 - "$dir" <<'PY'
import json, sys, os
d = json.load(open(os.path.join(sys.argv[1], 'cur.json')))
env = d.get('environment', {}) or {}
extra_path = os.path.join(sys.argv[1], 'extra_env.json')
if os.path.exists(extra_path):
    for k, v in json.load(open(extra_path)).items():
        env.setdefault(k, v)

# Переменные, переданные через окружение вызывающей оболочки (PASSTHROUGH_ENV —
# список имён через пробел). Нужны для секретов, которых НЕ должно быть в
# репозитории: пароль SMTP приходит так из scripts/set-mail-env.sh, то есть
# идёт терминал → облако, минуя и репозиторий, и переписку. Значения здесь
# НЕ печатаются — только имена.
for name in (os.environ.get('PASSTHROUGH_ENV') or '').split():
    val = os.environ.get(name)
    if val:
        env[name] = val
        print('  ⇢ переменная %s передана из окружения' % name)
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
