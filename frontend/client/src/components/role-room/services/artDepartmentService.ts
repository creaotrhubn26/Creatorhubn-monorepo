import type { ArtDepartmentOperations, ArtDepartmentRecord } from '../models/casting';
import { roleRoomAgentDefaultHeaders } from './roleRoomAgentService';

export class ArtDepartmentConflictError extends Error {
  readonly artDepartment: ArtDepartmentRecord;

  constructor(message: string, artDepartment: ArtDepartmentRecord) {
    super(message);
    this.name = 'ArtDepartmentConflictError';
    this.artDepartment = artDepartment;
  }
}

async function readPayload(response: Response): Promise<{
  error?: string;
  message?: string;
  artDepartment?: ArtDepartmentRecord;
}> {
  return response.json().catch(() => ({}));
}

export const artDepartmentService = {
  async get(projectId: string): Promise<ArtDepartmentRecord> {
    const response = await fetch(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/art-department`,
      { credentials: 'include', headers: roleRoomAgentDefaultHeaders() },
    );
    const payload = await readPayload(response);
    if (!response.ok || !payload.artDepartment) {
      throw new Error(payload.message || payload.error || 'Kunne ikke hente produksjonsdesigngrunnlaget.');
    }
    return payload.artDepartment;
  },

  async save(
    projectId: string,
    expectedVersion: number,
    operations: ArtDepartmentOperations,
  ): Promise<ArtDepartmentRecord> {
    const response = await fetch(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/art-department`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({ expectedVersion, operations }),
      },
    );
    const payload = await readPayload(response);
    if (response.status === 409 && payload.artDepartment) {
      throw new ArtDepartmentConflictError(
        payload.message || 'Produksjonsdesigngrunnlaget er endret av en annen bruker.',
        payload.artDepartment,
      );
    }
    if (!response.ok || !payload.artDepartment) {
      throw new Error(payload.message || payload.error || 'Kunne ikke lagre produksjonsdesigngrunnlaget.');
    }
    return payload.artDepartment;
  },
};
