import { describe, expect, it, vi } from 'vitest';

// Unngå å laste Tauri via claudeProxyService — vi tester kun den rene logikken.
vi.mock('../../services/claudeProxyService.js', () => ({ claudeProxyService: { send: async () => '' } }));

import { extractJson, normalizePosts, computePillarMix, materializePost, type CampaignPost } from './campaignDirector.js';

const mkPost = (over: Partial<CampaignPost> = {}): CampaignPost => ({
  angle: 'A', pillar: 'proof', platform: 'tiktok', format: '9:16', week: 1,
  kpi: { label: 'Vekst', value: '+248 %' }, hooks: [{ text: 'Hook', lever: 'L' }],
  caption: 'cap', hashtags: ['#a'], cta: 'Book', ...over,
});

describe('extractJson', () => {
  it('parser array med fence + etterfølgende prosa', () => {
    expect(extractJson('```json\n[{"a":1}]\n```\nferdig')).toEqual([{ a: 1 }]);
  });
  it('parser bar array og objekt', () => {
    expect(extractJson('[1,2,3]')).toEqual([1, 2, 3]);
    expect(extractJson('Her er svaret: {"x":true} takk')).toEqual({ x: true });
  });
  it('søppel → null', () => {
    expect(extractJson('ingen json her')).toBeNull();
  });
});

describe('normalizePosts — kvalitets-vokter', () => {
  const base = () => [
    { angle: 'A', pillar: 'proof', platform: 'tiktok', format: '9:16', week: 2, kpi: { label: 'Vekst', value: '+248 %' }, hooks: [{ text: 'Hook 1', lever: 'Spesifisitet' }], caption: 'c', hashtags: ['vekst', '#leads'], cta: 'Book nå' },
    { angle: 'Dup', pillar: 'story', platform: 'reels', kpi: { label: 'vekst', value: '+248 %' } }, // dedup (samme fakta, case-insensitiv)
    { angle: 'Tom', pillar: 'proof', kpi: { label: 'Mangler', value: '' } },                        // droppes: ingen verdi
    { angle: 'Ukjent', pillar: 'xxx', platform: 'zzz', kpi: { label: 'Score', value: '4,7' } },       // defaults + auto-hook
  ];
  it('dropper poster uten KPI-verdi og dedupliserer samme fakta', () => {
    const p = normalizePosts(base(), 4);
    expect(p).toHaveLength(2);
    expect(p.map((x) => x.kpi.label)).toEqual(['Vekst', 'Score']);
  });
  it('klamper week, defaulter ukjent pillar/platform/format, sikrer minst én hook', () => {
    const p = normalizePosts([{ pillar: 'nope', platform: 'nope', week: 99, kpi: { label: 'X', value: '10' } }], 4);
    expect(p[0].week).toBe(4);           // klampet til weeks
    expect(p[0].pillar).toBe('proof');   // default
    expect(p[0].platform).toBe('feed');  // default
    expect(p[0].format).toBe('1:1');     // native for feed
    expect(p[0].hooks).toHaveLength(1);  // auto-hook fra angle/label
  });
  it('normaliserer hashtags med # og kapper hooks til 3', () => {
    const p = normalizePosts([{ kpi: { label: 'X', value: '1' }, hashtags: ['a', 'b'], hooks: [1, 2, 3, 4].map((n) => ({ text: 'h' + n, lever: 'L' })) }], 4);
    expect(p[0].hashtags).toEqual(['#a', '#b']);
    expect(p[0].hooks).toHaveLength(3);
  });
  it('ikke-array → tomt', () => {
    expect(normalizePosts(null, 4)).toEqual([]);
  });
});

describe('materializePost — pilar → mal + verdier', () => {
  it('proof → social-stat med kicker/value/label', () => {
    const m = materializePost(mkPost({ pillar: 'proof' }));
    expect(m.tplId).toBe('social-stat');
    expect(m.values.value).toBe('+248 %');
    expect(m.values.kicker).toBe('Vekst');
  });
  it('offer → social-announce med cta', () => {
    const m = materializePost(mkPost({ pillar: 'offer', cta: 'Book demo →' }));
    expect(m.tplId).toBe('social-announce');
    expect(m.values.cta).toBe('Book demo →');
  });
  it('social_proof → social-quote med brandName som author', () => {
    const m = materializePost(mkPost({ pillar: 'social_proof', caption: 'Beste valg' }), 'Dentum');
    expect(m.tplId).toBe('social-quote');
    expect(m.values.quote).toBe('Beste valg');
    expect(m.values.author).toBe('Dentum');
  });
  it('education → social-tips', () => {
    expect(materializePost(mkPost({ pillar: 'education' })).tplId).toBe('social-tips');
  });
});

describe('computePillarMix', () => {
  it('gir andeler som summerer til ~1, synkende', () => {
    const posts = normalizePosts([
      { pillar: 'proof', kpi: { label: 'A', value: '1' } },
      { pillar: 'proof', kpi: { label: 'B', value: '2' } },
      { pillar: 'story', kpi: { label: 'C', value: '3' } },
      { pillar: 'offer', kpi: { label: 'D', value: '4' } },
    ], 4);
    const mix = computePillarMix(posts);
    expect(mix[0]).toEqual({ pillar: 'proof', share: 0.5 });
    expect(Math.round(mix.reduce((s, m) => s + m.share, 0))).toBe(1);
    expect(mix[0].share).toBeGreaterThanOrEqual(mix[mix.length - 1].share);
  });
});
