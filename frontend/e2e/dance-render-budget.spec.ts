/**
 * H1 — DanceWorkspace initial mount budget p95 < 400ms.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest } from './helpers/danceSetup';

test.describe('dance — render budget', () => {
  test('initial workspace mount under 400ms p95 (5 runs)', async ({ page }) => {
    const samples: number[] = [];

    for (let i = 0; i < 5; i++) {
      await setupDanceTest(page);
      const t = await page.evaluate(() => {
        const entries = performance.getEntriesByType('paint') as PerformanceEntry[];
        const fcp = entries.find((e) => e.name === 'first-contentful-paint');
        return fcp?.startTime ?? performance.now();
      });
      samples.push(t);
      // Reset by navigating away
      await page.goto('about:blank');
    }

    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)] ?? samples[samples.length - 1];
    console.log('FCP samples:', samples, 'p95:', p95);
    expect(p95).toBeLessThan(400);
  });
});
