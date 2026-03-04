import type { BeatClip, Track } from '../../services/storyArcDataIntegration';

export type TimelineInvariantCode =
  | 'invalid_track'
  | 'invalid_start'
  | 'invalid_duration'
  | 'invalid_offset'
  | 'clip_overlap';

export interface TimelineInvariantIssue {
  code: TimelineInvariantCode;
  clipId: string;
  trackId?: string;
  message: string;
}

interface EnforceTimelineInvariantsOptions {
  frameTime: number;
  tracks: Track[];
  enforceNoOverlap?: boolean;
  transitions?: Array<{
    trackId: string;
    time: number;
    clipId?: string;
    edge?: 'in' | 'out';
  }>;
}

export interface EnforceTimelineInvariantsResult {
  clips: BeatClip[];
  issues: TimelineInvariantIssue[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeFrameTime(frameTime: number): number {
  return isFiniteNumber(frameTime) && frameTime > 0 ? frameTime : 1 / 30;
}

function snapToFrame(value: number, frameTime: number): number {
  return Math.round(value / frameTime) * frameTime;
}

function inferAudioTrackFromId(trackId: string | undefined): boolean {
  if (!trackId) {
    return false;
  }
  const normalizedTrackId = trackId.toLowerCase();
  return normalizedTrackId.startsWith('audio') || /^a\d+$/.test(normalizedTrackId);
}

function inferAudioTrackFromTrack(track: Track): boolean {
  if (track.type === 'audio') {
    return true;
  }
  const normalizedTrackId = track.id.toLowerCase();
  if (normalizedTrackId.startsWith('audio') || /^a\d+$/.test(normalizedTrackId)) {
    return true;
  }
  return track.name.toLowerCase().includes('audio');
}

function resolveFallbackTrackId(tracks: Track[], preferAudio: boolean): string | null {
  if (tracks.length === 0) {
    return null;
  }

  const matchingTrack = tracks.find((track) =>
    preferAudio ? inferAudioTrackFromTrack(track) : !inferAudioTrackFromTrack(track)
  );
  return matchingTrack?.id ?? tracks[0].id;
}

function normalizeOffsets(
  clip: BeatClip,
  frameTime: number,
  issues: TimelineInvariantIssue[]
): BeatClip {
  const metadata = clip.metadata;
  if (!metadata) {
    return clip;
  }

  const hasOffsetData =
    isFiniteNumber(metadata.sourceStartTime) ||
    isFiniteNumber(metadata.inPoint) ||
    isFiniteNumber(metadata.outPoint);
  if (!hasOffsetData) {
    return clip;
  }

  const baseSourceStart = isFiniteNumber(metadata.sourceStartTime) ? metadata.sourceStartTime : null;
  const baseInPoint = isFiniteNumber(metadata.inPoint) ? metadata.inPoint : null;
  const baseOutPoint = isFiniteNumber(metadata.outPoint) ? metadata.outPoint : null;

  const normalizedInPoint = Math.max(
    0,
    baseInPoint ?? baseSourceStart ?? 0
  );
  const normalizedSourceStart = Math.max(
    0,
    baseSourceStart ?? normalizedInPoint
  );
  const minimumOutPoint = normalizedInPoint + Math.max(frameTime, clip.duration);
  const normalizedOutPoint =
    baseOutPoint !== null && baseOutPoint >= normalizedInPoint + frameTime
      ? baseOutPoint
      : minimumOutPoint;

  if (
    baseSourceStart === normalizedSourceStart &&
    baseInPoint === normalizedInPoint &&
    baseOutPoint === normalizedOutPoint
  ) {
    return clip;
  }

  issues.push({
    code: 'invalid_offset',
    clipId: clip.id,
    trackId: clip.trackId,
    message: `Clip ${clip.id} had invalid source offsets and was normalized.`,
  });

  return {
    ...clip,
    metadata: {
      ...(metadata || {}),
      sourceStartTime: normalizedSourceStart,
      inPoint: normalizedInPoint,
      outPoint: normalizedOutPoint,
    },
  };
}

function getTransitionEdgeMetadata(clip: BeatClip, edge: 'in' | 'out'): Record<string, unknown> | null {
  if (!isRecord(clip.metadata) || !isRecord(clip.metadata.transitions)) {
    return null;
  }
  const edgeValue = clip.metadata.transitions[edge];
  return isRecord(edgeValue) ? edgeValue : null;
}

function isTransitionOverlapAllowed(
  left: BeatClip,
  right: BeatClip,
  frameTime: number,
  transitions: Array<{ trackId: string; time: number; clipId?: string; edge?: 'in' | 'out' }>
): boolean {
  if (left.trackId !== right.trackId) {
    return false;
  }
  const overlapStart = Math.max(left.start, right.start);
  const overlapEnd = Math.min(left.start + left.duration, right.start + right.duration);
  if (overlapEnd - overlapStart <= frameTime / 3) {
    return false;
  }

  const transitionAtOverlap = transitions.some((transition) => {
    if (transition.trackId !== left.trackId) {
      return false;
    }
    if (transition.edge === 'out' && transition.clipId === left.id) {
      return transition.time >= overlapStart - frameTime && transition.time <= overlapEnd + frameTime;
    }
    if (transition.edge === 'in' && transition.clipId === right.id) {
      return transition.time >= overlapStart - frameTime && transition.time <= overlapEnd + frameTime;
    }
    if (transition.clipId && transition.clipId !== left.id && transition.clipId !== right.id) {
      return false;
    }
    return transition.time >= overlapStart - frameTime && transition.time <= overlapEnd + frameTime;
  });
  if (transitionAtOverlap) {
    return true;
  }

  const leftOut = getTransitionEdgeMetadata(left, 'out');
  const rightIn = getTransitionEdgeMetadata(right, 'in');
  return leftOut?.targetClipId === right.id || rightIn?.sourceClipId === left.id;
}

export function enforceTimelineInvariants(
  clipList: BeatClip[],
  {
    frameTime,
    tracks,
    enforceNoOverlap = false,
    transitions = [],
  }: EnforceTimelineInvariantsOptions
): EnforceTimelineInvariantsResult {
  const normalizedFrameTime = normalizeFrameTime(frameTime);
  const issues: TimelineInvariantIssue[] = [];
  const trackIdSet = new Set(tracks.map((track) => track.id));

  const normalizedClips = clipList.map((originalClip) => {
    let nextClip = { ...originalClip };
    const preferAudioFallback = inferAudioTrackFromId(nextClip.trackId);

    if (!trackIdSet.has(nextClip.trackId)) {
      issues.push({
        code: 'invalid_track',
        clipId: nextClip.id,
        trackId: nextClip.trackId,
        message: `Clip ${nextClip.id} referenced unknown track ${nextClip.trackId}.`,
      });
      const fallbackTrackId = resolveFallbackTrackId(tracks, preferAudioFallback);
      if (fallbackTrackId) {
        nextClip.trackId = fallbackTrackId;
      }
    }

    if (!isFiniteNumber(nextClip.start) || nextClip.start < 0) {
      issues.push({
        code: 'invalid_start',
        clipId: nextClip.id,
        trackId: nextClip.trackId,
        message: `Clip ${nextClip.id} had invalid start value.`,
      });
      nextClip.start = 0;
    }

    if (!isFiniteNumber(nextClip.duration) || nextClip.duration <= 0) {
      issues.push({
        code: 'invalid_duration',
        clipId: nextClip.id,
        trackId: nextClip.trackId,
        message: `Clip ${nextClip.id} had invalid duration.`,
      });
      nextClip.duration = Math.max(normalizedFrameTime, 1 / 120);
    }

    const snappedStart = snapToFrame(nextClip.start, normalizedFrameTime);
    if (snappedStart !== nextClip.start) {
      nextClip.start = snappedStart;
    }
    const snappedDuration = Math.max(
      normalizedFrameTime,
      snapToFrame(nextClip.duration, normalizedFrameTime)
    );
    if (snappedDuration !== nextClip.duration) {
      nextClip.duration = snappedDuration;
    }

    nextClip = normalizeOffsets(nextClip, normalizedFrameTime, issues);
    return nextClip;
  });

  if (enforceNoOverlap) {
    const byTrack = new Map<string, BeatClip[]>();
    normalizedClips.forEach((clip) => {
      const list = byTrack.get(clip.trackId) || [];
      list.push(clip);
      byTrack.set(clip.trackId, list);
    });

    byTrack.forEach((trackClips, trackId) => {
      const sorted = [...trackClips].sort((left, right) => left.start - right.start);
      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        const previousEnd = previous.start + previous.duration;
        if (current.start < previousEnd) {
          if (isTransitionOverlapAllowed(previous, current, normalizedFrameTime, transitions)) {
            continue;
          }
          issues.push({
            code: 'clip_overlap',
            clipId: current.id,
            trackId,
            message: `Clip ${current.id} overlapped with previous clip on track ${trackId}.`,
          });
          current.start = previousEnd;
        }
      }
    });
  } else {
    const trackToSorted = new Map<string, BeatClip[]>();
    normalizedClips.forEach((clip) => {
      const list = trackToSorted.get(clip.trackId) || [];
      list.push(clip);
      trackToSorted.set(clip.trackId, list);
    });
    trackToSorted.forEach((trackClips, trackId) => {
      const sorted = [...trackClips].sort((left, right) => left.start - right.start);
      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        if (current.start < previous.start + previous.duration) {
          if (isTransitionOverlapAllowed(previous, current, normalizedFrameTime, transitions)) {
            continue;
          }
          issues.push({
            code: 'clip_overlap',
            clipId: current.id,
            trackId,
            message: `Clip ${current.id} overlaps on track ${trackId}.`,
          });
        }
      }
    });
  }

  return {
    clips: normalizedClips,
    issues,
  };
}
