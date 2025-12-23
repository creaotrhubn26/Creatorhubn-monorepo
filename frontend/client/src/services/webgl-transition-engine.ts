/**
 * WEBGL TRANSITION ENGINE
 * GPU-accelerated transitions using gl-transitions library
 * 450+ professional transitions with fragment shaders
 */

import * as THREE from 'three';
// @ts-ignore
import transitions from 'gl-transitions';

export interface GLTransition {
  name: string;
  author: string;
  glsl: string;
  defaultParams?: Record<string, any>;
  uniforms?: Record<string, any>;
}

/**
 * WebGL Transition Engine using Three.js
 */
export class WebGLTransitionEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private mesh: THREE.Mesh;
  private fromTexture: THREE.VideoTexture | THREE.CanvasTexture | null = null;
  private toTexture: THREE.VideoTexture | THREE.CanvasTexture | null = null;
  private currentMaterial: THREE.ShaderMaterial | null = null;
  private transitionShaders: Map<string, string> = new Map();
  
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Create plane geometry for full-screen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry);
    this.scene.add(this.mesh);
    
    // Load all gl-transitions
    this.loadTransitions();
  }
  
  /**
   * Initialize renderer with canvas
   */
  init(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    console.log('✅ WebGL Transition Engine initialized');
    console.log(`📊 Loaded ${this.transitionShaders.size} gl-transitions`);
  }
  
  /**
   * Load all transitions from gl-transitions library
   */
  private loadTransitions() {
    if (!transitions || !Array.isArray(transitions)) {
      console.warn('⚠️ gl-transitions not loaded properly');
      return;
    }
    
    transitions.forEach((transition: GLTransition) => {
      this.transitionShaders.set(transition.name, transition.glsl);
    });
    
    console.log(`📚 Loaded ${this.transitionShaders.size} WebGL transitions`);
  }
  
  /**
   * Create shader material for transition
   */
  private createTransitionMaterial(glsl: string, params: Record<string, any> = {}): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        from: { value: this.fromTexture },
        to: { value: this.toTexture },
        progress: { value: 0.0 },
        ratio: { value: 1.0 },
        ...params
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D from;
        uniform sampler2D to;
        uniform float progress;
        uniform float ratio;
        varying vec2 vUv;
        
        ${glsl}
        
        void main() {
          gl_FragColor = transition(vUv);
        }
      `
    });
  }
  
  /**
   * Set source frames
   */
  setFrames(from: HTMLVideoElement | HTMLCanvasElement, to: HTMLVideoElement | HTMLCanvasElement) {
    // Create or update from texture
    if (from instanceof HTMLVideoElement) {
      this.fromTexture = new THREE.VideoTexture(from);
      this.fromTexture.minFilter = THREE.LinearFilter;
      this.fromTexture.magFilter = THREE.LinearFilter;
    } else {
      this.fromTexture = new THREE.CanvasTexture(from);
      this.fromTexture.minFilter = THREE.LinearFilter;
      this.fromTexture.magFilter = THREE.LinearFilter;
    }
    
    // Create or update to texture
    if (to instanceof HTMLVideoElement) {
      this.toTexture = new THREE.VideoTexture(to);
      this.toTexture.minFilter = THREE.LinearFilter;
      this.toTexture.magFilter = THREE.LinearFilter;
    } else {
      this.toTexture = new THREE.CanvasTexture(to);
      this.toTexture.minFilter = THREE.LinearFilter;
      this.toTexture.magFilter = THREE.LinearFilter;
    }
  }
  
  /**
   * Render transition
   */
  render(transitionName: string, progress: number, params: Record<string, any> = {}) {
    if (!this.renderer) {
      console.error('❌ Renderer not initialized');
      return;
    }
    
    const glsl = this.transitionShaders.get(transitionName);
    if (!glsl) {
      console.error(`❌ Transition not found: ${transitionName}`);
      return;
    }
    
    // Create material if needed or update existing
    if (!this.currentMaterial || (this.mesh.material as any) !== this.currentMaterial) {
      this.currentMaterial = this.createTransitionMaterial(glsl, params);
      this.mesh.material = this.currentMaterial;
    }
    
    // Update uniforms
    this.currentMaterial.uniforms.from.value = this.fromTexture;
    this.currentMaterial.uniforms.to.value = this.toTexture;
    this.currentMaterial.uniforms.progress.value = progress;
    
    // Update custom params
    Object.keys(params).forEach(key => {
      if (this.currentMaterial!.uniforms[key]) {
        this.currentMaterial!.uniforms[key].value = params[key];
      }
    });
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Get all available transitions
   */
  getAvailableTransitions(): Array<{
    name: string;
    author: string;
    category: string;
  }> {
    if (!transitions || !Array.isArray(transitions)) {
      return [];
    }
    
    return transitions.map((t: GLTransition) => ({
      name: t.name,
      author: t.author,
      category: this.categorizeTransition(t.name)
    }));
  }
  
  /**
   * Categorize transition by name (heuristic)
   */
  private categorizeTransition(name: string): string {
    const lower = name.toLowerCase();
    
    if (lower.includes('dissolve') || lower.includes('fade') || lower.includes('cross')) {
      return 'Dissolve';
    } else if (lower.includes('wipe') || lower.includes('swipe') || lower.includes('directional')) {
      return 'Wipe';
    } else if (lower.includes('blur') || lower.includes('zoom') || lower.includes('morph')) {
      return 'Blur & Zoom';
    } else if (lower.includes('cube') || lower.includes('flip') || lower.includes('rotate') || lower.includes('3d')) {
      return '3D';
    } else if (lower.includes('glitch') || lower.includes('rgb') || lower.includes('pixel')) {
      return 'Glitch';
    } else if (lower.includes('ripple') || lower.includes('wave') || lower.includes('water') || lower.includes('liquid')) {
      return 'Displacement';
    } else if (lower.includes('light') || lower.includes('flash') || lower.includes('burn')) {
      return 'Light & Film';
    } else if (lower.includes('mosaic') || lower.includes('kaleid') || lower.includes('hex')) {
      return 'Geometric';
    } else {
      return'Creative';
    }
  }
  
  /**
   * Cleanup
   */
  dispose() {
    this.fromTexture?.dispose();
    this.toTexture?.dispose();
    this.currentMaterial?.dispose();
    this.renderer?.dispose();
  }
}

export const webGLTransitionEngine = new WebGLTransitionEngine();


