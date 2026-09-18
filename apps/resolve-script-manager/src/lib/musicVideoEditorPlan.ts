export type MusicVideoOperationMode = "read-only" | "write" | "conditional-write";

export interface MusicVideoEditorVariantSummary {
  id: "performance" | "narrative" | "social";
  label: string;
  segmentCount: number;
  uniqueClipCount: number;
  durationSec: number;
  signature: string;
}

export interface MusicVideoEditorPlanInput {
  sourcePath: string;
  resolveProjectName: string | null;
  resolveProjectId: string | null;
  mediaPoolClipCount: number;
  timelineName: string;
  bpm: number | null;
  beatMethod: string | null;
  beatCount: number;
  downbeatCount: number;
  sectionCount: number;
  sectionLabels: string[];
  segmentCount: number;
  uniqueClipCount: number;
  variants: MusicVideoEditorVariantSummary[];
  selectedVariantIds: Array<MusicVideoEditorVariantSummary["id"]>;
  coverageScore: number;
  coverageBlockers?: string[];
  coverageWarnings?: string[];
  performanceCoveragePct: number;
  includeMusic: boolean;
  runQc: boolean;
  enablePerformanceSync: boolean;
  enableTransitions: boolean;
  enableSpeedAccents: boolean;
  applyLook: boolean;
  selectedLookLabel: string;
  genre: string;
  analysisWarnings?: string[];
}

export interface MusicVideoEditorPlanStep {
  id: string;
  label: string;
  description: string;
  mode: MusicVideoOperationMode;
  enabled: boolean;
}

export interface MusicVideoEditorPlan {
  version: "music-video-editor-v2";
  readiness: "ready" | "blocked";
  requiresApproval: true;
  approvalKey: string;
  blockers: string[];
  warnings: string[];
  steps: MusicVideoEditorPlanStep[];
  summary: {
    sourceName: string;
    resolveProjectName: string;
    timelineName: string;
    bpm: number | null;
    beatCount: number;
    downbeatCount: number;
    sectionCount: number;
    sectionLabels: string[];
    segmentCount: number;
    uniqueClipCount: number;
    mediaPoolClipCount: number;
    selectedLookLabel: string;
    genre: string;
    selectedVariantCount: number;
    coverageScore: number;
    performanceCoveragePct: number;
    variants: MusicVideoEditorVariantSummary[];
  };
}

export function musicVideoSourceName(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, "/");
  return normalized.split("/").pop()?.replace(/\.[^.]+$/, "") || "Music Video";
}

export function defaultMusicVideoTimelineName(sourcePath: string): string {
  const sourceName = musicVideoSourceName(sourcePath)
    .replace(/[^\p{L}\p{N} _-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${sourceName || "Music Video"} — Music Video V2`;
}

export function buildMusicVideoEditorPlan(input: MusicVideoEditorPlanInput): MusicVideoEditorPlan {
  const blockers: string[] = [];
  if (!input.sourcePath.trim()) blockers.push("Velg en sang eller video som skal være timing-kilde.");
  if (!input.resolveProjectId || !input.resolveProjectName) {
    blockers.push("Åpne et prosjekt i DaVinci Resolve og kjør analysen på nytt.");
  }
  if (input.mediaPoolClipCount < 1) {
    blockers.push("Resolve Media Pool må inneholde minst ett videoklipp.");
  }
  if (input.beatCount < 2 || !input.bpm) {
    blockers.push("Beat-analysen må finne et gyldig tempo og minst to beats.");
  }
  if (input.segmentCount < 1 || input.uniqueClipCount < 1) {
    blockers.push("Beat-planen må kunne tilordne minst ett Media Pool-klipp.");
  }
  if (!input.timelineName.trim()) blockers.push("Gi den nye Resolve-timelinen et navn.");
  if (input.timelineName.trim().length > 80 || /[\u0000-\u001f]/.test(input.timelineName)) {
    blockers.push("Timeline-navnet må være maks 80 tegn og kan ikke inneholde kontrolltegn.");
  }
  if (input.selectedVariantIds.length === 0) {
    blockers.push("Velg minst én timeline-variant som skal bygges.");
  }
  blockers.push(...(input.coverageBlockers ?? []));

  const warnings = [...(input.analysisWarnings ?? []), ...(input.coverageWarnings ?? [])];
  if (input.beatMethod?.includes("fallback")) {
    warnings.push("Beat-deteksjonen bruker konstant BPM-fallback. Verifiser tempoet før bygging.");
  }
  if (input.sectionCount === 0) {
    warnings.push("Ingen sikre sangseksjoner ble funnet; planen bruker jevn fire-beat pacing.");
  }
  if (!input.applyLook) {
    warnings.push(`Look-valget «${input.selectedLookLabel}» følger kun som kreativ retning.`);
  }
  if (input.enablePerformanceSync && input.performanceCoveragePct < 70) {
    warnings.push(
      `Performance Cut har ${input.performanceCoveragePct}% verifisert audio-match; fallback-segmenter må kontrolleres manuelt.`,
    );
  }
  if (!input.includeMusic) {
    warnings.push("Timing-kilden legges ikke på et eget audiospor; kamera-lyd beholdes aktiv.");
  }

  const steps: MusicVideoEditorPlanStep[] = [
    {
      id: "mcp-project-doctor",
      label: "Bekreft prosjekt med MCP Project Doctor",
      description: "Read-only kontroll kjøres igjen rett før første endring.",
      mode: "read-only",
      enabled: Boolean(input.resolveProjectId),
    },
    {
      id: "analysis-and-coverage",
      label: "Lås beat-, seksjons-, sync- og dekningsanalyse",
      description: `${input.beatCount} beats · coverage ${input.coverageScore}/100 · ${input.segmentCount} basis-segmenter.`,
      mode: "read-only",
      enabled: input.segmentCount > 0,
    },
    {
      id: "storyboard-preview",
      label: "Forhåndsvis storyboard og alternative edits",
      description: `${input.selectedVariantIds.length} av ${input.variants.length} varianter er valgt.`,
      mode: "read-only",
      enabled: input.variants.length > 0,
    },
    {
      id: "import-missing-clips",
      label: "Importer eventuelle manglende klipp",
      description: "Bare kildefiler som beat-planen bruker og som ikke allerede finnes i Media Pool.",
      mode: "conditional-write",
      enabled: input.segmentCount > 0,
    },
    {
      id: "build-beat-timelines",
      label: "Opprett valgte beat-synkroniserte timelines",
      description: input.variants
        .filter((variant) => input.selectedVariantIds.includes(variant.id))
        .map((variant) => `${variant.label} (${variant.segmentCount})`)
        .join(" · ") || "Ingen variant valgt",
      mode: "write",
      enabled: input.selectedVariantIds.length > 0 && Boolean(input.timelineName.trim()),
    },
    {
      id: "motion-treatment",
      label: "Legg til kontrollerte overganger og speed-accenter",
      description: "Resolve 21.1 AddTransition/SetSpeed brukes bare der storyboardet har eksplisitt metadata.",
      mode: "write",
      enabled: input.enableTransitions || input.enableSpeedAccents,
    },
    {
      id: "apply-look",
      label: `Anvend «${input.selectedLookLabel}» som Resolve-look`,
      description: "Setter LUT på eksisterende node 1 og hopper over klipp med manuelt grade-arbeid.",
      mode: "write",
      enabled: input.applyLook,
    },
    {
      id: "add-music",
      label: "Legg timing-kilden på eget audiospor",
      description: "Kamera-lyd dempes, men beholdes synlig for kontroll av synk.",
      mode: "write",
      enabled: input.includeMusic,
    },
    {
      id: "timeline-qc",
      label: "Kjør gap-QC på den nye timelinen",
      description: "Read-only sweep av offline media, flash-frames, korte klipp, gaps, farge og lydnivå.",
      mode: "read-only",
      enabled: input.runQc,
    },
    {
      id: "rollback-manifest",
      label: "Registrer sikker rollback",
      description: "Prosjekt-ID og eksakte timeline-ID-er lagres slik at bare denne builden kan angres.",
      mode: "conditional-write",
      enabled: input.selectedVariantIds.length > 0,
    },
  ];

  const approvalKey = JSON.stringify({
    sourcePath: input.sourcePath,
    resolveProjectId: input.resolveProjectId,
    mediaPoolClipCount: input.mediaPoolClipCount,
    timelineName: input.timelineName.trim(),
    bpm: input.bpm,
    beatMethod: input.beatMethod,
    beatCount: input.beatCount,
    downbeatCount: input.downbeatCount,
    sectionCount: input.sectionCount,
    sectionLabels: input.sectionLabels,
    segmentCount: input.segmentCount,
    uniqueClipCount: input.uniqueClipCount,
    variants: input.variants,
    selectedVariantIds: input.selectedVariantIds,
    coverageScore: input.coverageScore,
    performanceCoveragePct: input.performanceCoveragePct,
    includeMusic: input.includeMusic,
    runQc: input.runQc,
    enablePerformanceSync: input.enablePerformanceSync,
    enableTransitions: input.enableTransitions,
    enableSpeedAccents: input.enableSpeedAccents,
    applyLook: input.applyLook,
    selectedLookLabel: input.selectedLookLabel,
    genre: input.genre.trim(),
  });

  return {
    version: "music-video-editor-v2",
    readiness: blockers.length === 0 ? "ready" : "blocked",
    requiresApproval: true,
    approvalKey,
    blockers,
    warnings: [...new Set(warnings)],
    steps,
    summary: {
      sourceName: musicVideoSourceName(input.sourcePath),
      resolveProjectName: input.resolveProjectName || "Ingen aktivt prosjekt",
      timelineName: input.timelineName.trim(),
      bpm: input.bpm,
      beatCount: input.beatCount,
      downbeatCount: input.downbeatCount,
      sectionCount: input.sectionCount,
      sectionLabels: input.sectionLabels,
      segmentCount: input.segmentCount,
      uniqueClipCount: input.uniqueClipCount,
      mediaPoolClipCount: input.mediaPoolClipCount,
      selectedLookLabel: input.selectedLookLabel,
      genre: input.genre.trim(),
      selectedVariantCount: input.selectedVariantIds.length,
      coverageScore: input.coverageScore,
      performanceCoveragePct: input.performanceCoveragePct,
      variants: input.variants,
    },
  };
}
