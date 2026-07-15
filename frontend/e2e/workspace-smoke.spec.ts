import { expect, test, type ConsoleMessage } from '@playwright/test';

/**
 * /workspace runtime smoke — fanger de to feilene som tsc IKKE fanger:
 *   1. «useRealTime must be used within a RealTimeProvider» (manglende provider
 *      på /workspace-rutene).
 *   2. React #426 «suspended while responding to synchronous input» —
 *      picker → prosjekt auto-navigasjon som monterer lazy TeamWorkspacePage
 *      uten startTransition.
 *
 * Begge er runtime-kast → 'pageerror'. Testen asserter null uncaught errors +
 * fravær av de spesifikke signaturene, på begge kodeveiene (flere prosjekter =
 * picker; ett prosjekt = auto-redirect inn i TeamWorkspacePage).
 */

const ORIGIN = 'http://localhost:5001';
const AUTH_TOKEN = 'e2e-token';
const AUTH_USER = {
  id: 'e2e-user',
  email: 'smoke@creatorhubn.com',
  firstName: 'Smoke',
  lastName: 'Test',
  name: 'Smoke Test',
  role: 'photographer',
  profession: 'photographer',
  isAdmin: false,
  verified_email: true,
};

const RUNTIME_ERROR_SIGNATURES = [
  'useRealTime must be used within a RealTimeProvider',
  'Minified React error #426',
  'suspended while responding to synchronous input',
  'must be used within',
];

function sampleProject(id: string) {
  return {
    id,
    title: `Smoke Project ${id}`,
    name: `Smoke Project ${id}`,
    projectType: 'wedding',
    status: 'active',
    eventDate: '2026-09-14',
    location: 'Oslo',
    coverUrl: null,
  };
}

/** Fanger uncaught exceptions + console.error som matcher kjente signaturer. */
async function collectRuntimeErrors(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (RUNTIME_ERROR_SIGNATURES.some((sig) => text.includes(sig))) {
      errors.push(`[console.error] ${text}`);
    }
  });
  return errors;
}

/** Seed auth + generøse API-mocks slik at /workspace-treet rendrer fullt ut. */
async function primeAuthAndApi(
  page: import('@playwright/test').Page,
  projects: ReturnType<typeof sampleProject>[],
) {
  await page.addInitScript(
    ([token, user]) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('creatorhub_auth_token', token as string);
      window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    },
    [AUTH_TOKEN, AUTH_USER] as const,
  );

  await page.route('**/api/auth/user', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, user: AUTH_USER }),
    }),
  );

  // Oversikt-fanens egne endepunkter (default-fane etter auto-redirect).
  await page.route('**/api/projects/*/board-tasks', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: [] }) }),
  );
  await page.route('**/api/projects/*/checklist', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }),
  );

  // Prosjektlisten styrer picker-vs-auto-redirect.
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projects }) }),
  );

  // Enkelt-prosjekt-oppslag (header) + team-medlemmer.
  await page.route(/\/api\/projects\/[^/?]+$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ project: sampleProject('p1') }) }),
  );
  await page.route('**/api/projects/*/team/members', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ owner: null, members: [] }) }),
  );

  // Badge-/aktivitet-endepunkter TeamWorkspacePage poller — tomt svar er nok.
  const emptyJson = (route: import('@playwright/test').Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  await page.route('**/api/foresporsler/inbound', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }),
  );
  await page.route('**/api/projects/*/client-activity', emptyJson);
  await page.route('**/api/projects/*/audio-room/unseen-comments', emptyJson);
  await page.route('**/api/community/user/*/roles', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ roles: [] }) }),
  );
  await page.route('**/api/design/tokens*', emptyJson);
  await page.route('**/api/editing/vendor/me', emptyJson);
}

test('multi-project /workspace renders the picker without runtime errors', async ({ page }) => {
  const errors = await collectRuntimeErrors(page);
  await primeAuthAndApi(page, [sampleProject('p1'), sampleProject('p2')]);

  await page.goto(`${ORIGIN}/workspace`, { waitUntil: 'domcontentloaded' });
  // Gi appen tid til å boote, kjøre auth-sjekk og rendre picker-treet.
  await page.waitForTimeout(4000);

  expect(errors, `Runtime errors on /workspace (picker):\n${errors.join('\n')}`).toEqual([]);
  // Ikke stått igjen på /login (auth holdt) og ikke en blank/krasjet side.
  expect(page.url()).toContain('/workspace');
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(0);
});

test('single-project /workspace auto-redirects into the workspace without React #426', async ({ page }) => {
  const errors = await collectRuntimeErrors(page);
  await primeAuthAndApi(page, [sampleProject('p1')]);

  await page.goto(`${ORIGIN}/workspace`, { waitUntil: 'domcontentloaded' });
  // Auto-redirect: WorkspaceHome → /workspace/p1 (monterer lazy TeamWorkspacePage).
  await page.waitForURL('**/workspace/p1', { timeout: 15000 });
  await page.waitForTimeout(4000);

  expect(errors, `Runtime errors on picker→project transition:\n${errors.join('\n')}`).toEqual([]);
  expect(page.url()).toContain('/workspace/p1');
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(0);
});
