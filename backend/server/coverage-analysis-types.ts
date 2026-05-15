/**
 * coverage-analysis-types.ts
 *
 * Felles typer for analyse-pipelinen. Hver stage implementerer
 * AnalyzerStage&lt;TResult&gt; og leser/skriver via StageContext.
 *
 * Designprinsipper:
 *   - Stages er lego-blokker: bytte ut ASR-implementasjon påvirker bare
 *     den stagen, ikke resten av pipelinen.
 *   - Stages kan feile uten å bryte pipelinen — returnerer StageOutcome
 *     med ok=false. Senere stages som krever forrige sin output
 *     hopper over.
 *   - StageContext akkumulerer resultater så senere stages kan lese
 *     tidligere (typed access via context.audioAnalysis etc.).
 *   - Hver stage har sin egen version-streng — pinnes per release, og
 *     re-analyse trigges når en stages versjon endrer seg.
 */

import type { CastingTake } from "./coverage-take-service.js";

// ─────────────────────────────────────────────────────────────────────
// Stage-resultater (én per analyse-domene)
// ─────────────────────────────────────────────────────────────────────

export interface ProbeResult {
  durationSec: number;
  videoCodec?: string;
  videoWidth?: number;
  videoHeight?: number;
  videoFps?: number;
  audioCodec?: string;
  audioSampleRate?: number;
  audioChannels?: number;
  bitrateKbps?: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speakerId?: string;
}

export interface AudioAnalysisResult {
  /** WhisperX-segmenter med tidstempler */
  transcript: TranscriptSegment[];
  language: string;
  /** Speakers diarisert (om pyannote er tilgjengelig) */
  speakerCount?: number;

  /** Audio-kvalitet — alle 0..1 hvor 1 er best */
  signalToNoiseRatio?: number;
  clippingScore?: number;     // 1 = ingen clipping, 0 = mye clipping
  loudnessLufs?: number;      // raw LUFS-verdi (referanse: -23 LUFS broadcast)

  /** Dialog-nøyaktighet mot manuskript (0..1) hvis script tilgjengelig */
  dialogueAccuracy?: number;
  matchedScriptText?: string;
}

export interface VisualFrame {
  /** Tidspunkt i sekunder */
  timestamp: number;
  /** R2-key for sampled frame (eller stub) */
  frameKey: string;
  /** Claude vision-output for denne framen */
  focusScore?: number;        // 0..1
  framingScore?: number;      // 0..1
  exposureScore?: number;     // 0..1
  notes?: string;
}

export interface VisualAnalysisResult {
  frames: VisualFrame[];
  /** Vektet aggregat over frames */
  overallFocusScore?: number;
  overallFramingScore?: number;
  overallExposureScore?: number;
  /** Visual-related issues funnet — for review */
  issues?: string[];
}

export interface PerformanceResult {
  /** Overall claude-vurdering av karakter-arbeidet */
  emotionalRange?: number;    // 0..1
  pacing?: number;            // 0..1
  naturalness?: number;       // 0..1
  energy?: number;            // 0..1
  /** Kvalitative notater */
  notes?: string;
  /** Eventuelle issues — "skuespiller bryter ut av karakter ved 0:34" */
  issues?: string[];
}

// ─────────────────────────────────────────────────────────────────────
// Composite-scoring
// ─────────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  audio?: number;
  visual?: number;
  performance?: number;
}

export interface CompositeScore {
  overall: number;
  breakdown: ScoreBreakdown;
}

// ─────────────────────────────────────────────────────────────────────
// StageContext + stage-interface
// ─────────────────────────────────────────────────────────────────────

export interface StageContext {
  take: CastingTake;
  /** Lokal temp-katalog for downloaded media + ekstraherte artefakter */
  tempDir: string;
  /** Sti til media-fil (etter download fra R2) */
  localMediaPath?: string;
  /** Eventuell scenetekst for å validere dialog mot manuskript */
  scriptText?: string;

  // Stage-resultater fylles inn etter hvert
  probe?: ProbeResult;
  audioAnalysis?: AudioAnalysisResult;
  visualAnalysis?: VisualAnalysisResult;
  performance?: PerformanceResult;
}

export type StageOutcome<TResult> =
  | { ok: true; result: TResult; durationMs: number }
  | { ok: false; error: string; durationMs: number };

export interface AnalyzerStage<TResult> {
  name: string;
  version: string;
  /** Hvilke andre stages må ha kjørt vellykket før denne kan kjøre */
  requires?: Array<keyof StageContext>;
  run(ctx: StageContext): Promise<StageOutcome<TResult>>;
}

// ─────────────────────────────────────────────────────────────────────
// Persist-state per stage (lagres på casting_take_analysis.stage_status)
// ─────────────────────────────────────────────────────────────────────

export interface StageStatusEntry {
  ok: boolean;
  error?: string;
  durationMs: number;
  version: string;
}

export type StageStatusMap = Record<string, StageStatusEntry>;

/** Aggregert versjon — settes når en hvilken som helst stage endres */
export const ANALYZER_PIPELINE_VERSION = "v1.0.0";
