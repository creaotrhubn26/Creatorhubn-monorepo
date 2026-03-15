#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

type PhaseId =
  | 'opening'
  | 'prep'
  | 'ceremony'
  | 'portraits'
  | 'speeches'
  | 'party';

interface CliOptions {
  inputDir: string;
  outputDir: string;
  targetMinutes: number;
  frameRate: number;
  resolution: string;
  maxProbeFiles: number;
  minSourceDuration: number;
}

interface FfprobeJson {
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
    tags?: Record<string, string>;
  }>;
  format?: {
    duration?: string;
    tags?: Record<string, string>;
  };
}

interface SourceClip {
  id: string;
  path: string;
  angle: string;
  cameraRoot: string;
  startMs: number;
  durationSec: number;
  hasVideo: boolean;
  hasAudio: boolean;
  width: number;
  height: number;
}

interface StorySegment {
  id: string;
  sourceId: string;
  sourcePath: string;
  sourceAngle: string;
  phase: PhaseId;
  timelineStartSec: number;
  durationSec: number;
  sourceInSec: number;
}

interface AudioSource {
  id: string;
  path: string;
  label: string;
  durationSec: number;
  narrativeOrder: number;
}

interface AudioSegment {
  id: string;
  sourceId: string;
  sourcePath: string;
  sourceInSec: number;
  timelineStartSec: number;
  durationSec: number;
  label: string;
}

interface PhaseConfig {
  id: PhaseId;
  fromRatio: number;
  toRatio: number;
  weight: number;
  minShotSec: number;
  maxShotSec: number;
}

const VIDEO_EXTENSIONS = new Set(['.mxf', '.mp4', '.mov', '.mkv', '.avi']);

const PHASES: PhaseConfig[] = [
  { id: 'opening', fromRatio: 0.0, toRatio: 0.12, weight: 0.1, minShotSec: 3.0, maxShotSec: 6.5 },
  { id: 'prep', fromRatio: 0.12, toRatio: 0.3, weight: 0.18, minShotSec: 4.0, maxShotSec: 8.0 },
  { id: 'ceremony', fromRatio: 0.3, toRatio: 0.58, weight: 0.31, minShotSec: 5.0, maxShotSec: 11.0 },
  { id: 'portraits', fromRatio: 0.58, toRatio: 0.74, weight: 0.13, minShotSec: 4.0, maxShotSec: 8.5 },
  { id: 'speeches', fromRatio: 0.74, toRatio: 0.92, weight: 0.2, minShotSec: 5.0, maxShotSec: 10.0 },
  { id: 'party', fromRatio: 0.92, toRatio: 1.0, weight: 0.08, minShotSec: 3.0, maxShotSec: 7.0 },
];

const parseArgs = (argv: string[]): CliOptions => {
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

  const inputDirRaw = (args.get('input-dir') || '').trim();
  if (!inputDirRaw) {
    throw new Error('Missing required --input-dir');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDirRaw =
    (args.get('output-dir') || '').trim() ||
    path.join(process.cwd(), 'tmp', 'storyarc-local-drafts', timestamp);

  const targetMinutesRaw = Number.parseFloat(args.get('target-minutes') || '45');
  const frameRateRaw = Number.parseInt(args.get('frame-rate') || '25', 10);
  const maxProbeFilesRaw = Number.parseInt(args.get('max-probe-files') || '0', 10);
  const minSourceDurationRaw = Number.parseFloat(args.get('min-source-duration') || '3');

  return {
    inputDir: path.resolve(inputDirRaw),
    outputDir: path.resolve(outputDirRaw),
    targetMinutes: Number.isFinite(targetMinutesRaw) ? Math.max(10, Math.min(180, targetMinutesRaw)) : 45,
    frameRate: Number.isFinite(frameRateRaw) ? Math.max(23, Math.min(60, frameRateRaw)) : 25,
    resolution: (args.get('resolution') || '3840x2160').trim(),
    maxProbeFiles: Number.isFinite(maxProbeFilesRaw) ? Math.max(0, maxProbeFilesRaw) : 0,
    minSourceDuration: Number.isFinite(minSourceDurationRaw) ? Math.max(1.5, Math.min(20, minSourceDurationRaw)) : 3,
  };
};

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const toPathUrl = (filePath: string): string => {
  const encoded = encodeURI(filePath).replaceAll('#', '%23');
  return `file://localhost${encoded}`;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const listFilesRecursive = async (rootDir: string, extensions?: Set<string>): Promise<string[]> => {
  const results: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!extensions || extensions.has(extension)) {
        results.push(nextPath);
      }
    }
  }
  return results.sort((left, right) => left.localeCompare(right));
};

const listAudioFiles = async (rootDir: string): Promise<string[]> => {
  return listFilesRecursive(rootDir, new Set(['.wav']));
};

const runCommand = async (command: string, args: string[]): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }
      resolve(stdout);
    });
  });

const parseTimestampFromCanonName = (filePath: string): number | null => {
  const baseName = path.basename(filePath);
  const match = baseName.match(/A(\d{6})_(\d{6})/i);
  if (!match) return null;
  const datePart = match[1];
  const timePart = match[2];
  const year = Number.parseInt(datePart.slice(0, 2), 10) + 2000;
  const month = Number.parseInt(datePart.slice(2, 4), 10);
  const day = Number.parseInt(datePart.slice(4, 6), 10);
  const hour = Number.parseInt(timePart.slice(0, 2), 10);
  const minute = Number.parseInt(timePart.slice(2, 4), 10);
  const second = Number.parseInt(timePart.slice(4, 6), 10);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }
  return new Date(year, month - 1, day, hour, minute, second).getTime();
};

const resolveAngle = (filePath: string): { cameraRoot: string; angle: string } => {
  const normalized = filePath.replaceAll('\\', '/');
  const patterns: Array<[RegExp, string, string]> = [
    [/\/Camera_1\/Canon_C80_1\//i, 'camera_1', 'canon_c80_1'],
    [/\/Camera_1\/Canon_C80_2\//i, 'camera_1', 'canon_c80_2'],
    [/\/Camera_4\/Sony FX3_1\//i, 'camera_4', 'sony_fx3_1'],
    [/\/Camera_4\/Sony FX3_2\//i, 'camera_4', 'sony_fx3_2'],
    [/\/Camera_4\/Sony Fx3_3\//i, 'camera_4', 'sony_fx3_3'],
  ];

  for (const [regex, cameraRoot, angle] of patterns) {
    if (regex.test(normalized)) {
      return { cameraRoot, angle };
    }
  }

  const cameraRoot = normalized.match(/\/(Camera_[^/]+)\//i)?.[1]?.toLowerCase() || 'unknown_camera';
  const parent = path.basename(path.dirname(filePath)).toLowerCase().replaceAll(/\s+/g, '_');
  return {
    cameraRoot,
    angle: `${cameraRoot}_${parent}`,
  };
};

const probeSourceClip = async (filePath: string): Promise<SourceClip | null> => {
  const ffprobeOutput = await runCommand('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);

  const parsed = JSON.parse(ffprobeOutput) as FfprobeJson;
  const durationSec = Number.parseFloat(parsed.format?.duration || '');
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return null;
  }

  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStream = streams.find((stream) => stream.codec_type === 'video');
  const audioStream = streams.find((stream) => stream.codec_type === 'audio');
  const hasVideo = Boolean(videoStream);
  if (!hasVideo) return null;

  const tagCreationTime =
    parsed.format?.tags?.creation_time ||
    videoStream?.tags?.creation_time ||
    audioStream?.tags?.creation_time ||
    null;

  const filenameTimestamp = parseTimestampFromCanonName(filePath);
  const tagTimestamp = tagCreationTime ? Date.parse(tagCreationTime) : Number.NaN;
  const stat = await fs.stat(filePath);
  const startMs = Number.isFinite(filenameTimestamp)
    ? (filenameTimestamp as number)
    : Number.isFinite(tagTimestamp)
      ? tagTimestamp
      : stat.mtimeMs;

  const { cameraRoot, angle } = resolveAngle(filePath);

  return {
    id: `src-${Math.abs(hashString(filePath))}`,
    path: filePath,
    angle,
    cameraRoot,
    startMs,
    durationSec: Number(durationSec.toFixed(3)),
    hasVideo,
    hasAudio: Boolean(audioStream),
    width: Math.max(0, Math.round(videoStream?.width || 0)),
    height: Math.max(0, Math.round(videoStream?.height || 0)),
  };
};

const rankAudioNarrative = (filePath: string): number => {
  const normalized = path.basename(filePath).toLowerCase();
  if (normalized.includes('first look') && normalized.includes('lemy')) return 1;
  if (normalized.includes('first look') && normalized.includes('ole')) return 2;
  if (normalized.includes('vielse') && normalized.includes('ole') && !normalized.includes('first look')) return 3;
  if (normalized.includes('toastmaster')) return 4;
  if (normalized.includes('forlover 1')) return 5;
  if (normalized.includes('forlover 2')) return 6;
  if (normalized.includes('brudens mor')) return 7;
  if (normalized.includes('vielse')) return 8;
  if (normalized.includes('tale')) return 9;
  return 20;
};

const probeAudioSource = async (filePath: string): Promise<AudioSource | null> => {
  const ffprobeOutput = await runCommand('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);

  const parsed = JSON.parse(ffprobeOutput) as FfprobeJson;
  const durationSec = Number.parseFloat(parsed.format?.duration || '');
  if (!Number.isFinite(durationSec) || durationSec <= 0.5) {
    return null;
  }

  return {
    id: `aud-${Math.abs(hashString(filePath))}`,
    path: filePath,
    label: path.basename(filePath, path.extname(filePath)),
    durationSec: Number(durationSec.toFixed(3)),
    narrativeOrder: rankAudioNarrative(filePath),
  };
};

const buildNarrativeAudioSegments = (
  audioSources: AudioSource[],
  targetSeconds: number
): AudioSegment[] => {
  const ordered = [...audioSources].sort((left, right) => {
    if (left.narrativeOrder !== right.narrativeOrder) {
      return left.narrativeOrder - right.narrativeOrder;
    }
    return left.path.localeCompare(right.path);
  });

  const segments: AudioSegment[] = [];
  const consumedBySource = new Map<string, number>();
  let cursorSec = 0;
  let segmentCounter = 0;

  const preferredIntroTakeSec = (source: AudioSource): number => {
    const label = source.label.toLowerCase();
    if (label.includes('first look') && label.includes('lemy')) return Math.min(source.durationSec, 540);
    if (label.includes('first look') && label.includes('ole')) return Math.min(source.durationSec, 540);
    if (label.includes('vielse') && label.includes('ole') && !label.includes('first look')) return Math.min(source.durationSec, 420);
    if (label.includes('toastmaster')) return Math.min(source.durationSec, 300);
    if (label.includes('forlover 1')) return Math.min(source.durationSec, 360);
    if (label.includes('forlover 2')) return Math.min(source.durationSec, 360);
    if (label.includes('brudens mor')) return Math.min(source.durationSec, 360);
    if (label.includes('tale')) return Math.min(source.durationSec, 300);
    return Math.min(source.durationSec, 360);
  };

  for (const source of ordered) {
    if (cursorSec >= targetSeconds) break;
    const remaining = targetSeconds - cursorSec;
    const takeDuration = Math.min(preferredIntroTakeSec(source), remaining);
    if (takeDuration < 2) continue;
    segmentCounter += 1;
    segments.push({
      id: `aud-seg-${segmentCounter}`,
      sourceId: source.id,
      sourcePath: source.path,
      sourceInSec: 0,
      timelineStartSec: Number(cursorSec.toFixed(3)),
      durationSec: Number(takeDuration.toFixed(3)),
      label: source.label,
    });
    consumedBySource.set(source.id, takeDuration);
    cursorSec += takeDuration;
  }

  // Fill remaining timeline with additional passages from the same files,
  // continuing from where each source was last consumed.
  while (cursorSec < targetSeconds - 1) {
    let addedAny = false;
    for (const source of ordered) {
      if (cursorSec >= targetSeconds - 1) break;
      const consumed = consumedBySource.get(source.id) || 0;
      const remainingInSource = source.durationSec - consumed;
      if (remainingInSource < 25) continue;

      const remainingTimeline = targetSeconds - cursorSec;
      const takeDuration = Math.min(180, remainingInSource, remainingTimeline);
      if (takeDuration < 20) continue;

      segmentCounter += 1;
      segments.push({
        id: `aud-seg-${segmentCounter}`,
        sourceId: source.id,
        sourcePath: source.path,
        sourceInSec: Number(consumed.toFixed(3)),
        timelineStartSec: Number(cursorSec.toFixed(3)),
        durationSec: Number(takeDuration.toFixed(3)),
        label: source.label,
      });
      consumedBySource.set(source.id, consumed + takeDuration);
      cursorSec += takeDuration;
      addedAny = true;
    }
    if (!addedAny) break;
  }

  return segments;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length) as R[];
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  };

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runWorker());
  await Promise.all(workers);
  return results;
};

const overlapsWindow = (
  clip: SourceClip,
  windowStartMs: number,
  windowEndMs: number
): boolean => {
  const clipEnd = clip.startMs + clip.durationSec * 1000;
  return clip.startMs < windowEndMs && clipEnd > windowStartMs;
};

const getShotDuration = (
  clip: SourceClip,
  phase: PhaseConfig,
  targetRemainingSec: number
): number => {
  const preferred = clamp(clip.durationSec * 0.42, phase.minShotSec, phase.maxShotSec);
  return clamp(preferred, Math.min(phase.minShotSec, targetRemainingSec), Math.min(phase.maxShotSec, targetRemainingSec));
};

const getSourceInPoint = (clip: SourceClip, durationSec: number): number => {
  if (clip.durationSec <= durationSec + 0.2) {
    return 0;
  }
  const maxIn = Math.max(0, clip.durationSec - durationSec);
  const jitter = Math.abs(hashString(clip.path)) % 1000;
  const ratio = clamp(jitter / 1000, 0.12, 0.78);
  return Number((maxIn * ratio).toFixed(3));
};

const buildStorySegments = (
  clips: SourceClip[],
  targetSeconds: number
): StorySegment[] => {
  const ordered = [...clips].sort((left, right) => {
    if (left.startMs !== right.startMs) return left.startMs - right.startMs;
    return left.path.localeCompare(right.path);
  });
  const globalStart = ordered[0]?.startMs || Date.now();
  const globalEnd =
    ordered.reduce((max, clip) => Math.max(max, clip.startMs + clip.durationSec * 1000), globalStart + 1_000);
  const globalSpan = Math.max(1_000, globalEnd - globalStart);

  const chosen: StorySegment[] = [];
  const usedSourceIds = new Set<string>();
  let cursorSec = 0;
  let lastAngle = '';
  let segmentCounter = 0;

  for (const phase of PHASES) {
    const phaseTargetSec = targetSeconds * phase.weight;
    let phaseCollected = 0;

    const phaseWindowStart = globalStart + globalSpan * phase.fromRatio;
    const phaseWindowEnd = globalStart + globalSpan * phase.toRatio;
    const candidates = ordered.filter((clip) => overlapsWindow(clip, phaseWindowStart, phaseWindowEnd));
    const availableAngles = new Set(candidates.map((clip) => clip.angle));

    for (let index = 0; index < candidates.length && phaseCollected < phaseTargetSec; index += 1) {
      const clip = candidates[index];
      if (usedSourceIds.has(clip.id) && clip.durationSec < phase.maxShotSec * 1.5) {
        continue;
      }

      if (clip.angle === lastAngle && availableAngles.size > 1) {
        const hasOtherAngleAhead = candidates.slice(index + 1).some((entry) => entry.angle !== lastAngle);
        if (hasOtherAngleAhead) {
          continue;
        }
      }

      const remaining = Number((phaseTargetSec - phaseCollected).toFixed(3));
      if (remaining < 2.2) break;
      const shotDuration = getShotDuration(clip, phase, remaining);
      if (!Number.isFinite(shotDuration) || shotDuration < 2.2) continue;
      const sourceInSec = getSourceInPoint(clip, shotDuration);

      segmentCounter += 1;
      chosen.push({
        id: `segment-${segmentCounter}`,
        sourceId: clip.id,
        sourcePath: clip.path,
        sourceAngle: clip.angle,
        phase: phase.id,
        timelineStartSec: Number(cursorSec.toFixed(3)),
        durationSec: Number(shotDuration.toFixed(3)),
        sourceInSec,
      });

      cursorSec += shotDuration;
      phaseCollected += shotDuration;
      lastAngle = clip.angle;
      usedSourceIds.add(clip.id);
    }
  }

  if (cursorSec < targetSeconds) {
    for (const clip of ordered) {
      if (cursorSec >= targetSeconds) break;
      if (clip.angle === lastAngle) continue;
      const remaining = targetSeconds - cursorSec;
      if (remaining < 2.2) break;
      const fillDuration = clamp(Math.min(clip.durationSec * 0.35, 6.5), 3.2, Math.min(8.5, remaining));
      const sourceInSec = getSourceInPoint(clip, fillDuration);
      segmentCounter += 1;
      chosen.push({
        id: `segment-${segmentCounter}`,
        sourceId: clip.id,
        sourcePath: clip.path,
        sourceAngle: clip.angle,
        phase: 'party',
        timelineStartSec: Number(cursorSec.toFixed(3)),
        durationSec: Number(fillDuration.toFixed(3)),
        sourceInSec,
      });
      cursorSec += fillDuration;
      lastAngle = clip.angle;
    }
  }

  return chosen;
};

const buildResolveXml = (
  segments: StorySegment[],
  sourceById: Map<string, SourceClip>,
  audioSegments: AudioSegment[],
  options: CliOptions
): string => {
  const frameRate = options.frameRate;
  const resolution = options.resolution;
  const width = Number.parseInt(resolution.split('x')[0] || '3840', 10);
  const height = Number.parseInt(resolution.split('x')[1] || '2160', 10);
  const totalDurationSec = segments.reduce((sum, segment) => sum + segment.durationSec, 0);
  const totalDurationFrames = Math.max(1, Math.round(totalDurationSec * frameRate));

  const videoClipItems = segments
    .map((segment, index) => {
      const source = sourceById.get(segment.sourceId);
      if (!source) return '';
      const startFrame = Math.round(segment.timelineStartSec * frameRate);
      const endFrame = Math.round((segment.timelineStartSec + segment.durationSec) * frameRate);
      const inFrame = Math.round(segment.sourceInSec * frameRate);
      const outFrame = Math.round((segment.sourceInSec + segment.durationSec) * frameRate);
      const sourceFrames = Math.max(1, Math.round(source.durationSec * frameRate));
      const clipName = path.basename(source.path);
      const clipId = `v-${index + 1}`;
      const fileId = `file-${Math.abs(hashString(source.path))}`;

      return [
        `              <clipitem id="${clipId}">`,
        `                <name>${escapeXml(clipName)}</name>`,
        '                <enabled>TRUE</enabled>',
        `                <start>${startFrame}</start>`,
        `                <end>${endFrame}</end>`,
        `                <in>${inFrame}</in>`,
        `                <out>${outFrame}</out>`,
        `                <file id="${fileId}">`,
        `                  <name>${escapeXml(clipName)}</name>`,
        `                  <pathurl>${escapeXml(toPathUrl(source.path))}</pathurl>`,
        '                  <rate>',
        `                    <timebase>${frameRate}</timebase>`,
        '                    <ntsc>FALSE</ntsc>',
        '                  </rate>',
        `                  <duration>${sourceFrames}</duration>`,
        '                  <media>',
        '                    <video>',
        '                      <samplecharacteristics>',
        '                        <rate>',
        `                          <timebase>${frameRate}</timebase>`,
        '                          <ntsc>FALSE</ntsc>',
        '                        </rate>',
        `                        <width>${Math.max(width, source.width || width)}</width>`,
        `                        <height>${Math.max(height, source.height || height)}</height>`,
        '                      </samplecharacteristics>',
        '                    </video>',
        '                  </media>',
        '                </file>',
        '              </clipitem>',
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n');

  const fallbackAudioSegments = segments.map<AudioSegment>((segment, index) => ({
    id: `fallback-aud-${index + 1}`,
    sourceId: segment.sourceId,
    sourcePath: segment.sourcePath,
    sourceInSec: segment.sourceInSec,
    timelineStartSec: segment.timelineStartSec,
    durationSec: segment.durationSec,
    label: path.basename(segment.sourcePath),
  }));

  const effectiveAudioSegments = audioSegments.length > 0 ? audioSegments : fallbackAudioSegments;

  const audioClipItems = effectiveAudioSegments
    .map((segment, index) => {
      const sourceClip = sourceById.get(segment.sourceId);
      const sourceDurationSec = sourceClip?.durationSec || segment.durationSec;
      const startFrame = Math.round(segment.timelineStartSec * frameRate);
      const endFrame = Math.round((segment.timelineStartSec + segment.durationSec) * frameRate);
      const inFrame = Math.round(segment.sourceInSec * frameRate);
      const outFrame = Math.round((segment.sourceInSec + segment.durationSec) * frameRate);
      const sourceFrames = Math.max(1, Math.round(sourceDurationSec * frameRate));
      const clipName = path.basename(segment.sourcePath);
      const clipId = `a-${index + 1}`;
      const fileId = `afile-${Math.abs(hashString(segment.sourcePath))}`;
      return [
        `              <clipitem id="${clipId}">`,
        `                <name>${escapeXml(clipName)}_A1</name>`,
        '                <enabled>TRUE</enabled>',
        `                <start>${startFrame}</start>`,
        `                <end>${endFrame}</end>`,
        `                <in>${inFrame}</in>`,
        `                <out>${outFrame}</out>`,
        `                <file id="${fileId}">`,
        `                  <name>${escapeXml(clipName)}</name>`,
        `                  <pathurl>${escapeXml(toPathUrl(segment.sourcePath))}</pathurl>`,
        '                  <rate>',
        `                    <timebase>${frameRate}</timebase>`,
        '                    <ntsc>FALSE</ntsc>',
        '                  </rate>',
        `                  <duration>${sourceFrames}</duration>`,
        '                </file>',
        '              </clipitem>',
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE xmeml>',
    '<xmeml version="4">',
    '  <project>',
    '    <name>StoryArc_Wedding_Draft_45min</name>',
    '    <children>',
    '      <sequence id="storyarc-sequence-1">',
    '        <name>StoryArc_Wedding_Draft_45min</name>',
    `        <duration>${totalDurationFrames}</duration>`,
    '        <rate>',
    `          <timebase>${frameRate}</timebase>`,
    '          <ntsc>FALSE</ntsc>',
    '        </rate>',
    '        <timecode>',
    '          <rate>',
    `            <timebase>${frameRate}</timebase>`,
    '            <ntsc>FALSE</ntsc>',
    '          </rate>',
    '          <string>01:00:00:00</string>',
    '          <frame>0</frame>',
    '          <source>source</source>',
    '          <displayformat>NDF</displayformat>',
    '        </timecode>',
    '        <media>',
    '          <video>',
    '            <format>',
    '              <samplecharacteristics>',
    '                <rate>',
    `                  <timebase>${frameRate}</timebase>`,
    '                  <ntsc>FALSE</ntsc>',
    '                </rate>',
    `                <width>${width}</width>`,
    `                <height>${height}</height>`,
    '                <pixelaspectratio>square</pixelaspectratio>',
    '                <fielddominance>none</fielddominance>',
    '              </samplecharacteristics>',
    '            </format>',
    '            <track>',
    '              <name>V1 Story Arc Draft</name>',
    '              <enabled>TRUE</enabled>',
    '              <locked>FALSE</locked>',
    videoClipItems,
    '            </track>',
    '          </video>',
    '          <audio>',
    '            <format>',
    '              <samplecharacteristics>',
    '                <depth>16</depth>',
    '                <samplerate>48000</samplerate>',
    '              </samplecharacteristics>',
    '            </format>',
    '            <track>',
    '              <name>A1 Production Audio</name>',
    '              <enabled>TRUE</enabled>',
    '              <locked>FALSE</locked>',
    audioClipItems,
    '            </track>',
    '          </audio>',
    '        </media>',
    '      </sequence>',
    '    </children>',
    '  </project>',
    '</xmeml>',
    '',
  ].join('\n');
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  await fs.mkdir(options.outputDir, { recursive: true });

  const allVideoFiles = await listFilesRecursive(options.inputDir, VIDEO_EXTENSIONS);
  if (allVideoFiles.length === 0) {
    throw new Error(`No video files found in ${options.inputDir}`);
  }
  const allAudioFiles = await listAudioFiles(options.inputDir);

  const videoFiles = options.maxProbeFiles > 0 ? allVideoFiles.slice(0, options.maxProbeFiles) : allVideoFiles;
  console.log(`Scanning ${videoFiles.length} video files...`);

  let completed = 0;
  const probed = await mapWithConcurrency(videoFiles, 6, async (filePath, index) => {
    try {
      const clip = await probeSourceClip(filePath);
      completed += 1;
      if (completed % 25 === 0 || completed === videoFiles.length) {
        console.log(`Probed ${completed}/${videoFiles.length}`);
      }
      return clip;
    } catch (error) {
      completed += 1;
      console.warn(`Probe failed (${index + 1}/${videoFiles.length}): ${filePath}`);
      return null;
    }
  });

  const sourceClips = probed
    .filter((clip): clip is SourceClip => clip !== null)
    .filter((clip) => clip.durationSec >= options.minSourceDuration)
    .sort((left, right) => left.startMs - right.startMs);

  if (sourceClips.length === 0) {
    throw new Error('No probeable clips with sufficient duration were found.');
  }

  const targetSeconds = options.targetMinutes * 60;
  const segments = buildStorySegments(sourceClips, targetSeconds);
  if (segments.length === 0) {
    throw new Error('Draft generator did not produce any timeline segments.');
  }

  const probedAudio = await mapWithConcurrency(allAudioFiles, 4, async (audioPath) => {
    try {
      return await probeAudioSource(audioPath);
    } catch {
      return null;
    }
  });
  const audioSources = probedAudio.filter((entry): entry is AudioSource => entry !== null);
  const audioSegments = buildNarrativeAudioSegments(audioSources, targetSeconds);

  const sourceById = new Map(sourceClips.map((clip) => [clip.id, clip]));
  audioSources.forEach((source) => {
    sourceById.set(source.id, {
      id: source.id,
      path: source.path,
      angle: 'audio_source',
      cameraRoot: 'audio',
      startMs: 0,
      durationSec: source.durationSec,
      hasVideo: false,
      hasAudio: true,
      width: 0,
      height: 0,
    });
  });
  const xml = buildResolveXml(segments, sourceById, audioSegments, options);

  const xmlPath = path.join(options.outputDir, 'storyarc-wedding-draft.xml');
  const decisionsPath = path.join(options.outputDir, 'storyarc-wedding-draft-segments.json');
  const summaryPath = path.join(options.outputDir, 'storyarc-wedding-draft-summary.json');

  const totalTimelineSeconds = Number(segments.reduce((sum, segment) => sum + segment.durationSec, 0).toFixed(3));
  const usedAngles = Array.from(new Set(segments.map((segment) => segment.sourceAngle))).sort();
  const phaseUsage = PHASES.reduce<Record<string, number>>((acc, phase) => {
    acc[phase.id] = Number(
      segments
        .filter((segment) => segment.phase === phase.id)
        .reduce((sum, segment) => sum + segment.durationSec, 0)
        .toFixed(3)
    );
    return acc;
  }, {});

  const summary = {
    generatedAt: new Date().toISOString(),
    inputDir: options.inputDir,
    outputDir: options.outputDir,
    targetMinutes: options.targetMinutes,
    frameRate: options.frameRate,
    resolution: options.resolution,
    discoveredVideoFiles: allVideoFiles.length,
    probedVideoFiles: videoFiles.length,
    usableSourceClips: sourceClips.length,
    generatedSegments: segments.length,
    generatedAudioSegments: audioSegments.length,
    totalTimelineSeconds,
    totalTimelineMinutes: Number((totalTimelineSeconds / 60).toFixed(3)),
    usedAngles,
    detectedNarrativeAudioSources: audioSources.map((source) => ({
      label: source.label,
      durationSec: source.durationSec,
      narrativeOrder: source.narrativeOrder,
    })),
    phaseUsageSeconds: phaseUsage,
    notes: [
      'Timeline is generated chronologically with multicam angle rotation.',
      'Resolve import: File > Import > Timeline > Import AAF/EDL/XML...',
      'If Resolve asks to relink media, point to original Video_Production root.',
    ],
  };

  await fs.writeFile(xmlPath, xml, 'utf8');
  await fs.writeFile(decisionsPath, JSON.stringify(segments, null, 2), 'utf8');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        xmlPath,
        decisionsPath,
        summaryPath,
        totalTimelineSeconds,
        generatedSegments: segments.length,
        usedAngles,
      },
      null,
      2
    )
  );
};

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
