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
}

export interface EnforceTimelineInvariantsResult {
  clips: BeatClip[];
  issues: TimelineInvariantIssue[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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

export function enforceTimelineInvariants(
  clipList: BeatClip[],
  {
    frameTime,
    tracks,
    enforceNoOverlap = false,
  }: EnforceTimelineInvariantsOptions
): EnforceTimelineInvariantsResult {
  const issues: TimelineInvariantIssue[] = [];
  const trackIdSet = new Set(tracks.map((track) => track.id));

  const normalizedClips = clipList.map((originalClip) => {
    let nextClip = { ...originalClip };
    const preferAudioFallback = inferAudioTrackFromId(nextClip.trackId);

    if (!trackIdSet.has(nextClip.trackId)) {
      const fallbackTrackId = resolveFallbackTrackId(tracks, preferAudioFallback);
      if (fallbackTrackId) {
        issues.push({
          code: 'invalid_track',
          clipId: nextClip.id,
          trackId: nextClip.trackId,
          message: `Clip ${nextClip.id} referenced unknown track ${nextClip.trackId}.`,
        });
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
      nextClip.duration = Math.max(frameTime, 1 / 120);
    }

    nextClip = normalizeOffsets(nextClip, frameTime, issues);
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
