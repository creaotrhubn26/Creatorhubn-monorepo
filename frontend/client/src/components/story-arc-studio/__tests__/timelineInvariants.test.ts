import { describe, expect, it } from 'vitest';
import type { BeatClip, Track } from '../../../services/storyArcDataIntegration';
import { enforceTimelineInvariants } from '../timelineInvariants';

const tracks: Track[] = [
  { id: 'video-1', name: 'Video 1', type: 'video', height: 48 },
  { id: 'audio-1', name: 'Audio 1', type: 'audio', height: 40 },
];

function buildClip(overrides: Partial<BeatClip> = {}): BeatClip {
  return {
    id: 'clip-1',
    name: 'Clip 1',
    beatName: 'Clip 1',
    start: 0,
    duration: 5,
    ev: 0.1,
    synopsis: 'Sample',
    trackId: 'video-1',
    color: '#fff',
    ...overrides,
  };
}

describe('timelineInvariants', () => {
  it('normalizes invalid track, start, and duration values', () => {
    const result = enforceTimelineInvariants(
      [
        buildClip({
          id: 'bad-clip',
          trackId: 'missing-track',
          start: -10,
          duration: -5,
        }),
      ],
      {
        frameTime: 1 / 30,
        tracks,
      }
    );

    expect(result.clips[0].trackId).toBe('video-1');
    expect(result.clips[0].start).toBe(0);
    expect(result.clips[0].duration).toBe(1 / 30);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['invalid_track', 'invalid_start', 'invalid_duration'])
    );
  });

  it('normalizes invalid metadata offsets', () => {
    const result = enforceTimelineInvariants(
      [
        buildClip({
          id: 'offset-clip',
          metadata: {
            sourceStartTime: -3,
            inPoint: -1,
            outPoint: 0,
          },
        }),
      ],
      {
        frameTime: 1 / 30,
        tracks,
      }
    );

    expect(result.clips[0].metadata?.sourceStartTime).toBe(0);
    expect(result.clips[0].metadata?.inPoint).toBe(0);
    expect(result.clips[0].metadata?.outPoint).toBe(5);
    expect(result.issues.some((issue) => issue.code === 'invalid_offset')).toBe(true);
  });

  it('detects overlaps and resolves them when enforceNoOverlap is true', () => {
    const result = enforceTimelineInvariants(
      [
        buildClip({ id: 'clip-1', start: 0, duration: 5 }),
        buildClip({ id: 'clip-2', start: 3, duration: 4 }),
      ],
      {
        frameTime: 1 / 30,
        tracks,
        enforceNoOverlap: true,
      }
    );

    expect(result.clips[1].start).toBe(5);
    expect(result.issues.some((issue) => issue.code === 'clip_overlap')).toBe(true);
  });

  it('keeps overlap position when enforceNoOverlap is false, but still reports issue', () => {
    const result = enforceTimelineInvariants(
      [
        buildClip({ id: 'clip-a', start: 0, duration: 5 }),
        buildClip({ id: 'clip-b', start: 3, duration: 4 }),
      ],
      {
        frameTime: 1 / 30,
        tracks,
        enforceNoOverlap: false,
      }
    );

    expect(result.clips[1].start).toBe(3);
    expect(result.issues.some((issue) => issue.code === 'clip_overlap')).toBe(true);
  });

  it('reports invalid track even when no tracks are available for fallback', () => {
    const result = enforceTimelineInvariants(
      [buildClip({ id: 'orphan', trackId: 'missing-track' })],
      {
        frameTime: 1 / 30,
        tracks: [],
      }
    );

    expect(result.clips[0].trackId).toBe('missing-track');
    expect(result.issues.some((issue) => issue.code === 'invalid_track')).toBe(true);
  });

  it('snaps start and duration to frame boundaries', () => {
    const frameTime = 1 / 30;
    const result = enforceTimelineInvariants(
      [buildClip({ id: 'off-grid', start: 1.234, duration: 2.345 })],
      {
        frameTime,
        tracks,
      }
    );

    expect(Math.round(result.clips[0].start / frameTime) * frameTime).toBe(result.clips[0].start);
    expect(Math.round(result.clips[0].duration / frameTime) * frameTime).toBe(result.clips[0].duration);
  });

  it('allows overlap when linked transition metadata is present', () => {
    const result = enforceTimelineInvariants(
      [
        buildClip({
          id: 'left',
          start: 0,
          duration: 5,
          metadata: {
            transitions: {
              out: { targetClipId: 'right', duration: 0.5, type: 'crossfade' },
            },
          },
        }),
        buildClip({
          id: 'right',
          start: 4.5,
          duration: 5,
          metadata: {
            transitions: {
              in: { sourceClipId: 'left', duration: 0.5, type: 'crossfade' },
            },
          },
        }),
      ],
      {
        frameTime: 1 / 30,
        tracks,
        enforceNoOverlap: true,
      }
    );

    expect(result.clips[1].start).toBe(4.5);
    expect(result.issues.some((issue) => issue.code === 'clip_overlap')).toBe(false);
  });

  it('allows overlap when transition list links the cut pair', () => {
    const result = enforceTimelineInvariants(
      [
        buildClip({ id: 'left', start: 0, duration: 5 }),
        buildClip({ id: 'right', start: 4.6, duration: 5 }),
      ],
      {
        frameTime: 1 / 30,
        tracks,
        enforceNoOverlap: true,
        transitions: [
          {
            trackId: 'video-1',
            time: 5,
            clipId: 'left',
            edge: 'out',
          },
        ],
      }
    );

    expect(result.clips[1].start).toBe(4.6);
    expect(result.issues.some((issue) => issue.code === 'clip_overlap')).toBe(false);
  });
});
