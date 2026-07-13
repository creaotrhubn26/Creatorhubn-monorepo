/**
 * Enkel, deterministisk SQL-migrasjonsrunner.
 * Kjører migrations/*.sql i sortert rekkefølge, hver i egen transaksjon,
 * og registrerer dem i _ledgerly_migrations. Kjørte migrasjoner endres aldri —
 * nye endringer får nye filer.
 */
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export async function runMigrations(databaseUrl: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _ledgerly_migrations (
        filename TEXT PRIMARY KEY,
        sha256 TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      const sha256 = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query(
        'SELECT sha256 FROM _ledgerly_migrations WHERE filename = $1',
        [file],
      );
      if (existing.rowCount) {
        if (existing.rows[0].sha256 !== sha256) {
          throw new Error(
            `Migrasjonen ${file} er endret etter at den ble kjørt. Kjørte migrasjoner er uforanderlige — lag en ny fil.`,
          );
        }
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _ledgerly_migrations (filename, sha256) VALUES ($1, $2)',
          [file, sha256],
        );
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migrasjonen ${file} feilet: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
  return applied;
}

// Kjørbar direkte: npm run migrate
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url =
    process.env.DATABASE_URL ?? 'postgres://ledgerly:ledgerly_dev@localhost:5432/ledgerly_dev';
  runMigrations(url)
    .then((applied) => {
      console.log(
        applied.length
          ? `Kjørte ${applied.length} migrasjon(er): ${applied.join(', ')}`
          : 'Ingen nye migrasjoner.',
      );
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
