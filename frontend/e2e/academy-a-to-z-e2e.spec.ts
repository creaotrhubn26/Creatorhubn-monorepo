import { expect, test, type Page } from '@playwright/test';

const isIgnorablePageError = (message: string): boolean => {
  const normalized = String(message || '');
  return (
    /ResizeObserver loop limit exceeded/i.test(normalized) ||
    /Non-Error promise rejection captured/i.test(normalized)
  );
};

const clickFirstVisibleButton = async (page: Page, name: RegExp): Promise<boolean> => {
  const button = page.getByRole('button', { name }).first();
  if ((await button.count()) === 0) return false;
  if (!(await button.isVisible().catch(() => false))) return false;
  if (await button.isDisabled().catch(() => false)) return false;
  await button.click();
  return true;
};

const waitForAcademyPageReady = async (page: Page): Promise<void> => {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  const textLength = await page.evaluate(() => (document.body?.innerText || '').trim().length);
  expect(textLength).toBeGreaterThan(20);
};

test.describe('Academy A-Z E2E', () => {
  test('core academy tools are interactive end-to-end', async ({ page }) => {
    test.setTimeout(12 * 60 * 1000);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message || String(error));
    });

    const tools: Array<{
      route: string;
      run: () => Promise<void>;
    }> = [
      {
        route: '/academy/curriculum',
        run: async () => {
          await expect(
            page.getByRole('button', { name: /Opprett ny kompetanse|Create new competency/i }).first(),
          ).toBeVisible({ timeout: 40_000 });
          await expect(
            page.getByText(/AI-guidet kompetanseintervju|AI-guided competency interview/i).first(),
          ).toBeVisible({ timeout: 40_000 });

          const curriculumAssistantResponsePromise = page.waitForResponse((response) => {
            return (
              response.url().includes('/api/academy/curriculum/foundation-assistant') &&
              response.request().method() === 'POST' &&
              response.status() === 200
            );
          }, { timeout: 90_000 });

          const assistantInput = page.getByLabel(/Svar|Answer/i).first();
          if ((await assistantInput.count()) > 0 && (await assistantInput.isVisible().catch(() => false))) {
            await assistantInput.fill('Salg');
            await clickFirstVisibleButton(page, /Neste spørsmål|Next question/i);
            await curriculumAssistantResponsePromise;
          }

          const competencyInput = page.getByPlaceholder(
            /Skriv navn pa ny kompetanse|Type new competency name/i,
          ).first();
          if ((await competencyInput.count()) > 0 && (await competencyInput.isVisible().catch(() => false))) {
            await competencyInput.fill('E2E Kompetanse A-Z');
            await clickFirstVisibleButton(page, /Legg til kompetanse|Add competency/i);
          }
        },
      },
      {
        route: '/academy/instructors',
        run: async () => {
          await expect(page.getByRole('button', { name: /Ny instruktør|New instructor/i }).first()).toBeVisible({
            timeout: 40_000,
          });
          await clickFirstVisibleButton(page, /Ny instruktør|New instructor/i);
          const nameInput = page.getByLabel(/Navn|Name/i).first();
          if ((await nameInput.count()) > 0 && (await nameInput.isVisible().catch(() => false))) {
            await nameInput.fill('E2E Instruktør');
            await clickFirstVisibleButton(page, /Opprett instruktør|Create instructor|Lagre endringer|Save changes/i);
          }
        },
      },
      {
        route: '/academy/annotation-editor',
        run: async () => {
          await expect(page.getByRole('button', { name: /Auto-fiks|Auto-fix/i }).first()).toBeVisible({
            timeout: 40_000,
          });
          await clickFirstVisibleButton(page, /Rediger \\(E\\)|Edit \\(E\\)/i);
          await clickFirstVisibleButton(page, /Auto-fiks|Auto-fix/i);
          await clickFirstVisibleButton(page, /Lagre|Save/i);
        },
      },
      {
        route: '/academy/quiz-manager',
        run: async () => {
          await expect(page.getByRole('button', { name: /Legg til spørsmål|Add question/i }).first()).toBeVisible({
            timeout: 40_000,
          });
          await clickFirstVisibleButton(page, /Legg til spørsmål|Add question/i);
          await clickFirstVisibleButton(page, /Auto-fiks|Auto-fix/i);
          await clickFirstVisibleButton(page, /Lagre|Save/i);
        },
      },
      {
        route: '/academy/cta-overlay',
        run: async () => {
          await expect(page.getByRole('button', { name: /Ny CTA|New CTA/i }).first()).toBeVisible({
            timeout: 40_000,
          });
          await clickFirstVisibleButton(page, /Ny CTA|New CTA/i);
          await clickFirstVisibleButton(page, /Auto-fiks|Auto-fix/i);
          await clickFirstVisibleButton(page, /Lagre|Save/i);
        },
      },
      {
        route: '/academy/lower-thirds',
        run: async () => {
          await expect(page.getByRole('button', { name: /Ny lower third|New Lower Third/i }).first()).toBeVisible({
            timeout: 40_000,
          });
          await clickFirstVisibleButton(page, /Ny lower third|New Lower Third/i);
          await clickFirstVisibleButton(page, /Auto-fiks|Auto-fix/i);
          await clickFirstVisibleButton(page, /Lagre|Save/i);
        },
      },
      {
        route: '/academy/presentation-overlay',
        run: async () => {
          await expect(page.getByRole('button', { name: /Ny presentasjon|New deck/i }).first()).toBeVisible({
            timeout: 40_000,
          });
          await clickFirstVisibleButton(page, /Ny presentasjon|New deck/i);

          const searchInput = page.getByPlaceholder(
            /Sok i presentasjon og slides|Search presentations and slides/i,
          );
          await expect(searchInput).toBeVisible({ timeout: 20_000 });

          const semanticResponsePromise = page.waitForResponse((response) => {
            return (
              response.url().includes('/api/academy/presentation/semantic-search') &&
              response.request().method() === 'POST' &&
              response.status() === 200
            );
          }, { timeout: 90_000 });

          await searchInput.fill('academy a-z e2e milestone plan');
          await semanticResponsePromise;

          const designPlanResponsePromise = page.waitForResponse((response) => {
            return (
              response.url().includes('/api/academy/presentation/design-plan') &&
              response.request().method() === 'POST' &&
              response.status() === 200
            );
          }, { timeout: 120_000 });

          await clickFirstVisibleButton(page, /Generer plan|Generate plan/i);
          await designPlanResponsePromise;
          await expect(page.getByRole('button', { name: /Apply all/i }).first()).toBeVisible({
            timeout: 20_000,
          });
        },
      },
    ];

    const failures: string[] = [];
    for (const tool of tools) {
      const errorStartIndex = pageErrors.length;
      try {
        await page.goto(tool.route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await waitForAcademyPageReady(page);
        await tool.run();
      } catch (error) {
        failures.push(
          `${tool.route} -> ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const runtimeErrors = pageErrors
        .slice(errorStartIndex)
        .filter((message) => !isIgnorablePageError(message));
      if (runtimeErrors.length > 0) {
        failures.push(`${tool.route} -> pageerror: ${runtimeErrors.join(' | ')}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Academy A-Z E2E failed (${failures.length} issues):\n${failures.join('\n')}`);
    }
  });
});
