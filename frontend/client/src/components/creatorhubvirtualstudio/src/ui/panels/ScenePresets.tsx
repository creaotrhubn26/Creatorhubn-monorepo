/**
 * ScenePresets - Pre-built studio scene configurations
 * 
 * Features:
 * - Portrait, Product, Video Interview, Film Noir, etc.
 * - One-click scene loading
 * - Preview thumbnails
 * - Equipment list per scene
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  IconButton,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  PhotoCamera,
  Videocam,
  Movie,
  Portrait,
  ShoppingBag,
  Business,
  Mic,
  Celebration,
  Lightbulb,
  CameraAlt,
  Weekend,
  Build,
  Close,
  PlayArrow,
  Info,
  CompareArrows,
  MoreVert,
  Preview,
  Download,
} from '@mui/icons-material';
import { useTabletSupport } from '../../providers/TabletSupportProvider';
import { TouchIconButton, TouchContextMenu } from '../components/TabletAwarePanels';
import { useAccessibility, VisuallyHidden } from '../../providers/AccessibilityProvider';

// ============================================================================
// Scene Preset Types
// ============================================================================

export interface SceneEquipmentItem {
  modelFunction: string;
  options: Record<string, any>;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  name: string;
}

export interface ScenePreset {
  id: string;
  name: string;
  category: 'portrait' | 'product' | 'video' | 'film' | 'events' | 'corporate';
  description: string;
  thumbnail: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: SceneEquipmentItem[];
  lightingStyle: string;
  recommendedCamera?: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  };
  tips: string[];
  tags: string[];
}

const CATEGORY_INFO: Record<ScenePreset['category'], { label: string; icon: React.ReactNode; color: string }> = {
  portrait: { label: 'Portrait', icon: <Portrait />, color: '#e91e63' },
  product: { label: 'Product', icon: <ShoppingBag />, color: '#ff9800' },
  video: { label: 'Video/Interview', icon: <Videocam />, color: '#2196f3' },
  film: { label: 'Film/Cinematic', icon: <Movie />, color: '#9c27b0' },
  events: { label: 'Events', icon: <Celebration />, color: '#4caf50' },
  corporate: { label: 'Corporate', icon: <Business />, color: '#607d8b' },
};

// Generate preview thumbnails
const generatePreviewSVG = (type: string): string => {
  const templates: Record<string, string> = {
    portrait_1: `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#1a1a1a"/>
      <rect x="70" y="20" width="60" height="110" rx="3" fill="#333"/>
      <circle cx="100" cy="55" r="20" fill="#555"/>
      <rect x="80" y="80" width="40" height="40" rx="2" fill="#555"/>
      <rect x="20" y="40" width="30" height="40" fill="#ffb300" opacity="0.8"/>
      <rect x="150" y="50" width="25" height="30" fill="#7c4dff" opacity="0.6"/>
      <ellipse cx="100" cy="140" rx="50" ry="8" fill="#222"/>
    </svg>`,
    portrait_2: `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#1a1a1a"/>
      <rect x="75" y="30" width="50" height="90" rx="3" fill="#333"/>
      <circle cx="100" cy="60" r="15" fill="#555"/>
      <ellipse cx="50" cy="80" rx="30" ry="40" fill="#ffb300" opacity="0.6"/>
      <rect x="160" y="60" width="20" height="50" fill="#1a1a1a" stroke="#ffb300"/>
      <circle cx="100" cy="20" r="15" fill="#f5f5f5" opacity="0.8"/>
    </svg>`,
    product_1: `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#f5f5f5"/>
      <rect x="60" y="90" width="80" height="5" fill="#ddd"/>
      <rect x="80" y="60" width="40" height="35" rx="2" fill="#333"/>
      <rect x="30" y="30" width="25" height="60" fill="#1a1a1a"/>
      <rect x="145" y="30" width="25" height="60" fill="#1a1a1a"/>
      <ellipse cx="100" cy="20" rx="40" ry="8" fill="#1a1a1a"/>
    </svg>`,
    product_2: `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#1a1a1a"/>
      <circle cx="100" cy="75" r="50" fill="#222"/>
      <rect x="85" y="55" width="30" height="45" rx="3" fill="#555"/>
      <rect x="20" y="50" width="15" height="50" fill="#ffb300"/>
      <rect x="165" y="50" width="15" height="50" fill="#00bcd4"/>
      <rect x="60" y="10" width="80" height="20" fill="#7c4dff" opacity="0.5"/>
    </svg>`,
    interview: `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#1a1a1a"/>
      <rect x="30" y="50" width="40" height="70" rx="3" fill="#333"/>
      <circle cx="50" cy="70" r="12" fill="#555"/>
      <rect x="130" y="50" width="40" height="70" rx="3" fill="#333"/>
      <circle cx="150" cy="70" r="12" fill="#555"/>
      <rect x="85" y="30" width="30" height="20" fill="#2196f3"/>
      <rect x="10" y="60" width="15" height="40" fill="#ffb300" opacity="0.7"/>
      <rect x="175" y="60" width="15" height="40" fill="#ffb300" opacity="0.7"/>
    </svg>`,
    film_noir: `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#0a0a0a"/>
      <rect x="70" y="30" width="60" height="100" rx="3" fill="#1a1a1a"/>
      <circle cx="100" cy="65" r="18" fill="#222"/>
      <polygon points="20,150 50,50 80,150" fill="#333" opacity="0.5"/>
      <rect x="160" y="40" width="30" height="80" fill="#ffb300" opacity="0.3"/>
      <line x1="0" y1="80" x2="70" y2="80" stroke="#ffb300" stroke-width="2" opacity="0.4"/>
    </svg>`,
    corporate: `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#1e3a5f"/>
      <rect x="60" y="40" width="80" height="80" rx="3" fill="#2a4a6f"/>
      <rect x="70" y="50" width="60" height="40" rx="2" fill="#3a5a7f"/>
      <circle cx="100" cy="65" r="15" fill="#4a6a8f"/>
      <rect x="20" y="50" width="25" height="60" fill="#ffb300" opacity="0.6"/>
      <rect x="155" y="50" width="25" height="60" fill="#ffb300" opacity="0.6"/>
    </svg>`,
    youtube: `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#1a1a1a"/>
      <rect x="50" y="20" width="100" height="100" rx="5" fill="#222"/>
      <rect x="60" y="35" width="80" height="50" fill="#333"/>
      <circle cx="100" cy="100" r="12" fill="#ff0000"/>
      <polygon points="96,96 108,100 96,104" fill="#fff"/>
      <circle cx="30" cy="75" r="15" fill="#ffb300" opacity="0.8"/>
      <circle cx="170" cy="75" r="15" fill="#00bcd4" opacity="0.8"/>
    </svg>`,
  };
  return `data:image/svg+xml,${encodeURIComponent(templates[type] || templates.portrait_1)}`;
};

// ============================================================================
// Scene Presets Data
// ============================================================================

const SCENE_PRESETS: ScenePreset[] = [
  // ===== PORTRAIT =====
  {
    id: 'classic_portrait',
    name: 'Classic Portrait Studio',
    category: 'portrait',
    description: 'Traditional three-point lighting setup for professional headshots and portraits',
    thumbnail: generatePreviewSVG('portrait_1, '),
    difficulty: 'beginner',
    lightingStyle: 'Rembrandt / Loop',
    equipment: [
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 500 }, position: [-2, 2, 1], rotation: [0, 0.5, 0], name: 'Key Light' },
      { modelFunction: 'createSoftboxModel', options: { width: 0.9, height: 1.2, withGrid: true }, position: [-2, 2, 1], rotation: [0, 0.5, 0], name: 'Key Softbox' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 250 }, position: [2, 1.8, 1], rotation: [0, -0.5, 0], name: 'Fill Light' },
      { modelFunction: 'createUmbrellaModel', options: { diameter: 1.2, type: 'reflective_white' }, position: [2, 1.8, 1], name: 'Fill Umbrella' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 300 }, position: [0, 2.5, -2], name: 'Hair Light' },
      { modelFunction: 'createSnootModel', options: { withGrid: true }, position: [0, 2.5, -2], name: 'Hair Light Snoot' },
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'gray', width: 2.7 }, position: [0, 0, -3], name: 'Backdrop' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.6, style: 'round' }, position: [0, 0, 0], name: 'Posing Stool' },
      { modelFunction: 'createCStandModel', options: { height: 2.5, withArm: true }, position: [-2.2, 0, 1], name: 'C-Stand (Key)' },
      { modelFunction: 'createLightStandModel', options: { maxHeight: 2.2 }, position: [2.2, 0, 1], name: 'Light Stand (Fill)' },
    ],
    recommendedCamera: { position: [0, 1.5, 4], target: [0, 1.2, 0], fov: 50 },
    tips: [
      'Position key light at 45° angle to subject','Fill light should be 1-2 stops lower than key','Hair light adds separation from background','Use a reflector for subtle fill instead of second light',
    ],
    tags: ['headshot','portrait','rembrandt','three-point'],
  },
  {
    id: 'beauty_portrait',
    name: 'Beauty/Fashion Portrait',
    category: 'portrait',
    description: 'High-key beauty setup with clamshell lighting and beauty dish',
    thumbnail: generatePreviewSVG('portrait_2,'),
    difficulty: 'intermediate',
    lightingStyle: 'Butterfly / Clamshell',
    equipment: [
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 600 }, position: [0, 2.5, 1], name: 'Main Light' },
      { modelFunction: 'createBeautyDishModel', options: { diameter: 0.55, color: 'white', withSock: true }, position: [0, 2.5, 1], name: 'Beauty Dish' },
      { modelFunction: 'createVFlatModel', options: { height: 2.4, color: 'white' }, position: [0, 0, 0.5], rotation: [0.5, 0, 0], name: 'Reflector (Below)' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 400 }, position: [-1.5, 2, -1], name: 'Rim Light L' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 400 }, position: [1.5, 2, -1], name: 'Rim Light R' },
      { modelFunction: 'createSnootModel', options: { withGrid: true }, position: [-1.5, 2, -1], name: 'Rim Snoot L' },
      { modelFunction: 'createSnootModel', options: { withGrid: true }, position: [1.5, 2, -1], name: 'Rim Snoot R' },
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'white', width: 2.7 }, position: [0, 0, -3], name: 'White Backdrop' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.5, style: 'saddle' }, position: [0, 0, 0], name: 'Posing Stool' },
    ],
    recommendedCamera: { position: [0, 1.4, 3], target: [0, 1.3, 0], fov: 85 },
    tips: [
      'Beauty dish creates signature butterfly shadow under nose','Reflector below fills shadows under chin and eyes','Rim lights add hair separation and glamour','Use 85mm or longer lens to avoid distortion',
    ],
    tags: ['beauty','fashion','glamour','butterfly','clamshell'],
  },
  
  // ===== PRODUCT =====
  {
    id: 'product_white',
    name: 'Product on White',
    category: 'product',
    description: 'Clean e-commerce product photography with seamless white background',
    thumbnail: generatePreviewSVG('product_1,'),
    difficulty: 'beginner',
    lightingStyle: 'High Key',
    equipment: [
      { modelFunction: 'createProductTableModel', options: { withTurntable: true, style: 'shooting' }, position: [0, 0, 0], name: 'Product Table' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', withBarnDoors: true }, position: [-1.5, 1.5, 0], rotation: [0, 0.8, 0], name: 'Key Panel L' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', withBarnDoors: true }, position: [1.5, 1.5, 0], rotation: [0, -0.8, 0], name: 'Key Panel R' },
      { modelFunction: 'createLEDPanelModel', options: { style: '2x1' }, position: [0, 2.5, -1], rotation: [0.5, 0, 0], name: 'Top Light' },
      { modelFunction: 'createDiffusionFrameModel', options: { width: 1.2, height: 1.2 }, position: [-1, 1.5, 0.5], rotation: [0, 0.5, 0], name: 'Diffusion L' },
      { modelFunction: 'createDiffusionFrameModel', options: { width: 1.2, height: 1.2 }, position: [1, 1.5, 0.5], rotation: [0, -0.5, 0], name: 'Diffusion R' },
      { modelFunction: 'createVFlatModel', options: { height: 2, color: 'white' }, position: [0, 0, -2], name: 'Background V-Flat' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 2], name: 'Camera Tripod' },
    ],
    recommendedCamera: { position: [0, 1, 2], target: [0, 0.5, 0], fov: 35 },
    tips: [
      'Light the background separately to ensure pure white','Use diffusion panels to eliminate harsh reflections','Shoot tethered to check exposure on monitor','Use macro lens for small products',
    ],
    tags: ['product','e-commerce','white background','packshot'],
  },
  {
    id: 'product_dark',
    name: 'Dramatic Product',
    category: 'product',
    description: 'Moody product photography with dark background and accent lighting',
    thumbnail: generatePreviewSVG('product_2, '),
    difficulty: 'intermediate',
    lightingStyle: 'Low Key',
    equipment: [
      { modelFunction: 'createProductTableModel', options: { style: 'gradient', surfaceColor: 'black' }, position: [0, 0, 0], name: 'Product Table' },
      { modelFunction: 'createMonolightModel', options: { brand: 'godox', power: 300 }, position: [-1, 1.5, 0.5], name: 'Key Light' },
      { modelFunction: 'createSoftboxModel', options: { width: 0.4, height: 0.6, shape: 'strip' }, position: [-1, 1.5, 0.5], name: 'Strip Box' },
      { modelFunction: 'createTubeLightModel', options: { length: 0.6, rgbw: true }, position: [1.2, 0.8, -0.5], rotation: [0, 0, 1.57], name: 'Accent Tube' },
      { modelFunction: 'createScrimFlagModel', options: { type: 'solid', width: 0.6, height: 0.6 }, position: [0.8, 0.5, 0.3], name: 'Flag (Spill)' },
      { modelFunction: 'createTexturedBackdropModel', options: { texture: 'concrete', width: 2 }, position: [0, 0, -1.5], name: 'Textured Backdrop' },
      { modelFunction: 'createTripodModel', options: { style: 'photo' }, position: [0, 0, 1.5], name: 'Tripod' },
    ],
    recommendedCamera: { position: [0, 0.8, 1.5], target: [0, 0.4, 0], fov: 50 },
    tips: [
      'Use strip boxes for controlled, dramatic highlights','Colored accent lights add visual interest','Flags control spill and create negative fill','Focus stack for maximum sharpness',
    ],
    tags: ['product','dramatic','moody','low key'],
  },
  
  // ===== VIDEO/INTERVIEW =====
  {
    id: 'two_person_interview',
    name: 'Two-Person Interview',
    category: 'video',
    description: 'Professional interview setup with two subjects facing each other',
    thumbnail: generatePreviewSVG('interview'),
    difficulty: 'intermediate',
    lightingStyle: 'Cross Key',
    equipment: [
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withBarnDoors: true }, position: [-2, 2, 0], rotation: [0, 0.6, 0], name: 'Key A' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withBarnDoors: true }, position: [2, 2, 0], rotation: [0, -0.6, 0], name: 'Key B' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1' }, position: [0, 2.2, -2], name: 'Hair/Practical' },
      { modelFunction: 'createDirectorChairModel', options: { withArmrests: true }, position: [-1, 0, 0], rotation: [0, 0.4, 0], name: 'Chair A' },
      { modelFunction: 'createDirectorChairModel', options: { withArmrests: true }, position: [1, 0, 0], rotation: [0, -0.4, 0], name: 'Chair B' },
      { modelFunction: 'createBoomPoleModel', options: { length: 2.5, withMic: true }, position: [0, 2.5, 0.5], rotation: [0, 0, -0.3], name: 'Boom Mic' },
      { modelFunction: 'createMonitorModel', options: { size: 7, style: 'field' }, position: [0, 1.5, 3], name: 'Camera Monitor' },
      { modelFunction: 'createTripodModel', options: { style: 'video', withHead: true }, position: [0, 0, 3], name: 'Camera Tripod' },
      { modelFunction: 'createPlantModel', options: { type: 'fiddle_leaf' }, position: [-2, 0, -1.5], name: 'Set Dressing Plant' },
    ],
    recommendedCamera: { position: [0, 1.2, 3], target: [0, 1, 0], fov: 40 },
    tips: [
      'Each subject is key lit by the light on opposite side','Creates natural conversation lighting','Use practical lights in background for depth','Consider using two cameras for coverage',
    ],
    tags: ['interview','podcast','two-shot','conversation'],
  },
  {
    id: 'youtube_setup',
    name: 'YouTube Creator Setup',
    category: 'video',
    description: 'Modern content creator setup with ring light and desk',
    thumbnail: generatePreviewSVG('youtube'),
    difficulty: 'beginner',
    lightingStyle: 'Front-lit / Flat',
    equipment: [
      { modelFunction: 'createRingLightModel', options: { diameter: 0.45, style: 'led', withMount: true }, position: [0, 1.4, 1], name: 'Ring Light' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [-1.2, 1.5, 0.5], rotation: [0, 0.5, 0], name: 'Fill Panel L' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [1.2, 1.5, 0.5], rotation: [0, -0.5, 0], name: 'Fill Panel R' },
      { modelFunction: 'createDeskModel', options: { style: 'modern', withDrawers: false }, position: [0, 0, 0], name: 'Desk' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.5, style: 'round', adjustable: true }, position: [0, 0, 0.5], name: 'Chair' },
      { modelFunction: 'createMonitorModel', options: { size: 27, style: 'client' }, position: [0, 0.75, -0.3], name: 'Computer Monitor' },
      { modelFunction: 'createMicStandModel', options: { style: 'desk', withBoom: true }, position: [-0.4, 0.75, 0], name: 'Desk Mic' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.2, rgbw: true }, position: [-1.5, 0.5, -1], rotation: [0, 0, 1.57], name: 'RGB Accent L' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.2, rgbw: true }, position: [1.5, 0.5, -1], rotation: [0, 0, 1.57], name: 'RGB Accent R' },
      { modelFunction: 'createTripodModel', options: { style: 'video' }, position: [0, 0, 2], name: 'Camera Tripod' },
    ],
    recommendedCamera: { position: [0, 1.3, 2], target: [0, 1.1, 0], fov: 50 },
    tips: [
      'Ring light provides flattering, even illumination','RGB accent lights add personality to background','Position microphone just out of frame','Use acoustic panels to improve audio quality',
    ],
    tags: ['youtube','creator','streaming','vlog'],
  },
  
  // ===== FILM/CINEMATIC =====
  {
    id: 'film_noir',
    name: 'Film Noir',
    category: 'film',
    description: 'Classic film noir lighting with hard shadows and venetian blind patterns',
    thumbnail: generatePreviewSVG('film_noir'),
    difficulty: 'advanced',
    lightingStyle: 'Chiaroscuro / Hard',
    equipment: [
      { modelFunction: 'createFresnelModel', options: { size: 5, brand: 'arri', withBarnDoors: true }, position: [-2, 2.5, 1], rotation: [0, 0.6, -0.3], name: 'Key Fresnel' },
      { modelFunction: 'createGoboModel', options: { pattern: 'blinds' }, position: [-1.5, 2.2, 0.8], name: 'Blinds Gobo' },
      { modelFunction: 'createScrimFlagModel', options: { type: 'solid', width: 1, height: 1.5 }, position: [1, 1.5, 0], name: 'Negative Fill' },
      { modelFunction: 'createFresnelModel', options: { size: 3, brand: 'arri' }, position: [0, 2.8, -2], rotation: [0.5, 0, 0], name: 'Hair Light' },
      { modelFunction: 'createHazeMachineModel', options: { style: 'hazer', size: 'small' }, position: [2, 0, -2], name: 'Hazer' },
      { modelFunction: 'createPracticalLightModel', options: { type: 'desk_lamp', style: 'vintage', on: true }, position: [1, 0.8, -0.5], name: 'Practical Lamp' },
      { modelFunction: 'createDirectorChairModel', options: {}, position: [0, 0, 0], rotation: [0, -0.2, 0], name: 'Subject Chair' },
      { modelFunction: 'createTexturedBackdropModel', options: { texture: 'brick', width: 4 }, position: [0, 0, -3], name: 'Brick Wall' },
    ],
    recommendedCamera: { position: [1, 1, 3], target: [0, 1.2, 0], fov: 35 },
    tips: [
      'Use hard light source (Fresnel) for defined shadows','Gobos create signature venetian blind patterns','Negative fill deepens shadows for contrast','Haze makes light beams visible',
    ],
    tags: ['film noir','dramatic','hard light','cinematic'],
  },
  {
    id: 'corporate_interview',
    name: 'Corporate Interview',
    category: 'corporate',
    description: 'Professional corporate video interview setup',
    thumbnail: generatePreviewSVG('corporate'),
    difficulty: 'beginner',
    lightingStyle: 'Soft / Natural',
    equipment: [
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withBarnDoors: true, withDiffusion: true }, position: [-1.5, 2, 1], rotation: [0, 0.5, 0], name: 'Key Light' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1' }, position: [1.5, 1.8, 1], rotation: [0, -0.4, 0], name: 'Fill Light' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1' }, position: [0, 2, -2], name: 'Background Light' },
      { modelFunction: 'createDirectorChairModel', options: { withArmrests: true }, position: [0, 0, 0], name: 'Interview Chair' },
      { modelFunction: 'createLavalierModel', options: { withTransmitter: true }, position: [0, 1, 0], name: 'Lavalier Mic' },
      { modelFunction: 'createTeleprompterModel', options: { size: 'medium' }, position: [0, 1.2, 2.5], name: 'Teleprompter' },
      { modelFunction: 'createPlantModel', options: { type: 'fiddle_leaf' }, position: [-1.5, 0, -1], name: 'Background Plant' },
      { modelFunction: 'createTripodModel', options: { style: 'video', withHead: true }, position: [0, 0, 3], name: 'Camera Tripod' },
    ],
    recommendedCamera: { position: [0, 1.2, 3], target: [0, 1.1, 0], fov: 50 },
    tips: [
      'Soft, even lighting is professional and flattering','Background should be lit but not distracting','Use lavalier mic for clean audio','Teleprompter helps with scripted content',
    ],
    tags: ['corporate','interview','professional','business'],
  },
  
  // ===== NEW PRESETS =====
  {
    id: 'product_360',
    name: 'Product 360° Turntable',
    category: 'product',
    description: '360-degree product photography with motorized turntable',
    thumbnail: generatePreviewSVG('product_1'),
    difficulty: 'intermediate',
    lightingStyle: 'Even / Soft',
    equipment: [
      { modelFunction: 'createProductTableModel', options: { withTurntable: true, style: 'shooting' }, position: [0, 0, 0], name: 'Turntable' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withDiffusion: true }, position: [-1.5, 1.5, 0], rotation: [0, 0.6, 0], name: 'Key Panel L' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withDiffusion: true }, position: [1.5, 1.5, 0], rotation: [0, -0.6, 0], name: 'Key Panel R' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1' }, position: [0, 2.5, 0], rotation: [1.57, 0, 0], name: 'Top Light' },
      { modelFunction: 'createDiffusionFrameModel', options: { width: 1.5, height: 1.5 }, position: [0, 1.5, 1], name: 'Front Diffusion' },
      { modelFunction: 'createCycloramaModel', options: { width: 3, height: 2.5, color: 'white' }, position: [0, 0, -1.5], name: 'Cyc Background' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 2], name: 'Camera Tripod' },
      { modelFunction: 'createMonitorModel', options: { size: 7, style: 'field' }, position: [0.5, 1.2, 1.8], name: 'Tethered Monitor' },
    ],
    recommendedCamera: { position: [0, 1.2, 2], target: [0, 0.6, 0], fov: 35 },
    tips: [
      'Use consistent lighting from all angles','Set turntable to rotate in small increments (24-36 shots)','Use tethered shooting to verify each angle','Keep background perfectly white for easy masking',
    ],
    tags: ['product','360','turntable','e-commerce','spin'],
  },
  {
    id: 'fashion_runway',
    name: 'Fashion Runway',
    category: 'events',
    description: 'Full-length fashion photography setup with runway lighting',
    thumbnail: generatePreviewSVG('portrait_1'),
    difficulty: 'advanced',
    lightingStyle: 'High Key / Fashion',
    equipment: [
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'white', width: 4 }, position: [0, 0, -5], name: 'Backdrop' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 800 }, position: [-2, 3, 2], rotation: [0, 0.3, -0.2], name: 'Key Light L' },
      { modelFunction: 'createSoftboxModel', options: { width: 1.2, height: 1.8 }, position: [-2, 3, 2], name: 'Strip Box L' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 800 }, position: [2, 3, 2], rotation: [0, -0.3, -0.2], name: 'Key Light R' },
      { modelFunction: 'createSoftboxModel', options: { width: 1.2, height: 1.8 }, position: [2, 3, 2], name: 'Strip Box R' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 600 }, position: [0, 3.5, -3], name: 'Background Light' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 400 }, position: [-1.5, 2.5, -2], name: 'Hair Light L' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 400 }, position: [1.5, 2.5, -2], name: 'Hair Light R' },
      { modelFunction: 'createVFlatModel', options: { height: 2.4, color: 'white' }, position: [-2.5, 0, 0], name: 'Fill V-Flat L' },
      { modelFunction: 'createVFlatModel', options: { height: 2.4, color: 'white' }, position: [2.5, 0, 0], name: 'Fill V-Flat R' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 5], name: 'Camera Tripod' },
    ],
    recommendedCamera: { position: [0, 1.4, 5], target: [0, 1, 0], fov: 70 },
    tips: [
      'Vertical strip boxes for full-length coverage','V-flats provide wrap-around fill','Shoot at walking pace with fast shutter','Use continuous AF for moving subjects',
    ],
    tags: ['fashion','runway','full-length','model'],
  },
  {
    id: 'podcast_studio',
    name: 'Podcast Studio',
    category: 'video',
    description: 'Professional podcast setup with multiple microphones and cameras',
    thumbnail: generatePreviewSVG('interview'),
    difficulty: 'beginner',
    lightingStyle: 'Soft / Broadcast',
    equipment: [
      { modelFunction: 'createDeskModel', options: { style: 'modern', withDrawers: false }, position: [0, 0, 0], name: 'Podcast Desk' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.55, style: 'round' }, position: [-0.5, 0, 0.5], name: 'Host Chair' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.55, style: 'round' }, position: [0.5, 0, 0.5], name: 'Guest Chair' },
      { modelFunction: 'createMicStandModel', options: { style: 'desk', withBoom: true }, position: [-0.4, 0.75, 0.3], name: 'Host Mic' },
      { modelFunction: 'createMicStandModel', options: { style: 'desk', withBoom: true }, position: [0.4, 0.75, 0.3], name: 'Guest Mic' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withBarnDoors: true }, position: [-1.5, 2, 1], rotation: [0, 0.5, 0], name: 'Key Light L' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withBarnDoors: true }, position: [1.5, 2, 1], rotation: [0, -0.5, 0], name: 'Key Light R' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.0, rgbw: true }, position: [-1.2, 0.8, -1], rotation: [0, 0, 1.57], name: 'Accent Tube L' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.0, rgbw: true }, position: [1.2, 0.8, -1], rotation: [0, 0, 1.57], name: 'Accent Tube R' },
      { modelFunction: 'createHeadphonesModel', options: { style: 'over_ear' }, position: [-0.5, 0.9, 0.2], name: 'Host Headphones' },
      { modelFunction: 'createHeadphonesModel', options: { style: 'over_ear' }, position: [0.5, 0.9, 0.2], name: 'Guest Headphones' },
      { modelFunction: 'createTripodModel', options: { style: 'video', withHead: true }, position: [0, 0, 2.5], name: 'Main Camera' },
      { modelFunction: 'createTripodModel', options: { style: 'video', withHead: true }, position: [-1.5, 0, 1.5], rotation: [0, 0.5, 0], name: 'Host Cam' },
      { modelFunction: 'createTripodModel', options: { style: 'video', withHead: true }, position: [1.5, 0, 1.5], rotation: [0, -0.5, 0], name: 'Guest Cam' },
      { modelFunction: 'createAudioRecorderModel', options: { style: 'mixer', channels: 4 }, position: [0, 0.8, -0.2], name: 'Audio Mixer' },
    ],
    recommendedCamera: { position: [0, 1.2, 2.5], target: [0, 1, 0], fov: 45 },
    tips: [
      'Position mics 6-12 inches from mouths','Use headphones to monitor audio','Multi-camera setup allows for dynamic editing','Colored accent lights add visual interest',
    ],
    tags: ['podcast','audio','interview','multi-camera'],
  },
  {
    id: 'green_screen',
    name: 'Green Screen Studio',
    category: 'video',
    description: 'Chroma key setup for compositing and virtual backgrounds',
    thumbnail: generatePreviewSVG('corporate'),
    difficulty: 'intermediate',
    lightingStyle: 'Even / Flat (for key)',
    equipment: [
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'green', width: 4 }, position: [0, 0, -3], name: 'Green Screen' },
      { modelFunction: 'createLEDPanelModel', options: { style: '2x1', withBarnDoors: true }, position: [-2, 2, -2], rotation: [0, 0.3, 0], name: 'BG Light L' },
      { modelFunction: 'createLEDPanelModel', options: { style: '2x1', withBarnDoors: true }, position: [2, 2, -2], rotation: [0, -0.3, 0], name: 'BG Light R' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withDiffusion: true }, position: [-1.5, 2, 1], rotation: [0, 0.5, 0], name: 'Key Light' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', withDiffusion: true }, position: [1.5, 1.8, 1], rotation: [0, -0.4, 0], name: 'Fill Light' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1' }, position: [0, 2.5, -1], name: 'Hair Light' },
      { modelFunction: 'createScrimFlagModel', options: { type: 'solid', width: 1, height: 2 }, position: [1.2, 1, 0], name: 'Spill Control' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.55 }, position: [0, 0, 0], name: 'Subject Seat' },
      { modelFunction: 'createTripodModel', options: { style: 'video', withHead: true }, position: [0, 0, 3], name: 'Camera' },
      { modelFunction: 'createMonitorModel', options: { size: 17, style: 'director' }, position: [1.5, 1, 2.5], name: 'Preview Monitor' },
    ],
    recommendedCamera: { position: [0, 1.2, 3], target: [0, 1, 0], fov: 50 },
    tips: [
      'Light green screen evenly - no hot spots or shadows','Keep subject 6+ feet from background','Avoid green clothing or jewelry','Use a flag to block green spill on subject',
    ],
    tags: ['green screen','chroma key','compositing','vfx'],
  },
  {
    id: 'food_photography',
    name: 'Food Photography',
    category: 'product',
    description: 'Appetizing food photography setup with natural-looking window light',
    thumbnail: generatePreviewSVG('product_1'),
    difficulty: 'intermediate',
    lightingStyle: 'Natural / Side',
    equipment: [
      { modelFunction: 'createProductTableModel', options: { style: 'wood_surface' }, position: [0, 0, 0], name: 'Food Surface' },
      { modelFunction: 'createDiffusionFrameModel', options: { width: 1.5, height: 2 }, position: [-1.5, 1, 0], rotation: [0, 0.5, 0], name: 'Main Diffusion' },
      { modelFunction: 'createMonolightModel', options: { brand: 'godox', power: 400 }, position: [-2, 1.5, 0], name: 'Key Light' },
      { modelFunction: 'createVFlatModel', options: { height: 1.5, color: 'white' }, position: [1, 0, 0], rotation: [0, -0.5, 0], name: 'Fill Card' },
      { modelFunction: 'createVFlatModel', options: { height: 1.5, color: 'black' }, position: [1.2, 0, -0.5], rotation: [0, -0.3, 0], name: 'Negative Fill' },
      { modelFunction: 'createMirrorBoardModel', options: { size: 'small', style: 'soft' }, position: [0.8, 0.3, 0.3], name: 'Bounce Card' },
      { modelFunction: 'createJibModel', options: { armLength: 1.0, style: 'mini' }, position: [0, 0, 1.5], name: 'Overhead Arm' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0.5, 0, 1], rotation: [0, -0.3, 0], name: 'Camera' },
    ],
    recommendedCamera: { position: [0.5, 1.5, 1], target: [0, 0.4, 0], fov: 50 },
    tips: [
      'Side lighting creates appetizing texture and depth','Use negative fill to add drama and contrast','Shoot from multiple angles: 45°, overhead, eye-level','Keep surfaces clean and use fresh ingredients',
    ],
    tags: ['food','culinary','still life','editorial'],
  },
  {
    id: 'headshot_simple',
    name: 'Simple Headshot',
    category: 'portrait',
    description: 'Quick one-light headshot setup for LinkedIn and corporate photos',
    thumbnail: generatePreviewSVG('portrait_1'),
    difficulty: 'beginner',
    lightingStyle: 'Broad / Loop',
    equipment: [
      { modelFunction: 'createMonolightModel', options: { brand: 'godox', power: 300 }, position: [-1.5, 2, 1.5], rotation: [0, 0.4, 0], name: 'Main Light' },
      { modelFunction: 'createOctaboxModel', options: { diameter: 1.2, withGrid: false }, position: [-1.5, 2, 1.5], name: 'Octabox' },
      { modelFunction: 'createVFlatModel', options: { height: 2, color: 'white' }, position: [1.2, 0, 0.5], rotation: [0, -0.4, 0], name: 'Fill Reflector' },
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'gray', width: 2.7 }, position: [0, 0, -2.5], name: 'Gray Backdrop' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.55, style: 'round' }, position: [0, 0, 0], name: 'Stool' },
      { modelFunction: 'createLightStandModel', options: { maxHeight: 2.5 }, position: [-1.5, 0, 1.5], name: 'Light Stand' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 2.5], name: 'Camera' },
    ],
    recommendedCamera: { position: [0, 1.5, 2.5], target: [0, 1.4, 0], fov: 85 },
    tips: [
      'Large octabox creates soft, flattering light','Position light at 45° angle, slightly above eye level','White reflector opens up shadows','Gray background works for most skin tones',
    ],
    tags: ['headshot','corporate','linkedin','one-light'],
  },
  {
    id: 'jewelry_macro',
    name: 'Jewelry/Small Product',
    category: 'product',
    description: 'Macro product photography for jewelry and small items',
    thumbnail: generatePreviewSVG('product_2'),
    difficulty: 'advanced',
    lightingStyle: 'Controlled / Precise',
    equipment: [
      { modelFunction: 'createProductTableModel', options: { style: 'acrylic', withTurntable: true }, position: [0, 0, 0], name: 'Shooting Table' },
      { modelFunction: 'createLightGridModel', options: { width: 0.6, height: 0.6, cellSize: 0.03 }, position: [0, 0.8, 0], rotation: [1.57, 0, 0], name: 'Overhead Tent' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [-0.5, 0.5, 0], rotation: [0, 0.8, 0], name: 'Side Light L' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [0.5, 0.5, 0], rotation: [0, -0.8, 0], name: 'Side Light R' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [0, 0.7, 0.3], rotation: [0.5, 0, 0], name: 'Top Light' },
      { modelFunction: 'createScrimFlagModel', options: { type: 'diffusion', width: 0.3, height: 0.3 }, position: [-0.3, 0.4, 0.2], name: 'Diffuser L' },
      { modelFunction: 'createScrimFlagModel', options: { type: 'diffusion', width: 0.3, height: 0.3 }, position: [0.3, 0.4, 0.2], name: 'Diffuser R' },
      { modelFunction: 'createMirrorBoardModel', options: { size: 'small', style: 'hard' }, position: [0, 0.15, 0.25], rotation: [-0.8, 0, 0], name: 'Bounce Under' },
      { modelFunction: 'createCameraRailsModel', options: { length: 0.5, style: '15mm' }, position: [0, 0.5, 0.8], name: 'Macro Rail' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 1], name: 'Camera' },
    ],
    recommendedCamera: { position: [0, 0.5, 0.8], target: [0, 0.15, 0], fov: 25 },
    tips: [
      'Use focus stacking for maximum sharpness','Light tent controls reflections on metal/gems','Macro rail allows precise focus adjustments','Clean products thoroughly before shooting',
    ],
    tags: ['jewelry','macro','small product','e-commerce'],
  },
  {
    id: 'live_streaming',
    name: 'Live Streaming Setup',
    category: 'video',
    description: 'Gaming and live streaming setup with RGB accents',
    thumbnail: generatePreviewSVG('youtube'),
    difficulty: 'beginner',
    lightingStyle: 'Colorful / Dynamic',
    equipment: [
      { modelFunction: 'createDeskModel', options: { style: 'modern', withDrawers: false }, position: [0, 0, 0], name: 'Streaming Desk' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.5, style: 'round' }, position: [0, 0, 0.4], name: 'Gaming Chair' },
      { modelFunction: 'createMonitorModel', options: { size: 27, style: 'client' }, position: [-0.3, 0.8, -0.2], name: 'Main Monitor' },
      { modelFunction: 'createMonitorModel', options: { size: 24, style: 'client' }, position: [0.35, 0.8, -0.15], name: 'Secondary Monitor' },
      { modelFunction: 'createRingLightModel', options: { diameter: 0.35, style: 'rgb' }, position: [0, 1.3, 0.8], name: 'Face Light' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.2, rgbw: true, pixelControl: true }, position: [-1, 0.6, -0.8], rotation: [0, 0, 1.57], name: 'RGB Tube L' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.2, rgbw: true, pixelControl: true }, position: [1, 0.6, -0.8], rotation: [0, 0, 1.57], name: 'RGB Tube R' },
      { modelFunction: 'createTubeLightModel', options: { length: 0.6, rgbw: true }, position: [0, 0.3, -0.9], name: 'Desk Edge Light' },
      { modelFunction: 'createMicStandModel', options: { style: 'desk', withBoom: true }, position: [-0.5, 0.8, 0.2], name: 'Streaming Mic' },
      { modelFunction: 'createHeadphonesModel', options: { style: 'over_ear', wireless: true }, position: [0, 1.1, 0.4], name: 'Headset' },
      { modelFunction: 'createTripodModel', options: { style: 'video' }, position: [0, 0, 1.5], name: 'Webcam/Camera' },
    ],
    recommendedCamera: { position: [0, 1.2, 1.5], target: [0, 1, 0], fov: 55 },
    tips: [
      'RGB lighting adds dynamic, customizable ambiance','Ring light ensures flattering face illumination','Keep face well-lit relative to monitors','Use OBS/Streamlabs for scene switching',
    ],
    tags: ['streaming','gaming','twitch','rgb','live'],
  },
  
  // ===== NICHE PRESETS =====
  {
    id: 'real_estate_interior',
    name: 'Real Estate Interior',
    category: 'corporate',
    description: 'Wide-angle interior photography for real estate listings',
    thumbnail: generatePreviewSVG('corporate'),
    difficulty: 'intermediate',
    lightingStyle: 'Natural / HDR',
    equipment: [
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withDiffusion: true }, position: [-2, 2, 0], name: 'Window Fill L' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withDiffusion: true }, position: [2, 2, 0], name: 'Window Fill R' },
      { modelFunction: 'createLEDPanelModel', options: { style: '2x1' }, position: [0, 2.8, -2], rotation: [0.3, 0, 0], name: 'Ceiling Bounce' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.0, rgbw: false }, position: [-2.5, 1, 2], name: 'Corner Fill' },
      { modelFunction: 'createDiffusionFrameModel', options: { width: 1.5, height: 2 }, position: [-1.5, 1.5, 1], name: 'Window Diffusion' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 3], name: 'Camera Tripod' },
      { modelFunction: 'createCouchModel', options: { style: 'modern', seats: 3 }, position: [0, 0, -1], name: 'Staging Couch' },
      { modelFunction: 'createPlantModel', options: { type: 'fiddle_leaf' }, position: [-2, 0, -2], name: 'Corner Plant' },
    ],
    recommendedCamera: { position: [0, 1.4, 3], target: [0, 1.2, -1], fov: 24 },
    tips: [
      'Use wide-angle lens (16-24mm) for spacious feel','Match artificial lights to window color temperature','Bracket exposures for HDR blending','Stage rooms with minimal, modern furniture',
    ],
    tags: ['real estate','interior','architecture','hdr'],
  },
  {
    id: 'automotive_studio',
    name: 'Automotive Studio',
    category: 'product',
    description: 'Professional car photography setup with wrap-around lighting',
    thumbnail: generatePreviewSVG('product_2'),
    difficulty: 'advanced',
    lightingStyle: 'Sculpted / Reflective',
    equipment: [
      { modelFunction: 'createCycloramaModel', options: { width: 8, height: 4, color: 'white' }, position: [0, 0, -4], name: 'White Cyc' },
      { modelFunction: 'createLEDPanelModel', options: { style: '2x1', brand: 'aputure' }, position: [-4, 3, 0], rotation: [0, 0.5, -0.2], name: 'Key Panel L' },
      { modelFunction: 'createLEDPanelModel', options: { style: '2x1', brand: 'aputure' }, position: [4, 3, 0], rotation: [0, -0.5, -0.2], name: 'Key Panel R' },
      { modelFunction: 'createLightGridModel', options: { width: 6, height: 4, cellSize: 0.3 }, position: [0, 4, 0], rotation: [1.57, 0, 0], name: 'Overhead Soft Box' },
      { modelFunction: 'createVFlatModel', options: { height: 3, color: 'white' }, position: [-5, 0, 1], name: 'Fill V-Flat L' },
      { modelFunction: 'createVFlatModel', options: { height: 3, color: 'white' }, position: [5, 0, 1], name: 'Fill V-Flat R' },
      { modelFunction: 'createVFlatModel', options: { height: 2, color: 'black' }, position: [0, 0, 5], name: 'Negative Fill' },
      { modelFunction: 'createScrimFlagModel', options: { type: 'solid', width: 2, height: 1.5 }, position: [0, 2, 4], name: 'Reflection Control' },
      { modelFunction: 'createJibModel', options: { armLength: 2, style: 'professional' }, position: [3, 0, 5], name: 'Camera Jib' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 6], name: 'Low Camera' },
    ],
    recommendedCamera: { position: [0, 0.8, 6], target: [0, 0.6, 0], fov: 35 },
    tips: [
      'Large soft sources minimize harsh reflections','Black cards create defining edges on bodywork','Shoot multiple angles and composite reflections','Low camera angle emphasizes vehicle presence',
    ],
    tags: ['automotive','car','vehicle','commercial'],
  },
  {
    id: 'dental_medical',
    name: 'Dental/Medical Photography',
    category: 'product',
    description: 'Clinical photography setup for dental and medical documentation',
    thumbnail: generatePreviewSVG('product_1'),
    difficulty: 'intermediate',
    lightingStyle: 'Clinical / Even',
    equipment: [
      { modelFunction: 'createRingLightModel', options: { diameter: 0.35, style: 'led' }, position: [0, 1.2, 0.5], name: 'Ring Flash' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [-0.5, 1.5, 0.3], rotation: [0, 0.4, 0], name: 'Fill L' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [0.5, 1.5, 0.3], rotation: [0, -0.4, 0], name: 'Fill R' },
      { modelFunction: 'createDirectorChairModel', options: { withArmrests: true }, position: [0, 0, 0], name: 'Patient Chair' },
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'blue', width: 1.5 }, position: [0, 0, -1], name: 'Blue Background' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 1], name: 'Camera' },
      { modelFunction: 'createCameraRailsModel', options: { length: 0.3, style: '15mm' }, position: [0, 1.2, 0.8], name: 'Macro Rail' },
    ],
    recommendedCamera: { position: [0, 1.2, 0.8], target: [0, 1.1, 0], fov: 60 },
    tips: [
      'Ring light provides shadow-free illumination','Use macro lens (100mm) for intraoral shots','Consistent blue or black background for records','Standardize camera settings for documentation',
    ],
    tags: ['dental','medical','clinical','documentation'],
  },
  {
    id: 'fitness_action',
    name: 'Fitness/Action Photography',
    category: 'portrait',
    description: 'Dynamic fitness photography with dramatic lighting',
    thumbnail: generatePreviewSVG('portrait_1'),
    difficulty: 'intermediate',
    lightingStyle: 'Dramatic / Sculpted',
    equipment: [
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 600 }, position: [-2, 2.5, 1], rotation: [0, 0.4, -0.2], name: 'Key Light' },
      { modelFunction: 'createSoftboxModel', options: { width: 0.6, height: 1.5, shape: 'strip' }, position: [-2, 2.5, 1], name: 'Strip Box' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 400 }, position: [2, 2, -1], rotation: [0, -0.6, 0], name: 'Rim Light' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 300 }, position: [-1.5, 2.5, -2], name: 'Hair Light' },
      { modelFunction: 'createScrimFlagModel', options: { type: 'solid', width: 1.5, height: 2 }, position: [1.5, 1, 1], name: 'Negative Fill' },
      { modelFunction: 'createHazeMachineModel', options: { style: 'hazer', size: 'small' }, position: [2.5, 0, -2], name: 'Atmosphere' },
      { modelFunction: 'createFanModel', options: { size: 0.6, style: 'drum' }, position: [2, 0, 2], name: 'Wind Fan' },
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'black', width: 3 }, position: [0, 0, -3], name: 'Black Backdrop' },
      { modelFunction: 'createTripodModel', options: { style: 'photo' }, position: [0, 0, 4], name: 'Camera' },
    ],
    recommendedCamera: { position: [0, 1, 4], target: [0, 1.2, 0], fov: 50 },
    tips: [
      'Use high shutter speed (1/500+) to freeze motion','Strip boxes sculpt muscle definition','Haze adds atmosphere and depth','Fan creates dynamic hair/clothing movement',
    ],
    tags: ['fitness','sports','action','dramatic'],
  },
  {
    id: 'newborn_studio',
    name: 'Newborn Studio',
    category: 'portrait',
    description: 'Gentle newborn photography with soft, diffused lighting',
    thumbnail: generatePreviewSVG('portrait_2'),
    difficulty: 'intermediate',
    lightingStyle: 'Ultra Soft / Window',
    equipment: [
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withDiffusion: true }, position: [-2, 2, 1], rotation: [0, 0.5, 0], name: 'Main Light' },
      { modelFunction: 'createDiffusionFrameModel', options: { width: 1.5, height: 2 }, position: [-1.5, 1.5, 0.8], rotation: [0, 0.4, 0], name: 'Double Diffusion' },
      { modelFunction: 'createVFlatModel', options: { height: 2, color: 'white' }, position: [1.5, 0, 0.5], rotation: [0, -0.3, 0], name: 'Fill Reflector' },
      { modelFunction: 'createProductTableModel', options: { style: 'curved', surfaceColor: 'cream' }, position: [0, 0.3, 0], name: 'Posing Beanbag' },
      { modelFunction: 'createTexturedBackdropModel', options: { texture: 'fabric', width: 2, color: 'cream' }, position: [0, 0, -1.5], name: 'Soft Backdrop' },
      { modelFunction: 'createPracticalLightModel', options: { type: 'floor_lamp', style: 'modern', on: false }, position: [1.5, 0, -1], name: 'Prop Lamp' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 2], name: 'Camera' },
    ],
    recommendedCamera: { position: [0, 1.5, 2], target: [0, 0.4, 0], fov: 85 },
    tips: [
      'Keep studio warm (75-80°F) for baby comfort','Ultra-soft light prevents harsh shadows','Use 85mm+ lens for compression','Safety first - always have spotter nearby',
    ],
    tags: ['newborn','baby','soft light','gentle'],
  },
  {
    id: 'ecommerce_flat_lay',
    name: 'E-commerce Flat Lay',
    category: 'product',
    description: 'Overhead flat lay photography for fashion and accessories',
    thumbnail: generatePreviewSVG('product_1'),
    difficulty: 'beginner',
    lightingStyle: 'Even / Overhead',
    equipment: [
      { modelFunction: 'createProductTableModel', options: { style: 'flat_surface', surfaceColor: 'white' }, position: [0, 0, 0], name: 'Shooting Surface' },
      { modelFunction: 'createLEDPanelModel', options: { style: '2x1', brand: 'godox', withDiffusion: true }, position: [-1, 2, 0], rotation: [0.8, 0.3, 0], name: 'Panel L' },
      { modelFunction: 'createLEDPanelModel', options: { style: '2x1', brand: 'godox', withDiffusion: true }, position: [1, 2, 0], rotation: [0.8, -0.3, 0], name: 'Panel R' },
      { modelFunction: 'createDiffusionFrameModel', options: { width: 1.5, height: 1.5 }, position: [0, 1.5, 0], rotation: [1.57, 0, 0], name: 'Overhead Diffusion' },
      { modelFunction: 'createCStandModel', options: { height: 3, withArm: true }, position: [0, 0, 1.5], name: 'Overhead Arm' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 3, 0], rotation: [1.57, 0, 0], name: 'Overhead Camera' },
    ],
    recommendedCamera: { position: [0, 2.5, 0], target: [0, 0, 0], fov: 35 },
    tips: [
      'Use boom arm or copy stand for overhead angle','Even lighting eliminates shadows','White or marble surfaces work well','Include scale reference when needed',
    ],
    tags: ['flat lay','overhead','e-commerce','fashion'],
  },
  {
    id: 'video_testimonial',
    name: 'Video Testimonial',
    category: 'video',
    description: 'Clean setup for customer testimonials and talking head videos',
    thumbnail: generatePreviewSVG('corporate'),
    difficulty: 'beginner',
    lightingStyle: 'Broadcast / Clean',
    equipment: [
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withBarnDoors: true, withDiffusion: true }, position: [-1.5, 2, 1.5], rotation: [0, 0.4, 0], name: 'Key Light' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', withDiffusion: true }, position: [1.5, 1.8, 1.5], rotation: [0, -0.3, 0], name: 'Fill Light' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [0, 2.2, -1.5], name: 'Hair Light' },
      { modelFunction: 'createDirectorChairModel', options: { withArmrests: true }, position: [0, 0, 0], name: 'Interview Chair' },
      { modelFunction: 'createLavalierModel', options: { withTransmitter: true }, position: [0, 1, 0], name: 'Lavalier Mic' },
      { modelFunction: 'createTeleprompterModel', options: { size: 'small' }, position: [0, 1.2, 2.5], name: 'Teleprompter' },
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'gray', width: 2.7 }, position: [0, 0, -2], name: 'Backdrop' },
      { modelFunction: 'createTripodModel', options: { style: 'video', withHead: true }, position: [0, 0, 3], name: 'Camera' },
    ],
    recommendedCamera: { position: [0, 1.2, 3], target: [0, 1.1, 0], fov: 50 },
    tips: [
      'Eye-level camera for professional look','Use teleprompter for scripted content','Lavalier ensures consistent audio','Neutral background keeps focus on speaker',
    ],
    tags: ['testimonial','talking head','corporate','marketing'],
  },
  {
    id: 'cocktail_beverage',
    name: 'Cocktail/Beverage Photography',
    category: 'product',
    description: 'Glamorous beverage photography with backlight and condensation',
    thumbnail: generatePreviewSVG('product_2'),
    difficulty: 'advanced',
    lightingStyle: 'Backlit / Dramatic',
    equipment: [
      { modelFunction: 'createProductTableModel', options: { style: 'acrylic', surfaceColor: 'black' }, position: [0, 0, 0], name: 'Shooting Surface' },
      { modelFunction: 'createMonolightModel', options: { brand: 'godox', power: 400 }, position: [0, 1.5, -1], name: 'Backlight' },
      { modelFunction: 'createSoftboxModel', options: { width: 0.6, height: 0.8, shape: 'strip' }, position: [0, 1.5, -1], name: 'Strip Box' },
      { modelFunction: 'createMonolightModel', options: { brand: 'godox', power: 200 }, position: [-1, 1, 0.5], rotation: [0, 0.6, 0], name: 'Edge Light L' },
      { modelFunction: 'createMonolightModel', options: { brand: 'godox', power: 200 }, position: [1, 1, 0.5], rotation: [0, -0.6, 0], name: 'Edge Light R' },
      { modelFunction: 'createScrimFlagModel', options: { type: 'solid', width: 0.4, height: 0.6 }, position: [-0.5, 0.5, 0.3], name: 'Flag L' },
      { modelFunction: 'createScrimFlagModel', options: { type: 'solid', width: 0.4, height: 0.6 }, position: [0.5, 0.5, 0.3], name: 'Flag R' },
      { modelFunction: 'createMirrorBoardModel', options: { size: 'small', style: 'soft' }, position: [0, 0.2, 0.5], rotation: [-0.5, 0, 0], name: 'Fill Bounce' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 1.5], name: 'Camera' },
    ],
    recommendedCamera: { position: [0, 0.6, 1.5], target: [0, 0.4, 0], fov: 50 },
    tips: [
      'Backlight makes liquids glow and sparkle','Spray bottle creates fresh condensation','Black cards create defining edges on glass','Use glycerin for longer-lasting "sweat"',
    ],
    tags: ['beverage','cocktail','drink','backlit'],
  },
  {
    id: 'pet_photography',
    name: 'Pet Photography Studio',
    category: 'portrait',
    description: 'Safe and comfortable pet portrait setup',
    thumbnail: generatePreviewSVG('portrait_1'),
    difficulty: 'intermediate',
    lightingStyle: 'Soft / Catchlight',
    equipment: [
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withDiffusion: true }, position: [-1.5, 2, 1.5], rotation: [0, 0.4, 0], name: 'Key Light' },
      { modelFunction: 'createOctaboxModel', options: { diameter: 1.2, withGrid: false }, position: [-1.5, 2, 1.5], name: 'Octabox' },
      { modelFunction: 'createVFlatModel', options: { height: 2, color: 'white' }, position: [1.5, 0, 1], rotation: [0, -0.3, 0], name: 'Fill Reflector' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [0, 2.5, -1], name: 'Hair/Rim Light' },
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'gray', width: 2.7 }, position: [0, 0, -2.5], name: 'Backdrop' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.4, style: 'round' }, position: [0, 0, 0], name: 'Pet Platform' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 2.5], name: 'Camera' },
    ],
    recommendedCamera: { position: [0, 0.8, 2.5], target: [0, 0.5, 0], fov: 85 },
    tips: [
      'Use continuous lights (no startling flashes)','Get at pet eye-level for connection','Have treats and toys ready for attention','Large octabox creates beautiful catchlights',
    ],
    tags: ['pet','animal','dog','cat','portrait'],
  },
  {
    id: 'music_video',
    name: 'Music Video Setup',
    category: 'film',
    description: 'Dynamic music video lighting with color and effects',
    thumbnail: generatePreviewSVG('film_noir'),
    difficulty: 'advanced',
    lightingStyle: 'Colorful / Dynamic',
    equipment: [
      { modelFunction: 'createFresnelModel', options: { size: 5, brand: 'arri', withBarnDoors: true }, position: [-3, 3, 2], rotation: [0, 0.4, -0.2], name: 'Key Fresnel' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.2, rgbw: true, pixelControl: true }, position: [-2, 1, -2], rotation: [0, 0, 1.57], name: 'RGB Tube L' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.2, rgbw: true, pixelControl: true }, position: [2, 1, -2], rotation: [0, 0, 1.57], name: 'RGB Tube R' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.8, rgbw: true }, position: [0, 0.5, -2.5], name: 'RGB Floor Tube' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', rgbw: true }, position: [3, 2, 0], rotation: [0, -0.6, 0], name: 'Color Panel' },
      { modelFunction: 'createHazeMachineModel', options: { style: 'hazer', size: 'large' }, position: [2.5, 0, -3], name: 'Heavy Hazer' },
      { modelFunction: 'createFanModel', options: { size: 0.8, style: 'wind_machine' }, position: [-3, 0, 2], name: 'Wind Machine' },
      { modelFunction: 'createGoboModel', options: { pattern: 'breakup' }, position: [-2.5, 2.5, 1.5], name: 'Pattern Gobo' },
      { modelFunction: 'createSliderModel', options: { length: 1.2, style: 'motorized' }, position: [0, 0, 4], name: 'Motion Slider' },
      { modelFunction: 'createGimbalModel', options: { size: 'large', brand: 'dji' }, position: [1, 0, 3], name: 'Gimbal Cam' },
    ],
    recommendedCamera: { position: [0, 1.2, 4], target: [0, 1, 0], fov: 35 },
    tips: [
      'RGB tubes create modern, dynamic backgrounds','Heavy haze makes light beams visible','Use DMX control for synchronized lighting','Multiple camera angles add production value',
    ],
    tags: ['music video','concert','rgb','dynamic','cinematic'],
  },
  
  // ===== MORE SPECIALIZED PRESETS =====
  {
    id: 'architecture_exterior',
    name: 'Architecture Exterior',
    category: 'corporate',
    description: 'Golden hour architectural photography simulation',
    thumbnail: generatePreviewSVG('corporate'),
    difficulty: 'intermediate',
    lightingStyle: 'Natural / Golden Hour',
    equipment: [
      { modelFunction: 'createFresnelModel', options: { size: 8, brand: 'arri', withBarnDoors: true }, position: [-5, 4, 3], rotation: [0, 0.6, -0.4], name: 'Sun Simulation' },
      { modelFunction: 'createGelFrameModel', options: { color: 'cto' }, position: [-4.5, 3.8, 2.8], name: 'CTO Gel' },
      { modelFunction: 'createLEDPanelModel', options: { style: '2x1', brand: 'aputure' }, position: [4, 2.5, 2], rotation: [0, -0.5, 0], name: 'Fill (Sky Sim)' },
      { modelFunction: 'createGelFrameModel', options: { color: 'ctb' }, position: [3.8, 2.4, 1.9], name: 'CTB Gel' },
      { modelFunction: 'createHazeMachineModel', options: { style: 'hazer', size: 'large' }, position: [0, 0, -5], name: 'Atmosphere Hazer' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 8], name: 'Camera Tripod' },
      { modelFunction: 'createSliderModel', options: { length: 1.2, style: 'motorized' }, position: [0, 0, 7], name: 'Time-lapse Slider' },
    ],
    recommendedCamera: { position: [0, 1.5, 8], target: [0, 2, 0], fov: 24 },
    tips: [
      'Use orange gel on key to simulate golden hour','Blue fill simulates sky bounce','Bracket extensively for HDR compositing','Shoot at blue hour for dramatic skies',
    ],
    tags: ['architecture','exterior','golden hour','building'],
  },
  {
    id: 'macro_nature',
    name: 'Macro Nature Photography',
    category: 'product',
    description: 'Extreme close-up setup for insects, flowers, and small subjects',
    thumbnail: generatePreviewSVG('product_2'),
    difficulty: 'advanced',
    lightingStyle: 'Controlled / Diffused',
    equipment: [
      { modelFunction: 'createLightGridModel', options: { width: 0.4, height: 0.4, cellSize: 0.02 }, position: [0, 0.5, 0], rotation: [1.57, 0, 0], name: 'Overhead Tent' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [-0.3, 0.4, 0.2], rotation: [0, 0.5, 0.3], name: 'Key LED' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [0.3, 0.4, 0.2], rotation: [0, -0.5, 0.3], name: 'Fill LED' },
      { modelFunction: 'createMirrorBoardModel', options: { size: 'small', style: 'soft' }, position: [0, 0.1, 0.3], rotation: [-0.6, 0, 0], name: 'Bounce' },
      { modelFunction: 'createDiffusionFrameModel', options: { width: 0.3, height: 0.3 }, position: [-0.2, 0.35, 0.15], name: 'Micro Diffusion' },
      { modelFunction: 'createCameraRailsModel', options: { length: 0.3, style: '15mm' }, position: [0, 0.3, 0.6], name: 'Focus Rail' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 0.8], name: 'Sturdy Tripod' },
    ],
    recommendedCamera: { position: [0, 0.3, 0.6], target: [0, 0.1, 0], fov: 20 },
    tips: [
      'Use focus stacking (50-100+ images)','Minimize vibration with remote trigger','Diffusion critical for small shiny subjects','Consider focus bracketing rails',
    ],
    tags: ['macro','nature','insect','flower','extreme close-up'],
  },
  {
    id: 'food_styling',
    name: 'Food Styling Studio',
    category: 'product',
    description: 'Professional food styling with hero light and steam effects',
    thumbnail: generatePreviewSVG('product_1'),
    difficulty: 'advanced',
    lightingStyle: 'Sculpted / Appetizing',
    equipment: [
      { modelFunction: 'createProductTableModel', options: { style: 'wood_surface' }, position: [0, 0, 0], name: 'Wooden Surface' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 500 }, position: [-2, 2, -0.5], rotation: [0, 0.8, -0.2], name: 'Hero Light' },
      { modelFunction: 'createSoftboxModel', options: { width: 0.5, height: 1.2, shape: 'strip' }, position: [-2, 2, -0.5], name: 'Strip Softbox' },
      { modelFunction: 'createDiffusionFrameModel', options: { width: 1, height: 1.5 }, position: [-1.2, 1.2, 0], rotation: [0, 0.6, 0], name: 'Window Diffusion' },
      { modelFunction: 'createVFlatModel', options: { height: 1.5, color: 'white' }, position: [1, 0, 0], rotation: [0, -0.4, 0], name: 'Fill Card' },
      { modelFunction: 'createVFlatModel', options: { height: 1.5, color: 'black' }, position: [1.2, 0, -0.5], rotation: [0, -0.2, 0], name: 'Negative Fill' },
      { modelFunction: 'createMirrorBoardModel', options: { size: 'small', style: 'hard' }, position: [0.5, 0.3, 0.5], rotation: [0, -0.5, -0.3], name: 'Highlight Kick' },
      { modelFunction: 'createMonolightModel', options: { brand: 'godox', power: 200 }, position: [0, 2, -1.5], rotation: [0.6, 0, 0], name: 'Back Rim' },
      { modelFunction: 'createJibModel', options: { armLength: 1.0, style: 'mini' }, position: [0, 0, 1.5], name: 'Overhead Arm' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0.5, 0, 1.2], rotation: [0, -0.2, 0], name: 'Camera' },
    ],
    recommendedCamera: { position: [0.5, 1.2, 1.2], target: [0, 0.3, 0], fov: 50 },
    tips: [
      'Hero light creates appetizing texture','Backlight for steam and translucent foods','Keep props minimal and relevant','Use real steam (kettle) or fake (vape)',
    ],
    tags: ['food','styling','culinary','hero light','commercial'],
  },
  {
    id: 'watch_jewelry_pro',
    name: 'Watch/Jewelry Pro',
    category: 'product',
    description: 'High-end watch and jewelry photography with reflection control',
    thumbnail: generatePreviewSVG('product_2'),
    difficulty: 'advanced',
    lightingStyle: 'Precise / Controlled',
    equipment: [
      { modelFunction: 'createProductTableModel', options: { style: 'acrylic', surfaceColor: 'black' }, position: [0, 0, 0], name: 'Black Acrylic' },
      { modelFunction: 'createLightGridModel', options: { width: 0.5, height: 0.5, cellSize: 0.02 }, position: [0, 0.6, 0], rotation: [1.57, 0, 0], name: 'Light Tent' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [0, 0.8, 0], rotation: [1.57, 0, 0], name: 'Overhead Panel' },
      { modelFunction: 'createSoftboxModel', options: { width: 0.3, height: 0.3, shape: 'square' }, position: [-0.4, 0.4, 0.2], rotation: [0, 0.6, 0.3], name: 'Left Soft' },
      { modelFunction: 'createSoftboxModel', options: { width: 0.3, height: 0.3, shape: 'square' }, position: [0.4, 0.4, 0.2], rotation: [0, -0.6, 0.3], name: 'Right Soft' },
      { modelFunction: 'createScrimFlagModel', options: { type: 'solid', width: 0.15, height: 0.15 }, position: [0, 0.4, 0.25], name: 'Reflection Blocker' },
      { modelFunction: 'createMirrorBoardModel', options: { size: 'small', style: 'hard' }, position: [0, 0.15, 0.2], rotation: [-0.5, 0, 0], name: 'Dial Reflection' },
      { modelFunction: 'createCameraRailsModel', options: { length: 0.3, style: '15mm' }, position: [0, 0.4, 0.8], name: 'Focus Rail' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 1], name: 'Camera' },
    ],
    recommendedCamera: { position: [0, 0.4, 0.8], target: [0, 0.15, 0], fov: 35 },
    tips: [
      'Light tent controls metal reflections','Use mirror cards to add specific reflections','Black cards create defining edges','Focus stack for pin-sharp results',
    ],
    tags: ['watch','jewelry','luxury','reflection control'],
  },
  {
    id: 'documentary_interview',
    name: 'Documentary Interview',
    category: 'film',
    description: 'Cinematic documentary-style interview setup',
    thumbnail: generatePreviewSVG('film_noir'),
    difficulty: 'intermediate',
    lightingStyle: 'Natural / Motivated',
    equipment: [
      { modelFunction: 'createFresnelModel', options: { size: 5, brand: 'arri', withBarnDoors: true }, position: [-2.5, 2.5, 1], rotation: [0, 0.5, -0.2], name: 'Key Fresnel' },
      { modelFunction: 'createDiffusionFrameModel', options: { width: 1.2, height: 1.5 }, position: [-1.8, 2, 0.8], rotation: [0, 0.4, 0], name: 'Key Diffusion' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1' }, position: [2, 1.8, 1], rotation: [0, -0.4, 0], name: 'Fill Light' },
      { modelFunction: 'createVFlatModel', options: { height: 2, color: 'black' }, position: [1.8, 0, 0.5], rotation: [0, -0.3, 0], name: 'Negative Fill' },
      { modelFunction: 'createPracticalLightModel', options: { type: 'floor_lamp', style: 'vintage', on: true }, position: [1.5, 0, -1], name: 'Practical Lamp' },
      { modelFunction: 'createDirectorChairModel', options: { withArmrests: true }, position: [0, 0, 0], rotation: [0, -0.1, 0], name: 'Subject Chair' },
      { modelFunction: 'createBoomPoleModel', options: { length: 2.5, withMic: true }, position: [-0.5, 2.5, 0.8], rotation: [0, 0.2, -0.4], name: 'Boom Mic' },
      { modelFunction: 'createSliderModel', options: { length: 1.0, style: 'motorized' }, position: [0, 0, 3], name: 'Subtle Slider' },
      { modelFunction: 'createTripodModel', options: { style: 'video', withHead: true }, position: [0, 0, 3], name: 'Camera A' },
      { modelFunction: 'createTripodModel', options: { style: 'video', withHead: true }, position: [1.5, 0, 2.5], rotation: [0, -0.3, 0], name: 'Camera B' },
    ],
    recommendedCamera: { position: [0, 1.2, 3], target: [0, 1.1, 0], fov: 35 },
    tips: [
      'Motivated lighting looks natural','Include practicals in frame for context','Subtle slider movement adds production value','Two cameras for A-roll and B-roll cutaways',
    ],
    tags: ['documentary','interview','cinematic','motivated'],
  },
  {
    id: 'cosmetics_beauty',
    name: 'Cosmetics Product',
    category: 'product',
    description: 'Glamorous cosmetics and beauty product photography',
    thumbnail: generatePreviewSVG('product_1'),
    difficulty: 'intermediate',
    lightingStyle: 'Glamorous / Clean',
    equipment: [
      { modelFunction: 'createProductTableModel', options: { style: 'acrylic', surfaceColor: 'pink' }, position: [0, 0, 0], name: 'Pink Acrylic' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withDiffusion: true }, position: [-1, 1.5, 0.5], rotation: [0, 0.5, 0.2], name: 'Key Light' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', withDiffusion: true }, position: [1, 1.5, 0.5], rotation: [0, -0.5, 0.2], name: 'Fill Light' },
      { modelFunction: 'createLEDPanelModel', options: { style: 'mini' }, position: [0, 2, -0.5], rotation: [0.8, 0, 0], name: 'Top Light' },
      { modelFunction: 'createMirrorBoardModel', options: { size: 'small', style: 'soft' }, position: [0, 0.15, 0.4], rotation: [-0.4, 0, 0], name: 'Fill Bounce' },
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'pink', width: 1.5 }, position: [0, 0, -1], name: 'Pink Backdrop' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 1.5], name: 'Camera' },
    ],
    recommendedCamera: { position: [0, 0.8, 1.5], target: [0, 0.3, 0], fov: 50 },
    tips: [
      'Soft, even lighting for product detail','Match backdrop to brand colors','Clean reflections on bottles/tubes','Consider lifestyle props (flowers, fabric)',
    ],
    tags: ['cosmetics','beauty','makeup','skincare','product'],
  },
  {
    id: 'sports_portrait',
    name: 'Sports Portrait',
    category: 'portrait',
    description: 'Dynamic sports athlete portrait with gear',
    thumbnail: generatePreviewSVG('portrait_1'),
    difficulty: 'intermediate',
    lightingStyle: 'Dramatic / High Contrast',
    equipment: [
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 800 }, position: [-2, 2.5, 1], rotation: [0, 0.4, -0.2], name: 'Key Light' },
      { modelFunction: 'createBeautyDishModel', options: { diameter: 0.55, color: 'silver', withGrid: true }, position: [-2, 2.5, 1], name: 'Silver Beauty Dish' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 500 }, position: [2, 2, -1], rotation: [0, -0.6, 0], name: 'Rim Light L' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 500 }, position: [-1.5, 2, -1.5], rotation: [0, 0.6, 0], name: 'Rim Light R' },
      { modelFunction: 'createScrimFlagModel', options: { type: 'solid', width: 1.5, height: 2 }, position: [1.5, 1, 1], name: 'Negative Fill' },
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'black', width: 3 }, position: [0, 0, -3], name: 'Black Backdrop' },
      { modelFunction: 'createFanModel', options: { size: 0.6, style: 'drum' }, position: [2, 0, 2], name: 'Hair Fan' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.4, style: 'saddle' }, position: [0, 0, 0], name: 'Low Stool' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 3.5], name: 'Camera' },
    ],
    recommendedCamera: { position: [0, 1, 3.5], target: [0, 1.2, 0], fov: 70 },
    tips: [
      'Silver beauty dish for punchy contrast','Strong rim lights define muscle/gear','Fan adds motion and energy','Low angle emphasizes power',
    ],
    tags: ['sports','athlete','portrait','dynamic','dramatic'],
  },
  {
    id: 'band_promo',
    name: 'Band Promo Photo',
    category: 'portrait',
    description: 'Multi-person band promotional photography',
    thumbnail: generatePreviewSVG('portrait_1'),
    difficulty: 'advanced',
    lightingStyle: 'Dramatic / Edgy',
    equipment: [
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 600 }, position: [-3, 2.5, 1], rotation: [0, 0.4, -0.2], name: 'Key Light' },
      { modelFunction: 'createSoftboxModel', options: { width: 1, height: 1.5 }, position: [-3, 2.5, 1], name: 'Key Softbox' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 400 }, position: [3, 2, -1], rotation: [0, -0.5, 0], name: 'Rim Right' },
      { modelFunction: 'createMonolightModel', options: { brand: 'profoto', power: 400 }, position: [-2.5, 2, -2], rotation: [0, 0.5, 0], name: 'Rim Left' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.5, rgbw: true }, position: [-2, 0.8, -2], rotation: [0, 0, 1.57], name: 'RGB Accent L' },
      { modelFunction: 'createTubeLightModel', options: { length: 1.5, rgbw: true }, position: [2, 0.8, -2], rotation: [0, 0, 1.57], name: 'RGB Accent R' },
      { modelFunction: 'createHazeMachineModel', options: { style: 'hazer', size: 'medium' }, position: [0, 0, -3], name: 'Hazer' },
      { modelFunction: 'createSeamlessBackdropModel', options: { color: 'black', width: 4 }, position: [0, 0, -3.5], name: 'Black Backdrop' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.5, style: 'round' }, position: [-1, 0, 0], name: 'Stool 1' },
      { modelFunction: 'createPosingStoolModel', options: { height: 0.4, style: 'round' }, position: [1, 0, 0.3], name: 'Stool 2' },
      { modelFunction: 'createTripodModel', options: { style: 'photo', withHead: true }, position: [0, 0, 5], name: 'Camera' },
    ],
    recommendedCamera: { position: [0, 1.2, 5], target: [0, 1.1, 0], fov: 50 },
    tips: [
      'Vary member heights with stools/standing','RGB accents add modern edge','Haze creates atmosphere and depth','Group poses require clear direction',
    ],
    tags: ['band','music','group','promo','dramatic'],
  },
  {
    id: 'vr_180_stereo',
    name: 'VR/180° Stereo',
    category: 'video',
    description: 'Immersive VR content creation setup',
    thumbnail: generatePreviewSVG('youtube'),
    difficulty: 'advanced',
    lightingStyle: '360° Even / Immersive',
    equipment: [
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withDiffusion: true }, position: [-2, 2.5, 0], rotation: [0, 0.5, -0.2], name: 'Panel Front-L' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', brand: 'aputure', withDiffusion: true }, position: [2, 2.5, 0], rotation: [0, -0.5, -0.2], name: 'Panel Front-R' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', withDiffusion: true }, position: [0, 2.5, -2], rotation: [0.3, 0, 0], name: 'Panel Back' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', withDiffusion: true }, position: [-2, 2, -2], rotation: [0, 0.8, 0], name: 'Panel Side-L' },
      { modelFunction: 'createLEDPanelModel', options: { style: '1x1', withDiffusion: true }, position: [2, 2, -2], rotation: [0, -0.8, 0], name: 'Panel Side-R' },
      { modelFunction: 'createCStandModel', options: { height: 2.5, withArm: false }, position: [0, 0, 0], name: 'VR Camera Mount' },
      { modelFunction: 'createAudioRecorderModel', options: { style: 'spatial', channels: 4 }, position: [0, 1.5, 0], name: 'Spatial Audio' },
    ],
    recommendedCamera: { position: [0, 1.6, 0], target: [0, 1.6, -1], fov: 180 },
    tips: [
      'Even lighting from all directions','Hide stands/equipment behind camera','Spatial audio essential for immersion','Consider viewer comfort (motion)',
    ],
    tags: ['vr','180','stereo','immersive','360'],
  },
];

// ============================================================================
// Component
// ============================================================================

interface ScenePresetsProps {
  onLoadPreset?: (preset: ScenePreset) => void;
  onCaptureForComparison?: (type: 'before' | 'after', name: string) => void;
}

export function ScenePresets({ onLoadPreset, onCaptureForComparison }: ScenePresetsProps) {
  // Tablet support
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  // Accessibility
  const { announce, settings: a11ySettings } = useAccessibility();

  const [selectedCategory, setSelectedCategory] = useState<ScenePreset['category'] | 'all'>('all');
  const [selectedPreset, setSelectedPreset] = useState<ScenePreset | null>(null);
  const [autoCompare, setAutoCompare] = useState(false);
  
  // Long-press menu state for tablets
  const [longPressMenuAnchor, setLongPressMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [longPressPreset, setLongPressPreset] = useState<ScenePreset | null>(null);

  const filteredPresets = SCENE_PRESETS.filter(
    (preset) => selectedCategory === 'all' || preset.category === selectedCategory
  );

  const handleLoadPreset = useCallback(() => {
    if (selectedPreset && onLoadPreset) {
      // Capture "before" snapshot if auto-compare enabled
      if (autoCompare && onCaptureForComparison) {
        onCaptureForComparison('before', `Before: ${selectedPreset.name}`);
      }
      
      onLoadPreset(selectedPreset);
      announce(`Loaded ${selectedPreset.name} preset with ${selectedPreset.equipment.length} equipment items, `);
      
      // Capture "after" snapshot after a short delay
      if (autoCompare && onCaptureForComparison) {
        setTimeout(() => {
          onCaptureForComparison('after', `After: ${selectedPreset.name}`);
        }, 500);
      }
      
      setSelectedPreset(null);
    }
  }, [selectedPreset, onLoadPreset, autoCompare, onCaptureForComparison, announce]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#121212' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            Scene Presets
          </Typography>
          <Tooltip title="Automatically capture before/after snapshots for comparison">
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autoCompare}
                  onChange={(e) => setAutoCompare(e.target.checked)}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CompareArrows fontSize="small" />
                  <Typography variant="caption">Compare</Typography>
                </Box>
              }
            />
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          One-click professional studio setups
        </Typography>

        {/* Category tabs */}
        <Tabs
          value={selectedCategory}
          onChange={(_, v) => setSelectedCategory(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 36'& .MuiTab-root': { minHeight: 36, py: 0.5, px: 1.5, fontSize: '0.75rem' }}}
        >
          <Tab value="all" label="All" />
          {Object.entries(CATEGORY_INFO).map(([key, { label, icon }]) => (
            <Tab
              key={key}
              value={key}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {icon}
                  <span>{label}</span>
                </Box>
              }
            />
          ))}
        </Tabs>
      </Box>

      {/* Presets Grid */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Grid container spacing={2}>
          {filteredPresets.map((preset) => (
            <Grid item xs={12} sm={6} key={preset.id}>
              <Card
                sx={{
                  bgcolor: '#1e1e1e',
                  transition: 'all 0.2s', '&:hover': {
                    bgcolor: '#252525',
                    transform: 'translateY(-2px)',
                    boxShadow: `0 4px 20px ${CATEGORY_INFO[preset.category].color}33`,
                  }}}
              >
                <CardActionArea onClick={() => setSelectedPreset(preset)}>
                  <CardMedia
                    component="img"
                    height="100"
                    image={preset.thumbnail}
                    alt={preset.name}
                    sx={{ bgcolor: '#0a0a0a' }}
                  />
                  <CardContent sx={{ p: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {preset.name}
                      </Typography>
                      <Chip
                        label={preset.difficulty}
                        size="small"
                        sx={{
                          fontSize: '0.6rem',
                          height: 18,
                          bgcolor:
                            preset.difficulty === 'beginner'
                              ? '#4caf50'
                              : preset.difficulty === 'intermediate'
                              ? '#ff9800'
                              : '#f44336',
                          color: '#fff'}}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      {preset.description}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        icon={CATEGORY_INFO[preset.category].icon as React.ReactElement}
                        label={CATEGORY_INFO[preset.category].label}
                        size="small"
                        sx={{ bgcolor: CATEGORY_INFO[preset.category].color + '33', fontSize: '0.65rem', height: 20 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {preset.equipment.length} items
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Preset Details Dialog */}
      <Dialog open={!!selectedPreset} onClose={() => setSelectedPreset(null)} maxWidth="md" fullWidth>
        {selectedPreset && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                component="img"
                src={selectedPreset.thumbnail}
                alt={selectedPreset.name}
                sx={{ width: 100, height: 75, bgcolor: '#0a0a0a', borderRadius: 1 }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">{selectedPreset.name}</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Chip
                    label={CATEGORY_INFO[selectedPreset.category].label}
                    size="small"
                    sx={{ bgcolor: CATEGORY_INFO[selectedPreset.category].color, color: '#fff' }}
                  />
                  <Chip
                    label={selectedPreset.difficulty}
                    size="small"
                    sx={{
                      bgcolor:
                        selectedPreset.difficulty === 'beginner'
                          ? '#4caf50'
                          : selectedPreset.difficulty === 'intermediate'
                          ? '#ff9800' : '#f44336',
                      color: '#fff'}}
                  />
                  <Chip label={selectedPreset.lightingStyle} size="small" variant="outlined" />
                </Box>
              </Box>
              <IconButton onClick={() => setSelectedPreset(null)}>
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" color="text.secondary" paragraph>
                {selectedPreset.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Build fontSize="small" /> Equipment List ({selectedPreset.equipment.length} items)
              </Typography>
              <Grid container spacing={1} sx={{ mb: 2 }}>
                {selectedPreset.equipment.map((item, index) => (
                  <Grid item xs={6} sm={4} key={index}>
                    <Box
                      sx={{
                        p: 1,
                        bgcolor: '#1a1a1a',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1}}
                    >
                      <Lightbulb fontSize="small" sx={{ color: '#666' }} />
                      <Typography variant="caption">{item.name}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Info fontSize="small" /> Tips
              </Typography>
              <List dense>
                {selectedPreset.tips.map((tip, index) => (
                  <ListItem key={index} sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" color="text.secondary">
                          • {tip}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />

              <Alert severity="info" sx={{ mt: 2 }}>
                Loading this preset will clear your current scene and add all equipment at their configured positions.
              </Alert>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedPreset(null)}>Cancel</Button>
              <Button variant="contained" onClick={handleLoadPreset} startIcon={<PlayArrow />}>
                Load Preset
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export { SCENE_PRESETS };
export default ScenePresets;

