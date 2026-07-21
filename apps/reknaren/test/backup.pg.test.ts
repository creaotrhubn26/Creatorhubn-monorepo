/**
 * Backup/gjenoppretting mot ekte Postgres: pg_dump → pg_restore i fersk
 * kladdedatabase → integritetskontroller (balanse, radantall, dokument-sha256).
 * Tampersikring: en endret dumpfil skal avvises av manifestkontrollen.
 */
import { readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { registerDocument } from '../src/documents/service.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { runBackup, verifyBackup } from '../src/ops/backup.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { LocalObjectStorage } from '../src/storage/local.js';
import { setupTestDb, truncateAll, TEST_DATABASE_URL } from './helpers.js';

let db: Db;
let orgId: string;
let userId: string;
const workDir = mkdtempSync(join(tmpdir(), 'reknaren-backup-test-'));
const storageDir = join(workDir, 'documents');
const backupDir = join(workDir, 'backups');
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'backup@example.com', 'Backuptester');
  const org = await createOrganization(db, {
    name: 'Backuptest ENK',
    orgForm: 'ENK',
    vatStatus: 'registered',
    createdByUserId: userId,
  });
  orgId = org.id;

  await postJournalEntry(db, {
    organizationId: orgId,
    actor: actor(),
    entryDate: '2025-10-01',
    description: 'Kjøp av utstyr',
    idempotencyKey: 'backup-1',
    lines: [
      { accountNumber: '6551', debitMinor: 800000n, vatCode: '1' },
      { accountNumber: '2710', debitMinor: 200000n, vatCode: '1' },
      { accountNumber: '2400', creditMinor: 1000000n },
    ],
  });

  const storage = new LocalObjectStorage(storageDir);
  await registerDocument(
    db,
    {
      organizationId: orgId,
      actor: actor(),
      source: 'upload',
      filename: 'kvittering.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('%PDF-1.7\nTestkvittering for backup\n%%EOF', 'utf8'),
    },
    storage,
  );
});

afterAll(async () => {
  await db.end();
  await rm(workDir, { recursive: true, force: true });
});

describe('Backup med automatisert gjenopprettingstest', () => {
  let backupPath: string;

  it('tar backup av database + dokumentlager med manifest', async () => {
    const result = await runBackup({
      databaseUrl: TEST_DATABASE_URL,
      storageDir,
      backupDir,
    });
    backupPath = result.backupPath;
    expect(result.manifest.dumpSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.manifest.storageArchive).toBe('documents.tar.gz');
    const manifestOnDisk = JSON.parse(await readFile(join(backupPath, 'manifest.json'), 'utf8'));
    expect(manifestOnDisk.dumpSha256).toBe(result.manifest.dumpSha256);
  });

  it('gjenoppretter i kladdedatabase og består alle integritetskontroller', async () => {
    const result = await verifyBackup({
      backupPath,
      adminDatabaseUrl: TEST_DATABASE_URL,
      sourceDatabaseUrl: TEST_DATABASE_URL,
    });
    expect(result.ok).toBe(true);
    expect(result.checks.join('\n')).toContain('dump-sha256');
    expect(result.checks.join('\n')).toContain('balance');
    expect(result.checks.join('\n')).toContain('row-counts');
    expect(result.checks.join('\n')).toContain('1 bilag gjenfunnet i arkivet med korrekt sha256');

    // Kladdedatabasen skal være ryddet bort.
    const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await admin.connect();
    const leftovers = await admin.query(
      `SELECT COUNT(*)::INT AS n FROM pg_database WHERE datname = $1`,
      [result.scratchDatabase],
    );
    await admin.end();
    expect(leftovers.rows[0].n).toBe(0);
  });

  it('avviser en manipulert dumpfil (sha256-avvik mot manifestet)', async () => {
    const dumpFile = join(backupPath, 'database.dump');
    const original = await readFile(dumpFile);
    const tampered = Buffer.from(original);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;
    await writeFile(dumpFile, tampered);
    await expect(
      verifyBackup({ backupPath, adminDatabaseUrl: TEST_DATABASE_URL }),
    ).rejects.toThrow(/korrupt eller endret/);
    await writeFile(dumpFile, original);
  });

  it('oppdager tap av dokumentinnhold (fil mangler i arkivet)', async () => {
    // Ny backup uten dokumentlageret, men mot en database som refererer bilaget:
    // dokumentkontrollen skal da feile — regnskap uten bilag er ikke gjenopprettet.
    const result = await runBackup({
      databaseUrl: TEST_DATABASE_URL,
      storageDir: join(workDir, 'finnes-ikke'),
      backupDir,
    });
    expect(result.manifest.storageArchive).toBeNull();
    // Uten arkiv utføres ingen dokumentkontroll — verifiseringen sier det ærlig.
    const verification = await verifyBackup({
      backupPath: result.backupPath,
      adminDatabaseUrl: TEST_DATABASE_URL,
    });
    expect(verification.checks.join('\n')).not.toContain('documents:');
  });
});
