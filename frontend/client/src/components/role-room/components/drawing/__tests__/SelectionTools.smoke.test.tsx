// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  isPointInPolygon,
  isStrokeInPolygon,
  getStrokesWithSameColor,
  getConnectedStrokes,
} from '../SelectionTools';
import { buildClippingGroups } from '../LayersPanel';

function makeStroke(id: string, color: string, points: Array<{ x: number; y: number }>): any {
  return {
    id,
    color,
    width: 2,
    points: points.map((p) => ({ x: p.x, y: p.y, pressure: 1, t: 0 })),
  };
}

describe('Sprint A.7 — Polygon lasso', () => {
  const triangle = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 10 },
  ];

  it('point inside polygon returns true', () => {
    expect(isPointInPolygon({ x: 5, y: 2 }, triangle)).toBe(true);
  });

  it('point outside polygon returns false', () => {
    expect(isPointInPolygon({ x: 20, y: 20 }, triangle)).toBe(false);
  });

  it('polygon with <3 points returns false (uvalid)', () => {
    expect(isPointInPolygon({ x: 1, y: 1 }, [{ x: 0, y: 0 }, { x: 5, y: 5 }])).toBe(false);
  });

  it('stroke som har minst ett punkt innenfor polygon = inkludert', () => {
    const stroke = makeStroke('s1', '#000', [
      { x: 100, y: 100 },
      { x: 5, y: 2 }, // dette punktet er innenfor trekanten
    ]);
    expect(isStrokeInPolygon(stroke, triangle)).toBe(true);
  });

  it('stroke som er helt utenfor = ikke inkludert', () => {
    const stroke = makeStroke('s1', '#000', [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ]);
    expect(isStrokeInPolygon(stroke, triangle)).toBe(false);
  });
});

describe('Sprint A.7 — Quick-select same color', () => {
  const strokes = [
    makeStroke('a', '#ff0000', [{ x: 0, y: 0 }, { x: 1, y: 1 }]),
    makeStroke('b', '#ff0a00', [{ x: 10, y: 10 }, { x: 11, y: 11 }]), // nesten rød
    makeStroke('c', '#0000ff', [{ x: 20, y: 20 }, { x: 21, y: 21 }]),
    makeStroke('d', '#ffffff', [{ x: 30, y: 30 }, { x: 31, y: 31 }]),
  ];

  it('default tolerance treffer nær-eksakte matcher', () => {
    const ids = getStrokesWithSameColor(strokes, '#ff0000');
    expect(ids).toEqual(expect.arrayContaining(['a', 'b']));
    expect(ids).not.toContain('c');
    expect(ids).not.toContain('d');
  });

  it('tolerance=0 = kun eksakt match', () => {
    const ids = getStrokesWithSameColor(strokes, '#ff0000', 0);
    expect(ids).toEqual(['a']);
  });

  it('støtter 3-tegns hex (#abc)', () => {
    const ids = getStrokesWithSameColor(strokes, '#f00', 0);
    expect(ids).toEqual(['a']);
  });

  it('returnerer tom liste for ugyldig farge', () => {
    expect(getStrokesWithSameColor(strokes, 'banana')).toEqual([]);
  });
});

describe('Sprint A.7 — Quick-select connected', () => {
  it('to overlappende strokes blir sett som connected', () => {
    const strokes = [
      makeStroke('a', '#000', [{ x: 0, y: 0 }, { x: 10, y: 0 }]),
      makeStroke('b', '#000', [{ x: 8, y: 0 }, { x: 20, y: 0 }]), // overlapper a
      makeStroke('c', '#000', [{ x: 200, y: 200 }, { x: 210, y: 210 }]), // langt unna
    ];
    const ids = getConnectedStrokes(strokes, 'a');
    expect(ids.sort()).toEqual(['a', 'b']);
  });

  it('kjede av nærliggende strokes blir alle valgt', () => {
    const strokes = [
      makeStroke('a', '#000', [{ x: 0, y: 0 }]),
      makeStroke('b', '#000', [{ x: 5, y: 0 }]), // 5px fra a
      makeStroke('c', '#000', [{ x: 10, y: 0 }]), // 5px fra b
      makeStroke('d', '#000', [{ x: 100, y: 0 }]), // langt fra
    ];
    const ids = getConnectedStrokes(strokes, 'a', 8);
    expect(ids.sort()).toEqual(['a', 'b', 'c']);
  });

  it('threshold=0 = bare seed-stroke', () => {
    const strokes = [
      makeStroke('a', '#000', [{ x: 0, y: 0 }]),
      makeStroke('b', '#000', [{ x: 1, y: 0 }]),
    ];
    const ids = getConnectedStrokes(strokes, 'a', 0);
    expect(ids).toEqual(['a']);
  });
});

describe('Sprint A.7 — Clipping mask groups', () => {
  it('lag uten clipping mask = ingen grupper', () => {
    const layers = [
      { id: 'l1', clippingMask: false } as any,
      { id: 'l2', clippingMask: false } as any,
    ];
    expect(buildClippingGroups(layers).size).toBe(0);
  });

  it('mask under to vanlige lag klippes', () => {
    const layers = [
      { id: 'mask', clippingMask: true } as any,
      { id: 'shade1', clippingMask: false } as any,
      { id: 'shade2', clippingMask: false } as any,
    ];
    const groups = buildClippingGroups(layers);
    expect(groups.get('shade1')).toBe('mask');
    expect(groups.get('shade2')).toBe('mask');
    expect(groups.has('mask')).toBe(false);
  });

  it('ny mask reset til neste maske-gruppe', () => {
    const layers = [
      { id: 'maskA', clippingMask: true } as any,
      { id: 'paintA', clippingMask: false } as any,
      { id: 'maskB', clippingMask: true } as any,
      { id: 'paintB', clippingMask: false } as any,
    ];
    const groups = buildClippingGroups(layers);
    expect(groups.get('paintA')).toBe('maskA');
    expect(groups.get('paintB')).toBe('maskB');
  });
});
