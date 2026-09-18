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
#   → oppretter ~/Creatorhubn-worktrees/role-room-billing-extract
#   → ny branch feat/role-room-billing-extract off main
#   → symlinker node_modules + .vite-cache fra hovedrepoet
#   → låser worktreet mot git prune
#
# Etterpå: cd ~/Creatorhubn-worktrees/<tema> og start sesjonen der.
# CREATORHUB_WORKTREE_ROOT kan overstyre roten, men midlertidige
# macOS-mapper avvises fordi de kan slettes ved omstart.

set -euo pipefail

if [[ -z "${1:-}" ]]; then
  echo "Usage: $0 <tema> [branch]" >&2
  echo "  <tema>    Brukes som mappenavn og branch-suffiks" >&2
  echo "  [branch]  Valgfri eksisterende branch (default: feat/<tema>)" >&2
  exit 1
fi

TEMA="$1"
BRANCH="${2:-feat/$TEMA}"
CREATORHUB_MAIN_REPO="${CREATORHUB_MAIN_REPO:-$HOME/Creatorhubn-monorepo}"
CREATORHUB_WORKTREE_ROOT="${CREATORHUB_WORKTREE_ROOT:-$HOME/Creatorhubn-worktrees}"

if [[ ! "$TEMA" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
  echo "❌ Tema må starte med bokstav/tall og bare inneholde bokstaver, tall, punktum, _ eller -." >&2
  exit 1
fi

mkdir -p "$CREATORHUB_WORKTREE_ROOT"
CREATORHUB_WORKTREE_ROOT="$(cd "$CREATORHUB_WORKTREE_ROOT" && pwd -P)"

case "$CREATORHUB_WORKTREE_ROOT" in
  /tmp|/tmp/*|/private/tmp|/private/tmp/*|/var/folders|/var/folders/*|/private/var/folders|/private/var/folders/*)
    echo "❌ Worktrees kan ikke ligge i et midlertidig område: $CREATORHUB_WORKTREE_ROOT" >&2
    echo "   Bruk en varig mappe, for eksempel $HOME/Creatorhubn-worktrees." >&2
    exit 1
    ;;
esac

WORKTREE_PATH="$CREATORHUB_WORKTREE_ROOT/$TEMA"
MAIN_REPO="$CREATORHUB_MAIN_REPO"

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

# Behold administrative worktree-poster permanent. Den eksplisitte låsen
# nedenfor beskytter hvert worktree i tillegg.
git config gc.worktreePruneExpire never

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

git worktree lock \
  --reason "Persistent CreatorHub worktree created by scripts/worktree-new.sh" \
  "$WORKTREE_PATH"

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
echo "   Vern:   persistent mappe + git worktree lock"
echo ""
echo "Neste steg:"
echo "   cd $WORKTREE_PATH"
echo "   # ... arbeid her — immun mot andre sessions ..."
echo ""
echo "Når ferdig (etter merge til main):"
echo "   cd $MAIN_REPO"
echo "   git worktree unlock $WORKTREE_PATH"
echo "   git worktree remove $WORKTREE_PATH"
