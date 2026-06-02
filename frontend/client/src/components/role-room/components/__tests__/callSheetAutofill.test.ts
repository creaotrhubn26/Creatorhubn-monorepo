import { describe, expect, it } from 'vitest';
import { buildDayCallSheetFields } from '../CallSheetGenerator';
import type { ProductionDay, SceneBreakdown, CrewMember, Location } from '../../models/casting';

const day: ProductionDay = {
  id: 'd1',
  date: '2026-07-01',
  callTime: '07:00',
  wrapTime: '18:00',
  locationId: 'loc1',
  scenes: ['s1', 's2'],
  crew: ['c1'],
  props: [],
  weatherForecast: {
    location: 'Oslo',
    days: 1,
    source: 'yr_api',
    forecast: [{ date: '2026-07-01', temperature: 19, humidity: 60, windSpeed: 3, precipitation: 0, symbol: 'Lettskyet' }],
  },
};

const scenes: SceneBreakdown[] = [
  { id: 's1', sceneNumber: 1, sceneHeading: 'INT. KJØKKEN - DAG', intExt: 'INT', timeOfDay: 'DAY', description: 'Frokost', characters: ['NORA', 'TOBIAS'], pageLength: 2, estimatedDuration: 3, locationName: 'Kjøkken' },
  { id: 's2', sceneNumber: 2, sceneHeading: 'INT. STUE - DAG', intExt: 'INT', timeOfDay: 'DAY', description: 'Krangel', characters: ['NORA'], pageLength: 1 },
  { id: 's9', sceneNumber: 9, sceneHeading: 'EXT. SKOG', characters: ['X'] }, // ikke i dagen
];

const crew: CrewMember[] = [
  { id: 'c1', name: 'Kari Foto', role: 'DOP' as CrewMember['role'], department: 'Foto' as CrewMember['department'], contactInfo: { phone: '+47 900' } },
  { id: 'c2', name: 'Per Lyd', role: 'Sound' as CrewMember['role'] }, // ikke i dagens crew
];

const locations: Location[] = [
  { id: 'loc1', name: 'Studio A', address: 'Storgata 1, 0155 Oslo', accessNotes: 'Parkering i bakgård', contactInfo: { name: 'Vakt', phone: '+47 911' }, coordinates: { lat: 59.91, lng: 10.75 } },
];

describe('buildDayCallSheetFields (auto-fyll call-sheet fra produksjonsdag)', () => {
  const f = buildDayCallSheetFields(day, scenes, crew, locations);

  it('henter dagens ekte location med geokodet adresse', () => {
    expect(f.locations?.[0]).toMatchObject({ name: 'Studio A', address: 'Storgata 1, 0155 Oslo', parkingInfo: 'Parkering i bakgård', contactPhone: '+47 911' });
  });

  it('tar kun dagens scener (s1, s2), ikke s9', () => {
    expect(f.scenes?.map((s) => s.sceneNumber)).toEqual(['1', '2']);
    expect(f.scenes?.[0]).toMatchObject({ intExt: 'INT', dayNight: 'DAY', description: 'Frokost', location: 'Studio A' });
  });

  it('utleder cast fra scenenes karakterer (unike)', () => {
    const roles = f.cast?.map((c) => c.role).sort();
    expect(roles).toEqual(['NORA', 'TOBIAS']);
    const nora = f.cast?.find((c) => c.role === 'NORA');
    expect(nora?.scenes).toEqual(['1', '2']); // NORA i begge
  });

  it('tar kun dagens crew (c1) med dagens call-time', () => {
    expect(f.crew?.length).toBe(1);
    expect(f.crew?.[0]).toMatchObject({ name: 'Kari Foto', department: 'Foto', position: 'DOP', callTime: '07:00' });
  });

  it('setter dato/call/wrap + værvarsel fra dagen', () => {
    expect(f.date).toBe('2026-07-01');
    expect(f.callTime).toBe('07:00');
    expect(f.estimatedWrap).toBe('18:00');
    expect(f.weatherForecast).toMatchObject({ temperature: 19, conditions: 'Lettskyet' });
  });
});
