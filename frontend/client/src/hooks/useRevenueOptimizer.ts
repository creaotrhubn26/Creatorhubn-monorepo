// Revenue Optimizer Hook
import { useState, useEffect } from 'react';
import {
  revenueOptimizer,
  MarketRate,
  PricingCalculation,
  PricingTier,
  ProfitAnalysis,
  RevenueForecast,
  UpsellingSuggestion,
} from'../utils/revenueOptimizer';

export const useRevenueOptimizer = () => {
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [upsellingSuggestions, setUpsellingSuggestions] = useState<UpsellingSuggestion[]>([]);
  const [marketRates, setMarketRates] = useState<MarketRate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
}, []);

  const loadData = async () => {
    setLoading(true);
    try {
      setPricingTiers(revenueOptimizer.getPricingTiers());
      setUpsellingSuggestions(revenueOptimizer.getUpsellingSuggestions());
      setMarketRates(revenueOptimizer.getMarketRates());
  } catch (error) {
      console.error('Error loading revenue data:', error);
  } finally {
      setLoading(false);
  }
};

  const calculatePricing = (projectData: {
    projectType: string;
    complexity: 'low' | 'medium' | 'high';
    duration: number;
    imageCount: number;
    location: string;
    equipment: string[];
    addOns: string[];
    clientTier?: string;
  }): PricingCalculation => {
    return revenueOptimizer.calculatePricing(projectData);
};

  const generateUpsellingSuggestions = (projectId: string, clientId: string, projectData: Record<string, unknown>): UpsellingSuggestion[] => {
    const suggestions = revenueOptimizer.generateUpsellingSuggestions(projectId, clientId, projectData);
    setUpsellingSuggestions(prev => [...prev, ...suggestions]);
    return suggestions;
};

  const generateRevenueForecast = (period: 'monthly' | 'quarterly' | 'yearly', historicalData: Array<{ revenue: number }>): RevenueForecast => {
    return revenueOptimizer.generateRevenueForecast(period, historicalData);
};

  const calculateProfitAnalysis = (period: string, data: Record<string, unknown>): ProfitAnalysis => {
    return revenueOptimizer.calculateProfitAnalysis(period, data);
};

  const getAnalytics = () => {
    return revenueOptimizer.getRevenueAnalytics();
};

  return {
    pricingTiers,
    upsellingSuggestions,
    marketRates,
    loading,
    calculatePricing,
    generateUpsellingSuggestions,
    generateRevenueForecast,
    calculateProfitAnalysis,
    getAnalytics,
    loadData
};
};



