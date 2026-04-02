import { expect, test, type Page } from '@playwright/test';

const PUBLIC_ROUTES = ['/academy'];

const PROTECTED_ROUTES: string[] = [
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

const accessGatePattern =
  /Instruktorinnlogging kreves|Innlogging kreves|Studentinnlogging kreves/i;
const academyValidationPattern =
  /Verifiserer Academy-tilgang|Verifiserer studenttilgang/i;

const readBodyText = async (page: Page): Promise<string> =>
  (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();

async function waitForBodyTextMatch(
  page: Page,
  predicate: (text: string) => boolean,
  timeoutMs = 30_000,
): Promise<string> {
  const startedAt = Date.now();
  let lastBodyText = '';

  while (Date.now() - startedAt < timeoutMs) {
    lastBodyText = await readBodyText(page);
    if (predicate(lastBodyText)) {
      return lastBodyText;
    }
    await page.waitForTimeout(300);
  }

  throw new Error(`Timed out waiting for Academy route state. Last body: ${lastBodyText.slice(0, 240)}`);
}

test.describe('Academy Full Smoke', () => {
  test('academy landing remains public', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message || String(error));
    });

    for (const route of PUBLIC_ROUTES) {
      const errorStartIndex = pageErrors.length;
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForBodyTextMatch(
        page,
        (text) => text.length > 20 && !academyValidationPattern.test(text),
        25_000,
      );

      await expect(page.getByText(/CreatorHub Academy|Academy/i).first()).toBeVisible({
        timeout: 20_000,
      });

      const runtimeErrors = pageErrors
        .slice(errorStartIndex)
        .filter((message) => !isIgnorablePageError(message));
      expect(runtimeErrors, `${route} runtime errors`).toEqual([]);
    }
  });

  test('protected academy routes stay gated without a verified session', async ({ page }) => {
    test.setTimeout(12 * 60 * 1000);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message || String(error));
    });

    const failures: string[] = [];

    for (const route of PROTECTED_ROUTES) {
      const errorStartIndex = pageErrors.length;

      try {
        await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        const bodyText = await waitForBodyTextMatch(
          page,
          (text) => accessGatePattern.test(text) && !academyValidationPattern.test(text),
          25_000,
        );
        if (!accessGatePattern.test(bodyText)) {
          failures.push(`${route} -> missing access gate copy`);
        }
      } catch (error) {
        failures.push(
          `${route} -> navigation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      const runtimeErrors = pageErrors
        .slice(errorStartIndex)
        .filter((message) => !isIgnorablePageError(message));
      if (runtimeErrors.length > 0) {
        failures.push(`${route} -> pageerror: ${runtimeErrors.join(' | ')}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Academy access smoke failed (${failures.length} issues):\n${failures.join('\n')}`,
      );
    }
  });
});
