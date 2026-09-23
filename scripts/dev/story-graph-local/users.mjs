// Oppretter lokale QA-brukere (bcrypt), prosjekter og Studio-plan. Idempotent.
// Passord genereres første gang og lagres i <state>/users.json (utenfor repoet).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const out = process.argv[2];
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(path.join(repo, 'backend/package.json'));
const pg = require('pg');
const bcrypt = require('bcrypt');

const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
const USERS = ['qa-owner', 'qa-solo', 'qa-member'];
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const result = {};
for (const key of USERS) {
  const email = `${key}@story-graph.local`;
  const password = prev[key]?.password ?? crypto.randomBytes(9).toString('base64url');
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (email, username, first_name, role, password, created_at, updated_at)
       VALUES ($1, $2::text, $2::text, 'user', $3, now(), now())
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, updated_at = now()
     RETURNING id`,
    [email, key, hash],
  );
  result[key] = { email, password, id: String(rows[0].id) };
}
const owner = result['qa-owner'].id;
const solo = result['qa-solo'].id;
await pool.query(
  `INSERT INTO casting_projects (id, name, status, created_by, created_at, updated_at)
     VALUES ('what-follows-us-local', 'What Follows Us — lokal', 'active', $1, now(), now()),
            ('solo-tomt-prosjekt', 'Solo — tomt prosjekt', 'active', $2, now(), now())
   ON CONFLICT (id) DO NOTHING`,
  [owner, solo],
);
await pool.query(
  `INSERT INTO game_subscription (user_id, plan_slug, billing_period, status, notes)
     VALUES ($1, 'studio', 'comp', 'comp', 'lokal utvikling')
   ON CONFLICT (user_id) DO UPDATE SET plan_slug = 'studio', status = 'comp', billing_period = 'comp'`,
  [owner],
);
await pool.query(
  `INSERT INTO enterprise_team_members (organization_id, user_id, email, role, status, org_kind, invited_by, joined_at)
   SELECT $1::text, $2::text, $3::text, 'member', 'active', 'game_studio', $1::text, now()
    WHERE NOT EXISTS (SELECT 1 FROM enterprise_team_members WHERE organization_id = $1::text AND user_id = $2::text AND org_kind = 'game_studio')`,
  [owner, result['qa-member'].id, result['qa-member'].email],
);
fs.writeFileSync(out, JSON.stringify(result, null, 2), { mode: 0o600 });
console.log(`   ${USERS.length} brukere, 2 prosjekter, Studio-plan for qa-owner → ${out}`);
await pool.end();
