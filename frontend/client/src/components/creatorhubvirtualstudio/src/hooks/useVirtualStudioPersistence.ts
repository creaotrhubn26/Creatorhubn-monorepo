/**
 * Virtual Studio Persistence Hooks
 * 
 * React hooks for saving/loading Virtual Studio data to/from backend
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../core/services/logger';

const log = logger.module('Persistence');
import type { Scene } from '../core/models/scene';
import type { ACESConfig } from '../core/services/acesService';
import type { ASCCDLParams } from '../core/services/ascCDLService';
import type { SpectralCRIMetrics } from '../core/services/spectralCRIService';

type ASCCDLConfig = ASCCDLParams;

interface GIConfig {
  enabled?: boolean;
  bounceCount?: number;
  sampleCount?: number;
  intensity?: number;
}

// ============================================================================
// Types
// ============================================================================

export interface LightingConfig {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  lightingSetup: any; // Complete lighting configuration
  patternSlug?: string;
  qualityScore?: number;
  criScore?: number;
  tlciScore?: number;
  keyFillRatio?: number;
  userRating?: number;
  userNotes?: string;
  isFavorite?: boolean;
  thumbnailUrl?: string;
  tags?: string[];
  isPublic?: boolean;
  isTemplate?: boolean;
}

export interface UserPreferences {
  enableAiRecommendations?: boolean;
  aiSuggestionFrequency?: 'aggressive' | 'moderate' | 'minimal';
  autoApplySuggestions?: boolean;
  defaultView?: '2d' | '3d' | 'split';
  showLightCones?: boolean;
  showPatternVisualization?: boolean;
  showQualityMetrics?: boolean;
  defaultRenderQuality?: 'preview' | 'medium' | 'high' | 'ultra';
  enableGlobalIllumination?: boolean;
  enableAces?: boolean;
  enableAscCdl?: boolean;
  autoSaveEnabled?: boolean;
  autoSaveIntervalSeconds?: number;
}

export interface AITrainingData {
  sceneContext: any;
  currentLighting: any;
  recommendedChanges: any;
  patternSuggestion?: string;
  userAccepted?: boolean;
  userRating?: number;
  userFeedback?: string;
  finalLighting?: any;
  qualityBefore?: number;
  qualityAfter?: number;
  improvementScore?: number;
  modelVersion?: string;
  confidenceScore?: number;
}

// ============================================================================
// Lighting Configurations Hook
// ============================================================================

export function useLightingConfigs() {
  const [configs, setConfigs] = useState<LightingConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/virtual-studio/lighting-configs', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch lighting configurations');
      const data = await response.json();
      setConfigs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (config: LightingConfig) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/virtual-studio/lighting-configs', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Failed to save lighting configuration');
      const newConfig = await response.json();
      setConfigs((prev) => [newConfig, ...prev]);
      return newConfig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (id: string, updates: Partial<LightingConfig>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/virtual-studio/lighting-configs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update lighting configuration');
      const updatedConfig = await response.json();
      setConfigs((prev) => prev.map((c) => (c.id === id ? updatedConfig : c)));
      return updatedConfig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteConfig = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/virtual-studio/lighting-configs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete lighting configuration');
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return {
    configs,
    loading,
    error,
    saveConfig,
    updateConfig,
    deleteConfig,
    refetch: fetchConfigs,
  };
}

// ============================================================================
// User Preferences Hook
// ============================================================================

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/virtual-studio/preferences', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch user preferences');
      const data = await response.json();
      setPreferences(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/virtual-studio/preferences', {
        method: 'PUT',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update user preferences');
      const updatedPreferences = await response.json();
      setPreferences(updatedPreferences);
      return updatedPreferences;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    refetch: fetchPreferences,
  };
}

// ============================================================================
// AI Training Data Hook
// ============================================================================

export function useAITrainingData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collectTrainingData = useCallback(async (data: AITrainingData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/virtual-studio/ai-training-data', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to collect AI training data');
      const result = await response.json();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    collectTrainingData,
  };
}

// ============================================================================
// Auto-Save Hook
// ============================================================================

export function useAutoSave(
  scene: Scene,
  config: {
    acesConfig?: ACESConfig;
    ascCDLConfig?: ASCCDLConfig;
    giConfig?: GIConfig;
    spectralMetrics?: SpectralCRIMetrics;
  },
  options: {
    enabled?: boolean;
    intervalSeconds?: number;
  } = {}
) {
  const { enabled = true, intervalSeconds = 60 } = options;
  const lastSaveRef = useRef<string>(', ');
  const timeoutRef = useRef<NodeJS.Timeout>();

  const save = useCallback(async () => {
    const currentState = JSON.stringify({ scene, config });

    // Skip if nothing changed
    if (currentState === lastSaveRef.current) {
      return;
    }

    try {
      // Save to localStorage first (fast)
      localStorage.setItem('virtual-studio-autosave', currentState);

      // Then save to backend (slower, but persistent)
      await fetch('/api/virtual-studio/autosave', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: currentState,
      });

      lastSaveRef.current = currentState;
    } catch (err) {
      log.error('Auto-save failed:', err);
    }
  }, [scene, config]);

  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule next save
    timeoutRef.current = setTimeout(save, intervalSeconds * 1000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, intervalSeconds, save]);

  return { save };
}
