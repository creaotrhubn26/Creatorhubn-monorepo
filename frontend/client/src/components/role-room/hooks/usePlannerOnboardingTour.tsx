/**
 * usePlannerOnboardingTour — MVP onboarding-tour bygget på toppen av
 * useAIRecommendation. Hvert tour-steg er en uavhengig recommendation med
 * stabil id, så bruker ser hver tip maksimalt én gang per konto.
 *
 * Steg vises sekvensielt med ~6s mellomrom. Bruker kan dismisse (via X i
 * toast) eller ta action (knappen i toast). force=true kan brukes hvis
 * man vil restart touren.
 */

import { useEffect, useRef } from 'react';
import { useAIRecommendation } from './useAIRecommendation';

interface PlannerOnboardingTourOptions {
  /** Hopp over hele touren (f.eks. demo/klient-modus). */
  enabled: boolean;
  /** Bruker-id eller email — bruker som dedup-nøkkel per konto. */
  userKey?: string | null;
  /** Kalles når bruker klikker action på Cmd+K-tip. */
  onOpenCommandPalette?: () => void;
  /** Kalles når bruker klikker action på workflow-stepper-tip. */
  onFocusWorkflowStepper?: () => void;
  /** Kalles når bruker klikker action på "Send til klient"-tip. */
  onShowClientReview?: () => void;
}

const STEP_DELAY_MS = 6000;

export function usePlannerOnboardingTour(options: PlannerOnboardingTourOptions): void {
  const {
    enabled,
    userKey,
    onOpenCommandPalette,
    onFocusWorkflowStepper,
    onShowClientReview,
  } = options;

  const ai = useAIRecommendation({ userKey });
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;

    // Steg 1: Cmd+K-snarvei (vises straks, ~4s etter at brukeren er i prosjekt)
    const t1 = window.setTimeout(() => {
      ai.recommend({
        recommendationId: 'tour-step-1-cmd-k',
        message: 'Trykk Cmd+K (Ctrl+K på Windows) for hurtigsøk over alt.',
        actionLabel: 'Vis paletten',
        onAction: onOpenCommandPalette,
        durationMs: 12000,
      });
    }, 4000);

    // Steg 2: Workflow-stepper (etter ca. 10s — gir bruker tid til å registrere steg 1)
    const t2 = window.setTimeout(() => {
      ai.recommend({
        recommendationId: 'tour-step-2-workflow',
        message: 'Følg pipelinen Brief → Story → Storyboard → Klient → Levering øverst. Klikkbar.',
        actionLabel: 'Vis meg',
        onAction: onFocusWorkflowStepper,
        durationMs: 12000,
      });
    }, 4000 + STEP_DELAY_MS);

    // Steg 3: Klient-godkjenning
    const t3 = window.setTimeout(() => {
      ai.recommend({
        recommendationId: 'tour-step-3-client-review',
        message: 'Når du er klar, send til klient for godkjenning. Status synlig på alle relevante tabs.',
        actionLabel: 'Lær mer',
        onAction: onShowClientReview,
        durationMs: 12000,
      });
    }, 4000 + STEP_DELAY_MS * 2);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // ai er stabil-nok (useRef internt); vi vil bare kjøre én gang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
