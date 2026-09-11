import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

const projectId = 'e2e-troll-production';
const deliveryId = '11111111-1111-4111-8111-111111111111';
const missingRecipientId = '33333333-3333-4333-8333-333333333333';

const initialDay = {
  id: 'troll-production-day-1',
  projectId,
  date: '2026-09-14',
  scenes: ['troll-scene-1'],
  locationId: 'troll-location-forest',
  crew: ['troll-second-ad'],
  props: [],
  callTime: '07:00',
  wrapTime: '18:00',
  status: 'planned',
  secondAd: {
    entries: [{
      id: 'cast:troll-candidate-nora',
      personType: 'cast',
      personId: 'troll-candidate-nora',
      name: 'Ada Skuespiller',
      roleName: 'NORA',
      pickupTime: '05:45',
      callTime: '06:15',
      makeupTime: '06:30',
      wardrobeTime: '06:45',
      onSetTime: '07:30',
      transport: 'Bil 2 · Ola',
      status: 'acknowledged',
    }],
  },
};

async function installAuthenticatedTrollApi(page: Page) {
  let storedProject: Record<string, unknown> | null = null;
  let productionDay = structuredClone(initialDay);
  let reminderCount = 0;
  let callSheetSendCount = 0;
  const authenticatedRequests: string[] = [];

  await page.route('**/api/casting/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/casting/health') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'healthy' }) });
      return;
    }
    if (url.pathname === '/api/casting/projects' && request.method() === 'POST') {
      storedProject = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }
    if (url.pathname === '/api/casting/projects' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(storedProject ? [storedProject] : []) });
      return;
    }
    if (url.pathname === `/api/casting/projects/${projectId}` && request.method() === 'GET') {
      await route.fulfill({ status: storedProject ? 200 : 404, contentType: 'application/json', body: JSON.stringify(storedProject ?? {}) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route(`**/api/role-room/projects/${projectId}/production-days`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ productionDays: [productionDay] }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/roles`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const role = {
      id: 'troll-second-ad-user-role',
      projectId,
      userId: 'e2e-test-user',
      role: 'second_ad',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(route.request().method() === 'GET' ? [role] : { role }),
    });
  });
  await page.route('**/api/role-room/production-days', async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    productionDay = route.request().postDataJSON() as typeof initialDay;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ productionDay }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/my-tabs`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tabAccess: null, source: 'default', role: 'second_ad', tabValues: null }),
    });
  });
  await page.route('**/api/role-room/casting-roles/*/selftapes', async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/call-sheet-deliveries**`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ deliveries: [{
        id: deliveryId,
        productionDayId: initialDay.id,
        revision: 2,
        status: 'published',
        subject: 'Troll · dag 1',
        createdAt: '2026-09-11T08:00:00.000Z',
        total: 3,
        sent: 2,
        failed: 1,
        acknowledged: 1,
        events: [],
        recipients: [
          { id: '22222222-2222-4222-8222-222222222222', name: 'Ada', email: 'ada@example.test', deliveryStatus: 'sent', acknowledgedAt: '2026-09-11T08:05:00.000Z', reminderCount: 0 },
          { id: missingRecipientId, name: 'Bo', email: 'bo@example.test', deliveryStatus: 'sent', acknowledgedAt: null, reminderCount },
          { id: '44444444-4444-4444-8444-444444444444', name: 'Cam', email: 'cam@example.test', deliveryStatus: 'failed', acknowledgedAt: null, reminderCount: 0 },
        ],
      }] }),
    });
  });
  await page.route(`**/api/role-room/call-sheet-deliveries/${deliveryId}/remind`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const body = route.request().postDataJSON() as { recipientIds?: string[] };
    expect(body.recipientIds).toEqual([missingRecipientId]);
    reminderCount += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deliveryId, reminded: 1, total: 1 }) });
  });
  await page.route('**/api/role-room/call-sheets/send', async (route) => {
    callSheetSendCount += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'CI skal aldri sende' }) });
  });

  return {
    authenticatedRequests,
    getCallSheetSendCount: () => callSheetSendCount,
  };
}

test.describe('Autentisert Troll-flyt · 2nd AD', () => {
  test('bruker én produksjonsdag for dagsstatus, callsheet, mottak og trygg preview', async ({ page }) => {
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
    const api = await installAuthenticatedTrollApi(page);

    await openCastingPlanner(page, { urlFlags: { seed: 'second-ad-troll', session: 'second-ad', lens: 'assistant-direction', surface: 'today' } });
    await selectFirstProject(page);

    await expect(page.getByTestId('second-ad-workspace')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Troll' })).toBeVisible();
    await expect(page.getByText('Sendt 2/3')).toBeVisible();
    await expect(page.getByText('Feilet 1/3')).toBeVisible();
    await expect(page.getByText('Bekreftet 1/3')).toBeVisible();

    await page.getByRole('button', { name: 'Purr manglende (1)' }).click();
    await expect(page.getByText('Påminnelse sendt til 1 mottaker.')).toBeVisible();
    await expect(page.getByText(/purret 1/)).toBeVisible();

    await page.getByLabel('Call').fill('05:55');
    await page.getByLabel('Transport / sjåfør').fill('Bil 4 · Liv');
    await page.getByRole('button', { name: 'Lagre dagsstatus' }).click();
    await expect(page.getByText('Dagsstatusen er lagret.')).toBeVisible();

    await page.getByRole('button', { name: 'Callsheet og utsending' }).click();
    await expect(page.getByTestId('canonical-call-sheet-dialog')).toBeVisible();
    await expect(page.getByTestId('pmv-shooting-day-planner-dialog')).toHaveCount(0);
    await expect(page.getByText('05:55').first()).toBeVisible();
    await expect(page.getByText('Bil 4 · Liv').first()).toBeVisible();
    await expect(page.getByTestId('call-sheet-revision-status')).toContainText('Upubliserte endringer');

    const previewButton = page.getByRole('button', { name: 'Kontroller revisjon 3' });
    await expect(previewButton).toBeEnabled({ timeout: 15_000 });
    await previewButton.click();
    await expect(page.getByTestId('call-sheet-recipient-preview')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Publiser revisjon 3' })).toBeVisible();
    await expect(page.getByText(/Endringer:/)).toBeVisible();
    await expect(page.getByText('ada@example.test · Cast')).toBeVisible();
    expect(api.getCallSheetSendCount()).toBe(0);
    expect(api.authenticatedRequests.length).toBeGreaterThan(0);
    expect(api.authenticatedRequests.every((header) => header === 'Bearer dev-admin-local-session')).toBe(true);
    expect(runtimeErrors).toEqual([]);
    expect(targetedApiFailures).toEqual([]);
  });
});
