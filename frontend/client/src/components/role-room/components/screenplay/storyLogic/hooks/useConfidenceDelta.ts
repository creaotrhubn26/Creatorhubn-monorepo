/**
 * useConfidenceDelta — sporer endring i konfidens-score over tid og
 * eksponerer "delta-events" som kan vises som flytende "+N"-badges.
 *
 * Bruk:
 *   const conceptScore = validateConcept(state.concept).score;
 *   const { delta, key } = useConfidenceDelta(conceptScore);
 *   // delta = +N hvis siste endring var positiv, vises i 2.5s og forsvinner
 *   // key = unik ID per delta-event, bruk som React-key på badge
 *
 * Hensikt: gi brukeren mikro-celebrationer når et felt eller fase
 * forbedrer seg. Filtrerer ut små endringer (delta < 3) for å unngå støy.
 */

import { useEffect, useRef, useState } from 'react';

export interface ConfidenceDeltaEvent {
  /** Positiv delta (negative ignoreres). 0 betyr ingen aktiv event. */
  delta: number;
  /** Unik key per event — øker monotont. Bruk som React-key. */
  key: number;
}

const MIN_VISIBLE_DELTA = 3;
const EVENT_LIFETIME_MS = 2_500;
const SETTLE_MS = 400;

export function useConfidenceDelta(score: number): ConfidenceDeltaEvent {
  const [event, setEvent] = useState<ConfidenceDeltaEvent>({ delta: 0, key: 0 });
  const previousScoreRef = useRef<number>(score);
  const keyRef = useRef<number>(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lifetimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);

    settleTimerRef.current = setTimeout(() => {
      const previous = previousScoreRef.current;
      const delta = score - previous;
      previousScoreRef.current = score;

      if (delta >= MIN_VISIBLE_DELTA) {
        keyRef.current += 1;
        setEvent({ delta, key: keyRef.current });

        if (lifetimeTimerRef.current) clearTimeout(lifetimeTimerRef.current);
        lifetimeTimerRef.current = setTimeout(() => {
          setEvent({ delta: 0, key: keyRef.current });
        }, EVENT_LIFETIME_MS);
      }
    }, SETTLE_MS);

    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [score]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (lifetimeTimerRef.current) clearTimeout(lifetimeTimerRef.current);
    };
  }, []);

  return event;
}
