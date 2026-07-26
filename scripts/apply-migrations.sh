#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Применение миграций схемы YDB из server/migrations/*.sql.
#
# ЗАЧЕМ. Схема БД до этого нигде не была зафиксирована: таблицы создавались
# руками через консоль, и «что в облаке» расходилось с «что в репозитории».
# Теперь единственный источник правды — файлы .sql, а факт применения
# хранится в таблице schema_migrations.
#
# ПОЧЕМУ CLI, А НЕ SDK. Первая попытка применить миграцию через ydb-sdk
# (session.createTable) обошлась дорого и стоит того, чтобы запомнить:
#   • DDL нельзя выполнить через executeQuery — «Operation 'CreateTable' can't
#     be executed inside transaction»; executeSchemeQuery в v5 отсутствует;
#   • а главное — schemeClient/tableClient САМИ приписывают database к пути.
#     Передашь абсолютный путь — он приклеится вторично, и таблицы уедут в
#     /<db>/ru-central1/<cloud>/<db>/progress. При этом scheme-клиент их
#     «видит» (он удваивает путь так же), а query-движок — нет: SELECT падает
#     с «Cannot find table», хотя describeTable отвечает нормально. Полдня
#     ушло на этот парадокс.
# CLI таких сюрпризов не делает: имена относительные, таблицы в корне БД.
#
# ИСПОЛЬЗОВАНИЕ:
#   ./scripts/apply-migrations.sh                  # применить неприменённые
#   ./scripts/apply-migrations.sh --status          # только показать состояние
#   ./scripts/apply-migrations.sh --force 001_progress.sql   # применить повторно
#
# Требуется ydb CLI (~/ydb/bin) и IAM-токен: берётся из $YC_IAM_TOKEN,
# иначе из `yc iam create-token`.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG_DIR="$REPO/server/migrations"

YDB_ENDPOINT="${YDB_ENDPOINT:-grpcs://ydb.serverless.yandexcloud.net:2135}"
YDB_DATABASE="${YDB_DATABASE:-/ru-central1/b1gqrqgua7miqmj6m4k0/etnrjgqnrg5ir7tk5bj4}"

# На macOS grpc-резолвер c-ares не разрешает AAAA для ydb.serverless.* и CLI
# падает с TRANSPORT_UNAVAILABLE / «Could not contact DNS servers».
# Штатный резолвер работает; в CI переменная безвредна.
export GRPC_DNS_RESOLVER="${GRPC_DNS_RESOLVER:-native}"

# yc и ydb ставятся в домашнюю папку и в PATH обычной оболочки не попадают.
# Без этого скрипты падали с «yc CLI не найден» — сообщение верное, но человек
# в этот момент не понимает, что от него хотят. Находим сами.
for d in "$HOME/yandex-cloud/bin" "$HOME/ydb/bin"; do
  case ":$PATH:" in *":$d:"*) ;; *) [ -d "$d" ] && PATH="$d:$PATH" ;; esac
done
export PATH

command -v ydb >/dev/null || { echo "ydb CLI не найден в PATH (обычно ~/ydb/bin)"; exit 1; }

TOKFILE="$(mktemp)"
trap 'rm -f "$TOKFILE"' EXIT
if [ -n "${YC_IAM_TOKEN:-}" ]; then
  printf '%s' "$YC_IAM_TOKEN" > "$TOKFILE"
else
  command -v yc >/dev/null || { echo "нужен либо \$YC_IAM_TOKEN, либо yc CLI"; exit 1; }
  yc iam create-token > "$TOKFILE"
fi

yql(){ ydb -e "$YDB_ENDPOINT" -d "$YDB_DATABASE" --iam-token-file "$TOKFILE" yql -s "$1"; }

MODE=apply
FORCE_FILE=""
for a in "$@"; do
  case "$a" in
    --status) MODE=status ;;
    --force)  MODE=force ;;
    *.sql)    FORCE_FILE="$a" ;;
  esac
done

# журнал применённых миграций (создаётся один раз)
yql 'CREATE TABLE schema_migrations (
  name Utf8 NOT NULL,
  applied_at Timestamp NOT NULL,
  PRIMARY KEY (name));' >/dev/null 2>&1 || true

# ЧИТАЕМ СТРОГО. Раньше здесь стояли и 2>/dev/null, и «|| true»: любой сбой
# чтения (недоступная БД, изменившийся формат вывода CLI) превращался в «ничего
# не применено», и раннер накатывал ВСЕ миграции заново. Для 003 это означало
# перезапись role_grants значениями из миграции — то есть молчаливый откат всех
# галочек, которые суперадмин расставил админу в матрице прав.
#
# Проверка выполняется В РОДИТЕЛЬСКОЙ оболочке: exit внутри $(...) завершил бы
# только подоболочку, и скрипт поехал бы дальше с пустым списком — то есть
# ровно с тем поведением, которое мы и убираем.
if ! APPLIED_RAW="$(yql 'SELECT name FROM schema_migrations;' 2>&1)"; then
  echo "✗ не удалось прочитать schema_migrations — не берусь применять миграции" >&2
  printf '%s\n' "$APPLIED_RAW" | head -5 >&2
  exit 1
fi
APPLIED="$(printf '%s' "$APPLIED_RAW" | grep -o '"[^"]*\.sql"' | tr -d '"' || true)"
is_applied(){ echo "$APPLIED" | grep -qx "$1"; }

if [ "$MODE" = "status" ]; then
  echo "БД: $YDB_DATABASE"
  for f in "$MIG_DIR"/*.sql; do
    n="$(basename "$f")"
    if is_applied "$n"; then echo "  ✓ $n"; else echo "  · $n (не применена)"; fi
  done
  exit 0
fi

for f in "$MIG_DIR"/*.sql; do
  n="$(basename "$f")"
  if [ "$MODE" = "force" ]; then
    [ "$n" = "$FORCE_FILE" ] || continue
  elif is_applied "$n"; then
    echo "  ✓ $n — уже применена"
    continue
  fi

  echo "──────── $n ────────"
  # YDB выполняет одну схемную операцию за запрос, поэтому скрипт разбивается
  # на отдельные утверждения. Комментарии -- вырезаем, чтобы ';' внутри них
  # не рвал разбиение.
  #
  # Каждое утверждение — в отдельный файл, а не в NUL-разделённый поток:
  # в bash 3.2 (штатный на macOS) `read -d ''` по NUL не делит, и вся миграция
  # уходила в YDB одним куском («Can't parse "CREATE TABLE user_notes…»).
  stmtdir="$(mktemp -d)"
  python3 - "$f" "$stmtdir" <<'PY'
import os, re, sys
src = re.sub(r'--[^\n]*', '', open(sys.argv[1], encoding='utf-8').read())
for i, s in enumerate((x.strip() for x in src.split(';')), 1):
    if s:
        open(os.path.join(sys.argv[2], 'stmt_%03d.sql' % i), 'w', encoding='utf-8').write(s + ';')
PY
  ok=1
  for sf in "$stmtdir"/stmt_*.sql; do
    [ -f "$sf" ] || continue
    stmt="$(cat "$sf")"
    head="$(printf '%s' "$stmt" | tr '\n' ' ' | tr -s ' ' | cut -c1-58)"
    if out="$(yql "$stmt" 2>&1)"; then
      echo "  ✓ ${head}…"
    else
      if printf '%s' "$out" | grep -qi "already exists\|path exist"; then
        echo "  ⓘ ${head}… — объект уже существует, пропускаю"
      else
        echo "  ✗ ${head}…"; printf '%s\n' "$out" | head -6; ok=0; break
      fi
    fi
  done
  rm -rf "$stmtdir"

  if [ "$ok" = "1" ]; then
    yql "UPSERT INTO schema_migrations (name, applied_at) VALUES (\"$n\", CurrentUtcTimestamp());" >/dev/null
    echo "  записана в schema_migrations"
  else
    echo "  миграция НЕ записана как применённая — исправь и запусти снова"
    exit 1
  fi
done

echo
echo "Состояние:"
"$0" --status | tail -n +2
