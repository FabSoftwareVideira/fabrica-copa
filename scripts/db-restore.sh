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
