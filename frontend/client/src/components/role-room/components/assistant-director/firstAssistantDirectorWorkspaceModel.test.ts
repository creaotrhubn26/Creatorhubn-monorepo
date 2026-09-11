import { describe, expect, it } from 'vitest';
import type { CastingProject } from '../../models/casting';
import {
  buildFirstAssistantDirectorBrief,
  isFirstAssistantDirectorSurface,
} from './firstAssistantDirectorWorkspaceModel';

const project: CastingProject = {
  id: 'troll-project',
  name: 'Troll',
  roles: [
    { id: 'role-nora', name: 'NORA', status: 'filled' },
    { id: 'role-elias', name: 'ELIAS', status: 'open' },
  ],
  candidates: [],
  schedules: [],
  locations: [{ id: 'location-forest', name: 'Nordskogen' }],
  props: [],
  crew: [
    { id: 'crew-ad', name: 'Ada', role: 'first_ad', status: 'confirmed' },
    { id: 'crew-pa', name: 'Pia', role: 'production_assistant', status: 'invited' },
  ],
  sceneBreakdowns: [
    {
      id: 'scene-1',
      sceneNumber: 1,
      pageLength: 2.5,
      characters: ['NORA', 'ELIAS'],
    },
    {
      id: 'scene-2',
      sceneNumber: 2,
      pageLength: 1,
      characters: ['NORA'],
    },
  ],
  productionDays: [{
    id: 'day-1',
    projectId: 'troll-project',
    date: '2026-09-11',
    scenes: ['scene-1'],
    locationId: 'location-forest',
    crew: ['crew-ad', 'crew-pa'],
    props: [],
    callTime: '07:00',
    status: 'planned',
  }],
};

describe('firstAssistantDirectorWorkspaceModel', () => {
  it('derives day readiness only from registered production data', () => {
    const brief = buildFirstAssistantDirectorBrief({
      project,
      now: new Date('2026-09-10T12:00:00.000Z'),
    });

    expect(brief.productionDay).toMatchObject({
      id: 'day-1',
      kind: 'next',
      location: 'Nordskogen',
      sceneCount: 1,
      pageCount: 2.5,
      unresolvedCastCount: 1,
      assignedCrewCount: 2,
      confirmedAssignedCrewCount: 1,
    });
    expect(brief.stats).toMatchObject({
      sceneCount: 2,
      scheduledSceneCount: 1,
      unscheduledSceneCount: 1,
    });
    expect(brief.readiness.find((check) => check.id === 'cast')?.ready).toBe(false);
    expect(brief.readiness.find((check) => check.id === 'crew')?.ready).toBe(false);
    expect(brief.items.map((item) => item.id)).toEqual(expect.arrayContaining([
      'day-cast-unresolved',
      'day-crew-unconfirmed',
      'unscheduled-scenes',
    ]));
  });

  it('marks a complete registered day as ready for callsheet', () => {
    const readyProject: CastingProject = {
      ...project,
      roles: project.roles.map((role) => ({ ...role, status: 'filled' })),
      productionDays: [{
        ...project.productionDays![0],
        scenes: ['scene-1', 'scene-2'],
        crew: ['crew-ad'],
      }],
    };

    const brief = buildFirstAssistantDirectorBrief({
      project: readyProject,
      now: new Date('2026-09-10T12:00:00.000Z'),
    });

    expect(brief.readiness.every((check) => check.ready)).toBe(true);
    expect(brief.items.some((item) => item.id === 'call-sheet-ready')).toBe(true);
    expect(brief.stats.unscheduledSceneCount).toBe(0);
  });

  it('does not treat missing day fields as ready', () => {
    const incompleteProject: CastingProject = {
      ...project,
      productionDays: [{
        id: 'day-incomplete',
        projectId: project.id,
        date: '2026-09-10',
        scenes: [],
        crew: [],
        props: [],
        status: 'planned',
      }],
    };

    const brief = buildFirstAssistantDirectorBrief({
      project: incompleteProject,
      now: new Date('2026-09-10T12:00:00.000Z'),
    });

    expect(brief.productionDay?.kind).toBe('today');
    expect(brief.readiness.filter((check) => !check.ready).map((check) => check.id))
      .toEqual(['scenes', 'call-time', 'location', 'crew']);
    expect(brief.items.some((item) => item.id === 'day-plan-incomplete')).toBe(true);
  });

  it('keeps completed scene coverage without counting completed days as upcoming', () => {
    const projectWithHistory: CastingProject = {
      ...project,
      productionDays: [
        {
          ...project.productionDays![0],
          id: 'day-completed',
          date: '2026-09-09',
          status: 'completed',
        },
        {
          ...project.productionDays![0],
          id: 'day-upcoming',
          scenes: [],
          date: '2026-09-11',
          status: 'planned',
        },
      ],
    };

    const brief = buildFirstAssistantDirectorBrief({
      project: projectWithHistory,
      now: new Date('2026-09-10T12:00:00.000Z'),
    });

    expect(brief.stats.scheduledSceneCount).toBe(1);
    expect(brief.stats.unscheduledSceneCount).toBe(1);
    expect(brief.stats.upcomingProductionDayCount).toBe(1);
    expect(brief.productionDay?.id).toBe('day-upcoming');
  });

  it('validates supported 1st AD surfaces', () => {
    expect(isFirstAssistantDirectorSurface('today')).toBe(true);
    expect(isFirstAssistantDirectorSurface('call-sheet')).toBe(true);
    expect(isFirstAssistantDirectorSurface('camera')).toBe(false);
    expect(isFirstAssistantDirectorSurface(null)).toBe(false);
  });
});
