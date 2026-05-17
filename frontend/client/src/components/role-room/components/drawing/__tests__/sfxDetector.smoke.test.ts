// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { detectFrameSfx, detectSequenceSfx, groupEventsByFrame } from '../sfxDetector';
import { SFX_CATEGORIES } from '../sfxCategories';

describe('Sprint A.7 — sfxDetector basis', () => {
  it('tomt frame returnerer ingen events', () => {
    expect(detectFrameSfx({ id: 'f1' })).toEqual([]);
  });

  it('beskrivelse uten matching keyword returnerer ingen events', () => {
    const events = detectFrameSfx({ id: 'f1', description: 'En person sitter på en stol.' });
    expect(events).toEqual([]);
  });

  it('matcher norsk keyword: "smeller døra" → door-slam', () => {
    const events = detectFrameSfx({ id: 'f1', description: 'Hun smeller døra hardt.' });
    expect(events.some((e) => e.categoryId === 'door-slam')).toBe(true);
  });

  it('matcher engelsk keyword fallback: "footsteps"', () => {
    const events = detectFrameSfx({ id: 'f1', description: 'We hear footsteps in the hall.' });
    expect(events.some((e) => e.categoryId === 'footsteps-walking')).toBe(true);
  });

  it('matcher i caption (manus-linjer)', () => {
    const events = detectFrameSfx({
      id: 'f1',
      caption: 'KARI: telefonen ringer i bakgrunnen',
    });
    expect(events.some((e) => e.categoryId === 'phone-ring')).toBe(true);
  });

  it('alle events har stabil id frameId:categoryId', () => {
    const events = detectFrameSfx({ id: 'frame-x', description: 'Hun smeller døra og løper ut.' });
    events.forEach((e) => {
      expect(e.id).toBe(`frame-x:${e.categoryId}`);
    });
  });
});

describe('Sprint A.7 — sfxDetector deduplisering', () => {
  it('samme keyword flere ganger gir kun én event per kategori', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Han skyter. Han skyter igjen. Skytingen fortsetter.',
    });
    const gunshots = events.filter((e) => e.categoryId === 'gunshot');
    expect(gunshots.length).toBe(1);
  });

  it('forskjellige keywords i samme kategori gir kun én event', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Han skyter med pistol.',
    });
    const gunshots = events.filter((e) => e.categoryId === 'gunshot');
    expect(gunshots.length).toBe(1);
  });
});

describe('Sprint A.7 — sfxDetector intensitets-modifiers', () => {
  it('"voldsomt" hever intensitet fra low til medium', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Han åpner døra voldsomt og kommer inn.',
    });
    const door = events.find((e) => e.categoryId === 'door-open');
    expect(door?.intensity).toBe('medium');
  });

  it('"svakt" senker intensitet fra high til medium', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Han hører torden svakt i det fjerne.',
    });
    const thunder = events.find((e) => e.categoryId === 'thunder');
    // 'svakt' + 'i det fjerne' begge er dampeners — high → medium → low
    expect(['low', 'medium']).toContain(thunder?.intensity);
  });

  it('default-intensitet beholdes uten modifier', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'En bil passerer.',
    });
    const car = events.find((e) => e.categoryId === 'car-pass');
    expect(car?.intensity).toBe('medium'); // default for car-pass
  });
});

describe('Sprint A.7 — sfxDetector flere kategorier', () => {
  it('detekter flere ulike events i én beskrivelse', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Hun løper inn, smeller døra, og telefonen ringer.',
    });
    const cats = events.map((e) => e.categoryId);
    expect(cats).toContain('footsteps-running');
    expect(cats).toContain('door-slam');
    expect(cats).toContain('phone-ring');
  });

  it('hver event har riktig layer (event vs ambient vs music)', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Trafikk i bakgrunnen. Han skyter.',
    });
    const traffic = events.find((e) => e.categoryId === 'traffic');
    const gunshot = events.find((e) => e.categoryId === 'gunshot');
    expect(traffic?.layer).toBe('ambient');
    expect(gunshot?.layer).toBe('event');
  });
});

describe('Sprint A.7 — detectSequenceSfx + gruppering', () => {
  it('detekter events for hele sekvens', () => {
    const all = detectSequenceSfx([
      { id: 'f1', description: 'Hun banker på.' },
      { id: 'f2', description: 'Han åpner døra.' },
      { id: 'f3', description: 'Han ler.' },
    ]);
    expect(all.length).toBeGreaterThanOrEqual(3);
    const frameIds = new Set(all.map((e) => e.frameId));
    expect(frameIds.size).toBe(3);
  });

  it('groupEventsByFrame returnerer per-frame-map', () => {
    const all = detectSequenceSfx([
      { id: 'f1', description: 'Hun smeller døra og løper.' },
      { id: 'f2', description: 'Telefonen ringer.' },
    ]);
    const grouped = groupEventsByFrame(all);
    expect(grouped.get('f1')?.length).toBeGreaterThanOrEqual(2);
    expect(grouped.get('f2')?.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Sprint A.7 — sfxDetector timing-offset auto-detect', () => {
  it('"etter 1 sekund" gir offsetSec=1', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Han åpner døra. Etter 1 sekund kommer skuddet.',
    });
    const gun = events.find((e) => e.categoryId === 'gunshot');
    expect(gun?.offsetSec).toBe(1);
  });

  it('"etter 1.5 sekund" parses som desimaltall', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Han skyter etter 1.5 sekund.',
    });
    const gun = events.find((e) => e.categoryId === 'gunshot');
    expect(gun?.offsetSec).toBe(1.5);
  });

  it('engelsk "after 2 seconds" støttes', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Door slam after 2 seconds.',
    });
    const slam = events.find((e) => e.categoryId === 'door-slam');
    expect(slam?.offsetSec).toBe(2);
  });

  it('"ved 0.5s" støttes', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Telefonen ringer ved 0.5s.',
    });
    const ring = events.find((e) => e.categoryId === 'phone-ring');
    expect(ring?.offsetSec).toBe(0.5);
  });

  it('uten timing-cue: offsetSec=0', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Han åpner døra.',
    });
    const door = events.find((e) => e.categoryId === 'door-open');
    expect(door?.offsetSec).toBe(0);
  });

  it('komma som desimal-skille også', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Han skyter etter 2,5 sekund.',
    });
    const gun = events.find((e) => e.categoryId === 'gunshot');
    expect(gun?.offsetSec).toBe(2.5);
  });

  it('cue må være innenfor 60 tegn etter keyword', () => {
    // "etter 1 sekund" kommer langt etter "ringer" → ignoreres som offset.
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Telefonen ringer. ' + 'x'.repeat(80) + ' og etter 1 sekund stopper det.',
    });
    const ring = events.find((e) => e.categoryId === 'phone-ring');
    expect(ring?.offsetSec).toBe(0);
  });

  it('negative tall avvises (urealistiske)', () => {
    // Vår regex parser kun positive numre — minus prefix matcher ikke.
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Han skyter etter -1 sekund.',
    });
    const gun = events.find((e) => e.categoryId === 'gunshot');
    expect(gun?.offsetSec).toBe(0);
  });

  it('urealistisk høye tall (> 30s) avvises', () => {
    const events = detectFrameSfx({
      id: 'f1',
      description: 'Han skyter etter 999 sekunder.',
    });
    const gun = events.find((e) => e.categoryId === 'gunshot');
    expect(gun?.offsetSec).toBe(0);
  });
});

describe('Sprint A.7 — sfxCategories-katalog er konsistent', () => {
  it('alle kategorier har unik id', () => {
    const ids = SFX_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('alle kategorier har minst ett keyword', () => {
    SFX_CATEGORIES.forEach((c) => {
      expect(c.keywords.length).toBeGreaterThan(0);
    });
  });

  it('alle keywords er små bokstaver (for case-insensitive matching)', () => {
    SFX_CATEGORIES.forEach((c) => {
      c.keywords.forEach((k) => {
        expect(k).toBe(k.toLowerCase());
      });
    });
  });
});
