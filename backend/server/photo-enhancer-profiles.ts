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
  source: "canon-rf-lineup-2026-04" | "canon-product-page-2026-04" | "canon-eos-r-brochure-2026-04";
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

export function matchPhotoEnhancerLensProfile(lensModel: string | null | undefined): PhotoEnhancerLensProfile | null {
  const token = normalizeToken(lensModel);
  if (!token) return null;
  return (
    PHOTO_ENHANCER_CANON_RF_LENS_PROFILES.find((profile) => {
      const candidates = [profile.name, ...profile.aliases];
      return candidates.some((candidate) => {
        const candidateToken = normalizeToken(candidate);
        return candidateToken === token || token.includes(candidateToken) || candidateToken.includes(token);
      });
    }) || null
  );
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
  const byCoverage = canonRfProfiles.reduce<Record<string, number>>((acc, profile) => {
    acc[profile.coverage] = (acc[profile.coverage] || 0) + 1;
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
    mirrorlessFamilies: PHOTO_ENHANCER_MIRRORLESS_PROFILE_FAMILIES,
    cameraProfiles: PHOTO_ENHANCER_CAMERA_PROFILE_SEEDS,
  };
}
