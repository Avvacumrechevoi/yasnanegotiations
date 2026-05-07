#!/usr/bin/env bash
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
rsync -av --delete $DRY \
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
