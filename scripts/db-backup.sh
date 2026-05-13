#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Detectar se está rodando dentro de um container Docker
IN_CONTAINER=false
if [[ -f /.dockerenv ]]; then
  IN_CONTAINER=true
fi

# Definir caminhos baseado no contexto (container ou host)
if [[ "$IN_CONTAINER" == true ]]; then
  # Dentro do container: usar os caminhos dos volumes
  DB_FILE="${DB_PATH:-/app/data/album.db}"
  BACKUP_DIR="${BACKUP_DIR:-/backups}"
else
  # No host: carregar variáveis do .env
  if [[ -f "$ROOT_DIR/backend/.env" ]]; then
    export $(grep -E '^HOST_DB_DIR=|^HOST_BACKUP_DIR=' "$ROOT_DIR/backend/.env" | xargs)
  fi
  
  # Usar variáveis de ambiente com fallback
  HOST_DB_DIR="${HOST_DB_DIR:-/srv/fabrica-copa-data}"
  HOST_BACKUP_DIR="${HOST_BACKUP_DIR:-/srv/fabrica-copa-backups}"
  
  DB_FILE="${DB_FILE:-$HOST_DB_DIR/album.db}"
  BACKUP_DIR="${BACKUP_DIR:-$HOST_BACKUP_DIR}"
fi

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
