/**
 * Gobo Patterns Library
 * 
 * Collection of gobo (go-between) patterns for theatrical and studio lighting.
 * Gobos create shadow patterns when placed in front of light sources.
 */

export type GoboCategory = 
  | 'windows' 
  | 'blinds' 
  | 'nature' 
  | 'abstract' 
  | 'architectural' 
  | 'breakup' 
  | 'clouds'
  | 'textures'
  | 'symbols'
  | 'custom';

export interface GoboPattern {
  id: string;
  name: string;
  description: string;
  category: GoboCategory;
  imagePath: string; // Path to gobo texture
  thumbnailPath: string;
  size: 'A' | 'B' | 'M' | 'E'; // Standard gobo sizes
  material: 'steel' | 'glass' | 'glass-color';
  rotatable: boolean;
  brand?: string;
  tags?: string[];
}

// ============================================================================
// Window Gobos - Create window light effects
// ============================================================================
export const WINDOW_GOBOS: GoboPattern[] = [
  {
    id: 'window-french-4pane',
    name: 'French Window 4-Pane',
    description: 'Classic 4-pane French window pattern',
    category: 'windows',
    imagePath: '/gobos/windows/french_4pane.png',
    thumbnailPath: '/thumbnails/gobos/french_4pane.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['french','elegant','indoor'],
  },
  {
    id: 'window-french-6pane',
    name: 'French Window 6-Pane',
    description: 'Tall 6-pane French window pattern',
    category: 'windows',
    imagePath: '/gobos/windows/french_6pane.png',
    thumbnailPath: '/thumbnails/gobos/french_6pane.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['french','tall','elegant'],
  },
  {
    id: 'window-arched',
    name: 'Arched Window',
    description: 'Gothic arched window pattern',
    category: 'windows',
    imagePath: '/gobos/windows/arched.png',
    thumbnailPath: '/thumbnails/gobos/arched.jpg',
    size: 'B',
    material: 'steel',
    rotatable: false,
    tags: ['gothic','church','dramatic'],
  },
  {
    id: 'window-church-large',
    name: 'Church Window Large',
    description: 'Large stained glass window pattern',
    category: 'windows',
    imagePath: '/gobos/windows/church_large.png',
    thumbnailPath: '/thumbnails/gobos/church_large.jpg',
    size: 'A',
    material: 'glass-color',
    rotatable: false,
    tags: ['church','religious','dramatic'],
  },
  {
    id: 'window-industrial',
    name: 'Industrial Window',
    description: 'Factory/warehouse style window grid',
    category: 'windows',
    imagePath: '/gobos/windows/industrial.png',
    thumbnailPath: '/thumbnails/gobos/industrial.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['industrial','urban','modern'],
  },
  {
    id: 'window-shutters',
    name: 'Window with Shutters',
    description: 'Window with partially open shutters',
    category: 'windows',
    imagePath: '/gobos/windows/shutters.png',
    thumbnailPath: '/thumbnails/gobos/shutters.jpg',
    size: 'B',
    material: 'steel',
    rotatable: false,
    tags: ['rustic','european','romantic'],
  },
];

// ============================================================================
// Blinds Gobos - Venetian blind and slat patterns
// ============================================================================
export const BLINDS_GOBOS: GoboPattern[] = [
  {
    id: 'blinds-venetian-tight',
    name: 'Venetian Blinds Tight',
    description: 'Tight venetian blind slats',
    category: 'blinds',
    imagePath: '/gobos/blinds/venetian_tight.png',
    thumbnailPath: '/thumbnails/gobos/venetian_tight.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['noir','office','classic'],
  },
  {
    id: 'blinds-venetian-medium',
    name: 'Venetian Blinds Medium',
    description: 'Medium spacing venetian blinds',
    category: 'blinds',
    imagePath: '/gobos/blinds/venetian_medium.png',
    thumbnailPath: '/thumbnails/gobos/venetian_medium.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['noir','office','classic'],
  },
  {
    id: 'blinds-venetian-wide',
    name: 'Venetian Blinds Wide',
    description: 'Wide slat venetian blinds',
    category: 'blinds',
    imagePath: '/gobos/blinds/venetian_wide.png',
    thumbnailPath: '/thumbnails/gobos/venetian_wide.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['noir','dramatic','wide'],
  },
  {
    id: 'blinds-broken',
    name: 'Broken Blinds',
    description: 'Venetian blinds with broken/bent slats',
    category: 'blinds',
    imagePath: '/gobos/blinds/broken.png',
    thumbnailPath: '/thumbnails/gobos/broken.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['grunge','damaged','urban'],
  },
];

// ============================================================================
// Nature Gobos - Trees, leaves, foliage
// ============================================================================
export const NATURE_GOBOS: GoboPattern[] = [
  {
    id: 'nature-tree-branches',
    name: 'Tree Branches',
    description: 'Bare tree branches silhouette',
    category: 'nature',
    imagePath: '/gobos/nature/tree_branches.png',
    thumbnailPath: '/thumbnails/gobos/tree_branches.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['tree','winter','dramatic'],
  },
  {
    id: 'nature-leaves-dense',
    name: 'Dense Foliage',
    description: 'Dense leaf pattern for dappled light',
    category: 'nature',
    imagePath: '/gobos/nature/leaves_dense.png',
    thumbnailPath: '/thumbnails/gobos/leaves_dense.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['forest','summer','organic'],
  },
  {
    id: 'nature-leaves-sparse',
    name: 'Sparse Foliage',
    description: 'Sparse leaf pattern',
    category: 'nature',
    imagePath: '/gobos/nature/leaves_sparse.png',
    thumbnailPath: '/thumbnails/gobos/leaves_sparse.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['autumn','light','organic'],
  },
  {
    id: 'nature-palm-fronds',
    name: 'Palm Fronds',
    description: 'Tropical palm leaf shadows',
    category: 'nature',
    imagePath: '/gobos/nature/palm_fronds.png',
    thumbnailPath: '/thumbnails/gobos/palm_fronds.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['tropical','beach','exotic'],
  },
  {
    id: 'nature-bamboo',
    name: 'Bamboo Forest',
    description: 'Bamboo stalks pattern',
    category: 'nature',
    imagePath: '/gobos/nature/bamboo.png',
    thumbnailPath: '/thumbnails/gobos/bamboo.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['asian','zen','vertical'],
  },
  {
    id: 'nature-fern',
    name: 'Fern Leaves',
    description: 'Delicate fern frond pattern',
    category: 'nature',
    imagePath: '/gobos/nature/fern.png',
    thumbnailPath: '/thumbnails/gobos/fern.jpg',
    size: 'M',
    material: 'steel',
    rotatable: true,
    tags: ['delicate','botanical','organic'],
  },
];

// ============================================================================
// Clouds Gobos - Sky and cloud patterns
// ============================================================================
export const CLOUDS_GOBOS: GoboPattern[] = [
  {
    id: 'clouds-fluffy',
    name: 'Fluffy Clouds',
    description: 'Soft cumulus cloud pattern',
    category: 'clouds',
    imagePath: '/gobos/clouds/fluffy.png',
    thumbnailPath: '/thumbnails/gobos/fluffy.jpg',
    size: 'A',
    material: 'glass',
    rotatable: true,
    tags: ['sky','soft','dreamy'],
  },
  {
    id: 'clouds-stormy',
    name: 'Storm Clouds',
    description: 'Dramatic storm cloud pattern',
    category: 'clouds',
    imagePath: '/gobos/clouds/stormy.png',
    thumbnailPath: '/thumbnails/gobos/stormy.jpg',
    size: 'A',
    material: 'glass',
    rotatable: true,
    tags: ['dramatic','moody','weather'],
  },
  {
    id: 'clouds-wispy',
    name: 'Wispy Clouds',
    description: 'Light cirrus cloud pattern',
    category: 'clouds',
    imagePath: '/gobos/clouds/wispy.png',
    thumbnailPath: '/thumbnails/gobos/wispy.jpg',
    size: 'A',
    material: 'glass',
    rotatable: true,
    tags: ['light','sky','ethereal'],
  },
];

// ============================================================================
// Abstract Gobos - Geometric and artistic patterns
// ============================================================================
export const ABSTRACT_GOBOS: GoboPattern[] = [
  {
    id: 'abstract-dots-random',
    name: 'Random Dots',
    description: 'Scattered dot pattern',
    category: 'abstract',
    imagePath: '/gobos/abstract/dots_random.png',
    thumbnailPath: '/thumbnails/gobos/dots_random.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['bokeh','modern','sparkle'],
  },
  {
    id: 'abstract-circles-concentric',
    name: 'Concentric Circles',
    description: 'Ripple effect concentric circles',
    category: 'abstract',
    imagePath: '/gobos/abstract/circles_concentric.png',
    thumbnailPath: '/thumbnails/gobos/circles_concentric.jpg',
    size: 'B',
    material: 'steel',
    rotatable: false,
    tags: ['ripple','modern','hypnotic'],
  },
  {
    id: 'abstract-lines-diagonal',
    name: 'Diagonal Lines',
    description: 'Sharp diagonal line pattern',
    category: 'abstract',
    imagePath: '/gobos/abstract/lines_diagonal.png',
    thumbnailPath: '/thumbnails/gobos/lines_diagonal.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['dynamic','modern','sharp'],
  },
  {
    id: 'abstract-grid-mesh',
    name: 'Mesh Grid',
    description: 'Fine mesh grid pattern',
    category: 'abstract',
    imagePath: '/gobos/abstract/grid_mesh.png',
    thumbnailPath: '/thumbnails/gobos/grid_mesh.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['tech','industrial','subtle'],
  },
  {
    id: 'abstract-shattered',
    name: 'Shattered Glass',
    description: 'Broken glass fragment pattern',
    category: 'abstract',
    imagePath: '/gobos/abstract/shattered.png',
    thumbnailPath: '/thumbnails/gobos/shattered.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['dramatic','chaotic','edgy'],
  },
  {
    id: 'abstract-prismatic',
    name: 'Prismatic',
    description: 'Rainbow prismatic effect',
    category: 'abstract',
    imagePath: '/gobos/abstract/prismatic.png',
    thumbnailPath: '/thumbnails/gobos/prismatic.jpg',
    size: 'M',
    material: 'glass-color',
    rotatable: true,
    tags: ['color','rainbow','psychedelic'],
  },
];

// ============================================================================
// Architectural Gobos - Building and structure patterns
// ============================================================================
export const ARCHITECTURAL_GOBOS: GoboPattern[] = [
  {
    id: 'arch-columns',
    name: 'Classical Columns',
    description: 'Greek/Roman column shadows',
    category: 'architectural',
    imagePath: '/gobos/architectural/columns.png',
    thumbnailPath: '/thumbnails/gobos/columns.jpg',
    size: 'A',
    material: 'steel',
    rotatable: false,
    tags: ['classical','greek','formal'],
  },
  {
    id: 'arch-staircase',
    name: 'Staircase Shadow',
    description: 'Staircase railing shadow pattern',
    category: 'architectural',
    imagePath: '/gobos/architectural/staircase.png',
    thumbnailPath: '/thumbnails/gobos/staircase.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['geometric','indoor','dramatic'],
  },
  {
    id: 'arch-fire-escape',
    name: 'Fire Escape',
    description: 'Urban fire escape shadow grid',
    category: 'architectural',
    imagePath: '/gobos/architectural/fire_escape.png',
    thumbnailPath: '/thumbnails/gobos/fire_escape.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['urban','noir','geometric'],
  },
  {
    id: 'arch-skylight',
    name: 'Skylight Grid',
    description: 'Industrial skylight pattern',
    category: 'architectural',
    imagePath: '/gobos/architectural/skylight.png',
    thumbnailPath: '/thumbnails/gobos/skylight.jpg',
    size: 'A',
    material: 'steel',
    rotatable: false,
    tags: ['industrial','overhead','geometric'],
  },
];

// ============================================================================
// Breakup Gobos - Organic patterns for natural light
// ============================================================================
export const BREAKUP_GOBOS: GoboPattern[] = [
  {
    id: 'breakup-light',
    name: 'Light Breakup',
    description: 'Subtle organic breakup pattern',
    category: 'breakup',
    imagePath: '/gobos/breakup/light.png',
    thumbnailPath: '/thumbnails/gobos/breakup_light.jpg',
    size: 'A',
    material: 'steel',
    rotatable: true,
    tags: ['subtle','natural','soft'],
  },
  {
    id: 'breakup-medium',
    name: 'Medium Breakup',
    description: 'Medium organic breakup pattern',
    category: 'breakup',
    imagePath: '/gobos/breakup/medium.png',
    thumbnailPath: '/thumbnails/gobos/breakup_medium.jpg',
    size: 'A',
    material: 'steel',
    rotatable: true,
    tags: ['natural','organic','versatile'],
  },
  {
    id: 'breakup-heavy',
    name: 'Heavy Breakup',
    description: 'Strong organic breakup pattern',
    category: 'breakup',
    imagePath: '/gobos/breakup/heavy.png',
    thumbnailPath: '/thumbnails/gobos/breakup_heavy.jpg',
    size: 'A',
    material: 'steel',
    rotatable: true,
    tags: ['dramatic','strong','organic'],
  },
  {
    id: 'breakup-urban',
    name: 'Urban Breakup',
    description: 'City/urban textured breakup',
    category: 'breakup',
    imagePath: '/gobos/breakup/urban.png',
    thumbnailPath: '/thumbnails/gobos/breakup_urban.jpg',
    size: 'A',
    material: 'steel',
    rotatable: true,
    tags: ['urban','gritty','textured'],
  },
];

// ============================================================================
// Texture Gobos - Surface texture patterns
// ============================================================================
export const TEXTURE_GOBOS: GoboPattern[] = [
  {
    id: 'texture-water-ripples',
    name: 'Water Ripples',
    description: 'Caustic water reflection pattern',
    category: 'textures',
    imagePath: '/gobos/textures/water_ripples.png',
    thumbnailPath: '/thumbnails/gobos/water_ripples.jpg',
    size: 'A',
    material: 'glass',
    rotatable: true,
    tags: ['water','pool','underwater'],
  },
  {
    id: 'texture-rain-glass',
    name: 'Rain on Glass',
    description: 'Raindrops on window pattern',
    category: 'textures',
    imagePath: '/gobos/textures/rain_glass.png',
    thumbnailPath: '/thumbnails/gobos/rain_glass.jpg',
    size: 'B',
    material: 'glass',
    rotatable: false,
    tags: ['rain','moody','romantic'],
  },
  {
    id: 'texture-brick-wall',
    name: 'Brick Wall',
    description: 'Brick wall texture pattern',
    category: 'textures',
    imagePath: '/gobos/textures/brick_wall.png',
    thumbnailPath: '/thumbnails/gobos/brick_wall.jpg',
    size: 'A',
    material: 'steel',
    rotatable: false,
    tags: ['urban','grunge','industrial'],
  },
  {
    id: 'texture-chain-link',
    name: 'Chain Link Fence',
    description: 'Chain link fence pattern',
    category: 'textures',
    imagePath: '/gobos/textures/chain_link.png',
    thumbnailPath: '/thumbnails/gobos/chain_link.jpg',
    size: 'B',
    material: 'steel',
    rotatable: true,
    tags: ['urban','industrial','gritty'],
  },
];

// ============================================================================
// Export all gobos
// ============================================================================
export const ALL_GOBOS: GoboPattern[] = [
  ...WINDOW_GOBOS,
  ...BLINDS_GOBOS,
  ...NATURE_GOBOS,
  ...CLOUDS_GOBOS,
  ...ABSTRACT_GOBOS,
  ...ARCHITECTURAL_GOBOS,
  ...BREAKUP_GOBOS,
  ...TEXTURE_GOBOS,
];

export const GOBOS_BY_CATEGORY: Record<GoboCategory, GoboPattern[]> = {
  windows: WINDOW_GOBOS,
  blinds: BLINDS_GOBOS,
  nature: NATURE_GOBOS,
  clouds: CLOUDS_GOBOS,
  abstract: ABSTRACT_GOBOS,
  architectural: ARCHITECTURAL_GOBOS,
  breakup: BREAKUP_GOBOS,
  textures: TEXTURE_GOBOS,
  symbols: [],
  custom: [],
};

/**
 * Get gobo by ID
 */
export function getGoboById(id: string): GoboPattern | undefined {
  return ALL_GOBOS.find(gobo => gobo.id === id);
}

/**
 * Search gobos by tags
 */
export function searchGobosByTag(tag: string): GoboPattern[] {
  return ALL_GOBOS.filter(gobo => gobo.tags?.includes(tag.toLowerCase()));
}

/**
 * Get gobos by material
 */
export function getGobosByMaterial(material: GoboPattern['material']): GoboPattern[] {
  return ALL_GOBOS.filter(gobo => gobo.material === material);
}

