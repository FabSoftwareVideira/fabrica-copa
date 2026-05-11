#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-$ROOT_DIR/data}"
DB_FILE="${DB_FILE:-$DATA_DIR/album.db}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DB_FILE" ]]; then
  echo "Banco nao encontrado em: $DB_FILE"
  exit 1
fi

timestamp="$(date +%F_%H%M%S)"
backup_file="$BACKUP_DIR/album_${timestamp}.db"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '$backup_file'"
else
  cp "$DB_FILE" "$backup_file"
fi

echo "Backup criado em: $backup_file"
