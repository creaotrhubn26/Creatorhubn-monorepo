#!/bin/sh
# NextRole daglig cron-trigger.
#
# Render kjører dette daglig (se render.yaml schedule "0 9 * * *").
# Kaller to interne endepunkter sekvensielt:
#
#   1. check-trial-expiry — sender trialExpiringEmail til brukere med
#      ~3 dager igjen av trial.
#   2. drip-tick — sender dag 3 / dag 7 / dag 13 / post-trial-winback
#      e-poster basert på trial-start-tidspunkt.
#
# Begge er idempotente — de logger hva som er sendt og dropper duplikater.
#
# Env-variabler (fra render.yaml):
#   BACKEND_URL          base-URL til creatorhub-backend
#   NEXTROLE_CRON_SECRET delt secret (auto-injectet fra backend-servicen)

set -e

if [ -z "${BACKEND_URL}" ]; then
  echo "[nextrole-cron] BACKEND_URL not set — abort"
  exit 1
fi
if [ -z "${NEXTROLE_CRON_SECRET}" ]; then
  echo "[nextrole-cron] NEXTROLE_CRON_SECRET not set — abort"
  exit 1
fi

call_endpoint() {
  PATH_TO_CALL="$1"
  echo "[nextrole-cron] $(date -u +%Y-%m-%dT%H:%M:%SZ) POST ${PATH_TO_CALL}"
  if RESPONSE=$(curl -fsSL -X POST \
    -H "x-cron-secret: ${NEXTROLE_CRON_SECRET}" \
    -H "Content-Type: application/json" \
    --max-time 120 \
    "${BACKEND_URL}${PATH_TO_CALL}"); then
    echo "[nextrole-cron] ok ${PATH_TO_CALL}: ${RESPONSE}"
  else
    echo "[nextrole-cron] FAILED ${PATH_TO_CALL} — fortsetter med neste"
  fi
}

call_endpoint "/api/internal/next-role/check-trial-expiry"
call_endpoint "/api/internal/next-role/drip-tick"

echo "[nextrole-cron] done"
