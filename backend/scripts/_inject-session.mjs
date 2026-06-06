import pg from 'pg';
import crypto from 'crypto';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

const cmd = process.argv[2];

async function findUser() {
  const r = await pool.query(`SELECT id, email, first_name, last_name, role FROM users WHERE email = 'daniel@creatorhubn.com' LIMIT 1`);
  return r.rows[0];
}

async function injectSession(user) {
  const token = 'chub-pw-test-' + crypto.randomBytes(16).toString('hex');
  const session = {
    userId: user.id,
    email: user.email,
    name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email,
    role: user.role || 'admin',
    loginAt: new Date().toISOString(),
  };
  await pool.query(`
    INSERT INTO creatorhub_auth_sessions (token, session_data, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (token) DO UPDATE SET session_data = EXCLUDED.session_data, updated_at = NOW()
  `, [token, JSON.stringify(session)]);
  return { token, session };
}

if (cmd === 'find') {
  const u = await findUser();
  console.log(JSON.stringify(u, null, 2));
} else if (cmd === 'inject') {
  const u = await findUser();
  if (!u) { console.error('User not found'); process.exit(1); }
  const result = await injectSession(u);
  console.log(JSON.stringify(result));
}
await pool.end();
