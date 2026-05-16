// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { analyzeFramePalette, analyzeStyleDrift, parseHex } from '../styleConsistency';

function makeStroke(color: string, points: Array<{ x: number; y: number }>, width = 2): any {
  return { color, width, points };
}

function makeFrame(id: string, strokes: any[]): any {
  return { id, strokes };
}

describe('Sprint A.7 — styleConsistency.parseHex', () => {
  it('parser 6-tegns hex', () => {
    expect(parseHex('#ff8800')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('parser 3-tegns hex', () => {
    expect(parseHex('#f80')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('returnerer null for ugyldig hex', () => {
    expect(parseHex('banana')).toBeNull();
    expect(parseHex('')).toBeNull();
    expect(parseHex('#fff00')).toBeNull();
  });
});

describe('Sprint A.7 — analyzeFramePalette', () => {
  it('tom strokes-array gir tom palette', () => {
    const palette = analyzeFramePalette(makeFrame('f1', []));
    expect(palette.colors).toEqual([]);
    expect(palette.totalWeight).toBe(0);
  });

  it('én rød stroke gir én rød palette-entry', () => {
    const palette = analyzeFramePalette(makeFrame('f1', [
      makeStroke('#ff0000', [{ x: 0, y: 0 }, { x: 100, y: 0 }]),
    ]));
    expect(palette.colors.length).toBe(1);
    // Bucket-center for #ff0000 lander i samme bucket — sjekker rødhet
    const rgb = parseHex(palette.colors[0].color);
    expect(rgb!.r).toBeGreaterThan(200);
    expect(rgb!.g).toBeLessThan(50);
  });

  it('flere strokes med samme farge slås sammen', () => {
    const palette = analyzeFramePalette(makeFrame('f1', [
      makeStroke('#ff0000', [{ x: 0, y: 0 }, { x: 50, y: 0 }]),
      makeStroke('#ff0000', [{ x: 0, y: 10 }, { x: 50, y: 10 }]),
    ]));
    expect(palette.colors.length).toBe(1);
  });

  it('to ulike farger gir to entries, sortert etter weight', () => {
    const palette = analyzeFramePalette(makeFrame('f1', [
      // Kort grønn
      makeStroke('#00ff00', [{ x: 0, y: 0 }, { x: 10, y: 0 }]),
      // Lang rød (større vekt)
      makeStroke('#ff0000', [{ x: 0, y: 5 }, { x: 200, y: 5 }]),
    ]));
    expect(palette.colors.length).toBe(2);
    const top = parseHex(palette.colors[0].color);
    expect(top!.r).toBeGreaterThan(200); // rød først
  });

  it('strokes uten farge ignoreres', () => {
    const palette = analyzeFramePalette(makeFrame('f1', [
      makeStroke('', [{ x: 0, y: 0 }, { x: 10, y: 0 }]),
      makeStroke('#ff0000', [{ x: 0, y: 5 }, { x: 50, y: 5 }]),
    ]));
    expect(palette.colors.length).toBe(1);
  });

  it('drawingData.strokes inkluderes hvis frame.strokes mangler', () => {
    const frame = {
      id: 'f1',
      drawingData: {
        strokes: [makeStroke('#0000ff', [{ x: 0, y: 0 }, { x: 50, y: 0 }])],
      },
    };
    const palette = analyzeFramePalette(frame);
    expect(palette.colors.length).toBe(1);
  });
});

describe('Sprint A.7 — analyzeStyleDrift', () => {
  it('mindre enn 2 frames med strokes = ingen drift-analyse', () => {
    const report = analyzeStyleDrift([
      makeFrame('f1', []),
      makeFrame('f2', [makeStroke('#ff0000', [{ x: 0, y: 0 }, { x: 100, y: 0 }])]),
    ]);
    expect(report.driftByFrame.every((d) => d.drift === 0)).toBe(true);
    expect(report.outliers).toEqual([]);
  });

  it('konsistente frames (samme farger) gir lav drift', () => {
    const blueStrokes = [makeStroke('#0a4f8a', [{ x: 0, y: 0 }, { x: 100, y: 0 }])];
    const report = analyzeStyleDrift([
      makeFrame('f1', blueStrokes),
      makeFrame('f2', blueStrokes),
      makeFrame('f3', blueStrokes),
    ]);
    expect(report.outliers).toEqual([]);
    report.driftByFrame.forEach((entry) => {
      expect(entry.severity).toBe('ok');
    });
  });

  it('ett frame med veldig annerledes farge flagges som outlier', () => {
    const report = analyzeStyleDrift([
      makeFrame('f1', [makeStroke('#0a4f8a', [{ x: 0, y: 0 }, { x: 100, y: 0 }])]),
      makeFrame('f2', [makeStroke('#0a4f8a', [{ x: 0, y: 0 }, { x: 100, y: 0 }])]),
      makeFrame('f3', [makeStroke('#0a4f8a', [{ x: 0, y: 0 }, { x: 100, y: 0 }])]),
      // Eneste frame med varm oransje — bryter sekvens-palett
      makeFrame('f4', [makeStroke('#ff8800', [{ x: 0, y: 0 }, { x: 100, y: 0 }])]),
    ]);
    const f4 = report.driftByFrame.find((d) => d.frameId === 'f4');
    expect(f4).toBeDefined();
    expect(f4!.severity).not.toBe('ok');
    expect(report.outliers.some((o) => o.frameId === 'f4')).toBe(true);
  });

  it('sekvens-palett returnerer hex-farger', () => {
    const report = analyzeStyleDrift([
      makeFrame('f1', [makeStroke('#ff0000', [{ x: 0, y: 0 }, { x: 100, y: 0 }])]),
      makeFrame('f2', [makeStroke('#00ff00', [{ x: 0, y: 0 }, { x: 100, y: 0 }])]),
    ]);
    expect(report.sequencePalette.length).toBeGreaterThan(0);
    for (const bin of report.sequencePalette) {
      expect(bin.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(bin.weight).toBeGreaterThan(0);
    }
  });

  it('frames uten strokes får drift=0 og severity=ok', () => {
    const report = analyzeStyleDrift([
      makeFrame('f1', [makeStroke('#0a4f8a', [{ x: 0, y: 0 }, { x: 100, y: 0 }])]),
      makeFrame('f2', [makeStroke('#0a4f8a', [{ x: 0, y: 0 }, { x: 100, y: 0 }])]),
      makeFrame('empty', []),
    ]);
    const empty = report.driftByFrame.find((d) => d.frameId === 'empty');
    expect(empty?.drift).toBe(0);
    expect(empty?.severity).toBe('ok');
  });
});
