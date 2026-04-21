import { FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE } from './shaders';
import type { LutAtlas } from './lut-atlas';
import type { PreviewLutState, PreviewUniforms } from './shader-uniforms';
import { LUT_TONAL_MIX_CODE } from './shader-uniforms';

type ImageSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

interface Attribs {
  position: number;
  texCoord: number;
}

interface Uniforms {
  image: WebGLUniformLocation | null;
  texelSize: WebGLUniformLocation | null;
  brightness: WebGLUniformLocation | null;
  contrast: WebGLUniformLocation | null;
  saturation: WebGLUniformLocation | null;
  sharpness: WebGLUniformLocation | null;
  denoising: WebGLUniformLocation | null;
  skinSmoothing: WebGLUniformLocation | null;
  hslHue: WebGLUniformLocation | null;
  hslSat: WebGLUniformLocation | null;
  hslLum: WebGLUniformLocation | null;
  lutAtlas: WebGLUniformLocation | null;
  lutEnabled: WebGLUniformLocation | null;
  lutSize: WebGLUniformLocation | null;
  lutStrength: WebGLUniformLocation | null;
  lutAtlasSize: WebGLUniformLocation | null;
  lutTonalMix: WebGLUniformLocation | null;
}

export class PreviewRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly attribs: Attribs;
  private readonly uniforms: Uniforms;
  private readonly texture: WebGLTexture;
  private readonly lutTexture: WebGLTexture;
  private readonly positionBuffer: WebGLBuffer;
  private readonly texCoordBuffer: WebGLBuffer;
  private imageWidth = 0;
  private imageHeight = 0;
  private lutState: { size: number; width: number; height: number } | null = null;
  private lutRuntime: PreviewLutState = { atlas: null, strength: 0, tonalMix: 'all' };

  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.canvas = canvas;
    this.gl = gl;

    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    this.program = linkProgram(gl, vertex, fragment);

    this.attribs = {
      position: gl.getAttribLocation(this.program, 'a_position'),
      texCoord: gl.getAttribLocation(this.program, 'a_texCoord'),
    };
    this.uniforms = {
      image: gl.getUniformLocation(this.program, 'u_image'),
      texelSize: gl.getUniformLocation(this.program, 'u_texelSize'),
      brightness: gl.getUniformLocation(this.program, 'u_brightness'),
      contrast: gl.getUniformLocation(this.program, 'u_contrast'),
      saturation: gl.getUniformLocation(this.program, 'u_saturation'),
      sharpness: gl.getUniformLocation(this.program, 'u_sharpness'),
      denoising: gl.getUniformLocation(this.program, 'u_denoising'),
      skinSmoothing: gl.getUniformLocation(this.program, 'u_skinSmoothing'),
      hslHue: gl.getUniformLocation(this.program, 'u_hslHue'),
      hslSat: gl.getUniformLocation(this.program, 'u_hslSat'),
      hslLum: gl.getUniformLocation(this.program, 'u_hslLum'),
      lutAtlas: gl.getUniformLocation(this.program, 'u_lutAtlas'),
      lutEnabled: gl.getUniformLocation(this.program, 'u_lutEnabled'),
      lutSize: gl.getUniformLocation(this.program, 'u_lutSize'),
      lutStrength: gl.getUniformLocation(this.program, 'u_lutStrength'),
      lutAtlasSize: gl.getUniformLocation(this.program, 'u_lutAtlasSize'),
      lutTonalMix: gl.getUniformLocation(this.program, 'u_lutTonalMix'),
    };

    this.positionBuffer = gl.createBuffer() as WebGLBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    this.texCoordBuffer = gl.createBuffer() as WebGLBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
      gl.STATIC_DRAW,
    );

    this.texture = gl.createTexture() as WebGLTexture;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // LUT atlas texture — bound to TEXTURE1 when uploaded, NEAREST
    // filtering so the blue-slice packing doesn't bleed across slice
    // boundaries. Trilinear interpolation is done by the shader, not
    // by the texture unit.
    this.lutTexture = gl.createTexture() as WebGLTexture;
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  setLut(state: PreviewLutState): void {
    const gl = this.gl;
    this.lutRuntime = state;
    if (!state.atlas) {
      this.lutState = null;
      return;
    }
    const atlas = state.atlas;
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      atlas.width,
      atlas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      atlas.pixels,
    );
    this.lutState = { size: atlas.size, width: atlas.width, height: atlas.height };
  }

  static create(canvas: HTMLCanvasElement): PreviewRenderer | null {
    const gl =
      (canvas.getContext('webgl', { preserveDrawingBuffer: false }) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return null;

    try {
      return new PreviewRenderer(canvas, gl);
    } catch (error) {
      console.warn('[preview-shader] init failed:', error);
      return null;
    }
  }

  setImage(image: ImageSource): void {
    const gl = this.gl;
    this.imageWidth = 'width' in image ? image.width : 0;
    this.imageHeight = 'height' in image ? image.height : 0;

    this.canvas.width = this.imageWidth;
    this.canvas.height = this.imageHeight;
    gl.viewport(0, 0, this.imageWidth, this.imageHeight);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image as TexImageSource,
    );
  }

  render(uniforms: PreviewUniforms): void {
    if (this.imageWidth === 0 || this.imageHeight === 0) return;
    const gl = this.gl;

    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.attribs.position);
    gl.vertexAttribPointer(this.attribs.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.attribs.texCoord);
    gl.vertexAttribPointer(this.attribs.texCoord, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms.image, 0);
    gl.uniform2f(
      this.uniforms.texelSize,
      1 / this.imageWidth,
      1 / this.imageHeight,
    );
    gl.uniform1f(this.uniforms.brightness, uniforms.brightness);
    gl.uniform1f(this.uniforms.contrast, uniforms.contrast);
    gl.uniform1f(this.uniforms.saturation, uniforms.saturation);
    gl.uniform1f(this.uniforms.sharpness, uniforms.sharpness);
    gl.uniform1f(this.uniforms.denoising, uniforms.denoising);
    gl.uniform1f(this.uniforms.skinSmoothing, uniforms.skinSmoothing);
    if (this.uniforms.hslHue) gl.uniform1fv(this.uniforms.hslHue, uniforms.hslHue);
    if (this.uniforms.hslSat) gl.uniform1fv(this.uniforms.hslSat, uniforms.hslSat);
    if (this.uniforms.hslLum) gl.uniform1fv(this.uniforms.hslLum, uniforms.hslLum);

    const lutEnabled = this.lutState !== null && this.lutRuntime.strength > 0;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    if (this.uniforms.lutAtlas) gl.uniform1i(this.uniforms.lutAtlas, 1);
    if (this.uniforms.lutEnabled) gl.uniform1f(this.uniforms.lutEnabled, lutEnabled ? 1 : 0);
    if (this.uniforms.lutSize) gl.uniform1f(this.uniforms.lutSize, this.lutState?.size ?? 2);
    if (this.uniforms.lutStrength) {
      gl.uniform1f(this.uniforms.lutStrength, Math.max(0, Math.min(1, this.lutRuntime.strength / 100)));
    }
    if (this.uniforms.lutAtlasSize) {
      gl.uniform2f(
        this.uniforms.lutAtlasSize,
        this.lutState?.width ?? 1,
        this.lutState?.height ?? 1,
      );
    }
    if (this.uniforms.lutTonalMix) {
      gl.uniform1f(this.uniforms.lutTonalMix, LUT_TONAL_MIX_CODE[this.lutRuntime.tonalMix]);
    }
    // Restore default texture unit so the main image binding is correct
    // for the next pass.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteTexture(this.lutTexture);
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    gl.deleteProgram(this.program);
  }
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${info}`);
  }
  return shader;
}

function linkProgram(
  gl: WebGLRenderingContext,
  vertex: WebGLShader,
  fragment: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('failed to create program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`program link failed: ${info}`);
  }
  return program;
}
