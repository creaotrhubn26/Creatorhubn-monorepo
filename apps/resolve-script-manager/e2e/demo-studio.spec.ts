import { test, expect, type Page } from '@playwright/test';
import { installDemoMock } from './fixtures/demo-mock';

/**
 * Heftig e2e for Product Demo Studio (?test=demo). Tauri-kall mockes via
 * demo-mock (inkl. event-systemet); Claude-proxy + /me mockes via page.route.
 * Dekker: create, demo-type-maler, hotspot, AI Director, fullfør, capture,
 * validation, responsive, export, faner, ekte bruker.
 */

function anthropic(textOrObj: unknown) {
  const text = typeof textOrObj === 'string' ? textOrObj : JSON.stringify(textOrObj);
  return { id: 'x', model: 'claude-sonnet-4-6', content: [{ type: 'text', text }], stop_reason: 'end_turn' };
}

async function setupRoutes(page: Page) {
  await page.route('**/api/post-agent/me', (route) =>
    route.fulfill({ json: { id: 'u1', email: 't@test.no', name: 'Test Bruker', role: 'producer', companyName: 'Testfirma' } }));

  await page.route('**/api/post-agent/anthropic/messages', (route) => {
    const body = route.request().postDataJSON() as { system?: string; messages?: Array<{ content: unknown }> };
    const last = body.messages?.[body.messages.length - 1];
    const c = last?.content;
    const text = typeof c === 'string' ? c : Array.isArray(c) ? (c.find((b: { type?: string }) => b.type === 'text') as { text?: string })?.text ?? '' : '';
    const sys = body.system ?? '';
    let payload: unknown;
    if (text.includes('Lag en komplett produktdemo-flow')) {
      payload = anthropic({ scenes: [
        { title: 'AI Intro', device: 'macbook', narration: 'AI intro-manus', visualInstruction: 'vis forsiden', requiredAction: 'Klikk Start', targetIndex: 0, actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 }, overlayText: 'Velkommen', duration: 8 },
        { title: 'AI Feature', device: 'macbook', narration: 'AI feature-manus', visualInstruction: 'vis demo', requiredAction: 'Klikk demo', targetIndex: 1, actionType: 'click', overlayText: '', duration: 12 },
      ] });
    } else if (text.includes('Fullfør en EKSISTERENDE')) {
      payload = anthropic({ patches: [{ index: 0, narration: 'Fylt manus', overlayText: 'Fylt overlay', duration: 9, targetIndex: 0, actionType: 'click' }] });
    } else if (text.includes('Vurder hvordan nettsiden')) {
      payload = anthropic({ results: [
        { device: 'macbook', status: 'ok', message: 'All good' },
        { device: 'iphone', status: 'warning', message: 'CTA lavt på mobil', recommendation: 'Start etter 20% scroll', fix: { kind: 'start_scroll', sceneIndex: 0, startScrollPct: 20, summary: 'Start mobilscene etter 20% scroll' } },
      ] });
    } else if (text.includes('Auto-annotér frame-en')) {
      payload = anthropic({ caption: 'Dashboard-oversikt', overlayText: 'Alt på ett sted', keyElements: ['Start free trial', 'Pricing'] });
    } else if (text.includes('OCR-/vision-fallback')) {
      payload = anthropic({ elements: [{ label: 'Start free trial', actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 } }] });
    } else if (text.includes('Skjedde det forventede')) {
      payload = anthropic({ success: true, reason: 'Modal åpnet' });
    } else if (text.includes('Vurder denne produktdemoen kritisk')) {
      payload = anthropic({ score: 72, summary: 'Solid flow, men svak hook og utydelig CTA.', issues: [
        { severity: 'high', area: 'hook', message: 'Start sterkere i de første 3 sekundene.', sceneIndex: 0 },
        { severity: 'medium', area: 'cta', message: 'Gjør CTA tydeligere mot målet.' },
      ] });
    } else if (text.includes('Skriv manus for DENNE scenen')) {
      payload = anthropic({ narration: 'Scene-manus fra AI', visualInstruction: 'vis', requiredAction: 'Klikk Start', overlayText: 'Overlay' });
    } else if (sys.includes('manus-redaktør')) {
      payload = anthropic('Forbedret manus');
    } else {
      payload = anthropic('{}');
    }
    return route.fulfill({ json: payload });
  });
}

async function seedDemo(page: Page) {
  await page.getByPlaceholder('https://example.com').first().fill('theroleroom.com');
  await page.getByText('Generér demo-flow →').click();
  await expect(page.getByText('Demo-flow')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installDemoMock);
  await setupRoutes(page);
  page.on('dialog', (d) => d.accept()); // window.confirm/alert → OK
  await page.goto('/?test=demo');
});

test('tom tilstand: tilgivende URL + opprett demo', async ({ page }) => {
  await expect(page.getByText('Hva vil du vise frem?')).toBeVisible();
  await page.getByPlaceholder('https://example.com').first().fill('theroleroom.com');
  await page.getByText('Generér demo-flow →').click();
  await expect(page.getByText('Demo-flow')).toBeVisible();
  await expect(page.getByText('Intro', { exact: true })).toBeVisible(); // product_demo-mal
});

test('demo-typer reformer flowen', async ({ page }) => {
  await seedDemo(page);
  await page.getByText('Tutorial', { exact: true }).first().click();
  await expect(page.getByText('Mål', { exact: true })).toBeVisible(); // tutorial-mal scene 1
});

test('AI Director genererer flow bundet til elementer', async ({ page }) => {
  await seedDemo(page);
  await page.getByText('Generér hele demoen').click();
  // runDirector → replaceScenes + setNav('script') → Script Builder
  await expect(page.getByText('Generate Script').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('AI Intro').first()).toBeVisible();
});

test('AI fullfør demoen fyller hull', async ({ page }) => {
  await seedDemo(page);
  await page.getByText(/Fullfør demoen/).click();
  await expect(page.getByText(/Fylte \d+ scene/)).toBeVisible({ timeout: 10000 });
});

test('klikk-capture bygger scener fra steg', async ({ page }) => {
  await seedDemo(page);
  await page.getByText(/Klikk-capture/).click();
  await page.evaluate(() => {
    const emit = (window as unknown as { __demoEmit: (e: string, p: unknown) => void }).__demoEmit;
    emit('demo-capture://step', { url: 'x', selector: '#start', targetLabel: 'Start free trial', actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 }, scrollPct: 0 });
    emit('demo-capture://step', { url: 'x', selector: '#demo', targetLabel: 'Request a demo', actionType: 'click', hotspot: { x: 0.6, y: 0.3, w: 0.2, h: 0.08 }, scrollPct: 0.2 });
    emit('demo-capture://done', false);
  });
  await expect(page.getByText('Start free trial').first()).toBeVisible({ timeout: 10000 });
});

test('Validation-modal viser Expected ↔ Detected', async ({ page }) => {
  await seedDemo(page);
  // bygg capture-scener (har detectedSelector → Match)
  await page.getByText(/Klikk-capture/).click();
  await page.evaluate(() => {
    const emit = (window as unknown as { __demoEmit: (e: string, p: unknown) => void }).__demoEmit;
    emit('demo-capture://step', { url: 'x', selector: '#start', targetLabel: 'Start free trial', actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 }, scrollPct: 0 });
    emit('demo-capture://done', false);
  });
  await expect(page.getByText('Start free trial').first()).toBeVisible();
  await page.getByText('Validér handlinger').click();
  await expect(page.getByText('Validation & status')).toBeVisible();
  await expect(page.getByText('Expected').first()).toBeVisible();
  await expect(page.getByText('Match', { exact: true }).first()).toBeVisible();
});

test('Responsive Check viser status + Godta forslag', async ({ page }) => {
  await seedDemo(page);
  await page.getByText('Responsive Check').click();
  await expect(page.getByText('All good').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Godta forslag/)).toBeVisible();
});

test('faner: Create Demo + Device Preview er distinkte', async ({ page }) => {
  await seedDemo(page);
  await page.getByText('Create Demo').click();
  await expect(page.getByText('Start ny demo')).toBeVisible();
  await page.getByText('Device Preview').click();
  await expect(page.getByText(/Neste/)).toBeVisible();
});

test('Export: interaktiv guide + filer', async ({ page }) => {
  await seedDemo(page);
  await page.getByRole('button', { name: /^Export/ }).click();
  await expect(page.getByText('Interaktiv guide (HTML)')).toBeVisible();
  await page.getByText('Interaktiv guide (HTML)').click();
  await expect(page.getByText(/Interaktiv guide lagret/)).toBeVisible({ timeout: 10000 });
});

test('Script Builder viser ekte innlogget bruker', async ({ page }) => {
  await seedDemo(page);
  await page.getByText('Script Builder').click();
  await expect(page.getByText('Test Bruker')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Action Validation')).toBeVisible();
});

test('Director Critic gir score + forbedringer', async ({ page }) => {
  await seedDemo(page);
  await page.getByText(/Vurder demoen/).click();
  await expect(page.getByText('Director Critic')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('72')).toBeVisible();
  await expect(page.getByText(/Start sterkere/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scene 1' })).toBeVisible();
});

test('mål-drevet Director: mål-input lagres', async ({ page }) => {
  await seedDemo(page);
  await page.getByPlaceholder(/Mål\?/).fill('få flere til å booke demo');
  await expect(page.getByPlaceholder(/Mål\?/)).toHaveValue('få flere til å booke demo');
});

test('lesbarhets-score (LIX) vises i Script Builder', async ({ page }) => {
  await seedDemo(page);
  await page.getByText('Script Builder').click();
  await expect(page.getByText(/Lesbarhet \(LIX\)/)).toBeVisible({ timeout: 10000 });
});

test('auto-merkevare hentes fra siden + white-label', async ({ page }) => {
  await seedDemo(page);
  await page.getByRole('button', { name: /^Export/ }).click(); // topbar Export (Flow Builder)
  await expect(page.getByText('Merkevare & white-label')).toBeVisible();
  await page.getByRole('button', { name: 'Hent merkevare fra siden' }).click();
  await expect(page.getByText(/Merkevare hentet fra siden/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByPlaceholder(/Merkenavn/)).toHaveValue('TestMerke');
  await expect(page.getByPlaceholder(/Merkefarge/)).toHaveValue('#3366ff');
  await page.getByText('White-label (skjul «Powered by»)').click();
});

test('vision auto-annotering fyller overlay fra skjermbilde', async ({ page }) => {
  await seedDemo(page);
  await page.getByText('Script Builder').click();
  // Auto-annotér henter selv skjermbilde (demo_screenshot-mock) + vision-annoterer.
  await page.getByRole('button', { name: 'Auto-annotér' }).click();
  await expect(page.getByPlaceholder('Get a real-time overview of your practice')).toHaveValue('Alt på ett sted', { timeout: 10000 });
});

test('CTA-bank klassifiserer capture-elementer', async ({ page }) => {
  await seedDemo(page);
  await page.getByText(/Klikk-capture/).click();
  await page.evaluate(() => {
    const emit = (window as unknown as { __demoEmit: (e: string, p: unknown) => void }).__demoEmit;
    emit('demo-capture://step', { url: 'x', selector: '#start', targetLabel: 'Start free trial', actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 }, scrollPct: 0 });
    emit('demo-capture://done', false);
  });
  await page.getByText('Start free trial').first().click();
  await expect(page.getByText('CTA: Prøveperiode')).toBeVisible({ timeout: 10000 });
});
