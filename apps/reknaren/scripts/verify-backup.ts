/**
 * Verifiser en eksisterende backup ved å gjenopprette den i en kladdedatabase.
 *
 *   npm run backup:verify -- ./backups/2026-07-13T...
 *
 * Miljø: DATABASE_URL (brukes til å opprette/slette kladdedatabasen og som
 * sammenligningskilde for radantall).
 */
import { loadConfig } from '../src/config.js';
import { verifyBackup } from '../src/ops/backup.js';

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('Bruk: npm run backup:verify -- <backup-katalog>');
  process.exit(2);
}

const config = loadConfig();
const result = await verifyBackup({
  backupPath,
  adminDatabaseUrl: config.databaseUrl,
  sourceDatabaseUrl: config.databaseUrl,
});
console.log('Gjenopprettingstest OK:');
for (const check of result.checks) console.log(`  ✓ ${check}`);
