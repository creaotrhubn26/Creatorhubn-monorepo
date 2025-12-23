/**
 * HDRI Recommendation Service
 * 
 * Maps character types, genres, and professions to recommended HDRI environments.
 * Provides context-aware environment suggestions for optimal photography simulation.
 */

import { logger } from './logger';

const log = logger.module('HDRIRecommendation');

export interface HDRIRecommendation {
  id: string;
  name: string;
  category: string;
  url: string;
  thumbnail: string;
  intensity: number;
  reason: string;
  matchScore: number; // 0-100
}

// Character tags to HDRI mappings
const PROFESSION_HDRI_MAP: Record<string, string[]> = {
  // Barbershop & Salon
  barber: ['studio_small_03','studio_small_01','hotel_room','music_hall'],
  salon: ['studio_small_02','studio_small_05','entrance_hall','modern_buildings']'makeup-artist': ['studio_small_03','photo_studio_01','studio_small_08']'spa-therapist': ['studio_small_02','hotel_room','small_cathedral'],
  
  // Culinary
  chef: ['empty_warehouse','studio_small_04','modern_buildings','urban_alley'],
  pastry: ['studio_small_02','studio_small_05','entrance_hall'],
  sushi: ['studio_small_03','studio_small_07','music_hall'],
  bbq: ['empty_warehouse','old_depot','kloppenheim_06'],
  barista: ['urban_alley','hotel_room','modern_buildings','studio_small_01'],
  baker: ['studio_small_02','empty_warehouse','entrance_hall'],
  butcher: ['empty_warehouse','old_depot','studio_small_04'],
  sommelier: ['music_hall','entrance_hall','small_cathedral','dancing_hall'],
  
  // Trades & Crafts
  mechanic: ['empty_warehouse','old_depot','peppermint_powerplant'],
  carpenter: ['empty_warehouse','old_depot','studio_small_04'],
  electrician: ['empty_warehouse','old_depot','modern_buildings'],
  plumber: ['empty_warehouse','old_depot','urban_alley'],
  welder: ['peppermint_powerplant','empty_warehouse','old_depot']'tattoo-artist': ['urban_alley','studio_small_06','leadenhall_market'],
  jeweler: ['studio_small_03','studio_small_08','entrance_hall'],
  blacksmith: ['peppermint_powerplant','old_depot','empty_warehouse'],
  cobbler: ['old_depot','entrance_hall','studio_small_04'],
  florist: ['studio_small_02','autumn_forest','sunflowers','meadow'],
  tailor: ['studio_small_03','entrance_hall','hotel_room'],
  potter: ['studio_small_04','empty_warehouse','old_depot'],
  
  // ============================================================================
  // SCHOOL PHOTOGRAPHY SPECIALIZATIONS
  // ============================================================================
  
  // School Photography - Individual Portraits
  'school-portrait': ['studio_small_03','studio_small_09','photo_studio_01','studio_neutral']'yearbook': ['studio_small_03','studio_small_09','photo_studio_01','studio_neutral']'headshot-school': ['studio_small_03','studio_small_01','photo_studio_01'],
  
  // School Photography - Group/Class Photos
  'class-photo': ['school_quad','empty_warehouse_01','studio_small_09','studio_neutral']'group-school': ['school_quad','empty_warehouse_01','studio_small_03','entrance_hall']'team-photo': ['school_quad','empty_warehouse_01','studio_neutral'],
  
  // School Photography - Locations
  'gymnasium': ['school_quad','empty_warehouse_01','studio_neutral']'school-hall': ['entrance_hall','music_hall_01','school_quad']'classroom': ['studio_small_04','entrance_hall','studio_neutral']'school-outdoor': ['school_quad','meadow','autumn_forest','sunflowers'],
  
  // School Photography - Events
  'graduation': ['entrance_hall','music_hall_01','studio_small_09','school_quad']'prom': ['dancing_hall','music_hall_01','entrance_hall']'sports-team': ['school_quad','empty_warehouse_01','studio_small_06']'school-event': ['entrance_hall','music_hall_01','school_quad'],
  
  // School Photography - General
  'school': ['studio_small_09','studio_neutral','school_quad','entrance_hall']'school_photography': ['studio_small_09','studio_neutral','school_quad','entrance_hall'],
  
  // General categories
  professional: ['studio_small_03','studio_small_01','photo_studio_01'],
  creative: ['studio_small_05','studio_small_02','urban_alley'],
  industrial: ['empty_warehouse','old_depot','peppermint_powerplant'],
  elegant: ['entrance_hall','music_hall','dancing_hall','small_cathedral']
  
  // ============================================================================
  // VIDEOGRAPHER SPECIALIZATIONS
  // ============================================================================
  
  // Cinematographer
  cinematographer: ['empty_warehouse','peppermint_powerplant','urban_alley','studio_small_06']'film-maker': ['empty_warehouse','studio_small_06','urban_alley','old_depot'],
  
  // Commercial Video
  'commercial-video': ['studio_small_03','photo_studio_01','modern_buildings'],
  advertising: ['studio_small_01','studio_small_03','photo_studio_01'],
  
  // Documentary
  documentary: ['hotel_room','entrance_hall','studio_small_04','urban_alley'],
  journalism: ['urban_alley','modern_buildings','studio_small_01'],
  
  // Music Video
  'music-video': ['urban_alley','peppermint_powerplant','studio_small_06','night_bridge'],
  performance: ['urban_alley','studio_small_05','peppermint_powerplant'],
  concert: ['urban_alley','night_bridge','peppermint_powerplant'],
  
  // Corporate Video
  'corporate-video': ['studio_small_01','studio_small_03','modern_buildings','photo_studio_01'],
  training: ['studio_small_01','studio_small_03','photo_studio_01'],
  testimonial: ['studio_small_03','hotel_room','photo_studio_01'],
  
  // Social Media / Content Creator
  youtube: ['studio_small_01','studio_small_02','hotel_room'],
  tiktok: ['studio_small_05','urban_alley','studio_small_02'],
  instagram: ['studio_small_02','studio_small_05','hotel_room'],
  vlogger: ['hotel_room','studio_small_02','urban_alley']'content-creator': ['studio_small_01','studio_small_02','hotel_room'],
  
  // Live Streaming / Broadcast
  broadcast: ['studio_small_01','photo_studio_01','studio_small_03']'live-streaming': ['studio_small_01','studio_small_02','photo_studio_01'],
  news: ['studio_small_01','photo_studio_01','studio_small_03'],
  podcast: ['hotel_room','studio_small_04','studio_small_02'],
  
  // VFX / Green Screen
  vfx: ['studio_small_01','photo_studio_01','peppermint_powerplant']'green-screen': ['studio_small_01','photo_studio_01','studio_small_03'],
  compositing: ['studio_small_01','photo_studio_01','empty_warehouse'],
  
  // Interview
  interview: ['hotel_room','studio_small_03','entrance_hall','studio_small_04']'talking-head': ['studio_small_01','studio_small_03','hotel_room'],
};

// Genre to HDRI mappings
const GENRE_HDRI_MAP: Record<string, string[]> = {
  'film-noir': ['studio_small_06','urban_alley','night_bridge','leadenhall_market']'sci-fi': ['peppermint_powerplant','modern_buildings','studio_small_07']'western': ['kloppenheim_06','wasteland_clouds','rural_asphalt_road','rosendal_plains']'horror': ['moonlit_golf','night_bridge','old_depot','small_cathedral']'cosmic-horror': ['moonlit_golf','dikhololo_night','wasteland_clouds']'fantasy': ['autumn_forest','small_cathedral','meadow','snowy_forest_path']'action': ['empty_warehouse','urban_alley','peppermint_powerplant']'period-drama': ['entrance_hall','music_hall','small_cathedral','dancing_hall']'asian-cinema': ['studio_small_03','autumn_forest','music_hall']'superhero': ['modern_buildings','urban_alley','studio_small_08']'profession': ['studio_small_03','empty_warehouse','hotel_room'],
};

// Era to HDRI mappings
const ERA_HDRI_MAP: Record<string, string[]> = {
  '1940s': ['studio_small_06','old_depot','entrance_hall']'1950s': ['studio_small_01','hotel_room','music_hall']'modern': ['studio_small_03','modern_buildings','urban_alley']'traditional': ['old_depot','entrance_hall','small_cathedral']'futuristic': ['peppermint_powerplant','modern_buildings','studio_small_07']'medieval': ['small_cathedral','autumn_forest']'victorian': ['entrance_hall','music_hall','old_depot']'classic': ['studio_small_01','hotel_room','entrance_hall']'industrial': ['empty_warehouse','old_depot','peppermint_powerplant']'elegant': ['dancing_hall','music_hall','entrance_hall'],
};

// Mood to HDRI mappings
const MOOD_HDRI_MAP: Record<string, string[]> = {
  'gritty': ['urban_alley','empty_warehouse','old_depot']'elegant': ['entrance_hall','music_hall','dancing_hall']'professional': ['studio_small_03','studio_small_01','photo_studio_01']'creative': ['studio_small_05','urban_alley','peppermint_powerplant']'warm': ['studio_small_02','sunflowers','venice_sunset']'cool': ['studio_small_07','snowy_forest_path','moonlit_golf']'dramatic': ['studio_small_04','studio_small_06','night_bridge']'serene': ['meadow','autumn_forest','hotel_room']'intense': ['peppermint_powerplant','empty_warehouse','wasteland_clouds']'mysterious': ['moonlit_golf','night_bridge','old_depot']'authoritative': ['modern_buildings','entrance_hall','studio_small_03'],
};

// Full HDRI preset data (simplified for recommendations)
const HDRI_PRESETS: Record<string, { name: string; category: string; url: string; thumbnail: string; intensity: number; description: string }> = {
  // Studio
  'studio_small_01': { name: 'Studio Small 01', category: 'studio', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_01_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_01.png', intensity: 1.0, description: 'Clean studio with even lighting' }, 'studio_small_02': { name: 'Studio Small 02', category: 'studio', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_02_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_02.png', intensity: 1.0, description: 'Studio with warm tones' }, 'studio_small_03': { name: 'Studio Small 03', category: 'studio', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_03.png', intensity: 1.0, description: 'Professional studio with soft lighting' }, 'studio_small_04': { name: 'Studio Small 04', category: 'studio', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_04_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_04.png', intensity: 1.1, description: 'Studio with dramatic shadows' }, 'studio_small_05': { name: 'Studio Small 05', category: 'studio', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_05_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_05.png', intensity: 1.0, description: 'Bright studio setup' }, 'studio_small_06': { name: 'Studio Small 06', category: 'studio', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_06_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_06.png', intensity: 0.9, description: 'Moody studio lighting' }, 'studio_small_07': { name: 'Studio Small 07', category: 'studio', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_07_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_07.png', intensity: 1.0, description: 'Cool-toned studio' }, 'studio_small_08': { name: 'Studio Small 08', category: 'studio', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_08.png', intensity: 1.2, description: 'High-key studio setup' }, 'photo_studio_01': { name: 'Photo Studio 01', category: 'studio', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/photo_studio_01_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/photo_studio_01.png', intensity: 1.0, description: 'Professional photo studio' }, 'peppermint_powerplant': { name: 'Peppermint Powerplant', category: 'studio', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/peppermint_powerplant_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/peppermint_powerplant.png', intensity: 0.8, description: 'Industrial studio vibe' },
  
  // Indoor
  'empty_warehouse': { name: 'Empty Warehouse', category: 'indoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/empty_warehouse_01_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/empty_warehouse_01.png', intensity: 1.0, description: 'Industrial warehouse space' }, 'urban_alley': { name: 'Urban Alley', category: 'indoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/urban_alley_01_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/urban_alley_01.png', intensity: 0.9, description: 'City alley with overhead lighting' }'hotel_room': { name: 'Hotel Room', category: 'indoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/hotel_room_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/hotel_room.png', intensity: 0.7, description: 'Cozy hotel interior' }'modern_buildings': { name: 'Modern Buildings', category: 'indoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/modern_buildings_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/modern_buildings.png', intensity: 0.8, description: 'Modern architecture interior' }'music_hall': { name: 'Music Hall', category: 'indoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/music_hall_01_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/music_hall_01.png', intensity: 0.8, description: 'Concert hall with dramatic lighting' }'entrance_hall': { name: 'Entrance Hall', category: 'indoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/entrance_hall_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/entrance_hall.png', intensity: 0.8, description: 'Grand entrance foyer' }'old_depot': { name: 'Old Depot', category: 'indoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/old_depot_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/old_depot.png', intensity: 0.9, description: 'Historic train depot' }'small_cathedral': { name: 'Small Cathedral', category: 'indoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/small_cathedral_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/small_cathedral.png', intensity: 0.7, description: 'Gothic cathedral interior' }'dancing_hall': { name: 'Dancing Hall', category: 'night', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/dancing_hall_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/dancing_hall.png', intensity: 0.7, description: 'Ballroom dance floor' }'leadenhall_market': { name: 'Leadenhall Market', category: 'indoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/leadenhall_market_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/leadenhall_market.png', intensity: 0.8, description: 'Victorian covered market' },
  
  // Outdoor
  'kloppenheim_06': { name: 'Kloppenheim Outdoor', category: 'outdoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloppenheim_06_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/kloppenheim_06.png', intensity: 1.0, description: 'Bright daylight with clear sky' }, 'autumn_forest': { name: 'Autumn Forest', category: 'outdoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autumn_forest_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/autumn_forest.png', intensity: 0.9, description: 'Natural forest lighting with autumn colors' }'meadow': { name: 'Meadow', category: 'outdoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/meadow_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/meadow.png', intensity: 1.0, description: 'Open meadow with bright sun' }'rural_asphalt_road': { name: 'Rural Road', category: 'outdoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/rural_asphalt_road_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/rural_asphalt_road.png', intensity: 1.0, description: 'Country road in daylight' }'snowy_forest_path': { name: 'Snowy Forest Path', category: 'outdoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/snowy_forest_path_01_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/snowy_forest_path_01.png', intensity: 0.9, description: 'Winter forest scene' }'wasteland_clouds': { name: 'Wasteland Clouds', category: 'outdoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/wasteland_clouds_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/wasteland_clouds.png', intensity: 0.9, description: 'Dramatic cloudy wasteland' }'rosendal_plains': { name: 'Rosendal Plains', category: 'outdoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/rosendal_plains_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/rosendal_plains.png', intensity: 1.1, description: 'Open plains warm light' }'dikhololo_night': { name: 'Dikhololo Night', category: 'outdoor', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/dikhololo_night_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/dikhololo_night.png', intensity: 0.4, description: 'Starry night sky' },
  
  // Sunset
  'sunflowers': { name: 'Sunflowers Sunset', category: 'sunset', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/sunflowers_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/sunflowers.png', intensity: 1.4, description: 'Sunflower field at golden hour' }'venice_sunset': { name: 'Venice Sunset', category: 'sunset', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/venice_sunset.png', intensity: 1.3, description: 'Warm Italian sunset over canals' },
  
  // Night
  'moonlit_golf': { name: 'Moonlit Golf Course', category: 'night', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/moonlit_golf_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/moonlit_golf.png', intensity: 0.5, description: 'Night scene with moonlight' }'night_bridge': { name: 'Night Bridge', category: 'night', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/night_bridge_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/night_bridge.png', intensity: 0.6, description: 'Urban bridge at night' },
};

// Reason templates
const REASON_TEMPLATES = {
  profession: (profession: string) => `Perfect lighting for ${profession} professional photography`,
  genre: (genre: string) => `Matches the ${genre} film aesthetic`,
  era: (era: string) => `Authentic ${era} period atmosphere`,
  mood: (mood: string) => `Creates a ${mood} mood for the scene`,
  tags: (tag: string) => `Ideal environment for ${tag} subjects`,
  default: () => 'Good general-purpose studio lighting',
};

export interface CharacterMetadata {
  genre?: string;
  era?: string;
  mood?: string;
  tags?: string[];
}

/**
 * Get HDRI recommendations for a character
 */
export function getHDRIRecommendations(
  characterName: string,
  characterTags: string[] = [],
  metadata?: CharacterMetadata
): HDRIRecommendation[] {
  const recommendations: Map<string, { score: number; reasons: string[] }> = new Map();
  
  // Score based on profession tags
  characterTags.forEach(tag => {
    const tagLower = tag.toLowerCase();
    const matchingHDRIs = PROFESSION_HDRI_MAP[tagLower];
    if (matchingHDRIs) {
      matchingHDRIs.forEach((hdriId, index) => {
        const existing = recommendations.get(hdriId) || { score: 0, reasons: [] };
        existing.score += (10 - index * 2); // Higher score for first matches
        existing.reasons.push(REASON_TEMPLATES.profession(tag));
        recommendations.set(hdriId, existing);
      });
    }
  });
  
  // Score based on genre
  if (metadata?.genre) {
    const genreHDRIs = GENRE_HDRI_MAP[metadata.genre];
    if (genreHDRIs) {
      genreHDRIs.forEach((hdriId, index) => {
        const existing = recommendations.get(hdriId) || { score: 0, reasons: [] };
        existing.score += (15 - index * 3); // Genre is important
        existing.reasons.push(REASON_TEMPLATES.genre(metadata.genre!));
        recommendations.set(hdriId, existing);
      });
    }
  }
  
  // Score based on era
  if (metadata?.era) {
    const eraHDRIs = ERA_HDRI_MAP[metadata.era];
    if (eraHDRIs) {
      eraHDRIs.forEach((hdriId, index) => {
        const existing = recommendations.get(hdriId) || { score: 0, reasons: [] };
        existing.score += (8 - index * 2);
        existing.reasons.push(REASON_TEMPLATES.era(metadata.era!));
        recommendations.set(hdriId, existing);
      });
    }
  }
  
  // Score based on mood
  if (metadata?.mood) {
    const moodHDRIs = MOOD_HDRI_MAP[metadata.mood];
    if (moodHDRIs) {
      moodHDRIs.forEach((hdriId, index) => {
        const existing = recommendations.get(hdriId) || { score: 0, reasons: [] };
        existing.score += (6 - index);
        existing.reasons.push(REASON_TEMPLATES.mood(metadata.mood!));
        recommendations.set(hdriId, existing);
      });
    }
  }
  
  // If no matches, add default studio HDRIs
  if (recommendations.size === 0) {
    ['studio_small_03','studio_small_01','photo_studio_01'].forEach((hdriId, index) => {
      recommendations.set(hdriId, {
        score: 5 - index,
        reasons: [REASON_TEMPLATES.default()],
      });
    });
  }
  
  // Convert to array and sort by score
  const results: HDRIRecommendation[] = [];
  recommendations.forEach((data, hdriId) => {
    const preset = HDRI_PRESETS[hdriId];
    if (preset) {
      results.push({
        id: hdriId,
        name: preset.name,
        category: preset.category,
        url: preset.url,
        thumbnail: preset.thumbnail,
        intensity: preset.intensity,
        reason: data.reasons[0], // Use first (most relevant) reason
        matchScore: Math.min(100, data.score * 5),
      });
    }
  });
  
  // Sort by score and take top 6
  results.sort((a, b) => b.matchScore - a.matchScore);
  
  log.debug(`HDRI recommendations for ${characterName}:`, results.slice(0, 6));
  
  return results.slice(0, 6);
}

/**
 * Get all available HDRI presets
 */
export function getAllHDRIPresets() {
  return Object.entries(HDRI_PRESETS).map(([id, preset]) => ({
    id,
    ...preset,
  }));
}

/**
 * Get HDRI by ID
 */
export function getHDRIById(id: string) {
  return HDRI_PRESETS[id];
}

export default {
  getHDRIRecommendations,
  getAllHDRIPresets,
  getHDRIById,
};

