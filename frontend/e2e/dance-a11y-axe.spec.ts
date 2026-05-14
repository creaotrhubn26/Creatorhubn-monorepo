/**
 * G1 — A11y røyktest med axe-core på alle major dance-tabs.
 *
 * Krever: npm i -D @axe-core/playwright
 *
 * Failing-policy: vi feiler kun på `serious` og `critical` violations —
 * `moderate` / `minor` logges men gjør ikke jobben rød. Dette holder loven
 * grønn samtidig som vi får en synlig backlog av lavt-alvorlige issues.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';

// Lazy import — @axe-core/playwright er en optional dev-dep. Hvis ikke
// installert, skip hele specen i stedet for å crashe test-listingen.
let AxeBuilder: typeof import('@axe-core/playwright').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AxeBuilder = require('@axe-core/playwright').default;
} catch {
  AxeBuilder = null;
}
test.skip(AxeBuilder === null, '@axe-core/playwright ikke installert — kjør npm i -D @axe-core/playwright');

const TABS = ['dashboard', 'pieces', 'classes', 'students', 'video', 'team', 'pricing'];

test.describe('dance — a11y axe smoke', () => {
  test.beforeEach(async ({ page }) => {
    await setupDanceTest(page);
  });

  for (const tab of TABS) {
    test(`ingen serious/critical violations på tab ${tab}`, async ({ page }) => {
      await switchDanceTab(page, tab);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );

      if (blocking.length > 0) {
        console.log('A11y violations:');
        for (const v of blocking) {
          console.log(`  ${v.impact}: ${v.id} — ${v.help} (${v.nodes.length} noder)`);
        }
      }
      expect(blocking, `A11y violations on tab ${tab}`).toHaveLength(0);
    });
  }
});
