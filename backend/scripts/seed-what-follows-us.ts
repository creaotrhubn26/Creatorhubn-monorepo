/**
 * Seed «What Follows Us — Episode One: The Seeker» inn i et Story Graph-prosjekt.
 *
 *   DATABASE_URL=… npx tsx scripts/seed-what-follows-us.ts --project <casting_projects.id> [--user <userId>] [--fixture what-follows-us]
 *
 * Idempotent: andre kjøring rapporterer 0 innsatte (bare oppdaterte). Kjører i én
 * transaksjon gjennom service-laget så CHECK-er og hash gjelder.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { StoryGraphFixture } from '../../frontend/shared/narrative-fixtures/types.ts';
import { seedStoryGraphFixture, summarizeSeedReport } from '../server/narrative-fixture-seed.ts';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
  const projectId = arg('project');
  if (!projectId) { console.error('Bruk: --project <casting_projects.id> [--user <userId>] [--fixture <slug>]'); process.exit(2); }
  const slug = arg('fixture', 'what-follows-us')!;
  if (!/^[a-z0-9-]+$/.test(slug)) { console.error('Ugyldig fixture-slug.'); process.exit(2); }
  const here = dirname(fileURLToPath(import.meta.url));
  const fixturePath = resolve(here, '..', '..', 'frontend', 'shared', 'narrative-fixtures', `${slug}.json`);
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as StoryGraphFixture;
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL mangler.'); process.exit(2); }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT id, created_by FROM casting_projects WHERE id = $1', [projectId]);
    if (!rows[0]) { console.error(`Prosjekt ${projectId} finnes ikke.`); process.exit(1); }
    const userId = arg('user') ?? String(rows[0].created_by ?? 'seed');
    await client.query('BEGIN');
    const report = await seedStoryGraphFixture(client, projectId, userId, fixture);
    await client.query('COMMIT');
    console.log(`Seed «${fixture.meta.title}» → ${projectId}\n${summarizeSeedReport(report)}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
