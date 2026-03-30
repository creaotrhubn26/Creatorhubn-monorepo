/**
 * Theme Validation and Brand Consistency
 * Comprehensive theme validation and brand consistency checking
 */

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  errorColor: string;
  warningColor: string;
  successColor: string;
  infoColor: string;
  fontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
};
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
};
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
};
  shadows: {
    sm: string;
    md: string;
    lg: string;
};
}

export interface BrandGuidelines {
  logo: {
    primary: string;
    secondary: string;
    monochrome: string;
    usage: string[];
};
  colors: {
    primary: string[];
    secondary: string[];
    neutral: string[];
    accent: string[];
};
  typography: {
    primary: string;
    secondary: string;
    heading: string;
    body: string;
};
  spacing: {
    unit: number;
    scale: number;
};
  components: {
    button: {
      borderRadius: string;
      padding: string;
      fontSize: string;
};
    card: {
      borderRadius: string;
      padding: string;
      shadow: string;
};
    input: {
      borderRadius: string;
      padding: string;
      borderWidth: string;
};
};
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
  recommendations: string[]
}

type ThemeIssueType = 'color' | 'typography' | 'spacing' | 'component' | 'brand';

interface ValidationIssue {
  type: ThemeIssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  element: string;
  suggestion: string;
  fix: string;
}

interface ValidationWarning {
  type: string;
  message: string;
  element: string;
  suggestion: string;
}

interface ValidationRuleResult {
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
  recommendations: string[];
}

export interface ColorContrastResult {
  ratio: number;
  level: 'AA' | 'AAA' | 'fail';
  foreground: string;
  background: string;
  isValid: boolean
}

class ThemeValidator {
  private themeConfig: ThemeConfig;
  private brandGuidelines: BrandGuidelines;
  private validationRules: Map<string, () => ValidationRuleResult> = new Map();

  constructor(themeConfig: ThemeConfig, brandGuidelines: BrandGuidelines) {
    this.themeConfig = themeConfig;
    this.brandGuidelines = brandGuidelines;
    this.initializeValidationRules();
}

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): void {
    this.validationRules.set('colorContrast', this.validateColorContrast.bind(this));
    this.validationRules.set('colorConsistency', this.validateColorConsistency.bind(this));
    this.validationRules.set('typographyConsistency', this.validateTypographyConsistency.bind(this));
    this.validationRules.set('spacingConsistency', this.validateSpacingConsistency.bind(this));
    this.validationRules.set('componentConsistency', this.validateComponentConsistency.bind(this));
    this.validationRules.set('brandConsistency', this.validateBrandConsistency.bind(this));
}

  /**
   * Validate entire theme
   */
  validateTheme(): ValidationResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];

    const recommendations: string[] = [];

    // Run all validation rules
    for (const [ruleName, ruleFunction] of this.validationRules.entries()) {
      try {
        const result = ruleFunction();
        issues.push(...result.issues);
        warnings.push(...result.warnings);
        recommendations.push(...result.recommendations);
    } catch (error) {
        console.error(`Error running validation rule ${ruleName}:`, error);
    }
  }

    // Calculate overall score
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    const lowIssues = issues.filter(i => i.severity === 'low').length;

    const score = Math.max(0, 100 - (criticalIssues * 20 + highIssues * 10 + mediumIssues * 5 + lowIssues * 2));

    return {
      isValid: criticalIssues === 0 && highIssues === 0,
      score,
      issues,
      warnings,
      recommendations
  };
}

  /**
   * Validate color contrast
   */
  private validateColorContrast(): ValidationRuleResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Check text color contrast
    const textContrast = this.checkColorContrast(this.themeConfig.textColor, this.themeConfig.backgroundColor);
    if (!textContrast.isValid) {
      issues.push({
        type: 'color',
        severity: 'high',
        message: `Text color contrast ratio ${textContrast.ratio.toFixed()} is below ${textContrast.level} standard`,
        element: 'text',
        suggestion: 'Increase contrast between text and background colors',
        fix: `Use a darker text color or lighter background color`
  });
  }

    // Check primary color contrast
    const primaryContrast = this.checkColorContrast(this.themeConfig.primaryColor, this.themeConfig.backgroundColor);
    if (!primaryContrast.isValid) {
      issues.push({
        type: 'color',
        severity: 'medium',
        message: `Primary color contrast ratio ${primaryContrast.ratio.toFixed()} is below ${primaryContrast.level} standard`,
        element: 'primary',
        suggestion: 'Ensure primary color has sufficient contrast',
        fix: `Adjust primary color or background color`
  });
  }

    // Check error color contrast
    const errorContrast = this.checkColorContrast(this.themeConfig.errorColor, this.themeConfig.backgroundColor);
    if (!errorContrast.isValid) {
      issues.push({
        type: 'color',
        severity: 'high',
        message: `Error color contrast ratio ${errorContrast.ratio.toFixed()} is below ${errorContrast.level} standard`,
        element: 'error',
        suggestion: 'Ensure error color is clearly visible',
        fix: `Use a more contrasting error color`
  });
  }

    return { issues, warnings, recommendations };
}

  /**
   * Check color contrast ratio
   */
  private checkColorContrast(foreground: string, background: string): ColorContrastResult {
    const fgRgb = this.hexToRgb(foreground);
    const bgRgb = this.hexToRgb(background);

    if (!fgRgb || !bgRgb) {
      return {
        ratio: 0,
        level: 'fail',
        foreground,
        background,
        isValid: false
  };
  }

    const fgLuminance = this.getLuminance(fgRgb);
    const bgLuminance = this.getLuminance(bgRgb);

    const lighter = Math.max(fgLuminance, bgLuminance);
    const darker = Math.min(fgLuminance, bgLuminance);

    const ratio = (lighter + 0.05) / (darker + 0.05);

    let level: 'AA' | 'AAA' | 'fail';
    if (ratio >= 7) {
      level = 'AAA';
} else if (ratio >= 4.5) {
      level = 'AA';
  } else {
      level = 'fail';
  }

    return {
      ratio,
      level,
      foreground,
      background,
      isValid: ratio >= 4.5
};
}

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : null;
}

  /**
   * Get relative luminance
   */
  private getLuminance(rgb: { r: number; g: number; b: number }): number {
    const { r, g, b } = rgb;
    const [rs, gs, bs] = [r, g, b].map((c) => {
      const normalized = c / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

  /**
   * Validate color consistency
   */
  private validateColorConsistency(): ValidationRuleResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Check if colors follow brand guidelines
    const brandColors = [
      ...this.brandGuidelines.colors.primary,
      ...this.brandGuidelines.colors.secondary,
      ...this.brandGuidelines.colors.accent
    ];

    const themeColors = [
      this.themeConfig.primaryColor,
      this.themeConfig.secondaryColor,
      this.themeConfig.accentColor
    ];

    themeColors.forEach((color, index) => {
      if (!brandColors.includes(color)) {
        issues.push({
          type: 'brand',
          severity: 'medium',
          message: `Color ${color} is not in brand guidelines`,
          element: `color-${index}`,
          suggestion: 'Use colors from brand guidelines',
          fix: `Replace with one of: ${brandColors.join(', ')}`
      });
    }
  });

    // Check color harmony
    const harmonyScore = this.checkColorHarmony(themeColors);
    if (harmonyScore < 0.7) {
      warnings.push({
        type: 'color',
        message: 'Color harmony could be improved',
        element: 'theme-colors',
        suggestion: 'Consider using a color palette generator'
  });
  }

    return { issues, warnings, recommendations };
}

  /**
   * Check color harmony
   */
  private checkColorHarmony(colors: string[]): number {
    const normalizedColors = colors
      .map((color) => color.trim().toLowerCase())
      .filter(Boolean);

    if (normalizedColors.length === 0) {
      return 0;
    }

    const uniqueColorRatio = new Set(normalizedColors).size / normalizedColors.length;
    const luminanceValues = normalizedColors
      .map((color) => this.hexToRgb(color))
      .filter((rgb): rgb is { r: number; g: number; b: number } => rgb !== null)
      .map((rgb) => this.getLuminance(rgb));

    if (luminanceValues.length < 2) {
      return uniqueColorRatio;
    }

    const luminanceSpread = Math.max(...luminanceValues) - Math.min(...luminanceValues);
    return Math.max(0, Math.min(1, uniqueColorRatio * 0.6 + luminanceSpread * 0.4));
}

  /**
   * Validate typography consistency
   */
  private validateTypographyConsistency(): ValidationRuleResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Check font family consistency
    if (this.themeConfig.fontFamily !== this.brandGuidelines.typography.primary) {
      issues.push({
        type: 'typography',
        severity: 'medium',
        message: 'Font family does not match brand guidelines',
        element: 'font-family',
        suggestion: 'Use brand-approved font family',
        fix: `Change to ${this.brandGuidelines.typography.primary}`
    });
  }

    // Check font size consistency
    const fontSizeValues = Object.values(this.themeConfig.fontSize);
    const hasConsistentScale = this.checkFontSizeScale(fontSizeValues);
    if (!hasConsistentScale) {
      warnings.push({
        type: 'typography',
        message: 'Font sizes do not follow consistent scale',
        element: 'font-sizes',
        suggestion: 'Use a consistent typographic scale'
  });
  }

    return { issues, warnings, recommendations };
}

  /**
   * Check font size scale consistency
   */
  private checkFontSizeScale(sizes: string[]): boolean {
    // Check if sizes follow a consistent scale (e.., 1.2x, 1.5x)
    const numericSizes = sizes.map(size => parseFloat(size.replace('rem', '')));
    const ratios = [];
    
    for (let i = 1; i < numericSizes.length; i++) {
      ratios.push(numericSizes[i] / numericSizes[i - 1]);
  }
    
    // Check if ratios are consistent (within 10% variance)
    const avgRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
    return ratios.every(ratio => Math.abs(ratio - avgRatio) / avgRatio < 0.1);
}

  /**
   * Validate spacing consistency
   */
  private validateSpacingConsistency(): ValidationRuleResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Check spacing scale consistency
    const spacingValues = Object.values(this.themeConfig.spacing);
    const hasConsistentScale = this.checkSpacingScale(spacingValues);
    if (!hasConsistentScale) {
      warnings.push({
        type: 'spacing',
        message: 'Spacing values do not follow consistent scale',
        element: 'spacing',
        suggestion: 'Use a consistent spacing scale (e.., 8px, 16px, 24px)'
    });
  }

    return { issues, warnings, recommendations };
}

  /**
   * Check spacing scale consistency
   */
  private checkSpacingScale(spacings: string[]): boolean {
    const numericSpacings = spacings.map(spacing => parseFloat(spacing.replace('px', '')));
    const ratios = [];
    
    for (let i = 1; i < numericSpacings.length; i++) {
      ratios.push(numericSpacings[i] / numericSpacings[i - 1]);
  }
    
    // Check if ratios are consistent (within 20% variance)
    const avgRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
    return ratios.every(ratio => Math.abs(ratio - avgRatio) / avgRatio < 0.2);
}

  /**
   * Validate component consistency
   */
  private validateComponentConsistency(): ValidationRuleResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Check button consistency
    const buttonConfig = this.brandGuidelines.components.button;
    if (this.themeConfig.borderRadius.sm !== buttonConfig.borderRadius) {
      issues.push({
        type: 'component',
        severity: 'low',
        message: 'Button border radius does not match brand guidelines',
        element: 'button',
        suggestion: 'Use consistent border radius',
        fix: `Change to ${buttonConfig.borderRadius}`
    });
  }

    // Check card consistency
    const cardConfig = this.brandGuidelines.components.card;
    if (this.themeConfig.borderRadius.md !== cardConfig.borderRadius) {
      issues.push({
        type: 'component',
        severity: 'low',
        message: 'Card border radius does not match brand guidelines',
        element: 'card',
        suggestion: 'Use consistent border radius',
        fix: `Change to ${cardConfig.borderRadius}`
    });
  }

    return { issues, warnings, recommendations };
}

  /**
   * Validate brand consistency
   */
  private validateBrandConsistency(): ValidationRuleResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Check if theme follows brand guidelines
    const brandCompliance = this.calculateBrandCompliance();
    if (brandCompliance < 0.8) {
      issues.push({
        type: 'brand',
        severity: 'high',
        message: `Brand compliance is ${Math.round(brandCompliance * 10)}%`,
        element: 'theme',
        suggestion: 'Improve adherence to brand guidelines',
        fix: 'Review and update theme configuration'
  });
  }

    return { issues, warnings, recommendations };
}

  /**
   * Calculate brand compliance score
   */
  private calculateBrandCompliance(): number {
    let score = 0;
    let totalChecks = 0;

    // Check color compliance
    const brandColors = [
      ...this.brandGuidelines.colors.primary,
      ...this.brandGuidelines.colors.secondary,
      ...this.brandGuidelines.colors.accent
    ];
    
    const themeColors = [
      this.themeConfig.primaryColor,
      this.themeConfig.secondaryColor,
      this.themeConfig.accentColor
    ];

    themeColors.forEach(color => {
      totalChecks++;
      if (brandColors.includes(color)) {
        score++;
    }
  });

    // Check typography compliance
    totalChecks++;
    if (this.themeConfig.fontFamily === this.brandGuidelines.typography.primary) {
      score++;
  }

    // Check spacing compliance
    totalChecks++;
    const spacingValues = Object.values(this.themeConfig.spacing);
    const hasConsistentScale = this.checkSpacingScale(spacingValues);
    if (hasConsistentScale) {
      score++;
  }

    return totalChecks > 0 ? score / totalChecks : 0;
}

  /**
   * Update theme configuration
   */
  updateThemeConfig(newConfig: Partial<ThemeConfig>): void {
    this.themeConfig = { ...this.themeConfig, ...newConfig };
}

  /**
   * Update brand guidelines
   */
  updateBrandGuidelines(newGuidelines: Partial<BrandGuidelines>): void {
    this.brandGuidelines = { ...this.brandGuidelines, ...newGuidelines };
}

  /**
   * Get theme configuration
   */
  getThemeConfig(): ThemeConfig {
    return { ...this.themeConfig };
}

  /**
   * Get brand guidelines
   */
  getBrandGuidelines(): BrandGuidelines {
    return { ...this.brandGuidelines };
}

  /**
   * Generate theme report
   */
  generateThemeReport(): {
    theme: ThemeConfig;
    brand: BrandGuidelines;
    validation: ValidationResult;
    compliance: number;
    recommendations: string[];
} {
    const validation = this.validateTheme();
    const compliance = this.calculateBrandCompliance();

    return {
      theme: this.themeConfig,
      brand: this.brandGuidelines,
      validation,
      compliance: Math.round(compliance * 10),
      recommendations: validation.recommendations
};
}
}

export default ThemeValidator;

