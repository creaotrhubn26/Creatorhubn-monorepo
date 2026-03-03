/**
 * Design System Manager
 * Manages comprehensive design system with tokens and guidelines
 */

export interface DesignSystemConfig {
  enableDesignSystem: boolean;
  enableTokens: boolean;
  enableGuidelines: boolean;
  enableThemes: boolean;
  enableTypography: boolean;
  enableColors: boolean;
  enableSpacing: boolean;
  enableShadows: boolean;
  enableBorders: boolean;
  enableAnimations: boolean;
  enableIcons: boolean;
  enableComponents: boolean;
  enableLayouts: boolean;
  enablePatterns: boolean;
  enableAccessibility: boolean;
  enableResponsive: boolean;
  enableDarkMode: boolean;
  enableCustomization: boolean;
  enableValidation: boolean;
  enableTesting: boolean;
  enableAnalytics: boolean;
  enableDebugging: boolean;
  enableLogging: boolean;
  enableMetrics: boolean;
  enableExport: boolean;
  enableImport: boolean;
  enableVersioning: boolean;
  enableSharing: boolean;
  enableCollaboration: boolean;
  enableDocumentation: boolean;
  enableExamples: boolean;
  enablePlayground: boolean;
  enableCodeGeneration: boolean;
  enableTypeScript: boolean;
  enableCompliance: boolean;
  enableSecurity: boolean;
  enablePerformance: boolean;
  debug: boolean
}

export interface DesignToken {
  id: string;
  name: string;
  value: any;
  type: 'color' | 'typography' | 'spacing' | 'shadow' | 'border' | 'animation' | 'icon' | 'component' | 'layout' | 'pattern';
  category: string;
  subcategory?: string;
  description: string;
  usage: string[];
  examples: string[];
  variants: DesignTokenVariant[];
  metadata: {
    created: number;
    modified: number;
    version: string;
    author: string;
    tags: string[];
    usageCount: number;
    lastUsed: number;
    successCount: number;
    errorCount: number;
    performance: {
      renderTime: number;
      bundleSize: number;
      memoryUsage: number;
};
};
  config: Record<string, any>;
}

export interface DesignTokenVariant {
  id: string;
  name: string;
  value: any;
  description: string;
  usage: string[];
  examples: string[]
}

export interface DesignGuideline {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  type: 'principle' | 'rule' | 'pattern' | 'best-practice' | 'anti-pattern' | 'accessibility' | 'performance' | 'security';
  content: string;
  examples: DesignGuidelineExample[];
  relatedTokens: string[];
  relatedComponents: string[];
  metadata: {
    created: number;
    modified: number;
    version: string;
    author: string;
    tags: string[];
    usageCount: number;
    lastUsed: number;
    successCount: number;
    errorCount: number;
};
  config: Record<string, any>;
}

export interface DesignGuidelineExample {
  id: string;
  name: string;
  description: string;
  code: string;
  preview: string;
  tags: string[];
  category: string
}

export interface DesignTheme {
  id: string;
  name: string;
  description: string;
  type: 'light' | 'dark' | 'custom';
  tokens: Map<string, DesignToken>;
  guidelines: Map<string, DesignGuideline>;
  metadata: {
    created: number;
    modified: number;
    version: string;
    author: string;
    tags: string[];
    usageCount: number;
    lastUsed: number;
    successCount: number;
    errorCount: number;
};
  config: Record<string, any>;
}

export interface DesignSystemState {
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  tokens: Map<string, DesignToken>;
  guidelines: Map<string, DesignGuideline>;
  themes: Map<string, DesignTheme>;
  activeTheme: string | null;
  lastUpdate: number;
  totalTokens: number;
  totalGuidelines: number;
  totalThemes: number;
  totalCategories: number;
  totalSubcategories: number;
  totalUsage: number;
  totalErrors: number;
  totalConflicts: number;
  totalOverrides: number
}

class DesignSystemManager {
  private config: DesignSystemConfig;
  private state: DesignSystemState;
  private eventListeners: Map<string, Function[]> = new Map();
  private isInitialized = false;

  constructor(config: Partial<DesignSystemConfig> = {}) {
    this.config = {
      enableDesignSystem: true,
      enableTokens: true,
      enableGuidelines: true,
      enableThemes: true,
      enableTypography: true,
      enableColors: true,
      enableSpacing: true,
      enableShadows: true,
      enableBorders: true,
      enableAnimations: true,
      enableIcons: true,
      enableComponents: true,
      enableLayouts: true,
      enablePatterns: true,
      enableAccessibility: true,
      enableResponsive: true,
      enableDarkMode: true,
      enableCustomization: true,
      enableValidation: true,
      enableTesting: true,
      enableAnalytics: true,
      enableDebugging: true,
      enableLogging: true,
      enableMetrics: true,
      enableExport: true,
      enableImport: true,
      enableVersioning: true,
      enableSharing: true,
      enableCollaboration: true,
      enableDocumentation: true,
      enableExamples: true,
      enablePlayground: true,
      enableCodeGeneration: true,
      enableTypeScript: true,
      enableCompliance: true,
      enableSecurity: true,
      enablePerformance: true,
      debug: false,
      ...config
  };

    this.state = {
      isEnabled: false,
      isInitialized: false,
      hasError: false,
      error: null,
      tokens: new Map(),
      guidelines: new Map(),
      themes: new Map(),
      activeTheme: null,
      lastUpdate:  0,
      totalTokens:  0,
      totalGuidelines:  0,
      totalThemes:  0,
      totalCategories:  0,
      totalSubcategories:  0,
      totalUsage:  0,
      totalErrors:  0,
      totalConflicts:  0,
      totalOverrides: 0
};

    this.initializeDesignSystemManager();
}

  /**
   * Initialize design system manager
   */
  private initializeDesignSystemManager(): void {
    if (!this.config.enableDesignSystem) return;

    try {
      // Enable manager first so load methods can work
      this.state.isEnabled = true;
      this.setupEventListeners();
      this.loadDefaultTokens();
      this.loadDefaultGuidelines();
      this.loadDefaultThemes();
      this.state.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.state.isEnabled = false;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { error: this.state.error });
    }
}

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.config.enableDesignSystem) return;

    // Implementation depends on event handling strategy
}

  /**
   * Load default tokens
   */
  private loadDefaultTokens(): void {
    const defaultTokens: Partial<DesignToken>[] = [
      // Color tokens
      {
        id: 'color-primary',
        name: 'Primary Color',
        value: '#1976d',
        type: 'color',
        category: 'color',
        subcategory: 'primary',
        description: 'Primary brand color',
        usage: ['buttons','links','focus states'],
        examples: ['#1976d2','#1565c0','#0d47a1'],
        variants: [
          { id: 'color-primary-5', name: 'Primary 5', value: '#e3f2fd', description: 'Lightest primary color', usage: ['backgrounds'], examples: [] },
          { id: 'color-primary-10', name: 'Primary 10', value: '#bbdefb', description: 'Light primary color', usage: ['backgrounds'], examples: [] },
          { id: 'color-primary-50', name: 'Primary 50', value: '#2196f3', description: 'Main primary color', usage: ['buttons','links'], examples: [] },
          { id: 'color-primary-70', name: 'Primary 70', value: '#1976d2', description: 'Dark primary color', usage: ['hover states'], examples: [] },
          { id: 'color-primary-90', name: 'Primary 90', value: '#0d47a1', description: 'Darkest primary color', usage: ['text'], examples: [] }
        ]
      },
      {
        id: 'color-secondary',
        name: 'Secondary Color',
        value: '#dc004e',
        type: 'color',
        category: 'color',
        subcategory: 'secondary',
        description: 'Secondary brand color',
        usage: ['accent elements','highlights'],
        examples: ['#dc004e','#c2185b','#ad1457'],
        variants: [
          { id: 'color-secondary-5', name: 'Secondary 5', value: '#fce4ec', description: 'Lightest secondary color', usage: ['backgrounds'], examples: [] },
          { id: 'color-secondary-10', name: 'Secondary 10', value: '#f8bbd0', description: 'Light secondary color', usage: ['backgrounds'], examples: [] },
          { id: 'color-secondary-50', name: 'Secondary 50', value: '#e91e63', description: 'Main secondary color', usage: ['accent elements'], examples: [] },
          { id: 'color-secondary-70', name: 'Secondary 70', value: '#c2185b', description: 'Dark secondary color', usage: ['hover states'], examples: [] },
          { id: 'color-secondary-90', name: 'Secondary 90', value: '#880e4f', description: 'Darkest secondary color', usage: ['text'], examples: [] }
        ]
      },
      // Typography tokens
      {
        id: 'typography-heading-',
        name: 'Heading 1',
        value: {
          fontFamily: 'Roboto, sans-serif',
          fontSize: '2.5rem',
          fontWeight: 3,
          lineHeight: 1.2,
          letterSpacing: '-0.01562em'
    },
        type: 'typography',
        category: 'typography',
        subcategory: 'headings',
        description: 'Main page heading',
        usage: ['page titles','hero headings'],
        examples: ['h','Page Title','Hero Heading'],
        variants: []
  },
      {
        id: 'typography-body-',
        name: 'Body 1',
        value: {
          fontFamily: 'Roboto, sans-serif',
          fontSize: '1rem',
          fontWeight: 4,
          lineHeight: 1.5,
          letterSpacing: '0.00938em'
    },
        type: 'typography',
        category: 'typography',
        subcategory: 'body',
        description: 'Main body text',
        usage: ['paragraphs','body text'],
        examples: [', ','Body text','Content'],
        variants: []
  },
      // Spacing tokens
      {
        id: 'spacing-xs',
        name: 'Extra Small Spacing',
        value: '4px',
        type: 'spacing',
        category: 'spacing',
        subcategory: 'size',
        description: 'Extra small spacing unit',
        usage: ['tight spacing','icon padding'],
        examples: ['4px','0.25rem'],
        variants: []
  },
      {
        id: 'spacing-sm',
        name: 'Small Spacing',
        value: '8px',
        type: 'spacing',
        category: 'spacing',
        subcategory: 'size',
        description: 'Small spacing unit',
        usage: ['component padding','small gaps'],
        examples: ['8px','0.5rem'],
        variants: []
  },
      {
        id: 'spacing-md',
        name: 'Medium Spacing',
        value: '16px',
        type: 'spacing',
        category: 'spacing',
        subcategory: 'size',
        description: 'Medium spacing unit',
        usage: ['section padding','component margins'],
        examples: ['16px','1rem'],
        variants: []
  },
      {
        id: 'spacing-lg',
        name: 'Large Spacing',
        value: '24px',
        type: 'spacing',
        category: 'spacing',
        subcategory: 'size',
        description: 'Large spacing unit',
        usage: ['section margins','large gaps'],
        examples: ['24px','1.5rem'],
        variants: []
  },
      {
        id: 'spacing-xl',
        name: 'Extra Large Spacing',
        value: '32px',
        type: 'spacing',
        category: 'spacing',
        subcategory: 'size',
        description: 'Extra large spacing unit',
        usage: ['page margins','large sections'],
        examples: ['32px','2rem'],
        variants: []
  },
      // Shadow tokens
      {
        id: 'shadow-sm',
        name: 'Small Shadow',
        value: '0 1px 3px rgba(00.12), 0 1px 2px rgba(00, 0.24)',
        type: 'shadow',
        category: 'shadow',
        subcategory: 'size',
        description: 'Small shadow for subtle elevation',
        usage: ['cards','buttons'],
        examples: ['0 1px 3px rgba(00.12)'],
        variants: []
  },
      {
        id: 'shadow-md',
        name: 'Medium Shadow',
        value: '0 3px 6px rgba(00.16), 0 3px 6px rgba(00, 0.23)',
        type: 'shadow',
        category: 'shadow',
        subcategory: 'size',
        description: 'Medium shadow for moderate elevation',
        usage: ['modals','dropdowns'],
        examples: ['0 3px 6px rgba(00.16)'],
        variants: []
  },
      {
        id: 'shadow-lg',
        name: 'Large Shadow',
        value: '0 10px 20px rgba(00.19), 0 6px 6px rgba(00, 0.23)',
        type: 'shadow',
        category: 'shadow',
        subcategory: 'size',
        description: 'Large shadow for high elevation',
        usage: ['tooltips','popovers'],
        examples: ['0 10px 20px rgba(00.19)'],
        variants: []
  },
      // Border tokens
      {
        id: 'border-radius-sm',
        name: 'Small Border Radius',
        value: '4px',
        type: 'border',
        category: 'border',
        subcategory: 'radius',
        description: 'Small border radius for subtle rounding',
        usage: ['buttons','inputs'],
        examples: ['4px','0.25rem'],
        variants: []
  },
      {
        id: 'border-radius-md',
        name: 'Medium Border Radius',
        value: '8px',
        type: 'border',
        category: 'border',
        subcategory: 'radius',
        description: 'Medium border radius for moderate rounding',
        usage: ['cards','modals'],
        examples: ['8px','0.5rem'],
        variants: []
  },
      {
        id: 'border-radius-lg',
        name: 'Large Border Radius',
        value: '12px',
        type: 'border',
        category: 'border',
        subcategory: 'radius',
        description: 'Large border radius for prominent rounding',
        usage: ['large cards','hero sections'],
        examples: ['12px','0.75rem'],
        variants: []
  }
    ];

    defaultTokens.forEach(tokenData => {
      this.addToken(tokenData);
  });
}

  /**
   * Load default guidelines
   */
  private loadDefaultGuidelines(): void {
    const defaultGuidelines: Partial<DesignGuideline>[] = [
      {
        id: 'guideline-color-contrast',
        name: 'Color Contrast',
        description: 'Ensure sufficient color contrast for accessibility',
        category: 'accessibility',
        subcategory: 'color',
        type: 'accessibility',
        content: 'All text must have a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text (18pt+ or 14pt+ bold). Use color contrast tools to verify compliance.',
        examples: [
          {
            id: 'example-contrast-good',
            name: 'Good Contrast',
            description: 'Text with sufficient contrast',
            code: 'color: #000000; background-color: #ffffff',
            preview: 'contrast-good',
            tags: ['accessibility','color'],
            category: 'accessibility'
      },
          {
            id: 'example-contrast-bad',
            name: 'Poor Contrast',
            description: 'Text with insufficient contrast',
            code: 'color: #666666; background-color: #ffffff',
            preview: 'contrast-bad',
            tags: ['accessibility','color'],
            category: 'accessibility'
      }
        ],
        relatedTokens: ['color-primary','color-secondary'],
        relatedComponents: ['Button','Text','Card']
    },
      {
        id: 'guideline-typography-hierarchy',
        name: 'Typography Hierarchy',
        description: 'Maintain consistent typography hierarchy',
        category: 'typography',
        subcategory: 'hierarchy',
        type: 'principle',
        content: 'Use a clear typography hierarchy with distinct heading levels. Headings should be visually distinct and follow a logical progression. Use consistent spacing between elements.',
        examples: [
          {
            id: 'example-typography-hierarchy',
            name: 'Typography Hierarchy',
            description: 'Example of proper typography hierarchy',
            code: '<h1>Main Heading</h1><h2>Section Heading</h2><h3>Subsection Heading</h3><p>Body text</p>, ',
            preview: 'typography-hierarchy',
            tags: ['typography','hierarchy'],
            category: 'typography'
      }
        ],
        relatedTokens: ['typography-heading-','typography-body-1'],
        relatedComponents: ['Heading','Text','Card']
    },
      {
        id: 'guideline-spacing-consistency',
        name: 'Spacing Consistency',
        description: 'Use consistent spacing throughout the design',
        category: 'layout',
        subcategory: 'spacing',
        type: 'principle',
        content: 'Use the defined spacing tokens consistently. Maintain consistent spacing between related elements and create visual rhythm through spacing.',
        examples: [
          {
            id: 'example-spacing-consistency',
            name: 'Spacing Consistency',
            description: 'Example of consistent spacing',
            code: 'margin: var(--spacing-md); padding: var(--spacing-sm)',
            preview: 'spacing-consistency',
            tags: ['spacing','layout'],
            category: 'layout'
      }
        ],
        relatedTokens: ['spacing-xs','spacing-sm','spacing-md','spacing-lg','spacing-xl'],
        relatedComponents: ['Card','Button','Input']
    }
    ];

    defaultGuidelines.forEach(guidelineData => {
      this.addGuideline(guidelineData);
  });
}

  /**
   * Load default themes
   */
  private loadDefaultThemes(): void {
    const defaultThemes: Partial<DesignTheme>[] = [
      {
        id: 'theme-light',
        name: 'Light Theme',
        description: 'Default light theme',
        type: 'light',
        tokens: new Map(),
        guidelines: new Map(),
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['light','default'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'theme-dark',
        name: 'Dark Theme',
        description: 'Dark theme for low-light environments',
        type: 'dark',
        tokens: new Map(),
        guidelines: new Map(),
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['dark','low-light'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    }
    ];

    defaultThemes.forEach(themeData => {
      this.addTheme(themeData);
  });
}

  /**
   * Add token
   */
  async addToken(tokenData: Partial<DesignToken>): Promise<DesignToken> {
    if (!this.state.isEnabled) throw new Error('Design system is not enabled');

    const token: DesignToken = {
      id: tokenData.id || this.generateId(),
      name: tokenData.name || 'Untitled Token',
      value: tokenData.value || ', ',
      type: tokenData.type || 'color',
      category: tokenData.category || 'uncategorized',
      subcategory: tokenData.subcategory,
      description: tokenData.description || ', ',
      usage: tokenData.usage || [],
      examples: tokenData.examples || [],
      variants: tokenData.variants || [],
      metadata: {
        created: Date.now(),
        modified: Date.now(),
        version: '1.0.0',
        author: 'User',
        tags: [],
        usageCount: 0,
        lastUsed: 0,
        successCount: 0,
        errorCount: 0,
        performance: {
          renderTime: 0,
          bundleSize: 0,
          memoryUsage: 0
        }
      },
      config: tokenData.config || {}
    };

    try {
      // Validate token
      if (this.config.enableValidation) {
        await this.validateToken(token);
    }

      // Update state
      this.state.tokens.set(token.id, token);
      this.state.totalTokens++;
      this.state.lastUpdate = Date.now();

      this.emit('token_added', { token });
      return token;

  } catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('token_add_failed', { token, error: this.state.error });
      throw error;
  }
}

  /**
   * Add guideline
   */
  async addGuideline(guidelineData: Partial<DesignGuideline>): Promise<DesignGuideline> {
    if (!this.state.isEnabled) throw new Error('Design system is not enabled');

    const guideline: DesignGuideline = {
      id: guidelineData.id || this.generateId(),
      name: guidelineData.name || 'Untitled Guideline',
      description: guidelineData.description || ', ',
      category: guidelineData.category || 'uncategorized',
      subcategory: guidelineData.subcategory,
      type: guidelineData.type || 'principle',
      content: guidelineData.content || ', ',
      examples: guidelineData.examples || [],
      relatedTokens: guidelineData.relatedTokens || [],
      relatedComponents: guidelineData.relatedComponents || [],
      metadata: {
        created: Date.now(),
        modified: Date.now(),
        version: '1.0.0',
        author: 'User',
        tags: [],
        usageCount: 0,
        lastUsed: 0,
        successCount: 0,
        errorCount: 0
      },
      config: guidelineData.config || {}
    };

    try {
      // Update state
      this.state.guidelines.set(guideline.id, guideline);
      this.state.totalGuidelines++;
      this.state.lastUpdate = Date.now();

      this.emit('guideline_added', { guideline });
      return guideline;

  } catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('guideline_add_failed', { guideline, error: this.state.error });
      throw error;
  }
}

  /**
   * Add theme
   */
  async addTheme(themeData: Partial<DesignTheme>): Promise<DesignTheme> {
    if (!this.state.isEnabled) throw new Error('Design system is not enabled');

    const theme: DesignTheme = {
      id: themeData.id || this.generateId(),
      name: themeData.name || 'Untitled Theme',
      description: themeData.description || ', ',
      type: themeData.type || 'custom',
      tokens: themeData.tokens || new Map(),
      guidelines: themeData.guidelines || new Map(),
      metadata: {
        created: Date.now(),
        modified: Date.now(),
        version: '1.0.0',
        author: 'User',
        tags: [],
        usageCount: 0,
        lastUsed: 0,
        successCount: 0,
        errorCount: 0
      },
      config: themeData.config || {}
    };

    try {
      // Update state
      this.state.themes.set(theme.id, theme);
      this.state.totalThemes++;
      this.state.lastUpdate = Date.now();

      this.emit('theme_added', { theme });
      return theme;

  } catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message :'Unknown error';
      
      this.emit('theme_add_failed', { theme, error: this.state.error });
      throw error;
  }
}

  /**
   * Get token by ID
   */
  getToken(id: string): DesignToken | null {
    return this.state.tokens.get(id) || null;
}

  /**
   * Get tokens by type
   */
  getTokensByType(type: string): DesignToken[] {
    return Array.from(this.state.tokens.values()).filter(token => token.type === type);
}

  /**
   * Get tokens by category
   */
  getTokensByCategory(category: string): DesignToken[] {
    return Array.from(this.state.tokens.values()).filter(token => token.category === category);
}

  /**
   * Get guideline by ID
   */
  getGuideline(id: string): DesignGuideline | null {
    return this.state.guidelines.get(id) || null;
}

  /**
   * Get guidelines by category
   */
  getGuidelinesByCategory(category: string): DesignGuideline[] {
    return Array.from(this.state.guidelines.values()).filter(guideline => guideline.category === category);
}

  /**
   * Get theme by ID
   */
  getTheme(id: string): DesignTheme | null {
    return this.state.themes.get(id) || null;
}

  /**
   * Set active theme
   */
  setActiveTheme(themeId: string): void {
    const theme = this.state.themes.get(themeId);
    if (theme) {
      this.state.activeTheme = themeId;
      this.state.lastUpdate = Date.now();
      this.emit('theme_activated', { theme });
  }
}

  /**
   * Get active theme
   */
  getActiveTheme(): DesignTheme | null {
    if (!this.state.activeTheme) return null;
    return this.state.themes.get(this.state.activeTheme) || null;
}

  /**
   * Validate token
   */
  private async validateToken(token: DesignToken): Promise<void> {
    // Implementation depends on validation strategy
}

  /**
   * Generate ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
  }
    this.eventListeners.get(event)!.push(callback);
}

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
    }
  }
}

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
      } catch (error) {
          console.error('Error in design system event listener:', error);
      }
    });
  }
}

  /**
   * Get state
   */
  getState(): DesignSystemState {
    return { ...this.state };
}

  /**
   * Get configuration
   */
  getConfig(): DesignSystemConfig {
    return { ...this.config };
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DesignSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
}

  /**
   * Get all tokens
   */
  getAllTokens(): DesignToken[] {
    return Array.from(this.state.tokens.values());
}

  /**
   * Get all guidelines
   */
  getAllGuidelines(): DesignGuideline[] {
    return Array.from(this.state.guidelines.values());
}

  /**
   * Get all themes
   */
  getAllThemes(): DesignTheme[] {
    return Array.from(this.state.themes.values());
}

  /**
   * Cleanup
   */
  destroy(): void {
    this.state.tokens.clear();
    this.state.guidelines.clear();
    this.state.themes.clear();
    this.eventListeners.clear();
    this.state.isEnabled = false;
}
}

// Create singleton instance
export const designSystemManager = new DesignSystemManager();

export default designSystemManager;




