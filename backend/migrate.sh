#!/usr/bin/env bash

# Thin, fail-fast entrypoint for local and CI migration runs.
# The Node runner owns ordering, tracking, timeouts and the PostgreSQL advisory lock.

set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is required" >&2
  exit 1
fi

exec node scripts/run-production-migrations.mjs
