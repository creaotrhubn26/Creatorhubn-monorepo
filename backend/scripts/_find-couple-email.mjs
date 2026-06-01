import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

// Sjekk wedding_timelines.id-format og hvilke tabeller har FK til den
const fks = await pool.query(`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema='public' AND (column_name LIKE '%wedding_id%' OR column_name LIKE '%couple_id%')
  ORDER BY table_name
`);
const candidates = new Set();
for (const r of fks.rows) candidates.add(r.table_name);
console.log('Tabeller med wedding_id/couple_id:', [...candidates].length);

// Sjekk couple_profiles + wedding_details for FK + email
for (const table of ['couple_profiles', 'wedding_details', 'wedding_contacts']) {
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1
  `, [table]);
  console.log(`\n${table}:`);
  console.log(`  alle kolonner: ${cols.rows.map(c => c.column_name).join(', ')}`);
  // Test join
  try {
    const r = await pool.query(`
      SELECT t.couple_name, p.* FROM wedding_timelines t
      LEFT JOIN ${table} p ON p.couple_id = t.id OR p.wedding_id = t.id
      WHERE t.couple_name = 'Daniel & Maria' LIMIT 1
    `);
    if (r.rows[0]) console.log(`  Sample join: ${JSON.stringify(r.rows[0], null, 2).slice(0,300)}`);
  } catch (e) {
    // Prøv kun couple_id
    try {
      const r = await pool.query(`SELECT * FROM ${table} LIMIT 1`);
      console.log(`  Sample row keys: ${Object.keys(r.rows[0] || {}).slice(0,15).join(', ')}`);
    } catch {}
  }
}
await pool.end();
