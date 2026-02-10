/**
 * Enhanced Master Integration Provider
 * Advanced integration system with improved performance, type safety, and developer experience
 * Enables "everything interacts with everything, " functionality with enterprise-grade features
 */

import React, { createContext, useContext, useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { IntegrationProvider, useIntegration } from './ComponentIntegrationManager';
import { INTEGRATION_CONFIGS } from './MasterIntegrationProvider';
import { CommunicationProvider, useCommunication } from './CrossComponentCommunication';
import { DataFlowProvider, useDataFlow } from './UniversalDataFlow';
import { ComponentRegistryProvider, useComponentRegistry } from './UniversalComponentRegistry';
import { UniversalIntegrationSystem } from './UniversalIntegrationSystem';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';
import { PROFESSION_FEATURE_MATRIX } from '../../../shared/profession-feature-matrix';
import { FEATURE_COMPONENT_MAP } from './feature-component-map';
import { getFeatureMetadata } from './feature-metadata';

// Token cache for impersonated access tokens
let cachedToken = { token: "", exp: 0 };

/**
 * Get impersonated access token via backend proxy
 * DISABLED: Authentication bypassed for direct dashboard access
 */
async function getImpersonatedAccessToken(scopes: string[] = ["https://www.googleapis.com/auth/cloud-platform"]): Promise<string> {
  // Authentication disabled - return empty token
  return "";
}

/**
 * Get authorization header for API requests
 */
async function getAuthHeaderFromToken(scopes?: string[]) {
  const token = await getImpersonatedAccessToken(scopes);
  return { Authorization: `Bearer ${token}` };
}

/**
 * Get authenticated client configuration for Google APIs
 */
async function getAuthenticatedClientFromToken(scopes?: string[]) {
  const accessToken = await getImpersonatedAccessToken(scopes);
  return {
    accessToken,
    getAccessToken: () => Promise.resolve({ token: accessToken }),
    setCredentials: () => {},
    credentials: { access_token: accessToken },
  };
}
import {
  captureErrorToSentry,
  addSentryBreadcrumb,
  setSentryUser,
  setSentryTags,
  setSentryContext,
} from '../utils/sentry';

// Enhanced type definitions
interface ComponentCapabilities {
  data: string[];
  events: string[];
  actions: string[];
  ui: string[];
  system: string[];
}

// Google Authentication types
interface GoogleUserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'learner, ' | 'instructor' | 'admin';
  permissions: string[];
  organization?: string;
  lastLogin: number;
}

// LinkedIn Authentication types
interface LinkedInUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  profilePicture?: string;
  headline?: string;
  summary?: string;
  location?: string;
  industry?: string;
  experience?: LinkedInExperience[];
  education?: LinkedInEducation[];
  skills?: string[];
  languages?: string[];
  certifications?: LinkedInCertification[];
  lastSynced: number;
}

interface LinkedInExperience {
  id: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
}

interface LinkedInEducation {
  id: string;
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

interface LinkedInCertification {
  id: string;
  name: string;
  issuingOrganization: string;
  issueDate?: string;
  expirationDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

interface LinkedInAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  profile: LinkedInUserProfile | null;
  token: string | null;
  error: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GoogleUserProfile | null;
  token: string | null;
  error: string | null;
}

// Visual Editor types
interface EditorElement {
  id: string;
  type: 'button' | 'text' | 'image' | 'card' | 'container' | 'grid' | 'audio' | 'video';
  x: number;
  y: number;
  width: number;
  height: number;
  styles: {
    backgroundColor?: string;
    color?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
    fontSize?: string;
    fontWeight?: string;
    lineHeight?: string;
    transform?: string;
    textShadow?: string;
    opacity?: number;
    boxShadow?: string;
    border?: string;
    display?: string;
    gap?: string;
    fontFamily?: string;
    fontStyle?: string;
    background?: string;
    textStroke?: string;
  };
  props: Record<string, any>;
  children?: string[];
  parent?: string;
  icon?: string;
}

interface EditorProject {
  id: string;
  name: string;
  elements: Record<string, EditorElement>;
  pageSettings: {
    width: number;
    height: number;
    backgroundColor: string;
};
}

interface VisualEditorState {
  project: EditorProject;
  selectedElements: string[];
  selectedElement: EditorElement | null;
  extendedThinking: boolean;
  highPowerMode: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  multiSelectMode: boolean;
  gridSize: number;
  canvasZoom: number;
  canvasPan: { x: number; y: number };
  showRulers: boolean;
  isDragging: boolean;
  draggedComponent: string | null;
  isSaving: boolean;
  history: EditorProject[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  totalElementsCount: number;
}

interface ComponentMetadata {
  id: string;
  type: string;
  version: string;
  capabilities: ComponentCapabilities;
  dependencies: string[];
  lastActive: number;
  performance: {
    renderCount: number;
    avgRenderTime: number;
    memoryUsage: number;
};
}

interface IntegrationHealth {
  status: 'healthy' | 'degraded' | 'critical';
  components: {
    total: number;
    active: number;
    inactive: number;
    error: number;
};
  performance: {
    avgResponseTime: number;
    memoryUsage: number;
    errorRate: number;
};
  lastCheck: number;
}

interface MasterIntegrationContextType {
  // Core integration systems
  integration: ReturnType<typeof useIntegration>;
  communication: ReturnType<typeof useCommunication>;
  dataFlow: ReturnType<typeof useDataFlow>;
  componentRegistry: ReturnType<typeof useComponentRegistry>;
  
  // Enhanced features
  health: IntegrationHealth;
  analytics: {
    trackEvent: (event: string, data: any) => void;
    getMetrics: () => any;
    clearMetrics: () => void;
    
    // ✅ GA4-Integrated tracking methods (automatic GA4 + local tracking)
    trackUserRegistration: (source?: string, campaignId?: string) => void;
    trackOnboardingStep: (stepNumber: number, stepName: string) => void;
    trackOnboardingComplete: () => void;
    trackSubscriptionStart: (tier: string) => void;
    trackSubscriptionComplete: (params: { tier: string; price: number; paymentMethod?: string }) => void;
    trackProjectCreated: (projectType: string) => void;
    trackProjectCompleted: (projectType: string, durationDays?: number) => void;
};
  debugging: {
    enableDebugMode: (enabled: boolean) => void;
    getDebugInfo: () => any;
    logIntegration: (level: 'info' | 'warn' | 'error', message: string, data?: any) => void;
};
  performance: {
    startTiming: (operation: string) => () => void;
    getPerformanceMetrics: () => any;
    optimize: () => void;
};
  lifecycle: {
    registerComponent: (metadata: ComponentMetadata) => void;
    unregisterComponent: (id: string) => void;
    getComponentInfo: (id: string) => ComponentMetadata | null;
    getAllComponents: () => ComponentMetadata[];
};
  features: {
    checkFeatureAccess: (feature: string, userRole?: string) => { hasAccess: boolean; reason: string };
    trackFeatureUsage: (feature: string, action: string, data?: any) => void;
    getFeatureAnalytics: () => { enabledFeatures: number; totalFeatures: number; featureAdoptionRate: number };
};
  
  // Authentication and user management
  auth: {
    state: AuthState;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    refreshToken: () => Promise<void>;
    getUserProfile: () => GoogleUserProfile | null;
    hasPermission: (permission: string) => boolean;
    hasRole: (role: string) => boolean;
    getAuthHeader: () => Promise<Record<string, string>>;
    getAuthenticatedClient: (scopes?: string[]) => Promise<any>; // ✅ Same as server-side
};
  
  // LinkedIn Authentication
  linkedIn: {
    state: LinkedInAuthState;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    syncProfile: () => Promise<LinkedInUserProfile>;
    getProfile: () => LinkedInUserProfile | null;
};
  
  // Visual Editor
  visualEditor: {
    // State
    state: VisualEditorState;
    
    // Element operations
    addElement: (element: EditorElement) => void;
    updateElement: (elementId: string, updates: Partial<EditorElement>) => void;
    deleteElement: (elementId: string) => void;
    duplicateElement: (elementId: string) => void;
    
    // Selection operations
    selectElement: (elementId: string) => void;
    selectMultipleElements: (elementIds: string[]) => void;
    clearSelection: () => void;
    
    // Group operations
    groupElements: (elementIds: string[]) => void;
    ungroupElements: (groupId: string) => void;
    
    // Alignment operations
    alignElements: (elementIds: string[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
    
    // History operations
    undo: () => void;
    redo: () => void;
    
    // Canvas operations
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    fitToScreen: () => void;
    
    // Drag and drop operations
    startDrag: (componentType: string) => void;
    endDrag: () => void;
    handleDrop: (position: { x: number; y: number }) => void;
    
    // Save operations
    saveProject: () => Promise<boolean>;
    
    // Settings
    setExtendedThinking: (enabled: boolean) => void;
    setHighPowerMode: (enabled: boolean) => void;
    setShowGrid: (enabled: boolean) => void;
    setSnapToGrid: (enabled: boolean) => void;
    setMultiSelectMode: (enabled: boolean) => void;
    setGridSize: (size: number) => void;
    setCanvasZoom: (zoom: number) => void;
    setCanvasPan: (pan: { x: number; y: number }) => void;
    setShowRulers: (enabled: boolean) => void;
};
}

// Create enhanced context
const MasterIntegrationContext = createContext<MasterIntegrationContextType | null>(null);

// Enhanced Master Integration Provider
export const EnhancedMasterIntegrationProvider: React.FC<{ 
  children: React.ReactNode;
  enableDebugMode?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableAnalytics?: boolean;
}> = ({ 
  children, 
  enableDebugMode = false,
  enablePerformanceMonitoring = true,
  enableAnalytics = true
}) => {
  // Performance monitoring
  const performanceMetrics = useRef<Map<string, number[]>>(new Map());
  const renderCounts = useRef<Map<string, number>>(new Map());
  const debugMode = useRef(enableDebugMode);
  const analyticsData = useRef<any[]>([]);
  
  // ✅ GA4 Integration - Automatic tracking for all events
  const ga4 = useGA4Tracking();

  // Health monitoring
  const [health, setHealth] = React.useState<IntegrationHealth>({
    status: 'healthy',
    components: { total: 0, active: 0, inactive: 0, error: 0 },
    performance: { avgResponseTime: 0, memoryUsage: 0, errorRate: 0 },
    lastCheck: Date.now()
});

  // Component lifecycle management
  const componentMetadata = useRef<Map<string, ComponentMetadata>>(new Map());
  
	  // Feature system - DYNAMIC: Loads from profession feature matrix and database
	  const featureUsage = useRef<Map<string, { count: number; lastUsed: number }>>(new Map());
	  const [availableFeatures, setAvailableFeatures] = useState<Set<string>>(new Set([
    // Base Academy features (always available)
    'course-creation', 'course-management','lesson-creation','content-management','media-upload','course-publishing','course-analytics','collaboration','video-processing','annotation-editing','chapter-management','lower-thirds','cta-overlays','module-management','academy-dashboard','floating-action-menu','asset-browser','settings-panel','video-player','analytics-dashboard','visual-editor','visual-editing','drag-drop-editor',
    
    // Resume Builder features
    'resume-builder','resume-templates','resume-export','resume-analytics','ats-optimization','google-drive-integration','portfolio-management','resume-versioning','resume-auto-save','ai-resume-writing','ai-content-suggestions','job-application-tracking','norwegian-job-portals','resume-sharing','resume-collaboration',
    
    // Enterprise Team features
    'enterprise-team-management','enterprise-team-members','enterprise-team-roles','enterprise-combined-projects',
    'enterprise-photo-suite','enterprise-video-suite','enterprise-team-analytics','enterprise-team-portfolio',
    'enterprise-billing','enterprise-subscription','enterprise-workload-balance','enterprise-equipment-sharing'
  ]));
  
	  // Fetch dynamic features from profession configurations (shared matrix + backend API)
	  useEffect(() => {
	    const syncDynamicFeatures = async () => {
	      // Start with the base features defined in state at mount time
	      const allFeatures = new Set(availableFeatures);

	      // 1) Enrich from the shared Profession Feature Matrix (static, no network)
	      try {
	        Object.values(PROFESSION_FEATURE_MATRIX).forEach((professionConfig) => {
	          Object.keys(professionConfig.availableFeatures).forEach((featureId) => {
	            allFeatures.add(featureId);
	          });
	        });
	      } catch (error) {
	        console.warn('Could not load features from PROFESSION_FEATURE_MATRIX, continuing with base set:', error);
	      }

	      // 2) Enrich from the backend professions API (dynamic / database-driven)
	      try {
	        const response = await fetch('/api/professions/all');
	        if (response.ok) {
	          const data = await response.json();

	          data.professions?.forEach((profession: any) => {
	            if (profession.features && Array.isArray(profession.features)) {
	              profession.features.forEach((featureId: string) => {
	                allFeatures.add(featureId);
	              });
	            }
	          });

	          console.log(
	            `✅ Loaded ${allFeatures.size} features from profession-feature-matrix + ${data.professions?.length || 0} professions`
	          );
	        }
	      } catch (error) {
	        console.warn('Could not fetch dynamic features from /api/professions/all, using matrix + base set:', error);
	      }

	      // Update available features with the combined set
	      setAvailableFeatures(allFeatures);
	    };

	    syncDynamicFeatures();
	  }, []);

  // Visual Editor State (Admin Only)
  const [visualEditorState, setVisualEditorState] = useState<VisualEditorState>({
    project: {
      id: 'default-project',
      name: 'New Project',
      elements: {},
      pageSettings: {
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff'
    }
  },
    selectedElements: [],
    selectedElement: null,
    extendedThinking: false,
    highPowerMode: false,
    showGrid: true,
    snapToGrid: true,
    multiSelectMode: false,
    gridSize: 20,
    canvasZoom: 1,
    canvasPan: { x: 0, y: 0 },
    showRulers: true,
    isDragging: false,
    draggedComponent: null,
    isSaving: false,
    history: [],
    historyIndex: -1,
    canUndo: false,
    canRedo: false,
    totalElementsCount: 0
});

  // Google Authentication state
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    token: null,
    error: null
});

  // LinkedIn Authentication state
  const [linkedInAuthState, setLinkedInAuthState] = useState<LinkedInAuthState>({
    isAuthenticated: false,
    isLoading: false,
    profile: null,
    token: null,
    error: null
});

  // Initialize authentication on mount (will be defined later)
  const [authInitialized, setAuthInitialized] = useState(false);

  // Performance timing utility
  const startTiming = useCallback((operation: string) => {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (!performanceMetrics.current.has(operation)) {
        performanceMetrics.current.set(operation, []);
    }
      
      const times = performanceMetrics.current.get(operation)!;
      times.push(duration);
      
      // Keep only last 100 measurements
      if (times.length > 100) {
        times.shift();
    }
      
      if (debugMode.current) {
        console.log(`⏱️ Performance: ${operation} took ${duration.toFixed(2)}ms`);
    }
  };
}, []);

  // Analytics tracking - Enhanced with automatic GA4 integration
  const trackEvent = useCallback((event: string, data: any) => {
    if (!enableAnalytics) return;
    
    const eventData = {
      timestamp: Date.now(),
      event,
      data,
      component: data?.component || 'MasterIntegrationProvider',
      userId: authState.user?.id,
      userRole: authState.user?.role,
      profession: authState.user?.email?.split('@')[0] || data?.profession // Extract profession from context
  };
    
    analyticsData.current.push(eventData);
    
    // Keep only last 1000 events
    if (analyticsData.current.length > 1000) {
      analyticsData.current.shift();
  }
    
    // ✅ AUTOMATICALLY SEND TO GA4
    // Map common event names to GA4 tracking methods
    try {
      switch (event) {
        case 'user_authenticated':
        case 'component_mounted':
        case 'component_unmounted':
        case 'feature_used':
          // Track as custom event with all context
          ga4.trackCustomEvent(event, {
            ...data,
            user_id: authState.user?.id,
            user_role: authState.user?.role
          });
          break;
        default:
          // Track all other events as custom events
          ga4.trackCustomEvent(event, {
            ...data,
            user_id: authState.user?.id,
            user_role: authState.user?.role
          });
      }
    } catch (error) {
      console.warn('GA4 tracking failed:', error);
    }
    
    if (debugMode.current) {
      console.log('📊 Analytics + GA4:', eventData);
  }
}, [enableAnalytics, authState.user, ga4]);

  // Debug logging
  const logIntegration = useCallback((level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    if (!debugMode.current) return;
    
    const logData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      component: 'MasterIntegrationProvider'
  };
    
    switch (level) {
      case 'info':
        console.log('ℹ️ Integration Info:', logData);
        break;
      case 'warn':
        console.warn('⚠️ Integration Warning:', logData);
        break;
      case 'error':
        console.error('❌ Integration Error:', logData);
        break;
  }
}, []);

  // Component lifecycle management
  const registerComponent = useCallback((metadata: ComponentMetadata) => {
    componentMetadata.current.set(metadata.id, {
      ...metadata,
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
    }
  });
    
    logIntegration('info, ', `Component registered: ${metadata.id}`, metadata);
    trackEvent('component_registered', { componentId: metadata.id, type: metadata.type });
}, [logIntegration, trackEvent]);

  const unregisterComponent = useCallback((id: string) => {
    componentMetadata.current.delete(id);
    logIntegration('info', `Component unregistered: ${id}`);
    trackEvent('component_unregistered', { componentId: id });
}, [logIntegration, trackEvent]);

  const getComponentInfo = useCallback((id: string) => {
    return componentMetadata.current.get(id) || null;
}, []);

  const getAllComponents = useCallback(() => {
    return Array.from(componentMetadata.current.values());
}, []);

  // Performance optimization
  const optimize = useCallback(() => {
    // Clear old performance data
    performanceMetrics.current.clear();
    
    // Trigger garbage collection if available
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
  }
    
    logIntegration('info','Performance optimization completed');
    trackEvent('performance_optimized', {});
}, [logIntegration, trackEvent]);

  // Health check
  const performHealthCheck = useCallback(() => {
    const components = getAllComponents();
    const now = Date.now();
    
    const activeComponents = components.filter(c => now - c.lastActive < 30000); // Active within 30 seconds
    const errorComponents = components.filter(c => c.performance.avgRenderTime > 1000); // Slow components
    
    const avgResponseTime = Array.from(performanceMetrics.current.values())
      .flat()
      .reduce((sum, time) => sum + time, 0) / 
      Array.from(performanceMetrics.current.values()).flat().length || 0;
    
    const memoryUsage = (performance as any).memory ? 
      ((performance as any).memory.usedJSHeapSize / 1024 / 1024) : 0; // MB
    
    const errorRate = errorComponents.length / components.length || 0;
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (errorRate > 0.1 || memoryUsage > 100) status = 'degraded';
    if (errorRate > 0.3 || memoryUsage > 200) status = 'critical';
    
    const newHealth: IntegrationHealth = {
      status,
      components: {
        total: components.length,
        active: activeComponents.length,
        inactive: components.length - activeComponents.length,
        error: errorComponents.length
    },
      performance: {
        avgResponseTime,
        memoryUsage,
        errorRate
    },
      lastCheck: now
  };
    
    setHealth(newHealth);
    
    if (status !== 'healthy') {
      logIntegration('warn', `Health check failed: ${status}`, newHealth);
  }
    
    trackEvent('health_check', newHealth);
}, [getAllComponents, logIntegration, trackEvent]);

  // Periodic health checks
  useEffect(() => {
    if (!enablePerformanceMonitoring) return;
    
    const interval = setInterval(performHealthCheck, 30000); // Every 30 seconds
    return () => clearInterval(interval);
}, [performHealthCheck, enablePerformanceMonitoring]);

  // Analytics utilities
  const getMetrics = useCallback(() => {
    return {
      events: analyticsData.current,
      performance: Object.fromEntries(performanceMetrics.current),
      components: getAllComponents(),
      health
  };
}, [getAllComponents, health]);

  const clearMetrics = useCallback(() => {
    analyticsData.current = [];
    performanceMetrics.current.clear();
    logIntegration('info','Analytics data cleared');
}, [logIntegration]);

  // Debug utilities
  const enableDebugModeUtil = useCallback((enabled: boolean) => {
    debugMode.current = enabled;
    logIntegration('info', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
}, [logIntegration]);

  const getDebugInfo = useCallback(() => {
    return {
      debugMode: debugMode.current,
      components: getAllComponents(),
      performance: Object.fromEntries(performanceMetrics.current),
      health,
      analytics: analyticsData.current.slice(-10), // Last 10 events
      features: Object.fromEntries(featureUsage.current)
  };
}, [getAllComponents, health]);

  // Google Authentication functions
  const initializeAuth = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    // Add Sentry breadcrumb for auth attempt
    addSentryBreadcrumb({
      category: 'auth',
      message: 'Initializing Google authentication',
      level: 'info',
    });

    try {
      const token = await getImpersonatedAccessToken();

      // Create user profile from environment variables
      const userProfile: GoogleUserProfile = {
        id: 'google-user-daniel',
        email: process.env.GOOGLE_ADMIN_EMAIL || process.env.GOOGLE_IMPERSONATE_USER || 'daniel@creatorhubn.com',
        name: 'Daniel Admin',
        picture: undefined, // Would be fetched from Google API in real implementation
        role: 'admin', // Daniel is admin based on env config
        permissions: ['visual-editor','course-management','user-management','admin-access'],
        organization: process.env.GOOGLE_WORKSPACE_DOMAIN || 'creatorhubn.com',
        lastLogin: Date.now()
    };

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user: userProfile,
        token,
        error: null
    });

      // Set Sentry user context
      setSentryUser({
        id: userProfile.id,
        email: userProfile.email,
        username: userProfile.name,
      });

      // Set Sentry tags
      setSentryTags({
        role: userProfile.role,
        organization: userProfile.organization || 'unknown',
      });

      // Add success breadcrumb
      addSentryBreadcrumb({
        category: 'auth',
        message: 'Google authentication successful',
        level: 'info',
        data: {
          userId: userProfile.id,
          role: userProfile.role,
        },
      });

      logIntegration('info','Google authentication successful', {
        userId: userProfile.id,
        role: userProfile.role,
        email: userProfile.email,
        organization: userProfile.organization
    });

      trackEvent('user_authenticated', {
        userId: userProfile.id,
        role: userProfile.role,
        email: userProfile.email,
        organization: userProfile.organization
    });

  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';

      // Capture error to Sentry
      captureErrorToSentry(error as Error, {
        context: 'google-authentication',
        action: 'initialize',
      });

      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        token: null,
        error: errorMessage
    });

      logIntegration('error','Google authentication failed', { error: errorMessage });
      trackEvent('authentication_failed', { error: errorMessage });
  }
}, [logIntegration, trackEvent]);

  const login = useCallback(async () => {
    await initializeAuth();
}, [initializeAuth]);

  const logout = useCallback(async () => {
    // Add Sentry breadcrumb for logout
    addSentryBreadcrumb({
      category: 'auth',
      message: 'User logging out',
      level: 'info',
    });

    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      token: null,
      error: null
  });

    // Clear Sentry user context
    setSentryUser(null);

    logIntegration('info','User logged out');
    trackEvent('user_logged_out', {});
}, [logIntegration, trackEvent]);

  const refreshToken = useCallback(async () => {
    addSentryBreadcrumb({
      category: 'auth',
      message: 'Refreshing authentication token',
      level: 'info',
    });

    try {
      const newToken = await getImpersonatedAccessToken();
      setAuthState(prev => ({ ...prev, token: newToken }));

      addSentryBreadcrumb({
        category: 'auth',
        message: 'Token refreshed successfully',
        level: 'info',
      });

      logIntegration('info','Token refreshed successfully');
      trackEvent('token_refreshed', {});
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';

      // Capture error to Sentry
      captureErrorToSentry(error as Error, {
        context: 'token-refresh',
        action: 'refresh',
      });

      setAuthState(prev => ({ ...prev, error: errorMessage }));
      logIntegration('error','Token refresh failed', { error: errorMessage });
  }
}, [logIntegration, trackEvent]);

  const getUserProfile = useCallback(() => {
    return authState.user;
}, [authState.user]);

  const hasPermission = useCallback((permission: string) => {
    return authState.user?.permissions.includes(permission) || false;
}, [authState.user]);

  const hasRole = useCallback((role: string) => {
    return authState.user?.role === role;
}, [authState.user]);

  // ============================================
  // LINKEDIN AUTHENTICATION FUNCTIONS
  // ============================================
  
  const linkedInLogin = useCallback(async () => {
    addSentryBreadcrumb({
      category: 'auth',
      message: 'LinkedIn login initiated',
      level: 'info',
    });

    try {
      setLinkedInAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      // Redirect to backend OAuth endpoint
      const redirectUri = `${window.location.origin}/api/linkedin/callback`;
      const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID;

      if (!clientId) {
        throw new Error('LinkedIn Client ID not configured');
      }

      // LinkedIn OAuth URL
      const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${Date.now()}&scope=openid%20profile%20email%20w_member_social%20r_liteprofile%20r_emailaddress%20r_fullprofile`;

      // Redirect to LinkedIn
      window.location.href = linkedInAuthUrl;

      logIntegration('info','LinkedIn login initiated');
      trackEvent('linkedin_login_initiated', {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'LinkedIn login failed';

      // Capture error to Sentry
      captureErrorToSentry(error as Error, {
        context: 'linkedin-authentication',
        action: 'login',
      });

      setLinkedInAuthState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      logIntegration('error','LinkedIn login failed', { error: errorMessage });
      trackEvent('linkedin_login_failed', { error: errorMessage });
    }
  }, [logIntegration, trackEvent]);
  
  const linkedInLogout = useCallback(async () => {
    setLinkedInAuthState({
      isAuthenticated: false,
      isLoading: false,
      profile: null,
      token: null,
      error: null
    });
    
    logIntegration('info','LinkedIn logout successful');
    trackEvent('linkedin_logout', {});
  }, [logIntegration, trackEvent]);
  
  const linkedInSyncProfile = useCallback(async () => {
    addSentryBreadcrumb({
      category: 'linkedin',
      message: 'Syncing LinkedIn profile',
      level: 'info',
    });

    try {
      if (!linkedInAuthState.token) {
        throw new Error('Not authenticated with LinkedIn');
      }

      setLinkedInAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      // Call backend to fetch LinkedIn profile data
      const response = await fetch('/api/linkedin/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${linkedInAuthState.token}`,
          'Content-Type' : 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch LinkedIn profile');
      }

      const profileData = await response.json();

      setLinkedInAuthState(prev => ({
        ...prev,
        profile: profileData,
        isLoading: false,
        lastSynced: Date.now()
      }));

      addSentryBreadcrumb({
        category: 'linkedin',
        message: 'LinkedIn profile synced successfully',
        level: 'info',
        data: {
          profileId: profileData.id,
        },
      });

      logIntegration('info','LinkedIn profile synced successfully');
      trackEvent('linkedin_profile_synced', {});

      return profileData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'LinkedIn sync failed';

      // Capture error to Sentry
      captureErrorToSentry(error as Error, {
        context: 'linkedin-sync',
        action: 'sync-profile',
      });

      setLinkedInAuthState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      logIntegration('error','LinkedIn sync failed', { error: errorMessage });
      trackEvent('linkedin_sync_failed', { error: errorMessage });
      throw error;
    }
  }, [linkedInAuthState.token, logIntegration, trackEvent]);
  
  const getLinkedInProfile = useCallback(() => {
    return linkedInAuthState.profile;
  }, [linkedInAuthState.profile]);

  // Initialize authentication on mount - DISABLED for direct dashboard access
  useEffect(() => {
    // Authentication disabled - set as authenticated without Google OAuth
    if (!authInitialized) {
      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'local-user',
          email: 'user@local.dev',
          name: 'Local User',
          role: 'admin',
          permissions: ['visual-editor', 'course-management', 'user-management', 'admin-access'],
          organization: 'local',
          lastLogin: Date.now()
        },
        token: '',
        error: null
      });
      setAuthInitialized(true);
  }
}, [authInitialized]);

  // Feature system functions
  const checkFeatureAccess = useCallback((feature: string, userRole?: string) => {
    const hasAccess = availableFeatures.has(feature);
    const currentRole = userRole || authState.user?.role;
    const isPrototypeTester = currentRole === 'prototype_tester';
    const isAdmin = currentRole === 'admin' || authState.user?.isAdmin;
    
    // Testing & QA Features - Tester-only restrictions
    const testerOnlyFeatures = ['test-data-generator','prototype-tester-tools'];
    if (testerOnlyFeatures.includes(feature)) {
      if (!isPrototypeTester && !isAdmin) {
        return {
          hasAccess: false,
          reason: 'This feature requires prototype tester approval',
          upgradeUrl: '/apply-tester'
        };
      }
    }
    
    // Role-based restrictions using real authentication
    if (feature === 'visual-editor' && currentRole !== 'admin') {
      return { 
        hasAccess: false, 
        reason: 'Visual Editor requires admin privileges' 
    };
  }
    
    // Permission-based restrictions
    if (feature === 'visual-editor' && !hasPermission('visual-editor')) {
      return { 
        hasAccess: false, 
        reason: 'Visual Editor permission required' 
    };
  }
    
    const reason = hasAccess ? 'Feature is available' : 'Feature not available';
    
    if (debugMode.current) {
      console.log(`Feature Access Check: ${feature} - ${reason}`, { 
        userRole: currentRole,
        isPrototypeTester,
        authenticated: authState.isAuthenticated,
        userId: authState.user?.id 
    });
  }
    
    return { hasAccess, reason };
}, [authState.user, hasPermission, availableFeatures]);

  const trackFeatureUsage = useCallback((feature: string, action: string, data?: any) => {
    if (!availableFeatures.has(feature)) {
      logIntegration('warn', `Attempted to track usage of unavailable feature: ${feature}`);
      return;
  }

    const currentUsage = featureUsage.current.get(feature) || { count: 0, lastUsed: 0 };
    featureUsage.current.set(feature, {
      count: currentUsage.count + 1,
      lastUsed: Date.now()
  });

    // Add Sentry breadcrumb for feature usage
    addSentryBreadcrumb({
      category: 'feature-usage',
      message: `Feature used: ${feature}`,
      level: 'info',
      data: {
        feature,
        action,
        usageCount: currentUsage.count + 1,
      },
    });

    // ✅ Track in both local analytics and GA4
    trackEvent('feature_used', {
      feature,
      action,
      usageCount: currentUsage.count + 1,
      data
  });

    // ✅ AUTOMATICALLY SEND TO GA4
    try {
      ga4.trackFeature(feature, action);
    } catch (error) {
      console.warn('GA4 feature tracking failed:', error);
    }

    if (debugMode.current) {
      console.log(`📊 Feature Usage + GA4: ${feature} - ${action}`, data);
  }
}, [trackEvent, logIntegration, availableFeatures, ga4]);

  const getFeatureAnalytics = useCallback(() => {
    const totalFeatures = availableFeatures.size;
    const enabledFeatures = featureUsage.current.size;
    const featureAdoptionRate = totalFeatures > 0 ? enabledFeatures / totalFeatures : 0;

    return {
      enabledFeatures,
      totalFeatures,
      featureAdoptionRate
  };
}, [availableFeatures]);

  // Visual Editor Functions
  const addToHistory = useCallback(() => {
    setVisualEditorState(prev => {
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(prev.project);
      const updatedHistory = newHistory.slice(-50); // Keep only last 50 states
      
      return {
        ...prev,
        history: updatedHistory,
        historyIndex: Math.min(prev.historyIndex + 1, 49),
        canUndo: true,
        canRedo: false
    };
  });
}, []);

  const addElement = useCallback((element: EditorElement) => {
    // Only allow if user is authenticated and has admin role
    if (!authState.isAuthenticated || authState.user?.role !== 'admin') {
      console.warn('Visual Editor: Access denied - Admin role required');
      return;
  }
    
    // Check permission
    if (!hasPermission('visual-editor')) {
      console.warn('Visual Editor: Access denied - Visual editor permission required');
      return;
  }
    
    setVisualEditorState(prev => ({
      ...prev,
      project: {
        ...prev.project,
        elements: {
          ...prev.project.elements,
          [element.id]: element
      }
    },
      totalElementsCount: Object.keys(prev.project.elements).length + 1
  }));
    addToHistory();
    trackFeatureUsage('visual-editor','element_added', { 
      elementType: element.type,
      userId: authState.user?.id,
      userRole: authState.user?.role
  });
}, [addToHistory, trackFeatureUsage, authState.isAuthenticated, authState.user, hasPermission]);

  const updateElement = useCallback((elementId: string, updates: Partial<EditorElement>) => {
    // Only allow if user is authenticated and has admin role
    if (!authState.isAuthenticated || authState.user?.role !== 'admin') {
      console.warn('Visual Editor: Access denied - Admin role required');
      return;
  }
    
    // Check permission
    if (!hasPermission('visual-editor')) {
      console.warn('Visual Editor: Access denied - Visual editor permission required');
      return;
  }
    
    setVisualEditorState(prev => ({
      ...prev,
      project: {
        ...prev.project,
        elements: {
          ...prev.project.elements,
          [elementId]: {
            ...prev.project.elements[elementId],
            ...updates
        }
      }
    }
  }));
    addToHistory();
    trackFeatureUsage('visual-editor','element_updated', { 
      elementId,
      userId: authState.user?.id,
      userRole: authState.user?.role
  });
}, [addToHistory, trackFeatureUsage, authState.isAuthenticated, authState.user, hasPermission]);

  const deleteElement = useCallback((elementId: string) => {
    setVisualEditorState(prev => {
      const newElements = { ...prev.project.elements };
      delete newElements[elementId];
      return {
        ...prev,
        project: {
          ...prev.project,
          elements: newElements
      },
        selectedElements: prev.selectedElements.filter(id => id !== elementId),
        selectedElement: prev.selectedElement?.id === elementId ? null : prev.selectedElement,
        totalElementsCount: Object.keys(newElements).length
    };
  });
    addToHistory();
    trackFeatureUsage('visual-editor','element_deleted', { elementId });
}, [addToHistory, trackFeatureUsage]);

  const duplicateElement = useCallback((elementId: string) => {
    const element = visualEditorState.project.elements[elementId];
    if (element) {
      const newElement: EditorElement = {
        ...element,
        id: `element_${Date.now()}`,
        x: element.x + 20,
        y: element.y + 20
    };
      addElement(newElement);
  }
}, [visualEditorState.project.elements, addElement]);

  const selectElement = useCallback((elementId: string) => {
    if (elementId) {
      setVisualEditorState(prev => ({
        ...prev,
        selectedElements: [elementId],
        selectedElement: prev.project.elements[elementId] || null
    }));
  } else {
      setVisualEditorState(prev => ({
        ...prev,
        selectedElements: [],
        selectedElement: null
    }));
  }
}, []);

  const selectMultipleElements = useCallback((elementIds: string[]) => {
    setVisualEditorState(prev => ({
      ...prev,
      selectedElements: elementIds,
      selectedElement: null
  }));
}, []);

  const clearSelection = useCallback(() => {
    setVisualEditorState(prev => ({
      ...prev,
      selectedElements: [],
      selectedElement: null
  }));
}, []);

  const groupElements = useCallback((elementIds: string[]) => {
    if (elementIds.length < 2) return;

    const groupId = `group_${Date.now()}`;
    const elements = elementIds.map(id => visualEditorState.project.elements[id]).filter(Boolean);
    
    const groupElement: EditorElement = {
      id: groupId,
      type: 'container',
      x: Math.min(...elements.map(el => el.x)),
      y: Math.min(...elements.map(el => el.y)),
      width: Math.max(...elements.map(el => el.x + el.width)) - Math.min(...elements.map(el => el.x)),
      height: Math.max(...elements.map(el => el.y + el.height)) - Math.min(...elements.map(el => el.y)),
      styles: {
        border: '1px dashed #ccc',
        backgroundColor: 'rgba(00, 0.05)'
    },
      props: {},
      children: elementIds
  };

    setVisualEditorState(prev => {
      const updatedElements = { ...prev.project.elements };
      elementIds.forEach(id => {
        updatedElements[id] = {
          ...updatedElements[id],
          parent: groupId
      };
    });
      updatedElements[groupId] = groupElement;

      return {
        ...prev,
        project: {
          ...prev.project,
          elements: updatedElements
      },
        selectedElements: [groupId],
        selectedElement: groupElement
    };
  });

    addToHistory();
    trackFeatureUsage('visual-editor','elements_grouped', { elementCount: elementIds.length });
}, [visualEditorState.project.elements, addToHistory, trackFeatureUsage]);

  const ungroupElements = useCallback((groupId: string) => {
    const groupElement = visualEditorState.project.elements[groupId];
    if (groupElement && groupElement.children) {
      setVisualEditorState(prev => {
        const updatedElements = { ...prev.project.elements };
        
        groupElement.children!.forEach(childId => {
          if (updatedElements[childId]) {
            updatedElements[childId] = {
              ...updatedElements[childId],
              parent: undefined
          };
        }
      });

        delete updatedElements[groupId];

        return {
          ...prev,
          project: {
            ...prev.project,
            elements: updatedElements
        },
          selectedElements: [],
          selectedElement: null,
          totalElementsCount: Object.keys(updatedElements).length
      };
    });

      addToHistory();
      trackFeatureUsage('visual-editor','elements_ungrouped', { groupId });
  }
}, [visualEditorState.project.elements, addToHistory, trackFeatureUsage]);

  const alignElements = useCallback((elementIds: string[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (elementIds.length < 2) return;

    const elements = elementIds.map(id => visualEditorState.project.elements[id]).filter(Boolean);
    if (elements.length < 2) return;

    setVisualEditorState(prev => {
      const updatedElements = { ...prev.project.elements };

      switch (alignment) {
        case 'left':
          const leftX = Math.min(...elements.map(el => el.x));
          elements.forEach(el => {
            updatedElements[el.id] = { ...el, x: leftX };
        });
          break;
        case 'center':
          const centerX = Math.min(...elements.map(el => el.x)) + (Math.max(...elements.map(el => el.x + el.width)) - Math.min(...elements.map(el => el.x))) / 2;
          elements.forEach(el => {
            updatedElements[el.id] = { ...el, x: centerX - el.width / 2 };
        });
          break;
        case 'right':
          const rightX = Math.max(...elements.map(el => el.x + el.width));
          elements.forEach(el => {
            updatedElements[el.id] = { ...el, x: rightX - el.width };
        });
          break;
        case 'top':
          const topY = Math.min(...elements.map(el => el.y));
          elements.forEach(el => {
            updatedElements[el.id] = { ...el, y: topY };
        });
          break;
        case 'middle':
          const middleY = Math.min(...elements.map(el => el.y)) + (Math.max(...elements.map(el => el.y + el.height)) - Math.min(...elements.map(el => el.y))) / 2;
          elements.forEach(el => {
            updatedElements[el.id] = { ...el, y: middleY - el.height / 2 };
        });
          break;
        case 'bottom':
          const bottomY = Math.max(...elements.map(el => el.y + el.height));
          elements.forEach(el => {
            updatedElements[el.id] = { ...el, y: bottomY - el.height };
        });
          break;
    }

      return {
        ...prev,
        project: {
          ...prev.project,
          elements: updatedElements
      }
    };
  });

    addToHistory();
    trackFeatureUsage('visual-editor','elements_aligned', { alignment, elementCount: elementIds.length });
}, [visualEditorState.project.elements, addToHistory, trackFeatureUsage]);

  const undo = useCallback(() => {
    setVisualEditorState(prev => {
      if (prev.historyIndex > 0) {
        const newIndex = prev.historyIndex - 1;
        return {
          ...prev,
          project: prev.history[newIndex],
          historyIndex: newIndex,
          canUndo: newIndex > 0,
          canRedo: true
      };
    }
      return prev;
  });
    trackFeatureUsage('visual-editor','undo');
}, [trackFeatureUsage]);

  const redo = useCallback(() => {
    setVisualEditorState(prev => {
      if (prev.historyIndex < prev.history.length - 1) {
        const newIndex = prev.historyIndex + 1;
        return {
          ...prev,
          project: prev.history[newIndex],
          historyIndex: newIndex,
          canUndo: true,
          canRedo: newIndex < prev.history.length - 1
      };
    }
      return prev;
  });
    trackFeatureUsage('visual-editor','redo');
}, [trackFeatureUsage]);

  const zoomIn = useCallback(() => {
    setVisualEditorState(prev => ({
      ...prev,
      canvasZoom: Math.min(prev.canvasZoom * 1.2, 5)
  }));
}, []);

  const zoomOut = useCallback(() => {
    setVisualEditorState(prev => ({
      ...prev,
      canvasZoom: Math.max(prev.canvasZoom / 1.2, 0.1)
  }));
}, []);

  const resetZoom = useCallback(() => {
    setVisualEditorState(prev => ({
      ...prev,
      canvasZoom: 1,
      canvasPan: { x: 0, y: 0 }
  }));
}, []);

  const fitToScreen = useCallback(() => {
    setVisualEditorState(prev => ({
      ...prev,
      canvasZoom: Math.min(1, 1), // Simplified for now
      canvasPan: { x: 0, y: 0 }
  }));
}, []);

  const startDrag = useCallback((componentType: string) => {
    setVisualEditorState(prev => ({
      ...prev,
      isDragging: true,
      draggedComponent: componentType
  }));
}, []);

  const endDrag = useCallback(() => {
    setVisualEditorState(prev => ({
      ...prev,
      isDragging: false,
      draggedComponent: null
  }));
}, []);

  const handleDrop = useCallback((position: { x: number; y: number }) => {
    if (visualEditorState.draggedComponent) {
      const newElement: EditorElement = {
        id: `element_${Date.now()}`,
        type: visualEditorState.draggedComponent as any,
        x: position.x,
        y: position.y,
        width: 100,
        height: 40,
        styles: {},
        props: {}
    };
      addElement(newElement);
      selectElement(newElement.id);
  }
    endDrag();
}, [visualEditorState.draggedComponent, addElement, selectElement, endDrag]);

  const saveProject = useCallback(async () => {
    setVisualEditorState(prev => ({ ...prev, isSaving: true }));

    addSentryBreadcrumb({
      category: 'visual-editor',
      message: 'Saving project',
      level: 'info',
      data: {
        projectId: visualEditorState.project.id,
      },
    });

    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate save
      trackFeatureUsage('visual-editor', 'project_saved', { projectId: visualEditorState.project.id });

      addSentryBreadcrumb({
        category: 'visual-editor',
        message: 'Project saved successfully',
        level: 'info',
      });

      return true;
  } catch (error) {
      console.error('Save failed:', error);

      // Capture error to Sentry
      captureErrorToSentry(error as Error, {
        context: 'visual-editor',
        action: 'save-project',
        projectId: visualEditorState.project.id,
      });

      return false;
  } finally {
      setVisualEditorState(prev => ({ ...prev, isSaving: false }));
  }
}, [visualEditorState.project.id, trackFeatureUsage]);

  // ============================================================================
  // ✅ GA4-INTEGRATED SPECIALIZED TRACKING METHODS
  // ============================================================================
  // These methods automatically track to BOTH local analytics AND Google Analytics 4
  // Components just call these simple methods - GA4 tracking happens automatically!
  
  const trackUserRegistration = useCallback((source?: string, campaignId?: string) => {
    // Track locally
    trackEvent('user_registration', { source, campaignId });
    
    // ✅ AUTOMATICALLY TRACK IN GA4
    try {
      ga4.trackUserRegistration(source || 'organic', campaignId);
      console.log('✅ User registration tracked in GA4:', { source, campaignId });
    } catch (error) {
      console.warn('GA4 registration tracking failed:', error);
    }
  }, [trackEvent, ga4]);

  const trackOnboardingStep = useCallback((stepNumber: number, stepName: string) => {
    // Track locally
    trackEvent('onboarding_step', { stepNumber, stepName });
    
    // ✅ AUTOMATICALLY TRACK IN GA4
    try {
      ga4.trackOnboarding(stepNumber, stepName);
      console.log('✅ Onboarding step tracked in GA4:', { stepNumber, stepName });
    } catch (error) {
      console.warn('GA4 onboarding tracking failed:', error);
    }
  }, [trackEvent, ga4]);

  const trackOnboardingComplete = useCallback(() => {
    // Track locally
    trackEvent('onboarding_complete', {});
    
    // ✅ AUTOMATICALLY TRACK IN GA4
    try {
      ga4.trackOnboardingComplete();
      console.log('✅ Onboarding complete tracked in GA4');
    } catch (error) {
      console.warn('GA4 onboarding complete tracking failed:', error);
    }
  }, [trackEvent, ga4]);

  const trackSubscriptionStart = useCallback((tier: string) => {
    // Track locally
    trackEvent('subscription_start', { tier });
    
    // ✅ AUTOMATICALLY TRACK IN GA4
    try {
      ga4.trackSubscriptionStart(tier);
      console.log('✅ Subscription start tracked in GA4:', { tier });
    } catch (error) {
      console.warn('GA4 subscription start tracking failed:', error);
    }
  }, [trackEvent, ga4]);

  const trackSubscriptionComplete = useCallback((params: { tier: string; price: number; paymentMethod?: string }) => {
    // Track locally
    trackEvent('subscription_complete', params);
    
    // ✅ AUTOMATICALLY TRACK IN GA4 (REVENUE!)
    try {
      ga4.trackSubscriptionComplete(params);
      console.log('✅ Subscription complete tracked in GA4 (REVENUE):', params);
    } catch (error) {
      console.warn('GA4 subscription complete tracking failed:', error);
    }
  }, [trackEvent, ga4]);

  const trackProjectCreated = useCallback((projectType: string) => {
    // Track locally
    trackEvent('project_created', { projectType });
    
    // ✅ AUTOMATICALLY TRACK IN GA4
    try {
      ga4.trackProject('created', { projectType });
      console.log('✅ Project created tracked in GA4:', { projectType });
    } catch (error) {
      console.warn('GA4 project tracking failed:', error);
    }
  }, [trackEvent, ga4]);

  const trackProjectCompleted = useCallback((projectType: string, durationDays?: number) => {
    // Track locally
    trackEvent('project_completed', { projectType, durationDays });
    
    // ✅ AUTOMATICALLY TRACK IN GA4
    try {
      ga4.trackProject('completed', { projectType, durationDays });
      console.log('✅ Project completed tracked in GA4:', { projectType, durationDays });
    } catch (error) {
      console.warn('GA4 project tracking failed:', error);
    }
  }, [trackEvent, ga4]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    // Core systems will be provided by the nested providers
    integration: {} as any,
    communication: {} as any,
    dataFlow: {} as any,
    componentRegistry: {} as any,
    
    // Enhanced features
    health,
    analytics: {
      trackEvent,
      getMetrics,
      clearMetrics,
      
      // ✅ GA4-integrated specialized tracking (automatic GA4 + local)
      trackUserRegistration,
      trackOnboardingStep,
      trackOnboardingComplete,
      trackSubscriptionStart,
      trackSubscriptionComplete,
      trackProjectCreated,
      trackProjectCompleted
  },
    debugging: {
      enableDebugMode: enableDebugModeUtil,
      getDebugInfo,
      logIntegration
  },
    performance: {
      startTiming,
      getPerformanceMetrics: () => Object.fromEntries(performanceMetrics.current),
      optimize
  },
    lifecycle: {
      registerComponent,
      unregisterComponent,
      getComponentInfo,
      getAllComponents
  },
    features: {
      checkFeatureAccess,
      trackFeatureUsage,
      getFeatureAnalytics
  },
    
    // Authentication and user management
    auth: {
      state: authState,
      login,
      logout,
      refreshToken,
      getUserProfile,
      hasPermission,
      hasRole,
      getAuthHeader: async () => {
        // Get the auth header for API calls
        const authHeader = await getAuthHeaderFromToken();
        return authHeader || { 'Authorization': `Bearer ${authState.token || ', '}` };
      },
      getAuthenticatedClient: async (scopes?: string[]) => {
        // Get authenticated Google API client
        return await getAuthenticatedClientFromToken(scopes);
      }
  },
    
    // LinkedIn Authentication
    linkedIn: {
      state: linkedInAuthState,
      login: linkedInLogin,
      logout: linkedInLogout,
      syncProfile: linkedInSyncProfile,
      getProfile: getLinkedInProfile
  },
    
    // Visual Editor (Admin Only - Hidden for others)
    visualEditor: (authState.isAuthenticated && authState.user?.role === 'admin' && hasPermission('visual-editor')) ? {
      state: visualEditorState,
      addElement,
      updateElement,
      deleteElement,
      duplicateElement,
      selectElement,
      selectMultipleElements,
      clearSelection,
      groupElements,
      ungroupElements,
      alignElements,
      undo,
      redo,
      zoomIn,
      zoomOut,
      resetZoom,
      fitToScreen,
      startDrag,
      endDrag,
      handleDrop,
      saveProject,
      setExtendedThinking: (enabled: boolean) => setVisualEditorState(prev => ({ ...prev, extendedThinking: enabled })),
      setHighPowerMode: (enabled: boolean) => setVisualEditorState(prev => ({ ...prev, highPowerMode: enabled })),
      setShowGrid: (enabled: boolean) => setVisualEditorState(prev => ({ ...prev, showGrid: enabled })),
      setSnapToGrid: (enabled: boolean) => setVisualEditorState(prev => ({ ...prev, snapToGrid: enabled })),
      setMultiSelectMode: (enabled: boolean) => setVisualEditorState(prev => ({ ...prev, multiSelectMode: enabled })),
      setGridSize: (size: number) => setVisualEditorState(prev => ({ ...prev, gridSize: size })),
      setCanvasZoom: (zoom: number) => setVisualEditorState(prev => ({ ...prev, canvasZoom: zoom })),
      setCanvasPan: (pan: { x: number; y: number }) => setVisualEditorState(prev => ({ ...prev, canvasPan: pan })),
      setShowRulers: (enabled: boolean) => setVisualEditorState(prev => ({ ...prev, showRulers: enabled }))
  } : {
      // Hidden interface for non-admin users - no visual editor access
      state: {
        project: { id: ', ', name: ', ', elements: {}, pageSettings: { width: 0, height: 0, backgroundColor: '#ffffff' } },
        selectedElements: [],
        selectedElement: null,
        extendedThinking: false,
        highPowerMode: false,
        showGrid: false,
        snapToGrid: false,
        multiSelectMode: false,
        gridSize: 20,
        canvasZoom: 1,
        canvasPan: { x: 0, y: 0 },
        showRulers: false,
        isDragging: false,
        draggedComponent: null,
        isSaving: false,
        history: [],
        historyIndex: -1,
        canUndo: false,
        canRedo: false,
        totalElementsCount: 0
    },
      addElement: () => { /* Hidden - no access */ },
      updateElement: () => { /* Hidden - no access */ },
      deleteElement: () => { /* Hidden - no access */ },
      duplicateElement: () => { /* Hidden - no access */ },
      selectElement: () => { /* Hidden - no access */ },
      selectMultipleElements: () => { /* Hidden - no access */ },
      clearSelection: () => { /* Hidden - no access */ },
      groupElements: () => { /* Hidden - no access */ },
      ungroupElements: () => { /* Hidden - no access */ },
      alignElements: () => { /* Hidden - no access */ },
      undo: () => { /* Hidden - no access */ },
      redo: () => { /* Hidden - no access */ },
      zoomIn: () => { /* Hidden - no access */ },
      zoomOut: () => { /* Hidden - no access */ },
      resetZoom: () => { /* Hidden - no access */ },
      fitToScreen: () => { /* Hidden - no access */ },
      startDrag: () => { /* Hidden - no access */ },
      endDrag: () => { /* Hidden - no access */ },
      handleDrop: () => { /* Hidden - no access */ },
      saveProject: () => { /* Hidden - no access */ },
      setExtendedThinking: () => { /* Hidden - no access */ },
      setHighPowerMode: () => { /* Hidden - no access */ },
      setShowGrid: () => { /* Hidden - no access */ },
      setSnapToGrid: () => { /* Hidden - no access */ },
      setMultiSelectMode: () => { /* Hidden - no access */ },
      setGridSize: () => { /* Hidden - no access */ },
      setCanvasZoom: () => { /* Hidden - no access */ },
      setCanvasPan: () => { /* Hidden - no access */ },
      setShowRulers: () => { /* Hidden - no access */ }
  }
}), [
    health,
    trackEvent,
    getMetrics,
    clearMetrics,
    trackUserRegistration,
    trackOnboardingStep,
    trackOnboardingComplete,
    trackSubscriptionStart,
    trackSubscriptionComplete,
    trackProjectCreated,
    trackProjectCompleted,
    enableDebugModeUtil,
    getDebugInfo,
    logIntegration,
    startTiming,
    optimize,
    registerComponent,
    unregisterComponent,
    getComponentInfo,
    getAllComponents,
    checkFeatureAccess,
    trackFeatureUsage,
    getFeatureAnalytics,
    visualEditorState,
    addElement,
    updateElement,
    deleteElement,
    duplicateElement,
    selectElement,
    selectMultipleElements,
    clearSelection,
    groupElements,
    ungroupElements,
    alignElements,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToScreen,
    startDrag,
    endDrag,
    handleDrop,
    saveProject,
    authState,
    login,
    logout,
    refreshToken,
    getUserProfile,
    hasPermission,
    hasRole
  ]);

  return (
    <IntegrationProvider>
      <CommunicationProvider>
        <DataFlowProvider>
          <ComponentRegistryProvider>
            <UniversalIntegrationSystem>
              <EnhancedIntegrationWrapper baseContext={contextValue}>
                {children}
              </EnhancedIntegrationWrapper>
            </UniversalIntegrationSystem>
          </ComponentRegistryProvider>
        </DataFlowProvider>
      </CommunicationProvider>
    </IntegrationProvider>
  );
};

// Wrapper component that provides the actual integration systems
const EnhancedIntegrationWrapper: React.FC<{
  children: React.ReactNode;
  baseContext: Omit<MasterIntegrationContextType, 'integration' | 'communication' | 'dataFlow' | 'componentRegistry'>;
}> = ({ children, baseContext }) => {
  const integration = useIntegration();
  const communication = useCommunication();
  const dataFlow = useDataFlow();
  const componentRegistry = useComponentRegistry();

  // Merge runtime integration systems with the rich base context and
  // enhance debugging with live registry + feature integration data.
  const enhancedContext = useMemo<MasterIntegrationContextType>(() => {
    const { debugging, ...restBaseContext } = baseContext;

    const enhancedDebugging = {
      ...debugging,
      getDebugInfo: () => {
        const baseDebugInfo = typeof debugging?.getDebugInfo === 'function'
          ? debugging.getDebugInfo()
          : {};

        // Pull latest state from the universal component registry
        const allComponents = (componentRegistry as any)?.getAllComponents?.() ?? [];
        const missingPropsComponents = (componentRegistry as any)?.getComponentsMissingProps?.() ?? [];

        const registryById = new Map<string, any>(
          allComponents.map((c: any) => [c.id, c])
        );

        // Compute feature → component coverage using the manual map
        const featureStatuses = Object.entries(FEATURE_COMPONENT_MAP).map(
          ([featureId, mappedComponentIds]) => {
            const registeredComponentIds = mappedComponentIds.filter((id) =>
              registryById.has(id)
            );

            const missingComponentIds = mappedComponentIds.filter(
              (id) => !registryById.has(id)
            );

            const componentsMissingPropsForFeature = missingPropsComponents
              .filter((c: any) => mappedComponentIds.includes(c.id))
              .map((c: any) => c.id);

            let status: 'missing' | 'partial' | 'implemented' = 'missing';
            if (registeredComponentIds.length > 0) status = 'partial';
            if (
              registeredComponentIds.length === mappedComponentIds.length &&
              componentsMissingPropsForFeature.length === 0
            ) {
              status = 'implemented';
            }

            return {
              featureId,
              mappedComponentIds,
              registeredComponentIds,
              missingComponentIds,
              componentsMissingProps: componentsMissingPropsForFeature,
              status,
            };
          }
        );

        // Derive set of all features present in the profession feature matrix
        const matrixFeatures = new Set<string>();
        Object.values(PROFESSION_FEATURE_MATRIX).forEach((config: any) => {
          Object.keys(config?.availableFeatures ?? {}).forEach((featureId) => {
            matrixFeatures.add(featureId);
          });
        });

        const mappedFeatureIds = new Set(Object.keys(FEATURE_COMPONENT_MAP));
        const unmappedMatrixFeatures = Array.from(matrixFeatures).filter(
          (featureId) => !mappedFeatureIds.has(featureId)
        );

	        // Automatic feature → component coverage derived from registry metadata
	        const implementingByFeature: Record<string, string[]> = {};
	        allComponents.forEach((c: any) => {
	          const featureIds = Array.isArray((c as any).features)
	            ? (c as any).features
	            : [];

	          featureIds.forEach((fid: string) => {
	            if (!implementingByFeature[fid]) implementingByFeature[fid] = [];
	            implementingByFeature[fid].push(c.id);
	          });
	        });

	        const allFeatureIds = new Set<string>([
	          ...Array.from(matrixFeatures),
	          ...Object.keys(FEATURE_COMPONENT_MAP),
	        ]);

        const autoFeatureStatuses = Array.from(allFeatureIds).map((featureId) => {
	          const autoComponentIds = implementingByFeature[featureId] || [];
	          const manualComponentIds = FEATURE_COMPONENT_MAP[featureId] || [];
	          const mappedComponentIds = Array.from(
	            new Set([...autoComponentIds, ...manualComponentIds])
	          );

	          const registeredComponentIds = mappedComponentIds.filter((id) =>
	            registryById.has(id)
	          );

	          const missingComponentIds = mappedComponentIds.filter(
	            (id) => !registryById.has(id)
	          );

	          const componentsMissingPropsForFeature = missingPropsComponents
	            .filter((c: any) => mappedComponentIds.includes(c.id))
	            .map((c: any) => c.id);

          let status: 'unmapped' | 'missing' | 'partial' | 'implemented' = 'unmapped';

	          if (mappedComponentIds.length > 0) {
	            status = 'missing';
	            if (registeredComponentIds.length > 0) {
	              status = 'partial';
	            }
	            if (
	              registeredComponentIds.length === mappedComponentIds.length &&
	              componentsMissingPropsForFeature.length === 0
	            ) {
	              status = 'implemented';
	            }
	          }

          const metadata = getFeatureMetadata(featureId);

          return {
	            featureId,
	            mappedComponentIds,
	            registeredComponentIds,
	            missingComponentIds,
	            componentsMissingProps: componentsMissingPropsForFeature,
            status,
            metadata,
	          };
	        });

	        const autoIntegrationGaps = {
	          features: autoFeatureStatuses,
	          unmappedMatrixFeatures,
	        };

        return {
          ...baseDebugInfo,
          registry: {
            components: allComponents,
            missingPropsComponents,
          },
          integrationGaps: {
            features: featureStatuses,
            unmappedMatrixFeatures,
          },
	          autoIntegrationGaps,
        };
      },
    };

    return {
      ...restBaseContext,
      integration,
      communication,
      dataFlow,
      componentRegistry,
      debugging: enhancedDebugging,
    };
  }, [baseContext, integration, communication, dataFlow, componentRegistry]);

  return (
    <MasterIntegrationContext.Provider value={enhancedContext}>
      {children}
    </MasterIntegrationContext.Provider>
  );
};

// Enhanced hook with additional features
export const useEnhancedMasterIntegration = () => {
  const context = useContext(MasterIntegrationContext);
  if (!context) {
    throw new Error('useEnhancedMasterIntegration must be used within EnhancedMasterIntegrationProvider');
}
  return context;
};

// Backward compatibility
export const useMasterIntegration = useEnhancedMasterIntegration;

// Enhanced HOC with performance monitoring
export const withEnhancedMasterIntegration = <P extends object>(
  Component: React.ComponentType<P>,
  options: {
    componentId?: string;
    componentType?: string;
    capabilities?: string[];
    enablePerformanceMonitoring?: boolean;
    enableDebugLogging?: boolean;
} = {}
) => {
  return React.forwardRef<any, P>((props, ref) => {
    const { 
      componentId = options.componentId || Component.displayName || 'Unknown',
      componentType = options.componentType || 'component',
      capabilities = options.capabilities || [],
      integrationEnabled = true
  } = props as any;
    
    const { 
      lifecycle, 
      performance, 
      debugging, 
      analytics 
  } = useEnhancedMasterIntegration();
    
    const renderCount = useRef(0);
    
    // Performance monitoring
    useEffect(() => {
      if (options.enablePerformanceMonitoring) {
        renderCount.current++;
        
        const endTiming = performance.startTiming(`render_${componentId}`);
        
        return () => {
          endTiming();
      };
    }
  });
    
    // Component registration
    useEffect(() => {
      if (integrationEnabled) {
        lifecycle.registerComponent({
          id: componentId,
          type: componentType,
          version: '1.0.0',
          capabilities: {
            data: capabilities.filter((c: string) => c.startsWith('data:')),
            events: capabilities.filter((c: string) => c.startsWith('event:')),
            actions: capabilities.filter((c: string) => c.startsWith('action:')),
            ui: capabilities.filter((c: string) => c.startsWith('ui:')),
            system: capabilities.filter((c: string) => c.startsWith('system:'))
        },
          dependencies: [],
          lastActive: Date.now(),
          performance: {
            renderCount: renderCount.current,
            avgRenderTime: 0,
            memoryUsage: 0
        }
      });
        
        analytics.trackEvent('component_mounted', { componentId, componentType });
        
        return () => {
          lifecycle.unregisterComponent(componentId);
          analytics.trackEvent('component_unmounted', { componentId, componentType });
      };
    }
  }, [componentId, componentType, capabilities, integrationEnabled, lifecycle, analytics]);
    
    // Debug logging
    useEffect(() => {
      if (options.enableDebugLogging) {
        debugging.logIntegration('info', `Component ${componentId} rendered`, {
          renderCount: renderCount.current,
          props: Object.keys(props)
      });
    }
  });
    
    if (!integrationEnabled) {
      return <Component {...(props as P)} ref={ref} />;
  }

    return <Component {...(props as P)} ref={ref} />;
});
};

// Enhanced integration configurations
export const ENHANCED_INTEGRATION_CONFIGS = {
  ...INTEGRATION_CONFIGS,
  
  // Google Services
  GOOGLE_SERVICE: {
    componentType: 'google-service',
    capabilities: [
      'data:read','data:write','event:emit','event:listen','action:execute','ui:update','google:api:call','google:auth:manage','google:sync:data'
    ],
    dataKeys: [
      'googleAuth','googleData','googleSettings','googleStatus'
    ],
    messageTypes: [
      'google:auth:success','google:auth:failed','google:data:synced','google:api:error'
    ]
},
  
  // AI Services
  AI_SERVICE: {
    componentType: 'ai-service',
    capabilities: [
      'data:read','data:write','event:emit','event:listen','action:execute','ai:process','ai:generate','ai:analyze'
    ],
    dataKeys: [
      'aiModels','aiResults','aiSettings','aiStatus'
    ],
    messageTypes: [
      'ai:processing:start','ai:processing:complete','ai:processing:error', 'ai:model:loaded'
    ]
},

  // Evendi Service (Bookings, Users, Analytics)
  EVENDI_SERVICE: {
    componentType: 'evendi-service',
    capabilities: [
      'data:read','data:write','event:emit','event:listen','action:execute',
      'evendi:bookings:list','evendi:bookings:create','evendi:bookings:update','evendi:bookings:delete',
      'evendi:users:list','evendi:analytics:summary'
    ],
    dataKeys: [
      'evendiBookings','evendiUsers','evendiAnalytics','evendiStatus'
    ],
    messageTypes: [
      'evendi:booking:created','evendi:booking:updated','evendi:booking:deleted',
      'evendi:data:synced','evendi:api:error'
    ]
  },

  // Enterprise Team Service (Combined Photo+Video, Team Management)
  ENTERPRISE_SERVICE: {
    componentType: 'enterprise-service',
    capabilities: [
      'data:read','data:write','event:emit','event:listen','action:execute',
      'enterprise:team:manage','enterprise:team:members','enterprise:team:roles',
      'enterprise:projects:combined','enterprise:photo:suite','enterprise:video:suite',
      'enterprise:analytics:team','enterprise:showcase:portfolio',
      'enterprise:billing:manage','enterprise:subscription:manage'
    ],
    dataKeys: [
      'enterpriseTeam','enterpriseMembers','enterpriseProjects',
      'enterpriseAnalytics','enterpriseSubscription','enterpriseBilling'
    ],
    messageTypes: [
      'enterprise:team:updated','enterprise:member:added','enterprise:member:removed',
      'enterprise:project:assigned','enterprise:billing:changed',
      'enterprise:subscription:updated','enterprise:api:error'
    ]
  }
};

// Error boundary for integration failures
export class IntegrationErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
}

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
}

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Integration Error:', error, errorInfo);

    // Capture error to Sentry
    captureErrorToSentry(error, {
      componentStack: errorInfo.componentStack,
      context: 'integration-error-boundary',
      errorInfo,
    });

    // Add breadcrumb
    addSentryBreadcrumb({
      category: 'error-boundary',
      message: 'Integration error caught',
      level: 'error',
      data: {
        errorMessage: error.message,
        errorName: error.name,
      },
    });
}

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || (() => (
        <div style={{ padding: '20px', border: '1px solid #ff6b6b', borderRadius: '4px', backgroundColor:'#ffe0e0' }}>
          <h3>Integration Error</h3>
          <p>Something went wrong with the integration system.</p>
          <details>
            <summary>Error Details</summary>
            <pre>{this.state.error?.stack}</pre>
          </details>
        </div>
      ));
      
      return <FallbackComponent error={this.state.error!} />;
  }

    return this.props.children;
}
}

export default EnhancedMasterIntegrationProvider;
