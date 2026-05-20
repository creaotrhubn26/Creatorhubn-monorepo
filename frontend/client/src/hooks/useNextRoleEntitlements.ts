/**
 * useNextRoleEntitlements
 *
 * Sentral feature-gate-hook for NextRole. Returnerer hva den
 * innloggede brukeren har tilgang til, basert på deres abonnement-
 * tier i marketplace.
 *
 * **Per nå** (kampanje-modus): Alle innloggede brukere får 'pro'-
 * tilgang. Dette gjør at vi kan lansere uten Stripe-integrasjon
 * og rulle ut betalt versjon senere uten å endre call-sites.
 *
 * **Senere**: Koble til /api/marketplace/installations eller Stripe
 * subscription-sjekk for å returnere riktig tier per bruker.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from './useAuth';

// NextRole-tier-hierarki:
//   guest     — ikke innlogget eller utløpt abonnement
//   trial     — 14 dagers prøveperiode (alle Pro-features)
//   standard  — 49 kr/mnd (kjernepakke for aktive jobbsøkere)
//   pro       — 99 kr/mnd (ubegrenset + AI søknadsbrev/intervju/oversetting)
export type NextRoleTier = 'guest' | 'trial' | 'standard' | 'pro';

export interface NextRoleEntitlements {
  /** Hvilken tier brukeren har. */
  tier: NextRoleTier;
  /** True hvis Pro (alle features). */
  isPro: boolean;
  /** True hvis Standard eller høyere. */
  isStandard: boolean;
  /** True hvis 14-dagers trial er aktiv. */
  isTrial: boolean;
  /** Antall dager igjen av trial (null hvis ikke i trial). */
  trialDaysLeft: number | null;
  /** True hvis innlogget i det hele tatt. */
  isAuthenticated: boolean;
  /** True hvis brukeren har aktivt betalt abonnement (eller trial). */
  hasActiveSubscription: boolean;
  /** Maks antall CV-er brukeren kan ha. -1 = ubegrenset. */
  maxResumes: number;
  /** True hvis alle 15 templates er låst opp. */
  hasAllTemplates: boolean;
  /** True hvis grunnleggende AI-funksjoner kan brukes (sammendrag, omskriv, ATS). */
  canUseAi: boolean;
  /** True hvis avansert AI (cover-letter, oversettelse, intervjuprep) er låst opp. */
  canUseAdvancedAi: boolean;
  /** True hvis PDF/DOCX-import er låst opp. */
  canImportCv: boolean;
  /** True hvis offentlig CV-deling er låst opp. */
  canPublishPublic: boolean;
  /** True hvis versjon-historikk er låst opp. */
  canUseVersionHistory: boolean;
  /** True hvis engelsk oversettelse er låst opp. */
  canTranslate: boolean;
  /** True hvis GitHub-import er låst opp. */
  canImportGithub: boolean;
  /** Pris-info for upsell-bannere. */
  pricing: {
    standardPrice: number;
    proPrice: number;
    currency: string;
    standardDisplay: string;
    proDisplay: string;
    campaignNote: string;
    trialDays: number;
  };
}

const PRICING = {
  standardPrice: 49,
  proPrice: 99,
  currency: 'kr/mnd',
  standardDisplay: '49 kr / mnd',
  proDisplay: '99 kr / mnd',
  campaignNote: 'Kampanjepris ut 2026',
  trialDays: 14,
};

// Pro = alt låst opp
const PRO_FEATURES = {
  isPro: true,
  isStandard: true,
  maxResumes: -1,
  hasAllTemplates: true,
  canUseAi: true,
  canUseAdvancedAi: true,
  canImportCv: true,
  canPublishPublic: true,
  canUseVersionHistory: true,
  canTranslate: true,
  canImportGithub: true,
};

// Standard = grunnpakke (49 kr/mnd)
const STANDARD_FEATURES = {
  isPro: false,
  isStandard: true,
  maxResumes: 5,
  hasAllTemplates: true,
  canUseAi: true,                // sammendrag, omskriv, ATS-analyse
  canUseAdvancedAi: false,       // ingen cover-letter, oversettelse, intervjuprep
  canImportCv: true,
  canPublishPublic: true,
  canUseVersionHistory: false,
  canTranslate: false,
  canImportGithub: false,
};

// Trial = alle features i 14 dager (samme som Pro)
const TRIAL_FEATURES = PRO_FEATURES;

// Guest = ikke innlogget eller utløpt — kan se marketplace-card men ikke bruke
const GUEST_FEATURES = {
  isPro: false,
  isStandard: false,
  maxResumes: 0,
  hasAllTemplates: false,
  canUseAi: false,
  canUseAdvancedAi: false,
  canImportCv: false,
  canPublishPublic: false,
  canUseVersionHistory: false,
  canTranslate: false,
  canImportGithub: false,
};

interface EntitlementResponse {
  tier?: NextRoleTier;
  hasActiveSubscription?: boolean;
  isAuthenticated?: boolean;
  isTrial?: boolean;
  trialDaysLeft?: number | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}

export function useNextRoleEntitlements(): NextRoleEntitlements {
  const { user } = useAuth();
  // Henter ekte tier-status fra backend. Returnerer 'guest' om bruker
  // ikke er innlogget (ingen network-kall i så fall).
  const { data } = useQuery<EntitlementResponse>({
    queryKey: ['next-role-entitlement', user?.id],
    queryFn: () =>
      apiRequest('/api/marketplace/next-role/entitlement', {
        headers: user?.id ? { 'x-user-id': user.id } : {},
      }),
    enabled: !!user?.id,
    staleTime: 60_000, // refetch maks hvert minutt
    retry: false,
  });

  return useMemo<NextRoleEntitlements>(() => {
    if (!user) {
      return {
        tier: 'guest',
        isAuthenticated: false,
        hasActiveSubscription: false,
        isTrial: false,
        trialDaysLeft: null,
        ...GUEST_FEATURES,
        pricing: PRICING,
      };
    }
    const tier = (data?.tier as NextRoleTier) ?? 'guest';
    const features = tierToEntitlements(tier);
    return {
      tier,
      isAuthenticated: true,
      hasActiveSubscription: !!data?.hasActiveSubscription,
      isTrial: !!data?.isTrial,
      trialDaysLeft: data?.trialDaysLeft ?? null,
      ...features,
      pricing: PRICING,
    };
  }, [user, data]);
}

/**
 * Hjelp-funksjon for å konvertere tier-string fra backend til full
 * entitlements-object. Brukes når Stripe-koblingen er live.
 */
export function tierToEntitlements(tier: NextRoleTier): Omit<NextRoleEntitlements, 'tier' | 'isAuthenticated' | 'hasActiveSubscription' | 'isTrial' | 'trialDaysLeft' | 'pricing'> {
  switch (tier) {
    case 'pro': return PRO_FEATURES;
    case 'standard': return STANDARD_FEATURES;
    case 'trial': return TRIAL_FEATURES;
    case 'guest':
    default: return GUEST_FEATURES;
  }
}

export default useNextRoleEntitlements;
