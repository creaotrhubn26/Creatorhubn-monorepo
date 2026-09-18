/**
 * Bedriften er den varige relasjonen, salget er sin egen prosess.
 *
 * Kontrollpunktet: en bedrift som både har kjøpt før, forhandler om én
 * avtale og har et tilbud ute på en annen, skal registreres ÉN gang.
 * Før mig 0650 bar crm_customers-raden selve salget, så det krevde tre
 * rader for samme bedrift.
 *
 * Testene her holder på de fire egenskapene som gjør at overgangen kan
 * skje uten å stoppe de 34 backend-filene som fortsatt leser deal-feltene
 * på crm_customers.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(__dirname, "../migrations/0650_leadgrid_deals.sql"),
  "utf8",
);

describe("migrasjon 0650 — salg som egen enhet", () => {
  it("lar én bedrift ha flere salg", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS leadgrid_deals");
    expect(sql).toContain("REFERENCES crm_customers (id, organization_id, project_id)");
    // Ingen unik-begrensning på customer_id alene — det ville låst oss til
    // ett salg per bedrift, altså tilbake til utgangspunktet.
    expect(sql).not.toMatch(/UNIQUE\s*\(\s*customer_id\s*\)/);
  });

  it("gir hvert salg sin egen beslutningstaker", () => {
    expect(sql).toContain("primary_contact_id UUID REFERENCES leadgrid_customer_contacts(id)");
  });

  it("gir kontaktpersonene kontaktinfo de manglet", () => {
    expect(sql).toContain("ALTER TABLE leadgrid_customer_contacts");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS email TEXT/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS phone VARCHAR\(40\)/);
  });

  it("holder nøyaktig ett primærsalg per bedrift", () => {
    expect(sql).toContain("uq_leadgrid_deals_primary");
    expect(sql).toContain("WHERE is_primary AND archived_at IS NULL");
  });

  it("speiler bare én vei, bedrift til primærsalg", () => {
    expect(sql).toContain("AFTER UPDATE ON crm_customers");
    expect(sql).toContain("UPDATE leadgrid_deals d");
    // Motsatt vei ville gitt to skrivere på samme verdi.
    expect(sql).not.toMatch(/AFTER UPDATE ON leadgrid_deals/);
  });

  it("gir eksisterende bedrifter et primærsalg, og nye ett med en gang", () => {
    expect(sql).toContain("INSERT INTO leadgrid_deals");
    expect(sql).toContain("AFTER INSERT ON crm_customers");
    expect(sql).toContain("'backfill'");
  });

  it("flytter produktlinjene fra bedriften til salget", () => {
    expect(sql).toContain("ALTER TABLE leadgrid_deal_line_items");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS deal_id UUID");
    expect(sql).toContain("DROP COLUMN IF EXISTS customer_id");
    expect(sql).toContain("REFERENCES leadgrid_deals (id, organization_id, project_id)");
  });

  it("retter fornyelsestriggeren som leste linjene via bedriften", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION crm_customers_apply_won()");
    expect(sql).toContain("JOIN leadgrid_deals d ON d.id = li.deal_id");
  });
});

describe("backfill tåler data som allerede finnes i produksjon", () => {
  // Migrasjonen feilet i produksjon 18.09.2026:
  //   23503: insert or update on table "leadgrid_deals" violates foreign key
  //   constraint "leadgrid_deals_owner_user_id_fkey"
  //
  // crm_customers.owner_user_id har ingen fremmednøkkel og inneholder
  // pekere til brukere som er slettet. Den nye kolonnen har en. En backfill
  // som stoler på at kilden er ren, stopper hele deployen.
  it("importerer ikke en eier som ikke finnes i users", () => {
    expect(sql).toContain("CASE WHEN EXISTS (SELECT 1 FROM users u WHERE u.id = c.owner_user_id)");
  });

  it("lar heller ikke triggerne skrive en eier som ikke finnes", () => {
    // Både INSERT-triggeren og speilingen setter owner_user_id. Hadde bare
    // backfill-en vært vernet, ville neste nye kunde med slettet eier feilet.
    const treff = sql.match(/SELECT u\.id FROM users u WHERE u\.id = NEW\.owner_user_id/g) ?? [];
    expect(treff.length).toBe(2);
  });
});

