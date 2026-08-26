#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MIGRATIONS_DIR = path.resolve(SCRIPT_DIR, '..', 'migrations');
const MIGRATION_FILENAME = /^[A-Za-z0-9._-]+\.sql$/;
const LOCK_NAMESPACE = 'creatorhub';
const LOCK_NAME = 'production-migrations';

function safeErrorMessage(error) {
  if (!(error instanceof Error)) return 'unknown_error';
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code || '')
      : '';
  return code ? code + ': ' + error.message : error.message;
}

export function requireDatabaseUrl(value = process.env.DATABASE_URL) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    throw new Error('DATABASE_URL is required');
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql scheme');
  }
  if (!parsed.hostname || !parsed.username) {
    throw new Error('DATABASE_URL must include a hostname and username');
  }
  return candidate;
}

export function versionSortMigrationFiles(files) {
  for (const filename of files) {
    if (!MIGRATION_FILENAME.test(filename)) {
      throw new Error('Unsafe migration filename: ' + JSON.stringify(filename));
    }
  }
  if (files.length === 0) return [];

  const result = spawnSync('sort', ['-V'], {
    input: files.join('\n') + '\n',
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      'sort -V failed: ' + String(result.stderr || '').trim(),
    );
  }
  return result.stdout.trimEnd().split('\n').filter(Boolean);
}

async function listMigrationFiles(migrationsDir) {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return versionSortMigrationFiles(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name),
  );
}

export async function applyPendingMigrations(
  client,
  { migrationsDir = DEFAULT_MIGRATIONS_DIR, log = console.log } = {},
) {
  await client.query(
    'CREATE TABLE IF NOT EXISTS _migrations_applied (' +
      'id SERIAL PRIMARY KEY, ' +
      'filename VARCHAR(255) UNIQUE NOT NULL, ' +
      'applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()' +
      ')',
  );

  const appliedResult = await client.query(
    'SELECT filename FROM _migrations_applied',
  );
  const applied = new Set(
    appliedResult.rows.map((row) => String(row.filename)),
  );
  const migrationFiles = await listMigrationFiles(migrationsDir);
  let appliedCount = 0;
  let skippedCount = 0;

  for (const filename of migrationFiles) {
    if (applied.has(filename)) {
      skippedCount += 1;
      log('SKIP ' + filename);
      continue;
    }

    const migrationPath = path.join(migrationsDir, filename);
    const sql = await readFile(migrationPath, 'utf8');
    if (/^\s*\\/m.test(sql)) {
      throw new Error(
        'Migration ' + filename + ' contains unsupported psql meta-commands',
      );
    }

    log('APPLY ' + filename);
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations_applied (filename) VALUES ($1) ' +
          'ON CONFLICT (filename) DO NOTHING',
        [filename],
      );
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // A dropped connection releases the session advisory lock itself.
      }
      throw new Error(
        'Migration ' + filename + ' failed: ' + safeErrorMessage(error),
        { cause: error },
      );
    }
    appliedCount += 1;
    log('APPLIED ' + filename);
  }

  return {
    totalCount: migrationFiles.length,
    appliedCount,
    skippedCount,
  };
}

export async function runWithAdvisoryLock(
  client,
  { migrationsDir = DEFAULT_MIGRATIONS_DIR, log = console.log } = {},
) {
  await client.query("SET lock_timeout = '30s'");
  await client.query("SET statement_timeout = '10min'");
  await client.query("SET idle_in_transaction_session_timeout = '2min'");

  const lockResult = await client.query(
    'SELECT pg_try_advisory_lock(hashtext($1::text), hashtext($2::text)) AS acquired',
    [LOCK_NAMESPACE, LOCK_NAME],
  );
  if (lockResult.rows[0]?.acquired !== true) {
    throw new Error(
      'Another production migration session already holds the database lock',
    );
  }

  log('Acquired PostgreSQL advisory migration lock.');
  try {
    return await applyPendingMigrations(client, { migrationsDir, log });
  } finally {
    try {
      await client.query(
        'SELECT pg_advisory_unlock(hashtext($1::text), hashtext($2::text)) AS released',
        [LOCK_NAMESPACE, LOCK_NAME],
      );
      log('Released PostgreSQL advisory migration lock.');
    } catch {
      // Closing the client below also releases every session-level lock.
    }
  }
}

async function runSelfTest() {
  assert.throws(() => requireDatabaseUrl(''), /DATABASE_URL is required/);
  assert.throws(() => requireDatabaseUrl('https://example.test'), /scheme/);
  assert.equal(
    requireDatabaseUrl('postgresql://user:password@db.example.test/app'),
    'postgresql://user:password@db.example.test/app',
  );

  assert.deepEqual(
    versionSortMigrationFiles([
      '0001_second.sql',
      '001_first.sql',
      '044_short.sql',
      '0044_long.sql',
    ]),
    ['001_first.sql', '0001_second.sql', '0044_long.sql', '044_short.sql'],
  );

  const testDir = await mkdtemp(
    path.join(tmpdir(), 'creatorhub-migrations-self-test-'),
  );
  try {
    await writeFile(path.join(testDir, '001_ok.sql'), 'SELECT 1;');
    await writeFile(path.join(testDir, '002_fail.sql'), 'SELECT broken;');
    await writeFile(path.join(testDir, '003_never.sql'), 'SELECT 3;');

    const executed = [];
    const fakeClient = {
      async query(text, values) {
        executed.push({ text, values });
        if (text === 'SELECT filename FROM _migrations_applied') {
          return { rows: [] };
        }
        if (text === 'SELECT broken;') {
          const error = new Error('synthetic SQL failure');
          error.code = '42601';
          throw error;
        }
        return { rows: [] };
      },
    };

    await assert.rejects(
      applyPendingMigrations(fakeClient, {
        migrationsDir: testDir,
        log: () => undefined,
      }),
      /Migration 002_fail\.sql failed: 42601/,
    );
    assert.equal(
      executed.some((call) => call.text === 'SELECT 3;'),
      false,
      'runner must stop before the migration after a SQL failure',
    );
    assert.equal(
      executed.filter((call) =>
        String(call.text).startsWith('INSERT INTO _migrations_applied'),
      ).length,
      1,
      'only successful migrations may be tracked',
    );

    const lockClient = {
      async query(text) {
        if (String(text).startsWith('SELECT pg_try_advisory_lock')) {
          return { rows: [{ acquired: false }] };
        }
        return { rows: [] };
      },
    };
    await assert.rejects(
      runWithAdvisoryLock(lockClient, {
        migrationsDir: testDir,
        log: () => undefined,
      }),
      /already holds the database lock/,
    );
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }

  console.log('Production migration runner self-test passed.');
}

async function main() {
  if (process.argv.includes('--self-test')) {
    await runSelfTest();
    return;
  }

  const connectionString = requireDatabaseUrl();
  const { Client } = await import('pg');
  const client = new Client({
    connectionString,
    application_name: 'creatorhub-production-migrations',
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  });

  try {
    await client.connect();
    const result = await runWithAdvisoryLock(client);
    console.log(
      'Migration run complete: ' +
        result.appliedCount +
        ' applied, ' +
        result.skippedCount +
        ' skipped, ' +
        result.totalCount +
        ' total.',
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('Production migration failed: ' + safeErrorMessage(error));
  process.exitCode = 1;
});
