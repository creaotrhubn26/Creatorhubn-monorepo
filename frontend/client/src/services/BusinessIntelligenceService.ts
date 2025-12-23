/**
 * Business Intelligence Service
 * Extends ExternalDataService to provide SWOT analysis, market intelligence,
 * and customer insights using SSB, Proff.no, and survey data
 */

import { apiRequest } from '@/lib/queryClient';
import { externalDataService } from './ExternalDataService';
import type {
  SSBEconomicIndicators,
  SSBPopulationData,
  ProffCompanyData,
  BRREGCompanyData,
  WeatherData
} from './ExternalDataService';

export interface SWOTItem {
  id: string;
  type: 'strength' | 'weakness' | 'opportunity' | 'threat';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  probability: number; // 0-100
  urgency: 'low' | 'medium' | 'high';
  status: 'identified' | 'analyzing' | 'in_progress' | 'resolved' | 'archived';
  category: string;
  tags: string[];
  relatedPersonas: string[];
  identifiedDate: string;
  targetDate?: string;
  resolvedDate?: string;
  confidence: number; // 0-100
}

export interface SWOTAnalysis {
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];
  recommendations: string[];
  scores: {
    brand: number;
    product: number;
    distribution: number;
    promotion: number;
    overall: number;
  };
  lastUpdated: string;
}

export interface CustomerPersona {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string;
  ageRange: string;
  location: string;
  income: string;
  goals: string[];
  painPoints: string[];
  motivations: string[];
  customerType: 'budget_conscious' | 'quality_focused' | 'time_sensitive' | 'luxury_seeker';
  budgetTier: 'economy' | 'standard' | 'premium' | 'luxury';
  marketSize: number;
  averageValue: number;
  conversionRate: number;
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  purpose: 'swot_analysis' | 'customer_satisfaction' | 'market_research' | 'product_feedback';
  questions: Array<{
    id: string;
    type: 'text' | 'rating' | 'multiple_choice' | 'checkbox' | 'scale';
    question: string;
    options?: string[];
    required: boolean;
  }>;
  status: 'draft' | 'active' | 'paused' | 'closed';
  responseCount: number;
  completionRate: number;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  answers: Record<string, any>;
  sentiment: 'positive' | 'neutral' | 'negative';
  keyInsights: string[];
  completedAt: string;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  type: 'email' | 'social_media' | 'content' | 'paid_ads' | 'seo' | 'referral';
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
  budget: number;
  roi: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface SWOTTrend {
  date: string;
  strengthScore: number;
  weaknessScore: number;
  opportunityScore: number;
  threatScore: number;
  opportunitiesConverted: number;
  weaknessesResolved: number;
}

class BusinessIntelligenceService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get SWOT analysis for user
   */
  async getSWOTAnalysis(userId: string, profession: string): Promise<SWOTAnalysis> {
    const cacheKey = `swot_${userId}_${profession}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiRequest(`/api/business/swot-analysis/${userId}/${profession}`);
      if (response.success && response.data) {
        this.setCachedData(cacheKey, response.data);
        return response.data;
      }
      throw new Error('Failed to fetch SWOT analysis');
    } catch (error) {
      console.warn('Failed to fetch SWOT analysis: ', error);
      return this.getFallbackSWOTAnalysis();
    }
  }

  /**
   * Get SWOT items with filtering
   */
  async getSWOTItems(params: {
    userId: string;
    profession: string;
    type?: 'strength' | 'weakness' | 'opportunity' | 'threat';
    status?: string;
    category?: string;
  }): Promise<SWOTItem[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params.type) queryParams.append('type', params.type);
      if (params.status) queryParams.append('status', params.status);
      if (params.category) queryParams.append('category', params.category);

      const url = `/api/business/swot-items/${params.userId}/${params.profession}?${queryParams.toString()}`;
      const response = await apiRequest(url);

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch SWOT items');
    } catch (error) {
      console.warn('Failed to fetch SWOT items:', error);
      return [];
    }
  }

  /**
   * Create or update SWOT item
   */
  async saveSWOTItem(userId: string, profession: string, item: Partial<SWOTItem>): Promise<SWOTItem> {
    try {
      const response = await apiRequest(`/api/business/swot-items`, {
        method: item.id ? 'PUT' : 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ ...item, userId, profession }),
      });

      if (response.success && response.data) {
        // Invalidate cache
        this.cache.delete(`swot_${userId}_${profession}`);
        return response.data;
      }
      throw new Error('Failed to save SWOT item');
    } catch (error) {
      console.error('Failed to save SWOT item:', error);
      throw error;
    }
  }

  /**
   * Delete SWOT item
   */
  async deleteSWOTItem(userId: string, profession: string, itemId: string): Promise<void> {
    try {
      await apiRequest(`/api/business/swot-items/${itemId}`, {
        method: 'DELETE',
      });
      // Invalidate cache
      this.cache.delete(`swot_${userId}_${profession}`);
    } catch (error) {
      console.error('Failed to delete SWOT item:', error);
      throw error;
    }
  }

  /**
   * Get SWOT trends over time
   */
  async getSWOTTrends(userId: string, profession: string, days: number = 30): Promise<SWOTTrend[]> {
    const cacheKey = `swot_trends_${userId}_${profession}_${days}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiRequest(`/api/business/swot-trends/${userId}/${profession}?days=${days}`);
      if (response.success && response.data) {
        this.setCachedData(cacheKey, response.data);
        return response.data;
      }
      throw new Error('Failed to fetch SWOT trends');
    } catch (error) {
      console.warn('Failed to fetch SWOT trends:', error);
      return this.getFallbackSWOTTrends(days);
    }
  }

  /**
   * Get customer personas
   */
  async getCustomerPersonas(userId: string, profession: string): Promise<CustomerPersona[]> {
    const cacheKey = `personas_${userId}_${profession}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiRequest(`/api/business/personas/${userId}/${profession}`);
      if (response.success && response.data) {
        this.setCachedData(cacheKey, response.data);
        return response.data;
      }
      throw new Error('Failed to fetch personas');
    } catch (error) {
      console.warn('Failed to fetch personas:', error);
      return this.getFallbackPersonas();
    }
  }

  /**
   * Create or update persona
   */
  async savePersona(userId: string, profession: string, persona: Partial<CustomerPersona>): Promise<CustomerPersona> {
    try {
      const response = await apiRequest(`/api/business/personas`, {
        method: persona.id ? 'PUT' : 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ ...persona, userId, profession }),
      });

      if (response.success && response.data) {
        this.cache.delete(`personas_${userId}_${profession}`);
        return response.data;
      }
      throw new Error('Failed to save persona');
    } catch (error) {
      console.error('Failed to save persona:', error);
      throw error;
    }
  }

  /**
   * Delete persona
   */
  async deletePersona(userId: string, profession: string, personaId: string): Promise<void> {
    try {
      await apiRequest(`/api/business/personas/${personaId}`, {
        method: 'DELETE',
      });
      // Invalidate cache
      this.cache.delete(`personas_${userId}_${profession}`);
    } catch (error) {
      console.error('Failed to delete persona:', error);
      throw error;
    }
  }

  /**
   * Get surveys
   */
  async getSurveys(userId: string, profession: string): Promise<Survey[]> {
    const cacheKey = `surveys_${userId}_${profession}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiRequest(`/api/business/surveys/${userId}/${profession}`);
      if (response.success && response.data) {
        this.setCachedData(cacheKey, response.data);
        return response.data;
      }
      throw new Error('Failed to fetch surveys');
    } catch (error) {
      console.warn('Failed to fetch surveys:', error);
      return [];
    }
  }

  /**
   * Create survey
   */
  async createSurvey(userId: string, profession: string, survey: Partial<Survey>): Promise<Survey> {
    try {
      const response = await apiRequest(`/api/business/surveys`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ ...survey, userId, profession }),
      });

      if (response.success && response.data) {
        this.cache.delete(`surveys_${userId}_${profession}`);
        return response.data;
      }
      throw new Error('Failed to create survey');
    } catch (error) {
      console.error('Failed to create survey:', error);
      throw error;
    }
  }

  /**
   * Submit survey response
   */
  async submitSurveyResponse(surveyId: string, answers: Record<string, any>, respondentInfo?: {
    email?: string;
    name?: string;
  }): Promise<SurveyResponse> {
    try {
      const response = await apiRequest(`/api/business/surveys/${surveyId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ answers, ...respondentInfo }),
      });

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to submit survey response');
    } catch (error) {
      console.error('Failed to submit survey response:', error);
      throw error;
    }
  }

  /**
   * Get survey responses
   */
  async getSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
    try {
      const response = await apiRequest(`/api/business/surveys/${surveyId}/responses`);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch survey responses');
    } catch (error) {
      console.warn('Failed to fetch survey responses:', error);
      return [];
    }
  }

  // Cache helpers
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Fallback data methods
  private getFallbackSWOTAnalysis(): SWOTAnalysis {
    return {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
      recommendations: [],
      scores: {
        brand: 50,
        product: 50,
        distribution: 50,
        promotion: 50,
        overall: 50,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  private getFallbackSWOTTrends(days: number): SWOTTrend[] {
    const trends: SWOTTrend[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      trends.push({
        date: date.toISOString().split('T')[0],
        strengthScore: 50 + Math.random() * 20,
        weaknessScore: 40 + Math.random() * 20,
        opportunityScore: 45 + Math.random() * 25,
        threatScore: 35 + Math.random() * 20,
        opportunitiesConverted: Math.floor(Math.random() * 3),
        weaknessesResolved: Math.floor(Math.random() * 2),
      });
    }

    return trends;
  }

  private getFallbackPersonas(): CustomerPersona[] {
    return [
      {
        id: '1',
        name: 'Budget-Conscious Couple',
        description: 'Young couples planning their wedding with a limited budget',
        ageRange: '25-30',
        location: 'Urban areas',
        income: 'Middle',
        goals: ['Beautiful memories', 'Stay within budget','Stress-free planning'],
        painPoints: ['Limited budget','Too many options','Fear of overspending'],
        motivations: ['Value for money','Quality within budget', 'Recommendations'],
        customerType: 'budget_conscious',
        budgetTier:'economy',
        marketSize: 5000,
        averageValue: 15000,
        conversionRate: 25,
      },
    ];
  }

  // ==================== EXTERNAL DATA INTEGRATION ====================

  /**
   * Get enriched market data from SSB (Statistics Norway)
   */
  async getMarketData(params?: { region?: string; period?: string }): Promise<SSBEconomicIndicators> {
    try {
      return await externalDataService.getSSBEconomicIndicators(params);
    } catch (error) {
      console.error('Failed to fetch market data:', error);
      throw error;
    }
  }

  /**
   * Get population data for market sizing
   */
  async getPopulationData(params?: { region?: string; year?: string }): Promise<SSBPopulationData> {
    try {
      return await externalDataService.getSSBPopulationData(params);
    } catch (error) {
      console.error('Failed to fetch population data:', error);
      throw error;
    }
  }

  /**
   * Get competitor company data from Proff.no
   */
  async getCompetitorData(organizationNumber: string): Promise<ProffCompanyData> {
    try {
      return await externalDataService.getProffCompanyData(organizationNumber);
    } catch (error) {
      console.error('Failed to fetch competitor data:', error);
      throw error;
    }
  }

  /**
   * Get company data from BRREG
   */
  async getCompanyData(organizationNumber: string): Promise<BRREGCompanyData> {
    try {
      return await externalDataService.getBRREGCompanyData(organizationNumber);
    } catch (error) {
      console.error('Failed to fetch company data:', error);
      throw error;
    }
  }

  /**
   * Get weather data for location-based insights
   */
  async getWeatherData(params: { location?: string; lat?: number; lon?: number }): Promise<WeatherData> {
    try {
      return await externalDataService.getCurrentWeather(params);
    } catch (error) {
      console.error('Failed to fetch weather data:', error);
      throw error;
    }
  }

  /**
   * Enrich SWOT analysis with external market data
   */
  async enrichSWOTWithMarketData(_userId: string, _profession: string): Promise<{
    marketData: SSBEconomicIndicators;
    populationData: SSBPopulationData;
    insights: string[];
  }> {
    try {
      const [marketData, populationData] = await Promise.all([
        this.getMarketData(),
        this.getPopulationData(),
      ]);

      const insights: string[] = [];

      // Generate insights based on market data
      if (marketData.indicators && marketData.indicators.length > 0) {
        marketData.indicators.forEach((indicator) => {
          if (indicator.value > 0) {
            insights.push(`${indicator.title}: ${indicator.value} ${indicator.unit} (${indicator.period})`);
          }
        });
      }

      // Generate insights based on population data
      if (populationData.data.growth > 0) {
        insights.push(`Population growth: ${populationData.data.growth}% in ${populationData.region}`);
      }

      return {
        marketData,
        populationData,
        insights,
      };
    } catch (error) {
      console.error('Failed to enrich SWOT with market data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const businessIntelligenceService = new BusinessIntelligenceService();
export default businessIntelligenceService;
