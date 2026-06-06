/**
 * Tauri-mock for Product Demo Studio e2e. Installeres via addInitScript FØR
 * React monteres. Støtter både invoke OG Tauri-event-systemet (listen/emit) —
 * capture/scan/verify/auto/shot-flytene avhenger av events.
 *
 * Spec-en kan styre events manuelt via window.__demoEmit(event, payload).
 * Claude-proxy (/anthropic/messages) + /me mockes via page.route() i spec-en.
 */
export function installDemoMock() {
  const cbs = new Map<number, (e: unknown) => void>();
  let idc = 0;
  const listeners: Array<{ event: string; id: number }> = [];

  function emit(event: string, payload: unknown) {
    for (const l of listeners) {
      if (l.event === event) {
        const cb = cbs.get(l.id);
        if (cb) cb({ event, id: l.id, payload });
      }
    }
  }
  (window as unknown as { __demoEmit: typeof emit }).__demoEmit = emit;

  const SCAN_ELEMENTS = [
    { selector: '#start', label: 'Start free trial', tag: 'button', actionType: 'click', belowFold: false, hotspot: { x: 0.40, y: 0.30, w: 0.20, h: 0.08 }, locators: [{ strategy: 'id', value: '#start' }, { strategy: 'text', value: 'button|Start free trial' }] },
    { selector: '#demo', label: 'Request a demo', tag: 'a', actionType: 'click', belowFold: false, hotspot: { x: 0.65, y: 0.30, w: 0.20, h: 0.08 }, locators: [{ strategy: 'id', value: '#demo' }] },
    { selector: '#pricing', label: 'Pricing', tag: 'a', actionType: 'click', belowFold: true, hotspot: { x: 0.80, y: 0.05, w: 0.10, h: 0.05 }, locators: [{ strategy: 'id', value: '#pricing' }] },
  ];

  const TINY_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q==';

  const defaults: Record<string, unknown> = {
    get_app_settings: {},
    get_app_data_dir: '/tmp',
    list_scripts: { scripts: [] },
    list_capture_sources: [],
  };

  const later = (fn: () => void) => setTimeout(fn, 30);

  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
    transformCallback(cb: (e: unknown) => void) { const id = ++idc; cbs.set(id, cb); return id; },
    convertFileSrc(p: string) { return `file://${p}`; },
    async invoke(cmd: string, args: Record<string, unknown> = {}) {
      switch (cmd) {
        case 'plugin:event|listen': listeners.push({ event: args.event as string, id: args.handler as number }); return idc;
        case 'plugin:event|unlisten': return null;
        case 'plugin:dialog|save': return '/tmp/demo-output';
        case 'plugin:dialog|open': return '/tmp/demo-input';
        case 'start_demo_capture': return null; // spec styrer steg via __demoEmit
        case 'demo_capture_done': return null;
        case 'demo_scan_dom': later(() => emit('demo-capture://dom', { url: args.url, title: 'Test', elements: SCAN_ELEMENTS, pageText: 'Test-side: Start free trial. Request a demo. Pricing.' })); return null;
        case 'demo_verify_action': later(() => emit('demo-capture://verify', { cancelled: false, selector: '#start', label: 'Start free trial' })); return null;
        // Selector-bevisst: «broken/missing»-selektorer feiler → trigger self-healing.
        case 'demo_auto_execute': { const found = !/broken|missing/.test(String(args.selector || '')); later(() => emit('demo-capture://auto', { ok: found, found, selector: args.selector })); return null; }
        case 'demo_screenshot': later(() => emit('demo-capture://shot', { ok: true, dataUrl: TINY_JPEG })); return null;
        case 'demo_fetch_site_context': return 'Tittel: Test\nKlikkbare elementer: Start free trial · Request a demo';
        case 'demo_write_text': return args.path;
        case 'demo_write_binary': return args.path;
        case 'demo_print_html': return null;
        default: return cmd in defaults ? defaults[cmd] : null;
      }
    },
  };

  // Mock getDisplayMedia så Guided Recorder kan starte web-opptak headless
  // (ekte skjermdeling finnes ikke i Playwright). En canvas-stream gir frames
  // til MediaRecorder, så recording-state settes og recorder-panelet vises.
  try {
    const md = navigator.mediaDevices as unknown as { getDisplayMedia?: unknown };
    if (md) {
      md.getDisplayMedia = async () => {
        const c = document.createElement('canvas');
        c.width = 320; c.height = 180;
        const ctx = c.getContext('2d');
        if (ctx) { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 320, 180); }
        return (c as unknown as { captureStream: (fps: number) => MediaStream }).captureStream(10);
      };
    }
  } catch { /* ignore */ }

  localStorage.setItem('trrpa.firstRunComplete', 'skipped');
  localStorage.setItem('trrpa.settings', JSON.stringify({ RR_BEARER_TOKEN: 'test-token', RR_POST_AGENT_BASE_URL: 'https://example.test/api/post-agent' }));
}
