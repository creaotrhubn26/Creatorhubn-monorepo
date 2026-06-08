/**
 * React Hooks for Audio Settings Persistence
 * Manages user presets, mixer settings, and waveform cache
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface DuckingPreset {
  id?: number;
  name: string;
  description?: string;
  amount: number;
  attack: number;
  release: number;
  threshold: number;
  isDefault?: boolean;
}

interface EQPreset {
  id?: number;
  name: string;
  description?: string;
  lowGain: number;
  midGain: number;
  highGain: number;
  lowFreq?: number;
  midFreq?: number;
  highFreq?: number;
  isDefault?: boolean;
}

interface MixerSettings {
  id?: number;
  projectId?: number;
  trackId?: string;
  name: string;
  settings: any;
  isGlobal?: boolean;
}

interface WaveformCache {
  audioFileHash: string;
  audioUrl: string;
  sampleRate: number;
  durationSeconds: number;
  waveformData: number[];
  stereoData?: { left: number[]; right: number[] };
  spectrogramData?: number[][];
  peakLevel?: number;
  isPeaking?: boolean;
}

/**
 * Hook for managing ducking presets
 */
export function useDuckingPresets() {
  const queryClient = useQueryClient();

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ['ducking-presets'],
    queryFn: async () => {
      const data = await apiRequest('/api/audio-settings/ducking-presets') as { presets?: DuckingPreset[] };
      return data.presets || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (preset: DuckingPreset) => {
      return await apiRequest('/api/audio-settings/ducking-presets', {
        method: 'POST',
        body: JSON.stringify(preset),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ducking-presets'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/audio-settings/ducking-presets/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ducking-presets'] });
    }
  });

  return {
    presets,
    isLoading,
    savePreset: saveMutation.mutate,
    deletePreset: deleteMutation.mutate,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
}

/**
 * Hook for managing EQ presets
 */
export function useEQPresets() {
  const queryClient = useQueryClient();

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ['eq-presets'],
    queryFn: async () => {
      const data = await apiRequest('/api/audio-settings/eq-presets') as { presets?: EQPreset[] };
      return data.presets || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (preset: EQPreset) => {
      return await apiRequest('/api/audio-settings/eq-presets', {
        method: 'POST',
        body: JSON.stringify(preset),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eq-presets'] });
    }
  });

  return {
    presets,
    isLoading,
    savePreset: saveMutation.mutate,
    isSaving: saveMutation.isPending
  };
}

/**
 * Hook for managing mixer settings
 */
export function useMixerSettings(projectId?: number, trackId?: string) {
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['mixer-settings', projectId, trackId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId.toString());
      if (trackId) params.append('trackId', trackId);

      const data = await apiRequest(`/api/audio-settings/mixer-settings?${params}`) as
        { settings?: MixerSettings[] };
      return data.settings || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (mixerSettings: MixerSettings) => {
      return await apiRequest('/api/audio-settings/mixer-settings', {
        method: 'POST',
        body: JSON.stringify(mixerSettings),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mixer-settings'] });
    }
  });

  return {
    settings,
    isLoading,
    saveSettings: saveMutation.mutate,
    isSaving: saveMutation.isPending
  };
}

/**
 * Hook for waveform caching
 */
export function useWaveformCache() {
  const queryClient = useQueryClient();

  const getWaveform = useCallback(async (hash: string): Promise<WaveformCache | null> => {
    try {
      const data = await apiRequest(`/api/audio-settings/waveform-cache/${hash}`) as
        { waveform?: WaveformCache | null };
      return data.waveform || null;
    } catch (error) {
      console.error('Error fetching waveform cache: ', error);
      return null;
    }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (waveform: WaveformCache) => {
      return await apiRequest('/api/audio-settings/waveform-cache', {
        method: 'POST',
        body: JSON.stringify(waveform),
      });
    }
  });

  return {
    getWaveform,
    saveWaveform: saveMutation.mutate,
    isSaving: saveMutation.isPending
  };
}

/**
 * Hook for logging enhancement history
 */
export function useEnhancementHistory() {
  const logMutation = useMutation({
    mutationFn: async (data: {
      projectId?: number;
      originalFileUrl: string;
      enhancedFileUrl?: string;
      enhancementType: string;
      presetUsed?: string;
      settingsUsed?: any;
      metrics?: any;
      processingTimeSeconds?: number;
    }) => {
      return await apiRequest('/api/audio-settings/enhancement-history', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
  });

  return {
    logEnhancement: logMutation.mutate,
    isLogging: logMutation.isPending
  };
}


