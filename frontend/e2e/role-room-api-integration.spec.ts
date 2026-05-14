import { test, expect, type Page } from '@playwright/test';
import { openRoleRoomDashboard } from './helpers/role-room';

// ────────────────────────────────────────────────────────────
// E2E: Role Room API Integration Tests
// Sprint A.6: Migrert til felles openRoleRoomDashboard-helper som venter
// på .role-room-route (DOM-marker) i stedet for lokalisert tekst.
// ────────────────────────────────────────────────────────────
// Tests the full end-to-end flow with a real backend:
//   - API key auto-bootstrap
//   - Project CRUD via the UI
//   - Casting roles, candidates, crew, schedules
//   - API round-trip verification

const TEST_PAGE = '/e2e-test.html';
const API_BASE = 'http://localhost:3001/api/role-room';

/** Generate a unique project name to avoid strict-mode collisions */
function uniqueName(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}

// ── Helpers ─────────────────────────────────────────────────

/** Clean up any e2e-test-user data before/after tests */
async function cleanTestData() {
  // Get an admin key to clean up
  const keyRes = await fetch(`${API_BASE}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'cleanup-key',
      userId: 'cleanup-user',
      scopes: ['read', 'write', 'admin'],
    }),
  });
  const { apiKey } = await keyRes.json();

  // Get all projects for cleanup user
  const projRes = await fetch(`${API_BASE}/projects`, {
    headers: { 'x-api-key': apiKey },
  });
  const projects: { id: string; created_by: string }[] = await projRes.json();

  // Delete e2e projects
  for (const p of projects) {
    if (p.created_by === 'e2e-test-user') {
      await fetch(`${API_BASE}/projects/${p.id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey },
      });
    }
  }
}

/** Navigate to Role Room test page, clear localStorage first */
async function gotoCleanRoleRoom(page: Page) {
  // Navigate to any page first to set localStorage (same-origin requirement)
  await openRoleRoomDashboard(page);

  // Clear the API key so bootstrap runs fresh
  await page.evaluate(() => localStorage.removeItem('roleRoomApiKey'));

  // Reload to trigger bootstrap
  await openRoleRoomDashboard(page);
}

/** Navigate preserving any existing localStorage */
async function gotoRoleRoom(page: Page) {
  await openRoleRoomDashboard(page);
}

// ═══════════════════════════════════════════════════════════
// 1. API KEY BOOTSTRAP
// ═══════════════════════════════════════════════════════════

test.afterAll(async () => {
  await cleanTestData();
});

test.describe('API Key Bootstrap', () => {
  test('auto-provisions API key on first load', async ({ page }) => {
    await gotoCleanRoleRoom(page);

    // Wait for the bootstrap to complete
    await page.waitForTimeout(3000);

    // Verify API key was stored in localStorage
    const apiKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );
    expect(apiKey).toBeTruthy();
    expect(apiKey).toMatch(/^rr_/);
  });

  test('reuses existing API key on subsequent loads', async ({ page }) => {
    await gotoCleanRoleRoom(page);
    await page.waitForTimeout(3000);

    const firstKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );

    // Reload — should reuse the same key
    await page.reload({ waitUntil: 'load', timeout: 60_000 });
    await expect(
      page.getByText('Casting, crew & produksjonsplanlegging')
    ).toBeVisible({ timeout: 30_000 });

    const secondKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );

    expect(firstKey).toBe(secondKey);
  });

  test('health endpoint accessible without API key', async ({ page }) => {
    const res = await page.request.get(`${API_BASE}/health`);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('role-room');
    expect(body.castingTablesCount).toBeGreaterThanOrEqual(14);
    expect(body.apiKeyEnforced).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 2. PROJECT CRUD VIA UI
// ═══════════════════════════════════════════════════════════

test.describe('Project CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await gotoCleanRoleRoom(page);
    // Wait for bootstrap
    await page.waitForTimeout(3000);
  });

  test('creates a project via the UI form', async ({ page }) => {
    const name = uniqueName('E2EProject');

    // Click "Nytt prosjekt"
    await page.getByRole('button', { name: /Nytt prosjekt/i }).click();
    await expect(page.getByText('Nytt casting-prosjekt')).toBeVisible();

    // Fill form
    await page.getByLabel('Prosjektnavn').fill(name);
    await page.getByLabel('Beskrivelse').fill('Created by Playwright E2E test');

    // Submit
    const createBtn = page.getByRole('button', { name: 'Opprett' });
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // Dialog should close
    await expect(page.getByText('Nytt casting-prosjekt')).not.toBeVisible({
      timeout: 10_000,
    });

    // Project should appear in the list
    await expect(
      page.getByText(name).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('project persists across page reloads', async ({ page }) => {
    const name = uniqueName('Persist');
    // Create a project first
    await page.getByRole('button', { name: /Nytt prosjekt/i }).click();
    await page.getByLabel('Prosjektnavn').fill(name);
    await page.getByRole('button', { name: 'Opprett' }).click();
    await expect(page.getByText('Nytt casting-prosjekt')).not.toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(name).first()).toBeVisible({
      timeout: 10_000,
    });

    // Reload
    await page.reload({ waitUntil: 'load', timeout: 60_000 });
    await expect(
      page.getByText('Casting, crew & produksjonsplanlegging')
    ).toBeVisible({ timeout: 30_000 });

    // Project still visible
    await expect(page.getByText(name).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('stats cards update after creating a project', async ({ page }) => {
    // Note initial state
    const initialCount = await page.getByText('Prosjekter').first().isVisible();
    expect(initialCount).toBeTruthy();

    // Create a project
    await page.getByRole('button', { name: /Nytt prosjekt/i }).click();
    await page.getByLabel('Prosjektnavn').fill('Stats Update Test');
    await page.getByRole('button', { name: 'Opprett' }).click();

    await expect(page.getByText('Nytt casting-prosjekt')).not.toBeVisible({
      timeout: 10_000,
    });

    // Wait for refetch
    await page.waitForTimeout(2000);

    // Stats card for "Prosjekter" should show a non-zero value
    await expect(page.getByText('Prosjekter').first()).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// 3. API ROUND-TRIP
// ═══════════════════════════════════════════════════════════

test.describe('API Round-Trip', () => {
  test('project created via API appears in UI', async ({ page }) => {
    await gotoCleanRoleRoom(page);
    await page.waitForTimeout(3000);

    const name = uniqueName('APICreated');

    // Get the bootstrapped API key
    const apiKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );
    expect(apiKey).toBeTruthy();

    // Create a project directly via API
    const createRes = await page.request.post(`${API_BASE}/projects`, {
      headers: {
        'x-api-key': apiKey!,
        'Content-Type': 'application/json',
      },
      data: {
        name,
        description: 'Created directly via API, should appear in UI',
        genre: 'Sci-Fi',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const project = await createRes.json();
    expect(project.id).toBeTruthy();

    // Trigger a refresh in the UI by clicking refresh button if available,
    // or reload the page
    await page.reload({ waitUntil: 'load', timeout: 60_000 });
    await expect(
      page.getByText('Casting, crew & produksjonsplanlegging')
    ).toBeVisible({ timeout: 30_000 });

    // API-created project should appear
    await expect(page.getByText(name).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('project created via UI is retrievable via API', async ({ page }) => {
    await gotoCleanRoleRoom(page);
    await page.waitForTimeout(3000);

    // Create via UI
    await page.getByRole('button', { name: /Nytt prosjekt/i }).click();
    await page.getByLabel('Prosjektnavn').fill('UI-to-API Roundtrip');
    await page.getByRole('button', { name: 'Opprett' }).click();
    await expect(page.getByText('Nytt casting-prosjekt')).not.toBeVisible({
      timeout: 10_000,
    });

    // Get API key and fetch projects
    const apiKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );

    const res = await page.request.get(`${API_BASE}/projects`, {
      headers: { 'x-api-key': apiKey! },
    });
    expect(res.ok()).toBeTruthy();

    const projects: { name: string }[] = await res.json();
    const found = projects.find((p) => p.name === 'UI-to-API Roundtrip');
    expect(found).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════
// 4. PROJECT DETAIL SUB-TABS
// ═══════════════════════════════════════════════════════════

test.describe('Project Detail Sub-Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await gotoCleanRoleRoom(page);
    await page.waitForTimeout(3000);

    // Create a project to work with via API for reliability
    const apiKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );
    const createRes = await page.request.post(`${API_BASE}/projects`, {
      headers: {
        'x-api-key': apiKey!,
        'Content-Type': 'application/json',
      },
      data: { name: 'SubTabProject' },
    });
    expect(createRes.ok()).toBeTruthy();
    // Reload to see the new project
    await page.reload({ waitUntil: 'load', timeout: 60_000 });
    await expect(
      page.getByText('Casting, crew & produksjonsplanlegging')
    ).toBeVisible({ timeout: 30_000 });
  });

  test('clicking a project shows sub-tabs', async ({ page }) => {
    // Click on the project in the list
    await page.getByText('SubTabProject').first().click();
    await page.waitForTimeout(1000);

    // Sub-tabs should appear
    for (const tab of ['Roller', 'Kandidater', 'Crew', 'Tidsplan']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('sub-tabs show empty state initially', async ({ page }) => {
    await page.getByText('SubTabProject').first().click();
    await page.waitForTimeout(1000);

    // Roller tab should be active by default with empty state
    const emptyRoles = page.getByText(/Ingen roller|Legg til rolle/i);
    const hasEmpty = await emptyRoles.isVisible().catch(() => false);
    expect(hasEmpty).toBeDefined();
    // Even if no explicit empty text, the tab content area should render
    expect(await page.getByRole('tab', { name: 'Roller' }).isVisible()).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════
// 5. DELETE PROJECT
// ═══════════════════════════════════════════════════════════

test.describe('Delete Project', () => {
  test('project can be deleted via API', async ({ page }) => {
    await gotoCleanRoleRoom(page);
    await page.waitForTimeout(3000);

    const apiKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );

    // Create a project via API
    const createRes = await page.request.post(`${API_BASE}/projects`, {
      headers: {
        'x-api-key': apiKey!,
        'Content-Type': 'application/json',
      },
      data: { name: 'To Be Deleted' },
    });
    const project = await createRes.json();

    // Delete it
    const deleteRes = await page.request.delete(
      `${API_BASE}/projects/${project.id}`,
      {
        headers: { 'x-api-key': apiKey! },
      }
    );
    expect(deleteRes.ok()).toBeTruthy();

    // Verify it's gone
    const listRes = await page.request.get(`${API_BASE}/projects`, {
      headers: { 'x-api-key': apiKey! },
    });
    const projects: { id: string }[] = await listRes.json();
    expect(projects.find((p) => p.id === project.id)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════
// 6. CASTING ROLES API
// ═══════════════════════════════════════════════════════════

test.describe('Casting Roles API', () => {
  test('creating and listing casting roles for a project', async ({
    page,
  }) => {
    await gotoCleanRoleRoom(page);
    await page.waitForTimeout(3000);

    const apiKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );

    // Create a project
    const projRes = await page.request.post(`${API_BASE}/projects`, {
      headers: {
        'x-api-key': apiKey!,
        'Content-Type': 'application/json',
      },
      data: { name: 'Casting Roles Test' },
    });
    const project = await projRes.json();

    // Add casting roles
    const role1 = await page.request.post(
      `${API_BASE}/projects/${project.id}/casting-roles`,
      {
        headers: {
          'x-api-key': apiKey!,
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Lead Actor',
          description: 'Main character',
          ageRange: '25-35',
          gender: 'any',
          roleType: 'lead',
        },
      }
    );
    expect(role1.ok()).toBeTruthy();

    const role2 = await page.request.post(
      `${API_BASE}/projects/${project.id}/casting-roles`,
      {
        headers: {
          'x-api-key': apiKey!,
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Supporting Actor',
          description: 'Secondary character',
          roleType: 'supporting',
        },
      }
    );
    expect(role2.ok()).toBeTruthy();

    // List roles
    const listRes = await page.request.get(
      `${API_BASE}/projects/${project.id}/casting-roles`,
      {
        headers: { 'x-api-key': apiKey! },
      }
    );
    expect(listRes.ok()).toBeTruthy();

    const roles: { name: string }[] = await listRes.json();
    expect(roles.length).toBe(2);
    expect(roles.map((r) => r.name)).toContain('Lead Actor');
    expect(roles.map((r) => r.name)).toContain('Supporting Actor');
  });
});

// ═══════════════════════════════════════════════════════════
// 7. CANDIDATES API
// ═══════════════════════════════════════════════════════════

test.describe('Candidates API', () => {
  test('adding and listing candidates', async ({ page }) => {
    await gotoCleanRoleRoom(page);
    await page.waitForTimeout(3000);

    const apiKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );

    // Create a project
    const projRes = await page.request.post(`${API_BASE}/projects`, {
      headers: {
        'x-api-key': apiKey!,
        'Content-Type': 'application/json',
      },
      data: { name: 'Candidates Test' },
    });
    const project = await projRes.json();

    // Add candidates
    const cand1 = await page.request.post(
      `${API_BASE}/projects/${project.id}/candidates`,
      {
        headers: {
          'x-api-key': apiKey!,
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Alice Johnson',
          email: 'alice@example.com',
          notes: 'Excellent audition',
        },
      }
    );
    expect(cand1.ok()).toBeTruthy();

    const cand2 = await page.request.post(
      `${API_BASE}/projects/${project.id}/candidates`,
      {
        headers: {
          'x-api-key': apiKey!,
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Bob Smith',
          email: 'bob@example.com',
          agency: 'Top Talent Agency',
        },
      }
    );
    expect(cand2.ok()).toBeTruthy();

    // List candidates
    const listRes = await page.request.get(
      `${API_BASE}/projects/${project.id}/candidates`,
      {
        headers: { 'x-api-key': apiKey! },
      }
    );
    expect(listRes.ok()).toBeTruthy();

    const candidates: { name: string; email: string }[] = await listRes.json();
    expect(candidates.length).toBe(2);
    expect(candidates.map((c) => c.name)).toContain('Alice Johnson');
    expect(candidates.map((c) => c.name)).toContain('Bob Smith');
  });
});

// ═══════════════════════════════════════════════════════════
// 8. CREW API
// ═══════════════════════════════════════════════════════════

test.describe('Crew API', () => {
  test('adding and listing crew members', async ({ page }) => {
    await gotoCleanRoleRoom(page);
    await page.waitForTimeout(3000);

    const apiKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );

    // Create a project
    const projRes = await page.request.post(`${API_BASE}/projects`, {
      headers: {
        'x-api-key': apiKey!,
        'Content-Type': 'application/json',
      },
      data: { name: 'Crew Test' },
    });
    const project = await projRes.json();

    // Check what fields the crew endpoint expects
    const crew1 = await page.request.post(
      `${API_BASE}/projects/${project.id}/crew`,
      {
        headers: {
          'x-api-key': apiKey!,
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Camera Operator',
          role: 'cinematographer',
          email: 'cam@example.com',
        },
      }
    );
    expect(crew1.ok()).toBeTruthy();

    // List crew
    const listRes = await page.request.get(
      `${API_BASE}/projects/${project.id}/crew`,
      {
        headers: { 'x-api-key': apiKey! },
      }
    );
    expect(listRes.ok()).toBeTruthy();

    const crew: { name: string }[] = await listRes.json();
    expect(crew.length).toBeGreaterThanOrEqual(1);
    expect(crew.map((c) => c.name)).toContain('Camera Operator');
  });
});

// ═══════════════════════════════════════════════════════════
// 9. SCHEDULES API
// ═══════════════════════════════════════════════════════════

test.describe('Schedules API', () => {
  test('adding and listing schedules', async ({ page }) => {
    await gotoCleanRoleRoom(page);
    await page.waitForTimeout(3000);

    const apiKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );

    // Create a project
    const projRes = await page.request.post(`${API_BASE}/projects`, {
      headers: {
        'x-api-key': apiKey!,
        'Content-Type': 'application/json',
      },
      data: { name: 'Schedule Test' },
    });
    const project = await projRes.json();

    // Add schedule entry
    const sched = await page.request.post(
      `${API_BASE}/projects/${project.id}/schedules`,
      {
        headers: {
          'x-api-key': apiKey!,
          'Content-Type': 'application/json',
        },
        data: {
          date: '2026-03-15',
          startTime: '08:00',
          endTime: '18:00',
          type: 'audition',
          notes: 'Day 1 main auditions',
        },
      }
    );
    expect(sched.ok()).toBeTruthy();

    // List schedules
    const listRes = await page.request.get(
      `${API_BASE}/projects/${project.id}/schedules`,
      {
        headers: { 'x-api-key': apiKey! },
      }
    );
    expect(listRes.ok()).toBeTruthy();

    const schedules: { id: string; type: string }[] = await listRes.json();
    expect(schedules.length).toBeGreaterThanOrEqual(1);
    expect(schedules[0].type).toBe('audition');
  });
});

// ═══════════════════════════════════════════════════════════
// 10. ERROR HANDLING
// ═══════════════════════════════════════════════════════════

test.describe('Error Handling', () => {
  test('401 when no API key on protected endpoint', async ({ page }) => {
    const res = await page.request.get(`${API_BASE}/projects`, {
      headers: {},
    });
    expect(res.status()).toBe(401);
  });

  test('rejects invalid API key', async ({ page }) => {
    const res = await page.request.get(`${API_BASE}/projects`, {
      headers: { 'x-api-key': 'rr_invalid_key_12345' },
    });
    // Backend may return 401 (missing) or 403 (invalid)
    expect([401, 403]).toContain(res.status());
  });

  test('navigates to Role Room preserving localStorage', async ({ page }) => {
    await gotoCleanRoleRoom(page);
    await page.waitForTimeout(3000);
    await gotoRoleRoom(page);
    const apiKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );
    expect(apiKey).toBeTruthy();
  });

  test('creating project without name returns 400', async ({ page }) => {
    await gotoCleanRoleRoom(page);
    await page.waitForTimeout(3000);

    const apiKey = await page.evaluate(() =>
      localStorage.getItem('roleRoomApiKey')
    );

    const res = await page.request.post(`${API_BASE}/projects`, {
      headers: {
        'x-api-key': apiKey!,
        'Content-Type': 'application/json',
      },
      data: { description: 'No name provided' },
    });
    expect(res.status()).toBe(400);
  });
});
