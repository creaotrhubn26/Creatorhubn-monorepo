/**
 * Recommendation-handling — verifiserer at "Se forslag"-knappen
 * faktisk gjør noe når den klikkes:
 *
 *   1. Heuristikk-anbefalingene har pickIndices avledet fra picks
 *      → klikk highlighter de relevante thumbs.
 *   2. Claude-anbefalinger med eksplisitte pickIndices → klikk
 *      highlighter NØYAKTIG de Claude pekte på.
 *   3. Manuell klikk på en thumb etterpå rydder highlights
 *      (single-action mental modell — én rec av gangen).
 */

import { test, expect } from "@playwright/test";
import { installTauriMock, SAMPLE_PICKS } from "./fixtures/tauri-mock";

const CLAUDE_URL_RE = /post-agent\/anthropic\/messages/;

test.describe("Story Director — recommendation actions", () => {
  test("Heuristikk-knapp highlighter relaterte picks", async ({ page }) => {
    // Default: Claude disabled, heuristikk kjører
    await page.addInitScript(installTauriMock, { picks: SAMPLE_PICKS });
    await page.goto("/?test=story");
    await expect(page.getByTestId("story-view")).toBeVisible({ timeout: 10_000 });

    // Sjekk at panel er på heuristikk-source
    const panel = page.getByTestId("story-director-panel");
    await expect(panel).toHaveAttribute("data-source", "heuristic");

    // Hver heuristikk-rec har et "Se forslag"-button. Klikk første.
    const firstRec = page.locator("[data-testid^='recommendation-']").first();
    await expect(firstRec).toBeVisible();
    await firstRec.locator("button", { hasText: /Se forslag/ }).click();

    // Minst én thumb skal nå være highlighted=true
    const highlightedThumbs = page.locator("[data-testid^='story-thumb-'][data-highlighted='true']");
    await expect(highlightedThumbs.first()).toBeVisible();
  });

  test("Claude-rec med pickIndices highlighter NØYAKTIG de picks", async ({ page }) => {
    (globalThis as any).__POST_AGENT_DISABLE_CLAUDE__ = false;
    await page.addInitScript(installTauriMock, { picks: SAMPLE_PICKS });
    await page.addInitScript(() => {
      (window as any).__POST_AGENT_DISABLE_CLAUDE__ = false;
    });

    await page.route(CLAUDE_URL_RE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg_action",
          model: "claude-sonnet-4-6",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                summary: "Test-summary",
                recommendations: [
                  {
                    id: "claude-tighten-build",
                    title: "Stram opp build-fasen",
                    body: "Pickene #2 og #4 puster ikke nok.",
                    category: "pacing",
                    pickIndices: [2, 4],
                  },
                ],
              }),
            },
          ],
        }),
      });
    });

    await page.goto("/?test=story");
    const panel = page.getByTestId("story-director-panel");
    await expect(panel).toHaveAttribute("data-source", "claude", { timeout: 10_000 });

    // Klikk Se forslag på Claude-rec-en
    await page.getByTestId("recommendation-claude-tighten-build")
      .locator("button", { hasText: /Se forslag/ })
      .click();

    // Begge pick #2 og #4 er i rec-set → data-highlighted="true"
    // (Outline-style differensierer: #2 får pink solid (focused),
    // #4 får lilla dashed.)
    await expect(page.getByTestId("story-thumb-2")).toHaveAttribute(
      "data-highlighted",
      "true",
    );
    await expect(page.getByTestId("story-thumb-4")).toHaveAttribute(
      "data-highlighted",
      "true",
    );

    // Pick som IKKE er i pickIndices skal være highlighted=false
    // (samplePicks viser 7 jevnt-fordelte picks — #0, #1, #2, #3, #4, #5, #6)
    await expect(page.getByTestId("story-thumb-0")).toHaveAttribute(
      "data-highlighted",
      "false",
    );
    await expect(page.getByTestId("story-thumb-6")).toHaveAttribute(
      "data-highlighted",
      "false",
    );

    // Sjekk at #2 er focusert (pink) via outline-style
    const thumb2Style = await page.getByTestId("story-thumb-2").getAttribute("style");
    expect(thumb2Style).toContain("rgb(244, 114, 182)"); // #f472b6 — focused pink
  });

  test("Manuell pick-klikk etterpå rydder highlights", async ({ page }) => {
    await page.addInitScript(installTauriMock, { picks: SAMPLE_PICKS });
    await page.goto("/?test=story");
    await expect(page.getByTestId("story-view")).toBeVisible({ timeout: 10_000 });

    // Trigger highlights via første rec
    await page.locator("[data-testid^='recommendation-']").first()
      .locator("button", { hasText: /Se forslag/ })
      .click();

    const someHighlighted = page.locator("[data-testid^='story-thumb-'][data-highlighted='true']");
    await expect(someHighlighted.first()).toBeVisible();

    // Klikk på en hvilken som helst thumb manuelt
    await page.getByTestId("story-thumb-6").click();

    // Highlights skal være ryddet
    await expect(someHighlighted).toHaveCount(0);
  });
});
