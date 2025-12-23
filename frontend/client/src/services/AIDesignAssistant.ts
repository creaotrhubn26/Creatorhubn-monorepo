/**
 * AI Design Assistant
 * Intelligent layout suggestions, responsive breakpoints, and component recommendations
 */

import {
  aiCodeCompletionEngine,
  AIContext,
} from '@/components/admin/visual-editor/AICodeCompletionSystem';

export interface LayoutSuggestion {
  id: string;
  name: string;
  description: string;
  type: 'grid' | 'flexbox' | 'masonry' | 'sidebar' | 'hero' | 'card-grid';
  preview: string;
  code: string;
  elements: CanvasElement[];
  confidence: number;
  reasoning: string;
}

export interface ResponsiveBreakpoint {
  name: string;
  width: number;
  height?: number;
  device: 'mobile' | 'tablet' | 'desktop' | 'wide';
  orientation?: 'portrait' | 'landscape';
  adjustments: ElementAdjustment[];
}

export interface ElementAdjustment {
  elementId: string;
  properties: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fontSize?: number;
    display?: string;
    flexDirection?: string;
  };
}

export interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  props: unknown;
  styles?: any;
}

export interface ComponentRecommendation {
  id: string;
  name: string;
  category: 'ui' | 'layout' | 'navigation' | 'form' | 'data-display';
  description: string;
  usage: string;
  code: string;
  bestFor: string[];
  confidence: number;
}

export interface DesignAnalysis {
  score: number;
  issues: DesignIssue[];
  suggestions: DesignSuggestion[];
  accessibility: AccessibilityReport;
  performance: PerformanceReport;
}

export interface DesignIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'layout' | 'spacing' | 'typography' | 'color' | 'accessibility';
  message: string;
  elementIds: string[];
  fix?: string;
}

export interface DesignSuggestion {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'easy' | 'moderate' | 'complex';
  code?: string;
}

export interface AccessibilityReport {
  score: number;
  wcagLevel: 'A' | 'AA' | 'AAA';
  issues: Array<{
    rule: string;
    impact: string;
    description: string;
    elements: string[];
    fix: string;
  }>;
}

export interface PerformanceReport {
  score: number;
  metrics: {
    elementCount: number;
    complexity: number;
    estimatedLoadTime: number;
  };
  recommendations: string[];
}

export class AIDesignAssistant {
  private aiEngine = aiCodeCompletionEngine;

  /**
   * Suggest layouts based on current elements
   */
  async suggestLayouts(elements: CanvasElement[], context?: string): Promise<LayoutSuggestion[]> {
    const prompt = `You are an expert UI/UX designer. Analyze these ${elements.length} canvas elements and suggest 3 optimal layout patterns.

Current Elements:
${JSON.stringify(
  elements.map((e) => ({ type: e.type, width: e.width, height: e.height })),
  null,
  2,
)}

Context: ${context || 'General purpose web application'}

Provide 3 layout suggestions optimized for:
1. User experience
2. Visual hierarchy
3. Responsive design
4. Modern design trends

Return JSON array with:
{
  "layouts": [
    {
      "name":"Layout name", "type":"grid|flexbox|masonry|sidebar|hero|card-grid","description":"Why this layout works","code" : "CSS/React code","elements": [/* adjusted element positions */],
      "reasoning" : "Design rationale"
    }
  ]
}`;

    const aiContext: AIContext = {
      currentCode: JSON.stringify(elements),
      language: 'typescript',
      cursor: { line: 0, column: 0 },
      elements,
    };

    try {
      const completions = await this.aiEngine.getCompletions(aiContext);

      if (completions.length > 0) {
        const response = JSON.parse(completions[0].code);

        return response.layouts.map((layout: any, index: number) => ({
          id: `layout-${Date.now()}-${index}`,
          name: layout.name,
          description: layout.description,
          type: layout.type,
          preview: this.generateLayoutPreview(layout.type),
          code: layout.code,
          elements: layout.elements,
          confidence: completions[0].confidence,
          reasoning: layout.reasoning,
        }));
      }
    } catch (error) {
      console.error('AI layout suggestion failed: ', error);
    }

    return this.getFallbackLayouts(elements);
  }

  /**
   * Generate responsive breakpoints automatically
   */
  async generateResponsiveBreakpoints(elements: CanvasElement[]): Promise<ResponsiveBreakpoint[]> {
    const breakpoints: ResponsiveBreakpoint[] = [
      {
        name: 'Mobile',
        width: 375,
        height: 667,
        device: 'mobile',
        orientation: 'portrait',
        adjustments: [],
      },
      {
        name: 'Tablet',
        width: 768,
        height: 1024,
        device: 'tablet',
        orientation: 'portrait',
        adjustments: [],
      },
      {
        name: 'Desktop',
        width: 1440,
        height: 900,
        device: 'desktop',
        adjustments: [],
      },
      {
        name: 'Wide Desktop',
        width: 1920,
        height: 1080,
        device: 'wide',
        adjustments: [],
      },
    ];

    // AI-powered adjustment calculation
    for (const breakpoint of breakpoints) {
      breakpoint.adjustments = this.calculateBreakpointAdjustments(elements, breakpoint);
    }

    return breakpoints;
  }

  /**
   * Calculate element adjustments for breakpoint
   */
  private calculateBreakpointAdjustments(
    elements: CanvasElement[],
    breakpoint: ResponsiveBreakpoint,
  ): ElementAdjustment[] {
    const scaleFactor = breakpoint.width / 1440; // Assume 1440 as base desktop width

    return elements.map((element) => {
      const adjustment: ElementAdjustment = {
        elementId: element.id,
        properties: {},
      };

      // Mobile adjustments
      if (breakpoint.device === 'mobile') {
        adjustment.properties = {
          width: element.width * scaleFactor,
          x: element.x * scaleFactor,
          y: element.y * scaleFactor,
          fontSize: element.styles?.fontSize ? element.styles.fontSize * 0.9 : undefined,
        };
      }
      // Tablet adjustments
      else if (breakpoint.device === 'tablet') {
        adjustment.properties = {
          width: element.width * scaleFactor,
          x: element.x * scaleFactor,
          y: element.y * scaleFactor,
        };
      }
      // Desktop and wide - minimal changes
      else {
        adjustment.properties = {
          width: element.width,
          x: element.x,
          y: element.y,
        };
      }

      return adjustment;
    });
  }

  /**
   * Recommend components based on context
   */
  async recommendComponents(
    context: string,
    existingElements: CanvasElement[],
  ): Promise<ComponentRecommendation[]> {
    const prompt = `As a UI expert, recommend 5 React components for this context: "${context}"

Existing elements: ${existingElements.length} (${existingElements.map((e) => e.type).join('')})

Recommend components that:
1. Complement existing elements
2. Enhance user experience
3. Follow modern React patterns
4. Are accessible

Return JSON:
{
  "recommendations": [
    {
      "name":"Component name","category":"ui|layout|navigation|form|data-display","description":"What it does","usage":"When to use it","code" : "React component code","bestFor": ["use case 1","use case 2"]
    }
  ]
}`;

    const aiContext: AIContext = {
      currentCode: context,
      language: 'typescript',
      cursor: { line: 0, column: 0 },
      elements: existingElements,
    };

    try {
      const completions = await this.aiEngine.getCompletions(aiContext);

      if (completions.length > 0) {
        const response = JSON.parse(completions[0].code);

        return response.recommendations.map((rec: any, index: number) => ({
          id: `component-${Date.now()}-${index}`,
          ...rec,
          confidence: completions[0].confidence,
        }));
      }
    } catch (error) {
      console.error('AI component recommendation failed:', error);
    }

    return this.getFallbackRecommendations();
  }

  /**
   * Analyze design quality
   */
  async analyzeDesign(elements: CanvasElement[]): Promise<DesignAnalysis> {
    const issues = this.detectDesignIssues(elements);
    const accessibility = this.checkAccessibility(elements);
    const performance = this.analyzePerformance(elements);

    // Calculate overall score
    const score = Math.round(
      accessibility.score * 0.4 + performance.score * 0.3 + (100 - issues.length * 5) * 0.3,
    );

    const suggestions = await this.generateDesignSuggestions(elements, issues);

    return {
      score,
      issues,
      suggestions,
      accessibility,
      performance,
    };
  }

  /**
   * Detect design issues
   */
  private detectDesignIssues(elements: CanvasElement[]): DesignIssue[] {
    const issues: DesignIssue[] = [];

    // Check for overlapping elements
    elements.forEach((el1, i) => {
      elements.slice(i + 1).forEach((el2) => {
        if (this.elementsOverlap(el1, el2)) {
          issues.push({
            severity: 'warning',
            category: 'layout',
            message: 'Elements overlap - may cause visibility issues',
            elementIds: [el1.id, el2.id],
            fix: 'Adjust element positions to avoid overlap',
          });
        }
      });
    });

    // Check spacing consistency
    const spacings = this.getElementSpacings(elements);
    if (spacings.length > 5) {
      issues.push({
        severity: 'info',
        category: 'spacing',
        message: 'Inconsistent spacing detected',
        elementIds: [],
        fix: 'Use consistent spacing values (8px, 16px, 24px, etc.)',
      });
    }

    // Check for tiny text
    elements.forEach((el) => {
      if (el.type === 'text' && el.styles?.fontSize && el.styles.fontSize < 12) {
        issues.push({
          severity: 'warning',
          category: 'typography',
          message: 'Text size too small for readability',
          elementIds: [el.id],
          fix: 'Increase font size to at least 14px',
        });
      }
    });

    return issues;
  }

  /**
   * Check accessibility
   */
  private checkAccessibility(elements: CanvasElement[]): AccessibilityReport {
    const issues: AccessibilityReport['issues'] = [];

    // Check for images without alt text
    elements
      .filter((el) => el.type === 'image')
      .forEach((el) => {
        if (!el.props?.alt) {
          issues.push({
            rule: 'WCAG 1.1.1',
            impact: 'critical',
            description: 'Images must have alt text',
            elements: [el.id],
            fix: 'Add descriptive alt text to image',
          });
        }
      });

    // Check color contrast (simplified)
    elements
      .filter((el) => el.type === 'text')
      .forEach((el) => {
        if (el.styles?.color && el.styles?.backgroundColor) {
          const contrast = this.calculateContrastRatio(el.styles.color, el.styles.backgroundColor);
          if (contrast < 4.5) {
            issues.push({
              rule: 'WCAG 1.4.3',
              impact: 'serious',
              description: 'Insufficient color contrast',
              elements: [el.id],
              fix: 'Increase contrast ratio to at least 4.5:1',
            });
          }
        }
      });

    const score = Math.max(0, 100 - issues.length * 10);
    const wcagLevel: 'A' | 'AA' | 'AAA' = score >= 90 ? 'AAA' : score >= 75 ? 'AA' : 'A';

    return { score, wcagLevel, issues };
  }

  /**
   * Analyze performance
   */
  private analyzePerformance(elements: CanvasElement[]): PerformanceReport {
    const elementCount = elements.length;
    const complexity = this.calculateComplexity(elements);
    const estimatedLoadTime = elementCount * 2 + complexity * 10; // Simplified

    const recommendations: string[] = [];

    if (elementCount > 100) {
      recommendations.push('Consider lazy loading for off-screen elements');
    }
    if (complexity > 50) {
      recommendations.push('Simplify component structure to improve rendering');
    }

    const score = Math.max(0, 100 - elementCount * 0.5 - complexity * 0.3);

    return {
      score: Math.round(score),
      metrics: { elementCount, complexity, estimatedLoadTime },
      recommendations,
    };
  }

  /**
   * Generate design suggestions
   */
  private async generateDesignSuggestions(
    elements: CanvasElement[],
    issues: DesignIssue[],
  ): Promise<DesignSuggestion[]> {
    const suggestions: DesignSuggestion[] = [];

    if (issues.some((i) => i.category === 'spacing')) {
      suggestions.push({
        title: 'Implement Consistent Spacing',
        description: 'Use a spacing scale (8px base) for consistent visual rhythm',
        impact: 'medium',
        effort: 'easy',
        code: 'const spacing = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48 };',
      });
    }

    if (elements.length > 20) {
      suggestions.push({
        title: 'Group Related Elements',
        description: 'Create component groups to improve organization',
        impact: 'high',
        effort: 'moderate',
      });
    }

    return suggestions;
  }

  /**
   * Helper: Check if elements overlap
   */
  private elementsOverlap(el1: CanvasElement, el2: CanvasElement): boolean {
    return !(
      el1.x + el1.width < el2.x ||
      el2.x + el2.width < el1.x ||
      el1.y + el1.height < el2.y ||
      el2.y + el2.height < el1.y
    );
  }

  /**
   * Helper: Get element spacings
   */
  private getElementSpacings(elements: CanvasElement[]): number[] {
    const spacings: number[] = [];
    // Simplified spacing detection
    elements.forEach((el, i) => {
      if (i > 0) {
        const prev = elements[i - 1];
        const spacing = el.y - (prev.y + prev.height);
        if (spacing > 0) spacings.push(spacing);
      }
    });
    return [...new Set(spacings)];
  }

  /**
   * Helper: Calculate contrast ratio
   */
  private calculateContrastRatio(color1: string, color2: string): number {
    // Simplified - in reality would need full color parsing
    return 7; // Placeholder
  }

  /**
   * Helper: Calculate complexity
   */
  private calculateComplexity(elements: CanvasElement[]): number {
    return elements.reduce((sum, el) => {
      let complexity = 1;
      if (el.type === 'container') complexity += 2;
      if (el.props && Object.keys(el.props).length > 5) complexity += 1;
      return sum + complexity;
    }, 0);
  }

  /**
   * Helper: Generate layout preview
   */
  private generateLayoutPreview(type: string): string {
    return `data:image/svg+xml,<svg>...</svg>`; // Placeholder
  }

  /**
   * Fallback layouts when AI unavailable
   */
  private getFallbackLayouts(elements: CanvasElement[]): LayoutSuggestion[] {
    return [
      {
        id: 'layout-grid',
        name: 'Grid Layout',
        description: 'Responsive grid system',
        type: 'grid',
        preview: '',
        code: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;',
        elements: [],
        confidence: 0.7,
        reasoning: 'Grid layouts are versatile and responsive',
      },
      {
        id: 'layout-flex',
        name: 'Flexbox Layout',
        description: 'Flexible box layout',
        type: 'flexbox',
        preview: ', ',
        code: 'display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between;',
        elements: [],
        confidence: 0.75,
        reasoning: 'Flexbox provides excellent control over alignment',
      },
    ];
  }

  /**
   * Fallback component recommendations
   */
  private getFallbackRecommendations(): ComponentRecommendation[] {
    return [
      {
        id: 'comp-card',
        name: 'Card Component',
        category: 'ui',
        description: 'Flexible container for content',
        usage: 'Display grouped information',
        code:'<Card><CardContent>...</CardContent></Card>',
        bestFor: ['Content grouping','Product display'],
        confidence: 0.8,
      },
    ];
  }
}

// Singleton instance
export const aiDesignAssistant = new AIDesignAssistant();
