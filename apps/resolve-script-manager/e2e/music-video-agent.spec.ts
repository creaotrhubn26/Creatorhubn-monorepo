import { test, expect, type Page } from "@playwright/test";

/**
 * E2E for Music Video Agent (AgentEditorView, music_video-kind).
 *
 * Dekker den ekte brukerflyten: pålogging (mocket /me) → agent-kort på Home
 * (ekte signedIn-gating, ikke omgått) → native fildialog (mocket invoke) →
 * AgentEditorView åpner → sang-struktur/look-packs rendres → BPM-input og
 * auto-detect. Skrevet etter en QA-runde som fant to reelle bugs, begge
 * dekket her som regresjonstester:
 *   1. BPM/sang-lengde-input tok imot negative/urimelige verdier direkte
 *      (kun kosmetisk min/max på <input type="number">) → fikset med
 *      Math.min/max-klemming i onChange.
 *   2. Samme klemming manglet på auto-detect-resultatet (et falskt/urealistisk
 *      script-resultat kunne sette bpm-state utenfor det UI-en støtter).
 */

async function installMocks(page: Page) {
  await page.addInitScript(() => {
    const responses: Record<string, unknown> = {
      list_scripts: { categories: [], scripts: [] },
      list_workflows: {},
      list_project_templates: { templates: [] },
      list_look_packs: { packs: [] },
      get_run_history: [],
      get_app_settings: {},
      get_app_data_dir: "/tmp",
      creation_list: [],
    };
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
      invoke: (cmd: string, args?: Record<string, unknown>) => {
        if (cmd === "plugin:dialog|open") {
          return Promise.resolve("/tmp/fake-music-video-source.mp4");
        }
        if (cmd === "execute_script" && args?.scriptId === "analyze_audio_beats") {
          const w = window as unknown as { __beatResult?: unknown };
          const value = w.__beatResult ?? {
            bpm: 128.4, confidence: 0.91, method: "librosa",
            beatTimes: [0.4, 0.9, 1.4], downbeatTimes: [0.4],
            beatsPerBar: 4, totalBars: 40, totalDurationSec: 210,
          };
          return Promise.resolve({
            run_id: "mock-run", script_id: "analyze_audio_beats", exit_code: 0,
            succeeded: true, started_at: "", finished_at: "", dry_run: false,
            events: [{ type: "result", runId: "mock-run", value }],
          });
        }
        if (cmd in responses) return Promise.resolve(responses[cmd]);
        if (cmd.startsWith("plugin:event|")) return Promise.resolve(0);
        return Promise.resolve({});
      },
      transformCallback: () => 1,
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
      convertFileSrc: (path: string) => `file://${path}`,
    };
    (window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__: unknown }).__TAURI_EVENT_PLUGIN_INTERNALS__ =
      { unregisterListener: () => {} };
    localStorage.setItem("trrpa.firstRunComplete", "skipped");
    localStorage.setItem("trrpa.photoshopTourCompleted", "1");
    localStorage.setItem("trrpa.settings", JSON.stringify({ RR_BEARER_TOKEN: "test-token" }));
  });

  await page.route("**/api/post-agent/me", (route) =>
    route.fulfill({ json: { id: "u1", email: "t@test.no", name: "Test Bruker", role: "producer" } }));
  await page.route("**/api/post-agent/entitlements**", (route) =>
    route.fulfill({ json: { modules: [] } }));
  await page.route("**/api/role-room/profile/me", (route) =>
    route.fulfill({ json: { profile: null } }));
}

async function openMusicVideoAgent(page: Page) {
  await page.goto("/");
  const card = page.getByText("Music Video Agent", { exact: true });
  await expect(card).toBeVisible({ timeout: 10000 });
  await card.click();
  // AgentEditorView-headeren viser agent-navnet fra config.primaryAgent.
  await expect(page.getByText("Music Video Director").first()).toBeVisible({ timeout: 10000 });
}

test.describe("Music Video Agent", () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page);
  });

  test("sang-struktur + BPM-grid + genre-look-packs rendres", async ({ page }) => {
    await openMusicVideoAgent(page);
    await expect(page.getByText("SANG-STRUKTUR", { exact: true })).toBeVisible();
    await expect(page.getByText("Chorus / Hook")).toBeVisible();
    await expect(page.getByText("Bridge / Breakdown")).toBeVisible();
    await expect(page.getByText("BEAT-GRID", { exact: true })).toBeVisible();
    await expect(page.getByText("GENRE / LOOK")).toBeVisible();
    await expect(page.getByText("Neon Night")).toBeVisible();
  });

  test("BPM-input klemmes til 60-220 (regresjon: tok tidligere imot negative verdier)", async ({ page }) => {
    await openMusicVideoAgent(page);
    const bpmInput = page.locator('input[type="number"][min="60"][max="220"]').first();
    await bpmInput.fill("-5");
    await bpmInput.blur();
    await expect(bpmInput).toHaveValue("60");

    await bpmInput.fill("9999");
    await bpmInput.blur();
    await expect(bpmInput).toHaveValue("220");
  });

  test("sang-lengde klemmes til 30-600 sek (samme regresjon)", async ({ page }) => {
    await openMusicVideoAgent(page);
    const lenInput = page.locator('input[type="number"][min="30"][max="600"]').first();
    await lenInput.fill("-100");
    await lenInput.blur();
    await expect(lenInput).toHaveValue("30");

    await lenInput.fill("50000");
    await lenInput.blur();
    await expect(lenInput).toHaveValue("600");
  });

  test("Auto-detect BPM viser resultat og klemmer urealistisk høy BPM inn i støttet range", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __beatResult: unknown }).__beatResult = {
        bpm: 999, confidence: 0.85, method: "librosa",
        beatTimes: [0.1], downbeatTimes: [0.1], beatsPerBar: 4,
        totalBars: 200, totalDurationSec: 210,
      };
    });
    await openMusicVideoAgent(page);
    await page.getByText("Auto-detect BPM").click();
    await expect(page.getByText(/Detekteret:/)).toBeVisible({ timeout: 10000 });
    // Visnings-teksten viser rå-verdien fra scriptet (informativt) …
    await expect(page.getByText(/999 BPM/)).toBeVisible();
    // … men selve arbeids-state-en (input-feltet brukt til beat-grid-matte) klemmes.
    const bpmInput = page.locator('input[type="number"][min="60"][max="220"]').first();
    await expect(bpmInput).toHaveValue("220");
  });

  test("velger et annet kapittel og en annen look-pack", async ({ page }) => {
    await openMusicVideoAgent(page);
    await page.getByText("Verse 2", { exact: true }).click();
    await expect(page.getByText("Andre vers", { exact: false })).toBeVisible();
    await page.getByText("Gritty Documentary").click();
    await expect(page.getByText("Desaturert, film-grain, rå", { exact: false })).toBeVisible();
  });
});
