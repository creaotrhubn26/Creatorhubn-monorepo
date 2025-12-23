// Revenue Optimization Tools
// Pricing calculator, upselling suggestions, revenue forecasting, and profit analysis

export interface PricingTier {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  pricePerHour: number;
  pricePerImage: number;
  minimumPrice: number;
  maximumPrice: number;
  features: string[];
  targetMarket: 'budget' | 'standard' | 'premium' | 'luxury'
}

export interface PricingCalculation {
  projectType: string;
  complexity: 'low' | 'medium' | 'high';
  duration: number; // hours
  imageCount: number;
  location: string;
  equipment: string[];
  addOns: string[];
  basePrice: number;
  adjustments: Array<{
    factor: string;
    value: number;
    impact: number;
}>;
  finalPrice: number;
  profitMargin: number;
  recommendedPrice: number
}

export interface UpsellingSuggestion {
  id: string;
  projectId: string;
  clientId: string;
  type: 'service' | 'product' | 'upgrade' | 'package';
  title: string;
  description: string;
  currentValue: number;
  suggestedValue: number;
  potentialRevenue: number;
  confidence: number;
  reasoning: string[];
  priority: 'low' | 'medium' | 'high';
  validUntil: Date;
  createdAt: Date
}

export interface RevenueForecast {
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  projectedRevenue: number;
  confidence: number;
  factors: Array<{
    name: string;
    impact: number;
    description: string;
}>;
  scenarios: {
    optimistic: number;
    realistic: number;
    pessimistic: number;
};
  recommendations: string[]
}

export interface ProfitAnalysis {
  period: string;
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  breakdown: {
    byProjectType: Record<string, {
      revenue: number;
      costs: number;
      profit: number;
      margin: number;
}>;
    byClient: Record<string, {
      revenue: number;
      costs: number;
      profit: number;
      margin: number;
}>;
    byTimePeriod: Record<string, {
      revenue: number;
      costs: number;
      profit: number;
      margin: number;
}>;
};
  trends: {
    revenueGrowth: number;
    costGrowth: number;
    marginTrend: number;
};
}

export interface MarketRate {
  service: string;
  location: string;
  minRate: number;
  maxRate: number;
  averageRate: number;
  medianRate: number;
  lastUpdated: Date;
  source: string
}

export class RevenueOptimizer {
  private pricingTiers: PricingTier[] = [];
  private marketRates: MarketRate[] = [];
  private upsellingSuggestions: UpsellingSuggestion[] = [];
  private revenueForecasts: RevenueForecast[] = [];
  private profitAnalyses: ProfitAnalysis[] = [];

  constructor() {
    this.initializePricingTiers();
    this.initializeMarketRates();
}

  private initializePricingTiers(): void {
    this.pricingTiers = [
      {
        id: 'budget-photography',
        name: 'Budget Photography',
        description: 'Basic photography services for budget-conscious clients',
        basePrice: 50,
        pricePerHour:  75,
        pricePerImage:  5,
        minimumPrice: 30,
        maximumPrice: 100,
        features: ['Basic editing', 'Online gallery', 'Digital delivery'],
        targetMarket: 'budget'
  },
      {
        id: 'standard-photography',
        name: 'Standard Photography',
        description: 'Professional photography with standard services',
        basePrice: 120,
        pricePerHour: 10,
        pricePerImage:  8,
        minimumPrice: 80,
        maximumPrice: 250,
        features: ['Professional editing','Online gallery','Digital delivery','Print release'],
        targetMarket: 'standard'
  },
      {
        id: 'premium-photography',
        name: 'Premium Photography',
        description: 'High-end photography with premium services',
        basePrice: 250,
        pricePerHour: 20,
        pricePerImage:  12,
        minimumPrice: 200,
        maximumPrice: 500,
        features: ['Premium editing','Online gallery','Digital delivery','Print release','Album design'],
        targetMarket: 'premium'
  },
      {
        id: 'luxury-photography',
        name: 'Luxury Photography',
        description: 'Luxury photography with full-service experience',
        basePrice: 500,
        pricePerHour: 40,
        pricePerImage:  20,
        minimumPrice: 400,
        maximumPrice: 1000,
        features: ['Luxury editing','Online gallery','Digital delivery','Print release','Album design','Concierge service'],
        targetMarket: 'luxury'
  }
    ];
}

  private initializeMarketRates(): void {
    this.marketRates = [
      {
        service: 'wedding-photography',
        location: 'major-city',
        minRate: 200,
        maxRate: 800,
        averageRate: 450,
        medianRate: 400,
        lastUpdated: new Date(),
        source: 'industry-survey'
  },
      {
        service: 'portrait-photography',
        location: 'major-city',
        minRate: 30,
        maxRate: 120,
        averageRate: 60,
        medianRate: 60,
        lastUpdated: new Date(),
        source: 'industry-survey'
  },
      {
        service: 'event-photography',
        location: 'major-city',
        minRate: 50,
        maxRate: 200,
        averageRate: 100,
        medianRate: 90,
        lastUpdated: new Date(),
        source: 'industry-survey'
  }
    ];
}

  // Pricing Calculator
  calculatePricing(projectData: {
    projectType: string;
    complexity: 'low' | 'medium' | 'high';
    duration: number;
    imageCount: number;
    location: string;
    equipment: string[];
    addOns: string[];
    clientTier?: string;
}): PricingCalculation {
    const tier = this.pricingTiers.find(t => t.id === projectData.clientTier) || this.pricingTiers[1];
    
    let basePrice = tier.basePrice;
    const adjustments: Array<{ factor: string; value: number; impact: number }> = [];

    // Duration adjustment
    const durationPrice = projectData.duration * tier.pricePerHour;
    basePrice += durationPrice;
    adjustments.push({
      factor: 'Duration',
      value: projectData.duration,
      impact: durationPrice
});

    // Image count adjustment
    const imagePrice = projectData.imageCount * tier.pricePerImage;
    basePrice += imagePrice;
    adjustments.push({
      factor: 'Image Count',
      value: projectData.imageCount,
      impact: imagePrice
});

    // Complexity adjustment
    const complexityMultiplier = projectData.complexity === 'low' ? 0.8 : projectData.complexity === 'high' ? 1.5 : 1.0;
    const complexityAdjustment = basePrice * (complexityMultiplier - 1);
    basePrice *= complexityMultiplier;
    adjustments.push({
      factor: 'Complexity',
      value: complexityMultiplier,
      impact: complexityAdjustment
});

    // Location adjustment
    const locationMultiplier = projectData.location === 'major-city' ? 1.2 : 1.0;
    const locationAdjustment = basePrice * (locationMultiplier - 1);
    basePrice *= locationMultiplier;
    adjustments.push({
      factor: 'Location',
      value: locationMultiplier,
      impact: locationAdjustment
});

    // Equipment adjustment
    const equipmentCost = projectData.equipment.length * 50;
    basePrice += equipmentCost;
    adjustments.push({
      factor: 'Equipment',
      value: projectData.equipment.length,
      impact: equipmentCost
});

    // Add-ons
    const addOnCost = projectData.addOns.length * 100;
    basePrice += addOnCost;
    adjustments.push({
      factor: 'Add-ons',
      value: projectData.addOns.length,
      impact: addOnCost
});

    // Apply minimum/maximum constraints
    const finalPrice = Math.max(tier.minimumPrice, Math.min(tier.maximumPrice, basePrice));

    // Calculate profit margin (simplified)
    const estimatedCosts = finalPrice * 0.3; // Assume 30% costs
    const profitMargin = ((finalPrice - estimatedCosts) / finalPrice) * 100;

    // Get market rate for comparison
    const marketRate = this.marketRates.find(r => r.service === projectData.projectType && r.location === projectData.location);
    const recommendedPrice = marketRate ? Math.max(finalPrice, marketRate.averageRate * 0.9) : finalPrice;

    return {
      projectType: projectData.projectType,
      complexity: projectData.complexity,
      duration: projectData.duration,
      imageCount: projectData.imageCount,
      location: projectData.location,
      equipment: projectData.equipment,
      addOns: projectData.addOs,
      basePrice: tier.basePrice,
      adjustments,
      finalPrice,
      profitMargin,
      recommendedPrice
  };
}

  // Upselling Suggestions
  generateUpsellingSuggestions(projectId: string, clientId: string, projectData: any): UpsellingSuggestion[] {
    const suggestions: UpsellingSuggestion[] = [];

    // Album upgrade suggestion
    if (projectData.projectType === 'wedding' && !projectData.hasAlbum) {
      suggestions.push({
        id: `upsell-${Date.now()}-1`,
        projectId,
        clientId,
        type: 'product',
        title: 'Premium Wedding Album',
        description: 'Beautiful leather-bound album with 50+ photos',
        currentValue:  0,
        suggestedValue: 80,
        potentialRevenue: 80,
        confidence: 0.5,
        reasoning: [
          'Wedding clients typically purchase albums','High perceived value','One-time purchase opportunity'
        ],
        priority: 'high',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 100),
        createdAt: new Date()
  });
  }

    // Additional session suggestion
    if (projectData.projectType === 'portrait' && projectData.sessionCount === 1) {
      suggestions.push({
        id: `upsell-${Date.now()}-2`,
        projectId,
        clientId,
        type: 'service',
        title: 'Follow-up Portrait Session',
        description: 'Additional portrait session in 6 months',
        currentValue:  0,
        suggestedValue: 40,
        potentialRevenue: 40,
        confidence: 0.0,
        reasoning: [
          'Portrait clients often want seasonal updates','Builds long-term relationship','Recurring revenue opportunity'
        ],
        priority: 'medium',
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 100),
        createdAt: new Date()
  });
  }

    // Print package suggestion
    if (!projectData.hasPrints) {
      suggestions.push({
        id: `upsell-${Date.now()}-3`,
        projectId,
        clientId,
        type: 'package',
        title: 'Print Package',
        description: 'Professional prints in various sizes',
        currentValue:  0,
        suggestedValue: 30,
        potentialRevenue: 30,
        confidence: 0.0,
        reasoning: [
          'Many clients want physical prints','High margin product','Easy to deliver'
        ],
        priority: 'medium',
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 100),
        createdAt: new Date()
  });
  }

    this.upsellingSuggestions.push(...suggestions);
    return suggestions;
}

  getUpsellingSuggestions(filter?: {
    projectId?: string;
    clientId?: string;
    priority?: string;
}): UpsellingSuggestion[] {
    let filtered = this.upsellingSuggestions;

    if (filter?.projectId) {
      filtered = filtered.filter(s => s.projectId === filter.projectId);
  }

    if (filter?.clientId) {
      filtered = filtered.filter(s => s.clientId === filter.clientId);
  }

    if (filter?.priority) {
      filtered = filtered.filter(s => s.priority === filter.priority);
  }

    return filtered.filter(s => s.validUntil > new Date());
}

  // Revenue Forecasting
  generateRevenueForecast(period: 'monthly' | 'quarterly' | 'yearly', historicalData: any[]): RevenueForecast {
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);

    switch (period) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
}

    // Calculate average monthly revenue
    const monthlyRevenue = historicalData.reduce((sum, month) => sum + month.revenue, 0) / historicalData.length;
    
    // Calculate growth rate
    const recentMonths = historicalData.slice(-3);
    const growthRate = recentMonths.length > 1 ? 
      (recentMonths[recentMonths.length - 1].revenue - recentMonths[0].revenue) / recentMonths[0].revenue : 0;

    // Project revenue for the period
    const monthsInPeriod = period === 'monthly' ? 1 : period === 'quarterly' ? 3 : 12;
    const projectedRevenue = monthlyRevenue * monthsInPeriod * (1 + growthRate);

    const factors = [
      {
        name: 'Historical Growth',
        impact: growthRate * 10,
        description: `Based on ${historicalData.length} months of data`
    },
      {
        name: 'Seasonal Trends',
        impact:  10,
        description: 'Expected seasonal variations'
  },
      {
        name: 'Market Conditions',
        impact:  5,
        description: 'Current market demand'
  }
    ];

    const scenarios = {
      optimistic: projectedRevenue * 1.2,
      realistic: projectedRevenue,
      pessimistic: projectedRevenue * 0.8
};

    const recommendations = [
      'Focus on high-value clients',
      'Implement upselling strategies',
      'Optimize pricing for better margins',
      'Diversify service offerings'
    ];

    const forecast: RevenueForecast = {
      period,
      startDate,
      endDate,
      projectedRevenue,
      confidence: Math.min(1, 0.5 + (historicalData.length * 0.1)),
      factors,
      scenarios,
      recommendations
  };

    this.revenueForecasts.push(forecast);
    return forecast;
}

  // Profit Analysis
  calculateProfitAnalysis(period: string, data: any): ProfitAnalysis {
    const totalRevenue = data.revenue || 0;
    const totalCosts = data.costs || 0;
    const grossProfit = totalRevenue - totalCosts;
    const netProfit = grossProfit - (data.overhead || 0);
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const breakdown = {
      byProjectType: data.projectTypeBreakdown || {},
      byClient: data.clientBreakdown || {},
      byTimePeriod: data.timePeriodBreakdown || {}
  };

    const trends = {
      revenueGrowth: data.revenueGrowth || 0,
      costGrowth: data.costGrowth || 0,
      marginTrend: data.marginTrend || 0
};

    const analysis: ProfitAnalysis = {
      period,
      totalRevenue,
      totalCosts,
      grossProfit,
      netProfit,
      profitMargin,
      breakdown,
      trends
  };

    this.profitAnalyses.push(analysis);
    return analysis;
}

  // Market Rate Analysis
  getMarketRates(service?: string, location?: string): MarketRate[] {
    let filtered = this.marketRates;

    if (service) {
      filtered = filtered.filter(r => r.service === service);
  }

    if (location) {
      filtered = filtered.filter(r => r.location === location);
  }

    return filtered;
}

  updateMarketRate(service: string, location: string, newRate: Partial<MarketRate>): void {
    const index = this.marketRates.findIndex(r => r.service === service && r.location === location);
    if (index >= 0) {
      this.marketRates[index] = { ...this.marketRates[index], ...newRate, lastUpdated: new Date(),};
  } else {
      this.marketRates.push({
        service,
        location,
        minRate: newRate.minRate || 0,
        maxRate: newRate.maxRate || 0,
        averageRate: newRate.averageRate || 0,
        medianRate: newRate.medianRate || 0,
        lastUpdated: new Date(),
        source: newRate.source ||'manual-update'
  });
  }
}

  // Analytics
  getRevenueAnalytics(): Record<string, any> {
    const totalUpsellingRevenue = this.upsellingSuggestions
      .filter(s => s.validUntil > new Date())
      .reduce((sum, s) => sum + s.potentialRevenue, 0);

    const averageProfitMargin = this.profitAnalyses.length > 0 ?
      this.profitAnalyses.reduce((sum, a) => sum + a.profitMargin, 0) / this.profitAnalyses.length : 0;

    return {
      totalUpsellingRevenue,
      averageProfitMargin,
      activeSuggestions: this.upsellingSuggestions.filter(s => s.validUntil > new Date()).length,
      pricingTiers: this.pricingTiers.length,
      marketRates: this.marketRates.length,
      revenueForecasts: this.revenueForecasts.length,
      profitAnalyses: this.profitAnalyses.length
};
}
}

export const revenueOptimizer = new RevenueOptimizer();




