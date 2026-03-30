/**
 * Virtual Studio Integration Hook
 * Connects Virtual Studio to EnhancedMasterIntegrationProvider and Flask backend
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import { integrationService } from '../services/integrations';
import { logger } from '../core/services/logger';

const log = logger.module('VSIntegration');

type IntegrationStatus = ReturnType<typeof integrationService.getStatus>;

interface IntegrationAuthState {
  isAuthenticated: boolean;
  isLoading?: boolean;
  user?: unknown;
  token?: string | null;
  error?: string | null;
}

interface IntegrationAnalytics {
  trackEvent?: (event: string, data?: Record<string, unknown>) => void;
  getMetrics?: () => Record<string, unknown>;
  clearMetrics?: () => void;
}

interface IntegrationAuth {
  getAuthHeader?: () => Promise<Record<string, string>>;
  isAuthenticated?: () => boolean;
  state?: IntegrationAuthState;
}

interface IntegrationFeatures {
  trackFeatureUsage?: (feature: string, action: string, data?: Record<string, unknown>) => void;
  isEnabled?: (feature: string) => boolean;
  checkFeatureAccess?: (feature: string) => { hasAccess: boolean; reason: string };
}

interface IntegrationHealth {
  getStatus?: () => Record<string, unknown>;
  status?: string;
  components?: Record<string, number>;
  performance?: Record<string, number>;
  lastCheck?: number;
}

interface MasterIntegrationBridge {
  analytics?: IntegrationAnalytics;
  auth?: IntegrationAuth;
  features?: IntegrationFeatures;
  health?: IntegrationHealth;
  lifecycle?: {
    registerComponent?: (component: {
      id: string;
      type: string;
      version: string;
      capabilities: Record<string, string[]>;
      dependencies: string[];
      lastActive: number;
      performance: {
        renderCount: number;
        avgRenderTime: number;
        memoryUsage: number;
      };
    }) => void;
  };
}

declare global {
  interface Window {
    masterIntegration?: MasterIntegrationBridge;
    EnhancedMasterIntegration?: MasterIntegrationBridge;
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
  uploadCameraPath: (
    fileName: string,
    content: unknown,
    metadata?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  listCameraPaths: () => Promise<Record<string, unknown>[]>;
  downloadCameraPath: (fileId: string) => Promise<unknown>;
  deleteCameraPath: (fileId: string) => Promise<void>;

  // Analytics
  trackEvent: (event: string, data?: Record<string, unknown>) => void;
  trackFeatureUsage: (feature: string, action: string, data?: Record<string, unknown>) => void;

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
  analytics: IntegrationAnalytics;
  auth: Required<Pick<IntegrationAuth, 'getAuthHeader' | 'isAuthenticated'>> & IntegrationAuth;
  features: IntegrationFeatures;
  health: IntegrationHealth;

  // Status
  isInitialized: boolean;
  status: IntegrationStatus;
}

interface StandaloneIntegrationWindow extends Window {
  virtualStudioIntegration?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return { value: null };
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (Array.isArray(value)) {
    return { items: value };
  }

  return { value };
}

/**
 * Hook to connect Virtual Studio to the ecosystem
 */
export function useVirtualStudioIntegration(
  config: VirtualStudioIntegrationConfig = {},
): VirtualStudioMasterIntegration {
  const [isInitialized, setIsInitialized] = useState(false);
  const [masterIntegration, setMasterIntegration] = useState<MasterIntegrationBridge | null>(null);

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
        log.info('Connecting Virtual Studio to Master Integration...');

        // Initialize Virtual Studio services
        await integrationService.initialize();

        // Try to connect to Master Integration Provider
        const master = window.masterIntegration ?? window.EnhancedMasterIntegration;
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
      async (fileName: string, content: unknown, metadata?: Record<string, unknown>) => {
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

          const result = (await response.json()) as Record<string, unknown>;

          // Track in analytics
          if (masterIntegration?.analytics?.trackEvent) {
            masterIntegration.analytics.trackEvent('camera_path_uploaded', {
              fileName,
              ...toRecord(metadata),
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

        const result = (await response.json()) as { files?: Record<string, unknown>[] };
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

          const result = (await response.json()) as { content?: unknown };

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
      (event: string, data?: Record<string, unknown>) => {
        const payload = toRecord(data);

        if (masterIntegration?.analytics?.trackEvent) {
          masterIntegration.analytics.trackEvent(`virtual_studio_${event}`, payload);
        } else {
          log.debug(`Virtual Studio Event: ${event}`, payload);
        }
      },
      [masterIntegration],
    ),

    trackFeatureUsage: useCallback(
      (feature: string, action: string, data?: Record<string, unknown>) => {
        const payload = toRecord(data);

        if (masterIntegration?.features?.trackFeatureUsage) {
          masterIntegration.features.trackFeatureUsage(
            `virtual-studio-${feature}`,
            action,
            payload,
          );
        } else {
          log.debug(`Feature Usage: virtual-studio-${feature} - ${action}`, payload);
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
      if (masterIntegration?.auth?.isAuthenticated) {
        return masterIntegration.auth.isAuthenticated();
      }

      return masterIntegration?.auth?.state?.isAuthenticated ?? false;
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
  const auth = useMemo<
    Required<Pick<IntegrationAuth, 'getAuthHeader' | 'isAuthenticated'>> & IntegrationAuth
  >(() => {
    const integrationAuth = masterIntegration?.auth;

    return {
      ...integrationAuth,
      state: integrationAuth?.state ?? {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        token: null,
        error: null,
      },
      getAuthHeader: integrationAuth?.getAuthHeader ?? backend.getAuthHeader,
      isAuthenticated: integrationAuth?.isAuthenticated ?? backend.isAuthenticated,
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
  if (typeof window !== 'undefined') {
    (window as StandaloneIntegrationWindow).virtualStudioIntegration = integration;
    log.debug('Virtual Studio integration exposed at window.virtualStudioIntegration');
  }
}
