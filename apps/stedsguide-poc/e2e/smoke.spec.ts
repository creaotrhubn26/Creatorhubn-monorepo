import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Røyk-test + WCAG 2.1 AA-skann (axe) av hver hovedskjerm.
 * Kjøres mot `vite preview` (se playwright.config.ts) med posisjon i Oslo sentrum.
 */

async function expectNoA11yViolations(page: Page, screen: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Leaflet-fliser/kontroller er tredjepart; alt innhold finnes i Liste-fanen.
    .exclude('.leaflet-control-container')
    .exclude('.leaflet-tile-pane')
    .analyze();
  expect(results.violations, `${screen}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)}`).toEqual([]);
}

/** Fanene nederst – eksakt navn, slik at «Lagre i mine steder …» ikke matcher. */
const tab = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Deterministisk språk uavhengig av CI-maskinens locale.
    try { window.localStorage.setItem('stedsguide:prefs', JSON.stringify({ lang: 'nb' })); } catch { /* ignore */ }
  });
});

test('kart: viser nærmeste severdighet fra posisjonen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Nærmeste severdighet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operahuset i Oslo' })).toBeVisible();
  await expect(page.getByText(/unna/)).toBeVisible();
  await expect(page.getByRole('region', { name: /Kart over severdigheter/ })).toBeVisible();
  await expectNoA11yViolations(page, 'kart');
});

test('søk filtrerer severdigheter', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Søk etter severdigheter' }).fill('bergen');
  await expect(page.getByRole('heading', { name: 'Bryggen i Bergen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operahuset i Oslo' })).toHaveCount(0);
});

test('liste: alle severdigheter sortert etter avstand, med lagring', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Liste').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Severdigheter i nærheten' })).toBeFocused();
  const headings = page.getByRole('heading', { level: 2 });
  await expect(headings.first()).toHaveText('Operahuset i Oslo');
  await expect(headings).toHaveCount(7);
  await page.getByRole('button', { name: /Lagre i mine steder: Akershus festning/ }).click();
  await tab(page, 'Mine steder').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Akershus festning' })).toBeVisible();
  await expectNoA11yViolations(page, 'liste');
});

test('detalj: quick buy låst utenfor geofence, abonnement åpner guiden', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Liste').click();
  await page.getByRole('button', { name: 'Vis' }).nth(1).click(); // Akershus (≈ 900 m unna)
  await expect(page.getByRole('heading', { level: 1, name: 'Akershus festning' })).toBeFocused();
  await expect(page.getByText(/Engangskjøp åpner når du er innenfor 300 m/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Kjøp denne guiden/ })).toBeDisabled();
  await expectNoA11yViolations(page, 'detalj');
  await page.getByRole('button', { name: /Årlig/ }).click();
  await expect(page.getByText('Du har tilgang til denne guiden.')).toBeVisible();
  await page.getByRole('button', { name: 'Start guiden' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Akershus festning' })).toBeFocused();
  await expect(page.getByText('Del 1 av 4')).toBeVisible();
  await expectNoA11yViolations(page, 'spiller');
});

test('quick buy åpner innenfor geofence (Operahuset ≈ 450 m → demo-posisjon)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Innstillinger' }).click();
  await page.getByRole('button', { name: 'Stå ved Operahuset i Oslo' }).click();
  await page.getByRole('button', { name: 'Lukk' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Demo-posisjon er på' })).toBeVisible();
  await page.getByRole('button', { name: 'Vis' }).first().click();
  await expect(page.getByText('Du er ved severdigheten – kjøp og hør nå.')).toBeVisible();
  const buy = page.getByRole('button', { name: /Kjøp denne guiden/ });
  await expect(buy).toBeEnabled();
  await buy.click();
  await expect(page.getByRole('button', { name: 'Start guiden' })).toBeVisible();
});

test('spiller: teksting, synstolking og Neste fungerer uten talestøtte', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('stedsguide:entitlements', JSON.stringify({ subscriptionUntil: '2999-01-01T00:00:00.000Z', plan: 'yearly', quickBuys: [] }));
      window.localStorage.setItem('stedsguide:prefs', JSON.stringify({ lang: 'nb', audioDescription: true }));
    } catch { /* ignore */ }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Vis' }).first().click();
  await page.getByRole('button', { name: 'Start guiden' }).click();
  // Synstolking leses først – teksten er merket.
  await expect(page.getByText('Synstolking:', { exact: false }).first()).toBeVisible();
  await expect(page.locator('.caption--ad')).toContainText('bred, hvit marmorflate');
  await page.getByRole('button', { name: 'Neste' }).click();
  await expect(page.locator('.caption')).toContainText('Velkommen til Operahuset');
  await page.getByRole('button', { name: 'Neste' }).click();
  await expect(page.getByText('Del 2 av 4')).toBeVisible();
  // Teksting av
  await page.getByRole('button', { name: /Teksting/ }).click();
  await expect(page.locator('.caption--off')).toBeVisible();
  await expectNoA11yViolations(page, 'spiller-synstolking');
});

test('språk: bytte til engelsk og arabisk (RTL) oppdaterer UI og <html>', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Innstillinger' }).click();
  await page.getByLabel('Språk').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Nearest attraction' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
  await page.getByLabel('Language').selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'أقرب معلم' })).toBeVisible();
});

test('høy kontrast og stor tekst består WCAG-skann', async ({ page }) => {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('stedsguide:prefs', JSON.stringify({ lang: 'nb', highContrast: true, textSize: 'xlarge' })); } catch { /* ignore */ }
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await tab(page, 'Liste').click();
  await expectNoA11yViolations(page, 'liste-høykontrast');
});
