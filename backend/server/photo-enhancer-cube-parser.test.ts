import { describe, expect, it } from 'vitest';
import {
  computeSwatchPreview,
  CubeParseError,
  parseCubeMetadata,
} from './photo-enhancer-cube-parser';

function identityCube(size: number): string {
  const lines = [`LUT_3D_SIZE ${size}`];
  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        lines.push(`${r / (size - 1)} ${g / (size - 1)} ${b / (size - 1)}`);
      }
    }
  }
  return lines.join('\n');
}

describe('parseCubeMetadata', () => {
  it('parses a minimal 3D identity', () => {
    const meta = parseCubeMetadata(identityCube(3));
    expect(meta.kind).toBe('3D');
    expect(meta.size).toBe(3);
    expect(meta.entryCount).toBe(27);
    expect(meta.domainMin).toEqual([0, 0, 0]);
    expect(meta.domainMax).toEqual([1, 1, 1]);
  });

  it('exposes black / mid / white samples correctly', () => {
    const meta = parseCubeMetadata(identityCube(3));
    expect(meta.samples.black).toEqual([0, 0, 0]);
    expect(meta.samples.white).toEqual([1, 1, 1]);
  });

  it('strips BOM and tolerates CRLF', () => {
    const source = '\uFEFF' + identityCube(2).replace(/\n/g, '\r\n');
    const meta = parseCubeMetadata(source);
    expect(meta.size).toBe(2);
  });

  it('rejects missing size declaration', () => {
    expect(() => parseCubeMetadata('0 0 0\n0 0 0')).toThrow(CubeParseError);
  });

  it('rejects wrong entry count', () => {
    expect(() => parseCubeMetadata('LUT_3D_SIZE 3\n0 0 0\n1 1 1')).toThrow(/stemmer ikke/);
  });

  it('rejects oversize 3D LUT', () => {
    expect(() => parseCubeMetadata('LUT_3D_SIZE 100')).toThrow(/over tillatt/);
  });

  it('rejects domain min >= max', () => {
    const source = [
      'LUT_3D_SIZE 2',
      'DOMAIN_MIN 1 1 1',
      'DOMAIN_MAX 1 1 1',
      ...Array.from({ length: 8 }, () => '0 0 0'),
    ].join('\n');
    expect(() => parseCubeMetadata(source)).toThrow(/DOMAIN_MIN/);
  });

  it('accepts TITLE with or without quotes', () => {
    const a = parseCubeMetadata('TITLE "Warm look"\n' + identityCube(2));
    expect(a.title).toBe('Warm look');
    const b = parseCubeMetadata('TITLE Warm\n' + identityCube(2));
    expect(b.title).toBe('Warm');
  });

  it('parses 1D LUT too', () => {
    const source = [
      'LUT_1D_SIZE 4',
      '0 0 0',
      '0.33 0.33 0.33',
      '0.66 0.66 0.66',
      '1 1 1',
    ].join('\n');
    const meta = parseCubeMetadata(source);
    expect(meta.kind).toBe('1D');
    expect(meta.size).toBe(4);
    expect(meta.samples.white).toEqual([1, 1, 1]);
  });
});

describe('computeSwatchPreview', () => {
  it('maps mid-grey on identity to ~128', () => {
    const meta = parseCubeMetadata(identityCube(3));
    const swatch = computeSwatchPreview(meta);
    // mid index on size=3 is floor(2/2)=1 → 1/2 = 0.5 → 127
    expect(Math.abs(swatch.r - 127)).toBeLessThanOrEqual(2);
    expect(Math.abs(swatch.g - 127)).toBeLessThanOrEqual(2);
    expect(Math.abs(swatch.b - 127)).toBeLessThanOrEqual(2);
  });
});
