import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

// 1. Les den lagrede ClientKey fra DB
const r = await pool.query(`
  SELECT photographer_id, provider, status, client_key, label,
         last_verified_at, last_used_at
  FROM photographer_integrations
  WHERE photographer_id = '53391080-8437-471e-800b-8b0d01e8b465' AND provider = 'poweroffice'
`);
const row = r.rows[0];
if (!row) { console.error('Ingen rad funnet'); process.exit(1); }
console.log('=== DB-rad i photographer_integrations ===');
console.log(`  photographer_id: ${row.photographer_id.slice(0,8)}…`);
console.log(`  provider:        ${row.provider}`);
console.log(`  status:          ${row.status}`);
console.log(`  client_key:      ${row.client_key.slice(0,12)}…${row.client_key.slice(-4)} (len=${row.client_key.length})`);
console.log(`  last_verified:   ${row.last_verified_at}`);
console.log(`  matches input:   ${row.client_key === '452a2ece-ad21-4960-8a7b-a069791bb624' ? 'YES ✓' : 'NO — mismatch!'}`);

// 2. Gjør en LIVE token-exchange med den lagrede ClientKey
const APPKEY = 'ba291105-ab98-4335-af37-c943cbdf9bc7';
const SUBKEY = '7842d73358244eaa8cf1bd477a8cb009';
const basic = Buffer.from(`${APPKEY}:${row.client_key}`).toString('base64');

const tokenRes = await fetch('https://goapi.poweroffice.net/Demo/OAuth/Token', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${basic}`,
    'Ocp-Apim-Subscription-Key': SUBKEY,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
});
const tokenBody = await tokenRes.json();
console.log('\n=== Live token-exchange mot PO Demo ===');
console.log(`  HTTP: ${tokenRes.status}`);
if (tokenRes.status === 200) {
  console.log(`  access_token: ${(tokenBody.access_token || '').slice(0, 20)}… (len=${(tokenBody.access_token || '').length})`);
  console.log(`  expires_in:   ${tokenBody.expires_in}s`);

  // 3. Gjør en faktisk API-spørring mot PO med tokenet
  const apiRes = await fetch('https://goapi.poweroffice.net/demo/v2/Customers?PageSize=1', {
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`,
      'Ocp-Apim-Subscription-Key': SUBKEY,
      Accept: 'application/json',
    },
  });
  const apiBody = await apiRes.json();
  console.log('\n=== Live API-kall: GET /Customers?PageSize=1 ===');
  console.log(`  HTTP: ${apiRes.status}`);
  if (apiRes.status === 200) {
    const arr = Array.isArray(apiBody) ? apiBody : (apiBody.items || []);
    console.log(`  Kunder mottatt: ${arr.length}`);
    if (arr[0]) console.log(`  Første kunde: Id=${arr[0].Id}, Name=${arr[0].Name || (arr[0].FirstName + ' ' + arr[0].LastName)}`);
    console.log('\n✅ INTEGRASJONEN ER FAKTISK TILKOBLET — full tokenexchange + API-kall mot LIVE PO Demo bekreftet.');
  } else {
    console.log(`  Body: ${JSON.stringify(apiBody).slice(0, 300)}`);
  }
} else {
  console.log(`  Feilrespons: ${JSON.stringify(tokenBody)}`);
  console.log('\n❌ Token-exchange feilet — ClientKey er ikke (lenger) gyldig.');
}

await pool.end();
