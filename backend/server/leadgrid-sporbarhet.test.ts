/**
 * Regelen hele sporbarhets-oversikten står på: et tall som mangler grunnlag
 * skal være null, aldri 0.
 *
 * Er ikke kampanjen koblet til en kostnad, betyr 0 «gratis» for den som
 * leser. Da blir budsjettet flyttet til kampanjen som ser billigst ut, og
 * den er bare den vi mangler tall for. Det er en dyrere feil enn å vise
 * ingenting.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const routes = readFileSync(join(__dirname, "leadgrid-sporbarhet-routes.ts"), "utf8");
const migration = readFileSync(
  join(__dirname, "../migrations/0653_leadgrid_sporbarhet.sql"),
  "utf8",
);
/** Uten kommentarer. Migrasjonen NEVNER Role Rooms tabeller i en kommentar
 *  som forklarer hvorfor vi ikke bruker dem — det er ikke en avhengighet. */
const sqlOnly = migration
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");

describe("manglende grunnlag gir null, ikke null-tall", () => {
  it("regner ikke kostnad per lead uten kostnad", () => {
    expect(routes).toContain(
      "kostnad_per_lead: forbruk !== null && leads > 0",
    );
  });

  it("regner ikke ROAS på et forbruk som er null eller null kroner", () => {
    expect(routes).toContain("roas: forbruk !== null && forbruk > 0");
  });

  it("merker hvor kostnadstallet kommer fra", () => {
    // «manuell» og «api» må kunne skilles — ellers tror noen at et tall
    // kunden skrev inn er hentet fra Google.
    expect(routes).toContain('forbruk === null ? "ikke_koblet"');
    expect(routes).toContain('r.har_manuelle_tall ? "manuell" : "api"');
  });

  it("summerer ikke totalt forbruk når ingen kampanje har tall", () => {
    expect(routes).toContain("rader.some((r) => r.forbruk !== null)");
  });
});

describe("bekreftelse av sporing", () => {
  it("påstår ikke at GTM og GA4 virker — de kjører i nettleseren", () => {
    expect(routes).toContain("kan_ikke_bekreftes_fra_server");
  });

  it("bekrefter pixler på ekte bevis: et lead kom inn med klikk-ID", () => {
    expect(routes).toContain("c.fbclid IS NOT NULL");
    expect(routes).toContain("c.ttclid IS NOT NULL");
    expect(routes).toContain("c.gclid IS NOT NULL");
  });
});

describe("migrasjon 0653", () => {
  it("er Leadgrids egne tabeller, ikke Role Rooms", () => {
    // ads_campaigns og ads_attribution_daily (mig 128) er nøklet på byråets
    // prosjektbegrep og user_id, uten organization_id.
    expect(sqlOnly).not.toMatch(/ads_campaigns/);
    expect(sqlOnly).not.toMatch(/ads_attribution_daily/);
    expect(sqlOnly).not.toMatch(/producer_user_id/);
    expect(sqlOnly).not.toMatch(/role_room/);
  });

  it("scoper alt på organisasjon og prosjekt", () => {
    const tables = sqlOnly.match(/CREATE TABLE IF NOT EXISTS (\w+)/g) ?? [];
    expect(tables).toHaveLength(3);
    for (const block of sqlOnly.split("CREATE TABLE IF NOT EXISTS").slice(1)) {
      expect(block).toContain("organization_id");
      expect(block).toContain("project_id");
    }
  });

  it("tåler ikke to kostnadsrader for samme kampanje samme dag", () => {
    // Uten dette ville en ny henting lagt kostnaden oppå den gamle.
    expect(migration).toContain("uq_leadgrid_campaign_spend_day");
  });

  it("skiller hentede og manuelle kostnadstall", () => {
    expect(migration).toContain("CHECK (source IN ('api', 'manual'))");
  });
});
