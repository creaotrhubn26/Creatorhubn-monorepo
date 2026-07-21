import { describe, expect, it } from 'vitest';

import {
  motionStateAt, statLayout, quoteLayout, compareLayout, listLayout,
  statFrom, quoteFrom, compareFrom, listFrom, pickArchetype, buildMotionHtml,
} from './motionReveal.js';

describe('motionStateAt — deterministisk reveal (seekbar)', () => {
  const st = statLayout({ label: 'Konvertering', value: 38, suffix: '%', delta: '▲ +6 pp', sub: 'siste 30 dager' });
  it('t=0 alt skjult, t=total alt avslørt', () => {
    expect(Object.values(motionStateAt(st.reveals, 0)).every((r) => r.opacity === 0 && r.p === 0)).toBe(true);
    expect(Object.values(motionStateAt(st.reveals, st.total)).every((r) => r.opacity === 1 && r.p === 1)).toBe(true);
  });
  it('num-progresjon er monoton', () => {
    const ps = [0, 400, 800, st.total].map((t) => motionStateAt(st.reveals, t)['num'].p);
    for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeGreaterThanOrEqual(ps[i - 1]);
  });
});

describe('arketyper — ulik koreografi per innholds-form', () => {
  it('stat: stort tall som teller + delta-pop', () => {
    const st = statLayout({ label: 'x', value: 38, suffix: '%', delta: '▲ +6 pp' });
    expect(st.bodyHtml).toContain('data-count="38"');
    expect(st.reveals.find((r) => r.ref === 'num')?.kind).toBe('countUp');
    expect(st.reveals.some((r) => r.ref === 'delta' && r.kind === 'pop')).toBe(true);
  });
  it('quote: tekst wiper inn, kilde slider', () => {
    const q = quoteLayout({ quote: 'Beste verktøyet.', author: 'Kari', role: 'Salgssjef' });
    expect(q.reveals.find((r) => r.ref === 'quote')?.kind).toBe('wipe');
    expect(q.bodyHtml).toContain('Kari');
  });
  it('compare: barer racer (samme starttid) + vinner', () => {
    const c = compareLayout({ items: [{ label: 'A', value: 47 }, { label: 'B', value: 22 }] });
    const bars = c.reveals.filter((r) => r.ref.startsWith('bar'));
    expect(new Set(bars.map((b) => b.at)).size).toBe(1); // alle starter samtidig
    expect(c.bodyHtml).toContain('cmp-win');
  });
});

describe('adaptere + velger', () => {
  it('statFrom finner hero + delta', () => {
    const s = statFrom({ rate: '38 %', growth: '+6 pp' }, ['rate', 'growth']);
    expect(s.value).toBe(38); expect(s.suffix).toBe('%'); expect(s.delta).toBeTruthy();
  });
  it('quoteFrom: lengste tekst = quote', () => {
    const q = quoteFrom({ t: 'Et ganske langt sitat om produktet.', by: 'Ola' }, ['t', 'by']);
    expect(q.quote.startsWith('Et ganske')).toBe(true); expect(q.author).toBe('Ola');
  });
  it('compareFrom: numeriske felt → items', () => {
    expect(compareFrom({ a: '47', b: '22', c: '12' }, ['a', 'b', 'c']).items).toHaveLength(3);
  });
  it('pickArchetype: quote/stat/compare/sting', () => {
    expect(pickArchetype('rr-testimonial', {})).toBe('quote');
    expect(pickArchetype('x', { n: '38 %', l: 'Konv' })).toBe('stat');
    expect(pickArchetype('x', { a: '47', b: '22', c: '12' })).toBe('compare');
    expect(pickArchetype('x', { doors: '1240', deals: '47', pipe: '312000' })).toBe('sting');
  });
});

describe('buildMotionHtml', () => {
  it('selvstendig HTML med seek/play-hooks + autoplay', () => {
    const html = buildMotionHtml(compareLayout({ items: [{ label: 'A', value: 5 }] }), { accent: '#8b5cf6' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('window.__motionSeek =');
    expect(html).toContain('window.__motionPlay();');
  });
  it('brand-lockup rendres bare når brand er satt', () => {
    const withB = buildMotionHtml(statLayout({ label: 'x', value: 5 }), { brand: { name: 'Leadgrid', mark: 'L' } });
    expect(withB).toContain('data-r="__brand"');
    expect(withB).toContain('Leadgrid');
    expect(buildMotionHtml(statLayout({ label: 'x', value: 5 }), {})).not.toContain('data-r="__brand"');
  });
  it('tempo skalerer total (rolig > normal)', () => {
    const total = (h: string) => Number(h.match(/var TOTAL = (\d+)/)![1]);
    expect(total(buildMotionHtml(statLayout({ label: 'x', value: 5 }), { tempo: 1.4 })))
      .toBeGreaterThan(total(buildMotionHtml(statLayout({ label: 'x', value: 5 }), {})));
  });
});

describe('LIST/STEPS-arketype', () => {
  it('listFrom: hvert felt → element (verdi=etikett, feltnavn=undertekst)', () => {
    const d = listFrom({ scene: 'Scene 12', s1: 'Vidvinkel' }, ['scene', 's1']);
    expect(d.items).toHaveLength(2);
    expect(d.items[0]).toMatchObject({ label: 'Scene 12', sub: 'Scene' });
  });
  it('listLayout: elementer kaskader (stigende starttid) + arc-list', () => {
    const l = listLayout({ items: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] });
    expect(l.bodyHtml).toContain('arc-list');
    const ats = l.reveals.filter((r) => r.ref.startsWith('li')).map((r) => r.at);
    expect(ats[0]).toBeLessThan(ats[1]);
    expect(ats[1]).toBeLessThan(ats[2]);
  });
  it('pickArchetype: shot-liste (tall inne i tekst) → list, ikke sting', () => {
    expect(pickArchetype('x', { scene: 'Scene 12 — Audition', s1: 'Statisk | 24mm', s2: 'Dolly inn | 35mm', s3: 'Nær — reaksjon', s4: 'Macro | 100mm' })).toBe('list');
    expect(pickArchetype('rr-call-sheet', {})).toBe('list');
  });
});
