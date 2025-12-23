import React, { useState, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('HDRILoader, ');
import {
  Box,
  Paper,
  Typography,
  Button,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Chip,
  Divider,
} from '@mui/material';
import {
  WbSunny,
  Brightness4,
  Brightness7,
  CloudQueue,
  Landscape,
  NightsStay,
  Download,
  Visibility,
  VisibilityOff,
  Cached,
  School,
  DeleteSweep,
  Storage,
  CheckCircle,
  CloudDownload,
  Pause,
  PlayArrow,
  Stop,
  Speed,
  Star,
  StarBorder,
  StarHalf,
} from '@mui/icons-material';
import LinearProgress from '@mui/material/LinearProgress';
import * as THREE from 'three';
import { useVirtualStudio } from '../../../VirtualStudioContext';
import { getThreeScene } from '../../core/services/viewports';
import { hdriCacheService, preCacheManager, PRE_CACHE_HDRIS, PreCacheProgress } from '../../core/services/hdriCacheService';

// Dynamic import for RGBELoader
let RGBELoader: unknown = null;
try {
  RGBELoader = require('three/examples/jsm/loaders/RGBELoader').RGBELoader;
} catch {
  log.warn('RGBELoader not available, ');
}

interface HDRIPreset {
  id: string;
  name: string;
  category: 'studio' | 'outdoor' | 'indoor' | 'sunset' | 'night' | 'overcast' | 'school';
  url: string;
  thumbnail: string;
  intensity: number;
  rotation: number;
  sunPosition?: { x: number; y: number; z: number };
  sunIntensity?: number;
  description: string;
}

// 50+ HDRI Presets (using public HDRI sources - Poly Haven, all CC0 licensed)
const HDRI_PRESETS: HDRIPreset[] = [
  // ============================================================================
  // STUDIO HDRIs (12)
  // ============================================================================
  {
    id: 'studio_small_03',
    name: 'Studio Small 03',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_03.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Professional studio with soft lighting',
  },
  {
    id: 'studio_small_01',
    name: 'Studio Small 01',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_01.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Clean studio with even lighting',
  },
  {
    id: 'studio_small_02',
    name: 'Studio Small 02',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_02_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_02.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Studio with warm tones',
  },
  {
    id: 'studio_small_04',
    name: 'Studio Small 04',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_04_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_04.png',
    intensity: 1.1,
    rotation: 0,
    description: 'Studio with dramatic shadows',
  },
  {
    id: 'studio_small_05',
    name: 'Studio Small 05',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_05_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_05.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Bright studio setup',
  },
  {
    id: 'studio_small_06',
    name: 'Studio Small 06',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_06_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_06.png',
    intensity: 0.9,
    rotation: 0,
    description: 'Moody studio lighting',
  },
  {
    id: 'studio_small_07',
    name: 'Studio Small 07',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_07_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_07.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Cool-toned studio',
  },
  {
    id: 'studio_small_08',
    name: 'Studio Small 08',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_08.png',
    intensity: 1.2,
    rotation: 0,
    description: 'High-key studio setup',
  },
  {
    id: 'studio_small_09',
    name: 'Studio Small 09',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_09.png',
    intensity: 1.2,
    rotation: 0,
    description: 'Compact studio with hard lighting',
  },
  {
    id: 'photo_studio_loft_hall',
    name: 'Photo Studio Loft',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/photo_studio_loft_hall_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/photo_studio_loft_hall.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Large photography studio space',
  },
  {
    id: 'photo_studio_01',
    name: 'Photo Studio 01',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/photo_studio_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/photo_studio_01.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Professional photo studio',
  },
  {
    id: 'peppermint_powerplant',
    name: 'Peppermint Powerplant',
    category: 'studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/peppermint_powerplant_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/peppermint_powerplant.png',
    intensity: 0.8,
    rotation: 0,
    description: 'Industrial studio vibe',
  },

  // ============================================================================
  // OUTDOOR HDRIs (12)
  // ============================================================================
  {
    id: 'kloppenheim_06',
    name: 'Kloppenheim Outdoor',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloppenheim_06_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/kloppenheim_06.png',
    intensity: 1.0,
    rotation: 0,
    sunPosition: { x: 5, y: 10, z: 5 },
    sunIntensity: 1.5,
    description: 'Bright daylight with clear sky',
  },
  {
    id: 'autumn_forest',
    name: 'Autumn Forest',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autumn_forest_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/autumn_forest.png',
    intensity: 0.9,
    rotation: 0,
    description: 'Natural forest lighting with autumn colors',
  },
  {
    id: 'meadow',
    name: 'Meadow',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/meadow_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/meadow.png',
    intensity: 1.0,
    rotation: 0,
    sunPosition: { x: 8, y: 15, z: 3 },
    sunIntensity: 1.8,
    description: 'Open meadow with bright sun',
  },
  {
    id: 'spruit_sunrise',
    name: 'Spruit Sunrise',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/spruit_sunrise_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/spruit_sunrise.png',
    intensity: 1.2,
    rotation: 0,
    sunPosition: { x: 10, y: 5, z: 0 },
    sunIntensity: 2.0,
    description: 'Early morning sunrise',
  },
  {
    id: 'rural_asphalt_road',
    name: 'Rural Road',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/rural_asphalt_road_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/rural_asphalt_road.png',
    intensity: 1.0,
    rotation: 0,
    sunPosition: { x: 5, y: 12, z: 8 },
    sunIntensity: 1.6,
    description: 'Country road in daylight',
  },
  {
    id: 'cape_hill',
    name: 'Cape Hill',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/cape_hill_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/cape_hill.png',
    intensity: 1.0,
    rotation: 0,
    sunPosition: { x: 6, y: 14, z: 4 },
    sunIntensity: 1.7,
    description: 'Hillside with ocean view',
  },
  {
    id: 'kiara_1_dawn',
    name: 'Kiara Dawn',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kiara_1_dawn_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/kiara_1_dawn.png',
    intensity: 1.1,
    rotation: 0,
    sunPosition: { x: 12, y: 8, z: 2 },
    sunIntensity: 1.5,
    description: 'African savanna at dawn',
  },
  {
    id: 'snowy_forest_path',
    name: 'Snowy Forest Path',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/snowy_forest_path_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/snowy_forest_path_01.png',
    intensity: 0.9,
    rotation: 0,
    description: 'Winter forest scene',
  },
  {
    id: 'syferfontein_0d_clear',
    name: 'Clear Sky Field',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/syferfontein_0d_clear_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/syferfontein_0d_clear.png',
    intensity: 1.0,
    rotation: 0,
    sunPosition: { x: 4, y: 16, z: 6 },
    sunIntensity: 2.0,
    description: 'Bright midday clear sky',
  },
  {
    id: 'dreifaltigkeitsberg',
    name: 'Mountain View',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/dreifaltigkeitsberg_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/dreifaltigkeitsberg.png',
    intensity: 1.0,
    rotation: 0,
    sunPosition: { x: 7, y: 10, z: 5 },
    sunIntensity: 1.4,
    description: 'Alpine mountain scenery',
  },
  {
    id: 'dikhololo_night',
    name: 'Dikhololo Night',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/dikhololo_night_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/dikhololo_night.png',
    intensity: 0.4,
    rotation: 0,
    description: 'Starry night sky',
  },
  {
    id: 'wasteland_clouds',
    name: 'Wasteland Clouds',
    category: 'outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/wasteland_clouds_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/wasteland_clouds.png',
    intensity: 0.9,
    rotation: 0,
    description: 'Dramatic cloudy wasteland',
  },

  // ============================================================================
  // SUNSET HDRIs (8)
  // ============================================================================
  {
    id: 'sunset_in_the_chalk_quarry',
    name: 'Sunset Chalk Quarry',
    category: 'sunset',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/sunset_in_the_chalk_quarry_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/sunset_in_the_chalk_quarry.png',
    intensity: 1.5,
    rotation: 0,
    sunPosition: { x: -10, y: 5, z: 0 },
    sunIntensity: 2.0,
    description: 'Golden hour sunset with dramatic clouds',
  },
  {
    id: 'venice_sunset',
    name: 'Venice Sunset',
    category: 'sunset',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/venice_sunset.png',
    intensity: 1.3,
    rotation: 0,
    sunPosition: { x: -8, y: 3, z: -5 },
    sunIntensity: 1.8,
    description: 'Warm Italian sunset over canals',
  },
  {
    id: 'sunflowers',
    name: 'Sunflowers Sunset',
    category: 'sunset',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/sunflowers_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/sunflowers.png',
    intensity: 1.4,
    rotation: 0,
    sunPosition: { x: -6, y: 4, z: 3 },
    sunIntensity: 2.2,
    description: 'Sunflower field at golden hour',
  },
  {
    id: 'cannon_sunset',
    name: 'Cannon Beach Sunset',
    category: 'sunset',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/cannon_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/cannon.png',
    intensity: 1.3,
    rotation: 0,
    sunPosition: { x: -12, y: 2, z: -8 },
    sunIntensity: 1.6,
    description: 'Pacific coast sunset',
  },
  {
    id: 'golden_bay',
    name: 'Golden Bay',
    category: 'sunset',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/golden_bay_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/golden_bay.png',
    intensity: 1.4,
    rotation: 0,
    sunPosition: { x: -10, y: 6, z: 2 },
    sunIntensity: 1.9,
    description: 'Beach at golden hour',
  },
  {
    id: 'harrows_sunset',
    name: 'Harrows Sunset',
    category: 'sunset',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/harrows_sunset_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/harrows_sunset.png',
    intensity: 1.2,
    rotation: 0,
    sunPosition: { x: -8, y: 5, z: -3 },
    sunIntensity: 1.7,
    description: 'Farm fields at sunset',
  },
  {
    id: 'satara_night',
    name: 'Satara Twilight',
    category: 'sunset',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/satara_night_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/satara_night.png',
    intensity: 0.7,
    rotation: 0,
    description: 'African twilight blue hour',
  },
  {
    id: 'rosendal_plains',
    name: 'Rosendal Plains',
    category: 'sunset',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/rosendal_plains_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/rosendal_plains.png',
    intensity: 1.1,
    rotation: 0,
    sunPosition: { x: -5, y: 8, z: 4 },
    sunIntensity: 1.5,
    description: 'Open plains warm light',
  },

  // ============================================================================
  // INDOOR HDRIs (10)
  // ============================================================================
  {
    id: 'music_hall',
    name: 'Music Hall',
    category: 'indoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/music_hall_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/music_hall_01.png',
    intensity: 0.8,
    rotation: 0,
    description: 'Concert hall with dramatic lighting',
  },
  {
    id: 'empty_warehouse',
    name: 'Empty Warehouse',
    category: 'indoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/empty_warehouse_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/empty_warehouse_01.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Industrial warehouse space',
  },
  {
    id: 'urban_alley',
    name: 'Urban Alley',
    category: 'indoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/urban_alley_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/urban_alley_01.png',
    intensity: 0.9,
    rotation: 0,
    description: 'City alley with overhead lighting',
  },
  {
    id: 'hotel_room',
    name: 'Hotel Room',
    category: 'indoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/hotel_room_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/hotel_room.png',
    intensity: 0.7,
    rotation: 0,
    description: 'Cozy hotel interior',
  },
  {
    id: 'modern_buildings',
    name: 'Modern Buildings',
    category: 'indoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/modern_buildings_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/modern_buildings.png',
    intensity: 0.8,
    rotation: 0,
    description: 'Modern architecture interior',
  },
  {
    id: 'theater',
    name: 'Theater',
    category: 'indoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/theater_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/theater_01.png',
    intensity: 0.6,
    rotation: 0,
    description: 'Classic theater lighting',
  },
  {
    id: 'old_depot',
    name: 'Old Depot',
    category: 'indoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/old_depot_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/old_depot.png',
    intensity: 0.9,
    rotation: 0,
    description: 'Historic train depot',
  },
  {
    id: 'hospital_room',
    name: 'Hospital Room',
    category: 'indoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/hospital_room_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/hospital_room.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Clean medical interior',
  },
  {
    id: 'entrance_hall',
    name: 'Entrance Hall',
    category: 'indoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/entrance_hall_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/entrance_hall.png',
    intensity: 0.8,
    rotation: 0,
    description: 'Grand entrance foyer',
  },
  {
    id: 'small_cathedral',
    name: 'Small Cathedral',
    category: 'indoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/small_cathedral_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/small_cathedral.png',
    intensity: 0.7,
    rotation: 0,
    description: 'Gothic cathedral interior',
  },

  // ============================================================================
  // NIGHT HDRIs (6)
  // ============================================================================
  {
    id: 'moonlit_golf',
    name: 'Moonlit Golf Course',
    category: 'night',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/moonlit_golf_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/moonlit_golf.png',
    intensity: 0.5,
    rotation: 0,
    description: 'Night scene with moonlight',
  },
  {
    id: 'night_bridge',
    name: 'Night Bridge',
    category: 'night',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/night_bridge_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/night_bridge.png',
    intensity: 0.6,
    rotation: 0,
    description: 'Urban bridge at night',
  },
  {
    id: 'christmas_photo_studio',
    name: 'Christmas Studio',
    category: 'night',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/christmas_photo_studio_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/christmas_photo_studio_01.png',
    intensity: 0.8,
    rotation: 0,
    description: 'Festive holiday lighting',
  },
  {
    id: 'dancing_hall',
    name: 'Dancing Hall',
    category: 'night',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/dancing_hall_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/dancing_hall.png',
    intensity: 0.7,
    rotation: 0,
    description: 'Ballroom dance floor',
  },
  {
    id: 'gym',
    name: 'Gym Night',
    category: 'night',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/gym_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/gym.png',
    intensity: 0.9,
    rotation: 0,
    description: 'Indoor gym lighting',
  },
  {
    id: 'leadenhall_market',
    name: 'Leadenhall Market',
    category: 'night',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/leadenhall_market_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/leadenhall_market.png',
    intensity: 0.8,
    rotation: 0,
    description: 'Victorian market night',
  },

  // ============================================================================
  // OVERCAST HDRIs (7)
  // ============================================================================
  {
    id: 'kloofendal_48d_partly_cloudy',
    name: 'Partly Cloudy',
    category: 'overcast',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/kloofendal_48d_partly_cloudy.png',
    intensity: 0.8,
    rotation: 0,
    description: 'Soft overcast daylight',
  },
  {
    id: 'overcast_soil',
    name: 'Overcast Soil',
    category: 'overcast',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/overcast_soil_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/overcast_soil.png',
    intensity: 0.7,
    rotation: 0,
    description: 'Flat overcast conditions',
  },
  {
    id: 'cloudy_field',
    name: 'Cloudy Field',
    category: 'overcast',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/cloudy_field_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/cloudy_field.png',
    intensity: 0.8,
    rotation: 0,
    description: 'Open field on cloudy day',
  },
  {
    id: 'noon_grass',
    name: 'Noon Grass',
    category: 'overcast',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/noon_grass_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/noon_grass.png',
    intensity: 0.9,
    rotation: 0,
    description: 'Diffused noon light',
  },
  {
    id: 'misty_pines',
    name: 'Misty Pines',
    category: 'overcast',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/misty_pines_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/misty_pines.png',
    intensity: 0.6,
    rotation: 0,
    description: 'Foggy forest atmosphere',
  },
  {
    id: 'rainforest_trail',
    name: 'Rainforest Trail',
    category: 'overcast',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/rainforest_trail_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/rainforest_trail.png',
    intensity: 0.7,
    rotation: 0,
    description: 'Dense forest canopy',
  },
  {
    id: 'gray_pier',
    name: 'Gray Pier',
    category: 'overcast',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/gray_pier_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/gray_pier.png',
    intensity: 0.8,
    rotation: 0,
    description: 'Moody coastal pier',
  },

  // ============================================================================
  // SCHOOL / CLASS PHOTO HDRIs (8)
  // Optimized for class and group photography with even, flattering lighting
  // ============================================================================
  // ============================================================================
  // Valid Poly Haven HDRIs for school/class photography (CC0 license)
  // Note: Poly Haven doesn't have dedicated classroom/gym HDRIs
  // ============================================================================
  
  // Indoor - Large Spaces
  {
    id: 'school_gymnasium',
    name: 'Large Hall (Gym Style)',
    category: 'school',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/empty_warehouse_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/empty_warehouse_01.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Large indoor space with high ceilings - gym alternative',
  },
  {
    id: 'school_hall_bright',
    name: 'School Lobby / Entrance',
    category: 'school',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/entrance_hall_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/entrance_hall.png',
    intensity: 1.1,
    rotation: 0,
    description: 'Bright entrance hall with natural window light',
  },
  {
    id: 'school_auditorium',
    name: 'Assembly Hall / Auditorium',
    category: 'school',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/music_hall_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/music_hall_01.png',
    intensity: 0.9,
    rotation: 0,
    description: 'Concert hall lighting - choir/drama groups',
  },
  
  // Indoor - Studio Setups
  {
    id: 'school_studio_soft',
    name: 'Photo Studio (Soft)',
    category: 'school',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_03.png',
    intensity: 1.1,
    rotation: 0,
    description: 'Professional soft lighting - yearbook quality',
  },
  {
    id: 'school_studio_even',
    name: 'Photo Studio (Even)',
    category: 'school',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_01.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Even lighting across all rows',
  },
  {
    id: 'school_high_key',
    name: 'Photo Studio (Bright)',
    category: 'school',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_08.png',
    intensity: 1.3,
    rotation: 0,
    description: 'High-key bright yearbook portraits',
  },
  
  // Outdoor - School Grounds
  {
    id: 'school_quad',
    name: 'School Courtyard',
    category: 'school',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/school_quad_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/school_quad.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Actual school quad - outdoor class photos',
  },
  {
    id: 'school_outdoor_shade',
    name: 'Outdoor (Shaded)',
    category: 'school',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/kloofendal_48d_partly_cloudy.png',
    intensity: 0.9,
    rotation: 0,
    description: 'Partly cloudy - no squinting',
  },
  {
    id: 'school_overcast_field',
    name: 'Outdoor (Overcast)',
    category: 'school',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/cloudy_field_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/cloudy_field.png',
    intensity: 1.0,
    rotation: 0,
    description: 'Overcast - very even natural light',
  },
  
  // ============================================================================
  // BLENDERKIT SCHOOL HDRIs (Gymnasium, Classroom, Basketball Court)
  // These require BlenderKit API key for access
  // ============================================================================
  {
    id: 'blenderkit_gymnasium_bw',
    name: 'Gymnasium (B&W)',
    category: 'school',
    url: 'blenderkit://e8fd4f0f-4685-4c0b-b3f3-71bcf697e282',
    thumbnail: 'https://www.blenderkit.com/thumbnails/assets/e8fd4f0f-4685-4c0b-b3f3-71bcf697e282/files/thumbnail_2dc413ba-4c02-4989-9f9a-2ae4c71b89a6.jpg',
    intensity: 1.0,
    rotation: 0,
    description: 'Black and white gymnasium - 16K resolution (BlenderKit)',
  },
  {
    id: 'blenderkit_gym_blue',
    name: 'Gym (Blue Floor)',
    category: 'school',
    url: 'blenderkit://3ee3bd4f-fd0a-4341-a3a7-156cab8f95bd',
    thumbnail: 'https://www.blenderkit.com/thumbnails/assets/3ee3bd4f-fd0a-4341-a3a7-156cab8f95bd/files/thumbnail_e0c4f7a2-2b1a-4d9e-8a6c-3c5b7e2a1f4d.jpg',
    intensity: 1.1,
    rotation: 0,
    description: 'Gym with blue floor and warm lighting - 16K (BlenderKit)',
  },
  {
    id: 'blenderkit_basketball_gym',
    name: 'Basketball Court',
    category: 'school',
    url: 'blenderkit://d0beed79-6e76-445a-913f-b7a68c12844c',
    thumbnail: 'https://www.blenderkit.com/thumbnails/assets/d0beed79-6e76-445a-913f-b7a68c12844c/files/thumbnail_f2bd4f96-2ca1-4233-b6d3-8800ed94cb7c.jpg',
    intensity: 1.0,
    rotation: 0,
    description: 'Basketball court with cold light dome - 16K (BlenderKit)',
  },
  {
    id: 'blenderkit_classroom_01',
    name: 'Classroom',
    category: 'school',
    url: 'blenderkit://685c5a94-3fd8-4f5a-adce-a482073f6006',
    thumbnail: 'https://www.blenderkit.com/thumbnails/assets/685c5a94-3fd8-4f5a-adce-a482073f6006/files/thumbnail_classroom.jpg',
    intensity: 1.0,
    rotation: 0,
    description: 'Standard classroom interior (BlenderKit)',
  },
  {
    id: 'blenderkit_green_step_school',
    name: 'School Exterior',
    category: 'school',
    url: 'blenderkit://4375c374-849c-48d3-9fbe-9cbcfa117c33',
    thumbnail: 'https://www.blenderkit.com/thumbnails/assets/4375c374-849c-48d3-9fbe-9cbcfa117c33/files/thumbnail_green_step.jpg',
    intensity: 1.0,
    rotation: 0,
    description: 'Beautiful school environment - 4K (BlenderKit)',
  },
];

export const HDRIEnvironmentLoader: React.FC = () => {
  const { addToast } = useVirtualStudio();
  const [scene, setScene] = useState<THREE.Scene | null>(null);

  // Connect to the Three.js scene from the viewport
  useEffect(() => {
    const checkScene = () => {
      const threeScene = getThreeScene();
      if (threeScene) {
        setScene(threeScene);
        return true;
      }
      return false;
    };

    // Check immediately
    if (!checkScene()) {
      // If not available, poll for it (scene may not be ready yet)
      const interval = setInterval(() => {
        if (checkScene()) {
          clearInterval(interval);
        }
      }, 500);

      return () => clearInterval(interval);
    }
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedHDRI, setSelectedHDRI] = useState<HDRIPreset | null>(null);

  // Listen for class photo HDRI requests
  useEffect(() => {
    const handleClassPhotoHDRI = (event: CustomEvent) => {
      const { hdriId } = event.detail;
      const preset = HDRI_PRESETS.find(p => p.id === hdriId);
      if (preset && scene) {
        // Auto-switch to school category for visibility
        setSelectedCategory('school');
        // Load the HDRI
        loadHDRIById(hdriId);
      }
    };

    window.addEventListener('vs-class-photo-hdri', handleClassPhotoHDRI as EventListener);
    return () => {
      window.removeEventListener('vs-class-photo-hdri', handleClassPhotoHDRI as EventListener);
    };
  }, [scene]);

  // Helper function to load HDRI by ID
  const loadHDRIById = (hdriId: string) => {
    const preset = HDRI_PRESETS.find(p => p.id === hdriId);
    if (preset) {
      loadHDRI(preset);
    }
  };
  const [intensity, setIntensity] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [showBackground, setShowBackground] = useState(true);
  const [enableSun, setEnableSun] = useState(false);
  const [sunIntensity, setSunIntensity] = useState(1.5);
  const [sunElevation, setSunElevation] = useState(45);
  const [sunAzimuth, setSunAzimuth] = useState(135);
  const [loading, setLoading] = useState(false);
  
  // Cache state
  const [cachedIds, setCachedIds] = useState<string[]>([]);
  const [cacheStats, setCacheStats] = useState<{ totalSize: number; itemCount: number; hitRate: number } | null>(null);
  const [showCacheInfo, setShowCacheInfo] = useState(false);
  
  // Pre-cache state
  const [preCacheProgress, setPreCacheProgress] = useState<PreCacheProgress | null>(null);
  const [preCacheNeeds, setPreCacheNeeds] = useState<{ essential: number; recommended: number; optional: number } | null>(null);

  // Initialize cache and load stats
  useEffect(() => {
    const initCache = async () => {
      await hdriCacheService.init();
      const ids = await hdriCacheService.getCachedIds();
      setCachedIds(ids);
      const stats = await hdriCacheService.getStats();
      setCacheStats({
        totalSize: stats.totalSize,
        itemCount: stats.itemCount,
        hitRate: hdriCacheService.getHitRate(),
      });
      
      // Check pre-cache needs
      const needs = await preCacheManager.needsPreCache();
      setPreCacheNeeds(needs);
    };
    initCache();
    
    // Subscribe to pre-cache progress
    const unsubscribe = preCacheManager.onProgress((progress) => {
      setPreCacheProgress(progress);
      if (!progress.isRunning && progress.completed > 0) {
        // Refresh cache stats after pre-caching
        updateCacheStats();
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Listen for external HDRI load requests (e.g., from character recommendation)
  useEffect(() => {
    const handleLoadHDRI = (event: CustomEvent<{ id: string; url: string; intensity: number; name: string }>) => {
      const { id, url, intensity, name } = event.detail;
      log.info('Received vs-load-hdri event: ', name);
      
      // Find the preset or create a temporary one
      const preset = HDRI_PRESETS.find(p => p.id === id) || {
        id,
        name,
        category: 'studio' as const,
        url,
        thumbnail: ', ',
        intensity,
        rotation: 0,
        description: `Recommended, environment: ${name}`,
      };
      
      loadHDRI(preset);
    };

    window.addEventListener('vs-load-hdri', handleLoadHDRI as EventListener);
    return () => {
      window.removeEventListener('vs-load-hdri', handleLoadHDRI as EventListener);
    };
  }, [scene]); // Re-subscribe when scene changes

  // Update cache stats periodically
  const updateCacheStats = async () => {
    const ids = await hdriCacheService.getCachedIds();
    setCachedIds(ids);
    const stats = await hdriCacheService.getStats();
    setCacheStats({
      totalSize: stats.totalSize,
      itemCount: stats.itemCount,
      hitRate: hdriCacheService.getHitRate(),
    });
    // Also update pre-cache needs
    const needs = await preCacheManager.needsPreCache();
    setPreCacheNeeds(needs);
  };

  // Clear cache handler
  const handleClearCache = async () => {
    await hdriCacheService.clear();
    await updateCacheStats();
    addToast({
      message: 'HDRI cache cleared',
      type: 'info',
      duration: 2000,
    });
  };
  
  // Pre-cache handlers
  const handleStartPreCache = (priority: 'essential' | 'recommended' | 'all') => {
    preCacheManager.startPreCache(priority);
    addToast({
      message: `Pre-caching ${priority} HDRIs in background...`,
      type: 'info',
      duration: 3000,
    });
  };
  
  const handlePausePreCache = () => {
    preCacheManager.pause();
  };
  
  const handleResumePreCache = () => {
    preCacheManager.resume();
  };
  
  const handleStopPreCache = () => {
    preCacheManager.stop();
    addToast({
      message: 'Pre-caching stopped',
      type: 'info',
      duration: 2000,
    });
  };

  const categories = [
    { value: 'all', label: 'All', icon: <Landscape /> },
    { value: 'studio', label: 'Studio', icon: <Brightness7 /> },
    { value: 'outdoor', label: 'Outdoor', icon: <WbSunny /> },
    { value: 'indoor', label: 'Indoor', icon: <Brightness4 /> },
    { value: 'sunset', label: 'Sunset', icon: <WbSunny /> },
    { value: 'night', label: 'Night', icon: <NightsStay /> },
    { value: 'overcast', label: 'Overcast', icon: <CloudQueue /> },
    { value: 'school', label: 'School', icon: <School /> },
  ];

  const filteredHDRIs =
    selectedCategory === 'all'
      ? HDRI_PRESETS
      : HDRI_PRESETS.filter((hdri) => hdri.category === selectedCategory);

  // Load HDRI environment with caching
  const loadHDRI = async (preset: HDRIPreset) => {
    if (!scene) return;

    setLoading(true);
    setSelectedHDRI(preset);
    setIntensity(preset.intensity);
    setRotation(preset.rotation);

    try {
      let hdriUrl = preset.url;
      let hdriSource: 'polyhaven' | 'blenderkit' | 'custom' = 'polyhaven';
      let fromCache = false;
      
      // Handle BlenderKit URLs
      if (preset.url.startsWith('blenderkit://')) {
        hdriSource = 'blenderkit';
        const assetId = preset.url.replace('blenderkit://', ', ');
        
        // Fetch download URL from BlenderKit API
        try {
          const response = await fetch(`https://www.blenderkit.com/api/v1/assets/${assetId}/download/`, {
            method: 'GET',
            headers: {
              'Authorization':'Bearer 814e329085f612e96211d2156f993ef6a86f3cf6','Content-Type' : 'application/json',
            },
          });
          
          if (!response.ok) {
            throw new Error(`BlenderKit API error: ${response.status}`);
          }
          
          const data = await response.json();
          hdriUrl = data.url || data.download_url;
          
          if (!hdriUrl) {
            throw new Error('No download URL in BlenderKit response');
          }
        } catch (blenderKitError) {
          log.error('BlenderKit API error:', blenderKitError);
          addToast({
            message: `BlenderKit HDRI requires valid API key. Using fallback.`,
            type: 'warning',
            duration: 4000,
          });
          // Fallback to a similar Poly Haven HDRI
          hdriUrl = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/empty_warehouse_01_1k.hdr';
          hdriSource = 'polyhaven';
        }
      }
      
      const loader = new RGBELoader();
      let texture: THREE.DataTexture;
      
      // Check cache first
      const cachedData = await hdriCacheService.get(preset.id);
      
      if (cachedData) {
        // Load from cache
        fromCache = true;
        const blob = new Blob([cachedData], { type: 'application/octet-stream' });
        const cacheUrl = URL.createObjectURL(blob);
        
        try {
          texture = await loader.loadAsync(cacheUrl);
        } finally {
          URL.revokeObjectURL(cacheUrl);
        }
      } else {
        // Fetch from network
        const response = await fetch(hdriUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch HDRI: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Cache the downloaded HDRI
        await hdriCacheService.set(preset.id, hdriUrl, arrayBuffer, hdriSource);
        await updateCacheStats();
        
        // Load from the fetched data
        const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        
        try {
          texture = await loader.loadAsync(blobUrl);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      }

      texture.mapping = THREE.EquirectangularReflectionMapping;

      if (showBackground) {
        scene.background = texture;
      }
      scene.environment = texture;

      // Apply intensity
      if (scene.environment) {
        scene.environment.intensity = intensity;
      }

      // Add sun light if enabled and preset has sun position
      if (enableSun && preset.sunPosition) {
        addSunLight(preset.sunPosition, preset.sunIntensity || 1.5);
      }

      addToast({
        message: `HDRI, loaded: ${preset.name}${fromCache ? ' (cached)' : ','}`,
        type: 'success',
        duration: 2500,
      });
    } catch (error) {
      log.error('Failed to load HDRI:', error);
      addToast({
        message: `Failed to load HDRI: ${preset.name}`,
        type: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Add directional sun light - syncs with store for undo/redo support
  const addSunLight = (position: { x: number; y: number; z: number }, intensity: number) => {
    if (!scene) return;

    // Remove existing sun light from Three.js scene
    const existingSun = scene.getObjectByName('sun_light');
    if (existingSun) {
      scene.remove(existingSun);
    }

    // Create sun light
    const sunLight = new THREE.DirectionalLight(0xffffff, intensity);
    sunLight.name = 'sun_light';
    sunLight.position.set(position.x, position.y, position.z);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;

    scene.add(sunLight);

    // Sync to store for state management (undo/redo, serialization)
    // Dispatch custom event so VirtualStudio can update its state
    window.dispatchEvent(
      new CustomEvent('vs-sun-light-update', {
        detail: {
          position: [position.x, position.y, position.z],
          intensity,
          enabled: enableSun,
        },
      })
    );
  };

  // Update sun position based on elevation and azimuth
  const updateSunPosition = () => {
    if (!scene || !enableSun) return;

    const elevationRad = (sunElevation * Math.PI) / 180;
    const azimuthRad = (sunAzimuth * Math.PI) / 180;

    const x = 10 * Math.cos(elevationRad) * Math.cos(azimuthRad);
    const y = 10 * Math.sin(elevationRad);
    const z = 10 * Math.cos(elevationRad) * Math.sin(azimuthRad);

    addSunLight({ x, y, z }, sunIntensity);
  };

  useEffect(() => {
    if (enableSun && selectedHDRI) {
      updateSunPosition();
    }
  }, [enableSun, sunElevation, sunAzimuth, sunIntensity]);

  return (
    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#1a1a1a', color: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Landscape color="primary" />
        <Typography variant="h6">HDRI Environment</Typography>
        <Chip
          label={`${HDRI_PRESETS.length}+ HDRIs`}
          size="small"
          color="primary"
          sx={{ ml: 'auto' }}
        />
        <Tooltip title={showCacheInfo ? 'Hide cache info' : 'Show cache info'}>
          <IconButton 
            size="small" 
            onClick={() => setShowCacheInfo(!showCacheInfo)}
            sx={{ color: cacheStats && cacheStats.itemCount > 0 ? '#4caf50' : '#666' }}
          >
            <Storage fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Cache Info Panel */}
      {showCacheInfo && cacheStats && (
        <Box sx={{ 
          mb: 2, 
          p: 1.5, 
          backgroundColor: '#2a2a2a', 
          borderRadius: 1,
          border: '1px solid #333'}}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Cached fontSize="small" color="info" />
            <Typography variant="subtitle2">HDRI Cache</Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Items</Typography>
              <Typography variant="body2">{cacheStats.itemCount}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Size</Typography>
              <Typography variant="body2">{hdriCacheService.formatSize(cacheStats.totalSize)}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Hit Rate</Typography>
              <Typography variant="body2">{cacheStats.hitRate.toFixed(0)}%</Typography>
            </Grid>
          </Grid>
          
          {/* Pre-Cache Section */}
          <Divider sx={{ my: 1.5, borderColor: '#444' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CloudDownload fontSize="small" color="primary" />
            <Typography variant="subtitle2">Pre-Cache HDRIs</Typography>
          </Box>
          
          {/* Pre-cache progress */}
          {preCacheProgress?.isRunning && (
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="caption" sx={{ flex: 1 }}>
                  {preCacheProgress.currentItem || 'Preparing...'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {preCacheProgress.completed}/{preCacheProgress.total}
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(preCacheProgress.completed / preCacheProgress.total) * 100}
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                {preCacheProgress.isPaused ? (
                  <IconButton size="small" onClick={handleResumePreCache} color="primary">
                    <PlayArrow fontSize="small" />
                  </IconButton>
                ) : (
                  <IconButton size="small" onClick={handlePausePreCache}>
                    <Pause fontSize="small" />
                  </IconButton>
                )}
                <IconButton size="small" onClick={handleStopPreCache} color="error">
                  <Stop fontSize="small" />
                </IconButton>
                <Typography variant="caption" sx={{ ml: 'auto', color: '#888', alignSelf: 'center' }}>
                  {preCacheProgress.isPaused ? 'Paused' : 'Downloading...'}
                </Typography>
              </Box>
            </Box>
          )}
          
          {/* Pre-cache buttons */}
          {!preCacheProgress?.isRunning && preCacheNeeds && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Tooltip title={`${preCacheNeeds.essential} essential HDRIs for quick start`}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={<Star />}
                    onClick={() => handleStartPreCache('essential')}
                    disabled={preCacheNeeds.essential === 0}
                  >
                    Essential ({preCacheNeeds.essential})
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={`Essential + ${preCacheNeeds.recommended} recommended HDRIs`}>
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<StarHalf />}
                    onClick={() => handleStartPreCache('recommended')}
                    disabled={preCacheNeeds.essential + preCacheNeeds.recommended === 0}
                  >
                    + Recommended
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={`All ${PRE_CACHE_HDRIS.length} pre-cache HDRIs`}>
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<StarBorder />}
                    onClick={() => handleStartPreCache('all')}
                    disabled={preCacheNeeds.essential + preCacheNeeds.recommended + preCacheNeeds.optional === 0}
                  >
                    All
                  </Button>
                </span>
              </Tooltip>
            </Box>
          )}
          
          {!preCacheProgress?.isRunning && preCacheNeeds && 
           preCacheNeeds.essential === 0 && 
           preCacheNeeds.recommended === 0 && 
           preCacheNeeds.optional === 0 && (
            <Typography variant="caption" sx={{ color: '#4caf50', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircle fontSize="small" /> All recommended HDRIs cached
            </Typography>
          )}
          
          <Divider sx={{ my: 1.5, borderColor: '#444' }} />
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteSweep />}
              onClick={handleClearCache}
              disabled={cacheStats.itemCount === 0}
            >
              Clear Cache
            </Button>
            <Typography variant="caption" sx={{ ml: 'auto', color: '#888', alignSelf: 'center' }}>
              Max: 500MB / 100 items
            </Typography>
          </Box>
        </Box>
      )}

      {/* Category Filter */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Category
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? 'contained' : 'outlined'}
              size="small"
              startIcon={cat.icon}
              onClick={() => setSelectedCategory(cat.value)}
            >
              {cat.label}
            </Button>
          ))}
        </Box>
      </Box>

      <Divider sx={{ my: 2, borderColor: '#333' }} />

      {/* HDRI Grid */}
      <Box sx={{ maxHeight: 400, overflowY: 'auto', mb: 2 }}>
        <Grid container spacing={2}>
          {filteredHDRIs.map((hdri) => {
            const isBlenderKit = hdri.url.startsWith('blenderkit://');
            const isCached = cachedIds.includes(hdri.id);
            return (
              <Grid item xs={6} sm={4} md={3} key={hdri.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    border: selectedHDRI?.id === hdri.id ? '2px solid #2196f3' : '1px solid #333',
                    backgroundColor: '#222',
                    position: 'relative', '&:hover': { borderColor: '#2196f3' }}}
                  onClick={() => loadHDRI(hdri)}
                >
                  {/* Cached indicator */}
                  {isCached && (
                    <Tooltip title="Cached - loads instantly">
                      <CheckCircle
                        sx={{
                          position: 'absolute',
                          top: 4,
                          left: 4,
                          zIndex: 1,
                          fontSize: 16,
                          color: '#4caf50',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          borderRadius: '50%'}}
                      />
                    </Tooltip>
                  )}
                  {isBlenderKit && (
                    <Chip
                      label="BK"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        zIndex: 1,
                        backgroundColor: '#ff6b35',
                        color: '#fff',
                        fontSize: '0.6rem',
                        height: 18'& .MuiChip-label': { px: 0.5 }}}
                    />
                  )}
                  <CardMedia 
                    component="img" 
                    height="100" 
                    image={hdri.thumbnail} 
                    alt={hdri.name}
                    sx={{
                      opacity: loading && selectedHDRI?.id === hdri.id ? 0.5 : 1}}
                  />
                  <CardContent sx={{ p: 1 }}>
                    <Typography variant="caption" noWrap>
                      {hdri.name}
                    </Typography>
                    {hdri.description && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          display: 'block', 
                          color: '#888', 
                          fontSize: '0.65rem',
                          mt: 0.5}} 
                        noWrap
                      >
                        {hdri.description}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Controls */}
      {selectedHDRI && (
        <>
          <Divider sx={{ my: 2, borderColor: '#333' }} />

          <Typography variant="subtitle2" gutterBottom>
            Environment Settings
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption">Intensity</Typography>
            <Slider
              value={intensity}
              onChange={(_, v) => setIntensity(v as number)}
              min={0}
              max={3}
              step={0.1}
              valueLabelDisplay="auto"
              sx={{ color: '#2196f3' }}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption">Rotation (degrees)</Typography>
            <Slider
              value={rotation}
              onChange={(_, v) => setRotation(v as number)}
              min={0}
              max={360}
              step={1}
              valueLabelDisplay="auto"
              sx={{ color: '#2196f3' }}
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={showBackground}
                onChange={(e) => setShowBackground(e.target.checked)}
              />
            }
            label="Show as Background"
          />

          <Divider sx={{ my: 2, borderColor: '#333' }} />

          <Typography variant="subtitle2" gutterBottom>
            Sun Simulation
          </Typography>

          <FormControlLabel
            control={
              <Switch checked={enableSun} onChange={(e) => setEnableSun(e.target.checked)} />
            }
            label="Enable Sun Light"
          />

          {enableSun && (
            <>
              <Box sx={{ mb: 2, mt: 2 }}>
                <Typography variant="caption">Sun Intensity</Typography>
                <Slider
                  value={sunIntensity}
                  onChange={(_, v) => setSunIntensity(v as number)}
                  min={0}
                  max={5}
                  step={0.1}
                  valueLabelDisplay="auto"
                  sx={{ color: '#ff9800' }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption">
                  Sun Elevation (0° = horizon, 90° = overhead)
                </Typography>
                <Slider
                  value={sunElevation}
                  onChange={(_, v) => setSunElevation(v as number)}
                  min={0}
                  max={90}
                  step={1}
                  valueLabelDisplay="auto"
                  sx={{ color: '#ff9800' }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption">Sun Azimuth (0° = North, 90° = East)</Typography>
                <Slider
                  value={sunAzimuth}
                  onChange={(_, v) => setSunAzimuth(v as number)}
                  min={0}
                  max={360}
                  step={1}
                  valueLabelDisplay="auto"
                  sx={{ color: '#ff9800' }}
                />
              </Box>
            </>
          )}

          <Box sx={{ mt: 2, p: 1.5, backgroundColor: '#222', borderRadius: 1 }}>
            <Typography variant="caption">
              <strong>{selectedHDRI.name}</strong>
              <br />
              {selectedHDRI.description}
            </Typography>
          </Box>
        </>
      )}

      {loading && (
        <Box sx={{ mt: 2, textAlign:'center' }}>
          <Typography variant="caption" color="text.secondary">
            Loading HDRI...
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
