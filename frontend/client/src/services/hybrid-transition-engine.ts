/**
 * HYBRID TRANSITION ENGINE
 * Combines Canvas2D (fast, simple) + WebGL (advanced, GPU)
 * Best of both worlds!
 */

import { transitionEngine as canvas2DEngine, TransitionType, Transition } from './transition-effects-engine';
import { webGLTransitionEngine } from './webgl-transition-engine';

export type HybridTransitionType = 
  // Canvas2D transitions (our 35)
  | TransitionType
  // WebGL transitions (450+ from gl-transitions)
  | string; // Any gl-transitions name

export interface HybridTransition extends Omit<Transition , 'type, '> {
  type: HybridTransitionType;
  engine: 'canvas2d' | 'webgl';
  params?: Record<string, any>;
}

/**
 * Hybrid Transition Engine
 * Automatically routes to Canvas2D or WebGL based on transition type
 */
export class HybridTransitionEngine {
  private canvas2DCanvas: HTMLCanvasElement;
  private webGLCanvas: HTMLCanvasElement;
  private useWebGL: boolean = true;
  
  constructor() {
    this.canvas2DCanvas = document.createElement('canvas');
    this.webGLCanvas = document.createElement('canvas');
  }
  
  /**
   * Initialize both engines
   */
  init(canvas: HTMLCanvasElement) {
    // Set canvas dimensions
    this.canvas2DCanvas.width = canvas.width;
    this.canvas2DCanvas.height = canvas.height;
    this.webGLCanvas.width = canvas.width;
    this.webGLCanvas.height = canvas.height;
    
    // Initialize Canvas2D engine
    canvas2DEngine.init(this.canvas2DCanvas);
    
    // Initialize WebGL engine
    try {
      webGLTransitionEngine.init(this.webGLCanvas);
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
    
    if (engine === 'webgl' && this.useWebGL) {
      // Use WebGL for advanced transitions
      webGLTransitionEngine.setFrames(fromFrame, toFrame);
      webGLTransitionEngine.render(transition.type as string, progress, transition.params || {});
      
      // Copy WebGL canvas to output
      const ctx = outputCanvas.getContext('2d')!;
      ctx.drawImage(this.webGLCanvas, 0, 0);
      
    } else {
      // Use Canvas2D for basic transitions
      canvas2DEngine.init(this.canvas2DCanvas);
      canvas2DEngine.renderTransition(
        fromFrame,
        toFrame,
        transition as Transition,
        progress
      );
      
      // Copy Canvas2D to output
      const ctx = outputCanvas.getContext('2d')!;
      ctx.drawImage(this.canvas2DCanvas, 0, 0);
    }
  }
  
  /**
   * Detect which engine to use for a transition
   */
  private detectEngine(transitionType: string): 'canvas2d' | 'webgl' {
    const canvas2DTransitions = [
      'cut','crossfade','fade_black','fade_white','wipe_left','wipe_right','wipe_up','wipe_down','wipe_diagonal','clock_wipe','iris_in','iris_out','slide_left','slide_right','slide_up','slide_down','push_left','push_right','zoom_in','zoom_out','rotate_left','rotate_right','flip_horizontal','flip_vertical','blur','radial_blur','directional_blur','pixelate','glitch','rgb_split','venetian_blinds','checkerboard','swap','cube_left', 'cube_right', 'page_curl'
    ];
    
    return canvas2DTransitions.includes(transitionType) ? 'canvas2d' : 'webgl';
  }
  
  /**
   * Get all available transitions (Canvas2D + WebGL)
   */
  getAllTransitions(): Array<{
    type: string;
    name: string;
    engine: 'canvas2d' | 'webgl';
    category: string;
    duration: number;
    author?: string;
  }> {
    const all: any[] = [];
    
    // Add Canvas2D transitions
    const canvas2DCategories = canvas2DEngine.getTransitionCategories();
    canvas2DCategories.forEach(cat => {
      cat.transitions.forEach(t => {
        all.push({
          type: t.type,
          name: t.name,
          engine: 'canvas2d',
          category: cat.name,
          duration: t.duration,
          author: 'Built-in'
        });
      });
    });
    
    // Add WebGL transitions
    if (this.useWebGL) {
      const webGLTransitions = webGLTransitionEngine.getAvailableTransitions();
      webGLTransitions.forEach(t => {
        all.push({
          type: t.name,
          name: t.name,
          engine: 'webgl',
          category: t.category,
          duration: 1.0, // Default duration
          author: t.author
        });
      });
    }
    
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
    const byCategory = new Map<string, any[]>();
    
    this.getAllTransitions().forEach(t => {
      if (!byCategory.has(t.category)) {
        byCategory.set(t.category, []);
      }
      byCategory.get(t.category)!.push(t);
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
  }> {
    const all = this.getAllTransitions();
    const lowerQuery = query.toLowerCase();
    
    return all.filter(t => 
      t.name.toLowerCase().includes(lowerQuery) ||
      t.category.toLowerCase().includes(lowerQuery) ||
      t.author?.toLowerCase().includes(lowerQuery)
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
      // Canvas2D favorites
      { type: 'crossfade', name: 'Crossfade', engine: 'canvas2d', reason: 'Classic, elegant' },
      { type: 'page_curl', name: 'Page Curl', engine: 'canvas2d', reason: 'Wedding favorite' },
      { type: 'clock_wipe', name: 'Clock Wipe', engine: 'canvas2d', reason: 'Time passage' },
      { type: 'radial_blur', name: 'Radial Blur', engine: 'canvas2d', reason: 'Action energy' },
      
      // WebGL favorites
      { type: 'Dreamy', name: 'Dreamy', engine: 'webgl', reason: 'Cinematic smooth' },
      { type: 'WaterDrop', name: 'Water Drop', engine: 'webgl', reason: 'Unique liquid effect' },
      { type: 'Swirl', name: 'Swirl', engine: 'webgl', reason: 'Creative vortex' },
      { type: 'GlitchMemories', name: 'Glitch Memories', engine: 'webgl', reason: 'Modern aesthetic' },
      { type: 'Mosaic', name: 'Mosaic', engine: 'webgl', reason: 'Dynamic reveal' },
      { type: 'DirectionalWarp', name: 'Directional Warp', engine: 'webgl', reason: 'Smooth motion' }
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
    const canvas2d = all.filter(t => t.engine === 'canvas2d').length;
    const webgl = all.filter(t => t.engine ==='webgl').length;
    
    return {
      canvas2d,
      webgl,
      total: canvas2d + webgl
    };
  }
  
  /**
   * Cleanup
   */
  dispose() {
    webGLTransitionEngine.dispose();
  }
}

export const hybridTransitionEngine = new HybridTransitionEngine();


