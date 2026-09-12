import pg from 'pg';
import fs from 'fs';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = fs.readFileSync('migrations/0402_leadgrid_dorsalg_maal.sql', 'utf-8');
console.log(`=== Kjører mig 0402 (${sql.length} tegn) ===`);
const client = await pool.connect();
try {
  await client.query(sql);
  console.log('✓ Migrasjon kjørt (BEGIN/COMMIT i SQL)');
  const cols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leadgrid_dorsalg_maal'
    ORDER BY ordinal_position`);
  console.log('POST-state leadgrid_dorsalg_maal:');
  console.log(JSON.stringify(cols.rows, null, 2));
} catch (err) {
  console.error('✗ FEIL:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
