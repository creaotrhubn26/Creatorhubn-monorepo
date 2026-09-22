import { describe, expect, it } from 'vitest';
import type { ArtDepartmentOperations, CastingProject } from '../../models/casting';
import {
  buildArtDepartmentWorkspaceBrief,
  clearArtDepartmentDraft,
  createEmptyArtDepartmentOperations,
  isArtDepartmentSurface,
  loadArtDepartmentDraft,
  mergeArtDepartmentOperations,
  saveArtDepartmentDraft,
  upsertContinuityItem,
  upsertDecision,
  upsertScenePlan,
} from './artDepartmentWorkspaceModel';

const project: CastingProject = {
  id: 'troll',
  name: 'Troll',
  roles: [], candidates: [], schedules: [], crew: [], locations: [],
  props: [
    { id: 'hammer', name: 'Tors hammer', assignedScenes: ['scene-1'] },
    { id: 'torch', name: 'Fakkel', assignedScenes: [] },
  ],
  sceneBreakdowns: [{
    id: 'scene-1', sceneNumber: '12A', heading: 'EXT. DOVREFJELL - NATT',
    locationName: 'Dovrefjell', propsNeeded: ['Tors hammer'], vehicles: ['Snøscooter'],
  }],
  productionDays: [{ id: 'day-1', date: '2026-10-01', scenes: ['scene-1'], crew: [], props: [] }],
};

describe('artDepartmentWorkspaceModel', () => {
  it('accepts only registered production-design surfaces', () => {
    expect(isArtDepartmentSurface('visual-direction')).toBe(true);
    expect(isArtDepartmentSurface('budget')).toBe(false);
  });

  it('derives the scene evidence from canonical project data without inventing readiness', () => {
    const brief = buildArtDepartmentWorkspaceBrief(project, createEmptyArtDepartmentOperations());
    expect(brief.scenes[0]).toEqual(expect.objectContaining({
      id: 'scene-1',
      label: 'Scene 12A',
      location: 'Dovrefjell',
      productionDayLabels: ['2026-10-01'],
      propNames: ['Tors hammer'],
      sourceNeeds: ['Tors hammer', 'Snøscooter'],
      plan: expect.objectContaining({ status: 'not_started', setStrategy: 'unknown' }),
    }));
    expect(brief.stats).toEqual(expect.objectContaining({
      sceneCount: 1, plannedSceneCount: 0, unassignedPropCount: 1,
    }));
  });

  it('merges missing handoffs but preserves saved department state', () => {
    const partial = {
      ...createEmptyArtDepartmentOperations(),
      handoffs: [{ id: 'handoff-props', department: 'props' as const, title: 'Rekvisitt', status: 'ready' as const }],
    };
    const merged = mergeArtDepartmentOperations(partial);
    expect(merged.handoffs).toHaveLength(8);
    expect(merged.handoffs.find((item) => item.department === 'props')?.status).toBe('ready');
  });

  it('updates one scene and decision without duplicating their identities', () => {
    let operations: ArtDepartmentOperations = createEmptyArtDepartmentOperations();
    operations = upsertScenePlan(operations, {
      sceneId: 'scene-1', status: 'designing', setStrategy: 'hybrid', departments: ['art', 'props'],
    });
    operations = upsertScenePlan(operations, {
      sceneId: 'scene-1', status: 'ready_for_review', setStrategy: 'hybrid', departments: ['art', 'props'],
    });
    operations = upsertDecision(operations, {
      id: 'decision-1', title: 'Set build', status: 'draft', impact: 'budget', sceneIds: ['scene-1'],
    });
    operations = upsertDecision(operations, {
      id: 'decision-1', title: 'Set build', status: 'ready_for_review', impact: 'budget', sceneIds: ['scene-1'],
    });
    expect(operations.scenePlans).toHaveLength(1);
    expect(operations.scenePlans[0].status).toBe('ready_for_review');
    expect(operations.decisions).toHaveLength(1);
    expect(operations.decisions[0].status).toBe('ready_for_review');
  });

  it('keeps one canonical continuity item and exposes reset and issue readiness', () => {
    let operations = createEmptyArtDepartmentOperations();
    operations = upsertContinuityItem(operations, {
      id: 'continuity-1',
      department: 'props',
      title: 'Tors hammer',
      sceneId: 'scene-1',
      productionDayId: 'day-1',
      propId: 'hammer',
      status: 'ready',
      source: 'fabricated',
      condition: 'good',
      beforeReferences: [],
      afterReferences: [],
    });
    operations = upsertContinuityItem(operations, {
      ...operations.continuityItems[0],
      status: 'reset_required',
      issue: 'Skal tilbake til startmerket før neste take.',
    });

    const brief = buildArtDepartmentWorkspaceBrief(project, operations);
    expect(operations.continuityItems).toHaveLength(1);
    expect(brief.stats).toEqual(expect.objectContaining({
      continuityItemCount: 1,
      continuityIssueCount: 1,
      continuityResetCount: 1,
      continuityAttentionCount: 1,
    }));
    expect(brief.nextActions).toContainEqual(expect.objectContaining({
      id: 'continuity-attention',
      surface: 'continuity',
    }));
  });

  it('restores a local draft without changing its server base version', () => {
    const operations = createEmptyArtDepartmentOperations();
    operations.visualDirection = 'Lokalt utkast';
    saveArtDepartmentDraft('troll', { baseVersion: 7, updatedAt: '2026-09-21T20:00:00.000Z', operations });
    expect(loadArtDepartmentDraft('troll')).toEqual(expect.objectContaining({
      baseVersion: 7,
      operations: expect.objectContaining({ visualDirection: 'Lokalt utkast', continuityItems: [] }),
    }));
    clearArtDepartmentDraft('troll');
    expect(loadArtDepartmentDraft('troll')).toBeNull();
  });
});
