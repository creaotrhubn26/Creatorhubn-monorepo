import { expect, test, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-production-manuscript-test.html';
const PROJECT_ID = 'pmv-e2e-project';
const savedShotListBodies = new WeakMap<Page, unknown[]>();
const savedCoverageReviewBodies = new WeakMap<Page, unknown[]>();

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

const projectPayload = {
  id: PROJECT_ID,
  name: 'PMV E2E Project',
  clientName: 'Holy Crust',
  clientEmail: 'client@example.com',
  status: 'active',
  roles: [
    { id: 'role-chef', name: 'CHEF', description: 'Lead chef' },
    { id: 'role-guest', name: 'GUEST', description: 'Guest' },
  ],
  candidates: [
    {
      id: 'candidate-chef',
      name: 'E2E Chef',
      status: 'confirmed',
      assignedRoles: ['role-chef'],
      contactInfo: { email: 'chef@example.com', phone: '+47 400 00 001' },
      photos: [],
    },
  ],
  crew: [],
  schedules: [],
  locations: [],
  props: [],
  productionDays: [],
  sceneBreakdowns: [],
  shotLists: [
    {
      id: 'pmv-shot-list-1',
      projectId: PROJECT_ID,
      sceneId: 'pmv-scene-1',
      sceneName: 'Kitchen',
      shots: [
        {
          id: 'pmv-shot-1',
          sceneId: 'pmv-scene-1',
          shotType: 'Medium',
          cameraAngle: 'Eye Level',
          cameraMovement: 'Static',
          description: 'Chef hands prepare the opening dish',
          duration: 5,
          imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22225%22%3E%3Crect width=%22400%22 height=%22225%22 fill=%22%233b82f6%22/%3E%3C/svg%3E',
          createdAt: '2026-04-14T09:00:00.000Z',
          updatedAt: '2026-04-14T09:00:00.000Z',
        },
        {
          id: 'pmv-shot-2',
          sceneId: 'pmv-scene-1',
          shotType: 'Close-up',
          cameraAngle: 'Eye Level',
          cameraMovement: 'Static',
          description: 'Knife detail lands on the final garnish',
          duration: 4,
          imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22225%22%3E%3Crect width=%22400%22 height=%22225%22 fill=%22%23f97316%22/%3E%3C/svg%3E',
          createdAt: '2026-04-14T09:00:00.000Z',
          updatedAt: '2026-04-14T09:00:00.000Z',
        },
      ],
      createdAt: '2026-04-14T09:00:00.000Z',
      updatedAt: '2026-04-14T09:00:00.000Z',
    },
  ],
};

const shootingDays = [
  {
    id: 'pmv-day-1',
    project_id: PROJECT_ID,
    day_number: 1,
    date: '2026-04-20',
    call_time: '07:00',
    wrap_time: '17:00',
    location: 'Kitchen',
    location_address: 'Main Street 1',
    notes: 'E2E shooting day',
    scenes: ['pmv-scene-1', 'pmv-scene-2'],
    status: 'planned',
    weather: {
      condition: 'cloudy',
      temperature: 12,
      sunrise: '06:00',
      sunset: '20:30',
      forecast: 'Stable',
    },
    crew_call_times: {},
    cast_call_times: {},
    equipment_needed: ['Sony FX6', 'Boom Mic'],
    meals: [],
    created_at: '2026-04-14T09:00:00.000Z',
    updated_at: '2026-04-14T09:00:00.000Z',
  },
];

const stripboard = [
  {
    id: 'pmv-strip-1',
    scene_id: 'pmv-scene-1',
    scene_number: '1',
    shooting_day_id: 'pmv-day-1',
    day_number: 1,
    sort_order: 1,
    color: '#fff9c4',
    location: 'Kitchen',
    pages: 1.25,
    cast_ids: ['CHEF'],
    status: 'scheduled',
    estimated_time: 60,
    notes: 'Opening scene',
  },
];

async function routeProductionManuscriptApis(page: Page) {
  savedShotListBodies.set(page, []);
  savedCoverageReviewBodies.set(page, []);
  let coverageReviewStore = {
    takeReviews: {} as Record<string, unknown>,
    shotLineCoverage: {} as Record<string, unknown>,
    version: 0,
    updatedAt: null as string | null,
  };

  await page.addInitScript(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'print', {
      configurable: true,
      value: () => undefined,
    });
  });

  await page.route('**/api/settings**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(route.request().method() === 'GET' ? { data: null, entries: [] } : { success: true }),
    });
  });

  await page.route('**/api/casting/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, status: 'ok' }),
    });
  });

  await page.route('**/api/casting/projects/troll-project-2026**', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Demo project disabled in direct PMV harness' }),
    });
  });

  await page.route('**/api/ai/tts/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        freeServicesEnabled: false,
        openaiConfigured: false,
        edgeTts: { available: false },
        fasterWhisper: { available: false },
      }),
    });
  });

  await page.route('**/api/ai/tts', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'TTS disabled in direct PMV harness' }),
    });
  });

  await page.route(`**/api/casting/projects/${PROJECT_ID}/shot-lists**`, async (route) => {
    if (route.request().method() !== 'GET') {
      savedShotListBodies.get(page)?.push(route.request().postDataJSON());
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, shotLists: projectPayload.shotLists }),
    });
  });

  await page.route(`**/api/casting/projects/${PROJECT_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(projectPayload),
    });
  });

  await page.route('**/api/casting/projects', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([projectPayload]),
    });
  });

  await page.route(`**/api/production/${PROJECT_ID}/shooting-days`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: shootingDays }),
    });
  });

  await page.route(`**/api/production/${PROJECT_ID}/stripboard`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: stripboard }),
    });
  });

  await page.route(`**/api/production/${PROJECT_ID}/cast`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });

  await page.route(`**/api/production/${PROJECT_ID}/crew`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });

  await page.route(`**/api/production/${PROJECT_ID}/live-set-status`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          current_scene_id: 'pmv-scene-1',
          current_shot_id: 'pmv-shot-1',
          current_setup: 1,
          status: 'standby',
          notes: 'Ready',
          updated_at: '2026-04-14T09:00:00.000Z',
          today_takes: [
            {
              id: 'pmv-take-1',
              sceneId: 'pmv-scene-1',
              shotId: 'pmv-shot-1',
              takeNumber: 1,
              status: 'circle',
              duration: 27,
              notes: 'Strong performance, keep for director review.',
              recordedAt: '2026-04-14T09:05:00.000Z',
              camera: 'Sony FX6',
              lens: 'Canon RF 24-70mm',
              fps: 25,
              iso: 800,
            },
            {
              id: 'pmv-take-2',
              sceneId: 'pmv-scene-1',
              shotId: 'pmv-shot-2',
              takeNumber: 2,
              status: 'ok',
              duration: 19,
              notes: 'Good insert candidate, check continuity.',
              recordedAt: '2026-04-14T09:11:00.000Z',
              camera: 'Sony FX6',
              lens: 'Canon RF 50mm',
              fps: 25,
              iso: 640,
            },
          ],
          total_setups: 1,
          scenes_completed: [],
        },
      }),
    });
  });

  await page.route(`**/api/role-room/projects/${PROJECT_ID}/coverage-review`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          projectId: PROJECT_ID,
          ...coverageReviewStore,
        }),
      });
      return;
    }

    if (method === 'PUT') {
      const body = route.request().postDataJSON() as {
        expectedVersion?: number;
        takeReviews?: Record<string, unknown>;
        shotLineCoverage?: Record<string, unknown>;
      };
      savedCoverageReviewBodies.get(page)?.push(body);
      if (typeof body.expectedVersion === 'number' && body.expectedVersion !== coverageReviewStore.version) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'coverage_review_conflict',
            projectId: PROJECT_ID,
            current: {
              success: true,
              projectId: PROJECT_ID,
              ...coverageReviewStore,
            },
          }),
        });
        return;
      }

      coverageReviewStore = {
        takeReviews: body.takeReviews || {},
        shotLineCoverage: body.shotLineCoverage || {},
        version: coverageReviewStore.version + 1,
        updatedAt: new Date().toISOString(),
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          projectId: PROJECT_ID,
          ...coverageReviewStore,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'method_not_allowed' }),
    });
  });

  await page.route('**/api/production/stripboard/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.route('**/api/shotcafe/search**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/shotcafe/movie/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ frames: [] }) });
  });

  await page.route('**/api/unsplash/search**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) });
  });
}

async function openProductionManuscript(page: Page, options: { expectSceneNavigator?: boolean } = {}) {
  const { expectSceneNavigator = true } = options;
  await routeProductionManuscriptApis(page);
  await page.goto(TEST_PAGE);
  await expect(page.getByTestId('pmv-root')).toBeVisible({ timeout: 30_000 });
  if (expectSceneNavigator) {
    await expect(page.getByTestId('pmv-scene-item').first()).toBeVisible();
  }
}

async function selectFirstShot(page: Page) {
  await expect(page.getByTestId('pmv-scene-shot-card').first()).toBeVisible();
  await page.getByTestId('pmv-scene-shot-card').first().click();
  await expect(page.getByTestId('pmv-shot-inspector')).toBeVisible();
}

test.describe('ProductionManuscriptView direct E2E', () => {
  test('061 opens manuscript view', async ({ page }) => {
    await openProductionManuscript(page);
    await expect(page.getByText('PRODUCTION MANUSCRIPT')).toBeVisible();
    await expect(page.getByText('INT. Kitchen').first()).toBeVisible();
  });

  test('062 selects a scene from the navigator', async ({ page }) => {
    await openProductionManuscript(page);
    await page.locator('[data-testid="pmv-scene-select-zone"][data-scene-id="pmv-scene-2"]').click();
    await expect(page.locator('[data-testid="pmv-scene-item"][data-scene-id="pmv-scene-2"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('EXT. Main Street').first()).toBeVisible();
  });

  test('063 starts and stops read-through', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-read-through-toggle').click();
    await expect(page.getByTestId('pmv-read-through-play')).toBeVisible();
    await page.getByTestId('pmv-read-through-play').click();
    await expect(page.getByTestId('pmv-current-dialogue-line')).toBeVisible();
    await page.getByTestId('pmv-read-through-play').click();
    await expect(page.getByTestId('pmv-read-through-line-counter')).toContainText('Linje 1');
  });

  test('064 advances read-through with TTS disabled fallback timer', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-read-through-toggle').click();
    await page.getByTestId('pmv-tts-toggle').click();
    await page.getByTestId('pmv-read-through-play').click();
    await expect(page.getByTestId('pmv-read-through-line-counter')).toContainText('Linje 1');
    await expect(page.getByTestId('pmv-read-through-line-counter')).toContainText('Linje 2', { timeout: 7_500 });
  });

  test('065 opens call sheet preview from stripboard', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-open-stripboard').click();
    await expect(page.getByTestId('pmv-stripboard-dialog')).toBeVisible();
    await page.getByTestId('stripboard-call-sheet-preview').first().click();
    await expect(page.getByTestId('pmv-call-sheet-preview-dialog')).toBeVisible();
  });

  test('066 downloads call sheet JSON', async ({ page }) => {
    await openProductionManuscript(page);
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('pmv-call-sheet-json').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^call_sheet_\d{4}-\d{2}-\d{2}\.json$/);
  });

  test('067 creates a shot from uploaded image', async ({ page }) => {
    await openProductionManuscript(page);
    const initialCount = await page.getByTestId('pmv-scene-shot-card').count();
    await page.getByTestId('pmv-add-shot-button').click();
    await page.getByTestId('pmv-add-shot-upload-mode').click();
    await page.getByTestId('pmv-add-shot-upload-input').setInputFiles({
      name: 'storyboard-upload.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });
    await expect(page.getByTestId('pmv-add-shot-create')).toBeEnabled();
    await page.getByTestId('pmv-add-shot-create').click();
    await expect.poll(async () => page.getByTestId('pmv-scene-shot-card').count()).toBeGreaterThan(initialCount);
  });

  test('068 saves and exposes a shot preset', async ({ page }) => {
    await openProductionManuscript(page);
    await selectFirstShot(page);
    await page.getByTestId('pmv-save-preset-open').click();
    await expect(page.getByTestId('pmv-save-preset-dialog')).toBeVisible();
    await page.getByTestId('pmv-preset-name-input').fill('E2E Kitchen Preset');
    await page.getByTestId('pmv-save-preset-confirm').click();
    await expect(page.getByTestId('pmv-presets-select')).toBeVisible();
  });

  test('069 saves production notes', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-production-notes-add').click();
    await expect(page.getByTestId('pmv-production-notes-dialog')).toBeVisible();
    await page.getByTestId('pmv-production-notes-input').fill('Hold camera low and track the hands.');
    await page.getByTestId('pmv-production-notes-confirm').click();
    await expect(page.getByText('Hold camera low and track the hands.')).toBeVisible();
  });

  test('070 saves scene needs toggles', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-open-scene-needs').click();
    await expect(page.getByTestId('pmv-scene-needs-dialog')).toBeVisible();
    await page.getByTestId('pmv-scene-needs-camera').click();
    await expect(page.getByTestId('pmv-scene-needs-camera').locator('input[type="checkbox"]')).toBeChecked();
    await page.getByTestId('pmv-scene-needs-close').click();
  });

  test('071 opens stripboard dialog', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-open-stripboard').click();
    await expect(page.getByTestId('pmv-stripboard-dialog')).toBeVisible();
  });

  test('072 opens shooting day planner', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-open-shooting-day-planner').click();
    await expect(page.getByTestId('pmv-shooting-day-planner-dialog')).toBeVisible();
    await expect(page.getByTestId('shooting-day-call-sheet-preview').first()).toBeVisible();
  });

  test('073 connects and disconnects Live Set timeline sync', async ({ page }) => {
    await openProductionManuscript(page);
    const toggle = page.getByTestId('pmv-live-set-connect-toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('074 opens talent drawer', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-talent-toggle').click();
    await expect(page.getByTestId('pmv-talent-drawer')).toBeVisible();
    await expect(page.getByText('Cast & Talent')).toBeVisible();
  });

  test('075 opens mobile scene drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openProductionManuscript(page, { expectSceneNavigator: false });
    await page.getByTestId('pmv-mobile-scene-drawer-toggle').click();
    await expect(page.getByTestId('pmv-scene-item').first()).toBeVisible();
  });

  test('076 supports keyboard shortcuts for batch select and clear', async ({ page }) => {
    await openProductionManuscript(page);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await expect(page.getByTestId('pmv-batch-bar')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pmv-batch-bar')).toBeHidden();
  });

  test('077 exports selected scenes as batch JSON', async ({ page }) => {
    await openProductionManuscript(page);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await expect(page.getByTestId('pmv-batch-bar')).toBeVisible();
    await expect(page.getByTestId('pmv-batch-dialog')).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('pmv-batch-dialog-export').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^selected_scenes_\d+\.json$/);
  });

  test('078 opens storyboard link dialog', async ({ page }) => {
    await openProductionManuscript(page);
    await selectFirstShot(page);
    await page.getByTestId('pmv-shot-storyboard-link').click();
    await expect(page.getByTestId('pmv-shot-storyboard-dialog')).toBeVisible();
  });

  test('079 uploads a reference image', async ({ page }) => {
    await openProductionManuscript(page);
    await selectFirstShot(page);
    await page.getByTestId('pmv-reference-upload-input').setInputFiles({
      name: 'reference.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });
    await expect(page.getByText('1 opplastet')).toBeVisible();
  });

  test('080 shows empty state for reference search', async ({ page }) => {
    await openProductionManuscript(page);
    await selectFirstShot(page);
    await page.getByTestId('pmv-reference-search-open').click();
    await expect(page.getByTestId('pmv-reference-search-dialog')).toBeVisible();
    await expect(page.getByTestId('pmv-reference-search-empty-state')).toBeVisible({ timeout: 5_000 });
  });

  test('081 supports timeline zoom presets and fit to screen', async ({ page }) => {
    await openProductionManuscript(page);
    const firstBlock = page.getByTestId('pmv-timeline-shot-block').first();
    await expect(firstBlock).toBeVisible();
    const beforeBasis = await firstBlock.evaluate((node) => getComputedStyle(node).flexBasis);
    await page.getByTestId('pmv-timeline-zoom-200').click();
    await expect.poll(async () => firstBlock.evaluate((node) => getComputedStyle(node).flexBasis)).not.toBe(beforeBasis);
    await page.getByTestId('pmv-timeline-fit').click();
    await expect.poll(async () => firstBlock.evaluate((node) => getComputedStyle(node).flexBasis)).toBe(beforeBasis);
  });

  test('082 filters timeline to selected scene and selected act', async ({ page }) => {
    await openProductionManuscript(page);
    await expect(page.getByTestId('pmv-timeline-scene-label')).toHaveCount(3);
    await page.getByTestId('pmv-timeline-show-selected-scene').click();
    await expect(page.getByTestId('pmv-timeline-scene-label')).toHaveCount(1);
    await page.getByTestId('pmv-timeline-show-all').click();
    await expect(page.getByTestId('pmv-timeline-scene-label')).toHaveCount(3);
    await page.getByTestId('pmv-timeline-show-act').click();
    await expect(page.getByTestId('pmv-timeline-scene-label')).toHaveCount(2);
  });

  test('083 jumps between selected shot and live shot', async ({ page }) => {
    await openProductionManuscript(page);
    await page.locator('[data-testid="pmv-scene-shot-card"][data-shot-id="pmv-shot-2"]').click();
    await expect(page.getByText('Knife detail lands on the final garnish')).toBeVisible();
    await page.getByTestId('pmv-timeline-jump-selected-shot').click();
    await expect(page.locator('[data-testid="pmv-timeline-shot-block"][data-shot-id="pmv-shot-2"]')).toBeVisible();

    await page.getByTestId('pmv-live-set-connect-toggle').click();
    await expect(page.getByTestId('pmv-timeline-jump-live-shot')).toBeEnabled();
    await page.getByTestId('pmv-timeline-jump-live-shot').click();
    await expect(page.getByText('Chef hands prepare the opening dish')).toBeVisible();
  });

  test('084 reorders shots from the timeline and persists the shot list', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-timeline-zoom-400').click();
    const firstShot = page.locator('[data-testid="pmv-timeline-shot-block"][data-shot-id="pmv-shot-1"]');
    const secondShot = page.locator('[data-testid="pmv-timeline-shot-block"][data-shot-id="pmv-shot-2"]');
    await firstShot.dragTo(secondShot);

    await expect.poll(() => savedShotListBodies.get(page)?.length ?? 0).toBeGreaterThan(0);
    const saves = savedShotListBodies.get(page) ?? [];
    const lastSave = saves[saves.length - 1] as { shots?: Array<{ id: string }> };
    expect(lastSave.shots?.map((shot) => shot.id)).toEqual(['pmv-shot-2', 'pmv-shot-1']);
  });

  test('085 Coverage Review opens scene-centric workspace with LiveSet takes', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-live-set-connect-toggle').click();
    await page.getByTestId('pmv-workspace-coverage-review').click();

    await expect(page.getByTestId('pmv-coverage-review-workspace')).toBeVisible();
    await expect(page.getByText('Ikke bare vis manus. Vis om manuset faktisk er dekket av brukbare takes.')).toBeVisible();
    await expect(page.getByTestId('pmv-take-review-card')).toHaveCount(2);
    await expect(page.getByTestId('pmv-coverage-bucket')).toHaveCount(6);
    await expect(page.getByTestId('pmv-post-handoff-panel')).toBeVisible();
  });

  test('086 Coverage Review links selected shot to lined script coverage', async ({ page }) => {
    await openProductionManuscript(page);
    await selectFirstShot(page);
    await page.getByTestId('pmv-workspace-coverage-review').click();

    const firstLine = page.getByTestId('pmv-lined-script-line').first();
    await expect(firstLine).toContainText('ikke dekket av shot');
    await page.getByTestId('pmv-lined-script-toggle-coverage').first().click();
    await expect(firstLine).toContainText('Medium');
  });

  test('087 Coverage Review marks take decisions and post handoff', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-live-set-connect-toggle').click();
    await page.getByTestId('pmv-workspace-coverage-review').click();

    await page.getByTestId('pmv-take-good-performance').first().click();
    await page.getByTestId('pmv-take-good-framing').first().click();
    await page.getByTestId('pmv-take-editor-favorite').first().click();
    await page.getByTestId('pmv-take-director-note').first().locator('input').fill('Good for performance and framing.');
    await page.getByTestId('pmv-send-take-to-post').first().click();

    await expect(page.getByTestId('pmv-take-director-note').first().locator('input')).toHaveValue('Good for performance and framing.');
    await expect(page.getByText('Sendt videre til post')).toBeVisible();
    await expect(page.getByTestId('pmv-post-handoff-panel')).toContainText('Favorites');
    await expect(page.getByTestId('pmv-post-handoff-panel')).toContainText('Sent to editor');
  });

  test('088 Coverage Review compares takes in video village context', async ({ page }) => {
    await openProductionManuscript(page);
    await page.getByTestId('pmv-live-set-connect-toggle').click();
    await page.getByTestId('pmv-workspace-coverage-review').click();

    await page.getByTestId('pmv-take-compare-toggle').first().click();
    await page.getByTestId('pmv-take-compare-toggle').nth(1).click();

    await expect(page.getByTestId('pmv-take-compare-panel')).toBeVisible();
    await expect(page.getByTestId('pmv-take-compare-panel')).toContainText('T1');
    await expect(page.getByTestId('pmv-take-compare-panel')).toContainText('T2');
  });

  test('089 Coverage Review persists take review and lined script coverage after reload', async ({ page }) => {
    await openProductionManuscript(page);
    await selectFirstShot(page);
    await page.getByTestId('pmv-live-set-connect-toggle').click();
    await page.getByTestId('pmv-workspace-coverage-review').click();

    await page.getByTestId('pmv-lined-script-toggle-coverage').first().click();
    await page.getByTestId('pmv-take-good-performance').first().click();
    await page.getByTestId('pmv-take-editor-favorite').first().click();
    await page.getByTestId('pmv-take-director-note').first().locator('input').fill('Reload-persistent director choice.');

    await expect.poll(() => savedCoverageReviewBodies.get(page)?.length ?? 0).toBeGreaterThan(0);
    await expect(page.getByTestId('pmv-coverage-sync-status')).toContainText('Server synket');

    await page.reload();
    await expect(page.getByTestId('pmv-root')).toBeVisible({ timeout: 30_000 });
    await selectFirstShot(page);
    await page.getByTestId('pmv-live-set-connect-toggle').click();
    await page.getByTestId('pmv-workspace-coverage-review').click();

    await expect(page.getByTestId('pmv-lined-script-line').first()).toContainText('Medium');
    await expect(page.getByTestId('pmv-take-director-note').first().locator('input')).toHaveValue('Reload-persistent director choice.');
    await expect(page.getByTestId('pmv-post-handoff-panel')).toContainText('Favorites');
  });
});
