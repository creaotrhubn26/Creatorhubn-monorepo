type BrandColorGroup = Record<string, string>;

type BrandColors = Partial<{
  primary: BrandColorGroup;
  secondary: BrandColorGroup;
  success: BrandColorGroup;
  warning: BrandColorGroup;
  error: BrandColorGroup;
}>;

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

// Merkevare-validerings system
export class BrandingValidator {
  // Validerer farge mot merkevare-retningslinjer
  static validateColor(color: string, brandColors: BrandColors) {
    // Sjekk om fargen er i godkjent palette
    const isApprovedColor = this.isColorInBrandPalette(color, brandColors);

    if (isApprovedColor) {
      return {
        isValid: true,
        message: '✅ Fargen følger merkevare-retningslinjene',
        alternatives: [],
      };
    }

    // Finn lignende godkjente farger
    const alternatives = this.findSimilarBrandColors(color, brandColors);

    return {
      isValid: false,
      message: '⚠️ Fargen følger ikke merkevare-retningslinjene. Velg en av de foreslåtte alternativene.',
      alternatives,
    };
  }

  // Sjekk om farge er i merkevare-palette
  static isColorInBrandPalette(color: string, brandColors: BrandColors): boolean {
    const normalizedColor = color.toLowerCase();

    const allBrandColors = [
      ...Object.values(brandColors.primary || {}),
      ...Object.values(brandColors.secondary || {}),
      ...Object.values(brandColors.success || {}),
      ...Object.values(brandColors.warning || {}),
      ...Object.values(brandColors.error || {}),
    ];

    return allBrandColors.some(
      (brandColor) => String(brandColor).toLowerCase() === normalizedColor
    );
  }

  // Finn lignende merkevare-farger
  static findSimilarBrandColors(targetColor: string, brandColors: BrandColors): string[] {
    const targetRgb = this.hexToRgb(targetColor);
    if (!targetRgb) return [];

    const allBrandColors = [
      brandColors.primary?.main || '#1976d0',
      brandColors.secondary?.main || '#dc004e',
      brandColors.success?.main || '#2e7d32',
      brandColors.warning?.main || '#ed6c02',
      brandColors.error?.main || '#d32f2f',
    ];

    return allBrandColors
      .map((color) => ({
        color,
        distance: this.colorDistance(targetRgb, this.hexToRgb(color)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((item) => item.color);
  }

  // Beregn farge-avstand
  static colorDistance(rgb1: RgbColor | null, rgb2: RgbColor | null): number {
    if (!rgb1 || !rgb2) return Infinity;

    return Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
    );
  }

  // Konverter hex til RGB
  static hexToRgb(hex: string): RgbColor | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;

    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  // Validerer typografi mot merkevare-retningslinjer
  static validateTypography(fontFamily: string, _fontSize: string) {
    const approvedFonts = ['Roboto', 'Inter', 'Poppins', 'Source Sans Pro', 'Open Sans'];

    const isApprovedFont = approvedFonts.some((font) =>
      fontFamily.toLowerCase().includes(font.toLowerCase())
    );

    return {
      isValid: isApprovedFont,
      message: isApprovedFont
        ? '✅ Skrifttype følger merkevare-retningslinjene'
        : '⚠️ Skrifttype følger ikke merkevare-retningslinjene',
      alternatives: isApprovedFont ? [] : approvedFonts.slice(0, 3),
    };
  }

  // Validerer spacing mot design-system
  static validateSpacing(spacing: string) {
    const approvedSpacing = ['4px', '8px', '16px', '24px', '32px', '48px', '64px'];
    const isApproved = approvedSpacing.includes(spacing);

    return {
      isValid: isApproved,
      message: isApproved
        ? '✅ Avstand følger design-systemet'
        : '⚠️ Bruk godkjente avstand-verdier',
      alternatives: approvedSpacing.slice(0, 3),
    };
  }

  // Validerer ikon-bruk
  static validateIcon(iconName: string) {
    // Kun Material UI ikoner er tillatt
    const isMaterialUI = iconName.includes('@mui/icons-material');

    return {
      isValid: isMaterialUI,
      message: isMaterialUI
        ? '✅ Ikon følger Material UI retningslinjene'
        : '⚠️ Kun Material UI ikoner er tillatt på plattformen',
      alternatives: [],
    };
  }
}
