/**
 * Light Pattern Service
 * 
 * Fetches light pattern data from the backend API
 */

import { logger } from './logger';

const log = logger.module('LightPatternService');
const API_BASE ='/api/virtual-studio';

export interface LightSetup {
  type: string;
  name: string;
  role: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  power: number;
  modifier?: string;
  modifierSize?: string;
  distance?: number;
  angle?: number;
  height?: string;
}

export interface LightPattern {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  lookDescription: string;
  whenToUse: string;
  difficultyLevel: string;
  lightSetup: LightSetup[];
  setupInstructions: string[];
  recommendedModifiers: string[];
  recommendedHdris: string[];
  recommendedBackgrounds: string[];
  subjectOrientation: string;
  subjectDistance: number;
  shadowRules: string;
  isFeatured: boolean;
  isBeginnerFriendly: boolean;
  usageCount: number;
  ratingAverage: number;
  ratingCount: number;
}

class LightPatternService {
  /**
   * Fetch a specific light pattern by slug
   */
  async getPatternBySlug(slug: string): Promise<LightPattern | null> {
    try {
      const response = await fetch(`${API_BASE}/light-patterns/${slug}`);
      
      if (!response.ok) {
        log.error(`Failed to fetch pattern ${slug}:`, response.statusText);
        return null;
      }
      
      const data = await response.json();
      return data.pattern;
    } catch (error) {
      log.error('Error fetching light pattern: ', error);
      return null;
    }
  }

  /**
   * Fetch a specific light pattern by ID
   */
  async getPatternById(id: string): Promise<LightPattern | null> {
    try {
      const response = await fetch(`${API_BASE}/light-patterns, `);
      
      if (!response.ok) {
        log.error('Failed to fetch patterns:', response.statusText);
        return null;
      }
      
      const data = await response.json();
      const pattern = data.patterns.find((p: LightPattern) => p.id === id);
      return pattern || null;
    } catch (error) {
      log.error('Error fetching light pattern:', error);
      return null;
    }
  }

  /**
   * Fetch all light patterns
   */
  async getAllPatterns(): Promise<LightPattern[]> {
    try {
      const response = await fetch(`${API_BASE}/light-patterns`);
      
      if (!response.ok) {
        log.error('Failed to fetch patterns:', response.statusText);
        return [];
      }
      
      const data = await response.json();
      return data.patterns || [];
    } catch (error) {
      log.error('Error fetching light patterns:', error);
      return [];
    }
  }

  /**
   * Get light setup from pattern context
   * This is a helper to extract light setup from a pattern
   */
  getLightSetupFromPattern(pattern: LightPattern): LightSetup[] {
    return pattern.lightSetup || [];
  }
}

export const lightPatternService = new LightPatternService();

