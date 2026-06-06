/**
 * ResolveIntellisearchPanel e2e — verifiserer at panelet i Story-tab
 * håndterer alle tilstandene: tom (CTA), feil, og treff med data.
 *
 * Bruker tauri-mock for å overstyre `resolve.readIntellisearch`-svar.
 */

import { test, expect } from "@playwright/test";
import { installTauriMock, SAMPLE_PICKS } from "./fixtures/tauri-mock";

test.describe("ResolveIntellisearchPanel", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installTauriMock, { picks: SAMPLE_PICKS });
    await page.goto("/?test=story");
    await expect(page.getByTestId("story-view")).toBeVisible({ timeout: 10_000 });
  });

  test("Renders i Story-tab right rail", async ({ page }) => {
    await expect(page.getByTestId("resolve-intellisearch-panel")).toBeVisible();
    await expect(page.getByText("Resolve AI IntelliSearch")).toBeVisible();
    await expect(page.getByText("RESOLVE 21")).toBeVisible();
  });

  test("Default state viser refresh-CTA (autoFetch=false)", async ({ page }) => {
    // autoFetch=false → ingen kall ved mount, viser bare Refresh-knapp
    await expect(page.getByTestId("resolve-is-refresh")).toBeVisible();
    await expect(page.getByText("Trykk Refresh")).toBeVisible();
  });

  test("Refresh + found:false → CTA med 3-stegs-instruksjoner", async ({ page }) => {
    await page.evaluate(() => {
      const original = (globalThis as any).__TAURI_INTERNALS__.invoke;
      (globalThis as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: unknown) => {
        if (cmd === "photoshop_send_command") {
          const a = args as { command: string };
          if (a.command === "resolve.readIntellisearch") {
            return { found: false, hint: "Ingen analyse-filer enda." };
          }
        }
        return original(cmd, args);
      };
    });
    await page.getByTestId("resolve-is-refresh").click();
    await expect(page.getByTestId("resolve-is-empty")).toBeVisible();
    await expect(page.getByText("Ingen analyse enda")).toBeVisible();
    await expect(page.getByText(/analyze-intellisearch/)).toBeVisible();
  });

  test("Refresh + found:true → viser items + summary", async ({ page }) => {
    await page.evaluate(() => {
      const original = (globalThis as any).__TAURI_INTERNALS__.invoke;
      (globalThis as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: unknown) => {
        if (cmd === "photoshop_send_command") {
          const a = args as { command: string };
          if (a.command === "resolve.readIntellisearch") {
            return {
              found: true,
              file: "/Users/test/PostAgent/intellisearch/bryllup_123.json",
              schema_version: 1,
              project: "Bryllup Emma & Jonas",
              folder: "Master",
              epoch: 1717400000,
              mode: "faster",
              total: 3,
              items: [
                { media_pool_item_id: "id1", clip_name: "GH010053.MP4", file_path: "/footage/a.MP4", duration_frames: 12000, fps: 50, analyzed: true },
                { media_pool_item_id: "id2", clip_name: "GH010054.MP4", file_path: "/footage/b.MP4", duration_frames: 8000, fps: 50, analyzed: true },
                { media_pool_item_id: "id3", clip_name: "GH010055.MP4", file_path: "/footage/c.MP4", duration_frames: 5500, fps: 50, analyzed: true },
              ],
            };
          }
        }
        return original(cmd, args);
      };
    });
    await page.getByTestId("resolve-is-refresh").click();
    await expect(page.getByTestId("resolve-is-results")).toBeVisible();
    await expect(page.getByText(/3 klipp analysert/)).toBeVisible();
    await expect(page.getByText("Bryllup Emma & Jonas")).toBeVisible();
    await expect(page.getByTestId("resolve-is-item-id1")).toContainText("GH010053.MP4");
    await expect(page.getByTestId("resolve-is-item-id3")).toContainText("GH010055.MP4");
  });

  test("Feilrespons → viser error-box med warning-ikon", async ({ page }) => {
    await page.evaluate(() => {
      const original = (globalThis as any).__TAURI_INTERNALS__.invoke;
      (globalThis as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: unknown) => {
        if (cmd === "photoshop_send_command") {
          const a = args as { command: string };
          if (a.command === "resolve.readIntellisearch") {
            throw new Error("WS-bridge offline");
          }
        }
        return original(cmd, args);
      };
    });
    await page.getByTestId("resolve-is-refresh").click();
    await expect(page.getByTestId("resolve-is-error")).toBeVisible();
    await expect(page.getByTestId("resolve-is-error")).toContainText("WS-bridge offline");
  });
});
