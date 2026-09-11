import { describe, expect, it } from 'vitest';
import { buildCallSheetRecipientPreview, buildDayCallSheetFields } from '../CallSheetGenerator';
import type { ProductionDay, SceneBreakdown, CrewMember, Location, Role, Candidate } from '../../models/casting';

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
  secondAd: {
    entries: [{ id: 'cast-ada', personType: 'cast', personId: 'candidate-1', name: 'Ada Skuespiller', roleName: 'NORA', pickupTime: '05:45', callTime: '06:15', makeupTime: '06:30', onSetTime: '07:30', status: 'acknowledged' }],
  },
};

const scenes: SceneBreakdown[] = [
  { id: 's1', sceneNumber: 1, sceneHeading: 'INT. KJØKKEN - DAG', intExt: 'INT', timeOfDay: 'DAY', description: 'Frokost', characters: ['NORA', 'TOBIAS'], pageLength: 2, estimatedDuration: 3, locationName: 'Kjøkken' },
  { id: 's2', sceneNumber: 2, sceneHeading: 'INT. STUE - DAG', intExt: 'INT', timeOfDay: 'DAY', description: 'Krangel', characters: ['NORA'], pageLength: 1 },
  { id: 's9', sceneNumber: 9, sceneHeading: 'EXT. SKOG', characters: ['X'] }, // ikke i dagen
];

const crew: CrewMember[] = [
  { id: 'c1', name: 'Kari Foto', role: 'DOP' as CrewMember['role'], department: 'Foto' as CrewMember['department'], contactInfo: { phone: '+47 900', email: 'kari@film.no' } },
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
    expect(nora).toMatchObject({ id: 'candidate-1', name: 'Ada Skuespiller', pickupTime: '05:45', callTime: '06:15', makeupTime: '06:30', onSetTime: '07:30' });
  });

  it('tar kun dagens crew (c1) med dagens call-time', () => {
    expect(f.crew?.length).toBe(1);
    expect(f.crew?.[0]).toMatchObject({ name: 'Kari Foto', department: 'Foto', position: 'DOP', callTime: '07:00', email: 'kari@film.no' });
  });

  it('setter dato/call/wrap + værvarsel fra dagen', () => {
    expect(f.date).toBe('2026-07-01');
    expect(f.callTime).toBe('07:00');
    expect(f.estimatedWrap).toBe('18:00');
    expect(f.weatherForecast).toMatchObject({ temperature: 19, conditions: 'Lettskyet' });
  });

  it('resolves canonical role IDs to role, actor, email and all individual times', () => {
    const roles: Role[] = [{ id: 'role-nora', name: 'NORA', assignedCandidateId: 'candidate-nora' }];
    const candidates: Candidate[] = [{
      id: 'candidate-nora', name: 'Ada Skuespiller', contactInfo: { email: 'ada@example.test' },
    }];
    const roleIdDay: ProductionDay = {
      ...day,
      scenes: ['s1'],
      secondAd: {
        entries: [{
          id: 'cast:candidate-nora', personType: 'cast', personId: 'candidate-nora', name: 'Ada Skuespiller',
          roleName: 'NORA', pickupTime: '05:45', callTime: '06:15', makeupTime: '06:30',
          wardrobeTime: '06:45', onSetTime: '07:30', transport: 'Bil 2 · Ola', status: 'ready',
        }],
      },
    };
    const fields = buildDayCallSheetFields(
      roleIdDay,
      [{ ...scenes[0], characters: ['role-nora'] }],
      crew,
      locations,
      roles,
      candidates,
    );

    expect(fields.scenes?.[0].cast).toEqual(['NORA']);
    expect(fields.cast).toEqual([expect.objectContaining({
      id: 'candidate-nora', name: 'Ada Skuespiller', role: 'NORA', email: 'ada@example.test',
      pickupTime: '05:45', callTime: '06:15', makeupTime: '06:30', wardrobeTime: '06:45',
      onSetTime: '07:30', transport: 'Bil 2 · Ola', movementStatus: 'ready',
    })]);
  });

  it('previews valid recipients, omits invalid addresses and merges duplicates', () => {
    const preview = buildCallSheetRecipientPreview(
      [
        { id: 'crew-1', name: 'Kari', department: 'Foto', position: 'DOP', callTime: '07:00', email: 'KARI@FILM.NO' },
        { id: 'crew-2', name: 'Uten e-post', department: 'Lyd', position: 'Boom', callTime: '07:00' },
      ],
      [
        { id: 'cast-1', name: 'Ada', role: 'NORA', callTime: '07:00', onSetTime: '08:00', scenes: ['1'], email: 'ada@film.no' },
        { id: 'cast-2', name: 'Kari dublett', role: 'TOBIAS', callTime: '07:00', onSetTime: '08:00', scenes: ['1'], email: 'kari@film.no' },
      ],
    );

    expect(preview.valid.map((recipient) => recipient.email)).toEqual(['kari@film.no', 'ada@film.no']);
    expect(preview.invalid).toEqual([expect.objectContaining({ name: 'Uten e-post', reason: 'Mangler e-postadresse' })]);
    expect(preview.duplicateCount).toBe(1);
  });

  it('normalizes legacy crew contact fields into call-sheet recipients', () => {
    const legacyCrew = [{
      id: 'legacy-crew', name: 'Legacy Lyd', role: 'Sound', department: 'Lyd',
      contact_info: { email: 'lyd@example.test', phone: '+47 999' },
    }] as CrewMember[];
    const fields = buildDayCallSheetFields({ ...day, crew: [] }, scenes, legacyCrew, locations);

    expect(fields.crew?.[0]).toMatchObject({ email: 'lyd@example.test', phone: '+47 999' });
  });
});
