#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Настройка «Живого спарринга»: кладёт ключ Anthropic в окружение
# функции yasna-spar (серверный прокси, server/spar.js).
#
# ЗАЧЕМ ОТДЕЛЬНЫЙ СКРИПТ. API-ключ — секрет. Он не должен проходить через
# переписку, попадать в репозиторий или оставаться в истории команд.
# Скрипт спрашивает его без эха и передаёт напрямую в облако:
# терминал → Yandex Cloud, больше нигде.
#
# ИСПОЛЬЗОВАНИЕ:
#   ./scripts/set-spar-env.sh
#
# ГДЕ ВЗЯТЬ КЛЮЧ: console.anthropic.com → Settings → API keys → Create key.
# Ключ вида sk-ant-… Рекомендуется завести ОТДЕЛЬНЫЙ ключ для сайта и
# поставить на него спендинг-лимит в консоли Anthropic — тогда даже при
# злоупотреблении расходы ограничены с двух сторон (лимиты прокси + лимит ключа).
#
# Расход контролируют и переменные функции (можно поменять этим же скриптом,
# просто запустив его заново): SPAR_PER_HOUR — реплик в час с устройства
# (по умолчанию 40), SPAR_GLOBAL_PER_HOUR — реплик в час на всех (300).
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for d in "$HOME/yandex-cloud/bin" "$HOME/ydb/bin"; do
  case ":$PATH:" in *":$d:"*) ;; *) [ -d "$d" ] && PATH="$d:$PATH" ;; esac
done
export PATH
command -v yc >/dev/null || { echo "yc CLI не найден в PATH (обычно ~/yandex-cloud/bin)"; exit 1; }

echo "Настройка серверного спарринга (функция yasna-spar)"
echo
printf "Ключ Anthropic (ввод скрыт, начинается с sk-ant-): "
stty -echo 2>/dev/null || true
read -r KEY
stty echo 2>/dev/null || true
echo
[ -n "$KEY" ] || { echo "ключ пустой — отменяю"; exit 1; }
case "$KEY" in
  sk-ant-*) ;;
  *) echo "⚠ ключ не похож на sk-ant-… — записываю как есть, но проверь"; ;;
esac
case "$KEY" in
  *,*) echo "✗ в ключе запятая — yc её не примет как часть значения"; exit 1 ;;
esac

printf "Реплик в час с одного устройства [40]: "
read -r PER; PER="${PER:-40}"
printf "Реплик в час суммарно на всех (потолок расходов) [300]: "
read -r GLB; GLB="${GLB:-300}"

echo
echo "Выкатываю функцию с новыми переменными…"
# Обычный путь деплоя: собирает пакет из репозитория и переносит остальное
# окружение 1:1. Секрет уходит через PASSTHROUGH_ENV — живёт только в этой
# оболочке и в облаке, не в аргументах команды и не в репозитории.
export ANTHROPIC_API_KEY="$KEY"
export SPAR_PER_HOUR="$PER"
export SPAR_GLOBAL_PER_HOUR="$GLB"
export PASSTHROUGH_ENV="ANTHROPIC_API_KEY SPAR_PER_HOUR SPAR_GLOBAL_PER_HOUR"

"$REPO/scripts/deploy-backend.sh" --promote spar

echo
echo "Готово. Проверка: curl -s <шлюз>/spar/status → {\"configured\":true}"
echo "Ключ можно отозвать в console.anthropic.com в любой момент."
