import { describe, expect, it } from 'vitest';
import type { CastingProject } from '../../models/casting';
import { buildProducerWorkspaceBrief } from './producerWorkspaceModel';

describe('buildProducerWorkspaceBrief', () => {
  it('builds the producer overview from explicit project records', () => {
    const project = {
      id: 'project-1',
      name: 'Troll',
      budget: 2_000_000,
      currency: 'NOK',
      producerWorkflowStatus: 'awaiting_client',
      roles: [{ id: 'role-1', name: 'Nora' }],
      candidates: [{ id: 'candidate-1', name: 'Ada', status: 'selected' }],
      crew: [
        { id: 'crew-1', name: 'Ola', role: 'director', status: 'confirmed' },
        { id: 'crew-2', name: 'Mia', role: 'gaffer', status: 'pending' },
      ],
      locations: [{ id: 'location-1', name: 'Skogen' }],
      productionDays: [
        { id: 'day-1', date: '2026-09-20', status: 'scheduled', scenes: [], crew: [], equipment: [] },
        { id: 'day-2', date: '2026-09-18', status: 'completed', scenes: [], crew: [], equipment: [] },
      ],
      schedules: [],
      props: [],
    } as unknown as CastingProject;

    const brief = buildProducerWorkspaceBrief(project, '2026-09-19');

    expect(brief.stats).toMatchObject({
      productionDayCount: 2,
      upcomingProductionDayCount: 1,
      crewCount: 2,
      confirmedCrewCount: 1,
      locationCount: 1,
      selectedCandidateCount: 1,
    });
    expect(brief.actions.find((action) => action.id === 'economy')?.title).toContain('2 000 000');
    expect(brief.actions.find((action) => action.id === 'reviews')).toMatchObject({ tone: 'active' });
  });

  it('does not present missing data as ready', () => {
    const project = {
      id: 'project-empty', name: 'Tomt', roles: [], candidates: [], crew: [], locations: [], schedules: [], props: [],
    } as unknown as CastingProject;
    const brief = buildProducerWorkspaceBrief(project, '2026-09-19');

    expect(brief.actions.find((action) => action.id === 'schedule')).toMatchObject({ tone: 'attention' });
    expect(brief.actions.find((action) => action.id === 'economy')?.evidence).toBe('Mangler prosjektbudsjett');
  });
});
