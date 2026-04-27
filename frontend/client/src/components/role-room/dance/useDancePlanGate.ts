/**
 * useDancePlanGate — react hook for plan-gating av features.
 *
 * Bruk:
 *   const gate = useDancePlanGate();
 *   if (!gate.has('ai_tagging')) return <UpgradePrompt feature="ai_tagging" />;
 *
 * Henter abonnement + plan i bakgrunnen og cacher i en singleton så
 * hooken kan brukes mange steder uten å re-fetche.
 */

import { useEffect, useState } from 'react';
import * as billing from './danceBillingService';

interface PlanGateState {
  loading: boolean;
  subscription: billing.DanceSubscription | null;
  plan: billing.DancePlan | null;
  /** Sjekker om planen inkluderer en gitt feature-streng. */
  has: (feature: string) => boolean;
  /** Sjekker om abonnementet er aktivt (active/trialing/comp). */
  isActive: boolean;
  /** Antall dager igjen av trial / comp / period; null hvis ikke aktiv eller ukjent. */
  daysRemaining: number | null;
  /** Refresh i tilfelle abonnementet ble oppdatert. */
  refresh: () => Promise<void>;
}

interface CachedState {
  subscription: billing.DanceSubscription | null;
  plan: billing.DancePlan | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;
let cache: CachedState | null = null;
let inFlight: Promise<CachedState> | null = null;

async function loadGate(force = false): Promise<CachedState> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  if (!force && inFlight) return inFlight;
  inFlight = (async () => {
    let sub: billing.DanceSubscription | null = null;
    try { sub = await billing.getSubscription(); } catch { sub = null; }
    let plan: billing.DancePlan | null = null;
    if (sub?.planSlug) {
      try {
        const all = await billing.listPlans();
        plan = all.find((p) => p.slug === sub!.planSlug) ?? null;
      } catch { plan = null; }
    }
    const next: CachedState = { subscription: sub, plan, fetchedAt: Date.now() };
    cache = next;
    inFlight = null;
    return next;
  })();
  return inFlight;
}

export function useDancePlanGate(): PlanGateState {
  const [state, setState] = useState<{ loading: boolean; data: CachedState | null }>(() => ({
    loading: true,
    data: cache,
  }));

  const refresh = async (): Promise<void> => {
    setState((s) => ({ ...s, loading: true }));
    const data = await loadGate(true);
    setState({ loading: false, data });
  };

  useEffect(() => {
    let cancelled = false;
    void loadGate().then((data) => {
      if (!cancelled) setState({ loading: false, data });
    });
    return () => { cancelled = true; };
  }, []);

  const sub = state.data?.subscription ?? null;
  const plan = state.data?.plan ?? null;
  const isActive = billing.isPlanActive(sub);
  const daysRemaining = billing.daysUntil(
    sub?.trialEndAt ?? sub?.compExpiresAt ?? sub?.currentPeriodEnd ?? null,
  );

  return {
    loading: state.loading,
    subscription: sub,
    plan,
    has: (feature: string): boolean => billing.hasFeature(plan, feature),
    isActive,
    daysRemaining,
    refresh,
  };
}

/**
 * Vent — hooken brukes ofte for "skjul UI hvis ikke tilgang", men noen
 * features er gratis i alle planer (rehearsal_log er i Frilanser Free).
 * Default-fallback: hvis vi ikke har plan-data ennå, anta at brukeren
 * har basis-tilgang. Det viser heller en kort blink av en feature enn
 * å skjule den feilaktig.
 */
export const ALWAYS_AVAILABLE_FEATURES = new Set<string>([
  'rehearsal_log',
  'video_review_basic',
  'reel_basic',
]);
