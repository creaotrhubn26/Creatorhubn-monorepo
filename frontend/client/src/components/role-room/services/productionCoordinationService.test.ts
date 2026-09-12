import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProductionCoordinationOperations } from '../models/casting';
import {
  ProductionCoordinationConflictError,
  productionCoordinationService,
} from './productionCoordinationService';

vi.mock('./roleRoomAgentService', () => ({
  roleRoomAgentDefaultHeaders: () => ({ Authorization: 'Bearer test-session' }),
}));

const operations: ProductionCoordinationOperations = {
  tasks: [], crewFollowUps: [], logistics: [], documents: [], callSheetChecklist: [], escalations: [],
  handover: { status: 'draft' }, activity: [],
};

describe('productionCoordinationService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends an authenticated, versioned patch to the isolated coordination endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ productionDay: { id: 'day/1', scenes: [], crew: [], props: [], coordinationVersion: 5 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await productionCoordinationService.save('troll project', 'day/1', 4, operations);

    expect(result.coordinationVersion).toBe(5);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/projects/troll%20project/production-days/day%2F1/production-coordination',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer test-session' }),
        body: JSON.stringify({ expectedVersion: 4, operations }),
      }),
    );
  });

  it('exposes the latest server day when versions conflict', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: 'Konflikt', productionDay: { id: 'day-1', scenes: [], crew: [], props: [], coordinationVersion: 8 } }),
    }));

    await expect(productionCoordinationService.save('troll', 'day-1', 7, operations))
      .rejects.toEqual(expect.objectContaining<Partial<ProductionCoordinationConflictError>>({
        name: 'ProductionCoordinationConflictError',
        productionDay: expect.objectContaining({ coordinationVersion: 8 }),
      }));
  });
});
