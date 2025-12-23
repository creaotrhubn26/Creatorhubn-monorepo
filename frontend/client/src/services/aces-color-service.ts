/**
 * ACES COLOR MANAGEMENT SERVICE
 * Academy Color Encoding System (ACES) implementation
 * Professional color workflow like DaVinci Resolve
 * 
 * Features:
 * - ACES color space transforms (sRGB ↔ ACEScg ↔ ACES2065-1)
 * - Input Device Transforms (IDT) for camera LOG formats
 * - Output Device Transforms (ODT) for displays
 * - Reference Rendering Transform (RRT)
 * - Look Modification Transforms (LMT)
 */

import { ColorScience } from './color-science';

export interface ACESTransformOptions {
  exposure?: number; // EV adjustment
  gamma?: number; // Gamma correction
  contrast?: number; // Contrast adjustment
}

export interface CameraIDT {
  camera: string;
  logFormat: string;
  name: string;
  description: string;
}

export interface ACESWorkingSpace {
  name: string;
  whitePoint: 'D60' | 'D65';
  gamut: 'AP0' | 'AP1' | 'sRGB' | 'Rec.709' | 'P3' | 'Rec.2020';
}

/**
 * ACES Color Management
 */
export class ACESColorService {
  
  // ACES color spaces
  static readonly WORKING_SPACES = {
    ACES2065_1: { name: 'ACES2065-1', whitePoint: 'D60', gamut: 'AP0' },
    ACEScg: { name: 'ACEScg', whitePoint: 'D60', gamut: 'AP1' },
    ACEScc: { name: 'ACEScc', whitePoint: 'D60', gamut: 'AP1' }, // Logarithmic
    ACEScct: { name: 'ACEScct', whitePoint: 'D60', gamut: 'AP1' } // Logarithmic with toe
  } as const;
  
  /**
   * sRGB to ACEScg (working space)
   * ACEScg uses AP1 primaries with linear encoding
   */
  static sRGBtoACEScg(r: number, g: number, b: number): [number, number, number] {
    // Linearize sRGB (remove gamma)
    const rLin = this.sRGBtoLinear(r);
    const gLin = this.sRGBtoLinear(g);
    const bLin = this.sRGBtoLinear(b);
    
    // sRGB/Rec.709 to ACEScg (AP1) matrix
    // Pre-calculated matrix from ACES documentation
    const m00 = 0.613097, m01 = 0.339523, m02 = 0.047379;
    const m10 = 0.070194, m11 = 0.916354, m12 = 0.013452;
    const m20 = 0.020616, m21 = 0.109570, m22 = 0.869815;
    
    const rACES = m00 * rLin + m01 * gLin + m02 * bLin;
    const gACES = m10 * rLin + m11 * gLin + m12 * bLin;
    const bACES = m20 * rLin + m21 * gLin + m22 * bLin;
    
    return [rACES, gACES, bACES];
  }
  
  /**
   * ACEScg to sRGB
   */
  static ACEScgToSRGB(r: number, g: number, b: number): [number, number, number] {
    // ACEScg (AP1) to sRGB/Rec.709 matrix (inverse of above)
    const m00 = 1.704858, m01 = -0.621716, m02 = -0.083142;
    const m10 = -0.130079, m11 = 1.140735, m12 = -0.010656;
    const m20 = -0.023964, m21 = -0.128975, m22 = 1.152939;
    
    const rLin = m00 * r + m01 * g + m02 * b;
    const gLin = m10 * r + m11 * g + m12 * b;
    const bLin = m20 * r + m21 * g + m22 * b;
    
    // Apply sRGB gamma
    const rSRGB = this.linearToSRGB(rLin);
    const gSRGB = this.linearToSRGB(gLin);
    const bSRGB = this.linearToSRGB(bLin);
    
    return [rSRGB, gSRGB, bSRGB];
  }
  
  /**
   * sRGB to ACES2065-1 (archive/interchange format)
   */
  static sRGBtoACES2065_1(r: number, g: number, b: number): [number, number, number] {
    // First convert to ACEScg
    const [rACEScg, gACEScg, bACEScg] = this.sRGBtoACEScg(r, g, b);
    
    // ACEScg (AP1) to ACES2065-1 (AP0) matrix
    const m00 = 0.695452, m01 = 0.140679, m02 = 0.163869;
    const m10 = 0.044794, m11 = 0.859671, m12 = 0.095534;
    const m20 = -0.005526, m21 = 0.004025, m22 = 1.001501;
    
    const r2065 = m00 * rACEScg + m01 * gACEScg + m02 * bACEScg;
    const g2065 = m10 * rACEScg + m11 * gACEScg + m12 * bACEScg;
    const b2065 = m20 * rACEScg + m21 * gACEScg + m22 * bACEScg;
    
    return [r2065, g2065, b2065];
  }
  
  /**
   * Input Device Transform (IDT) - Camera LOG to ACES
   * Converts camera-specific LOG formats to ACEScg
   */
  static applyIDT(
    r: number,
    g: number,
    b: number,
    camera: string,
    logFormat: string
  ): [number, number, number] {
    // Apply camera-specific transform
    switch (`${camera}_${logFormat}`.toLowerCase()) {
      case 'sony_slog3':
        return this.sonySLog3ToACEScg(r, g, b);
      
      case 'canon_clog':
      case 'canon_clog2':
        return this.canonCLogToACEScg(r, g, b);
      
      case 'arri_logc':
        return this.arriLogCToACEScg(r, g, b);
      
      case 'panasonic_vlog':
        return this.panasonicVLogToACEScg(r, g, b);
      
      case 'blackmagic_film':
        return this.blackmagicFilmToACEScg(r, g, b);
      
      case 'red_log3g10':
        return this.redLog3G10ToACEScg(r, g, b);
      
      default:
        console.warn(`Unknown camera/log format: ${camera}/${logFormat}, using sRGB transform`);
        return this.sRGBtoACEScg(r, g, b);
    }
  }
  
  /**
   * Output Device Transform (ODT) - ACES to Display
   * Converts ACEScg to display-referred color space
   */
  static applyODT(
    r: number,
    g: number,
    b: number,
    outputSpace: 'sRGB' | 'Rec.709' | 'P3' | 'Rec.2020' = 'sRGB'
  ): [number, number, number] {
    // Apply RRT (Reference Rendering Transform)
    const [rRRT, gRRT, bRRT] = this.applyRRT(r, g, b);
    
    // Apply ODT based on output space
    switch (outputSpace) {
      case 'sRGB':
      case 'Rec.709':
        return this.ACEScgToSRGB(rRRT, gRRT, bRRT);
      
      case 'P3':
        return this.ACEScgToP3(rRRT, gRRT, bRRT);
      
      case 'Rec.2020':
        return this.ACEScgToRec2020(rRRT, gRRT, bRRT);
      
      default:
        return this.ACEScgToSRGB(rRRT, gRRT, bRRT);
    }
  }
  
  /**
   * Reference Rendering Transform (RRT)
   * Applies ACES tone mapping and look
   */
  private static applyRRT(r: number, g: number, b: number): [number, number, number] {
    // Simplified RRT tone curve
    // Full RRT is complex; this is a perceptual approximation
    
    const toneMap = (x: number): number => {
      // S-curve tone mapping similar to ACES RRT
      const a = 2.51;
      const b = 0.03;
      const c = 2.43;
      const d = 0.59;
      const e = 0.14;
      
      return Math.max(0, Math.min(1, (x * (a * x + b)) / (x * (c * x + d) + e)));
    };
    
    return [toneMap(r), toneMap(g), toneMap(b)];
  }
  
  /**
   * Look Modification Transform (LMT)
   * Apply creative looks within ACES pipeline
   */
  static applyLMT(
    r: number,
    g: number,
    b: number,
    look: 'neutral' | 'warm' | 'cool' | 'vivid' | 'desaturated' | 'cinematic'
  ): [number, number, number] {
    // Convert to OKLCh for perceptual adjustments
    const rgb = ColorScience.toOKLCh(r, g, b);
    let [l, c, h] = rgb;
    
    switch (look) {
      case 'warm':
        h = (h + 10) % 360; // Shift towards warm
        c *= 1.1; // Slightly more saturated
        break;
      
      case 'cool':
        h = (h - 10 + 360) % 360; // Shift towards cool
        c *= 1.05;
        break;
      
      case 'vivid':
        c *= 1.3; // Increase saturation
        l *= 1.05; // Slight brightness boost
        break;
      
      case 'desaturated':
        c *= 0.6; // Reduce saturation
        break;
      
      case 'cinematic':
        // Teal & Orange look
        if (h >= 180 && h <= 270) {
          h = 200; // Push blues towards teal
          c *= 1.15;
        } else if (h >= 0 && h <= 90 || h >= 270) {
          h = 30; // Push reds/yellows towards orange
          c *= 1.15;
        }
        l *= 0.95; // Slightly darker
        break;
      
      case 'neutral':
      default:
        break;
    }
    
    return ColorScience.fromOKLCh(l, c, h);
  }
  
  /**
   * Full ACES pipeline
   */
  static processACESPipeline(
    r: number,
    g: number,
    b: number,
    options: {
      inputSpace?: 'sRGB' | 'camera';
      camera?: string;
      logFormat?: string;
      look?: 'neutral' | 'warm' | 'cool' | 'vivid' | 'desaturated' | 'cinematic';
      outputSpace?: 'sRGB' | 'Rec.709' | 'P3' | 'Rec.2020';
      exposure?: number;
    } = {}
  ): [number, number, number] {
    const {
      inputSpace = 'sRGB',
      camera = 'sony',
      logFormat = 'slog3',
      look = 'neutral',
      outputSpace = 'sRGB',
      exposure = 0
    } = options;
    
    // Step 1: IDT - Convert input to ACEScg
    let acesR: number, acesG: number, acesB: number;
    
    if (inputSpace === 'camera' && camera && logFormat) {
      [acesR, acesG, acesB] = this.applyIDT(r, g, b, camera, logFormat);
    } else {
      [acesR, acesG, acesB] = this.sRGBtoACEScg(r, g, b);
    }
    
    // Step 2: Apply exposure adjustment in linear space
    if (exposure !== 0) {
      const exposureMult = Math.pow(2, exposure);
      acesR *= exposureMult;
      acesG *= exposureMult;
      acesB *= exposureMult;
    }
    
    // Step 3: LMT - Apply creative look
    [acesR, acesG, acesB] = this.applyLMT(acesR, acesG, acesB, look);
    
    // Step 4: RRT + ODT - Convert to output space
    const [outR, outG, outB] = this.applyODT(acesR, acesG, acesB, outputSpace);
    
    return [outR, outG, outB];
  }
  
  // ============================================
  // CAMERA-SPECIFIC IDTs
  // ============================================
  
  private static sonyS Log3ToACEScg(r: number, g: number, b: number): [number, number, number] {
    // Sony S-Log3 to linear
    const toLinear = (x: number): number => {
      if (x >= 171.2102946929 / 1023) {
        return Math.pow(10, (x * 1023 - 420) / 261.5) * (0.18 + 0.01) - 0.01;
      } else {
        return (x * 1023 - 95) * 0.01125000 / (171.2102946929 - 95);
      }
    };
    
    const rLin = toLinear(r);
    const gLin = toLinear(g);
    const bLin = toLinear(b);
    
    // Sony SGamut3.Cine to ACEScg matrix
    const m00 = 0.896044, m01 = 0.030299, m02 = 0.073657;
    const m10 = 0.024978, m11 = 0.950777, m12 = 0.024245;
    const m20 = 0.000000, m21 = 0.000000, m22 = 1.000000;
    
    return [
      m00 * rLin + m01 * gLin + m02 * bLin,
      m10 * rLin + m11 * gLin + m12 * bLin,
      m20 * rLin + m21 * gLin + m22 * bLin
    ];
  }
  
  private static canonCLogToACEScg(r: number, g: number, b: number): [number, number, number] {
    // Canon C-Log to linear (simplified)
    const toLinear = (x: number): number => {
      return x < 0.0 ? 0 : Math.pow(10, (x - 0.529136) / 0.256677) - 0.0599;
    };
    
    return this.sRGBtoACEScg(toLinear(r), toLinear(g), toLinear(b));
  }
  
  private static arriLogCToACEScg(r: number, g: number, b: number): [number, number, number] {
    // ARRI Log-C to linear (simplified)
    const toLinear = (x: number): number => {
      return (Math.pow(10, (x - 0.385537) / 0.247189) - 0.052272) / 5.555556;
    };
    
    return this.sRGBtoACEScg(toLinear(r), toLinear(g), toLinear(b));
  }
  
  private static panasonicVLogToACEScg(r: number, g: number, b: number): [number, number, number] {
    // Panasonic V-Log to linear (simplified)
    const toLinear = (x: number): number => {
      if (x < 0.181) {
        return (x - 0.125) / 5.6;
      } else {
        return Math.pow(10, (x - 0.125 - 0.241514) / 0.241514) - 0.01;
      }
    };
    
    return this.sRGBtoACEScg(toLinear(r), toLinear(g), toLinear(b));
  }
  
  private static blackmagicFilmToACEScg(r: number, g: number, b: number): [number, number, number] {
    // Blackmagic Film to linear (simplified)
    const toLinear = (x: number): number => {
      return Math.pow(10, (x - 0.385537) / 0.231531) - 0.002;
    };
    
    return this.sRGBtoACEScg(toLinear(r), toLinear(g), toLinear(b));
  }
  
  private static redLog3G10ToACEScg(r: number, g: number, b: number): [number, number, number] {
    // RED Log3G10 to linear (simplified)
    const toLinear = (x: number): number => {
      return Math.pow(10, (x * 1023 - 395) / 511) - 0.01;
    };
    
    return this.sRGBtoACEScg(toLinear(r), toLinear(g), toLinear(b));
  }
  
  // ============================================
  // ADDITIONAL ODTs
  // ============================================
  
  private static ACEScgToP3(r: number, g: number, b: number): [number, number, number] {
    // ACEScg to Display P3 (simplified)
    // Use ColorScience for gamut mapping
    const [rSRGB, gSRGB, bSRGB] = this.ACEScgToSRGB(r, g, b);
    return ColorScience.convertColor(rSRGB, gSRGB, bSRGB 'srgb','p3', {
      gamutMapping: { method: 'css' }
    }) as [number, number, number];
  }
  
  private static ACEScgToRec2020(r: number, g: number, b: number): [number, number, number] {
    // ACEScg to Rec.2020 (simplified)
    const [rSRGB, gSRGB, bSRGB] = this.ACEScgToSRGB(r, g, b);
    return ColorScience.convertColor(rSRGB, gSRGB, bSRGB'srgb','rec2020', {
      gamutMapping: { method: 'css' }
    }) as [number, number, number];
  }
  
  // ============================================
  // UTILITIES
  // ============================================
  
  /**
   * sRGB gamma encoding (0-1 linear to 0-1 gamma)
   */
  private static linearToSRGB(x: number): number {
    if (x <= 0.0031308) {
      return 12.92 * x;
    } else {
      return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    }
  }
  
  /**
   * sRGB gamma decoding (0-1 gamma to 0-1 linear)
   */
  private static sRGBtoLinear(x: number): number {
    if (x <= 0.04045) {
      return x / 12.92;
    } else {
      return Math.pow((x + 0.055) / 1.055, 2.4);
    }
  }
  
  /**
   * Get available camera IDTs
   */
  static getAvailableIDTs(): CameraIDT[] {
    return [
      { camera: 'Sony', logFormat: 'S-Log3', name: 'Sony S-Log3 (SGamut3.Cine)', description: 'Sony α7S III, FX3, FX6, FX9' },
      { camera: 'Canon', logFormat: 'C-Log', name: 'Canon C-Log', description: 'Canon C200, C300, C500' },
      { camera: 'Canon', logFormat: 'C-Log2', name: 'Canon C-Log2', description: 'Canon C300 Mark II, C700' },
      { camera: 'ARRI', logFormat: 'Log-C', name: 'ARRI Log-C', description: 'ARRI ALEXA, AMIRA' },
      { camera: 'Panasonic', logFormat: 'V-Log', name: 'Panasonic V-Log', description: 'Panasonic GH5, S1H, EVA1' },
      { camera: 'Blackmagic', logFormat: 'Film', name: 'Blackmagic Film', description: 'Blackmagic Pocket Cinema Camera' },
      { camera: 'RED', logFormat: 'Log3G10', name: 'RED Log3G10', description: 'RED KOMODO, V-RAPTOR' }
    ];
  }
  
  /**
   * Get available LMT looks
   */
  static getAvailableLooks() {
    return [
      { id: 'neutral', name: 'Neutral', description: 'No creative look applied' },
      { id: 'warm', name: 'Warm', description: 'Warmer color temperature' },
      { id: 'cool', name: 'Cool', description: 'Cooler color temperature' },
      { id: 'vivid', name: 'Vivid', description: 'Increased saturation and vibrancy' },
      { id: 'desaturated', name: 'Desaturated', description: 'Reduced color saturation' },
      { id: 'cinematic', name: 'Cinematic (Teal & Orange)', description: 'Hollywood blockbuster look' }
    ];
  }
}

// Export singleton
export const acesColorService = ACESColorService;
