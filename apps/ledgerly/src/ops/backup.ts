/**
 * Backup og gjenopprettingskontroll (bokføringsloven § 13b: regnskapsmateriale
 * skal sikres mot tap). En backup som aldri er testet gjenopprettet er ikke en
 * backup — derfor er verifiseringen del av rutinen, ikke et tillegg:
 *
 *  1. pg_dump (custom format) av databasen + tar.gz av dokumentlageret,
 *     med sha256 i et manifest.
 *  2. verifyBackup gjenoppretter dumpen i en FERSK kladdedatabase og kontrollerer:
 *     - manifestets sha256 stemmer (dumpen er ikke korrupt/endret)
 *     - migrasjonstabellen finnes og er ikke tom
 *     - hvert bilag balanserer (sum debet = sum kredit per postering)
 *     - radantall i kjernetabellene matcher kildedatabasen
 *     - hvert kildedokument i databasen finnes i dokumentlager-arkivet
 *       med korrekt sha256 (regnskap uten bilag er ikke gjenopprettet)
 *     Kladdedatabasen slettes etterpå.
 */
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import { LocalObjectStorage } from '../storage/local.js';

const run = promisify(execFile);

function sha256OfBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

async function sha256OfFile(path: string): Promise<string> {
  return sha256OfBuffer(await readFile(path));
}

export interface BackupManifest {
  createdAt: string;
  dumpFile: string;
  dumpSha256: string;
  storageArchive: string | null;
  storageArchiveSha256: string | null;
  pgDumpVersion: string;
}

export interface BackupResult {
  backupPath: string;
  manifest: BackupManifest;
}

export interface BackupOptions {
  databaseUrl: string;
  /** Dokumentlagerkatalog (LocalObjectStorage). Utelatt = kun database. */
  storageDir?: string;
  /** Rotkatalog for backuper; hver backup får egen underkatalog. */
  backupDir: string;
}

export async function runBackup(opts: BackupOptions): Promise<BackupResult> {
  const label = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(opts.backupDir, label);
  await mkdir(backupPath, { recursive: true });

  const dumpFile = join(backupPath, 'database.dump');
  await run('pg_dump', ['--dbname', opts.databaseUrl, '--format', 'custom', '--no-owner', '--file', dumpFile]);
  const { stdout: versionOut } = await run('pg_dump', ['--version']);

  let storageArchive: string | null = null;
  let storageArchiveSha256: string | null = null;
  if (opts.storageDir && existsSync(opts.storageDir)) {
    storageArchive = join(backupPath, 'documents.tar.gz');
    await run('tar', ['-czf', storageArchive, '-C', opts.storageDir, '.']);
    storageArchiveSha256 = await sha256OfFile(storageArchive);
  }

  const manifest: BackupManifest = {
    createdAt: new Date().toISOString(),
    dumpFile: 'database.dump',
    dumpSha256: await sha256OfFile(dumpFile),
    storageArchive: storageArchive ? 'documents.tar.gz' : null,
    storageArchiveSha256,
    pgDumpVersion: versionOut.trim(),
  };
  await writeFile(join(backupPath, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return { backupPath, manifest };
}

export interface VerifyOptions {
  backupPath: string;
  /**
   * Tilkobling som kan opprette/slette kladdedatabasen (CREATEDB-rettighet).
   * Kladden får navnet ledgerly_restore_verify_<tilfeldig>.
   */
  adminDatabaseUrl: string;
  /** Når satt: sammenlign radantall i kjernetabellene mot kilden. */
  sourceDatabaseUrl?: string;
}

export interface VerifyResult {
  ok: boolean;
  /** Utførte kontroller, i rekkefølge — for logg og revisjon. */
  checks: string[];
  scratchDatabase: string;
}

const CORE_TABLES = [
  'organizations',
  'journal_entries',
  'journal_lines',
  'source_documents',
  'invoices',
  'invoice_lines',
  'audit_events',
] as const;

class VerifyError extends Error {}

export async function verifyBackup(opts: VerifyOptions): Promise<VerifyResult> {
  const checks: string[] = [];
  const manifest = JSON.parse(
    await readFile(join(opts.backupPath, 'manifest.json'), 'utf8'),
  ) as BackupManifest;

  // 1. Integritet: dumpen på disk er identisk med det som ble tatt backup av.
  const dumpFile = join(opts.backupPath, manifest.dumpFile);
  const actualSha = await sha256OfFile(dumpFile);
  if (actualSha !== manifest.dumpSha256) {
    throw new VerifyError(
      `Dumpfilen er korrupt eller endret: sha256 ${actualSha} != manifest ${manifest.dumpSha256}.`,
    );
  }
  checks.push('dump-sha256: dumpfilen matcher manifestet');

  if (manifest.storageArchive) {
    const archiveSha = await sha256OfFile(join(opts.backupPath, manifest.storageArchive));
    if (archiveSha !== manifest.storageArchiveSha256) {
      throw new VerifyError('Dokumentarkivet er korrupt eller endret (sha256-avvik).');
    }
    checks.push('storage-sha256: dokumentarkivet matcher manifestet');
  }

  // 2. Gjenopprett i fersk kladdedatabase.
  const scratchName = `ledgerly_restore_verify_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: opts.adminDatabaseUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${scratchName}`);
  const scratchUrl = new URL(opts.adminDatabaseUrl);
  scratchUrl.pathname = `/${scratchName}`;

  let extractedStorage: string | null = null;
  try {
    await run('pg_restore', ['--dbname', scratchUrl.toString(), '--no-owner', dumpFile]);
    checks.push(`pg_restore: gjenopprettet i kladdedatabasen ${scratchName}`);

    const scratch = new pg.Client({ connectionString: scratchUrl.toString() });
    await scratch.connect();
    try {
      // 3. Migrasjonshistorikken fulgte med.
      const migrations = await scratch.query(`SELECT COUNT(*)::INT AS n FROM _ledgerly_migrations`);
      if (migrations.rows[0].n < 1) throw new VerifyError('Migrasjonstabellen er tom etter gjenoppretting.');
      checks.push(`migrations: ${migrations.rows[0].n} migrasjoner til stede`);

      // 4. Hvert bilag balanserer i den gjenopprettede hovedboken.
      const unbalanced = await scratch.query(
        `SELECT COUNT(*)::INT AS n FROM (
           SELECT entry_id FROM journal_lines
           GROUP BY entry_id
           HAVING SUM(debit_minor) <> SUM(credit_minor)
         ) x`,
      );
      if (unbalanced.rows[0].n > 0) {
        throw new VerifyError(`${unbalanced.rows[0].n} posteringer balanserer ikke etter gjenoppretting.`);
      }
      const entryCount = await scratch.query(`SELECT COUNT(*)::INT AS n FROM journal_entries`);
      checks.push(`balance: alle ${entryCount.rows[0].n} posteringer balanserer (debet = kredit)`);

      // 5. Radantall matcher kilden.
      if (opts.sourceDatabaseUrl) {
        const source = new pg.Client({ connectionString: opts.sourceDatabaseUrl });
        await source.connect();
        try {
          for (const table of CORE_TABLES) {
            const [a, b] = await Promise.all([
              source.query(`SELECT COUNT(*)::INT AS n FROM ${table}`),
              scratch.query(`SELECT COUNT(*)::INT AS n FROM ${table}`),
            ]);
            if (a.rows[0].n !== b.rows[0].n) {
              throw new VerifyError(
                `Radantall avviker i ${table}: kilde ${a.rows[0].n}, gjenopprettet ${b.rows[0].n}.`,
              );
            }
          }
          checks.push(`row-counts: ${CORE_TABLES.length} kjernetabeller matcher kilden`);
        } finally {
          await source.end();
        }
      }

      // 6. Hvert kildedokument finnes i arkivet med korrekt innhold.
      if (manifest.storageArchive) {
        extractedStorage = await mkdtemp(join(tmpdir(), 'ledgerly-restore-verify-'));
        await run('tar', ['-xzf', join(opts.backupPath, manifest.storageArchive), '-C', extractedStorage]);
        const restoredStorage = new LocalObjectStorage(extractedStorage);
        const docs = await scratch.query(`SELECT id, storage_key, sha256 FROM source_documents`);
        const missing: string[] = [];
        const corrupt: string[] = [];
        for (const doc of docs.rows) {
          const obj = await restoredStorage.get(doc.storage_key);
          if (!obj) missing.push(doc.id);
          else if (sha256OfBuffer(obj.content) !== doc.sha256) corrupt.push(doc.id);
        }
        if (missing.length || corrupt.length) {
          throw new VerifyError(
            `Dokumentkontrollen feilet: ${missing.length} bilag mangler i arkivet` +
              `${corrupt.length ? `, ${corrupt.length} har feil innhold (sha256-avvik)` : ''}. ` +
              `Første: ${[...missing, ...corrupt].slice(0, 5).join(', ')}. ` +
              `Regnskap uten bilag er ikke gjenopprettet — undersøk dokumentlageret før backupen stoles på.`,
          );
        }
        checks.push(`documents: ${docs.rows.length} bilag gjenfunnet i arkivet med korrekt sha256`);
      }
    } finally {
      await scratch.end();
    }
  } finally {
    if (extractedStorage) await rm(extractedStorage, { recursive: true, force: true });
    await admin.query(`DROP DATABASE IF EXISTS ${scratchName} WITH (FORCE)`);
    await admin.end();
  }

  return { ok: true, checks, scratchDatabase: scratchName };
}
