import { describe, expect, it } from 'vitest';
import { parseLensRange } from './CameraSyncService';

/**
 * Objektivteksten kommer rå fra kameraet, og brennvidden leses ut av den.
 * Den brukes til å si hvor langt ut brukeren faktisk var da bildet ble tatt,
 * så en feillesning her blir en feil i loggen — ikke en tom felt.
 */
describe('parseLensRange', () => {
  it('leser et zoomobjektiv som et intervall', () => {
    expect(parseLensRange('RF100-500mm F4.5-7.1 L IS USM')).toEqual([100, 500]);
  });

  it('leser et fastobjektiv som samme tall i begge ender', () => {
    expect(parseLensRange('RF 85mm F1.2 L USM')).toEqual([85, 85]);
  });

  it('tåler mellomrom foran mm', () => {
    expect(parseLensRange('EF 24-70 mm f/2.8L II USM')).toEqual([24, 70]);
  });

  it('svarer null når teksten ikke sier noe om brennvidde', () => {
    expect(parseLensRange('Ukjent objektiv')).toBeNull();
    expect(parseLensRange('')).toBeNull();
    expect(parseLensRange(undefined)).toBeNull();
  });

  it('lar seg ikke lure av blendertall som ligner brennvidde', () => {
    // F4.5-7.1 er blender, ikke mm — bare tall etterfulgt av mm teller.
    expect(parseLensRange('RF100-500mm F4.5-7.1 L IS USM')).not.toEqual([4, 7]);
  });
});
