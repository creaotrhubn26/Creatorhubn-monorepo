import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProductionManagementOperations } from '../models/casting';
import {
  ProductionManagementConflictError,
  productionManagementService,
} from './productionManagementService';

vi.mock('./roleRoomAgentService', () => ({
  roleRoomAgentDefaultHeaders: () => ({ Authorization: 'Bearer test-session' }),
}));

const operations: ProductionManagementOperations = {
  dayStatus: 'ready', callSheetApproval: 'approved', crewConfirmations: [], checkpoints: [], issues: [], costItems: [], activity: [],
};

describe('productionManagementService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends an authenticated, versioned patch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ productionDay: { id: 'day/1', scenes: [], crew: [], props: [], managementVersion: 5 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await productionManagementService.save('troll project', 'day/1', 4, operations);

    expect(result.managementVersion).toBe(5);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/projects/troll%20project/production-days/day%2F1/production-management',
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
      json: async () => ({ message: 'Konflikt', productionDay: { id: 'day-1', scenes: [], crew: [], props: [], managementVersion: 8 } }),
    }));

    await expect(productionManagementService.save('troll', 'day-1', 7, operations))
      .rejects.toEqual(expect.objectContaining<Partial<ProductionManagementConflictError>>({
        name: 'ProductionManagementConflictError',
        productionDay: expect.objectContaining({ managementVersion: 8 }),
      }));
  });
});
