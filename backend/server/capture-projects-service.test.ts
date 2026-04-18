import { describe, expect, it, vi } from 'vitest';
import {
  createMinimalProject,
  fetchProjectDetail,
  linkCaptureSessionToProject,
  listProjectsForPhotographer,
} from './capture-projects-service.js';

// Pool/db stub: replace each drizzle chain with a recorded fixture so
// we exercise the service's filtering + JOIN-fanout logic without
// standing up Postgres. Only the chain shapes the service actually uses
// are stubbed.
function makeDbStub(opts: {
  projectRows?: any[];
  shotListRows?: any[];
  ownedProject?: boolean;
  insertReturns?: any[];
  updateReturns?: any[];
} = {}) {
  const captured: { kind: string; values?: any }[] = [];
  const db = {
    select: (_cols?: any) => ({
      from: (table: any) => {
        const tableName = (table?.[Symbol.for('drizzle:Name')] ?? table?.name ?? '').toString();
        const isProjects = tableName.includes('projects');
        const isShotLists = tableName.includes('shot_lists');
        const isCapture = tableName.includes('capture_sessions');
        return {
          where: (_cond: any) => {
            const result: any = {
              limit: (_n: number) => {
                if (isProjects) {
                  return Promise.resolve(opts.ownedProject === false ? [] : opts.projectRows ?? []);
                }
                if (isShotLists) return Promise.resolve(opts.shotListRows ?? []);
                if (isCapture)   return Promise.resolve([]);
                return Promise.resolve([]);
              },
              orderBy: (_o: any) => ({
                limit: (_n: number) => Promise.resolve(opts.projectRows ?? []),
              }),
            };
            // Bare await path returns shotListRows for shot_lists.
            if (isShotLists) return Object.assign(Promise.resolve(opts.shotListRows ?? []), result);
            return result;
          },
        };
      },
    }),
    insert: (_table: any) => ({
      values: (values: any) => ({
        returning: (_cols?: any) => {
          captured.push({ kind: 'insert', values });
          return Promise.resolve(opts.insertReturns ?? [{ id: 'new-project', title: values.title }]);
        },
      }),
    }),
    update: (_table: any) => ({
      set: (values: any) => ({
        where: (_cond: any) => ({
          returning: (_cols?: any) => {
            captured.push({ kind: 'update', values });
            return Promise.resolve(opts.updateReturns ?? [{ id: 'session-1' }]);
          },
        }),
      }),
    }),
  } as any;
  return { db, captured };
}

describe('listProjectsForPhotographer', () => {
  it('returns slim summaries with shot list counts joined per project', async () => {
    const { db } = makeDbStub({
      projectRows: [
        {
          id: 'proj-1', name: 'Anna+Per', title: 'Bryllup Anna+Per',
          clientName: 'Anna Hansen', eventDate: '2026-06-12',
          location: 'Holmenkollen', projectType: 'wedding',
          status: 'active',
          settings: { showcaseSettings: { template: 'wedding-classic' } },
          updatedAt: '2026-04-18T10:00:00Z',
        },
        {
          id: 'proj-2', name: 'Headshots', title: null,
          clientName: null, eventDate: null, location: null,
          projectType: 'portrait', status: 'active',
          settings: null, updatedAt: '2026-04-15T10:00:00Z',
        },
      ],
      shotListRows: [
        { projectId: 'proj-1', id: 'sl-1', totalShots: 50, completedShots: 22, mustHaveShots: 12, completedMustHave: 6 },
      ],
    });
    const rows = await listProjectsForPhotographer(db, 'user-1');
    expect(rows).toHaveLength(2);
    // Falls back through title → name when title is missing.
    expect(rows[0]!.title).toBe('Bryllup Anna+Per');
    expect(rows[1]!.title).toBe('Headshots');
    // Shot list joined for proj-1, null for proj-2.
    expect(rows[0]!.shotListSummary?.totalShots).toBe(50);
    expect(rows[0]!.shotListSummary?.completedShots).toBe(22);
    expect(rows[1]!.shotListSummary).toBeNull();
    // Showcase settings extracted from settings JSONB.
    expect(rows[0]!.showcaseSettings).toEqual({ template: 'wedding-classic' });
  });
});

describe('fetchProjectDetail', () => {
  it('returns null when the project is not owned', async () => {
    const { db } = makeDbStub({ ownedProject: false });
    const detail = await fetchProjectDetail(db, 'attacker', 'proj-not-mine');
    expect(detail).toBeNull();
  });

  it('returns the project with its shot list shots[] populated', async () => {
    const { db } = makeDbStub({
      projectRows: [{
        id: 'proj-1', name: 'X', title: 'Bryllup',
        description: 'Hovedevent', clientName: 'Anna', eventDate: '2026-06-12',
        location: null, projectType: 'wedding', status: 'active',
        settings: { showcaseSettings: { template: 't' } },
        updatedAt: '2026-04-18T10:00:00Z',
      }],
      shotListRows: [{
        id: 'sl-1', projectId: 'proj-1', totalShots: 2, completedShots: 1,
        mustHaveShots: 1, completedMustHave: 0,
        shots: [
          { id: 'shot-1', scene: 'Bridal portrait', priority: 'high' },
          { id: 'shot-2', scene: 'First kiss',     priority: 'critical', isCompleted: true },
        ],
      }],
    });
    const detail = await fetchProjectDetail(db, 'user-1', 'proj-1');
    expect(detail).not.toBeNull();
    expect(detail!.title).toBe('Bryllup');
    expect(detail!.description).toBe('Hovedevent');
    expect(detail!.shotList).toHaveLength(2);
    expect(detail!.shotList[0]!.scene).toBe('Bridal portrait');
    expect(detail!.shotListSummary?.totalShots).toBe(2);
  });
});

describe('createMinimalProject', () => {
  it('inserts with photographer as userId and source tag in projectData', async () => {
    const { db, captured } = makeDbStub({
      insertReturns: [{ id: 'new-id', title: 'Quick session' }],
    });
    const result = await createMinimalProject(db, {
      ownerUserId: 'photog-1',
      title: 'Quick session',
      clientName: 'Walk-in',
    });
    expect(result.id).toBe('new-id');
    const insert = captured.find((c) => c.kind === 'insert');
    expect(insert?.values.userId).toBe('photog-1');
    expect(insert?.values.title).toBe('Quick session');
    expect(insert?.values.projectType).toBe('photo_session');
    expect(insert?.values.projectData).toEqual({ createdVia: 'ipad_capture' });
  });
});

describe('linkCaptureSessionToProject', () => {
  it('rejects when the project is not owned by the photographer', async () => {
    const { db } = makeDbStub({ projectRows: [] });
    const result = await linkCaptureSessionToProject(db, 'user-1', 'session-1', 'proj-stranger');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('project_not_found');
  });

  it('rejects when the session is not owned (update returns no rows)', async () => {
    const { db } = makeDbStub({
      projectRows: [{ id: 'proj-1' }],   // owned project
      updateReturns: [],                  // but session not owned
    });
    const result = await linkCaptureSessionToProject(db, 'user-1', 'session-stranger', 'proj-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('session_not_found');
  });

  it('allows unlinking by passing null projectId without an ownership check', async () => {
    // No project select call happens when projectId is null — no chance
    // for project_not_found to fire on detach.
    const { db } = makeDbStub({ updateReturns: [{ id: 'session-1' }] });
    const result = await linkCaptureSessionToProject(db, 'user-1', 'session-1', null);
    expect(result.ok).toBe(true);
  });

  it('links when both project and session are owned', async () => {
    const { db, captured } = makeDbStub({
      projectRows: [{ id: 'proj-1' }],
      updateReturns: [{ id: 'session-1' }],
    });
    const result = await linkCaptureSessionToProject(db, 'user-1', 'session-1', 'proj-1');
    expect(result.ok).toBe(true);
    const update = captured.find((c) => c.kind === 'update');
    expect(update?.values.projectId).toBe('proj-1');
  });
});
