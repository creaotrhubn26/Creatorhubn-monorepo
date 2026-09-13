import { expect, test, type Page, type Route } from '@playwright/test';

const snapshotHash = 'a'.repeat(64);
const currentHash = 'c'.repeat(64);
const snapshot = {
  schemaVersion: 'storyboard-review-snapshot-v1',
  manuscript: { id: 'manuscript-e2e', title: 'TROLL', version: 4 },
  scenes: [{
    id: 'scene-e2e', heading: 'INT. TOG — NATT', description: 'Nora ser trollet.',
    storyboardFrames: [{
      id: 'frame-e2e', shotNumber: '1A', description: 'Trollet i vinduet', duration: 2,
      imageUrl: '/test-assets/storyboard-noir-reference.svg', scriptLineRange: [10, 12],
    }],
  }],
  dialogue: [{ id: 'line-1', sceneId: 'scene-e2e', lineNumber: 10, characterName: 'Nora', text: 'Se!' }],
};
const round = {
  id: 'round-e2e', projectId: 'project-e2e', manuscriptId: 'manuscript-e2e',
  version: 1, label: 'Client approval', summary: 'Locked pass', snapshotHash,
  scriptFingerprint: 'b'.repeat(64), status: 'in_review', frameCount: 1,
  totalDurationSeconds: 2, createdBy: 'owner-e2e', submittedAt: '2026-09-12T12:00:00Z',
  createdAt: '2026-09-12T12:00:00Z',
};
const diff = {
  currentHash, baselineHash: snapshotHash, scriptChanged: true,
  addedFrameIds: ['frame-new'], removedFrameIds: [], changedFrameIds: ['frame-e2e'],
  movedFrameIds: [], impactedScriptLineRanges: [[10, 12]], unchangedFrameCount: 0,
};

async function managerApi(page: Page) {
  let created = false;
  let inboxRead = false;
  let managerComment = {
    id: 'comment-e2e', reviewRoundId: 'round-e2e', frameId: 'frame-e2e',
    authorDisplayName: 'Kari Klient', body: 'Hold to bilder lenger.',
    visibility: 'client', status: 'open', assignedTo: null, dueAt: null,
    anchorX: 0.68, anchorY: 0.32,
    annotations: [{
      id: 'manager-markup-e2e', tool: 'rectangle', color: '#f87171', strokeWidth: 3,
      points: [{ x: 0.52, y: 0.18 }, { x: 0.82, y: 0.48 }],
    }],
    resolutionNote: null, resolvedInRoundId: null, carriedFromCommentId: 'comment-v0',
    createdAt: '2026-09-12T12:02:00Z', updatedAt: '2026-09-12T12:02:00Z',
  };
  await page.route('**/api/role-room/projects/project-e2e/manuscripts/manuscript-e2e/storyboard-review-inbox**', async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith('/notification-e2e/read') && method === 'POST') {
      inboxRead = true;
      await route.fulfill({ json: { success: true } }); return;
    }
    if (url.endsWith('/read-all') && method === 'POST') {
      inboxRead = true;
      await route.fulfill({ json: { success: true } }); return;
    }
    if (method === 'GET') {
      const items = created ? [{
        id: 'notification-e2e', eventType: 'storyboard_review_comment_added',
        title: 'Kari Klient kommenterte storyboard v1', message: 'Hold to bilder lenger.',
        reviewRoundId: round.id, roundVersion: 1, frameId: 'frame-e2e',
        actorDisplayName: 'Kari Klient', decision: null, createdAt: '2026-09-12T12:02:00Z',
        read: inboxRead, readAt: inboxRead ? '2026-09-12T12:04:00Z' : null,
      }] : [];
      await route.fulfill({ json: { success: true, data: {
        items, unreadCount: items.filter((item) => !item.read).length,
      } } }); return;
    }
    await route.fulfill({ status: 404, json: { error: 'not_found' } });
  });
  await page.route('**/api/role-room/projects/project-e2e/manuscripts/manuscript-e2e/storyboard-review-rounds**', async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith('/storyboard-review-rounds') && method === 'GET') {
      await route.fulfill({ json: { success: true, data: created ? [round] : [] } }); return;
    }
    if (url.endsWith('/storyboard-review-rounds') && method === 'POST') {
      created = true; await route.fulfill({ status: 201, json: { success: true, data: { ...round, snapshot, carriedCommentCount: 1 } } }); return;
    }
    if (url.endsWith('/round-e2e/diff')) {
      await route.fulfill({ json: { success: true, data: diff } }); return;
    }
    if (url.endsWith('/round-e2e/share-links') && method === 'POST') {
      await route.fulfill({ status: 201, json: { success: true, data: {
        id: 'share-e2e', reviewRoundId: 'round-e2e', accessMode: 'approve',
        requireIdentity: true, createdAt: '2026-09-12T12:01:00Z', token: 'review-token-e2e',
      } } }); return;
    }
    if (url.endsWith('/round-e2e/restore') && method === 'POST') {
      await route.fulfill({ status: 409, json: { error: 'current_storyboard_changed', currentHash: 'd'.repeat(64) } }); return;
    }
    if (url.endsWith('/round-e2e/comments/comment-e2e') && method === 'PATCH') {
      const body = route.request().postDataJSON();
      managerComment = {
        ...managerComment, ...body,
        assignedTo: body.assignedTo === undefined ? managerComment.assignedTo : body.assignedTo,
        dueAt: body.dueAt === undefined ? managerComment.dueAt : body.dueAt,
        resolutionNote: body.status === 'open' ? null : body.resolutionNote ?? managerComment.resolutionNote,
        resolvedInRoundId: body.status === 'open' ? null : body.resolvedInRoundId ?? managerComment.resolvedInRoundId,
        updatedAt: '2026-09-12T12:05:00Z',
      };
      await route.fulfill({ json: { success: true, data: managerComment } }); return;
    }
    if (url.endsWith('/round-e2e') && method === 'GET') {
      await route.fulfill({ json: { success: true, data: { ...round, snapshot, comments: [managerComment], decisions: [], shareLinks: [] } } }); return;
    }
    await route.fulfill({ status: 404, json: { error: 'not_found' } });
  });
}

test('manager locks a revision, receives a one-time guest URL and sees stale restore fail closed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await managerApi(page);
  await page.goto('/e2e-storyboard-review-manager.html');
  await expect(page.getByTestId('storyboard-review-manager-ready')).toHaveText('ready');
  await page.getByTestId('create-storyboard-review-round').click();
  await expect(page.getByTestId('storyboard-review-round-1')).toBeVisible();
  await expect(page.getByTestId('storyboard-review-diff')).toContainText('2 storyboardendringer');
  await expect(page.getByTestId('storyboard-review-baseline')).toContainText('frame-e2e');
  await expect(page.getByTestId('storyboard-review-inbox-count')).toContainText('1 ulest');
  await expect(page.getByTestId('storyboard-review-inbox-item-storyboard_review_comment_added')).toContainText('Kari Klient');
  await page.getByTestId('storyboard-review-inbox-item-storyboard_review_comment_added').click();
  await expect(page.getByTestId('storyboard-review-inbox-count')).toContainText('Alt lest');

  await page.getByTestId('create-storyboard-review-link').click();
  await expect(page.getByTestId('storyboard-review-created-url').locator('input')).toHaveValue(/\/storyboard-review\/review-token-e2e$/);

  await expect(page.getByTestId('storyboard-review-resolution-queue')).toContainText('1 åpne av 1 punkt');
  await expect(page.getByTestId('storyboard-review-manager-markup-comment-e2e')).toBeVisible();
  await expect(page.getByTestId('storyboard-review-persisted-markup-comment-e2e')).toBeVisible();
  await expect(page.getByTestId('storyboard-review-persisted-markup-comment-e2e').locator('rect')).toHaveCount(1);
  await page.getByTestId('storyboard-review-assignee-comment-e2e').fill('Mina');
  await page.getByTestId('storyboard-review-resolution-note-comment-e2e').fill('Forlenget til fire sekunder.');
  await page.getByTestId('storyboard-review-resolve-comment-e2e').click();
  await expect(page.getByTestId('storyboard-review-resolution-empty')).toContainText('Alle review-punkt er løst');
  await page.getByTestId('storyboard-review-open-comment-filter').click();
  await expect(page.getByTestId('storyboard-review-resolution-comment-comment-e2e')).toContainText('Løst');
  await expect(page.getByTestId('storyboard-review-assignee-comment-e2e')).toHaveValue('Mina');
  await expect(page.getByTestId('storyboard-review-resolution-note-comment-e2e')).toHaveValue('Forlenget til fire sekunder.');

  await page.getByLabel(`Skriv ${snapshotHash.slice(0, 8)} for å bekrefte`).fill(snapshotHash.slice(0, 8));
  await page.getByTestId('restore-storyboard-review-round').click();
  await expect(page.getByRole('alert').filter({ hasText: 'current storyboard changed' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('guest identity, frame comment and exact-revision sign-off work end to end', async ({ page }) => {
  let identified = false;
  let approved = false;
  let submittedCommentBody: Record<string, any> | null = null;
  const comments: any[] = [{
    id: 'comment-resolved-e2e', reviewRoundId: 'round-e2e', frameId: 'frame-e2e',
    authorDisplayName: 'Ola Kunde', body: 'Gjør utsnittet tettere.', visibility: 'client',
    status: 'resolved', assignedTo: 'Mina', resolutionNote: 'Byttet til nærbilde.',
    anchorX: 0.28, anchorY: 0.42,
    annotations: [{
      id: 'resolved-markup-e2e', tool: 'arrow', color: '#60a5fa', strokeWidth: 3,
      points: [{ x: 0.12, y: 0.22 }, { x: 0.28, y: 0.42 }],
    }],
    resolvedInRoundId: 'round-e2e', createdAt: '2026-09-12T12:01:00Z',
  }, {
    id: 'comment-legacy-e2e', reviewRoundId: 'round-e2e', frameId: 'frame-e2e',
    authorDisplayName: 'Tidligere kunde', body: 'Eksisterende kommentar uten markering.',
    visibility: 'client', status: 'resolved', assignedTo: null,
    resolutionNote: 'Beholdt som før.', resolvedInRoundId: 'round-e2e',
    createdAt: '2026-09-12T11:55:00Z',
  }];
  await page.route('**/api/role-room/storyboard-review/review-token-e2e**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith('/sessions') && method === 'POST') {
      identified = true;
      await route.fulfill({ status: 201, json: { success: true, data: {
        reviewerToken: 'reviewer-token-e2e', reviewer: { id: 'reviewer-e2e', displayName: 'Kari Klient' },
      } } }); return;
    }
    if (url.endsWith('/comments') && method === 'POST') {
      const body = route.request().postDataJSON();
      submittedCommentBody = body;
      comments.push({ id: 'comment-e2e', reviewRoundId: 'round-e2e', frameId: body.frameId,
        authorDisplayName: 'Kari Klient', body: body.body, visibility: 'client', status: 'open',
        anchorX: body.anchorX, anchorY: body.anchorY, annotations: body.annotations,
        createdAt: '2026-09-12T12:02:00Z' });
      await route.fulfill({ status: 201, json: { success: true, data: comments.at(-1) } }); return;
    }
    if (url.endsWith('/decisions') && method === 'POST') {
      const body = route.request().postDataJSON();
      expect(body.expectedSnapshotHash).toBe(snapshotHash);
      expect(body.confirmOpenComments).toBe(true);
      approved = true;
      await route.fulfill({ status: 201, json: { success: true, data: {
        id: 'decision-e2e', reviewRoundId: 'round-e2e', decision: 'approved',
        expectedSnapshotHash: snapshotHash, actorDisplayName: 'Kari Klient', createdAt: '2026-09-12T12:03:00Z',
      } } }); return;
    }
    if (method === 'GET') {
      if (!identified) {
        await route.fulfill({ json: { success: true, data: {
          requiresIdentity: true,
          round: { id: round.id, version: round.version, label: round.label,
            status: round.status, snapshotHash, frameCount: 1 },
          share: { accessMode: 'approve', requireIdentity: true },
        } } }); return;
      }
      await route.fulfill({ json: { success: true, data: {
        requiresIdentity: false,
        round: { ...round, status: approved ? 'approved' : 'in_review', snapshot, comments,
          decisions: approved ? [{ id: 'decision-e2e', reviewRoundId: round.id, decision: 'approved',
            expectedSnapshotHash: snapshotHash, actorDisplayName: 'Kari Klient', createdAt: '2026-09-12T12:03:00Z' }] : [] },
        share: { accessMode: 'approve', requireIdentity: true },
        reviewer: { id: 'reviewer-e2e', displayName: 'Kari Klient' },
      } } }); return;
    }
    await route.fulfill({ status: 404, json: { error: 'not_found' } });
  });

  await page.goto('/e2e-storyboard-review-guest.html');
  await page.getByTestId('storyboard-reviewer-name').fill('Kari Klient');
  await page.getByTestId('start-storyboard-review').click();
  await expect(page.getByTestId('storyboard-review-frame-0')).toBeVisible();
  await page.getByTestId('storyboard-review-frame-0').click();
  await expect(page.getByTestId('storyboard-review-visual-feedback')).toBeVisible();
  await expect(page.getByTestId('storyboard-review-persisted-markup-comment-resolved-e2e')).toBeVisible();
  await expect(page.getByText('Eksisterende kommentar uten markering.')).toBeVisible();
  await page.getByTestId('storyboard-review-tool-arrow').click();
  const canvas = page.getByTestId('storyboard-review-markup-canvas-frame-e2e').locator('svg');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error('Missing storyboard review markup canvas bounds');
  await page.getByTestId('storyboard-review-tool-freehand').click();
  await page.mouse.move(bounds.x + bounds.width * 0.12, bounds.y + bounds.height * 0.72);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.38, bounds.y + bounds.height * 0.58, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('storyboard-review-draft-markup').locator('polyline')).toHaveCount(1);
  await page.getByTestId('storyboard-review-markup-undo').click();
  await expect(page.getByTestId('storyboard-review-draft-markup').locator('polyline')).toHaveCount(0);
  await page.getByTestId('storyboard-review-tool-arrow').click();
  await page.mouse.move(bounds.x + bounds.width * 0.18, bounds.y + bounds.height * 0.24);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.72, bounds.y + bounds.height * 0.61, { steps: 5 });
  await page.mouse.up();
  await page.getByTestId('storyboard-review-tool-pin').click();
  await page.mouse.click(bounds.x + bounds.width * 0.72, bounds.y + bounds.height * 0.61);
  await expect(page.getByTestId('storyboard-review-comment-status-comment-resolved-e2e')).toContainText('Løst');
  await expect(page.getByText('Løsning: Byttet til nærbilde.')).toBeVisible();
  await page.getByTestId('storyboard-review-comment').fill('Hold to bilder lenger.');
  await page.getByTestId('submit-storyboard-review-comment').click();
  await expect(page.getByText('Hold to bilder lenger.')).toBeVisible();
  expect(submittedCommentBody).toMatchObject({
    frameId: 'frame-e2e', body: 'Hold to bilder lenger.',
  });
  expect(submittedCommentBody?.anchorX).toBeCloseTo(0.72, 1);
  expect(submittedCommentBody?.anchorY).toBeCloseTo(0.61, 1);
  expect(submittedCommentBody?.annotations).toEqual([
    expect.objectContaining({ tool: 'arrow', color: '#fbbf24', strokeWidth: 3 }),
  ]);
  await expect(page.getByTestId('storyboard-review-persisted-markup-comment-e2e')).toBeVisible();
  await page.getByTestId('storyboard-review-toggle-markup').click();
  await expect(page.getByTestId('storyboard-review-persisted-markup-comment-e2e')).toHaveCount(0);
  await page.getByTestId('storyboard-review-toggle-markup').click();
  await expect(page.getByTestId('storyboard-review-open-comments-warning')).toContainText('1 review-punkt');
  await expect(page.getByTestId('approve-storyboard-review')).toBeDisabled();
  await page.getByLabel('Jeg godkjenner med 1 åpne punkt').check();
  await page.getByTestId('approve-storyboard-review').click();
  await expect(page.getByText(/Denne revisjonen er låst/)).toBeVisible();
  await expect(page.getByTestId('submit-storyboard-review-comment')).toHaveCount(0);
  await expect(page.getByTestId('approve-storyboard-review')).toHaveCount(0);
});
