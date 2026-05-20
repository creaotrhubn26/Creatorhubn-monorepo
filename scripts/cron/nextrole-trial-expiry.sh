#!/bin/sh
# NextRole trial-expiry cron-trigger.
#
# Render kjører dette daglig (se render.yaml schedule "0 9 * * *").
# POSTer til backend-endepunktet som finner brukere med ~3 dager
# igjen av trial og sender trialExpiringEmail.
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

echo "[nextrole-cron] $(date -u +%Y-%m-%dT%H:%M:%SZ) checking trial expiry"

RESPONSE=$(curl -fsSL -X POST \
  -H "x-cron-secret: ${NEXTROLE_CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 120 \
  "${BACKEND_URL}/api/internal/next-role/check-trial-expiry")

echo "[nextrole-cron] response: ${RESPONSE}"
echo "[nextrole-cron] done"
