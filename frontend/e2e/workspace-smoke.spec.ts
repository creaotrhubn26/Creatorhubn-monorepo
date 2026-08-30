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

const ORIGIN = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5001';
test.use({ serviceWorkers: 'block' });
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
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.stack || err.message}`));
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
  ticketRequestHeaders: Array<Record<string, string>> = [],
) {
  // Registrer en ufarlig catch-all først. De spesifikke API-rutene nedenfor
  // registreres senere og har høyere prioritet i Playwright. Dette hindrer at
  // globale providers proxyer dusinvis av irrelevante kall til en backend som
  // med hensikt ikke kjører i denne isolerte UI-smoken.
  await page.route(
    (url) => url.pathname.startsWith('/api/') && url.pathname !== '/api/ipad/ws/events',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      }),
  );

  await page.addInitScript(
    ([token, user]) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('creatorhub_auth_token', token as string);
      window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    },
    [AUTH_TOKEN, AUTH_USER] as const,
  );
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    const attemptedUrls: string[] = [];
    Object.defineProperty(window, '__workspaceUserEventSocketUrls', {
      configurable: true,
      value: attemptedUrls,
    });
    Object.defineProperty(window, 'WebSocket', {
      configurable: true,
      value: new Proxy(NativeWebSocket, {
        construct(target, args) {
          attemptedUrls.push(String(args[0]));
          return Reflect.construct(target, args);
        },
      }),
    });
  });

  await page.route('**/api/auth/user', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, user: AUTH_USER }),
    }),
  );
  await page.route('**/api/realtime/user-events-ticket', (route) => {
    ticketRequestHeaders.push(route.request().headers());
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ticket: 'e2e-user-events-ticket',
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
        websocketPath: '/api/ipad/ws/events',
        protocolVersion: 1,
      }),
    });
  });
  // Oversikt-fanens egne endepunkter (default-fane etter auto-redirect).
  await page.route('**/api/projects/*/board-tasks', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tasks: [] }),
    }),
  );
  await page.route('**/api/projects/*/checklist', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );

  // Prosjektlisten styrer picker-vs-auto-redirect.
  await page.route(
    (url) => url.pathname === '/api/projects',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ projects }),
      }),
  );

  // Én autoritativ workspace-bootstrap (prosjekt + kategori + tilgang + team).
  await page.route('**/api/projects/*/workspace-bootstrap', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        project: sampleProject('p1'),
        workspaceCategory: 'visual',
        access: { canRead: true, canEdit: true, isOwner: true },
        owner: {
          userId: AUTH_USER.id,
          name: AUTH_USER.name,
          email: AUTH_USER.email,
        },
        members: [],
      }),
    }),
  );
  // Kompatibilitets-oppslag som enkelte eldre faner fortsatt kan gjøre.
  await page.route(/\/api\/projects\/[^/?]+$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ project: sampleProject('p1') }),
    }),
  );
  await page.route('**/api/projects/*/team/members', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ owner: null, members: [] }),
    }),
  );

  // Badge-/aktivitet-endepunkter TeamWorkspacePage poller — tomt svar er nok.
  const emptyJson = (route: import('@playwright/test').Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  await page.route('**/api/foresporsler/inbound', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );
  await page.route('**/api/projects/*/client-activity', emptyJson);
  await page.route('**/api/projects/*/audio-room/unseen-comments', emptyJson);
  await page.route('**/api/community/user/*/roles', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ roles: [] }),
    }),
  );
  await page.route('**/api/design/tokens*', emptyJson);
  await page.route('**/api/editing/vendor/me', emptyJson);
}

test('multi-project /workspace renders the picker without runtime errors', async ({ page }) => {
  const errors = await collectRuntimeErrors(page);
  await primeAuthAndApi(page, [sampleProject('p1'), sampleProject('p2')]);

  await page.goto(`${ORIGIN}/workspace`, { waitUntil: 'domcontentloaded' });
  // Gi appen tid til å boote, kjøre auth-sjekk og rendre picker-treet.
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, undefined, { timeout: 30000 });

  expect(errors, `Runtime errors on /workspace (picker):\n${errors.join('\n')}`).toEqual([]);
  // Ikke stått igjen på /login (auth holdt) og ikke en blank/krasjet side.
  expect(page.url()).toContain('/workspace');
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(0);
});

test('legacy /dashboard redirect tolerates a cold WorkspaceHome chunk without React #426', async ({ page }) => {
  const errors = await collectRuntimeErrors(page);
  await primeAuthAndApi(page, [sampleProject('p1'), sampleProject('p2')]);

  let delayedWorkspaceChunk = false;
  await page.route(/\/src\/components\/workspace\/WorkspaceHome\.tsx(?:\?.*)?$/, async (route) => {
    delayedWorkspaceChunk = true;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });

  await page.goto(
    `${ORIGIN}/dashboard?chGoogleStatus=success`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForURL('**/workspace', { timeout: 30000 });
  await expect(page.getByText('Smoke Project p1', { exact: true })).toBeVisible({ timeout: 30000 });

  expect(delayedWorkspaceChunk, 'Testen må faktisk forsinke lazy-chunken').toBe(true);
  expect(errors, `Runtime errors on /dashboard → /workspace:\n${errors.join('\n')}`).toEqual([]);
});

test('single-project /workspace auto-redirects into the workspace without React #426', async ({ page }) => {
  const errors = await collectRuntimeErrors(page);
  const moduleFailures: string[] = [];
  const realtimeRequests: string[] = [];
  const realtimeStatuses: number[] = [];
  const ticketRequestHeaders: Array<Record<string, string>> = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/realtime/')) realtimeRequests.push(request.url());
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/realtime/')) realtimeStatuses.push(response.status());
    if (response.status() >= 400 && response.url().includes('/src/')) {
      moduleFailures.push(`HTTP ${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/src/')) {
      moduleFailures.push(`${request.failure()?.errorText || 'request failed'} ${request.url()}`);
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') moduleFailures.push(`console: ${message.text()}`);
  });
  await primeAuthAndApi(page, [sampleProject('p1')], ticketRequestHeaders);

  await page.goto(`${ORIGIN}/workspace`, { waitUntil: 'domcontentloaded' });
  // Auto-redirect: WorkspaceHome → /workspace/p1 (monterer lazy TeamWorkspacePage).
  try {
    await page.waitForURL('**/workspace/p1', { timeout: 30000 });
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nModule failures:\n${moduleFailures.join('\n')}\nPage errors:\n${errors.join('\n')}`,
    );
  }
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, undefined, { timeout: 30000 });

  expect(errors, `Runtime errors on picker→project transition:\n${errors.join('\n')}`).toEqual([]);
  expect(page.url()).toContain('/workspace/p1');
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(0);
  expect(bodyText).toContain('Smoke Project p1');
  expect(bodyText).toContain('Shotlist');
  expect(realtimeRequests, 'Workspace må hente en kortlivet realtime-billett').toContainEqual(
    expect.stringContaining('/api/realtime/user-events-ticket'),
  );
  await expect.poll(() => realtimeStatuses.includes(201)).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            (window as Window & { __workspaceUserEventSocketUrls?: string[] }).__workspaceUserEventSocketUrls ?? []
          ).filter((value) => {
            try {
              return new URL(value).pathname === '/api/ipad/ws/events';
            } catch {
              return false;
            }
          }).length,
      ),
    )
    .toBeGreaterThan(0);
  expect(ticketRequestHeaders[0]?.['x-creatorhub-client']).toBe('web');
  expect(ticketRequestHeaders[0]?.['x-creatorhub-client-version']).toBeTruthy();
  const browserSocketUrls = await page.evaluate(
    () => (window as Window & { __workspaceUserEventSocketUrls?: string[] }).__workspaceUserEventSocketUrls ?? [],
  );
  const userEventsSocketUrl = browserSocketUrls.find((value) => {
    try {
      return new URL(value).pathname === '/api/ipad/ws/events';
    } catch {
      return false;
    }
  });
  expect(userEventsSocketUrl).toBeTruthy();
  const userEventsUrl = new URL(userEventsSocketUrl!);
  expect(userEventsUrl.searchParams.get('ticket')).toBe('e2e-user-events-ticket');
  expect(userEventsUrl.searchParams.has('token')).toBe(false);
  expect(userEventsUrl.toString()).not.toContain(AUTH_TOKEN);
});
