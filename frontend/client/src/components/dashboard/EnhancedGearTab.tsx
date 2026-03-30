import { useTheming } from '../../utils/theming-helper';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import { isProfessionFeatureAvailable, getAllProfessionFeatures } from '../../../../shared/profession-feature-matrix';
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { getProfessionIcon } from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
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
  Tooltip,
} from '@mui/material';
import {
  Search,
  ExpandMore,
  Star,
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
  LensDatabaseIcon,
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
  
  // Additional equipment icons
  LensIcon,
  CameraGearIcon,
  LightingIcon,
  CameraSettingsIcon
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

  // Get current user ID before any hooks depend on it
  const { user } = useAuth();
  const userId = user?.id || 'guest';
  
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
  
  // Get all available features for this profession
  const availableFeatures = useMemo(() => 
    getAllProfessionFeatures(profession).filter((feature) => features.checkFeatureAccess(feature).hasAccess),
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
      { id: 'lenses', label: 'Objektiver', icon: LensDatabaseIcon },
      { id: 'software', label: 'Programvare', icon: SoftwareDatabaseIcon },
      { id: 'tools', label: 'Verktøy', icon: EquipmentToolsIcon },
      { id: 'news', label: 'Nyheter', icon: EquipmentNewsIcon }
    ],
    []
  );

  const dynamicProfessionConfig = professionConfigs[profession];
  const professionDashboardTitle = professionAdapter.adaptDashboardTitle();
  const professionProjectTypes = professionAdapter.getProjectTypes();
  const professionHourlyRate = professionAdapter.getDefaultHourlyRate();
  const professionKeywords = professionAdapter.getProfessionSpecificKeywords().slice(0, 3);
  const professionTips = professionAdapter.getProfessionSEOTips().slice(0, 2);
  const adaptedTabLabels = professionAdapter.adaptTabLabels();
  const projectLabel = selectedProject?.name || selectedProject?.title || null;
  const featureSummary = useMemo(
    () => `${availableFeatures.length} funksjoner aktive`,
    [availableFeatures.length]
  );
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

      await refetchFirmwareData();

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
  }, [addToast, analytics, features, firmwareData?.updatesAvailable, navigateToTab, performance, profession, refetchFirmwareData, userId]);

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
  const getProfessionConfig = (profession: string) => {
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
  };

  const config = getProfessionConfig(profession);
  const professionDisplayIcon = useMemo(
    () => React.cloneElement(getProfessionIcon(dynamicProfessionConfig?.displayName || profession), {
      sx: { fontSize: 20, color: config.color }
    }),
    [config.color, dynamicProfessionConfig?.displayName, profession]
  );
  const actualGearNews = gearNews?.success ? gearNews.data : [];

  // Tools functionality
  const renderToolsTab = () => {
    const firmwareUpdatesCount = firmwareData?.updatesAvailable || 0;
    const latestSoftwareUpdates = Array.isArray(softwareUpdates)
      ? softwareUpdates.filter((update: any) => update.isLatest).length
      : 0;
    const toolHealthCards = [
      {
        label: 'Aktive verktøy',
        value: `${toolsAccess ? 4 : 3}`,
        description: 'operativt i arbeidsflaten',
        accent: config.color,
      },
      {
        label: 'Push-status',
        value: pushEnabled ? 'På' : 'Av',
        description: isSupported ? 'kan styres herfra' : 'ikke støttet på denne enheten',
        accent: pushEnabled ? '#059669' : '#64748b',
      },
      {
        label: 'Bildesynk',
        value: `${equipmentImages.length}`,
        description: imagesLoading ? 'oppdaterer inventarbilder' : 'bilder koblet til utstyr',
        accent: '#0f766e',
      },
      {
        label: 'Oppdateringer',
        value: `${firmwareUpdatesCount + latestSoftwareUpdates}`,
        description: 'firmware + programvare klare for review',
        accent: '#7c3aed',
      },
    ];

    const toolModules = [
      {
        id: 'worklog',
        title: 'Google Keep Arbeidslogg',
        status: 'Integrert',
        icon: <Article sx={{ fontSize: 24 }} />,
        accent: '#2563eb',
        description: 'Arbeidslogger og raske notater holdes i samme flyt som resten av gear-workspace, uten å forlate dashboardet.',
        bullets: [
          'Worklog-data kan gjenbrukes når du dokumenterer gear-bruk og vedlikehold.',
          'Shortcut-flyten er allerede koblet til lynnotater og oppfølging.',
        ],
        meta: 'Ctrl+Shift+W for lynnotat · Ctrl+Shift+N for oversikt',
        primaryAction: {
          label: 'Åpne shortcuts',
          onClick: focusShortcutWorkspace,
        },
      },
      {
        id: 'memory',
        title: 'Minneskort & Recovery',
        status: 'Klar',
        icon: <Memory sx={{ fontSize: 24 }} />,
        accent: '#ea580c',
        description: 'Tilbehørsdatabasen brukes som operativ inngang for minnekort, backup-medier og recovery-relatert utstyr.',
        bullets: [
          'Åpner databasen direkte filtrert mot tilbehør og minnekort.',
          'Passer for både feltbackup, redundans og filgjenoppretting.',
        ],
        meta: '5-nivå recovery · feltbackup · redundans',
        primaryAction: {
          label: 'Åpne tilbehørsdatabase',
          onClick: openAccessoryToolkit,
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
            background: `radial-gradient(circle at top right, ${config.color}18, transparent 38%), linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))`,
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

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {toolHealthCards.map((card) => (
            <Grid item xs={6} md={3} key={card.label}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  background: `linear-gradient(180deg, ${card.accent}12, rgba(255,255,255,0.95))`,
                  minHeight: 124,
                }}
              >
                <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                  {card.label}
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 800, color: theming.colors.primary }}>
                  {card.value}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {card.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} xl={8}>
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
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92))',
                      transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 18px 48px rgba(15, 23, 42, 0.08)',
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

          <Grid item xs={12} xl={4}>
            <Stack spacing={2.5}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 4,
                  border: '1px solid',
                  borderColor: 'divider',
                  background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(30,41,59,0.96))',
                  color: 'white',
                }}
              >
                <Typography variant="overline" sx={{ letterSpacing: '0.12em', color: 'rgba(255,255,255,0.72)' }}>
                  Operativ status
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.75, mb: 2, fontWeight: 700 }}>
                  Gear-verktøyene er koblet til samme arbeidskontekst
                </Typography>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.76)' }}>
                      Aktiv profesjon
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {getProfessionDisplayName(profession)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.76)' }}>
                      Prosjektkontekst
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {projectLabel || 'Ingen prosjekt valgt'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.76)' }}>
                      Neste anbefalte steg
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {firmwareUpdatesCount > 0 ? 'Gå gjennom firmwarefunn' : 'Oppdater tilbehør og bilder'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 4,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'rgba(255,255,255,0.92)',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: theming.colors.primary }}>
                  Anbefalt flyt
                </Typography>
                <Stack spacing={1.5}>
                  {[
                    'Start med tilbehørsdatabasen når du trenger kort, backup-medier eller recovery-utstyr.',
                    'Synk firmware manuelt før viktige opptak når du vil bekrefte at alt er oppdatert.',
                    'Bruk push-varsler for å samle vedlikehold, firmware og gear-hendelser i ett varslingsspor.',
                  ].map((item, index) => (
                    <Stack key={item} direction="row" spacing={1.25} alignItems="flex-start">
                      <Box
                        sx={{
                          minWidth: 24,
                          height: 24,
                          borderRadius: '999px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: `${config.color}18`,
                          color: config.color,
                          fontWeight: 800,
                          fontSize: '0.75rem',
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {item}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Stack>
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
                background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,250,251,0.96))',
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
                  backgroundColor: 'background.paper',
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
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
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
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
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
                border: item.hasUpdate ? `2px solid ${config.color}` : '1px solid #e0e0e0',
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
              : `${equipmentImages.length} bilder er knyttet til inventaret ditt`}
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<Camera />} 
          sx={{ bgcolor: config.color }}
          onClick={() => {
            handleEquipmentFlow('Canon EOS R5', 'create', { origin: 'inventory-header-cta' });
            showEquipmentToast('added', 'Canon EOS R5');
          }}
        >
          Legg til utstyr
        </Button>
      </Box>

      {inventoryLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : userEquipment.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.9)' }}>
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
            onClick={() => {
              handleEquipmentFlow('Nytt utstyr', 'create', { origin: 'inventory-empty-state' });
              showEquipmentToast('added', 'Nytt utstyr');
            }}
          >
            Registrer første utstyr
          </Button>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {userEquipment.map((item: any) => (
            <Grid item xs={12} sm={6} md={4} key={item.id}>
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
                </CardContent>
              </Card>
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
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : maintenanceSchedule.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.9)' }}>
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
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : equipmentRentals.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.9)' }}>
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
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Price Trends Overview */}
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 3, height: '100%', bgcolor: 'rgba(255,255,255,0.9)' }}>
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
            <Card sx={{ p: 3, height: '100%', bgcolor: 'rgba(255,255,255,0.9)' }}>
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
            <Card sx={{ p: 3, height: '100%', bgcolor: 'rgba(255,255,255,0.9)' }}>
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
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : lensDatabase.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.9)' }}>
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
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.9)', mb: 3 }}>
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
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
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
    <Box className={className} sx={{ maxWidth: '100%', mx: 'auto' }}>
      {/* Enhanced Header */}
      <Paper elevation={3} sx={{ 
        mb: 4, 
        p: 4, 
        background: `linear-gradient(135deg, ${config.color}15 0%, ${config.color}05 100%)`,
        borderRadius: 3,
        border: `2px solid ${config.color}30`,
        ...theming.getThemedCardSx()
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {React.cloneElement(config.icon, { 
              sx: { fontSize: 48, color: config.color, mr: 3 }
            })}
            <Box>
              <Typography variant="h4" sx={{ 
                fontWeight: 700,
                mb: 1,
                color: theming.colors.primary
              }}>
                {config.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                {dynamicProfessionConfig?.displayName || getProfessionDisplayName(profession)} · {professionDashboardTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {config.description}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip 
                  icon={professionDisplayIcon}
                  label={featureSummary}
                  variant="outlined"
                  size="small"
                />
                <Chip 
                  label="Live-oppdateringer" 
                  color="success" 
                  size="small"
                  icon={<Schedule />}
                />
                <Chip 
                  label={`${gearNews?.length || 0} nyheter`}
                  variant="outlined"
                  size="small"
                />
                <Chip
                  icon={<Star />}
                  label={`${professionProjectTypes.length} prosjektmaler`}
                  variant="outlined"
                  size="small"
                />
                <Chip
                  icon={<AttachMoney />}
                  label={`${professionHourlyRate} kr/t standard`}
                  variant="outlined"
                  size="small"
                />
                {projectLabel && (
                  <Chip
                    label={`Prosjekt: ${projectLabel}`}
                    color="primary"
                    size="small"
                    onClick={handleProjectFocus}
                  />
                )}
              </Stack>
            </Box>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="outlined"
              size="small"
              startIcon={<Info />}
              onClick={() => {
                setCurrentTab(0);
                showDatabaseToast('synced');
              }}
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
              <Tooltip title="Push-varsler innstillinger">
                <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
                  {pushEnabled ? <NotificationsActive /> : <Notifications />}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={8}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {professionKeywords.map((keyword) => (
                <Chip key={keyword} label={keyword} size="small" variant="outlined" />
              ))}
              {professionTips.map((tip) => (
                <Chip key={tip} label={tip} size="small" icon={<Info />} />
              ))}
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }} useFlexGap flexWrap="wrap">
              <Chip icon={<CameraGearIcon />} label={adaptedTabLabels.equipment} size="small" onClick={() => navigateToTab('inventory')} />
              <Chip icon={<LensIcon />} label="Objektiver" size="small" onClick={() => navigateToTab('lenses')} />
              <Chip icon={<LightingIcon />} label="Marked" size="small" onClick={() => navigateToTab('market')} />
              <Chip icon={<FirmwareUpdateIcon />} label="Firmware" size="small" onClick={() => navigateToTab('news')} />
              <Chip icon={<CameraSettingsIcon />} label="Programvare" size="small" onClick={() => navigateToTab('software')} />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Equipment Subtabs */}
      <Paper elevation={2} sx={{ mb: 3, borderRadius: 2, ...theming.getThemedCardSx() }}>
        <Tabs 
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: 'divider','& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem','&.Mui-selected': {
                color: config.color,
          }
        }, '& .MuiTabs-indicator': {
              backgroundColor: config.color,
              height:  3,
              borderRadius: '3px 3px 0 0'
      }
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
      
      {/* Tab 5: Objektiver - Lens database (lens_database table) */}
      {activeTabId === 'lenses' && renderLensesTab()}
      
      {/* Tab 6: Programvare - Software database (software_database + software_updates tables) */}
      {activeTabId === 'software' && renderSoftwareTab()}
      
      {/* Tab 7: Verktøy - Tools and utilities */}
      {activeTabId === 'tools' && renderToolsTab()}
      
      {/* Tab 8: Nyheter - Equipment news and firmware updates */}
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
          <AccordionDetails sx={{ p: 4 }}>
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
          <AccordionDetails sx={{ p: 4 }}>
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
          <AccordionDetails sx={{ p: 4 }}>
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
          <AccordionDetails sx={{ p: 4 }}>
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
          sx: { borderRadius: 3 }
    }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          pb: 1
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
        <DialogContent dividers>
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
        <DialogActions sx={{ p: 3 }}>
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

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
);
}
