import { expect, test, type Page } from '@playwright/test';

type ProjectRecord = {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  roles?: unknown[];
  candidates?: unknown[];
  crew?: unknown[];
  schedules?: unknown[];
  locations?: unknown[];
  props?: unknown[];
  productionDays?: unknown[];
  shotLists?: unknown[];
  sceneBreakdowns?: unknown[];
  userRoles?: unknown[];
  ownerId?: string;
  createdBy?: string;
  status?: string;
  archivedAt?: string | null;
  previousStatus?: string | null;
  [key: string]: unknown;
};

const TEST_PAGE = '/e2e-service-test.html';
const SERVICE_IMPORT = '/src/components/role-room/services/castingService.ts';
const SETTINGS_IMPORT = '/src/components/role-room/services/settingsService.ts';

async function installCastingProjectApiMock(page: Page) {
  const remoteProjects = new Map<string, ProjectRecord>();
  let failSaves = false;

  await page.route('**/api/casting/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === '/api/casting/health') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'healthy' }),
      });
      return;
    }

    if (pathname === '/api/casting/projects' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(Array.from(remoteProjects.values())),
      });
      return;
    }

    if (pathname === '/api/casting/projects' && request.method() === 'POST') {
      if (failSaves) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'mock database unavailable' }),
        });
        return;
      }

      const project = request.postDataJSON() as ProjectRecord;
      remoteProjects.set(project.id, {
        roles: [],
        candidates: [],
        crew: [],
        schedules: [],
        locations: [],
        props: [],
        productionDays: [],
        shotLists: [],
        sceneBreakdowns: [],
        userRoles: [],
        ...project,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(remoteProjects.get(project.id)),
      });
      return;
    }

    const match = pathname.match(/^\/api\/casting\/projects\/([^/]+)$/);
    if (match && request.method() === 'GET') {
      const projectId = decodeURIComponent(match[1] ?? '');
      const project = remoteProjects.get(projectId);
      await route.fulfill({
        status: project ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(project ?? { error: 'not found' }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled mock route: ${request.method()} ${pathname}` }),
    });
  });

  return {
    getRemoteProject: (projectId: string) => remoteProjects.get(projectId),
    setFailSaves: (next: boolean) => {
      failSaves = next;
    },
  };
}

async function installSettingsApiMock(page: Page) {
  const remoteSettings = new Map<string, unknown>();
  const keyFor = (userId: string, namespace: string, projectId?: string | null) =>
    `${userId}::${projectId || ''}::${namespace}`;

  await page.route('**/api/settings**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname !== '/api/settings') {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: `Unhandled settings route: ${request.method()} ${url.pathname}` }),
      });
      return;
    }

    if (request.method() === 'GET') {
      const userId = url.searchParams.get('user_id') || 'default-user';
      const namespace = url.searchParams.get('namespace') || '';
      const projectId = url.searchParams.get('project_id') || '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: remoteSettings.get(keyFor(userId, namespace, projectId)) ?? null }),
      });
      return;
    }

    if (request.method() === 'PUT') {
      const payload = request.postDataJSON() as {
        userId?: string;
        user_id?: string;
        namespace?: string;
        projectId?: string;
        project_id?: string;
        data?: unknown;
      };
      const userId = payload.userId || payload.user_id || 'default-user';
      const namespace = payload.namespace || '';
      const projectId = payload.projectId || payload.project_id || '';
      remoteSettings.set(keyFor(userId, namespace, projectId), payload.data ?? null);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (request.method() === 'DELETE') {
      const userId = url.searchParams.get('user_id') || 'default-user';
      const namespace = url.searchParams.get('namespace') || '';
      const projectId = url.searchParams.get('project_id') || '';
      remoteSettings.delete(keyFor(userId, namespace, projectId));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled settings method: ${request.method()}` }),
    });
  });

  return {
    getRemoteSetting: (userId: string, namespace: string, projectId?: string | null) =>
      remoteSettings.get(keyFor(userId, namespace, projectId)),
  };
}

async function prepareServicePage(page: Page) {
  await page.goto(TEST_PAGE, { waitUntil: 'load' });
  await page.evaluate(() => {
    window.localStorage.clear();
    (window as Window & { __currentUserId?: string }).__currentUserId = 'sync-persistence-user';
  });
}

test.describe('Role Room casting project sync persistence', () => {
  test('server-confirmed project saves survive reload and resync', async ({ page }) => {
    const api = await installCastingProjectApiMock(page);
    await prepareServicePage(page);

    const projectId = `sync-project-${Date.now().toString(36)}`;

    const firstSave = await page.evaluate(async ({ importPath, projectId }) => {
      const { castingService } = await import(importPath);
      const project = {
        id: projectId,
        name: 'Persistent Sync Project',
        description: 'Created by persistence smoke test',
        roles: [],
        candidates: [],
        crew: [],
        schedules: [],
        locations: [],
        props: [],
        productionDays: [],
        shotLists: [],
        sceneBreakdowns: [],
        userRoles: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await castingService.saveProject(project);
      return {
        meta: await castingService.getProjectSyncMeta(projectId),
        loaded: await castingService.getProject(projectId),
      };
    }, { importPath: SERVICE_IMPORT, projectId });

    expect(firstSave.loaded?.name).toBe('Persistent Sync Project');
    expect(firstSave.meta.queuedChangeCount).toBe(0);
    expect(firstSave.meta.lastSyncedAt).toBeTruthy();
    expect(api.getRemoteProject(projectId)?.name).toBe('Persistent Sync Project');

    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => {
      (window as Window & { __currentUserId?: string }).__currentUserId = 'sync-persistence-user';
    });

    const afterReload = await page.evaluate(async ({ importPath, projectId }) => {
      const { castingService } = await import(`${importPath}?afterReload=${Date.now()}`);
      const loaded = await castingService.getProject(projectId);
      const resynced = await castingService.resyncProjectFromServer(projectId);
      const meta = await castingService.getProjectSyncMeta(projectId);
      return { loaded, resynced, meta };
    }, { importPath: SERVICE_IMPORT, projectId });

    expect(afterReload.loaded?.id).toBe(projectId);
    expect(afterReload.resynced?.name).toBe('Persistent Sync Project');
    expect(afterReload.meta.queuedChangeCount).toBe(0);
    expect(afterReload.meta.lastResyncedAt).toBeTruthy();
  });

  test('failed project saves are queued locally and later synced to server', async ({ page }) => {
    const api = await installCastingProjectApiMock(page);
    await prepareServicePage(page);

    const projectId = `queued-project-${Date.now().toString(36)}`;
    api.setFailSaves(true);

    const queuedSave = await page.evaluate(async ({ importPath, projectId }) => {
      const { castingService } = await import(importPath);
      await castingService.saveProject({
        id: projectId,
        name: 'Queued Sync Project',
        roles: [],
        candidates: [],
        crew: [],
        schedules: [],
        locations: [],
        props: [],
        productionDays: [],
        shotLists: [],
        sceneBreakdowns: [],
        userRoles: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return {
        meta: await castingService.getProjectSyncMeta(projectId),
        queued: await castingService.getQueuedProjectChanges(projectId),
        loaded: await castingService.getProject(projectId),
      };
    }, { importPath: SERVICE_IMPORT, projectId });

    expect(queuedSave.loaded?.name).toBe('Queued Sync Project');
    expect(queuedSave.meta.queuedChangeCount).toBe(1);
    expect(queuedSave.meta.lastError).toContain('Failed to save project');
    expect(queuedSave.queued).toHaveLength(1);
    expect(api.getRemoteProject(projectId)).toBeUndefined();

    api.setFailSaves(false);

    const synced = await page.evaluate(async ({ importPath, projectId }) => {
      const { castingService } = await import(importPath);
      const result = await castingService.syncQueuedProjectChanges(projectId);
      return {
        result,
        meta: await castingService.getProjectSyncMeta(projectId),
        loaded: await castingService.getProject(projectId),
        queued: await castingService.getQueuedProjectChanges(projectId),
      };
    }, { importPath: SERVICE_IMPORT, projectId });

    expect(synced.result.synced).toContain(projectId);
    expect(synced.result.failed).toHaveLength(0);
    expect(synced.meta.queuedChangeCount).toBe(0);
    expect(synced.meta.lastError).toBeFalsy();
    expect(synced.queued).toHaveLength(0);
    expect(synced.loaded?.name).toBe('Queued Sync Project');
    expect(api.getRemoteProject(projectId)?.name).toBe('Queued Sync Project');
  });

  test('cross-project child payloads are rejected before local or remote save', async ({ page }) => {
    const api = await installCastingProjectApiMock(page);
    await prepareServicePage(page);

    const projectId = `scoped-project-${Date.now().toString(36)}`;
    const otherProjectId = `other-project-${Date.now().toString(36)}`;

    const result = await page.evaluate(async ({ importPath, projectId, otherProjectId }) => {
      const { castingService } = await import(importPath);
      await castingService.saveProject({
        id: projectId,
        name: 'Scoped Project',
        roles: [],
        candidates: [],
        crew: [],
        schedules: [],
        locations: [],
        props: [],
        productionDays: [],
        shotLists: [],
        sceneBreakdowns: [],
        userRoles: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      let errorMessage = '';
      try {
        await castingService.saveRole(projectId, {
          id: 'role-cross-project',
          projectId: otherProjectId,
          name: 'Wrong Scope Role',
          description: 'Should be rejected',
          status: 'casting',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      const loaded = await castingService.getProject(projectId);
      const auditRaw = window.localStorage.getItem('role-room-cross-project-attempts');
      const audit = auditRaw ? JSON.parse(auditRaw) : [];
      return {
        errorMessage,
        roleCount: loaded?.roles?.length ?? 0,
        auditFirst: Array.isArray(audit) ? audit[0] : null,
      };
    }, { importPath: SERVICE_IMPORT, projectId, otherProjectId });

    expect(result.errorMessage).toContain('annet prosjekt');
    expect(result.roleCount).toBe(0);
    expect(result.auditFirst?.routeProjectId).toBe(projectId);
    expect(result.auditFirst?.payloadProjectId).toBe(otherProjectId);
    expect(api.getRemoteProject(projectId)?.roles).toHaveLength(0);
  });

  test('protected demo ids cannot be mutated outside seed flow', async ({ page }) => {
    const api = await installCastingProjectApiMock(page);
    await prepareServicePage(page);

    const result = await page.evaluate(async ({ importPath }) => {
      const { castingService } = await import(importPath);
      const demoProjectId = castingService.getContentProducerDemoProjectId();
      let errorMessage = '';
      try {
        await castingService.saveProject({
          id: demoProjectId,
          name: 'Should Not Persist',
          projectKind: 'demo',
          roles: [],
          candidates: [],
          crew: [],
          schedules: [],
          locations: [],
          props: [],
          productionDays: [],
          shotLists: [],
          sceneBreakdowns: [],
          userRoles: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
      const loaded = await castingService.getProject(demoProjectId);
      return { demoProjectId, errorMessage, loaded };
    }, { importPath: SERVICE_IMPORT });

    expect(result.errorMessage).toContain('Demo-ID er låst');
    expect(result.loaded).toBeNull();
    expect(api.getRemoteProject(result.demoProjectId)).toBeUndefined();
  });

  test('project copies exclude client data, secrets, review history and economy unless explicitly selected', async ({ page }) => {
    await installCastingProjectApiMock(page);
    await prepareServicePage(page);

    const projectId = `copy-source-${Date.now().toString(36)}`;

    const result = await page.evaluate(async ({ importPath, projectId }) => {
      const { castingService } = await import(importPath);
      await castingService.saveProject({
        id: projectId,
        name: 'Copy Source Project',
        clientName: 'Sensitive Client',
        clientEmail: 'client@example.com',
        budget: 50000,
        currency: 'NOK',
        producerWorkflowMeta: {
          pendingReviewCount: 2,
          deliverableReviewCount: 4,
          lastDecisionAt: new Date().toISOString(),
        },
        producerPlanning: {
          accountAccess: {
            entries: [{ platform: 'instagram', password: 'never-copy-this' }],
          },
          collaborationTerms: {
            compensationModel: 'growth',
          },
        },
        roles: [{ id: 'role-1', projectId, name: 'Director', status: 'casting' }],
        candidates: [],
        crew: [{ id: 'crew-1', projectId, name: 'Producer', role: 'producer' }],
        schedules: [],
        locations: [],
        props: [],
        productionDays: [{ id: 'day-1', projectId, title: 'Shoot day' }],
        shotLists: [],
        sceneBreakdowns: [],
        userRoles: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const safeCopy = await castingService.createProjectCopy(projectId, {
        name: 'Safe Copy',
        includeSecrets: true,
      });
      const explicitCopy = await castingService.createProjectCopy(projectId, {
        name: 'Explicit Copy',
        includeClientData: true,
        includeReviewHistory: true,
        includeEconomy: true,
        includeSecrets: true,
      });

      const safePlanning = (safeCopy.producerPlanning ?? {}) as Record<string, unknown>;
      const explicitPlanning = (explicitCopy.producerPlanning ?? {}) as Record<string, unknown>;

      return {
        safeCopy: {
          id: safeCopy.id,
          sourceTemplateId: safeCopy.sourceTemplateId,
          hasClientName: Boolean(safeCopy.clientName),
          hasClientEmail: Boolean(safeCopy.clientEmail),
          hasBudget: typeof safeCopy.budget === 'number',
          hasCurrency: Boolean(safeCopy.currency),
          hasReviewMeta: Boolean(safeCopy.producerWorkflowMeta),
          hasAccountAccess: Boolean(safePlanning.accountAccess),
          hasCollaborationTerms: Boolean(safePlanning.collaborationTerms),
          crewCount: safeCopy.crew.length,
          productionDayCount: safeCopy.productionDays?.length ?? 0,
          ownerId: safeCopy.ownerId,
          createdBy: safeCopy.createdBy,
        },
        explicitCopy: {
          id: explicitCopy.id,
          clientName: explicitCopy.clientName,
          clientEmail: explicitCopy.clientEmail,
          budget: explicitCopy.budget,
          currency: explicitCopy.currency,
          hasReviewMeta: Boolean(explicitCopy.producerWorkflowMeta),
          hasAccountAccess: Boolean(explicitPlanning.accountAccess),
          hasCollaborationTerms: Boolean(explicitPlanning.collaborationTerms),
        },
      };
    }, { importPath: SERVICE_IMPORT, projectId });

    expect(result.safeCopy.sourceTemplateId).toBe(projectId);
    expect(result.safeCopy.hasClientName).toBe(false);
    expect(result.safeCopy.hasClientEmail).toBe(false);
    expect(result.safeCopy.hasBudget).toBe(false);
    expect(result.safeCopy.hasCurrency).toBe(false);
    expect(result.safeCopy.hasReviewMeta).toBe(false);
    expect(result.safeCopy.hasAccountAccess).toBe(false);
    expect(result.safeCopy.hasCollaborationTerms).toBe(false);
    expect(result.safeCopy.crewCount).toBe(1);
    expect(result.safeCopy.productionDayCount).toBe(1);
    expect(result.safeCopy.ownerId).toBe('sync-persistence-user');
    expect(result.safeCopy.createdBy).toBe('sync-persistence-user');

    expect(result.explicitCopy.clientName).toBe('Sensitive Client');
    expect(result.explicitCopy.clientEmail).toBe('client@example.com');
    expect(result.explicitCopy.budget).toBe(50000);
    expect(result.explicitCopy.currency).toBe('NOK');
    expect(result.explicitCopy.hasReviewMeta).toBe(true);
    expect(result.explicitCopy.hasCollaborationTerms).toBe(true);
    expect(result.explicitCopy.hasAccountAccess).toBe(false);
  });

  test('project archive and restore are persisted through the project save path', async ({ page }) => {
    const api = await installCastingProjectApiMock(page);
    await prepareServicePage(page);

    const projectId = `archive-project-${Date.now().toString(36)}`;

    const result = await page.evaluate(async ({ importPath, projectId }) => {
      const { castingService } = await import(importPath);
      await castingService.saveProject({
        id: projectId,
        name: 'Archive Lifecycle Project',
        status: 'active',
        roles: [],
        candidates: [],
        crew: [],
        schedules: [],
        locations: [],
        props: [],
        productionDays: [],
        shotLists: [],
        sceneBreakdowns: [],
        userRoles: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const archived = await castingService.archiveProject(projectId);
      const isArchivedAfterArchive = castingService.isArchivedProject(archived);
      const restored = await castingService.restoreArchivedProject(projectId);
      const loaded = await castingService.getProject(projectId);

      return {
        archived: {
          status: archived.status,
          previousStatus: archived.previousStatus,
          hasArchivedAt: Boolean(archived.archivedAt),
          archivedBy: archived.archivedBy,
          isArchivedAfterArchive,
        },
        restored: {
          status: restored.status,
          hasArchivedAt: Boolean(restored.archivedAt),
          previousStatus: restored.previousStatus ?? null,
          isArchivedAfterRestore: castingService.isArchivedProject(restored),
        },
        loaded: {
          status: loaded?.status,
          hasArchivedAt: Boolean(loaded?.archivedAt),
        },
      };
    }, { importPath: SERVICE_IMPORT, projectId });

    expect(result.archived.status).toBe('archived');
    expect(result.archived.previousStatus).toBe('active');
    expect(result.archived.hasArchivedAt).toBe(true);
    expect(result.archived.archivedBy).toBe('sync-persistence-user');
    expect(result.archived.isArchivedAfterArchive).toBe(true);
    expect(result.restored.status).toBe('active');
    expect(result.restored.hasArchivedAt).toBe(false);
    expect(result.restored.previousStatus).toBeNull();
    expect(result.restored.isArchivedAfterRestore).toBe(false);
    expect(result.loaded.status).toBe('active');
    expect(result.loaded.hasArchivedAt).toBe(false);
    expect(api.getRemoteProject(projectId)?.status).toBe('active');
    expect(api.getRemoteProject(projectId)?.archivedAt).toBeNull();
  });

  test('workspace state is server-backed per real project and remote wins over stale local cache', async ({ page }) => {
    const settingsApi = await installSettingsApiMock(page);
    await prepareServicePage(page);

    const namespace = 'roleRoom_workspaceState_content_producer';
    const userId = 'sync-persistence-user';
    const staleLocalState = {
      projectId: 'content-producer-demo',
      lastRealProjectId: 'content-producer-demo',
      activeTab: 0,
      storyArcView: 'main',
      projectStates: {},
    };
    const serverWorkspaceState = {
      projectId: 'project-real-b',
      lastRealProjectId: 'project-real-b',
      activeTab: 11,
      storyArcView: 'planning',
      storyArcFocus: { section: 'shot-list', itemId: 'shot-4' },
      contentProducerPlannerSurface: 'approval',
      producerMediaFocus: { workspace: 'brief', sectionId: 'brand' },
      contentProducerResumeTarget: {
        surface: 'project_room',
        mediaFocus: { workspace: 'brief', sectionId: 'brand' },
      },
      projectStates: {
        'project-real-a': {
          projectId: 'project-real-a',
          activeTab: 2,
          storyArcView: 'story-logic',
          storyArcFocus: { section: 'beat', itemId: 'beat-1' },
          contentProducerPlannerSurface: 'project_room',
          producerMediaFocus: { workspace: 'storyboard' },
          contentProducerResumeTarget: null,
          scrollBySurface: {
            'story_arc:story-logic': { top: 320, left: 0, updatedAt: '2026-04-11T10:00:00.000Z' },
          },
          filtersBySurface: {
            candidates: { candidateStatusFilter: 'shortlisted', candidateViewMode: 'kanban' },
          },
          sortingBySurface: {
            candidates: { key: 'updatedAt', direction: 'desc' },
          },
          updatedAt: '2026-04-11T10:00:00.000Z',
        },
        'project-real-b': {
          projectId: 'project-real-b',
          activeTab: 11,
          storyArcView: 'planning',
          storyArcFocus: { section: 'shot-list', itemId: 'shot-4' },
          contentProducerPlannerSurface: 'approval',
          producerMediaFocus: { workspace: 'brief', sectionId: 'brand' },
          contentProducerResumeTarget: {
            surface: 'project_room',
            mediaFocus: { workspace: 'brief', sectionId: 'brand' },
          },
          scrollBySurface: {
            'planner:approval': { top: 880, left: 12, updatedAt: '2026-04-11T11:00:00.000Z' },
          },
          filtersBySurface: {
            selection: { selectionPhaseFilter: 'callbacks' },
            calendar: { calendarViewMode: 'crew' },
          },
          sortingBySurface: {
            selection: { key: 'callbacks', direction: 'desc' },
          },
          updatedAt: '2026-04-11T11:00:00.000Z',
        },
      },
      updatedAt: '2026-04-11T11:00:00.000Z',
    };

    await page.evaluate(({ namespace, staleLocalState, userId }) => {
      window.localStorage.setItem(
        `app_settings_cache:${userId}::${namespace}`,
        JSON.stringify(staleLocalState),
      );
    }, { namespace, staleLocalState, userId });

    const putResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/settings')
      && response.request().method() === 'PUT',
    );
    await page.evaluate(async ({ importPath, namespace, serverWorkspaceState, userId }) => {
      const { settingsService } = await import(importPath);
      await settingsService.setSetting(namespace, serverWorkspaceState, { userId });
    }, { importPath: SETTINGS_IMPORT, namespace, serverWorkspaceState, userId });
    await putResponsePromise;

    await page.reload({ waitUntil: 'load' });
    await page.evaluate(({ namespace, staleLocalState, userId }) => {
      (window as Window & { __currentUserId?: string }).__currentUserId = userId;
      window.localStorage.setItem(
        `app_settings_cache:${userId}::${namespace}`,
        JSON.stringify(staleLocalState),
      );
    }, { namespace, staleLocalState, userId });

    const loaded = await page.evaluate(async ({ importPath, namespace, userId }) => {
      const { settingsService } = await import(`${importPath}?workspaceState=${Date.now()}`);
      return settingsService.getSetting(namespace, { userId });
    }, { importPath: SETTINGS_IMPORT, namespace, userId });

    expect(loaded).toMatchObject({
      projectId: 'project-real-b',
      lastRealProjectId: 'project-real-b',
      activeTab: 11,
      contentProducerPlannerSurface: 'approval',
      projectStates: {
        'project-real-a': {
          activeTab: 2,
          storyArcView: 'story-logic',
          filtersBySurface: {
            candidates: {
              candidateStatusFilter: 'shortlisted',
              candidateViewMode: 'kanban',
            },
          },
        },
        'project-real-b': {
          activeTab: 11,
          contentProducerPlannerSurface: 'approval',
          scrollBySurface: {
            'planner:approval': {
              top: 880,
              left: 12,
            },
          },
          filtersBySurface: {
            selection: {
              selectionPhaseFilter: 'callbacks',
            },
          },
          sortingBySurface: {
            selection: {
              key: 'callbacks',
              direction: 'desc',
            },
          },
        },
      },
    });
    expect(loaded).not.toMatchObject({ projectId: 'content-producer-demo' });
    expect(settingsApi.getRemoteSetting(userId, namespace)).toMatchObject(serverWorkspaceState);
  });
});
