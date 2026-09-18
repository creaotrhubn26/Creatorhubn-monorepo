import { expect, test } from '@playwright/test';

test.describe('Post Agent Role Room OAuth', () => {
  test('starts the Role Room OAuth endpoint and preserves the pairing return path', async ({ page }) => {
    let oauthStartPayload: Record<string, unknown> | null = null;

    await page.route('**/api/post-agent/pairing/redeem', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });
    await page.route('**/api/role-room/google/oauth/start', async (route) => {
      oauthStartPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          mode: 'login',
          authorizationUrl: `${new URL(page.url()).origin}/oauth-sentinel`,
          stateId: 'state-1',
        }),
      });
    });

    await page.goto('/link?code=ABC-DEF');
    await page.getByRole('button', { name: 'Pare Post Agent' }).click();
    await expect(page.getByText('Du må være logget inn på Role Room')).toBeVisible();

    await Promise.all([
      page.waitForURL('**/oauth-sentinel'),
      page.getByRole('button', { name: 'Logg inn med Google' }).click(),
    ]);

    expect(oauthStartPayload).toEqual({
      mode: 'login',
      returnPath: '/link?code=ABC-DEF',
      browserOrigin: new URL(page.url()).origin,
    });
  });

  test('consumes the callback session and pairs with the Role Room bearer', async ({ page }) => {
    let pairingAuthorization: string | null = null;
    let pairingPayload: Record<string, unknown> | null = null;

    await page.route('**/api/role-room/google/oauth/session-result/transfer-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          mode: 'login',
          transferId: 'transfer-1',
          sessionToken: 'role-room-session',
          user: {
            id: 'user-1',
            email: 'daniel@creatorhubn.com',
            role: 'admin',
            display_name: 'Daniel',
            requestedRole: null,
          },
          google: {
            email: 'daniel@creatorhubn.com',
            subject: 'google-subject',
            profile: {},
          },
        }),
      });
    });
    await page.route('**/api/post-agent/pairing/redeem', async (route) => {
      pairingAuthorization = route.request().headers().authorization ?? null;
      pairingPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto(
      '/link?code=ABC-DEF&rrGoogleStatus=success&rrGoogleMode=login&rrGoogleTransfer=transfer-1',
    );

    await expect(page.getByText('Innlogging fullført. Du kan nå pare Post Agent.')).toBeVisible();
    await expect(page).toHaveURL(/\/link\?code=ABC-DEF$/);
    await page.getByRole('button', { name: 'Pare Post Agent' }).click();

    await expect(page.getByText('Paret. Post Agent fullfører oppsettet')).toBeVisible();
    expect(pairingAuthorization).toBe('Bearer role-room-session');
    expect(pairingPayload).toEqual({ code: 'ABC-DEF' });
  });
});
