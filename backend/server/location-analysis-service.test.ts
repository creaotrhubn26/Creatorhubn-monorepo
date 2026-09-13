import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeLocation } from './location-analysis-service.js';

describe('location analysis evidence', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('labels Kartverket address evidence separately from curated permit data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      adresser: [{
        adressetekst: 'Rådhusplassen 1',
        kommunenavn: 'Oslo',
        kommunenummer: '0301',
        postnummer: '0037',
        poststed: 'OSLO',
        representasjonspunkt: { lat: 59.911, lon: 10.733 },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const result = await analyzeLocation('Rådhusplassen 1, 0037 Oslo test-evidence');
    expect(result).toEqual(expect.objectContaining({
      source: 'kartverket',
      confidence: 'verified_address',
      permitDataSource: 'curated_directory',
    }));
    expect(result.geocoded?.kommunenummer).toBe('0301');
    expect(result.warnings.join(' ')).toContain('Verifiser alltid');
  });

  it('does not invent a municipality URL when the directory has no match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      adresser: [{
        adressetekst: 'Testvegen 1',
        kommunenavn: 'Eksempelvik',
        kommunenummer: '9998',
        representasjonspunkt: { lat: 62.1, lon: 7.2 },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const result = await analyzeLocation('Testvegen 1, Eksempelvik test-no-guess');
    expect(result.permitDataSource).toBe('generic_guidance');
    expect(result.permitInfo).toEqual(expect.objectContaining({ kommune: 'Eksempelvik' }));
    expect(result.permitInfo?.generalContactUrl).toBeUndefined();
    expect(result.warnings.join(' ')).toContain('Ingen nettadresse');
  });
});
