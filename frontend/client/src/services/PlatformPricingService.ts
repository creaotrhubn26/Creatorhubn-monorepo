/**
 * CreatorHub Norge - Platform Pricing Service
 * Handles user subscription pricing for platform access (separate from client service pricing)
 */

import { useQuery } from '@tanstack/react-query';

// Platform subscription types
export type PlatformTier = 'free' | 'prototype' | 'basic' | 'professional' | 'premium' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';
export type Currency = 'NOK' | 'SEK' | 'DKK' | 'USD';

// Platform subscription interfaces
export interface PlatformSubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  tier: PlatformTier;
  price: number;
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  yearlySavingsLabel?: string | null;
  currency: Currency;
  billingCycle: BillingCycle;
  features: string[];
  limits: {
    maxUsers: number;
    maxProjects: number;
    maxClients: number;
    maxStorageGB: number;
    maxApiCalls: number;
  };
  isActive: boolean;
  isPopular?: boolean;
  popular?: boolean;
  isPublic?: boolean;
  contactSalesOnly?: boolean;
  publicPriceLabel?: string | null;
  ctaLabel?: string | null;
  trialDays: number;
  stripePriceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformFeature {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'professional' | 'premium' | 'enterprise';
  isIncluded: boolean;
  additionalCost?: number;
  currency?: Currency;
}

export interface PlatformPricingTier {
  tier: PlatformTier;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: Currency;
  features: string[];
  limits: Record<string, number>;
}

class PlatformPricingService {
  private static instance: PlatformPricingService;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private readonly OVERRIDE_KEY = 'platform_subscription_plans_override';

  private constructor() {}

  public static getInstance(): PlatformPricingService {
    if (!PlatformPricingService.instance) {
      PlatformPricingService.instance = new PlatformPricingService();
    }
    return PlatformPricingService.instance;
  }

  // =============================================================================
  // PLATFORM SUBSCRIPTION PLANS
  // =============================================================================

  /**
   * Get platform subscription plans (what users pay to access the platform)
   */
  async getPlatformSubscriptionPlans(): Promise<PlatformSubscriptionPlan[]> {
    const cacheKey = 'platform_subscription_plans';
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Local override takes precedence (admin-edited pricing without server)
    const override = this.getOverridePlans();
    if (override) {
      this.setCache(cacheKey, override);
      return override;
    }

    try {
      const response = await fetch('/api/platform/subscription-plans');
      if (response.ok) {
        const data = await response.json();
        const plans = Array.isArray(data?.plans)
          ? data.plans.map((plan: unknown) => this.normalizePlatformSubscriptionPlan(plan))
          : this.getFallbackPlatformPlans();
        this.setCache(cacheKey, plans);
        return plans;
      }
    } catch (error) {
      console.warn('Failed to fetch platform subscription plans: ', error);
    }

    // Fallback to hardcoded platform plans
    const fallbackPlans = this.getFallbackPlatformPlans();
    this.setCache(cacheKey, fallbackPlans);
    return fallbackPlans;
  }

  /**
   * Read locally overridden plans (if any)
   */
  public getOverridePlans(): PlatformSubscriptionPlan[] | null {
    try {
      const raw = localStorage.getItem(this.OVERRIDE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      // Coerce date fields
      return parsed.map((p) => this.normalizePlatformSubscriptionPlan(p));
    } catch {
      return null;
    }
  }

  /**
   * Persist locally overridden plans (admin edits)
   */
  public setOverridePlans(plans: PlatformSubscriptionPlan[]): void {
    const serializable = plans.map((p) => ({
      ...p,
      createdAt: new Date(p.createdAt).toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    localStorage.setItem(this.OVERRIDE_KEY, JSON.stringify(serializable));
    this.clearCache();
  }

  /**
   * Clear local overrides
   */
  public clearOverridePlans(): void {
    localStorage.removeItem(this.OVERRIDE_KEY);
    this.clearCache();
  }

  public getFallbackPlatformPlans(): PlatformSubscriptionPlan[] {
    return [
      {
        id: 'prototype',
        name: 'prototype',
        displayName: 'Prototype',
        description: 'Gratis testtilgang for prototyper, tidlig validering og enkel gjennomgang.',
        tier: 'prototype',
        price: 0,
        monthlyPrice: 0,
        yearlyPrice: 0,
        currency: 'NOK',
        billingCycle: 'monthly',
        publicPriceLabel: 'Gratis',
        ctaLabel: 'Velg Prototype',
        features: [
          'Prototype-tilgang',
          'Enkel prosjektgjennomgang',
          'Tilbakemeldinger og testflyt',
          'Begrenset lagring',
        ],
        limits: {
          maxUsers: 0,
          maxProjects: 3,
          maxClients: 5,
          maxStorageGB: 2,
          maxApiCalls: 500,
        },
        isActive: true,
        trialDays: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'basic',
        name: 'basic',
        displayName: 'Basic Creator',
        description: 'Essential tools for small creative businesses',
        tier: 'basic',
        price: 249,
        monthlyPrice: 249,
        yearlyPrice: 2490,
        yearlySavingsLabel: '2 måneder gratis',
        currency: 'NOK',
        billingCycle: 'monthly',
        features: [
          'Up to 25 projects','Up to 100 clients','Advanced CRM','Contract management','Basic invoicing','Priority email support','10GB storage',
        ],
        limits: {
          maxUsers: 2,
          maxProjects: 25,
          maxClients: 100,
          maxStorageGB: 10,
          maxApiCalls: 5000,
        },
        isActive: true,
        trialDays: 14,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'professional',
        name: 'professional',
        displayName: 'Professional Creator',
        description: 'Complete business management for professional creatives',
        tier: 'professional',
        price: 449,
        monthlyPrice: 449,
        yearlyPrice: 4490,
        yearlySavingsLabel: '2 måneder gratis',
        currency: 'NOK',
        billingCycle: 'monthly',
        features: [
          'Everything in Basic','Unlimited projects','Unlimited clients','Advanced invoicing & payments','Client galleries & portfolios','Advanced reporting & analytics','API access','Priority phone support','50GB storage',
        ],
        limits: {
          maxUsers: 5,
          maxProjects: -1,
          maxClients: -1,
          maxStorageGB: 50,
          maxApiCalls: 25000,
        },
        isActive: true,
        isPopular: true,
        trialDays: 14,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'premium',
        name: 'premium',
        displayName: 'Premium Studio',
        description: 'Advanced features for growing creative teams and studios',
        tier: 'premium',
        price: 1199,
        monthlyPrice: 1199,
        yearlyPrice: 11990,
        yearlySavingsLabel: '2 måneder gratis',
        currency: 'NOK',
        billingCycle: 'monthly',
        features: [
          'Everything in Professional','Shared team workspace','Advanced automation','Team features','Priority support','250GB storage',
        ],
        limits: {
          maxUsers: 15,
          maxProjects: -1,
          maxClients: -1,
          maxStorageGB: 250,
          maxApiCalls: 100000,
        },
        isActive: true,
        trialDays: 14,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'enterprise',
        name: 'enterprise',
        displayName: 'Enterprise',
        description: 'Full-scale solution for large creative organizations',
        tier: 'enterprise',
        price: 3990,
        monthlyPrice: 3990,
        yearlyPrice: 39900,
        currency: 'NOK',
        billingCycle: 'monthly',
        contactSalesOnly: true,
        publicPriceLabel: 'Kontakt salg',
        ctaLabel: 'Kontakt salg',
        features: [
          'Everything in Premium','White label','Custom integrations','Advanced security features','SLA guarantee','24/7 phone support', 'Custom training', 'Unlimited storage',
        ],
        limits: {
          maxUsers: -1,
          maxProjects: -1,
          maxClients: -1,
          maxStorageGB: -1,
          maxApiCalls: -1,
        },
        isActive: true,
        trialDays: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  private normalizePlatformSubscriptionPlan(plan: any): PlatformSubscriptionPlan {
    const monthlyPrice =
      typeof plan?.monthlyPrice === 'number'
        ? plan.monthlyPrice
        : typeof plan?.price === 'number'
          ? plan.price
          : 0;

    return {
      id: String(plan?.id || 'unknown'),
      name: String(plan?.name || plan?.displayName || 'unknown'),
      displayName: String(plan?.displayName || plan?.name || 'Unknown'),
      description: String(plan?.description || ''),
      tier: (plan?.tier || 'free') as PlatformTier,
      price: monthlyPrice,
      monthlyPrice,
      yearlyPrice: typeof plan?.yearlyPrice === 'number' ? plan.yearlyPrice : null,
      yearlySavingsLabel:
        typeof plan?.yearlySavingsLabel === 'string' ? plan.yearlySavingsLabel : null,
      currency: (plan?.currency || 'NOK') as Currency,
      billingCycle: plan?.billingCycle === 'yearly' ? 'yearly' : 'monthly',
      features: Array.isArray(plan?.features) ? plan.features : [],
      limits: {
        maxUsers: typeof plan?.limits?.maxUsers === 'number' ? plan.limits.maxUsers : -1,
        maxProjects: typeof plan?.limits?.maxProjects === 'number' ? plan.limits.maxProjects : -1,
        maxClients: typeof plan?.limits?.maxClients === 'number' ? plan.limits.maxClients : -1,
        maxStorageGB: typeof plan?.limits?.maxStorageGB === 'number' ? plan.limits.maxStorageGB : -1,
        maxApiCalls: typeof plan?.limits?.maxApiCalls === 'number' ? plan.limits.maxApiCalls : -1,
      },
      isActive: plan?.isActive !== false,
      isPopular: Boolean(plan?.isPopular),
      popular: Boolean(plan?.popular),
      isPublic: plan?.isPublic !== false,
      contactSalesOnly: Boolean(plan?.contactSalesOnly),
      publicPriceLabel:
        typeof plan?.publicPriceLabel === 'string' ? plan.publicPriceLabel : null,
      ctaLabel: typeof plan?.ctaLabel === 'string' ? plan.ctaLabel : null,
      trialDays: typeof plan?.trialDays === 'number' ? plan.trialDays : 0,
      stripePriceId:
        typeof plan?.stripePriceId === 'string' ? plan.stripePriceId : undefined,
      createdAt: new Date(plan?.createdAt || Date.now()),
      updatedAt: new Date(plan?.updatedAt || Date.now()),
    };
  }

  // =============================================================================
  // PLATFORM FEATURES
  // =============================================================================

  /**
   * Get platform features and their pricing
   */
  async getPlatformFeatures(): Promise<PlatformFeature[]> {
    const cacheKey = 'platform_features';
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch('/api/platform/features');
      if (response.ok) {
        const data = await response.json();
        const features = data.features || this.getFallbackPlatformFeatures();
        this.setCache(cacheKey, features);
        return features;
      }
    } catch (error) {
      console.warn('Failed to fetch platform features:', error);
    }

    // Fallback to hardcoded platform features
    const fallbackFeatures = this.getFallbackPlatformFeatures();
    this.setCache(cacheKey, fallbackFeatures);
    return fallbackFeatures;
  }

  public getFallbackPlatformFeatures(): PlatformFeature[] {
    return [
      {
        id: 'visual-editor',
        name: 'Visual Editor',
        description: 'Click-and-edit functionality on all pages',
        category: 'core',
        isIncluded: true,
      },
      {
        id: 'basic-crm',
        name: 'Basic CRM',
        description: 'Customer relationship management',
        category: 'core',
        isIncluded: true,
      },
      {
        id: 'project-management',
        name: 'Project Management',
        description: 'Organize and track your creative projects',
        category: 'core',
        isIncluded: true,
      },
      {
        id: 'google-drive-integration',
        name: 'Google Drive Integration',
        description: 'Seamless file management with Google Drive',
        category: 'core',
        isIncluded: true,
      },
      {
        id: 'advanced-crm',
        name: 'Advanced CRM',
        description: 'Customer analytics and advanced relationship management',
        category: 'professional',
        isIncluded: false,
        additionalCost: 99,
        currency: 'NOK',
      },
      {
        id: 'contract-management',
        name: 'Contract Management',
        description: 'Automated contract creation and management',
        category: 'professional',
        isIncluded: false,
        additionalCost: 149,
        currency: 'NOK',
      },
      {
        id: 'client-galleries',
        name: 'Client Galleries',
        description: 'Professional client galleries and portfolios',
        category: 'professional',
        isIncluded: false,
        additionalCost: 199,
        currency: 'NOK',
      },
      {
        id: 'ai-suggestions',
        name: 'AI-Powered Suggestions',
        description: 'Intelligent recommendations for your business',
        category: 'premium',
        isIncluded: false,
        additionalCost: 299,
        currency: 'NOK',
      },
      {
        id: 'advanced-automation',
        name: 'Advanced Automation',
        description: 'Workflow automation and smart triggers',
        category: 'premium',
        isIncluded: false,
        additionalCost: 399,
        currency: 'NOK',
      },
      {
        id: 'custom-branding',
        name: 'Custom Branding',
        description: 'White-label your client-facing interfaces',
        category: 'enterprise',
        isIncluded: false,
        additionalCost: 599,
        currency: 'NOK',
      },
      {
        id: 'api-access',
        name: 'API Access',
        description: 'Full API access for custom integrations',
        category: 'enterprise',
        isIncluded: false,
        additionalCost: 799,
        currency: 'NOK',
      },
    ];
  }

  // =============================================================================
  // PRICING CALCULATIONS
  // =============================================================================

  /**
   * Calculate yearly discount
   */
  calculateYearlyDiscount(monthlyPrice: number, yearlyPrice: number): number {
    const monthlyTotal = monthlyPrice * 12;
    const savings = monthlyTotal - yearlyPrice;
    return Math.round((savings / monthlyTotal) * 100);
  }

  /**
   * Get pricing for specific tier
   */
  async getPricingForTier(tier: PlatformTier): Promise<PlatformPricingTier | null> {
    const plans = await this.getPlatformSubscriptionPlans();
    const plan = plans.find(p => p.tier === tier);
    
    if (!plan) return null;

    return {
      tier: plan.tier,
      monthlyPrice: typeof plan.monthlyPrice === 'number' ? plan.monthlyPrice : plan.price,
      yearlyPrice:
        typeof plan.yearlyPrice === 'number' ? plan.yearlyPrice : Math.round(plan.price * 10),
      currency: plan.currency,
      features: plan.features,
      limits: plan.limits,
    };
  }

  /**
   * Compare plans
   */
  async comparePlans(): Promise<{
    plans: PlatformSubscriptionPlan[];
    comparison: {
      feature: string;
      tiers: Record<PlatformTier, boolean | string>;
    }[];
  }> {
    const plans = await this.getPlatformSubscriptionPlans();
    const features = await this.getPlatformFeatures();

    const comparison = features.map(feature => {
      const tiers: Record<PlatformTier, boolean | string> = {} as any;
      
      plans.forEach(plan => {
        if (feature.isIncluded) {
          tiers[plan.tier] = plan.features.includes(feature.name);
        } else {
          tiers[plan.tier] = plan.features.includes(feature.name) ? 'Included' : 
                            feature.additionalCost ? `${feature.additionalCost} NOK/month` : 'Not available';
        }
      });

      return {
        feature: feature.name,
        tiers,
      };
    });

    return { plans, comparison };
  }

  // =============================================================================
  // CACHE MANAGEMENT
  // =============================================================================

  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
}

  private setCache(key: string, value: any): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION);
}

  public clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
}

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Format platform pricing
   */
  formatPlatformPrice(amount: number, currency: Currency): string {
    switch (currency) {
      case 'NOK':
        return `${Math.round(amount)} NOK`;
      case 'SEK':
        return `${Math.round(amount)} SEK`;
      case 'DKK':
        return `${Math.round(amount)} DKK`;
      case'USD':
        return `$${amount.toFixed(2)}`;
      default:
        return `${Math.round(amount)} ${currency}`;
    }
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId: string): Promise<PlatformSubscriptionPlan | null> {
    const plans = await this.getPlatformSubscriptionPlans();
    return plans.find(plan => plan.id === planId) || null;
  }

  /**
   * Check if user can access feature
   */
  async canAccessFeature(userTier: PlatformTier, featureId: string): Promise<boolean> {
    const features = await this.getPlatformFeatures();
    const feature = features.find(f => f.id === featureId);
    
    if (!feature) return false;
    if (feature.isIncluded) return true;

    // Check if feature is available for user's tier
    const tierOrder = { free: 0, prototype: 0, basic: 1, professional: 2, premium: 3, enterprise: 4 };
    const featureTierOrder = { core: 0, professional: 1, premium: 2, enterprise: 3 };
    
    return tierOrder[userTier] >= featureTierOrder[feature.category];
  }
}

// Export singleton instance
export const platformPricingService = PlatformPricingService.getInstance();

// React hook for easy integration
export const usePlatformPricing = (options?: { enabled?: boolean }) => {
  const service = platformPricingService;
  const enabled = options?.enabled ?? true;

  // Platform subscription plans
  const { data: subscriptionPlans, isLoading: plansLoading } = useQuery({
    queryKey: ['platform_subscription_plans'],
    queryFn: () => service.getPlatformSubscriptionPlans(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled,
  });

  // Platform features
  const { data: features, isLoading: featuresLoading } = useQuery({
    queryKey: ['platform_features'],
    queryFn: () => service.getPlatformFeatures(),
    staleTime: 10 * 60 * 1000,
    enabled,
  });

  // Plan comparison
  const { data: comparison, isLoading: comparisonLoading } = useQuery({
    queryKey: ['platform_plan_comparison'],
    queryFn: () => service.comparePlans(),
    staleTime: 10 * 60 * 1000,
    enabled,
  });

  return {
    service,
    subscriptionPlans: subscriptionPlans || service.getFallbackPlatformPlans(),
    features: features || service.getFallbackPlatformFeatures(),
    comparison: comparison || { plans: [], comparison: [] },
    isLoading: plansLoading || featuresLoading || comparisonLoading,
    formatPrice: (amount: number, currency: Currency) => 
      service.formatPlatformPrice(amount, currency),
    getPlanById: (planId: string) => service.getPlanById(planId),
    canAccessFeature: (userTier: PlatformTier, featureId: string) => 
      service.canAccessFeature(userTier, featureId),
    calculateYearlyDiscount: (monthly: number, yearly: number) => 
      service.calculateYearlyDiscount(monthly, yearly),
  };
};

export default PlatformPricingService;


