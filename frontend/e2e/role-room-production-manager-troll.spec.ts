import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

const projectId = 'e2e-troll-production';

const initialDay = {
  id: 'troll-production-day-1',
  projectId,
  date: '2026-09-14',
  scenes: ['troll-scene-1'],
  locationId: 'troll-location-forest',
  crew: ['troll-production-manager', 'troll-gaffer'],
  props: [],
  callTime: '07:00',
  wrapTime: '18:00',
  status: 'planned',
  managementVersion: 0,
  productionManagement: {
    dayStatus: 'at_risk',
    callSheetApproval: 'ready_for_review',
    crewConfirmations: [
      { crewId: 'troll-production-manager', status: 'confirmed' },
      { crewId: 'troll-gaffer', status: 'pending' },
    ],
    checkpoints: [
      { id: 'location', category: 'location', title: 'Trollskogen', status: 'ready' },
      { id: 'transport', category: 'transport', title: 'Transport og parkering', status: 'blocked' },
    ],
    issues: [{ id: 'parking', title: 'Manglende parkeringstillatelse', severity: 'high', status: 'open' }],
    costItems: [{ id: 'minibus', category: 'Transport', title: 'Ekstra minibuss', estimatedCost: 5000, actualCost: 6500, status: 'pending' }],
    notes: 'Avklar parkering før publisering.',
    activity: [],
  },
};

async function installAuthenticatedProductionManagerApi(page: Page) {
  let storedProject: Record<string, unknown> | null = null;
  let productionDay = structuredClone(initialDay);
  const authenticatedRequests: string[] = [];
  const savedVersions: number[] = [];

  await page.route('**/api/casting/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/casting/health') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'healthy' }) });
      return;
    }
    if (path === '/api/casting/projects' && request.method() === 'POST') {
      storedProject = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }
    if (path === '/api/casting/projects' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(storedProject ? [storedProject] : []) });
      return;
    }
    if (path === `/api/casting/projects/${projectId}` && request.method() === 'GET') {
      await route.fulfill({ status: storedProject ? 200 : 404, contentType: 'application/json', body: JSON.stringify(storedProject ?? {}) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route(`**/api/role-room/projects/${projectId}/production-days`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ productionDays: [productionDay] }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/production-days/${initialDay.id}/production-management`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const body = route.request().postDataJSON() as { expectedVersion: number; operations: typeof initialDay.productionManagement };
    expect(body.expectedVersion).toBe(productionDay.managementVersion);
    productionDay = {
      ...productionDay,
      managementVersion: productionDay.managementVersion + 1,
      productionManagement: {
        ...body.operations,
        activity: [{
          id: `activity-${productionDay.managementVersion + 1}`,
          type: 'workspace_saved',
          message: 'Oppdaterte dagsnotat.',
          actorUserId: 'e2e-test-user',
          createdAt: '2026-09-12T09:00:00.000Z',
        }],
      },
    };
    savedVersions.push(productionDay.managementVersion);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ productionDay }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/roles`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const role = { id: 'troll-production-manager-role', projectId, userId: 'e2e-test-user', role: 'production_manager' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'GET' ? [role] : { role }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/my-tabs`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tabAccess: null, source: 'default', role: 'production_manager', tabValues: null }) });
  });
  await page.route('**/api/role-room/casting-roles/*/selftapes', async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route(`**/api/role-room/projects/${projectId}/call-sheet-deliveries**`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ deliveries: [{
        id: 'delivery-3', productionDayId: initialDay.id, revision: 3, status: 'published',
        createdAt: '2026-09-12T08:00:00.000Z', total: 4, sent: 4, failed: 0, acknowledged: 3,
      }] }),
    });
  });

  return { authenticatedRequests, savedVersions };
}

test.describe('Autentisert Troll-flyt · produksjonsleder', () => {
  test('kontrollerer alle seks dagsområder og lagrer atomisk uten konsollfeil', async ({ page }) => {
    const runtimeErrors: string[] = [];
    const targetedApiFailures: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(message.text())) {
        runtimeErrors.push(message.text());
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && /\/api\/presence\/heartbeat|\/selftapes(?:[/?#]|$)/i.test(response.url())) {
        targetedApiFailures.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('requestfailed', (request) => {
      if (/\/api\/presence\/heartbeat|\/selftapes(?:[/?#]|$)/i.test(request.url())) {
        targetedApiFailures.push(`requestfailed ${request.url()}`);
      }
    });
    const api = await installAuthenticatedProductionManagerApi(page);

    await openCastingPlanner(page, {
      urlFlags: { seed: 'production-manager-troll', session: 'production-manager', lens: 'production-management' },
    });
    await selectFirstProject(page);

    await expect(page.getByTestId('production-management-workspace')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Troll' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Callsheet og godkjenning' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Crew-bekreftelser' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Logistikk' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kostnadsavvik' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Avvik og tiltak' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dagsnotat og aktivitet' })).toBeVisible();
    await expect(page.getByText(/Publisert revisjon 3/)).toBeVisible();
    await expect(page.getByText('1 500 kr')).toBeVisible();
    await expect(page.getByText('Manglende parkeringstillatelse')).toBeVisible();

    await page.getByLabel('Produksjonsledelsens dagsnotat').fill('Parkering avklart med lokasjon kl. 09:00.');
    await page.getByRole('button', { name: 'Lagre dagskontroll' }).click();
    await expect(page.getByText('Dagskontrollen er lagret som versjon 1.')).toBeVisible();
    await expect(page.getByTestId('production-management-activity')).toContainText('Oppdaterte dagsnotat.');

    expect(api.savedVersions).toEqual([1]);
    expect(api.authenticatedRequests.length).toBeGreaterThan(0);
    expect(api.authenticatedRequests.every((header) => header === 'Bearer dev-admin-local-session')).toBe(true);
    expect(runtimeErrors).toEqual([]);
    expect(targetedApiFailures).toEqual([]);
  });
});
