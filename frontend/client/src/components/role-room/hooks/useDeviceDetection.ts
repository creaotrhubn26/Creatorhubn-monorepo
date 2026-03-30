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

type DeviceOverride = 'ipad' | 'iphone' | 'desktop' | 'touch';

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
    // @ts-expect-error - legacy browser support
    (navigator.msMaxTouchPoints || 0) > 0;

  // Apple Pencil support (typically iPad Pro and newer iPads)
  const hasPencilSupport = isIPad && hasTouchScreen;

  const override = getDeviceOverride();
  if (override) {
    return applyDeviceOverride(override, {
      isIOS,
      isIPad,
      isIPhone,
      isMac,
      isSafari,
      hasPencilSupport,
      hasTouchScreen,
      userAgent,
      platform,
    });
  }

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

function getDeviceOverride(): DeviceOverride | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryOverride = params.get('device');
    if (queryOverride === 'ipad' || queryOverride === 'iphone' || queryOverride === 'desktop' || queryOverride === 'touch') {
      return queryOverride;
    }

    const globalOverride = (window as typeof window & { __CREATORHUB_DEVICE__?: string }).__CREATORHUB_DEVICE__;
    if (globalOverride === 'ipad' || globalOverride === 'iphone' || globalOverride === 'desktop' || globalOverride === 'touch') {
      return globalOverride;
    }
  } catch {
    return null;
  }

  return null;
}

function applyDeviceOverride(override: DeviceOverride, base: DeviceInfo): DeviceInfo {
  switch (override) {
    case 'ipad':
      return {
        ...base,
        isIOS: true,
        isIPad: true,
        isIPhone: false,
        isMac: false,
        isSafari: true,
        hasTouchScreen: true,
        hasPencilSupport: true,
        userAgent: `${base.userAgent} [override:ipad]`.trim(),
        platform: 'iPad',
      };
    case 'iphone':
      return {
        ...base,
        isIOS: true,
        isIPad: false,
        isIPhone: true,
        isMac: false,
        isSafari: true,
        hasTouchScreen: true,
        hasPencilSupport: false,
        userAgent: `${base.userAgent} [override:iphone]`.trim(),
        platform: 'iPhone',
      };
    case 'touch':
      return {
        ...base,
        isIOS: false,
        isIPad: false,
        isIPhone: false,
        isMac: false,
        hasTouchScreen: true,
        hasPencilSupport: false,
        userAgent: `${base.userAgent} [override:touch]`.trim(),
        platform: base.platform || 'Touch',
      };
    case 'desktop':
    default:
      return {
        ...base,
        isIOS: false,
        isIPad: false,
        isIPhone: false,
        isMac: true,
        isSafari: false,
        hasTouchScreen: false,
        hasPencilSupport: false,
        userAgent: `${base.userAgent} [override:desktop]`.trim(),
        platform: 'MacIntel',
      };
  }
}
