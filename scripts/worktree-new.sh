#!/usr/bin/env bash
#
# worktree-new.sh — opprett en ny isolert git worktree for parallell
# Claude Code-sesjon. Beskytter mot "branch flippage" (parallelle sessions
# som tråkker på hovedrepoets HEAD).
#
# Usage:
#   ./scripts/worktree-new.sh <tema>            # ny branch off main
#   ./scripts/worktree-new.sh <tema> <branch>   # bruk eksisterende branch
#
# Eksempel:
#   ./scripts/worktree-new.sh role-room-billing-extract
#   → oppretter /Users/danielqazi/monorepo-role-room-billing-extract
#   → ny branch feat/role-room-billing-extract off main
#   → symlinker node_modules + .vite-cache fra hovedrepoet
#
# Etterpå: cd ~/monorepo-<tema> og start din Claude-sesjon der.
# Worktreen er immun mot andre sessioners checkouts.

set -euo pipefail

if [[ -z "${1:-}" ]]; then
  echo "Usage: $0 <tema> [branch]" >&2
  echo "  <tema>    Brukes som mappenavn og branch-suffiks" >&2
  echo "  [branch]  Valgfri eksisterende branch (default: feat/<tema>)" >&2
  exit 1
fi

TEMA="$1"
BRANCH="${2:-feat/$TEMA}"
WORKTREE_PATH="$HOME/monorepo-$TEMA"
MAIN_REPO="$HOME/Creatorhubn-monorepo"

if [[ ! -d "$MAIN_REPO" ]]; then
  echo "❌ Fant ikke hovedrepoet på $MAIN_REPO" >&2
  exit 1
fi

if [[ -d "$WORKTREE_PATH" ]]; then
  echo "❌ Worktree finnes allerede: $WORKTREE_PATH" >&2
  echo "   Bruk:  cd $WORKTREE_PATH" >&2
  echo "   Slett: git worktree remove $WORKTREE_PATH" >&2
  exit 1
fi

cd "$MAIN_REPO"

# Sjekk om branchen finnes — local eller remote
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "ℹ️  Bruker eksisterende local branch: $BRANCH"
  git worktree add "$WORKTREE_PATH" "$BRANCH"
elif git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "ℹ️  Henter remote branch: origin/$BRANCH"
  git fetch origin "$BRANCH":"$BRANCH"
  git worktree add "$WORKTREE_PATH" "$BRANCH"
else
  echo "ℹ️  Lager ny branch off main: $BRANCH"
  # Hent siste main først så worktreen ikke er behind
  git fetch origin main
  git worktree add -b "$BRANCH" "$WORKTREE_PATH" origin/main
fi

cd "$WORKTREE_PATH"

# Symlink node_modules + .vite-cache fra hovedrepoet — sparer GB med disk
# og noen minutters npm install. Worktree-arbeidet er kompatibelt med
# hovedrepoets deps siden begge peker mot samme .git og samme package.json.
echo "🔗 Symlinker node_modules + .vite-cache fra hovedrepoet..."
if [[ -d "$MAIN_REPO/node_modules" ]]; then
  ln -sf "$MAIN_REPO/node_modules" node_modules
fi
if [[ -d "$MAIN_REPO/frontend/node_modules" ]]; then
  ln -sf "$MAIN_REPO/frontend/node_modules" frontend/node_modules
fi
# .vite-cache MÅ være per-worktree fordi den indekserer source-paths som
# inkluderer worktree-pathen. Ikke symlink.

echo ""
echo "✅ Worktree opprettet"
echo "   Path:   $WORKTREE_PATH"
echo "   Branch: $BRANCH"
echo ""
echo "Neste steg:"
echo "   cd $WORKTREE_PATH"
echo "   # ... arbeid her — immun mot andre sessions ..."
echo ""
echo "Når ferdig (etter merge til main):"
echo "   cd $MAIN_REPO"
echo "   git worktree remove $WORKTREE_PATH"
