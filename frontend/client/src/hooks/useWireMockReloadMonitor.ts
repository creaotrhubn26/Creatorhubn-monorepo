import { useState, useEffect, useCallback } from 'react';
import { wireMockEvents } from '../utils/wireMockEventEmitter';

export interface WireMockReloadEvent {
  timestamp: Date;
  mappingsCount: number;
  status: 'success' | 'error';
  message?: string;
}

export interface WireMockReloadMonitorState {
  isConnected: boolean;
  lastReload: WireMockReloadEvent | null;
  reloadHistory: WireMockReloadEvent[];
  mappingsCount: number;
}

interface UseWireMockReloadMonitorOptions {
  pollingInterval?: number; // milliseconds
  onReload?: (event: WireMockReloadEvent) => void;
  enabled?: boolean;
}

/**
 * Hook to monitor WireMock mapping reloads in real-time
 * Uses polling to check WireMock admin API for changes
 */
export const useWireMockReloadMonitor = (options: UseWireMockReloadMonitorOptions = {}) => {
  const {
    pollingInterval = 5000, // 5 seconds default
    onReload,
    enabled = true
  } = options;

  const [state, setState] = useState<WireMockReloadMonitorState>({
    isConnected: false,
    lastReload: null,
    reloadHistory: [],
    mappingsCount: 0
  });

  const [previousMappingsCount, setPreviousMappingsCount] = useState<number>(0);

  const checkMappings = useCallback(async () => {
    try {
      // Check WireMock admin API for current mappings
      const response = await fetch('/api/wiremock/__admin/mappings', {
        method: 'GET',
        headers: { 'Content-Type' : 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`WireMock API returned ${response.status}`);
      }

      const data = await response.json();
      const currentCount = data.mappings?.length || 0;

      // Detect reload (mappings count changed)
      if (previousMappingsCount > 0 && currentCount !== previousMappingsCount) {
        const reloadEvent: WireMockReloadEvent = {
          timestamp: new Date(),
          mappingsCount: currentCount,
          status: 'success',
          message: `Mappings updated: ${previousMappingsCount} → ${currentCount}`
        };

        setState(prev => ({
          isConnected: true,
          lastReload: reloadEvent,
          reloadHistory: [reloadEvent, ...prev.reloadHistory].slice(0, 50), // Keep last 50
          mappingsCount: currentCount
        }));

        // Trigger callback
        if (onReload) {
          onReload(reloadEvent);
        }
      } else {
        // No change, just update connection status
        setState(prev => ({
          ...prev,
          isConnected: true,
          mappingsCount: currentCount
        }));
      }

      setPreviousMappingsCount(currentCount);
    } catch (error) {
      console.error('WireMock reload monitor error: ', error);
      
      const errorEvent: WireMockReloadEvent = {
        timestamp: new Date(),
        mappingsCount: 0,
        status: 'error',
        message: error instanceof Error ? error.message :'Unknown error'
      };

      setState(prev => ({
        ...prev,
        isConnected: false,
        lastReload: errorEvent,
        reloadHistory: [errorEvent, ...prev.reloadHistory].slice(0, 50)
      }));
    }
  }, [previousMappingsCount, onReload]);

  // Polling effect
  useEffect(() => {
    if (!enabled) return;

    // Initial check
    checkMappings();

    // Set up polling
    const intervalId = setInterval(checkMappings, pollingInterval);

    // Listen for mapping created events (Gap 7 fix)
    const unsubscribe = wireMockEvents.on('mapping_created', () => {
      // Force reload when a new mapping is created
      checkMappings();
    });

    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [enabled, pollingInterval, checkMappings]);

  const forceReload = useCallback(async () => {
    await checkMappings();
  }, [checkMappings]);

  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      reloadHistory: []
    }));
  }, []);

  return {
    ...state,
    forceReload,
    clearHistory
  };
};

