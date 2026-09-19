import { expect, test, type Page } from '@playwright/test';

import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

const projectId = 'e2e-seed-project-basic';

async function installRoleLensApi(page: Page, role: 'producer' | 'casting_director') {
  let storedProject: Record<string, unknown> | null = null;
  let talentRequests: Array<Record<string, unknown>> = [];
  const grants = role === 'producer'
    ? { canEditCasting: true, canEditProduction: true, canViewEconomy: true }
    : { canEditCasting: true, canEditProduction: false, canViewEconomy: false };
  const permissions = {
    canViewAll: true,
    canComment: true,
    ...grants,
  };

  await page.route('**/api/casting/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/casting/health') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'healthy' }) });
      return;
    }
    if (path === '/api/casting/projects' && request.method() === 'POST') {
      storedProject = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(storedProject) });
      return;
    }
    if (path === '/api/casting/projects' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(storedProject ? [storedProject] : []) });
      return;
    }
    if (path === `/api/casting/projects/${projectId}` && request.method() === 'GET') {
      await route.fulfill({ status: storedProject ? 200 : 404, contentType: 'application/json', body: JSON.stringify(storedProject) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route(`**/api/role-room/projects/${projectId}/access`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access: {
          projectId,
          role,
          roles: [role],
          isOwner: role === 'producer',
          isMember: true,
          permissions,
          grants,
        },
      }),
    });
  });
  await page.route(`**/api/role-room/projects/${projectId}/roles`, async (route) => {
    const roleRecord = {
      id: `role-${role}`,
      projectId,
      userId: 'e2e-test-user',
      role,
      permissions,
    };
    await route.fulfill({
      status: route.request().method() === 'GET' ? 200 : 201,
      contentType: 'application/json',
      body: JSON.stringify(route.request().method() === 'GET' ? [roleRecord] : { success: true }),
    });
  });
  await page.route(`**/api/role-room/projects/${projectId}/my-tabs`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tabAccess: null, source: 'default', role, tabValues: null }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/production-days`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ productionDays: [] }) });
  });
  await page.route('**/api/role-room/casting-roles/*/selftapes', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/presence/heartbeat', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/role-room/partnerships/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/api/role-room/partnerships/casting-projects/${projectId}/talent-search`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          project_id: projectId,
          query: '',
          role_id: null,
          can_manage_partnerships: false,
          sources: [{
            invitation_id: '11111111-1111-4111-8111-111111111111',
            agency_id: 'agency-1',
            agency_name: 'Nordic Talent',
            agency_logo_url: null,
            agency_verified: true,
            role_ids: null,
            expires_at: null,
            visible_talent_count: 1,
            pending_proposal_count: 0,
            open_request_count: talentRequests.length,
          }],
          talents: [{
            id: '22222222-2222-4222-8222-222222222222',
            display_name: 'Ada Skuespiller',
            city: 'Oslo',
            country: 'NO',
            headshot_url: null,
            playing_age_min: 25,
            playing_age_max: 35,
            gender: null,
            availability_status: 'open',
            agency_id: 'agency-1',
            agency_name: 'Nordic Talent',
            agency_logo_url: null,
            agency_verified: true,
            invitation_id: '11111111-1111-4111-8111-111111111111',
            granted_scopes: ['basic_profile', 'demographics', 'availability'],
            already_proposed: false,
            already_candidate: false,
            active_request_id: talentRequests[0]?.id ?? null,
            active_request_status: talentRequests[0]?.status ?? null,
          }],
        }),
      });
      return;
    }
    if (path === `/api/role-room/partnerships/casting-projects/${projectId}/talent-requests`) {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        talentRequests = [{
          id: '33333333-3333-4333-8333-333333333333',
          ...body,
          requested_by_user_id: 'e2e-test-user',
          status: 'pending',
          response_note: null,
          acknowledged_at: null,
          responded_at: null,
          responded_by_user_id: null,
          fulfilled_proposal_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          talent_display_name: 'Ada Skuespiller',
          role_name: 'NORA',
          agency_name: 'Nordic Talent',
        }];
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ request: talentRequests[0] }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requests: talentRequests }) });
      }
      return;
    }
    if (path === `/api/role-room/partnerships/casting-projects/${projectId}/incoming-talent-proposals`) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ proposals: [] }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

async function expectHeaderTouchTargets(page: Page) {
  const header = page.getByTestId('role-room-header');
  await expect(header).toBeVisible();
  const buttons = header.locator('button:visible');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const box = await button.boundingBox();
    const label = await button.getAttribute('aria-label') ?? await button.textContent() ?? `header-knapp ${index + 1}`;
    expect(box?.height ?? 0, `${label.trim()} skal ha minst 48 px trykkflate`).toBeGreaterThanOrEqual(48);
    expect(box?.width ?? 0, `${label.trim()} skal ha minst 48 px trykkflate`).toBeGreaterThanOrEqual(48);
  }
}

test.describe('rollelinser for produsent og casting', () => {
  test('produsent får prosjektpuls i bred visning og beholder linsen ved faneovergang', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const runtimeErrors = collectRuntimeErrors(page);
    await installRoleLensApi(page, 'producer');

    await openCastingPlanner(page, {
      urlFlags: { seed: 'basic', session: 'producer', lens: 'producer' },
    });
    await selectFirstProject(page);

    await expect(page.getByTestId('producer-workspace')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Siste servering', exact: true })).toBeVisible();
    await expect(page.getByTestId('producer-target-economy')).toBeVisible();

    await page.getByTestId('producer-target-schedule').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('produksjonsplan');
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('producer');
    expect(runtimeErrors).toEqual([]);
  });

  test('castingrommet fungerer i stående visning med trygge touchmål', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    const runtimeErrors = collectRuntimeErrors(page);
    await installRoleLensApi(page, 'casting_director');

    await openCastingPlanner(page, {
      urlFlags: { seed: 'director', session: 'casting-director', lens: 'casting' },
    });
    await selectFirstProject(page);

    const workspace = page.getByTestId('casting-workspace');
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await expectHeaderTouchTargets(page);
    const candidatesTarget = page.getByTestId('casting-target-candidates');
    const touchTarget = await candidatesTarget.boundingBox();
    expect(touchTarget?.height ?? 0).toBeGreaterThanOrEqual(48);

    await page.setViewportSize({ width: 852, height: 393 });
    await expectHeaderTouchTargets(page);
    const landscapeTouchTarget = await candidatesTarget.boundingBox();
    expect(landscapeTouchTarget?.height ?? 0).toBeGreaterThanOrEqual(48);

    await page.getByTestId('casting-target-talents').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('kandidater');
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('casting');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('talents');
    await expect(page.getByTestId('talent-sourcing-panel')).toBeVisible();
    await expect(page.getByText('Ada Skuespiller')).toBeVisible();
    await page.getByRole('button', { name: 'Be byrået foreslå' }).click();
    await page.getByLabel('Castingbrief').fill('Vurder profilen for den fysiske fjellsekvensen.');
    await page.getByRole('button', { name: 'Send forespørsel' }).click();
    await expect(page.getByTestId('talent-request-33333333-3333-4333-8333-333333333333')).toBeVisible();
    await expect(page.getByText('Forespørselen om Ada Skuespiller er sendt til Nordic Talent.')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });
});
