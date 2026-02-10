import { useTheming } from '../../utils/theming-helper';
import React, { useState, useMemo, useCallback } from 'react';
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
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { 
  Box, Card, CardContent, Typography, Button, Grid, Chip, TextField,
  CircularProgress, Accordion, AccordionSummary, AccordionDetails, 
  InputAdornment, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider,
  Paper, Stack, Rating, IconButton, Alert, Tabs, Tab,
  Tooltip
} from '@mui/material';
import { 
  Search, ExpandMore, Star, TrendingUp, OpenInNew, Close, 
  Info, FiberNew, CheckCircle, Update, Warning, Category,
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
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession);
  const [selectedCategory, setSelectedCategory] = useState('all,');
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>('database');
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [readMoreOpen, setReadMoreOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);
  
  // Feature Access with Profession Feature Matrix
  const gearDatabaseAccess = useMemo(() => 
    isProfessionFeatureAvailable(profession, 'equipment-database,'),
    [profession]
  );
  
  const gearNewsAccess = useMemo(() => 
    isProfessionFeatureAvailable(profession, 'gear-news'),
    [profession]
  );
  
  const toolsAccess = useMemo(() => 
    isProfessionFeatureAvailable(profession, 'keyboard-shortcuts'),
    [profession]
  );
  
  // Get all available features for this profession
  const availableFeatures = useMemo(() => 
    getAllProfessionFeatures(profession),
    [profession]
  );
  
  // Equipment subtabs configuration - EXTENDED WITH ALL DATABASE FEATURES
  // Using custom equipment-specific icons for better visual clarity
  const equipmentTabs = [
    { id: 'database', label: 'Utstyr Database', icon: DatabaseIcon },
    { id: 'inventory', label: 'Mitt Utstyr', icon: EquipmentInventoryIcon },
    { id: 'maintenance', label: 'Vedlikehold', icon: EquipmentMaintenanceIcon },
    { id: 'rentals', label: 'Utleie', icon: EquipmentRentalIcon },
    { id: 'market', label: 'Markedspriser', icon: MarketPricesIcon },
    { id: 'lenses', label: 'Objektiver', icon: LensDatabaseIcon },
    { id: 'software', label: 'Programvare', icon: SoftwareDatabaseIcon },
    { id: 'tools', label: 'Verktøy', icon: EquipmentToolsIcon },
    { id: 'news', label: 'Nyheter', icon: EquipmentNewsIcon }
  ];

  // Fetch firmware status
  const { data: firmwareData, isLoading: firmwareLoading } = useQuery({
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
  
  // Get current user ID
  const { user } = useAuth();
  const userId = user?.id || 'guest';

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
        message: `🔧 Service planlagt for ${equipmentName}${date ? ` - ${date}` : ', '}`,
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
        message: `📅 Utleie, opprettet: ${equipmentName}${details ? ` ${details}` : ', '}`,
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
  const actualGearNews = gearNews?.success ? gearNews.data : [];

  // Tools functionality
  const renderToolsTab = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        <Settings sx={{ color: config.color }} />
        Verktøy & Utilities
      </Typography>
      
      <Grid container spacing={3}>
        {/* Google Keep Worklog Integration */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
            color: 'white',
            transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' },
            ...theming.getThemedCardSx()
          }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Article sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
                    Google Keep Arbeidslogg
                  </Typography>
                  <Chip 
                    label="AKTIVT" 
                    size="small" 
                    sx={{ 
                      bgcolor: 'rgba(25,255,255,0.2)', 
                      color: 'white',
                      fontSize: '0.7rem' 
              }}
                  />
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
                Automatisk synkronisering av arbeidslogger til Google Keep for sikker lagring.
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Shortcuts: Ctrl+Shift+W for lynnotat, Ctrl+Shift+N for oversikt
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Equipment Manager */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
            color: 'white',
            transition: 'transform 0.2s','&:hover': { transform: 'translateY(-2px)' }
      }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Memory sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
                    Minneskortsystem
                  </Typography>
                  <Chip 
                    label="5-NIVÅ" 
                    size="small" 
                    sx={{ 
                      bgcolor: 'rgba(25,255,255,0.2)', 
                      color: 'white',
                      fontSize: '0.7rem' 
              }}
                  />
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
                Avansert 5-nivå forensisk filgjenoppretting og backup-automatisering.
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Session management, backup automation, og filgjenoppretting
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Backup & Sync Tools */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            transition: 'transform 0.2s','&:hover': { transform: 'translateY(-2px)' }
      }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Security sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
                    Google Drive Backup
                  </Typography>
                  <Chip 
                    label="AUTO-SYNC" 
                    size="small" 
                    sx={{ 
                      bgcolor: 'rgba(25,255,255,0.2)', 
                      color: 'white',
                      fontSize: '0.7rem' 
              }}
                  />
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
                Automatisk backup til Google Drive med intelligent mappestruktur.
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                GDPR-compliant, change tracking, undo/redo funksjonalitet
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Firmware Updates */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            color: 'white',
            transition: 'transform 0.2s','&:hover': { transform: 'translateY(-2px)' }
      }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Update sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
                    Firmware Oppdateringer
                  </Typography>
                  <Chip 
                    label={firmwareData?.updatesAvailable > 0 ? `${firmwareData.updatesAvailable} NYE` : 'OPPDATERT'}
                    size="small" 
                    sx={{ 
                      bgcolor: firmwareData?.updatesAvailable > 0 ? 'rgba(25,193,7,0.8)' : 'rgba(255,255,255,0.2)', 
                      color: 'white',
                      fontSize: '0.7rem' 
              }}
                  />
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
                Automatisk overvåking av firmware-oppdateringer for ditt utstyr.
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Daglig sjekking 06:  00, kritiske modeller hver 6. time
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Keyboard Shortcuts Tools - Full Width */}
        <Grid item xs={12}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #ff8c00 0%, #ff6347 100%)',
            color: 'white',
            transition: 'transform 0.2s','&:hover': { transform: 'translateY(-2px)' }
      }}>
            <CardContent sx={{ p: 0,...theming.getThemedCardSx() }}>
              <KeyboardShortcutsTools />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
);

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
                  Sist sjekket: {new Date(item.lastChecked).toLocaleDateString(', ')}
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
        <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
          <Camera sx={{ mr: 1, verticalAlign: 'middle' }} />
          Mitt Utstyr
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<Camera />} 
          sx={{ bgcolor: config.color }}
          onClick={() => showEquipmentToast('added','Canon EOS R5')}
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
            onClick={() => showEquipmentToast('added','Nytt utstyr')}
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
                transition: 'transform 0.2s, box-shadow 0.2s','&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}>
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
                {config.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
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
              </Box>
            </Box>
          </Box>
          {isSupported && (
            <Tooltip title="Push-varsler innstillinger">
              <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
                {pushEnabled ? <NotificationsActive /> : <Notifications />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
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
          {equipmentTabs.map((tab, index) => {
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
      {currentTab === 0 && (
        <Box>
          <ComprehensiveGearDatabase />
        </Box>
      )}
      
      {/* Tab 1: Mitt Utstyr - Personal inventory (equipment table) */}
      {currentTab === 1 && renderInventoryTab()}
      
      {/* Tab 2: Vedlikehold - Maintenance schedule (equipment_maintenance table) */}
      {currentTab === 2 && renderMaintenanceTab()}
      
      {/* Tab 3: Utleie - Equipment rentals (equipment_rentals table) */}
      {currentTab === 3 && renderRentalsTab()}
      
      {/* Tab 4: Markedspriser - Market comparison (market_equipment table) */}
      {currentTab === 4 && renderMarketTab()}
      
      {/* Tab 5: Objektiver - Lens database (lens_database table) */}
      {currentTab === 5 && renderLensesTab()}
      
      {/* Tab 6: Programvare - Software database (software_database + software_updates tables) */}
      {currentTab === 6 && renderSoftwareTab()}
      
      {/* Tab 7: Verktøy - Tools and utilities */}
      {currentTab === 7 && renderToolsTab()}
      
      {/* Tab 8: Nyheter - Equipment news and firmware updates */}
      {currentTab === 8 && (
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