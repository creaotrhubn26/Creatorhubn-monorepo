import { test } from '@playwright/test';

type UxFlowResult = {
  flowId: string;
  route: string;
  goal: string;
  success: boolean;
  timeToGoalMs: number;
  clicks: number;
  fieldsEdited: number;
  interactiveCountAtStart: number;
  visibleToolbarActionsAtStart: number;
  pageErrors: string[];
  notes: string[];
};

const isIgnorablePageError = (message: string): boolean => {
  const normalized = String(message || '');
  return (
    /ResizeObserver loop limit exceeded/i.test(normalized) ||
    /Non-Error promise rejection captured/i.test(normalized)
  );
};

const countInteractiveElements = async (page: import('@playwright/test').Page): Promise<number> => {
  return page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll(
        'button, input, select, textarea, [role="button"], [contenteditable="true"], a[href]',
      ),
    );
    const visible = candidates.filter((element) => {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0'
      );
    });
    return visible.length;
  });
};

const countPrimaryToolbarActions = async (
  page: import('@playwright/test').Page,
): Promise<number> => {
  return page.evaluate(() => {
    const labels = ['Lagre', 'Save', 'Publiser', 'Publish', 'Forhåndsvis', 'Preview', 'Auto-fiks', 'Auto-fix'];
    const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
    return buttons.filter((button) => {
      const text = (button.innerText || '').trim();
      if (!text) return false;
      const matches = labels.some((label) => text.includes(label));
      if (!matches) return false;
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length;
  });
};

const clickIfReady = async (
  page: import('@playwright/test').Page,
  name: RegExp,
): Promise<boolean> => {
  const button = page.getByRole('button', { name }).first();
  if ((await button.count()) === 0) return false;
  if (!(await button.isVisible().catch(() => false))) return false;
  if (await button.isDisabled().catch(() => false)) return false;
  await button.click();
  return true;
};

const fillIfReady = async (
  locator: import('@playwright/test').Locator,
  value: string,
): Promise<boolean> => {
  if ((await locator.count()) === 0) return false;
  if (!(await locator.first().isVisible().catch(() => false))) return false;
  await locator.first().fill(value);
  return true;
};

test.describe('Academy UX Psychological Audit', () => {
  test('instructor workflows feel low-friction end-to-end', async ({ page }, testInfo) => {
    test.setTimeout(14 * 60 * 1000);

    const allPageErrors: string[] = [];
    page.on('pageerror', (error) => {
      allPageErrors.push(error.message || String(error));
    });

    const results: UxFlowResult[] = [];

    const runFlow = async (params: {
      flowId: string;
      route: string;
      goal: string;
      action: () => Promise<{ success: boolean; clicks: number; fieldsEdited: number; notes: string[] }>;
    }) => {
      const flowStartErrorCount = allPageErrors.length;
      const startTime = Date.now();
      const notes: string[] = [];
      let success = false;
      let clicks = 0;
      let fieldsEdited = 0;
      let interactiveCountAtStart = 0;
      let visibleToolbarActionsAtStart = 0;

      try {
        await page.goto(params.route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.waitForTimeout(1300);
        interactiveCountAtStart = await countInteractiveElements(page);
        visibleToolbarActionsAtStart = await countPrimaryToolbarActions(page);

        const actionResult = await params.action();
        success = actionResult.success;
        clicks = actionResult.clicks;
        fieldsEdited = actionResult.fieldsEdited;
        notes.push(...actionResult.notes);
      } catch (error) {
        notes.push(error instanceof Error ? error.message : String(error));
        success = false;
      }

      const flowPageErrors = allPageErrors
        .slice(flowStartErrorCount)
        .filter((entry) => !isIgnorablePageError(entry));

      const flowResult: UxFlowResult = {
        flowId: params.flowId,
        route: params.route,
        goal: params.goal,
        success,
        timeToGoalMs: Date.now() - startTime,
        clicks,
        fieldsEdited,
        interactiveCountAtStart,
        visibleToolbarActionsAtStart,
        pageErrors: flowPageErrors,
        notes,
      };
      results.push(flowResult);
    };

    await runFlow({
      flowId: 'curriculum_create_competency',
      route: '/academy/curriculum',
      goal: 'Opprette kompetanse',
      action: async () => {
        let clicks = 0;
        let fieldsEdited = 0;
        const notes: string[] = [];

        const created = await clickIfReady(page, /Opprett ny kompetanse|Create new competency/i);
        if (created) clicks += 1;

        const input = page.getByPlaceholder(
          /Skriv navn pa ny kompetanse|Type new competency name|Gi kompetansenavn/i,
        );
        if (await fillIfReady(input, 'UX Audit Kompetanse')) fieldsEdited += 1;

        const added = await clickIfReady(page, /Legg til kompetanse|Add competency/i);
        if (added) clicks += 1;

        const hasAnyCompetencyText = await page
          .getByText(/Kompetanse|Competenc/i)
          .first()
          .isVisible()
          .catch(() => false);
        if (!hasAnyCompetencyText) notes.push('Kompetanse-tekst ikke tydelig bekreftet i viewport.');

        return { success: created || added, clicks, fieldsEdited, notes };
      },
    });

    await runFlow({
      flowId: 'instructor_admin_create',
      route: '/academy/instructors',
      goal: 'Opprette instruktør',
      action: async () => {
        let clicks = 0;
        let fieldsEdited = 0;
        const notes: string[] = [];

        const opened = await clickIfReady(page, /Ny instruktør|New instructor/i);
        if (opened) clicks += 1;

        const nameInput = page.getByLabel(/Navn|Name/i).first();
        if (await fillIfReady(nameInput, 'UX Audit Instruktør')) fieldsEdited += 1;

        const bioInput = page.getByLabel(/Bio/i).first();
        if (await fillIfReady(bioInput, 'Instruktør for UX audit-scenario.')) fieldsEdited += 1;

        const saved = await clickIfReady(
          page,
          /Opprett instruktør|Create instructor|Lagre endringer|Save changes/i,
        );
        if (saved) clicks += 1;

        if (!saved) notes.push('Kunne ikke trigge lagring i instruktør-editor.');
        return { success: opened && saved, clicks, fieldsEdited, notes };
      },
    });

    await runFlow({
      flowId: 'annotation_add_save',
      route: '/academy/annotation-editor',
      goal: 'Legge til annotering og lagre',
      action: async () => {
        let clicks = 0;
        let fieldsEdited = 0;
        const notes: string[] = [];

        const added = await clickIfReady(page, /Legg til markør|Add Marker/i);
        if (added) clicks += 1;

        const titleInput = page.getByLabel(/Tittel|Title/i).first();
        if (await fillIfReady(titleInput, 'UX audit annotering')) fieldsEdited += 1;

        const saved = (await clickIfReady(page, /Lagre annotering|Save Annotation/i))
          || (await clickIfReady(page, /^Lagre$|^Save$/i));
        if (saved) clicks += 1;

        if (!added) notes.push('Ingen tydelig "add marker" trigger i aktiv kontekst.');
        if (!saved) notes.push('Lagre-handling for annotering var ikke tydelig tilgjengelig.');
        return { success: added && saved, clicks, fieldsEdited, notes };
      },
    });

    await runFlow({
      flowId: 'quiz_add_save',
      route: '/academy/quiz-manager',
      goal: 'Legge til quizspørsmål og lagre',
      action: async () => {
        let clicks = 0;
        let fieldsEdited = 0;
        const notes: string[] = [];

        const added = await clickIfReady(page, /Legg til spørsmål|Add question/i);
        if (added) clicks += 1;

        const promptInput = page.getByLabel(/Tittel|Prompt/i).first();
        if (await fillIfReady(promptInput, 'Hva er hovedmålet i dette kurset?')) fieldsEdited += 1;

        const saved = await clickIfReady(page, /^Lagre$|^Save$/i);
        if (saved) clicks += 1;

        if (!added) notes.push('Kunne ikke opprette spørsmål direkte.');
        return { success: added && saved, clicks, fieldsEdited, notes };
      },
    });

    await runFlow({
      flowId: 'cta_add_save',
      route: '/academy/cta-overlay',
      goal: 'Opprette CTA og lagre',
      action: async () => {
        let clicks = 0;
        let fieldsEdited = 0;
        const notes: string[] = [];

        const added = await clickIfReady(page, /Ny CTA|New CTA/i);
        if (added) clicks += 1;

        const headlineInput = page.getByLabel(/Hovedtittel|Headline/i).first();
        if (await fillIfReady(headlineInput, 'Book demo nå')) fieldsEdited += 1;

        const saved = await clickIfReady(page, /^Lagre$|^Save$/i);
        if (saved) clicks += 1;

        if (!saved) notes.push('Lagre-knapp utilgjengelig eller ikke synlig.');
        return { success: added && saved, clicks, fieldsEdited, notes };
      },
    });

    await runFlow({
      flowId: 'lower_third_add_save',
      route: '/academy/lower-thirds',
      goal: 'Opprette lower third og lagre',
      action: async () => {
        let clicks = 0;
        let fieldsEdited = 0;
        const notes: string[] = [];

        const added = await clickIfReady(page, /Ny lower third|New Lower Third/i);
        if (added) clicks += 1;

        const titleInput = page.getByLabel(/Tittel|Title/i).first();
        if (await fillIfReady(titleInput, 'Velkommen til modul 1')) fieldsEdited += 1;

        const saved = await clickIfReady(page, /^Lagre$|^Save$/i);
        if (saved) clicks += 1;

        return { success: added && saved, clicks, fieldsEdited, notes };
      },
    });

    await runFlow({
      flowId: 'presentation_generate_plan',
      route: '/academy/presentation-overlay',
      goal: 'Opprette presentasjon + generere design-plan',
      action: async () => {
        let clicks = 0;
        let fieldsEdited = 0;
        const notes: string[] = [];

        const newDeck = await clickIfReady(page, /Ny presentasjon|New deck/i);
        if (newDeck) clicks += 1;

        const searchInput = page.getByPlaceholder(
          /Sok i presentasjon og slides|Search presentations and slides/i,
        );
        if (await fillIfReady(searchInput, 'sales milestone onboarding')) fieldsEdited += 1;

        const semanticTriggered = await page
          .waitForResponse(
            (response) =>
              response.url().includes('/api/academy/presentation/semantic-search') &&
              response.request().method() === 'POST' &&
              response.status() === 200,
            { timeout: 90_000 },
          )
          .then(() => true)
          .catch(() => false);
        if (!semanticTriggered) notes.push('Semantic-search ble ikke trigget.');

        const generate = await clickIfReady(page, /Generer plan|Generate plan/i);
        if (generate) clicks += 1;

        const designPlanTriggered = await page
          .waitForResponse(
            (response) =>
              response.url().includes('/api/academy/presentation/design-plan') &&
              response.request().method() === 'POST' &&
              response.status() === 200,
            { timeout: 120_000 },
          )
          .then(() => true)
          .catch(() => false);
        if (!designPlanTriggered) notes.push('Design-plan ble ikke trigget eller svarte ikke 200.');

        return {
          success: Boolean(newDeck && generate && semanticTriggered && designPlanTriggered),
          clicks,
          fieldsEdited,
          notes,
        };
      },
    });

    const summary = {
      generatedAt: new Date().toISOString(),
      totalFlows: results.length,
      passedFlows: results.filter((entry) => entry.success).length,
      failedFlows: results.filter((entry) => !entry.success).length,
      avgTimeToGoalMs:
        results.length > 0
          ? Math.round(results.reduce((acc, entry) => acc + entry.timeToGoalMs, 0) / results.length)
          : 0,
      avgInteractiveCountAtStart:
        results.length > 0
          ? Math.round(results.reduce((acc, entry) => acc + entry.interactiveCountAtStart, 0) / results.length)
          : 0,
      avgToolbarActionsAtStart:
        results.length > 0
          ? Number(
              (
                results.reduce((acc, entry) => acc + entry.visibleToolbarActionsAtStart, 0) / results.length
              ).toFixed(2),
            )
          : 0,
    };

    const report = { summary, results };
    await testInfo.attach('academy-ux-psych-audit.json', {
      body: Buffer.from(JSON.stringify(report, null, 2), 'utf8'),
      contentType: 'application/json',
    });
    console.log(`ACADEMY_UX_AUDIT_JSON=${JSON.stringify(report)}`);
  });
});
