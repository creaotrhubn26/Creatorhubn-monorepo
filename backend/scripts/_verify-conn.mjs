import pg from 'pg';

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const DATABASE_URL = requireEnv("DATABASE_URL");
const PHOTOGRAPHER_ID = requireEnv("POWEROFFICE_VERIFY_PHOTOGRAPHER_ID");
const APPKEY = requireEnv("POWEROFFICE_APPLICATION_KEY");
const SUBKEY = requireEnv("POWEROFFICE_SUBSCRIPTION_KEY");

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 1. Les den lagrede ClientKey fra DB
const r = await pool.query(`
  SELECT photographer_id, provider, status, client_key, label,
         last_verified_at, last_used_at
  FROM photographer_integrations
  WHERE photographer_id = $1 AND provider = 'poweroffice'
`, [PHOTOGRAPHER_ID]);
const row = r.rows[0];
if (!row) { console.error('Ingen rad funnet'); process.exit(1); }
console.log('=== DB-rad i photographer_integrations ===');
console.log(`  photographer_id: ${row.photographer_id.slice(0,8)}…`);
console.log(`  provider:        ${row.provider}`);
console.log(`  status:          ${row.status}`);
console.log(`  client_key:      present (len=${row.client_key.length})`);
console.log(`  last_verified:   ${row.last_verified_at}`);

// 2. Gjør en LIVE token-exchange med den lagrede ClientKey
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
  console.log(`  access_token: received (len=${(tokenBody.access_token || '').length})`);
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
