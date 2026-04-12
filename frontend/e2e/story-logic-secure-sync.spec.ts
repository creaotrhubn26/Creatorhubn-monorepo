import { expect, test, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-service-test.html';
const SERVICE_IMPORT = '/src/components/role-room/services/storyLogicService.ts';

const makeStoryLogicState = (premise: string) => ({
  concept: {
    corePremise: premise,
    genre: 'Drama',
    subGenre: 'Workplace',
    tone: ['cinematic'],
    targetAudience: 'B2B',
    audienceAge: '25-55',
    whyNow: 'Project kickoff',
    uniqueAngle: 'Operational safety',
    marketComparables: 'Internal campaign',
  },
  logline: {
    protagonist: 'Producer',
    protagonistTrait: 'precise',
    goal: 'align client story',
    antagonisticForce: 'scope drift',
    stakes: 'delivery quality',
    fullLogline: 'A producer aligns a client story before production starts.',
    loglineScore: 82,
  },
  theme: {
    centralTheme: 'Preparation',
    themeStatement: 'Good preparation lowers production risk.',
    protagonistFlaw: 'too reactive',
    flawOrigin: 'unclear brief',
    whatMustChange: 'confirm story logic',
    transformationArc: 'reactive to structured',
    emotionalJourney: ['clarity'],
    moralArgument: 'Structure protects creative decisions.',
  },
  currentPhase: 0,
  phaseStatus: {
    concept: 'ready' as const,
    logline: 'ready' as const,
    theme: 'ready' as const,
  },
  lastSaved: null,
  isLocked: false,
});

async function prepareStoryLogicServicePage(page: Page) {
  await page.goto(TEST_PAGE, { waitUntil: 'load' });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('role_room_auth_token', 'test-role-room-session');
    (window as Window & { __currentUserId?: string }).__currentUserId = 'story-logic-user';
  });
}

async function installStoryLogicApiMock(page: Page) {
  let version = 0;
  let storyLogic: ReturnType<typeof makeStoryLogicState> | null = null;
  let legacyCalls = 0;
  const authHeaders: string[] = [];

  await page.route('**/api/projects/**/story-logic', async (route) => {
    legacyCalls++;
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'legacy endpoint must not be used' }),
    });
  });

  await page.route('**/api/role-room/projects/**/story-logic', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const match = url.pathname.match(/^\/api\/role-room\/projects\/([^/]+)\/story-logic$/);
    const projectId = decodeURIComponent(match?.[1] ?? '');
    authHeaders.push(request.headers().authorization ?? '');

    if (request.method() === 'GET') {
      if (!storyLogic) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'story_logic_not_found', projectId }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          projectId,
          storyLogic,
          version,
          createdAt: '2026-04-11T10:00:00.000Z',
          updatedAt: '2026-04-11T10:00:01.000Z',
        }),
      });
      return;
    }

    if (request.method() === 'POST') {
      const body = request.postDataJSON() as {
        projectId?: string;
        storyLogic?: ReturnType<typeof makeStoryLogicState>;
        expectedVersion?: number;
      };

      if (body.projectId !== projectId) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'cross_project_payload_rejected', projectId }),
        });
        return;
      }

      if (version > 0 && body.expectedVersion !== version) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'story_logic_conflict',
            projectId,
            current: { success: true, projectId, storyLogic, version },
          }),
        });
        return;
      }

      storyLogic = body.storyLogic ?? null;
      version += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          projectId,
          storyLogic,
          version,
          createdAt: '2026-04-11T10:00:00.000Z',
          updatedAt: '2026-04-11T10:00:01.000Z',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'method_not_allowed' }),
    });
  });

  return {
    getLegacyCalls: () => legacyCalls,
    getAuthHeaders: () => authHeaders,
    bumpServerVersion: () => {
      version += 1;
    },
  };
}

test.describe('Role Room Story Logic secure sync', () => {
  test('uses authenticated /api/role-room route and caches only server-confirmed saves', async ({ page }) => {
    const api = await installStoryLogicApiMock(page);
    await prepareStoryLogicServicePage(page);
    const projectId = `story-secure-${Date.now().toString(36)}`;

    const result = await page.evaluate(async ({ importPath, projectId }) => {
      const { storyLogicService } = await import(importPath);
      const state = {
        concept: {
          corePremise: 'Server-confirmed story logic',
          genre: 'Drama',
          subGenre: 'Workplace',
          tone: ['cinematic'],
          targetAudience: 'B2B',
          audienceAge: '25-55',
          whyNow: 'Project kickoff',
          uniqueAngle: 'Operational safety',
          marketComparables: 'Internal campaign',
        },
        logline: {
          protagonist: 'Producer',
          protagonistTrait: 'precise',
          goal: 'align client story',
          antagonisticForce: 'scope drift',
          stakes: 'delivery quality',
          fullLogline: 'A producer aligns a client story before production starts.',
          loglineScore: 82,
        },
        theme: {
          centralTheme: 'Preparation',
          themeStatement: 'Good preparation lowers production risk.',
          protagonistFlaw: 'too reactive',
          flawOrigin: 'unclear brief',
          whatMustChange: 'confirm story logic',
          transformationArc: 'reactive to structured',
          emotionalJourney: ['clarity'],
          moralArgument: 'Structure protects creative decisions.',
        },
        currentPhase: 0,
        phaseStatus: { concept: 'ready', logline: 'ready', theme: 'ready' },
        lastSaved: null,
        isLocked: false,
      };

      await storyLogicService.saveStoryLogic(projectId, state);
      return {
        loaded: await storyLogicService.getStoryLogic(projectId),
        meta: storyLogicService.getStoryLogicSyncMeta(projectId),
        cached: window.localStorage.getItem(`story-logic-data:${projectId}`),
      };
    }, { importPath: SERVICE_IMPORT, projectId });

    expect(api.getLegacyCalls()).toBe(0);
    expect(api.getAuthHeaders().every((header) => header === 'Bearer test-role-room-session')).toBe(true);
    expect(result.loaded?.concept.corePremise).toBe('Server-confirmed story logic');
    expect(result.meta.status).toBe('synced');
    expect(result.meta.version).toBe(1);
    expect(result.cached).toContain('Server-confirmed story logic');
  });

  test('marks conflict instead of silently overwriting newer server data', async ({ page }) => {
    const api = await installStoryLogicApiMock(page);
    await prepareStoryLogicServicePage(page);
    const projectId = `story-conflict-${Date.now().toString(36)}`;

    const result = await page.evaluate(async ({ importPath, projectId, firstState, secondState }) => {
      const { storyLogicService } = await import(importPath);
      await storyLogicService.saveStoryLogic(projectId, firstState);
      return {
        meta: storyLogicService.getStoryLogicSyncMeta(projectId),
      };
    }, {
      importPath: SERVICE_IMPORT,
      projectId,
      firstState: makeStoryLogicState('Initial confirmed premise'),
      secondState: makeStoryLogicState('Conflicting premise'),
    });

    expect(result.meta.version).toBe(1);
    api.bumpServerVersion();

    const conflict = await page.evaluate(async ({ importPath, projectId, secondState }) => {
      const { storyLogicService } = await import(importPath);
      try {
        await storyLogicService.saveStoryLogic(projectId, secondState);
        return { threw: false, meta: storyLogicService.getStoryLogicSyncMeta(projectId) };
      } catch (error) {
        return {
          threw: true,
          message: error instanceof Error ? error.message : String(error),
          meta: storyLogicService.getStoryLogicSyncMeta(projectId),
        };
      }
    }, {
      importPath: SERVICE_IMPORT,
      projectId,
      secondState: makeStoryLogicState('Conflicting premise'),
    });

    expect(conflict.threw).toBe(true);
    expect(conflict.message).toContain('story_logic_conflict');
    expect(conflict.meta.status).toBe('conflict');
  });
});
