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
run_creatorhub_e2e="${LEADGRID_RUN_CREATORHUB_E2E:-0}"
run_creatorhub_campaign_e2e="${LEADGRID_RUN_CREATORHUB_CAMPAIGN_E2E:-0}"
run_medside_e2e="${LEADGRID_RUN_MEDSIDE_E2E:-0}"
run_medside_campaign_e2e="${LEADGRID_RUN_MEDSIDE_CAMPAIGN_E2E:-0}"
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
if [[ "$run_creatorhub_campaign_e2e" == "1" && "$run_creatorhub_e2e" != "1" ]]; then
  echo "LEADGRID_RUN_CREATORHUB_CAMPAIGN_E2E krever LEADGRID_RUN_CREATORHUB_E2E=1." >&2
  exit 2
fi
if [[ "$run_medside_campaign_e2e" == "1" && "$run_medside_e2e" != "1" ]]; then
  echo "LEADGRID_RUN_MEDSIDE_CAMPAIGN_E2E krever LEADGRID_RUN_MEDSIDE_E2E=1." >&2
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
      .name == "Kommunale tjenestesteder – Norge" and
      .template_version == 2 and
      .brief.organization_name_queries == ["barneverntjeneste", "avlastning", "bofellesskap", "BPA", "miljøarbeidertjeneste"] and
      .brief.organization_forms == ["BEDR"] and
      .brief.employee_count == null and
      .brief.commercial_signals.registered_in_business_register == null) and
    .preview.recommended_anbud_profile.template_key == "tidum.procurement" and
    .preview.recommended_anbud_profile.requires_admin_confirmation == true and
    (.preview.recommended_anbud_profile.cpv_codes | sort) ==
      (["48450000", "72212450", "48332000", "48311000", "48311100"] | sort) and
    (.preview.recommended_anbud_profile.cpv_codes | index("85000000")) == null and
    (.preview.recommended_anbud_profile.suggested_watches | length) == 3
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
  if ! jq -e '
    (.profiles | length) >= 4 and
    ([.profiles[] | select((.template_key // "") | startswith("tidum.")) | .template_key] | length) == 4 and
    ([.profiles[] | select((.template_key // "") | startswith("tidum.")) | .template_key] | unique | length) == 4 and
    (.profiles[] | select(.template_key == "tidum.child_welfare") |
      .brief.country_code == "NO" and .brief.employee_count.minimum == 5) and
    (.profiles[] | select(.template_key == "tidum.municipal_services") |
      .name == "Kommunale tjenestesteder – Norge" and
      .template_version == 2 and
      .brief.organization_name_queries == ["barneverntjeneste", "avlastning", "bofellesskap", "BPA", "miljøarbeidertjeneste"] and
      .brief.organization_forms == ["BEDR"])
  ' <<<"$tidum_profiles" >/dev/null; then
    echo "Tidum-profilene brøt staging-kontrakten. Sikker profildiagnose:" >&2
    jq -c '
      [.profiles[] | {
        name,
        template_key,
        template_version,
        version,
        status,
        organization_name_queries: .brief.organization_name_queries,
        organization_forms: .brief.organization_forms,
        minimum_fit_score: .brief.minimum_fit_score
      }]
    ' <<<"$tidum_profiles" >&2
    exit 9
  fi
  echo "STAGING_E2E_STAGE=tidum_profiles_verified"

  tidum_anbud_profile="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    "$staging_url/api/leadgrid/doffin/project-profile?projectId=$tidum_project_id")"
  jq -e '
    .profile.template_key == "tidum.procurement" and
    (.profile.status == "draft" or .profile.status == "active") and
    .profile.can_manage == true and
    .profile.requires_admin_confirmation == true and
    (.profile.cpv_codes | sort) ==
      (["48450000", "72212450", "48332000", "48311000", "48311100"] | sort) and
    (.profile.suggested_watches | length) == 3
  ' <<<"$tidum_anbud_profile" >/dev/null

  tidum_anbud_watch_keys="$(jq -c '[.profile.suggested_watches[].key]' <<<"$tidum_anbud_profile")"
  tidum_anbud_confirm_payload="$(jq -n \
    --argjson watch_keys "$tidum_anbud_watch_keys" \
    '{watch_keys: $watch_keys}')"
  tidum_anbud_confirm="$(curl --fail-with-body --silent --show-error \
    -X POST \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$tidum_anbud_confirm_payload" \
    "$staging_url/api/leadgrid/doffin/project-profile/confirm?projectId=$tidum_project_id")"
  jq -e '
    .ok == true and
    .profile.status == "active" and
    (.profile.selected_watch_keys | length) == 3 and
    (.watches | length) == 3 and
    ([.watches[].template_key] | unique | length) == 3
  ' <<<"$tidum_anbud_confirm" >/dev/null

  tidum_anbud_replay="$(curl --fail-with-body --silent --show-error \
    -X POST \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$tidum_anbud_confirm_payload" \
    "$staging_url/api/leadgrid/doffin/project-profile/confirm?projectId=$tidum_project_id")"
  jq -e '.ok == true and (.watches | length) == 3' <<<"$tidum_anbud_replay" >/dev/null

  tidum_anbud_watches="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    "$staging_url/api/leadgrid/doffin/watches?projectId=$tidum_project_id")"
  jq -e '
    ([.watches[] | select((.template_key // "") | startswith("tidum."))] | length) == 3 and
    ([.watches[] | select((.template_key // "") | startswith("tidum.")) | .template_key] | unique | length) == 3
  ' <<<"$tidum_anbud_watches" >/dev/null

  tidum_anbud_search="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    "$staging_url/api/leadgrid/doffin/search?projectId=$tidum_project_id&projectProfile=true&status=ALL&hits=5")"
  jq -e '
    (.kunngjoringer | type) == "array" and
    (.total | type) == "number" and
    .project_profile.template_key == "tidum.procurement" and
    .project_profile.applied == true
  ' <<<"$tidum_anbud_search" >/dev/null
  echo "STAGING_E2E_STAGE=tidum_anbud_profile_verified"

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
    if ! jq -e '
      (.status == "completed" or .status == "partial") and
      .total_profiles == 4 and
      (.completed_profiles + .partial_profiles) == 4 and
      .failed_profiles == 0 and
      (.items | length) == 4 and
      ([.items[].status] | all(. == "completed" or . == "partial")) and
      ([.items[].profile_id] | unique | length) == 4 and
      ([.items[].candidate_count] | all(. > 0))
    ' <<<"$tidum_campaign" >/dev/null; then
      echo "Tidum-kampanjen brøt staging-kontrakten. Sikker kampanjediagnose:" >&2
      jq -c '{
        status,
        total_profiles,
        completed_profiles,
        partial_profiles,
        failed_profiles,
        error_code,
        items: [.items[] | {
          profile_name,
          status,
          candidate_count,
          error_code,
          current_run_id
        }]
      }' <<<"$tidum_campaign" >&2
      exit 10
    fi

    while IFS=$'\t' read -r tidum_item_name tidum_item_run_id tidum_item_forms; do
      [[ -n "$tidum_item_run_id" ]] || {
        echo "Tidum-profilen $tidum_item_name mangler Discovery-run." >&2
        exit 10
      }
      tidum_candidates="$(curl --fail-with-body --silent --show-error \
        -H "Authorization: Bearer $token" \
        -H "X-Organization-Id: $org_id" \
        -H "X-Leadgrid-Organization-Id: $org_id" \
        "$staging_url/api/leadgrid/projects/$tidum_project_id/discovery/runs/$tidum_item_run_id/candidates?disposition=all&limit=100")"
      if ! jq -e '
        (.items | length) > 0 and
        ([.items[].source] | all(. == "brreg_open_data")) and
        ([.items[].organization_number] | all(type == "string" and test("^[0-9]{9}$")))
      ' <<<"$tidum_candidates" >/dev/null; then
        echo "Tidum-profilen $tidum_item_name brøt kildekontrakten. Sikker kandidatdiagnose:" >&2
        jq -c '{
          count: (.items | length),
          sources: ([.items[].source] | unique),
          invalid_organization_number_count: ([.items[].organization_number | select(
            (type == "string" and test("^[0-9]{9}$")) | not
          )] | length)
        }' <<<"$tidum_candidates" >&2
        exit 10
      fi
      if [[ "$tidum_item_forms" == "BEDR" ]]; then
        if ! jq -e '
          ([.items[].organization_form_code] | all(. == "BEDR")) and
          ([.items[].name] | all(
            test("barneverntjeneste|avlastning|bofellesskap|bpa|miljøtjeneste|miljøarbeid"; "i")
          )) and
          ([.items[] | has("clinic_group")] | all(. == false))
        ' <<<"$tidum_candidates" >/dev/null; then
          echo "Tidum-tjenestestedene brøt kandidatkontrakten. Sikker kandidatdiagnose:" >&2
          jq -c '{
            count: (.items | length),
            organization_forms: ([.items[].organization_form_code] | unique),
            invalid_name_count: ([.items[].name | select(
              test("barneverntjeneste|avlastning|bofellesskap|bpa|miljøtjeneste|miljøarbeid"; "i") | not
            )] | length),
            clinic_group_count: ([.items[] | select(has("clinic_group"))] | length)
          }' <<<"$tidum_candidates" >&2
          exit 10
        fi
      fi
    done < <(jq -r '.items[] | [.profile_name, .current_run_id, (.brief_snapshot.organization_forms | join(","))] | @tsv' <<<"$tidum_campaign")
    echo "STAGING_E2E_STAGE=tidum_campaign_verified"
  fi
fi

creatorhub_project_id=""
creatorhub_campaign_id=""
creatorhub_approved_lead_id=""
if [[ "$run_creatorhub_e2e" == "1" ]]; then
  creatorhub_preview_payload="$(jq -n --arg organization_id "$org_id" '{organization_id: $organization_id, website_url: "creatorhubn.com"}')"
  creatorhub_preview="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$creatorhub_preview_payload" \
    "$staging_url/api/leadgrid/project-onboarding/preview")"
  jq -e '
    .preview.website_domain == "creatorhubn.com" and
    .preview.project_name == "Creatorhub" and
    .preview.category == "Plattform for kreativt arbeid" and
    .preview.category_confidence == "high" and
    (.preview.recommended_profiles | length) == 4 and
    ([.preview.recommended_profiles[].template_key] | sort) ==
      (["creatorhub.photographers", "creatorhub.video_content", "creatorhub.music_audio", "creatorhub.creative_agencies"] | sort) and
    ([.preview.recommended_profiles[] | select(.is_default == true)] | length) == 1 and
    ([.preview.recommended_profiles[].brief.country_code] | unique) == ["NO"] and
    ([.preview.recommended_profiles[].brief.city] | all(. == null)) and
    ([.preview.recommended_profiles[].brief.minimum_fit_score] | all(. == 70)) and
    ([.preview.recommended_profiles[].approval_mode] | all(. == "manual")) and
    ([.preview.recommended_profiles[].auto_discover_enabled] | all(. == false)) and
    (.preview.recommended_profiles[] | select(.template_key == "creatorhub.photographers") |
      .brief.industry_queries == ["74.200"] and .brief.target_count == 60) and
    (.preview.recommended_profiles[] | select(.template_key == "creatorhub.video_content") |
      .brief.industry_queries == ["59.110", "59.120"] and .brief.target_count == 60) and
    (.preview.recommended_profiles[] | select(.template_key == "creatorhub.music_audio") |
      .brief.industry_queries == ["59.200"] and .brief.target_count == 60) and
    (.preview.recommended_profiles[] | select(.template_key == "creatorhub.creative_agencies") |
      .brief.industry_queries == ["73.110", "73.120", "74.120"] and
      .brief.qualification_requirement == "required" and
      .brief.website_requirement == "present" and
      .brief.website_quality.minimum_score == 40)
  ' <<<"$creatorhub_preview" >/dev/null
  echo "STAGING_E2E_STAGE=creatorhub_preview_verified"

  creatorhub_commit_payload="$(jq -n \
    --arg organization_id "$org_id" \
    --arg preview_id "$(jq -er '.preview.id' <<<"$creatorhub_preview")" \
    --arg administrator_email "$staging_email" \
    --arg project_name "$(jq -er '.preview.project_name' <<<"$creatorhub_preview")" \
    --arg project_description "$(jq -er '.preview.project_description' <<<"$creatorhub_preview")" \
    --arg category "$(jq -er '.preview.category' <<<"$creatorhub_preview")" \
    --arg target_audience "$(jq -er '.preview.brand_profile.targetAudience' <<<"$creatorhub_preview")" \
    --argjson profiles "$(jq '.preview.recommended_profiles' <<<"$creatorhub_preview")" \
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
  creatorhub_commit="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$creatorhub_commit_payload" \
    "$staging_url/api/leadgrid/project-onboarding/commit")"
  creatorhub_project_id="$(jq -er '.project.id' <<<"$creatorhub_commit")"
  jq -e --arg project_id "$creatorhub_project_id" '
    .project.id == $project_id and
    .project.name == "Creatorhub" and
    ([.profiles[] | select((.template_key // "") | startswith("creatorhub."))] | length) == 4 and
    ([.profiles[] | select((.template_key // "") | startswith("creatorhub.")) | .template_key] | unique | length) == 4 and
    .access.discovery_access_verified == true
  ' <<<"$creatorhub_commit" >/dev/null
  echo "STAGING_E2E_STAGE=creatorhub_project_committed"

  creatorhub_profiles="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    "$staging_url/api/leadgrid/projects/$creatorhub_project_id/discovery/profiles")"
  if ! jq -e '
    ([.profiles[] | select((.template_key // "") | startswith("creatorhub."))] | length) == 4 and
    ([.profiles[] | select((.template_key // "") | startswith("creatorhub.")) | .template_key] | unique | length) == 4 and
    ([.profiles[] | select((.template_key // "") | startswith("creatorhub.")) | .brief.minimum_fit_score] | all(. == 70)) and
    ([.profiles[] | select((.template_key // "") | startswith("creatorhub.")) | .approval_mode] | all(. == "manual")) and
    ([.profiles[] | select((.template_key // "") | startswith("creatorhub.")) | .brief.organization_forms] | all(. == ["ANS", "AS", "DA", "ENK"]))
  ' <<<"$creatorhub_profiles" >/dev/null; then
    echo "Creatorhub-profilene brøt staging-kontrakten. Sikker profildiagnose:" >&2
    jq -c '[.profiles[] | select((.template_key // "") | startswith("creatorhub.")) | {
      name, template_key, template_version, status, approval_mode,
      industry_queries: .brief.industry_queries,
      organization_forms: .brief.organization_forms,
      minimum_fit_score: .brief.minimum_fit_score
    }]' <<<"$creatorhub_profiles" >&2
    exit 11
  fi
  echo "STAGING_E2E_STAGE=creatorhub_profiles_verified"

  creatorhub_replay_preview="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$creatorhub_preview_payload" \
    "$staging_url/api/leadgrid/project-onboarding/preview")"
  creatorhub_replay_payload="$(jq -n \
    --arg organization_id "$org_id" \
    --arg preview_id "$(jq -er '.preview.id' <<<"$creatorhub_replay_preview")" \
    '{organization_id: $organization_id, preview_id: $preview_id}')"
  creatorhub_replay="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$creatorhub_replay_payload" \
    "$staging_url/api/leadgrid/project-onboarding/commit")"
  jq -e --arg project_id "$creatorhub_project_id" '
    .project.id == $project_id and
    .reused_project == true and
    ([.profiles[] | select((.template_key // "") | startswith("creatorhub."))] | length) == 4 and
    ([.profiles[] | select((.template_key // "") | startswith("creatorhub.")) | .template_key] | unique | length) == 4
  ' <<<"$creatorhub_replay" >/dev/null
  echo "STAGING_E2E_STAGE=creatorhub_reuse_without_duplicates_verified"

  if [[ "$run_creatorhub_campaign_e2e" == "1" ]]; then
    creatorhub_campaign_payload="$(jq -n \
      --arg name "[E2E] Creatorhub alle profiler $timestamp" \
      --argjson profiles "$(jq '[.profiles[] | select(.status == "active" and ((.template_key // "") | startswith("creatorhub."))) | {profile_id: .id, expected_version: .version}]' <<<"$creatorhub_profiles")" \
      '{name: $name, profiles: $profiles}')"
    creatorhub_campaign="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      -H "Idempotency-Key: creatorhub-staging-e2e-$timestamp" \
      -H "Content-Type: application/json" \
      --data-binary "$creatorhub_campaign_payload" \
      "$staging_url/api/leadgrid/projects/$creatorhub_project_id/discovery/campaign-runs")"
    creatorhub_campaign_id="$(jq -er '.campaign.id' <<<"$creatorhub_campaign")"
    jq -e '.campaign.total_profiles == 4' <<<"$creatorhub_campaign" >/dev/null

    creatorhub_campaign_complete=false
    for _attempt in {1..120}; do
      creatorhub_campaign="$(curl --fail-with-body --silent --show-error \
        -H "Authorization: Bearer $token" \
        -H "X-Organization-Id: $org_id" \
        -H "X-Leadgrid-Organization-Id: $org_id" \
        "$staging_url/api/leadgrid/projects/$creatorhub_project_id/discovery/campaign-runs/$creatorhub_campaign_id")"
      creatorhub_campaign_status="$(jq -er '.status' <<<"$creatorhub_campaign")"
      if [[ "$creatorhub_campaign_status" =~ ^(completed|partial|failed|cancelled)$ ]]; then
        creatorhub_campaign_complete=true
        break
      fi
      sleep 5
    done
    if [[ "$creatorhub_campaign_complete" != "true" ]]; then
      echo "Creatorhub-kampanjen fullførte ikke innen 10 minutter." >&2
      exit 12
    fi
    if ! jq -e '
      (.status == "completed" or .status == "partial") and
      .total_profiles == 4 and
      (.completed_profiles + .partial_profiles) == 4 and
      .failed_profiles == 0 and
      (.items | length) == 4 and
      ([.items[].status] | all(. == "completed" or . == "partial")) and
      ([.items[].profile_id] | unique | length) == 4 and
      ([.items[].candidate_count] | all(. > 0))
    ' <<<"$creatorhub_campaign" >/dev/null; then
      echo "Creatorhub-kampanjen brøt staging-kontrakten. Sikker kampanjediagnose:" >&2
      jq -c '{status, total_profiles, completed_profiles, partial_profiles, failed_profiles,
        items: [.items[] | {profile_name, status, candidate_count, error_code, current_run_id}]}' \
        <<<"$creatorhub_campaign" >&2
      exit 12
    fi

    creatorhub_agency_assessed_count=0
    creatorhub_agency_unknown_count=0
    while IFS=$'\t' read -r creatorhub_profile_id creatorhub_item_name creatorhub_item_run_id; do
      [[ -n "$creatorhub_item_run_id" ]] || {
        echo "Creatorhub-profilen $creatorhub_item_name mangler Discovery-run." >&2
        exit 12
      }
      creatorhub_industry_codes="$(jq -c --arg id "$creatorhub_profile_id" '.profiles[] | select(.id == $id) | .brief.industry_queries' <<<"$creatorhub_profiles")"
      creatorhub_organization_forms="$(jq -c --arg id "$creatorhub_profile_id" '.profiles[] | select(.id == $id) | .brief.organization_forms' <<<"$creatorhub_profiles")"
      creatorhub_minimum_score="$(jq -r --arg id "$creatorhub_profile_id" '.profiles[] | select(.id == $id) | .brief.minimum_fit_score' <<<"$creatorhub_profiles")"
      creatorhub_template_key="$(jq -r --arg id "$creatorhub_profile_id" '.profiles[] | select(.id == $id) | .template_key' <<<"$creatorhub_profiles")"
      creatorhub_candidates="$(curl --fail-with-body --silent --show-error \
        -H "Authorization: Bearer $token" \
        -H "X-Organization-Id: $org_id" \
        -H "X-Leadgrid-Organization-Id: $org_id" \
        "$staging_url/api/leadgrid/projects/$creatorhub_project_id/discovery/runs/$creatorhub_item_run_id/candidates?disposition=pending&sort=score_desc&limit=100")"
      if ! jq -e \
        --argjson industry_codes "$creatorhub_industry_codes" \
        --argjson organization_forms "$creatorhub_organization_forms" \
        --argjson minimum_score "$creatorhub_minimum_score" '
        (.items | length) > 0 and
        ([.items[].source] | all(. == "brreg_open_data")) and
        ([.items[].organization_number] | all(type == "string" and test("^[0-9]{9}$"))) and
        (([.items[].organization_form_code] - $organization_forms) | length) == 0 and
        (([.items[].nace_code] - $industry_codes) | length) == 0 and
        ([.items[].fit_score] | all(type == "number" and . >= $minimum_score)) and
        ([.items[].excluded] | all(. == false)) and
        ([.items[].disposition] | all(. == "review_ready"))
      ' <<<"$creatorhub_candidates" >/dev/null; then
        echo "Creatorhub-profilen $creatorhub_item_name brøt kandidatkontrakten. Sikker kandidatdiagnose:" >&2
        jq -c '{count: (.items | length), sources: ([.items[].source] | unique),
          organization_forms: ([.items[].organization_form_code] | unique),
          nace_codes: ([.items[].nace_code] | unique),
          minimum_fit_score: ([.items[].fit_score] | min),
          dispositions: ([.items[].disposition] | unique),
          excluded_count: ([.items[] | select(.excluded == true)] | length)}' \
          <<<"$creatorhub_candidates" >&2
        exit 12
      fi
      if [[ "$creatorhub_template_key" == "creatorhub.creative_agencies" ]]; then
        # Utilgjengelige eller ikke-prioriterte nettsteder skal være eksplisitt
        # ukjent for manuell vurdering. Bare vurderte nettsteder kan hevde at
        # kvalitets- og kvalifiseringskravene er bestått.
        if ! jq -e '
          ([.items[].website_url] | all(type == "string" and length > 0)) and
          ([.items[].website_quality] | all(
            type == "object" and
            (
              (.status == "assessed" and (.score | type) == "number" and .score >= 40 and
                (.qualification.requested_terms | length) > 0 and
                (.qualification.matched_terms | length) > 0) or
              (.status == "unknown" and .score == null and
                (.reason as $reason |
                  (["invalid_url", "unsafe_host", "request_failed", "response_too_large", "unsupported_content_type", "external_request_limit", "not_selected_for_assessment"] | index($reason)) != null))
            )
          ))
        ' <<<"$creatorhub_candidates" >/dev/null; then
          echo "Creatorhub-byråprofilen brøt kontrakten for nettsideevidens. Sikker diagnostikk:" >&2
          jq -c '{count: (.items | length),
            missing_website_count: ([.items[] | select((.website_url // "") == "")] | length),
            assessed_count: ([.items[] | select(.website_quality.status == "assessed")] | length),
            unknown_count: ([.items[] | select(.website_quality.status == "unknown")] | length),
            below_minimum_count: ([.items[] | select(.website_quality.status == "assessed" and .website_quality.score < 40)] | length),
            missing_qualification_count: ([.items[] | select(.website_quality.status == "assessed" and (.website_quality.qualification.matched_terms | length) == 0)] | length),
            unknown_reasons: ([.items[] | select(.website_quality.status == "unknown") | .website_quality.reason] | unique)}' \
            <<<"$creatorhub_candidates" >&2
          exit 12
        fi
        creatorhub_agency_assessed_count="$(jq '[.items[] | select(.website_quality.status == "assessed")] | length' <<<"$creatorhub_candidates")"
        creatorhub_agency_unknown_count="$(jq '[.items[] | select(.website_quality.status == "unknown")] | length' <<<"$creatorhub_candidates")"
      fi
    done < <(jq -r '.items[] | [.profile_id, .profile_name, .current_run_id] | @tsv' <<<"$creatorhub_campaign")

    creatorhub_default_profile_id="$(jq -er '.profiles[] | select(.template_key == "creatorhub.photographers") | .id' <<<"$creatorhub_profiles")"
    creatorhub_default_run_id="$(jq -er --arg id "$creatorhub_default_profile_id" '.items[] | select(.profile_id == $id) | .current_run_id' <<<"$creatorhub_campaign")"
    creatorhub_approval_candidates="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      "$staging_url/api/leadgrid/projects/$creatorhub_project_id/discovery/runs/$creatorhub_default_run_id/candidates?disposition=pending&sort=score_desc&limit=100")"
    creatorhub_candidate_id="$(jq -er 'first(.items[] | select(.disposition == "review_ready" and .excluded == false) | .id)' <<<"$creatorhub_approval_candidates")"
    creatorhub_decision_key="creatorhub-candidate-approval-$timestamp"
    creatorhub_decision_payload='{"decision":"approve","reason_code":"good_fit"}'
    creatorhub_decision="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      -H "Idempotency-Key: $creatorhub_decision_key" \
      -H "Content-Type: application/json" \
      --data-binary "$creatorhub_decision_payload" \
      "$staging_url/api/leadgrid/projects/$creatorhub_project_id/discovery/runs/$creatorhub_default_run_id/candidates/$creatorhub_candidate_id/decision")"
    creatorhub_approved_lead_id="$(jq -er '.lead_id' <<<"$creatorhub_decision")"
    jq -e --arg candidate_id "$creatorhub_candidate_id" '
      .candidate_id == $candidate_id and .decision == "approve" and
      .candidate_status == "imported" and .replayed == false and (.lead_id | type) == "string"
    ' <<<"$creatorhub_decision" >/dev/null
    creatorhub_decision_replay="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      -H "Idempotency-Key: $creatorhub_decision_key" \
      -H "Content-Type: application/json" \
      --data-binary "$creatorhub_decision_payload" \
      "$staging_url/api/leadgrid/projects/$creatorhub_project_id/discovery/runs/$creatorhub_default_run_id/candidates/$creatorhub_candidate_id/decision")"
    jq -e --arg lead_id "$creatorhub_approved_lead_id" '
      .decision == "approve" and .lead_id == $lead_id and .replayed == true
    ' <<<"$creatorhub_decision_replay" >/dev/null
    creatorhub_approved_lead="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      "$staging_url/api/admin-room/lead-map/leads/$creatorhub_approved_lead_id")"
    jq -e --arg lead_id "$creatorhub_approved_lead_id" --arg project_id "$creatorhub_project_id" '
      ((.id == $lead_id) or (.lead.id == $lead_id)) and
      ((.projectId == $project_id) or (.project_id == $project_id) or
        (.lead.projectId == $project_id) or (.lead.project_id == $project_id))
    ' <<<"$creatorhub_approved_lead" >/dev/null
    echo "STAGING_E2E_STAGE=creatorhub_campaign_candidates_approval_verified"
  fi
fi

medside_project_id=""
if [[ "$run_medside_e2e" == "1" ]]; then
  medside_preview_payload="$(jq -n --arg organization_id "$org_id" '{organization_id: $organization_id, website_url: "medside.no"}')"
  medside_preview="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$medside_preview_payload" \
    "$staging_url/api/leadgrid/project-onboarding/preview")"
  jq -e '
    .preview.website_domain == "medside.no" and
    .preview.project_name == "MedSide" and
    .preview.category == "KI-basert klinisk dokumentasjon" and
    .preview.category_confidence == "high" and
    (.preview.recommended_profiles | length) == 6 and
    ([.preview.recommended_profiles[].template_key] | sort) ==
      (["medside.chiropractic", "medside.gp_offices", "medside.gp_offices_brreg", "medside.medical_specialists", "medside.physiotherapy", "medside.psychology"] | sort) and
    ([.preview.recommended_profiles[].template_key] | unique | length) == 6 and
    ([.preview.recommended_profiles[] | select(.is_default == true)] | length) == 1 and
    ([.preview.recommended_profiles[].brief.country_code] | unique) == ["NO"] and
    ([.preview.recommended_profiles[].brief.city] | all(. == null)) and
    ([.preview.recommended_profiles[].approval_mode] | all(. == "manual")) and
    ([.preview.recommended_profiles[].auto_discover_enabled] | all(. == false)) and
    (.preview.recommended_profiles[] | select(.template_key == "medside.gp_offices") |
      .brief.registry_source == "nhn_flr_public" and .brief.industry_queries == ["86.210"]) and
    (.preview.recommended_profiles[] | select(.template_key == "medside.gp_offices_brreg") |
      .brief.registry_source == "brreg_open_data" and .brief.industry_queries == ["86.210"] and
      .is_default == false and .brief.qualification_requirement == "preferred") and
    (.preview.recommended_profiles[] | select(.template_key == "medside.medical_specialists") |
      .brief.registry_source == "brreg_open_data" and .brief.industry_queries == ["86.221", "86.222"]) and
    (.preview.recommended_profiles[] | select(.template_key == "medside.physiotherapy") |
      .brief.registry_source == "brreg_open_data" and .brief.industry_queries == ["86.950"]) and
    (.preview.recommended_profiles[] | select(.template_key == "medside.psychology") |
      .brief.registry_source == "brreg_open_data" and .brief.industry_queries == ["86.930"]) and
    (.preview.recommended_profiles[] | select(.template_key == "medside.chiropractic") |
      .brief.registry_source == "brreg_open_data" and
      .brief.organization_name_queries == ["kiropraktor", "kiropraktikk", "kiropraktorklinikk"] and
      .brief.qualification_requirement == "required")
  ' <<<"$medside_preview" >/dev/null
  echo "STAGING_E2E_STAGE=medside_preview_verified"

  medside_commit_payload="$(jq -n \
    --arg organization_id "$org_id" \
    --arg preview_id "$(jq -er '.preview.id' <<<"$medside_preview")" \
    --arg administrator_email "$staging_email" \
    --argjson profiles "$(jq '.preview.recommended_profiles' <<<"$medside_preview")" \
    '{
      organization_id: $organization_id,
      preview_id: $preview_id,
      profiles: $profiles,
      access_setup: {
        organization: {mode: "current"},
        administrator_email: $administrator_email,
        team: {mode: "none"},
        invitations: []
      }
    }')"
  medside_commit="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$medside_commit_payload" \
    "$staging_url/api/leadgrid/project-onboarding/commit")"
  medside_project_id="$(jq -er '.project.id' <<<"$medside_commit")"
  jq -e --arg project_id "$medside_project_id" '
    .project.id == $project_id and
    .project.name == "MedSide" and
    ([.profiles[] | select((.template_key // "") | startswith("medside."))] | length) == 6 and
    ([.profiles[] | select((.template_key // "") | startswith("medside.")) | .template_key] | unique | length) == 6 and
    .access.discovery_access_verified == true
  ' <<<"$medside_commit" >/dev/null
  echo "STAGING_E2E_STAGE=medside_project_committed"

  medside_profiles="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    "$staging_url/api/leadgrid/projects/$medside_project_id/discovery/profiles")"
  # Fem autoritative profiler, ingen legacy-blindvei, nøyaktig én standard, og
  # standarden må kunne kjøres i dette miljøet.
  if ! jq -e '
    (.profiles | length) == 6 and
    ([.profiles[] | select((.template_key // "") | startswith("medside."))] | length) == 6 and
    ([.profiles[].template_key] | unique | length) == 6 and
    ([.profiles[] | select(.is_default == true)] | length) == 1 and
    ([.profiles[] | select(.is_default == true) | .blocked_reason] | all(. == null)) and
    ([.profiles[].approval_mode] | all(. == "manual")) and
    ([.profiles[].auto_discover_enabled] | all(. == false)) and
    ([.profiles[] | select(.brief.industry_queries == ["legekontor"])] | length) == 0
  ' <<<"$medside_profiles" >/dev/null; then
    echo "MedSide-profilene brøt staging-kontrakten. Sikker profildiagnose:" >&2
    jq -c '[.profiles[] | {name, template_key, template_version, status, is_default,
      blocked_reason, registry_source: .brief.registry_source,
      industry_queries: .brief.industry_queries}]' <<<"$medside_profiles" >&2
    exit 13
  fi
  echo "STAGING_E2E_STAGE=medside_profiles_verified"

  # Fastlegeprofilen skal enten virke mot ekte Maskinporten eller si eksplisitt
  # at FLR ikke er satt opp. En stille, kjørbar blindvei er ikke godkjent.
  medside_flr_blocked_reason="$(jq -r '.profiles[] | select(.template_key == "medside.gp_offices") | .blocked_reason // "null"' <<<"$medside_profiles")"
  if [[ "$medside_flr_blocked_reason" != "null" && "$medside_flr_blocked_reason" != "flr_not_configured" ]]; then
    echo "Fastlegeprofilen rapporterte en ukjent blokkeringsårsak: $medside_flr_blocked_reason" >&2
    exit 13
  fi
  echo "STAGING_E2E_MEDSIDE_FLR_READINESS=$medside_flr_blocked_reason"

  medside_replay_preview="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$medside_preview_payload" \
    "$staging_url/api/leadgrid/project-onboarding/preview")"
  medside_replay_payload="$(jq -n \
    --arg organization_id "$org_id" \
    --arg preview_id "$(jq -er '.preview.id' <<<"$medside_replay_preview")" \
    '{organization_id: $organization_id, preview_id: $preview_id}')"
  medside_replay="$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "X-Organization-Id: $org_id" \
    -H "X-Leadgrid-Organization-Id: $org_id" \
    -H "Content-Type: application/json" \
    --data-binary "$medside_replay_payload" \
    "$staging_url/api/leadgrid/project-onboarding/commit")"
  jq -e --arg project_id "$medside_project_id" '
    .project.id == $project_id and
    .reused_project == true and
    ([.profiles[] | select((.template_key // "") | startswith("medside."))] | length) == 6 and
    ([.profiles[] | select((.template_key // "") | startswith("medside.")) | .template_key] | unique | length) == 6 and
    ([.profiles[] | select(.is_default == true)] | length) == 1
  ' <<<"$medside_replay" >/dev/null
  echo "STAGING_E2E_STAGE=medside_reuse_without_duplicates_verified"

  if [[ "$run_medside_campaign_e2e" == "1" ]]; then
    # Bare profiler backend faktisk kan kjøre. En blokkert FLR-profil skal ikke
    # gjøre kampanjen rød; den er allerede verifisert som ærlig blokkert over.
    medside_runnable_profiles="$(jq '[.profiles[] | select(.status == "active" and .blocked_reason == null and ((.template_key // "") | startswith("medside.")))]' <<<"$medside_profiles")"
    medside_runnable_count="$(jq 'length' <<<"$medside_runnable_profiles")"
    if [[ "$medside_runnable_count" -lt 5 ]]; then
      echo "Forventet minst fem kjørbare BRREG-profiler for MedSide, fant $medside_runnable_count." >&2
      exit 14
    fi
    medside_campaign_payload="$(jq -n \
      --arg name "[E2E] MedSide kjørbare profiler $timestamp" \
      --argjson profiles "$(jq '[.[] | {profile_id: .id, expected_version: .version}]' <<<"$medside_runnable_profiles")" \
      '{name: $name, profiles: $profiles}')"
    medside_campaign="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      -H "Idempotency-Key: medside-staging-e2e-$timestamp" \
      -H "Content-Type: application/json" \
      --data-binary "$medside_campaign_payload" \
      "$staging_url/api/leadgrid/projects/$medside_project_id/discovery/campaign-runs")"
    medside_campaign_id="$(jq -er '.campaign.id' <<<"$medside_campaign")"

    medside_campaign_complete=false
    for _attempt in {1..120}; do
      medside_campaign="$(curl --fail-with-body --silent --show-error \
        -H "Authorization: Bearer $token" \
        -H "X-Organization-Id: $org_id" \
        -H "X-Leadgrid-Organization-Id: $org_id" \
        "$staging_url/api/leadgrid/projects/$medside_project_id/discovery/campaign-runs/$medside_campaign_id")"
      medside_campaign_status="$(jq -er '.status' <<<"$medside_campaign")"
      if [[ "$medside_campaign_status" =~ ^(completed|partial|failed|cancelled)$ ]]; then
        medside_campaign_complete=true
        break
      fi
      sleep 5
    done
    if [[ "$medside_campaign_complete" != "true" ]]; then
      echo "MedSide-kampanjen fullførte ikke innen 10 minutter." >&2
      exit 14
    fi
    if ! jq -e --argjson expected "$medside_runnable_count" '
      (.status == "completed" or .status == "partial") and
      .total_profiles == $expected and
      .failed_profiles == 0 and
      (.items | length) == $expected and
      ([.items[].status] | all(. == "completed" or . == "partial")) and
      ([.items[].profile_id] | unique | length) == $expected and
      ([.items[].candidate_count] | any(. > 0))
    ' <<<"$medside_campaign" >/dev/null; then
      echo "MedSide-kampanjen brøt staging-kontrakten. Sikker kampanjediagnose:" >&2
      jq -c '{status, total_profiles, completed_profiles, partial_profiles, failed_profiles,
        items: [.items[] | {profile_name, status, candidate_count, error_code, current_run_id}]}' \
        <<<"$medside_campaign" >&2
      exit 14
    fi

    # Minst én BRREG-profil må gi ekte, relevante kandidater som venter på
    # manuell godkjenning. Ingen kandidat blir lead før noen godkjenner.
    medside_candidate_profile_id="$(jq -er 'first(.items[] | select(.candidate_count > 0) | .profile_id)' <<<"$medside_campaign")"
    medside_candidate_run_id="$(jq -er --arg id "$medside_candidate_profile_id" 'first(.items[] | select(.profile_id == $id) | .current_run_id)' <<<"$medside_campaign")"
    medside_industry_codes="$(jq -c --arg id "$medside_candidate_profile_id" '.[] | select(.id == $id) | .brief.industry_queries' <<<"$medside_runnable_profiles")"
    medside_minimum_score="$(jq -r --arg id "$medside_candidate_profile_id" '.[] | select(.id == $id) | .brief.minimum_fit_score' <<<"$medside_runnable_profiles")"
    medside_candidates="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      "$staging_url/api/leadgrid/projects/$medside_project_id/discovery/runs/$medside_candidate_run_id/candidates?disposition=pending&sort=score_desc&limit=100")"
    if ! jq -e \
      --argjson industry_codes "$medside_industry_codes" \
      --argjson minimum_score "$medside_minimum_score" '
      (.items | length) > 0 and
      ([.items[].source] | all(. == "brreg_open_data")) and
      ([.items[].organization_number] | all(type == "string" and test("^[0-9]{9}$"))) and
      (($industry_codes | length) == 0 or
        (([.items[].nace_code] - $industry_codes) | length) == 0) and
      ([.items[].fit_score] | all(type == "number" and . >= $minimum_score)) and
      ([.items[].excluded] | all(. == false)) and
      ([.items[].disposition] | all(. == "review_ready"))
    ' <<<"$medside_candidates" >/dev/null; then
      echo "MedSide-kandidatene brøt kontrakten. Sikker kandidatdiagnose:" >&2
      jq -c '{count: (.items | length), sources: ([.items[].source] | unique),
        nace_codes: ([.items[].nace_code] | unique),
        minimum_fit_score: ([.items[].fit_score] | min),
        dispositions: ([.items[].disposition] | unique),
        excluded_count: ([.items[] | select(.excluded == true)] | length)}' \
        <<<"$medside_candidates" >&2
      exit 14
    fi

    medside_candidate_id="$(jq -er 'first(.items[] | select(.disposition == "review_ready" and .excluded == false) | .id)' <<<"$medside_candidates")"
    medside_decision_key="medside-candidate-approval-$timestamp"
    medside_decision_payload='{"decision":"approve","reason_code":"good_fit"}'
    medside_decision="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      -H "Idempotency-Key: $medside_decision_key" \
      -H "Content-Type: application/json" \
      --data-binary "$medside_decision_payload" \
      "$staging_url/api/leadgrid/projects/$medside_project_id/discovery/runs/$medside_candidate_run_id/candidates/$medside_candidate_id/decision")"
    medside_approved_lead_id="$(jq -er '.lead_id' <<<"$medside_decision")"
    jq -e --arg candidate_id "$medside_candidate_id" '
      .candidate_id == $candidate_id and .decision == "approve" and
      .candidate_status == "imported" and .replayed == false and (.lead_id | type) == "string"
    ' <<<"$medside_decision" >/dev/null
    medside_decision_replay="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      -H "Idempotency-Key: $medside_decision_key" \
      -H "Content-Type: application/json" \
      --data-binary "$medside_decision_payload" \
      "$staging_url/api/leadgrid/projects/$medside_project_id/discovery/runs/$medside_candidate_run_id/candidates/$medside_candidate_id/decision")"
    jq -e --arg lead_id "$medside_approved_lead_id" '
      .decision == "approve" and .lead_id == $lead_id and .replayed == true
    ' <<<"$medside_decision_replay" >/dev/null
    # Leadet skal ligge under MedSide-prosjektet, ikke lekke til et annet.
    medside_approved_lead="$(curl --fail-with-body --silent --show-error \
      -H "Authorization: Bearer $token" \
      -H "X-Organization-Id: $org_id" \
      -H "X-Leadgrid-Organization-Id: $org_id" \
      "$staging_url/api/admin-room/lead-map/leads/$medside_approved_lead_id")"
    jq -e --arg lead_id "$medside_approved_lead_id" --arg project_id "$medside_project_id" '
      ((.id == $lead_id) or (.lead.id == $lead_id)) and
      ((.projectId == $project_id) or (.project_id == $project_id) or
        (.lead.projectId == $project_id) or (.lead.project_id == $project_id))
    ' <<<"$medside_approved_lead" >/dev/null
    echo "STAGING_E2E_STAGE=medside_campaign_candidates_approval_verified"
  fi
fi

lead_project_id="${creatorhub_project_id:-${tidum_project_id:-${role_room_project_id:-${medside_project_id:-$requested_project_id}}}}"
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

compliance_initial="$(curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $token" \
  -H "X-Organization-Id: $org_id" \
  -H "X-Leadgrid-Organization-Id: $org_id" \
  "$staging_url/api/admin-room/lead-map/leads/$lead_id/outreach-compliance?project_id=$lead_project_id")"
jq -e '
  .compliance.address_classification == "unknown" and
  .compliance.allowed == false and
  .compliance.authorization == "none" and
  .compliance.reason == "blocked_unknown_address"
' <<<"$compliance_initial" >/dev/null

compliance_classification_payload='{"classification":"verified_shared","source":"staging_e2e_fixture","evidence":"Syntetisk fellesadresse opprettet og verifisert av staging-E2E."}'
compliance_verified="$(curl --fail-with-body --silent --show-error \
  -X PUT \
  -H "Authorization: Bearer $token" \
  -H "X-Organization-Id: $org_id" \
  -H "X-Leadgrid-Organization-Id: $org_id" \
  -H "Content-Type: application/json" \
  --data-binary "$compliance_classification_payload" \
  "$staging_url/api/admin-room/lead-map/leads/$lead_id/outreach-compliance/address-classification?project_id=$lead_project_id")"
jq -e '
  .compliance.address_classification == "verified_shared" and
  .compliance.allowed == true and
  .compliance.authorization == "verified_shared" and
  .compliance.reason == "permitted_verified_shared"
' <<<"$compliance_verified" >/dev/null

compliance_suppression_payload='{"reason":"manual_block","source":"staging_e2e_fixture","notes":"Syntetisk sperre for å bevise at organisasjonens sperreliste alltid vinner."}'
compliance_suppressed="$(curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $token" \
  -H "X-Organization-Id: $org_id" \
  -H "X-Leadgrid-Organization-Id: $org_id" \
  -H "Content-Type: application/json" \
  --data-binary "$compliance_suppression_payload" \
  "$staging_url/api/admin-room/lead-map/leads/$lead_id/outreach-compliance/suppressions?project_id=$lead_project_id")"
jq -e '
  .compliance.address_classification == "verified_shared" and
  .compliance.is_suppressed == true and
  .compliance.allowed == false and
  .compliance.authorization == "none" and
  .compliance.reason == "blocked_suppressed"
' <<<"$compliance_suppressed" >/dev/null
echo "STAGING_E2E_STAGE=outreach_compliance_fail_closed_verified"

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
  simulator_name="$(sed -nE 's/(^|.*,)[[:space:]]*name=([^,]+).*/\2/p' <<<"$simulator_destination")"
  simulator_os="$(sed -nE 's/.*OS=([^,]+).*/\1/p' <<<"$simulator_destination")"
  if [[ -z "$simulator_name" || -z "$simulator_os" ]]; then
    echo "Simulator-destinasjonen må inneholde name og OS: $simulator_destination" >&2
    exit 9
  fi
  simulator_runtime_suffix="iOS-${simulator_os//./-}"
  simulator_udid="$(xcrun simctl list --json devices available | jq -er \
    --arg name "$simulator_name" \
    --arg runtime_suffix "$simulator_runtime_suffix" '
      [.devices | to_entries[] |
        select(.key | endswith($runtime_suffix)) |
        .value[] |
        select(.name == $name and .isAvailable == true)
      ][0].udid
    ')"
  resolved_simulator_destination="platform=iOS Simulator,id=$simulator_udid"
  echo "STAGING_E2E_SIMULATOR_DEVICE=$simulator_name:$simulator_os:$simulator_udid"
  simulator_tests=(
    "LeadMapAppUITests/QASweepTests/testStagingLeadCreationOfflineReconnect"
    "LeadMapAppUITests/QASweepTests/testStagingPondusUsageOfflineReconnect"
  )
  if [[ "$run_role_room_e2e" == "1" ]]; then
    simulator_tests+=(
      "LeadMapAppUITests/QASweepTests/testStagingRoleRoomProjectOpensAllDiscoveryProfiles"
    )
  fi
  if [[ "$run_tidum_e2e" == "1" ]]; then
    simulator_tests+=(
      "LeadMapAppUITests/QASweepTests/testStagingTidumProjectOpensAllDiscoveryProfiles"
    )
  fi
  if [[ "$run_creatorhub_e2e" == "1" ]]; then
    simulator_tests+=(
      "LeadMapAppUITests/QASweepTests/testStagingCreatorHubProjectOpensAllDiscoveryProfiles"
    )
  fi
  if [[ "$run_medside_e2e" == "1" ]]; then
    simulator_tests+=(
      "LeadMapAppUITests/QASweepTests/testStagingMedSideProjectOpensAllDiscoveryProfiles"
    )
  fi
  (
    cd "$app_dir"
    xcodegen generate
    xcodebuild build-for-testing -quiet \
      -project LeadMapApp.xcodeproj \
      -scheme LeadMapApp \
      -destination "$resolved_simulator_destination" \
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
      if [[ -n "${simulator_udid:-}" ]]; then
        xcrun simctl shutdown "$simulator_udid" >/dev/null 2>&1 || true
      fi
      [[ -n "${test_xctestrun:-}" && -f "$test_xctestrun" ]] || return 0
      for key in \
        LEADGRID_STAGING_BASE_URL \
        LEADGRID_STAGING_BEARER_TOKEN \
        LEADGRID_STAGING_ORG_ID \
        LEADGRID_STAGING_PROJECT_ID \
        LEADGRID_STAGING_ROLE_ROOM_PROJECT_ID \
        LEADGRID_STAGING_TIDUM_PROJECT_ID \
        LEADGRID_STAGING_CREATORHUB_PROJECT_ID \
        LEADGRID_STAGING_MEDSIDE_PROJECT_ID
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
    plutil -insert "LeadMapAppUITests.EnvironmentVariables.LEADGRID_STAGING_CREATORHUB_PROJECT_ID" -string "$creatorhub_project_id" "$test_xctestrun"
    plutil -insert "LeadMapAppUITests.EnvironmentVariables.LEADGRID_STAGING_MEDSIDE_PROJECT_ID" -string "$medside_project_id" "$test_xctestrun"

    result_bundle_base="${result_bundle%.xcresult}"
    mkdir -p "$(dirname "$result_bundle_base")"
    passed_tests=0
    test_index=0
    for simulator_test in "${simulator_tests[@]}"; do
      test_index=$((test_index + 1))
      test_name="${simulator_test##*/}"
      test_result_bundle="${result_bundle_base}-${test_index}-${test_name}.xcresult"
      if [[ -e "$test_result_bundle" ]]; then
        echo "Resultatpakken finnes allerede: $test_result_bundle" >&2
        exit 9
      fi

      # Xcode may leave the simulator launch service unhealthy after a UI test.
      # Give every scenario a new xcodebuild process and an explicitly completed
      # clean boot, while reusing the single build-for-testing output above.
      xcrun simctl shutdown "$simulator_udid" >/dev/null 2>&1 || true
      xcrun simctl erase "$simulator_udid"
      xcrun simctl boot "$simulator_udid"
      xcrun simctl bootstatus "$simulator_udid" -b
      if xcodebuild test-without-building -quiet \
        -xctestrun "$test_xctestrun" \
        -destination "$resolved_simulator_destination" \
        -parallel-testing-enabled NO \
        -maximum-concurrent-test-simulator-destinations 1 \
        -resultBundlePath "$test_result_bundle" \
        "-only-testing:$simulator_test"; then
        simulator_test_status=0
      else
        simulator_test_status=$?
      fi

      test_summary="$(xcrun xcresulttool get test-results summary --path "$test_result_bundle")"
      if [[ "$simulator_test_status" -ne 0 ]]; then
        echo "STAGING_E2E_SIMULATOR_SUMMARY=$test_summary" >&2
        echo "STAGING_E2E_SIMULATOR_FAILURES_BEGIN" >&2
        xcrun xcresulttool get test-results tests --path "$test_result_bundle" | jq -r '
          .. | objects |
          select(.nodeType? == "Test Case" and .result? == "Failed") |
          "TEST: \(.name)\n" +
          ([.children[]? | select(.nodeType? == "Failure Message") | .name] | join("\n"))
        ' >&2 || true
        echo "STAGING_E2E_SIMULATOR_FAILURES_END" >&2
        exit "$simulator_test_status"
      fi
      jq -e '
        .result == "Passed" and
        .passedTests == 1 and
        .failedTests == 0 and
        .skippedTests == 0 and
        .totalTestCount == 1
      ' <<<"$test_summary" >/dev/null
      passed_tests=$((passed_tests + 1))
      echo "STAGING_E2E_SIMULATOR_TEST=$test_name:PASS"
    done
    expected_tests="${#simulator_tests[@]}"
    if [[ "$passed_tests" -ne "$expected_tests" ]]; then
      echo "Forventet $expected_tests beståtte simulatortester, fikk $passed_tests." >&2
      exit 10
    fi
    jq -cn --argjson passed "$passed_tests" '{
      result: "Passed",
      passedTests: $passed,
      failedTests: 0,
      skippedTests: 0,
      totalTestCount: $passed
    }' | sed 's/^/STAGING_E2E_SIMULATOR_SUMMARY=/'
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
echo "OUTREACH_COMPLIANCE_FAIL_CLOSED=PASS"
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
  echo "TIDUM_ANBUD_PROFILE_WATCHES=PASS"
fi
if [[ "$run_tidum_campaign_e2e" == "1" ]]; then
  echo "TIDUM_CAMPAIGN_ALL_PROFILES_RESULTS=PASS"
  echo "TIDUM_CAMPAIGN_STATUS=$(jq -er '.status' <<<"$tidum_campaign")"
  echo "TIDUM_CAMPAIGN_ID=$tidum_campaign_id"
fi
if [[ "$run_creatorhub_e2e" == "1" ]]; then
  echo "CREATORHUB_ONBOARDING_PROFILES_NATIVE=PASS"
  echo "CREATORHUB_REUSE_WITHOUT_DUPLICATES=PASS"
  echo "CREATORHUB_PROJECT_ID=$creatorhub_project_id"
fi
if [[ "$run_creatorhub_campaign_e2e" == "1" ]]; then
  echo "CREATORHUB_CAMPAIGN_ALL_PROFILES_RESULTS=PASS"
  echo "CREATORHUB_CANDIDATE_APPROVAL_IDEMPOTENCY=PASS"
  echo "CREATORHUB_CAMPAIGN_STATUS=$(jq -er '.status' <<<"$creatorhub_campaign")"
  echo "CREATORHUB_CAMPAIGN_ID=$creatorhub_campaign_id"
  echo "CREATORHUB_APPROVED_LEAD_ID=$creatorhub_approved_lead_id"
  echo "CREATORHUB_PROFILE_CANDIDATE_COUNTS=$(jq -c '[.items[] | {profile_name, candidate_count, review_ready_count}]' <<<"$creatorhub_campaign")"
  echo "CREATORHUB_AGENCY_WEBSITE_EVIDENCE=assessed:$creatorhub_agency_assessed_count,unknown:$creatorhub_agency_unknown_count"
fi
if [[ "$run_medside_e2e" == "1" ]]; then
  echo "MEDSIDE_ONBOARDING_PROFILES_NATIVE=PASS"
  echo "MEDSIDE_REUSE_WITHOUT_DUPLICATES=PASS"
  echo "MEDSIDE_LEGACY_LEGEKONTOR_RETIRED=PASS"
  echo "MEDSIDE_PROJECT_ID=$medside_project_id"
  echo "MEDSIDE_FLR_READINESS=$medside_flr_blocked_reason"
fi
if [[ "$run_medside_campaign_e2e" == "1" ]]; then
  echo "MEDSIDE_CAMPAIGN_RUNNABLE_PROFILES_RESULTS=PASS"
  echo "MEDSIDE_CANDIDATE_APPROVAL_IDEMPOTENCY=PASS"
  echo "MEDSIDE_CAMPAIGN_STATUS=$(jq -er '.status' <<<"$medside_campaign")"
  echo "MEDSIDE_CAMPAIGN_ID=$medside_campaign_id"
  echo "MEDSIDE_APPROVED_LEAD_ID=$medside_approved_lead_id"
  echo "MEDSIDE_PROFILE_CANDIDATE_COUNTS=$(jq -c '[.items[] | {profile_name, candidate_count, review_ready_count}]' <<<"$medside_campaign")"
fi
echo "PAIR_CODE=$pair_code"
echo "PAIR_CODE_EXPIRES_SECONDS=300"
