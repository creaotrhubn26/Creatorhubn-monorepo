/**
 * Production Audio Storage Device Database (2020-2026)
 *
 * Scope:
 * - Audio devices used in production workflows where recorded audio must be stored,
 *   transferred, and backed up.
 * - Focused on recorders and wireless systems with onboard recording, plus
 *   camera-attached digital microphones that write audio to camera media.
 */

import { z } from 'zod';

export type AudioStorageDeviceCategory =
  | 'field-recorder'
  | 'mixer-recorder'
  | 'pocket-recorder'
  | 'wireless-recorder'
  | 'on-camera-recorder'
  | 'camera-attached-digital-mic'
  | 'desktop-production-console';

export type AudioStorageMedium =
  | 'internal-flash'
  | 'microSD'
  | 'microSDHC'
  | 'microSDXC'
  | 'SD'
  | 'SDHC'
  | 'SDXC'
  | 'usb-storage'
  | 'camera-media';

export type AudioStorageSource = 'seed' | 'manual' | 'api' | 'discovery';
export type DatePrecision = 'exact' | 'month' | 'year' | 'first-verified';

export interface AudioStorageReference {
  title: string;
  url: string;
}

export interface AudioStorageDevice {
  id: string;
  externalId: string;
  source: AudioStorageSource;
  lastSeenAt: string;
  isDeprecated: boolean;

  brand: string;
  model: string;
  category: AudioStorageDeviceCategory;
  releaseYear: number;
  releaseDate: string;
  releaseDatePrecision: DatePrecision;

  storageMedia: AudioStorageMedium[];
  maxStorage: string;
  recordingFormats: string[];
  maxSampleRateHz: number;
  bitDepthOptions: string[];
  channelCount: number;
  supportsTimecode: boolean;
  requiresSeparateStorageWorkflow: boolean;

  description: string;
  productionUseCases: string[];
  storageWorkflowNotes: string;
  sourceReferences: AudioStorageReference[];
}

const categoryValues: AudioStorageDeviceCategory[] = [
  'field-recorder',
  'mixer-recorder',
  'pocket-recorder',
  'wireless-recorder',
  'on-camera-recorder',
  'camera-attached-digital-mic',
  'desktop-production-console',
];

const storageMediumValues: AudioStorageMedium[] = [
  'internal-flash',
  'microSD',
  'microSDHC',
  'microSDXC',
  'SD',
  'SDHC',
  'SDXC',
  'usb-storage',
  'camera-media',
];

const sourceValues: AudioStorageSource[] = ['seed', 'manual', 'api', 'discovery'];
const precisionValues: DatePrecision[] = ['exact', 'month', 'year', 'first-verified'];

const referenceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
});

const audioStorageDeviceSchema = z.object({
  id: z.string().min(1),
  externalId: z.string().min(1),
  source: z.enum(sourceValues),
  lastSeenAt: z.string().datetime(),
  isDeprecated: z.boolean(),
  brand: z.string().min(1),
  model: z.string().min(1),
  category: z.enum(categoryValues),
  releaseYear: z.number().int().min(2020).max(2026),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  releaseDatePrecision: z.enum(precisionValues),
  storageMedia: z.array(z.enum(storageMediumValues)).min(1),
  maxStorage: z.string().min(1),
  recordingFormats: z.array(z.string().min(1)).min(1),
  maxSampleRateHz: z.number().int().positive(),
  bitDepthOptions: z.array(z.string().min(1)).min(1),
  channelCount: z.number().int().positive(),
  supportsTimecode: z.boolean(),
  requiresSeparateStorageWorkflow: z.boolean(),
  description: z.string().min(1),
  productionUseCases: z.array(z.string().min(1)).min(1),
  storageWorkflowNotes: z.string().min(1),
  sourceReferences: z.array(referenceSchema).min(1),
});

const normalizeId = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const uniq = <T,>(values: T[]): T[] => Array.from(new Set(values));

const seedAudioStorageDevices: AudioStorageDevice[] = [
  {
    id: 'zoom-h8',
    externalId: 'zoom:h8',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Zoom',
    model: 'H8 Handy Recorder',
    category: 'field-recorder',
    releaseYear: 2020,
    releaseDate: '2020-07-03',
    releaseDatePrecision: 'exact',
    storageMedia: ['SD', 'SDHC', 'SDXC'],
    maxStorage: 'Up to 512GB',
    recordingFormats: ['WAV', 'MP3'],
    maxSampleRateHz: 96000,
    bitDepthOptions: ['16-bit', '24-bit'],
    channelCount: 12,
    supportsTimecode: false,
    requiresSeparateStorageWorkflow: true,
    description:
      'Portable multi-app recorder for podcast/music/field with direct SD-based recording.',
    productionUseCases: ['podcast', 'field-recording', 'run-and-gun', 'small-film-production'],
    storageWorkflowNotes:
      'Recordings are saved to SD media and should be offloaded to primary + backup storage after each shoot day.',
    sourceReferences: [
      {
        title: 'Zoom unveils the new H8 Handy Recorder (Zoom distribution news)',
        url: 'https://blog.sound-service.eu/zoom-unveils-the-new-h8-handy-recorder/',
      },
      {
        title: 'Zoom H8 highlights (records to SD/SDHC/SDXC up to 512GB)',
        url: 'https://www.4kshooters.net/2020/07/03/zoom-h8-portable-handheld-recorder-introduced/',
      },
    ],
  },
  {
    id: 'rode-wireless-go-ii',
    externalId: 'rode:wireless-go-ii',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'RODE',
    model: 'Wireless GO II',
    category: 'wireless-recorder',
    releaseYear: 2021,
    releaseDate: '2021-02-01',
    releaseDatePrecision: 'month',
    storageMedia: ['internal-flash'],
    maxStorage: 'Over 40h compressed or 7h uncompressed per transmitter',
    recordingFormats: ['Compressed onboard format', 'WAV 48kHz 24-bit'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['24-bit'],
    channelCount: 2,
    supportsTimecode: false,
    requiresSeparateStorageWorkflow: true,
    description:
      'Dual-channel wireless system with onboard transmitter recording for backup and recovery workflows.',
    productionUseCases: ['interviews', 'documentary', 'run-and-gun', 'event-coverage'],
    storageWorkflowNotes:
      'Export TX recordings via RODE Central and verify offload before card/media re-use policy is applied.',
    sourceReferences: [
      {
        title: 'RODE product release dates',
        url: 'https://help.rode.com/hc/en-us/articles/11995458121999-R%C3%98DE-Product-Release-dates',
      },
      {
        title: 'Wireless GO II onboard recording guide',
        url: 'https://help.rode.com/hc/en-us/articles/7103517656463-How-to-enable-On-Board-recordings-on-the-Wireless-GO-II-TX',
      },
    ],
  },
  {
    id: 'zoom-f2',
    externalId: 'zoom:f2',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Zoom',
    model: 'F2 / F2-BT',
    category: 'pocket-recorder',
    releaseYear: 2021,
    releaseDate: '2021-03-05',
    releaseDatePrecision: 'first-verified',
    storageMedia: ['microSD', 'microSDHC', 'microSDXC'],
    maxStorage: 'Up to 1TB',
    recordingFormats: ['WAV 44.1kHz 32-bit float', 'WAV 48kHz 32-bit float'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['32-bit float'],
    channelCount: 1,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Ultra-compact bodypack field recorder for lav workflows with SD-based storage and USB offload.',
    productionUseCases: ['dialogue-capture', 'wedding-audio', 'reality-tv', 'journalism'],
    storageWorkflowNotes:
      'Use labeled microSD cards per talent/device and ingest as isolated tracks before end-of-day media verification.',
    sourceReferences: [
      {
        title: 'Zoom F2 product page (storage details)',
        url: 'https://zoomcorp.com/en/us/field-recorders/field-recorders/zoom-f2/',
      },
      {
        title: 'Zoom support timeline (F2/F2-BT firmware dated 2021-03-05)',
        url: 'https://zoomcorp.com/en/gb/news/category/product-support/?page=8',
      },
    ],
  },
  {
    id: 'zoom-f3',
    externalId: 'zoom:f3',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Zoom',
    model: 'F3',
    category: 'field-recorder',
    releaseYear: 2022,
    releaseDate: '2022-01-19',
    releaseDatePrecision: 'first-verified',
    storageMedia: ['microSD', 'microSDHC', 'microSDXC'],
    maxStorage: 'Up to 1TB',
    recordingFormats: ['WAV 32-bit float'],
    maxSampleRateHz: 96000,
    bitDepthOptions: ['32-bit float'],
    channelCount: 2,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Compact 2-channel 32-bit float location recorder for dialogue and dual-system audio.',
    productionUseCases: ['film-production', 'documentary', 'interviews', 'field-sound'],
    storageWorkflowNotes:
      'Treat microSD as camera media: card ID, ingest checksum, and clear card only after backup verification.',
    sourceReferences: [
      {
        title: 'Zoom F3 product page',
        url: 'https://zoomcorp.com/en/us/field-recorders/field-recorders/f3/',
      },
      {
        title: 'Early launch coverage and feature verification',
        url: 'https://www.newsshooter.com/2022/01/19/zoom-f3/',
      },
    ],
  },
  {
    id: 'zoom-m2-mictrak',
    externalId: 'zoom:m2-mictrak',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Zoom',
    model: 'M2 MicTrak',
    category: 'on-camera-recorder',
    releaseYear: 2022,
    releaseDate: '2022-12-15',
    releaseDatePrecision: 'exact',
    storageMedia: ['microSDXC'],
    maxStorage: 'Series supports SDXC-based recording workflow',
    recordingFormats: ['32-bit float'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['32-bit float'],
    channelCount: 2,
    supportsTimecode: false,
    requiresSeparateStorageWorkflow: true,
    description:
      'Handheld MicTrak model with integrated recorder for single-take capture in dynamic environments.',
    productionUseCases: ['interviews', 'content-creation', 'event-hosting'],
    storageWorkflowNotes:
      'Ingest recorder media as primary audio source and maintain track-level logging before reformatting media.',
    sourceReferences: [
      {
        title: 'M2 MicTrak launch announcement',
        url: 'https://blog.sound-service.eu/zoom-unveils-the-m2-mictrak-32-bit-float-recorder/',
      },
      {
        title: 'MicTrak release notice from Zoom (Dec 2022 launch reference)',
        url: 'https://zoomcorp.com/en/us/news/mictrak_notice/',
      },
    ],
  },
  {
    id: 'zoom-m3-mictrak',
    externalId: 'zoom:m3-mictrak',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Zoom',
    model: 'M3 MicTrak',
    category: 'on-camera-recorder',
    releaseYear: 2022,
    releaseDate: '2022-12-15',
    releaseDatePrecision: 'exact',
    storageMedia: ['SDXC'],
    maxStorage: 'Records to SDXC cards',
    recordingFormats: ['32-bit float', 'MS RAW backup'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['32-bit float'],
    channelCount: 4,
    supportsTimecode: false,
    requiresSeparateStorageWorkflow: true,
    description:
      'On-camera stereo shotgun with integrated recorder and backup output to camera.',
    productionUseCases: ['camera-mounted-audio', 'run-and-gun', 'doc-shooting'],
    storageWorkflowNotes:
      'Keep recorder files and camera scratch/backup tracks linked in shot metadata for post sync safety.',
    sourceReferences: [
      {
        title: 'M3 MicTrak launch announcement',
        url: 'https://blog.sound-service.eu/zoom-unveils-the-m3-mictrak-32-bit-float-recorder/',
      },
      {
        title: 'MicTrak release notice from Zoom',
        url: 'https://zoomcorp.com/en/us/news/mictrak_notice/',
      },
    ],
  },
  {
    id: 'zoom-m4-mictrak',
    externalId: 'zoom:m4-mictrak',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Zoom',
    model: 'M4 MicTrak',
    category: 'field-recorder',
    releaseYear: 2022,
    releaseDate: '2022-12-15',
    releaseDatePrecision: 'exact',
    storageMedia: ['microSDHC', 'microSDXC'],
    maxStorage: 'Up to 1TB',
    recordingFormats: ['WAV 32-bit float'],
    maxSampleRateHz: 192000,
    bitDepthOptions: ['32-bit float'],
    channelCount: 4,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Portable 4-track MicTrak recorder with built-in timecode generator and external XLR inputs.',
    productionUseCases: ['film-audio', 'field-music', 'small-crew-production'],
    storageWorkflowNotes:
      'Store track metadata and timecode sync notes alongside file ingest logs for multi-device conform.',
    sourceReferences: [
      {
        title: 'M4 MicTrak launch announcement',
        url: 'https://blog.sound-service.eu/zoom-unveils-the-m4-mictrak-32-bit-float-recorder/',
      },
      {
        title: 'M4 MicTrak quick tour (supported recording media)',
        url: 'https://www.manualslib.com/manual/2934424/Zoom-Mictrak-M4.html',
      },
    ],
  },
  {
    id: 'rode-rodecaster-pro-ii',
    externalId: 'rode:rodecaster-pro-ii',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'RODE',
    model: 'RodeCaster Pro II',
    category: 'desktop-production-console',
    releaseYear: 2022,
    releaseDate: '2022-05-01',
    releaseDatePrecision: 'month',
    storageMedia: ['microSDHC', 'microSDXC', 'usb-storage'],
    maxStorage: 'microSD or USB storage (depends on selected media)',
    recordingFormats: ['Multitrack recording'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['24-bit'],
    channelCount: 14,
    supportsTimecode: false,
    requiresSeparateStorageWorkflow: true,
    description:
      'Integrated production console with direct recording to microSD and/or USB storage.',
    productionUseCases: ['podcast', 'livestream', 'studio-production', 'broadcast'],
    storageWorkflowNotes:
      'Record to mirrored destinations when possible (microSD + USB) and validate export before cleanup.',
    sourceReferences: [
      {
        title: 'RODE product release dates',
        url: 'https://help.rode.com/hc/en-us/articles/11995458121999-R%C3%98DE-Product-Release-dates',
      },
      {
        title: 'RodeCaster Pro II / Duo recording storage behavior',
        url: 'https://help.rode.com/hc/en-us/articles/9449466220559-What-does-the-REC-LED-colours-indicate-on-the-R%C3%98DECaster-Pro-II-Duo',
      },
    ],
  },
  {
    id: 'tascam-dr-10l-pro',
    externalId: 'tascam:dr-10l-pro',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'TASCAM',
    model: 'DR-10L Pro',
    category: 'pocket-recorder',
    releaseYear: 2023,
    releaseDate: '2023-07-06',
    releaseDatePrecision: 'first-verified',
    storageMedia: ['microSD', 'microSDHC', 'microSDXC'],
    maxStorage: 'Up to 512GB',
    recordingFormats: ['WAV', 'MP3', '32-bit float'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['24-bit', '32-bit float'],
    channelCount: 1,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Ultra-compact lav recorder with long runtime and large removable media support.',
    productionUseCases: ['wedding-video', 'dialogue', 'event-production', 'reality-tv'],
    storageWorkflowNotes:
      'Use unit-level naming convention and sync logs to prevent talent recorder mix-ups in post.',
    sourceReferences: [
      {
        title: 'DR-10L Pro product page and specs',
        url: 'https://tascam.com/us/product/dr-10l_pro',
      },
      {
        title: 'DR-10L Pro owner manual version timeline',
        url: 'https://tascam.com/us/product/dr-10l_pro',
      },
    ],
  },
  {
    id: 'rode-wireless-pro',
    externalId: 'rode:wireless-pro',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'RODE',
    model: 'Wireless PRO',
    category: 'wireless-recorder',
    releaseYear: 2023,
    releaseDate: '2023-08-01',
    releaseDatePrecision: 'month',
    storageMedia: ['internal-flash'],
    maxStorage: '40h of 32-bit float onboard recording per transmitter',
    recordingFormats: ['32-bit float onboard recording'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['32-bit float'],
    channelCount: 2,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Flagship dual wireless system with robust onboard recording and post-safe workflow options.',
    productionUseCases: ['interviews', 'documentary', 'field-broadcast', 'mobile-production'],
    storageWorkflowNotes:
      'Internal TX recordings should be exported each shoot day and tied to camera roll/shot identifiers.',
    sourceReferences: [
      {
        title: 'RODE product release dates',
        url: 'https://help.rode.com/hc/en-us/articles/11995458121999-R%C3%98DE-Product-Release-dates',
      },
      {
        title: 'Wireless PRO onboard recording documentation',
        url: 'https://help.rode.com/hc/en-us/articles/7767595260687-How-to-enable-Onboard-recordings-on-the-Wireless-PRO-TX',
      },
    ],
  },
  {
    id: 'rode-rodecaster-duo',
    externalId: 'rode:rodecaster-duo',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'RODE',
    model: 'RodeCaster Duo',
    category: 'desktop-production-console',
    releaseYear: 2023,
    releaseDate: '2023-06-01',
    releaseDatePrecision: 'month',
    storageMedia: ['microSDHC', 'microSDXC', 'usb-storage'],
    maxStorage: 'microSD or USB storage (depends on selected media)',
    recordingFormats: ['Multitrack recording'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['24-bit'],
    channelCount: 14,
    supportsTimecode: false,
    requiresSeparateStorageWorkflow: true,
    description:
      'Compact production console variant with direct recording to removable storage targets.',
    productionUseCases: ['podcast', 'streaming', 'voice-production'],
    storageWorkflowNotes:
      'Enable multitrack when needed and enforce immediate mirrored backup after transfer from device storage.',
    sourceReferences: [
      {
        title: 'RODE product release dates',
        url: 'https://help.rode.com/hc/en-us/articles/11995458121999-R%C3%98DE-Product-Release-dates',
      },
      {
        title: 'RodeCaster Pro II / Duo microSD requirements',
        url: 'https://help.rode.com/hc/en-us/articles/7069742392847-What-type-of-MicroSD-cards-can-I-use-with-the-R%C3%98DECaster-Pro-II-Duo',
      },
    ],
  },
  {
    id: 'dji-mic-2',
    externalId: 'dji:mic-2',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'DJI',
    model: 'Mic 2',
    category: 'wireless-recorder',
    releaseYear: 2024,
    releaseDate: '2024-01-17',
    releaseDatePrecision: 'exact',
    storageMedia: ['internal-flash'],
    maxStorage: '14-hour internal recording (per official product messaging)',
    recordingFormats: ['24-bit', '32-bit float internal recording'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['24-bit', '32-bit float'],
    channelCount: 2,
    supportsTimecode: false,
    requiresSeparateStorageWorkflow: true,
    description:
      'Compact wireless system for creator and production use with onboard internal recording safeguards.',
    productionUseCases: ['vlog', 'interviews', 'event-content', 'run-and-gun'],
    storageWorkflowNotes:
      'Internal recordings should be exported and checksummed before transmitter memory cycling.',
    sourceReferences: [
      {
        title: 'DJI Mic 2 product page',
        url: 'https://www.dji.com/mic-2',
      },
      {
        title: 'Mic 2 launch date reference',
        url: 'https://www.prnewswire.com/news-release/2024/01/17/302036560.html',
      },
    ],
  },
  {
    id: 'zoom-h1essential',
    externalId: 'zoom:h1essential',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Zoom',
    model: 'H1essential',
    category: 'field-recorder',
    releaseYear: 2024,
    releaseDate: '2024-02-28',
    releaseDatePrecision: 'exact',
    storageMedia: ['microSDHC', 'microSDXC'],
    maxStorage: 'microSDHC/microSDXC (capacity varies by approved card list)',
    recordingFormats: ['WAV 32-bit float'],
    maxSampleRateHz: 96000,
    bitDepthOptions: ['32-bit float'],
    channelCount: 2,
    supportsTimecode: false,
    requiresSeparateStorageWorkflow: true,
    description:
      'Compact essential-series handheld recorder for lightweight production and backup capture.',
    productionUseCases: ['ambient-capture', 'backup-audio', 'lightweight-doc'],
    storageWorkflowNotes:
      'Card-based workflow should follow card-ID logging and 3-2-1 backup before card format.',
    sourceReferences: [
      {
        title: 'Zoom essential-series release announcement',
        url: 'https://zoomcorp.com/en/us/news/zoom-releases-the-first-handy-recorders-with-accessibility-for-the-blind-and-visually-impaired/',
      },
      {
        title: 'H1essential operation manual',
        url: 'https://zoomcorp.com/manuals/h1essential-en/',
      },
    ],
  },
  {
    id: 'zoom-h4essential',
    externalId: 'zoom:h4essential',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Zoom',
    model: 'H4essential',
    category: 'field-recorder',
    releaseYear: 2024,
    releaseDate: '2024-02-28',
    releaseDatePrecision: 'exact',
    storageMedia: ['microSDHC', 'microSDXC'],
    maxStorage: '4GB-1TB depending on microSDHC/microSDXC class',
    recordingFormats: ['WAV 32-bit float'],
    maxSampleRateHz: 96000,
    bitDepthOptions: ['24-bit', '32-bit float'],
    channelCount: 6,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Mid-tier essential-series recorder with dual XLR inputs and SD-based production capture.',
    productionUseCases: ['video-production', 'interviews', 'podcast-field-kits'],
    storageWorkflowNotes:
      'Use structured file naming per day/scene and keep rolling checksum logs after ingest.',
    sourceReferences: [
      {
        title: 'Zoom essential-series release announcement',
        url: 'https://zoomcorp.com/en/us/news/zoom-releases-the-first-handy-recorders-with-accessibility-for-the-blind-and-visually-impaired/',
      },
      {
        title: 'H4essential operation manual specs',
        url: 'https://zoomcorp.com/manuals/h4essential-en/',
      },
    ],
  },
  {
    id: 'zoom-h6essential',
    externalId: 'zoom:h6essential',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Zoom',
    model: 'H6essential',
    category: 'field-recorder',
    releaseYear: 2024,
    releaseDate: '2024-02-28',
    releaseDatePrecision: 'exact',
    storageMedia: ['microSDHC', 'microSDXC'],
    maxStorage: '4GB-1TB depending on microSDHC/microSDXC class',
    recordingFormats: ['WAV 32-bit float'],
    maxSampleRateHz: 96000,
    bitDepthOptions: ['24-bit', '32-bit float'],
    channelCount: 8,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Flagship essential-series recorder with interchangeable capsule workflow and card-based recording.',
    productionUseCases: ['film-audio', 'field-sound', 'multi-input-capture'],
    storageWorkflowNotes:
      'Treat each card as source master and complete dual backup + verification before reuse.',
    sourceReferences: [
      {
        title: 'Zoom essential-series release announcement',
        url: 'https://zoomcorp.com/en/us/news/zoom-releases-the-first-handy-recorders-with-accessibility-for-the-blind-and-visually-impaired/',
      },
      {
        title: 'H6essential operation manual specs',
        url: 'https://zoomcorp.com/manuals/h6essential-en/',
      },
    ],
  },
  {
    id: 'tascam-fr-av2',
    externalId: 'tascam:fr-av2',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'TASCAM',
    model: 'FR-AV2',
    category: 'field-recorder',
    releaseYear: 2024,
    releaseDate: '2024-09-25',
    releaseDatePrecision: 'exact',
    storageMedia: ['microSDHC', 'microSDXC'],
    maxStorage: 'Supports microSDHC and microSDXC recording workflow',
    recordingFormats: ['24-bit', '32-bit float WAV'],
    maxSampleRateHz: 192000,
    bitDepthOptions: ['24-bit', '32-bit float'],
    channelCount: 2,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Compact 32-bit float field recorder with integrated timecode generation for camera workflows.',
    productionUseCases: ['videography', 'dual-system-audio', 'event-production', 'journalism'],
    storageWorkflowNotes:
      'Use recorder card as primary audio master, then mirror to SSD/NAS and verify metadata + TC consistency.',
    sourceReferences: [
      {
        title: 'FR-AV2 launch announcement',
        url: 'https://tascam.com/us/learn/detail/76870',
      },
      {
        title: 'FR-AV2 product page and recording media details',
        url: 'https://tascam.com/us/product/fr-av2',
      },
    ],
  },
  {
    id: 'tascam-studio-bridge',
    externalId: 'tascam:studio-bridge',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'TASCAM',
    model: 'Studio Bridge',
    category: 'desktop-production-console',
    releaseYear: 2024,
    releaseDate: '2024-10-08',
    releaseDatePrecision: 'exact',
    storageMedia: ['microSD', 'microSDHC', 'microSDXC'],
    maxStorage: 'Up to 512GB',
    recordingFormats: ['16-track recording'],
    maxSampleRateHz: 96000,
    bitDepthOptions: ['24-bit'],
    channelCount: 16,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Integrated audio interface/recorder with standalone multitrack recording to removable media.',
    productionUseCases: ['studio-tracking', 'live-capture', 'post-audio-prep'],
    storageWorkflowNotes:
      'Use media rotation policy and session exports to DAW storage with checksum verification.',
    sourceReferences: [
      {
        title: 'Studio Bridge launch announcement',
        url: 'https://tascam.com/us/learn/detail/77824',
      },
      {
        title: 'Studio Bridge product details (recording media support)',
        url: 'https://tascam.com/us/product/studio_bridge',
      },
    ],
  },
  {
    id: 'deity-pr-2',
    externalId: 'deity:pr-2',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Deity',
    model: 'PR-2',
    category: 'pocket-recorder',
    releaseYear: 2024,
    releaseDate: '2024-07-18',
    releaseDatePrecision: 'exact',
    storageMedia: ['microSDHC', 'microSDXC'],
    maxStorage: 'Typically up to 128GB in distributor specs (card included in some kits)',
    recordingFormats: ['24-bit', '32-bit float WAV/BWF'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['24-bit', '32-bit float'],
    channelCount: 2,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Pocket 32-bit float recorder focused on low-profile production and timecode-enabled workflows.',
    productionUseCases: ['wedding-audio', 'reality-tv', 'run-and-gun-dialogue'],
    storageWorkflowNotes:
      'Ingest recorder files as isolated production sound assets and archive with scene/talent metadata.',
    sourceReferences: [
      {
        title: 'PR-2 launch article',
        url: 'https://deitymic.com/social/youtube/introducing-the-pr-2-pocket-32-bit-recorder/',
      },
      {
        title: 'PR-2 product page',
        url: 'https://shop.deitymic.com/products/pr-2',
      },
    ],
  },
  {
    id: 'rode-interview-pro',
    externalId: 'rode:interview-pro',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'RODE',
    model: 'Interview PRO',
    category: 'wireless-recorder',
    releaseYear: 2024,
    releaseDate: '2024-04-01',
    releaseDatePrecision: 'month',
    storageMedia: ['internal-flash'],
    maxStorage: 'Onboard recording enabled (capacity managed via RODE ecosystem)',
    recordingFormats: ['32-bit float onboard recording'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['32-bit float'],
    channelCount: 1,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Handheld wireless mic with onboard recording and optional timecode-enabled workflows via Wireless PRO receiver.',
    productionUseCases: ['street-interviews', 'broadcast', 'event-hosting', 'podcast-field'],
    storageWorkflowNotes:
      'Offload onboard recordings after session and keep timecode-linked copies for edit-safe syncing.',
    sourceReferences: [
      {
        title: 'RODE product release dates',
        url: 'https://help.rode.com/hc/en-us/articles/11995458121999-R%C3%98DE-Product-Release-dates',
      },
      {
        title: 'Interview PRO setup and onboard recording behavior',
        url: 'https://help.rode.com/hc/en-us/articles/9745885285647-Getting-Started-with-the-Interview-PRO',
      },
    ],
  },
  {
    id: 'rode-wireless-go-3rd-gen',
    externalId: 'rode:wireless-go-3rd-gen',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'RODE',
    model: 'Wireless GO (3rd Gen)',
    category: 'wireless-recorder',
    releaseYear: 2024,
    releaseDate: '2024-12-01',
    releaseDatePrecision: 'month',
    storageMedia: ['internal-flash'],
    maxStorage: 'Over 40h of 32-bit float onboard recording',
    recordingFormats: ['32-bit float onboard recording'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['32-bit float'],
    channelCount: 2,
    supportsTimecode: false,
    requiresSeparateStorageWorkflow: true,
    description:
      'Third-gen compact wireless system with extended onboard recording intended for creator and production capture.',
    productionUseCases: ['mobile-production', 'doc-interviews', 'content-shoots'],
    storageWorkflowNotes:
      'Export and archive transmitter recordings frequently to avoid cyclic overwrite in long-running shoots.',
    sourceReferences: [
      {
        title: 'RODE product release dates',
        url: 'https://help.rode.com/hc/en-us/articles/11995458121999-R%C3%98DE-Product-Release-dates',
      },
      {
        title: 'Wireless GO (3rd Gen) onboard recording behavior',
        url: 'https://help.rode.com/hc/en-us/articles/11414410470287-Does-Gain-Assist-apply-to-the-Wireless-GO-3rd-Gen-onboard-recordings',
      },
    ],
  },
  {
    id: 'tascam-fr-av4',
    externalId: 'tascam:fr-av4',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'TASCAM',
    model: 'FR-AV4',
    category: 'field-recorder',
    releaseYear: 2025,
    releaseDate: '2025-09-01',
    releaseDatePrecision: 'month',
    storageMedia: ['SDXC'],
    maxStorage: 'Up to 512GB',
    recordingFormats: ['24-bit', '32-bit float'],
    maxSampleRateHz: 192000,
    bitDepthOptions: ['24-bit', '32-bit float'],
    channelCount: 6,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Four-channel field recorder/mixer with HDMI sync and direct multi-track SDXC recording.',
    productionUseCases: ['film-production', 'video-journalism', 'field-sound-design'],
    storageWorkflowNotes:
      'Record six tracks to SDXC and maintain ingest reports (track mapping + TC) before media clear.',
    sourceReferences: [
      {
        title: 'FR-AV4 launch announcement',
        url: 'https://tascam.jp/int/magazines/news/press-release',
      },
      {
        title: 'FR-AV4 key features (records to SDXC up to 512GB)',
        url: 'https://tascam.jp/int/product/fr-av4/top',
      },
    ],
  },
  {
    id: 'dji-mic-3',
    externalId: 'dji:mic-3',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'DJI',
    model: 'Mic 3',
    category: 'wireless-recorder',
    releaseYear: 2025,
    releaseDate: '2025-08-28',
    releaseDatePrecision: 'exact',
    storageMedia: ['internal-flash'],
    maxStorage: '32GB per transmitter',
    recordingFormats: ['24-bit', '32-bit float internal dual-file recording'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['24-bit', '32-bit float'],
    channelCount: 4,
    supportsTimecode: true,
    requiresSeparateStorageWorkflow: true,
    description:
      'Latest DJI wireless production mic system with high-capacity internal recording and timecode support.',
    productionUseCases: ['multi-camera-production', 'events', 'creator-shoots', 'broadcast-lite'],
    storageWorkflowNotes:
      'Use transmitter-level ingest and file verification because dual-file internal tracks can diverge by processing mode.',
    sourceReferences: [
      {
        title: 'DJI Mic 3 launch announcement',
        url: 'https://www.dji.com/media-center/announcements/dji-release-mic-3-us',
      },
      {
        title: 'DJI Mic 3 launch program details',
        url: 'https://www.dji.com/pr/media-center/announcements/dji-ifa-2025-us',
      },
    ],
  },
  {
    id: 'panasonic-dmw-dms1',
    externalId: 'panasonic:dmw-dms1',
    source: 'seed',
    lastSeenAt: '2026-03-02T00:00:00.000Z',
    isDeprecated: false,
    brand: 'Panasonic',
    model: 'LUMIX DMW-DMS1',
    category: 'camera-attached-digital-mic',
    releaseYear: 2026,
    releaseDate: '2026-02-24',
    releaseDatePrecision: 'exact',
    storageMedia: ['camera-media'],
    maxStorage: 'Depends on connected camera media workflow',
    recordingFormats: ['32-bit float digital capture pipeline'],
    maxSampleRateHz: 48000,
    bitDepthOptions: ['32-bit float'],
    channelCount: 2,
    supportsTimecode: false,
    requiresSeparateStorageWorkflow: true,
    description:
      'Hotshoe digital shotgun microphone that relies on camera media and backup channel strategies.',
    productionUseCases: ['hybrid-shooting', 'vlog', 'interview', 'camera-native-audio'],
    storageWorkflowNotes:
      'Since audio is camera-media dependent, backup workflow must follow camera card policy and channel validation.',
    sourceReferences: [
      {
        title: 'Panasonic official DMW-DMS1 announcement',
        url: 'https://na.panasonic.com/news/panasonic-introduces-new-digital-shotgun-microphone-dmw-dms1',
      },
      {
        title: 'Panasonic product page (workflow and backup modes)',
        url: 'https://shop.panasonic.com/products/lumix-digital-shotgun-microphone-dmw-dms1',
      },
    ],
  },
];

const normalizeAudioStorageDevice = (device: AudioStorageDevice): AudioStorageDevice => {
  const normalizedId = normalizeId(device.id);
  const normalizedBrand = device.brand.trim();
  const normalizedModel = device.model.trim();
  const normalizedDate = device.releaseDate.trim();
  const normalizedMedia = uniq(device.storageMedia);
  const normalizedFormats = uniq(device.recordingFormats.map((item) => item.trim()).filter(Boolean));
  const normalizedBits = uniq(device.bitDepthOptions.map((item) => item.trim()).filter(Boolean));
  const normalizedUseCases = uniq(device.productionUseCases.map((item) => item.trim()).filter(Boolean));
  const normalizedReferences = uniq(
    device.sourceReferences.map((ref) => JSON.stringify({ title: ref.title.trim(), url: ref.url.trim() }))
  ).map((ref) => JSON.parse(ref) as AudioStorageReference);

  return {
    ...device,
    id: normalizedId,
    brand: normalizedBrand,
    model: normalizedModel,
    releaseDate: normalizedDate,
    storageMedia: normalizedMedia,
    recordingFormats: normalizedFormats,
    bitDepthOptions: normalizedBits,
    productionUseCases: normalizedUseCases,
    sourceReferences: normalizedReferences,
  };
};

const validatedAudioStorageDevices: AudioStorageDevice[] = [];
const seenIds = new Set<string>();

for (const raw of seedAudioStorageDevices) {
  const normalized = normalizeAudioStorageDevice(raw);
  const parsed = audioStorageDeviceSchema.parse(normalized);
  if (seenIds.has(parsed.id)) {
    throw new Error(`Duplicate audio storage device id: ${parsed.id}`);
  }
  seenIds.add(parsed.id);
  validatedAudioStorageDevices.push(parsed);
}

export const AUDIO_STORAGE_DEVICE_DATABASE: AudioStorageDevice[] = validatedAudioStorageDevices;

export const getAudioStorageDeviceById = (id: string): AudioStorageDevice | undefined => {
  const normalized = normalizeId(id);
  return AUDIO_STORAGE_DEVICE_DATABASE.find((item) => item.id === normalized);
};

export const getAudioStorageDevicesByCategory = (
  category: AudioStorageDeviceCategory
): AudioStorageDevice[] => AUDIO_STORAGE_DEVICE_DATABASE.filter((item) => item.category === category);

export const getAudioStorageDevicesByYearRange = (
  fromYear: number,
  toYear: number
): AudioStorageDevice[] => {
  const minYear = Math.min(fromYear, toYear);
  const maxYear = Math.max(fromYear, toYear);
  return AUDIO_STORAGE_DEVICE_DATABASE.filter(
    (item) => item.releaseYear >= minYear && item.releaseYear <= maxYear
  );
};

export const getAudioStorageDevicesByStorageMedium = (
  medium: AudioStorageMedium
): AudioStorageDevice[] =>
  AUDIO_STORAGE_DEVICE_DATABASE.filter((item) => item.storageMedia.includes(medium));

export const searchAudioStorageDevices = (params?: {
  q?: string;
  category?: AudioStorageDeviceCategory | string;
  storageMedium?: AudioStorageMedium | string;
  yearFrom?: number;
  yearTo?: number;
  brand?: string;
}): AudioStorageDevice[] => {
  const q = params?.q?.trim().toLowerCase() ?? '';
  const category = params?.category?.trim().toLowerCase() ?? '';
  const storageMedium = params?.storageMedium?.trim().toLowerCase() ?? '';
  const brand = params?.brand?.trim().toLowerCase() ?? '';
  const yearFrom = params?.yearFrom ?? 2020;
  const yearTo = params?.yearTo ?? 2026;
  const minYear = Math.min(yearFrom, yearTo);
  const maxYear = Math.max(yearFrom, yearTo);

  return AUDIO_STORAGE_DEVICE_DATABASE.filter((item) => {
    if (item.releaseYear < minYear || item.releaseYear > maxYear) return false;
    if (brand && item.brand.toLowerCase() !== brand) return false;
    if (category && item.category.toLowerCase() !== category) return false;
    if (storageMedium && !item.storageMedia.some((entry) => entry.toLowerCase() === storageMedium)) {
      return false;
    }
    if (!q) return true;

    const haystack = [
      item.brand,
      item.model,
      item.category,
      item.description,
      item.maxStorage,
      item.storageWorkflowNotes,
      ...item.productionUseCases,
      ...item.recordingFormats,
      ...item.bitDepthOptions,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  }).sort((a, b) => {
    if (a.releaseYear !== b.releaseYear) return a.releaseYear - b.releaseYear;
    const byBrand = a.brand.localeCompare(b.brand, 'nb');
    if (byBrand !== 0) return byBrand;
    return a.model.localeCompare(b.model, 'nb');
  });
};

