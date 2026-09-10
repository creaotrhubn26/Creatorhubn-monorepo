import { describe, expect, it } from 'vitest';
import type { CastingProject } from '../../models/casting';
import {
  buildCinematographerBrief,
  isCinematographerSurface,
} from './cinematographerWorkspaceModel';

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

describe('cinematographerWorkspaceModel', () => {
  it('accepts only cinematographer surfaces', () => {
    expect(isCinematographerSurface('today')).toBe(true);
    expect(isCinematographerSurface('lighting-equipment')).toBe(true);
    expect(isCinematographerSurface('casting')).toBe(false);
  });

  it('reports shot, camera and lighting gaps from registered project data', () => {
    const brief = buildCinematographerBrief({
      project: project({
        sceneBreakdowns: [
          { id: 'scene-1', sceneNumber: 1 },
          { id: 'scene-2', sceneNumber: 2 },
        ],
        shotLists: [{
          id: 'list-1',
          sceneId: 'scene-1',
          shots: [{
            id: 'shot-1',
            shotType: 'Wide',
            cameraAngle: 'Eye Level',
            cameraMovement: 'Static',
            lensRecommendation: '35 mm',
          }],
        }],
      }),
      now: new Date('2026-09-10T10:00:00.000Z'),
    });

    expect(brief.stats).toMatchObject({
      sceneCount: 2,
      scenesWithShots: 1,
      shotCount: 1,
      cameraReadyShots: 1,
      lightingReadyShots: 0,
    });
    expect(brief.items.find((item) => item.id === 'scenes-without-shots')?.title).toContain('1 scene');
    expect(brief.items.some((item) => item.id === 'shots-without-camera-plan')).toBe(false);
    expect(brief.items.find((item) => item.id === 'shots-without-lighting-plan')?.title).toContain('1 shot');
  });

  it('counts camera, lighting and grip crew through the shared role catalogue', () => {
    const brief = buildCinematographerBrief({
      project: project({
        crew: [
          { id: 'dop', name: 'Dana', role: 'cinematographer', status: 'confirmed' },
          { id: 'gaffer', name: 'Guri', role: 'gaffer', status: 'pending' },
          { id: 'grip', name: 'Kim', role: 'key_grip', status: 'confirmed' },
          { id: 'writer', name: 'Wera', role: 'writer', status: 'confirmed' },
        ],
      }),
      now: new Date('2026-09-10T10:00:00.000Z'),
    });

    expect(brief.stats.technicalCrewCount).toBe(3);
    expect(brief.stats.confirmedTechnicalCrewCount).toBe(2);
    expect(brief.items.find((item) => item.id === 'technical-crew-unconfirmed')?.title).toContain('1 crewmedlem');
  });

  it('selects the next active production day without inventing a schedule', () => {
    const brief = buildCinematographerBrief({
      project: project({
        productionDays: [
          { id: 'cancelled', date: '2026-09-10', scenes: ['1'], crew: [], props: [], status: 'cancelled' },
          { id: 'next', date: '2026-09-11', scenes: ['1', '2'], crew: [], props: [], callTime: '06:30', status: 'planned' },
        ],
      }),
      now: new Date(2026, 8, 10, 10, 0, 0),
    });

    expect(brief.productionDay).toMatchObject({
      id: 'next',
      kind: 'next',
      callTime: '06:30',
      sceneCount: 2,
    });
  });
});
