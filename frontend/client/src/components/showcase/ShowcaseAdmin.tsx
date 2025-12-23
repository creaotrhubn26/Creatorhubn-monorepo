import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { useTheming } from '../../utils/theming-helper';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import { useProfessionConfig } from '../../hooks/useProfessionConfig';
import { useDemoMode, useDemoModeData } from '@/contexts/DemoModeContext';
import RichTextEditor from '../RichTextEditor';
import 'quill/dist/quill.snow.css';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  IconButton,
  Grid,
  Switch,
  FormControlLabel,
  useTheme,
  alpha,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  Slider,
  Divider,
  Stack,
  Avatar,
  Rating,
  Fade,
  Collapse,
  Alert,
  LinearProgress,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  PhotoLibrary as PhotoLibraryIcon,
  VideoLibrary as VideoLibraryIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  ThumbUp as ThumbUpIcon,
  Comment as CommentIcon,
  Compare as CompareIcon,
  Book as BookIcon,
  YouTube as YouTubeIcon,
  ExpandMore as ExpandMoreIcon,
  Link as LinkIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  ViewCarousel as ViewCarouselIcon,
  TrendingUp as TimelineIcon,
  Collections as CollectionsIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  AutoFixHigh as AutoFixHighIcon,
  Tune as TuneIcon,
  Preview as PreviewIcon,
  PhotoFilter as PhotoFilterIcon,
  Search as SearchIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Star as FeaturedIcon,
  Archive as ArchiveIcon,
  Download as DownloadIcon,
  MonetizationOn as MonetizationOnIcon,
  Speed as SpeedIcon,
  DateRange as DateRangeIcon,
  LocationOn as LocationOnIcon,
  CameraAlt as CameraAltIcon,
  Brush as BrushIcon,
  ContentCopy as ContentCopyIcon,
  Code as CodeIcon,
  InsertEmoticon as EmojiIcon,
  FormatColorFill as ColorFillIcon,
  Gradient as GradientIcon,
  BlurOn as BlurOnIcon,

  GridView as GridViewIcon,
  ViewStream as ViewStreamIcon,
  AspectRatio as AspectRatioIcon,
  FormatSize as FormatSizeIcon,
  FontDownload as FontDownloadIcon,
  PhotoSizeSelectLarge as PhotoSizeIcon,
  Book,
  AutoFixHigh as AutoFixIcon,
  BugReport,
  Lightbulb,
  ThumbUp,
  Comment,
  Psychology,
  Visibility,
  Edit,
  CheckCircle,
  Schedule,
  Warning,
  Error as ErrorIcon,
  Person,
  Email,
  OpenInNew,
  Close,
  Star,
  CalendarToday,
  Category,
  Flag,
  Badge as BadgeIcon,
  List as ListIcon,
} from '@mui/icons-material';

// Feedback System Interfaces and Constants
interface FeedbackItem {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  profession: string;
  dashboardType: string;
  feedbackType: 'bug' | 'feature' | 'usability' | 'general' | 'ui_ux';
  title: string;
  description: string;
  rating: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  tags: string[];
  isAnonymous: boolean;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  adminNotes?: string;
  screenshotUrl?: string;
}

const feedbackTypeIcons: Record<string, any> = {
  bug: BugReport,
  feature: Lightbulb,
  usability: ThumbUp,
  ui_ux: Psychology,
  general: Comment,
};

const feedbackTypeColors: Record<string, string> = {
  bug: '#f44330',
  feature: '#ff9800',
  usability: '#4caf50',
  ui_ux: '#9c27b0',
  general: '#2196f3',
};

const priorityColors: Record<string, string> = {
  low: '#4caf50',
  medium: '#ff9800',
  high: '#f44330',
  critical: '#9c27b0',
};

const statusColors: Record<string, string> = {
  open: '#2196f0',
  in_progress: '#ff9800',
  resolved: '#4caf50',
  closed: '#757575',
};

// Admin note templates for consistent responses
const adminNoteTemplates = [
  {
    label: 'Problembeskrivelse',
    content: '<h3>Problembeskrivelse:</h3><p>[Beskriv problemet detaljert]</p><h3>Planlagt løsning:</h3><p>[Hvordan problemet skal løses]</p><h3>Estimert, tid:</h3><p>[Forventet tid for løsning]</p>'
},
  {
    label: 'Forbedring implementert', 
    content: '<h3>Forbedring implementert ✅</h3><p><strong>Dato:</strong> ' + new Date().toLocaleDateString('no-NO') + '</p><p><strong>Endringer:</strong></p><ul><li>[Endre 1]</li><li>[Endring 2]</li></ul><p><strong>Testing:</strong> [Testet og verifisert]</p>'
},
  {
    label: 'Behov for mer informasjon',
    content: '<h3>Trenger mer informasjon ℹ️</h3><p><strong>Spørsmål til, bruker:</strong></p><ol><li>[Spørsmål 1]</li><li>[Spørsmål 2]</li></ol><p><strong>Kontaktinfo:</strong> [E-post/telefon]</p>'
},
  {
    label: 'Lukket - Løst',
    content: '<h3>Tilbakemelding løst ✅</h3><p><strong>Løsningsdato:</strong> ' + new Date().toLocaleDateString('no-NO') + '</p><p><strong>Implementerte løsninger:</strong></p><p>[Detaljert beskrivelse av løsningen]</p><p><strong>Oppfølging:</strong> [Ingen ytterligere handling nødvendig]</p>'
}
];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`showcase-tabpanel-${index}`}
      aria-labelledby={`showcase-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p:  3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface ShowcaseAdminProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  userId: string;
  // Integration props for universal connectivity
  onShowcaseCreate?: (showcase: any) => void;
  onShowcaseShare?: (showcase: any, meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  // Feedback system integration props
  onFeedbackUpdate?: (feedback: any) => void;
  onNotificationCreate?: (notification: any) => void
}

export default function ShowcaseAdmin({ 
  profession, 
  userId, 
  onShowcaseCreate,
  onShowcaseShare,
  onProjectUpdate,
  selectedProject,
  onProjectSelect,
  onFeedbackUpdate,
  onNotificationCreate
}: ShowcaseAdminProps) {
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [currentTab, setCurrentTab] = useState(0);
	const { integration, communication, dataFlow, componentRegistry, features, auth } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer,');

  // Client service pricing service integration
  const { 
    formatCurrency,
    getDefaultPrice,
    isLoading: pricingLoading 
} = useClientServicePricing();
  
  // Comprehensive Feature System for Showcase Admin
  const showcaseAdminAccess = features.checkFeatureAccess('showcase-admin');
  const showcaseCreationAccess = features.checkFeatureAccess('showcase-creation');
  const showcaseManagementAccess = features.checkFeatureAccess('showcase-management');
  const portfolioManagementAccess = features.checkFeatureAccess('portfolio-management');
  const contentManagementAccess = features.checkFeatureAccess('content-management');
  const mediaUploadAccess = features.checkFeatureAccess('media-upload');
  const showcasePublishingAccess = features.checkFeatureAccess('showcase-publishing');
  const showcaseAnalyticsAccess = features.checkFeatureAccess('showcase-analytics');
  
  // Profession configuration hook
  const {
    config: professionConfig,
    isLoading: configLoading,
    terminology,
    settings,
    workflows,
    ui,
    integrations,
    enhancementPresets,
    batchOperations,
    getTerm,
    getSetting,
    getWorkflow,
    getUISetting,
    getIntegration
} = useProfessionConfig({ profession });
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [selectedShowcase, setSelectedShowcase] = useState<any>(null);
  const [previewMode, setPreviewMode] = useState(false);
  
  // FASE 3: Batch Operations and Smart Albums State
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [batchOperation, setBatchOperation] = useState<string>('');
  const [smartAlbumCriteria, setSmartAlbumCriteria] = useState({
    dateRange: { start: '', end: ',',},
    rating:  0,
    tags: [] as string[],
    location: '',
    camera: '',
    autoUpdate: true,
    name: ''
});
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [enhancementDialogOpen, setEnhancementDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('portrait');
  const [customEnhancementOptions, setCustomEnhancementOptions] = useState({
    brightness:  0,
    contrast: 1.0,
    saturation:  0,
    sharpening: 1.0,
    noiseReduction: false,
    autoTone: false
});
  const [enhancementProgress, setEnhancementProgress] = useState(0);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [smartAlbums, setSmartAlbums] = useState<any[]>([]);

  // Feedback System State
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    componentRegistry.registerComponent({
      id: `showcase-admin-${profession}-${userId}`,
      name: 'Showcase Admin',
      type: 'admin',
      category: 'showcase',
      profession: profession,
      capabilities: [
        'showcases','templates','collections','batch-operations','smart-albums','feedback-management','showcase:created','showcase:updated','showcase:deleted','batch:operation-completed','feedback:updated','create-showcase','update-showcase','delete-showcase','manage-feedback','admin-dashboard','showcase-grid','template-config','batch-controls','feedback-panel','showcase-management','template-system','batch-processing','feedback-tracking',
      ],
      dependencies: [
        'showcase-drive-manager','showcase-template-selector','image-crop-editor',
      ],
      props: ['profession','userId','user'],
      events: [
        'showcase:created','showcase:updated','showcase:deleted','batch:operation-completed','feedback:updated',
      ],
      dataKeys: [
        `showcases-${profession}-${userId}`,
        `templates-${profession}`,
        `collections-${profession}-${userId}`,
        `feedback-${profession}-${userId}`,
      ],
      version: '1.0.0',
      description: `Showcase administration for ${profession} professionals`
  });

    // Track feature usage
    features.trackFeatureUsage('showcase-admin, ','opened', {
      timestamp: Date.now(),
      component: 'ShowcaseAdmin',
      profession: profession,
      userId: userId,
      currentTab: currentTab,
    });

    // Register data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: `showcase-admin-${profession}-${userId}`,
      dataKey: 'showcases',
      transform: (data: any) => data?.showcases || []
});

    dataFlow.registerNode({
      type: 'source',
      componentId: `showcase-admin-${profession}-${userId}`,
      dataKey: 'templates',
      transform: (data: any) => data?.templates || []
});

    dataFlow.registerNode({
      type: 'source',
      componentId: `showcase-admin-${profession}-${userId}`,
      dataKey: 'collections',
      transform: (data: any) => data?.collections || []
});

    dataFlow.registerNode({
      type: 'source',
      componentId: `showcase-admin-${profession}-${userId}`,
      dataKey: 'batchOperations',
      transform: (data: any) => data?.batchOperations || []
});

    dataFlow.registerNode({
      type: 'source',
      componentId: `showcase-admin-${profession}-${userId}`,
      dataKey: 'smartAlbums',
      transform: (data: any) => data?.smartAlbums || []
});

    dataFlow.registerNode({
      type: 'source',
      componentId: `showcase-admin-${profession}-${userId}`,
      dataKey: 'feedback',
      transform: (data: any) => data?.feedback || []
});

    // Subscribe to events
    communication.onMessageType('showcase: refresh-all', (data: any) => {
      if (data.profession === profession && data.userId === userId) {
        queryClient.invalidateQueries({ queryKey: ['/api/showcase'] });
    }
  });
    
    communication.onMessageType('showcase: template-selected', (data: any) => {
      if (data.profession === profession) {
        console.log('Template selected for profession, :', profession, data.template);
    }
  });
    
    communication.onMessageType('showcase: mapping-created', (data: any) => {
      if (data.profession === profession && data.userId === userId) {
        queryClient.invalidateQueries({ queryKey: ['/api/showcase'] });
    }
  });

    // Feedback system communication subscriptions
    const feedbackRefreshUnsubscribe = communication.onMessageType('feedback: refresh-all', (data: any) => {
      if (data.profession === profession && data.userId === userId) {
        queryClient.invalidateQueries({ queryKey: ['/api/prototype-testing/feedback', ],});
    }
  });

    const feedbackUpdateUnsubscribe = communication.onMessageType('feedback: updated', (data: any) => {
      if (data.profession === profession && data.userId === userId) {
        queryClient.invalidateQueries({ queryKey: ['/api/prototype-testing/feedback', ],});
    }
  });

    return () => {
      componentRegistry.unregisterComponent(`showcase-admin-${profession}-${userId}`);
      feedbackRefreshUnsubscribe();
      feedbackUpdateUnsubscribe();
  };
}, [componentRegistry, dataFlow, communication, profession, userId, queryClient]);

  // Professional terminology from configuration
  const terms = terminology;

  // FASE 3: Batch Operations Functions
  const handleSelectItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
};

  const handleSelectAll = (items: any[]) => {
    const allIds = items.map(item => item.id);
    setSelectedItems(prev => 
      prev.length === allIds.length ? [] : allIds
    );
};

	const executeBatchOperation = async (operation: string) => {
		if (selectedItems.length === 0) return;

		// Check if operation is allowed for this profession
		const allowedOperations = getSetting('batchOperations')?.availableOperations || [];
		if (!allowedOperations.includes(operation)) {
			console.warn(`Operation ${operation} not allowed for profession ${profession}`);
			return;
		}

		try {
			const authHeaders = await auth.getAuthHeader();
			const response = await fetch('/api/showcase/batch-operations', {
				method: 'POST',
				headers: {
					...authHeaders, 'Content-Type' : 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					operation,
					itemIds: selectedItems,
					profession,
					userId,
				}),
			});

			if (response.ok) {
				console.log(`✅ Batch operation ${operation} completed for ${selectedItems.length} items`);
				setSelectedItems([]);
				setBatchOperation('');
				queryClient.invalidateQueries({ queryKey: ['/api/showcase'] });

				// Broadcast batch operation completed event
				communication.sendBroadcast('batch: operation-completed', {
					operation,
					itemCount: selectedItems.length,
					profession,
					userId,
					timestamp: Date.now(),
				});
			}
		} catch (error) {
			console.error('❌ Batch operation failed:', error);
		}
	};

  // FASE 3: Bulk Photo Enhancement Functions
	const bulkEnhanceMutation = useMutation({
		mutationFn: async (enhancementOptions: any) => {
			setIsEnhancing(true);
			setEnhancementProgress(0);

			const authHeaders = await auth.getAuthHeader();
			const response = await fetch('/api/showcase/batch-operations', {
				method: 'POST',
				headers: {
					...authHeaders, 'Content-Type' : 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					operation: 'bulk-photo-enhance',
					itemIds: selectedItems,
					enhancementOptions,
					profession,
					userId,
				}),
			});

			if (!response.ok) {
				throw new Error('Enhancement failed');
			}

			return response.json();
		},
		onSuccess: (data) => {
			console.log(`🎨 Bulk enhancement completed: ${data.enhancedCount}/${data.totalItems} images enhanced`);
			setIsEnhancing(false);
			setEnhancementProgress(100);
			setEnhancementDialogOpen(false);
			queryClient.invalidateQueries({ queryKey: ['/api/showcase'] });
			setSelectedItems([]);
			setBulkEditMode(false);
		},
		onError: (error) => {
			console.error('❌ Bulk enhancement failed:', error);
			setIsEnhancing(false);
			setEnhancementProgress(0);
		},
	});

  const handleBulkPhotoEnhancement = () => {
    if (selectedItems.length === 0) return;
    setEnhancementDialogOpen(true);
};

  const executeEnhancement = () => {
    const preset = mergedEnhancementPresets?.[selectedPreset];
    const enhancementOptions = selectedPreset === 'custom' 
      ? customEnhancementOptions 
      : preset?.settings;
    
    if (enhancementOptions) {
      bulkEnhanceMutation.mutate(enhancementOptions);
  }
};

	// FASE 3: Smart Album Functions
	const createSmartAlbum = async () => {
		try {
		const authHeaders = await auth.getAuthHeader();
		const response = await fetch('/api/showcase/smart-albums', {
			method: 'POST',
			headers: {
				...authHeaders,
				'Content-Type': 'application/json',
			},
			credentials: 'include',
				body: JSON.stringify({
					...smartAlbumCriteria,
					profession,
					userId,
				}),
			});

			if (response.ok) {
				const newAlbum = await response.json();
				setSmartAlbums(prev => [...prev, newAlbum]);
				setOpenDialog(null);
				console.log('✅ Smart album created: ', newAlbum.name);

				// Broadcast smart album created event
				communication.sendBroadcast('showcase: smart-album-created', {
					album: newAlbum,
					profession,
					userId,
					timestamp: Date.now(),
				});
			}
		} catch (error) {
			console.error('❌ Smart album creation failed:', error);
		}
	};

	const updateSmartAlbum = async (albumId: string) => {
		try {
		const authHeaders = await auth.getAuthHeader();
		const response = await fetch(`/api/showcase/smart-albums/${albumId}/update`, {
			method: 'POST',
			headers: {
				...authHeaders,
				'Content-Type': 'application/json',
			},
			credentials: 'include',
				body: JSON.stringify({ userId, profession }),
			});

			if (response.ok) {
				console.log('✅ Smart album updated automatically');
				queryClient.invalidateQueries({ queryKey: ['/api/showcase'] });
			}
		} catch (error) {
			console.error('❌ Smart album update failed:', error);
		}
	};

  // Layout style options
  const layoutStyles = [
    { value: 'grid', label: 'Rutenett', icon: <GridViewIcon />,},
    { value: 'masonry', label: 'Masonry', icon: <ViewStreamIcon />,},
    { value: 'carousel', label: 'Karusell', icon: <ViewCarouselIcon />,},
    { value: 'timeline', label: 'Tidslinje', icon: <TimelineIcon />,},
    { value: 'portfolio', label: 'Portefølje', icon: <Book />,},
    { value: 'magazine', label: 'Magasin', icon: <ViewListIcon />,},
    { value: 'split_screen', label: 'Delt skjerm', icon: <AspectRatioIcon />,},
  ];

  // Color schemes
  const colorSchemes = [
    { value: 'light', label: 'Lys', preview: '#ffffff',},
    { value: 'dark', label: 'Mørk', preview: '#121212',},
    { value: 'auto', label: 'Automatisk', preview: 'linear-gradient(45deg, #ffffff 50%, #121212 50%)' },
    { value: 'custom', label: 'Tilpasset', preview: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)' }
  ];

  // Template creation state
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    profession: profession,
    layoutConfig: {
      style: 'grid',
      columns: 3,
      aspectRatio: '16:9',
      spacing: 16,
      animations: true,
      autoplay: false,
      navigation: true,
    },
    designSettings: {
      colorScheme: 'light',
      typography: {
        fontFamily: 'Roboto',
        fontSize: 'medium',
        fontWeight: 'normal'
  },
      borderRadius:  8,
      shadows: true,
      gradients: false,
      glassmorphism: false
}
});

  // Showcase creation state  
  const [showcaseForm, setShowcaseForm] = useState({
    title: '',
    description: '',
    subtitle: ', ',
    category: ', ',
    tags:  [],
    mediaConfig: {
      primaryMedia: {
        type: 'image',
        url: ', ',
        aspectRatio: '16:9'
  }
  },
    displayConfig: {
      template:', ',
      showMetadata: true,
      showStats: false,
      showSocial: true,
      showTestimonials: true,
      showBehindScenes: false,
      showEquipmentUsed: false,
      showLocationInfo: false,
      showClientInfo: false,
      allowDownloads: false,
      enableComments: true,
      enableLikes: true,
      enableSharing: true
},
    clientInfo: {
      name:', ',
      testimonial: ', ',
      rating:  5,
      showPublicly: true
},
    isPublic: true,
    isFeatured: false,
    status: 'draft'
});

	// Fetch templates
	const { data: templates, isLoading: templatesLoading } = useQuery({
		queryKey: ['/api/showcase/templates', profession],
		queryFn: async () => {
			return apiRequest(`/api/showcase/templates?profession=${profession}`);
		},
		enabled: true,
	});

	// Fetch showcases
	const { data: showcases, isLoading: showcasesLoading } = useQuery({
		queryKey: ['/api/showcase/showcases', profession, userId],
		queryFn: async () => {
			return apiRequest(`/api/showcase/showcases?profession=${profession}&userId=${userId}`);
		},
		enabled: true,
	});

  // Fetch enhancement presets and merge with profession configuration
	const { data: presetsData } = useQuery({
		queryKey: ['/api/showcase/enhancement-presets', profession],
		queryFn: async () => {
			const apiPresets = await apiRequest('/api/showcase/enhancement-presets');
			// Merge API presets with profession-specific presets
			return { ...enhancementPresets, ...apiPresets };
		},
	});

  // Use merged enhancement presets from profession config and API
  const mergedEnhancementPresets = presetsData || enhancementPresets;

	// Fetch collections
	const { data: collections, isLoading: collectionsLoading } = useQuery({
		queryKey: ['/api/showcase/collections', profession, userId],
		queryFn: async () => {
			return apiRequest(`/api/showcase/collections?profession=${profession}&userId=${userId}`);
		},
		enabled: true,
	});

  // Category options based on profession
  const getCategoryOptions = () => {
    switch (profession) {
      case 'photographer':
        return ['Bryllup','Portrett','Kommersielt','Natur','Arkitektur','Mote','Familie'];
      case 'videographer':
        return ['Bryllupsvideo','Reklamefilm','Dokumentar','Musikkvideo','Bedriftsvideo','Event'];
      case 'music_producer':
        return ['Pop','Rock','Electronic','Hip-Hop','Jazz','Classical','Folk'];
      case 'vendor':
        return ['Foto','Video','Lyd','Belysning','Tilbehør','Software','Tjenester'];
      default: return [];
}
};

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
};

  const handleViewDriveAnalytics = () => {
    console.log('View Drive Analytics clicked');
    // Implementation for Drive Analytics viewing
};

  const SpeedDialActions = [
    { icon: <AddIcon />, name: 'Ny showcase', action: () => setOpenDialog('new-showcase', ),},
    { icon: <CollectionsIcon />, name: 'Ny samling', action: () => setOpenDialog('new-collection', ),},
    { icon: <PaletteIcon />, name: 'Ny mal', action: () => setOpenDialog('new-template', ),},
    { icon: <SettingsIcon />, name: 'Innstillinger', action: () => setOpenDialog('settings', ),},
  ];

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column'}}>
      {/* Header with tabs */}
      <Paper sx={{ 
        mb: 2, background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
        color: 'white'
  ,  ...theming.getThemedCardSx() }}>
        <Box sx={{ p:  3, pb:  0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  2 }}>
            <Box>
              <Typography variant="h4" sx={{  fontWeight: 'bold', mb:  1  }}>
                {terms.showcase} Administrasjon
              </Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9}}>
                Full kontroll over dine {terms.showcase.toLowerCase()} med mange visningsalternativer
              </Typography>
              
              {/* Feature Analytics Display */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1, mt: 2 }}>
                <Typography variant="caption" sx={{ opacity: 0.8}}>
                  Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
                </Typography>
                <Chip 
                  label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    fontSize: '10px', 
                    height:  18,
                    color: 'white',
                    borderColor: 'rgba(25,255,255,0.3)'
                }}
                />
              </Box>
            </Box>
            
            {/* Gallery Access Button */}
            <Button
              variant="contained"
              startIcon={<PreviewIcon />}
              onClick={() => {
                // Open showcase gallery in new window
                window.open('/showcase-gallery','_blank');
              }}
              sx={{
                bgcolor: 'rgba(25, 255, 255, 0.15)',
                color: 'white',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(25, 255, 255, 0.2)',
                fontWeight: 600,
                px: 3,
                py: 1,
                borderRadius: 2,
                textTransform: 'none',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)', '&:hover': {
                  bgcolor: 'rgba(25, 255, 255, 0.25)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 24px rgba(0, 0, 0, 0.4)',
                }, '&:active': {
                  transform: 'translateY(0)',
                },
                transition: 'all 0.2s ease'}}
            >
              Se Publiserte Gallerier
            </Button>
          </Box>
          
	          <Tabs 
	            value={currentTab}
	            onChange={handleTabChange}
	            sx={{
	              '& .MuiTab-root': { 
	                color: 'rgba(25,255,255,0.7)','&.Mui-selected': { color: 'white' },
	              }, '& .MuiTabs-indicator': { backgroundColor: 'white' }}}
	          >
            <Tab icon={<CollectionsIcon />} label="Alle Showcases" />
            <Tab icon={<PaletteIcon />} label="Maler & Design" />
            <Tab icon={<ViewModuleIcon />} label="Samlinger" />
            <Tab icon={<SpeedIcon />} label="Batch Operasjoner" />
            <Tab icon={<AutoFixIcon />} label="Smart Albums" />
            <Tab icon={<AnalyticsIcon />} label="Statistikk" />
            <Tab icon={<SettingsIcon />} label="Innstillinger" />
          </Tabs>
        </Box>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto'}}>
        {/* All Showcases Tab */}
        <TabPanel value={currentTab} index={0}>
          <Grid container spacing={3}>
            {/* Filters and Controls */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <TextField
                    placeholder="Søk i showcases..."
                    size="small"
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: 'grey.500'}} />
                  }}
                    sx={{ minWidth: 250}}
                  />
                  
                  <FormControl size="small" sx={{ minWidth: 150}}>
                    <InputLabel>Kategori</InputLabel>
                    <Select label="Kategori" value="" defaultValue="">
                      <MenuItem value="">Alle</MenuItem>
                      {getCategoryOptions().map(category => (
                        <MenuItem key={category} value={category}>{category}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 120}}>
                    <InputLabel>Status</InputLabel>
                    <Select label="Status" value="" defaultValue="">
                      <MenuItem value="">Alle</MenuItem>
                      <MenuItem value="draft">Utkast</MenuItem>
                      <MenuItem value="published">Publisert</MenuItem>
                      <MenuItem value="archived">Arkivert</MenuItem>
                    </Select>
                  </FormControl>

                  <ToggleButtonGroup size="small" exclusive>
                    <ToggleButton value="grid"><GridViewIcon /></ToggleButton>
                    <ToggleButton value="list"><ViewListIcon /></ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              </Paper>
            </Grid>

            {/* Showcase Grid */}
            {!showcasesLoading && (
              <>
                {/* New Showcase Card */}
                <Grid item xs={12}>
                  <Card 
                    sx={{ 
                      height: 30, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      border: `2px dashed ${theme.palette.primary.main}`,
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      cursor: 'pointer',
                      transition: 'all 0.3s ease','&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        transform: 'translateY(-4px)'
                  }
                  }}
                    onClick={() => setOpenDialog('new-showcase')}
                  >
                    <Box textAlign="center">
                      <AddIcon sx={{ fontSize:  48, color: 'primary.main', mb:  2 }} />
                      <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                        Lag ny {terms.showcase.toLowerCase()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Vis frem ditt beste arbeid
                      </Typography>
                    </Box>
                  </Card>
                </Grid>

                {/* Real Showcases from PostgreSQL - NO MOCK DATA */}
	                {showcases && showcases.length > 0 ? (
	                  showcases.map((showcase: any) => (
	                    <Grid item xs={12} key={showcase.id}>
	                      <Card sx={{ height: 30, position: 'relative',  ...theming.getThemedCardSx() }}>
	                        <CardMedia
	                          component="img"
	                          height="180"
	                          image={showcase.images?.[0]?.url || '/placeholder-showcase.jpg'}
	                          alt={showcase.title}
	                          sx={theming.getThemedCardSx()}
	                        />
	                        <CardContent sx={theming.getThemedCardSx()}>
                          <Typography variant="h6" noWrap sx={{ color: theming.colors.primary }}>
                            {showcase.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {showcase.description}
                          </Typography>
                          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                            {showcase.tags?.map((tag: string) => (
                              <Chip key={tag} size="small" label={tag} />
                            ))}
                            {showcase.isFeatured && <StarIcon sx={{ color: 'warning.main', fontSize: 16}} />}
	                          </Box>
	                        </CardContent>
	                        <CardActions sx={{ position: 'absolute', top:  8, right:  8 ,  ...theming.getThemedCardSx() }}>
	                          <IconButton
	                            size="small"
	                            sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
	                          >
	                            <EditIcon fontSize="small" />
	                          </IconButton>
	                          <IconButton
	                            size="small"
	                            sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
	                          >
	                            <VisibilityIcon fontSize="small" />
	                          </IconButton>
	                        </CardActions>
	                      </Card>
                    </Grid>
                  ))
                ) : (
	                  <Grid item xs={12}>
	                    <Paper 
	                      sx={{ 
	                        p: 6, 
	                        textAlign: 'center',
	                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
	                        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
	                        ...theming.getThemedCardSx()}}
	                    >
                      <PhotoLibraryIcon sx={{ fontSize:  64, color: 'text.secondary', mb:  2 }} />
                      <Typography variant="h6" gutterBottom color="text.secondary" sx={{ color: theming.colors.primary }}>
                        Ingen {terms.showcase.toLowerCase()}s ennå
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Lag din første {terms.showcase.toLowerCase()} for å vise frem ditt arbeid
                      </Typography>
                      <Button variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpenDialog('new-showcase')}
                        sx={{
                          background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                          boxShadow: '0 8px 20px blur\(\s*([0-9]+px)\s*,\s*\), 0,0,0,0.2)'
                      }}
                      >
                        Lag ny {terms.showcase.toLowerCase()}
                      </Button>
                    </Paper>
                  </Grid>
                )}
              </>
            )}
          </Grid>
        </TabPanel>

        {/* Templates & Design Tab */}
        <TabPanel value={currentTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Design-maler for {profession}
                </Typography>
                
                <Box sx={{ mb:  3 }}>
                  <Typography variant="subtitle2" gutterBottom>Layout-stil</Typography>
                  <Grid container spacing={1}>
                    {layoutStyles.map(style => (
                      <Grid item xs={12} key={style.value}>
                        <Card 
                          sx={{ 
                            p: 2, textAlign: 'center', 
                            cursor: 'pointer',
                            border: templateForm.layoutConfig.style === style.value ? 
                              `2px solid ${theme.palette.primary.main}` : '1px solid transparent'
                        }}
                          onClick={() => setTemplateForm(prev => ({
                            ...prev,
                            layoutConfig: { ...prev.layoutConfig, style: style.value as any }
                        }))}
                        >
                          {style.icon}
                          <Typography variant="caption" display="block" sx={{ mt:  1 }}>
                            {style.label}
                          </Typography>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                <Box sx={{ mb:  3 }}>
                  <Typography variant="subtitle2" gutterBottom>Kolonner</Typography>
                  <Slider
                    value={templateForm.layoutConfig.columns}
                    onChange={(_, value) => setTemplateForm(prev => ({
                      ...prev,
                      layoutConfig: { ...prev.layoutConfig, columns: value as number }
                  }))}
                    min={1}
                    max={6}
                    marks
                    valueLabelDisplay="on"
                  />
                </Box>

                <Box sx={{ mb:  3 }}>
                  <Typography variant="subtitle2" gutterBottom>Mellomrom</Typography>
                  <Slider
                    value={templateForm.layoutConfig.spacing}
                    onChange={(_, value) => setTemplateForm(prev => ({
                      ...prev,
                      layoutConfig: { ...prev.layoutConfig, spacing: value as number }
                  }))}
                    min={0}
                    max={32}
                    valueLabelDisplay="on"
                  />
                </Box>

                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={templateForm.layoutConfig.animations}
                        onChange={(e) => setTemplateForm(prev => ({
                          ...prev,
                          layoutConfig: { ...prev.layoutConfig, animations: e.target.checked }
                      }))}
                      />
                  }
                    label="Animasjoner"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={templateForm.layoutConfig.navigation}
                        onChange={(e) => setTemplateForm(prev => ({
                          ...prev,
                          layoutConfig: { ...prev.layoutConfig, navigation: e.target.checked }
                      }))}
                      />
                  }
                    label="Navigasjon"
                  />
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Farger og typografi
                </Typography>

                <Box sx={{ mb:  3 }}>
                  <Typography variant="subtitle2" gutterBottom>Fargeskjema</Typography>
                  <Grid container spacing={1}>
                    {colorSchemes.map(scheme => (
                      <Grid item xs={12} key={scheme.value}>
                        <Card 
                          sx={{ 
                            p: 2, cursor: 'pointer',
                            border: templateForm.designSettings.colorScheme === scheme.value ? 
                              `2px solid ${theme.palette.primary.main}` : '1px solid transparent'
                        }}
                          onClick={() => setTemplateForm(prev => ({
                            ...prev,
                            designSettings: { ...prev.designSettings, colorScheme: scheme.value as any }
                        }))}
                        >
	                          <Box 
	                            sx={{ 
	                              height: 40, 
	                              borderRadius: 1,
	                              background: scheme.preview,
	                              mb: 1}}
                          />
                          <Typography variant="caption" textAlign="center" display="block">
                            {scheme.label}
                          </Typography>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                <Box sx={{ mb:  3 }}>
                  <Typography variant="subtitle2" gutterBottom>Skriftstørrelse</Typography>
                  <ToggleButtonGroup
                    value={templateForm.designSettings.typography.fontSize}
                    exclusive
                    onChange={(_, value) => {
                      if (value) {
                        setTemplateForm(prev => ({
                          ...prev,
                          designSettings: {
                            ...prev.designSettings,
                            typography: { ...prev.designSettings.typography, fontSize: value }
                        }
                      }));
                    }
                  }}
                  >
                    <ToggleButton value="small">Liten</ToggleButton>
                    <ToggleButton value="medium">Medium</ToggleButton>
                    <ToggleButton value="large">Stor</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Box sx={{ mb:  3 }}>
                  <Typography variant="subtitle2" gutterBottom>Hjørneradius</Typography>
                  <Slider
                    value={templateForm.designSettings.borderRadius}
                    onChange={(_, value) => setTemplateForm(prev => ({
                      ...prev,
                      designSettings: { ...prev.designSettings, borderRadius: value as number }
                  }))}
                    min={0}
                    max={24}
                    valueLabelDisplay="on"
                  />
                </Box>

                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={templateForm.designSettings.shadows}
                        onChange={(e) => setTemplateForm(prev => ({
                          ...prev,
                          designSettings: { ...prev.designSettings, shadows: e.target.checked }
                      }))}
                      />
                  }
                    label="Skygger"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={templateForm.designSettings.gradients}
                        onChange={(e) => setTemplateForm(prev => ({
                          ...prev,
                          designSettings: { ...prev.designSettings, gradients: e.target.checked }
                      }))}
                      />
                  }
                    label="Gradienter"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={templateForm.designSettings.glassmorphism}
                        onChange={(e) => setTemplateForm(prev => ({
                          ...prev,
                          designSettings: { ...prev.designSettings, glassmorphism: e.target.checked }
                      }))}
                      />
                  }
                    label="Glassmorfisme"
                  />
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Batch Operations Tab - FASE 3 */}
        <TabPanel value={currentTab} index={3}>
          <Typography variant="h5" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            <SpeedIcon color="primary" />
            Batch Operasjoner - Effektiv håndtering av flere {terms.media.toLowerCase()}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Utfør operasjoner på flere bilder/videoer samtidig for økt produktivitet
          </Typography>

          <Grid container spacing={3}>
            {/* Selection Controls */}
            <Grid item xs={12}>
              <Paper sx={{ p:  3, mb:  3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.1)})` ,  ...theming.getThemedCardSx() }}>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>Valgte elementer: </Typography>
                    <Chip 
                      label={`${selectedItems.length} valgt`}
                      color={selectedItems.length > 0 ? "primary" : "default"}
                      size="small"
                    />
                  </Box>
                  
                  <Stack direction="row" spacing={1}>
                    <Button 
                      size="small" 
                      onClick={() => setSelectedItems([])}
                      disabled={selectedItems.length === 0}
                    >
                      Fjern valg
                    </Button>
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => setBulkEditMode(!bulkEditMode)}
                    >
                      {bulkEditMode ? 'Avslutt' : 'Start'} massevalg
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>

            {/* Batch Operation Controls */}
            <Grid item xs={12}>
              <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                  <TuneIcon />
                  Velg operasjon
                </Typography>
                
                <FormControl fullWidth sx={{ mb:  3 }}>
                  <InputLabel>Batch operasjon</InputLabel>
                  <Select
                    value={batchOperation}
                    label="Batch operasjon"
                    onChange={(e) => setBatchOperation(e.target.value)}
                  >
                    <MenuItem value=""><em>Velg operasjon</em></MenuItem>
                    <MenuItem value="publish">📢 Publiser alle</MenuItem>
                    <MenuItem value="unpublish">🔒 Avpubliser alle</MenuItem>
                    <MenuItem value="archive">📦 Arkiver alle</MenuItem>
                    <MenuItem value="delete">🗑️ Slett alle</MenuItem>
                    <MenuItem value="add-watermark">🏷️ Legg til vannmerke</MenuItem>
                    <MenuItem value="bulk-photo-enhance">🎨 Forbedre bilder (CreatorHub AI)</MenuItem>
                    <MenuItem value="resize">📏 Endre størrelse</MenuItem>
                    <MenuItem value="compress">🗜️ Komprimer</MenuItem>
                    <MenuItem value="add-tags">🏷️ Legg til tags</MenuItem>
                    <MenuItem value="change-category">📁 Endre kategori</MenuItem>
                    <MenuItem value="export">📤 Eksporter</MenuItem>
                  </Select>
                </FormControl>

                {batchOperation === 'bulk-photo-enhance' ? (
                  <Button variant="contained"
                    fullWidth
                    size="large"
                    disabled={selectedItems.length === 0}
                    onClick={handleBulkPhotoEnhancement}
                    sx={{
                      py: 1.5,
                      background: `linear-gradient(135deg, #FF6B35, #F7931E)`,
                      boxShadow: '0 4px 15px rgba(25,107,53,0.3)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(25,107,53,0.4)',
                      },
                      ...theming.getThemedButtonSx()
                    }}>
                    🎨 Forbedre {selectedItems.length} bilder med AI
                  </Button>
                ) : (
                  <Button variant="contained"
                    fullWidth
                    size="large"
                    disabled={!batchOperation || selectedItems.length === 0}
                    onClick={() => executeBatchOperation(batchOperation)}
                    sx={{
                      py: 1.5,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                      boxShadow: '0 4px 15px blur\(\s*([0-9]+px)\s*,\s*\), 0,0,0,0.2)','&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px blur\(\s*([0-9]+px)\s*,\s*\), 0,0,0,0.3)',
                    }
                  }}
                  >
                    Utfør operasjon på {selectedItems.length} elementer
                  </Button>
                )}
              </Paper>
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12}>
              <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                  <SpeedIcon />
                  Hurtighandlinger
                </Typography>
                
                <Stack spacing={1}>
                  {[
                    { action: 'select-all-featured', label: '⭐ Velg alle utvalgte', icon: <StarIcon />,},
                    { action: 'select-all-recent', label: '🕒 Velg alle fra siste uke', icon: <DateRangeIcon />,},
                    { action: 'select-by-rating', label: '⭐ Velg etter vurdering (4+ stjerner, )', icon: <StarIcon />,},
                    { action: 'select-unpublished', label: '📝 Velg alle utkast', icon: <EditIcon />,}
                  ].map((quickAction) => (
                    <Button
                      key={quickAction.action}
                      variant="outlined"
                      fullWidth
                      startIcon={quickAction.icon}
                      onClick={() => {
                        // Quick selection logic here
                        console.log(`Quick action: ${quickAction.action}`);
                    }}
                      sx={{ justifyContent: 'flex-start', textTransform: 'none'}}
                    >
                      {quickAction.label}
                    </Button>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            {/* Batch Progress Indicator */}
            {selectedItems.length > 0 && (
              <Grid item xs={12}>
                <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Forhåndsvisning av valgte elementer
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {selectedItems.slice(0, 6).map((itemId, index) => (
	                      <Grid item xs={12} key={itemId}>
	                        <Card sx={{ position: 'relative',  ...theming.getThemedCardSx() }}>
	                          <CardMedia
	                            component="img"
	                            height="100"
	                            image={`/api/placeholder/image/${index + 1}`}
	                            alt={`Selected item ${index + 1}`}
	                            sx={theming.getThemedCardSx()}
	                          />
	                          <IconButton
                            size="small"
                            sx={{ position: 'absolute', top:  4, right:  4, bgcolor: 'rgba(25,255,255,0.8)' }}
                            onClick={() => handleSelectItem(itemId)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Card>
                      </Grid>
                    ))}
                    {selectedItems.length > 6 && (
                      <Grid item xs={12}>
                        <Card sx={{ height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',  ...theming.getThemedCardSx() }}>
                          <Typography variant="body2" color="text.secondary">
                            +{selectedItems.length - 6} flere
                          </Typography>
                        </Card>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Smart Albums Tab - FASE 3 */}
        <TabPanel value={currentTab} index={4}>
          <Typography variant="h5" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            <AutoFixIcon color="primary" />
            Smart Albums - Automatisk organisering
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Opprett intelligente album som automatisk oppdateres basert på kriterier du setter
          </Typography>

          <Grid container spacing={3}>
            {/* Create Smart Album */}
            <Grid item xs={12}>
              <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                  <AddIcon />
                  Opprett nytt smart album
                </Typography>
                
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Album navn"
                    value={smartAlbumCriteria.name}
                    onChange={(e) => setSmartAlbumCriteria(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={`Mine beste ${terms.media.toLowerCase()}`}
                  />

                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Minimum vurdering</Typography>
                    <Rating
                      value={smartAlbumCriteria.rating}
                      onChange={(_, value) => setSmartAlbumCriteria(prev => ({ ...prev, rating: value || 0 }))}
                      size="large"
                    />
                  </Box>

                  <TextField
                    fullWidth
                    label="Lokasjon"
                    value={smartAlbumCriteria.location}
                    onChange={(e) => setSmartAlbumCriteria(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Oslo, Bergen, Trondheim..."
                  />

                  <TextField
                    fullWidth
                    label="Kamera/utstyr"
                    value={smartAlbumCriteria.camera}
                    onChange={(e) => setSmartAlbumCriteria(prev => ({ ...prev, camera: e.target.value }))}
                    placeholder="Canon EOS R5, Sony A7IV..."
                  />

                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Datoområde</Typography>
                    <Stack direction="row" spacing={2}>
                      <TextField
                        type="date"
                        label="Fra dato"
                        value={smartAlbumCriteria.dateRange.start}
                        onChange={(e) => setSmartAlbumCriteria(prev => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, start: e.target.value }
                      }))}
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        type="date"
                        label="Til dato"
                        value={smartAlbumCriteria.dateRange.end}
                        onChange={(e) => setSmartAlbumCriteria(prev => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, end: e.target.value }
                      }))}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Stack>
                  </Box>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={smartAlbumCriteria.autoUpdate}
                        onChange={(e) => setSmartAlbumCriteria(prev => ({ ...prev, autoUpdate: e.target.checked }))}
                      />
                  }
                    label="Automatisk oppdatering"
                  />

                  <Button variant="contained"
                    fullWidth
                    size="large"
                    onClick={createSmartAlbum}
                    disabled={!smartAlbumCriteria.name}
                    sx={{
                      py: 1.5,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                      },
                      ...theming.getThemedButtonSx()
                    }}>
                    Opprett Smart Album
                  </Button>
                </Stack>
              </Paper>
            </Grid>

            {/* Smart Album Templates */}
            <Grid item xs={12}>
              <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                  <PaletteIcon />
                  Smarte album-maler
                </Typography>
                
                <Stack spacing={2}>
                  {[
                    { name: 'Årets beste', criteria: '⭐ 4+ stjerner + siste å', icon: '🏆',},
                    { name: 'Bryllupsportretter', criteria: '👰 Bryllup + portrett kategori', icon: '💒',},
                    { name: 'Solnedganger', criteria: '🌅 Utendørs + kveldstid', icon: '🌇',},
                    { name: 'Kommersielle oppdrag', criteria: '💼 Kommersiell kategori', icon: '🏢',},
                    { name: 'Favorittlokasjoner', criteria: '📍 Ofte brukte steder', icon: '📍',}
                  ].map((template, index) => (
                    <Card
                      key={index}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        border: '1px solid transparent',
                        '&:hover': {
                          border: `1px solid ${theme.palette.primary.main}`,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }
                      }}
                      onClick={() => {
                        // Apply template logic
                        console.log(`Applying template: ${template.name}`);
                    }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="h4" sx={{ color: theming.colors.primary }}>{template.icon}</Typography>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {template.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {template.criteria}
                          </Typography>
                        </Box>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            {/* Existing Smart Albums */}
            <Grid item xs={12}>
              <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                  <CollectionsIcon />
                  Eksisterende smart albums
                </Typography>
                
                {smartAlbums.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py:  4 }}>
                    <AutoFixIcon sx={{ fontSize:  48, color: 'text.secondary', mb:  2 }} />
                    <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                      Ingen smart albums opprettet ennå
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Opprett ditt første smart album for automatisk organisering
                    </Typography>
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {smartAlbums.map((album, index) => (
                      <Grid item xs={12} key={index}>
                        <Card sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                              <Typography variant="subtitle1" fontWeight="bold">
                                {album.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {album.itemCount || 0} elementer
                              </Typography>
                              <Chip
                                size="small"
                                label={album.autoUpdate ? 'Auto-oppdatering på' : 'Manuell'}
                                color={album.autoUpdate ? 'success' : 'default'}
                                sx={{ mt:  1 }}
                              />
                            </Box>
                            <IconButton
                              size="small"
                              onClick={() => updateSmartAlbum(album.id)}
                              title="Oppdater album"
                            >
                              <AutoFixIcon />
                            </IconButton>
                          </Stack>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Collections Tab */}
        <TabPanel value={currentTab} index={2}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            {terms.collection}er - Organiser dine showcases
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Lag samlinger for å gruppere relaterte showcases sammen
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card 
                sx={{ 
                  height: 20, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  border: `2px dashed ${theme.palette.secondary.main}`,
                  backgroundColor: alpha(theme.palette.secondary.main, 0.05),
                  cursor: 'pointer'
            }}
                onClick={() => setOpenDialog('new-collection')}
              >
                <Box textAlign="center">
                  <CollectionsIcon sx={{ fontSize:  48, color: 'secondary.main', mb:  2 }} />
                  <Typography variant="h6" color="secondary" sx={{ color: theming.colors.primary }}>
                    Ny {terms.collection.toLowerCase()}
                  </Typography>
                </Box>
              </Card>
            </Grid>
            
            {/* Real Collections from PostgreSQL - NO MOCK DATA */}
            {collections && collections.length > 0 ? (
              collections.map((collection: any) => (
	                <Grid item xs={12} key={collection.id}>
	                  <Card sx={theming.getThemedCardSx()}>
	                    <CardMedia
	                      component="img"
	                      height="120"
	                      image={collection.coverImage || '/placeholder-collection.jpg'}
	                      alt={collection.name}
	                      sx={theming.getThemedCardSx()}
	                    />
	                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>{collection.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {collection.showcaseCount || 0} showcases
                      </Typography>
                    </CardContent>
                    <CardActions sx={theming.getThemedCardSx()}>
                      <Button size="small">Rediger</Button>
                      <Button size="small">Vis</Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Paper 
                  sx={{ 
                    p: 6, 
                    textAlign: 'center',
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                    ...theming.getThemedCardSx()
                  }}>
                  <CollectionsIcon sx={{ fontSize:  64, color: 'text.secondary', mb:  2 }} />
                  <Typography variant="h6" gutterBottom color="text.secondary" sx={{ color: theming.colors.primary }}>
                    Ingen {terms.collection.toLowerCase()}er ennå
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Lag din første {terms.collection.toLowerCase()} for å organisere showcases
                  </Typography>
                  <Button variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setOpenDialog('new-collection')}
                    sx={{
                      background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                      boxShadow: '0 8px 20px blur\(\s*([0-9]+px)\s*,\s*\), 0,0,0,0.2)'
                  }}
                  >
                    Lag ny {terms.collection.toLowerCase()}
                  </Button>
                </Paper>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={currentTab} index={5}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Statistikk og analyse
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p:  3, textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <VisibilityIcon sx={{ fontSize:  48, color: 'primary.main', mb:  1 }} />
                <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>2,847</Typography>
                <Typography variant="body2" color="text.secondary">Totale visninger</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p:  3, textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <ThumbUpIcon sx={{ fontSize:  48, color: 'success.main', mb:  1 }} />
                <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>198</Typography>
                <Typography variant="body2" color="text.secondary">Likes</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p:  3, textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <ShareIcon sx={{ fontSize:  48, color: 'info.main', mb:  1 }} />
                <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>89</Typography>
                <Typography variant="body2" color="text.secondary">Delinger</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p:  3, textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <CommentIcon sx={{ fontSize:  48, color: 'warning.main', mb:  1 }} />
                <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>45</Typography>
                <Typography variant="body2" color="text.secondary">Kommentarer</Typography>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel value={currentTab} index={6}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Globale innstillinger
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle1" gutterBottom>
                  Standard visningsinnstillinger
                </Typography>
                
                <Stack spacing={2}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Vis metadata som standard"
                  />
	                  <FormControlLabel
	                    control={<Switch defaultChecked />}
	                    label="Vis statistikk som standard"
	                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Aktiver kommentarer som standard"
                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Aktiver likes som standard"
                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Aktiver deling som standard"
                  />
                </Stack>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle1" gutterBottom>
                  SEO-innstillinger
                </Typography>
                
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Standard meta-beskrivelse"
                    multiline
                    rows={3}
                    placeholder="Beskrivelse som brukes for søkemotoroptimalisering..."
                  />
                  <TextField
                    fullWidth
                    label="Standard nøkkelord (kommaseparert)"
                    placeholder={`${profession}, Norge, ${terms.showcase.toLowerCase()}...`}
                  />
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>

      {/* Speed Dial for Quick Actions */}
      <SpeedDial
        ariaLabel="Showcase actions"
        sx={{ position: 'fixed', bottom:  20, right: 20}}
        icon={<SpeedDialIcon />}
      >
        {SpeedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.action}
          />
        ))}
      </SpeedDial>

      {/* New Showcase Dialog */}
      <Dialog 
        open={openDialog === 'new-showcase'}
        onClose={() => setOpenDialog(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Lag ny {terms.showcase.toLowerCase()}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tittel"
                value={showcaseForm.title}
                onChange={(e) => setShowcaseForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Kategori</InputLabel>
                <Select
                  value={showcaseForm.category}
                  label="Kategori"
                  onChange={(e) => setShowcaseForm(prev => ({ ...prev, category: e.target.value }))}
                >
                  {getCategoryOptions().map(category => (
                    <MenuItem key={category} value={category}>{category}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Beskrivelse"
                multiline
                rows={3}
                value={showcaseForm.description}
                onChange={(e) => setShowcaseForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Visningsalternativer</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showcaseForm.displayConfig.showMetadata}
                        onChange={(e) => setShowcaseForm(prev => ({
                          ...prev,
                          displayConfig: { ...prev.displayConfig, showMetadata: e.target.checked }
                      }))}
                      />
                  }
                    label="Vis metadata"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showcaseForm.displayConfig.showStats}
                        onChange={(e) => setShowcaseForm(prev => ({
                          ...prev,
                          displayConfig: { ...prev.displayConfig, showStats: e.target.checked }
                      }))}
                      />
                  }
                    label="Vis statistikk"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showcaseForm.displayConfig.showTestimonials}
                        onChange={(e) => setShowcaseForm(prev => ({
                          ...prev,
                          displayConfig: { ...prev.displayConfig, showTestimonials: e.target.checked }
                      }))}
                      />
                  }
                    label="Vis anbefalinger"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showcaseForm.displayConfig.showEquipmentUsed}
                        onChange={(e) => setShowcaseForm(prev => ({
                          ...prev,
                          displayConfig: { ...prev.displayConfig, showEquipmentUsed: e.target.checked }
                      }))}
                      />
                  }
                    label="Vis utstyr brukt"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showcaseForm.displayConfig.enableComments}
                        onChange={(e) => setShowcaseForm(prev => ({
                          ...prev,
                          displayConfig: { ...prev.displayConfig, enableComments: e.target.checked }
                      }))}
                      />
                  }
                    label="Aktiver kommentarer"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showcaseForm.displayConfig.enableSharing}
                        onChange={(e) => setShowcaseForm(prev => ({
                          ...prev,
                          displayConfig: { ...prev.displayConfig, enableSharing: e.target.checked }
                      }))}
                      />
                  }
                    label="Aktiver deling"
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(null)}>Avbryt</Button>
          <Button variant="contained" sx={theming.getThemedButtonSx()}>Opprett showcase</Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Photo Enhancement Dialog */}
      <Dialog 
        open={enhancementDialogOpen}
        onClose={() => setEnhancementDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, #FF6B35, #F7931E)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1 }}>
          🎨 Bulk bildeforbedring med CreatorHub Photo Enhancer
        </DialogTitle>
        <DialogContent sx={{ mt:  2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Forbedre {selectedItems.length} bilder samtidig med profesjonelle innstillinger
          </Typography>

          <FormControl fullWidth sx={{ mb:  3 }}>
            <InputLabel>Forhåndsdefinerte innstillinger</InputLabel>
            <Select
              value={selectedPreset}
              label="Forhåndsdefinerte innstillinger"
              onChange={(e) => setSelectedPreset(e.target.value)}
            >
              {Object.entries(mergedEnhancementPresets || {}).map(([key, preset]: [string, any]) => (
                <MenuItem key={key} value={key}>
                  {preset.name} - {preset.description}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedPreset === 'custom' && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography gutterBottom>Lysstyrke</Typography>
                <Slider
                  value={customEnhancementOptions.brightness}
                  onChange={(_, value) => setCustomEnhancementOptions(prev => ({ ...prev, brightness: value as number }))}
                  min={-50}
                  max={50}
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography gutterBottom>Kontrast</Typography>
                <Slider
                  value={customEnhancementOptions.contrast}
                  onChange={(_, value) => setCustomEnhancementOptions(prev => ({ ...prev, contrast: value as number }))}
                  min={0.5}
                  max={2}
                  step={0.1}
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography gutterBottom>Metning</Typography>
                <Slider
                  value={customEnhancementOptions.saturation}
                  onChange={(_, value) => setCustomEnhancementOptions(prev => ({ ...prev, saturation: value as number }))}
                  min={-50}
                  max={50}
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography gutterBottom>Skarphet</Typography>
                <Slider
                  value={customEnhancementOptions.sharpening}
                  onChange={(_, value) => setCustomEnhancementOptions(prev => ({ ...prev, sharpening: value as number }))}
                  min={0}
                  max={2}
                  step={0.1}
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={customEnhancementOptions.noiseReduction}
                      onChange={(e) => setCustomEnhancementOptions(prev => ({ ...prev, noiseReduction: e.target.checked }))}
                    />
                }
                  label="Støyreduksjon"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={customEnhancementOptions.autoTone}
                      onChange={(e) => setCustomEnhancementOptions(prev => ({ ...prev, autoTone: e.target.checked }))}
                    />
                }
                  label="Automatisk tone"
                />
              </Grid>
            </Grid>
          )}

          {isEnhancing && (
            <Box sx={{ mt:  3 }}>
              <Typography variant="body2" gutterBottom>
                Forbedrer bilder... {enhancementProgress}%
              </Typography>
              <LinearProgress variant="determinate" value={enhancementProgress} />
            </Box>
          )}
        </DialogContent>
	        <DialogActions>
	          <Button onClick={() => setEnhancementDialogOpen(false)} disabled={isEnhancing}>
	            Avbryt
	          </Button>
	          <Button
	            variant="contained"
	            onClick={executeEnhancement}
	            disabled={isEnhancing || selectedItems.length === 0}
	            sx={{
	              background: 'linear-gradient(135deg, #FF6B35, #F7931E)', '&:hover': {
	                background: 'linear-gradient(135deg, #E55A2B, #D67C1A)',
	              },
	              ...theming.getThemedButtonSx()}}
	          >
            {isEnhancing ?'Forbedrer...': `Forbedre ${selectedItems.length} bilder`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Other dialogs can be added here */}
    </Box>
  );
}