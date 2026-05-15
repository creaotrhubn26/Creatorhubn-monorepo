/**
 * coverage-analysis-stages.ts
 *
 * Konkrete implementasjoner av alle analyse-stages. Hver stage er en
 * selvstendig enhet med stabilt input/output-skjema og egen versjon.
 *
 * Stages:
 *   1. probeStage              — ffprobe → media-metadata
 *   2. audioExtractStage       — ffmpeg → wav 16kHz mono (i tempDir)
 *   3. asrStage                — WhisperX HTTP API → transcript
 *   4. audioQualityStage       — ffmpeg ebur128 + statistics → SNR/loudness
 *   5. frameSamplingStage      — ffmpeg → JPEGs ved intervaller
 *   6. visualAnalysisStage     — Claude vision per frame → focus/framing/exposure
 *   7. performanceAnalysisStage — Claude (transcript + frames) → emosjon/tempo
 *
 * Hver stage:
 *   - Returnerer StageOutcome (ok | feil)
 *   - Skriver til StageContext så senere stages kan lese
 *   - Logger sin durationMs for telemetri
 *
 * Stages er IDEMPOTENTE — å kjøre samme stage to ganger gir samme resultat
 * (med mindre eksterne services som Claude er ikke-deterministiske).
 */

import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import type {
  AnalyzerStage,
  AudioAnalysisResult,
  PerformanceResult,
  ProbeResult,
  StageContext,
  StageOutcome,
  TranscriptSegment,
  VisualAnalysisResult,
  VisualFrame,
} from "./coverage-analysis-types.js";

// ─────────────────────────────────────────────────────────────────────
// Felles helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Run en ekstern kommando og returner stdout. Brukes for ffmpeg/ffprobe.
 * Kaster med både exit-code og stderr ved feil.
 */
function runCommand(
  cmd: string,
  args: string[],
  timeoutMs = 120_000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`));
      }
    });
  });
}

async function timed<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

// ─────────────────────────────────────────────────────────────────────
// Stage 1: probe (ffprobe)
// ─────────────────────────────────────────────────────────────────────

export const probeStage: AnalyzerStage<ProbeResult> = {
  name: "probe",
  version: "v1",

  async run(ctx: StageContext): Promise<StageOutcome<ProbeResult>> {
    if (!ctx.localMediaPath) {
      return { ok: false, error: "localMediaPath mangler", durationMs: 0 };
    }
    try {
      const { result, durationMs } = await timed(async () => {
        const { stdout } = await runCommand("ffprobe", [
          "-v", "error",
          "-print_format", "json",
          "-show_format",
          "-show_streams",
          ctx.localMediaPath!,
        ], 30_000);
        const data = JSON.parse(stdout);
        const videoStream = (data.streams ?? []).find((s: any) => s.codec_type === "video");
        const audioStream = (data.streams ?? []).find((s: any) => s.codec_type === "audio");

        const result: ProbeResult = {
          durationSec: parseFloat(data.format?.duration ?? "0") || 0,
        };
        if (videoStream) {
          result.videoCodec = videoStream.codec_name;
          result.videoWidth = videoStream.width;
          result.videoHeight = videoStream.height;
          // Eval fps fra "30/1" eller "30000/1001"
          const fpsParts = String(videoStream.r_frame_rate ?? "").split("/");
          if (fpsParts.length === 2) {
            const num = parseFloat(fpsParts[0]);
            const den = parseFloat(fpsParts[1]);
            if (den > 0) result.videoFps = num / den;
          }
        }
        if (audioStream) {
          result.audioCodec = audioStream.codec_name;
          result.audioSampleRate = audioStream.sample_rate
            ? parseInt(audioStream.sample_rate, 10)
            : undefined;
          result.audioChannels = audioStream.channels;
        }
        if (data.format?.bit_rate) {
          result.bitrateKbps = Math.round(parseInt(data.format.bit_rate, 10) / 1000);
        }
        return result;
      });

      ctx.probe = result;
      return { ok: true, result, durationMs };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────
// Stage 2: audio-extract (ffmpeg → wav)
// ─────────────────────────────────────────────────────────────────────

const AUDIO_WAV_FILENAME = "audio-16k-mono.wav";

export const audioExtractStage: AnalyzerStage<{ wavPath: string }> = {
  name: "audio-extract",
  version: "v1",
  requires: ["probe"],

  async run(ctx: StageContext): Promise<StageOutcome<{ wavPath: string }>> {
    if (!ctx.localMediaPath) {
      return { ok: false, error: "localMediaPath mangler", durationMs: 0 };
    }
    if (!ctx.probe?.audioCodec) {
      return { ok: false, error: "Ingen audio-spor", durationMs: 0 };
    }

    const wavPath = path.join(ctx.tempDir, AUDIO_WAV_FILENAME);
    try {
      const { durationMs } = await timed(async () => {
        // WhisperX foretrekker 16kHz mono wav
        await runCommand("ffmpeg", [
          "-i", ctx.localMediaPath!,
          "-vn",                         // ingen video
          "-ac", "1",                    // mono
          "-ar", "16000",                // 16kHz
          "-c:a", "pcm_s16le",
          "-y",                          // overskriv
          wavPath,
        ], 120_000);
      });
      return { ok: true, result: { wavPath }, durationMs };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────
// Stage 3: ASR (WhisperX HTTP)
// ─────────────────────────────────────────────────────────────────────

const WHISPERX_URL = process.env.WHISPERX_TRANSCRIPTION_URL || "http://localhost:5003";
const ASR_TIMEOUT_MS = parseInt(process.env.COVERAGE_ASR_TIMEOUT_MS || "600000", 10);

export interface AsrStageInput {
  wavPath: string;
}

export const asrStage: AnalyzerStage<{ transcript: TranscriptSegment[]; language: string }> = {
  name: "asr",
  version: "v1",

  async run(ctx: StageContext): Promise<StageOutcome<{ transcript: TranscriptSegment[]; language: string }>> {
    const wavPath = path.join(ctx.tempDir, AUDIO_WAV_FILENAME);
    try {
      // Sjekk om wav-filen finnes (audio-extract må ha kjørt)
      await fs.access(wavPath);
    } catch {
      return { ok: false, error: "audio-extract output mangler", durationMs: 0 };
    }

    try {
      const { result, durationMs } = await timed(async () => {
        const audioBuffer = await fs.readFile(wavPath);
        const form = new FormData();
        const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/wav" });
        form.append("file", blob, AUDIO_WAV_FILENAME);
        form.append("response_format", "verbose_json");
        form.append("timestamp_granularities", "segment");

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ASR_TIMEOUT_MS);
        let payload: any;
        try {
          const response = await fetch(`${WHISPERX_URL}/v1/audio/transcriptions`, {
            method: "POST",
            body: form,
            signal: controller.signal,
          });
          if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw new Error(`WhisperX ${response.status}: ${body.slice(0, 300)}`);
          }
          payload = await response.json();
        } finally {
          clearTimeout(timer);
        }

        const segments: TranscriptSegment[] = Array.isArray(payload?.segments)
          ? payload.segments.map((s: any) => ({
              start: typeof s.start === "number" ? s.start : 0,
              end: typeof s.end === "number" ? s.end : 0,
              text: typeof s.text === "string" ? s.text.trim() : "",
            })).filter((s: TranscriptSegment) => s.text.length > 0)
          : [];

        return {
          transcript: segments,
          language: typeof payload?.language === "string" ? payload.language : "auto",
        };
      });

      ctx.audioAnalysis = {
        ...(ctx.audioAnalysis ?? { transcript: [], language: "auto" }),
        transcript: result.transcript,
        language: result.language,
      };
      return { ok: true, result, durationMs };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────
// Stage 4: audio-quality (ffmpeg ebur128 + astats)
// ─────────────────────────────────────────────────────────────────────

export const audioQualityStage: AnalyzerStage<{
  signalToNoiseRatio?: number;
  clippingScore?: number;
  loudnessLufs?: number;
}> = {
  name: "audio-quality",
  version: "v1",

  async run(ctx) {
    const wavPath = path.join(ctx.tempDir, AUDIO_WAV_FILENAME);
    try {
      await fs.access(wavPath);
    } catch {
      return { ok: false, error: "audio-extract output mangler", durationMs: 0 };
    }

    try {
      const { result, durationMs } = await timed(async () => {
        const { stderr } = await runCommand("ffmpeg", [
          "-i", wavPath,
          "-af", "ebur128=peak=true,astats=metadata=1:reset=0",
          "-f", "null",
          "-y",
          process.platform === "win32" ? "NUL" : "/dev/null",
        ], 60_000);

        // Parse ebur128-output: "I:   -23.5 LUFS"
        const lufsMatch = stderr.match(/I:\s+(-?\d+(?:\.\d+)?)\s+LUFS/);
        const loudnessLufs = lufsMatch ? parseFloat(lufsMatch[1]) : undefined;

        // Parse peak-level: "Peak:           -2.3 dBFS"
        const peakMatch = stderr.match(/Peak[^:]*:\s+(-?\d+(?:\.\d+)?)\s+dBFS/);
        const peakDbfs = peakMatch ? parseFloat(peakMatch[1]) : undefined;

        // Parse RMS — fra astats: "RMS level dB: -25.4"
        const rmsMatch = stderr.match(/RMS level dB:\s+(-?\d+(?:\.\d+)?)/);
        const rmsDb = rmsMatch ? parseFloat(rmsMatch[1]) : undefined;

        const result: {
          signalToNoiseRatio?: number;
          clippingScore?: number;
          loudnessLufs?: number;
        } = {};
        if (loudnessLufs !== undefined) result.loudnessLufs = loudnessLufs;

        // Clipping score: 1 = ingen clipping (peak < -1 dBFS), 0 = clipping (peak >= 0)
        if (peakDbfs !== undefined) {
          if (peakDbfs >= 0) result.clippingScore = 0;
          else if (peakDbfs >= -1) result.clippingScore = 0.3;
          else if (peakDbfs >= -3) result.clippingScore = 0.7;
          else result.clippingScore = 1.0;
        }

        // SNR: approximation via RMS vs noise floor. Vi har ikke ekte noise
        // floor, men typisk: hvis RMS er over -30 dB → bra signal, under -45 → svakt
        if (rmsDb !== undefined) {
          if (rmsDb >= -20) result.signalToNoiseRatio = 1.0;
          else if (rmsDb >= -30) result.signalToNoiseRatio = 0.8;
          else if (rmsDb >= -40) result.signalToNoiseRatio = 0.5;
          else result.signalToNoiseRatio = 0.2;
        }

        return result;
      });

      ctx.audioAnalysis = {
        ...(ctx.audioAnalysis ?? { transcript: [], language: "auto" }),
        ...result,
      };
      return { ok: true, result, durationMs };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────
// Stage 5: frame-sampling (ffmpeg)
// ─────────────────────────────────────────────────────────────────────

const FRAME_SAMPLE_COUNT = 6;

export const frameSamplingStage: AnalyzerStage<{ frames: Array<{ timestamp: number; path: string }> }> = {
  name: "frame-sampling",
  version: "v1",
  requires: ["probe"],

  async run(ctx) {
    if (!ctx.localMediaPath || !ctx.probe?.durationSec || ctx.probe.durationSec <= 0) {
      return { ok: false, error: "Probe/durationSec mangler", durationMs: 0 };
    }
    if (!ctx.probe.videoCodec) {
      return { ok: false, error: "Audio-only take — ingen frames å sample", durationMs: 0 };
    }

    try {
      const { result, durationMs } = await timed(async () => {
        const duration = ctx.probe!.durationSec;
        // Sample jevnt fordelt, men hopp over første og siste 5% (intro/outro)
        const start = duration * 0.05;
        const end = duration * 0.95;
        const step = (end - start) / (FRAME_SAMPLE_COUNT - 1);
        const frames: Array<{ timestamp: number; path: string }> = [];

        for (let i = 0; i < FRAME_SAMPLE_COUNT; i++) {
          const timestamp = start + step * i;
          const framePath = path.join(ctx.tempDir, `frame-${i.toString().padStart(2, "0")}.jpg`);
          await runCommand("ffmpeg", [
            "-ss", String(timestamp),
            "-i", ctx.localMediaPath!,
            "-frames:v", "1",
            "-q:v", "3",                 // høy kvalitet JPEG
            "-vf", "scale=1280:-2",      // ned-sample til 1280 wide for Claude vision
            "-y",
            framePath,
          ], 30_000);
          frames.push({ timestamp, path: framePath });
        }
        return { frames };
      });
      return { ok: true, result, durationMs };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────
// Stage 6: visual-analysis (Claude vision per frame)
// ─────────────────────────────────────────────────────────────────────

const VISUAL_TOOL_SCHEMA = {
  name: "score_frame",
  description: "Vurdér én frame fra et take. Returnér scores 0..1 hvor 1 er best.",
  input_schema: {
    type: "object",
    properties: {
      focusScore: {
        type: "number",
        description:
          "Er hovedmotivet i fokus? 1 = perfekt fokus, 0 = uskarpt eller " +
          "feil fokus-plan.",
      },
      framingScore: {
        type: "number",
        description:
          "Er framingen god? Rule of thirds, head-room, lead-room. " +
          "1 = velkomponert, 0 = ubalansert.",
      },
      exposureScore: {
        type: "number",
        description:
          "Eksponering. 1 = god eksponering, 0 = underbelyst/overbelyst.",
      },
      notes: {
        type: "string",
        description: "Kort observasjon (1 setning). Utelat hvis ingenting bemerkelsesverdig.",
      },
    },
    required: ["focusScore", "framingScore", "exposureScore"],
  },
} as const;

export const visualAnalysisStage: AnalyzerStage<VisualAnalysisResult> = {
  name: "visual-analysis",
  version: "v1",

  async run(ctx) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "ANTHROPIC_API_KEY mangler", durationMs: 0 };
    }

    // Hent samplede frames fra tempDir (etter frame-sampling-stage)
    let frameFiles: string[];
    try {
      const all = await fs.readdir(ctx.tempDir);
      frameFiles = all
        .filter((f) => f.startsWith("frame-") && f.endsWith(".jpg"))
        .sort();
    } catch (err) {
      return {
        ok: false,
        error: `Kunne ikke liste tempDir: ${err}`,
        durationMs: 0,
      };
    }
    if (frameFiles.length === 0) {
      return { ok: false, error: "Ingen samplede frames", durationMs: 0 };
    }

    try {
      const { result, durationMs } = await timed(async () => {
        const mod: any = await import("@anthropic-ai/sdk");
        const AnthropicCtor = mod.default ?? mod.Anthropic;
        const claude: any = new AnthropicCtor({ apiKey, maxRetries: 1, timeout: 30_000 });

        const frames: VisualFrame[] = [];
        for (const frameFile of frameFiles) {
          const framePath = path.join(ctx.tempDir, frameFile);
          const buffer = await fs.readFile(framePath);
          const base64 = buffer.toString("base64");

          // Hent timestamp fra filnavn-konvensjonen frame-NN.jpg
          const idx = parseInt(frameFile.replace(/^frame-(\d+)\.jpg$/, "$1"), 10);
          const timestamp = ctx.probe?.durationSec
            ? ctx.probe.durationSec * 0.05 +
              (ctx.probe.durationSec * 0.9 / (FRAME_SAMPLE_COUNT - 1)) * idx
            : 0;

          try {
            const response = await claude.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 256,
              tools: [VISUAL_TOOL_SCHEMA],
              tool_choice: { type: "tool", name: "score_frame" },
              messages: [{
                role: "user",
                content: [
                  {
                    type: "image",
                    source: { type: "base64", media_type: "image/jpeg", data: base64 },
                  },
                  {
                    type: "text",
                    text: "Vurdér denne framen fra et film-take. Kall score_frame.",
                  },
                ],
              }],
            });

            const tb = (response.content ?? []).find(
              (b: any) => b?.type === "tool_use" && b?.name === "score_frame",
            );
            const input = (tb?.input ?? {}) as Record<string, unknown>;
            frames.push({
              timestamp,
              frameKey: frameFile,
              focusScore: typeof input.focusScore === "number" ? clamp01(input.focusScore) : undefined,
              framingScore: typeof input.framingScore === "number" ? clamp01(input.framingScore) : undefined,
              exposureScore: typeof input.exposureScore === "number" ? clamp01(input.exposureScore) : undefined,
              notes: typeof input.notes === "string" ? input.notes : undefined,
            });
          } catch (err) {
            // Én frame-feil bryter ikke hele stage — bare hopp over
            console.warn(`[visual-analysis] frame ${frameFile} feilet:`, err);
          }
        }

        // Aggregat
        const focusScores = frames.map((f) => f.focusScore).filter((v): v is number => v != null);
        const framingScores = frames.map((f) => f.framingScore).filter((v): v is number => v != null);
        const exposureScores = frames.map((f) => f.exposureScore).filter((v): v is number => v != null);

        const avg = (xs: number[]) => xs.length === 0 ? undefined : xs.reduce((a, b) => a + b, 0) / xs.length;

        const result: VisualAnalysisResult = {
          frames,
          overallFocusScore: avg(focusScores),
          overallFramingScore: avg(framingScores),
          overallExposureScore: avg(exposureScores),
        };
        return result;
      });

      ctx.visualAnalysis = result;
      return { ok: true, result, durationMs };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────
// Stage 7: performance-analysis (Claude med transcript + frames)
// ─────────────────────────────────────────────────────────────────────

const PERFORMANCE_TOOL_SCHEMA = {
  name: "evaluate_performance",
  description:
    "Vurdér skuespiller-arbeidet basert på transkript + samplede frames. " +
    "Alle scores er 0..1 hvor 1 er best.",
  input_schema: {
    type: "object",
    properties: {
      emotionalRange: {
        type: "number",
        description: "Hvor varierte er emosjoner i takene? 1 = stor spennvidde.",
      },
      pacing: {
        type: "number",
        description: "Er rytmen god? 1 = naturlig, 0 = mekanisk eller dårlig.",
      },
      naturalness: {
        type: "number",
        description: "Føles det levd, eller resitert? 1 = levd.",
      },
      energy: {
        type: "number",
        description: "Er det engasjement bak? 1 = energisk og present.",
      },
      notes: { type: "string", description: "1-2 setninger om karakter-arbeidet." },
      issues: {
        type: "array",
        items: { type: "string" },
        description: "Konkrete problemer du så — f.eks. 'bryter ut av karakter ved 0:34'.",
      },
    },
    required: ["emotionalRange", "pacing", "naturalness", "energy"],
  },
} as const;

export const performanceAnalysisStage: AnalyzerStage<PerformanceResult> = {
  name: "performance-analysis",
  version: "v1",
  requires: ["audioAnalysis", "visualAnalysis"],

  async run(ctx) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "ANTHROPIC_API_KEY mangler", durationMs: 0 };
    }
    if (!ctx.audioAnalysis?.transcript || ctx.audioAnalysis.transcript.length === 0) {
      return { ok: false, error: "Ingen transcript fra ASR", durationMs: 0 };
    }

    try {
      const { result, durationMs } = await timed(async () => {
        const mod: any = await import("@anthropic-ai/sdk");
        const AnthropicCtor = mod.default ?? mod.Anthropic;
        const claude: any = new AnthropicCtor({ apiKey, maxRetries: 1, timeout: 60_000 });

        // Bygg transcript-tekst med timing
        const transcriptText = ctx.audioAnalysis!.transcript
          .map((s) => `[${s.start.toFixed(1)}s] ${s.text}`)
          .join("\n");

        // Sample 2-3 frames inn som visual-kontekst
        const sampleFrames = ctx.visualAnalysis?.frames.slice(0, 3) ?? [];
        const imageContent: any[] = [];
        for (const frame of sampleFrames) {
          try {
            const buf = await fs.readFile(path.join(ctx.tempDir, frame.frameKey));
            imageContent.push({
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: buf.toString("base64"),
              },
            });
          } catch {
            // ignore — kjør med færre frames
          }
        }

        const response = await claude.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 512,
          tools: [PERFORMANCE_TOOL_SCHEMA],
          tool_choice: { type: "tool", name: "evaluate_performance" },
          messages: [{
            role: "user",
            content: [
              ...imageContent,
              {
                type: "text",
                text: [
                  "Vurdér skuespiller-arbeidet i dette taket basert på sampled-",
                  "frames over og transkriptet under. Kall evaluate_performance.",
                  "",
                  "Transkript:",
                  transcriptText,
                ].join("\n"),
              },
            ],
          }],
        });

        const tb = (response.content ?? []).find(
          (b: any) => b?.type === "tool_use" && b?.name === "evaluate_performance",
        );
        const input = (tb?.input ?? {}) as Record<string, unknown>;
        const result: PerformanceResult = {
          emotionalRange: typeof input.emotionalRange === "number" ? clamp01(input.emotionalRange) : undefined,
          pacing: typeof input.pacing === "number" ? clamp01(input.pacing) : undefined,
          naturalness: typeof input.naturalness === "number" ? clamp01(input.naturalness) : undefined,
          energy: typeof input.energy === "number" ? clamp01(input.energy) : undefined,
          notes: typeof input.notes === "string" ? input.notes : undefined,
          issues: Array.isArray(input.issues)
            ? input.issues.filter((x): x is string => typeof x === "string")
            : undefined,
        };
        return result;
      });

      ctx.performance = result;
      return { ok: true, result, durationMs };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────
// Pipeline-konfig — rekkefølge stages skal kjøres i
// ─────────────────────────────────────────────────────────────────────

export const ALL_STAGES = [
  probeStage,
  audioExtractStage,
  asrStage,
  audioQualityStage,
  frameSamplingStage,
  visualAnalysisStage,
  performanceAnalysisStage,
] as const;
