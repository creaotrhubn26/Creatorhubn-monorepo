import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

const projectId = 'e2e-troll-production';

const emptyOperations = () => ({
  phase: 'concept',
  palette: [],
  scenePlans: [],
  decisions: [],
  handoffs: [
    'art', 'sets', 'props', 'costume', 'hair_makeup', 'construction', 'sfx', 'vfx',
  ].map((department) => ({
    id: `handoff-${department}`, department, title: department, status: 'not_started',
  })),
  activity: [],
});

async function installAuthenticatedArtDepartmentApi(page: Page) {
  let storedProject: Record<string, any> | null = null;
  let record = { projectId, operations: emptyOperations(), version: 0 };
  const savedVersions: number[] = [];
  const authenticatedRequests: string[] = [];
  let rejectNextSaveWithConflict = false;

  await page.route('**/api/casting/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/casting/health') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'healthy' }) });
      return;
    }
    if (pathname === '/api/casting/projects' && request.method() === 'POST') {
      storedProject = request.postDataJSON() as Record<string, any>;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }
    if (pathname === '/api/casting/projects' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(storedProject ? [storedProject] : []) });
      return;
    }
    if (pathname === `/api/casting/projects/${projectId}` && request.method() === 'GET') {
      await route.fulfill({ status: storedProject ? 200 : 404, contentType: 'application/json', body: JSON.stringify(storedProject ?? {}) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route(`**/api/role-room/projects/${projectId}/art-department`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ artDepartment: record }) });
      return;
    }
    const body = route.request().postDataJSON() as { expectedVersion: number; operations: typeof record.operations };
    if (rejectNextSaveWithConflict) {
      rejectNextSaveWithConflict = false;
      record = {
        ...record,
        version: record.version + 1,
        operations: {
          ...record.operations,
          visualDirection: 'Serverens låste visuelle retning.',
        },
      };
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'version_conflict',
          message: 'Produksjonsdesigngrunnlaget ble endret av en annen bruker.',
          artDepartment: record,
        }),
      });
      return;
    }
    expect(body.expectedVersion).toBe(record.version);
    record = {
      projectId,
      version: record.version + 1,
      operations: {
        ...body.operations,
        activity: [{
          id: `activity-${record.version + 1}`, type: 'workspace_saved',
          message: 'Oppdaterte produksjonsdesigngrunnlaget.', actorUserId: 'e2e-test-user',
          createdAt: '2026-09-20T12:00:00Z',
        }],
      },
    };
    savedVersions.push(record.version);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ artDepartment: record }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/access`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access: {
      projectId, role: 'production_designer', roles: ['production_designer'], isOwner: false, isMember: true,
      permissions: {}, grants: { canManageArtDepartment: true },
    } }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/roles`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const role = { id: 'troll-production-designer-role', projectId, userId: 'e2e-test-user', role: 'production_designer' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'GET' ? [role] : { role }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/production-days`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ productionDays: storedProject?.productionDays ?? [] }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/my-tabs`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tabAccess: null, source: 'default', role: 'production_designer', tabValues: null }) });
  });
  await page.route('**/api/role-room/casting-roles/*/selftapes', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/presence/heartbeat', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));

  return {
    authenticatedRequests,
    savedVersions,
    conflictOnNextSave() { rejectNextSaveWithConflict = true; },
    get record() { return record; },
  };
}

test.describe('Autentisert Troll-flyt · produksjonsdesigner', () => {
  test('går fra scenegrunnlag til versjonert art-handoff uten konsollfeil', async ({ page }) => {
    const runtimeErrors: string[] = [];
    const targetedApiFailures: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(message.text())) runtimeErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && /\/api\/presence\/heartbeat|\/selftapes(?:[/?#]|$)/i.test(response.url())) targetedApiFailures.push(`${response.status()} ${response.url()}`);
    });
    const api = await installAuthenticatedArtDepartmentApi(page);

    await openCastingPlanner(page, {
      urlFlags: { seed: 'production-designer-troll', session: 'production-designer', lens: 'art-department' },
    });
    await selectFirstProject(page);

    const workspace = page.getByTestId('art-department-workspace');
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Troll', exact: true })).toBeVisible();
    await expect(page.getByText('1 scener mangler art-plan')).toBeVisible();
    await expect(page.getByText('1 rekvisitter mangler scenekobling')).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('art-department');

    await page.getByRole('button', { name: 'Scener' }).click();
    await expect(page.getByRole('heading', { name: 'EXT. TROLLSKOG - DAG' })).toBeVisible();
    await expect(page.getByText(/Opptaksdager: .*Tors hammer.*Snøscooter/)).toBeVisible();
    await workspace.getByRole('combobox').nth(0).click();
    await page.getByRole('option', { name: 'Design pågår' }).click();
    await workspace.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Hybrid' }).click();
    await workspace.getByRole('checkbox', { name: 'Art direction' }).click();
    await page.getByLabel('Designintensjon').fill('Trollet skal oppleves som en del av fjellet, ikke et separat monster.');
    await page.getByTestId('art-department-save').click();
    await expect(page.getByText('Produksjonsdesigngrunnlaget er synkronisert.')).toBeVisible();

    await page.getByRole('button', { name: 'Visuell retning' }).click();
    await page.getByLabel('Palett').fill('skifer, tåke, mose');
    await page.getByLabel('Designintensjon').fill('Skifer, tåke og fuktige naturmaterialer binder menneskeverdenen til trollet.');
    await page.getByTestId('art-department-save').click();
    await expect(page.getByText('Produksjonsdesigngrunnlaget er synkronisert.')).toBeVisible();
    expect(api.savedVersions).toEqual([1, 2]);

    await page.reload();
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('Palett')).toHaveValue('skifer, tåke, mose');
    await page.getByRole('button', { name: 'Oversikt' }).click();
    await expect(page.getByText('Oppdaterte produksjonsdesigngrunnlaget.')).toBeVisible();
    expect(api.record.operations.scenePlans).toEqual([
      expect.objectContaining({ sceneId: 'troll-scene-1', status: 'designing', setStrategy: 'hybrid', departments: ['art'] }),
    ]);
    expect(api.authenticatedRequests.length).toBeGreaterThan(0);
    expect(api.authenticatedRequests.every((header) => header === 'Bearer dev-admin-local-session')).toBe(true);
    expect(runtimeErrors).toEqual([]);
    expect(targetedApiFailures).toEqual([]);
  });

  test('@mobile beholder touchmål og uten horisontal overflow i stående og liggende visning', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await installAuthenticatedArtDepartmentApi(page);
    await openCastingPlanner(page, {
      urlFlags: { seed: 'production-designer-troll', session: 'production-designer', lens: 'art-department' },
    });
    await selectFirstProject(page);

    const workspace = page.getByTestId('art-department-workspace');
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    const sceneButton = page.getByRole('button', { name: 'Scener' });
    expect((await sceneButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await sceneButton.tap();
    await expect(page.getByRole('heading', { name: 'EXT. TROLLSKOG - DAG' })).toBeVisible();
    await expect.poll(() => workspace.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

    await page.setViewportSize({ width: 852, height: 393 });
    await expect(workspace.getByRole('combobox').nth(1)).toBeVisible();
    await expect.poll(() => workspace.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });

  test('beholder lokalt utkast ved versjonskonflikt til serverversjonen velges eksplisitt', async ({ page }) => {
    const api = await installAuthenticatedArtDepartmentApi(page);
    await openCastingPlanner(page, {
      urlFlags: { seed: 'production-designer-troll', session: 'production-designer', lens: 'art-department' },
    });
    await selectFirstProject(page);

    const workspace = page.getByTestId('art-department-workspace');
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Visuell retning' }).click();
    await page.getByLabel('Designintensjon').fill('Mitt lokale, ulagrede designutkast.');
    api.conflictOnNextSave();
    await page.getByTestId('art-department-save').click();

    await expect(page.getByText('En annen bruker lagret først. Ditt lokale utkast er beholdt.')).toBeVisible();
    await expect(page.getByText(/Serveren er på versjon 1/)).toBeVisible();
    await expect(page.getByLabel('Designintensjon')).toHaveValue('Mitt lokale, ulagrede designutkast.');

    await page.getByRole('button', { name: 'Last serverversjon' }).click();
    await expect(page.getByLabel('Designintensjon')).toHaveValue('Serverens låste visuelle retning.');
    await expect(page.getByText('Serverversjonen er lastet inn.')).toBeVisible();
  });
});
