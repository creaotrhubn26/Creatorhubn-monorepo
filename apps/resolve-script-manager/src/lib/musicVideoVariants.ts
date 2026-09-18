export type MusicVideoVariantId = "performance" | "narrative" | "social";
export type MusicVideoTransition = "cut" | "cross_dissolve";

export interface MusicVideoSegment {
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  clipPath: string;
  clipName?: string;
  section?: string;
  energyDemand?: number;
  qualityScore?: number | null;
  highlightScore?: number | null;
  motionScore?: number | null;
  tempoMatch?: number | null;
  sourceStartSec?: number;
  matchConfidence?: number;
  syncFallback?: boolean;
  transition?: MusicVideoTransition;
  speedPct?: number;
}

export interface MusicVideoSongSection {
  startSec: number;
  endSec: number;
  label: string;
}

export interface MusicVideoAlignment {
  clipPath: string;
  clipName?: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  matchConfidence?: number;
}

export interface MusicVideoVariant {
  id: MusicVideoVariantId;
  label: string;
  description: string;
  timelineSuffix: string;
  aspect: "16:9" | "9:16";
  musicStartSec: number;
  segments: MusicVideoSegment[];
  durationSec: number;
  uniqueClipCount: number;
  syncedSegmentCount: number;
  transitionCount: number;
  speedAccentCount: number;
}

export interface MusicVideoCoverageCheck {
  id: string;
  label: string;
  status: "ok" | "warning" | "error";
  detail: string;
}

export interface MusicVideoCoverageReport {
  score: number;
  checks: MusicVideoCoverageCheck[];
  missingSections: string[];
  warnings: string[];
  blockers: string[];
  performanceCoveragePct: number;
  clipVarietyPct: number;
}

export interface MusicVideoVariantBundle {
  variants: MusicVideoVariant[];
  coverage: MusicVideoCoverageReport;
}

interface VariantInput {
  baseSegments: MusicVideoSegment[];
  beats: number[];
  sections: MusicVideoSongSection[];
  alignments?: MusicVideoAlignment[];
  mediaPoolClipCount: number;
  mediaQcAvailable?: boolean;
  offlineClipCount?: number;
  missingAudioCount?: number;
  socialDurationSec?: number;
}

const CALM_SECTIONS = new Set(["intro", "bridge", "outro"]);
const PEAK_SECTIONS = new Set(["chorus", "drop", "build_up", "pre_chorus"]);

function normalizedSection(label?: string): string {
  return (label || "other").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function sectionAt(timeSec: number, sections: MusicVideoSongSection[]): string {
  return normalizedSection(sections.find(
    (section) => section.startSec <= timeSec && timeSec < section.endSec,
  )?.label);
}

function withStats(
  variant: Omit<MusicVideoVariant, "durationSec" | "uniqueClipCount" | "syncedSegmentCount" | "transitionCount" | "speedAccentCount">,
): MusicVideoVariant {
  const segments = variant.segments;
  return {
    ...variant,
    durationSec: segments.reduce((maximum, segment) => Math.max(maximum, segment.endSec), 0),
    uniqueClipCount: new Set(segments.map((segment) => segment.clipPath).filter(Boolean)).size,
    syncedSegmentCount: segments.filter((segment) => !segment.syncFallback && segment.matchConfidence != null).length,
    transitionCount: segments.filter((segment) => segment.transition === "cross_dissolve").length,
    speedAccentCount: segments.filter((segment) => (segment.speedPct ?? 100) !== 100).length,
  };
}

function buildNarrativeVariant(baseSegments: MusicVideoSegment[]): MusicVideoVariant {
  const segments = baseSegments.map((segment, index) => {
    const section = normalizedSection(segment.section);
    const isCalmBoundary = index > 0 && CALM_SECTIONS.has(section);
    const speedPct = section === "drop" && index % 2 === 0 ? 125 : 100;
    return {
      ...segment,
      segmentIndex: index,
      section,
      transition: isCalmBoundary ? "cross_dissolve" as const : "cut" as const,
      speedPct,
    };
  });
  return withStats({
    id: "narrative",
    label: "Narrative Cut",
    description: "Seksjonsstyrt fullengde-cut med roligere broer og energi-accenter på drops.",
    timelineSuffix: "Narrative Cut",
    aspect: "16:9",
    musicStartSec: 0,
    segments,
  });
}

function buildPerformanceVariant(
  baseSegments: MusicVideoSegment[],
  alignments: MusicVideoAlignment[],
): MusicVideoVariant {
  let lastPath = "";
  const segments = baseSegments.map((segment, index) => {
    const candidates = alignments
      .filter((alignment) => (
        alignment.startSec <= segment.startSec + 0.04
        && alignment.endSec >= segment.endSec - 0.04
      ))
      .sort((left, right) => {
        const repeatPenaltyLeft = left.clipPath === lastPath ? 0.25 : 0;
        const repeatPenaltyRight = right.clipPath === lastPath ? 0.25 : 0;
        return ((right.matchConfidence ?? 0) - repeatPenaltyRight)
          - ((left.matchConfidence ?? 0) - repeatPenaltyLeft);
      });
    const match = candidates[0];
    if (!match) {
      return {
        ...segment,
        segmentIndex: index,
        section: normalizedSection(segment.section),
        syncFallback: true,
        transition: "cut" as const,
        speedPct: 100,
      };
    }
    lastPath = match.clipPath;
    return {
      ...segment,
      segmentIndex: index,
      clipPath: match.clipPath,
      clipName: match.clipName || match.clipPath.split(/[\\/]/).pop(),
      section: normalizedSection(segment.section),
      sourceStartSec: Math.max(0, segment.startSec - match.startSec),
      matchConfidence: match.matchConfidence,
      syncFallback: false,
      transition: "cut" as const,
      speedPct: 100,
    };
  });
  return withStats({
    id: "performance",
    label: "Performance Cut",
    description: "Fullengde-cut som prioriterer takes audio-matchet mot masterlåten for lip-sync.",
    timelineSuffix: "Performance Cut",
    aspect: "16:9",
    musicStartSec: 0,
    segments,
  });
}

function selectSocialWindow(
  beats: number[],
  sections: MusicVideoSongSection[],
  maxDurationSec: number,
): { startSec: number; endSec: number } {
  const songEnd = beats.length > 0 ? beats[beats.length - 1] : 0;
  const peak = sections.find((section) => PEAK_SECTIONS.has(normalizedSection(section.label)));
  const proposedStart = peak ? Math.max(0, peak.startSec - 2) : 0;
  const startBeat = beats.find((beat) => beat >= proposedStart) ?? proposedStart;
  return { startSec: startBeat, endSec: Math.min(songEnd, startBeat + maxDurationSec) };
}

function buildSocialVariant(
  baseSegments: MusicVideoSegment[],
  beats: number[],
  sections: MusicVideoSongSection[],
  maxDurationSec: number,
): MusicVideoVariant {
  const window = selectSocialWindow(beats, sections, maxDurationSec);
  const grid = beats.filter((beat) => beat >= window.startSec && beat <= window.endSec);
  const sourcePool = [...baseSegments].sort((left, right) => (
    (right.highlightScore ?? 0) + (right.motionScore ?? 0)
    - (left.highlightScore ?? 0) - (left.motionScore ?? 0)
  ));
  const segments: MusicVideoSegment[] = [];
  let beatIndex = 0;
  let sourceIndex = 0;
  while (beatIndex < grid.length - 1 && sourcePool.length > 0) {
    const startSec = grid[beatIndex];
    const section = sectionAt(startSec, sections);
    const stride = PEAK_SECTIONS.has(section) ? 1 : 2;
    const endIndex = Math.min(beatIndex + stride, grid.length - 1);
    const endSec = grid[endIndex];
    if (endSec <= startSec) break;
    const source = sourcePool[sourceIndex % sourcePool.length];
    segments.push({
      ...source,
      segmentIndex: segments.length,
      startSec: startSec - window.startSec,
      endSec: endSec - window.startSec,
      durationSec: endSec - startSec,
      section,
      transition: "cut",
      speedPct: PEAK_SECTIONS.has(section) && segments.length % 4 === 2 ? 140 : 100,
    });
    sourceIndex += 1;
    beatIndex = endIndex;
  }
  return withStats({
    id: "social",
    label: "High Energy Social Cut",
    description: "Kompakt 9:16 hook-cut fra første energi-topp med 1–2-beat pacing.",
    timelineSuffix: "High Energy Social 9x16",
    aspect: "9:16",
    musicStartSec: window.startSec,
    segments,
  });
}

function buildCoverage(
  input: VariantInput,
  narrative: MusicVideoVariant,
  performance: MusicVideoVariant,
): MusicVideoCoverageReport {
  const detectedSections = [...new Set(input.sections.map((section) => normalizedSection(section.label)))];
  const mappedSections = new Set(narrative.segments.map((segment) => normalizedSection(segment.section)));
  const missingSections = detectedSections.filter((section) => !mappedSections.has(section));
  const performanceCoveragePct = performance.segments.length > 0
    ? Math.round((performance.syncedSegmentCount / performance.segments.length) * 100)
    : 0;
  const clipVarietyPct = narrative.segments.length > 0
    ? Math.round((narrative.uniqueClipCount / narrative.segments.length) * 100)
    : 0;
  const offline = Math.max(0, input.offlineClipCount ?? 0);
  const missingAudio = Math.max(0, input.missingAudioCount ?? 0);
  const mediaPoolClipCount = Math.max(0, input.mediaPoolClipCount);
  const mediaQcAvailable = input.mediaQcAvailable !== false;
  const checks: MusicVideoCoverageCheck[] = [
    {
      id: "sections",
      label: "Sangstruktur",
      status: missingSections.length === 0 && detectedSections.length > 0 ? "ok" : "warning",
      detail: detectedSections.length === 0
        ? "Ingen sikre seksjoner; pacing bruker beat-grid fallback."
        : missingSections.length > 0
          ? `Mangler dekning i: ${missingSections.join(", ")}.`
          : `${detectedSections.length} detekterte seksjoner har klippedekning.`,
    },
    {
      id: "variety",
      label: "Klippvariasjon",
      status: clipVarietyPct >= 35 ? "ok" : "warning",
      detail: `${narrative.uniqueClipCount} unike klipp på ${narrative.segments.length} segmenter (${clipVarietyPct}%).`,
    },
    {
      id: "performance-sync",
      label: "Performance/lip-sync",
      status: performanceCoveragePct >= 70 ? "ok" : performanceCoveragePct > 0 ? "warning" : "error",
      detail: `${performanceCoveragePct}% av Performance Cut er audio-matchet mot masterlåten.`,
    },
    {
      id: "media-pool",
      label: "Media Pool",
      status: mediaPoolClipCount > 0 ? "ok" : "error",
      detail: mediaPoolClipCount > 0
        ? `${mediaPoolClipCount} klipp er tilgjengelige i Media Pool.`
        : "Media Pool inneholder ingen videoklipp.",
    },
    {
      id: "offline",
      label: "Media online",
      status: !mediaQcAvailable ? "warning" : offline === 0 ? "ok" : "error",
      detail: !mediaQcAvailable
        ? "Offline-status kunne ikke verifiseres i denne analysen."
        : offline === 0 ? "Ingen offline Media Pool-klipp funnet." : `${offline} offline klipp må relinkes.`,
    },
    {
      id: "camera-audio",
      label: "Kamera-lyd",
      status: mediaQcAvailable && missingAudio === 0 ? "ok" : "warning",
      detail: !mediaQcAvailable
        ? "Kamera-lyd kunne ikke verifiseres i denne analysen."
        : missingAudio === 0
        ? "Kamera-klipp har lyd for sync-kontroll."
        : `${missingAudio} videoklipp mangler kamera-lyd og kan ikke audio-matches.`,
    },
  ];
  const blockers = checks
    .filter((check) => ["offline", "media-pool"].includes(check.id) && check.status === "error")
    .map((check) => check.detail);
  const warnings = checks.filter((check) => check.status === "warning" || check.id === "performance-sync" && check.status === "error")
    .map((check) => check.detail);
  const points = Math.round(
    checks.reduce((total, check) => total + (check.status === "ok" ? 1 : check.status === "warning" ? 0.5 : 0), 0)
      / checks.length * 100,
  );
  return {
    score: points,
    checks,
    missingSections,
    warnings,
    blockers,
    performanceCoveragePct,
    clipVarietyPct,
  };
}

export function buildMusicVideoVariants(input: VariantInput): MusicVideoVariantBundle {
  const narrative = buildNarrativeVariant(input.baseSegments);
  const performance = buildPerformanceVariant(input.baseSegments, input.alignments ?? []);
  const social = buildSocialVariant(
    input.baseSegments,
    input.beats,
    input.sections,
    Math.max(15, Math.min(60, input.socialDurationSec ?? 45)),
  );
  return {
    variants: [performance, narrative, social],
    coverage: buildCoverage(input, narrative, performance),
  };
}
