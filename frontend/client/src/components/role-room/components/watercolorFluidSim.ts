// @ts-nocheck
/**
 * watercolorFluidSim.ts
 *
 * WebGL2 Stable Fluids-implementasjon for watercolor-brushen i
 * PencilCanvasPro. Algoritmen følger Jos Stam's "Real-Time Fluid
 * Dynamics for Games" / "Stable Fluids" (1999/2003):
 *   advection -> splat (force + dye) -> divergence -> pressure (Jacobi)
 *   -> gradient subtract -> display.
 *
 * Implementasjonen er skrevet fra bunnen tilpasset våre behov:
 *  - Splat-input kommer fra ekstern pointer-pipeline (ikke DOM-events).
 *  - Dye-feltet respekterer brukerens valgte brush-farge og blander
 *    seg fysisk (additivt med metning-clamp) når to farger møtes.
 *  - Wet/dry-mask som ekstra texture: våte områder lar fluid spre seg,
 *    tørre områder demper advection. Wetness avtar gradvis (~30 sek).
 *  - Persistens: snapshot() leser dye-feltet tilbake til en HTMLCanvas
 *    slik at watercolor-økten kan bake-rendres inn i hoved-2d-canvasen
 *    som et bilde-stroke før simuleringen stoppes.
 *
 * Filen har @ts-nocheck fordi den inneholder mye inline-GLSL og
 * WebGL2-typer (WebGL2RenderingContext.uniform*-overloader, framebuffer-
 * status-konstanter, ekstensjons-objekter) der strict TS gir mer støy enn
 * verdi. Logikken er rent imperativ og er enklere å lese uten typing-
 * overhead. Selve overflate-API-et (constructor + offentlige metoder) er
 * smalt og brukes kun fra PencilCanvasPro.
 */

// =============================================================================
// Shader-kildekode
// =============================================================================

// Felles fullscreen-quad vertex shader. Brukes for alle passes.
const VERT_QUAD = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_position;
out vec2 v_uv;
out vec2 v_uv_l;
out vec2 v_uv_r;
out vec2 v_uv_t;
out vec2 v_uv_b;
uniform vec2 u_texel;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  v_uv_l = v_uv - vec2(u_texel.x, 0.0);
  v_uv_r = v_uv + vec2(u_texel.x, 0.0);
  v_uv_t = v_uv + vec2(0.0, u_texel.y);
  v_uv_b = v_uv - vec2(0.0, u_texel.y);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Advection: følg velocity-feltet bakover i tid og sample kilden.
// `u_dissipation` lar dye/velocity dø av over tid (tørketid for dye-felt
// håndteres separat via wet-mask-koblingen, men en svak global decay
// gir penere oppførsel).
const FRAG_ADVECTION = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform sampler2D u_wet;
uniform vec2 u_texel;
uniform float u_dt;
uniform float u_dissipation;
uniform float u_dryAdvectionScale;
void main() {
  vec2 vel = texture(u_velocity, v_uv).xy;
  float wet = texture(u_wet, v_uv).r;
  // Tørre områder advekterer mindre — dye/velocity "stivner" mot papiret.
  float advFactor = mix(u_dryAdvectionScale, 1.0, wet);
  vec2 coord = v_uv - u_dt * vel * u_texel * advFactor;
  vec4 result = texture(u_source, coord);
  fragColor = result * u_dissipation;
}`;

// Divergence: nettostrøm ut av hver celle (skal være 0 for inkompressibel
// væske). Resultatet leses av pressure-passet.
const FRAG_DIVERGENCE = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
in vec2 v_uv_l;
in vec2 v_uv_r;
in vec2 v_uv_t;
in vec2 v_uv_b;
out vec4 fragColor;
uniform sampler2D u_velocity;
void main() {
  float l = texture(u_velocity, v_uv_l).x;
  float r = texture(u_velocity, v_uv_r).x;
  float t = texture(u_velocity, v_uv_t).y;
  float b = texture(u_velocity, v_uv_b).y;
  float div = 0.5 * (r - l + t - b);
  fragColor = vec4(div, 0.0, 0.0, 1.0);
}`;

// Pressure Jacobi-iterasjon. Konvergerer mot et trykkfelt p slik at
// laplace(p) = div(v). 20-40 iterasjoner er typisk nok.
const FRAG_PRESSURE = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
in vec2 v_uv_l;
in vec2 v_uv_r;
in vec2 v_uv_t;
in vec2 v_uv_b;
out vec4 fragColor;
uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
void main() {
  float l = texture(u_pressure, v_uv_l).x;
  float r = texture(u_pressure, v_uv_r).x;
  float t = texture(u_pressure, v_uv_t).x;
  float b = texture(u_pressure, v_uv_b).x;
  float d = texture(u_divergence, v_uv).x;
  float p = (l + r + t + b - d) * 0.25;
  fragColor = vec4(p, 0.0, 0.0, 1.0);
}`;

// Gradient subtract: gjør velocity divergence-free ved å trekke fra
// gradienten av pressure.
const FRAG_GRADIENT_SUBTRACT = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
in vec2 v_uv_l;
in vec2 v_uv_r;
in vec2 v_uv_t;
in vec2 v_uv_b;
out vec4 fragColor;
uniform sampler2D u_pressure;
uniform sampler2D u_velocity;
void main() {
  float l = texture(u_pressure, v_uv_l).x;
  float r = texture(u_pressure, v_uv_r).x;
  float t = texture(u_pressure, v_uv_t).x;
  float b = texture(u_pressure, v_uv_b).x;
  vec2 vel = texture(u_velocity, v_uv).xy;
  vel -= 0.5 * vec2(r - l, t - b);
  fragColor = vec4(vel, 0.0, 1.0);
}`;

// Splat: legger til en gaussisk "klatt" av kraft eller dye rundt et punkt.
// `u_target_kind` velger om vi skriver til velocity (xy) eller dye (rgb).
const FRAG_SPLAT = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_source;
uniform vec2 u_point;
uniform vec3 u_color;
uniform float u_radius;
uniform float u_aspect;
uniform int u_kind; // 0 = velocity, 1 = dye, 2 = wet-mask
void main() {
  vec2 p = v_uv - u_point;
  p.x *= u_aspect;
  float falloff = exp(-dot(p, p) / u_radius);
  vec4 base = texture(u_source, v_uv);
  if (u_kind == 0) {
    // velocity: additiv kraft, ingen clamp.
    base.xy += u_color.xy * falloff;
  } else if (u_kind == 1) {
    // dye: additiv farge, men mykt clampet slik at fargene blander seg
    // i stedet for å "brenne ut" til hvit.
    base.rgb += u_color * falloff;
    base.rgb = min(base.rgb, vec3(1.0));
    base.a = 1.0;
  } else {
    // wet-mask: legg til wetness opp til 1.0.
    base.r = min(base.r + falloff, 1.0);
  }
  fragColor = base;
}`;

// Wet-mask decay: kjøres hvert frame for å la papiret tørke gradvis.
const FRAG_WET_DECAY = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_wet;
uniform float u_decay;
void main() {
  float w = texture(u_wet, v_uv).r;
  w = max(w - u_decay, 0.0);
  fragColor = vec4(w, 0.0, 0.0, 1.0);
}`;

// Display: rendrer dye-feltet (i sim-oppløsning) til skjerm i full
// canvas-oppløsning. Vi multiplicerer med wet-mask som gir litt mørkere
// kanter der papiret tørker — papireffekt på en budget.
const FRAG_DISPLAY = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_dye;
uniform sampler2D u_wet;
void main() {
  vec4 dye = texture(u_dye, v_uv);
  float wet = texture(u_wet, v_uv).r;
  // Bevar fargen men gjør alfa-en til en funksjon av dye-intensitet,
  // slik at canvasen under skinner gjennom der det ikke er maling.
  float intensity = max(max(dye.r, dye.g), max(dye.b, 0.0));
  float alpha = clamp(intensity * (0.55 + 0.45 * wet), 0.0, 1.0);
  fragColor = vec4(dye.rgb, alpha);
}`;

// Clear utility shader.
const FRAG_CLEAR = /* glsl */ `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec4 u_color;
void main() {
  fragColor = u_color;
}`;

// =============================================================================
// WebGL hjelpere
// =============================================================================

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Watercolor shader compile failed: ' + log);
  }
  return shader;
}

function createProgram(gl, vertSrc, fragSrc) {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Watercolor program link failed: ' + log);
  }
  // Bygg uniform-lookup-cache.
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i += 1) {
    const info = gl.getActiveUniform(program, i);
    if (info) {
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
  }
  return { program, uniforms };
}

function createFBO(gl, width, height, internalFormat, format, type, filter) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Watercolor FBO incomplete: ' + status.toString(16));
  }
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return {
    texture,
    fbo,
    width,
    height,
    texel: { x: 1 / width, y: 1 / height },
    attach(unit) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return unit;
    },
  };
}

function createDoubleFBO(gl, width, height, internalFormat, format, type, filter) {
  let a = createFBO(gl, width, height, internalFormat, format, type, filter);
  let b = createFBO(gl, width, height, internalFormat, format, type, filter);
  return {
    width,
    height,
    texel: a.texel,
    get read() { return a; },
    get write() { return b; },
    swap() { const tmp = a; a = b; b = tmp; },
  };
}

// =============================================================================
// Splat-kø og fargehjelp
// =============================================================================

function hexToRgb(color) {
  if (!color) return [0.5, 0.5, 0.5];
  let c = color.trim();
  if (c.startsWith('#')) c = c.slice(1);
  if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
  if (c.length !== 6) return [0.5, 0.5, 0.5];
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  if ([r, g, b].some((n) => Number.isNaN(n))) return [0.5, 0.5, 0.5];
  return [r, g, b];
}

// =============================================================================
// FluidSim klasse
// =============================================================================

export interface WatercolorFluidConfig {
  simResolution?: number;         // grid-side, default 256
  pressureIterations?: number;    // 20-40 anbefalt, default 24
  dyeDissipation?: number;        // 0..1, default 0.995 (subtil decay)
  velocityDissipation?: number;   // 0..1, default 0.98
  dryAdvectionScale?: number;     // 0..1, default 0.25 (tørt: nesten ingen flyt)
  wetDecayPerSecond?: number;     // wet-mask decay, default 1/30 (~30s tørketid)
  maxSplatsPerSecond?: number;    // splat-throttle, default 60
}

export interface SplatInput {
  // 0..1 normaliserte canvas-koordinater (x rett, y rett — vi flipper i shader-kall).
  x: number;
  y: number;
  dx: number;             // velocity-vektor i samme koord-system
  dy: number;
  pressure: number;       // 0..1
  color: string;          // hex #RRGGBB
  wetness: number;        // 0..1 (brush-parameter)
  radius?: number;        // 0..1, fraction av canvas — default basert på brush-size
}

const DEFAULTS: Required<WatercolorFluidConfig> = {
  simResolution: 256,
  pressureIterations: 24,
  dyeDissipation: 0.996,
  velocityDissipation: 0.985,
  dryAdvectionScale: 0.25,
  wetDecayPerSecond: 1 / 30,
  maxSplatsPerSecond: 60,
};

export class WatercolorFluidSim {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private config: Required<WatercolorFluidConfig>;
  private programs: any = {};
  private quadVAO: WebGLVertexArrayObject | null = null;
  private velocity: any = null;
  private dye: any = null;
  private wet: any = null;
  private pressure: any = null;
  private divergence: any = null;
  private displayTexel = { x: 1, y: 1 };
  private floatExtSupported = false;
  private disposed = false;
  private running = false;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private splatQueue: SplatInput[] = [];
  private splatBudgetTokens = 0;
  private lastSplatThrottleTime = 0;
  private adaptivePressureIters: number;
  private fpsWindow: number[] = [];
  private contextLossHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: ((e: Event) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, config: WatercolorFluidConfig = {}) {
    this.canvas = canvas;
    this.config = { ...DEFAULTS, ...config };
    this.adaptivePressureIters = this.config.pressureIterations;
    this.initWebGL();
  }

  static isSupported(): boolean {
    try {
      const test = document.createElement('canvas');
      const gl = test.getContext('webgl2');
      if (!gl) return false;
      const colorBufferFloat = gl.getExtension('EXT_color_buffer_float');
      // Float-ext er sterkt anbefalt men ikke strengt nødvendig — vi
      // har RGBA8-fallback. Returner true så lenge WebGL2 finnes.
      void colorBufferFloat;
      return true;
    } catch (_e) {
      return false;
    }
  }

  private initWebGL() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: true,
    }) as WebGL2RenderingContext | null;
    if (!gl) {
      throw new Error('WebGL2 not available for watercolor fluid sim');
    }
    this.gl = gl;
    this.floatExtSupported = Boolean(gl.getExtension('EXT_color_buffer_float'));
    if (!this.floatExtSupported) {
      // Fall tilbake til lavere oppløsning + RGBA8.
      this.config.simResolution = Math.min(this.config.simResolution, 192);
      console.warn(
        '[watercolorFluidSim] EXT_color_buffer_float missing; running RGBA8 fallback at',
        this.config.simResolution
      );
    }
    gl.getExtension('OES_texture_float_linear'); // pent å ha — ignorerer hvis mangler

    // Compile alle programs.
    this.programs.advection = createProgram(gl, VERT_QUAD, FRAG_ADVECTION);
    this.programs.divergence = createProgram(gl, VERT_QUAD, FRAG_DIVERGENCE);
    this.programs.pressure = createProgram(gl, VERT_QUAD, FRAG_PRESSURE);
    this.programs.gradientSubtract = createProgram(gl, VERT_QUAD, FRAG_GRADIENT_SUBTRACT);
    this.programs.splat = createProgram(gl, VERT_QUAD, FRAG_SPLAT);
    this.programs.wetDecay = createProgram(gl, VERT_QUAD, FRAG_WET_DECAY);
    this.programs.display = createProgram(gl, VERT_QUAD, FRAG_DISPLAY);
    this.programs.clear = createProgram(gl, VERT_QUAD, FRAG_CLEAR);

    // Bygg fullscreen-quad VAO.
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.quadVAO = vao;

    this.allocateBuffers();

    // Context-loss handlere.
    this.contextLossHandler = (e: Event) => {
      e.preventDefault();
      this.running = false;
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      console.warn('[watercolorFluidSim] context lost');
    };
    this.contextRestoredHandler = () => {
      console.warn('[watercolorFluidSim] context restored — re-initializing');
      try {
        this.initWebGL();
        if (this.running) this.startLoop();
      } catch (err) {
        console.error('[watercolorFluidSim] re-init failed', err);
      }
    };
    this.canvas.addEventListener('webglcontextlost', this.contextLossHandler);
    this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);
  }

  private allocateBuffers() {
    const gl = this.gl;
    if (!gl) return;
    const size = this.config.simResolution;
    const internalFormatRG = this.floatExtSupported ? gl.RG16F : gl.RGBA8;
    const formatRG = this.floatExtSupported ? gl.RG : gl.RGBA;
    const internalFormatR = this.floatExtSupported ? gl.R16F : gl.RGBA8;
    const formatR = this.floatExtSupported ? gl.RED : gl.RGBA;
    const internalFormatRGBA = this.floatExtSupported ? gl.RGBA16F : gl.RGBA8;
    const dataType = this.floatExtSupported ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    const filter = gl.LINEAR;
    this.velocity = createDoubleFBO(gl, size, size, internalFormatRG, formatRG, dataType, filter);
    this.dye = createDoubleFBO(gl, size, size, internalFormatRGBA, gl.RGBA, dataType, filter);
    this.wet = createDoubleFBO(gl, size, size, internalFormatR, formatR, dataType, filter);
    this.pressure = createDoubleFBO(gl, size, size, internalFormatR, formatR, dataType, gl.NEAREST);
    this.divergence = createFBO(gl, size, size, internalFormatR, formatR, dataType, gl.NEAREST);
  }

  private bindFBO(target: any) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    if (target) {
      gl.viewport(0, 0, target.width, target.height);
    } else {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private drawQuad() {
    const gl = this.gl;
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private useProgram(prog: any) {
    const gl = this.gl;
    gl.useProgram(prog.program);
    return prog.uniforms;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  resize(displayWidth: number, displayHeight: number) {
    if (this.disposed || !this.gl) return;
    if (this.canvas.width !== displayWidth) this.canvas.width = displayWidth;
    if (this.canvas.height !== displayHeight) this.canvas.height = displayHeight;
    this.displayTexel = { x: 1 / displayWidth, y: 1 / displayHeight };
  }

  enqueueSplat(splat: SplatInput) {
    if (this.disposed) return;
    // Splat-throttle: maks N splats per sekund uavhengig av pointer-rate.
    const now = performance.now();
    const dt = now - this.lastSplatThrottleTime;
    this.lastSplatThrottleTime = now;
    this.splatBudgetTokens = Math.min(
      this.config.maxSplatsPerSecond,
      this.splatBudgetTokens + (dt / 1000) * this.config.maxSplatsPerSecond
    );
    if (this.splatBudgetTokens < 1) return;
    this.splatBudgetTokens -= 1;
    this.splatQueue.push(splat);
  }

  clear() {
    if (this.disposed || !this.gl) return;
    const gl = this.gl;
    const uniforms = this.useProgram(this.programs.clear);
    gl.uniform4f(uniforms.u_color, 0, 0, 0, 0);
    this.bindFBO(this.velocity.read); this.drawQuad();
    this.bindFBO(this.velocity.write); this.drawQuad();
    this.bindFBO(this.dye.read); this.drawQuad();
    this.bindFBO(this.dye.write); this.drawQuad();
    this.bindFBO(this.wet.read); this.drawQuad();
    this.bindFBO(this.wet.write); this.drawQuad();
    this.bindFBO(this.pressure.read); this.drawQuad();
    this.bindFBO(this.pressure.write); this.drawQuad();
    this.bindFBO(null);
  }

  startLoop() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    const tick = (t: number) => {
      if (!this.running || this.disposed) return;
      const dt = Math.min(0.033, Math.max(0.001, (t - this.lastFrameTime) / 1000));
      this.lastFrameTime = t;
      try {
        this.step(dt);
        this.render();
      } catch (err) {
        console.error('[watercolorFluidSim] step error', err);
        this.running = false;
        return;
      }
      // Adaptiv kvalitet: hvis fps < 45 i de siste 30 frames, kutt
      // pressure-iterasjoner ned mot 12.
      this.fpsWindow.push(1 / dt);
      if (this.fpsWindow.length > 30) this.fpsWindow.shift();
      if (this.fpsWindow.length === 30) {
        const avg = this.fpsWindow.reduce((a, b) => a + b, 0) / this.fpsWindow.length;
        if (avg < 45 && this.adaptivePressureIters > 12) {
          this.adaptivePressureIters = Math.max(12, this.adaptivePressureIters - 2);
        } else if (avg > 58 && this.adaptivePressureIters < this.config.pressureIterations) {
          this.adaptivePressureIters = Math.min(this.config.pressureIterations, this.adaptivePressureIters + 1);
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stopLoop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Leser ut dye-feltet til en HTMLCanvasElement og returnerer dette.
   * Brukes for å bake watercolor-økten inn i hoved-2d-canvasen som et
   * persistent bilde-stroke før simuleringen disposes.
   */
  snapshot(): HTMLCanvasElement | null {
    if (this.disposed || !this.gl) return null;
    // Vi rendrer display-passet inn i sim-oppløsning til et lese-buffer,
    // og tegner deretter dette opp til en off-screen canvas i full
    // display-oppløsning slik at bake-resultatet matcher hoved-canvasen.
    const out = document.createElement('canvas');
    out.width = this.canvas.width;
    out.height = this.canvas.height;
    // Enkleste implementasjon: render display til selve WebGL-canvas-en
    // (vi er midt i loopen — vi rendrer en gang her), så blit til 2d.
    this.render();
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(this.canvas, 0, 0);
    return out;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    if (this.contextLossHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLossHandler);
    }
    if (this.contextRestoredHandler) {
      this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
    }
    const gl = this.gl;
    if (gl) {
      const loseExt = gl.getExtension('WEBGL_lose_context');
      if (loseExt) loseExt.loseContext();
    }
    this.gl = null;
  }

  // ===========================================================================
  // Simulation step
  // ===========================================================================

  private step(dt: number) {
    const gl = this.gl;
    if (!gl) return;
    const texel = this.velocity.read.texel;
    gl.disable(gl.BLEND);

    // -------------------------------------------------------------------------
    // 1) Advect velocity
    // -------------------------------------------------------------------------
    let uniforms = this.useProgram(this.programs.advection);
    gl.uniform2f(uniforms.u_texel, texel.x, texel.y);
    gl.uniform1f(uniforms.u_dt, dt * 60.0); // skaler dt slik at simmen oppfører seg pent
    gl.uniform1f(uniforms.u_dissipation, this.config.velocityDissipation);
    gl.uniform1f(uniforms.u_dryAdvectionScale, this.config.dryAdvectionScale);
    gl.uniform1i(uniforms.u_velocity, this.velocity.read.attach(0));
    gl.uniform1i(uniforms.u_source, this.velocity.read.attach(1));
    gl.uniform1i(uniforms.u_wet, this.wet.read.attach(2));
    this.bindFBO(this.velocity.write);
    this.drawQuad();
    this.velocity.swap();

    // -------------------------------------------------------------------------
    // 2) Advect dye (med tørr-demping fra wet-mask)
    // -------------------------------------------------------------------------
    uniforms = this.useProgram(this.programs.advection);
    gl.uniform2f(uniforms.u_texel, texel.x, texel.y);
    gl.uniform1f(uniforms.u_dt, dt * 60.0);
    gl.uniform1f(uniforms.u_dissipation, this.config.dyeDissipation);
    gl.uniform1f(uniforms.u_dryAdvectionScale, this.config.dryAdvectionScale);
    gl.uniform1i(uniforms.u_velocity, this.velocity.read.attach(0));
    gl.uniform1i(uniforms.u_source, this.dye.read.attach(1));
    gl.uniform1i(uniforms.u_wet, this.wet.read.attach(2));
    this.bindFBO(this.dye.write);
    this.drawQuad();
    this.dye.swap();

    // -------------------------------------------------------------------------
    // 3) Splat alle køede inputs (force + dye + wet)
    // -------------------------------------------------------------------------
    if (this.splatQueue.length > 0) {
      for (const splat of this.splatQueue) {
        this.applySplat(splat);
      }
      this.splatQueue.length = 0;
    }

    // -------------------------------------------------------------------------
    // 4) Wet-mask decay
    // -------------------------------------------------------------------------
    uniforms = this.useProgram(this.programs.wetDecay);
    gl.uniform1f(uniforms.u_decay, this.config.wetDecayPerSecond * dt);
    gl.uniform1i(uniforms.u_wet, this.wet.read.attach(0));
    this.bindFBO(this.wet.write);
    this.drawQuad();
    this.wet.swap();

    // -------------------------------------------------------------------------
    // 5) Divergence
    // -------------------------------------------------------------------------
    uniforms = this.useProgram(this.programs.divergence);
    gl.uniform2f(uniforms.u_texel, texel.x, texel.y);
    gl.uniform1i(uniforms.u_velocity, this.velocity.read.attach(0));
    this.bindFBO(this.divergence);
    this.drawQuad();

    // -------------------------------------------------------------------------
    // 6) Pressure Jacobi (adaptiv iterasjonstall)
    // -------------------------------------------------------------------------
    // Start med pressure-feltet nullet ut.
    {
      const clearU = this.useProgram(this.programs.clear);
      gl.uniform4f(clearU.u_color, 0, 0, 0, 1);
      this.bindFBO(this.pressure.read);
      this.drawQuad();
    }
    uniforms = this.useProgram(this.programs.pressure);
    gl.uniform2f(uniforms.u_texel, texel.x, texel.y);
    for (let i = 0; i < this.adaptivePressureIters; i += 1) {
      gl.uniform1i(uniforms.u_pressure, this.pressure.read.attach(0));
      gl.uniform1i(uniforms.u_divergence, this.divergence.attach(1));
      this.bindFBO(this.pressure.write);
      this.drawQuad();
      this.pressure.swap();
    }

    // -------------------------------------------------------------------------
    // 7) Gradient subtract — gjør velocity divergence-free
    // -------------------------------------------------------------------------
    uniforms = this.useProgram(this.programs.gradientSubtract);
    gl.uniform2f(uniforms.u_texel, texel.x, texel.y);
    gl.uniform1i(uniforms.u_pressure, this.pressure.read.attach(0));
    gl.uniform1i(uniforms.u_velocity, this.velocity.read.attach(1));
    this.bindFBO(this.velocity.write);
    this.drawQuad();
    this.velocity.swap();
  }

  private applySplat(splat: SplatInput) {
    const gl = this.gl;
    if (!gl) return;
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const radius = (splat.radius ?? 0.012) * Math.max(0.2, splat.pressure);
    // Klemmer radius til min for å unngå degenererte 0-falloff.
    const r = Math.max(radius * radius, 1e-6);

    // -- velocity splat --
    let uniforms = this.useProgram(this.programs.splat);
    gl.uniform1i(uniforms.u_source, this.velocity.read.attach(0));
    gl.uniform2f(uniforms.u_point, splat.x, 1.0 - splat.y);
    gl.uniform3f(uniforms.u_color, splat.dx, -splat.dy, 0.0);
    gl.uniform1f(uniforms.u_radius, r);
    gl.uniform1f(uniforms.u_aspect, aspect);
    gl.uniform1i(uniforms.u_kind, 0);
    this.bindFBO(this.velocity.write);
    this.drawQuad();
    this.velocity.swap();

    // -- dye splat (skalert med wetness + pressure for myk innstrømming) --
    const [r0, g0, b0] = hexToRgb(splat.color);
    const intensity = 0.65 * Math.max(0.15, splat.pressure) * (0.4 + 0.6 * splat.wetness);
    uniforms = this.useProgram(this.programs.splat);
    gl.uniform1i(uniforms.u_source, this.dye.read.attach(0));
    gl.uniform2f(uniforms.u_point, splat.x, 1.0 - splat.y);
    gl.uniform3f(uniforms.u_color, r0 * intensity, g0 * intensity, b0 * intensity);
    gl.uniform1f(uniforms.u_radius, r);
    gl.uniform1f(uniforms.u_aspect, aspect);
    gl.uniform1i(uniforms.u_kind, 1);
    this.bindFBO(this.dye.write);
    this.drawQuad();
    this.dye.swap();

    // -- wet-mask splat --
    uniforms = this.useProgram(this.programs.splat);
    gl.uniform1i(uniforms.u_source, this.wet.read.attach(0));
    gl.uniform2f(uniforms.u_point, splat.x, 1.0 - splat.y);
    gl.uniform3f(uniforms.u_color, splat.wetness, 0, 0);
    gl.uniform1f(uniforms.u_radius, r * 1.4);
    gl.uniform1f(uniforms.u_aspect, aspect);
    gl.uniform1i(uniforms.u_kind, 2);
    this.bindFBO(this.wet.write);
    this.drawQuad();
    this.wet.swap();
  }

  private render() {
    const gl = this.gl;
    if (!gl) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const uniforms = this.useProgram(this.programs.display);
    gl.uniform1i(uniforms.u_dye, this.dye.read.attach(0));
    gl.uniform1i(uniforms.u_wet, this.wet.read.attach(1));
    this.drawQuad();
    gl.disable(gl.BLEND);
  }
}
