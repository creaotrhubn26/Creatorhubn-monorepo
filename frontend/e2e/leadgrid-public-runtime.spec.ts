import { expect, test, type Page } from '@playwright/test';

async function mockPublicApis(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/leadgrid/experience-config') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"scenes":{}}' });
      return;
    }
    if (path === '/api/leadgrid/pricing-config') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

test('Leadgrid renders a complete static experience with reduced motion', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPublicApis(page);

  await page.goto('/leadgrid', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-leadgrid-experience="static"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gjør kartet om til kunder.', level: 1 })).toBeVisible();
  await expect(page.getByText('Oops! Something went wrong')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('@mobile Leadgrid avoids the motion runtime on narrow screens', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mockPublicApis(page);

  await page.goto('/leadgrid');

  await expect(page.locator('[data-leadgrid-experience="static"]')).toBeVisible();
  await expect(page.getByText('Oops! Something went wrong')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('@tablet Leadgrid keeps the full experience on iPad-sized screens', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mockPublicApis(page);

  await page.goto('/leadgrid');

  await expect(page.locator('[data-leadgrid-experience="static"]')).toHaveCount(0);
  await expect(page.getByText('Oops! Something went wrong')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('anonymous import is gated before protected project requests', async ({ page }) => {
  let projectRequests = 0;
  await page.route('**/api/admin-room/lead-map/projects', async (route) => {
    projectRequests += 1;
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' });
  });

  await page.goto('/leadgrid/import');

  await expect(page.getByRole('heading', { name: 'Logg inn for å importere leads' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Logg inn' })).toHaveAttribute('href', '/login');
  expect(projectRequests).toBe(0);
});

test('Leadgrid legal page uses the public shell without private runtime calls', async ({ page }) => {
  let privateKvRequests = 0;
  let professionRequests = 0;
  let cmsRequests = 0;
  let applicationWebSockets = 0;
  page.on('websocket', (socket) => {
    // Vite's local HMR socket is expected. The production regression was the
    // app notification socket at /ws, which leadgrid.no does not expose.
    if (new URL(socket.url()).pathname === '/ws') applicationWebSockets += 1;
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/user/kv/ai_api_key') privateKvRequests += 1;
    if (path === '/api/admin/profession-types') professionRequests += 1;
    if (path === '/api/cms/pages/terms-and-conditions') cmsRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/leadgrid/terms-and-conditions');

  await expect(page.getByText(/Vilkår og betingelser/).first()).toBeVisible();
  await page.waitForTimeout(250);
  expect(privateKvRequests).toBe(0);
  expect(professionRequests).toBe(0);
  expect(cmsRequests).toBe(0);
  expect(applicationWebSockets).toBe(0);
});

test('Leadgrid login route opens the real login UI', async ({ page }) => {
  await mockPublicApis(page);

  await page.goto('/leadgrid/login');

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/Logg inn/).first()).toBeVisible();
});

test('Leadgrid password link keeps the reset token', async ({ page }) => {
  let resetTokenRequests = 0;
  await page.route('**/api/auth/reset-password/test-token', async (route) => {
    resetTokenRequests += 1;
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"error":"invalid"}',
    });
  });

  await page.goto('/leadgrid/reset-passord/test-token');

  await expect(page.getByText(/Lenken er ikke gyldig/)).toBeVisible();
  // React StrictMode replays mount effects in development, so the request can
  // occur twice locally. The route matcher guarantees every call preserved
  // the exact token; production performs one mount.
  expect(resetTokenRequests).toBeGreaterThanOrEqual(1);
});

test('public landing exposes real login and card-free Solo Free copy', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPublicApis(page);
  await page.goto('/leadgrid');

  await expect(page.getByRole('link', { name: 'Logg inn' }).first()).toHaveAttribute('href', '/login');
  const necessaryCookies = page.getByRole('button', { name: 'Kun nødvendige' });
  if (await necessaryCookies.isVisible()) await necessaryCookies.click();
  await page.getByRole('button', { name: 'Start gratis' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Ingen betalingskort/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Opprett gratis konto' })).toBeVisible();
  await expect(dialog.getByText(/Stripe/)).toHaveCount(0);
});
