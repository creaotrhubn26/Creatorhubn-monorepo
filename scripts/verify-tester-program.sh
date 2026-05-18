#!/usr/bin/env bash
# verify-tester-program.sh — Slice 9X.53–9X.57 production-verifikasjon.
#
# Kjør etter Render+Vercel-deploy:
#   $ bash scripts/verify-tester-program.sh
#
# Tester:
#   1. Backend lever + nye endepunkter responderer
#   2. Auth-beskyttelse virker (sikkerhetsfix 9X.55)
#   3. Schema er opprettet (idempotent-mønsteret fanger ved første kall)
#   4. Stripe-config: kan ikke verifisere private keys, men ser at
#      Stripe-konfigurerte endepunkter ikke krasjer
#   5. Frontend-rutene er live
#
# Exit-kode = antall feilende tester (0 = alt OK).

set -uo pipefail

BACKEND="https://creatorhub-backend-rtbl.onrender.com"
CREATORHUB="https://creatorhubn.com"

PASS=0
FAIL=0
WARN=0
TESTS=()

# ── Hjelpere ─────────────────────────────────────────────────────

assert_status() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local method="${4:-GET}"
  local actual=$(curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null || echo "000")
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1))
    TESTS+=("  ✓ $label  →  HTTP $actual")
  else
    FAIL=$((FAIL + 1))
    TESTS+=("  ✗ $label  →  HTTP $actual (forventet $expected)")
  fi
}

assert_status_oneof() {
  local label="$1"
  local url="$2"
  local expected="$3"  # komma-separert, f.eks. "200,401"
  local method="${4:-GET}"
  local actual=$(curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null || echo "000")
  if echo ",$expected," | grep -q ",$actual,"; then
    PASS=$((PASS + 1))
    TESTS+=("  ✓ $label  →  HTTP $actual (akseptert: $expected)")
  else
    FAIL=$((FAIL + 1))
    TESTS+=("  ✗ $label  →  HTTP $actual (forventet en av $expected)")
  fi
}

assert_not_200() {
  # For sikkerhetsfix: bekrefter at endepunktet IKKE returnerer 200 uten auth.
  local label="$1"
  local url="$2"
  local method="${3:-GET}"
  local actual=$(curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null || echo "000")
  if [ "$actual" != "200" ]; then
    PASS=$((PASS + 1))
    TESTS+=("  ✓ $label  →  HTTP $actual (riktig, IKKE 200)")
  else
    FAIL=$((FAIL + 1))
    TESTS+=("  ✗ $label  →  HTTP 200 — SIKKERHETSPROBLEM, endepunktet eksponerer data uten auth")
  fi
}

assert_json_field() {
  local label="$1"
  local url="$2"
  local field="$3"
  local body=$(curl -sS "$url" 2>/dev/null || echo "{}")
  if echo "$body" | grep -qE "\"$field\""; then
    PASS=$((PASS + 1))
    TESTS+=("  ✓ $label  →  inneholder '$field'")
  else
    FAIL=$((FAIL + 1))
    TESTS+=("  ✗ $label  →  mangler felt '$field' (body: $(echo "$body" | head -c 120)…)")
  fi
}

warn() {
  WARN=$((WARN + 1))
  TESTS+=("  ⚠ $1")
}

# ── Tester ───────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════════"
echo "  CREATORHUB — Tester-program produksjons-verifikasjon"
echo "  Slice 9X.53–9X.57"
echo "  $(date)"
echo "═══════════════════════════════════════════════════════════"

# 1. Backend lever
echo ""
echo "── 1. Backend health ───────────────────────────────────────"
assert_status "Backend root"                    "$BACKEND/api/health"                              "200"

# 2. Public-fronten har "Søk om plass"-CTA → InviteRequestForm-flow
echo ""
echo "── 2. Public form-endpoint (Slice 9X.53) ───────────────────"
# Tom POST → 400 (validering kicker inn). Bekrefter at endepunktet finnes
# OG validerer (ikke 404 eller 500).
assert_status "POST /api/invite-requests (tom body)"   "$BACKEND/api/invite-requests"            "400" "POST"

# 3. Sikkerhetsfix (Slice 9X.55): alle 7 invite-admin-endepunkter må kreve auth
echo ""
echo "── 3. Sikkerhetsfix (Slice 9X.55) — auth påkrevd ──────────"
assert_not_200 "GET /api/invite-requests"                  "$BACKEND/api/invite-requests"
assert_not_200 "GET /api/invites/admin/requests"           "$BACKEND/api/invites/admin/requests"
assert_not_200 "GET /api/invite-requests/test-id"          "$BACKEND/api/invite-requests/00000000-0000-0000-0000-000000000000"
assert_not_200 "GET /api/invite-requests/.../proff"        "$BACKEND/api/invite-requests/00000000-0000-0000-0000-000000000000/proff-analysis"
assert_not_200 "PUT /admin/requests/:id/status"            "$BACKEND/api/invites/admin/requests/test/status"  "PUT"
assert_not_200 "POST /admin/requests/:id/send-invite"      "$BACKEND/api/invites/admin/requests/test/send-invite" "POST"
# Admin-notifications CRUD
assert_not_200 "GET /admin/notifications"                  "$BACKEND/api/admin/notifications"
assert_not_200 "POST /admin/notifications"                 "$BACKEND/api/admin/notifications"  "POST"

# 4. Public token-endepunkt for prototype-tester accept (Slice 9X.53)
echo ""
echo "── 4. Prototype-tester accept-side (Slice 9X.53) ──────────"
# Ugyldig token → 404 eller 400, ikke 500
assert_status_oneof "GET tester-invite (ugyldig token)"   "$BACKEND/api/prototype-tester-invites/invalid-token-test"  "400,404"
assert_status_oneof "POST tester-invite accept (ugyldig)" "$BACKEND/api/prototype-tester-invites/invalid-token-test/accept" "400,404" "POST"

# 5. User-side admin-notifications (Slice 9X.54) — inbox uten auth = tom liste
echo ""
echo "── 5. Admin-notifications inbox (Slice 9X.54) ─────────────"
assert_status "GET /api/notifications/inbox (ingen auth)"  "$BACKEND/api/notifications/inbox"   "200"
assert_json_field "Inbox-respons-format"                   "$BACKEND/api/notifications/inbox"   "notifications"

# 6. Tester→Enterprise offer-endpointet (Slice 9X.57)
echo ""
echo "── 6. Tester→Enterprise offer (Slice 9X.57) ───────────────"
assert_status "GET /me offer (ingen tester-sesjon)"        "$BACKEND/api/tester-enterprise-offer/me"  "200"
assert_json_field "Offer-respons-format"                   "$BACKEND/api/tester-enterprise-offer/me"  "offer"

# 7. Team-master-endepunkter (Slice 9X.56) — krever auth
echo ""
echo "── 7. Team-flyt-endepunkter (Slice 9X.56) ─────────────────"
assert_status_oneof "GET /me/team (uten auth)"             "$BACKEND/api/prototype-tester-invites/me/team"        "401,403"
assert_status_oneof "POST /me/team/invite (uten auth)"     "$BACKEND/api/prototype-tester-invites/me/team/invite" "401,403" "POST"

# 8. Frontend-ruter — sjekk at de er deployed
echo ""
echo "── 8. Frontend-ruter (Vercel) ─────────────────────────────"
assert_status "Landing /"                                  "$CREATORHUB/"                                          "200"
assert_status "Accept-side for tester-NDA"                 "$CREATORHUB/prototype-tester/accept-invite?token=x"    "200"

# Sjekk at landing-bygget inneholder pricing-CTA-en vi la til
assert_contains_in_html() {
  local label="$1"
  local url="$2"
  local needle="$3"
  local body=$(curl -sSL "$url" 2>/dev/null || echo "")
  if echo "$body" | grep -qiE "$needle"; then
    PASS=$((PASS + 1))
    TESTS+=("  ✓ $label  →  HTML inneholder '$needle'")
  else
    warn "$label  →  HTML mangler '$needle' (kan være lazy-loaded — sjekk manuelt)"
  fi
}
# OBS: hvis bundlet, vil teksten ligge i en chunk-file. Vi nøyer oss derfor
# med å sjekke at hovedsiden serveres med 200.

# 9. Eksisterende ting som skal fortsatt fungere
echo ""
echo "── 9. Regresjon — eksisterende endepunkter ────────────────"
assert_status_oneof "Stripe webhook (CreatorHub)"          "$BACKEND/api/platform/billing/webhook"  "400,405" "POST"
assert_status "Enterprise pricing config (public)"         "$BACKEND/api/enterprise/pricing/config"                "200"
assert_json_field "Enterprise pricing har basePrice"       "$BACKEND/api/enterprise/pricing/config"                "basePrice"
assert_json_field "Enterprise pricing har volume-rabatter" "$BACKEND/api/enterprise/pricing/config"                "volumeDiscounts"

# ── Resultat ─────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RESULTAT"
echo "═══════════════════════════════════════════════════════════"
for t in "${TESTS[@]}"; do
  echo "$t"
done
echo ""
echo "  ✓ Bestått: $PASS"
echo "  ✗ Feilet:  $FAIL"
echo "  ⚠ Advarsler: $WARN"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "  STATUS: alt grønt"
else
  echo "  STATUS: $FAIL feil — sjekk over"
fi
echo ""
echo "═══════════════════════════════════════════════════════════"

# ── Det vi IKKE kan teste fra utsiden ───────────────────────────
cat <<EOF

NB: Disse må verifiseres manuelt — kan ikke testes utenfra:

  1. CREATORHUB_STRIPE_PRICE_ID_ENTERPRISE er satt på Render.
     Sjekk: \$ vercel env pull eller Render dashboard.

  2. CREATORHUB_STRIPE_SECRET_KEY er gyldig.
     Sjekk: prøv POST /api/tester-enterprise-offer/test-offer-id/checkout
     mens du er innlogget som master — hvis Stripe-konfig mangler får
     du 503 med klar feilmelding.

  3. GMAIL_USER + GMAIL_APP_PASSWORD er satt.
     Sjekk: opprett en testforespørsel via skjemaet og se at NDA-e-post
     kommer frem etter at Daniel godkjenner.

  4. Migrations 0124 + 0125 + 0126 er kjørt.
     Idempotent ALTER fanger på første API-kall, men sjekk gjerne
     manuelt: psql -c "SELECT * FROM tester_enterprise_offers LIMIT 1;"

  5. Stripe webhook-URL er registrert i Stripe Dashboard.
     Sjekk Stripe Dashboard → Developers → Webhooks → må ha
     https://creatorhub-backend-rtbl.onrender.com/webhook/stripe

  6. Stripe Enterprise-produktet finnes i Stripe Dashboard.
     Sjekk Stripe Dashboard → Products → må ha Enterprise med
     prisene som matcher /api/enterprise/pricing/config (1599 kr/mnd).

EOF

exit $FAIL
