import { expect, test, type Page, type Route } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const ROOM_ID = '00000000-0000-4000-8000-000000000101';
const VERSION_IDS = Array.from({ length: 6 }, (_, index) =>
  `00000000-0000-4000-8000-${String(201 + index).padStart(12, '0')}`);
const COMMENT_ID = '00000000-0000-4000-8000-000000000301';
const TASK_ID = '00000000-0000-4000-8000-000000000401';

function wavTone(amplitude: number): Buffer {
  const sampleRate = 48_000;
  const sampleCount = sampleRate;
  const bytes = Buffer.alloc(44 + sampleCount * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + sampleCount * 2, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(sampleCount * 2, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = amplitude * Math.sin((2 * Math.PI * 440 * index) / sampleRate);
    bytes.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  return bytes;
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

async function installSoundRoomApi(page: Page, canEdit = true) {
  const versions = [...VERSION_IDS].reverse().map((id, index) => {
    const number = 6 - index;
    return {
      id,
      project_id: ROOM_ID,
      version_number: number,
      version_label: `Mix V${number}`,
      file_name: `creatorhub-mix-v${number}.wav`,
      file_url: `/e2e-audio-${number}.wav`,
      status: number === 6 ? 'review' : 'superseded',
      sample_rate: 48_000,
      bit_depth: 24,
      channels: 2,
      comment_count: number === 6 ? 1 : 0,
      created_at: `2026-09-${String(number).padStart(2, '0')}T10:00:00.000Z`,
    };
  });
  let comment = {
    id: COMMENT_ID,
    version_id: VERSION_IDS[5],
    author: 'Artist',
    author_role: 'Vokalist',
    body: 'Litt mer vokal i refrenget',
    timecode_seconds: 42,
    status: 'unresolved',
    is_decision: false,
    section_ref: 'Refreng',
    like_count: 0,
    created_at: '2026-09-12T10:00:00.000Z',
  };
  let tasks: Array<Record<string, unknown>> = [];
  let createdTaskBody: Record<string, unknown> | null = null;

  await page.addInitScript(() => {
    const user = { id: 'producer-e2e', email: 'producer@example.test', name: 'Producer' };
    localStorage.setItem('creatorhub_auth_token', 'sound-room-e2e-token');
    localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userEmail', user.email);
  });

  await page.route('**/e2e-audio-*.wav', (route) => {
    const number = Number(route.request().url().match(/audio-(\d+)\.wav/)?.[1] || 1);
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: wavTone(number === 6 ? 0.5 : 0.25) });
  });

  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/auth/user') return json(route, { authenticated: true, user: { id: 'producer-e2e', email: 'producer@example.test', name: 'Producer' } });
    if (path === `/api/audio-showcases/${ROOM_ID}` && method === 'GET') {
      return json(route, {
        project: { id: ROOM_ID, owner_user_id: 'producer-e2e', title: 'Recall E2E', artist_name: 'CreatorHub Artist', genre: 'Pop', bpm: 120, musical_key: 'C' },
        versions,
        members: [{ id: 'member-1', name: 'Producer', role: 'Produsent', is_owner: true, avatar_color: '#FF6B35' }],
        tasks,
        easeverseTrack: null,
        access: { canEdit },
      });
    }
    if (path.startsWith('/api/audio-versions/') && method === 'GET') {
      const active = path.endsWith(VERSION_IDS[5]);
      return json(route, { version: versions.find((version) => path.endsWith(version.id)), comments: active ? [comment] : [], sections: [], approvals: [] });
    }
    if (path === '/api/audio-tasks' && method === 'POST') {
      createdTaskBody = request.postDataJSON() as Record<string, unknown>;
      const created = { id: TASK_ID, project_id: ROOM_ID, version_id: VERSION_IDS[5], comment_id: COMMENT_ID, created_at: new Date().toISOString(), ...createdTaskBody };
      tasks = [created];
      return json(route, created, 201);
    }
    if (path === `/api/audio-tasks/${TASK_ID}` && method === 'PATCH') {
      const patch = request.postDataJSON() as Record<string, unknown>;
      tasks = tasks.map((task) => task.id === TASK_ID ? { ...task, ...patch } : task);
      return json(route, tasks[0]);
    }
    if (path === `/api/audio-comments/${COMMENT_ID}` && method === 'PATCH') {
      comment = { ...comment, ...(request.postDataJSON() as Record<string, unknown>) } as typeof comment;
      return json(route, comment);
    }
    if (path === `/api/protools/web/status`) return json(route, { connected: false, session: null });
    if (path.endsWith('/coaching')) return json(route, { items: [] });
    if (path.endsWith('/mood')) return json(route, { moods: [] });
    if (path.endsWith('/live-session')) return json(route, { live: false });
    if (path.endsWith('/release')) return json(route, { release: null });
    return json(route, {});
  });

  return { getCreatedTaskBody: () => createdTaskBody };
}

test('Sound Room preserves drafts and drives feedback through Recall Mode', async ({ page }) => {
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`[browser console] ${message.text()}`);
  });
  page.on('pageerror', (error) => console.error(`[browser pageerror] ${error.message}`));
  const api = await installSoundRoomApi(page);
  await page.goto(`/audio-review/${ROOM_ID}`);

  await expect(page.getByText('Recall E2E', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Recall Mode', { exact: true })).toBeVisible();
  await expect(page.getByText('Mix V2', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Se alle (6)' }).click();
  await expect(page.getByText('Mix V1', { exact: true })).toBeVisible();

  const composer = page.getByPlaceholder('Legg til en tidskodet kommentar…');
  await composer.fill('Denne kladden må overleve omstart');
  await page.reload();
  await expect(composer).toHaveValue('Denne kladden må overleve omstart');

  await page.getByText('Lag recall', { exact: true }).click();
  await expect(page.getByText('I Recall Mode', { exact: true })).toBeVisible();
  await expect(page.getByTitle('Litt mer vokal i refrenget')).toBeVisible();
  expect(api.getCreatedTaskBody()).toMatchObject({
    projectId: ROOM_ID,
    versionId: VERSION_IDS[5],
    commentId: COMMENT_ID,
    status: 'todo',
  });

  const statusButton = page.getByRole('button', { name: 'Endre status for Litt mer vokal i refrenget' });
  await statusButton.click();
  await expect(page.getByText('Pågår', { exact: true }).first()).toBeVisible();
  await statusButton.click();
  await expect(page.getByText('Recall ferdig ✓', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Løst' })).toBeVisible();

  await page.getByRole('button', { name: 'Start A/B' }).click();
  await expect(page.getByRole('button', { name: 'A · Gjeldende' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Nivåmatchet til .* LUFS/)).toBeVisible();
  await page.getByRole('button', { name: 'A · Gjeldende' }).click();
  await expect(page.getByRole('button', { name: 'B · Forrige' })).toBeVisible();
});

test('workspace readers see Recall Mode without producer mutation controls', async ({ page }) => {
  await installSoundRoomApi(page, false);
  await page.goto(`/audio-review/${ROOM_ID}`);

  await expect(page.getByText('Recall Mode', { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Lag recall', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kun produsenten kan endre' })).toBeDisabled();
  await expect(page.getByPlaceholder('Kun produsenten kan kommentere her')).toBeDisabled();
  await expect(page.getByText('Lesetilgang via workspace.', { exact: true })).toBeVisible();
});
