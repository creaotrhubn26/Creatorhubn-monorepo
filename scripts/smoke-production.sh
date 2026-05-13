#!/usr/bin/env bash
# smoke-production.sh — sanntid-verifisering at alt vi har shippet
# faktisk lever på produksjon. Kjør etter Render+Vercel-deploy.
#
# Bruk:
#   $ bash scripts/smoke-production.sh
#
# Exit-koden er antall feilende tester (0 = alt OK).

set -uo pipefail

BACKEND="https://creatorhub-backend-rtbl.onrender.com"
FRONTEND="https://theroleroom.com"
CREATORHUB="https://creatorhubn.com"

PASS=0
FAIL=0
TESTS=()

assert_status() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local actual=$(curl -sS -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1))
    TESTS+=("✓ $label  →  HTTP $actual")
  else
    FAIL=$((FAIL + 1))
    TESTS+=("✗ $label  →  HTTP $actual (forventet $expected)")
  fi
}

assert_contains() {
  local label="$1"
  local url="$2"
  local needle="$3"
  local body=$(curl -sS "$url" 2>/dev/null || echo "")
  if echo "$body" | grep -qiE "$needle"; then
    PASS=$((PASS + 1))
    TESTS+=("✓ $label  →  contains '$needle'")
  else
    FAIL=$((FAIL + 1))
    TESTS+=("✗ $label  →  '$needle' MANGLER")
  fi
}

echo "═══════════════════════════════════════════════════════════"
echo "  THE ROLE ROOM — production smoke-test"
echo "  $(date)"
echo "═══════════════════════════════════════════════════════════"

# ── Backend health ─────────────────────────────────────────────
echo ""
echo "── Backend (Render) ─────────────────────────────────────"
assert_status "Backend health"                          "$BACKEND/api/health"                                       "200"
assert_status "Audition endpoint (auth required)"       "$BACKEND/api/role-room/projects/test/auditions"            "401"
assert_status "CMS pages endpoint"                      "$BACKEND/api/cms/pages/for-studenter"                      "404"
assert_status "Public stats endpoint"                   "$BACKEND/api/role-room/public/stats"                       "200"
assert_status "Community channels (auth-required)"      "$BACKEND/api/admin/community/channels"                     "401"
assert_status "Reddit status (auth-required)"           "$BACKEND/api/admin/community/reddit/status"                "401"
assert_status "DIT destinations (auth-required)"        "$BACKEND/api/dit/projects/test/destinations"               "401"
assert_status "DIT take-status (auth-required)"         "$BACKEND/api/dit/projects/test/take-status"                "401"

# ── Public stats inneholder nye felter ─────────────────────────
echo ""
echo "── Public stats utvidet ───────────────────────────────────"
assert_contains "Stats har 'kandidater'-felt"           "$BACKEND/api/role-room/public/stats"                       "kandidater"
assert_contains "Stats har 'auditioner'-felt"           "$BACKEND/api/role-room/public/stats"                       "auditioner"
assert_contains "Stats har 'crew'-felt"                 "$BACKEND/api/role-room/public/stats"                       "crew"
assert_contains "Stats har 'lokasjoner'-felt"           "$BACKEND/api/role-room/public/stats"                       "lokasjoner"

# ── Frontend rendering (Vercel) ────────────────────────────────
echo ""
echo "── Frontend (Vercel) ──────────────────────────────────────"
assert_status "theroleroom.com hovedside"               "$FRONTEND/"                                                "200"
assert_status "creatorhubn.com hovedside"               "$CREATORHUB/"                                              "200"

# ── SEO landingssider ──────────────────────────────────────────
echo ""
echo "── SEO landingssider ──────────────────────────────────────"
assert_status "/vs-studiobinder"                        "$FRONTEND/vs-studiobinder"                                 "200"
assert_status "/vs-castingnetworks"                     "$FRONTEND/vs-castingnetworks"                              "200"
assert_status "/vs-moviemagic"                          "$FRONTEND/vs-moviemagic"                                   "200"
assert_status "/vs-yamdu"                               "$FRONTEND/vs-yamdu"                                        "200"
assert_status "/vs-setkeeper"                           "$FRONTEND/vs-setkeeper"                                    "200"
assert_status "/alternatives"                           "$FRONTEND/alternatives"                                    "200"
assert_status "/for-studenter"                          "$FRONTEND/for-studenter"                                   "200"
assert_status "/film-tv-utdanning"                      "$FRONTEND/film-tv-utdanning"                               "200"
assert_status "/casting-director-utdanning"             "$FRONTEND/casting-director-utdanning"                      "200"
assert_status "/regissor-verktoy"                       "$FRONTEND/regissor-verktoy"                                "200"
assert_status "/produksjonsledelse-studie"              "$FRONTEND/produksjonsledelse-studie"                       "200"
assert_status "/innholdsprodusenter"                    "$FRONTEND/innholdsprodusenter"                             "200"
assert_status "/innholdsproduksjon-studie"              "$FRONTEND/innholdsproduksjon-studie"                       "200"
assert_status "/dansestudio"                            "$FRONTEND/dansestudio"                                     "200"

# ── GEO assets ─────────────────────────────────────────────────
echo ""
echo "── GEO assets (robots.txt + llms.txt + sitemap) ──────────"
assert_status "theroleroom robots.txt"                  "$FRONTEND/robots.txt"                                      "200"
assert_status "theroleroom sitemap.xml"                 "$FRONTEND/sitemap.xml"                                     "200"
assert_status "theroleroom llms.txt"                    "$FRONTEND/llms.txt"                                        "200"
assert_contains "robots.txt har GPTBot-tillatelse"      "$FRONTEND/robots.txt"                                      "GPTBot"
assert_contains "robots.txt har ClaudeBot-tillatelse"   "$FRONTEND/robots.txt"                                      "ClaudeBot"
assert_contains "robots.txt har PerplexityBot"          "$FRONTEND/robots.txt"                                      "PerplexityBot"
assert_contains "sitemap har vs-studiobinder"           "$FRONTEND/sitemap.xml"                                     "vs-studiobinder"
assert_contains "sitemap har for-studenter"             "$FRONTEND/sitemap.xml"                                     "for-studenter"
assert_contains "sitemap har dansestudio"               "$FRONTEND/sitemap.xml"                                     "dansestudio"

# ── Microsoft Clarity ─────────────────────────────────────────
echo ""
echo "── Microsoft Clarity ──────────────────────────────────────"
assert_contains "theroleroom.com har Clarity-script"    "$FRONTEND/"                                                "clarity"
assert_contains "creatorhubn.com har Clarity-script"    "$CREATORHUB/"                                              "clarity"

# ── GA4 ────────────────────────────────────────────────────────
echo ""
echo "── GA4 ────────────────────────────────────────────────────"
assert_contains "theroleroom.com har GA4-script"        "$FRONTEND/"                                                "G-9T7K5TJVFX|googletagmanager"
assert_contains "creatorhubn.com har GA4-script"        "$CREATORHUB/"                                              "G-6E5MJT8REW|googletagmanager"

# ── Result ─────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
for t in "${TESTS[@]}"; do
  echo "  $t"
done
echo ""
echo "  RESULTAT: $PASS bestått, $FAIL feilet"
echo "═══════════════════════════════════════════════════════════"

exit $FAIL
