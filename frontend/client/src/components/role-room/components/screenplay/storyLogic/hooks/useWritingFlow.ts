/**
 * useWritingFlow — sporer skrive-rytmen til brukeren og returnerer en
 * "flow state" som UX kan vise som en mikro-indikator.
 *
 * State-modell:
 *   - 'idle'    — ingen aktivitet siste 60s (eller har aldri skrevet)
 *   - 'starting'— akkurat begynt å skrive (< 8s aktivitet)
 *   - 'flowing' — i flyt (>= 8s med ny aktivitet hvert 0-8s vindu)
 *   - 'paused'  — har skrevet, men pause > 8s og < 60s
 *
 * Bruk:
 *   const { state, secondsInFlow } = useWritingFlow();
 *   // Kall onActivity hver gang brukeren endrer noe (typer i et felt):
 *   <TextField onChange={(e) => { onActivity(); updateConcept(...); }} />
 *
 * Hensikt: gi brukeren en "i flyt"-følelse uten å være distraherende.
 * Mentor-tone: ingen "Du er treig", bare positive eller nøytrale labels.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type WritingFlowState = 'idle' | 'starting' | 'flowing' | 'paused';

export interface UseWritingFlowResult {
  state: WritingFlowState;
  /** Antall sekunder kontinuerlig i 'flowing'-state. Resettes ved pause. */
  secondsInFlow: number;
  /** Kall fra onChange-handlers i felter når brukeren skriver. */
  onActivity: () => void;
}

const STARTING_TO_FLOWING_MS = 8_000;
const ACTIVITY_TO_PAUSED_MS = 8_000;
const PAUSED_TO_IDLE_MS = 60_000;

export function useWritingFlow(): UseWritingFlowResult {
  const [state, setState] = useState<WritingFlowState>('idle');
  const [secondsInFlow, setSecondsInFlow] = useState(0);

  const lastActivityRef = useRef<number>(0);
  const flowStartRef = useRef<number>(0);

  const onActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    setState((prev) => {
      if (prev === 'idle' || prev === 'paused') {
        flowStartRef.current = now;
        return 'starting';
      }
      if (prev === 'starting' && now - flowStartRef.current >= STARTING_TO_FLOWING_MS) {
        return 'flowing';
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const sinceActivity = now - lastActivityRef.current;
      const sinceFlowStart = now - flowStartRef.current;

      setState((prev) => {
        if (prev === 'idle') return prev;
        if (sinceActivity >= PAUSED_TO_IDLE_MS) return 'idle';
        if (sinceActivity >= ACTIVITY_TO_PAUSED_MS) return 'paused';
        if (prev === 'starting' && sinceFlowStart >= STARTING_TO_FLOWING_MS) {
          return 'flowing';
        }
        return prev;
      });

      setSecondsInFlow((prev) => {
        const isFlowing = state === 'flowing' && sinceActivity < ACTIVITY_TO_PAUSED_MS;
        if (!isFlowing) return state === 'flowing' ? prev : 0;
        return Math.floor((now - flowStartRef.current) / 1000);
      });
    };

    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [state]);

  return { state, secondsInFlow, onActivity };
}
