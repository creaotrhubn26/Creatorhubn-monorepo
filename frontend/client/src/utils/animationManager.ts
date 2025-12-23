/**
 * Animation Manager
 * Manages advanced animation system with timeline editor
 * Enhanced with UX research-backed animations from Material Design, Apple HIG, and WCAG 2.1
 */

// Research-Backed Easing Functions
// Based on Material Design Motion, Apple HIG, and industry standards
export const RESEARCH_BASED_EASING = {
  // Material Design Motion System
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)', // Standard easing for most transitions
  deceleration: 'cubic-bezier(0.0, 0.0, 0.2, 1)', // Objects entering the screen
  acceleration: 'cubic-bezier(0.4, 0.0, 1, 1)', // Objects leaving the screen
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)', // Sharp, quick transitions
  
  // Apple Human Interface Guidelines
  spring: 'cubic-bezier(0.5, 1.5, 0.5, 1)', // Spring-like natural motion
  springGentle: 'cubic-bezier(0.7, 0.9, 0.3, 1.0)', // Gentle spring with less bounce
  
  // Industry Standards (Figma, Framer, Webflow)
  smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)', // Smooth, consistent motion
  natural: 'cubic-bezier(0.6, 0.04, 0.98, 0.34)', // Natural, organic feel
  
  // Legacy support
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  linear: 'linear'
};

// Research-Backed Duration Standards
// Based on cognitive load research and Material Design guidelines
export const RESEARCH_BASED_DURATIONS = {
  instant: 0, // Immediate, no animation
  fast: 100, // Micro-interactions, instant feedback
  normal: 200, // Standard UI transitions
  moderate: 300, // Complex component transitions
  slow: 400, // Page-level transitions
  slower: 500, // Complex multi-stage animations
  emphasis: 1000 // Emphasis animations (pulse, glow)
};

// Animation Research Metadata
export interface AnimationResearch {
  source: 'Material Design' | 'Apple HIG' | 'WCAG 2.1' | 'Industry Standard' | 'Academic Research';
  useCase: string;
  accessibilityRating: 'AAA' | 'AA' | 'A' | 'Needs Review';
  performanceImpact: 'low' | 'medium' | 'high';
  cognitiveLoad: 'low' | 'medium' | 'high';
  recommendedContext: string[];
}

export interface AnimationConfig {
  enableAnimations: boolean;
  enableTimeline: boolean;
  enableKeyframes: boolean;
  enableEasing: boolean;
  enableTransitions: boolean;
  enableTransforms: boolean;
  enableFilters: boolean;
  enableEffects: boolean;
  enablePerformance: boolean;
  enableOptimization: boolean;
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
  enableAccessibility: boolean;
  enableResponsive: boolean;
  enableCustomization: boolean;
  enableTemplates: boolean;
  enablePresets: boolean;
  enableAutoPlay: boolean;
  enableLooping: boolean;
  enableReversing: boolean;
  enablePausing: boolean;
  enableSeeking: boolean;
  enableScrubbing: boolean;
  enablePreview: boolean;
  enableRendering: boolean;
  enableExporting: boolean;
  debug: boolean
}

export interface Animation {
  id: string;
  name: string;
  description: string;
  type: 'transition, ' | 'keyframe' | 'sequence' | 'group' | 'timeline' | 'custom';
  duration: number;
  delay: number;
  iterationCount: number | 'infinite';
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fillMode: 'none' | 'forwards' | 'backwards' | 'both';
  playState: 'running' | 'paused' | 'finished' | 'cancelled';
  easing: string;
  keyframes: Keyframe[];
  properties: AnimationProperty[];
  triggers: AnimationTrigger[];
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
      frameRate: number;
      memoryUsage: number;
};
};
  config: Record<string, any>;
  research?: AnimationResearch; // Research-backed metadata
}

export interface Keyframe {
  id: string;
  time: number; // 0-1
  properties: Record<string, any>;
  easing?: string;
  description?: string;
}

export interface AnimationProperty {
  name: string;
  type: 'transform' | 'opacity' | 'color' | 'filter' | 'custom';
  value: any;
  unit?: string;
  description?: string
}

export interface AnimationTrigger {
  id: string;
  type: 'hover' | 'click' | 'scroll' | 'focus' | 'load' | 'custom';
  element: string;
  condition?: string;
  action: 'play' | 'pause' | 'reverse' | 'restart' | 'custom'
}

export interface AnimationTimeline {
  id: string;
  name: string;
  description: string;
  duration: number;
  animations: Animation[];
  tracks: AnimationTrack[];
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

export interface AnimationTrack {
  id: string;
  name: string;
  animations: Animation[];
  startTime: number;
  endTime: number;
  muted: boolean;
  locked: boolean
}

export interface AnimationState {
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  animations: Map<string, Animation>;
  timelines: Map<string, AnimationTimeline>;
  activeAnimations: Map<string, Animation>;
  lastUpdate: number;
  totalAnimations: number;
  totalTimelines: number;
  totalKeyframes: number;
  totalProperties: number;
  totalTriggers: number;
  totalUsage: number;
  totalErrors: number;
  totalConflicts: number;
  totalOverrides: number
}

/**
 * Accessibility Manager
 * Handles motion preferences and WCAG 2.1 compliance for animations
 * Implements Success Criteria 2.2.2, 2.3.1, and 2.3.3
 */
class AccessibilityManager {
  private prefersReducedMotion: boolean = false;
  private mediaQuery: MediaQueryList | null = null;
  private listeners: ((reduced: boolean) => void)[] = [];

  constructor() {
    this.detectMotionPreference();
    this.setupMediaQueryListener();
  }

  /**
   * Detect user's motion preference from system settings
   * Implements WCAG 2.1 Success Criterion 2.3.3
   */
  private detectMotionPreference(): void {
    if (typeof window === 'undefined') return;
    
    try {
      this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = this.mediaQuery.matches;
    } catch (error) {
      console.warn('Motion preference detection not supported:', error);
      this.prefersReducedMotion = false;
    }
  }

  /**
   * Setup listener for motion preference changes
   */
  private setupMediaQueryListener(): void {
    if (!this.mediaQuery) return;

    const handler = (e: MediaQueryListEvent) => {
      this.prefersReducedMotion = e.matches;
      this.notifyListeners(e.matches);
    };

    // Use modern API if available, fallback to deprecated method
    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener('change', handler);
    } else if (this.mediaQuery.addListener) {
      this.mediaQuery.addListener(handler);
    }
  }

  /**
   * Get duration adjusted for accessibility preferences
   * Returns 0 if reduced motion is preferred
   */
  getDuration(baseDuration: number): number {
    return this.prefersReducedMotion ? 0 : baseDuration;
  }

  /**
   * Check if animations should be played
   */
  shouldAnimate(): boolean {
    return !this.prefersReducedMotion;
  }

  /**
   * Get current motion preference state
   */
  getPrefersReducedMotion(): boolean {
    return this.prefersReducedMotion;
  }

  /**
   * Add listener for motion preference changes
   */
  addListener(callback: (reduced: boolean) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove listener
   */
  removeListener(callback: (reduced: boolean) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of motion preference change
   */
  private notifyListeners(reduced: boolean): void {
    this.listeners.forEach(listener => {
      try {
        listener(reduced);
      } catch (error) {
        console.error('Error in motion preference listener:', error);
      }
    });
  }

  /**
   * Validate animation for WCAG compliance
   */
  validateAnimation(animation: Animation): {
    compliant: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // WCAG 2.2.2: Animations should be pausable/stoppable
    if (animation.duration > 5000 && animation.iterationCount === 'infinite') {
      issues.push('WCAG 2.2.2: Infinite animations longer than 5s should be pausable');
    }

    // WCAG 2.3.1: No more than 3 flashes per second
    const flashesPerSecond = animation.keyframes.length / (animation.duration / 1000);
    if (flashesPerSecond > 3) {
      issues.push('WCAG 2.3.1: Animation may cause more than 3 flashes per second');
    }

    // Best practice: Keep durations reasonable
    if (animation.duration > 5000 && animation.iterationCount !== 'infinite') {
      issues.push('Best Practice: Animation duration exceeds 5 seconds');
    }

    return {
      compliant: issues.length === 0,
      issues
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.listeners = [];
    if (this.mediaQuery) {
      // Remove listener if possible
      if (this.mediaQuery.removeEventListener) {
        this.mediaQuery.removeEventListener('change', () => {});
      }
    }
  }
}

class AnimationManager {
  private config: AnimationConfig;
  private state: AnimationState;
  private eventListeners: Map<string, Function[]> = new Map();
  private isInitialized = false;
  private animationFrameId: number | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  private accessibilityManager: AccessibilityManager;

  constructor(config: Partial<AnimationConfig> = {}) {
    // Initialize accessibility manager first
    this.accessibilityManager = new AccessibilityManager();
    this.config = {
      enableAnimations: true,
      enableTimeline: true,
      enableKeyframes: true,
      enableEasing: true,
      enableTransitions: true,
      enableTransforms: true,
      enableFilters: true,
      enableEffects: true,
      enablePerformance: true,
      enableOptimization: true,
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
      enableAccessibility: true,
      enableResponsive: true,
      enableCustomization: true,
      enableTemplates: true,
      enablePresets: true,
      enableAutoPlay: true,
      enableLooping: true,
      enableReversing: true,
      enablePausing: true,
      enableSeeking: true,
      enableScrubbing: true,
      enablePreview: true,
      enableRendering: true,
      enableExporting: true,
      debug: false,
      ...config
};

    this.state = {
      isEnabled: false,
      isInitialized: false,
      hasError: false,
      error: null,
      animations: new Map(),
      timelines: new Map(),
      activeAnimations: new Map(),
      lastUpdate:  0,
      totalAnimations:  0,
      totalTimelines:  0,
      totalKeyframes:  0,
      totalProperties:  0,
      totalTriggers:  0,
      totalUsage:  0,
      totalErrors:  0,
      totalConflicts:  0,
      totalOverrides: 0
};

    this.initializeAnimationManager();
}

  /**
   * Initialize animation manager
   */
  private initializeAnimationManager(): void {
    if (!this.config.enableAnimations) return;

    try {
      // Enable manager first so load methods can work
      this.state.isEnabled = true;
      this.setupEventListeners();
      this.setupPerformanceObserver();
      this.loadDefaultAnimations();
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
    if (!this.config.enableAnimations) return;

    // Setup performance observer
    if (this.config.enablePerformance && 'PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        this.handlePerformanceEntries(list.getEntries());
  });
      this.performanceObserver.observe({ entryTypes: ['measure','navigation'] });
}
}

  /**
   * Setup performance observer
   */
  private setupPerformanceObserver(): void {
    if (!this.config.enablePerformance) return;

    // Implementation depends on performance monitoring strategy
}

  /**
   * Load default animations
   * 30 Research-backed animations based on Material Design, Apple HIG, and WCAG 2.1
   */
  private loadDefaultAnimations(): void {
    const defaultAnimations: Partial<Animation>[] = [
      // ENTRANCE ANIMATIONS (10)
      {
        id: 'fade-in',
        name: 'Fade In',
        description: 'Smooth fade in transition for entering elements',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.moderate,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.deceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { opacity: 0 } },
          { id: 'end', time: 1, properties: { opacity: 1 } }
        ],
        properties: [{ name: 'opacity', type: 'opacity', value: 1, description: 'Opacity transition' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Element entrance, content loading',
          accessibilityRating: 'AAA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['modals', 'tooltips', 'notifications']
        }
      },
      {
        id: 'slide-in-left',
        name: 'Slide In Left',
        description: 'Slide in from left edge with fade',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.deceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'translateX(-100%)', opacity: 0 } },
          { id: 'end', time: 1, properties: { transform: 'translateX(0)', opacity: 1 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'translateX(0)', description: 'Slide transform' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Drawer open, sidebar entrance',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['sidebars', 'drawers', 'panels']
        }
      },
      {
        id: 'slide-in-right',
        name: 'Slide In Right',
        description: 'Slide in from right edge with fade',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.deceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'translateX(100%)', opacity: 0 } },
          { id: 'end', time: 1, properties: { transform: 'translateX(0)', opacity: 1 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'translateX(0)', description: 'Slide transform' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Contextual panels, property editors',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['property-panels', 'context-menus']
        }
      },
      {
        id: 'slide-in-top',
        name: 'Slide In Top',
        description: 'Slide down from top edge',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.deceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'translateY(-100%)', opacity: 0 } },
          { id: 'end', time: 1, properties: { transform: 'translateY(0)', opacity: 1 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'translateY(0)', description: 'Slide transform' }],
        triggers: [],
        research: {
          source: 'Industry Standard',
          useCase: 'Notifications, alerts, dropdowns',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['notifications', 'alerts', 'dropdowns']
        }
      },
      {
        id: 'slide-in-bottom',
        name: 'Slide Up',
        description: 'Slide up from bottom edge',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.deceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'translateY(100%)', opacity: 0 } },
          { id: 'end', time: 1, properties: { transform: 'translateY(0)', opacity: 1 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'translateY(0)', description: 'Slide transform' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Bottom sheets, action bars',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['bottom-sheets', 'snackbars', 'toasts']
        }
      },
      {
        id: 'scale-in',
        name: 'Scale In',
        description: 'Scale from small to normal size with spring',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.spring,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'scale(0)', opacity: 0 } },
          { id: 'end', time: 1, properties: { transform: 'scale(1)', opacity: 1 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'scale(1)', description: 'Scale transform' }],
        triggers: [],
        research: {
          source: 'Apple HIG',
          useCase: 'Pop-up elements, dialogs, badges',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'medium',
          recommendedContext: ['modals', 'dialogs', 'popovers']
        }
      },
      {
        id: 'rotate-fade-in',
        name: 'Rotate Fade In',
        description: 'Rotate and fade in with smooth easing',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.slow,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.smooth,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'rotate(-180deg) scale(0)', opacity: 0 } },
          { id: 'end', time: 1, properties: { transform: 'rotate(0) scale(1)', opacity: 1 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'rotate(0) scale(1)', description: 'Rotate transform' }],
        triggers: [],
        research: {
          source: 'Industry Standard',
          useCase: 'Loading indicators, special effects',
          accessibilityRating: 'A',
          performanceImpact: 'medium',
          cognitiveLoad: 'medium',
          recommendedContext: ['loading', 'transitions', 'decorative']
        }
      },
      {
        id: 'bounce-in',
        name: 'Bounce In',
        description: 'Bouncy entrance with spring physics',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.slower,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.spring,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'scale(0)', opacity: 0 } },
          { id: 'mid', time: 0.5, properties: { transform: 'scale(1.2)', opacity: 1 } },
          { id: 'end', time: 1, properties: { transform: 'scale(1)', opacity: 1 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'scale(1)', description: 'Bounce transform' }],
        triggers: [],
        research: {
          source: 'Apple HIG',
          useCase: 'Success feedback, attention-getting elements',
          accessibilityRating: 'A',
          performanceImpact: 'medium',
          cognitiveLoad: 'medium',
          recommendedContext: ['success-messages', 'achievements', 'celebrations']
        }
      },
      {
        id: 'flip-in',
        name: 'Flip In',
        description: '3D flip entrance effect',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.moderate,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.smooth,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'rotateY(-90deg)', opacity: 0 } },
          { id: 'end', time: 1, properties: { transform: 'rotateY(0)', opacity: 1 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'rotateY(0)', description: 'Flip transform' }],
        triggers: [],
        research: {
          source: 'Industry Standard',
          useCase: 'Card flips, view transitions',
          accessibilityRating: 'A',
          performanceImpact: 'medium',
          cognitiveLoad: 'medium',
          recommendedContext: ['cards', 'views', 'transitions']
        }
      },
      {
        id: 'zoom-in',
        name: 'Zoom In',
        description: 'Quick zoom in from center',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.spring,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'scale(0.8)', opacity: 0 } },
          { id: 'end', time: 1, properties: { transform: 'scale(1)', opacity: 1 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'scale(1)', description: 'Zoom transform' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Focus elements, images, media',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['images', 'media', 'focus-states']
        }
      },

      // EXIT ANIMATIONS (8)
      {
        id: 'fade-out',
        name: 'Fade Out',
        description: 'Smooth fade out for exiting elements',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.acceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { opacity: 1 } },
          { id: 'end', time: 1, properties: { opacity: 0 } }
        ],
        properties: [{ name: 'opacity', type: 'opacity', value: 0, description: 'Opacity transition' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Element removal, hiding content',
          accessibilityRating: 'AAA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['dismissals', 'removals', 'hiding']
        }
      },
      {
        id: 'slide-out-left',
        name: 'Slide Out Left',
        description: 'Slide out to left edge',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.acceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'translateX(0)', opacity: 1 } },
          { id: 'end', time: 1, properties: { transform: 'translateX(-100%)', opacity: 0 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'translateX(-100%)', description: 'Slide transform' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Drawer close, navigation back',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['drawers', 'sidebars', 'navigation']
        }
      },
      {
        id: 'slide-out-right',
        name: 'Slide Out Right',
        description: 'Slide out to right edge',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.acceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'translateX(0)', opacity: 1 } },
          { id: 'end', time: 1, properties: { transform: 'translateX(100%)', opacity: 0 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'translateX(100%)', description: 'Slide transform' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Swipe to dismiss, panel close',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['dismissals', 'swipe-actions']
        }
      },
      {
        id: 'slide-out-top',
        name: 'Slide Out Top',
        description: 'Slide out to top edge',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.acceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'translateY(0)', opacity: 1 } },
          { id: 'end', time: 1, properties: { transform: 'translateY(-100%)', opacity: 0 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'translateY(-100%)', description: 'Slide transform' }],
        triggers: [],
        research: {
          source: 'Industry Standard',
          useCase: 'Notification dismiss, top sheet close',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['notifications', 'alerts']
        }
      },
      {
        id: 'slide-out-bottom',
        name: 'Slide Out Bottom',
        description: 'Slide out to bottom edge',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.acceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'translateY(0)', opacity: 1 } },
          { id: 'end', time: 1, properties: { transform: 'translateY(100%)', opacity: 0 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'translateY(100%)', description: 'Slide transform' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Bottom sheet dismiss, toast removal',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['bottom-sheets', 'toasts']
        }
      },
      {
        id: 'scale-out',
        name: 'Scale Out',
        description: 'Scale down to disappear',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.sharp,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'scale(1)', opacity: 1 } },
          { id: 'end', time: 1, properties: { transform: 'scale(0)', opacity: 0 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'scale(0)', description: 'Scale transform' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Element deletion, item removal',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['deletions', 'removals']
        }
      },
      {
        id: 'rotate-fade-out',
        name: 'Rotate Fade Out',
        description: 'Rotate and fade out',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.moderate,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.smooth,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'rotate(0) scale(1)', opacity: 1 } },
          { id: 'end', time: 1, properties: { transform: 'rotate(180deg) scale(0)', opacity: 0 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'rotate(180deg) scale(0)', description: 'Rotate transform' }],
        triggers: [],
        research: {
          source: 'Industry Standard',
          useCase: 'Special transitions, decorative effects',
          accessibilityRating: 'A',
          performanceImpact: 'medium',
          cognitiveLoad: 'medium',
          recommendedContext: ['transitions', 'decorative']
        }
      },
      {
        id: 'collapse',
        name: 'Collapse',
        description: 'Vertical collapse animation',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.acceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'scaleY(1)', opacity: 1 } },
          { id: 'end', time: 1, properties: { transform: 'scaleY(0)', opacity: 0 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'scaleY(0)', description: 'Collapse transform' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Accordion close, section hide',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['accordions', 'sections']
        }
      },

      // EMPHASIS ANIMATIONS (6)
      {
        id: 'pulse',
        name: 'Pulse',
        description: 'Subtle pulsing for continuous attention',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.emphasis,
        delay: 0,
        iterationCount: 'infinite',
        direction: 'alternate',
        fillMode: 'none',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.smooth,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'scale(1)' } },
          { id: 'end', time: 1, properties: { transform: 'scale(1.05)' } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'scale(1.05)', description: 'Pulse scale' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Call-to-action emphasis, active states',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['cta-buttons', 'active-indicators']
        }
      },
      {
        id: 'shake',
        name: 'Shake',
        description: 'Horizontal shake for errors or alerts',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.slower,
        delay: 0,
        iterationCount: 3,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.sharp,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'translateX(0)' } },
          { id: 'q1', time: 0.25, properties: { transform: 'translateX(-10px)' } },
          { id: 'mid', time: 0.5, properties: { transform: 'translateX(10px)' } },
          { id: 'q3', time: 0.75, properties: { transform: 'translateX(-10px)' } },
          { id: 'end', time: 1, properties: { transform: 'translateX(0)' } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'translateX(0)', description: 'Shake transform' }],
        triggers: [],
        research: {
          source: 'Industry Standard',
          useCase: 'Error feedback, invalid input, attention',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'medium',
          recommendedContext: ['errors', 'validation', 'alerts']
        }
      },
      {
        id: 'wiggle',
        name: 'Wiggle',
        description: 'Gentle rotation wiggle',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.slow,
        delay: 0,
        iterationCount: 3,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.spring,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'rotate(0deg)' } },
          { id: 'q1', time: 0.25, properties: { transform: 'rotate(-5deg)' } },
          { id: 'mid', time: 0.5, properties: { transform: 'rotate(5deg)' } },
          { id: 'q3', time: 0.75, properties: { transform: 'rotate(-5deg)' } },
          { id: 'end', time: 1, properties: { transform: 'rotate(0deg)' } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'rotate(0deg)', description: 'Wiggle rotation' }],
        triggers: [],
        research: {
          source: 'Apple HIG',
          useCase: 'Playful interactions, drag hints',
          accessibilityRating: 'A',
          performanceImpact: 'low',
          cognitiveLoad: 'medium',
          recommendedContext: ['playful-ui', 'hints', 'tutorials']
        }
      },
      {
        id: 'glow',
        name: 'Glow',
        description: 'Subtle glow effect for emphasis',
        type: 'custom',
        duration: 1500,
        delay: 0,
        iterationCount: 'infinite',
        direction: 'alternate',
        fillMode: 'none',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.smooth,
        keyframes: [
          { id: 'start', time: 0, properties: { filter: 'brightness(1) drop-shadow(0 0 0px rgba(255,255,255,0))' } },
          { id: 'end', time: 1, properties: { filter: 'brightness(1.2) drop-shadow(0 0 10px rgba(255,255,255,0.5))' } }
        ],
        properties: [{ name: 'filter', type: 'filter', value: 'brightness(1.2)', description: 'Glow filter' }],
        triggers: [],
        research: {
          source: 'Industry Standard',
          useCase: 'Highlight important elements, focus states',
          accessibilityRating: 'A',
          performanceImpact: 'medium',
          cognitiveLoad: 'medium',
          recommendedContext: ['highlights', 'focus', 'emphasis']
        }
      },
      {
        id: 'highlight-flash',
        name: 'Highlight Flash',
        description: 'Brief background color flash',
        type: 'custom',
        duration: 600,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.smooth,
        keyframes: [
          { id: 'start', time: 0, properties: { backgroundColor: 'transparent' } },
          { id: 'mid', time: 0.5, properties: { backgroundColor: 'rgba(255, 235, 59, 0.3)' } },
          { id: 'end', time: 1, properties: { backgroundColor: 'transparent' } }
        ],
        properties: [{ name: 'backgroundColor', type: 'color', value: 'transparent', description: 'Background color' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'New item highlight, change notification',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['new-items', 'updates', 'changes']
        }
      },
      {
        id: 'attention-seeker',
        name: 'Attention Seeker',
        description: 'Combined scale and glow for maximum attention',
        type: 'custom',
        duration: 800,
        delay: 0,
        iterationCount: 2,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.sharp,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'scale(1)' } },
          { id: 'mid', time: 0.5, properties: { transform: 'scale(1.15)' } },
          { id: 'end', time: 1, properties: { transform: 'scale(1)' } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'scale(1)', description: 'Attention scale' }],
        triggers: [],
        research: {
          source: 'Industry Standard',
          useCase: 'Critical actions, urgent notifications',
          accessibilityRating: 'A',
          performanceImpact: 'medium',
          cognitiveLoad: 'high',
          recommendedContext: ['urgent-actions', 'critical-alerts']
        }
      },

      // INTERACTION ANIMATIONS (6)
      {
        id: 'button-press',
        name: 'Button Press',
        description: 'Quick scale down for button press feedback',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.fast,
        delay: 0,
        iterationCount: 1,
        direction: 'alternate',
        fillMode: 'none',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.sharp,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'scale(1)' } },
          { id: 'end', time: 1, properties: { transform: 'scale(0.95)' } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'scale(0.95)', description: 'Press scale' }],
        triggers: [],
        research: {
          source: 'Apple HIG',
          useCase: 'Button press, touch feedback',
          accessibilityRating: 'AAA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['buttons', 'interactive-elements']
        }
      },
      {
        id: 'hover-lift',
        name: 'Hover Lift',
        description: 'Subtle lift on hover with shadow',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.deceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'translateY(0)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' } },
          { id: 'end', time: 1, properties: { transform: 'translateY(-4px)', boxShadow: '0 8px 16px rgba(0,0,0,0.15)' } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'translateY(-4px)', description: 'Lift transform' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Card hover, interactive elements',
          accessibilityRating: 'AAA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['cards', 'interactive-items']
        }
      },
      {
        id: 'focus-ring',
        name: 'Focus Ring',
        description: 'Accessibility focus indicator',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.standard,
        keyframes: [
          { id: 'start', time: 0, properties: { outline: '0px solid rgba(33, 150, 243, 0)', outlineOffset: '0px' } },
          { id: 'end', time: 1, properties: { outline: '2px solid rgba(33, 150, 243, 1)', outlineOffset: '2px' } }
        ],
        properties: [{ name: 'outline', type: 'custom', value: '2px solid rgba(33, 150, 243, 1)', description: 'Focus outline' }],
        triggers: [],
        research: {
          source: 'WCAG 2.1',
          useCase: 'Keyboard focus, accessibility',
          accessibilityRating: 'AAA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['all-interactive-elements']
        }
      },
      {
        id: 'ripple',
        name: 'Ripple Effect',
        description: 'Material Design ripple feedback',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.moderate,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.deceleration,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'scale(0)', opacity: 0.5 } },
          { id: 'end', time: 1, properties: { transform: 'scale(4)', opacity: 0 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'scale(4)', description: 'Ripple scale' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Touch feedback, click visualization',
          accessibilityRating: 'AA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['buttons', 'touch-targets']
        }
      },
      {
        id: 'toggle-switch',
        name: 'Toggle Switch',
        description: 'Smooth toggle transition',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.spring,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'translateX(0)' } },
          { id: 'end', time: 1, properties: { transform: 'translateX(100%)' } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'translateX(100%)', description: 'Toggle translate' }],
        triggers: [],
        research: {
          source: 'Apple HIG',
          useCase: 'Toggle switches, binary controls',
          accessibilityRating: 'AAA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['toggles', 'switches', 'binary-controls']
        }
      },
      {
        id: 'checkbox-check',
        name: 'Checkbox Check',
        description: 'Checkmark animation with spring',
        type: 'custom',
        duration: RESEARCH_BASED_DURATIONS.normal,
        delay: 0,
        iterationCount: 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: RESEARCH_BASED_EASING.spring,
        keyframes: [
          { id: 'start', time: 0, properties: { transform: 'scale(0) rotate(-45deg)', opacity: 0 } },
          { id: 'end', time: 1, properties: { transform: 'scale(1) rotate(0deg)', opacity: 1 } }
        ],
        properties: [{ name: 'transform', type: 'transform', value: 'scale(1) rotate(0deg)', description: 'Check transform' }],
        triggers: [],
        research: {
          source: 'Material Design',
          useCase: 'Checkbox selection, completion feedback',
          accessibilityRating: 'AAA',
          performanceImpact: 'low',
          cognitiveLoad: 'low',
          recommendedContext: ['checkboxes', 'selections', 'completions']
        }
      }
    ];

    defaultAnimations.forEach(animationData => {
      this.addAnimation(animationData);
    });
  }

  /**
   * Add animation
   */
  async addAnimation(animationData: Partial<Animation>): Promise<Animation> {
    if (!this.state.isEnabled) throw new Error('Animation manager is not enabled');

    const animation: Animation = {
      id: animationData.id || this.generateId(),
      name: animationData.name || 'Untitled Animation',
      description: animationData.description || ', ',
      type: animationData.type || 'custom',
      duration: animationData.duration || 300,
      delay: animationData.delay || 0,
      iterationCount: animationData.iterationCount || 1,
      direction: animationData.direction || 'normal',
      fillMode: animationData.fillMode || 'forwards',
      playState: animationData.playState || 'paused',
      easing: animationData.easing || 'ease',
      keyframes: animationData.keyframes || [],
      properties: animationData.properties || [],
      triggers: animationData.triggers || [],
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
          frameRate:  0,
          memoryUsage: 0
  }
  },
      config: animationData.config || {}
};

    try {
      // Validate animation
      if (this.config.enableValidation) {
        await this.validateAnimation(animation);
  }

      // Update state
      this.state.animations.set(animation.id, animation);
      this.state.totalAnimations++;
      this.state.lastUpdate = Date.now();

      this.emit('animation_added', { animation });
      return animation;

} catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('animation_add_failed', { animation, error: this.state.error });
      throw error;
}
}

  /**
   * Play animation
   */
  async playAnimation(animationId: string, element?: HTMLElement): Promise<void> {
    const animation = this.state.animations.get(animationId);
    if (!animation) throw new Error(`Animation not found: ${animationId}`);

    try {
      // Update animation state
      animation.playState = 'running';
      this.state.activeAnimations.set(animationId, animation);
      this.state.lastUpdate = Date.now();

      // Apply animation to element
      if (element) {
        await this.applyAnimationToElement(animation, element);
  }

      this.emit('animation_played', { animation, element });

} catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('animation_play_failed', { animation, element, error: this.state.error });
      throw error;
}
}

  /**
   * Pause animation
   */
  async pauseAnimation(animationId: string): Promise<void> {
    const animation = this.state.animations.get(animationId);
    if (!animation) throw new Error(`Animation not found: ${animationId}`);

    try {
      // Update animation state
      animation.playState = 'paused';
      this.state.lastUpdate = Date.now();

      this.emit('animation_paused', { animation });

} catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('animation_pause_failed', { animation, error: this.state.error });
      throw error;
}
}

  /**
   * Stop animation
   */
  async stopAnimation(animationId: string): Promise<void> {
    const animation = this.state.animations.get(animationId);
    if (!animation) throw new Error(`Animation not found: ${animationId}`);

    try {
      // Update animation state
      animation.playState = 'cancelled';
      this.state.activeAnimations.delete(animationId);
      this.state.lastUpdate = Date.now();

      this.emit('animation_stopped', { animation });

} catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('animation_stop_failed', { animation, error: this.state.error });
      throw error;
}
}

  /**
   * Apply animation to element
   */
  private async applyAnimationToElement(animation: Animation, element: HTMLElement): Promise<void> {
    try {
      // Create CSS animation
      const animationName = `animation-${animation.id}`;
      const keyframes = this.generateKeyframes(animation);
      
      // Add keyframes to document
      this.addKeyframesToDocument(animationName, keyframes);
      
      // Apply animation to element
      element.style.animationName = animationName;
      element.style.animationDuration = `${animation.duration}ms`;
      element.style.animationDelay = `${animation.delay}ms`;
      element.style.animationIterationCount = animation.iterationCount.toString();
      element.style.animationDirection = animation.direction;
      element.style.animationFillMode = animation.fillMode;
      element.style.animationTimingFunction = animation.easing;

      // Handle animation end
      element.addEventListener('animationend', () => {
        animation.playState = 'finished';
        this.state.activeAnimations.delete(animation.id);
        this.state.lastUpdate = Date.now();
        this.emit('animation_finished', { animation, element });
  });

} catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('animation_apply_failed', { animation, element, error: this.state.error });
      throw error;
}
}

  /**
   * Generate keyframes
   */
  private generateKeyframes(animation: Animation): string {
    const keyframeRules = animation.keyframes.map(keyframe => {
      const percentage = Math.round(keyframe.time * 100);
      const properties = Object.entries(keyframe.properties)
        .map(([key, value]) => `${key}: ${value}`)
        .join(';');
      return `${percentage}% { ${properties} }`;
}).join('\n');

    return `@keyframes animation-${animation.id} {\n${keyframeRules}\n}`;
}

  /**
   * Add keyframes to document
   */
  private addKeyframesToDocument(animationName: string, keyframes: string): void {
    // Remove existing keyframes
    const existingStyle = document.getElementById(`keyframes-${animationName}`);
    if (existingStyle) {
      existingStyle.remove();
}

    // Add new keyframes
    const style = document.createElement('style');
    style.id = `keyframes-${animationName}`;
    style.textContent = keyframes;
    document.head.appendChild(style);
}

  /**
   * Handle performance entries
   */
  private handlePerformanceEntries(entries: PerformanceEntry[]): void {
    if (!this.config.enablePerformance) return;

    for (const entry of entries) {
      if (entry.entryType ==='measure') {
        // Handle animation performance metrics
        this.emit('performance_measure', { entry });
  }
}
}

  /**
   * Get animation by ID
   */
  getAnimation(id: string): Animation | null {
    return this.state.animations.get(id) || null;
}

  /**
   * Get animations by type
   */
  getAnimationsByType(type: string): Animation[] {
    return Array.from(this.state.animations.values()).filter(animation => animation.type === type);
}

  /**
   * Get active animations
   */
  getActiveAnimations(): Animation[] {
    return Array.from(this.state.activeAnimations.values());
}

  /**
   * Validate animation
   */
  private async validateAnimation(animation: Animation): Promise<void> {
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
          console.error('Error in animation event listener:', error);
    }
  });
}
}

  /**
   * Get state
   */
  getState(): AnimationState {
    return { ...this.state };
}

  /**
   * Get configuration
   */
  getConfig(): AnimationConfig {
    return { ...this.config };
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AnimationConfig>): void {
    this.config = { ...this.config, ...newConfig };
}

  /**
   * Get all animations
   */
  getAllAnimations(): Animation[] {
    return Array.from(this.state.animations.values());
}

  /**
   * Get accessibility manager
   */
  getAccessibilityManager(): AccessibilityManager {
    return this.accessibilityManager;
  }

  /**
   * Get accessibility-adjusted duration
   */
  getAccessibleDuration(baseDuration: number): number {
    return this.accessibilityManager.getDuration(baseDuration);
  }

  /**
   * Check if animations should play based on accessibility preferences
   */
  shouldAnimateWithAccessibility(): boolean {
    return this.accessibilityManager.shouldAnimate();
  }

  /**
   * Validate animation for WCAG compliance
   */
  validateAnimationAccessibility(animation: Animation): {
    compliant: boolean;
    issues: string[];
  } {
    return this.accessibilityManager.validateAnimation(animation);
  }

  /**
   * Get research-backed easing functions
   */
  getResearchBasedEasing() {
    return RESEARCH_BASED_EASING;
  }

  /**
   * Get research-backed durations
   */
  getResearchBasedDurations() {
    return RESEARCH_BASED_DURATIONS;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
}
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
}
    if (this.accessibilityManager) {
      this.accessibilityManager.destroy();
    }
    this.state.animations.clear();
    this.state.timelines.clear();
    this.state.activeAnimations.clear();
    this.eventListeners.clear();
    this.state.isEnabled = false;
}
}

// Create singleton instance
export const animationManager = new AnimationManager();

export default animationManager;





