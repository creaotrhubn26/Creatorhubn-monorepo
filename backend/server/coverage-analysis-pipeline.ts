/**
 * coverage-analysis-pipeline.ts
 *
 * Orchestrator som kjører alle stages for én take. Persisterer resultater
 * i casting_take_analysis og oppdaterer casting_takes.processing_status.
 *
 * Stage-strategi:
 *   - Kjør stages sekvensielt (audio-extract må komme før ASR, etc.)
 *   - Feil i én stage stopper IKKE pipelinen — vi kjører videre med
 *     resten og lagrer delvis resultat. Agentene leser hva som finnes.
 *   - Hver stage logger sin durationMs + ok/error i stage_status så
 *     vi kan diagnostisere i prod.
 *
 * Composite-scoring:
 *   - Vektet kombinasjon av audio/visual/performance
 *   - Standard-vekter: 0.3 audio, 0.4 visual, 0.3 performance
 *   - Hvis en kategori mangler, normaliseres vektene over de gjenværende
 */

import fs from "fs/promises";
import os from "os";
import path from "path";
import type { Pool } from "pg";
import { ALL_STAGES } from "./coverage-analysis-stages.js";
import {
  ANALYZER_PIPELINE_VERSION,
  type StageContext,
  type StageStatusMap,
  type CompositeScore,
  type AudioAnalysisResult,
  type VisualAnalysisResult,
  type PerformanceResult,
} from "./coverage-analysis-types.js";
import {
  downloadTakeMediaToTemp,
  getTake,
  type CastingTake,
} from "./coverage-take-service.js";

// ─────────────────────────────────────────────────────────────────────
// Composite-scoring
// ─────────────────────────────────────────────────────────────────────

const SCORE_WEIGHTS = {
  audio: 0.3,
  visual: 0.4,
  performance: 0.3,
} as const;

function computeAudioScore(a: AudioAnalysisResult | undefined): number | undefined {
  if (!a) return undefined;
  const parts: number[] = [];
  if (a.signalToNoiseRatio !== undefined) parts.push(a.signalToNoiseRatio);
  if (a.clippingScore !== undefined) parts.push(a.clippingScore);
  if (a.dialogueAccuracy !== undefined) parts.push(a.dialogueAccuracy);
  if (parts.length === 0) return undefined;
  return parts.reduce((s, v) => s + v, 0) / parts.length;
}

function computeVisualScore(v: VisualAnalysisResult | undefined): number | undefined {
  if (!v) return undefined;
  const parts: number[] = [];
  if (v.overallFocusScore !== undefined) parts.push(v.overallFocusScore);
  if (v.overallFramingScore !== undefined) parts.push(v.overallFramingScore);
  if (v.overallExposureScore !== undefined) parts.push(v.overallExposureScore);
  if (parts.length === 0) return undefined;
  return parts.reduce((s, v) => s + v, 0) / parts.length;
}

function computePerformanceScore(p: PerformanceResult | undefined): number | undefined {
  if (!p) return undefined;
  const parts: number[] = [];
  if (p.emotionalRange !== undefined) parts.push(p.emotionalRange);
  if (p.pacing !== undefined) parts.push(p.pacing);
  if (p.naturalness !== undefined) parts.push(p.naturalness);
  if (p.energy !== undefined) parts.push(p.energy);
  if (parts.length === 0) return undefined;
  return parts.reduce((s, v) => s + v, 0) / parts.length;
}

export function computeCompositeScore(ctx: StageContext): CompositeScore | undefined {
  const audio = computeAudioScore(ctx.audioAnalysis);
  const visual = computeVisualScore(ctx.visualAnalysis);
  const performance = computePerformanceScore(ctx.performance);

  // Re-normaliser vektene over kategoriene som faktisk har data
  const present: Array<[number, number]> = [];
  if (audio !== undefined) present.push([audio, SCORE_WEIGHTS.audio]);
  if (visual !== undefined) present.push([visual, SCORE_WEIGHTS.visual]);
  if (performance !== undefined) present.push([performance, SCORE_WEIGHTS.performance]);

  if (present.length === 0) return undefined;
  const totalWeight = present.reduce((s, [, w]) => s + w, 0);
  const overall = present.reduce((s, [score, w]) => s + (score * w / totalWeight), 0);

  return {
    overall,
    breakdown: { audio, visual, performance },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Pipeline-execution
// ─────────────────────────────────────────────────────────────────────

export interface RunAnalysisOptions {
  /** Override default scenetekst-lookup (for testing) */
  scriptText?: string;
}

export interface RunAnalysisResult {
  takeId: string;
  ok: boolean;
  stageStatus: StageStatusMap;
  compositeScore?: CompositeScore;
  errorMessage?: string;
  errorStage?: string;
}

export async function runAnalysisForTake(
  pool: Pool,
  takeId: string,
  options: RunAnalysisOptions = {},
): Promise<RunAnalysisResult> {
  const take = await getTake(pool, takeId);
  if (!take) {
    return {
      takeId,
      ok: false,
      stageStatus: {},
      errorMessage: "Take not found",
      errorStage: "preflight",
    };
  }
  if (!take.mediaKey) {
    return {
      takeId,
      ok: false,
      stageStatus: {},
      errorMessage: "media_key mangler — kan ikke laste ned",
      errorStage: "preflight",
    };
  }

  // Lag temp-dir for media + ekstraherte artefakter
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `take-analysis-${takeId}-`));
  let firstError: { stage: string; message: string } | undefined;

  try {
    // Last ned media fra R2
    const mediaExtension = take.mediaKey.split(".").pop() ?? "bin";
    const localMediaPath = path.join(tempDir, `media.${mediaExtension}`);
    const downloaded = await downloadTakeMediaToTemp(take.mediaKey, localMediaPath);
    if (!downloaded) {
      return {
        takeId,
        ok: false,
        stageStatus: {},
        errorMessage: "R2-download feilet",
        errorStage: "download",
      };
    }

    const ctx: StageContext = {
      take,
      tempDir,
      localMediaPath,
      scriptText: options.scriptText,
    };

    const stageStatus: StageStatusMap = {};
    for (const stage of ALL_STAGES) {
      // Sjekk requires — hvis en avhengighet ikke fylte ut ctx, hopp over
      if (stage.requires) {
        const ctxRecord = ctx as unknown as Record<string, unknown>;
        const missing = stage.requires.find((key) => ctxRecord[key] === undefined);
        if (missing) {
          stageStatus[stage.name] = {
            ok: false,
            error: `dependency mangler: ${String(missing)}`,
            durationMs: 0,
            version: stage.version,
          };
          continue;
        }
      }

      try {
        const outcome = await stage.run(ctx);
        if (outcome.ok) {
          stageStatus[stage.name] = {
            ok: true,
            durationMs: outcome.durationMs,
            version: stage.version,
          };
        } else {
          stageStatus[stage.name] = {
            ok: false,
            error: outcome.error,
            durationMs: outcome.durationMs,
            version: stage.version,
          };
          if (!firstError) {
            firstError = { stage: stage.name, message: outcome.error };
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        stageStatus[stage.name] = {
          ok: false,
          error: message,
          durationMs: 0,
          version: stage.version,
        };
        if (!firstError) {
          firstError = { stage: stage.name, message };
        }
      }
    }

    const composite = computeCompositeScore(ctx);

    // Persist results — UPSERT i casting_take_analysis
    await pool.query(
      `INSERT INTO casting_take_analysis
         (take_id, project_id, probe, audio_analysis, visual_analysis,
          performance, overall_score, score_breakdown, analyzer_version,
          analyzed_at, stage_status, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, NOW(), NOW())
       ON CONFLICT (take_id) DO UPDATE SET
         probe            = EXCLUDED.probe,
         audio_analysis   = EXCLUDED.audio_analysis,
         visual_analysis  = EXCLUDED.visual_analysis,
         performance      = EXCLUDED.performance,
         overall_score    = EXCLUDED.overall_score,
         score_breakdown  = EXCLUDED.score_breakdown,
         analyzer_version = EXCLUDED.analyzer_version,
         analyzed_at      = EXCLUDED.analyzed_at,
         stage_status     = EXCLUDED.stage_status,
         updated_at       = NOW()`,
      [
        take.id,
        take.projectId,
        ctx.probe ? JSON.stringify(ctx.probe) : null,
        ctx.audioAnalysis ? JSON.stringify(ctx.audioAnalysis) : null,
        ctx.visualAnalysis ? JSON.stringify(ctx.visualAnalysis) : null,
        ctx.performance ? JSON.stringify(ctx.performance) : null,
        composite?.overall ?? null,
        composite ? JSON.stringify(composite.breakdown) : null,
        ANALYZER_PIPELINE_VERSION,
        JSON.stringify(stageStatus),
      ],
    );

    // Oppdater take.processing_status: 'analyzed' hvis minst én stage var ok,
    // 'failed' hvis ALLE stages feilet
    const anyOk = Object.values(stageStatus).some((s) => s.ok);
    const newStatus = anyOk ? "analyzed" : "failed";
    await pool.query(
      `UPDATE casting_takes
       SET processing_status = $2, updated_at = NOW()
       WHERE id = $1`,
      [take.id, newStatus],
    );

    return {
      takeId: take.id,
      ok: anyOk,
      stageStatus,
      compositeScore: composite,
      errorMessage: firstError?.message,
      errorStage: firstError?.stage,
    };
  } finally {
    // Best-effort: ryd opp tempDir uansett. fs.rm med recursive+force.
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.warn("[coverage-pipeline] tempDir cleanup failed:", err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Query helpers (brukes av agentene)
// ─────────────────────────────────────────────────────────────────────

export interface TakeAnalysisRow {
  takeId: string;
  projectId: string;
  probe: unknown;
  audioAnalysis: AudioAnalysisResult | null;
  visualAnalysis: VisualAnalysisResult | null;
  performance: PerformanceResult | null;
  overallScore: number | null;
  scoreBreakdown: Record<string, number> | null;
  analyzerVersion: string;
  analyzedAt: string;
}

interface RawAnalysisRow {
  take_id: string;
  project_id: string;
  probe: unknown;
  audio_analysis: unknown;
  visual_analysis: unknown;
  performance: unknown;
  overall_score: string | number | null;
  score_breakdown: unknown;
  analyzer_version: string;
  analyzed_at: Date;
}

function rowToAnalysis(row: RawAnalysisRow): TakeAnalysisRow {
  return {
    takeId: row.take_id,
    projectId: row.project_id,
    probe: row.probe,
    audioAnalysis: (row.audio_analysis as AudioAnalysisResult | null) ?? null,
    visualAnalysis: (row.visual_analysis as VisualAnalysisResult | null) ?? null,
    performance: (row.performance as PerformanceResult | null) ?? null,
    overallScore: row.overall_score != null ? Number(row.overall_score) : null,
    scoreBreakdown: (row.score_breakdown as Record<string, number> | null) ?? null,
    analyzerVersion: row.analyzer_version,
    analyzedAt: row.analyzed_at.toISOString(),
  };
}

export async function getAnalysisForTake(
  pool: Pool,
  takeId: string,
): Promise<TakeAnalysisRow | null> {
  const r = await pool.query<RawAnalysisRow>(
    `SELECT * FROM casting_take_analysis WHERE take_id = $1`,
    [takeId],
  );
  return r.rows[0] ? rowToAnalysis(r.rows[0]) : null;
}

export async function listAnalysesForTakes(
  pool: Pool,
  takeIds: string[],
): Promise<TakeAnalysisRow[]> {
  if (takeIds.length === 0) return [];
  const r = await pool.query<RawAnalysisRow>(
    `SELECT * FROM casting_take_analysis WHERE take_id = ANY($1::uuid[])`,
    [takeIds],
  );
  return r.rows.map(rowToAnalysis);
}

/** Hjelper for å bygge en lookup map<takeId, take> */
export function takesById(takes: CastingTake[]): Map<string, CastingTake> {
  return new Map(takes.map((t) => [t.id, t]));
}
