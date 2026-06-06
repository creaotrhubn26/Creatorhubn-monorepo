/**
 * E2E: AdminDashboard — Oversikt + Forretning (16 kritisk-vei tester)
 *
 * Hensikt
 * -------
 * For hver av de 16 fanene i "Oversikt"- og "Forretning"-gruppene i
 * AdminDashboard.tsx (linje 889–940, 944–953 i shell-gruppene):
 *   1. logg inn som admin
 *   2. lytt på alle /api/admin/*-responses
 *   3. klikk fanen
 *   4. vent 2–3 sek på fetch
 *   5. verifiser at relevant endepunkt ble kalt og returnerte 2xx
 *   6. unngå destructive operasjoner (kun GET — ingen send/POST/DELETE)
 *
 * Mønstret er kopiert fra `admin-chat.spec.ts` og
 * `admin-dashboard-functional.spec.ts`:
 *   - addInitScript setter `creatorhub_auth_token` + `creatorhub_auth_user`
 *   - route('**\/api/auth/user') returnerer authenticated:true
 *   - goto('/admin') og venter på at tunge admin-shellet rekker å rendere
 *
 * Tester er uavhengige (egen page + context per test) — ikke serial.
 * Bruker expect.soft slik at alle 16 kjører selv om noen feiler.
 *
 * Faner som dekkes (id + label, fra AdminDashboard.tsx):
 *   Oversikt:
 *     1.  overblikk            → "Overblikk"
 *     2.  brukere-roller       → "Brukere & Roller"
 *     3.  invite-requests      → "Tilgangsforespørsler"
 *     4.  send-notifications   → "Send varslinger"    (UI-only, no send)
 *     5.  community            → "Community"
 *     6.  innhold-assets       → "Innhold & Assets"
 *     7.  kunder-prosjekter    → "Kunder/Prosjekter"
 *     8.  kommunikasjon        → "Kommunikasjon"      (5xx-check)
 *   Forretning:
 *     9.  okonomi              → "Økonomi"
 *     10. price-management     → "Prisstyring"
 *     11. user-costs           → "Bruker-kostnader"
 *     12. reports              → "Rapporter"
 *     13. academy              → "Academy"
 *     14. tidum-tilganger      → "Tidum"
 *     15. vendor-types         → "Leverandørtyper"
 *     16. profession-types     → "Profesjonstyper"
 */

import { test, expect, type Page, type BrowserContext, type Browser } from '@playwright/test';

// ── Konstanter ────────────────────────────────────────────

const ADMIN_URL = 'http://localhost:5001/admin';
const LOAD_TIMEOUT = 60_000;
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
  permissions: ['users:read', 'users:write', 'roles:write', 'academy:admin', 'billing:admin', 'impersonate'],
  isAdmin: true,
  verified_email: true,
};

type ApiResponseRecord = {
  url: string;
  status: number;
  method: string;
};

// ── Helpers ───────────────────────────────────────────────

/**
 * Setter opp en BrowserContext med admin-auth pre-injisert og fanger
 * alle /api/admin/*-responses i `apiResponses`-arrayen.
 */
async function createAdminContext(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
  apiResponses: ApiResponseRecord[];
  pageErrors: string[];
}> {
  const context: BrowserContext = await browser.newContext();
  await context.addInitScript(
    ({ token, user }: { token: string; user: typeof AUTH_USER }) => {
      window.localStorage.setItem('creatorhub_auth_token', token);
      window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
      window.localStorage.setItem('userId', user.id);
      window.localStorage.setItem('userEmail', user.email);
      // For å unngå at "destructive"-knapper trigger ved et uhell:
      window.localStorage.setItem('e2e-readonly', '1');
    },
    { token: AUTH_TOKEN, user: AUTH_USER },
  );
  await context.route('**/api/auth/user', async (route) => {
    const authorization = route.request().headers().authorization;
    if (authorization === `Bearer ${AUTH_TOKEN}` || !authorization) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, user: AUTH_USER }),
      });
      return;
    }
    await route.fallback();
  });

  const page = await context.newPage();
  const apiResponses: ApiResponseRecord[] = [];
  const pageErrors: string[] = [];

  // Lytt på alle /api/admin/*-responses
  page.on('response', (resp) => {
    const url = resp.url();
    if (url.includes('/api/admin/') || url.includes('/api/invites/admin/')) {
      apiResponses.push({
        url,
        status: resp.status(),
        method: resp.request().method(),
      });
    }
  });

  page.on('pageerror', (err) => pageErrors.push(err.message));

  return { context, page, apiResponses, pageErrors };
}

/**
 * Logger inn som admin og navigerer til /admin. Venter 8 sek på at det
 * tunge admin-shellet rekker å montere alle faner og første render.
 */
async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
  // Admin dashboard er tungt — gi det tid til å rendre fullt
  await page.waitForTimeout(8000);
  const alive = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root !== null && root.innerHTML.length > 100;
  });
  expect(alive, 'Admin-shell skal være montert').toBe(true);
}

/**
 * Klikker en sidebar-fane-knapp basert på label-tekst.
 * Faner i AdminDashboard.tsx er <Button>-knapper inne i shell-grupper,
 * ikke role="tab", så vi matcher på tekst.
 * Returnerer true hvis en knapp ble funnet og klikket.
 */
async function clickTabButton(page: Page, label: string): Promise<boolean> {
  return page.evaluate((l) => {
    // 1) Foretrekk eksakt label-match (trimmet)
    for (const btn of Array.from(document.querySelectorAll('button'))) {
      const text = (btn.textContent || '').trim();
      if (text === l) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    // 2) Fall tilbake til "inneholder label" — dekker tilfeller hvor
    // ikon eller badge er tilstøtende tekstinnhold.
    for (const btn of Array.from(document.querySelectorAll('button'))) {
      const text = (btn.textContent || '').trim();
      if (text.includes(l)) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  }, label);
}

/**
 * Returnerer alle /api/admin/* (og /api/invites/admin/*) responses som
 * matcher predicate-funksjonen.
 */
function findApiCalls(
  apiResponses: ApiResponseRecord[],
  predicate: (r: ApiResponseRecord) => boolean,
): ApiResponseRecord[] {
  return apiResponses.filter(predicate);
}

/**
 * Felles oppsett + opprydding for hver test. Gir tilbake page +
 * apiResponses-buffer. Hver test får helt egen context/page.
 */
async function setupTest(browser: Browser) {
  const ctx = await createAdminContext(browser);
  await loginAsAdmin(ctx.page);
  return ctx;
}

async function teardownTest(context: BrowserContext) {
  await context.close().catch(() => {
    /* ignore */
  });
}

/**
 * Standard verifiseringsflyt for de fleste fanene:
 *   1. Sjekk at fane-knappen finnes (ellers skip).
 *   2. Klikk fanen.
 *   3. Vent fetch-tid.
 *   4. Verifiser at relevant endepunkt ble kalt + 2xx.
 *   5. Eskaler 404 til klart "Endepunkt mangler".
 */
async function verifyTabEndpoint(args: {
  page: Page;
  apiResponses: ApiResponseRecord[];
  tabLabel: string;
  endpointSubstring: string;
  waitMs?: number;
}): Promise<void> {
  const { page, apiResponses, tabLabel, endpointSubstring, waitMs = 2500 } = args;

  const clicked = await clickTabButton(page, tabLabel);
  if (!clicked) {
    test.skip(true, `Fane-knapp "${tabLabel}" finnes ikke i sidebar — UI-label har endret seg`);
    return;
  }

  await page.waitForTimeout(waitMs);

  const matching = findApiCalls(apiResponses, (r) => r.url.includes(endpointSubstring));

  expect.soft(
    matching.length,
    `Forventet at minst ett kall til ${endpointSubstring} skulle skje når fanen "${tabLabel}" åpnes`,
  ).toBeGreaterThan(0);

  if (matching.length === 0) return;

  // Hvis vi har 404 — kritisk funn: endepunkt mangler
  const has404 = matching.some((r) => r.status === 404);
  expect.soft(
    has404,
    `Endepunkt mangler: ${endpointSubstring} svarte 404 — backend må implementere denne route`,
  ).toBe(false);

  // Minst ett kall må returnere 2xx (status < 400)
  const successful = matching.find((r) => r.status < 400);
  expect.soft(
    successful,
    `${endpointSubstring} skal returnere 2xx for fanen "${tabLabel}". Faktiske statuser: ${matching
      .map((r) => `${r.method} ${r.status}`)
      .join(', ')}`,
  ).toBeDefined();
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE: Oversikt + Forretning (16 faner)
// ═══════════════════════════════════════════════════════════

test.describe('AdminDashboard: Oversikt + Forretning — funksjonell', () => {
  test.describe.configure({ timeout: 60_000 });

  // ── OVERSIKT-gruppen (8 faner) ────────────────────────────

  test('OVERSIKT 1/8: overblikk — GET /api/admin/dashboard returnerer 200', async ({ browser }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      // Overblikk er ofte default-fane (tabValue=0). Klikk likevel for å
      // re-trigge fetch og være sikker på at vi fanger requesten.
      const clicked = await clickTabButton(page, 'Overblikk');
      if (!clicked) {
        // Hvis vi ikke kan klikke (allerede aktiv eller skjult), vent
        // bare på dashboard-fetchen fra initial mount.
        await page.waitForTimeout(2500);
      } else {
        await page.waitForTimeout(2500);
      }

      const dashboardCalls = findApiCalls(apiResponses, (r) => r.url.includes('/api/admin/dashboard'));
      expect.soft(
        dashboardCalls.length,
        'GET /api/admin/dashboard skal ha blitt kalt for Overblikk-fanen',
      ).toBeGreaterThan(0);

      const has404 = dashboardCalls.some((r) => r.status === 404);
      expect.soft(has404, 'Endepunkt mangler: /api/admin/dashboard svarte 404').toBe(false);

      const successful = dashboardCalls.find((r) => r.status < 400);
      expect.soft(successful, '/api/admin/dashboard skal returnere 2xx').toBeDefined();

      // Verifiser at det rendres tall/innhold (overblikk viser nøkkeltall)
      const hasContent = await page.evaluate(() => {
        const root = document.getElementById('root');
        return (root?.textContent || '').length > 500;
      });
      expect.soft(hasContent, 'Overblikk skal rendre substansielt innhold').toBe(true);
    } finally {
      await teardownTest(context);
    }
  });

  test('OVERSIKT 2/8: brukere-roller — GET /api/admin/users returnerer liste, ingen 5xx', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      await verifyTabEndpoint({
        page,
        apiResponses,
        tabLabel: 'Brukere & Roller',
        endpointSubstring: '/api/admin/users',
      });

      // Verifiser at noe innhold ble rendret (rader, kort, eller liste)
      const rowCount = await page
        .locator('[data-testid="user-row"], tbody tr, [role="row"]')
        .count();
      expect.soft(rowCount, 'Brukere & Roller bør rendre minst én rad/kort').toBeGreaterThan(0);

      // Ingen 5xx på admin-API-er
      const serverErrors = findApiCalls(apiResponses, (r) => r.status >= 500);
      expect.soft(
        serverErrors.map((r) => `${r.status} ${r.url}`),
        'Ingen 5xx-feil på admin-API-kall',
      ).toEqual([]);
    } finally {
      await teardownTest(context);
    }
  });

  test('OVERSIKT 3/8: invite-requests — GET /api/invites/admin/requests returnerer liste', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      const clicked = await clickTabButton(page, 'Tilgangsforespørsler');
      if (!clicked) {
        test.skip(true, 'Fane-knapp "Tilgangsforespørsler" finnes ikke i sidebar');
        return;
      }
      await page.waitForTimeout(2500);

      const inviteCalls = findApiCalls(
        apiResponses,
        (r) => r.url.includes('/api/invites/admin/requests') || r.url.includes('/api/admin/invites'),
      );

      expect.soft(
        inviteCalls.length,
        'GET /api/invites/admin/requests (eller /api/admin/invites) skal ha blitt kalt',
      ).toBeGreaterThan(0);

      if (inviteCalls.length > 0) {
        const has404 = inviteCalls.some((r) => r.status === 404);
        expect.soft(
          has404,
          'Endepunkt mangler: /api/invites/admin/requests svarte 404 — backend må implementere route',
        ).toBe(false);

        const successful = inviteCalls.find((r) => r.status < 400);
        expect.soft(successful, 'Invite-requests endepunkt skal returnere 2xx').toBeDefined();
      }
    } finally {
      await teardownTest(context);
    }
  });

  test('OVERSIKT 4/8: send-notifications — skjema rendres (INGEN faktisk send)', async ({
    browser,
  }) => {
    const { context, page } = await setupTest(browser);
    try {
      const clicked = await clickTabButton(page, 'Send varslinger');
      if (!clicked) {
        test.skip(true, 'Fane-knapp "Send varslinger" finnes ikke i sidebar');
        return;
      }
      await page.waitForTimeout(2500);

      // Verifiser at et skjema-element finnes (textarea, input, eller form)
      // Vi sender IKKE — kan spamme alle brukere.
      const hasForm = await page.evaluate(() => {
        return !!(
          document.querySelector('textarea') ||
          document.querySelector('input[type="text"]') ||
          document.querySelector('form')
        );
      });
      expect.soft(hasForm, 'Send varslinger skal ha en skjema-flate (textarea/input/form)').toBe(true);

      // Verifiser at sentral admin-fane-rendering ikke kastet 5xx
      const hasContent = await page.evaluate(() => {
        const root = document.getElementById('root');
        return (root?.textContent || '').toLowerCase().includes('varsl');
      });
      expect.soft(hasContent, 'Fane-innholdet skal nevne "varsl"-relatert tekst').toBe(true);
    } finally {
      await teardownTest(context);
    }
  });

  test('OVERSIKT 5/8: community — GET /api/admin/community/posts returnerer liste', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      await verifyTabEndpoint({
        page,
        apiResponses,
        tabLabel: 'Community',
        endpointSubstring: '/api/admin/community',
      });
    } finally {
      await teardownTest(context);
    }
  });

  test('OVERSIKT 6/8: innhold-assets — CMS-pages lastes via GET /api/admin/cms/pages', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      await verifyTabEndpoint({
        page,
        apiResponses,
        tabLabel: 'Innhold & Assets',
        endpointSubstring: '/api/admin/cms',
      });
    } finally {
      await teardownTest(context);
    }
  });

  test('OVERSIKT 7/8: kunder-prosjekter — GET /api/admin/customers-detailed returnerer', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      await verifyTabEndpoint({
        page,
        apiResponses,
        tabLabel: 'Kunder/Prosjekter',
        endpointSubstring: '/api/admin/customers',
      });
    } finally {
      await teardownTest(context);
    }
  });

  test('OVERSIKT 8/8: kommunikasjon — hovedlisten rendres uten 5xx', async ({ browser }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      const clicked = await clickTabButton(page, 'Kommunikasjon');
      if (!clicked) {
        test.skip(true, 'Fane-knapp "Kommunikasjon" finnes ikke i sidebar');
        return;
      }
      await page.waitForTimeout(2500);

      // Hovedkravet: ingen 5xx
      const serverErrors = findApiCalls(apiResponses, (r) => r.status >= 500);
      expect.soft(
        serverErrors.map((r) => `${r.status} ${r.url}`),
        'Kommunikasjon-fanen skal ikke kaste 5xx fra admin-API-er',
      ).toEqual([]);

      // Verifiser at noe ble rendret (innhold > 200 tegn)
      const contentLength = await page.evaluate(() => {
        const root = document.getElementById('root');
        return (root?.textContent || '').length;
      });
      expect.soft(contentLength, 'Kommunikasjon skal rendre noe innhold').toBeGreaterThan(200);
    } finally {
      await teardownTest(context);
    }
  });

  // ── FORRETNING-gruppen (8 faner) ──────────────────────────

  test('FORRETNING 9/16: okonomi — GET /api/admin/billing/overview returnerer 200', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      await verifyTabEndpoint({
        page,
        apiResponses,
        tabLabel: 'Økonomi',
        endpointSubstring: '/api/admin/billing/overview',
      });
    } finally {
      await teardownTest(context);
    }
  });

  test('FORRETNING 10/16: price-management — GET /api/admin/enterprise-pricing returnerer liste', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      await verifyTabEndpoint({
        page,
        apiResponses,
        tabLabel: 'Prisstyring',
        endpointSubstring: '/api/admin/enterprise-pricing',
      });
    } finally {
      await teardownTest(context);
    }
  });

  test('FORRETNING 11/16: user-costs — GET /api/admin/users-storage-overview + ai-usage/by-user', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      const clicked = await clickTabButton(page, 'Bruker-kostnader');
      if (!clicked) {
        test.skip(true, 'Fane-knapp "Bruker-kostnader" finnes ikke i sidebar');
        return;
      }
      await page.waitForTimeout(3000);

      // 1) users-storage-overview
      const storageCalls = findApiCalls(
        apiResponses,
        (r) => r.url.includes('/api/admin/users-storage-overview'),
      );
      expect.soft(
        storageCalls.length,
        'GET /api/admin/users-storage-overview skal ha blitt kalt',
      ).toBeGreaterThan(0);
      if (storageCalls.length > 0) {
        expect.soft(
          storageCalls.some((r) => r.status === 404),
          'Endepunkt mangler: /api/admin/users-storage-overview svarte 404',
        ).toBe(false);
        expect.soft(
          storageCalls.find((r) => r.status < 400),
          '/api/admin/users-storage-overview skal returnere 2xx',
        ).toBeDefined();
      }

      // 2) ai-usage/by-user
      const aiUsageCalls = findApiCalls(
        apiResponses,
        (r) => r.url.includes('/api/admin/ai-usage'),
      );
      expect.soft(
        aiUsageCalls.length,
        'GET /api/admin/ai-usage/by-user skal ha blitt kalt',
      ).toBeGreaterThan(0);
      if (aiUsageCalls.length > 0) {
        expect.soft(
          aiUsageCalls.some((r) => r.status === 404),
          'Endepunkt mangler: /api/admin/ai-usage/by-user svarte 404',
        ).toBe(false);
        expect.soft(
          aiUsageCalls.find((r) => r.status < 400),
          '/api/admin/ai-usage/by-user skal returnere 2xx',
        ).toBeDefined();
      }
    } finally {
      await teardownTest(context);
    }
  });

  test('FORRETNING 12/16: reports — GET /api/admin/reports returnerer', async ({ browser }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      await verifyTabEndpoint({
        page,
        apiResponses,
        tabLabel: 'Rapporter',
        endpointSubstring: '/api/admin/reports',
      });
    } finally {
      await teardownTest(context);
    }
  });

  test('FORRETNING 13/16: academy — GET /api/admin/academy/courses + /instructors', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      const clicked = await clickTabButton(page, 'Academy');
      if (!clicked) {
        test.skip(true, 'Fane-knapp "Academy" finnes ikke i sidebar');
        return;
      }
      await page.waitForTimeout(3000);

      // 1) academy/courses
      const courseCalls = findApiCalls(
        apiResponses,
        (r) => r.url.includes('/api/admin/academy/courses'),
      );
      expect.soft(
        courseCalls.length,
        'GET /api/admin/academy/courses skal ha blitt kalt',
      ).toBeGreaterThan(0);
      if (courseCalls.length > 0) {
        expect.soft(
          courseCalls.some((r) => r.status === 404),
          'Endepunkt mangler: /api/admin/academy/courses svarte 404',
        ).toBe(false);
        expect.soft(
          courseCalls.find((r) => r.status < 400),
          '/api/admin/academy/courses skal returnere 2xx',
        ).toBeDefined();
      }

      // 2) academy/instructors
      const instructorCalls = findApiCalls(
        apiResponses,
        (r) => r.url.includes('/api/admin/academy/instructors'),
      );
      expect.soft(
        instructorCalls.length,
        'GET /api/admin/academy/instructors skal ha blitt kalt',
      ).toBeGreaterThan(0);
      if (instructorCalls.length > 0) {
        expect.soft(
          instructorCalls.some((r) => r.status === 404),
          'Endepunkt mangler: /api/admin/academy/instructors svarte 404',
        ).toBe(false);
        expect.soft(
          instructorCalls.find((r) => r.status < 400),
          '/api/admin/academy/instructors skal returnere 2xx',
        ).toBeDefined();
      }
    } finally {
      await teardownTest(context);
    }
  });

  test('FORRETNING 14/16: tidum-tilganger — GET /api/admin/tidum-access-requests returnerer', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      await verifyTabEndpoint({
        page,
        apiResponses,
        tabLabel: 'Tidum',
        endpointSubstring: '/api/admin/tidum',
      });
    } finally {
      await teardownTest(context);
    }
  });

  test('FORRETNING 15/16: vendor-types — GET /api/admin/vendor-types returnerer', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      await verifyTabEndpoint({
        page,
        apiResponses,
        tabLabel: 'Leverandørtyper',
        endpointSubstring: '/api/admin/vendor-types',
      });
    } finally {
      await teardownTest(context);
    }
  });

  test('FORRETNING 16/16: profession-types — GET /api/admin/profession-types returnerer', async ({
    browser,
  }) => {
    const { context, page, apiResponses } = await setupTest(browser);
    try {
      await verifyTabEndpoint({
        page,
        apiResponses,
        tabLabel: 'Profesjonstyper',
        endpointSubstring: '/api/admin/profession-types',
      });
    } finally {
      await teardownTest(context);
    }
  });
});
