import pg from 'pg';
import fs from 'fs';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

// Sjekk pre-state
const preCheck = async () => {
  const clients = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clients'
      AND column_name IN ('customer_type','organization_number')
  `);
  const ints = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='photographer_integrations'
      AND column_name IN ('default_product_id','default_product_synced_at')
  `);
  return {
    clients: clients.rows.map(r => r.column_name),
    photographer_integrations: ints.rows.map(r => r.column_name),
  };
};

console.log('=== PRE-migrasjon state ===');
console.log(JSON.stringify(await preCheck(), null, 2));

// Les migrasjonen
const sql = fs.readFileSync('migrations/0093_poweroffice_customer_type_and_product.sql', 'utf-8');
console.log(`\n=== Kjører migrasjon 0093 (${sql.length} tegn) ===`);

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('✓ Migrasjon kjørt + commitet');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('✗ Migrasjon feilet, rolled back:', err.message);
  throw err;
} finally {
  client.release();
}

console.log('\n=== POST-migrasjon state ===');
console.log(JSON.stringify(await preCheck(), null, 2));

await pool.end();
