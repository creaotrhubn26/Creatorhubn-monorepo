/**
 * Shared enhancer contract. Both the UI component and the session layer
 * depend on this module, never on each other directly — keeps the
 * dependency graph a DAG and the state layer unit-testable without React.
 *
 * These types must stay in sync with backend/server/photo-enhancer-routes.ts
 * (the `settings` payload accepted by /api/photo-enhancer/enhance). Adding
 * a slider here without wiring the runner side is the "declared but not
 * wired" antipattern; don't do it.
 */

export type IntensityProfile = 'subtle' | 'normal' | 'strong';
export const INTENSITY_PROFILES: readonly IntensityProfile[] = ['subtle', 'normal', 'strong'] as const;

export type SubjectKind =
  | ''
  | 'portrait'
  | 'group_portrait'
  | 'food'
  | 'landscape'
  | 'product'
  | 'vehicle'
  | 'aviation'
  | 'other';

export const SUBJECT_KINDS: readonly SubjectKind[] = [
  '',
  'portrait',
  'group_portrait',
  'food',
  'landscape',
  'product',
  'vehicle',
  'aviation',
  'other',
] as const;

/**
 * 8-band HSL colour grading. Matches Evoto / Lightroom conventions so
 * muscle memory carries over. Each band's h/s/l slider is in [-100, 100]:
 *   h — hue rotation within the band (±30° at ±100)
 *   s — saturation multiplier around 1.0 (0×–2× at ±100)
 *   l — luminance offset (±0.25 on 0–1 V at ±100)
 * All zeros ⇒ identity pass; the runner short-circuits when nothing moved.
 */
export type HslBandName =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'aqua'
  | 'blue'
  | 'purple'
  | 'magenta';

export const HSL_BAND_NAMES: readonly HslBandName[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'aqua',
  'blue',
  'purple',
  'magenta',
] as const;

export interface HslBand {
  h: number;
  s: number;
  l: number;
}

export type HslAdjustments = Record<HslBandName, HslBand>;

export const HSL_IDENTITY: HslAdjustments = {
  red: { h: 0, s: 0, l: 0 },
  orange: { h: 0, s: 0, l: 0 },
  yellow: { h: 0, s: 0, l: 0 },
  green: { h: 0, s: 0, l: 0 },
  aqua: { h: 0, s: 0, l: 0 },
  blue: { h: 0, s: 0, l: 0 },
  purple: { h: 0, s: 0, l: 0 },
  magenta: { h: 0, s: 0, l: 0 },
};

export function cloneLut(value: LutSelection): LutSelection {
  return { ...value };
}

export function cloneHsl(value: HslAdjustments): HslAdjustments {
  return {
    red: { ...value.red },
    orange: { ...value.orange },
    yellow: { ...value.yellow },
    green: { ...value.green },
    aqua: { ...value.aqua },
    blue: { ...value.blue },
    purple: { ...value.purple },
    magenta: { ...value.magenta },
  };
}

export function hslIsIdentity(value: HslAdjustments): boolean {
  for (const band of HSL_BAND_NAMES) {
    const v = value[band];
    if (v.h !== 0 || v.s !== 0 || v.l !== 0) return false;
  }
  return true;
}

export const HSL_BAND_LABELS: Record<HslBandName, string> = {
  red: 'Rød',
  orange: 'Oransje',
  yellow: 'Gul',
  green: 'Grønn',
  aqua: 'Cyan',
  blue: 'Blå',
  purple: 'Lilla',
  magenta: 'Magenta',
};

/** Visual swatch colour per band — used for tab strips in the UI. */
export const HSL_BAND_SWATCHES: Record<HslBandName, string> = {
  red: '#e53935',
  orange: '#fb8c00',
  yellow: '#fdd835',
  green: '#43a047',
  aqua: '#00acc1',
  blue: '#1e88e5',
  purple: '#8e24aa',
  magenta: '#d81b60',
};

/**
 * Built-in LUT selection applied post-HSL. Contract mirrors the runner
 * at backend/gfpgan-runner/lut_library.py — the slug set is resolved on
 * the runner side, here we just carry the selection through the request.
 *
 * - ``name``: null = no LUT pass, otherwise the built-in slug or an
 *   uploaded-LUT uuid.
 * - ``strength``: [0, 100] linear mix between identity and LUT output.
 * - ``tonalMix``: limit the effect to a tonal range. Mirrors the Python
 *   applier's ``tonal_mix`` parameter.
 */
export type LutTonalMix = 'all' | 'highlights' | 'midtones' | 'shadows';

export interface LutSelection {
  name: string | null;
  strength: number;
  tonalMix: LutTonalMix;
}

export const LUT_IDENTITY: LutSelection = {
  name: null,
  strength: 0,
  tonalMix: 'all',
};

/**
 * Override slice that can be applied to a single detected face. Mirrors
 * the runner contract at backend/gfpgan-runner/portrait_retouch.py
 * ``apply_portrait_retouch_multi``. Only portrait-region sliders are
 * allowed here — global sliders (brightness, LUT, HSL, …) remain image-
 * scoped because there's no meaningful per-face interpretation.
 */
export type PerFaceEnhancementPatch = Partial<
  Pick<
    EnhancementSettings,
    | 'teethWhiteness'
    | 'eyeBrightness'
    | 'eyeWhiteness'
    | 'blemishRemoval'
    | 'teethProfile'
    | 'eyeBrightnessProfile'
    | 'eyeWhitenessProfile'
    | 'blemishProfile'
    | 'skinTextureGuard'
    | 'faceEnhancement'
  >
>;

export const PER_FACE_SETTINGS_KEYS: ReadonlyArray<keyof PerFaceEnhancementPatch> = [
  'teethWhiteness',
  'eyeBrightness',
  'eyeWhiteness',
  'blemishRemoval',
  'teethProfile',
  'eyeBrightnessProfile',
  'eyeWhitenessProfile',
  'blemishProfile',
  'skinTextureGuard',
  'faceEnhancement',
];

/**
 * What Claude Vision plans for an object-removal call. The executor
 * consumes this — Claude doesn't paint pixels, it tells the executor how.
 *
 * - ``strategy`` decides which fill path runs:
 *   - ``telea``        — OpenCV INPAINT_TELEA. Good for dust, scratches,
 *                        sensor spots, small thin defects.
 *   - ``ns``           — OpenCV INPAINT_NS. Better for textured fills.
 *   - ``patch_clone``  — copy from ``sourceRegions`` with feather blend.
 *                        Used when there's a clean donor patch nearby
 *                        (sky, repeating wall, table surface).
 *   - ``freq_sep``     — frequency-separated heal. Skin blemishes only.
 * - ``sourceRegions`` are image-space pixel rects Claude believes are safe
 *   to sample from. Empty for telea/ns/freq_sep.
 * - ``avoidRegions`` are areas the executor must NOT sample from
 *   (subject's face, signage with text, anything semantically distinct).
 * - ``warnings`` are short strings shown to the photographer when Claude
 *   thinks the result will be marginal — "mask crosses high-contrast edge"
 *   or "no good donor patch found, consider re-brushing tighter".
 */
export type InpaintStrategy = 'telea' | 'ns' | 'patch_clone' | 'freq_sep';

export interface InpaintRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InpaintRecipe {
  strategy: InpaintStrategy;
  /** Telea/NS radius in pixels. Ignored for other strategies. */
  radiusPx: number;
  /** Feather blend radius for patch_clone, in pixels. */
  featherPx: number;
  sourceRegions: InpaintRegion[];
  avoidRegions: InpaintRegion[];
  /** Whether the executor should run a freq-sep skin smooth after the
   *  fill. Useful when the masked area is on skin and the underlying
   *  texture survived the fill but tone needs evening. */
  postFreqSepSkin: boolean;
  warnings: string[];
  rationale: string;
}

export interface InpaintAxis {
  /** PNG-encoded base64 mask at source-image dimensions. White = remove. */
  maskPng: string;
  /** [0, 1] blend strength between original and inpainted result. */
  intensity: number;
  /** Last recipe Claude returned for this mask. ``null`` until the
   *  photographer hits "Foreslå" and the planner runs. */
  recipe: InpaintRecipe | null;
}

export interface LensCorrectionSettings {
  enabled: boolean;
  /** When true, derive amounts from the matched lens profile; else use the
   *  manual 0-100 strengths below. */
  auto: boolean;
  distortion: number;
  vignette: number;
  chromaticAberration: number;
}

export const DEFAULT_LENS_CORRECTION: LensCorrectionSettings = {
  enabled: false,
  auto: true,
  distortion: 0,
  vignette: 0,
  chromaticAberration: 0,
};

export interface EnhancementSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  denoising: number;
  faceEnhancement: number;
  modelPreference: string;
  gfpganQuality: number;
  codeformerFidelity: number;
  realesrganScale: number;
  swinir: boolean;
  bsrgan: boolean;
  diffbir: boolean;
  /**
   * Object removal axis. `null` when no removal mask exists. The mask is a
   * PNG-encoded base64 string at the same dimensions as the source image,
   * white where the photographer wants the executor to fill in. The recipe
   * is whatever Claude Vision returned the last time we asked it to plan
   * this removal — it carries source regions, blend strategy, and any
   * warnings the photographer should see.
   */
  inpaint: InpaintAxis | null;
  faceOnlyCrop: boolean;
  preserveBackground: boolean;
  skinTextureGuard: number;
  teethWhiteness: number;
  eyeBrightness: number;
  eyeWhiteness: number;
  blemishRemoval: number;
  teethProfile: IntensityProfile;
  eyeBrightnessProfile: IntensityProfile;
  eyeWhitenessProfile: IntensityProfile;
  blemishProfile: IntensityProfile;
  subject: SubjectKind;
  subjectLookStrength: number;
  hsl: HslAdjustments;
  lut: LutSelection;
  lensCorrection?: LensCorrectionSettings;
}

export const DEFAULT_SETTINGS: EnhancementSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  denoising: 50,
  faceEnhancement: 75,
  modelPreference: 'auto',
  gfpganQuality: 75,
  codeformerFidelity: 65,
  realesrganScale: 2,
  swinir: false,
  bsrgan: false,
  diffbir: false,
  inpaint: null,
  faceOnlyCrop: false,
  preserveBackground: true,
  skinTextureGuard: 70,
  teethWhiteness: 0,
  eyeBrightness: 0,
  eyeWhiteness: 0,
  blemishRemoval: 0,
  teethProfile: 'normal',
  eyeBrightnessProfile: 'normal',
  eyeWhitenessProfile: 'normal',
  blemishProfile: 'normal',
  subject: '',
  subjectLookStrength: 0,
  hsl: cloneHsl(HSL_IDENTITY),
  lut: { ...LUT_IDENTITY },
  lensCorrection: { ...DEFAULT_LENS_CORRECTION },
};

export type SessionImageFlag = 'none' | 'pick' | 'reject';

/**
 * Edit modules for selective copy/paste. Matches Evoto's paste dialog
 * groupings so the mental model is familiar to photographers migrating in.
 */
export type EditModuleKey = 'color' | 'detail' | 'face' | 'portrait' | 'subject' | 'model' | 'hsl' | 'lut' | 'inpaint';

export interface EditModuleSpec {
  key: EditModuleKey;
  label: string;
  settingsKeys: ReadonlyArray<keyof EnhancementSettings>;
}

export const EDIT_MODULES: readonly EditModuleSpec[] = [
  {
    key: 'color',
    label: 'Farge',
    settingsKeys: ['brightness', 'contrast', 'saturation'],
  },
  {
    key: 'detail',
    label: 'Detalj',
    settingsKeys: ['sharpness', 'denoising'],
  },
  {
    key: 'face',
    label: 'Ansiktsforbedring',
    settingsKeys: [
      'faceEnhancement',
      'gfpganQuality',
      'codeformerFidelity',
      'skinTextureGuard',
      'faceOnlyCrop',
    ],
  },
  {
    key: 'portrait',
    label: 'Portrett-retusj',
    settingsKeys: [
      'teethWhiteness',
      'eyeBrightness',
      'eyeWhiteness',
      'blemishRemoval',
      'teethProfile',
      'eyeBrightnessProfile',
      'eyeWhitenessProfile',
      'blemishProfile',
    ],
  },
  {
    key: 'subject',
    label: 'Kategori-look',
    settingsKeys: ['subject', 'subjectLookStrength'],
  },
  {
    key: 'model',
    label: 'Modell-strategi',
    settingsKeys: [
      'modelPreference',
      'realesrganScale',
      'swinir',
      'bsrgan',
      'diffbir',
      'preserveBackground',
    ],
  },
  {
    key: 'inpaint',
    label: 'Fjern objekter',
    settingsKeys: ['inpaint'],
  },
  {
    key: 'hsl',
    label: 'HSL (8-bånds farge)',
    settingsKeys: ['hsl'],
  },
  {
    key: 'lut',
    label: 'LUT / look',
    settingsKeys: ['lut'],
  },
] as const;

const KEYS_IN_ANY_MODULE: ReadonlySet<keyof EnhancementSettings> = (() => {
  const s = new Set<keyof EnhancementSettings>();
  for (const mod of EDIT_MODULES) for (const k of mod.settingsKeys) s.add(k);
  return s;
})();

/** Sanity check for the test suite — every settings key must live in
 *  exactly one module or the selective paste UI silently drops it. */
export function settingsKeysNotCoveredByAnyModule(): Array<keyof EnhancementSettings> {
  const all = Object.keys(DEFAULT_SETTINGS) as Array<keyof EnhancementSettings>;
  return all.filter((k) => !KEYS_IN_ANY_MODULE.has(k));
}
