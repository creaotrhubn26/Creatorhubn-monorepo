#!/bin/bash
# qa-sweep-mac.sh — automatisert visuell QA av LeadMapApp på Mac (Catalyst).
#
# Samme harness som qa-sweep.sh (QASweepTests + QA_BEARER_TOKEN/QA_TAB-
# hooks), men mot 'My Mac (Mac Catalyst)' i stedet for simulator. Galleriet
# havner i qa-galleri/mac-<stamp>/.
#
# Bruk:
#   ipad/LeadMapApp/scripts/qa-sweep-mac.sh
#
# Krever: xcodegen, psql, backend/.env med DATABASE_URL.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
APP_DIR="$REPO_ROOT/ipad/LeadMapApp"
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
RESULT_BUNDLE="/tmp/leadgrid-qa-sweep-mac-$STAMP.xcresult"
GALLERI="$APP_DIR/qa-galleri/mac-$STAMP"

cd "$APP_DIR"
xcodegen generate > /dev/null

echo "Kjører Mac Catalyst QA-sveip (dette tar noen minutter)…"
TEST_RUNNER_QA_BEARER_TOKEN="$TOKEN" xcodebuild test \
  -project LeadMapApp.xcodeproj \
  -scheme LeadMapApp \
  -destination 'platform=macOS,variant=Mac Catalyst' \
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
