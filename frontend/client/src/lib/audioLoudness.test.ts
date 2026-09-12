import { describe, expect, it } from 'vitest';

import {
  analyzePcmLoudness,
  dbToLinearGain,
  levelMatchPlan,
} from './audioLoudness';

const sine = (amplitude: number, seconds = 1, sampleRate = 48_000): Float32Array => {
  const samples = new Float32Array(seconds * sampleRate);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = amplitude * Math.sin((2 * Math.PI * 1_000 * index) / sampleRate);
  }
  return samples;
};

describe('Sound Room loudness matching', () => {
  it('treats digital silence as unavailable instead of inventing a LUFS value', () => {
    const result = analyzePcmLoudness([new Float32Array(48_000)], 48_000);
    expect(result.integratedLufs).toBeNull();
    expect(result.samplePeakDbfs).toBeNull();
  });

  it('measures a 6 dB difference when amplitude is halved', () => {
    const loud = analyzePcmLoudness([sine(0.5)], 48_000);
    const quiet = analyzePcmLoudness([sine(0.25)], 48_000);
    expect(loud.integratedLufs).not.toBeNull();
    expect(quiet.integratedLufs).not.toBeNull();
    expect((loud.integratedLufs ?? 0) - (quiet.integratedLufs ?? 0)).toBeCloseTo(6.02, 1);
  });

  it('only attenuates the louder revision', () => {
    const plan = levelMatchPlan(
      { integratedLufs: -8, samplePeakDbfs: -0.5, durationSeconds: 180, channelCount: 2 },
      { integratedLufs: -11, samplePeakDbfs: -1, durationSeconds: 180, channelCount: 2 },
    );
    expect(plan).toEqual({
      targetLufs: -11,
      currentGainDb: -3,
      previousGainDb: 0,
      available: true,
    });
    expect(dbToLinearGain(plan.currentGainDb)).toBeCloseTo(0.7079, 3);
  });

  it('fails safely when either revision cannot be measured', () => {
    expect(levelMatchPlan(null, {
      integratedLufs: -11,
      samplePeakDbfs: -1,
      durationSeconds: 180,
      channelCount: 2,
    }).available).toBe(false);
  });
});
