// @ts-nocheck
/**
 * Equipment Catalog Browser
 * Allows users to browse the equipment database, search for equipment,
 * view manufacturer images, compare equipment, and add to their personal list.
 *
 * CMS MODE: Supports visual editor for adding/editing equipment images
 * - Enabled via URL param: ?cmsMode=true
 * - Or when in development mode
 * - Or when user has admin/editor role
 */

import React, { useState, useMemo, useCallback, useRef, useEffect, useDeferredValue } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  Divider,
  Rating,
  Checkbox,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Search,
  Add,
  CameraAlt,
  Lens,
  FlashOn,
  Headphones,
  Videocam,
  Computer,
  FilterList,
  Close,
  CheckCircle,
  Info,
  Favorite,
  FavoriteBorder,
  PhotoCamera,
  CompareArrows,
  ThumbUp,
  ThumbDown,
  Lightbulb,
  Portrait,
  Landscape,
  Movie,
  SportsSoccer,
  NightlightRound,
  Star,
  EmojiEvents,
  CheckBox,
  CheckBoxOutlineBlank,
  CloudUpload,
  Edit,
  Link as LinkIcon,
  WarningAmber,
  Inventory2,
  CheckCircleOutline,
  ErrorOutline,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import { useVisualEditor } from '../../hooks/useVisualEditor';
import { PHOTO_CAMERA_DATABASE } from '../../data/photo-camera-database';
import { VIDEO_CAMERA_DATABASE } from '../../data/video-camera-database';
import { AUDIO_STORAGE_DEVICE_DATABASE } from '../../data/audio-storage-device-database';
import { MEMORY_CARD_DATABASE, getMemoryCardTypeById } from '../../data/memory-card-database';

// Check if we're in development mode
const IS_DEV_MODE = import.meta.env.MODE === 'development' || process.env.NODE_ENV === 'development';

// Custom hook for CMS mode detection
const useCmsMode = () => {
  const [cmsMode, setCmsMode] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const cmsModeParam = urlParams.get('cmsMode') === 'true';
    const mode = urlParams.get('mode,');
    const isCmsUrl = mode === 'global' || mode === 'profession';

    // Enable CMS mode if:
    // 1. URL has ?cmsMode=true
    // 2. URL has ?mode=global or ?mode=profession
    // 3. We're in development mode
    setCmsMode(cmsModeParam || isCmsUrl || IS_DEV_MODE);
  }, []);

  return cmsMode;
};

const getErrorStatusCode = (error: unknown): number | null => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const prefixedMatch = message.match(/^(\d{3})[:\s]/);
  if (prefixedMatch) return Number(prefixedMatch[1]);
  return null;
};

interface EquipmentCatalogBrowserProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  userId: string;
  roleRoomBranding?: boolean;
  /** When provided, shows a "Legg til i prosjekt" button alongside the
   * normal inventory button so a parent (e.g. EquipmentManagementPanel)
   * can pre-fill its own add-form from the catalog. */
  onAddToProject?: (item: CatalogEquipment) => void;
}

interface CatalogEquipment {
  id: string | number;
  brand: string;
  model: string;
  category: string;
  description?: string;
  specifications?: Record<string, any>;
  images?: string[];
  imageUrl?: string;
  price?: number;
  priceNOK?: number;
  releaseYear?: number;
  mount?: string;
  type?: string;
  norwegianSupplier?: string;
  availability?: string;
  catalogItem?: boolean;
}

type ProViewMode = 'standard' | 'pro';
type SavedViewId = 'all' | 'critical' | 'cine' | 'audio' | 'storage' | 'missing';
type OperationalStatusTone = 'success' | 'warning' | 'error' | 'info';

type SavedViewDefinition = {
  id: SavedViewId;
  label: string;
  description: string;
};

type KeySpecItem = {
  label: string;
  value: string;
};

const CATEGORY_CONFIG = {
  all: { label: 'Alle', icon: FilterList, color: '#666' },
  cameras: { label: 'Kameraer', icon: CameraAlt, color: '#E91E63' },
  lenses: { label: 'Objektiver', icon: Lens, color: '#9C27B0' },
  flash: { label: 'Blits/Lys', icon: FlashOn, color: '#FF9800' },
  audio: { label: 'Lyd', icon: Headphones, color: '#4CAF50' },
  video: { label: 'Video', icon: Videocam, color: '#2196F3' },
  accessories: { label: 'Tilbehør', icon: Computer, color: '#795548' },
};

const PROFESSION_COLORS = {
  photographer: '#FF6B35',
  videographer: '#9C27B0',
  music_producer: '#FF5722',
  vendor: '#2196F3',
};

const CATALOG_PRICE_BY_RANGE: Record<'budget' | 'mid-range' | 'professional' | 'cinema', number> = {
  budget: 9990,
  'mid-range': 21990,
  professional: 44990,
  cinema: 89990,
};

const CATALOG_AUDIO_CATEGORY_PRICE: Record<string, number> = {
  'field-recorder': 8990,
  'mixer-recorder': 39990,
  'pocket-recorder': 2990,
  'wireless-recorder': 5990,
  'on-camera-recorder': 4990,
  'camera-attached-digital-mic': 3490,
  'desktop-production-console': 29990,
};

const parseReleaseYear = (value?: string): number =>
  Number.parseInt(String(value || '').slice(0, 4), 10) || 2026;

const formatAvailabilityLabel = (value?: string): string => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return 'Status ukjent';
  if (normalized === 'available' || normalized === 'på lager') return 'På lager';
  if (normalized === 'limited' || normalized === 'begrenset') return 'Begrenset';
  if (normalized === 'preorder' || normalized === 'forhåndsbestilling') return 'Forhåndsbestilling';
  return String(value);
};

const formatSpecificationKey = (key: string): string => {
  const spaced = key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const SAVED_VIEWS: SavedViewDefinition[] = [
  { id: 'all', label: 'Alle', description: 'Vis alt utstyr' },
  { id: 'critical', label: 'Kritisk', description: 'Kritiske/risiko-poster' },
  { id: 'cine', label: 'Cine', description: 'Cine/video-orientert utstyr' },
  { id: 'audio', label: 'Lyd', description: 'Lydutstyr og lydlagring' },
  { id: 'storage', label: 'Lagring', description: 'Kort, SSD, NAS og lagringsmedier' },
  { id: 'missing', label: 'Mangler data', description: 'Poster med ufullstendige nøkkelfelt' },
];

const EQUIPMENT_CATALOG_PREFERENCES_KEY = 'role-room:equipment-catalog-browser:prefs';

const stringifySpecValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nei';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value);
};

const hasMissingCoreSpecs = (equipment: CatalogEquipment): boolean => {
  const category = String(equipment.category || '').toLowerCase();
  const specs = equipment.specifications || {};
  const values = Object.values(specs).map((value) => stringifySpecValue(value).trim());
  const populatedCount = values.filter(Boolean).length;

  if (category === 'cameras' || category === 'video') {
    const hasSensor = Boolean(stringifySpecValue(specs.sensorSize));
    const hasResolution = Boolean(stringifySpecValue(specs.videoResolution || specs.resolution));
    return !hasSensor || !hasResolution;
  }

  if (category === 'audio') {
    const hasSampleRate = Boolean(stringifySpecValue(specs.maxSampleRateHz));
    const hasChannels = Boolean(stringifySpecValue(specs.channelCount || specs.channels));
    return !hasSampleRate || !hasChannels;
  }

  if (category === 'accessories') {
    const hasStorage = Boolean(stringifySpecValue(specs.capacityGB || specs.maxStorage || specs.storageMedia));
    return !hasStorage;
  }

  return populatedCount < 2;
};

const getOperationalStatus = (
  equipment: CatalogEquipment
): { label: string; tone: OperationalStatusTone; risk: 'Lav' | 'Middels' | 'Høy' } => {
  const availability = formatAvailabilityLabel(equipment.availability);
  const missingSpecs = hasMissingCoreSpecs(equipment);

  if (missingSpecs) {
    return { label: 'Mangler data', tone: 'error', risk: 'Høy' };
  }
  if (availability === 'Forhåndsbestilling') {
    return { label: availability, tone: 'warning', risk: 'Middels' };
  }
  if (availability === 'Begrenset') {
    return { label: availability, tone: 'warning', risk: 'Middels' };
  }
  if (availability === 'På lager') {
    return { label: availability, tone: 'success', risk: 'Lav' };
  }
  return { label: availability, tone: 'info', risk: 'Middels' };
};

const getStatusSx = (tone: OperationalStatusTone) => {
  if (tone === 'success') {
    return {
      color: '#86efac',
      bgcolor: 'rgba(22,163,74,0.16)',
      border: '1px solid rgba(34,197,94,0.45)',
    };
  }
  if (tone === 'warning') {
    return {
      color: '#fde68a',
      bgcolor: 'rgba(217,119,6,0.18)',
      border: '1px solid rgba(245,158,11,0.5)',
    };
  }
  if (tone === 'error') {
    return {
      color: '#fca5a5',
      bgcolor: 'rgba(220,38,38,0.18)',
      border: '1px solid rgba(239,68,68,0.5)',
    };
  }
  return {
    color: '#93c5fd',
    bgcolor: 'rgba(37,99,235,0.15)',
    border: '1px solid rgba(96,165,250,0.45)',
  };
};

const getKeySpecsForEquipment = (equipment: CatalogEquipment): KeySpecItem[] => {
  const category = String(equipment.category || '').toLowerCase();
  const specs = equipment.specifications || {};

  if (category === 'cameras' || category === 'video') {
    const netflix = specs.netflixCertified === true ? 'Ja' : 'Nei';
    return [
      { label: 'Sensor', value: stringifySpecValue(specs.sensorSize) },
      { label: 'Video', value: stringifySpecValue(specs.videoResolution || specs.resolution) },
      { label: 'FPS', value: stringifySpecValue(specs.videoFrameRates || specs.frameRates || specs.continuousFPS) },
      { label: 'Netflix', value: netflix },
    ].filter((spec) => spec.value);
  }

  if (category === 'audio') {
    return [
      { label: 'Kanaler', value: stringifySpecValue(specs.channelCount || specs.channels) },
      { label: 'Samplingsfrekvens', value: stringifySpecValue(specs.maxSampleRateHz) },
      { label: 'Bit depth', value: stringifySpecValue(specs.bitDepth || specs.bitDepthOptions) },
      { label: 'Lagring', value: stringifySpecValue(specs.storageMedia || specs.maxStorage) },
    ].filter((spec) => spec.value);
  }

  if (category === 'accessories') {
    return [
      { label: 'Type', value: stringifySpecValue(specs.cardTypeId || specs.storageMedia || specs.type) },
      { label: 'Kapasitet', value: stringifySpecValue(specs.capacityGB || specs.maxStorage || specs.maxCapacity) },
      { label: 'Les', value: stringifySpecValue(specs.readSpeedMBs || specs.readSpeed) },
      { label: 'Skriv', value: stringifySpecValue(specs.writeSpeedMBs || specs.writeSpeed) },
    ].filter((spec) => spec.value);
  }

  return Object.entries(specs)
    .slice(0, 4)
    .map(([key, value]) => ({ label: formatSpecificationKey(key), value: stringifySpecValue(value) }))
    .filter((spec) => spec.value);
};

const isStorageItem = (equipment: CatalogEquipment): boolean => {
  const category = String(equipment.category || '').toLowerCase();
  if (category === 'accessories') return true;
  const specs = equipment.specifications || {};
  return Boolean(specs.storageMedia || specs.cardTypeId || specs.capacityGB || specs.maxStorage);
};

const isCineItem = (equipment: CatalogEquipment): boolean => {
  const category = String(equipment.category || '').toLowerCase();
  const model = `${equipment.brand} ${equipment.model}`.toLowerCase();
  const specs = equipment.specifications || {};
  if (category === 'video') return true;
  if (specs.netflixCertified === true) return true;
  return /(fx|cine|komodo|ursa|venice|c70|c80|c300|red|arri)/.test(model);
};

const matchesSavedView = (equipment: CatalogEquipment, savedViewId: SavedViewId): boolean => {
  if (savedViewId === 'all') return true;
  if (savedViewId === 'cine') return isCineItem(equipment);
  if (savedViewId === 'audio') return String(equipment.category || '').toLowerCase() === 'audio';
  if (savedViewId === 'storage') return isStorageItem(equipment);
  if (savedViewId === 'missing') return hasMissingCoreSpecs(equipment);
  if (savedViewId === 'critical') {
    const status = getOperationalStatus(equipment);
    return status.risk !== 'Lav';
  }
  return true;
};

const FALLBACK_EXTRA_CATALOG: CatalogEquipment[] = [
  {
    id: 'fallback-canon-rf-24-70-f28',
    brand: 'Canon',
    model: 'RF 24-70mm f/2.8L IS USM',
    category: 'lenses',
    description: 'Pro standardzoom for kommersiell foto/video.',
    specifications: { focalLength: '24-70mm', maxAperture: 'f/2.8', lensType: 'zoom' },
    priceNOK: 30990,
    releaseYear: 2020,
    mount: 'Canon RF',
    availability: 'available',
    norwegianSupplier: 'Foto.no',
  },
  {
    id: 'fallback-sony-fe-70-200-f28-gm2',
    brand: 'Sony',
    model: 'FE 70-200mm f/2.8 GM OSS II',
    category: 'lenses',
    description: 'Pro telezoom for sport og dokumentar.',
    specifications: { focalLength: '70-200mm', maxAperture: 'f/2.8', lensType: 'telezoom' },
    priceNOK: 35990,
    releaseYear: 2021,
    mount: 'Sony E',
    availability: 'available',
    norwegianSupplier: 'Foto.no',
  },
  {
    id: 'fallback-aputure-600d-pro',
    brand: 'Aputure',
    model: 'LS 600d Pro',
    category: 'flash',
    description: 'Kraftig kontinuerlig lys for større sett.',
    specifications: { power: '600W', weatherSealed: true, type: 'COB LED' },
    priceNOK: 23990,
    releaseYear: 2021,
    availability: 'available',
    norwegianSupplier: 'Foto.no',
  },
  {
    id: 'fallback-dji-rs4-pro',
    brand: 'DJI',
    model: 'RS 4 Pro',
    category: 'accessories',
    description: 'Pro gimbal for cine-rigg og videooppsett.',
    specifications: { payloadKg: 4.5, batteryHours: 13, type: 'Gimbal' },
    priceNOK: 12290,
    releaseYear: 2024,
    availability: 'available',
    norwegianSupplier: 'Foto.no',
  },
];

const FALLBACK_CATALOG: CatalogEquipment[] = (() => {
  const photoItems: CatalogEquipment[] = PHOTO_CAMERA_DATABASE.map((camera) => ({
    id: `photo-${camera.id}`,
    brand: camera.brand,
    model: camera.model,
    category: 'cameras',
    description: camera.description,
    specifications: {
      megapixels: camera.megapixels,
      sensorSize: camera.sensorSize,
      isoRange: camera.isoRange,
      burstMode: camera.burstMode,
      autofocusPoints: camera.autofocusPoints,
      videoResolution: (camera.videoResolution || []).join(', '),
      videoFrameRates: (camera.videoFrameRates || []).join(', '),
      logFormats: (camera.logFormats || []).join(', '),
    },
    priceNOK: CATALOG_PRICE_BY_RANGE[camera.priceRange],
    releaseYear: parseReleaseYear(camera.releaseDate),
    mount: camera.mount,
    availability: camera.isDeprecated ? 'limited' : 'available',
    norwegianSupplier: 'Foto.no',
    catalogItem: true,
  }));

  const videoItems: CatalogEquipment[] = VIDEO_CAMERA_DATABASE.map((camera) => ({
    id: `video-${camera.id}`,
    brand: camera.brand,
    model: camera.model,
    category: 'video',
    description: camera.description,
    specifications: {
      sensorSize: camera.sensorSize || '',
      resolution: (camera.resolution || []).join(', '),
      frameRates: (camera.frameRates || []).join(', '),
      logFormats: (camera.logFormats || []).join(', '),
      videoCodecs: (camera.videoCodecs || []).join(', '),
    },
    priceNOK: CATALOG_PRICE_BY_RANGE[camera.priceRange],
    releaseYear: parseReleaseYear(camera.releaseDate),
    mount: camera.mount,
    availability: camera.isDeprecated ? 'limited' : 'available',
    norwegianSupplier: 'Foto.no',
    catalogItem: true,
  }));

  const audioItems: CatalogEquipment[] = AUDIO_STORAGE_DEVICE_DATABASE.map((device) => ({
    id: `audio-${device.id}`,
    brand: device.brand,
    model: device.model,
    category: 'audio',
    description: device.description,
    specifications: {
      storageMedia: device.storageMedia.join(', '),
      maxStorage: device.maxStorage,
      recordingFormats: device.recordingFormats.join(', '),
      maxSampleRateHz: device.maxSampleRateHz,
      bitDepth: device.bitDepthOptions.join(', '),
      channelCount: device.channelCount,
    },
    priceNOK: CATALOG_AUDIO_CATEGORY_PRICE[device.category] ?? 5990,
    releaseYear: device.releaseYear,
    availability: device.isDeprecated ? 'limited' : 'available',
    norwegianSupplier: 'Foto.no',
    catalogItem: true,
  }));

  const memoryCardItems: CatalogEquipment[] = MEMORY_CARD_DATABASE.map((card) => {
    const cardType = getMemoryCardTypeById(card.cardTypeId);
    return {
      id: `memory-${card.id}`,
      brand: card.brand,
      model: `${card.model} ${card.capacity}GB`,
      category: 'accessories',
      description: cardType?.description || `${card.model} minnekort`,
      specifications: {
        cardTypeId: card.cardTypeId,
        capacityGB: card.capacity,
        readSpeedMBs: card.speedRead,
        writeSpeedMBs: card.speedWrite,
        videoClass: cardType?.videoClass || '',
        maxCapacity: cardType?.maxCapacity || '',
      },
      priceNOK: card.priceNOK,
      releaseYear: 2026,
      availability: 'available',
      norwegianSupplier: 'Foto.no',
      catalogItem: true,
    };
  });

  const merged = new Map<string, CatalogEquipment>();
  [...FALLBACK_EXTRA_CATALOG, ...photoItems, ...videoItems, ...audioItems, ...memoryCardItems].forEach((item) => {
    merged.set(String(item.id), item);
  });

  return Array.from(merged.values()).sort((a, b) => {
    const yearDiff = Number(b.releaseYear || 0) - Number(a.releaseYear || 0);
    if (yearDiff !== 0) return yearDiff;
    const brandDiff = String(a.brand || '').localeCompare(String(b.brand || ''), 'nb');
    if (brandDiff !== 0) return brandDiff;
    return String(a.model || '').localeCompare(String(b.model || ''), 'nb');
  });
})();

const BRANDS = [
  'Alle',
  ...Array.from(new Set(FALLBACK_CATALOG.map((item) => String(item.brand || '').trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, 'nb')
  ),
];

// Use case configurations for equipment recommendations
const USE_CASES = {
  portrait: { label: 'Portrett', icon: Portrait, color: '#E91E63', description: 'Portrettfotografering' },
  landscape: { label: 'Landskap', icon: Landscape, color: '#4CAF50', description: 'Landskapsfotografering' },
  video: { label: 'Video', icon: Movie, color: '#9C27B0', description: 'Videoproduksjon' },
  sports: { label: 'Sport', icon: SportsSoccer, color: '#FF9800', description: 'Sport og action' },
  lowlight: { label: 'Lite lys', icon: NightlightRound, color: '#3F51B5', description: 'Fotografering i lite lys' },
  studio: { label: 'Studio', icon: FlashOn, color: '#795548', description: 'Studiofotografering' },
  travel: { label: 'Reise', icon: Landscape, color: '#00BCD4', description: 'Reisefotografering' },
  wedding: { label: 'Bryllup', icon: Favorite, color: '#F06292', description: 'Bryllupsfotografering' },
  wildlife: { label: 'Natur', icon: PhotoCamera, color: '#8BC34A', description: 'Naturfotografering' },
};

// Helper function to determine use cases for equipment based on specs
const getEquipmentUseCases = (equipment: CatalogEquipment): string[] => {
  const useCases: string[] = [];
  const specs = equipment.specifications || {};
  const model = equipment.model.toLowerCase();
  const category = equipment.category?.toLowerCase() || '';

  // Camera use cases
  if (category.includes('camera,')) {
    if (specs.maxISO >= 51200 || model.includes('s5') || model.includes('a7s')) {
      useCases.push('lowlight','video');
    }
    if (specs.continuousFPS >= 10 || model.includes('r3') || model.includes('a9') || model.includes('z9')) {
      useCases.push('sports','wildlife');
    }
    if (specs.resolution >= 40 || model.includes('r5') || model.includes('a7r') || model.includes('z8')) {
      useCases.push('landscape','studio','portrait');
    }
    if (specs.videoResolution?.includes('8K') || specs.videoResolution?.includes('6K')) {
      useCases.push('video');
    }
  }

  // Lens use cases
  if (category.includes('lens')) {
    const focalLength = specs.focalLength || model;
    const aperture = specs.maxAperture || 0;

    if (focalLength.includes('85') || focalLength.includes('50') || focalLength.includes('35')) {
      if (aperture <= 1.8) useCases.push('portrait','lowlight');
    }
    if (focalLength.includes('70-200') || focalLength.includes('100-400') || focalLength.includes('200-600')) {
      useCases.push('sports','wildlife','portrait');
    }
    if (focalLength.includes('14') || focalLength.includes('16-35') || focalLength.includes('12-24')) {
      useCases.push('landscape','travel');
    }
    if (focalLength.includes('24-70') || focalLength.includes('24-105')) {
      useCases.push('wedding','travel','video');
    }
  }

  // Default to general use if no specific cases found
  if (useCases.length === 0) {
    useCases.push('travel');
  }

  return [...new Set(useCases)]; // Remove duplicates
};

// Helper function to generate "why choose this" recommendations
const getWhyChooseThis = (equipment: CatalogEquipment): { pros: string[]; cons: string[]; bestFor: string } => {
  const specs = equipment.specifications || {};
  const model = equipment.model.toLowerCase();
  const brand = equipment.brand;
  const category = equipment.category?.toLowerCase() || '';

  const pros: string[] = [];
  const cons: string[] = [];
  let bestFor = 'Generell bruk';

  // Brand-specific traits
  if (brand === 'Sony') {
    pros.push('Utmerket autofokus med øyesporing');
    pros.push('Kompakt speilløs design');
    if (model.includes('a7s')) {
      pros.push('Bransjens beste lavlysytelse');
      bestFor = 'Video og fotografering i lite lys';
    }
  } else if (brand === 'Canon') {
    pros.push('Intuitiv brukergrensesnitt');
    pros.push('Bredt utvalg av objektiver');
    if (model.includes('r5') || model.includes('r3')) {
      pros.push('Profesjonell bildekvalitet');
      bestFor = 'Profesjonell foto og video';
    }
  } else if (brand === 'Nikon') {
    pros.push('Robust byggekvalitet');
    pros.push('Utmerket ergonomi');
    if (model.includes('z8') || model.includes('z9')) {
      pros.push('Ingen blackout ved fotografering');
      bestFor = 'Sport og actionfotografering';
    }
  } else if (brand === 'Fujifilm') {
    pros.push('Unike filmsimuleringer');
    pros.push('Retro design med moderne teknologi');
    bestFor = 'Street- og portrettfotografering';
  }

  // Spec-based pros/cons
  if (specs.resolution >= 40) {
    pros.push(`Høy oppløsning (${specs.resolution}MP) for store utskrifter`);
    cons.push('Større filstørrelser krever mer lagringsplass');
  }
  if (specs.maxISO >= 51200) {
    pros.push('Utmerket høy-ISO ytelse');
  }
  if (specs.continuousFPS >= 15) {
    pros.push(`Rask seriefotografering (${specs.continuousFPS} fps)`);
  }
  if (specs.inBodyStabilization) {
    pros.push('Innebygd bildestabilisering');
  }
  if (specs.weight > 800) {
    cons.push('Relativt tungt for håndholdt bruk');
  }
  if (specs.weatherSealed) {
    pros.push('Værbestandig konstruksjon');
  }

  // Price considerations
  if (equipment.priceNOK && equipment.priceNOK > 50000) {
    cons.push('Premium prissetting');
  } else if (equipment.priceNOK && equipment.priceNOK < 15000) {
    pros.push('Godt priset for funksjonaliteten');
  }

  return { pros: pros.slice(0, 5), cons: cons.slice(0, 3), bestFor };
};

// Helper function to compare two equipment items
const compareEquipment = (eq1: CatalogEquipment, eq2: CatalogEquipment): { winner: string; reason: string }[] => {
  const comparisons: { winner: string; reason: string }[] = [];
  const specs1 = eq1.specifications || {};
  const specs2 = eq2.specifications || {};

  // Compare resolution
  if (specs1.resolution && specs2.resolution) {
    const winner = specs1.resolution > specs2.resolution ? eq1.brand : eq2.brand;
    const higher = Math.max(specs1.resolution, specs2.resolution);
    const lower = Math.min(specs1.resolution, specs2.resolution);
    comparisons.push({ winner, reason: `${higher}MP vs ${lower}MP oppløsning` });
  }

  // Compare ISO
  if (specs1.maxISO && specs2.maxISO) {
    const winner = specs1.maxISO > specs2.maxISO ? eq1.brand : eq2.brand;
    comparisons.push({ winner, reason: `Bedre høy-ISO ytelse` });
  }

  // Compare FPS
  if (specs1.continuousFPS && specs2.continuousFPS) {
    const winner = specs1.continuousFPS > specs2.continuousFPS ? eq1.brand : eq2.brand;
    const higher = Math.max(specs1.continuousFPS, specs2.continuousFPS);
    comparisons.push({ winner, reason: `${higher} fps seriefoto` });
  }

  // Compare price
  if (eq1.priceNOK && eq2.priceNOK) {
    const winner = eq1.priceNOK < eq2.priceNOK ? eq1.brand : eq2.brand;
    const savings = Math.abs(eq1.priceNOK - eq2.priceNOK);
    comparisons.push({ winner, reason: `${savings.toLocaleString()} NOK billigere` });
  }

  // Compare weight
  if (specs1.weight && specs2.weight) {
    const winner = specs1.weight < specs2.weight ? eq1.brand : eq2.brand;
    comparisons.push({ winner, reason: `Lettere og mer portabel` });
  }

  return comparisons;
};

const EquipmentCatalogBrowser: React.FC<EquipmentCatalogBrowserProps> = ({
  profession,
  onAddToProject,
  userId,
  roleRoomBranding = false,
}) => {
  const theming = useTheming(profession);
  const professionColor = PROFESSION_COLORS[profession];
  const queryClient = useQueryClient();
  const catalogGridSpacing = roleRoomBranding ? { xs: 1.5, md: 2 } : 3;
  const roleRoomPanelSx = roleRoomBranding
    ? {
        p: { xs: 2, md: 3 },
        borderRadius: 3,
        border: '1px solid rgba(148,163,184,0.24)',
        background: 'linear-gradient(160deg, rgba(2,6,23,0.82) 0%, rgba(15,23,42,0.7) 48%, rgba(30,41,59,0.58) 100%)',
        boxShadow: '0 14px 32px rgba(2,6,23,0.32)',
      }
    : {};
  const roleRoomControlSx = roleRoomBranding
    ? {
        '& .MuiInputBase-root': {
          color: '#e2e8f0',
          bgcolor: 'rgba(15,23,42,0.72)',
          borderRadius: 1.5,
        },
        '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.68)' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.35)' },
        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: 'rgba(192,132,252,0.6)',
        },
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: '#c084fc',
        },
        '& .MuiSvgIcon-root': { color: 'rgba(226,232,240,0.62)' },
      }
    : {};

  // CMS mode detection - allows image editing in CMS/dev mode
  const cmsMode = useCmsMode();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('Alle');
  const [viewMode, setViewMode] = useState<ProViewMode>(roleRoomBranding ? 'pro' : 'standard');
  const [savedViewId, setSavedViewId] = useState<SavedViewId>('all');
  const [catalogMode, setCatalogMode] = useState<'checking' | 'api' | 'fallback'>('checking');
  const [selectedEquipment, setSelectedEquipment] = useState<CatalogEquipment | null>(null);
  const [showAllSpecifications, setShowAllSpecifications] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: ', ', severity: 'success' as 'success' | 'error' | 'info' });
  const [favorites, setFavorites] = useState<Set<string | number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(48);

  // Comparison state
  const [compareMode, setCompareMode] = useState(false);
  const [compareList, setCompareList] = useState<CatalogEquipment[]>([]);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // CMS mode image upload state
  const [imageUploadDialog, setImageUploadDialog] = useState<{ open: boolean; equipment: CatalogEquipment | null }>({ open: false, equipment: null });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);
  const prefsHydratedRef = useRef(false);
  const lastPersistedPrefsRef = useRef('');

  // Visual editor for CMS mode
  const visualEditor = useVisualEditor();

  useEffect(() => {
    setShowAllSpecifications(false);
  }, [selectedEquipment?.id]);

  useEffect(() => {
    let cancelled = false;

    const applyPreferences = (prefs: unknown): boolean => {
      if (!prefs || typeof prefs !== 'object') return false;
      const value = prefs as Record<string, unknown>;
      let applied = false;

      if (value.viewMode === 'pro' || value.viewMode === 'standard') {
        setViewMode(value.viewMode);
        applied = true;
      }

      const validSavedViewIds = new Set<SavedViewId>(SAVED_VIEWS.map((entry) => entry.id));
      if (typeof value.savedViewId === 'string' && validSavedViewIds.has(value.savedViewId as SavedViewId)) {
        setSavedViewId(value.savedViewId as SavedViewId);
        applied = true;
      }

      if (typeof value.selectedUseCase === 'string') {
        setSelectedUseCase(value.selectedUseCase);
        applied = true;
      } else if (value.selectedUseCase === null) {
        setSelectedUseCase(null);
        applied = true;
      }

      return applied;
    };

    const hydratePreferences = async () => {
      const normalizedUserId = String(userId || 'default-user').trim() || 'default-user';
      let applied = false;

      try {
        const response = await apiRequest(
          `/api/user/ui-preferences?user_id=${encodeURIComponent(normalizedUserId)}`
        ) as { data?: Record<string, unknown> };

        const backendPrefs =
          response?.data?.equipment_catalog_browser ??
          response?.data?.equipmentCatalogBrowser;

        applied = applyPreferences(backendPrefs);
      } catch {
        applied = false;
      }

      if (!applied) {
        try {
          const raw = localStorage.getItem(`${EQUIPMENT_CATALOG_PREFERENCES_KEY}:${normalizedUserId}`);
          if (raw) {
            applied = applyPreferences(JSON.parse(raw));
          }
        } catch {
          applied = false;
        }
      }

      if (!cancelled) {
        prefsHydratedRef.current = true;
      }
    };

    hydratePreferences();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!prefsHydratedRef.current) return;

    const normalizedUserId = String(userId || 'default-user').trim() || 'default-user';
    const payload = {
      viewMode,
      savedViewId,
      selectedUseCase,
      updatedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastPersistedPrefsRef.current) return;
    lastPersistedPrefsRef.current = serialized;

    try {
      localStorage.setItem(`${EQUIPMENT_CATALOG_PREFERENCES_KEY}:${normalizedUserId}`, serialized);
    } catch {
      // Ignore localStorage write issues.
    }

    const timer = window.setTimeout(() => {
      void apiRequest(`/api/user/ui-preferences?user_id=${encodeURIComponent(normalizedUserId)}`, {
        method: 'PUT',
        body: JSON.stringify({
          equipment_catalog_browser: payload,
          equipmentCatalogBrowser: payload,
        }),
      }).catch(() => undefined);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [viewMode, savedViewId, selectedUseCase, userId]);

  // Lightweight health-check so we can stop request loops when API is unavailable.
  useEffect(() => {
    let cancelled = false;

    const runHealthCheck = async () => {
      try {
        await apiRequest('/api/equipment/search?limit=1');
        if (!cancelled) setCatalogMode('api');
      } catch {
        if (!cancelled) setCatalogMode('fallback');
      }
    };

    runHealthCheck();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Fetch equipment catalog
  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['/api/equipment/search', deferredSearchQuery, selectedCategory, selectedBrand],
    enabled: catalogMode === 'api',
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (deferredSearchQuery) params.append('q', deferredSearchQuery);
        if (selectedCategory !== 'all') params.append('category', selectedCategory);
        if (selectedBrand !== 'Alle') params.append('brand', selectedBrand);
        return await apiRequest(`/api/equipment/search?${params.toString()}`);
      } catch (error) {
        const status = getErrorStatusCode(error);
        if (status === 401 || status === 403 || status === 404) {
          setCatalogMode('fallback');
          return { results: [] };
        }
        setCatalogMode('fallback');
        throw error;
      }
    },
    retry: false,
  });

  const fallbackEquipmentList = useMemo(() => {
    const query = deferredSearchQuery.toLowerCase();
    return FALLBACK_CATALOG.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedBrand !== 'Alle' && item.brand !== selectedBrand) return false;
      if (!query) return true;
      const searchable = [
        item.brand,
        item.model,
        item.description || '',
        item.category,
        item.mount || '',
        item.type || '',
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [deferredSearchQuery, selectedBrand, selectedCategory]);

  // Add equipment to user's list mutation
  const addEquipmentMutation = useMutation({
    mutationFn: async (equipment: CatalogEquipment) => {
      return apiRequest('/api/equipment/inventory', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          userId,
          name: `${equipment.brand} ${equipment.model}`,
          brand: equipment.brand,
          model: equipment.model,
          category: equipment.category,
          imageUrl: equipment.imageUrl || equipment.images?.[0],
          specifications: equipment.specifications,
          condition: 'excellent',
          status: 'available',
        }),
      });
    },
    onSuccess: (_, equipment) => {
      setSnackbar({
        open: true,
        message: `✅ ${equipment.brand} ${equipment.model} lagt til i ditt utstyr!`,
        severity: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment/user', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment/inventory', userId] });
      setSelectedEquipment(null);
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: `❌ Kunne ikke legge til, utstyr: ${error}`,
        severity: 'error',
      });
    },
  });

  const baseEquipmentList: CatalogEquipment[] =
    catalogMode === 'api' ? catalogData?.results || catalogData || [] : fallbackEquipmentList;

  const equipmentList = useMemo(
    () =>
      baseEquipmentList.filter((equipment) => {
        if (!matchesSavedView(equipment, savedViewId)) return false;
        if (!selectedUseCase) return true;
        return getEquipmentUseCases(equipment).includes(selectedUseCase);
      }),
    [baseEquipmentList, savedViewId, selectedUseCase]
  );

  const deferredEquipmentList = useDeferredValue(equipmentList);
  const visibleEquipmentList = useMemo(
    () => deferredEquipmentList.slice(0, Math.max(12, visibleCount)),
    [deferredEquipmentList, visibleCount]
  );
  const hasMoreEquipment = deferredEquipmentList.length > visibleCount;

  const operationalMetrics = useMemo(() => {
    let ready = 0;
    let critical = 0;
    let missing = 0;
    let storage = 0;
    let cine = 0;
    deferredEquipmentList.forEach((equipment) => {
      const status = getOperationalStatus(equipment);
      if (status.risk === 'Lav') ready += 1;
      if (status.risk !== 'Lav') critical += 1;
      if (hasMissingCoreSpecs(equipment)) missing += 1;
      if (isStorageItem(equipment)) storage += 1;
      if (isCineItem(equipment)) cine += 1;
    });

    return {
      total: deferredEquipmentList.length,
      ready,
      critical,
      missing,
      storage,
      cine,
    };
  }, [deferredEquipmentList]);

  useEffect(() => {
    setVisibleCount(viewMode === 'pro' ? 48 : 80);
  }, [viewMode, savedViewId, selectedUseCase, selectedCategory, selectedBrand, deferredSearchQuery]);

  const toggleFavorite = (id: string | number) => {
    setFavorites((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getEquipmentIdentity = useCallback(
    (equipment: CatalogEquipment) => `${equipment.id}::${equipment.brand}::${equipment.model}`,
    []
  );

  // Toggle comparison selection
  const toggleCompare = (equipment: CatalogEquipment) => {
    const identity = getEquipmentIdentity(equipment);
    setCompareList((prev) => {
      const isSelected = prev.some((entry) => getEquipmentIdentity(entry) === identity);
      if (isSelected) {
        return prev.filter((entry) => getEquipmentIdentity(entry) !== identity);
      } else if (prev.length < 3) {
        return [...prev, equipment];
      } else {
        setSnackbar({
          open: true,
          message: 'Du kan sammenligne maks 3 produkter samtidig',
          severity: 'info',
        });
        return prev;
      }
    });
  };

  const isInCompareList = (equipment: CatalogEquipment) =>
    compareList.some((entry) => getEquipmentIdentity(entry) === getEquipmentIdentity(equipment));

  const copyEquipmentSummary = useCallback((equipment: CatalogEquipment) => {
    const keySpecs = getKeySpecsForEquipment(equipment)
      .slice(0, 4)
      .map((spec) => `${spec.label}: ${spec.value}`)
      .join('\n');
    const summary = [
      `${equipment.brand} ${equipment.model}`,
      `Kategori: ${equipment.category}`,
      equipment.priceNOK ? `Pris: kr ${equipment.priceNOK.toLocaleString('no-NO')}` : '',
      `Status: ${getOperationalStatus(equipment).label}`,
      keySpecs,
    ]
      .filter(Boolean)
      .join('\n');

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setSnackbar({
        open: true,
        message: '❌ Kunne ikke kopiere spesifikasjoner i denne nettleseren',
        severity: 'error',
      });
      return;
    }

    navigator.clipboard
      .writeText(summary)
      .then(() => {
        setSnackbar({
          open: true,
          message: `✅ Spesifikasjoner kopiert: ${equipment.brand} ${equipment.model}`,
          severity: 'success',
        });
      })
      .catch(() => {
        setSnackbar({
          open: true,
          message: '❌ Kunne ikke kopiere spesifikasjoner',
          severity: 'error',
        });
      });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingContext =
        tagName === 'input' ||
        tagName === 'textarea' ||
        target?.isContentEditable ||
        Boolean(target?.closest('[role="dialog"]'));

      if (isTypingContext) return;

      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (event.key.toLowerCase() === 'q') {
        event.preventDefault();
        setCompareMode((prev) => !prev);
        return;
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSavedViewId((current) => {
          const viewIds = SAVED_VIEWS.map((view) => view.id);
          const currentIndex = viewIds.indexOf(current);
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % viewIds.length;
          return viewIds[nextIndex];
        });
        return;
      }

      if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        const firstVisible = visibleEquipmentList[0];
        if (firstVisible && !addEquipmentMutation.isPending) {
          addEquipmentMutation.mutate(firstVisible);
        }
        return;
      }

      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setSnackbar({
          open: true,
          message: 'ℹ Backup-merking gjøres i Lager/Backup-panelet (3-2-1 flyt)',
          severity: 'info',
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visibleEquipmentList, addEquipmentMutation]);

  // Get comparison results
  const comparisonResults = useMemo(() => {
    if (compareList.length < 2) return null;
    const results: { spec: string; values: { equipment: CatalogEquipment; value: string; isBest: boolean }[] }[] = [];

    // Define specs to compare
    const specsToCompare: Array<{
      key: string;
      label: string;
      format: (value: unknown) => string;
      lower?: boolean;
    }> = [
      {
        key: 'resolution',
        label: 'Oppløsning',
        format: (value) => (typeof value === 'number' ? `${value}MP` : '-'),
      },
      {
        key: 'maxISO',
        label: 'Maks ISO',
        format: (value) => (typeof value === 'number' ? value.toLocaleString() : '-'),
      },
      {
        key: 'continuousFPS',
        label: 'Seriefoto',
        format: (value) => (typeof value === 'number' ? `${value} fps` : '-'),
      },
      {
        key: 'weight',
        label: 'Vekt',
        format: (value) => (typeof value === 'number' ? `${value}g` : '-'),
        lower: true,
      },
      {
        key: 'videoResolution',
        label: 'Video',
        format: (value) => (typeof value === 'string' ? value : '-'),
      },
      {
        key: 'sensorSize',
        label: 'Sensorstørrelse',
        format: (value) => (typeof value === 'string' ? value : '-'),
      },
    ];

    specsToCompare.forEach(({ key, label, format, lower }) => {
      const values = compareList.map((eq) => {
        const val = eq.specifications?.[key];
        return { equipment: eq, rawValue: val, value: val !== undefined && val !== null ? format(val) : '-', isBest: false };
      });

      // Find best value
      const numericValues = values.filter((v) => typeof v.rawValue === 'number').map((v) => v.rawValue);
      if (numericValues.length > 0) {
        const bestVal = lower ? Math.min(...numericValues) : Math.max(...numericValues);
        values.forEach((v) => {
          if (v.rawValue === bestVal) v.isBest = true;
        });
      }

      results.push({ spec: label, values });
    });

    return results;
  }, [compareList]);

  // CMS MODE: Image upload handlers
  const handleOpenImageUpload = useCallback((equipment: CatalogEquipment) => {
    if (!cmsMode) return;
    setImageUploadDialog({ open: true, equipment });
    setImageUrlInput('');
    setImagePreview(null);
  }, [cmsMode]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Preview the image
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleUrlPreview = useCallback(() => {
    if (imageUrlInput) {
      setImagePreview(imageUrlInput);
    }
  }, [imageUrlInput]);

  const handleSaveImage = useCallback(async () => {
    if (!imageUploadDialog.equipment || !imagePreview) return;

    setUploadingImage(true);
    try {
      // Save image via Visual CMS content update API
      await apiRequest('/api/visual-cms/content/update', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          elementId: `equipment-image-${imageUploadDialog.equipment.id}`,
          content: imagePreview,
          type: 'image',
          metadata: {
            equipmentId: imageUploadDialog.equipment.id,
            brand: imageUploadDialog.equipment.brand,
            model: imageUploadDialog.equipment.model,
            category: 'equipment-catalog',
          },
        }),
      });

      // Update local state
      queryClient.invalidateQueries({ queryKey: ['/api/equipment/search'] });

      setSnackbar({
        open: true,
        message: `✅ Bilde lagret for ${imageUploadDialog.equipment.brand} ${imageUploadDialog.equipment.model}`,
        severity: 'success',
      });

      setImageUploadDialog({ open: false, equipment: null });
      setImagePreview(null);
      setImageUrlInput('');
    } catch (error) {
      setSnackbar({
        open: true,
        message: `❌ Kunne ikke lagre, bilde: ${error}`,
        severity: 'error',
      });
    } finally {
      setUploadingImage(false);
    }
  }, [imageUploadDialog.equipment, imagePreview, queryClient]);

  const getEquipmentImage = (eq: CatalogEquipment): string => {
    if (eq.imageUrl) return eq.imageUrl;
    if (eq.images && eq.images.length > 0) return eq.images[0];
    // Return empty string for placeholder handling
    return ', ';
  };

  const hasEquipmentImage = (eq: CatalogEquipment): boolean => {
    return !!(eq.imageUrl || (eq.images && eq.images.length > 0));
  };

  const getPlaceholderImage = (eq: CatalogEquipment): string => {
    const placeholders: Record<string, string> = {
      cameras: 'https://via.placeholder.com/300x200?text=Kamera',
      lenses: 'https://via.placeholder.com/300x200?text=Objektiv',
      flash: 'https://via.placeholder.com/300x200?text=Blits',
      audio: 'https://via.placeholder.com/300x200?text=Lyd',
    };
    return placeholders[eq.category?.toLowerCase()] || 'https://via.placeholder.com/300x200?text=Utstyr';
  };

  const renderEquipmentCard = useCallback((equipment: CatalogEquipment) => {
    const CategoryIcon = CATEGORY_CONFIG[equipment.category?.toLowerCase() as keyof typeof CATEGORY_CONFIG]?.icon || CameraAlt;
    const useCases = getEquipmentUseCases(equipment);
    const isCompareSelected = isInCompareList(equipment);
    const equipmentIdentity = getEquipmentIdentity(equipment);
    const keySpecs = getKeySpecsForEquipment(equipment);
    const status = getOperationalStatus(equipment);
    const compactMode = viewMode === 'pro';

    return (
      <Grid item xs={12} sm={compactMode ? 6 : 6} md={compactMode ? 4 : 4} lg={compactMode ? 3 : 3} key={equipmentIdentity}>
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.26s ease',
            border: roleRoomBranding
              ? isCompareSelected
                ? `2px solid ${professionColor}`
                : '1px solid rgba(148,163,184,0.24)'
              : isCompareSelected
                ? `2px solid ${professionColor}`
                : '1px solid rgba(226,232,240,0.7)',
            background: roleRoomBranding
              ? 'linear-gradient(145deg, rgba(15,23,42,0.84) 0%, rgba(30,41,59,0.72) 100%)'
              : '#fff',
            boxShadow: roleRoomBranding ? '0 10px 24px rgba(2,6,23,0.28)' : '0 6px 16px rgba(15,23,42,0.08)',
            '&:hover': {
              transform: 'translateY(-3px)',
              boxShadow: roleRoomBranding ? '0 16px 34px rgba(76,29,149,0.34)' : '0 12px 24px rgba(15,23,42,0.12)',
              borderColor: roleRoomBranding ? 'rgba(192,132,252,0.48)' : professionColor,
            },
          }}
        >
          {compareMode && (
            <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
              <Checkbox
                checked={isCompareSelected}
                onChange={() => toggleCompare(equipment)}
                icon={<CheckBoxOutlineBlank sx={{ bgcolor: 'white', borderRadius: 0.5 }} />}
                checkedIcon={<CheckBox sx={{ color: professionColor }} />}
              />
            </Box>
          )}
          <Box sx={{ position: 'relative' }}>
            <CardMedia
              component="img"
              height={compactMode ? '150' : '180'}
              image={getEquipmentImage(equipment)}
              alt={`${equipment.brand} ${equipment.model}`}
              sx={{
                objectFit: 'contain',
                bgcolor: roleRoomBranding ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
                p: compactMode ? 1.5 : 2,
              }}
            />
          </Box>
          <CardContent sx={{ flexGrow: 1, pb: compactMode ? 1 : 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
              <Typography variant="subtitle2" sx={{ color: roleRoomBranding ? 'rgba(226,232,240,0.74)' : 'text.secondary' }}>
                {equipment.brand}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleCompare(equipment);
                  }}
                  sx={{ color: isCompareSelected ? professionColor : roleRoomBranding ? '#93c5fd' : '#64748b' }}
                >
                  <CompareArrows fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFavorite(equipment.id);
                  }}
                >
                  {favorites.has(equipment.id) ? <Favorite sx={{ color: '#E91E63' }} /> : <FavoriteBorder />}
                </IconButton>
              </Box>
            </Box>

            <Typography
              variant="h6"
              sx={{
                fontSize: compactMode ? '0.98rem' : '1rem',
                fontWeight: 700,
                mb: 1,
                color: roleRoomBranding ? '#f8fafc' : 'inherit',
                lineHeight: 1.25,
              }}
            >
              {equipment.model}
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
              <Chip
                icon={<CategoryIcon sx={{ fontSize: '0.9rem' }} />}
                label={CATEGORY_CONFIG[equipment.category?.toLowerCase() as keyof typeof CATEGORY_CONFIG]?.label || equipment.category}
                size="small"
                sx={{ fontSize: '0.7rem' }}
              />
              <Chip
                size="small"
                label={status.label}
                icon={
                  status.tone === 'success' ? (
                    <CheckCircleOutline sx={{ fontSize: '0.82rem' }} />
                  ) : status.tone === 'error' ? (
                    <ErrorOutline sx={{ fontSize: '0.82rem' }} />
                  ) : (
                    <WarningAmber sx={{ fontSize: '0.82rem' }} />
                  )
                }
                sx={{ fontSize: '0.7rem', ...getStatusSx(status.tone) }}
              />
              {equipment.mount && <Chip label={equipment.mount} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
              {useCases.slice(0, compactMode ? 2 : 3).map((useCase) => {
                const config = USE_CASES[useCase as keyof typeof USE_CASES];
                if (!config) return null;
                const UseCaseIcon = config.icon;
                return (
                  <Chip
                    key={useCase}
                    icon={<UseCaseIcon sx={{ fontSize: '0.8rem' }} />}
                    label={config.label}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontSize: '0.65rem',
                      borderColor: config.color,
                      color: config.color,
                      '& .MuiChip-icon': { color: config.color },
                    }}
                    onClick={() => setSelectedUseCase(useCase)}
                  />
                );
              })}
            </Box>

            {compactMode && keySpecs.length > 0 && (
              <Box
                sx={{
                  display: 'grid',
                  gap: 0.35,
                  mb: 1,
                  p: 1,
                  borderRadius: 1.2,
                  bgcolor: roleRoomBranding ? 'rgba(2,6,23,0.62)' : 'rgba(241,245,249,0.88)',
                  border: '1px solid rgba(148,163,184,0.22)',
                }}
              >
                {keySpecs.slice(0, 4).map((spec) => (
                  <Box key={spec.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="caption" sx={{ color: roleRoomBranding ? '#94a3b8' : '#475569' }}>
                      {spec.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: roleRoomBranding ? '#e2e8f0' : '#0f172a', fontWeight: 700, textAlign: 'right' }}
                    >
                      {spec.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {equipment.priceNOK && (
              <Typography variant="body2" sx={{ fontWeight: 700, color: professionColor }}>
                kr {equipment.priceNOK.toLocaleString('no-NO')}
              </Typography>
            )}
            {equipment.norwegianSupplier && (
              <Typography variant="caption" sx={{ color: roleRoomBranding ? 'rgba(148,163,184,0.9)' : 'text.secondary' }}>
                Tilgjengelig hos {equipment.norwegianSupplier}
              </Typography>
            )}
          </CardContent>
          <CardActions sx={{ p: 1.5, pt: 0, flexWrap: 'wrap', gap: 0.5 }}>
            <Button
              size="small"
              startIcon={<Info />}
              sx={{ color: roleRoomBranding ? 'rgba(196,181,253,0.95)' : undefined }}
              onClick={() => setSelectedEquipment(equipment)}
            >
              Detaljer
            </Button>
            <Button size="small" startIcon={<Inventory2 />} onClick={() => copyEquipmentSummary(equipment)}>
              Spes
            </Button>
            <Button
              size="small"
              variant={isCompareSelected ? 'contained' : 'outlined'}
              startIcon={<CompareArrows />}
              sx={{
                bgcolor: isCompareSelected ? professionColor : 'transparent',
                borderColor: professionColor,
                color: isCompareSelected ? 'white' : professionColor,
              }}
              onClick={() => toggleCompare(equipment)}
            >
              {isCompareSelected ? 'Festet' : 'Fest'}
            </Button>
            {compactMode && (
              <Button
                size="small"
                startIcon={<CloudUpload />}
                onClick={() =>
                  setSnackbar({
                    open: true,
                    message: 'ℹ Åpne Lager/Backup for å markere 3-2-1 backup på denne enheten',
                    severity: 'info',
                  })
                }
              >
                Backup-logg
              </Button>
            )}
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<Add />}
                sx={{ bgcolor: professionColor }}
                onClick={() => addEquipmentMutation.mutate(equipment)}
                disabled={addEquipmentMutation.isPending}
              >
                Legg til
              </Button>
              {onAddToProject && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Add />}
                  sx={{ borderColor: '#9333ea', color: '#9333ea', '&:hover': { bgcolor: 'rgba(147,51,234,0.08)' } }}
                  onClick={() => onAddToProject(equipment)}
                >
                  Til prosjekt
                </Button>
              )}
            </Box>
          </CardActions>
        </Card>
      </Grid>
    );
  }, [
    roleRoomBranding,
    professionColor,
    compareMode,
    viewMode,
    favorites,
    onAddToProject,
    addEquipmentMutation,
    copyEquipmentSummary,
    getEquipmentIdentity,
    selectedUseCase,
    compareList,
  ]);

  return (
    <Box sx={roleRoomPanelSx}>
      {/* Search and Filters */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="h5"
          sx={{
            mb: 1.2,
            color: roleRoomBranding ? '#f8fafc' : theming.colors.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <PhotoCamera />
          Utstyrskatalog
        </Typography>
        <Typography
          variant="body2"
          sx={{
            mb: 1.6,
            color: roleRoomBranding ? 'rgba(203,213,225,0.75)' : 'text.secondary',
          }}
        >
          Operativ utstyrsoversikt med pro-filtre, risikoindikatorer, raskhandlinger og sammenligning
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.2 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={(_, next) => {
              if (!next) return;
              setViewMode(next);
            }}
            sx={{
              '& .MuiToggleButton-root': roleRoomBranding
                ? {
                    color: '#cbd5e1',
                    borderColor: 'rgba(148,163,184,0.35)',
                    bgcolor: 'rgba(15,23,42,0.72)',
                    '&.Mui-selected': {
                      color: '#0f172a',
                      background: 'linear-gradient(90deg, #67e8f9 0%, #c084fc 100%)',
                    },
                  }
                : undefined,
            }}
          >
            <ToggleButton value="standard">Standard</ToggleButton>
            <ToggleButton value="pro">Pro</ToggleButton>
          </ToggleButtonGroup>
          <Chip
            size="small"
            label="Snarveier: / søk • A legg til • F visning • Q sammenlign • B backup"
            sx={{
              bgcolor: roleRoomBranding ? 'rgba(56,189,248,0.14)' : 'rgba(15,23,42,0.06)',
              color: roleRoomBranding ? '#93c5fd' : '#334155',
              border: '1px solid rgba(125,211,252,0.35)',
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: roleRoomBranding ? 1.25 : 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Søk etter utstyr... (/)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            inputRef={searchInputRef}
            size="small"
            sx={{
              minWidth: 260,
              ...roleRoomControlSx,
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 150, ...roleRoomControlSx }}>
            <InputLabel>Kategori</InputLabel>
            <Select
              value={selectedCategory}
              label="Kategori"
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <MenuItem key={key} value={key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <config.icon sx={{ fontSize: '1rem', color: config.color }} />
                    {config.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150, ...roleRoomControlSx }}>
            <InputLabel>Merke</InputLabel>
            <Select
              value={selectedBrand}
              label="Merke"
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              {BRANDS.map((brand) => (
                <MenuItem key={brand} value={brand}>
                  {brand}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Chip
            label={`${deferredEquipmentList.length} produkter`}
            sx={{
              bgcolor: roleRoomBranding ? 'rgba(192,132,252,0.2)' : professionColor + '20',
              color: roleRoomBranding ? '#e9d5ff' : professionColor,
              border: roleRoomBranding ? '1px solid rgba(192,132,252,0.42)' : undefined,
            }}
          />

          {/* Comparison mode toggle */}
          <Button
            variant={compareMode ? 'contained' : 'outlined'}
            startIcon={<CompareArrows />}
            onClick={() => {
              setCompareMode(!compareMode);
            }}
            sx={{
              bgcolor: compareMode ? professionColor : 'transparent',
              borderColor: professionColor,
              color: compareMode ? 'white' : professionColor,
            }}
          >
            {compareMode ? 'Avslutt sammenligning' : 'Sammenlign utstyr'}
          </Button>
        </Box>

        <Box sx={{ mt: 1.2 }}>
          <Tabs
            value={savedViewId}
            onChange={(_, value: SavedViewId) => setSavedViewId(value)}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={
              roleRoomBranding
                ? {
                    '& .MuiTabs-indicator': { backgroundColor: '#22d3ee' },
                    '& .MuiTab-root': {
                      minHeight: 40,
                      textTransform: 'none',
                      color: 'rgba(203,213,225,0.82)',
                      '&.Mui-selected': { color: '#67e8f9', fontWeight: 700 },
                    },
                  }
                : undefined
            }
          >
            {SAVED_VIEWS.map((view) => (
              <Tab key={view.id} value={view.id} label={view.label} />
            ))}
          </Tabs>
          <Typography variant="caption" sx={{ color: roleRoomBranding ? 'rgba(148,163,184,0.85)' : 'text.secondary' }}>
            {SAVED_VIEWS.find((view) => view.id === savedViewId)?.description}
          </Typography>
        </Box>

        {/* Comparison toolbar */}
        {(compareMode || compareList.length > 0) && (
          <Box
            sx={{
              mt: 1.5,
              p: 1.2,
              bgcolor: roleRoomBranding ? 'rgba(30,41,59,0.72)' : professionColor + '10',
              border: roleRoomBranding ? '1px solid rgba(148,163,184,0.25)' : undefined,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="body2">
              <strong>{compareList.length}/3</strong> valgt for sammenligning:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flex: 1 }}>
              {compareList.map((eq) => (
                <Chip
                  key={getEquipmentIdentity(eq)}
                  label={`${eq.brand} ${eq.model}`}
                  onDelete={() => toggleCompare(eq)}
                  size="small"
                  sx={{ bgcolor: 'white' }}
                />
              ))}
            </Box>
            <Button
              variant="contained"
              startIcon={<CompareArrows />}
              onClick={() => setShowCompareDialog(true)}
              disabled={compareList.length < 2}
              sx={{ bgcolor: professionColor }}
            >
              Sammenlign ({compareList.length})
            </Button>
            {compareList.length > 0 && (
              <Button
                size="small"
                variant="text"
                onClick={() => setCompareList([])}
                sx={{ color: roleRoomBranding ? '#fda4af' : '#be123c' }}
              >
                Tøm
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Sticky operational overview */}
      {catalogMode !== 'checking' && !(catalogMode === 'api' && isLoading) && (
        <Box
          sx={{
            position: 'sticky',
            top: 8,
            zIndex: 4,
            mb: 2,
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.25)',
            background: roleRoomBranding
              ? 'linear-gradient(90deg, rgba(2,6,23,0.92) 0%, rgba(30,41,59,0.8) 100%)'
              : '#fff',
            boxShadow: '0 10px 28px rgba(2,6,23,0.16)',
            p: { xs: 1.2, md: 1.5 },
          }}
        >
          <Grid container spacing={1.2}>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Totalt</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: roleRoomBranding ? '#f8fafc' : '#0f172a' }}>
                {operationalMetrics.total}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Klar</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#86efac' }}>
                {operationalMetrics.ready}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Risiko</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#fca5a5' }}>
                {operationalMetrics.critical}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Lagring</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#93c5fd' }}>
                {operationalMetrics.storage}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>Cine</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#c4b5fd' }}>
                {operationalMetrics.cine}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Loading State */}
      {(catalogMode === 'checking' || (catalogMode === 'api' && isLoading)) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: professionColor }} />
        </Box>
      )}

      {catalogMode !== 'checking' && !(catalogMode === 'api' && isLoading) && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            alignItems: 'start',
            gridTemplateColumns: viewMode === 'pro' ? { xs: '1fr', xl: 'minmax(0, 1fr) 340px' } : '1fr',
          }}
        >
          <Box>
            {deferredEquipmentList.length > 0 && (
              <>
                <Grid container spacing={0} sx={{ gap: catalogGridSpacing }}>
                  {visibleEquipmentList.map(renderEquipmentCard)}
                </Grid>
                {hasMoreEquipment && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => setVisibleCount((prev) => prev + (viewMode === 'pro' ? 32 : 48))}
                      sx={{
                        borderColor: roleRoomBranding ? 'rgba(148,163,184,0.45)' : undefined,
                        color: roleRoomBranding ? '#cbd5e1' : undefined,
                      }}
                    >
                      Vis flere ({deferredEquipmentList.length - visibleCount} igjen)
                    </Button>
                  </Box>
                )}
              </>
            )}

            {deferredEquipmentList.length === 0 && (
              <Alert
                severity="info"
                sx={{
                  mt: 2,
                  ...(roleRoomBranding
                    ? {
                        bgcolor: 'rgba(15,23,42,0.76)',
                        color: '#cbd5e1',
                        border: '1px solid rgba(148,163,184,0.3)',
                        '& .MuiAlert-icon': { color: '#93c5fd' },
                      }
                    : {}),
                }}
              >
                {catalogMode === 'fallback'
                  ? 'Katalog kjører i fallback-modus. Viser lokal reservekatalog uten API-kall.'
                  : 'Ingen utstyr funnet med gjeldende filtre. Prøv å endre søket eller filtrene.'}
              </Alert>
            )}
          </Box>

          {viewMode === 'pro' && (
            <Box
              sx={{
                position: { xl: 'sticky' },
                top: { xl: 84 },
                borderRadius: 2,
                border: '1px solid rgba(148,163,184,0.24)',
                background: roleRoomBranding
                  ? 'linear-gradient(180deg, rgba(2,6,23,0.9) 0%, rgba(15,23,42,0.78) 100%)'
                  : '#fff',
                boxShadow: '0 10px 28px rgba(2,6,23,0.2)',
                p: 1.5,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: roleRoomBranding ? '#e2e8f0' : '#0f172a', mb: 0.75 }}>
                Pin-sammenligning
              </Typography>
              <Typography variant="caption" sx={{ color: roleRoomBranding ? '#94a3b8' : '#64748b' }}>
                Legg til opptil 3 enheter direkte fra kortene. Åpne full sammenligning når du er klar.
              </Typography>
              <Divider sx={{ my: 1.1, borderColor: roleRoomBranding ? 'rgba(148,163,184,0.2)' : undefined }} />

              {selectedUseCase && (
                <Chip
                  size="small"
                  label={`Filtrert på bruk: ${USE_CASES[selectedUseCase as keyof typeof USE_CASES]?.label || selectedUseCase}`}
                  onDelete={() => setSelectedUseCase(null)}
                  sx={{
                    mb: 1.2,
                    bgcolor: roleRoomBranding ? 'rgba(56,189,248,0.12)' : undefined,
                    color: roleRoomBranding ? '#7dd3fc' : undefined,
                    border: '1px solid rgba(56,189,248,0.35)',
                  }}
                />
              )}

              {compareList.length === 0 && (
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 1.5,
                    bgcolor: roleRoomBranding ? 'rgba(15,23,42,0.64)' : 'rgba(241,245,249,0.75)',
                    border: '1px dashed rgba(148,163,184,0.35)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: roleRoomBranding ? '#94a3b8' : '#64748b' }}>
                    Ingen enheter pinned enda.
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'grid', gap: 0.75 }}>
                {compareList.map((equipment) => (
                  <Box
                    key={getEquipmentIdentity(equipment)}
                    sx={{
                      p: 1,
                      borderRadius: 1.2,
                      bgcolor: roleRoomBranding ? 'rgba(15,23,42,0.74)' : 'rgba(241,245,249,0.75)',
                      border: '1px solid rgba(148,163,184,0.25)',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700, color: roleRoomBranding ? '#f8fafc' : '#0f172a' }}>
                      {equipment.brand} {equipment.model}
                    </Typography>
                    <Typography variant="caption" sx={{ color: roleRoomBranding ? '#94a3b8' : '#64748b' }}>
                      {CATEGORY_CONFIG[equipment.category?.toLowerCase() as keyof typeof CATEGORY_CONFIG]?.label || equipment.category}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => toggleCompare(equipment)}
                        sx={{ minWidth: 0, px: 0.75, color: roleRoomBranding ? '#fca5a5' : '#be123c' }}
                      >
                        Fjern
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Button
                fullWidth
                variant="contained"
                startIcon={<CompareArrows />}
                onClick={() => setShowCompareDialog(true)}
                disabled={compareList.length < 2}
                sx={{ mt: 1.2, bgcolor: professionColor }}
              >
                Åpne sammenligning
              </Button>
            </Box>
          )}
        </Box>
      )}


      {/* Equipment Detail Dialog */}
      <Dialog
        open={!!selectedEquipment}
        onClose={() => setSelectedEquipment(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: roleRoomBranding
            ? {
                borderRadius: 3,
                border: '1px solid rgba(148,163,184,0.26)',
                background:
                  'radial-gradient(120% 120% at 0% 0%, rgba(45,212,191,0.14) 0%, rgba(15,23,42,0.96) 42%, rgba(2,6,23,0.98) 100%)',
                boxShadow: '0 34px 70px rgba(2,6,23,0.66)',
                overflow: 'hidden',
              }
            : { borderRadius: 2.5 },
        }}
      >
        {selectedEquipment && (
          <>
            <DialogTitle
              component="div"
              sx={
                roleRoomBranding
                  ? {
                      px: { xs: 2, md: 3 },
                      pt: { xs: 2, md: 2.5 },
                      pb: 2,
                      borderBottom: '1px solid rgba(148,163,184,0.22)',
                      background: 'linear-gradient(90deg, rgba(30,41,59,0.62) 0%, rgba(15,23,42,0.2) 100%)',
                    }
                  : undefined
              }
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                <Box>
                  <Typography
                    variant="overline"
                    sx={
                      roleRoomBranding
                        ? {
                            color: 'rgba(186,230,253,0.9)',
                            letterSpacing: 1.2,
                            fontWeight: 700,
                            lineHeight: 1.2,
                          }
                        : { color: 'text.secondary' }
                    }
                  >
                    {selectedEquipment.brand}
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={
                      roleRoomBranding
                        ? {
                            mt: 0.25,
                            color: '#f8fafc',
                            fontWeight: 800,
                            letterSpacing: '-0.01em',
                            fontSize: { xs: '1.7rem', md: '2rem' },
                            lineHeight: 1.1,
                          }
                        : undefined
                    }
                  >
                    {selectedEquipment.model}
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => setSelectedEquipment(null)}
                  sx={
                    roleRoomBranding
                      ? {
                          color: 'rgba(226,232,240,0.85)',
                          bgcolor: 'rgba(15,23,42,0.72)',
                          border: '1px solid rgba(148,163,184,0.3)',
                          '&:hover': { bgcolor: 'rgba(30,41,59,0.9)' },
                        }
                      : undefined
                  }
                >
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent sx={roleRoomBranding ? { px: { xs: 2, md: 3 }, py: { xs: 2.25, md: 2.5 } } : undefined}>
              <Grid container spacing={roleRoomBranding ? 2.25 : 3} alignItems="stretch">
                <Grid item xs={12} md={5}>
                  <Box
                    sx={
                      roleRoomBranding
                        ? {
                            p: { xs: 1.25, md: 1.5 },
                            borderRadius: 2,
                            border: '1px solid rgba(148,163,184,0.24)',
                            background:
                              'linear-gradient(170deg, rgba(30,41,59,0.76) 0%, rgba(2,6,23,0.88) 100%)',
                          }
                        : undefined
                    }
                  >
                    <Box
                      component="img"
                      src={getEquipmentImage(selectedEquipment)}
                      alt={selectedEquipment.model}
                      sx={{
                        width: '100%',
                        aspectRatio: '4 / 3',
                        objectFit: 'contain',
                        bgcolor: roleRoomBranding ? 'rgba(15,23,42,0.95)' : '#f5f5f5',
                        borderRadius: 1.5,
                        border: roleRoomBranding
                          ? '1px solid rgba(148,163,184,0.26)'
                          : '1px solid rgba(148,163,184,0.18)',
                        p: 2,
                      }}
                    />
                    {selectedEquipment.images && selectedEquipment.images.length > 1 && (
                      <Box sx={{ display: 'flex', gap: 1, mt: 1.25, overflowX: 'auto', pb: 0.25 }}>
                        {selectedEquipment.images.slice(0, 4).map((img, idx) => (
                          <Box
                            key={idx}
                            component="img"
                            src={img}
                            sx={{
                              width: 68,
                              height: 68,
                              objectFit: 'cover',
                              borderRadius: 1,
                              cursor: 'pointer',
                              border: roleRoomBranding
                                ? '1px solid rgba(148,163,184,0.35)'
                                : '1px solid rgba(148,163,184,0.25)',
                              opacity: roleRoomBranding ? 0.88 : 0.72,
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                opacity: 1,
                                borderColor: roleRoomBranding ? '#22d3ee' : professionColor,
                              },
                            }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} md={7}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                    <Chip
                      label={
                        CATEGORY_CONFIG[selectedEquipment.category?.toLowerCase() as keyof typeof CATEGORY_CONFIG]?.label ||
                        selectedEquipment.category
                      }
                      sx={
                        roleRoomBranding
                          ? {
                              bgcolor: 'rgba(30,41,59,0.9)',
                              color: '#e2e8f0',
                              border: '1px solid rgba(148,163,184,0.36)',
                              fontWeight: 600,
                            }
                          : { mr: 1 }
                      }
                    />
                    {selectedEquipment.mount && (
                      <Chip
                        label={selectedEquipment.mount}
                        variant="outlined"
                        sx={
                          roleRoomBranding
                            ? {
                                color: '#cbd5e1',
                                borderColor: 'rgba(148,163,184,0.42)',
                                bgcolor: 'rgba(15,23,42,0.52)',
                              }
                            : { mr: 1 }
                        }
                      />
                    )}
                    {selectedEquipment.releaseYear && (
                      <Chip
                        label={`${selectedEquipment.releaseYear}`}
                        variant="outlined"
                        sx={
                          roleRoomBranding
                            ? {
                                color: '#cbd5e1',
                                borderColor: 'rgba(148,163,184,0.42)',
                                bgcolor: 'rgba(15,23,42,0.52)',
                              }
                            : undefined
                        }
                      />
                    )}
                  </Box>

                  {selectedEquipment.description && (
                    <Typography
                      variant="body1"
                      sx={{
                        mb: 2,
                        color: roleRoomBranding ? '#cbd5e1' : 'text.secondary',
                        lineHeight: 1.6,
                      }}
                    >
                      {selectedEquipment.description}
                    </Typography>
                  )}

                  {selectedEquipment.priceNOK && (
                    <Box
                      sx={
                        roleRoomBranding
                          ? {
                              mb: 2,
                              p: 2.1,
                              borderRadius: 2,
                              border: '1px solid rgba(168,85,247,0.4)',
                              background:
                                'linear-gradient(130deg, rgba(76,29,149,0.42) 0%, rgba(30,58,138,0.28) 52%, rgba(15,23,42,0.7) 100%)',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 30px rgba(15,23,42,0.45)',
                            }
                          : { mb: 2, p: 2, bgcolor: professionColor + '10', borderRadius: 2 }
                      }
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          color: roleRoomBranding ? '#e879f9' : professionColor,
                          fontWeight: 800,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        kr {selectedEquipment.priceNOK.toLocaleString('no-NO')}
                      </Typography>
                      {selectedEquipment.norwegianSupplier && (
                        <Typography
                          variant="body2"
                          sx={{ color: roleRoomBranding ? '#cbd5e1' : 'text.secondary' }}
                        >
                          Tilgjengelig hos {selectedEquipment.norwegianSupplier}
                        </Typography>
                      )}
                      {selectedEquipment.availability &&
                        (() => {
                          const availabilityLabel = formatAvailabilityLabel(selectedEquipment.availability);
                          const isAvailable = availabilityLabel === 'På lager';
                          return (
                            <Chip
                              label={availabilityLabel}
                              size="small"
                              sx={
                                roleRoomBranding
                                  ? {
                                      mt: 1.2,
                                      fontWeight: 700,
                                      color: isAvailable ? '#86efac' : '#fde68a',
                                      bgcolor: isAvailable ? 'rgba(22,163,74,0.2)' : 'rgba(217,119,6,0.2)',
                                      border: isAvailable
                                        ? '1px solid rgba(34,197,94,0.5)'
                                        : '1px solid rgba(245,158,11,0.5)',
                                    }
                                  : undefined
                              }
                              color={!roleRoomBranding ? (isAvailable ? 'success' : 'warning') : undefined}
                            />
                          );
                        })()}
                    </Box>
                  )}

                  {(() => {
                    const { pros, cons, bestFor } = getWhyChooseThis(selectedEquipment);
                    const useCases = getEquipmentUseCases(selectedEquipment);
                    return (
                      <Box
                        sx={
                          roleRoomBranding
                            ? {
                                mb: 2,
                                p: 2,
                                borderRadius: 2,
                                border: '1px solid rgba(148,163,184,0.25)',
                                background:
                                  'linear-gradient(180deg, rgba(15,23,42,0.78) 0%, rgba(2,6,23,0.88) 100%)',
                              }
                            : { mb: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }
                        }
                      >
                        <Typography
                          variant="subtitle1"
                          sx={{
                            mb: 1,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            color: roleRoomBranding ? '#f8fafc' : 'inherit',
                          }}
                        >
                          <Lightbulb sx={{ color: '#f59e0b' }} />
                          Hvorfor velge dette?
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{
                            mb: 1.5,
                            color: roleRoomBranding ? '#e879f9' : professionColor,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                          }}
                        >
                          <EmojiEvents sx={{ fontSize: '1rem' }} />
                          Best for: {bestFor}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                          {useCases.map((useCase) => {
                            const config = USE_CASES[useCase as keyof typeof USE_CASES];
                            if (!config) return null;
                            const UseCaseIcon = config.icon;
                            return (
                              <Chip
                                key={useCase}
                                icon={<UseCaseIcon sx={{ fontSize: '0.9rem' }} />}
                                label={config.label}
                                size="small"
                                sx={{
                                  bgcolor: roleRoomBranding ? 'rgba(15,23,42,0.8)' : config.color + '20',
                                  color: config.color,
                                  border: roleRoomBranding
                                    ? `1px solid ${config.color}55`
                                    : '1px solid transparent',
                                  '& .MuiChip-icon': { color: config.color },
                                }}
                              />
                            );
                          })}
                        </Box>

                        {pros.length > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#4ade80' }}>
                              ✓ Fordeler
                            </Typography>
                            {pros.map((pro, idx) => (
                              <Typography
                                key={idx}
                                variant="body2"
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  ml: 1,
                                  color: roleRoomBranding ? '#d1fae5' : 'text.primary',
                                }}
                              >
                                <ThumbUp sx={{ fontSize: '0.85rem', color: '#4ade80' }} />
                                {pro}
                              </Typography>
                            ))}
                          </Box>
                        )}

                        {cons.length > 0 && (
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                              ⚠ Vurderinger
                            </Typography>
                            {cons.map((con, idx) => (
                              <Typography
                                key={idx}
                                variant="body2"
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  ml: 1,
                                  color: roleRoomBranding ? '#fde68a' : 'text.secondary',
                                }}
                              >
                                <ThumbDown sx={{ fontSize: '0.85rem', color: '#f59e0b' }} />
                                {con}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    );
                  })()}

                  {selectedEquipment.specifications &&
                    Object.keys(selectedEquipment.specifications).length > 0 &&
                    (() => {
                      const specificationEntries = Object.entries(selectedEquipment.specifications).filter(
                        ([, value]) => value !== null && value !== undefined && String(value).trim() !== ''
                      );
                      const visibleEntries = showAllSpecifications
                        ? specificationEntries
                        : specificationEntries.slice(0, 12);
                      const hasHiddenSpecifications = specificationEntries.length > 12;

                      return (
                        <Box
                          sx={
                            roleRoomBranding
                              ? {
                                  p: 2,
                                  borderRadius: 2,
                                  border: '1px solid rgba(148,163,184,0.25)',
                                  background: 'rgba(2,6,23,0.62)',
                                }
                              : undefined
                          }
                        >
                          <Typography
                            variant="subtitle1"
                            sx={{ mb: 1, fontWeight: 700, color: roleRoomBranding ? '#f8fafc' : 'inherit' }}
                          >
                            Spesifikasjoner
                          </Typography>
                          <Divider sx={{ mb: 1.25, borderColor: roleRoomBranding ? 'rgba(148,163,184,0.24)' : undefined }} />
                          <Box sx={{ display: 'grid', gap: 0.75 }}>
                            {visibleEntries.map(([key, value]) => (
                              <Box
                                key={key}
                                sx={
                                  roleRoomBranding
                                    ? {
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(132px, 170px) 1fr',
                                        gap: 1,
                                        alignItems: 'start',
                                        p: 1,
                                        borderRadius: 1,
                                        bgcolor: 'rgba(15,23,42,0.64)',
                                        border: '1px solid rgba(148,163,184,0.15)',
                                      }
                                    : { display: 'flex', py: 0.5 }
                                }
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    minWidth: roleRoomBranding ? 'auto' : 150,
                                    color: roleRoomBranding ? '#94a3b8' : 'text.secondary',
                                    fontWeight: roleRoomBranding ? 600 : 400,
                                  }}
                                >
                                  {formatSpecificationKey(key)}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600, color: roleRoomBranding ? '#e2e8f0' : 'inherit' }}
                                >
                                  {String(value)}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                          {hasHiddenSpecifications && (
                            <Box sx={{ mt: 1.25, display: 'flex', justifyContent: 'flex-end' }}>
                              <Button
                                size="small"
                                onClick={() => setShowAllSpecifications((prev) => !prev)}
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  color: roleRoomBranding ? '#93c5fd' : professionColor,
                                }}
                              >
                                {showAllSpecifications
                                  ? 'Vis færre spesifikasjoner'
                                  : `Les mer om spesifikasjoner (${specificationEntries.length - 12} til)`}
                              </Button>
                            </Box>
                          )}
                        </Box>
                      );
                    })()}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions
              sx={
                roleRoomBranding
                  ? {
                      p: 2,
                      borderTop: '1px solid rgba(148,163,184,0.2)',
                      background: 'linear-gradient(90deg, rgba(2,6,23,0.88) 0%, rgba(15,23,42,0.68) 100%)',
                    }
                  : { p: 2 }
              }
            >
              <Button
                onClick={() => setSelectedEquipment(null)}
                sx={
                  roleRoomBranding
                    ? { color: '#93c5fd', '&:hover': { bgcolor: 'rgba(59,130,246,0.14)' } }
                    : undefined
                }
              >
                Lukk
              </Button>
              {onAddToProject && selectedEquipment && (
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  sx={
                    roleRoomBranding
                      ? {
                          borderColor: 'rgba(192,132,252,0.65)',
                          color: '#d8b4fe',
                          '&:hover': { bgcolor: 'rgba(168,85,247,0.14)', borderColor: '#c084fc' },
                        }
                      : { borderColor: '#9333ea', color: '#9333ea', '&:hover': { bgcolor: 'rgba(147,51,234,0.08)' } }
                  }
                  onClick={() => {
                    onAddToProject(selectedEquipment);
                    setSelectedEquipment(null);
                  }}
                >
                  Legg til i prosjekt
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={addEquipmentMutation.isPending ? <CircularProgress size={16} /> : <Add />}
                sx={
                  roleRoomBranding
                    ? {
                        color: '#0b1120',
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #22d3ee 0%, #a855f7 52%, #f472b6 100%)',
                        boxShadow: '0 12px 26px rgba(34,211,238,0.35)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #67e8f9 0%, #c084fc 52%, #f9a8d4 100%)',
                        },
                      }
                    : { bgcolor: professionColor }
                }
                onClick={() => addEquipmentMutation.mutate(selectedEquipment)}
                disabled={addEquipmentMutation.isPending}
              >
                {addEquipmentMutation.isPending ? 'Legger til...' : 'Legg til i mitt utstyr'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Comparison Dialog */}
      <Dialog
        open={showCompareDialog}
        onClose={() => setShowCompareDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle component="div">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CompareArrows sx={{ color: professionColor }} />
              Sammenligning av utstyr
            </Typography>
            <IconButton onClick={() => setShowCompareDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {compareList.length >= 2 && (
            <Box>
              {/* Equipment headers with images */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                  <Typography variant="subtitle2" color="text.secondary">Spesifikasjon</Typography>
                </Grid>
                {compareList.map((eq) => {
                  const hasImage = hasEquipmentImage(eq);
                  return (
                    <Grid item xs={compareList.length === 2 ? 4 : 2.67} key={getEquipmentIdentity(eq)}>
                      <Box sx={{ textAlign: 'center' }}>
                        {hasImage ? (
                          <Box sx={{ position: 'relative' }}>
                            <Box
                              component="img"
                              src={getEquipmentImage(eq) || getPlaceholderImage(eq)}
                              alt={eq.model}
                              sx={{ width: '100%', maxHeight: 120, objectFit: 'contain', bgcolor: '#f5f5f5', borderRadius: 1, p: 1 }}
                            />
                            {cmsMode && (
                              <IconButton
                                size="small"
                                onClick={() => handleOpenImageUpload(eq)}
                                sx={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  bgcolor: 'rgba(255,255,255,0.9)','&:hover': { bgcolor: 'white' }}}
                              >
                                <Edit sx={{ fontSize: 16 }} />
                              </IconButton>
                            )}
                          </Box>
                        ) : (
                          <Box
                            onClick={() => cmsMode && handleOpenImageUpload(eq)}
                            sx={{
                              width: '100%',
                              height: 120,
                              bgcolor: '#f5f5f5',
                              borderRadius: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '2px dashed #ccc',
                              cursor: cmsMode ? 'pointer' : 'default',
                              transition: 'all 0.2s ease','&:hover': cmsMode ? {
                                borderColor: professionColor,
                                bgcolor: professionColor + '08',
                              } : {}}}
                          >
                            <CameraAlt sx={{ fontSize: 32, color: '#999', mb: 0.5 }} />
                            <Typography variant="caption" color="text.secondary">
                              Bilde mangler
                            </Typography>
                            {cmsMode && (
                              <Typography variant="caption" sx={{ color: professionColor, fontSize: '0.65rem' }}>
                                Klikk for å legge til
                              </Typography>
                            )}
                          </Box>
                        )}
                        <Typography variant="subtitle2" sx={{ mt: 1, fontWeight: 600}}>
                          {eq.brand}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {eq.model}
                        </Typography>
                        {eq.priceNOK && (
                          <Typography variant="body2" sx={{ fontWeight: 600, color: professionColor }}>
                            kr {eq.priceNOK.toLocaleString('no-NO')}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>

              <Divider sx={{ mb: 2 }} />

              {/* Specification comparison table */}
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: professionColor + '10' }}>
                      <TableCell sx={{ fontWeight: 600}}>Spesifikasjon</TableCell>
                      {compareList.map((eq) => (
                        <TableCell key={getEquipmentIdentity(eq)} align="center" sx={{ fontWeight: 600}}>
                          {eq.brand} {eq.model}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {comparisonResults?.map((row) => (
                      <TableRow key={row.spec} sx={{ '&:nth-of-type(odd)': { bgcolor: '#f9f9f9' } }}>
                        <TableCell sx={{ fontWeight: 500}}>{row.spec}</TableCell>
                        {row.values.map((v, idx) => (
                          <TableCell
                            key={idx}
                            align="center"
                            sx={{
                              bgcolor: v.isBest ? '#4CAF50' + '20' : 'transparent',
                              fontWeight: v.isBest ? 600 : 400,
                              color: v.isBest ? '#4CAF50' : 'inherit'}}
                          >
                            {v.value}
                            {v.isBest && <Star sx={{ fontSize: '0.85rem', ml: 0.5, verticalAlign: 'middle', color: '#FF9800' }} />}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}

                    {/* Use cases row */}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 500}}>Best for</TableCell>
                      {compareList.map((eq) => (
                        <TableCell key={getEquipmentIdentity(eq)} align="center">
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {getEquipmentUseCases(eq).slice(0, 3).map((useCase) => {
                              const config = USE_CASES[useCase as keyof typeof USE_CASES];
                              if (!config) return null;
                              return (
                                <Chip
                                  key={useCase}
                                  label={config.label}
                                  size="small"
                                  sx={{ fontSize: '0.65rem', bgcolor: config.color + '20', color: config.color }}
                                />
                              );
                            })}
                          </Box>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Head-to-head comparison */}
              {compareList.length === 2 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Lightbulb sx={{ color: '#FF9800' }} />
                    Direkte sammenligning
                  </Typography>
                  <Grid container spacing={2}>
                    {compareEquipment(compareList[0], compareList[1]).map((comp, idx) => (
                      <Grid item xs={12} sm={6} key={idx}>
                        <Paper sx={{ p: 2, bgcolor: comp.winner === compareList[0].brand ? '#4CAF50' + '10' : '#2196F3' + '10' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            <EmojiEvents sx={{ fontSize: '1rem', color: '#FF9800', mr: 0.5, verticalAlign: 'middle' }} />
                            {comp.winner}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {comp.reason}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Recommendations */}
              <Box sx={{ mt: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600}}>
                  💡 Vår anbefaling
                </Typography>
                {compareList.map((eq) => {
                  const { pros, bestFor } = getWhyChooseThis(eq);
                  return (
                    <Box key={getEquipmentIdentity(eq)} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #eee' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                        {eq.brand} {eq.model}
                      </Typography>
                      <Typography variant="body2" sx={{ color: professionColor, mb: 0.5 }}>
                        Best for: {bestFor}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {pros[0]}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowCompareDialog(false)}>Lukk</Button>
          {onAddToProject && (
            <Button
              variant="outlined"
              startIcon={<Add />}
              sx={{ borderColor: '#9333ea', color: '#9333ea', '&:hover': { bgcolor: 'rgba(147,51,234,0.08)' } }}
              onClick={() => {
                compareList.forEach((eq) => onAddToProject(eq));
                setShowCompareDialog(false);
                setCompareMode(false);
                setCompareList([]);
              }}
            >
              Legg alle til prosjekt
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            sx={{ bgcolor: professionColor }}
            onClick={() => {
              compareList.forEach((eq) => addEquipmentMutation.mutate(eq));
              setShowCompareDialog(false);
              setCompareMode(false);
              setCompareList([]);
            }}
          >
            Legg alle til i mitt utstyr
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* CMS MODE: Image Upload Dialog */}
      {cmsMode && (
        <Dialog
          open={imageUploadDialog.open}
          onClose={() => setImageUploadDialog({ open: false, equipment: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUpload sx={{ color: professionColor }} />
            <Box>
              <Typography variant="h6">Legg til bilde</Typography>
              {imageUploadDialog.equipment && (
                <Typography variant="caption" color="text.secondary">
                  {imageUploadDialog.equipment.brand} {imageUploadDialog.equipment.model}
                </Typography>
              )}
            </Box>
            <Chip
              label="CMS MODE"
              size="small"
              color="info"
              sx={{ ml: 'auto' }}
            />
          </DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Visual CMS redigering. Last opp et bilde eller lim inn en URL for å oppdatere produktbildet.
            </Alert>

            {/* Image Preview */}
            {imagePreview && (
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <Box
                  component="img"
                  src={imagePreview}
                  alt="Preview"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    objectFit: 'contain',
                    borderRadius: 1,
                    border: '1px solid #ddd'}}
                  onError={() => {
                    setSnackbar({
                      open: true,
                      message: 'Kunne ikke laste bilde fra URL',
                      severity: 'error',
                    });
                    setImagePreview(null);
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Forhåndsvisning
                </Typography>
              </Box>
            )}

            {/* Upload Options */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* File Upload */}
              <Box>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  title="Velg bilde fil"
                  aria-label="Velg bilde fil"
                  hidden
                />
                <Button
                  variant="outlined"
                  startIcon={<CloudUpload />}
                  onClick={() => fileInputRef.current?.click()}
                  fullWidth
                  sx={{ borderColor: professionColor, color: professionColor }}
                >
                  Last opp fra fil
                </Button>
              </Box>

              <Divider>eller</Divider>

              {/* URL Input */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Bilde-URL"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon />
                      </InputAdornment>
                    )}}
                />
                <Button
                  variant="outlined"
                  onClick={handleUrlPreview}
                  disabled={!imageUrlInput}
                >
                  Forhåndsvis
                </Button>
              </Box>

              {/* Quick URL suggestions */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Foreslåtte kilder:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {['B&H Photo','Amazon','Elkjøp','Komplett'].map((source) => (
                    <Chip
                      key={source}
                      label={source}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const urls: Record<string, string> = {
                          'B&H Photo':'https://www.bhphotovideo.com/','Amazon':'https://www.amazon.com/', 'Elkjøp':'https://www.elkjop.no/', 'Komplett' : 'https://www.komplett.no/',
                        };
                        window.open(urls[source], '_blank');
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImageUploadDialog({ open: false, equipment: null })}>
              Avbryt
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveImage}
              disabled={!imagePreview || uploadingImage}
              startIcon={uploadingImage ? <CircularProgress size={16} /> : <CheckCircle />}
              sx={{ bgcolor: professionColor, '&:hover': { bgcolor: professionColor } }}
            >
              {uploadingImage ? 'Lagrer...' : 'Lagre bilde'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export type { CatalogEquipment };
export default EquipmentCatalogBrowser;
