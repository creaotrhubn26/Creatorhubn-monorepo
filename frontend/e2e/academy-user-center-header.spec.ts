import { expect, test } from '@playwright/test';

const CREATORHUB_ORIGIN = 'http://localhost:5001';
const ACADEMY_HEADER_ROUTE = `${CREATORHUB_ORIGIN}/academy-dashboard`;
const ACADEMY_HEADER_TIMEOUT = 40_000;
const AUTH_TOKEN = 'dev-admin-local-session';
const AUTH_USER = {
  id: 'local-admin',
  email: 'admin@local.dev',
  firstName: 'Local',
  lastName: 'Admin',
  name: 'Local Admin',
  displayName: 'Local Admin',
  role: 'admin',
  roleLabel: 'Admin',
  profession: 'photographer',
  userType: 'photographer',
  permissions: [
    'users:read',
    'users:write',
    'roles:write',
    'academy:admin',
    'billing:admin',
    'impersonate',
  ],
  isAdmin: true,
  verified_email: true,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ token, user }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('creatorhub_auth_token', token);
      window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    },
    { token: AUTH_TOKEN, user: AUTH_USER },
  );

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

test('academy header actions open real notifications, messages, and profile panels', async ({
  page,
}) => {
  await page.goto(ACADEMY_HEADER_ROUTE, {
    waitUntil: 'domcontentloaded',
  });

  await expect(
    page.getByRole('button', { name: /^(Varsler|Notifications)$/ }),
  ).toBeVisible({ timeout: ACADEMY_HEADER_TIMEOUT });

  await Promise.all([
    page.waitForURL(/\/academy\/settings\?tab=notifications/),
    page.getByRole('button', { name: /^(Varsler|Notifications)$/ }).click(),
  ]);

  await expect(
    page.getByRole('heading', { name: /^(Varslingssenter|Notification Center)$/ }).first(),
  ).toBeVisible({ timeout: ACADEMY_HEADER_TIMEOUT });
  await expect(
    page.getByRole('button', { name: /^(Marker alle som lest|Mark all as read)$/ }),
  ).toBeVisible({ timeout: ACADEMY_HEADER_TIMEOUT });

  await page.goto(ACADEMY_HEADER_ROUTE, {
    waitUntil: 'domcontentloaded',
  });

  await Promise.all([
    page.waitForURL(/\/academy\/settings\?tab=messages/),
    page.getByRole('button', { name: /^(Meldinger|Messages)$/ }).click(),
  ]);

  await expect(
    page.getByRole('heading', { name: /^(Meldingssenter|Message Center)$/ }).first(),
  ).toBeVisible({ timeout: ACADEMY_HEADER_TIMEOUT });

  await page.goto(ACADEMY_HEADER_ROUTE, {
    waitUntil: 'domcontentloaded',
  });

  await Promise.all([
    page.waitForURL(/\/academy\/settings\?tab=profile/),
    page.getByRole('button', { name: /^(Profil|Profile)$/ }).click(),
  ]);

  await expect(
    page.getByRole('heading', { name: /^(Brukerinnstillinger|User Settings)$/ }).first(),
  ).toBeVisible({ timeout: ACADEMY_HEADER_TIMEOUT });
  await expect(
    page.getByRole('button', { name: /^(Logg ut|Log out)$/ }),
  ).toBeVisible({ timeout: ACADEMY_HEADER_TIMEOUT });
});
