#!/usr/bin/env bash
set -euo pipefail

production_url="https://creatorhub-backend-rtbl.onrender.com"
staging_url="${LEADGRID_STAGING_BASE_URL:-}"
staging_email="${LEADGRID_STAGING_EMAIL:-}"
staging_password="${LEADGRID_STAGING_PASSWORD:-}"
requested_org_id="${LEADGRID_STAGING_ORG_ID:-}"
brreg_org_number="${LEADGRID_STAGING_BRREG_ORG_NUMBER:-937518684}"
run_simulator_e2e="${LEADGRID_RUN_SIMULATOR_E2E:-0}"
run_role_room_e2e="${LEADGRID_RUN_ROLE_ROOM_E2E:-0}"
run_role_room_campaign_e2e="${LEADGRID_RUN_ROLE_ROOM_CAMPAIGN_E2E:-0}"
simulator_destination="${LEADGRID_STAGING_SIMULATOR_DESTINATION:-platform=iOS Simulator,name=iPad Pro 13-inch (M5),OS=26.5}"

if [[ -z "$staging_url" || -z "$staging_email" || -z "$staging_password" ]]; then
  echo "Mangler LEADGRID_STAGING_BASE_URL, LEADGRID_STAGING_EMAIL eller LEADGRID_STAGING_PASSWORD." >&2
  exit 2
fi
if [[ "$staging_url" != https://* || "$staging_url" == "$production_url" ]]; then
  echo "Avvist: testen krever en eksplisitt HTTPS staging-URL som ikke er produksjon." >&2
  exit 2
fi
if [[ "$run_role_room_campaign_e2e" == "1" && "$run_role_room_e2e" != "1" ]]; then
  echo "LEADGRID_RUN_ROLE_ROOM_CAMPAIGN_E2E krever LEADGRID_RUN_ROLE_ROOM_E2E=1." >&2
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
timestamp="$(date -u +%Y%m%d%H%M%S)"

role_room_project_id=""
role_room_campaign_id=""
if [[ "$run_role_room_e2e" == "1" ]]; then
  role_room_public_html="$(curl --fail-with-body --silent --show-error --location --max-time 30 https://theroleroom.com)"
  if ! grep -q "TheRoleRoom_App_Logo.png" <<<"$role_room_public_html"; then
    echo "The Role Room sitt offentlige metadata peker ikke på riktig logo." >&2
    exit 7
  fi
  if ! grep -q '<title>The Role Room' <<<"$role_room_public_html" ||
     ! grep -q 'rel="canonical" href="https://theroleroom.com/' <<<"$role_room_public_html" ||
     ! grep -q 'property="og:site_name" content="The Role Room"' <<<"$role_room_public_html"; then
    echo "The Role Room sitt offentlige HTML-skall har feil tittel, canonical eller Open Graph-merkevare." >&2
    exit 7
  fi
  if grep -q "creatorhub-wordmark-light.png" <<<"$role_room_public_html"; then
    echo "The Role Room sitt offentlige metadata inneholder fortsatt CreatorHub-logoen." >&2
    exit 7
  fi

  role_room_preview_payload="$(jq -n --arg organization_id "$org_id" '{organization_id: $organization_id, website_url: "theroleroom.com"}')"
  role_room_preview="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$role_room_preview_payload" \
    "$staging_url/api/leadgrid/project-onboarding/preview")"
  jq -e '
    .preview.website_domain == "theroleroom.com" and
    .preview.project_name == "The Role Room" and
    .preview.category == "Film, TV, casting og talent" and
    (.preview.recommended_profiles | length) == 6 and
    ([.preview.recommended_profiles[].template_key] | sort) ==
      (["role_room.production", "role_room.agencies", "role_room.casting", "role_room.education", "role_room.dance", "role_room.talents"] | sort) and
    (.preview.recommended_profiles[] | select(.template_key == "role_room.talents") | .brief.subject_kind) == "person" and
    (.preview.recommended_profiles[] | select(.template_key == "role_room.education") | .brief.qualification_requirement) == "required"
  ' <<<"$role_room_preview" >/dev/null

  role_room_commit_payload="$(jq -n \
    --arg organization_id "$org_id" \
    --arg preview_id "$(jq -er '.preview.id' <<<"$role_room_preview")" \
    --arg administrator_email "$staging_email" \
    --arg project_name "$(jq -er '.preview.project_name' <<<"$role_room_preview")" \
    --arg project_description "$(jq -er '.preview.project_description' <<<"$role_room_preview")" \
    --arg category "$(jq -er '.preview.category' <<<"$role_room_preview")" \
    --arg target_audience "$(jq -er '.preview.brand_profile.targetAudience' <<<"$role_room_preview")" \
    --argjson profiles "$(jq '.preview.recommended_profiles' <<<"$role_room_preview")" \
    '{
      organization_id: $organization_id,
      preview_id: $preview_id,
      profiles: $profiles,
      brand_overrides: {
        project_name: $project_name,
        project_description: $project_description,
        category: $category,
        target_audience: $target_audience
      },
      access_setup: {
        organization: {mode: "current"},
        administrator_email: $administrator_email,
        team: {mode: "none"},
        invitations: []
      }
    }')"
  role_room_commit="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$role_room_commit_payload" \
    "$staging_url/api/leadgrid/project-onboarding/commit")"
  role_room_project_id="$(jq -er '.project.id' <<<"$role_room_commit")"
  jq -e --arg project_id "$role_room_project_id" '
    .project.id == $project_id and
    .project.name == "The Role Room" and
    (.profiles | length) == 6 and
    ([.profiles[].template_key] | unique | length) == 6 and
    .access.discovery_access_verified == true
  ' <<<"$role_room_commit" >/dev/null

  role_room_profiles="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    "$staging_url/api/leadgrid/projects/$role_room_project_id/discovery/profiles")"
  jq -e '
    (.profiles | length) == 6 and
    ([.profiles[].template_key] | unique | length) == 6 and
    (.profiles[] | select(.template_key == "role_room.talents") | .brief.subject_kind) == "person"
  ' <<<"$role_room_profiles" >/dev/null

  if [[ "$run_role_room_campaign_e2e" == "1" ]]; then
    role_room_campaign_payload="$(jq -n \
      --arg name "[E2E] The Role Room alle profiler $timestamp" \
      --argjson profiles "$(jq '[.profiles[] | select(.status == "active") | {profile_id: .id, expected_version: .version}]' <<<"$role_room_profiles")" \
      '{name: $name, profiles: $profiles}')"
    role_room_campaign="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      -H "Idempotency-Key: role-room-staging-e2e-$timestamp" \
      -H "Content-Type: application/json" \
      --data-binary "$role_room_campaign_payload" \
      "$staging_url/api/leadgrid/projects/$role_room_project_id/discovery/campaign-runs")"
    role_room_campaign_id="$(jq -er '.campaign.id' <<<"$role_room_campaign")"
    jq -e '.campaign.total_profiles == 6' <<<"$role_room_campaign" >/dev/null

    role_room_campaign_complete=false
    for _attempt in {1..120}; do
      role_room_campaign="$(curl --fail-with-body --silent --show-error \
        -H "Authorization: Bearer $token" \
        -H "X-Organization-Id: $org_id" \
        -H "X-Leadgrid-Organization-Id: $org_id" \
        "$staging_url/api/leadgrid/projects/$role_room_project_id/discovery/campaign-runs/$role_room_campaign_id")"
      role_room_campaign_status="$(jq -er '.status' <<<"$role_room_campaign")"
      if [[ "$role_room_campaign_status" =~ ^(completed|partial|failed|cancelled)$ ]]; then
        role_room_campaign_complete=true
        break
      fi
      sleep 5
    done
    if [[ "$role_room_campaign_complete" != "true" ]]; then
      echo "The Role Room-kampanjen fullførte ikke innen 10 minutter." >&2
      exit 8
    fi
    jq -e '
      .status == "completed" and
      .total_profiles == 6 and
      .completed_profiles == 6 and
      .failed_profiles == 0 and
      (.items | length) == 6 and
      ([.items[].profile_id] | unique | length) == 6 and
      ([.items[].candidate_count] | add) > 0
    ' <<<"$role_room_campaign" >/dev/null
  fi
fi

creation_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
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

create_response="$(curl --fail-with-body --silent --show-error   -H "Authorization: Bearer $token"   -H "X-Organization-Id: $org_id"   -H "X-Leadgrid-Organization-Id: $org_id"   -H "Idempotency-Key: leadgrid-staging-e2e-$creation_id"   -H "Content-Type: application/json"   --data-binary "$lead_payload"   "$staging_url/api/admin-room/lead-map/leads")"
lead_id="$(jq -er '.id' <<<"$create_response")"

detail_response="$(curl --fail-with-body --silent --show-error   -H "Authorization: Bearer $token"   -H "X-Organization-Id: $org_id"   -H "X-Leadgrid-Organization-Id: $org_id"   "$staging_url/api/admin-room/lead-map/leads/$lead_id")"
if ! jq -e --arg id "$lead_id" '(.id == $id) or (.lead.id == $id)'   <<<"$detail_response" >/dev/null; then
  echo "Leaden kunne ikke leses tilbake fra staging-persistensen." >&2
  exit 4
fi

# Leadbook: opprett samme kladd to ganger med samme creation_id, les den
# tilbake fra detalj og liste, og slett testkladden gjennom GDPR-endepunktet.
leadbook_creation_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
leadbook_payload="$(jq -n --arg creation_id "$leadbook_creation_id" --arg title "[E2E] Leadbook staging $timestamp" '{
    creation_id: $creation_id,
    title: $title,
    customer_label: "Anonymisert stagingkunde",
    industry: "Programvare",
    outcome: "ongoing",
    channel: "telephone",
    summary: "Automatisk staging-E2E. Skal slettes i samme test."
  }')"
leadbook_create_one="$(curl --fail-with-body --silent --show-error -H "Authorization: Bearer $token" -H "X-Organization-Id: $org_id" -H "X-Leadgrid-Organization-Id: $org_id" -H "Content-Type: application/json" --data-binary "$leadbook_payload" "$staging_url/api/leadgrid/leadbook/examples")"
leadbook_create_two="$(curl --fail-with-body --silent --show-error -H "Authorization: Bearer $token" -H "X-Organization-Id: $org_id" -H "X-Leadgrid-Organization-Id: $org_id" -H "Content-Type: application/json" --data-binary "$leadbook_payload" "$staging_url/api/leadgrid/leadbook/examples")"
leadbook_id="$(jq -er '.id' <<<"$leadbook_create_one")"
if [[ "$(jq -er '.id' <<<"$leadbook_create_two")" != "$leadbook_id" ]]; then
  echo "Leadbook-idempotens returnerte forskjellige ID-er." >&2
  exit 6
fi
leadbook_detail="$(curl --fail-with-body --silent --show-error -H "Authorization: Bearer $token" -H "X-Organization-Id: $org_id" -H "X-Leadgrid-Organization-Id: $org_id" "$staging_url/api/leadgrid/leadbook/examples/$leadbook_id")"
jq -e --arg id "$leadbook_id" '.example.id == $id' <<<"$leadbook_detail" >/dev/null
leadbook_list="$(curl --fail-with-body --silent --show-error -H "Authorization: Bearer $token" -H "X-Organization-Id: $org_id" -H "X-Leadgrid-Organization-Id: $org_id" "$staging_url/api/leadgrid/leadbook/examples?limit=50")"
jq -e --arg id "$leadbook_id" '.examples | any(.id == $id)' <<<"$leadbook_list" >/dev/null
leadbook_delete="$(curl --fail-with-body --silent --show-error -H "Authorization: Bearer $token" -H "X-Organization-Id: $org_id" -H "X-Leadgrid-Organization-Id: $org_id" -H "Content-Type: application/json" --data-binary '{}' "$staging_url/api/leadgrid/leadbook/examples/$leadbook_id/request-deletion")"
jq -e '.deleted == true' <<<"$leadbook_delete" >/dev/null

enrichment_ready=false
for _attempt in {1..30}; do
  enrichment_response="$(curl --fail-with-body --silent --show-error     -H "Authorization: Bearer $token"     -H "X-Organization-Id: $org_id"     -H "X-Leadgrid-Organization-Id: $org_id"     "$staging_url/api/admin-room/lead-map/leads/$lead_id/enrichment")"
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
  simulator_tests=(
    "-only-testing:LeadMapAppUITests/QASweepTests/testStagingLeadCreationOfflineReconnect"
    "-only-testing:LeadMapAppUITests/QASweepTests/testStagingPondusUsageOfflineReconnect"
  )
  if [[ "$run_role_room_e2e" == "1" ]]; then
    simulator_tests+=(
      "-only-testing:LeadMapAppUITests/QASweepTests/testStagingRoleRoomProjectOpensAllDiscoveryProfiles"
    )
  fi
  (
    cd "$app_dir"
    xcodegen generate
    LEADGRID_STAGING_BASE_URL="$staging_url" \
    LEADGRID_STAGING_BEARER_TOKEN="$token" \
    LEADGRID_STAGING_ORG_ID="$org_id" \
    LEADGRID_STAGING_ROLE_ROOM_PROJECT_ID="$role_room_project_id" \
      xcodebuild test -quiet \
        -project LeadMapApp.xcodeproj \
        -scheme LeadMapApp \
        -destination "$simulator_destination" \
        -derivedDataPath "$derived_data" \
        "${simulator_tests[@]}" \
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
echo "LEADBOOK_CREATE_DETAIL_LIST_IDEMPOTENCY_DELETE=PASS"
if [[ "$run_simulator_e2e" == "1" ]]; then
  echo "PONDUS_OFFLINE_RECONNECT=PASS"
fi
if [[ "$run_role_room_e2e" == "1" ]]; then
  echo "ROLE_ROOM_ONBOARDING_PROFILES_NATIVE=PASS"
  echo "ROLE_ROOM_PROJECT_ID=$role_room_project_id"
fi
if [[ "$run_role_room_campaign_e2e" == "1" ]]; then
  echo "ROLE_ROOM_CAMPAIGN_ALL_PROFILES_RESULTS=PASS"
  echo "ROLE_ROOM_CAMPAIGN_ID=$role_room_campaign_id"
fi
echo "PAIR_CODE=$pair_code"
echo "PAIR_CODE_EXPIRES_SECONDS=300"
