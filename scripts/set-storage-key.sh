#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Ключ для выкладки сайта в Object Storage.
#
# ЗАЧЕМ ОТДЕЛЬНЫЙ СКРИПТ. Секретная часть ключа показывается ровно один
# раз, в момент создания. Она не должна проходить через переписку,
# попадать в репозиторий или оставаться в истории команд. Скрипт
# создаёт ключ и печатает его в ВАШЕМ терминале — оттуда вы переносите
# пару в секреты репозитория руками.
#
# ЧТО ДЕЛАЕТ. Создаёт статический ключ доступа служебному аккаунту
# yasna-deploy. У этого аккаунта единственная роль storage.editor:
# писать в хранилище и больше ничего. Тот же аккаунт уже выкладывает
# zolotoj-yasen.ru — новый ключ ему не мешает, у одного аккаунта их
# может быть несколько.
#
# ИСПОЛЬЗОВАНИЕ:
#   ./scripts/set-storage-key.sh
#
# ПОСЛЕ. Открыть Settings → Secrets and variables → Actions в
# репозитории и завести два секрета:
#   YC_S3_KEY_ID   — идентификатор (начинается с YCAJE)
#   YC_S3_SECRET   — секретная часть
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

SA="yasna-deploy"
BUCKET="yasnalab.ru"

command -v yc >/dev/null 2>&1 || {
  echo "yc не найден. Обычно он в ~/yandex-cloud/bin — добавьте в PATH:" >&2
  echo '  export PATH="$HOME/yandex-cloud/bin:$PATH"' >&2
  exit 1
}

echo "Служебный аккаунт: $SA"
echo "Бакет:             $BUCKET"
echo

# Показываем, сколько ключей уже есть: их накопление — единственный
# способ незаметно раздать доступ к хранилищу.
echo "— уже выпущенные ключи этого аккаунта:"
yc iam access-key list --service-account-name "$SA" \
  --format json 2>/dev/null \
  | python3 -c 'import sys,json
for k in json.load(sys.stdin):
    print("   %s  создан %s" % (k.get("key_id"), (k.get("created_at") or "")[:10]))' \
  || echo "   (не удалось прочитать список)"
echo

printf "Создать ещё один ключ? [y/N] "
read -r ANSWER
case "$ANSWER" in
  [yY]) ;;
  *) echo "Отменено."; exit 0 ;;
esac

echo
echo "═══════ ПЕРЕНЕСИТЕ ЭТИ ДВА ЗНАЧЕНИЯ В СЕКРЕТЫ РЕПОЗИТОРИЯ ═══════"
yc iam access-key create --service-account-name "$SA" \
  --description "Выкладка $BUCKET из GitHub Actions" \
  --format json \
  | python3 -c 'import sys,json
d=json.load(sys.stdin)
print()
print("  YC_S3_KEY_ID   =", d["access_key"]["key_id"])
print("  YC_S3_SECRET   =", d["secret"])
print()'
echo "════════════════════════════════════════════════════════════════"
echo
echo "Куда положить:"
echo "  https://github.com/Avvacumrechevoi/yasnanegotiations/settings/secrets/actions"
echo
echo "Секретная часть больше не покажется нигде. Если потеряете —"
echo "выпустите новый ключ этим же скриптом, а старый удалите:"
echo "  yc iam access-key delete <key-id>"
