#!/bin/bash

# Database Migration Script for Render
# This script runs database migrations before the server starts

set -e  # Exit on error

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

IS_RENDER_RUNTIME=$(printf '%s' "${RENDER:-}" | tr '[:upper:]' '[:lower:]')
RUN_RENDER_BOOT_SEEDING_NORMALIZED=$(printf '%s' "${RUN_RENDER_BOOT_SEEDING:-}" | tr '[:upper:]' '[:lower:]')
RUN_RENDER_BOOT_INTEGRITY_NORMALIZED=$(printf '%s' "${RUN_RENDER_BOOT_INTEGRITY:-}" | tr '[:upper:]' '[:lower:]')
RUN_RENDER_DRIZZLE_PUSH_NORMALIZED=$(printf '%s' "${RUN_RENDER_DRIZZLE_PUSH:-}" | tr '[:upper:]' '[:lower:]')

echo "🔄 Starting database migrations..."

# Load DATABASE_URL from .env file if not already set
if [ -z "$DATABASE_URL" ] && [ -f .env ]; then
  echo "📄 Loading DATABASE_URL from .env file..."
  DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  export DATABASE_URL
fi

# Some legacy CreatorHub tables are owned by the dedicated migration role.
# Keep its URL separate so metadata/leases stay owned by DATABASE_URL.
if [ -z "$CREATORHUB_MIGRATOR_DATABASE_URL" ] && [ -f .env ]; then
  CREATORHUB_MIGRATOR_DATABASE_URL=$(grep '^CREATORHUB_MIGRATOR_DATABASE_URL=' .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  export CREATORHUB_MIGRATOR_DATABASE_URL
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "✅ DATABASE_URL is configured"

CREATORHUB_MIGRATOR_CONNECTION_VERIFIED=0
MIGRATION_EXECUTION_URL=""
MIGRATION_EXECUTION_ROLE=""

verify_creatorhub_migrator_connection() {
  local primary_identity
  local migrator_identity
  local primary_role
  local primary_database
  local primary_system
  local migrator_role
  local migrator_database
  local migrator_system

  if [ "$CREATORHUB_MIGRATOR_CONNECTION_VERIFIED" = "1" ]; then
    return 0
  fi

  primary_identity=$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -A -t -q -c \
    "SELECT current_user || '|' || current_database() || '|' || system_identifier FROM pg_control_system();") || return 1
  migrator_identity=$(psql "$CREATORHUB_MIGRATOR_DATABASE_URL" -X -v ON_ERROR_STOP=1 -A -t -q -c \
    "SELECT current_user || '|' || current_database() || '|' || system_identifier FROM pg_control_system();") || return 1

  IFS='|' read -r primary_role primary_database primary_system <<< "$primary_identity"
  IFS='|' read -r migrator_role migrator_database migrator_system <<< "$migrator_identity"

  if [ "$migrator_role" != "creatorhub_migrator" ]; then
    echo "❌ CREATORHUB_MIGRATOR_DATABASE_URL authenticates as '$migrator_role', expected 'creatorhub_migrator'" >&2
    return 1
  fi

  if [ "$primary_database" != "$migrator_database" ] || [ "$primary_system" != "$migrator_system" ]; then
    echo "❌ DATABASE_URL and CREATORHUB_MIGRATOR_DATABASE_URL do not identify the same database" >&2
    return 1
  fi

  CREATORHUB_MIGRATOR_CONNECTION_VERIFIED=1
}

select_migration_connection() {
  local migration_file="$1"
  local requested_role

  requested_role=$(awk '
    /^--[[:space:]]*migration-role:[[:space:]]*/ {
      sub(/^--[[:space:]]*migration-role:[[:space:]]*/, "")
      sub(/[[:space:]]*$/, "")
      print
      exit
    }
  ' "$migration_file")

  case "$requested_role" in
    ""|database_owner)
      MIGRATION_EXECUTION_URL="$DATABASE_URL"
      MIGRATION_EXECUTION_ROLE="database_owner"
      ;;
    creatorhub_migrator)
      if [ -z "$CREATORHUB_MIGRATOR_DATABASE_URL" ]; then
        echo "❌ $migration_file requires CREATORHUB_MIGRATOR_DATABASE_URL" >&2
        return 1
      fi
      verify_creatorhub_migrator_connection || return 1
      MIGRATION_EXECUTION_URL="$CREATORHUB_MIGRATOR_DATABASE_URL"
      MIGRATION_EXECUTION_ROLE="creatorhub_migrator"
      ;;
    *)
      echo "❌ $migration_file requests unsupported migration role '$requested_role'" >&2
      return 1
      ;;
  esac
}

calculate_sha256() {
  local file_path="$1"

  if command -v sha256sum &> /dev/null; then
    sha256sum "$file_path" | awk '{print $1}'
  elif command -v shasum &> /dev/null; then
    shasum -a 256 "$file_path" | awk '{print $1}'
  else
    echo "❌ Neither sha256sum nor shasum is available; migration checksums cannot be verified" >&2
    return 1
  fi
}

MIGRATION_LOCK_OWNER="${RENDER_INSTANCE_ID:-local}:$$:$(date +%s)"
MIGRATION_LOCK_HELD=0
MIGRATION_MANIFEST_FILE=""

refresh_migration_lock() {
  local lock_acquired
  lock_acquired=$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
    -v migration_lock_owner="$MIGRATION_LOCK_OWNER" -A -t -q -f - <<'SQL'
WITH refreshed AS (
  UPDATE public._migration_runner_lock
     SET lock_owner = :'migration_lock_owner',
         acquired_at = CASE WHEN lock_owner = :'migration_lock_owner' THEN acquired_at ELSE NOW() END,
         expires_at = NOW() + INTERVAL '30 minutes'
   WHERE lock_key = 1
     AND (lock_owner IS NULL OR lock_owner = :'migration_lock_owner' OR expires_at <= NOW())
   RETURNING 1
)
SELECT COALESCE((SELECT 1 FROM refreshed), 0);
SQL
  )
  [ "$lock_acquired" = "1" ]
}

release_migration_lock() {
  if [ "$MIGRATION_LOCK_HELD" = "1" ]; then
    psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
      -v migration_lock_owner="$MIGRATION_LOCK_OWNER" -q -f - \
      > /dev/null 2>&1 <<'SQL' || true
UPDATE public._migration_runner_lock
   SET lock_owner = NULL, acquired_at = NULL, expires_at = NULL
 WHERE lock_key = 1 AND lock_owner = :'migration_lock_owner';
SQL
    MIGRATION_LOCK_HELD=0
  fi
  if [ -n "$MIGRATION_MANIFEST_FILE" ] && [ -f "$MIGRATION_MANIFEST_FILE" ]; then
    rm -f "$MIGRATION_MANIFEST_FILE"
    MIGRATION_MANIFEST_FILE=""
  fi
}

trap release_migration_lock EXIT

# Drizzle loads the shared schema from ../frontend/shared. In production Docker the
# installed packages live in /app/backend/node_modules, so expose that path to
# Node's resolver before drizzle-kit imports files outside the backend folder.
BACKEND_NODE_MODULES="$(pwd)/node_modules"
APP_BACKEND_NODE_MODULES="/app/backend/node_modules"
APP_NODE_MODULES="/app/node_modules"
export NODE_PATH="${NODE_PATH:+$NODE_PATH:}$BACKEND_NODE_MODULES:$APP_BACKEND_NODE_MODULES:$APP_NODE_MODULES"

# Create migration metadata and acquire an atomic database lease. The lease is
# refreshed before every migration, preventing two Render instances from
# applying the same file concurrently without relying on shell-specific locks.
if command -v psql &> /dev/null; then
  echo "📊 Setting up migration tracking..."
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS public._migrations_applied (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    checksum_sha256 VARCHAR(64),
    applied_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT migrations_applied_checksum_format_check
      CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$')
  );
  ALTER TABLE public._migrations_applied
    ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64);
  DO \$\$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
        FROM pg_constraint
       WHERE conname = 'migrations_applied_checksum_format_check'
         AND conrelid = 'public._migrations_applied'::regclass
    ) THEN
      ALTER TABLE public._migrations_applied
        ADD CONSTRAINT migrations_applied_checksum_format_check
        CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$');
    END IF;
  END
  \$\$;
  CREATE TABLE IF NOT EXISTS public._migration_runner_lock (
    lock_key SMALLINT PRIMARY KEY CHECK (lock_key = 1),
    lock_owner TEXT,
    acquired_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
  );
  INSERT INTO public._migration_runner_lock (lock_key)
  VALUES (1)
  ON CONFLICT (lock_key) DO NOTHING;"

  if ! refresh_migration_lock; then
    echo "❌ Another migration runner already holds the database lease"
    exit 1
  fi
  MIGRATION_LOCK_HELD=1

  MIGRATION_MANIFEST_FILE=$(mktemp "${TMPDIR:-/tmp}/creatorhub-migrations.XXXXXX")
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -A -t -q -F '|' -c \
    "SELECT filename, COALESCE(checksum_sha256, '__legacy__')
       FROM public._migrations_applied
      ORDER BY filename" > "$MIGRATION_MANIFEST_FILE"
fi

# Run SQL migrations from migrations directory (if psql is available)
if [ -d "migrations" ]; then
  if command -v psql &> /dev/null; then
    echo "📦 Running SQL migrations with psql..."

    # Get list of migration files and sort them properly
    # This ensures numeric ordering: 001, 002, etc. before 0001
    migration_files=$(ls migrations/*.sql 2>/dev/null | sort -V)

    if [ -z "$migration_files" ]; then
      echo "  ℹ️  No SQL migration files found"
    else
      for migration_file in $migration_files; do
        if [ -f "$migration_file" ]; then
          base_name=$(basename "$migration_file")
          migration_checksum=$(calculate_sha256 "$migration_file")

          # A checksum is mandatory for new rows. Legacy rows remain nullable
          # until the migration history has been canonicalized explicitly.
          applied_checksum=$(awk -F '|' -v filename="$base_name" \
            '$1 == filename { print $2; exit }' "$MIGRATION_MANIFEST_FILE")

          if [ -n "$applied_checksum" ]; then
            if [ "$applied_checksum" = "__legacy__" ]; then
              echo "  ⚠️  Skipping $base_name (legacy applied row has no checksum)"
            elif [ "$applied_checksum" != "$migration_checksum" ]; then
              echo "  ❌ Checksum mismatch for already-applied migration $base_name"
              echo "     database: $applied_checksum"
              echo "     file:     $migration_checksum"
              exit 1
            else
              echo "  ⏭️  Skipping $base_name (already applied; checksum verified)"
            fi
            continue
          fi

          if ! select_migration_connection "$migration_file"; then
            echo "  🛑 Stopping before $base_name can run with the wrong database role"
            exit 1
          fi

          if ! refresh_migration_lock; then
            echo "  ❌ Lost the database migration lease before $base_name"
            exit 1
          fi

          echo "  ➤ Applying $base_name as $MIGRATION_EXECUTION_ROLE..."
          # ON_ERROR_STOP=1 sikrer at psql exit'er m/ non-zero hvis SQL
          # feiler. Uten dette returnerer psql exit 0 selv ved ROLLBACK,
          # og vi ville feil-logge som "applied successfully" (skjedde
          # 2026-06-17 for mig 285-298 — se 0000_zz_cleanup_failed_*.sql).
          #
          # IKKE bruk --single-transaction: mig-filer har egne
          # BEGIN/COMMIT-blokker. --single-transaction wrap'er hele filen
          # i ekstra outer-transaction som gir nested-warning, og hvis
          # filen feiler så ruller outer-TX tilbake selv om inner COMMIT
          # var passert. Da mister vi delvis-progress (skjedde 2026-06-18
          # — mig 0285 skapte organizations + brakk på linje 230 →
          # outer-TX rullet ALT tilbake → 286+ så ingen organizations).
          # lock_timeout=30s: hvis en migrasjon venter på en tabell-lås (f.eks.
          # holdt av live app-trafikk) feiler den raskt i stedet for å HENGE
          # hele migrate-runen på ubestemt tid — den som spawnes fra
          # /api/admin-room/migrations/run mot en LEVENDE instans (2026-07-26:
          # migrate.sh gjorde Render-instansen uresponsiv i 30+ min; psql var
          # alt i imaget, så det var ikke apt-install men en lås-vent).
          # statement_timeout=10min: rundhåndet backstop mot en løpsk setning.
          # En migrasjon som treffer disse feiler → hele kjøringen stopper + filen
          # spores IKKE → kan kjøres på nytt. Overstyres av en migrasjon som selv
          # SET-er timeouts.
          # IKKE bruk PGOPTIONS='-c lock_timeout=...' — sendes som startup-
          # parameter, og Neons pgbouncer-pooler (transaction mode) avviser
          # ukjente startup-parametre: "unsupported startup parameter in
          # options" → ALLE migrasjoner feiler på tilkobling, ingen SQL kjøres
          # (skjedde 2026-08-16 mot ny gentle-grass-pooler-endpoint — 687/687
          # feilet, public._migrations_applied forble tom). SET som vanlig SQL-setning
          # i stedet — samme effekt, virker uansett pooler-type.
          if psql "$MIGRATION_EXECUTION_URL" -X -v ON_ERROR_STOP=1 -c "SET search_path TO public; SET lock_timeout = '30s'; SET statement_timeout = '600s';" -f "$migration_file"; then
            # Record successful migration
            psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
              -v migration_filename="$base_name" \
              -v migration_checksum="$migration_checksum" \
              -q -f - <<'SQL'
INSERT INTO public._migrations_applied AS applied (filename, checksum_sha256)
VALUES (:'migration_filename', :'migration_checksum')
ON CONFLICT (filename) DO UPDATE
  SET checksum_sha256 = EXCLUDED.checksum_sha256
WHERE applied.checksum_sha256 IS NULL;
SQL
            printf '%s|%s\n' "$base_name" "$migration_checksum" >> "$MIGRATION_MANIFEST_FILE"
            echo "  ✅ $base_name applied successfully"
          else
            echo "  ❌ Error applying $base_name (psql exit non-zero; SQL feilet)"
            echo "  🛑 Stopping before dependent migrations can run"
            exit 1
          fi
        fi
      done
      echo "✅ SQL migrations completed"
    fi
  else
    echo "⚠️  psql not found in PATH"
    echo "  Attempting to install postgresql-client..."

    # Try to install psql on Render (Debian/Ubuntu)
    if command -v apt-get &> /dev/null; then
      sudo apt-get update -qq && sudo apt-get install -y -qq postgresql-client > /dev/null 2>&1 && echo "  ✅ postgresql-client installed" || echo "  ❌ Failed to install postgresql-client"
    elif command -v apk &> /dev/null; then
      # Alpine Linux
      sudo apk add --no-cache postgresql-client > /dev/null 2>&1 && echo "  ✅ postgresql-client installed" || echo "  ❌ Failed to install postgresql-client"
    else
      echo "  ❌ Cannot install psql automatically. Please add postgresql-client to your build."
      echo "  ℹ️  Skipping SQL migrations (will rely on Drizzle schema push)"
    fi
  fi
else
  echo "⚠️  No migrations directory found"
fi

# Run Drizzle schema push (for local/schema sync)
if [ "$IS_RENDER_RUNTIME" = "true" ] && [ "$RUN_RENDER_DRIZZLE_PUSH_NORMALIZED" != "1" ] && [ "$RUN_RENDER_DRIZZLE_PUSH_NORMALIZED" != "true" ]; then
  echo "⏭️  Skipping Drizzle schema push on Render startup; SQL migrations are authoritative"
elif [ "${SKIP_DRIZZLE_PUSH}" = "1" ]; then
  echo "⏭️  Skipping Drizzle schema push (SKIP_DRIZZLE_PUSH=1)"
else
  echo "📦 Syncing database schema with Drizzle..."
  if command -v npx &> /dev/null; then
    # Prefer the installed drizzle-kit version. Falling back to remote npx can
    # change schema behavior between deploys, so only use it when explicitly needed.
    if npx --no-install drizzle-kit push; then
      echo "✅ Database schema synchronized"
    else
      echo "⚠️  Drizzle schema sync failed; SQL migrations remain authoritative"
      if [ "${DRIZZLE_PUSH_REQUIRED:-0}" = "1" ]; then
        exit 1
      fi
    fi
  else
    # Fallback to npm script if npx is unavailable in the environment
    if npm run db:push; then
      echo "✅ Database schema synchronized"
    else
      echo "⚠️  Drizzle schema sync failed; SQL migrations remain authoritative"
      if [ "${DRIZZLE_PUSH_REQUIRED:-0}" = "1" ]; then
        exit 1
      fi
    fi
  fi
fi

# Run database seeding (if seed scripts exist)
if [ "$IS_RENDER_RUNTIME" = "true" ] && [ "$RUN_RENDER_BOOT_SEEDING_NORMALIZED" != "1" ] && [ "$RUN_RENDER_BOOT_SEEDING_NORMALIZED" != "true" ]; then
  echo "⏭️  Skipping heavy database seeding on Render startup"
elif command -v node &> /dev/null; then
  echo "🌱 Running comprehensive database seeding..."

  # Run INTROSPECTIVE auto-seeder first (discovers and seeds all live tables)
  if [ -f "scripts/auto-seed-INTROSPECTIVE.cjs" ]; then
    echo "  🚀 Running INTROSPECTIVE auto-seeder (live tables)..."
    SEED_ALL=1 INTROSPECTIVE_SEED_PASSES=${INTROSPECTIVE_SEED_PASSES:-10} node scripts/auto-seed-INTROSPECTIVE.cjs || echo "  ℹ️  INTROSPECTIVE seeding completed with warnings"
  fi

  # Run ULTIMATE (476) seeder next as a fallback for named reference data
  if [ -f "scripts/auto-seed-ULTIMATE-476.cjs" ]; then
    echo "  🚀 Running ULTIMATE auto-seeder (476 tables)..."
    node scripts/auto-seed-ULTIMATE-476.cjs || echo "  ℹ️  ULTIMATE seeding completed with warnings"
  fi

  # Run basic essentials next
  if [ -f "scripts/auto-seed.cjs" ]; then
    SEED_MODE=production node scripts/auto-seed.cjs || echo "  ℹ️  Basic seeding completed with warnings"
  fi

  # Run comprehensive seeder (subscription plans, integrations, templates, etc.)
  if [ -f "scripts/seed-all.cjs" ]; then
    node scripts/seed-all.cjs || echo "  ℹ️  Comprehensive seeding completed with warnings"
  fi

  # Run individual seeders if they exist
  if [ -f "scripts/seed-subscription-plans.cjs" ]; then
    node scripts/seed-subscription-plans.cjs 2>/dev/null || true
  fi

  if [ -f "scripts/seed-integration-defaults.cjs" ]; then
    node scripts/seed-integration-defaults.cjs 2>/dev/null || true
  fi

  if [ -f "scripts/seed-email-templates.cjs" ]; then
    node scripts/seed-email-templates.cjs 2>/dev/null || true
  fi

  if [ -f "server/seed-academy-data.ts" ]; then
    npx tsx server/seed-academy-data.ts 2>/dev/null || true
  fi

  if [ -f "server/scripts/seed-wedding-cultures.ts" ]; then
    npx tsx server/scripts/seed-wedding-cultures.ts 2>/dev/null || true
  fi

  # Final pass: seed any remaining empty tables (enum/FK aware)
  if [ -f "scripts/generate-seed-sql-for-empties.cjs" ]; then
    echo "  🧩 Generating and applying seed for remaining empties..."
    # First, refresh EMPTY_TABLES.json (non-fatal)
    node scripts/list-empty-tables.cjs 2>/dev/null || true
    # Generate SQL using updated enum parsing
    node scripts/generate-seed-sql-for-empties.cjs 2>/dev/null || true
    # Apply if psql is available
    if command -v psql &> /dev/null; then
      psql "$DATABASE_URL" -f seed_remaining.sql 2>/dev/null || true
    fi
    # Post-check empties (non-fatal)
    node scripts/list-empty-tables.cjs 2>/dev/null || true
  fi

  echo "✅ Database seeding completed"
fi

# Optional: Run database integrity check (non-interactive in CI/Render)
if [ "$IS_RENDER_RUNTIME" = "true" ] && [ "$RUN_RENDER_BOOT_INTEGRITY_NORMALIZED" != "1" ] && [ "$RUN_RENDER_BOOT_INTEGRITY_NORMALIZED" != "true" ]; then
  echo "⏭️  Skipping database integrity check on Render startup"
elif command -v node &> /dev/null; then
  if [ -f "scripts/database-integrity-checker.cjs" ]; then
    echo "🔍 Running database integrity check..."
    FAST_SUMMARY=${FAST_SUMMARY:-1} RUN_VACUUM=${RUN_VACUUM:-0} MIGRATION_INTERACTIVE=0 node scripts/database-integrity-checker.cjs || echo "⚠️  Integrity check skipped"
  fi
fi

echo "✅ Migration process complete"
