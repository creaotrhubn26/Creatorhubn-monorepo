import pg from 'pg';
import { runMigrations } from '../scripts/migrate.js';
import { createPool, type Db } from '../src/db/pool.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://ledgerly:ledgerly_dev@localhost:5432/ledgerly_test';

let migrated = false;

export async function setupTestDb(): Promise<Db> {
  if (!migrated) {
    await runMigrations(TEST_DATABASE_URL);
    migrated = true;
  }
  return createPool(TEST_DATABASE_URL);
}

/**
 * Tømmer alle applikasjonstabeller mellom testfiler.
 * TRUNCATE fyrer ikke radtriggere, så append-only-vernet (som gjelder
 * UPDATE/DELETE) står urørt i applikasjonsflyt.
 */
export async function truncateAll(): Promise<void> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tablename NOT LIKE '\\_%'
        ) LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
  } finally {
    await client.end();
  }
}
