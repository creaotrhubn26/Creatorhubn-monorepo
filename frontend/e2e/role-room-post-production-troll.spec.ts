import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

const projectId = 'e2e-troll-production';
const mediaId = '8b49da36-ff43-4d8f-98dc-20ce0e39218d';
const storageObjectId = '92e76092-2716-4e26-8b77-b26a331919bb';
const workspaceProjectId = '6cae5551-4d32-4b22-8c26-79fa61f8c7b1';
const pictureVersionId = 'b70ea5f0-06a4-4a1b-b357-83d7872bdf9f';
const pictureStorageObjectId = 'f48ba060-ebf0-4509-b77a-e889716495ab';
const storyboardRoundId = '0f4813b2-ed6c-47c4-a982-7d8e9093c0a1';

async function installPostApi(page: Page) {
  let storedProject: Record<string, any> | null = null;
  let version = 0;
  let turnovers: Array<Record<string, any>> = [];
  let counter = 0;
  const commands: string[] = [];
  const commandBodies: Array<Record<string, any>> = [];
  const authenticatedRequests: string[] = [];
  const time = () => `2026-09-21T${String(12 + counter).padStart(2, '0')}:00:00.000Z`;
  const media = {
    id: mediaId, projectId, productionDayId: 'troll-day-1', storageObjectId,
    displayName: 'TROLL_1A_001.wav', contentType: 'audio/wav', sizeBytes: 48_000_000,
    checksumSha256: 'a'.repeat(64), reconciliationStatus: 'matched', continuityTakeId: 'troll-take-1',
    createdAt: '2026-09-21T10:00:00.000Z',
    recorderMetadata: {
      container: 'RIFF', audioFormat: 1, channels: 2, sampleRate: 48000,
      byteRate: 288000, blockAlign: 6, bitDepth: 24, dataSizeBytes: 47_999_000, warnings: [],
    },
  };
  const record = () => ({
    projectId, version, updatedBy: version ? 'e2e-test-user' : undefined, updatedAt: version ? time() : undefined,
    operations: { turnovers: turnovers.map((item) => ({ ...item, impact: { stale: false, blocking: false, items: [] } })) },
  });

  await page.route('**/api/casting/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/casting/health') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"healthy"}' });
    if (pathname === '/api/casting/projects' && request.method() === 'POST') {
      storedProject = request.postDataJSON() as Record<string, any>;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    }
    if (pathname === '/api/casting/projects' && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(storedProject ? [storedProject] : []) });
    }
    if (pathname === `/api/casting/projects/${projectId}` && request.method() === 'GET') {
      return route.fulfill({ status: storedProject ? 200 : 404, contentType: 'application/json', body: JSON.stringify(storedProject ?? {}) });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route(`**/api/role-room/projects/${projectId}/post-production**`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith(`/storyboard-sources/${storyboardRoundId}`) && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ storyboardSource: {
        id: storyboardRoundId, manuscriptId: 'troll-manus', manuscriptTitle: 'Troll', version: 3,
        label: 'Regigodkjent', summary: 'Låst visuelt grunnlag.', status: 'approved', snapshotHash: 'c'.repeat(64),
        frameCount: 2, totalDurationSeconds: 8, latestApprovedVersion: 3,
        submittedAt: '2026-09-21T08:00:00.000Z', approvedAt: '2026-09-21T09:00:00.000Z',
        scenes: [{ id: 'scene-1', heading: 'EXT. FJELL – NATT', sceneNumber: '1', frames: [
          { id: 'frame-1', shotNumber: '1A', description: 'Trollet reiser seg.', durationSeconds: 4 },
          { id: 'frame-2', shotNumber: '1B', description: 'Nora rygger.', durationSeconds: 4 },
        ] }],
      } }) });
    }
    if (pathname.endsWith('/storyboard-sources') && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ storyboardSources: { rounds: [{
        id: storyboardRoundId, manuscriptId: 'troll-manus', manuscriptTitle: 'Troll', version: 3,
        label: 'Regigodkjent', summary: 'Låst visuelt grunnlag.', status: 'approved', snapshotHash: 'c'.repeat(64),
        frameCount: 2, totalDurationSeconds: 8, latestApprovedVersion: 3,
        submittedAt: '2026-09-21T08:00:00.000Z', approvedAt: '2026-09-21T09:00:00.000Z',
      }] } }) });
    }
    if (pathname.endsWith('/picture-sources') && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pictureSources: {
        binding: { status: 'linked', workspaceProjectId },
        versions: [{
          id: pictureVersionId, versionNumber: 2, versionLabel: 'Director cut', status: 'under_review',
          displayName: 'TROLL_picture_v2.mp4', sizeBytes: 512_000_000, contentType: 'video/mp4',
          durationSeconds: 92, createdAt: '2026-09-21T09:30:00.000Z', isLatest: true,
        }],
      } }) });
    }
    if (request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ postProduction: record() }) });
    }
    const { expectedVersion, command } = request.postDataJSON() as { expectedVersion: number; command: Record<string, any> };
    expect(expectedVersion).toBe(version);
    commands.push(String(command.type));
    commandBodies.push(command);
    counter += 1;
    if (command.type === 'create_turnover') {
      turnovers = [{
        id: 'turnover-1', label: command.label, recipient: command.recipient, notes: command.notes, status: 'draft',
        source: {
          sourceType: 'production_sound', productionDayId: command.productionDayId, soundVersion: 2, capturedAt: time(), availableMediaIds: [mediaId],
          media: [{ mediaId, storageObjectId, displayName: media.displayName, checksumSha256: media.checksumSha256, sizeBytes: media.sizeBytes, reconciliationStatus: 'matched', continuityTakeId: 'troll-take-1', createdAt: media.createdAt }],
        },
        storyboardReference: command.storyboardReviewRoundId ? {
          reviewRoundId: storyboardRoundId, manuscriptId: 'troll-manus', manuscriptTitle: 'Troll',
          version: 3, label: 'Regigodkjent', snapshotHash: 'c'.repeat(64), scriptFingerprint: 'd'.repeat(64),
          status: 'approved', frameCount: 2, totalDurationSeconds: 8, latestApprovedVersionAtCapture: 3,
          capturedAt: time(),
          frames: (command.storyboardFrameIds as string[]).map((frameId) => ({
            frameId, sceneId: 'scene-1', sceneHeading: 'EXT. FJELL – NATT', sceneNumber: '1',
            shotNumber: frameId === 'frame-1' ? '1A' : '1B',
          })),
        } : undefined,
        issues: [],
        events: [{ id: 'created', type: 'created', message: `Opprettet turnover «${command.label}».`, actorUserId: 'e2e-test-user', createdAt: time() }],
        createdBy: 'e2e-test-user', createdAt: time(), updatedBy: 'e2e-test-user', updatedAt: time(),
      }];
    } else if (command.type === 'create_picture_turnover') {
      turnovers = [{
        id: 'picture-turnover-1', label: command.label, recipient: command.recipient, notes: command.notes, status: 'draft',
        source: {
          sourceType: 'picture', workspaceProjectId, versionId: pictureVersionId, versionNumber: 2,
          versionLabel: 'Director cut', versionStatus: 'under_review', storageObjectId: pictureStorageObjectId,
          displayName: 'TROLL_picture_v2.mp4', checksumSha256: 'b'.repeat(64), sizeBytes: 512_000_000,
          contentType: 'video/mp4', durationSeconds: 92, latestVersionNumberAtCapture: 2,
          versionCreatedAt: '2026-09-21T09:30:00.000Z', capturedAt: time(),
        },
        storyboardReference: command.storyboardReviewRoundId ? {
          reviewRoundId: storyboardRoundId, manuscriptId: 'troll-manus', manuscriptTitle: 'Troll',
          version: 3, label: 'Regigodkjent', snapshotHash: 'c'.repeat(64), scriptFingerprint: 'd'.repeat(64),
          status: 'approved', frameCount: 2, totalDurationSeconds: 8, latestApprovedVersionAtCapture: 3,
          capturedAt: time(),
          frames: (command.storyboardFrameIds as string[]).map((frameId) => ({
            frameId, sceneId: 'scene-1', sceneHeading: 'EXT. FJELL – NATT', sceneNumber: '1',
            shotNumber: frameId === 'frame-1' ? '1A' : '1B',
          })),
        } : undefined,
        issues: [],
        events: [{ id: 'picture-created', type: 'created', message: `Opprettet turnover «${command.label}».`, actorUserId: 'e2e-test-user', createdAt: time() }],
        createdBy: 'e2e-test-user', createdAt: time(), updatedBy: 'e2e-test-user', updatedAt: time(),
      }];
    } else {
      const turnover = turnovers.find((item) => item.id === command.turnoverId)!;
      if (command.type === 'transition_turnover') {
        const previous = turnover.status;
        turnover.status = command.status;
        turnover.events.push({ id: `event-${counter}`, type: 'status_changed', message: `Status: ${previous} → ${command.status}.`, actorUserId: 'e2e-test-user', createdAt: time() });
      } else if (command.type === 'add_qc_issue') {
        turnover.status = 'qc_issues';
        turnover.issues.push({ id: 'issue-1', severity: command.severity, message: command.message, status: 'open', createdBy: 'e2e-test-user', createdAt: time() });
        turnover.events.push({ id: `event-${counter}`, type: 'qc_issue_added', message: `QC-avvik: ${command.message}`, actorUserId: 'e2e-test-user', createdAt: time() });
      } else if (command.type === 'resolve_qc_issue') {
        turnover.issues = turnover.issues.map((issue: Record<string, any>) => issue.id === command.issueId ? { ...issue, status: 'resolved', resolvedBy: 'e2e-test-user', resolvedAt: time() } : issue);
        turnover.events.push({ id: `event-${counter}`, type: 'qc_issue_resolved', message: 'Løste QC-avvik: Manglende room tone.', actorUserId: 'e2e-test-user', createdAt: time() });
      }
      turnover.updatedAt = time();
    }
    version += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ postProduction: record() }) });
  });

  await page.route(`**/api/role-room/projects/${projectId}/production-days/*/production-sound/media`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ media: [media] }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/access`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access: {
      projectId, role: 'post_supervisor', roles: ['post_supervisor'], isOwner: false, isMember: true,
      permissions: {}, grants: { canPreparePostTurnover: true, canReviewPostTurnover: true },
    } }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/roles`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const role = { id: 'post-role', projectId, userId: 'e2e-test-user', role: 'post_supervisor' };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'GET' ? [role] : { role }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/production-days`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ productionDays: storedProject?.productionDays ?? [] }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/my-tabs`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tabAccess: null, source: 'default', role: 'post_supervisor', tabValues: null }) });
  });
  await page.route('**/api/role-room/casting-roles/*/selftapes', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/presence/heartbeat', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));

  return { commands, commandBodies, authenticatedRequests, record };
}

test.describe('Autentisert Troll-flyt · Post Supervisor, Post Sound og Editorial', () => {
  test('går fra privat recorderreferanse via mottak og QC til sporbar godkjenning', async ({ page }) => {
    const runtimeErrors: string[] = [];
    const targetedApiFailures: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(message.text())) runtimeErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && /\/api\/presence\/heartbeat|\/selftapes(?:[/?#]|$)/i.test(response.url())) targetedApiFailures.push(`${response.status()} ${response.url()}`);
    });
    const api = await installPostApi(page);

    await openCastingPlanner(page, {
      urlFlags: { seed: 'post-production-troll', session: 'post-supervisor', lens: 'post-production' },
    });
    await selectFirstProject(page);

    const workspace = page.getByTestId('post-production-workspace');
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('post-production');
    await page.getByTestId('post-surface-turnovers').click();
    await expect(page.getByText('TROLL_1A_001.wav')).toBeVisible();
    await page.getByLabel('Leveringsnotat').fill('Poly-WAV, lydrapport og eksplisitt take-kobling for dag 1.');
    await page.getByTestId('create-post-turnover').click();
    await expect(page.getByText('Turnover-manifestet er opprettet som et sporbart utkast.')).toBeVisible();
    await page.getByRole('button', { name: 'Gjør klar' }).click();
    await page.getByRole('button', { name: 'Bekreft mottatt' }).click();

    await page.getByTestId('post-surface-qc').click();
    await page.getByLabel('Nytt QC-avvik').fill('Manglende room tone.');
    await page.getByRole('button', { name: 'Legg til' }).click();
    await expect(page.getByText('Manglende room tone.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Marker løst' }).click();
    await expect(page.getByText('Alle QC-avvik er løst.')).toBeVisible();
    await page.getByRole('button', { name: 'Lever på nytt' }).click();
    await page.getByRole('button', { name: 'Bekreft mottatt' }).click();
    await page.getByRole('button', { name: 'Godkjenn turnover' }).click();
    await expect(page.getByTestId('post-turnover-turnover-1').getByText('Godkjent', { exact: true })).toBeVisible();

    await page.getByTestId('post-surface-activity').click();
    await expect(page.getByText('QC-avvik: Manglende room tone.', { exact: true })).toBeVisible();
    await expect(page.getByText('Status: received → accepted.')).toBeVisible();
    await page.reload();
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('post-surface-overview').click();
    await expect(page.getByTestId('post-turnover-turnover-1').getByText('Godkjent', { exact: true })).toBeVisible();

    expect(api.commands).toEqual([
      'create_turnover', 'transition_turnover', 'transition_turnover',
      'add_qc_issue', 'resolve_qc_issue', 'transition_turnover',
      'transition_turnover', 'transition_turnover',
    ]);
    expect(api.record().operations.turnovers[0].source.media[0]).toEqual(expect.objectContaining({ mediaId, storageObjectId }));
    expect(JSON.stringify(api.record())).not.toContain('objectKey');
    expect(api.authenticatedRequests.length).toBeGreaterThan(0);
    expect(api.authenticatedRequests.every((header) => header === 'Bearer dev-admin-local-session')).toBe(true);
    expect(runtimeErrors).toEqual([]);
    expect(targetedApiFailures).toEqual([]);
  });

  test('beholder touchmål og uten horisontal overflow i stående og liggende arbeidsflate', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await installPostApi(page);
    await openCastingPlanner(page, {
      urlFlags: { seed: 'post-production-troll', session: 'post-supervisor', lens: 'post-production' },
    });
    await selectFirstProject(page);
    const workspace = page.getByTestId('post-production-workspace');
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    const turnoverButton = page.getByTestId('post-surface-turnovers');
    expect((await turnoverButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await turnoverButton.click();
    await expect.poll(() => workspace.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

    await page.setViewportSize({ width: 1180, height: 820 });
    await expect(page.getByLabel('Manifestnavn')).toBeVisible();
    await expect.poll(() => workspace.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });

  test('leverer en S3-verifisert Video Room-versjon gjennom samme picture-QC-flyt', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(message.text())) runtimeErrors.push(message.text());
    });
    const api = await installPostApi(page);
    await openCastingPlanner(page, {
      urlFlags: { seed: 'post-production-troll', session: 'post-supervisor', lens: 'post-production' },
    });
    await selectFirstProject(page);
    await expect(page.getByTestId('post-production-workspace')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('post-surface-turnovers').click();
    await page.getByLabel('Kildetype').click();
    await page.getByRole('option', { name: 'Picture / klipp' }).click();

    await expect(page.getByText('TROLL_picture_v2.mp4').first()).toBeVisible();
    await expect(page.getByTestId('post-storyboard-linker')).toBeVisible();
    await page.getByLabel('Storyboard-revisjon').click();
    await page.getByRole('option', { name: /Troll · v3 · Regigodkjent/ }).click();
    await expect(page.getByText('2/2 paneler valgt')).toBeVisible();
    await page.getByTestId('post-storyboard-linker').getByRole('button', { name: 'Fjern alle' }).click();
    await expect(page.getByTestId('create-post-turnover')).toBeDisabled();
    expect(api.commands).toEqual([]);
    await page.getByTestId('post-storyboard-frame-frame-1').click();
    await expect(page.getByText('1/2 paneler valgt')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Åpne Video Room' })).toHaveAttribute(
      'href',
      `/workspace/${workspaceProjectId}/video-room`,
    );
    await page.getByLabel('Leveringsnotat').fill('Picture V2 med verifisert kontrollsum og privat lagringsreferanse.');
    await page.getByTestId('create-post-turnover').click();
    await expect(page.getByText('Turnover-manifestet er opprettet som et sporbart utkast.')).toBeVisible();
    await page.getByRole('button', { name: 'Gjør klar' }).click();
    await page.getByRole('button', { name: 'Bekreft mottatt' }).click();
    await page.getByRole('button', { name: 'Godkjenn turnover' }).click();
    await expect(page.getByTestId('post-turnover-picture-turnover-1').getByText('Godkjent', { exact: true })).toBeVisible();
    await expect(page.getByTestId('post-storyboard-reference-picture-turnover-1')).toContainText('Regigodkjent');

    expect(api.commands).toEqual([
      'create_picture_turnover', 'transition_turnover', 'transition_turnover', 'transition_turnover',
    ]);
    const source = api.record().operations.turnovers[0].source;
    expect(source).toEqual(expect.objectContaining({ sourceType: 'picture', versionId: pictureVersionId, storageObjectId: pictureStorageObjectId }));
    expect(JSON.stringify(api.record())).not.toContain('objectKey');
    expect(api.commandBodies[0]).toEqual(expect.objectContaining({
      storyboardReviewRoundId: storyboardRoundId,
      storyboardFrameIds: ['frame-1'],
    }));
    expect(runtimeErrors).toEqual([]);
  });
});
