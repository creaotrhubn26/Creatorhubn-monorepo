/**
 * Clothing Styles Data Library
 *
 * Defines clothing items for virtual actors with metadata for categorization and filtering.
 *
 * Categories:
 * - Tops: Shirts, T-shirts, Jackets, Coats, Sweaters
 * - Bottoms: Pants, Jeans, Shorts, Skirts
 * - Dresses: Full-body dresses
 * - Outerwear: Jackets, Coats, Hoodies
 * - Footwear: Shoes, Boots, Sneakers
 * - Accessories: Hats, Glasses, Jewelry
 */

// ============================================================================
// Types and Enums
// ============================================================================

export type ClothingGender = 'male' | 'female' | 'unisex';
export type ClothingAgeRange = 'child' | 'teen' | 'adult' | 'all';
export type ClothingCategory = 'tops' | 'bottoms' | 'dresses' | 'outerwear' | 'footwear' | 'accessories';
export type ClothingStyle = 'casual' | 'formal' | 'business' | 'athletic' | 'streetwear' | 'vintage';
export type ClothingSeason = 'spring' | 'summer' | 'fall' | 'winter' | 'all-season';
export type ClothingFormality = 'casual' | 'smart-casual' | 'business' | 'formal' | 'athletic';

// ============================================================================
// Clothing Definition Interface
// ============================================================================

export interface ClothingStyleDefinition {
  id: string;
  name: string;
  description: string;
  category: ClothingCategory;
  gender: ClothingGender;
  ageRange: ClothingAgeRange;
  style: ClothingStyle;
  season: ClothingSeason;
  formality: ClothingFormality;
  modelPath: string;
  meshName?: string; // For multi-mesh GLB files
  thumbnailPath?: string;
  polyCount?: number;
  tags?: string[];
  colors?: string[]; // Available color options
  sizes?: string[]; // Available sizes (XS, S, M, L, XL, etc.)
}

// ============================================================================
// Placeholder Clothing Collections
// ============================================================================

/**
 * NOTE: These are placeholder definitions.
 * Replace with actual clothing models from Sketchfab or other sources.
 */

export const MALE_CASUAL_TOPS: ClothingStyleDefinition[] = [
  {
    id: 'male-tshirt-basic-01',
    name: 'Basic T-Shirt',
    description: 'Simple crew neck t-shirt for everyday wear',
    category: 'tops',
    gender: 'male',
    ageRange: 'adult',
    style: 'casual',
    season: 'all-season',
    formality: 'casual',
    modelPath: '/library/models/clothing/male/tops/tshirt_basic.glb',
    meshName: 'TShirt_Basic',
    polyCount: 5000,
    tags: ['basic','everyday','comfortable'],
    colors: ['white','black','gray','navy','red'],
    sizes: ['S','M','L','XL'],
  },
  {
    id: 'male-shirt-button-01',
    name: 'Button-Up Shirt',
    description: 'Classic button-up shirt for smart casual look',
    category: 'tops',
    gender: 'male',
    ageRange: 'adult',
    style: 'casual',
    season: 'all-season',
    formality: 'smart-casual',
    modelPath: '/library/models/clothing/male/tops/shirt_button.glb',
    meshName: 'Shirt_Button',
    polyCount: 8000,
    tags: ['button-up','smart-casual','versatile'],
    colors: ['white','blue','black','gray'],
    sizes: ['S','M','L','XL'],
  },
];

export const MALE_CASUAL_BOTTOMS: ClothingStyleDefinition[] = [
  {
    id: 'male-jeans-slim-01',
    name: 'Slim Fit Jeans',
    description: 'Modern slim fit jeans for everyday wear',
    category: 'bottoms',
    gender: 'male',
    ageRange: 'adult',
    style: 'casual',
    season: 'all-season',
    formality: 'casual',
    modelPath: '/library/models/clothing/male/bottoms/jeans_slim.glb',
    meshName: 'Jeans_Slim',
    polyCount: 10000,
    tags: ['jeans','slim-fit','denim'],
    colors: ['blue','black','gray'],
    sizes: ['28','30','32','34','36'],
  },
  {
    id: 'male-pants-chino-01',
    name: 'Chino Pants',
    description: 'Versatile chino pants for smart casual look',
    category: 'bottoms',
    gender: 'male',
    ageRange: 'adult',
    style: 'casual',
    season: 'all-season',
    formality: 'smart-casual',
    modelPath: '/library/models/clothing/male/bottoms/pants_chino.glb',
    meshName: 'Pants_Chino',
    polyCount: 9000,
    tags: ['chino','smart-casual','versatile'],
    colors: ['khaki','navy','black','gray'],
    sizes: ['28','30','32','34','36'],
  },
];

export const FEMALE_CASUAL_TOPS: ClothingStyleDefinition[] = [
  {
    id: 'female-tshirt-basic-01',
    name: 'Basic T-Shirt',
    description: 'Simple fitted t-shirt for everyday wear',
    category: 'tops',
    gender: 'female',
    ageRange: 'adult',
    style: 'casual',
    season: 'all-season',
    formality: 'casual',
    modelPath: '/library/models/clothing/female/tops/tshirt_basic.glb',
    meshName: 'TShirt_Basic',
    polyCount: 5000,
    tags: ['basic','everyday','comfortable'],
    colors: ['white','black','pink','blue','red'],
    sizes: ['XS','S','M','L','XL'],
  },
  {
    id: 'female-blouse-01',
    name: 'Silk Blouse',
    description: 'Elegant silk blouse for professional settings',
    category: 'tops',
    gender: 'female',
    ageRange: 'adult',
    style: 'business',
    season: 'all-season',
    formality: 'business',
    modelPath: '/library/models/clothing/female/tops/blouse_silk.glb',
    polyCount: 6000,
    tags: ['professional','elegant','silk'],
    colors: ['white','cream','blush','navy'],
    sizes: ['XS','S','M','L','XL'],
  },
  {
    id: 'female-tank-top-01',
    name: 'Tank Top',
    description: 'Simple tank top for warm weather',
    category: 'tops',
    gender: 'female',
    ageRange: 'adult',
    style: 'casual',
    season: 'summer',
    formality: 'casual',
    modelPath: '/library/models/clothing/female/tops/tank_top.glb',
    polyCount: 3000,
    tags: ['summer','casual','sleeveless'],
    colors: ['white','black','coral','mint'],
    sizes: ['XS','S','M','L','XL'],
  },
];

export const FEMALE_BOTTOMS: ClothingStyleDefinition[] = [
  {
    id: 'female-jeans-skinny-01',
    name: 'Skinny Jeans',
    description: 'Form-fitting skinny jeans',
    category: 'bottoms',
    gender: 'female',
    ageRange: 'adult',
    style: 'casual',
    season: 'all-season',
    formality: 'casual',
    modelPath: '/library/models/clothing/female/bottoms/jeans_skinny.glb',
    polyCount: 10000,
    tags: ['jeans','skinny','denim'],
    colors: ['blue','black','white'],
    sizes: ['24','26','28','30','32'],
  },
  {
    id: 'female-skirt-pencil-01',
    name: 'Pencil Skirt',
    description: 'Professional pencil skirt',
    category: 'bottoms',
    gender: 'female',
    ageRange: 'adult',
    style: 'business',
    season: 'all-season',
    formality: 'business',
    modelPath: '/library/models/clothing/female/bottoms/skirt_pencil.glb',
    polyCount: 6000,
    tags: ['professional','pencil','office'],
    colors: ['black','navy','gray'],
    sizes: ['XS','S','M','L','XL'],
  },
  {
    id: 'female-shorts-denim-01',
    name: 'Denim Shorts',
    description: 'Casual denim shorts for summer',
    category: 'bottoms',
    gender: 'female',
    ageRange: 'adult',
    style: 'casual',
    season: 'summer',
    formality: 'casual',
    modelPath: '/library/models/clothing/female/bottoms/shorts_denim.glb',
    polyCount: 5000,
    tags: ['shorts','denim','summer'],
    colors: ['blue','white','black'],
    sizes: ['XS','S','M','L','XL'],
  },
];

export const DRESSES: ClothingStyleDefinition[] = [
  {
    id: 'female-dress-cocktail-01',
    name: 'Cocktail Dress',
    description: 'Elegant cocktail dress for evening events',
    category: 'dresses',
    gender: 'female',
    ageRange: 'adult',
    style: 'formal',
    season: 'all-season',
    formality: 'formal',
    modelPath: '/library/models/clothing/female/dresses/cocktail.glb',
    polyCount: 12000,
    tags: ['cocktail','evening','elegant'],
    colors: ['black','red','navy','burgundy'],
    sizes: ['XS','S','M','L','XL'],
  },
  {
    id: 'female-dress-casual-01',
    name: 'Casual Sundress',
    description: 'Light summer sundress',
    category: 'dresses',
    gender: 'female',
    ageRange: 'adult',
    style: 'casual',
    season: 'summer',
    formality: 'casual',
    modelPath: '/library/models/clothing/female/dresses/sundress.glb',
    polyCount: 8000,
    tags: ['summer','sundress','casual'],
    colors: ['white','yellow','floral','blue'],
    sizes: ['XS','S','M','L','XL'],
  },
  {
    id: 'female-dress-business-01',
    name: 'Business Dress',
    description: 'Professional sheath dress',
    category: 'dresses',
    gender: 'female',
    ageRange: 'adult',
    style: 'business',
    season: 'all-season',
    formality: 'business',
    modelPath: '/library/models/clothing/female/dresses/business.glb',
    polyCount: 10000,
    tags: ['professional','office','sheath'],
    colors: ['black','navy','gray','burgundy'],
    sizes: ['XS','S','M','L','XL'],
  },
  {
    id: 'female-dress-maxi-01',
    name: 'Maxi Dress',
    description: 'Flowing full-length maxi dress',
    category: 'dresses',
    gender: 'female',
    ageRange: 'adult',
    style: 'casual',
    season: 'summer',
    formality: 'casual',
    modelPath: '/library/models/clothing/female/dresses/maxi.glb',
    polyCount: 14000,
    tags: ['maxi','flowing','bohemian'],
    colors: ['floral','solid','print'],
    sizes: ['XS','S','M','L','XL'],
  },
];

export const OUTERWEAR: ClothingStyleDefinition[] = [
  {
    id: 'unisex-jacket-leather-01',
    name: 'Leather Jacket',
    description: 'Classic leather biker jacket',
    category: 'outerwear',
    gender: 'unisex',
    ageRange: 'adult',
    style: 'streetwear',
    season: 'fall',
    formality: 'casual',
    modelPath: '/library/models/clothing/unisex/outerwear/jacket_leather.glb',
    polyCount: 15000,
    tags: ['leather','biker','edgy'],
    colors: ['black','brown','burgundy'],
    sizes: ['S','M','L','XL'],
  },
  {
    id: 'unisex-hoodie-01',
    name: 'Hoodie',
    description: 'Comfortable cotton hoodie',
    category: 'outerwear',
    gender: 'unisex',
    ageRange: 'all',
    style: 'casual',
    season: 'all-season',
    formality: 'casual',
    modelPath: '/library/models/clothing/unisex/outerwear/hoodie.glb',
    polyCount: 10000,
    tags: ['hoodie','comfortable','casual'],
    colors: ['gray','black','navy','red'],
    sizes: ['S','M','L','XL','XXL'],
  },
  {
    id: 'unisex-coat-trench-01',
    name: 'Trench Coat',
    description: 'Classic trench coat',
    category: 'outerwear',
    gender: 'unisex',
    ageRange: 'adult',
    style: 'business',
    season: 'fall',
    formality: 'smart-casual',
    modelPath: '/library/models/clothing/unisex/outerwear/coat_trench.glb',
    polyCount: 18000,
    tags: ['trench','classic','professional'],
    colors: ['beige','black','navy'],
    sizes: ['S','M','L','XL'],
  },
  {
    id: 'unisex-blazer-01',
    name: 'Blazer',
    description: 'Versatile single-breasted blazer',
    category: 'outerwear',
    gender: 'unisex',
    ageRange: 'adult',
    style: 'business',
    season: 'all-season',
    formality: 'business',
    modelPath: '/library/models/clothing/unisex/outerwear/blazer.glb',
    polyCount: 12000,
    tags: ['blazer','professional','versatile'],
    colors: ['navy','black','gray','charcoal'],
    sizes: ['S','M','L','XL'],
  },
  {
    id: 'unisex-puffer-01',
    name: 'Puffer Jacket',
    description: 'Warm quilted puffer jacket',
    category: 'outerwear',
    gender: 'unisex',
    ageRange: 'all',
    style: 'casual',
    season: 'winter',
    formality: 'casual',
    modelPath: '/library/models/clothing/unisex/outerwear/puffer.glb',
    polyCount: 14000,
    tags: ['puffer','warm','winter'],
    colors: ['black','navy','olive','red'],
    sizes: ['S','M','L','XL','XXL'],
  },
];

export const FOOTWEAR: ClothingStyleDefinition[] = [
  {
    id: 'unisex-sneakers-01',
    name: 'Classic Sneakers',
    description: 'Versatile everyday sneakers',
    category: 'footwear',
    gender: 'unisex',
    ageRange: 'all',
    style: 'casual',
    season: 'all-season',
    formality: 'casual',
    modelPath: '/library/models/clothing/unisex/footwear/sneakers.glb',
    polyCount: 8000,
    tags: ['sneakers','casual','comfortable'],
    colors: ['white','black','gray'],
    sizes: ['6','7','8','9','10','11','12'],
  },
  {
    id: 'male-shoes-oxford-01',
    name: 'Oxford Shoes',
    description: 'Classic leather oxford shoes',
    category: 'footwear',
    gender: 'male',
    ageRange: 'adult',
    style: 'formal',
    season: 'all-season',
    formality: 'formal',
    modelPath: '/library/models/clothing/male/footwear/oxford.glb',
    polyCount: 10000,
    tags: ['oxford','leather','formal'],
    colors: ['black','brown','burgundy'],
    sizes: ['7','8','9','10','11','12'],
  },
  {
    id: 'female-heels-01',
    name: 'High Heels',
    description: 'Classic stiletto heels',
    category: 'footwear',
    gender: 'female',
    ageRange: 'adult',
    style: 'formal',
    season: 'all-season',
    formality: 'formal',
    modelPath: '/library/models/clothing/female/footwear/heels.glb',
    polyCount: 6000,
    tags: ['heels','stiletto','elegant'],
    colors: ['black','nude','red'],
    sizes: ['5','6','7','8','9','10'],
  },
  {
    id: 'unisex-boots-chelsea-01',
    name: 'Chelsea Boots',
    description: 'Classic ankle Chelsea boots',
    category: 'footwear',
    gender: 'unisex',
    ageRange: 'adult',
    style: 'casual',
    season: 'fall',
    formality: 'smart-casual',
    modelPath: '/library/models/clothing/unisex/footwear/chelsea_boots.glb',
    polyCount: 9000,
    tags: ['chelsea','boots','ankle'],
    colors: ['black','brown','suede'],
    sizes: ['6','7','8','9','10','11','12'],
  },
  {
    id: 'unisex-sandals-01',
    name: 'Sandals',
    description: 'Casual summer sandals',
    category: 'footwear',
    gender: 'unisex',
    ageRange: 'all',
    style: 'casual',
    season: 'summer',
    formality: 'casual',
    modelPath: '/library/models/clothing/unisex/footwear/sandals.glb',
    polyCount: 4000,
    tags: ['sandals','summer','beach'],
    colors: ['brown','black','tan'],
    sizes: ['6','7','8','9','10','11','12'],
  },
];

export const ACCESSORIES: ClothingStyleDefinition[] = [
  {
    id: 'unisex-hat-baseball-01',
    name: 'Baseball Cap',
    description: 'Classic baseball cap',
    category: 'accessories',
    gender: 'unisex',
    ageRange: 'all',
    style: 'casual',
    season: 'all-season',
    formality: 'casual',
    modelPath: '/library/models/clothing/unisex/accessories/cap_baseball.glb',
    polyCount: 3000,
    tags: ['cap','baseball','casual'],
    colors: ['black','navy','white','red'],
    sizes: ['one-size'],
  },
  {
    id: 'unisex-glasses-01',
    name: 'Sunglasses',
    description: 'Classic aviator sunglasses',
    category: 'accessories',
    gender: 'unisex',
    ageRange: 'adult',
    style: 'casual',
    season: 'summer',
    formality: 'casual',
    modelPath: '/library/models/clothing/unisex/accessories/sunglasses.glb',
    polyCount: 2000,
    tags: ['sunglasses','aviator','summer'],
    colors: ['gold','silver','black'],
    sizes: ['one-size'],
  },
  {
    id: 'unisex-watch-01',
    name: 'Wristwatch',
    description: 'Classic analog wristwatch',
    category: 'accessories',
    gender: 'unisex',
    ageRange: 'adult',
    style: 'business',
    season: 'all-season',
    formality: 'smart-casual',
    modelPath: '/library/models/clothing/unisex/accessories/watch.glb',
    polyCount: 5000,
    tags: ['watch','classic','timepiece'],
    colors: ['silver','gold','rose-gold'],
    sizes: ['one-size'],
  },
  {
    id: 'unisex-scarf-01',
    name: 'Scarf',
    description: 'Warm winter scarf',
    category: 'accessories',
    gender: 'unisex',
    ageRange: 'all',
    style: 'casual',
    season: 'winter',
    formality: 'casual',
    modelPath: '/library/models/clothing/unisex/accessories/scarf.glb',
    polyCount: 4000,
    tags: ['scarf','winter','warm'],
    colors: ['gray','navy','red','camel'],
    sizes: ['one-size'],
  },
  {
    id: 'female-jewelry-necklace-01',
    name: 'Pendant Necklace',
    description: 'Elegant pendant necklace',
    category: 'accessories',
    gender: 'female',
    ageRange: 'adult',
    style: 'formal',
    season: 'all-season',
    formality: 'formal',
    modelPath: '/library/models/clothing/female/accessories/necklace.glb',
    polyCount: 3000,
    tags: ['necklace','pendant','elegant'],
    colors: ['gold','silver','rose-gold'],
    sizes: ['one-size'],
  },
  {
    id: 'unisex-belt-01',
    name: 'Leather Belt',
    description: 'Classic leather belt',
    category: 'accessories',
    gender: 'unisex',
    ageRange: 'adult',
    style: 'casual',
    season: 'all-season',
    formality: 'smart-casual',
    modelPath: '/library/models/clothing/unisex/accessories/belt.glb',
    polyCount: 2500,
    tags: ['belt','leather','classic'],
    colors: ['black','brown','tan'],
    sizes: ['S','M','L','XL'],
  },
];

// ============================================================================
// Clothing Collections Export
// ============================================================================

export const ALL_CLOTHING_STYLES: ClothingStyleDefinition[] = [
  ...MALE_CASUAL_TOPS,
  ...MALE_CASUAL_BOTTOMS,
  ...FEMALE_CASUAL_TOPS,
  ...FEMALE_BOTTOMS,
  ...DRESSES,
  ...OUTERWEAR,
  ...FOOTWEAR,
  ...ACCESSORIES,
];

export const CLOTHING_BY_CATEGORY = {
  tops: [...MALE_CASUAL_TOPS, ...FEMALE_CASUAL_TOPS],
  bottoms: [...MALE_CASUAL_BOTTOMS, ...FEMALE_BOTTOMS],
  dresses: DRESSES,
  outerwear: OUTERWEAR,
  footwear: FOOTWEAR,
  accessories: ACCESSORIES,
};

export const CLOTHING_BY_GENDER = {
  male: [...MALE_CASUAL_TOPS, ...MALE_CASUAL_BOTTOMS],
  female: [...FEMALE_CASUAL_TOPS, ...FEMALE_BOTTOMS, ...DRESSES],
  unisex: [...OUTERWEAR, ...FOOTWEAR.filter(f => f.gender === 'unisex'), ...ACCESSORIES.filter(a => a.gender ==='unisex')],
};

/**
 * Get clothing style by ID
 */
export function getClothingStyleById(id: string): ClothingStyleDefinition | undefined {
  return ALL_CLOTHING_STYLES.find(style => style.id === id);
}

