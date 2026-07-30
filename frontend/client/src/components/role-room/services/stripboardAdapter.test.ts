import { describe, it, expect } from 'vitest';
import {
  MINUTES_PER_PAGE,
  adaptStripboard,
  estimateMinutes,
  stripColor,
  stripStatus,
  type ApiStripboard,
  type ApiStripboardScene,
} from './stripboardAdapter';

const scene = (patch: Partial<ApiStripboardScene> = {}): ApiStripboardScene => ({
  entryId: 'e1',
  sceneId: 's1',
  sceneNumber: 1,
  title: 'Kjøkkenet',
  intExt: 'INT',
  timeOfDay: 'DAY',
  setting: 'NORAS LEILIGHET',
  characters: ['NORA'],
  pageEighths: 8,
  shootStatus: 'not_shot',
  sortOrder: 0,
  setupMinutes: 0,
  ...patch,
});

describe('stripColor', () => {
  it('følger INT/EXT × tid på døgnet', () => {
    expect(stripColor('INT', 'DAY')).toBe('#fff9c4');
    expect(stripColor('INT', 'NIGHT')).toBe('#9c27b0');
    expect(stripColor('EXT', 'DAY')).toBe('#e3f2fd');
    expect(stripColor('EXT', 'NIGHT')).toBe('#1a237e');
  });

  it('kjenner igjen norske tidsangivelser', () => {
    expect(stripColor('EXT', 'NATT')).toBe('#1a237e');
    expect(stripColor('INT', 'KVELD')).toBe('#9c27b0');
    expect(stripColor('EXT', 'GRYNING')).toBe('#ffccbc');
    expect(stripColor('EXT', 'SKUMRING')).toBe('#bf5530');
  });

  it('bruker ikke gryning/skumring på innescener', () => {
    // En innescene lyssettes uansett — tidspunktet endrer ikke stripa.
    expect(stripColor('INT', 'GRYNING')).toBe('#fff9c4');
  });

  it('faller tilbake på INT/DAG når vi ikke vet', () => {
    expect(stripColor(null, null)).toBe('#fff9c4');
  });
});

describe('stripStatus', () => {
  it('skiller «ikke planlagt» fra «planlagt»', () => {
    expect(stripStatus('not_shot', false)).toBe('not-scheduled');
    expect(stripStatus('not_shot', true)).toBe('scheduled');
  });

  it('beholder skutt og delvis skutt', () => {
    expect(stripStatus('shot', true)).toBe('shot');
    expect(stripStatus('partial', true)).toBe('partial');
  });

  it('holder strøket adskilt fra utsatt', () => {
    // En strøket scene skal ikke telle som gjenstående arbeid. Å mappe den
    // til «utsatt» ville lagt den tilbake i køen.
    expect(stripStatus('omitted', true)).toBe('omitted');
    expect(stripStatus('omitted', true)).not.toBe('postponed');
  });

  it('er skutt uansett om den ligger på en dag', () => {
    expect(stripStatus('shot', false)).toBe('shot');
  });
});

describe('estimateMinutes', () => {
  it('regner om åttedeler til tid og legger til ekte riggetid', () => {
    // 8 åttedeler = 1 side = 60 min, pluss 30 min rigg.
    expect(estimateMinutes(8, 30)).toBe(MINUTES_PER_PAGE + 30);
  });

  it('takler halve sider', () => {
    expect(estimateMinutes(4, 0)).toBe(30);
  });

  it('gir riggetiden alene når sidene ikke er målt opp', () => {
    expect(estimateMinutes(null, 45)).toBe(45);
  });
});

describe('adaptStripboard', () => {
  const board: ApiStripboard = {
    projectId: 'p1',
    days: [
      {
        productionDayId: 'd2', date: '2027-03-16', status: 'planned',
        scenes: [scene({ entryId: 'e2', sceneId: 's2', sceneNumber: 2, sortOrder: 0 })],
        totalEighths: 8, totalPagesLabel: '1', totalSetupMinutes: 0, castCount: 1, locationCount: 1,
      },
      {
        productionDayId: 'd1', date: '2027-03-15', status: 'planned',
        scenes: [scene({ entryId: 'e1', sceneId: 's1', sceneNumber: 1, sortOrder: 0 })],
        totalEighths: 8, totalPagesLabel: '1', totalSetupMinutes: 0, castCount: 1, locationCount: 1,
      },
    ],
    unscheduled: [scene({ entryId: null, sceneId: 's3', sceneNumber: 3 })],
    cast: [],
    totalScenes: 3,
    scheduledScenes: 2,
  };

  it('nummererer dagene etter dato, ikke etter rekkefølgen i svaret', () => {
    const strips = adaptStripboard(board);
    expect(strips.find((s) => s.sceneId === 's1')?.dayNumber).toBe(1);
    expect(strips.find((s) => s.sceneId === 's2')?.dayNumber).toBe(2);
  });

  it('tar med scener som ennå ikke har en stripboard-rad', () => {
    // Et importert manus gir scener uten rader. Uten dette står stripboardet
    // tomt etter en import, uten noen vei til å få scenene inn i det.
    const unscheduled = adaptStripboard(board).find((s) => s.sceneId === 's3');
    expect(unscheduled).toBeDefined();
    expect(unscheduled?.status).toBe('not-scheduled');
    expect(unscheduled?.shootingDayId).toBeUndefined();
  });

  it('gir scener uten rad en stabil id', () => {
    const a = adaptStripboard(board).find((s) => s.sceneId === 's3')?.id;
    const b = adaptStripboard(board).find((s) => s.sceneId === 's3')?.id;
    expect(a).toBe('scene:s3');
    expect(a).toBe(b);
  });

  it('regner åttedeler om til sider', () => {
    const strips = adaptStripboard({
      ...board,
      unscheduled: [scene({ entryId: null, sceneId: 's4', pageEighths: 19 })],
      days: [],
      cast: [],
    });
    expect(strips[0].pages).toBeCloseTo(2.375);
  });

  it('tar med alle scenene', () => {
    expect(adaptStripboard(board)).toHaveLength(3);
  });

  it('takler et tomt stripboard uten å finne på data', () => {
    const empty = adaptStripboard({
      projectId: 'p1', days: [], unscheduled: [], cast: [], totalScenes: 0, scheduledScenes: 0,
    });
    expect(empty).toEqual([]);
  });
});
