/**
 * WebGLBrushEngine — GPU-accelerated brush rendering backend
 *
 * Provides a WebGL 2 canvas that renders brush stamps as textured quads
 * with alpha blending, enabling smooth high-stroke-count performance.
 *
 * Falls back to AdvancedBrushEngine (Canvas 2D) when WebGL is unavailable.
 *
 * Architecture:
 *   1. Each brush stamp is a textured quad (circular soft/hard brush)
 *   2. Stamps are placed at intervals along the stroke path
 *   3. Pressure controls stamp size and opacity
 *   4. Offscreen FBO is used for compositing layers
 */

import { PencilPoint } from '../../hooks/useApplePencil';
import { BrushConfig, DEFAULT_BRUSH_CONFIG, hexToRgb } from './AdvancedBrushEngine';

// ─── Shader sources ──────────────────────────────────────────────────────────

const STAMP_VERT = `#version 300 es
precision highp float;

in vec2 a_position;    // -1..1 quad
in vec2 a_texCoord;    // 0..1

uniform vec2 u_center;
uniform float u_size;
uniform vec2 u_resolution;

out vec2 v_uv;

void main() {
  vec2 pixel = u_center + a_position * u_size;
  vec2 clip  = (pixel / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;   // flip Y for canvas coordinates
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_texCoord;
}
`;

const STAMP_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform vec4 u_color;       // r g b a
uniform float u_hardness;   // 0=soft  1=hard
uniform float u_grain;      // 0=smooth  1=full noise

out vec4 fragColor;

// Simple hash noise
float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

void main() {
  float d = length(v_uv - 0.5) * 2.0;  // 0 at center, 1 at edge

  // Soft falloff controlled by hardness
  float alpha = 1.0 - smoothstep(u_hardness, 1.0, d);

  // Optional grain overlay
  if (u_grain > 0.0) {
    float noise = hash(v_uv * 200.0);
    alpha *= mix(1.0, noise, u_grain * 0.5);
  }

  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`;

// Composite the offscreen FBO onto the destination
const COMPOSITE_VERT = `#version 300 es
precision highp float;
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_texCoord;
}
`;

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 fragColor;
void main() {
  fragColor = texture(u_texture, v_uv);
}
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Cannot create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vert);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
  const prog = gl.createProgram();
  if (!prog) throw new Error('Cannot create program');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link error: ${log}`);
  }
  // Shaders can be freed after linking
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class WebGLBrushEngine {
  private gl: WebGL2RenderingContext;
  private stampProgram: WebGLProgram;
  private compositeProgram: WebGLProgram;
  private quadVAO: WebGLVertexArrayObject;
  private fbo: WebGLFramebuffer;
  private fboTexture: WebGLTexture;
  private width: number;
  private height: number;
  private config: BrushConfig;

  /** B-9 fix: Track context loss so rendering is a no-op until restored */
  private _contextLost = false;

  // Uniform locations (stamp)
  private loc_center: WebGLUniformLocation;
  private loc_size: WebGLUniformLocation;
  private loc_resolution: WebGLUniformLocation;
  private loc_color: WebGLUniformLocation;
  private loc_hardness: WebGLUniformLocation;
  private loc_grain: WebGLUniformLocation;
  // Uniform locations (composite)
  private loc_compTex: WebGLUniformLocation;

  constructor(canvas: HTMLCanvasElement, config: Partial<BrushConfig> = {}) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL 2 not supported');

    this.gl = gl;
    this.width = canvas.width;
    this.height = canvas.height;
    this.config = { ...DEFAULT_BRUSH_CONFIG, ...config };

    // Compile programs
    this.stampProgram = createProgram(gl, STAMP_VERT, STAMP_FRAG);
    this.compositeProgram = createProgram(gl, COMPOSITE_VERT, COMPOSITE_FRAG);

    // Build a unit quad (−1…1) with UVs (0…1)
    const positions = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
       1,  1,  1, 1,
      -1, -1,  0, 0,
       1,  1,  1, 1,
      -1,  1,  0, 1,
    ]);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Cannot create VAO');
    this.quadVAO = vao;
    gl.bindVertexArray(vao);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // a_position
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    // a_texCoord
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

    gl.bindVertexArray(null);

    // Resolve uniform locations
    this.loc_center = gl.getUniformLocation(this.stampProgram, 'u_center')!;
    this.loc_size = gl.getUniformLocation(this.stampProgram, 'u_size')!;
    this.loc_resolution = gl.getUniformLocation(this.stampProgram, 'u_resolution')!;
    this.loc_color = gl.getUniformLocation(this.stampProgram, 'u_color')!;
    this.loc_hardness = gl.getUniformLocation(this.stampProgram, 'u_hardness')!;
    this.loc_grain = gl.getUniformLocation(this.stampProgram, 'u_grain')!;
    this.loc_compTex = gl.getUniformLocation(this.compositeProgram, 'u_texture')!;

    // Offscreen FBO for layer compositing
    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('Cannot create FBO');
    this.fbo = fbo;

    const tex = gl.createTexture();
    if (!tex) throw new Error('Cannot create texture');
    this.fboTexture = tex;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // B-9 fix: Handle WebGL context loss / restoration
    const glCanvas = gl.canvas as HTMLCanvasElement;
    glCanvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this._contextLost = true;
    });
    glCanvas.addEventListener('webglcontextrestored', () => {
      this._contextLost = false;
      // Re-initialise state that's lost with context
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  setConfig(config: Partial<BrushConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): BrushConfig {
    return { ...this.config };
  }

  /** Resize internal FBO when canvas dimensions change — guards unchanged dimensions (P-8 fix) */
  resize(w: number, h: number) {
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    const { gl } = this;
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  /** Clear the main canvas */
  clear() {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Render a full stroke (array of PencilPoints) with the current config */
  renderStroke(points: PencilPoint[], settings?: Partial<BrushConfig>) {
    if (points.length < 2 || this._contextLost) return;

    const cfg = settings ? { ...this.config, ...settings } : this.config;
    const { gl } = this;

    gl.useProgram(this.stampProgram);
    gl.bindVertexArray(this.quadVAO);
    gl.uniform2f(this.loc_resolution, this.width, this.height);
    gl.uniform1f(this.loc_hardness, cfg.hardness);
    gl.uniform1f(this.loc_grain, cfg.grain);

    const rgb = hexToRgb(cfg.color);

    // Walk the stroke path, placing stamps at spacing intervals
    const spacing = Math.max(1, cfg.size * 0.15);
    let accumDist = 0;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const segLen = Math.hypot(dx, dy);
      if (segLen === 0) continue;

      const nx = dx / segLen;
      const ny = dy / segLen;

      while (accumDist < segLen) {
        const t = accumDist / segLen;
        const x = prev.x + nx * accumDist;
        const y = prev.y + ny * accumDist;
        const pressure = prev.pressure + (curr.pressure - prev.pressure) * t;

        const stampSize = cfg.size * (0.5 + pressure * 0.5 * cfg.pressureSensitivity);
        const alpha = cfg.opacity * (0.3 + pressure * 0.7);

        gl.uniform2f(this.loc_center, x, y);
        gl.uniform1f(this.loc_size, stampSize);
        gl.uniform4f(this.loc_color, rgb.r / 255, rgb.g / 255, rgb.b / 255, alpha);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        accumDist += spacing;
      }

      accumDist -= segLen;
    }

    gl.bindVertexArray(null);
  }

  /** Blit the offscreen FBO to the default framebuffer */
  compositeToScreen() {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.compositeProgram);
    gl.bindVertexArray(this.quadVAO);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
    gl.uniform1i(this.loc_compTex, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  /** Render a stroke into the offscreen FBO (for layer compositing) */
  renderStrokeToFBO(points: PencilPoint[], settings?: Partial<BrushConfig>) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
    this.renderStroke(points, settings);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Clear the offscreen FBO */
  clearFBO() {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Copy the WebGL canvas content to a 2D canvas context.
   * Useful for export functions that expect Canvas 2D.
   */
  copyTo2D(destCtx: CanvasRenderingContext2D) {
    destCtx.drawImage(this.gl.canvas as HTMLCanvasElement, 0, 0);
  }

  /** Cleanup GPU resources */
  dispose() {
    const { gl } = this;
    gl.deleteProgram(this.stampProgram);
    gl.deleteProgram(this.compositeProgram);
    gl.deleteVertexArray(this.quadVAO);
    gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(this.fboTexture);
  }

  // ─── Static factory ────────────────────────────────────────────────────

  /** Cached result for isSupported — avoids creating throwaway canvas each call (P-7 fix) */
  private static _supportedCache: boolean | null = null;

  /** Check if WebGL 2 is available (SSR-safe, cached) */
  static isSupported(): boolean {
    if (WebGLBrushEngine._supportedCache !== null) return WebGLBrushEngine._supportedCache;
    if (typeof document === 'undefined') {
      WebGLBrushEngine._supportedCache = false;
      return false;
    }
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    WebGLBrushEngine._supportedCache = gl !== null;
    return WebGLBrushEngine._supportedCache;
  }

  /**
   * Create a WebGL brush engine attached to a hidden canvas.
   * Returns null if WebGL 2 is unavailable.
   */
  static create(width: number, height: number, config?: Partial<BrushConfig>): WebGLBrushEngine | null {
    if (!WebGLBrushEngine.isSupported()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    try {
      return new WebGLBrushEngine(canvas, config);
    } catch {
      return null;
    }
  }
}

export default WebGLBrushEngine;
