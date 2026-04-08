import { expect, test } from '@playwright/test';

const CREATORHUB_ORIGIN = 'http://creatorhubn.localtest.me:5001';
const AUTH_TOKEN = 'e2e-token';
const AUTH_USER = {
  id: 'e2e-admin',
  email: 'admin@creatorhubn.com',
  firstName: 'E2E',
  lastName: 'Admin',
  name: 'E2E Admin',
  role: 'admin',
  isAdmin: true,
  verified_email: true,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.route('**/api/auth/user', async (route) => {
    const authorization = route.request().headers().authorization;

    if (authorization === `Bearer ${AUTH_TOKEN}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: AUTH_USER,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: false,
      }),
    });
  });
});

test('landing sign in opens the shared login modal in place', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`${CREATORHUB_ORIGIN}/`, { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /^(Logg inn|Sign in)$/ }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Fortsett med Google' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Logg inn med e-post' })).toBeVisible();
  await expect(page).toHaveURL(`${CREATORHUB_ORIGIN}/`);
});

test('direct /login uses the modal flow and email login redirects correctly', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    const payload = route.request().postDataJSON();

    expect(payload).toMatchObject({
      email: 'admin@creatorhubn.com',
      password: 'super-secret',
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        token: AUTH_TOKEN,
        user: AUTH_USER,
      }),
    });
  });

  await page.goto(`${CREATORHUB_ORIGIN}/login?redirect=%2Fabout`, { waitUntil: 'domcontentloaded' });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('E-postadresse').fill('admin@creatorhubn.com');
  await dialog.getByLabel('Passord').fill('super-secret');

  await Promise.all([
    page.waitForURL(`${CREATORHUB_ORIGIN}/about`),
    dialog.getByRole('button', { name: 'Logg inn med e-post' }).click(),
  ]);

  await expect(page).toHaveURL(`${CREATORHUB_ORIGIN}/about`);

  const storedSession = await page.evaluate(() => ({
    token: window.localStorage.getItem('creatorhub_auth_token'),
    user: JSON.parse(window.localStorage.getItem('creatorhub_auth_user') || 'null'),
  }));

  expect(storedSession.token).toBe(AUTH_TOKEN);
  expect(storedSession.user?.email).toBe(AUTH_USER.email);
  expect(storedSession.user?.role).toBe('admin');
});

test('google login launch uses the shared modal and correct redirect target', async ({ page }) => {
  let oauthPayload: Record<string, unknown> | null = null;

  await page.route('**/api/creatorhub/google/oauth/start', async (route) => {
    oauthPayload = route.request().postDataJSON() as Record<string, unknown>;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authorizationUrl: `${CREATORHUB_ORIGIN}/about?from=google`,
      }),
    });
  });

  await page.goto(`${CREATORHUB_ORIGIN}/login?redirect=%2Fabout`, { waitUntil: 'domcontentloaded' });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await Promise.all([
    page.waitForURL(`${CREATORHUB_ORIGIN}/about?from=google`),
    dialog.getByRole('button', { name: 'Fortsett med Google' }).click(),
  ]);

  expect(oauthPayload).toMatchObject({
    mode: 'login',
    returnPath: '/about',
    browserOrigin: CREATORHUB_ORIGIN,
  });
});
