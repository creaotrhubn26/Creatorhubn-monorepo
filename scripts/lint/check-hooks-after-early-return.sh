#!/bin/bash
# Detekter mulige React hooks-rule violations som ESLint react-hooks/rules-of-hooks
# IKKE fanger:
#   A. Hooks deklarert ETTER `if (...) return null` (early-return)
#   B. Hooks inline i JSX-prop verdier (`<X prop={React.useMemo(...)} />`)
#
# Begge mønstrene har shipped UI-bugs for ekte brukere i denne kodebasen
# (FormationViewConnected + AnnotationExportOverlay).
#
# VIKTIG: Dette er HEURISTIC — den ser ikke scope, og kan rapportere
# false positives når en fil har MULTIPLE funksjoner (utility med
# early-return + hovedkomponent med hooks). Bruk som START-PUNKT for
# manuell review, IKKE som strict CI-gate.
#
# Pattern B (inline-i-JSX) er mer presis og er svært sannsynlig en bug.
#
# Bruk:
#   ./scripts/lint/check-hooks-after-early-return.sh [<path|.>]            # advisory mode (alltid exit 0)
#   ./scripts/lint/check-hooks-after-early-return.sh --strict <path>       # exit 1 hvis Pattern B treffer
#
set -uo pipefail

STRICT=0
if [ "${1:-}" = "--strict" ]; then
  STRICT=1
  shift
fi

ROOT="${1:-.}"
PATTERN_A_COUNT=0
PATTERN_B_COUNT=0

FILES=$(find "$ROOT" -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -name "*.d.ts" \
  -not -name "*.test.tsx" -not -name "*.test.ts" \
  -not -name "*.spec.tsx" -not -name "*.spec.ts")

echo "=== Pattern B: hook inline i JSX-prop ==="
echo "    (høy konfidens — nesten alltid en bug)"
for f in $FILES; do
  jsx_matches=$(grep -nE '\{React\.use(State|Effect|Memo|Callback|Ref|Reducer)' "$f" 2>/dev/null || true)
  if [ -n "$jsx_matches" ]; then
    while IFS= read -r line; do
      lineno=$(echo "$line" | cut -d: -f1)
      echo "  $f:$lineno"
      PATTERN_B_COUNT=$((PATTERN_B_COUNT + 1))
    done <<< "$jsx_matches"
  fi
done

echo ""
echo "=== Pattern A: hook ETTER 'if (...) return null' ==="
echo "    (heuristic — krever manuell scope-check; mange false positives)"
for f in $FILES; do
  early_lines=$(grep -nE '^\s*if\s*\(.*\)\s*return\s*(null|<)' "$f" 2>/dev/null | cut -d: -f1)
  if [ -n "$early_lines" ]; then
    early=$(echo "$early_lines" | head -1)
    hooks=$(awk -v early="$early" 'NR > early && /^[[:space:]]*(const[[:space:]]+[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=[[:space:]]*)?React\.use/ { print NR ":" $0 }' "$f" 2>/dev/null || true)
    if [ -n "$hooks" ]; then
      first_hook=$(echo "$hooks" | head -1 | cut -d: -f1)
      echo "  $f:$first_hook (early-return @$early)"
      PATTERN_A_COUNT=$((PATTERN_A_COUNT + 1))
    fi
  fi
done

echo ""
echo "Pattern A (advisory): $PATTERN_A_COUNT files"
echo "Pattern B (strict):   $PATTERN_B_COUNT occurrences"
echo ""
if [ "$PATTERN_B_COUNT" -gt 0 ]; then
  echo "❌ Pattern B treff — nesten alltid en bug (hook inline i JSX = ny hook hver render)."
  echo "   Fix: ekstrahere til const ovenfor JSX, så referer."
  if [ "$STRICT" -eq 1 ]; then
    exit 1
  fi
fi
if [ "$PATTERN_A_COUNT" -gt 0 ]; then
  echo "⚠️  Pattern A treff — sjekk MANUELT om hook og early-return er i samme funksjon."
  echo "   Fix hvis det er bug: flytt hook ABOVE early-return."
fi

if [ "$PATTERN_A_COUNT" -eq 0 ] && [ "$PATTERN_B_COUNT" -eq 0 ]; then
  echo "✅ Ingen mistanker funnet."
fi
exit 0
