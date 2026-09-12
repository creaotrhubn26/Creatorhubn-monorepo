/**
 * CreatorHub Norge - Subscription Plans Configuration
 * Centralized plan definitions with display names, features, and pricing
 */

export type PlanTier = 'prototype' | 'basic' | 'pro' | 'enterprise' | 'marketplace';

export interface SubscriptionPlan {
  id: PlanTier;
  name: string; // Display name
  displayName: string; // Full display name
  shortName: string; // Short display name for UI
  description: string;
  priceMonthly: number; // NOK
  priceAnnual: number; // NOK
  features: string[];
  limits: {
    maxProjects: number | 'unlimited';
    maxStorage: number | 'unlimited'; // GB
    maxShowcaseItems: number | 'unlimited';
    maxClientCommunications: number | 'unlimited';
    maxExports: number | 'unlimited';
    maxTeamMembers: number;
  };
  color: string; // Brand color for this plan
  popular?: boolean;
  perUserPricing?: {
    basePrice: number;
    includedUsers: number;
    pricePerAdditionalUser: number;
    pricePerAdditionalUserAnnual: number;
    maxUsers: number;
    volumeDiscounts: Array<{
      minUsers: number;
      discount: number;
    }>;
  };
  trial?: {
    enabled: boolean;
    duration: number; // days
    restrictedFeatures?: string[];
  };
}

export const SUBSCRIPTION_PLANS: Record<PlanTier, SubscriptionPlan> = {
  prototype: {
    id: 'prototype',
    name: 'Prototype',
    displayName: 'Prototype',
    shortName: 'Prototype',
    description: 'Gratis testtilgang for prototyper, validering og enkel gjennomgang før full plan.',
    priceMonthly: 0,
    priceAnnual: 0,
    features: [
      'Prototype-tilgang',
      'Enkel prosjektgjennomgang',
      'Tilbakemeldinger og testflyt',
      'Begrenset lagring',
    ],
    limits: {
      maxProjects: 3,
      maxStorage: 2,
      maxShowcaseItems: 10,
      maxClientCommunications: 10,
      maxExports: 5,
      maxTeamMembers: 0,
    },
    color: '#00bcd4',
    trial: {
      enabled: false,
      duration: 0,
      restrictedFeatures: [],
    },
  },

  basic: {
    id: 'basic',
    name: 'Basic Creator',
    displayName: 'Basic Creator',
    shortName: 'Basic',
    description: 'Perfect for individual creators starting their journey',
    // Synket med backend-fasit (buildCompatPlatformSubscriptionPlans, eks. mva NOK).
    priceMonthly: 249,
    priceAnnual: 2490, // 2 mnd gratis årlig
    features: [
      'Up to 10 active projects',
      '50GB cloud storage',
      'Basic showcase & portfolio',
      'Client communication tools',
      'Standard templates',
      'Email support',
      'Mobile app access',
    ],
    limits: {
      maxProjects: 10,
      maxStorage: 50,
      maxShowcaseItems: 50,
      maxClientCommunications: 100,
      maxExports: 50,
      maxTeamMembers: 2,
    },
    color: '#4caf50',
    trial: {
      enabled: true,
      duration: 14,
      restrictedFeatures: [
        'advanced-analytics',
        'custom-branding',
        'api-access',
        'priority-support',
      ],
    },
  },

  pro: {
    id: 'pro',
    name: 'Pro Creator',
    displayName: 'Pro Creator',
    shortName: 'Pro',
    description: 'For professional creators who need advanced tools',
    // Synket med backend-fasit «Professional» (buildCompatPlatformSubscriptionPlans).
    priceMonthly: 449,
    priceAnnual: 4490, // 2 mnd gratis årlig
    features: [
      'Unlimited projects',
      '500GB cloud storage',
      'Advanced showcase & portfolio',
      'Client CRM & automation',
      'Premium templates & themes',
      'Advanced analytics & reporting',
      'Custom branding',
      'Priority support',
      'API access',
      'Advanced integrations',
    ],
    limits: {
      maxProjects: 'unlimited',
      maxStorage: 500,
      maxShowcaseItems: 'unlimited',
      maxClientCommunications: 'unlimited',
      maxExports: 'unlimited',
      maxTeamMembers: 5,
    },
    color: '#ff8c00',
    popular: true,
    trial: {
      enabled: true,
      duration: 14,
      restrictedFeatures: ['white-label', 'advanced-automation', 'team-collaboration'],
    },
  },

  enterprise: {
    id: 'enterprise',
    name: 'Creator Teams',
    displayName: 'Creator Teams',
    shortName: 'Teams',
    description: 'For teams and agencies managing multiple creators',
    // Synket med backend-fasit «Enterprise»: flat 3990/39900, 100 brukere inkl., 1TB.
    priceMonthly: 3990,
    priceAnnual: 39900, // 2 mnd gratis årlig
    // Enterprise = flat pris med 100 brukere inkludert (ingen per-sete-påslag).
    perUserPricing: {
      basePrice: 3990, // Flat pris — inkluderer 100 brukere
      includedUsers: 100, // Alle 100 brukere inkludert i flat pris
      pricePerAdditionalUser: 0, // Ingen per-bruker-påslag (100 er også taket)
      pricePerAdditionalUserAnnual: 0,
      maxUsers: 100, // Maximum users per enterprise account
      volumeDiscounts: [
        { minUsers: 10, discount: 0.05 }, // 5% discount for 10+ users
        { minUsers: 25, discount: 0.10 }, // 10% discount for 25+ users
        { minUsers: 50, discount: 0.15 }, // 15% discount for 50+ users
      ],
    },
    features: [
      'Everything in Pro Creator',
      'Unlimited team members',
      '2TB cloud storage',
      'White-label platform',
      'Multi-user collaboration',
      'Advanced team management',
      'Custom workflows & automation',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom integrations',
      'Advanced security & compliance',
      'Training & onboarding',
    ],
    limits: {
      maxProjects: 'unlimited',
      maxStorage: 2000,
      maxShowcaseItems: 'unlimited',
      maxClientCommunications: 'unlimited',
      maxExports: 'unlimited',
      maxTeamMembers: 999999,
    },
    color: '#1976d2',
    trial: {
      enabled: true,
      duration: 30,
      restrictedFeatures: [],
    },
  },

  marketplace: {
    id: 'marketplace',
    name: 'Marketplace Add-ons',
    displayName: 'Marketplace Add-ons',
    shortName: 'Add-ons',
    description: 'Individual features and integrations available for purchase',
    priceMonthly: 0, // Variable pricing per add-on
    priceAnnual: 0,
    features: [
      'AI-powered tools',
      'Premium integrations',
      'Advanced automation',
      'Specialized analytics',
      'Premium templates',
      'Custom features',
    ],
    limits: {
      maxProjects: 0,
      maxStorage: 0,
      maxShowcaseItems: 0,
      maxClientCommunications: 0,
      maxExports: 0,
      maxTeamMembers: 0,
    },
    color: '#9c27b0',
  },
};

/**
 * Get display name for a plan tier
 */
export function getPlanDisplayName(tier: PlanTier): string {
  return SUBSCRIPTION_PLANS[tier]?.displayName || tier;
}

/**
 * Get short name for a plan tier
 */
export function getPlanShortName(tier: PlanTier): string {
  return SUBSCRIPTION_PLANS[tier]?.shortName || tier;
}

/**
 * Get plan details
 */
export function getPlanDetails(tier: PlanTier): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS[tier];
}

/**
 * Check if a plan has a specific feature
 */
export function planHasFeature(tier: PlanTier, featureId: string): boolean {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (!plan?.trial) return true;

  return !plan.trial.restrictedFeatures?.includes(featureId);
}

/**
 * Get all available plans (excluding marketplace)
 */
export function getAvailablePlans(): SubscriptionPlan[] {
  return [
    SUBSCRIPTION_PLANS.prototype,
    SUBSCRIPTION_PLANS.basic,
    SUBSCRIPTION_PLANS.pro,
    SUBSCRIPTION_PLANS.enterprise,
  ];
}

/**
 * Compare plans (for upgrade/downgrade)
 */
export function comparePlans(from: PlanTier, to: PlanTier): 'upgrade' | 'downgrade' | 'same' {
  const order: PlanTier[] = ['prototype', 'basic', 'pro', 'enterprise'];
  const fromIndex = order.indexOf(from);
  const toIndex = order.indexOf(to);

  if (fromIndex < toIndex) return 'upgrade';
  if (fromIndex > toIndex) return 'downgrade';
  return 'same';
}

/**
 * Calculate savings for annual billing
 */
export function calculateAnnualSavings(tier: PlanTier): number {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (!plan) return 0;

  const monthlyTotal = plan.priceMonthly * 12;
  return monthlyTotal - plan.priceAnnual;
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: 'NOK' = 'NOK'): string {
  return `${amount.toLocaleString('nb-NO')} ${currency}`;
}
