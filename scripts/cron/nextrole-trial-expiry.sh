#!/bin/sh
# Creatorhub daglig cron-trigger.
#
# Render kjører dette daglig (se render.yaml schedule "0 9 * * *").
# Kaller fire interne arbeidsflyter sekvensielt:
#
#   1. check-trial-expiry — sender trialExpiringEmail til brukere med
#      ~3 dager igjen av trial.
#   2. drip-tick — sender dag 3 / dag 7 / dag 13 / post-trial-winback
#      e-poster basert på trial-start-tidspunkt.
#   3. role-room reconcile-seats (dry-run) — sammenligner Stripe-quantity
#      mot aktive medlemmer pr. produksjonsteam-eier. Drift logges som
#      billing-alert i admin-panelet. Apply kjøres manuelt fra admin.
#   4. affiliate-payouts — kjøres kun den første i måneden og bare når
#      utbetalingsflagget er eksplisitt aktivert.
#
# Alle er idempotente — de logger hva som er sendt og dropper duplikater.
#
# Env-variabler (fra render.yaml):
#   BACKEND_URL                       base-URL til creatorhub-backend
#   NEXTROLE_CRON_SECRET              NextRole-secret (auto-injectet)
#   ROLE_ROOM_RECONCILE_CRON_TOKEN    Reconcile-token (auto-injectet)
#   ROLE_ROOM_AFFILIATE_PAYOUT_CRON_SECRET  Affiliate payout-token
#   ROLE_ROOM_AFFILIATE_PAYOUTS_ENABLED     Global utbetalingsbryter

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

# Affiliateoppgjør: månedlig, med separat hemmelighet og global kill switch.
case "${ROLE_ROOM_AFFILIATE_PAYOUTS_ENABLED:-false}" in
  1|true|TRUE|yes|YES|on|ON)
    if [ "$(date -u +%d)" = "01" ]; then
      if [ -n "${ROLE_ROOM_AFFILIATE_PAYOUT_CRON_SECRET}" ]; then
        call_endpoint "/api/internal/role-room/affiliate-payouts/run" \
          "x-cron-secret: ${ROLE_ROOM_AFFILIATE_PAYOUT_CRON_SECRET}"
      else
        echo "[creatorhub-cron] affiliate payouts er aktivert, men cron-secret mangler — hopper over"
      fi
    fi
    ;;
esac

echo "[creatorhub-cron] done"
