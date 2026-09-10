import { expect, test } from '@playwright/test';

const initialScript = [
  'INT. HYTTE - NATT', '', 'NORA', 'Det er bare vinden.', '', 'ANDREAS', 'Nei. Hør.',
].join('\n');

test('anchors a selection, replies, resolves and reopens without changing script text', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  const comments: Array<Record<string, unknown>> = [];
  let nextId = 1;
  await page.addInitScript(() => {
    window.localStorage.setItem('role_room_screenplay_guide_seen', '1');
    window.localStorage.setItem('role_room_auth_token', 'screenplay-comment-token');
    window.localStorage.setItem('role_room_auth_session', JSON.stringify({
      currentUserId: 'writer-1',
      sessionToken: 'screenplay-comment-token',
      adminUser: { id: 'writer-1', email: 'writer@test.local', role: 'director', display_name: 'Test Writer' },
    }));
  });
  await page.route('**/api/role-room/projects/project-comments-e2e/roles', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 'role-1', projectId: 'project-comments-e2e', userId: 'writer-1',
      role: 'director', permissions: { canEditScript: true, canComment: true },
    }]),
  }));
  await page.route('**/api/casting/projects/project-comments-e2e**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'project-comments-e2e',
      name: 'Kommentar-test',
      createdBy: 'writer-1',
      userRoles: [{
        id: 'role-1', projectId: 'project-comments-e2e', userId: 'writer-1',
        role: 'director', permissions: { canEditScript: true, canComment: true, canRunTableRead: true, canLockScript: true },
      }],
    }),
  }));
  await page.route('**/api/settings**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(route.request().method() === 'GET' ? { data: null, entries: [] } : { success: true }),
  }));
  await page.route('**/api/role-room/editor-comments**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments, serverTime: new Date().toISOString() }),
      });
      return;
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/editor-comments')) {
      const body = request.postDataJSON() as Record<string, unknown>;
      const id = `comment-${nextId++}`;
      const now = new Date().toISOString();
      comments.push({
        id,
        projectId: body.projectId,
        anchorType: body.anchorType,
        anchorRef: body.anchorRef,
        commentText: body.commentText,
        parentId: body.parentId ?? null,
        status: 'open',
        priority: 'normal',
        authorId: 'writer-1',
        authorDisplayName: 'Test Writer',
        createdAt: now,
        updatedAt: now,
        replyCount: 0,
      });
      if (body.parentId) {
        const parent = comments.find((comment) => comment.id === body.parentId);
        if (parent) parent.replyCount = Number(parent.replyCount ?? 0) + 1;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id, createdAt: now }) });
      return;
    }
    if (request.method() === 'PATCH') {
      const id = url.pathname.split('/').pop();
      const body = request.postDataJSON() as { status?: string };
      const comment = comments.find((item) => item.id === id);
      if (comment && body.status) comment.status = body.status;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({ status: 404, body: '{}' });
  });

  await page.goto('/e2e-screenplay-comments-test.html');
  const editor = page.locator('textarea').first();
  await expect(editor).toHaveValue(initialScript);
  await expect(editor).toHaveAttribute('readonly', '');

  await page.getByRole('button', { name: 'story structure' }).click();
  await page.getByRole('tab', { name: 'Struktur' }).click();
  await expect(page.getByText('Ingen eksplisitte aktmarkører funnet.')).toBeVisible();
  await expect(page.getByText('Ingen eksplisitte sekvensmarkører funnet.')).toBeVisible();

  await page.getByRole('button', { name: 'analysis' }).click();
  await expect(page.getByText('Ingen sikre avvik funnet')).toBeVisible();
  await expect(page.getByText(/Dramaturgiske valg og tilsiktede tids-\/stedshopp/)).toBeVisible();

  const selectedText = 'Det er bare vinden.';
  await editor.evaluate((element: HTMLTextAreaElement, text) => {
    const start = element.value.indexOf(text);
    element.focus();
    element.setSelectionRange(start, start + text.length);
    element.dispatchEvent(new Event('select', { bubbles: true }));
  }, selectedText);
  await editor.press('Control+Alt+m');

  await expect(page.getByRole('blockquote')).toHaveText(selectedText);
  const composer = page.getByPlaceholder('Skriv kommentar til dette tekstutvalget …');
  await composer.fill('Kan vi gjøre denne replikken mer urolig?');
  await composer.press('Control+Enter');
  await expect(page.getByText('Kan vi gjøre denne replikken mer urolig?')).toBeVisible();

  await page.getByRole('button', { name: /^Svar/ }).click();
  const reply = page.getByLabel('Svar til Test Writer');
  await reply.fill('Ja, jeg foreslår en kortere variant.');
  await reply.press('Control+Enter');
  await expect(page.getByText('Ja, jeg foreslår en kortere variant.')).toBeVisible();

  await page.getByTitle('Marker som løst').click();
  await expect(page.getByTitle('Gjenåpne tråden')).toBeVisible();
  await page.getByTitle('Gjenåpne tråden').click();
  await expect(page.getByTitle('Marker som løst')).toBeVisible();

  await page.getByRole('button', { name: 'Alle annotasjoner' }).click();
  await expect(page.getByText('Script Annotations & Comments')).toBeVisible();
  await expect(page.getByText('Kan vi gjøre denne replikken mer urolig?')).toBeVisible();
  await expect(editor).toHaveValue(initialScript);
  expect(runtimeErrors).toEqual([]);
});
