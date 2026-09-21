import { describe, expect, it } from 'vitest';
import type { ArtDepartmentOperations, CastingProject } from '../../models/casting';
import {
  buildArtDepartmentWorkspaceBrief,
  createEmptyArtDepartmentOperations,
  isArtDepartmentSurface,
  mergeArtDepartmentOperations,
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
});
