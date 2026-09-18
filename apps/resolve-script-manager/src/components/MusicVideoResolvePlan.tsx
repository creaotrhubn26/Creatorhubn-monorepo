import { useEffect, useMemo, useState } from "react";
import { executeScript, runResolveMcpProjectDoctor } from "../api";
import type { ResolveMcpDoctorReport, RunSummary } from "../types";
import {
  buildMusicVideoEditorPlan,
  defaultMusicVideoTimelineName,
} from "../lib/musicVideoEditorPlan";
import {
  buildMusicVideoVariants,
  type MusicVideoAlignment,
  type MusicVideoSegment,
  type MusicVideoSongSection,
  type MusicVideoVariant,
  type MusicVideoVariantBundle,
  type MusicVideoVariantId,
} from "../lib/musicVideoVariants";

interface Props {
  open: boolean;
  onClose: () => void;
  sourcePath: string;
  bpm: number;
  selectedLookId: string;
  selectedLookLabel: string;
  genre: string;
}

interface BeatResult {
  bpm: number;
  beats: number[];
  downbeats?: number[];
  durationSec?: number;
  method: string;
}

interface SectionResult {
  sectionCount?: number;
  labels?: string[];
  sections?: MusicVideoSongSection[];
}

interface AssignmentResult {
  segments: MusicVideoSegment[];
  totalSegments: number;
  uniqueClipsUsed: number;
  averageSegmentDurationSec?: number;
}

interface AlignmentResult {
  matched: number;
  skipped: number;
  averageMatchConfidence?: number;
  segments?: MusicVideoAlignment[];
}

interface MediaQcResult {
  totalClips?: number;
  offlineCount?: number;
  missingAudioCount?: number;
  issues?: Array<{ kind: string }>;
}

interface PreparedAnalysis {
  projectName: string;
  projectId: string;
  mediaPoolClipCount: number;
  targetFps: number;
  beats: number[];
  downbeats: number[];
  bpm: number;
  beatMethod: string;
  sections: MusicVideoSongSection[];
  sectionLabels: string[];
  baseSegments: MusicVideoSegment[];
  uniqueClipCount: number;
  averageSegmentDurationSec: number | null;
  alignments: MusicVideoAlignment[];
  mediaQc: MediaQcResult;
  bundle: MusicVideoVariantBundle;
  warnings: string[];
}

interface TimelineBuildPayload {
  timelineCreated?: boolean;
  timelineName?: string;
  timelineUniqueId?: string;
  projectUniqueId?: string;
  variantId?: MusicVideoVariantId;
  segmentsPlaced?: number;
  segmentsSkipped?: number;
  transitionsAdded?: number;
  speedChangesApplied?: number;
  treatmentErrors?: string[];
  musicAdded?: boolean;
  musicTrack?: string;
  mutedTracks?: string[];
}

interface VariantBuildResult {
  variantId: MusicVideoVariantId;
  variantLabel: string;
  timelineName: string;
  timelineUniqueId: string;
  segmentsPlaced: number;
  segmentsSkipped: number;
  transitionsAdded: number;
  speedChangesApplied: number;
  musicAdded: boolean;
  musicTrack: string | null;
  lookMessage: string;
  qcMessage: string;
  qcIssueCount: number | null;
}

interface BuildSession {
  operationId: string;
  projectId: string;
  variants: VariantBuildResult[];
  rolledBack: boolean;
}

type ReadyProjectDoctorReport = ResolveMcpDoctorReport & {
  project: { name: string; uniqueId: string };
};

function summaryResult<T>(summary: RunSummary, label: string): T {
  const errorEvent = summary.events.find((event) => event.type === "error");
  const errorValue = errorEvent?.value as { message?: string } | string | undefined;
  const errorMessage = typeof errorValue === "string"
    ? errorValue
    : errorValue?.message ?? errorEvent?.message;
  if (!summary.succeeded || errorEvent) throw new Error(errorMessage || `${label} feilet.`);
  const result = summary.events.find((event) => event.type === "result")?.value as T | undefined;
  if (!result) throw new Error(`${label} returnerte ingen resultatdata.`);
  return result;
}

function assertProjectDoctor(summary: RunSummary): ReadyProjectDoctorReport {
  const report = summaryResult<ResolveMcpDoctorReport>(summary, "MCP Project Doctor");
  if (!report.readOnly || !report.project?.uniqueId || !report.project.name) {
    throw new Error("MCP Project Doctor bekreftet ikke et aktivt Resolve-prosjekt.");
  }
  const critical = report.findings.filter((finding) => finding.severity === "error");
  if (critical.length > 0) {
    throw new Error(`MCP-preflight stoppet planen: ${critical.map((finding) => finding.title).join(", ")}.`);
  }
  return report as ReadyProjectDoctorReport;
}

function parseFps(value: string | number | null | undefined): number {
  const fps = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(fps) && fps > 0 ? fps : 25;
}

function operationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `music-video-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function variantSignature(variant: MusicVideoVariant): string {
  return JSON.stringify(variant.segments.map((segment) => [
    segment.startSec,
    segment.endSec,
    segment.clipPath,
    segment.sourceStartSec ?? null,
    segment.transition ?? "cut",
    segment.speedPct ?? 100,
  ]));
}

const SECTION_COLORS: Record<string, string> = {
  intro: "#637083",
  verse: "#3978c6",
  pre_chorus: "#805ad5",
  chorus: "#e84975",
  bridge: "#36a68c",
  drop: "#f0a500",
  build_up: "#9b59b6",
  outro: "#637083",
  other: "#59606b",
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.max(0, seconds - minutes * 60);
  return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
}

export function MusicVideoResolvePlan({
  open,
  onClose,
  sourcePath,
  bpm,
  selectedLookId,
  selectedLookLabel,
  genre,
}: Props) {
  const [timelineName, setTimelineName] = useState(() => defaultMusicVideoTimelineName(sourcePath));
  const [includeMusic, setIncludeMusic] = useState(true);
  const [runQc, setRunQc] = useState(true);
  const [enablePerformanceSync, setEnablePerformanceSync] = useState(true);
  const [enableTransitions, setEnableTransitions] = useState(true);
  const [enableSpeedAccents, setEnableSpeedAccents] = useState(true);
  const [applyLook, setApplyLook] = useState(true);
  const [selectedVariantIds, setSelectedVariantIds] = useState<MusicVideoVariantId[]>([
    "performance", "narrative", "social",
  ]);
  const [previewVariantId, setPreviewVariantId] = useState<MusicVideoVariantId>("narrative");
  const [preparing, setPreparing] = useState(false);
  const [status, setStatus] = useState("");
  const [prepared, setPrepared] = useState<PreparedAnalysis | null>(null);
  const [approved, setApproved] = useState(false);
  const [building, setBuilding] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildSession, setBuildSession] = useState<BuildSession | null>(null);

  useEffect(() => {
    setTimelineName(defaultMusicVideoTimelineName(sourcePath));
    setPrepared(null);
    setError(null);
  }, [sourcePath]);

  const variants = prepared?.bundle.variants ?? [];
  const plan = useMemo(() => buildMusicVideoEditorPlan({
    sourcePath,
    resolveProjectName: prepared?.projectName ?? null,
    resolveProjectId: prepared?.projectId ?? null,
    mediaPoolClipCount: prepared?.mediaPoolClipCount ?? 0,
    timelineName,
    bpm: prepared?.bpm ?? null,
    beatMethod: prepared?.beatMethod ?? null,
    beatCount: prepared?.beats.length ?? 0,
    downbeatCount: prepared?.downbeats.length ?? 0,
    sectionCount: prepared?.sections.length ?? 0,
    sectionLabels: prepared?.sectionLabels ?? [],
    segmentCount: prepared?.baseSegments.length ?? 0,
    uniqueClipCount: prepared?.uniqueClipCount ?? 0,
    variants: variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      segmentCount: variant.segments.length,
      uniqueClipCount: variant.uniqueClipCount,
      durationSec: variant.durationSec,
      signature: variantSignature(variant),
    })),
    selectedVariantIds,
    coverageScore: prepared?.bundle.coverage.score ?? 0,
    coverageBlockers: prepared?.bundle.coverage.blockers,
    coverageWarnings: prepared?.bundle.coverage.warnings,
    performanceCoveragePct: prepared?.bundle.coverage.performanceCoveragePct ?? 0,
    includeMusic,
    runQc,
    enablePerformanceSync,
    enableTransitions,
    enableSpeedAccents,
    applyLook,
    selectedLookLabel,
    genre,
    analysisWarnings: prepared?.warnings,
  }), [
    applyLook, enablePerformanceSync, enableSpeedAccents, enableTransitions, genre,
    includeMusic, prepared, runQc, selectedLookLabel, selectedVariantIds, sourcePath,
    timelineName, variants,
  ]);

  useEffect(() => {
    setApproved(false);
  }, [plan.approvalKey]);

  const busy = preparing || building || rollingBack;
  const activeBuild = Boolean(buildSession && !buildSession.rolledBack);
  const controlsLocked = busy || activeBuild;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  const preparePlan = async () => {
    if (!sourcePath || busy || activeBuild) return;
    setPreparing(true);
    setPrepared(null);
    if (buildSession?.rolledBack) setBuildSession(null);
    setError(null);
    const warnings: string[] = [];
    try {
      setStatus("MCP Project Doctor kontrollerer Resolve …");
      const projectReport = assertProjectDoctor(await runResolveMcpProjectDoctor());
      const targetFps = parseFps(projectReport.settings.timelineFrameRate);

      setStatus("Kontrollerer offline media og kamera-lyd …");
      let mediaQc: MediaQcResult = {};
      let mediaQcAvailable = false;
      try {
        mediaQc = summaryResult<MediaQcResult>(
          await executeScript("check_missing_media", {}, false),
          "Media Pool-QC",
        );
        mediaQcAvailable = true;
      } catch (mediaError) {
        warnings.push(`Media Pool-QC ble hoppet over: ${mediaError instanceof Error ? mediaError.message : String(mediaError)}`);
      }

      setStatus("Analyserer beats og downbeats …");
      const beatResult = summaryResult<BeatResult>(await executeScript("detect_music_beats", {
        musicPath: sourcePath,
        targetFps,
      }, false), "Beat-analysen");
      if (!Array.isArray(beatResult.beats) || beatResult.beats.length < 2 || !beatResult.bpm) {
        throw new Error("Beat-analysen fant ikke et gyldig timing-grid.");
      }

      setStatus("Finner intro, vers, chorus, bridge og outro …");
      let sectionResult: SectionResult = {};
      try {
        sectionResult = summaryResult<SectionResult>(await executeScript("detect_song_sections", {
          musicPath: sourcePath,
        }, false), "Sangseksjonsanalysen");
      } catch (sectionError) {
        warnings.push(`Sangseksjonsanalyse ble hoppet over: ${sectionError instanceof Error ? sectionError.message : String(sectionError)}`);
      }

      setStatus("Rangerer Media Pool-klipp etter energi, kvalitet og variasjon …");
      const assignment = summaryResult<AssignmentResult>(await executeScript("assign_clips_to_beats", {
        beats: beatResult.beats,
        downbeats: beatResult.downbeats ?? [],
        sections: sectionResult.sections ?? [],
        segmentBeats: 4,
        preferDownbeatCuts: true,
      }, false), "Intelligent klipprangering");
      if (!assignment.segments?.length || assignment.uniqueClipsUsed < 1) {
        throw new Error("Ingen Media Pool-klipp kunne tilordnes beat-planen.");
      }

      let alignments: MusicVideoAlignment[] = [];
      if (enablePerformanceSync) {
        setStatus("Audio-matcher performance-takes mot masterlåten …");
        try {
          const alignment = summaryResult<AlignmentResult>(await executeScript("align_clips_to_song_audio", {
            sourceSongPath: sourcePath,
            minConfidence: 0.05,
            verifyWithMfcc: true,
          }, false), "Performance-sync");
          alignments = alignment.segments ?? [];
          if (alignments.length === 0) warnings.push("Ingen performance-takes fikk sikker audio-match; Performance Cut bruker fallback-klipp.");
        } catch (alignmentError) {
          warnings.push(`Performance-sync bruker fallback: ${alignmentError instanceof Error ? alignmentError.message : String(alignmentError)}`);
        }
      }

      const sections = sectionResult.sections ?? [];
      const sectionLabels = sectionResult.labels
        ?? [...new Set(sections.map((section) => section.label))];
      const bundle = buildMusicVideoVariants({
        baseSegments: assignment.segments,
        beats: beatResult.beats,
        sections,
        alignments,
        mediaPoolClipCount: projectReport.mediaPool.clipCount,
        mediaQcAvailable,
        offlineClipCount: mediaQc.offlineCount,
        missingAudioCount: mediaQc.missingAudioCount,
        socialDurationSec: 45,
      });

      setPrepared({
        projectName: projectReport.project.name,
        projectId: projectReport.project.uniqueId,
        mediaPoolClipCount: projectReport.mediaPool.clipCount,
        targetFps,
        beats: beatResult.beats,
        downbeats: beatResult.downbeats ?? [],
        bpm: beatResult.bpm,
        beatMethod: beatResult.method,
        sections,
        sectionLabels,
        baseSegments: assignment.segments,
        uniqueClipCount: assignment.uniqueClipsUsed,
        averageSegmentDurationSec: assignment.averageSegmentDurationSec ?? null,
        alignments,
        mediaQc,
        bundle,
        warnings,
      });
      setStatus("");
    } catch (prepareError) {
      setError(`Plananalysen stoppet: ${prepareError instanceof Error ? prepareError.message : String(prepareError)}`);
      setStatus("");
    } finally {
      setPreparing(false);
    }
  };

  const buildInResolve = async () => {
    if (!prepared || !approved || plan.readiness !== "ready" || busy || activeBuild) return;
    setBuilding(true);
    setBuildSession(null);
    setError(null);
    const id = operationId();
    const built: VariantBuildResult[] = [];
    try {
      setStatus("Bekrefter godkjent prosjekt med MCP …");
      const currentProject = assertProjectDoctor(await runResolveMcpProjectDoctor());
      if (currentProject.project.uniqueId !== prepared.projectId) {
        throw new Error(
          `Aktivt Resolve-prosjekt er byttet fra «${prepared.projectName}» til «${currentProject.project.name}». Kjør analysen på nytt.`,
        );
      }

      const selected = prepared.bundle.variants.filter((variant) => selectedVariantIds.includes(variant.id));
      for (let index = 0; index < selected.length; index += 1) {
        const variant = selected[index];
        setStatus(`Bygger ${variant.label} (${index + 1}/${selected.length}) …`);
        const timeline = summaryResult<TimelineBuildPayload>(await executeScript("place_clips_on_beat_grid", {
          segments: variant.segments,
          timelineName: `${timelineName.trim()} — ${variant.timelineSuffix}`,
          targetFps: prepared.targetFps,
          projectId: prepared.projectId,
          operationId: id,
          variantId: variant.id,
          aspect: variant.aspect,
          enableTransitions,
          enableSpeedAccents,
          musicDurationSec: variant.durationSec,
          musicSourceStartSec: variant.musicStartSec,
          ...(includeMusic ? { musicPath: sourcePath } : {}),
        }, false), `${variant.label}-byggingen`);
        if (!timeline.timelineCreated || !timeline.timelineUniqueId || (timeline.segmentsPlaced ?? 0) < 1) {
          throw new Error(`${variant.label} mangler bekreftet timeline-ID eller plasserte segmenter.`);
        }

        let lookMessage = "Look ikke aktivert.";
        if (applyLook) {
          setStatus(`Grader ${variant.label} med ${selectedLookLabel} …`);
          try {
            const look = summaryResult<{
              clipsProcessed?: number;
              skippedExisting?: number;
              errorCount?: number;
            }>(await executeScript("apply_music_video_look", {
              lookPack: selectedLookId,
              timelineUniqueId: timeline.timelineUniqueId,
              timelineName: timeline.timelineName,
              projectId: prepared.projectId,
              respectExistingWork: true,
            }, false), "Resolve-look");
            lookMessage = `${look.clipsProcessed ?? 0} klipp gradet`;
            if ((look.skippedExisting ?? 0) > 0) lookMessage += ` · ${look.skippedExisting} eksisterende grades bevart`;
            if ((look.errorCount ?? 0) > 0) lookMessage += ` · ${look.errorCount} feil`;
          } catch (lookError) {
            lookMessage = `Look kunne ikke anvendes: ${lookError instanceof Error ? lookError.message : String(lookError)}`;
          }
        }

        let qcMessage = "QC ikke aktivert.";
        let qcIssueCount: number | null = null;
        if (runQc) {
          setStatus(`Kjører teknisk, farge- og lyd-QC på ${variant.label} …`);
          try {
            const sweep = summaryResult<{ counts?: Record<string, number> }>(
              await executeScript("technical_qc", { mode: "sweep", markers: false }, false),
              "Teknisk QC",
            );
            const color = summaryResult<{ ungradedItems?: number; lutsMissing?: unknown[] }>(
              await executeScript("technical_qc", { mode: "color", maxItems: 200 }, false),
              "Farge-QC",
            );
            const audio = summaryResult<{ clippedCandidates?: unknown[] }>(
              await executeScript("technical_qc", { mode: "audiopeak", maxFiles: 8 }, false),
              "Lyd-QC",
            );
            qcIssueCount = Object.values(sweep.counts ?? {}).reduce((sum, count) => sum + count, 0)
              + (color.ungradedItems ?? 0)
              + (color.lutsMissing?.length ?? 0)
              + (audio.clippedCandidates?.length ?? 0);
            qcMessage = qcIssueCount === 0 ? "Teknisk QC, farge og lyd er ren." : `${qcIssueCount} QC-funn må gjennomgås.`;
          } catch (qcError) {
            qcMessage = `Timeline bygget; QC ble ufullstendig: ${qcError instanceof Error ? qcError.message : String(qcError)}`;
          }
        }

        built.push({
          variantId: variant.id,
          variantLabel: variant.label,
          timelineName: timeline.timelineName ?? `${timelineName} — ${variant.timelineSuffix}`,
          timelineUniqueId: timeline.timelineUniqueId,
          segmentsPlaced: timeline.segmentsPlaced ?? 0,
          segmentsSkipped: timeline.segmentsSkipped ?? 0,
          transitionsAdded: timeline.transitionsAdded ?? 0,
          speedChangesApplied: timeline.speedChangesApplied ?? 0,
          musicAdded: Boolean(timeline.musicAdded),
          musicTrack: timeline.musicTrack ?? null,
          lookMessage,
          qcMessage,
          qcIssueCount,
        });
      }

      setBuildSession({ operationId: id, projectId: prepared.projectId, variants: built, rolledBack: false });
      setApproved(false);
      setStatus("");
    } catch (buildError) {
      if (built.length > 0) {
        setBuildSession({ operationId: id, projectId: prepared.projectId, variants: built, rolledBack: false });
      }
      setError(
        `Byggingen ble stoppet: ${buildError instanceof Error ? buildError.message : String(buildError)} `
        + (built.length > 0 ? "Bruk «Angre denne builden» for å fjerne variantene som allerede ble opprettet." : "Ingen bekreftet timeline ble registrert."),
      );
      setStatus("");
    } finally {
      setBuilding(false);
    }
  };

  const rollbackBuild = async () => {
    if (!buildSession || buildSession.rolledBack || rollingBack || building) return;
    const confirmed = window.confirm(
      `Slett ${buildSession.variants.length} timelines opprettet av denne Music Video-builden? Kildemateriale og eldre timelines berøres ikke.`,
    );
    if (!confirmed) return;
    setRollingBack(true);
    setError(null);
    try {
      setStatus("Verifiserer prosjekt og eksakte timeline-ID-er før rollback …");
      const result = summaryResult<{ deletedCount?: number }>(await executeScript("rollback_music_video_build", {
        operationId: buildSession.operationId,
        projectId: buildSession.projectId,
        timelines: buildSession.variants.map((variant) => ({
          uniqueId: variant.timelineUniqueId,
          name: variant.timelineName,
        })),
      }, false), "Rollback");
      setBuildSession({ ...buildSession, rolledBack: true });
      setStatus(`${result.deletedCount ?? buildSession.variants.length} timelines ble fjernet.`);
    } catch (rollbackError) {
      setError(`Rollback stoppet: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
      setStatus("");
    } finally {
      setRollingBack(false);
    }
  };

  const toggleVariant = (id: MusicVideoVariantId) => {
    setSelectedVariantIds((current) => current.includes(id)
      ? current.filter((candidate) => candidate !== id)
      : [...current, id]);
  };
  const previewVariant = variants.find((variant) => variant.id === previewVariantId) ?? variants[0];
  const editorOptions: Array<{
    checked: boolean;
    setChecked: (value: boolean) => void;
    label: string;
    detail: string;
  }> = [
    {
      checked: enablePerformanceSync,
      setChecked: (value) => {
        setEnablePerformanceSync(value);
        setPrepared(null);
      },
      label: "Performance/lip-sync",
      detail: "Audio-match takes mot masterlåten",
    },
    { checked: enableTransitions, setChecked: setEnableTransitions, label: "Native transitions", detail: "Cross Dissolve på rolige seksjonsgrenser" },
    { checked: enableSpeedAccents, setChecked: setEnableSpeedAccents, label: "Speed-accenter", detail: "Resolve 21.1 SetSpeed på utvalgte drops" },
    { checked: applyLook, setChecked: setApplyLook, label: `Resolve-look: ${selectedLookLabel}`, detail: "LUT på node 1; eksisterende grades bevares" },
    { checked: includeMusic, setChecked: setIncludeMusic, label: "Masterlåt på eget spor", detail: "Kamera-lyd beholdes synlig, men dempes" },
    { checked: runQc, setChecked: setRunQc, label: "Full Music Video-QC", detail: "Media, gaps, flash-frames, farge og lydpeak" },
  ];

  return (
    <div className="modal-backdrop anim-fade-in" style={{ zIndex: 5000 }} onClick={!busy ? onClose : undefined}>
      <div
        className="modal anim-slide-up"
        role="dialog"
        aria-label="Music Video Editor"
        onClick={(event) => event.stopPropagation()}
        style={{ width: "min(96vw, 980px)", maxHeight: "92vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0 }}>Music Video Editor v2</h2>
            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 5 }}>
              Analyse → coverage → 3 storyboards → godkjenning → native Resolve-build → QC → rollback
            </div>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Lukk Music Video Editor">×</button>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 13 }}>
          <div style={{ background: "var(--bg-3)", padding: 12, borderRadius: 8, fontSize: 12 }}>
            <strong>{plan.summary.sourceName}</strong>
            <span style={{ opacity: 0.72 }}> · {bpm} BPM i editor · {genre || "genre ikke satt"} · {selectedLookLabel}</span>
          </div>

          <label style={{ display: "grid", gap: 5, fontSize: 12 }}>
            <span>Basisnavn for nye Resolve-timelines</span>
            <input value={timelineName} disabled={controlsLocked} onChange={(event) => setTimelineName(event.target.value)} maxLength={81} />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))", gap: 8, fontSize: 11.5 }}>
            {editorOptions.map((option) => (
              <label key={option.label} style={{ display: "flex", gap: 8, padding: 9, background: "var(--bg-3)", borderRadius: 7 }}>
                <input
                  type="checkbox"
                  checked={option.checked}
                  disabled={controlsLocked}
                  onChange={(event) => option.setChecked(event.target.checked)}
                />
                <span><strong>{option.label}</strong><span style={{ display: "block", opacity: 0.62 }}>{option.detail}</span></span>
              </label>
            ))}
          </div>

          <button className="primary" onClick={() => void preparePlan()} disabled={!sourcePath || controlsLocked}>
            {preparing ? "Analyserer hele musikkvideoen …" : prepared ? "Analyser hele planen på nytt" : "Analyser + lag 3 storyboards"}
          </button>
          {status && <div aria-live="polite" style={{ fontSize: 12, color: "var(--accent)" }}>{status}</div>}

          {prepared && (
            <>
              <section style={{ background: "var(--bg-3)", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <strong>Coverage-analyse · {prepared.projectName}</strong>
                  <strong style={{ color: prepared.bundle.coverage.score >= 70 ? "#4ad48a" : "#f0a500" }}>
                    {prepared.bundle.coverage.score}/100
                  </strong>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 7, marginTop: 10 }}>
                  {prepared.bundle.coverage.checks.map((check) => (
                    <div key={check.id} style={{ fontSize: 10.5, borderLeft: `3px solid ${check.status === "ok" ? "#4ad48a" : check.status === "warning" ? "#f0a500" : "#ef4f6f"}`, paddingLeft: 8 }}>
                      <strong>{check.label}</strong><span style={{ display: "block", opacity: 0.68 }}>{check.detail}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <strong style={{ fontSize: 12 }}>Alternative edits</strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8, marginTop: 7 }}>
                  {variants.map((variant) => (
                    <label key={variant.id} style={{ padding: 10, borderRadius: 8, background: "var(--bg-3)", border: selectedVariantIds.includes(variant.id) ? "1px solid #4ad48a" : "1px solid var(--border)", fontSize: 11 }}>
                      <span style={{ display: "flex", gap: 8 }}>
                        <input type="checkbox" checked={selectedVariantIds.includes(variant.id)} disabled={controlsLocked} onChange={() => toggleVariant(variant.id)} />
                        <span><strong>{variant.label}</strong><span style={{ display: "block", opacity: 0.65 }}>{variant.description}</span></span>
                      </span>
                      <span style={{ display: "block", marginTop: 7, opacity: 0.72 }}>
                        {variant.segments.length} cuts · {variant.uniqueClipCount} klipp · {formatTime(variant.durationSec)} · {variant.aspect}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              {previewVariant && (
                <section style={{ background: "var(--bg-3)", borderRadius: 10, padding: 14 }} aria-label="Storyboard preview">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {variants.map((variant) => (
                      <button key={variant.id} onClick={() => setPreviewVariantId(variant.id)} disabled={busy} style={{ opacity: previewVariant.id === variant.id ? 1 : 0.55 }}>
                        {variant.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", height: 34, borderRadius: 5, overflow: "hidden", marginTop: 10 }}>
                    {previewVariant.segments.map((segment) => (
                      <div
                        key={`${segment.segmentIndex}-${segment.startSec}`}
                        title={`${formatTime(segment.startSec)} ${segment.section}: ${segment.clipName || segment.clipPath}`}
                        style={{
                          flexGrow: Math.max(0.05, segment.durationSec),
                          minWidth: 2,
                          background: SECTION_COLORS[segment.section ?? "other"] ?? SECTION_COLORS.other,
                          borderRight: "1px solid rgba(0,0,0,0.3)",
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 6, marginTop: 9 }}>
                    {previewVariant.segments.slice(0, 12).map((segment) => (
                      <div key={`${segment.segmentIndex}-card`} style={{ fontSize: 10, padding: 7, borderRadius: 5, background: "rgba(255,255,255,0.035)" }}>
                        <strong>{formatTime(segment.startSec)}–{formatTime(segment.endSec)}</strong> · {segment.section || "other"}
                        <span style={{ display: "block", opacity: 0.65, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{segment.clipName || segment.clipPath}</span>
                        <span style={{ opacity: 0.55 }}>
                          {segment.matchConfidence != null ? `sync ${Math.round(segment.matchConfidence * 100)}% · ` : ""}
                          {(segment.speedPct ?? 100) !== 100 ? `${segment.speedPct}% speed · ` : ""}
                          {segment.transition === "cross_dissolve" ? "dissolve" : "cut"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {previewVariant.segments.length > 12 && <div style={{ fontSize: 10, opacity: 0.55, marginTop: 7 }}>+ {previewVariant.segments.length - 12} segmenter i timeline-planen</div>}
                </section>
              )}

              <section style={{ background: "var(--bg-3)", border: `1px solid ${plan.readiness === "ready" ? "rgba(74,212,138,0.5)" : "rgba(240,165,0,0.5)"}`, borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>Godkjennbar Resolve-plan</strong>
                  <span style={{ color: plan.readiness === "ready" ? "#4ad48a" : "#f0a500", fontSize: 10, fontWeight: 700 }}>{plan.readiness === "ready" ? "KLAR" : "BLOKKERT"}</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.72, marginTop: 5 }}>
                  {plan.summary.bpm?.toFixed(1)} BPM · {plan.summary.beatCount} beats · {plan.summary.sectionCount} seksjoner · {plan.summary.selectedVariantCount} timelines
                </div>
                <div style={{ display: "grid", gap: 7, marginTop: 11 }}>
                  {plan.steps.map((step) => (
                    <div key={step.id} style={{ display: "grid", gridTemplateColumns: "18px 1fr auto", gap: 8, opacity: step.enabled ? 1 : 0.42, fontSize: 11 }}>
                      <span>{step.enabled ? "✓" : "—"}</span>
                      <span><strong>{step.label}</strong><span style={{ display: "block", opacity: 0.68 }}>{step.description}</span></span>
                      <span style={{ fontSize: 9, opacity: 0.72 }}>{step.mode === "read-only" ? "KUN LESING" : step.mode === "conditional-write" ? "VED BEHOV" : "SKRIVER"}</span>
                    </div>
                  ))}
                </div>
                {plan.blockers.length > 0 && <div style={{ borderLeft: "3px solid #ef4f6f", padding: "7px 9px", marginTop: 10, fontSize: 11 }}>{plan.blockers.map((blocker) => <div key={blocker}>• {blocker}</div>)}</div>}
                {plan.warnings.length > 0 && <div style={{ marginTop: 9, fontSize: 10.5, opacity: 0.72 }}>{plan.warnings.map((warning) => <div key={warning}>⚠ {warning}</div>)}</div>}
                <label style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 11, fontSize: 11.5 }}>
                  <input type="checkbox" checked={approved} disabled={plan.readiness !== "ready" || controlsLocked} onChange={(event) => setApproved(event.target.checked)} />
                  <span>Jeg godkjenner de valgte timeline-, treatment-, look- og QC-operasjonene. Eksisterende timelines og manuelle grades overskrives ikke.</span>
                </label>
                <button className="primary" onClick={() => void buildInResolve()} disabled={!approved || plan.readiness !== "ready" || controlsLocked} style={{ width: "100%", marginTop: 12 }}>
                  {building ? "Bygger Music Video-pakken i Resolve …" : `Godkjenn + bygg ${plan.summary.selectedVariantCount} timelines →`}
                </button>
              </section>
            </>
          )}

          {buildSession && (
            <section style={{ background: buildSession.rolledBack ? "rgba(240,165,0,0.10)" : "rgba(74,212,138,0.10)", border: "1px solid rgba(74,212,138,0.35)", borderRadius: 8, padding: 12, fontSize: 11 }}>
              <strong>{buildSession.rolledBack ? "Builden er angret" : `✓ ${buildSession.variants.length} Music Video-timelines opprettet`}</strong>
              {!buildSession.rolledBack && buildSession.variants.map((variant) => (
                <div key={variant.timelineUniqueId} style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                  <strong>«{variant.timelineName}»</strong>
                  <span style={{ display: "block", opacity: 0.75 }}>
                    {variant.segmentsPlaced} cuts · {variant.transitionsAdded} transitions · {variant.speedChangesApplied} speed-accenter · {variant.musicAdded ? `musikk ${variant.musicTrack}` : "uten musikk"}
                  </span>
                  <span style={{ display: "block", opacity: 0.68 }}>{variant.lookMessage} · {variant.qcMessage}</span>
                </div>
              ))}
              {!buildSession.rolledBack && (
                <button onClick={() => void rollbackBuild()} disabled={busy} style={{ marginTop: 11, color: "#ef8ba0" }}>
                  {rollingBack ? "Angrer build …" : "Angre denne builden"}
                </button>
              )}
            </section>
          )}
          {error && <div role="alert" className="dialog-warning">{error}</div>}
        </div>
      </div>
    </div>
  );
}
