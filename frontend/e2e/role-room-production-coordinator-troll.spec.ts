import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

const projectId = 'e2e-troll-production';

const initialDay = {
  id: 'troll-production-day-1', projectId, date: '2026-09-14', scenes: ['troll-scene-1'],
  locationId: 'troll-location-forest', crew: ['troll-production-coordinator', 'troll-gaffer'], props: [],
  callTime: '07:00', wrapTime: '18:00', status: 'planned', coordinationVersion: 0,
  productionCoordination: {
    tasks: [{ id: 'transport', title: 'Bekreft minibuss med leverandør', category: 'transport', status: 'in_progress', priority: 'high' }],
    crewFollowUps: [
      { crewId: 'troll-production-coordinator', status: 'confirmed' },
      { crewId: 'troll-gaffer', status: 'contacted' },
    ],
    logistics: [{ id: 'parking', category: 'transport', title: 'Transport og parkering', status: 'blocked' }],
    documents: [{ id: 'permit', title: 'Parkeringstillatelse', category: 'permit', status: 'requested' }],
    callSheetChecklist: [{ id: 'times', title: 'Scener, rekkefølge og tider er kontrollert', status: 'in_progress' }],
    escalations: [{ id: 'parking-alert', title: 'Parkering er ikke bekreftet', severity: 'critical', status: 'open' }],
    handover: { status: 'draft', summary: 'Transport og parkering følges opp.' },
    activity: [],
  },
};

async function installAuthenticatedProductionCoordinatorApi(page: Page) {
  let storedProject: Record<string, unknown> | null = null;
  let productionDay: any = structuredClone(initialDay);
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
  await page.route(`**/api/role-room/projects/${projectId}/production-days/${initialDay.id}/production-coordination`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const body = route.request().postDataJSON() as { expectedVersion: number; operations: Record<string, any> };
    expect(body.expectedVersion).toBe(productionDay.coordinationVersion);
    expect((body.operations as Record<string, unknown>).costItems).toBeUndefined();
    expect((body.operations as Record<string, unknown>).callSheetApproval).toBeUndefined();
    productionDay = {
      ...productionDay,
      coordinationVersion: productionDay.coordinationVersion + 1,
      productionCoordination: {
        ...body.operations,
        activity: [{
          id: `activity-${productionDay.coordinationVersion + 1}`,
          type: 'workspace_saved', message: 'Oppdaterte overlevering.', actorUserId: 'e2e-test-user',
          createdAt: '2026-09-12T09:00:00.000Z',
        }],
      },
    };
    savedVersions.push(productionDay.coordinationVersion);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ productionDay }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/roles`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const role = { id: 'troll-production-coordinator-role', projectId, userId: 'e2e-test-user', role: 'production_coordinator' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'GET' ? [role] : { role }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/my-tabs`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tabAccess: null, source: 'default', role: 'production_coordinator', tabValues: null }) });
  });
  await page.route('**/api/role-room/casting-roles/*/selftapes', async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/presence/heartbeat', async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  return { authenticatedRequests, savedVersions };
}

test.describe('Autentisert Troll-flyt · produksjonskoordinator', () => {
  test('følger opp dagsflyten og lagrer uten PM-beslutninger eller konsollfeil', async ({ page }) => {
    const runtimeErrors: string[] = [];
    const targetedApiFailures: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(message.text())) runtimeErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && /\/api\/presence\/heartbeat|\/selftapes(?:[/?#]|$)/i.test(response.url())) targetedApiFailures.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => {
      if (/\/api\/presence\/heartbeat|\/selftapes(?:[/?#]|$)/i.test(request.url())) targetedApiFailures.push(`requestfailed ${request.url()}`);
    });
    const api = await installAuthenticatedProductionCoordinatorApi(page);

    await openCastingPlanner(page, {
      urlFlags: { seed: 'production-coordinator-troll', session: 'production-coordinator', lens: 'production-coordination' },
    });
    await selectFirstProject(page);

    await expect(page.getByTestId('production-coordination-workspace')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Troll' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Oppgaver og frister' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Crew-oppfølging' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Logistikk og leverandører' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Callsheet-sjekk' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dokumentberedskap' })).toBeVisible();
    await expect(page.getByText('Parkeringstillatelse')).toBeVisible();
    await expect(page.getByText('Parkering er ikke bekreftet')).toBeVisible();
    await expect(page.getByText('Kostnadsavvik')).toHaveCount(0);
    await expect(page.getByText('Intern godkjenning')).toHaveCount(0);

    await page.getByLabel('Kort status').fill('Parkering avklart; minibuss bekreftet kl. 09:00.');
    await page.getByRole('button', { name: 'Lagre koordinering' }).click();
    await expect(page.getByText('Koordinatorflaten er lagret som versjon 1.')).toBeVisible();
    await expect(page.getByTestId('production-coordination-activity')).toContainText('Oppdaterte overlevering.');

    expect(api.savedVersions).toEqual([1]);
    expect(api.authenticatedRequests.length).toBeGreaterThan(0);
    expect(api.authenticatedRequests.every((header) => header === 'Bearer dev-admin-local-session')).toBe(true);
    expect(runtimeErrors).toEqual([]);
    expect(targetedApiFailures).toEqual([]);
  });
});
