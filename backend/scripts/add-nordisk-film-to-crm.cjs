#!/usr/bin/env node
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected.');

  const userR = await client.query(`SELECT id, email FROM users WHERE email = 'daniel@creatorhubn.com' LIMIT 1`);
  if (userR.rowCount === 0) { console.error('User not found'); process.exit(1); }
  const userId = userR.rows[0].id;
  console.log(`Daniel's user_id: ${userId}`);

  const existsR = await client.query(
    `SELECT id, full_name, tier, status FROM role_room_industry_targets
     WHERE user_id = $1 AND (full_name ILIKE '%nordisk film%' OR company ILIKE '%nordisk film%')`,
    [userId],
  );
  if (existsR.rowCount > 0) {
    console.log('Nordisk Film already in CRM:');
    for (const row of existsR.rows) {
      console.log(`  - id=${row.id}, name=${row.full_name}, tier=${row.tier}, status=${row.status}`);
    }
    await client.end();
    return;
  }

  const insR = await client.query(
    `INSERT INTO role_room_industry_targets
       (user_id, full_name, role_title, company, segment, tier, status,
        linkedin_url, instagram_handle, notes,
        next_action, tags, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb)
     RETURNING id, full_name, tier, status, tags`,
    [
      userId,
      'Nordisk Film',
      'Produksjonsselskap',
      'Nordisk Film',
      'producer',
      'T1',
      'cold',
      'https://www.linkedin.com/company/nordisk-film/',
      '@nordiskfilm',
      'Mulig samarbeidspartner i fremtiden. MÅL: Nordisk Film skal anbefale The Role Room til norske produksjoner. STRATEGI: (1) bygge troverdighet via casting-håndverk-innhold + (2) tilby pilot på 1-2 av deres produksjoner. Norges største produksjonsselskap — hvis de bruker RR, etableres kategorien.',
      'Kartlegg riktig kontaktperson (Head of Production / Innovation Lead) + first-touch via LinkedIn',
      JSON.stringify(['future-partner', 'enterprise', 'norsk', 'tier-1', 'recommendation-target']),
      JSON.stringify({ size: 'enterprise', country: 'NO', industry: 'film-production', priority_2026: 'recommend-roleroom' }),
    ],
  );
  console.log('✓ Inserted Nordisk Film:');
  console.log('  ', insR.rows[0]);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
