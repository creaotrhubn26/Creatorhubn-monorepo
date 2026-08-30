import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0467_ipad_auth_session_authority.sql", import.meta.url),
  "utf8",
);

describe("0467 iPad auth-session authority migration", () => {
  it("is bounded, serialized, and safe when the legacy table is absent", () => {
    expect(migration).toContain("BEGIN;");
    expect(migration).toContain("SET LOCAL lock_timeout = '10s'");
    expect(migration).toContain("SET LOCAL statement_timeout = '60s'");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain(
      "IF to_regclass('public.persistent_auth_sessions') IS NOT NULL THEN",
    );
    expect(migration.trimEnd().endsWith("COMMIT;")).toBe(true);
  });

  it("aborts instead of resurrecting an active legacy iPad-pair session", () => {
    expect(migration).toContain("FROM public.persistent_auth_sessions");
    expect(migration).toContain("source = 'ipad_pair'");
    expect(migration).toContain("expires_at IS NULL OR expires_at > NOW()");
    expect(migration).toContain("IF active_legacy_ipad_pairs > 0 THEN");
    expect(migration).toContain("RAISE EXCEPTION");
    expect(migration).toContain("explicit revocation and re-pairing");
  });

  it("backfills only live native tokens for active, valid users idempotently", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS is_active");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS auth_session_version");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS creatorhub_auth_sessions",
    );
    expect(migration).toContain(
      "CREATE INDEX IF NOT EXISTS idx_creatorhub_auth_sessions_expires_at",
    );
    expect(migration).toMatch(/FROM ipad_tokens t\s+JOIN users u/u);
    expect(migration).toContain("WHERE t.revoked_at IS NULL");
    expect(migration).toContain("COALESCE(u.is_active, TRUE) = TRUE");
    expect(migration).toContain("NULLIF(BTRIM(u.email::text), '') IS NOT NULL");
    expect(migration).toContain("ON CONFLICT (token) DO NOTHING");
  });
});
