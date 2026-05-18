/**
 * continuityStrip — pure logic for nabo-frame-vindu i editoren.
 *
 * Storyboard-artister mister kontinuitet hvis de tegner én frame
 * isolert. Denne modulen henter ut ±N naboer rundt en aktiv index,
 * stabil mot ut-av-grenser-tilfeller (start/slutt av sekvensen).
 *
 * Modulen er pixel/UI-agnostisk — komponentene som rendrer thumbs
 * bruker output-en, men logikken her er trivielt testbar.
 */

export interface StripFrame<T> {
  /** Original-frame-objekt (ikke modifisert). */
  frame: T;
  /** Absolutt indeks i hele frame-sekvensen. */
  index: number;
  /** Posisjon relativt til aktiv frame: -2, -1, 0, +1, +2 osv. */
  relativeOffset: number;
  isActive: boolean;
}

export interface ContinuityWindow<T> {
  before: Array<StripFrame<T>>;
  active: StripFrame<T> | null;
  after: Array<StripFrame<T>>;
  /** Sammenhengende rekkefølge (før + active + etter). Egnet for direkte map() i UI. */
  ordered: Array<StripFrame<T>>;
}

/**
 * Returnerer naboer i en symmetrisk radius rundt activeIndex.
 *
 * @param frames Hele frame-sekvensen
 * @param activeIndex Indeksen til aktiv frame (kan være -1 = "ingen valgt")
 * @param radius Antall naboer på hver side (default 2 = ±2 = 5 thumbs totalt)
 */
export function getNeighborWindow<T>(
  frames: T[],
  activeIndex: number,
  radius = 2,
): ContinuityWindow<T> {
  if (frames.length === 0 || activeIndex < 0 || activeIndex >= frames.length) {
    return { before: [], active: null, after: [], ordered: [] };
  }
  const before: Array<StripFrame<T>> = [];
  const after: Array<StripFrame<T>> = [];

  for (let offset = 1; offset <= radius; offset += 1) {
    const beforeIdx = activeIndex - offset;
    if (beforeIdx >= 0) {
      before.unshift({
        frame: frames[beforeIdx],
        index: beforeIdx,
        relativeOffset: -offset,
        isActive: false,
      });
    }
    const afterIdx = activeIndex + offset;
    if (afterIdx < frames.length) {
      after.push({
        frame: frames[afterIdx],
        index: afterIdx,
        relativeOffset: offset,
        isActive: false,
      });
    }
  }

  const active: StripFrame<T> = {
    frame: frames[activeIndex],
    index: activeIndex,
    relativeOffset: 0,
    isActive: true,
  };

  return {
    before,
    active,
    after,
    ordered: [...before, active, ...after],
  };
}

/**
 * "Edge"-flagg som UI kan bruke for å vise pile-knapper eller "start/end of
 * sequence"-indikator. Trivielt, men sentralisert så vi kan endre logikken
 * (f.eks. wrap-around) på ett sted.
 */
export interface ContinuityNavigationFlags {
  hasPrevious: boolean;
  hasNext: boolean;
  isAtStart: boolean;
  isAtEnd: boolean;
}

export function getNavigationFlags(
  totalFrames: number,
  activeIndex: number,
): ContinuityNavigationFlags {
  if (totalFrames === 0 || activeIndex < 0) {
    return { hasPrevious: false, hasNext: false, isAtStart: true, isAtEnd: true };
  }
  return {
    hasPrevious: activeIndex > 0,
    hasNext: activeIndex < totalFrames - 1,
    isAtStart: activeIndex === 0,
    isAtEnd: activeIndex === totalFrames - 1,
  };
}
