import type { ProductionDay, ProductionManagementOperations } from '../models/casting';
import { roleRoomAgentDefaultHeaders } from './roleRoomAgentService';

export class ProductionManagementConflictError extends Error {
  readonly productionDay: ProductionDay;

  constructor(message: string, productionDay: ProductionDay) {
    super(message);
    this.name = 'ProductionManagementConflictError';
    this.productionDay = productionDay;
  }
}

export const productionManagementService = {
  async save(
    projectId: string,
    productionDayId: string,
    expectedVersion: number,
    operations: ProductionManagementOperations,
  ): Promise<ProductionDay> {
    const response = await fetch(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/production-days/${encodeURIComponent(productionDayId)}/production-management`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({ expectedVersion, operations }),
      },
    );
    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      message?: string;
      productionDay?: ProductionDay;
    };
    if (response.status === 409 && payload.productionDay) {
      throw new ProductionManagementConflictError(
        payload.message || 'Dagskontrollen er endret av en annen bruker.',
        payload.productionDay,
      );
    }
    if (!response.ok || !payload.productionDay) {
      throw new Error(payload.message || payload.error || 'Kunne ikke lagre dagskontrollen.');
    }
    return payload.productionDay;
  },
};
