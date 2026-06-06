import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

const cols = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='wedding_timelines'
  ORDER BY ordinal_position
`);
console.log('wedding_timelines-kolonner:');
for (const r of cols.rows) {
  if (/email|name|contact|client|couple|phone|user/i.test(r.column_name)) {
    console.log(`  ${r.column_name}`);
  }
}

// Sample-rad
const r = await pool.query(`SELECT * FROM wedding_timelines LIMIT 1`);
if (r.rows[0]) {
  console.log('\nSample rad (kontakt-felter):');
  for (const [k, v] of Object.entries(r.rows[0])) {
    if (/email|name|contact|client|couple|phone/i.test(k)) {
      const val = v == null ? 'null' : typeof v === 'string' ? `"${v.slice(0,40)}"` : v;
      console.log(`  ${k}: ${val}`);
    }
  }
}
await pool.end();
