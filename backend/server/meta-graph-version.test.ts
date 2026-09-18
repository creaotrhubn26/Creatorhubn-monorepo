/**
 * Graph API-versjonen lå tre steder samtidig: v21.0 i 27 filer, v22.0 i fem
 * WhatsApp-filer, og v18.0 i meta-conversions-api.ts — altså CAPI-en som er
 * LIVE for creatorhubn.com og theroleroom.com. v18.0 er fra 2023 og utenfor
 * Metas toårsvindu.
 *
 * Den typen drift feiler ikke høylytt. Meta svarer fortsatt, bare på en
 * versjon ingen lenger har testet mot. Testen under er det som gjør at den
 * ikke kan oppstå på nytt uten at noen ser det.
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { META_GRAPH_API_VERSION, META_GRAPH_BASE, META_WWW_BASE } from "./meta-graph-version";

describe("meta-graph-version", () => {
  it("er på formen vN.N", () => {
    expect(META_GRAPH_API_VERSION).toMatch(/^v\d+\.\d+$/);
  });

  it("bygger begge vertene av samme versjon", () => {
    expect(META_GRAPH_BASE).toBe(`https://graph.facebook.com/${META_GRAPH_API_VERSION}`);
    expect(META_WWW_BASE).toBe(`https://www.facebook.com/${META_GRAPH_API_VERSION}`);
  });
});

describe("ingen hardkodet Graph-versjon i server/", () => {
  const here = __dirname;
  const files = readdirSync(here).filter(
    (f) => f.endsWith(".ts") && f !== "meta-graph-version.ts" && f !== "meta-graph-version.test.ts",
  );

  it("finner ingen versjon skrevet rett inn i en URL", () => {
    const hardcoded = files.filter((f) =>
      /(?:graph|www)\.facebook\.com\/v\d+\.\d+/.test(readFileSync(join(here, f), "utf8")),
    );
    // Feiler denne: importer META_GRAPH_BASE eller META_WWW_BASE fra
    // ./meta-graph-version.js i stedet for å skrive versjonen på nytt.
    expect(hardcoded).toEqual([]);
  });

  it("finner ingen egen versjonsstreng i en konstant", () => {
    const own = files.filter((f) =>
      /const\s+\w*GRAPH\w*VERSION\w*\s*=\s*["'`]v\d+\.\d+["'`]/.test(
        readFileSync(join(here, f), "utf8"),
      ),
    );
    expect(own).toEqual([]);
  });
});
