import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0607_runtime_created_tables_to_schema.sql", import.meta.url),
  "utf8",
);
const galleryRoutes = readFileSync(
  new URL("./client-gallery-routes.ts", import.meta.url),
  "utf8",
);
const gdpr = readFileSync(new URL("./nextrole-gdpr.ts", import.meta.url), "utf8");
const adminUsers = readFileSync(new URL("./admin-users-routes.ts", import.meta.url), "utf8");

// Tabellene under ble bare opprettet av CREATE TABLE IF NOT EXISTS i
// request-stier og manglet derfor i produksjon. Migrasjonen eier dem nå.
const OWNED_TABLES = [
  "print_products",
  "print_order_items",
  "competitor_reports",
  "ergonomics_events",
  "ergonomics_reflect",
  "project_change_log",
  "project_coordination_activity",
];

describe("runtime-created tables now owned by migration 0607", () => {
  it("declares every table that previously only existed at runtime", () => {
    for (const table of OWNED_TABLES) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("gives print_orders the columns the checkout actually writes", () => {
    const checkoutColumns = [
      "photographer_id",
      "stripe_payment_intent_id",
      "stripe_session_id",
      "total_amount",
      "currency",
      "payment_status",
      "fulfillment_status",
    ];
    for (const column of checkoutColumns) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
      expect(galleryRoutes).toContain(column);
    }
  });

  it("points the print_orders gallery reference at the gallery table the code uses", () => {
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS print_orders_gallery_id_client_galleries_id_fk");
    expect(migration).toContain("REFERENCES photographer_client_galleries(id)");
  });

  it("releases the legacy NOT NULL columns the checkout does not fill", () => {
    for (const column of ["order_number", "items", "order_total", "grand_total", "print_vendor"]) {
      expect(migration).toContain(`ALTER COLUMN ${column} DROP NOT NULL`);
    }
  });

  it("keeps GDPR export and deletion on the real cover letter table", () => {
    expect(gdpr).toContain("FROM resume_cover_letters");
    expect(gdpr).not.toMatch(/FROM cover_letters\b/);
  });

  it("writes impersonation audit to the existing audit table", () => {
    expect(adminUsers).toContain("INSERT INTO superadmin_impersonation_audit");
    expect(adminUsers).not.toContain("org_audit_log");
  });
});
