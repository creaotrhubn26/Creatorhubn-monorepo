#!/bin/sh
# axe-core accessibility audit av offentlige CreatorHub-ruter.
#
# Brukes både lokalt og i CI. Feiler med exit 1 hvis det finnes WCAG
# 2.1 AA-brudd på noen rute — CI kan da blokkere merge.
#
# Bruk:
#   ./scripts/run-axe-audit.sh                       # tester prod
#   AXE_BASE_URL=http://localhost:5173 ./...sh       # tester lokalt

set -e

BASE_URL="${AXE_BASE_URL:-https://creatorhubn.com}"

ROUTES="/ /nextrole /privacy-policy /terms-and-conditions"

echo "[axe] Base URL: ${BASE_URL}"
echo "[axe] WCAG 2.1 A + AA"
echo ""

FAILED=0

for ROUTE in $ROUTES; do
  URL="${BASE_URL}${ROUTE}"
  echo "▶ ${URL}"
  if npx --yes @axe-core/cli \
       "${URL}" \
       --tags wcag2a,wcag2aa,wcag21a,wcag21aa \
       --exit; then
    echo "  ✓ pass"
  else
    echo "  ✗ FAILED"
    FAILED=$((FAILED + 1))
  fi
  echo ""
done

if [ $FAILED -gt 0 ]; then
  echo "[axe] ${FAILED} ruter feilet WCAG 2.1 AA"
  exit 1
fi

echo "[axe] Alle ruter passerte WCAG 2.1 AA"
