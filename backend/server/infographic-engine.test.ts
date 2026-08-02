import { describe, expect, it } from "vitest";

import {
  assembleHtml,
  cfgJson,
  detectCategory,
  deriveSchema,
  INFOGRAPHIC_TEMPLATE_LIBRARY,
  pickTemplate,
} from "./infographic-engine.js";

describe("detectCategory — data-form → kategori (auto-velg)", () => {
  it("steps[] → timeline (høyest presedens)", () => {
    expect(detectCategory({ steps: [{ label: "A" }] })).toBe("timeline");
    // steps vinner selv når det også finnes 2 kort
    expect(detectCategory({ steps: [{ label: "A" }], cards: [{ value: 1 }, { value: 2 }] })).toBe("timeline");
  });

  it("kort med desc/when/date → timeline", () => {
    expect(detectCategory({ cards: [{ value: 1, when: "2020" }, { value: 2 }] })).toBe("timeline");
    expect(detectCategory({ cards: [{ value: 1, desc: "x" }, { value: 2 }] })).toBe("timeline");
  });

  it("before/after eller nøyaktig 2 kort → comparison", () => {
    expect(detectCategory({ before: 10, after: 20 })).toBe("comparison");
    expect(detectCategory({ cards: [{ value: 1 }, { value: 2 }] })).toBe("comparison");
  });

  it("ett tall som ser ut som prosent → percent", () => {
    expect(detectCategory({ value: "80%" })).toBe("percent");
    expect(detectCategory({ value: 0.42 })).toBe("percent"); // 0..1
    expect(detectCategory({ cards: [{ value: "12%" }] })).toBe("percent");
  });

  it("ett vanlig tall → single", () => {
    expect(detectCategory({ value: 1247 })).toBe("single");
    expect(detectCategory({ value: "1 247" })).toBe("single");
    expect(detectCategory({ cards: [{ value: 99 }] })).toBe("single");
  });

  it("≥2 kort uten tidsmarkører → kpis", () => {
    expect(detectCategory({ cards: [{ value: 1 }, { value: 2 }, { value: 3 }] })).toBe("kpis");
  });

  it("tom/ugyldig input → single (trygg default)", () => {
    expect(detectCategory(null)).toBe("single");
    expect(detectCategory(undefined)).toBe("single");
    expect(detectCategory({})).toBe("single");
    expect(detectCategory({ cards: "ikke-array" as unknown as [] })).toBe("single");
  });
});

describe("pickTemplate — kategori → innebygd mal-sti (SSRF-trygt)", () => {
  it("returnerer KUN kjente bibliotek-stier", () => {
    const known = new Set(Object.values(INFOGRAPHIC_TEMPLATE_LIBRARY));
    for (const data of [{ value: 5 }, { value: "50%" }, { cards: [{}, {}, {}] }, { before: 1, after: 2 }, { steps: [{}] }]) {
      expect(known.has(pickTemplate(data) as never)).toBe(true);
    }
  });

  it("mapper hver kategori til riktig innebygd mal", () => {
    expect(pickTemplate({ value: 42 })).toBe(INFOGRAPHIC_TEMPLATE_LIBRARY.bigNumber);
    expect(pickTemplate({ value: "60%" })).toBe(INFOGRAPHIC_TEMPLATE_LIBRARY.donut);
    expect(pickTemplate({ cards: [{}, {}, {}] })).toBe(INFOGRAPHIC_TEMPLATE_LIBRARY.statBar);
    expect(pickTemplate({ before: 1, after: 2 })).toBe(INFOGRAPHIC_TEMPLATE_LIBRARY.comparison);
    expect(pickTemplate({ steps: [{}] })).toBe(INFOGRAPHIC_TEMPLATE_LIBRARY.timeline);
  });
});

describe("cfgJson — trygg JSON for inline <script>", () => {
  it("escaper < så «</script>» ikke bryter ut", () => {
    const out = cfgJson({ title: "</script><img src=x onerror=alert(1)>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c"); // < → <
  });

  it("escaper linjeseparatorer U+2028/U+2029 (ellers tapes ALL data)", () => {
    const out = cfgJson({ t: "a b c" });
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
    // fortsatt gyldig JSON
    expect(JSON.parse(out)).toEqual({ t: "a b c" });
  });

  it("bevarer vanlige verdier round-trip", () => {
    const obj = { value: 1247, label: "CV-er", accent: "#ff8c00", cards: [{ value: 1 }] };
    expect(JSON.parse(cfgJson(obj))).toEqual(obj);
  });
});

describe("deriveSchema — utleder CFG-felter fra mal-HTML", () => {
  it("plukker __CFG__.x og CFG.y, ekskluderer reserverte (accent/ink/logo/layout)", () => {
    const html = `<div>{__CFG__.title}</div><span>{CFG.value}</span><i style="color:__CFG__.accent">{CFG.logo}</i>`;
    const keys = deriveSchema(html).map((f) => f.key).sort();
    expect(keys).toEqual(["title", "value"]);
  });

  it("deduper gjentatte referanser", () => {
    const html = `__CFG__.a __CFG__.a CFG.a`;
    expect(deriveSchema(html)).toHaveLength(1);
  });

  it("tom mal → tomt skjema", () => {
    expect(deriveSchema("<div>ingen felt</div>")).toEqual([]);
  });
});

describe("assembleHtml — selvstendig, portabel artefakt", () => {
  const TPL = `<head></head><div id="wrap">{__CFG__.title}</div>`;

  it("injiserer __CFG__ med dataene", () => {
    const out = assembleHtml(TPL, { title: "Hei" });
    expect(out).toContain('window.__CFG__=');
    expect(out).toContain('"title":"Hei"');
  });

  it("strippet eksterne CDN-font-lenker (WKWebView-blokkering)", () => {
    const withLink = `<head><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter"></head><div id="wrap"></div>`;
    const out = assembleHtml(withLink, {});
    expect(out).not.toContain("fonts.googleapis.com");
  });

  it("injiserer fontsCss (@font-face) i <head>", () => {
    const out = assembleHtml(TPL, {}, { fontsCss: "@font-face{font-family:X}" });
    expect(out).toContain("@font-face{font-family:X}");
  });

  it("inkluderer FIT-script som standard, kan skrus av", () => {
    expect(assembleHtml(TPL, {})).toContain("__igFit");
    expect(assembleHtml(TPL, {}, { fit: false })).not.toContain("__igFit");
  });

  it("statisk frame kaller setProgress; autoplay bruker requestAnimationFrame", () => {
    expect(assembleHtml(TPL, {}, { progress: 1 })).toContain("setProgress(1)");
    expect(assembleHtml(TPL, {}, { autoplaySec: 3, loop: true })).toContain("requestAnimationFrame");
  });
});

describe("fidelity — emoji, lange verdier og tom data håndteres trygt", () => {
  it("emoji i data bevares round-trip gjennom cfgJson (rendres m/ Noto-emoji-fonten i Docker)", () => {
    const obj = { label: "Vekst 🚀📈", value: "100% ✅" };
    expect(JSON.parse(cfgJson(obj))).toEqual(obj);
  });

  it("veldig lang verdi krasjer ikke detectCategory (overflow håndteres av FIT-skalering)", () => {
    const long = "x".repeat(5000);
    expect(() => detectCategory({ value: long })).not.toThrow();
    expect(detectCategory({ value: long })).toBe("single");
  });

  it("assembleHtml med TOM data gir fortsatt gyldig, selvstendig artefakt", () => {
    const out = assembleHtml(`<div id="wrap">{__CFG__.value}</div>`, {});
    expect(out).toContain("window.__CFG__={}");
    expect(out).toContain("__igFit");        // FIT til stede → skalerer uansett innhold
    expect(out).toContain("setProgress");    // driver til stede
  });

  it("æøå bevares i data (Inter latin-subset dekker dem)", () => {
    expect(JSON.parse(cfgJson({ t: "Fullføringsgrad på Østlandet" }))).toEqual({ t: "Fullføringsgrad på Østlandet" });
  });
});
