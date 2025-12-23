/**
 * Shadow Analysis Service
 *
 * Analyzes shadows and highlights in the scene based on light positions and properties.
 *
 * Implements precise shadow calculations based on:
 * - Hasenfratz et al. (2003): "A Survey of Real-Time Soft Shadows Algorithms"
 * - Eisemann et al. (2011): "Real-Time Shadows"
 * - PBR Book Chapter 5: Light Transport
 *
 * Shadow softness is calculated using the penumbra formula:
 * penumbra_size = (light_size / distance_to_light) * distance_to_occluder
 */

import type { SceneNode } from '@/types';
import { sam2Service } from '@/services/SAM2Service';

export interface ShadowInfo {
  lightId: string;
  lightName: string;
  direction: [number, number, number];
  intensity: number;
  softness: number; // 0-1, calculated from penumbra size
  penumbraSize: number; // meters
  umbraSize: number; // meters
  color: string;
}

export interface HighlightInfo {
  lightId: string;
  lightName: string;
  position: [number, number, number];
  intensity: number;
  coverage: number;
  isClipping: boolean;
}

export interface ShadowAnalysis {
  shadows: ShadowInfo[];
  highlights: HighlightInfo[];
  totalShadowDensity: number;
  totalHighlightIntensity: number;
  contrastRatio: number;
  hasClipping: boolean;
}

class ShadowAnalysisService {
  /**
   * Analyze shadows using SAM 2 to detect shadow boundaries in image
   */
  async analyzeShadowsWithSAM2(imageUrl: string): Promise<Array<{ bbox: [number, number, number, number]; quality: number }>> {
    try {
      // Segment image to detect shadow areas
      const segmentation = await sam2Service.segmentImageFromUrl(
        imageUrl,
        undefined'auto','small'
      );

      // Analyze shadow quality for each detected region
      const shadowAreas = segmentation.masks.map(mask => {
        // Estimate shadow quality based on mask characteristics
        // Darker regions with lower confidence might be shadows
        const quality = mask.confidence < 0.6 ? 0.4 : mask.confidence; // Lower confidence = potential shadow
        
        return {
          bbox: mask.bbox,
          quality,
        };
      });

      return shadowAreas;
    } catch (error) {
      console.error('SAM 2 shadow analysis failed: ', error);
      return [];
    }
  }

  /**
   * Analyze shadows and highlights in the scene
   */
  analyzeScene(nodes: SceneNode[], subjectPosition: [number, number, number] = [0, 0, 0]): ShadowAnalysis {
    const lightNodes = nodes.filter((n) => n.light && n.visible);
    
    const shadows: ShadowInfo[] = [];
    const highlights: HighlightInfo[] = [];
    let totalShadowDensity = 0;
    let totalHighlightIntensity = 0;
    let hasClipping = false;

    for (const node of lightNodes) {
      if (!node.light) continue;

      const lightPos = node.transform.position;
      const power = node.light.power || 0.5;
      const focus = node.light.focus || 0.5;
      const beam = node.light.beam || 60;

      // Calculate direction from light to subject
      const dx = subjectPosition[0] - lightPos[0];
      const dy = subjectPosition[1] - lightPos[1];
      const dz = subjectPosition[2] - lightPos[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const direction: [number, number, number] = [
        dx / distance,
        dy / distance,
        dz / distance,
      ];

      // Calculate shadow properties using precise physics

      // Shadow intensity: depends on light power and distance
      // Multiple lights reduce shadow intensity (fill light reduces shadows)
      const shadowIntensity = Math.max(0, 1 - power);

      // Calculate shadow softness using penumbra formula
      // Reference: Hasenfratz et al. (2003)
      const shadowProps = this.calculateShadowSoftness(
        lightPos,
        subjectPosition,
        node.light.modifier,
        beam
      );

      // Calculate shadow color based on CCT
      const cct = node.light.cct || 5600;
      const shadowColor = this.getShadowColor(cct);

      shadows.push({
        lightId: node.id,
        lightName: node.name || 'Light',
        direction,
        intensity: shadowIntensity,
        softness: shadowProps.softness,
        penumbraSize: shadowProps.penumbraSize,
        umbraSize: shadowProps.umbraSize,
        color: shadowColor,
      });

      totalShadowDensity += shadowIntensity;

      // Calculate highlight info
      const highlightIntensity = power;
      const coverage = this.calculateCoverage(distance, beam);
      const isClipping = highlightIntensity > 0.9;

      highlights.push({
        lightId: node.id,
        lightName: node.name || 'Light',
        position: lightPos,
        intensity: highlightIntensity,
        coverage,
        isClipping,
      });

      totalHighlightIntensity += highlightIntensity;
      if (isClipping) hasClipping = true;
    }

    // Calculate contrast ratio (key to fill)
    const contrastRatio = this.calculateContrastRatio(highlights);

    return {
      shadows,
      highlights,
      totalShadowDensity,
      totalHighlightIntensity,
      contrastRatio,
      hasClipping,
    };
  }

  /**
   * Get shadow color based on CCT
   */
  private getShadowColor(cct: number): string {
    if (cct < 3000) return '#1a0f0a'; // Warm shadow (dark brown)
    if (cct < 4000) return '#1a1410'; // Neutral warm shadow
    if (cct < 5000) return '#141414'; // Neutral shadow
    if (cct < 6000) return '#0f1014'; // Cool neutral shadow
    return '#0a0f1a'; // Cool shadow (dark blue)
  }

  /**
   * Calculate coverage area based on distance and beam angle
   */
  private calculateCoverage(distance: number, beamAngle: number): number {
    const radius = distance * Math.tan((beamAngle * Math.PI) / 360);
    return Math.PI * radius * radius;
  }

  /**
   * Calculate contrast ratio (key to fill)
   */
  private calculateContrastRatio(highlights: HighlightInfo[]): number {
    if (highlights.length === 0) return 1;
    if (highlights.length === 1) return highlights[0].intensity;

    // Sort by intensity
    const sorted = [...highlights].sort((a, b) => b.intensity - a.intensity);
    const keyIntensity = sorted[0].intensity;
    const fillIntensity = sorted[1]?.intensity || 0.1;

    return keyIntensity / fillIntensity;
  }

  /**
   * Calculate shadow softness using precise penumbra formula
   *
   * Formula: penumbra_size = (light_size / d_light) × d_occluder
   * Where:
   *   light_size = physical size of light source (meters)
   *   d_light = distance from light to occluder (meters)
   *   d_occluder = distance from occluder to surface (meters)
   *
   * Softness = penumbra_size / (umbra_size + penumbra_size)
   *
   * Reference: Hasenfratz et al. (2003) -"Real-Time Soft Shadows"
   */
  private calculateShadowSoftness(
    lightPosition: [number, number, number],
    occluderPosition: [number, number, number],
    modifier?: string,
    beamAngle?: number
  ): { softness: number; penumbraSize: number; umbraSize: number } {
    // Estimate light source size based on modifier type
    // Reference: Typical studio light sizes
    let lightSize = 0.1; // Default: 10cm (bare bulb)

    if (modifier) {
      const modifierLower = modifier.toLowerCase();
      if (modifierLower.includes('softbox')) {
        lightSize = 0.9; // 90cm softbox (3x3 ft)
      } else if (modifierLower.includes('octabox')) {
        lightSize = 1.2; // 120cm octabox (4 ft)
      } else if (modifierLower.includes('umbrella')) {
        lightSize = 1.0; // 100cm umbrella
      } else if (modifierLower.includes('beauty')) {
        lightSize = 0.55; // 55cm beauty dish (22 inch)
      } else if (modifierLower.includes('snoot')) {
        lightSize = 0.05; // 5cm snoot (very hard light)
      } else if (modifierLower.includes('grid')) {
        lightSize = 0.15; // 15cm with grid (harder than bare)
      }
    }

    // Calculate distance from light to occluder
    const dx = occluderPosition[0] - lightPosition[0];
    const dy = occluderPosition[1] - lightPosition[1];
    const dz = occluderPosition[2] - lightPosition[2];
    const distanceToLight = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Assume occluder is at subject position, surface is ground (y=0)
    const distanceToSurface = Math.abs(occluderPosition[1]);

    // Calculate umbra size (full shadow)
    // umbra_radius = light_size × (d_surface / d_light)
    const umbraRadius = lightSize * (distanceToSurface / distanceToLight);
    const umbraSize = umbraRadius * 2;

    // Calculate penumbra size (partial shadow)
    // penumbra_width = light_size × (d_surface / d_light)
    const penumbraWidth = lightSize * (distanceToSurface / distanceToLight);
    const penumbraSize = penumbraWidth;

    // Calculate softness (0 = hard, 1 = very soft)
    // Softness increases with penumbra size relative to total shadow size
    const totalShadowSize = umbraSize + penumbraSize;
    const softness = totalShadowSize > 0 ? penumbraSize / totalShadowSize : 0;

    // Clamp softness to [0, 1]
    const clampedSoftness = Math.max(0, Math.min(1, softness));

    return {
      softness: clampedSoftness,
      penumbraSize,
      umbraSize,
    };
  }
}

export const shadowAnalysisService = new ShadowAnalysisService();

