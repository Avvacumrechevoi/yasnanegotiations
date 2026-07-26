#!/usr/bin/env bash
# ⚠️ ВНИМАНИЕ. Раньше здесь стоял rsync --delete, и запуск скрипта УДАЛИЛ БЫ из
# прода семь файлов, которых нет в docs/preview/: 404.html, core/access.js,
# .nojekyll и четыре документа .md. Восстановление возможно только из git, но
# отчёт скрипта при этом бодро сообщал «синк завершён» — то есть потеря была бы
# тихой. Пропала бы, в частности, страница 404 (GitHub Pages начал бы отдавать
# свою) и модуль прав, который как раз готовится к подключению.
#
# --delete УБРАН. Смысл скрипта тоже изменился: preview больше не «впереди
# прода», это байт-в-байт копия, и промоушен копированием не нужен. Скрипт
# оставлен только для случая, когда в preview правда обкатали что-то новое.
# ════════════════════════════════════════════════════════════════════
# scripts/sync-prod.sh — промоут docs/preview/ → docs/ (production)
#
# Что делает:
#   1. Копирует ВСЁ из docs/preview/ в docs/ (rsync --delete-after)
#   2. Сохраняет .nojekyll в docs/ (нужен для GitHub Pages)
#   3. НЕ трогает docs/preview/ (preview всегда впереди prod)
#
# Использование:
#   bash scripts/sync-prod.sh           — обычный синк
#   bash scripts/sync-prod.sh --dry-run — посмотреть что изменится
# ════════════════════════════════════════════════════════════════════

set -euo pipefail

ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
PROD="$ROOT/docs"
PREVIEW="$ROOT/docs/preview"

if [ ! -d "$PREVIEW" ]; then
  echo "❌ Не найдена папка $PREVIEW"
  exit 1
fi

# Сохраняем .nojekyll
if [ -f "$PROD/.nojekyll" ]; then
  TMP_NOJEKYLL=$(mktemp)
  cp "$PROD/.nojekyll" "$TMP_NOJEKYLL"
fi

DRY=""
if [ "${1:-}" = "--dry-run" ]; then
  DRY="--dry-run"
  echo "▶ DRY-RUN: показываем что бы изменилось"
fi

# rsync, исключая саму подпапку preview/ (чтобы не зациклиться)
# и архитектурные/прототипные файлы что только в preview
rsync -av $DRY \
  --exclude='preview/' \
  --exclude='ARCHITECTURE.md' \
  --exclude='proposed-mechanics.html' \
  --exclude='.DS_Store' \
  "$PREVIEW/" "$PROD/"

# Восстанавливаем .nojekyll
if [ -n "${TMP_NOJEKYLL:-}" ] && [ -z "$DRY" ]; then
  cp "$TMP_NOJEKYLL" "$PROD/.nojekyll"
  rm "$TMP_NOJEKYLL"
fi

echo ""
echo "✅ Синк preview → prod завершён"
echo "   prod: $PROD"
echo "   preview сохранён неизменным (всегда впереди prod)"
