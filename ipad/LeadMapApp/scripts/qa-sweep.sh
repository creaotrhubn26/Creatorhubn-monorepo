#!/bin/bash
# qa-sweep.sh — automatisert visuell QA av LeadMapApp på iPhone-simulator.
#
# Henter en gyldig Bearer-token fra dev-databasen, kjører QASweepTests
# (innlogget sveip over alle faner + statistikk-modaler + a11y-audit) og
# eksporterer alle skjermbilder til et galleri.
#
# Bruk:
#   ipad/LeadMapApp/scripts/qa-sweep.sh
#   QA_SIM_ID=<uuid> QA_USER_ID=<uuid> ipad/LeadMapApp/scripts/qa-sweep.sh
#
# Krever: xcodegen, psql, backend/.env med DATABASE_URL.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
APP_DIR="$REPO_ROOT/ipad/LeadMapApp"
SIM="${QA_SIM_ID:-923F04B6-3224-4B50-BC99-2C507BA257C4}"   # iPhone 17 Pro
USER_ID="${QA_USER_ID:-53391080-8437-471e-800b-8b0d01e8b465}"

DB_URL=$(grep -m1 '^DATABASE_URL=' "$REPO_ROOT/backend/.env" | cut -d= -f2-)
TOKEN=$(psql "$DB_URL" -X -t -A -c \
  "SELECT token FROM creatorhub_auth_sessions
    WHERE session_data->>'userId' = '$USER_ID'
    ORDER BY updated_at DESC LIMIT 1;")
if [ -z "$TOKEN" ]; then
  echo "FEIL: fant ingen aktiv sesjon for bruker $USER_ID" >&2
  exit 1
fi

STAMP=$(date +%Y%m%d-%H%M%S)
RESULT_BUNDLE="/tmp/leadgrid-qa-sweep-$STAMP.xcresult"
GALLERI="$APP_DIR/qa-galleri/$STAMP"

cd "$APP_DIR"
xcodegen generate > /dev/null
xcrun simctl boot "$SIM" 2>/dev/null || true

echo "Kjører QA-sveip (dette tar noen minutter)…"
TEST_RUNNER_QA_BEARER_TOKEN="$TOKEN" xcodebuild test \
  -project LeadMapApp.xcodeproj \
  -scheme LeadMapApp \
  -destination "id=$SIM" \
  -only-testing:LeadMapAppUITests \
  -resultBundlePath "$RESULT_BUNDLE" \
  -quiet || true   # a11y/interaksjons-funn skal ikke stoppe galleri-eksport

mkdir -p "$GALLERI"
xcrun xcresulttool export attachments \
  --path "$RESULT_BUNDLE" \
  --output-path "$GALLERI"

ANTALL=$(find "$GALLERI" -name "*.png" | wc -l | tr -d ' ')
echo ""
echo "Galleri: $GALLERI ($ANTALL skjermbilder)"
echo "Resultat-bundle: $RESULT_BUNDLE (åpne i Xcode for detaljer)"
