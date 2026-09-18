/**
 * leadgrid.no manglet i site-oppslaget. SiteKey hadde bare 'creatorhub' og
 * 'role-room', og alt som ikke var theroleroom.com falt til CreatorHub.
 *
 * Følgen: server-side-konverteringer fra leadgrid.no ble sendt til
 * CreatorHubs pixel, mens Leadgrids egen pixel — den nettleseren faktisk
 * bruker — aldri fikk dem. Begge kall svarte 200, så ingenting så galt ut.
 * CreatorHubs tall var for høye og Leadgrids for lave, uten spor.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const kilde = readFileSync(join(__dirname, "meta-conversions-api.ts"), "utf8");
const indexHtml = readFileSync(
  join(__dirname, "../../frontend/client/index.html"),
  "utf8",
);

describe("site-oppslag for Meta CAPI", () => {
  it("kjenner leadgrid som eget site", () => {
    expect(kilde).toContain('type SiteKey = "creatorhub" | "role-room" | "leadgrid"');
    expect(kilde).toContain('if (siteKey === "leadgrid")');
  });

  it("bruker Leadgrids egne env-vars, ikke CreatorHubs", () => {
    expect(kilde).toContain("process.env.LEADGRID_META_PIXEL_ID");
    expect(kilde).toContain("process.env.LEADGRID_META_CAPI_ACCESS_TOKEN");
  });

  it("kjenner igjen leadgrid-vertene både med og uten skjema", () => {
    // Begge grenene i resolveSiteFromContext må dekkes; den ene brukes når
    // strengen kan parses som URL, den andre når den bare er et vertsnavn.
    const treff = kilde.match(/LEADGRID_HOSTS\.has\(/g) ?? [];
    expect(treff.length).toBeGreaterThanOrEqual(2);
  });

  it("har samme vertsliste som nettleseren", () => {
    // Står de fra hverandre, sender nettleseren til én pixel og serveren til
    // en annen. Da stemmer ingen av tallene, og ingenting feiler synlig.
    const fraHtml = indexHtml
      .match(/var LEADGRID_ANALYTICS_HOSTS = \[([^\]]+)\]/)?.[1]
      ?.match(/'([^']+)'/g)
      ?.map((s) => s.replace(/'/g, ""))
      .sort();
    const fraServer = kilde
      .match(/const LEADGRID_HOSTS = new Set\(\[([^\]]+)\]/)?.[1]
      ?.match(/"([^"]+)"/g)
      ?.map((s) => s.replace(/"/g, ""))
      .sort();
    expect(fraHtml).toBeDefined();
    expect(fraServer).toEqual(fraHtml);
  });
});
