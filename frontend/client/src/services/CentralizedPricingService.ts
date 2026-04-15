// @ts-nocheck
/**
 * CreatorHub Norge - Client Service Pricing Service
 * Handles pricing for client services (photography, videography, music production, etc.)
 * This is separate from platform subscription pricing - this is what admins set for their services
 * Connects to the price administration system with comprehensive fallbacks
 */

import { useQuery } from '@tanstack/react-query';

// Currency types
export type Currency = 'NOK' | 'SEK' | 'DKK' | 'USD';
export type PricingTier = 'budget' | 'mid' | 'premium' | 'professional';
export type SubscriptionTier = 'basic' | 'professional' | 'premium' | 'enterprise';

// Pricing interfaces
export interface CurrencyRates {
  NOK_TO_NOK: number;
  NOK_TO_SEK: number;
  NOK_TO_DKK: number;
  NOK_TO_USD: number;
  SEK_TO_NOK: number;
  DKK_TO_NOK: number;
  USD_TO_NOK: number;
  SEK_TO_DKK: number;
  DKK_TO_SEK: number;
  SEK_TO_USD: number;
  DKK_TO_USD: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: Currency;
  interval: 'monthly' | 'yearly';
  features: string[];
  isActive: boolean;
  maxUsers?: number;
  maxProjects?: number;
  maxClients?: number;
  trialDays?: number;
  popular?: boolean;
}

export interface FeaturePricing {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  pricingTier: SubscriptionTier;
  isPaywalled: boolean;
}

export interface ShowcasePricing {
  perImage: number;
  contractedBase: number;
  packages: Array<{
    id: string;
    images: number;
    price: number;
    savings: number;
}>;
  bulkDiscounts: Array<{
    minImages: number;
    discount: number;
}>;
}

export interface MemoryCardPricing {
  priceOrder: Record<PricingTier, number>;
  currencyRates: CurrencyRates;
}

export interface DefaultRates {
  hourlyRate: number;
  halfDayRate: number;
  fullDayRate: number;
  packageRate: number;
  unitRate: number;
  licenseRate: number;
}

class ClientServicePricingService {
  private static instance: ClientServicePricingService;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): ClientServicePricingService {
    if (!ClientServicePricingService.instance) {
      ClientServicePricingService.instance = new ClientServicePricingService();
  }
    return ClientServicePricingService.instance;
}

  // =============================================================================
  // CURRENCY CONVERSION
  // =============================================================================

  /**
   * Get currency conversion rates from price administration system
   */
  async getCurrencyRates(): Promise<CurrencyRates> {
    const cacheKey = 'currency_rates';
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
  }

    try {
      // Try to get from price administration system
      const response = await fetch('/api/price-administration/currency-rates');
      if (response.ok) {
        const data = await response.json();
        const rates = data.rates || this.getFallbackCurrencyRates();
        this.setCache(cacheKey, rates);
        return rates;
    }
  } catch (error) {
      console.warn('Failed to fetch currency rates from price administration system: ', error);
  }

    // Fallback to hardcoded rates
    const fallbackRates = this.getFallbackCurrencyRates();
    this.setCache(cacheKey, fallbackRates);
    return fallbackRates;
}

  private getFallbackCurrencyRates(): CurrencyRates {
    return {
      NOK_TO_NOK: 1.0,
      NOK_TO_SEK: 1.05,
      NOK_TO_DKK: 0.75,
      NOK_TO_USD: 0.095,
      SEK_TO_NOK: 0.95,
      DKK_TO_NOK: 1.33,
      USD_TO_NOK: 10.5,
      SEK_TO_DKK: 0.71,
      DKK_TO_SEK: 1.40,
      SEK_TO_USD: 0.090,
      DKK_TO_USD: 0.127,
  };
}

  /**
   * Convert currency amount
   */
  async convertCurrency(amount: number, from: Currency, to: Currency): Promise<number> {
    if (from === to) return amount;
    
    const rates = await this.getCurrencyRates();
    
    // Convert to NOK first
    let amountInNOK = amount;
    switch (from) {
      case 'NOK': amountInNOK = amount; break;
      case 'SEK': amountInNOK = amount * rates.SEK_TO_NOK; break;
      case 'DKK': amountInNOK = amount * rates.DKK_TO_NOK; break;
      case 'USD': amountInNOK = amount * rates.USD_TO_NOK; break;
  }
    
    // Convert from NOK to target currency
    switch (to) {
      case 'NOK': return Math.round(amountInNOK * 100) / 100;
      case 'SEK': return Math.round(amountInNOK * rates.NOK_TO_SEK * 100) / 100;
      case 'DKK': return Math.round(amountInNOK * rates.NOK_TO_DKK * 100) / 100;
      case 'USD': return Math.round(amountInNOK * rates.NOK_TO_USD * 100) / 100;
      default: return amountInNOK;
  }
}

  // =============================================================================
  // SUBSCRIPTION PLANS
  // =============================================================================

  /**
   * Get subscription plans from price administration system
   */
  async getSubscriptionPlans(profession?: string): Promise<SubscriptionPlan[]> {
    const cacheKey = `subscription_plans_${profession || 'all'}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
  }

    try {
      const url = profession 
        ? `/api/price-administration/subscription-plans?profession=${profession}`
        : '/api/price-administration/subscription-plans';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const plans = data.plans || this.getFallbackSubscriptionPlans();
        this.setCache(cacheKey, plans);
        return plans;
    }
  } catch (error) {
      console.warn('Failed to fetch subscription plans from price administration system:', error);
  }

    // Fallback to hardcoded plans
    const fallbackPlans = this.getFallbackSubscriptionPlans();
    this.setCache(cacheKey, fallbackPlans);
    return fallbackPlans;
}

  private getFallbackSubscriptionPlans(): SubscriptionPlan[] {
    return [
      {
        id: 'basic',
        name: 'Basic Creator',
        price: 0,
        currency: 'NOK',
        interval: 'monthly',
        features: [
          'Grunnleggende CRM', 'Enkel kontrakthåndtering','Basis fakturering','Opptil 5 prosjekter','Opptil 10 kunder','Google Workspace integrasjon',
        ],
        isActive: true,
        maxUsers: 1,
        maxProjects: 5,
        maxClients: 10,
        trialDays: 0,
    },
      {
        id: 'professional',
        name: 'Professional Creator',
        price: 299,
        currency: 'NOK',
        interval: 'monthly',
        features: [
          'Avansert CRM med kundeanalyse','Automatisert kontrakthåndtering','AI-drevet fakturering og påminnelser','Opptil 50 prosjekter','Opptil 200 kunder','Premium støtte','Alle integrasjoner','Avansert rapportering','Kundegalleri og portefølje',
        ],
        isActive: true,
        maxUsers: 3,
        maxProjects: 50,
        maxClients: 200,
        trialDays: 14,
        popular: true,
    },
      {
        id: 'premium',
        name: 'Premium Creator',
        price: 599,
        currency: 'NOK',
        interval: 'monthly',
        features: [
          'Alt i Professional','Visual Editor','Intelligente forslag','Avansert prisberegning','Unlimited prosjekter','Unlimited kunder','Priority support',
        ],
        isActive: true,
        maxUsers: 5,
        maxProjects: -1,
        maxClients: -1,
        trialDays: 14,
    },
      {
        id: 'enterprise',
        name: 'Enterprise Creator',
        price: 999,
        currency: 'NOK',
        interval: 'monthly',
        features: [
          'Alt i Premium','Avansert video-redigering','Musikk-produksjon','Unlimited storage', 'Custom integrations', 'Dedicated support',
        ],
        isActive: true,
        maxUsers: -1,
        maxProjects: -1,
        maxClients: -1,
        trialDays: 30,
    },
    ];
}

  // =============================================================================
  // FEATURE PRICING
  // =============================================================================

  /**
   * Get feature pricing from price administration system
   */
  async getFeaturePricing(): Promise<FeaturePricing[]> {
    const cacheKey = 'feature_pricing';
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
  }

    try {
      const response = await fetch('/api/price-administration/feature-pricing');
      if (response.ok) {
        const data = await response.json();
        const features = data.features || this.getFallbackFeaturePricing();
        this.setCache(cacheKey, features);
        return features;
    }
  } catch (error) {
      console.warn('Failed to fetch feature pricing from price administration system:', error);
  }

    // Fallback to hardcoded feature pricing
    const fallbackFeatures = this.getFallbackFeaturePricing();
    this.setCache(cacheKey, fallbackFeatures);
    return fallbackFeatures;
}

  private getFallbackFeaturePricing(): FeaturePricing[] {
    return [
      {
        id: 'pricing-calculator',
        name: 'Intelligent Prisberegning',
        monthlyPrice: 299,
        yearlyPrice: 2990,
        pricingTier: 'premium',
        isPaywalled: true,
    },
      {
        id: 'feature-flags',
        name: 'Feature Management',
        monthlyPrice: 199,
        yearlyPrice: 1990,
        pricingTier: 'professional',
        isPaywalled: true,
    },
      {
        id: 'visual-editor',
        name: 'Visual Editor',
        monthlyPrice: 0,
        yearlyPrice: 0,
        pricingTier: 'basic',
        isPaywalled: false,
    },
      {
        id: 'ai-suggestions',
        name: 'Smarte Forslag',
        monthlyPrice: 399,
        yearlyPrice: 3990,
        pricingTier: 'premium',
        isPaywalled: true,
    },
    ];
}

  // =============================================================================
  // SHOWCASE PRICING
  // =============================================================================

  /**
   * Get showcase pricing for profession
   */
  async getShowcasePricing(profession: string): Promise<ShowcasePricing> {
    const cacheKey = `showcase_pricing_${profession}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
  }

    try {
      const response = await fetch(`/api/showcase/pricing?profession=${profession}`);
      if (response.ok) {
        const data = await response.json();
        const pricing = data.pricing || this.getFallbackShowcasePricing(profession);
        this.setCache(cacheKey, pricing);
        return pricing;
    }
  } catch (error) {
      console.warn('Failed to fetch showcase pricing from price administration system:', error);
  }

    // Fallback to hardcoded showcase pricing
    const fallbackPricing = this.getFallbackShowcasePricing(profession);
    this.setCache(cacheKey, fallbackPricing);
    return fallbackPricing;
}

  private getFallbackShowcasePricing(profession: string): ShowcasePricing {
    const professionPricing = {
      photographer: {
        perImage: 150,
        contractedBase: 50,
        packages: [
          { id: 'wedding_basic', images: 50, price: 6000, savings: 1500 },
          { id: 'wedding_premium', images: 100, price: 10000, savings: 5000 },
          { id: 'wedding_unlimited', images: 300, price: 25000, savings: 20000 },
        ],
        bulkDiscounts: [
          { minImages: 20, discount: 0.1 },
          { minImages: 50, discount: 0.15 },
          { minImages: 100, discount: 0.2 },
        ],
    },
      videographer: {
        perImage: 100,
        contractedBase: 50,
        packages: [
          { id: 'video_highlight', images: 50, price: 2000, savings: 0 },
          { id: 'video_full', images: 100, price: 8000, savings: 2000 },
          { id: 'video_complete', images: 200, price: 12000, savings: 4000 },
        ],
        bulkDiscounts: [
          { minImages: 20, discount: 0.1 },
          { minImages: 50, discount: 0.15 },
          { minImages: 100, discount: 0.2 },
        ],
    },
      music_producer: {
        perImage: 800,
        contractedBase: 10,
        packages: [
          { id: 'single_master', images: 10, price: 2500, savings: 500 },
          { id: 'ep_package', images: 50, price: 8000, savings: 2000 },
          { id: 'album_complete', images: 120, price: 15000, savings: 5000 },
        ],
        bulkDiscounts: [
          { minImages: 5, discount: 0.1 },
          { minImages: 10, discount: 0.15 },
          { minImages: 20, discount: 0.2 },
        ],
    },
  };

    return professionPricing[profession as keyof typeof professionPricing] || professionPricing.photographer;
}

  // =============================================================================
  // MEMORY CARD PRICING
  // =============================================================================

  /**
   * Get memory card pricing configuration
   */
  async getMemoryCardPricing(): Promise<MemoryCardPricing> {
    const cacheKey = 'memory_card_pricing';
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
  }

    const currencyRates = await this.getCurrencyRates();
    const pricing: MemoryCardPricing = {
      priceOrder: { budget: 0, mid: 1, premium: 2, professional: 3 },
      currencyRates,
  };

    this.setCache(cacheKey, pricing);
    return pricing;
}

  // =============================================================================
  // DEFAULT RATES
  // =============================================================================

  /**
   * Get default rates for pricing modals
   */
  async getDefaultRates(profession: string): Promise<DefaultRates> {
    const cacheKey = `default_rates_${profession}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
  }

    try {
      const response = await fetch(`/api/price-administration/default-rates?profession=${profession}`);
      if (response.ok) {
        const data = await response.json();
        const rates = data.rates || this.getFallbackDefaultRates(profession);
        this.setCache(cacheKey, rates);
        return rates;
    }
  } catch (error) {
      console.warn('Failed to fetch default rates from price administration system:', error);
  }

    // Fallback to hardcoded default rates
    const fallbackRates = this.getFallbackDefaultRates(profession);
    this.setCache(cacheKey, fallbackRates);
    return fallbackRates;
}

  private getFallbackDefaultRates(profession: string): DefaultRates {
    const professionRates = {
      photographer: {
        hourlyRate: 1200,
        halfDayRate: 4000,
        fullDayRate: 7000,
        packageRate: 5000,
        unitRate: 150,
        licenseRate: 500,
    },
      videographer: {
        hourlyRate: 1300,
        halfDayRate: 4500,
        fullDayRate: 8000,
        packageRate: 6000,
        unitRate: 100,
        licenseRate: 800,
    },
      music_producer: {
        hourlyRate: 1500,
        halfDayRate: 5000,
        fullDayRate: 9000,
        packageRate: 8000,
        unitRate: 800,
        licenseRate: 1200,
    },
      vendor: {
        hourlyRate: 1000,
        halfDayRate: 3500,
        fullDayRate: 6000,
        packageRate: 4000,
        unitRate: 200,
        licenseRate: 400,
    },
  };

    return professionRates[profession as keyof typeof professionRates] || professionRates.photographer;
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
   * Format currency amount
   */
  formatCurrency(amount: number, currency: Currency): string {
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
   * Calculate MVA (Norwegian VAT)
   */
  calculateMVA(amount: number, vatRate: number = 0.25): number {
    return Math.round(amount * vatRate);
}

  /**
   * Get total with MVA
   */
  getTotalWithMVA(amount: number, vatRate: number = 0.25): number {
    return Math.round(amount * (1 + vatRate));
}
}

// Export singleton instance
export const clientServicePricingService = ClientServicePricingService.getInstance();

// React hook for easy integration
export const useClientServicePricing = () => {
  const service = clientServicePricingService;

  // Currency rates
  const { data: currencyRates } = useQuery({
    queryKey: ['currency_rates'],
    queryFn: () => service.getCurrencyRates(),
    staleTime: 5 * 60 * 1000, // 5 minutes
});

  // Subscription plans
  const { data: subscriptionPlans } = useQuery({
    queryKey: ['subscription_plans'],
    queryFn: () => service.getSubscriptionPlans(),
    staleTime: 5 * 60 * 1000,
});

  // Feature pricing
  const { data: featurePricing } = useQuery({
    queryKey: ['feature_pricing'],
    queryFn: () => service.getFeaturePricing(),
    staleTime: 5 * 60 * 1000,
});

  return {
    service,
    currencyRates: currencyRates || service.getFallbackCurrencyRates(),
    subscriptionPlans: subscriptionPlans || service.getFallbackSubscriptionPlans(),
    featurePricing: featurePricing || service.getFallbackFeaturePricing(),
    convertCurrency: (amount: number, from: Currency, to: Currency) => 
      service.convertCurrency(amount, from, to),
    formatCurrency: (amount: number, currency: Currency) => 
      service.formatCurrency(amount, currency),
    calculateMVA: (amount: number, vatRate?: number) => 
      service.calculateMVA(amount, vatRate),
    getTotalWithMVA: (amount: number, vatRate?: number) => 
      service.getTotalWithMVA(amount, vatRate),
};
};

export default ClientServicePricingService;
