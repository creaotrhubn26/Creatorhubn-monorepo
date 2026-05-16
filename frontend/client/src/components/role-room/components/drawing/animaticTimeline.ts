/**
 * animaticTimeline — pure-logic for å mappe frame-sekvens med
 * varigheter til en kontinuerlig tidslinje. AnimaticPlayer bruker
 * dette til å finne hvilket frame som skal vises ved gitt tid.
 *
 * Modellen: hvert frame har en `duration` (sekunder). Vi bygger en
 * sekvens av segmenter [start, end) per frame, og kan slå opp aktivt
 * frame fra gjeldende avspillingstid.
 *
 * Holdes pure (ingen DOM, ingen state) så det er trivielt enhets-
 * testbart og kan kjøre i SSR/jsdom.
 */

export interface AnimaticFrameInput {
  id: string;
  /** Varighet i sekunder. Ikke-positive verdier brukes som DEFAULT_DURATION. */
  duration?: number;
}

export interface TimelineSegment {
  frameId: string;
  frameIndex: number;
  /** Inklusiv. */
  start: number;
  /** Eksklusiv. */
  end: number;
  duration: number;
}

export interface AnimaticTimeline {
  segments: TimelineSegment[];
  totalDuration: number;
}

/** Default-varighet for frames som mangler eller har ugyldig duration. */
export const DEFAULT_FRAME_DURATION = 3;
/** Minimum tillatt varighet — frames under dette tvinges opp. */
export const MIN_FRAME_DURATION = 0.25;

function normalizedDuration(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_FRAME_DURATION;
  }
  return Math.max(MIN_FRAME_DURATION, raw);
}

/**
 * Bygg en tidslinje fra frame-sekvensen.
 */
export function buildAnimaticTimeline(frames: AnimaticFrameInput[]): AnimaticTimeline {
  const segments: TimelineSegment[] = [];
  let cursor = 0;
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    const duration = normalizedDuration(frame.duration);
    segments.push({
      frameId: frame.id,
      frameIndex: i,
      start: cursor,
      end: cursor + duration,
      duration,
    });
    cursor += duration;
  }
  return {
    segments,
    totalDuration: cursor,
  };
}

/**
 * Slå opp hvilket frame som er aktivt ved gitt tid (sekunder).
 * Returnerer null hvis tidslinjen er tom.
 *
 * Konvensjon: end er eksklusiv, så et frame [0..3) inneholder t=0
 * men ikke t=3. På den eksakte grensen tilhører t neste frame.
 * Tid utenfor [0, totalDuration] klampes til nærmeste ende.
 */
export function findActiveSegment(
  timeline: AnimaticTimeline,
  timeSeconds: number,
): TimelineSegment | null {
  const { segments, totalDuration } = timeline;
  if (segments.length === 0) return null;
  if (timeSeconds <= 0) return segments[0];
  if (timeSeconds >= totalDuration) return segments[segments.length - 1];
  // Binær-søk gir O(log n) for lange sekvenser.
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    if (timeSeconds < seg.start) {
      hi = mid - 1;
    } else if (timeSeconds >= seg.end) {
      lo = mid + 1;
    } else {
      return seg;
    }
  }
  // Skal i prinsippet ikke nås, men returner siste som safety.
  return segments[segments.length - 1];
}

/**
 * Klamp tid til [0, totalDuration]. Nyttig for scrubber-input.
 */
export function clampTime(timeline: AnimaticTimeline, timeSeconds: number): number {
  if (!Number.isFinite(timeSeconds)) return 0;
  if (timeSeconds < 0) return 0;
  if (timeSeconds > timeline.totalDuration) return timeline.totalDuration;
  return timeSeconds;
}

/**
 * Få startposisjon (sekunder) for et frame, basert på indeks.
 * Nyttig når UI vil "hopp til frame N".
 */
export function getFrameStartTime(timeline: AnimaticTimeline, frameIndex: number): number {
  if (frameIndex <= 0) return 0;
  if (frameIndex >= timeline.segments.length) return timeline.totalDuration;
  return timeline.segments[frameIndex].start;
}
