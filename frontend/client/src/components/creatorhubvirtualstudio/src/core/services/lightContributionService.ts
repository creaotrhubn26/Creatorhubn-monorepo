import type { SceneNode } from '@/core/models/scene';

/**
 * Light Contribution Analysis
 * 
 * Analyzes and manages individual light contributions to the scene.
 * Allows toggling lights on/off to see their individual impact.
 */

export interface LightContribution {
  lightId: string;
  lightName: string;
  role?: string; // key, fill, rim, background
  isEnabled: boolean;
  power: number; // 0-1
  cct?: number;
  position: [number, number, number];
  contribution: number; // Estimated contribution to scene (0-1)
}

export interface ContributionAnalysis {
  lights: LightContribution[];
  totalContribution: number;
  dominantLight: string | null; // ID of light with highest contribution
  balance: 'good' | 'unbalanced' | 'single-source';
}

class LightContributionService {
  private enabledLights: Set<string> = new Set();

  /**
   * Analyze light contributions from scene nodes
   */
  analyzeLights(nodes: SceneNode[]): ContributionAnalysis {
    const lightNodes = nodes.filter((n) => n.light && n.visible);
    
    const lights: LightContribution[] = lightNodes.map((node) => {
      const light = node.light!;
      const isEnabled = this.enabledLights.size === 0 || this.enabledLights.has(node.id);
      
      // Calculate contribution based on power and distance
      const contribution = this.calculateContribution(node);
      
      return {
        lightId: node.id,
        lightName: node.name || `Light ${node.id.slice(0, 4)}`,
        role: node.patternContext?.role,
        isEnabled,
        power: light.power,
        cct: light.cct,
        position: [
          node.transform.position[0],
          node.transform.position[1],
          node.transform.position[2],
        ],
        contribution,
      };
    });

    // Calculate total contribution (only from enabled lights)
    const totalContribution = lights
      .filter((l) => l.isEnabled)
      .reduce((sum, l) => sum + l.contribution, 0);

    // Find dominant light
    const enabledLights = lights.filter((l) => l.isEnabled);
    const dominantLight = enabledLights.length > 0
      ? enabledLights.reduce((max, l) => (l.contribution > max.contribution ? l : max))
      : null;

    // Determine balance
    let balance: 'good' | 'unbalanced' | 'single-source' = 'good';
    if (enabledLights.length === 1) {
      balance = 'single-source';
    } else if (dominantLight && dominantLight.contribution > totalContribution * 0.7) {
      balance ='unbalanced';
    }

    return {
      lights,
      totalContribution,
      dominantLight: dominantLight?.lightId || null,
      balance,
    };
  }

  /**
   * Calculate contribution of a single light
   * Based on power, distance, and beam angle
   */
  private calculateContribution(node: SceneNode): number {
    const light = node.light!;
    const power = light.power;
    
    // Distance from origin (subject position)
    const pos = node.transform.position;
    const distance = Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2);
    
    // Inverse square law approximation
    const distanceFactor = 1 / Math.max(distance ** 2, 0.1);
    
    // Beam angle factor (wider beam = more coverage but less intensity)
    const beamAngle = light.beam || 60;
    const beamFactor = 60 / beamAngle; // Normalize to 60° standard
    
    // Combined contribution
    const contribution = power * distanceFactor * beamFactor;
    
    // Normalize to reasonable range (0-1)
    return Math.min(contribution * 10, 1);
  }

  /**
   * Toggle a specific light on/off
   */
  toggleLight(lightId: string, enabled: boolean): void {
    if (enabled) {
      this.enabledLights.add(lightId);
    } else {
      this.enabledLights.delete(lightId);
    }
  }

  /**
   * Enable only specific lights (disable all others)
   */
  soloLight(lightId: string): void {
    this.enabledLights.clear();
    this.enabledLights.add(lightId);
  }

  /**
   * Enable all lights
   */
  enableAllLights(): void {
    this.enabledLights.clear();
  }

  /**
   * Disable all lights
   */
  disableAllLights(lightIds: string[]): void {
    this.enabledLights.clear();
    // Add all IDs then clear to mark as "explicitly disabled"
    lightIds.forEach((id) => this.enabledLights.delete(id));
  }

  /**
   * Check if a light is enabled
   */
  isLightEnabled(lightId: string): boolean {
    return this.enabledLights.size === 0 || this.enabledLights.has(lightId);
  }

  /**
   * Get all enabled light IDs
   */
  getEnabledLights(): string[] {
    return Array.from(this.enabledLights);
  }

  /**
   * Get contribution percentage for a light
   */
  getContributionPercentage(lightId: string, analysis: ContributionAnalysis): number {
    const light = analysis.lights.find((l) => l.lightId === lightId);
    if (!light || !light.isEnabled) return 0;
    
    return analysis.totalContribution > 0
      ? (light.contribution / analysis.totalContribution) * 100
      : 0;
  }
}

export const lightContributionService = new LightContributionService();

