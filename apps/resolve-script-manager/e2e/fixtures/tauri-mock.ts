/**
 * Tauri-mock for Playwright tester — installeres FØR React monteres
 * slik at `invoke()`-kall fra services/components returnerer fornuftige
 * defaults i stedet for å crashe.
 *
 * Bruk: `await page.addInitScript(installTauriMock, { picks: [...] })`
 */

export interface MockOptions {
  picks?: Array<{
    index: number;
    startSec: number;
    endSec: number;
    durationSec: number;
    score: number;
    chapter?: string;
    thumbnailPath?: string;
    signals?: Record<string, number>;
  }>;
  sourceVideo?: string;
}

export function installTauriMock(opts: MockOptions = {}) {
  const responses: Record<string, unknown> = {
    photoshop_status: { connected: false, plugin_version: null, photoshop_version: null, port: 1733 },
    creation_list: [],
    list_workflows: {},
    list_scripts: { scripts: [] },
    list_project_templates: { templates: [] },
    list_look_packs: {},
    list_mounted_cards: [],
    list_watched_folders: [],
    list_cull_sessions: [],
    list_running_scripts: [],
    get_app_settings: {},
    get_app_data_dir: "/tmp",
    get_run_history: [],
    get_python_root: "/tmp/python",
    read_learning_profile: { global: {}, projects: {}, recentSessions: [] },
    photoshop_setup_status: {
      photoshop_installed: false,
      photoshop_path: null,
      photoshop_version: null,
      udt_installed: false,
      udt_path: null,
      plugin_manifest_path: null,
      plugin_manifest_exists: false,
    },
    run_health_check: { run_id: "mock", succeeded: true, events: [], exit_code: 0 },
  };

  // Bruker globalThis så det fungerer på tvers av Tauri v1/v2 patterns
  (globalThis as any).__TAURI_INTERNALS__ = {
    invoke: async (cmd: string, _args?: unknown) => {
      if (cmd in responses) return responses[cmd];
      console.warn(`[tauri-mock] uventet invoke: ${cmd}`);
      return null;
    },
    convertFileSrc: (path: string) => `file://${path}`,
  };

  // localStorage for tests
  localStorage.setItem("trrpa.firstRunComplete", "skipped");
  localStorage.setItem(
    "trrpa.settings",
    JSON.stringify({ RR_BEARER_TOKEN: "test-token" }),
  );

  // Skru av Claude Story Director-kall som default — eksisterende
  // strukturelle tester skal kjøre på heuristikken (ingen nettverks-
  // flakkete). Tester som vil verifisere Claude-respons setter dette
  // til false og mocker fetch via page.route() i stedet.
  (globalThis as any).__POST_AGENT_DISABLE_CLAUDE__ = true;

  // Inject mock picks så CreativeEditorView kan laste dem fra en kjent path
  if (opts.picks && opts.picks.length > 0) {
    const payload = {
      sourceVideo: opts.sourceVideo ?? "mock-video.mp4",
      totalDurationSec: opts.picks[opts.picks.length - 1]?.endSec ?? 60,
      picks: opts.picks,
    };
    (globalThis as any).__POST_AGENT_TEST_PICKS__ = payload;
  }
}

/**
 * Standard test-picks som dekker alle universal beats — slik at
 * Story-fanen har data å vise.
 */
export const SAMPLE_PICKS = [
  { index: 0, startSec: 0, endSec: 8, durationSec: 8, score: 0.7, chapter: "forberedelser", signals: { faces: 0.6, bokeh: 0.5 } },
  { index: 1, startSec: 8, endSec: 16, durationSec: 8, score: 0.65, chapter: "details", signals: { bokeh: 0.8 } },
  { index: 2, startSec: 16, endSec: 28, durationSec: 12, score: 0.8, chapter: "first-look", signals: { faces: 0.8, emotional_peak: 0.7 } },
  { index: 3, startSec: 28, endSec: 45, durationSec: 17, score: 0.95, chapter: "ceremony", signals: { emotional_peak: 0.95, faces: 0.9 } },
  { index: 4, startSec: 45, endSec: 75, durationSec: 30, score: 0.85, chapter: "speeches", signals: { audio_events: 0.8, faces: 0.7 } },
  { index: 5, startSec: 75, endSec: 110, durationSec: 35, score: 0.9, chapter: "dance", signals: { action: 0.85, audio_events: 0.9 } },
  { index: 6, startSec: 110, endSec: 140, durationSec: 30, score: 0.75, chapter: "party", signals: { action: 0.7, audio_events: 0.95 } },
  { index: 7, startSec: 140, endSec: 165, durationSec: 25, score: 0.7, chapter: "outro", signals: { bokeh: 0.8, slowmo: 0.6 } },
];
