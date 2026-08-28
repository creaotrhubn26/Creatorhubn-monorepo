import { expect, test, type Locator } from '@playwright/test';
import { installTauriMock } from './fixtures/tauri-mock';

async function domClick(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  await locator.evaluate((element) => (element as HTMLElement).click());
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installTauriMock);
  await page.route('**/api/role-room/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET' && path.endsWith('/mockup-projects')) {
      await route.fulfill({ json: { projects: [] } }); return;
    }
    await route.fulfill({ json: { ok: true, revision: 1, updatedAt: new Date().toISOString() } });
  });
  await page.goto('/');
  await expect(page.getByText('Mockup Studio').first()).toBeVisible();
});

test('Enkel/Avansert, fokus og responsiv topplinje fungerer', async ({ page }) => {
  await page.setViewportSize({ width: 1050, height: 760 });
  await expect(page.getByText('Oppsett', { exact: true })).toBeVisible();
  await expect(page.getByText('Fra simulator', { exact: true })).toHaveCount(0);

  await domClick(page.getByRole('button', { name: 'Avansert', exact: true }));
  await expect(page.getByText('Fra simulator', { exact: true })).toBeVisible();

  const quickExport = page.getByRole('button', { name: 'Eksporter PNG 2×' });
  const box = await quickExport.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1050);

  await domClick(page.getByRole('button', { name: 'Fokus', exact: true }));
  await expect(page.getByText('Fra simulator', { exact: true })).toHaveCount(0);
  await domClick(page.getByRole('button', { name: 'Vis paneler', exact: true }));
  await expect(page.getByText('Fra simulator', { exact: true })).toBeVisible();
});

test('semantisk connector beholder elementmålet', async ({ page }) => {
  await domClick(page.getByRole('button', { name: 'Avansert', exact: true }));
  await page.evaluate(() => {
    const store = (window as unknown as { __mockupStore: { getState: () => { addAnnotation: (kind: string) => void } } }).__mockupStore;
    store.getState().addAnnotation('connector');
  });
  const start = page.getByLabel('Connector startmål').last();
  await expect(start).toBeVisible();
  await start.selectOption({ index: 1 });
  const value = await start.inputValue();
  expect(value).toMatch(/^(device|image|text|canvas):/);
  await expect(page.getByText('Synkronisert', { exact: false })).toBeVisible({ timeout: 5000 });
});

test('IndexedDB beholder prosjektet når localStorage-kvoten er full', async ({ page }) => {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { __restoreStorage?: () => void }).__restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'trrpa.mockup.projects') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
    const store = (window as unknown as { __mockupStore: { getState: () => { setName: (name: string) => void } } }).__mockupStore;
    store.getState().setName('IDB overlever full kvote');
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window as unknown as { __restoreStorage?: () => void }).__restoreStorage?.());
  await domClick(page.getByRole('button', { name: '← Prosjekter' }));
  await expect(page.getByText('IDB overlever full kvote')).toBeVisible();
});

test('prosjektoversikten grupperer og sammenligner faktiske kampanjevarianter', async ({ page }) => {
  await page.evaluate(() => {
    const store = (window as unknown as { __mockupStore: { getState: () => { newFromTemplate: (id: string) => void } } }).__mockupStore;
    store.getState().newFromTemplate('previsit_campaign_1');
  });
  await domClick(page.getByRole('button', { name: '← Prosjekter' }));
  await expect(page.getByRole('heading', { name: 'Prosjekter og kampanjer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PreVisit-kampanje' })).toBeVisible();
  await domClick(page.getByRole('button', { name: 'Ny variant' }).first());
  await expect(page.getByText('2 varianter')).toBeVisible();
  await domClick(page.getByRole('button', { name: 'Åpne' }).first());

  await domClick(page.getByText('Mer ▾', { exact: true }));
  await domClick(page.getByRole('button', { name: '⚖ Sammenlign faktiske varianter' }));
  await expect(page.getByText(/2 faktiske, redigerbare varianter/)).toBeVisible();
});


test('Review Room åpner med versjon, kommentar og festet pin', async ({ page }) => {
  await page.route('**/api/role-room/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/mockup-projects') && route.request().method() === 'GET') {
      await route.fulfill({ json: { projects: [] } }); return;
    }
    if (path.endsWith('/versions')) {
      await route.fulfill({ json: { versions: [{ id: 'v1', label: 'Review 1', reviewStatus: 'in_review', createdAt: new Date().toISOString(), commentCount: 1 }] } }); return;
    }
    if (path.endsWith('/comments')) {
      await route.fulfill({ json: { accessRole: 'owner', comments: [{ id: 'c1', projectId: 'p', versionId: 'v1', number: 4, parentId: null, authorKind: 'reviewer', authorUserId: null, reviewerSessionId: 'r1', authorDisplayName: 'Kunde', body: 'Flytt kortet litt opp', anchorKind: 'canvas', anchorRef: null, anchorX: 0.52, anchorY: 0.48, status: 'open', priority: 'normal', assignedTo: null, resolvedBy: null, resolvedAt: null, editedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), attachments: [], reactions: {} }] } }); return;
    }
    if (path.endsWith('/review-summary')) {
      await route.fulfill({ json: { versions: [], decisions: [], presence: [], accessRole: 'owner' } }); return;
    }
    if (path.endsWith('/shares')) { await route.fulfill({ json: { shares: [] } }); return; }
    if (path.endsWith('/collaborators')) { await route.fulfill({ json: { collaborators: [] } }); return; }
    if (path.endsWith('/webhooks')) { await route.fulfill({ json: { webhooks: [] } }); return; }
    if (path.endsWith('/mockup-notifications')) { await route.fulfill({ json: { notifications: [], unreadCount: 0 } }); return; }
    await route.fulfill({ json: { ok: true, revision: 1, updatedAt: new Date().toISOString() } });
  });
  await page.evaluate(() => localStorage.setItem('trrpa.settings', JSON.stringify({ RR_BEARER_TOKEN: 'test-token', RR_POST_AGENT_BASE_URL: 'http://localhost:5001' })));
  await page.reload();
  await expect(page.getByRole('button', { name: /Review Room/ })).toBeVisible();
  await domClick(page.getByRole('button', { name: /Review Room/ }));
  await expect(page.getByRole('complementary', { name: 'Review Room' })).toBeVisible();
  await expect(page.getByText('Flytt kortet litt opp')).toBeVisible();
  const pin = page.getByRole('button', { name: 'Kommentar #4 fra Kunde' });
  await expect(pin).toBeVisible();
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('toolbar', { name: 'Review-verktøy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Frihånd' })).toBeVisible();
  await domClick(page.getByRole('button', { name: 'Frihånd' }));
  await expect(page.getByRole('application', { name: 'Dra for å markere i designet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Festede' })).toBeVisible();
});

test('Review Room laster opp lokale bilder uten WebKit Load failed', async ({ page }) => {
  const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nAsAAAAASUVORK5CYII=';
  let reviewCreated = false;
  let uploadedAssets = 0;
  await page.route('**/api/role-room/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith('/storage/upload') && method === 'POST') {
      uploadedAssets += 1;
      await route.fulfill({ json: { file: { id: 'asset-medside' } } }); return;
    }
    if (path.endsWith('/share') && method === 'POST') {
      reviewCreated = true;
      await route.fulfill({ status: 201, json: { url: 'https://theroleroom.com/mockup-review/test-token', reviewPath: '/mockup-review/test-token', shareId: 's1', versionId: 'v1', expiresAt: null } }); return;
    }
    if (path.endsWith('/versions')) {
      await route.fulfill({ json: { versions: reviewCreated ? [{ id: 'v1', label: 'Review 1', reviewStatus: 'in_review', createdAt: new Date().toISOString(), commentCount: 0 }] : [] } }); return;
    }
    if (path.endsWith('/comments')) { await route.fulfill({ json: { accessRole: 'owner', comments: [] } }); return; }
    if (path.endsWith('/review-summary')) { await route.fulfill({ json: { versions: [], decisions: [], presence: [], accessRole: 'owner' } }); return; }
    if (path.endsWith('/shares')) { await route.fulfill({ json: { shares: [] } }); return; }
    if (path.endsWith('/collaborators')) { await route.fulfill({ json: { collaborators: [] } }); return; }
    if (path.endsWith('/webhooks')) { await route.fulfill({ json: { webhooks: [] } }); return; }
    if (path.endsWith('/mockup-notifications')) { await route.fulfill({ json: { notifications: [], unreadCount: 0 } }); return; }
    await route.fulfill({ json: { ok: true, revision: 1, updatedAt: new Date().toISOString() } });
  });

  await page.evaluate((png) => {
    const internals = (globalThis as unknown as { __TAURI_INTERNALS__: { invoke: (command: string, args?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
    const originalInvoke = internals.invoke;
    internals.invoke = async (command: string, args?: unknown) =>
      command === 'read_image_b64' ? png : originalInvoke(command, args);
    type TestDoc = {
      devices: unknown[]; images?: unknown[]; annotations?: unknown[];
      canvas: Record<string, unknown>; [key: string]: unknown;
    };
    const store = (window as unknown as { __mockupStore: { getState: () => {
      doc: TestDoc; setDocument: (doc: TestDoc) => void; addImage: (source: string) => void;
    } } }).__mockupStore;
    const state = store.getState();
    state.setDocument({ ...state.doc, devices: [], images: [], annotations: [], canvas: { ...state.doc.canvas, logo: undefined } });
    store.getState().addImage('/tmp/medside-documentary.jpg');
  }, onePixelPng);

  await domClick(page.getByRole('button', { name: /Review Room/ }));
  await domClick(page.getByRole('button', { name: 'Opprett Review Room' }));
  await expect(page.getByText('Ny, uforanderlig review-versjon opprettet', { exact: false })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(uploadedAssets).toBe(1);
});

test('Change Set gjør review-feedback til redigerbar endring og ny versjon', async ({ page }) => {
  let appliedProject: Record<string, unknown> | null = null;
  let applied = false;
  const comment: Record<string, unknown> = {
    id: '11111111-1111-4111-8111-111111111111', projectId: 'p1', versionId: '1', number: 4,
    parentId: null, authorKind: 'reviewer', authorUserId: null, reviewerSessionId: 'r1',
    authorDisplayName: 'Kunde', body: 'Flytt overskriften litt opp', anchorKind: 'element',
    anchorRef: 'text:headline', anchorX: 0.3, anchorY: 0.2, anchorOffsetX: 0.5, anchorOffsetY: 0.5,
    marks: [], status: 'open', priority: 'normal', assignedTo: null, resolvedBy: null,
    resolvedAt: null, editedAt: null, createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), attachments: [], reactions: {},
  };
  let changeSet: Record<string, unknown> | null = null;

  await page.route('**/api/role-room/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path.endsWith('/versions') && method === 'GET') {
      await route.fulfill({ json: { versions: [
        ...(applied ? [{ id: '2', label: 'Applied · Flytt overskrift', reviewStatus: 'draft', sourceRevision: 3, createdAt: new Date().toISOString(), commentCount: 0 }] : []),
        { id: '1', label: 'Review 1', reviewStatus: 'changes_requested', sourceRevision: 2, createdAt: new Date().toISOString(), commentCount: 1 },
      ] } }); return;
    }
    if (path.endsWith('/comments') && method === 'GET') {
      await route.fulfill({ json: { accessRole: 'owner', comments: [comment] } }); return;
    }
    if (path.endsWith('/change-sets') && method === 'GET') {
      await route.fulfill({ json: { accessRole: 'owner', changeSets: changeSet ? [changeSet] : [] } }); return;
    }
    if (path.endsWith('/change-sets/generate') && method === 'POST') {
      changeSet = {
        id: '22222222-2222-4222-8222-222222222222', projectId: 'p1', versionId: '1',
        sourceCommentIds: [comment.id], sourceRevision: 2, title: 'Flytt overskrift',
        summary: 'Flytter overskriften opp i komposisjonen.', status: 'proposed',
        operations: [{ id: 'op_1', targetRef: 'text:headline', targetLabel: 'Overskrift', field: 'y', label: '#4: flytt opp', before: 100, value: 80 }],
        generator: 'local-rules-v1', confidence: .82, appliedVersionId: null,
        reviewedAt: null, reviewNote: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      await route.fulfill({ status: 201, json: { changeSet } }); return;
    }
    if (path.includes('/change-sets/') && method === 'PATCH') {
      changeSet = { ...(changeSet || {}), ...(route.request().postDataJSON() as Record<string, unknown>) };
      await route.fulfill({ json: { changeSet } }); return;
    }
    if (path.endsWith('/apply') && method === 'POST') {
      const payload = route.request().postDataJSON() as { project: Record<string, unknown> };
      appliedProject = payload.project;
      applied = true;
      comment.status = 'resolved';
      changeSet = { ...(changeSet || {}), status: 'applied', appliedVersionId: '2', reviewedAt: new Date().toISOString() };
      await route.fulfill({ json: {
        project: payload.project, revision: 3, updatedAt: new Date().toISOString(),
        version: { id: '2', label: 'Applied · Flytt overskrift', reviewStatus: 'draft', sourceRevision: 3, createdAt: new Date().toISOString() },
        changeSet,
      } }); return;
    }
    if (path.endsWith('/review-summary')) {
      await route.fulfill({ json: { versions: [], decisions: [], presence: [], accessRole: 'owner' } }); return;
    }
    if (path.endsWith('/shares')) { await route.fulfill({ json: { shares: [] } }); return; }
    if (path.endsWith('/collaborators')) { await route.fulfill({ json: { collaborators: [] } }); return; }
    if (path.endsWith('/webhooks')) { await route.fulfill({ json: { webhooks: [] } }); return; }
    if (path.endsWith('/mockup-notifications')) { await route.fulfill({ json: { notifications: [], unreadCount: 0 } }); return; }
    await route.fulfill({ json: { ok: true, revision: 2, updatedAt: new Date().toISOString() } });
  });

  await page.evaluate(() => {
    localStorage.setItem('trrpa.settings', JSON.stringify({ RR_BEARER_TOKEN: 'test-token', RR_POST_AGENT_BASE_URL: 'http://localhost:5001' }));
    type TestDoc = { texts: Array<Record<string, unknown>>; devices: unknown[]; images?: unknown[]; annotations?: unknown[]; [key: string]: unknown };
    const store = (window as unknown as { __mockupStore: { getState: () => { doc: TestDoc; setDocument: (doc: TestDoc) => void } } }).__mockupStore;
    const state = store.getState();
    const baseText = state.doc.texts[0];
    state.setDocument({
      ...state.doc,
      id: 'p1',
      devices: [],
      images: [],
      annotations: [],
      texts: [{ ...baseText, id: 'headline', text: 'Før', x: 100, y: 100 }],
      updatedAt: Date.now(),
    });
  });
  await page.reload();

  await domClick(page.getByRole('button', { name: /Review Room/ }));
  await domClick(page.getByRole('button', { name: 'Endringer', exact: true }));
  await page.getByLabel('Velg kommentar #4 for endringsforslag').check();
  await domClick(page.getByRole('button', { name: 'Lag smart endringsforslag (1)' }));
  await expect(page.getByLabel('Endringsforslag tittel')).toHaveValue('Flytt overskrift');
  const after = page.getByLabel('#4: flytt opp etter');
  await expect(after).toHaveValue('80');
  await after.fill('70');
  await domClick(page.getByRole('button', { name: 'Godta og bruk' }));

  await expect(page.getByText('Endringene er brukt, kommentarene er løst og en ny versjon er opprettet', { exact: false })).toBeVisible();
  const y = await page.evaluate(() => {
    const store = (window as unknown as { __mockupStore: { getState: () => { doc: { texts: Array<{ id: string; y: number }> } } } }).__mockupStore;
    return store.getState().doc.texts.find((item) => item.id === 'headline')?.y;
  });
  expect(y).toBe(70);
  expect(((appliedProject?.texts as Array<{ y: number }>) || [])[0]?.y).toBe(70);
});
