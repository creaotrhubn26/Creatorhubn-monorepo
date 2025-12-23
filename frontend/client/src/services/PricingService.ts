// client/src/services/PricingService.ts
export interface PricingTier {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  features: string[];
  trialDays: number;
  popular?: boolean;
  color?: string;
  icon?: string;
}

export interface FeaturePricing {
  featureId: string;
  name: string;
  description: string;
  pricing: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  trialDays: number;
  category: string;
  icon?: string;
  color?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  features: string[];
  includedFeatures: string[];
  trialDays: number;
  popular?: boolean;
  color?: string;
  icon?: string;
}

export class PricingService {
  private static instance: PricingService;
  private pricingTiers: PricingTier[] = [];
  private featurePricing: Map<string, FeaturePricing> = new Map();
  private subscriptionPlans: SubscriptionPlan[] = [];

  static getInstance(): PricingService {
    if (!this.instance) {
      this.instance = new PricingService();
    }
    return this.instance;
  }

  // Initialize pricing data
  initializePricing() {
    this.initializeFeaturePricing();
    this.initializeSubscriptionPlans();
    this.initializePricingTiers();
  }

  private initializeFeaturePricing() {
    const features: FeaturePricing[] = [
      {
        featureId: 'note-editor',
        name: 'Avansert Notatredigerer',
        description: 'Kraftig notatredigerer med AI-assistanse og avanserte funksjoner',
        pricing: {
          monthly: 29,
          yearly: 290,
          currency: 'NOK'
        },
        trialDays: 7,
        category: 'editor',
        icon: 'edit',
        color: '#9C27B0'
      },
      {
        featureId: 'ai-analytics',
        name: 'AI Analytics Dashboard',
        description: 'Intelligent analyse av arbeidsdata med prediktive innsikter',
        pricing: {
          monthly: 49,
          yearly: 490,
          currency: 'NOK'
        },
        trialDays: 14,
        category: 'analytics',
        icon: 'analytics',
        color: '#2196F3'
      },
      {
        featureId: 'video-editor',
        name: 'Avansert Videoredigerer',
        description: 'Profesjonell videoredigering med AI-assistanse',
        pricing: {
          monthly: 79,
          yearly: 790,
          currency: 'NOK'
        },
        trialDays: 10,
        category: 'editor',
        icon: 'videocam',
        color: '#FF5722'
      },
      {
        featureId: 'smart-project-management',
        name: 'Smart Prosjektstyring',
        description: 'AI-drevet prosjektstyring med automatisk planlegging',
        pricing: {
          monthly: 59,
          yearly: 590,
          currency: 'NOK'
        },
        trialDays: 14,
        category: 'productivity',
        icon: 'folder',
        color: '#4CAF50'
      },
      {
        featureId: 'communication-hub',
        name: 'Kommunikasjonshub',
        description: 'Sentralisert kommunikasjon med klienter og AI-drevet kundeservice',
        pricing: {
          monthly: 39,
          yearly: 390,
          currency: 'NOK'
        },
        trialDays: 10,
        category: 'communication',
        icon: 'chat',
        color: '#F44336'
      },
      {
        featureId: 'ai-writing-assistant',
        name: 'AI Skriveassistent',
        description: 'Avansert AI-assistanse for skriving og innholdsgenerering',
        pricing: {
          monthly: 19,
          yearly: 190,
          currency: 'NOK'
        },
        trialDays: 7,
        category: 'ai',
        icon: 'auto_awesome',
        color: '#FF9800'
      }
    ];

    features.forEach(feature => {
      this.featurePricing.set(feature.featureId, feature);
    });
  }

  private initializeSubscriptionPlans() {
    this.subscriptionPlans = [
      {
        id: 'basic',
        name: 'Grunnleggende',
        description: 'Perfekt for små prosjekter og enkeltpersoner',
        price: {
          monthly: 99,
          yearly: 990,
          currency: 'NOK'
        },
        features: [
          'Grunnleggende notatredigerer','Basis analytics','E-post støtte','5GB lagring'
        ],
        includedFeatures: ['note-editor','ai-writing-assistant'],
        trialDays: 7,
        color: '#607D8B',
        icon: 'star'
      },
      {
        id: 'professional',
        name: 'Profesjonell',
        description: 'Ideal for profesjonelle og små team',
        price: {
          monthly: 199,
          yearly: 1990,
          currency: 'NOK'
        },
        features: [
          'Alle grunnleggende funksjoner','AI Analytics Dashboard','Smart Prosjektstyring','Kommunikasjonshub','50GB lagring','Prioritert støtte'
        ],
        includedFeatures: [
          'note-editor','ai-writing-assistant','ai-analytics','smart-project-management','communication-hub'
        ],
        trialDays: 14,
        popular: true,
        color: '#2196F3',
        icon: 'work'
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'For store team og avanserte behov',
        price: {
          monthly: 399,
          yearly: 3990,
          currency: 'NOK'
        },
        features: [
          'Alle profesjonelle funksjoner','Avansert Videoredigerer','Ubegrenset lagring','Dedikert kundesuksess manager','Tilpassede integrasjoner','SLA-garanti'
        ],
        includedFeatures: [
          'note-editor','ai-writing-assistant','ai-analytics','smart-project-management','communication-hub','video-editor'
        ],
        trialDays: 30,
        color: '#9C27B0',
        icon: 'business'
      }
    ];
  }

  private initializePricingTiers() {
    this.pricingTiers = [
      {
        id: 'individual',
        name: 'Individuell',
        description: 'For enkeltpersoner og freelancere',
        price: {
          monthly: 149,
          yearly: 1490,
          currency: 'NOK'
        },
        features: [
          'Tilgang til alle trial-funksjoner','Personlig dashboard','E-post støtte','10GB lagring'
        ],
        trialDays: 14,
        color: '#4CAF50',
        icon: 'person'
      },
      {
        id: 'team',
        name: 'Team',
        description: 'For små til mellomstore team',
        price: {
          monthly: 299,
          yearly: 2990,
          currency: 'NOK'
        },
        features: [
          'Alle individuell funksjoner','Team-samarbeid','Admin-kontroll','100GB lagring','Prioritert støtte'
        ],
        trialDays: 21,
        popular: true,
        color: '#2196F3',
        icon: 'group'
      },
      {
        id: 'organization',
        name: 'Organisasjon',
        description: 'For store organisasjoner',
        price: {
          monthly: 599,
          yearly: 5990,
          currency: 'NOK'
        },
        features: [
          'Alle team-funksjoner','Avanserte sikkerhetsfunksjoner','Dedikert kundesuksess','Ubegrenset lagring','Tilpassede integrasjoner'
        ],
        trialDays: 30,
        color: '#9C27B0',
        icon: 'business'
      }
    ];
  }

  // Get pricing for a specific feature
  getFeaturePricing(featureId: string): FeaturePricing | null {
    return this.featurePricing.get(featureId) || null;
  }

  // Get all feature pricing
  getAllFeaturePricing(): FeaturePricing[] {
    return Array.from(this.featurePricing.values());
  }

  // Get subscription plans
  getSubscriptionPlans(): SubscriptionPlan[] {
    return this.subscriptionPlans;
  }

  // Get pricing tiers
  getPricingTiers(): PricingTier[] {
    return this.pricingTiers;
  }

  // Calculate discount for yearly plans
  calculateYearlyDiscount(monthlyPrice: number, yearlyPrice: number): number {
    const monthlyTotal = monthlyPrice * 12;
    const discount = ((monthlyTotal - yearlyPrice) / monthlyTotal) * 100;
    return Math.round(discount);
  }

  // Get recommended plan based on selected features
  getRecommendedPlan(selectedFeatures: string[]): SubscriptionPlan | null {
    const plans = this.subscriptionPlans.sort((a, b) => a.price.monthly - b.price.monthly);
    
    for (const plan of plans) {
      const hasAllFeatures = selectedFeatures.every(feature => 
        plan.includedFeatures.includes(feature)
      );
      if (hasAllFeatures) {
        return plan;
      }
    }
    
    return plans[plans.length - 1]; // Return most expensive plan if no match
  }

  // Calculate total price for selected features
  calculateFeatureTotal(selectedFeatures: string[], billingCycle: 'monthly' | 'yearly'): number {
    let total = 0;
    selectedFeatures.forEach(featureId => {
      const pricing = this.getFeaturePricing(featureId);
      if (pricing) {
        total += billingCycle === 'monthly' ? pricing.pricing.monthly : pricing.pricing.yearly;
      }
    });
    return total;
  }

  // Format price for display
  formatPrice(amount: number, currency: string = 'NOK'): string {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Get savings amount for yearly billing
  getYearlySavings(monthlyPrice: number, yearlyPrice: number): number {
    return (monthlyPrice * 12) - yearlyPrice;
  }
}

export const pricingService = PricingService.getInstance();
