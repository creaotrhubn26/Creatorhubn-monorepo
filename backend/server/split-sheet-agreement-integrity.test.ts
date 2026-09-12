import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0466_split_sheet_signed_agreement_integrity.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("versioned split-sheet database integrity migration", () => {
  it("installs forward-only header and contributor guards", () => {
    expect(migration).toContain("BEGIN;");
    expect(migration).toContain("COMMIT;");
    expect(migration).toContain("creatorhub_enforce_signed_split_sheet_header");
    expect(migration).toContain("creatorhub_enforce_signed_split_sheet_contributor");
    expect(migration).toContain("BEFORE UPDATE OR DELETE ON split_sheets");
    expect(migration).toContain(
      "BEFORE INSERT OR UPDATE OR DELETE ON split_sheet_contributors",
    );
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
  });

  it("serializes contributor writers on the parent before checking signatures", () => {
    const parentLock = migration.indexOf("FROM split_sheets\n   WHERE id = sheet_id\n   FOR UPDATE NOWAIT");
    const signatureRefresh = migration.indexOf(
      "FROM split_sheet_contributors\n     WHERE split_sheet_id = sheet_id",
      parentLock,
    );
    expect(parentLock).toBeGreaterThan(-1);
    expect(signatureRefresh).toBeGreaterThan(parentLock);
    expect(migration).toContain("to_jsonb(NEW) - ARRAY[");
    expect(migration).toContain(
      "AFTER INSERT OR DELETE OR UPDATE OF percentage, split_sheet_id",
    );
    expect(migration).toContain(
      "EXECUTE FUNCTION creatorhub_refresh_split_sheet_total_percentage()",
    );
  });

  it("requires canonical personal signing and keeps signature evidence append-only", () => {
    expect(migration).toContain(
      `signature_data @> '{"signedVia":"participant-token","consent":true}'::JSONB`,
    );
    expect(migration).toContain(
      "jsonb_typeof(NEW.signature_data->'agreementSnapshot') IS DISTINCT FROM 'object'",
    );
    expect(migration).toContain("Signature evidence is append-only");
    expect(migration).toContain("Participants and signature evidence cannot be deleted");
    expect(migration).toContain(
      "Versioned contributors must be created unsigned and signed through a personal token.",
    );
    expect(migration).toContain(
      "All legacy signatures must be cleared before enabling versioned personal signing.",
    );
    expect(migration).not.toContain("has_noncanonical_signature");
  });

  it("protects legal terms while allowing only completion or archiving", () => {
    expect(migration).toContain("NEW.metadata IS DISTINCT FROM OLD.metadata");
    expect(migration).toContain("NEW.custom_fields IS DISTINCT FROM OLD.custom_fields");
    expect(migration).toContain("NEW.status = 'archived'");
    expect(migration).toContain(
      "OLD.status = 'pending_signatures' AND NEW.status = 'completed'",
    );
    expect(migration).toContain("Signed agreement terms cannot be changed; create an amendment.");
  });
});
