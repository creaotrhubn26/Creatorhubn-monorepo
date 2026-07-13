/**
 * Kjør backup av database + dokumentlager, og verifiser gjenoppretting.
 *
 *   npm run backup            — backup + automatisk gjenopprettingstest
 *   npm run backup -- --skip-verify   — kun backup (frarådes)
 *
 * Miljø: DATABASE_URL, LEDGERLY_STORAGE_DIR (default ./data/documents),
 * LEDGERLY_BACKUP_DIR (default ./backups).
 */
import { loadConfig } from '../src/config.js';
import { runBackup, verifyBackup } from '../src/ops/backup.js';

const config = loadConfig();
const backupDir = process.env.LEDGERLY_BACKUP_DIR ?? './backups';
const skipVerify = process.argv.includes('--skip-verify');

const result = await runBackup({
  databaseUrl: config.databaseUrl,
  storageDir: config.storageDir,
  backupDir,
});
console.log(`Backup skrevet til ${result.backupPath}`);
console.log(`  database.dump  sha256 ${result.manifest.dumpSha256}`);
if (result.manifest.storageArchive) {
  console.log(`  documents.tar.gz sha256 ${result.manifest.storageArchiveSha256}`);
}

if (skipVerify) {
  console.log('ADVARSEL: gjenopprettingstest hoppet over (--skip-verify). En utestet backup er ikke en backup.');
  process.exit(0);
}

const verification = await verifyBackup({
  backupPath: result.backupPath,
  adminDatabaseUrl: config.databaseUrl,
  sourceDatabaseUrl: config.databaseUrl,
});
console.log('Gjenopprettingstest OK:');
for (const check of verification.checks) console.log(`  ✓ ${check}`);
