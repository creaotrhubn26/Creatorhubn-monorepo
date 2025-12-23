/**
 * EquipmentCatalog - Visual catalog/browser for all 3D studio equipment
 * 
 * Features:
 * - Category browsing with thumbnails
 * - Drag-and-drop to Virtual Studio
 * - Search and filtering
 * - Equipment details and specs
 * - Quick-add functionality
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Chip,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Collapse,
  Paper,
  Divider,
  Alert,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Search,
  FilterList,
  ViewModule,
  ViewList,
  Add,
  DragIndicator,
  Lightbulb,
  CameraAlt,
  Mic,
  Weekend,
  Videocam,
  Theaters,
  Build,
  Tune,
  Star,
  StarBorder,
  ExpandMore,
  ExpandLess,
  Info,
  Close,
  Delete,
  ContentCopy,
  Settings,
} from '@mui/icons-material';
import { useTabletSupport } from '../../providers/TabletSupportProvider';
import { TouchSlider, TouchIconButton, TouchContextMenu } from '../components/TabletAwarePanels';
import { useAccessibility, useAnnounce, VisuallyHidden } from '../../providers/AccessibilityProvider';
import { AccessibleButton, AccessibleDialog, AccessibleSlider } from '../components/AccessibleComponents';
import { useVirtualStudio } from '../../../VirtualStudioContext';

// ============================================================================
// Equipment Categories and Items
// ============================================================================

export type EquipmentCategory =
  | 'lights'
  | 'modifiers'
  | 'camera_motion'
  | 'audio'
  | 'furniture'
  | 'video_production'
  | 'effects'
  | 'grip';

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  subcategory?: string;
  description: string;
  thumbnail: string;
  modelFunction: string;
  defaultOptions: Record<string, any>;
  availableOptions?: {
    name: string;
    type: 'select' | 'slider' | 'boolean' | 'color';
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
    default: any;
  }[];
  tags: string[];
  featured?: boolean;
}

const CATEGORY_INFO: Record<EquipmentCategory, { label: string; icon: React.ReactNode; color: string }> = {
  lights: { label: 'Studio Lights', icon: <Lightbulb />, color: '#ffb300' },
  modifiers: { label: 'Light Modifiers', icon: <Tune />, color: '#7c4dff' },
  camera_motion: { label: 'Camera & Motion', icon: <CameraAlt />, color: '#00bcd4' },
  audio: { label: 'Audio Equipment', icon: <Mic />, color: '#4caf50' },
  furniture: { label: 'Set & Furniture', icon: <Weekend />, color: '#ff7043' },
  video_production: { label: 'Video Production', icon: <Videocam />, color: '#e91e63' },
  effects: { label: 'Special Effects', icon: <Theaters />, color: '#9c27b0' },
  grip: { label: 'Grip Hardware', icon: <Build />, color: '#607d8b' },
};

// Generate SVG thumbnails for each equipment type
const generateThumbnailSVG = (type: string, color: string = '#666'): string => {
  const svgTemplates: Record<string, string> = {
    monolight: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="20" width="40" height="60" rx="5" fill="${color}"/><circle cx="50" cy="35" r="15" fill="#fff" opacity="0.8"/><rect x="40" y="75" width="20" height="10" fill="#333"/></svg>`,
    led_panel: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="25" width="70" height="50" rx="3" fill="${color},"/><rect x="20" y="30" width="60" height="40" fill="#fff" opacity="0.9"/><circle cx="50" cy="85" r="5" fill="#333"/></svg>`,
    fresnel: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M25 30 L75 30 L65 70 L35 70 Z" fill="${color},"/><circle cx="50" cy="40" r="12" fill="#88aacc" opacity="0.6"/><rect x="45" y="70" width="10" height="15" fill="#333"/></svg>`,
    ring_light: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="35" fill="none" stroke="${color}," stroke-width="10"/><circle cx="50" cy="50" r="15" fill="#333"/></svg>`,
    tube_light: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="45" width="60" height="10" rx="5" fill="${color}"/><rect x="22" y="47" width="56" height="6" fill="#fff" opacity="0.8"/></svg>`,
    softbox: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,10 90,40 90,90 10,90 10,40" fill="${color}"/><rect x="20" y="50" width="60" height="35" fill="#fff" opacity="0.7"/></svg>`,
    octabox: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,10 80,25 90,55 80,85 50,95 20,85 10,55 20,25" fill="${color}"/><circle cx="50" cy="52" r="25" fill="#fff" opacity="0.7"/></svg>`,
    beauty_dish: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="50" rx="40" ry="15" fill="${color}"/><circle cx="50" cy="50" r="10" fill="#eee"/></svg>`,
    umbrella: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M15 60 Q50 10 85 60" fill="${color}" stroke="#333" stroke-width="2"/><line x1="50" y1="60" x2="50" y2="95" stroke="#333" stroke-width="3"/></svg>`,
    slider: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="45" width="80" height="10" rx="2" fill="${color}"/><rect x="40" y="35" width="20" height="30" rx="3" fill="#333"/></svg>`,
    dolly: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="40" width="60" height="30" fill="${color}"/><circle cx="30" cy="80" r="8" fill="#333"/><circle cx="70" cy="80" r="8" fill="#333"/></svg>`,
    jib: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><line x1="20" y1="80" x2="80" y2="30" stroke="${color}" stroke-width="5"/><circle cx="80" cy="30" r="8" fill="#333"/><polygon points="15,85 25,85 20,70" fill="#333"/></svg>`,
    gimbal: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="40" y="60" width="20" height="35" rx="3" fill="${color}"/><circle cx="50" cy="40" r="15" fill="#333"/><rect x="42" y="25" width="16" height="20" fill="#555"/></svg>`,
    boom_pole: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><line x1="20" y1="80" x2="80" y2="20" stroke="${color}" stroke-width="4"/><ellipse cx="85" cy="15" rx="8" ry="5" fill="#333"/></svg>`,
    mic_stand: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><line x1="50" y1="30" x2="50" y2="80" stroke="${color}" stroke-width="4"/><circle cx="50" cy="90" r="15" fill="${color}"/><ellipse cx="50" cy="20" rx="8" ry="12" fill="#333"/></svg>`,
    headphones: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M25 55 Q25 25 50 25 Q75 25 75 55" fill="none" stroke="${color}" stroke-width="6"/><rect x="18" y="50" width="15" height="25" rx="5" fill="${color}"/><rect x="67" y="50" width="15" height="25" rx="5" fill="${color}"/></svg>`,
    stool: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="35" rx="25" ry="8" fill="${color}"/><line x1="50" y1="43" x2="50" y2="75" stroke="#333" stroke-width="4"/><ellipse cx="50" cy="85" rx="20" ry="5" fill="#333"/></svg>`,
    director_chair: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><line x1="25" y1="20" x2="35" y2="85" stroke="${color}" stroke-width="4"/><line x1="75" y1="20" x2="65" y2="85" stroke="${color}" stroke-width="4"/><rect x="30" y="45" width="40" height="8" fill="#333"/><rect x="32" y="25" width="36" height="15" fill="#333"/></svg>`,
    teleprompter: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="30" width="60" height="40" fill="${color}"/><rect x="25" y="35" width="50" height="30" fill="#1a3a5a"/><polygon points="50,25 70,35 30,35" fill="#88aacc" opacity="0.5"/></svg>`,
    monitor: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="25" width="70" height="45" rx="3" fill="${color}"/><rect x="20" y="30" width="60" height="35" fill="#1a3a5a"/><rect x="45" y="70" width="10" height="10" fill="#333"/></svg>`,
    clapperboard: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="35" width="60" height="45" fill="#eee"/><rect x="20" y="25" width="60" height="15" fill="#1a1a1a"/><line x1="30" y1="25" x2="40" y2="40" stroke="#fff" stroke-width="3"/><line x1="50" y1="25" x2="60" y2="40" stroke="#fff" stroke-width="3"/></svg>`,
    haze_machine: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="40" width="50" height="35" rx="3" fill="${color}"/><ellipse cx="80" cy="50" rx="8" ry="5" fill="#aaa"/><circle cx="30" cy="35" r="3" fill="#88aacc" opacity="0.5"/><circle cx="40" cy="30" r="4" fill="#88aacc" opacity="0.4"/></svg>`,
    fan: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="35" fill="${color}"/><circle cx="50" cy="50" r="25" fill="#333" opacity="0.5"/><line x1="50" y1="25" x2="50" y2="75" stroke="#666" stroke-width="3"/><line x1="25" y1="50" x2="75" y2="50" stroke="#666" stroke-width="3"/></svg>`,
    clamp: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="30" width="40" height="25" fill="${color}"/><rect x="35" y="55" width="10" height="20" fill="#333"/><rect x="55" y="55" width="10" height="20" fill="#333"/><circle cx="50" cy="20" r="8" fill="#ccc"/></svg>`,
    c_stand: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><line x1="50" y1="20" x2="50" y2="70" stroke="${color}" stroke-width="4"/><line x1="50" y1="70" x2="25" y2="90" stroke="${color}" stroke-width="3"/><line x1="50" y1="70" x2="75" y2="90" stroke="${color}" stroke-width="3"/><line x1="50" y1="70" x2="50" y2="90" stroke="${color}" stroke-width="3"/><line x1="30" y1="25" x2="70" y2="25" stroke="${color}" stroke-width="3"/></svg>`,
    tripod: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><line x1="50" y1="25" x2="25" y2="85" stroke="${color}" stroke-width="4"/><line x1="50" y1="25" x2="75" y2="85" stroke="${color}" stroke-width="4"/><line x1="50" y1="25" x2="50" y2="85" stroke="${color}" stroke-width="4"/><rect x="40" y="15" width="20" height="15" fill="#333"/></svg>`,
  };
  
  const svg = svgTemplates[type] || svgTemplates.monolight;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// Complete equipment catalog
const EQUIPMENT_CATALOG: EquipmentItem[] = [
  // ===== LIGHTS =====
  {
    id: 'monolight',
    name: 'Monolight / Strobe',
    category: 'lights',
    subcategory: 'Strobes',
    description: 'Professional studio strobe with modeling light and Bowens mount',
    thumbnail: generateThumbnailSVG('monolight,', '#1a1a1a'),
    modelFunction: 'createMonolightModel',
    defaultOptions: { brand: 'profoto', power: 500, withModelingLight: true },
    availableOptions: [
      { name: 'brand', type: 'select', options: ['profoto','broncolor','elinchrom','godox','generic'], default: 'profoto' },
      { name: 'power', type: 'slider', min: 100, max: 1200, step: 100, default: 500 },
      { name: 'withModelingLight', type: 'boolean', default: true },
      { name: 'withDisplay', type: 'boolean', default: true },
    ],
    tags: ['strobe','flash','studio','professional'],
    featured: true,
  },
  {
    id: 'led_panel',
    name: 'LED Panel',
    category: 'lights',
    subcategory: 'Continuous',
    description: 'Bi-color or RGBW LED panel with barn doors and yoke mount',
    thumbnail: generateThumbnailSVG('led_panel,', '#1a1a1a'),
    modelFunction: 'createLEDPanelModel',
    defaultOptions: { style: '1x1', brand: 'aputure', withBarnDoors: true },
    availableOptions: [
      { name: 'style', type: 'select', options: ['1x1','2x1','mini','flexible'], default: '1x1' },
      { name: 'brand', type: 'select', options: ['aputure','godox','nanlite','generic'], default: 'aputure' },
      { name: 'withBarnDoors', type: 'boolean', default: true },
      { name: 'biColor', type: 'boolean', default: true },
      { name: 'rgbw', type: 'boolean', default: false },
    ],
    tags: ['led','continuous','video','bi-color'],
    featured: true,
  },
  {
    id: 'fresnel',
    name: 'Fresnel Light',
    category: 'lights',
    subcategory: 'Continuous',
    description: 'Classic Fresnel spotlight with focusable beam and barn doors',
    thumbnail: generateThumbnailSVG('fresnel,', '#003366'),
    modelFunction: 'createFresnelModel',
    defaultOptions: { size: 5, brand: 'arri', withBarnDoors: true },
    availableOptions: [
      { name: 'size', type: 'slider', min: 3, max: 12, step: 1, default: 5 },
      { name: 'brand', type: 'select', options: ['arri','mole','generic'], default: 'arri' },
      { name: 'withBarnDoors', type: 'boolean', default: true },
      { name: 'focusPosition', type: 'slider', min: 0, max: 1, step: 0.1, default: 0.5 },
    ],
    tags: ['fresnel','spotlight','film','tungsten'],
  },
  {
    id: 'ring_light',
    name: 'Ring Light',
    category: 'lights',
    subcategory: 'Specialty',
    description: 'Circular LED ring light with phone/camera mount',
    thumbnail: generateThumbnailSVG('ring_light, ','#ffb300'),
    modelFunction: 'createRingLightModel',
    defaultOptions: { diameter: 0.45, style: 'led', withDiffuser: true },
    availableOptions: [
      { name: 'diameter', type: 'slider', min: 0.25, max: 0.6, step: 0.05, default: 0.45 },
      { name: 'style', type: 'select', options: ['led','fluorescent','rgb'], default: 'led' },
      { name: 'withDiffuser', type: 'boolean', default: true },
    ],
    tags: ['ring','beauty','selfie','youtube'],
  },
  {
    id: 'tube_light',
    name: 'Tube Light',
    category: 'lights',
    subcategory: 'Specialty',
    description: 'LED tube light for accent lighting and practicals',
    thumbnail: generateThumbnailSVG('tube_light, ','#f0f0f0'),
    modelFunction: 'createTubeLightModel',
    defaultOptions: { length: 1.2, brand: 'nanlite', rgbw: true },
    availableOptions: [
      { name: 'length', type: 'slider', min: 0.6, max: 1.8, step: 0.2, default: 1.2 },
      { name: 'brand', type: 'select', options: ['nanlite','aputure','godox','generic'], default: 'nanlite' },
      { name: 'rgbw', type: 'boolean', default: true },
      { name: 'pixelControl', type: 'boolean', default: false },
    ],
    tags: ['tube','rgb','accent','pavotube'],
  },
  {
    id: 'cob_light',
    name: 'COB Light',
    category: 'lights',
    subcategory: 'Continuous',
    description: 'High-power COB LED with Bowens mount',
    thumbnail: generateThumbnailSVG('monolight','#1a1a1a'),
    modelFunction: 'createCOBLightModel',
    defaultOptions: { power: 300, brand: 'aputure', bowensMount: true },
    availableOptions: [
      { name: 'power', type: 'slider', min: 60, max: 600, step: 60, default: 300 },
      { name: 'brand', type: 'select', options: ['aputure','nanlite','godox','generic'], default: 'aputure' },
      { name: 'withReflector', type: 'boolean', default: true },
    ],
    tags: ['cob','led','continuous','daylight'],
  },
  {
    id: 'practical_desk',
    name: 'Desk Lamp',
    category: 'lights',
    subcategory: 'Practicals',
    description: 'Desk lamp for set dressing',
    thumbnail: generateThumbnailSVG('monolight','#8b7355'),
    modelFunction: 'createPracticalLightModel',
    defaultOptions: { type: 'desk_lamp', style: 'modern', on: true },
    tags: ['practical','prop','desk'],
  },
  {
    id: 'practical_floor',
    name: 'Floor Lamp',
    category: 'lights',
    subcategory: 'Practicals',
    description: 'Standing floor lamp for set dressing',
    thumbnail: generateThumbnailSVG('monolight','#8b7355'),
    modelFunction: 'createPracticalLightModel',
    defaultOptions: { type: 'floor_lamp', style: 'modern', on: true },
    tags: ['practical','prop','floor'],
  },
  
  // ===== MODIFIERS =====
  {
    id: 'softbox',
    name: 'Softbox',
    category: 'modifiers',
    subcategory: 'Diffusion',
    description: 'Rectangular softbox with optional grid and inner diffusion',
    thumbnail: generateThumbnailSVG('softbox','#1a1a1a'),
    modelFunction: 'createSoftboxModel',
    defaultOptions: { width: 0.6, height: 0.9, withGrid: false },
    availableOptions: [
      { name: 'width', type: 'slider', min: 0.3, max: 1.2, step: 0.1, default: 0.6 },
      { name: 'height', type: 'slider', min: 0.3, max: 1.8, step: 0.1, default: 0.9 },
      { name: 'shape', type: 'select', options: ['rectangular','square','strip'], default: 'rectangular' },
      { name: 'withGrid', type: 'boolean', default: false },
      { name: 'withInnerDiffusion', type: 'boolean', default: true },
    ],
    tags: ['softbox','diffusion','soft light'],
    featured: true,
  },
  {
    id: 'octabox',
    name: 'Octabox',
    category: 'modifiers',
    subcategory: 'Diffusion',
    description: 'Octagonal softbox with wrap-around light',
    thumbnail: generateThumbnailSVG('octabox','#1a1a1a'),
    modelFunction: 'createOctaboxModel',
    defaultOptions: { diameter: 1.2, sides: 8, withGrid: false },
    availableOptions: [
      { name: 'diameter', type: 'slider', min: 0.6, max: 2.0, step: 0.2, default: 1.2 },
      { name: 'sides', type: 'select', options: ['8','12','16'], default: '8' },
      { name: 'withGrid', type: 'boolean', default: false },
      { name: 'deep', type: 'boolean', default: false },
    ],
    tags: ['octabox','diffusion','portrait'],
    featured: true,
  },
  {
    id: 'beauty_dish',
    name: 'Beauty Dish',
    category: 'modifiers',
    subcategory: 'Reflectors',
    description: 'Parabolic beauty dish with deflector plate',
    thumbnail: generateThumbnailSVG('beauty_dish','#f5f5f5'),
    modelFunction: 'createBeautyDishModel',
    defaultOptions: { diameter: 0.55, color: 'white', withGrid: false },
    availableOptions: [
      { name: 'diameter', type: 'slider', min: 0.4, max: 0.7, step: 0.05, default: 0.55 },
      { name: 'color', type: 'select', options: ['white','silver'], default: 'white' },
      { name: 'withGrid', type: 'boolean', default: false },
      { name: 'withSock', type: 'boolean', default: false },
    ],
    tags: ['beauty dish','portrait','fashion'],
    featured: true,
  },
  {
    id: 'umbrella',
    name: 'Umbrella',
    category: 'modifiers',
    subcategory: 'Reflectors',
    description: 'Photography umbrella in various styles',
    thumbnail: generateThumbnailSVG('umbrella','#eee'),
    modelFunction: 'createUmbrellaModel',
    defaultOptions: { diameter: 1.0, type: 'reflective_white' },
    availableOptions: [
      { name: 'diameter', type: 'slider', min: 0.6, max: 1.8, step: 0.2, default: 1.0 },
      { name: 'type', type: 'select', options: ['shoot_through','reflective_white','reflective_silver','reflective_gold','parabolic'], default: 'reflective_white' },
      { name: 'withDiffuser', type: 'boolean', default: false },
    ],
    tags: ['umbrella','reflector','portable'],
  },
  {
    id: 'snoot',
    name: 'Snoot',
    category: 'modifiers',
    subcategory: 'Control',
    description: 'Conical snoot for focused light beam',
    thumbnail: generateThumbnailSVG('softbox','#1a1a1a'),
    modelFunction: 'createSnootModel',
    defaultOptions: { length: 0.2, withGrid: false },
    tags: ['snoot','control','spot'],
  },
  {
    id: 'barn_doors',
    name: 'Barn Doors',
    category: 'modifiers',
    subcategory: 'Control',
    description: 'Adjustable barn door set for light control',
    thumbnail: generateThumbnailSVG('softbox','#1a1a1a'),
    modelFunction: 'createBarnDoorsModel',
    defaultOptions: { style: '4_leaf', openAngle: 45 },
    tags: ['barn doors','control','flag'],
  },
  {
    id: 'gel_frame',
    name: 'Gel Frame',
    category: 'modifiers',
    subcategory: 'Color',
    description: 'Color gel filter frame',
    thumbnail: generateThumbnailSVG('softbox','#4488ff'),
    modelFunction: 'createGelFrameModel',
    defaultOptions: { color: 'ctb' },
    availableOptions: [
      { name: 'color', type: 'select', options: ['ctb','cto','red','blue','green','magenta','yellow','nd','diffusion'], default: 'ctb' },
    ],
    tags: ['gel','color','filter'],
  },
  {
    id: 'gobo',
    name: 'Gobo / Cookie',
    category: 'modifiers',
    subcategory: 'Pattern',
    description: 'Pattern projection gobo',
    thumbnail: generateThumbnailSVG('ring_light','#333'),
    modelFunction: 'createGoboModel',
    defaultOptions: { pattern: 'window' },
    availableOptions: [
      { name: 'pattern', type: 'select', options: ['window','blinds','leaves','breakup'], default: 'window' },
    ],
    tags: ['gobo','cookie','pattern','shadow'],
  },
  
  // ===== CAMERA & MOTION =====
  {
    id: 'slider',
    name: 'Camera Slider',
    category: 'camera_motion',
    subcategory: 'Sliders',
    description: 'Smooth camera slider for tracking shots',
    thumbnail: generateThumbnailSVG('slider','#1a1a1a'),
    modelFunction: 'createSliderModel',
    defaultOptions: { length: 0.8, style: 'basic', withLegs: true },
    availableOptions: [
      { name: 'length', type: 'slider', min: 0.4, max: 1.5, step: 0.1, default: 0.8 },
      { name: 'style', type: 'select', options: ['basic','motorized','crank'], default: 'basic' },
      { name: 'withLegs', type: 'boolean', default: true },
    ],
    tags: ['slider','tracking','motion'],
    featured: true,
  },
  {
    id: 'dolly',
    name: 'Camera Dolly',
    category: 'camera_motion',
    subcategory: 'Dollies',
    description: 'Wheeled camera dolly for smooth movement',
    thumbnail: generateThumbnailSVG('dolly','#aaa'),
    modelFunction: 'createDollyModel',
    defaultOptions: { style: 'doorway' },
    availableOptions: [
      { name: 'style', type: 'select', options: ['doorway','track','skateboard','bazooka'], default: 'doorway' },
      { name: 'withSeat', type: 'boolean', default: false },
      { name: 'withJibArm', type: 'boolean', default: false },
    ],
    tags: ['dolly','tracking','wheels'],
  },
  {
    id: 'jib',
    name: 'Jib / Crane',
    category: 'camera_motion',
    subcategory: 'Jibs',
    description: 'Camera jib arm for sweeping shots',
    thumbnail: generateThumbnailSVG('jib','#aaa'),
    modelFunction: 'createJibModel',
    defaultOptions: { armLength: 1.5, style: 'basic' },
    availableOptions: [
      { name: 'armLength', type: 'slider', min: 1.0, max: 3.0, step: 0.5, default: 1.5 },
      { name: 'style', type: 'select', options: ['basic','professional','mini'], default: 'basic' },
      { name: 'withCounterweight', type: 'boolean', default: true },
      { name: 'withMonitor', type: 'boolean', default: false },
    ],
    tags: ['jib','crane','sweep'],
  },
  {
    id: 'gimbal',
    name: 'Gimbal Stabilizer',
    category: 'camera_motion',
    subcategory: 'Stabilizers',
    description: '3-axis gimbal for handheld stabilization',
    thumbnail: generateThumbnailSVG('gimbal','#1a1a1a'),
    modelFunction: 'createGimbalModel',
    defaultOptions: { size: 'medium', brand: 'dji' },
    availableOptions: [
      { name: 'size', type: 'select', options: ['small','medium','large'], default: 'medium' },
      { name: 'brand', type: 'select', options: ['dji','zhiyun','generic'], default: 'dji' },
    ],
    tags: ['gimbal','stabilizer','handheld'],
  },
  {
    id: 'camera_cage',
    name: 'Camera Cage',
    category: 'camera_motion',
    subcategory: 'Rigs',
    description: 'Protective cage with mounting points',
    thumbnail: generateThumbnailSVG('gimbal','#1a1a1a'),
    modelFunction: 'createCameraCageModel',
    defaultOptions: { size: 'medium', withTopHandle: true },
    tags: ['cage','rig','mounting'],
  },
  {
    id: 'follow_focus',
    name: 'Follow Focus',
    category: 'camera_motion',
    subcategory: 'Accessories',
    description: 'Manual or wireless follow focus system',
    thumbnail: generateThumbnailSVG('gimbal','#1a1a1a'),
    modelFunction: 'createFollowFocusModel',
    defaultOptions: { style: 'manual', withWhipHandle: true },
    tags: ['follow focus','focus','lens control'],
  },
  {
    id: 'matte_box',
    name: 'Matte Box',
    category: 'camera_motion',
    subcategory: 'Accessories',
    description: 'Cinema matte box with filter slots',
    thumbnail: generateThumbnailSVG('monitor','#1a1a1a'),
    modelFunction: 'createMatteBoxModel',
    defaultOptions: { style: '4x5.65', filterSlots: 2 },
    tags: ['matte box','filter','cinema'],
  },
  
  // ===== AUDIO =====
  {
    id: 'boom_pole',
    name: 'Boom Pole',
    category: 'audio',
    subcategory: 'Poles',
    description: 'Telescoping boom pole with shock mount',
    thumbnail: generateThumbnailSVG('boom_pole','#1a1a1a'),
    modelFunction: 'createBoomPoleModel',
    defaultOptions: { length: 2.5, withMic: true },
    availableOptions: [
      { name: 'length', type: 'slider', min: 1.5, max: 4.0, step: 0.5, default: 2.5 },
      { name: 'style', type: 'select', options: ['carbon_fiber','aluminum'], default: 'carbon_fiber' },
      { name: 'withMic', type: 'boolean', default: true },
    ],
    tags: ['boom','pole','film sound'],
    featured: true,
  },
  {
    id: 'mic_stand',
    name: 'Microphone Stand',
    category: 'audio',
    subcategory: 'Stands',
    description: 'Adjustable microphone stand',
    thumbnail: generateThumbnailSVG('mic_stand','#1a1a1a'),
    modelFunction: 'createMicStandModel',
    defaultOptions: { height: 1.5, style: 'tripod', withBoom: true },
    availableOptions: [
      { name: 'style', type: 'select', options: ['tripod','round_base','desk','overhead'], default: 'tripod' },
      { name: 'withBoom', type: 'boolean', default: true },
    ],
    tags: ['mic stand','microphone','recording'],
  },
  {
    id: 'shotgun_mic',
    name: 'Shotgun Microphone',
    category: 'audio',
    subcategory: 'Microphones',
    description: 'Directional shotgun microphone',
    thumbnail: generateThumbnailSVG('boom_pole','#333'),
    modelFunction: 'createShotgunMicModel',
    defaultOptions: { brand: 'rode', withWindscreen: true },
    tags: ['shotgun','microphone','directional'],
  },
  {
    id: 'lavalier',
    name: 'Lavalier Microphone',
    category: 'audio',
    subcategory: 'Microphones',
    description: 'Clip-on lavalier with wireless transmitter',
    thumbnail: generateThumbnailSVG('boom_pole','#333'),
    modelFunction: 'createLavalierModel',
    defaultOptions: { style: 'clip', withTransmitter: true },
    tags: ['lavalier','lapel','wireless'],
  },
  {
    id: 'audio_recorder',
    name: 'Audio Recorder',
    category: 'audio',
    subcategory: 'Recorders',
    description: 'Portable audio recorder',
    thumbnail: generateThumbnailSVG('monitor','#1a1a1a'),
    modelFunction: 'createAudioRecorderModel',
    defaultOptions: { style: 'portable', brand: 'zoom' },
    tags: ['recorder','audio','portable'],
  },
  {
    id: 'headphones',
    name: 'Headphones',
    category: 'audio',
    subcategory: 'Monitoring',
    description: 'Studio monitoring headphones',
    thumbnail: generateThumbnailSVG('headphones','#1a1a1a'),
    modelFunction: 'createHeadphonesModel',
    defaultOptions: { style: 'over_ear', brand: 'sony' },
    tags: ['headphones','monitoring','audio'],
  },
  {
    id: 'pop_filter',
    name: 'Pop Filter',
    category: 'audio',
    subcategory: 'Accessories',
    description: 'Plosive pop filter for vocal recording',
    thumbnail: generateThumbnailSVG('ring_light','#333'),
    modelFunction: 'createPopFilterModel',
    defaultOptions: { style: 'mesh' },
    tags: ['pop filter','vocal','recording'],
  },
  
  // ===== FURNITURE =====
  {
    id: 'posing_stool',
    name: 'Posing Stool',
    category: 'furniture',
    subcategory: 'Seating',
    description: 'Adjustable posing stool for portraits',
    thumbnail: generateThumbnailSVG('stool','#333'),
    modelFunction: 'createPosingStoolModel',
    defaultOptions: { height: 0.6, style: 'round' },
    availableOptions: [
      { name: 'height', type: 'slider', min: 0.4, max: 0.8, step: 0.1, default: 0.6 },
      { name: 'style', type: 'select', options: ['round','saddle','backless'], default: 'round' },
    ],
    tags: ['stool','posing','portrait'],
    featured: true,
  },
  {
    id: 'director_chair',
    name: "Director's Chair",
    category: 'furniture',
    subcategory: 'Seating',
    description: 'Classic folding director chair',
    thumbnail: generateThumbnailSVG('director_chair','#4a3728'),
    modelFunction: 'createDirectorChairModel',
    defaultOptions: { withArmrests: true },
    tags: ['director','chair','folding'],
  },
  {
    id: 'makeup_station',
    name: 'Makeup Station',
    category: 'furniture',
    subcategory: 'Stations',
    description: 'Vanity table with mirror and lights',
    thumbnail: generateThumbnailSVG('monitor','#8b7355'),
    modelFunction: 'createMakeupStationModel',
    defaultOptions: { withMirror: true, lightCount: 6 },
    tags: ['makeup','vanity','mirror'],
  },
  {
    id: 'wardrobe_rack',
    name: 'Wardrobe Rack',
    category: 'furniture',
    subcategory: 'Storage',
    description: 'Rolling wardrobe rack',
    thumbnail: generateThumbnailSVG('c_stand','#ccc'),
    modelFunction: 'createWardrobeRackModel',
    defaultOptions: { width: 1.2, withWheels: true },
    tags: ['wardrobe','rack','clothes'],
  },
  {
    id: 'couch',
    name: 'Couch / Sofa',
    category: 'furniture',
    subcategory: 'Seating',
    description: 'Modern sofa for set design',
    thumbnail: generateThumbnailSVG('dolly','#333'),
    modelFunction: 'createCouchModel',
    defaultOptions: { style: 'modern', seats: 3 },
    tags: ['couch','sofa','seating'],
  },
  {
    id: 'desk',
    name: 'Desk',
    category: 'furniture',
    subcategory: 'Tables',
    description: 'Office desk with drawers',
    thumbnail: generateThumbnailSVG('dolly','#8b7355'),
    modelFunction: 'createDeskModel',
    defaultOptions: { style: 'modern', withDrawers: true },
    tags: ['desk','office','table'],
  },
  {
    id: 'plant',
    name: 'Decorative Plant',
    category: 'furniture',
    subcategory: 'Props',
    description: 'Indoor plant for set dressing',
    thumbnail: generateThumbnailSVG('stool','#228b22'),
    modelFunction: 'createPlantModel',
    defaultOptions: { type: 'fiddle_leaf', potStyle: 'ceramic' },
    tags: ['plant','decor','prop'],
  },
  
  // ===== VIDEO PRODUCTION =====
  {
    id: 'teleprompter',
    name: 'Teleprompter',
    category: 'video_production',
    subcategory: 'Teleprompting',
    description: 'Beam-splitter teleprompter with hood',
    thumbnail: generateThumbnailSVG('teleprompter','#1a1a1a'),
    modelFunction: 'createTeleprompterModel',
    defaultOptions: { size: 'medium', withHood: true },
    tags: ['teleprompter','prompter','speech'],
    featured: true,
  },
  {
    id: 'monitor',
    name: 'Field Monitor',
    category: 'video_production',
    subcategory: 'Monitors',
    description: 'On-camera field monitor',
    thumbnail: generateThumbnailSVG('monitor','#1a1a1a'),
    modelFunction: 'createMonitorModel',
    defaultOptions: { size: 7, style: 'field' },
    availableOptions: [
      { name: 'size', type: 'slider', min: 5, max: 17, step: 1, default: 7 },
      { name: 'style', type: 'select', options: ['field','director','client'], default: 'field' },
    ],
    tags: ['monitor','display','video'],
  },
  {
    id: 'clapperboard',
    name: 'Clapperboard',
    category: 'video_production',
    subcategory: 'Accessories',
    description: 'Film slate / clapperboard',
    thumbnail: generateThumbnailSVG('clapperboard','#1a1a1a'),
    modelFunction: 'createClapperboardModel',
    defaultOptions: { style: 'classic' },
    tags: ['clapperboard','slate','film'],
  },
  {
    id: 'cart',
    name: 'Equipment Cart',
    category: 'video_production',
    subcategory: 'Transport',
    description: 'Rolling equipment cart',
    thumbnail: generateThumbnailSVG('dolly','#aaa'),
    modelFunction: 'createCartModel',
    defaultOptions: { style: 'utility', shelves: 3 },
    tags: ['cart','transport','utility'],
  },
  {
    id: 'power_distro',
    name: 'Power Distribution',
    category: 'video_production',
    subcategory: 'Power',
    description: 'Power distribution box',
    thumbnail: generateThumbnailSVG('monitor','#1a1a1a'),
    modelFunction: 'createPowerDistroModel',
    defaultOptions: { outlets: 6, style: 'box' },
    tags: ['power','distribution','electrical'],
  },
  
  // ===== EFFECTS =====
  {
    id: 'haze_machine',
    name: 'Haze Machine',
    category: 'effects',
    subcategory: 'Atmosphere',
    description: 'Atmospheric haze machine',
    thumbnail: generateThumbnailSVG('haze_machine','#1a1a1a'),
    modelFunction: 'createHazeMachineModel',
    defaultOptions: { style: 'hazer', size: 'medium' },
    availableOptions: [
      { name: 'style', type: 'select', options: ['hazer','fogger','low_fog'], default: 'hazer' },
      { name: 'size', type: 'select', options: ['small','medium','large'], default: 'medium' },
    ],
    tags: ['haze','fog','atmosphere'],
    featured: true,
  },
  {
    id: 'fan',
    name: 'Wind Fan',
    category: 'effects',
    subcategory: 'Wind',
    description: 'Wind machine / fan',
    thumbnail: generateThumbnailSVG('fan','#1a1a1a'),
    modelFunction: 'createFanModel',
    defaultOptions: { size: 0.5, style: 'drum' },
    availableOptions: [
      { name: 'size', type: 'slider', min: 0.3, max: 1.0, step: 0.1, default: 0.5 },
      { name: 'style', type: 'select', options: ['box','drum','wind_machine'], default: 'drum' },
    ],
    tags: ['fan','wind','effect'],
  },
  {
    id: 'rain_rig',
    name: 'Rain Rig',
    category: 'effects',
    subcategory: 'Water',
    description: 'Overhead rain effect rig',
    thumbnail: generateThumbnailSVG('c_stand','#555'),
    modelFunction: 'createRainRigModel',
    defaultOptions: { width: 2, style: 'overhead' },
    tags: ['rain','water','effect'],
  },
  {
    id: 'mirror_board',
    name: 'Mirror Board',
    category: 'effects',
    subcategory: 'Reflectors',
    description: 'Hard or soft mirror board for light redirection',
    thumbnail: generateThumbnailSVG('softbox','#eee'),
    modelFunction: 'createMirrorBoardModel',
    defaultOptions: { size: 'medium', style: 'hard' },
    tags: ['mirror','reflector','bounce'],
  },
  
  // ===== GRIP =====
  {
    id: 'c_stand',
    name: 'C-Stand',
    category: 'grip',
    subcategory: 'Stands',
    description: 'Century stand with arm and knuckle',
    thumbnail: generateThumbnailSVG('c_stand','#aaa'),
    modelFunction: 'createCStandModel',
    defaultOptions: { height: 2.5, withArm: true },
    tags: ['c-stand','century','stand'],
    featured: true,
  },
  {
    id: 'light_stand',
    name: 'Light Stand',
    category: 'grip',
    subcategory: 'Stands',
    description: 'Standard light stand',
    thumbnail: generateThumbnailSVG('tripod','#1a1a1a'),
    modelFunction: 'createLightStandModel',
    defaultOptions: { maxHeight: 2.5 },
    tags: ['light stand','stand'],
  },
  {
    id: 'tripod',
    name: 'Camera Tripod',
    category: 'grip',
    subcategory: 'Support',
    description: 'Tripod with fluid head',
    thumbnail: generateThumbnailSVG('tripod','#1a1a1a'),
    modelFunction: 'createTripodModel',
    defaultOptions: { style: 'video', withHead: true },
    tags: ['tripod','support','camera'],
  },
  {
    id: 'mafer_clamp',
    name: 'Mafer Clamp',
    category: 'grip',
    subcategory: 'Clamps',
    description: 'Super clamp with stud',
    thumbnail: generateThumbnailSVG('clamp','#1a1a1a'),
    modelFunction: 'createMaferClampModel',
    defaultOptions: { withStud: true },
    tags: ['clamp','mafer','super clamp'],
  },
  {
    id: 'cardellini',
    name: 'Cardellini Clamp',
    category: 'grip',
    subcategory: 'Clamps',
    description: 'Cardellini-style end jaw clamp',
    thumbnail: generateThumbnailSVG('clamp','#666'),
    modelFunction: 'createCardelliniClampModel',
    defaultOptions: { style: 'center_jaw' },
    tags: ['clamp','cardellini','jaw'],
  },
  {
    id: 'speed_rail',
    name: 'Speed Rail',
    category: 'grip',
    subcategory: 'Pipe',
    description: 'Aluminum speed rail pipe',
    thumbnail: generateThumbnailSVG('slider','#aaa'),
    modelFunction: 'createSpeedRailModel',
    defaultOptions: { length: 1.2, diameter: 'light' },
    tags: ['speed rail','pipe','aluminum'],
  },
  {
    id: 'grip_head',
    name: 'Grip Head',
    category: 'grip',
    subcategory: 'Heads',
    description: 'Standard grip head',
    thumbnail: generateThumbnailSVG('clamp','#ccc'),
    modelFunction: 'createGripHeadModel',
    defaultOptions: { style: 'standard' },
    tags: ['grip head','head','mounting'],
  },
  {
    id: 'menace_arm',
    name: 'Menace Arm',
    category: 'grip',
    subcategory: 'Arms',
    description: 'Articulating menace arm',
    thumbnail: generateThumbnailSVG('jib','#ccc'),
    modelFunction: 'createMenaceArmModel',
    defaultOptions: { length: 1.0, sections: 3 },
    tags: ['menace arm','articulating','arm'],
  },
];

// ============================================================================
// Component
// ============================================================================

interface EquipmentCatalogProps {
  onAddToScene?: (item: EquipmentItem, options: Record<string, any>, position?: [number, number, number]) => void;
  compact?: boolean;
}

export function EquipmentCatalog({ onAddToScene, compact = false }: EquipmentCatalogProps) {
  // Tablet support
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  // Toast notifications
  const { addToast } = useVirtualStudio();

  // Accessibility
  const { announce, settings: a11ySettings, prefersKeyboard } = useAccessibility();

  const [selectedCategory, setSelectedCategory] = useState<EquipmentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
  
  // Touch state
  const [touchDragItem, setTouchDragItem] = useState<EquipmentItem | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const [itemOptions, setItemOptions] = useState<Record<string, any>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<EquipmentItem | null>(null);

  // Filter equipment based on search and category
  const filteredEquipment = useMemo(() => {
    return EQUIPMENT_CATALOG.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch =
        searchQuery === ', ' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Group by subcategory
  const groupedEquipment = useMemo(() => {
    const groups: Record<string, EquipmentItem[]> = {};
    filteredEquipment.forEach((item) => {
      const key = item.subcategory || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [filteredEquipment]);

  const handleItemClick = useCallback((item: EquipmentItem) => {
    setSelectedItem(item);
    setItemOptions({ ...item.defaultOptions });
  }, []);

  const handleAddItem = useCallback(() => {
    if (selectedItem && onAddToScene) {
      onAddToScene(selectedItem, itemOptions);
      announce(`${selectedItem.name} added to scene`);
      setSelectedItem(null);
    }
  }, [selectedItem, itemOptions, onAddToScene, announce]);

  const handleQuickAdd = useCallback(
    (item: EquipmentItem, e: React.MouseEvent) => {
      e.stopPropagation();
      if (onAddToScene) {
        onAddToScene(item, item.defaultOptions);
        announce(`${item.name} added to scene`);
      }
    },
    [onAddToScene, announce]
  );

  const handleDragStart = useCallback((item: EquipmentItem, e: React.DragEvent) => {
    setDraggedItem(item);
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'equipment',
      item: item,
      options: item.defaultOptions,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);

  // Touch drag handlers for tablets
  const handleTouchStart = useCallback((item: EquipmentItem, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    // Start long press timer for context menu
    const timer = setTimeout(() => {
      // Long press triggers item details
      setSelectedItem(item);
      setItemOptions({ ...item.defaultOptions });
      touchStartPos.current = null;
    }, 500);
    
    setLongPressTimer(timer);
  }, []);

  const handleTouchMove = useCallback((item: EquipmentItem, e: React.TouchEvent) => {
    if (!touchStartPos.current) return;

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);

    // Cancel long press if moved too much
    if (dx > 10 || dy > 10) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      // Start dragging
      setTouchDragItem(item);
    }
  }, [longPressTimer]);

  const handleTouchEnd = useCallback((item: EquipmentItem) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    // If was dragging, trigger add
    if (touchDragItem && onAddToScene) {
      onAddToScene(touchDragItem, touchDragItem.defaultOptions);
    }

    touchStartPos.current = null;
    setTouchDragItem(null);
  }, [longPressTimer, touchDragItem, onAddToScene]);

  const toggleFavorite = useCallback((itemId: string, itemName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        addToast({
          message: `Removed "${itemName}" from favorites`,
          type: 'info',
          duration: 2000,
        });
      } else {
        next.add(itemId);
        addToast({
          message: `Added "${itemName}" to favorites`,
          type: 'success',
          duration: 2000,
        });
      }
      return next;
    });
  }, [addToast]);

  const renderOptionControl = (option: NonNullable<EquipmentItem['availableOptions']>[0]) => {
    const value = itemOptions[option.name] ?? option.default;
    const label = option.name.replace(/([A-Z])/g, ' $1, ').replace(/^./, (str) => str.toUpperCase());
    const unit = option.name.includes('length') || option.name.includes('height') || option.name.includes('diameter') ? 'm' : ', ';

    switch (option.type) {
      case 'select':
        return (
          <FormControl fullWidth size={isTouch ? 'medium' : 'small'} key={option.name}>
            <InputLabel>{label}</InputLabel>
            <Select
              value={value}
              label={label}
              onChange={(e) => setItemOptions((prev) => ({ ...prev, [option.name]: e.target.value }))}
              sx={isTouch ? { minHeight: 48 } : undefined}
            >
              {option.options?.map((opt) => (
                <MenuItem key={opt} value={opt} sx={isTouch ? { minHeight: 48 } : undefined}>
                  {opt.replace(/_/g, ', ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case 'slider':
        return isTouch ? (
          <TouchSlider
            key={option.name}
            label={label}
            value={value}
            onChange={(v) => setItemOptions((prev) => ({ ...prev, [option.name]: v }))}
            min={option.min}
            max={option.max}
            step={option.step}
            valueFormat={(v) => `${v}${unit}`}
            touchSize="medium"
          />
        ) : (
          <Box key={option.name}>
            <Typography variant="caption" color="text.secondary">
              {label}: {value}{unit}
            </Typography>
            <Slider
              value={value}
              min={option.min}
              max={option.max}
              step={option.step}
              onChange={(_, v) => setItemOptions((prev) => ({ ...prev, [option.name]: v }))}
              size="small"
            />
          </Box>
        );
      case 'boolean':
        return (
          <FormControlLabel
            key={option.name}
            control={
              <Switch
                checked={value}
                onChange={(e) => setItemOptions((prev) => ({ ...prev, [option.name]: e.target.checked }))}
                size={isTouch ? 'medium' : 'small'}
              />
            }
            label={label}
            sx={isTouch ? { '& .MuiFormControlLabel-label': { fontSize: '1rem' } } : undefined}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#121212' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Equipment Catalog
        </Typography>

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search equipment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            )}}
          sx={{ mb: 2 }}
        />

        {/* Category tabs */}
        <Tabs
          value={selectedCategory}
          onChange={(_, v) => setSelectedCategory(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, py: 0.5, px: 1.5, fontSize: '0.75rem' }}}
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

        {/* View controls */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {filteredEquipment.length} items
          </Typography>
          <Box>
            <IconButton size="small" onClick={() => setShowFilters(!showFilters)}>
              <FilterList fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
              {viewMode === 'grid' ? <ViewList fontSize="small" /> : <ViewModule fontSize="small" />}
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Equipment Grid/List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {Object.entries(groupedEquipment).map(([subcategory, items]) => (
          <Box key={subcategory} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600}}>
              {subcategory}
            </Typography>
            <Grid container spacing={viewMode === 'grid' ? 1.5 : 1}>
              {items.map((item) => (
                <Grid item xs={viewMode === 'grid' ? 6 : 12} sm={viewMode === 'grid' ? (isTouch ? 6 : 4) : 12} key={item.id}>
                  <Card
                    sx={{
                      bgcolor: '#1e1e1e',
                      cursor: isTouch ? 'pointer' : 'grab',
                      transition: 'all 0.2s',
                      border: '1px solid transparent', '&:hover': {
                        bgcolor: '#252525',
                        borderColor: CATEGORY_INFO[item.category].color,
                        transform: isTouch ? 'none' : 'translateY(-2px)',
                      }, '&:active': isTouch ? {
                        transform: 'scale(0.98)',
                        bgcolor: '#252525',
                      } : undefined,
                      opacity: (draggedItem?.id === item.id || touchDragItem?.id === item.id) ? 0.5 : 1}}
                    draggable={!isTouch}
                    onDragStart={!isTouch ? (e) => handleDragStart(item, e) : undefined}
                    onDragEnd={!isTouch ? handleDragEnd : undefined}
                    onTouchStart={isTouch ? (e) => handleTouchStart(item, e) : undefined}
                    onTouchMove={isTouch ? (e) => handleTouchMove(item, e) : undefined}
                    onTouchEnd={isTouch ? () => handleTouchEnd(item) : undefined}
                  >
                    <CardActionArea onClick={() => handleItemClick(item)}>
                      {viewMode === 'grid' ? (
                        <>
                          <Box sx={{ position: 'relative' }}>
                            <CardMedia
                              component="img"
                              height={compact ? 60 : (isTouch ? 100 : 80)}
                              image={item.thumbnail}
                              alt={item.name}
                              sx={{ bgcolor: '#2a2a2a', objectFit: 'contain', p: 1 }}
                            />
                            {item.featured && (
                              <Chip
                                label="Featured"
                                size="small"
                                sx={{
                                  position: 'absolute',
                                  top: 4,
                                  left: 4,
                                  bgcolor: CATEGORY_INFO[item.category].color,
                                  color: '#fff',
                                  fontSize: isTouch ? '0.7rem' : '0.6rem',
                                  height: isTouch ? 22 : 18}}
                              />
                            )}
                            <TouchIconButton
                              touchSize={isTouch ? 'medium' : 'small'}
                              onClick={(e) => toggleFavorite(item.id, item.name, e as React.MouseEvent)}
                              sx={{ 
                                position: 'absolute', 
                                top: isTouch ? 4 : 2, 
                                right: isTouch ? 4 : 2, 
                                color: favorites.has(item.id) ? '#ffb300' : '#666' 
                              }}
                            >
                              {favorites.has(item.id) ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
                            </TouchIconButton>
                          </Box>
                          <CardContent sx={{ p: isTouch ? 1.5 : 1, '&:last-child': { pb: isTouch ? 1.5 : 1 } }}>
                            <Typography variant={isTouch ? 'body2' : 'caption'} fontWeight={600} noWrap>
                              {item.name}
                            </Typography>
                            {isTouch && (
                              <Typography variant="caption" color="text.secondary" noWrap>
                                Tap to configure, hold to add
                              </Typography>
                            )}
                          </CardContent>
                        </>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', p: isTouch ? 1.5 : 1 }}>
                          <DragIndicator sx={{ color: '#555', mr: 1 }} fontSize="small" />
                          <CardMedia
                            component="img"
                            sx={{ 
                              width: isTouch ? 56 : 40, 
                              height: isTouch ? 56 : 40, 
                              bgcolor: '#2a2a2a', 
                              borderRadius: 1, 
                              mr: 1.5 
                            }}
                            image={item.thumbnail}
                            alt={item.name}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant={isTouch ? 'subtitle2' : 'body2'} fontWeight={600} noWrap>
                              {item.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {item.description}
                            </Typography>
                          </Box>
                          <Tooltip title={isTouch ? ', ' : 'Quick add'} enterDelay={isTouch ? 99999 : 300}>
                            <TouchIconButton 
                              touchSize={isTouch ? 'medium' : 'small'} 
                              onClick={(e) => handleQuickAdd(item, e as React.MouseEvent)}
                            >
                              <Add fontSize="small" />
                            </TouchIconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </Box>

      {/* Item Details Dialog */}
      <Dialog open={!!selectedItem} onClose={() => setSelectedItem(null)} maxWidth="sm" fullWidth>
        {selectedItem && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                component="img"
                src={selectedItem.thumbnail}
                alt={selectedItem.name}
                sx={{ width: 60, height: 60, bgcolor: '#2a2a2a', borderRadius: 1, p: 1 }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">{selectedItem.name}</Typography>
                <Chip
                  label={CATEGORY_INFO[selectedItem.category].label}
                  size="small"
                  sx={{ bgcolor: CATEGORY_INFO[selectedItem.category].color, color: '#fff' }}
                />
              </Box>
              <IconButton onClick={() => setSelectedItem(null)}>
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedItem.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Options
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedItem.availableOptions?.map(renderOptionControl)}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="caption" color="text.secondary">
                Tags: {selectedItem.tags.join('')}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedItem(null)}>Cancel</Button>
              <Button variant="contained" onClick={handleAddItem} startIcon={<Add />}>
                Add to Scene
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

// Export catalog data for use elsewhere
export { EQUIPMENT_CATALOG, CATEGORY_INFO };

export default EquipmentCatalog;

