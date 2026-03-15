import { test } from '@playwright/test';

const ACADEMY_ROUTES: string[] = [
  '/academy',
  '/academy-dashboard',
  '/academy/course-creator',
  '/academy/module-manager',
  '/academy/annotation-editor',
  '/academy/quiz-manager',
  '/academy/assignments',
  '/academy/assignment-manager',
  '/academy/enrollment',
  '/academy/student-enrollment',
  '/academy/student-dashboard',
  '/academy/dashboard/student',
  '/academy/analytics',
  '/academy/canalytics',
  '/academy/curriculum',
  '/academy/curriculum-manager',
  '/academy/lesson-editor',
  '/academy/lessons',
  '/academy/courses',
  '/academy/modules',
  '/academy/cohort-settings',
  '/academy/cohorts',
  '/academy/media',
  '/academy/library',
  '/academy/asset-browser',
  '/academy/instructors',
  '/academy/instructor-admin',
  '/academy/video-player',
  '/academy/player-studio',
  '/academy/assessments',
  '/academy/monetization',
  '/academy/cta-overlay',
  '/academy/lower-thirds',
  '/academy/presentation-overlay',
  '/academy/ppt-overlay',
  '/academy/messages',
  '/academy/settings',
  '/academy/tools',
];

const isIgnorablePageError = (message: string): boolean => {
  const normalized = String(message || '');
  return (
    /ResizeObserver loop limit exceeded/i.test(normalized) ||
    /Non-Error promise rejection captured/i.test(normalized)
  );
};

test.describe('Academy Full Smoke', () => {
  test('all academy routes render without runtime crashes', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message || String(error));
    });

    const failures: string[] = [];

    for (const route of ACADEMY_ROUTES) {
      const errorStartIndex = pageErrors.length;

      try {
        await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      } catch (error) {
        failures.push(`${route} -> navigation failed: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      await page.waitForTimeout(1500);

      const runtimeErrors = pageErrors
        .slice(errorStartIndex)
        .filter((message) => !isIgnorablePageError(message));
      if (runtimeErrors.length > 0) {
        failures.push(`${route} -> pageerror: ${runtimeErrors.join(' | ')}`);
      }

      const metrics = await page.evaluate(() => {
        const bodyText = document?.body?.innerText || '';
        return {
          path: window.location.pathname,
          nodeCount: document.querySelectorAll('*').length,
          bodyTextLength: bodyText.trim().length,
          hasRoot: Boolean(document.getElementById('root')),
        };
      });

      if (!metrics.hasRoot) {
        failures.push(`${route} -> missing #root`);
      }
      if (!metrics.path.includes('academy')) {
        failures.push(`${route} -> unexpected path ${metrics.path}`);
      }
      if (metrics.nodeCount < 40) {
        failures.push(`${route} -> too few DOM nodes (${metrics.nodeCount})`);
      }
      if (metrics.bodyTextLength < 20) {
        failures.push(`${route} -> too little visible text (${metrics.bodyTextLength})`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Academy full smoke failed (${failures.length} issues):\n${failures.join('\n')}`);
    }
  });
});
