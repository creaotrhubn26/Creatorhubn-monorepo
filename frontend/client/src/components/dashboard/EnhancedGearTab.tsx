// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import { isProfessionFeatureAvailable } from '../../../../shared/profession-feature-matrix';
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { getProfessionIcon } from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Autocomplete,
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  TextField,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Paper,
  Stack,
  Rating,
  IconButton,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Search,
  ExpandMore,
  TrendingUp,
  OpenInNew,
  Close,
  Info,
  FiberNew,
  CheckCircle,
  Update,
  Warning,
  Category,
  Notifications,
  NotificationsActive,
} from '@mui/icons-material';

// Import custom CreatorHub icons for better visual quality
import {
  // Professional equipment icons
  ProfessionalCameraIcon as Camera,
  VideocamIcon as Videocam,
  MusicNoteIcon as LibraryMusic,
  BusinessIcon as Business,
  
  // Equipment management specific icons
  EquipmentDatabaseIcon as DatabaseIcon,
  EquipmentInventoryIcon,
  EquipmentMaintenanceIcon,
  EquipmentRentalIcon,
  MarketPricesIcon,
  SoftwareDatabaseIcon,
  EquipmentToolsIcon,
  EquipmentNewsIcon,
  FirmwareUpdateIcon,
  
  // Supporting icons
  SettingsIcon as Settings,
  ArticleIcon as Article,
  MemoryCardIcon as Memory,
  SecurityIcon as Security,
  BugReportIcon as BugReport,
  ShoppingBagIcon as ShoppingCart,
  EnhancedMonetizationIcon as MonetizationOn,
  AttachMoneyIcon as AttachMoney,
  SpeedIcon as Schedule,
} from '../shared/CreatorHubIcons';
import ComprehensiveGearDatabase from './ComprehensiveGearDatabase';
import KeyboardShortcutsTools from '../tools/KeyboardShortcutsToolsNew';

interface EnhancedGearTabProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  className?: string;
  // Integration props for universal connectivity
  onEquipmentUpdate?: (equipment: any) => void;
  onProjectUpdate?: (project: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

interface InventoryFormState {
  name: string;
  brand: string;
  model: string;
  category: string;
  status: string;
  condition: string;
  imageUrl: string;
  notes: string;
}

interface InventoryEquipmentItem {
  id: number | string;
  name?: string | null;
  brand: string;
  model: string;
  category?: string | null;
  status?: string | null;
  condition?: string | null;
  currentValue?: number | null;
  imageUrl?: string | null;
  supplierUrl?: string | null;
  purchaseVendor?: string | null;
  catalogDescription?: string | null;
  catalogSpecifications?: Record<string, unknown> | null;
  imageSource?: string | null;
  specifications?: Record<string, unknown> | null;
  recommendedMemoryCards?: InventoryRecommendedMemoryCard[];
}

interface EquipmentCatalogItem {
  id?: number | string;
  brand: string;
  model: string;
  category?: string | null;
  imageUrl?: string | null;
}

interface InventoryRecommendedMemoryCard {
  id: string;
  name: string;
  fullName: string;
  category: string;
  commonCapacities: string[];
  videoClass?: string;
  uhsClass?: string;
  description: string;
  color: string;
}

interface InventoryFirmwareUpdate {
  id: number | string;
  deviceBrand: string;
  deviceModel: string;
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  priority: string;
  description: string;
  downloadUrl?: string;
  status?: string;
  urlKind?: 'direct-download' | 'model-support' | 'brand-portal';
}

const createEmptyInventoryForm = (): InventoryFormState => ({
  name: '',
  brand: '',
  model: '',
  category: '',
  status: 'available',
  condition: 'excellent',
  imageUrl: '',
  notes: '',
});

const normalizeInventoryCatalogToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const inventoryCatalogCategoryMap: Record<string, string> = {
  kamera: 'cameras',
  kameraer: 'cameras',
  camera: 'cameras',
  cameras: 'cameras',
  objektiv: 'lenses',
  objektiver: 'lenses',
  optics: 'lenses',
  optikk: 'lenses',
  lens: 'lenses',
  lenses: 'lenses',
  blits: 'flash',
  flash: 'flash',
  light: 'flash',
  lighting: 'flash',
  lys: 'flash',
  belysning: 'flash',
  lyd: 'audio',
  audio: 'audio',
  sound: 'audio',
  interface: 'audio',
  monitorer: 'audio',
  mikrofoner: 'audio',
  video: 'video',
  cinema: 'video',
  stativ: 'accessories',
  stativer: 'accessories',
  tripod: 'accessories',
  tripods: 'accessories',
  rigg: 'accessories',
  tilbehor: 'accessories',
  accessories: 'accessories',
  accessory: 'accessories',
  support: 'accessories',
  software: 'software',
  programvare: 'software',
  daw: 'software',
  plugins: 'software',
  plugin: 'software',
};

const normalizeInventoryCatalogCategory = (value: string): string =>
  inventoryCatalogCategoryMap[normalizeInventoryCatalogToken(value)] || '';

const makeInventoryDeviceLookupKey = (brand: string, model: string): string =>
  `${normalizeInventoryCatalogToken(brand)}::${normalizeInventoryCatalogToken(model)}`;

const uniqueSortedInventoryValues = (values: Array<string | null | undefined>): string[] =>
  Array.from(
    new Set(
      values.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      ),
    ),
  ).sort((left, right) => left.localeCompare(right, 'nb'));

type InventorySpecificationHighlight = {
  label: string;
  value: string;
};

const formatInventorySpecificationValue = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Ja' : 'Nei';
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
};

const getInventorySpecificationHighlights = (
  item: InventoryEquipmentItem,
): InventorySpecificationHighlight[] => {
  const catalogSpecifications = item.catalogSpecifications || {};
  const fallbackSpecifications = item.specifications || {};
  const specificationSource = {
    ...catalogSpecifications,
    ...fallbackSpecifications,
  } as Record<string, unknown>;
  const normalizedCategory = normalizeInventoryCatalogCategory(item.category || '');

  const cameraKeys: Array<{ key: string; label: string; transform?: (value: string) => string }> = [
    { key: 'sensorSize', label: 'Sensor' },
    { key: 'megapixels', label: 'MP', transform: (value) => `${value} MP` },
    { key: 'mount', label: 'Fatning' },
    { key: 'videoResolution', label: 'Video' },
    { key: 'videoFrameRates', label: 'FPS' },
  ];

  const lensKeys: Array<{ key: string; label: string }> = [
    { key: 'focalLength', label: 'Brennvidde' },
    { key: 'maxAperture', label: 'Lysstyrke' },
    { key: 'mount', label: 'Fatning' },
  ];

  const audioKeys: Array<{ key: string; label: string }> = [
    { key: 'channels', label: 'Kanaler' },
    { key: 'rangeMeters', label: 'Rekkevidde' },
    { key: 'batteryHours', label: 'Batteri' },
  ];

  const prioritizedKeys =
    normalizedCategory === 'cameras' || normalizedCategory === 'video'
      ? cameraKeys
      : normalizedCategory === 'lenses'
        ? lensKeys
        : normalizedCategory === 'audio'
          ? audioKeys
          : [];

  const highlights = prioritizedKeys
    .map((entry) => {
      const formatted = formatInventorySpecificationValue(specificationSource[entry.key]);
      if (!formatted) return null;
      return {
        label: entry.label,
        value: entry.transform ? entry.transform(formatted) : formatted,
      };
    })
    .filter((entry): entry is InventorySpecificationHighlight => Boolean(entry));

  if (highlights.length > 0) {
    return highlights.slice(0, 4);
  }

  return Object.entries(specificationSource)
    .filter(([key]) => !['notes', 'supportedMemoryCardTypes', 'supportedMemoryCardLabels'].includes(key))
    .map(([key, value]) => {
      const formatted = formatInventorySpecificationValue(value);
      if (!formatted) return null;

      return {
        label: key,
        value: formatted,
      };
    })
    .filter((entry): entry is InventorySpecificationHighlight => Boolean(entry))
    .slice(0, 3);
};

export function EnhancedGearTab({ 
  profession, 
  className, 
  onEquipmentUpdate,
  onProjectUpdate,
  selectedProject,
  onProjectSelect
}: EnhancedGearTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Master Integration System
  const { features, analytics, performance } = useEnhancedMasterIntegration();
  
  // Toast notification system
  const { addToast } = useVisualEditor();
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  const { professionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>('database');
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [readMoreOpen, setReadMoreOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const [firmwareSyncing, setFirmwareSyncing] = useState(false);
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false);
  const [inventoryForm, setInventoryForm] = useState<InventoryFormState>(() => createEmptyInventoryForm());

  // Get current user ID before any hooks depend on it
  const { user } = useAuth();
  const userId = user?.id || 'guest';
  const queryClient = useQueryClient();
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);
  
  // Feature Access with Profession Feature Matrix
  const gearDatabaseAccess = useMemo(() => 
    isProfessionFeatureAvailable(profession, 'equipment-database') &&
    features.checkFeatureAccess('equipment-database').hasAccess,
    [profession, features]
  );
  
  const gearNewsAccess = useMemo(() => 
    isProfessionFeatureAvailable(profession, 'gear-news') &&
    features.checkFeatureAccess('gear-news').hasAccess,
    [profession, features]
  );
  
  const toolsAccess = useMemo(() => 
    isProfessionFeatureAvailable(profession, 'keyboard-shortcuts') &&
    features.checkFeatureAccess('keyboard-shortcuts').hasAccess,
    [profession, features]
  );

  // Equipment subtabs configuration - EXTENDED WITH ALL DATABASE FEATURES
  // Using custom equipment-specific icons for better visual clarity
  const equipmentTabs = useMemo(
    () => [
      { id: 'database', label: 'Utstyr Database', icon: DatabaseIcon },
      { id: 'inventory', label: 'Mitt Utstyr', icon: EquipmentInventoryIcon },
      { id: 'maintenance', label: 'Vedlikehold', icon: EquipmentMaintenanceIcon },
      { id: 'rentals', label: 'Utleie', icon: EquipmentRentalIcon },
      { id: 'market', label: 'Markedspriser', icon: MarketPricesIcon },
      { id: 'software', label: 'Programvare', icon: SoftwareDatabaseIcon },
      { id: 'tools', label: 'Verktøy', icon: EquipmentToolsIcon },
      { id: 'news', label: 'Nyheter', icon: EquipmentNewsIcon }
    ],
    []
  );

  const dynamicProfessionConfig = professionConfigs[profession];
  const professionDashboardTitle = professionAdapter.adaptDashboardTitle();
  const adaptedTabLabels = professionAdapter.adaptTabLabels();
  const projectLabel = selectedProject?.name || selectedProject?.title || null;
  const visibleEquipmentTabs = useMemo(
    () =>
      equipmentTabs.filter((tab) => {
        if (tab.id === 'database') return gearDatabaseAccess;
        if (tab.id === 'tools') return toolsAccess;
        if (tab.id === 'news') return gearNewsAccess;
        return true;
      }),
    [gearDatabaseAccess, gearNewsAccess, toolsAccess]
  );
  const activeTabId = visibleEquipmentTabs[currentTab]?.id || visibleEquipmentTabs[0]?.id || 'database';
  const navigateToTab = useCallback(
    (tabId: string) => {
      const tabIndex = visibleEquipmentTabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex >= 0) {
        setCurrentTab(tabIndex);
      }
    },
    [visibleEquipmentTabs]
  );

  useEffect(() => {
    if (currentTab >= visibleEquipmentTabs.length) {
      setCurrentTab(0);
    }
  }, [currentTab, visibleEquipmentTabs.length]);

  useEffect(() => {
    const activeTab = visibleEquipmentTabs[currentTab];
    if (!activeTab) {
      return;
    }

    const endTiming = performance.startTiming(`gear_tab_${activeTab.id}`);
    analytics.trackEvent('gear_tab_opened', {
      profession,
      tabId: activeTab.id,
      projectId: selectedProject?.id || null,
    });
    features.trackFeatureUsage('enhanced-gear-tab', 'tab_opened', {
      profession,
      tabId: activeTab.id,
      projectId: selectedProject?.id || null,
    });

    return () => {
      endTiming();
    };
  }, [analytics, currentTab, features, performance, profession, selectedProject?.id, visibleEquipmentTabs]);

  const handleEquipmentFlow = useCallback(
    (equipmentName: string, source: 'create' | 'selected', payload?: Record<string, unknown>) => {
      const contextPayload = {
        name: equipmentName,
        profession,
        source,
        projectId: selectedProject?.id || null,
        projectName: projectLabel,
        ...payload,
      };

      onEquipmentUpdate?.(contextPayload);
      onProjectUpdate?.({
        ...(selectedProject || {}),
        lastEquipmentActionAt: new Date().toISOString(),
        lastEquipmentName: equipmentName,
      });
      analytics.trackEvent('gear_equipment_context_updated', contextPayload);
      features.trackFeatureUsage('equipment-inventory', source, contextPayload);
    },
    [analytics, features, onEquipmentUpdate, onProjectUpdate, profession, projectLabel, selectedProject]
  );

  const handleProjectFocus = useCallback(() => {
    if (!selectedProject || !onProjectSelect) {
      return;
    }

    onProjectSelect(selectedProject);
    analytics.trackEvent('gear_project_context_opened', {
      profession,
      projectId: selectedProject.id || null,
    });
  }, [analytics, onProjectSelect, profession, selectedProject]);

  const focusShortcutWorkspace = useCallback(() => {
    navigateToTab('tools');
    requestAnimationFrame(() => {
      document.getElementById('gear-tools-shortcuts')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
    analytics.trackEvent('gear_shortcut_workspace_focused', { profession });
    features.trackFeatureUsage('keyboard-shortcuts', 'focused-from-tools', { profession });
  }, [analytics, features, navigateToTab, profession]);

  const openAccessoryToolkit = useCallback(() => {
    setSearchQuery('minnekort');
    setSelectedCategory('Tilbehør');
    navigateToTab('database');
    analytics.trackEvent('gear_accessory_toolkit_opened', { profession });
    features.trackFeatureUsage('equipment-database', 'accessory-toolkit-opened', { profession });
  }, [analytics, features, navigateToTab, profession]);

  // Fetch firmware status
  const { data: firmwareData, isLoading: firmwareLoading, refetch: refetchFirmwareData } = useQuery({
    queryKey: ['/api/gear-news/firmware', profession],
    queryFn: async () => {
      const response = await fetch(`/api/gear-news/${profession}/firmware`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
  }
      return response.json();
},
    refetchInterval: 30 * 60 * 100, // 30 minutes
    staleTime: 10 * 60 * 100, // 10 minutes
    retry:  1,
});

  // Fetch gear news for profession with optimized loading
  const { data: gearNewsResponse, isLoading, error } = useQuery({
    queryKey: ['/api/gear-news', profession],
    queryFn: async () => {
      const response = await fetch(`/api/gear-news?profession=${profession}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
  }
      return response.json();
},
    refetchInterval: 5 * 60 * 100, // 5 minutes
    staleTime: 2 * 60 * 100, // 2 minutes
    retry:  1,
    retryDelay: 100,
});

  // Extract gear news data from response
  const gearNews = gearNewsResponse?.data || [];

  // ============================================================================
  // DATABASE CONNECTIONS - FULL EQUIPMENT MANAGEMENT SYSTEM
  // ============================================================================
  
  // Fetch user's personal equipment inventory (equipment table)
  const { data: userEquipment = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ['/api/equipment/inventory', userId],
    queryFn: () => apiRequest(`/api/equipment/inventory?userId=${userId}`),
    enabled: !!userId && userId !== 'guest'
  });

  // Fetch maintenance schedule (equipment_maintenance table)
  const { data: maintenanceSchedule = [], isLoading: maintenanceLoading } = useQuery({
    queryKey: ['/api/equipment/maintenance-schedule', userId],
    queryFn: () => apiRequest(`/api/equipment/maintenance-schedule?userId=${userId}`),
    enabled: !!userId && userId !== 'guest'
  });

  // Fetch equipment rentals (equipment_rentals table)
  const { data: equipmentRentals = [], isLoading: rentalsLoading } = useQuery({
    queryKey: ['/api/equipment/rentals', userId],
    queryFn: () => apiRequest(`/api/equipment/rentals?userId=${userId}`),
    enabled: !!userId && userId !== 'guest'
  });

  // Fetch market equipment prices (market_equipment table)
  const { data: marketEquipment = [], isLoading: marketLoading } = useQuery({
    queryKey: ['/api/equipment/market-prices', profession],
    queryFn: () => apiRequest(`/api/equipment/market-prices?profession=${profession}`),
    staleTime: 60 * 60 * 1000 // 1 hour cache for market data
  });

  // Fetch lens database (lens_database table)
  const { data: lensDatabase = [], isLoading: lensLoading } = useQuery({
    queryKey: ['/api/equipment/lenses', profession],
    queryFn: () => apiRequest(`/api/equipment/lenses?profession=${profession}`),
    staleTime: 60 * 60 * 1000 // 1 hour cache for lens data
  });

  // Fetch software database (software_database table)
  const { data: softwareDatabase = [], isLoading: softwareLoading } = useQuery({
    queryKey: ['/api/equipment/software', profession],
    queryFn: () => apiRequest(`/api/equipment/software?profession=${profession}`),
    staleTime: 60 * 60 * 1000 // 1 hour cache for software data
  });

  // Fetch software updates (software_updates table)
  const { data: softwareUpdates = [], isLoading: softwareUpdatesLoading } = useQuery({
    queryKey: ['/api/equipment/software-updates', profession],
    queryFn: () => apiRequest(`/api/equipment/software-updates?profession=${profession}`),
    refetchInterval: 24 * 60 * 60 * 1000 // Daily check for software updates
  });

  // Fetch equipment images (equipment_images table)
  const { data: equipmentImages = [], isLoading: imagesLoading } = useQuery({
    queryKey: ['/api/equipment/images', userId],
    queryFn: () => apiRequest(`/api/equipment/images?userId=${userId}`),
    enabled: !!userId && userId !== 'guest'
  });

  const {
    data: inventoryFirmwareUpdates = [],
    isLoading: inventoryFirmwareLoading,
    refetch: refetchInventoryFirmwareUpdates,
  } = useQuery({
    queryKey: ['/api/equipment/firmware-updates', userId, profession],
    queryFn: async (): Promise<InventoryFirmwareUpdate[]> =>
      apiRequest(`/api/equipment/firmware-updates/${userId}?profession=${profession}`),
    enabled: !!userId && userId !== 'guest',
    staleTime: 15 * 60 * 1000,
  });

  const config = getProfessionConfig(profession);

  const inventoryCategoryOptions = useMemo(
    () => [...new Set(config.categories.filter((category) => category.trim().length > 0))],
    [config.categories]
  );

  const normalizedInventoryCatalogCategoryValue = useMemo(
    () => normalizeInventoryCatalogCategory(inventoryForm.category),
    [inventoryForm.category]
  );

  const normalizedInventoryBrandInput = inventoryForm.brand.trim();
  const normalizedInventoryModelInput = inventoryForm.model.trim();

  const { data: equipmentBrandCatalog = [] } = useQuery({
    queryKey: ['/api/equipment/brands'],
    queryFn: async (): Promise<string[]> => {
      const response = await apiRequest('/api/equipment/brands');
      return Array.isArray(response?.data) ? response.data : [];
    },
    staleTime: 60 * 60 * 1000,
  });

  const hasExactInventoryBrandMatch = useMemo(
    () =>
      equipmentBrandCatalog.some(
        (brand) =>
          normalizeInventoryCatalogToken(brand) ===
          normalizeInventoryCatalogToken(normalizedInventoryBrandInput),
      ),
    [equipmentBrandCatalog, normalizedInventoryBrandInput]
  );

  const { data: inventoryCatalogMatches = [], isFetching: inventoryCatalogMatchesLoading } = useQuery({
    queryKey: [
      '/api/equipment/search',
      'inventory-dialog',
      normalizedInventoryCatalogCategoryValue,
      normalizedInventoryBrandInput,
      normalizedInventoryModelInput,
    ],
    queryFn: async (): Promise<EquipmentCatalogItem[]> => {
      const searchParams = new URLSearchParams({
        limit: normalizedInventoryModelInput ? '60' : '140',
      });

      if (normalizedInventoryCatalogCategoryValue) {
        searchParams.set('category', normalizedInventoryCatalogCategoryValue);
      }

      const searchTerms = [normalizedInventoryBrandInput, normalizedInventoryModelInput]
        .filter((value) => value.length > 0)
        .join(' ');

      if (hasExactInventoryBrandMatch && !normalizedInventoryModelInput) {
        searchParams.set('brand', normalizedInventoryBrandInput);
      } else if (searchTerms.length > 0) {
        searchParams.set('q', searchTerms);
      }

      const response = await apiRequest(`/api/equipment/search?${searchParams.toString()}`);

      if (Array.isArray(response?.data)) {
        return response.data as EquipmentCatalogItem[];
      }

      if (Array.isArray(response?.results)) {
        return response.results as EquipmentCatalogItem[];
      }

      return [];
    },
    enabled:
      addEquipmentOpen &&
      (
        normalizedInventoryCatalogCategoryValue.length > 0 ||
        normalizedInventoryBrandInput.length > 0 ||
        normalizedInventoryModelInput.length > 0
      ),
    staleTime: 10 * 60 * 1000,
  });

  const inventoryBrandOptions = useMemo(() => {
    const categoryScopedBrands =
      normalizedInventoryCatalogCategoryValue.length > 0
        ? uniqueSortedInventoryValues(inventoryCatalogMatches.map((item) => item.brand))
        : [];
    const sourceBrands = categoryScopedBrands.length > 0 ? categoryScopedBrands : equipmentBrandCatalog;

    if (!normalizedInventoryBrandInput) {
      return sourceBrands;
    }

    const normalizedTerm = normalizeInventoryCatalogToken(normalizedInventoryBrandInput);
    return sourceBrands.filter((brand) =>
      normalizeInventoryCatalogToken(brand).includes(normalizedTerm),
    );
  }, [
    equipmentBrandCatalog,
    inventoryCatalogMatches,
    normalizedInventoryBrandInput,
    normalizedInventoryCatalogCategoryValue,
  ]);

  const inventoryModelOptions = useMemo(() => {
    const scopedItems =
      normalizedInventoryBrandInput.length > 0
        ? inventoryCatalogMatches.filter((item) =>
            normalizeInventoryCatalogToken(item.brand).includes(
              normalizeInventoryCatalogToken(normalizedInventoryBrandInput),
            ),
          )
        : inventoryCatalogMatches;

    const allModels = uniqueSortedInventoryValues(scopedItems.map((item) => item.model));
    if (!normalizedInventoryModelInput) {
      return allModels;
    }

    const normalizedTerm = normalizeInventoryCatalogToken(normalizedInventoryModelInput);
    return allModels.filter((model) =>
      normalizeInventoryCatalogToken(model).includes(normalizedTerm),
    );
  }, [inventoryCatalogMatches, normalizedInventoryBrandInput, normalizedInventoryModelInput]);

  const selectedInventoryCatalogMatch = useMemo(
    () =>
      inventoryCatalogMatches.find(
        (item) =>
          normalizeInventoryCatalogToken(item.brand) ===
            normalizeInventoryCatalogToken(normalizedInventoryBrandInput) &&
          normalizeInventoryCatalogToken(item.model) ===
            normalizeInventoryCatalogToken(normalizedInventoryModelInput),
      ) || null,
    [inventoryCatalogMatches, normalizedInventoryBrandInput, normalizedInventoryModelInput]
  );

  const inventoryFirmwareUpdateMap = useMemo(() => {
    const updates = Array.isArray(inventoryFirmwareUpdates) ? inventoryFirmwareUpdates : [];
    return new Map(
      updates.map((update) => [
        makeInventoryDeviceLookupKey(update.deviceBrand, update.deviceModel),
        update,
      ]),
    );
  }, [inventoryFirmwareUpdates]);

  const inventoryStatusOptions = useMemo(
    () => [
      { value: 'available', label: 'Tilgjengelig' },
      { value: 'in_use', label: 'I bruk' },
      { value: 'maintenance', label: 'Ved service' },
      { value: 'rented', label: 'Utleid' },
    ],
    []
  );

  const inventoryConditionOptions = useMemo(
    () => [
      { value: 'excellent', label: 'Utmerket' },
      { value: 'good', label: 'God' },
      { value: 'fair', label: 'Grei' },
      { value: 'poor', label: 'Slitt' },
    ],
    []
  );

  const updateInventoryField = useCallback(
    <K extends keyof InventoryFormState>(field: K, value: InventoryFormState[K]) => {
      setInventoryForm((previous) => ({
        ...previous,
        [field]: value,
      }));
    },
    []
  );

  const resetInventoryForm = useCallback(() => {
    setInventoryForm({
      ...createEmptyInventoryForm(),
      category: inventoryCategoryOptions[0] || '',
    });
  }, [inventoryCategoryOptions]);

  const openAddEquipmentDialog = useCallback(() => {
    if (userId === 'guest') {
      addToast({
        message: 'Logg inn for å registrere utstyr i inventaret ditt.',
        type: 'warning',
        duration: 4000,
      });
      return;
    }

    resetInventoryForm();
    setAddEquipmentOpen(true);
  }, [addToast, resetInventoryForm, userId]);

  const addInventoryMutation = useMutation({
    mutationFn: async (payload: InventoryFormState) => {
      const brand = payload.brand.trim();
      const model = payload.model.trim();
      const name = payload.name.trim() || `${brand} ${model}`.trim();

      return apiRequest('/api/equipment/inventory', {
        method: 'POST',
        body: {
          userId,
          profession,
          name,
          brand,
          model,
          category: payload.category || inventoryCategoryOptions[0] || null,
          imageUrl: payload.imageUrl.trim() || null,
          status: payload.status,
          condition: payload.condition,
          specifications: payload.notes.trim().length > 0 ? { notes: payload.notes.trim() } : {},
        },
      });
    },
    onSuccess: (createdItem) => {
      const equipmentName =
        typeof createdItem?.name === 'string' && createdItem.name.trim().length > 0
          ? createdItem.name.trim()
          : `${inventoryForm.brand} ${inventoryForm.model}`.trim();

      queryClient.invalidateQueries({ queryKey: ['/api/equipment/inventory', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment/images', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment/firmware-updates', userId, profession] });

      handleEquipmentFlow(equipmentName, 'create', {
        equipmentId: createdItem?.id ?? null,
        origin: 'inventory-dialog-submit',
        category: inventoryForm.category,
      });
      showEquipmentToast('added', equipmentName);
      setAddEquipmentOpen(false);
      resetInventoryForm();
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Ukjent feil';
      addToast({
        message: `Kunne ikke lagre utstyret akkurat nå: ${errorMessage}`,
        type: 'error',
        duration: 4500,
      });
    },
  });

  const syncFirmwareNow = useCallback(async () => {
    const endTiming = performance.startTiming('gear_firmware_sync_manual');
    setFirmwareSyncing(true);

    try {
      const response = await apiRequest('/api/equipment/sync-firmware', {
        method: 'POST',
        body: {
          userId,
          profession,
        },
      });

      await Promise.all([refetchFirmwareData(), refetchInventoryFirmwareUpdates()]);

      const updatesCount =
        typeof response?.updatesCount === 'number'
          ? response.updatesCount
          : Array.isArray(response?.updates)
            ? response.updates.length
            : firmwareData?.updatesAvailable || 0;

      addToast({
        message:
          updatesCount > 0
            ? `🔄 Firmware synket. ${updatesCount} oppdateringer klare for gjennomgang.`
            : '🔄 Firmware synket. Ingen nye oppdateringer akkurat nå.',
        type: updatesCount > 0 ? 'success' : 'info',
        duration: 4000,
        actions: updatesCount > 0
          ? [{ label: 'Åpne firmware', action: () => navigateToTab('news') }]
          : undefined,
      });

      analytics.trackEvent('gear_firmware_sync_completed', {
        profession,
        updatesCount,
        userId,
      });
      features.trackFeatureUsage('firmware-updates', 'manual-sync', {
        profession,
        updatesCount,
        userId,
      });
    } catch (error) {
      console.error('Manual firmware sync failed:', error);
      addToast({
        message: 'Kunne ikke synkronisere firmware akkurat nå. Prøv igjen om litt.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setFirmwareSyncing(false);
      endTiming();
    }
  }, [addToast, analytics, features, firmwareData?.updatesAvailable, navigateToTab, performance, profession, refetchFirmwareData, refetchInventoryFirmwareUpdates, userId]);

  // ============================================================================
  // TOAST NOTIFICATION HELPERS - CreatorHub Brand Kit Aligned
  // ============================================================================
  
  // Equipment Toast Helpers
  const showEquipmentToast = useCallback((type: 'added' | 'updated' | 'deleted', equipmentName: string) => {
    const toastConfigs = {
      added: {
        message: `🎉 ${equipmentName} lagt til i ditt utstyr!`,
        type: 'success' as const,
        duration: 4000,
        actions: [
          { label: 'Se Utstyr', action: () => setCurrentTab(1) },
          { label: 'Legg til Mer', action: () => {} }
        ]
      },
      updated: {
        message: `✏️ ${equipmentName} oppdatert vellykket!`,
        type: 'success' as const,
        duration: 3000
      },
      deleted: {
        message: `🗑️ ${equipmentName} fjernet fra inventar`,
        type: 'info' as const,
        duration: 3000
      }
    };
    
    const config = toastConfigs[type];
    addToast(config);
  }, [addToast]);

  const showMaintenanceToast = useCallback((type: 'scheduled' | 'due' | 'completed', equipmentName: string, date?: string) => {
    const toastConfigs = {
      scheduled: {
        message: `🔧 Service planlagt for ${equipmentName}${date ? ` - ${date}` : ''}`,
        type: 'success' as const,
        duration: 4000,
        actions: [
          { label: 'Se Timeplan', action: () => setCurrentTab(2) },
          { label: 'Til Kalender', action: () => {} }
        ]
      },
      due: {
        message: `⚠️ Service forfaller om 7, dager: ${equipmentName}`,
        type: 'warning' as const,
        duration: 5000,
        actions: [
          { label: 'Planlegg Nå', action: () => setCurrentTab(2) },
          { label: 'Påminn Senere', action: () => {} }
        ]
      },
      completed: {
        message: `✅ Service fullført! ${equipmentName} er klar for bruk`,
        type: 'success' as const,
        duration: 4000,
        actions: [
          { label: 'Se Rapport', action: () => setCurrentTab(2) }
        ]
      }
    };
    
    const config = toastConfigs[type];
    addToast(config);
  }, [addToast]);

  const showRentalToast = useCallback((type: 'created' | 'overdue' | 'reminder' | 'returned', equipmentName: string, details?: string) => {
    const toastConfigs = {
      created: {
        message: `📅 Utleie opprettet: ${equipmentName}${details ? ` ${details}` : ''}`,
        type: 'success' as const,
        duration: 4000,
        actions: [
          { label: 'Se Detaljer', action: () => setCurrentTab(3) }
        ]
      },
      overdue: {
        message: `🚨 FORFALT: ${equipmentName} skulle vært returnert!`,
        type: 'error' as const,
        duration: 6000,
        actions: [
          { label: 'Merk som Returnert', action: () => setCurrentTab(3) },
          { label: 'Kontakt Utleier', action: () => {} }
        ]
      },
      reminder: {
        message: `⏰ Påminnelse: Returner ${equipmentName} i morgen`,
        type: 'warning' as const,
        duration: 4000
      },
      returned: {
        message: `✅ ${equipmentName} returnert i god stand`,
        type: 'success' as const,
        duration: 3000
      }
    };
    
    const config = toastConfigs[type];
    addToast(config);
  }, [addToast]);

  const showFirmwareToast = useCallback((type: 'available' | 'critical' | 'downloaded', equipmentName: string, version?: string) => {
    const toastConfigs = {
      available: {
        message: `🔄 Ny firmware tilgjengelig for ${equipmentName}${version ? ` (${version})` : ''}`,
        type: 'warning' as const,
        duration: 5000,
        actions: [
          { label: 'Last Ned', action: () => {} },
          { label: 'Les Notater', action: () => {} }
        ]
      },
      critical: {
        message: `🚨 KRITISK: Firmware-oppdatering påkrevd for ${equipmentName}!`,
        type: 'error' as const,
        duration: 8000,
        actions: [
          { label: 'Last Ned Nå', action: () => {} }
        ]
      },
      downloaded: {
        message: `✅ Firmware nedlastet! Klar for installasjon`,
        type: 'success' as const,
        duration: 4000,
        actions: [
          { label: 'Installasjonsguide', action: () => {} }
        ]
      }
    };
    
    const config = toastConfigs[type];
    addToast(config);
  }, [addToast]);

  const showMarketToast = useCallback((type: 'price-alert' | 'market-update', message: string) => {
    const toastConfigs = {
      'price-alert': {
        message: `💰 ${message}`,
        type: 'success' as const,
        duration: 5000,
        actions: [
          { label: 'Se Tilbud', action: () => setCurrentTab(4) },
          { label: 'Prishistorikk', action: () => {} }
        ]
      }, 'market-update': {
        message: `📊 ${message}`,
        type: 'info' as const,
        duration: 3000
      }
    };
    
    const config = toastConfigs[type];
    addToast(config);
  }, [addToast]);

  const showNewsToast = useCallback((type: 'bookmarked' | 'new-articles', count?: number) => {
    const toastConfigs = {
      bookmarked: {
        message: '🔖 Artikkel lagret i bokmerker',
        type: 'success' as const,
        duration: 2000
      }, 'new-articles': {
        message: `📰 ${count || 5} nye artikler om fotoutstyr tilgjengelig!`,
        type: 'info' as const,
        duration: 4000,
        actions: [
          { label: 'Les Nå', action: () => setCurrentTab(8) }
        ]
      }
    };
    
    const config = toastConfigs[type];
    addToast(config);
  }, [addToast]);

  const showDatabaseToast = useCallback((type: 'synced' | 'backup' | 'export') => {
    const toastConfigs = {
      synced: {
        message: '🔄 Utstyr database synkronisert',
        type: 'success' as const,
        duration: 3000
      },
      backup: {
        message: '💾 Utstyr data sikkerhetskopiert til Google Drive',
        type: 'success' as const,
        duration: 3000
      },
      export: {
        message: '📥 Utstyr liste eksportert til Excel',
        type: 'success' as const,
        duration: 3000,
        actions: [
          { label: 'Åpne Fil', action: () => {} }
        ]
      }
    };
    
    const config = toastConfigs[type];
    addToast(config);
  }, [addToast]);

  // Get profession-specific configuration
  function getProfessionConfig(profession: string) {
    switch (profession) {
      case 'photographer':
        return {
          title: 'Fotoutstyr Database & Nyheter',
          icon: <Camera />,
          color: '#ff8c00',
          categories: ['Kameraer','Objektiver','Blits','Stativer','Tilbehør','Software'],
          brands: [
            // Camera Manufacturers
            'Canon','Nikon','Sony','Fujifilm','Leica','Panasonic','Olympus','Sigma','Pentax','Hasselblad','Phase One',
            // Software
            'Adobe',
            // Flash/Lighting
            'Godox','Profoto','Nissin','Yongnuo','Pixel','Metz','Elinchrom',
            // Tripods/Support
            'Manfrotto','Sachtler','Miller','Gitzo','Benro','Libec','Cartoni','Vinten','OConnor','E-Image','Velbon','Magnus','SmallRig','Neewer','Acebil','Proaim','Camgear','Sirui','Leofoto','Innorel',
            // Independent Lens Makers
            'Tamron','Tokina','Samyang','Zeiss','Laowa','Voigtländer','TTArtisan','7Artisans','Meyer-Optik','Kipon','Mitakon','Irix','Meike','Viltrox','Lensbaby',
            // Professional/Cinema Optics
            'Kowa','Schneider-Kreuznach','Cooke','Angénieux','Fujinon','ARRI','Panavision','DZOFilm','Hawk'
          ],
          description: 'Profesjonell fotoutstyr database med siste nyheter og produktinformasjon'
        };
      case 'videographer':
        return {
          title: 'Videoutstyr Database & Nyheter',
          icon: <Videocam />,
          color: '#e74c3c',
          categories: ['Kameraer','Optikk','Lyd','Belysning','Rigg','Software'],
          brands: ['Blackmagic','Sony','Canon','RED','ARRI','Atomos'],
          description: 'Omfattende videoutstyr database med kinokvalitets produkter og nyheter'
        };
      case 'music_producer':
        return {
          title: 'Musikutstyr Database & Nyheter',
          icon: <LibraryMusic />,
          color: '#7c3aed',
          categories: ['DAW','Interface','Mikrofoner','Monitorer','Plugins','Instrumenter'],
          brands: ['Avid','Apple','Universal Audio','Native Instruments','Steinberg','Ableton'],
          description: 'Studioutstyr database med DAW, plugins og produksjonsutstyr'
        };
      default: 
        return {
          title: 'Utstyr Database & Nyheter',
          icon: <Business />,
          color: '#27ae60',
          categories: ['Audio','Video','Lighting','Accessories'],
          brands: ['QSC','Shure','Sennheiser','Rode'],
          description: 'Profesjonelt utstyr for leverandører og eventselskaper'
        };
    }
  }
  const professionDisplayIcon = useMemo(
    () => React.cloneElement(getProfessionIcon(dynamicProfessionConfig?.displayName || profession), {
      sx: { fontSize: 20, color: config.color }
    }),
    [config.color, dynamicProfessionConfig?.displayName, profession]
  );
  const actualGearNews = Array.isArray(gearNews)
    ? gearNews
    : Array.isArray(gearNewsResponse?.data)
      ? gearNewsResponse.data
      : [];
  const workspaceChromeSx = {
    '& .MuiCard-root': {
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: { xs: 3, md: 4 },
      background: 'rgba(255,255,255,0.04)',
      boxShadow: '0 18px 48px rgba(255,255,255,0.07)',
      backdropFilter: 'blur(14px)',
    },
    '& .MuiAccordion-root': {
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: { xs: 3, md: 4 },
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.04)',
      boxShadow: '0 18px 48px rgba(255,255,255,0.07)',
      '&:before': {
        display: 'none',
      },
    },
    '& .MuiAlert-root': {
      borderRadius: 3,
      border: '1px solid rgba(148, 163, 184, 0.24)',
    },
    '& .MuiChip-root': {
      borderRadius: 999,
    },
  } as const;
  const workspaceDialogPaperSx = {
    borderRadius: { xs: 3, md: 4 },
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 30px 90px rgba(255,255,255,0.18)',
    overflow: 'hidden',
  } as const;

  // Tools functionality
  const renderToolsTab = () => {
    const firmwareUpdatesCount = firmwareData?.updatesAvailable || 0;
    const latestSoftwareUpdates = Array.isArray(softwareUpdates)
      ? softwareUpdates.filter((update: any) => update.isLatest).length
      : 0;
    const toolModules = [
      {
        id: 'worklog',
        title: 'Workspace-arbeidslogg',
        status: 'Integrert',
        icon: <Article sx={{ fontSize: 24 }} />,
        accent: '#2563eb',
        description: 'Arbeidslogger og raske notater holdes i samme workspace-flyt som resten av gear-panelet, uten separat Google-kobling.',
        bullets: [
          'Worklog-data kan gjenbrukes når du dokumenterer gear-bruk og vedlikehold.',
          'Shortcut-flyten bruker samme prosjekt-worklog og Workspace-økt videre.',
        ],
        meta: 'Ctrl+Shift+W for lynnotat · Ctrl+Shift+N for oversikt',
        primaryAction: {
          label: 'Åpne shortcuts',
          onClick: focusShortcutWorkspace,
        },
      },
      {
        id: 'drive',
        title: 'Bilder & Lagring',
        status: equipmentImages.length > 0 ? 'Synkronisert' : 'Venter på innhold',
        icon: <Security sx={{ fontSize: 24 }} />,
        accent: '#059669',
        description: 'Inventarbilder og filkontekst brukes som grunnlag for lagring, dokumentasjon og videre Drive-flyt i dashboardet.',
        bullets: [
          'Utstyrslisten viser hvilke elementer som allerede har koblede bilder.',
          'Gir et tydeligere grunnlag før du går videre til filer og backup.',
        ],
        meta: imagesLoading ? 'Henter bildekontekst akkurat nå' : `${equipmentImages.length} bilder koblet til inventaret`,
        primaryAction: {
          label: 'Åpne mitt utstyr',
          onClick: () => navigateToTab('inventory'),
        },
      },
      {
        id: 'firmware',
        title: 'Firmware Operasjoner',
        status: firmwareUpdatesCount > 0 ? `${firmwareUpdatesCount} nye` : 'Oppdatert',
        icon: <Update sx={{ fontSize: 24 }} />,
        accent: '#7c3aed',
        description: 'Firmware-senteret kan synkroniseres live og leder rett videre til nyhets-/firmware-panelet når noe krever handling.',
        bullets: [
          'Manuell synk bruker ekte backend-sync mot firmware-radene.',
          'Nyheter og firmware er samlet i samme arbeidsflate for gjennomgang.',
        ],
        meta: firmwareLoading ? 'Sjekker produsentdata…' : 'Daglig sjekk 06:00 · kritiske modeller oftere',
        primaryAction: {
          label: firmwareSyncing ? 'Synker…' : 'Synk firmware nå',
          onClick: syncFirmwareNow,
        },
        secondaryAction: {
          label: 'Åpne firmware',
          onClick: () => navigateToTab('news'),
        },
      },
    ];

    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 4,
            border: `1px solid ${config.color}22`,
            background: `radial-gradient(circle at top right, ${config.color}18, transparent 38%), rgba(255,255,255,0.04)`,
            ...theming.getThemedCardSx(),
          }}
        >
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} lg={7}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.25} alignItems="center" useFlexGap flexWrap="wrap">
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, ${config.color}22, ${config.color}10)`,
                      color: config.color,
                    }}
                  >
                    <Settings />
                  </Box>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                      Verktøy & Utilities
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Operative verktøy for firmware, lagring, recovery og shortcuts samlet i ett arbeidsområde.
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label={pushEnabled ? 'Push-varsler aktive' : 'Push-varsler kan aktiveres'} color={pushEnabled ? 'success' : 'default'} size="small" />
                  <Chip label={`${equipmentImages.length} inventarbilder`} variant="outlined" size="small" />
                  <Chip label={`${firmwareUpdatesCount} firmwarefunn`} variant="outlined" size="small" />
                  <Chip label={`${latestSoftwareUpdates} programvareoppdateringer`} variant="outlined" size="small" />
                </Stack>
              </Stack>
            </Grid>

            <Grid item xs={12} lg={5}>
              <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap" justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
                <Button variant="contained" onClick={syncFirmwareNow} disabled={firmwareSyncing} startIcon={<Update />}>
                  {firmwareSyncing ? 'Synker firmware…' : 'Synk firmware'}
                </Button>
                <Button variant="outlined" onClick={() => setPushSettingsOpen(true)} startIcon={pushEnabled ? <NotificationsActive /> : <Notifications />}>
                  Varselinnstillinger
                </Button>
                <Button variant="outlined" onClick={openAccessoryToolkit} startIcon={<Memory />}>
                  Åpne tilbehør
                </Button>
                <Button variant="outlined" onClick={focusShortcutWorkspace} startIcon={<Settings />}>
                  Shortcuts
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Grid container spacing={2.5}>
              {toolModules.map((module) => (
                <Grid item xs={12} md={6} key={module.id}>
                  <Card
                    elevation={0}
                    sx={{
                      height: '100%',
                      borderRadius: 4,
                      border: '1px solid',
                      borderColor: 'divider',
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.04)',
                      transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 18px 48px rgba(255,255,255,0.08)',
                        borderColor: `${module.accent}40`,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        px: 2.25,
                        py: 1.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        background: `linear-gradient(135deg, ${module.accent}18, transparent 72%)`,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box
                            sx={{
                              width: 42,
                              height: 42,
                              borderRadius: 2.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: `${module.accent}18`,
                              color: module.accent,
                            }}
                          >
                            {module.icon}
                          </Box>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                              {module.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {module.meta}
                            </Typography>
                          </Box>
                        </Stack>
                        <Chip
                          label={module.status}
                          size="small"
                          sx={{
                            bgcolor: `${module.accent}14`,
                            color: module.accent,
                            fontWeight: 700,
                          }}
                        />
                      </Stack>
                    </Box>

                    <CardContent sx={{ p: 2.25 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
                        {module.description}
                      </Typography>

                      <Stack spacing={1.1} sx={{ mb: 2.5 }}>
                        {module.bullets.map((bullet) => (
                          <Stack key={bullet} direction="row" spacing={1} alignItems="flex-start">
                            <CheckCircle sx={{ fontSize: 16, mt: 0.2, color: module.accent }} />
                            <Typography variant="body2" color="text.secondary">
                              {bullet}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>

                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {module.primaryAction && (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={module.primaryAction.onClick}
                            disabled={module.id === 'firmware' && firmwareSyncing}
                            sx={{
                              bgcolor: module.accent,
                              '&:hover': { bgcolor: module.accent },
                            }}
                          >
                            {module.primaryAction.label}
                          </Button>
                        )}
                        {module.secondaryAction && (
                          <Button variant="outlined" size="small" onClick={module.secondaryAction.onClick}>
                            {module.secondaryAction.label}
                          </Button>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Paper
              id="gear-tools-shortcuts"
              elevation={0}
              sx={{
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <Box
                sx={{
                  px: 2.5,
                  py: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  background: 'linear-gradient(135deg, rgba(255,140,0,0.18), transparent 72%)',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                  Keyboard Shortcut Workspace
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Hurtigtaster, mikroverktøy og arbeidsflytforbedringer samlet i én ren surface.
                </Typography>
              </Box>
              <Box sx={{ p: 0 }}>
                <KeyboardShortcutsTools />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedAccordion(isExpanded ? panel : false);
};

  const handleReadMore = (article: any) => {
    setSelectedArticle(article);
    setReadMoreOpen(true);
    showNewsToast('bookmarked');
  };

  const renderEquipmentDatabase = () => (
    <Box>
      {/* Search and Filter Controls */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder={`Søk i ${config.title.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                )
              }}
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 2
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  if (e.target.value !== 'all') {
                    addToast({
                      message: `🏷️ Filter, anvendt: ${e.target.value}`,
                      type: 'info',
                      duration: 2000
                    });
                  }
                }}
                label="Kategori"
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="all">Alle kategorier</MenuItem>
                {config.categories.map((cat: string) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {/* Equipment Categories Grid */}
      <Grid container spacing={3}>
        {config.categories.map((category: string) => (
          <Grid item xs={12} sm={6} md={4} key={category}>
            <Card 
              elevation={2}
              sx={{ 
                p: 2,
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s ease','&:hover': {
                  backgroundColor: `${config.color}08`,
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 25px ${config.color}25`
                },
                borderRadius: 3,
                border: `1px solid ${config.color}30`,
                ...theming.getThemedCardSx()
              }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Settings sx={{ color: config.color, mr: 1, fontSize: 24 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                  {category}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                Utforsk profesjonelt {category.toLowerCase()} fra ledende merker
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                {config.brands.slice(0, 3).map((brand: string) => (
                  <Chip 
                    key={brand}
                    label={brand}
                    size="small" 
                    variant="outlined"
                    sx={{ 
                      fontSize: '0.75rem',
                      borderColor: `${config.color}40`,
                      color: config.color, '&:hover': { backgroundColor: `${config.color}10` }
                }}
                  />
                ))}
              </Box>
              <Button 
                size="small" 
                sx={{ 
                  color: config.color, 
                  fontWeight: 600,
                  '&:hover': { backgroundColor: `${config.color}15` }
            }}
              >
                Utforsk {category}
              </Button>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Database Statistics */}
      <Paper sx={{ p: 3, mt: 3, backgroundColor: 'background.default', borderRadius: 2, ...theming.getThemedCardSx() }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
          Database Oversikt
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Category sx={{ fontSize: 32, color: config.color, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                {config.categories.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Kategorier
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Business sx={{ fontSize: 32, color: config.color, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                {config.brands.length}+
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Merker
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Schedule sx={{ fontSize: 32, color: config.color, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                24/7
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Oppdateringer
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <TrendingUp sx={{ fontSize: 32, color: config.color, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                Live
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Priser
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
);

  const renderNewsSection = () => {
    if (isLoading && !gearNews?.length) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2.5 }}>
          <CircularProgress size={48} sx={{ color: config.color }} />
          <Box sx={{ ml: 2 }}>
            <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>Henter utstyr database...</Typography>
            <Typography variant="body2" color="text.secondary">
              Klargjør profesjonelt utstyr fra norske og internasjonale kilder
            </Typography>
          </Box>
        </Box>
    );
}

    if (error) {
      return (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Kunne ikke hente utstyr nyheter. Systemet prøver å koble til igjen automatisk.
        </Alert>
    );
}

    if (!gearNews?.length) {
      return (
        <Alert severity="info" sx={{ borderRadius: 2, p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>Ingen nyheter tilgjengelig</Typography>
          <Typography variant="body2">
            Nyhetsskraperen arbeider med å hente de nyeste artiklene. Prøv igjen om litt.
          </Typography>
        </Alert>
    );
}

    return (
      <Grid container spacing={3}>
        {gearNews.slice(0, 6).map((article: any, index: number) => (
          <Grid item xs={12} md={6} key={index}>
            <Card 
              elevation={2}
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                borderRadius: 2,
                transition: 'all 0.2','&:hover': { elevation: 4 },
                ...theming.getThemedCardSx()
          }}>
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Chip 
                    label={article.category || 'Utstyr'}
                    size="small" 
                    sx={{ 
                      backgroundColor: `${config.color}15`,
                      color: config.color,
                      fontWeight: 60
              }}
                  />
                  {article.isNew && (
                    <Chip 
                      label="NY" 
                      size="small" 
                      color="error" 
                      icon={<FiberNew />}
                      sx={{ ml: 1 }}
                    />
                  )}
                  {article.isTrending && (
                    <Chip 
                      label="Trending" 
                      size="small" 
                      color="warning" 
                      icon={<TrendingUp />}
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
                
                <Typography variant="h6" sx={{ 
                  fontWeight: 600, 
                  mb: 1,
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  color: theming.colors.primary
                }}>
                  {article.title}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ 
                  mb: 2,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.5
          }}>
                  {article.summary}
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mr: 1 }}>
                      {article.brand}
                    </Typography>
                    {article.price && (
                      <Chip 
                        label={article.price}
                        size="small" 
                        icon={<MonetizationOn />}
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                  {article.rating && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Rating 
                        value={article.rating / 5 * 5}
                        precision={0.1}
                        size="small" 
                        readOnly 
                      />
                      <Typography variant="body2" sx={{ ml: 0.5, fontWeight: 600}}>
                        {article.rating}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>

              <Box sx={{ p: 2, pt: 0, display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  size="small"
                  onClick={() => handleReadMore(article)}
                  sx={{ 
                    color: config.color,
                    fontWeight: 600,
                    '&:hover': { backgroundColor: `${config.color}15` }
              }}
                >
                  Les mer
                </Button>
                
                {article.url && (
                  <IconButton
                    size="small"
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: 'text.secondary' }}
                  >
                    <OpenInNew fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
  );
};

  const renderFirmwareSection = () => {
    if (firmwareLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2.5 }}>
          <CircularProgress size={48} sx={{ color: config.color }} />
          <Box sx={{ ml: 2 }}>
            <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>Sjekker firmware status...</Typography>
            <Typography variant="body2" color="text.secondary">
              Henter siste firmware informasjon fra produsenter
            </Typography>
          </Box>
        </Box>
    );
}

    const firmwareItems = firmwareData?.data || [];
    
    if (!firmwareItems.length) {
      return (
        <Alert severity="info" sx={{ borderRadius: 2, p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>Ingen firmware data tilgjengelig</Typography>
          <Typography variant="body2">
            Firmware-sjekking er konfigurert for ditt utstyr. Sjekk tilbake senere for oppdateringer.
          </Typography>
        </Alert>
    );
}

    return (
      <Grid container spacing={3}>
        {firmwareItems.map((item: any, index: number) => (
          <Grid item xs={12} md={6} key={index}>
            <Card 
              elevation={2}
              sx={{ 
                p: 3, 
                height: '100%',
                borderRadius: 2,
                border: item.hasUpdate ? `2px solid ${config.color}` : '1px solid rgba(255,255,255,0.10)',
                backgroundColor: item.hasUpdate ? `${config.color}08` : 'background.paper',
                ...theming.getThemedCardSx()
              }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Memory sx={{ color: config.color, mr: 1, fontSize: 24 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1, color: theming.colors.primary }}>
                  {item.model}
                </Typography>
                {item.hasUpdate && (
                  <Chip 
                    label="OPPDATERING" 
                    size="small" 
                    color="primary"
                    icon={<Update />}
                    sx={{ fontWeight: 600}}
                  />
                )}
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Nåværende versjon: <strong>{item.currentVersion}</strong>
                </Typography>
                {item.latestVersion && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Siste versjon: <strong>{item.latestVersion}</strong>
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  Sist sjekket: {new Date(item.lastChecked).toLocaleDateString('no-NO')}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {item.hasUpdate ? (
                    <Warning sx={{ color: 'warning.main', mr: 1, fontSize: 20 }} />
                  ) : (
                    <CheckCircle sx={{ color: 'success.main', mr: 1, fontSize: 20 }} />
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 600}}>
                    {item.hasUpdate ? 'Oppdatering tilgjengelig' : 'Oppdatert'}
                  </Typography>
                </Box>
                
                {item.downloadUrl && (
                  <Button
                    size="small"
                    variant="outlined"
                    href={item.downloadUrl}
                    target="_blank"
                    onClick={() => showFirmwareToast('downloaded', item.model || 'Firmware')}
                    sx={{ 
                      color: config.color,
                      borderColor: config.color, '&:hover': { backgroundColor: `${config.color}15` }
                }}
                  >
                    Last ned
                  </Button>
                )}
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
  );
};

  // ============================================================================
  // RENDER FUNCTIONS FOR NEW DATABASE-CONNECTED TABS
  // ============================================================================

  // 1. Personal Equipment Inventory (equipment table)
  const renderInventoryTab = () => (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
            <Camera sx={{ mr: 1, verticalAlign: 'middle' }} />
            Mitt Utstyr
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {imagesLoading
              ? 'Synkroniserer utstyrsbilder fra databasen...'
              : inventoryFirmwareLoading
                ? 'Sjekker firmware-status for registrert utstyr...'
                : `${equipmentImages.length} bilder og ${inventoryFirmwareUpdates.length} firmwaretreff er knyttet til inventaret ditt`}
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<Camera />} 
          sx={{ bgcolor: config.color }}
          onClick={openAddEquipmentDialog}
        >
          Legg til utstyr
        </Button>
      </Box>

      {inventoryLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2.5 }}>
          <CircularProgress />
        </Box>
      ) : userEquipment.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)' }}>
          <Camera sx={{ fontSize: 64, color: config.color, opacity: 0.3, mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Ingen utstyr registrert
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Legg til ditt utstyr for å spore vedlikehold, verdi og forsikring
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<Camera />} 
            sx={{ bgcolor: config.color }}
            onClick={openAddEquipmentDialog}
          >
            Registrer første utstyr
          </Button>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {userEquipment.map((item: InventoryEquipmentItem) => (
            <Grid item xs={12} sm={6} md={4} key={item.id}>
              {(() => {
                const specificationHighlights = getInventorySpecificationHighlights(item);
                const specificationSectionTitle =
                  ['cameras', 'video'].includes(normalizeInventoryCatalogCategory(item.category || ''))
                    ? 'Kameraspesifikasjoner:'
                    : 'Spesifikasjoner:';
                const firmwareUpdate =
                  inventoryFirmwareUpdateMap.get(
                    makeInventoryDeviceLookupKey(item.brand, item.model),
                  ) || null;
                const firmwareReleaseDate =
                  firmwareUpdate?.releaseDate
                    ? new Date(firmwareUpdate.releaseDate).toLocaleDateString('no-NO')
                    : null;
                const firmwareLinkLabel =
                  firmwareUpdate?.urlKind === 'direct-download'
                    ? 'Last ned'
                    : firmwareUpdate?.urlKind === 'brand-portal'
                      ? 'Åpne produsentside'
                      : 'Åpne firmware-side';

                return (
              <Card sx={{ 
                height: '100%',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s','&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}
                onClick={() => {
                  handleEquipmentFlow(item.name || `${item.brand} ${item.model}`, 'selected', {
                    equipmentId: item.id,
                    equipmentStatus: item.status || null,
                  });
                  showEquipmentToast('updated', item.name || `${item.brand} ${item.model}`);
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
                    ) : (
                      <Camera sx={{ fontSize: 40, color: config.color }} />
                    )}
                    <Box sx={{ ml: 2, flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', color: theming.colors.primary }}>
                        {item.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.brand} {item.model}
                      </Typography>
                    </Box>
                    {firmwareUpdate && (
                      <Chip
                        label="Firmware"
                        size="small"
                        color="warning"
                        icon={<Update />}
                        sx={{ ml: 1, fontWeight: 700 }}
                      />
                    )}
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Kategori:</Typography>
                      <Chip label={item.category} size="small" />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Status:</Typography>
                      <Chip 
                        label={item.status} 
                        size="small"
                        color={item.status === 'available' ? 'success' : item.status === 'in_use' ? 'warning' : 'default'}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Tilstand:</Typography>
                      <Rating value={item.condition === 'excellent' ? 5 : item.condition === 'good' ? 4 : item.condition === 'fair' ? 3 : 2} size="small" readOnly />
                    </Box>
                    {item.currentValue && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Verdi:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: config.color }}>
                          {item.currentValue.toLocaleString('no-NO')} kr
                        </Typography>
                      </Box>
                    )}
                  </Stack>

                  {(item.catalogDescription || specificationHighlights.length > 0) && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Stack spacing={1}>
                        {item.catalogDescription && (
                          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                            {item.catalogDescription}
                          </Typography>
                        )}
                        {specificationHighlights.length > 0 && (
                          <Stack spacing={0.9}>
                            <Typography variant="caption" color="text.secondary">
                              {specificationSectionTitle}
                            </Typography>
                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                              {specificationHighlights.map((specification) => (
                                <Chip
                                  key={`${item.id}-${specification.label}`}
                                  size="small"
                                  label={`${specification.label}: ${specification.value}`}
                                  variant="outlined"
                                  sx={{
                                    borderColor: 'rgba(255,255,255,0.12)',
                                    color: theming.colors.primary,
                                    backgroundColor: 'rgba(255,255,255,0.8)',
                                  }}
                                />
                              ))}
                            </Stack>
                          </Stack>
                        )}
                      </Stack>
                    </>
                  )}

                  {firmwareUpdate && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Firmwareoppdatering:
                          </Typography>
                          <Chip
                            label={firmwareUpdate.priority === 'critical' ? 'Kritisk' : 'Tilgjengelig'}
                            size="small"
                            color={firmwareUpdate.priority === 'critical' ? 'error' : 'warning'}
                            variant={firmwareUpdate.priority === 'critical' ? 'filled' : 'outlined'}
                          />
                        </Box>
                        <Typography variant="body2" sx={{ color: theming.colors.primary, fontWeight: 600, lineHeight: 1.5 }}>
                          {firmwareUpdate.description || `Ny firmware er tilgjengelig for ${item.brand} ${item.model}.`}
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`Nå: ${firmwareUpdate.currentVersion || 'Ukjent'}`}
                          />
                          <Chip
                            size="small"
                            sx={{ backgroundColor: `${config.color}12`, color: config.color }}
                            label={`Ny: ${firmwareUpdate.latestVersion}`}
                          />
                          {firmwareReleaseDate && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`Sluppet: ${firmwareReleaseDate}`}
                            />
                          )}
                        </Stack>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigateToTab('news');
                              setExpandedAccordion('firmware');
                              showFirmwareToast(
                                firmwareUpdate.priority === 'critical' ? 'critical' : 'available',
                                `${item.brand} ${item.model}`,
                                firmwareUpdate.latestVersion,
                              );
                            }}
                            sx={{
                              color: config.color,
                              borderColor: `${config.color}55`,
                              '&:hover': {
                                borderColor: config.color,
                                backgroundColor: `${config.color}10`,
                              },
                            }}
                          >
                            Åpne firmware
                          </Button>
                          {firmwareUpdate.downloadUrl && (
                            <Button
                              size="small"
                              variant="contained"
                              href={firmwareUpdate.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => {
                                event.stopPropagation();
                                showFirmwareToast('downloaded', `${item.brand} ${item.model}`);
                              }}
                              sx={{ backgroundColor: config.color }}
                            >
                              {firmwareLinkLabel}
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </>
                  )}

                  {(item.supplierUrl || item.recommendedMemoryCards?.length) && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Stack spacing={1.2}>
                        {item.supplierUrl && (
                          <Stack spacing={0.6}>
                            <Typography variant="caption" color="text.secondary">
                              Kjøpslenke:
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              href={item.supplierUrl}
                              target="_blank"
                              rel="noreferrer"
                              startIcon={<OpenInNew />}
                              onClick={(event) => event.stopPropagation()}
                              sx={{
                                alignSelf: 'flex-start',
                                color: config.color,
                                borderColor: `${config.color}55`,
                                '&:hover': {
                                  borderColor: config.color,
                                  backgroundColor: `${config.color}10`,
                                },
                              }}
                            >
                              {item.purchaseVendor === 'Foto.no' ? 'Kjøp hos Foto.no' : 'Åpne produktside'}
                            </Button>
                          </Stack>
                        )}

                        {Array.isArray(item.recommendedMemoryCards) && item.recommendedMemoryCards.length > 0 && (
                          <Stack spacing={0.9}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Støttede minnekort:
                              </Typography>
                              <Button
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openAccessoryToolkit();
                                }}
                                sx={{ minWidth: 0, px: 0, color: config.color, fontWeight: 700 }}
                              >
                                Åpne kortguide
                              </Button>
                            </Box>
                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                              {item.recommendedMemoryCards.slice(0, 2).map((card) => (
                                <Chip
                                  key={card.id}
                                  label={card.fullName}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    borderColor: `${config.color}35`,
                                    color: theming.colors.primary,
                                    maxWidth: '100%',
                                  }}
                                />
                              ))}
                              {item.recommendedMemoryCards.length > 2 && (
                                <Chip
                                  label={`+${item.recommendedMemoryCards.length - 2} flere`}
                                  size="small"
                                  sx={{ backgroundColor: `${config.color}12`, color: config.color }}
                                />
                              )}
                            </Stack>
                            {Array.from(
                              new Set(
                                item.recommendedMemoryCards
                                  .flatMap((card) => card.commonCapacities)
                                  .filter((capacity) => capacity.trim().length > 0),
                              ),
                            ).length > 0 && (
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                                Vanlige kapasiteter:{' '}
                                {Array.from(
                                  new Set(
                                    item.recommendedMemoryCards
                                      .flatMap((card) => card.commonCapacities)
                                      .filter((capacity) => capacity.trim().length > 0),
                                  ),
                                )
                                  .slice(0, 4)
                                  .join(', ')}
                              </Typography>
                            )}
                          </Stack>
                        )}
                      </Stack>
                    </>
                  )}
                </CardContent>
              </Card>
                );
              })()}
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  // 2. Maintenance Schedule (equipment_maintenance table)
  const renderMaintenanceTab = () => (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
          <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
          Vedlikeholdsplan
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<Schedule />} 
          sx={{ bgcolor: config.color }}
          onClick={() => showMaintenanceToast('scheduled','Canon EOS R5','15. mars 2025')}
        >
          Planlegg service
        </Button>
      </Box>

      {maintenanceLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2.5 }}>
          <CircularProgress />
        </Box>
      ) : maintenanceSchedule.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)' }}>
          <Schedule sx={{ fontSize: 64, color: config.color, opacity: 0.3, mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Ingen planlagt vedlikehold
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Hold utstyret i toppform med regelmessig service og kalibrering
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<Schedule />} 
            sx={{ bgcolor: config.color }}
            onClick={() => showMaintenanceToast('scheduled','Ditt utstyr','neste måned')}
          >
            Planlegg første service
          </Button>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {maintenanceSchedule.map((maintenance: any) => (
            <Grid item xs={12} key={maintenance.id}>
              <Card sx={{ 
                transition: 'transform 0.2s','&:hover': { transform: 'translateY(-2px)' }
              }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={8}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: theming.colors.primary }}>
                        {maintenance.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                        <Chip label={maintenance.maintenanceType} size="small" color="primary" />
                        <Chip label={maintenance.serviceProvider || 'Selvsservice'} size="small" variant="outlined" />
                        {maintenance.warrantyExtended && (
                          <Chip label="Garanti utvidet" size="small" color="success" />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {maintenance.serviceNotes || 'Ingen merknader'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Stack spacing={1}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Planlagt dato:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600}}>
                            {maintenance.scheduledDate ? new Date(maintenance.scheduledDate).toLocaleDateString('no-NO') : 'Ikke satt'}
                          </Typography>
                        </Box>
                        {maintenance.completedDate && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">Fullført:</Typography>
                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600}}>
                              {new Date(maintenance.completedDate).toLocaleDateString('no-NO')}
                            </Typography>
                          </Box>
                        )}
                        {maintenance.cost && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">Kostnad:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: config.color }}>
                              {parseFloat(maintenance.cost).toLocaleString('no-NO')} kr
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  // 3. Equipment Rentals (equipment_rentals table)
  const renderRentalsTab = () => (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
          <ShoppingCart sx={{ mr: 1, verticalAlign: 'middle' }} />
          Utstyr Utleie
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<ShoppingCart />} 
          sx={{ bgcolor: config.color }}
          onClick={() => showRentalToast('created','Sony FX3','(5-10. mars)')}
        >
          Ny utleie
        </Button>
      </Box>

      {rentalsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2.5 }}>
          <CircularProgress />
        </Box>
      ) : equipmentRentals.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)' }}>
          <ShoppingCart sx={{ fontSize: 64, color: config.color, opacity: 0.3, mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Ingen aktive utleier
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Spor utstyr du har leid ut eller leid inn for prosjekter
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<ShoppingCart />} 
            sx={{ bgcolor: config.color }}
            onClick={() => showRentalToast('created','Nytt utstyr','(neste uke)')}
          >
            Registrer utleie
          </Button>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {equipmentRentals.map((rental: any) => {
            const isOverdue = new Date(rental.rentalEndDate) < new Date() && rental.status === 'active';
            const daysRemaining = Math.ceil((new Date(rental.rentalEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <Grid item xs={12} md={6} key={rental.id}>
                <Card sx={{ 
                  border: isOverdue ? '2px solid #f44336' : 'none',
                  transition: 'transform 0.2s','&:hover': { transform: 'translateY(-2px)' }
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: theming.colors.primary }}>
                          {rental.equipmentName || 'Ukjent utstyr'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {rental.rentalCompany || 'Privat utleie'}
                        </Typography>
                      </Box>
                      <Chip 
                        label={isOverdue ? 'FORFALT' : rental.status === 'returned' ? 'RETURNERT' : 'AKTIV'} 
                        size="small"
                        color={isOverdue ? 'error' : rental.status === 'returned' ? 'success' : 'warning'}
                      />
                    </Box>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Utleieperiode:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>
                          {new Date(rental.rentalStartDate).toLocaleDateString('no-NO')} - {new Date(rental.rentalEndDate).toLocaleDateString('no-NO')}
                        </Typography>
                      </Box>
                      {rental.status === 'active' && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Dager igjen:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: isOverdue ? '#f44336' : daysRemaining <= 3 ? '#ff9800' : 'success.main' }}>
                            {isOverdue ? `${Math.abs(daysRemaining)} dager forsinket` : `${daysRemaining} dager`}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Kostnad:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: config.color }}>
                          {parseFloat(rental.rentalCost || 0).toLocaleString('no-NO')} kr
                        </Typography>
                      </Box>
                      {rental.lateFees && parseFloat(rental.lateFees) > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="error">Forsinkelsesgebyr:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                            {parseFloat(rental.lateFees).toLocaleString('no-NO')} kr
                          </Typography>
                        </Box>
                      )}
                      {rental.projectId && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Prosjekt:</Typography>
                          <Typography variant="body2">{rental.clientName || rental.projectId}</Typography>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );

  // 4. Market Prices (market_equipment table)
  const renderMarketTab = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, color: theming.colors.primary }}>
        <MonetizationOn sx={{ mr: 1, verticalAlign: 'middle' }} />
        Markedspriser & Sammenligning
      </Typography>

      {marketLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2.5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Price Trends Overview */}
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 3, height: '100%', bgcolor: 'rgba(255,255,255,0.04)' }}>
              <ShoppingCart sx={{ color: config.color, fontSize: 32, mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: theming.colors.primary }}>
                Pristrender
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {marketEquipment.length} produkter i databasen
              </Typography>
              <Typography variant="h4" sx={{ color: config.color, fontWeight: 700}}>
                {marketEquipment.filter((item: any) => item.availability === 'available').length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tilgjengelige produkter
              </Typography>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ p: 3, height: '100%', bgcolor: 'rgba(255,255,255,0.04)' }}>
              <TrendingUp sx={{ color: '#4caf50', fontSize: 32, mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: theming.colors.primary }}>
                Gjennomsnittlig rating
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Profesjonelle vurderinger
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700}}>
                  {(marketEquipment.reduce((acc: number, item: any) => 
                    acc + parseFloat(item.photographerRating || item.videographerRating || item.musicProducerRating || 0), 0) / (marketEquipment.length || 1)).toFixed(1)}
                </Typography>
                <Typography variant="body2" color="text.secondary">/5.0</Typography>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ p: 3, height: '100%', bgcolor: 'rgba(255,255,255,0.04)' }}>
              <AttachMoney sx={{ color: config.color, fontSize: 32, mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: theming.colors.primary }}>
                Prisspenn
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Laveste til høyeste
              </Typography>
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Fra: {Math.min(...marketEquipment.map((item: any) => parseFloat(item.currentPrice || item.msrp || 0))).toLocaleString('no-NO')} kr
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Til: {Math.max(...marketEquipment.map((item: any) => parseFloat(item.currentPrice || item.msrp || 0))).toLocaleString('no-NO')} kr
                </Typography>
              </Stack>
            </Card>
          </Grid>

          {/* Market Equipment List */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
              Tilgjengelige Produkter
            </Typography>
            <Grid container spacing={2}>
              {marketEquipment.slice(0, 12).map((item: any) => (
                <Grid item xs={12} sm={6} md={4} key={item.id}>
                  <Card sx={{ 
                    height: '100%',
                    transition: 'all 0.2s','&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
                  }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: '0.95rem', color: theming.colors.primary }}>
                        {item.brand} {item.model}
                      </Typography>
                      <Chip 
                        label={item.category} 
                        size="small" 
                        sx={{ mb: 2, bgcolor: `${config.color}20`, color: config.color }}
                      />
                      
                      <Stack spacing={1}>
                        {item.currentPrice && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">Pris:</Typography>
                            <Typography variant="h6" sx={{ color: config.color, fontWeight: 700}}>
                              {parseFloat(item.currentPrice).toLocaleString('no-NO')} kr
                            </Typography>
                          </Box>
                        )}
                        {item.msrp && item.currentPrice && parseFloat(item.msrp) > parseFloat(item.currentPrice) && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                              UVP: {parseFloat(item.msrp).toLocaleString('no-NO')} kr
                            </Typography>
                            <Chip 
                              label={`-${Math.round((1 - parseFloat(item.currentPrice) / parseFloat(item.msrp)) * 100)}%`}
                              size="small"
                              color="success"
                            />
                          </Box>
                        )}
                        {item.photographerRating && profession === 'photographer' && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Rating:</Typography>
                            <Rating value={parseFloat(item.photographerRating)} size="small" readOnly precision={0.1} />
                          </Box>
                        )}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Status:</Typography>
                          <Chip 
                            label={item.availability} 
                            size="small"
                            color={item.availability === 'available' ? 'success' : item.availability === 'limited' ? 'warning' : 'default'}
                          />
                        </Box>
                      </Stack>
                      
                      {item.sourceUrl && (
                        <Button
                          size="small"
                          fullWidth
                          variant="outlined"
                          startIcon={<OpenInNew />}
                          href={item.sourceUrl}
                          target="_blank"
                          sx={{ mt: 2, color: config.color, borderColor: config.color }}
                        >
                          Se hos forhandler
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      )}
    </Box>
  );

  // 5. Lens Database (lens_database table)
  const renderLensesTab = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, color: theming.colors.primary }}>
        <Camera sx={{ mr: 1, verticalAlign: 'middle' }} />
        Objektiv Database
      </Typography>

      {lensLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2.5 }}>
          <CircularProgress />
        </Box>
      ) : lensDatabase.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)' }}>
          <Camera sx={{ fontSize: 64, color: config.color, opacity: 0.3, mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Laster objektivdatabase...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Omfattende database med objektiver for alle fatninger
          </Typography>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {lensDatabase.map((lens: any) => (
            <Grid item xs={12} sm={6} md={4} key={lens.id}>
              <Card sx={{ 
                height: '100%',
                transition: 'all 0.2s','&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: '1rem', color: theming.colors.primary }}>
                    {lens.brand} {lens.model}
                  </Typography>
                  
                  <Stack spacing={1} sx={{ mb: 2 }}>
                    <Chip 
                      label={`${lens.focalLength} ${lens.aperture}`}
                      size="small"
                      sx={{ bgcolor: `${config.color}20`, color: config.color, fontWeight: 600}}
                    />
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={lens.mount} size="small" variant="outlined" />
                      <Chip label={lens.lensType} size="small" variant="outlined" />
                    </Box>
                  </Stack>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Bildestabilisering:</Typography>
                      <CheckCircle sx={{ fontSize: 16, color: lens.imageStabilization ? 'success.main' : 'text.disabled' }} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Værtetting:</Typography>
                      <CheckCircle sx={{ fontSize: 16, color: lens.weatherSealing ? 'success.main' : 'text.disabled' }} />
                    </Box>
                    {lens.weight && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Vekt:</Typography>
                        <Typography variant="caption">{lens.weight}</Typography>
                      </Box>
                    )}
                    {lens.currentPrice && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">Pris:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: config.color }}>
                          {parseFloat(lens.currentPrice).toLocaleString('no-NO')} kr
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  // 6. Software Database (software_database + software_updates tables)
  const renderSoftwareTab = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, color: theming.colors.primary }}>
        <Settings sx={{ mr: 1, verticalAlign: 'middle' }} />
        Programvare & Oppdateringer
      </Typography>

      <Grid container spacing={3}>
        {/* Software Updates Section */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                  <Update sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Tilgjengelige Oppdateringer
                </Typography>
                <Chip 
                  label={`${softwareUpdates.filter((u: any) => u.isLatest).length} nye`}
                  color="warning"
                  size="small"
                />
              </Box>

              {softwareUpdatesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={30} />
                </Box>
              ) : softwareUpdates.length === 0 ? (
                <Alert severity="success">
                  All programvare er oppdatert! ✅
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {softwareUpdates.filter((update: any) => update.isLatest).slice(0, 5).map((update: any) => (
                    <Card key={update.id} variant="outlined" sx={{ bgcolor: update.isCritical ? 'rgba(244,67,54,0.05)' : 'transparent' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                            {update.softwareName} {update.version}
                          </Typography>
                          {update.isCritical && (
                            <Chip label="KRITISK" size="small" color="error" />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Utgitt: {new Date(update.releaseDate).toLocaleDateString('no-NO')}
                        </Typography>
                        {update.downloadSize && (
                          <Typography variant="caption" color="text.secondary">
                            Størrelse: {update.downloadSize}
                          </Typography>
                        )}
                        {update.downloadUrl && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<OpenInNew />}
                            href={update.downloadUrl}
                            target="_blank"
                            sx={{ mt: 1, color: config.color, borderColor: config.color }}
                          >
                            Last ned oppdatering
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Software Database */}
        <Grid item xs={12}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
            Anbefalt Programvare for {getProfessionDisplayName(profession)}er
          </Typography>

          {softwareLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2.5 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {softwareDatabase.slice(0, 9).map((software: any) => (
                <Grid item xs={12} sm={6} md={4} key={software.id}>
                  <Card sx={{ 
                    height: '100%',
                    transition: 'all 0.2s','&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
                  }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: '1rem', color: theming.colors.primary }}>
                        {software.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {software.developer}
                      </Typography>
                      
                      <Stack spacing={1}>
                        <Chip 
                          label={software.category} 
                          size="small"
                          sx={{ bgcolor: `${config.color}20`, color: config.color }}
                        />
                        {software.pricingModel && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">Modell:</Typography>
                            <Typography variant="caption">{software.pricingModel}</Typography>
                          </Box>
                        )}
                        {software.price && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">Pris:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: config.color }}>
                              {parseFloat(software.price).toLocaleString('no-NO')} kr
                            </Typography>
                          </Box>
                        )}
                        {software.photographerRating && profession === 'photographer' && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Rating:</Typography>
                            <Rating value={parseFloat(software.photographerRating)} size="small" readOnly precision={0.1} />
                          </Box>
                        )}
                        {software.videographerRating && profession === 'videographer' && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Rating:</Typography>
                            <Rating value={parseFloat(software.videographerRating)} size="small" readOnly precision={0.1} />
                          </Box>
                        )}
                        {software.freeTrialAvailable && (
                          <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                            <Typography variant="caption">
                              {software.freeTrialDays} dagers gratis prøveperiode
                            </Typography>
                          </Alert>
                        )}
                      </Stack>
                      
                      {software.website && (
                        <Button
                          size="small"
                          fullWidth
                          variant="outlined"
                          startIcon={<OpenInNew />}
                          href={software.website}
                          target="_blank"
                          sx={{ mt: 2, color: config.color, borderColor: config.color }}
                        >
                          Besøk nettside
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>
      </Grid>
    </Box>
  );

  const renderMarketSection = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ p: 3, height: '100%', borderRadius: 2, ...theming.getThemedCardSx() }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ShoppingCart sx={{ color: config.color, mr: 1, fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary }}>
              Pristrender
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Følg prisutvikling på populært utstyr
          </Typography>
          <Button 
            size="small" 
            onClick={() => showMarketToast('market-update', 'Pristrender er oppdatert for valgt profesjon')}
            sx={{ 
              color: config.color,
              fontWeight: 600,
              '&:hover': { backgroundColor: `${config.color}15` }
            }}
          >
            Se pristrender
          </Button>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ p: 3, height: '100%', borderRadius: 2, ...theming.getThemedCardSx() }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <MonetizationOn sx={{ color: config.color, mr: 1, fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary }}>
              Markedsplassering
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sammenlign priser fra norske forhandlere
          </Typography>
          <Button 
            size="small" 
            onClick={() => showMarketToast('price-alert', 'Markedspriser sammenlignes mot norske forhandlere')}
            sx={{ 
              color: config.color,
              fontWeight: 600,
              '&:hover': { backgroundColor: `${config.color}15` }
            }}
          >
            Sammenlign priser
          </Button>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ p: 3, height: '100%', borderRadius: 2, ...theming.getThemedCardSx() }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <BugReport sx={{ color: config.color, mr: 1, fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary }}>
              Kjente problemer
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Rapporter og løsninger på kjente problemer
          </Typography>
          <Button 
            size="small" 
            onClick={() => showNewsToast('new-articles', actualGearNews.length || 0)}
            sx={{ 
              color: config.color,
              fontWeight: 600,
              '&:hover': { backgroundColor: `${config.color}15` }
            }}
          >
            Se rapporter
          </Button>
        </Card>
      </Grid>
    </Grid>
);

  return (
    <Box className={className} sx={{ maxWidth: '100%', mx: 'auto', ...workspaceChromeSx }}>
      {/* Enhanced Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 4,
          p: { xs: 2.5, md: 3.5 },
          borderRadius: { xs: 4, md: 5 },
          border: `1px solid ${config.color}26`,
          background: `radial-gradient(circle at top right, ${config.color}16, transparent 34%), radial-gradient(circle at bottom left, ${config.color}10, transparent 28%), rgba(255,255,255,0.04)`,
          boxShadow: '0 24px 70px rgba(255,255,255,0.08)',
          overflow: 'hidden',
          ...theming.getThemedCardSx(),
        }}
      >
        <Grid container spacing={3} alignItems="flex-start">
          <Grid item xs={12} xl={8}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box
                  sx={{
                    width: { xs: 56, md: 68 },
                    height: { xs: 56, md: 68 },
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: `linear-gradient(135deg, ${config.color}22, ${config.color}0f)`,
                    color: config.color,
                    boxShadow: `inset 0 0 0 1px ${config.color}22`,
                  }}
                >
                  {React.cloneElement(config.icon, {
                    sx: { fontSize: { xs: 30, md: 38 }, color: config.color },
                  })}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: theming.colors.primary }}>
                    {config.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 0.75 }}>
                    {dynamicProfessionConfig?.displayName || getProfessionDisplayName(profession)} · {professionDashboardTitle}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 760 }}>
                    {config.description}. Hele utstyrsområdet er samlet som én workspace for database, inventar, service, utleie, programvare og operative verktøy.
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {projectLabel && (
                  <Chip
                    label={`Prosjekt: ${projectLabel}`}
                    color="primary"
                    size="small"
                    onClick={handleProjectFocus}
                    sx={{ cursor: 'pointer' }}
                  />
                )}
              </Stack>
            </Stack>
          </Grid>

          <Grid item xs={12} xl={4}>
            <Stack spacing={1.25} alignItems={{ xs: 'stretch', xl: 'flex-end' }}>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent={{ xs: 'flex-start', xl: 'flex-end' }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Info />}
                  onClick={() => {
                    setCurrentTab(0);
                    showDatabaseToast('synced');
                  }}
                  sx={{ backgroundColor: config.color }}
                >
                  Synk database
                </Button>
                {projectLabel && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Business />}
                    onClick={handleProjectFocus}
                  >
                    Åpne prosjekt
                  </Button>
                )}
                {isSupported && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={pushEnabled ? <NotificationsActive /> : <Notifications />}
                    onClick={() => setPushSettingsOpen(true)}
                  >
                    Varsler
                  </Button>
                )}
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Equipment Subtabs */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 1,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 20px 50px rgba(255,255,255,0.08)',
          ...theming.getThemedCardSx(),
        }}
      >
        <Tabs 
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            minHeight: 60,
            '& .MuiTabs-flexContainer': {
              gap: 0.75,
            },
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.95rem',
              minHeight: 52,
              px: 1.75,
              borderRadius: 3,
              border: '1px solid transparent',
              transition: 'all 0.18s ease',
              '&.Mui-selected': {
                backgroundColor: `${config.color}16`,
                borderColor: `${config.color}28`,
                color: config.color,
              },
            },
            '& .MuiTabs-scrollButtons': {
              borderRadius: 2,
            },
            '& .MuiTabs-indicator': {
              backgroundColor: config.color,
              height: 3,
              borderRadius: 999,
            },
          }}
        >
          {visibleEquipmentTabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <Tab
                key={tab.id}
                icon={<TabIcon />}
                label={tab.label}
                iconPosition="start"
                sx={{ gap: 1 }}
              />
          );
      })}
        </Tabs>
      </Paper>

      {/* Tab Content - All 9 Equipment Management Tabs */}
      
      {/* Tab 0: Utstyr Database - Comprehensive catalog */}
      {activeTabId === 'database' && (
        <Box>
          <ComprehensiveGearDatabase />
        </Box>
      )}
      
      {/* Tab 1: Mitt Utstyr - Personal inventory (equipment table) */}
      {activeTabId === 'inventory' && renderInventoryTab()}
      
      {/* Tab 2: Vedlikehold - Maintenance schedule (equipment_maintenance table) */}
      {activeTabId === 'maintenance' && renderMaintenanceTab()}
      
      {/* Tab 3: Utleie - Equipment rentals (equipment_rentals table) */}
      {activeTabId === 'rentals' && renderRentalsTab()}
      
      {/* Tab 4: Markedspriser - Market comparison (market_equipment table) */}
      {activeTabId === 'market' && renderMarketTab()}
      
      {/* Tab 5: Programvare - Software database (software_database + software_updates tables) */}
      {activeTabId === 'software' && renderSoftwareTab()}
      
      {/* Tab 6: Verktøy - Tools and utilities */}
      {activeTabId === 'tools' && renderToolsTab()}
      
      {/* Tab 7: Nyheter - Equipment news and firmware updates */}
      {activeTabId === 'news' && (
        <Stack spacing={3}>
        {/* Professional Equipment Database Section */}
        <Accordion 
          expanded={expandedAccordion === 'database'}
          onChange={handleAccordionChange('database')}
          elevation={3}
          sx={{ 
            borderRadius: 2, '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{ 
              backgroundColor: `${config.color}12`,
              borderRadius: expandedAccordion === 'database' ? '8px 8px 0 0' : '8px',
              minHeight: 72, '&.Mui-expanded': { 
                borderRadius: '8px 8px 0 0',
                minHeight: 72
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Category sx={{ color: config.color, mr: 2, fontSize: 28 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: theming.colors.primary }}>
                  Profesjonell Utstyr Database
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Søk gjennom omfattende database med {config.brands.length}+ premium merker og {config.categories.length} kategorier
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Chip 
                  label={`${config.categories.length} kategorier`}
                  size="small" 
                  color="primary"
                />
                <Chip 
                  label={`${config.brands.length}+ merker`}
                  size="small" 
                  variant="outlined"
                />
              </Stack>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2.5 }}>
            {renderEquipmentDatabase()}
          </AccordionDetails>
        </Accordion>

        {/* Latest News Section */}
        <Accordion 
          expanded={expandedAccordion === 'news'}
          onChange={handleAccordionChange('news')}
          elevation={3}
          sx={{ 
            borderRadius: 2, '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{ 
              backgroundColor: `${config.color}12`,
              borderRadius: expandedAccordion === 'news' ? '8px 8px 0 0' : '8px',
              minHeight: 72, '&.Mui-expanded': { 
                borderRadius: '8px 8px 0 0',
                minHeight: 72
        }
        }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Article sx={{ color: config.color, mr: 2, fontSize: 28 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: theming.colors.primary }}>
                  Siste Utstyr Nyheter
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ferske nyheter fra internasjonale kilder: {config.brands.slice(0, 3).join(', ')}...
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Chip 
                  label={isLoading ? 'Henter...' : `${actualGearNews?.length || 0} artikler`}
                  size="small" 
                  color="secondary"
                />
                <Chip 
                  label="40+ kilder" 
                  size="small" 
                  variant="outlined"
                />
              </Stack>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2.5 }}>
            {renderNewsSection()}
          </AccordionDetails>
        </Accordion>

        {/* Firmware Updates Section */}
        <Accordion 
          expanded={expandedAccordion === 'firmware'}
          onChange={handleAccordionChange('firmware')}
          elevation={3}
          sx={{ 
            borderRadius: 2, '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{ 
              backgroundColor: `${config.color}12`,
              borderRadius: expandedAccordion === 'firmware' ? '8px 8px 0 0' : '8px',
              minHeight: 72, '&.Mui-expanded': { 
                borderRadius: '8px 8px 0 0',
                minHeight: 72
        }
        }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Memory sx={{ color: config.color, mr: 2, fontSize: 28 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: theming.colors.primary }}>
                  Firmware Oppdateringer
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Automatisk overvåking av firmware fra {config.brands.slice(0, 3).join(', ')}...
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Chip 
                  label={firmwareLoading ? 'Sjekker...' : `${firmwareData?.data?.length || 0} enheter`}
                  size="small" 
                  color="info"
                />
                <Chip 
                  label="Auto-sjekk" 
                  size="small" 
                  variant="outlined"
                />
              </Stack>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2.5 }}>
            {renderFirmwareSection()}
          </AccordionDetails>
        </Accordion>

        {/* Market Analysis Section */}
        <Accordion 
          expanded={expandedAccordion === 'market'}
          onChange={handleAccordionChange('market')}
          elevation={3}
          sx={{ 
            borderRadius: 2, '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{ 
              backgroundColor: `${config.color}12`,
              borderRadius: expandedAccordion === 'market' ? '8px 8px 0 0' : '8px',
              minHeight: 72, '&.Mui-expanded': { 
                borderRadius: '8px 8px 0 0',
                minHeight: 72
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <TrendingUp sx={{ color: config.color, mr: 2, fontSize: 28 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: theming.colors.primary }}>
                  Markedsanalyse & Priser
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pristrender, sammenligning og markedsintelligens fra norske forhandlere
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Chip 
                  label="Live priser" 
                  size="small" 
                  color="success"
                />
                <Chip 
                  label="Norsk marked" 
                  size="small" 
                  variant="outlined"
                />
              </Stack>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2.5 }}>
            {renderMarketSection()}
          </AccordionDetails>
        </Accordion>
        </Stack>
      )}

      {/* Read More Dialog */}
      <Dialog 
        open={readMoreOpen}
        onClose={() => setReadMoreOpen(false)}
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: workspaceDialogPaperSx
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          pb: 2,
          px: 3,
          pt: 3,
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          background: `linear-gradient(135deg, ${config.color}14, rgba(248,250,252,0.94))`
        }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
            {selectedArticle?.title}
          </Typography>
          <IconButton 
            onClick={() => setReadMoreOpen(false)}
            sx={{ color: 'text.secondary' }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ px: 3, py: 2.5, borderColor: 'rgba(255,255,255,0.10)' }}>
          <Box sx={{ mb: 2 }}>
            <Chip 
              label={selectedArticle?.category}
              sx={{ 
                backgroundColor: `${config.color}15`,
                color: config.color,
                mr: 1 
        }}
            />
            <Chip 
              label={selectedArticle?.brand}
              variant="outlined" 
              sx={{ mr: 1 }}
            />
            {selectedArticle?.price && (
              <Chip 
                label={selectedArticle.price}
                color="secondary"
                variant="outlined"
              />
            )}
          </Box>
          <Typography variant="body1" sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {selectedArticle?.content || selectedArticle?.summary}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(255,255,255,0.10)', justifyContent: 'space-between' }}>
          {selectedArticle?.url && (
            <Button
              href={selectedArticle.url}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<OpenInNew />}
              sx={{ color: config.color }}
            >
              Besøk kilde
            </Button>
          )}
          <Button onClick={() => setReadMoreOpen(false)} variant="contained">
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={addEquipmentOpen}
        onClose={() => {
          if (!addInventoryMutation.isPending) {
            setAddEquipmentOpen(false);
          }
        }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: workspaceDialogPaperSx }}
      >
        <DialogTitle
          sx={{
            px: 3,
            pt: 3,
            pb: 2,
            borderBottom: '1px solid rgba(255,255,255,0.10)',
            background: `linear-gradient(135deg, ${config.color}14, rgba(248,250,252,0.94))`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                Legg til utstyr
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Registrer utstyr i inventaret ditt for vedlikehold, verdi og prosjektkontekst.
              </Typography>
            </Box>
            <IconButton
              onClick={() => setAddEquipmentOpen(false)}
              disabled={addInventoryMutation.isPending}
              sx={{ color: 'text.secondary' }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 3 }}>
          <Stack spacing={2.25} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ alignItems: 'flex-start' }}>
              Velg kategori, merke og modell fra katalogen for mer presise forslag og riktigere leverandørbilder. Du kan fortsatt skrive alt inn manuelt hvis utstyret ikke finnes i listen.
            </Alert>
            <TextField
              label="Visningsnavn"
              value={inventoryForm.name}
              onChange={(event) => updateInventoryField('name', event.target.value)}
              placeholder="F.eks. Hovedkamera bryllup"
              fullWidth
              helperText="Hvis feltet er tomt, opprettes visningsnavnet automatisk fra merke og modell."
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel id="inventory-category-label">Kategori</InputLabel>
                  <Select
                    labelId="inventory-category-label"
                    label="Kategori"
                    value={inventoryForm.category}
                    onChange={(event) => updateInventoryField('category', event.target.value)}
                  >
                    {inventoryCategoryOptions.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel id="inventory-status-label">Status</InputLabel>
                  <Select
                    labelId="inventory-status-label"
                    label="Status"
                    value={inventoryForm.status}
                    onChange={(event) => updateInventoryField('status', event.target.value)}
                  >
                    {inventoryStatusOptions.map((statusOption) => (
                      <MenuItem key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel id="inventory-condition-label">Tilstand</InputLabel>
                  <Select
                    labelId="inventory-condition-label"
                    label="Tilstand"
                    value={inventoryForm.condition}
                    onChange={(event) => updateInventoryField('condition', event.target.value)}
                  >
                    {inventoryConditionOptions.map((conditionOption) => (
                      <MenuItem key={conditionOption.value} value={conditionOption.value}>
                        {conditionOption.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={inventoryBrandOptions}
                  loading={inventoryCatalogMatchesLoading && normalizedInventoryCatalogCategoryValue.length > 0}
                  noOptionsText="Ingen merker funnet. Skriv inn manuelt."
                  value={inventoryForm.brand}
                  onChange={(_event, nextValue) => {
                    updateInventoryField('brand', typeof nextValue === 'string' ? nextValue : '');
                  }}
                  onInputChange={(_event, nextValue, reason) => {
                    if (reason !== 'reset') {
                      updateInventoryField('brand', nextValue);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Merke"
                      placeholder="Velg eller skriv merke"
                      required
                      helperText={
                        inventoryForm.category
                          ? 'Merker filtreres automatisk etter valgt kategori.'
                          : 'Velg fra katalogen eller skriv inn manuelt.'
                      }
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={inventoryModelOptions}
                  loading={inventoryCatalogMatchesLoading}
                  noOptionsText="Ingen modeller funnet. Skriv inn manuelt."
                  value={inventoryForm.model}
                  onChange={(_event, nextValue) => {
                    const nextModel = typeof nextValue === 'string' ? nextValue : '';
                    updateInventoryField('model', nextModel);

                    const matchedCatalogItem = inventoryCatalogMatches.find(
                      (item) =>
                        normalizeInventoryCatalogToken(item.model) ===
                          normalizeInventoryCatalogToken(nextModel) &&
                        (
                          inventoryForm.brand.trim().length === 0 ||
                          normalizeInventoryCatalogToken(item.brand) ===
                            normalizeInventoryCatalogToken(inventoryForm.brand)
                        ),
                    );

                    if (matchedCatalogItem?.brand && inventoryForm.brand.trim().length === 0) {
                      updateInventoryField('brand', matchedCatalogItem.brand);
                    }

                    if (matchedCatalogItem?.category) {
                      const matchedDisplayCategory = inventoryCategoryOptions.find(
                        (category) =>
                          normalizeInventoryCatalogCategory(category) ===
                          normalizeInventoryCatalogToken(matchedCatalogItem.category || ''),
                      );

                      if (matchedDisplayCategory) {
                        updateInventoryField('category', matchedDisplayCategory);
                      }
                    }
                  }}
                  onInputChange={(_event, nextValue, reason) => {
                    if (reason !== 'reset') {
                      updateInventoryField('model', nextValue);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Modell"
                      placeholder="Velg eller skriv modell"
                      required
                      helperText={
                        inventoryForm.brand
                          ? 'Modellforslag tilpasses merke og kategori.'
                          : 'Velg gjerne merke først for mer treffsikre modellforslag.'
                      }
                    />
                  )}
                  renderOption={(props, option) => {
                    const { key, ...optionProps } = props;
                    const matchedItem = inventoryCatalogMatches.find(
                      (item) =>
                        normalizeInventoryCatalogToken(item.model) ===
                          normalizeInventoryCatalogToken(option) &&
                        (
                          inventoryForm.brand.trim().length === 0 ||
                          normalizeInventoryCatalogToken(item.brand) ===
                            normalizeInventoryCatalogToken(inventoryForm.brand)
                        ),
                    );

                    return (
                      <Box component="li" key={key} {...optionProps}>
                        {matchedItem?.imageUrl ? (
                          <Box
                            component="img"
                            src={matchedItem.imageUrl}
                            alt={`${matchedItem.brand} ${matchedItem.model}`}
                            sx={{
                              width: 52,
                              height: 52,
                              borderRadius: 2,
                              objectFit: 'cover',
                              border: '1px solid rgba(255,255,255,0.10)',
                              mr: 1.5,
                              flexShrink: 0,
                              backgroundColor: 'rgba(248,250,252,0.9)',
                            }}
                          />
                        ) : null}
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {option}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {[matchedItem?.brand, matchedItem?.category].filter(Boolean).join(' • ') || 'Katalogtreff'}
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  }}
                />
              </Grid>
            </Grid>
            {selectedInventoryCatalogMatch ? (
              <Alert severity="success" sx={{ alignItems: 'flex-start' }}>
                Katalogtreff funnet for <strong>{selectedInventoryCatalogMatch.brand} {selectedInventoryCatalogMatch.model}</strong>. Leverandørbilde og korrekt produktkobling brukes ved lagring.
              </Alert>
            ) : !inventoryCatalogMatchesLoading && inventoryForm.brand.trim().length > 0 && inventoryForm.model.trim().length > 0 ? (
              <Alert severity="warning" sx={{ alignItems: 'flex-start' }}>
                Fant ikke et sikkert katalogtreff på denne kombinasjonen. Du kan fortsatt lagre manuelt, men bilde og leverandørkobling hentes bare hvis systemet finner en trygg match.
              </Alert>
            ) : null}
            <TextField
              label="Bilde-URL"
              value={inventoryForm.imageUrl}
              onChange={(event) => updateInventoryField('imageUrl', event.target.value)}
              placeholder="https://..."
              fullWidth
            />
            <TextField
              label="Notater"
              value={inventoryForm.notes}
              onChange={(event) => updateInventoryField('notes', event.target.value)}
              placeholder="Serienummer, forsikring, bruksscenario eller annet relevant."
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
          <Button
            onClick={() => setAddEquipmentOpen(false)}
            disabled={addInventoryMutation.isPending}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            disabled={
              addInventoryMutation.isPending ||
              inventoryForm.brand.trim().length === 0 ||
              inventoryForm.model.trim().length === 0
            }
            onClick={() => addInventoryMutation.mutate(inventoryForm)}
            sx={{ minWidth: 148 }}
          >
            {addInventoryMutation.isPending ? 'Lagrer...' : 'Lagre utstyr'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog
          open={pushSettingsOpen}
          onClose={() => setPushSettingsOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: workspaceDialogPaperSx }}
        >
          <DialogTitle
            sx={{
              px: 3,
              pt: 3,
              pb: 2,
              borderBottom: '1px solid rgba(255,255,255,0.10)',
              background: `linear-gradient(135deg, ${config.color}14, rgba(248,250,252,0.94))`,
            }}
          >
            Push-varsler innstillinger
          </DialogTitle>
          <DialogContent sx={{ px: 3, py: 2.5 }}>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            <Button onClick={() => setPushSettingsOpen(false)} variant="contained" sx={{ backgroundColor: config.color }}>
              Lukk
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
);
}
