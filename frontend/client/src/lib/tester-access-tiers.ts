/**
 * tester-access-tiers.ts — Slice 9X.53
 *
 * Hvilke planer + features en prototype-tester kan få tilgang til.
 * Daniel velger en plan + (valgfritt) ekstra features ved godkjenning.
 *
 * Default for alle nye testere: 'tester_all_access' = Premium + alle
 * in-development features. Daniel kan klikke "Tilpass" for å begrense.
 */

export const DEFAULT_TESTER_PLAN = 'tester_all_access';

export interface TesterAccessTier {
  id: string;
  label: string;
  description: string;
  basedOnPlan: 'basic' | 'professional' | 'premium';
  /** '*' betyr alle in-dev features. Ellers eksplisitt liste. */
  includesFeatures: string[] | ['*'];
}

export const TESTER_ACCESS_TIERS: Record<string, TesterAccessTier> = {
  tester_all_access: {
    id: 'tester_all_access',
    label: 'Tester All-Access',
    description: 'Alt Premium har + alle funksjoner under utvikling. Standardvalg.',
    basedOnPlan: 'premium',
    includesFeatures: ['*'],
  },
  tester_professional: {
    id: 'tester_professional',
    label: 'Tester på Professional',
    description: 'Professional-features + spesifikke in-dev features Daniel velger.',
    basedOnPlan: 'professional',
    includesFeatures: [],
  },
  tester_focused: {
    id: 'tester_focused',
    label: 'Fokusert tester',
    description: 'Basic-features + KUN de spesifikke features Daniel velger. For målrettet testing av én funksjon.',
    basedOnPlan: 'basic',
    includesFeatures: [],
  },
};

/**
 * Katalog over in-development features som kan tildeles testere.
 * Holdes manuelt vedlikeholdt — legges til når nye features kommer i pipeline.
 * Hver feature har en kort label + beskrivelse + status-hint.
 */
export interface InDevFeature {
  key: string;
  label: string;
  description: string;
  status: 'alpha' | 'beta' | 'rc';
}

export const IN_DEV_FEATURES: InDevFeature[] = [
  { key: 'wedding-day-flow', label: 'Wedding Day-flyt', description: 'Live timeline + assistent-administrasjon på bryllupsdagen', status: 'beta' },
  { key: 'assistant-rolodex', label: 'Assistent-rolodex', description: 'Liste over tidligere samarbeidspartnere + re-invite', status: 'beta' },
  { key: 'culling-ai', label: 'AI-culling', description: 'Automatisk pre-utvelging av bilder med Claude/GPT', status: 'alpha' },
  { key: 'role-room-integration', label: 'Role Room (eget program)', description: 'IKKE inkludert — Role Room har eget tester-program', status: 'beta' },
  { key: 'magic-creator', label: 'Magic Creator (AI)', description: 'AI-assistert prosjekt-opprettelse fra fritekst', status: 'alpha' },
  { key: 'invoice-generator', label: 'AI faktura-generator', description: 'Automatisk faktura fra bryllupsdata + utstyrsleie', status: 'beta' },
  { key: 'gallery-delivery', label: 'Klient-galleri-leveranse', description: 'Selvbetjent klient-galleri med download + favoritter', status: 'rc' },
];

export function getTierLabel(tierId: string): string {
  return TESTER_ACCESS_TIERS[tierId]?.label || tierId;
}

export function getFeatureLabel(key: string): string {
  return IN_DEV_FEATURES.find((f) => f.key === key)?.label || key;
}

/**
 * Returnerer hva en tester med gitt tier + features faktisk har tilgang til,
 * for visning i UI (accept-side, welcome-modal, settings).
 */
export function resolveTesterAccess(tierId: string, extraFeatures: string[]): {
  basedOnPlan: string;
  features: Array<{ key: string; label: string; description: string; isExplicit: boolean }>;
  isAllAccess: boolean;
} {
  const tier = TESTER_ACCESS_TIERS[tierId] || TESTER_ACCESS_TIERS[DEFAULT_TESTER_PLAN];
  const isAllAccess = tier.includesFeatures[0] === '*';

  if (isAllAccess) {
    return {
      basedOnPlan: tier.basedOnPlan,
      features: IN_DEV_FEATURES.map((f) => ({
        key: f.key,
        label: f.label,
        description: f.description,
        isExplicit: false,
      })),
      isAllAccess: true,
    };
  }

  const explicitKeys = new Set([...(tier.includesFeatures as string[]), ...extraFeatures]);
  return {
    basedOnPlan: tier.basedOnPlan,
    features: IN_DEV_FEATURES
      .filter((f) => explicitKeys.has(f.key))
      .map((f) => ({
        key: f.key,
        label: f.label,
        description: f.description,
        isExplicit: true,
      })),
    isAllAccess: false,
  };
}
