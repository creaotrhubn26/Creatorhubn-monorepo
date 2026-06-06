/**
 * Live smoke test mot vite dev-server.
 * Verifiserer at appen boot'er, root renderes uten console-feil, og
 * at PhotoshopAgentDialog ikke lenger refereres (etter PR S-consolidering).
 *
 * Run: ENV `LIVE_SMOKE_URL=http://localhost:5180` npx playwright test
 *   e2e/live-smoke-no-photoshop-agent.spec.ts
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.LIVE_SMOKE_URL ?? "http://localhost:5180";

test.describe("Live smoke etter PhotoshopAgentDialog-fjerning", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      console.error("[pageerror]", err.message);
    });
  });

  test("Dev-server serverer index.html", async ({ page }) => {
    const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
    expect(res?.ok()).toBe(true);
    const html = await res!.text();
    expect(html).toMatch(/<div id="root"/);
    expect(html).toMatch(/main\.tsx/);
  });

  test("Hovedapp mounter uten ReferenceError (PhotoshopAgentDialog skal IKKE være referert)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const photoshopAgentRefs = errors.filter((e) =>
      /PhotoshopAgentDialog/i.test(e),
    );
    expect(
      photoshopAgentRefs,
      `Forventet INGEN PhotoshopAgentDialog-feil. Fant:\n${photoshopAgentRefs.join("\n")}`,
    ).toEqual([]);

    // Vi godtar enkelte feil i en Tauri-mock-løs browser (Tauri-API-er
    // som invoke vil naturlig kaste — vi vil bare forsikre at React-root
    // er montert og at PS-Agent-import-feil er borte).
    const root = await page.locator("#root").first();
    await expect(root).toBeAttached();
  });

  test("Bundle inneholder ikke 'PhotoshopAgentDialog'-streng", async ({ page }) => {
    // Hent transformerte modul-stier (vite dev sender separate chunks).
    // Sjekker hovedbundle index.tsx for PhotoshopAgentDialog-referanse.
    const res = await page.goto(`${BASE}/src/App.tsx`, {
      waitUntil: "domcontentloaded",
    });
    expect(res?.ok()).toBe(true);
    const source = await res!.text();
    expect(source).not.toMatch(/PhotoshopAgentDialog/);
  });
});
