import type { HslAdjustments, LutSelection, LutTonalMix } from '../../lib/enhancer-session/module-contract';
import { HSL_BAND_NAMES, HSL_IDENTITY, cloneHsl } from '../../lib/enhancer-session/module-contract';
import type { LutAtlas } from './lut-atlas';

export interface PreviewSliderInput {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  denoising: number;
  faceEnhancement: number;
  hsl?: HslAdjustments;
  lut?: LutSelection;
}

/** Lightweight sidecar state — the atlas pixels live outside the settings
 *  contract because they're large (≈20 KB for size=17) and change only
 *  when the selected LUT changes, not on every slider move. */
export interface PreviewLutState {
  atlas: LutAtlas | null;
  strength: number;
  tonalMix: LutTonalMix;
}

export const LUT_TONAL_MIX_CODE: Record<LutTonalMix, number> = {
  all: 0,
  highlights: 1,
  midtones: 2,
  shadows: 3,
};

export interface PreviewUniforms {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  denoising: number;
  skinSmoothing: number;
  /** 8 per-band hue offsets (degrees). Parallel to HSL_BAND_NAMES. */
  hslHue: Float32Array;
  /** 8 per-band saturation slider values in [-100, 100]. Shader scales. */
  hslSat: Float32Array;
  /** 8 per-band luminance slider values in [-100, 100]. Shader scales. */
  hslLum: Float32Array;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Slider scale notes match CreatorHubPhotoEnhancer DEFAULT_SETTINGS:
//   brightness/contrast/saturation/sharpness ∈ [-100, 100]
//   denoising/faceEnhancement                ∈ [0, 100]
// Uniforms are tuned so 0 on every slider is a true no-op (identity render).
export function mapSettingsToUniforms(input: PreviewSliderInput): PreviewUniforms {
  const positiveSharpness = Math.max(0, input.sharpness) / 100;
  const negativeSharpness = Math.max(0, -input.sharpness) / 100;
  const hsl = input.hsl ?? HSL_IDENTITY;
  const hslHue = new Float32Array(8);
  const hslSat = new Float32Array(8);
  const hslLum = new Float32Array(8);
  for (let i = 0; i < HSL_BAND_NAMES.length; i += 1) {
    const band = hsl[HSL_BAND_NAMES[i]];
    // Hue slider ∈ ±100 maps to ±30° rotation (matches Python runner).
    hslHue[i] = clamp(band.h, -100, 100) * 0.30;
    // Saturation + luminance are passed through as ±100 slider units and
    // scaled inside the shader so the math lives in one place.
    hslSat[i] = clamp(band.s, -100, 100);
    hslLum[i] = clamp(band.l, -100, 100);
  }
  return {
    brightness: clamp(input.brightness / 100, -1, 1) * 0.3,
    contrast: 1 + clamp(input.contrast / 100, -1, 1) * 0.5,
    saturation: clamp(1 + input.saturation / 100, 0, 2),
    sharpness: positiveSharpness * 1.5,
    denoising: clamp(
      (clamp(input.denoising, 0, 100) / 100) * 0.6 + negativeSharpness * 0.4,
      0,
      1,
    ),
    skinSmoothing: clamp(input.faceEnhancement, 0, 100) / 100 * 0.6,
    hslHue,
    hslSat,
    hslLum,
  };
}

function allZero(arr: Float32Array): boolean {
  for (let i = 0; i < arr.length; i += 1) {
    if (arr[i] !== 0) return false;
  }
  return true;
}

export function uniformsAreIdentity(u: PreviewUniforms): boolean {
  return (
    u.brightness === 0 &&
    u.contrast === 1 &&
    u.saturation === 1 &&
    u.sharpness === 0 &&
    u.denoising === 0 &&
    u.skinSmoothing === 0 &&
    allZero(u.hslHue) &&
    allZero(u.hslSat) &&
    allZero(u.hslLum)
  );
}

export { cloneHsl, HSL_IDENTITY, HSL_BAND_NAMES };
