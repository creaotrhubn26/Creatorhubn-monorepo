import { describe, expect, it } from 'vitest';
import {
  extractSceneDetectionScenesFromPayload,
  isRecord,
  normalizeAIGeneratedPayload,
  normalizeSceneDetectionProgress,
  normalizeSceneDetectionScene,
  normalizeSceneDetectionScenes,
  toErrorMessage,
} from '../storyArcStudioNormalizers';

const validScene = {
  scene_number: 1,
  start_time: 0,
  end_time: 4.2,
  duration: 4.2,
};

describe('storyArcStudioNormalizers', () => {
  it('toErrorMessage returns error message, string message, and fallback', () => {
    expect(toErrorMessage(new Error('Boom'))).toBe('Boom');
    expect(toErrorMessage('Failed to sync')).toBe('Failed to sync');
    expect(toErrorMessage('', 'Fallback message')).toBe('Fallback message');
  });

  it('isRecord returns true only for non-null objects', () => {
    expect(isRecord({ ok: true })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('text')).toBe(false);
  });

  it('normalizes a scene payload and rejects invalid values', () => {
    expect(
      normalizeSceneDetectionScene({
        scene_number: '2',
        start_time: '3.5',
        end_time: 7,
        duration: '3.5',
      })
    ).toEqual({
      scene_number: 2,
      start_time: 3.5,
      end_time: 7,
      duration: 3.5,
    });

    expect(
      normalizeSceneDetectionScene({
        scene_number: 'NaN',
        start_time: 0,
        end_time: 1,
        duration: 1,
      })
    ).toBeNull();
  });

  it('normalizes scene arrays and filters invalid entries', () => {
    expect(
      normalizeSceneDetectionScenes([
        validScene,
        { scene_number: 'bad', start_time: 0, end_time: 1, duration: 1 },
        {
          scene_number: '3',
          start_time: 10,
          end_time: 15,
          duration: 5,
        },
      ])
    ).toEqual([
      validScene,
      { scene_number: 3, start_time: 10, end_time: 15, duration: 5 },
    ]);
  });

  it('extracts scenes from direct, nested, and deep nested payloads', () => {
    expect(extractSceneDetectionScenesFromPayload({ scenes: [validScene] })).toEqual([validScene]);
    expect(
      extractSceneDetectionScenesFromPayload({
        result: {
          scenes: [{ scene_number: 2, start_time: 4.2, end_time: 8, duration: 3.8 }],
        },
      })
    ).toEqual([{ scene_number: 2, start_time: 4.2, end_time: 8, duration: 3.8 }]);
    expect(
      extractSceneDetectionScenesFromPayload({
        result: {
          result: {
            scenes: [{ scene_number: 3, start_time: 8, end_time: 12, duration: 4 }],
          },
        },
      })
    ).toEqual([{ scene_number: 3, start_time: 8, end_time: 12, duration: 4 }]);
  });

  it('normalizes scene detection progress with defaults', () => {
    expect(normalizeSceneDetectionProgress('invalid')).toEqual({
      status: 'processing',
      progress: 0,
      scenes: [],
    });

    expect(
      normalizeSceneDetectionProgress({
        status: 'completed',
        progress: 100,
        message: 'done',
        result: { scenes: [validScene] },
      })
    ).toEqual({
      status: 'completed',
      progress: 100,
      message: 'done',
      error: undefined,
      scenes: [validScene],
    });
  });

  it('normalizes AI payload and strips invalid scalar values', () => {
    expect(normalizeAIGeneratedPayload(null)).toBeNull();

    const normalized = normalizeAIGeneratedPayload({
      storyArc: {
        title: 'Wedding Highlights',
        musicSuggestions: [{ title: 'Song 1' }],
        transitionPoints: [{ type: 'fade' }],
      },
      timeline: {
        clips: [{ id: 'clip-1', name: 'Opening' }],
        totalDuration: 120,
      },
      scenes: [{ id: 'scene-1' }],
    });

    expect(normalized?.storyArc?.title).toBe('Wedding Highlights');
    expect(normalized?.timeline?.clips).toEqual([{ id: 'clip-1', name: 'Opening' }]);
    expect(normalized?.timeline?.totalDuration).toBe(120);
    expect(normalized?.scenes).toEqual([{ id: 'scene-1' }]);

    const invalidValues = normalizeAIGeneratedPayload({
      storyArc: { title: 42, musicSuggestions: 'not-array' },
      timeline: { totalDuration: 'wrong-type' },
    });

    expect(invalidValues).toEqual({
      storyArc: {
        title: undefined,
        musicSuggestions: undefined,
        transitionPoints: undefined,
      },
      timeline: {
        clips: undefined,
        totalDuration: undefined,
      },
      scenes: undefined,
    });
  });
});
