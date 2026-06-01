/**
 * Claude Story Director live-flyten — mocker post-agent-proxy-respons
 * og verifiserer at:
 *   1. Anbefalingene byttes ut med Claude-svaret
 *   2. Badge skifter fra "BETA" → "LIVE"
 *   3. Hvis Claude returnerer ugyldig JSON → fallback til heuristikk
 *      med "OFFLINE"-badge
 *   4. Hvis Claude-endpoint feiler (HTTP 500) → fallback-badge + error
 *
 * For å unngå nettverks-flakk i strukturelle tester aktiverer vi
 * Claude først her — `installTauriMock` skrur det av som default.
 */

import { test, expect } from "@playwright/test";
import { installTauriMock, SAMPLE_PICKS } from "./fixtures/tauri-mock";

const CLAUDE_URL_RE = /post-agent\/anthropic\/messages/;

function enableClaude() {
  (globalThis as any).__POST_AGENT_DISABLE_CLAUDE__ = false;
}

test.describe("Story Director — Claude live", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installTauriMock, { picks: SAMPLE_PICKS });
    await page.addInitScript(enableClaude);
  });

  test("Claude-svar overstyrer heuristikken + viser LIVE-badge", async ({ page }) => {
    await page.route(CLAUDE_URL_RE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg_test",
          model: "claude-sonnet-4-6",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                summary: "Sterkt emosjonelt forløp med god rytme",
                recommendations: [
                  {
                    id: "claude-tighten-hook",
                    title: "Stram hook-en",
                    body: "De første 8 sekundene kan bli mer kompakte. Vurder å fjerne ett av forberedelses-klippene.",
                    category: "pacing",
                    actionCount: 2,
                  },
                  {
                    id: "claude-extend-dance",
                    title: "Forleng dansen",
                    body: "Den første dansen fortjener et lengre øyeblikk — historien lader opp men kuttes for fort.",
                    category: "emotion",
                  },
                ],
              }),
            },
          ],
        }),
      });
    });

    await page.goto("/?test=story");
    await expect(page.getByTestId("story-view")).toBeVisible({ timeout: 10_000 });

    // Vent på at Claude-svaret er prosessert
    const panel = page.getByTestId("story-director-panel");
    await expect(panel).toHaveAttribute("data-source", "claude", { timeout: 10_000 });

    // Badge er "LIVE"
    await expect(panel.locator("span", { hasText: "LIVE" })).toBeVisible();

    // Claude-anbefalingene vises
    await expect(page.getByTestId("recommendation-claude-tighten-hook")).toBeVisible();
    await expect(page.getByTestId("recommendation-claude-extend-dance")).toBeVisible();
    await expect(page.getByTestId("recommendation-claude-tighten-hook")).toContainText(
      "Stram hook-en",
    );

    // Summary fra Claude
    await expect(panel).toContainText("Sterkt emosjonelt forløp");
  });

  test("Ugyldig JSON-respons → fallback + OFFLINE-badge", async ({ page }) => {
    await page.route(CLAUDE_URL_RE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg_bad",
          model: "claude-sonnet-4-6",
          content: [{ type: "text", text: "dette er ikke JSON det er bare en setning" }],
        }),
      });
    });

    await page.goto("/?test=story");
    await expect(page.getByTestId("story-view")).toBeVisible({ timeout: 10_000 });

    const panel = page.getByTestId("story-director-panel");
    await expect(panel).toHaveAttribute("data-source", "fallback", { timeout: 10_000 });
    await expect(panel.locator("span", { hasText: "OFFLINE" })).toBeVisible();
    await expect(page.getByTestId("story-director-error")).toContainText(
      "Klarte ikke tolke",
    );
  });

  test("HTTP 500 → fallback + feilmelding fra error-state", async ({ page }) => {
    await page.route(CLAUDE_URL_RE, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "anthropic-proxy nede",
      });
    });

    await page.goto("/?test=story");
    await expect(page.getByTestId("story-view")).toBeVisible({ timeout: 10_000 });

    const panel = page.getByTestId("story-director-panel");
    await expect(panel).toHaveAttribute("data-source", "fallback", { timeout: 10_000 });
    await expect(page.getByTestId("story-director-error")).toContainText("HTTP 500");
  });

  test("HTTP 402 → fallback med abonnement-melding", async ({ page }) => {
    await page.route(CLAUDE_URL_RE, async (route) => {
      await route.fulfill({
        status: 402,
        contentType: "text/plain",
        body: "Payment required",
      });
    });

    await page.goto("/?test=story");
    await expect(page.getByTestId("story-view")).toBeVisible({ timeout: 10_000 });

    const panel = page.getByTestId("story-director-panel");
    await expect(panel).toHaveAttribute("data-source", "fallback", { timeout: 10_000 });
    await expect(page.getByTestId("story-director-error")).toContainText("Abonnement");
  });
});
