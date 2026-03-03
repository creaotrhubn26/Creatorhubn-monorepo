/**
 * Photo Camera Database
 * Clean, validated seed data used as frontend fallback.
 */

import { z } from 'zod';

export type PhotoCameraCategory =
  | 'dslr'
  | 'mirrorless'
  | 'medium-format'
  | 'point-and-shoot'
  | 'instant'
  | 'film'
  | 'action'
  | 'phone';

export type CameraPriceRange = 'budget' | 'mid-range' | 'professional' | 'cinema';

export type CameraSource = 'manual' | 'api' | 'discovery' | 'seed';

export interface PhotoCamera {
  id: string;
  externalId: string;
  source: CameraSource;
  lastSeenAt: string;
  isDeprecated: boolean;

  brand: string;
  model: string;
  category: PhotoCameraCategory;
  priceRange: CameraPriceRange;
  description: string;
  features: string[];
  isPhotoOptimized: boolean;
  isVideoOptimized: boolean;

  megapixels: number;
  sensorSize: string;
  isoRange: string;
  shutterSpeed: string;
  burstMode: string;
  autofocusPoints: number;
  imageStabilization: boolean;
  weatherSealing: boolean;
  batteryLife: string;

  videoResolution?: string[];
  videoFrameRates?: string[];
  videoCodecs?: string[];
  logFormats?: string[];

  mount: string;
  weight: string;
  dimensions: string;
  releaseDate: string;
  colorSpace?: string[];

  addedDate?: string;
  lastUpdated?: string;
  isNew?: boolean;
  isRecentlyUpdated?: boolean;
  version?: number;
}

const PHOTO_CATEGORY_VALUES: PhotoCameraCategory[] = [
  'dslr',
  'mirrorless',
  'medium-format',
  'point-and-shoot',
  'instant',
  'film',
  'action',
  'phone',
];

const PHOTO_PRICE_RANGE_VALUES: CameraPriceRange[] = [
  'budget',
  'mid-range',
  'professional',
  'cinema',
];

const CAMERA_SOURCE_VALUES: CameraSource[] = ['manual', 'api', 'discovery', 'seed'];

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const isSupportedReleaseYear = (value: string): boolean => {
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isInteger(year) && year >= 2020 && year <= 2026;
};

const photoCameraSchema = z.object({
  id: z.string().min(1),
  externalId: z.string().min(1),
  source: z.enum(CAMERA_SOURCE_VALUES),
  lastSeenAt: z.string().datetime(),
  isDeprecated: z.boolean(),
  brand: z.string().min(1),
  model: z.string().min(1),
  category: z.enum(PHOTO_CATEGORY_VALUES),
  priceRange: z.enum(PHOTO_PRICE_RANGE_VALUES),
  description: z.string().min(1),
  features: z.array(z.string().min(1)).min(1),
  isPhotoOptimized: z.boolean(),
  isVideoOptimized: z.boolean(),
  megapixels: z.number().positive(),
  sensorSize: z.string().min(1),
  isoRange: z.string().min(1),
  shutterSpeed: z.string().min(1),
  burstMode: z.string().min(1),
  autofocusPoints: z.number().int().nonnegative(),
  imageStabilization: z.boolean(),
  weatherSealing: z.boolean(),
  batteryLife: z.string().min(1),
  videoResolution: z.array(z.string().min(1)).optional(),
  videoFrameRates: z.array(z.string().min(1)).optional(),
  videoCodecs: z.array(z.string().min(1)).optional(),
  logFormats: z.array(z.string().min(1)).optional(),
  mount: z.string().min(1),
  weight: z.string().min(1),
  dimensions: z.string().min(1),
  releaseDate: z
    .string()
    .regex(isoDateRegex)
    .refine(isSupportedReleaseYear, 'releaseDate must be between 2020 and 2026'),
  colorSpace: z.array(z.string().min(1)).optional(),
  addedDate: z.string().datetime().optional(),
  lastUpdated: z.string().datetime().optional(),
  isNew: z.boolean().optional(),
  isRecentlyUpdated: z.boolean().optional(),
  version: z.number().int().positive().optional(),
});

const normalizeId = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const seedPhotoCameras: PhotoCamera[] = [
  {
    id: 'sony-a7r-v-photo',
    externalId: 'sony:a7r-v',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Sony',
    model: 'A7R V',
    category: 'mirrorless',
    priceRange: 'professional',
    description: 'High-resolution full-frame hybrid camera for commercial photo work.',
    features: ['61MP sensor', '8K video', '5-axis IBIS', 'Real-time AF'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 61,
    sensorSize: 'Full Frame',
    isoRange: '100-32000',
    shutterSpeed: '1/8000-30s',
    burstMode: '10 fps',
    autofocusPoints: 693,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '530 shots',
    videoResolution: ['8K', '4K', '1080p'],
    videoFrameRates: ['24fps', '30fps', '60fps'],
    videoCodecs: ['XAVC S-I', 'XAVC HS'],
    logFormats: ['S-Log3'],
    mount: 'Sony E',
    weight: '723 g',
    dimensions: '131.3 x 96.9 x 82.4 mm',
    releaseDate: '2022-10-26',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'sony-a7-iv-photo',
    externalId: 'sony:a7-iv',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Sony',
    model: 'A7 IV',
    category: 'mirrorless',
    priceRange: 'professional',
    description: 'Balanced full-frame body for event and portrait production.',
    features: ['33MP sensor', '4K60', 'Dual slot', 'Fast AF'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 33,
    sensorSize: 'Full Frame',
    isoRange: '100-51200',
    shutterSpeed: '1/8000-30s',
    burstMode: '10 fps',
    autofocusPoints: 759,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '580 shots',
    videoResolution: ['4K', '1080p'],
    videoFrameRates: ['24fps', '30fps', '60fps'],
    videoCodecs: ['XAVC S', 'XAVC HS'],
    logFormats: ['S-Log3'],
    mount: 'Sony E',
    weight: '658 g',
    dimensions: '131.3 x 96.4 x 79.8 mm',
    releaseDate: '2021-12-23',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'sony-a6700-photo',
    externalId: 'sony:a6700',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Sony',
    model: 'A6700',
    category: 'mirrorless',
    priceRange: 'mid-range',
    description: 'APS-C all-rounder for travel and social content workflows.',
    features: ['26MP APS-C', '4K120', 'AI AF'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 26,
    sensorSize: 'APS-C',
    isoRange: '100-32000',
    shutterSpeed: '1/8000-30s',
    burstMode: '11 fps',
    autofocusPoints: 759,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '570 shots',
    videoResolution: ['4K', '1080p'],
    videoFrameRates: ['24fps', '30fps', '60fps', '120fps'],
    videoCodecs: ['XAVC S-I', 'XAVC HS'],
    logFormats: ['S-Log3'],
    mount: 'Sony E',
    weight: '493 g',
    dimensions: '122.0 x 69.0 x 75.1 mm',
    releaseDate: '2023-07-12',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'canon-eos-r5-ii-photo',
    externalId: 'canon:eos-r5-mark-ii',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Canon',
    model: 'EOS R5 Mark II',
    category: 'mirrorless',
    priceRange: 'professional',
    description: 'Flagship Canon hybrid for high-end stills and premium video.',
    features: ['45MP sensor', '8K video', 'Dual Pixel AF II'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 45,
    sensorSize: 'Full Frame',
    isoRange: '100-51200',
    shutterSpeed: '1/8000-30s',
    burstMode: '20 fps',
    autofocusPoints: 1053,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '490 shots',
    videoResolution: ['8K', '4K', '1080p'],
    videoFrameRates: ['24fps', '30fps', '60fps', '120fps'],
    videoCodecs: ['H.265', 'RAW'],
    logFormats: ['C-Log3'],
    mount: 'Canon RF',
    weight: '746 g',
    dimensions: '138.5 x 101.2 x 93.5 mm',
    releaseDate: '2024-07-17',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'canon-eos-r6-ii-photo',
    externalId: 'canon:eos-r6-mark-ii',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Canon',
    model: 'EOS R6 Mark II',
    category: 'mirrorless',
    priceRange: 'professional',
    description: 'Fast full-frame event camera with reliable autofocus tracking.',
    features: ['24MP sensor', '4K60', 'Strong AF tracking'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 24,
    sensorSize: 'Full Frame',
    isoRange: '100-102400',
    shutterSpeed: '1/8000-30s',
    burstMode: '40 fps (electronic)',
    autofocusPoints: 1053,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '580 shots',
    videoResolution: ['4K', '1080p'],
    videoFrameRates: ['24fps', '30fps', '60fps', '120fps'],
    videoCodecs: ['H.264', 'H.265'],
    logFormats: ['C-Log3'],
    mount: 'Canon RF',
    weight: '670 g',
    dimensions: '138.4 x 98.4 x 88.4 mm',
    releaseDate: '2022-11-02',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'nikon-z8-photo',
    externalId: 'nikon:z8',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Nikon',
    model: 'Z8',
    category: 'mirrorless',
    priceRange: 'professional',
    description: 'Flagship Nikon body in compact form for pro stills workflows.',
    features: ['45.7MP sensor', '8K video', '9-axis sync IS'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 45.7,
    sensorSize: 'Full Frame',
    isoRange: '64-25600',
    shutterSpeed: '1/8000-30s',
    burstMode: '20 fps RAW',
    autofocusPoints: 493,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '340 shots',
    videoResolution: ['8K', '4K', '1080p'],
    videoFrameRates: ['24fps', '30fps', '60fps', '120fps'],
    videoCodecs: ['ProRes 422 HQ', 'N-RAW'],
    logFormats: ['N-Log'],
    mount: 'Nikon Z',
    weight: '910 g',
    dimensions: '144 x 118.5 x 83 mm',
    releaseDate: '2023-05-10',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'nikon-z6-iii-photo',
    externalId: 'nikon:z6-iii',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Nikon',
    model: 'Z6 III',
    category: 'mirrorless',
    priceRange: 'professional',
    description: 'Fast hybrid Nikon full-frame body for events and documentary.',
    features: ['24.5MP sensor', '6K RAW', 'Excellent AF'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 24.5,
    sensorSize: 'Full Frame',
    isoRange: '100-64000',
    shutterSpeed: '1/8000-30s',
    burstMode: '20 fps RAW',
    autofocusPoints: 273,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '410 shots',
    videoResolution: ['6K', '4K', '1080p'],
    videoFrameRates: ['24fps', '30fps', '60fps', '120fps'],
    videoCodecs: ['N-RAW', 'H.265'],
    logFormats: ['N-Log'],
    mount: 'Nikon Z',
    weight: '760 g',
    dimensions: '138.5 x 101.5 x 74 mm',
    releaseDate: '2024-06-17',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'fujifilm-gfx100-ii-photo',
    externalId: 'fujifilm:gfx100-ii',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Fujifilm',
    model: 'GFX100 II',
    category: 'medium-format',
    priceRange: 'cinema',
    description: 'Medium format high-resolution platform for campaign stills.',
    features: ['102MP sensor', '16-bit RAW', '5-axis IBIS'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 102,
    sensorSize: 'Medium Format',
    isoRange: '80-12800',
    shutterSpeed: '1/4000-3600s',
    burstMode: '8 fps',
    autofocusPoints: 425,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '540 shots',
    videoResolution: ['8K', '4K'],
    videoFrameRates: ['24fps', '30fps'],
    videoCodecs: ['ProRes', 'H.265'],
    logFormats: ['F-Log2'],
    mount: 'Fujifilm G',
    weight: '1030 g',
    dimensions: '152.4 x 117.4 x 98.6 mm',
    releaseDate: '2023-09-12',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'fujifilm-xh2-photo',
    externalId: 'fujifilm:x-h2',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Fujifilm',
    model: 'X-H2',
    category: 'mirrorless',
    priceRange: 'mid-range',
    description: 'High-resolution APS-C camera for hybrid creators.',
    features: ['40MP APS-C', '8K video', 'Film simulations'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 40,
    sensorSize: 'APS-C',
    isoRange: '125-12800',
    shutterSpeed: '1/8000-3600s',
    burstMode: '15 fps',
    autofocusPoints: 425,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '580 shots',
    videoResolution: ['8K', '4K', '1080p'],
    videoFrameRates: ['24fps', '30fps', '60fps'],
    videoCodecs: ['ProRes', 'H.265'],
    logFormats: ['F-Log2'],
    mount: 'Fujifilm X',
    weight: '660 g',
    dimensions: '136.3 x 92.9 x 84.6 mm',
    releaseDate: '2022-09-08',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'panasonic-s5-ii-photo',
    externalId: 'panasonic:s5-ii',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Panasonic',
    model: 'S5 II',
    category: 'mirrorless',
    priceRange: 'mid-range',
    description: 'Hybrid L-mount camera with excellent color and stabilization.',
    features: ['24MP sensor', '6K capture', 'Phase AF'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 24,
    sensorSize: 'Full Frame',
    isoRange: '100-51200',
    shutterSpeed: '1/8000-60s',
    burstMode: '9 fps',
    autofocusPoints: 779,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '370 shots',
    videoResolution: ['6K', '4K', '1080p'],
    videoFrameRates: ['24fps', '30fps', '60fps'],
    videoCodecs: ['H.264', 'H.265'],
    logFormats: ['V-Log'],
    mount: 'L-Mount',
    weight: '740 g',
    dimensions: '134.3 x 102.3 x 90.1 mm',
    releaseDate: '2023-01-04',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'panasonic-gh7-photo',
    externalId: 'panasonic:gh7',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Panasonic',
    model: 'GH7',
    category: 'mirrorless',
    priceRange: 'professional',
    description: 'Micro Four Thirds hybrid camera optimized for production speed.',
    features: ['25MP sensor', '5.7K capture', 'Active cooling'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 25,
    sensorSize: 'Micro Four Thirds',
    isoRange: '100-25600',
    shutterSpeed: '1/8000-60s',
    burstMode: '14 fps',
    autofocusPoints: 779,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '380 shots',
    videoResolution: ['5.7K', '4K', '1080p'],
    videoFrameRates: ['24fps', '30fps', '60fps', '120fps'],
    videoCodecs: ['ProRes', 'H.265'],
    logFormats: ['V-Log'],
    mount: 'Micro Four Thirds',
    weight: '805 g',
    dimensions: '138.4 x 100.3 x 99.6 mm',
    releaseDate: '2024-06-05',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'leica-sl3-photo',
    externalId: 'leica:sl3',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Leica',
    model: 'SL3',
    category: 'mirrorless',
    priceRange: 'cinema',
    description: 'Premium Leica full-frame mirrorless system for high-end production.',
    features: ['60MP sensor', 'Open gate recording', 'L-Mount'],
    isPhotoOptimized: true,
    isVideoOptimized: true,
    megapixels: 60,
    sensorSize: 'Full Frame',
    isoRange: '50-100000',
    shutterSpeed: '1/8000-60s',
    burstMode: '15 fps',
    autofocusPoints: 779,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '350 shots',
    videoResolution: ['6K', '4K', '1080p'],
    videoFrameRates: ['24fps', '30fps', '60fps'],
    videoCodecs: ['H.265', 'ProRes'],
    logFormats: ['L-Log'],
    mount: 'L-Mount',
    weight: '769 g',
    dimensions: '141.2 x 108.0 x 84.6 mm',
    releaseDate: '2024-03-07',
    colorSpace: ['sRGB', 'Adobe RGB', 'Rec.709'],
    version: 1,
  },
  {
    id: 'hasselblad-x2d-100c-photo',
    externalId: 'hasselblad:x2d-100c',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Hasselblad',
    model: 'X2D 100C',
    category: 'medium-format',
    priceRange: 'cinema',
    description: 'Medium-format stills platform for premium campaign imaging.',
    features: ['100MP sensor', '16-bit color', 'IBIS'],
    isPhotoOptimized: true,
    isVideoOptimized: false,
    megapixels: 100,
    sensorSize: 'Medium Format',
    isoRange: '64-25600',
    shutterSpeed: '1/4000-68m',
    burstMode: '3.3 fps',
    autofocusPoints: 294,
    imageStabilization: true,
    weatherSealing: true,
    batteryLife: '420 shots',
    mount: 'Hasselblad XCD',
    weight: '895 g',
    dimensions: '148.5 x 106.1 x 74.5 mm',
    releaseDate: '2022-09-07',
    colorSpace: ['sRGB', 'Adobe RGB'],
    version: 1,
  },
  {
    id: 'ricoh-gr-iii-photo',
    externalId: 'ricoh:gr-iiix',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Ricoh',
    model: 'GR IIIx',
    category: 'point-and-shoot',
    priceRange: 'budget',
    description: 'Compact APS-C street camera with fixed focal length lens and improved ergonomics.',
    features: ['24MP APS-C', 'IBIS', 'Pocket format', '40mm equivalent lens'],
    isPhotoOptimized: true,
    isVideoOptimized: false,
    megapixels: 24,
    sensorSize: 'APS-C',
    isoRange: '100-102400',
    shutterSpeed: '1/4000-30s',
    burstMode: '4 fps',
    autofocusPoints: 49,
    imageStabilization: true,
    weatherSealing: false,
    batteryLife: '200 shots',
    mount: 'Fixed 40mm equivalent',
    weight: '257 g',
    dimensions: '109.4 x 61.9 x 33.2 mm',
    releaseDate: '2021-09-08',
    colorSpace: ['sRGB', 'Adobe RGB'],
    version: 1,
  },
];

const normalizePhotoCamera = (camera: PhotoCamera): PhotoCamera => {
  const normalizedId = normalizeId(camera.id || `${camera.brand}-${camera.model}`);
  const normalizedExternalId = normalizeId(camera.externalId || `${camera.brand}:${camera.model}`);
  const nowIso = new Date().toISOString();

  return {
    ...camera,
    id: normalizedId,
    externalId: normalizedExternalId,
    brand: camera.brand.trim(),
    model: camera.model.trim(),
    releaseDate: camera.releaseDate,
    lastSeenAt: camera.lastSeenAt || nowIso,
    addedDate: camera.addedDate ?? nowIso,
    lastUpdated: camera.lastUpdated ?? nowIso,
    version: camera.version ?? 1,
  };
};

const buildPhotoDatabase = (seed: PhotoCamera[]): PhotoCamera[] => {
  const byId = new Map<string, PhotoCamera>();
  const byExternal = new Map<string, string>();

  seed.forEach((raw) => {
    const normalized = normalizePhotoCamera(raw);
    const parsed = photoCameraSchema.safeParse(normalized);
    if (!parsed.success) {
      return;
    }

    const valid = parsed.data;
    const existingIdForExternal = byExternal.get(valid.externalId);
    if (existingIdForExternal && existingIdForExternal !== valid.id) {
      return;
    }

    byId.set(valid.id, valid);
    byExternal.set(valid.externalId, valid.id);
  });

  return Array.from(byId.values()).sort((a, b) =>
    `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'nb')
  );
};

export const PHOTO_CAMERA_DATABASE: PhotoCamera[] = buildPhotoDatabase(seedPhotoCameras);

export const getPhotoCamerasByProfession = (profession: string): PhotoCamera[] => {
  switch (profession.toLowerCase()) {
    case 'photographer':
    case 'portrait_photographer':
    case 'wedding_photographer':
      return PHOTO_CAMERA_DATABASE.filter(
        (camera) =>
          camera.category === 'mirrorless' ||
          camera.category === 'dslr' ||
          camera.priceRange === 'professional' ||
          camera.priceRange === 'cinema'
      );
    case 'commercial_photographer':
    case 'fashion_photographer':
      return PHOTO_CAMERA_DATABASE.filter(
        (camera) => camera.category === 'medium-format' || camera.priceRange !== 'budget'
      );
    case 'street_photographer':
    case 'travel_photographer':
      return PHOTO_CAMERA_DATABASE.filter(
        (camera) => camera.category === 'point-and-shoot' || camera.priceRange !== 'cinema'
      );
    case 'instant_photographer':
      return PHOTO_CAMERA_DATABASE.filter((camera) => camera.category === 'instant');
    default:
      return PHOTO_CAMERA_DATABASE;
  }
};

export const getPhotoCameraByModel = (model: string): PhotoCamera | undefined => {
  const search = model.trim().toLowerCase();
  if (!search) return undefined;

  return PHOTO_CAMERA_DATABASE.find(
    (camera) =>
      camera.model.toLowerCase().includes(search) || search.includes(camera.model.toLowerCase())
  );
};

export const getPhotoCameraBrand = (cameraModel: string): string | undefined => {
  const camera = getPhotoCameraByModel(cameraModel);
  return camera?.brand;
};

export const getPhotoCamerasByBrand = (brand: string): PhotoCamera[] => {
  return PHOTO_CAMERA_DATABASE.filter(
    (camera) => camera.brand.toLowerCase() === brand.trim().toLowerCase()
  );
};

export const getPhotoCamerasByPriceRange = (priceRange: string): PhotoCamera[] => {
  return PHOTO_CAMERA_DATABASE.filter((camera) => camera.priceRange === priceRange);
};

export const getPhotoCamerasByCategory = (category: string): PhotoCamera[] => {
  return PHOTO_CAMERA_DATABASE.filter((camera) => camera.category === category);
};
