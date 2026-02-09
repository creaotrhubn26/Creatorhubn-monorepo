import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Grid,
  Fade,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  PhotoCameraAlt,
  Videocamcam,
  LibraryMusicNote,
  Store,
  FlashOnOn,
  Speed,
  AutoAwesome,
  Keyboard,
  PlayArrowArrow,
  Stop,
  Settings,
  Gavel,
  AttachMoney,
  Group,
  Assignment,
  VideoCall,
  Analytics,
  PhotoCamera,
  Movie,
  Star,
  Collections,
  Folder,
  LibraryMusic as LibraryMusicNote,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
// Import dynamic profession system
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { useAuth } from '@/hooks/useAuth';

// Import ALL protocol-integrated components for SmartWorkflowSystem coordination
import { lazy, Suspense } from 'react';

// Lazy load major system components for efficient coordination
const QuoteGeneratorModal = lazy(() => import('../modals/QuoteGeneratorModal'));
const PricingManagement = lazy(() => import('../pricing/PricingManagement'));
const CentralizedSalesHub = lazy(() => import('../sales/CentralizedSalesHub'));
const UniversalContractHub = lazy(() => import('./contracts/UniversalContractHub'));
const ProjectCreationWithMemoryCards = lazy(
  () => import('../project/ProjectCreationWithMemoryCards'),
);
const UniversalWorklog = lazy(() => import('../worklog/UniversalWorklog'));
const UniversalCRMDashboard = lazy(() => import('../crm/UniversalCRMDashboard'));
const SmartMeetingNotesEditor = lazy(() => import('../meetings/SmartMeetingNotesEditor'));
const SplitSheetManager = lazy(() => import('./split-sheets/SplitSheetManager'));

// POST-PRODUCTION PROTOCOL COMPONENTS - Phase 3 Project Lifecycle
const PhotoCullingSystem = lazy(() => import('../photo-culling-system'));
const PhotoEnhancementSuite = lazy(() => import('../enhancement/PhotoEnhancementSuite'));
const StoryArcStudio = lazy(() => import('../StoryArcStudio'));
const UniversalShowcase = lazy(() => import('./UniversalShowcase'));
const ProjectFileManager = lazy(() => import('../project-file-manager'));

interface SmartWorkflowSystemProps {
  profession: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
  tabIndex?: number
}

// Enhanced workflow shortcuts integrating ALL protocols - MANDATORY PROTOCOL COMPLIANCE
const workflowShortcuts = {
  photographer: {
    // PROTOCOL INTEGRATION SHORTCUTS - Core Business Workflow
    'Ctrl+Shift+P': {
      name: 'Nytt Prosjekt (Memory Cards, )',
      action: 'createProject',
      category: 'Project Lifecycle',
  }, 'Ctrl+Shift+Q': {
      name: 'Generer Tilbud',
      action: 'generateQuote',
      category: 'Sales & Pricing',
  }, 'Ctrl+Shift+K': {
      name: 'Ny Kontrakt',
      action: 'createContract',
      category: 'Contract System',
  }, 'Ctrl+Shift+M': {
      name: 'Planlegg Møte',
      action: 'scheduleMeeting',
      category: 'Meeting System',
  }, 'Ctrl+Shift+S': {
      name: 'Salg Pipeline',
      action: 'openSalesHub',
      category: 'Sales & Pricing',
  }, 'Ctrl+Shift+W': {
      name: 'Worklog Entry',
      action: 'openWorklog',
      category: 'Project Lifecycle',
  }, 'Ctrl+Shift+R': {
      name: 'CRM Dashboard',
      action: 'openCR',
      category: 'Customer Management',
  }, 'Ctrl+Shift+A': {
      name: 'Prisadministrasjon',
      action: 'openPricing',
      category: 'Sales & Pricing',
  },

    // POST-PRODUCTION PROTOCOL SHORTCUTS - Phase 3 Project Lifecycle
    'Ctrl+Shift+G': {
      name: 'Photo Culling',
      action: 'openPhotoCulling',
      category: 'Post-Production',
  }, 'Ctrl+Shift+H': {
      name: 'Photo Enhancement',
      action: 'openPhotoEnhancement',
      category: 'Post-Production',
  }, 'Ctrl+Shift+U': {
      name: 'Universal Showcase',
      action: 'openShowcase',
      category: 'Post-Production',
  }, 'Ctrl+Shift+J': {
      name: 'Client Gallery',
      action: 'openClientGallery',
      category: 'Post-Production',
  }, 'Ctrl+Shift+F': {
      name: 'File Manager',
      action: 'openFileManager',
      category: 'Post-Production',
  },

    // Traditional shortcuts maintained for continuity
    'Ctrl+Shift+C': {
      name: 'Ny Klient',
      action: 'createClient',
      category: 'Customer Management',
  }, 'Ctrl+Shift+E': {
      name: 'Utstyr Oversikt',
      action: 'equipmentOverview',
      category: 'Equipment',
  }, 'Ctrl+Shift+F': {
      name: 'Fil Upload',
      action: 'fileUpload',
      category: 'File Management',
  }, 'Ctrl+Shift+L': {
      name: 'Lightroom Sync',
      action: 'lightroomSync',
      category: 'Integration',
  }, 'Ctrl+Shift+D': {
      name: 'Drive Backup',
      action: 'driveBackup',
      category: 'Backup',
  }, 'Ctrl+Alt+1': {
      name: 'Oversikt Dashboard',
      action: 'switchTab',
      params: { tab: 0 },
      category: 'Navigation',
  }, 'Ctrl+Alt+2': {
      name: 'Prosjekter',
      action: 'switchTab',
      params: { tab: 1 },
      category: 'Navigation',
  }, 'Ctrl+Alt+3': {
      name: 'Kontrakter',
      action: 'switchTab',
      params: { tab: 2 },
      category: 'Navigation',
  }, 'Ctrl+Alt+4': {
      name: 'Klienter',
      action: 'switchTab',
      params: { tab: 3 },
      category: 'Navigation',
  }, 'Ctrl+Alt+5': {
      name: 'Utstyr',
      action: 'switchTab',
      params: { tab: 4 },
      category: 'Navigation',
  }, 'Ctrl+Alt+6': {
      name: 'Filer',
      action: 'switchTab',
      params: { tab: 5 },
      category: 'Navigation',
  }, 'Ctrl+Alt+7': {
      name: 'Innstillinger',
      action: 'switchTab',
      params: { tab: 6 },
      category: 'Navigation',
  },
},
  videographer: {
    // PROTOCOL INTEGRATION SHORTCUTS - Core Business Workflow
    'Ctrl+Shift+P': {
      name: 'Nytt Video Prosjekt (Memory Cards, )',
      action: 'createProject',
      category: 'Project Lifecycle',
  }, 'Ctrl+Shift+Q': {
      name: 'Generer Tilbud',
      action: 'generateQuote',
      category: 'Sales & Pricing',
  }, 'Ctrl+Shift+K': {
      name: 'Ny Kontrakt',
      action: 'createContract',
      category: 'Contract System',
  }, 'Ctrl+Shift+M': {
      name: 'Planlegg Møte',
      action: 'scheduleMeeting',
      category: 'Meeting System',
  }, 'Ctrl+Shift+S': {
      name: 'Salg Pipeline',
      action: 'openSalesHub',
      category: 'Sales & Pricing',
  }, 'Ctrl+Shift+W': {
      name: 'Worklog Entry',
      action: 'openWorklog',
      category: 'Project Lifecycle',
  }, 'Ctrl+Shift+R': {
      name: 'CRM Dashboard',
      action: 'openCR',
      category: 'Customer Management',
  }, 'Ctrl+Shift+A': {
      name: 'Prisadministrasjon',
      action: 'openPricing',
      category: 'Sales & Pricing',
  },

    // POST-PRODUCTION PROTOCOL SHORTCUTS - Phase 3 Project Lifecycle
    'Ctrl+Shift+V': {
      name: 'StoryArc Studio',
      action: 'openStoryArcStudio',
      category: 'Post-Production',
  }, 'Ctrl+Shift+U': {
      name: 'Universal Showcase',
      action: 'openShowcase',
      category: 'Post-Production',
  }, 'Ctrl+Shift+J': {
      name: 'Client Gallery',
      action: 'openClientGallery',
      category: 'Post-Production',
  }, 'Ctrl+Shift+G': {
      name: 'Video Timeline',
      action: 'openVideoTimeline',
      category: 'Post-Production',
  }, 'Ctrl+Shift+F': {
      name: 'File Manager',
      action: 'openFileManager',
      category: 'Post-Production',
  },

    // Video-specific shortcuts
    'Ctrl+Shift+Y': {
      name: 'YouTube Upload',
      action: 'youtubeUpload',
      category: 'Publishing',
  }, 'Ctrl+Shift+T': {
      name: 'Timeline View',
      action: 'timelineView',
      category: 'Video Production',
  }, 'Ctrl+Shift+C': {
      name: 'Color Grading',
      action: 'colorGrading',
      category: 'Video Production',
  },
},
  musicproducer: {
    // PROTOCOL INTEGRATION SHORTCUTS - Core Business Workflow
    'Ctrl+Shift+P': {
      name: 'Nytt Musikk Prosjekt (Memory Cards, )',
      action: 'createProject',
      category: 'Project Lifecycle',
  }, 'Ctrl+Shift+Q': {
      name: 'Generer Tilbud',
      action: 'generateQuote',
      category: 'Sales & Pricing',
  }, 'Ctrl+Shift+K': {
      name: 'Ny Kontrakt',
      action: 'createContract',
      category: 'Contract System',
  }, 'Ctrl+Shift+M': {
      name: 'Planlegg Møte',
      action: 'scheduleMeeting',
      category: 'Meeting System',
  }, 'Ctrl+Shift+S': {
      name: 'Salg Pipeline',
      action: 'openSalesHub',
      category: 'Sales & Pricing',
  }, 'Ctrl+Shift+W': {
      name: 'Worklog Entry',
      action: 'openWorklog',
      category: 'Project Lifecycle',
  }, 'Ctrl+Shift+R': {
      name: 'CRM Dashboard',
      action: 'openCR',
      category: 'Customer Management',
  }, 'Ctrl+Shift+A': {
      name: 'Prisadministrasjon',
      action: 'openPricing',
      category: 'Sales & Pricing',
  },

    // Music-specific shortcuts
    'Ctrl+Shift+T': {
      name: 'Pro Tools Sync',
      action: 'proToolsSync',
      category: 'DAW Integration',
  }, 'Ctrl+Shift+L': {
      name: 'Sound Library',
      action: 'soundLibrary',
      category: 'Audio Assets',
  }, 'Ctrl+Shift+E': {
      name: 'Export Track',
      action: 'exportTrack',
      category: 'Audio Export',
  }, 'Ctrl+Shift+N': {
      name: 'Audio Analysis',
      action: 'audioAnalysis',
      category: 'Audio Analysis',
  },
    // Split Sheet Workflows
    'Ctrl+Shift+B': {
      name: 'Ny Split Sheet',
      action: 'createSplitSheet',
      category: 'Split Sheets',
  }, 'Ctrl+Shift+X': {
      name: 'Split Sheet Manager',
      action: 'openSplitSheetManager',
      category: 'Split Sheets',
  },
},
  vendor: {
    // PROTOCOL INTEGRATION SHORTCUTS - Core Business Workflow
    'Ctrl+Shift+P': {
      name: 'Nytt Vendor Prosjekt',
      action: 'createProject',
      category: 'Project Lifecycle',
  }, 'Ctrl+Shift+Q': {
      name: 'Generer Tilbud',
      action: 'generateQuote',
      category: 'Sales & Pricing',
  }, 'Ctrl+Shift+K': {
      name: 'Ny Kontrakt',
      action: 'createContract',
      category: 'Contract System',
  }, 'Ctrl+Shift+M': {
      name: 'Planlegg Møte',
      action: 'scheduleMeeting',
      category: 'Meeting System',
  }, 'Ctrl+Shift+S': {
      name: 'Salg Pipeline',
      action: 'openSalesHub',
      category: 'Sales & Pricing',
  }, 'Ctrl+Shift+W': {
      name: 'Worklog Entry',
      action: 'openWorklog',
      category: 'Project Lifecycle',
  }, 'Ctrl+Shift+R': {
      name: 'CRM Dashboard',
      action: 'openCR',
      category: 'Customer Management',
  }, 'Ctrl+Shift+A': {
      name: 'Prisadministrasjon',
      action: 'openPricing',
      category: 'Sales & Pricing',
  },

    // Vendor-specific shortcuts
    'Ctrl+Shift+O': {
      name: 'Ny Ordre',
      action: 'createOrder',
      category: 'Order Management',
  }, 'Ctrl+Shift+I': {
      name: 'Lager Oversikt',
      action: 'inventoryOverview',
      category: 'Inventory',
  }, 'Ctrl+Shift+C': {
      name: 'Kunde Service',
      action: 'customerService',
      category: 'Customer Support',
  }'Ctrl+Shift+G': {
      name: 'Rapport Generering',
      action: 'generateReport',
      category: 'Business Intelligence',
  },
},
};

// Local profession configs (fallback - will be enhanced with dynamic data from useDynamicProfessions)
const localProfessionConfigs = {
  photographer: { name: 'Fotograf', color: '#ff8c0', icon: PhotoCamera }, // Fallback - overridden by dynamic profession data
  videographer: { name: 'Videograf', color: '#e74c3', icon: Videocam }, // Fallback - overridden by dynamic profession data
  musicproducer: {
    name: 'Musikkprodusent', // Fallback - overridden by dynamic profession data
    color: '#9b59b',
    icon: LibraryMusic,
},
  vendor: { name: 'Leverandø', color: '#27ae6', icon: Store }, // Fallback - overridden by dynamic profession data
};

export default function SmartWorkflowSystem({
  profession = 'photographer',
  tabIndex = 0,
}: SmartWorkflowSystemProps) {
  // Get user and profession context
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const userProfession = user?.profession || profession || 'photographer';

  // Use dynamic profession system with fallback to local config
  const { professionConfigs: dynamicProfessionConfigs, isLoading: professionsLoading, getProfessionDisplayName, getUserProfessionColor, getProfessionIcon } = useDynamicProfessions();
  const { adaptDashboardTitle, adaptTabLabels } = useProfessionAdapter();
  
  // Enhance config with dynamic branding (auto-scalable)
  const config = React.useMemo(() => {
    const dynamicConfig = dynamicProfessionConfigs?.[userProfession];
    const localConfig = localProfessionConfigs[profession as keyof typeof localProfessionConfigs] || localProfessionConfigs.photographer;
    const baseConfig = dynamicConfig || localConfig;
    
    // Override with dynamic data if available
    const displayName = getProfessionDisplayName(userProfession);
    const professionColor = getUserProfessionColor(userProfession);
    const professionIcon = getProfessionIcon(userProfession);
    
    return {
      ...baseConfig,
      name: displayName || baseConfig.name,
      color: professionColor || baseConfig.color,
      icon: professionIcon || baseConfig.icon,
    };
  }, [userProfession, profession, dynamicProfessionConfigs, getProfessionDisplayName, getUserProfessionColor, getProfessionIcon]);
  const [activeShortcuts, setActiveShortcuts] = useState<string[]>([]);
  const [recentAction, setRecentAction] = useState<string>(', ');
  const [isActive, setIsActive] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const queryClient = useQueryClient();

  // Protocol Integration Modal State Management - ALL PROTOCOLS COORDINATED
  const [showQuoteGenerator, setShowQuoteGenerator] = useState(false);
  const [showPricingManagement, setShowPricingManagement] = useState(false);
  const [showSalesHub, setShowSalesHub] = useState(false);
  const [showContractHub, setShowContractHub] = useState(false);
  const [showProjectCreation, setShowProjectCreation] = useState(false);
  const [showWorklog, setShowWorklog] = useState(false);
  const [showCRMDashboard, setShowCRMDashboard] = useState(false);
  const [showMeetingNotes, setShowMeetingNotes] = useState(false);
  const [showSplitSheetManager, setShowSplitSheetManager] = useState(false);

  // POST-PRODUCTION PROTOCOL MODAL STATE - Phase 3 Project Lifecycle
  const [showPhotoCulling, setShowPhotoCulling] = useState(false);
  const [showPhotoEnhancement, setShowPhotoEnhancement] = useState(false);
  const [showStoryArcStudio, setShowStoryArcStudio] = useState(false);
  const [showUniversalShowcase, setShowUniversalShowcase] = useState(false);
  const [showClientGallery, setShowClientGallery] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);

  const [protocolIntegrationStatus, setProtocolIntegrationStatus] = useState({
    salesSystem: true,
    pricingSystem: true,
    contractSystem: true,
    projectLifecycle: true,
    meetingSystem: true,
    crmSystem: true,
    postProductionSystem: true, // Added Phase 3 protocols
});

  // Use hybrid config approach with dynamic config having priority
  const fallbackConfig = professionConfigs[profession] || professionConfigs['photographer'];
  const effectiveConfig = config || fallbackConfig;

  const ProfessionIcon = effectiveConfig.icon;
  const shortcuts =
    workflowShortcuts[userProfession] ||
    workflowShortcuts[profession] ||
    workflowShortcuts['photographer'];

  // Protocol-Integrated Workflow Execution - MANDATORY PROTOCOL COMPLIANCE
  const executeWorkflow = useMutation({
    mutationFn: async (action: { type: string; params?: any }) => {
      // Handle all protocol integrations locally first for immediate UI response
      switch (action.type) {
        case 'generateQuote':
          setShowQuoteGenerator(true);
          setRecentAction('Åpnet Tilbudsgenerator - integrert med PricingManagement');
          break;
        case 'openPricing':
          setShowPricingManagement(true);
          setRecentAction('Åpnet Prisadministrasjon - central pricing source');
          break;
        case 'openSalesHub':
          setShowSalesHub(true);
          setRecentAction('Åpnet Sales Pipeline - CRM integration');
          break;
        case 'createContract':
          setShowContractHub(true);
          setRecentAction('Åpnet Kontraktsystem - EU eIDAS & BRREG integration');
          break;
        case 'createProject':
          setShowProjectCreation(true);
          setRecentAction('Starter Prosjektopprettelse - Memory Cards & Google Drive');
          break;
        case 'openWorklog':
          setShowWorklog(true);
          setRecentAction('Åpnet Worklog - Project Lifecycle Tracking');
          break;
        case 'openCRM':
          setShowCRMDashboard(true);
          setRecentAction('Åpnet CRM Dashboard - Customer Journey Management');
          break;
        case 'scheduleMeeting':
          setShowMeetingNotes(true);
          setRecentAction('Åpnet Møteplanlegging - Google Meet & Calendar integration');
          break;

        // POST-PRODUCTION PROTOCOL ACTIONS - Phase 3 Project Lifecycle
        case 'openPhotoCulling':
          setShowPhotoCulling(true);
          setRecentAction('Åpnet Photo Culling System - Seamless foto sortering');
          console.log('🎨 Opening Photo Culling System for seamless culling workflow');
          break;
        case 'openPhotoEnhancement':
          setShowPhotoEnhancement(true);
          setRecentAction('Åpnet Photo Enhancement Suite - AI-powered bildebehandling');
          console.log('✨ Opening Photo Enhancement Suite for AI-powered editing');
          break;
        case 'openStoryArcStudio':
          setShowStoryArcStudio(true);
          setRecentAction('Åpnet StoryArc Studio - Comprehensive video editing');
          console.log('🎬 Opening StoryArc Studio for comprehensive video editing');
          break;
        case 'openShowcase':
          setShowUniversalShowcase(true);
          setRecentAction('Åpnet Universal Showcase - Professional client delivery');
          console.log('🏆 Opening Universal Showcase for client delivery');
          break;
        case 'openClientGallery':
          setShowClientGallery(true);
          setRecentAction('Åpnet Client Gallery - Seamless kundelevering');
          console.log('📸 Opening Client Gallery for seamless delivery');
          break;
        case 'openVideoTimeline':
          setShowStoryArcStudio(true); // Uses StoryArc Studio for video timeline
          setRecentAction('Åpnet Video Timeline via StoryArc Studio');
          console.log('⏰ Opening Video Timeline via StoryArc Studio');
          break;
        case 'openFileManager':
          setShowFileManager(true);
          setRecentAction('Åpnet Project File Manager - Phase 3 File Management');
          console.log('📁 Opening Project File Manager for post-production file handling');
          break;

        // Split Sheet Workflows (Music Producers)
        case 'createSplitSheet':
          // Send message to split-sheet-manager to create new split sheet
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('workflow:create-split-sheet', {
              detail: { profession, timestamp: Date.now() }
            }));
          }
          setRecentAction('Oppretter ny Split Sheet - automatisk workflow');
          console.log('📊 Creating new Split Sheet via workflow');
          break;
        case 'openSplitSheetManager':
          setShowSplitSheetManager(true);
          setRecentAction('Åpnet Split Sheet Manager - administrasjon og oversikt');
          console.log('📊 Opening Split Sheet Manager via workflow');
          break;

        default: // Legacy action handling via API
          return apiRequest('/api/workflow/execute', {
            method: 'POS',
            body: JSON.stringify({
              action: action.type,
              params: action.params,
              profession,
              timestamp: Date.now(),
          }),
        });
    }

      // Return successful protocol integration response
      return { success: true, action: action.type, protocols: 'integrated',};
  },
    onSuccess: (data, variables) => {
      if (!data?.protocols) {
        setRecentAction(`Utførte: ${variables.type}`);
    }
      queryClient.invalidateQueries({ queryKey: ['/api/workflow', ],});
  },
});

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const keyCombo = [];
      if (event.ctrlKey) keyCombo.push('Ctrl');
      if (event.shiftKey) keyCombo.push('Shift');
      if (event.altKey) keyCombo.push('Alt');
      keyCombo.push(event.key.toUpperCase());

      const shortcutKey = keyCombo.join('+');

      if (shortcuts[shortcutKey]) {
        event.preventDefault();
        const shortcut = shortcuts[shortcutKey];

        setActiveShortcuts((prev) => [...prev, shortcutKey]);
        setIsActive(true);

        // Execute the workflow action
        executeWorkflow.mutate({
          type: shortcut.action,
          params: shortcut.params,
      });

        // Clear active state after animation
        setTimeout(() => {
          setActiveShortcuts((prev) => prev.filter((key) => key !== shortcutKey));
          if (prev.length <= 1) setIsActive(false);
      }, 2000);
    }
  },
    [shortcuts, executeWorkflow],
  );

  // Register keyboard listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
}, [handleKeyDown]);

  // Group shortcuts by category
  const categorizedShortcuts = Object.entries(shortcuts).reduce(
    (acc, [key, shortcut]) => {
      if (!acc[shortcut.category]) acc[shortcut.category] = [];
      acc[shortcut.category].push({ key, ...shortcut });
      return acc;
  },
    {} as Record<string, any[]>,
  );

  return (
    <Box sx={{ p:  2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <ProfessionIcon sx={{ color: effectiveConfig.color, fontSize: 32}} />
        <Typography variant="h5" sx={{ fontWeight: 600, color: effectiveConfig.color }} sx={{ ...{}, color: theming.colors.primary }}>
          Smart Arbeidsflyt - {dynamicConfig ? dynamicConfig.displayName : effectiveConfig.name}
        </Typography>
        <Fade in={isActive}>
          <Chip
            icon={<FlashOn />}
            label="AKTIV"
            color="success"
            sx={{ ml: 2, fontWeight: bold'}}
          />
        </Fade>
      </Box>

      {/* Status Cards */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: isActive ? '#e8f5e8' : 'background.paper',  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Speed sx={{ color: config.color, fontSize: 32}} />
                <Box>
                  <Typography variant="h6" sx={{ color: config.color }} sx={{ ...{}, color: theming.colors.primary }}>
                    {Object.keys(shortcuts).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Snarveier Tilgjengelig
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <AutoAwesome sx={{ color: '#32cd3', fontSize: 32}} />
                <Box>
                  <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>{activeShortcuts.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Aktive Handlinger
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: recentAction ? '#f3e5f5' : 'background.paper',  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <PlayArrow sx={{ color: '#9c27b', fontSize: 32}} />
                <Box sx={{ flex:  1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500}}>
                    {recentAction || 'Venter på kommando...'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Siste Handling
                  </Typography>
                </Box>
                <IconButton onClick={() => setShowShortcuts(true)}>
                  {theming.getThemedIcon('keyboard')}
                </IconButton>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Access Shortcuts */}
      <Typography variant="h6" sx={{ mb: 2, color: config.color }} sx={{ ...{}, color: theming.colors.primary }}>
        Hurtigtaster (Aktiver med tastatur)
      </Typography>

      <Grid container spacing={2}>
        {Object.entries(categorizedShortcuts).map(([category, categoryShortcuts]) => (
          <Grid item xs={12} md={6} lg={4} key={category}>
            <Card
              sx={{
                height: '100, %',
                border: `1px solid ${config.color}30`, '&:hover': {
                  borderColor: config.color,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease',
              }}}
             sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{ color: config.color, mb:  2 }} sx={{ ...{}, color: theming.colors.primary }}>
                  {category}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                  {categoryShortcuts.slice(0, 3).map((shortcut) => (
                    <Box
                      key={shortcut.key}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p:  1,
                        bgcolor: activeShortcuts.includes(shortcut.key) ? '#e3f2fd' : 'transparent',
                        borderRadius:  1,
                        transition: 'all 0.3s ease'}}
                    >
                      <Typography variant="body2">{shortcut.name}</Typography>
                      <Chip
                        label={shortcut.key}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: '0.7rem',
                          bgcolor: activeShortcuts.includes(shortcut.key)
                            ? config.color
                            : 'transparent',
                          color: activeShortcuts.includes(shortcut.key) ? 'white' : 'inherit'}}
                      />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Shortcuts Dialog */}
      <Dialog open={showShortcuts} onClose={() => setShowShortcuts(false)} maxWidth="md" fullWidth>
        <DialogTitle>Alle Hurtigtaster - {effectiveConfig.name}</DialogTitle>
        <DialogContent>
          {Object.entries(categorizedShortcuts).map(([category, categoryShortcuts]) => (
            <Box key={category} sx={{ mb:  3 }}>
              <Typography variant="h6" sx={{ color: effectiveConfig.color, mb:  1 }} sx={{ ...{}, color: theming.colors.primary }}>
                {category}
              </Typography>
              <List dense>
                {categoryShortcuts.map((shortcut) => (
                  <ListItem key={shortcut.key}>
                    <ListItemIcon>
                      <Chip label={shortcut.key} size="small" variant="outlined" />
                    </ListItemIcon>
                    <ListItemText primary={shortcut.name} />
                  </ListItem>
                ))}
              </List>
              <Divider />
            </Box>
          ))}
        </DialogContent>
      </Dialog>

      {/* Protocol Integration Status Panel */}
      <Card sx={{ mt:  3, border: `2px solid ${effectiveConfig.color}` ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Analytics sx={{ color: effectiveConfig.color, fontSize: 32}} />
            <Typography variant="h6" sx={{ color: effectiveConfig.color, fontWeight: 600} sx={{ ...{}, color: theming.colors.primary }}>
              Smart Arbeidsflyt - Protokoll Integration Status
            </Typography>
          </Box>
          <Alert severity="success" sx={{ mb:  2 }}>
            ✅ ALLE PROTOKOLLER INTEGRERT - Sales System, Pricing Management, Contract System,
            Project Lifecycle, Meeting System, CRM System
          </Alert>
          <Grid container spacing={2}>
            {Object.entries(protocolIntegrationStatus).map(([protocol, status]) => (
              <Grid item xs={6} md={4} key={protocol}>
                <Chip
                  label={protocol}
                  color={status ? 'success' : 'error'}
                  variant="outlined"
                  sx={{ width: '100%'}}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Protocol Integration Modals - ALL SYSTEMS COORDINATED */}

      {/* Quote Generator Modal - Integrated with PricingManagement */}
      <Dialog
        open={showQuoteGenerator}
        onClose={() => setShowQuoteGenerator(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <AttachMoney sx={{ color: effectiveConfig.color }} />
            Tilbudsgenerator - Integrert med Prisadministrasjon
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense
            fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster tilbudsgenerator...</Box>}
          >
            <QuoteGeneratorModal
              profession={userProfession}
              onClose={() => setShowQuoteGenerator(false)}
            />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Pricing Management Modal */}
      <Dialog
        open={showPricingManagement}
        onClose={() => setShowPricingManagement(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Settings sx={{ color: effectiveConfig.color }} />
            Prisadministrasjon - Central Pricing Source
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense
            fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster prisadministrasjon...</Box>}
          >
            <PricingManagement profession={userProfession} />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Sales Hub Modal */}
      <Dialog open={showSalesHub} onClose={() => setShowSalesHub(false)} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Analytics sx={{ color: effectiveConfig.color }} />
            Sales Pipeline - CRM Integration
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense
            fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster sales pipeline...</Box>}
          >
            <CentralizedSalesHub profession={userProfession} />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Contract Hub Modal */}
      <Dialog
        open={showContractHub}
        onClose={() => setShowContractHub(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Gavel sx={{ color: effectiveConfig.color }} />
            Kontraktsystem - EU eIDAS & BRREG Integration
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense
            fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster kontraktsystem...</Box>}
          >
            <UniversalContractHub
              profession={userProfession as 'photographer' | 'videographer' | 'music_producer'}
              userId={user?.id}
            />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Project Creation Modal */}
      <Dialog
        open={showProjectCreation}
        onClose={() => setShowProjectCreation(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Assignment sx={{ color: effectiveConfig.color }} />
            Prosjektopprettelse - Memory Cards & Google Drive
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense
            fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster prosjektopprettelse...</Box>}
          >
            <ProjectCreationWithMemoryCards profession={userProfession} userId={user?.id} />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Worklog Modal */}
      <Dialog open={showWorklog} onClose={() => setShowWorklog(false)} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Assignment sx={{ color: effectiveConfig.color }} />
            Worklog - Project Lifecycle Tracking
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster worklog...</Box>}>
            <UniversalWorklog profession={userProfession} userId={user?.id} />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* CRM Dashboard Modal */}
      <Dialog
        open={showCRMDashboard}
        onClose={() => setShowCRMDashboard(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Group sx={{ color: effectiveConfig.color }} />
            CRM Dashboard - Customer Journey Management
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense
            fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster CRM dashboard...</Box>}
          >
            <UniversalCRMDashboard profession={userProfession} userId={user?.id} />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Meeting Notes Modal */}
      <Dialog
        open={showMeetingNotes}
        onClose={() => setShowMeetingNotes(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <VideoCall sx={{ color: effectiveConfig.color }} />
            Møteplanlegging - Google Meet & Calendar Integration
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense
            fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster møteplanlegging...</Box>}
          >
            <SmartMeetingNotesEditor profession={userProfession} userId={user?.id} />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* POST-PRODUCTION PROTOCOL MODALS - Phase 3 Project Lifecycle */}
      <Dialog
        open={showPhotoCulling}
        onClose={() => setShowPhotoCulling(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <PhotoCamera sx={{ color: effectiveConfig.color }} />
            Photo Culling System - Seamless Foto Sortering
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense
            fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster photo culling...</Box>}
          >
            <PhotoCullingSystem />
          </Suspense>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPhotoEnhancement}
        onClose={() => setShowPhotoEnhancement(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <AutoAwesome sx={{ color: effectiveConfig.color }} />
            Photo Enhancement Suite - AI-Powered Bildebehandling
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense
            fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster photo enhancement...</Box>}
          >
            <PhotoEnhancementSuite userId={user?.id || 'user'} />
          </Suspense>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showStoryArcStudio}
        onClose={() => setShowStoryArcStudio(false)}
        maxWidth="xl"
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Movie sx={{ color: effectiveConfig.color }} />
            StoryArc Studio - Comprehensive Video Editing
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense
            fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster StoryArc Studio...</Box>}
          >
            <StoryArcStudio onClose={() => setShowStoryArcStudio(false)} />
          </Suspense>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showUniversalShowcase}
        onClose={() => setShowUniversalShowcase(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Star sx={{ color: effectiveConfig.color }} />
            Universal Showcase - Professional Client Delivery
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster showcase...</Box>}>
            <UniversalShowcase />
          </Suspense>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showClientGallery}
        onClose={() => setShowClientGallery(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Collections sx={{ color: effectiveConfig.color }} />
            Client Gallery - Seamless Kundelevering
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense
            fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster client gallery...</Box>}
          >
            <UniversalShowcase adminMode={false} />
          </Suspense>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showFileManager}
        onClose={() => setShowFileManager(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Folder sx={{ color: effectiveConfig.color }} />
            Project File Manager - Phase 3 Post-Production
          </Box>
        </DialogTitle>
        <DialogContent>
          <Suspense fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster file manager...</Box>}>
            <ProjectFileManager
              projectId="current"
              profession={userProfession}
              userId={user?.id || 'user'}
            />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Split Sheet Manager Modal - Music Producers Only */}
      {userProfession === 'music_producer' && (
        <Dialog
          open={showSplitSheetManager}
          onClose={() => setShowSplitSheetManager(false)}
          maxWidth="xl"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <LibraryMusicNote sx={{ color: '#9f7aea' }} />
              Split Sheet Manager - Administrasjon og Oversikt
            </Box>
          </DialogTitle>
          <DialogContent>
            <Suspense
              fallback={<Box sx={{ p:  4, textAlign: 'center'}}>Laster split sheet manager...</Box>}
            >
              <SplitSheetManager />
            </Suspense>
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
}
