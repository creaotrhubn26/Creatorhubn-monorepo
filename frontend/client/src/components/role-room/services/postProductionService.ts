import type {
  PostProductionRecord,
  PostQcSeverity,
  PostTurnoverStatus,
} from '../models/casting';
import { roleRoomAgentDefaultHeaders } from './roleRoomAgentService';

export type PostProductionCommand =
  | {
      type: 'create_turnover';
      label: string;
      recipient?: string;
      notes?: string;
      productionDayId: string;
      mediaIds: string[];
    }
  | { type: 'transition_turnover'; turnoverId: string; status: PostTurnoverStatus }
  | { type: 'refresh_turnover'; turnoverId: string }
  | { type: 'add_qc_issue'; turnoverId: string; severity: PostQcSeverity; message: string }
  | { type: 'resolve_qc_issue'; turnoverId: string; issueId: string };

type PostProductionPayload = {
  error?: string;
  message?: string;
  postProduction?: PostProductionRecord;
};

export class PostProductionConflictError extends Error {
  readonly postProduction?: PostProductionRecord;

  constructor(message: string, postProduction?: PostProductionRecord) {
    super(message);
    this.name = 'PostProductionConflictError';
    this.postProduction = postProduction;
  }
}

async function payload(response: Response): Promise<PostProductionPayload> {
  return response.json().catch(() => ({}));
}

function base(projectId: string): string {
  return `/api/role-room/projects/${encodeURIComponent(projectId)}/post-production`;
}

export const postProductionService = {
  async get(projectId: string): Promise<PostProductionRecord> {
    const response = await fetch(base(projectId), {
      credentials: 'include',
      headers: roleRoomAgentDefaultHeaders(),
    });
    const body = await payload(response);
    if (!response.ok || !body.postProduction) {
      throw new Error(body.message || body.error || 'Kunne ikke hente post-produksjonsgrunnlaget.');
    }
    return body.postProduction;
  },

  async command(
    projectId: string,
    expectedVersion: number,
    command: PostProductionCommand,
  ): Promise<PostProductionRecord> {
    const response = await fetch(`${base(projectId)}/commands`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...roleRoomAgentDefaultHeaders(),
      },
      body: JSON.stringify({ expectedVersion, command }),
    });
    const body = await payload(response);
    if ((response.status === 409 || response.status === 412) && body.error === 'version_conflict') {
      throw new PostProductionConflictError(
        body.message || 'Post-produksjonsgrunnlaget er endret av en annen bruker.',
        body.postProduction,
      );
    }
    if (!response.ok || !body.postProduction) {
      throw new Error(body.message || body.error || 'Post-produksjonshandlingen mislyktes.');
    }
    return body.postProduction;
  },
};
