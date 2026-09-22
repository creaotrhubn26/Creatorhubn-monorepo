import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner } from './helpers/role-room';

const projectId = 'e2e-content-producer-visual';
const project = {
  id: projectId,
  name: 'Nordlys kampanje',
  description: 'Prosjektnøytral E2E-fixture for den fokuserte Role Room-headeren.',
  status: 'active',
  genre: 'commercial',
  projectType: 'commercial',
  clientName: 'Nordlys',
  producerWorkflowStatus: 'planning',
  roles: [],
  candidates: [],
  crew: [],
  schedules: [],
  locations: [],
  productionDays: [],
  createdAt: '2026-09-22T09:00:00.000Z',
  updatedAt: '2026-09-22T09:00:00.000Z',
};

async function installProjectApi(page: Page) {
  await page.route('**/api/casting/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === '/api/casting/health') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'healthy' }) });
      return;
    }
    if (pathname === '/api/casting/projects' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([project]) });
      return;
    }
    if (pathname === `/api/casting/projects/${projectId}` && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(project) });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/presence/heartbeat', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
}

test('fokusert Role Room-header bruker en generell arbeidsflatevisual', async ({ page }) => {
  await installProjectApi(page);
  await openCastingPlanner(page, {
    urlFlags: { session: 'content-producer', project: projectId },
  });

  const activeProject = page.getByTestId('role-room-active-project');
  await expect(activeProject).toBeVisible({ timeout: 20_000 });
  await expect(activeProject).toContainText('Nordlys kampanje');

  const workspaceVisual = activeProject.getByTestId('role-room-workspace-visual-development');
  await expect(workspaceVisual).toBeVisible();
  await expect.poll(() => workspaceVisual.locator('img').evaluate(
    (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
  )).toBe(true);
});
