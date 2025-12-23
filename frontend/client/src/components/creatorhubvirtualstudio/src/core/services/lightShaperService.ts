/**
 * Light Shaper Service
 * 
 * Manages light-shaper compatibility, attachment, and effects
 */

import { logger } from './logger';

const log = logger.module('LightShaper, ');
const API_BASE = '/api/smart-lighting, ';

export interface LightShaper {
  shaper_id: string;
  shaper_name: string;
  thumbnail_url: string | null;
  model_url: string;
  metadata: any;
  compatibility_score: number;
  mount_type: string;
  beam_angle_modifier: number | null;
  power_loss_stops: number;
  diffusion_factor: number;
  notes: string;
  is_recommended: boolean;
}

export interface ShaperEffects {
  beam_angle_modifier: number | null;
  power_loss_stops: number;
  diffusion_factor: number;
  notes: string;
}

export interface AttachedShaper {
  shaperId: string;
  shaperAssetId: string;
  modifierType: string;
  modifierSize: [number, number];
  effects: ShaperEffects;
}

class LightShaperService {
  /**
   * Get all compatible shapers for a specific light asset
   */
  async getCompatibleShapers(
    lightAssetId: string,
    options?: {
      mountType?: string;
      minScore?: number;
    }
  ): Promise<LightShaper[]> {
    try {
      const params = new URLSearchParams();
      if (options?.mountType) params.append('mountType', options.mountType);
      if (options?.minScore) params.append('minScore', options.minScore.toString());

      const url = `${API_BASE}/compatible-shapers/${lightAssetId}${params.toString() ? '?' + params.toString() : ', '}`;
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch compatible shapers: ${response.statusText}`);
      }

      const data = await response.json();
      return data.shapers || [];
    } catch (error) {
      log.error('Error fetching compatible shapers: ', error);
      return [];
    }
  }

  /**
   * Get the effects a shaper has on light properties
   */
  async getShaperEffects(shaperAssetId: string): Promise<ShaperEffects | null> {
    try {
      const response = await fetch(`${API_BASE}/shaper-effects/${shaperAssetId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch shaper effects: ${response.statusText}`);
      }

      const data = await response.json();
      return data.effects || null;
    } catch (error) {
      log.error('Error fetching shaper effects:', error);
      return null;
    }
  }

  /**
   * Apply shaper effects to a light node
   * This modifies the light's beam angle and power based on the shaper
   */
  applyShaperEffects(
    lightNode: any,
    shaper: LightShaper
  ): {
    beam: number;
    power: number;
    modifier: string;
  } {
    const currentBeam = lightNode.light?.beam || 60;
    const currentPower = lightNode.light?.power || 0.5;

    // Apply beam angle modifier
    let newBeam = currentBeam;
    if (shaper.beam_angle_modifier !== null) {
      newBeam = Math.max(5, Math.min(120, currentBeam + shaper.beam_angle_modifier));
    }

    // Apply power loss (in stops)
    // Each stop = 50% power loss
    const powerMultiplier = Math.pow(0.5, shaper.power_loss_stops);
    const newPower = Math.max(0.1, Math.min(1.0, currentPower * powerMultiplier));

    // Determine modifier type from shaper name
    const shaperName = shaper.shaper_name.toLowerCase();
    let modifierType = 'softbox'; // default

    if (shaperName.includes('octabox') || shaperName.includes('octa')) {
      modifierType = 'octabox';
    } else if (shaperName.includes('beauty')) {
      modifierType = 'beauty_dish';
    } else if (shaperName.includes('umbrella')) {
      modifierType = 'umbrella';
    } else if (shaperName.includes('grid') || shaperName.includes('snoot')) {
      modifierType = 'grid';
    } else if (shaperName.includes('reflector')) {
      modifierType = 'reflector';
    }

    return {
      beam: newBeam,
      power: newPower,
      modifier: modifierType,
    };
  }

  /**
   * Create an attached shaper object for a light node
   */
  createAttachedShaper(shaper: LightShaper): AttachedShaper {
    // Extract size from shaper name (e.g., "Softbox 60x90cm" -> [0.6, 0.9])
    const sizeMatch = shaper.shaper_name.match(/(\d+)(?:x(\d+))?cm/);
    let modifierSize: [number, number] = [0.6, 0.6]; // default 60x60cm

    if (sizeMatch) {
      const width = parseInt(sizeMatch[1]) / 100;
      const height = sizeMatch[2] ? parseInt(sizeMatch[2]) / 100 : width;
      modifierSize = [width, height];
    }

    return {
      shaperId: `shaper_${Math.random().toString(36).slice(2, 8)}`,
      shaperAssetId: shaper.shaper_id,
      modifierType: this.extractModifierType(shaper.shaper_name),
      modifierSize,
      effects: {
        beam_angle_modifier: shaper.beam_angle_modifier,
        power_loss_stops: shaper.power_loss_stops,
        diffusion_factor: shaper.diffusion_factor,
        notes: shaper.notes,
      },
    };
  }

  private extractModifierType(shaperName: string): string {
    const name = shaperName.toLowerCase();
    if (name.includes('softbox')) return 'softbox';
    if (name.includes('octabox') || name.includes('octa')) return 'octabox';
    if (name.includes('beauty')) return 'beauty_dish';
    if (name.includes('umbrella')) return 'umbrella';
    if (name.includes('grid') || name.includes('snoot')) return 'grid';
    if (name.includes('reflector')) return 'reflector';
    return'softbox';
  }
}

export const lightShaperService = new LightShaperService();

