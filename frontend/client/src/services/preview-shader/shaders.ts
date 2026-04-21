export const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

// HSL matches backend/gfpgan-runner/hsl_retouch.py — 8 band centres in
// degrees (red 0 / orange 30 / yellow 60 / green 120 / aqua 180 /
// blue 240 / purple 270 / magenta 300), raised-cosine half-width 40°,
// per-band { hueDelta, satMul, lumDelta }. Kept as uniform arrays so we
// can ship all 24 HSL values in one upload from JS.
export const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

varying vec2 v_texCoord;

uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_sharpness;
uniform float u_denoising;
uniform float u_skinSmoothing;

uniform float u_hslHue[8];
uniform float u_hslSat[8];
uniform float u_hslLum[8];

// LUT is a 2D atlas: width = size*size, height = size, b-sliced across X.
// When u_lutEnabled is 0, the LUT pass is skipped entirely (identity).
uniform sampler2D u_lutAtlas;
uniform float u_lutEnabled;
uniform float u_lutSize;
uniform float u_lutStrength;
uniform vec2 u_lutAtlasSize;
// 0 = all, 1 = highlights, 2 = midtones, 3 = shadows
uniform float u_lutTonalMix;

vec3 sampleLutSlice(float b, vec3 rgb) {
  float size = u_lutSize;
  float xInSlice = rgb.r * (size - 1.0);
  float yInSlice = rgb.g * (size - 1.0);
  float atlasX = b * size + xInSlice + 0.5;
  float atlasY = yInSlice + 0.5;
  vec2 uv = vec2(atlasX, atlasY) / u_lutAtlasSize;
  return texture2D(u_lutAtlas, uv).rgb;
}

vec3 applyLut(vec3 rgb) {
  if (u_lutEnabled < 0.5) return rgb;
  float size = u_lutSize;
  float bGrid = clamp(rgb.b, 0.0, 1.0) * (size - 1.0);
  float b0 = floor(bGrid);
  float b1 = min(size - 1.0, b0 + 1.0);
  float tb = bGrid - b0;
  vec3 lo = sampleLutSlice(b0, rgb);
  vec3 hi = sampleLutSlice(b1, rgb);
  vec3 look = mix(lo, hi, tb);

  // Tonal-mix weight based on input luminance.
  float lumIn = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  float tonalWeight = 1.0;
  if (u_lutTonalMix > 0.5 && u_lutTonalMix < 1.5) {
    tonalWeight = smoothstep(0.45, 0.85, lumIn);            // highlights
  } else if (u_lutTonalMix > 1.5 && u_lutTonalMix < 2.5) {
    float d = abs(lumIn - 0.5);
    tonalWeight = 1.0 - smoothstep(0.15, 0.4, d);            // midtones
  } else if (u_lutTonalMix > 2.5) {
    tonalWeight = 1.0 - smoothstep(0.15, 0.55, lumIn);        // shadows
  }

  return mix(rgb, look, u_lutStrength * tonalWeight);
}

const float HSL_HALF_WIDTH = 40.0;

// Fast HSV helpers. These accept / return linearised-ish RGB in [0,1]
// which matches texture2D() output and the rest of the pipeline. Exact
// parity with OpenCV's float HSV isn't required — the runner applies the
// authoritative pass on Enhance, this shader is a responsive preview.
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

float bandWeight(float hueDeg, float centreDeg) {
  float diff = abs(hueDeg - centreDeg);
  float distance = min(diff, 360.0 - diff);
  if (distance >= HSL_HALF_WIDTH) return 0.0;
  return 0.5 * (1.0 + cos(3.14159265 * distance / HSL_HALF_WIDTH));
}

vec3 applyHsl(vec3 rgb) {
  vec3 hsv = rgb2hsv(rgb);
  float hueDeg = hsv.x * 360.0;

  float centres[8];
  centres[0] = 0.0;    centres[1] = 30.0;   centres[2] = 60.0;   centres[3] = 120.0;
  centres[4] = 180.0;  centres[5] = 240.0;  centres[6] = 270.0;  centres[7] = 300.0;

  float weights[8];
  float weightSum = 0.0;
  for (int i = 0; i < 8; i++) {
    weights[i] = bandWeight(hueDeg, centres[i]);
    weightSum += weights[i];
  }
  if (weightSum < 0.0001) {
    // All bands cold — shouldn't happen with half-width 40° + 8 bands
    // but guard so we don't divide by zero.
    return rgb;
  }

  float hueShift = 0.0;
  float satMul = 0.0;
  float lumShift = 0.0;
  for (int i = 0; i < 8; i++) {
    float w = weights[i] / weightSum;
    hueShift += w * u_hslHue[i];     // degrees
    satMul   += w * (1.0 + u_hslSat[i] * 0.01); // 0..2 range at ±100
    lumShift += w * u_hslLum[i] * 0.0025;       // ±0.25 at ±100
  }

  float newHue = mod(hueDeg + hueShift, 360.0);
  if (newHue < 0.0) newHue += 360.0;
  float newSat = clamp(hsv.y * satMul, 0.0, 1.0);
  float newVal = clamp(hsv.z + lumShift, 0.0, 1.0);

  return hsv2rgb(vec3(newHue / 360.0, newSat, newVal));
}

void main() {
  vec4 color = texture2D(u_image, v_texCoord);

  vec4 blur = vec4(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      blur += texture2D(u_image, v_texCoord + vec2(float(i), float(j)) * u_texelSize);
    }
  }
  blur /= 9.0;

  vec4 sharpened = color + u_sharpness * (color - blur);
  vec4 base = mix(sharpened, blur, u_denoising);

  float cb = -0.169 * color.r - 0.331 * color.g + 0.5   * color.b + 0.5;
  float cr =  0.5   * color.r - 0.419 * color.g - 0.081 * color.b + 0.5;
  float skinCb = smoothstep(0.30, 0.45, cb) * (1.0 - smoothstep(0.55, 0.70, cb));
  float skinCr = smoothstep(0.50, 0.58, cr) * (1.0 - smoothstep(0.78, 0.88, cr));
  float skinMask = clamp(skinCb * skinCr, 0.0, 1.0);
  base = mix(base, blur, skinMask * u_skinSmoothing);

  base.rgb += u_brightness;
  base.rgb = (base.rgb - 0.5) * u_contrast + 0.5;

  float lum = dot(base.rgb, vec3(0.299, 0.587, 0.114));
  base.rgb = mix(vec3(lum), base.rgb, u_saturation);

  base.rgb = applyHsl(clamp(base.rgb, 0.0, 1.0));
  base.rgb = applyLut(clamp(base.rgb, 0.0, 1.0));

  gl_FragColor = vec4(clamp(base.rgb, 0.0, 1.0), color.a);
}
`;
