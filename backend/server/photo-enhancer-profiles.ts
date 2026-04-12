export type PhotoEnhancerLensProfile = {
  id: string;
  brand: string;
  mount: string;
  name: string;
  aliases: string[];
  coverage: "full-frame" | "aps-c" | "cinema-full-frame" | "medium-format" | "multi-format";
  lensClass: "prime" | "zoom" | "macro" | "fisheye" | "dual-fisheye" | "telephoto" | "cine-prime";
  focalRangeMm: [number, number];
  maxAperture: string;
  stabilization: boolean;
  macro: boolean;
  correctionProfileStatus: "cataloged" | "external-profile-needed" | "vendor-embedded";
  source:
    | "canon-rf-lineup-2026-04"
    | "canon-product-page-2026-04"
    | "canon-eos-r-brochure-2026-04"
    | "sony-e-lineup-2026-04"
    | "nikon-z-lineup-2026-04"
    | "fujifilm-x-gfx-lineup-2026-04"
    | "sigma-mirrorless-lineup-2026-04";
};

export type PhotoEnhancerCameraProfile = {
  id: string;
  brand: string;
  mount: string;
  name: string;
  aliases: string[];
  sensor: "full-frame" | "aps-c" | "medium-format" | "micro-four-thirds" | "unknown";
  rawFormats: string[];
  colorPolicy: "preserve-embedded-icc" | "convert-to-srgb-when-missing";
  source: "exif-match";
};

export type PhotoEnhancerMirrorlessProfileFamily = {
  id: string;
  brand: string;
  mount: string;
  lensFamilies: string[];
  profileStrategy: "metadata-match-first" | "vendor-embedded-first" | "lensfun-or-lcp-import";
  notes: string;
};

export type PhotoEnhancerNormalizedExif = {
  make: string | null;
  model: string | null;
  lensModel: string | null;
  lensId: string | null;
  lensSerialNumber: string | null;
  bodySerialNumber: string | null;
  serialNumber: string | null;
  focalLengthMm: number | null;
  focalLength35mmMm: number | null;
  iso: number | null;
  exposureTime: string | null;
  fNumber: number | null;
  apertureValue: string | null;
  shutterSpeedValue: string | null;
  exposureCompensation: string | null;
  exposureProgram: string | null;
  meteringMode: string | null;
  flash: string | null;
  whiteBalance: string | null;
  colorSpace: string | null;
  iccProfile: string | null;
  bitsPerSample: string | null;
  colorComponents: number | null;
  orientation: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  copyright: string | null;
  artist: string | null;
  creator: string | null;
  credit: string | null;
  ownerName: string | null;
  title: string | null;
  description: string | null;
  usageTerms: string | null;
  fileType: string | null;
  mimeType: string | null;
};

export type PhotoEnhancerXmpSidecarMetadata = {
  provided: boolean;
  byteLength: number;
  rating: string | null;
  label: string | null;
  title: string | null;
  description: string | null;
  creators: string[];
  rights: string | null;
  usageTerms: string | null;
  credit: string | null;
  source: string | null;
  clientName: string | null;
  subjects: string[];
  fieldsFound: string[];
};

function rfLens(
  name: string,
  focalRangeMm: [number, number],
  maxAperture: string,
  options: Partial<Pick<
    PhotoEnhancerLensProfile,
    "coverage" | "lensClass" | "stabilization" | "macro" | "correctionProfileStatus" | "source"
  >> & { aliases?: string[] } = {},
): PhotoEnhancerLensProfile {
  const isRfS = name.startsWith("RF-S");
  return {
    id: `canon-${slugify(name)}`,
    brand: "Canon",
    mount: "Canon RF",
    name,
    aliases: options.aliases || [],
    coverage: options.coverage || (isRfS ? "aps-c" : "full-frame"),
    lensClass: options.lensClass || (focalRangeMm[0] === focalRangeMm[1] ? "prime" : "zoom"),
    focalRangeMm,
    maxAperture,
    stabilization: Boolean(options.stabilization),
    macro: Boolean(options.macro),
    correctionProfileStatus: options.correctionProfileStatus || "cataloged",
    source: options.source || "canon-rf-lineup-2026-04",
  };
}

function cineLens(name: string, focalLengthMm: number, maxAperture: string): PhotoEnhancerLensProfile {
  return rfLens(name, [focalLengthMm, focalLengthMm], maxAperture, {
    coverage: "cinema-full-frame",
    lensClass: "cine-prime",
    correctionProfileStatus: "external-profile-needed",
    source: "canon-eos-r-brochure-2026-04",
  });
}

function nativeMirrorlessLens(
  brand: string,
  mount: string,
  name: string,
  focalRangeMm: [number, number],
  maxAperture: string,
  source: PhotoEnhancerLensProfile["source"],
  options: Partial<Pick<
    PhotoEnhancerLensProfile,
    "coverage" | "lensClass" | "stabilization" | "macro" | "correctionProfileStatus"
  >> & { aliases?: string[] } = {},
): PhotoEnhancerLensProfile {
  return {
    id: `${slugify(brand)}-${slugify(name)}`,
    brand,
    mount,
    name,
    aliases: options.aliases || [],
    coverage: options.coverage || "full-frame",
    lensClass: options.lensClass || (focalRangeMm[0] === focalRangeMm[1] ? "prime" : "zoom"),
    focalRangeMm,
    maxAperture,
    stabilization: Boolean(options.stabilization),
    macro: Boolean(options.macro),
    correctionProfileStatus: options.correctionProfileStatus || "vendor-embedded",
    source,
  };
}

function sonyLens(
  name: string,
  focalRangeMm: [number, number],
  maxAperture: string,
  options: Parameters<typeof nativeMirrorlessLens>[6] = {},
): PhotoEnhancerLensProfile {
  return nativeMirrorlessLens("Sony", "Sony E/FE", name, focalRangeMm, maxAperture, "sony-e-lineup-2026-04", options);
}

function nikonLens(
  name: string,
  focalRangeMm: [number, number],
  maxAperture: string,
  options: Parameters<typeof nativeMirrorlessLens>[6] = {},
): PhotoEnhancerLensProfile {
  return nativeMirrorlessLens("Nikon", "Nikon Z", name, focalRangeMm, maxAperture, "nikon-z-lineup-2026-04", options);
}

function fujiLens(
  name: string,
  focalRangeMm: [number, number],
  maxAperture: string,
  options: Parameters<typeof nativeMirrorlessLens>[6] = {},
): PhotoEnhancerLensProfile {
  return nativeMirrorlessLens("Fujifilm", "Fujifilm X/GFX", name, focalRangeMm, maxAperture, "fujifilm-x-gfx-lineup-2026-04", options);
}

function sigmaLens(
  mount: string,
  name: string,
  focalRangeMm: [number, number],
  maxAperture: string,
  options: Parameters<typeof nativeMirrorlessLens>[6] = {},
): PhotoEnhancerLensProfile {
  return nativeMirrorlessLens("Sigma", mount, name, focalRangeMm, maxAperture, "sigma-mirrorless-lineup-2026-04", {
    correctionProfileStatus: "external-profile-needed",
    ...options,
  });
}

export const PHOTO_ENHANCER_CANON_RF_LENS_PROFILES: PhotoEnhancerLensProfile[] = [
  rfLens("RF7-14mm F2.8-3.5 L Fisheye STM", [7, 14], "F2.8-3.5", {
    lensClass: "fisheye",
    source: "canon-product-page-2026-04",
  }),
  rfLens("RF10-20mm F4 L IS STM", [10, 20], "F4", { stabilization: true }),
  rfLens("RF14-35mm F4 L IS USM", [14, 35], "F4", { stabilization: true }),
  rfLens("RF15-30mm F4.5-6.3 IS STM", [15, 30], "F4.5-6.3", { stabilization: true }),
  rfLens("RF15-35mm F2.8 L IS USM", [15, 35], "F2.8", { stabilization: true }),
  rfLens("RF16-28mm F2.8 IS STM", [16, 28], "F2.8", { stabilization: true }),
  rfLens("RF24-50mm F4.5-6.3 IS STM", [24, 50], "F4.5-6.3", { stabilization: true }),
  rfLens("RF24-70mm F2.8 L IS USM", [24, 70], "F2.8", { stabilization: true }),
  rfLens("RF24-105mm F2.8 L IS USM Z", [24, 105], "F2.8", {
    stabilization: true,
    aliases: ["RF24-105mm F2.8 L IS USM Z PZ"],
  }),
  rfLens("RF24-105mm F4 L IS USM", [24, 105], "F4", { stabilization: true }),
  rfLens("RF24-105mm F4-7.1 IS STM", [24, 105], "F4-7.1", { stabilization: true }),
  rfLens("RF24-240mm F4-6.3 IS USM", [24, 240], "F4-6.3", { stabilization: true }),
  rfLens("RF28-70mm F2 L USM", [28, 70], "F2"),
  rfLens("RF28-70mm F2.8 IS STM", [28, 70], "F2.8", { stabilization: true }),
  rfLens("RF70-200mm F2.8 L IS USM", [70, 200], "F2.8", { stabilization: true }),
  rfLens("RF70-200mm F2.8 L IS USM Z", [70, 200], "F2.8", { stabilization: true }),
  rfLens("RF70-200mm F4 L IS USM", [70, 200], "F4", { stabilization: true }),
  rfLens("RF100-300mm F2.8 L IS USM", [100, 300], "F2.8", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  rfLens("RF100-400mm F5.6-8 IS USM", [100, 400], "F5.6-8", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  rfLens("RF100-500mm F4.5-7.1 L IS USM", [100, 500], "F4.5-7.1", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  rfLens("RF200-800mm F6.3-9 IS USM", [200, 800], "F6.3-9", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  rfLens("RF-S10-18mm F4.5-6.3 IS STM", [10, 18], "F4.5-6.3", { stabilization: true }),
  rfLens("RF-S14-30mm F4-6.3 IS STM PZ", [14, 30], "F4-6.3", {
    stabilization: true,
    source: "canon-eos-r-brochure-2026-04",
  }),
  rfLens("RF-S18-45mm F4.5-6.3 IS STM", [18, 45], "F4.5-6.3", { stabilization: true }),
  rfLens("RF-S18-150mm F3.5-6.3 IS STM", [18, 150], "F3.5-6.3", { stabilization: true }),
  rfLens("RF-S55-210mm F5-7.1 IS STM", [55, 210], "F5-7.1", { stabilization: true }),
  rfLens("RF14mm F1.4 L VCM", [14, 14], "F1.4", { source: "canon-product-page-2026-04" }),
  rfLens("RF16mm F2.8 STM", [16, 16], "F2.8"),
  rfLens("RF20mm F1.4 L VCM", [20, 20], "F1.4", { source: "canon-product-page-2026-04" }),
  rfLens("RF24mm F1.4 L VCM", [24, 24], "F1.4"),
  rfLens("RF24mm F1.8 Macro IS STM", [24, 24], "F1.8", {
    stabilization: true,
    macro: true,
    lensClass: "macro",
  }),
  rfLens("RF28mm F2.8 STM", [28, 28], "F2.8"),
  rfLens("RF35mm F1.4 L VCM", [35, 35], "F1.4"),
  rfLens("RF35mm F1.8 Macro IS STM", [35, 35], "F1.8", {
    stabilization: true,
    macro: true,
    lensClass: "macro",
  }),
  rfLens("RF45mm F1.2 STM", [45, 45], "F1.2", { source: "canon-product-page-2026-04" }),
  rfLens("RF50mm F1.2 L USM", [50, 50], "F1.2"),
  rfLens("RF50mm F1.4 L VCM", [50, 50], "F1.4"),
  rfLens("RF50mm F1.8 STM", [50, 50], "F1.8"),
  rfLens("RF85mm F2 Macro IS STM", [85, 85], "F2", {
    stabilization: true,
    macro: true,
    lensClass: "macro",
  }),
  rfLens("RF85mm F1.2 L USM", [85, 85], "F1.2"),
  rfLens("RF85mm F1.2 L USM DS", [85, 85], "F1.2"),
  rfLens("RF85mm F1.4 L VCM", [85, 85], "F1.4", { source: "canon-product-page-2026-04" }),
  rfLens("RF100mm F2.8 L Macro IS USM", [100, 100], "F2.8", {
    stabilization: true,
    macro: true,
    lensClass: "macro",
  }),
  rfLens("RF135mm F1.8 L IS USM", [135, 135], "F1.8", { stabilization: true }),
  rfLens("RF400mm F2.8 L IS USM", [400, 400], "F2.8", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  rfLens("RF600mm F4 L IS USM", [600, 600], "F4", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  rfLens("RF600mm F11 IS STM", [600, 600], "F11", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  rfLens("RF800mm F5.6 L IS USM", [800, 800], "F5.6", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  rfLens("RF800mm F11 IS STM", [800, 800], "F11", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  rfLens("RF1200mm F8 L IS USM", [1200, 1200], "F8", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  rfLens("RF-S3.9mm F3.5 STM DUAL FISHEYE", [3.9, 3.9], "F3.5", {
    lensClass: "dual-fisheye",
    source: "canon-product-page-2026-04",
  }),
  rfLens("RF-S7.8mm F4 STM DUAL", [7.8, 7.8], "F4", {
    lensClass: "dual-fisheye",
    source: "canon-product-page-2026-04",
  }),
  rfLens("RF5.2mm F2.8 L Dual Fisheye", [5.2, 5.2], "F2.8", {
    lensClass: "dual-fisheye",
  }),
  cineLens("CN-R14mm T3.1 L F", 14, "T3.1"),
  cineLens("CN-R20mm T1.5 L F", 20, "T1.5"),
  cineLens("CN-R24mm T1.5 L F", 24, "T1.5"),
  cineLens("CN-R35mm T1.5 L F", 35, "T1.5"),
  cineLens("CN-R50mm T1.3 L F", 50, "T1.3"),
  cineLens("CN-R85mm T1.3 L F", 85, "T1.3"),
  cineLens("CN-R135mm T2.2 L F", 135, "T2.2"),
];

export const PHOTO_ENHANCER_SONY_E_LENS_PROFILES: PhotoEnhancerLensProfile[] = [
  sonyLens("FE 12-24mm F2.8 GM", [12, 24], "F2.8"),
  sonyLens("FE 12-24mm F4 G", [12, 24], "F4"),
  sonyLens("FE 14mm F1.8 GM", [14, 14], "F1.8"),
  sonyLens("FE 16mm F1.8 G", [16, 16], "F1.8"),
  sonyLens("FE 16-25mm F2.8 G", [16, 25], "F2.8"),
  sonyLens("FE 16-35mm F2.8 GM", [16, 35], "F2.8"),
  sonyLens("FE 16-35mm F2.8 GM II", [16, 35], "F2.8"),
  sonyLens("FE 16-35mm F4 ZA OSS", [16, 35], "F4", { stabilization: true }),
  sonyLens("FE PZ 16-35mm F4 G", [16, 35], "F4"),
  sonyLens("FE 20mm F1.8 G", [20, 20], "F1.8"),
  sonyLens("FE 20-70mm F4 G", [20, 70], "F4"),
  sonyLens("FE 24mm F1.4 GM", [24, 24], "F1.4"),
  sonyLens("FE 24mm F2.8 G", [24, 24], "F2.8"),
  sonyLens("FE 24-50mm F2.8 G", [24, 50], "F2.8"),
  sonyLens("FE 24-70mm F2.8 GM", [24, 70], "F2.8"),
  sonyLens("FE 24-70mm F2.8 GM II", [24, 70], "F2.8"),
  sonyLens("FE 24-70mm F4 ZA OSS", [24, 70], "F4", { stabilization: true }),
  sonyLens("FE 24-105mm F4 G OSS", [24, 105], "F4", { stabilization: true }),
  sonyLens("FE 28mm F2", [28, 28], "F2"),
  sonyLens("FE 28-60mm F4-5.6", [28, 60], "F4-5.6"),
  sonyLens("FE 28-70mm F2 GM", [28, 70], "F2"),
  sonyLens("FE 28-70mm F3.5-5.6 OSS", [28, 70], "F3.5-5.6", { stabilization: true }),
  sonyLens("FE PZ 28-135mm F4 G OSS", [28, 135], "F4", { stabilization: true }),
  sonyLens("FE 35mm F1.4 GM", [35, 35], "F1.4"),
  sonyLens("FE 35mm F1.8", [35, 35], "F1.8"),
  sonyLens("FE 40mm F2.5 G", [40, 40], "F2.5"),
  sonyLens("FE 50mm F1.2 GM", [50, 50], "F1.2"),
  sonyLens("FE 50mm F1.4 GM", [50, 50], "F1.4"),
  sonyLens("FE 50mm F1.8", [50, 50], "F1.8"),
  sonyLens("FE 50mm F2.5 G", [50, 50], "F2.5"),
  sonyLens("Sonnar T* FE 55mm F1.8 ZA", [55, 55], "F1.8", { aliases: ["FE 55mm F1.8 ZA"] }),
  sonyLens("FE 50-150mm F2 GM", [50, 150], "F2"),
  sonyLens("FE 70-200mm F2.8 GM OSS", [70, 200], "F2.8", { stabilization: true }),
  sonyLens("FE 70-200mm F2.8 GM OSS II", [70, 200], "F2.8", { stabilization: true }),
  sonyLens("FE 70-200mm F4 Macro G OSS II", [70, 200], "F4", {
    stabilization: true,
    macro: true,
    lensClass: "macro",
  }),
  sonyLens("FE 70-300mm F4.5-5.6 G OSS", [70, 300], "F4.5-5.6", { stabilization: true }),
  sonyLens("FE 85mm F1.4 GM", [85, 85], "F1.4"),
  sonyLens("FE 85mm F1.4 GM II", [85, 85], "F1.4"),
  sonyLens("FE 85mm F1.8", [85, 85], "F1.8"),
  sonyLens("FE 90mm F2.8 Macro G OSS", [90, 90], "F2.8", {
    stabilization: true,
    macro: true,
    lensClass: "macro",
  }),
  sonyLens("FE 100mm F2.8 Macro GM OSS", [100, 100], "F2.8", {
    stabilization: true,
    macro: true,
    lensClass: "macro",
  }),
  sonyLens("FE 100mm F2.8 STF GM OSS", [100, 100], "F2.8", { stabilization: true }),
  sonyLens("FE 100-400mm F4.5-5.6 GM OSS", [100, 400], "F4.5-5.6", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  sonyLens("FE 135mm F1.8 GM", [135, 135], "F1.8"),
  sonyLens("FE 200-600mm F5.6-6.3 G OSS", [200, 600], "F5.6-6.3", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  sonyLens("FE 300mm F2.8 GM OSS", [300, 300], "F2.8", { stabilization: true, lensClass: "telephoto" }),
  sonyLens("FE 400mm F2.8 GM OSS", [400, 400], "F2.8", { stabilization: true, lensClass: "telephoto" }),
  sonyLens("FE 600mm F4 GM OSS", [600, 600], "F4", { stabilization: true, lensClass: "telephoto" }),
  sonyLens("E 10-18mm F4 OSS", [10, 18], "F4", { coverage: "aps-c", stabilization: true }),
  sonyLens("E PZ 10-20mm F4 G", [10, 20], "F4", { coverage: "aps-c" }),
  sonyLens("E 11mm F1.8", [11, 11], "F1.8", { coverage: "aps-c" }),
  sonyLens("E 15mm F1.4 G", [15, 15], "F1.4", { coverage: "aps-c" }),
  sonyLens("E 16mm F2.8", [16, 16], "F2.8", { coverage: "aps-c" }),
  sonyLens("E PZ 16-50mm F3.5-5.6 OSS", [16, 50], "F3.5-5.6", {
    coverage: "aps-c",
    stabilization: true,
  }),
  sonyLens("E 16-55mm F2.8 G", [16, 55], "F2.8", { coverage: "aps-c" }),
  sonyLens("E 16-55mm F2.8 G II", [16, 55], "F2.8", { coverage: "aps-c" }),
  sonyLens("Vario-Tessar T* E 16-70mm F4 ZA OSS", [16, 70], "F4", {
    coverage: "aps-c",
    stabilization: true,
    aliases: ["E 16-70mm F4 ZA OSS"],
  }),
  sonyLens("E PZ 18-105mm F4 G OSS", [18, 105], "F4", { coverage: "aps-c", stabilization: true }),
  sonyLens("E 18-135mm F3.5-5.6 OSS", [18, 135], "F3.5-5.6", { coverage: "aps-c", stabilization: true }),
  sonyLens("E 18-200mm F3.5-6.3 OSS LE", [18, 200], "F3.5-6.3", { coverage: "aps-c", stabilization: true }),
  sonyLens("E 20mm F2.8", [20, 20], "F2.8", { coverage: "aps-c" }),
  sonyLens("Sonnar T* E 24mm F1.8 ZA", [24, 24], "F1.8", { coverage: "aps-c", aliases: ["E 24mm F1.8 ZA"] }),
  sonyLens("E 30mm F3.5 Macro", [30, 30], "F3.5", { coverage: "aps-c", macro: true, lensClass: "macro" }),
  sonyLens("E 35mm F1.8 OSS", [35, 35], "F1.8", { coverage: "aps-c", stabilization: true }),
  sonyLens("E 50mm F1.8 OSS", [50, 50], "F1.8", { coverage: "aps-c", stabilization: true }),
  sonyLens("E 55-210mm F4.5-6.3 OSS", [55, 210], "F4.5-6.3", { coverage: "aps-c", stabilization: true }),
];

export const PHOTO_ENHANCER_NIKON_Z_LENS_PROFILES: PhotoEnhancerLensProfile[] = [
  nikonLens("NIKKOR Z 14-24mm f/2.8 S", [14, 24], "f/2.8"),
  nikonLens("NIKKOR Z 14-30mm f/4 S", [14, 30], "f/4"),
  nikonLens("NIKKOR Z 17-28mm f/2.8", [17, 28], "f/2.8"),
  nikonLens("NIKKOR Z 20mm f/1.8 S", [20, 20], "f/1.8"),
  nikonLens("NIKKOR Z 24mm f/1.8 S", [24, 24], "f/1.8"),
  nikonLens("NIKKOR Z 24-50mm f/4-6.3", [24, 50], "f/4-6.3"),
  nikonLens("NIKKOR Z 24-70mm f/2.8 S", [24, 70], "f/2.8"),
  nikonLens("NIKKOR Z 24-70mm f/4 S", [24, 70], "f/4"),
  nikonLens("NIKKOR Z 24-120mm f/4 S", [24, 120], "f/4"),
  nikonLens("NIKKOR Z 24-200mm f/4-6.3 VR", [24, 200], "f/4-6.3", { stabilization: true }),
  nikonLens("NIKKOR Z 26mm f/2.8", [26, 26], "f/2.8"),
  nikonLens("NIKKOR Z 28mm f/2.8", [28, 28], "f/2.8"),
  nikonLens("NIKKOR Z 28-75mm f/2.8", [28, 75], "f/2.8"),
  nikonLens("NIKKOR Z 28-400mm f/4-8 VR", [28, 400], "f/4-8", { stabilization: true }),
  nikonLens("NIKKOR Z 35mm f/1.2 S", [35, 35], "f/1.2"),
  nikonLens("NIKKOR Z 35mm f/1.4", [35, 35], "f/1.4"),
  nikonLens("NIKKOR Z 35mm f/1.8 S", [35, 35], "f/1.8"),
  nikonLens("NIKKOR Z 40mm f/2", [40, 40], "f/2"),
  nikonLens("NIKKOR Z 50mm f/1.2 S", [50, 50], "f/1.2"),
  nikonLens("NIKKOR Z 50mm f/1.4", [50, 50], "f/1.4"),
  nikonLens("NIKKOR Z 50mm f/1.8 S", [50, 50], "f/1.8"),
  nikonLens("NIKKOR Z MC 50mm f/2.8", [50, 50], "f/2.8", { macro: true, lensClass: "macro" }),
  nikonLens("NIKKOR Z 58mm f/0.95 S Noct", [58, 58], "f/0.95"),
  nikonLens("NIKKOR Z 70-180mm f/2.8", [70, 180], "f/2.8"),
  nikonLens("NIKKOR Z 70-200mm f/2.8 VR S", [70, 200], "f/2.8", { stabilization: true }),
  nikonLens("NIKKOR Z 70-200mm f/2.8 VR S II", [70, 200], "f/2.8", { stabilization: true }),
  nikonLens("NIKKOR Z 85mm f/1.2 S", [85, 85], "f/1.2"),
  nikonLens("NIKKOR Z 85mm f/1.8 S", [85, 85], "f/1.8"),
  nikonLens("NIKKOR Z MC 105mm f/2.8 VR S", [105, 105], "f/2.8", {
    stabilization: true,
    macro: true,
    lensClass: "macro",
  }),
  nikonLens("NIKKOR Z 100-400mm f/4.5-5.6 VR S", [100, 400], "f/4.5-5.6", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  nikonLens("NIKKOR Z 135mm f/1.8 S Plena", [135, 135], "f/1.8"),
  nikonLens("NIKKOR Z 180-600mm f/5.6-6.3 VR", [180, 600], "f/5.6-6.3", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  nikonLens("NIKKOR Z 400mm f/2.8 TC VR S", [400, 400], "f/2.8", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  nikonLens("NIKKOR Z 400mm f/4.5 VR S", [400, 400], "f/4.5", { stabilization: true, lensClass: "telephoto" }),
  nikonLens("NIKKOR Z 600mm f/4 TC VR S", [600, 600], "f/4", { stabilization: true, lensClass: "telephoto" }),
  nikonLens("NIKKOR Z 600mm f/6.3 VR S", [600, 600], "f/6.3", { stabilization: true, lensClass: "telephoto" }),
  nikonLens("NIKKOR Z 800mm f/6.3 VR S", [800, 800], "f/6.3", { stabilization: true, lensClass: "telephoto" }),
  nikonLens("NIKKOR Z DX 12-28mm f/3.5-5.6 PZ VR", [12, 28], "f/3.5-5.6", {
    coverage: "aps-c",
    stabilization: true,
  }),
  nikonLens("NIKKOR Z DX 16-50mm f/2.8 VR", [16, 50], "f/2.8", { coverage: "aps-c", stabilization: true }),
  nikonLens("NIKKOR Z DX 16-50mm f/3.5-6.3 VR", [16, 50], "f/3.5-6.3", {
    coverage: "aps-c",
    stabilization: true,
  }),
  nikonLens("NIKKOR Z DX 18-140mm f/3.5-6.3 VR", [18, 140], "f/3.5-6.3", {
    coverage: "aps-c",
    stabilization: true,
  }),
  nikonLens("NIKKOR Z DX 24mm f/1.7", [24, 24], "f/1.7", { coverage: "aps-c" }),
  nikonLens("NIKKOR Z DX MC 35mm f/1.7", [35, 35], "f/1.7", {
    coverage: "aps-c",
    macro: true,
    lensClass: "macro",
  }),
  nikonLens("NIKKOR Z DX 50-250mm f/4.5-6.3 VR", [50, 250], "f/4.5-6.3", {
    coverage: "aps-c",
    stabilization: true,
  }),
];

export const PHOTO_ENHANCER_FUJIFILM_X_GFX_LENS_PROFILES: PhotoEnhancerLensProfile[] = [
  fujiLens("XF8mmF3.5 R WR", [8, 8], "F3.5", { coverage: "aps-c" }),
  fujiLens("XF8-16mmF2.8 R LM WR", [8, 16], "F2.8", { coverage: "aps-c" }),
  fujiLens("XF10-24mmF4 R OIS WR", [10, 24], "F4", { coverage: "aps-c", stabilization: true }),
  fujiLens("XF14mmF2.8 R", [14, 14], "F2.8", { coverage: "aps-c" }),
  fujiLens("XF16mmF1.4 R WR", [16, 16], "F1.4", { coverage: "aps-c" }),
  fujiLens("XF16mmF2.8 R WR", [16, 16], "F2.8", { coverage: "aps-c" }),
  fujiLens("XF16-50mmF2.8-4.8 R LM WR", [16, 50], "F2.8-4.8", { coverage: "aps-c" }),
  fujiLens("XF16-55mmF2.8 R LM WR", [16, 55], "F2.8", { coverage: "aps-c" }),
  fujiLens("XF16-55mmF2.8 R LM WR II", [16, 55], "F2.8", { coverage: "aps-c" }),
  fujiLens("XF16-80mmF4 R OIS WR", [16, 80], "F4", { coverage: "aps-c", stabilization: true }),
  fujiLens("XF18mmF1.4 R LM WR", [18, 18], "F1.4", { coverage: "aps-c" }),
  fujiLens("XF18mmF2 R", [18, 18], "F2", { coverage: "aps-c" }),
  fujiLens("XF18-55mmF2.8-4 R LM OIS", [18, 55], "F2.8-4", { coverage: "aps-c", stabilization: true }),
  fujiLens("XF18-120mmF4 LM PZ WR", [18, 120], "F4", { coverage: "aps-c" }),
  fujiLens("XF18-135mmF3.5-5.6 R LM OIS WR", [18, 135], "F3.5-5.6", {
    coverage: "aps-c",
    stabilization: true,
  }),
  fujiLens("XF23mmF1.4 R LM WR", [23, 23], "F1.4", { coverage: "aps-c" }),
  fujiLens("XF23mmF2 R WR", [23, 23], "F2", { coverage: "aps-c" }),
  fujiLens("XF27mmF2.8 R WR", [27, 27], "F2.8", { coverage: "aps-c" }),
  fujiLens("XF30mmF2.8 R LM WR Macro", [30, 30], "F2.8", {
    coverage: "aps-c",
    macro: true,
    lensClass: "macro",
  }),
  fujiLens("XF33mmF1.4 R LM WR", [33, 33], "F1.4", { coverage: "aps-c" }),
  fujiLens("XF35mmF1.4 R", [35, 35], "F1.4", { coverage: "aps-c" }),
  fujiLens("XF35mmF2 R WR", [35, 35], "F2", { coverage: "aps-c" }),
  fujiLens("XF50mmF1.0 R WR", [50, 50], "F1.0", { coverage: "aps-c" }),
  fujiLens("XF50mmF2 R WR", [50, 50], "F2", { coverage: "aps-c" }),
  fujiLens("XF50-140mmF2.8 R LM OIS WR", [50, 140], "F2.8", { coverage: "aps-c", stabilization: true }),
  fujiLens("XF55-200mmF3.5-4.8 R LM OIS", [55, 200], "F3.5-4.8", { coverage: "aps-c", stabilization: true }),
  fujiLens("XF56mmF1.2 R WR", [56, 56], "F1.2", { coverage: "aps-c" }),
  fujiLens("XF60mmF2.4 R Macro", [60, 60], "F2.4", { coverage: "aps-c", macro: true, lensClass: "macro" }),
  fujiLens("XF70-300mmF4-5.6 R LM OIS WR", [70, 300], "F4-5.6", { coverage: "aps-c", stabilization: true }),
  fujiLens("XF80mmF2.8 R LM OIS WR Macro", [80, 80], "F2.8", {
    coverage: "aps-c",
    stabilization: true,
    macro: true,
    lensClass: "macro",
  }),
  fujiLens("XF90mmF2 R LM WR", [90, 90], "F2", { coverage: "aps-c" }),
  fujiLens("XF100-400mmF4.5-5.6 R LM OIS WR", [100, 400], "F4.5-5.6", {
    coverage: "aps-c",
    stabilization: true,
    lensClass: "telephoto",
  }),
  fujiLens("XF150-600mmF5.6-8 R LM OIS WR", [150, 600], "F5.6-8", {
    coverage: "aps-c",
    stabilization: true,
    lensClass: "telephoto",
  }),
  fujiLens("XF200mmF2 R LM OIS WR", [200, 200], "F2", {
    coverage: "aps-c",
    stabilization: true,
    lensClass: "telephoto",
  }),
  fujiLens("XC15-45mmF3.5-5.6 OIS PZ", [15, 45], "F3.5-5.6", { coverage: "aps-c", stabilization: true }),
  fujiLens("XC35mmF2", [35, 35], "F2", { coverage: "aps-c" }),
  fujiLens("XC50-230mmF4.5-6.7 OIS II", [50, 230], "F4.5-6.7", { coverage: "aps-c", stabilization: true }),
  fujiLens("GF20-35mmF4 R WR", [20, 35], "F4", { coverage: "medium-format" }),
  fujiLens("GF23mmF4 R LM WR", [23, 23], "F4", { coverage: "medium-format" }),
  fujiLens("GF30mmF3.5 R WR", [30, 30], "F3.5", { coverage: "medium-format" }),
  fujiLens("GF30mmF5.6 T/S", [30, 30], "F5.6", { coverage: "medium-format", correctionProfileStatus: "external-profile-needed" }),
  fujiLens("GF32-64mmF4 R LM WR", [32, 64], "F4", { coverage: "medium-format" }),
  fujiLens("GF35-70mmF4.5-5.6 WR", [35, 70], "F4.5-5.6", { coverage: "medium-format" }),
  fujiLens("GF45mmF2.8 R WR", [45, 45], "F2.8", { coverage: "medium-format" }),
  fujiLens("GF45-100mmF4 R LM OIS WR", [45, 100], "F4", { coverage: "medium-format", stabilization: true }),
  fujiLens("GF50mmF3.5 R LM WR", [50, 50], "F3.5", { coverage: "medium-format" }),
  fujiLens("GF55mmF1.7 R WR", [55, 55], "F1.7", { coverage: "medium-format" }),
  fujiLens("GF63mmF2.8 R WR", [63, 63], "F2.8", { coverage: "medium-format" }),
  fujiLens("GF80mmF1.7 R WR", [80, 80], "F1.7", { coverage: "medium-format" }),
  fujiLens("GF100-200mmF5.6 R LM OIS WR", [100, 200], "F5.6", {
    coverage: "medium-format",
    stabilization: true,
    lensClass: "telephoto",
  }),
  fujiLens("GF110mmF2 R LM WR", [110, 110], "F2", { coverage: "medium-format" }),
  fujiLens("GF110mmF5.6 T/S Macro", [110, 110], "F5.6", {
    coverage: "medium-format",
    macro: true,
    lensClass: "macro",
    correctionProfileStatus: "external-profile-needed",
  }),
  fujiLens("GF120mmF4 R LM OIS WR Macro", [120, 120], "F4", {
    coverage: "medium-format",
    stabilization: true,
    macro: true,
    lensClass: "macro",
  }),
  fujiLens("GF250mmF4 R LM OIS WR", [250, 250], "F4", {
    coverage: "medium-format",
    stabilization: true,
    lensClass: "telephoto",
  }),
  fujiLens("GF500mmF5.6 R LM OIS WR", [500, 500], "F5.6", {
    coverage: "medium-format",
    stabilization: true,
    lensClass: "telephoto",
  }),
];

export const PHOTO_ENHANCER_SIGMA_MIRRORLESS_LENS_PROFILES: PhotoEnhancerLensProfile[] = [
  sigmaLens("Canon RF-S", "Sigma 10-18mm F2.8 DC DN Contemporary", [10, 18], "F2.8", {
    coverage: "aps-c",
    aliases: ["SIGMA 10-18mm F2.8 DC DN | C"],
  }),
  sigmaLens("Canon RF-S", "Sigma 18-50mm F2.8 DC DN Contemporary", [18, 50], "F2.8", {
    coverage: "aps-c",
    aliases: ["SIGMA 18-50mm F2.8 DC DN | C"],
  }),
  sigmaLens("Canon RF-S", "Sigma 16mm F1.4 DC DN Contemporary", [16, 16], "F1.4", {
    coverage: "aps-c",
    aliases: ["SIGMA 16mm F1.4 DC DN | C"],
  }),
  sigmaLens("Canon RF-S", "Sigma 23mm F1.4 DC DN Contemporary", [23, 23], "F1.4", {
    coverage: "aps-c",
    aliases: ["SIGMA 23mm F1.4 DC DN | C"],
  }),
  sigmaLens("Canon RF-S", "Sigma 30mm F1.4 DC DN Contemporary", [30, 30], "F1.4", {
    coverage: "aps-c",
    aliases: ["SIGMA 30mm F1.4 DC DN | C"],
  }),
  sigmaLens("Canon RF-S", "Sigma 56mm F1.4 DC DN Contemporary", [56, 56], "F1.4", {
    coverage: "aps-c",
    aliases: ["SIGMA 56mm F1.4 DC DN | C"],
  }),
  sigmaLens("Sony E/FE", "Sigma 14mm F1.4 DG DN Art", [14, 14], "F1.4"),
  sigmaLens("Sony E/FE", "Sigma 15mm F1.4 DG DN Diagonal Fisheye Art", [15, 15], "F1.4", {
    lensClass: "fisheye",
  }),
  sigmaLens("Sony E/FE", "Sigma 16-28mm F2.8 DG DN Contemporary", [16, 28], "F2.8"),
  sigmaLens("Sony E/FE", "Sigma 17mm F4 DG DN Contemporary", [17, 17], "F4"),
  sigmaLens("Sony E/FE", "Sigma 20mm F1.4 DG DN Art", [20, 20], "F1.4"),
  sigmaLens("Sony E/FE", "Sigma 20mm F2 DG DN Contemporary", [20, 20], "F2"),
  sigmaLens("Sony E/FE", "Sigma 24mm F1.4 DG DN Art", [24, 24], "F1.4"),
  sigmaLens("Sony E/FE", "Sigma 24mm F2 DG DN Contemporary", [24, 24], "F2"),
  sigmaLens("Sony E/FE", "Sigma 24-70mm F2.8 DG DN Art", [24, 70], "F2.8"),
  sigmaLens("Sony E/FE", "Sigma 24-70mm F2.8 DG DN II Art", [24, 70], "F2.8"),
  sigmaLens("Sony E/FE", "Sigma 28-45mm F1.8 DG DN Art", [28, 45], "F1.8"),
  sigmaLens("Sony E/FE", "Sigma 28-70mm F2.8 DG DN Contemporary", [28, 70], "F2.8"),
  sigmaLens("Sony E/FE", "Sigma 28-105mm F2.8 DG DN Art", [28, 105], "F2.8"),
  sigmaLens("Sony E/FE", "Sigma 35mm F1.2 DG DN Art", [35, 35], "F1.2"),
  sigmaLens("Sony E/FE", "Sigma 35mm F1.4 DG DN Art", [35, 35], "F1.4"),
  sigmaLens("Sony E/FE", "Sigma 35mm F2 DG DN Contemporary", [35, 35], "F2"),
  sigmaLens("Sony E/FE", "Sigma 45mm F2.8 DG DN Contemporary", [45, 45], "F2.8"),
  sigmaLens("Sony E/FE", "Sigma 50mm F1.2 DG DN Art", [50, 50], "F1.2"),
  sigmaLens("Sony E/FE", "Sigma 50mm F1.4 DG DN Art", [50, 50], "F1.4"),
  sigmaLens("Sony E/FE", "Sigma 50mm F2 DG DN Contemporary", [50, 50], "F2"),
  sigmaLens("Sony E/FE", "Sigma 65mm F2 DG DN Contemporary", [65, 65], "F2"),
  sigmaLens("Sony E/FE", "Sigma 85mm F1.4 DG DN Art", [85, 85], "F1.4"),
  sigmaLens("Sony E/FE", "Sigma 90mm F2.8 DG DN Contemporary", [90, 90], "F2.8"),
  sigmaLens("Sony E/FE", "Sigma 105mm F2.8 DG DN Macro Art", [105, 105], "F2.8", {
    macro: true,
    lensClass: "macro",
  }),
  sigmaLens("Sony E/FE", "Sigma 135mm F1.4 DG Art", [135, 135], "F1.4"),
  sigmaLens("Sony E/FE", "Sigma 100-400mm F5-6.3 DG DN OS Contemporary", [100, 400], "F5-6.3", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  sigmaLens("Sony E/FE", "Sigma 150-600mm F5-6.3 DG DN OS Sports", [150, 600], "F5-6.3", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  sigmaLens("Sony E/FE", "Sigma 60-600mm F4.5-6.3 DG DN OS Sports", [60, 600], "F4.5-6.3", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  sigmaLens("Sony E/FE", "Sigma 500mm F5.6 DG DN OS Sports", [500, 500], "F5.6", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  sigmaLens("Sony E", "Sigma 10-18mm F2.8 DC DN Contemporary", [10, 18], "F2.8", { coverage: "aps-c" }),
  sigmaLens("Sony E", "Sigma 15mm F1.4 DC DN Contemporary", [15, 15], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Sony E", "Sigma 16mm F1.4 DC DN Contemporary", [16, 16], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Sony E", "Sigma 17-40mm F1.8 DC Art", [17, 40], "F1.8", { coverage: "aps-c" }),
  sigmaLens("Sony E", "Sigma 18-50mm F2.8 DC DN Contemporary", [18, 50], "F2.8", { coverage: "aps-c" }),
  sigmaLens("Sony E", "Sigma 23mm F1.4 DC DN Contemporary", [23, 23], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Sony E", "Sigma 30mm F1.4 DC DN Contemporary", [30, 30], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Sony E", "Sigma 56mm F1.4 DC DN Contemporary", [56, 56], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Fujifilm X", "Sigma 10-18mm F2.8 DC DN Contemporary", [10, 18], "F2.8", { coverage: "aps-c" }),
  sigmaLens("Fujifilm X", "Sigma 16mm F1.4 DC DN Contemporary", [16, 16], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Fujifilm X", "Sigma 18-50mm F2.8 DC DN Contemporary", [18, 50], "F2.8", { coverage: "aps-c" }),
  sigmaLens("Fujifilm X", "Sigma 23mm F1.4 DC DN Contemporary", [23, 23], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Fujifilm X", "Sigma 30mm F1.4 DC DN Contemporary", [30, 30], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Fujifilm X", "Sigma 56mm F1.4 DC DN Contemporary", [56, 56], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Nikon Z", "Sigma 16mm F1.4 DC DN Contemporary", [16, 16], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Nikon Z", "Sigma 18-50mm F2.8 DC DN Contemporary", [18, 50], "F2.8", { coverage: "aps-c" }),
  sigmaLens("Nikon Z", "Sigma 23mm F1.4 DC DN Contemporary", [23, 23], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Nikon Z", "Sigma 30mm F1.4 DC DN Contemporary", [30, 30], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Nikon Z", "Sigma 56mm F1.4 DC DN Contemporary", [56, 56], "F1.4", { coverage: "aps-c" }),
  sigmaLens("L-Mount", "Sigma 14mm F1.4 DG DN Art", [14, 14], "F1.4"),
  sigmaLens("L-Mount", "Sigma 16-28mm F2.8 DG DN Contemporary", [16, 28], "F2.8"),
  sigmaLens("L-Mount", "Sigma 24-70mm F2.8 DG DN II Art", [24, 70], "F2.8"),
  sigmaLens("L-Mount", "Sigma 28-45mm F1.8 DG DN Art", [28, 45], "F1.8"),
  sigmaLens("L-Mount", "Sigma 28-105mm F2.8 DG DN Art", [28, 105], "F2.8"),
  sigmaLens("L-Mount", "Sigma 50mm F1.2 DG DN Art", [50, 50], "F1.2"),
  sigmaLens("L-Mount", "Sigma 85mm F1.4 DG DN Art", [85, 85], "F1.4"),
  sigmaLens("L-Mount", "Sigma 105mm F2.8 DG DN Macro Art", [105, 105], "F2.8", {
    macro: true,
    lensClass: "macro",
  }),
  sigmaLens("L-Mount", "Sigma 150-600mm F5-6.3 DG DN OS Sports", [150, 600], "F5-6.3", {
    stabilization: true,
    lensClass: "telephoto",
  }),
  sigmaLens("Micro Four Thirds", "Sigma 16mm F1.4 DC DN Contemporary", [16, 16], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Micro Four Thirds", "Sigma 30mm F1.4 DC DN Contemporary", [30, 30], "F1.4", { coverage: "aps-c" }),
  sigmaLens("Micro Four Thirds", "Sigma 56mm F1.4 DC DN Contemporary", [56, 56], "F1.4", { coverage: "aps-c" }),
];

export const PHOTO_ENHANCER_NATIVE_MIRRORLESS_LENS_PROFILES: PhotoEnhancerLensProfile[] = [
  ...PHOTO_ENHANCER_CANON_RF_LENS_PROFILES,
  ...PHOTO_ENHANCER_SONY_E_LENS_PROFILES,
  ...PHOTO_ENHANCER_NIKON_Z_LENS_PROFILES,
  ...PHOTO_ENHANCER_FUJIFILM_X_GFX_LENS_PROFILES,
  ...PHOTO_ENHANCER_SIGMA_MIRRORLESS_LENS_PROFILES,
];

export const PHOTO_ENHANCER_MIRRORLESS_PROFILE_FAMILIES: PhotoEnhancerMirrorlessProfileFamily[] = [
  {
    id: "canon-rf",
    brand: "Canon",
    mount: "RF/RF-S",
    lensFamilies: ["Canon RF", "Canon RF-S", "Canon CN-R", "Sigma DC DN RF-S", "Tamron Di III RF-S"],
    profileStrategy: "metadata-match-first",
    notes: "Canon RF/RF-S has an explicit in-app registry; optical correction should prefer embedded RAW metadata or Lensfun/LCP when present.",
  },
  {
    id: "sony-e",
    brand: "Sony",
    mount: "E/FE",
    lensFamilies: ["Sony FE", "Sony E", "G Master", "G", "Zeiss ZA", "Sigma DG DN", "Sigma DC DN", "Tamron Di III", "Samyang AF"],
    profileStrategy: "vendor-embedded-first",
    notes: "Sony mirrorless files often carry vendor correction metadata; external profiles are still needed for non-native and older lenses.",
  },
  {
    id: "nikon-z",
    brand: "Nikon",
    mount: "Z",
    lensFamilies: ["NIKKOR Z", "NIKKOR Z DX", "S-Line", "NIKKOR Z Power Zoom", "Tamron Z", "Sigma DC DN Z"],
    profileStrategy: "vendor-embedded-first",
    notes: "Nikon Z RAW files commonly include correction metadata; preserve it and expose missing external profiles as warnings.",
  },
  {
    id: "fujifilm-x-gfx",
    brand: "Fujifilm",
    mount: "X/GFX",
    lensFamilies: ["XF", "XC", "GF", "Sigma DC DN X", "Tamron Di III X", "Viltrox AF X"],
    profileStrategy: "vendor-embedded-first",
    notes: "Fujifilm X/GFX lens corrections are frequently embedded and should be preserved through RAW conversion.",
  },
  {
    id: "l-mount",
    brand: "L-Mount Alliance",
    mount: "L",
    lensFamilies: ["Leica SL", "Panasonic Lumix S", "Sigma DG DN", "Sigma I Series"],
    profileStrategy: "lensfun-or-lcp-import",
    notes: "L-Mount contains multiple vendors; match by EXIF lens string and fall back to Lensfun/LCP import.",
  },
  {
    id: "micro-four-thirds",
    brand: "Micro Four Thirds",
    mount: "MFT",
    lensFamilies: ["OM System M.Zuiko", "Olympus M.Zuiko", "Panasonic Lumix G", "Leica DG", "Sigma DC DN MFT"],
    profileStrategy: "vendor-embedded-first",
    notes: "MFT corrections are often embedded; keep ICC and maker-note metadata where converters allow it.",
  },
  {
    id: "hasselblad-xcd",
    brand: "Hasselblad",
    mount: "XCD",
    lensFamilies: ["XCD", "XCD V"],
    profileStrategy: "vendor-embedded-first",
    notes: "Medium-format mirrorless files should preserve embedded ICC and lens correction metadata before export.",
  },
];

const PHOTO_ENHANCER_CAMERA_PROFILE_SEEDS: PhotoEnhancerCameraProfile[] = [
  cameraProfile("Canon", "Canon RF", "Canon EOS R", "full-frame", [".cr3", ".cr2"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS RP", "full-frame", [".cr3", ".cr2"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R3", "full-frame", [".cr3"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R5", "full-frame", [".cr3"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R5 Mark II", "full-frame", [".cr3"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R6", "full-frame", [".cr3"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R6 Mark II", "full-frame", [".cr3"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R6 Mark III", "full-frame", [".cr3"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R7", "aps-c", [".cr3"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R8", "full-frame", [".cr3"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R10", "aps-c", [".cr3"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R50", "aps-c", [".cr3"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R50 V", "aps-c", [".cr3"]),
  cameraProfile("Canon", "Canon RF", "Canon EOS R100", "aps-c", [".cr3"]),
  cameraProfile("Sony", "Sony E", "Sony ILCE", "full-frame", [".arw"]),
  cameraProfile("Nikon", "Nikon Z", "NIKON Z", "full-frame", [".nef", ".nrw"]),
  cameraProfile("Fujifilm", "Fujifilm X/GFX", "FUJIFILM", "unknown", [".raf"]),
  cameraProfile("Panasonic", "L-Mount/MFT", "Panasonic", "unknown", [".rw2"]),
  cameraProfile("OM System", "Micro Four Thirds", "OM SYSTEM", "micro-four-thirds", [".orf"]),
];

function cameraProfile(
  brand: string,
  mount: string,
  name: string,
  sensor: PhotoEnhancerCameraProfile["sensor"],
  rawFormats: string[],
): PhotoEnhancerCameraProfile {
  return {
    id: `${slugify(brand)}-${slugify(name)}`,
    brand,
    mount,
    name,
    aliases: [name],
    sensor,
    rawFormats,
    colorPolicy: "preserve-embedded-icc",
    source: "exif-match",
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeToken(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\bcanon\b/g, "")
    .replace(/\blens\b/g, "")
    .replace(/f\//g, "f")
    .replace(/[^a-z0-9.]+/g, "");
}

function readStringFromRecord(record: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNumberFromRecord(record: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  const value = readStringFromRecord(record, keys);
  if (!value) return null;
  const match = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePhotoEnhancerExif(record: Record<string, unknown> | null | undefined): PhotoEnhancerNormalizedExif {
  return {
    make: readStringFromRecord(record, ["Make"]),
    model: readStringFromRecord(record, ["Model", "CameraModelName"]),
    lensModel: readStringFromRecord(record, ["LensModel", "Lens", "LensID", "LensInfo"]),
    lensId: readStringFromRecord(record, ["LensID"]),
    lensSerialNumber: readStringFromRecord(record, ["LensSerialNumber", "LensSerial"]),
    bodySerialNumber: readStringFromRecord(record, ["BodySerialNumber", "InternalSerialNumber"]),
    serialNumber: readStringFromRecord(record, ["SerialNumber"]),
    focalLengthMm: readNumberFromRecord(record, ["FocalLength"]),
    focalLength35mmMm: readNumberFromRecord(record, ["FocalLengthIn35mmFormat", "FocalLength35efl"]),
    iso: readNumberFromRecord(record, ["ISO"]),
    exposureTime: readStringFromRecord(record, ["ExposureTime"]),
    fNumber: readNumberFromRecord(record, ["FNumber"]),
    apertureValue: readStringFromRecord(record, ["ApertureValue"]),
    shutterSpeedValue: readStringFromRecord(record, ["ShutterSpeedValue"]),
    exposureCompensation: readStringFromRecord(record, ["ExposureCompensation", "ExposureCompensationValue"]),
    exposureProgram: readStringFromRecord(record, ["ExposureProgram"]),
    meteringMode: readStringFromRecord(record, ["MeteringMode"]),
    flash: readStringFromRecord(record, ["Flash"]),
    whiteBalance: readStringFromRecord(record, ["WhiteBalance"]),
    colorSpace: readStringFromRecord(record, ["ColorSpace"]),
    iccProfile: readStringFromRecord(record, ["ProfileDescription", "ICC_Profile:ProfileDescription", "ICCProfileName"]),
    bitsPerSample: readStringFromRecord(record, ["BitsPerSample"]),
    colorComponents: readNumberFromRecord(record, ["ColorComponents"]),
    orientation: readStringFromRecord(record, ["Orientation"]),
    imageWidth: readNumberFromRecord(record, ["ImageWidth", "ExifImageWidth"]),
    imageHeight: readNumberFromRecord(record, ["ImageHeight", "ExifImageHeight"]),
    copyright: readStringFromRecord(record, ["Copyright", "CopyrightNotice", "Rights"]),
    artist: readStringFromRecord(record, ["Artist", "By-line"]),
    creator: readStringFromRecord(record, ["Creator", "XMP:Creator"]),
    credit: readStringFromRecord(record, ["Credit", "IPTC:Credit", "photoshop:Credit"]),
    ownerName: readStringFromRecord(record, ["OwnerName"]),
    title: readStringFromRecord(record, ["Title", "XMP:Title"]),
    description: readStringFromRecord(record, ["Description", "Caption-Abstract", "XMP:Description"]),
    usageTerms: readStringFromRecord(record, ["UsageTerms", "XMP:UsageTerms"]),
    fileType: readStringFromRecord(record, ["FileType"]),
    mimeType: readStringFromRecord(record, ["MIMEType"]),
  };
}

export function matchPhotoEnhancerLensProfile(
  lensModel: string | null | undefined,
  cameraMount: string | null | undefined = null,
): PhotoEnhancerLensProfile | null {
  const token = normalizeToken(lensModel);
  if (!token) return null;
  const mountToken = normalizeToken(cameraMount);
  const matches = PHOTO_ENHANCER_NATIVE_MIRRORLESS_LENS_PROFILES
    .filter((profile) => {
      const candidates = [profile.name, ...profile.aliases];
      return candidates.some((candidate) => {
        const candidateToken = normalizeToken(candidate);
        return candidateToken === token || token.includes(candidateToken) || candidateToken.includes(token);
      });
    })
    .sort((left, right) => {
      const leftMount = mountToken && normalizeToken(left.mount).includes(mountToken) ? 1 : 0;
      const rightMount = mountToken && normalizeToken(right.mount).includes(mountToken) ? 1 : 0;
      if (leftMount !== rightMount) return rightMount - leftMount;
      return normalizeToken(right.name).length - normalizeToken(left.name).length;
    });
  return matches[0] || null;
}

export function matchPhotoEnhancerCameraProfile(
  make: string | null | undefined,
  model: string | null | undefined,
): PhotoEnhancerCameraProfile | null {
  const makeToken = normalizeToken(make);
  const modelToken = normalizeToken(model);
  if (!modelToken) return null;
  const matches = PHOTO_ENHANCER_CAMERA_PROFILE_SEEDS
    .filter((profile) => {
      const brandToken = normalizeToken(profile.brand);
      const nameToken = normalizeToken(profile.name);
      const aliasMatch = profile.aliases.some((alias) => modelToken.includes(normalizeToken(alias)));
      return (
        (makeToken.includes(brandToken) || brandToken.includes(makeToken) || !makeToken) &&
        (modelToken.includes(nameToken) || aliasMatch)
      );
    })
    .sort((left, right) => normalizeToken(right.name).length - normalizeToken(left.name).length);
  return matches[0] || null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function extractXmlText(xml: string, tag: string): string | null {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const match = xml.match(pattern);
  if (!match?.[1]) return null;
  const liMatch = match[1].match(/<rdf:li(?:\s[^>]*)?>([\s\S]*?)<\/rdf:li>/i);
  const value = liMatch?.[1] || match[1];
  return decodeXml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) || null;
}

function extractXmlAttribute(xml: string, attribute: string): string | null {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}=["']([^"']+)["']`, "i");
  const match = xml.match(pattern);
  return match?.[1] ? decodeXml(match[1].trim()) : null;
}

function extractXmlList(xml: string, tag: string): string[] {
  const text = extractXmlText(xml, tag);
  if (!text) return [];
  return text
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parsePhotoEnhancerXmpSidecar(value: unknown): PhotoEnhancerXmpSidecarMetadata {
  const xml = typeof value === "string" ? value.trim() : "";
  if (!xml) {
    return {
      provided: false,
      byteLength: 0,
      rating: null,
      label: null,
      title: null,
      description: null,
      creators: [],
      rights: null,
      usageTerms: null,
      credit: null,
      source: null,
      clientName: null,
      subjects: [],
      fieldsFound: [],
    };
  }

  const metadata: PhotoEnhancerXmpSidecarMetadata = {
    provided: true,
    byteLength: Buffer.byteLength(xml),
    rating: extractXmlAttribute(xml, "xmp:Rating") || extractXmlText(xml, "xmp:Rating"),
    label: extractXmlAttribute(xml, "xmp:Label") || extractXmlText(xml, "xmp:Label"),
    title: extractXmlText(xml, "dc:title"),
    description: extractXmlText(xml, "dc:description"),
    creators: extractXmlList(xml, "dc:creator"),
    rights: extractXmlText(xml, "dc:rights") || extractXmlText(xml, "xmpRights:UsageTerms"),
    usageTerms: extractXmlText(xml, "xmpRights:UsageTerms"),
    credit: extractXmlAttribute(xml, "photoshop:Credit") || extractXmlText(xml, "photoshop:Credit"),
    source: extractXmlAttribute(xml, "photoshop:Source") || extractXmlText(xml, "photoshop:Source"),
    clientName:
      extractXmlAttribute(xml, "creatorhub:ClientName") ||
      extractXmlText(xml, "creatorhub:ClientName") ||
      extractXmlAttribute(xml, "photoshop:Source") ||
      null,
    subjects: extractXmlList(xml, "dc:subject").concat(extractXmlList(xml, "lr:hierarchicalSubject")),
    fieldsFound: [],
  };

  metadata.fieldsFound = Object.entries(metadata)
    .filter(([key, fieldValue]) => key !== "provided" && key !== "byteLength" && key !== "fieldsFound" && (Array.isArray(fieldValue) ? fieldValue.length > 0 : Boolean(fieldValue)))
    .map(([key]) => key);
  return metadata;
}

export function buildPhotoEnhancerProfileRegistrySummary() {
  const canonRfProfiles = PHOTO_ENHANCER_CANON_RF_LENS_PROFILES;
  const nativeMirrorlessProfiles = PHOTO_ENHANCER_NATIVE_MIRRORLESS_LENS_PROFILES;
  const byCoverage = canonRfProfiles.reduce<Record<string, number>>((acc, profile) => {
    acc[profile.coverage] = (acc[profile.coverage] || 0) + 1;
    return acc;
  }, {});
  const nativeByBrand = nativeMirrorlessProfiles.reduce<Record<string, number>>((acc, profile) => {
    acc[profile.brand] = (acc[profile.brand] || 0) + 1;
    return acc;
  }, {});
  const nativeByMount = nativeMirrorlessProfiles.reduce<Record<string, number>>((acc, profile) => {
    acc[profile.mount] = (acc[profile.mount] || 0) + 1;
    return acc;
  }, {});
  return {
    sourceRevision: "2026-04-12",
    lensCorrectionSourcePolicy: {
      primary: "camera-vendor-embedded-metadata",
      secondary: "Lensfun or Adobe LCP import when available",
      missingProfileAction: "warn-and-preserve-original-metadata",
    },
    canonRf: {
      total: canonRfProfiles.length,
      byCoverage,
      profiles: canonRfProfiles,
    },
    nativeMirrorless: {
      total: nativeMirrorlessProfiles.length,
      byBrand: nativeByBrand,
      byMount: nativeByMount,
      profiles: nativeMirrorlessProfiles,
    },
    sonyE: {
      total: PHOTO_ENHANCER_SONY_E_LENS_PROFILES.length,
      profiles: PHOTO_ENHANCER_SONY_E_LENS_PROFILES,
    },
    nikonZ: {
      total: PHOTO_ENHANCER_NIKON_Z_LENS_PROFILES.length,
      profiles: PHOTO_ENHANCER_NIKON_Z_LENS_PROFILES,
    },
    fujifilmXGfx: {
      total: PHOTO_ENHANCER_FUJIFILM_X_GFX_LENS_PROFILES.length,
      profiles: PHOTO_ENHANCER_FUJIFILM_X_GFX_LENS_PROFILES,
    },
    sigmaMirrorless: {
      total: PHOTO_ENHANCER_SIGMA_MIRRORLESS_LENS_PROFILES.length,
      profiles: PHOTO_ENHANCER_SIGMA_MIRRORLESS_LENS_PROFILES,
    },
    mirrorlessFamilies: PHOTO_ENHANCER_MIRRORLESS_PROFILE_FAMILIES,
    cameraProfiles: PHOTO_ENHANCER_CAMERA_PROFILE_SEEDS,
  };
}
