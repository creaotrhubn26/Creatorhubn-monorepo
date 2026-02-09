const pg = require('pg');
const p = new pg.Pool({connectionString: 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'});
async function main() {
  // Update couple_profiles with wedding date from the legacy project
  const r = await p.query(`
    UPDATE public.couple_profiles 
    SET wedding_date = '2025-08-15', 
        display_name = 'Daniel & Maria',
        updated_at = NOW()
    WHERE email = 'danielqazi89@gmail.com'
    RETURNING id, email, display_name, wedding_date
  `);
  console.log('Updated couple_profiles:', JSON.stringify(r.rows[0]));
  await p.end();
}
main();
