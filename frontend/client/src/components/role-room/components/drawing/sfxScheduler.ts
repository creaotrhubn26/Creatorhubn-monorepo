/**
 * sfxScheduler — kobler SfxEvent[] til animatic-timelinen og holder
 * styr på når hver event skal spilles av. Pure-logic-funksjoner her;
 * en hook (useSfxPlayback) kaller dem under RAF-tick og styrer
 * audio-elementer.
 *
 * Hvert SfxEvent får en absolutt start-tid (sekunder fra animatic-
 * start) basert på framet det tilhører. Modulen tar IKKE stilling
 * til om lyden er tilgjengelig — den behandler kun timing-laget.
 */

import type { AnimaticTimeline, TimelineSegment } from './animaticTimeline';
import type { SfxEvent } from './sfxDetector';

export interface ScheduledSfx {
  event: SfxEvent;
  segment: TimelineSegment;
  /** Absolutt start-tid i sekunder. */
  startSec: number;
  /** Maksimal varighet (begrenset av segmentets lengde, ellers Infinity). */
  maxDurationSec: number;
}

/**
 * Bygg en liste over alle SFX-events kombinert med deres absolutte
 * starttid på timelinen. Events for frames som ikke finnes i
 * timelinen filtreres ut.
 */
export function scheduleSfx(
  events: SfxEvent[],
  timeline: AnimaticTimeline,
): ScheduledSfx[] {
  const segmentByFrameId = new Map<string, TimelineSegment>();
  for (const seg of timeline.segments) {
    segmentByFrameId.set(seg.frameId, seg);
  }
  const scheduled: ScheduledSfx[] = [];
  for (const event of events) {
    const segment = segmentByFrameId.get(event.frameId);
    if (!segment) continue;
    const startSec = segment.start + Math.max(0, event.offsetSec);
    if (startSec >= segment.end) continue; // offset > segment-lengde
    scheduled.push({
      event,
      segment,
      startSec,
      // Ambient/music kan vare lengre enn ett frame — vi lar mixer-
      // logikken styre stop. Event-lag begrenses til frame-slutt.
      maxDurationSec: event.layer === 'event' ? segment.end - startSec : Infinity,
    });
  }
  // Sorter på startSec så avspillingslogikken kan iterere i orden.
  scheduled.sort((a, b) => a.startSec - b.startSec);
  return scheduled;
}

/**
 * Returner events som er aktive (skal høres) ved gitt tid.
 *
 * 'event'-lag: aktiv kun mens currentTime er innenfor sin start+
 *   max-duration-vindu.
 * 'ambient' og 'music': aktiv så lenge currentTime ≥ startSec og
 *   før neste event av samme lag tar over. For enkelhets skyld i
 *   denne MVP-en lar vi ambient/music ligge til segmentet ender —
 *   eksempel: regn-ambient i frame 1 fortsetter inn i frame 2 hvis
 *   frame 2 ikke har eget ambient.
 *
 * Returnerer en liste med samtidige events sortert per layer.
 */
export function getActiveSfxAt(
  scheduled: ScheduledSfx[],
  currentTime: number,
): ScheduledSfx[] {
  const active: ScheduledSfx[] = [];
  // Track latest start-time per layer; bare den siste i hvert lag er
  // aktiv (vi vil ikke spille to ambient-spor samtidig).
  const latestByLayer = new Map<string, ScheduledSfx>();
  for (const s of scheduled) {
    if (s.startSec > currentTime) continue;
    if (s.event.layer === 'event') {
      // Event-lyd er aktiv kun innenfor sitt eget vindu.
      if (currentTime <= s.startSec + s.maxDurationSec) {
        active.push(s);
      }
    } else {
      // Ambient/music: siste oppstart vinner.
      latestByLayer.set(s.event.layer, s);
    }
  }
  for (const s of latestByLayer.values()) {
    active.push(s);
  }
  return active;
}
