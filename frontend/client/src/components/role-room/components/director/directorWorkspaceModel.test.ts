import { describe, expect, it } from 'vitest';
import type { CastingProject } from '../../models/casting';
import { buildDirectorBrief, isDirectorSurface } from './directorWorkspaceModel';

function project(overrides: Partial<CastingProject> = {}): CastingProject {
  return {
    id: 'project-1',
    name: 'Troll',
    roles: [],
    candidates: [],
    crew: [],
    schedules: [],
    locations: [],
    props: [],
    ...overrides,
  };
}

describe('directorWorkspaceModel', () => {
  it('accepts only known director surfaces', () => {
    expect(isDirectorSurface('today')).toBe(true);
    expect(isDirectorSurface('visual-plan')).toBe(true);
    expect(isDirectorSurface('economy')).toBe(false);
    expect(isDirectorSurface(null)).toBe(false);
  });

  it('builds factual casting and visual-plan items without AI ranking', () => {
    const brief = buildDirectorBrief({
      project: project({
        roles: [
          { id: 'role-open', name: 'Nora', status: 'open' },
          { id: 'role-filled', name: 'Elias', status: 'filled' },
        ],
        candidates: [
          { id: 'candidate-1', name: 'Ada', status: 'shortlist' },
          { id: 'candidate-2', name: 'Bo', status: 'pending' },
        ],
        sceneBreakdowns: [
          { id: 'scene-1', sceneNumber: 1, storyboardFrames: [] },
          { id: 'scene-2', sceneNumber: 2, storyboardFrames: [{ id: 'frame-1' }] },
        ],
        shotLists: [],
      }),
      now: new Date('2026-09-10T10:00:00.000Z'),
    });

    expect(brief.stats).toMatchObject({
      sceneCount: 2,
      visuallyPlannedSceneCount: 1,
      roleCount: 2,
      filledRoleCount: 1,
      candidateReviewCount: 1,
    });
    expect(brief.items.find((item) => item.id === 'roles-awaiting-casting')?.title).toContain('1 rolle');
    expect(brief.items.find((item) => item.id === 'candidates-for-review')?.description).toContain('Ingen automatisk rangering');
    expect(brief.items.find((item) => item.id === 'scenes-without-visual-plan')?.title).toContain('1 scene');
  });

  it('treats a registered shot as a visual plan for the matching scene', () => {
    const brief = buildDirectorBrief({
      project: project({
        sceneBreakdowns: [{ id: 'scene-1', sceneNumber: 1 }],
        shotLists: [{
          id: 'shot-list-1',
          sceneId: 'scene-1',
          shots: [{
            id: 'shot-1',
            shotType: 'Wide',
            cameraAngle: 'Eye Level',
            cameraMovement: 'Static',
          }],
        }],
      }),
      now: new Date('2026-09-10T10:00:00.000Z'),
    });

    expect(brief.stats.visuallyPlannedSceneCount).toBe(1);
    expect(brief.items.some((item) => item.id === 'visual-plan-covered')).toBe(true);
  });

  it('selects today before later production days and ignores cancelled days', () => {
    const brief = buildDirectorBrief({
      project: project({
        productionDays: [
          { id: 'cancelled', date: '2026-09-10', scenes: ['1'], crew: [], props: [], status: 'cancelled' },
          { id: 'today', date: '2026-09-10', scenes: ['1', '2'], crew: [], props: [], callTime: '07:30', status: 'planned' },
          { id: 'later', date: '2026-09-12', scenes: ['3'], crew: [], props: [], status: 'planned' },
        ],
      }),
      now: new Date(2026, 8, 10, 10, 0, 0),
    });

    expect(brief.productionDay).toMatchObject({
      id: 'today',
      kind: 'today',
      callTime: '07:30',
      sceneCount: 2,
    });
  });
});
