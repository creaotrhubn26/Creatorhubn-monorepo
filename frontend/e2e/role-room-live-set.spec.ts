/**
 * E2E: Live Set Mode (LIVE/EDIT/REVIEW + footer + slate + DIT-drawer)
 *
 * Kjør lokalt:
 *   npx playwright test e2e/role-room-live-set.spec.ts --project=chromium
 *
 * Kjør mot prod:
 *   E2E_BASE_URL=https://theroleroom.com \
 *     npx playwright test --config=playwright.smoke.config.ts \
 *     e2e/role-room-live-set.spec.ts
 *
 * Test-harnessen lever på /e2e-test.html som rendrer
 * RoleRoomDashboardPanel uten full app-shell. LiveSetMode må aktiveres
 * via prosjekt-flowen, så tester her er fokuserte på komponent-rendering
 * via hovedfunksjon-paneler.
 */

import { test, expect, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-test.html';

async function gotoRoleRoom(page: Page) {
  await page.goto(TEST_PAGE, { waitUntil: 'load', timeout: 60_000 });
  await expect(
    page.getByText('Casting, crew & produksjonsplanlegging'),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe('LiveSetMode — rendering + interactions', () => {
  test('Role Room loader uten JS-feil', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await gotoRoleRoom(page);

    // Filtrer ut kjente non-fatal warnings (React strict mode, etc.)
    const fatal = errors.filter((e) =>
      !e.includes('Warning:') && !e.includes('was preloaded'),
    );
    expect(fatal).toEqual([]);
  });

  test('Hovedstats viser fire kort', async ({ page }) => {
    await gotoRoleRoom(page);
    for (const label of ['Prosjekter', 'Roller', 'Kandidater', 'Crew']) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });
});

// Sprint A.7: Disse er prod-smoke-tester — SEO-rutene (/vs-studiobinder,
// /dansestudio etc.) eksisterer ikke i e2e-harness-en på localhost:5001.
// Kjøres bare når E2E_BASE_URL peker mot ekte prod-server.
const IS_PROD_E2E = Boolean(process.env.E2E_BASE_URL);
test.describe('SEO landingssider — rendring', () => {
  test.skip(!IS_PROD_E2E, 'SEO-ruter eksisterer kun på prod');
  for (const path of [
    '/vs-studiobinder',
    '/vs-castingnetworks',
    '/vs-moviemagic',
    '/for-studenter',
    '/dansestudio',
    '/innholdsprodusenter',
    '/alternatives',
  ]) {
    test(`${path} rendrer H1`, async ({ page }) => {
      // Mot prod (E2E_BASE_URL satt i smoke-config)
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const h1 = page.locator('h1').first();
      await expect(h1).toBeVisible({ timeout: 15_000 });
      const h1Text = await h1.textContent();
      expect(h1Text).toBeTruthy();
      expect(h1Text!.length).toBeGreaterThan(5);
    });
  }
});

// Sprint A.7: GEO-assets serveres bare av prod (robots.txt, llms.txt,
// sitemap.xml). Vite-dev har ikke statiske filer for disse. Skipper lokalt.
test.describe('GEO assets', () => {
  test.skip(!IS_PROD_E2E, 'GEO-assets serveres kun av prod');
  test('robots.txt har AI-crawler-tillatelse', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/GPTBot/);
    expect(body).toMatch(/ClaudeBot/);
    expect(body).toMatch(/PerplexityBot/);
  });

  test('llms.txt eksisterer og har kanonisk produktbeskrivelse', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/# The Role Room/);
    expect(body).toMatch(/casting/i);
  });

  test('sitemap.xml inneholder nye SEO-URLer', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/vs-studiobinder/);
    expect(body).toMatch(/for-studenter/);
    expect(body).toMatch(/dansestudio/);
  });
});

test.describe('Analytics-scripts deployed', () => {
  test('Clarity-script er installert på theroleroom.com', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    expect(html).toMatch(/clarity\.ms|CLARITY_PROJECT/i);
  });

  test('GA4 er installert', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    expect(html).toMatch(/G-9T7K5TJVFX|googletagmanager/i);
  });
});

test.describe('Backend smoke (via fetch)', () => {
  test('Backend /api/health returnerer 200', async ({ request }) => {
    const res = await request.get('https://creatorhub-backend-rtbl.onrender.com/api/health');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  test('Auth-gated endpoints returnerer 401 uten session', async ({ request }) => {
    const endpoints = [
      '/api/role-room/projects/test/auditions',
      '/api/admin/community/channels',
      '/api/admin/community/reddit/status',
      '/api/dit/projects/test/destinations',
      '/api/dit/projects/test/take-status',
    ];
    for (const ep of endpoints) {
      const res = await request.get(`https://creatorhub-backend-rtbl.onrender.com${ep}`);
      expect(res.status(), `${ep} skal være auth-gated`).toBe(401);
    }
  });

  test('Public stats returnerer 7 metrics', async ({ request }) => {
    const res = await request.get('https://creatorhub-backend-rtbl.onrender.com/api/role-room/public/stats');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('kreative');
    expect(data).toHaveProperty('produksjoner');
    expect(data).toHaveProperty('rollerBesatt');
    expect(data).toHaveProperty('kandidater');
    expect(data).toHaveProperty('auditioner');
    expect(data).toHaveProperty('crew');
    expect(data).toHaveProperty('lokasjoner');
  });

  test('CMS public endpoint returnerer 404 ikke 500', async ({ request }) => {
    const res = await request.get('https://creatorhub-backend-rtbl.onrender.com/api/cms/pages/for-studenter');
    // Etter migrasjon 145 skal dette være 404 (ingen content lagret)
    // Hvis 500: backend mangler publish_at-kolonne
    expect([200, 404]).toContain(res.status());
  });
});
