import { describe, expect, it } from 'vitest';

import {
  deriveStingTimeline,
  parseStingNumber,
  stingFromValues,
  buildMotionStingHtml,
  stingStateAt,
  stingFrameTimes,
  buildStingCaptureSpec,
  type StingData,
} from './motionSting.js';

const DATA: StingData = {
  brandName: 'Leadgrid',
  mark: '◆',
  eyebrow: 'UKE 28',
  hero: { label: 'Pipeline generert', value: 312000, suffix: 'kr' },
  metrics: [
    { label: 'Dører', value: 1240 },
    { label: 'Møter', value: 96 },
    { label: 'Avtaler', value: 47 },
  ],
  caption: 'Dørsalg som presterer.',
  accent: '#8b5cf6',
};

describe('deriveStingTimeline', () => {
  const tl = deriveStingTimeline(DATA);
  it('garanterer rekkefølge mark < metrics < hero < caption', () => {
    const mark = tl.keyframes.find((k) => k.kind === 'mark')!;
    const metrics = tl.keyframes.filter((k) => k.kind === 'metric');
    const hero = tl.keyframes.find((k) => k.kind === 'hero')!;
    const caption = tl.keyframes.find((k) => k.kind === 'caption')!;
    expect(metrics.length).toBe(3);
    expect(mark.at).toBeLessThan(metrics[0].at);
    expect(metrics[0].at).toBeLessThan(metrics[2].at); // stagger
    expect(metrics[2].at).toBeLessThan(hero.at);       // hero etter siste metric
    expect(hero.at).toBeLessThan(caption.at);          // caption sist
  });
  it('total dekker siste keyframe + hale', () => {
    const lastEnd = Math.max(...tl.keyframes.map((k) => k.at + k.dur));
    expect(tl.total).toBeGreaterThan(lastEnd);
  });
  it('dropper caption-keyframe når caption mangler', () => {
    const tl2 = deriveStingTimeline({ ...DATA, caption: undefined });
    expect(tl2.keyframes.some((k) => k.kind === 'caption')).toBe(false);
  });
});

describe('parseStingNumber (nb-NO)', () => {
  it('space=tusenskille', () => { expect(parseStingNumber('312 000 kr')).toBe(312000); });
  it('komma=desimal', () => { expect(parseStingNumber('3,5x')).toBe(3.5); });
  it('prosent', () => { expect(parseStingNumber('+38 %')).toBe(38); });
  it('rene tall + gjennomslag av number', () => { expect(parseStingNumber('47')).toBe(47); expect(parseStingNumber(96)).toBe(96); });
  it('ikke-tall → null', () => { expect(parseStingNumber('Dørsalg')).toBeNull(); expect(parseStingNumber('')).toBeNull(); });
});

describe('stingFromValues — adapter', () => {
  const s = stingFromValues(
    { doors: '1 240', meetings: '96', deals: '47', pipeline: '312 000 kr', tagline: 'Dørsalg som presterer.' },
    { brandName: 'Leadgrid', accent: '#8b5cf6', order: ['doors', 'meetings', 'deals', 'pipeline', 'tagline'] },
  );
  it('velger STØRSTE tall som hero (312 000) + fanger suffix', () => {
    expect(s.hero.value).toBe(312000);
    expect(s.hero.suffix).toBe('kr');
  });
  it('resten blir metrics i visningsrekkefølge, tekst blir caption', () => {
    expect(s.metrics.map((m) => m.value)).toEqual([1240, 96, 47]);
    expect(s.metrics[0].label).toBe('Doors');
    expect(s.caption).toBe('Dørsalg som presterer.');
  });
  it('tomt felt-sett gir trygg default (hero value 0)', () => {
    const e = stingFromValues({}, { brandName: 'X', accent: '#8b5cf6' });
    expect(e.hero.value).toBe(0);
    expect(e.metrics).toEqual([]);
  });
});

describe('buildMotionStingHtml', () => {
  const html = buildMotionStingHtml(DATA);
  it('er selvstendig HTML med merkenavn + hero-verdi + caption', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('Leadgrid');
    expect(html).toContain('data-count="312000"');
    expect(html).toContain('Dørsalg som presterer.');
  });
  it('embedder timeline + play/seek-hooks (autoplay default)', () => {
    expect(html).toContain('window.__stingPlay =');
    expect(html).toContain('window.__stingSeek =');
    expect(html).toContain('window.__stingPlay();'); // autoplay
    expect(html).toContain('"keyframes"');
  });
  it('autoplay:false starter på frame 0 uten å spille', () => {
    const still = buildMotionStingHtml(DATA, { autoplay: false });
    expect(still).toContain('applyAt(0);');
    expect(still).not.toContain('window.__stingPlay();');
  });
  it('HTML-escaper tekst (ingen rå < i data)', () => {
    const evil = buildMotionStingHtml({ ...DATA, brandName: 'A<script>x</script>' });
    expect(evil).toContain('A&lt;script&gt;');
  });
  it('9:16-format setter riktig aspect-ratio', () => {
    const vert = buildMotionStingHtml({ ...DATA, format: '9:16' });
    expect(vert).toContain('aspect-ratio:9 / 16');
  });
});

describe('stingStateAt — deterministisk frame-tilstand (gjør stingen seekbar)', () => {
  const tl = deriveStingTimeline(DATA);
  it('t=0: alt på null (ingenting avslørt)', () => {
    const s = stingStateAt(DATA, 0);
    expect(s.mark).toBe(0);
    expect(s.hero.value).toBe(0);
    expect(s.metrics.every((m) => m.value === 0 && m.barFrac === 0)).toBe(true);
    expect(s.scrub).toBe(0);
  });
  it('t>=total: alt ferdig (hero=mål, barer fulle, caption synlig)', () => {
    const s = stingStateAt(DATA, tl.total);
    expect(s.hero.value).toBe(312000);
    expect(s.hero.opacity).toBe(1);
    expect(s.metrics.map((m) => m.value)).toEqual([1240, 96, 47]);
    expect(s.metrics.every((m) => m.barFrac === 1)).toBe(true);
    expect(s.caption).toBe(1);
    expect(s.scrub).toBe(1);
  });
  it('hero teller MONOTONT opp med t', () => {
    const times = [0, 2200, 2600, 3000, 3400, tl.total];
    const vals = times.map((t) => stingStateAt(DATA, t).hero.value);
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1]);
  });
  it('respekterer keyframe-rekkefølge: metric 0 avsløres før metric 2', () => {
    const early = stingStateAt(DATA, 720); // etter metric0-start, før metric2
    expect(early.metrics[0].opacity).toBeGreaterThan(0);
    expect(early.metrics[2].opacity).toBe(0);
  });
});

describe('stingFrameTimes + buildStingCaptureSpec — render-pipeline-spec', () => {
  const tl = deriveStingTimeline(DATA);
  it('frame-tider starter på 0 og slutter EKSAKT på total', () => {
    const ft = stingFrameTimes(tl.total, 30);
    expect(ft[0]).toBe(0);
    expect(ft[ft.length - 1]).toBe(Math.round(tl.total));
    // ~30 fps over total → omtrent total/1000*30 bilder
    expect(ft.length).toBeGreaterThan(Math.floor((tl.total / 1000) * 30) - 1);
  });
  it('captureSpec: dimensjoner per format + fps + frames', () => {
    expect(buildStingCaptureSpec(DATA).width).toBe(1920);
    expect(buildStingCaptureSpec({ ...DATA, format: '9:16' })).toMatchObject({ width: 1080, height: 1920 });
    expect(buildStingCaptureSpec({ ...DATA, format: '1:1' })).toMatchObject({ width: 1080, height: 1080 });
    const spec = buildStingCaptureSpec(DATA, { fps: 24 });
    expect(spec.fps).toBe(24);
    expect(spec.frames.length).toBeGreaterThan(0);
    expect(spec.total).toBe(tl.total);
  });
});
