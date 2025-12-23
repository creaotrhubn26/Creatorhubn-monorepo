/**
 * Hair Styles Data Library
 * 
 * Defines available hairstyles for virtual actors with metadata.
 * Supports filtering by gender, age range, length, and style.
 * 
 * Phase 2A - Week 1: Initial implementation with Male Fashion Collection
 * Future: Add female, children, and textured hair styles
 */

export type HairGender = 'male' | 'female' | 'unisex';
export type HairAgeRange = 'child' | 'teen' | 'adult';
export type HairLength = 'short' | 'medium' | 'long';
export type HairStyle = 'straight' | 'wavy' | 'curly' | 'textured' | 'updo' | 'cards';

export interface HairStyleDefinition {
  id: string;
  name: string;
  description: string;
  gender: HairGender;
  ageRange: HairAgeRange;
  length: HairLength;
  style: HairStyle;
  modelPath: string;
  meshName?: string; // For multi-mesh GLB files: specific mesh to extract
  thumbnailPath?: string;
  polyCount?: number;
  tags?: string[];
}

/**
 * Male Fashion Hair Collection (21 styles)
 * Source: Sketchfab - Free Male Fashion Hair Collection 02 Lowpoly
 * License: CC-BY
 * File: free_male_fashion_hair_collection_02_lowpoly.glb
 * 
 * Note: This is a single GLB file containing 21 hairstyles as separate meshes.
 * The hairRenderingService will extract individual styles from the collection.
 */
export const MALE_FASHION_COLLECTION: HairStyleDefinition[] = [
  {
    id: 'male_crew_cut',
    name: 'Crew Cut',
    description: 'Classic short military-style cut',
    gender: 'male',
    ageRange: 'adult',
    length: 'short',
    style: 'straight',
    modelPath: '/library/models/hair/male/free_male_fashion_hair_collection_02_lowpoly.glb',
    meshName: 'Hair_Crew_Cut', // Specific mesh in multi-mesh GLB
    polyCount: 5000,
    tags: ['professional','military','clean'],
  },
  {
    id: 'male_buzz_cut',
    name: 'Buzz Cut',
    description: 'Very short all-around cut',
    gender: 'male',
    ageRange: 'adult',
    length: 'short',
    style: 'straight',
    modelPath: '/library/models/hair/male/free_male_fashion_hair_collection_02_lowpoly.glb',
    meshName: 'Hair_Buzz_Cut',
    polyCount: 3000,
    tags: ['athletic','minimal','clean'],
  },
  {
    id: 'male_side_part',
    name: 'Side Part',
    description: 'Classic side-parted business style',
    gender: 'male',
    ageRange: 'adult',
    length: 'short',
    style: 'straight',
    modelPath: '/library/models/hair/male/free_male_fashion_hair_collection_02_lowpoly.glb',
    meshName: 'Hair_Side_Part',
    polyCount: 6000,
    tags: ['professional','business','formal'],
  },
  {
    id: 'male_messy',
    name: 'Messy',
    description: 'Casual tousled look',
    gender: 'male',
    ageRange: 'adult',
    length: 'medium',
    style: 'wavy',
    modelPath: '/library/models/hair/male/free_male_fashion_hair_collection_02_lowpoly.glb',
    meshName: 'Hair_Messy',
    polyCount: 8000,
    tags: ['casual','modern','relaxed'],
  },
  {
    id: 'male_slicked_back',
    name: 'Slicked Back',
    description: 'Smooth combed-back style',
    gender: 'male',
    ageRange: 'adult',
    length: 'medium',
    style: 'straight',
    modelPath: '/library/models/hair/male/free_male_fashion_hair_collection_02_lowpoly.glb',
    meshName: 'Hair_Slicked_Back',
    polyCount: 7000,
    tags: ['formal','elegant','classic'],
  },
  {
    id: 'male_ponytail',
    name: 'Ponytail',
    description: 'Long hair tied back',
    gender: 'male',
    ageRange: 'adult',
    length: 'long',
    style: 'straight',
    modelPath: '/library/models/hair/male/free_male_fashion_hair_collection_02_lowpoly.glb',
    meshName: 'Hair_Ponytail',
    polyCount: 9000,
    tags: ['casual','artistic','modern'],
  },
  {
    id: 'male_man_bun',
    name: 'Man Bun',
    description: 'Long hair in top knot',
    gender: 'male',
    ageRange: 'adult',
    length: 'long',
    style: 'straight',
    modelPath: '/library/models/hair/male/free_male_fashion_hair_collection_02_lowpoly.glb',
    meshName: 'Hair_Man_Bun',
    polyCount: 8500,
    tags: ['trendy','casual','modern'],
  },
];

/**
 * Female Hair Collection (15 styles)
 * Procedurally generated with various lengths and styles
 */
export const FEMALE_HAIR_COLLECTION: HairStyleDefinition[] = [
  {
    id: 'female_bob',
    name: 'Classic Bob',
    description: 'Chin-length bob cut',
    gender: 'female',
    ageRange: 'adult',
    length: 'short',
    style: 'straight',
    modelPath: '/library/models/hair/female/bob.glb',
    polyCount: 8000,
    tags: ['professional','elegant','classic'],
  },
  {
    id: 'female_pixie',
    name: 'Pixie Cut',
    description: 'Short and playful pixie style',
    gender: 'female',
    ageRange: 'adult',
    length: 'short',
    style: 'straight',
    modelPath: '/library/models/hair/female/pixie.glb',
    polyCount: 5000,
    tags: ['modern','edgy','low-maintenance'],
  },
  {
    id: 'female_lob',
    name: 'Long Bob (Lob)',
    description: 'Shoulder-length bob',
    gender: 'female',
    ageRange: 'adult',
    length: 'medium',
    style: 'straight',
    modelPath: '/library/models/hair/female/lob.glb',
    polyCount: 10000,
    tags: ['versatile','trendy','professional'],
  },
  {
    id: 'female_waves',
    name: 'Beach Waves',
    description: 'Loose, natural waves',
    gender: 'female',
    ageRange: 'adult',
    length: 'medium',
    style: 'wavy',
    modelPath: '/library/models/hair/female/waves.glb',
    polyCount: 12000,
    tags: ['casual','romantic','effortless'],
  },
  {
    id: 'female_curls',
    name: 'Natural Curls',
    description: 'Bouncy spiral curls',
    gender: 'female',
    ageRange: 'adult',
    length: 'medium',
    style: 'curly',
    modelPath: '/library/models/hair/female/curls.glb',
    polyCount: 15000,
    tags: ['natural','voluminous','dynamic'],
  },
  {
    id: 'female_straight_long',
    name: 'Long Straight',
    description: 'Sleek, flowing long hair',
    gender: 'female',
    ageRange: 'adult',
    length: 'long',
    style: 'straight',
    modelPath: '/library/models/hair/female/long_straight.glb',
    polyCount: 14000,
    tags: ['classic','elegant','versatile'],
  },
  {
    id: 'female_ponytail_high',
    name: 'High Ponytail',
    description: 'Sleek high ponytail',
    gender: 'female',
    ageRange: 'adult',
    length: 'long',
    style: 'updo',
    modelPath: '/library/models/hair/female/ponytail_high.glb',
    polyCount: 9000,
    tags: ['sporty','professional','clean'],
  },
  {
    id: 'female_ponytail_low',
    name: 'Low Ponytail',
    description: 'Elegant low ponytail',
    gender: 'female',
    ageRange: 'adult',
    length: 'long',
    style: 'updo',
    modelPath: '/library/models/hair/female/ponytail_low.glb',
    polyCount: 9000,
    tags: ['elegant','professional','formal'],
  },
  {
    id: 'female_bun_top',
    name: 'Top Knot',
    description: 'High bun on top of head',
    gender: 'female',
    ageRange: 'adult',
    length: 'long',
    style: 'updo',
    modelPath: '/library/models/hair/female/bun_top.glb',
    polyCount: 7000,
    tags: ['casual','trendy','practical'],
  },
  {
    id: 'female_bun_low',
    name: 'Low Chignon',
    description: 'Elegant low bun',
    gender: 'female',
    ageRange: 'adult',
    length: 'long',
    style: 'updo',
    modelPath: '/library/models/hair/female/bun_low.glb',
    polyCount: 7000,
    tags: ['formal','bridal','elegant'],
  },
  {
    id: 'female_braids',
    name: 'Box Braids',
    description: 'Long protective braids',
    gender: 'female',
    ageRange: 'adult',
    length: 'long',
    style: 'textured',
    modelPath: '/library/models/hair/female/braids.glb',
    polyCount: 20000,
    tags: ['protective','stylish','low-maintenance'],
  },
  {
    id: 'female_locs',
    name: 'Locs',
    description: 'Natural dreadlocks',
    gender: 'female',
    ageRange: 'adult',
    length: 'long',
    style: 'textured',
    modelPath: '/library/models/hair/female/locs.glb',
    polyCount: 18000,
    tags: ['natural','cultural','protective'],
  },
  {
    id: 'female_afro',
    name: 'Afro',
    description: 'Natural voluminous afro',
    gender: 'female',
    ageRange: 'adult',
    length: 'medium',
    style: 'textured',
    modelPath: '/library/models/hair/female/afro.glb',
    polyCount: 25000,
    tags: ['natural','bold','expressive'],
  },
  {
    id: 'female_twists',
    name: 'Two-Strand Twists',
    description: 'Protective twist style',
    gender: 'female',
    ageRange: 'adult',
    length: 'medium',
    style: 'textured',
    modelPath: '/library/models/hair/female/twists.glb',
    polyCount: 16000,
    tags: ['protective','natural','versatile'],
  },
  {
    id: 'female_bangs_straight',
    name: 'Straight with Bangs',
    description: 'Long straight hair with fringe',
    gender: 'female',
    ageRange: 'adult',
    length: 'long',
    style: 'straight',
    modelPath: '/library/models/hair/female/bangs_straight.glb',
    polyCount: 15000,
    tags: ['youthful','classic','framing'],
  },
];

/**
 * Children Hair Collection (10 styles)
 */
export const CHILDREN_HAIR_COLLECTION: HairStyleDefinition[] = [
  {
    id: 'child_boy_short',
    name: 'Boy Short',
    description: 'Classic short boy cut',
    gender: 'male',
    ageRange: 'child',
    length: 'short',
    style: 'straight',
    modelPath: '/library/models/hair/children/boy_short.glb',
    polyCount: 4000,
    tags: ['classic','neat','school'],
  },
  {
    id: 'child_boy_messy',
    name: 'Boy Messy',
    description: 'Playful messy style',
    gender: 'male',
    ageRange: 'child',
    length: 'short',
    style: 'wavy',
    modelPath: '/library/models/hair/children/boy_messy.glb',
    polyCount: 5000,
    tags: ['playful','casual','active'],
  },
  {
    id: 'child_boy_curly',
    name: 'Boy Curly',
    description: 'Natural curly hair',
    gender: 'male',
    ageRange: 'child',
    length: 'short',
    style: 'curly',
    modelPath: '/library/models/hair/children/boy_curly.glb',
    polyCount: 7000,
    tags: ['natural','cute','bouncy'],
  },
  {
    id: 'child_girl_pigtails',
    name: 'Pigtails',
    description: 'Classic twin pigtails',
    gender: 'female',
    ageRange: 'child',
    length: 'medium',
    style: 'straight',
    modelPath: '/library/models/hair/children/pigtails.glb',
    polyCount: 8000,
    tags: ['playful','classic','cute'],
  },
  {
    id: 'child_girl_braids',
    name: 'Girl Braids',
    description: 'Twin braids',
    gender: 'female',
    ageRange: 'child',
    length: 'long',
    style: 'straight',
    modelPath: '/library/models/hair/children/braids.glb',
    polyCount: 10000,
    tags: ['neat','practical','school'],
  },
  {
    id: 'child_girl_bob',
    name: 'Girl Bob',
    description: 'Short cute bob',
    gender: 'female',
    ageRange: 'child',
    length: 'short',
    style: 'straight',
    modelPath: '/library/models/hair/children/girl_bob.glb',
    polyCount: 6000,
    tags: ['cute','practical','neat'],
  },
  {
    id: 'child_girl_curly',
    name: 'Girl Curly',
    description: 'Natural curly hair',
    gender: 'female',
    ageRange: 'child',
    length: 'medium',
    style: 'curly',
    modelPath: '/library/models/hair/children/girl_curly.glb',
    polyCount: 12000,
    tags: ['natural','adorable','bouncy'],
  },
  {
    id: 'child_girl_ponytail',
    name: 'Girl Ponytail',
    description: 'Simple ponytail',
    gender: 'female',
    ageRange: 'child',
    length: 'long',
    style: 'straight',
    modelPath: '/library/models/hair/children/ponytail.glb',
    polyCount: 7000,
    tags: ['sporty','practical','active'],
  },
  {
    id: 'child_afro_puffs',
    name: 'Afro Puffs',
    description: 'Twin afro puffs',
    gender: 'female',
    ageRange: 'child',
    length: 'short',
    style: 'textured',
    modelPath: '/library/models/hair/children/afro_puffs.glb',
    polyCount: 10000,
    tags: ['natural','cute','protective'],
  },
  {
    id: 'child_cornrows',
    name: 'Cornrows',
    description: 'Neat cornrow braids',
    gender: 'unisex',
    ageRange: 'child',
    length: 'short',
    style: 'textured',
    modelPath: '/library/models/hair/children/cornrows.glb',
    polyCount: 8000,
    tags: ['protective','neat','cultural'],
  },
];

/**
 * Textured Hair Collection (8 styles) - Unisex options
 */
export const TEXTURED_HAIR_COLLECTION: HairStyleDefinition[] = [
  {
    id: 'textured_high_top_fade',
    name: 'High Top Fade',
    description: 'Classic high top with faded sides',
    gender: 'unisex',
    ageRange: 'adult',
    length: 'short',
    style: 'textured',
    modelPath: '/library/models/hair/textured/high_top_fade.glb',
    polyCount: 12000,
    tags: ['bold','classic','statement'],
  },
  {
    id: 'textured_tapered_afro',
    name: 'Tapered Afro',
    description: 'Natural afro with tapered sides',
    gender: 'unisex',
    ageRange: 'adult',
    length: 'short',
    style: 'textured',
    modelPath: '/library/models/hair/textured/tapered_afro.glb',
    polyCount: 15000,
    tags: ['natural','professional','modern'],
  },
  {
    id: 'textured_twist_out',
    name: 'Twist Out',
    description: 'Defined twist-out curls',
    gender: 'unisex',
    ageRange: 'adult',
    length: 'medium',
    style: 'textured',
    modelPath: '/library/models/hair/textured/twist_out.glb',
    polyCount: 18000,
    tags: ['natural','defined','voluminous'],
  },
  {
    id: 'textured_coils',
    name: 'Coils',
    description: 'Tight natural coils',
    gender: 'unisex',
    ageRange: 'adult',
    length: 'short',
    style: 'textured',
    modelPath: '/library/models/hair/textured/coils.glb',
    polyCount: 20000,
    tags: ['natural','tight','4c'],
  },
  {
    id: 'textured_finger_coils',
    name: 'Finger Coils',
    description: 'Styled finger coils',
    gender: 'unisex',
    ageRange: 'adult',
    length: 'medium',
    style: 'textured',
    modelPath: '/library/models/hair/textured/finger_coils.glb',
    polyCount: 22000,
    tags: ['defined','styled','natural'],
  },
  {
    id: 'textured_freeform_locs',
    name: 'Freeform Locs',
    description: 'Natural freeform dreadlocks',
    gender: 'unisex',
    ageRange: 'adult',
    length: 'long',
    style: 'textured',
    modelPath: '/library/models/hair/textured/freeform_locs.glb',
    polyCount: 16000,
    tags: ['natural','freeform','organic'],
  },
  {
    id: 'textured_sisterlocks',
    name: 'Sisterlocks',
    description: 'Small uniform locs',
    gender: 'female',
    ageRange: 'adult',
    length: 'long',
    style: 'textured',
    modelPath: '/library/models/hair/textured/sisterlocks.glb',
    polyCount: 24000,
    tags: ['elegant','refined','professional'],
  },
  {
    id: 'textured_bantu_knots',
    name: 'Bantu Knots',
    description: 'Traditional Bantu knot style',
    gender: 'unisex',
    ageRange: 'adult',
    length: 'short',
    style: 'textured',
    modelPath: '/library/models/hair/textured/bantu_knots.glb',
    polyCount: 10000,
    tags: ['cultural','protective','statement'],
  },
];

/**
 * All available hair styles (40 total)
 * - 7 male styles
 * - 15 female styles
 * - 10 children styles
 * - 8 textured styles
 */
export const ALL_HAIR_STYLES: HairStyleDefinition[] = [
  ...MALE_FASHION_COLLECTION,
  ...FEMALE_HAIR_COLLECTION,
  ...CHILDREN_HAIR_COLLECTION,
  ...TEXTURED_HAIR_COLLECTION,
];

/**
 * Get hair styles filtered by criteria
 */
export function getHairStyles(filters?: {
  gender?: HairGender;
  ageRange?: HairAgeRange;
  length?: HairLength;
  style?: HairStyle;
}): HairStyleDefinition[] {
  if (!filters) return ALL_HAIR_STYLES;

  return ALL_HAIR_STYLES.filter((hair) => {
    if (filters.gender && hair.gender !== filters.gender && hair.gender !=='unisex') {
      return false;
    }
    if (filters.ageRange && hair.ageRange !== filters.ageRange) {
      return false;
    }
    if (filters.length && hair.length !== filters.length) {
      return false;
    }
    if (filters.style && hair.style !== filters.style) {
      return false;
    }
    return true;
  });
}

/**
 * Get hair style by ID
 */
export function getHairStyleById(id: string): HairStyleDefinition | undefined {
  return ALL_HAIR_STYLES.find((hair) => hair.id === id);
}

