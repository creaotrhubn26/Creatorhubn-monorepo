import { expect, test, type ConsoleMessage } from '@playwright/test';

/**
 * /workspace runtime smoke — fanger de to feilene som tsc IKKE fanger:
 *   1. «useRealTime must be used within a RealTimeProvider» (manglende provider
 *      på /workspace-rutene).
 *   2. React #426 «suspended while responding to synchronous input» —
 *      picker → prosjekt auto-navigasjon som monterer lazy TeamWorkspacePage
 *      uten startTransition.
 *
 * Begge er runtime-kast → 'pageerror'. Testen asserter null uncaught errors +
 * fravær av de spesifikke signaturene, på begge kodeveiene (flere prosjekter =
 * picker; ett prosjekt = auto-redirect inn i TeamWorkspacePage).
 */

const ORIGIN = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5001';
const AUTH_TOKEN = 'e2e-token';
const AUTH_USER = {
  id: 'e2e-user',
  email: 'smoke@creatorhubn.com',
  firstName: 'Smoke',
  lastName: 'Test',
  name: 'Smoke Test',
  role: 'photographer',
  profession: 'photographer',
  isAdmin: false,
  verified_email: true,
};
const MUSIC_USER = {
  ...AUTH_USER,
  id: 'e2e-music-producer',
  email: 'producer@creatorhubn.com',
  firstName: 'Music',
  lastName: 'Producer',
  name: 'Music Producer',
  role: 'music_producer',
  profession: 'music_producer',
};

const RUNTIME_ERROR_SIGNATURES = [
  'useRealTime must be used within a RealTimeProvider',
  'Minified React error #426',
  'suspended while responding to synchronous input',
  'must be used within',
];

function sampleProject(id: string) {
  return {
    id,
    title: `Smoke Project ${id}`,
    name: `Smoke Project ${id}`,
    projectType: 'wedding',
    status: 'active',
    eventDate: '2026-09-14',
    location: 'Oslo',
    coverUrl: null,
  };
}

/** Fanger uncaught exceptions + console.error som matcher kjente signaturer. */
async function collectRuntimeErrors(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (RUNTIME_ERROR_SIGNATURES.some((sig) => text.includes(sig))) {
      errors.push(`[console.error] ${text}`);
    }
  });
  return errors;
}

/** Seed auth + generøse API-mocks slik at /workspace-treet rendrer fullt ut. */
async function primeAuthAndApi(
  page: import('@playwright/test').Page,
  projects: ReturnType<typeof sampleProject>[],
  authUser = AUTH_USER,
) {
  await page.addInitScript(
    ([token, user]) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('creatorhub_auth_token', token as string);
      window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    },
    [AUTH_TOKEN, authUser] as const,
  );

  // Registreres først, slik at de mer spesifikke rutene nedenfor får prioritet.
  // Matcher bare origin-/api-kall (ikke kildefiler som /src/api/*).
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    }),
  );

  await page.route('**/api/auth/user', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, user: authUser }),
    }),
  );

  // Oversikt-fanens egne endepunkter (default-fane etter auto-redirect).
  await page.route('**/api/projects/*/board-tasks', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tasks: [] }),
    }),
  );
  await page.route('**/api/projects/*/checklist', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );

  // Prosjektlisten styrer picker-vs-auto-redirect.
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ projects }),
    }),
  );

  // Enkelt-prosjekt-oppslag (header) + team-medlemmer.
  await page.route(/\/api\/projects\/[^/?]+$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ project: sampleProject('p1') }),
    }),
  );
  await page.route('**/api/projects/*/team/members', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ owner: null, members: [] }),
    }),
  );

  // Badge-/aktivitet-endepunkter TeamWorkspacePage poller — tomt svar er nok.
  const emptyJson = (route: import('@playwright/test').Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  await page.route('**/api/foresporsler/inbound', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );
  await page.route('**/api/projects/*/client-activity', emptyJson);
  await page.route('**/api/projects/*/audio-room/unseen-comments', emptyJson);
  await page.route('**/api/community/user/*/roles', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ roles: [] }),
    }),
  );
  await page.route('**/api/design/tokens*', emptyJson);
  await page.route('**/api/editing/vendor/me', emptyJson);
}

test('multi-project /workspace renders the picker without runtime errors', async ({
  page,
}) => {
  const errors = await collectRuntimeErrors(page);
  await primeAuthAndApi(page, [sampleProject('p1'), sampleProject('p2')]);

  await page.goto(`${ORIGIN}/workspace`, { waitUntil: 'domcontentloaded' });
  // Første Vite-transform kan ta lenger enn en fast sleep på stor monorepo.
  await expect
    .poll(async () => (await page.locator('body').innerText()).trim().length, {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);

  expect(
    errors,
    `Runtime errors on /workspace (picker):\n${errors.join('\n')}`,
  ).toEqual([]);
  // Ikke stått igjen på /login (auth holdt) og ikke en blank/krasjet side.
  expect(page.url()).toContain('/workspace');
});

test('single-project /workspace auto-redirects into the workspace without React #426', async ({
  page,
}) => {
  const errors = await collectRuntimeErrors(page);
  await primeAuthAndApi(page, [sampleProject('p1')]);

  await page.goto(`${ORIGIN}/workspace`, { waitUntil: 'domcontentloaded' });
  // Auto-redirect: WorkspaceHome → /workspace/p1 (monterer lazy TeamWorkspacePage).
  await page.waitForURL('**/workspace/p1', { timeout: 15000 });
  await page.waitForTimeout(4000);

  expect(
    errors,
    `Runtime errors on picker→project transition:\n${errors.join('\n')}`,
  ).toEqual([]);
  expect(page.url()).toContain('/workspace/p1');
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(0);
});

test('music producer completes the EaseVerse, Pro Tools Companion and Sound Room review flow', async ({
  page,
}) => {
  const errors = await collectRuntimeErrors(page);
  let pairingPayload: unknown = null;
  let commentPayload: unknown = null;
  let approvalPayload: unknown = null;
  let showcaseApproved = false;
  const reviewDetail: { comments: any[]; sections: any[]; approvals: any[] } = {
    comments: [],
    sections: [],
    approvals: [],
  };
  const showcaseResponse = () => ({
    project: {
      id: 'room-1',
      title: 'E2E Song',
      status: showcaseApproved ? 'approved' : 'under_review',
      clientName: 'E2E Artist',
      createdAt: '2026-09-08T09:41:00.000Z',
    },
    versions: [
      {
        id: 'version-1',
        version_number: 1,
        version_label: 'Mix V1',
        file_name: 'e2e-song-mix-v1.wav',
        file_url: null,
        status: 'superseded',
        duration: 185,
        created_at: '2026-09-07T09:41:00.000Z',
      },
      {
        id: 'version-2',
        version_number: 2,
        version_label: 'Mix V2',
        file_name: 'e2e-song-mix-v2.wav',
        file_url: null,
        status: 'under_review',
        duration: 188,
        created_at: '2026-09-08T09:41:00.000Z',
      },
    ],
    members: [],
    tasks: [],
    easeverseTrack: { id: 'track-1', title: 'E2E Song' },
  });
  await primeAuthAndApi(page, [sampleProject('p1')], MUSIC_USER);

  await page.route('**/api/projects/p1/audio-room', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ audioRoomId: 'room-1', created: false }),
    }),
  );
  await page.route('**/api/projects/p1/easeverse-tracks', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connected: true,
        linkedTrackId: 'track-1',
        tracks: [
          { id: 'track-1', title: 'E2E Song', status: 'mixing', linked: true },
        ],
      }),
    }),
  );
  await page.route('**/api/projects/p1/audio-room/members', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ members: [] }),
    }),
  );
  await page.route('**/api/audio-showcases/room-1', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(showcaseResponse()),
    }),
  );
  await page.route('**/api/audio-versions/version-2', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: {
          id: 'version-2',
          project_id: 'room-1',
          version_number: 2,
          version_label: 'Mix V2',
          file_name: 'e2e-song-mix-v2.wav',
          file_url: null,
          status: 'under_review',
          duration: 188,
        },
        ...reviewDetail,
      }),
    }),
  );
  await page.route('**/api/audio-comments', async (route) => {
    commentPayload = route.request().postDataJSON();
    const comment = {
      id: 'comment-e2e',
      version_id: 'version-2',
      user_id: MUSIC_USER.id,
      body: (commentPayload as { body?: string })?.body,
      timecode_seconds:
        (commentPayload as { timecodeSeconds?: number })?.timecodeSeconds ?? 0,
      author: MUSIC_USER.name,
      author_role: 'music_producer',
      created_at: '2026-09-08T09:42:00.000Z',
      status: 'unresolved',
      like_count: 0,
    };
    reviewDetail.comments.push(comment);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(comment),
    });
  });
  await page.route('**/api/audio-versions/version-2/approve', async (route) => {
    approvalPayload = route.request().postDataJSON();
    showcaseApproved = true;
    const approval = {
      id: 'approval-e2e',
      versionId: 'version-2',
      userId: MUSIC_USER.id,
      status: 'approved',
      createdAt: '2026-09-08T09:43:00.000Z',
    };
    reviewDetail.approvals.push(approval);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ approval }),
    });
  });
  await page.route('**/api/audio-showcases/room-1/coaching', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );
  await page.route('**/api/audio-showcases/room-1/mood', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ moods: [] }),
    }),
  );
  await page.route('**/api/audio-showcases/room-1/release', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ release: null }),
    }),
  );
  await page.route('**/api/protools/web/status*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.route('**/api/projects/p1/recording-sessions*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ audioRoomId: 'room-1', sessions: [] }),
    }),
  );
  await page.route('**/api/protools/companion/release', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: '0.1.1',
        downloads: [],
        icon: '/protools-companion-icon.png',
      }),
    }),
  );
  await page.route('**/api/protools/pair/start', (route) => {
    pairingPayload = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: '246810', expiresInSeconds: 600 }),
    });
  });
  await page.route('**/api/realtime/user-events/ticket', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ticket: 'workspace-e2e-ticket' }),
    }),
  );

  await page.goto(`${ORIGIN}/workspace/p1`, { waitUntil: 'domcontentloaded' });
  const toolsCard = page.getByLabel('Musikkverktøy');
  await expect(toolsCard).toBeVisible({ timeout: 30_000 });
  await expect(
    toolsCard.getByText('EaseVerse + Pro Tools Companion', { exact: true }),
  ).toBeVisible();
  const overviewEaseVerseHref = await toolsCard
    .getByRole('link', { name: 'Åpne EaseVerse' })
    .getAttribute('href');
  const overviewEaseVerseUrl = new URL(overviewEaseVerseHref!);
  expect(`${overviewEaseVerseUrl.origin}${overviewEaseVerseUrl.pathname}`).toBe(
    'https://easeverse.netlify.app/integrations/creatorhub',
  );
  expect(overviewEaseVerseUrl.searchParams.get('creatorhubProjectId')).toBe(
    'p1',
  );

  await toolsCard
    .getByRole('button', { name: 'Koble Pro Tools Companion' })
    .click();
  await page.waitForURL('**/workspace/p1/sound-room?setup=protools');
  await expect(
    page.getByText('Sound Room', { exact: true }).first(),
  ).toBeVisible({ timeout: 15_000 });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('Pro Tools Companion', { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText('246810', { exact: true })).toBeVisible();
  await expect
    .poll(() => pairingPayload)
    .toEqual({
      workspaceProjectId: 'p1',
      audioRoomId: 'room-1',
      easeverseTrackId: 'track-1',
      projectName: 'E2E Song',
    });

  const soundRoomEaseVerseHref = await page
    .locator('a[href*="/integrations/creatorhub"]')
    .first()
    .getAttribute('href');
  const soundRoomEaseVerseUrl = new URL(soundRoomEaseVerseHref!);
  expect(soundRoomEaseVerseUrl.searchParams.get('creatorhubProjectId')).toBe(
    'p1',
  );
  expect(soundRoomEaseVerseUrl.searchParams.get('audioReviewProjectId')).toBe(
    'room-1',
  );
  expect(soundRoomEaseVerseUrl.searchParams.get('externalTrackId')).toBe(
    'track-1',
  );

  expect(page.url()).toContain('/workspace/p1/sound-room');
  await expect(page.getByText('Sesjoner', { exact: true })).toBeVisible();
  await expect(page.getByText('Låter', { exact: true })).toBeVisible();
  await expect(page.getByText('Shotlist', { exact: true })).toHaveCount(0);
  await test.info().attach('sound-room-protools-pairing', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page
    .getByRole('button', { name: 'Åpne lydrommet', exact: true })
    .first()
    .click();
  await page.waitForURL('**/audio-review/room-1?ws=p1');
  await expect(
    page.getByText('Universal Showcase', { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Mix V2', { exact: true }).first()).toBeVisible();

  const comment = 'Vokal opp 1 dB ved refreng';
  const commentInput = page.getByPlaceholder(/kommentar/i).first();
  await commentInput.fill(comment);
  await commentInput.press('Enter');
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await expect
    .poll(() => commentPayload)
    .toMatchObject({
      versionId: 'version-2',
      body: comment,
      timecodeSeconds: 0,
    });

  await page.getByRole('button', { name: 'Godkjenn mix', exact: true }).click();
  await expect
    .poll(() => approvalPayload)
    .toEqual({ approvalType: 'mix_approved' });
  await expect.poll(() => showcaseApproved).toBe(true);
  await test.info().attach('sound-room-full-review-approved', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  expect(
    errors,
    `Runtime errors on complete music Sound Room flow:\n${errors.join('\n')}`,
  ).toEqual([]);
});
