#!/usr/bin/env node
/**
 * Create (or update) a throwaway admin account for Meta App Review.
 *
 * Usage:
 *   DATABASE_URL='postgres://...' node backend/scripts/create-reviewer-admin.mjs <email> <password>
 *
 * Hashes the password with bcrypt (matches the /api/auth/login path),
 * upserts the row into the `users` table with role=admin so the
 * reviewer can reach The Role Room Agent, and prints the credentials
 * ready to paste into the App Review form.
 *
 * Get DATABASE_URL from Render dashboard → creatorhub-backend-rtbl →
 * Environment → DATABASE_URL. Internal URL works from Render shell;
 * external URL works from your laptop.
 */

import pg from 'pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: DATABASE_URL=... node backend/scripts/create-reviewer-admin.mjs <email> <password>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Copy it from Render → Environment.');
  process.exit(1);
}

const normalized = email.toLowerCase().trim();
const username = normalized
  .split('@')[0]
  .toLowerCase()
  .replace(/[^a-z0-9._-]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 64);
const firstName = username.slice(0, 64) || 'Reviewer';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

(async () => {
  try {
    const hash = await bcrypt.hash(password, 10);
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO users (id, email, username, first_name, role, password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'admin', $5, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
       SET password = EXCLUDED.password,
           role = 'admin',
           username = COALESCE(NULLIF(users.username, ''), EXCLUDED.username),
           first_name = COALESCE(NULLIF(users.first_name, ''), EXCLUDED.first_name),
           updated_at = NOW()
       RETURNING id, email, role, created_at, updated_at`,
      [id, normalized, username, firstName, hash],
    );
    const row = result.rows[0];
    console.log('✓ Reviewer account ready');
    console.log(`  id:       ${row.id}`);
    console.log(`  email:    ${row.email}`);
    console.log(`  role:     ${row.role}`);
    console.log(`  password: ${password}`);
    console.log('');
    console.log('Paste into Meta App Review form (Temporary username / password fields).');
    console.log('Reviewer logs in at https://theroleroom.com with those credentials.');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
})();
