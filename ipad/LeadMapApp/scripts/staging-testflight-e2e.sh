#!/usr/bin/env bash
set -euo pipefail

production_url="https://creatorhub-backend-rtbl.onrender.com"
staging_url="${LEADGRID_STAGING_BASE_URL:-}"
staging_email="${LEADGRID_STAGING_EMAIL:-}"
staging_password="${LEADGRID_STAGING_PASSWORD:-}"
staging_bearer_token="${LEADGRID_STAGING_BEARER_TOKEN:-}"
requested_org_id="${LEADGRID_STAGING_ORG_ID:-}"
requested_project_id="${LEADGRID_STAGING_PROJECT_ID:-}"
brreg_org_number="${LEADGRID_STAGING_BRREG_ORG_NUMBER:-937518684}"
run_simulator_e2e="${LEADGRID_RUN_SIMULATOR_E2E:-0}"
run_role_room_e2e="${LEADGRID_RUN_ROLE_ROOM_E2E:-0}"
run_role_room_campaign_e2e="${LEADGRID_RUN_ROLE_ROOM_CAMPAIGN_E2E:-0}"
run_tidum_e2e="${LEADGRID_RUN_TIDUM_E2E:-0}"
run_tidum_campaign_e2e="${LEADGRID_RUN_TIDUM_CAMPAIGN_E2E:-0}"
simulator_destination="${LEADGRID_STAGING_SIMULATOR_DESTINATION:-platform=iOS Simulator,name=iPad Pro 13-inch (M5),OS=26.5}"

if [[ -z "$staging_url" || ( -z "$staging_bearer_token" && ( -z "$staging_email" || -z "$staging_password" ) ) ]]; then
  echo "Mangler staging-URL og enten bearer-token eller e-post/passord." >&2
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
if [[ "$run_tidum_campaign_e2e" == "1" && "$run_tidum_e2e" != "1" ]]; then
  echo "LEADGRID_RUN_TIDUM_CAMPAIGN_E2E krever LEADGRID_RUN_TIDUM_E2E=1." >&2
  exit 2
fi
staging_url="${staging_url%/}"

for required_command in curl jq uuidgen; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Mangler påkrevd kommando: $required_command" >&2
    exit 2
  fi
done

if [[ -n "$staging_bearer_token" ]]; then
  token="$staging_bearer_token"
  curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    "$staging_url/api/auth/user" >/dev/null
  echo "STAGING_E2E_AUTH=durable_session"
else
  login_payload="$(jq -n --arg email "$staging_email" --arg password "$staging_password"   '{email: $email, password: $password, type: "general"}')"
  login_response="$(curl --fail-with-body --silent --show-error   -H "Content-Type: application/json"   --data-binary "$login_payload"   "$staging_url/api/auth/login")"

  if [[ "$(jq -r '.needs_2fa // false' <<<"$login_response")" == "true" ]]; then
    echo "Staging-testbrukeren krever 2FA. Bruk en dedikert testbruker uten interaktiv 2FA." >&2
    exit 3
  fi
  token="$(jq -er '.token' <<<"$login_response")"
  echo "STAGING_E2E_AUTH=password_login"
fi
echo "STAGING_E2E_STAGE=authenticated"

organizations="$(curl --fail-with-body --silent --show-error   -H "Authorization: Bearer $token"   "$staging_url/api/admin-room/lead-map/organizations")"
if [[ -n "$requested_org_id" ]]; then
  org_id="$requested_org_id"
  jq -e --arg id "$org_id" '.organizations[] | select(.id == $id)'     <<<"$organizations" >/dev/null
else
  org_id="$(jq -er '.organizations[0].id' <<<"$organizations")"
fi
echo "STAGING_E2E_STAGE=organization_resolved"
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
  echo "STAGING_E2E_STAGE=role_room_metadata_verified"

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
  echo "STAGING_E2E_STAGE=role_room_preview_verified"

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
  echo "STAGING_E2E_STAGE=role_room_project_committed"

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
  echo "STAGING_E2E_STAGE=role_room_profiles_verified"

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
      (.status == "completed" or .status == "partial") and
      .total_profiles == 6 and
      (.completed_profiles + .partial_profiles) == 6 and
      .failed_profiles == 0 and
      (.items | length) == 6 and
      ([.items[].status] | all(. == "completed" or . == "partial")) and
      ([.items[].profile_id] | unique | length) == 6 and
      ([.items[].candidate_count] | add) > 0
    ' <<<"$role_room_campaign" >/dev/null
    echo "STAGING_E2E_STAGE=role_room_campaign_verified"
  fi
fi

tidum_project_id=""
tidum_campaign_id=""
if [[ "$run_tidum_e2e" == "1" ]]; then
  tidum_preview_payload="$(jq -n --arg organization_id "$org_id" '{organization_id: $organization_id, website_url: "tidum.no"}')"
  tidum_preview="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$tidum_preview_payload" \
    "$staging_url/api/leadgrid/project-onboarding/preview")"
  jq -e '
    .preview.website_domain == "tidum.no" and
    .preview.project_name == "Tidum" and
    .preview.category == "Arbeidstid, omsorg og miljøarbeid" and
    .preview.category_confidence == "high" and
    (.preview.recommended_profiles | length) == 4 and
    ([.preview.recommended_profiles[].template_key] | sort) ==
      (["tidum.child_welfare", "tidum.residential_care", "tidum.bpa_field_services", "tidum.municipal_services"] | sort) and
    ([.preview.recommended_profiles[].brief.country_code] | unique) == ["NO"] and
    ([.preview.recommended_profiles[].brief.city] | all(. == null)) and
    (.preview.recommended_profiles[] | select(.template_key == "tidum.child_welfare") |
      .brief.organization_forms == ["AS", "IKS", "STI"] and
      .brief.employee_count.minimum == 5) and
    (.preview.recommended_profiles[] | select(.template_key == "tidum.municipal_services") |
      .brief.organization_name_queries == ["kommune"] and
      .brief.organization_forms == ["KOMM"])
  ' <<<"$tidum_preview" >/dev/null
  echo "STAGING_E2E_STAGE=tidum_preview_verified"

  tidum_commit_payload="$(jq -n \
    --arg organization_id "$org_id" \
    --arg preview_id "$(jq -er '.preview.id' <<<"$tidum_preview")" \
    --arg administrator_email "$staging_email" \
    --arg project_name "$(jq -er '.preview.project_name' <<<"$tidum_preview")" \
    --arg project_description "$(jq -er '.preview.project_description' <<<"$tidum_preview")" \
    --arg category "$(jq -er '.preview.category' <<<"$tidum_preview")" \
    --arg target_audience "$(jq -er '.preview.brand_profile.targetAudience' <<<"$tidum_preview")" \
    --argjson profiles "$(jq '.preview.recommended_profiles' <<<"$tidum_preview")" \
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
  tidum_commit="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$tidum_commit_payload" \
    "$staging_url/api/leadgrid/project-onboarding/commit")"
  tidum_project_id="$(jq -er '.project.id' <<<"$tidum_commit")"
  jq -e --arg project_id "$tidum_project_id" '
    .project.id == $project_id and
    .project.name == "Tidum" and
    (.profiles | length) >= 4 and
    ([.profiles[] | select((.template_key // "") | startswith("tidum.")) | .template_key] | length) == 4 and
    ([.profiles[] | select((.template_key // "") | startswith("tidum.")) | .template_key] | unique | length) == 4 and
    .access.discovery_access_verified == true
  ' <<<"$tidum_commit" >/dev/null
  echo "STAGING_E2E_STAGE=tidum_project_committed"

  tidum_profiles="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    "$staging_url/api/leadgrid/projects/$tidum_project_id/discovery/profiles")"
  jq -e '
    (.profiles | length) >= 4 and
    ([.profiles[] | select((.template_key // "") | startswith("tidum.")) | .template_key] | length) == 4 and
    ([.profiles[] | select((.template_key // "") | startswith("tidum.")) | .template_key] | unique | length) == 4 and
    (.profiles[] | select(.template_key == "tidum.child_welfare") |
      .brief.country_code == "NO" and .brief.employee_count.minimum == 5) and
    (.profiles[] | select(.template_key == "tidum.municipal_services") |
      .brief.organization_forms == ["KOMM"])
  ' <<<"$tidum_profiles" >/dev/null
  echo "STAGING_E2E_STAGE=tidum_profiles_verified"

  tidum_replay_preview="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$tidum_preview_payload" \
    "$staging_url/api/leadgrid/project-onboarding/preview")"
  tidum_replay_payload="$(jq -n \
    --arg organization_id "$org_id" \
    --arg preview_id "$(jq -er '.preview.id' <<<"$tidum_replay_preview")" \
    '{organization_id: $organization_id, preview_id: $preview_id}')"
  tidum_replay="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$tidum_replay_payload" \
    "$staging_url/api/leadgrid/project-onboarding/commit")"
  jq -e --arg project_id "$tidum_project_id" '
    .project.id == $project_id and
    .reused_project == true and
    (.profiles | length) >= 4 and
    ([.profiles[] | select((.template_key // "") | startswith("tidum.")) | .template_key] | length) == 4 and
    ([.profiles[] | select((.template_key // "") | startswith("tidum.")) | .template_key] | unique | length) == 4
  ' <<<"$tidum_replay" >/dev/null
  echo "STAGING_E2E_STAGE=tidum_reuse_without_duplicates_verified"

  if [[ "$run_tidum_campaign_e2e" == "1" ]]; then
    tidum_campaign_payload="$(jq -n \
      --arg name "[E2E] Tidum alle profiler $timestamp" \
      --argjson profiles "$(jq '[.profiles[] | select(.status == "active" and ((.template_key // "") | startswith("tidum."))) | {profile_id: .id, expected_version: .version}]' <<<"$tidum_profiles")" \
      '{name: $name, profiles: $profiles}')"
    tidum_campaign="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      -H "Idempotency-Key: tidum-staging-e2e-$timestamp" \
      -H "Content-Type: application/json" \
      --data-binary "$tidum_campaign_payload" \
      "$staging_url/api/leadgrid/projects/$tidum_project_id/discovery/campaign-runs")"
    tidum_campaign_id="$(jq -er '.campaign.id' <<<"$tidum_campaign")"
    jq -e '.campaign.total_profiles == 4' <<<"$tidum_campaign" >/dev/null

    tidum_campaign_complete=false
    for _attempt in {1..120}; do
      tidum_campaign="$(curl --fail-with-body --silent --show-error \
        -H "Authorization: Bearer $token" \
        -H "X-Organization-Id: $org_id" \
        -H "X-Leadgrid-Organization-Id: $org_id" \
        "$staging_url/api/leadgrid/projects/$tidum_project_id/discovery/campaign-runs/$tidum_campaign_id")"
      tidum_campaign_status="$(jq -er '.status' <<<"$tidum_campaign")"
      if [[ "$tidum_campaign_status" =~ ^(completed|partial|failed|cancelled)$ ]]; then
        tidum_campaign_complete=true
        break
      fi
      sleep 5
    done
    if [[ "$tidum_campaign_complete" != "true" ]]; then
      echo "Tidum-kampanjen fullførte ikke innen 10 minutter." >&2
      exit 10
    fi
    jq -e '
      (.status == "completed" or .status == "partial") and
      .total_profiles == 4 and
      (.completed_profiles + .partial_profiles) == 4 and
      .failed_profiles == 0 and
      (.items | length) == 4 and
      ([.items[].status] | all(. == "completed" or . == "partial")) and
      ([.items[].profile_id] | unique | length) == 4 and
      ([.items[].candidate_count] | add) > 0
    ' <<<"$tidum_campaign" >/dev/null
    echo "STAGING_E2E_STAGE=tidum_campaign_verified"
  fi
fi

lead_project_id="${tidum_project_id:-${role_room_project_id:-$requested_project_id}}"
if [[ -z "$lead_project_id" ]]; then
  echo "Mangler LEADGRID_STAGING_PROJECT_ID når domene-E2E ikke kjøres." >&2
  exit 2
fi
creation_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
lead_name="[E2E] TestFlight staging $timestamp"
lead_email="leadgrid-e2e+$timestamp@example.invalid"
lead_payload="$(jq -n   --arg creation_id "$creation_id"   --arg organization_id "$org_id"   --arg project_id "$lead_project_id"   --arg name "$lead_name"   --arg email "$lead_email"   --arg organization_number "$brreg_org_number"   '{
    creation_id: $creation_id,
    organization_id: $organization_id,
    project_id: $project_id,
    name: $name,
    company: $name,
    organization_number: $organization_number,
    email: $email,
    country: "NO",
    latitude: 59.9139,
    longitude: 10.7522,
    lead_temperature: "warm",
    pipeline_stage: "new",
    lead_status: "unvisited",
    location_confidence: "approximate",
    lead_source: "staging_testflight_e2e",
    allow_duplicate: true
  }')"

create_response="$(curl --fail-with-body --silent --show-error   -H "Authorization: Bearer $token"   -H "X-Organization-Id: $org_id"   -H "X-Leadgrid-Organization-Id: $org_id"   -H "Idempotency-Key: $creation_id"   -H "Content-Type: application/json"   --data-binary "$lead_payload"   "$staging_url/api/admin-room/lead-map/leads")"
lead_id="$(jq -er '.id' <<<"$create_response")"

detail_response="$(curl --fail-with-body --silent --show-error   -H "Authorization: Bearer $token"   -H "X-Organization-Id: $org_id"   -H "X-Leadgrid-Organization-Id: $org_id"   "$staging_url/api/admin-room/lead-map/leads/$lead_id")"
if ! jq -e --arg id "$lead_id" '(.id == $id) or (.lead.id == $id)'   <<<"$detail_response" >/dev/null; then
  echo "Leaden kunne ikke leses tilbake fra staging-persistensen." >&2
  exit 4
fi
echo "STAGING_E2E_STAGE=lead_roundtrip_verified"

# Leadbook: opprett samme kladd to ganger med samme creation_id, les den
# tilbake fra detalj og liste, og slett testkladden gjennom GDPR-endepunktet.
leadbook_creation_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
leadbook_payload="$(jq -n --arg creation_id "$leadbook_creation_id" --arg project_id "$lead_project_id" --arg title "[E2E] Leadbook staging $timestamp" '{
    creation_id: $creation_id,
    project_id: $project_id,
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
echo "STAGING_E2E_STAGE=leadbook_idempotency_verified"
leadbook_detail="$(curl --fail-with-body --silent --show-error -H "Authorization: Bearer $token" -H "X-Organization-Id: $org_id" -H "X-Leadgrid-Organization-Id: $org_id" "$staging_url/api/leadgrid/leadbook/examples/$leadbook_id?project_id=$lead_project_id")"
jq -e --arg id "$leadbook_id" '.example.id == $id' <<<"$leadbook_detail" >/dev/null
echo "STAGING_E2E_STAGE=leadbook_detail_verified"
leadbook_list="$(curl --fail-with-body --silent --show-error -H "Authorization: Bearer $token" -H "X-Organization-Id: $org_id" -H "X-Leadgrid-Organization-Id: $org_id" "$staging_url/api/leadgrid/leadbook/examples?limit=50&project_id=$lead_project_id")"
jq -e --arg id "$leadbook_id" '.examples | any(.id == $id)' <<<"$leadbook_list" >/dev/null
echo "STAGING_E2E_STAGE=leadbook_list_verified"
leadbook_delete="$(curl --fail-with-body --silent --show-error -H "Authorization: Bearer $token" -H "X-Organization-Id: $org_id" -H "X-Leadgrid-Organization-Id: $org_id" -H "Content-Type: application/json" --data-binary "$(jq -n --arg project_id "$lead_project_id" '{project_id: $project_id}')" "$staging_url/api/leadgrid/leadbook/examples/$leadbook_id/request-deletion")"
jq -e '.deleted == true' <<<"$leadbook_delete" >/dev/null
echo "STAGING_E2E_STAGE=leadbook_delete_verified"

enrichment_ready=false
for _attempt in {1..30}; do
  enrichment_response="$(curl --fail-with-body --silent --show-error     -H "Authorization: Bearer $token"     -H "X-Organization-Id: $org_id"     -H "X-Leadgrid-Organization-Id: $org_id"     "$staging_url/api/admin-room/lead-map/leads/$lead_id/enrichment?project_id=$lead_project_id")"
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
  for required_command in xcodegen xcodebuild xcrun plutil; do
    if ! command -v "$required_command" >/dev/null 2>&1; then
      echo "Mangler påkrevd kommando for simulator-E2E: $required_command" >&2
      exit 2
    fi
  done
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  app_dir="$(cd "$script_dir/.." && pwd)"
  derived_data="${LEADGRID_STAGING_DERIVED_DATA:-/private/tmp/leadgrid-staging-e2e}"
  result_bundle="${LEADGRID_STAGING_RESULT_BUNDLE:-$derived_data/Logs/Test/Leadgrid-Staging-$(date -u +%Y%m%d%H%M%S).xcresult}"
  simulator_tests=(
    "-only-testing:LeadMapAppUITests/QASweepTests/testStagingLeadCreationOfflineReconnect"
    "-only-testing:LeadMapAppUITests/QASweepTests/testStagingPondusUsageOfflineReconnect"
  )
  if [[ "$run_role_room_e2e" == "1" ]]; then
    simulator_tests+=(
      "-only-testing:LeadMapAppUITests/QASweepTests/testStagingRoleRoomProjectOpensAllDiscoveryProfiles"
    )
  fi
  if [[ "$run_tidum_e2e" == "1" ]]; then
    simulator_tests+=(
      "-only-testing:LeadMapAppUITests/QASweepTests/testStagingTidumProjectOpensAllDiscoveryProfiles"
    )
  fi
  (
    cd "$app_dir"
    xcodegen generate
    xcodebuild build-for-testing -quiet \
      -project LeadMapApp.xcodeproj \
      -scheme LeadMapApp \
      -destination "$simulator_destination" \
      -derivedDataPath "$derived_data" \
      CODE_SIGNING_ALLOWED=NO

    products_dir="$derived_data/Build/Products"
    source_xctestrun="$(find "$products_dir" -maxdepth 1 -name '*.xctestrun' -print -quit)"
    if [[ -z "$source_xctestrun" ]]; then
      echo "Fant ingen .xctestrun etter build-for-testing." >&2
      exit 9
    fi
    test_xctestrun="$source_xctestrun"
    cleanup_xctestrun() {
      [[ -n "${test_xctestrun:-}" && -f "$test_xctestrun" ]] || return 0
      for key in \
        LEADGRID_STAGING_BASE_URL \
        LEADGRID_STAGING_BEARER_TOKEN \
        LEADGRID_STAGING_ORG_ID \
        LEADGRID_STAGING_PROJECT_ID \
        LEADGRID_STAGING_ROLE_ROOM_PROJECT_ID \
        LEADGRID_STAGING_TIDUM_PROJECT_ID
      do
        plutil -remove "LeadMapAppUITests.EnvironmentVariables.$key" "$test_xctestrun" >/dev/null 2>&1 || true
      done
    }
    trap cleanup_xctestrun EXIT

    plutil -insert "LeadMapAppUITests.EnvironmentVariables.LEADGRID_STAGING_BASE_URL" -string "$staging_url" "$test_xctestrun"
    plutil -insert "LeadMapAppUITests.EnvironmentVariables.LEADGRID_STAGING_BEARER_TOKEN" -string "$token" "$test_xctestrun"
    plutil -insert "LeadMapAppUITests.EnvironmentVariables.LEADGRID_STAGING_ORG_ID" -string "$org_id" "$test_xctestrun"
    plutil -insert "LeadMapAppUITests.EnvironmentVariables.LEADGRID_STAGING_PROJECT_ID" -string "$lead_project_id" "$test_xctestrun"
    plutil -insert "LeadMapAppUITests.EnvironmentVariables.LEADGRID_STAGING_ROLE_ROOM_PROJECT_ID" -string "$role_room_project_id" "$test_xctestrun"
    plutil -insert "LeadMapAppUITests.EnvironmentVariables.LEADGRID_STAGING_TIDUM_PROJECT_ID" -string "$tidum_project_id" "$test_xctestrun"

    mkdir -p "$(dirname "$result_bundle")"
    if [[ -e "$result_bundle" ]]; then
      echo "Resultatpakken finnes allerede: $result_bundle" >&2
      exit 9
    fi
    if xcodebuild test-without-building -quiet \
      -xctestrun "$test_xctestrun" \
      -destination "$simulator_destination" \
      -resultBundlePath "$result_bundle" \
      "${simulator_tests[@]}"; then
      simulator_test_status=0
    else
      simulator_test_status=$?
    fi

    test_summary="$(xcrun xcresulttool get test-results summary --path "$result_bundle")"
    if [[ "$simulator_test_status" -ne 0 ]]; then
      echo "STAGING_E2E_SIMULATOR_SUMMARY=$test_summary" >&2
      echo "STAGING_E2E_SIMULATOR_FAILURES_BEGIN" >&2
      xcrun xcresulttool get test-results tests --path "$result_bundle" | jq -r '
        .. | objects |
        select(.nodeType? == "Test Case" and .result? == "Failed") |
        "TEST: \(.name)\n" +
        ([.children[]? | select(.nodeType? == "Failure Message") | .name] | join("\n"))
      ' >&2 || true
      echo "STAGING_E2E_SIMULATOR_FAILURES_END" >&2
      exit "$simulator_test_status"
    fi
    expected_tests="${#simulator_tests[@]}"
    jq -e --argjson expected "$expected_tests" '
      .result == "Passed" and
      .passedTests == $expected and
      .failedTests == 0 and
      .skippedTests == 0 and
      .totalTestCount == $expected
    ' <<<"$test_summary" >/dev/null
    cleanup_xctestrun
    trap - EXIT
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
  echo "ROLE_ROOM_CAMPAIGN_STATUS=$(jq -er '.status' <<<"$role_room_campaign")"
  echo "ROLE_ROOM_CAMPAIGN_ID=$role_room_campaign_id"
fi
if [[ "$run_tidum_e2e" == "1" ]]; then
  echo "TIDUM_ONBOARDING_PROFILES_NATIVE=PASS"
  echo "TIDUM_REUSE_WITHOUT_DUPLICATES=PASS"
  echo "TIDUM_PROJECT_ID=$tidum_project_id"
fi
if [[ "$run_tidum_campaign_e2e" == "1" ]]; then
  echo "TIDUM_CAMPAIGN_ALL_PROFILES_RESULTS=PASS"
  echo "TIDUM_CAMPAIGN_STATUS=$(jq -er '.status' <<<"$tidum_campaign")"
  echo "TIDUM_CAMPAIGN_ID=$tidum_campaign_id"
fi
echo "PAIR_CODE=$pair_code"
echo "PAIR_CODE_EXPIRES_SECONDS=300"
