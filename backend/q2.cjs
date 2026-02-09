const pg = require('pg');
const p = new pg.Pool({connectionString: 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'});
async function main() {
  // Check the Daniel & Maria project
  const r1 = await p.query("SELECT id, name, client_email, user_id, status, wedding_date, venue FROM legacy.projects WHERE client_email = 'danielqazi89@gmail.com'");
  console.log('=== legacy.projects ===');
  r1.rows.forEach(x => console.log(JSON.stringify(x)));

  // Check wedding_projects 
  const r2 = await p.query("SELECT * FROM public.wedding_projects LIMIT 3");
  console.log('\n=== public.wedding_projects (sample) ===');
  console.log('columns:', Object.keys(r2.rows[0] || {}));
  r2.rows.forEach(x => console.log(JSON.stringify(x)));

  // Check if couple profile has wedding_date
  const r3 = await p.query("SELECT id, email, display_name, wedding_date FROM public.couple_profiles WHERE email = 'danielqazi89@gmail.com'");
  console.log('\n=== couple_profiles ===');
  r3.rows.forEach(x => console.log(JSON.stringify(x)));

  await p.end();
}
main();
