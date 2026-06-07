import { test, expect, type Page } from '@playwright/test';
import { installDemoMock } from './fixtures/demo-mock';

/**
 * E2e for Edit Mode-spinen: undo/redo, multi-select + slett, og at angre
 * gjenoppretter. Bruker mal-flowen (ingen AI-kall) så testen er rask + stabil.
 */

async function seed(page: Page) {
  await page.getByPlaceholder('https://example.com').first().fill('theroleroom.com');
  await page.getByText('Generér demo-flow →').click();
  await expect(page.getByText('Demo-flow')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installDemoMock);
  await page.route('**/api/post-agent/me', (route) =>
    route.fulfill({ json: { id: 'u1', email: 't@test.no', name: 'Test', role: 'producer' } }));
  page.on('dialog', (d) => d.accept());
  await page.goto('/?test=demo');
});

test('multi-select + slett valgte + angre gjenoppretter', async ({ page }) => {
  await seed(page);
  const cards = page.getByTestId('scene-card');
  const n = await cards.count();
  expect(n).toBeGreaterThan(2);

  // ⌘/Ctrl-klikk velger flere.
  await cards.nth(0).click({ modifiers: ['ControlOrMeta'] });
  await cards.nth(1).click({ modifiers: ['ControlOrMeta'] });
  await expect(page.getByText('2 scener valgt')).toBeVisible();

  // Slett valgte → to færre kort.
  await page.getByRole('button', { name: 'Slett valgte' }).click();
  await expect(cards).toHaveCount(n - 2);

  // Angre gjenoppretter.
  await page.getByRole('button', { name: /Angre/ }).click();
  await expect(cards).toHaveCount(n);
});

test('undo/redo-knapper reflekterer historikk', async ({ page }) => {
  await seed(page);
  const cards = page.getByTestId('scene-card');
  const n = await cards.count();
  // Slett én scene via multi-select.
  await cards.nth(0).click({ modifiers: ['ControlOrMeta'] });
  await page.getByRole('button', { name: 'Slett valgte' }).click();
  await expect(cards).toHaveCount(n - 1);
  // Angre → tilbake; Gjør om → borte igjen.
  await page.getByRole('button', { name: /Angre/ }).click();
  await expect(cards).toHaveCount(n);
  await page.getByRole('button', { name: /Gjør om/ }).click();
  await expect(cards).toHaveCount(n - 1);
});
