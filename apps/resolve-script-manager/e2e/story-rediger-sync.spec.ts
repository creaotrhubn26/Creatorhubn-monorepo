/**
 * Bidirectional sync mellom Story og Rediger.
 *
 * Story-tab og Rediger-tab deler samme `focusedPickIdx`-state i
 * CreativeEditorView. Disse testene verifiserer at klikk i én fane
 * speiles til den andre — uten round-tripping må man passe på at:
 *   1. Klikk thumb i Story → bytt til Rediger → samme pick er aktiv
 *   2. Klikk pick i Rediger → bytt til Story → samme thumb har outline
 *   3. Bytte tab nullstiller ikke state (focused-pick beholdes)
 *
 * Testene mounter `StoryTestHarness` som er en minimal versjon av
 * CreativeEditorView med en speilende Rediger-pick-strip.
 */

import { test, expect } from "@playwright/test";
import { installTauriMock, SAMPLE_PICKS } from "./fixtures/tauri-mock";

test.describe("Story ↔ Rediger sync", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installTauriMock, { picks: SAMPLE_PICKS });
    await page.goto("/?test=story");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("story-view")).toBeVisible({ timeout: 10_000 });
  });

  test("Klikk thumb i Story → samme pick aktiv i Rediger", async ({ page }) => {
    // Klikk pick #3 (ceremony — peak-beat) i Story Arc-strip
    await page.getByTestId("story-thumb-3").click();

    // Bytt til Rediger
    await page.locator(".ce-tab", { hasText: "Rediger" }).click();
    await expect(page.getByTestId("rediger-view")).toBeVisible();

    // Verifiser samme pick er aktiv
    await expect(page.getByTestId("rediger-focused-label")).toContainText("#3");
    await expect(page.getByTestId("rediger-pick-3")).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("rediger-pick-0")).toHaveAttribute("data-active", "false");
  });

  test("Klikk pick i Rediger → samme thumb fokusert i Story", async ({ page }) => {
    // Start i Rediger
    await page.locator(".ce-tab", { hasText: "Rediger" }).click();
    await expect(page.getByTestId("rediger-view")).toBeVisible();

    // Klikk pick #5 (dance — celebration-beat)
    await page.getByTestId("rediger-pick-5").click();
    await expect(page.getByTestId("rediger-pick-5")).toHaveAttribute("data-active", "true");

    // Bytt tilbake til Story
    await page.locator(".ce-tab", { hasText: "Story" }).click();
    await expect(page.getByTestId("story-view")).toBeVisible();

    // Verifiser at thumb #5 har focus-outline (style sjekkes via getAttribute("style"))
    const thumb5 = page.getByTestId("story-thumb-5");
    await expect(thumb5).toBeVisible();
    const style = await thumb5.getAttribute("style");
    expect(style).toContain("rgb(244, 114, 182)"); // #f472b6 — pink focus-outline
  });

  test("Tab-bytte nullstiller IKKE focused-pick", async ({ page }) => {
    // Klikk thumb #2 i Story
    await page.getByTestId("story-thumb-2").click();

    // Bytt frem og tilbake flere ganger
    await page.locator(".ce-tab", { hasText: "Rediger" }).click();
    await page.locator(".ce-tab", { hasText: "Story" }).click();
    await page.locator(".ce-tab", { hasText: "Rediger" }).click();

    // Skal fortsatt være #2
    await expect(page.getByTestId("rediger-focused-label")).toContainText("#2");
    await expect(page.getByTestId("rediger-pick-2")).toHaveAttribute("data-active", "true");
  });

  test("Klikk én pick fjerner focus fra annen pick", async ({ page }) => {
    // Klikk #1
    await page.getByTestId("story-thumb-1").click();
    await page.locator(".ce-tab", { hasText: "Rediger" }).click();
    await expect(page.getByTestId("rediger-pick-1")).toHaveAttribute("data-active", "true");

    // Klikk #4
    await page.getByTestId("rediger-pick-4").click();
    await expect(page.getByTestId("rediger-pick-4")).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("rediger-pick-1")).toHaveAttribute("data-active", "false");

    // Tilbake til Story — kun #4 skal ha pink outline
    await page.locator(".ce-tab", { hasText: "Story" }).click();
    const thumb4Style = await page.getByTestId("story-thumb-4").getAttribute("style");
    const thumb1Style = await page.getByTestId("story-thumb-1").getAttribute("style");
    expect(thumb4Style).toContain("rgb(244, 114, 182)");
    expect(thumb1Style).not.toContain("rgb(244, 114, 182)");
  });
});
