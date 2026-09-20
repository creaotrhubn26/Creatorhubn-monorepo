import { describe, expect, it } from 'vitest';
import { resetRoutePathFor } from './leadgridRoutes';

/**
 * Hvilken rute-sti passordtilbakestillingen skal matche.
 *
 * Feilen den fester: på leadgrid.no normaliseres «/reset-passord/x» til
 * «/leadgrid/reset-passord/x» internt, og koden valgte rutemønster etter
 * *host* i stedet for etter adressen brukeren faktisk står på. Den som åpnet
 * den prefiksede lenken på leadgrid.no fikk derfor et mønster som ikke
 * matchet, Route rendret null, og siden ble blank. En passordlenke som viser
 * ingenting er verre enn en som sier at lenken er ugyldig.
 */
describe('resetRoutePathFor', () => {
  it('matcher den rene stien e-posten sender', () => {
    expect(resetRoutePathFor('/reset-passord/abc123')).toBe('/reset-passord/:token');
  });

  it('matcher den prefiksede stien på samme host', () => {
    expect(resetRoutePathFor('/leadgrid/reset-passord/abc123'))
      .toBe('/leadgrid/reset-passord/:token');
  });

  it('velger etter adressen, ikke etter host', () => {
    // Begge finnes på leadgrid.no. Begge skal vise siden.
    const stier = ['/reset-passord/t', '/leadgrid/reset-passord/t'];
    const mønstre = stier.map(resetRoutePathFor);
    expect(new Set(mønstre).size).toBe(2);
    stier.forEach((sti, i) => {
      const konkret = mønstre[i].replace(':token', 't');
      expect(konkret).toBe(sti);
    });
  });
});
