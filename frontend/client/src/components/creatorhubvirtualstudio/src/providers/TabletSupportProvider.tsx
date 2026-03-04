/**
 * TabletSupportProvider - Comprehensive iPad/tablet support for Virtual Studio
 * 
 * Provides:
 * - Device detection context
 * - Touch/mouse interaction switching
 * - Apple Pencil context
 * - Responsive layout helpers
 * - Gesture handlers for common patterns
 * - Tablet-optimized navigation
 */

import type {
  ReactNode} from 'react';
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef
} from 'react';
import type { DeviceInfo} from '../hooks/useDeviceDetection';
import { useDeviceDetection, DeviceType } from '../hooks/useDeviceDetection';
import type { PencilState} from '../hooks/useApplePencil';
import { useApplePencil, InputType } from '../hooks/useApplePencil';

// =============================================================================
// Types
// =============================================================================

export type LayoutMode = 'desktop' | 'tablet-landscape' | 'tablet-portrait' | 'mobile';
export type InteractionMode = 'mouse' | 'touch' | 'pencil';
export type PanelPosition = 'left' | 'right' | 'bottom' | 'floating' | 'fullscreen';

export interface TabletLayout {
  mode: LayoutMode;
  sidebarPosition: PanelPosition;
  toolbarPosition: 'top' | 'bottom' | 'floating';
  showMinimap: boolean;
  panelWidth: number;
  touchTargetSize: number; // Minimum touch target in px
  spacing: number; // Base spacing unit
}

export interface GestureConfig {
  enablePinchZoom: boolean;
  enableTwoFingerPan: boolean;
  enableSwipeNavigation: boolean;
  enableLongPressMenu: boolean;
  enableDoubleTap: boolean;
  swipeThreshold: number;
  longPressDuration: number;
}

export interface TabletSupportContextValue {
  // Device info
  device: DeviceInfo;
  isTablet: boolean;
  isIPad: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  
  // Interaction mode
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;
  
  // Layout
  layout: TabletLayout;
  setLayoutMode: (mode: LayoutMode) => void;
  
  // Apple Pencil
  pencilState: PencilState | null;
  isPencilActive: boolean;
  isPencilConnected: boolean;
  
  // Gesture config
  gestureConfig: GestureConfig;
  setGestureConfig: (config: Partial<GestureConfig>) => void;
  
  // UI helpers
  getTouchTargetSize: (baseSize: number) => number;
  getSpacing: (multiplier?: number) => number;
  shouldUseTouch: () => boolean;
  shouldUsePencil: () => boolean;
  
  // Navigation
  isFullscreenMode: boolean;
  setFullscreenMode: (enabled: boolean) => void;
  activePanelId: string | null;
  setActivePanel: (panelId: string | null) => void;
  
  // Split view (iPad)
  isSplitView: boolean;
  splitRatio: number;
  setSplitRatio: (ratio: number) => void;
}

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  enablePinchZoom: true,
  enableTwoFingerPan: true,
  enableSwipeNavigation: true,
  enableLongPressMenu: true,
  enableDoubleTap: true,
  swipeThreshold: 50,
  longPressDuration: 500,
};

const getDefaultLayout = (device: DeviceInfo): TabletLayout => {
  if (device.isTablet) {
    const isLandscape = device.orientation === 'landscape';
    return {
      mode: isLandscape ? 'tablet-landscape' : 'tablet-portrait',
      sidebarPosition: isLandscape ? 'left' : 'bottom',
      toolbarPosition: 'floating',
      showMinimap: isLandscape,
      panelWidth: isLandscape ? 320 : device.screenWidth,
      touchTargetSize: 44, // Apple HIG minimum
      spacing: 8,
    };
  }
  
  if (device.isMobile) {
    return {
      mode: 'mobile',
      sidebarPosition: 'bottom',
      toolbarPosition: 'bottom',
      showMinimap: false,
      panelWidth: device.screenWidth,
      touchTargetSize: 48,
      spacing: 8,
    };
  }
  
  // Desktop
  return {
    mode: 'desktop',
    sidebarPosition: 'left',
    toolbarPosition: 'top',
    showMinimap: true,
    panelWidth: 300,
    touchTargetSize: 32,
    spacing: 8,
  };
};

// =============================================================================
// Context
// =============================================================================

const TabletSupportContext = createContext<TabletSupportContextValue | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

export interface TabletSupportProviderProps {
  children: ReactNode;
  initialGestureConfig?: Partial<GestureConfig>;
  onInteractionModeChange?: (mode: InteractionMode) => void;
  onLayoutChange?: (layout: TabletLayout) => void;
}

export const TabletSupportProvider: React.FC<TabletSupportProviderProps> = ({
  children,
  initialGestureConfig,
  onInteractionModeChange,
  onLayoutChange,
}) => {
  // Device detection
  const device = useDeviceDetection();
  
  // State
  const [interactionMode, setInteractionModeState] = useState<InteractionMode>(
    device.prefersTouch ? 'touch' : 'mouse'
  );
  const [layout, setLayout] = useState<TabletLayout>(() => getDefaultLayout(device));
  const [gestureConfig, setGestureConfigState] = useState<GestureConfig>({
    ...DEFAULT_GESTURE_CONFIG,
    ...initialGestureConfig,
  });
  const [isFullscreenMode, setFullscreenMode] = useState(false);
  const [activePanelId, setActivePanel] = useState<string | null>(null);
  const [isSplitView, setIsSplitView] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  
  // Pencil state (will be null on non-iPad devices)
  const [pencilState, setPencilState] = useState<PencilState | null>(null);
  
  // Update layout when device changes
  useEffect(() => {
    const newLayout = getDefaultLayout(device);
    setLayout(newLayout);
    onLayoutChange?.(newLayout);
  }, [device.deviceType, device.orientation, onLayoutChange]);
  
  // Update interaction mode based on device
  useEffect(() => {
    const newMode = device.prefersTouch ? 'touch' : 'mouse';
    if (newMode !== interactionMode) {
      setInteractionModeState(newMode);
      onInteractionModeChange?.(newMode);
    }
  }, [device.prefersTouch]);
  
  // Track Apple Pencil usage
  useEffect(() => {
    if (!device.isIPad) return;
    
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'pen') {
        setInteractionModeState('pencil');
        setPencilState(prev => prev ? { ...prev, isPencilConnected: true } : {
          isActive: true,
          isHovering: false,
          isPencilConnected: true,
          currentPressure: e.pressure,
          currentTilt: { x: e.tiltX, y: e.tiltY },
          inputType: 'pencil',
        });
      } else if (e.pointerType === 'touch') {
        // Don't switch away from pencil mode immediately
        // This allows palm rejection to work
      }
    };
    
    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'pen') {
        setPencilState(prev => prev ? { ...prev, isActive: false } : null);
      }
    };
    
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [device.isIPad]);
  
  // Detect iPad split view
  useEffect(() => {
    if (!device.isIPad) return;
    
    const checkSplitView = () => {
      // iPad split view detection: screen width != window width
      const isSplit = window.innerWidth < window.screen.width * 0.9;
      setIsSplitView(isSplit);
      
      if (isSplit) {
        const ratio = window.innerWidth / window.screen.width;
        setSplitRatio(ratio);
      }
    };
    
    checkSplitView();
    window.addEventListener('resize', checkSplitView);
    
    return () => window.removeEventListener('resize', checkSplitView);
  }, [device.isIPad]);
  
  // Setters with callbacks
  const setInteractionMode = useCallback((mode: InteractionMode) => {
    setInteractionModeState(mode);
    onInteractionModeChange?.(mode);
  }, [onInteractionModeChange]);
  
  const setLayoutMode = useCallback((mode: LayoutMode) => {
    const newLayout: TabletLayout = {
      ...layout,
      mode,
      sidebarPosition: mode === 'tablet-portrait' || mode === 'mobile' ? 'bottom' : 'left',
      toolbarPosition: mode === 'desktop' ? 'top' : 'floating',
      showMinimap: mode === 'desktop' || mode === 'tablet-landscape',
    };
    setLayout(newLayout);
    onLayoutChange?.(newLayout);
  }, [layout, onLayoutChange]);
  
  const setGestureConfig = useCallback((config: Partial<GestureConfig>) => {
    setGestureConfigState(prev => ({ ...prev, ...config }));
  }, []);
  
  // Helper functions
  const getTouchTargetSize = useCallback((baseSize: number): number => {
    if (device.prefersTouch) {
      return Math.max(baseSize, layout.touchTargetSize);
    }
    return baseSize;
  }, [device.prefersTouch, layout.touchTargetSize]);
  
  const getSpacing = useCallback((multiplier: number = 1): number => {
    return layout.spacing * multiplier;
  }, [layout.spacing]);
  
  const shouldUseTouch = useCallback((): boolean => {
    return interactionMode === 'touch' || (interactionMode === 'pencil' && !pencilState?.isActive);
  }, [interactionMode, pencilState?.isActive]);
  
  const shouldUsePencil = useCallback((): boolean => {
    return interactionMode ==='pencil' && (pencilState?.isActive || pencilState?.isHovering || false);
  }, [interactionMode, pencilState]);
  
  // Context value
  const value: TabletSupportContextValue = {
    device,
    isTablet: device.isTablet,
    isIPad: device.isIPad,
    isMobile: device.isMobile,
    isDesktop: device.isDesktop,
    
    interactionMode,
    setInteractionMode,
    
    layout,
    setLayoutMode,
    
    pencilState,
    isPencilActive: pencilState?.isActive || false,
    isPencilConnected: pencilState?.isPencilConnected || false,
    
    gestureConfig,
    setGestureConfig,
    
    getTouchTargetSize,
    getSpacing,
    shouldUseTouch,
    shouldUsePencil,
    
    isFullscreenMode,
    setFullscreenMode,
    activePanelId,
    setActivePanel,
    
    isSplitView,
    splitRatio,
    setSplitRatio,
  };
  
  return (
    <TabletSupportContext.Provider value={value}>
      {children}
    </TabletSupportContext.Provider>
  );
};

// =============================================================================
// Hook
// =============================================================================

export const useTabletSupport = (): TabletSupportContextValue => {
  const context = useContext(TabletSupportContext);
  
  if (!context) {
    throw new Error('useTabletSupport must be used within a TabletSupportProvider');
  }
  
  return context;
};

// =============================================================================
// Higher-Order Component for Tablet Support
// =============================================================================

export interface WithTabletSupportProps {
  tabletSupport: TabletSupportContextValue;
}

export function withTabletSupport<P extends object>(
  Component: React.ComponentType<P & WithTabletSupportProps>
): React.FC<P> {
  return function WithTabletSupportWrapper(props: P) {
    const tabletSupport = useTabletSupport();
    return <Component {...props} tabletSupport={tabletSupport} />;
  };
}

// =============================================================================
// Utility Components
// =============================================================================

/**
 * Renders children only on tablet devices
 */
export const TabletOnly: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isTablet } = useTabletSupport();
  return isTablet ? <>{children}</> : null;
};

/**
 * Renders children only on desktop
 */
export const DesktopOnly: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isDesktop } = useTabletSupport();
  return isDesktop ? <>{children}</> : null;
};

/**
 * Renders children only when Apple Pencil is connected
 */
export const PencilOnly: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isPencilConnected } = useTabletSupport();
  return isPencilConnected ? <>{children}</> : null;
};

/**
 * Renders different content based on device type
 */
export interface ResponsiveRenderProps {
  desktop?: ReactNode;
  tablet?: ReactNode;
  mobile?: ReactNode;
  fallback?: ReactNode;
}

export const ResponsiveRender: React.FC<ResponsiveRenderProps> = ({
  desktop,
  tablet,
  mobile,
  fallback,
}) => {
  const { isDesktop, isTablet, isMobile } = useTabletSupport();
  
  if (isDesktop && desktop) return <>{desktop}</>;
  if (isTablet && tablet) return <>{tablet}</>;
  if (isMobile && mobile) return <>{mobile}</>;
  
  return <>{fallback || desktop || tablet || mobile}</>;
};

export default TabletSupportProvider;

