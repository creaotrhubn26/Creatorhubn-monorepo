import type { BeatClip, Track } from './storyArcDataIntegration';

export type AutoEditPreset = 'reel-30' | 'story-60' | 'interview';
export type AutoEditVariant = 'safe' | 'balanced' | 'bold';
export type AutoEditNarrativeBeat = 'hook' | 'build' | 'climax' | 'resolution' | 'bridge';
export type AutoEditFeedbackValue = 'approved' | 'rejected';

export interface AutoEditMarker {
  id: string;
  time: number;
  color?: string;
  label?: string;
}

export interface AutoEditTransition {
  id: string;
  time: number;
  trackId: string;
  type: string;
  duration?: number;
  clipId?: string;
  linkedClipId?: string;
  edge?: 'in' | 'out';
  layer?: 'video' | 'audio';
  engine?: 'canvas2d' | 'webgl' | 'audio';
}

export interface AutoEditClipSignal {
  goalHits?: number;
  avoidHits?: number;
  culturalHits?: number;
  beatHits?: number;
  markerHits?: number;
  beatAlignmentBoost?: number;
  feedbackBoost?: number;
  forbiddenHits?: number;
  transcriptCoverage?: number;
  narrativeConnectorHits?: number;
  impactPhraseHits?: number;
  fillerHits?: number;
}

export interface AutoEditOptions {
  preset: AutoEditPreset;
  targetDurationSeconds: number;
  includeAssemble: boolean;
  includePolish: boolean;
  addMarkers: boolean;
  addAudioBed: boolean;
  transitionDensity: number;

  // Alternatives and intent
  variant: AutoEditVariant;
  intentProfileId?: string;

  // Hard constraints
  enforceNoOverlap: boolean;
  minShotDurationSeconds: number;
  maxShotDurationSeconds: number;
  maxConsecutiveByCamera: number;
  maxConsecutiveBySpeaker: number;

  // Audio narrative
  enableDucking: boolean;
  duckingAmountDb: number;
  enableJCutLCut: boolean;
  cleanupFillerPauses: boolean;
  qualityGuardMinConfidence: number;
}

export interface AutoEditInput {
  clips: BeatClip[];
  tracks: Track[];
  transitions?: AutoEditTransition[];
  markers?: AutoEditMarker[];
  frameRate?: number;
  humanFeedbackByClipId?: Record<string, AutoEditFeedbackValue>;
  serverRanking?: {
    clipScores: Record<string, number>;
    rankedClipIds?: string[];
    clipSignalsById?: Record<string, AutoEditClipSignal>;
    beatByClipId?: Record<
      string,
      {
        beat: AutoEditNarrativeBeat;
        confidence?: number;
        reason?: string;
        source?: 'llm' | 'heuristic';
      }
    >;
    beatDistribution?: Partial<Record<AutoEditNarrativeBeat, number>>;
    confidence?: number;
    summary?: string[];
    modelUsed?: string;
    analyzerAvailable?: boolean;
    llmBeatClassificationUsed?: boolean;
  } | null;
}

export interface AutoEditClipExplainability {
  clipId: string;
  score: number;
  goalMatch: number;
  emotion: number;
  beat: {
    beat: AutoEditNarrativeBeat;
    confidence: number;
    reason: string;
    source: 'llm' | 'heuristic' | 'server';
  } | null;
  faceConfidence: number;
  audioConfidence: number;
  narrative: {
    transcriptCoverage: number;
    connectorHits: number;
    impactPhraseHits: number;
    fillerHits: number;
    transcriptExcerpt: string | null;
  };
  cameraTag: string | null;
  speakerTag: string | null;
  feedback: AutoEditFeedbackValue | null;
  requiresExternalBroll?: boolean;
  externalBrollSuggestions?: string[];
  fallbackMessage?: string | null;
  reasons: string[];
}

export interface AutoEditProposal {
  proposalId: string;
  variant: AutoEditVariant;
  clips: BeatClip[];
  transitions: AutoEditTransition[];
  markers: AutoEditMarker[];
  preset: AutoEditPreset;
  targetDurationSeconds: number;
  estimatedDurationSeconds: number;
  confidence: number;
  summary: string[];
  selectedClipIds: string[];
  clipExplainabilityById: Record<string, AutoEditClipExplainability>;
  constraintIssues: string[];
  storyValidationReport: AutoEditStoryValidationReport;
}

export interface AutoEditAlternativesResult {
  defaultVariant: AutoEditVariant;
  alternatives: Record<AutoEditVariant, AutoEditProposal>;
  comparisonSummary: string[];
}

export type AutoEditValidationSeverity = 'error' | 'warning' | 'info';
export type AutoEditValidationIssueCode =
  | 'clip_overlap'
  | 'track_bounds'
  | 'negative_duration'
  | 'invalid_offset'
  | 'missing_narrative_beat'
  | 'low_explainability_coverage'
  | 'source_coverage';

export interface AutoEditValidationIssue {
  code: AutoEditValidationIssueCode;
  severity: AutoEditValidationSeverity;
  message: string;
  clipId?: string;
  trackId?: string;
}

export interface AutoEditStoryValidationReport {
  generatedAt: string;
  pass: boolean;
  score: number;
  hardConstraintPass: boolean;
  narrativePass: boolean;
  coveragePass: boolean;
  metrics: {
    targetDurationSeconds: number;
    estimatedDurationSeconds: number;
    durationDeltaSeconds: number;
    outputClipCount: number;
    outputVideoClipCount: number;
    outputAudioClipCount: number;
    uniqueSourceCount: number;
    sourceCoverageRatio: number;
    overlapCount: number;
    trackBoundsIssueCount: number;
    negativeDurationCount: number;
    invalidOffsetCount: number;
    explainabilityCoverageRatio: number;
    beatCoverage: {
      hook: boolean;
      build: boolean;
      climax: boolean;
      resolution: boolean;
    };
  };
  issues: AutoEditValidationIssue[];
  summary: string[];
}

interface PresetConfig {
  duration: number;
  minClipDuration: number;
  idealClipDuration: number;
  maxClipDuration: number;
  defaultTransitionDuration: number;
}

interface ScoredVideoCandidate {
  clip: BeatClip;
  score: number;
}

interface PhasePlan {
  beat: AutoEditNarrativeBeat;
  ratio: number;
}

interface BeatInfo {
  beat: AutoEditNarrativeBeat;
  confidence: number;
  reason: string;
  source?: 'llm' | 'heuristic';
}

const PRESET_CONFIG: Record<AutoEditPreset, PresetConfig> = {
  'reel-30': {
    duration: 30,
    minClipDuration: 0.9,
    idealClipDuration: 2.1,
    maxClipDuration: 3.8,
    defaultTransitionDuration: 0.28,
  },
  'story-60': {
    duration: 60,
    minClipDuration: 1.3,
    idealClipDuration: 3.2,
    maxClipDuration: 5.4,
    defaultTransitionDuration: 0.34,
  },
  interview: {
    duration: 120,
    minClipDuration: 2.2,
    idealClipDuration: 5.8,
    maxClipDuration: 10.5,
    defaultTransitionDuration: 0.42,
  },
};

const PRESET_PHASE_PLAN: Record<AutoEditPreset, PhasePlan[]> = {
  'reel-30': [
    { beat: 'hook', ratio: 0.2 },
    { beat: 'build', ratio: 0.35 },
    { beat: 'climax', ratio: 0.3 },
    { beat: 'resolution', ratio: 0.15 },
  ],
  'story-60': [
    { beat: 'hook', ratio: 0.16 },
    { beat: 'build', ratio: 0.42 },
    { beat: 'climax', ratio: 0.28 },
    { beat: 'resolution', ratio: 0.14 },
  ],
  interview: [
    { beat: 'hook', ratio: 0.14 },
    { beat: 'build', ratio: 0.55 },
    { beat: 'climax', ratio: 0.21 },
    { beat: 'resolution', ratio: 0.1 },
  ],
};

const PHASE_ACCEPTED_BEATS: Record<AutoEditNarrativeBeat, AutoEditNarrativeBeat[]> = {
  hook: ['hook'],
  build: ['build', 'bridge'],
  climax: ['climax'],
  resolution: ['resolution', 'bridge'],
  bridge: ['bridge', 'build', 'resolution'],
};

const FILLER_WORD_PATTERN = /\b(uh|umm|um|er|ah|like you know|you know|sort of|kind of)\b/gi;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readString(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  return null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapToFrame(timeSeconds: number, frameRate: number): number {
  const safeFrameRate = Math.max(1, Math.round(frameRate));
  return Math.round(timeSeconds * safeFrameRate) / safeFrameRate;
}

function cloneClip(clip: BeatClip): BeatClip {
  return {
    ...clip,
    tags: Array.isArray(clip.tags) ? [...clip.tags] : undefined,
    metadata: isRecord(clip.metadata) ? { ...clip.metadata } : clip.metadata,
  };
}

function cloneTransition(transition: AutoEditTransition): AutoEditTransition {
  return { ...transition };
}

function cloneMarker(marker: AutoEditMarker): AutoEditMarker {
  return { ...marker };
}

function isAudioTrackId(trackId: string, tracks: Track[]): boolean {
  const normalized = trackId.toLowerCase();
  if (normalized.startsWith('audio') || /^a\d+$/.test(normalized)) {
    return true;
  }
  const track = tracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    return false;
  }
  if (track.type === 'audio') {
    return true;
  }
  return track.name.toLowerCase().includes('audio');
}

function resolvePrimaryVideoTrackId(tracks: Track[], clips: BeatClip[]): string {
  const explicitVideoTrack = tracks.find((track) => !isAudioTrackId(track.id, tracks));
  if (explicitVideoTrack) {
    return explicitVideoTrack.id;
  }
  const clipVideoTrack = clips.find((clip) => !isAudioTrackId(clip.trackId, tracks));
  if (clipVideoTrack) {
    return clipVideoTrack.trackId;
  }
  return tracks[0]?.id || 'video-1';
}

function resolvePrimaryAudioTrackId(tracks: Track[], clips: BeatClip[]): string | null {
  const explicitAudioTrack = tracks.find((track) => isAudioTrackId(track.id, tracks));
  if (explicitAudioTrack) {
    return explicitAudioTrack.id;
  }
  const clipAudioTrack = clips.find((clip) => isAudioTrackId(clip.trackId, tracks));
  if (clipAudioTrack) {
    return clipAudioTrack.trackId;
  }
  return null;
}

function resolveCameraTag(clip: BeatClip): string | null {
  const metadata = isRecord(clip.metadata) ? clip.metadata : null;
  const context = metadata && isRecord(metadata.autoEditContext) ? metadata.autoEditContext : null;
  return (
    readString(context?.camera) ||
    readString(metadata?.camera) ||
    readString(metadata?.sourceCamera) ||
    null
  );
}

function resolveSpeakerTag(clip: BeatClip): string | null {
  const metadata = isRecord(clip.metadata) ? clip.metadata : null;
  const context = metadata && isRecord(metadata.autoEditContext) ? metadata.autoEditContext : null;
  return (
    readString(context?.speaker) ||
    readString(metadata?.speaker) ||
    readString(metadata?.speakerName) ||
    null
  );
}

function resolveTranscriptText(clip: BeatClip): string {
  const metadata = isRecord(clip.metadata) ? clip.metadata : null;
  const context = metadata && isRecord(metadata.autoEditContext) ? metadata.autoEditContext : null;
  return (
    readString(context?.transcriptText) ||
    readString(metadata?.transcript) ||
    readString(metadata?.captionText) ||
    readString(metadata?.detectedSpeech) ||
    ''
  );
}

function buildTranscriptExcerpt(clip: BeatClip, maxLength = 140): string | null {
  const normalized = resolveTranscriptText(clip)
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function estimateFillerRatio(clip: BeatClip): number {
  const transcript = resolveTranscriptText(clip);
  if (!transcript) {
    return 0;
  }
  const totalWords = transcript
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
  if (totalWords === 0) {
    return 0;
  }
  const fillerMatches = transcript.match(FILLER_WORD_PATTERN);
  const fillerCount = fillerMatches ? fillerMatches.length : 0;
  return clampNumber(fillerCount / totalWords, 0, 1);
}

function scoreClip(
  clip: BeatClip,
  config: PresetConfig,
  options: AutoEditOptions,
  serverScore: number | undefined,
  feedback: AutoEditFeedbackValue | undefined
): number {
  let score = 0.45;

  const duration = Number.isFinite(clip.duration) ? clip.duration : 0;
  if (duration >= config.minClipDuration && duration <= config.maxClipDuration * 1.5) {
    score += 0.16;
  }
  const durationDelta = Math.abs(duration - config.idealClipDuration);
  score += clampNumber(0.2 - durationDelta * 0.03, -0.05, 0.2);

  if (isRecord(clip.metadata)) {
    const syncConfidence = clip.metadata.syncConfidence;
    if (typeof syncConfidence === 'number' && Number.isFinite(syncConfidence)) {
      score += clampNumber(syncConfidence, 0, 1) * 0.12;
    }

    const faceDetection = clip.metadata.faceDetection;
    if (isRecord(faceDetection)) {
      if (faceDetection.hasFace === true) {
        score += 0.1;
      }
      const faceConfidence = faceDetection.confidence;
      if (typeof faceConfidence === 'number' && Number.isFinite(faceConfidence)) {
        score += clampNumber(faceConfidence, 0, 1) * 0.1;
      }
      const faceCount = faceDetection.faceCount;
      if (typeof faceCount === 'number' && Number.isFinite(faceCount) && faceCount > 1) {
        score += 0.04;
      }
    }
  }

  const tagBoost = (clip.tags || []).reduce((acc, tag) => {
    const normalized = String(tag).toLowerCase().trim();
    if (!normalized) {
      return acc;
    }
    if (normalized.includes('hero') || normalized.includes('best') || normalized.includes('highlight')) {
      return acc + 0.08;
    }
    if (normalized.includes('closeup') || normalized.includes('emotion') || normalized.includes('reaction')) {
      return acc + 0.05;
    }
    if (normalized.includes('filler') || normalized.includes('broll') || normalized.includes('pause')) {
      return acc - 0.03;
    }
    return acc;
  }, 0);
  score += tagBoost;

  if (clip.name.toLowerCase().includes('intro') || clip.name.toLowerCase().includes('opening')) {
    score += 0.04;
  }

  if (options.cleanupFillerPauses) {
    const fillerRatio = estimateFillerRatio(clip);
    if (fillerRatio > 0.03) {
      score -= clampNumber(fillerRatio * 0.65, 0, 0.16);
    }
  }

  if (feedback === 'approved') {
    score += 0.14;
  }
  if (feedback === 'rejected') {
    score -= 0.24;
  }

  if (typeof serverScore === 'number' && Number.isFinite(serverScore)) {
    const boundedServerScore = clampNumber(serverScore, 0, 1);
    score = score * 0.68 + boundedServerScore * 0.32;
  }

  return clampNumber(score, 0, 1);
}

function resolveTargetClipDuration(
  sourceDuration: number,
  config: PresetConfig,
  options: AutoEditOptions,
  frameRate: number
): number {
  const boundedSource = Math.max(0, sourceDuration);
  const dynamicMin = clampNumber(options.minShotDurationSeconds, 0.2, 15);
  const dynamicMax = clampNumber(
    options.maxShotDurationSeconds,
    Math.max(dynamicMin + 0.1, 0.4),
    40
  );
  const desired = clampNumber(
    Math.min(boundedSource, config.idealClipDuration * 1.35),
    dynamicMin,
    Math.min(dynamicMax, config.maxClipDuration)
  );
  const fallback = clampNumber(boundedSource, dynamicMin, dynamicMax);
  return snapToFrame(Math.max(dynamicMin, Number.isFinite(desired) ? desired : fallback), frameRate);
}

function withAutoEditMetadata(
  clip: BeatClip,
  options: AutoEditOptions,
  score: number,
  sourceStart: number,
  sourceTrackId: string,
  explainability: AutoEditClipExplainability | null
): BeatClip {
  return {
    ...clip,
    metadata: {
      ...(isRecord(clip.metadata) ? clip.metadata : {}),
      autoEdit: {
        preset: options.preset,
        variant: options.variant,
        intentProfileId: options.intentProfileId || null,
        score: Number(score.toFixed(3)),
        sourceStart,
        sourceTrackId,
        explainability,
        generatedAt: new Date().toISOString(),
      },
    },
  };
}

function applyDefaultFadeMetadata(
  clip: BeatClip,
  layer: 'video' | 'audio',
  edge: 'in' | 'out',
  duration: number
): BeatClip {
  const fadeKey = `${layer}Fade${edge === 'in' ? 'In' : 'Out'}`;
  const metadata = isRecord(clip.metadata) ? { ...clip.metadata } : {};
  metadata[fadeKey] = {
    duration,
    curve: 'linear',
    layer,
    edge,
    source: 'auto-edit',
  };
  return { ...clip, metadata };
}

function normalizeBeatPayload(value: unknown): BeatInfo | null {
  if (!isRecord(value)) {
    return null;
  }
  const beatRaw = typeof value.beat === 'string' ? value.beat : '';
  if (
    beatRaw !== 'hook' &&
    beatRaw !== 'build' &&
    beatRaw !== 'climax' &&
    beatRaw !== 'resolution' &&
    beatRaw !== 'bridge'
  ) {
    return null;
  }
  const confidenceRaw = value.confidence;
  const confidence =
    typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
      ? clampNumber(confidenceRaw, 0, 1)
      : 0.65;
  const source = value.source === 'llm' ? 'llm' : value.source === 'heuristic' ? 'heuristic' : undefined;
  return {
    beat: beatRaw,
    confidence,
    reason: readString(value.reason) || `beat classified as ${beatRaw}`,
    source,
  };
}

function getBeatByClipId(input: AutoEditInput): Record<string, BeatInfo> {
  const beatByClipIdRaw = isRecord(input.serverRanking?.beatByClipId) ? input.serverRanking?.beatByClipId : {};
  const normalized: Record<string, BeatInfo> = {};
  Object.entries(beatByClipIdRaw).forEach(([clipId, beatPayload]) => {
    const parsed = normalizeBeatPayload(beatPayload);
    if (!parsed) {
      return;
    }
    normalized[clipId] = parsed;
  });
  return normalized;
}

function getSignalByClipId(input: AutoEditInput): Record<string, AutoEditClipSignal> {
  const raw = isRecord(input.serverRanking?.clipSignalsById) ? input.serverRanking?.clipSignalsById : {};
  const parsed: Record<string, AutoEditClipSignal> = {};
  Object.entries(raw).forEach(([clipId, signal]) => {
    if (!isRecord(signal)) {
      return;
    }
    parsed[clipId] = {
      goalHits: readNumber(signal.goalHits) ?? undefined,
      avoidHits: readNumber(signal.avoidHits) ?? undefined,
      culturalHits: readNumber(signal.culturalHits) ?? undefined,
      beatHits: readNumber(signal.beatHits) ?? undefined,
      markerHits: readNumber(signal.markerHits) ?? undefined,
      beatAlignmentBoost: readNumber(signal.beatAlignmentBoost) ?? undefined,
      feedbackBoost: readNumber(signal.feedbackBoost) ?? undefined,
      forbiddenHits: readNumber(signal.forbiddenHits) ?? undefined,
      transcriptCoverage: readNumber(signal.transcriptCoverage) ?? undefined,
      narrativeConnectorHits: readNumber(signal.narrativeConnectorHits) ?? undefined,
      impactPhraseHits: readNumber(signal.impactPhraseHits) ?? undefined,
      fillerHits: readNumber(signal.fillerHits) ?? undefined,
    };
  });
  return parsed;
}

function orderCandidatesWithNarrativePhases(
  candidates: ScoredVideoCandidate[],
  options: AutoEditOptions,
  targetDurationSeconds: number,
  presetConfig: PresetConfig,
  input: AutoEditInput,
  beatByClipId: Record<string, BeatInfo>
): ScoredVideoCandidate[] {
  if (candidates.length <= 1) {
    return candidates;
  }

  const candidateById = new Map(candidates.map((candidate) => [candidate.clip.id, candidate]));
  const serverRankedIds = Array.isArray(input.serverRanking?.rankedClipIds)
    ? input.serverRanking?.rankedClipIds.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const scoreSortedIds = candidates.map((candidate) => candidate.clip.id);
  const rankedIds: string[] = [];
  const rankedSeen = new Set<string>();
  [...serverRankedIds, ...scoreSortedIds].forEach((clipId) => {
    if (!candidateById.has(clipId) || rankedSeen.has(clipId)) {
      return;
    }
    rankedSeen.add(clipId);
    rankedIds.push(clipId);
  });

  if (Object.keys(beatByClipId).length === 0) {
    return rankedIds
      .map((clipId) => candidateById.get(clipId))
      .filter((candidate): candidate is ScoredVideoCandidate => Boolean(candidate));
  }

  const phasePlan = PRESET_PHASE_PLAN[options.preset] || PRESET_PHASE_PLAN['story-60'];
  const approximateClipCount = clampNumber(
    Math.round(targetDurationSeconds / Math.max(0.5, presetConfig.idealClipDuration)),
    2,
    Math.max(2, candidates.length)
  );

  const initialCounts = phasePlan.map((phase) => {
    const rawCount = phase.ratio * approximateClipCount;
    return {
      phase,
      count: Math.floor(rawCount),
      remainder: rawCount - Math.floor(rawCount),
    };
  });
  let countSum = initialCounts.reduce((sum, item) => sum + item.count, 0);
  if (countSum < approximateClipCount) {
    const byRemainder = [...initialCounts].sort((left, right) => right.remainder - left.remainder);
    for (let index = 0; index < byRemainder.length && countSum < approximateClipCount; index += 1) {
      byRemainder[index].count += 1;
      countSum += 1;
    }
  }
  if (initialCounts[0]) {
    initialCounts[0].count = Math.max(1, initialCounts[0].count);
  }
  if (initialCounts[initialCounts.length - 1]) {
    initialCounts[initialCounts.length - 1].count = Math.max(1, initialCounts[initialCounts.length - 1].count);
  }

  const remaining = new Set(rankedIds);
  const phasedIds: string[] = [];
  initialCounts.forEach(({ phase, count }) => {
    if (count <= 0) {
      return;
    }
    const accepted = PHASE_ACCEPTED_BEATS[phase.beat] || [phase.beat];
    const eligible = rankedIds.filter((clipId) => {
      if (!remaining.has(clipId)) {
        return false;
      }
      const beat = beatByClipId[clipId]?.beat;
      if (!beat) {
        return false;
      }
      return accepted.includes(beat);
    });
    eligible.slice(0, count).forEach((clipId) => {
      phasedIds.push(clipId);
      remaining.delete(clipId);
    });
  });

  const finalIds = [...phasedIds, ...rankedIds.filter((clipId) => remaining.has(clipId))];
  const hookClipId = finalIds.find((clipId) => beatByClipId[clipId]?.beat === 'hook');
  if (hookClipId && finalIds[0] !== hookClipId) {
    const index = finalIds.indexOf(hookClipId);
    finalIds.splice(index, 1);
    finalIds.unshift(hookClipId);
  }
  const resolutionClipId = [...finalIds].reverse().find((clipId) => beatByClipId[clipId]?.beat === 'resolution');
  if (resolutionClipId && finalIds[finalIds.length - 1] !== resolutionClipId) {
    const index = finalIds.indexOf(resolutionClipId);
    finalIds.splice(index, 1);
    finalIds.push(resolutionClipId);
  }

  return finalIds
    .map((clipId) => candidateById.get(clipId))
    .filter((candidate): candidate is ScoredVideoCandidate => Boolean(candidate));
}

function buildVariantOptions(base: AutoEditOptions, variant: AutoEditVariant): AutoEditOptions {
  if (variant === 'safe') {
    return {
      ...base,
      variant,
      transitionDensity: clampNumber(base.transitionDensity * 0.45, 0, 1),
      includePolish: base.includePolish,
      enableJCutLCut: false,
      minShotDurationSeconds: clampNumber(base.minShotDurationSeconds * 1.2, 0.3, 20),
      maxShotDurationSeconds: clampNumber(base.maxShotDurationSeconds * 1.2, 1, 45),
      maxConsecutiveByCamera: Math.max(1, base.maxConsecutiveByCamera + 1),
      maxConsecutiveBySpeaker: Math.max(1, base.maxConsecutiveBySpeaker + 1),
      enforceNoOverlap: true,
    };
  }
  if (variant === 'bold') {
    return {
      ...base,
      variant,
      transitionDensity: clampNumber(base.transitionDensity + 0.2, 0, 1),
      includePolish: true,
      enableJCutLCut: true,
      cleanupFillerPauses: true,
      minShotDurationSeconds: clampNumber(base.minShotDurationSeconds * 0.75, 0.2, 20),
      maxShotDurationSeconds: clampNumber(base.maxShotDurationSeconds * 0.85, 0.8, 40),
      maxConsecutiveByCamera: Math.max(1, Math.min(2, base.maxConsecutiveByCamera)),
      maxConsecutiveBySpeaker: Math.max(1, Math.min(2, base.maxConsecutiveBySpeaker)),
      enforceNoOverlap: false,
    };
  }
  return {
    ...base,
    variant: 'balanced',
  };
}

export function getDefaultAutoEditOptions(preset: AutoEditPreset = 'story-60'): AutoEditOptions {
  const config = PRESET_CONFIG[preset];
  return {
    preset,
    targetDurationSeconds: config.duration,
    includeAssemble: true,
    includePolish: true,
    addMarkers: true,
    addAudioBed: true,
    transitionDensity: 0.65,

    variant: 'balanced',
    intentProfileId: 'balanced-story',

    enforceNoOverlap: false,
    minShotDurationSeconds: config.minClipDuration,
    maxShotDurationSeconds: config.maxClipDuration,
    maxConsecutiveByCamera: 2,
    maxConsecutiveBySpeaker: 2,

    enableDucking: true,
    duckingAmountDb: -8,
    enableJCutLCut: true,
    cleanupFillerPauses: true,
    qualityGuardMinConfidence: 0.58,
  };
}

function buildCutTransitionsAndOverlaps(
  clips: BeatClip[],
  frameRate: number,
  density: number,
  defaultTransitionDuration: number,
  allowOverlapTransitions: boolean
): { clips: BeatClip[]; transitions: AutoEditTransition[] } {
  if (clips.length < 2) {
    return { clips, transitions: [] };
  }

  const safeDensity = clampNumber(density, 0, 1);
  const spacing = safeDensity <= 0.05 ? Number.POSITIVE_INFINITY : Math.max(1, Math.round(1 / safeDensity));
  const transitionClips = clips.map((clip) => cloneClip(clip));
  const transitions: AutoEditTransition[] = [];

  for (let index = 1; index < transitionClips.length; index += 1) {
    if (!Number.isFinite(spacing) || index % spacing !== 0) {
      continue;
    }

    const left = transitionClips[index - 1];
    const right = transitionClips[index];
    const rawDuration = Math.min(defaultTransitionDuration, left.duration * 0.22, right.duration * 0.22);
    const transitionDuration = snapToFrame(clampNumber(rawDuration, 0.08, 0.55), frameRate);

    if (allowOverlapTransitions) {
      const nextRightStart = snapToFrame(
        Math.max(left.start + 1 / frameRate, right.start - transitionDuration),
        frameRate
      );
      right.start = nextRightStart;
    }

    const cutTime = snapToFrame(left.start + left.duration, frameRate);
    const transitionId = `auto-tr-${left.id}-${right.id}-${index}`;

    const leftMetadata = isRecord(left.metadata) ? { ...left.metadata } : {};
    const leftTransitions = isRecord(leftMetadata.transitions) ? { ...leftMetadata.transitions } : {};
    leftTransitions.out = {
      type: allowOverlapTransitions ? 'crossfade' : 'fade-out',
      duration: transitionDuration,
      layer: 'video',
      edge: 'out',
      sourceClipId: left.id,
      targetClipId: right.id,
      source: 'auto-edit',
    };
    leftMetadata.transitions = leftTransitions;
    left.metadata = leftMetadata;

    const rightMetadata = isRecord(right.metadata) ? { ...right.metadata } : {};
    const rightTransitions = isRecord(rightMetadata.transitions) ? { ...rightMetadata.transitions } : {};
    rightTransitions.in = {
      type: allowOverlapTransitions ? 'crossfade' : 'fade-in',
      duration: transitionDuration,
      layer: 'video',
      edge: 'in',
      sourceClipId: left.id,
      targetClipId: right.id,
      source: 'auto-edit',
    };
    rightMetadata.transitions = rightTransitions;
    right.metadata = rightMetadata;

    transitions.push({
      id: transitionId,
      time: cutTime,
      trackId: left.trackId,
      type: allowOverlapTransitions ? 'crossfade' : 'fade',
      duration: transitionDuration,
      clipId: left.id,
      linkedClipId: right.id,
      edge: 'out',
      layer: 'video',
      engine: 'canvas2d',
    });
  }

  return {
    clips: transitionClips,
    transitions,
  };
}

function wouldViolateRepetitionCap(
  selected: BeatClip[],
  candidate: BeatClip,
  options: AutoEditOptions
): boolean {
  if (selected.length === 0) {
    return false;
  }
  const candidateCamera = resolveCameraTag(candidate);
  const candidateSpeaker = resolveSpeakerTag(candidate);

  if (candidateCamera && options.maxConsecutiveByCamera > 0) {
    let cameraStreak = 0;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      const selectedCamera = resolveCameraTag(selected[index]);
      if (selectedCamera && selectedCamera === candidateCamera) {
        cameraStreak += 1;
      } else {
        break;
      }
    }
    if (cameraStreak >= options.maxConsecutiveByCamera) {
      return true;
    }
  }

  if (candidateSpeaker && options.maxConsecutiveBySpeaker > 0) {
    let speakerStreak = 0;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      const selectedSpeaker = resolveSpeakerTag(selected[index]);
      if (selectedSpeaker && selectedSpeaker === candidateSpeaker) {
        speakerStreak += 1;
      } else {
        break;
      }
    }
    if (speakerStreak >= options.maxConsecutiveBySpeaker) {
      return true;
    }
  }

  return false;
}

function buildExplainability(
  sourceClip: BeatClip,
  score: number,
  beatInfo: BeatInfo | null,
  clipSignal: AutoEditClipSignal | null,
  feedback: AutoEditFeedbackValue | undefined
): AutoEditClipExplainability {
  const faceConfidence = clampNumber(
    readNumber(isRecord(sourceClip.metadata?.faceDetection) ? sourceClip.metadata?.faceDetection?.confidence : null) ??
      0,
    0,
    1
  );
  const audioConfidence = clampNumber(
    readNumber(sourceClip.metadata?.syncConfidence) ?? readNumber(sourceClip.metadata?.audioConfidence) ?? 0,
    0,
    1
  );
  const ev = Number.isFinite(sourceClip.ev) ? clampNumber((sourceClip.ev + 1) / 2, 0, 1) : 0.5;
  const moodBoost = (sourceClip.tags || []).some((tag) => /emotion|reaction|romance|love|joy/i.test(tag)) ? 0.1 : 0;
  const emotion = clampNumber(ev * 0.85 + moodBoost, 0, 1);

  const goalMatchBase =
    (clipSignal?.goalHits || 0) * 0.18 +
    (clipSignal?.culturalHits || 0) * 0.16 +
    (clipSignal?.beatHits || 0) * 0.12 +
    (clipSignal?.markerHits || 0) * 0.08 +
    (clipSignal?.narrativeConnectorHits || 0) * 0.07 +
    (clipSignal?.impactPhraseHits || 0) * 0.1 +
    (clipSignal?.transcriptCoverage || 0) * 0.24;
  const goalPenalty =
    (clipSignal?.avoidHits || 0) * 0.22 +
    (clipSignal?.forbiddenHits || 0) * 0.28 +
    (clipSignal?.fillerHits || 0) * 0.08;
  const goalMatch = clampNumber(goalMatchBase - goalPenalty + 0.25, 0, 1);
  const transcriptCoverage = clampNumber(clipSignal?.transcriptCoverage || 0, 0, 1);
  const connectorHits = Math.max(0, Math.round(clipSignal?.narrativeConnectorHits || 0));
  const impactPhraseHits = Math.max(0, Math.round(clipSignal?.impactPhraseHits || 0));
  const fillerHits = Math.max(0, Math.round(clipSignal?.fillerHits || 0));
  const transcriptExcerpt = buildTranscriptExcerpt(sourceClip);
  const metadata = isRecord(sourceClip.metadata) ? sourceClip.metadata : {};
  const requiresExternalBroll = metadata.requiresExternalBroll === true;
  const externalBrollSuggestions = Array.isArray(metadata.externalBrollSuggestions)
    ? metadata.externalBrollSuggestions
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .slice(0, 8)
    : [];
  const fallbackMessage = readString(metadata.fallbackMessage);

  const reasons: string[] = [];
  if (goalMatch >= 0.62) {
    reasons.push('Strong goal/context match.');
  }
  if (emotion >= 0.62) {
    reasons.push('Strong emotional signal.');
  }
  if (beatInfo) {
    reasons.push(`Narrative beat: ${beatInfo.beat} (${Math.round(beatInfo.confidence * 100)}%).`);
  }
  if (faceConfidence >= 0.6) {
    reasons.push('High face-confidence shot.');
  }
  if (audioConfidence >= 0.6) {
    reasons.push('Reliable sync/audio confidence.');
  }
  if (impactPhraseHits > 0) {
    reasons.push(
      impactPhraseHits === 1
        ? 'Impactful phrase detected in transcript.'
        : `Impactful phrases detected in transcript (${impactPhraseHits}).`
    );
  }
  if (connectorHits > 0) {
    reasons.push(
      connectorHits === 1
        ? 'Narrative connector detected.'
        : `Narrative connectors detected (${connectorHits}).`
    );
  }
  if (transcriptCoverage >= 0.55) {
    reasons.push('Strong transcript coverage for this shot window.');
  }
  if (fillerHits > 0) {
    reasons.push(
      fillerHits === 1
        ? 'Contains filler speech and receives a quality guard penalty.'
        : `Contains filler speech (${fillerHits}) and receives a quality guard penalty.`
    );
  }
  if (feedback === 'approved') {
    reasons.push('Boosted by prior human approval.');
  }
  if (feedback === 'rejected') {
    reasons.push('Penalized by prior human rejection.');
  }
  if (requiresExternalBroll) {
    reasons.push('No suitable internal B-roll found; contextual external B-roll suggestions are available.');
  }
  if (reasons.length === 0) {
    reasons.push('Selected by weighted quality and pacing constraints.');
  }

  return {
    clipId: sourceClip.id,
    score: Number(score.toFixed(3)),
    goalMatch: Number(goalMatch.toFixed(3)),
    emotion: Number(emotion.toFixed(3)),
    beat: beatInfo
      ? {
          beat: beatInfo.beat,
          confidence: Number(beatInfo.confidence.toFixed(3)),
          reason: beatInfo.reason,
          source: beatInfo.source || 'server',
        }
      : null,
    faceConfidence: Number(faceConfidence.toFixed(3)),
    audioConfidence: Number(audioConfidence.toFixed(3)),
    narrative: {
      transcriptCoverage: Number(transcriptCoverage.toFixed(3)),
      connectorHits,
      impactPhraseHits,
      fillerHits,
      transcriptExcerpt,
    },
    cameraTag: resolveCameraTag(sourceClip),
    speakerTag: resolveSpeakerTag(sourceClip),
    feedback: feedback || null,
    requiresExternalBroll,
    externalBrollSuggestions,
    fallbackMessage,
    reasons,
  };
}

function applyAudioNarrativeMetadata(
  clips: BeatClip[],
  transitions: AutoEditTransition[],
  options: AutoEditOptions,
  frameRate: number
): { clips: BeatClip[]; transitions: AutoEditTransition[] } {
  const nextClips = clips.map((clip) => cloneClip(clip));
  const nextTransitions = transitions.map((transition) => cloneTransition(transition));

  if (options.enableDucking) {
    nextClips.forEach((clip) => {
      if (!isRecord(clip.metadata)) {
        clip.metadata = {};
      }
      (clip.metadata as Record<string, unknown>).autoEditDucking = {
        enabled: true,
        amountDb: options.duckingAmountDb,
        attack: 0.1,
        release: 0.35,
        threshold: -36,
        source: 'auto-edit',
      };
    });
  }

  if (options.enableJCutLCut) {
    const sortedVideoClips = nextClips
      .filter((clip) => {
        const metadata = isRecord(clip.metadata) ? clip.metadata : null;
        return metadata?.autoEditAudioBed !== true;
      })
      .sort((left, right) => left.start - right.start);

    for (let index = 1; index < sortedVideoClips.length; index += 1) {
      const left = sortedVideoClips[index - 1];
      const right = sortedVideoClips[index];
      const leftMeta = isRecord(left.metadata) ? left.metadata : {};
      const rightMeta = isRecord(right.metadata) ? right.metadata : {};
      const jCutDuration = snapToFrame(clampNumber(Math.min(0.18, right.duration * 0.08), 0.04, 0.2), frameRate);
      const lCutDuration = snapToFrame(clampNumber(Math.min(0.2, left.duration * 0.1), 0.04, 0.24), frameRate);

      left.metadata = {
        ...leftMeta,
        autoEditLCut: {
          duration: lCutDuration,
          sourceClipId: left.id,
          targetClipId: right.id,
          source: 'auto-edit',
        },
      };

      right.metadata = {
        ...rightMeta,
        autoEditJCut: {
          duration: jCutDuration,
          sourceClipId: left.id,
          targetClipId: right.id,
          source: 'auto-edit',
        },
      };

      nextTransitions.push({
        id: `auto-audio-jl-${left.id}-${right.id}-${index}`,
        time: snapToFrame(right.start, frameRate),
        trackId: right.trackId,
        type: 'audio_jl_cut',
        duration: snapToFrame(jCutDuration + lCutDuration, frameRate),
        clipId: left.id,
        linkedClipId: right.id,
        edge: 'out',
        layer: 'audio',
        engine: 'audio',
      });
    }
  }

  return {
    clips: nextClips,
    transitions: nextTransitions,
  };
}

function enforceClipConstraints(
  clips: BeatClip[],
  options: AutoEditOptions,
  frameRate: number,
  issues: string[]
): BeatClip[] {
  const nextClips = clips
    .map((clip) => cloneClip(clip))
    .sort((left, right) => left.start - right.start);

  const minDuration = clampNumber(options.minShotDurationSeconds, 0.2, 30);
  const maxDuration = clampNumber(options.maxShotDurationSeconds, minDuration + 0.05, 60);

  for (const clip of nextClips) {
    const normalized = clampNumber(clip.duration, minDuration, maxDuration);
    const snapped = Math.max(1 / frameRate, snapToFrame(normalized, frameRate));
    if (Math.abs(snapped - clip.duration) > 0.0001) {
      issues.push(`Adjusted clip ${clip.id} duration to ${snapped.toFixed(2)}s due to hard constraints.`);
      clip.duration = snapped;
    }
  }

  if (!options.enforceNoOverlap) {
    return nextClips;
  }

  let previousEnd = 0;
  for (const clip of nextClips) {
    if (clip.start < previousEnd) {
      issues.push(`Shifted clip ${clip.id} start to remove overlap.`);
      clip.start = snapToFrame(previousEnd, frameRate);
    }
    previousEnd = clip.start + clip.duration;
  }

  return nextClips;
}

function resolveNarrativeBeatFromClip(clip: BeatClip): AutoEditNarrativeBeat | null {
  const metadata = isRecord(clip.metadata) ? clip.metadata : null;
  const autoEdit = metadata && isRecord(metadata.autoEdit) ? metadata.autoEdit : null;
  const rawBeat = readString(autoEdit?.beat);
  if (
    rawBeat === 'hook' ||
    rawBeat === 'build' ||
    rawBeat === 'climax' ||
    rawBeat === 'resolution' ||
    rawBeat === 'bridge'
  ) {
    return rawBeat;
  }

  const tags = Array.isArray(clip.tags) ? clip.tags : [];
  for (const tag of tags) {
    const normalized = String(tag).toLowerCase();
    if (normalized.includes('hook') || normalized.includes('intro') || normalized.includes('opening')) {
      return 'hook';
    }
    if (normalized.includes('build') || normalized.includes('bridge')) {
      return 'build';
    }
    if (normalized.includes('climax') || normalized.includes('peak')) {
      return 'climax';
    }
    if (normalized.includes('resolution') || normalized.includes('ending') || normalized.includes('outro')) {
      return 'resolution';
    }
  }

  return null;
}

function readClipSourceIdentifier(clip: BeatClip): string | null {
  const fromSourceFile = readString(clip.sourceFile);
  if (fromSourceFile) {
    return fromSourceFile;
  }
  const metadata = isRecord(clip.metadata) ? clip.metadata : null;
  const fromMetadata = readString(metadata?.sourceFile) || readString(metadata?.sourcePath);
  if (fromMetadata) {
    return fromMetadata;
  }
  return null;
}

function clipHasExplainability(clip: BeatClip, proposal: AutoEditProposal): boolean {
  if (proposal.clipExplainabilityById[clip.id]) {
    return true;
  }
  const metadata = isRecord(clip.metadata) ? clip.metadata : null;
  const autoEdit = metadata && isRecord(metadata.autoEdit) ? metadata.autoEdit : null;
  return Boolean(autoEdit && isRecord(autoEdit.explainability));
}

export function createStoryValidationReport(
  input: AutoEditInput,
  proposal: AutoEditProposal
): AutoEditStoryValidationReport {
  const trackIdSet = new Set(input.tracks.map((track) => track.id));
  const issues: AutoEditValidationIssue[] = [];
  const tolerance = 1 / 120;

  const outputClips = proposal.clips.map((clip) => cloneClip(clip));
  const outputVideoClips = outputClips
    .filter((clip) => !isAudioTrackId(clip.trackId, input.tracks) && !String(clip.id).endsWith('-auto-bed'))
    .sort((left, right) => left.start - right.start);
  const outputAudioClips = outputClips.filter((clip) => isAudioTrackId(clip.trackId, input.tracks));

  let negativeDurationCount = 0;
  let trackBoundsIssueCount = 0;
  let invalidOffsetCount = 0;
  let overlapCount = 0;

  outputClips.forEach((clip) => {
    if (!Number.isFinite(clip.duration) || clip.duration <= 0) {
      negativeDurationCount += 1;
      issues.push({
        code: 'negative_duration',
        severity: 'error',
        clipId: clip.id,
        trackId: clip.trackId,
        message: `Clip ${clip.id} has invalid duration (${clip.duration}).`,
      });
    }

    if (!Number.isFinite(clip.start) || clip.start < -tolerance) {
      invalidOffsetCount += 1;
      issues.push({
        code: 'invalid_offset',
        severity: 'error',
        clipId: clip.id,
        trackId: clip.trackId,
        message: `Clip ${clip.id} has invalid start offset (${clip.start}).`,
      });
    }

    if (!trackIdSet.has(clip.trackId)) {
      trackBoundsIssueCount += 1;
      issues.push({
        code: 'track_bounds',
        severity: 'error',
        clipId: clip.id,
        trackId: clip.trackId,
        message: `Clip ${clip.id} references unknown track ${clip.trackId}.`,
      });
    }

    const metadata = isRecord(clip.metadata) ? clip.metadata : null;
    const inPoint = readNumber(metadata?.inPoint);
    const outPoint = readNumber(metadata?.outPoint);
    const autoEdit = metadata && isRecord(metadata.autoEdit) ? metadata.autoEdit : null;
    const sourceStart = readNumber(autoEdit?.sourceStart);
    const sourceOffset =
      readNumber(metadata?.sourceOffset) ??
      readNumber(metadata?.syncOffset) ??
      readNumber(metadata?.audioOffset) ??
      readNumber(metadata?.offset);

    if ((inPoint !== null && inPoint < -tolerance) || (outPoint !== null && outPoint < -tolerance)) {
      invalidOffsetCount += 1;
      issues.push({
        code: 'invalid_offset',
        severity: 'error',
        clipId: clip.id,
        trackId: clip.trackId,
        message: `Clip ${clip.id} has negative in/out offsets.`,
      });
    }

    if (inPoint !== null && outPoint !== null && outPoint + tolerance < inPoint) {
      invalidOffsetCount += 1;
      issues.push({
        code: 'invalid_offset',
        severity: 'error',
        clipId: clip.id,
        trackId: clip.trackId,
        message: `Clip ${clip.id} has outPoint before inPoint.`,
      });
    }

    if (sourceStart !== null && sourceStart < -tolerance) {
      invalidOffsetCount += 1;
      issues.push({
        code: 'invalid_offset',
        severity: 'error',
        clipId: clip.id,
        trackId: clip.trackId,
        message: `Clip ${clip.id} has invalid sourceStart (${sourceStart}).`,
      });
    }

    if (sourceOffset !== null && Math.abs(sourceOffset) > 24 * 3600) {
      invalidOffsetCount += 1;
      issues.push({
        code: 'invalid_offset',
        severity: 'warning',
        clipId: clip.id,
        trackId: clip.trackId,
        message: `Clip ${clip.id} has unrealistic source offset (${sourceOffset}).`,
      });
    }
  });

  const clipsByTrack = new Map<string, BeatClip[]>();
  outputVideoClips.forEach((clip) => {
    const list = clipsByTrack.get(clip.trackId) || [];
    list.push(clip);
    clipsByTrack.set(clip.trackId, list);
  });

  clipsByTrack.forEach((clipsOnTrack, trackId) => {
    const sorted = [...clipsOnTrack].sort((left, right) => left.start - right.start);
    let previous: BeatClip | null = null;
    for (const current of sorted) {
      if (!previous) {
        previous = current;
        continue;
      }
      const previousEnd = previous.start + previous.duration;
      if (current.start + tolerance < previousEnd) {
        overlapCount += 1;
        issues.push({
          code: 'clip_overlap',
          severity: 'error',
          clipId: current.id,
          trackId,
          message: `Clip ${current.id} overlaps previous clip ${previous.id} on ${trackId}.`,
        });
      }
      if (current.start + current.duration > previousEnd) {
        previous = current;
      }
    }
  });

  const beatCoverage = {
    hook: false,
    build: false,
    climax: false,
    resolution: false,
  };

  outputVideoClips.forEach((clip) => {
    const beat = resolveNarrativeBeatFromClip(clip);
    if (beat === 'hook') {
      beatCoverage.hook = true;
    }
    if (beat === 'build' || beat === 'bridge') {
      beatCoverage.build = true;
    }
    if (beat === 'climax') {
      beatCoverage.climax = true;
    }
    if (beat === 'resolution') {
      beatCoverage.resolution = true;
    }
  });

  const narrativePass = beatCoverage.hook && beatCoverage.climax && beatCoverage.resolution;
  if (!beatCoverage.hook) {
    issues.push({
      code: 'missing_narrative_beat',
      severity: 'warning',
      message: 'Narrative validation missing hook beat.',
    });
  }
  if (!beatCoverage.climax) {
    issues.push({
      code: 'missing_narrative_beat',
      severity: 'warning',
      message: 'Narrative validation missing climax beat.',
    });
  }
  if (!beatCoverage.resolution) {
    issues.push({
      code: 'missing_narrative_beat',
      severity: 'warning',
      message: 'Narrative validation missing resolution beat.',
    });
  }

  const allSourceCandidates = new Set(
    input.clips
      .filter((clip) => !isAudioTrackId(clip.trackId, input.tracks))
      .map((clip) => readClipSourceIdentifier(clip))
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  );
  const selectedSources = new Set(
    outputVideoClips
      .map((clip) => readClipSourceIdentifier(clip))
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  );

  const sourceCoverageRatio =
    allSourceCandidates.size > 0
      ? clampNumber(selectedSources.size / allSourceCandidates.size, 0, 1)
      : 1;
  const coverageThreshold = allSourceCandidates.size <= 3 ? 1 : 0.6;
  const coveragePass = sourceCoverageRatio >= coverageThreshold;

  if (!coveragePass) {
    issues.push({
      code: 'source_coverage',
      severity: 'warning',
      message: `Source coverage too low (${(sourceCoverageRatio * 100).toFixed(0)}%).`,
    });
  }

  const explainableCount = outputVideoClips.filter((clip) => clipHasExplainability(clip, proposal)).length;
  const explainabilityCoverageRatio =
    outputVideoClips.length > 0
      ? clampNumber(explainableCount / outputVideoClips.length, 0, 1)
      : 1;
  if (explainabilityCoverageRatio < 0.8) {
    issues.push({
      code: 'low_explainability_coverage',
      severity: 'warning',
      message: `Explainability coverage is ${(explainabilityCoverageRatio * 100).toFixed(0)}%.`,
    });
  }

  const durationDeltaSeconds = Math.abs(proposal.estimatedDurationSeconds - proposal.targetDurationSeconds);
  const hardConstraintPass =
    overlapCount === 0 &&
    trackBoundsIssueCount === 0 &&
    negativeDurationCount === 0 &&
    invalidOffsetCount === 0;

  let score = 100;
  score -= overlapCount * 12;
  score -= trackBoundsIssueCount * 10;
  score -= negativeDurationCount * 14;
  score -= invalidOffsetCount * 8;
  score -= beatCoverage.hook ? 0 : 8;
  score -= beatCoverage.climax ? 0 : 8;
  score -= beatCoverage.resolution ? 0 : 8;
  score -= Math.round((1 - sourceCoverageRatio) * 20);
  score -= Math.round(Math.max(0, 0.8 - explainabilityCoverageRatio) * 15);
  const softDurationWindow = Math.max(0.6, proposal.targetDurationSeconds * 0.05);
  score -= Math.round(Math.max(0, durationDeltaSeconds - softDurationWindow) * 2.5);
  score = clampNumber(score, 0, 100);

  const pass = hardConstraintPass && narrativePass && coveragePass;
  const summary = [
    hardConstraintPass
      ? 'Hard constraints pass (no overlap, no invalid track refs, no negative duration, valid offsets).'
      : `Hard constraints failed with ${overlapCount + trackBoundsIssueCount + negativeDurationCount + invalidOffsetCount} issue(s).`,
    `Narrative beats hook=${beatCoverage.hook ? 'yes' : 'no'}, climax=${beatCoverage.climax ? 'yes' : 'no'}, resolution=${beatCoverage.resolution ? 'yes' : 'no'}.`,
    `Source coverage ${(sourceCoverageRatio * 100).toFixed(0)}% (${selectedSources.size}/${Math.max(allSourceCandidates.size, 1)} unique sources).`,
    `Explainability coverage ${(explainabilityCoverageRatio * 100).toFixed(0)}% (${explainableCount}/${Math.max(outputVideoClips.length, 1)} clips).`,
    `Target ${proposal.targetDurationSeconds.toFixed(2)}s vs result ${proposal.estimatedDurationSeconds.toFixed(2)}s (delta ${durationDeltaSeconds.toFixed(2)}s).`,
  ];

  return {
    generatedAt: new Date().toISOString(),
    pass,
    score: Number(score.toFixed(2)),
    hardConstraintPass,
    narrativePass,
    coveragePass,
    metrics: {
      targetDurationSeconds: Number(proposal.targetDurationSeconds.toFixed(3)),
      estimatedDurationSeconds: Number(proposal.estimatedDurationSeconds.toFixed(3)),
      durationDeltaSeconds: Number(durationDeltaSeconds.toFixed(3)),
      outputClipCount: outputClips.length,
      outputVideoClipCount: outputVideoClips.length,
      outputAudioClipCount: outputAudioClips.length,
      uniqueSourceCount: selectedSources.size,
      sourceCoverageRatio: Number(sourceCoverageRatio.toFixed(4)),
      overlapCount,
      trackBoundsIssueCount,
      negativeDurationCount,
      invalidOffsetCount,
      explainabilityCoverageRatio: Number(explainabilityCoverageRatio.toFixed(4)),
      beatCoverage,
    },
    issues,
    summary,
  };
}

function makeProposalId(options: AutoEditOptions): string {
  const now = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 9);
  return `auto-${options.preset}-${options.variant}-${now}-${random}`;
}

export function createAutoEditProposal(
  input: AutoEditInput,
  options: AutoEditOptions
): AutoEditProposal {
  const frameRate = Math.max(1, Math.round(options.targetDurationSeconds > 0 ? (input.frameRate || 25) : 25));
  const presetConfig = PRESET_CONFIG[options.preset] || PRESET_CONFIG['story-60'];
  const targetDurationSeconds = options.targetDurationSeconds > 0
    ? options.targetDurationSeconds
    : presetConfig.duration;

  const sourceClips = input.clips.map((clip) => cloneClip(clip));
  const sourceMarkers = (input.markers || []).map((marker) => cloneMarker(marker));
  const sourceTransitions = (input.transitions || []).map((transition) => cloneTransition(transition));
  const serverBeatByClipId = getBeatByClipId(input);
  const clipSignalsById = getSignalByClipId(input);
  const feedbackByClipId = input.humanFeedbackByClipId || {};

  if (sourceClips.length === 0) {
    const emptyProposal: AutoEditProposal = {
      proposalId: makeProposalId(options),
      variant: options.variant,
      clips: [],
      transitions: [],
      markers: [],
      preset: options.preset,
      targetDurationSeconds,
      estimatedDurationSeconds: 0,
      confidence: 0,
      summary: ['No clips available for auto edit.'],
      selectedClipIds: [],
      clipExplainabilityById: {},
      constraintIssues: [],
      storyValidationReport: {
        generatedAt: new Date().toISOString(),
        pass: false,
        score: 0,
        hardConstraintPass: true,
        narrativePass: false,
        coveragePass: false,
        metrics: {
          targetDurationSeconds: Number(targetDurationSeconds.toFixed(3)),
          estimatedDurationSeconds: 0,
          durationDeltaSeconds: Number(targetDurationSeconds.toFixed(3)),
          outputClipCount: 0,
          outputVideoClipCount: 0,
          outputAudioClipCount: 0,
          uniqueSourceCount: 0,
          sourceCoverageRatio: 0,
          overlapCount: 0,
          trackBoundsIssueCount: 0,
          negativeDurationCount: 0,
          invalidOffsetCount: 0,
          explainabilityCoverageRatio: 0,
          beatCoverage: {
            hook: false,
            build: false,
            climax: false,
            resolution: false,
          },
        },
        issues: [
          {
            code: 'source_coverage',
            severity: 'warning',
            message: 'No clips available to validate story.',
          },
        ],
        summary: ['No clips available for auto edit.'],
      },
    };
    emptyProposal.storyValidationReport = createStoryValidationReport(input, emptyProposal);
    emptyProposal.summary = [...emptyProposal.summary, ...emptyProposal.storyValidationReport.summary];
    return emptyProposal;
  }

  const primaryVideoTrackId = resolvePrimaryVideoTrackId(input.tracks, sourceClips);
  const primaryAudioTrackId = resolvePrimaryAudioTrackId(input.tracks, sourceClips);

  const scoredVideoCandidates = sourceClips
    .filter((clip) => !isAudioTrackId(clip.trackId, input.tracks))
    .map((clip) => ({
      clip,
      score: scoreClip(
        clip,
        presetConfig,
        options,
        input.serverRanking?.clipScores?.[clip.id],
        feedbackByClipId[clip.id]
      ),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.clip.start - right.clip.start;
    });

  const orderedVideoCandidates = orderCandidatesWithNarrativePhases(
    scoredVideoCandidates,
    options,
    targetDurationSeconds,
    presetConfig,
    input,
    serverBeatByClipId
  );

  const assembledClips: BeatClip[] = [];
  const explainabilityById: Record<string, AutoEditClipExplainability> = {};
  const remainingCandidates = [...orderedVideoCandidates];
  let cursor = 0;

  while (remainingCandidates.length > 0) {
    if (cursor >= targetDurationSeconds + options.minShotDurationSeconds) {
      break;
    }

    let selectedCandidateIndex = remainingCandidates.findIndex((candidate) => {
      return !wouldViolateRepetitionCap(assembledClips, candidate.clip, options);
    });

    if (selectedCandidateIndex < 0) {
      selectedCandidateIndex = 0;
    }

    const [candidate] = remainingCandidates.splice(selectedCandidateIndex, 1);
    if (!candidate) {
      break;
    }

    const sourceClip = candidate.clip;
    const targetDuration = resolveTargetClipDuration(sourceClip.duration, presetConfig, options, frameRate);
    if (targetDuration < 1 / frameRate) {
      continue;
    }

    const clippedDuration = Math.min(targetDuration, Math.max(1 / frameRate, targetDurationSeconds - cursor));
    if (clippedDuration <= 0) {
      continue;
    }

    const feedback = feedbackByClipId[sourceClip.id];
    const explainability = buildExplainability(
      sourceClip,
      candidate.score,
      serverBeatByClipId[sourceClip.id] || null,
      clipSignalsById[sourceClip.id] || null,
      feedback
    );
    explainabilityById[sourceClip.id] = explainability;

    const assembledClip = withAutoEditMetadata(
      {
        ...sourceClip,
        start: snapToFrame(cursor, frameRate),
        duration: snapToFrame(clippedDuration, frameRate),
        trackId: primaryVideoTrackId,
      },
      options,
      candidate.score,
      sourceClip.start,
      sourceClip.trackId,
      explainability
    );

    const beatPayload = serverBeatByClipId[sourceClip.id];
    if (beatPayload && isRecord(assembledClip.metadata)) {
      assembledClip.metadata.autoEdit = {
        ...(isRecord(assembledClip.metadata.autoEdit) ? assembledClip.metadata.autoEdit : {}),
        beat: beatPayload.beat,
        beatConfidence: Number(beatPayload.confidence.toFixed(3)),
        beatSource: beatPayload.source || 'server',
        beatReason: beatPayload.reason,
      };
    }

    if (options.cleanupFillerPauses) {
      const fillerRatio = estimateFillerRatio(sourceClip);
      const qualityGuard = Math.max(
        explainability.audioConfidence,
        beatPayload?.confidence || 0
      );
      if (fillerRatio > 0.04 && qualityGuard >= options.qualityGuardMinConfidence && assembledClip.duration > 1.2) {
        const trim = snapToFrame(clampNumber(fillerRatio * 0.8, 0.06, 0.28), frameRate);
        assembledClip.start = snapToFrame(assembledClip.start + trim, frameRate);
        assembledClip.duration = snapToFrame(Math.max(0.6, assembledClip.duration - trim), frameRate);
        if (isRecord(assembledClip.metadata)) {
          assembledClip.metadata.autoEdit = {
            ...(isRecord(assembledClip.metadata.autoEdit) ? assembledClip.metadata.autoEdit : {}),
            fillerCleanupApplied: true,
            fillerTrim: trim,
          };
        }
      }
    }

    assembledClips.push(assembledClip);
    cursor = snapToFrame(cursor + assembledClip.duration, frameRate);
  }

  if (assembledClips.length === 0) {
    const fallback = sourceClips[0];
    assembledClips.push({
      ...cloneClip(fallback),
      start: 0,
      duration: snapToFrame(
        Math.min(Math.max(fallback.duration, presetConfig.minClipDuration), targetDurationSeconds),
        frameRate
      ),
      trackId: primaryVideoTrackId,
    });
  }

  const constraintIssues: string[] = [];
  let nextClips = enforceClipConstraints(assembledClips, options, frameRate, constraintIssues);
  let nextTransitions: AutoEditTransition[] = [];

  if (options.includePolish) {
    const transitionResult = buildCutTransitionsAndOverlaps(
      nextClips,
      frameRate,
      options.transitionDensity,
      presetConfig.defaultTransitionDuration,
      !options.enforceNoOverlap
    );
    nextClips = transitionResult.clips;
    nextTransitions.push(...transitionResult.transitions);

    if (nextClips.length > 0) {
      const first = nextClips[0];
      nextClips[0] = applyDefaultFadeMetadata(first, 'video', 'in', snapToFrame(0.2, frameRate));
      const last = nextClips[nextClips.length - 1];
      nextClips[nextClips.length - 1] = applyDefaultFadeMetadata(last, 'video', 'out', snapToFrame(0.25, frameRate));
    }
  }

  if (options.addAudioBed && primaryAudioTrackId) {
    const audioCandidate = sourceClips
      .filter((clip) => isAudioTrackId(clip.trackId, input.tracks))
      .sort((left, right) => right.duration - left.duration)[0];
    if (audioCandidate) {
      const audioDuration = snapToFrame(
        Math.min(
          Math.max(
            nextClips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0),
            presetConfig.minClipDuration
          ),
          audioCandidate.duration
        ),
        frameRate
      );
      const audioBedBase = {
        ...cloneClip(audioCandidate),
        id: `${audioCandidate.id}-auto-bed`,
        start: 0,
        duration: audioDuration,
        trackId: primaryAudioTrackId,
        metadata: {
          ...(isRecord(audioCandidate.metadata) ? audioCandidate.metadata : {}),
          autoEditAudioBed: true,
        },
      };
      const audioBed = applyDefaultFadeMetadata(
        applyDefaultFadeMetadata(audioBedBase, 'audio', 'in', snapToFrame(0.25, frameRate)),
        'audio',
        'out',
        snapToFrame(0.35, frameRate)
      );
      nextClips.push(audioBed);
    }
  }

  if (options.enableDucking || options.enableJCutLCut) {
    const audioNarrativeResult = applyAudioNarrativeMetadata(nextClips, nextTransitions, options, frameRate);
    nextClips = audioNarrativeResult.clips;
    nextTransitions = audioNarrativeResult.transitions;
  }

  const estimatedDurationSeconds = nextClips.reduce((maxEnd, clip) => {
    return Math.max(maxEnd, clip.start + clip.duration);
  }, 0);

  const selectedClipIds = nextClips
    .filter((clip) => !isAudioTrackId(clip.trackId, input.tracks) && !String(clip.id).endsWith('-auto-bed'))
    .map((clip) => clip.id);

  const maxSource = Math.max(1, orderedVideoCandidates.length);
  const qualityAverage = orderedVideoCandidates.length > 0
    ? orderedVideoCandidates
        .slice(0, Math.max(1, selectedClipIds.length))
        .reduce((sum, item) => sum + item.score, 0) /
      Math.max(1, Math.min(orderedVideoCandidates.length, selectedClipIds.length))
    : 0.5;
  const coverageScore = clampNumber(selectedClipIds.length / maxSource, 0, 1);
  const durationScore = clampNumber(
    1 - Math.abs(estimatedDurationSeconds - targetDurationSeconds) / Math.max(targetDurationSeconds, 1),
    0,
    1
  );
  const polishScore = options.includePolish ? 0.12 : 0;
  const confidence = clampNumber(
    qualityAverage * 0.48 + coverageScore * 0.2 + durationScore * 0.16 + polishScore,
    0,
    1
  );
  const serverConfidenceRaw = input.serverRanking?.confidence;
  const confidenceWithServer =
    typeof serverConfidenceRaw === 'number' && Number.isFinite(serverConfidenceRaw)
      ? clampNumber(confidence * 0.72 + clampNumber(serverConfidenceRaw, 0, 1) * 0.28, 0, 1)
      : confidence;

  const nextMarkers = options.addMarkers
    ? [
        ...sourceMarkers.filter((marker) => marker.time <= estimatedDurationSeconds && marker.time >= 0),
        {
          id: `auto-edit-start-${Date.now()}`,
          time: 0,
          color: '#22c55e',
          label: 'Auto Edit Start',
        },
        {
          id: `auto-edit-end-${Date.now()}`,
          time: snapToFrame(estimatedDurationSeconds, frameRate),
          color: '#22c55e',
          label: 'Auto Edit End',
        },
        ...selectedClipIds.slice(0, 16).map((clipId, index) => {
          const clip = nextClips.find((candidate) => candidate.id === clipId);
          return {
            id: `auto-cut-${clipId}-${index}`,
            time: snapToFrame(clip?.start || 0, frameRate),
            color: '#38bdf8',
            label: `Auto Cut ${index + 1}`,
          };
        }),
      ]
    : sourceMarkers;

  const serverSummaryLines = Array.isArray(input.serverRanking?.summary)
    ? input.serverRanking.summary
        .filter((line) => typeof line === 'string' && line.trim().length > 0)
        .slice(0, 3)
    : [];

  const summary: string[] = [];
  summary.push(
    `Variant ${options.variant} generated with ${options.intentProfileId || 'default intent'} profile.`
  );
  if (input.serverRanking?.modelUsed) {
    summary.push(
      input.serverRanking.analyzerAvailable === false
        ? `Server ranking fallback used (${input.serverRanking.modelUsed}).`
        : `Server ranking assisted by ${input.serverRanking.modelUsed}.`
    );
  }
  if (input.serverRanking?.llmBeatClassificationUsed === true) {
    summary.push('Semantic beat classification active.');
  }

  if (Object.keys(serverBeatByClipId).length > 0 && selectedClipIds.length > 0) {
    const selectedBeatCounts: Partial<Record<AutoEditNarrativeBeat, number>> = {};
    selectedClipIds.forEach((clipId) => {
      const beat = serverBeatByClipId[clipId]?.beat;
      if (!beat) {
        return;
      }
      selectedBeatCounts[beat] = (selectedBeatCounts[beat] || 0) + 1;
    });
    const beatSummary = (['hook', 'build', 'climax', 'resolution'] as AutoEditNarrativeBeat[])
      .map((beat) => `${beat}:${selectedBeatCounts[beat] || 0}`)
      .join(' ');
    summary.push(`Narrative phase placement ${beatSummary}.`);
  }

  if (constraintIssues.length > 0) {
    summary.push(`Hard constraints corrected ${constraintIssues.length} issue(s).`);
  } else {
    summary.push('Hard constraints satisfied with no corrections.');
  }

  summary.push(...serverSummaryLines);
  summary.push(
    `Selected ${selectedClipIds.length} video clips from ${orderedVideoCandidates.length} candidates.`,
    `Built ${options.preset} ${options.variant} cut targeting ${targetDurationSeconds.toFixed(1)}s (result ${estimatedDurationSeconds.toFixed(1)}s).`,
    options.includePolish
      ? `Applied polish with ${nextTransitions.length} transitions and entry/exit fades.`
      : 'Assemble-only mode (no transition/fade polish).',
    options.addAudioBed && primaryAudioTrackId
      ? 'Added automatic audio bed when compatible source audio was available.'
      : 'Audio bed disabled.',
    options.enableDucking
      ? `Audio ducking metadata applied (${options.duckingAmountDb} dB).`
      : 'Audio ducking disabled.',
    options.enableJCutLCut
      ? 'J/L-cut metadata generated for neighboring shots.'
      : 'J/L-cut metadata disabled.'
  );

  const assembledVideoClips = nextClips
    .filter((clip) => !isAudioTrackId(clip.trackId, input.tracks))
    .sort((left, right) => left.start - right.start);
  const finalClips = options.includeAssemble
    ? [...assembledVideoClips, ...nextClips.filter((clip) => isAudioTrackId(clip.trackId, input.tracks))]
    : sourceClips;

  const proposal: AutoEditProposal = {
    proposalId: makeProposalId(options),
    variant: options.variant,
    clips: finalClips,
    transitions: options.includePolish ? nextTransitions : sourceTransitions,
    markers: nextMarkers,
    preset: options.preset,
    targetDurationSeconds: snapToFrame(targetDurationSeconds, frameRate),
    estimatedDurationSeconds: snapToFrame(estimatedDurationSeconds, frameRate),
    confidence: Number(confidenceWithServer.toFixed(3)),
    summary,
    selectedClipIds,
    clipExplainabilityById: explainabilityById,
    constraintIssues,
    storyValidationReport: {
      generatedAt: new Date().toISOString(),
      pass: false,
      score: 0,
      hardConstraintPass: false,
      narrativePass: false,
      coveragePass: false,
      metrics: {
        targetDurationSeconds: 0,
        estimatedDurationSeconds: 0,
        durationDeltaSeconds: 0,
        outputClipCount: 0,
        outputVideoClipCount: 0,
        outputAudioClipCount: 0,
        uniqueSourceCount: 0,
        sourceCoverageRatio: 0,
        overlapCount: 0,
        trackBoundsIssueCount: 0,
        negativeDurationCount: 0,
        invalidOffsetCount: 0,
        explainabilityCoverageRatio: 0,
        beatCoverage: {
          hook: false,
          build: false,
          climax: false,
          resolution: false,
        },
      },
      issues: [],
      summary: [],
    },
  };
  proposal.storyValidationReport = createStoryValidationReport(input, proposal);
  proposal.summary = [...proposal.summary, ...proposal.storyValidationReport.summary];
  return proposal;
}

export function createAutoEditAlternatives(
  input: AutoEditInput,
  baseOptions: AutoEditOptions
): AutoEditAlternativesResult {
  const safeOptions = buildVariantOptions(baseOptions, 'safe');
  const balancedOptions = buildVariantOptions(baseOptions, 'balanced');
  const boldOptions = buildVariantOptions(baseOptions, 'bold');

  const safe = createAutoEditProposal(input, safeOptions);
  const balanced = createAutoEditProposal(input, balancedOptions);
  const bold = createAutoEditProposal(input, boldOptions);

  const alternatives: Record<AutoEditVariant, AutoEditProposal> = {
    safe,
    balanced,
    bold,
  };

  const comparisonSummary = [
    `Safe ${safe.estimatedDurationSeconds.toFixed(1)}s • ${(safe.confidence * 100).toFixed(0)}%`,
    `Balanced ${balanced.estimatedDurationSeconds.toFixed(1)}s • ${(balanced.confidence * 100).toFixed(0)}%`,
    `Bold ${bold.estimatedDurationSeconds.toFixed(1)}s • ${(bold.confidence * 100).toFixed(0)}%`,
  ];

  return {
    defaultVariant: baseOptions.variant || 'balanced',
    alternatives,
    comparisonSummary,
  };
}
