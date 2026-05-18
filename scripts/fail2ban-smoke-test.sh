#!/usr/bin/env bash
set -euo pipefail

# Smoke test para validar ban/unban do Fail2ban contra 401/bruteforce.
# Uso rapido:
#   bash scripts/fail2ban-smoke-test.sh
# Variaveis opcionais:
#   F2B_CONTAINER=album-fail2ban
#   JAIL=album-auth-bf
#   TARGET_URL=http://127.0.0.1:3001/api/auth/me
#   ATTEMPTS=12
#   SLEEP_SECONDS=0.1
#   CLEANUP_UNBAN=true

F2B_CONTAINER="${F2B_CONTAINER:-album-fail2ban}"
JAIL="${JAIL:-album-auth-bf}"
TARGET_URL="${TARGET_URL:-http://127.0.0.1:3001/api/auth/me}"
ATTEMPTS="${ATTEMPTS:-12}"
SLEEP_SECONDS="${SLEEP_SECONDS:-0.1}"
CLEANUP_UNBAN="${CLEANUP_UNBAN:-true}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-30}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[erro] Comando obrigatorio nao encontrado: $cmd" >&2
    exit 1
  fi
}

get_jail_field() {
  local field="$1"
  docker exec "$F2B_CONTAINER" fail2ban-client status "$JAIL" \
    | sed -n "s/.*${field}:[[:space:]]*//p" \
    | head -n1 \
    | xargs
}

wait_for_backend() {
  local elapsed=0
  while [[ "$elapsed" -lt "$HEALTH_TIMEOUT_SECONDS" ]]; do
    if curl -sS -o /dev/null "$HEALTH_URL"; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 1
}

require_cmd docker
require_cmd curl
require_cmd sed
require_cmd awk

if ! docker ps --format '{{.Names}}' | grep -qx "$F2B_CONTAINER"; then
  echo "[erro] Container do fail2ban nao encontrado/em execucao: $F2B_CONTAINER" >&2
  exit 1
fi

if ! docker exec "$F2B_CONTAINER" fail2ban-client status "$JAIL" >/dev/null 2>&1; then
  echo "[erro] Jail nao encontrada: $JAIL" >&2
  docker exec "$F2B_CONTAINER" fail2ban-client status >&2 || true
  exit 1
fi

echo "[info] Iniciando smoke test Fail2ban"
echo "[info] Container: $F2B_CONTAINER"
echo "[info] Jail: $JAIL"
echo "[info] URL alvo: $TARGET_URL"
echo "[info] Tentativas: $ATTEMPTS"

echo "[info] Aguardando backend responder em: $HEALTH_URL"
if ! wait_for_backend; then
  echo "[erro] Backend nao respondeu dentro de ${HEALTH_TIMEOUT_SECONDS}s em $HEALTH_URL" >&2
  exit 1
fi

pre_total_banned="$(get_jail_field "Total banned")"
pre_total_banned="${pre_total_banned:-0}"

echo "[info] Total banned antes: $pre_total_banned"

for i in $(seq 1 "$ATTEMPTS"); do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$TARGET_URL" || true)"
  echo "[req $i/$ATTEMPTS] status=$code"
  sleep "$SLEEP_SECONDS"
done

sleep 1

post_total_banned="$(get_jail_field "Total banned")"
post_total_banned="${post_total_banned:-0}"
current_banned="$(get_jail_field "Currently banned")"
current_banned="${current_banned:-0}"
banned_ip_list="$(get_jail_field "Banned IP list")"

echo "[info] Total banned depois: $post_total_banned"
echo "[info] Currently banned: $current_banned"
echo "[info] Banned IP list: ${banned_ip_list:-<vazio>}"

if [[ "$post_total_banned" -le "$pre_total_banned" ]]; then
  echo "[falha] Nenhum novo ban detectado. Revise threshold da jail, endpoint alvo e origem do IP." >&2
  exit 2
fi

echo "[ok] Ban detectado com sucesso."

if [[ "$CLEANUP_UNBAN" == "true" && -n "${banned_ip_list:-}" ]]; then
  echo "[info] Iniciando cleanup (unban dos IPs atuais da jail)..."
  for ip in $banned_ip_list; do
    docker exec "$F2B_CONTAINER" fail2ban-client set "$JAIL" unbanip "$ip" >/dev/null || true
    echo "[info] unbanip $ip"
  done
  echo "[ok] Cleanup finalizado."
fi

echo "[fim] Smoke test concluido."
