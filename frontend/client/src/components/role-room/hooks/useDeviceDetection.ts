/**
 * useDeviceDetection Hook
 * 
 * Detects device type and capabilities (iPad, Apple Pencil support, etc.)
 */

import { useState, useEffect } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface DeviceInfo {
  isIOS: boolean;
  isIPad: boolean;
  isIPhone: boolean;
  isMac: boolean;
  isSafari: boolean;
  hasPencilSupport: boolean;
  hasTouchScreen: boolean;
  userAgent: string;
  platform: string;
}

// =============================================================================
// Hook
// =============================================================================

export const useDeviceDetection = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => detectDevice());

  useEffect(() => {
    // Re-detect on window resize (for responsive design)
    const handleResize = () => {
      setDeviceInfo(detectDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceInfo;
};

// =============================================================================
// Detection Utilities
// =============================================================================

function detectDevice(): DeviceInfo {
  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';

  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Detect iPad specifically
  const isIPad = /iPad/.test(userAgent) || 
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Detect iPhone
  const isIPhone = /iPhone/.test(userAgent);

  // Detect Mac
  const isMac = /Mac/.test(platform) && navigator.maxTouchPoints === 0;

  // Detect Safari
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);

  // Detect touch screen capability
  const hasTouchScreen = 
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - legacy browser support
    (navigator.msMaxTouchPoints || 0) > 0;

  // Apple Pencil support (typically iPad Pro and newer iPads)
  const hasPencilSupport = isIPad && hasTouchScreen;

  return {
    isIOS,
    isIPad,
    isIPhone,
    isMac,
    isSafari,
    hasPencilSupport,
    hasTouchScreen,
    userAgent,
    platform,
  };
}
