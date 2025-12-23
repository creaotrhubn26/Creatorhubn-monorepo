/**
 * useDeviceDetection - Detect device type and capabilities
 * 
 * Features:
 * - Detect iPad/tablet vs desktop
 * - Detect touch capability
 * - Detect pointer type (coarse/fine)
 * - React to device orientation changes
 * - SSR-safe (works with Next.js)
 */

import { useState, useEffect, useMemo } from 'react';

// =============================================================================
// Types
// =============================================================================

export type DeviceType = 'desktop' | 'tablet' | 'mobile';
export type PointerType = 'mouse' | 'touch' | 'pen';
export type Orientation = 'portrait' | 'landscape';

export interface DeviceInfo {
  // Device classification
  deviceType: DeviceType;
  isDesktop: boolean;
  isTablet: boolean;
  isMobile: boolean;
  
  // Specific device detection
  isIPad: boolean;
  isAndroidTablet: boolean;
  isIPhone: boolean;
  isAndroidPhone: boolean;
  
  // Capabilities
  hasTouch: boolean;
  hasMouse: boolean;
  hasCoarsePointer: boolean; // Touch-friendly pointer
  hasFinePointer: boolean;   // Mouse-like precision
  
  // Input preferences
  primaryPointer: PointerType;
  prefersTouch: boolean;     // Should use touch UI
  prefersMouse: boolean;     // Should use mouse UI
  
  // Screen info
  orientation: Orientation;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  
  // Feature flags for UI decisions
  useSwipeNavigation: boolean;
  usePinchZoom: boolean;
  useLongPressMenu: boolean;
  useHoverEffects: boolean;
  useRightClickMenu: boolean;
  useLargerTouchTargets: boolean;
}

// =============================================================================
// Detection Utilities
// =============================================================================

const isSSR = typeof window === 'undefined';

/**
 * Detect if device is an iPad (including iPadOS 13+ which reports as Mac)
 */
const detectIPad = (): boolean => {
  if (isSSR) return false;
  
  const ua = navigator.userAgent;
  
  // Standard iPad detection
  if (/iPad/.test(ua)) return true;
  
  // iPadOS 13+ detection (reports as Mac but has touch)
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) {
    return true;
  }
  
  return false;
};

/**
 * Detect if device is an Android tablet
 */
const detectAndroidTablet = (): boolean => {
  if (isSSR) return false;
  
  const ua = navigator.userAgent;
  
  // Android without "Mobile" = tablet
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return true;
  
  // Check screen size for Android
  if (/Android/.test(ua)) {
    const minDimension = Math.min(window.screen.width, window.screen.height);
    if (minDimension >= 600) return true; // 600dp is Android's tablet threshold
  }
  
  return false;
};

/**
 * Detect if device has touch capability
 */
const detectTouch = (): boolean => {
  if (isSSR) return false;
  
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - msMaxTouchPoints for older IE/Edge
    navigator.msMaxTouchPoints > 0
  );
};

/**
 * Detect if device has a mouse (fine pointer)
 */
const detectMouse = (): boolean => {
  if (isSSR) return true; // Assume mouse on server
  
  // Check media query for fine pointer
  if (window.matchMedia) {
    return window.matchMedia('(pointer: fine)').matches;
  }
  
  // Fallback: assume mouse if no touch
  return !detectTouch();
};

/**
 * Detect coarse pointer (touch-friendly)
 */
const detectCoarsePointer = (): boolean => {
  if (isSSR) return false;
  
  if (window.matchMedia) {
    return window.matchMedia('(pointer: coarse)').matches;
  }
  
  return detectTouch();
};

/**
 * Get device type classification
 */
const getDeviceType = (): DeviceType => {
  if (isSSR) return 'desktop';
  
  // iPad detection first (before checking screen size)
  if (detectIPad()) return 'tablet';
  
  // Android tablet
  if (detectAndroidTablet()) return 'tablet';
  
  const ua = navigator.userAgent;
  
  // Mobile phone detection
  if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return 'mobile';
  }
  
  // Tablet detection by user agent
  if (/Tablet|PlayBook/i.test(ua)) {
    return 'tablet';
  }
  
  // Screen size fallback (only if touch device)
  if (detectTouch()) {
    const minDimension = Math.min(window.innerWidth, window.innerHeight);
    if (minDimension >= 600 && minDimension < 1024) return 'tablet';
    if (minDimension < 600) return 'mobile';
  }
  
  return 'desktop';
};

/**
 * Get current orientation
 */
const getOrientation = (): Orientation => {
  if (isSSR) return 'landscape';
  
  if (window.screen.orientation) {
    return window.screen.orientation.type.includes('portrait') ? 'portrait' : 'landscape';
  }
  
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
};

/**
 * Build complete device info object
 */
const buildDeviceInfo = (): DeviceInfo => {
  const deviceType = getDeviceType();
  const hasTouch = detectTouch();
  const hasMouse = detectMouse();
  const hasCoarsePointer = detectCoarsePointer();
  const hasFinePointer = !hasCoarsePointer || hasMouse;
  const isIPad = detectIPad();
  const isAndroidTablet = detectAndroidTablet();
  
  // Determine primary pointer type
  let primaryPointer: PointerType = 'mouse';
  if (hasCoarsePointer && !hasFinePointer) {
    primaryPointer = 'touch';
  } else if (hasTouch && !hasMouse) {
    primaryPointer = 'touch';
  }
  
  // UI preferences based on device
  const isTablet = deviceType === 'tablet';
  const isMobile = deviceType === 'mobile';
  const isDesktop = deviceType === 'desktop';
  
  // Touch UI should be used on tablets and mobiles
  const prefersTouch = isTablet || isMobile || (hasTouch && !hasMouse);
  const prefersMouse = isDesktop || (hasMouse && !hasCoarsePointer);
  
  return {
    deviceType,
    isDesktop,
    isTablet,
    isMobile,
    
    isIPad,
    isAndroidTablet,
    isIPhone: !isSSR && /iPhone/.test(navigator.userAgent),
    isAndroidPhone: !isSSR && /Android.*Mobile/.test(navigator.userAgent),
    
    hasTouch,
    hasMouse,
    hasCoarsePointer,
    hasFinePointer,
    
    primaryPointer,
    prefersTouch,
    prefersMouse,
    
    orientation: getOrientation(),
    screenWidth: isSSR ? 1920 : window.innerWidth,
    screenHeight: isSSR ? 1080 : window.innerHeight,
    pixelRatio: isSSR ? 1 : window.devicePixelRatio || 1,
    
    // Feature flags
    useSwipeNavigation: prefersTouch,
    usePinchZoom: prefersTouch && hasTouch,
    useLongPressMenu: prefersTouch && hasTouch,
    useHoverEffects: prefersMouse,
    useRightClickMenu: prefersMouse,
    useLargerTouchTargets: prefersTouch || hasCoarsePointer,
  };
};

// =============================================================================
// React Hook
// =============================================================================

/**
 * Hook to detect device type and capabilities
 * 
 * @example
 * const { isTablet, prefersTouch, usePinchZoom } = useDeviceDetection();
 * 
 * if (prefersTouch) {
 *   // Use touch gestures
 * } else {
 *   // Use mouse interactions
 * }
 */
export const useDeviceDetection = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(buildDeviceInfo);
  
  useEffect(() => {
    // Initial detection
    setDeviceInfo(buildDeviceInfo());
    
    // Listen for orientation changes
    const handleOrientationChange = () => {
      setDeviceInfo(buildDeviceInfo());
    };
    
    // Listen for resize (orientation change fallback)
    const handleResize = () => {
      setDeviceInfo(prev => ({
        ...prev,
        orientation: getOrientation(),
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      }));
    };
    
    // Listen for pointer changes (e.g., connecting a mouse to tablet)
    const handlePointerChange = () => {
      setDeviceInfo(buildDeviceInfo());
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);
    
    // Listen for media query changes
    const pointerQuery = window.matchMedia?.('(pointer: fine)');
    const touchQuery = window.matchMedia?.('(hover: none)');
    
    pointerQuery?.addEventListener?.('change', handlePointerChange);
    touchQuery?.addEventListener?.('change', handlePointerChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
      pointerQuery?.removeEventListener?.('change', handlePointerChange);
      touchQuery?.removeEventListener?.('change', handlePointerChange);
    };
  }, []);
  
  return deviceInfo;
};

// =============================================================================
// Static Detection (for non-React usage)
// =============================================================================

/**
 * Get device info without React (static detection)
 */
export const getDeviceInfo = (): DeviceInfo => buildDeviceInfo();

/**
 * Quick check if current device is a tablet
 */
export const isTabletDevice = (): boolean => {
  return getDeviceType() ==='tablet';
};

/**
 * Quick check if current device prefers touch UI
 */
export const prefersTouchUI = (): boolean => {
  const info = buildDeviceInfo();
  return info.prefersTouch;
};

export default useDeviceDetection;

