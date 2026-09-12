import type {
  ProductionContinuityComment,
  ProductionContinuityOperations,
  ProductionContinuityReference,
  ProductionDay,
} from '../models/casting';
import { roleRoomAgentDefaultHeaders } from './roleRoomAgentService';

export class ProductionContinuityConflictError extends Error {
  readonly productionDay: ProductionDay;

  constructor(message: string, productionDay: ProductionDay) {
    super(message);
    this.name = 'ProductionContinuityConflictError';
    this.productionDay = productionDay;
  }
}

async function unwrap(response: Response): Promise<{ productionDay: ProductionDay; comment?: ProductionContinuityComment }> {
  const payload = await response.json().catch(() => ({})) as {
    error?: string;
    message?: string;
    productionDay?: ProductionDay;
    comment?: ProductionContinuityComment;
  };
  if (response.status === 409 && payload.productionDay) {
    throw new ProductionContinuityConflictError(
      payload.message || 'Kontinuitetsloggen er endret av en annen bruker.',
      payload.productionDay,
    );
  }
  if (!response.ok || !payload.productionDay) {
    throw new Error(payload.message || payload.error || 'Kunne ikke lagre kontinuitetsloggen.');
  }
  return { productionDay: payload.productionDay, comment: payload.comment };
}

export const productionContinuityService = {
  async save(
    projectId: string,
    productionDayId: string,
    expectedVersion: number,
    operations: ProductionContinuityOperations,
  ): Promise<ProductionDay> {
    const response = await fetch(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/production-days/${encodeURIComponent(productionDayId)}/continuity`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({ expectedVersion, operations }),
      },
    );
    return (await unwrap(response)).productionDay;
  },

  async addComment(
    projectId: string,
    productionDayId: string,
    expectedVersion: number,
    comment: Pick<ProductionContinuityComment, 'sceneId' | 'takeId' | 'message'>,
  ): Promise<ProductionDay> {
    const response = await fetch(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/production-days/${encodeURIComponent(productionDayId)}/continuity/comments`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({ expectedVersion, comment }),
      },
    );
    return (await unwrap(response)).productionDay;
  },

  async uploadMedia(
    projectId: string,
    productionDayId: string,
    sceneId: string,
    file: File,
  ): Promise<ProductionContinuityReference> {
    const formData = new FormData();
    formData.set('sceneId', sceneId);
    formData.set('file', file);
    const response = await fetch(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/production-days/${encodeURIComponent(productionDayId)}/continuity/media`,
      {
        method: 'POST',
        credentials: 'include',
        headers: roleRoomAgentDefaultHeaders(),
        body: formData,
      },
    );
    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      message?: string;
      reference?: ProductionContinuityReference;
    };
    if (!response.ok || !payload.reference) {
      throw new Error(payload.message || payload.error || 'Kunne ikke laste opp mediet.');
    }
    return payload.reference;
  },

  async getMediaUrl(
    projectId: string,
    productionDayId: string,
    storageFileId: string,
  ): Promise<{ url: string; contentType?: string; displayName?: string }> {
    const response = await fetch(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/production-days/${encodeURIComponent(productionDayId)}/continuity/media/${encodeURIComponent(storageFileId)}/url`,
      {
        credentials: 'include',
        headers: roleRoomAgentDefaultHeaders(),
      },
    );
    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      message?: string;
      url?: string;
      contentType?: string;
      displayName?: string;
    };
    if (!response.ok || !payload.url) {
      throw new Error(payload.message || payload.error || 'Kunne ikke åpne mediet.');
    }
    return { url: payload.url, contentType: payload.contentType, displayName: payload.displayName };
  },
};
