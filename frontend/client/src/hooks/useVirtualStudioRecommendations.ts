// @ts-nocheck
/**
 * React Hook: Virtual Studio ML Recommendations
 * 
 * Purpose: Fetch and use ML-powered virtual studio recommendations
 * Privacy: Only receives anonymized configuration suggestions
 * 
 * Features:
 * - Get recommendations for specific project types
 * - Track project configurations for ML learning
 * - Update project metrics (renders, completions)
 * - Get trending setups
 */

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

// ============================================================================
// Types
// ============================================================================

export interface VirtualStudioRecommendation {
  projectType: string;
  title: string;
  description: string;
  recommendationData: {
    cameras?: any[];
    lighting?: any[];
    objects?: any[];
    environment?: any;
    renderSettings?: any;
  };
  confidenceScore: number;
  basedOnProjectsCount: number;
  successRate: number;
  tags: string[];
  popularityScore?: number;
  isTrending?: boolean;
}

export interface RecommendationsResponse {
  projectType: string;
  recommendations: VirtualStudioRecommendation[];
  count: number;
}

export interface TrendingResponse {
  trending: VirtualStudioRecommendation[];
  count: number;
}

// ============================================================================
// Hook
// ============================================================================

export const useVirtualStudioRecommendations = (projectType?: string) => {
  const [recommendations, setRecommendations] = useState<VirtualStudioRecommendation[]>([]);
  const [trending, setTrending] = useState<VirtualStudioRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch recommendations for a specific project type
   */
  const fetchRecommendations = useCallback(async (type: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiRequest<RecommendationsResponse>(
        `/api/virtual-studio/recommendations/${type}`,
        { method: 'GET' }
      );
      
      setRecommendations(response.recommendations);
    } catch (err: any) {
      console.error('Failed to fetch recommendations: ', err);
      setError(err.message || 'Failed to fetch recommendations');
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch trending virtual studio setups
   */
  const fetchTrending = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiRequest<TrendingResponse>(
        '/api/virtual-studio/recommendations/trending',
        { method: 'GET' }
      );
      
      setTrending(response.trending);
    } catch (err: any) {
      console.error('Failed to fetch trending recommendations:', err);
      setError(err.message || 'Failed to fetch trending recommendations');
      setTrending([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Track a project's configuration for ML learning
   * Call this when user creates a new project
   */
  const trackConfiguration = useCallback(async (
    projectId: string,
    projectType: string,
    sceneData: any
  ) => {
    try {
      await apiRequest('/api/virtual-studio/track/configuration', {
        method: 'POST',
        body: JSON.stringify({ projectId, projectType, sceneData }),
      });
    } catch (err: any) {
      console.error('Failed to track configuration:', err);
      // Non-blocking - don't throw error
    }
  }, []);

  /**
   * Update project metrics
   * Call this when user performs actions (render, export, complete)
   */
  const updateMetrics = useCallback(async (
    projectId: string,
    metrics: {
      isCompleted?: boolean;
      renderCount?: number;
      exportCount?: number;
      timeToFirstRender?: number;
      totalEditTime?: number;
    }
  ) => {
    try {
      await apiRequest('/api/virtual-studio/track/metrics', {
        method:'POST',
        body: JSON.stringify({ projectId, ...metrics }),
      });
    } catch (err: any) {
      console.error('Failed to update metrics:', err);
      // Non-blocking - don't throw error
    }
  }, []);

  /**
   * Auto-fetch recommendations when projectType changes
   */
  useEffect(() => {
    if (projectType) {
      fetchRecommendations(projectType);
    }
  }, [projectType, fetchRecommendations]);

  return {
    recommendations,
    trending,
    isLoading,
    error,
    fetchRecommendations,
    fetchTrending,
    trackConfiguration,
    updateMetrics,
  };
};

