/**
 * ASC CDL (Color Decision List) Service
 * 
 * Implements the American Society of Cinematographers Color Decision List standard
 * for color grading and color correction in professional film/video production.
 * 
 * ASC CDL Formula:
 * out = (in × slope + offset)^power
 * 
 * Where:
 * - slope: Multiplier (0-2, default 1.0) - Adjusts gain/contrast
 * - offset: Additive (-1 to 1, default 0.0) - Adjusts lift/brightness
 * - power: Exponent (0.1-4, default 1.0) - Adjusts gamma/midtones
 * - saturation: Color saturation (0-2, default 1.0)
 * 
 * References:
 * - ASC CDL Specification v1.2 (2009)
 * - AMPAS (Academy of Motion Picture Arts and Sciences)
 * - "Color Correction Handbook" by Alexis Van Hurkman
 * - "The Art and Technique of Digital Color Correction" by Steve Hullfish
 * 
 * Industry Usage:
 * - DaVinci Resolve
 * - Adobe Premiere Pro
 * - Final Cut Pro
 * - Baselight
 * - Nuke
 */

import * as THREE from 'three';
import { logger } from './logger';

const log = logger.module('ASC_CDL, ');

/**
 * ASC CDL Parameters
 * 
 * All values are per-channel (RGB) except saturation which is global.
 */
export interface ASCCDLParams {
  // Slope (gain/contrast) - multiplies input
  slope: THREE.Vector3; // [R, G, B] (0-2, default 1.0)
  
  // Offset (lift/brightness) - adds to input
  offset: THREE.Vector3; // [R, G, B] (-1 to 1, default 0.0)
  
  // Power (gamma/midtones) - exponential adjustment
  power: THREE.Vector3; // [R, G, B] (0.1-4, default 1.0)
  
  // Saturation - global color saturation
  saturation: number; // (0-2, default 1.0)
}

/**
 * ASC CDL Preset
 */
export interface ASCCDLPreset {
  id: string;
  name: string;
  description: string;
  category: 'film-look' | 'color-correction' | 'creative' | 'technical';
  params: ASCCDLParams;
  usedIn?: string[]; // Films/shows that use similar grades
}

/**
 * ASC CDL Metadata for XML export
 */
export interface ASCCDLMetadata {
  id: string;
  inputDescription?: string;
  viewingDescription?: string;
  description?: string;
}

class ASCCDLService {
  /**
   * Default ASC CDL parameters (no correction)
   */
  readonly DEFAULT_PARAMS: ASCCDLParams = {
    slope: new THREE.Vector3(1.0, 1.0, 1.0),
    offset: new THREE.Vector3(0.0, 0.0, 0.0),
    power: new THREE.Vector3(1.0, 1.0, 1.0),
    saturation: 1.0,
  };

  /**
   * Apply ASC CDL to a color
   * 
   * Formula: out = (in × slope + offset)^power
   * Then apply saturation
   * 
   * Reference: ASC CDL Specification v1.2, Section 3.1
   */
  applyASCCDL(color: THREE.Color, params: ASCCDLParams): THREE.Color {
    const result = color.clone();

    // Step 1: Apply slope, offset, power per channel
    // out = (in × slope + offset)^power
    result.r = Math.pow(
      Math.max(0, result.r * params.slope.x + params.offset.x),
      params.power.x
    );
    result.g = Math.pow(
      Math.max(0, result.g * params.slope.y + params.offset.y),
      params.power.y
    );
    result.b = Math.pow(
      Math.max(0, result.b * params.slope.z + params.offset.z),
      params.power.z
    );

    // Step 2: Apply saturation
    // Convert to luminance and lerp between grayscale and color
    if (params.saturation !== 1.0) {
      const luminance = 0.2126 * result.r + 0.7152 * result.g + 0.0722 * result.b;
      result.r = luminance + params.saturation * (result.r - luminance);
      result.g = luminance + params.saturation * (result.g - luminance);
      result.b = luminance + params.saturation * (result.b - luminance);
    }

    // Clamp to valid range
    result.r = Math.max(0, Math.min(1, result.r));
    result.g = Math.max(0, Math.min(1, result.g));
    result.b = Math.max(0, Math.min(1, result.b));

    return result;
  }

  /**
   * Generate GLSL shader code for ASC CDL
   * 
   * This can be integrated into Three.js materials for real-time color grading.
   */
  getShaderCode(): string {
    return `
      // ASC CDL Shader Code
      // Reference: ASC CDL Specification v1.2
      
      uniform vec3 cdlSlope;
      uniform vec3 cdlOffset;
      uniform vec3 cdlPower;
      uniform float cdlSaturation;
      
      vec3 applyASCCDL(vec3 color) {
        // Step 1: Apply slope, offset, power
        // out = (in × slope + offset)^power
        vec3 result = color * cdlSlope + cdlOffset;
        result = max(vec3(0.0), result); // Clamp negative values
        result = pow(result, cdlPower);
        
        // Step 2: Apply saturation
        float luminance = dot(result, vec3(0.2126, 0.7152, 0.0722));
        result = mix(vec3(luminance), result, cdlSaturation);
        
        // Clamp to valid range
        return clamp(result, 0.0, 1.0);
      }
    `;
  }

  /**
   * Create shader uniforms for ASC CDL
   */
  createShaderUniforms(params: ASCCDLParams): Record<string, THREE.IUniform> {
    return {
      cdlSlope: { value: params.slope.clone() },
      cdlOffset: { value: params.offset.clone() },
      cdlPower: { value: params.power.clone() },
      cdlSaturation: { value: params.saturation },
    };
  }

  /**
   * Validate ASC CDL parameters
   */
  validateParams(params: ASCCDLParams): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate slope (0-2)
    if (params.slope.x < 0 || params.slope.x > 2) errors.push('Slope R must be 0-2, ');
    if (params.slope.y < 0 || params.slope.y > 2) errors.push('Slope G must be 0-2, ');
    if (params.slope.z < 0 || params.slope.z > 2) errors.push('Slope B must be 0-2, ');

    // Validate offset (-1 to 1)
    if (params.offset.x < -1 || params.offset.x > 1) errors.push('Offset R must be -1 to 1');
    if (params.offset.y < -1 || params.offset.y > 1) errors.push('Offset G must be -1 to 1');
    if (params.offset.z < -1 || params.offset.z > 1) errors.push('Offset B must be -1 to 1');

    // Validate power (0.1-4)
    if (params.power.x < 0.1 || params.power.x > 4) errors.push('Power R must be 0.1-4');
    if (params.power.y < 0.1 || params.power.y > 4) errors.push('Power G must be 0.1-4');
    if (params.power.z < 0.1 || params.power.z > 4) errors.push('Power B must be 0.1-4');

    // Validate saturation (0-2)
    if (params.saturation < 0 || params.saturation > 2) errors.push('Saturation must be 0-2');

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get professional ASC CDL presets
   *
   * Based on common film looks and color correction techniques.
   * References: "Color Correction Handbook" by Alexis Van Hurkman
   */
  getPresets(): ASCCDLPreset[] {
    return [
      // Film Look Presets
      {
        id: 'film-print',
        name: 'Film Print Emulation',
        description: 'Classic film print look with lifted blacks and rolled-off highlights',
        category: 'film-look',
        params: {
          slope: new THREE.Vector3(1.1, 1.05, 1.0),
          offset: new THREE.Vector3(0.05, 0.03, 0.02),
          power: new THREE.Vector3(1.2, 1.15, 1.1),
          saturation: 1.1,
        },
        usedIn: ['The Grand Budapest Hotel','La La Land'],
      },
      {
        id: 'bleach-bypass',
        name: 'Bleach Bypass',
        description: 'Desaturated, high-contrast look popular in action films',
        category: 'film-look',
        params: {
          slope: new THREE.Vector3(1.3, 1.3, 1.3),
          offset: new THREE.Vector3(-0.05, -0.05, -0.05),
          power: new THREE.Vector3(0.9, 0.9, 0.9),
          saturation: 0.6,
        },
        usedIn: ['Saving Private Ryan','300'],
      },
      {
        id: 'teal-orange',
        name: 'Teal & Orange',
        description: 'Popular Hollywood blockbuster look with complementary colors',
        category: 'film-look',
        params: {
          slope: new THREE.Vector3(1.0, 1.1, 1.2),
          offset: new THREE.Vector3(0.05, 0.0, -0.05),
          power: new THREE.Vector3(1.0, 1.05, 1.1),
          saturation: 1.2,
        },
        usedIn: ['Transformers','Mad Max: Fury Road'],
      },
      {
        id: 'vintage-film',
        name: 'Vintage Film',
        description: 'Warm, faded look reminiscent of 1970s film stock',
        category: 'film-look',
        params: {
          slope: new THREE.Vector3(1.0, 0.95, 0.85),
          offset: new THREE.Vector3(0.08, 0.05, 0.03),
          power: new THREE.Vector3(1.3, 1.25, 1.2),
          saturation: 0.85,
        },
        usedIn: ['The Royal Tenenbaums','American Hustle'],
      },

      // Color Correction Presets
      {
        id: 'neutral',
        name: 'Neutral (No Correction)',
        description: 'Default values with no color correction applied',
        category: 'color-correction',
        params: this.DEFAULT_PARAMS,
      },
      {
        id: 'contrast-boost',
        name: 'Contrast Boost',
        description: 'Increases overall contrast without affecting color balance',
        category: 'color-correction',
        params: {
          slope: new THREE.Vector3(1.2, 1.2, 1.2),
          offset: new THREE.Vector3(-0.05, -0.05, -0.05),
          power: new THREE.Vector3(1.0, 1.0, 1.0),
          saturation: 1.0,
        },
      },
      {
        id: 'lift-shadows',
        name: 'Lift Shadows',
        description: 'Raises shadow detail without crushing blacks',
        category: 'color-correction',
        params: {
          slope: new THREE.Vector3(1.0, 1.0, 1.0),
          offset: new THREE.Vector3(0.1, 0.1, 0.1),
          power: new THREE.Vector3(1.0, 1.0, 1.0),
          saturation: 1.0,
        },
      },
      {
        id: 'warm-correction',
        name: 'Warm Color Correction',
        description: 'Adds warmth to compensate for cool lighting',
        category: 'color-correction',
        params: {
          slope: new THREE.Vector3(1.1, 1.0, 0.95),
          offset: new THREE.Vector3(0.02, 0.0, -0.02),
          power: new THREE.Vector3(1.0, 1.0, 1.0),
          saturation: 1.05,
        },
      },
      {
        id: 'cool-correction',
        name: 'Cool Color Correction',
        description: 'Adds coolness to compensate for warm lighting',
        category: 'color-correction',
        params: {
          slope: new THREE.Vector3(0.95, 1.0, 1.1),
          offset: new THREE.Vector3(-0.02, 0.0, 0.02),
          power: new THREE.Vector3(1.0, 1.0, 1.0),
          saturation: 1.05,
        },
      },

      // Creative Presets
      {
        id: 'moonlight',
        name: 'Moonlight',
        description: 'Cool, desaturated night look',
        category: 'creative',
        params: {
          slope: new THREE.Vector3(0.8, 0.9, 1.2),
          offset: new THREE.Vector3(-0.05, 0.0, 0.05),
          power: new THREE.Vector3(1.2, 1.15, 1.0),
          saturation: 0.7,
        },
        usedIn: ['Moonlight','Drive'],
      },
      {
        id: 'golden-hour',
        name: 'Golden Hour',
        description: 'Warm, glowing sunset look',
        category: 'creative',
        params: {
          slope: new THREE.Vector3(1.2, 1.1, 0.9),
          offset: new THREE.Vector3(0.05, 0.02, -0.03),
          power: new THREE.Vector3(0.95, 1.0, 1.1),
          saturation: 1.15,
        },
        usedIn: ['The Revenant','Days of Heaven'],
      },
      {
        id: 'noir',
        name: 'Film Noir',
        description: 'High contrast, desaturated black and white look',
        category: 'creative',
        params: {
          slope: new THREE.Vector3(1.5, 1.5, 1.5),
          offset: new THREE.Vector3(-0.1, -0.1, -0.1),
          power: new THREE.Vector3(0.8, 0.8, 0.8),
          saturation: 0.0,
        },
        usedIn: ['Sin City','The Man Who Wasn\'t There'],
      },

      // Technical Presets
      {
        id: 'rec709',
        name: 'Rec. 709 (HDTV)',
        description: 'Standard HDTV color space',
        category: 'technical',
        params: {
          slope: new THREE.Vector3(1.0, 1.0, 1.0),
          offset: new THREE.Vector3(0.0, 0.0, 0.0),
          power: new THREE.Vector3(0.45, 0.45, 0.45), // Gamma 2.2
          saturation: 1.0,
        },
      },
      {
        id: 'log-to-rec709',
        name: 'Log to Rec. 709',
        description: 'Convert log footage to Rec. 709 viewing space',
        category: 'technical',
        params: {
          slope: new THREE.Vector3(1.5, 1.5, 1.5),
          offset: new THREE.Vector3(-0.15, -0.15, -0.15),
          power: new THREE.Vector3(0.6, 0.6, 0.6),
          saturation: 1.1,
        },
      },
    ];
  }

  /**
   * Get preset by ID
   */
  getPresetById(id: string): ASCCDLPreset | undefined {
    return this.getPresets().find(p => p.id === id);
  }

  /**
   * Get presets by category
   */
  getPresetsByCategory(category: ASCCDLPreset['category']): ASCCDLPreset[] {
    return this.getPresets().filter(p => p.category === category);
  }

  /**
   * Export ASC CDL to XML format
   *
   * Follows ASC CDL XML Schema v1.2
   * Compatible with DaVinci Resolve, Premiere Pro, Final Cut Pro, etc.
   *
   * Reference: ASC CDL Specification v1.2, Appendix A
   */
  exportToXML(params: ASCCDLParams, metadata?: ASCCDLMetadata): string {
    const id = metadata?.id || 'cdl-' + Date.now();
    const inputDesc = metadata?.inputDescription || ', ';
    const viewingDesc = metadata?.viewingDescription || ', ';
    const description = metadata?.description || ', ';

    // Format numbers to 6 decimal places (ASC CDL standard)
    const formatNum = (n: number) => n.toFixed(6);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ColorDecisionList xmlns="urn:ASC:CDL:v1.2">
  <ColorDecision>
    <ColorCorrection id="${id}">
      ${inputDesc ? `<InputDescription>${inputDesc}</InputDescription>` : ', '}
      ${viewingDesc ? `<ViewingDescription>${viewingDesc}</ViewingDescription>` : ', '}
      ${description ? `<Description>${description}</Description>` : ', '}
      <SOPNode>
        <Slope>${formatNum(params.slope.x)} ${formatNum(params.slope.y)} ${formatNum(params.slope.z)}</Slope>
        <Offset>${formatNum(params.offset.x)} ${formatNum(params.offset.y)} ${formatNum(params.offset.z)}</Offset>
        <Power>${formatNum(params.power.x)} ${formatNum(params.power.y)} ${formatNum(params.power.z)}</Power>
      </SOPNode>
      <SatNode>
        <Saturation>${formatNum(params.saturation)}</Saturation>
      </SatNode>
    </ColorCorrection>
  </ColorDecision>
</ColorDecisionList>`;

    return xml;
  }

  /**
   * Import ASC CDL from XML format
   *
   * Parses ASC CDL XML and extracts parameters.
   * Compatible with exports from DaVinci Resolve, Premiere Pro, etc.
   *
   * Reference: ASC CDL Specification v1.2, Appendix A
   */
  importFromXML(xml: string): { params: ASCCDLParams; metadata: ASCCDLMetadata } | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml'text/xml');

      // Check for parse errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        log.error('XML parse error: ', parserError.textContent);
        return null;
      }

      // Extract ColorCorrection element
      const colorCorrection = doc.querySelector('ColorCorrection');
      if (!colorCorrection) {
        log.error('No ColorCorrection element found');
        return null;
      }

      // Extract metadata
      const id = colorCorrection.getAttribute('id') || 'imported-cdl';
      const inputDescription = colorCorrection.querySelector('InputDescription')?.textContent || undefined;
      const viewingDescription = colorCorrection.querySelector('ViewingDescription')?.textContent || undefined;
      const description = colorCorrection.querySelector('Description')?.textContent || undefined;

      // Extract SOPNode (Slope, Offset, Power)
      const sopNode = colorCorrection.querySelector('SOPNode');
      if (!sopNode) {
        log.error('No SOPNode element found');
        return null;
      }

      const slopeText = sopNode.querySelector('Slope')?.textContent?.trim();
      const offsetText = sopNode.querySelector('Offset')?.textContent?.trim();
      const powerText = sopNode.querySelector('Power')?.textContent?.trim();

      if (!slopeText || !offsetText || !powerText) {
        log.error('Missing Slope, Offset, or Power values');
        return null;
      }

      const parseVec3 = (text: string): THREE.Vector3 => {
        const values = text.split(/\s+/).map(parseFloat);
        if (values.length !== 3 || values.some(isNaN)) {
          throw new Error('Invalid vector3 format');
        }
        return new THREE.Vector3(values[0], values[1], values[2]);
      };

      const slope = parseVec3(slopeText);
      const offset = parseVec3(offsetText);
      const power = parseVec3(powerText);

      // Extract SatNode (Saturation)
      const satNode = colorCorrection.querySelector('SatNode');
      const saturationText = satNode?.querySelector('Saturation')?.textContent?.trim();
      const saturation = saturationText ? parseFloat(saturationText) : 1.0;

      if (isNaN(saturation)) {
        log.error('Invalid saturation value');
        return null;
      }

      const params: ASCCDLParams = { slope, offset, power, saturation };
      const metadata: ASCCDLMetadata = { id, inputDescription, viewingDescription, description };

      // Validate parameters
      const validation = this.validateParams(params);
      if (!validation.valid) {
        log.error('Invalid CDL parameters:', validation.errors);
        return null;
      }

      return { params, metadata };
    } catch (error) {
      log.error('Error importing ASC CDL XML:', error);
      return null;
    }
  }

  /**
   * Export ASC CDL to JSON format (for internal storage)
   */
  exportToJSON(params: ASCCDLParams, metadata?: ASCCDLMetadata): string {
    const data = {
      version: '1.2',
      metadata: metadata || {},
      params: {
        slope: [params.slope.x, params.slope.y, params.slope.z],
        offset: [params.offset.x, params.offset.y, params.offset.z],
        power: [params.power.x, params.power.y, params.power.z],
        saturation: params.saturation,
      },
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import ASC CDL from JSON format
   */
  importFromJSON(json: string): { params: ASCCDLParams; metadata: ASCCDLMetadata } | null {
    try {
      const data = JSON.parse(json);

      if (!data.params) {
        log.error('No params found in JSON');
        return null;
      }

      const params: ASCCDLParams = {
        slope: new THREE.Vector3(data.params.slope[0], data.params.slope[1], data.params.slope[2]),
        offset: new THREE.Vector3(data.params.offset[0], data.params.offset[1], data.params.offset[2]),
        power: new THREE.Vector3(data.params.power[0], data.params.power[1], data.params.power[2]),
        saturation: data.params.saturation,
      };

      const metadata: ASCCDLMetadata = data.metadata || { id:'imported-cdl' };

      // Validate parameters
      const validation = this.validateParams(params);
      if (!validation.valid) {
        log.error('Invalid CDL parameters:', validation.errors);
        return null;
      }

      return { params, metadata };
    } catch (error) {
      log.error('Error importing ASC CDL JSON:', error);
      return null;
    }
  }
}

export const ascCDLService = new ASCCDLService();

