import { expect, test } from '@playwright/test';
import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

test.describe('Regissørrom', () => {
  test('åpner den rollebaserte oversikten og navigerer til eksisterende produksjonsflater', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (/TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(text)) {
        runtimeErrors.push(text);
      }
    });

    await openCastingPlanner(page, { urlFlags: { seed: 'basic' } });
    await selectFirstProject(page);

    const launcher = page.getByTestId('director-workspace-launcher');
    await expect(launcher).toBeVisible({ timeout: 15_000 });
    await launcher.getByRole('button', { name: 'Åpne regissørvisning' }).click();

    await expect(page.getByTestId('director-workspace')).toBeVisible();
    await expect(page.getByText('Ingen AI-antakelser')).toBeVisible();
    await expect(page.getByTestId('director-surface-today')).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('director');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('today');

    await page.getByTestId('director-surface-visual-plan').click();
    await expect(page.locator('#tab-storyboard')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('visual-plan');

    await page.locator('#tab-oversikt').click();
    await expect(page.getByTestId('director-workspace')).toBeVisible();
    await page.getByTestId('director-open-full-workspace').click();
    await expect(page.getByTestId('director-workspace-launcher')).toBeVisible();
    await expect(page.getByTestId('director-workspace')).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });

  test('holder scene, manusutdrag, visuell dekning og scenekommentarer i samme arbeidsflate', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (/TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(text)) {
        runtimeErrors.push(text);
      }
    });
    const comments: Array<Record<string, unknown>> = [];
    await page.route('**/api/role-room/editor-comments**', async (route) => {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON() as Record<string, unknown>;
        comments.push({
          id: `comment-${comments.length + 1}`,
          projectId: payload.projectId,
          anchorType: payload.anchorType,
          anchorRef: payload.anchorRef,
          timestampSec: null,
          commentText: payload.commentText,
          parentId: payload.parentId ?? null,
          status: 'open',
          priority: payload.priority ?? 'normal',
          authorDisplayName: 'E2E Tester',
          authorId: 'e2e-test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          replyCount: 0,
        });
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ comment: comments.at(-1) }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments, serverTime: new Date().toISOString() }),
      });
    });

    await openCastingPlanner(page, { urlFlags: { seed: 'director' } });
    await selectFirstProject(page);
    await page.getByTestId('director-workspace-launcher').getByRole('button', { name: 'Åpne regissørvisning' }).click();
    await page.getByTestId('director-surface-scenes').click();

    const workspace = page.getByTestId('director-scene-workspace');
    await expect(workspace).toBeVisible();
    await expect(page.getByTestId('director-surface-scenes')).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => new URL(page.url()).searchParams.get('surface')).toBe('scenes');
    await expect.poll(() => new URL(page.url()).searchParams.get('scene')).toBe('director-scene-1');
    await expect(page.getByTestId('director-scene-script-excerpt')).toContainText('Alt må være klart før de kommer.');
    await expect(workspace).toContainText('1 ramme');
    await expect(workspace).toContainText('1 shot');

    // Den lokale harnessen kjører uten auth-backend, og enkelte best-effort
    // bootstrap-kall kan rydde dev-tokenet. Sett speilet på nytt før vi
    // verifiserer den autentiserte kommentarbanen.
    await page.evaluate(() => {
      window.localStorage.setItem('role_room_auth_token', 'dev-admin-local-session');
      (window as Window & { __roleRoomAuthToken?: string }).__roleRoomAuthToken = 'dev-admin-local-session';
    });
    await page.getByTestId('director-scene-director-scene-2').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('scene')).toBe('director-scene-2');
    await expect(page.getByTestId('director-scene-script-excerpt')).toContainText('følger sporene inn i tåken');

    const note = 'La Elias stoppe ved tregrensen før Nora går videre.';
    await workspace.getByPlaceholder('Skriv blocking, intensjon eller regi-note …').fill(note);
    await workspace.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(workspace).toContainText(note);

    await workspace.getByRole('button', { name: 'Åpne i manus' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('story-writer');
    await expect.poll(() => new URL(page.url()).searchParams.get('scene')).toBe('director-scene-2');
    expect(runtimeErrors).toEqual([]);
  });

  test('@mobile gjør sceneflaten brukbar som én kolonne på telefon', async ({ page }) => {
    await page.route('**/api/role-room/editor-comments**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: [], serverTime: new Date().toISOString() }),
      });
    });

    await openCastingPlanner(page, { urlFlags: { seed: 'director' } });
    await selectFirstProject(page);
    await page.getByTestId('director-workspace-launcher').getByRole('button', { name: 'Åpne regissørvisning' }).click();
    await page.getByTestId('director-surface-scenes').click();

    const workspace = page.getByTestId('director-scene-workspace');
    await expect(workspace).toBeVisible();
    await expect(workspace.getByRole('textbox', { name: 'Søk i scener' })).toBeVisible();
    await expect(page.getByTestId('director-scene-script-excerpt')).toContainText('Alt må være klart');
    await expect(workspace.getByRole('button', { name: 'Åpne i manus' })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Storyboard' })).toBeVisible();
  });
});
