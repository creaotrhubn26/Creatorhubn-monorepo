import { test, expect, type Page } from '@playwright/test';
import { installDemoMock } from './fixtures/demo-mock';

/**
 * E2e for det visuelle laget + biblioteket: infographic-generering (Claude→SVG),
 * manus-drevne visuelle uthevinger med preview, og at genererte artefakter havner
 * i Bibliotek-fanen. Tauri mockes; AI-steg mockes innholdsbasert.
 */

function anthropic(textOrObj: unknown) {
  const text = typeof textOrObj === 'string' ? textOrObj : JSON.stringify(textOrObj);
  return { id: 'x', model: 'claude-sonnet-4-6', content: [{ type: 'text', text }], stop_reason: 'end_turn' };
}

async function setupRoutes(page: Page) {
  await page.route('**/api/post-agent/me', (route) =>
    route.fulfill({ json: { id: 'u1', email: 't@test.no', name: 'Test', role: 'producer' } }));
  await page.route('**/api/post-agent/anthropic/messages', (route) => {
    const body = route.request().postDataJSON() as { messages?: Array<{ content: unknown }> };
    const last = body.messages?.[body.messages.length - 1];
    const c = last?.content;
    const text = typeof c === 'string' ? c : Array.isArray(c) ? (c.find((b: { type?: string }) => b.type === 'text') as { text?: string })?.text ?? '' : '';
    let payload: unknown;
    if (text.includes('SVG-infographic')) {
      payload = anthropic('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350"><rect width="1080" height="1350" fill="#fff"/><text x="60" y="120" font-size="48" fill="#1d1b19">TestMerke</text></svg>');
    } else if (text.includes('BEVIS-INVENTAR')) {
      payload = anthropic({ summary: 'AI-demo-bygger.', features: [{ name: 'Auto-scan', solves: 'oppsett' }], proof: [{ claim: 'sparer 8 t/uke', type: 'metric' }], sections: [{ label: 'Priser', purpose: 'pakker' }] });
    } else if (text.includes('visuell utheving')) {
      payload = anthropic({ beats: [
        { index: 0, kind: 'stat', phrase: 'sparer 8 timer', overlay: '8 t/uke', why: 'tall' },
        { index: 1, kind: 'overlay', phrase: 'auto-scan', overlay: 'Auto-scan', why: 'funksjon' },
      ] });
    } else {
      payload = anthropic('{}');
    }
    return route.fulfill({ json: payload });
  });
}

async function seedAndOpenMarketing(page: Page) {
  await page.getByPlaceholder('https://example.com').first().fill('theroleroom.com');
  await page.getByText('Generér demo-flow →').click();
  await expect(page.getByText('Demo-flow')).toBeVisible();
  await page.getByText('Marketing').first().click();
  await expect(page.getByRole('heading', { name: 'Marketing mode' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installDemoMock);
  await setupRoutes(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/?test=demo');
});

test('infographic genereres + havner i biblioteket', async ({ page }) => {
  await seedAndOpenMarketing(page);
  // Analyser produktet → evidence (gir infographic-kontekst).
  await page.getByRole('button', { name: /Analyser produktet/ }).click();
  await expect(page.getByText(/Funksjoner \(/)).toBeVisible({ timeout: 15000 });
  // Generér infographic → SVG-preview vises.
  await page.getByRole('button', { name: /Generér infographic/ }).click();
  await expect(page.locator('svg').filter({ hasText: 'TestMerke' })).toBeVisible({ timeout: 15000 });
  // Bibliotek-fanen viser artefakten.
  await page.getByText('Bibliotek').first().click();
  await expect(page.getByRole('heading', { name: 'Bibliotek' })).toBeVisible();
  await expect(page.getByText('Infographic').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Last ned' }).first()).toBeVisible();
});

test('manus-drevne visuelle uthevinger med preview', async ({ page }) => {
  await page.getByPlaceholder('https://example.com').first().fill('theroleroom.com');
  await page.getByText('Generér demo-flow →').click();
  await expect(page.getByText('Demo-flow')).toBeVisible();
  // AI Director-kortet: foreslå visuelle uthevinger.
  await page.getByRole('button', { name: /Foreslå visuelle uthevinger/ }).click();
  await expect(page.getByRole('heading', { name: 'Visuelle uthevinger fra manuset' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Stat-callout')).toBeVisible();
  // Bruk ett forslag.
  await page.getByRole('button', { name: 'Bruk', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '✓ Brukt' }).first()).toBeVisible();
});
