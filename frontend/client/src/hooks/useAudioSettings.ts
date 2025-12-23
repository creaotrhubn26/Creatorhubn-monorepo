/**
 * React Hooks for Audio Settings Persistence
 * Manages user presets, mixer settings, and waveform cache
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
      const response = await fetch('/api/audio-settings/ducking-presets', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch ducking presets');
      const data = await response.json();
      return data.presets || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (preset: DuckingPreset) => {
      const response = await fetch('/api/audio-settings/ducking-presets', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preset)
      });
      if (!response.ok) throw new Error('Failed to save ducking preset');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ducking-presets'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/audio-settings/ducking-presets/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete ducking preset');
      return response.json();
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
      const response = await fetch('/api/audio-settings/eq-presets', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch EQ presets');
      const data = await response.json();
      return data.presets || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (preset: EQPreset) => {
      const response = await fetch('/api/audio-settings/eq-presets', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preset)
      });
      if (!response.ok) throw new Error('Failed to save EQ preset');
      return response.json();
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
      
      const response = await fetch(`/api/audio-settings/mixer-settings?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch mixer settings');
      const data = await response.json();
      return data.settings || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (mixerSettings: MixerSettings) => {
      const response = await fetch('/api/audio-settings/mixer-settings', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(mixerSettings)
      });
      if (!response.ok) throw new Error('Failed to save mixer settings');
      return response.json();
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
      const response = await fetch(`/api/audio-settings/waveform-cache/${hash}`, {
        credentials: 'include'
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.waveform || null;
    } catch (error) {
      console.error('Error fetching waveform cache: ', error);
      return null;
    }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (waveform: WaveformCache) => {
      const response = await fetch('/api/audio-settings/waveform-cache', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(waveform)
      });
      if (!response.ok) throw new Error('Failed to save waveform cache');
      return response.json();
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
      const response = await fetch('/api/audio-settings/enhancement-history', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials:'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to log enhancement history');
      return response.json();
    }
  });

  return {
    logEnhancement: logMutation.mutate,
    isLogging: logMutation.isPending
  };
}


