/**
 * E2E-test for MarketingPlanWorkspace — Power BI-aktig dashboard for
 * markedsplanen. Tester:
 *   1. Dashboard rendres med KPI-tiles + pillar-fordeling + tabell
 *   2. VersionPicker viser plan-versjoner og bytter aktiv versjon
 *   3. Klikk på post-rad åpner PostEditDialog
 *   4. Lagring av post-edit oppdaterer tabellen + bumper activity-feed
 *   5. Activity-feed rendrer events fra mocked endpoint
 *
 * Strategi: harness-mount + mock alle /api/role-room/*-respons via
 * route(). Tester at frontend rendrer + interagerer korrekt mot
 * deterministisk mock-data.
 */

import { expect, test } from '@playwright/test';

const HARNESS_URL = '/e2e-marketing-plan-workspace.html';
const PROJECT_ID = 'test-project-001';
const PLAN_ID = 'plan-test-001';

// ─────────────────────────────────────────────────────────────────────
// Mock-payload-fabrikker
// ─────────────────────────────────────────────────────────────────────

const MOCK_PLAN = {
  id: PLAN_ID,
  projectId: PROJECT_ID,
  ownerUserId: 'user-test',
  status: 'active',
  strategy: {
    channelStrategy: { primary: 'instagram', cadencePerWeek: 5, secondary: ['tiktok'], reasoning: 'IG vinner' },
    toneOfVoice: { voice: 'Energisk', dos: ['Vis prosess'], donts: ['Buzzwords'] },
    positioning: { valueProp: 'Lokal surdeigspizza i Oslo', differentiator: 'Surdeig 48t' },
    kpiTargets: [{ metric: 'bookings', target: 50, per: 'week', rationale: 'Vekstmål' }],
  },
  pillars: [
    { id: 'pillar-1', planId: PLAN_ID, name: 'Bak menyen', description: 'Vis prosess', rationale: 'Engagement', sortOrder: 0, isActive: true, isCustom: false },
    { id: 'pillar-2', planId: PLAN_ID, name: 'Lokal kjærlighet', description: 'Nabolaget', rationale: 'Lokal-relevans', sortOrder: 1, isActive: true, isCustom: false },
  ],
  generatedAt: '2026-05-16T10:00:00Z',
  generatedWithModel: 'claude-sonnet-4-5',
  startDate: '2026-05-16',
  horizonDays: 30,
  createdAt: '2026-05-16T10:00:00Z',
  updatedAt: '2026-05-16T10:00:00Z',
};

const MOCK_POSTS_INITIAL = [
  {
    id: 'post-1', planId: PLAN_ID, pillarId: 'pillar-1', sortOrder: 0, dayOffset: 0,
    hook: 'Slik lager vi surdeigen på 48 timer',
    format: 'reel', script: null, captionDraft: null, callToAction: 'Bestill',
    primaryPlatform: 'instagram', crossPostPlan: [],
    goalKpi: null, status: 'scheduled', feedPlanPostId: null,
    scheduledFor: null, publishedAt: null,
    createdAt: '2026-05-16T10:00:00Z', updatedAt: '2026-05-16T10:00:00Z',
    lastEditedAt: '2026-05-29T10:00:00Z',
    lastEditedByUserId: 'user-test',
    lastEditedByName: 'bjarne@creatorhubn.com',
  },
  {
    id: 'post-2', planId: PLAN_ID, pillarId: 'pillar-2', sortOrder: 1, dayOffset: 2,
    hook: 'Møt naboen som elsker pizza',
    format: 'carousel', script: null, captionDraft: null, callToAction: null,
    primaryPlatform: 'instagram', crossPostPlan: [],
    goalKpi: null, status: 'proposed', feedPlanPostId: null,
    scheduledFor: null, publishedAt: null,
    createdAt: '2026-05-16T10:00:00Z', updatedAt: '2026-05-16T10:00:00Z',
  },
];

const MOCK_VERSIONS = [
  {
    id: 'v-2', versionNumber: 2, label: 'Etter klient-justering',
    generatedByKind: 'user', generatedByUserId: 'user-test',
    generatedByName: 'bjarne@creatorhubn.com',
    isActive: true, createdAt: '2026-05-29T10:00:00Z',
    valueProp: 'Lokal surdeigspizza i Oslo',
    pillarCount: 2, postCount: 2,
  },
  {
    id: 'v-1', versionNumber: 1, label: null,
    generatedByKind: 'agent', generatedByUserId: null,
    generatedByName: null,
    isActive: false, createdAt: '2026-05-16T10:00:00Z',
    valueProp: 'Lokal pizza',
    pillarCount: 2, postCount: 2,
  },
];

const MOCK_ACTIVITY = [
  {
    kind: 'post_edited', at: '2026-05-29T10:00:00Z',
    actor: { kind: 'user', name: 'bjarne' },
    title: 'Post redigert i dashboard',
    postId: 'post-1', postHook: 'Slik lager vi surdeigen på 48 timer',
  },
  {
    kind: 'plan_version', at: '2026-05-29T10:00:00Z',
    actor: { kind: 'user', name: 'bjarne' },
    title: 'Plan-versjon v2 lagret — Etter klient-justering',
  },
  {
    kind: 'client_review_approved', at: '2026-05-28T15:00:00Z',
    actor: { kind: 'client', name: 'Daniel hos Holy Crust' },
    title: 'Klient godkjente post',
    postId: 'post-1', postHook: 'Slik lager vi surdeigen på 48 timer',
  },
  {
    kind: 'plan_version', at: '2026-05-16T10:00:00Z',
    actor: { kind: 'agent', name: null },
    title: 'Plan-versjon v1 lagret',
  },
];

// ─────────────────────────────────────────────────────────────────────
// Test-suite
// ─────────────────────────────────────────────────────────────────────

test.describe('MarketingPlanWorkspace — Power BI-dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Plan + posts + versjoner + activity-feed
    await page.route('**/api/role-room/marketing-plan/test-project-001', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, plan: MOCK_PLAN }) });
    });
    await page.route(`**/api/role-room/marketing-plan/${PLAN_ID}/posts`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, posts: MOCK_POSTS_INITIAL }) });
    });
    await page.route(`**/api/role-room/marketing-plan/${PROJECT_ID}/versions`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, versions: MOCK_VERSIONS }) });
    });
    await page.route(`**/api/role-room/marketing-plan/${PROJECT_ID}/activity-feed`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, events: MOCK_ACTIVITY }) });
    });
    // Versjon-activate
    await page.route(`**/api/role-room/marketing-plan/${PROJECT_ID}/versions/v-1/activate`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, activatedVersionId: 'v-1' }) });
    });
  });

  test('rendrer KPI-tiles, pillar-bars og posts-tabell fra mocked plan', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await expect(page.getByTestId('marketing-plan-workspace')).toBeVisible({ timeout: 8000 });

    // Header
    await expect(page.getByText('Lokal surdeigspizza i Oslo')).toBeVisible();
    await expect(page.getByText(/30-dagers horisont/)).toBeVisible();

    // KPI-tiles (4 stk)
    const kpis = page.getByTestId('kpi-tiles');
    await expect(kpis.getByText('Totalt posts')).toBeVisible();
    await expect(kpis.getByText('Planlagt')).toBeVisible();
    await expect(kpis.getByText('Publisert')).toBeVisible();
    await expect(kpis.getByText('Dager igjen')).toBeVisible();

    // Pillar-fordeling (samme navn dukker også opp i tabell-rad, så bruk first)
    await expect(page.getByText('Bak menyen').first()).toBeVisible();
    await expect(page.getByText('Lokal kjærlighet').first()).toBeVisible();

    // Posts-tabell — scope til selve raden så vi ikke krasjer med
    // samme tekst i activity-feed.
    await expect(page.getByTestId('post-row-post-1').getByText('Slik lager vi surdeigen på 48 timer')).toBeVisible();
    await expect(page.getByTestId('post-row-post-2').getByText('Møt naboen som elsker pizza')).toBeVisible();
  });

  test('viser "Sist endret av" på posts som har audit-data', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await expect(page.getByTestId('marketing-plan-workspace')).toBeVisible({ timeout: 8000 });
    // Post 1 har lastEditedAt + lastEditedByName satt
    await expect(page.getByText(/Sist endret av bjarne/)).toBeVisible();
  });

  test('klikk på post-rad åpner PostEditDialog med pre-fylt data', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.getByTestId('post-row-post-1').click();
    // Dialog med edit-felter
    await expect(page.getByText('Redigér post', { exact: false })).toBeVisible({ timeout: 4000 });
    await expect(page.getByLabel('Hook')).toHaveValue('Slik lager vi surdeigen på 48 timer');
  });

  test('lagring av post-edit oppdaterer tabellen + lukker dialog', async ({ page }) => {
    // Mock PATCH-respons med oppdatert hook
    await page.route('**/api/role-room/marketing-plan/posts/post-1', async (route) => {
      const updated = { ...MOCK_POSTS_INITIAL[0], hook: 'OPPDATERT HOOK FRA TEST' };
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, post: updated }) });
    });
    await page.goto(HARNESS_URL);
    await page.getByTestId('post-row-post-1').click();
    await page.getByLabel('Hook').fill('OPPDATERT HOOK FRA TEST');
    await page.getByRole('button', { name: 'Lagre endringer' }).click();
    // Dialog skal lukkes — vent til den er borte
    await expect(page.getByRole('button', { name: 'Lagre endringer' })).toBeHidden({ timeout: 5000 });
    // Den oppdaterte hooken vises nå i tabell-rad
    await expect(page.getByTestId('post-row-post-1').getByText('OPPDATERT HOOK FRA TEST')).toBeVisible();
  });

  test('VersionPicker viser plan-versjoner og lar deg klikke "Aktiv"-flagget', async ({ page }) => {
    await page.goto(HARNESS_URL);
    // Picker-knappen viser aktiv versjon i label
    const picker = page.getByRole('button', { name: /v2.*Etter klient-justering/ });
    await expect(picker).toBeVisible({ timeout: 5000 });
    await picker.click();
    // Menu-popup vises i ARIA-rollen "menu"; scope assert dit
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem').filter({ hasText: 'v2' })).toBeVisible();
    await expect(menu.getByRole('menuitem').filter({ hasText: 'v1' })).toBeVisible();
    await expect(menu.getByText('Aktiv', { exact: true })).toBeVisible();
  });

  test('activity-feed rendrer events i kronologisk rekkefølge', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await expect(page.getByText('Aktivitet', { exact: false })).toBeVisible({ timeout: 8000 });
    // De fire mocked events
    await expect(page.getByText('Post redigert i dashboard')).toBeVisible();
    await expect(page.getByText('Klient godkjente post')).toBeVisible();
    await expect(page.getByText(/Plan-versjon v2 lagret/)).toBeVisible();
    await expect(page.getByText(/Plan-versjon v1 lagret/)).toBeVisible();
  });

  test('klikk "Endre plan" kaller onOpenAdvancedEditor', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await expect(page.getByTestId('advanced-editor-opens')).toContainText('0');
    await page.getByRole('button', { name: 'Endre plan' }).click();
    await expect(page.getByTestId('advanced-editor-opens')).toContainText('1');
  });

  test('readOnly-modus skjuler "Endre plan", VersionPicker og post-edit-klikk', async ({ page }) => {
    await page.goto(`${HARNESS_URL}?readOnly=true`);
    await expect(page.getByTestId('marketing-plan-workspace')).toBeVisible({ timeout: 8000 });
    // Edit-knappen skal ikke finnes
    await expect(page.getByRole('button', { name: 'Endre plan' })).toHaveCount(0);
    // VersionPicker-knappen skal ikke finnes
    await expect(page.getByRole('button', { name: /v2.*Etter klient-justering/ })).toHaveCount(0);
    // Posts-tabellen rendres fortsatt
    await expect(page.getByTestId('post-row-post-1').getByText('Slik lager vi surdeigen på 48 timer')).toBeVisible();
    // Klikk på rad åpner IKKE dialog
    await page.getByTestId('post-row-post-1').click();
    await expect(page.getByText('Redigér post', { exact: false })).toHaveCount(0);
  });
});
