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

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import { useVisualEditor } from '../../hooks/useVisualEditor';

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

const CATEGORY_CONFIG = {
  all: { label: 'Alle', icon: FilterList, color: '#666' },
  cameras: { label: 'Kameraer', icon: CameraAlt, color: '#E91E63' },
  lenses: { label: 'Objektiver', icon: Lens, color: '#9C27B0' },
  flash: { label: 'Blits/Lys', icon: FlashOn, color: '#FF9800' },
  audio: { label: 'Lyd', icon: Headphones, color: '#4CAF50' },
  video: { label: 'Video', icon: Videocam, color: '#2196F3' },
  accessories: { label: 'Tilbehør', icon: Computer, color: '#795548' },
};

const BRANDS = [
  'Alle','Canon','Sony','Nikon','Fujifilm','Panasonic','Blackmagic','RED','ARRI','DJI','GoPro','Sennheiser','Rode','Zoom','Godox','Profoto','Sigma','Tamron','Zeiss',
];

const PROFESSION_COLORS = {
  photographer: '#FF6B35',
  videographer: '#9C27B0',
  music_producer: '#FF5722',
  vendor: '#2196F3',
};

const FALLBACK_CATALOG: CatalogEquipment[] = [
  {
    id: 'fallback-sony-fx3',
    brand: 'Sony',
    model: 'FX3',
    category: 'video',
    description: 'Kompakt cinema-kamera for run-and-gun produksjon.',
    specifications: { sensorSize: 'Full Frame', videoResolution: '4K', maxISO: 102400 },
    priceNOK: 49990,
    releaseYear: 2021,
    mount: 'Sony E',
    availability: 'available',
  },
  {
    id: 'fallback-canon-c70',
    brand: 'Canon',
    model: 'C70',
    category: 'video',
    description: 'Super 35 cinema-kamera med intern ND.',
    specifications: { sensorSize: 'Super 35', videoResolution: '4K', maxISO: 102400 },
    priceNOK: 61990,
    releaseYear: 2020,
    mount: 'Canon RF',
    availability: 'available',
  },
  {
    id: 'fallback-sony-a7iv',
    brand: 'Sony',
    model: 'A7 IV',
    category: 'cameras',
    description: 'Allsidig hybridkamera for foto og video.',
    specifications: { resolution: 33, continuousFPS: 10, maxISO: 51200 },
    priceNOK: 31990,
    releaseYear: 2021,
    mount: 'Sony E',
    availability: 'limited',
  },
  {
    id: 'fallback-nikon-z8',
    brand: 'Nikon',
    model: 'Z8',
    category: 'cameras',
    description: 'Flaggskip-kamera i kompakt hus.',
    specifications: { resolution: 45.7, continuousFPS: 20, maxISO: 25600 },
    priceNOK: 55990,
    releaseYear: 2023,
    mount: 'Nikon Z',
    availability: 'available',
  },
  {
    id: 'fallback-canon-24-70',
    brand: 'Canon',
    model: 'RF 24-70mm f/2.8L',
    category: 'lenses',
    description: 'Standard zoom for event og kommersiell produksjon.',
    specifications: { focalLength: '24-70mm', maxAperture: 2.8, lensType: 'zoom' },
    priceNOK: 27990,
    releaseYear: 2019,
    mount: 'Canon RF',
    availability: 'available',
  },
  {
    id: 'fallback-sony-70-200',
    brand: 'Sony',
    model: 'FE 70-200mm f/2.8 GM II',
    category: 'lenses',
    description: 'Telezoom med høy optisk ytelse.',
    specifications: { focalLength: '70-200mm', maxAperture: 2.8, lensType: 'telezoom' },
    priceNOK: 34990,
    releaseYear: 2021,
    mount: 'Sony E',
    availability: 'available',
  },
  {
    id: 'fallback-rode-wireless-pro',
    brand: 'Rode',
    model: 'Wireless PRO',
    category: 'audio',
    description: 'Trådløst lydsystem for intervjuer og run-and-gun.',
    specifications: { channels: 2, batteryLife: '7h' },
    priceNOK: 5890,
    releaseYear: 2023,
    availability: 'available',
  },
  {
    id: 'fallback-aputure-600d',
    brand: 'Aputure',
    model: 'LS 600d Pro',
    category: 'flash',
    description: 'Kraftig kontinuerlig lys for større sett.',
    specifications: { power: '600W', weatherSealed: true },
    priceNOK: 23990,
    releaseYear: 2021,
    availability: 'available',
  },
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
}) => {
  const theming = useTheming(profession);
  const professionColor = PROFESSION_COLORS[profession];
  const queryClient = useQueryClient();

  // CMS mode detection - allows image editing in CMS/dev mode
  const cmsMode = useCmsMode();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('Alle');
  const [catalogMode, setCatalogMode] = useState<'checking' | 'api' | 'fallback'>('checking');
  const [selectedEquipment, setSelectedEquipment] = useState<CatalogEquipment | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: ', ', severity: 'success' as 'success' | 'error' | 'info' });
  const [favorites, setFavorites] = useState<Set<string | number>>(new Set());

  // Comparison state
  const [compareMode, setCompareMode] = useState(false);
  const [compareList, setCompareList] = useState<CatalogEquipment[]>([]);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);

  // CMS mode image upload state
  const [imageUploadDialog, setImageUploadDialog] = useState<{ open: boolean; equipment: CatalogEquipment | null }>({ open: false, equipment: null });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Visual editor for CMS mode
  const visualEditor = useVisualEditor();

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

  // Fetch equipment catalog
  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['/api/equipment/search', searchQuery, selectedCategory, selectedBrand],
    enabled: catalogMode === 'api',
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.append('q', searchQuery);
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
    const query = searchQuery.trim().toLowerCase();
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
  }, [searchQuery, selectedBrand, selectedCategory]);

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

  const equipmentList: CatalogEquipment[] =
    catalogMode === 'api' ? catalogData?.results || catalogData || [] : fallbackEquipmentList;

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

  // Toggle comparison selection
  const toggleCompare = (equipment: CatalogEquipment) => {
    setCompareList((prev) => {
      const isSelected = prev.some((e) => e.id === equipment.id);
      if (isSelected) {
        return prev.filter((e) => e.id !== equipment.id);
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

  const isInCompareList = (id: string | number) => compareList.some((e) => e.id === id);

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

  const renderEquipmentCard = (equipment: CatalogEquipment) => {
    const CategoryIcon = CATEGORY_CONFIG[equipment.category?.toLowerCase() as keyof typeof CATEGORY_CONFIG]?.icon || CameraAlt;
    const useCases = getEquipmentUseCases(equipment);
    const isCompareSelected = isInCompareList(equipment.id);

    return (
      <Grid item xs={12} sm={6} md={4} lg={3} key={equipment.id}>
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.3s ease',
            border: isCompareSelected ? `2px solid ${professionColor}` : 'none','&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: 6,
            }}}
        >
          {/* Comparison checkbox overlay */}
          {compareMode && (
            <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 2}}>
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
              height="180"
              image={getEquipmentImage(equipment)}
              alt={`${equipment.brand} ${equipment.model}`}
              sx={{
                objectFit: 'contain',
                bgcolor: '#f5f5f5',
                p: 2}}
            />
          </Box>
          <CardContent sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {equipment.brand}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(equipment.id);
                }}
              >
                {favorites.has(equipment.id) ? (
                  <Favorite sx={{ color: '#E91E63' }} />
                ) : (
                  <FavoriteBorder />
                )}
              </IconButton>
            </Box>
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1 }}>
              {equipment.model}
            </Typography>

            {/* Category chip */}
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
              <Chip
                icon={<CategoryIcon sx={{ fontSize: '0.9rem' }} />}
                label={CATEGORY_CONFIG[equipment.category?.toLowerCase() as keyof typeof CATEGORY_CONFIG]?.label || equipment.category}
                size="small"
                sx={{ fontSize: '0.7rem' }}
              />
              {equipment.mount && (
                <Chip label={equipment.mount} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
              )}
            </Box>

            {/* Use case chips */}
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
              {useCases.slice(0, 3).map((useCase) => {
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
                      color: config.color, '& .MuiChip-icon': { color: config.color }}}
                    onClick={() => setSelectedUseCase(useCase)}
                  />
                );
              })}
            </Box>

            {equipment.priceNOK && (
              <Typography variant="body2" sx={{ fontWeight: 600, color: professionColor }}>
                kr {equipment.priceNOK.toLocaleString('no-NO')}
              </Typography>
            )}
            {equipment.norwegianSupplier && (
              <Typography variant="caption" color="text.secondary">
                Tilgjengelig hos {equipment.norwegianSupplier}
              </Typography>
            )}
          </CardContent>
          <CardActions sx={{ p: 2, pt: 0, flexWrap: 'wrap', gap: 0.5 }}>
            <Button
              size="small"
              startIcon={<Info />}
              onClick={() => setSelectedEquipment(equipment)}
            >
              Detaljer
            </Button>
            {compareMode ? (
              <Button
                size="small"
                variant={isCompareSelected ? 'contained' : 'outlined'}
                startIcon={<CompareArrows />}
                sx={{
                  bgcolor: isCompareSelected ? professionColor : 'transparent',
                  borderColor: professionColor,
                  color: isCompareSelected ? 'white' : professionColor}}
                onClick={() => toggleCompare(equipment)}
              >
                {isCompareSelected ? 'Valgt' : 'Sammenlign'}
              </Button>
            ) : (
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
            )}
          </CardActions>
        </Card>
      </Grid>
    );
  };

  return (
    <Box>
      {/* Search and Filters */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ mb: 2, color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PhotoCamera />
          Utstyrskatalog
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Søk i vår database med profesjonelt utstyr og legg til i din utstyrsliste
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Søk etter utstyr..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )}}
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
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

          <FormControl size="small" sx={{ minWidth: 150 }}>
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
            label={`${equipmentList.length} produkter`}
            sx={{ bgcolor: professionColor + '20', color: professionColor }}
          />

          {/* Comparison mode toggle */}
          <Button
            variant={compareMode ? 'contained' : 'outlined'}
            startIcon={<CompareArrows />}
            onClick={() => {
              setCompareMode(!compareMode);
              if (compareMode) setCompareList([]);
            }}
            sx={{
              bgcolor: compareMode ? professionColor : 'transparent',
              borderColor: professionColor,
              color: compareMode ? 'white' : professionColor}}
          >
            {compareMode ? 'Avslutt sammenligning' : 'Sammenlign utstyr'}
          </Button>
        </Box>

        {/* Comparison toolbar */}
        {compareMode && compareList.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: professionColor + '10', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2">
              <strong>{compareList.length}/3</strong> valgt for sammenligning:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flex: 1 }}>
              {compareList.map((eq) => (
                <Chip
                  key={eq.id}
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
          </Box>
        )}
      </Box>

      {/* Loading State */}
      {(catalogMode === 'checking' || (catalogMode === 'api' && isLoading)) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: professionColor }} />
        </Box>
      )}

      {/* Equipment Grid */}
      {catalogMode !== 'checking' && !(catalogMode === 'api' && isLoading) && equipmentList.length > 0 && (
        <Grid container spacing={3}>
          {equipmentList.map(renderEquipmentCard)}
        </Grid>
      )}

      {/* Empty State */}
      {catalogMode !== 'checking' && !(catalogMode === 'api' && isLoading) && equipmentList.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {catalogMode === 'fallback'
            ? 'Katalog kjører i fallback-modus. Viser lokal reservekatalog uten API-kall.'
            : 'Ingen utstyr funnet med gjeldende filtre. Prøv å endre søket eller filtrene.'}
        </Alert>
      )}

      {/* Equipment Detail Dialog */}
      <Dialog
        open={!!selectedEquipment}
        onClose={() => setSelectedEquipment(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedEquipment && (
          <>
            <DialogTitle component="div">
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {selectedEquipment.brand}
                  </Typography>
                  <Typography variant="h5">{selectedEquipment.model}</Typography>
                </Box>
                <IconButton onClick={() => setSelectedEquipment(null)}>
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                {/* Image */}
                <Grid item xs={12} md={5}>
                  <Box
                    component="img"
                    src={getEquipmentImage(selectedEquipment)}
                    alt={selectedEquipment.model}
                    sx={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: 300,
                      objectFit: 'contain',
                      bgcolor: '#f5f5f5',
                      borderRadius: 2,
                      p: 2}}
                  />
                  {selectedEquipment.images && selectedEquipment.images.length > 1 && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, overflowX: 'auto' }}>
                      {selectedEquipment.images.slice(0, 4).map((img, idx) => (
                        <Box
                          key={idx}
                          component="img"
                          src={img}
                          sx={{
                            width: 60,
                            height: 60,
                            objectFit: 'cover',
                            borderRadius: 1,
                            cursor: 'pointer',
                            opacity: 0.7, '&:hover': { opacity: 1 }}}
                        />
                      ))}
                    </Box>
                  )}
                </Grid>

                {/* Details */}
                <Grid item xs={12} md={7}>
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      label={CATEGORY_CONFIG[selectedEquipment.category?.toLowerCase() as keyof typeof CATEGORY_CONFIG]?.label || selectedEquipment.category}
                      sx={{ mr: 1 }}
                    />
                    {selectedEquipment.mount && (
                      <Chip label={selectedEquipment.mount} variant="outlined" sx={{ mr: 1 }} />
                    )}
                    {selectedEquipment.releaseYear && (
                      <Chip label={`${selectedEquipment.releaseYear}`} variant="outlined" />
                    )}
                  </Box>

                  {selectedEquipment.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {selectedEquipment.description}
                    </Typography>
                  )}

                  {selectedEquipment.priceNOK && (
                    <Box sx={{ mb: 2, p: 2, bgcolor: professionColor + '10', borderRadius: 2 }}>
                      <Typography variant="h4" sx={{ color: professionColor, fontWeight: 700}}>
                        kr {selectedEquipment.priceNOK.toLocaleString('no-NO')}
                      </Typography>
                      {selectedEquipment.norwegianSupplier && (
                        <Typography variant="body2" color="text.secondary">
                          Tilgjengelig hos {selectedEquipment.norwegianSupplier}
                        </Typography>
                      )}
                      {selectedEquipment.availability && (
                        <Chip
                          label={selectedEquipment.availability}
                          size="small"
                          color={selectedEquipment.availability === 'På lager' ? 'success' : 'warning'}
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  )}

                  {/* Why Choose This Section */}
                  {(() => {
                    const { pros, cons, bestFor } = getWhyChooseThis(selectedEquipment);
                    const useCases = getEquipmentUseCases(selectedEquipment);
                    return (
                      <Box sx={{ mb: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Lightbulb sx={{ color: '#FF9800' }} />
                          Hvorfor velge dette?
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 1.5, color: professionColor, fontWeight: 600}}>
                          <EmojiEvents sx={{ fontSize: '1rem', mr: 0.5, verticalAlign: 'middle' }} />
                          Best for: {bestFor}
                        </Typography>

                        {/* Use cases */}
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
                                  bgcolor: config.color + '20',
                                  color: config.color, '& .MuiChip-icon': { color: config.color }}}
                              />
                            );
                          })}
                        </Box>

                        {/* Pros */}
                        {pros.length > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: '#4CAF50' }}>
                              ✓ Fordeler
                            </Typography>
                            {pros.map((pro, idx) => (
                              <Typography key={idx} variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                                <ThumbUp sx={{ fontSize: '0.85rem', color: '#4CAF50' }} />
                                {pro}
                              </Typography>
                            ))}
                          </Box>
                        )}

                        {/* Cons */}
                        {cons.length > 0 && (
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: '#FF9800' }}>
                              ⚠ Vurderinger
                            </Typography>
                            {cons.map((con, idx) => (
                              <Typography key={idx} variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, color: 'text.secondary' }}>
                                <ThumbDown sx={{ fontSize: '0.85rem', color: '#FF9800' }} />
                                {con}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    );
                  })()}

                  {/* Specifications */}
                  {selectedEquipment.specifications && Object.keys(selectedEquipment.specifications).length > 0 && (
                    <Box>
                      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600}}>
                        Spesifikasjoner
                      </Typography>
                      <Divider sx={{ mb: 1 }} />
                      {Object.entries(selectedEquipment.specifications).slice(0, 10).map(([key, value]) => (
                        <Box key={key} sx={{ display: 'flex', py: 0.5 }}>
                          <Typography variant="body2" sx={{ minWidth: 150, color: 'text.secondary' }}>
                            {key.replace(/_/g, ', ')}:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500}}>
                            {String(value)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setSelectedEquipment(null)}>Lukk</Button>
              {onAddToProject && selectedEquipment && (
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  sx={{ borderColor: '#9333ea', color: '#9333ea', '&:hover': { bgcolor: 'rgba(147,51,234,0.08)' } }}
                  onClick={() => { onAddToProject(selectedEquipment); setSelectedEquipment(null); }}
                >
                  Legg til i prosjekt
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={addEquipmentMutation.isPending ? <CircularProgress size={16} /> : <Add />}
                sx={{ bgcolor: professionColor }}
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
                    <Grid item xs={compareList.length === 2 ? 4 : 2.67} key={eq.id}>
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
                        <TableCell key={eq.id} align="center" sx={{ fontWeight: 600}}>
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
                        <TableCell key={eq.id} align="center">
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
                    <Box key={eq.id} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #eee' }}>
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
