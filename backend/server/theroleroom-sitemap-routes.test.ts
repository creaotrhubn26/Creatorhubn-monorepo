/**
 * theroleroom-sitemap-routes.test.ts
 *
 * Håndhever at STATIC_URLS i sitemapen speiler pillar-sidene i
 * frontend/client/src/components/admin/content-marketing/marketingPagesConfig.ts:
 *
 *   - hver side med published: true SKAL ligge i sitemapen
 *   - sider med published: false skal IKKE ligge der
 *
 * Bakgrunn (17.07.2026): /verktoy-for-filmutdanninger og
 * /norsk-casting-prosess manglet i den hardkodede lista i én måned+,
 * mens upubliserte /casting-rapport-2026 lå inne — crawlere fant ikke
 * de nyeste GEO-sidene. Testen parser frontend-configen med regex
 * (kryss-workspace import er ikke mulig), så den er robust mot
 * innholdsendringer men avhengig av feltrekkefølgen key/path/published.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STATIC_URLS } from "./theroleroom-sitemap-routes";

const CONFIG_PATH = resolve(
  __dirname,
  "../../frontend/client/src/components/admin/content-marketing/marketingPagesConfig.ts",
);

function readPillarPages(): Array<{ path: string; published: boolean }> {
  const src = readFileSync(CONFIG_PATH, "utf8");
  const matches = [...src.matchAll(/key: '([^']+)',\s*path: '([^']+)',[\s\S]*?published: (true|false)/g)];
  return matches.map((m) => ({ path: m[2], published: m[3] === "true" }));
}

describe("theroleroom-sitemap pillar-synk", () => {
  const pages = readPillarPages();
  const sitemapLocs = new Set(STATIC_URLS.map((u) => u.loc));

  it("finner pillar-sidene i frontend-configen", () => {
    // Regex-parsingen må treffe — 20 sider per 17.07.2026, kun vokse.
    expect(pages.length).toBeGreaterThanOrEqual(20);
  });

  it("alle publiserte pillar-sider ligger i sitemapen", () => {
    const missing = pages.filter((p) => p.published && !sitemapLocs.has(p.path)).map((p) => p.path);
    expect(missing).toEqual([]);
  });

  it("upubliserte pillar-sider ligger IKKE i sitemapen", () => {
    const leaked = pages.filter((p) => !p.published && sitemapLocs.has(p.path)).map((p) => p.path);
    expect(leaked).toEqual([]);
  });
});
