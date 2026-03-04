#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  createAutoEditAlternatives,
  getDefaultAutoEditOptions,
  type AutoEditAlternativesResult,
  type AutoEditNarrativeBeat,
  type AutoEditVariant,
} from '../../frontend/client/src/services/auto-edit-engine';
import type { BeatClip, Track } from '../../frontend/client/src/services/storyArcDataIntegration';

interface CliOptions {
  scanDir: string;
  match: string;
  outputDir: string;
  targetSeconds: number;
  segmentSeconds: number;
  frameRate: number;
  variant: AutoEditVariant;
  renderVideo: boolean;
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

interface CaseResultData {
  generatedAt?: string;
  source?: {
    durationSeconds?: number;
    downloadedVideoPath?: string;
  };
  audio?: {
    enhancedAudioPath?: string;
    rawAudioPath?: string;
  };
}

interface LoadedCase {
  caseId: string;
  caseDir: string;
  resultPath: string;
  sourceDurationSeconds: number;
  sourceVideoPath: string;
  sourceAudioPath: string;
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, 'true');
      continue;
    }
    args.set(key, next);
    index += 1;
  }

  const variantRaw = (args.get('variant') || 'balanced').trim().toLowerCase();
  const variant: AutoEditVariant =
    variantRaw === 'safe' || variantRaw === 'balanced' || variantRaw === 'bold' ? variantRaw : 'balanced';

  const scanDir = path.resolve(args.get('scan-dir') || path.join(process.cwd(), 'tmp'));
  const outputDir = path.resolve(
    args.get('output-dir') ||
      path.join(process.cwd(), 'tmp', `storyarc-year-reel-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  );

  return {
    scanDir,
    match: (args.get('match') || 'storyarc-wedding-e2e-').trim(),
    outputDir,
    targetSeconds: Math.max(8, Math.min(180, Number.parseFloat(args.get('target-seconds') || '30') || 30)),
    segmentSeconds: Math.max(0.8, Math.min(8, Number.parseFloat(args.get('segment-seconds') || '2.2') || 2.2)),
    frameRate: Math.max(1, Math.min(120, Number.parseInt(args.get('frame-rate') || '30', 10) || 30)),
    variant,
    renderVideo: (args.get('render-video') || 'true').toLowerCase() !== 'false',
  };
}

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

function resolveBeatByProgress(progress: number): AutoEditNarrativeBeat {
  if (progress < 0.2) {
    return 'hook';
  }
  if (progress < 0.65) {
    return 'build';
  }
  if (progress < 0.88) {
    return 'climax';
  }
  return 'resolution';
}

async function runCommand(binary: string, args: string[], timeoutMs: number): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve) => {
    const child = spawn(binary, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
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
      clearTimeout(timeout);
      resolve({
        code: typeof code === 'number' ? code : -1,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

function buildTracks(): Track[] {
  return [
    { id: 'video-1', name: 'Year Reel Video', type: 'video', height: 72 },
    { id: 'audio-1', name: 'Year Reel Audio', type: 'audio', height: 52 },
  ];
}

async function discoverCases(options: CliOptions): Promise<LoadedCase[]> {
  const entries = await fs.readdir(options.scanDir, { withFileTypes: true });
  const caseDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.includes(options.match))
    .map((entry) => path.join(options.scanDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  const loaded: LoadedCase[] = [];
  for (const caseDir of caseDirs) {
    const resultPath = path.join(caseDir, 'storyarc-wedding-e2e-result.json');
    if (!existsSync(resultPath)) {
      continue;
    }

    const parsed = JSON.parse(await fs.readFile(resultPath, 'utf8')) as CaseResultData;
    const sourceDurationSeconds = readNumber(parsed.source?.durationSeconds) || 0;
    if (!Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds <= 0) {
      continue;
    }

    const sourceVideoPath =
      (typeof parsed.source?.downloadedVideoPath === 'string' && parsed.source?.downloadedVideoPath) ||
      path.join(caseDir, 'source.mp4');
    const sourceAudioPath =
      (typeof parsed.audio?.enhancedAudioPath === 'string' && parsed.audio?.enhancedAudioPath) ||
      (typeof parsed.audio?.rawAudioPath === 'string' && parsed.audio?.rawAudioPath) ||
      path.join(caseDir, 'speech-clean.wav');

    if (!existsSync(sourceVideoPath)) {
      continue;
    }

    loaded.push({
      caseId: path.basename(caseDir),
      caseDir,
      resultPath,
      sourceDurationSeconds,
      sourceVideoPath: path.resolve(sourceVideoPath),
      sourceAudioPath: path.resolve(sourceAudioPath),
    });
  }

  return loaded;
}

function buildSourceClips(cases: LoadedCase[], segmentSeconds: number): {
  clips: BeatClip[];
  humanFeedbackByClipId: Record<string, 'approved'>;
} {
  const clips: BeatClip[] = [];
  const humanFeedbackByClipId: Record<string, 'approved'> = {};

  cases.forEach((entry, caseIndex) => {
    const cameraIds = ['cam-a', 'cam-b', 'cam-c'];
    const anchorTime = entry.sourceDurationSeconds * 0.38;
    let clipIndex = 0;

    for (let sourceStart = 0; sourceStart < entry.sourceDurationSeconds; sourceStart += segmentSeconds) {
      const duration = Math.min(segmentSeconds, entry.sourceDurationSeconds - sourceStart);
      if (duration <= 0) {
        continue;
      }

      const progress = sourceStart / Math.max(1, entry.sourceDurationSeconds);
      const emotionalValue = Number((Math.sin(progress * Math.PI * 2) * 0.32 + 0.2).toFixed(3));
      const beat = resolveBeatByProgress(progress);
      const clipId = `w${caseIndex + 1}-v${clipIndex + 1}`;
      const isAnchor = Math.abs(sourceStart - anchorTime) <= segmentSeconds;

      clips.push({
        id: clipId,
        name: `${entry.caseId} Segment ${clipIndex + 1}`,
        beatName: `${entry.caseId} Segment ${clipIndex + 1}`,
        start: Number(sourceStart.toFixed(3)),
        duration: Number(duration.toFixed(3)),
        ev: emotionalValue,
        synopsis: 'Wedding year-reel candidate clip',
        trackId: 'video-1',
        color: '#FF8A00',
        type: 'video',
        tags: ['wedding', 'year-reel', beat, isAnchor ? 'anchor' : 'candidate'],
        sourceFile: entry.sourceVideoPath,
        metadata: {
          inPoint: Number(sourceStart.toFixed(3)),
          outPoint: Number((sourceStart + duration).toFixed(3)),
          sourceDurationSeconds: Number(entry.sourceDurationSeconds.toFixed(3)),
          sourceWeddingId: entry.caseId,
          autoEditContext: {
            scene: 'wedding_year_reel',
            shotName: `shot_${clipIndex + 1}`,
            camera: cameraIds[clipIndex % cameraIds.length],
            speaker: entry.caseId,
            beatHint: beat,
            tags: ['wedding', 'year-reel', entry.caseId],
            transcriptKeywords: ['wedding', 'speech', 'vows', 'family', 'celebration'],
          },
          audioConfidence: 0.9,
          syncConfidence: 0.9,
        },
      });

      if (isAnchor) {
        humanFeedbackByClipId[clipId] = 'approved';
      }

      clipIndex += 1;
    }

    clips.push({
      id: `w${caseIndex + 1}-a1`,
      name: `${entry.caseId} Full Audio`,
      beatName: `${entry.caseId} Full Audio`,
      start: 0,
      duration: Number(entry.sourceDurationSeconds.toFixed(3)),
      ev: 0.1,
      synopsis: 'Wedding speech full audio bed',
      trackId: 'audio-1',
      color: '#23C3A6',
      type: 'audio',
      tags: ['wedding', 'year-reel', 'audio-bed'],
      sourceFile: entry.sourceAudioPath,
      metadata: {
        inPoint: 0,
        outPoint: Number(entry.sourceDurationSeconds.toFixed(3)),
        sourceDurationSeconds: Number(entry.sourceDurationSeconds.toFixed(3)),
        sourceWeddingId: entry.caseId,
        audioConfidence: 0.95,
        syncConfidence: 0.92,
      },
    });
  });

  return { clips, humanFeedbackByClipId };
}

function getSourceWeddingId(clip: BeatClip): string {
  const metadata = isRecord(clip.metadata) ? clip.metadata : null;
  const sourceWeddingId = metadata && typeof metadata.sourceWeddingId === 'string' ? metadata.sourceWeddingId : null;
  if (sourceWeddingId) {
    return sourceWeddingId;
  }
  return 'unknown';
}

function buildDiversityRanking(clips: BeatClip[]): {
  clipScores: Record<string, number>;
  rankedClipIds: string[];
  beatByClipId: Record<
    string,
    {
      beat: AutoEditNarrativeBeat;
      confidence: number;
      reason: string;
      source: 'heuristic';
    }
  >;
} {
  const videoClips = clips.filter((clip) => clip.trackId === 'video-1');
  const clipScores: Record<string, number> = {};
  const beatByClipId: Record<
    string,
    {
      beat: AutoEditNarrativeBeat;
      confidence: number;
      reason: string;
      source: 'heuristic';
    }
  > = {};

  for (const clip of videoClips) {
    const metadata = isRecord(clip.metadata) ? clip.metadata : null;
    const inPoint = readNumber(metadata?.inPoint) || 0;
    const outPoint = readNumber(metadata?.outPoint) || inPoint + clip.duration;
    const mid = (inPoint + outPoint) / 2;
    const sourceDuration = Math.max(1, readNumber(metadata?.sourceDurationSeconds) || 1);
    const normalizedMid = Math.min(1, Math.max(0, mid / sourceDuration));
    const ev = Number.isFinite(clip.ev) ? Math.min(1, Math.max(0, (clip.ev + 1) / 2)) : 0.5;
    const anchorBoost = Array.isArray(clip.tags) && clip.tags.includes('anchor') ? 0.2 : 0;
    clipScores[clip.id] = Math.min(
      1,
      Math.max(0, 0.45 + ev * 0.3 + (1 - Math.abs(0.5 - normalizedMid)) * 0.15 + anchorBoost)
    );

    const beat = resolveBeatByProgress(normalizedMid);
    beatByClipId[clip.id] = {
      beat,
      confidence: 0.86,
      reason: 'Progress-based beat mapping.',
      source: 'heuristic',
    };
  }

  const rankedClipIds = Object.entries(clipScores)
    .sort((left, right) => right[1] - left[1])
    .map(([clipId]) => clipId);

  return { clipScores, rankedClipIds, beatByClipId };
}

function selectedWeddingIds(selectedVideoClips: BeatClip[]): Set<string> {
  const ids = new Set<string>();
  selectedVideoClips.forEach((clip) => {
    ids.add(getSourceWeddingId(clip));
  });
  return ids;
}

function resolveClipSourceStart(clip: BeatClip): number {
  const metadata = isRecord(clip.metadata) ? clip.metadata : null;
  const autoEdit = metadata && isRecord(metadata.autoEdit) ? metadata.autoEdit : null;
  const inPoint = readNumber(metadata?.inPoint);
  const sourceStart = readNumber(autoEdit?.sourceStart);
  const fillerTrim = readNumber(autoEdit?.fillerTrim) || 0;
  const fillerApplied = autoEdit?.fillerCleanupApplied === true;
  const baseStart = inPoint ?? sourceStart ?? 0;
  const adjustedStart = fillerApplied ? baseStart + fillerTrim : baseStart;
  return Math.max(0, Number(adjustedStart.toFixed(3)));
}

async function renderYearReelVideo(
  outputDir: string,
  selectedVideoClips: BeatClip[],
  targetSeconds: number
): Promise<string> {
  const renderDir = path.join(outputDir, 'render-segments');
  await fs.mkdir(renderDir, { recursive: true });

  const sorted = [...selectedVideoClips].sort((left, right) => left.start - right.start);
  const segmentPaths: string[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const clip = sorted[index];
    const sourceFile = clip.sourceFile;
    if (!sourceFile || !existsSync(sourceFile)) {
      continue;
    }

    const sourceStart = resolveClipSourceStart(clip);
    const sourceDuration = Math.max(0.2, Number(clip.duration.toFixed(3)));
    const segmentPath = path.join(renderDir, `segment-${String(index + 1).padStart(3, '0')}.mp4`);

    const extract = await runCommand(
      'ffmpeg',
      [
        '-y',
        '-ss',
        sourceStart.toFixed(3),
        '-t',
        sourceDuration.toFixed(3),
        '-i',
        sourceFile,
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-vf',
        'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p',
        '-af',
        'aresample=48000',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-movflags',
        '+faststart',
        segmentPath,
      ],
      10 * 60_000
    );

    if (extract.code !== 0) {
      throw new Error(`Failed rendering segment ${index + 1}: ${(extract.stderr || extract.stdout).slice(-800)}`);
    }

    segmentPaths.push(segmentPath);
  }

  if (segmentPaths.length === 0) {
    throw new Error('No renderable video segments were created for year reel output');
  }

  const concatPath = path.join(renderDir, 'concat.txt');
  const concatContent = segmentPaths
    .map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`)
    .join('\n');
  await fs.writeFile(concatPath, concatContent + '\n');

  const outputVideoPath = path.join(outputDir, 'storyarc-year-reel-30s.mp4');
  const concat = await runCommand(
    'ffmpeg',
    [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatPath,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      '-t',
      targetSeconds.toFixed(3),
      outputVideoPath,
    ],
    12 * 60_000
  );

  if (concat.code !== 0) {
    throw new Error(`Failed final year-reel render: ${(concat.stderr || concat.stdout).slice(-1200)}`);
  }

  return outputVideoPath;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await fs.mkdir(options.outputDir, { recursive: true });

  const cases = await discoverCases(options);
  if (cases.length === 0) {
    throw new Error(`No E2E wedding cases found in ${options.scanDir} matching ${options.match}`);
  }

  const tracks = buildTracks();
  const { clips, humanFeedbackByClipId } = buildSourceClips(cases, options.segmentSeconds);
  const allWeddingIds = new Set(cases.map((entry) => entry.caseId));

  const baseOptions = getDefaultAutoEditOptions('reel-30');
  const autoEditOptions = {
    ...baseOptions,
    variant: options.variant,
    targetDurationSeconds: Number(options.targetSeconds.toFixed(3)),
    includeAssemble: true,
    includePolish: true,
    addMarkers: true,
    addAudioBed: true,
    enforceNoOverlap: true,
    enableDucking: true,
    enableJCutLCut: true,
    cleanupFillerPauses: false,
    minShotDurationSeconds: 0.2,
    maxShotDurationSeconds: 1.2,
    maxConsecutiveByCamera: 2,
    maxConsecutiveBySpeaker: 1,
    transitionDensity: 0.58,
  };

  const diversitySeed = buildDiversityRanking(clips);
  const clipScores: Record<string, number> = { ...diversitySeed.clipScores };
  let rankedClipIds = [...diversitySeed.rankedClipIds];
  const beatByClipId = { ...diversitySeed.beatByClipId };

  let alternatives: AutoEditAlternativesResult | null = null;
  let selectedVariant = options.variant;
  let selectedProposal = null as AutoEditAlternativesResult['alternatives'][AutoEditVariant] | null;
  let attemptsUsed = 0;
  let missingWeddingIds: string[] = [];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    attemptsUsed = attempt + 1;
    alternatives = createAutoEditAlternatives(
      {
        clips,
        tracks,
        frameRate: options.frameRate,
        transitions: [],
        markers: [],
        humanFeedbackByClipId,
        serverRanking: {
          clipScores,
          rankedClipIds,
          beatByClipId,
          confidence: 0.88,
          summary: ['Year reel diversity optimizer active.'],
          modelUsed: 'story-arc-year-reel-optimizer',
          analyzerAvailable: true,
        },
      },
      autoEditOptions
    );

    selectedProposal = alternatives.alternatives[selectedVariant] || alternatives.alternatives.balanced;
    const selectedVideos = selectedProposal.clips
      .filter((clip) => clip.trackId === 'video-1' && !String(clip.id).endsWith('-auto-bed'));
    const selectedWeddingSet = selectedWeddingIds(selectedVideos);

    missingWeddingIds = [...allWeddingIds].filter((id) => !selectedWeddingSet.has(id));
    if (missingWeddingIds.length === 0) {
      break;
    }

    // Boost scores for missing weddings and re-run once more.
    for (const clip of clips) {
      if (clip.trackId !== 'video-1') {
        continue;
      }
      const weddingId = getSourceWeddingId(clip);
      if (!missingWeddingIds.includes(weddingId)) {
        continue;
      }
      clipScores[clip.id] = Math.min(1, Math.max(0, (clipScores[clip.id] || 0.55) + 0.28));
    }

    rankedClipIds = Object.entries(clipScores)
      .sort((left, right) => right[1] - left[1])
      .map(([clipId]) => clipId);
  }

  if (!alternatives || !selectedProposal) {
    throw new Error('Failed to generate year-reel alternatives');
  }

  const selectedVideos = selectedProposal.clips
    .filter((clip) => clip.trackId === 'video-1' && !String(clip.id).endsWith('-auto-bed'))
    .sort((left, right) => left.start - right.start);
  const selectedWeddingSet = selectedWeddingIds(selectedVideos);

  const perWeddingContribution = [...selectedWeddingSet]
    .map((weddingId) => {
      const clipsForWedding = selectedVideos.filter((clip) => getSourceWeddingId(clip) === weddingId);
      const seconds = clipsForWedding.reduce((sum, clip) => sum + clip.duration, 0);
      return {
        weddingId,
        clipCount: clipsForWedding.length,
        durationSeconds: Number(seconds.toFixed(3)),
      };
    })
    .sort((left, right) => right.durationSeconds - left.durationSeconds);

  const selectedVideoCoverageSeconds = selectedVideos.reduce((sum, clip) => sum + clip.duration, 0);
  const sourceCoverageRatio =
    allWeddingIds.size > 0 ? Number((selectedWeddingSet.size / allWeddingIds.size).toFixed(4)) : 1;

  const renderOutputPath = options.renderVideo
    ? await renderYearReelVideo(options.outputDir, selectedVideos, options.targetSeconds)
    : null;

  const result = {
    generatedAt: new Date().toISOString(),
    input: {
      scanDir: options.scanDir,
      match: options.match,
      outputDir: options.outputDir,
      targetSeconds: options.targetSeconds,
      segmentSeconds: options.segmentSeconds,
      frameRate: options.frameRate,
      requestedVariant: options.variant,
      renderVideo: options.renderVideo,
    },
    sourcePool: {
      caseCount: cases.length,
      cases: cases.map((entry) => ({
        caseId: entry.caseId,
        caseDir: entry.caseDir,
        resultPath: entry.resultPath,
        sourceDurationSeconds: Number(entry.sourceDurationSeconds.toFixed(3)),
      })),
      clipCount: clips.length,
      videoClipCount: clips.filter((clip) => clip.trackId === 'video-1').length,
      audioClipCount: clips.filter((clip) => clip.trackId === 'audio-1').length,
    },
    optimization: {
      attemptsUsed,
      missingWeddingIdsAfterOptimization: missingWeddingIds,
      comparisonSummary: alternatives.comparisonSummary,
    },
    selected: {
      variant: selectedProposal.variant,
      proposalId: selectedProposal.proposalId,
      estimatedDurationSeconds: Number(selectedProposal.estimatedDurationSeconds.toFixed(3)),
      targetDurationSeconds: Number(selectedProposal.targetDurationSeconds.toFixed(3)),
      selectedVideoCoverageSeconds: Number(selectedVideoCoverageSeconds.toFixed(3)),
      selectedVideoClipCount: selectedVideos.length,
      selectedAudioClipCount: selectedProposal.clips.filter((clip) => clip.trackId === 'audio-1').length,
      uniqueWeddingCount: selectedWeddingSet.size,
      sourceCoverageRatio,
      perWeddingContribution,
    },
    storyValidationReport: selectedProposal.storyValidationReport,
    storyArcStudioImport: {
      tracks,
      clips: selectedProposal.clips,
      transitions: selectedProposal.transitions,
      markers: selectedProposal.markers,
      proposalId: selectedProposal.proposalId,
      variant: selectedProposal.variant,
    },
    render: {
      rendered: Boolean(renderOutputPath),
      outputVideoPath: renderOutputPath,
    },
  };

  const resultPath = path.join(options.outputDir, 'storyarc-year-reel-result.json');
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        resultPath,
        outputVideoPath: renderOutputPath,
        caseCount: cases.length,
        sourceVideoClipCount: result.sourcePool.videoClipCount,
        selectedVideoClipCount: result.selected.selectedVideoClipCount,
        sourceCoverageRatio: result.selected.sourceCoverageRatio,
        storyValidationScore: result.storyValidationReport.score,
        storyValidationPass: result.storyValidationReport.pass,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
