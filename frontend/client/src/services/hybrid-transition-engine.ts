/**
 * HYBRID TRANSITION ENGINE
 * Combines Canvas2D (fast, simple) + WebGL (advanced, GPU)
 * Best of both worlds!
 */

import type { TransitionType, Transition } from './transition-effects-engine';
import { transitionEngine as canvas2DEngine } from './transition-effects-engine';
import { webGLTransitionEngine } from './webgl-transition-engine';

export type HybridTransitionType =
  | TransitionType
  | string;

export interface HybridTransition extends Omit<Transition, 'type'> {
  type: HybridTransitionType;
  engine: 'canvas2d' | 'webgl';
  params?: Record<string, unknown>;
}

type CanvasTransitionCategory = {
  name: string;
  transitions: Array<{ type: TransitionType; name: string; duration: number }>;
};

type WebGLTransitionDescriptor = {
  name: string;
  category: string;
  author?: string;
};

type HybridTransitionDescriptor = {
  type: string;
  name: string;
  engine: 'canvas2d' | 'webgl';
  category: string;
  duration: number;
  author?: string;
};

interface Canvas2DEngineLike {
  init?: (canvas: HTMLCanvasElement) => void;
  renderTransition?: (
    fromFrame: HTMLVideoElement | HTMLCanvasElement,
    toFrame: HTMLVideoElement | HTMLCanvasElement,
    transition: Transition,
    progress: number
  ) => void;
  getTransitionCategories?: () => CanvasTransitionCategory[];
  constructor?: {
    getTransitionCategories?: () => CanvasTransitionCategory[];
  };
}

interface WebGLEngineLike {
  init?: (canvas: HTMLCanvasElement) => void;
  setFrames?: (
    fromFrame: HTMLVideoElement | HTMLCanvasElement,
    toFrame: HTMLVideoElement | HTMLCanvasElement
  ) => void;
  render?: (transitionName: string, progress: number, params: Record<string, unknown>) => void;
  getAvailableTransitions?: () => WebGLTransitionDescriptor[];
  dispose?: () => void;
}

const CANVAS_2D_TRANSITION_IDS = [
  'cut',
  'crossfade',
  'fade_black',
  'fade_white',
  'wipe_left',
  'wipe_right',
  'wipe_up',
  'wipe_down',
  'wipe_diagonal',
  'clock_wipe',
  'iris_in',
  'iris_out',
  'slide_left',
  'slide_right',
  'slide_up',
  'slide_down',
  'push_left',
  'push_right',
  'zoom_in',
  'zoom_out',
  'rotate_left',
  'rotate_right',
  'flip_horizontal',
  'flip_vertical',
  'blur',
  'radial_blur',
  'directional_blur',
  'pixelate',
  'glitch',
  'rgb_split',
  'venetian_blinds',
  'checkerboard',
  'swap',
  'cube_left',
  'cube_right',
  'page_curl',
] as const;

/**
 * Hybrid Transition Engine
 * Automatically routes to Canvas2D or WebGL based on transition type
 */
export class HybridTransitionEngine {
  private canvas2DCanvas: HTMLCanvasElement;
  private webGLCanvas: HTMLCanvasElement;
  private useWebGL = true;

  constructor() {
    this.canvas2DCanvas = document.createElement('canvas');
    this.webGLCanvas = document.createElement('canvas');
  }

  private getCanvasEngine(): Canvas2DEngineLike {
    return canvas2DEngine as unknown as Canvas2DEngineLike;
  }

  private getWebGLEngine(): WebGLEngineLike {
    return webGLTransitionEngine as unknown as WebGLEngineLike;
  }

  private getCanvasTransitionCategories(): CanvasTransitionCategory[] {
    const engine = this.getCanvasEngine();

    if (typeof engine.getTransitionCategories === 'function') {
      try {
        const categories = engine.getTransitionCategories();
        if (Array.isArray(categories) && categories.length > 0) {
          return categories;
        }
      } catch (error) {
        console.warn('Canvas transition instance API failed, using fallback categories.', error);
      }
    }

    const staticAccessor = engine.constructor?.getTransitionCategories;
    if (typeof staticAccessor === 'function') {
      try {
        const categories = staticAccessor();
        if (Array.isArray(categories) && categories.length > 0) {
          return categories;
        }
      } catch (error) {
        console.warn('Canvas transition static API failed, using fallback categories.', error);
      }
    }

    return [
      {
        name: 'Basic',
        transitions: [
          { type: 'cut', name: 'Cut', duration: 0 },
          { type: 'crossfade', name: 'Crossfade', duration: 0.5 },
          { type: 'fade_black', name: 'Fade Black', duration: 1.0 },
          { type: 'fade_white', name: 'Fade White', duration: 1.0 },
        ],
      },
    ];
  }

  private getWebGLTransitionsSafe(): WebGLTransitionDescriptor[] {
    if (!this.useWebGL) {
      return [];
    }

    const engine = this.getWebGLEngine();
    if (typeof engine.getAvailableTransitions !== 'function') {
      return [];
    }

    try {
      const transitions = engine.getAvailableTransitions();
      return Array.isArray(transitions) ? transitions : [];
    } catch (error) {
      console.warn('WebGL transition catalog failed, continuing with Canvas2D only.', error);
      return [];
    }
  }

  private renderFallbackCrossfade(
    fromFrame: HTMLVideoElement | HTMLCanvasElement,
    toFrame: HTMLVideoElement | HTMLCanvasElement,
    progress: number,
    outputCanvas: HTMLCanvasElement
  ) {
    const context = outputCanvas.getContext('2d');
    if (!context) {
      return;
    }

    const p = Math.min(1, Math.max(0, progress));
    context.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

    try {
      context.globalAlpha = 1;
      context.drawImage(fromFrame, 0, 0, outputCanvas.width, outputCanvas.height);
      context.globalAlpha = p;
      context.drawImage(toFrame, 0, 0, outputCanvas.width, outputCanvas.height);
      context.globalAlpha = 1;
    } catch (error) {
      context.globalAlpha = 1;
      console.warn('Fallback transition render failed.', error);
    }
  }

  /**
   * Initialize both engines
   */
  init(canvas: HTMLCanvasElement) {
    this.canvas2DCanvas.width = canvas.width;
    this.canvas2DCanvas.height = canvas.height;
    this.webGLCanvas.width = canvas.width;
    this.webGLCanvas.height = canvas.height;

    const canvasEngine = this.getCanvasEngine();
    if (typeof canvasEngine.init === 'function') {
      canvasEngine.init(this.canvas2DCanvas);
    }

    try {
      const webGLEngine = this.getWebGLEngine();
      if (typeof webGLEngine.init === 'function') {
        webGLEngine.init(this.webGLCanvas);
      }
      this.useWebGL = true;
      console.log('✅ Hybrid Transition Engine initialized (Canvas2D + WebGL)');
    } catch (error) {
      console.warn('⚠️ WebGL failed, falling back to Canvas2D only: ', error);
      this.useWebGL = false;
    }
  }

  /**
   * Render transition
   */
  renderTransition(
    fromFrame: HTMLVideoElement | HTMLCanvasElement,
    toFrame: HTMLVideoElement | HTMLCanvasElement,
    transition: HybridTransition,
    progress: number,
    outputCanvas: HTMLCanvasElement
  ) {
    const engine = this.detectEngine(transition.type);
    const context = outputCanvas.getContext('2d');
    if (!context) {
      return;
    }

    if (engine === 'webgl' && this.useWebGL) {
      const webGLEngine = this.getWebGLEngine();
      if (
        typeof webGLEngine.setFrames === 'function' &&
        typeof webGLEngine.render === 'function'
      ) {
        try {
          webGLEngine.setFrames(fromFrame, toFrame);
          webGLEngine.render(transition.type as string, progress, transition.params || {});
          context.drawImage(this.webGLCanvas, 0, 0);
          return;
        } catch (error) {
          console.warn('WebGL transition render failed, using Canvas2D fallback.', error);
        }
      }

      this.renderFallbackCrossfade(fromFrame, toFrame, progress, outputCanvas);
      return;
    }

    const canvasEngine = this.getCanvasEngine();
    if (
      typeof canvasEngine.init === 'function' &&
      typeof canvasEngine.renderTransition === 'function'
    ) {
      try {
        canvasEngine.init(this.canvas2DCanvas);
        canvasEngine.renderTransition(
          fromFrame,
          toFrame,
          transition as Transition,
          progress
        );
        context.drawImage(this.canvas2DCanvas, 0, 0);
        return;
      } catch (error) {
        console.warn('Canvas2D transition render failed, using crossfade fallback.', error);
      }
    }

    this.renderFallbackCrossfade(fromFrame, toFrame, progress, outputCanvas);
  }

  /**
   * Detect which engine to use for a transition
   */
  private detectEngine(transitionType: string): 'canvas2d' | 'webgl' {
    return CANVAS_2D_TRANSITION_IDS.includes(transitionType as (typeof CANVAS_2D_TRANSITION_IDS)[number])
      ? 'canvas2d'
      : 'webgl';
  }

  /**
   * Get all available transitions (Canvas2D + WebGL)
   */
  getAllTransitions(): HybridTransitionDescriptor[] {
    const all: HybridTransitionDescriptor[] = [];

    const canvas2DCategories = this.getCanvasTransitionCategories();
    canvas2DCategories.forEach((category) => {
      category.transitions.forEach((transition) => {
        all.push({
          type: transition.type,
          name: transition.name,
          engine: 'canvas2d',
          category: category.name,
          duration: transition.duration,
          author: 'Built-in',
        });
      });
    });

    const webGLTransitions = this.getWebGLTransitionsSafe();
    webGLTransitions.forEach((transition) => {
      all.push({
        type: transition.name,
        name: transition.name,
        engine: 'webgl',
        category: transition.category,
        duration: 1.0,
        author: transition.author,
      });
    });

    return all;
  }

  /**
   * Get transitions organized by category
   */
  getTransitionsByCategory(): Map<string, Array<{
    type: string;
    name: string;
    engine: 'canvas2d' | 'webgl';
    duration: number;
  }>> {
    const byCategory = new Map<string, Array<{
      type: string;
      name: string;
      engine: 'canvas2d' | 'webgl';
      duration: number;
    }>>();

    this.getAllTransitions().forEach((transition) => {
      if (!byCategory.has(transition.category)) {
        byCategory.set(transition.category, []);
      }
      byCategory.get(transition.category)?.push({
        type: transition.type,
        name: transition.name,
        engine: transition.engine,
        duration: transition.duration,
      });
    });

    return byCategory;
  }

  /**
   * Search transitions
   */
  searchTransitions(query: string): Array<{
    type: string;
    name: string;
    engine: 'canvas2d' | 'webgl';
    category: string;
    author?: string;
  }> {
    const all = this.getAllTransitions();
    const lowerQuery = query.toLowerCase();

    return all.filter((transition) =>
      transition.name.toLowerCase().includes(lowerQuery) ||
      transition.category.toLowerCase().includes(lowerQuery) ||
      transition.author?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get featured/recommended transitions
   */
  getFeaturedTransitions(): Array<{
    type: string;
    name: string;
    engine: 'canvas2d' | 'webgl';
    reason: string;
  }> {
    return [
      { type: 'crossfade', name: 'Crossfade', engine: 'canvas2d', reason: 'Classic, elegant' },
      { type: 'page_curl', name: 'Page Curl', engine: 'canvas2d', reason: 'Wedding favorite' },
      { type: 'clock_wipe', name: 'Clock Wipe', engine: 'canvas2d', reason: 'Time passage' },
      { type: 'radial_blur', name: 'Radial Blur', engine: 'canvas2d', reason: 'Action energy' },
      { type: 'Dreamy', name: 'Dreamy', engine: 'webgl', reason: 'Cinematic smooth' },
      { type: 'WaterDrop', name: 'Water Drop', engine: 'webgl', reason: 'Unique liquid effect' },
      { type: 'Swirl', name: 'Swirl', engine: 'webgl', reason: 'Creative vortex' },
      { type: 'GlitchMemories', name: 'Glitch Memories', engine: 'webgl', reason: 'Modern aesthetic' },
      { type: 'Mosaic', name: 'Mosaic', engine: 'webgl', reason: 'Dynamic reveal' },
      { type: 'DirectionalWarp', name: 'Directional Warp', engine: 'webgl', reason: 'Smooth motion' },
    ];
  }

  /**
   * Check WebGL support
   */
  isWebGLAvailable(): boolean {
    return this.useWebGL;
  }

  /**
   * Get transition count
   */
  getTransitionCount(): { canvas2d: number; webgl: number; total: number } {
    const all = this.getAllTransitions();
    const canvas2d = all.filter((transition) => transition.engine === 'canvas2d').length;
    const webgl = all.filter((transition) => transition.engine === 'webgl').length;

    return {
      canvas2d,
      webgl,
      total: canvas2d + webgl,
    };
  }

  /**
   * Cleanup
   */
  dispose() {
    const webGLEngine = this.getWebGLEngine();
    if (typeof webGLEngine.dispose === 'function') {
      webGLEngine.dispose();
    }
  }
}

export const hybridTransitionEngine = new HybridTransitionEngine();
