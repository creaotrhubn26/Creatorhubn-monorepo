import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
const DANIEL = '53391080-8437-471e-800b-8b0d01e8b465';

// Sjekk hvilke "project"-tabeller finnes med user_id og service_price
const ts = await pool.query(`
  SELECT table_schema, table_name FROM information_schema.tables
  WHERE table_name LIKE '%project%' AND table_schema NOT IN ('pg_catalog','information_schema')
  ORDER BY table_schema, table_name
`);
console.log('"project"-tabeller:');
for (const r of ts.rows) console.log(`  ${r.table_schema}.${r.table_name}`);

// Sjekk om legacy.projects har det vi trenger
const lc = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='legacy' AND table_name='projects' AND column_name IN ('user_id','title','client_id','service_price','vat_rate','client_name','invoice_provider')
`);
console.log('\nlegacy.projects kolonner som matcher invoice-query:');
for (const r of lc.rows) console.log(`  ${r.column_name}`);

// Telle rader i legacy.projects
const c = await pool.query(`SELECT COUNT(*) FROM legacy.projects`);
console.log(`\nlegacy.projects rad-count: ${c.rows[0].count}`);

// Hent daniels prosjekter fra legacy.projects
try {
  const r = await pool.query(`
    SELECT id, title, user_id, service_price, vat_rate, client_id, client_email, client_name,
           invoice_provider, external_invoice_id
    FROM legacy.projects
    WHERE user_id = $1 LIMIT 5
  `, [DANIEL]);
  console.log(`\nDaniel-prosjekter i legacy.projects: ${r.rows.length}`);
  for (const p of r.rows) {
    console.log(`  • ${p.id.slice(0,8)}… "${p.title}" — pris=${p.service_price || 'null'}, email=${p.client_email || 'null'}, name=${p.client_name || 'null'}, faktura=${p.invoice_provider || 'none'}`);
  }
} catch (e) { console.log('legacy.projects feil:', e.message); }
await pool.end();
