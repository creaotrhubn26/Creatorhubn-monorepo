import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Leadgrid contact channel migration", () => {
  it("preserves SMS and WhatsApp as distinct visit and activity channels", () => {
    const migration = readFileSync(
      new URL(
        "../migrations/0528_leadgrid_contact_channels.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain("'physical', 'phone', 'sms', 'whatsapp', 'email'");
    expect(migration).toContain("'call', 'sms', 'whatsapp', 'email', 'meeting'");
    expect(migration).toContain("VALIDATE CONSTRAINT crm_visits_visit_type_check");
    expect(migration).toContain("VALIDATE CONSTRAINT crm_visits_activity_kind_check");
  });
});
