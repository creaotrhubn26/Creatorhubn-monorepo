#!/bin/sh
# Spørr evidensgrafen: hvilke beslutninger avhenger av en vendor/term?
# Usage: evidence-query.sh <term> [evidence-dir]   (term matches case-insensitivt)
set -e
TERM="${1:?usage: evidence-query.sh <term> [dir]}"
DIR="${2:-docs/evidence}"
FILES=$(grep -liE "$TERM" "$DIR"/*.yaml 2>/dev/null || true)
[ -z "$FILES" ] && { echo "Ingen evidensfiler matcher '$TERM' i $DIR"; exit 0; }
for F in $FILES; do
  echo "== $F =="
  grep -E "^(claim|confidence|decision|valid_from|valid_to|version_scope):" "$F" \
    | sed 's/^/  /'
  echo
done
