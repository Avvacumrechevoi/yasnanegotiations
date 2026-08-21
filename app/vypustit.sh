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
# Release-подпись, когда владелец завёл keystore.properties; иначе честно
# предупреждаем: канал раздаёт debug-сборку, и обновление поверх встанет
# только у APK с ТОЙ ЖЕ debug-подписью (то есть собранных на этой машине).
if [ -f android/keystore.properties ]; then
  APK="android/app/build/outputs/apk/release/app-release.apk"
  META="android/app/build/outputs/apk/release/output-metadata.json"
else
  APK="android/app/build/outputs/apk/debug/app-debug.apk"
  META="android/app/build/outputs/apk/debug/output-metadata.json"
  echo "⚠ выпускается DEBUG-сборка (нет android/keystore.properties):" >&2
  echo "  обновления поверх встанут только со сборок этой же машины" >&2
fi
[ -f "$APK" ] || { echo "Сначала соберите: npm run apk" >&2; exit 1; }

export PATH="$HOME/yandex-cloud/bin:$PATH"
command -v yc >/dev/null || { echo "нужен yc (~/yandex-cloud/bin)" >&2; exit 1; }

KOD=$(grep -o 'versionCode [0-9]*' android/app/build.gradle | awk '{print $2}')
IMYA=$(grep -o 'versionName "[^"]*"' android/app/build.gradle | cut -d'"' -f2)
# Сверка с метаданными фактической сборки: build.gradle легко бампнуть и
# забыть пересобрать — тогда манифест обещал бы версию, которой в APK нет.
KOD_APK=$(python3 -c "import json;print(json.load(open('$META'))['elements'][0]['versionCode'])")
if [ "$KOD" != "$KOD_APK" ]; then
  echo "✗ build.gradle говорит versionCode=$KOD, а собранный APK — $KOD_APK." >&2
  echo "  Пересоберите APK и выпустите заново." >&2
  exit 1
fi
echo "Выпускаю $IMYA (код $KOD): $CHTO"

yc storage s3 cp "$APK" s3://yasnalab.ru/app/yasna.apk \
  --content-type "application/vnd.android.package-archive"

python3 - "$KOD" "$IMYA" "$CHTO" <<'PY' > /tmp/version.json
import json,sys
print(json.dumps({
  "versionCode": int(sys.argv[1]),
  "versionName": sys.argv[2],
  "url": "https://storage.yandexcloud.net/yasnalab.ru/app/yasna.apk?v=" + sys.argv[1],
  "izmeneniya": sys.argv[3],
}, ensure_ascii=False, indent=2))
PY
yc storage s3 cp /tmp/version.json s3://yasnalab.ru/app/version.json \
  --content-type "application/json; charset=utf-8"

echo "Готово. Приложения увидят обновление при следующей проверке (раз в 6 часов)."
