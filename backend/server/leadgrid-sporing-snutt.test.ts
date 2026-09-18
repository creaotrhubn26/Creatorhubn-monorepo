/**
 * Snutten finnes fordi klikk-ID-kolonnene fra mig 0637 ellers står tomme:
 * endepunktet TAR imot gclid/fbclid/ttclid, men ingenting i nettleseren
 * sender dem.
 *
 * Det vanskelige er ikke å lese en URL-parameter. Det er at parameteren står
 * på LANDINGSSIDEN mens skjemaet fylles ut på kontaktsiden, kanskje dager
 * senere. Testene under kjører den genererte snutten i en enkel stubbet
 * nettleser og holder på nettopp den overlevelsen.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { byggSporingsSnutt } from "./leadgrid-sporing-snutt";

interface Verden {
  nyttelast: () => Record<string, unknown>;
  send: (felt?: Record<string, unknown>) => Promise<unknown>;
  lager: Map<string, string>;
  win: Record<string, unknown>;
}

/** Minimal nettleser: nok til at snutten kjører, ikke mer. */
function kjor(url: string, lager = new Map<string, string>(), referrer = ""): Verden {
  const location = { search: new URL(url).search, href: url };
  const win: Record<string, unknown> = {};
  const fn = new Function(
    "window", "location", "localStorage", "document", "URLSearchParams", "fetch",
    byggSporingsSnutt({ publicKey: "lgf_test", apiBase: "https://api.test" }),
  );
  fn(
    win,
    location,
    {
      getItem: (k: string) => lager.get(k) ?? null,
      setItem: (k: string, v: string) => lager.set(k, v),
    },
    {
      readyState: "complete",
      referrer,
      querySelectorAll: () => [],
      addEventListener: () => {},
      // Cookie-reserven skrives til, men leses ikke i denne verdenen.
      set cookie(_v: string) {},
      get cookie() { return ""; },
    },
    URLSearchParams,
    async () => ({ ok: true }),
  );
  const lg = win.leadgrid as {
    attribusjon: () => Record<string, unknown>;
    send: (felt?: Record<string, unknown>) => Promise<unknown>;
  };
  return { nyttelast: lg.attribusjon, send: lg.send, lager, win };
}

describe("attribusjon overlever fra landingsside til skjema", () => {
  it("tar vare på kampanjen når den først kommer inn", () => {
    const v = kjor("https://kunde.no/tilbud?utm_source=google&utm_campaign=host2026&gclid=ABC123");
    const p = v.nyttelast();
    expect(p.utm_source).toBe("google");
    expect(p.utm_campaign).toBe("host2026");
    expect(p.gclid).toBe("ABC123");
  });

  it("har den fortsatt når skjemaet åpnes på en annen side uten parametre", () => {
    // Dette er hele poenget. Uten lagring er attribusjonen borte her.
    const v1 = kjor("https://kunde.no/tilbud?utm_campaign=host2026&gclid=ABC123");
    const v2 = kjor("https://kunde.no/kontakt", v1.lager);
    const p = v2.nyttelast();
    expect(p.utm_campaign).toBe("host2026");
    expect(p.gclid).toBe("ABC123");
  });

  it("lar den første kampanjen beholde æren ved nytt besøk", () => {
    // Kommer de tilbake via en annen kampanje, skal ikke den siste annonsen
    // få kreditt for arbeid den ikke gjorde.
    const v1 = kjor("https://kunde.no/?utm_campaign=host2026&utm_source=google");
    const v2 = kjor("https://kunde.no/?utm_campaign=jul2026&utm_source=meta", v1.lager);
    expect(v2.nyttelast().utm_campaign).toBe("host2026");
  });

  it("bytter likevel til den ferskeste klikk-ID-en", () => {
    // Motsatt regel, med vilje: en gammel klikk-id er utløpt hos plattformen
    // og kan ikke matches. Den ferske kan.
    const v1 = kjor("https://kunde.no/?utm_campaign=host2026&gclid=GAMMEL");
    const v2 = kjor("https://kunde.no/?fbclid=FERSK", v1.lager);
    const p = v2.nyttelast();
    expect(p.utm_campaign).toBe("host2026");
    expect(p.fbclid).toBe("FERSK");
    expect(p.gclid).toBe("GAMMEL");
  });

  it("tar vare på landingsside og henvisning", () => {
    const v = kjor("https://kunde.no/tilbud?utm_campaign=x", new Map(), "https://google.no/");
    const p = v.nyttelast();
    expect(p.landing_page_url).toBe("https://kunde.no/tilbud?utm_campaign=x");
    expect(p.referrer_url).toBe("https://google.no/");
  });

  it("sender alltid honeypot og visningstid, som endepunktet krever", () => {
    const p = kjor("https://kunde.no/").nyttelast();
    expect(p._hp).toBe("");
    expect(typeof p._t).toBe("number");
  });

  it("kutter en parameter som er urimelig lang", () => {
    const v = kjor(`https://kunde.no/?utm_campaign=${"a".repeat(500)}`);
    expect(String(v.nyttelast().utm_campaign)).toHaveLength(200);
  });

  it("peker på riktig skjema-endepunkt", () => {
    const js = byggSporingsSnutt({ publicKey: "lgf_abc", apiBase: "https://api.test" });
    expect(js).toContain("https://api.test/api/leadgrid/public/forms/lgf_abc/submit");
  });

  it("serveres fra den validerte publikums-originen, ikke fra request-verten", () => {
    // Utledet fra req.protocol bak Renders proxy kan basen bli http://, og da
    // blokkeres fetch som mixed content på kundens HTTPS-side. Verten kunne
    // dessuten blitt en Role Room-origin.
    const rute = readFileSync(join(__dirname, "leadgrid-inbound-forms.ts"), "utf8");
    // Uten kommentarlinjer: forklaringen av hvorfor vi IKKE gjør det, nevner
    // nødvendigvis det vi ikke gjør.
    const kode = rute
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(kode).toContain("const base = leadgridPublicOrigin();");
    expect(kode).not.toContain("req.get(\"host\")");
    expect(kode).not.toContain("LEADGRID_PUBLIC_API_BASE");
  });
});

describe("hendelser til vertssidens egne pixler", () => {
  /** Nettleser med ttq og fbq, slik en side med egne pixler ser ut. */
  function medPixler(url: string) {
    const kalt: Array<{ pixel: string; args: unknown[] }> = [];
    const lager = new Map<string, string>();
    const location = { search: new URL(url).search, href: url };
    const win: Record<string, unknown> = {
      ttq: { track: (...args: unknown[]) => kalt.push({ pixel: "ttq", args }) },
      fbq: (...args: unknown[]) => kalt.push({ pixel: "fbq", args }),
    };
    const fn = new Function(
      "window", "location", "localStorage", "document", "URLSearchParams", "fetch", "crypto",
      byggSporingsSnutt({ publicKey: "lgf_test", apiBase: "https://api.test" }),
    );
    let sendtBody: Record<string, unknown> = {};
    fn(
      win, location,
      { getItem: (k: string) => lager.get(k) ?? null, setItem: (k: string, v: string) => lager.set(k, v) },
      {
        readyState: "complete", referrer: "", querySelectorAll: () => [],
        addEventListener: () => {}, set cookie(_v: string) {}, get cookie() { return ""; },
      },
      URLSearchParams,
      async (_u: string, init: { body: string }) => {
        sendtBody = JSON.parse(init.body);
        return { ok: true };
      },
      { randomUUID: () => "11111111-2222-3333-4444-555555555555" },
    );
    const lg = win.leadgrid as { send: (f?: Record<string, unknown>) => Promise<unknown> };
    return { kalt, send: lg.send, body: () => sendtBody };
  }

  it("fyrer SubmitForm på TikTok og Lead på Meta", async () => {
    const v = medPixler("https://kunde.no/?ttclid=TT1&fbclid=FB1");
    await v.send({ email: "kari@x.no" });
    expect(v.kalt.map((k) => k.pixel).sort()).toEqual(["fbq", "ttq"]);
    expect(v.kalt.find((k) => k.pixel === "ttq")?.args[0]).toBe("SubmitForm");
    expect(v.kalt.find((k) => k.pixel === "fbq")?.args[1]).toBe("Lead");
  });

  it("deler hendelses-id med serveren, så konverteringen ikke telles to ganger", async () => {
    const v = medPixler("https://kunde.no/?ttclid=TT1");
    await v.send({ email: "kari@x.no" });
    const id = v.body().event_id;
    expect(typeof id).toBe("string");
    const ttqOpts = v.kalt.find((k) => k.pixel === "ttq")?.args[2] as { event_id: string };
    const fbqOpts = v.kalt.find((k) => k.pixel === "fbq")?.args[3] as { eventID: string };
    expect(ttqOpts.event_id).toBe(id);
    expect(fbqOpts.eventID).toBe(id);
  });

  it("gjør ingenting når vertssiden ikke har pixler", async () => {
    // Det er dette som gjør at en kundes henvendelse aldri havner i VÅR
    // pixel: snutten fyrer bare det nettstedet selv har lastet. Sa brukeren
    // nei til samtykke, har vertssiden heller ikke lastet noe.
    const v = kjor("https://kunde.no/?ttclid=TT1");
    await expect(v.send({ email: "kari@x.no" })).resolves.toBeDefined();
  });
});
