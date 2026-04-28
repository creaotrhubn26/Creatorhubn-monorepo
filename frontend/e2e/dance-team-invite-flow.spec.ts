/**
 * dance-team-invite-flow.spec.ts — E2E for dans-team-invite + magic-link/PIN-flyt.
 *
 * Tester (kun frontend, backend mockes via page.route):
 *   1. /dance/invite/<unknown> → viser feilmelding
 *   2. /dance/invite/<token> med mocked API → viser review-skjerm
 *   3. Happy path: review → request PIN → submit PIN → suksess
 *   4. PIN-feil viser error-toast og lar bruker prøve igjen
 *   5. PIN-locked viser tydelig "kontakt Studio-eier"-melding
 *
 * Login-modalens dance-persona-flyten testes ikke her — den er kompleks
 * og krever spesifikt landing-page-state. Verifiseres manuelt.
 */

import { expect, test } from '@playwright/test';

const ORIGIN = 'http://creatorhubn.localtest.me:5001';
const TEST_TOKEN = 'TestInviteTokenABCDEF123456';

// ─── Mocking helpers ────────────────────────────────────────────────────

async function mockInviteInfo(
  page: import('@playwright/test').Page,
  body: Record<string, unknown> | { error: string },
  status = 200,
) {
  await page.route(`**/api/dance/invites/*/info`, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(status === 200 ? { success: true, data: body } : body),
    });
  });
}

async function mockRequestPin(page: import('@playwright/test').Page, ok = true) {
  await page.route(`**/api/dance/invites/*/request-pin`, async (route) => {
    if (ok) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'mailer_not_configured' }),
      });
    }
  });
}

async function mockAcceptWithPin(
  page: import('@playwright/test').Page,
  options: { ok?: boolean; reason?: string } = {},
) {
  const { ok = true, reason = 'pin_invalid' } = options;
  await page.route(`**/api/dance/invites/*/accept-with-pin`, async (route) => {
    if (ok) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            sessionToken: 'new-session-token',
            user: {
              userId: 'invitee-1',
              email: 'invitee@e2e.local',
              name: 'Invitee Tester',
              role: 'user',
              loginAt: new Date().toISOString(),
            },
            teamOrganizationId: 'studio-owner-1',
            danceRoleId: 'role-larer-uuid',
          },
        }),
      });
    } else {
      const status = reason === 'pin_invalid' ? 401
        : reason === 'pin_expired' ? 410
        : reason === 'pin_locked' ? 423 : 400;
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: reason }),
      });
    }
  });
}

const PENDING_INVITE = {
  token: TEST_TOKEN,
  invitedEmailMasked: 'in***@e2e.local',
  invitedRoleLabel: 'Lærer',
  teamOrganizationId: 'studio-owner-1',
  expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
  pinSentAt: null,
  pinLockedAt: null,
  status: 'pending',
};

// ═══════════════════════════════════════════════════════════════════════

test.describe('Dance team invite — PIN-flyt', () => {

  test('utløpt invite viser feilmelding', async ({ page }) => {
    // Vent til InviteLandingPage er kompilert (gjøres av lazy-import) ved
    // å først ramme /dance-routet med happy-path-mock.
    await mockInviteInfo(page, PENDING_INVITE);
    await page.goto(`${ORIGIN}/dance/invite/${TEST_TOKEN}`);
    await expect(page.getByText('Du er invitert')).toBeVisible({ timeout: 30_000 });

    // Bytt mock til expired og navigér til ny token (forces re-fetch)
    await page.unroute(`**/api/dance/invites/*/info`);
    await mockInviteInfo(page, { error: 'expired' }, 410);
    await page.goto(`${ORIGIN}/dance/invite/${TEST_TOKEN}-different`);

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    const text = (await page.getByRole('alert').textContent()) ?? '';
    expect(text.toLowerCase()).toMatch(/utløpt|finnes|hente/);
  });

  test('happy path: review → request PIN → submit PIN', async ({ page }) => {
    await mockInviteInfo(page, PENDING_INVITE);
    await mockRequestPin(page, true);
    await mockAcceptWithPin(page, { ok: true });

    await page.goto(`${ORIGIN}/dance/invite/${TEST_TOKEN}`);

    // Steg 1: review-skjerm
    await expect(page.getByText('Du er invitert')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Lærer').first()).toBeVisible();
    await expect(page.getByText('in***@e2e.local').first()).toBeVisible();

    // Trigg send-PIN
    await page.getByRole('button', { name: /Send PIN/i }).click();

    // Steg 2: PIN-entry
    await expect(page.getByText(/Sjekk e-posten din/i)).toBeVisible({ timeout: 5_000 });

    // Fyll inn PIN + navn + samtykke
    await page.getByLabel(/6-sifret PIN/i).fill('123456');
    await page.getByLabel(/Fullt navn/i).fill('Invitee Tester');
    await page.getByRole('checkbox').check();

    // Submit
    await page.getByRole('button', { name: /Bekreft og bli medlem/i }).click();

    // Suksess
    await expect(page.getByText('Velkommen til teamet!')).toBeVisible({ timeout: 10_000 });
  });

  test('PIN-feil viser error og lar bruker prøve igjen', async ({ page }) => {
    await mockInviteInfo(page, { ...PENDING_INVITE, pinSentAt: new Date().toISOString() });
    await mockRequestPin(page, true);
    await mockAcceptWithPin(page, { ok: false, reason: 'pin_invalid' });

    await page.goto(`${ORIGIN}/dance/invite/${TEST_TOKEN}`);
    await page.getByRole('button', { name: /Send PIN/i }).click();

    await page.getByLabel(/6-sifret PIN/i).fill('000000');
    await page.getByLabel(/Fullt navn/i).fill('Invitee Tester');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Bekreft/i }).click();

    await expect(page.getByText(/Feil PIN/i)).toBeVisible({ timeout: 5_000 });
    // PIN-feltet skal fortsatt være til stede så brukeren kan prøve igjen
    await expect(page.getByLabel(/6-sifret PIN/i)).toBeVisible();
  });

  test('PIN-locked viser kontakt-Studio-eier melding', async ({ page }) => {
    await mockInviteInfo(page, { ...PENDING_INVITE, pinSentAt: new Date().toISOString() });
    await mockRequestPin(page, true);
    await mockAcceptWithPin(page, { ok: false, reason: 'pin_locked' });

    await page.goto(`${ORIGIN}/dance/invite/${TEST_TOKEN}`);
    await page.getByRole('button', { name: /Send PIN/i }).click();

    await page.getByLabel(/6-sifret PIN/i).fill('999999');
    await page.getByLabel(/Fullt navn/i).fill('Tester');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Bekreft/i }).click();

    await expect(page.getByText(/kontakt Studio-eier|ny invitasjon/i)).toBeVisible({ timeout: 5_000 });
  });

  test('mailer ikke konfigurert viser tydelig info', async ({ page }) => {
    await mockInviteInfo(page, PENDING_INVITE);
    await mockRequestPin(page, false); // returnerer 503 mailer_not_configured

    await page.goto(`${ORIGIN}/dance/invite/${TEST_TOKEN}`);
    await page.getByRole('button', { name: /Send PIN/i }).click();

    await expect(page.getByText(/E-posttjenesten er ikke tilgjengelig/i)).toBeVisible({ timeout: 5_000 });
  });

});
