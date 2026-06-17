#!/bin/bash

# Database Migration Script for Render
# This script runs database migrations before the server starts

set -e  # Exit on error

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

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "✅ DATABASE_URL is configured"

# Drizzle loads the shared schema from ../frontend/shared. In production Docker the
# installed packages live in /app/backend/node_modules, so expose that path to
# Node's resolver before drizzle-kit imports files outside the backend folder.
BACKEND_NODE_MODULES="$(pwd)/node_modules"
APP_BACKEND_NODE_MODULES="/app/backend/node_modules"
APP_NODE_MODULES="/app/node_modules"
export NODE_PATH="${NODE_PATH:+$NODE_PATH:}$BACKEND_NODE_MODULES:$APP_BACKEND_NODE_MODULES:$APP_NODE_MODULES"

# Create migrations tracking table
if command -v psql &> /dev/null; then
  echo "📊 Setting up migration tracking..."
  psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS _migrations_applied (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
  );" 2>/dev/null || echo "  ℹ️  Migration tracking table already exists"
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
          
          # Check if migration already applied
          already_applied=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM _migrations_applied WHERE filename='$base_name'" 2>/dev/null || echo "0")
          
          if [ "$already_applied" -gt 0 ]; then
            echo "  ⏭️  Skipping $base_name (already applied)"
            continue
          fi
          
          echo "  ➤ Applying $base_name..."
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
          if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration_file"; then
            # Record successful migration
            psql "$DATABASE_URL" -c "INSERT INTO _migrations_applied (filename) VALUES ('$base_name') ON CONFLICT (filename) DO NOTHING;" 2>/dev/null
            echo "  ✅ $base_name applied successfully"
          else
            echo "  ❌ Error applying $base_name (psql exit non-zero; SQL feilet)"
            echo "  ⚠️  Continuing with remaining migrations..."
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
