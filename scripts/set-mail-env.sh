#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Настройка отправки писем: кладёт SMTP-параметры в окружение функции,
# которая рассылает коды входа.
#
# ЗАЧЕМ ОТДЕЛЬНЫЙ СКРИПТ. Пароль почтового ящика — секрет. Он не должен
# проходить через переписку, попадать в репозиторий или оставаться в истории
# команд. Скрипт спрашивает его без эха и передаёт напрямую в облако:
# терминал → Yandex Cloud, больше нигде.
#
# ИСПОЛЬЗОВАНИЕ (интерактивно, ответить на четыре вопроса):
#   ./scripts/set-mail-env.sh
#
# ИЛИ сразу с параметрами (пароль всё равно спросит отдельно):
#   ./scripts/set-mail-env.sh --host smtp.yandex.ru --port 465 \
#       --user no-reply@домен --from "Ясна <no-reply@домен>"
#
# ГДЕ ВЗЯТЬ ПАРОЛЬ. Обычный пароль от почты не подойдёт — нужен «пароль
# приложения»:
#   • Яндекс 360 / Яндекс Почта: id.yandex.ru → Безопасность → Пароли приложений
#     → Почта. Хост smtp.yandex.ru, порт 465.
#   • Gmail: myaccount.google.com → Безопасность → Пароли приложений
#     (нужна двухэтапная аутентификация). Хост smtp.gmail.com, порт 465.
#   • Yandex Cloud Postbox: в консоли создаются отдельные SMTP-логин и пароль,
#     хост postbox.cloud.yandex.net, порт 465.
#
# ВАЖНО ПРО АДРЕС ОТПРАВИТЕЛЯ: MAIL_FROM должен быть на том же домене, что
# SMTP_USER, иначе письма уйдут в спам или будут отбиты. Для писем с кодами
# берите отдельный адрес вида no-reply@…
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Функция, которая рассылает письма. Коды входа живут в auth-telegram
# (это функция про идентичность), поэтому переменные ставим ей.
FN="${MAIL_FUNCTION:-yasna-auth-telegram}"
SA_ID="${YC_SA_ID:-aje0k8v128i3gvatqah2}"
RUNTIME="${YC_RUNTIME:-nodejs16}"

HOST=""; PORT="465"; USER_=""; FROM=""
while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --user) USER_="$2"; shift 2 ;;
    --from) FROM="$2"; shift 2 ;;
    *) echo "неизвестный параметр: $1"; exit 1 ;;
  esac
done

# yc и ydb ставятся в домашнюю папку и в PATH обычной оболочки не попадают.
# Без этого скрипты падали с «yc CLI не найден» — сообщение верное, но человек
# в этот момент не понимает, что от него хотят. Находим сами.
for d in "$HOME/yandex-cloud/bin" "$HOME/ydb/bin"; do
  case ":$PATH:" in *":$d:"*) ;; *) [ -d "$d" ] && PATH="$d:$PATH" ;; esac
done
export PATH

command -v yc >/dev/null || { echo "yc CLI не найден в PATH (обычно ~/yandex-cloud/bin)"; exit 1; }

echo "Настройка отправки писем для функции $FN"
echo
[ -n "$HOST" ]  || { printf "SMTP-хост (например smtp.yandex.ru): "; read -r HOST; }
[ -n "$USER_" ] || { printf "SMTP-логин (полный адрес ящика): "; read -r USER_; }
[ -n "$FROM" ]  || { printf "Адрес отправителя [Ясна <%s>]: " "$USER_"; read -r FROM; FROM="${FROM:-Ясна <$USER_>}"; }
printf "Порт [%s]: " "$PORT"; read -r p; PORT="${p:-$PORT}"

# Пароль — без эха, в переменную, и нигде не печатается.
printf "Пароль приложения (ввод скрыт): "
stty -echo 2>/dev/null || true
read -r PASS
stty echo 2>/dev/null || true
echo
[ -n "$PASS" ] || { echo "пароль пустой — отменяю"; exit 1; }

# Значение с запятой сломало бы --environment (флаг разделяет пары запятой).
case "$PASS$HOST$USER_$FROM" in
  *,*) echo "✗ в значениях есть запятая — yc её не примет как часть значения. Смените адрес/пароль."; exit 1 ;;
esac

export MAIL_PASS_CHECK="$PASS"

echo
echo "Проверяю соединение с почтовым сервером…"
# Проверка ДО записи в облако: иначе неверный пароль обнаружится только на
# первой попытке входа живого человека.
python3 - "$HOST" "$PORT" "$USER_" <<'PY' || { echo "✗ почтовый сервер не принял эти данные — ничего не записал"; exit 1; }
import smtplib, ssl, sys, os
host, port, user = sys.argv[1], int(sys.argv[2]), sys.argv[3]
pwd = os.environ['MAIL_PASS_CHECK']
try:
    if port == 465:
        s = smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context())
    else:
        s = smtplib.SMTP(host, port, timeout=20)
        s.starttls(context=ssl.create_default_context())
    s.login(user, pwd)
    s.quit()
    print('  ✓ сервер принял логин и пароль')
except Exception as e:
    print('  ✗', type(e).__name__, str(e)[:160])
    sys.exit(1)
PY

echo
echo "Выкатываю функцию с новыми переменными…"
# Переиспользуем обычный путь деплоя: он собирает пакет из репозитория,
# переносит остальное окружение 1:1 и уже проверен. Секреты попадают туда
# через PASSTHROUGH_ENV — то есть значение живёт только в этой оболочке и в
# облаке, ни в репозитории, ни в аргументах команды, ни в переписке.
export SMTP_HOST="$HOST"
export SMTP_PORT="$PORT"
export SMTP_USER="$USER_"
export MAIL_FROM="$FROM"
export SMTP_PASS="$PASS"
export PASSTHROUGH_ENV="SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS MAIL_FROM"

"$REPO/scripts/deploy-backend.sh" auth-telegram

echo
echo "Проверь новую версию и переведи прод:"
echo "  yc serverless function version list --function-name $FN"
echo "  yc serverless function version set-tag --id <новая> --tag stable"
echo "  ./scripts/smoke-backend.sh"
