import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

const projectId = 'e2e-troll-production';

const seededOperations = () => ({
  phase: 'concept',
  palette: [],
  scenePlans: [],
  decisions: [],
  continuityItems: [
    {
      id: 'troll-continuity-hammer-demo', department: 'props', title: 'Tors hammer · hero',
      sceneId: 'troll-scene-1', productionDayId: 'troll-production-day-1', propId: 'troll-prop-hammer',
      status: 'reset_required', source: 'fabricated', condition: 'damaged', owner: 'Ada Design',
      location: 'Hero rack · kasse P-01', presetNotes: 'Hammerhode mot kamera. Håndtaket følger den rosa tapemarkeringen.',
      resetNotes: 'Rens jord, kontroller sprekk og legg håndtaket tilbake på markeringen.',
      issue: 'Sprekk og våt jord på nedre kant etter stunt-take.',
      beforeReferences: [{
        id: 'troll-hammer-before-demo', kind: 'photo', label: 'Hammer · før take',
        url: '/assets/role-room/troll-production/hammer-before-v1.webp', contentType: 'image/webp',
      }],
      afterReferences: [{
        id: 'troll-hammer-after-demo', kind: 'photo', label: 'Hammer · etter take',
        url: '/assets/role-room/troll-production/hammer-after-v1.webp', contentType: 'image/webp',
      }],
    },
    {
      id: 'troll-continuity-nora-costume-demo', department: 'costume', title: 'NORA · skogslook',
      sceneId: 'troll-scene-1', productionDayId: 'troll-production-day-1', characterRoleId: 'troll-role-nora',
      status: 'ready', source: 'owned', condition: 'good', owner: 'Kostyme', location: 'Rack C-04',
      presetNotes: 'Kontrollert fukt ved skuldre og buksekanter. Burgunder skjerf over ytterjakken.',
      resetNotes: 'Bevar samme fuktnivå og brett på høyre bukseben.', issue: '',
      beforeReferences: [{
        id: 'troll-nora-costume-before-demo', kind: 'photo', label: 'NORA · kostyme før scene',
        url: '/assets/role-room/troll-production/nora-costume-before-v1.webp', contentType: 'image/webp',
      }],
      afterReferences: [],
    },
  ],
  handoffs: [
    'art', 'sets', 'props', 'costume', 'hair_makeup', 'construction', 'sfx', 'vfx',
  ].map((department) => ({
    id: `handoff-${department}`, department, title: department, status: 'not_started',
  })),
  activity: [],
});

async function installAuthenticatedArtDepartmentApi(page: Page) {
  let storedProject: Record<string, any> | null = null;
  let record = { projectId, operations: seededOperations(), version: 0 };
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
  await page.route(`**/api/role-room/projects/${projectId}/production-days/*/continuity/media`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ reference: {
        id: '11111111-1111-4111-8111-111111111111',
        kind: 'photo',
        storageFileId: '11111111-1111-4111-8111-111111111111',
        storageProvider: 'aws_s3',
        contentType: 'image/png',
        sizeBytes: 68,
        label: 'hammer-before.png',
      } }),
    });
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
    const workspaceVisual = page.getByTestId('role-room-workspace-visual-production').first();
    await expect(workspaceVisual).toBeVisible();
    await expect.poll(() => workspaceVisual.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
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

    await page.getByRole('button', { name: 'Continuity' }).click();
    await expect(page.getByAltText('Før-referanse for Tors hammer · hero')).toBeVisible();
    await expect(page.getByAltText('Etter-referanse for Tors hammer · hero')).toBeVisible();
    await page.getByRole('button', { name: 'Åpne før-referanse Hammer · før take' }).click();
    await expect(page.getByRole('dialog', { name: 'Før · Hammer · før take' })).toBeVisible();
    await page.getByRole('button', { name: 'Lukk bildevisning' }).click();

    await page.getByLabel('Plagg, look, set eller rekvisitt').fill('Fakkel · stunt reserve');
    await page.getByRole('button', { name: 'Legg til punkt' }).click();
    const continuityItem = page.locator('[data-testid^="art-continuity-item-"]').filter({ hasText: 'Fakkel · stunt reserve' });
    await expect(continuityItem).toBeVisible();
    await expect(continuityItem.getByText('Ingen før-/etterreferanser ennå')).toBeVisible();
    await continuityItem.getByLabel('Fakkel · stunt reserve status').click();
    await page.getByRole('option', { name: 'Må resettes' }).click();
    await continuityItem.getByLabel('Preset / før opptak').fill('Hammerhode mot kamera, håndtak ved høyre fot.');
    await continuityItem.getByLabel('Reset / etter take').fill('Tilbake til markert startposisjon.');
    await continuityItem.getByLabel('Avvik / skade / mangler').fill('Kontroller sprekk etter stunt-take.');
    await continuityItem.locator('input[type="file"]').first().setInputFiles({
      name: 'hammer-before.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', 'base64'),
    });
    await expect(page.getByText(/Referansen er lastet privat/)).toBeVisible();
    await page.getByTestId('art-department-save').click();
    await expect(page.getByText('Produksjonsdesigngrunnlaget er synkronisert.')).toBeVisible();
    await page.getByRole('button', { name: 'Visuell retning' }).click();
    await page.getByLabel('Palett').fill('skifer, tåke, mose');
    await page.getByLabel('Designintensjon').fill('Skifer, tåke og fuktige naturmaterialer binder menneskeverdenen til trollet.');
    await page.getByTestId('art-department-save').click();
    await expect(page.getByText('Produksjonsdesigngrunnlaget er synkronisert.')).toBeVisible();
    expect(api.savedVersions).toEqual([1, 2, 3]);

    await page.reload();
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('Palett')).toHaveValue('skifer, tåke, mose');
    await page.getByRole('button', { name: 'Oversikt' }).click();
    await expect(page.getByText('Oppdaterte produksjonsdesigngrunnlaget.')).toBeVisible();
    expect(api.record.operations.scenePlans).toEqual([
      expect.objectContaining({ sceneId: 'troll-scene-1', status: 'designing', setStrategy: 'hybrid', departments: ['art'] }),
    ]);
    expect(api.record.operations.continuityItems).toHaveLength(3);
    expect(api.record.operations.continuityItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Fakkel · stunt reserve',
        sceneId: 'troll-scene-1',
        productionDayId: 'troll-production-day-1',
        status: 'reset_required',
        beforeReferences: [expect.objectContaining({ storageProvider: 'aws_s3' })],
      }),
    ]));
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
    const workspaceVisual = page.getByTestId('role-room-workspace-visual-production').first();
    await expect(workspaceVisual).toBeVisible();
    await expect.poll(() => workspaceVisual.locator('img').evaluate(
      (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
    )).toBe(true);
    const sceneButton = page.getByRole('button', { name: 'Scener' });
    expect((await sceneButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await sceneButton.tap();
    await expect(page.getByRole('heading', { name: 'EXT. TROLLSKOG - DAG' })).toBeVisible();
    await expect.poll(() => workspace.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

    await page.getByRole('button', { name: 'Continuity' }).tap();
    await expect(page.getByTestId('art-continuity-board')).toBeVisible();
    await expect(page.getByAltText('Før-referanse for Tors hammer · hero')).toBeVisible();
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
    await expect(page.getByText(/Lokalt utkast/)).toBeVisible();
    await page.waitForTimeout(450);
    await page.reload();
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Et ulagret lokalt utkast er gjenopprettet.')).toBeVisible();
    await expect(page.getByLabel('Designintensjon')).toHaveValue('Mitt lokale, ulagrede designutkast.');
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
