import { describe, expect, it } from 'vitest';
import {
  mapSettingsToUniforms,
  uniformsAreIdentity,
  type PreviewSliderInput,
} from '../shader-uniforms';

const identity: PreviewSliderInput = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  denoising: 0,
  faceEnhancement: 0,
};

describe('mapSettingsToUniforms', () => {
  it('produces identity uniforms for zero input', () => {
    const u = mapSettingsToUniforms(identity);
    expect(uniformsAreIdentity(u)).toBe(true);
    expect(u.brightness).toBe(0);
    expect(u.contrast).toBe(1);
    expect(u.saturation).toBe(1);
    expect(u.sharpness).toBe(0);
    expect(u.denoising).toBe(0);
    expect(u.skinSmoothing).toBe(0);
  });

  it('scales brightness to [-0.3, 0.3]', () => {
    expect(mapSettingsToUniforms({ ...identity, brightness: 100 }).brightness).toBeCloseTo(0.3);
    expect(mapSettingsToUniforms({ ...identity, brightness: -100 }).brightness).toBeCloseTo(-0.3);
    expect(mapSettingsToUniforms({ ...identity, brightness: 50 }).brightness).toBeCloseTo(0.15);
  });

  it('scales contrast to [0.5, 1.5] around 1.0', () => {
    expect(mapSettingsToUniforms({ ...identity, contrast: 100 }).contrast).toBeCloseTo(1.5);
    expect(mapSettingsToUniforms({ ...identity, contrast: -100 }).contrast).toBeCloseTo(0.5);
  });

  it('scales saturation with 0 → 1 and ±100 → 0 or 2', () => {
    expect(mapSettingsToUniforms({ ...identity, saturation: 100 }).saturation).toBeCloseTo(2);
    expect(mapSettingsToUniforms({ ...identity, saturation: -100 }).saturation).toBeCloseTo(0);
  });

  it('treats positive sharpness as unsharp and negative as denoise', () => {
    const positive = mapSettingsToUniforms({ ...identity, sharpness: 100 });
    expect(positive.sharpness).toBeCloseTo(1.5);
    expect(positive.denoising).toBeCloseTo(0);

    const negative = mapSettingsToUniforms({ ...identity, sharpness: -100 });
    expect(negative.sharpness).toBe(0);
    expect(negative.denoising).toBeCloseTo(0.4);
  });

  it('scales denoising slider to [0, 0.6]', () => {
    expect(mapSettingsToUniforms({ ...identity, denoising: 100 }).denoising).toBeCloseTo(0.6);
    expect(mapSettingsToUniforms({ ...identity, denoising: 50 }).denoising).toBeCloseTo(0.3);
  });

  it('stacks negative sharpness with denoising and clamps to 1', () => {
    const stacked = mapSettingsToUniforms({
      ...identity,
      sharpness: -100,
      denoising: 100,
    });
    expect(stacked.denoising).toBeCloseTo(1);
  });

  it('scales faceEnhancement to skinSmoothing in [0, 0.6]', () => {
    expect(mapSettingsToUniforms({ ...identity, faceEnhancement: 100 }).skinSmoothing).toBeCloseTo(0.6);
    expect(mapSettingsToUniforms({ ...identity, faceEnhancement: 0 }).skinSmoothing).toBe(0);
  });

  it('clamps out-of-range inputs rather than propagating them', () => {
    const overdriven = mapSettingsToUniforms({
      ...identity,
      brightness: 500,
      contrast: -500,
      denoising: 500,
      faceEnhancement: -500,
    });
    expect(overdriven.brightness).toBeCloseTo(0.3);
    expect(overdriven.contrast).toBeCloseTo(0.5);
    expect(overdriven.denoising).toBeLessThanOrEqual(1);
    expect(overdriven.skinSmoothing).toBe(0);
  });
});
