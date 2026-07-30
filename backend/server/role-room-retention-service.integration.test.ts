/**
 * Integrasjonstest for retention-feiingen mot en ekte Postgres.
 *
 * Hoppes over med mindre RR_TEST_DATABASE_URL peker på en database det er
 * greit å opprette og droppe tabeller i. Enhetstestene i
 * role-room-retention-service.test.ts dekker den rene logikken; denne
 * verifiserer at SQL-en faktisk kjører og at garantiene holder mot data:
 * tørrkjøring endrer ingenting, juridisk hold respekteres, og en
 * anonymisert rad tas ikke om igjen.
 *
 *   createdb rrtest
 *   RR_TEST_DATABASE_URL=postgres://…/rrtest npx vitest run \
 *     server/role-room-retention-service.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import { runRetentionSweep } from "./role-room-retention-service.js";

const DB_URL = process.env.RR_TEST_DATABASE_URL;

const PREREQ_SQL = `
DROP TABLE IF EXISTS role_room_retention_deletions, role_room_retention_policies,
  role_room_user_files, talent_selftape_submissions, casting_consents,
  casting_candidates, casting_projects CASCADE;

CREATE TABLE casting_projects (
  id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, status VARCHAR(50) DEFAULT 'active',
  project_type VARCHAR(100), start_date date, end_date date,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE casting_candidates (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, email VARCHAR(255), phone VARCHAR(50), agency VARCHAR(255),
  photos JSONB DEFAULT '[]', videos JSONB DEFAULT '[]', notes TEXT, status VARCHAR(50) DEFAULT 'pending',
  assigned_roles JSONB DEFAULT '[]', rating INTEGER, metadata JSONB DEFAULT '{}',
  emergency_contact JSONB DEFAULT '{}', consent_status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE TABLE casting_consents (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  candidate_id VARCHAR(255) NOT NULL, type VARCHAR(50), status VARCHAR(50) DEFAULT 'pending',
  expires_at TIMESTAMPTZ, signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE TABLE talent_selftape_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(40) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'draft',
  private_token VARCHAR(64), private_expires_at TIMESTAMPTZ, private_password_hash TEXT,
  casting_project_id VARCHAR(255), casting_role_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE role_room_user_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR(255) NOT NULL,
  b2_key TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, size_bytes BIGINT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
);
`;

const TEST_ENV = {
  B2_PUBLIC_BASE: "https://media.theroleroom.com",
  B2_ROLE_ROOM_BUCKET_NAME: "roleroom-test",
} as unknown as NodeJS.ProcessEnv;

const MEDIA = ["https://media.theroleroom.com/users/u1/a.jpg", "https://vimeo.com/ekstern"];

describe.skipIf(!DB_URL)("retention-feiing mot ekte database", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB_URL });
    await pool.query(PREREQ_SQL);
    const migration = readFileSync(
      join(__dirname, "..", "migrations", "0443_role_room_gdpr_retention.sql"),
      "utf8",
    );
    await pool.query(migration);
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query(
      `TRUNCATE casting_projects, casting_candidates, casting_consents,
                talent_selftape_submissions, role_room_user_files,
                role_room_retention_deletions CASCADE`,
    );
    await pool.query(
      `INSERT INTO role_room_user_files (user_id, b2_key, display_name, size_bytes)
       VALUES ('u1', 'users/u1/a.jpg', 'a.jpg', 100)`,
    );
  });

  async function seedExpiredConsent(opts: { hold?: boolean } = {}) {
    await pool.query(
      `INSERT INTO casting_projects (id, name, status, retention_hold)
       VALUES ('p1', 'Test', 'active', $1)`,
      [opts.hold ?? false],
    );
    await pool.query(
      `INSERT INTO casting_candidates (id, project_id, name, email, photos, videos)
       VALUES ('c1', 'p1', 'Kari Nordmann', 'kari@example.com', $1::jsonb, '[]'::jsonb)`,
      [JSON.stringify(MEDIA)],
    );
    // Samtykket utløp for 60 dager siden — godt forbi 30-dagersfristen.
    await pool.query(
      `INSERT INTO casting_consents (id, project_id, candidate_id, expires_at)
       VALUES ('k1', 'p1', 'c1', NOW() - INTERVAL '60 days')`,
    );
  }

  it("tørrkjøring rapporterer treff uten å endre data", async () => {
    await seedExpiredConsent();

    const result = await runRetentionSweep(pool, {
      categories: ["expired_consent_media"],
      env: TEST_ENV,
    });

    const cat = result.categories[0];
    expect(result.dryRun).toBe(true);
    expect(cat.candidatesFound).toBe(1);
    expect(cat.rowsAffected).toBe(1);

    // Ingenting skal være rørt.
    const row = await pool.query(`SELECT photos, email FROM casting_candidates WHERE id = 'c1'`);
    expect(row.rows[0].photos).toHaveLength(2);
    expect(row.rows[0].email).toBe("kari@example.com");
    const audit = await pool.query(`SELECT count(*)::int n FROM role_room_retention_deletions`);
    expect(audit.rows[0].n).toBe(0);
  });

  it("fjerner media, markerer B2-filen og skriver revisjonsspor ved enforce", async () => {
    await seedExpiredConsent();

    const result = await runRetentionSweep(pool, {
      categories: ["expired_consent_media"],
      enforce: true,
      env: TEST_ENV,
    });

    const cat = result.categories[0];
    expect(cat.rowsAffected).toBe(1);
    expect(cat.filesMarkedForDeletion).toBe(1); // kun vår egen fil
    expect(cat.externalMediaRefs).toBe(1); // vimeo-lenken

    const row = await pool.query(`SELECT photos, email FROM casting_candidates WHERE id = 'c1'`);
    expect(row.rows[0].photos).toEqual([]);
    // Media-kategorien rører ikke personopplysninger.
    expect(row.rows[0].email).toBe("kari@example.com");

    // B2-objektet er overlatt til storage-cleanup-workeren.
    const file = await pool.query(`SELECT deleted_at FROM role_room_user_files WHERE b2_key = 'users/u1/a.jpg'`);
    expect(file.rows[0].deleted_at).not.toBeNull();

    const audit = await pool.query(
      `SELECT category, action, reason, media_objects_deleted, media_external_refs
         FROM role_room_retention_deletions`,
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      category: "expired_consent_media",
      action: "media_purged",
      reason: "consent_expired",
      media_objects_deleted: 1,
      media_external_refs: 1,
    });
  });

  it("hopper over prosjekter med juridisk hold", async () => {
    await seedExpiredConsent({ hold: true });

    const result = await runRetentionSweep(pool, {
      categories: ["expired_consent_media"],
      enforce: true,
      env: TEST_ENV,
    });

    expect(result.categories[0].rowsAffected).toBe(0);
    const row = await pool.query(`SELECT photos FROM casting_candidates WHERE id = 'c1'`);
    expect(row.rows[0].photos).toHaveLength(2);
  });

  it("anonymiserer kandidater på avsluttede prosjekter og tar dem ikke om igjen", async () => {
    await pool.query(
      `INSERT INTO casting_projects (id, name, status, end_date)
       VALUES ('p2', 'Ferdig', 'completed', (NOW() - INTERVAL '400 days')::date)`,
    );
    await pool.query(
      `INSERT INTO casting_candidates (id, project_id, name, email, phone, notes, photos)
       VALUES ('c2', 'p2', 'Ola Nordmann', 'ola@example.com', '+4790000000', 'notat', $1::jsonb)`,
      [JSON.stringify(MEDIA)],
    );

    const first = await runRetentionSweep(pool, {
      categories: ["closed_project_candidates"],
      enforce: true,
      env: TEST_ENV,
    });
    expect(first.categories[0].rowsAffected).toBe(1);

    const row = await pool.query(
      `SELECT name, email, phone, notes, photos, anonymized_at FROM casting_candidates WHERE id = 'c2'`,
    );
    expect(row.rows[0]).toMatchObject({
      name: "Anonymisert kandidat",
      email: null,
      phone: null,
      notes: null,
    });
    expect(row.rows[0].photos).toEqual([]);
    expect(row.rows[0].anonymized_at).not.toBeNull();

    // Andre kjøring skal ikke finne raden igjen.
    const second = await runRetentionSweep(pool, {
      categories: ["closed_project_candidates"],
      enforce: true,
      env: TEST_ENV,
    });
    expect(second.categories[0].rowsAffected).toBe(0);
  });

  it("lar prosjekt-overstyring forlenge fristen", async () => {
    await seedExpiredConsent();
    // 365 dager for p1 — samtykket utløp for 60 dager siden, altså for tidlig.
    await pool.query(
      `INSERT INTO role_room_retention_policies (scope_type, scope_ref, category, retention_days)
       VALUES ('project', 'p1', 'expired_consent_media', 365)`,
    );

    const result = await runRetentionSweep(pool, {
      categories: ["expired_consent_media"],
      enforce: true,
      env: TEST_ENV,
    });

    expect(result.categories[0].rowsAffected).toBe(0);
    const row = await pool.query(`SELECT photos FROM casting_candidates WHERE id = 'c1'`);
    expect(row.rows[0].photos).toHaveLength(2);
  });

  it("nuller utløpte delingslenker", async () => {
    await pool.query(
      `INSERT INTO talent_selftape_submissions
         (target_type, private_token, private_expires_at, private_password_hash)
       VALUES ('private_link', 'tok_123', NOW() - INTERVAL '30 days', 'hash')`,
    );

    const result = await runRetentionSweep(pool, {
      categories: ["expired_selftape_links"],
      enforce: true,
      env: TEST_ENV,
    });

    expect(result.categories[0].rowsAffected).toBe(1);
    const row = await pool.query(
      `SELECT private_token, private_password_hash FROM talent_selftape_submissions`,
    );
    expect(row.rows[0].private_token).toBeNull();
    expect(row.rows[0].private_password_hash).toBeNull();
  });
});
