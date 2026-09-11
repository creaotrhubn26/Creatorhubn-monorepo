import { describe, expect, it } from 'vitest';
import type { CastingProject, ProductionDay } from '../../models/casting';
import { buildSecondAdMovementEntries, secondAdReadiness, selectSecondAdProductionDay } from './secondAssistantDirectorWorkspaceModel';

describe('secondAssistantDirectorWorkspaceModel', () => {
  const day: ProductionDay = { id: 'day-1', date: '2026-09-12', scenes: ['scene-1'], crew: [], props: [], callTime: '07:00' };
  const project = {
    id: 'project-1', name: 'Faktisk prosjekt', roles: [{ id: 'role-1', name: 'NORA', assignedCandidateId: 'candidate-1' }],
    candidates: [{ id: 'candidate-1', name: 'Ada', assignedRoles: ['role-1'] }], crew: [], schedules: [], locations: [], props: [], productionDays: [day],
    sceneBreakdowns: [{ id: 'scene-1', characters: ['NORA'] }],
  } as CastingProject;

  it('selects the next active production day', () => {
    expect(selectSecondAdProductionDay([day], new Date('2026-09-11T10:00:00'))?.id).toBe('day-1');
  });

  it('derives cast only from the day scenes and preserves operational data', () => {
    const withStatus = { ...day, secondAd: { entries: [{ id: 'cast:candidate-1', personType: 'cast' as const, personId: 'candidate-1', name: 'Ada', roleName: 'NORA', callTime: '06:30', status: 'acknowledged' as const }] } };
    const entries = buildSecondAdMovementEntries(project, withStatus);
    expect(entries).toEqual([expect.objectContaining({ name: 'Ada', roleName: 'NORA', callTime: '06:30', status: 'acknowledged' })]);
    expect(secondAdReadiness(entries).acknowledged).toBe(1);
  });

  it('resolves manuscript role IDs and does not duplicate mixed ID/name references', () => {
    const projectWithCanonicalReferences = {
      ...project,
      sceneBreakdowns: [
        { id: 'scene-1', characters: ['role-1'] },
        { id: 'scene-2', characters: ['NORA'] },
      ],
    } as CastingProject;
    const entries = buildSecondAdMovementEntries(projectWithCanonicalReferences, {
      ...day,
      scenes: ['scene-1', 'scene-2'],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'cast:candidate-1',
      personId: 'candidate-1',
      name: 'Ada',
      roleName: 'NORA',
    });
  });

  it('migrates a persisted legacy entry onto the canonical cast ID without duplicating it', () => {
    const entries = buildSecondAdMovementEntries({
      ...project,
      sceneBreakdowns: [{ id: 'scene-1', characters: ['role-1'] }],
    } as CastingProject, {
      ...day,
      secondAd: {
        entries: [{
          id: 'legacy-nora',
          personType: 'cast',
          name: 'Ada',
          roleName: 'NORA',
          wardrobeTime: '06:45',
          status: 'wardrobe',
        }],
      },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: 'cast:candidate-1', wardrobeTime: '06:45', status: 'wardrobe' });
  });
});
