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
  await page.route('**/api/role-room/projects/project-e2e/manuscripts/manuscript-e2e/storyboard-review-rounds**', async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith('/storyboard-review-rounds') && method === 'GET') {
      await route.fulfill({ json: { success: true, data: created ? [round] : [] } }); return;
    }
    if (url.endsWith('/storyboard-review-rounds') && method === 'POST') {
      created = true; await route.fulfill({ status: 201, json: { success: true, data: { ...round, snapshot } } }); return;
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
    if (url.endsWith('/round-e2e') && method === 'GET') {
      await route.fulfill({ json: { success: true, data: { ...round, snapshot, comments: [], decisions: [], shareLinks: [] } } }); return;
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

  await page.getByTestId('create-storyboard-review-link').click();
  await expect(page.getByTestId('storyboard-review-created-url').locator('input')).toHaveValue(/\/storyboard-review\/review-token-e2e$/);

  await page.getByLabel(`Skriv ${snapshotHash.slice(0, 8)} for å bekrefte`).fill(snapshotHash.slice(0, 8));
  await page.getByTestId('restore-storyboard-review-round').click();
  await expect(page.getByRole('alert').filter({ hasText: 'current storyboard changed' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('guest identity, frame comment and exact-revision sign-off work end to end', async ({ page }) => {
  let identified = false;
  let approved = false;
  const comments: any[] = [];
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
      comments.push({ id: 'comment-e2e', reviewRoundId: 'round-e2e', frameId: body.frameId,
        authorDisplayName: 'Kari Klient', body: body.body, visibility: 'client', status: 'open',
        createdAt: '2026-09-12T12:02:00Z' });
      await route.fulfill({ status: 201, json: { success: true, data: comments[0] } }); return;
    }
    if (url.endsWith('/decisions') && method === 'POST') {
      const body = route.request().postDataJSON();
      expect(body.expectedSnapshotHash).toBe(snapshotHash);
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
  await page.getByTestId('storyboard-review-comment').fill('Hold to bilder lenger.');
  await page.getByTestId('submit-storyboard-review-comment').click();
  await expect(page.getByText('Hold to bilder lenger.')).toBeVisible();
  await page.getByTestId('approve-storyboard-review').click();
  await expect(page.getByText(/Denne revisjonen er låst/)).toBeVisible();
  await expect(page.getByTestId('submit-storyboard-review-comment')).toHaveCount(0);
  await expect(page.getByTestId('approve-storyboard-review')).toHaveCount(0);
});
