/**
 * Glass Theme Hook - Phase 2 Component Standardization
 * Provides theme context and utilities for glass components
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { designTokens } from '../design-tokens';

// ============ TYPES ============

export type UserType = 'photographer' | 'videographer' | 'musicProducer' | 'admin';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type GlassIntensity = 'light' | 'medium' | 'heavy' | 'ultra';

export interface GlassThemeConfig {
  userType: UserType;
  mode: ThemeMode;
  intensity: GlassIntensity;
  reducedMotion: boolean;
  norwegianCompliance: boolean;
}

export interface GlassThemeContext {
  config: GlassThemeConfig;
  updateConfig: (updates: Partial<GlassThemeConfig>) => void;
  getThemeClasses: (component: string) => string;
  getMotionProps: (type: string) => object;
  getColorVariant: (userType: UserType) => string;
  isNorwegianCompliant: boolean;
}

// ============ CONTEXT ============

const GlassThemeContext = createContext<GlassThemeContext | null>(null);

// ============ HOOK ============

export const useGlassTheme = (): GlassThemeContext => {
  const context = useContext(GlassThemeContext);
  if (!context) {
    throw new Error('useGlassTheme must be used within a GlassThemeProvider');
  }
  return context;
};

// ============ PROVIDER ============

interface GlassThemeProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<GlassThemeConfig>;
}

export const GlassThemeProvider: React.FC<GlassThemeProviderProps> = ({
  children,
  initialConfig = {},
}) => {
  const [config, setConfig] = useState<GlassThemeConfig>({
    userType: 'photographer',
    mode: 'auto',
    intensity: 'medium',
    reducedMotion: false,
    norwegianCompliance: true,
    ...initialConfig,
  });

  const updateConfig = (updates: Partial<GlassThemeConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const getThemeClasses = (component: string): string => {
    const baseClass = `glass-${component}`;
    const userTypeClass = `glass-${config.userType}`;
    const intensityClass = `glass-${config.intensity}`;

    return `${baseClass} ${userTypeClass} ${intensityClass}`;
  };

  const getMotionProps = (type: string): object => {
    if (config.reducedMotion) {
      return { transition: { duration: 0 } };
    }

    const motionConfigs = {
      spring: {
        type: 'spring',
        damping: 20,
        stiffness: 300,
      },
      elastic: {
        type: 'spring',
        damping: 15,
        stiffness: 200,
      },
      bounce: {
        type: 'spring',
        damping: 10,
        stiffness: 400,
      },
      smooth: {
        type: 'tween',
        ease: designTokens.motion.easing.smooth,
        duration: 0.3,
      },
    };

    return motionConfigs[type as keyof typeof motionConfigs] || motionConfigs.smooth;
  };

  const getColorVariant = (userType: UserType): string => {
    return designTokens.color.dashboard[userType];
  };

  const contextValue: GlassThemeContext = {
    config,
    updateConfig,
    getThemeClasses,
    getMotionProps,
    getColorVariant,
    isNorwegianCompliant: config.norwegianCompliance,
  };

  return React.createElement(GlassThemeContext.Provider, { value: contextValue }, children);
};

// ============ UTILITIES ============

export const createGlassVariant = (userType: UserType, intensity: GlassIntensity = 'medium') => {
  const baseColor = designTokens.color.glass[userType];
  const blurLevel = designTokens.glass.blur[intensity];
  const background = designTokens.glass.backgrounds[intensity];

  return {
    backgroundColor: background,
    backdropFilter: blurLevel,
    border: `1px solid ${baseColor}`,
    boxShadow: designTokens.glass.shadows[intensity],
  };
};

export const getNorvegianTerminology = (userType: UserType, key: string): string => {
  const terminology = designTokens.norwegian.terminology[userType];
  return terminology[key as keyof typeof terminology] || key;
};

export const isGDPRCompliant = (): boolean => {
  return designTokens.norwegian.compliance.gdpr;
};

export const isVATRegistered = (): boolean => {
  return designTokens.norwegian.compliance.vatRegistered;
};

// ============ CUSTOM HOOKS ============

export const useGlassAnimation = (type: string = 'spring') => {
  const { getMotionProps, config } = useGlassTheme();

  return {
    props: getMotionProps(type),
    reducedMotion: config.reducedMotion,
    shouldAnimate: !config.reducedMotion,
  };
};

export const useUserTypeTheme = (userType?: UserType) => {
  const { config, getColorVariant, getThemeClasses } = useGlassTheme();
  const activeUserType = userType || config.userType;

  return {
    userType: activeUserType,
    color: getColorVariant(activeUserType),
    classes: getThemeClasses(activeUserType),
    terminology: designTokens.norwegian.terminology[activeUserType],
  };
};

export const useGlassCompliance = () => {
  const { config } = useGlassTheme();

  return {
    isNorwegianCompliant: config.norwegianCompliance,
    isGDPRCompliant: isGDPRCompliant(),
    isVATRegistered: isVATRegistered(),
    complianceStatus: {
      gdpr: designTokens.norwegian.compliance.gdpr,
      vat: designTokens.norwegian.compliance.vatRegistered,
      professional: designTokens.norwegian.compliance.professionalStandards,
    },
  };
};
