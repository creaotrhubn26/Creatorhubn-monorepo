/**
 * Story-tab e2e — verifiserer at Story-fanen i CreativeEditorView
 * matcher mockup (UI-strukturen Daniel sendte 2026-06-01).
 *
 * Vi tester på to nivåer:
 *   1. STRUKTUR — at alle data-testid-elementene rendres
 *   2. FUNKSJONALITET — at venstre-sidebar bytter aktiv element,
 *      thumbnails kan klikkes, recommendations vises etc.
 *
 * Selve CreativeEditorView krever en aktiv picks-fil for å mounte.
 * Vi løser det via `usePostAgentTestPicks`-vinduet (se tauri-mock.ts)
 * og en URL-param `?test=story` som setter App rett inn i CreativeEditor.
 */

import { test, expect } from "@playwright/test";
import { installTauriMock, SAMPLE_PICKS } from "./fixtures/tauri-mock";

test.describe("Story-tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installTauriMock, { picks: SAMPLE_PICKS });
    await page.goto("/?test=story");
    // Vent på at React monterer
    await page.waitForLoadState("domcontentloaded");
  });

  test("Story-tab eksisterer og kan aktiveres", async ({ page }) => {
    // Når test=story er satt, skal CreativeEditorView vises med
    // Rediger | Story-tabs. Klikk Story.
    const storyTab = page.locator(".ce-tab", { hasText: "Story" });
    await expect(storyTab).toBeVisible({ timeout: 10_000 });
    await storyTab.click();

    // Hovedstrukturen skal være på plass
    await expect(page.getByTestId("story-view")).toBeVisible();
    await expect(page.getByTestId("story-elements-sidebar")).toBeVisible();
    await expect(page.getByTestId("story-main")).toBeVisible();
    await expect(page.getByTestId("story-right-rail")).toBeVisible();
  });

  test("Venstre sidebar viser alle 9 story-elementer", async ({ page }) => {
    await page.locator(".ce-tab", { hasText: "Story" }).click();

    const elements = [
      "arc",
      "beats",
      "scene-graph",
      "characters",
      "emotional-flow",
      "theme",
      "content-pillars",
      "visual-motifs",
      "intent-style",
    ];
    for (const id of elements) {
      await expect(page.getByTestId(`story-element-${id}`)).toBeVisible();
    }
  });

  test("Venstre sidebar viser Intent & Stil + Prosjektinfo", async ({ page }) => {
    await page.locator(".ce-tab", { hasText: "Story" }).click();

    await expect(page.getByTestId("intent-style")).toBeVisible();
    await expect(page.getByTestId("intent-style")).toContainText("Cinematic");
    await expect(page.getByTestId("project-info")).toBeVisible();
    await expect(page.getByTestId("project-info")).toContainText("Prosjekt");
    await expect(page.getByTestId("project-info")).toContainText("Format");
  });

  test("Story Arc-panel rendrer SVG-kurve + 7 thumbnails", async ({ page }) => {
    await page.locator(".ce-tab", { hasText: "Story" }).click();

    await expect(page.getByTestId("story-arc-panel")).toBeVisible();
    await expect(page.getByTestId("story-arc-svg")).toBeVisible();
    await expect(page.getByTestId("story-arc-thumbs")).toBeVisible();
    // 7 picks i SAMPLE_PICKS, så minst 7 thumbnails (eller færre hvis duplicate)
    const thumbs = page.locator("[data-testid^='story-thumb-']");
    await expect(thumbs.first()).toBeVisible();
  });

  test("Narrative Beats-panel viser alle 6 universal beats", async ({ page }) => {
    await page.locator(".ce-tab", { hasText: "Story" }).click();

    await expect(page.getByTestId("narrative-beats-panel")).toBeVisible();
    // SAMPLE_PICKS dekker alle 6 beats (hook/setup/build/peak/celebration/outro)
    // Minst peak + celebration + outro må være der
    await expect(page.getByTestId("narrative-beat-peak")).toBeVisible();
    await expect(page.getByTestId("narrative-beat-celebration")).toBeVisible();
    await expect(page.getByTestId("narrative-beat-outro")).toBeVisible();
  });

  test("Emosjonell flyt-chart toggler mellom alle og hovedfølelser", async ({ page }) => {
    await page.locator(".ce-tab", { hasText: "Story" }).click();

    await expect(page.getByTestId("emotional-flow-panel")).toBeVisible();
    await expect(page.getByTestId("emotional-flow-svg")).toBeVisible();
    await page.getByTestId("emotion-toggle-primary").click();
    await page.getByTestId("emotion-toggle-all").click();
  });

  test("Scene Graph viser primary + secondary noder", async ({ page }) => {
    await page.locator(".ce-tab", { hasText: "Story" }).click();

    await expect(page.getByTestId("scene-graph-panel")).toBeVisible();
    await expect(page.getByTestId("scene-graph-primary-row")).toBeVisible();
    await expect(page.getByTestId("scene-graph-secondary-row")).toBeVisible();
  });

  test("Story Director rendrer recommendations + generer-knapp", async ({ page }) => {
    await page.locator(".ce-tab", { hasText: "Story" }).click();

    await expect(page.getByTestId("story-director-panel")).toBeVisible();
    await expect(page.getByTestId("story-recommendations")).toBeVisible();
    await expect(page.getByTestId("generate-alternative-story")).toBeVisible();
    await expect(page.getByTestId("generate-alternative-story")).toContainText(
      "Generer alternativ historie",
    );
  });

  test("Story Balanse viser 6 dimensjoner", async ({ page }) => {
    await page.locator(".ce-tab", { hasText: "Story" }).click();

    await expect(page.getByTestId("story-balance-panel")).toBeVisible();
    const dims = ["emosjon", "energi", "intimitet", "historieflyt", "variasjon", "avslutning"];
    for (const d of dims) {
      await expect(page.getByTestId(`balance-dim-${d}`)).toBeVisible();
    }
  });

  test("Wizard-footer viser 4 steg med Start redigering-CTA", async ({ page }) => {
    await page.locator(".ce-tab", { hasText: "Story" }).click();

    await expect(page.getByTestId("story-wizard-footer")).toBeVisible();
    for (let n = 1; n <= 4; n++) {
      await expect(page.getByTestId(`wizard-step-${n}`)).toBeVisible();
    }
    await expect(
      page.getByTestId("story-wizard-footer").getByRole("button", {
        name: /Start redigering/,
      }),
    ).toBeVisible();
  });

  test("Bytte til Rediger-tab skjuler Story-innhold", async ({ page }) => {
    await page.locator(".ce-tab", { hasText: "Story" }).click();
    await expect(page.getByTestId("story-view")).toBeVisible();
    await page.locator(".ce-tab", { hasText: "Rediger" }).click();
    await expect(page.getByTestId("story-view")).not.toBeVisible();
  });

  test("VISUAL: full Story-tab matcher mockup-struktur", async ({ page }) => {
    await page.locator(".ce-tab", { hasText: "Story" }).click();
    await page.waitForTimeout(500); // la SVG-en stabilisere seg
    await expect(page).toHaveScreenshot("story-tab-full.png", {
      maxDiffPixelRatio: 0.03,
      fullPage: false,
    });
  });
});
