import { test, expect, type Page } from '@playwright/test';
import { installDemoMock } from './fixtures/demo-mock';

/**
 * Robusthet/edge-case-e2e for Product Demo Studio (?test=demo). Komplement til
 * demo-studio.spec.ts — denne jakter grensetilfellene den IKKE dekker:
 *   - ugyldige/uvanlige URL-er (validering + tilgivende normalisering)
 *   - tom flow / slette alle scener (slett-knapp deaktiveres ved siste scene)
 *   - mal-bytte med opptaks-arbeid (window.confirm)
 *   - capture avbrutt (cancelled=true → ingen scener bygges)
 *   - verify med avvikende selector (Warning) + auto-execute not-found (needs_review)
 *   - Responsive-fix anvendelse (start-scroll-felt dukker opp på scenen)
 *   - scene-reorder via ‹ ›-pilene
 *   - zoom-grenser (50% / 300%)
 *   - export uten opptak (advarsel + deaktivert knapp)
 *   - interaktiv guide-innhold (korrekte steg embeddet i HTML)
 *   - persistens (reload beholder prosjektet via localStorage)
 *
 * Mocks: Tauri via demo-mock (event-systemet), Claude-proxy + /me via page.route.
 * verify/auto-utfall styres per test ved å overstyre invoke for de kommandoene.
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
        { device: 'iphone', status: 'warning', message: 'CTA lavt på mobil', recommendation: 'Start etter 20% scroll', fix: { kind: 'start_scroll', sceneIndex: 0, startScrollPct: 35, summary: 'Start mobilscene etter 35% scroll' } },
      ] });
    } else if (text.includes('Skjedde det forventede')) {
      payload = anthropic({ success: false, reason: 'Ingen endring synlig' });
    } else if (text.includes('Auto-annotér frame-en')) {
      payload = anthropic({ caption: 'c', overlayText: 'o', keyElements: ['x'] });
    } else if (text.includes('selector brutt')) {
      payload = anthropic({ index: 0 }); // self-healing → velg #start
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

/** Overstyr invoke for spesifikke capture-kommandoer (verify/auto) per test, så
 *  vi kan styre Match/Warning/needs_review uavhengig av mockens default-utfall. */
async function overrideCaptureInvoke(page: Page, opts: { verifySelector?: string; verifyCancelled?: boolean; autoOk?: boolean; autoFound?: boolean }) {
  await page.evaluate((o) => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown> } }).__TAURI_INTERNALS__;
    const emit = (window as unknown as { __demoEmit: (e: string, p: unknown) => void }).__demoEmit;
    const orig = internals.invoke.bind(internals);
    internals.invoke = async (cmd: string, args: Record<string, unknown> = {}) => {
      if (cmd === 'demo_verify_action') {
        setTimeout(() => emit('demo-capture://verify', { cancelled: o.verifyCancelled ?? false, selector: o.verifySelector ?? '#start', label: 'Start free trial' }), 30);
        return null;
      }
      if (cmd === 'demo_auto_execute') {
        setTimeout(() => emit('demo-capture://auto', { ok: o.autoOk ?? true, found: o.autoFound ?? true, selector: args.selector }), 30);
        return null;
      }
      return orig(cmd, args);
    };
  }, opts);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installDemoMock);
  await setupRoutes(page);
  page.on('dialog', (d) => d.accept()); // window.confirm/alert → OK (overstyres der vi trenger Cancel)
  await page.goto('/?test=demo');
});

// ── URL-validering / uvanlige input ──

test('ugyldig URL holder Generér-knappen deaktivert', async ({ page }) => {
  await expect(page.getByText('Hva vil du vise frem?')).toBeVisible();
  const btn = page.getByRole('button', { name: 'Generér demo-flow →' });
  // Tom → ugyldig
  await expect(btn).toBeDisabled();
  // Streng uten punktum → fortsatt ugyldig (regex krever \S+\.\S+)
  await page.getByPlaceholder('https://example.com').first().fill('justtext');
  await expect(btn).toBeDisabled();
  await expect(page.getByText(/Skriv inn en gyldig URL/)).toBeVisible();
  // Bare protokoll → ugyldig
  await page.getByPlaceholder('https://example.com').first().fill('https://');
  await expect(btn).toBeDisabled();
});

test('tilgivende URL: domene uten protokoll + STORE bokstaver godtas', async ({ page }) => {
  const input = page.getByPlaceholder('https://example.com').first();
  await input.fill('HTTPS://Example.COM');
  await expect(page.getByRole('button', { name: 'Generér demo-flow →' })).toBeEnabled();
  await input.fill('sub.domene.no/path?q=1');
  const btn = page.getByRole('button', { name: 'Generér demo-flow →' });
  await expect(btn).toBeEnabled();
  await btn.click();
  await expect(page.getByText('Demo-flow')).toBeVisible();
  // URL ble normalisert med https:// i topbar-feltet.
  await expect(page.locator('input[value^="https://sub.domene.no"]').first()).toBeVisible();
});

test('Enter-tast med ugyldig URL gjør ingenting', async ({ page }) => {
  const input = page.getByPlaceholder('https://example.com').first();
  await input.fill('nope');
  await input.press('Enter');
  // Fortsatt i tom-tilstand (ingen prosjekt opprettet)
  await expect(page.getByText('Hva vil du vise frem?')).toBeVisible();
});

// ── Slette scener / tom flow ──

test('slett scener til siste — slett-knapp deaktiveres ved 1 scene igjen', async ({ page }) => {
  await seedDemo(page);
  // product_demo har 6 scener. Velg første scene for å få høyre-panelet.
  await page.getByText('Intro', { exact: true }).first().click();
  const deleteBtn = page.getByRole('button', { name: 'Slett scene' });
  await expect(deleteBtn).toBeEnabled();
  // Slett gjentatte ganger til kun én scene gjenstår.
  for (let n = 6; n > 1; n--) {
    await expect(page.getByText(`${n} scener`)).toBeVisible();
    await page.getByRole('button', { name: 'Slett scene' }).click();
  }
  await expect(page.getByText('1 scener')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Slett scene' })).toBeDisabled();
});

// ── Mal-bytte med opptaks-arbeid (confirm) ──

test('mal-bytte uten opptak reseeder uten bekreftelse', async ({ page }) => {
  await seedDemo(page);
  let dialogShown = false;
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => { dialogShown = true; void d.accept(); });
  await page.getByText('Tutorial', { exact: true }).first().click();
  await expect(page.getByText('Mål', { exact: true })).toBeVisible(); // tutorial scene 1
  expect(dialogShown).toBe(false); // ingen opptak → ingen confirm
});

test('mal-bytte MED opptak krever bekreftelse — Cancel beholder flowen', async ({ page }) => {
  await seedDemo(page);
  // Bygg capture-scener (status 'in_progress' teller IKKE som opptak), så vi
  // tvinger 'done' via Guided Recorder: start opptak + Mark as Done →
  // hasRecordedWork=true → mal-bytte krever da confirm.
  await page.getByText('Klikk-capture', { exact: false }).click();
  await page.evaluate(() => {
    const emit = (window as unknown as { __demoEmit: (e: string, p: unknown) => void }).__demoEmit;
    emit('demo-capture://step', { url: 'x', selector: '#start', targetLabel: 'Start free trial', actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 }, scrollPct: 0 });
    emit('demo-capture://done', false);
  });
  await expect(page.getByText('Start free trial').first()).toBeVisible({ timeout: 10000 });
  await page.getByText('Start free trial').first().click();
  // Start opptak fra topbar Record → høyre panel viser teleprompter med Mark as Done.
  await page.getByRole('button', { name: /Record/ }).first().click();
  await page.getByRole('button', { name: '✓ Mark as Done' }).click();
  // Nå: bytt mal og velg Cancel i confirm → flowen skal IKKE byttes.
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => void d.dismiss());
  await page.getByText('Tutorial', { exact: true }).first().click();
  // Tutorial-malens scene «Mål» skal IKKE finnes (vi avbrøt byttet).
  await expect(page.getByText('Mål', { exact: true })).toHaveCount(0);
});

// ── Capture avbrutt ──

test('capture avbrutt (cancelled=true) bygger ingen scener', async ({ page }) => {
  await seedDemo(page);
  await expect(page.getByText('6 scener')).toBeVisible();
  await page.getByText('Klikk-capture', { exact: false }).click();
  await page.evaluate(() => {
    const emit = (window as unknown as { __demoEmit: (e: string, p: unknown) => void }).__demoEmit;
    emit('demo-capture://step', { url: 'x', selector: '#start', targetLabel: 'Start free trial', actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 }, scrollPct: 0 });
    emit('demo-capture://done', true); // avbrutt
  });
  // Stegene forkastes → original product_demo-flow (6 scener) er intakt.
  await expect(page.getByText('6 scener')).toBeVisible();
  await expect(page.getByText('Start free trial')).toHaveCount(0);
});

// ── Verify: avvikende selector → Warning ──

test('verify med avvikende selector gir Warning (ikke Match)', async ({ page }) => {
  await seedDemo(page);
  // Bygg én capture-scene med targetSelector='#start' (Expected).
  await page.getByText('Klikk-capture', { exact: false }).click();
  await page.evaluate(() => {
    const emit = (window as unknown as { __demoEmit: (e: string, p: unknown) => void }).__demoEmit;
    emit('demo-capture://step', { url: 'x', selector: '#start', targetLabel: 'Start free trial', actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 }, scrollPct: 0 });
    emit('demo-capture://done', false);
  });
  await expect(page.getByText('Start free trial').first()).toBeVisible({ timeout: 10000 });
  // La verify returnere en ANNEN selector enn forventet → Warning.
  await overrideCaptureInvoke(page, { verifySelector: '#completely-other' });
  // Gå inn i opptak og verifiser gjeldende scene.
  await page.getByText('Start free trial').first().click();
  await page.getByRole('button', { name: /Record/ }).first().click();
  await page.getByRole('button', { name: /Verifiser handling/ }).click();
  // Åpne validering og bekreft Warning.
  await page.getByRole('button', { name: 'Avslutt opptak' }).click();
  await page.getByRole('button', { name: /Validér handlinger/ }).click();
  await expect(page.getByText('Validation & status')).toBeVisible();
  await expect(page.getByText('Warning', { exact: true }).first()).toBeVisible();
});

// ── Auto-execute: ikke funnet → needs_review ──

test('auto-execute som ikke finner element setter needs_review', async ({ page }) => {
  await seedDemo(page);
  await page.getByText('Klikk-capture', { exact: false }).click();
  await page.evaluate(() => {
    const emit = (window as unknown as { __demoEmit: (e: string, p: unknown) => void }).__demoEmit;
    emit('demo-capture://step', { url: 'x', selector: '#start', targetLabel: 'Start free trial', actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 }, scrollPct: 0 });
    emit('demo-capture://done', false);
  });
  await expect(page.getByText('Start free trial').first()).toBeVisible({ timeout: 10000 });
  // La auto returnere ok=false, found=false → scene skal merkes needs_review + alert.
  await overrideCaptureInvoke(page, { autoOk: false, autoFound: false });
  let alertSeen = false;
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => { if (/Fant ikke elementet|klarte ikke å reparere/.test(d.message())) alertSeen = true; void d.accept(); });
  await page.getByText('Start free trial').first().click();
  await page.getByRole('button', { name: /Record/ }).first().click();
  await page.getByRole('button', { name: /Kjør automatisk/ }).click();
  await expect.poll(() => alertSeen, { timeout: 10000 }).toBe(true);
  // Verifiser status via Validation-panelet (needs_review).
  await page.getByRole('button', { name: 'Avslutt opptak' }).click();
  await page.getByRole('button', { name: /Validér handlinger/ }).click();
  await expect(page.getByText('Validation & status')).toBeVisible();
  await expect(page.getByText(/scener mangler felt|Needs Review|Trenger gjennomgang/).first()).toBeVisible();
});

// ── Responsive-fix anvendelse ──

test('Responsive Check «Godta forslag» anvender start-scroll på scenen', async ({ page }) => {
  await seedDemo(page);
  await page.getByRole('button', { name: /Responsive Check/ }).click();
  await expect(page.getByText('All good').first()).toBeVisible({ timeout: 10000 });
  await page.getByText(/Godta forslag/).click();
  await expect(page.getByText(/✓ Justert/)).toBeVisible();
  // Lukk modalen og åpne scene 1 → Start-scroll-feltet skal vises med verdien 35.
  await page.getByRole('button', { name: 'Lukk' }).click();
  await page.getByText('Intro', { exact: true }).first().click();
  await expect(page.getByText(/Start-scroll/)).toBeVisible();
  await expect(page.locator('input[type="number"][value="35"]').first()).toBeVisible();
});

// ── Scene-reorder ──

test('scene-reorder via ›-pil bytter rekkefølge', async ({ page }) => {
  await seedDemo(page);
  // product_demo: scene 1 = Intro, scene 2 = Homepage. Begge synlige før flytting.
  await expect(page.getByText('Intro', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Homepage', { exact: true }).first()).toBeVisible();
  // Flytt det første scene-kortet (Intro) senere via dets ›-pil («Flytt senere»).
  await page.getByTitle('Flytt senere').first().click();
  // Velg det nye første kortet (Homepage) og åpne Script Builder, som viser
  // «Scene N — <tittel>». Etter flytting skal Homepage være Scene 1.
  await page.getByText('Homepage', { exact: true }).first().click();
  await page.getByText('Script Builder').click();
  await expect(page.getByRole('heading', { name: /Scene 1 — Homepage/ })).toBeVisible({ timeout: 10000 });
});

// ── Zoom-grenser ──

test('zoom respekterer 50% nedre og 300% øvre grense', async ({ page }) => {
  await seedDemo(page);
  // Standard 100%.
  await expect(page.getByText('100%')).toBeVisible();
  const zoomOut = page.getByTitle('Zoom ut');
  // Klikk ut mange ganger (4 × 25% = 100% → 0%, men klemt til 50%).
  for (let i = 0; i < 6; i++) await zoomOut.click();
  await expect(page.getByText('50%')).toBeVisible();
  await expect(page.getByText(/^0%$/)).toHaveCount(0);
  // Tilbakestill via prosent-klikk (title «Tilbakestill zoom (100%)»).
  await page.getByTitle('Tilbakestill zoom (100%)').click();
  await expect(page.getByText('100%')).toBeVisible();
  // Klikk inn mange ganger → klemt til 300%.
  const zoomIn = page.getByTitle('Zoom inn');
  for (let i = 0; i < 12; i++) await zoomIn.click();
  await expect(page.getByText('300%')).toBeVisible();
  await expect(page.getByText(/^325%$/)).toHaveCount(0);
});

// ── Export uten opptak ──

test('Export uten opptak: advarsel + deaktivert eksport-knapp', async ({ page }) => {
  await seedDemo(page);
  await page.getByRole('button', { name: /^Export/ }).click();
  await expect(page.getByText(/Ingen scener har opptak ennå/)).toBeVisible();
  // Eksporter-video-knappen skal være deaktivert.
  await expect(page.getByRole('button', { name: /^Eksporter 16:9/ })).toBeDisabled();
  // Leveranser (tekst/bilde) skal fortsatt være tilgjengelige.
  await expect(page.getByRole('button', { name: 'Interaktiv guide (HTML)' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Undertekster (.srt)' })).toBeEnabled();
});

// ── Interaktiv guide-innhold ──

test('interaktiv guide skriver HTML med korrekte steg', async ({ page }) => {
  await seedDemo(page);
  // Fang opp innholdet skrevet via demo_write_text (mock returnerer path).
  await page.evaluate(() => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown> } }).__TAURI_INTERNALS__;
    const orig = internals.invoke.bind(internals);
    (window as unknown as { __lastWrite?: string }).__lastWrite = undefined;
    internals.invoke = async (cmd: string, args: Record<string, unknown> = {}) => {
      if (cmd === 'demo_write_text') { (window as unknown as { __lastWrite?: string }).__lastWrite = String(args.contents ?? ''); return args.path; }
      return orig(cmd, args);
    };
  });
  await page.getByRole('button', { name: /^Export/ }).click();
  await page.getByRole('button', { name: 'Interaktiv guide (HTML)' }).click();
  await expect(page.getByText(/Interaktiv guide lagret/)).toBeVisible({ timeout: 10000 });
  const html = await page.evaluate(() => (window as unknown as { __lastWrite?: string }).__lastWrite ?? '');
  expect(html).toContain('interaktiv guide');
  // product_demo-malens scene-titler skal være embeddet i guide-dataen.
  expect(html).toContain('Intro');
  expect(html).toContain('Main Feature');
  expect(html).toContain('Outro');
  // Steg-navigasjon + hotspot-CSS er med.
  expect(html).toContain('Neste ›');
  expect(html).toContain('class="hot"');
});

// ── startScrollPct-felt ──

test('startScrollPct-felt redigeres og klemmes til 0–100', async ({ page }) => {
  await seedDemo(page);
  // Capture en scene med scroll (0.2) → startScrollPct=20 settes deterministisk.
  await page.getByText(/Klikk-capture/).click();
  await page.evaluate(() => {
    const emit = (window as unknown as { __demoEmit: (e: string, p: unknown) => void }).__demoEmit;
    emit('demo-capture://step', { url: 'x', selector: '#start', targetLabel: 'Start free trial', actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 }, scrollPct: 0.2 });
    emit('demo-capture://done', false);
  });
  await expect(page.getByText('Start free trial').first()).toBeVisible({ timeout: 10000 });
  await page.getByText('Start free trial').first().click();
  // Capture satte startScrollPct=20; feltet (max=100) vises i scene-innstillinger.
  const field = page.locator('input[type="number"][max="100"]').first();
  await expect(field).toHaveValue('20');
  // Skriv en verdi > 100 → skal klemmes til 100.
  await field.fill('250');
  await expect(field).toHaveValue('100');
  // Fjern start-scroll via ✕ → feltet forsvinner.
  await page.getByTitle('Fjern start-scroll').click();
  await expect(page.getByText(/Start-scroll/)).toHaveCount(0);
});

// ── Persistens over reload ──

test('reload beholder prosjektet (localStorage-persistens)', async ({ page }) => {
  await seedDemo(page);
  // Gi prosjektet et gjenkjennelig navn via title-feltet.
  const titleField = page.locator('input[value="Untitled Demo"]').first();
  await titleField.fill('Edge Persist Demo');
  await expect(page.locator('input[value="Edge Persist Demo"]').first()).toBeVisible();
  // Reload → loadExisting() skal gjenopprette prosjektet (ikke tom-tilstand).
  await page.reload();
  await expect(page.getByText('Demo-flow')).toBeVisible();
  await expect(page.getByText('Hva vil du vise frem?')).toHaveCount(0);
  await expect(page.locator('input[value="Edge Persist Demo"]').first()).toBeVisible();
  await expect(page.getByText('6 scener')).toBeVisible();
});

// ── Create Demo erstatter eksisterende (confirm) ──

test('Create Demo med eksisterende prosjekt krever confirm før erstatning', async ({ page }) => {
  await seedDemo(page);
  await page.getByText('Create Demo').click();
  await expect(page.getByText('Start ny demo')).toBeVisible();
  await expect(page.getByText('Nåværende demo')).toBeVisible();
  // Skriv ny URL i Create Demo-feltet (ikke topbar-feltet → bruk .last()) og
  // start → confirm aksepteres (beforeEach) → ny demo opprettes.
  await page.getByPlaceholder('https://example.com').last().fill('annetdomene.no');
  await page.getByRole('button', { name: 'Opprett ny demo →' }).click();
  // Tilbake i Flow Builder med nytt prosjekt (default product_demo, 6 scener).
  await expect(page.getByText('Demo-flow')).toBeVisible();
  await expect(page.getByText('6 scener')).toBeVisible();
});

// ── AI self-healing av brutt selector ──

test('AI self-healing reparerer brutt selector og fullfører auto', async ({ page }) => {
  await seedDemo(page);
  // Capture en scene med en BRUTT selector (#broken-1) → auto vil feile først.
  await page.getByText(/Klikk-capture/).click();
  await page.evaluate(() => {
    const emit = (window as unknown as { __demoEmit: (e: string, p: unknown) => void }).__demoEmit;
    emit('demo-capture://step', { url: 'x', selector: '#broken-1', targetLabel: 'Start free trial', actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 }, scrollPct: 0, locators: [{ strategy: 'id', value: '#broken-1' }] });
    emit('demo-capture://done', false);
  });
  await expect(page.getByText('Start free trial').first()).toBeVisible({ timeout: 10000 });
  let healed = false;
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => { if (/AI reparerte/.test(d.message())) healed = true; void d.accept(); });
  await page.getByText('Start free trial').first().click();
  await page.getByRole('button', { name: /Record/ }).first().click();
  await page.getByRole('button', { name: /Kjør automatisk/ }).click();
  // auto found=false → scanDom → healTarget(#start) → retry → found=true → done.
  await expect.poll(() => healed, { timeout: 15000 }).toBe(true);
});
