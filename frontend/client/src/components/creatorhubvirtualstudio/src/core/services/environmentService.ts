/**
 * Environment Service
 * 
 * Manages the Virtual Studio environment based on user profession and specialization.
 * Applies default lighting, camera settings, backdrops, and equipment presets.
 */

import { logger } from './logger';

const log = logger.module('EnvironmentService');

import { 
  ProfessionType, 
  Specialization,
  EnvironmentConfig,
  PHOTOGRAPHER_SPECIALIZATIONS,
  VIDEOGRAPHER_SPECIALIZATIONS,
  ENVIRONMENTS,
  SCHOOL_TEMPLATES,
  getSpecializationById,
  getEnvironmentById,
} from '../data/professionTypes';

export interface EnvironmentState {
  profession: ProfessionType | null;
  specialization: string | null;
  environment: EnvironmentConfig | null;
  isLoaded: boolean;
}

class EnvironmentService {
  private state: EnvironmentState = {
    profession: null,
    specialization: null,
    environment: null,
    isLoaded: false,
  };

  private listeners: Set<(state: EnvironmentState) => void> = new Set();

  /**
   * Subscribe to environment state changes
   */
  subscribe(callback: (state: EnvironmentState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    this.listeners.forEach(cb => cb(this.state));
  }

  /**
   * Get current environment state
   */
  getState(): EnvironmentState {
    return this.state;
  }

  /**
   * Load environment from saved preferences
   */
  loadFromPreferences(): void {
    try {
      const savedPrefs = localStorage.getItem('virtualStudio_preferences');
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.profession && prefs.specialization) {
          this.setEnvironment(prefs.profession, prefs.specialization);
        }
      }
    } catch (error) {
      log.warn('Failed to load environment preferences: ', error);
    }
  }

  /**
   * Set the environment based on profession and specialization
   */
  setEnvironment(profession: ProfessionType, specializationId: string): void {
    const specialization = getSpecializationById(specializationId, profession);
    if (!specialization) {
      log.warn(`Unknown specialization: ${specializationId}`);
      return;
    }

    const environment = getEnvironmentById(specialization.defaultEnvironment);
    
    this.state = {
      profession,
      specialization: specializationId,
      environment: environment || null,
      isLoaded: true,
    };

    this.notify();
    
    // Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent('vs-environment-changed', {
      detail: {
        profession,
        specialization: specializationId,
        environment: environment,
        specDetails: specialization,
      },
    }));
  }

  /**
   * Apply environment to the 3D scene
   * This dispatches events that other components listen for
   */
  applyToScene(): void {
    if (!this.state.environment || !this.state.specialization) {
      return;
    }

    const env = this.state.environment;
    const spec = this.state.profession 
      ? getSpecializationById(this.state.specialization, this.state.profession)
      : null;

    // Apply HDRI
    if (env.hdri) {
      window.dispatchEvent(new CustomEvent('vs-load-hdri', {
        detail: { hdriId: env.hdri },
      }));
    }

    // Apply backdrop
    if (env.backdrop) {
      window.dispatchEvent(new CustomEvent('vs-load-backdrop', {
        detail: { backdropId: env.backdrop },
      }));
    }

    // Apply default lights
    if (env.defaultLights && env.defaultLights.length > 0) {
      window.dispatchEvent(new CustomEvent('vs-load-lighting-preset', {
        detail: { 
          lights: env.defaultLights,
          clearExisting: true,
        },
      }));
    }

    // Apply camera settings
    if (env.defaultCamera) {
      window.dispatchEvent(new CustomEvent('vs-set-camera', {
        detail: env.defaultCamera,
      }));
    }

    // Load recommended equipment into sidebar
    if (spec?.recommendedEquipment) {
      window.dispatchEvent(new CustomEvent('vs-highlight-equipment', {
        detail: { equipmentIds: spec.recommendedEquipment },
      }));
    }

    // Add props if specified
    if (env.props && env.props.length > 0) {
      env.props.forEach(propId => {
        window.dispatchEvent(new CustomEvent('vs-add-prop', {
          detail: { propId },
        }));
      });
    }

    log.info(`Environment applied: ${env.name}`);
  }

  /**
   * Get recommended templates for current specialization
   */
  getRecommendedTemplates(): string[] {
    if (!this.state.profession || !this.state.specialization) {
      return [];
    }

    const spec = getSpecializationById(this.state.specialization, this.state.profession);
    return spec?.defaultTemplates || [];
  }

  /**
   * Get recommended equipment for current specialization
   */
  getRecommendedEquipment(): string[] {
    if (!this.state.profession || !this.state.specialization) {
      return [];
    }

    const spec = getSpecializationById(this.state.specialization, this.state.profession);
    return spec?.recommendedEquipment || [];
  }

  /**
   * Get recommended modifiers for current specialization
   */
  getRecommendedModifiers(): string[] {
    if (!this.state.profession || !this.state.specialization) {
      return [];
    }

    const spec = getSpecializationById(this.state.specialization, this.state.profession);
    return spec?.recommendedModifiers || [];
  }

  /**
   * Check if current specialization is school photography
   */
  isSchoolPhotography(): boolean {
    return this.state.specialization === 'school_photography';
  }

  /**
   * Get school-specific templates
   */
  getSchoolTemplates(): typeof SCHOOL_TEMPLATES {
    return SCHOOL_TEMPLATES;
  }

  /**
   * Get all specializations for a profession
   */
  getSpecializations(profession: ProfessionType): Specialization[] {
    return profession === 'photographer' 
      ? PHOTOGRAPHER_SPECIALIZATIONS 
      : VIDEOGRAPHER_SPECIALIZATIONS;
  }

  /**
   * Get all available environments
   */
  getAllEnvironments(): EnvironmentConfig[] {
    return Object.values(ENVIRONMENTS);
  }

  /**
   * Reset environment to default
   */
  reset(): void {
    this.state = {
      profession: null,
      specialization: null,
      environment: null,
      isLoaded: false,
    };
    this.notify();
  }
}

// Singleton instance
export const environmentService = new EnvironmentService();

// React hook for using environment service
import { useState, useEffect } from'react';

export function useEnvironment() {
  const [state, setState] = useState<EnvironmentState>(environmentService.getState());

  useEffect(() => {
    return environmentService.subscribe(setState);
  }, []);

  return {
    ...state,
    setEnvironment: environmentService.setEnvironment.bind(environmentService),
    applyToScene: environmentService.applyToScene.bind(environmentService),
    getRecommendedTemplates: environmentService.getRecommendedTemplates.bind(environmentService),
    getRecommendedEquipment: environmentService.getRecommendedEquipment.bind(environmentService),
    getRecommendedModifiers: environmentService.getRecommendedModifiers.bind(environmentService),
    isSchoolPhotography: environmentService.isSchoolPhotography.bind(environmentService),
    getSchoolTemplates: environmentService.getSchoolTemplates.bind(environmentService),
    reset: environmentService.reset.bind(environmentService),
  };
}

