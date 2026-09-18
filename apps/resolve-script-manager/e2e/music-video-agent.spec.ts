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
    const runSummary = (scriptId: string, value: unknown) => ({
      run_id: `mock-${scriptId}`,
      script_id: scriptId,
      exit_code: 0,
      succeeded: true,
      started_at: "",
      finished_at: "",
      dry_run: false,
      events: [{ type: "result", runId: `mock-${scriptId}`, value }],
    });
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
        const testWindow = window as unknown as {
          __resolveProjectId?: string;
          __scriptCalls?: Array<{ cmd: string; args?: Record<string, unknown> }>;
        };
        testWindow.__scriptCalls ??= [];
        testWindow.__scriptCalls.push({ cmd, args });
        if (cmd === "plugin:dialog|open") {
          return Promise.resolve("/tmp/fake-music-video-source.mp4");
        }
        if (cmd === "run_resolve_mcp_project_doctor") {
          const uniqueId = testWindow.__resolveProjectId ?? "project-mv-1";
          return Promise.resolve(runSummary("resolve-project-doctor", {
            schemaVersion: 1,
            skillId: "resolve-project-doctor",
            readOnly: true,
            resolve: { version: "21.1", page: "edit" },
            project: {
              name: uniqueId === "project-mv-1" ? "Music Project" : "Et annet prosjekt",
              uniqueId,
            },
            timeline: null,
            mediaPool: { clipCount: 8, folderCount: 2 },
            settings: { timelineFrameRate: "25" },
            findings: [{
              severity: "warning",
              code: "no_timeline",
              title: "Ingen aktiv timeline",
              detail: "En ny timeline skal opprettes.",
            }],
          }));
        }
        if (cmd === "execute_script" && args?.scriptId === "analyze_audio_beats") {
          const w = window as unknown as { __beatResult?: unknown };
          const value = w.__beatResult ?? {
            bpm: 128.4, confidence: 0.91, method: "librosa",
            beatTimes: [0.4, 0.9, 1.4], downbeatTimes: [0.4],
            beatsPerBar: 4, totalBars: 40, totalDurationSec: 210,
          };
          return Promise.resolve(runSummary("analyze_audio_beats", value));
        }
        if (cmd === "execute_script" && args?.scriptId === "detect_music_beats") {
          return Promise.resolve(runSummary("detect_music_beats", {
            bpm: 120,
            beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
            downbeats: [0, 2, 4],
            durationSec: 4.5,
            method: "librosa",
          }));
        }
        if (cmd === "execute_script" && args?.scriptId === "check_missing_media") {
          return Promise.resolve(runSummary("check_missing_media", {
            totalClips: 8,
            offlineCount: 0,
            missingAudioCount: 0,
            issues: [],
          }));
        }
        if (cmd === "execute_script" && args?.scriptId === "detect_song_sections") {
          return Promise.resolve(runSummary("detect_song_sections", {
            sectionCount: 2,
            labels: ["Intro", "Chorus"],
            sections: [
              { startSec: 0, endSec: 2, label: "Intro" },
              { startSec: 2, endSec: 4.5, label: "Chorus" },
            ],
          }));
        }
        if (cmd === "execute_script" && args?.scriptId === "assign_clips_to_beats") {
          return Promise.resolve(runSummary("assign_clips_to_beats", {
            segments: [
              {
                segmentIndex: 0, startSec: 0, endSec: 2, durationSec: 2,
                clipPath: "/tmp/performance-a.mov", clipName: "performance-a.mov",
                section: "intro", motionScore: 0.3, highlightScore: 0.5,
              },
              {
                segmentIndex: 1, startSec: 2, endSec: 4, durationSec: 2,
                clipPath: "/tmp/performance-b.mov", clipName: "performance-b.mov",
                section: "chorus", motionScore: 0.9, highlightScore: 0.9,
              },
            ],
            totalSegments: 2,
            uniqueClipsUsed: 2,
            averageSegmentDurationSec: 2,
          }));
        }
        if (cmd === "execute_script" && args?.scriptId === "align_clips_to_song_audio") {
          return Promise.resolve(runSummary("align_clips_to_song_audio", {
            matched: 2,
            skipped: 0,
            averageMatchConfidence: 0.91,
            segments: [
              {
                clipPath: "/tmp/performance-a.mov", clipName: "performance-a.mov",
                startSec: 0, endSec: 2.25, durationSec: 2.25, matchConfidence: 0.93,
              },
              {
                clipPath: "/tmp/performance-b.mov", clipName: "performance-b.mov",
                startSec: 1.75, endSec: 4.5, durationSec: 2.75, matchConfidence: 0.89,
              },
            ],
          }));
        }
        if (cmd === "execute_script" && args?.scriptId === "place_clips_on_beat_grid") {
          const params = args.params as {
            timelineName?: string;
            variantId?: string;
            segments?: unknown[];
          } | undefined;
          return Promise.resolve(runSummary("place_clips_on_beat_grid", {
            timelineCreated: true,
            timelineName: params?.timelineName ?? "Music Video — Music Video V2",
            timelineUniqueId: `timeline-${params?.variantId ?? "unknown"}`,
            projectUniqueId: "project-mv-1",
            variantId: params?.variantId,
            segmentsPlaced: params?.segments?.length ?? 2,
            segmentsSkipped: 0,
            transitionsAdded: params?.variantId === "narrative" ? 1 : 0,
            speedChangesApplied: params?.variantId === "social" ? 1 : 0,
            musicAdded: true,
            musicTrack: "A2",
            mutedTracks: ["A1"],
          }));
        }
        if (cmd === "execute_script" && args?.scriptId === "apply_music_video_look") {
          return Promise.resolve(runSummary("apply_music_video_look", {
            clipsProcessed: 2, skippedExisting: 0, errorCount: 0,
          }));
        }
        if (cmd === "execute_script" && args?.scriptId === "technical_qc") {
          const params = args.params as { mode?: string } | undefined;
          if (params?.mode === "sweep") {
            return Promise.resolve(runSummary("technical_qc", { counts: {} }));
          }
          if (params?.mode === "color") {
            return Promise.resolve(runSummary("technical_qc", { ungradedItems: 0, lutsMissing: [] }));
          }
          return Promise.resolve(runSummary("technical_qc", { clippedCandidates: [] }));
        }
        if (cmd === "execute_script" && args?.scriptId === "rollback_music_video_build") {
          return Promise.resolve(runSummary("rollback_music_video_build", {
            rolledBack: true, deletedCount: 3,
          }));
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

  test("lager tre storyboards og bygger, grader, QC-er og ruller tilbake først etter godkjenning", async ({ page }) => {
    await openMusicVideoAgent(page);
    await page.getByRole("button", { name: "Music Video Editor", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Music Video Editor" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Analyser + lag 3 storyboards" }).click();

    await expect(dialog.getByText("Coverage-analyse · Music Project")).toBeVisible();
    await expect(dialog.getByText("100/100", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Performance Cut", { exact: true }).first()).toBeVisible();
    await expect(dialog.getByText("Narrative Cut", { exact: true }).first()).toBeVisible();
    await expect(dialog.getByText("High Energy Social Cut", { exact: true }).first()).toBeVisible();
    await expect(dialog.getByLabel("Storyboard preview")).toBeVisible();
    await expect(dialog.getByText(/120\.0 BPM · 9 beats · 2 seksjoner · 3 timelines/)).toBeVisible();

    const callsBeforeApproval = await page.evaluate(() => (
      (window as unknown as { __scriptCalls?: Array<{ args?: { scriptId?: string } }> }).__scriptCalls ?? []
    ).map((call) => call.args?.scriptId).filter(Boolean));
    expect(callsBeforeApproval).not.toContain("place_clips_on_beat_grid");
    const assignmentSections = await page.evaluate(() => {
      const calls = (window as unknown as {
        __scriptCalls?: Array<{ args?: { scriptId?: string; params?: { sections?: unknown[] } } }>;
      }).__scriptCalls ?? [];
      return calls.find((call) => call.args?.scriptId === "assign_clips_to_beats")?.args?.params?.sections;
    });
    expect(assignmentSections).toHaveLength(2);

    const buildButton = dialog.getByRole("button", { name: /Godkjenn \+ bygg 3 timelines/ });
    await expect(buildButton).toBeDisabled();
    await dialog.getByLabel(/Jeg godkjenner de valgte timeline-/).check();
    await buildButton.click();

    await expect(dialog.getByText("✓ 3 Music Video-timelines opprettet")).toBeVisible();
    await expect(dialog.getByText(/Performance Cut»/)).toBeVisible();
    await expect(dialog.getByText(/Narrative Cut»/)).toBeVisible();
    await expect(dialog.getByText(/High Energy Social 9x16»/)).toBeVisible();
    await expect(dialog.getByText("Teknisk QC, farge og lyd er ren.").first()).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Analyser hele planen på nytt" })).toBeDisabled();
    await expect(buildButton).toBeDisabled();
    const writeCalls = await page.evaluate(() => (
      (window as unknown as { __scriptCalls?: Array<{ args?: { scriptId?: string } }> }).__scriptCalls ?? []
    ).map((call) => call.args?.scriptId).filter(Boolean));
    expect(writeCalls.filter((id) => id === "place_clips_on_beat_grid")).toHaveLength(3);
    expect(writeCalls.filter((id) => id === "apply_music_video_look")).toHaveLength(3);
    expect(writeCalls.filter((id) => id === "technical_qc")).toHaveLength(9);

    page.once("dialog", (prompt) => prompt.accept());
    await dialog.getByRole("button", { name: "Angre denne builden" }).click();
    await expect(dialog.getByText("Builden er angret")).toBeVisible();
    const callsAfterRollback = await page.evaluate(() => (
      (window as unknown as { __scriptCalls?: Array<{ args?: { scriptId?: string } }> }).__scriptCalls ?? []
    ).map((call) => call.args?.scriptId).filter(Boolean));
    expect(callsAfterRollback.filter((id) => id === "rollback_music_video_build")).toHaveLength(1);
  });

  test("stopper bygging hvis brukeren bytter Resolve-prosjekt etter analysen", async ({ page }) => {
    await openMusicVideoAgent(page);
    await page.getByRole("button", { name: "Music Video Editor", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Music Video Editor" });
    await dialog.getByRole("button", { name: "Analyser + lag 3 storyboards" }).click();
    await expect(dialog.getByText("Coverage-analyse · Music Project")).toBeVisible();
    await dialog.getByLabel(/Jeg godkjenner de valgte timeline-/).check();

    await page.evaluate(() => {
      (window as unknown as { __resolveProjectId?: string }).__resolveProjectId = "project-mv-2";
    });
    await dialog.getByRole("button", { name: /Godkjenn \+ bygg 3 timelines/ }).click();

    await expect(dialog.getByRole("alert")).toContainText("Aktivt Resolve-prosjekt er byttet");
    const writeCalls = await page.evaluate(() => (
      (window as unknown as { __scriptCalls?: Array<{ args?: { scriptId?: string } }> }).__scriptCalls ?? []
    ).map((call) => call.args?.scriptId).filter(Boolean));
    expect(writeCalls).not.toContain("place_clips_on_beat_grid");
  });
});
