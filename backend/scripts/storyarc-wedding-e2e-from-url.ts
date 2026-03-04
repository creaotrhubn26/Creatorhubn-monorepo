#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createAutoEditAlternatives,
  getDefaultAutoEditOptions,
  type AutoEditVariant,
} from '../../frontend/client/src/services/auto-edit-engine';
import type { BeatClip, Track } from '../../frontend/client/src/services/storyArcDataIntegration';

interface CliOptions {
  videoUrl: string;
  outputDir: string;
  segmentSeconds: number;
  frameRate: number;
  variant: AutoEditVariant;
  ytDlpPythonBin: string;
  demucsPythonBin: string;
  demucsScriptPath: string;
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
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

  const videoUrl = (args.get('video-url') || '').trim();
  if (!videoUrl) {
    throw new Error('Missing required --video-url');
  }

  const variantRaw = (args.get('variant') || 'balanced').trim().toLowerCase();
  const variant: AutoEditVariant =
    variantRaw === 'safe' || variantRaw === 'balanced' || variantRaw === 'bold'
      ? variantRaw
      : 'balanced';

  const segmentSeconds = Number.parseFloat(args.get('segment-seconds') || '3.2');
  const frameRate = Number.parseInt(args.get('frame-rate') || '25', 10);
  const outputDir = args.get('output-dir')
    ? path.resolve(args.get('output-dir') as string)
    : path.join(process.cwd(), 'tmp', 'storyarc-wedding-e2e', new Date().toISOString().replace(/[:.]/g, '-'));

  const defaultVenvPython = path.join(process.cwd(), 'python-services', 'venv', 'bin', 'python');
  const demucsPythonBin =
    (args.get('demucs-python-bin') || process.env.AUDIO_MIX_DEMUCS_PYTHON_BIN || defaultVenvPython).trim();
  const ytDlpPythonBin =
    (args.get('yt-dlp-python-bin') || process.env.STORYARC_YTDLP_PYTHON_BIN || demucsPythonBin).trim();
  const demucsScriptPath = path.resolve(
    (args.get('demucs-script-path') || process.env.AUDIO_MIX_DEMUCS_SCRIPT_PATH || path.join(process.cwd(), 'scripts', 'audio_demucs_denoise.py')).trim()
  );

  return {
    videoUrl,
    outputDir,
    segmentSeconds: Number.isFinite(segmentSeconds) ? Math.max(1.2, Math.min(12, segmentSeconds)) : 3.2,
    frameRate: Number.isFinite(frameRate) ? Math.max(1, Math.min(120, frameRate)) : 25,
    variant,
    ytDlpPythonBin,
    demucsPythonBin,
    demucsScriptPath,
  };
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

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function resolveDownloadedVideoPath(outputDir: string, stdout: string): Promise<string> {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    if (existsSync(line)) {
      return path.resolve(line);
    }
  }

  const entries = await fs.readdir(outputDir);
  const candidates = entries
    .filter((entry) => /\.(mp4|mkv|webm|mov)$/i.test(entry))
    .map((entry) => path.join(outputDir, entry));
  if (candidates.length === 0) {
    throw new Error('Unable to locate downloaded video file');
  }
  const stats = await Promise.all(candidates.map(async (filePath) => ({ filePath, stat: await fs.stat(filePath) })));
  stats.sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs);
  return stats[0].filePath;
}

async function probeDurationSeconds(videoPath: string): Promise<number> {
  const probe = await runCommand(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath],
    60_000
  );
  if (probe.code !== 0) {
    throw new Error(`ffprobe failed: ${probe.stderr || probe.stdout}`);
  }
  const duration = Number.parseFloat(probe.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid video duration: ${probe.stdout.trim()}`);
  }
  return duration;
}

function buildTracks(): Track[] {
  return [
    { id: 'video-1', name: 'Wedding Speech Video', type: 'video', height: 72 },
    { id: 'audio-1', name: 'Wedding Speech Audio', type: 'audio', height: 52 },
  ];
}

function buildSourceClips(
  videoPath: string,
  cleanedAudioPath: string,
  durationSeconds: number,
  segmentSeconds: number
): BeatClip[] {
  const clips: BeatClip[] = [];
  let index = 0;
  for (let start = 0; start < durationSeconds; start += segmentSeconds) {
    const duration = Math.min(segmentSeconds, durationSeconds - start);
    if (duration <= 0) continue;
    const progress = Math.max(0, Math.min(1, start / Math.max(1, durationSeconds)));
    const emotionalValue = Number((Math.sin(progress * Math.PI * 2) * 0.28 + 0.18).toFixed(3));

    clips.push({
      id: `vid-${index + 1}`,
      name: `Speech Segment ${index + 1}`,
      beatName: `Speech Segment ${index + 1}`,
      start: Number(start.toFixed(3)),
      duration: Number(duration.toFixed(3)),
      ev: emotionalValue,
      synopsis: 'Wedding speech segment',
      trackId: 'video-1',
      color: '#FF8A00',
      type: 'video',
      tags: ['wedding', 'speech', 'full-source'],
      sourceFile: videoPath,
      metadata: {
        inPoint: Number(start.toFixed(3)),
        outPoint: Number((start + duration).toFixed(3)),
        autoEditContext: {
          scene: 'wedding_speech',
          shotName: `speech_${index + 1}`,
          camera: 'master',
          tags: ['wedding', 'speech'],
          transcriptKeywords: ['wedding', 'toast', 'speech', 'family'],
          moodHints: ['emotional', 'ceremony'],
        },
        audioConfidence: 0.9,
        syncConfidence: 0.88,
      },
    });
    index += 1;
  }

  clips.push({
    id: 'aud-full-1',
    name: 'Speech Full Audio',
    beatName: 'Speech Full Audio',
    start: 0,
    duration: Number(durationSeconds.toFixed(3)),
    ev: 0.24,
    synopsis: 'Full wedding speech audio bed',
    trackId: 'audio-1',
    color: '#23C3A6',
    type: 'audio',
    tags: ['wedding', 'speech', 'full-audio'],
    sourceFile: cleanedAudioPath,
    metadata: {
      inPoint: 0,
      outPoint: Number(durationSeconds.toFixed(3)),
      autoEditContext: {
        scene: 'wedding_speech_audio',
        shotName: 'full_audio',
        tags: ['wedding', 'speech'],
        transcriptKeywords: ['wedding', 'toast', 'speech', 'family'],
      },
      audioConfidence: 0.95,
      syncConfidence: 0.92,
    },
  });

  return clips;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await ensureDir(options.outputDir);

  const downloadTemplate = path.join(options.outputDir, 'source.%(ext)s');
  const ytDlpArgs = [
    '-m',
    'yt_dlp',
    '--no-playlist',
    '--merge-output-format',
    'mp4',
    '--print',
    'after_move:filepath',
    '-f',
    'bv*+ba/b',
    '-o',
    downloadTemplate,
    options.videoUrl,
  ];
  const download = await runCommand(options.ytDlpPythonBin, ytDlpArgs, 30 * 60_000);
  if (download.code !== 0) {
    throw new Error(`yt-dlp failed: ${(download.stderr || download.stdout).slice(-1200)}`);
  }

  const videoPath = await resolveDownloadedVideoPath(options.outputDir, `${download.stdout}\n${download.stderr}`);
  const durationSeconds = await probeDurationSeconds(videoPath);

  const rawAudioPath = path.join(options.outputDir, 'speech-raw.wav');
  const cleanAudioPath = path.join(options.outputDir, 'speech-clean.wav');
  const extract = await runCommand(
    'ffmpeg',
    ['-y', '-i', videoPath, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s24le', rawAudioPath],
    20 * 60_000
  );
  if (extract.code !== 0 || !existsSync(rawAudioPath)) {
    throw new Error(`ffmpeg extract failed: ${(extract.stderr || extract.stdout).slice(-1200)}`);
  }

  let enhancedAudioPath = rawAudioPath;
  let demucsApplied = false;
  if (existsSync(options.demucsScriptPath)) {
    const demucs = await runCommand(
      options.demucsPythonBin,
      [
        options.demucsScriptPath,
        '--input',
        rawAudioPath,
        '--output',
        cleanAudioPath,
        '--model',
        'htdemucs',
        '--device',
        'auto',
        '--target-sr',
        '48000',
        '--alpha',
        '0.97',
        '--wiener-floor',
        '0.05',
        '--noise-quantile',
        '0.2',
      ],
      30 * 60_000
    );
    if (demucs.code === 0 && existsSync(cleanAudioPath)) {
      enhancedAudioPath = cleanAudioPath;
      demucsApplied = true;
    }
  }

  const tracks = buildTracks();
  const clips = buildSourceClips(videoPath, enhancedAudioPath, durationSeconds, options.segmentSeconds);

  const baseOptions = getDefaultAutoEditOptions('interview');
  const autoEditOptions = {
    ...baseOptions,
    preset: 'interview' as const,
    variant: options.variant,
    targetDurationSeconds: Number(durationSeconds.toFixed(3)),
    includeAssemble: true,
    includePolish: true,
    addMarkers: true,
    addAudioBed: true,
    enforceNoOverlap: true,
    enableDucking: true,
    enableJCutLCut: true,
    cleanupFillerPauses: true,
    minShotDurationSeconds: Math.max(1, Math.min(2.6, options.segmentSeconds * 0.8)),
    maxShotDurationSeconds: Math.max(options.segmentSeconds, 6.5),
    transitionDensity: 0.42,
  };

  const alternatives = createAutoEditAlternatives(
    {
      clips,
      tracks,
      frameRate: options.frameRate,
      transitions: [],
      markers: [],
    },
    autoEditOptions
  );

  const selected = alternatives.alternatives[options.variant] || alternatives.alternatives.balanced;
  const videoClipCoverageSeconds = selected.clips
    .filter((clip) => clip.trackId === 'video-1')
    .reduce((sum, clip) => sum + clip.duration, 0);

  const result = {
    generatedAt: new Date().toISOString(),
    source: {
      videoUrl: options.videoUrl,
      downloadedVideoPath: videoPath,
      durationSeconds: Number(durationSeconds.toFixed(3)),
      usedWholeSource: true,
    },
    audio: {
      rawAudioPath,
      enhancedAudioPath,
      demucsApplied,
      pipeline: demucsApplied ? 'demucs+wiener' : 'raw-audio-fallback',
    },
    clipping: {
      segmentSeconds: options.segmentSeconds,
      frameRate: options.frameRate,
      sourceClipCount: clips.length,
      videoSegmentCount: clips.filter((clip) => clip.trackId === 'video-1').length,
      selectedVariant: selected.variant,
      selectedVideoCoverageSeconds: Number(videoClipCoverageSeconds.toFixed(3)),
      selectedCoverageRatio: Number((videoClipCoverageSeconds / Math.max(durationSeconds, 1)).toFixed(4)),
      selectedEstimatedDurationSeconds: Number(selected.estimatedDurationSeconds.toFixed(3)),
    },
    storyValidationReport: selected.storyValidationReport,
    alternativesSummary: alternatives.comparisonSummary,
    autoEditOptions,
    storyArcStudioImport: {
      tracks,
      clips: selected.clips,
      transitions: selected.transitions,
      markers: selected.markers,
      proposalId: selected.proposalId,
      variant: selected.variant,
    },
    alternatives,
  };

  const resultPath = path.join(options.outputDir, 'storyarc-wedding-e2e-result.json');
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        resultPath,
        durationSeconds: result.source.durationSeconds,
        sourceClipCount: result.clipping.sourceClipCount,
        demucsApplied: result.audio.demucsApplied,
        selectedVariant: result.clipping.selectedVariant,
        selectedCoverageRatio: result.clipping.selectedCoverageRatio,
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
