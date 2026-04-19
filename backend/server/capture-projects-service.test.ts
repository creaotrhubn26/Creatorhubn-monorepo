import { describe, expect, it, vi } from 'vitest';
import {
  bootstrapCaptureSessionForProject,
  createMinimalProject,
  fetchProjectDetail,
  linkCaptureSessionToProject,
  linkShotToAsset,
  listProjectsForPhotographer,
  upsertShotListForProject,
} from './capture-projects-service.js';

// Pool/db stub: replace each drizzle chain with a recorded fixture so
// we exercise the service's filtering + JOIN-fanout logic without
// standing up Postgres. Only the chain shapes the service actually uses
// are stubbed.
function makeDbStub(opts: {
  projectRows?: any[];
  shotListRows?: any[];
  captureSessionRows?: any[];
  ownedProject?: boolean;
  insertReturns?: any[];
  updateReturns?: any[];
  deleteReturns?: any[];
} = {}) {
  const captured: { kind: string; table?: string; values?: any }[] = [];
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
                if (isCapture)   return Promise.resolve(opts.captureSessionRows ?? []);
                return Promise.resolve([]);
              },
              orderBy: (_o: any) => ({
                limit: (_n: number) => {
                  if (isCapture) return Promise.resolve(opts.captureSessionRows ?? []);
                  return Promise.resolve(opts.projectRows ?? []);
                },
              }),
            };
            // Bare await path returns shotListRows for shot_lists.
            if (isShotLists) return Object.assign(Promise.resolve(opts.shotListRows ?? []), result);
            return result;
          },
        };
      },
    }),
    insert: (table: any) => {
      const tableName = (table?.[Symbol.for('drizzle:Name')] ?? table?.name ?? '').toString();
      return {
        values: (values: any) => ({
          returning: (_cols?: any) => {
            captured.push({ kind: 'insert', table: tableName, values });
            // If caller didn't prescribe, synthesize something sensible per table.
            if (opts.insertReturns) return Promise.resolve(opts.insertReturns);
            if (tableName.includes('shot_lists')) {
              return Promise.resolve([{ id: 'new-shot-list' }]);
            }
            if (tableName.includes('capture_sessions')) {
              return Promise.resolve([{
                id: 'new-capture-session',
                ownerUserId: values.ownerUserId,
                projectId: values.projectId,
                name: values.name,
                status: 'active',
              }]);
            }
            return Promise.resolve([{ id: 'new-project', title: values.title }]);
          },
        }),
      };
    },
    update: (table: any) => {
      const tableName = (table?.[Symbol.for('drizzle:Name')] ?? table?.name ?? '').toString();
      return {
        set: (values: any) => ({
          where: (_cond: any) => ({
            returning: (_cols?: any) => {
              captured.push({ kind: 'update', table: tableName, values });
              if (opts.updateReturns) return Promise.resolve(opts.updateReturns);
              if (tableName.includes('shot_lists')) return Promise.resolve([{ id: 'sl-1' }]);
              return Promise.resolve([{ id: 'session-1' }]);
            },
          }),
        }),
      };
    },
    delete: (table: any) => {
      const tableName = (table?.[Symbol.for('drizzle:Name')] ?? table?.name ?? '').toString();
      return {
        where: (_cond: any) => {
          captured.push({ kind: 'delete', table: tableName });
          return Promise.resolve(opts.deleteReturns ?? []);
        },
      };
    },
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

describe('upsertShotListForProject', () => {
  it('rejects when the project is not owned', async () => {
    const { db, captured } = makeDbStub({ projectRows: [] });
    const result = await upsertShotListForProject(db, {
      ownerUserId: 'attacker',
      projectId: 'proj-stranger',
      shots: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('project_not_found');
    // Nothing should have been written since ownership gate failed first.
    expect(captured.find((c) => c.kind === 'insert')).toBeUndefined();
    expect(captured.find((c) => c.kind === 'delete')).toBeUndefined();
  });

  it('deletes prior rows before inserting and recomputes counters', async () => {
    const { db, captured } = makeDbStub({
      projectRows: [{ id: 'proj-1' }],
    });
    const shots = [
      { id: 's1', scene: 'Ceremony', priority: 'must-have', isCompleted: true },
      { id: 's2', scene: 'First kiss', priority: 'high' },
      { id: 's3', scene: 'Detail shot', priority: 'nice-to-have' },
    ];
    const result = await upsertShotListForProject(db, {
      ownerUserId: 'user-1',
      projectId: 'proj-1',
      shots,
      listName: 'Day 1',
      eventType: 'wedding',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalShots).toBe(3);
    expect(result.data.completedShots).toBe(1);
    expect(result.data.mustHaveShots).toBe(2); // must-have + high
    expect(result.data.completedMustHave).toBe(1);
    // Ordering: delete before insert so the write is idempotent.
    const deleteIdx = captured.findIndex((c) => c.kind === 'delete');
    const insertIdx = captured.findIndex((c) => c.kind === 'insert');
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(insertIdx).toBeGreaterThan(deleteIdx);
    const insert = captured[insertIdx];
    expect(insert?.values.userId).toBe('user-1');
    expect(insert?.values.projectId).toBe('proj-1');
    expect(insert?.values.listName).toBe('Day 1');
    expect(insert?.values.eventType).toBe('wedding');
    expect(Array.isArray(insert?.values.shots)).toBe(true);
  });

  it('defaults list name and event type when omitted', async () => {
    const { db, captured } = makeDbStub({ projectRows: [{ id: 'proj-1' }] });
    const result = await upsertShotListForProject(db, {
      ownerUserId: 'user-1',
      projectId: 'proj-1',
      shots: [],
    });
    expect(result.ok).toBe(true);
    const insert = captured.find((c) => c.kind === 'insert');
    expect(insert?.values.listName).toBe('Primary shot list');
    expect(insert?.values.eventType).toBe('photo_session');
  });
});

describe('linkShotToAsset', () => {
  it('rejects when the project is not owned', async () => {
    const { db } = makeDbStub({ projectRows: [] });
    const result = await linkShotToAsset(db, 'attacker', 'proj-stranger', 'shot-1', 'asset-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('project_not_found');
  });

  it('returns shot_not_found when there is no shot list row', async () => {
    const { db } = makeDbStub({
      projectRows: [{ id: 'proj-1' }],
      shotListRows: [],
    });
    const result = await linkShotToAsset(db, 'user-1', 'proj-1', 'shot-1', 'asset-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('shot_not_found');
  });

  it('returns shot_not_found when the shot id does not exist in the list', async () => {
    const { db } = makeDbStub({
      projectRows: [{ id: 'proj-1' }],
      shotListRows: [{
        id: 'sl-1',
        shots: [
          { id: 'shot-a', scene: 'Not the one', priority: 'must-have' },
        ],
      }],
    });
    const result = await linkShotToAsset(db, 'user-1', 'proj-1', 'shot-missing', 'asset-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('shot_not_found');
  });

  it('marks the matching shot as captured + completed and recomputes counters', async () => {
    const { db, captured } = makeDbStub({
      projectRows: [{ id: 'proj-1' }],
      shotListRows: [{
        id: 'sl-1',
        shots: [
          { id: 'shot-1', scene: 'Bridal portrait', priority: 'must-have' },
          { id: 'shot-2', scene: 'First kiss',     priority: 'high', isCompleted: false },
        ],
      }],
    });
    const result = await linkShotToAsset(db, 'user-1', 'proj-1', 'shot-2', 'asset-xyz');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalShots).toBe(2);
    expect(result.data.completedShots).toBe(1);
    expect(result.data.mustHaveShots).toBe(2);
    expect(result.data.completedMustHave).toBe(1);
    const update = captured.find((c) => c.kind === 'update');
    const patched = (update?.values.shots as any[])
      .find((s) => s.id === 'shot-2');
    expect(patched.capturedAssetId).toBe('asset-xyz');
    expect(patched.isCompleted).toBe(true);
    // Other shot is untouched.
    const other = (update?.values.shots as any[])
      .find((s) => s.id === 'shot-1');
    expect(other.capturedAssetId).toBeUndefined();
  });

  it('unlinks a shot when capturedAssetId is null', async () => {
    const { db, captured } = makeDbStub({
      projectRows: [{ id: 'proj-1' }],
      shotListRows: [{
        id: 'sl-1',
        shots: [
          { id: 'shot-1', scene: 'Bridal portrait', priority: 'high',
            capturedAssetId: 'asset-old', isCompleted: true },
        ],
      }],
    });
    const result = await linkShotToAsset(db, 'user-1', 'proj-1', 'shot-1', null);
    expect(result.ok).toBe(true);
    const update = captured.find((c) => c.kind === 'update');
    const patched = (update?.values.shots as any[])
      .find((s) => s.id === 'shot-1');
    expect(patched.capturedAssetId).toBeNull();
    expect(patched.isCompleted).toBe(false);
  });
});

describe('bootstrapCaptureSessionForProject', () => {
  it('rejects when the project is not owned', async () => {
    const { db } = makeDbStub({ projectRows: [] });
    const result = await bootstrapCaptureSessionForProject(db, 'attacker', 'proj-stranger');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('project_not_found');
  });

  it('reuses an existing active session instead of creating a duplicate', async () => {
    const existing = {
      id: 'session-existing',
      ownerUserId: 'user-1',
      projectId: 'proj-1',
      name: 'Existing',
      status: 'active',
    };
    const { db, captured } = makeDbStub({
      projectRows: [{ id: 'proj-1', title: 'Bryllup', name: 'Bryllup' }],
      captureSessionRows: [existing],
    });
    const result = await bootstrapCaptureSessionForProject(db, 'user-1', 'proj-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reused).toBe(true);
    expect(result.session.id).toBe('session-existing');
    // No insert happens on the reuse path.
    expect(captured.find((c) => c.kind === 'insert' && c.table?.includes('capture_sessions'))).toBeUndefined();
  });

  it('creates a new session when none exists, naming it after the project', async () => {
    const { db, captured } = makeDbStub({
      projectRows: [{ id: 'proj-1', title: 'Bryllup Anna+Per', name: null }],
      captureSessionRows: [],
    });
    const result = await bootstrapCaptureSessionForProject(db, 'user-1', 'proj-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reused).toBe(false);
    expect(result.session.id).toBe('new-capture-session');
    const insert = captured.find((c) => c.kind === 'insert' && c.table?.includes('capture_sessions'));
    expect(insert?.values.ownerUserId).toBe('user-1');
    expect(insert?.values.projectId).toBe('proj-1');
    expect(insert?.values.name).toBe('Bryllup Anna+Per');
  });

  it('honours an explicit session name override', async () => {
    const { db, captured } = makeDbStub({
      projectRows: [{ id: 'proj-1', title: 'Default', name: null }],
      captureSessionRows: [],
    });
    const result = await bootstrapCaptureSessionForProject(db, 'user-1', 'proj-1', {
      name: '  Day 2 live  ',
    });
    expect(result.ok).toBe(true);
    const insert = captured.find((c) => c.kind === 'insert' && c.table?.includes('capture_sessions'));
    expect(insert?.values.name).toBe('Day 2 live');
  });
});
