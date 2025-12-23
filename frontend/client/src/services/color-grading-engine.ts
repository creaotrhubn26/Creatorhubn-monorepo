/**
 * COLOR GRADING ENGINE
 * Using chroma-js for professional color grading
 * Like DaVinci Resolve color wheels
 */

import chroma from 'chroma-js';

export interface ColorGrade {
  shadows: { hue: number; saturation: number; luminance: number };
  midtones: { hue: number; saturation: number; luminance: number };
  highlights: { hue: number; saturation: number; luminance: number };
  temperature: number; // -100 to +100 (cool to warm)
  tint: number;        // -100 to +100 (green to magenta)
  saturation: number;  // 0 to 200%
  contrast: number;    // 0 to 200%
  exposure: number;    // -2 to +2 stops
  vibrance: number;    // 0 to 100%
}

/**
 * Color Grading Engine
 */
export class ColorGradingEngine {
  /**
   * Apply color grade to canvas
   */
  static applyGrade(
    sourceCanvas: HTMLCanvasElement,
    outputCanvas: HTMLCanvasElement,
    grade: Partial<ColorGrade>
  ) {
    const ctx = outputCanvas.getContext('2d')!;
    const sourceCtx = sourceCanvas.getContext('2d')!;
    
    // Draw source
    ctx.drawImage(sourceCanvas, 0, 0);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const data = imageData.data;
    
    // Apply color grading pixel by pixel
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Convert to color object
      let color = chroma([r, g, b]);
      
      // Apply temperature & tint
      if (grade.temperature !== undefined) {
        color = this.applyTemperature(color, grade.temperature);
      }
      
      if (grade.tint !== undefined) {
        color = this.applyTint(color, grade.tint);
      }
      
      // Apply exposure
      if (grade.exposure !== undefined) {
        color = this.applyExposure(color, grade.exposure);
      }
      
      // Apply contrast
      if (grade.contrast !== undefined) {
        color = this.applyContrast(color, grade.contrast);
      }
      
      // Apply saturation
      if (grade.saturation !== undefined) {
        const hsl = color.hsl();
        color = chroma.hsl(hsl[0], hsl[1] * (grade.saturation / 100), hsl[2]);
      }
      
      // Get final RGB
      const rgb = color.rgb();
      data[i] = Math.min(255, Math.max(0, rgb[0]));
      data[i + 1] = Math.min(255, Math.max(0, rgb[1]));
      data[i + 2] = Math.min(255, Math.max(0, rgb[2]));
    }
    
    ctx.putImageData(imageData, 0, 0);
  }
  
  /**
   * Apply temperature shift
   */
  private static applyTemperature(color: chroma.Color, temp: number): chroma.Color {
    const rgb = color.rgb();
    
    if (temp > 0) {
      // Warm (add red/yellow)
      rgb[0] += temp * 2.55;
      rgb[1] += temp * 1.27;
    } else {
      // Cool (add blue)
      rgb[2] += Math.abs(temp) * 2.55;
    }
    
    return chroma(rgb);
  }
  
  /**
   * Apply tint shift
   */
  private static applyTint(color: chroma.Color, tint: number): chroma.Color {
    const rgb = color.rgb();
    
    if (tint > 0) {
      // Magenta
      rgb[0] += tint * 1.27;
      rgb[2] += tint * 1.27;
    } else {
      // Green
      rgb[1] += Math.abs(tint) * 2.55;
    }
    
    return chroma(rgb);
  }
  
  /**
   * Apply exposure (stops)
   */
  private static applyExposure(color: chroma.Color, stops: number): chroma.Color {
    const multiplier = Math.pow(2, stops);
    const rgb = color.rgb();
    
    return chroma([
      rgb[0] * multiplier,
      rgb[1] * multiplier,
      rgb[2] * multiplier
    ]);
  }
  
  /**
   * Apply contrast
   */
  private static applyContrast(color: chroma.Color, contrast: number): chroma.Color {
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const rgb = color.rgb();
    
    return chroma([
      factor * (rgb[0] - 128) + 128,
      factor * (rgb[1] - 128) + 128,
      factor * (rgb[2] - 128) + 128
    ]);
  }
  
  /**
   * Create color palette from LUT
   */
  static createPaletteFromLUT(lutName: string): chroma.Color[] {
    // Predefined color palettes for cultural LUTs
    const palettes: Record<string, string[]> = {
      'warm_wedding': ['#FFE4C4','#FFD700','#FF8C00','#FF6347'],'cool_modern': ['#E0F7FF','#87CEEB','#4682B4','#191970'],'vintage': ['#F5DEB3','#DEB887','#D2691E','#8B4513'],'cinematic': ['#1A1A2E','#16213E', '#0F3460', '#533483']
    };
    
    const colors = palettes[lutName] || palettes['warm_wedding'];
    return colors.map(c => chroma(c));
  }
  
  /**
   * Generate gradient from colors
   */
  static generateGradient(colors: chroma.Color[], steps: number = 10): chroma.Color[] {
    const scale = chroma.scale(colors).mode('lch');
    return scale.colors(steps).map(c => chroma(c));
  }
  
  /**
   * Color grading presets (like DaVinci Resolve)
   */
  static getColorPresets(): Array<{ name: string; grade: Partial<ColorGrade> }> {
    return [
      {
        name: 'Warm & Romantic',
        grade: {
          temperature: 20,
          tint: 5,
          saturation: 110,
          contrast: 105
        }
      },
      {
        name: 'Cool & Modern',
        grade: {
          temperature: -15,
          tint: -5,
          saturation: 95,
          contrast: 110
        }
      },
      {
        name: 'Vintage Film',
        grade: {
          temperature: 10,
          saturation: 85,
          contrast: 95,
          exposure: -0.2
        }
      },
      {
        name: 'High Contrast',
        grade: {
          contrast: 140,
          saturation: 105
        }
      },
      {
        name: 'Desaturated',
        grade: {
          saturation: 50,
          contrast: 110
        }
      },
      {
        name: 'Black & White',
        grade: {
          saturation: 0,
          contrast: 120
        }
      },
      {
        name: 'Cinematic Teal & Orange',
        grade: {
          temperature: 15,
          tint: -10,
          saturation: 120,
          contrast: 115
        }
      }
    ];
  }
}


