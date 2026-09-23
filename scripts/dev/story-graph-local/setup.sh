#!/usr/bin/env bash
# Story Graph — lokal full stack på én kommando (Postgres + skjema + WFU-seed + brukere).
#
#   scripts/dev/story-graph-local/setup.sh          # opprett/oppdater alt
#   scripts/dev/story-graph-local/setup.sh --reset  # slett lokal database og start på nytt
#
# Deretter:
#   cd backend  && DATABASE_URL=… NODE_ENV=development PORT=3003 npx tsx server/index.ts
#   cd frontend && npm run dev     # http://localhost:5001/theroleroom.html?mode=game_studio
#
# Tilstand (database, brukere/passord) ligger i $STORY_GRAPH_LOCAL_DIR
# (standard ~/.cache/story-graph-local) — aldri i repoet. Idempotent.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
STATE="${STORY_GRAPH_LOCAL_DIR:-$HOME/.cache/story-graph-local}"
# Postgres-prosessen må kunne gå gjennom hele stien: som root (sky-containere)
# legges datamappa i postgres-brukerens eget hjem, ikke under /root eller /tmp.
if [ -n "${STORY_GRAPH_PGDATA:-}" ]; then PGDATA="$STORY_GRAPH_PGDATA"
elif [ "$(id -u)" = 0 ]; then PGDATA="$(getent passwd postgres | cut -d: -f6)/story-graph-local"
else PGDATA="$STATE/pgdata"; fi
PORT="${STORY_GRAPH_PG_PORT:-5432}"
DB=creatorhub
export DATABASE_URL="postgresql://postgres@localhost:$PORT/$DB"

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PG_BIN/initdb" ] || { echo "Fant ikke initdb (sett PG_BIN til Postgres 16 bin-mappen)." >&2; exit 1; }

# Postgres vil ikke kjøre som root: bruk postgres-brukeren da.
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }

mkdir -p "$STATE"
if [ "$(id -u)" = 0 ]; then mkdir -p "$PGDATA" && chown postgres "$PGDATA"; fi

if [ "${1:-}" = "--reset" ] && [ -d "$PGDATA" ]; then
  as_pg "'$PG_BIN/pg_ctl' -D '$PGDATA' stop -m fast" >/dev/null 2>&1 || true
  rm -rf "$PGDATA" "$STATE/users.json"
  echo "Lokal database slettet."
fi

echo "== 1/6 Postgres"
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  as_pg "'$PG_BIN/initdb' -D '$PGDATA' -U postgres --auth=trust >/dev/null"
fi
if ! as_pg "'$PG_BIN/pg_ctl' -D '$PGDATA' status" >/dev/null 2>&1; then
  as_pg "'$PG_BIN/pg_ctl' -D '$PGDATA' -o '-p $PORT -k /tmp' -l '$PGDATA/server.log' start -w" >/dev/null
fi
psql -h localhost -p "$PORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 \
  || psql -h localhost -p "$PORT" -U postgres -c "CREATE DATABASE $DB" >/dev/null
psql -h localhost -p "$PORT" -U postgres -d "$DB" -q -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'

echo "== 2/6 Drizzle-baseline (users m.fl.)"
(cd "$REPO/backend" && npx --yes drizzle-kit push --force >"$STATE/drizzle-push.log" 2>&1) \
  || echo "   drizzle-kit push avsluttet med feil (vanlig lokalt, migrasjonene dekker resten) — se $STATE/drizzle-push.log"

echo "== 3/6 SQL-migrasjoner"
MIGRATE_REPORT="$STATE/migrate-failed.json" node "$HERE/migrate.mjs"

echo "== 4/6 Lokale skjema-lapper (prod har disse fra før)"
psql -h localhost -p "$PORT" -U postgres -d "$DB" -q <<'SQL'
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
SQL

echo "== 5/6 Brukere, prosjekt og Studio-plan"
node "$HERE/users.mjs" "$STATE/users.json"

echo "== 6/6 What Follows Us-seed"
(cd "$REPO/backend" && npx tsx scripts/seed-what-follows-us.ts --project what-follows-us-local | tail -3)

cat <<INFO

Ferdig. DATABASE_URL=$DATABASE_URL
Brukere og passord: $STATE/users.json
Prosjekt: what-follows-us-local (Studio-plan, eier qa-owner) · solo-tomt-prosjekt (Solo, eier qa-solo)
Start backend:  cd backend && DATABASE_URL=$DATABASE_URL NODE_ENV=development PORT=3003 npx tsx server/index.ts
Start frontend: cd frontend && npm run dev
INFO
