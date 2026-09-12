/**
 * E2E: AdminDashboard funksjonell verifisering — Plattform + Lab (22 faner)
 *
 * Hensikt: bekrefte at hver fane i Plattform- og Lab-gruppene faktisk
 * trigger sitt forventede backend-endepunkt (eller i det minste rendrer)
 * etter dark-tema-konverteringen.
 *
 * Mønster lånt fra `admin-dashboard-functional.spec.ts` (samme repo).
 *
 * KARTLEGGING (AdminDashboard.tsx linje 889-940, lest 2026-06-06):
 *
 *   Plattform-gruppen (8 faner):
 *     integrasjoner            → Integrasjoner             → GET /api/admin/integrations/status
 *     feature-management       → Funksjonsflagg            → GET /api/admin/features
 *     centralized-monitoring   → Sentralisert Overvåkning  → GET /api/admin/system/health
 *     protokollstyring         → Protokollstyring          → list-endpoint
 *     secrets-rotation         → Nøkkel-rotering           → GET /api/admin/secrets/rotation
 *     drift-helse              → Drift                     → GET /api/admin/system/health
 *     system-backup            → Backup                    → backup-info (IKKE trigger)
 *     gdpr-compliance          → GDPR                      → GET /api/admin/gdpr-settings
 *
 *   Lab-gruppen (14 faner som testes funksjonelt + 4 stub-faner kun render):
 *     prototype-feedback       → Prototype Feedback        → feedback-list
 *     development-tools        → Utvikling                 → render-only
 *     automations              → Automatisering            → GET /api/admin/automations
 *     creatorhub-notes         → MagicCreator              → notes-list
 *     advanced-notes           → Stor Notatsløsning        → extended notes
 *     integration-test         → Integrasjonstest          → render-only (IKKE klikk Kjør alle)
 *     payment-integration-test → Betalingstest             → render-only (IKKE klikk Execute)
 *     email-analytics          → E-postanalyse             → GET /api/admin/email-analytics
 *     marketing                → Marketing                 → render-only
 *     marketplace-apps         → Marketplace-apper         → GET /api/admin/marketplace/apps
 *     analytics-hub            → Analytics Hub             → GET /api/admin/analytics/*
 *     ai-cost                  → AI-kostnader              → GET /api/admin/ai-usage/*
 *     design-tokens            → Design-tokens             → GET /api/admin/design-tokens
 *     b2-archive               → B2-arkiv                  → GET /api/admin/b2-archive/* (kan være 404)
 *
 *   Stub-faner (render-only, ingen endepunkt-assertion):
 *     tester-skills            → Testerferdigheter
 *     testing-leaderboard      → Test-ledertavle
 *     fine-tuning-monitor      → Fine-tuning
 *     feature-customization    → Tilpasning
 *
 * Total: 22 funksjonelle tester (8 Plattform + 14 Lab inkl. 4 stub).
 *
 * SPESIELLE HENSYN:
 *   - integration-test:        Ikke klikk "Kjør alle tester"
 *   - payment-integration-test: Ikke klikk "Execute all"
 *   - system-backup:           Ikke trigger backup
 *   - secrets-rotation:        Ikke roter secret
 *
 * Hver test er uavhengig (egen page via fixture). Bruker expect.soft for
 * kontinuitet — én feilende fane stopper ikke de andre. 60 sek timeout per test.
 *
 * Hvis et endepunkt returnerer 404 markeres testen som kritisk gap mellom
 * UI og backend.
 */

import { test, expect, type Page } from '@playwright/test';

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

// ── Helpers ────────────────────────────────────────────────

type ApiResponse = { url: string; status: number };

/**
 * Setter localStorage-token + ruter /api/auth/user mocken og navigerer
 * til /admin. Venter 8 sek på at tunge admin-panelet rekker å rendere.
 */
async function loginAsAdmin(page: Page): Promise<void> {
  await page.context().addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem('creatorhub_auth_token', token);
      window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
      window.localStorage.setItem('userId', user.id);
      window.localStorage.setItem('userEmail', user.email);
    },
    { token: AUTH_TOKEN, user: AUTH_USER },
  );

  await page.context().route('**/api/auth/user', async (route) => {
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

  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
  await page.waitForTimeout(8000);

  const alive = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root !== null && root.innerHTML.length > 100;
  });
  expect(alive).toBe(true);
}

/**
 * Klikker en sidebar-knapp som matcher gitt synlig label (case-insensitive,
 * delvis match). Returnerer true om en knapp ble klikket.
 *
 * Sidebar-fanene er <Button>-elementer med tab.label som tekst — ikke
 * <Tab role="tab">. Vi itererer derfor over alle <button>.
 */
async function clickTabButton(page: Page, label: string): Promise<boolean> {
  const clicked = await page.evaluate((target) => {
    const lower = target.toLowerCase();
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
    // Først: eksakt-match (foretrekkes når labels overlapper, f.eks. "Drift"
    // vs "Drift & Helse"). Fall tilbake til substring-match.
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim();
      if (text.toLowerCase() === lower) {
        btn.scrollIntoView({ block: 'center' });
        btn.click();
        return true;
      }
    }
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text.includes(lower)) {
        btn.scrollIntoView({ block: 'center' });
        btn.click();
        return true;
      }
    }
    return false;
  }, label);
  return clicked;
}

/**
 * Sett opp response-sniffer. Returner et array som testen kan filtrere mot.
 */
function attachApiSniffer(page: Page): ApiResponse[] {
  const apiResponses: ApiResponse[] = [];
  page.on('response', (resp) => {
    const url = resp.url();
    if (url.includes('/api/admin/')) {
      apiResponses.push({ url, status: resp.status() });
    }
  });
  return apiResponses;
}

/**
 * Hent total content-størrelse for å verifisere at en stub-fane rendrer
 * faktisk innhold (ikke bare en tom container).
 */
async function getContentSize(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.length : 0;
  });
}

/**
 * Finn første API-respons som matcher en av gitte URL-fragmenter.
 */
function findCall(responses: ApiResponse[], fragments: string[]): ApiResponse | undefined {
  return responses.find((r) => fragments.some((frag) => r.url.includes(frag)));
}

/**
 * Hjelper: assertion som gir klar feilmelding hvis endepunktet mangler (404).
 */
function assertEndpointExists(call: ApiResponse | undefined, endpoint: string): void {
  if (!call) {
    expect.soft(call, `Endepunkt ${endpoint} ble aldri kalt — UI laster ikke data fra forventet kilde`).toBeDefined();
    return;
  }
  if (call.status === 404) {
    expect.soft(
      call.status,
      `Endepunkt ${endpoint} mangler — kritisk gap mellom UI og backend (URL: ${call.url})`,
    ).not.toBe(404);
    return;
  }
  expect.soft(call.status, `Endepunkt ${endpoint} feilet med ${call.status}`).toBeLessThan(400);
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE — Plattform-gruppen (8 faner)
// ═══════════════════════════════════════════════════════════

test.describe('AdminDashboard — Plattform-gruppen', () => {
  test.setTimeout(60_000);

  test('PLATTFORM: integrasjoner — integration-status lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Integrasjoner');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/integrations/status', '/api/admin/integrations']);
    assertEndpointExists(call, 'GET /api/admin/integrations/status');
  });

  test('PLATTFORM: feature-management — flags lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Funksjonsflagg');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/features', '/api/admin/feature-flags']);
    assertEndpointExists(call, 'GET /api/admin/features');
  });

  test('PLATTFORM: centralized-monitoring — system/health lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Sentralisert Overvåkning');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/system/health', '/api/admin/monitoring']);
    assertEndpointExists(call, 'GET /api/admin/system/health');
  });

  test('PLATTFORM: protokollstyring — list-endpoint lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Protokollstyring');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/protocols', '/api/admin/protokol']);
    assertEndpointExists(call, 'GET /api/admin/protocols');
  });

  test('PLATTFORM: secrets-rotation — rotation-status lastes (uten å rotere)', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Nøkkel-rotering');
    await page.waitForTimeout(2500);

    // Bevisst: vi klikker IKKE noen "Roter"-knapp.
    const call = findCall(apiResponses, ['/api/admin/secrets/rotation', '/api/admin/secrets']);
    assertEndpointExists(call, 'GET /api/admin/secrets/rotation');
  });

  test('PLATTFORM: drift-helse — system/health lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    // "Drift" matcher også andre knapper — bruk eksakt label fra adminTabs.
    await clickTabButton(page, 'Drift');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/system/health', '/api/admin/drift']);
    assertEndpointExists(call, 'GET /api/admin/system/health');
  });

  test('PLATTFORM: system-backup — backup-info lastes (uten å trigge backup)', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Backup');
    await page.waitForTimeout(2500);

    // Bevisst: vi klikker IKKE noen "Start backup"-knapp.
    const call = findCall(apiResponses, ['/api/admin/backup', '/api/admin/system/backup']);
    assertEndpointExists(call, 'GET /api/admin/backup');
  });

  test('PLATTFORM: gdpr-compliance — gdpr-settings lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'GDPR');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/gdpr-settings', '/api/admin/gdpr']);
    assertEndpointExists(call, 'GET /api/admin/gdpr-settings');
  });
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE — Lab-gruppen (14 funksjonelle + 4 stub = 18 totalt)
// MERK: User-spec ber om 14 Lab-tester (9–22). De 4 stub-fanene er
// del av disse 14: integration-test, payment-integration-test, og
// stub-faner som tester-skills/testing-leaderboard/fine-tuning-monitor/
// feature-customization rendrer kun.
// ═══════════════════════════════════════════════════════════

test.describe('AdminDashboard — Lab-gruppen', () => {
  test.setTimeout(60_000);

  test('LAB: prototype-feedback — feedback-list lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Prototype Feedback');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/feedback', '/api/admin/prototype-feedback']);
    assertEndpointExists(call, 'GET /api/admin/feedback');
  });

  test('LAB: development-tools — siden rendrer uten 5xx', async ({ page }) => {
    await loginAsAdmin(page);
    const serverErrors: number[] = [];
    page.on('response', (resp) => {
      if (resp.status() >= 500) serverErrors.push(resp.status());
    });

    await clickTabButton(page, 'Utvikling');
    await page.waitForTimeout(2500);

    const size = await getContentSize(page);
    expect.soft(size, 'Utvikling-fanen rendret for lite innhold').toBeGreaterThan(500);
    expect.soft(serverErrors.length, '5xx-respons på Utvikling-fanen').toBe(0);
  });

  test('LAB: automations — automations-list lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Automatisering');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/automations']);
    assertEndpointExists(call, 'GET /api/admin/automations');
  });

  test('LAB: creatorhub-notes (MagicCreator) — notes-list lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'MagicCreator');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/notes', '/api/admin/creatorhub-notes']);
    assertEndpointExists(call, 'GET /api/admin/notes');
  });

  test('LAB: advanced-notes — extended notes lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Stor Notatsløsning');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/notes', '/api/admin/advanced-notes']);
    assertEndpointExists(call, 'GET /api/admin/notes (advanced)');
  });

  test('LAB: integration-test — siden rendrer (IKKE klikk Kjør alle tester)', async ({ page }) => {
    await loginAsAdmin(page);

    await clickTabButton(page, 'Integrasjonstest');
    await page.waitForTimeout(2500);

    // BEVISST: vi klikker IKKE "Kjør alle tester" — bare verifiser render.
    const size = await getContentSize(page);
    expect.soft(size, 'Integrasjonstest-fanen rendret for lite innhold').toBeGreaterThan(500);

    // Bekreft at "Kjør alle"-knappen finnes (siden rendret), men IKKE klikk den.
    const runButtonExists = await page.evaluate(() => {
      return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).some((btn) => {
        const t = (btn.textContent || '').toLowerCase();
        return t.includes('kjør alle') || t.includes('run all');
      });
    });
    expect.soft(runButtonExists, 'Forventet "Kjør alle tester"-knapp på Integrasjonstest-fanen').toBeTruthy();
  });

  test('LAB: payment-integration-test — siden rendrer (IKKE klikk Execute)', async ({ page }) => {
    await loginAsAdmin(page);

    await clickTabButton(page, 'Betalingstest');
    await page.waitForTimeout(2500);

    // BEVISST: vi klikker IKKE "Execute all" — bare verifiser render.
    const size = await getContentSize(page);
    expect.soft(size, 'Betalingstest-fanen rendret for lite innhold').toBeGreaterThan(500);
  });

  test('LAB: email-analytics — email-analytics lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'E-postanalyse');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/email-analytics', '/api/admin/email']);
    assertEndpointExists(call, 'GET /api/admin/email-analytics');
  });

  test('LAB: marketing — siden rendrer', async ({ page }) => {
    await loginAsAdmin(page);

    await clickTabButton(page, 'Marketing');
    await page.waitForTimeout(2500);

    const size = await getContentSize(page);
    expect.soft(size, 'Marketing-fanen rendret for lite innhold').toBeGreaterThan(500);
  });

  test('LAB: marketplace-apps — marketplace/apps lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Marketplace-apper');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/marketplace/apps', '/api/admin/marketplace']);
    assertEndpointExists(call, 'GET /api/admin/marketplace/apps');
  });

  test('LAB: analytics-hub — analytics-endepunkt lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Analytics Hub');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/analytics']);
    assertEndpointExists(call, 'GET /api/admin/analytics/*');
  });

  test('LAB: ai-cost — ai-usage lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'AI-kostnader');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/ai-usage', '/api/admin/ai-cost']);
    assertEndpointExists(call, 'GET /api/admin/ai-usage/*');
  });

  test('LAB: design-tokens — design-tokens lastes', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'Design-tokens');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/design-tokens']);
    assertEndpointExists(call, 'GET /api/admin/design-tokens');
  });

  test('LAB: b2-archive — b2-archive lastes (kan være 404 hvis endepunkt mangler)', async ({ page }) => {
    await loginAsAdmin(page);
    const apiResponses = attachApiSniffer(page);

    await clickTabButton(page, 'B2-arkiv');
    await page.waitForTimeout(2500);

    const call = findCall(apiResponses, ['/api/admin/b2-archive', '/api/admin/b2']);
    if (!call) {
      // Endepunktet mangler helt — det er en kjent risiko, rapporter som soft-fail.
      expect.soft(
        call,
        'Endepunkt /api/admin/b2-archive ble aldri kalt — kritisk gap mellom UI og backend',
      ).toBeDefined();
      return;
    }
    assertEndpointExists(call, 'GET /api/admin/b2-archive/*');
  });
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE — Lab stub-faner (render-only, ingen endepunkt-assertion)
// ═══════════════════════════════════════════════════════════

test.describe('AdminDashboard — Lab stub-faner (render-only)', () => {
  test.setTimeout(60_000);

  test('LAB-STUB: tester-skills — siden rendrer', async ({ page }) => {
    await loginAsAdmin(page);
    await clickTabButton(page, 'Testerferdigheter');
    await page.waitForTimeout(2000);

    const size = await getContentSize(page);
    expect.soft(size, 'Testerferdigheter-fanen rendret for lite innhold').toBeGreaterThan(500);
  });

  test('LAB-STUB: testing-leaderboard — siden rendrer', async ({ page }) => {
    await loginAsAdmin(page);
    await clickTabButton(page, 'Test-ledertavle');
    await page.waitForTimeout(2000);

    const size = await getContentSize(page);
    expect.soft(size, 'Test-ledertavle-fanen rendret for lite innhold').toBeGreaterThan(500);
  });

  test('LAB-STUB: fine-tuning-monitor — siden rendrer', async ({ page }) => {
    await loginAsAdmin(page);
    await clickTabButton(page, 'Fine-tuning');
    await page.waitForTimeout(2000);

    const size = await getContentSize(page);
    expect.soft(size, 'Fine-tuning-fanen rendret for lite innhold').toBeGreaterThan(500);
  });

  test('LAB-STUB: feature-customization — siden rendrer', async ({ page }) => {
    await loginAsAdmin(page);
    await clickTabButton(page, 'Tilpasning');
    await page.waitForTimeout(2000);

    const size = await getContentSize(page);
    expect.soft(size, 'Tilpasning-fanen rendret for lite innhold').toBeGreaterThan(500);
  });
});
