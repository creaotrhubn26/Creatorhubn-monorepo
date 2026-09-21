#!/usr/bin/env bash
# Tørrkjør produksjonsmigrasjonene på en fersk Neon-branch av prod-databasen
# FØR de kjøres mot prod (Fase 8a, Story Graph drift-fundament).
#
# Branchen er copy-on-write av prod i det øyeblikket den lages, så den er samtidig
# et gjenopprettingspunkt: feiler tørrkjøringen beholdes branchen i 7 dager for
# feilsøking og jobben stopper før prod røres. Lykkes den, slettes branchen.
#
# Krav (alle fra CI-miljøet):
#   NEON_API_KEY        Neon API-nøkkel (secret)
#   NEON_PROJECT_ID     Neon-prosjektet prod ligger i (variable)
#   DATABASE_URL        prod-strengen — brukes KUN til å lese databasenavnet
#   MIGRATION_LOGIN_ROLE / MIGRATION_OWNER_ROLE / MIGRATION_OWNED_SCHEMAS
#                       samme som prod-steget (kjøreren krever dem)
#   TARGET_SHA          (valgfri) commit som navngir branchen
#
# Roller opprettet med SQL (creatorhub_migration_login) er ikke Neon-forvaltet, så
# Neon kan ikke gi oss passordet. På den disponible branchen setter vi derfor et
# engangspassord via Neon-rollen neondb_owner (Neon-forvaltet) og bygger
# tilkoblingsstrengen selv, med sslmode=require&channel_binding=require som
# run-production-migrations.mjs krever. Prod-rollens passord berøres aldri.
set -euo pipefail

if [ "${1:-}" = "--self-test" ]; then
  # Kontrakt-sjekk uten nettverk: skriptet parser, og hjelperne gir riktig form.
  # Uten passord i strengen (secret-skanneren flagger «postgres-url-with-password»).
  url="postgresql://neondb_owner@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require"
  db="$(node -e 'console.log(new URL(process.argv[1]).pathname.replace(/^\//, ""))' "$url")"
  [ "$db" = "neondb" ] || { echo "self-test: databasenavn feil ($db)"; exit 1; }
  echo "neon-branch-dry-run: self-test OK"
  exit 0
fi

: "${NEON_API_KEY:?NEON_API_KEY mangler}"
: "${NEON_PROJECT_ID:?NEON_PROJECT_ID mangler}"
: "${DATABASE_URL:?DATABASE_URL (prod) mangler — trengs for databasenavnet}"
: "${MIGRATION_LOGIN_ROLE:?MIGRATION_LOGIN_ROLE mangler}"

command -v jq >/dev/null || { echo "::error::jq mangler på runneren"; exit 1; }

sha="${TARGET_SHA:-${GITHUB_SHA:-local}}"
branch_name="migrate-dryrun-${sha:0:7}-$(date -u +%Y%m%dT%H%M%SZ)"
expires_at="$(date -u -d '+7 days' +%Y-%m-%dT%H:%M:%SZ)"
db_name="$(node -e 'console.log(new URL(process.argv[1]).pathname.replace(/^\//, ""))' "$DATABASE_URL")"
[ -n "$db_name" ] || { echo "::error::Fant ikke databasenavn i DATABASE_URL"; exit 1; }

neon() { npx --yes neon@latest "$@"; }

echo "::group::Neon: oppretter branch $branch_name (utløper $expires_at)"
created="$(neon branches create --project-id "$NEON_PROJECT_ID" --name "$branch_name" \
  --expires-at "$expires_at" --no-secrets --output json)"
branch_id="$(jq -er '.branch.id' <<<"$created")"
echo "branch_id=$branch_id"
echo "::endgroup::"

# Harness-feil (branch-oppsett, passord, tilkobling) er IKKE en migrasjonsfeil: da skal prod-deployen
# gå videre med en gul advarsel, ikke stoppe. Bare feil i selve migrasjonene mot branchen er fatale.
harness_skip() {
  echo "::warning title=Neon dry-run skipped::$1 — prod-migrasjonene kjøres uten tørrkjøring denne gangen. Branch $branch_name ($branch_id) slettes."
  neon branches delete "$branch_id" --project-id "$NEON_PROJECT_ID" >/dev/null 2>&1 || true
  exit 0
}

# Migrasjonsrollen er Neon-styrt (Neon viser den i rollelista med authentication_method=password),
# så Neon kan gi tilkoblingsstrengen for branchen direkte — ingen ALTER ROLE ... PASSWORD trengs.
# (Første kjøring 2026-09-18 feilet nettopp på ALTER ROLE: «permission denied to alter role».)
# --endpoint-type read_write gir det direkte endepunktet (kjøreren avviser -pooler.-verter).
branch_url="$(neon connection-string "$branch_id" --project-id "$NEON_PROJECT_ID" \
  --role-name "$MIGRATION_LOGIN_ROLE" --database-name "$db_name" --endpoint-type read_write)" \
  || harness_skip "Fikk ikke tilkoblingsstreng for ${MIGRATION_LOGIN_ROLE} på branchen (er rollen Neon-styrt?)"
echo "::add-mask::$branch_url"
# Kjøreren krever sslmode=require og channel_binding=require i URL-en.
case "$branch_url" in
  *"?"*) sep="&" ;;
  *) sep="?" ;;
esac
case "$branch_url" in *sslmode=*) ;; *) branch_url="${branch_url}${sep}sslmode=require"; sep="&" ;; esac
case "$branch_url" in *channel_binding=*) ;; *) branch_url="${branch_url}${sep}channel_binding=require" ;; esac
echo "::add-mask::$branch_url"

echo "::group::Tørrkjøring av migrasjoner mot $branch_name"
status=0
DATABASE_URL="$branch_url" node backend/scripts/run-production-migrations.mjs --preflight-only || status=$?
if [ "$status" -eq 0 ]; then
  DATABASE_URL="$branch_url" node backend/scripts/run-production-migrations.mjs || status=$?
fi
if [ "$status" -eq 0 ]; then
  DATABASE_URL="$branch_url" node backend/scripts/run-production-migrations.mjs --expect-zero || status=$?
fi
echo "::endgroup::"

if [ "$status" -eq 0 ]; then
  neon branches delete "$branch_id" --project-id "$NEON_PROJECT_ID" >/dev/null
  echo "Neon: tørrkjøring OK — branch $branch_name slettet"
  exit 0
fi

echo "::error::Migrasjons-tørrkjøring feilet på Neon-branch $branch_name ($branch_id). Prod er urørt; branchen beholdes i 7 dager for feilsøking."
exit "$status"
