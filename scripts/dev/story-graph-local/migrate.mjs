// Lokal migrasjonsrunner for Story Graph-utvikling (IKKE prod).
//
// Prod-runneren (backend/scripts/run-production-migrations.mjs) krever TLS,
// channel_binding og eksakte roller, så den kan ikke brukes mot en lokal
// Postgres. Denne kjører alle backend/migrations/*.sql i samme rekkefølge
// (versionSortMigrationFiles), hver i egen transaksjon, og gjentar de som
// feilet så lenge noen nye lykkes (avhengigheter i feil rekkefølge).
// Filer som fortsatt feiler gjelder andre produkter (Leadgrid m.fl.) som
// mangler Drizzle-tabeller lokalt — de listes, men stopper ikke.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const require = createRequire(path.join(repo, 'backend/package.json'));
const pg = require('pg');
const { versionSortMigrationFiles } = await import(path.join(repo, 'backend/scripts/run-production-migrations.mjs'));

const dir = path.join(repo, 'backend/migrations');
let pending = versionSortMigrationFiles(fs.readdirSync(dir).filter((f) => f.endsWith('.sql')));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
let pass = 0; let applied = 0; let failed = [];
while (pending.length) {
  pass += 1; failed = [];
  let progress = 0;
  for (const f of pending) {
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('COMMIT');
      progress += 1;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      failed.push({ f, msg: String(e.message).split('\n')[0].slice(0, 160) });
    }
  }
  applied += progress;
  console.log(`pass ${pass}: ${progress} ok, ${failed.length} feilet`);
  if (!progress) break;
  pending = failed.map((x) => x.f);
}
const storyGraph = failed.filter((x) => /narrative|game_/i.test(x.f));
console.log(`ferdig: ${applied} anvendt, ${failed.length} feilet (${storyGraph.length} Story Graph-relevante)`);
for (const x of storyGraph) console.log(`  ! ${x.f}: ${x.msg}`);
if (process.env.MIGRATE_REPORT) fs.writeFileSync(process.env.MIGRATE_REPORT, JSON.stringify(failed, null, 2));
client.release(); await pool.end();
process.exit(storyGraph.length ? 1 : 0);
