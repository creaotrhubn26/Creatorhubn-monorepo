import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { useTheming } from '../../utils/theming-helper';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import { useProfessionConfig } from '../../hooks/useProfessionConfig';
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
  FormControl,
  InputLabel,
  Select,
  Slider,
  Stack,
  Avatar,
  Rating,
  Alert,
  LinearProgress,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  PhotoLibrary as PhotoLibraryIcon,
  Star as StarIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  ThumbUp as ThumbUpIcon,
  Comment as CommentIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  ViewCarousel as ViewCarouselIcon,
  TrendingUp as TimelineIcon,
  Collections as CollectionsIcon,
  Tune as TuneIcon,
  Preview as PreviewIcon,
  Search as SearchIcon,
  Lock as LockIcon,
  Archive as ArchiveIcon,
  Download as DownloadIcon,
  Speed as SpeedIcon,
  DateRange as DateRangeIcon,
  LocationOn as LocationOnIcon,
  CameraAlt as CameraAltIcon,
  GridView as GridViewIcon,
  ViewStream as ViewStreamIcon,
  AspectRatio as AspectRatioIcon,
  LocalOffer as TagIcon,
  Folder as FolderIcon,
  Compress as CompressIcon,
  Campaign as CampaignIcon,
  EmojiEvents as TrophyIcon,
  Favorite as FavoriteIcon,
  WbSunny as SunnyIcon,
  Edit as EditIcon,
  CheckCircle,
  Visibility as VisibilityIcon,
  WarningAmber as WarningAmberIcon,
  OpenInNew,
  Close,
  BugReport,
  Lightbulb,
  ThumbUp,
  Psychology,
  Book,
  AutoFixHigh as AutoFixIcon,
  Business as BusinessIcon,
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

const _feedbackTypeIcons: Record<string, any> = {
  bug: BugReport,
  feature: Lightbulb,
  usability: ThumbUp,
  ui_ux: Psychology,
  general: Comment,
};

const _feedbackTypeColors: Record<string, string> = {
  bug: '#f44330',
  feature: '#ff9800',
  usability: '#4caf50',
  ui_ux: '#9c27b0',
  general: '#2196f3',
};

const _priorityColors: Record<string, string> = {
  low: '#4caf50',
  medium: '#ff9800',
  high: '#f44330',
  critical: '#9c27b0',
};

const _statusColors: Record<string, string> = {
  open: '#2196f0',
  in_progress: '#ff9800',
  resolved: '#4caf50',
  closed: '#757575',
};

// Admin note templates for consistent responses
const _adminNoteTemplates = [
  {
    label: 'Problembeskrivelse',
    content: '<h3>Problembeskrivelse:</h3><p>[Beskriv problemet detaljert]</p><h3>Planlagt løsning:</h3><p>[Hvordan problemet skal løses]</p><h3>Estimert, tid:</h3><p>[Forventet tid for løsning]</p>'
},
  {
    label: 'Forbedring implementert', 
    content: '<h3>Forbedring implementert</h3><p><strong>Dato:</strong> ' + new Date().toLocaleDateString('no-NO') + '</p><p><strong>Endringer:</strong></p><ul><li>[Endre 1]</li><li>[Endring 2]</li></ul><p><strong>Testing:</strong> [Testet og verifisert]</p>'
},
  {
    label: 'Behov for mer informasjon',
    content: '<h3>Trenger mer informasjon ℹ️</h3><p><strong>Spørsmål til, bruker:</strong></p><ol><li>[Spørsmål 1]</li><li>[Spørsmål 2]</li></ol><p><strong>Kontaktinfo:</strong> [E-post/telefon]</p>'
},
  {
    label: 'Lukket - Løst',
    content: '<h3>Tilbakemelding løst</h3><p><strong>Løsningsdato:</strong> ' + new Date().toLocaleDateString('no-NO') + '</p><p><strong>Implementerte løsninger:</strong></p><p>[Detaljert beskrivelse av løsningen]</p><p><strong>Oppfølging:</strong> [Ingen ytterligere handling nødvendig]</p>'
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
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  userId: string;
  viewerContent?: React.ReactNode;
  // Integration props for universal connectivity
  _onShowcaseCreate?: (showcase: any) => void;
  _onShowcaseShare?: (showcase: any, meeting: any) => void;
  _onProjectUpdate?: (project: any) => void;
  _selectedProject?: any;
  _onProjectSelect?: (project: any) => void;
  // Feedback system integration props
  _onFeedbackUpdate?: (feedback: any) => void;
  _onNotificationCreate?: (notification: any) => void
}

export default function ShowcaseAdmin({ 
  profession, 
  userId, 
  viewerContent,
  _onShowcaseCreate,
  _onShowcaseShare,
  _onProjectUpdate,
  _selectedProject,
  _onProjectSelect,
  _onFeedbackUpdate,
  _onNotificationCreate
}: ShowcaseAdminProps) {
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [currentTab, setCurrentTab] = useState(0);
  const showcaseViewerTabIndex = 7;
	const { integration, communication, dataFlow, componentRegistry, features, auth } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming(profession || 'photographer');

  // Client service pricing service integration
  const { 
    formatCurrency
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
    config: _professionConfig,
    isLoading: _configLoading,
    terminology,
    settings: _settings,
    workflows: _workflows,
    ui: _ui,
    integrations: _integrations,
    enhancementPresets,
    batchOperations: _batchOperations,
    getTerm: _getTerm,
    getSetting,
    getWorkflow: _getWorkflow,
    getUISetting: _getUISetting,
    getIntegration: _getIntegration
} = useProfessionConfig({ profession });
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [selectedShowcase, setSelectedShowcase] = useState<any>(null);
  const [previewMode, setPreviewMode] = useState(false);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Edit/Delete State
  const [editingShowcase, setEditingShowcase] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showcaseToDelete, setShowcaseToDelete] = useState<any>(null);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  
  // Collection Edit State
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<any>(null);
  const [collectionDeleteConfirmOpen, setCollectionDeleteConfirmOpen] = useState(false);
  
  // Template Edit State
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateToDelete, setTemplateToDelete] = useState<any>(null);
  const [templateDeleteConfirmOpen, setTemplateDeleteConfirmOpen] = useState(false);
  
  // Preview State
  const [previewShowcase, setPreviewShowcase] = useState<any>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  
  // Collection Showcase Assignment State
  const [assignShowcaseDialogOpen, setAssignShowcaseDialogOpen] = useState(false);
  const [selectedCollectionForAssignment, setSelectedCollectionForAssignment] = useState<any>(null);
  const [showcasesToAssign, setShowcasesToAssign] = useState<string[]>([]);
  
  // Loading States
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  
  // Undo State for Batch Operations
  const [lastBatchOperation, setLastBatchOperation] = useState<{
    type: string;
    items: any[];
    timestamp: number;
  } | null>(null);
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);
  
  // Notification State for user feedback
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  
  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setNotification({ open: true, message, severity });
  };
  
  const closeNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };
  
  // Settings State
  const [globalSettings, setGlobalSettings] = useState({
    defaultShowMetadata: true,
    defaultShowStats: true,
    defaultEnableComments: true,
    defaultEnableLikes: true,
    defaultEnableSharing: true,
    seoDescription: '',
    seoKeywords: '',
  });
  
  // Media Upload State
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  
  // Tags State
  const [_availableTags, _setAvailableTags] = useState<string[]>([
    'Bryllup', 'Portrett', 'Natur', 'Arkitektur', 'Familie', 'Kommersielt', 
    'Event', 'Dokumentar', 'Mote', 'Produktfoto', 'Reise', 'Sport'
  ]);
  
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
  const [_selectedFeedback, _setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [_statusDialogOpen, _setStatusDialogOpen] = useState(false);
  const [_detailDialogOpen, _setDetailDialogOpen] = useState(false);
  const [_newStatus, _setNewStatus] = useState('');
  const [_adminNotes, _setAdminNotes] = useState('');

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
    features.trackFeatureUsage('showcase-admin', 'opened', {
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
    communication.onMessageType('showcase:refresh-all', (data: any) => {
      if (data.profession === profession && data.userId === userId) {
        queryClient.invalidateQueries({ queryKey: ['/api/showcase'] });
    }
  });
    
    communication.onMessageType('showcase:template-selected', (data: any) => {
      if (data.profession === profession) {
        const incomingTemplate = data.template;
        if (!incomingTemplate) {
          showNotification('Malen kunne ikke åpnes fordi ingen maldata ble sendt med.', 'warning');
          return;
        }

        setTemplateForm(incomingTemplate);
        setShowcaseForm((prev) => ({
          ...prev,
          displayConfig: {
            ...prev.displayConfig,
            template: incomingTemplate.name || prev.displayConfig.template,
          },
        }));
        setOpenDialog('new-showcase');
        showNotification(`Malen "${incomingTemplate.name || 'Uten navn'}" er klar til bruk i ny showcase.`, 'success');
    }
  });
    
    communication.onMessageType('showcase:mapping-created', (data: any) => {
      if (data.profession === profession && data.userId === userId) {
        queryClient.invalidateQueries({ queryKey: ['/api/showcase'] });
    }
  });

    // Feedback system communication subscriptions
    const feedbackRefreshUnsubscribe = communication.onMessageType('feedback:refresh-all', (data: any) => {
      if (data.profession === profession && data.userId === userId) {
        queryClient.invalidateQueries({ queryKey: ['/api/prototype-testing/feedback', ],});
    }
  });

    const feedbackUpdateUnsubscribe = communication.onMessageType('feedback:updated', (data: any) => {
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

  const _handleSelectAll = (items: any[]) => {
    const allIds = items.map(item => item.id);
    setSelectedItems(prev => 
      prev.length === allIds.length ? [] : allIds
    );
  };

  // Quick action handlers for batch operations
  const handleQuickAction = (action: string) => {
    if (!showcases || showcases.length === 0) {
      showNotification('Ingen showcases tilgjengelig for dette hurtigvalget.', 'warning');
      return;
    }

    switch (action) {
      case 'select-all-featured': {
        const featuredIds = showcases.filter((s: any) => s.isFeatured).map((s: any) => s.id);
        setSelectedItems(featuredIds);
        showNotification(`${featuredIds.length} fremhevede showcases valgt.`, featuredIds.length > 0 ? 'success' : 'info');
        break;
      }
      case 'select-all-recent': {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentIds = showcases.filter((s: any) => new Date(s.createdAt) >= oneWeekAgo).map((s: any) => s.id);
        setSelectedItems(recentIds);
        showNotification(`${recentIds.length} nylige showcases valgt fra siste uke.`, recentIds.length > 0 ? 'success' : 'info');
        break;
      }
      case 'select-by-rating': {
        const highRatedIds = showcases.filter((s: any) => (s.rating || 0) >= 4).map((s: any) => s.id);
        setSelectedItems(highRatedIds);
        showNotification(`${highRatedIds.length} showcases med 4+ rating valgt.`, highRatedIds.length > 0 ? 'success' : 'info');
        break;
      }
      case 'select-unpublished': {
        const unpublishedIds = showcases.filter((s: any) => s.status === 'draft' || !s.isPublished).map((s: any) => s.id);
        setSelectedItems(unpublishedIds);
        showNotification(`${unpublishedIds.length} upubliserte showcases valgt.`, unpublishedIds.length > 0 ? 'success' : 'info');
        break;
      }
      default:
        showNotification(`Ukjent hurtighandling: ${action}`, 'warning');
    }
  };

  // Save template handler
  const handleSaveTemplate = async () => {
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch('/api/showcase/templates', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...templateForm,
          profession,
          userId,
        }),
      });

      if (response.ok) {
        const newTemplate = await response.json();
        console.log('✅ Template saved:', newTemplate.name);
        queryClient.invalidateQueries({ queryKey: ['/api/showcase/templates'] });
        setOpenDialog(null);
        showNotification('Mal opprettet!', 'success');
      } else {
        showNotification('Kunne ikke opprette mal. Prøv igjen.', 'error');
      }
    } catch (error) {
      console.error('❌ Template save failed:', error);
      showNotification('Noe gikk galt under lagring av malen.', 'error');
    }
  };

  // Create showcase handler
  const handleCreateShowcase = async () => {
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch('/api/showcase', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...showcaseForm,
          profession,
          userId,
        }),
      });

      if (response.ok) {
        const newShowcase = await response.json();
        console.log('✅ Showcase created:', newShowcase.title);
        queryClient.invalidateQueries({ queryKey: ['/api/showcase'] });
        setOpenDialog(null);
        showNotification('Showcase opprettet!', 'success');
        integration?.emit?.('showcase:created', {
          showcase: newShowcase,
          source: 'showcase-admin',
          profession,
          userId,
          timestamp: Date.now(),
        });
        // Reset form
        setShowcaseForm({
          title: '',
          description: '',
          subtitle: '',
          category: '',
          tags: [],
          mediaConfig: {
            primaryMedia: {
              type: 'image',
              url: '',
              aspectRatio: '16:9'
            }
          },
          displayConfig: {
            template: '',
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
            enableSharing: true,
          },
          clientInfo: {
            name: '',
            testimonial: '',
            rating: 5,
            showPublicly: true
          },
          isPublic: true,
          isFeatured: false,
          status: 'draft'
        });
      } else {
        showNotification('Kunne ikke opprette showcase. Prøv igjen.', 'error');
      }
    } catch (error) {
      console.error('❌ Showcase creation failed:', error);
      showNotification('Noe gikk galt under opprettelse av showcase.', 'error');
    }
  };

  // Create collection handler
  const handleCreateCollection = async (collectionData: { name: string; description: string; isPublic: boolean }) => {
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch('/api/showcase/collections', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...collectionData,
          profession,
          userId,
        }),
      });

      if (response.ok) {
        const newCollection = await response.json();
        console.log('✅ Collection created:', newCollection.name);
        queryClient.invalidateQueries({ queryKey: ['/api/showcase/collections'] });
        setOpenDialog(null);
        showNotification('Samling opprettet!', 'success');
      } else {
        showNotification('Kunne ikke opprette samling. Prøv igjen.', 'error');
      }
    } catch (error) {
      console.error('❌ Collection creation failed:', error);
      showNotification('Noe gikk galt under opprettelse av samling.', 'error');
    }
  };

  // Edit showcase handler
  const handleEditShowcase = async () => {
    if (!editingShowcase) return;
    
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch(`/api/showcase/${editingShowcase.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...editingShowcase,
          profession,
          userId,
        }),
      });

      if (response.ok) {
        const updatedShowcase = await response.json();
        console.log('✅ Showcase updated:', updatedShowcase.title);
        queryClient.invalidateQueries({ queryKey: ['/api/showcase'] });
        setOpenDialog(null);
        setEditingShowcase(null);
        showNotification('Showcase oppdatert!', 'success');
        integration?.emit?.('showcase:updated', {
          showcase: updatedShowcase,
          source: 'showcase-admin',
          profession,
          userId,
          timestamp: Date.now(),
        });
        
        // Broadcast update event
        communication.sendBroadcast('showcase:updated', {
          showcase: updatedShowcase,
          profession,
          userId,
          timestamp: Date.now(),
        });
      } else {
        showNotification('Kunne ikke oppdatere showcase. Prøv igjen.', 'error');
      }
    } catch (error) {
      console.error('❌ Showcase update failed:', error);
      showNotification('Noe gikk galt under oppdatering av showcase.', 'error');
    }
  };

  // Delete showcase handler
  const handleDeleteShowcase = async () => {
    if (!showcaseToDelete) return;
    
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch(`/api/showcase/${showcaseToDelete.id}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });

      if (response.ok) {
        console.log('✅ Showcase deleted:', showcaseToDelete.title);
        queryClient.invalidateQueries({ queryKey: ['/api/showcase'] });
        setDeleteConfirmOpen(false);
        setShowcaseToDelete(null);
        showNotification('Showcase slettet', 'success');
        integration?.emit?.('showcase:deleted', {
          showcaseId: showcaseToDelete.id,
          source: 'showcase-admin',
          profession,
          userId,
          timestamp: Date.now(),
        });
        
        // Broadcast delete event
        communication.sendBroadcast('showcase:deleted', {
          showcaseId: showcaseToDelete.id,
          profession,
          userId,
          timestamp: Date.now(),
        });
      } else {
        showNotification('Kunne ikke slette showcase. Prøv igjen.', 'error');
      }
    } catch (error) {
      console.error('❌ Showcase deletion failed:', error);
      showNotification('Noe gikk galt under sletting av showcase.', 'error');
    }
  };

  // Edit collection handler
  const handleEditCollection = async () => {
    if (!editingCollection) return;
    
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch(`/api/showcase/collections/${editingCollection.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(editingCollection),
      });

      if (response.ok) {
        console.log('✅ Collection updated:', editingCollection.name);
        queryClient.invalidateQueries({ queryKey: ['/api/showcase/collections'] });
        setOpenDialog(null);
        setEditingCollection(null);
        showNotification('Samling oppdatert!', 'success');
      } else {
        showNotification('Kunne ikke oppdatere samling. Prøv igjen.', 'error');
      }
    } catch (error) {
      console.error('❌ Collection update failed:', error);
      showNotification('Noe gikk galt under oppdatering av samling.', 'error');
    }
  };

  // Delete collection handler
  const handleDeleteCollection = async () => {
    if (!collectionToDelete) return;
    
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch(`/api/showcase/collections/${collectionToDelete.id}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });

      if (response.ok) {
        console.log('✅ Collection deleted:', collectionToDelete.name);
        queryClient.invalidateQueries({ queryKey: ['/api/showcase/collections'] });
        setOpenDialog(null);
        setCollectionToDelete(null);
        showNotification('Samling slettet', 'success');
      } else {
        showNotification('Kunne ikke slette samling. Prøv igjen.', 'error');
      }
    } catch (error) {
      console.error('❌ Collection deletion failed:', error);
      showNotification('Noe gikk galt under sletting av samling.', 'error');
    }
  };

  // Media upload handler
  const handleMediaUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!mediaUploadAccess?.hasAccess) {
      showNotification(mediaUploadAccess?.reason || 'Du har ikke tilgang til opplasting.', 'warning');
      return;
    }

    setMediaFiles(Array.from(files));
    setUploadingMedia(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      Array.from(files).forEach((file, index) => {
        formData.append(`file${index}`, file);
      });
      formData.append('profession', profession);
      formData.append('userId', userId);
      
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch('/api/showcase/upload-media', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        const uploadedMedia = await response.json();
        console.log('✅ Media uploaded:', uploadedMedia.length, 'files');
        
        // Update showcase form with uploaded media
        if (uploadedMedia.length > 0) {
          setShowcaseForm(prev => ({
            ...prev,
            mediaConfig: {
              ...prev.mediaConfig,
              primaryMedia: {
                ...prev.mediaConfig.primaryMedia,
                url: uploadedMedia[0].url,
              }
            }
          }));
        }
        setUploadProgress(100);
      }
    } catch (error) {
      console.error('❌ Media upload failed:', error);
    } finally {
      setUploadingMedia(false);
    }
  };

  // Save global settings handler
  const handleSaveSettings = async () => {
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch('/api/showcase/settings', {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...globalSettings,
          profession,
          userId,
        }),
      });

      if (response.ok) {
        console.log('✅ Settings saved');
        setOpenDialog(null);
      }
    } catch (error) {
      console.error('❌ Settings save failed:', error);
    }
  };

  // Apply smart album template
  const applySmartAlbumTemplate = (template: { name: string; criteria: string; color: string }) => {
    // Parse template criteria and set up smart album
    let rating = 0;
    let tags: string[] = [];
    const dateRange = { start: '', end: '' };
    
    if (template.criteria.includes('4+')) {
      rating = 4;
    }
    if (template.criteria.includes('siste år')) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      dateRange.start = oneYearAgo.toISOString().split('T')[0];
      dateRange.end = new Date().toISOString().split('T')[0];
    }
    if (template.name.includes('Bryllup')) {
      tags = ['Bryllup', 'Portrett'];
    }
    if (template.name.includes('Kommersiell')) {
      tags = ['Kommersielt', 'Produktfoto'];
    }
    
    setSmartAlbumCriteria({
      name: template.name,
      rating,
      tags,
      dateRange,
      location: '',
      camera: '',
      autoUpdate: true,
    });
  };

  // Batch operation with confirmation
  const _confirmBatchOperation = () => {
    if (batchOperation === 'delete' || batchOperation === 'archive') {
      setBatchConfirmOpen(true);
    } else {
      executeBatchOperation(batchOperation);
    }
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
				communication.sendBroadcast('batch:operation-completed', {
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
				communication.sendBroadcast('showcase:smart-album-created', {
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

  // Template edit handler
  const handleEditTemplate = async () => {
    if (!editingTemplate) return;
    setIsSavingTemplate(true);
    
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch(`/api/showcase/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(editingTemplate),
      });

      if (response.ok) {
        console.log('✅ Template updated:', editingTemplate.name);
        queryClient.invalidateQueries({ queryKey: ['/api/showcase/templates'] });
        setOpenDialog(null);
        setEditingTemplate(null);
      }
    } catch (error) {
      console.error('❌ Template update failed:', error);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Template delete handler
  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    setIsDeletingItem(true);
    
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch(`/api/showcase/templates/${templateToDelete.id}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });

      if (response.ok) {
        console.log('✅ Template deleted:', templateToDelete.name);
        queryClient.invalidateQueries({ queryKey: ['/api/showcase/templates'] });
        setTemplateDeleteConfirmOpen(false);
        setTemplateToDelete(null);
      }
    } catch (error) {
      console.error('❌ Template deletion failed:', error);
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Preview showcase handler
  const handlePreviewShowcase = (showcase: any) => {
    setPreviewShowcase(showcase);
    setPreviewDialogOpen(true);
    integration?.emit?.('showcase:previewed', {
      showcaseId: showcase?.id,
      source: 'showcase-admin',
      profession,
      userId,
      timestamp: Date.now(),
    });
  };

  // Assign showcases to collection handler
  const handleAssignShowcasesToCollection = async () => {
    if (!selectedCollectionForAssignment || showcasesToAssign.length === 0) return;
    setIsSavingCollection(true);
    
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch(`/api/showcase/collections/${selectedCollectionForAssignment.id}/showcases`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          showcaseIds: showcasesToAssign,
        }),
      });

      if (response.ok) {
        console.log('✅ Showcases assigned to collection');
        queryClient.invalidateQueries({ queryKey: ['/api/showcase/collections'] });
        setAssignShowcaseDialogOpen(false);
        setSelectedCollectionForAssignment(null);
        setShowcasesToAssign([]);
      }
    } catch (error) {
      console.error('❌ Showcase assignment failed:', error);
    } finally {
      setIsSavingCollection(false);
    }
  };

  // Remove showcase from collection handler
  const _handleRemoveShowcaseFromCollection = async (collectionId: string, showcaseId: string) => {
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch(`/api/showcase/collections/${collectionId}/showcases/${showcaseId}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });

      if (response.ok) {
        console.log('✅ Showcase removed from collection');
        queryClient.invalidateQueries({ queryKey: ['/api/showcase/collections'] });
      }
    } catch (error) {
      console.error('❌ Showcase removal failed:', error);
    }
  };

  // Undo batch operation handler
  const handleUndoBatchOperation = async () => {
    if (!lastBatchOperation) return;
    
    try {
      const authHeaders = await auth.getAuthHeader();
      const response = await fetch('/api/showcase/batch-operations/undo', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          operationType: lastBatchOperation.type,
          items: lastBatchOperation.items,
          profession,
          userId,
        }),
      });

      if (response.ok) {
        console.log('✅ Batch operation undone');
        queryClient.invalidateQueries({ queryKey: ['/api/showcase'] });
        setLastBatchOperation(null);
        setUndoSnackbarOpen(false);
      }
    } catch (error) {
      console.error('❌ Undo operation failed:', error);
    }
  };

  // Enhanced batch operation that stores for undo
  const _executeBatchOperationWithUndo = async (operation: string) => {
    if (selectedItems.length === 0) return;

    // Store current state for undo
    const itemsToStore = filteredShowcases?.filter((s: any) => selectedItems.includes(s.id)) || [];
    
    await executeBatchOperation(operation);
    
    // Only store undo for destructive operations
    if (['delete', 'archive'].includes(operation)) {
      setLastBatchOperation({
        type: operation,
        items: itemsToStore,
        timestamp: Date.now(),
      });
      setUndoSnackbarOpen(true);
      
      // Auto-clear undo after 30 seconds
      setTimeout(() => {
        setLastBatchOperation(null);
        setUndoSnackbarOpen(false);
      }, 30000);
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
	const { data: collections, isLoading: _collectionsLoading } = useQuery({
		queryKey: ['/api/showcase/collections', profession, userId],
		queryFn: async () => {
			return apiRequest(`/api/showcase/collections?profession=${profession}&userId=${userId}`);
		},
		enabled: true,
	});

  // Fetch real analytics data
  const { data: analyticsData } = useQuery({
    queryKey: ['/api/showcase/analytics', profession, userId],
    queryFn: async () => {
      return apiRequest(`/api/showcase/analytics?profession=${profession}&userId=${userId}`);
    },
    enabled: true,
  });

  // Filter showcases based on search, category, and status
  const filteredShowcases = React.useMemo(() => {
    if (!showcases) return [];
    return showcases.filter((showcase: any) => {
      const matchesSearch = !searchQuery || 
        showcase.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        showcase.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        showcase.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = !categoryFilter || showcase.category === categoryFilter;
      const matchesStatus = !statusFilter || showcase.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [showcases, searchQuery, categoryFilter, statusFilter]);

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

  const _handleViewDriveAnalytics = () => {
    console.log('View Drive Analytics clicked');
    // Implementation for Drive Analytics viewing
};

  const speedDialActions = [
    showcaseCreationAccess?.hasAccess && {
      icon: <AddIcon />,
      name: 'Ny showcase',
      action: () => {
        setOpenDialog('new-showcase');
        integration?.emit?.('showcase:create-start', { source: 'showcase-admin', timestamp: Date.now() });
      },
    },
    portfolioManagementAccess?.hasAccess && {
      icon: <CollectionsIcon />,
      name: 'Ny samling',
      action: () => setOpenDialog('new-collection'),
    },
    contentManagementAccess?.hasAccess && {
      icon: <PaletteIcon />,
      name: 'Ny mal',
      action: () => setOpenDialog('new-template'),
    },
    showcasePublishingAccess?.hasAccess && {
      icon: <SettingsIcon />,
      name: 'Innstillinger',
      action: () => setOpenDialog('settings'),
    },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; name: string; action: () => void }>;

  if (!showcaseAdminAccess?.hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          {showcaseAdminAccess?.reason || 'Du har ikke tilgang til Showcase-admin.'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: alpha(theme.palette.background.default, 0.5) }}>
      {/* Header with tabs */}
      <Paper sx={{ 
        mb: 0, 
        background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
        color: 'white',
        borderRadius: 0,
        boxShadow: `0 4px 20px ${alpha(theming.colors.primary, 0.3)}`,
      }}>
        <Box sx={{ p: 3, pb: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: alpha(theming.colors.secondary, 0.3), 
                    width: 48, 
                    height: 48,
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <CollectionsIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
                    {terms.showcase} Administrasjon
                  </Typography>
                  <Typography variant="subtitle1" sx={{ opacity: 0.85, fontWeight: 400 }}>
                    Full kontroll over dine {terms.showcase.toLowerCase()} med mange visningsalternativer
                  </Typography>
                </Box>
              </Box>
              
              {/* Stats row */}
              <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ 
                    bgcolor: alpha(theming.colors.secondary, 0.3), 
                    borderRadius: 1, 
                    px: 1.5, 
                    py: 0.5,
                    backdropFilter: 'blur(10px)',
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {showcases?.length || 0} prosjekter
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VisibilityIcon sx={{ fontSize: 18, opacity: 0.8 }} />
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    1,234 visninger totalt
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StarIcon sx={{ fontSize: 18, opacity: 0.8 }} />
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    156 favoritter
                  </Typography>
                </Box>
              </Box>
            </Box>
            
            {/* Gallery Access Button */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Tooltip
                title={
                  showcaseCreationAccess?.hasAccess
                    ? `Opprett ny ${terms.showcase.toLowerCase()}`
                    : (showcaseCreationAccess?.reason || 'Du har ikke tilgang til opprettelse.')
                }
                arrow
              >
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      if (!showcaseCreationAccess?.hasAccess) {
                        showNotification(showcaseCreationAccess?.reason || 'Du har ikke tilgang.', 'warning');
                        return;
                      }
                      setOpenDialog('new-showcase');
                      integration?.emit?.('showcase:create-start', { source: 'showcase-admin', timestamp: Date.now() });
                    }}
                    disabled={!showcaseCreationAccess?.hasAccess}
                    sx={{
                      color: 'white',
                      borderColor: alpha(theming.colors.secondary, 0.5),
                      backdropFilter: 'blur(10px)',
                      fontWeight: 600,
                      px: 2.5,
                      borderRadius: 2,
                      textTransform: 'none',
                      '&:hover': {
                        borderColor: theming.colors.secondary,
                        bgcolor: alpha(theming.colors.secondary, 0.2),
                      },
                    }}
                  >
                    Ny {terms.showcase}
                  </Button>
                </span>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<PreviewIcon />}
                onClick={() => setPreviewMode(!previewMode)}
                sx={{
                  bgcolor: previewMode ? theming.colors.primary : alpha(theming.colors.primary, 0.6),
                  color: 'white',
                  backdropFilter: 'blur(20px)',
                  border: previewMode ? `2px solid ${theming.colors.secondary}` : 'none',
                  fontWeight: 600,
                  px: 2.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: theming.colors.primary,
                  },
                }}
              >
                {previewMode ? 'Avslutt Forhåndsvisning' : 'Forhåndsvisning'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setCurrentTab(showcaseViewerTabIndex);
                }}
                sx={{
                  color: 'white',
                  borderColor: alpha(theming.colors.secondary, 0.5),
                  backdropFilter: 'blur(20px)',
                  fontWeight: 600,
                  px: 2.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: theming.colors.secondary,
                    bgcolor: alpha(theming.colors.secondary, 0.2),
                  },
                }}
              >
                Åpne Showcase Viewer
              </Button>
            </Box>
          </Box>
          
          <Tabs 
            value={currentTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': { 
                color: alpha(theming.colors.secondary, 0.7),
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.9rem',
                minHeight: 56,
                '&.Mui-selected': { 
                  color: theming.colors.secondary,
                  fontWeight: 600,
                },
              },
              '& .MuiTabs-indicator': { 
                backgroundColor: theming.colors.secondary,
                height: 3,
                borderRadius: '3px 3px 0 0',
              }
            }}
          >
            <Tab icon={<CollectionsIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Alle Showcases" />
            <Tab icon={<PaletteIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Maler & Design" disabled={!contentManagementAccess?.hasAccess} />
            <Tab icon={<ViewModuleIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Samlinger" disabled={!portfolioManagementAccess?.hasAccess} />
            <Tab icon={<SpeedIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Batch Operasjoner" disabled={!contentManagementAccess?.hasAccess} />
            <Tab icon={<AutoFixIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Smart Albums" disabled={!contentManagementAccess?.hasAccess} />
            <Tab icon={<AnalyticsIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Statistikk" disabled={!showcaseAnalyticsAccess?.hasAccess} />
            <Tab icon={<SettingsIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Innstillinger" disabled={!showcasePublishingAccess?.hasAccess} />
            <Tab icon={<VisibilityIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Showcase Viewer" />
          </Tabs>
        </Box>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        {/* All Showcases Tab */}
        <TabPanel value={currentTab} index={0}>
          <Grid container spacing={3}>
            {/* Filters and Controls */}
            <Grid item xs={12}>
              <Paper sx={{ 
                p: 2, 
                mb: 2, 
                borderRadius: 2,
                border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                ...theming.getThemedCardSx() 
              }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <TextField
                    placeholder="Søk i showcases..."
                    size="small"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: theming.colors.primary, opacity: 0.6 }} />
                    }}
                    sx={{ 
                      minWidth: 250,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: theming.colors.primary,
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: theming.colors.primary,
                        },
                      },
                    }}
                  />
                  
                  <FormControl size="small" sx={{ minWidth: 150}}>
                    <InputLabel>Kategori</InputLabel>
                    <Select 
                      label="Kategori" 
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as string)}
                    >
                      <MenuItem value="">Alle</MenuItem>
                      {getCategoryOptions().map(category => (
                        <MenuItem key={category} value={category}>{category}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 120}}>
                    <InputLabel>Status</InputLabel>
                    <Select 
                      label="Status" 
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as string)}
                    >
                      <MenuItem value="">Alle</MenuItem>
                      <MenuItem value="draft">Utkast</MenuItem>
                      <MenuItem value="published">Publisert</MenuItem>
                      <MenuItem value="archived">Arkivert</MenuItem>
                    </Select>
                  </FormControl>

                  <ToggleButtonGroup 
                    size="small" 
                    exclusive
                    value={viewMode}
                    onChange={(_, newMode) => newMode && setViewMode(newMode)}
                  >
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
                <Grid item xs={12} sm={6} md={4}>
                  <Card 
                    sx={{ 
                      height: 200, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      border: `2px dashed ${alpha(theming.colors.primary, 0.4)}`,
                      backgroundColor: alpha(theming.colors.primary, 0.03),
                      cursor: showcaseCreationAccess?.hasAccess ? 'pointer' : 'not-allowed',
                      opacity: showcaseCreationAccess?.hasAccess ? 1 : 0.6,
                      borderRadius: 3,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        backgroundColor: showcaseCreationAccess?.hasAccess
                          ? alpha(theming.colors.primary, 0.08)
                          : alpha(theming.colors.primary, 0.03),
                        borderColor: showcaseCreationAccess?.hasAccess
                          ? theming.colors.primary
                          : alpha(theming.colors.primary, 0.4),
                        transform: showcaseCreationAccess?.hasAccess ? 'translateY(-4px)' : 'none',
                        boxShadow: showcaseCreationAccess?.hasAccess
                          ? `0 8px 24px ${alpha(theming.colors.primary, 0.2)}`
                          : 'none',
                      }
                    }}
                    onClick={() => {
                      if (!showcaseCreationAccess?.hasAccess) {
                        showNotification(showcaseCreationAccess?.reason || 'Du har ikke tilgang.', 'warning');
                        return;
                      }
                      setOpenDialog('new-showcase');
                      integration?.emit?.('showcase:create-start', { source: 'showcase-admin', timestamp: Date.now() });
                    }}
                  >
                    <Box textAlign="center">
                      <Avatar sx={{ bgcolor: alpha(theming.colors.primary, 0.1), color: theming.colors.primary, mx: 'auto', mb: 2, width: 56, height: 56 }}>
                        <AddIcon sx={{ fontSize: 28 }} />
                      </Avatar>
                      <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600 }}>
                        Lag ny {terms.showcase.toLowerCase()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Vis frem ditt beste arbeid
                      </Typography>
                    </Box>
                  </Card>
                </Grid>

                {/* Real Showcases from PostgreSQL - NO MOCK DATA */}
	                {filteredShowcases && filteredShowcases.length > 0 ? (
	                  filteredShowcases.map((showcase: any) => (
	                    <Grid item xs={12} sm={6} md={4} key={showcase.id}>
	                      <Card
                        onClick={() => {
                          setSelectedShowcase(showcase);
                          if (previewMode) {
                            handlePreviewShowcase(showcase);
                          }
                        }}
                        sx={{ 
                          height: '100%', 
                          position: 'relative',
                          borderRadius: 3,
                          overflow: 'hidden',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                          border: selectedShowcase?.id === showcase.id
                            ? `2px solid ${theming.colors.primary}`
                            : `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: `0 12px 28px ${alpha(theming.colors.primary, 0.15)}`,
                          },
                        }}>
	                        <CardMedia
	                          component="img"
	                          height="200"
	                          image={showcase.images?.[0]?.url || showcase.thumbnailUrl || 'https://picsum.photos/400/300?random=' + showcase.id}
	                          alt={showcase.title}
	                          sx={{ objectFit: 'cover' }}
	                        />
	                        <CardContent sx={{ p: 2 }}>
                          <Typography variant="h6" noWrap sx={{ color: theming.colors.primary, fontWeight: 600 }}>
                            {showcase.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 1.5 }}>
                            {showcase.description}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            {showcase.tags?.slice(0, 3).map((tag: string) => (
                              <Chip 
                                key={tag} 
                                size="small" 
                                label={tag}
                                sx={{ 
                                  height: 24,
                                  fontSize: '0.75rem',
                                  bgcolor: alpha(theming.colors.primary, 0.1),
                                  color: theming.colors.primary,
                                }}
                              />
                            ))}
                            {showcase.isFeatured && (
                              <Chip 
                                size="small" 
                                icon={<StarIcon sx={{ fontSize: 14 }} />}
                                label="Featured"
                                sx={{ 
                                  height: 24,
                                  bgcolor: alpha('#ff9800', 0.15),
                                  color: '#ff9800',
                                }}
                              />
                            )}
	                          </Box>
	                        </CardContent>
	                        <CardActions sx={{ 
                            position: 'absolute', 
                            top: 8, 
                            right: 8,
                            display: 'flex',
                            gap: 0.5,
                          }}>
	                          <IconButton
	                            size="small"
                              onClick={() => { setEditingShowcase(showcase); setOpenDialog('edit-showcase'); }}
	                            sx={{ 
                                bgcolor: alpha(theming.colors.primary, 0.9), 
                                color: 'white',
                                backdropFilter: 'blur(8px)',
                                '&:hover': { bgcolor: theming.colors.primary },
                              }}
	                          >
	                            <EditIcon fontSize="small" />
	                          </IconButton>
	                          <IconButton
	                            size="small"
                              onClick={() => handlePreviewShowcase(showcase)}
	                            sx={{ 
                                bgcolor: alpha('#2196f3', 0.9), 
                                color: 'white',
                                backdropFilter: 'blur(8px)',
                                '&:hover': { bgcolor: '#2196f3' },
                              }}
	                          >
	                            <VisibilityIcon fontSize="small" />
	                          </IconButton>
                            {showcaseManagementAccess?.hasAccess && (
                              <IconButton
                                size="small"
                                onClick={() => { setShowcaseToDelete(showcase); setDeleteConfirmOpen(true); }}
                                sx={{ 
                                  bgcolor: alpha('#f44336', 0.9), 
                                  color: 'white',
                                  backdropFilter: 'blur(8px)',
                                  '&:hover': { bgcolor: '#f44336' },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
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
	                        background: `linear-gradient(135deg, ${alpha(theming.colors.primary, 0.03)} 0%, ${alpha(theming.colors.secondary, 0.03)} 100%)`,
	                        border: `2px dashed ${alpha(theming.colors.primary, 0.2)}`,
                          borderRadius: 3,
                        }}
	                    >
                      <Avatar 
                        sx={{ 
                          width: 80, 
                          height: 80, 
                          bgcolor: alpha(theming.colors.primary, 0.1),
                          color: theming.colors.primary,
                          mx: 'auto',
                          mb: 2,
                        }}
                      >
                        <PhotoLibraryIcon sx={{ fontSize: 40 }} />
                      </Avatar>
                      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 600 }}>
                        Ingen {terms.showcase.toLowerCase()}s ennå
                      </Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
                        Lag din første {terms.showcase.toLowerCase()} for å vise frem ditt arbeid til kunder og samarbeidspartnere
                      </Typography>
                      <Button 
                        variant="contained"
                        size="large"
                        startIcon={<AddIcon />}
                        onClick={() => setOpenDialog('new-showcase')}
                        sx={{
                          bgcolor: theming.colors.primary,
                          px: 4,
                          py: 1.5,
                          borderRadius: 2,
                          fontWeight: 600,
                          textTransform: 'none',
                          boxShadow: `0 8px 24px ${alpha(theming.colors.primary, 0.35)}`,
                          '&:hover': {
                            bgcolor: theming.colors.secondary,
                            transform: 'translateY(-2px)',
                          },
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
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 600 }}>
              <Avatar sx={{ bgcolor: alpha(theming.colors.primary, 0.1), color: theming.colors.primary }}>
                <PaletteIcon />
              </Avatar>
              Design-maler for {profession}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Tilpass utseendet på dine showcases med maler, farger og typografi
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${alpha(theming.colors.primary, 0.1)}`, ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ViewModuleIcon sx={{ fontSize: 20 }} />
                  Layout-innstillinger
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500, mb: 1.5 }}>Layout-stil</Typography>
                  <Grid container spacing={1.5}>
                    {layoutStyles.map(style => (
                      <Grid item xs={4} key={style.value}>
                        <Card 
                          sx={{ 
                            p: 2, 
                            textAlign: 'center', 
                            cursor: 'pointer',
                            borderRadius: 2,
                            transition: 'all 0.2s ease',
                            border: templateForm.layoutConfig.style === style.value ? 
                              `2px solid ${theming.colors.primary}` : `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                            bgcolor: templateForm.layoutConfig.style === style.value ? 
                              alpha(theming.colors.primary, 0.05) : 'transparent',
                            '&:hover': {
                              borderColor: theming.colors.primary,
                              transform: 'translateY(-2px)',
                              boxShadow: `0 4px 12px ${alpha(theming.colors.primary, 0.15)}`,
                            }
                          }}
                          onClick={() => setTemplateForm(prev => ({
                            ...prev,
                            layoutConfig: { ...prev.layoutConfig, style: style.value as any }
                          }))}
                        >
                          <Box sx={{ color: theming.colors.primary }}>{style.icon}</Box>
                          <Typography variant="caption" display="block" sx={{ mt: 1, fontWeight: 500 }}>
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

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${alpha(theming.colors.primary, 0.1)}`, ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PaletteIcon sx={{ fontSize: 20 }} />
                  Farger og typografi
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500, mb: 1.5 }}>Fargeskjema</Typography>
                  <Grid container spacing={1.5}>
                    {colorSchemes.map(scheme => (
                      <Grid item xs={6} key={scheme.value}>
                        <Card 
                          sx={{ 
                            p: 2, 
                            cursor: 'pointer',
                            borderRadius: 2,
                            transition: 'all 0.2s ease',
                            border: templateForm.designSettings.colorScheme === scheme.value ? 
                              `2px solid ${theming.colors.primary}` : `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                            bgcolor: templateForm.designSettings.colorScheme === scheme.value ? 
                              alpha(theming.colors.primary, 0.05) : 'transparent',
                            '&:hover': {
                              borderColor: theming.colors.primary,
                              transform: 'translateY(-2px)',
                            }
                          }}
                          onClick={() => setTemplateForm(prev => ({
                            ...prev,
                            designSettings: { ...prev.designSettings, colorScheme: scheme.value as any }
                          }))}
                        >
                          <Box 
                            sx={{ 
                              height: 48, 
                              borderRadius: 1.5,
                              background: scheme.preview,
                              mb: 1.5,
                              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                            }}
                          />
                          <Typography variant="caption" textAlign="center" display="block" sx={{ fontWeight: 500 }}>
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

            {/* Saved Templates Section */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${alpha(theming.colors.primary, 0.1)}`, ...theming.getThemedCardSx() }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CollectionsIcon sx={{ fontSize: 20 }} />
                    Lagrede maler
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setOpenDialog('new-template')}
                    sx={{
                      background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
                      borderRadius: 2,
                    }}
                  >
                    Ny mal
                  </Button>
                </Box>
                
                {templatesLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <LinearProgress sx={{ width: '50%' }} />
                  </Box>
                ) : templates && templates.length > 0 ? (
                  <Grid container spacing={2}>
                    {templates.map((template: any) => (
                      <Grid item xs={12} sm={6} md={4} key={template.id}>
                        <Card sx={{ 
                          borderRadius: 2,
                          border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: theming.colors.primary,
                            boxShadow: `0 4px 12px ${alpha(theming.colors.primary, 0.15)}`,
                          },
                        }}>
                          <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                                {template.name}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <IconButton 
                                  size="small"
                                  onClick={() => { setEditingTemplate(template); setOpenDialog('edit-template'); }}
                                  sx={{ color: theming.colors.primary }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton 
                                  size="small"
                                  onClick={() => { setTemplateToDelete(template); setTemplateDeleteConfirmOpen(true); }}
                                  sx={{ color: '#f44336' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                              {template.description || 'Ingen beskrivelse'}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip 
                                size="small" 
                                label={template.layoutConfig?.style || 'grid'}
                                sx={{ bgcolor: alpha(theming.colors.primary, 0.1), color: theming.colors.primary }}
                              />
                              <Chip 
                                size="small" 
                                label={`${template.layoutConfig?.columns || 3} kolonner`}
                                sx={{ bgcolor: alpha(theming.colors.secondary, 0.1), color: theming.colors.secondary }}
                              />
                            </Box>
                          </CardContent>
                          <CardActions sx={{ px: 2, pb: 2 }}>
                            <Button 
                              size="small" 
                              fullWidth
                              variant="outlined"
                              onClick={() => {
                                setTemplateForm(template);
                                setShowcaseForm((prev) => ({
                                  ...prev,
                                  displayConfig: {
                                    ...prev.displayConfig,
                                    template: template.name || prev.displayConfig.template,
                                  },
                                }));
                                setOpenDialog('new-showcase');
                                showNotification(`Malen "${template.name}" er lagt inn i ny showcase.`, 'success');
                              }}
                              sx={{ borderRadius: 2, borderColor: theming.colors.primary, color: theming.colors.primary }}
                            >
                              Bruk denne malen
                            </Button>
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Avatar sx={{ width: 64, height: 64, bgcolor: alpha(theming.colors.primary, 0.1), color: theming.colors.primary, mx: 'auto', mb: 2 }}>
                      <PaletteIcon sx={{ fontSize: 32 }} />
                    </Avatar>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Ingen maler ennå
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Opprett din første mal for å gjenbruke design på tvers av showcases
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => setOpenDialog('new-template')}
                      sx={{
                        background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
                        borderRadius: 2,
                      }}
                    >
                      Opprett første mal
                    </Button>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Batch Operations Tab - FASE 3 */}
        <TabPanel value={currentTab} index={3}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 600 }}>
              <Avatar sx={{ bgcolor: alpha(theming.colors.primary, 0.1), color: theming.colors.primary }}>
                <SpeedIcon />
              </Avatar>
              Batch Operasjoner
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Utfør operasjoner på flere {terms.media.toLowerCase()} samtidig for økt produktivitet
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {/* Selection Controls */}
            <Grid item xs={12}>
              <Paper sx={{ 
                p: 3, 
                mb: 0, 
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha(theming.colors.primary, 0.08)}, ${alpha(theming.colors.secondary, 0.08)})`,
                border: `1px solid ${alpha(theming.colors.primary, 0.15)}`,
                ...theming.getThemedCardSx() 
              }}>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600 }}>Valgte elementer</Typography>
                    <Chip 
                      label={`${selectedItems.length} valgt`}
                      color={selectedItems.length > 0 ? "primary" : "default"}
                      size="medium"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                  
                  <Stack direction="row" spacing={1.5}>
                    <Tooltip title={selectedItems.length === 0 ? "Velg elementer først" : "Fjern alle valgte elementer"} arrow>
                      <span>
                        <Button 
                          size="small" 
                          onClick={() => setSelectedItems([])}
                          disabled={selectedItems.length === 0}
                          sx={{ borderRadius: 2 }}
                        >
                          Fjern valg
                        </Button>
                      </span>
                    </Tooltip>
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => setBulkEditMode(!bulkEditMode)}
                      sx={{ 
                        borderRadius: 2,
                        borderColor: theming.colors.primary,
                        color: theming.colors.primary,
                        '&:hover': {
                          borderColor: theming.colors.primary,
                          bgcolor: alpha(theming.colors.primary, 0.08),
                        }
                      }}
                    >
                      {bulkEditMode ? 'Avslutt' : 'Start'} massevalg
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>

            {/* Batch Operation Controls */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${alpha(theming.colors.primary, 0.1)}`, ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, fontWeight: 600 }}>
                  <TuneIcon sx={{ fontSize: 20 }} />
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
                    <MenuItem value="publish"><CampaignIcon fontSize="small" sx={{ mr: 1 }} /> Publiser alle</MenuItem>
                    <MenuItem value="unpublish"><LockIcon fontSize="small" sx={{ mr: 1 }} /> Avpubliser alle</MenuItem>
                    <MenuItem value="archive"><ArchiveIcon fontSize="small" sx={{ mr: 1 }} /> Arkiver alle</MenuItem>
                    <MenuItem value="delete"><DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Slett alle</MenuItem>
                    <MenuItem value="add-watermark"><TagIcon fontSize="small" sx={{ mr: 1 }} /> Legg til vannmerke</MenuItem>
                    <MenuItem value="bulk-photo-enhance"><PaletteIcon fontSize="small" sx={{ mr: 1 }} /> Forbedre bilder (CreatorHub AI)</MenuItem>
                    <MenuItem value="resize"><AspectRatioIcon fontSize="small" sx={{ mr: 1 }} /> Endre størrelse</MenuItem>
                    <MenuItem value="compress"><CompressIcon fontSize="small" sx={{ mr: 1 }} /> Komprimer</MenuItem>
                    <MenuItem value="add-tags"><TagIcon fontSize="small" sx={{ mr: 1 }} /> Legg til tags</MenuItem>
                    <MenuItem value="change-category"><FolderIcon fontSize="small" sx={{ mr: 1 }} /> Endre kategori</MenuItem>
                    <MenuItem value="export"><DownloadIcon fontSize="small" sx={{ mr: 1 }} /> Eksporter</MenuItem>
                  </Select>
                </FormControl>

                {batchOperation === 'bulk-photo-enhance' ? (
                  <Tooltip title={selectedItems.length === 0 ? "Velg bilder å forbedre først" : `Forbedre ${selectedItems.length} bilder med AI`} arrow>
                    <span style={{ width: '100%' }}>
                      <Button variant="contained"
                        fullWidth
                        size="large"
                        disabled={selectedItems.length === 0}
                        onClick={handleBulkPhotoEnhancement}
                        sx={{
                          py: 1.5,
                          background: `linear-gradient(135deg, #FF6B35, #F7931E)`,
                          boxShadow: '0 4px 15px rgba(255, 107, 53, 0.3)',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 6px 20px rgba(255, 107, 53, 0.4)',
                          },
                          ...theming.getThemedButtonSx()
                        }}>
                        <PaletteIcon sx={{ mr: 1 }} /> Forbedre {selectedItems.length} bilder med AI
                      </Button>
                    </span>
                  </Tooltip>
                ) : (
                  <Tooltip 
                    title={
                      !batchOperation && selectedItems.length === 0 
                        ? "Velg en operasjon og elementer først" 
                        : !batchOperation 
                          ? "Velg en operasjon fra menyen" 
                          : selectedItems.length === 0 
                            ? "Velg elementer å utføre operasjonen på" 
                            : `Utfør ${batchOperation} på ${selectedItems.length} elementer`
                    } 
                    arrow
                  >
                    <span style={{ width: '100%' }}>
                      <Button variant="contained"
                        fullWidth
                        size="large"
                        disabled={!batchOperation || selectedItems.length === 0}
                        onClick={() => executeBatchOperation(batchOperation)}
                        sx={{
                          py: 1.5,
                          background: `linear-gradient(135deg, ${theming.colors.primary}, ${theming.colors.secondary})`,
                          boxShadow: `0 4px 15px ${alpha(theming.colors.primary, 0.3)}`,
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: `0 6px 20px ${alpha(theming.colors.primary, 0.4)}`,
                          }
                        }}
                      >
                        Utfør operasjon på {selectedItems.length} elementer
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </Paper>
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${alpha(theming.colors.primary, 0.1)}`, height: '100%', ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, fontWeight: 600 }}>
                  <SpeedIcon sx={{ fontSize: 20 }} />
                  Hurtighandlinger
                </Typography>
                
                <Stack spacing={1}>
                  {[
                    { action: 'select-all-featured', label: 'Velg alle utvalgte', icon: <StarIcon /> },
                    { action: 'select-all-recent', label: 'Velg alle fra siste uke', icon: <DateRangeIcon /> },
                    { action: 'select-by-rating', label: 'Velg etter vurdering (4+ stjerner)', icon: <StarIcon /> },
                    { action: 'select-unpublished', label: 'Velg alle utkast', icon: <EditIcon /> }
                  ].map((quickAction) => (
                    <Button
                      key={quickAction.action}
                      variant="outlined"
                      fullWidth
                      startIcon={quickAction.icon}
                      onClick={() => handleQuickAction(quickAction.action)}
                      sx={{ 
                        justifyContent: 'flex-start', 
                        textTransform: 'none',
                        borderColor: alpha(theming.colors.primary, 0.3),
                        color: theming.colors.primary,
                        '&:hover': {
                          borderColor: theming.colors.primary,
                          bgcolor: alpha(theming.colors.primary, 0.05),
                        }
                      }}
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
                            sx={{ position: 'absolute', top: 4, right: 4, bgcolor: alpha('#f44336', 0.9), color: 'white', '&:hover': { bgcolor: '#f44336' } }}
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
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 600 }}>
              <Avatar sx={{ bgcolor: alpha(theming.colors.primary, 0.1), color: theming.colors.primary }}>
                <AutoFixIcon />
              </Avatar>
              Smart Albums
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Opprett intelligente album som automatisk oppdateres basert på kriterier du setter
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {/* Smart Album Templates - Now first for better UX */}
            <Grid item xs={12}>
              <Paper sx={{ 
                p: 3, 
                borderRadius: 3, 
                background: `linear-gradient(135deg, ${alpha(theming.colors.primary, 0.03)} 0%, ${alpha(theming.colors.secondary, 0.03)} 100%)`,
                border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                ...theming.getThemedCardSx() 
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, fontWeight: 600 }}>
                    <PaletteIcon sx={{ fontSize: 22 }} />
                    Hurtigstart med maler
                  </Typography>
                  <Chip 
                    label="Ett-klikk oppsett" 
                    size="small" 
                    sx={{ 
                      bgcolor: alpha(theming.colors.primary, 0.1), 
                      color: theming.colors.primary,
                      fontWeight: 500 
                    }} 
                  />
                </Box>
                
                <Grid container spacing={2}>
                  {[
                    { name: 'Årets beste', criteria: '4+ stjerner + siste år', icon: <TrophyIcon />, color: '#FFD700', bgGradient: 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)' },
                    { name: 'Bryllupsportretter', criteria: 'Bryllup + portrett kategori', icon: <FavoriteIcon />, color: '#E91E63', bgGradient: 'linear-gradient(135deg, #FCE4EC 0%, #F8BBD9 100%)' },
                    { name: 'Solnedganger', criteria: 'Utendørs + kveldstid', icon: <SunnyIcon />, color: '#FF9800', bgGradient: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)' },
                    { name: 'Kommersielle oppdrag', criteria: 'Kommersiell kategori', icon: <BusinessIcon />, color: '#607D8B', bgGradient: 'linear-gradient(135deg, #ECEFF1 0%, #CFD8DC 100%)' },
                    { name: 'Favorittlokasjoner', criteria: 'Ofte brukte steder', icon: <LocationOnIcon />, color: '#4CAF50', bgGradient: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)' }
                  ].map((template, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Card
                        sx={{
                          p: 0,
                          cursor: 'pointer',
                          borderRadius: 3,
                          border: `2px solid transparent`,
                          overflow: 'hidden',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            borderColor: template.color,
                            transform: 'translateY(-4px)',
                            boxShadow: `0 12px 24px ${alpha(template.color, 0.25)}`,
                          }
                        }}
                        onClick={() => {
                          setSmartAlbumCriteria(prev => ({ ...prev, name: template.name }));
                          console.log(`Applying template: ${template.name}`);
                        }}
                      >
                        <Box sx={{ 
                          background: template.bgGradient,
                          p: 2.5,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          gap: 1.5
                        }}>
                          <Avatar sx={{ 
                            bgcolor: 'white', 
                            width: 56, 
                            height: 56,
                            boxShadow: `0 4px 12px ${alpha(template.color, 0.3)}`
                          }}>
                            {React.cloneElement(template.icon, { sx: { color: template.color, fontSize: 28 } })}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ color: template.color }}>
                              {template.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              {template.criteria}
                            </Typography>
                          </Box>
                          <Button 
                            size="small" 
                            variant="outlined"
                            onClick={() => applySmartAlbumTemplate(template)}
                            sx={{ 
                              mt: 1,
                              borderColor: template.color,
                              color: template.color,
                              '&:hover': {
                                bgcolor: alpha(template.color, 0.1),
                                borderColor: template.color,
                              }
                            }}
                          >
                            Bruk mal
                          </Button>
                        </Box>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>

            {/* Create Smart Album - Custom */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ 
                p: 3, 
                borderRadius: 3,
                height: '100%',
                border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                ...theming.getThemedCardSx() 
              }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, fontWeight: 600 }}>
                  <AddIcon sx={{ fontSize: 22 }} />
                  Opprett egendefinert album
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Sett opp dine egne kriterier for automatisk sortering
                </Typography>
                
                <Stack spacing={2.5}>
                  <TextField
                    fullWidth
                    label="Album navn"
                    value={smartAlbumCriteria.name}
                    onChange={(e) => setSmartAlbumCriteria(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={`Mine beste ${terms.media.toLowerCase()}`}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      }
                    }}
                  />

                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: theming.colors.primary }}>
                      Minimum vurdering
                    </Typography>
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: alpha(theming.colors.primary, 0.04), 
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}>
                      <Rating
                        value={smartAlbumCriteria.rating}
                        onChange={(_, value) => setSmartAlbumCriteria(prev => ({ ...prev, rating: value || 0 }))}
                        size="large"
                        sx={{ 
                          '& .MuiRating-iconFilled': { color: theming.colors.primary }
                        }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {smartAlbumCriteria.rating > 0 ? `${smartAlbumCriteria.rating}+ stjerner` : 'Alle vurderinger'}
                      </Typography>
                    </Box>
                  </Box>

                  <Stack direction="row" spacing={2}>
                    <TextField
                      fullWidth
                      label="Lokasjon"
                      value={smartAlbumCriteria.location}
                      onChange={(e) => setSmartAlbumCriteria(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Oslo, Bergen..."
                      InputProps={{
                        startAdornment: <LocationOnIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <TextField
                      fullWidth
                      label="Kamera/utstyr"
                      value={smartAlbumCriteria.camera}
                      onChange={(e) => setSmartAlbumCriteria(prev => ({ ...prev, camera: e.target.value }))}
                      placeholder="Canon, Sony..."
                      InputProps={{
                        startAdornment: <CameraAltIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Stack>

                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: theming.colors.primary }}>
                      Datoområde
                    </Typography>
                    <Stack direction="row" spacing={2}>
                      <TextField
                        type="date"
                        label="Fra dato"
                        fullWidth
                        value={smartAlbumCriteria.dateRange.start}
                        onChange={(e) => setSmartAlbumCriteria(prev => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, start: e.target.value }
                      }))}
                        InputLabelProps={{ shrink: true }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                      <TextField
                        type="date"
                        label="Til dato"
                        fullWidth
                        value={smartAlbumCriteria.dateRange.end}
                        onChange={(e) => setSmartAlbumCriteria(prev => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, end: e.target.value }
                      }))}
                        InputLabelProps={{ shrink: true }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Stack>
                  </Box>

                  <Box sx={{ 
                    p: 2, 
                    bgcolor: alpha('#2196F3', 0.08), 
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Automatisk oppdatering
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Album oppdateres når nye elementer matcher
                      </Typography>
                    </Box>
                    <Switch
                      checked={smartAlbumCriteria.autoUpdate}
                      onChange={(e) => setSmartAlbumCriteria(prev => ({ ...prev, autoUpdate: e.target.checked }))}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: theming.colors.primary,
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: theming.colors.primary,
                        },
                      }}
                    />
                  </Box>

                  <Tooltip title={!smartAlbumCriteria.name ? "Skriv inn et navn for albumet først" : "Opprett smart album med valgte kriterier"} arrow>
                    <span style={{ width: '100%' }}>
                      <Button variant="contained"
                        fullWidth
                        size="large"
                        onClick={createSmartAlbum}
                        disabled={!smartAlbumCriteria.name}
                        startIcon={<AutoFixIcon />}
                        sx={{
                          py: 1.5,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '1rem',
                          background: `linear-gradient(135deg, ${theming.colors.primary}, ${theming.colors.secondary})`,
                          boxShadow: `0 4px 15px ${alpha(theming.colors.primary, 0.3)}`,
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: `0 6px 20px ${alpha(theming.colors.primary, 0.4)}`,
                          },
                          '&:disabled': {
                            background: 'rgba(0,0,0,0.12)',
                          },
                          ...theming.getThemedButtonSx()
                        }}>
                        Opprett Smart Album
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              </Paper>
            </Grid>

            {/* Existing Smart Albums */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ 
                p: 3, 
                borderRadius: 3,
                height: '100%',
                border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                ...theming.getThemedCardSx() 
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, fontWeight: 600 }}>
                    <CollectionsIcon sx={{ fontSize: 22 }} />
                    Dine Smart Albums
                  </Typography>
                  {smartAlbums.length > 0 && (
                    <Chip 
                      label={`${smartAlbums.length} album`} 
                      size="small" 
                      sx={{ 
                        bgcolor: alpha(theming.colors.primary, 0.1), 
                        color: theming.colors.primary,
                        fontWeight: 500 
                      }} 
                    />
                  )}
                </Box>
                
                {smartAlbums.length === 0 ? (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 6,
                    px: 3,
                    bgcolor: alpha(theming.colors.primary, 0.02),
                    borderRadius: 3,
                    border: `2px dashed ${alpha(theming.colors.primary, 0.15)}`
                  }}>
                    <Avatar sx={{ 
                      width: 72, 
                      height: 72, 
                      bgcolor: alpha(theming.colors.primary, 0.1),
                      mx: 'auto',
                      mb: 2
                    }}>
                      <AutoFixIcon sx={{ fontSize: 36, color: theming.colors.primary }} />
                    </Avatar>
                    <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600, mb: 1 }}>
                      Ingen smart albums ennå
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280, mx: 'auto' }}>
                      Velg en mal ovenfor eller opprett et egendefinert album for å komme i gang
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {smartAlbums.map((album, index) => (
                      <Card 
                        key={index}
                        sx={{ 
                          p: 0,
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: theming.colors.primary,
                            boxShadow: `0 4px 12px ${alpha(theming.colors.primary, 0.15)}`,
                          }
                        }}
                      >
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          p: 2,
                          gap: 2
                        }}>
                          <Avatar sx={{ 
                            bgcolor: alpha(theming.colors.primary, 0.1),
                            width: 48,
                            height: 48
                          }}>
                            <CollectionsIcon sx={{ color: theming.colors.primary }} />
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight="bold" noWrap>
                              {album.name}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2" color="text.secondary">
                                {album.itemCount || 0} elementer
                              </Typography>
                              <Chip
                                size="small"
                                label={album.autoUpdate ? 'Auto' : 'Manuell'}
                                sx={{
                                  height: 20,
                                  fontSize: '0.7rem',
                                  bgcolor: album.autoUpdate ? alpha('#4CAF50', 0.1) : alpha('#9E9E9E', 0.1),
                                  color: album.autoUpdate ? '#4CAF50' : '#9E9E9E',
                                }}
                              />
                            </Stack>
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => updateSmartAlbum(album.id)}
                              title="Oppdater album"
                              sx={{ 
                                color: theming.colors.primary,
                                '&:hover': { bgcolor: alpha(theming.colors.primary, 0.1) }
                              }}
                            >
                              <AutoFixIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              title="Rediger"
                              sx={{ 
                                color: 'text.secondary',
                                '&:hover': { bgcolor: alpha(theming.colors.primary, 0.1) }
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Box>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Collections Tab */}
        <TabPanel value={currentTab} index={2}>
          {/* Header with gradient background */}
          <Paper 
            sx={{ 
              p: 3, 
              mb: 3, 
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theming.colors.primary, 0.08)} 0%, ${alpha(theming.colors.secondary, 0.08)} 100%)`,
              border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ 
                  bgcolor: theming.colors.primary, 
                  color: 'white',
                  width: 56, 
                  height: 56,
                  boxShadow: `0 4px 14px ${alpha(theming.colors.primary, 0.4)}`,
                }}>
                  <CollectionsIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                    {terms.collection}er
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Organiser og grupper dine showcases i tematiske samlinger
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenDialog('new-collection')}
                sx={{
                  px: 3,
                  py: 1.2,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
                  boxShadow: `0 4px 15px ${alpha(theming.colors.primary, 0.3)}`,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 6px 20px ${alpha(theming.colors.primary, 0.4)}`,
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                Ny {terms.collection.toLowerCase()}
              </Button>
            </Box>
          </Paper>

          {/* Quick Stats Row */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ 
                p: 2, 
                textAlign: 'center', 
                borderRadius: 2,
                border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
              }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                  {collections?.length || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">Samlinger</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ 
                p: 2, 
                textAlign: 'center', 
                borderRadius: 2,
                border: `1px solid ${alpha('#4caf50', 0.1)}`,
              }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#4caf50' }}>
                  {collections?.reduce((acc: number, c: any) => acc + (c.showcaseCount || 0), 0) || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">Totalt showcases</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ 
                p: 2, 
                textAlign: 'center', 
                borderRadius: 2,
                border: `1px solid ${alpha('#2196f3', 0.1)}`,
              }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#2196f3' }}>
                  {collections?.filter((c: any) => c.isPublic).length || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">Offentlige</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ 
                p: 2, 
                textAlign: 'center', 
                borderRadius: 2,
                border: `1px solid ${alpha('#ff9800', 0.1)}`,
              }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#ff9800' }}>
                  {collections?.filter((c: any) => c.isFeatured).length || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">Fremhevet</Typography>
              </Paper>
            </Grid>
          </Grid>
          
          <Grid container spacing={3}>
            {/* Real Collections from PostgreSQL - NO MOCK DATA */}
            {collections && collections.length > 0 ? (
              collections.map((collection: any, index: number) => (
                <Grid item xs={12} sm={6} md={4} key={collection.id}>
                  <Card sx={{ 
                    height: '100%', 
                    borderRadius: 3, 
                    overflow: 'hidden',
                    border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: `0 20px 40px ${alpha(theming.colors.primary, 0.2)}`,
                      '& .collection-overlay': {
                        opacity: 1,
                      },
                      '& .collection-image': {
                        transform: 'scale(1.05)',
                      },
                    },
                    ...theming.getThemedCardSx() 
                  }}>
                    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                      <CardMedia
                        component="img"
                        height="180"
                        image={collection.coverImage || `https://picsum.photos/400/300?random=${index}`}
                        alt={collection.name}
                        className="collection-image"
                        sx={{ 
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease',
                        }}
                      />
                      {/* Overlay on hover */}
                      <Box 
                        className="collection-overlay"
                        sx={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          right: 0, 
                          bottom: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)',
                          opacity: 0,
                          transition: 'opacity 0.3s ease',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          pb: 2,
                          gap: 1,
                        }}
                      >
                        <IconButton 
                          size="small" 
                          onClick={() => { setEditingCollection(collection); setOpenDialog('edit-collection'); }}
                          sx={{ bgcolor: theming.colors.primary, color: 'white', '&:hover': { bgcolor: theming.colors.primary, transform: 'scale(1.1)' } }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => { setSelectedCollectionForAssignment(collection); setAssignShowcaseDialogOpen(true); }}
                          sx={{ bgcolor: '#2196f3', color: 'white', '&:hover': { bgcolor: '#2196f3', transform: 'scale(1.1)' } }}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => window.open(`/collections/${collection.id}`, '_blank')}
                          sx={{ bgcolor: theming.colors.secondary, color: 'white', '&:hover': { bgcolor: theming.colors.secondary, transform: 'scale(1.1)' } }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => { setCollectionToDelete(collection); setCollectionDeleteConfirmOpen(true); }}
                          sx={{ bgcolor: '#f44336', color: 'white', '&:hover': { bgcolor: '#f44336', transform: 'scale(1.1)' } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      {/* Badge */}
                      {collection.isFeatured && (
                        <Chip 
                          size="small" 
                          icon={<StarIcon sx={{ fontSize: 14, color: '#ff9800 !important' }} />}
                          label="Fremhevet"
                          sx={{ 
                            position: 'absolute', 
                            top: 12, 
                            right: 12,
                            bgcolor: alpha('#ff9800', 0.15),
                            color: '#ff9800',
                            fontWeight: 600,
                            backdropFilter: 'blur(8px)',
                            border: `1px solid ${alpha('#ff9800', 0.3)}`,
                          }}
                        />
                      )}
                    </Box>
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography variant="h6" noWrap sx={{ color: theming.colors.primary, fontWeight: 700, mb: 0.5 }}>
                        {collection.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {collection.description || 'Ingen beskrivelse'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Chip 
                          size="small" 
                          icon={<PhotoLibraryIcon sx={{ fontSize: 14 }} />}
                          label={`${collection.showcaseCount || 0} showcases`}
                          sx={{ 
                            bgcolor: alpha(theming.colors.primary, 0.1),
                            color: theming.colors.primary,
                            fontWeight: 500,
                          }}
                        />
                        <Chip 
                          size="small" 
                          label={collection.isPublic ? 'Offentlig' : 'Privat'}
                          sx={{ 
                            bgcolor: collection.isPublic ? alpha('#4caf50', 0.1) : alpha('#9e9e9e', 0.1),
                            color: collection.isPublic ? '#4caf50' : '#9e9e9e',
                            fontWeight: 500,
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Paper 
                  sx={{ 
                    p: 8, 
                    textAlign: 'center',
                    borderRadius: 4,
                    background: `linear-gradient(135deg, ${alpha(theming.colors.primary, 0.04)} 0%, ${alpha(theming.colors.secondary, 0.04)} 100%)`,
                    border: `2px dashed ${alpha(theming.colors.primary, 0.2)}`,
                    ...theming.getThemedCardSx()
                  }}>
                  <Box 
                    sx={{ 
                      width: 120, 
                      height: 120, 
                      borderRadius: '50%',
                      bgcolor: alpha(theming.colors.primary, 0.08),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 3,
                    }}
                  >
                    <CollectionsIcon sx={{ fontSize: 56, color: theming.colors.primary, opacity: 0.7 }} />
                  </Box>
                  <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 700 }}>
                    Ingen {terms.collection.toLowerCase()}er ennå
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
                    Samlinger hjelper deg å organisere og presentere showcases på en profesjonell måte
                  </Typography>
                  <Stack direction="row" spacing={2} justifyContent="center">
                    <Button 
                      variant="contained"
                      size="large"
                      startIcon={<AddIcon />}
                      onClick={() => setOpenDialog('new-collection')}
                      sx={{
                        px: 4,
                        py: 1.5,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '1rem',
                        background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
                        boxShadow: `0 8px 25px ${alpha(theming.colors.primary, 0.35)}`,
                        '&:hover': {
                          transform: 'translateY(-3px)',
                          boxShadow: `0 12px 35px ${alpha(theming.colors.primary, 0.45)}`,
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Opprett din første samling
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => setOpenDialog('learn-collections')}
                      startIcon={<Lightbulb />}
                      sx={{
                        px: 3,
                        py: 1.5,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: alpha(theming.colors.primary, 0.3),
                        color: theming.colors.primary,
                        '&:hover': {
                          borderColor: theming.colors.primary,
                          bgcolor: alpha(theming.colors.primary, 0.05),
                        },
                      }}
                    >
                      Lær mer
                    </Button>
                  </Stack>
                </Paper>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={currentTab} index={5}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 600 }}>
              <Avatar sx={{ bgcolor: alpha(theming.colors.primary, 0.1), color: theming.colors.primary }}>
                <AnalyticsIcon />
              </Avatar>
              Statistikk og analyse
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Få innsikt i hvordan dine showcases presterer
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ 
                p: 3, 
                textAlign: 'center', 
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha(theming.colors.primary, 0.1)} 0%, ${alpha(theming.colors.primary, 0.05)} 100%)`,
                border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                ...theming.getThemedCardSx() 
              }}>
                <Avatar sx={{ bgcolor: alpha(theming.colors.primary, 0.15), color: theming.colors.primary, mx: 'auto', mb: 1.5, width: 56, height: 56 }}>
                  <VisibilityIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>
                  {analyticsData?.totalViews?.toLocaleString() || '0'}
                </Typography>
                <Typography variant="body2" color="text.secondary">Totale visninger</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ 
                p: 3, 
                textAlign: 'center', 
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha('#4caf50', 0.1)} 0%, ${alpha('#4caf50', 0.05)} 100%)`,
                border: `1px solid ${alpha('#4caf50', 0.1)}`,
                ...theming.getThemedCardSx() 
              }}>
                <Avatar sx={{ bgcolor: alpha('#4caf50', 0.15), color: '#4caf50', mx: 'auto', mb: 1.5, width: 56, height: 56 }}>
                  <ThumbUpIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Typography variant="h4" fontWeight="bold" sx={{ color: '#4caf50' }}>
                  {analyticsData?.totalLikes?.toLocaleString() || '0'}
                </Typography>
                <Typography variant="body2" color="text.secondary">Likes</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ 
                p: 3, 
                textAlign: 'center', 
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha('#2196f3', 0.1)} 0%, ${alpha('#2196f3', 0.05)} 100%)`,
                border: `1px solid ${alpha('#2196f3', 0.1)}`,
                ...theming.getThemedCardSx() 
              }}>
                <Avatar sx={{ bgcolor: alpha('#2196f3', 0.15), color: '#2196f3', mx: 'auto', mb: 1.5, width: 56, height: 56 }}>
                  <ShareIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Typography variant="h4" fontWeight="bold" sx={{ color: '#2196f3' }}>
                  {analyticsData?.totalShares?.toLocaleString() || '0'}
                </Typography>
                <Typography variant="body2" color="text.secondary">Delinger</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ 
                p: 3, 
                textAlign: 'center', 
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha('#ff9800', 0.1)} 0%, ${alpha('#ff9800', 0.05)} 100%)`,
                border: `1px solid ${alpha('#ff9800', 0.1)}`,
                ...theming.getThemedCardSx() 
              }}>
                <Avatar sx={{ bgcolor: alpha('#ff9800', 0.15), color: '#ff9800', mx: 'auto', mb: 1.5, width: 56, height: 56 }}>
                  <CommentIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Typography variant="h4" fontWeight="bold" sx={{ color: '#ff9800' }}>
                  {analyticsData?.totalComments?.toLocaleString() || '0'}
                </Typography>
                <Typography variant="body2" color="text.secondary">Kommentarer</Typography>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel value={currentTab} index={6}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 600 }}>
              <Avatar sx={{ bgcolor: alpha(theming.colors.primary, 0.1), color: theming.colors.primary }}>
                <SettingsIcon />
              </Avatar>
              Globale innstillinger
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Konfigurer standardinnstillinger for alle dine showcases
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${alpha(theming.colors.primary, 0.1)}`, ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <VisibilityIcon sx={{ fontSize: 20 }} />
                  Standard visningsinnstillinger
                </Typography>
                
                <Stack spacing={1.5}>
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={globalSettings.defaultShowMetadata} 
                        onChange={(e) => setGlobalSettings(prev => ({ ...prev, defaultShowMetadata: e.target.checked }))}
                        color="primary" 
                      />
                    }
                    label="Vis metadata som standard"
                    sx={{ 
                      m: 0, 
                      p: 1.5, 
                      borderRadius: 2, 
                      bgcolor: alpha(theming.colors.primary, 0.03),
                      '&:hover': { bgcolor: alpha(theming.colors.primary, 0.06) }
                    }}
                  />
	                  <FormControlLabel
	                    control={
                        <Switch 
                          checked={globalSettings.defaultShowStats} 
                          onChange={(e) => setGlobalSettings(prev => ({ ...prev, defaultShowStats: e.target.checked }))}
                          color="primary" 
                        />
                      }
	                    label="Vis statistikk som standard"
                    sx={{ 
                      m: 0, 
                      p: 1.5, 
                      borderRadius: 2, 
                      bgcolor: alpha(theming.colors.primary, 0.03),
                      '&:hover': { bgcolor: alpha(theming.colors.primary, 0.06) }
                    }}
	                  />
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={globalSettings.defaultEnableComments} 
                        onChange={(e) => setGlobalSettings(prev => ({ ...prev, defaultEnableComments: e.target.checked }))}
                        color="primary" 
                      />
                    }
                    label="Aktiver kommentarer som standard"
                    sx={{ 
                      m: 0, 
                      p: 1.5, 
                      borderRadius: 2, 
                      bgcolor: alpha(theming.colors.primary, 0.03),
                      '&:hover': { bgcolor: alpha(theming.colors.primary, 0.06) }
                    }}
                  />
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={globalSettings.defaultEnableLikes} 
                        onChange={(e) => setGlobalSettings(prev => ({ ...prev, defaultEnableLikes: e.target.checked }))}
                        color="primary" 
                      />
                    }
                    label="Aktiver likes som standard"
                    sx={{ 
                      m: 0, 
                      p: 1.5, 
                      borderRadius: 2, 
                      bgcolor: alpha(theming.colors.primary, 0.03),
                      '&:hover': { bgcolor: alpha(theming.colors.primary, 0.06) }
                    }}
                  />
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={globalSettings.defaultEnableSharing} 
                        onChange={(e) => setGlobalSettings(prev => ({ ...prev, defaultEnableSharing: e.target.checked }))}
                        color="primary" 
                      />
                    }
                    label="Aktiver deling som standard"
                    sx={{ 
                      m: 0, 
                      p: 1.5, 
                      borderRadius: 2, 
                      bgcolor: alpha(theming.colors.primary, 0.03),
                      '&:hover': { bgcolor: alpha(theming.colors.primary, 0.06) }
                    }}
                  />
                </Stack>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${alpha(theming.colors.primary, 0.1)}`, ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <SearchIcon sx={{ fontSize: 20 }} />
                  SEO-innstillinger
                </Typography>
                
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Standard meta-beskrivelse"
                    multiline
                    rows={3}
                    placeholder="Beskrivelse som brukes for søkemotoroptimalisering..."
                    value={globalSettings.seoDescription}
                    onChange={(e) => setGlobalSettings(prev => ({ ...prev, seoDescription: e.target.value }))}
                  />
                  <TextField
                    fullWidth
                    label="Standard nøkkelord (kommaseparert)"
                    placeholder={`${profession}, Norge, ${terms.showcase.toLowerCase()}...`}
                    value={globalSettings.seoKeywords}
                    onChange={(e) => setGlobalSettings(prev => ({ ...prev, seoKeywords: e.target.value }))}
                  />
                </Stack>
              </Paper>
            </Grid>
            
            {/* Save Settings Button */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button 
                  variant="contained"
                  size="large"
                  onClick={handleSaveSettings}
                  sx={{
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
                    fontWeight: 600,
                    textTransform: 'none',
                    boxShadow: `0 8px 24px ${alpha(theming.colors.primary, 0.35)}`,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  Lagre innstillinger
                </Button>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={currentTab} index={showcaseViewerTabIndex}>
          {viewerContent ? (
            <Box sx={{ p: 0, minHeight: '70vh', overflow: 'hidden', borderRadius: 3 }}>
              {viewerContent}
            </Box>
          ) : (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              Showcase Viewer er ikke tilgjengelig i denne konteksten ennå.
            </Alert>
          )}
        </TabPanel>
      </Box>

      {/* Speed Dial for Quick Actions */}
      <SpeedDial
        ariaLabel="Showcase actions"
        sx={{ position: 'fixed', bottom:  20, right: 20}}
        icon={<SpeedDialIcon />}
      >
        {speedDialActions.map((action) => (
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
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">Media</Typography>
                <Tooltip
                  title={
                    mediaUploadAccess?.hasAccess
                      ? 'Last opp bilder eller video'
                      : (mediaUploadAccess?.reason || 'Du har ikke tilgang til opplasting.')
                  }
                  arrow
                >
                  <span>
                    <Button
                      variant="outlined"
                      component="label"
                      disabled={!mediaUploadAccess?.hasAccess || uploadingMedia}
                      sx={{
                        borderStyle: 'dashed',
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                      }}
                    >
                      Velg filer for opplasting
                      <input
                        type="file"
                        hidden
                        multiple
                        onChange={(e) => handleMediaUpload(e.target.files)}
                      />
                    </Button>
                  </span>
                </Tooltip>
                {uploadingMedia && (
                  <LinearProgress variant="determinate" value={uploadProgress} />
                )}
                {mediaFiles.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {mediaFiles.length} fil(er) valgt
                  </Typography>
                )}
              </Stack>
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
          <Tooltip title={!showcaseForm.title ? "Skriv inn en tittel for showcase" : "Opprett ny showcase"} arrow>
            <span>
              <Button 
                variant="contained" 
                onClick={handleCreateShowcase}
                disabled={!showcaseForm.title}
                sx={theming.getThemedButtonSx()}
              >
                Opprett showcase
              </Button>
            </span>
          </Tooltip>
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
          <PaletteIcon /> Bulk bildeforbedring med CreatorHub Photo Enhancer
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

      {/* Learn about Collections Dialog */}
      <Dialog 
        open={openDialog === 'learn-collections'}
        onClose={() => setOpenDialog(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
          }
        }}
      >
        <Box sx={{ 
          background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
          color: 'white',
          p: 4,
          textAlign: 'center',
        }}>
          <Avatar sx={{ 
            width: 80, 
            height: 80, 
            bgcolor: alpha(theming.colors.secondary, 0.3), 
            mx: 'auto', 
            mb: 2,
            backdropFilter: 'blur(10px)',
          }}>
            <CollectionsIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Hva er {terms.collection}er?
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Organiser og presenter ditt arbeid profesjonelt
          </Typography>
        </Box>
        
        <DialogContent sx={{ p: 4 }}>
          <Grid container spacing={3}>
            {/* Feature 1 */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ 
                p: 3, 
                height: '100%',
                borderRadius: 2,
                border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 25px ${alpha(theming.colors.primary, 0.15)}`,
                }
              }}>
                <Avatar sx={{ bgcolor: alpha('#4caf50', 0.1), color: '#4caf50', mb: 2 }}>
                  <ViewModuleIcon />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Organiser showcases
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Grupper relaterte showcases sammen i tematiske samlinger. Perfekt for å vise frem bryllupsbilder, portretter, produktfotografering og mer.
                </Typography>
              </Paper>
            </Grid>

            {/* Feature 2 */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ 
                p: 3, 
                height: '100%',
                borderRadius: 2,
                border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 25px ${alpha(theming.colors.primary, 0.15)}`,
                }
              }}>
                <Avatar sx={{ bgcolor: alpha('#2196f3', 0.1), color: '#2196f3', mb: 2 }}>
                  <ShareIcon />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Del enkelt
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Del hele samlinger med kunder via en unik lenke. Kunder kan bla gjennom og velge favorittbilder direkte.
                </Typography>
              </Paper>
            </Grid>

            {/* Feature 3 */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ 
                p: 3, 
                height: '100%',
                borderRadius: 2,
                border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 25px ${alpha(theming.colors.primary, 0.15)}`,
                }
              }}>
                <Avatar sx={{ bgcolor: alpha('#ff9800', 0.1), color: '#ff9800', mb: 2 }}>
                  <StarIcon />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Fremhev ditt beste
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Marker samlinger som "Fremhevet" for å vise dem øverst på profilen din. Perfekt for å fremheve nytt eller viktig arbeid.
                </Typography>
              </Paper>
            </Grid>

            {/* Feature 4 */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ 
                p: 3, 
                height: '100%',
                borderRadius: 2,
                border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 25px ${alpha(theming.colors.primary, 0.15)}`,
                }
              }}>
                <Avatar sx={{ bgcolor: alpha('#9c27b0', 0.1), color: '#9c27b0', mb: 2 }}>
                  <VisibilityIcon />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Kontroller synlighet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Velg om samlinger skal være offentlige eller private. Private samlinger er kun synlige for deg og de du deler lenken med.
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Tips Section */}
          <Box sx={{ 
            mt: 4, 
            p: 3, 
            borderRadius: 2, 
            bgcolor: alpha(theming.colors.primary, 0.05),
            border: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Lightbulb sx={{ color: '#ff9800' }} />
              Tips for bedre samlinger
            </Typography>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <CheckCircle sx={{ color: '#4caf50', fontSize: 20, mt: 0.3 }} />
                <Typography variant="body2" color="text.secondary">
                  <strong>Bruk beskrivende navn</strong> - "Bryllup: Anna & Erik 2025" er bedre enn "Bryllup 1"
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <CheckCircle sx={{ color: '#4caf50', fontSize: 20, mt: 0.3 }} />
                <Typography variant="body2" color="text.secondary">
                  <strong>Velg et godt coverbilde</strong> - Dette er det første kunder ser
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <CheckCircle sx={{ color: '#4caf50', fontSize: 20, mt: 0.3 }} />
                <Typography variant="body2" color="text.secondary">
                  <strong>Hold samlinger oppdatert</strong> - Fjern gamle showcases og legg til nye regelmessig
                </Typography>
              </Box>
            </Stack>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setOpenDialog(null)} sx={{ color: 'text.secondary' }}>
            Lukk
          </Button>
          <Button 
            variant="contained"
            onClick={() => {
              setOpenDialog('new-collection');
            }}
            startIcon={<AddIcon />}
            sx={{
              px: 3,
              background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
              '&:hover': {
                transform: 'translateY(-2px)',
              },
            }}
          >
            Opprett samling nå
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Collection Dialog */}
      <Dialog 
        open={openDialog === 'new-collection'}
        onClose={() => setOpenDialog(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <CollectionsIcon />
          Opprett ny samling
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Samlingsnavn"
              placeholder="F.eks. Bryllupsbilder 2025"
              required
              id="collection-name"
            />
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Beskrivelse
              </Typography>
              <RichTextEditor
                placeholder="Beskriv hva denne samlingen inneholder..."
                onChange={(content) => {
                  const descField = document.getElementById('collection-description-hidden') as HTMLInputElement;
                  if (descField) descField.value = content;
                }}
              />
              <input type="hidden" id="collection-description-hidden" />
            </Box>
            <FormControlLabel
              control={<Switch defaultChecked color="primary" id="collection-public" />}
              label="Offentlig samling (synlig for alle)"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenDialog(null)}>Avbryt</Button>
          <Button 
            variant="contained"
            onClick={() => {
              const nameInput = document.getElementById('collection-name') as HTMLInputElement;
              const descInput = document.getElementById('collection-description') as HTMLInputElement;
              const publicSwitch = document.getElementById('collection-public') as HTMLInputElement;
              
              if (nameInput?.value) {
                handleCreateCollection({
                  name: nameInput.value,
                  description: descInput?.value || '',
                  isPublic: publicSwitch?.checked ?? true,
                });
              }
            }}
            startIcon={<AddIcon />}
            sx={{
              background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
            }}
          >
            Opprett samling
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Template Dialog */}
      <Dialog 
        open={openDialog === 'new-template'}
        onClose={() => setOpenDialog(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <PaletteIcon />
          Opprett ny mal
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Malnavn"
              value={templateForm.name}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="F.eks. Moderne Portefølje"
              required
            />
            <TextField
              fullWidth
              label="Beskrivelse"
              value={templateForm.description}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Beskriv hva denne malen er best egnet for..."
              multiline
              rows={3}
            />
            <Box>
              <Typography variant="subtitle2" gutterBottom>Layout-stil</Typography>
              <Grid container spacing={1}>
                {layoutStyles.slice(0, 4).map(style => (
                  <Grid item xs={3} key={style.value}>
                    <Card 
                      sx={{ 
                        p: 1.5, 
                        textAlign: 'center', 
                        cursor: 'pointer',
                        borderRadius: 2,
                        border: templateForm.layoutConfig.style === style.value ? 
                          `2px solid ${theming.colors.primary}` : `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                        '&:hover': { borderColor: theming.colors.primary },
                      }}
                      onClick={() => setTemplateForm(prev => ({
                        ...prev,
                        layoutConfig: { ...prev.layoutConfig, style: style.value as any }
                      }))}
                    >
                      <Box sx={{ color: theming.colors.primary, mb: 0.5 }}>{style.icon}</Box>
                      <Typography variant="caption">{style.label}</Typography>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenDialog(null)}>Avbryt</Button>
          <Tooltip title={!templateForm.name ? "Skriv inn et navn for malen først" : "Opprett ny mal"} arrow>
            <span>
              <Button 
                variant="contained"
                onClick={handleSaveTemplate}
                disabled={!templateForm.name}
                startIcon={<AddIcon />}
                sx={{
                  background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
                }}
              >
                Opprett mal
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog 
        open={openDialog === 'settings'}
        onClose={() => setOpenDialog(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <SettingsIcon />
          Showcase innstillinger
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, borderRadius: 2, border: `1px solid ${alpha(theming.colors.primary, 0.1)}` }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Standard visningsinnstillinger
                </Typography>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={globalSettings.defaultShowMetadata} 
                        onChange={(e) => setGlobalSettings(prev => ({ ...prev, defaultShowMetadata: e.target.checked }))}
                        color="primary" 
                      />
                    }
                    label="Vis metadata som standard"
                  />
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={globalSettings.defaultShowStats} 
                        onChange={(e) => setGlobalSettings(prev => ({ ...prev, defaultShowStats: e.target.checked }))}
                        color="primary" 
                      />
                    }
                    label="Vis statistikk som standard"
                  />
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={globalSettings.defaultEnableComments} 
                        onChange={(e) => setGlobalSettings(prev => ({ ...prev, defaultEnableComments: e.target.checked }))}
                        color="primary" 
                      />
                    }
                    label="Aktiver kommentarer"
                  />
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={globalSettings.defaultEnableLikes} 
                        onChange={(e) => setGlobalSettings(prev => ({ ...prev, defaultEnableLikes: e.target.checked }))}
                        color="primary" 
                      />
                    }
                    label="Aktiver likes"
                  />
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={globalSettings.defaultEnableSharing} 
                        onChange={(e) => setGlobalSettings(prev => ({ ...prev, defaultEnableSharing: e.target.checked }))}
                        color="primary" 
                      />
                    }
                    label="Aktiver deling"
                  />
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, borderRadius: 2, border: `1px solid ${alpha(theming.colors.primary, 0.1)}` }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  SEO & Synlighet
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Standard meta-beskrivelse"
                    multiline
                    rows={2}
                    value={globalSettings.seoDescription}
                    onChange={(e) => setGlobalSettings(prev => ({ ...prev, seoDescription: e.target.value }))}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Standard nøkkelord"
                    placeholder="fotograf, oslo, bryllup..."
                    value={globalSettings.seoKeywords}
                    onChange={(e) => setGlobalSettings(prev => ({ ...prev, seoKeywords: e.target.value }))}
                  />
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenDialog(null)}>Lukk</Button>
          <Button 
            variant="contained"
            onClick={handleSaveSettings}
            sx={{
              background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
            }}
          >
            Lagre innstillinger
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Showcase Dialog */}
      <Dialog 
        open={openDialog === 'edit-showcase'}
        onClose={() => { setOpenDialog(null); setEditingShowcase(null); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <EditIcon />
          Rediger {terms.showcase.toLowerCase()}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {editingShowcase && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Tittel"
                  value={editingShowcase.title || ''}
                  onChange={(e) => setEditingShowcase((prev: any) => ({ ...prev, title: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Kategori</InputLabel>
                  <Select
                    value={editingShowcase.category || ''}
                    label="Kategori"
                    onChange={(e) => setEditingShowcase((prev: any) => ({ ...prev, category: e.target.value }))}
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
                  value={editingShowcase.description || ''}
                  onChange={(e) => setEditingShowcase((prev: any) => ({ ...prev, description: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editingShowcase.status || 'draft'}
                    label="Status"
                    onChange={(e) => setEditingShowcase((prev: any) => ({ ...prev, status: e.target.value }))}
                  >
                    <MenuItem value="draft">Utkast</MenuItem>
                    <MenuItem value="published">Publisert</MenuItem>
                    <MenuItem value="archived">Arkivert</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={editingShowcase.isFeatured || false}
                      onChange={(e) => setEditingShowcase((prev: any) => ({ ...prev, isFeatured: e.target.checked }))}
                    />
                  }
                  label="Fremhevet showcase"
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => { setOpenDialog(null); setEditingShowcase(null); }}>Avbryt</Button>
          <Button 
            variant="contained"
            onClick={handleEditShowcase}
            sx={{
              background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
            }}
          >
            Lagre endringer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Showcase Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => { setDeleteConfirmOpen(false); setShowcaseToDelete(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, #f44336 0%, #e91e63 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <WarningAmberIcon />
          Bekreft sletting
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" gutterBottom>
            Er du sikker på at du vil slette "{showcaseToDelete?.title}"?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Denne handlingen kan ikke angres. Alle bilder og metadata knyttet til denne showcasen vil bli permanent slettet.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => { setDeleteConfirmOpen(false); setShowcaseToDelete(null); }}>
            Avbryt
          </Button>
          <Button 
            variant="contained"
            color="error"
            onClick={handleDeleteShowcase}
          >
            Slett permanent
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Operation Confirmation Dialog */}
      <Dialog
        open={batchConfirmOpen}
        onClose={() => setBatchConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, #ff9800 0%, #f57c00 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <WarningAmberIcon />
          Bekreft masseoperasjon
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" gutterBottom>
            Du er i ferd med å utføre "{batchOperation}" på {selectedItems.length} elementer.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {batchOperation === 'delete' 
              ? 'Denne handlingen kan ikke angres. Alle valgte elementer vil bli permanent slettet.'
              : 'Er du sikker på at du vil fortsette med denne operasjonen?'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setBatchConfirmOpen(false)}>
            Avbryt
          </Button>
          <Button 
            variant="contained"
            color={batchOperation === 'delete' ? 'error' : 'primary'}
            onClick={() => {
              executeBatchOperation(batchOperation);
              setBatchConfirmOpen(false);
            }}
          >
            Bekreft operasjon
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Collection Dialog */}
      <Dialog
        open={openDialog === 'edit-collection'}
        onClose={() => { setOpenDialog(null); setEditingCollection(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <EditIcon />
          Rediger {terms.collection.toLowerCase()}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {editingCollection && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Navn"
                value={editingCollection.name || ''}
                onChange={(e) => setEditingCollection((prev: any) => ({ ...prev, name: e.target.value }))}
              />
              <TextField
                fullWidth
                label="Beskrivelse"
                multiline
                rows={3}
                value={editingCollection.description || ''}
                onChange={(e) => setEditingCollection((prev: any) => ({ ...prev, description: e.target.value }))}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editingCollection.isPublic || false}
                    onChange={(e) => setEditingCollection((prev: any) => ({ ...prev, isPublic: e.target.checked }))}
                  />
                }
                label="Offentlig samling"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editingCollection.isFeatured || false}
                    onChange={(e) => setEditingCollection((prev: any) => ({ ...prev, isFeatured: e.target.checked }))}
                  />
                }
                label="Fremhevet samling"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => { setOpenDialog(null); setEditingCollection(null); }}>Avbryt</Button>
          <Button 
            variant="contained"
            onClick={handleEditCollection}
            disabled={isSavingCollection}
            sx={{
              background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
            }}
          >
            {isSavingCollection ? 'Lagrer...' : 'Lagre endringer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Collection Confirmation Dialog */}
      <Dialog
        open={collectionDeleteConfirmOpen}
        onClose={() => { setCollectionDeleteConfirmOpen(false); setCollectionToDelete(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, #f44336 0%, #e91e63 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <WarningAmberIcon />
          Slett {terms.collection.toLowerCase()}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" gutterBottom>
            Er du sikker på at du vil slette "{collectionToDelete?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Denne handlingen kan ikke angres. Showcases i samlingen vil ikke bli slettet, men vil bli fjernet fra samlingen.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => { setCollectionDeleteConfirmOpen(false); setCollectionToDelete(null); }}>
            Avbryt
          </Button>
          <Button 
            variant="contained"
            color="error"
            disabled={isDeletingItem}
            onClick={async () => {
              setCollectionToDelete(collectionToDelete);
              await handleDeleteCollection();
              setCollectionDeleteConfirmOpen(false);
            }}
          >
            {isDeletingItem ? 'Sletter...' : 'Slett permanent'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog
        open={openDialog === 'edit-template'}
        onClose={() => { setOpenDialog(null); setEditingTemplate(null); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <PaletteIcon />
          Rediger mal
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {editingTemplate && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Malnavn"
                value={editingTemplate.name || ''}
                onChange={(e) => setEditingTemplate((prev: any) => ({ ...prev, name: e.target.value }))}
              />
              <TextField
                fullWidth
                label="Beskrivelse"
                multiline
                rows={3}
                value={editingTemplate.description || ''}
                onChange={(e) => setEditingTemplate((prev: any) => ({ ...prev, description: e.target.value }))}
              />
              <Box>
                <Typography variant="subtitle2" gutterBottom>Layout-stil</Typography>
                <Grid container spacing={1}>
                  {layoutStyles.slice(0, 4).map(style => (
                    <Grid item xs={3} key={style.value}>
                      <Card 
                        sx={{ 
                          p: 1.5, 
                          textAlign: 'center', 
                          cursor: 'pointer',
                          borderRadius: 2,
                          border: editingTemplate.layoutConfig?.style === style.value ? 
                            `2px solid ${theming.colors.primary}` : `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                          '&:hover': { borderColor: theming.colors.primary },
                        }}
                        onClick={() => setEditingTemplate((prev: any) => ({
                          ...prev,
                          layoutConfig: { ...prev.layoutConfig, style: style.value }
                        }))}
                      >
                        <Box sx={{ color: theming.colors.primary, mb: 0.5 }}>{style.icon}</Box>
                        <Typography variant="caption">{style.label}</Typography>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => { setOpenDialog(null); setEditingTemplate(null); }}>Avbryt</Button>
          <Button 
            variant="contained"
            onClick={handleEditTemplate}
            disabled={isSavingTemplate}
            sx={{
              background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
            }}
          >
            {isSavingTemplate ? 'Lagrer...' : 'Lagre endringer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Template Confirmation Dialog */}
      <Dialog
        open={templateDeleteConfirmOpen}
        onClose={() => { setTemplateDeleteConfirmOpen(false); setTemplateToDelete(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, #f44336 0%, #e91e63 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <WarningAmberIcon />
          Slett mal
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" gutterBottom>
            Er du sikker på at du vil slette malen "{templateToDelete?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Denne handlingen kan ikke angres. Showcases som bruker denne malen vil beholde sine nåværende innstillinger.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => { setTemplateDeleteConfirmOpen(false); setTemplateToDelete(null); }}>
            Avbryt
          </Button>
          <Button 
            variant="contained"
            color="error"
            disabled={isDeletingItem}
            onClick={handleDeleteTemplate}
          >
            {isDeletingItem ? 'Sletter...' : 'Slett permanent'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Showcase Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => { setPreviewDialogOpen(false); setPreviewShowcase(null); }}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { minHeight: '80vh' }
        }}
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <VisibilityIcon />
            Forhåndsvisning: {previewShowcase?.title}
          </Box>
          <IconButton 
            onClick={() => { setPreviewDialogOpen(false); setPreviewShowcase(null); }}
            sx={{ color: 'white' }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {previewShowcase && (
            <Box sx={{ 
              minHeight: '70vh',
              background: alpha(theming.colors.primary, 0.02),
            }}>
              {/* Preview Header */}
              <Box sx={{ 
                p: 4, 
                textAlign: 'center',
                background: `linear-gradient(135deg, ${alpha(theming.colors.primary, 0.05)} 0%, ${alpha(theming.colors.secondary, 0.05)} 100%)`,
              }}>
                <Typography variant="h3" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                  {previewShowcase.title}
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                  {previewShowcase.subtitle || previewShowcase.description}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {previewShowcase.tags?.map((tag: string) => (
                    <Chip key={tag} label={tag} size="small" sx={{ bgcolor: alpha(theming.colors.primary, 0.1), color: theming.colors.primary }} />
                  ))}
                </Box>
              </Box>
              
              {/* Preview Media Grid */}
              <Box sx={{ p: 4 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
                      <CardMedia
                        component="img"
                        height="400"
                        image={previewShowcase.images?.[0]?.url || previewShowcase.thumbnailUrl || 'https://picsum.photos/800/600'}
                        alt={previewShowcase.title}
                        sx={{ objectFit: 'cover' }}
                      />
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Stack spacing={2}>
                      <Paper sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                          Detaljer
                        </Typography>
                        <Stack spacing={1.5}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">Status:</Typography>
                            <Chip 
                              size="small" 
                              label={previewShowcase.status || 'Utkast'} 
                              color={previewShowcase.status === 'published' ? 'success' : 'default'}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">Kategori:</Typography>
                            <Typography variant="body2">{previewShowcase.category || '-'}</Typography>
                          </Box>
                          {(previewShowcase?.price ?? previewShowcase?.startingPrice) != null && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="text.secondary">Pris:</Typography>
                              <Typography variant="body2">
                                {formatCurrency(previewShowcase.price ?? previewShowcase.startingPrice, previewShowcase.currency || 'NOK')}
                              </Typography>
                            </Box>
                          )}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">Visninger:</Typography>
                            <Typography variant="body2">{previewShowcase.views || 0}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">Likes:</Typography>
                            <Typography variant="body2">{previewShowcase.likes || 0}</Typography>
                          </Box>
                        </Stack>
                      </Paper>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<OpenInNew />}
                        onClick={() => window.open(`/showcase/${previewShowcase.id}`, '_blank')}
                        sx={{
                          background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
                        }}
                      >
                        Åpne i ny fane
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Showcases to Collection Dialog */}
      <Dialog
        open={assignShowcaseDialogOpen}
        onClose={() => { setAssignShowcaseDialogOpen(false); setSelectedCollectionForAssignment(null); setShowcasesToAssign([]); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <AddIcon />
          Legg til showcases i "{selectedCollectionForAssignment?.name}"
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Velg showcases som skal legges til i denne samlingen.
          </Typography>
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {showcases?.filter((s: any) => !selectedCollectionForAssignment?.showcaseIds?.includes(s.id)).map((showcase: any) => (
              <Paper 
                key={showcase.id}
                sx={{ 
                  p: 2, 
                  mb: 1, 
                  cursor: 'pointer',
                  border: showcasesToAssign.includes(showcase.id) 
                    ? `2px solid ${theming.colors.primary}` 
                    : `1px solid ${alpha(theming.colors.primary, 0.1)}`,
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: theming.colors.primary },
                }}
                onClick={() => {
                  setShowcasesToAssign(prev => 
                    prev.includes(showcase.id) 
                      ? prev.filter(id => id !== showcase.id)
                      : [...prev, showcase.id]
                  );
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    component="img"
                    src={showcase.thumbnailUrl || 'https://picsum.photos/80/60'}
                    alt={showcase.title}
                    sx={{ width: 80, height: 60, borderRadius: 1, objectFit: 'cover' }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{showcase.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{showcase.category}</Typography>
                  </Box>
                  {showcasesToAssign.includes(showcase.id) && (
                    <CheckCircle sx={{ color: theming.colors.primary }} />
                  )}
                </Box>
              </Paper>
            ))}
          </Box>
          {showcasesToAssign.length > 0 && (
            <Typography variant="body2" sx={{ mt: 2, color: theming.colors.primary, fontWeight: 500 }}>
              {showcasesToAssign.length} showcase(s) valgt
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => { setAssignShowcaseDialogOpen(false); setSelectedCollectionForAssignment(null); setShowcasesToAssign([]); }}>
            Avbryt
          </Button>
          <Button 
            variant="contained"
            onClick={handleAssignShowcasesToCollection}
            disabled={showcasesToAssign.length === 0 || isSavingCollection}
            sx={{
              background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
            }}
          >
            {isSavingCollection ? 'Legger til...' : `Legg til ${showcasesToAssign.length} showcase(s)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Undo Snackbar */}
      {undoSnackbarOpen && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            p: 2,
            px: 3,
            borderRadius: 2,
            bgcolor: '#323232',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            zIndex: 9999,
            boxShadow: 6,
          }}
        >
          <Typography variant="body2">
            {lastBatchOperation?.type === 'delete' ? 'Elementer slettet' : 'Elementer arkivert'}
          </Typography>
          <Button 
            size="small" 
            sx={{ color: '#4caf50', fontWeight: 600 }}
            onClick={handleUndoBatchOperation}
          >
            Angre
          </Button>
          <IconButton 
            size="small" 
            sx={{ color: 'white' }}
            onClick={() => setUndoSnackbarOpen(false)}
          >
            <Close fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {/* Global Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={closeNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={closeNotification} 
          severity={notification.severity}
          sx={{ width: '100%', borderRadius: 2 }}
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Other dialogs can be added here */}
    </Box>
  );
}
