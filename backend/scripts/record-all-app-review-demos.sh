#!/usr/bin/env bash
# Records all 8 Meta App Review demo screencasts in sequence.
#
# Reads backend/.env.<slug>.demo.local for each demo. Skips a demo whose
# env file is missing required keys, so partial runs work as the developer
# fills in credentials over time.
#
# Usage: ./backend/scripts/record-all-app-review-demos.sh
#        ./backend/scripts/record-all-app-review-demos.sh oembed pages-cta
# (positional args restrict to a subset of slugs)

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# slug : script-name : env-file : required-keys (space-separated)
DEMOS=(
  "oembed:record-oembed-app-review-demo.playwright.mjs:.env.oembed.demo.local:DEMO_INSTAGRAM_POST_URL DEMO_FACEBOOK_POST_URL"
  "pages-cta:record-pages-cta-app-review-demo.playwright.mjs:.env.pages-cta.demo.local:DEMO_PAGE_ID DEMO_PAGE_ACCESS_TOKEN"
  "page-public-content:record-page-public-content-app-review-demo.playwright.mjs:.env.page-public-content.demo.local:DEMO_PAGE_ID"
  "page-mentions:record-page-mentions-app-review-demo.playwright.mjs:.env.page-mentions.demo.local:DEMO_PAGE_ID"
  "page-metadata:record-page-metadata-app-review-demo.playwright.mjs:.env.page-metadata.demo.local:DEMO_PAGE_ID"
  "ig-public:record-ig-public-content-app-review-demo.playwright.mjs:.env.ig-public.demo.local:DEMO_IG_USER_ID DEMO_HASHTAG DEMO_IG_USERNAME"
  "leads-retrieval:record-leads-retrieval-app-review-demo.playwright.mjs:.env.leads-retrieval.demo.local:DEMO_PAGE_ID DEMO_PAGE_ACCESS_TOKEN"
  "ig-events:record-ig-events-app-review-demo.playwright.mjs:.env.ig-events.demo.local:DEMO_IG_USER_ID DEMO_IG_TOKEN"
)

WANTED=("$@")
have_value_for() {
  local file="$1" key="$2"
  local val
  val=$(grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | sed 's/^ *//;s/ *$//')
  [ -n "$val" ] && [[ "$val" != placeholder* ]] && [[ "$val" != *xxxxxxxxx* ]]
}

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'

OK_COUNT=0; SKIP_COUNT=0; FAIL_COUNT=0
declare -a SKIPPED FAILED OK

for entry in "${DEMOS[@]}"; do
  slug="${entry%%:*}"; rest="${entry#*:}"
  script="${rest%%:*}"; rest="${rest#*:}"
  envfile_rel="${rest%%:*}"; required="${rest#*:}"

  if [ "${#WANTED[@]}" -gt 0 ]; then
    found=0
    for w in "${WANTED[@]}"; do [ "$w" = "$slug" ] && found=1; done
    [ "$found" = 0 ] && continue
  fi

  envfile="backend/$envfile_rel"
  echo
  echo "════════════════════════════════════════════════════════════════════════"
  echo "  ▶ $slug   ($envfile)"
  echo "════════════════════════════════════════════════════════════════════════"

  if [ ! -f "$envfile" ]; then
    echo -e "${YELLOW}⚠ skipping: $envfile not found${NC}"
    SKIPPED+=("$slug (no env file)"); SKIP_COUNT=$((SKIP_COUNT+1)); continue
  fi

  missing=()
  for key in $required; do
    have_value_for "$envfile" "$key" || missing+=("$key")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo -e "${YELLOW}⚠ skipping: missing/placeholder values for: ${missing[*]}${NC}"
    SKIPPED+=("$slug (missing: ${missing[*]})"); SKIP_COUNT=$((SKIP_COUNT+1)); continue
  fi

  echo "✓ env complete — recording…"
  if node "backend/scripts/$script"; then
    echo -e "${GREEN}✓ $slug recorded${NC}"
    OK+=("$slug"); OK_COUNT=$((OK_COUNT+1))
  else
    echo -e "${RED}✗ $slug failed${NC}"
    FAILED+=("$slug"); FAIL_COUNT=$((FAIL_COUNT+1))
  fi
done

echo
echo "════════════════════════════════════════════════════════════════════════"
echo "  Summary"
echo "════════════════════════════════════════════════════════════════════════"
echo -e "${GREEN}  ✓ Recorded:  $OK_COUNT${NC}"; for s in "${OK[@]}"; do echo "     - $s"; done
echo -e "${YELLOW}  ⚠ Skipped:   $SKIP_COUNT${NC}"; for s in "${SKIPPED[@]}"; do echo "     - $s"; done
echo -e "${RED}  ✗ Failed:    $FAIL_COUNT${NC}"; for s in "${FAILED[@]}"; do echo "     - $s"; done
echo
echo "Recordings in: $REPO_ROOT/recordings/"
ls -lh "$REPO_ROOT/recordings/"*.webm 2>/dev/null | tail -20
echo
[ "$FAIL_COUNT" -eq 0 ]
