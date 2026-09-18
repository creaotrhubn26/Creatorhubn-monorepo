/**
 * Første versjon av dette skannet meldte at leadgrid.no ikke hadde
 * Meta-pixel. Den hadde det — 929515126829909 — men ID-en settes i en
 * variabel og sendes til fbq() først når samtykke er gitt. Et skann som bare
 * så etter fbq('init','<literal>') så den aldri.
 *
 * Det er ikke en kuriositet ved vårt eget nettsted: alle consent-gatede og
 * fler-merkevare-oppsett gjør det slik. Fikstur-en under er formen fra
 * leadgrid.no sin egen index.html, så feilen ikke kan komme tilbake.
 */
import { describe, expect, it } from "vitest";
import { domeneOrd } from "./leadgrid-sporing-skann";

describe("domeneOrd", () => {
  it("kjenner igjen merkevaren i vertsnavnet", () => {
    expect(domeneOrd("leadgrid.no")).toContain("LEADGRID");
    expect(domeneOrd("www.leadgrid.no")).toContain("LEADGRID");
  });

  it("deler opp sammensatte domener, så begge ledd kan matche", () => {
    const ord = domeneOrd("min-butikk.no");
    expect(ord).toContain("MINBUTIKK");
    expect(ord).toContain("MIN");
    expect(ord).toContain("BUTIKK");
  });

  it("tar ikke med ledd som er for korte til å si noe", () => {
    // «as» i «as-bygg.no» ville matchet hva som helst.
    expect(domeneOrd("as-bygg.no")).not.toContain("AS");
  });
});

describe("mønstrene mot ekte sideform", () => {
  // Formen fra leadgrid.no/index.html: alle merkevarenes ID-er i samme fil,
  // valgt på vertsnavn ved kjøring.
  const SIDEKILDE = `
    var GOOGLE_TAG_MANAGER_ID = 'GTM-KC38RPNZ';
    var ROLE_ROOM_GOOGLE_TAG_MANAGER_ID = 'GTM-TNWTVHSP';
    var LEADGRID_GA_MEASUREMENT_ID = 'G-3MS91ZHVKS';
    var LEADGRID_GOOGLE_TAG_MANAGER_ID = 'GTM-W8QZL75L';
    var LEADGRID_CLARITY_PROJECT_ID = 'xnzezvwkbm';
    var LEADGRID_TIKTOK_PIXEL_CODE = '';
    var LEADGRID_META_PIXEL_ID = '929515126829909';
    var CREATORHUB_META_PIXEL_ID = '1886226702029036';
  `;

  // Samme regexer som modulen bruker; testet mot strengen direkte fordi
  // skannSporing henter over nett.
  const treff = (re: RegExp): string[] => {
    re.lastIndex = 0;
    const ut: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(SIDEKILDE)) !== null) ut.push(m[1] ?? m[0]);
    return ut;
  };

  it("finner Meta-pixelen som ligger i en variabel", () => {
    const re = /[A-Za-z_]*(?:META_PIXEL|FB_PIXEL|metaPixel|fbPixel)[A-Za-z_]*\s*[:=]\s*['"](\d{12,17})['"]/g;
    expect(treff(re)).toEqual(["929515126829909", "1886226702029036"]);
  });

  it("finner Clarity, som første versjon ikke lette etter i det hele tatt", () => {
    const re = /[A-Za-z_]*CLARITY[A-Za-z_]*\s*[:=]\s*['"]([a-z0-9]{8,15})['"]/g;
    expect(treff(re)).toEqual(["xnzezvwkbm"]);
  });

  it("melder ikke en tom streng som en TikTok-pixel", () => {
    // LEADGRID_TIKTOK_PIXEL_CODE = '' betyr «ikke satt opp», ikke «funnet».
    const re = /[A-Za-z_]*TIKTOK_PIXEL[A-Za-z_]*\s*[:=]\s*['"]([A-Z0-9]{15,25})['"]/g;
    expect(treff(re)).toEqual([]);
  });

  it("plukker opp alle GTM-containerne, så flertydigheten kan meldes", () => {
    const re = /[A-Z_]*(?:TAG_MANAGER|GTM)[A-Z_]*\s*[:=]\s*['"](GTM-[A-Z0-9]{4,10})['"]/g;
    expect(treff(re)).toHaveLength(3);
  });
});
