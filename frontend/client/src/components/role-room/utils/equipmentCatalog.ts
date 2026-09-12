/**
 * Utstyrs-katalog for foto/video — brukt i profilens «Utstyr / gear»-felt.
 * Gir forslag med kategori slik at UI kan vise et ikon per type (kamera,
 * objektiv, drone, lys, lyd, gimbal, rigg, software). Brukeren kan også
 * skrive inn eget utstyr som ikke står i katalogen (freeSolo).
 */

export type EquipmentCategory =
  | 'camera'
  | 'lens'
  | 'drone'
  | 'gimbal'
  | 'light'
  | 'audio'
  | 'support'
  | 'software';

export interface EquipmentCatalogItem {
  name: string;
  category: EquipmentCategory;
}

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  camera: 'Kamera',
  lens: 'Objektiv',
  drone: 'Drone',
  gimbal: 'Gimbal / stabilisering',
  light: 'Lys',
  audio: 'Lyd',
  support: 'Stativ / rigg',
  software: 'Programvare',
};

export const EQUIPMENT_CATALOG: EquipmentCatalogItem[] = [
  // Kamera
  { name: 'Sony A7 IV', category: 'camera' },
  { name: 'Sony A7S III', category: 'camera' },
  { name: 'Sony FX3', category: 'camera' },
  { name: 'Sony FX6', category: 'camera' },
  { name: 'Sony FX30', category: 'camera' },
  { name: 'Canon EOS R5', category: 'camera' },
  { name: 'Canon EOS R6 Mark II', category: 'camera' },
  { name: 'Canon C70', category: 'camera' },
  { name: 'Blackmagic Pocket 6K', category: 'camera' },
  { name: 'Blackmagic URSA', category: 'camera' },
  { name: 'RED Komodo', category: 'camera' },
  { name: 'Panasonic GH6', category: 'camera' },
  { name: 'Panasonic S5 II', category: 'camera' },
  { name: 'Nikon Z6 II', category: 'camera' },
  { name: 'Nikon Z8', category: 'camera' },
  { name: 'Fujifilm X-H2S', category: 'camera' },

  // Objektiv
  { name: 'Sony 24-70mm f/2.8 GM', category: 'lens' },
  { name: 'Sony 16-35mm f/2.8 GM', category: 'lens' },
  { name: 'Sony 35mm f/1.4 GM', category: 'lens' },
  { name: 'Sony 85mm f/1.4 GM', category: 'lens' },
  { name: 'Canon RF 24-70mm f/2.8', category: 'lens' },
  { name: 'Canon RF 50mm f/1.2', category: 'lens' },
  { name: 'Sigma 24-70mm f/2.8 Art', category: 'lens' },
  { name: 'Sigma 18-35mm f/1.8', category: 'lens' },
  { name: 'Tamron 28-75mm f/2.8', category: 'lens' },

  // Drone
  { name: 'DJI Mavic 3 Pro', category: 'drone' },
  { name: 'DJI Air 3', category: 'drone' },
  { name: 'DJI Mini 4 Pro', category: 'drone' },
  { name: 'DJI Inspire 3', category: 'drone' },
  { name: 'DJI Avata 2', category: 'drone' },

  // Gimbal
  { name: 'DJI RS 4', category: 'gimbal' },
  { name: 'DJI RS 4 Pro', category: 'gimbal' },
  { name: 'DJI RS 3', category: 'gimbal' },
  { name: 'DJI Ronin 4D', category: 'gimbal' },
  { name: 'Zhiyun Crane 4', category: 'gimbal' },

  // Lys
  { name: 'Aputure 600D', category: 'light' },
  { name: 'Aputure 300X', category: 'light' },
  { name: 'Aputure LS 60x', category: 'light' },
  { name: 'Amaran 200x', category: 'light' },
  { name: 'Nanlite Forza 500', category: 'light' },
  { name: 'Godox VL150', category: 'light' },
  { name: 'Aputure MC (RGB)', category: 'light' },

  // Lyd
  { name: 'Rode Wireless GO II', category: 'audio' },
  { name: 'DJI Mic 2', category: 'audio' },
  { name: 'Sennheiser MKH 416', category: 'audio' },
  { name: 'Sennheiser MKE 600', category: 'audio' },
  { name: 'Zoom H6', category: 'audio' },
  { name: 'Deity S-Mic 2', category: 'audio' },

  // Stativ / rigg
  { name: 'Manfrotto stativ', category: 'support' },
  { name: 'Sachtler fluidhode', category: 'support' },
  { name: 'SmallRig cage', category: 'support' },
  { name: 'Slider / dolly', category: 'support' },
  { name: 'Easyrig', category: 'support' },

  // Programvare
  { name: 'DaVinci Resolve', category: 'software' },
  { name: 'Adobe Premiere Pro', category: 'software' },
  { name: 'Final Cut Pro', category: 'software' },
  { name: 'Adobe After Effects', category: 'software' },
  { name: 'Adobe Photoshop', category: 'software' },
  { name: 'Adobe Lightroom', category: 'software' },
];

/** Finn kategori for et utstyrsnavn (for ikon-visning); default 'support'. */
export function categoryForEquipment(name: string): EquipmentCategory {
  const hit = EQUIPMENT_CATALOG.find(
    (e) => e.name.toLowerCase() === name.trim().toLowerCase(),
  );
  return hit?.category ?? 'support';
}
