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
