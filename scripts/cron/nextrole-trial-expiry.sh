#!/bin/sh
# Creatorhub daglig cron-trigger.
#
# Render kjører dette daglig (se render.yaml schedule "0 9 * * *").
# Kaller tre interne endepunkter sekvensielt:
#
#   1. check-trial-expiry — sender trialExpiringEmail til brukere med
#      ~3 dager igjen av trial.
#   2. drip-tick — sender dag 3 / dag 7 / dag 13 / post-trial-winback
#      e-poster basert på trial-start-tidspunkt.
#   3. role-room reconcile-seats (dry-run) — sammenligner Stripe-quantity
#      mot aktive medlemmer pr. produksjonsteam-eier. Drift logges som
#      billing-alert i admin-panelet. Apply kjøres manuelt fra admin.
#
# Alle er idempotente — de logger hva som er sendt og dropper duplikater.
#
# Env-variabler (fra render.yaml):
#   BACKEND_URL                       base-URL til creatorhub-backend
#   NEXTROLE_CRON_SECRET              NextRole-secret (auto-injectet)
#   ROLE_ROOM_RECONCILE_CRON_TOKEN    Reconcile-token (auto-injectet)

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
  AUTH_HEADER="$2"
  echo "[creatorhub-cron] $(date -u +%Y-%m-%dT%H:%M:%SZ) POST ${PATH_TO_CALL}"
  if RESPONSE=$(curl -fsSL -X POST \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    --max-time 120 \
    "${BACKEND_URL}${PATH_TO_CALL}"); then
    echo "[creatorhub-cron] ok ${PATH_TO_CALL}: ${RESPONSE}"
  else
    echo "[creatorhub-cron] FAILED ${PATH_TO_CALL} — fortsetter med neste"
  fi
}

# NextRole trial-flows (krever NEXTROLE_CRON_SECRET)
call_endpoint "/api/internal/next-role/check-trial-expiry" \
  "x-cron-secret: ${NEXTROLE_CRON_SECRET}"
call_endpoint "/api/internal/next-role/drip-tick" \
  "x-cron-secret: ${NEXTROLE_CRON_SECRET}"

# Role Room seat-reconciliation (dry-run — admin må kjøre apply manuelt)
if [ -n "${ROLE_ROOM_RECONCILE_CRON_TOKEN}" ]; then
  call_endpoint "/api/admin-room/role-room/reconcile-seats?apply=false" \
    "x-reconcile-token: ${ROLE_ROOM_RECONCILE_CRON_TOKEN}"
else
  echo "[creatorhub-cron] ROLE_ROOM_RECONCILE_CRON_TOKEN ikke satt — hopper over reconcile"
fi

echo "[creatorhub-cron] done"
