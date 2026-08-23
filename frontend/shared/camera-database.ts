/**
 * CreatorHub Norge - World Camera Database
 * Comprehensive database of professional cameras with memory card optimization
 */

export interface CameraSpec {
  brand: string;
  model: string;
  megapixels: number;
  fileFormat: string[];
  averageRawSize: number; // MB per RAW file
  averageCrawSize?: number; // MB per compressed RAW
  cardTypes: string[];
  category: 'mirrorless' | 'dslr' | 'medium_format' | 'cinema';
  year: number;
  /** Maks video-bitrate (Mbps) for minutt-estimater i video-prosjekter. */
  maxVideoBitrateMbps?: number;
}

export const WORLD_CAMERA_DATABASE: CameraSpec[] = [
  // Canon Cameras (6D Production Year 2012 and Newer)

  // Latest Canon Mirrorless (2020+)
  {
    brand: 'Canon',
    model: 'EOS R5',
    megapixels: 45,
    fileFormat: ['CR3', 'JPEG'],
    averageRawSize: 50,
    averageCrawSize: 25,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2020,
  },
  {
    brand: 'Canon',
    model: 'EOS R5 Mark II',
    megapixels: 45,
    fileFormat: ['CR3', 'JPEG', 'HEIF'],
    averageRawSize: 52,
    averageCrawSize: 26,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2024,
  },
  {
    brand: 'Canon',
    model: 'EOS R6 Mark II',
    megapixels: 24,
    fileFormat: ['CR3', 'JPEG'],
    averageRawSize: 28,
    averageCrawSize: 14,
    cardTypes: ['SD UHS-II'], // FAKTA: R6 Mark II støtter IKKE CFexpress
    category: 'mirrorless',
    year: 2022,
  },
  {
    brand: 'Canon',
    model: 'EOS R6',
    megapixels: 20,
    fileFormat: ['CR3', 'JPEG'],
    averageRawSize: 24,
    averageCrawSize: 12,
    cardTypes: ['SD UHS-II'], // FAKTA: R6 støtter IKKE CFexpress, kun SD kort
    category: 'mirrorless',
    year: 2020,
  },
  {
    brand: 'Canon',
    model: 'EOS R3',
    megapixels: 24,
    fileFormat: ['CR3', 'JPEG'],
    averageRawSize: 28,
    averageCrawSize: 14,
    cardTypes: ['CFexpress Type B'],
    category: 'mirrorless',
    year: 2021,
  },
  {
    brand: 'Canon',
    model: 'EOS R7',
    megapixels: 32,
    fileFormat: ['CR3', 'JPEG'],
    averageRawSize: 35,
    averageCrawSize: 18,
    cardTypes: ['SD UHS-II'],
    category: 'mirrorless',
    year: 2022,
  },
  {
    brand: 'Canon',
    model: 'EOS R8',
    megapixels: 24,
    fileFormat: ['CR3', 'JPEG'],
    averageRawSize: 28,
    averageCrawSize: 14,
    cardTypes: ['SD UHS-II'],
    category: 'mirrorless',
    year: 2023,
  },
  {
    brand: 'Canon',
    model: 'EOS R10',
    megapixels: 24,
    fileFormat: ['CR3', 'JPEG'],
    averageRawSize: 28,
    averageCrawSize: 14,
    cardTypes: ['SD UHS-I'],
    category: 'mirrorless',
    year: 2022,
  },
  {
    brand: 'Canon',
    model: 'EOS R50',
    megapixels: 24,
    fileFormat: ['CR3', 'JPEG'],
    averageRawSize: 28,
    averageCrawSize: 14,
    cardTypes: ['SD UHS-I'],
    category: 'mirrorless',
    year: 2023,
  },
  {
    brand: 'Canon',
    model: 'EOS R100',
    megapixels: 24,
    fileFormat: ['CR3', 'JPEG'],
    averageRawSize: 28,
    averageCrawSize: 14,
    cardTypes: ['SD UHS-I'],
    category: 'mirrorless',
    year: 2023,
  },

  // Sony Cameras
  {
    brand: 'Sony',
    model: 'A7R V',
    megapixels: 61,
    fileFormat: ['ARW', 'JPEG'],
    averageRawSize: 65,
    averageCrawSize: 32,
    cardTypes: ['CFexpress Type A', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2022,
  },
  {
    brand: 'Sony',
    model: 'A7 IV',
    megapixels: 33,
    fileFormat: ['ARW', 'JPEG'],
    averageRawSize: 38,
    averageCrawSize: 19,
    cardTypes: ['CFexpress Type A', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2021,
  },
  {
    brand: 'Sony',
    model: 'A7S III',
    megapixels: 12,
    fileFormat: ['ARW', 'JPEG'],
    averageRawSize: 15,
    averageCrawSize: 8,
    cardTypes: ['CFexpress Type A', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2020,
  },
  {
    brand: 'Sony',
    model: 'FX3',
    megapixels: 12,
    fileFormat: ['ARW', 'JPEG'],
    averageRawSize: 15,
    averageCrawSize: 8,
    cardTypes: ['CFexpress Type A', 'SD UHS-II'],
    category: 'cinema',
    year: 2021,
  },
  {
    brand: 'Sony',
    model: 'FX30',
    megapixels: 20,
    fileFormat: ['ARW', 'JPEG'],
    averageRawSize: 24,
    averageCrawSize: 12,
    cardTypes: ['CFexpress Type A', 'SD UHS-II'],
    category: 'cinema',
    year: 2022,
  },

  // Nikon Cameras
  {
    brand: 'Nikon',
    model: 'Z9',
    megapixels: 45,
    fileFormat: ['NEF', 'JPEG'],
    averageRawSize: 50,
    averageCrawSize: 25,
    cardTypes: ['CFexpress Type B', 'XQD'],
    category: 'mirrorless',
    year: 2021,
  },
  {
    brand: 'Nikon',
    model: 'Z8',
    megapixels: 45,
    fileFormat: ['NEF', 'JPEG'],
    averageRawSize: 50,
    averageCrawSize: 25,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2023,
  },
  {
    brand: 'Nikon',
    model: 'Z7 II',
    megapixels: 45,
    fileFormat: ['NEF', 'JPEG'],
    averageRawSize: 50,
    averageCrawSize: 25,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2020,
  },
  {
    brand: 'Nikon',
    model: 'Z6 III',
    megapixels: 24,
    fileFormat: ['NEF', 'JPEG'],
    averageRawSize: 28,
    averageCrawSize: 14,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2024,
  },
  {
    brand: 'Nikon',
    model: 'Z6 II',
    megapixels: 24,
    fileFormat: ['NEF', 'JPEG'],
    averageRawSize: 28,
    averageCrawSize: 14,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2020,
  },
  {
    brand: 'Nikon',
    model: 'Z5',
    megapixels: 24,
    fileFormat: ['NEF', 'JPEG'],
    averageRawSize: 28,
    averageCrawSize: 14,
    cardTypes: ['SD UHS-II'],
    category: 'mirrorless',
    year: 2020,
  },

  // Fujifilm Cameras
  {
    brand: 'Fujifilm',
    model: 'X-T5',
    megapixels: 40,
    fileFormat: ['RAF', 'JPEG'],
    averageRawSize: 45,
    averageCrawSize: 22,
    cardTypes: ['SD UHS-I'],
    category: 'mirrorless',
    year: 2022,
  },
  {
    brand: 'Fujifilm',
    model: 'X-H2S',
    megapixels: 26,
    fileFormat: ['RAF', 'JPEG'],
    averageRawSize: 30,
    averageCrawSize: 15,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2022,
  },
  {
    brand: 'Fujifilm',
    model: 'X-H2',
    megapixels: 40,
    fileFormat: ['RAF', 'JPEG'],
    averageRawSize: 45,
    averageCrawSize: 22,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2022,
  },
  {
    brand: 'Fujifilm',
    model: 'X-S20',
    megapixels: 26,
    fileFormat: ['RAF', 'JPEG'],
    averageRawSize: 30,
    averageCrawSize: 15,
    cardTypes: ['SD UHS-I'],
    category: 'mirrorless',
    year: 2023,
  },
  {
    brand: 'Fujifilm',
    model: 'GFX100S',
    megapixels: 102,
    fileFormat: ['RAF', 'JPEG'],
    averageRawSize: 110,
    averageCrawSize: 55,
    cardTypes: ['SD UHS-II'],
    category: 'medium_format',
    year: 2021,
  },
  {
    brand: 'Fujifilm',
    model: 'GFX100 II',
    megapixels: 102,
    fileFormat: ['RAF', 'JPEG'],
    averageRawSize: 110,
    averageCrawSize: 55,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'medium_format',
    year: 2023,
  },

  // Panasonic Cameras
  {
    brand: 'Panasonic',
    model: 'S1R',
    megapixels: 47,
    fileFormat: ['RW2', 'JPEG'],
    averageRawSize: 52,
    averageCrawSize: 26,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2019,
  },
  {
    brand: 'Panasonic',
    model: 'S1H',
    megapixels: 24,
    fileFormat: ['RW2', 'JPEG'],
    averageRawSize: 28,
    averageCrawSize: 14,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2019,
  },
  {
    brand: 'Panasonic',
    model: 'S5 II',
    megapixels: 24,
    fileFormat: ['RW2', 'JPEG'],
    averageRawSize: 28,
    averageCrawSize: 14,
    cardTypes: ['SD UHS-II'],
    category: 'mirrorless',
    year: 2023,
  },

  // Olympus/OM System Cameras
  {
    brand: 'OM System',
    model: 'OM-1',
    megapixels: 20,
    fileFormat: ['ORF', 'JPEG'],
    averageRawSize: 24,
    averageCrawSize: 12,
    cardTypes: ['CFexpress Type B', 'SD UHS-II'],
    category: 'mirrorless',
    year: 2022,
  },
  {
    brand: 'OM System',
    model: 'OM-5',
    megapixels: 20,
    fileFormat: ['ORF', 'JPEG'],
    averageRawSize: 24,
    averageCrawSize: 12,
    cardTypes: ['SD UHS-I'],
    category: 'mirrorless',
    year: 2022,
  },
  // ── Utvidelse 2026-08: flere foto- og video-kameraer (reelle ca-spesifikasjoner) ──
  { brand: 'Fujifilm', model: 'X-T5', megapixels: 40, fileFormat: ['RAF', 'JPEG'], averageRawSize: 45, averageCrawSize: 30, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2022, maxVideoBitrateMbps: 360 },
  { brand: 'Fujifilm', model: 'X-H2S', megapixels: 26, fileFormat: ['RAF', 'JPEG'], averageRawSize: 30, averageCrawSize: 20, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'mirrorless', year: 2022, maxVideoBitrateMbps: 720 },
  { brand: 'Fujifilm', model: 'X100VI', megapixels: 40, fileFormat: ['RAF', 'JPEG'], averageRawSize: 45, averageCrawSize: 30, cardTypes: ['SD UHS-I'], category: 'mirrorless', year: 2024, maxVideoBitrateMbps: 200 },
  { brand: 'Fujifilm', model: 'GFX100 II', megapixels: 102, fileFormat: ['RAF', 'JPEG'], averageRawSize: 110, averageCrawSize: 70, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'medium_format', year: 2023, maxVideoBitrateMbps: 720 },
  { brand: 'Sony', model: 'A1', megapixels: 50, fileFormat: ['ARW', 'JPEG'], averageRawSize: 55, averageCrawSize: 35, cardTypes: ['CFexpress Type A', 'SD UHS-II'], category: 'mirrorless', year: 2021, maxVideoBitrateMbps: 600 },
  { brand: 'Sony', model: 'A9 III', megapixels: 24, fileFormat: ['ARW', 'JPEG'], averageRawSize: 28, averageCrawSize: 18, cardTypes: ['CFexpress Type A', 'SD UHS-II'], category: 'mirrorless', year: 2023, maxVideoBitrateMbps: 600 },
  { brand: 'Sony', model: 'A7C II', megapixels: 33, fileFormat: ['ARW', 'JPEG'], averageRawSize: 38, averageCrawSize: 24, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2023, maxVideoBitrateMbps: 600 },
  { brand: 'Sony', model: 'A6700', megapixels: 26, fileFormat: ['ARW', 'JPEG'], averageRawSize: 30, averageCrawSize: 19, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2023, maxVideoBitrateMbps: 600 },
  { brand: 'Canon', model: 'EOS R3', megapixels: 24, fileFormat: ['CR3', 'JPEG'], averageRawSize: 28, averageCrawSize: 15, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'mirrorless', year: 2021, maxVideoBitrateMbps: 2600 },
  { brand: 'Canon', model: 'EOS R7', megapixels: 33, fileFormat: ['CR3', 'JPEG'], averageRawSize: 38, averageCrawSize: 20, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2022, maxVideoBitrateMbps: 340 },
  { brand: 'Canon', model: 'EOS R8', megapixels: 24, fileFormat: ['CR3', 'JPEG'], averageRawSize: 28, averageCrawSize: 15, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2023, maxVideoBitrateMbps: 470 },
  { brand: 'Canon', model: 'EOS R10', megapixels: 24, fileFormat: ['CR3', 'JPEG'], averageRawSize: 28, averageCrawSize: 15, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2022, maxVideoBitrateMbps: 340 },
  { brand: 'Canon', model: 'EOS 5D Mark IV', megapixels: 30, fileFormat: ['CR2', 'JPEG'], averageRawSize: 37, cardTypes: ['CF', 'SD UHS-I'], category: 'dslr', year: 2016, maxVideoBitrateMbps: 500 },
  { brand: 'Nikon', model: 'Z6 III', megapixels: 24, fileFormat: ['NEF', 'JPEG'], averageRawSize: 30, averageCrawSize: 20, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'mirrorless', year: 2024, maxVideoBitrateMbps: 5800 },
  { brand: 'Nikon', model: 'Z7 II', megapixels: 46, fileFormat: ['NEF', 'JPEG'], averageRawSize: 52, averageCrawSize: 34, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'mirrorless', year: 2020, maxVideoBitrateMbps: 144 },
  { brand: 'Nikon', model: 'Zf', megapixels: 25, fileFormat: ['NEF', 'JPEG'], averageRawSize: 30, averageCrawSize: 20, cardTypes: ['SD UHS-II', 'microSD'], category: 'mirrorless', year: 2023, maxVideoBitrateMbps: 144 },
  { brand: 'Nikon', model: 'D850', megapixels: 46, fileFormat: ['NEF', 'JPEG'], averageRawSize: 52, cardTypes: ['XQD', 'SD UHS-II'], category: 'dslr', year: 2017, maxVideoBitrateMbps: 144 },
  { brand: 'Panasonic', model: 'Lumix S5 II', megapixels: 24, fileFormat: ['RW2', 'JPEG'], averageRawSize: 30, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2023, maxVideoBitrateMbps: 600 },
  { brand: 'Panasonic', model: 'Lumix G9 II', megapixels: 25, fileFormat: ['RW2', 'JPEG'], averageRawSize: 28, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2023, maxVideoBitrateMbps: 800 },
  { brand: 'Panasonic', model: 'Lumix GH7', megapixels: 25, fileFormat: ['RW2', 'JPEG'], averageRawSize: 28, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'mirrorless', year: 2024, maxVideoBitrateMbps: 1300 },
  { brand: 'OM System', model: 'OM-1 Mark II', megapixels: 20, fileFormat: ['ORF', 'JPEG'], averageRawSize: 22, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2024, maxVideoBitrateMbps: 202 },
  { brand: 'Leica', model: 'Q3', megapixels: 60, fileFormat: ['DNG', 'JPEG'], averageRawSize: 70, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2023, maxVideoBitrateMbps: 600 },
  { brand: 'Leica', model: 'SL3', megapixels: 60, fileFormat: ['DNG', 'JPEG'], averageRawSize: 70, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'mirrorless', year: 2024, maxVideoBitrateMbps: 600 },
  { brand: 'Hasselblad', model: 'X2D 100C', megapixels: 100, fileFormat: ['3FR', 'JPEG'], averageRawSize: 105, cardTypes: ['CFexpress Type B'], category: 'medium_format', year: 2022 },
  { brand: 'Sony', model: 'FX3', megapixels: 12, fileFormat: ['XAVC'], averageRawSize: 15, cardTypes: ['CFexpress Type A', 'SD UHS-II'], category: 'cinema', year: 2021, maxVideoBitrateMbps: 600 },
  { brand: 'Sony', model: 'FX6', megapixels: 12, fileFormat: ['XAVC'], averageRawSize: 15, cardTypes: ['CFexpress Type A', 'SD UHS-II'], category: 'cinema', year: 2020, maxVideoBitrateMbps: 600 },
  { brand: 'Sony', model: 'FX30', megapixels: 26, fileFormat: ['XAVC'], averageRawSize: 20, cardTypes: ['CFexpress Type A', 'SD UHS-II'], category: 'cinema', year: 2022, maxVideoBitrateMbps: 600 },
  { brand: 'Canon', model: 'EOS C70', megapixels: 9, fileFormat: ['XF-AVC', 'MP4'], averageRawSize: 12, cardTypes: ['SD UHS-II'], category: 'cinema', year: 2020, maxVideoBitrateMbps: 410 },
  { brand: 'Canon', model: 'EOS C80', megapixels: 6, fileFormat: ['XF-AVC', 'RAW'], averageRawSize: 12, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'cinema', year: 2024, maxVideoBitrateMbps: 2600 },
  { brand: 'RED', model: 'Komodo 6K', megapixels: 19, fileFormat: ['R3D'], averageRawSize: 25, cardTypes: ['CFast 2.0'], category: 'cinema', year: 2020, maxVideoBitrateMbps: 2200 },
  { brand: 'Blackmagic', model: 'Pocket Cinema 6K Pro', megapixels: 21, fileFormat: ['BRAW'], averageRawSize: 25, cardTypes: ['CFast 2.0', 'SD UHS-II'], category: 'cinema', year: 2021, maxVideoBitrateMbps: 2400 },
  { brand: 'Blackmagic', model: 'URSA Mini Pro 12K', megapixels: 80, fileFormat: ['BRAW'], averageRawSize: 60, cardTypes: ['CFast 2.0', 'SD UHS-II'], category: 'cinema', year: 2020, maxVideoBitrateMbps: 5000 },
  // ── 2024–2026-lanseringer (kildebelagt aug 2026: DPReview/B&H/produsent) ──
  { brand: 'Canon', model: 'EOS R5 Mark II', megapixels: 45, fileFormat: ['CR3', 'JPEG'], averageRawSize: 50, averageCrawSize: 25, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'mirrorless', year: 2024, maxVideoBitrateMbps: 2600 },
  { brand: 'Canon', model: 'EOS R1', megapixels: 24, fileFormat: ['CR3', 'JPEG'], averageRawSize: 28, averageCrawSize: 15, cardTypes: ['CFexpress Type B'], category: 'mirrorless', year: 2024, maxVideoBitrateMbps: 2600 },
  { brand: 'Canon', model: 'EOS R6 Mark III', megapixels: 32, fileFormat: ['CR3', 'JPEG'], averageRawSize: 36, averageCrawSize: 19, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'mirrorless', year: 2025, maxVideoBitrateMbps: 2600 },
  { brand: 'Canon', model: 'EOS R50 V', megapixels: 24, fileFormat: ['CR3', 'JPEG'], averageRawSize: 28, averageCrawSize: 15, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2025, maxVideoBitrateMbps: 230 },
  { brand: 'Sony', model: 'A1 II', megapixels: 50, fileFormat: ['ARW', 'JPEG'], averageRawSize: 55, averageCrawSize: 35, cardTypes: ['CFexpress Type A', 'SD UHS-II'], category: 'mirrorless', year: 2024, maxVideoBitrateMbps: 600 },
  { brand: 'Sony', model: 'A7 V', megapixels: 33, fileFormat: ['ARW', 'JPEG'], averageRawSize: 38, averageCrawSize: 24, cardTypes: ['CFexpress Type A', 'SD UHS-II'], category: 'mirrorless', year: 2025, maxVideoBitrateMbps: 600 },
  { brand: 'Nikon', model: 'ZR', megapixels: 24, fileFormat: ['R3D', 'NEV', 'JPEG'], averageRawSize: 30, cardTypes: ['CFexpress Type B', 'microSD'], category: 'cinema', year: 2025, maxVideoBitrateMbps: 3600 },
  { brand: 'Nikon', model: 'Z5 II', megapixels: 24, fileFormat: ['NEF', 'JPEG'], averageRawSize: 30, averageCrawSize: 20, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2025, maxVideoBitrateMbps: 144 },
  { brand: 'Nikon', model: 'Z50 II', megapixels: 21, fileFormat: ['NEF', 'JPEG'], averageRawSize: 25, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2024, maxVideoBitrateMbps: 144 },
  { brand: 'Panasonic', model: 'Lumix S1R II', megapixels: 44, fileFormat: ['RW2', 'JPEG'], averageRawSize: 50, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'mirrorless', year: 2025, maxVideoBitrateMbps: 800 },
  { brand: 'Panasonic', model: 'Lumix S1 II', megapixels: 24, fileFormat: ['RW2', 'JPEG'], averageRawSize: 30, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'mirrorless', year: 2025, maxVideoBitrateMbps: 800 },
  { brand: 'Fujifilm', model: 'X-E5', megapixels: 40, fileFormat: ['RAF', 'JPEG'], averageRawSize: 45, averageCrawSize: 30, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2025, maxVideoBitrateMbps: 200 },
  { brand: 'Fujifilm', model: 'GFX100RF', megapixels: 102, fileFormat: ['RAF', 'JPEG'], averageRawSize: 110, averageCrawSize: 70, cardTypes: ['SD UHS-II'], category: 'medium_format', year: 2025, maxVideoBitrateMbps: 200 },
  { brand: 'OM System', model: 'OM-3', megapixels: 20, fileFormat: ['ORF', 'JPEG'], averageRawSize: 22, cardTypes: ['SD UHS-II'], category: 'mirrorless', year: 2025, maxVideoBitrateMbps: 202 },
  { brand: 'Sigma', model: 'BF', megapixels: 24, fileFormat: ['DNG', 'JPEG'], averageRawSize: 30, cardTypes: ['Intern lagring 230GB'], category: 'mirrorless', year: 2025, maxVideoBitrateMbps: 300 },
  // ── Cinema-kameraer 2022–2025 (kildebelagt aug 2026: CineD/YMCinema/produsent) ──
  { brand: 'ARRI', model: 'Alexa 35', megapixels: 12, fileFormat: ['ARRIRAW', 'ProRes'], averageRawSize: 20, cardTypes: ['Codex Compact Drive'], category: 'cinema', year: 2022, maxVideoBitrateMbps: 4600 },
  { brand: 'ARRI', model: 'Alexa Mini LF', megapixels: 9, fileFormat: ['ARRIRAW', 'ProRes'], averageRawSize: 18, cardTypes: ['Codex Compact Drive'], category: 'cinema', year: 2019, maxVideoBitrateMbps: 4100 },
  { brand: 'Sony', model: 'BURANO', megapixels: 36, fileFormat: ['X-OCN', 'XAVC'], averageRawSize: 40, cardTypes: ['CFexpress Type B'], category: 'cinema', year: 2023, maxVideoBitrateMbps: 3200 },
  { brand: 'Sony', model: 'VENICE 2', megapixels: 36, fileFormat: ['X-OCN', 'ProRes'], averageRawSize: 40, cardTypes: ['AXS Memory'], category: 'cinema', year: 2022, maxVideoBitrateMbps: 5200 },
  { brand: 'Canon', model: 'EOS C400', megapixels: 24, fileFormat: ['Cinema RAW Light', 'XF-AVC'], averageRawSize: 28, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'cinema', year: 2024, maxVideoBitrateMbps: 2600 },
  { brand: 'Canon', model: 'EOS C500 Mark II', megapixels: 19, fileFormat: ['Cinema RAW Light', 'XF-AVC'], averageRawSize: 24, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'cinema', year: 2019, maxVideoBitrateMbps: 2100 },
  { brand: 'RED', model: 'Komodo-X 6K', megapixels: 19, fileFormat: ['R3D'], averageRawSize: 25, cardTypes: ['CFexpress Type B'], category: 'cinema', year: 2023, maxVideoBitrateMbps: 2800 },
  { brand: 'RED', model: 'V-RAPTOR X 8K VV', megapixels: 35, fileFormat: ['R3D'], averageRawSize: 40, cardTypes: ['CFexpress Type B'], category: 'cinema', year: 2024, maxVideoBitrateMbps: 4400 },
  { brand: 'Blackmagic', model: 'PYXIS 6K', megapixels: 24, fileFormat: ['BRAW'], averageRawSize: 28, cardTypes: ['CFexpress Type B', 'SD UHS-II'], category: 'cinema', year: 2024, maxVideoBitrateMbps: 1200 },
  { brand: 'Blackmagic', model: 'PYXIS 12K', megapixels: 80, fileFormat: ['BRAW'], averageRawSize: 60, cardTypes: ['CFexpress Type B'], category: 'cinema', year: 2025, maxVideoBitrateMbps: 5000 },
  { brand: 'Blackmagic', model: 'URSA Cine 12K LF', megapixels: 80, fileFormat: ['BRAW'], averageRawSize: 60, cardTypes: ['Blackmagic Media Module'], category: 'cinema', year: 2024, maxVideoBitrateMbps: 7000 },
  { brand: 'DJI', model: 'Ronin 4D 6K', megapixels: 24, fileFormat: ['ProRes', 'H.264'], averageRawSize: 28, cardTypes: ['DJI PROSSD', 'CFexpress Type B'], category: 'cinema', year: 2021, maxVideoBitrateMbps: 1800 },
];

// Video Light Equipment Database
export interface VideoLightSpec {
  brand: string;
  model: string;
  type: 'led_panel' | 'cob_light' | 'tube_light' | 'ring_light';
  wattage: number;
  colorTemperature: string;
  cri: number;
  batteryLife?: number; // minutes
  powerType: string[];
  year: number;
}

export const VIDEO_LIGHTS_DATABASE: VideoLightSpec[] = [
  {
    brand: 'Aputure',
    model: '300d II',
    type: 'cob_light',
    wattage: 300,
    colorTemperature: '5600K',
    cri: 96,
    powerType: ['AC', 'V-Mount'],
    year: 2019,
  },
  {
    brand: 'Aputure',
    model: '600d Pro',
    type: 'cob_light',
    wattage: 600,
    colorTemperature: '5600K',
    cri: 96,
    powerType: ['AC', 'V-Mount'],
    year: 2020,
  },
  {
    brand: 'Godox',
    model: 'SL-60W',
    type: 'cob_light',
    wattage: 60,
    colorTemperature: '5600K',
    cri: 95,
    powerType: ['AC'],
    year: 2018,
  },
];

// Photo Flash Equipment Database
export interface PhotoFlashSpec {
  brand: string;
  model: string;
  type: 'speedlight' | 'studio_strobe' | 'monolight';
  power: number; // Watt-seconds
  recycleTime: number; // seconds
  colorTemperature: string;
  ttl: boolean;
  hss: boolean;
  year: number;
}

export const PHOTO_FLASH_DATABASE: PhotoFlashSpec[] = [
  {
    brand: 'Canon',
    model: 'Speedlite 600EX II-RT',
    type: 'speedlight',
    power: 60,
    recycleTime: 0.1,
    colorTemperature: '5600K',
    ttl: true,
    hss: true,
    year: 2016,
  },
  {
    brand: 'Godox',
    model: 'AD600Pro',
    type: 'monolight',
    power: 600,
    recycleTime: 0.01,
    colorTemperature: '5600K',
    ttl: true,
    hss: true,
    year: 2017,
  },
];

// Utility Functions
export function getPopularCameras(): CameraSpec[] {
  return WORLD_CAMERA_DATABASE.filter((camera) => camera.year >= 2020)
    .sort((a, b) => b.year - a.year)
    .slice(0, 10);
}

export function getCanonCameras(): CameraSpec[] {
  return WORLD_CAMERA_DATABASE.filter((camera) => camera.brand === 'Canon');
}

export function getSonyCameras(): CameraSpec[] {
  return WORLD_CAMERA_DATABASE.filter((camera) => camera.brand === 'Sony');
}

export function getNikonCameras(): CameraSpec[] {
  return WORLD_CAMERA_DATABASE.filter((camera) => camera.brand === 'Nikon');
}

export function getFujifilmCameras(): CameraSpec[] {
  return WORLD_CAMERA_DATABASE.filter((camera) => camera.brand === 'Fujifilm');
}

export function getPanasonicCameras(): CameraSpec[] {
  return WORLD_CAMERA_DATABASE.filter((camera) => camera.brand === 'Panasonic');
}

export function getSupportedBrands(): string[] {
  return Array.from(new Set(WORLD_CAMERA_DATABASE.map((camera) => camera.brand))).sort();
}

export function getCamerasByBrand(brand: string): CameraSpec[] {
  return WORLD_CAMERA_DATABASE.filter((camera) => camera.brand === brand);
}

export function getCamerasByCategory(category: CameraSpec['category']): CameraSpec[] {
  return WORLD_CAMERA_DATABASE.filter((camera) => camera.category === category);
}

export function getLatestCameras(): CameraSpec[] {
  return WORLD_CAMERA_DATABASE.filter((camera) => camera.year >= 2023).sort(
    (a, b) => b.year - a.year,
  );
}

export function detectNewCameraModels(): CameraSpec[] {
  return WORLD_CAMERA_DATABASE.filter((camera) => camera.year >= 2024);
}

export function searchAllEquipment(query: string) {
  const lowercaseQuery = query.toLowerCase();

  const cameras = WORLD_CAMERA_DATABASE.filter((item) =>
    `${item.brand} ${item.model}`.toLowerCase().includes(lowercaseQuery),
  );

  const videoLights = VIDEO_LIGHTS_DATABASE.filter((item) =>
    `${item.brand} ${item.model}`.toLowerCase().includes(lowercaseQuery),
  );

  const photoFlash = PHOTO_FLASH_DATABASE.filter((item) =>
    `${item.brand} ${item.model}`.toLowerCase().includes(lowercaseQuery),
  );

  return { cameras, videoLights, photoFlash };
}

export function searchCameras(query: string): CameraSpec[] {
  const lowercaseQuery = query.toLowerCase();
  return WORLD_CAMERA_DATABASE.filter(
    (camera) =>
      `${camera.brand} ${camera.model}`.toLowerCase().includes(lowercaseQuery) ||
      camera.brand.toLowerCase().includes(lowercaseQuery) ||
      camera.model.toLowerCase().includes(lowercaseQuery),
  );
}

export function getCameraByName(name: string): CameraSpec | null {
  return WORLD_CAMERA_DATABASE.find((camera) => `${camera.brand} ${camera.model}` === name) || null;
}

export function calculateCapacityEstimates(camera: CameraSpec | null) {
  if (!camera) {
    return {
      '128GB': { raw: 800, craw: 1600 },
      '256GB': { raw: 1600, craw: 3200 },
      '512GB': { raw: 3200, craw: 6400 },
      '1TB': { raw: 6400, craw: 12800 },
      '2TB': { raw: 12800, craw: 25600 },
    };
  }

  // Calculate estimates based on camera specs
  const baseRawSize = camera.megapixels * 1.5; // Rough estimate: 1.5MB per megapixel for RAW
  const baseCrawSize = baseRawSize * 0.6; // C-RAW is typically 60% of RAW

  return {
    '128GB': {
      raw: Math.floor(128000 / baseRawSize),
      craw: Math.floor(128000 / baseCrawSize),
    },
    '256GB': {
      raw: Math.floor(256000 / baseRawSize),
      craw: Math.floor(256000 / baseCrawSize),
    },
    '512GB': {
      raw: Math.floor(512000 / baseRawSize),
      craw: Math.floor(512000 / baseCrawSize),
    },
    '1TB': {
      raw: Math.floor(1024000 / baseRawSize),
      craw: Math.floor(1024000 / baseCrawSize),
    },
    '2TB': {
      raw: Math.floor(2048000 / baseRawSize),
      craw: Math.floor(2048000 / baseCrawSize),
    },
  };
}
