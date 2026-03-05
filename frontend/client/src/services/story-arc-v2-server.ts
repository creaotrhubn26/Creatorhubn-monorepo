import { apiRequest } from '@/lib/queryClient';

export type StoryArcV2JobPhase = 'analyze' | 'script' | 'timeline' | 'apply' | 'export';
export type StoryArcV2JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type StoryArcV2Beat = 'hook' | 'context' | 'conflict' | 'turning_point' | 'resolution';
export type StoryArcV2Variant = 'safe' | 'balanced' | 'bold';

export interface StoryArcV2MediaInput {
  id?: string;
  type?: 'video' | 'audio' | 'image';
  path?: string;
  videoPath?: string;
  sourcePath?: string;
  metadata?: Record<string, unknown>;
}

export interface StoryArcV2AnalyzeStartInput {
  projectId?: string | null;
  media: StoryArcV2MediaInput[];
  intentProfileId?: string | null;
  languagePolicy?: string | null;
  musicTrackId?: string | null;
}

export interface StoryArcV2SemanticProfile {
  clipId: string;
  mediaId: string;
  start: number;
  end: number;
  people: string[];
  actions: string[];
  locationTags: string[];
  emotion: {
    label: string;
    score: number;
  };
  quality: {
    visual: number;
    audio: number;
    stability: number;
  };
  embeddingRef: string | null;
}

export interface StoryArcV2AnalysisSummary {
  sceneCount: number;
  totalDuration: number;
  transcriptionSegments: number;
  detectedSpeakers: number;
}

export interface StoryArcV2AnalysisResult {
  analysisId: string;
  projectId: string | null;
  summary: StoryArcV2AnalysisSummary;
  scenes: Array<Record<string, unknown>>;
  semanticProfiles: StoryArcV2SemanticProfile[];
  personIdentities?: Array<Record<string, unknown>>;
  warnings: string[];
  createdAt: string;
}

export interface StoryArcV2JobState {
  jobId: string;
  phase: StoryArcV2JobPhase;
  status: StoryArcV2JobStatus;
  progress: number;
  checkpoint: Record<string, unknown> | null;
  warnings: string[];
  resultRef: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StoryArcV2StoryScriptNode {
  id: string;
  beat: StoryArcV2Beat;
  start: number;
  end: number;
  duration: number;
  text: string;
  speaker: string | null;
  utteranceRefs: string[];
  candidateClipIds: string[];
  locked: boolean;
  pinned: boolean;
  rationale: string;
  confidence: number;
}

export interface StoryArcV2StoryScript {
  scriptId: string;
  analysisId: string;
  revision: number;
  title: string;
  targetDurationSeconds: number;
  nodes: StoryArcV2StoryScriptNode[];
  bannedClipIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryArcV2GenerateScriptInput {
  analysisId: string;
  targetDuration?: number;
  styleProfile?: Record<string, unknown>;
  mustInclude?: string[];
  mustAvoid?: string[];
}

export interface StoryArcV2StoryArcCompat {
  title?: string;
  beats: Array<Record<string, unknown>>;
  musicSuggestions?: Array<Record<string, unknown>>;
  transitionPoints?: Array<Record<string, unknown>>;
}

export interface StoryArcV2ScriptEditOperation {
  op: 'reorder' | 'lockNode' | 'replaceCandidate' | 'banClip' | 'regenerateNode' | 'approveNode';
  nodeId?: string;
  fromIndex?: number;
  toIndex?: number;
  locked?: boolean;
  clipId?: string;
  replacementClipId?: string;
  reason?: string;
}

export interface StoryArcV2EditScriptInput {
  scriptId: string;
  operations: StoryArcV2ScriptEditOperation[];
}

export interface StoryArcV2NarrativeConstraints {
  shotMin?: number;
  shotMax?: number;
  noOverlap?: boolean;
  repetitionCaps?: Record<string, number>;
  beatCoverageRequired?: boolean;
}

export interface StoryArcV2TimelineClip {
  id: string;
  name: string;
  beatName: string;
  start: number;
  duration: number;
  trackId: string;
  sourceFile?: string;
  metadata?: Record<string, unknown>;
}

export interface StoryArcV2TimelineVariantPlan {
  variant: StoryArcV2Variant;
  selectedClipIds: string[];
  timeline: {
    clips: StoryArcV2TimelineClip[];
    totalDuration: number;
  };
  summary: string[];
}

export interface StoryArcV2TimelineProposal {
  proposalId: string;
  scriptId: string;
  revision: number;
  generatedAt: string;
  selectedVariant: StoryArcV2Variant;
  variants: Record<StoryArcV2Variant, StoryArcV2TimelineVariantPlan>;
  explainabilityByClipId: Record<string, Record<string, unknown>>;
  warnings: string[];
}

export interface StoryArcV2PlanTimelineInput {
  scriptId: string;
  variant?: StoryArcV2Variant;
  constraints?: StoryArcV2NarrativeConstraints;
  musicPolicy?: Record<string, unknown>;
}

export interface StoryArcV2ApplyTimelineInput {
  proposalId: string;
  revision: number;
}

export interface StoryArcV2RevertTimelineInput {
  proposalId: string;
  revision: number;
  reason?: string;
}

export interface StoryArcV2TimelineApplyState {
  success: boolean;
  idempotent: boolean;
  proposalId: string;
  revision: number;
  appliedAt: string;
  applyCount: number;
  revertedAt: string | null;
  revertCount: number;
  timeline?: Record<string, unknown> | null;
}

export interface StoryArcV2QualityScorecard {
  scorecardId: string;
  proposalId: string;
  scriptId: string;
  analysisId: string;
  projectId: string | null;
  variant: StoryArcV2Variant;
  metrics: {
    beatCoverage: number;
    narrativeCoherence: number;
    technicalCompliance: number;
    repetitionBalance: number;
    explainabilityCoverage: number;
    durationFit: number;
    feedbackAlignment: number;
  };
  overallScore: number;
  warnings: string[];
  generatedAt: string;
}

export interface StoryArcV2EvaluateQualityInput {
  proposalId: string;
}

export interface StoryArcV2ExportInput {
  proposalId: string;
  format?: 'fcpxml' | 'xml' | 'resolve-json';
  includeScriptNotes?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeJob(payload: unknown): StoryArcV2JobState {
  if (!isRecord(payload)) {
    throw new Error('Invalid Story Arc V2 job payload');
  }

  const statusRaw = typeof payload.status === 'string' ? payload.status : 'failed';
  const phaseRaw = typeof payload.phase === 'string' ? payload.phase : 'analyze';

  const status: StoryArcV2JobStatus =
    statusRaw === 'queued' ||
    statusRaw === 'processing' ||
    statusRaw === 'completed' ||
    statusRaw === 'failed' ||
    statusRaw === 'cancelled'
      ? statusRaw
      : 'failed';

  const phase: StoryArcV2JobPhase =
    phaseRaw === 'analyze' ||
    phaseRaw === 'script' ||
    phaseRaw === 'timeline' ||
    phaseRaw === 'apply' ||
    phaseRaw === 'export'
      ? phaseRaw
      : 'analyze';

  return {
    jobId:
      typeof payload.jobId === 'string'
        ? payload.jobId
        : typeof payload.job_id === 'string'
          ? payload.job_id
          : '',
    phase,
    status,
    progress: typeof payload.progress === 'number' ? payload.progress : 0,
    checkpoint: isRecord(payload.checkpoint) ? payload.checkpoint : null,
    warnings: Array.isArray(payload.warnings)
      ? payload.warnings.filter((item): item is string => typeof item === 'string')
      : [],
    resultRef: typeof payload.resultRef === 'string' ? payload.resultRef : null,
    result: isRecord(payload.result) ? payload.result : null,
    error: typeof payload.error === 'string' ? payload.error : null,
    createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : null,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
  };
}

export async function startStoryArcV2AnalyzeJob(
  input: StoryArcV2AnalyzeStartInput
): Promise<string> {
  const payload = await apiRequest('/api/story-arc/v2/analyze/start', {
    method: 'POST',
    body: input,
  });

  if (!isRecord(payload)) {
    throw new Error('Invalid Story Arc V2 analyze start response');
  }

  const jobId =
    typeof payload.jobId === 'string'
      ? payload.jobId
      : typeof payload.job_id === 'string'
        ? payload.job_id
        : '';

  if (!jobId) {
    throw new Error('Missing Story Arc V2 job id');
  }

  return jobId;
}

export async function getStoryArcV2JobStatus(jobId: string): Promise<StoryArcV2JobState> {
  const payload = await apiRequest(`/api/story-arc/v2/jobs/${encodeURIComponent(jobId)}`);
  return normalizeJob(payload);
}

export async function cancelStoryArcV2Job(jobId: string): Promise<StoryArcV2JobState> {
  const payload = await apiRequest(`/api/story-arc/v2/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
  return normalizeJob(payload);
}

export async function generateStoryArcV2Script(
  input: StoryArcV2GenerateScriptInput
): Promise<{
  script: StoryArcV2StoryScript;
  storyArc: StoryArcV2StoryArcCompat;
}> {
  const payload = await apiRequest('/api/story-arc/v2/script/generate', {
    method: 'POST',
    body: input,
  });
  if (!isRecord(payload) || !isRecord(payload.script)) {
    throw new Error('Invalid Story Arc V2 script response');
  }

  return {
    script: payload.script as StoryArcV2StoryScript,
    storyArc: isRecord(payload.storyArc)
      ? ({
          ...payload.storyArc,
          beats: Array.isArray(payload.storyArc.beats) ? payload.storyArc.beats : [],
          musicSuggestions: Array.isArray(payload.storyArc.musicSuggestions)
            ? payload.storyArc.musicSuggestions
            : [],
          transitionPoints: Array.isArray(payload.storyArc.transitionPoints)
            ? payload.storyArc.transitionPoints
            : [],
        } as StoryArcV2StoryArcCompat)
      : {
          beats: [],
          musicSuggestions: [],
          transitionPoints: [],
        },
  };
}

export async function editStoryArcV2Script(
  input: StoryArcV2EditScriptInput
): Promise<StoryArcV2StoryScript> {
  const payload = await apiRequest('/api/story-arc/v2/script/edit', {
    method: 'POST',
    body: input,
  });
  if (!isRecord(payload) || !isRecord(payload.script)) {
    throw new Error('Invalid Story Arc V2 script edit response');
  }
  return payload.script as StoryArcV2StoryScript;
}

export async function planStoryArcV2Timeline(
  input: StoryArcV2PlanTimelineInput
): Promise<StoryArcV2TimelineProposal> {
  const payload = await apiRequest('/api/story-arc/v2/timeline/plan', {
    method: 'POST',
    body: input,
  });
  if (!isRecord(payload) || !isRecord(payload.proposal)) {
    throw new Error('Invalid Story Arc V2 timeline plan response');
  }
  return payload.proposal as StoryArcV2TimelineProposal;
}

export async function applyStoryArcV2Timeline(
  input: StoryArcV2ApplyTimelineInput
): Promise<StoryArcV2TimelineApplyState> {
  const payload = await apiRequest('/api/story-arc/v2/timeline/apply', {
    method: 'POST',
    body: input,
  });
  if (!isRecord(payload)) {
    throw new Error('Invalid Story Arc V2 timeline apply response');
  }
  return payload as unknown as StoryArcV2TimelineApplyState;
}

export async function revertStoryArcV2Timeline(
  input: StoryArcV2RevertTimelineInput
): Promise<StoryArcV2TimelineApplyState> {
  const payload = await apiRequest('/api/story-arc/v2/timeline/revert', {
    method: 'POST',
    body: input,
  });
  if (!isRecord(payload)) {
    throw new Error('Invalid Story Arc V2 timeline revert response');
  }
  return payload as unknown as StoryArcV2TimelineApplyState;
}

export async function evaluateStoryArcV2Quality(
  input: StoryArcV2EvaluateQualityInput
): Promise<StoryArcV2QualityScorecard> {
  const payload = await apiRequest('/api/story-arc/v2/quality/evaluate', {
    method: 'POST',
    body: input,
  });
  if (!isRecord(payload) || !isRecord(payload.scorecard)) {
    throw new Error('Invalid Story Arc V2 quality evaluate response');
  }
  return payload.scorecard as unknown as StoryArcV2QualityScorecard;
}

export async function exportStoryArcV2(
  input: StoryArcV2ExportInput
): Promise<Record<string, unknown>> {
  const payload = await apiRequest('/api/story-arc/v2/export', {
    method: 'POST',
    body: input,
  });
  if (!isRecord(payload)) {
    throw new Error('Invalid Story Arc V2 export response');
  }
  return payload;
}

export async function pollStoryArcV2AnalyzeJob(
  jobId: string,
  opts?: { intervalMs?: number; timeoutMs?: number }
): Promise<StoryArcV2AnalysisResult> {
  const intervalMs = Math.max(500, Math.round(opts?.intervalMs ?? 1500));
  const timeoutMs = Math.max(15_000, Math.round(opts?.timeoutMs ?? 10 * 60 * 1000));
  const startedAt = Date.now();

  while (true) {
    const status = await getStoryArcV2JobStatus(jobId);

    if (status.status === 'completed') {
      const result = status.result;
      if (!result || typeof result.analysisId !== 'string') {
        throw new Error('Story Arc V2 analyze completed without analysis payload');
      }
      return result as unknown as StoryArcV2AnalysisResult;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Story Arc V2 analyze failed');
    }

    if (status.status === 'cancelled') {
      throw new Error('Story Arc V2 analyze cancelled');
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Story Arc V2 analyze timed out');
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
}
