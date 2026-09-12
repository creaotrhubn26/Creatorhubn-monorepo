import type { ProductionCoordinationOperations, ProductionDay } from '../models/casting';
import { roleRoomAgentDefaultHeaders } from './roleRoomAgentService';

export class ProductionCoordinationConflictError extends Error {
  readonly productionDay: ProductionDay;

  constructor(message: string, productionDay: ProductionDay) {
    super(message);
    this.name = 'ProductionCoordinationConflictError';
    this.productionDay = productionDay;
  }
}

export const productionCoordinationService = {
  async save(
    projectId: string,
    productionDayId: string,
    expectedVersion: number,
    operations: ProductionCoordinationOperations,
  ): Promise<ProductionDay> {
    const response = await fetch(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/production-days/${encodeURIComponent(productionDayId)}/production-coordination`,
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
      throw new ProductionCoordinationConflictError(
        payload.message || 'Koordinatorflaten er endret av en annen bruker.',
        payload.productionDay,
      );
    }
    if (!response.ok || !payload.productionDay) {
      throw new Error(payload.message || payload.error || 'Kunne ikke lagre koordinatorflaten.');
    }
    return payload.productionDay;
  },
};
