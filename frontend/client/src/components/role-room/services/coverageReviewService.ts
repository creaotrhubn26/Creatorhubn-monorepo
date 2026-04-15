import authSessionService from './authSessionService';
import {
  isRoleRoomDemoProjectId,
  isRoleRoomDemoSeedAllowed,
} from '../constants/producerDemo';
import type {
  ShotLineCoverageMap,
  TakeReviewDecision,
} from '../components/production/manuscript/CoverageReviewWorkspace';

export type CoverageReviewSyncStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'synced'
  | 'local_only'
  | 'error'
  | 'conflict';

export interface CoverageReviewRecord {
  projectId: string;
  takeReviews: Record<string, TakeReviewDecision>;
  shotLineCoverage: ShotLineCoverageMap;
  version: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  updatedByUserId?: string | null;
  updatedByRole?: string | null;
}

export interface SaveCoverageReviewInput {
  takeReviews: Record<string, TakeReviewDecision>;
  shotLineCoverage: ShotLineCoverageMap;
  expectedVersion?: number;
  eventType?: string;
  changedTakeId?: string;
  changedShotId?: string;
}

interface CoverageReviewApiResponse {
  success?: boolean;
  projectId?: string;
  takeReviews?: Record<string, TakeReviewDecision>;
  shotLineCoverage?: ShotLineCoverageMap;
  version?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  updatedByUserId?: string | null;
  updatedByRole?: string | null;
  error?: string;
  current?: CoverageReviewApiResponse;
}

const API_PREFIX = '/api/role-room/projects';

function normalizeProjectId(projectId: string): string {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId) {
    throw new Error('Coverage Review krever gyldig prosjekt-ID.');
  }

  if (normalizedProjectId === 'default' || normalizedProjectId === 'default-project') {
    throw new Error('Coverage Review kan ikke lagres mot standardprosjekt. Velg et ekte prosjekt først.');
  }

  if (isRoleRoomDemoProjectId(normalizedProjectId) && !isRoleRoomDemoSeedAllowed()) {
    throw new Error('Coverage Review kan ikke lagres mot låst demo-ID i produksjon. Lag en kopi først.');
  }

  return normalizedProjectId;
}

function getCoverageReviewApiUrl(projectId: string): string {
  return `${API_PREFIX}/${encodeURIComponent(projectId)}/coverage-review`;
}

async function readApiPayload(response: Response): Promise<CoverageReviewApiResponse> {
  try {
    return await response.json() as CoverageReviewApiResponse;
  } catch {
    return {};
  }
}

function getAuthHeaders(): Record<string, string> {
  return authSessionService.getAuthHeadersSync();
}

function assertMatchingProject(projectId: string, payload: CoverageReviewApiResponse): void {
  if (payload.projectId && payload.projectId !== projectId) {
    throw new Error('Serveren returnerte Coverage Review for feil prosjekt.');
  }
}

function toCoverageReviewRecord(projectId: string, payload: CoverageReviewApiResponse): CoverageReviewRecord {
  assertMatchingProject(projectId, payload);
  return {
    projectId,
    takeReviews: payload.takeReviews && typeof payload.takeReviews === 'object' ? payload.takeReviews : {},
    shotLineCoverage: payload.shotLineCoverage && typeof payload.shotLineCoverage === 'object' ? payload.shotLineCoverage : {},
    version: typeof payload.version === 'number' && Number.isFinite(payload.version) ? payload.version : 0,
    createdAt: payload.createdAt ?? null,
    updatedAt: payload.updatedAt ?? null,
    updatedByUserId: payload.updatedByUserId ?? null,
    updatedByRole: payload.updatedByRole ?? null,
  };
}

export class CoverageReviewConflictError extends Error {
  current: CoverageReviewRecord;

  constructor(projectId: string, payload: CoverageReviewApiResponse) {
    super(payload.error || 'Coverage Review-konflikt. Last inn siste serverversjon før du lagrer igjen.');
    this.name = 'CoverageReviewConflictError';
    this.current = toCoverageReviewRecord(projectId, payload.current ?? {});
  }
}

export const coverageReviewService = {
  async loadCoverageReview(projectId: string): Promise<CoverageReviewRecord> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const response = await fetch(getCoverageReviewApiUrl(normalizedProjectId), {
      headers: getAuthHeaders(),
    });
    const payload = await readApiPayload(response);

    if (!response.ok) {
      throw new Error(payload.error || `Kunne ikke hente Coverage Review (${response.status})`);
    }

    return toCoverageReviewRecord(normalizedProjectId, payload);
  },

  async saveCoverageReview(projectId: string, input: SaveCoverageReviewInput): Promise<CoverageReviewRecord> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const response = await fetch(getCoverageReviewApiUrl(normalizedProjectId), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        projectId: normalizedProjectId,
        takeReviews: input.takeReviews,
        shotLineCoverage: input.shotLineCoverage,
        expectedVersion: input.expectedVersion,
        eventType: input.eventType,
        changedTakeId: input.changedTakeId,
        changedShotId: input.changedShotId,
      }),
    });
    const payload = await readApiPayload(response);

    if (response.status === 409 && payload.current) {
      throw new CoverageReviewConflictError(normalizedProjectId, payload);
    }

    if (!response.ok) {
      throw new Error(payload.error || `Kunne ikke lagre Coverage Review (${response.status})`);
    }

    toCoverageReviewRecord(normalizedProjectId, payload);
    const confirmResponse = await fetch(getCoverageReviewApiUrl(normalizedProjectId), {
      headers: getAuthHeaders(),
    });
    const confirmedPayload = await readApiPayload(confirmResponse);

    if (!confirmResponse.ok) {
      throw new Error(confirmedPayload.error || 'Serverbekreftelse for Coverage Review-save feilet.');
    }

    return toCoverageReviewRecord(normalizedProjectId, confirmedPayload.success ? confirmedPayload : payload);
  },
};

export default coverageReviewService;
