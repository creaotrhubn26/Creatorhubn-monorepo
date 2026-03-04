import { apiRequest } from '@/lib/queryClient';
import type { AutoEditOptions } from './auto-edit-engine';
import type { BeatClip, Track } from './storyArcDataIntegration';

export type AutoEditServerJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type AutoEditNarrativeBeat = 'hook' | 'build' | 'climax' | 'resolution' | 'bridge';

export interface AutoEditServerBeatClassification {
  beat: AutoEditNarrativeBeat;
  confidence: number;
  reason: string;
  source: 'llm' | 'heuristic';
}

export interface AutoEditServerClipSignal {
  goalHits: number;
  avoidHits: number;
  culturalHits: number;
  beatHits: number;
  markerHits: number;
  beatAlignmentBoost: number;
  feedbackBoost: number;
  forbiddenHits: number;
  transcriptCoverage: number;
  narrativeConnectorHits: number;
  impactPhraseHits: number;
  fillerHits: number;
}

export interface AutoEditServerRankingResult {
  clipScores: Record<string, number>;
  rankedClipIds: string[];
  confidence: number;
  summary: string[];
  modelUsed: string;
  analyzerAvailable: boolean;
  analyzerReason: string | null;
  beatByClipId: Record<string, AutoEditServerBeatClassification>;
  beatDistribution: Record<AutoEditNarrativeBeat, number>;
  llmBeatClassificationUsed: boolean;
  clipSignalsById: Record<string, AutoEditServerClipSignal>;
}

export interface AutoEditServerJobState {
  jobId: string;
  status: AutoEditServerJobStatus;
  progress: number;
  result: AutoEditServerRankingResult | null;
  error: string | null;
  updatedAt: string | null;
}

export interface StartAutoEditServerJobInput {
  storyArcId?: string | null;
  clips: BeatClip[];
  tracks: Track[];
  options: AutoEditOptions;
  frameRate?: number;
  context?: AutoEditServerContext | null;
}

export interface AutoEditServerClipContext {
  scene?: string;
  shotName?: string;
  camera?: string;
  syncGroup?: string;
  tags?: string[];
  markerLabels?: string[];
  transcriptKeywords?: string[];
  transcriptText?: string;
  transcriptPhrases?: string[];
  speakerName?: string;
  moodHints?: string[];
}

export interface AutoEditServerContext {
  storyTitle?: string | null;
  storyType?: string | null;
  goalKeywords?: string[];
  avoidKeywords?: string[];
  culturalMoments?: string[];
  beatHints?: string[];
  intentProfileId?: string | null;
  intentProfileName?: string | null;
  intentGoalKeywords?: string[];
  intentAvoidKeywords?: string[];
  forbiddenPatterns?: string[];
  feedbackByClipId?: Record<string, 'approved' | 'rejected'>;
  clipContextById?: Record<string, AutoEditServerClipContext>;
}

const VALID_JOB_STATUSES = new Set<AutoEditServerJobStatus>([
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, value));
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
}

function normalizeRankingResult(value: unknown): AutoEditServerRankingResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const clipScoresRaw = isRecord(value.clipScores) ? value.clipScores : {};
  const clipScores: Record<string, number> = {};
  Object.entries(clipScoresRaw).forEach(([clipId, scoreValue]) => {
    const score = readNumber(scoreValue);
    if (score === null) {
      return;
    }
    clipScores[clipId] = Number(clamp(score, 0, 1).toFixed(4));
  });

  const rankedClipIds = Array.isArray(value.rankedClipIds)
    ? value.rankedClipIds.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const confidenceRaw = readNumber(value.confidence);
  const summary = Array.isArray(value.summary)
    ? value.summary.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const beatByClipIdRaw = isRecord(value.beatByClipId) ? value.beatByClipId : {};
  const beatByClipId: Record<string, AutoEditServerBeatClassification> = {};
  Object.entries(beatByClipIdRaw).forEach(([clipId, beatPayload]) => {
    if (!isRecord(beatPayload)) {
      return;
    }
    const beatRaw = typeof beatPayload.beat === 'string' ? beatPayload.beat : '';
    if (
      beatRaw !== 'hook' &&
      beatRaw !== 'build' &&
      beatRaw !== 'climax' &&
      beatRaw !== 'resolution' &&
      beatRaw !== 'bridge'
    ) {
      return;
    }
    const confidenceRaw = readNumber(beatPayload.confidence);
    beatByClipId[clipId] = {
      beat: beatRaw,
      confidence: Number(clamp(confidenceRaw ?? 0.6, 0, 1).toFixed(3)),
      reason:
        typeof beatPayload.reason === 'string' && beatPayload.reason.trim().length > 0
          ? beatPayload.reason
          : 'semantic beat classification',
      source: beatPayload.source === 'llm' ? 'llm' : 'heuristic',
    };
  });

  const beatDistributionDefaults: Record<AutoEditNarrativeBeat, number> = {
    hook: 0,
    build: 0,
    climax: 0,
    resolution: 0,
    bridge: 0,
  };
  const beatDistributionRaw = isRecord(value.beatDistribution) ? value.beatDistribution : {};
  const beatDistribution: Record<AutoEditNarrativeBeat, number> = {
    hook: Number(readNumber(beatDistributionRaw.hook) ?? 0),
    build: Number(readNumber(beatDistributionRaw.build) ?? 0),
    climax: Number(readNumber(beatDistributionRaw.climax) ?? 0),
    resolution: Number(readNumber(beatDistributionRaw.resolution) ?? 0),
    bridge: Number(readNumber(beatDistributionRaw.bridge) ?? 0),
  };

  const clipSignalsByIdRaw = isRecord(value.clipSignalsById) ? value.clipSignalsById : {};
  const clipSignalsById: Record<string, AutoEditServerClipSignal> = {};
  Object.entries(clipSignalsByIdRaw).forEach(([clipId, signal]) => {
    if (!isRecord(signal)) {
      return;
    }
    clipSignalsById[clipId] = {
      goalHits: Number(readNumber(signal.goalHits) ?? 0),
      avoidHits: Number(readNumber(signal.avoidHits) ?? 0),
      culturalHits: Number(readNumber(signal.culturalHits) ?? 0),
      beatHits: Number(readNumber(signal.beatHits) ?? 0),
      markerHits: Number(readNumber(signal.markerHits) ?? 0),
      beatAlignmentBoost: Number(readNumber(signal.beatAlignmentBoost) ?? 0),
      feedbackBoost: Number(readNumber(signal.feedbackBoost) ?? 0),
      forbiddenHits: Number(readNumber(signal.forbiddenHits) ?? 0),
      transcriptCoverage: Number(readNumber(signal.transcriptCoverage) ?? 0),
      narrativeConnectorHits: Number(readNumber(signal.narrativeConnectorHits) ?? 0),
      impactPhraseHits: Number(readNumber(signal.impactPhraseHits) ?? 0),
      fillerHits: Number(readNumber(signal.fillerHits) ?? 0),
    };
  });

  return {
    clipScores,
    rankedClipIds,
    confidence:
      confidenceRaw === null ? 0 : Number(clamp(confidenceRaw, 0, 1).toFixed(3)),
    summary,
    modelUsed:
      typeof value.modelUsed === 'string' && value.modelUsed.trim().length > 0
        ? value.modelUsed
        : 'story-arc-analyzer:fallback',
    analyzerAvailable: value.analyzerAvailable === true,
    analyzerReason:
      typeof value.analyzerReason === 'string' && value.analyzerReason.trim().length > 0
        ? value.analyzerReason
        : null,
    beatByClipId,
    beatDistribution:
      Object.values(beatDistribution).some((count) => count > 0)
        ? beatDistribution
        : beatDistributionDefaults,
    llmBeatClassificationUsed: value.llmBeatClassificationUsed === true,
    clipSignalsById,
  };
}

function normalizeJobStatus(payload: unknown): AutoEditServerJobState {
  if (!isRecord(payload)) {
    throw new Error('Invalid auto edit job status payload');
  }
  const jobId =
    typeof payload.job_id === 'string' && payload.job_id.trim().length > 0
      ? payload.job_id
      : '';
  if (!jobId) {
    throw new Error('Invalid auto edit job id');
  }

  const statusRaw = typeof payload.status === 'string' ? payload.status : '';
  const status: AutoEditServerJobStatus = VALID_JOB_STATUSES.has(statusRaw as AutoEditServerJobStatus)
    ? (statusRaw as AutoEditServerJobStatus)
    : 'failed';
  const progressRaw = readNumber(payload.progress);
  const error =
    typeof payload.error === 'string' && payload.error.trim().length > 0
      ? payload.error
      : null;
  const updatedAt =
    typeof payload.updated_at === 'string' && payload.updated_at.trim().length > 0
      ? payload.updated_at
      : null;

  return {
    jobId,
    status,
    progress: Number(clamp(progressRaw ?? 0, 0, 100).toFixed(1)),
    result: normalizeRankingResult(payload.result),
    error,
    updatedAt,
  };
}

export async function startAutoEditServerJob(
  input: StartAutoEditServerJobInput
): Promise<string> {
  const response = (await apiRequest('/api/story-arc/auto-edit/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storyArcId: input.storyArcId || null,
      frameRate: input.frameRate ?? 30,
      options: input.options,
      context: input.context || null,
      clips: input.clips.map((clip) => ({
        id: clip.id,
        name: clip.name,
        start: clip.start,
        duration: clip.duration,
        trackId: clip.trackId,
        tags: Array.isArray(clip.tags) ? clip.tags : [],
        metadata: isRecord(clip.metadata) ? clip.metadata : {},
      })),
      tracks: input.tracks.map((track) => ({
        id: track.id,
        name: track.name,
        type: track.type,
      })),
    }),
  })) as unknown;

  if (!isRecord(response)) {
    throw new Error('Failed to start Auto Edit server job');
  }
  if (response.success !== true || typeof response.job_id !== 'string') {
    throw new Error(
      typeof response.error === 'string' ? response.error : 'Failed to start Auto Edit server job'
    );
  }
  return response.job_id;
}

export async function getAutoEditServerJob(jobId: string): Promise<AutoEditServerJobState> {
  const response = (await apiRequest(`/api/story-arc/auto-edit/jobs/${encodeURIComponent(jobId)}`)) as unknown;
  return normalizeJobStatus(response);
}

export async function cancelAutoEditServerJob(jobId: string): Promise<void> {
  await apiRequest(`/api/story-arc/auto-edit/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
}

export async function retryAutoEditServerJob(jobId: string): Promise<void> {
  await apiRequest(`/api/story-arc/auto-edit/jobs/${encodeURIComponent(jobId)}/retry`, {
    method: 'POST',
  });
}
