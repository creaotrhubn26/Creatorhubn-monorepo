#!/usr/bin/env tsx

import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// -----------------------------
// Types
// -----------------------------

type DeliveryProfile =
  | 'adaptive'
  | 'netflix'
  | 'ebu_r128'
  | 'atsc_a85'
  | 'streaming_spotify'
  | 'streaming_youtube'
  | 'streaming_prime_video'
  | 'streaming_apple_music'
  | 'streaming_tidal'
  | 'podcast';

type NoiseEngine = 'ffmpeg' | 'demucs' | 'hybrid';

interface ManifestCase {
  id: string;
  noisyPath: string;
  cleanPath?: string;
  category?: string;
  weight?: number;
  notes?: string;
}

interface BenchmarkManifest {
  datasetName?: string;
  description?: string;
  cases: ManifestCase[];
}

interface LoudnormStats {
  inputI: number;
  inputTp: number;
  inputLra: number;
  inputThresh: number;
  targetOffset: number;
}

interface CandidateParams {
  noiseReductionDb: number;
  noiseFloorDb: number;
  highpassHz: number;
  lowpassHz: number;
  compressorThresholdDb: number;
  compressorRatio: number;
  compressorAttackMs: number;
  compressorReleaseMs: number;
  limiterCeilingDbfs: number;
  targetLufs: number;
  targetTruePeakDbtp: number;
  targetLra: number;
}

interface PreparedCase {
  id: string;
  category: string;
  weight: number;
  noisyPath: string;
  processingNoisyPath: string;
  cleanPath: string | null;
  noisyLoudnorm: LoudnormStats | null;
  cleanLoudnorm: LoudnormStats | null;
  pauseSegments: Array<{ start: number; end: number }>;
  noiseEngineWarning?: string;
  useFfmpegNoiseReductionOverride?: boolean;
}

interface CaseEvaluation {
  caseId: string;
  score: number;
  compliancePassed: boolean;
  outputLufs: number | null;
  outputTp: number | null;
  outputLra: number | null;
  lufsError: number | null;
  truePeakOver: number | null;
  lraError: number | null;
  apsnrNoisy: number | null;
  apsnrOutput: number | null;
  apsnrGain: number | null;
  pauseRmsDeltaDb: number | null;
  warning?: string;
}

interface AggregateEvaluation {
  candidateId: string;
  score: number;
  compliancePassRate: number;
  avgLufsError: number;
  avgTruePeakOver: number;
  avgLraError: number;
  avgApsnrGain: number | null;
  avgPauseRmsDeltaDb: number | null;
  caseCount: number;
  cases: CaseEvaluation[];
}

interface ProfileTarget {
  integratedLufs: number;
  truePeakDbtp: number;
  loudnessRange: number;
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

interface CliOptions {
  manifestPath: string | null;
  scanDir: string | null;
  manifestOut: string | null;
  outputDir: string;
  profile: DeliveryProfile;
  iterations: number;
  sampleSize: number;
  finalists: number;
  limit: number | null;
  concurrency: number;
  seed: number;
  ffmpegPath: string;
  ffprobePath: string;
  noiseEngine: NoiseEngine;
  demucsPythonBin: string;
  demucsScriptPath: string;
  demucsModel: string;
  demucsDevice: 'auto' | 'cpu' | 'cuda';
  demucsDisableModel: boolean;
  demucsAlpha: number;
  demucsWienerFloor: number;
  demucsNoiseQuantile: number;
  demucsTargetSr: number;
  demucsTimeoutMs: number;
  silenceThresholdDb: number;
  silenceMinDuration: number;
  maxPauseSegments: number;
  writeCalibrationPath: string | null;
  keepRenders: boolean;
}

interface DemucsPreprocessResult {
  applied: boolean;
  warning?: string;
  meta: Record<string, unknown> | null;
}

interface NoiseEnginePreparationStats {
  demucsRequested: boolean;
  demucsAppliedCases: number;
  warnings: string[];
}

interface CalibrationFile {
  version: number;
  generatedAt: string;
  source?: string;
  profiles: Partial<
    Record<
      DeliveryProfile,
      {
        qualityTarget?: {
          integratedLufs?: number;
          truePeakDbtp?: number;
          loudnessRange?: number;
        };
        masteringStage?: {
          highpassHz?: number;
          lowpassHz?: number;
          compressorThresholdDb?: number;
          compressorRatio?: number;
          compressorAttackMs?: number;
          compressorReleaseMs?: number;
          limiterCeilingDbfs?: number;
        };
        noiseReductionStage?: {
          profile?: 'off' | 'light' | 'standard' | 'aggressive';
          enabled?: boolean;
          reductionDb?: number;
          noiseFloorDb?: number;
          applyTo?: 'dialogue' | 'all';
        };
      }
    >
  >;
}

// -----------------------------
// Constants
// -----------------------------

const PROFILE_TARGETS: Record<DeliveryProfile, ProfileTarget> = {
  adaptive: { integratedLufs: -16, truePeakDbtp: -1.5, loudnessRange: 9 },
  netflix: { integratedLufs: -24, truePeakDbtp: -1, loudnessRange: 7 },
  ebu_r128: { integratedLufs: -23, truePeakDbtp: -1, loudnessRange: 7 },
  atsc_a85: { integratedLufs: -24, truePeakDbtp: -2, loudnessRange: 7 },
  streaming_spotify: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 10 },
  streaming_youtube: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 10 },
  streaming_prime_video: { integratedLufs: -24, truePeakDbtp: -2, loudnessRange: 7 },
  streaming_apple_music: { integratedLufs: -16, truePeakDbtp: -1, loudnessRange: 10 },
  streaming_tidal: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 10 },
  podcast: { integratedLufs: -16, truePeakDbtp: -1, loudnessRange: 9 },
};

const AUDIO_EXTENSIONS = new Set(['.wav', '.wave', '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.webm']);

// -----------------------------
// Utility
// -----------------------------

function clamp(value: number, minValue: number, maxValue: number): number {
  if (!Number.isFinite(value)) return minValue;
  return Math.max(minValue, Math.min(maxValue, value));
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function hashText(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function toAbsolutePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(process.cwd(), inputPath);
}

function parseIntArg(value: string | undefined, fallback: number, minValue: number, maxValue: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, minValue, maxValue);
}

function parseFloatArg(value: string | undefined, fallback: number, minValue: number, maxValue: number): number {
  const parsed = Number.parseFloat(value || '');
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, minValue, maxValue);
}

function normalizeProfile(value: string | undefined): DeliveryProfile {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return 'podcast';
  const alias: Record<string, DeliveryProfile> = {
    adaptive: 'adaptive',
    netflix: 'netflix',
    ebur128: 'ebu_r128',
    'ebu-r128': 'ebu_r128',
    ebu_r128: 'ebu_r128',
    atsca85: 'atsc_a85',
    'atsc-a85': 'atsc_a85',
    atsc_a85: 'atsc_a85',
    spotify: 'streaming_spotify',
    streaming_spotify: 'streaming_spotify',
    youtube: 'streaming_youtube',
    streaming_youtube: 'streaming_youtube',
    prime: 'streaming_prime_video',
    primevideo: 'streaming_prime_video',
    streaming_prime_video: 'streaming_prime_video',
    applemusic: 'streaming_apple_music',
    streaming_apple_music: 'streaming_apple_music',
    tidal: 'streaming_tidal',
    streaming_tidal: 'streaming_tidal',
    podcast: 'podcast',
  };
  return alias[raw] || 'podcast';
}

function normalizeNoiseEngine(value: string | undefined): NoiseEngine {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return 'ffmpeg';
  if (normalized === 'demucs' || normalized === 'htdemucs' || normalized === 'demucs_only') {
    return 'demucs';
  }
  if (normalized === 'hybrid' || normalized === 'demucs_ffmpeg') {
    return 'hybrid';
  }
  return 'ffmpeg';
}

function parseBooleanArg(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeDemucsDevice(value: string | undefined): 'auto' | 'cpu' | 'cuda' {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'cpu' || normalized === 'cuda') {
    return normalized;
  }
  return 'auto';
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function sampleArray<T>(items: T[], maxCount: number, rng: () => number): T[] {
  if (items.length <= maxCount) return [...items];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, maxCount);
}

function candidateId(candidate: CandidateParams): string {
  return hashText(JSON.stringify(candidate));
}

function formatFilterNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function buildMasteringPrefix(candidate: CandidateParams): string {
  const thresholdLinear = clamp(Math.pow(10, candidate.compressorThresholdDb / 20), 0.001, 1);
  return [
    `highpass=f=${formatFilterNumber(candidate.highpassHz)}`,
    `lowpass=f=${formatFilterNumber(candidate.lowpassHz)}`,
    `acompressor=threshold=${formatFilterNumber(thresholdLinear)}:ratio=${formatFilterNumber(
      candidate.compressorRatio
    )}:attack=${formatFilterNumber(candidate.compressorAttackMs)}:release=${formatFilterNumber(
      candidate.compressorReleaseMs
    )}:makeup=1`,
    `alimiter=limit=${formatFilterNumber(candidate.limiterCeilingDbfs)}:level=disabled`,
  ].join(',');
}

function buildProcessingFilter(candidate: CandidateParams, includeFfmpegNoiseReduction: boolean): string {
  const chain: string[] = [];
  if (includeFfmpegNoiseReduction && candidate.noiseReductionDb > 0.01) {
    chain.push(
      `afftdn=nr=${formatFilterNumber(candidate.noiseReductionDb)}:nf=${formatFilterNumber(
        candidate.noiseFloorDb
      )}`
    );
  }
  chain.push(buildMasteringPrefix(candidate));
  return chain.join(',');
}

function parseLoudnormStats(logOutput: string): LoudnormStats | null {
  const match = logOutput.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/g);
  if (!match || match.length === 0) {
    return null;
  }
  const lastBlock = match[match.length - 1];
  try {
    const payload = JSON.parse(lastBlock) as Record<string, unknown>;
    const inputI = Number(payload.input_i);
    const inputTp = Number(payload.input_tp);
    const inputLra = Number(payload.input_lra);
    const inputThresh = Number(payload.input_thresh);
    const targetOffset = Number(payload.target_offset);
    if (
      !Number.isFinite(inputI) ||
      !Number.isFinite(inputTp) ||
      !Number.isFinite(inputLra) ||
      !Number.isFinite(inputThresh) ||
      !Number.isFinite(targetOffset)
    ) {
      return null;
    }
    return {
      inputI,
      inputTp,
      inputLra,
      inputThresh,
      targetOffset,
    };
  } catch {
    return null;
  }
}

async function runBinary(
  binary: string,
  args: string[],
  timeoutMs = 120_000
): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve) => {
    const child = spawn(binary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code: typeof code === 'number' ? code : -1,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadToFile(url: string, filePath: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) {
    throw new Error(`Failed to download ${url} (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);
}

async function normalizeAudioToWav(
  ffmpegPath: string,
  sourcePath: string,
  outputPath: string
): Promise<void> {
  const result = await runBinary(
    ffmpegPath,
    ['-y', '-i', sourcePath, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s24le', outputPath],
    120_000
  );
  if (result.code !== 0 || !(await fileExists(outputPath))) {
    throw new Error(`Failed to normalize audio: ${sourcePath}\n${result.stderr.slice(-500)}`);
  }
}

async function loudnormProbe(
  ffmpegPath: string,
  inputPath: string,
  target: { i: number; lra: number; tp: number },
  prefixFilter = ''
): Promise<LoudnormStats | null> {
  const filter = `${prefixFilter}${
    prefixFilter ? ',' : ''
  }loudnorm=I=${formatFilterNumber(target.i)}:LRA=${formatFilterNumber(target.lra)}:TP=${formatFilterNumber(
    target.tp
  )}:print_format=json`;
  const result = await runBinary(
    ffmpegPath,
    ['-hide_banner', '-i', inputPath, '-af', filter, '-f', 'null', '-'],
    120_000
  );
  return parseLoudnormStats(`${result.stdout}\n${result.stderr}`);
}

async function renderCandidate(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  candidate: CandidateParams,
  includeFfmpegNoiseReduction: boolean
): Promise<{ twoPass: boolean }> {
  const prefix = buildProcessingFilter(candidate, includeFfmpegNoiseReduction);
  const target = {
    i: candidate.targetLufs,
    lra: candidate.targetLra,
    tp: candidate.targetTruePeakDbtp,
  };
  const probe = await loudnormProbe(ffmpegPath, inputPath, target, prefix);

  let filter = '';
  let twoPass = false;
  if (probe) {
    twoPass = true;
    filter = `${prefix},loudnorm=I=${formatFilterNumber(target.i)}:LRA=${formatFilterNumber(
      target.lra
    )}:TP=${formatFilterNumber(target.tp)}:measured_I=${formatFilterNumber(
      probe.inputI
    )}:measured_TP=${formatFilterNumber(probe.inputTp)}:measured_LRA=${formatFilterNumber(
      probe.inputLra
    )}:measured_thresh=${formatFilterNumber(probe.inputThresh)}:offset=${formatFilterNumber(
      probe.targetOffset
    )}:linear=true:print_format=summary`;
  } else {
    filter = `${prefix},loudnorm=I=${formatFilterNumber(target.i)}:LRA=${formatFilterNumber(
      target.lra
    )}:TP=${formatFilterNumber(target.tp)}`;
  }

  const render = await runBinary(
    ffmpegPath,
    ['-y', '-i', inputPath, '-af', filter, '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s24le', outputPath],
    180_000
  );
  if (render.code !== 0 || !(await fileExists(outputPath))) {
    throw new Error(`Candidate render failed: ${render.stderr.slice(-800)}`);
  }
  return { twoPass };
}

function parseJsonObject(output: string): Record<string, unknown> | null {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();
  for (const line of lines) {
    if (!line.startsWith('{') || !line.endsWith('}')) {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

async function runDemucsPreprocess(
  options: CliOptions,
  inputPath: string,
  outputPath: string
): Promise<DemucsPreprocessResult> {
  if (!existsSync(options.demucsScriptPath)) {
    return {
      applied: false,
      warning: `demucs script missing: ${options.demucsScriptPath}`,
      meta: null,
    };
  }

  const args = [
    options.demucsScriptPath,
    '--input',
    inputPath,
    '--output',
    outputPath,
    '--model',
    options.demucsModel,
    '--device',
    options.demucsDevice,
    '--target-sr',
    String(options.demucsTargetSr),
    '--alpha',
    formatFilterNumber(options.demucsAlpha),
    '--wiener-floor',
    formatFilterNumber(options.demucsWienerFloor),
    '--noise-quantile',
    formatFilterNumber(options.demucsNoiseQuantile),
  ];
  if (options.demucsDisableModel) {
    args.push('--disable-demucs');
  }

  const commandResult = await runBinary(options.demucsPythonBin, args, options.demucsTimeoutMs);
  if (commandResult.code !== 0 || !(await fileExists(outputPath))) {
    const detail = (commandResult.stderr || commandResult.stdout || '').trim().slice(-500);
    return {
      applied: false,
      warning: `demucs preprocess failed: ${detail || `exit ${commandResult.code}`}`,
      meta: null,
    };
  }

  const payload = parseJsonObject(`${commandResult.stdout}\n${commandResult.stderr}`);
  return {
    applied: true,
    warning:
      typeof payload?.demucs_warning === 'string' && payload.demucs_warning.trim()
        ? payload.demucs_warning.trim()
        : undefined,
    meta: payload,
  };
}

async function measureApsnr(ffmpegPath: string, cleanPath: string, comparedPath: string): Promise<number | null> {
  const result = await runBinary(
    ffmpegPath,
    ['-hide_banner', '-i', cleanPath, '-i', comparedPath, '-filter_complex', '[0:a][1:a]apsnr', '-f', 'null', '-'],
    120_000
  );
  const line = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .find((entry) => /PSNR\s+ch1:/i.test(entry));
  if (!line) {
    return null;
  }
  const match = line.match(/PSNR\s+ch1:\s*([-\d.]+)/i);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

async function detectSilenceSegments(
  ffmpegPath: string,
  audioPath: string,
  silenceThresholdDb: number,
  minDuration: number,
  maxSegments: number
): Promise<Array<{ start: number; end: number }>> {
  const result = await runBinary(
    ffmpegPath,
    [
      '-hide_banner',
      '-i',
      audioPath,
      '-af',
      `silencedetect=noise=${formatFilterNumber(silenceThresholdDb)}dB:d=${formatFilterNumber(minDuration)}`,
      '-f',
      'null',
      '-',
    ],
    120_000
  );

  const silenceStartMatches = Array.from(result.stderr.matchAll(/silence_start:\s*([-\d.]+)/g));
  const silenceEndMatches = Array.from(
    result.stderr.matchAll(/silence_end:\s*([-\d.]+)\s*\|\s*silence_duration:\s*([-\d.]+)/g)
  );

  const starts = silenceStartMatches
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const ends = silenceEndMatches
    .map((match) => ({ end: Number(match[1]), duration: Number(match[2]) }))
    .filter((value) => Number.isFinite(value.end) && Number.isFinite(value.duration));

  const segments: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < Math.min(starts.length, ends.length); index += 1) {
    const start = starts[index];
    const end = ends[index].end;
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }
    if (end <= start) {
      continue;
    }
    const duration = end - start;
    if (duration < minDuration) {
      continue;
    }
    segments.push({ start, end });
  }

  if (segments.length <= maxSegments) {
    return segments;
  }
  return segments
    .sort((a, b) => (b.end - b.start) - (a.end - a.start))
    .slice(0, maxSegments)
    .sort((a, b) => a.start - b.start);
}

async function measureSegmentRmsDb(
  ffmpegPath: string,
  inputPath: string,
  start: number,
  end: number,
  gainDb: number
): Promise<number | null> {
  const filter = `volume=${formatFilterNumber(gainDb)}dB,atrim=start=${formatFilterNumber(
    start
  )}:end=${formatFilterNumber(end)},astats=metadata=0:reset=1`;
  const result = await runBinary(ffmpegPath, ['-hide_banner', '-i', inputPath, '-af', filter, '-f', 'null', '-'], 60_000);
  const line = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .filter((entry) => /RMS level dB:/i.test(entry))
    .pop();
  if (!line) {
    return null;
  }
  const match = line.match(/RMS level dB:\s*([-\d.]+)/i);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function baselineCandidateForProfile(profile: DeliveryProfile): CandidateParams {
  const target = PROFILE_TARGETS[profile];
  if (profile === 'podcast') {
    return {
      noiseReductionDb: 9,
      noiseFloorDb: -42,
      highpassHz: 60,
      lowpassHz: 18000,
      compressorThresholdDb: -16.5,
      compressorRatio: 1.45,
      compressorAttackMs: 20,
      compressorReleaseMs: 260,
      limiterCeilingDbfs: 0.94,
      targetLufs: target.integratedLufs,
      targetTruePeakDbtp: target.truePeakDbtp,
      targetLra: target.loudnessRange,
    };
  }

  return {
    noiseReductionDb: 10,
    noiseFloorDb: -40,
    highpassHz: 28,
    lowpassHz: 19000,
    compressorThresholdDb: -18,
    compressorRatio: 1.9,
    compressorAttackMs: 14,
    compressorReleaseMs: 220,
    limiterCeilingDbfs: 0.9,
    targetLufs: target.integratedLufs,
    targetTruePeakDbtp: target.truePeakDbtp,
    targetLra: target.loudnessRange,
  };
}

function mutateCandidate(
  base: CandidateParams,
  profile: DeliveryProfile,
  rng: () => number
): CandidateParams {
  const target = PROFILE_TARGETS[profile];
  const mutate = (value: number, spread: number, minValue: number, maxValue: number): number => {
    const delta = (rng() * 2 - 1) * spread;
    return clamp(value + delta, minValue, maxValue);
  };

  return {
    noiseReductionDb: round(mutate(base.noiseReductionDb, 2.2, 0, 14), 3),
    noiseFloorDb: round(mutate(base.noiseFloorDb, 4, -60, -34), 3),
    highpassHz: round(mutate(base.highpassHz, 14, 20, 160), 3),
    lowpassHz: round(mutate(base.lowpassHz, 1400, 5000, 21000), 3),
    compressorThresholdDb: round(mutate(base.compressorThresholdDb, 3, -35, -5), 3),
    compressorRatio: round(mutate(base.compressorRatio, 0.5, 1, 8), 3),
    compressorAttackMs: round(mutate(base.compressorAttackMs, 8, 2, 120), 3),
    compressorReleaseMs: round(mutate(base.compressorReleaseMs, 70, 40, 1200), 3),
    limiterCeilingDbfs: round(mutate(base.limiterCeilingDbfs, 0.04, 0.7, 0.98), 4),
    targetLufs: round(clamp(mutate(base.targetLufs, 0.9, target.integratedLufs - 2, target.integratedLufs + 2), -30, -8), 3),
    targetTruePeakDbtp: round(clamp(mutate(base.targetTruePeakDbtp, 0.3, -3, -0.1), -3, -0.1), 3),
    targetLra: round(clamp(mutate(base.targetLra, 1.2, target.loudnessRange - 3, target.loudnessRange + 3), 3, 20), 3),
  };
}

function normalizeCandidateForNoiseEngine(candidate: CandidateParams, noiseEngine: NoiseEngine): CandidateParams {
  if (noiseEngine !== 'demucs') {
    return candidate;
  }
  return {
    ...candidate,
    noiseReductionDb: 0,
    noiseFloorDb: -60,
  };
}

function withFallbackNoiseReduction(
  candidate: CandidateParams,
  profile: DeliveryProfile,
  noiseEngine: NoiseEngine,
  includeFfmpegNoiseReduction: boolean
): CandidateParams {
  if (noiseEngine !== 'demucs' || !includeFfmpegNoiseReduction) {
    return candidate;
  }
  if (candidate.noiseReductionDb > 0.01) {
    return candidate;
  }
  const fallback = baselineCandidateForProfile(profile);
  return {
    ...candidate,
    noiseReductionDb: fallback.noiseReductionDb,
    noiseFloorDb: fallback.noiseFloorDb,
  };
}

function buildCandidateCalibration(profile: DeliveryProfile, candidate: CandidateParams): CalibrationFile['profiles'][DeliveryProfile] {
  return {
    qualityTarget: {
      integratedLufs: round(candidate.targetLufs, 3),
      truePeakDbtp: round(candidate.targetTruePeakDbtp, 3),
      loudnessRange: round(candidate.targetLra, 3),
    },
    masteringStage: {
      highpassHz: round(candidate.highpassHz, 3),
      lowpassHz: round(candidate.lowpassHz, 3),
      compressorThresholdDb: round(candidate.compressorThresholdDb, 3),
      compressorRatio: round(candidate.compressorRatio, 3),
      compressorAttackMs: round(candidate.compressorAttackMs, 3),
      compressorReleaseMs: round(candidate.compressorReleaseMs, 3),
      limiterCeilingDbfs: round(candidate.limiterCeilingDbfs, 4),
    },
    noiseReductionStage: {
      profile:
        candidate.noiseReductionDb <= 0.01
          ? 'off'
          : candidate.noiseReductionDb > 10.5
            ? 'aggressive'
            : candidate.noiseReductionDb > 6.5
              ? 'standard'
              : 'light',
      enabled: candidate.noiseReductionDb > 0.01,
      reductionDb: round(candidate.noiseReductionDb, 3),
      noiseFloorDb: round(candidate.noiseFloorDb, 3),
      applyTo: 'dialogue',
    },
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function scoreCase(
  candidate: CandidateParams,
  outputStats: LoudnormStats | null,
  apsnrNoisy: number | null,
  apsnrOutput: number | null,
  pauseRmsDeltaDb: number | null,
  twoPass: boolean,
  ffmpegNoiseReductionEnabled: boolean,
  warning: string | undefined
): Omit<CaseEvaluation, 'caseId'> {
  if (!outputStats) {
    return {
      score: 0,
      compliancePassed: false,
      outputLufs: null,
      outputTp: null,
      outputLra: null,
      lufsError: null,
      truePeakOver: null,
      lraError: null,
      apsnrNoisy,
      apsnrOutput,
      apsnrGain: null,
      pauseRmsDeltaDb,
      warning: warning || 'missing loudnorm output stats',
    };
  }

  const lufsError = Math.abs(outputStats.inputI - candidate.targetLufs);
  const truePeakOver = Math.max(0, outputStats.inputTp - candidate.targetTruePeakDbtp);
  const lraError = Math.abs(outputStats.inputLra - candidate.targetLra);
  const compliancePassed = lufsError <= 1 && truePeakOver <= 0 && lraError <= 4;
  const apsnrGain =
    apsnrOutput !== null && apsnrNoisy !== null ? apsnrOutput - apsnrNoisy : null;

  let score = 100;
  score -= lufsError * 15;
  score -= truePeakOver * 120;
  score -= Math.max(0, lraError - 1.5) * 2.5;
  if (!twoPass) {
    score -= 4;
  }
  if (apsnrGain !== null) {
    score += clamp(apsnrGain * 7, -25, 25);
  }
  if (pauseRmsDeltaDb !== null) {
    score += clamp(pauseRmsDeltaDb * 2.8, -25, 30);
  }
  if (ffmpegNoiseReductionEnabled) {
    const overReduction = Math.max(0, candidate.noiseReductionDb - 10);
    if (overReduction > 0) {
      score -= overReduction * 8;
    }
    const shallowNoiseFloor = Math.max(0, candidate.noiseFloorDb - -36);
    if (shallowNoiseFloor > 0) {
      score -= shallowNoiseFloor * 4;
    }
  }
  const overCompression = Math.max(0, candidate.compressorRatio - 1.8);
  if (overCompression > 0) {
    score -= overCompression * 10;
  }
  if (candidate.compressorAttackMs < 10) {
    score -= (10 - candidate.compressorAttackMs) * 1.4;
  }
  if (warning) {
    score -= 3;
  }

  return {
    score: round(clamp(score, 0, 150), 4),
    compliancePassed,
    outputLufs: round(outputStats.inputI, 4),
    outputTp: round(outputStats.inputTp, 4),
    outputLra: round(outputStats.inputLra, 4),
    lufsError: round(lufsError, 4),
    truePeakOver: round(truePeakOver, 4),
    lraError: round(lraError, 4),
    apsnrNoisy: apsnrNoisy === null ? null : round(apsnrNoisy, 4),
    apsnrOutput: apsnrOutput === null ? null : round(apsnrOutput, 4),
    apsnrGain: apsnrGain === null ? null : round(apsnrGain, 4),
    pauseRmsDeltaDb: pauseRmsDeltaDb === null ? null : round(pauseRmsDeltaDb, 4),
    warning,
  };
}

async function evaluateCandidateOnCase(
  options: CliOptions,
  preparedCase: PreparedCase,
  candidate: CandidateParams,
  workDir: string
): Promise<CaseEvaluation> {
  const caseOutput = path.join(workDir, `${preparedCase.id}-${candidateId(candidate)}.wav`);
  let twoPass = false;
  let warning: string | undefined = preparedCase.noiseEngineWarning;
  const includeFfmpegNoiseReduction =
    options.noiseEngine === 'ffmpeg' ||
    options.noiseEngine === 'hybrid' ||
    preparedCase.useFfmpegNoiseReductionOverride === true;
  const effectiveCandidate = withFallbackNoiseReduction(
    candidate,
    options.profile,
    options.noiseEngine,
    includeFfmpegNoiseReduction
  );

  try {
    const render = await renderCandidate(
      options.ffmpegPath,
      preparedCase.processingNoisyPath,
      caseOutput,
      effectiveCandidate,
      includeFfmpegNoiseReduction
    );
    twoPass = render.twoPass;

    const outputLoudnorm = await loudnormProbe(
      options.ffmpegPath,
      caseOutput,
      {
        i: effectiveCandidate.targetLufs,
        lra: effectiveCandidate.targetLra,
        tp: effectiveCandidate.targetTruePeakDbtp,
      },
      ''
    );

    let apsnrNoisy: number | null = null;
    let apsnrOutput: number | null = null;
    let pauseRmsDeltaDb: number | null = null;

    if (preparedCase.cleanPath) {
      apsnrNoisy = await measureApsnr(options.ffmpegPath, preparedCase.cleanPath, preparedCase.noisyPath);
      apsnrOutput = await measureApsnr(options.ffmpegPath, preparedCase.cleanPath, caseOutput);

      if (
        preparedCase.pauseSegments.length > 0 &&
        preparedCase.cleanLoudnorm &&
        preparedCase.noisyLoudnorm &&
        outputLoudnorm
      ) {
        const noisyGain = preparedCase.cleanLoudnorm.inputI - preparedCase.noisyLoudnorm.inputI;
        const outputGain = preparedCase.cleanLoudnorm.inputI - outputLoudnorm.inputI;
        const deltas: number[] = [];
        for (const segment of preparedCase.pauseSegments) {
          const noisyRms = await measureSegmentRmsDb(
            options.ffmpegPath,
            preparedCase.noisyPath,
            segment.start,
            segment.end,
            noisyGain
          );
          const outputRms = await measureSegmentRmsDb(
            options.ffmpegPath,
            caseOutput,
            segment.start,
            segment.end,
            outputGain
          );
          if (noisyRms !== null && outputRms !== null) {
            deltas.push(noisyRms - outputRms);
          }
        }
        if (deltas.length > 0) {
          pauseRmsDeltaDb = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
        }
      }
    }

    const scored = scoreCase(
      effectiveCandidate,
      outputLoudnorm,
      apsnrNoisy,
      apsnrOutput,
      pauseRmsDeltaDb,
      twoPass,
      includeFfmpegNoiseReduction,
      warning
    );

    return {
      caseId: preparedCase.id,
      ...scored,
    };
  } catch (error) {
    warning = error instanceof Error ? error.message.slice(0, 240) : 'case evaluation failed';
    return {
      caseId: preparedCase.id,
      score: 0,
      compliancePassed: false,
      outputLufs: null,
      outputTp: null,
      outputLra: null,
      lufsError: null,
      truePeakOver: null,
      lraError: null,
      apsnrNoisy: null,
      apsnrOutput: null,
      apsnrGain: null,
      pauseRmsDeltaDb: null,
      warning,
    };
  } finally {
    if (!options.keepRenders) {
      await fs.rm(caseOutput, { force: true }).catch(() => undefined);
    }
  }
}

async function evaluateCandidate(
  options: CliOptions,
  preparedCases: PreparedCase[],
  candidate: CandidateParams,
  workDir: string
): Promise<AggregateEvaluation> {
  const cases = await mapWithConcurrency(preparedCases, options.concurrency, async (entry) => {
    return evaluateCandidateOnCase(options, entry, candidate, workDir);
  });

  const scoreSum = cases.reduce((sum, item) => sum + item.score, 0);
  const complianceCount = cases.filter((item) => item.compliancePassed).length;

  const lufsErrors = cases
    .map((item) => item.lufsError)
    .filter((value): value is number => typeof value === 'number');
  const truePeakOvers = cases
    .map((item) => item.truePeakOver)
    .filter((value): value is number => typeof value === 'number');
  const lraErrors = cases
    .map((item) => item.lraError)
    .filter((value): value is number => typeof value === 'number');
  const apsnrGains = cases
    .map((item) => item.apsnrGain)
    .filter((value): value is number => typeof value === 'number');
  const pauseDeltas = cases
    .map((item) => item.pauseRmsDeltaDb)
    .filter((value): value is number => typeof value === 'number');

  const avg = (values: number[]): number => {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  return {
    candidateId: candidateId(candidate),
    score: round(scoreSum / Math.max(1, cases.length), 4),
    compliancePassRate: round(complianceCount / Math.max(1, cases.length), 4),
    avgLufsError: round(avg(lufsErrors), 4),
    avgTruePeakOver: round(avg(truePeakOvers), 4),
    avgLraError: round(avg(lraErrors), 4),
    avgApsnrGain: apsnrGains.length > 0 ? round(avg(apsnrGains), 4) : null,
    avgPauseRmsDeltaDb: pauseDeltas.length > 0 ? round(avg(pauseDeltas), 4) : null,
    caseCount: cases.length,
    cases,
  };
}

async function collectAudioFiles(scanDir: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (currentDir: string): Promise<void> => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const extension = path.extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.has(extension)) {
          files.push(fullPath);
        }
      }
    }
  };
  await walk(scanDir);
  return files;
}

function classifyAudioRole(filePath: string): 'clean' | 'noisy' | 'unknown' {
  const value = filePath.toLowerCase();
  const cleanHints = ['clean', 'original', 'orig', 'reference', 'ref', '/clean/', '\\clean\\'];
  const noisyHints = ['noisy', 'noise', 'degraded', 'mixed', '/noisy/', '\\noisy\\'];
  if (cleanHints.some((hint) => value.includes(hint))) return 'clean';
  if (noisyHints.some((hint) => value.includes(hint))) return 'noisy';
  return 'unknown';
}

function pairKey(scanDir: string, filePath: string): string {
  const relative = path.relative(scanDir, filePath).toLowerCase();
  const withoutExtension = relative.replace(path.extname(relative), '');
  return withoutExtension
    .replace(/(^|[/\\])(clean|noisy|noise|original|orig|reference|ref|degraded|mixed)(?=$|[/\\])/g, '$1')
    .replace(/[_\-. ](clean|noisy|noise|original|orig|reference|ref|degraded|mixed)\b/g, '')
    .replace(/[/\\]+/g, '/')
    .replace(/__+/g, '_')
    .replace(/^[/_\-. ]+|[/_\-. ]+$/g, '');
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, 'true');
      continue;
    }
    args.set(key, next);
    index += 1;
  }

  const outputDirArg = args.get('output-dir');
  const outputDir = outputDirArg
    ? toAbsolutePath(outputDirArg)
    : path.join(process.cwd(), 'tmp', 'storyarc-audio-benchmark', new Date().toISOString().replace(/[:.]/g, '-'));

  return {
    manifestPath: args.get('manifest') ? toAbsolutePath(args.get('manifest') as string) : null,
    scanDir: args.get('scan-dir') ? toAbsolutePath(args.get('scan-dir') as string) : null,
    manifestOut: args.get('manifest-out') ? toAbsolutePath(args.get('manifest-out') as string) : null,
    outputDir,
    profile: normalizeProfile(args.get('profile')),
    iterations: parseIntArg(args.get('iterations'), 80, 1, 5000),
    sampleSize: parseIntArg(args.get('sample-size'), 40, 1, 2000),
    finalists: parseIntArg(args.get('finalists'), 6, 1, 50),
    limit: args.has('limit') ? parseIntArg(args.get('limit'), 0, 1, 100000) : null,
    concurrency: parseIntArg(args.get('concurrency'), Math.max(1, Math.min(4, os.cpus().length)), 1, 32),
    seed: parseIntArg(args.get('seed'), 20260304, 1, 0x7fffffff),
    ffmpegPath: args.get('ffmpeg') || process.env.FFMPEG_PATH || 'ffmpeg',
    ffprobePath: args.get('ffprobe') || process.env.FFPROBE_PATH || 'ffprobe',
    noiseEngine: normalizeNoiseEngine(args.get('noise-engine') || process.env.STORYARC_AUDIO_BENCHMARK_NOISE_ENGINE),
    demucsPythonBin:
      args.get('demucs-python') ||
      process.env.AUDIO_MIX_DEMUCS_PYTHON_BIN ||
      process.env.PYTHON_BIN ||
      'python3',
    demucsScriptPath:
      args.get('demucs-script') ||
      process.env.AUDIO_MIX_DEMUCS_SCRIPT_PATH ||
      path.join(process.cwd(), 'scripts', 'audio_demucs_denoise.py'),
    demucsModel: args.get('demucs-model') || process.env.AUDIO_MIX_DEMUCS_MODEL || 'htdemucs',
    demucsDevice: normalizeDemucsDevice(args.get('demucs-device') || process.env.AUDIO_MIX_DEMUCS_DEVICE),
    demucsDisableModel: parseBooleanArg(args.get('demucs-disable-model'), false),
    demucsAlpha: parseFloatArg(args.get('demucs-alpha'), 0.97, 0, 0.999),
    demucsWienerFloor: parseFloatArg(args.get('demucs-wiener-floor'), 0.05, 0.001, 0.8),
    demucsNoiseQuantile: parseFloatArg(args.get('demucs-noise-quantile'), 0.2, 0.05, 0.45),
    demucsTargetSr: parseIntArg(args.get('demucs-target-sr'), 48_000, 8000, 96_000),
    demucsTimeoutMs: parseIntArg(args.get('demucs-timeout-ms'), 420_000, 60_000, 1_800_000),
    silenceThresholdDb: parseFloatArg(args.get('silence-threshold-db'), -35, -90, -10),
    silenceMinDuration: parseFloatArg(args.get('silence-min-duration'), 0.2, 0.05, 5),
    maxPauseSegments: parseIntArg(args.get('max-pause-segments'), 8, 1, 50),
    writeCalibrationPath: args.get('write-calibration')
      ? toAbsolutePath(args.get('write-calibration') as string)
      : null,
    keepRenders: parseBooleanArg(args.get('keep-renders'), false),
  };
}

async function loadManifest(options: CliOptions): Promise<BenchmarkManifest> {
  if (!options.manifestPath && !options.scanDir) {
    throw new Error('Provide --manifest <path> or --scan-dir <dir>');
  }

  if (options.scanDir) {
    const scanRoot = options.scanDir;
    const allFiles = await collectAudioFiles(scanRoot);
    const grouped = new Map<string, { clean: string[]; noisy: string[]; unknown: string[] }>();

    for (const filePath of allFiles) {
      const key = pairKey(scanRoot, filePath);
      if (!key) continue;
      const role = classifyAudioRole(filePath);
      const group = grouped.get(key) || { clean: [], noisy: [], unknown: [] };
      group[role].push(filePath);
      grouped.set(key, group);
    }

    const cases: ManifestCase[] = [];
    for (const [key, group] of grouped.entries()) {
      const noisy = group.noisy[0] || group.unknown[0];
      const clean = group.clean[0] || null;
      if (!noisy) continue;
      cases.push({
        id: hashText(key),
        noisyPath: noisy,
        cleanPath: clean || undefined,
        category: key.split('/').slice(0, -1).join('/') || 'scanned',
      });
    }

    const manifest: BenchmarkManifest = {
      datasetName: `scan:${scanRoot}`,
      description: 'Auto-generated from scan-dir pairing heuristics',
      cases,
    };

    if (options.manifestOut) {
      await ensureDir(path.dirname(options.manifestOut));
      await fs.writeFile(options.manifestOut, JSON.stringify(manifest, null, 2));
      console.log(`[manifest] wrote ${manifest.cases.length} cases -> ${options.manifestOut}`);
    }

    return manifest;
  }

  const manifestPath = options.manifestPath as string;
  const raw = await fs.readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as BenchmarkManifest;
  if (!parsed || !Array.isArray(parsed.cases)) {
    throw new Error(`Invalid manifest: ${manifestPath}`);
  }
  return parsed;
}

async function prepareSource(
  source: string,
  downloadsDir: string
): Promise<string> {
  if (isHttpUrl(source)) {
    const url = new URL(source);
    const extension = path.extname(url.pathname) || '.wav';
    const target = path.join(downloadsDir, `${hashText(source)}${extension}`);
    if (!(await fileExists(target))) {
      await downloadToFile(source, target);
    }
    return target;
  }
  if (source.startsWith('file://')) {
    return new URL(source).pathname;
  }
  return toAbsolutePath(source);
}

async function prepareCases(
  options: CliOptions,
  manifest: BenchmarkManifest,
  runDir: string
): Promise<PreparedCase[]> {
  const preparedDir = path.join(runDir, 'prepared');
  const downloadsDir = path.join(runDir, 'downloads');
  await ensureDir(preparedDir);
  await ensureDir(downloadsDir);

  const filteredCases = manifest.cases.filter((entry) => Boolean(entry?.id && entry?.noisyPath));
  const limitedCases = options.limit ? filteredCases.slice(0, options.limit) : filteredCases;

  const preparedCases = await mapWithConcurrency(
    limitedCases,
    options.concurrency,
    async (entry, index): Promise<PreparedCase | null> => {
      try {
        const sourceNoisy = await prepareSource(entry.noisyPath, downloadsDir);
        const sourceClean = entry.cleanPath ? await prepareSource(entry.cleanPath, downloadsDir) : null;

        const noisyNormalized = path.join(preparedDir, `${entry.id || index}-noisy.wav`);
        await normalizeAudioToWav(options.ffmpegPath, sourceNoisy, noisyNormalized);

        let cleanNormalized: string | null = null;
        if (sourceClean) {
          cleanNormalized = path.join(preparedDir, `${entry.id || index}-clean.wav`);
          await normalizeAudioToWav(options.ffmpegPath, sourceClean, cleanNormalized);
        }

        const noisyLoudnorm = await loudnormProbe(
          options.ffmpegPath,
          noisyNormalized,
          {
            i: PROFILE_TARGETS[options.profile].integratedLufs,
            lra: PROFILE_TARGETS[options.profile].loudnessRange,
            tp: PROFILE_TARGETS[options.profile].truePeakDbtp,
          },
          ''
        );

        const cleanLoudnorm = cleanNormalized
          ? await loudnormProbe(
              options.ffmpegPath,
              cleanNormalized,
              {
                i: PROFILE_TARGETS[options.profile].integratedLufs,
                lra: PROFILE_TARGETS[options.profile].loudnessRange,
                tp: PROFILE_TARGETS[options.profile].truePeakDbtp,
              },
              ''
            )
          : null;

        const pauseSegments = cleanNormalized
          ? await detectSilenceSegments(
              options.ffmpegPath,
              cleanNormalized,
              options.silenceThresholdDb,
              options.silenceMinDuration,
              options.maxPauseSegments
            )
          : [];

        return {
          id: entry.id || `case-${index + 1}`,
          category: entry.category || 'unknown',
          weight: Number.isFinite(entry.weight || NaN) ? Math.max(0.1, Number(entry.weight)) : 1,
          noisyPath: noisyNormalized,
          processingNoisyPath: noisyNormalized,
          cleanPath: cleanNormalized,
          noisyLoudnorm,
          cleanLoudnorm,
          pauseSegments,
          useFfmpegNoiseReductionOverride: false,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[prepare] skipping case ${entry.id || index}: ${message}`);
        return null;
      }
    }
  );

  return preparedCases.filter((entry): entry is PreparedCase => entry !== null);
}

async function prepareNoiseEngineInputs(
  options: CliOptions,
  preparedCases: PreparedCase[],
  runDir: string
): Promise<NoiseEnginePreparationStats> {
  if (options.noiseEngine === 'ffmpeg') {
    return {
      demucsRequested: false,
      demucsAppliedCases: 0,
      warnings: [],
    };
  }

  const warnings: string[] = [];
  let demucsAppliedCases = 0;
  const demucsDir = path.join(runDir, 'demucs');
  await ensureDir(demucsDir);

  await mapWithConcurrency(preparedCases, options.concurrency, async (entry) => {
    const outputPath = path.join(
      demucsDir,
      `${entry.id.replace(/[^a-z0-9_-]/gi, '_')}-${hashText(entry.noisyPath)}.wav`
    );
    const result = await runDemucsPreprocess(options, entry.noisyPath, outputPath);
    if (result.applied) {
      entry.processingNoisyPath = outputPath;
      entry.useFfmpegNoiseReductionOverride = false;
      demucsAppliedCases += 1;
      if (result.warning) {
        entry.noiseEngineWarning = result.warning;
        warnings.push(`[${entry.id}] ${result.warning}`);
      }
      return;
    }
    entry.processingNoisyPath = entry.noisyPath;
    entry.useFfmpegNoiseReductionOverride = options.noiseEngine === 'demucs';
    if (result.warning) {
      const suffix =
        options.noiseEngine === 'demucs'
          ? ' Falling back to ffmpeg denoise for this case.'
          : '';
      entry.noiseEngineWarning = `${result.warning}${suffix}`;
      warnings.push(`[${entry.id}] ${entry.noiseEngineWarning}`);
    }
  });

  return {
    demucsRequested: true,
    demucsAppliedCases,
    warnings,
  };
}

async function ensureBinaryExists(binary: string, probeArgs: string[]): Promise<void> {
  const check = await runBinary(binary, probeArgs, 20_000);
  if (check.code !== 0) {
    throw new Error(`Binary check failed for ${binary}: ${check.stderr || check.stdout}`);
  }
}

async function upsertCalibration(
  calibrationPath: string,
  profile: DeliveryProfile,
  candidate: CandidateParams,
  sourceLabel: string
): Promise<void> {
  let existing: CalibrationFile | null = null;
  if (existsSync(calibrationPath)) {
    const raw = await fs.readFile(calibrationPath, 'utf8');
    if (raw.trim()) {
      existing = JSON.parse(raw) as CalibrationFile;
    }
  }

  const current: CalibrationFile = existing || {
    version: 1,
    generatedAt: new Date().toISOString(),
    profiles: {},
  };

  current.version = Math.max(1, Math.round(Number(current.version) || 1));
  current.generatedAt = new Date().toISOString();
  current.source = sourceLabel;
  if (!current.profiles) {
    current.profiles = {};
  }
  current.profiles[profile] = buildCandidateCalibration(profile, candidate);

  await ensureDir(path.dirname(calibrationPath));
  await fs.writeFile(calibrationPath, JSON.stringify(current, null, 2));
}

function weightedAverage(
  cases: CaseEvaluation[],
  preparedMap: Map<string, PreparedCase>,
  selector: (item: CaseEvaluation) => number | null
): number | null {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const entry of cases) {
    const value = selector(entry);
    if (value === null || !Number.isFinite(value)) {
      continue;
    }
    const weight = preparedMap.get(entry.caseId)?.weight ?? 1;
    weightedSum += value * weight;
    weightTotal += weight;
  }
  if (weightTotal <= 0) {
    return null;
  }
  return weightedSum / weightTotal;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await ensureDir(options.outputDir);

  console.log(`[benchmark] output: ${options.outputDir}`);
  console.log(
    `[benchmark] profile: ${options.profile}, iterations=${options.iterations}, sampleSize=${options.sampleSize}, noiseEngine=${options.noiseEngine}`
  );

  await ensureBinaryExists(options.ffmpegPath, ['-version']);
  await ensureBinaryExists(options.ffprobePath, ['-version']);
  if (options.noiseEngine !== 'ffmpeg') {
    await ensureBinaryExists(options.demucsPythonBin, ['--version']);
  }

  const manifest = await loadManifest(options);
  if (!manifest.cases || manifest.cases.length === 0) {
    throw new Error('No cases found in manifest/scan');
  }

  const runDir = options.outputDir;
  const workDir = path.join(runDir, 'work');
  await ensureDir(workDir);

  const preparedCases = await prepareCases(options, manifest, runDir);
  if (preparedCases.length === 0) {
    throw new Error('No prepared cases available');
  }
  const noiseEnginePrep = await prepareNoiseEngineInputs(options, preparedCases, runDir);
  if (noiseEnginePrep.demucsRequested) {
    console.log(
      `[noise-engine] demucs applied to ${noiseEnginePrep.demucsAppliedCases}/${preparedCases.length} case(s)`
    );
    if (noiseEnginePrep.warnings.length > 0) {
      console.warn(`[noise-engine] ${noiseEnginePrep.warnings.length} warning(s), first: ${noiseEnginePrep.warnings[0]}`);
    }
  }

  const preparedMap = new Map(preparedCases.map((entry) => [entry.id, entry]));
  const rng = createRng(options.seed);

  const baseline = normalizeCandidateForNoiseEngine(
    baselineCandidateForProfile(options.profile),
    options.noiseEngine
  );
  const sampledCases = sampleArray(preparedCases, options.sampleSize, rng);

  const leaderboard: Array<{
    iteration: number;
    scope: 'sample' | 'full';
    candidate: CandidateParams;
    evaluation: AggregateEvaluation;
  }> = [];

  console.log(`[benchmark] evaluating baseline on sample (${sampledCases.length} cases)`);
  const baselineSampleEval = await evaluateCandidate(options, sampledCases, baseline, workDir);
  leaderboard.push({ iteration: 0, scope: 'sample', candidate: baseline, evaluation: baselineSampleEval });

  let bestCandidate = baseline;
  let bestSampleEval = baselineSampleEval;

  const seenCandidates = new Set<string>([candidateId(baseline)]);

  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    const candidate = normalizeCandidateForNoiseEngine(
      mutateCandidate(bestCandidate, options.profile, rng),
      options.noiseEngine
    );
    const id = candidateId(candidate);
    if (seenCandidates.has(id)) {
      continue;
    }
    seenCandidates.add(id);

    const evaluation = await evaluateCandidate(options, sampledCases, candidate, workDir);
    leaderboard.push({ iteration, scope: 'sample', candidate, evaluation });

    if (evaluation.score > bestSampleEval.score) {
      bestCandidate = candidate;
      bestSampleEval = evaluation;
    }

    if (iteration % 10 === 0 || iteration === options.iterations) {
      console.log(
        `[search] iter=${iteration} sample best score=${bestSampleEval.score.toFixed(3)} candidate=${candidateId(
          bestCandidate
        )}`
      );
    }
  }

  const finalists = leaderboard
    .filter((entry) => entry.scope === 'sample')
    .sort((a, b) => b.evaluation.score - a.evaluation.score)
    .slice(0, options.finalists)
    .map((entry) => entry.candidate);

  const uniqueFinalists: CandidateParams[] = [];
  const finalistIds = new Set<string>();
  for (const entry of finalists) {
    const id = candidateId(entry);
    if (!finalistIds.has(id)) {
      finalistIds.add(id);
      uniqueFinalists.push(entry);
    }
  }

  console.log(`[benchmark] evaluating ${uniqueFinalists.length} finalist candidates on full dataset (${preparedCases.length} cases)`);

  let bestFullCandidate = uniqueFinalists[0] || baseline;
  let bestFullEval: AggregateEvaluation | null = null;

  for (let index = 0; index < uniqueFinalists.length; index += 1) {
    const candidate = uniqueFinalists[index];
    const evaluation = await evaluateCandidate(options, preparedCases, candidate, workDir);
    leaderboard.push({ iteration: index + 1, scope: 'full', candidate, evaluation });

    if (!bestFullEval || evaluation.score > bestFullEval.score) {
      bestFullEval = evaluation;
      bestFullCandidate = candidate;
    }

    console.log(
      `[finalist ${index + 1}/${uniqueFinalists.length}] score=${evaluation.score.toFixed(3)} passRate=${(
        evaluation.compliancePassRate * 100
      ).toFixed(1)}% id=${candidateId(candidate)}`
    );
  }

  if (!bestFullEval) {
    bestFullEval = await evaluateCandidate(options, preparedCases, baseline, workDir);
    bestFullCandidate = baseline;
  }

  const weightedLufsError = weightedAverage(bestFullEval.cases, preparedMap, (entry) => entry.lufsError);
  const weightedTruePeakOver = weightedAverage(bestFullEval.cases, preparedMap, (entry) => entry.truePeakOver);
  const weightedLraError = weightedAverage(bestFullEval.cases, preparedMap, (entry) => entry.lraError);
  const weightedApsnrGain = weightedAverage(bestFullEval.cases, preparedMap, (entry) => entry.apsnrGain);
  const weightedPauseDelta = weightedAverage(bestFullEval.cases, preparedMap, (entry) => entry.pauseRmsDeltaDb);

  const calibration = buildCandidateCalibration(options.profile, bestFullCandidate);

  const summary = {
    generatedAt: new Date().toISOString(),
    datasetName: manifest.datasetName || 'unnamed',
    profile: options.profile,
    options: {
      iterations: options.iterations,
      sampleSize: options.sampleSize,
      finalists: options.finalists,
      limit: options.limit,
      concurrency: options.concurrency,
      seed: options.seed,
      noiseEngine: options.noiseEngine,
      demucs: {
        pythonBin: options.demucsPythonBin,
        scriptPath: options.demucsScriptPath,
        model: options.demucsModel,
        device: options.demucsDevice,
        disableModel: options.demucsDisableModel,
        alpha: options.demucsAlpha,
        wienerFloor: options.demucsWienerFloor,
        noiseQuantile: options.demucsNoiseQuantile,
        targetSr: options.demucsTargetSr,
        timeoutMs: options.demucsTimeoutMs,
      },
      silenceThresholdDb: options.silenceThresholdDb,
      silenceMinDuration: options.silenceMinDuration,
      maxPauseSegments: options.maxPauseSegments,
    },
    counts: {
      manifestCases: manifest.cases.length,
      preparedCases: preparedCases.length,
      sampledCases: sampledCases.length,
      demucsAppliedCases: noiseEnginePrep.demucsAppliedCases,
      noiseEngineWarnings: noiseEnginePrep.warnings.length,
      evaluatedCandidates: leaderboard.filter((entry) => entry.scope === 'sample').length,
    },
    baseline: {
      candidateId: candidateId(baseline),
      sampleScore: baselineSampleEval.score,
      sampleCompliancePassRate: baselineSampleEval.compliancePassRate,
      candidate: baseline,
    },
    bestSample: {
      candidateId: candidateId(bestCandidate),
      score: bestSampleEval.score,
      compliancePassRate: bestSampleEval.compliancePassRate,
      candidate: bestCandidate,
    },
    bestFull: {
      candidateId: candidateId(bestFullCandidate),
      score: bestFullEval.score,
      compliancePassRate: bestFullEval.compliancePassRate,
      avgLufsError: bestFullEval.avgLufsError,
      avgTruePeakOver: bestFullEval.avgTruePeakOver,
      avgLraError: bestFullEval.avgLraError,
      avgApsnrGain: bestFullEval.avgApsnrGain,
      avgPauseRmsDeltaDb: bestFullEval.avgPauseRmsDeltaDb,
      weighted: {
        lufsError: weightedLufsError,
        truePeakOver: weightedTruePeakOver,
        lraError: weightedLraError,
        apsnrGain: weightedApsnrGain,
        pauseRmsDeltaDb: weightedPauseDelta,
      },
      candidate: bestFullCandidate,
      calibration,
    },
    topFinalists: leaderboard
      .filter((entry) => entry.scope === 'full')
      .sort((a, b) => b.evaluation.score - a.evaluation.score)
      .map((entry) => ({
        candidateId: candidateId(entry.candidate),
        score: entry.evaluation.score,
        compliancePassRate: entry.evaluation.compliancePassRate,
        candidate: entry.candidate,
      })),
  };

  await fs.writeFile(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await fs.writeFile(path.join(runDir, 'leaderboard.json'), JSON.stringify(leaderboard, null, 2));
  await fs.writeFile(path.join(runDir, 'best-calibration.json'), JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    source: `storyarc-audio-benchmark-autotune:${manifest.datasetName || 'unnamed'}`,
    profiles: {
      [options.profile]: calibration,
    },
  }, null, 2));

  if (options.writeCalibrationPath) {
    await upsertCalibration(
      options.writeCalibrationPath,
      options.profile,
      bestFullCandidate,
      `storyarc-audio-benchmark-autotune:${manifest.datasetName || 'unnamed'}`
    );
    console.log(`[calibration] updated ${options.writeCalibrationPath}`);
  }

  console.log('[benchmark] done');
  console.log(`[benchmark] best candidate id: ${candidateId(bestFullCandidate)}`);
  console.log(
    `[benchmark] best score=${bestFullEval.score.toFixed(3)}, compliance=${(
      bestFullEval.compliancePassRate * 100
    ).toFixed(1)}%`
  );
  console.log(`[benchmark] summary: ${path.join(runDir, 'summary.json')}`);
}

main().catch((error) => {
  console.error('[benchmark] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
