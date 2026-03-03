/**
 * Video Camera Database
 * Clean, validated seed data used as frontend fallback.
 */

import { z } from 'zod';

export type VideoCameraCategory =
  | 'cinema'
  | 'mirrorless'
  | 'dslr'
  | 'action'
  | 'phone'
  | 'drone'
  | 'medium-format'
  | 'point-and-shoot'
  | 'instant'
  | 'film';

export type CameraPriceRange = 'budget' | 'mid-range' | 'professional' | 'cinema';
export type CameraSource = 'manual' | 'api' | 'discovery' | 'seed';

export interface Camera {
  id: string;
  externalId: string;
  type: 'video';
  source: CameraSource;
  lastSeenAt: string;
  isDeprecated: boolean;

  brand: string;
  model: string;
  category: VideoCameraCategory;
  logFormats: string[];
  resolution: string[];
  frameRates: string[];
  colorSpace: string[];
  priceRange: CameraPriceRange;
  description: string;
  features: string[];
  isVideoOptimized: boolean;
  isPhotoOptimized?: boolean;

  megapixels?: number;
  sensorSize?: string;
  isoRange?: string;
  shutterSpeed?: string;
  burstMode?: string;
  autofocusPoints?: number;
  imageStabilization?: boolean;
  weatherSealing?: boolean;
  batteryLife?: string;

  videoResolution?: string[];
  videoFrameRates?: string[];
  videoCodecs?: string[];

  mount?: string;
  weight?: string;
  dimensions?: string;
  releaseDate?: string;

  addedDate?: string;
  lastUpdated?: string;
  isNew?: boolean;
  isRecentlyUpdated?: boolean;
  version?: number;
}

export type VideoCamera = Camera;

const VIDEO_CATEGORY_VALUES: VideoCameraCategory[] = [
  'cinema',
  'mirrorless',
  'dslr',
  'action',
  'phone',
  'drone',
  'medium-format',
  'point-and-shoot',
  'instant',
  'film',
];

const PRICE_RANGE_VALUES: CameraPriceRange[] = ['budget', 'mid-range', 'professional', 'cinema'];
const SOURCE_VALUES: CameraSource[] = ['manual', 'api', 'discovery', 'seed'];
const isSupportedReleaseYear = (value: string): boolean => {
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isInteger(year) && year >= 2020 && year <= 2026;
};

const videoCameraSchema = z.object({
  id: z.string().min(1),
  externalId: z.string().min(1),
  type: z.literal('video'),
  source: z.enum(SOURCE_VALUES),
  lastSeenAt: z.string().datetime(),
  isDeprecated: z.boolean(),
  brand: z.string().min(1),
  model: z.string().min(1),
  category: z.enum(VIDEO_CATEGORY_VALUES),
  logFormats: z.array(z.string().min(1)).min(1),
  resolution: z.array(z.string().min(1)).min(1),
  frameRates: z.array(z.string().min(1)).min(1),
  colorSpace: z.array(z.string().min(1)).min(1),
  priceRange: z.enum(PRICE_RANGE_VALUES),
  description: z.string().min(1),
  features: z.array(z.string().min(1)).min(1),
  isVideoOptimized: z.boolean(),
  isPhotoOptimized: z.boolean().optional(),
  megapixels: z.number().positive().optional(),
  sensorSize: z.string().min(1).optional(),
  isoRange: z.string().min(1).optional(),
  shutterSpeed: z.string().min(1).optional(),
  burstMode: z.string().min(1).optional(),
  autofocusPoints: z.number().int().nonnegative().optional(),
  imageStabilization: z.boolean().optional(),
  weatherSealing: z.boolean().optional(),
  batteryLife: z.string().min(1).optional(),
  videoResolution: z.array(z.string().min(1)).optional(),
  videoFrameRates: z.array(z.string().min(1)).optional(),
  videoCodecs: z.array(z.string().min(1)).optional(),
  mount: z.string().min(1).optional(),
  weight: z.string().min(1).optional(),
  dimensions: z.string().min(1).optional(),
  releaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isSupportedReleaseYear, 'releaseDate must be between 2020 and 2026'),
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

const uniq = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const seedVideoCameras: Camera[] = [
  {
    id: 'sony-fx3-video',
    externalId: 'sony:fx3',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Sony',
    model: 'FX3',
    category: 'cinema',
    logFormats: ['S-Log3', 'S-Cinetone'],
    resolution: ['4K', '1080p'],
    frameRates: ['24fps', '30fps', '60fps', '120fps'],
    colorSpace: ['S-Gamut3.Cine', 'Rec.709'],
    priceRange: 'professional',
    description: 'Compact full-frame cinema camera built for handheld production.',
    features: ['4K120', 'Dual base ISO', 'XLR handle'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    megapixels: 12,
    sensorSize: 'Full Frame',
    isoRange: '80-102400',
    mount: 'Sony E',
    releaseDate: '2021-02-23',
    videoCodecs: ['XAVC S-I', 'XAVC S'],
    version: 1,
  },
  {
    id: 'sony-fx6-video',
    externalId: 'sony:fx6',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Sony',
    model: 'FX6',
    category: 'cinema',
    logFormats: ['S-Log3', 'S-Cinetone'],
    resolution: ['4K', '1080p'],
    frameRates: ['24fps', '30fps', '60fps', '120fps'],
    colorSpace: ['S-Gamut3.Cine', 'Rec.709'],
    priceRange: 'cinema',
    description: 'Production workhorse with internal ND and documentary-friendly ergonomics.',
    features: ['Variable ND', '4K120', '15+ stops DR'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    megapixels: 10.2,
    sensorSize: 'Full Frame',
    isoRange: '320-409600',
    mount: 'Sony E',
    releaseDate: '2020-11-17',
    videoCodecs: ['XAVC-I', 'XAVC-L'],
    version: 1,
  },
  {
    id: 'sony-a7s-iii-video',
    externalId: 'sony:a7s-iii',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Sony',
    model: 'A7S III',
    category: 'mirrorless',
    logFormats: ['S-Log3', 'S-Cinetone'],
    resolution: ['4K', '1080p'],
    frameRates: ['24fps', '30fps', '60fps', '120fps'],
    colorSpace: ['S-Gamut3.Cine', 'Rec.709'],
    priceRange: 'professional',
    description: 'Low-light full-frame hybrid with strong codec options.',
    features: ['4K120', '10-bit 4:2:2', 'Dual card slots'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 12,
    sensorSize: 'Full Frame',
    isoRange: '80-102400',
    mount: 'Sony E',
    releaseDate: '2020-07-28',
    videoCodecs: ['XAVC S-I', 'XAVC HS'],
    version: 1,
  },
  {
    id: 'sony-burano-video',
    externalId: 'sony:burano',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Sony',
    model: 'BURANO',
    category: 'cinema',
    logFormats: ['S-Log3'],
    resolution: ['8.6K', '6K', '4K'],
    frameRates: ['24fps', '30fps', '60fps'],
    colorSpace: ['S-Gamut3.Cine', 'Rec.709'],
    priceRange: 'cinema',
    description: 'Sony large-format cinema platform for premium productions.',
    features: ['8.6K sensor', 'Internal ND', 'PL/E mount support'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    sensorSize: 'Full Frame',
    isoRange: '800/3200 dual base',
    mount: 'Sony E',
    releaseDate: '2023-09-12',
    videoCodecs: ['X-OCN LT', 'XAVC H'],
    version: 1,
  },
  {
    id: 'canon-eos-r5-c-video',
    externalId: 'canon:eos-r5-c',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Canon',
    model: 'EOS R5 C',
    category: 'cinema',
    logFormats: ['C-Log3'],
    resolution: ['8K', '4K', '1080p'],
    frameRates: ['24fps', '30fps', '60fps', '120fps'],
    colorSpace: ['Cinema Gamut', 'Rec.709'],
    priceRange: 'professional',
    description: 'Cinema EOS pipeline in mirrorless form factor.',
    features: ['8K RAW', 'Dual role UI', 'RF mount'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 45,
    sensorSize: 'Full Frame',
    isoRange: '100-51200',
    mount: 'Canon RF',
    releaseDate: '2022-01-19',
    videoCodecs: ['Cinema RAW Light', 'XF-AVC'],
    version: 1,
  },
  {
    id: 'canon-c70-video',
    externalId: 'canon:c70',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Canon',
    model: 'C70',
    category: 'cinema',
    logFormats: ['C-Log2', 'C-Log3'],
    resolution: ['4K', '2K', '1080p'],
    frameRates: ['24fps', '30fps', '60fps', '120fps'],
    colorSpace: ['Cinema Gamut', 'Rec.709'],
    priceRange: 'professional',
    description: 'Compact Super 35 cinema camera with internal ND.',
    features: ['DGO sensor', 'RF mount', '4K120'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    sensorSize: 'Super 35',
    isoRange: '100-102400',
    mount: 'Canon RF',
    releaseDate: '2020-09-24',
    videoCodecs: ['XF-AVC', 'H.265'],
    version: 1,
  },
  {
    id: 'canon-c400-video',
    externalId: 'canon:c400',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Canon',
    model: 'C400',
    category: 'cinema',
    logFormats: ['C-Log2', 'C-Log3'],
    resolution: ['6K', '4K', '1080p'],
    frameRates: ['24fps', '30fps', '60fps', '120fps'],
    colorSpace: ['Cinema Gamut', 'Rec.709'],
    priceRange: 'cinema',
    description: 'Next generation Canon cinema body for scripted and live workflows.',
    features: ['6K full-frame', 'Internal RAW', 'RF mount'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    sensorSize: 'Full Frame',
    isoRange: '800/3200 dual base',
    mount: 'Canon RF',
    releaseDate: '2024-06-05',
    videoCodecs: ['Cinema RAW Light', 'XF-AVC'],
    version: 1,
  },
  {
    id: 'nikon-z8-video',
    externalId: 'nikon:z8-video',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Nikon',
    model: 'Z8',
    category: 'mirrorless',
    logFormats: ['N-Log'],
    resolution: ['8K', '4K', '1080p'],
    frameRates: ['24fps', '30fps', '60fps', '120fps'],
    colorSpace: ['Rec.709', 'Rec.2020'],
    priceRange: 'professional',
    description: 'Nikon flagship hybrid with production-ready codec support.',
    features: ['8K N-RAW', '4K120', 'ProRes support'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 45.7,
    sensorSize: 'Full Frame',
    isoRange: '64-25600',
    mount: 'Nikon Z',
    releaseDate: '2023-05-10',
    videoCodecs: ['N-RAW', 'ProRes 422 HQ'],
    version: 1,
  },
  {
    id: 'nikon-z9-video',
    externalId: 'nikon:z9-video',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Nikon',
    model: 'Z9',
    category: 'mirrorless',
    logFormats: ['N-Log'],
    resolution: ['8K', '4K', '1080p'],
    frameRates: ['24fps', '30fps', '60fps', '120fps'],
    colorSpace: ['Rec.709', 'Rec.2020'],
    priceRange: 'cinema',
    description: 'High-end mirrorless flagship for sports and production capture.',
    features: ['8K60', 'Internal RAW', 'Robust body'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 45.7,
    sensorSize: 'Full Frame',
    isoRange: '64-25600',
    mount: 'Nikon Z',
    releaseDate: '2021-10-28',
    videoCodecs: ['N-RAW', 'ProRes RAW'],
    version: 1,
  },
  {
    id: 'panasonic-s5iix-video',
    externalId: 'panasonic:s5iix',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Panasonic',
    model: 'S5 IIX',
    category: 'mirrorless',
    logFormats: ['V-Log'],
    resolution: ['6K', '5.9K', '4K', '1080p'],
    frameRates: ['24fps', '25fps', '30fps', '50fps', '60fps'],
    colorSpace: ['V-Gamut', 'Rec.709'],
    priceRange: 'professional',
    description: 'Full-frame hybrid built for production workflows and internal all-intra recording.',
    features: ['6K open gate', 'ALL-Intra', 'Active cooling', 'External RAW'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 24.2,
    sensorSize: 'Full Frame',
    isoRange: '100-51200',
    mount: 'L-Mount',
    releaseDate: '2023-05-24',
    videoCodecs: ['H.264', 'H.265', 'ProRes RAW'],
    version: 1,
  },
  {
    id: 'panasonic-gh7-video',
    externalId: 'panasonic:gh7-video',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Panasonic',
    model: 'GH7',
    category: 'mirrorless',
    logFormats: ['V-Log'],
    resolution: ['5.7K', '4K', '1080p'],
    frameRates: ['24fps', '30fps', '60fps', '120fps'],
    colorSpace: ['V-Gamut', 'Rec.709'],
    priceRange: 'professional',
    description: 'Fast MFT hybrid optimized for run-and-gun productions.',
    features: ['ProRes internal', '32-bit float audio', 'Fast AF'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 25.2,
    sensorSize: 'Micro Four Thirds',
    isoRange: '100-25600',
    mount: 'Micro Four Thirds',
    releaseDate: '2024-06-05',
    videoCodecs: ['ProRes', 'H.265'],
    version: 1,
  },
  {
    id: 'blackmagic-pocket-6k-pro-video',
    externalId: 'blackmagic:pocket-6k-pro',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Blackmagic',
    model: 'Pocket Cinema Camera 6K Pro',
    category: 'cinema',
    logFormats: ['Blackmagic Film'],
    resolution: ['6K', '4K', '1080p'],
    frameRates: ['24fps', '30fps', '50fps', '60fps'],
    colorSpace: ['Blackmagic Wide Gamut', 'Rec.709'],
    priceRange: 'professional',
    description: 'Affordable cinema camera with strong RAW workflow support.',
    features: ['BRAW', 'Internal ND', 'Dual mini XLR'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    sensorSize: 'Super 35',
    isoRange: '400/3200 dual native',
    mount: 'Canon EF',
    releaseDate: '2021-02-17',
    videoCodecs: ['BRAW', 'ProRes'],
    version: 1,
  },
  {
    id: 'blackmagic-ursa-mini-pro-12k-video',
    externalId: 'blackmagic:ursa-mini-pro-12k',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Blackmagic',
    model: 'URSA Mini Pro 12K',
    category: 'cinema',
    logFormats: ['Blackmagic Film'],
    resolution: ['12K', '8K', '4K'],
    frameRates: ['24fps', '30fps', '60fps'],
    colorSpace: ['Blackmagic Wide Gamut', 'Rec.709'],
    priceRange: 'cinema',
    description: 'High-resolution cinema platform for VFX-heavy pipelines.',
    features: ['12K sensor', 'BRAW', 'Interchangeable lens mount'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    sensorSize: 'Super 35',
    isoRange: '800 native',
    mount: 'PL / EF / LPL',
    releaseDate: '2020-07-16',
    videoCodecs: ['BRAW'],
    version: 1,
  },
  {
    id: 'red-komodo-x-video',
    externalId: 'red:komodo-x',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'RED',
    model: 'KOMODO-X',
    category: 'cinema',
    logFormats: ['REDWideGamutRGB', 'IPP2'],
    resolution: ['6K', '4K', '2K'],
    frameRates: ['24fps', '30fps', '60fps', '80fps'],
    colorSpace: ['REDWideGamutRGB', 'Rec.709'],
    priceRange: 'cinema',
    description: 'Compact RED system for multicam and gimbal setups.',
    features: ['Global shutter', 'REDCODE RAW', '6K at high fps'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    sensorSize: 'Super 35',
    isoRange: '800 native',
    mount: 'Canon RF',
    releaseDate: '2023-08-17',
    videoCodecs: ['REDCODE RAW'],
    version: 1,
  },
  {
    id: 'red-v-raptor-video',
    externalId: 'red:v-raptor',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'RED',
    model: 'V-RAPTOR',
    category: 'cinema',
    logFormats: ['REDWideGamutRGB', 'IPP2'],
    resolution: ['8K', '6K', '4K'],
    frameRates: ['24fps', '30fps', '60fps', '120fps'],
    colorSpace: ['REDWideGamutRGB', 'Rec.709'],
    priceRange: 'cinema',
    description: 'High-end RED flagship designed for premium narrative capture.',
    features: ['8K VV sensor', 'REDCODE RAW', 'High-speed modes'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    sensorSize: 'Full Frame',
    isoRange: '800 native',
    mount: 'Canon RF',
    releaseDate: '2021-09-09',
    videoCodecs: ['REDCODE RAW'],
    version: 1,
  },
  {
    id: 'arri-alexa-35-video',
    externalId: 'arri:alexa-35',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'ARRI',
    model: 'ALEXA 35',
    category: 'cinema',
    logFormats: ['LogC4'],
    resolution: ['4.6K', '4K', '2K'],
    frameRates: ['24fps', '30fps', '60fps', '120fps'],
    colorSpace: ['ARRI Wide Gamut 4', 'Rec.709'],
    priceRange: 'cinema',
    description: 'Premium ARRI Super 35 platform with exceptional dynamic range.',
    features: ['17 stops DR', 'ARRIRAW', 'Robust production ecosystem'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    sensorSize: 'Super 35',
    isoRange: 'EI 160-6400',
    mount: 'LPL',
    releaseDate: '2022-05-31',
    videoCodecs: ['ARRIRAW', 'ProRes'],
    version: 1,
  },
  {
    id: 'dji-inspire-3-x9-video',
    externalId: 'dji:inspire-3-x9',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'DJI',
    model: 'Inspire 3 (X9)',
    category: 'drone',
    logFormats: ['D-Log', 'D-Log M'],
    resolution: ['8K', '6K', '4K'],
    frameRates: ['24fps', '30fps', '60fps', '75fps'],
    colorSpace: ['D-Gamut', 'Rec.709'],
    priceRange: 'cinema',
    description: 'Professional aerial platform with full-frame gimbal camera.',
    features: ['8K RAW', 'RTK', 'High speed tracking'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    sensorSize: 'Full Frame',
    isoRange: '100-6400',
    mount: 'DJI DL',
    releaseDate: '2023-04-13',
    videoCodecs: ['CinemaDNG', 'ProRes RAW'],
    version: 1,
  },
  {
    id: 'dji-mavic-air-2-video',
    externalId: 'dji:mavic-air-2',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'DJI',
    model: 'Mavic Air 2',
    category: 'drone',
    logFormats: ['D-Log M'],
    resolution: ['4K', '2.7K', '1080p'],
    frameRates: ['24fps', '25fps', '30fps', '50fps', '60fps', '120fps'],
    colorSpace: ['D-Gamut', 'Rec.709'],
    priceRange: 'mid-range',
    description: 'Compact drone platform for travel and production scouting.',
    features: ['4K60', '48MP stills', 'OcuSync 2.0'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 48,
    sensorSize: '1/2"',
    isoRange: '100-6400',
    mount: 'Integrated gimbal camera',
    releaseDate: '2020-04-27',
    videoCodecs: ['H.264', 'H.265'],
    version: 1,
  },
  {
    id: 'dji-mavic-3-video',
    externalId: 'dji:mavic-3',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'DJI',
    model: 'Mavic 3',
    category: 'drone',
    logFormats: ['D-Log', 'HLG'],
    resolution: ['5.1K', '4K', '1080p'],
    frameRates: ['24fps', '25fps', '30fps', '50fps', '60fps', '120fps'],
    colorSpace: ['D-Gamut', 'Rec.709'],
    priceRange: 'professional',
    description: 'Dual-camera drone with 4/3 primary sensor for cinematic capture.',
    features: ['5.1K recording', '4/3 sensor', 'O3+ transmission'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 20,
    sensorSize: '4/3"',
    isoRange: '100-6400',
    mount: 'Integrated Hasselblad camera',
    releaseDate: '2021-11-05',
    videoCodecs: ['H.264', 'H.265'],
    version: 1,
  },
  {
    id: 'dji-mini-3-pro-video',
    externalId: 'dji:mini-3-pro',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'DJI',
    model: 'Mini 3 Pro',
    category: 'drone',
    logFormats: ['D-Cinelike'],
    resolution: ['4K', '2.7K', '1080p'],
    frameRates: ['24fps', '25fps', '30fps', '48fps', '50fps', '60fps', '120fps'],
    colorSpace: ['D-Gamut', 'Rec.709'],
    priceRange: 'mid-range',
    description: 'Lightweight drone suited for agile production and location inserts.',
    features: ['4K60', 'Vertical shooting', 'Obstacle sensing'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 48,
    sensorSize: '1/1.3"',
    isoRange: '100-6400',
    mount: 'Integrated gimbal camera',
    releaseDate: '2022-05-10',
    videoCodecs: ['H.264', 'H.265'],
    version: 1,
  },
  {
    id: 'dji-air-3-video',
    externalId: 'dji:air-3',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'DJI',
    model: 'Air 3',
    category: 'drone',
    logFormats: ['D-Log M', 'HLG'],
    resolution: ['4K', '2.7K', '1080p'],
    frameRates: ['24fps', '25fps', '30fps', '50fps', '60fps', '100fps'],
    colorSpace: ['D-Gamut', 'Rec.709'],
    priceRange: 'professional',
    description: 'Dual-primary camera drone with strong dynamic range for production work.',
    features: ['Dual 1/1.3\" sensors', '4K100', 'O4 transmission'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 48,
    sensorSize: 'Dual 1/1.3"',
    isoRange: '100-6400',
    mount: 'Integrated dual-camera gimbal',
    releaseDate: '2023-07-25',
    videoCodecs: ['H.264', 'H.265'],
    version: 1,
  },
  {
    id: 'dji-mini-4-pro-video',
    externalId: 'dji:mini-4-pro',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'DJI',
    model: 'Mini 4 Pro',
    category: 'drone',
    logFormats: ['D-Log M', 'HLG'],
    resolution: ['4K', '2.7K', '1080p'],
    frameRates: ['24fps', '25fps', '30fps', '50fps', '60fps', '100fps'],
    colorSpace: ['D-Gamut', 'Rec.709'],
    priceRange: 'professional',
    description: 'Compact pro drone with omnidirectional sensing and log workflow.',
    features: ['4K100', 'Omnidirectional sensing', 'Waypoint flights'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 48,
    sensorSize: '1/1.3"',
    isoRange: '100-6400',
    mount: 'Integrated gimbal camera',
    releaseDate: '2023-09-25',
    videoCodecs: ['H.264', 'H.265'],
    version: 1,
  },
  {
    id: 'dji-avata-2-video',
    externalId: 'dji:avata-2',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'DJI',
    model: 'Avata 2',
    category: 'drone',
    logFormats: ['D-Log M'],
    resolution: ['4K', '2.7K', '1080p'],
    frameRates: ['24fps', '25fps', '30fps', '50fps', '60fps', '100fps'],
    colorSpace: ['D-Gamut', 'Rec.709'],
    priceRange: 'mid-range',
    description: 'FPV-oriented cinewhoop drone for dynamic action shots.',
    features: ['4K100', 'FPV workflow', 'Low latency transmission'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    megapixels: 12,
    sensorSize: '1/1.3"',
    isoRange: '100-6400',
    mount: 'Integrated FPV gimbal camera',
    releaseDate: '2024-04-11',
    videoCodecs: ['H.264', 'H.265'],
    version: 1,
  },
  {
    id: 'sony-fx30-video',
    externalId: 'sony:fx30',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Sony',
    model: 'FX30',
    category: 'cinema',
    logFormats: ['S-Log3', 'S-Cinetone'],
    resolution: ['4K', '1080p'],
    frameRates: ['24fps', '25fps', '30fps', '50fps', '60fps', '120fps'],
    colorSpace: ['S-Gamut3.Cine', 'Rec.709'],
    priceRange: 'professional',
    description: 'APS-C cinema line body for compact narrative and documentary rigs.',
    features: ['4K120', '10-bit 4:2:2', 'Dual base ISO'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 26,
    sensorSize: 'APS-C',
    isoRange: '100-32000',
    mount: 'Sony E',
    releaseDate: '2022-09-28',
    videoCodecs: ['XAVC S-I', 'XAVC HS'],
    version: 1,
  },
  {
    id: 'blackmagic-pyxis-6k-video',
    externalId: 'blackmagic:pyxis-6k',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Blackmagic',
    model: 'PYXIS 6K',
    category: 'cinema',
    logFormats: ['Blackmagic Film'],
    resolution: ['6K', '4K', '1080p'],
    frameRates: ['24fps', '25fps', '30fps', '50fps', '60fps'],
    colorSpace: ['Blackmagic Wide Gamut', 'Rec.709'],
    priceRange: 'cinema',
    description: 'Box-style full-frame cinema camera designed for modular production rigs.',
    features: ['6K full frame', 'BRAW', 'Flexible rigging'],
    isVideoOptimized: true,
    isPhotoOptimized: false,
    sensorSize: 'Full Frame',
    isoRange: '400/3200 dual native',
    mount: 'L-Mount',
    releaseDate: '2024-04-12',
    videoCodecs: ['BRAW', 'H.264'],
    version: 1,
  },
  {
    id: 'gopro-hero-13-black-video',
    externalId: 'gopro:hero-13-black',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'GoPro',
    model: 'HERO 13 Black',
    category: 'action',
    logFormats: ['GP-Log'],
    resolution: ['5.3K', '4K', '1080p'],
    frameRates: ['24fps', '30fps', '60fps', '120fps', '240fps'],
    colorSpace: ['Rec.709'],
    priceRange: 'mid-range',
    description: 'Durable action camera for BTS, crash-cam and POV capture.',
    features: ['HyperSmooth', 'Waterproof body', 'High fps modes'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 27,
    sensorSize: '1/1.9"',
    isoRange: '100-6400',
    releaseDate: '2024-09-04',
    videoCodecs: ['H.265'],
    version: 1,
  },
  {
    id: 'apple-iphone-16-pro-video',
    externalId: 'apple:iphone-16-pro',
    type: 'video',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Apple',
    model: 'iPhone 16 Pro',
    category: 'phone',
    logFormats: ['Apple Log'],
    resolution: ['4K', '1080p'],
    frameRates: ['24fps', '25fps', '30fps', '60fps', '120fps'],
    colorSpace: ['Rec.709', 'Rec.2020'],
    priceRange: 'mid-range',
    description: 'Mobile cinema option for run-and-gun and social-first content.',
    features: ['Apple Log', 'ProRes', 'Action mode'],
    isVideoOptimized: true,
    isPhotoOptimized: true,
    megapixels: 48,
    sensorSize: '1/1.28"',
    isoRange: 'Auto 25-2000',
    releaseDate: '2025-09-01',
    videoCodecs: ['ProRes', 'H.265'],
    version: 1,
  },
];

const normalizeVideoCamera = (camera: Camera): Camera => {
  const nowIso = new Date().toISOString();

  return {
    ...camera,
    id: normalizeId(camera.id || `${camera.brand}-${camera.model}`),
    externalId: normalizeId(camera.externalId || `${camera.brand}:${camera.model}`),
    type: 'video',
    brand: camera.brand.trim(),
    model: camera.model.trim(),
    logFormats: uniq(camera.logFormats),
    resolution: uniq(camera.resolution),
    frameRates: uniq(camera.frameRates),
    colorSpace: uniq(camera.colorSpace),
    videoResolution: camera.videoResolution ? uniq(camera.videoResolution) : undefined,
    videoFrameRates: camera.videoFrameRates ? uniq(camera.videoFrameRates) : undefined,
    videoCodecs: camera.videoCodecs ? uniq(camera.videoCodecs) : undefined,
    lastSeenAt: camera.lastSeenAt || nowIso,
    addedDate: camera.addedDate ?? nowIso,
    lastUpdated: camera.lastUpdated ?? nowIso,
    version: camera.version ?? 1,
  };
};

const buildVideoDatabase = (seed: Camera[]): Camera[] => {
  const byId = new Map<string, Camera>();
  const byExternal = new Map<string, string>();

  seed.forEach((raw) => {
    const normalized = normalizeVideoCamera(raw);
    const parsed = videoCameraSchema.safeParse(normalized);
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

export const VIDEO_CAMERA_DATABASE: Camera[] = buildVideoDatabase(seedVideoCameras);

export const getCamerasByProfession = (profession: string): VideoCamera[] => {
  switch (profession.toLowerCase()) {
    case 'videographer':
    case 'cinematographer':
    case 'filmmaker':
      return VIDEO_CAMERA_DATABASE.filter(
        (camera) =>
          camera.category === 'cinema' ||
          camera.category === 'mirrorless' ||
          camera.priceRange === 'professional' ||
          camera.priceRange === 'cinema'
      );
    case 'content_creator':
    case 'youtuber':
      return VIDEO_CAMERA_DATABASE.filter(
        (camera) =>
          camera.priceRange === 'budget' ||
          camera.priceRange === 'mid-range' ||
          camera.category === 'phone' ||
          camera.category === 'action'
      );
    case 'wedding_videographer':
      return VIDEO_CAMERA_DATABASE.filter(
        (camera) =>
          camera.category === 'mirrorless' ||
          camera.category === 'cinema' ||
          camera.priceRange === 'professional'
      );
    default:
      return VIDEO_CAMERA_DATABASE;
  }
};

export const getCameraByModel = (model: string): VideoCamera | undefined => {
  const search = model.trim().toLowerCase();
  if (!search) return undefined;

  return VIDEO_CAMERA_DATABASE.find(
    (camera) =>
      camera.model.toLowerCase().includes(search) || search.includes(camera.model.toLowerCase())
  );
};

export const getLogFormatsByCamera = (cameraModel: string): string[] => {
  return getCameraByModel(cameraModel)?.logFormats ?? [];
};

export const getCameraBrand = (cameraModel: string): string | undefined => {
  return getCameraByModel(cameraModel)?.brand;
};
