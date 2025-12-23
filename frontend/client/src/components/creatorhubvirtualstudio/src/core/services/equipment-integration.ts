/**
 * Equipment Integration Service
 *
 * Connects Virtual Studio to ComprehensiveGearDatabase
 * Benefits: * - Real equipment specs (power, beam angle, weight)
 * - Accurate light modeling from real products
 * - Equipment images for realistic 3D models
 * - Price information for cost calculations
 * - Brand/model authenticity
 */

import { logger } from './logger';

const log = logger.module('EquipmentIntegration');

export interface EquipmentSpec {
  id: string;
  brand: string;
  model: string;
  category: 'cameras' | 'lenses' | 'flash' | 'lighting' | 'audio' | 'tripods' | 'support';
  releaseYear: number;
  specifications: {
    // Lighting specs
    power?: number; // Watts
    beam?: number; // Degrees
    colorTemp?: number; // Kelvin
    cri?: number; // Color Rendering Index

    // Camera specs
    sensor?: [number, number]; // [width, height] in mm
    megapixels?: number;
    iso?: { min: number; max: number };

    // Lens specs
    focalLength?: number | [number, number]; // mm or [min, max] for zoom
    maxAperture?: number;
    minFocusDistance?: number; // meters

    // Physical
    weight?: number; // kg
    dimensions?: [number, number, number]; // [w, h, d] in cm
  };
  images?: string[];
  price?: {
    msrp?: number;
    currency: string;
  };
  discontinued?: boolean;
}

/**
 * Fetch equipment from database
 */
export async function searchEquipment(params: {
  query?: string;
  brand?: string;
  category?: string;
  year?: string;
  limit?: number;
}): Promise<EquipmentSpec[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.append('q', params.query);
    if (params.brand) searchParams.append('brand', params.brand);
    if (params.category) searchParams.append('category', params.category);
    if (params.year) searchParams.append('year', params.year);
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const response = await fetch(`/api/equipment/search?${searchParams.toString()}`);
    const data = await response.json();

    if (data.success) {
      return data.data || [];
    }

    return [];
  } catch (error) {
    log.error('Equipment search failed: ', error);
    return [];
  }
}

/**
 * Get equipment by ID
 */
export async function getEquipmentById(id: string): Promise<EquipmentSpec | null> {
  try {
    const response = await fetch(`/api/equipment/${id}`);
    const data = await response.json();

    if (data.success) {
      return data.data;
    }

    return null;
  } catch (error) {
    log.error('Equipment fetch failed:', error);
    return null;
  }
}

/**
 * Get lighting equipment (for Virtual Studio)
 */
export async function getLightingEquipment(params?: {
  brand?: string;
  minPower?: number;
  maxPower?: number;
}): Promise<EquipmentSpec[]> {
  const equipment = await searchEquipment({
    category: 'lighting',
    brand: params?.brand,
  });

  // Filter by power if specified
  if (params?.minPower !== undefined || params?.maxPower !== undefined) {
    return equipment.filter((item) => {
      const power = item.specifications.power;
      if (!power) return false;
      if (params.minPower !== undefined && power < params.minPower) return false;
      if (params.maxPower !== undefined && power > params.maxPower) return false;
      return true;
    });
  }

  return equipment;
}

/**
 * Get camera equipment
 */
export async function getCameraEquipment(params?: { brand?: string }): Promise<EquipmentSpec[]> {
  return searchEquipment({
    category: 'cameras',
    brand: params?.brand,
  });
}

/**
 * Get lens equipment
 */
export async function getLensEquipment(params?: {
  brand?: string;
  focalLength?: number;
}): Promise<EquipmentSpec[]> {
  const equipment = await searchEquipment({
    category: 'lenses',
    brand: params?.brand,
  });

  // Filter by focal length if specified
  if (params?.focalLength !== undefined) {
    return equipment.filter((item) => {
      const fl = item.specifications.focalLength;
      if (!fl) return false;

      // Handle zoom lenses
      if (Array.isArray(fl)) {
        return params.focalLength! >= fl[0] && params.focalLength! <= fl[1];
      }

      // Handle prime lenses (±5mm tolerance)
      return Math.abs(fl - params.focalLength!) <= 5;
    });
  }

  return equipment;
}

/**
 * Convert equipment to Virtual Studio light node
 */
export function equipmentToLightNode(equipment: EquipmentSpec): any {
  const power = equipment.specifications.power || 500;
  const beam = equipment.specifications.beam || 60;
  const cct = equipment.specifications.colorTemp || 5600;

  return {
    id: `light_${equipment.id}`,
    type: 'light',
    name: `${equipment.brand} ${equipment.model}`,
    visible: true,
    userData: {
      brand: equipment.brand,
      model: equipment.model,
      power: power,
      cct: cct,
      equipmentId: equipment.id,
      realEquipment: true, // Mark as real equipment
    },
    transform: {
      position: [0, 1.5, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    },
    light: {
      power: power / 1000, // Convert watts to normalized power
      beam: beam,
      cct: cct,
      modifier: beam < 40 ? 'spot' : 'softbox',
      modifierSize: [0.6, 0.6] as [number, number],
    },
  };
}

/**
 * Convert equipment to Virtual Studio camera node
 */
export function equipmentToCameraNode(equipment: EquipmentSpec, lens?: EquipmentSpec): any {
  const sensor = equipment.specifications.sensor || [36, 24];
  const focalLength = lens?.specifications.focalLength || 50;
  const aperture = lens?.specifications.maxAperture || 2.8;

  return {
    id: `cam_${equipment.id}`,
    type: 'camera',
    name: `${equipment.brand} ${equipment.model}`,
    visible: true,
    userData: {
      brand: equipment.brand,
      model: equipment.model,
      equipmentId: equipment.id,
      lensId: lens?.id,
      realEquipment: true,
    },
    transform: {
      position: [3, 1.5, 3] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    },
    camera: {
      sensor: sensor as [number, number],
      focalLength: Array.isArray(focalLength) ? focalLength[0] : focalLength,
      aperture: aperture,
      iso: 100,
      shutter: 1 / 125,
    },
  };
}

/**
 * Calculate equipment cost for a scene
 */
export async function calculateSceneCost(sceneNodes: unknown[]): Promise<{
  items: Array<{ name: string; price: number; currency: string }>;
  totalMSRP: number;
  currency: string;
}> {
  const items: Array<{ name: string; price: number; currency: string }> = [];
  let totalMSRP = 0;

  for (const node of sceneNodes) {
    const equipmentId = node.userData?.equipmentId;
    if (!equipmentId) continue;

    const equipment = await getEquipmentById(equipmentId);
    if (!equipment || !equipment.price?.msrp) continue;

    items.push({
      name: `${equipment.brand} ${equipment.model}`,
      price: equipment.price.msrp,
      currency: equipment.price.currency,
    });

    totalMSRP += equipment.price.msrp;
  }

  return {
    items,
    totalMSRP,
    currency: items[0]?.currency || 'NOK',
  };
}

/**
 * Get popular lighting setups
 */
export async function getPopularSetups(): Promise<
  Array<{
    name: string;
    description: string;
    equipment: EquipmentSpec[];
    cost: number;
  }>
> {
  // Predefined popular setups
  const setups = [
    {
      name: 'Studio Portrait (3-Point)',
      description: 'Classic 3-point lighting with key, fill, and rim',
      brands: ['Profoto','Godox','Elinchrom'],
      minPower: 250,
      count: 3,
    },
    {
      name: 'Product Photography',
      description: 'Soft even lighting for products',
      brands: ['Profoto','Elinchrom'],
      minPower: 200,
      count: 2,
    },
    {
      name: 'Interview Setup',
      description: 'Key light + fill for talking head interviews',
      brands: ['Aputure', 'Godox'],
      minPower: 100,
      count: 2,
    },
  ];

  const results = [];

  for (const setup of setups) {
    const equipment = await getLightingEquipment({
      brand: setup.brands[0],
      minPower: setup.minPower,
    });

    const selectedEquipment = equipment.slice(0, setup.count);
    const cost = selectedEquipment.reduce((sum, eq) => sum + (eq.price?.msrp || 0), 0);

    results.push({
      name: setup.name,
      description: setup.description,
      equipment: selectedEquipment,
      cost,
    });
  }

  return results;
}

/**
 * Get recommended equipment based on scenario
 */
export async function getRecommendedEquipment(
  scenario: 'portrait' | 'product' | 'video' | 'landscape',
): Promise<{
  lights: EquipmentSpec[];
  camera: EquipmentSpec | null;
  lens: EquipmentSpec | null;
}> {
  let lights: EquipmentSpec[] = [];
  let camera: EquipmentSpec | null = null;
  let lens: EquipmentSpec | null = null;

  switch (scenario) {
    case 'portrait':
      lights = await getLightingEquipment({ minPower: 250 });
      const cameras = await getCameraEquipment({ brand: 'Canon' });
      camera = cameras[0] || null;
      const lenses = await getLensEquipment({ focalLength: 85 });
      lens = lenses[0] || null;
      break;

    case 'product':
      lights = await getLightingEquipment({ minPower: 200 });
      lights = lights.slice(0, 2); // 2 lights for product
      break;

    case 'video':
      lights = await getLightingEquipment({ minPower: 100 });
      lights = lights.slice(0, 3); // 3-point lighting
      break;

    case 'landscape': // Landscape usually doesn't need studio lights
      const landscapeCameras = await getCameraEquipment();
      camera = landscapeCameras[0] || null;
      const wideLenses = await getLensEquipment({ focalLength: 24 });
      lens = wideLenses[0] || null;
      break;
  }

  return { lights: lights.slice(0, 3), camera, lens };
}

/**
 * Equipment library for Virtual Studio asset browser
 */
export async function getEquipmentLibrary(): Promise<{
  categories: Array<{
    name: string;
    items: EquipmentSpec[];
  }>;
}> {
  const [lighting, cameras, lenses] = await Promise.all([
    getLightingEquipment(),
    getCameraEquipment(),
    getLensEquipment(),
  ]);

  return {
    categories: [
      { name: 'Lighting', items: lighting.slice(0, 20) },
      { name: 'Cameras', items: cameras.slice(0, 20) },
      { name:'Lenses', items: lenses.slice(0, 20) },
    ],
  };
}
