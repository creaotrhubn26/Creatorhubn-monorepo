import { expect, test, type Page, type Route } from '@playwright/test';

const TEST_PAGE = '/e2e-producer-export-test.html';
const PROJECT_ID = 'e2e-export-project';

const projectPayload = {
  id: PROJECT_ID,
  name: 'E2E Export Project',
  status: 'active',
  roles: [],
  candidates: [],
  crew: [],
  schedules: [],
  locations: [],
  props: [],
  shotLists: [],
  productionDays: [],
  producerWorkflowStatus: 'planning',
  producerWorkflowMeta: {
    totalReviews: 0,
    pendingReviews: 0,
    approvedReviews: 0,
    changesRequestedReviews: 0,
    rejectedReviews: 0,
    lastReviewActivityAt: null,
  },
};

const clientIntake = {
  projectGoal: 'Launch Holy Crust with a premium but practical content package.',
  deliverables: 'One launch reel, three story clips and one client handoff package.',
  targetAudience: 'Local guests and food lovers.',
  keyMessage: 'Craft, speed and warm hospitality.',
  timingConstraints: 'Ready before launch week.',
  brandNotes: 'Keep it warm and tactile.',
  materialOverview: 'Logo, menu and kitchen references are provided.',
  referenceLinks: 'https://example.com/reference',
  contactName: 'Client Owner',
  contactEmail: 'client@example.com',
  contactPhone: '+47 400 00 000',
  additionalNotes: 'Keep exports client-ready.',
};

const clientMaterials = [
  {
    id: 'material-logo',
    project_id: PROJECT_ID,
    entry_type: 'brand_asset',
    title: 'Holy Crust logo',
    description: 'Primary logo for export overlays.',
    external_url: 'https://example.com/logo.png',
    phase: 'preproduction',
    status: 'provided',
    created_at: '2026-04-13T10:00:00.000Z',
    updated_at: '2026-04-13T10:00:00.000Z',
    metadata: {
      fileName: 'holy-crust-logo.png',
      versionLabel: 'v01',
      sourceLabel: 'Client',
      usageNotes: 'Use in outro and package documentation.',
      priority: 'critical',
    },
  },
];

async function routeProducerExportApis(page: Page) {
  let uploadIndex = 0;
  const uploadedFiles: Array<Record<string, unknown>> = [];

  await page.addInitScript(() => {
    const user = {
      id: 'e2e-producer',
      email: 'producer@example.com',
      name: 'E2E Producer',
      role: 'admin',
      isAdmin: true,
    };
    window.localStorage.setItem('creatorhub_auth_token', 'e2e-creatorhub-token');
    window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    window.localStorage.setItem('role_room_auth_token', 'e2e-role-room-token');
    window.localStorage.setItem('role_room_auth_session', JSON.stringify({
      token: 'e2e-role-room-token',
      currentUserId: 'e2e-producer',
      adminUser: {
        id: 'e2e-producer',
        email: 'producer@example.com',
        role: 'admin',
        requestedRole: 'content_producer',
      },
    }));
  });

  await page.route('**/api/auth/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: 'e2e-producer',
          email: 'producer@example.com',
          name: 'E2E Producer',
          role: 'admin',
          isAdmin: true,
        },
      }),
    });
  });

  await page.route('**/api/settings**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ settings: [] }),
    });
  });

  await page.route('**/api/casting/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/api/casting/projects', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([projectPayload]),
    });
  });

  await page.route(`**/api/casting/projects/${PROJECT_ID}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(projectPayload),
    });
  });

  await page.route('**/api/casting/manuscripts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(`**/api/role-room/projects/${PROJECT_ID}/project-agreements`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agreements: [] }),
    });
  });

  await page.route('**/api/role-room/google/status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ state: 'disconnected', artifacts: [] }),
    });
  });

  await page.route(`**/api/role-room/projects/${PROJECT_ID}/producer/client-intake`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ intake: clientIntake }),
    });
  });

  await page.route(`**/api/role-room/projects/${PROJECT_ID}/producer/client-materials`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: clientMaterials }),
    });
  });

  await page.route(`**/api/role-room/projects/${PROJECT_ID}/producer/reviews**`, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const id = `created-review-${Date.now()}`;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          review: {
            id,
            project_id: PROJECT_ID,
            review_type: 'delivery',
            title: 'Generated review',
            status: 'pending',
            created_at: '2026-04-13T10:00:00.000Z',
            updated_at: '2026-04-13T10:00:00.000Z',
            comments: [],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route(`**/api/role-room/projects/${PROJECT_ID}/producer/timeline**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        item: {
          id: `timeline-${Date.now()}`,
          project_id: PROJECT_ID,
          phase: 'postproduction',
          title: 'Generated timeline item',
          status: 'todo',
          sort_order: 0,
          created_at: '2026-04-13T10:00:00.000Z',
          updated_at: '2026-04-13T10:00:00.000Z',
        },
        items: [],
      }),
    });
  });

  const fulfillProjectFileRoute = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const isFilesCollection = url.pathname === `/api/projects/${PROJECT_ID}/files`;
    const isShareRequest = url.pathname.endsWith('/share');

    if (isShareRequest && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          shareUrl: `/api/projects/${PROJECT_ID}/files/client-package/shared`,
          expiresAt: '2026-04-16T10:00:00.000Z',
        }),
      });
      return;
    }

    if (!isFilesCollection && method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (isFilesCollection && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(uploadedFiles),
      });
      return;
    }

    if (isFilesCollection && method === 'POST') {
      uploadIndex += 1;
      const body = request.postData() || '';
      const isWorkspaceFile = body.includes('role_room_delivery_workspace');
      const file = {
        id: isWorkspaceFile ? `workspace-file-${uploadIndex}` : `client-package-${uploadIndex}`,
        projectId: PROJECT_ID,
        name: isWorkspaceFile ? `workspace-${uploadIndex}.json` : 'e2e-export-project-klientpakke.zip',
        originalName: isWorkspaceFile ? `workspace-${uploadIndex}.json` : 'e2e-export-project-klientpakke.zip',
        size: 1024,
        mimeType: isWorkspaceFile ? 'application/json' : 'application/zip',
        uploadedAt: '2026-04-13T10:00:00.000Z',
        downloadUrl: `/api/projects/${PROJECT_ID}/files/${isWorkspaceFile ? `workspace-file-${uploadIndex}` : `client-package-${uploadIndex}`}/download`,
        metadata: isWorkspaceFile
          ? {
              source: 'role_room_delivery_workspace',
              workspaceType: 'workspace_manifest',
              packageName: 'e2e-export-project-leveransearbeidsomrade',
              folderPath: 'delivery-workspace/oversikt',
              versionLabel: 'v01',
              deliveryTitle: 'Workspace manifest',
            }
          : {
              source: 'role_room_client_handoff_package',
              packageName: 'e2e-export-project-klientpakke',
              folderPath: 'client-handoff/e2e-export-project-klientpakke',
              versionLabel: 'v01',
              deliveryStageLabel: 'Klientpakke',
            },
      };
      uploadedFiles.push(file);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(file),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  };

  await page.route(`**/api/projects/${PROJECT_ID}/files**`, fulfillProjectFileRoute);
};

test.describe('Producer export handoff', () => {
  test('builds package, writes delivery workspace, shares latest package, and downloads manifest/PDF', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await routeProducerExportApis(page);
    await page.goto(TEST_PAGE, { waitUntil: 'load', timeout: 60_000 });

    await expect(page.getByTestId('producer-export-handoff-panel')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('producer-export-summary-klientgrunnlag')).toContainText('6/6');
    await expect(page.getByTestId('producer-export-summary-klientgrunnlag')).toContainText('1 filer');

    await page.getByTestId('producer-export-write-package').click();
    await expect(page.getByTestId('producer-export-latest-package-alert')).toContainText('Siste klientpakke');
    await expect(page.getByTestId('producer-export-share-package')).toBeVisible();

    await page.getByTestId('producer-export-write-workspace').click();
    await expect(page.getByTestId('producer-export-workspace-file').first()).toBeVisible();

    await page.getByTestId('producer-export-share-package').click();
    await expect(page.getByTestId('producer-export-share-alert')).toContainText('Klientpakken er delt');

    const [manifestDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('producer-export-download-manifest').click(),
    ]);
    expect(manifestDownload.suggestedFilename()).toContain('leveringsmanifest');

    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('producer-export-download-pdf').click(),
    ]);
    expect(pdfDownload.suggestedFilename()).toContain('klientpakke.pdf');

    await page.getByTestId('producer-export-send-package').click();
    await expect(page.getByTestId('producer-export-send-confirmed')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
