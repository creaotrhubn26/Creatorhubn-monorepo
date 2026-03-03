/**
 * HDRI recommendation service.
 *
 * Returns deterministic, context-aware environment recommendations
 * based on character tags and metadata.
 */

export interface HDRIRecommendation {
  id: string;
  name: string;
  category: string;
  url: string;
  thumbnail: string;
  intensity: number;
  reason: string;
  matchScore: number;
}

export interface CharacterMetadata {
  genre?: string;
  era?: string;
  mood?: string;
  tags?: string[];
}

interface HDRIPreset {
  name: string;
  category: string;
  url: string;
  thumbnail: string;
  intensity: number;
  description: string;
  tags: string[];
}

const PROFESSION_HDRI_MAP: Record<string, string[]> = {
  barber: ['studio_small_03', 'studio_small_01', 'hotel_room', 'music_hall'],
  salon: ['studio_small_02', 'studio_small_05', 'entrance_hall', 'modern_buildings'],
  'makeup-artist': ['studio_small_03', 'photo_studio_01', 'studio_small_08'],
  'spa-therapist': ['studio_small_02', 'hotel_room', 'small_cathedral'],
  chef: ['empty_warehouse', 'studio_small_04', 'modern_buildings', 'urban_alley'],
  pastry: ['studio_small_02', 'studio_small_05', 'entrance_hall'],
  sushi: ['studio_small_03', 'studio_small_07', 'music_hall'],
  bbq: ['empty_warehouse', 'old_depot', 'kloppenheim_06'],
  barista: ['urban_alley', 'hotel_room', 'modern_buildings', 'studio_small_01'],
  baker: ['studio_small_02', 'empty_warehouse', 'entrance_hall'],
  mechanic: ['empty_warehouse', 'old_depot', 'peppermint_powerplant'],
  electrician: ['empty_warehouse', 'old_depot', 'modern_buildings'],
  welder: ['peppermint_powerplant', 'empty_warehouse', 'old_depot'],
  'tattoo-artist': ['urban_alley', 'studio_small_06', 'leadenhall_market'],
  jeweler: ['studio_small_03', 'studio_small_08', 'entrance_hall'],
  florist: ['studio_small_02', 'autumn_forest', 'sunflowers', 'meadow'],
  cinematographer: ['empty_warehouse', 'peppermint_powerplant', 'urban_alley', 'studio_small_06'],
  'film-maker': ['empty_warehouse', 'studio_small_06', 'urban_alley', 'old_depot'],
  documentary: ['hotel_room', 'entrance_hall', 'studio_small_04', 'urban_alley'],
  'music-video': ['urban_alley', 'peppermint_powerplant', 'studio_small_06', 'night_bridge'],
  podcast: ['hotel_room', 'studio_small_04', 'studio_small_02'],
  interview: ['hotel_room', 'studio_small_03', 'entrance_hall', 'studio_small_04'],
  'school-portrait': ['studio_small_03', 'studio_small_09', 'photo_studio_01', 'studio_neutral'],
  yearbook: ['studio_small_03', 'studio_small_09', 'photo_studio_01', 'studio_neutral'],
  'class-photo': ['school_quad', 'empty_warehouse_01', 'studio_small_09', 'studio_neutral'],
  graduation: ['entrance_hall', 'music_hall_01', 'studio_small_09', 'school_quad'],
  'sports-team': ['school_quad', 'empty_warehouse_01', 'studio_small_06'],
  school: ['studio_small_09', 'studio_neutral', 'school_quad', 'entrance_hall'],
  professional: ['studio_small_03', 'studio_small_01', 'photo_studio_01'],
  creative: ['studio_small_05', 'studio_small_02', 'urban_alley'],
  industrial: ['empty_warehouse', 'old_depot', 'peppermint_powerplant'],
  elegant: ['entrance_hall', 'music_hall', 'dancing_hall', 'small_cathedral'],
};

const GENRE_HDRI_MAP: Record<string, string[]> = {
  'film-noir': ['studio_small_06', 'urban_alley', 'night_bridge', 'leadenhall_market'],
  'sci-fi': ['peppermint_powerplant', 'modern_buildings', 'studio_small_07'],
  western: ['kloppenheim_06', 'wasteland_clouds', 'rural_asphalt_road', 'rosendal_plains'],
  horror: ['moonlit_golf', 'night_bridge', 'old_depot', 'small_cathedral'],
  fantasy: ['autumn_forest', 'small_cathedral', 'meadow', 'snowy_forest_path'],
  action: ['empty_warehouse', 'urban_alley', 'peppermint_powerplant'],
  'period-drama': ['entrance_hall', 'music_hall', 'small_cathedral', 'dancing_hall'],
  superhero: ['modern_buildings', 'urban_alley', 'studio_small_08'],
  profession: ['studio_small_03', 'empty_warehouse', 'hotel_room'],
};

const ERA_HDRI_MAP: Record<string, string[]> = {
  '1940s': ['studio_small_06', 'old_depot', 'entrance_hall'],
  '1950s': ['studio_small_01', 'hotel_room', 'music_hall'],
  modern: ['studio_small_03', 'modern_buildings', 'urban_alley'],
  traditional: ['old_depot', 'entrance_hall', 'small_cathedral'],
  futuristic: ['peppermint_powerplant', 'modern_buildings', 'studio_small_07'],
  medieval: ['small_cathedral', 'autumn_forest'],
  victorian: ['entrance_hall', 'music_hall', 'old_depot'],
  classic: ['studio_small_01', 'hotel_room', 'entrance_hall'],
  industrial: ['empty_warehouse', 'old_depot', 'peppermint_powerplant'],
  elegant: ['dancing_hall', 'music_hall', 'entrance_hall'],
};

const MOOD_HDRI_MAP: Record<string, string[]> = {
  gritty: ['urban_alley', 'empty_warehouse', 'old_depot'],
  elegant: ['entrance_hall', 'music_hall', 'dancing_hall'],
  professional: ['studio_small_03', 'studio_small_01', 'photo_studio_01'],
  creative: ['studio_small_05', 'urban_alley', 'peppermint_powerplant'],
  warm: ['studio_small_02', 'sunflowers', 'venice_sunset'],
  cool: ['studio_small_07', 'snowy_forest_path', 'moonlit_golf'],
  dramatic: ['studio_small_04', 'studio_small_06', 'night_bridge'],
  serene: ['meadow', 'autumn_forest', 'hotel_room'],
  intense: ['peppermint_powerplant', 'empty_warehouse', 'wasteland_clouds'],
  mysterious: ['moonlit_golf', 'night_bridge', 'old_depot'],
  authoritative: ['modern_buildings', 'entrance_hall', 'studio_small_03'],
};

const HDRI_PRESETS: Record<string, HDRIPreset> = {
  studio_small_01: makePreset('Studio Small 01', 'studio', 1.0),
  studio_small_02: makePreset('Studio Small 02', 'studio', 1.0),
  studio_small_03: makePreset('Studio Small 03', 'studio', 1.0),
  studio_small_04: makePreset('Studio Small 04', 'studio', 1.1),
  studio_small_05: makePreset('Studio Small 05', 'studio', 1.0),
  studio_small_06: makePreset('Studio Small 06', 'studio', 0.9),
  studio_small_07: makePreset('Studio Small 07', 'studio', 1.0),
  studio_small_08: makePreset('Studio Small 08', 'studio', 1.2),
  studio_small_09: makePreset('Studio Small 09', 'studio', 1.0),
  studio_neutral: makePreset('Studio Neutral', 'studio', 1.0),
  photo_studio_01: makePreset('Photo Studio 01', 'studio', 1.0),
  peppermint_powerplant: makePreset('Peppermint Powerplant', 'industrial', 0.8),

  empty_warehouse: makePreset('Empty Warehouse', 'indoor', 1.0),
  empty_warehouse_01: makePreset('Empty Warehouse 01', 'indoor', 1.0),
  urban_alley: makePreset('Urban Alley', 'indoor', 0.9),
  hotel_room: makePreset('Hotel Room', 'indoor', 0.7),
  modern_buildings: makePreset('Modern Buildings', 'indoor', 0.8),
  music_hall: makePreset('Music Hall', 'indoor', 0.8),
  music_hall_01: makePreset('Music Hall 01', 'indoor', 0.8),
  entrance_hall: makePreset('Entrance Hall', 'indoor', 0.8),
  old_depot: makePreset('Old Depot', 'indoor', 0.9),
  small_cathedral: makePreset('Small Cathedral', 'indoor', 0.7),
  dancing_hall: makePreset('Dancing Hall', 'night', 0.7),
  leadenhall_market: makePreset('Leadenhall Market', 'indoor', 0.8),

  school_quad: makePreset('School Quad', 'outdoor', 1.0),
  kloppenheim_06: makePreset('Kloppenheim 06', 'outdoor', 1.0),
  autumn_forest: makePreset('Autumn Forest', 'outdoor', 0.9),
  meadow: makePreset('Meadow', 'outdoor', 1.0),
  rural_asphalt_road: makePreset('Rural Asphalt Road', 'outdoor', 1.0),
  snowy_forest_path: makePreset('Snowy Forest Path', 'outdoor', 0.9),
  wasteland_clouds: makePreset('Wasteland Clouds', 'outdoor', 0.9),
  rosendal_plains: makePreset('Rosendal Plains', 'outdoor', 1.1),
  dikhololo_night: makePreset('Dikhololo Night', 'night', 0.4),
  sunflowers: makePreset('Sunflowers', 'sunset', 1.4),
  venice_sunset: makePreset('Venice Sunset', 'sunset', 1.3),
  moonlit_golf: makePreset('Moonlit Golf', 'night', 0.5),
  night_bridge: makePreset('Night Bridge', 'night', 0.6),
};

const REASON_TEMPLATES = {
  profession: (profession: string) => `Optimized for ${profession} style portraits`,
  genre: (genre: string) => `Matches a ${genre} visual mood`,
  era: (era: string) => `Supports ${era} atmosphere`,
  mood: (mood: string) => `Reinforces a ${mood} scene tone`,
  fallback: () => 'Reliable general-purpose lighting',
};

export function getHDRIRecommendations(
  characterName: string,
  characterTags: string[] = [],
  metadata?: CharacterMetadata,
): HDRIRecommendation[] {
  const allTags = new Set<string>();
  for (const tag of characterTags) {
    const value = tag.trim().toLowerCase();
    if (value.length > 0) {
      allTags.add(value);
    }
  }
  for (const token of characterName.split(/\s+/)) {
    const value = token.trim().toLowerCase();
    if (value.length > 2) {
      allTags.add(value);
    }
  }
  if (metadata?.tags) {
    for (const tag of metadata.tags) {
      const value = tag.trim().toLowerCase();
      if (value.length > 0) {
        allTags.add(value);
      }
    }
  }

  const scored: Map<string, { points: number; reasons: string[] }> = new Map();

  const addScore = (hdriId: string, points: number, reason: string): void => {
    if (!HDRI_PRESETS[hdriId]) {
      return;
    }
    const current = scored.get(hdriId) ?? { points: 0, reasons: [] };
    current.points += points;
    if (!current.reasons.includes(reason)) {
      current.reasons.push(reason);
    }
    scored.set(hdriId, current);
  };

  for (const tag of allTags) {
    const mapped = PROFESSION_HDRI_MAP[tag];
    if (!mapped) {
      continue;
    }
    mapped.forEach((hdriId, index) => {
      addScore(hdriId, Math.max(2, 16 - index * 3), REASON_TEMPLATES.profession(tag));
    });
  }

  if (metadata?.genre) {
    const genre = metadata.genre.toLowerCase();
    const mapped = GENRE_HDRI_MAP[genre];
    if (mapped) {
      mapped.forEach((hdriId, index) => {
        addScore(hdriId, Math.max(2, 14 - index * 2), REASON_TEMPLATES.genre(genre));
      });
    }
  }

  if (metadata?.era) {
    const era = metadata.era.toLowerCase();
    const mapped = ERA_HDRI_MAP[era];
    if (mapped) {
      mapped.forEach((hdriId, index) => {
        addScore(hdriId, Math.max(1, 10 - index * 2), REASON_TEMPLATES.era(era));
      });
    }
  }

  if (metadata?.mood) {
    const mood = metadata.mood.toLowerCase();
    const mapped = MOOD_HDRI_MAP[mood];
    if (mapped) {
      mapped.forEach((hdriId, index) => {
        addScore(hdriId, Math.max(1, 8 - index), REASON_TEMPLATES.mood(mood));
      });
    }
  }

  if (scored.size === 0) {
    ['studio_small_03', 'studio_small_01', 'photo_studio_01'].forEach((hdriId, index) => {
      addScore(hdriId, 6 - index, REASON_TEMPLATES.fallback());
    });
  }

  const maxPoints = Math.max(
    1,
    ...Array.from(scored.values(), (entry) => entry.points),
  );

  return Array.from(scored.entries())
    .map(([id, data]) => {
      const preset = HDRI_PRESETS[id];
      return {
        id,
        name: preset.name,
        category: preset.category,
        url: preset.url,
        thumbnail: preset.thumbnail,
        intensity: preset.intensity,
        reason: data.reasons[0] ?? REASON_TEMPLATES.fallback(),
        matchScore: Math.max(1, Math.round((data.points / maxPoints) * 100)),
      } satisfies HDRIRecommendation;
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);
}

export function getAllHDRIPresets(): Array<{ id: string } & HDRIPreset> {
  return Object.entries(HDRI_PRESETS)
    .map(([id, preset]) => ({
      id,
      ...preset,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getHDRIById(id: string): HDRIPreset | undefined {
  return HDRI_PRESETS[id];
}

function makePreset(name: string, category: string, intensity: number): HDRIPreset {
  const slug = toSlug(name);
  return {
    name,
    category,
    url: `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${slug}_1k.hdr`,
    thumbnail: `https://cdn.polyhaven.com/asset_img/thumbs/${slug}.png`,
    intensity,
    description: `${name} lighting preset`,
    tags: category === 'studio' ? ['studio', 'portrait'] : [category],
  };
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default {
  getHDRIRecommendations,
  getAllHDRIPresets,
  getHDRIById,
};
