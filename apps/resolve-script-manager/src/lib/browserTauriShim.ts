/**
 * browserTauriShim.ts — dev/test-modus.
 *
 * Lar appen boote i en vanlig nettleser (uten Tauri) ved å mocke
 * `window.__TAURI_INTERNALS__.invoke` med trygge, form-korrekte tomme defaults.
 * Alle invoke-kall (api.ts + @tauri-apps/api/event) går gjennom dette chokepointet,
 * så én mock dekker hele appen. Brukes for Playwright-E2E av rene UI-moduler (Mockup
 * Studio, bibliotek osv.) uten native-vindu.
 *
 * Installeres KUN når Tauri mangler: den native appen injiserer __TAURI_INTERNALS__
 * FØR app-JS lastes, så shim-en hopper over der og rører aldri ekte drift.
 */

type Any = Record<string, unknown> | unknown[];

// Form-korrekte tomme svar for boot- + vanlige kommandoer (se types.ts).
const MOCKS: Record<string, Any> = {
  list_scripts: { categories: [], scripts: [] }, // Registry
  list_workflows: {}, // WorkflowMap (Record)
  list_project_templates: { templates: [] },
  list_look_packs: { packs: [] },
  get_run_history: [],
  list_simulators: [],
  playwright_status: { installed: false, chromiumInstalled: false },
};
// Kommandoer som returnerer en liste (default hvis ikke i MOCKS).
const ARRAY_CMDS = new Set(['get_run_history', 'list_simulators', 'list_recent_media', 'list_broll', 'list_captures']);

function mockInvoke(cmd: string): Promise<unknown> {
  if (cmd in MOCKS) return Promise.resolve(MOCKS[cmd]);
  if (cmd.startsWith('plugin:event|')) return Promise.resolve(0); // event-plugin (listen/unlisten)
  if (ARRAY_CMDS.has(cmd)) return Promise.resolve([]);
  return Promise.resolve({});
}

export function installBrowserTauriShim(): void {
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  if (w.__TAURI_INTERNALS__) return; // ekte Tauri til stede → ikke rør
  let cbId = 0;
  const w2 = window as unknown as { __TAURI_INTERNALS__: unknown; __TAURI_EVENT_PLUGIN_INTERNALS__: unknown };
  w2.__TAURI_INTERNALS__ = {
    invoke: (cmd: string) => mockInvoke(cmd),
    transformCallback: (_cb: unknown) => { cbId += 1; return cbId; }, // event-systemet forventer en numerisk id
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  };
  // @tauri-apps/api/event bruker en EGEN global for listener-registeret (unlisten leser den).
  w2.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  // Test-only markør: lar UI-moduler som ellers er entitlement-gated (demo_studio →
  // Mockup Studio) rendres i browser-E2E. Umulig i native/prod (der finnes ekte Tauri,
  // så shim-en installeres aldri). ALDRI bruk dette til å omgå gating i produksjon.
  (window as unknown as { __BROWSER_TEST__: boolean }).__BROWSER_TEST__ = true;
  // eslint-disable-next-line no-console
  console.info('[browser-shim] Tauri mangler — browser-test-modus aktiv (mock invoke).');
}

// Self-installer ved modul-last (side-effekt): må skje FØR App-modulen evaluerer sine
// module-consts (IS_BROWSER_TEST), derfor importeres denne før App i main.tsx.
installBrowserTauriShim();

