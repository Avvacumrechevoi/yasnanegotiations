#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Применение server/api-gateway.yaml к API Gateway в Yandex Cloud.
#
# Что делает:
#   1. подставляет вместо {…_FUNCTION_ID} реальные id, найденные ПО ИМЕНИ
#      функции (в публичный репозиторий id не попадают);
#   2. проверяет, что у каждой функции есть версия с тегом stable — спека
#      ссылается только на stable, и без этой проверки шлюз молча уехал бы
#      в ошибку резолва вместо работающего эндпоинта;
#   3. показывает diff с действующей спекой и обновляет шлюз.
#
# ИСПОЛЬЗОВАНИЕ:
#   ./scripts/deploy-gateway.sh            # показать diff и применить
#   ./scripts/deploy-gateway.sh --dry-run  # только показать, что уедет
#   ./scripts/deploy-gateway.sh --tag-current   # проставить stable текущим
#                                               # версиям функций, где тега нет
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC="$REPO/server/api-gateway.yaml"
GW_ID="${YC_GATEWAY_ID:-d5dmdje8c5mk8811il5j}"
SA_ID="${YC_SA_ID:-aje0k8v128i3gvatqah2}"

DRY=0; TAG_CURRENT=0
for a in "$@"; do
  case "$a" in
    --dry-run)     DRY=1 ;;
    --tag-current) TAG_CURRENT=1 ;;
  esac
done

command -v yc >/dev/null || { echo "yc CLI не найден в PATH"; exit 1; }

# placeholder → имя функции в облаке
pairs="AUTH_TELEGRAM:yasna-auth-telegram
SUBMIT:yasna-submit
LEADERBOARD:yasna-leaderboard
PROFILE:yasna-profile
ROOMS_CREATE:yasna-rooms-create
ROOMS_JOIN:yasna-rooms-join
ROOMS_SEND:yasna-rooms-send
ROOMS_POLL:yasna-rooms-poll
CONTENT_FETCH:yasna-content-fetch
CONTENT_PUBLISH:yasna-content-publish"

DOMAIN="$(yc serverless api-gateway get --id "$GW_ID" --format json | python3 -c 'import sys,json;print(json.load(sys.stdin)["domain"])')"
out="$(mktemp)"; cp "$SPEC" "$out"
python3 - "$out" "$DOMAIN" "$SA_ID" <<'PY'
import sys
p, domain, sa = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p, encoding='utf-8').read()
s = s.replace('{GATEWAY_DOMAIN}', domain).replace('{SERVICE_ACCOUNT_ID}', sa)
open(p, 'w', encoding='utf-8').write(s)
PY

problems=0
echo "$pairs" | while IFS=: read -r ph fn; do
  [ -n "$ph" ] || continue
  id="$(yc serverless function get --name "$fn" --format json 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])' || true)"
  [ -n "$id" ] || { echo "  ✗ функция $fn не найдена в облаке"; exit 1; }

  # есть ли версия с тегом stable?
  tagged="$(yc serverless function version list --function-name "$fn" --format json \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(next((x['id'] for x in d if 'stable' in (x.get('tags') or [])), ''))")"
  if [ -z "$tagged" ]; then
    if [ "$TAG_CURRENT" = "1" ]; then
      newest="$(yc serverless function version list --function-name "$fn" --format json \
        | python3 -c "import sys,json;d=json.load(sys.stdin);d.sort(key=lambda x:x.get('created_at',''),reverse=True);print(d[0]['id'])")"
      yc serverless function version set-tag --id "$newest" --tag stable >/dev/null
      echo "  ⇧ $fn: stable → $newest (текущая версия)"
    else
      echo "  ✗ у $fn нет версии с тегом stable — запусти с --tag-current"
      exit 1
    fi
  fi
  python3 - "$out" "$ph" "$id" <<'PY'
import sys
p, ph, fid = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p, encoding='utf-8').read().replace('{%s_FUNCTION_ID}' % ph, fid)
open(p, 'w', encoding='utf-8').write(s)
PY
done || problems=1
[ "$problems" = "0" ] || { rm -f "$out"; exit 1; }

if grep -q '{[A-Z_]*}' "$out"; then
  echo "  ✗ в спеке остались неподставленные подстановки:"; grep -o '{[A-Z_]*}' "$out" | sort -u
  rm -f "$out"; exit 1
fi

echo "── маршруты в новой спеке ──"
grep -E "^  /" "$out" | tr -d ':' | tr '\n' ' '; echo

cur="$(mktemp)"; yc serverless api-gateway get-spec --id "$GW_ID" > "$cur" 2>/dev/null || true
echo "── что изменится (маршруты и теги) ──"
diff <(grep -E "^  /|function_id|tag:" "$cur" || true) <(grep -E "^  /|function_id|tag:" "$out") || true

if [ "$DRY" = "1" ]; then echo; echo "--dry-run: шлюз не тронут"; rm -f "$out" "$cur"; exit 0; fi

yc serverless api-gateway update --id "$GW_ID" --spec "$out" >/dev/null
echo "✓ шлюз обновлён: https://$DOMAIN"
rm -f "$out" "$cur"
