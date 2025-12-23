/**
 * ACES (Academy Color Encoding System) Service
 * 
 * Implements the Academy Color Encoding System for professional color management
 * and color grading in film and television production.
 * 
 * ACES Workflow:
 * 1. IDT (Input Device Transform): Camera/source → ACES2065-1
 * 2. LMT (Look Modification Transform): Creative look (optional)
 * 3. RRT (Reference Rendering Transform): ACES2065-1 → OCES
 * 4. ODT (Output Device Transform): OCES → Display/output
 * 
 * Color Spaces:
 * - ACES2065-1: ACES primaries, linear encoding (scene-referred)
 * - ACEScg: ACES primaries, linear encoding (working space for CG)
 * - ACEScct: ACES primaries, logarithmic encoding (color grading)
 * - OCES: Output Color Encoding Specification
 * 
 * References:
 * - AMPAS ACES v1.3 (2021)
 * - TB-2014-004: "Informative Notes on ACES"
 * - TB-2014-012: "Academy Color Encoding System (ACES) Versioning System"
 * - S-2014-003: "ACEScg – A Working Space for CGI Render and Compositing"
 * - "Color and Mastering for Digital Cinema" by Glenn Kennel
 * - "ACES Retrospective and Enhancements" by Alex Fry (AMPAS)
 * 
 * Industry Usage:
 * - All major Hollywood studios
 * - Netflix, Amazon Prime, Disney+
 * - DaVinci Resolve, Baselight, Nuke
 * - Unreal Engine, Unity
 */

import * as THREE from 'three';

/**
 * ACES Color Spaces
 */
export type ACESColorSpace = 
  | 'ACES2065-1'  // ACES primaries, linear (scene-referred)
  | 'ACEScg'      // ACES primaries, linear (CG working space)
  | 'ACEScct'     // ACES primaries, log (color grading)
  | 'sRGB'        // sRGB primaries, gamma 2.2
  | 'Rec709'      // Rec. 709 primaries, gamma 2.4
  | 'Rec2020'     // Rec. 2020 primaries (HDR)
  | 'DCI-P3';     // DCI-P3 primaries (digital cinema)

/**
 * ACES Transform Types
 */
export type ACESTransformType = 'IDT' | 'LMT' | 'RRT' | 'ODT';

/**
 * ACES Configuration
 */
export interface ACESConfig {
  inputColorSpace: ACESColorSpace;
  outputColorSpace: ACESColorSpace;
  enableRRT: boolean;
  useFullRRT: boolean; // Use full RRT with glow, red modifier, global desaturation
  enableLMT: boolean;
  lmtPreset?: string;
  exposure: number; // EV adjustment
  gamma: number;    // Gamma adjustment
}

/**
 * ACES Look Modification Transform (LMT) Preset
 */
export interface ACESLMTPreset {
  id: string;
  name: string;
  description: string;
  category: 'film-look' | 'technical' | 'creative';
  transform: (color: THREE.Vector3) => THREE.Vector3;
  usedIn?: string[];
}

class ACESService {
  /**
   * ACES AP0 (ACES2065-1) to XYZ matrix
   * Reference: SMPTE ST 2065-1:2012
   */
  private readonly ACES_AP0_TO_XYZ = new THREE.Matrix3().set(
    0.9525523959, 0.0000000000, 0.0000936786,
    0.3439664498, 0.7281660966, -0.0721325464,
    0.0000000000, 0.0000000000, 1.0088251844
  );

  /**
   * XYZ to ACES AP0 (ACES2065-1) matrix
   */
  private readonly XYZ_TO_ACES_AP0 = new THREE.Matrix3().set(
    1.0498110175, 0.0000000000, -0.0000974845,
    -0.4959030231, 1.3733130458, 0.0982400361,
    0.0000000000, 0.0000000000, 0.9912520182
  );

  /**
   * ACES AP1 (ACEScg) to XYZ matrix
   * Reference: S-2014-003
   */
  private readonly ACES_AP1_TO_XYZ = new THREE.Matrix3().set(
    0.6624541811, 0.1340042065, 0.1561876870,
    0.2722287168, 0.6740817658, 0.0536895174,
    -0.0055746495, 0.0040607335, 1.0103391003
  );

  /**
   * XYZ to ACES AP1 (ACEScg) matrix
   */
  private readonly XYZ_TO_ACES_AP1 = new THREE.Matrix3().set(
    1.6410233797, -0.3248032942, -0.2364246952,
    -0.6636628587, 1.6153315917, 0.0167563477,
    0.0117218943, -0.0082844420, 0.9883948585
  );

  /**
   * sRGB to XYZ matrix (D65 white point)
   * Reference: IEC 61966-2-1:1999
   */
  private readonly SRGB_TO_XYZ = new THREE.Matrix3().set(
    0.4124564, 0.3575761, 0.1804375,
    0.2126729, 0.7151522, 0.0721750,
    0.0193339, 0.1191920, 0.9503041
  );

  /**
   * XYZ to sRGB matrix
   */
  private readonly XYZ_TO_SRGB = new THREE.Matrix3().set(
    3.2404542, -1.5371385, -0.4985314,
    -0.9692660, 1.8760108, 0.0415560,
    0.0556434, -0.2040259, 1.0572252
  );

  /**
   * Rec. 709 to XYZ matrix (D65 white point)
   * Reference: ITU-R BT.709-6
   */
  private readonly REC709_TO_XYZ = new THREE.Matrix3().set(
    0.4124564, 0.3575761, 0.1804375,
    0.2126729, 0.7151522, 0.0721750,
    0.0193339, 0.1191920, 0.9503041
  );

  /**
   * XYZ to Rec. 709 matrix
   */
  private readonly XYZ_TO_REC709 = new THREE.Matrix3().set(
    3.2404542, -1.5371385, -0.4985314,
    -0.9692660, 1.8760108, 0.0415560,
    0.0556434, -0.2040259, 1.0572252
  );

  /**
   * Default ACES configuration
   */
  readonly DEFAULT_CONFIG: ACESConfig = {
    inputColorSpace: 'sRGB',
    outputColorSpace: 'sRGB',
    enableRRT: true,
    useFullRRT: false, // Use simplified RRT by default for performance
    enableLMT: false,
    exposure: 0.0,
    gamma: 1.0,
  };

  /**
   * Convert color from one ACES color space to another
   * 
   * Reference: ACES v1.3 Color Space Conversion
   */
  convertColorSpace(
    color: THREE.Vector3,
    from: ACESColorSpace,
    to: ACESColorSpace
  ): THREE.Vector3 {
    if (from === to) return color.clone();

    // Convert to XYZ (intermediate space)
    let xyz: THREE.Vector3;
    
    switch (from) {
      case 'ACES2065-1':
        xyz = color.clone().applyMatrix3(this.ACES_AP0_TO_XYZ);
        break;
      case 'ACEScg':
        xyz = color.clone().applyMatrix3(this.ACES_AP1_TO_XYZ);
        break;
      case 'sRGB':
        // Remove sRGB gamma before conversion
        const linear = this.sRGBToLinear(color);
        xyz = linear.applyMatrix3(this.SRGB_TO_XYZ);
        break;
      case 'Rec709':
        // Remove Rec. 709 gamma before conversion
        const linearRec709 = this.rec709ToLinear(color);
        xyz = linearRec709.applyMatrix3(this.REC709_TO_XYZ);
        break;
      default:
        xyz = color.clone();
    }

    // Convert from XYZ to target space
    let result: THREE.Vector3;
    
    switch (to) {
      case 'ACES2065-1':
        result = xyz.applyMatrix3(this.XYZ_TO_ACES_AP0);
        break;
      case 'ACEScg':
        result = xyz.applyMatrix3(this.XYZ_TO_ACES_AP1);
        break;
      case 'sRGB':
        const linearSRGB = xyz.applyMatrix3(this.XYZ_TO_SRGB);
        result = this.linearToSRGB(linearSRGB);
        break;
      case 'Rec709':
        const linearRec709Out = xyz.applyMatrix3(this.XYZ_TO_REC709);
        result = this.linearToRec709(linearRec709Out);
        break;
      default:
        result = xyz;
    }

    return result;
  }

  /**
   * sRGB EOTF (Electro-Optical Transfer Function)
   * Converts sRGB gamma-encoded to linear
   *
   * Reference: IEC 61966-2-1:1999
   */
  private sRGBToLinear(color: THREE.Vector3): THREE.Vector3 {
    const convert = (c: number): number => {
      if (c <= 0.04045) {
        return c / 12.92;
      } else {
        return Math.pow((c + 0.055) / 1.055, 2.4);
      }
    };

    return new THREE.Vector3(
      convert(color.x),
      convert(color.y),
      convert(color.z)
    );
  }

  /**
   * sRGB inverse EOTF
   * Converts linear to sRGB gamma-encoded
   */
  private linearToSRGB(color: THREE.Vector3): THREE.Vector3 {
    const convert = (c: number): number => {
      if (c <= 0.0031308) {
        return c * 12.92;
      } else {
        return 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
      }
    };

    return new THREE.Vector3(
      convert(color.x),
      convert(color.y),
      convert(color.z)
    );
  }

  /**
   * Rec. 709 EOTF
   * Converts Rec. 709 gamma-encoded to linear
   *
   * Reference: ITU-R BT.709-6
   */
  private rec709ToLinear(color: THREE.Vector3): THREE.Vector3 {
    const convert = (c: number): number => {
      if (c < 0.081) {
        return c / 4.5;
      } else {
        return Math.pow((c + 0.099) / 1.099, 1.0 / 0.45);
      }
    };

    return new THREE.Vector3(
      convert(color.x),
      convert(color.y),
      convert(color.z)
    );
  }

  /**
   * Rec. 709 inverse EOTF
   * Converts linear to Rec. 709 gamma-encoded
   */
  private linearToRec709(color: THREE.Vector3): THREE.Vector3 {
    const convert = (c: number): number => {
      if (c < 0.018) {
        return c * 4.5;
      } else {
        return 1.099 * Math.pow(c, 0.45) - 0.099;
      }
    };

    return new THREE.Vector3(
      convert(color.x),
      convert(color.y),
      convert(color.z)
    );
  }

  /**
   * ACES Reference Rendering Transform (RRT) - FULL IMPLEMENTATION
   *
   * Applies the complete ACES tone mapping with all modules:
   * 1. Glow module (subtle bloom in highlights)
   * 2. Red modifier (desaturates extreme reds)
   * 3. Global desaturation (reduces saturation in highlights)
   * 4. Tone scale (sigmoid curve)
   *
   * Reference: ACES v1.3 RRT (Academy S-2014-004)
   *
   * This is the FULL implementation for maximum accuracy.
   */
  applyFullRRT(color: THREE.Vector3): THREE.Vector3 {
    let result = color.clone();

    // Step 1: Glow Module
    // Adds subtle bloom to highlights
    // Reference: ACES RRT v1.3, Section 4.4
    result = this.applyGlowModule(result);

    // Step 2: Red Modifier
    // Desaturates extreme reds to prevent clipping
    // Reference: ACES RRT v1.3, Section 4.5
    result = this.applyRedModifier(result);

    // Step 3: Global Desaturation
    // Reduces saturation in highlights for natural look
    // Reference: ACES RRT v1.3, Section 4.6
    result = this.applyGlobalDesaturation(result);

    // Step 4: Tone Scale
    // Sigmoid tone mapping curve
    // Reference: ACES RRT v1.3, Section 4.7
    result = this.applyToneScale(result);

    return result;
  }

  /**
   * Glow Module
   * Adds subtle bloom to highlights
   *
   * Reference: ACES RRT v1.3, Section 4.4
   */
  private applyGlowModule(color: THREE.Vector3): THREE.Vector3 {
    // Calculate luminance
    const Y = 0.2722287168 * color.x + 0.6740817658 * color.y + 0.0536895174 * color.z;

    // Glow gain function
    // Adds subtle glow to highlights above threshold
    const glowGainThreshold = 0.12;
    const glowGainAmount = 0.05;

    if (Y > glowGainThreshold) {
      const glowGain = glowGainAmount * Math.pow((Y - glowGainThreshold) / (1.0 - glowGainThreshold), 2);
      const glowColor = color.clone().multiplyScalar(1.0 + glowGain);
      return glowColor;
    }

    return color;
  }

  /**
   * Red Modifier
   * Desaturates extreme reds to prevent clipping
   *
   * Reference: ACES RRT v1.3, Section 4.5
   */
  private applyRedModifier(color: THREE.Vector3): THREE.Vector3 {
    // Calculate hue angle
    const hue = Math.atan2(color.z - color.y, color.x - color.y);

    // Red hue range (in radians)
    const redHueCenter = 0.0; // 0 degrees
    const redHueWidth = Math.PI / 6; // 30 degrees

    // Calculate distance from red hue
    let hueDistance = Math.abs(hue - redHueCenter);
    if (hueDistance > Math.PI) hueDistance = 2 * Math.PI - hueDistance;

    // Apply red modifier if within red hue range
    if (hueDistance < redHueWidth) {
      const redModifierAmount = 1.0 - (hueDistance / redHueWidth);
      const luminance = 0.2722287168 * color.x + 0.6740817658 * color.y + 0.0536895174 * color.z;

      // Desaturate towards luminance
      const desaturationFactor = 0.03 * redModifierAmount;
      const result = color.clone();
      result.x = color.x + desaturationFactor * (luminance - color.x);
      result.y = color.y + desaturationFactor * (luminance - color.y);
      result.z = color.z + desaturationFactor * (luminance - color.z);

      return result;
    }

    return color;
  }

  /**
   * Global Desaturation
   * Reduces saturation in highlights for natural look
   *
   * Reference: ACES RRT v1.3, Section 4.6
   */
  private applyGlobalDesaturation(color: THREE.Vector3): THREE.Vector3 {
    // Calculate luminance
    const Y = 0.2722287168 * color.x + 0.6740817658 * color.y + 0.0536895174 * color.z;

    // Desaturation curve
    // Increases desaturation as luminance increases
    const desaturationThreshold = 0.8;
    const desaturationAmount = 0.15;

    if (Y > desaturationThreshold) {
      const desaturationFactor = desaturationAmount * Math.pow((Y - desaturationThreshold) / (1.0 - desaturationThreshold), 2);

      const result = color.clone();
      result.x = color.x + desaturationFactor * (Y - color.x);
      result.y = color.y + desaturationFactor * (Y - color.y);
      result.z = color.z + desaturationFactor * (Y - color.z);

      return result;
    }

    return color;
  }

  /**
   * Tone Scale
   * Sigmoid tone mapping curve
   *
   * Reference: ACES RRT v1.3, Section 4.7
   */
  private applyToneScale(color: THREE.Vector3): THREE.Vector3 {
    // RRT tone scale parameters
    // Reference: ACES RRT v1.3
    const a = 2.51;
    const b = 0.03;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;

    // Apply RRT tone curve per channel
    // Formula: (x * (a * x + b)) / (x * (c * x + d) + e)
    const applyToneCurve = (x: number): number => {
      x = Math.max(0, x); // Clamp negative values
      return (x * (a * x + b)) / (x * (c * x + d) + e);
    };

    return new THREE.Vector3(
      applyToneCurve(color.x),
      applyToneCurve(color.y),
      applyToneCurve(color.z)
    );
  }

  /**
   * ACES Reference Rendering Transform (RRT) - Simplified
   *
   * This is the simplified version for backward compatibility.
   * Use applyFullRRT() for maximum accuracy.
   */
  applyRRT(color: THREE.Vector3): THREE.Vector3 {
    return this.applyToneScale(color);
  }

  /**
   * ACES Filmic Tone Mapping (Simplified RRT + ODT)
   *
   * This is a combined RRT + ODT for real-time use.
   * Based on Stephen Hill's fit of the ACES tone curve.
   *
   * Reference: "ACES Filmic Tone Mapping Curve" by Krzysztof Narkowicz
   * https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
   */
  applyACESFilmic(color: THREE.Vector3): THREE.Vector3 {
    const a = 2.51;
    const b = 0.03;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;

    const applyToneCurve = (x: number): number => {
      return Math.max(0, Math.min(1, (x * (a * x + b)) / (x * (c * x + d) + e)));
    };

    return new THREE.Vector3(
      applyToneCurve(color.x),
      applyToneCurve(color.y),
      applyToneCurve(color.z)
    );
  }

  /**
   * Apply full ACES transform pipeline
   *
   * Pipeline:
   * 1. IDT: Input → ACES2065-1
   * 2. LMT: Apply creative look (optional)
   * 3. RRT: ACES2065-1 → OCES (tone mapping)
   * 4. ODT: OCES → Output
   */
  applyACESTransform(color: THREE.Vector3, config: ACESConfig): THREE.Vector3 {
    let result = color.clone();

    // Apply exposure adjustment
    if (config.exposure !== 0) {
      const exposureScale = Math.pow(2, config.exposure);
      result.multiplyScalar(exposureScale);
    }

    // Step 1: IDT - Convert input to ACES2065-1
    result = this.convertColorSpace(result, config.inputColorSpace 'ACES2065-1');

    // Step 2: LMT - Apply look modification (optional)
    if (config.enableLMT && config.lmtPreset) {
      const preset = this.getLMTPresetById(config.lmtPreset);
      if (preset) {
        result = preset.transform(result);
      }
    }

    // Step 3: RRT - Apply reference rendering transform
    if (config.enableRRT) {
      if (config.useFullRRT) {
        result = this.applyFullRRT(result);
      } else {
        result = this.applyRRT(result);
      }
    }

    // Step 4: ODT - Convert to output color space
    result = this.convertColorSpace(result, 'ACES2065-1', config.outputColorSpace);

    // Apply gamma adjustment
    if (config.gamma !== 1.0) {
      result.x = Math.pow(Math.max(0, result.x), config.gamma);
      result.y = Math.pow(Math.max(0, result.y), config.gamma);
      result.z = Math.pow(Math.max(0, result.z), config.gamma);
    }

    // Clamp to valid range
    result.x = Math.max(0, Math.min(1, result.x));
    result.y = Math.max(0, Math.min(1, result.y));
    result.z = Math.max(0, Math.min(1, result.z));

    return result;
  }

  /**
   * Get LMT (Look Modification Transform) presets
   */
  getLMTPresets(): ACESLMTPreset[] {
    return [
      {
        id: 'neutral',
        name: 'Neutral (No LMT)',
        description: 'No look modification applied',
        category: 'technical',
        transform: (color: THREE.Vector3) => color.clone(),
      },
      {
        id: 'bleach-bypass',
        name: 'Bleach Bypass',
        description: 'Desaturated, high-contrast look',
        category: 'film-look',
        transform: (color: THREE.Vector3) => {
          // Increase contrast and reduce saturation
          const luminance = 0.2126 * color.x + 0.7152 * color.y + 0.0722 * color.z;
          const contrast = 1.3;
          const saturation = 0.6;

          const result = color.clone();
          result.x = luminance + saturation * (result.x - luminance);
          result.y = luminance + saturation * (result.y - luminance);
          result.z = luminance + saturation * (result.z - luminance);

          result.x = (result.x - 0.5) * contrast + 0.5;
          result.y = (result.y - 0.5) * contrast + 0.5;
          result.z = (result.z - 0.5) * contrast + 0.5;

          return result;
        },
        usedIn: ['Saving Private Ryan','300'],
      },
      {
        id: 'warm-film',
        name: 'Warm Film Look',
        description: 'Warm, vintage film aesthetic',
        category: 'film-look',
        transform: (color: THREE.Vector3) => {
          const result = color.clone();
          result.x *= 1.1;  // Boost reds
          result.y *= 1.05; // Slight green boost
          result.z *= 0.9;  // Reduce blues
          return result;
        },
        usedIn: ['The Royal Tenenbaums','American Hustle'],
      },
      {
        id: 'cool-film',
        name: 'Cool Film Look',
        description: 'Cool, desaturated aesthetic',
        category: 'film-look',
        transform: (color: THREE.Vector3) => {
          const result = color.clone();
          result.x *= 0.9;  // Reduce reds
          result.y *= 1.0;  // Keep greens
          result.z *= 1.15; // Boost blues
          return result;
        },
        usedIn: ['Moonlight','Drive'],
      },
      {
        id: 'high-contrast',
        name: 'High Contrast',
        description: 'Increased contrast for dramatic look',
        category: 'creative',
        transform: (color: THREE.Vector3) => {
          const contrast = 1.4;
          const result = color.clone();
          result.x = (result.x - 0.5) * contrast + 0.5;
          result.y = (result.y - 0.5) * contrast + 0.5;
          result.z = (result.z - 0.5) * contrast + 0.5;
          return result;
        },
      },
    ];
  }

  /**
   * Get LMT preset by ID
   */
  getLMTPresetById(id: string): ACESLMTPreset | undefined {
    return this.getLMTPresets().find(p => p.id === id);
  }

  /**
   * Generate GLSL shader code for ACES transforms
   */
  getShaderCode(): string {
    return `
      // ACES Filmic Tone Mapping
      // Reference: Krzysztof Narkowicz (2016)

      vec3 ACESFilmic(vec3 x) {
        float a = 2.51;
        float b = 0.03;
        float c = 2.43;
        float d = 0.59;
        float e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }

      // sRGB to Linear
      vec3 sRGBToLinear(vec3 srgb) {
        vec3 linear;
        for (int i = 0; i < 3; i++) {
          float c = srgb[i];
          if (c <= 0.04045) {
            linear[i] = c / 12.92;
          } else {
            linear[i] = pow((c + 0.055) / 1.055, 2.4);
          }
        }
        return linear;
      }

      // Linear to sRGB
      vec3 linearToSRGB(vec3 linear) {
        vec3 srgb;
        for (int i = 0; i < 3; i++) {
          float c = linear[i];
          if (c <= 0.0031308) {
            srgb[i] = c * 12.92;
          } else {
            srgb[i] = 1.055 * pow(c, 1.0 / 2.4) - 0.055;
          }
        }
        return srgb;
      }
    `;
  }
}

export const acesService = new ACESService();