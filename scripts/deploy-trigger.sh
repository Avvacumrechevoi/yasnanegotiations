#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Таймер сборщика ленты управлений: yasna-lenta-timer → yasna-lenta-sbor.
#
# ЗАЧЕМ СКРИПТ. Триггеров в облаке до ленты не было, и первый появился бы
# «руками в консоли» — то есть без следа в репозитории и без возможности
# воспроизвести. Здесь таймер описан кодом: cron, функция, тег, сервисный
# аккаунт, повторы. Запуск идемпотентен: нет триггера — создаёт, есть —
# сверяет параметры и обновляет только при расхождении.
#
# ЧТО СОЗДАЁТСЯ:
#   cron '3/15 * * * ? *' — каждые 15 минут на третьей минуте (UTC), чтобы не
#     попадать в «круглые» минуты, когда у площадок больше всего ботов;
#   invoke-function-tag stable — таймер бьёт в ту же версию, что и шлюз, и
#     откат тега откатывает и сборщик;
#   сервисный аккаунт yasna-duel-sa (serverless.functions.invoker) — тот же,
#     под которым работают функции;
#   retry 2 × 2 мин — на случай холодного старта дольше срока.
# Событие таймера приходит без тела: сборщик берёт просроченные источники по
# period_min сам (server/lenta-sbor.js).
#
# ПРАВО УДАЛЯТЬ ОБЪЕКТЫ. Сборщик убирает из бакета копии картинок скрытых и
# устаревших записей (право отзыва по лицензии). Роль storage.uploader этого
# НЕ даёт — она удаляет лишь незавершённые составные загрузки; нужна
# storage.editor (или storage.admin) у сервисного аккаунта функции. Таймер
# без этого права создавать нельзя: копии чужих фото жили бы в публичном
# бакете бессрочно, а сборщик получал бы 403 каждые 15 минут. Поэтому перед
# созданием скрипт читает привязки каталога и отказывается без права.
#   yc resource-manager folder add-access-binding --id <каталог> \
#     --role storage.editor --subject serviceAccount:<СА>
# Обойти проверку (например, право выдано политикой бакета, а не ролью):
# --bez-proverki-prav.
#
# ИСПОЛЬЗОВАНИЕ:
#   ./scripts/deploy-trigger.sh            # создать или обновить
#   ./scripts/deploy-trigger.sh --dry-run  # только показать, что будет сделано
#   ./scripts/deploy-trigger.sh --pause    # приостановить (yc trigger pause)
#   ./scripts/deploy-trigger.sh --resume   # возобновить
#   ./scripts/deploy-trigger.sh --bez-proverki-prav   # не проверять роль СА
#
# Требуется yc CLI с активным профилем и уже существующая функция
# yasna-lenta-sbor с версией под тегом stable (deploy-backend.sh --promote).
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

TRIGGER_NAME="${YC_LENTA_TRIGGER:-yasna-lenta-timer}"
FN_NAME="${YC_LENTA_FUNCTION:-yasna-lenta-sbor}"
SA_ID="${YC_SA_ID:-aje0k8v128i3gvatqah2}"
CRON="${YC_LENTA_CRON:-3/15 * * * ? *}"
TAG="stable"
RETRY_ATTEMPTS=2
RETRY_INTERVAL="2m"

DRY=0; ACTION=apply; CHECK_RIGHTS=1
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --pause)   ACTION=pause ;;
    --resume)  ACTION=resume ;;
    --bez-proverki-prav) CHECK_RIGHTS=0 ;;
    *) echo "неизвестный аргумент: $a"; exit 1 ;;
  esac
done

# yc ставится в домашнюю папку и в PATH обычной оболочки не попадает.
for d in "$HOME/yandex-cloud/bin" "$HOME/ydb/bin"; do
  case ":$PATH:" in *":$d:"*) ;; *) [ -d "$d" ] && PATH="$d:$PATH" ;; esac
done
export PATH
command -v yc >/dev/null || { echo "yc CLI не найден в PATH"; exit 1; }

json_field(){                # json_field <поле-через-точки>  (читает stdin)
  python3 -c "
import sys, json
d = json.load(sys.stdin)
for k in sys.argv[1].split('.'):
    d = d.get(k, {}) if isinstance(d, dict) else {}
print(d if isinstance(d, str) else '')" "$1"
}

if [ "$ACTION" = "pause" ] || [ "$ACTION" = "resume" ]; then
  yc serverless trigger get --name "$TRIGGER_NAME" >/dev/null 2>&1 || { echo "✗ триггера $TRIGGER_NAME нет"; exit 1; }
  if [ "$DRY" = "1" ]; then echo "--dry-run: yc serverless trigger $ACTION --name $TRIGGER_NAME"; exit 0; fi
  yc serverless trigger "$ACTION" --name "$TRIGGER_NAME" >/dev/null
  echo "✓ $TRIGGER_NAME: $ACTION"
  exit 0
fi

# ─── право удалять объекты в бакете (см. шапку) ──────────────────────
if [ "$CHECK_RIGHTS" = "1" ]; then
  folder_id="$(yc config get folder-id 2>/dev/null || true)"
  [ -n "$folder_id" ] || { echo "✗ не знаю каталог (yc config get folder-id пуст) — проверить роль СА не могу; --bez-proverki-prav, если право выдано иначе"; exit 1; }
  roles="$(yc resource-manager folder list-access-bindings --id "$folder_id" --format json \
    | python3 -c "
import sys, json
sa = sys.argv[1]
print(' '.join(sorted(b['role_id'] for b in json.load(sys.stdin)
      if b.get('subject', {}).get('type') == 'serviceAccount' and b['subject'].get('id') == sa)))" "$SA_ID")"
  echo "роли $SA_ID в каталоге $folder_id: ${roles:-нет}"
  case " $roles " in
    *" storage.editor "*|*" storage.admin "*|*" editor "*|*" admin "*) echo "✓ право удалять объекты есть" ;;
    *)
      echo "✗ у $SA_ID нет storage.editor: сборщик не сможет убирать копии картинок скрытых записей (DELETE → 403)."
      echo "  Выдать:  yc resource-manager folder add-access-binding --id $folder_id --role storage.editor --subject serviceAccount:$SA_ID"
      echo "  Если право выдано политикой бакета — запусти с --bez-proverki-prav."
      exit 1 ;;
  esac
fi

# ─── функция и её версия с тегом stable ──────────────────────────────
fn_id="$(yc serverless function get --name "$FN_NAME" --format json 2>/dev/null | json_field id || true)"
[ -n "$fn_id" ] || { echo "✗ функция $FN_NAME не найдена — сначала ./scripts/deploy-backend.sh lenta-sbor"; exit 1; }

tagged="$(yc serverless function version list --function-name "$FN_NAME" --format json \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(next((x['id'] for x in d if '$TAG' in (x.get('tags') or [])), ''))")"
[ -n "$tagged" ] || { echo "✗ у $FN_NAME нет версии с тегом $TAG — сначала deploy-backend.sh --promote lenta-sbor"; exit 1; }
echo "функция $FN_NAME ($fn_id), версия $TAG: $tagged"

# ─── есть ли триггер и совпадают ли параметры ────────────────────────
cur="$(yc serverless trigger get --name "$TRIGGER_NAME" --format json 2>/dev/null || true)"
if [ -z "$cur" ]; then
  echo "триггера $TRIGGER_NAME нет — создаю"
  if [ "$DRY" = "1" ]; then
    echo "--dry-run: yc serverless trigger create timer --name $TRIGGER_NAME --cron-expression '$CRON' --invoke-function-id $fn_id --invoke-function-tag $TAG --invoke-function-service-account-id $SA_ID --retry-attempts $RETRY_ATTEMPTS --retry-interval $RETRY_INTERVAL"
    exit 0
  fi
  yc serverless trigger create timer \
    --name "$TRIGGER_NAME" \
    --description "лента управлений: сбор просроченных источников (server/lenta-sbor.js)" \
    --cron-expression "$CRON" \
    --invoke-function-id "$fn_id" \
    --invoke-function-tag "$TAG" \
    --invoke-function-service-account-id "$SA_ID" \
    --retry-attempts "$RETRY_ATTEMPTS" \
    --retry-interval "$RETRY_INTERVAL" >/dev/null
  echo "✓ создан $TRIGGER_NAME: '$CRON' → $FN_NAME:$TAG"
  exit 0
fi

cur_cron="$(printf '%s' "$cur" | json_field rule.timer.cron_expression)"
cur_fn="$(printf '%s' "$cur" | json_field rule.timer.invoke_function_with_retry.function_id)"
cur_tag="$(printf '%s' "$cur" | json_field rule.timer.invoke_function_with_retry.function_tag)"
cur_sa="$(printf '%s' "$cur" | json_field rule.timer.invoke_function_with_retry.service_account_id)"
cur_status="$(printf '%s' "$cur" | json_field status)"
echo "триггер есть: cron '$cur_cron', функция $cur_fn:$cur_tag, СА $cur_sa, состояние $cur_status"

if [ "$cur_cron" = "$CRON" ] && [ "$cur_fn" = "$fn_id" ] && [ "$cur_tag" = "$TAG" ] && [ "$cur_sa" = "$SA_ID" ]; then
  echo "✓ параметры совпадают — менять нечего"
  exit 0
fi

echo "параметры расходятся — обновляю"
if [ "$DRY" = "1" ]; then
  echo "--dry-run: yc serverless trigger update timer $TRIGGER_NAME --new-cron-expression '$CRON' --new-invoke-function-id $fn_id --new-invoke-function-tag $TAG --new-invoke-function-service-account-id $SA_ID"
  exit 0
fi
# yc 1.6: у update timer флаги с приставкой --new-*. Если CLI старее и флагов
# нет — пересоздаём: удалить и создать заново (таймер не хранит состояния).
if yc serverless trigger update timer "$TRIGGER_NAME" \
     --new-cron-expression "$CRON" \
     --new-invoke-function-id "$fn_id" \
     --new-invoke-function-tag "$TAG" \
     --new-invoke-function-service-account-id "$SA_ID" >/dev/null 2>&1; then
  echo "✓ обновлён $TRIGGER_NAME"
else
  echo "  ⓘ update не прошёл — пересоздаю"
  yc serverless trigger delete --name "$TRIGGER_NAME" >/dev/null
  exec "$0" "$@"
fi
