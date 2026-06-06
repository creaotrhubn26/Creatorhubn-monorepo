import { describe, expect, it } from 'vitest';
import { fitRect, centerWithin, scaleToFit } from '../fitRect';

const target = { x: 0, y: 0, width: 100, height: 200 }; // portrett-skjerm

describe('fitRect — cover', () => {
  it('en bredere kilde fylles på høyden og beskjæres på bredden', () => {
    // Kilde 16:9 (bred) inn i 1:2 (smal/høy): høyden binder.
    const r = fitRect({ width: 1600, height: 900 }, target, 'cover');
    expect(r.height).toBeCloseTo(200);
    expect(r.width).toBeGreaterThan(200); // bredere enn målet → beskjæres
    // Sentrert horisontalt → negativ x.
    expect(r.x).toBeLessThan(0);
    expect(r.x).toBeCloseTo((100 - r.width) / 2);
  });

  it('en smalere kilde fylles på bredden', () => {
    // Kilde 1:4 (smalere enn 1:2) inn i 1:2: bredden binder.
    const r = fitRect({ width: 100, height: 400 }, target, 'cover');
    expect(r.width).toBeCloseTo(100);
    expect(r.height).toBeGreaterThan(200);
    expect(r.y).toBeLessThan(0);
  });

  it('cover dekker alltid hele målet', () => {
    const r = fitRect({ width: 640, height: 480 }, target, 'cover');
    expect(r.width).toBeGreaterThanOrEqual(target.width - 0.001);
    expect(r.height).toBeGreaterThanOrEqual(target.height - 0.001);
  });
});

describe('fitRect — contain', () => {
  it('en bredere kilde passes på bredden (letterbox topp/bunn)', () => {
    const r = fitRect({ width: 1600, height: 900 }, target, 'contain');
    expect(r.width).toBeCloseTo(100);
    expect(r.height).toBeLessThanOrEqual(200);
    expect(r.y).toBeGreaterThanOrEqual(0);
  });

  it('contain holder seg innenfor målet', () => {
    const r = fitRect({ width: 300, height: 100 }, target, 'contain');
    expect(r.width).toBeLessThanOrEqual(target.width + 0.001);
    expect(r.height).toBeLessThanOrEqual(target.height + 0.001);
  });
});

describe('fitRect — robusthet', () => {
  it('degenerert kilde faller tilbake til målet uten NaN', () => {
    const r = fitRect({ width: 0, height: 0 }, target, 'cover');
    expect(r).toEqual(target);
    expect(Number.isNaN(r.width)).toBe(false);
  });

  it('bevarer kildens forholdstall i resultatet (cover)', () => {
    const r = fitRect({ width: 800, height: 600 }, target, 'cover');
    expect(r.width / r.height).toBeCloseTo(800 / 600, 5);
  });
});

describe('centerWithin', () => {
  it('sentrerer en boks i en container', () => {
    const r = centerWithin({ width: 100, height: 100 }, { width: 40, height: 20 });
    expect(r).toEqual({ x: 30, y: 40, width: 40, height: 20 });
  });
});

describe('scaleToFit', () => {
  it('velger den bindende aksen', () => {
    // Boks 200×100 i bounds 100×100 → bredden binder → 0.5.
    expect(scaleToFit({ width: 200, height: 100 }, { width: 100, height: 100 })).toBeCloseTo(0.5);
  });
  it('respekterer maxScale', () => {
    expect(scaleToFit({ width: 10, height: 10 }, { width: 100, height: 100 }, 2)).toBe(2);
  });
});
