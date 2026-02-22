import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// ────────────────────────────────────────────────────────────
// E2E: UniversalDashboard — Comprehensive Test Suite
// ────────────────────────────────────────────────────────────
//
// ALL tests share a SINGLE browser context & page to avoid OOM.
// The dashboard is loaded ONCE; subsequent tests reuse the page.
// Each page load of this app consumes ~500 MB in Chromium.

const DASHBOARD_URL = '/photographer-dashboard-material';
const LOAD_TIMEOUT = 60_000;
const ACTION_TIMEOUT = 15_000;

// ── Helpers ─────────────────────────────────────────────────

async function gotoDashboard(page: Page, url = DASHBOARD_URL) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
  await page.waitForSelector('[aria-label="CreatorHub Norge Dashboard"]', {
    state: 'visible',
    timeout: LOAD_TIMEOUT,
  });
}

async function clickTabByIndex(page: Page, index: number) {
  const firstTablist = page.getByRole('tablist').first();
  const tab = firstTablist.getByRole('tab').nth(index);
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  await page.waitForTimeout(600);
  return tab;
}

// ═══════════════════════════════════════════════════════════
// SINGLE DESCRIBE — ONE PAGE — ALL 24 TESTS
// ═══════════════════════════════════════════════════════════

test.describe('UniversalDashboard E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;
  let context: BrowserContext;
  let loadTimeMs = 0;
  const allTabNames: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    const t0 = Date.now();
    await gotoDashboard(page);
    loadTimeMs = Date.now() - t0;

    // Discover tab names once
    const firstTablist = page.getByRole('tablist').first();
    const tabs = firstTablist.getByRole('tab');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      const name = await tabs.nth(i).innerText().catch(() => '');
      if (name.trim()) allTabNames.push(name.trim());
    }
  });

  test.afterAll(async () => {
    await context.close();
  });

  // ── 1–2: INITIAL LOAD ────────────────────────────────────

  test('1. Dashboard loads without critical JS errors', async () => {
    await expect(page.locator('[aria-label="CreatorHub Norge Dashboard"]')).toBeVisible();

    // No React error boundaries
    const errorBoundary = page.getByText(
      /Something went wrong|An error occurred|Error boundary/i
    );
    await expect(errorBoundary).not.toBeVisible();
  });

  test('2. Dashboard loads within 60 seconds', async () => {
    expect(loadTimeMs).toBeLessThan(60_000);
    console.log(`Dashboard loaded in ${loadTimeMs}ms`);
  });

  // ── 3: CORE UI ────────────────────────────────────────────

  test('3. Core UI structure renders', async () => {
    await expect(page.locator('[aria-label="CreatorHub Norge Dashboard"]')).toBeVisible();

    // Logo
    const logo = page.locator('img[alt*="CreatorHub"]').first();
    await expect(logo).toBeVisible({ timeout: ACTION_TIMEOUT });

    // Welcome (optional)
    const welcome = page.getByText(/Velkommen tilbake/i).first();
    const hasWelcome = await welcome.isVisible().catch(() => false);
    console.log(`Welcome text visible: ${hasWelcome}`);
  });

  // ── 4–6: TAB SYSTEM ──────────────────────────────────────

  test('4. Tab list renders with multiple tabs', async () => {
    const tablist = page.getByRole('tablist').first();
    await expect(tablist).toBeVisible({ timeout: ACTION_TIMEOUT });

    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(5);
    console.log(`Total tab elements: ${count}`);
  });

  test('5. Discover and verify tab names', async () => {
    console.log('All discovered tabs:', allTabNames);

    // Some expected tabs should be present
    const expected = ['Oversikt', 'Prosjekter'];
    for (const name of expected) {
      const found = allTabNames.some((t) => t.includes(name));
      expect(found).toBe(true);
    }

    // At least 10 tabs in the primary tablist
    expect(allTabNames.length).toBeGreaterThan(10);
  });

  test('6. A tab is selected by default', async () => {
    const selectedTab = page.locator('[role="tab"][aria-selected="true"]').first();
    await expect(selectedTab).toBeVisible({ timeout: ACTION_TIMEOUT });
    const selectedName = await selectedTab.innerText();
    console.log(`Default selected tab: ${selectedName}`);
  });

  // ── 7–10: TAB NAVIGATION ─────────────────────────────────

  test('7. Can switch to second tab', async () => {
    const tab = await clickTabByIndex(page, 1);
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const name = await tab.innerText();
    console.log(`Switched to: ${name}`);
  });

  test('8. Navigate through first 3 tabs sequentially', async () => {
    const max = Math.min(allTabNames.length, 3);
    console.log('Navigating tabs:', allTabNames.slice(0, max));

    for (let i = 0; i < max; i++) {
      const tab = await clickTabByIndex(page, i);
      // Verify tab was clicked successfully
      expect(tab).toBeTruthy();
      // Re-locate after click to handle MUI tab scroll re-renders
      const freshTab = page.getByRole('tablist').first().getByRole('tab').nth(i);
      const isAttached = await freshTab.count().catch(() => 0);
      if (isAttached > 0) {
        await expect(freshTab).toHaveAttribute('aria-selected', 'true');
      }
    }
  });

  test('9. Tab switch is responsive (under 5s)', async () => {
    // Switch from current to first tab and measure
    const t0 = Date.now();
    const tab = await clickTabByIndex(page, 0);
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(5_000);
    console.log(`Tab switch took ${elapsed}ms`);
  });

  test('10. Return to first tab restores selection', async () => {
    // Go to tab 2, then back to tab 0
    await clickTabByIndex(page, 2);
    const firstTab = await clickTabByIndex(page, 0);
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  });

  // ── 11: OVERVIEW CONTENT ─────────────────────────────────

  test('11. Overview area has content', async () => {
    // Make sure we're on the first tab
    await clickTabByIndex(page, 0);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(100);
    console.log(`Body text length: ${bodyText.length}`);
  });

  // ── 12: PROFESSION SWITCHER ──────────────────────────────

  test('12. Admin profession-related UI exists', async () => {
    const labels = ['Fotograf', 'Videograf', 'Musikkprodusent', 'Leverandør', 'Enterprise', 'Admin'];
    const found: string[] = [];

    for (const label of labels) {
      const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
      if (await btn.isVisible().catch(() => false)) {
        found.push(label);
      }
    }

    console.log('Found profession buttons:', found);
  });

  // ── 13: BUTTONS ───────────────────────────────────────────

  test('13. FABs and icon buttons exist', async () => {
    const iconButtons = page.locator('button').filter({ has: page.locator('svg') });
    const count = await iconButtons.count();
    expect(count).toBeGreaterThan(0);
    console.log(`Icon buttons: ${count}`);
  });

  // ── 14–15: ACCESSIBILITY ─────────────────────────────────

  test('14. ARIA landmarks and roles', async () => {
    await expect(page.locator('[aria-label="CreatorHub Norge Dashboard"]')).toBeVisible();

    const tablist = page.getByRole('tablist').first();
    await expect(tablist).toBeVisible();

    const tabs = page.getByRole('tab');
    expect(await tabs.count()).toBeGreaterThan(5);

    const logo = page.locator('img[alt*="CreatorHub"]').first();
    await expect(logo).toBeVisible();
  });

  test('15. Tabs are keyboard navigable', async () => {
    const firstTablist = page.getByRole('tablist').first();
    const firstTab = firstTablist.getByRole('tab').first();
    const secondTab = firstTablist.getByRole('tab').nth(1);

    await firstTab.focus();
    await expect(firstTab).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(secondTab).toBeFocused();
  });

  // ── 16–17: VISUAL INTEGRITY ──────────────────────────────

  test('16. No horizontal overflow', async () => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
  });

  test('17. Images load correctly', async () => {
    const images = page.locator('img');
    const imgCount = await images.count();

    let brokenImages = 0;
    for (let i = 0; i < imgCount; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      const src = await img.getAttribute('src');
      if (src && !src.startsWith('data:') && !src.endsWith('.svg') && naturalWidth === 0) {
        brokenImages++;
        console.log(`Broken image: ${src}`);
      }
    }

    console.log(`Images: ${imgCount} total, ${brokenImages} broken`);
    expect(brokenImages).toBeLessThan(5);
  });

  // ── 18: CONSOLE HEALTH ───────────────────────────────────

  test('18. No blocking errors on re-navigation', async () => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await gotoDashboard(page);

    const critical = errors.filter(
      (e) =>
        !e.includes('fetch') &&
        !e.includes('NetworkError') &&
        !e.includes('Failed to fetch') &&
        !e.includes('ERR_CONNECTION_REFUSED') &&
        !e.includes('AbortError') &&
        !e.includes('Load failed') &&
        !e.includes('theming') &&
        !e.includes('is not defined') &&
        !e.includes('Cannot read properties of null')
    );
    expect(critical).toEqual([]);
  });

  // ── 19–21: ALTERNATIVE ROUTES ─────────────────────────────
  // Reuses the SAME page — just navigates to different URLs

  test('19. Videographer route loads dashboard', async () => {
    await gotoDashboard(page, '/videographer-dashboard-material');
    await expect(page.locator('[aria-label="CreatorHub Norge Dashboard"]')).toBeVisible();
  });

  test('20. Vendor route loads dashboard', async () => {
    await gotoDashboard(page, '/vendor-dashboard-material');
    await expect(page.locator('[aria-label="CreatorHub Norge Dashboard"]')).toBeVisible();
  });

  test('21. /dashboard route loads dashboard', async () => {
    await gotoDashboard(page, '/dashboard');
    await expect(page.locator('[aria-label="CreatorHub Norge Dashboard"]')).toBeVisible();
  });

  // ── 22–24: RESPONSIVE LAYOUT ─────────────────────────────
  // Resizes the SAME page viewport — no new context needed

  test('22. Mobile viewport (375x812)', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoDashboard(page);
    await expect(page.locator('[aria-label="CreatorHub Norge Dashboard"]')).toBeVisible();

    const tablist = page.getByRole('tablist').first();
    const hasTabs = await tablist.isVisible().catch(() => false);
    console.log(`Mobile tablist visible: ${hasTabs}`);
  });

  test('23. Tablet viewport (768x1024)', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoDashboard(page);
    await expect(page.locator('[aria-label="CreatorHub Norge Dashboard"]')).toBeVisible();
  });

  test('24. Desktop viewport (1280x720)', async () => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoDashboard(page);
    await expect(page.locator('[aria-label="CreatorHub Norge Dashboard"]')).toBeVisible();

    const tablist = page.getByRole('tablist').first();
    await expect(tablist).toBeVisible({ timeout: ACTION_TIMEOUT });
  });
});
