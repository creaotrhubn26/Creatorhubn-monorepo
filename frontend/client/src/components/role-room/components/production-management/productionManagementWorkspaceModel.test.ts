import { describe, expect, it } from 'vitest';
import type { CastingProject, ProductionDay, ProductionManagementOperations } from '../../models/casting';
import {
  buildProductionManagementOperations,
  productionManagementCosts,
  productionManagementReadiness,
  selectProductionManagementDay,
} from './productionManagementWorkspaceModel';

const project: CastingProject = {
  id: 'troll', name: 'Troll', roles: [], candidates: [], schedules: [], props: [], crew: [],
  locations: [{ id: 'forest', name: 'Trollskogen' }],
};

const day = (patch: Partial<ProductionDay> = {}): ProductionDay => ({
  id: 'day-1', projectId: 'troll', date: '2026-09-14', scenes: [], crew: ['crew-1'], props: [], locationId: 'forest', ...patch,
});

describe('productionManagementWorkspaceModel', () => {
  it('selects an active production day before a future planned day', () => {
    expect(selectProductionManagementDay([
      day({ id: 'planned', date: '2099-01-02' }),
      day({ id: 'active', status: 'in_progress', date: '2099-01-01' }),
    ])?.id).toBe('active');
    expect(selectProductionManagementDay([day({ status: 'cancelled' })])).toBeUndefined();
  });

  it('builds real location, crew and logistics checkpoints without invented costs', () => {
    const operations = buildProductionManagementOperations(project, day());
    expect(operations.crewConfirmations).toEqual([expect.objectContaining({ crewId: 'crew-1', status: 'pending' })]);
    expect(operations.checkpoints.map((item) => item.title)).toContain('Lokasjon · Trollskogen');
    expect(operations.costItems).toEqual([]);
  });

  it('drops confirmations for crew no longer assigned while preserving active confirmations', () => {
    const productionDay = day({
      crew: ['crew-1', 'crew-2'],
      productionManagement: {
        dayStatus: 'not_started', callSheetApproval: 'not_ready', checkpoints: [], issues: [], costItems: [], activity: [],
        crewConfirmations: [
          { crewId: 'crew-1', status: 'confirmed' },
          { crewId: 'removed', status: 'declined' },
        ],
      },
    });
    expect(buildProductionManagementOperations(project, productionDay).crewConfirmations).toEqual([
      expect.objectContaining({ crewId: 'crew-1', status: 'confirmed' }),
      expect.objectContaining({ crewId: 'crew-2', status: 'pending' }),
    ]);
  });

  it('derives blockers and day-scoped cost deviation deterministically', () => {
    const operations: ProductionManagementOperations = {
      dayStatus: 'at_risk', callSheetApproval: 'ready_for_review', notes: '', activity: [],
      crewConfirmations: [{ crewId: 'crew-1', status: 'declined' }],
      checkpoints: [{ id: 'c1', category: 'transport', title: 'Transport', status: 'blocked' }],
      issues: [{ id: 'i1', title: 'Manglende bil', severity: 'high', status: 'open' }],
      costItems: [{ id: 'k1', category: 'Transport', title: 'Ekstra bil', estimatedCost: 1000, actualCost: 1450, status: 'pending' }],
    };
    expect(productionManagementReadiness(operations)).toEqual(expect.objectContaining({ blockers: 3, openIssues: 1, pendingCosts: 1 }));
    expect(productionManagementCosts(operations.costItems)).toEqual({ estimated: 1000, actual: 1450, deviation: 450 });
  });
});
