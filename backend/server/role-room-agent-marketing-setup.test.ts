import { describe, expect, it } from 'vitest';
import {
  buildMarketingSetup,
  deriveGeoScope,
  groundMarketingSetupWithAudit,
} from './role-room-agent-marketing-setup.js';

describe('deriveGeoScope', () => {
  it('B2C is always local', () => {
    expect(deriveGeoScope({ businessModel: 'B2C' }, false)).toBe('local');
    expect(deriveGeoScope({ businessModel: 'B2C' }, true)).toBe('local');
  });

  it('pure B2B is national without a verified local presence', () => {
    expect(deriveGeoScope({ businessModel: 'B2B' }, false)).toBe('national');
    expect(deriveGeoScope({ businessModel: 'B2B' }, true)).toBe('local');
  });

  it('B2B/B2C follows the local-presence flag', () => {
    expect(deriveGeoScope({ businessModel: 'B2B/B2C' }, true)).toBe('local');
    expect(deriveGeoScope({ businessModel: 'B2B/B2C' }, false)).toBe('national');
  });
});

describe('buildMarketingSetup — B2C', () => {
  const setup = buildMarketingSetup({ businessModel: 'B2C', industry: 'Restaurant og servering' }, 'local');

  it('leads with visual + local-discovery channels, not LinkedIn', () => {
    const names = setup.channels.map((c) => c.name);
    expect(names).toContain('Instagram');
    expect(names).toContain('TikTok');
    expect(names.some((n) => n.includes('Google Business Profile'))).toBe(true);
    expect(names).not.toContain('LinkedIn');
  });

  it('uses a booking CTA and a lead-form ad-tech, not a demo/meeting CTA', () => {
    expect(setup.primaryCta.toLowerCase()).toMatch(/bestill|book/);
    expect(setup.adTech.some((a) => a.includes('Lead Ads'))).toBe(true);
    expect(setup.adTech.some((a) => a.includes('CAPI'))).toBe(true);
  });
});

describe('buildMarketingSetup — B2B', () => {
  const setup = buildMarketingSetup({ businessModel: 'B2B', industry: 'IT og programvare' }, 'national');

  it('leads with LinkedIn + Google Search, not TikTok', () => {
    const names = setup.channels.map((c) => c.name);
    expect(names).toContain('LinkedIn');
    expect(names).toContain('Google Search');
    expect(names).not.toContain('TikTok');
  });

  it('uses a meeting/demo CTA and firmographic ad-tech', () => {
    expect(setup.primaryCta.toLowerCase()).toMatch(/møte|demo/);
    expect(setup.adTech.some((a) => a.includes('LinkedIn Insight Tag'))).toBe(true);
  });
});

describe('buildMarketingSetup — B2B/B2C (håndverk/foto)', () => {
  const setup = buildMarketingSetup({ businessModel: 'B2B/B2C', industry: 'Håndverk og bygg' }, 'local');

  it('mixes visual portfolio + local search and a tilbud/befaring CTA', () => {
    const names = setup.channels.map((c) => c.name);
    expect(names).toContain('Instagram');
    expect(names).toContain('Google Search');
    expect(setup.primaryCta.toLowerCase()).toMatch(/tilbud|befaring/);
  });
});

describe('buildMarketingSetup — robusthet', () => {
  it('faller tilbake til B2B/B2C for ukjent/tom forretningsmodell', () => {
    expect(buildMarketingSetup({ businessModel: null }, 'national').businessModel).toBe('B2B/B2C');
    expect(buildMarketingSetup({ businessModel: 'noe rart' }, 'national').businessModel).toBe('B2B/B2C');
  });

  it('gir alltid ikke-tomme kanaler, pilarer, CTA, ad-tech og KPI-er', () => {
    for (const model of ['B2C', 'B2B', 'B2B/B2C'] as const) {
      const s = buildMarketingSetup({ businessModel: model }, 'local');
      expect(s.channels.length).toBeGreaterThan(0);
      expect(s.contentPillars.length).toBeGreaterThan(0);
      expect(s.primaryCta.length).toBeGreaterThan(0);
      expect(s.adTech.length).toBeGreaterThan(0);
      expect(s.kpis.length).toBeGreaterThan(0);
      expect(s.rationale.length).toBeGreaterThan(0);
    }
  });

  it('normaliserer varianter av B2B/B2C-strengen', () => {
    expect(buildMarketingSetup({ businessModel: 'b2b/b2c' }, 'local').businessModel).toBe('B2B/B2C');
  });
});

describe('buildMarketingSetup — channel-priority override (#2)', () => {
  it('reorders channels so measured winners come first', () => {
    const base = buildMarketingSetup({ businessModel: 'B2C' }, 'local');
    const overridden = buildMarketingSetup({ businessModel: 'B2C' }, 'local', ['tiktok', 'instagram']);
    expect(base.channels[0].name).toBe('Instagram');
    expect(overridden.channels[0].name).toBe('TikTok');
    expect(overridden.channels[1].name).toBe('Instagram');
    // same set of channels, just reordered
    expect(new Set(overridden.channels.map((c) => c.name))).toEqual(new Set(base.channels.map((c) => c.name)));
  });

  it('fuzzy-matches a platform token to a descriptive channel name', () => {
    const overridden = buildMarketingSetup({ businessModel: 'B2C' }, 'local', ['google']);
    expect(overridden.channels[0].name).toMatch(/Google Business Profile/);
  });

  it('leaves order unchanged when no override is given', () => {
    const a = buildMarketingSetup({ businessModel: 'B2C' }, 'local');
    const b = buildMarketingSetup({ businessModel: 'B2C' }, 'local', null);
    expect(a.channels.map((c) => c.name)).toEqual(b.channels.map((c) => c.name));
  });
});

describe('groundMarketingSetupWithAudit — F1-grunnfesting (doc 14)', () => {
  const base = buildMarketingSetup({ businessModel: 'B2C' }, 'local');

  it('null/tom audit endrer ingenting', () => {
    expect(groundMarketingSetupWithAudit(base, null)).toBe(base);
    expect(groundMarketingSetupWithAudit(base, [])).toBe(base);
  });

  it('pixel funnet i initial HTML → consent-advarsel, ikke «sett opp»', () => {
    const grounded = groundMarketingSetupWithAudit(base, [{ key: 'meta_pixel', status: 'partial' }]);
    const pixelItem = grounded.adTech.find((a) => /Meta Pixel/.test(a))!;
    expect(pixelItem).toContain('FINNES allerede');
    expect(pixelItem).toContain('marketing-samtykke');
    expect(grounded.rationale).toContain('site-audit');
  });

  it('pixel ikke observert → consent-gatet oppsett; GA4/GEO/sitemap-funn blir tiltak', () => {
    const grounded = groundMarketingSetupWithAudit(base, [
      { key: 'meta_pixel', status: 'unknown' },
      { key: 'ga4', status: 'implemented' },
      { key: 'bot_serving', status: 'missing' },
      { key: 'sitemap', status: 'missing' },
    ]);
    expect(grounded.adTech.find((a) => /Meta Pixel/.test(a))).toContain('ikke observert');
    expect(grounded.adTech.some((a) => a.includes('GA4 er allerede'))).toBe(true);
    expect(grounded.adTech.some((a) => a.includes('prerender'))).toBe(true);
    expect(grounded.adTech.some((a) => a.includes('Sitemap mangler'))).toBe(true);
  });

  it('alt på plass → ingen støy-tillegg, kun rationale-sporing', () => {
    const grounded = groundMarketingSetupWithAudit(base, [
      { key: 'ga4', status: 'unknown' },
      { key: 'bot_serving', status: 'implemented' },
      { key: 'sitemap', status: 'implemented' },
    ]);
    expect(grounded.adTech.length).toBe(base.adTech.length);
  });
});
