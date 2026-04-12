import { expect, test } from '@playwright/test';

const CREATORHUB_ORIGIN = 'http://localhost:5001';
const AUTH_TOKEN = 'academy-user-center-token';
const AUTH_USER = {
  id: 'academy-user-center',
  email: 'student@creatorhubn.com',
  firstName: 'Ada',
  lastName: 'Creator',
  name: 'Ada Creator',
  role: 'student',
  isAdmin: false,
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
  await page.goto(`${CREATORHUB_ORIGIN}/academy`, {
    waitUntil: 'domcontentloaded',
  });

  await expect(
    page.getByRole('button', { name: /^(Varsler|Notifications)$/ }),
  ).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/academy\/settings\?tab=notifications/),
    page.getByRole('button', { name: /^(Varsler|Notifications)$/ }).click(),
  ]);

  await expect(
    page.getByRole('heading', { name: /^(Varslingssenter|Notification Center)$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^(Marker alle som lest|Mark all as read)$/ }),
  ).toBeVisible();

  await page.goto(`${CREATORHUB_ORIGIN}/academy`, {
    waitUntil: 'domcontentloaded',
  });

  await Promise.all([
    page.waitForURL(/\/academy\/settings\?tab=messages/),
    page.getByRole('button', { name: /^(Meldinger|Messages)$/ }).click(),
  ]);

  await expect(
    page.getByRole('heading', { name: /^(Meldingssenter|Message Center)$/ }),
  ).toBeVisible();

  await page.goto(`${CREATORHUB_ORIGIN}/academy`, {
    waitUntil: 'domcontentloaded',
  });

  await Promise.all([
    page.waitForURL(/\/academy\/settings\?tab=profile/),
    page.getByRole('button', { name: /^(Profil|Profile)$/ }).click(),
  ]);

  await expect(
    page.getByRole('heading', { name: /^(Brukerinnstillinger|User Settings)$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^(Logg ut|Log out)$/ }),
  ).toBeVisible();
});
