import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  analyzeManuscriptForResume,
  dismissResumeBanner,
  isResumeBannerDismissed,
} from './resumeAnalysisService';
import type { Manuscript, SceneBreakdown } from '../models/casting';

const NOW = new Date('2026-05-15T12:00:00Z').getTime();

function daysAgoISO(days: number): string {
  return new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeManuscript(overrides: Partial<Manuscript> = {}): Manuscript {
  return {
    id: 'ms-1',
    projectId: 'proj-1',
    title: 'Test',
    content: '',
    ...overrides,
  };
}

function makeScene(overrides: Partial<SceneBreakdown> = {}): SceneBreakdown {
  return {
    id: `scene-${Math.random().toString(36).slice(2, 8)}`,
    sceneNumber: 1,
    sceneHeading: 'INT. ROOM — DAY',
    locationName: 'ROOM',
    description: 'Some content',
    status: 'completed',
    updatedAt: daysAgoISO(1),
    ...overrides,
  };
}

describe('analyzeManuscriptForResume', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returnerer ingen threads når scenes er tomme', () => {
    const result = analyzeManuscriptForResume(makeManuscript(), []);
    expect(result.threads).toEqual([]);
    expect(result.manuscriptId).toBe('ms-1');
    expect(typeof result.generatedAt).toBe('string');
  });

  describe('last-edited thread', () => {
    it('vises når mest nylige scene er innen 7 dager', () => {
      const recent = makeScene({ id: 'recent', updatedAt: daysAgoISO(2), sceneHeading: 'INT. KAFE' });
      const old = makeScene({ id: 'old', updatedAt: daysAgoISO(30) });
      const result = analyzeManuscriptForResume(makeManuscript(), [old, recent]);
      const thread = result.threads.find((t) => t.type === 'last-edited');
      expect(thread).toBeDefined();
      expect(thread?.sceneId).toBe('recent');
      expect(thread?.message).toContain('INT. KAFE');
    });

    it('vises ikke når seneste scene er over 7 dager gammel', () => {
      const old = makeScene({ updatedAt: daysAgoISO(10) });
      const result = analyzeManuscriptForResume(makeManuscript(), [old]);
      expect(result.threads.find((t) => t.type === 'last-edited')).toBeUndefined();
    });

    it('faller tilbake til scene-nummer hvis heading mangler', () => {
      const scene = makeScene({
        sceneHeading: undefined,
        heading: undefined,
        sceneNumber: 7,
        updatedAt: daysAgoISO(1),
      });
      const result = analyzeManuscriptForResume(makeManuscript(), [scene]);
      const thread = result.threads.find((t) => t.type === 'last-edited');
      expect(thread?.message).toContain('Scene 7');
    });

    it('hopper over scener uten updatedAt', () => {
      const noTimestamp = makeScene({ updatedAt: undefined });
      const result = analyzeManuscriptForResume(makeManuscript(), [noTimestamp]);
      expect(result.threads.find((t) => t.type === 'last-edited')).toBeUndefined();
    });
  });

  describe('empty-scaffold thread', () => {
    it('flagger scener med scaffoldTemplateId men uten innhold', () => {
      const emptyScaffold = makeScene({
        id: 'empty',
        metadata: { scaffoldTemplateId: 'tmpl-1' } as Record<string, unknown>,
        sceneHeading: '',
        description: '',
        locationName: '',
      });
      const result = analyzeManuscriptForResume(makeManuscript(), [emptyScaffold]);
      const thread = result.threads.find((t) => t.type === 'empty-scaffold');
      expect(thread).toBeDefined();
      expect(thread?.sceneIds).toEqual(['empty']);
      expect(thread?.count).toBe(1);
    });

    it('teller flere tomme scaffold-scener i sceneIds', () => {
      const a = makeScene({
        id: 'a',
        metadata: { scaffoldTemplateId: 'tmpl-1' } as Record<string, unknown>,
        sceneHeading: '',
        description: '',
        locationName: '',
      });
      const b = makeScene({
        id: 'b',
        metadata: { scaffoldTemplateId: 'tmpl-1' } as Record<string, unknown>,
        sceneHeading: '',
        description: '',
        locationName: '',
      });
      const result = analyzeManuscriptForResume(makeManuscript(), [a, b]);
      const thread = result.threads.find((t) => t.type === 'empty-scaffold');
      expect(thread?.sceneIds).toEqual(['a', 'b']);
      expect(thread?.count).toBe(2);
      expect(thread?.message).toContain('2 scene-slot');
    });

    it('flagger ikke scaffold-scener som har fått innhold', () => {
      const filled = makeScene({
        metadata: { scaffoldTemplateId: 'tmpl-1' } as Record<string, unknown>,
        sceneHeading: 'INT. CAFE',
      });
      const result = analyzeManuscriptForResume(makeManuscript(), [filled]);
      expect(result.threads.find((t) => t.type === 'empty-scaffold')).toBeUndefined();
    });
  });

  describe('unscheduled thread', () => {
    it('flagger ikke 1-2 uplanlagte scener (under terskelen)', () => {
      const scenes = [
        makeScene({ status: 'not-scheduled' }),
        makeScene({ status: 'not-scheduled' }),
      ];
      const result = analyzeManuscriptForResume(makeManuscript(), scenes);
      expect(result.threads.find((t) => t.type === 'unscheduled')).toBeUndefined();
    });

    it('flagger 3+ uplanlagte scener og inkluderer alle i sceneIds', () => {
      const scenes = [
        makeScene({ id: 'u1', status: 'not-scheduled' }),
        makeScene({ id: 'u2', status: 'not-scheduled' }),
        makeScene({ id: 'u3', status: 'not-scheduled' }),
      ];
      const result = analyzeManuscriptForResume(makeManuscript(), scenes);
      const thread = result.threads.find((t) => t.type === 'unscheduled');
      expect(thread).toBeDefined();
      expect(thread?.sceneIds).toEqual(['u1', 'u2', 'u3']);
      expect(thread?.count).toBe(3);
    });

    it('teller ikke empty-scaffold scener som uplanlagte', () => {
      const scenes = [
        makeScene({ status: 'not-scheduled' }),
        makeScene({ status: 'not-scheduled' }),
        makeScene({
          status: 'not-scheduled',
          metadata: { scaffoldTemplateId: 'tmpl-1' } as Record<string, unknown>,
          sceneHeading: '',
          description: '',
          locationName: '',
        }),
      ];
      const result = analyzeManuscriptForResume(makeManuscript(), scenes);
      expect(result.threads.find((t) => t.type === 'unscheduled')).toBeUndefined();
    });
  });

  describe('stale-draft thread', () => {
    it('flagger scener som ikke er rørt på over 14 dager', () => {
      const scenes = [
        makeScene({ id: 'fresh', updatedAt: daysAgoISO(1), status: 'in-progress' }),
        makeScene({ id: 'stale', updatedAt: daysAgoISO(20), status: 'in-progress' }),
      ];
      const result = analyzeManuscriptForResume(makeManuscript(), scenes);
      const thread = result.threads.find((t) => t.type === 'stale-draft');
      expect(thread).toBeDefined();
      expect(thread?.sceneIds).toEqual(['stale']);
    });

    it('teller ikke completed scener som stale', () => {
      const old = makeScene({ updatedAt: daysAgoISO(30), status: 'completed' });
      const fresh = makeScene({ updatedAt: daysAgoISO(1) });
      const result = analyzeManuscriptForResume(makeManuscript(), [old, fresh]);
      expect(result.threads.find((t) => t.type === 'stale-draft')).toBeUndefined();
    });

    it('vises ikke når ALLE scener er stale (hele manuskriptet bortglemt)', () => {
      const scenes = [
        makeScene({ id: 's1', updatedAt: daysAgoISO(30), status: 'in-progress' }),
        makeScene({ id: 's2', updatedAt: daysAgoISO(30), status: 'in-progress' }),
      ];
      const result = analyzeManuscriptForResume(makeManuscript(), scenes);
      expect(result.threads.find((t) => t.type === 'stale-draft')).toBeUndefined();
    });

    it('teller ikke empty-scaffold scener som stale', () => {
      const scenes = [
        makeScene({ updatedAt: daysAgoISO(1) }),
        makeScene({
          updatedAt: daysAgoISO(30),
          metadata: { scaffoldTemplateId: 'tmpl-1' } as Record<string, unknown>,
          sceneHeading: '',
          description: '',
          locationName: '',
        }),
      ];
      const result = analyzeManuscriptForResume(makeManuscript(), scenes);
      expect(result.threads.find((t) => t.type === 'stale-draft')).toBeUndefined();
    });
  });

  describe('kombinerte scenarier', () => {
    it('kan returnere flere threads samtidig', () => {
      const scenes = [
        makeScene({ id: 'recent', updatedAt: daysAgoISO(1), status: 'in-progress' }),
        makeScene({ id: 'u1', status: 'not-scheduled', updatedAt: daysAgoISO(2) }),
        makeScene({ id: 'u2', status: 'not-scheduled', updatedAt: daysAgoISO(2) }),
        makeScene({ id: 'u3', status: 'not-scheduled', updatedAt: daysAgoISO(2) }),
        makeScene({ id: 'stale', status: 'in-progress', updatedAt: daysAgoISO(30) }),
      ];
      const result = analyzeManuscriptForResume(makeManuscript(), scenes);
      const types = result.threads.map((t) => t.type);
      expect(types).toContain('last-edited');
      expect(types).toContain('unscheduled');
      expect(types).toContain('stale-draft');
    });
  });
});

describe('sessionStorage dismiss-håndtering', () => {
  const realSessionStorage = globalThis.sessionStorage;

  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => store.clear(),
        length: 0,
        key: () => null,
      } as Storage,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: realSessionStorage,
    });
  });

  it('er ikke dismissed by default', () => {
    expect(isResumeBannerDismissed('ms-1')).toBe(false);
  });

  it('flagger som dismissed etter kall', () => {
    dismissResumeBanner('ms-1');
    expect(isResumeBannerDismissed('ms-1')).toBe(true);
  });

  it('isolerer dismiss per manuskript-id', () => {
    dismissResumeBanner('ms-1');
    expect(isResumeBannerDismissed('ms-2')).toBe(false);
  });
});
