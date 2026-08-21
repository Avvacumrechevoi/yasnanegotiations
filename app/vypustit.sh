#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Выпуск версии приложения в хранилище — то, что видит самопроверка
# обновлений (obnovlenie.js): кладёт APK и version.json в бакет.
#
# Использование (после сборки в android/):
#   ./vypustit.sh "что нового одной строкой"
#
# Сам читает versionCode/versionName из build.gradle, чтобы манифест
# в хранилище никогда не разошёлся со сборкой.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

CHTO="${1:?Опишите изменения одной строкой: ./vypustit.sh \"…\"}"
APK="android/app/build/outputs/apk/debug/app-debug.apk"
[ -f "$APK" ] || { echo "Сначала соберите: npm run apk" >&2; exit 1; }

export PATH="$HOME/yandex-cloud/bin:$PATH"
command -v yc >/dev/null || { echo "нужен yc (~/yandex-cloud/bin)" >&2; exit 1; }

KOD=$(grep -o 'versionCode [0-9]*' android/app/build.gradle | awk '{print $2}')
IMYA=$(grep -o 'versionName "[^"]*"' android/app/build.gradle | cut -d'"' -f2)
echo "Выпускаю $IMYA (код $KOD): $CHTO"

yc storage s3 cp "$APK" s3://yasnalab.ru/app/yasna.apk \
  --content-type "application/vnd.android.package-archive"

python3 - "$KOD" "$IMYA" "$CHTO" <<'PY' > /tmp/version.json
import json,sys
print(json.dumps({
  "versionCode": int(sys.argv[1]),
  "versionName": sys.argv[2],
  "url": "https://storage.yandexcloud.net/yasnalab.ru/app/yasna.apk",
  "izmeneniya": sys.argv[3],
}, ensure_ascii=False, indent=2))
PY
yc storage s3 cp /tmp/version.json s3://yasnalab.ru/app/version.json \
  --content-type "application/json; charset=utf-8"

echo "Готово. Приложения увидят обновление при следующей проверке (раз в 6 часов)."
