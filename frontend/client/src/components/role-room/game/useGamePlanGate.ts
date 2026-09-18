/**
 * useGamePlanGate — plan-gating for Story Graph i UI.
 *
 *   const gate = useGamePlanGate();
 *   if (!gate.has('share_links')) return <PlanGateBanner feature="share_links" />;
 *
 * Henter GET /api/game/billing/me (abonnement → plan, ellers solo) én gang
 * per minutt (singleton-cache, som dance/useDancePlanGate). Uten svar
 * (nettverk/401) er `has()` optimistisk true så UI aldri låser feilaktig
 * — serveren gater uansett med 402.
 */

import { useEffect, useState } from 'react';
import * as billing from './gameBillingService';

export interface GamePlanGateState {
  loading: boolean;
  plan: billing.GamePlan | null;
  subscription: billing.GameSubscription | null;
  /** true når abonnementet gir planen; false = solo-fallback. */
  active: boolean;
  has: (feature: billing.GameFeature | string) => boolean;
  limit: (key: string) => number | null;
  daysRemaining: number | null;
  refresh: () => Promise<void>;
}

interface Cached { data: billing.EffectivePlan | null; fetchedAt: number }

const CACHE_TTL_MS = 60_000;
let cache: Cached | null = null;
let inFlight: Promise<Cached> | null = null;

async function load(force = false): Promise<Cached> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  if (!force && inFlight) return inFlight;
  inFlight = (async () => {
    let data: billing.EffectivePlan | null = null;
    try { data = await billing.getMyPlan(); } catch { data = null; }
    const next = { data, fetchedAt: Date.now() };
    cache = next;
    inFlight = null;
    return next;
  })();
  return inFlight;
}

/** Nullstill cachen (f.eks. etter checkout/invite-aksept). */
export function resetGamePlanGateCache(): void { cache = null; }

export function useGamePlanGate(): GamePlanGateState {
  const [state, setState] = useState<{ loading: boolean; data: Cached | null }>(() => ({ loading: !cache, data: cache }));

  useEffect(() => {
    let cancelled = false;
    void load().then((data) => { if (!cancelled) setState({ loading: false, data }); });
    return () => { cancelled = true; };
  }, []);

  const eff = state.data?.data ?? null;
  const plan = eff?.plan ?? null;
  const sub = eff?.subscription ?? null;
  return {
    loading: state.loading,
    plan,
    subscription: sub,
    active: eff?.active === true,
    has: (feature) => (plan ? billing.hasFeature(plan, feature) : true),
    limit: (key) => {
      const v = plan?.limits[key];
      const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    },
    daysRemaining: billing.daysUntil(sub?.trialEndAt ?? sub?.compExpiresAt ?? sub?.currentPeriodEnd ?? null),
    refresh: async () => {
      setState((s) => ({ ...s, loading: true }));
      const data = await load(true);
      setState({ loading: false, data });
    },
  };
}
