/**
 * Virtual Studio Integration Hook
 * Connects Virtual Studio to EnhancedMasterIntegrationProvider and Flask backend
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import { integrationService } from '../services/integrations';
import { logger } from '../core/services/logger';

const log = logger.module('VSIntegration, ');

// Import from EnhancedMasterIntegrationProvider
declare global {
  interface Window {
    masterIntegration?: any;
  }
}

export interface VirtualStudioIntegrationConfig {
  enableFlaskBackend?: boolean;
  enableGoogleDrive?: boolean;
  enableAnalytics?: boolean;
  enableLUTLibrary?: boolean;
  enableSVGRenderer?: boolean;
  enableAIVision?: boolean;
}

export interface VirtualStudioBackendAPI {
  // Camera Path Management
  uploadCameraPath: (fileName: string, content: any, metadata?: any) => Promise<any>;
  listCameraPaths: () => Promise<any[]>;
  downloadCameraPath: (fileId: string) => Promise<any>;
  deleteCameraPath: (fileId: string) => Promise<void>;

  // Analytics
  trackEvent: (event: string, data: unknown) => void;
  trackFeatureUsage: (feature: string, action: string, data?: any) => void;

  // Authentication
  getAuthHeader: () => Promise<Record<string, string>>;
  isAuthenticated: () => boolean;
}

export interface VirtualStudioMasterIntegration {
  // Integration Services
  lut: typeof integrationService.lut;
  svg: typeof integrationService.svg;
  aiVision: typeof integrationService.aiVision;

  // Backend API
  backend: VirtualStudioBackendAPI;

  // Master Integration Features
  analytics: unknown;
  auth: unknown;
  features: unknown;
  health: unknown;

  // Status
  isInitialized: boolean;
  status: unknown;
}

/**
 * Hook to connect Virtual Studio to the ecosystem
 */
export function useVirtualStudioIntegration(
  config: VirtualStudioIntegrationConfig = {},
): VirtualStudioMasterIntegration {
  const [isInitialized, setIsInitialized] = useState(false);
  const [masterIntegration, setMasterIntegration] = useState<unknown>(null);

  // Default config
  const finalConfig: VirtualStudioIntegrationConfig = {
    enableFlaskBackend: true,
    enableGoogleDrive: true,
    enableAnalytics: true,
    enableLUTLibrary: true,
    enableSVGRenderer: true,
    enableAIVision: true,
    ...config,
  };

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        log.info('Connecting Virtual Studio to Master Integration..., ');

        // Initialize Virtual Studio services
        await integrationService.initialize();

        // Try to connect to Master Integration Provider
        const master = window.masterIntegration || (window as any).EnhancedMasterIntegration;
        if (master) {
          setMasterIntegration(master);
          log.info('Connected to EnhancedMasterIntegrationProvider');

          // Register Virtual Studio as a component
          if (master.lifecycle?.registerComponent) {
            master.lifecycle.registerComponent({
              id: 'virtual-studio',
              type: 'studio',
              version: '1.0.0',
              capabilities: {
                data: ['camera-paths','animations','scenes','luts'],
                events: ['render','export','camera-move','animation-play'],
                actions: ['record','export-video','apply-lut','analyze-scene'],
                ui: ['3d-viewport','timeline','color-grading','character-loader'],
                system: ['lut-library','svg-renderer','ai-vision','google-drive'],
              },
              dependencies: ['google-drive','lut-engine','svg-renderer', 'ai-vision'],
              lastActive: Date.now(),
              performance: {
                renderCount: 0,
                avgRenderTime: 0,
                memoryUsage: 0,
              },
            });

            log.debug('Virtual Studio registered with Master Integration');
          }

          // Track feature usage
          if (master.features?.trackFeatureUsage) {
            master.features.trackFeatureUsage('virtual-studio', 'initialized', {
              config: finalConfig,
              services: integrationService.getStatus(),
            });
          }
        } else {
          log.warn('EnhancedMasterIntegrationProvider not found - running standalone');
        }

        setIsInitialized(true);
        log.info('Virtual Studio integration complete');
      } catch (error) {
        log.error('Virtual Studio integration failed: ', error);
      }
    };

    initialize();
  }, []);

  // Backend API implementation
  const backend: VirtualStudioBackendAPI = {
    uploadCameraPath: useCallback(
      async (fileName: string, content: any, metadata?: any) => {
        try {
          const authHeader = masterIntegration?.auth?.getAuthHeader
            ? await masterIntegration.auth.getAuthHeader()
            : {};

          const response = await fetch('/api/virtual-studio/camera-paths', {
            method: 'POST',
            headers: {
              'Content-Type' : 'application/json',
              ...authHeader,
            },
            body: JSON.stringify({
              fileName,
              content: JSON.stringify(content),
              metadata,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to upload camera path');
          }

          const result = await response.json();

          // Track in analytics
          if (masterIntegration?.analytics?.trackEvent) {
            masterIntegration.analytics.trackEvent('camera_path_uploaded', {
              fileName,
              metadata,
            });
          }

          return result;
        } catch (error) {
          log.error('Upload camera path failed:', error);
          throw error;
        }
      },
      [masterIntegration],
    ),

    listCameraPaths: useCallback(async () => {
      try {
        const authHeader = masterIntegration?.auth?.getAuthHeader
          ? await masterIntegration.auth.getAuthHeader()
          : {};

        const response = await fetch('/api/virtual-studio/camera-paths', {
          headers: authHeader,
        });

        if (!response.ok) {
          throw new Error('Failed to list camera paths');
        }

        const result = await response.json();
        return result.files || [];
      } catch (error) {
        log.error('List camera paths failed:', error);
        return [];
      }
    }, [masterIntegration]),

    downloadCameraPath: useCallback(
      async (fileId: string) => {
        try {
          const authHeader = masterIntegration?.auth?.getAuthHeader
            ? await masterIntegration.auth.getAuthHeader()
            : {};

          const response = await fetch(`/api/virtual-studio/camera-paths/${fileId}`, {
            headers: authHeader,
          });

          if (!response.ok) {
            throw new Error('Failed to download camera path');
          }

          const result = await response.json();

          // Track in analytics
          if (masterIntegration?.analytics?.trackEvent) {
            masterIntegration.analytics.trackEvent('camera_path_downloaded', { fileId });
          }

          return result.content;
        } catch (error) {
          log.error('Download camera path failed:', error);
          throw error;
        }
      },
      [masterIntegration],
    ),

    deleteCameraPath: useCallback(
      async (fileId: string) => {
        try {
          const authHeader = masterIntegration?.auth?.getAuthHeader
            ? await masterIntegration.auth.getAuthHeader()
            : {};

          const response = await fetch(`/api/virtual-studio/camera-paths/${fileId}`, {
            method: 'DELETE',
            headers: authHeader,
          });

          if (!response.ok) {
            throw new Error('Failed to delete camera path');
          }

          // Track in analytics
          if (masterIntegration?.analytics?.trackEvent) {
            masterIntegration.analytics.trackEvent('camera_path_deleted', { fileId });
          }
        } catch (error) {
          log.error('Delete camera path failed:', error);
          throw error;
        }
      },
      [masterIntegration],
    ),

    trackEvent: useCallback(
      (event: string, data: unknown) => {
        if (masterIntegration?.analytics?.trackEvent) {
          masterIntegration.analytics.trackEvent(`virtual_studio_${event}`, data);
        } else {
          log.debug(`Virtual Studio Event: ${event}`, data);
        }
      },
      [masterIntegration],
    ),

    trackFeatureUsage: useCallback(
      (feature: string, action: string, data?: any) => {
        if (masterIntegration?.features?.trackFeatureUsage) {
          masterIntegration.features.trackFeatureUsage(`virtual-studio-${feature}`, action, data);
        } else {
          log.debug(`Feature Usage: virtual-studio-${feature} - ${action}`, data);
        }
      },
      [masterIntegration],
    ),

    getAuthHeader: useCallback(async () => {
      if (masterIntegration?.auth?.getAuthHeader) {
        return await masterIntegration.auth.getAuthHeader();
      }
      return {};
    }, [masterIntegration]),

    isAuthenticated: useCallback(() => {
      return masterIntegration?.auth?.state?.isAuthenticated || false;
    }, [masterIntegration]),
  };

  // Memoize analytics object to prevent infinite loops
  const analytics = useMemo(() => {
    return masterIntegration?.analytics || {
      trackEvent: backend.trackEvent,
      getMetrics: () => ({}),
      clearMetrics: () => {},
    };
  }, [masterIntegration, backend.trackEvent]);

  // Memoize auth object to prevent infinite loops
  const auth = useMemo(() => {
    return masterIntegration?.auth || {
      state: { isAuthenticated: false, isLoading: false, user: null, token: null, error: null },
      getAuthHeader: backend.getAuthHeader,
      isAuthenticated: backend.isAuthenticated,
    };
  }, [masterIntegration, backend.getAuthHeader, backend.isAuthenticated]);

  // Memoize features object to prevent infinite loops
  const features = useMemo(() => {
    return masterIntegration?.features || {
      checkFeatureAccess: () => ({ hasAccess: true, reason: 'Standalone mode' }),
      trackFeatureUsage: backend.trackFeatureUsage,
    };
  }, [masterIntegration, backend.trackFeatureUsage]);

  // Memoize health object to prevent infinite loops
  const health = useMemo(() => {
    return masterIntegration?.health || {
      status: 'healthy',
      components: { total: 0, active: 0, inactive: 0, error: 0 },
      performance: { avgResponseTime: 0, memoryUsage: 0, errorRate: 0 },
      lastCheck: Date.now(),
    };
  }, [masterIntegration]);

  // Memoize the entire return object to prevent infinite loops
  return useMemo(() => ({
    // Integration Services
    lut: integrationService.lut,
    svg: integrationService.svg,
    aiVision: integrationService.aiVision,

    // Backend API
    backend,

    // Master Integration Features (pass through if available)
    analytics,
    auth,
    features,
    health,

    // Status
    isInitialized,
    status: integrationService.getStatus(),
  }), [backend, analytics, auth, features, health, isInitialized]);
}

/**
 * Helper to expose master integration globally for debugging
 */
export function exposeMasterIntegration(integration: unknown) {
  if (typeof window !=='undefined') {
    (window as any).virtualStudioIntegration = integration;
    log.debug('Virtual Studio integration exposed at window.virtualStudioIntegration');
  }
}
