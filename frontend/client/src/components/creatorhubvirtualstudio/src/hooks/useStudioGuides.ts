/**
 * useStudioGuides Hook
 * 
 * Manages studio guide settings and provides calculated positions
 * for the 3D guide overlay.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { logger } from '../core/services/logger';

const log = logger.module('StudioGuides');

export interface GuideSettings {
  showDistanceGuides: boolean;
  showAngleGuides: boolean;
  showPositionMarkers: boolean;
  showGridOverlay: boolean;
  subjectPosition: [number, number, number];
  backgroundDistance: number;
  keyLightDistance: number;
  keyLightAngle: number;
  keyLightHeight: number;
  fillDistance: number;
  cameraDistance: number;
  shootType: 'headshot' | 'full_body' | 'small_group' | 'class_photo' | 'custom';
}

export interface CalculatedPositions {
  subjectPosition: [number, number, number];
  backgroundPosition: [number, number, number];
  keyLightPosition: [number, number, number];
  fillPosition: [number, number, number];
  cameraPosition: [number, number, number];
}

const DEFAULT_SETTINGS: GuideSettings = {
  showDistanceGuides: true,
  showAngleGuides: true,
  showPositionMarkers: true,
  showGridOverlay: true,
  subjectPosition: [0, 0, 0],
  backgroundDistance: 2.5,
  keyLightDistance: 1.5,
  keyLightAngle: 45,
  keyLightHeight: 2.0,
  fillDistance: 1.0,
  cameraDistance: 3,
  shootType: 'headshot',
};

// Load settings from localStorage
const loadSettings = (): GuideSettings => {
  try {
    const saved = localStorage.getItem('virtualStudio_guideSettings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    log.warn('Failed to load guide settings: ', e);
  }
  return DEFAULT_SETTINGS;
};

// Save settings to localStorage
const saveSettings = (settings: GuideSettings) => {
  try {
    localStorage.setItem('virtualStudio_guideSettings', JSON.stringify(settings));
  } catch (e) {
    log.warn('Failed to save guide settings:', e);
  }
};

export function useStudioGuides() {
  const [settings, setSettings] = useState<GuideSettings>(loadSettings);

  // Save settings whenever they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Calculate 3D positions based on settings
  const calculatedPositions = useMemo<CalculatedPositions>(() => {
    const subject = settings.subjectPosition;
    const angleRad = (settings.keyLightAngle * Math.PI) / 180;

    return {
      subjectPosition: subject,
      backgroundPosition: [
        subject[0],
        subject[1],
        subject[2] - settings.backgroundDistance,
      ],
      keyLightPosition: [
        subject[0] + Math.sin(angleRad) * settings.keyLightDistance,
        settings.keyLightHeight,
        subject[2] + Math.cos(angleRad) * settings.keyLightDistance,
      ],
      fillPosition: [
        subject[0] - Math.sin(angleRad * 0.5) * settings.fillDistance,
        settings.keyLightHeight - 0.3,
        subject[2] + Math.cos(angleRad * 0.5) * settings.fillDistance,
      ],
      cameraPosition: [
        subject[0],
        1.5, // Eye level
        subject[2] + settings.cameraDistance,
      ],
    };
  }, [settings]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<GuideSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
      shootType: newSettings.shootType || 'custom',
    }));
  }, []);

  // Apply preset
  const applyPreset = useCallback((preset: GuideSettings['shootType']) => {
    const presets: Record<string, Partial<GuideSettings>> = {
      headshot: {
        backgroundDistance: 2.5,
        keyLightDistance: 1.5,
        keyLightAngle: 45,
        keyLightHeight: 2.0,
        fillDistance: 1.0,
        cameraDistance: 3,
      },
      full_body: {
        backgroundDistance: 3.5,
        keyLightDistance: 2.5,
        keyLightAngle: 45,
        keyLightHeight: 2.5,
        fillDistance: 2.0,
        cameraDistance: 4,
      },
      small_group: {
        backgroundDistance: 4,
        keyLightDistance: 3.5,
        keyLightAngle: 45,
        keyLightHeight: 2.5,
        fillDistance: 3,
        cameraDistance: 5,
      },
      class_photo: {
        backgroundDistance: 5,
        keyLightDistance: 5,
        keyLightAngle: 45,
        keyLightHeight: 3,
        fillDistance: 5,
        cameraDistance: 8,
      },
    };

    const presetSettings = presets[preset];
    if (presetSettings) {
      setSettings((prev) => ({
        ...prev,
        ...presetSettings,
        shootType: preset,
      }));
    }
  }, []);

  // Toggle all guides visibility
  const toggleAllGuides = useCallback((visible: boolean) => {
    setSettings((prev) => ({
      ...prev,
      showDistanceGuides: visible,
      showAngleGuides: visible,
      showPositionMarkers: visible,
      showGridOverlay: visible,
    }));
  }, []);

  // Get recommendation text based on current settings
  const getRecommendations = useCallback(() => {
    const recommendations: string[] = [];
    
    if (settings.backgroundDistance < 1.5) {
      recommendations.push('Background is very close - may cause shadow spill');
    }
    if (settings.keyLightDistance > 3 && settings.shootType ==='headshot') {
      recommendations.push('Key light is far for headshot - light may be too hard');
    }
    if (settings.keyLightHeight < 1.7) {
      recommendations.push('Key light is below eye level - may create unflattering shadows');
    }
    if (settings.fillDistance > settings.keyLightDistance) {
      recommendations.push('Fill is farther than key - unusual setup');
    }
    
    return recommendations;
  }, [settings]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    calculatedPositions,
    updateSettings,
    applyPreset,
    toggleAllGuides,
    getRecommendations,
    resetToDefaults,
  };
}

export default useStudioGuides;

