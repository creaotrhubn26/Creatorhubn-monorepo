import { describe, expect, it } from 'vitest';
import type { CastingProject, ProductionDay } from '../../models/casting';
import {
  buildProductionCoordinationOperations,
  productionCoordinationReadiness,
} from './productionCoordinationWorkspaceModel';

const day: ProductionDay = {
  id: 'day-1', date: '2026-09-14', scenes: [], crew: ['crew-1'], props: [], locationId: 'location-1',
};
const project: CastingProject = {
  id: 'troll', name: 'Troll', roles: [], candidates: [], schedules: [], props: [],
  crew: [{ id: 'crew-1', name: 'Liv Koordinator', role: 'production_coordinator' }],
  locations: [{ id: 'location-1', name: 'Trollskogen' }], productionDays: [day],
};

describe('productionCoordinationWorkspaceModel', () => {
  it('seeds crew, logistics and callsheet preparation from the selected production day', () => {
    const operations = buildProductionCoordinationOperations(project, day);

    expect(operations.crewFollowUps).toEqual([expect.objectContaining({ crewId: 'crew-1', status: 'pending' })]);
    expect(operations.logistics).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'transport' }),
      expect.objectContaining({ title: expect.stringContaining('Trollskogen') }),
    ]));
    expect(operations.callSheetChecklist).toHaveLength(4);
    expect(operations.handover.status).toBe('draft');
  });

  it('counts operational blockers without reading PM cost or approval data', () => {
    const operations = buildProductionCoordinationOperations(project, {
      ...day,
      productionCoordination: {
        tasks: [{ id: 'task-1', title: 'Transport', category: 'transport', priority: 'urgent', status: 'blocked' }],
        crewFollowUps: [{ crewId: 'crew-1', status: 'problem' }],
        logistics: [{ id: 'log-1', title: 'Buss', category: 'transport', status: 'blocked' }],
        documents: [{ id: 'doc-1', title: 'Tillatelse', category: 'permit', status: 'missing' }],
        callSheetChecklist: [{ id: 'call-1', title: 'Tider', status: 'ready' }],
        escalations: [{ id: 'esc-1', title: 'Ingen buss', severity: 'critical', status: 'open' }],
        handover: { status: 'draft' }, activity: [],
      },
    });

    expect(productionCoordinationReadiness(operations)).toEqual(expect.objectContaining({
      openTasks: 1,
      missingDocuments: 1,
      callSheetReady: 1,
      blockers: 3,
    }));
  });
});
