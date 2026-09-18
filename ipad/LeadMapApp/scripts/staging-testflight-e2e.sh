#!/usr/bin/env bash
set -euo pipefail

production_url="https://creatorhub-backend-rtbl.onrender.com"
staging_url="${LEADGRID_STAGING_BASE_URL:-}"
staging_email="${LEADGRID_STAGING_EMAIL:-}"
staging_password="${LEADGRID_STAGING_PASSWORD:-}"
requested_org_id="${LEADGRID_STAGING_ORG_ID:-}"
brreg_org_number="${LEADGRID_STAGING_BRREG_ORG_NUMBER:-937518684}"
run_simulator_e2e="${LEADGRID_RUN_SIMULATOR_E2E:-0}"
simulator_destination="${LEADGRID_STAGING_SIMULATOR_DESTINATION:-platform=iOS Simulator,name=iPad Pro 13-inch (M5),OS=26.5}"

if [[ -z "$staging_url" || -z "$staging_email" || -z "$staging_password" ]]; then
  echo "Mangler LEADGRID_STAGING_BASE_URL, LEADGRID_STAGING_EMAIL eller LEADGRID_STAGING_PASSWORD." >&2
  exit 2
fi
if [[ "$staging_url" != https://* || "$staging_url" == "$production_url" ]]; then
  echo "Avvist: testen krever en eksplisitt HTTPS staging-URL som ikke er produksjon." >&2
  exit 2
fi
staging_url="${staging_url%/}"

for required_command in curl jq uuidgen; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Mangler påkrevd kommando: $required_command" >&2
    exit 2
  fi
done

login_payload="$(jq -n --arg email "$staging_email" --arg password "$staging_password"   '{email: $email, password: $password, type: "general"}')"
login_response="$(curl --fail-with-body --silent --show-error   -H "Content-Type: application/json"   --data-binary "$login_payload"   "$staging_url/api/auth/login")"

if [[ "$(jq -r '.needs_2fa // false' <<<"$login_response")" == "true" ]]; then
  echo "Staging-testbrukeren krever 2FA. Bruk en dedikert testbruker uten interaktiv 2FA." >&2
  exit 3
fi
token="$(jq -er '.token' <<<"$login_response")"

organizations="$(curl --fail-with-body --silent --show-error   -H "Authorization: Bearer $token"   "$staging_url/api/admin-room/lead-map/organizations")"
if [[ -n "$requested_org_id" ]]; then
  org_id="$requested_org_id"
  jq -e --arg id "$org_id" '.organizations[] | select(.id == $id)'     <<<"$organizations" >/dev/null
else
  org_id="$(jq -er '.organizations[0].id' <<<"$organizations")"
fi

creation_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
timestamp="$(date -u +%Y%m%d%H%M%S)"
lead_name="[E2E] TestFlight staging $timestamp"
lead_email="leadgrid-e2e+$timestamp@example.invalid"
lead_payload="$(jq -n   --arg creation_id "$creation_id"   --arg organization_id "$org_id"   --arg name "$lead_name"   --arg email "$lead_email"   --arg organization_number "$brreg_org_number"   '{
    creation_id: $creation_id,
    organization_id: $organization_id,
    name: $name,
    company: $name,
    organization_number: $organization_number,
    email: $email,
    country: "NO",
    lead_temperature: "warm",
    pipeline_stage: "new",
    lead_status: "unvisited",
    location_confidence: "unknown",
    lead_source: "staging_testflight_e2e",
    allow_duplicate: true
  }')"

create_response="$(curl --fail-with-body --silent --show-error   -H "Authorization: Bearer $token"   -H "X-Organization-Id: $org_id"   -H "Idempotency-Key: leadgrid-staging-e2e-$creation_id"   -H "Content-Type: application/json"   --data-binary "$lead_payload"   "$staging_url/api/admin-room/lead-map/leads")"
lead_id="$(jq -er '.id' <<<"$create_response")"

detail_response="$(curl --fail-with-body --silent --show-error   -H "Authorization: Bearer $token"   -H "X-Organization-Id: $org_id"   "$staging_url/api/admin-room/lead-map/leads/$lead_id")"
if ! jq -e --arg id "$lead_id" '(.id == $id) or (.lead.id == $id)'   <<<"$detail_response" >/dev/null; then
  echo "Leaden kunne ikke leses tilbake fra staging-persistensen." >&2
  exit 4
fi

enrichment_ready=false
for _attempt in {1..30}; do
  enrichment_response="$(curl --fail-with-body --silent --show-error     -H "Authorization: Bearer $token"     -H "X-Organization-Id: $org_id"     "$staging_url/api/admin-room/lead-map/leads/$lead_id/enrichment")"
  if jq -e '.enrichment != null' <<<"$enrichment_response" >/dev/null; then
    enrichment_ready=true
    break
  fi
  sleep 2
done
if [[ "$enrichment_ready" != "true" ]]; then
  echo "BRREG-worker fullførte ikke innen 60 sekunder." >&2
  exit 5
fi

if [[ "$run_simulator_e2e" == "1" ]]; then
  for required_command in xcodegen xcodebuild; do
    if ! command -v "$required_command" >/dev/null 2>&1; then
      echo "Mangler påkrevd kommando for simulator-E2E: $required_command" >&2
      exit 2
    fi
  done
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  app_dir="$(cd "$script_dir/.." && pwd)"
  derived_data="${LEADGRID_STAGING_DERIVED_DATA:-/private/tmp/leadgrid-staging-e2e}"
  (
    cd "$app_dir"
    xcodegen generate
    LEADGRID_STAGING_BASE_URL="$staging_url" \
    LEADGRID_STAGING_BEARER_TOKEN="$token" \
    LEADGRID_STAGING_ORG_ID="$org_id" \
      xcodebuild test -quiet \
        -project LeadMapApp.xcodeproj \
        -scheme LeadMapApp \
        -destination "$simulator_destination" \
        -derivedDataPath "$derived_data" \
        -only-testing:LeadMapAppUITests/QASweepTests/testStagingLeadCreationOfflineReconnect \
        -only-testing:LeadMapAppUITests/QASweepTests/testStagingPondusUsageOfflineReconnect \
        CODE_SIGNING_ALLOWED=NO
  )
  echo "STAGING_E2E_SIMULATOR=PASS"
fi

pair_response="$(curl --fail-with-body --silent --show-error   -H "Authorization: Bearer $token"   -H "Content-Type: application/json"   --data-binary '{}'   "$staging_url/api/admin-room/ipad-tokens/generate")"
pair_code="$(jq -er '.shortCode' <<<"$pair_response")"

echo "STAGING_E2E_API=PASS"
echo "STAGING_URL=$staging_url"
echo "ORGANIZATION_ID=$org_id"
echo "LEAD_ID=$lead_id"
echo "LEAD_NAME=$lead_name"
echo "BRREG_WORKER=PASS"
if [[ "$run_simulator_e2e" == "1" ]]; then
  echo "PONDUS_OFFLINE_RECONNECT=PASS"
fi
echo "PAIR_CODE=$pair_code"
echo "PAIR_CODE_EXPIRES_SECONDS=300"
