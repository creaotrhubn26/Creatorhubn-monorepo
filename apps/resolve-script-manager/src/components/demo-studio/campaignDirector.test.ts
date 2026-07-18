import { describe, expect, it, vi } from 'vitest';

// Unngå å laste Tauri via claudeProxyService — vi tester kun den rene logikken.
vi.mock('../../services/claudeProxyService.js', () => ({ claudeProxyService: { send: async () => '' } }));

import { extractJson, normalizePosts, computePillarMix, materializePost, scheduleCampaign, omniChannelUrl, OMNI_CHANNELS, emphasisNote, type CampaignPost } from './campaignDirector.js';

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

describe('scheduleCampaign — kalender', () => {
  it('setter scheduledAt m/ plattform-tid og sprer over uker', () => {
    const posts = [
      mkPost({ platform: 'linkedin', week: 1 }),
      mkPost({ platform: 'tiktok', week: 2, kpi: { label: 'B', value: '2' } }),
    ];
    const s = scheduleCampaign(posts, 2, '2026-07-20');
    expect(s[0].scheduledAt).toMatch(/^2026-07-\d\d 08:00$/);       // uke 1, LinkedIn 08:00
    expect(s[1].scheduledAt).toMatch(/^2026-07-\d\d 18:00$/);       // uke 2, TikTok 18:00
    // uke 2-posten er minst 7 dager etter uke 1
    const d0 = new Date(s[0].scheduledAt!.slice(0, 10));
    const d1 = new Date(s[1].scheduledAt!.slice(0, 10));
    expect((d1.getTime() - d0.getTime()) / 86400000).toBeGreaterThanOrEqual(7);
  });
});

describe('omniChannelUrl — render.png-URL per kanal', () => {
  const og = OMNI_CHANNELS.find((c) => c.id === 'og')!;
  it('bygger render.png-URL m/ tpl=auto, dims og base64url-data', () => {
    const url = new URL(omniChannelUrl(mkPost(), og, '#a855f7'));
    expect(url.pathname).toBe('/api/infographics/render.png');
    expect(url.searchParams.get('tpl')).toBe('auto');
    expect(url.searchParams.get('w')).toBe('1200');
    expect(url.searchParams.get('h')).toBe('630');
    expect(url.searchParams.get('accent')).toBe('#a855f7');
    const d = JSON.parse(Buffer.from(url.searchParams.get('d')!, 'base64url').toString('utf8'));
    expect(d).toEqual({ value: '+248 %', label: 'Vekst', accent: '#a855f7' });
  });
  it('dropper ugyldig accent (ingen accent-param, ikke i data)', () => {
    const url = new URL(omniChannelUrl(mkPost(), og, 'lilla'));
    expect(url.searchParams.get('accent')).toBeNull();
    const d = JSON.parse(Buffer.from(url.searchParams.get('d')!, 'base64url').toString('utf8'));
    expect(d.accent).toBeUndefined();
  });
  it('5 kanaler med ulike dims', () => {
    expect(OMNI_CHANNELS).toHaveLength(5);
    expect(new URL(omniChannelUrl(mkPost(), OMNI_CHANNELS.find((c) => c.id === 'story')!, '#fff')).searchParams.get('h')).toBe('1920');
  });
  it('evergreen: liveSource → source= (ikke d=), self-updating', () => {
    const url = new URL(omniChannelUrl(mkPost({ liveSource: 'agency_leads' }), og, '#a855f7'));
    expect(url.searchParams.get('source')).toBe('agency_leads');
    expect(url.searchParams.get('d')).toBeNull();
  });
  it('ugyldig liveSource ignoreres → faller til d=', () => {
    const url = new URL(omniChannelUrl(mkPost({ liveSource: 'bad key!' }), og, '#a855f7'));
    expect(url.searchParams.get('source')).toBeNull();
    expect(url.searchParams.get('d')).not.toBeNull();
  });
});

describe('emphasisNote — auto-pilot vinner-signal', () => {
  it('bygger note fra vinnere (pilarer/plattformer/vinkler)', () => {
    const note = emphasisNote([
      mkPost({ pillar: 'proof', platform: 'tiktok', angle: 'Rask innsjekk' }),
      mkPost({ pillar: 'story', platform: 'reels', angle: 'Kundehistorie', kpi: { label: 'B', value: '2' } }),
    ]);
    expect(note).toContain('Bevis');
    expect(note).toContain('TikTok');
    expect(note).toContain('Rask innsjekk');
  });
  it('ingen vinnere → tom streng', () => {
    expect(emphasisNote([])).toBe('');
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
