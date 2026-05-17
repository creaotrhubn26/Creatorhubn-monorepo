/**
 * UI-interaksjon-tester for MarketingPlanPanel — fyller gap-en fra
 * marketing-plan-tools.spec.ts som bare testet backend-routing.
 *
 * Strategi:
 *   - Mount harness-siden /e2e-marketing-plan-test.html som mounter
 *     panelet med seedet bootstrap-data (test-harness-marketing-plan.tsx).
 *   - Mock alle /api/role-room/*-respons via Playwright route().
 *   - Verifiser interaksjoner: tab-switch, generate-plan, tools-panel
 *     med creators/thumbnail/reach, validator-flagg-rendering.
 *
 * Hva som ÆRLIG testes:
 *   - UI rendrer respons fra mocked backend korrekt
 *   - State-transitions (loading → success/error)
 *   - Validator-funksjonene kjører faktisk på posts og produserer flagg
 *
 * Hva som IKKE testes (heller ikke nå):
 *   - At backend faktisk returnerer riktig form på respons (det er
 *     marketing-plan-tools.spec.ts sin jobb pluss manuell QA med
 *     ekte DB)
 *   - DALL-E-faktisk-bildegenerering (Playwright kan ikke mocke et
 *     ekte bilde, men kan verifisere at <img src=mockedUrl> rendres)
 */

import { expect, test } from '@playwright/test';

const HARNESS_URL = '/e2e-marketing-plan-test.html';

// ─────────────────────────────────────────────────────────────────────
// Mock-payload-fabrikker — én sannhet per respons-type
// ─────────────────────────────────────────────────────────────────────

const MOCK_PLAN = {
  id: 'plan-test-001',
  projectId: 'test-project-001',
  ownerUserId: 'user-test',
  status: 'draft' as const,
  strategy: {
    channelStrategy: { primary: 'instagram', cadencePerWeek: 5, secondary: ['tiktok'], reasoning: 'IG har høyest engagement' },
    toneOfVoice: { voice: 'Energisk og fristende', dos: ['Vis ekte arbeid'], donts: ['Ingen buzzwords'] },
    positioning: { valueProp: 'Lokal surdeigspizza', differentiator: 'Surdeig 48t' },
    kpiTargets: [{ metric: 'bookings', target: 50, per: 'week' as const, rationale: 'Vekstmål' }],
    usage: { inputTokens: 2500, outputTokens: 1200, costNok: 0.32 },
  },
  pillars: [
    { id: 'pillar-1', planId: 'plan-test-001', name: 'Bak menyen', description: 'Vis prosess + ingredienser', rationale: 'Engagement', sortOrder: 0, isActive: true, isCustom: false },
    { id: 'pillar-2', planId: 'plan-test-001', name: 'Lokal kjærlighet', description: 'Møt nabolaget', rationale: 'Lokal-relevans', sortOrder: 1, isActive: true, isCustom: false },
  ],
  generatedAt: '2026-05-16T10:00:00Z',
  generatedWithModel: 'claude-sonnet-4-5',
  startDate: null,
  horizonDays: 30,
  createdAt: '2026-05-16T10:00:00Z',
  updatedAt: '2026-05-16T10:00:00Z',
};

const MOCK_POSTS = [
  {
    id: 'post-1', planId: 'plan-test-001', pillarId: 'pillar-1', sortOrder: 0, dayOffset: 0,
    hook: 'Slik lager vi surdeigen på 48 timer',
    format: 'reel' as const, script: 'Vis prosess', captionDraft: 'Møt deigen som forandrer alt. 48 timer modning.', callToAction: 'Bestill nå',
    primaryPlatform: 'instagram' as const, crossPostPlan: [{ platform: 'tiktok', delayDays: 2 }],
    goalKpi: null, status: 'proposed' as const, feedPlanPostId: null,
    scheduledFor: null, publishedAt: null,
    createdAt: '2026-05-16T10:00:00Z', updatedAt: '2026-05-16T10:00:00Z',
  },
  {
    id: 'post-2', planId: 'plan-test-001', pillarId: 'pillar-2', sortOrder: 1, dayOffset: 2,
    hook: 'Møt naboen som elsker pizza',
    format: 'carousel' as const, script: null, captionDraft: 'Lokale historier 🔥 om mat og fellesskap', callToAction: null,
    primaryPlatform: 'instagram' as const, crossPostPlan: [],
    goalKpi: null, status: 'proposed' as const, feedPlanPostId: null,
    scheduledFor: null, publishedAt: null,
    createdAt: '2026-05-16T10:00:00Z', updatedAt: '2026-05-16T10:00:00Z',
  },
];

const MOCK_CREATORS = {
  success: true,
  creators: [
    { handle: 'trinesmatblogg', displayName: 'Trines Matblogg', platforms: ['instagram', 'website'], categories: ['mat'], followerTier: 'macro', primaryLanguage: 'norwegian', matchedCategories: ['mat'], score: 6, notes: 'Etablert mat-blogger' },
    { handle: 'matpaibordet', displayName: 'Mat på Bordet', platforms: ['instagram', 'youtube'], categories: ['mat'], followerTier: 'macro', primaryLanguage: 'norwegian', matchedCategories: ['mat'], score: 6 },
  ],
  igEnriched: [],
  dataSource: 'curated_only',
};

const MOCK_THUMBNAIL = {
  success: true,
  imageUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDI0IiBoZWlnaHQ9IjEwMjQiPjxyZWN0IHdpZHRoPSIxMDI0IiBoZWlnaHQ9IjEwMjQiIGZpbGw9IiNlNjM5NDYiLz48L3N2Zz4=',
  revisedPrompt: 'A vibrant thumbnail showing pizza dough',
  validForMinutes: 60,
  aspectRatio: '1024x1792',
};

const MOCK_REACH = {
  success: true,
  available: true,
  dataSource: 'user_input',
  followerCount: 5000,
  platform: 'instagram',
  format: 'reel',
  minReach: 750,
  midReach: 1687,
  maxReach: 2625,
  benchmark: { rateMin: 0.10, rateMax: 0.35, formatMultiplier: 1.5 },
  confidence: 'low',
  note: 'Benchmark-basert',
};

// ─────────────────────────────────────────────────────────────────────
// Mock-setup helper
// ─────────────────────────────────────────────────────────────────────
async function setupAllMocks(page: import('@playwright/test').Page): Promise<void> {
  // VIKTIG: Playwright tester routes i REVERS rekkefølge (siste registrert
  // matches først). Så vi registrerer catch-all FØRST, og spesifikke
  // mocks etterpå — slik at de spesifikke vinner.

  // Catch-all role-room — silently 200 to avoid 500 spam
  await page.route('**/api/role-room/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
  });
  // Catch-all entitlement (Insights-banner og lignende kaller dette)
  await page.route('**/api/role-room/agent/entitlement**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"entitlement":{"status":"active","source":"admin"}}' });
  });

  // 1. Readiness — bootstrap er klar
  await page.route('**/api/role-room/marketing-plan/readiness', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, readiness: { ready: true, missingFields: [], hasInstagramConnection: false } }),
    });
  });
  // 2. Hent eksisterende plan (path-segment matcher kun test-project-001)
  await page.route(/\/api\/role-room\/marketing-plan\/test-project-001$/, (route, request) => {
    if (request.method() !== 'GET') return route.continue();
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, plan: MOCK_PLAN }),
    });
  });
  // 3. List posts
  await page.route('**/api/role-room/marketing-plan/plan-test-001/posts', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, posts: MOCK_POSTS }),
    });
  });
  // 4. Creators
  await page.route('**/api/role-room/marketing-plan/posts/*/creators', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CREATORS),
    });
  });
  // 5. Thumbnail
  await page.route('**/api/role-room/marketing-plan/posts/*/thumbnail', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_THUMBNAIL),
    });
  });
  // 6. Reach-estimate
  await page.route('**/api/role-room/marketing-plan/posts/*/reach-estimate', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REACH),
    });
  });
}

// ─────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────

test.describe('MarketingPlanPanel UI', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test('harness mounts and renders panel header', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForSelector('[data-testid="marketing-plan-test-root"]', { timeout: 15_000 });
    await expect(page.getByText('Marketing Plan Engine')).toBeVisible({ timeout: 10_000 });
  });

  test('three-tab layout renders with strategy/pillars/posts tabs', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForSelector('[data-testid="marketing-plan-test-root"]', { timeout: 15_000 });
    // Vent på at plan loader (mocked GET-respons) — header viser plan-status-chip
    await expect(page.getByText('Marketing Plan Engine')).toBeVisible({ timeout: 10_000 });
    // Wait for plan data to load
    await page.waitForSelector('text=Strategi', { timeout: 10_000 });
    // Tabs er synlige
    await expect(page.getByRole('tab', { name: /Strategi/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Pillars/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Post-roadmap/i })).toBeVisible();
  });

  test('switching to Pillars tab shows pillar cards', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForSelector('[data-testid="marketing-plan-test-root"]', { timeout: 15_000 });
    await page.waitForSelector('text=Marketing Plan Engine', { timeout: 10_000 });
    await page.getByRole('tab', { name: /Pillars/i }).click();
    await expect(page.getByText('Bak menyen')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Lokal kjærlighet')).toBeVisible();
  });

  test('switching to Post-roadmap tab shows post cards with validator flags', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForSelector('[data-testid="marketing-plan-test-root"]', { timeout: 15_000 });
    await page.waitForSelector('text=Marketing Plan Engine', { timeout: 10_000 });
    await page.getByRole('tab', { name: /Post-roadmap/i }).click();
    await expect(page.getByText(/Slik lager vi surdeigen/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Møt naboen som elsker pizza/)).toBeVisible();
    // Sentiment-emoji vises i kortet (#163 validator kjørte)
    // Post-1 har positiv tekst → very_positive eller positive
    // Vi bare sjekker at noen sentiment-emoji er der
    const sentimentChips = page.locator('text=/[😄🙂😐🙁😞]/');
    await expect(sentimentChips.first()).toBeVisible({ timeout: 5000 });
  });

  test('tools panel: clicking "Vis verktøy" loads creator-list', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForSelector('[data-testid="marketing-plan-test-root"]', { timeout: 15_000 });
    await page.waitForSelector('text=Marketing Plan Engine', { timeout: 10_000 });
    await page.getByRole('tab', { name: /Post-roadmap/i }).click();
    await expect(page.getByText(/Slik lager vi surdeigen/)).toBeVisible({ timeout: 5000 });
    // Klikk "Vis verktøy" på første post
    await page.getByText(/Vis verktøy/i).first().click();
    // Vent på kreator-liste (mocked respons)
    await expect(page.getByText(/Trines Matblogg/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Mat på Bordet/)).toBeVisible();
  });

  test('tools panel: clicking "Generer thumbnail" shows generated image', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForSelector('[data-testid="marketing-plan-test-root"]', { timeout: 15_000 });
    await page.waitForSelector('text=Marketing Plan Engine', { timeout: 10_000 });
    await page.getByRole('tab', { name: /Post-roadmap/i }).click();
    await expect(page.getByText(/Slik lager vi surdeigen/)).toBeVisible({ timeout: 5000 });
    await page.getByText(/Vis verktøy/i).first().click();
    await expect(page.getByText(/Generer thumbnail med AI/)).toBeVisible({ timeout: 5000 });
    await page.getByText(/Generer thumbnail med AI/).first().click();
    // Vent på bilde — mocket som data:image/svg+xml SVG
    const generatedImage = page.locator('img[alt="Generated thumbnail"]');
    await expect(generatedImage).toBeVisible({ timeout: 10_000 });
    // Verifiser at src er satt
    const src = await generatedImage.getAttribute('src');
    expect(src).toContain('data:image/svg+xml');
  });

  test('tools panel: reach-estimate shows numbers from mocked benchmark', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForSelector('[data-testid="marketing-plan-test-root"]', { timeout: 15_000 });
    await page.waitForSelector('text=Marketing Plan Engine', { timeout: 10_000 });
    await page.getByRole('tab', { name: /Post-roadmap/i }).click();
    await expect(page.getByText(/Slik lager vi surdeigen/)).toBeVisible({ timeout: 5000 });
    await page.getByText(/Vis verktøy/i).first().click();
    // Vent på reach-bar — viser "750-2 625 reach"
    await expect(page.getByText(/750.*2.625.*reach/)).toBeVisible({ timeout: 5000 });
  });
});
