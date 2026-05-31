import { expect, test, type Page } from '@playwright/test';

/**
 * Verifiserer offline replay-køen i producerWorkflowService: en mutasjon som
 * feiler fordi backend er nede skal (1) køes + speiles optimistisk lokalt, og
 * (2) replayes til backend ved neste vellykkede kontakt — FØR fetch overskriver
 * speilet — så ingen offline-skriving går tapt ved reconnect.
 *
 * Testen importerer tjenesten direkte i nettleseren (Vite serverer kildemodulen)
 * og toggler en mutbar `offline`-flagg i route-handleren for å simulere reconnect.
 */

const HARNESS = '/e2e-casting-test.html?session=content-producer&mode=content_producer';
const PROJECT_ID = 'queue-test-project';
const SERVICE_MODULE = '/src/components/role-room/services/producerWorkflowService.ts';

async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    const user = { id: 'e2e-test-user', email: 'e2e@test.local', role: 'admin', isAdmin: true };
    window.localStorage.setItem('creatorhub_auth_token', 'e2e-token');
    window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    window.localStorage.setItem('role_room_auth_token', 'e2e-role-room-token');
  });
}

test('producer timeline-mutasjon køes offline og replayes ved reconnect', async ({ page }) => {
  let offline = true;
  let timelinePostCount = 0;
  const serverItems: Array<Record<string, unknown>> = [];

  // Producer timeline-endepunkt: POST feiler med 401 mens offline, lykkes ellers.
  await page.route('**/api/role-room/projects/**/producer/timeline**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      timelinePostCount += 1;
      if (offline) {
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'auth_required' }) });
      }
      const item = { id: `real-timeline-${serverItems.length + 1}`, project_id: PROJECT_ID, phase: 'production', title: 'Offline milepæl', status: 'planned' };
      serverItems.push(item);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item }) });
    }
    // GET
    if (offline) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'auth_required' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: serverItems }) });
  });

  // Alt annet (settings/casting/øvrige role-room) → 401 så harnessen kjører backend-fritt.
  await page.route('**/api/settings**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"auth_required"}' }));
  await page.route('**/api/casting/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"auth_required"}' }));

  await seedAuth(page);
  await page.goto(HARNESS, { waitUntil: 'load', timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Nytt prosjekt' })).toBeVisible({ timeout: 30_000 });

  // 1) OFFLINE: opprett en timeline-milepæl via tjenesten direkte.
  const offlineResult = await page.evaluate(async ({ moduleUrl, projectId }) => {
    const mod = await import(/* @vite-ignore */ moduleUrl) as {
      producerWorkflowService: {
        getTimeline: (p: string) => Promise<unknown[]>;
        createTimelineItem: (p: string, payload: Record<string, unknown>) => Promise<{ id: string }>;
      };
    };
    try {
      const pre = await mod.producerWorkflowService.getTimeline(projectId);
      try {
        const created = await mod.producerWorkflowService.createTimelineItem(projectId, {
          phase: 'production',
          title: 'Offline milepæl',
        });
        return { id: created.id, preLen: pre.length, stage: 'ok' };
      } catch (e) {
        return { id: '', stage: 'create-failed', error: String((e as Error)?.message ?? e) };
      }
    } catch (e) {
      return { id: '', stage: 'getTimeline-failed', error: String((e as Error)?.message ?? e) };
    }
  }, { moduleUrl: SERVICE_MODULE, projectId: PROJECT_ID });

  // Optimistisk resultat har en lokal id, og det POSTet ble forsøkt (og feilet).
  expect(offlineResult.stage).toBe('ok');
  expect(offlineResult.id).toContain('producer-timeline');
  expect(timelinePostCount).toBe(1);

  // Køen + speilet skal inneholde mutasjonen.
  const offlineStorage = await page.evaluate((projectId) => {
    const find = (suffix: string) => {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && key.includes(projectId) && key.includes(suffix)) {
          return window.localStorage.getItem(key);
        }
      }
      return null;
    };
    return {
      queue: find('role-room-producer-mutation-queue'),
      mirror: find('role-room-producer-timeline-cache'),
    };
  }, PROJECT_ID);
  expect(offlineStorage.queue).toContain('Offline milepæl');
  expect(offlineStorage.mirror).toContain('Offline milepæl');

  // 2) RECONNECT: flipp backend tilgjengelig igjen. Neste lesning skal replaye
  //    køen FØR fetch, så den lokale skrivingen lander på backend.
  offline = false;
  const replayResult = await page.evaluate(async ({ moduleUrl, projectId }) => {
    const mod = await import(/* @vite-ignore */ moduleUrl) as {
      producerWorkflowService: { getTimeline: (p: string) => Promise<Array<{ id: string }>> };
    };
    const items = await mod.producerWorkflowService.getTimeline(projectId);
    return { count: items.length, ids: items.map((i) => i.id) };
  }, { moduleUrl: SERVICE_MODULE, projectId: PROJECT_ID });

  expect(replayResult.count).toBeGreaterThanOrEqual(1);
  expect(replayResult.ids.some((id) => id.startsWith('real-timeline-'))).toBe(true);

  // Køen skal være tømt etter vellykket replay.
  const drained = await page.evaluate((projectId) => {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.includes(projectId) && key.includes('role-room-producer-mutation-queue')) {
        return window.localStorage.getItem(key);
      }
    }
    return null;
  }, PROJECT_ID);
  expect(drained === null || drained === '[]').toBe(true);

  // Replay skal ha sendt POSTet på nytt (totalt 2: ett offline-forsøk + ett replay).
  expect(timelinePostCount).toBe(2);
});
