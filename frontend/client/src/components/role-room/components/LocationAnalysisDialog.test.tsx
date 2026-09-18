// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LocationAnalysisDialog, publicTransportLabel } from './LocationAnalysisDialog';
import type { Location } from '../models/casting';

vi.mock('../services/externalDataService', () => ({
  externalDataService: {
    analyzeProperty: vi.fn(async () => { throw new Error('skal ikke kalles'); }),
    getKartverketAddress: vi.fn(async () => { throw new Error('skal ikke kalles'); }),
  },
}));

/**
 * Analysen leses av en location scout som ikke har gjort annet enn å åpne
 * lokasjonen sin. Data kan komme fra Kartverket, fra en fallback-kilde, fra en
 * manuell overstyring eller fra en analyse lagret av en eldre versjon — og da
 * stemmer ikke formen alltid. Den skal vise det den har, ikke forsvinne.
 */
const fremmedFormat = {
  id: 'ostenfor',
  name: 'Østerdalen gård',
  address: 'Vollanveien 221, 2512 Kvikne',
  propertyAnalysis: {
    photographySpots: [],
    droneRestrictions: { allowed: true },
    weatherExposure: {},
    accessAnalysis: {
      // Objekter der komponenten venter tekst: dette veltet hele dialogen.
      publicTransport: [
        { name: 'Kvikne stasjon', distance: '1,2 km', type: 'tog' },
        'Buss 4 mot Tynset',
      ],
      parkingSpots: [
        // Uten koordinat: navigering finnes ikke, men plassen gjør det.
        { name: 'Gårdsplassen', address: 'Vollanveien 221', spaces: 8 },
      ],
    },
    analysisMeta: { operationalStatus: 'user_confirmed', propertySource: 'fallback' },
  },
} as unknown as Location;

describe('publicTransportLabel', () => {
  it('lar tekst være tekst', () => {
    expect(publicTransportLabel('Buss 4 mot Tynset')).toBe('Buss 4 mot Tynset');
  });

  it('gjør et objekt om til lesbar tekst', () => {
    expect(publicTransportLabel({ name: 'Kvikne stasjon', distance: '1,2 km', type: 'tog' }))
      .toBe('Kvikne stasjon · tog · 1,2 km');
  });

  it('gir tom streng for noe den ikke kan lese, framfor å sende det videre', () => {
    expect(publicTransportLabel(null)).toBe('');
    expect(publicTransportLabel({})).toBe('');
    expect(publicTransportLabel(undefined)).toBe('');
  });
});

describe('LocationAnalysisDialog med data som ikke kommer fra Kartverket', () => {
  it('åpner analysen i stedet for å forsvinne', () => {
    render(<LocationAnalysisDialog open location={fremmedFormat} onClose={() => {}} />);
    expect(screen.getByText('Østerdalen gård')).toBeInTheDocument();
  });

  it('viser kollektivlinjen som tekst, uansett hvilken form den kom i', () => {
    render(<LocationAnalysisDialog open location={fremmedFormat} onClose={() => {}} />);
    expect(screen.getByText('Kvikne stasjon · tog · 1,2 km')).toBeInTheDocument();
    expect(screen.getByText('Buss 4 mot Tynset')).toBeInTheDocument();
  });

  it('viser en parkering uten koordinat, men uten å love navigering', () => {
    render(<LocationAnalysisDialog open location={fremmedFormat} onClose={() => {}} />);
    expect(screen.getByText('Gårdsplassen')).toBeInTheDocument();
    expect(screen.queryByText('Trykk for navigering')).not.toBeInTheDocument();
  });
});
