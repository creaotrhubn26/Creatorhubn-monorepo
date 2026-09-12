#!/usr/bin/env bash
# restore.sh — re-applikerer CreatorHub-tilpasningene på Higgsfield-skillene.
#
# Kjør dette ETTER `npx skills add higgsfield-ai/skills` (som overskriver
# skill-mappene og dermed våre inline-edits). Idempotent: trygt å kjøre når som
# helst — gjør ingenting hvis alt allerede er på plass.
#
# Gjenoppretter:
#   1. skills/_creatorhub/system-context.md  (delt system-kontekst)
#   2. CreatorHub-kontekst-blokk øverst i hver higgsfield-*/SKILL.md
#   3. Herder `curl … install.sh | sh` → `npm i -g @higgsfield/cli`
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS="$(cd "$HERE/../skills" && pwd)"
BLOCK="$HERE/skill-context-block.md"
CTX_SRC="$HERE/system-context.md"

# 1) delt system-kontekst
mkdir -p "$SKILLS/_creatorhub"
cp "$CTX_SRC" "$SKILLS/_creatorhub/system-context.md"
echo "✓ _creatorhub/system-context.md gjenopprettet"

# 2) + 3) per skill
CURL='curl -fsSL https://raw.githubusercontent.com/higgsfield-ai/cli/main/install.sh | sh'
NPM='npm i -g @higgsfield/cli   # CreatorHub: styrt via npm, ikke curl|sh'

for f in "$SKILLS"/higgsfield-*/SKILL.md; do
  [ -f "$f" ] || continue
  name="$(basename "$(dirname "$f")")"

  # 2) sett inn kontekst-blokk etter første H1 hvis den mangler
  if ! grep -q "CreatorHub-systemkontekst" "$f"; then
    awk -v bf="$BLOCK" '
      BEGIN { while ((getline l < bf) > 0) blk = blk l "\n" }
      { print }
      /^# / && !done { print ""; printf "%s", blk; done=1 }
    ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
    echo "  ✓ $name: kontekst-blokk satt inn"
  else
    echo "  · $name: kontekst-blokk allerede til stede"
  fi

  # 3) herd curl|sh → npm (delimiter ~ finnes ikke i noen av strengene)
  if grep -qF "$CURL" "$f"; then
    sed "s~${CURL}~${NPM}~g" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
    echo "  ✓ $name: curl|sh herdet → npm"
  fi
done

echo "Ferdig. Alle CreatorHub-tilpasninger er på plass."
