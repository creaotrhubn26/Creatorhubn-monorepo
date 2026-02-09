const pg = require('pg');
const p = new pg.Pool({connectionString: 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'});
async function main() {
  const r1 = await p.query("SELECT * FROM legacy.projects WHERE client_email = 'danielqazi89@gmail.com'");
  console.log('=== legacy.projects ===');
  if (r1.rows.length) console.log('columns:', Object.keys(r1.rows[0]).join(', '));
  r1.rows.forEach(x => console.log(JSON.stringify(x)));

  const r3 = await p.query("SELECT * FROM public.couple_profiles WHERE email = 'danielqazi89@gmail.com'");
  console.log('\n=== couple_profiles ===');
  r3.rows.forEach(x => { delete x.password; console.log(JSON.stringify(x)); });

  // Check what columns wedding_projects has
  const r4 = await p.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='wedding_projects' ORDER BY ordinal_position");
  console.log('\n=== wedding_projects columns ===');
  console.log(r4.rows.map(x=>x.column_name).join(', '));

  const r5 = await p.query("SELECT * FROM public.wedding_projects WHERE couple_id = $1 OR couple_email = $2", [r3.rows[0]?.id, 'danielqazi89@gmail.com']).catch(()=>({rows:[]}));
  console.log('\n=== wedding_projects for daniel ===');
  r5.rows.forEach(x => console.log(JSON.stringify(x)));

  await p.end();
}
main();
