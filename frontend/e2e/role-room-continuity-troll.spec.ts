import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

const projectId = 'e2e-troll-production';
const uploadedMediaId = '8b49da36-ff43-4d8f-98dc-20ce0e39218d';

const initialDay = {
  id: 'troll-production-day-1', projectId, date: '2026-09-14', scenes: ['troll-scene-1'],
  locationId: 'troll-location-forest', crew: ['troll-script-supervisor'], props: [],
  callTime: '07:00', wrapTime: '18:00', status: 'in_progress', continuityVersion: 0,
  productionContinuity: {
    sceneRecords: [{ sceneId: 'troll-scene-1', status: 'in_progress', pagesPlanned: 1.25, pagesShot: .5, setup: 'Nora ved sørstien' }],
    takes: [{ id: 'troll-take-1', sceneId: 'troll-scene-1', takeNumber: 1, slate: '1A', timecodeStart: '01:02:03:04', status: 'good', circled: true, continuityNotes: 'Nora holder lykten i venstre hånd.' }],
    entries: [{ id: 'troll-entry-1', sceneId: 'troll-scene-1', category: 'props', subject: 'Lykten', description: 'Venstre hånd, tent før første replikk.', severity: 'warning', references: [] }],
    deviations: [], comments: [], revisions: [], activity: [], dailyNotes: 'Følg fuktighet i kostyme.',
  },
};

async function installAuthenticatedContinuityApi(page: Page) {
  let storedProject: Record<string, unknown> | null = null;
  let productionDay: any = structuredClone(initialDay);
  const authenticatedRequests: string[] = [];
  const savedVersions: number[] = [];
  let projectListGetCount = 0;

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
      projectListGetCount += 1;
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
  await page.route(`**/api/role-room/projects/${projectId}/production-days/${initialDay.id}/continuity`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const body = route.request().postDataJSON() as { expectedVersion: number; operations: Record<string, any> };
    expect(body.expectedVersion).toBe(productionDay.continuityVersion);
    expect(body.operations.productionManagement).toBeUndefined();
    expect(body.operations.productionCoordination).toBeUndefined();
    expect(body.operations.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        references: [expect.objectContaining({ storageFileId: uploadedMediaId, kind: 'photo' })],
      }),
    ]));
    productionDay = {
      ...productionDay,
      continuityVersion: productionDay.continuityVersion + 1,
      continuityUpdatedAt: '2026-09-12T10:00:00.000Z',
      productionContinuity: {
        ...body.operations,
        revisions: [{ id: 'revision-0', version: 0, message: 'Første versjon', createdAt: '2026-09-12T09:00:00.000Z', snapshot: initialDay.productionContinuity }],
        activity: [{ id: 'activity-1', type: 'workspace_saved', message: 'Oppdaterte takes og kontinuitet.', actorUserId: 'e2e-test-user', createdAt: '2026-09-12T10:00:00.000Z' }],
      },
    };
    savedVersions.push(productionDay.continuityVersion);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ productionDay }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/production-days/${initialDay.id}/continuity/media`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        reference: {
          id: uploadedMediaId,
          storageFileId: uploadedMediaId,
          storageProvider: 'aws_s3',
          kind: 'photo',
          contentType: 'image/jpeg',
          sizeBytes: 32,
          label: 'skjerf.jpg',
        },
      }),
    });
  });
  await page.route(`**/api/role-room/projects/${projectId}/production-days/${initialDay.id}/continuity/media/${uploadedMediaId}/url`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
        contentType: 'image/jpeg',
        displayName: 'skjerf.jpg',
      }),
    });
  });
  await page.route(`**/api/role-room/projects/${projectId}/roles`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const role = { id: 'troll-script-supervisor-role', projectId, userId: 'e2e-test-user', role: 'script_supervisor' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'GET' ? [role] : { role }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/my-tabs`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tabAccess: null, source: 'default', role: 'script_supervisor', tabValues: null }) });
  });
  await page.route('**/api/role-room/casting-roles/*/selftapes', async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/presence/heartbeat', async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  return {
    authenticatedRequests,
    savedVersions,
    get projectListGetCount() { return projectListGetCount; },
  };
}

test.describe('Autentisert Troll-flyt · script supervisor', () => {
  test('logger, lagrer, reloader og eksporterer kontinuitet uten konsollfeil', async ({ page }) => {
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
    const api = await installAuthenticatedContinuityApi(page);

    await openCastingPlanner(page, {
      urlFlags: { seed: 'script-supervisor-troll', session: 'script-supervisor', lens: 'continuity' },
    });
    await selectFirstProject(page);

    await expect(page.getByTestId('continuity-workspace')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Troll' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scene og take-logg' })).toBeVisible();
    await expect(page.getByText('Lykten', { exact: true })).toBeVisible();
    await expect(page.getByTestId('continuity-take-log').getByText('Nora holder lykten i venstre hånd.')).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('continuity');

    await page.getByRole('textbox', { name: 'Kontinuitetsnotat' }).fill('Skjerfet ligger over høyre skulder.');
    await page.getByRole('button', { name: 'Registrer take 2' }).click();
    await page.getByTestId('continuity-media-input').setInputFiles({
      name: 'skjerf.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(28).fill(0)]),
    });
    await expect(page.getByText('skjerf.jpg er lastet opp privat.')).toBeVisible();
    await page.getByLabel('Hva må matche?').fill('Skjerfet over høyre skulder før Nora snur seg.');
    await page.getByRole('button', { name: 'Legg til kontinuitet' }).click();
    await expect(page.getByRole('img', { name: 'skjerf.jpg' })).toBeVisible();
    await expect(page.getByTestId('continuity-save-status')).toContainText(/utkast/i);
    await page.getByTestId('save-continuity').click();
    await expect(page.getByText('Kontinuitetsloggen er lagret som versjon 1.')).toBeVisible();
    await page.waitForTimeout(250);
    await expect(page.getByText('Kontinuitetsloggen er lagret som versjon 1.')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Dagsrapport' }).click();
    expect((await downloadPromise).suggestedFilename()).toContain('continuity.csv');

    await page.reload();
    await expect(page.getByTestId('continuity-workspace')).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('continuity');
    await expect(page.getByText('Skjerfet over høyre skulder før Nora snur seg.')).toBeVisible();
    await expect(page.getByText('Oppdaterte takes og kontinuitet.')).toBeVisible();

    expect(api.savedVersions).toEqual([1]);
    expect(api.authenticatedRequests.length).toBeGreaterThan(0);
    expect(api.authenticatedRequests.every((header) => header === 'Bearer dev-admin-local-session')).toBe(true);
    expect(api.projectListGetCount).toBeGreaterThanOrEqual(1);
    expect(runtimeErrors).toEqual([]);
    expect(targetedApiFailures).toEqual([]);
  });
});
