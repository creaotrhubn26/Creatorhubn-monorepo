import { describe, expect, it } from 'vitest';

import {
  buildSequenceTimeline, prefixLayout, sceneLayoutForValues, buildSequenceHtml, stingLayoutFor,
} from './motionSequence.js';
import { stingFromValues } from './motionSting.js';

describe('buildSequenceTimeline — overlappende scener', () => {
  it('scener overlapper med transMs; total = sum − overlapp', () => {
    const tl = buildSequenceTimeline([4000, 3000, 2500], 500);
    expect(tl.starts).toEqual([0, 3500, 6000]);
    expect(tl.total).toBe(8500);
  });
  it('én scene → ingen overlapp', () => {
    expect(buildSequenceTimeline([4000], 500).total).toBe(4000);
  });
});

describe('prefixLayout — unik scene-scoping', () => {
  it('prefikser refs + bodyHtml med s{i}_, lar original være urørt', () => {
    const lay = stingLayoutFor(stingFromValues({ a: '312000 kr', b: '1240' }, { brandName: 'X', accent: '#8b5cf6', order: ['a', 'b'] }));
    const pf = prefixLayout(lay, 2);
    expect(pf.reveals.every((r) => r.ref.startsWith('s2_'))).toBe(true);
    expect(pf.bodyHtml).toContain('data-r="s2_hero"');
    expect(lay.bodyHtml).not.toContain('data-r="s2_');
  });
});

describe('sceneLayoutForValues + buildSequenceHtml', () => {
  it('auto-picker arketype per scene', () => {
    expect(sceneLayoutForValues({ doors: '1240', deals: '47', pipe: '312000' }, { order: ['doors', 'deals', 'pipe'] }).archetype).toBe('sting');
    expect(sceneLayoutForValues({ q: 'Et sitat om produktet.', by: 'Kari' }, { templateId: 'x-quote', order: ['q', 'by'] }).archetype).toBe('quote');
  });
  it('komponerer N scener til ÉN seekbar film m/ render-kontrakt', () => {
    const a = sceneLayoutForValues({ a: '312000 kr', b: '1240' }, { order: ['a', 'b'] }).layout;
    const b = sceneLayoutForValues({ n: '38 %', l: 'Konv' }, { order: ['n', 'l'] }).layout;
    const seq = buildSequenceHtml([a, b], { accent: '#8b5cf6', format: '16:9' });
    expect(seq.html.startsWith('<!doctype html>')).toBe(true);
    expect(seq.html).toContain('window.setProgress');
    expect(seq.html).toContain('window.__motionPlay();');
    expect((seq.html.match(/seq-scene/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(seq.html).toContain('data-r="s0_');
    expect(seq.html).toContain('data-r="s1_');
    expect(seq.total).toBe(buildSequenceTimeline([a.total, b.total], 550).total);
  });
});
