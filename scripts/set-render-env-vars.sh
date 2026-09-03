#!/usr/bin/env bash
# Slice 9X.70-77 — Sett env-vars på Render via API
#
# Bruk:
#   RENDER_API_KEY=rnd_XXX ./scripts/set-render-env-vars.sh
#
# Eller hvis du har lagret i keychain under et bestemt navn:
#   export RENDER_API_KEY=$(security find-generic-password -s "<navn>" -w)
#   ./scripts/set-render-env-vars.sh

set -euo pipefail

if [ -z "${RENDER_API_KEY:-}" ]; then
  echo "✗ RENDER_API_KEY ikke satt. Eksporter den først:"
  echo "  export RENDER_API_KEY=rnd_..."
  exit 1
fi

# Finn service-IDen for creatorhubn-backend
SERVICE_ID="${RENDER_SERVICE_ID:-}"
if [ -z "$SERVICE_ID" ]; then
  echo "→ Henter service-ID for creatorhubn-backend…"
  SERVICE_ID=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
    https://api.render.com/v1/services?limit=50 | \
    python3 -c "
import sys, json
services = json.load(sys.stdin)
for s in services:
    svc = s.get('service', {})
    if 'creatorhubn-backend' in svc.get('name', '').lower():
        print(svc['id'])
        sys.exit(0)
" || echo "")
  if [ -z "$SERVICE_ID" ]; then
    echo "✗ Fant ingen service med 'creatorhubn-backend' i navnet."
    echo "  Sett RENDER_SERVICE_ID=srv-XXX manuelt og prøv igjen."
    exit 1
  fi
  echo "  ✓ Service-ID: $SERVICE_ID"
fi

# Env-vars som skal settes
# Brukerne fyller inn verdier — defaults er bare for ikke-hemmelige
declare -A ENV_VARS=(
  ["GA4_MEASUREMENT_ID"]="${GA4_MEASUREMENT_ID:-}"
  ["GA4_API_SECRET"]="${GA4_API_SECRET:-}"
  ["AI_CUSTOMER_MARKUP"]="${AI_CUSTOMER_MARKUP:-2.5}"
  ["USD_NOK_RATE"]="${USD_NOK_RATE:-11}"
  ["STRIPE_DRIFT_CRON_SECRET"]="${STRIPE_DRIFT_CRON_SECRET:-}"
)

# Oppdater kun eksplisitt valgte nøkler. Collection-PUT er forbudt fordi det
# erstatter hele produksjonsmiljøet. Verdiene sendes via stdin og skrives aldri
# til logg eller en mellomfil.
echo "→ Setter env-vars per nøkkel på service $SERVICE_ID:"
updated_count=0
for key in "${!ENV_VARS[@]}"; do
  value="${ENV_VARS[$key]}"
  if [ -z "$value" ]; then
    echo "  ⊘ $key (skipper — ikke satt i miljøet)"
    continue
  fi

  echo "  + $key"
  if ! jq -cn --arg value "$value" '{value: $value}' |
    curl -fsS --connect-timeout 5 --max-time 30 \
      -X PUT \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @- \
      -o /dev/null \
      "https://api.render.com/v1/services/$SERVICE_ID/env-vars/$key"; then
    echo "✗ Klarte ikke å oppdatere $key; ingen produksjonsdeploy er startet." >&2
    exit 1
  fi
  updated_count=$((updated_count + 1))
done

if [ "$updated_count" -eq 0 ]; then
  echo "✗ Ingen env-vars å sette. Eksporter f.eks.:"
  echo "  export GA4_MEASUREMENT_ID=G-XXXXXXXXXX"
  echo "  export GA4_API_SECRET=..."
  echo "  export STRIPE_DRIFT_CRON_SECRET=$(openssl rand -hex 32)"
  exit 1
fi

echo ""
echo "✓ Env-vars satt uten å starte produksjonsdeploy."
echo "  Kjør GitHub Actions-workflowen 'Deploy shared Render backend' fra current main."
echo "  Den kanoniske workflowen må eie migrering, eksakt commit og smoke-test."
