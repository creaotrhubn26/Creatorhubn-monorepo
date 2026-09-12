import { expect, test, type Page, type Route } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const ROOM_ID = '00000000-0000-4000-8000-000000000701';
const VERSION_A = '00000000-0000-4000-8000-000000000702';
const VERSION_B = '00000000-0000-4000-8000-000000000703';
const MEMBER_ID = '00000000-0000-4000-8000-000000000704';

const json = (route: Route, body: unknown, status = 200) => route.fulfill({
  status, contentType: 'application/json', body: JSON.stringify(body),
});

async function auth(page: Page) {
  await page.addInitScript(() => {
    const user = { id: 'producer-e2e', email: 'producer@example.test', name: 'Produsent', profession: 'music_producer' };
    localStorage.setItem('creatorhub_auth_token', 'producer-os-token');
    localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userEmail', user.email);
  });
}

async function mockResponsiveCommandCenter(page: Page) {
  await auth(page);
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/user') return json(route, { authenticated: true, user: { id: 'producer-e2e', email: 'producer@example.test', name: 'Produsent', profession: 'music_producer' } });
    if (path === '/api/sound-room/command-center') return json(route, {
      projects: [
        { id: ROOM_ID, title: 'Nordlys', artist_name: 'Ada', status: 'under_review', latest_version_label: 'Mix V3', unresolved_comments: 4, open_tasks: 2, unread_activity: 3, pending_signoffs: 1, open_decisions: 1, collaborator_count: 2, completed_listeners: 1 },
        { id: VERSION_A, title: 'Midnatt', artist_name: 'Ada', status: 'approved', latest_version_label: 'Master V1', unresolved_comments: 0, open_tasks: 0, unread_activity: 0, pending_signoffs: 0, open_decisions: 0, collaborator_count: 2, completed_listeners: 2 },
      ],
      collections: [{ id: VERSION_B, title: 'Nordlys EP', collection_type: 'ep', status: 'sequencing', track_count: 2, ready_count: 1, tracks: [] }],
    });
    return json(route, {});
  });
}

test('producer inbox creates and reorders an EP from real project state', async ({ page }) => {
  await auth(page);
  let savedTracks: string[] = [];
  let collections: any[] = [];
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/auth/user') return json(route, { authenticated: true, user: { id: 'producer-e2e', email: 'producer@example.test', name: 'Produsent', profession: 'music_producer' } });
    if (path === '/api/sound-room/command-center') return json(route, {
      projects: [
        { id: ROOM_ID, title: 'Nordlys', artist_name: 'Ada', status: 'under_review', latest_version_label: 'Mix V3', unresolved_comments: 4, open_tasks: 2, unread_activity: 3, pending_signoffs: 1, open_decisions: 1, collaborator_count: 2, completed_listeners: 1 },
        { id: VERSION_A, title: 'Midnatt', artist_name: 'Ada', status: 'approved', latest_version_label: 'Master V1', unresolved_comments: 0, open_tasks: 0, unread_activity: 0, pending_signoffs: 0, open_decisions: 0, collaborator_count: 2, completed_listeners: 2 },
      ],
      collections,
    });
    if (path === '/api/sound-room/collections' && route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      collections = [{ id: VERSION_B, title: payload.title, collection_type: payload.collectionType, status: 'draft', track_count: 0, ready_count: 0, tracks: [] }];
      return json(route, collections[0], 201);
    }
    if (path === `/api/sound-room/collections/${VERSION_B}/tracks`) {
      savedTracks = route.request().postDataJSON().tracks.map((item: any) => item.projectId);
      collections[0] = { ...collections[0], track_count: savedTracks.length, ready_count: 1, tracks: savedTracks.map((project_id, index) => ({ project_id, track_number: index + 1 })) };
      return json(route, { ok: true, trackCount: savedTracks.length });
    }
    return json(route, {});
  });

  await page.goto('/sound-room');
  await expect(page.getByTestId('sound-room-command-center')).toBeVisible({ timeout: 60_000 });
  if (process.env.SOUND_ROOM_AUDIT_SHOTS === '1') await page.screenshot({ path: '/tmp/sound-room-command-center.png', fullPage: true });
  await expect(page.getByText('4', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Nordlys', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ny EP eller album' }).click();
  await page.getByLabel('Tittel').fill('Nordlys EP');
  await page.getByLabel('Nordlys – Ada').check();
  await page.getByLabel('Midnatt – Ada').check();
  await page.getByRole('button', { name: 'Opprett utgivelse' }).click();
  await expect(page.getByText('Nordlys EP')).toBeVisible();
  expect(savedTracks).toEqual([ROOM_ID, VERSION_A]);
});

test('project producer tools generate a brief, open a decision and request sign-off', async ({ page }) => {
  await auth(page);
  let canApprove = false;
  let brief: any = null;
  let decisions: any[] = [];
  let signoffs: any[] = [];
  const versions = [
    { id: VERSION_B, project_id: ROOM_ID, version_number: 2, version_label: 'Mix V2', file_url: '/silent.wav', status: 'under_review', created_at: '2026-09-12T10:00:00Z' },
    { id: VERSION_A, project_id: ROOM_ID, version_number: 1, version_label: 'Mix V1', file_url: '/silent.wav', status: 'superseded', created_at: '2026-09-11T10:00:00Z' },
  ];
  const os = () => ({ settings: {}, briefs: brief ? [brief] : [], decisions, signoffs, listens: [], manifests: [], activity: [] });
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === '/api/auth/user') return json(route, { authenticated: true, user: { id: 'producer-e2e', email: 'producer@example.test', name: 'Produsent' } });
    if (path === `/api/audio-showcases/${ROOM_ID}`) return json(route, { project: { id: ROOM_ID, title: 'Nordlys', status: 'under_review' }, versions, members: [{ id: 'owner', name: 'Produsent', role: 'Produsent', is_owner: true }, { id: MEMBER_ID, name: 'Ada', role: 'Artist', is_owner: false, can_approve: canApprove }], tasks: [], easeverseTrack: null, access: { canEdit: true } });
    if (path.startsWith('/api/audio-versions/') && method === 'GET') return json(route, { version: versions.find((item) => path.endsWith(item.id)), comments: [], sections: [], approvals: [] });
    if (path === `/api/sound-room/projects/${ROOM_ID}`) return json(route, os());
    if (path.endsWith('/briefs') && method === 'POST') {
      brief = { id: 'brief-1', title: 'Revisjonsbrief – Nordlys', summary: 'To åpne innspill er samlet.', priorities: [{ title: 'Vokal', detail: '0:42 Mer vokal i refreng' }], conflicts: [], generation_mode: 'ai' };
      return json(route, brief, 201);
    }
    if (path.endsWith(`/members/${MEMBER_ID}`) && method === 'PATCH') { canApprove = true; return json(route, { id: MEMBER_ID, can_approve: true }); }
    if (path.endsWith('/decisions') && method === 'POST') { decisions = [{ id: 'decision-1', title: 'Hvilken versjon fungerer best?', status: 'open', blind: true, candidates: [], vote_count: 0 }]; return json(route, decisions[0], 201); }
    if (path.endsWith('/signoffs') && method === 'POST') { signoffs = [{ id: 'signoff-1', member_id: MEMBER_ID, member_name: 'Ada', stage: 'mix', status: 'requested' }]; return json(route, { signoffs }, 201); }
    if (path.endsWith('/protools/web/status')) return json(route, { connected: false, session: null });
    if (path.endsWith('/coaching')) return json(route, { items: [] });
    if (path.endsWith('/mood')) return json(route, { moods: [] });
    if (path.endsWith('/live-session')) return json(route, { live: false });
    if (path.endsWith('/release')) return json(route, { release: null });
    return json(route, {});
  });

  await page.goto(`/audio-review/${ROOM_ID}`);
  await expect(page.getByTestId('open-producer-tools')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('open-producer-tools').click();
  await page.getByTestId('generate-revision-brief').click();
  await expect(page.getByTestId('revision-brief')).toContainText('Mer vokal i refreng');
  await expect(page.getByTestId('sound-room-operating-panel')).toHaveCSS('background-color', 'rgb(19, 19, 22)');
  await page.waitForTimeout(300);
  if (process.env.SOUND_ROOM_AUDIT_SHOTS === '1') await page.screenshot({ path: '/tmp/sound-room-producer-tools.png', fullPage: true });

  await page.getByRole('tab', { name: 'Decision Room' }).click();
  await page.getByTestId('create-decision-room').click();
  await expect(page.getByText('Decision Room er åpnet for samarbeidspartnerne.')).toBeVisible();

  await page.getByRole('tab', { name: 'Sign-off' }).click();
  await page.getByLabel('Kan godkjenne').click();
  await expect(page.getByText('Ada kan nå godkjenne.')).toBeVisible();
  await page.getByRole('button', { name: 'Be alle godkjennere om sign-off' }).click();
  await expect(page.getByText('Mix-godkjenning er sendt.')).toBeVisible();
});

test('shared reviewer can vote blindly and complete the requested sign-off', async ({ page }) => {
  const token = 'inv_sound_room_os_e2e';
  let votedVersion = '';
  let signoffStatus = 'requested';
  const versions = [
    { id: VERSION_A, version_number: 1, version_label: 'Secret loud master', file_url: '/silent.wav', status: 'superseded' },
    { id: VERSION_B, version_number: 2, version_label: 'Secret dynamic master', file_url: '/silent.wav', status: 'under_review' },
  ];
  await page.route('**/silent.wav', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.alloc(48) }));
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/api/audio-review-shared/${token}`) return json(route, { project: { id: ROOM_ID, title: 'Blind review', status: 'under_review' }, versions, members: [], tasks: [], viewer: { memberId: MEMBER_ID, name: 'Ada', role: 'Artist' }, easeverseTrack: null });
    if (path === `/api/audio-review-shared/${token}/os`) return json(route, {
      decisions: [{ id: 'decision-guest', title: 'Velg master', prompt: 'Velg den som føles best.', status: 'open', blind: true, level_matched: false, candidates: [{ version_id: VERSION_A, version_label: 'Versjon A' }, { version_id: VERSION_B, version_label: 'Versjon B' }] }],
      signoffs: [{ id: 'signoff-guest', member_id: MEMBER_ID, member_name: 'Ada', stage: 'master', status: signoffStatus }],
      briefs: [], manifests: [], listens: [], activity: [], viewer: { memberId: MEMBER_ID, name: 'Ada', role: 'Artist', canApprove: true },
    });
    if (path.includes('/version/')) return json(route, { version: versions.find((version) => path.endsWith(version.id)), comments: [], sections: [] });
    if (path.endsWith('/vote')) { votedVersion = route.request().postDataJSON().versionId; return json(route, { id: 'vote-1', version_id: votedVersion }); }
    if (path.endsWith('/respond')) { signoffStatus = route.request().postDataJSON().status; return json(route, { id: 'signoff-guest', status: signoffStatus }); }
    if (path.endsWith('/sessions')) return json(route, { sessions: [] });
    if (path.endsWith('/mood')) return json(route, { options: [], mine: null });
    if (path.endsWith('/agreement')) return json(route, { exists: false });
    return json(route, {});
  });

  await page.goto(`/audio-review/shared/${token}`);
  await expect(page.getByTestId('shared-decision-room')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Secret loud master')).toHaveCount(0);
  await expect(page.getByText('Secret dynamic master')).toHaveCount(0);
  await page.getByText('Versjon A', { exact: true }).last().click();
  await page.getByTestId('submit-decision-vote').click();
  await expect.poll(() => votedVersion).toBe(VERSION_A);

  await expect(page.getByTestId('shared-signoff')).toBeVisible();
  await page.getByRole('button', { name: 'Godkjenn master' }).click();
  await expect.poll(() => signoffStatus).toBe('approved');
  await expect(page.getByText('Du har godkjent dette steget.')).toBeVisible();
});

test('@mobile producer inbox remains usable without horizontal page overflow', async ({ page }) => {
  await mockResponsiveCommandCenter(page);
  await page.goto('/sound-room');
  await expect(page.getByTestId('sound-room-command-center')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Ny EP eller album' })).toBeVisible();
  await expect(page.getByText('Nordlys', { exact: true })).toBeVisible();
  const viewportWidth = page.viewportSize()?.width || 0;
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth + 1);
  if (process.env.SOUND_ROOM_AUDIT_SHOTS === '1') await page.screenshot({ path: '/tmp/sound-room-command-center-mobile.png', fullPage: true });
});

test('@tablet producer inbox keeps collection and project actions visible', async ({ page }) => {
  await mockResponsiveCommandCenter(page);
  await page.goto('/sound-room');
  await expect(page.getByTestId('sound-room-command-center')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Nordlys EP', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ny EP eller album' })).toBeVisible();
  const viewportWidth = page.viewportSize()?.width || 0;
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth + 1);
  if (process.env.SOUND_ROOM_AUDIT_SHOTS === '1') await page.screenshot({ path: '/tmp/sound-room-command-center-tablet.png', fullPage: true });
});
