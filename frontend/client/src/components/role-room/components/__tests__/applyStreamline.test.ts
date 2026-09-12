import { describe, expect, it } from 'vitest';
import { applyStreamline } from '../PencilCanvasPro';

const pt = (x: number, y: number) => ({ x, y, pressure: 0.7, tiltX: 0, tiltY: 0, timestamp: 0 });

describe('applyStreamline', () => {
  it('bevarer start- og sluttpunkt (catch-up)', () => {
    const raw = [pt(0, 0), pt(10, 8), pt(20, -6), pt(30, 5), pt(40, 0)];
    const out = applyStreamline(raw, 0.5);
    expect(out[0]).toEqual(raw[0]);
    expect(out[out.length - 1]).toEqual(raw[raw.length - 1]);
    expect(out).toHaveLength(raw.length);
  });

  it('reduserer wobble: glattet bane avviker mindre fra rett linje enn rå', () => {
    // Rett linje med skjelv i y
    const raw = Array.from({ length: 30 }, (_, i) => pt(i * 10, (i % 2 ? 6 : -6)));
    const out = applyStreamline(raw, 0.6);
    const dev = (pts: ReturnType<typeof pt>[]) =>
      pts.slice(1, -1).reduce((s, p) => s + Math.abs(p.y), 0);
    expect(dev(out)).toBeLessThan(dev(raw) * 0.5);
  });

  it('amount 0 og korte strøk er no-op', () => {
    const raw = [pt(0, 0), pt(5, 5)];
    expect(applyStreamline(raw, 0.8)).toBe(raw);
    const raw2 = [pt(0, 0), pt(5, 5), pt(9, 1)];
    expect(applyStreamline(raw2, 0)).toBe(raw2);
  });
});
