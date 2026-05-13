#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Carregar variáveis do .env se existir
if [[ -f "$ROOT_DIR/backend/.env" ]]; then
  # Sourçar apenas as variáveis necessárias
  export $(grep -E '^HOST_DB_DIR=|^HOST_BACKUP_DIR=' "$ROOT_DIR/backend/.env" | xargs)
fi

# Usar variáveis de ambiente ou fallback para dev
HOST_DB_DIR="${HOST_DB_DIR}"
HOST_BACKUP_DIR="${HOST_BACKUP_DIR}"

DB_FILE="${HOST_DB_DIR}/album.db"
BACKUP_DIR="${BACKUP_DIR:-$HOST_BACKUP_DIR}"

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
