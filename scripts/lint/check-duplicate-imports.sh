#!/bin/bash
# Detekter duplikate import-statements i samme fil.
#
# Bakgrunn: auto-merge i git kan produsere duplikate `import` uten å trigge
# konflikt-marker. Babel feilet stille → vite serverte stale HMR-cache →
# UI-endringer tok aldri effekt.
#
# Sjekker:
#   1. Eksakt-duplikat: to identiske `import { X } from 'mod'`
#   2. Samme-modul-duplikat: to `import` fra samme path (selv om andre named exports)
#
# Bruk: ./scripts/lint/check-duplicate-imports.sh [<path|.>]
# Exit 0 = ingen duplikater, 1 = duplikater funnet
set -uo pipefail

ROOT="${1:-.}"
FOUND=0

FILES=$(find "$ROOT" -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -name "*.d.ts")

for f in $FILES; do
  # Trekk ut KUN enkelt-linje imports som har 'from' på samme linje.
  # Multi-line imports (`import {\n  X,\n  Y,\n} from 'mod'`) hopper vi over
  # for å unngå falske 'import {' duplikater.
  imports=$(grep -nE "^import[[:space:]].*\\bfrom[[:space:]]+['\"]" "$f" 2>/dev/null || true)
  if [ -z "$imports" ]; then continue; fi

  # Sjekk 1: eksakt-duplikat
  exact_dups=$(echo "$imports" | sed 's/^[0-9]*://' | sort | uniq -d)
  if [ -n "$exact_dups" ]; then
    echo "$f — eksakt-duplikat:"
    while IFS= read -r dup; do
      echo "    $dup"
      echo "$imports" | grep -F "$dup" | head -5 | while IFS= read -r line; do
        echo "      (linje $(echo "$line" | cut -d: -f1))"
      done
    done <<< "$exact_dups"
    FOUND=$((FOUND + 1))
  fi

  # Sjekk 2: samme-modul-duplikat er IKKE alltid bug (`import type` +
  # `import value`, default + named, side-effect + named, etc.). Vi
  # rapporterer KUN eksakt-duplikater her — det er mønstret auto-merge
  # introduserte historisk. Andre patterns er ofte legitime.
done

echo ""
if [ "$FOUND" -eq 0 ]; then
  echo "✅ Ingen duplikate import-statements funnet."
  exit 0
else
  echo "❌ Funnet $FOUND duplikate imports."
  echo ""
  echo "Auto-merge i git produserer noen ganger to identiske \`import\` uten"
  echo "konflikt-marker. Konsolider til ett import-statement."
  exit 1
fi
