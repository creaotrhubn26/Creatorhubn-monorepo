import { describe, expect, it } from 'vitest';

import { detectFormatMismatch, formatOrientation, sceneOrientation, makeScene, type DemoScene } from './demoStudioModel.js';

const scene = (device: DemoScene['device'], orientation?: 'portrait' | 'landscape'): DemoScene =>
  ({ ...makeScene(0, device), orientation });

describe('formatOrientation / sceneOrientation', () => {
  it('format → orientering', () => {
    expect(formatOrientation('16:9')).toBe('landscape');
    expect(formatOrientation('9:16')).toBe('portrait');
    expect(formatOrientation('4:5')).toBe('portrait');
    expect(formatOrientation('1:1')).toBe('square');
  });
  it('enhet → orientering (iPad følger orientation)', () => {
    expect(sceneOrientation(scene('macbook'))).toBe('landscape');
    expect(sceneOrientation(scene('iphone'))).toBe('portrait');
    expect(sceneOrientation(scene('ipad'))).toBe('portrait');
    expect(sceneOrientation(scene('ipad', 'landscape'))).toBe('landscape');
  });
});

describe('detectFormatMismatch', () => {
  it('MacBook-scener (liggende) + 9:16 (stående) → mismatch, foreslår 16:9', () => {
    const m = detectFormatMismatch([scene('macbook'), scene('macbook')], '9:16');
    expect(m).toEqual({ formatOrientation: 'portrait', conflicting: 2, total: 2, suggestFormat: '16:9' });
  });
  it('iPhone-scener + 9:16 → ingen mismatch', () => {
    expect(detectFormatMismatch([scene('iphone'), scene('iphone')], '9:16')).toBeNull();
  });
  it('MacBook + 16:9 → ingen mismatch', () => {
    expect(detectFormatMismatch([scene('macbook')], '16:9')).toBeNull();
  });
  it('1:1 passer alt → null', () => {
    expect(detectFormatMismatch([scene('macbook'), scene('iphone')], '1:1')).toBeNull();
  });
  it('miks (3 macbook + 1 iphone) + 9:16 → 3 i konflikt, foreslår 16:9 (flertall liggende)', () => {
    const m = detectFormatMismatch([scene('macbook'), scene('macbook'), scene('macbook'), scene('iphone')], '9:16');
    expect(m?.conflicting).toBe(3);
    expect(m?.suggestFormat).toBe('16:9');
  });
  it('tomt → null', () => {
    expect(detectFormatMismatch([], '9:16')).toBeNull();
  });
});
