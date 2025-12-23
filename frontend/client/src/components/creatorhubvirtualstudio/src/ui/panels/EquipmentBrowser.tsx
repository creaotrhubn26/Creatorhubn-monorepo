/**
 * EquipmentBrowser - Asset Browser with Database Integration
 *
 * Features:
 * - Browse equipment from ComprehensiveGearDatabase
 * - Search by brand, category, power
 * - Drag & drop to scene
 * - Real equipment specs
 * - Preview images
 * - Popular setups
 * - Filter by "My Equipment" (user, 's inventory)
 */

import { logger } from '../../core/services/logger';

const log = logger.module('EquipmentBrowser, ');

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  IconButton,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Button,
  Tooltip,
  CircularProgress,
  Switch,
  FormControlLabel,
  Badge,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Lightbulb as LightIcon,
  CameraAlt as CameraIcon,
  Lens as LensIcon,
  Add as AddIcon,
  DragIndicator as DragIcon,
  Info as InfoIcon,
  Star as PopularIcon,
  Inventory as InventoryIcon,
  CheckCircle as OwnedIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  Backpack as MyGearIcon,
  Build as ConditionIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { useUserEquipmentInventory, getEquipmentImageUrl, UserEquipmentItem } from '../../hooks/useUserEquipmentInventory';
import {
  searchEquipment,
  getLightingEquipment,
  getCameraEquipment,
  getLensEquipment,
  getPopularSetups,
  equipmentToLightNode,
  equipmentToCameraNode,
  EquipmentSpec,
} from '@/core/services/equipment-integration';
import { 
  findLightSpec, 
  findLightSpecByBrand, 
  getDefaultLightSpec,
  lightSpecToNodeData,
  LightSpec 
} from '../../core/data/LightSpecifications';
import {
  findLensSpec,
  findLensSpecByBrand,
  getDefaultLensSpec,
  lensSpecToCameraData,
  LensSpec,
} from '../../core/data/LensSpecifications';
import { useAppStore } from '@/state/store';
import { useVirtualStudio } from '../../../VirtualStudioContext';

type CategoryTab = 'mygear' | 'lighting' | 'cameras' | 'lenses' | 'popular';
type ViewMode = 'grid' | 'list';

interface EquipmentBrowserProps {
  onAddToScene?: (node: unknown) => void;
}

export function EquipmentBrowser({ onAddToScene }: EquipmentBrowserProps) {
  const { scene, updateNode } = useAppStore();
  const { addToast } = useVirtualStudio();
  const [activeTab, setActiveTab] = useState<CategoryTab>('mygear');
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [equipment, setEquipment] = useState<EquipmentSpec[]>([]);
  const [popularSetups, setPopularSetups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [draggingItem, setDraggingItem] = useState<EquipmentSpec | null>(null);
  
  // View mode for My Gear tab (grid/list)
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  // "My Equipment" filter - connects to user's inventory from dashboard
  const [showOwnedOnly, setShowOwnedOnly] = useState(false);
  const { 
    inventory: userInventory, 
    isLoading: inventoryLoading, 
    isOwned,
    error: inventoryError,
    refresh: refreshInventory,
  } = useUserEquipmentInventory();

  // Common brands
  const brands = {
    lighting: ['Profoto','Godox','Elinchrom','Aputure','Nanlite'],
    cameras: ['Canon','Sony','Nikon','Fujifilm','Panasonic'],
    lenses: ['Canon','Sony','Nikon','Sigma','Tamron'],
  };
  
  // Filter equipment based on "My Equipment" toggle
  const filteredEquipment = useMemo(() => {
    if (!showOwnedOnly) return equipment;
    return equipment.filter((eq) => isOwned(eq.brand, eq.model));
  }, [equipment, showOwnedOnly, isOwned]);
  
  // Count of owned equipment in current view
  const ownedCount = useMemo(() => {
    return equipment.filter((eq) => isOwned(eq.brand, eq.model)).length;
  }, [equipment, isOwned]);

  // Load equipment when tab/filters change (skip for mygear tab)
  useEffect(() => {
    if (activeTab !== 'mygear' && activeTab !== 'popular') {
      loadEquipment();
    }
  }, [activeTab, searchQuery, brandFilter]);

  // Load popular setups
  useEffect(() => {
    if (activeTab === 'popular') {
      loadPopularSetups();
    }
  }, [activeTab]);
  
  // Filter user inventory based on search query
  const filteredUserInventory = useMemo(() => {
    if (!searchQuery) return userInventory;
    const query = searchQuery.toLowerCase();
    return userInventory.filter(
      (item) =>
        (item.name || '').toLowerCase().includes(query) ||
        (item.brand || '').toLowerCase().includes(query) ||
        (item.model || '').toLowerCase().includes(query) ||
        (item.category || '').toLowerCase().includes(query)
    );
  }, [userInventory, searchQuery]);

  const loadEquipment = async () => {
    setLoading(true);
    try {
      let results: EquipmentSpec[] = [];

      switch (activeTab) {
        case 'lighting':
          results = await getLightingEquipment({ brand: brandFilter || undefined });
          break;
        case 'cameras':
          results = await getCameraEquipment({ brand: brandFilter || undefined });
          break;
        case 'lenses':
          results = await getLensEquipment({ brand: brandFilter || undefined });
          break;
      }

      // Apply search filter
      if (searchQuery) {
        results = results.filter(
          (eq) =>
            eq.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
            eq.brand.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      }

      setEquipment(results);
    } catch (error) {
      log.error('Failed to load equipment: ', error);
      setEquipment([]);
      addToast({
        message: 'Failed to load equipment database',
        type: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPopularSetups = async () => {
    setLoading(true);
    try {
      const setups = await getPopularSetups();
      setPopularSetups(setups);
    } catch (error) {
      log.error('Failed to load popular setups:', error);
      setPopularSetups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToScene = (eq: EquipmentSpec) => {
    let node: unknown;

    if (eq.category === 'lighting' || eq.category === 'flash') {
      node = equipmentToLightNode(eq);
    } else if (eq.category === 'cameras') {
      node = equipmentToCameraNode(eq);
    }

    if (node) {
      // Add to scene via custom event (for drag & drop compatibility)
      const event = new CustomEvent('ch-add-asset-at', {
        detail: {
          asset: {
            type: node.type,
            title: node.name,
            data: node,
          },
          position: [0, 1.5, 0],
        },
      });
      window.dispatchEvent(event);

      if (onAddToScene) {
        onAddToScene(node);
      }

      addToast({
        message: `🎬 ${eq.brand} ${eq.model} added to scene`,
        type: 'success',
        duration: 2500,
      });
    }
  };
  
  // Handle adding user inventory item to scene
  const handleAddInventoryItemToScene = (item: UserEquipmentItem) => {
    const category = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const model = (item.model || '').toLowerCase();
    const searchKey = `${category} ${name} ${model}`;
    
    // Enhanced detection for equipment types
    const isLight = 
      category.includes('light') || 
      category.includes('flash') || 
      category.includes('strobe') ||
      category.includes('led') ||
      category.includes('continuous') ||
      searchKey.includes('profoto') ||
      searchKey.includes('godox') ||
      searchKey.includes('elinchrom') ||
      searchKey.includes('broncolor') ||
      searchKey.includes('aputure') ||
      searchKey.includes('nanlite') ||
      searchKey.includes('speedlite') ||
      searchKey.includes('softbox') ||
      searchKey.includes('ad600') ||
      searchKey.includes('ad400') ||
      searchKey.includes('ad200') ||
      searchKey.includes('b10') ||
      searchKey.includes('d2');
      
    const isCamera = 
      category.includes('camera') || 
      category.includes('body') ||
      (searchKey.includes('eos') && !searchKey.includes('lens')) ||
      (searchKey.includes('alpha') || searchKey.includes(' a7') || searchKey.includes(' a9') || searchKey.includes(' a1')) ||
      searchKey.includes('nikon z') ||
      searchKey.includes('fuji x-') ||
      searchKey.includes('lumix s') ||
      searchKey.includes('leica');
      
    const isLens = category.includes('lens');
    
    // Determine node type
    const nodeType = isLight ? 'light' : isCamera ? 'camera' : 'prop';
    const nodeName = `${item.brand || ''} ${item.model || item.name}`.trim();
    
    // Build asset data based on type
    const assetData: any = {
      userData: {
        fromInventory: true,
        inventoryId: item.id,
        brand: item.brand,
        model: item.model,
        serialNumber: item.serialNumber,
        realEquipment: true,
      },
    };
    
    // Add camera-specific specs if it's a camera
    if (isCamera) {
      const specs = item.specifications || {};
      const sensorSize = specs.sensor || getSensorSizeForCamera(item.brand, item.model);
      
      // Try to find attached lens specs
      const attachedLensBrand = specs.attachedLensBrand as string || item.brand;
      const attachedLensModel = specs.attachedLensModel as string;
      
      let lensSpec: LensSpec | null = null;
      let focalLength = 50;
      let aperture = 2.8;
      let minFocusDistance = 0.45;
      let fieldOfView: number | undefined;
      let lensSpecs: Record<string, any> = {};
      
      // Try to find real lens specs if lens info is provided
      if (attachedLensModel) {
        lensSpec = findLensSpec(attachedLensBrand || '', attachedLensModel);
        if (!lensSpec) {
          lensSpec = findLensSpecByBrand(attachedLensBrand || '');
        }
      }
      
      if (lensSpec) {
        // Use real lens specifications
        const lensData = lensSpecToCameraData(lensSpec);
        focalLength = lensData.focalLength;
        aperture = lensData.aperture;
        minFocusDistance = lensData.minFocusDistance;
        fieldOfView = lensData.fieldOfView;
        lensSpecs = lensData.userData.specifications;
        
        log.debug(`Found real lens specs for ${lensSpec.brand} ${lensSpec.model}: ${focalLength}mm f/${aperture}`);
      } else {
        // Use user-provided specs or defaults
        focalLength = (specs.focalLength as number) || 50;
        aperture = (specs.aperture as number) || 2.8;
        minFocusDistance = (specs.minFocusDistance as number) || 0.45;
        
        // Calculate approximate FOV from focal length and sensor size
        const sensorDiagonal = Math.sqrt(sensorSize[0] ** 2 + sensorSize[1] ** 2);
        const fovRad = 2 * Math.atan(sensorDiagonal / (2 * focalLength));
        fieldOfView = Math.round((fovRad * 180) / Math.PI);
      }
      
      // Get 3D model configuration
      const cameraModelConfig = getCameraModelConfig(item.brand, item.model);
      
      assetData.camera = {
        sensor: sensorSize,
        focalLength: focalLength,
        aperture: aperture,
        iso: (specs.iso as number) || 100,
        shutter: (specs.shutter as number) || 1 / 125,
        minFocusDistance: minFocusDistance,
        fieldOfView: fieldOfView,
      };
      
      // Add 3D model configuration
      assetData.model3d = {
        type: cameraModelConfig.modelType,
        proceduralType: cameraModelConfig.proceduralType,
        modelUrl: cameraModelConfig.modelUrl,
      };
      
      // Store detailed camera and lens specs
      assetData.userData = {
        ...assetData.userData,
        cameraSpecs: {
          sensorSize: sensorSize,
          sensorType: getSensorType(sensorSize),
          cropFactor: getCropFactor(sensorSize),
        },
        lensSpecs: lensSpec ? lensSpecs : {
          focalLength: focalLength,
          maxAperture: aperture,
          minFocusDistance: minFocusDistance,
          fieldOfView: fieldOfView,
        },
        attachedLens: lensSpec ? {
          brand: lensSpec.brand,
          model: lensSpec.model,
        } : null,
      };
    }
    
    // Add lens-specific specs if it's a lens (for future lens attachment feature)
    if (isLens) {
      // Try to find real lens specs
      const lensSpec = findLensSpec(item.brand || '', item.model || ',')
                    || findLensSpecByBrand(item.brand || '');
      
      if (lensSpec) {
        const lensData = lensSpecToCameraData(lensSpec);
        
        assetData.lensData = {
          focalLength: lensData.focalLength,
          aperture: lensData.aperture,
          minFocusDistance: lensData.minFocusDistance,
          fieldOfView: lensData.fieldOfView,
        };
        
        assetData.userData = {
          ...assetData.userData,
          specifications: lensData.userData.specifications,
        };
        
        log.debug(`Found real lens specs for ${lensSpec.brand} ${lensSpec.model}`);
      } else {
        // Extract focal length and aperture from model name
        const defaultSpec = getDefaultLensSpec(extractFocalLengthFromModel(item.model || ''));
        
        assetData.lensData = {
          focalLength: defaultSpec.focalLength as number,
          aperture: defaultSpec.maxAperture as number,
          minFocusDistance: defaultSpec.minFocusDistance as number,
          fieldOfView: defaultSpec.fieldOfView as number,
        };
      }
    }
    
    // Add light-specific specs if it's a light
    if (isLight) {
      // Try to find real equipment specifications from database
      const realSpec = findLightSpec(item.brand || '', item.model || ',') 
                    || findLightSpecByBrand(item.brand || '');
      
      // User-provided specs from inventory
      const userSpecs = item.specifications || {};
      
      // Use real specs if found, otherwise fall back to user specs or defaults
      let rawPower: number;
      let beam: number;
      let cct: number;
      let cri: number | undefined;
      let flashDuration: number | undefined;
      let recycleTime: number | undefined;
      let hss: boolean | undefined;
      let ttl: boolean | undefined;
      let guideNumber: number | undefined;
      let lumens: number | undefined;
      let lux: number | undefined;
      let lightType: string;
      
      if (realSpec) {
        // Use real equipment specifications
        rawPower = realSpec.power;
        beam = realSpec.beamAngle;
        cct = realSpec.colorTemp;
        cri = realSpec.cri;
        flashDuration = realSpec.flashDuration;
        recycleTime = realSpec.recycleTime;
        hss = realSpec.hss;
        ttl = realSpec.ttl;
        guideNumber = realSpec.guideNumber;
        lumens = realSpec.lumens;
        lux = realSpec.lux;
        lightType = realSpec.type;
        
        log.debug(`Found real specs for ${realSpec.brand} ${realSpec.model}: ${rawPower}Ws, ${cct}K, ${beam}deg beam`);
      } else {
        // Fall back to user-provided or default specs
        rawPower = (userSpecs.power as number) || 500;
        beam = (userSpecs.beam as number) || 60;
        cct = (userSpecs.colorTemp as number) || 5600;
        cri = userSpecs.cri as number | undefined;
        lightType = getLightTypeFromKeywords(searchKey);
        
        log.debug(`No real specs found for ${item.brand} ${item.model}, using defaults`);
      }
      
      // Determine modifier type based on light type and equipment
      const modifier = realSpec 
        ? getLightModifierFromSpec(realSpec) 
        : getLightModifierType(item.brand, item.model, searchKey);
      
      // Get 3D model configuration
      const lightModelConfig = getLightModelConfig(item.brand, item.model, modifier);
      
      // Calculate normalized power based on light type
      // Strobes: 1000Ws = 1.0
      // Continuous: 600W = 1.0
      // Speedlites: 80GN = 1.0
      let normalizedPower: number;
      if (lightType === 'speedlite' && guideNumber) {
        normalizedPower = Math.min(1, guideNumber / 80);
      } else if (lightType === 'continuous' || lightType === 'led_panel') {
        normalizedPower = Math.min(1, rawPower / 600);
      } else {
        normalizedPower = Math.min(1, rawPower / 1000);
      }
      
      assetData.light = {
        power: normalizedPower,
        cct: cct,
        beam: beam,
        modifier: modifier,
        modifierSize: getModifierSize(modifier),
      };
      
      // Add 3D model configuration
      assetData.model3d = {
        type: lightModelConfig.modelType,
        proceduralType: lightModelConfig.proceduralType,
        brandStyle: lightModelConfig.brandStyle,
        modifierModelUrl: lightModelConfig.modifierModelUrl,
      };
      
      // Store detailed specifications in userData
      assetData.userData = {
        ...assetData.userData,
        wattage: rawPower,
        lightType: lightType,
        specifications: {
          power: rawPower,
          colorTemp: cct,
          colorTempRange: realSpec?.colorTempRange,
          beamAngle: beam,
          cri: cri,
          tlci: realSpec?.tlci,
          flashDuration: flashDuration,
          recycleTime: recycleTime,
          guideNumber: guideNumber,
          lumens: lumens,
          lux: lux,
          hss: hss,
          ttl: ttl,
          wireless: realSpec?.wireless,
          battery: realSpec?.battery,
          bicolor: realSpec?.bicolor,
          rgbw: realSpec?.rgbw,
          mountType: realSpec?.mountType,
        },
      };
    }
    
    // Dispatch event to add to scene
    const event = new CustomEvent('ch-add-asset-at', {
      detail: {
        asset: {
          type: nodeType,
          title: nodeName,
          data: assetData,
        },
        position: isLight 
          ? [-2, 2, 1] // Lights positioned to the side and above
          : isCamera 
            ? [3, 1.5, 3] // Cameras placed further back
            : [0, 1.5, 0], // Props in center
      },
    });
    window.dispatchEvent(event);
    
    if (onAddToScene) {
      onAddToScene(assetData);
    }
    
    const emoji = isLight ? '💡' : isCamera ? '📷' : isLens ? '🔭' : '🎬';
    
    // Build detailed message based on equipment type
    let detailMessage = '';
    
    if (isLight && assetData.userData?.specifications) {
      const specs = assetData.userData.specifications;
      const parts = [];
      if (specs.power) parts.push(`${specs.power}Ws`);
      if (specs.colorTemp) parts.push(`${specs.colorTemp}K`);
      if (specs.beamAngle) parts.push(`${specs.beamAngle}°`);
      if (specs.cri) parts.push(`CRI ${specs.cri}`);
      if (parts.length > 0) {
        detailMessage = ` (${parts.join('')})`;
      }
    }
    
    if (isCamera && assetData.camera) {
      const parts = [];
      const sensorType = assetData.userData?.cameraSpecs?.sensorType;
      if (sensorType) parts.push(sensorType);
      if (assetData.camera.focalLength) parts.push(`${assetData.camera.focalLength}mm`);
      if (assetData.camera.aperture) parts.push(`f/${assetData.camera.aperture}`);
      if (assetData.userData?.attachedLens) {
        parts.push(`w/ ${assetData.userData.attachedLens.model}`);
      }
      if (parts.length > 0) {
        detailMessage = ` (${parts.join(', ')})`;
      }
    }
    
    if (isLens && assetData.lensData) {
      const parts = [];
      if (assetData.lensData.focalLength) parts.push(`${assetData.lensData.focalLength}mm`);
      if (assetData.lensData.aperture) parts.push(`f/${assetData.lensData.aperture}`);
      if (assetData.userData?.specifications?.stabilization) parts.push('IS');
      if (parts.length > 0) {
        detailMessage = ` (${parts.join(', ')})`;
      }
    }
    
    addToast({
      message: `${emoji} ${nodeName} added to scene${detailMessage}`,
      type: 'success',
      duration: 3000,
    });
  };
  
  // Helper to get light type from keywords
  const getLightTypeFromKeywords = (searchKey: string): string => {
    const key = searchKey.toLowerCase();
    
    if (key.includes('speedlite') || key.includes('speedlight') || key.includes('flash')) {
      return 'speedlite';
    }
    if (key.includes('strobe') || key.includes('ad600') || key.includes('ad400') || 
        key.includes('d2') || key.includes('b10') || key.includes('b1x') ||
        key.includes('elc') || key.includes('siros')) {
      return 'strobe';
    }
    if (key.includes('led') || key.includes('continuous') || key.includes('sl-') ||
        key.includes('vl') || key.includes('amaran') || key.includes('forza') ||
        key.includes('600d') || key.includes('300d') || key.includes('120d')) {
      return 'continuous';
    }
    if (key.includes('panel') || key.includes('mc') || key.includes('pavotube')) {
      return 'led_panel';
    }
    if (key.includes('fresnel')) {
      return 'fresnel';
    }
    
    return 'strobe'; // Default to strobe
  };
  
  // Helper to get modifier from light spec
  const getLightModifierFromSpec = (spec: LightSpec): string => {
    switch (spec.type) {
      case 'speedlite':
        return 'flash';
      case 'led_panel':
        return 'panel';
      case 'fresnel':
        return 'spot';
      case 'continuous':
        // Continuous lights often use softboxes or spots
        if (spec.beamAngle && spec.beamAngle < 60) {
          return 'spot';
        }
        return 'softbox';
      case 'strobe':
      default:
        // Strobes typically use softboxes
        return 'softbox';
    }
  };
  
  // Helper to determine light modifier type
  const getLightModifierType = (brand?: string, model?: string, searchKey?: string): string => {
    const key = searchKey || `${brand || ', '} ${model || ', '}`.toLowerCase();
    
    // Speedlites/Flashes
    if (key.includes('speedlite') || key.includes('speedlight') || key.includes('v1') || 
        key.includes('v860') || key.includes('tt685') || key.includes('sb-') ||
        key.includes('hvl-') || key.includes('el-1') || key.includes('600ex') ||
        key.includes('580ex') || key.includes('430ex') || key.includes('a1') ||
        key.includes('ad200') || key.includes('ad100')) {
      return 'flash';
    }
    
    // Spot lights / Fresnels
    if (key.includes('fresnel') || key.includes('spot') || key.includes('200d') || key.includes('300d')) {
      return 'spot';
    }
    
    // Beauty dishes
    if (key.includes('beauty') || key.includes('dish')) {
      return 'beautydish';
    }
    
    // Ring lights
    if (key.includes('ring')) {
      return 'ring';
    }
    
    // LED Panels
    if (key.includes('panel') || key.includes('astra') || key.includes('lykos') ||
        key.includes('pavotube') || key.includes('mc pro')) {
      return 'panel';
    }
    
    // Umbrellas
    if (key.includes('umbrella')) {
      return 'umbrella';
    }
    
    // Default to softbox for studio strobes
    return 'softbox';
  };
  
  // Helper to get modifier size based on type
  const getModifierSize = (modifier: string): [number, number] => {
    switch (modifier) {
      case 'flash': return [0.1, 0.1];
      case 'spot': return [0.2, 0.2];
      case 'beautydish': return [0.55, 0.55];
      case 'ring': return [0.45, 0.45];
      case 'panel': return [0.3, 0.45];
      case 'umbrella': return [0.8, 0.8];
      case 'octabox': return [1.2, 1.2];
      case 'stripbox': return [0.3, 1.2];
      case 'softbox': 
      default: return [0.6, 0.6];
    }
  };
  
  // =====================================================
  // SENSOR HELPERS
  // =====================================================
  
  /**
   * Get sensor type name from dimensions
   */
  const getSensorType = (sensorSize: [number, number]): string => {
    const [width, height] = sensorSize;
    const diagonal = Math.sqrt(width ** 2 + height ** 2);
    
    if (diagonal >= 42 && diagonal <= 44) return 'Full Frame';
    if (diagonal >= 50) return 'Medium Format';
    if (diagonal >= 27 && diagonal <= 30) return 'APS-C';
    if (diagonal >= 20 && diagonal <= 23) return 'Micro Four Thirds';
    if (diagonal >= 15 && diagonal <= 17) return '1-inch';
    return 'Custom';
  };
  
  /**
   * Get crop factor relative to full-frame (43.3mm diagonal)
   */
  const getCropFactor = (sensorSize: [number, number]): number => {
    const [width, height] = sensorSize;
    const diagonal = Math.sqrt(width ** 2 + height ** 2);
    const fullFrameDiagonal = 43.3;
    return Math.round((fullFrameDiagonal / diagonal) * 100) / 100;
  };
  
  /**
   * Extract focal length from model name
   */
  const extractFocalLengthFromModel = (model: string): number | undefined => {
    // Match patterns like "50mm""24-70mm""35 mm"
    const primeMatch = model.match(/(\d+)\s*mm/i);
    if (primeMatch) {
      return parseInt(primeMatch[1]);
    }
    
    // Match zoom range - return wide end
    const zoomMatch = model.match(/(\d+)\s*-\s*(\d+)\s*mm/i);
    if (zoomMatch) {
      return parseInt(zoomMatch[1]);
    }
    
    return undefined;
  };
  
  // =====================================================
  // 3D MODEL MAPPING - Connect equipment to GLB models
  // =====================================================
  
  /**
   * Get the 3D model path for light modifiers
   * Maps to existing GLB files in /models/modifiers/
   */
  const getModifierModelPath = (modifier: string): string | null => {
    const modifierModelPaths: Record<string, string> = {
      'softbox':'/models/modifiers/softbox/softbox.glb','beautydish':'/models/modifiers/beauty-dish/beauty-dish.glb','octabox':'/models/modifiers/octabox/octabox.glb','stripbox':'/models/modifiers/stripbox/stripbox.glb','reflector':'/models/modifiers/reflector/reflector.glb','standard' : '/models/modifiers/standard-reflector/standard-reflector.glb',
    };
    return modifierModelPaths[modifier] || null;
  };
  
  /**
   * Get light brand styling for procedural generation
   * Matches EquipmentModelGenerator brand styling
   */
  const getLightBrandStyle = (brand?: string): 'profoto' | 'godox' | 'aputure' | 'generic' => {
    const b = (brand || ', ').toLowerCase();
    if (b.includes('profoto')) return 'profoto';
    if (b.includes('godox')) return 'godox';
    if (b.includes('aputure')) return 'aputure';
    return 'generic';
  };
  
  /**
   * Get 3D model configuration for cameras
   */
  const getCameraModelConfig = (brand?: string, model?: string): { 
    modelType: 'procedural' | 'glb';
    modelUrl?: string;
    proceduralType?: string;
  } => {
    // Currently using procedural camera model generation
    // In future, specific camera GLBs can be added here
    return {
      modelType: 'procedural',
      proceduralType: 'camera',
    };
  };
  
  /**
   * Get 3D model configuration for lights/flashes
   */
  const getLightModelConfig = (
    brand?: string, 
    model?: string, 
    modifier?: string
  ): { 
    modelType: 'procedural' | 'glb';
    modelUrl?: string;
    proceduralType?: string;
    brandStyle?: 'profoto' | 'godox' | 'aputure' | 'generic';
    modifierModelUrl?: string;
  } => {
    const brandStyle = getLightBrandStyle(brand);
    const modifierModelUrl = modifier ? getModifierModelPath(modifier) : null;
    
    return {
      modelType: 'procedural',
      proceduralType: 'studio_light',
      brandStyle,
      modifierModelUrl: modifierModelUrl || undefined,
    };
  };
  
  // Helper to get sensor size based on camera brand/model
  const getSensorSizeForCamera = (brand?: string, model?: string): [number, number] => {
    const searchKey = `${brand || ', '} ${model || ', '}`.toLowerCase();
    
    // Full-frame cameras
    if (
      searchKey.includes('a7') || searchKey.includes('a9') || searchKey.includes('a1') ||
      searchKey.includes('eos r5') || searchKey.includes('eos r6') || searchKey.includes('eos r3') ||
      searchKey.includes('5d') || searchKey.includes('6d') ||
      searchKey.includes('z5') || searchKey.includes('z6') || searchKey.includes('z7') || 
      searchKey.includes('z8') || searchKey.includes('z9') || searchKey.includes('zf') ||
      searchKey.includes('d850') || searchKey.includes('d780') || searchKey.includes('d750') ||
      searchKey.includes('s1') || searchKey.includes('s5') ||
      searchKey.includes('sl2') || searchKey.includes('m11') || searchKey.includes('q3')
    ) {
      return [36, 24]; // Full-frame
    }
    
    // APS-C cameras (Canon)
    if (searchKey.includes('90d') || searchKey.includes('7d') || searchKey.includes('eos r7')) {
      return [22.3, 14.9]; // Canon APS-C
    }
    
    // APS-C cameras (Sony/Nikon/Fuji)
    if (
      searchKey.includes('a6') || searchKey.includes('zv-e10') ||
      searchKey.includes('z50') || searchKey.includes('d500') ||
      searchKey.includes('x-t') || searchKey.includes('x-h') || searchKey.includes('x-s')
    ) {
      return [23.5, 15.6]; // APS-C
    }
    
    // Medium format (Fuji GFX, Hasselblad)
    if (searchKey.includes('gfx') || searchKey.includes('hasselblad')) {
      return [43.8, 32.9]; // Medium format
    }
    
    // Micro Four Thirds (Panasonic GH, Olympus)
    if (searchKey.includes('gh') || searchKey.includes('olympus') || searchKey.includes('om-')) {
      return [17.3, 13]; // MFT
    }
    
    // Default to full-frame
    return [36, 24];
  };
  
  // Get condition color
  const getConditionColor = (condition?: string) => {
    switch (condition) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'fair': return 'warning';
      case 'poor': return 'error';
      default: return 'default';
    }
  };
  
  // Get status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'in-use': return 'primary';
      case 'maintenance': return 'warning';
      case 'rented-out': return 'error';
      default: return 'default';
    }
  };

  const handleDragStart = (eq: EquipmentSpec, e: React.DragEvent) => {
    setDraggingItem(eq);

    let node: unknown;
    if (eq.category === 'lighting' || eq.category === 'flash') {
      node = equipmentToLightNode(eq);
    } else if (eq.category === 'cameras') {
      node = equipmentToCameraNode(eq);
    }

    if (node) {
      const asset = {
        type: node.type,
        title: node.name,
        data: node,
      };

      e.dataTransfer.setData('application/json', JSON.stringify({ asset }));
      e.dataTransfer.effectAllowed = 'copy';
    }
  };

  const handleDragEnd = () => {
    setDraggingItem(null);
  };

  const getEquipmentIcon = (category: string) => {
    switch (category) {
      case 'lighting':
      case 'flash':
        return <LightIcon />;
      case 'cameras':
        return <CameraIcon />;
      case 'lenses':
        return <LensIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const formatPrice = (eq: EquipmentSpec) => {
    if (!eq.price?.msrp) return null;
    return `${eq.price.msrp.toLocaleString()} ${eq.price.currency}`;
  };

  const getSpecsSummary = (eq: EquipmentSpec) => {
    const specs: string[] = [];

    if (eq.specifications.power) {
      specs.push(`${eq.specifications.power}W`);
    }
    if (eq.specifications.beam) {
      specs.push(`${eq.specifications.beam}°`);
    }
    if (eq.specifications.colorTemp) {
      specs.push(`${eq.specifications.colorTemp}K`);
    }
    if (eq.specifications.focalLength) {
      const fl = eq.specifications.focalLength;
      specs.push(Array.isArray(fl) ? `${fl[0]}-${fl[1]}mm` : `${fl}mm`);
    }
    if (eq.specifications.maxAperture) {
      specs.push(`f/${eq.specifications.maxAperture}`);
    }
    if (eq.specifications.sensor) {
      specs.push(`${eq.specifications.sensor[0]}×${eq.specifications.sensor[1]}mm`);
    }

    return specs.join(' • ');
  };

  return (
    <Box>
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab 
          icon={
            <Badge badgeContent={userInventory.length} color="success" max={99}>
              <MyGearIcon />
            </Badge>
          } 
          label="My Gear" 
          value="mygear" 
        />
        <Tab icon={<LightIcon />} label="Lighting" value="lighting" />
        <Tab icon={<CameraIcon />} label="Cameras" value="cameras" />
        <Tab icon={<LensIcon />} label="Lenses" value="lenses" />
        <Tab icon={<PopularIcon />} label="Popular" value="popular" />
      </Tabs>

      <Box sx={{ p: 2 }}>
        {/* ========== MY GEAR TAB CONTENT ========== */}
        {activeTab === 'mygear' && (
          <>
            {/* Header with View Toggle */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  📦 My Equipment Inventory
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {inventoryLoading ? 'Loading...' : `${filteredUserInventory.length} items from your Dashboard`}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="Grid View">
                  <IconButton 
                    size="small"
                    onClick={() => setViewMode('grid')}
                    color={viewMode === 'grid' ? 'primary' : 'default'}
                  >
                    <GridViewIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="List View">
                  <IconButton 
                    size="small"
                    onClick={() => setViewMode('list')}
                    color={viewMode === 'list' ? 'primary' : 'default'}
                  >
                    <ListViewIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Refresh">
                  <IconButton size="small" onClick={refreshInventory} disabled={inventoryLoading}>
                    <SearchIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            {/* Search for My Gear */}
            <TextField
              fullWidth
              size="small"
              placeholder="Search your equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />}}
            />
            
            {/* Loading */}
            {inventoryLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}
            
            {/* Empty State */}
            {!inventoryLoading && filteredUserInventory.length === 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={600}>
                  No equipment in your inventory
                </Typography>
                <Typography variant="caption">
                  Add equipment in Dashboard → Equipment tab to see it here. Your gear will appear with images from Wikimedia Commons.
                </Typography>
              </Alert>
            )}
            
            {/* Grid View */}
            {!inventoryLoading && viewMode === 'grid' && filteredUserInventory.length > 0 && (
              <Grid container spacing={2}>
                {filteredUserInventory.map((item) => (
                  <Grid item xs={12} sm={6} md={4} key={item.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: 'success.main', '&:hover': {
                          boxShadow: 4,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s',
                        }}}
                    >
                      {/* Equipment Image from Wikimedia Commons */}
                      <CardMedia
                        component="img"
                        height="140"
                        image={getEquipmentImageUrl(item)}
                        alt={item.name}
                        sx={{ objectFit: 'contain', bgcolor: 'grey.100', p: 1 }}
                        onError={(e) => {
                          // Fallback if image fails to load
                          (e.target as HTMLImageElement).src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Canon_EOS_5D_Mark_III.jpg/320px-Canon_EOS_5D_Mark_III.jpg';
                        }}
                      />
                      
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, bgcolor: 'success.main' }}>
                            <OwnedIcon sx={{ fontSize: 14 }} />
                          </Avatar>
                          <Typography variant="caption" color="text.secondary">
                            {item.brand || 'Unknown Brand'}
                          </Typography>
                        </Box>
                        
                        <Typography variant="subtitle2" gutterBottom noWrap fontWeight={600}>
                          {item.model || item.name}
                        </Typography>
                        
                        {item.category && (
                          <Chip 
                            label={item.category} 
                            size="small" 
                            variant="outlined"
                            sx={{ mb: 1 }}
                          />
                        )}
                        
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                          {item.condition && (
                            <Chip 
                              icon={<ConditionIcon sx={{ fontSize: 14 }} />}
                              label={item.condition}
                              size="small"
                              color={getConditionColor(item.condition) as any}
                              variant="outlined"
                            />
                          )}
                          {item.status && (
                            <Chip 
                              label={item.status.replace('-', ', ')}
                              size="small"
                              color={getStatusColor(item.status) as any}
                            />
                          )}
                        </Box>
                        
                        {item.location && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                            <LocationIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {item.location}
                            </Typography>
                          </Box>
                        )}
                        
                        <Button
                          fullWidth
                          variant="contained"
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => handleAddInventoryItemToScene(item)}
                          sx={{ mt: 1 }}
                        >
                          Add to Scene
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
            
            {/* List View */}
            {!inventoryLoading && viewMode === 'list' && filteredUserInventory.length > 0 && (
              <List>
                {filteredUserInventory.map((item) => (
                  <ListItem 
                    key={item.id}
                    sx={{ 
                      mb: 1, 
                      bgcolor: 'background.paper', 
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'success.light'}}
                    secondaryAction={
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleAddInventoryItemToScene(item)}
                      >
                        Add
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar 
                        src={getEquipmentImageUrl(item)}
                        variant="rounded"
                        sx={{ width: 56, height: 56, mr: 1, bgcolor: 'grey.100' }}
                      >
                        <CameraIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {item.brand} {item.model || item.name}
                          </Typography>
                          <OwnedIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                          {item.category && (
                            <Chip label={item.category} size="small" variant="outlined" />
                          )}
                          {item.condition && (
                            <Chip 
                              label={item.condition} 
                              size="small" 
                              color={getConditionColor(item.condition) as any}
                              variant="outlined"
                            />
                          )}
                          {item.status && (
                            <Chip 
                              label={item.status.replace('-','')} 
                              size="small"
                              color={getStatusColor(item.status) as any}
                            />
                          )}
                          {item.location && (
                            <Chip 
                              icon={<LocationIcon sx={{ fontSize: 12 }} />}
                              label={item.location} 
                              size="small" 
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}
        
        {/* ========== OTHER TABS CONTENT ========== */}
        
        {/* My Equipment Toggle (for Lighting/Cameras/Lenses tabs) */}
        {activeTab !== 'popular' && activeTab !== 'mygear' && (
          <Box 
            sx={{ 
              mb: 2, 
              p: 1.5, 
              borderRadius: 1, 
              bgcolor: showOwnedOnly ? 'primary.dark' : 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'background-color 0.2s'}}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon sx={{ color: showOwnedOnly ? 'primary.light' : 'text.secondary' }} />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Filter by Owned
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {inventoryLoading ? 'Loading...' : `${ownedCount} owned in this category`}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {ownedCount > 0 && !showOwnedOnly && (
                <Chip 
                  size="small" 
                  label={`${ownedCount} owned`}
                  color="success"
                  variant="outlined"
                />
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={showOwnedOnly}
                    onChange={(e) => {
                      setShowOwnedOnly(e.target.checked);
                      if (e.target.checked && ownedCount === 0) {
                        addToast({
                          message: 'No owned equipment found in this category. Add equipment in Dashboard > Equipment.',
                          type: 'info',
                          duration: 4000,
                        });
                      }
                    }}
                    color="primary"
                    disabled={inventoryLoading}
                  />
                }
                label={
                  <Typography variant="body2">
                    {showOwnedOnly ? 'Showing owned' : 'Show all'}
                  </Typography>
                }
                labelPlacement="start"
                sx={{ m: 0 }}
              />
            </Box>
          </Box>
        )}
        
        {/* Inventory Error Alert */}
        {inventoryError && activeTab !== 'mygear' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Could not load your equipment inventory. {inventoryError}
          </Alert>
        )}

        {/* Search and Filters (for Lighting/Cameras/Lenses tabs) */}
        {activeTab !== 'popular' && activeTab !== 'mygear' && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search equipment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />}}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Brand</InputLabel>
                <Select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  label="Brand"
                >
                  <MenuItem value="">All Brands</MenuItem>
                  {brands[activeTab as keyof typeof brands]?.map((brand) => (
                    <MenuItem key={brand} value={brand}>
                      {brand}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        )}

        {/* Loading (for Lighting/Cameras/Lenses tabs) */}
        {loading && activeTab !== 'mygear' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Equipment Grid (for Lighting/Cameras/Lenses tabs) */}
        {!loading && activeTab !== 'popular' && activeTab !== 'mygear' && (
          <Grid container spacing={2}>
            {filteredEquipment.length === 0 ? (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  {showOwnedOnly 
                    ? 'No owned equipment found in this category. Add equipment in Dashboard → Equipment tab.'
                    : 'No equipment found. Try adjusting your filters.'}
                </Typography>
              </Grid>
            ) : (
              filteredEquipment.slice(0, 20).map((eq) => {
                const equipmentIsOwned = isOwned(eq.brand, eq.model);
                return (
                  <Grid item xs={12} sm={6} md={4} key={eq.id}>
                    <Card
                      draggable
                      onDragStart={(e) => handleDragStart(eq, e)}
                      onDragEnd={handleDragEnd}
                      sx={{
                        cursor: 'grab',
                        opacity: draggingItem?.id === eq.id ? 0.5 : 1,
                        border: equipmentIsOwned ? '2px solid' : '1px solid',
                        borderColor: equipmentIsOwned ? 'success.main' : 'divider', '&:hover': {
                          boxShadow: 3,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s',
                        }}}
                    >
                      {/* Owned Badge */}
                      {equipmentIsOwned && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 1,
                            bgcolor: 'success.main',
                            color: 'white',
                            borderRadius: '12px',
                            px: 1,
                            py: 0.25,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5}}
                        >
                          <OwnedIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption" fontWeight={600}>
                            OWNED
                          </Typography>
                        </Box>
                      )}
                      
                      <Box sx={{ position: 'relative' }}>
                        {eq.images?.[0] && (
                          <CardMedia
                            component="img"
                            height="140"
                            image={eq.images[0]}
                            alt={eq.model}
                            sx={{ objectFit: 'contain', bgcolor: 'grey.100', p: 1 }}
                          />
                        )}
                      </Box>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, bgcolor: equipmentIsOwned ? 'success.main' : 'primary.main' }}>
                            {getEquipmentIcon(eq.category)}
                          </Avatar>
                          <Typography variant="caption" color="text.secondary">
                            {eq.brand}
                          </Typography>
                        </Box>

                        <Typography variant="subtitle2" gutterBottom noWrap>
                          {eq.model}
                        </Typography>

                        {getSpecsSummary(eq) && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            gutterBottom
                          >
                            {getSpecsSummary(eq)}
                          </Typography>
                        )}

                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mt: 1}}
                        >
                          {formatPrice(eq) && (
                            <Chip
                              label={formatPrice(eq)}
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          )}
                          <Tooltip title="Add to scene">
                            <IconButton
                              size="small"
                              onClick={() => handleAddToScene(eq)}
                              color="primary"
                            >
                              <AddIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                          <DragIcon sx={{ fontSize: 14, color: 'action.disabled' }} />
                          <Typography variant="caption" color="text.secondary">
                            Drag to viewport
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })
            )}
          </Grid>
        )}

        {/* Popular Setups */}
        {!loading && activeTab === 'popular' && (
          <List>
            {popularSetups.map((setup, idx) => (
              <ListItem key={idx} sx={{ mb: 2, bgcolor:'background.paper', borderRadius: 1 }}>
                <ListItemAvatar>
                  <Avatar>
                    <PopularIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={setup.name}
                  secondary={
                    <>
                      <Typography variant="body2" color="text.secondary">
                        {setup.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {setup.equipment.length} items • {setup.cost.toLocaleString()} NOK
                      </Typography>
                    </>
                  }
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setup.equipment.forEach((eq: EquipmentSpec) => handleAddToScene(eq));
                  }}
                >
                  Add Setup
                </Button>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
