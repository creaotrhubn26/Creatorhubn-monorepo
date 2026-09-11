import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = fs.readFileSync(
  path.resolve(process.cwd(), "migrations/0578_leadgrid_email_outreach_compliance.sql"),
  "utf8",
);

describe("Leadgrid email compliance migration", () => {
  it("stores evidence and suppression at organization scope, never project scope", () => {
    expect(sql).toContain("PRIMARY KEY (organization_id, email_normalized)");
    expect(sql).toContain("leadgrid_email_suppressions");
    expect(sql).toContain("leadgrid_email_marketing_consent_events");
    expect(sql).toContain("leadgrid_email_gdpr_processing_records");
    expect(sql).toContain("consent_text TEXT NOT NULL");
    expect(sql).toContain("purpose TEXT NOT NULL");
    expect(sql).toContain("occurred_at TIMESTAMPTZ NOT NULL");
    expect(sql).not.toContain("project_id");
  });

  it("makes consent append-only and constrains every compliance state", () => {
    expect(sql).toContain("CHECK (action IN ('grant', 'withdraw'))");
    expect(sql).toContain("'unknown', 'verified_shared', 'named_person'");
    expect(sql).toContain("'recipient_objection', 'unsubscribe', 'manual_block', 'hard_bounce', 'complaint'");
    expect(sql).toContain("legal_basis <> 'legitimate_interests'");
    expect(sql).toContain("necessity_assessment IS NOT NULL");
    expect(sql).toContain("balancing_assessment IS NOT NULL");
    expect(sql).toContain("privacy_notice_status IN ('pending', 'sent', 'exempt')");
    expect(sql).not.toMatch(/ON CONFLICT[\s\S]{0,200}leadgrid_email_marketing_consent_events/);
  });
});
