import { expect, test } from '@playwright/test';

test.describe('Leadgrid route and CTA handoffs', () => {
  const magicToken = 'ab'.repeat(32);

  test('localhost boots the Leadgrid router and never hides broken paths behind landing', async ({ page }) => {
    await page.goto('/leadgrid/map');
    await expect(page.getByRole('heading', { name: 'Kartet er foreløpig en app-flate' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tilbake til import' })).toHaveAttribute('href', '/leadgrid/import');

    await page.goto('/leadgrid/no-such-page');
    await expect(page.getByRole('heading', { name: 'Denne siden finnes ikke' })).toBeVisible();
    await expect(page.getByText('Gjør kartet om til kunder.')).toHaveCount(0);
  });

  test('legacy developer, API-key and connector-doc routes resolve honestly', async ({ page }) => {
    await page.goto('/leadgrid/developers');
    await expect(page.getByRole('heading', { name: 'Partners API & Webhooks' })).toBeVisible();

    await page.goto('/leadgrid/partners');
    await expect(page.getByRole('heading', { name: 'Søknad' })).toBeVisible();

    await page.goto('/leadgrid/api-keys');
    await expect(page.getByRole('heading', { name: 'API-nøkler utstedes etter godkjenning' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Søk om API-tilgang' })).toHaveAttribute(
      'href',
      '/leadgrid/utviklere/soknad',
    );

    await page.goto('/leadgrid/docs/slack');
    await expect(page.getByRole('heading', { name: 'Oppskriften for Slack er ikke publisert ennå' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Åpne Swagger UI' })).toHaveAttribute('href', '/api/v1/docs');
  });

  test('pricing query opens the matching real handoff', async ({ page }) => {
    await page.goto('/leadgrid?signup=solo_free');
    await expect(page.getByRole('dialog')).toContainText('Solo Free');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Fortsett til Stripe' })).toBeVisible();

    await page.goto('/leadgrid/pricing');
    const agencyCta = page.getByRole('link', { name: 'Book Agency-demo' });
    await expect(agencyCta).toHaveAttribute('href', '/leadgrid?signup=agency&billing=yearly');
    await agencyCta.click();
    await expect(page).toHaveURL(/\/leadgrid\?signup=agency&billing=yearly$/);
    await expect(page.getByRole('dialog')).toContainText('Book demo');
    await expect(page.getByRole('dialog')).toContainText('Agency · årlig betaling');
  });

  test('free signup hands the verified Turnstile token to self-onboarding', async ({ page }) => {
    await page.addInitScript(() => {
      window.turnstile = {
        ready: (callback) => callback(),
        render: (_container, options) => {
          queueMicrotask(() => options.callback?.('browser-verified-turnstile-token'));
          return 'leadgrid-test-widget';
        },
        reset: () => undefined,
        remove: () => undefined,
      };
    });

    let submittedBody: Record<string, unknown> | null = null;
    await page.route('**/api/leadgrid/self-onboard', async (route) => {
      submittedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: { 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          organization: {
            id: 'org-signup-1',
            name: 'Browserbedriften AS',
            slug: 'browserbedriften-as',
            org_type: 'customer',
            plan: 'solo_free',
          },
          user_id: 'user-signup-1',
          magic_link_sent: true,
          checkout_url: null,
        }),
      });
    });

    page.once('dialog', async (browserDialog) => browserDialog.accept());
    await page.goto('/leadgrid?signup=solo_free');
    await page.getByRole('button', { name: 'Kun nødvendige' }).click();
    const signupDialog = page.getByRole('dialog');
    await signupDialog.getByLabel('E-post').fill('owner@example.test');
    await signupDialog.getByLabel('Navn på din organisasjon').fill('Browserbedriften AS');
    const submit = signupDialog.getByRole('button', { name: 'Fortsett til Stripe' });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect.poll(() => submittedBody).toEqual(expect.objectContaining({
      email: 'owner@example.test',
      orgName: 'Browserbedriften AS',
      templateKey: 'solo',
      turnstileToken: 'browser-verified-turnstile-token',
    }));
  });

  test('connector CTAs use reload-safe destinations owned by casting-main', async ({ page }) => {
    await page.goto('/leadgrid/connectors');
    await expect(page.getByRole('link', { name: 'Søk om API-tilgang' }).first()).toHaveAttribute(
      'href',
      '/leadgrid/api-keys',
    );
    await expect(page.getByRole('link', { name: 'Start partnersøknad' })).toHaveAttribute(
      'href',
      '/leadgrid/partners',
    );
    await expect(page.locator('a[href="/leadgrid/docs/slack"]')).toHaveCount(1);
  });

  test('welcome consumes a magic token, cleans the URL and stores the real auth session', async ({ page }) => {
    let consumedToken: string | null = null;
    await page.route('**/api/leadgrid/self-onboard/consume-magic', async (route) => {
      const body = route.request().postDataJSON() as { token?: string };
      consumedToken = body.token ?? null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          success: true,
          token: 'real-server-session-token',
          user: {
            id: 'user-1',
            email: 'owner@example.test',
            name: 'Ola Nordmann',
            role: 'member',
            isAdmin: false,
            verified_email: true,
          },
          organization: {
            id: 'org-1',
            name: 'Nordmann AS',
            slug: 'nordmann-as',
            plan: 'solo_free',
          },
        }),
      });
    });

    // Query støttes for lenker som allerede er sendt ut.
    await page.goto(`/leadgrid/welcome?token=${magicToken}&checkout=success`);

    await expect(page).toHaveURL(/\/leadgrid\/welcome$/);
    await expect(page.getByRole('heading', { name: 'Velkommen til Nordmann AS' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Importer første kundeliste' })).toHaveAttribute(
      'href',
      '/leadgrid/import',
    );
    expect(consumedToken).toBe(magicToken);
    await expect.poll(() => page.evaluate(() => ({
      token: localStorage.getItem('creatorhub_auth_token'),
      user: JSON.parse(localStorage.getItem('creatorhub_auth_user') || 'null') as { id?: string } | null,
    }))).toEqual({
      token: 'real-server-session-token',
      user: expect.objectContaining({ id: 'user-1', verified_email: true }),
    });
  });

  test('welcome completes Google code exchange, cleans the URL and stores the persistent session', async ({ page }) => {
    const googleState = 'cd'.repeat(16);
    let callbackBody: { code?: string; state?: string } | null = null;
    let exchangeBody: { id_token?: string; platform?: string } | null = null;
    let callbackCalls = 0;
    let exchangeCalls = 0;

    await page.route('**/api/leadgrid/auth/google/callback', async (route) => {
      callbackCalls += 1;
      callbackBody = route.request().postDataJSON() as { code?: string; state?: string };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Cache-Control': 'no-store' },
        body: JSON.stringify({ id_token: 'verified-google-id-token' }),
      });
    });
    await page.route('**/api/leadgrid/auth/google/exchange', async (route) => {
      exchangeCalls += 1;
      exchangeBody = route.request().postDataJSON() as { id_token?: string; platform?: string };
      if (exchangeCalls === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'session_store_unavailable' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          bearer: 'persistent-google-session',
          user: {
            id: 'google-user-1',
            email: 'google@example.test',
            name: 'Google User',
            displayName: 'Google User',
            role: 'member',
            isAdmin: false,
            verified_email: true,
          },
          organization_id: 'org-google-1',
        }),
      });
    });

    await page.goto(`/leadgrid/welcome#google_code=one-time-code&state=${googleState}`);

    await expect(page).toHaveURL(/\/leadgrid\/welcome$/);
    await expect(page.getByRole('heading', { name: 'Innloggingen ble ikke fullført' })).toBeVisible();
    const acceptCookies = page.getByRole('button', { name: 'Godta alle' });
    if (await acceptCookies.isVisible()) {
      await acceptCookies.click();
    }
    await page.getByRole('button', { name: 'Prøv igjen' }).click();
    await expect(page.getByRole('heading', { name: 'Velkommen til Leadgrid' })).toBeVisible();
    expect(callbackCalls).toBe(1);
    expect(exchangeCalls).toBe(2);
    expect(callbackBody).toEqual({ code: 'one-time-code', state: googleState });
    expect(exchangeBody).toEqual(expect.objectContaining({
      id_token: 'verified-google-id-token',
      platform: 'web',
    }));
    await expect.poll(() => page.evaluate(() => ({
      token: localStorage.getItem('creatorhub_auth_token'),
      user: JSON.parse(localStorage.getItem('creatorhub_auth_user') || 'null') as { id?: string } | null,
    }))).toEqual({
      token: 'persistent-google-session',
      user: expect.objectContaining({ id: 'google-user-1', verified_email: true }),
    });
  });

  test('welcome distinguishes expired, cancelled and missing links without exposing the token', async ({ page }) => {
    let consumeCalls = 0;
    await page.route('**/api/leadgrid/self-onboard/consume-magic', async (route) => {
      consumeCalls += 1;
      await route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'magic_token_expired' }),
      });
    });

    // Nye lenker bruker fragment; fragmentet forlater aldri nettleseren.
    await page.goto(`/leadgrid/welcome?checkout=success#token=${magicToken}`);
    await expect(page).toHaveURL(/\/leadgrid\/welcome$/);
    await expect(page.getByRole('heading', { name: 'Engangslenken er ikke aktiv lenger' })).toBeVisible();
    expect(consumeCalls).toBe(1);

    await page.goto('/leadgrid/welcome?checkout=cancelled');
    await expect(page).toHaveURL(/\/leadgrid\/welcome$/);
    await expect(page.getByRole('heading', { name: 'Ingen betaling ble fullført' })).toBeVisible();
    expect(consumeCalls).toBe(1);

    await page.goto('/leadgrid/welcome');
    await expect(page.getByRole('heading', { name: 'Velkomstlenken mangler' })).toBeVisible();
    expect(consumeCalls).toBe(1);
  });
});
