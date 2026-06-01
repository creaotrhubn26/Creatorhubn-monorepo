/**
 * AlternativeStoryDialog e2e — verifiserer at "Generer alternativ
 * historie"-knappen åpner en dialog som spør brukeren hva de ønsker
 * å endre, viser segmentene som kontekst, kaller Claude og lar
 * brukeren bruke forslaget.
 */

import { test, expect } from "@playwright/test";
import { installTauriMock, SAMPLE_PICKS } from "./fixtures/tauri-mock";

test.describe("Alternative Story Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installTauriMock, { picks: SAMPLE_PICKS });
    await page.goto("/?test=story");
    await expect(page.getByTestId("story-view")).toBeVisible({ timeout: 10_000 });
  });

  test("Klikk Generer-knapp åpner dialog med segmenter + tekstinput", async ({ page }) => {
    await page.getByTestId("generate-alternative-story").click();

    const dialog = page.getByTestId("alternative-story-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Er det noe spesielt du ønsker å endre på?");
    await expect(page.getByTestId("alt-wish-input")).toBeVisible();

    // Segmentene fra SAMPLE_PICKS skal være listet
    await expect(page.getByTestId("alt-segment-list")).toBeVisible();
    await expect(page.getByTestId("alt-segment-0")).toContainText("forberedelser");
    await expect(page.getByTestId("alt-segment-3")).toContainText("ceremony");
    await expect(page.getByTestId("alt-segment-7")).toContainText("outro");
  });

  test("Avbryt-knapp lukker dialog uten å endre noe", async ({ page }) => {
    await page.getByTestId("generate-alternative-story").click();
    await expect(page.getByTestId("alternative-story-dialog")).toBeVisible();

    await page.getByRole("button", { name: "Avbryt" }).click();
    await expect(page.getByTestId("alternative-story-dialog")).not.toBeVisible();
  });

  test("Skriv ønske → Generer → vis mock-result + Bruk → apply", async ({ page }) => {
    // Sett mock-respons (Claude er disablet i tauri-mock)
    await page.addInitScript(() => {
      (window as any).__POST_AGENT_TEST_ALT_RESPONSE__ = JSON.stringify({
        title: "Roligere oppbygging",
        summary: "Bytt fokus mot atmosfæriske detaljer før vielsen.",
        recommendations: [
          {
            id: "alt-slower-build",
            title: "Sakte oppbygging",
            body: "Bytt ut 2 av build-klippene med atmosfære.",
            category: "pacing",
            pickIndices: [2, 4],
          },
          {
            id: "alt-tighter-outro",
            title: "Mer poetisk outro",
            body: "Avslutt med et stille øyeblikk.",
            category: "ending",
            pickIndices: [7],
          },
        ],
      });
    });

    // Reload så addInitScript får effekt
    await page.reload();
    await expect(page.getByTestId("story-view")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("generate-alternative-story").click();
    await page.getByTestId("alt-wish-input").fill("Vil ha en roligere oppbygging");
    await page.getByTestId("alt-generate").click();

    // Result-view skal vises
    await expect(page.getByTestId("alt-result")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("alt-result")).toContainText("Roligere oppbygging");
    await expect(page.getByTestId("alt-rec-alt-slower-build")).toBeVisible();
    await expect(page.getByTestId("alt-rec-alt-tighter-outro")).toBeVisible();

    // Klikk "Bruk dette forslaget"
    await page.getByTestId("alt-apply").click();

    // Dialog skal lukkes
    await expect(page.getByTestId("alternative-story-dialog")).not.toBeVisible();

    // Highlights skal komme fra første rec (pickIndices: [2, 4])
    await expect(page.getByTestId("story-thumb-2")).toHaveAttribute(
      "data-highlighted",
      "true",
    );
    await expect(page.getByTestId("story-thumb-4")).toHaveAttribute(
      "data-highlighted",
      "true",
    );
  });

  test("Prøv igjen-knapp resetter til input-view", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__POST_AGENT_TEST_ALT_RESPONSE__ = JSON.stringify({
        title: "Mock",
        summary: "Mock summary",
        recommendations: [
          {
            id: "mock-1",
            title: "Mock-rec",
            body: "Mock body",
            category: "structure",
            pickIndices: [0],
          },
        ],
      });
    });
    await page.reload();
    await expect(page.getByTestId("story-view")).toBeVisible();

    await page.getByTestId("generate-alternative-story").click();
    await page.getByTestId("alt-generate").click();
    await expect(page.getByTestId("alt-result")).toBeVisible();

    await page.getByTestId("alt-try-again").click();
    await expect(page.getByTestId("alt-wish-input")).toBeVisible();
    await expect(page.getByTestId("alt-result")).not.toBeVisible();
  });

  test("Ugyldig Claude-respons → error vises i dialog", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__POST_AGENT_TEST_ALT_RESPONSE__ = "ikke gyldig JSON";
    });
    await page.reload();
    await expect(page.getByTestId("story-view")).toBeVisible();

    await page.getByTestId("generate-alternative-story").click();
    await page.getByTestId("alt-generate").click();

    await expect(page.getByTestId("alt-error")).toBeVisible();
    await expect(page.getByTestId("alt-error")).toContainText("Klarte ikke tolke");
  });
});
