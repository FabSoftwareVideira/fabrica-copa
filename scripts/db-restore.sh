#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-$ROOT_DIR/data}"
DB_FILE="${DB_FILE:-$DATA_DIR/album.db}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"

backup_source="${1:-}"
if [[ -z "$backup_source" ]]; then
  latest_backup="$(ls -1t "$BACKUP_DIR"/*.db 2>/dev/null | head -n 1 || true)"
  if [[ -z "$latest_backup" ]]; then
    echo "Nenhum backup encontrado em: $BACKUP_DIR"
    exit 1
  fi
  backup_source="$latest_backup"
fi

if [[ ! -f "$backup_source" ]]; then
  echo "Arquivo de backup nao encontrado: $backup_source"
  exit 1
fi

echo "Parando containers de backend (se estiverem em execucao)..."
(docker compose stop backend-dev backend-prod >/dev/null 2>&1 || true)

mkdir -p "$(dirname "$DB_FILE")"
cp "$backup_source" "$DB_FILE"

echo "Restore concluido para: $DB_FILE"
echo "Backup utilizado: $backup_source"
echo "Inicie novamente com: docker compose --profile dev up -d ou docker compose --profile prod up -d"
