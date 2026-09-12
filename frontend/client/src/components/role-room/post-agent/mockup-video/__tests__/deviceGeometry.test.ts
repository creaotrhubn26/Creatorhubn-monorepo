import { describe, expect, it } from 'vitest';
import { getDeviceGeometry, deviceAspectRatio, type DeviceVariant } from '../deviceGeometry';

const VARIANTS: DeviceVariant[] = ['macbook', 'ipad', 'iphone'];

describe('getDeviceGeometry — skjermen ligger inni rammen', () => {
  it.each(VARIANTS)('%s: skjerm-rektangelet er innenfor body', (variant) => {
    const g = getDeviceGeometry(variant, 1);
    expect(g.screen.x).toBeGreaterThanOrEqual(g.body.x);
    expect(g.screen.y).toBeGreaterThanOrEqual(g.body.y);
    expect(g.screen.x + g.screen.width).toBeLessThanOrEqual(g.body.x + g.body.width + 0.001);
    expect(g.screen.y + g.screen.height).toBeLessThanOrEqual(g.body.y + g.body.height + 0.001);
    expect(g.screen.width).toBeGreaterThan(0);
    expect(g.screen.height).toBeGreaterThan(0);
  });
});

describe('getDeviceGeometry — pixelRatio skalerer lineært', () => {
  it.each(VARIANTS)('%s: ×4 firedobler alle mål', (variant) => {
    const base = getDeviceGeometry(variant, 1);
    const big = getDeviceGeometry(variant, 4);
    expect(big.width).toBeCloseTo(base.width * 4);
    expect(big.height).toBeCloseTo(base.height * 4);
    expect(big.screen.width).toBeCloseTo(base.screen.width * 4);
    expect(big.screen.radius).toBeCloseTo(base.screen.radius * 4);
    // Forholdstall er uendret av skalering.
    expect(big.width / big.height).toBeCloseTo(base.width / base.height, 5);
  });
});

describe('getDeviceGeometry — overlays', () => {
  it('iphone har en Dynamic Island sentrert oppe', () => {
    const g = getDeviceGeometry('iphone', 1);
    const island = g.overlays.find((o) => o.kind === 'island');
    expect(island).toBeDefined();
    const center = island!.x + island!.width / 2;
    expect(center).toBeCloseTo(g.width / 2, 5);
  });

  it('macbook har en notch og en hengsel-aksent', () => {
    const g = getDeviceGeometry('macbook', 1);
    expect(g.overlays.some((o) => o.kind === 'notch')).toBe(true);
    expect(g.accents.length).toBeGreaterThan(0);
  });
});

describe('deviceAspectRatio', () => {
  it('macbook er landskap, iphone er portrett', () => {
    expect(deviceAspectRatio('macbook')).toBeGreaterThan(1);
    expect(deviceAspectRatio('iphone')).toBeLessThan(1);
  });
});
