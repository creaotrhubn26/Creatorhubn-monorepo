// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { scheduleSfx, getActiveSfxAt } from '../sfxScheduler';
import { buildAnimaticTimeline } from '../animaticTimeline';

function event(id: string, frameId: string, categoryId: string, layer: 'event' | 'ambient' | 'music', offset = 0): any {
  return {
    id,
    frameId,
    categoryId,
    category: { id: categoryId, label: categoryId, keywords: [], defaultIntensity: 'medium', layer },
    intensity: 'medium',
    offsetSec: offset,
    matchedKeyword: '',
    layer,
  };
}

const timeline = buildAnimaticTimeline([
  { id: 'f1', duration: 3 },
  { id: 'f2', duration: 2 },
  { id: 'f3', duration: 4 },
]);

describe('Sprint A.7 — sfxScheduler', () => {
  it('event for frame f1 får startSec = segmentets start (0)', () => {
    const s = scheduleSfx([event('e1', 'f1', 'door-slam', 'event')], timeline);
    expect(s).toHaveLength(1);
    expect(s[0].startSec).toBe(0);
  });

  it('event for frame f2 får startSec = 3 (etter f1)', () => {
    const s = scheduleSfx([event('e1', 'f2', 'door-slam', 'event')], timeline);
    expect(s[0].startSec).toBe(3);
  });

  it('event med offset 0.5 starter ved segment.start + 0.5', () => {
    const s = scheduleSfx([event('e1', 'f2', 'door-slam', 'event', 0.5)], timeline);
    expect(s[0].startSec).toBe(3.5);
  });

  it('event for ukjent frame filtreres bort', () => {
    const s = scheduleSfx([event('e1', 'f99', 'door-slam', 'event')], timeline);
    expect(s).toEqual([]);
  });

  it('events sorteres på startSec', () => {
    const s = scheduleSfx([
      event('e1', 'f3', 'a', 'event'),
      event('e2', 'f1', 'b', 'event'),
      event('e3', 'f2', 'c', 'event'),
    ], timeline);
    expect(s.map((x) => x.event.id)).toEqual(['e2', 'e3', 'e1']);
  });

  it('event-lag har maxDuration = resten av segmentet', () => {
    const s = scheduleSfx([event('e1', 'f2', 'door-slam', 'event', 0.5)], timeline);
    // f2 går 3→5, offset 0.5 → start 3.5 → maxDuration = 1.5
    expect(s[0].maxDurationSec).toBeCloseTo(1.5);
  });

  it('ambient-lag har Infinity som maxDuration', () => {
    const s = scheduleSfx([event('e1', 'f1', 'rain', 'ambient')], timeline);
    expect(s[0].maxDurationSec).toBe(Infinity);
  });
});

describe('Sprint A.7 — getActiveSfxAt', () => {
  it('returnerer event som starter ved currentTime', () => {
    const s = scheduleSfx([event('e1', 'f1', 'door-slam', 'event')], timeline);
    const active = getActiveSfxAt(s, 0);
    expect(active.map((a) => a.event.id)).toEqual(['e1']);
  });

  it('event utenfor sitt vindu er ikke aktiv', () => {
    const s = scheduleSfx([event('e1', 'f1', 'door-slam', 'event')], timeline);
    // event starter på 0, varer til 3 (segment-slutt). currentTime=5: ikke aktiv.
    const active = getActiveSfxAt(s, 5);
    expect(active).toEqual([]);
  });

  it('ambient fortsetter inn i neste frame om ikke nytt ambient tar over', () => {
    const s = scheduleSfx([event('a1', 'f1', 'rain', 'ambient')], timeline);
    // f1 går 0..3, f2 starter ved 3. rain er ambient så den fortsetter.
    expect(getActiveSfxAt(s, 1.5).map((a) => a.event.id)).toEqual(['a1']);
    expect(getActiveSfxAt(s, 4).map((a) => a.event.id)).toEqual(['a1']);
    expect(getActiveSfxAt(s, 7).map((a) => a.event.id)).toEqual(['a1']);
  });

  it('siste ambient i samme lag overstyrer tidligere', () => {
    const s = scheduleSfx([
      event('a1', 'f1', 'rain', 'ambient'),
      event('a2', 'f2', 'wind', 'ambient'),
    ], timeline);
    // På tid 1: rain aktiv
    expect(getActiveSfxAt(s, 1).map((a) => a.event.id)).toEqual(['a1']);
    // På tid 4 (i f2): wind har startet → wind vinner
    expect(getActiveSfxAt(s, 4).map((a) => a.event.id)).toEqual(['a2']);
  });

  it('flere event-lag samtidig: alle som er i vindu inkluderes', () => {
    const s = scheduleSfx([
      event('e1', 'f1', 'door-slam', 'event'),
      event('e2', 'f1', 'gunshot', 'event'),
    ], timeline);
    const active = getActiveSfxAt(s, 0);
    expect(active.length).toBe(2);
  });

  it('event + ambient sameksisterer', () => {
    const s = scheduleSfx([
      event('a1', 'f1', 'rain', 'ambient'),
      event('e1', 'f1', 'thunder', 'event'),
    ], timeline);
    const active = getActiveSfxAt(s, 1);
    const ids = active.map((a) => a.event.id).sort();
    expect(ids).toEqual(['a1', 'e1']);
  });
});
