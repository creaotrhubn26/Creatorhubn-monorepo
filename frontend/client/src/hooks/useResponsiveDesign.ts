/**
 * useResponsiveDesign Hook
 * React hook for responsive design functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  responsiveDesignManager, 
  ResponsiveConfig, 
  ResponsiveState 
} from '../utils/responsiveDesignManager';

export interface UseResponsiveDesignOptions {
  config?: Partial<ResponsiveConfig>;
  onBreakpointChanged?: (data: { breakpoint: string }) => void;
  onOrientationChanged?: (data: { orientation: 'portrait' | 'landscape',}) => void;
  onViewportChanged?: (data: { viewport: { width: number; height: number; scale: number } }) => void;
  onDeviceTypeChanged?: (data: { deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown',}) => void;
  onTouchSupportChanged?: (data: { touchSupport: boolean }) => void;
  onAccessibilityMetricsChanged?: (data: { metrics: ResponsiveState['accessibilityMetrics', ],}) => void;
  onElementResized?: (data: { element: Element; size: DOMRectReadOnly }) => void;
  onElementVisible?: (data: { element: Element }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void
}

export interface UseResponsiveDesignReturn {
  state: ResponsiveState;
  config: ResponsiveConfig;
  updateConfig: (config: Partial<ResponsiveConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  currentBreakpoint: string;
  currentOrientation: 'portrait' | 'landscape';
  currentViewport: { width: number; height: number; scale: number };
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  touchSupport: boolean;
  orientationSupport: boolean;
  viewportSupport: boolean;
  performanceMetrics: ResponsiveState['performanceMetrics'];
  accessibilityMetrics: ResponsiveState['accessibilityMetrics'];
  totalBreakpointChanges: number;
  totalOrientationChanges: number;
  totalViewportChanges: number;
  totalPerformanceIssues: number;
  totalAccessibilityIssues: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  isXxl: boolean
}

/**
 * Hook for responsive design functionality
 */
export const useResponsiveDesign = (options: UseResponsiveDesignOptions = {}): UseResponsiveDesignReturn => {
  const {
    config = {},
    onBreakpointChanged,
    onOrientationChanged,
    onViewportChanged,
    onDeviceTypeChanged,
    onTouchSupportChanged,
    onAccessibilityMetricsChanged,
    onElementResized,
    onElementVisible,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<ResponsiveState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    currentBreakpoint: 'xs',
    currentOrientation: 'portrait',
    currentViewport: {
      width:, 0,
      height:  0,
      scale: 1
},
    deviceType: 'unknown',
    touchSupport: false,
    orientationSupport: false,
    viewportSupport: false,
    performanceMetrics: {
      layoutShift:, 0,
      firstContentfulPaint:  0,
      largestContentfulPaint:  0,
      firstInputDelay:  0,
      cumulativeLayoutShift: 0
},
    accessibilityMetrics: {
      colorContrast:, 0,
      textSize:  16,
      focusVisibility: false,
      keyboardNavigation: false,
      screenReaderSupport: false
},
    lastUpdate:  0,
    totalBreakpointChanges:  0,
    totalOrientationChanges:  0,
    totalViewportChanges:  0,
    totalPerformanceIssues:  0,
    totalAccessibilityIssues: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize responsive design manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      responsiveDesignManager.updateConfig(config);
  }

    // Setup event handlers
    const handleBreakpointChanged = (data: { breakpoint: string }) => {
      if (onBreakpointChanged) {
        onBreakpointChanged(data);
    }
  };

    const handleOrientationChanged = (data: { orientation: 'portrait' | 'landscape',}) => {
      if (onOrientationChanged) {
        onOrientationChanged(data);
    }
  };

    const handleViewportChanged = (data: { viewport: { width: number; height: number; scale: number } }) => {
      if (onViewportChanged) {
        onViewportChanged(data);
    }
  };

    const handleDeviceTypeChanged = (data: { deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown',}) => {
      if (onDeviceTypeChanged) {
        onDeviceTypeChanged(data);
    }
  };

    const handleTouchSupportChanged = (data: { touchSupport: boolean }) => {
      if (onTouchSupportChanged) {
        onTouchSupportChanged(data);
    }
  };

    const handleAccessibilityMetricsChanged = (data: { metrics: ResponsiveState['accessibilityMetrics', ],}) => {
      if (onAccessibilityMetricsChanged) {
        onAccessibilityMetricsChanged(data);
    }
  };

    const handleElementResized = (data: { element: Element; size: DOMRectReadOnly }) => {
      if (onElementResized) {
        onElementResized(data);
    }
  };

    const handleElementVisible = (data: { element: Element }) => {
      if (onElementVisible) {
        onElementVisible(data);
    }
  };

    const handleError = (data: { error: string }) => {
      if (onError) {
        onError(data.error);
    }
  };

    const handleInitialized = () => {
      if (onInitialized) {
        onInitialized();
    }
  };

    // Store event handlers
    eventHandlersRef.current.set('breakpoint_changed', handleBreakpointChanged);
    eventHandlersRef.current.set('orientation_changed', handleOrientationChanged);
    eventHandlersRef.current.set('viewport_changed', handleViewportChanged);
    eventHandlersRef.current.set('device_type_changed', handleDeviceTypeChanged);
    eventHandlersRef.current.set('touch_support_changed', handleTouchSupportChanged);
    eventHandlersRef.current.set('accessibility_metrics_changed', handleAccessibilityMetricsChanged);
    eventHandlersRef.current.set('element_resized', handleElementResized);
    eventHandlersRef.current.set('element_visible', handleElementVisible);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    responsiveDesignManager.on('breakpoint_changed', handleBreakpointChanged);
    responsiveDesignManager.on('orientation_changed', handleOrientationChanged);
    responsiveDesignManager.on('viewport_changed', handleViewportChanged);
    responsiveDesignManager.on('device_type_changed', handleDeviceTypeChanged);
    responsiveDesignManager.on('touch_support_changed', handleTouchSupportChanged);
    responsiveDesignManager.on('accessibility_metrics_changed', handleAccessibilityMetricsChanged);
    responsiveDesignManager.on('element_resized', handleElementResized);
    responsiveDesignManager.on('element_visible', handleElementVisible);
    responsiveDesignManager.on('error', handleError);
    responsiveDesignManager.on('initialized', handleInitialized);

    // Update initial state
    setState(responsiveDesignManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        responsiveDesignManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onBreakpointChanged, onOrientationChanged, onViewportChanged, onDeviceTypeChanged, onTouchSupportChanged, onAccessibilityMetricsChanged, onElementResized, onElementVisible, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = responsiveDesignManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<ResponsiveConfig>) => {
    responsiveDesignManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const config = useMemo(() => {
    return responsiveDesignManager.getConfig();
}, []);

  // Computed values
  const isMobile = useMemo(() => state.deviceType === 'mobile', [state.deviceType]);
  const isTablet = useMemo(() => state.deviceType === 'tablet', [state.deviceType]);
  const isDesktop = useMemo(() => state.deviceType === 'desktop', [state.deviceType]);
  const isPortrait = useMemo(() => state.currentOrientation === 'portrait', [state.currentOrientation]);
  const isLandscape = useMemo(() => state.currentOrientation === 'landscape', [state.currentOrientation]);
  const isXs = useMemo(() => state.currentBreakpoint === 'xs', [state.currentBreakpoint]);
  const isSm = useMemo(() => state.currentBreakpoint === 'sm', [state.currentBreakpoint]);
  const isMd = useMemo(() => state.currentBreakpoint === 'md', [state.currentBreakpoint]);
  const isLg = useMemo(() => state.currentBreakpoint === 'lg', [state.currentBreakpoint]);
  const isXl = useMemo(() => state.currentBreakpoint === 'xl', [state.currentBreakpoint]);
  const isXxl = useMemo(() => state.currentBreakpoint ==='xxl', [state.currentBreakpoint]);

  // Memoized return value
  const returnValue = useMemo(() => ({
    state,
    config,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    currentBreakpoint: state.currentBreakpoint,
    currentOrientation: state.currentOrientation,
    currentViewport: state.currentViewport,
    deviceType: state.deviceType,
    touchSupport: state.touchSupport,
    orientationSupport: state.orientationSupport,
    viewportSupport: state.viewportSupport,
    performanceMetrics: state.performanceMetrics,
    accessibilityMetrics: state.accessibilityMetrics,
    totalBreakpointChanges: state.totalBreakpointChanges,
    totalOrientationChanges: state.totalOrientationChanges,
    totalViewportChanges: state.totalViewportChanges,
    totalPerformanceIssues: state.totalPerformanceIssues,
    totalAccessibilityIssues: state.totalAccessibilityIssues,
    isMobile,
    isTablet,
    isDesktop,
    isPortrait,
    isLandscape,
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    isXxl
}), [
    state,
    config,
    updateConfig,
    isMobile,
    isTablet,
    isDesktop,
    isPortrait,
    isLandscape,
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    isXxl
  ]);

  return returnValue;
};

export default useResponsiveDesign;





