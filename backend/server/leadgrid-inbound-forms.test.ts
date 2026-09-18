/**
 * Den publiserbare nøkkelen er ikke en hemmelighet — den ligger i HTML-en på
 * kundens nettside. Origin-lista er derfor det som faktisk skiller kundens
 * eget skjema fra et hvilket som helst nettsted som kopierer nøkkelen.
 *
 * Testene her holder på nettopp den grensen, og på at IP-en aldri havner i
 * loggen i klartekst.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { originAllowed, hashIp } from "./leadgrid-inbound-forms";

describe("originAllowed", () => {
  const allowed = ["https://kundensdomene.no", "https://www.kundensdomene.no"];

  it("slipper gjennom domenene kunden har oppgitt", () => {
    expect(originAllowed("https://kundensdomene.no", allowed)).toBe(true);
    expect(originAllowed("https://www.kundensdomene.no", allowed)).toBe(true);
  });

  it("lar seg ikke lure av et domene som bare ligner", () => {
    // Dette er hele poenget: en «slutter på»-sjekk ville sluppet disse inn.
    for (const origin of [
      "https://evil-kundensdomene.no",
      "https://kundensdomene.no.angriper.com",
      "http://kundensdomene.no",
      "https://kundensdomene.no:8443",
    ]) {
      expect(originAllowed(origin, allowed)).toBe(false);
    }
  });

  it("krever en origin når lista er satt", () => {
    // Uten Origin-header er det ikke en nettleser. Med lista satt har kunden
    // sagt at bare nettstedene der skal slippe til.
    expect(originAllowed(undefined, allowed)).toBe(false);
  });

  it("tillater alt når lista er tom", () => {
    // Tom liste = skjemaet sendes fra en server, ikke fra en nettleser.
    expect(originAllowed(undefined, [])).toBe(true);
    expect(originAllowed("https://hvilketsomhelst.no", [])).toBe(true);
  });

  it("bryr seg ikke om store og små bokstaver i vertsnavnet", () => {
    expect(originAllowed("https://KundensDomene.no", allowed)).toBe(true);
  });
});

describe("hashIp", () => {
  it("gir aldri IP-en tilbake", () => {
    const hash = hashIp("81.166.42.7");
    expect(hash).not.toContain("81.166");
    expect(hash).toHaveLength(64);
  });

  it("teller samme avsender som samme avsender", () => {
    expect(hashIp("81.166.42.7")).toBe(hashIp("81.166.42.7"));
    expect(hashIp("81.166.42.7")).not.toBe(hashIp("81.166.42.8"));
  });
});

describe("innsendingsruta", () => {
  const route = readFileSync(join(__dirname, "leadgrid-inbound-forms.ts"), "utf8");

  it("plukker klikk-ID-ene ut av kroppen, ikke bare utm", () => {
    expect(route).toContain("fbclid: str(body.fbclid, 255)");
    expect(route).toContain("ttclid: str(body.ttclid, 255)");
  });

  it("sender dem videre til workflows, så en kampanje kan trigge noe", () => {
    expect(route).toContain("fbclid: attribution.fbclid");
    expect(route).toContain("ttclid: attribution.ttclid");
  });
});

describe("migrasjon 0637", () => {
  const sql = readFileSync(
    join(__dirname, "../migrations/0637_leadgrid_inbound_forms.sql"),
    "utf8",
  );

  it("lagrer aldri IP i klartekst", () => {
    expect(sql).toContain("ip_hash           CHAR(64)");
    expect(sql).not.toMatch(/ip_address|\bip\s+INET/);
  });

  it("gir leadet kampanjesporingen som gjør spørsmålet svarbart", () => {
    for (const column of ["utm_source", "utm_campaign", "gclid", "landing_page_url"]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
  });

  it("tar vare på klikk-ID-ene fra alle tre plattformene", () => {
    // Uten klikk-id kan en vunnet avtale aldri rapporteres tilbake, og
    // plattformen fortsetter å optimalisere mot skjema-utfyllinger i stedet
    // for mot omsetning. fbclid dekker både Facebook og Instagram.
    for (const column of ["gclid", "fbclid", "ttclid"]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
      expect(sql).toContain(`idx_crm_customers_${column}`);
    }
  });

  it("har et tak per IP per time som ikke kan skrus av", () => {
    expect(sql).toContain("rate_limit_per_hour INTEGER NOT NULL DEFAULT 20");
    expect(sql).toContain("CHECK (rate_limit_per_hour > 0 AND rate_limit_per_hour <= 1000)");
  });

  it("holder innsendingsloggen selv om skjemaet tilbakekalles", () => {
    expect(sql).toContain("revoked_at        TIMESTAMPTZ");
  });
});
