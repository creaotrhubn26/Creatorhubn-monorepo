import * as React from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Grid,
  Paper,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Badge,
  Avatar,
  ButtonGroup,
  ToggleButtonGroup,
  ToggleButton,
  Tab,
  Tabs,
  useTheme,
  alpha
} from '@mui/material';
import {
  TabPanel,
  TabContext,
  TabList,
  TabListProps,
  TabPanelProps
} from '@mui/lab';
import { useAutoSave } from '@/hooks/useAutoSave';
import {
  Add,
  Save,
  SaveAlt,
  Preview,
  Delete,
  ContentCopy,
  Palette,
  Animation,
  Settings,
  Visibility,
  VisibilityOff,
  PlayArrow,
  Stop,
  Refresh,
  ExpandMore,
  Code,
  SmartToy,
  Notifications,
  Warning,
  CheckCircle,
  Info,
  Error,
  Close,
  Edit,
  Download,
  Upload,
  Share,
  Favorite,
  Star,
  ThumbUp,
  ThumbDown,
  Reply,
  Forward,
  MoreVert,
  DragIndicator,
  Transform,
  Filter,
  Tune,
  AutoFixHigh,
  AutoAwesome,
  AutoAwesomeMotion,
  Speed,
  Timeline,
  Schedule,
  AccessTime,
  Compare,
  History,
  Restore,
  LocationOn,
  Phone,
  Email,
  Person,
  Group,
  BusinessCenter,
  Home,
  Work,
  School,
  Store,
  Restaurant,
  Hotel,
  Flight,
  Directions,
  Map,
  Navigation,
  Explore,
  Public,
  Language,
  Translate,
  GTranslate
} from '@mui/icons-material';
import { useVisualEditor } from './VisualEditorContext';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { academyToastTemplates } from './AcademyToastTemplates';

// Simple theming helper
const useTheming = () => ({
  colors: {
    primary: '#1976d2',
    secondary: '#dc004e'
  },
  getThemedCardSx: () => ({}),
  getThemedButtonSx: () => ({})
});

// Toast Designer Component
export default function ToastDesigner() {
  const theme = useTheme();
  const { addToast, state } = useVisualEditor();
  const { analytics, lifecycle, performance, debugging, features } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming();
  
  // Comprehensive Feature System for Toast Designer
  const toastDesignerAccess = features.checkFeatureAccess('toast-designer, ');
  const toastTemplatesAccess = features.checkFeatureAccess('toast-templates,');
  const toastCustomizationAccess = features.checkFeatureAccess('toast-customization,');
  const toastPreviewAccess = features.checkFeatureAccess('toast-preview, ');
  const toastExportAccess = features.checkFeatureAccess('toast-export');
  const toastAnimationAccess = features.checkFeatureAccess('toast-animation');
  const toastPositioningAccess = features.checkFeatureAccess('toast-positioning');
  const toastStylingAccess = features.checkFeatureAccess('toast-styling');
  
  // Local state for toast design
  const [selectedTemplate, setSelectedTemplate] = useState<string>('default');
  const [toastConfig, setToastConfig] = useState({
    message: 'Your message here',
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
    duration: 3000,
    position: 'top-right' as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center',
    animation: 'slide' as 'slide' | 'fade' | 'bounce' | 'zoom',
    style: {
      backgroundColor: '#4caf50',
      textColor: '#ffffff',
      borderRadius: 8,
      padding: 16,
      fontSize: 14,
      fontWeight: 'normal' as 'normal' | 'bold' | 'lighter',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      border: 'none',
      borderColor: 'transparent',
      borderWidth: 0,
      borderStyle: 'solid' as 'solid' | 'dashed' | 'dotted' | 'none'
    },
    icon: {
      enabled: true,
      type: 'success' as 'success' | 'error' | 'warning' | 'info' | 'custom',
      customIcon: '',
      size: 24,
      color: '#ffffff'
    },
    actions: {
      enabled: false,
      buttons: [] as Array<{
        id: string;
        label: string;
        action: string;
        style: 'primary' | 'secondary' | 'text';
        color: string;
      }>
    },
    progress: {
      enabled: false,
      color: '#ffffff',
      height: 4 }
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState('design');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  
  // Draft and Publish System
  const [liveUpdateEnabled, setLiveUpdateEnabled] = useState(false);
  const [draftTemplates, setDraftTemplates] = useState<Record<string 
 any>>({});
  const [publishedTemplates, setPublishedTemplates] = useState<Record<string 
 any>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const [templateHistory, setTemplateHistory] = useState<Record<string 
 any[]>>({});
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  // Auto-save integration
  const {
    save: autoSave,
    forceSave,
    state: autoSaveState,
    restoreFromBackup,
    isSaving,
    isPaused,
    lastSave,
    saveCount,
    pendingChanges,
    currentVersion
  } = useAutoSave({
    config: {
      enabled: true,
      debounceMs: 2000, // Auto-save 2 seconds after last change
      maxQueueSize: 50,
      conflictResolution: 'merge',
      backupInterval: 60000, // Backup every minute
      maxBackups: 10 },
    onDataSaved: (data) => {
      console.log('Toast template auto-saved: ', data);
      
      // Add to template history
      if (data.metadata?.templateId) {
        addToHistory(data.metadata.templateId, data.data'auto_saved');
      }
    },
    onBackupCreated: (data) => {
      console.log('Toast backup created: ', data.timestamp);
    },
    onError: (error) => {
      console.error('Auto-save error:', error);
    }
  });

  // Load custom templates from localStorage
  useEffect(() => {
    const savedTemplates = localStorage.getItem('toastTemplates');
    if (savedTemplates) {
      try {
        const templates = JSON.parse(savedTemplates);
        setCustomTemplates(templates);
      } catch (error) {
        console.error('Failed to load custom templates:', error);
      }
    }
  }, []);

  // Load draft and published templates
  useEffect(() => {
    const loadTemplates = () => {
      // Load published templates
      const published = localStorage.getItem('toastTemplatesPublished');
      if (published) {
        try {
          setPublishedTemplates(JSON.parse(published));
        } catch (error) {
          console.error('Failed to load published templates:', error);
        }
      }

      // Load draft templates
      const drafts = localStorage.getItem('toastTemplatesDraft');
      if (drafts) {
        try {
          setDraftTemplates(JSON.parse(drafts));
        } catch (error) {
          console.error('Failed to load draft templates:', error);
        }
      }

      // Load live update setting
      const liveUpdate = localStorage.getItem('toastLiveUpdateEnabled');
      setLiveUpdateEnabled(liveUpdate === 'true');
    };

    loadTemplates();
}, []);

  // Component registration and performance monitoring
  useEffect(() => {
    lifecycle.registerComponent({
      id: 'ToastDesigner',
      type: 'visual-editor-tool',
      version: '1.0.0',
      capabilities: {
        data: ['toast:design','toast:preview', 'toast:export','toast:import'],
        events: ['toast:created', 'toast:previewed', 'toast:saved','toast:exported'],
        actions: ['toast:design', 'toast:preview', 'toast:save','toast:export'],
        ui: ['designer', 'preview','controls'],
        system: ['performance:monitor', 'analytics:track','debug:log']
      },
      dependencies: ['VisualEditorContext','EnhancedMasterIntegrationProvider'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0 }
    });

    // Track feature usage
    features.trackFeatureUsage('toast-designer','opened', {
      timestamp: Date.now(),
      component: 'ToastDesigner',
      selectedTemplate: selectedTemplate
    });

    analytics.trackEvent('toast_designer_mounted', {
      componentId: 'ToastDesigner',
      timestamp: Date.now()
    });

    debugging.logIntegration('info', 'ToastDesigner component mounted', {
      componentId: 'ToastDesigner',
      capabilities: ['toast:design', 'toast:preview','toast:export']
    });

    return () => {
      lifecycle.unregisterComponent('ToastDesigner');
      analytics.trackEvent('toast_designer_unmounted', {
        componentId: 'ToastDesigner',
        timestamp: Date.now()
      });
    };
  }, [analytics, lifecycle, debugging, selectedTemplate, features]);

  // Auto-save toast configuration whenever it changes
  useEffect(() => {
    if (!liveUpdateEnabled && selectedTemplate) {
      // Auto-save current toast config
      autoSave('toast_template', toastConfig, {
        templateId: selectedTemplate,
        timestamp: Date.now(),
        version: currentVersion
      });
      
      setHasUnsavedChanges(true);
    }
  }, [toastConfig, selectedTemplate, liveUpdateEnabled, currentVersion]);

  // Toast templates
  const toastTemplates = [
    {
      id: 'default',
      name: 'Default',
      description: 'Simple, clean toast notification',
      config: {
        ...toastConfig,
        style: {
          ...toastConfig.style,
          backgroundColor: '#4caf50',
          textColor: '#ffffff'
        }
      }
    },
    // UniversalShowcase Success Templates
    {
      id: 'showcase-upload-success',
      name: 'File Upload Success',
      description: 'Files uploaded successfully notification',
      config: {
        ...toastConfig,
        message: '5 filer lastet opp vellykket!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#4caf50',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(6,175,80,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-files',
              label: 'Se Filene',
              action: 'view-files',
              style: 'secondary',
              color: '#ffffff'
        },
            {
              id: 'upload-more',
              label: 'Last opp Mer',
              action: 'upload-more',
              style: 'primary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    {
      id: 'showcase-download-success',
      name: 'Download Success',
      description: 'File download completed notification',
      config: {
        ...toastConfig,
        message: 'Fil lastet ned vellykket!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#4caf50',
          textColor: '#ffffff',
          borderRadius: 12 }
    }
  },
    {
      id: 'showcase-audio-watermark-success',
      name: 'Audio Watermark Success',
      description: 'Audio watermarking applied successfully',
      config: {
        ...toastConfig,
        message: 'Audio watermarking applied successfully!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#9c27b0',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(16,39,176,0.3)'
      }
    }
  },
    {
      id: 'showcase-video-export-success',
      name: 'Video Export Success',
      description: 'Video export started notification',
      config: {
        ...toastConfig,
        message: 'Video eksporteres for HD. Du vil få en e-post når eksporten er ferdig.',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#8bc34a',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(19,195,74,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-status',
              label: 'Se Status',
              action: 'view-status',
              style: 'secondary',
              color: '#ffffff'
        },
            {
              id: 'email-settings',
              label: 'E-post Innstillinger',
              action: 'email-settings',
              style: 'primary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    {
      id: 'showcase-google-photos-success',
      name: 'Google Photos Upload Success',
      description: 'Google Photos upload completed',
      config: {
        ...toastConfig,
        message: 'Bildene er lastet opp til Google Photos med full prosjektkontext!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#4caf50',
          textColor: '#ffffff',
          borderRadius: 12 },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'open-google-photos',
              label: 'Åpne Google Photos',
              action: 'open-google-photos',
              style: 'secondary',
              color: '#ffffff'
        },
            {
              id: 'view-project',
              label: 'Se Prosjekt',
              action: 'view-project',
              style: 'primary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    {
      id: 'showcase-client-selection-success',
      name: 'Client Selection Success',
      description: 'Client selection submitted successfully',
      config: {
        ...toastConfig,
        message: 'Ditt utvalg er sendt til fotografen!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#2196f3',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(3,150,243,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-selections',
              label: 'Se Utvalg',
              action: 'view-selections',
              style: 'secondary',
              color: '#ffffff'
        },
            {
              id: 'add-comment',
              label: 'Legg til Kommentar',
              action: 'add-comment',
              style: 'primary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    // UniversalShowcase Error Templates
    {
      id: 'showcase-download-error',
      name: 'Download Error',
      description: 'File download failed notification',
      config: {
        ...toastConfig,
        message: 'Kunne ikke laste ned filen. Prøv igjen senere.',
        type: 'error',
        style: {
          ...toastConfig.style,
          backgroundColor: '#f44336',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(24,67,54,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'retry-download',
              label: 'Prøv Igjen',
              action: 'retry-download',
              style: 'primary',
              color: '#ffffff'
        },
            {
              id: 'contact-support',
              label: 'Kontakt Support',
              action: 'contact-support',
              style: 'secondary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    {
      id: 'showcase-password-error',
      name: 'Password Error',
      description: 'Wrong password notification',
      config: {
        ...toastConfig,
        message: 'Feil passord!',
        type: 'error',
        style: {
          ...toastConfig.style,
          backgroundColor: '#f44336',
          textColor: '#ffffff',
          borderRadius: 12 }
    }
  },
    {
      id: 'showcase-upload-error',
      name: 'Upload Error',
      description: 'File upload failed notification',
      config: {
        ...toastConfig,
        message: 'Feil ved opplasting til Google Photos. Prøv igjen senere.',
        type: 'error',
        style: {
          ...toastConfig.style,
          backgroundColor: '#f44336',
          textColor: '#ffffff',
          borderRadius: 12 }
    }
  },
    // UniversalShowcase Warning Templates
    {
      id: 'showcase-selection-limit-warning',
      name: 'Selection Limit Warning',
      description: 'Client selection limit reached',
      config: {
        ...toastConfig,
        message: 'Du kan maksimalt velge 50 bilder.',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff9800',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(25,152,0,0.3)'
      }
    }
  },
    {
      id: 'showcase-time-limit-warning',
      name: 'Time Limit Warning',
      description: 'Download time limit expired',
      config: {
        ...toastConfig,
        message: 'Nedlastings-tidsbegrensning har utløpt!',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff9800',
          textColor: '#ffffff',
          borderRadius: 12 }
    }
  },
    {
      id: 'showcase-select-files-warning',
      name: 'Select Files Warning',
      description: 'No files selected warning',
      config: {
        ...toastConfig,
        message: 'Velg bilder først',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff9800',
          textColor: '#ffffff',
          borderRadius: 12 }
    }
  },
    // UniversalShowcase Info Templates
    {
      id: 'showcase-pricing-info',
      name: 'Pricing Info',
      description: 'Pricing calculation result',
      config: {
        ...toastConfig,
        message: 'Totalpris: 2500 NOK for 25 bilder',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#2196f3',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(3,150,243,0.3)'
      }
    }
  },
    {
      id: 'showcase-websocket-connected',
      name: 'WebSocket Connected',
      description: 'Real-time collaboration connected',
      config: {
        ...toastConfig,
        message: 'Collaboration WebSocket connected',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#00bcd4',
          textColor: '#ffffff',
          borderRadius: 12 }
    }
  },
    {
      id: 'showcase-thumbnail-generated',
      name: 'Thumbnail Generated',
      description: 'Video thumbnails generated successfully',
      config: {
        ...toastConfig,
        message: 'Thumbnails generert! Du kan nå velge den beste.',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#673ab7',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(13,58,183,0.3)'
      }
    }
  },
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Minimal design with subtle styling',
      config: {
        ...toastConfig,
        style: {
          ...toastConfig.style,
          backgroundColor: '#f5f5f5',
          textColor: '#333333',
          border: '1px solid #e0e0e0',
          boxShadow: 'none'
    }
    }
  },
    {
      id: 'modern',
      name: 'Modern',
      description: 'Modern design with rounded corners',
      config: {
        ...toastConfig,
        style: {
          ...toastConfig.style,
          backgroundColor: '#2196f3',
          textColor: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(3,150,243,0.3)'
      }
    }
  },
    {
      id: 'glass',
      name: 'Glass',
      description: 'Glass morphism effect',
      config: {
        ...toastConfig,
        style: {
          ...toastConfig.style,
          backgroundColor: 'rgba(25,255,255,0.1)',
          textColor: '#ffffff',
          borderRadius: 12,
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(25,255,255,0.2)'
      }
    }
  },
    // Project Management Templates
    {
      id: 'project-created-success',
      name: 'Project Created Success',
      description: 'New project created successfully',
      config: {
        ...toastConfig,
        message: 'Prosjekt opprettet vellykket!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#4caf50',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(6,175,80,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-project',
              label: 'Se Prosjekt',
              action: 'view-project',
              style: 'primary',
              color: '#ffffff'
        },
            {
              id: 'edit-settings',
              label: 'Rediger Innstillinger',
              action: 'edit-settings',
              style: 'secondary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    {
      id: 'project-saved-draft',
      name: 'Project Draft Saved',
      description: 'Project draft auto-saved',
      config: {
        ...toastConfig,
        message: 'Prosjekt utkast lagret automatisk',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#2196f3',
          textColor: '#ffffff',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(3,150,243,0.2)'
      },
        progress: {
          enabled: true,
          color: '#ffffff',
          height: 3 }
    }
  },
    {
      id: 'project-published-success',
      name: 'Project Published',
      description: 'Project published successfully',
      config: {
        ...toastConfig,
        message: 'Prosjekt publisert! Endringer er nå synlige for alle.',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#8bc34a',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(19,195,74,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-live',
              label: 'Se Live',
              action: 'view-live',
              style: 'primary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    // Worklog Templates
    {
      id: 'worklog-entry-created',
      name: 'Worklog Entry Created',
      description: 'New worklog entry added',
      config: {
        ...toastConfig,
        message: 'Arbeidslogg-oppføring lagt til!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff9800',
          textColor: '#ffffff',
          borderRadius: 10,
          boxShadow: '0 6px 20px rgba(25,152,0,0.3)'
      }
    }
  },
    {
      id: 'worklog-sync-success',
      name: 'Worklog Sync Success',
      description: 'Worklog synchronized with Google Keep',
      config: {
        ...toastConfig,
        message: 'Arbeidslogg synkronisert med Google Keep!',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#00bcd4',
          textColor: '#ffffff',
          borderRadius: 10 },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'open-keep',
              label: 'Åpne Google Keep',
              action: 'open-keep',
              style: 'secondary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    // Communication Templates
    {
      id: 'chat-message-sent',
      name: 'Chat Message Sent',
      description: 'Message sent successfully',
      config: {
        ...toastConfig,
        message: 'Melding sendt!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#673ab7',
          textColor: '#ffffff',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(13,58,183,0.2)'
      }
    }
  },
    {
      id: 'chat-connection-lost',
      name: 'Chat Connection Lost',
      description: 'Real-time chat disconnected',
      config: {
        ...toastConfig,
        message: 'Chat-tilkobling mistet. Prøver å koble til igjen...',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff9800',
          textColor: '#ffffff',
          borderRadius: 8 },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'reconnect',
              label: 'Koble til Igjen',
              action: 'reconnect',
              style: 'primary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    {
      id: 'chat-connection-restored',
      name: 'Chat Connection Restored',
      description: 'Real-time chat reconnected',
      config: {
        ...toastConfig,
        message: 'Chat-tilkobling gjenopprettet!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#4caf50',
          textColor: '#ffffff',
          borderRadius: 8 }
    }
  },
    // File Management Templates
    {
      id: 'file-upload-progress',
      name: 'File Upload Progress',
      description: 'File upload in progress',
      config: {
        ...toastConfig,
        message: 'Laster opp 5 filer... 60% ferdig',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#2196f3',
          textColor: '#ffffff',
          borderRadius: 8 },
        progress: {
          enabled: true,
          color: '#ffffff',
          height: 4 }
    }
  },
    {
      id: 'file-upload-complete',
      name: 'File Upload Complete',
      description: 'All files uploaded successfully',
      config: {
        ...toastConfig,
        message: 'Alle filer lastet opp vellykket!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#4caf50',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(6,175,80,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-files',
              label: 'Se Filene',
              action: 'view-files',
              style: 'primary',
              color: '#ffffff'
        },
            {
              id: 'upload-more',
              label: 'Last opp Mer',
              action: 'upload-more',
              style: 'secondary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    {
      id: 'file-download-started',
      name: 'File Download Started',
      description: 'Download initiated',
      config: {
        ...toastConfig,
        message: 'Nedlasting startet...',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#00bcd4',
          textColor: '#ffffff',
          borderRadius: 8 },
        progress: {
          enabled: true,
          color: '#ffffff',
          height: 3 }
    }
  },
    // Meeting & Calendar Templates
    {
      id: 'meeting-created',
      name: 'Meeting Created',
      description: 'New meeting scheduled',
      config: {
        ...toastConfig,
        message: 'Møte, opprettet: 15. januar kl. 14:00',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#9c27b0',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(16,39,176,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-calendar',
              label: 'Se Kalender',
              action: 'view-calendar',
              style: 'primary',
              color: '#ffffff'
        },
            {
              id: 'edit-meeting',
              label: 'Rediger Møte',
              action: 'edit-meeting',
              style: 'secondary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    {
      id: 'meeting-reminder',
      name: 'Meeting Reminder',
      description: 'Upcoming meeting reminder',
      config: {
        ...toastConfig,
        message: 'Møte om 15, minutter: Kundemøte',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff9800',
          textColor: '#ffffff',
          borderRadius: 10,
          boxShadow: '0 6px 20px rgba(25,152,0,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'join-meeting',
              label: 'Bli med',
              action: 'join-meeting',
              style: 'primary',
              color: '#ffffff'
        },
            {
              id: 'snooze',
              label: 'Snooze 5 min',
              action: 'snooze',
              style: 'secondary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    // Settings & Configuration Templates
    {
      id: 'settings-saved',
      name: 'Settings Saved',
      description: 'User settings updated',
      config: {
        ...toastConfig,
        message: 'Innstillinger lagret!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#4caf50',
          textColor: '#ffffff',
          borderRadius: 8 }
    }
  },
    {
      id: 'settings-reset',
      name: 'Settings Reset',
      description: 'Settings restored to defaults',
      config: {
        ...toastConfig,
        message: 'Innstillinger tilbakestilt til standard',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#607d8b',
          textColor: '#ffffff',
          borderRadius: 8 }
    }
  },
    {
      id: 'theme-changed',
      name: 'Theme Changed',
      description: 'Application theme updated',
      config: {
        ...toastConfig,
        message: 'Tema endret til mørk modus',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#424242',
          textColor: '#ffffff',
          borderRadius: 8 }
    }
  },
    // Error & Warning Templates
    {
      id: 'network-error',
      name: 'Network Error',
      description: 'Connection or network error',
      config: {
        ...toastConfig,
        message: 'Nettverksfeil. Sjekk internettforbindelsen din.',
        type: 'error',
        style: {
          ...toastConfig.style,
          backgroundColor: '#f44336',
          textColor: '#ffffff',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(24,67,54,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'retry',
              label: 'Prøv Igjen',
              action: 'retry',
              style: 'primary',
              color: '#ffffff'
        },
            {
              id: 'check-connection',
              label: 'Sjekk Forbindelse',
              action: 'check-connection',
              style: 'secondary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    {
      id: 'permission-denied',
      name: 'Permission Denied',
      description: 'User lacks required permissions',
      config: {
        ...toastConfig,
        message: 'Du har ikke tilgang til denne funksjonen.',
        type: 'error',
        style: {
          ...toastConfig.style,
          backgroundColor: '#f44336',
          textColor: '#ffffff',
          borderRadius: 8 },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'contact-admin',
              label: 'Kontakt Admin',
              action: 'contact-admin',
              style: 'primary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    {
      id: 'validation-error',
      name: 'Validation Error',
      description: 'Form validation failed',
      config: {
        ...toastConfig,
        message: 'Vennligst fyll ut alle påkrevde felt.',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff9800',
          textColor: '#ffffff',
          borderRadius: 8 }
    }
  },
    // Success & Achievement Templates
    {
      id: 'achievement-unlocked',
      name: 'Achievement Unlocked',
      description: 'User achievement unlocked',
      config: {
        ...toastConfig,
        message: 'Prestasjon låst, opp: Første prosjekt!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ffd700',
          textColor: '#000000',
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(25,215,0,0.4)',
          border: '2px solid #ffb300'
    },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-achievements',
              label: 'Se Prestasjoner',
              action: 'view-achievements',
              style: 'primary',
              color: '#000000'
        }
          ]
      }
    }
  },
    {
      id: 'milestone-reached',
      name: 'Milestone Reached',
      description: 'Project milestone achieved',
      config: {
        ...toastConfig,
        message: 'Milepæl nådd: 50 bilder redigert!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#4caf50',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(6,175,80,0.3)'
      }
    }
  },
    // Real-time Collaboration Templates
    {
      id: 'user-joined',
      name: 'User Joined',
      description: 'Another user joined the session',
      config: {
        ...toastConfig,
        message: 'Anna har koblet seg til samarbeidet',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#00bcd4',
          textColor: '#ffffff',
          borderRadius: 8 }
    }
  },
    {
      id: 'user-left',
      name: 'User Left',
      description: 'User left the collaboration session',
      config: {
        ...toastConfig,
        message: 'Anna har forlatt samarbeidet',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#607d8b',
          textColor: '#ffffff',
          borderRadius: 8 }
    }
  },
    {
      id: 'collaboration-sync',
      name: 'Collaboration Sync',
      description: 'Real-time sync in progress',
      config: {
        ...toastConfig,
        message: 'Synkroniserer endringer...',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#673ab7',
          textColor: '#ffffff',
          borderRadius: 8 },
        progress: {
          enabled: true,
          color: '#ffffff',
          height: 3 }
    }
  },
    // System Status Templates
    {
      id: 'system-maintenance',
      name: 'System Maintenance',
      description: 'Scheduled maintenance notification',
      config: {
        ...toastConfig,
        message: 'Systemvedlikehold: 15. januar 02:00-04:00',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff9800',
          textColor: '#ffffff',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(25,152,0,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-details',
              label: 'Se Detaljer',
              action: 'view-details',
              style: 'secondary',
              color: '#ffffff'
        }
          ]
      }
    }
  },
    {
      id: 'backup-complete',
      name: 'Backup Complete',
      description: 'Data backup completed',
      config: {
        ...toastConfig,
        message: 'Sikkerhetskopi fullført!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#4caf50',
          textColor: '#ffffff',
          borderRadius: 8 }
    }
  },
    // Custom Animated Templates
    {
      id: 'bounce-success',
      name: 'Bounce Success',
      description: 'Animated success with bounce effect',
      config: {
        ...toastConfig,
        message: 'Suksess!',
        type: 'success',
        animation: 'bounce',
        style: {
          ...toastConfig.style,
          backgroundColor: '#4caf50',
          textColor: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 12px 32px rgba(6,175,80,0.4)',
          transform: 'scale(1.05)'
    }
    }
  },
    {
      id: 'slide-error',
      name: 'Slide Error',
      description: 'Error notification with slide animation',
      config: {
        ...toastConfig,
        message: 'En feil oppstod',
        type: 'error',
        animation: 'slide',
        style: {
          ...toastConfig.style,
          backgroundColor: '#f44336',
          textColor: '#ffffff',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(24,67,54,0.3)'
      }
    }
  },
    {
      id: 'zoom-info',
      name: 'Zoom Info',
      description: 'Info notification with zoom animation',
      config: {
        ...toastConfig,
        message: 'Informasjon',
        type: 'info',
        animation: 'zoom',
        style: {
          ...toastConfig.style,
          backgroundColor: '#2196f3',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(3,150,243,0.3)'
      }
    }
  },
    // ============================================================================
    // EQUIPMENT MANAGEMENT TOAST TEMPLATES - CreatorHub Brand Kit Aligned
    // Using brand colors: #ff8c00 (orange), #3b82f6 (blue), #16a34a (green)
    // ============================================================================
    
    // Equipment Inventory Templates
    {
      id: 'equipment-added-success',
      name: 'Equipment Added',
      description: 'Equipment successfully added to inventory',
      config: {
        ...toastConfig,
        message: 'Canon EOS R5 lagt til i ditt utstyr!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff8c00',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(2, 5, 5,140,0,0.4)',
          border: '2px solid #3b82f6'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-equipment',
              label: 'Se Utstyr',
              action: 'view-equipment',
              style: 'primary',
              color: '#ffffff'
            },
            {
              id: 'add-more',
              label: 'Legg til Mer',
              action: 'add-more',
              style: 'secondary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    {
      id: 'equipment-updated-success',
      name: 'Equipment Updated',
      description: 'Equipment details updated successfully',
      config: {
        ...toastConfig,
        message: 'Utstyr oppdatert vellykket!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#3b82f6',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(59,130,246,0.3)'
        }
      }
    },
    {
      id: 'equipment-deleted-success',
      name: 'Equipment Deleted',
      description: 'Equipment removed from inventory',
      config: {
        ...toastConfig,
        message: 'Utstyr fjernet fra inventar',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#607d8b',
          textColor: '#ffffff',
          borderRadius: 8 }
      }
    },
    {
      id: 'equipment-photo-uploaded',
      name: 'Equipment Photo Added',
      description: 'Photo uploaded for equipment item',
      config: {
        ...toastConfig,
        message: 'Bilde lastet opp for Canon EOS R5',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff8c00',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 6px 20px rgba(2, 5, 5,140,0,0.3)'
        }
      }
    },
    
    // Maintenance Templates
    {
      id: 'maintenance-scheduled-success',
      name: 'Maintenance Scheduled',
      description: 'Equipment maintenance scheduled',
      config: {
        ...toastConfig,
        message: 'Service planlagt for Canon EOS R5 - 15. mars 2025',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#16a34a',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(22,163,74,0.4)',
          border: '2px solid #ff8c00'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-schedule',
              label: 'Se Timeplan',
              action: 'view-schedule',
              style: 'primary',
              color: '#ffffff'
            },
            {
              id: 'add-calendar',
              label: 'Til Kalender',
              action: 'add-calendar',
              style: 'secondary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    {
      id: 'maintenance-due-warning',
      name: 'Maintenance Due',
      description: 'Equipment maintenance due soon',
      config: {
        ...toastConfig,
        message: 'Service forfaller om 7, dager: Sony A7 IV',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff9800',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(2, 5, 5,152,0,0.4)'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'schedule-now',
              label: 'Planlegg Nå',
              action: 'schedule-now',
              style: 'primary',
              color: '#ffffff'
            },
            {
              id: 'remind-later',
              label: 'Påminn Senere',
              action: 'remind-later',
              style: 'secondary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    {
      id: 'maintenance-completed-success',
      name: 'Maintenance Complete',
      description: 'Equipment maintenance completed',
      config: {
        ...toastConfig,
        message: 'Service fullført! Canon EOS R5 er klar for bruk',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#16a34a',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(22,163,74,0.3)'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-report',
              label: 'Se Rapport',
              action: 'view-report',
              style: 'secondary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    {
      id: 'warranty-expiring-warning',
      name: 'Warranty Expiring',
      description: 'Equipment warranty expiring soon',
      config: {
        ...toastConfig,
        message: 'Garanti utløper om 30, dager: Nikon Z9',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff6b35',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(2, 5, 5,107,53,0.3)'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'extend-warranty',
              label: 'Forleng Garanti',
              action: 'extend-warranty',
              style: 'primary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    
    // Equipment Rental Templates
    {
      id: 'rental-created-success',
      name: 'Rental Created',
      description: 'Equipment rental successfully created',
      config: {
        ...toastConfig,
        message: 'Utleie, opprettet: Sony FX3 (5-10. mars)',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#3b82f6',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
          border: '2px solid #ff8c00'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-rental',
              label: 'Se Detaljer',
              action: 'view-rental',
              style: 'primary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    {
      id: 'rental-overdue-warning',
      name: 'Rental Overdue',
      description: 'Equipment rental is overdue',
      config: {
        ...toastConfig,
        message: 'FORFALT: Sony FX3 skulle vært returnert for 2 dager siden!',
        type: 'error',
        style: {
          ...toastConfig.style,
          backgroundColor: '#f44336',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(2, 4, 4,67,54,0.5)',
          border: '2px solid #ff9800'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'mark-returned',
              label: 'Merk som Returnert',
              action: 'mark-returned',
              style: 'primary',
              color: '#ffffff'
            },
            {
              id: 'contact-renter',
              label: 'Kontakt Utleier',
              action: 'contact-renter',
              style: 'secondary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    {
      id: 'rental-return-reminder',
      name: 'Return Reminder',
      description: 'Equipment return reminder',
      config: {
        ...toastConfig,
        message: 'Påminnelse: Returner Sony FX3 i morgen',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff9800',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(2, 5, 5,152,0,0.3)'
        }
      }
    },
    {
      id: 'rental-returned-success',
      name: 'Rental Returned',
      description: 'Equipment successfully returned',
      config: {
        ...toastConfig,
        message: 'Sony FX3 returnert i god stand',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#16a34a',
          textColor: '#ffffff',
          borderRadius: 12 }
      }
    },
    
    // Market & Price Templates
    {
      id: 'price-alert-success',
      name: 'Price Alert',
      description: 'Equipment price dropped below target',
      config: {
        ...toastConfig,
        message: 'PRISKUTT: Sony A7 IV nå 15% billigere!',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#16a34a',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(22,163,74,0.4)',
          border: '2px solid #ffd700'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-deals',
              label: 'Se Tilbud',
              action: 'view-deals',
              style: 'primary',
              color: '#ffffff'
            },
            {
              id: 'price-history',
              label: 'Prishistorikk',
              action: 'price-history',
              style: 'secondary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    {
      id: 'market-update-info',
      name: 'Market Update',
      description: 'Market prices updated',
      config: {
        ...toastConfig,
        message: 'Markedspriser oppdatert (125 produkter)',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#3b82f6',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 6px 20px rgba(59,130,246,0.3)'
        }
      }
    },
    
    // Firmware & Software Update Templates
    {
      id: 'firmware-available-warning',
      name: 'Firmware Available',
      description: 'New firmware update available',
      config: {
        ...toastConfig,
        message: 'Ny firmware tilgjengelig for Canon R5 (v1.8.1)',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#3b82f6',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
          border: '2px solid #16a34a'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'download-firmware',
              label: 'Last Ned',
              action: 'download-firmware',
              style: 'primary',
              color: '#ffffff'
            },
            {
              id: 'read-notes',
              label: 'Les Notater',
              action: 'read-notes',
              style: 'secondary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    {
      id: 'firmware-critical-error',
      name: 'Critical Firmware',
      description: 'Critical firmware update required',
      config: {
        ...toastConfig,
        message: 'KRITISK: Firmware-oppdatering påkrevd for Canon R5!',
        type: 'error',
        style: {
          ...toastConfig.style,
          backgroundColor: '#f44336',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(2, 4, 4,67,54,0.5)',
          border: '3px solid #ff9800',
          fontWeight: 'bold'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'download-now',
              label: 'Last Ned Nå',
              action: 'download-now',
              style: 'primary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    {
      id: 'firmware-downloaded-success',
      name: 'Firmware Downloaded',
      description: 'Firmware update downloaded successfully',
      config: {
        ...toastConfig,
        message: 'Firmware nedlastet! Klar for installasjon',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#16a34a',
          textColor: '#ffffff',
          borderRadius: 12 },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'install-guide',
              label: 'Installasjonsguide',
              action: 'install-guide',
              style: 'secondary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    {
      id: 'software-update-available',
      name: 'Software Update',
      description: 'Software update available',
      config: {
        ...toastConfig,
        message: 'Adobe Lightroom 13.2 tilgjengelig',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#3b82f6',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(59,130,246,0.3)'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'update-software',
              label: 'Oppdater Nå',
              action: 'update-software',
              style: 'primary',
              color: '#ffffff'
            },
            {
              id: 'release-notes',
              label: 'Hva er nytt',
              action: 'release-notes',
              style: 'secondary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    
    // Lens Database Templates
    {
      id: 'lens-compatibility-info',
      name: 'Lens Compatibility',
      description: 'Lens compatibility check result',
      config: {
        ...toastConfig,
        message: 'Sigma 50mm f/1.4 kompatibel med Canon R5',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#3b82f6',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(59,130,246,0.3)'
        }
      }
    },
    {
      id: 'lens-comparison-info',
      name: 'Lens Comparison',
      description: 'Lens comparison results',
      config: {
        ...toastConfig,
        message: 'Sammenlignet 3 objektiver - se resultatene',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff8c00',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(2, 5, 5,140,0,0.3)'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'view-comparison',
              label: 'Se Sammenligning',
              action: 'view-comparison',
              style: 'primary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    
    // Equipment News Templates
    {
      id: 'news-article-bookmarked',
      name: 'Article Bookmarked',
      description: 'Equipment news article saved',
      config: {
        ...toastConfig,
        message: 'Artikkel lagret i bokmerker',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff8c00',
          textColor: '#ffffff',
          borderRadius: 8 }
      }
    },
    {
      id: 'news-new-articles',
      name: 'New Articles',
      description: 'New equipment news available',
      config: {
        ...toastConfig,
        message: '5 nye artikler om fotoutstyr tilgjengelig!',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#3b82f6',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(59,130,246,0.3)'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'read-now',
              label: 'Les Nå',
              action: 'read-now',
              style: 'primary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    
    // Database & Tools Templates
    {
      id: 'database-synced-success',
      name: 'Database Synced',
      description: 'Equipment database synchronized',
      config: {
        ...toastConfig,
        message: 'Utstyr database synkronisert (234 produkter)',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#16a34a',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 6px 20px rgba(22,163,74,0.3)'
        }
      }
    },
    {
      id: 'backup-equipment-success',
      name: 'Equipment Backup',
      description: 'Equipment data backed up',
      config: {
        ...toastConfig,
        message: 'Utstyr data sikkerhetskopiert til Google Drive',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#16a34a',
          textColor: '#ffffff',
          borderRadius: 12 }
      }
    },
    {
      id: 'export-equipment-success',
      name: 'Equipment Exported',
      description: 'Equipment list exported successfully',
      config: {
        ...toastConfig,
        message: 'Utstyr liste eksportert til Excel',
        type: 'success',
        style: {
          ...toastConfig.style,
          backgroundColor: '#3b82f6',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(59,130,246,0.3)'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'open-file',
              label: 'Åpne Fil',
              action: 'open-file',
              style: 'primary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    
    // Value & Insurance Templates
    {
      id: 'equipment-value-updated',
      name: 'Value Updated',
      description: 'Equipment value recalculated',
      config: {
        ...toastConfig,
        message: 'Utstyr verdi, oppdatert: 185,500 kr',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#16a34a',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(22,163,74,0.3)'
        }
      }
    },
    {
      id: 'insurance-reminder-warning',
      name: 'Insurance Reminder',
      description: 'Equipment insurance renewal reminder',
      config: {
        ...toastConfig,
        message: 'Forsikring fornyes om 14 dager',
        type: 'warning',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff9800',
          textColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(2, 5, 5,152,0,0.3)'
        },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'renew-insurance',
              label: 'Forny Nå',
              action: 'renew-insurance',
              style: 'primary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    
    // Quick Action Templates
    {
      id: 'equipment-search-no-results',
      name: 'No Results',
      description: 'Equipment search returned no results',
      config: {
        ...toastConfig,
        message: 'Ingen resultater for "Sony A9 III"',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#607d8b',
          textColor: '#ffffff',
          borderRadius: 8 },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'clear-search',
              label: 'Tøm Søk',
              action: 'clear-search',
              style: 'secondary',
              color: '#ffffff'
            }
          ]
        }
      }
    },
    {
      id: 'category-filter-applied',
      name: 'Filter Applied',
      description: 'Equipment category filter applied',
      config: {
        ...toastConfig,
        message: 'Filter, anvendt: Kameraer (43 resultater)',
        type: 'info',
        style: {
          ...toastConfig.style,
          backgroundColor: '#ff8c00',
          textColor: '#ffffff',
          borderRadius: 8 }
      }
    }
  ];

  // Template categories (moved after toastTemplates declaration)
  const templateCategories = [
    { id: 'all', name: 'All Templates', count: toastTemplates.length + customTemplates.length + academyToastTemplates.length },
    { id: 'equipment', name: 'Equipment Management', count: toastTemplates.filter(t => t.id.startsWith('equipment-') || t.id.startsWith('maintenance-') || t.id.startsWith('rental-') || t.id.startsWith('firmware-') || t.id.startsWith('lens-') || t.id.startsWith('price-') || t.id.startsWith('market-') || t.id.startsWith('news-') || t.id.startsWith('warranty-') || t.id.startsWith('insurance-') || t.id.startsWith('database-') || t.id.startsWith('software-') || t.id.startsWith('backup-equipment') || t.id.startsWith('export-equipment') || t.id.startsWith('category-filter')).length },
    { id: 'academy', name: 'CreatorHub Academy', count: academyToastTemplates.length },
    { id: 'showcase', name: 'UniversalShowcase', count: toastTemplates.filter(t => t.id.startsWith('showcase-')).length },
    { id: 'project', name: 'Project Management', count: toastTemplates.filter(t => t.id.startsWith('project-')).length },
    { id: 'worklog', name: 'Worklog', count: toastTemplates.filter(t => t.id.startsWith('worklog-')).length },
    { id: 'communication', name: 'Communication', count: toastTemplates.filter(t => t.id.startsWith('chat-')).length },
    { id: 'file', name: 'File Management', count: toastTemplates.filter(t => t.id.startsWith('file-')).length },
    { id: 'meeting', name: 'Meetings & Calendar', count: toastTemplates.filter(t => t.id.startsWith('meeting-')).length },
    { id: 'settings', name: 'Settings & Config', count: toastTemplates.filter(t => t.id.startsWith('settings-') || t.id.startsWith('theme-')).length },
    { id: 'system', name: 'System Status', count: toastTemplates.filter(t => t.id.startsWith('system-') || t.id.startsWith('network-') || t.id.startsWith('permission-') || t.id.startsWith('validation-')).length },
    { id: 'achievement', name: 'Achievements', count: toastTemplates.filter(t => t.id.startsWith('achievement-') || t.id.startsWith('milestone-')).length },
    { id: 'collaboration', name: 'Collaboration', count: toastTemplates.filter(t => t.id.startsWith('user-') || t.id.startsWith('collaboration-')).length },
    { id: 'animated', name: 'Animated', count: toastTemplates.filter(t => t.id.startsWith('bounce-') || t.id.startsWith('slide-') || t.id.startsWith('zoom-')).length },
    { id: 'success', name: 'Success', count: toastTemplates.filter(t => t.config.type === 'success').length },
    { id: 'error', name: 'Error', count: toastTemplates.filter(t => t.config.type === 'error').length },
    { id: 'warning', name: 'Warning', count: toastTemplates.filter(t => t.config.type === 'warning').length },
    { id: 'info', name: 'Info', count: toastTemplates.filter(t => t.config.type === 'info').length },
    { id: 'custom', name: 'Custom', count: customTemplates.length }
  ];

  // Filter templates based on category
  const filteredTemplates = useMemo(() => {
    const allTemplates = [...toastTemplates, ...customTemplates, ...academyToastTemplates];
    
    if (templateCategory === 'all') return allTemplates;
    if (templateCategory === 'equipment') return allTemplates.filter(t => t.id.startsWith('equipment-') || t.id.startsWith('maintenance-') || t.id.startsWith('rental-') || t.id.startsWith('firmware-') || t.id.startsWith('lens-') || t.id.startsWith('price-') || t.id.startsWith('market-') || t.id.startsWith('news-') || t.id.startsWith('warranty-') || t.id.startsWith('insurance-') || t.id.startsWith('database-') || t.id.startsWith('software-') || t.id.startsWith('backup-equipment') || t.id.startsWith('export-equipment') || t.id.startsWith('category-filter'));
    if (templateCategory === 'academy') return academyToastTemplates;
    if (templateCategory === 'showcase') return allTemplates.filter(t => t.id.startsWith('showcase-'));
    if (templateCategory === 'project') return allTemplates.filter(t => t.id.startsWith('project-'));
    if (templateCategory === 'worklog') return allTemplates.filter(t => t.id.startsWith('worklog-'));
    if (templateCategory === 'communication') return allTemplates.filter(t => t.id.startsWith('chat-'));
    if (templateCategory === 'file') return allTemplates.filter(t => t.id.startsWith('file-'));
    if (templateCategory === 'meeting') return allTemplates.filter(t => t.id.startsWith('meeting-'));
    if (templateCategory === 'settings') return allTemplates.filter(t => t.id.startsWith('settings-') || t.id.startsWith('theme-'));
    if (templateCategory === 'system') return allTemplates.filter(t => t.id.startsWith('system-') || t.id.startsWith('network-') || t.id.startsWith('permission-') || t.id.startsWith('validation-'));
    if (templateCategory === 'achievement') return allTemplates.filter(t => t.id.startsWith('achievement-') || t.id.startsWith('milestone-'));
    if (templateCategory === 'collaboration') return allTemplates.filter(t => t.id.startsWith('user-') || t.id.startsWith('collaboration-'));
    if (templateCategory === 'animated') return allTemplates.filter(t => t.id.startsWith('bounce-') || t.id.startsWith('slide-') || t.id.startsWith('zoom-'));
    if (templateCategory === 'custom') return customTemplates;
    
    return allTemplates.filter(t => t.config.type === templateCategory);
  }, [templateCategory, toastTemplates, customTemplates]);

  // Handle template selection
  const handleTemplateSelect = useCallback((templateId: string) => {
    const endTiming = performance.startTiming('toast_template_select');
    
    // Check if there's a draft version first
    if (draftTemplates[templateId]) {
      setSelectedTemplate(templateId);
      setToastConfig(draftTemplates[templateId]);
      
      analytics.trackEvent('toast_template_selected', {
        templateId,
        templateName: 'Draft',
        isDraft: true,
        timestamp: Date.now()
      });
    } else {
      // Look in all template sources
      const allTemplates = [...toastTemplates, ...customTemplates];
      const template = allTemplates.find(t => t.id === templateId);
      
      if (template) {
        setSelectedTemplate(templateId);
        setToastConfig(template.config);
        
        analytics.trackEvent('toast_template_selected', {
          templateId,
          templateName: template.name,
          isDraft: false,
          timestamp: Date.now()
        });
        
        debugging.logIntegration('info','Toast template selected', {
          templateId,
          templateName: template.name
        });
      }
    }
  }, [toastTemplates, customTemplates, draftTemplates, analytics, debugging]);

  // Handle config updates
  const updateToastConfig = useCallback((updates: any) => {
    setToastConfig(prev => {
      const newConfig = { ...prev, ...updates };
      
      // Save as draft if live update is disabled
      if (!liveUpdateEnabled) {
        const newDrafts = { ...draftTemplates, [selectedTemplate]: newConfig };
        setDraftTemplates(newDrafts);
        fetch('/api/user/kv', {
          method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
          body: JSON.stringify({ key: 'toastTemplatesDraft', value: newDrafts })
        }).catch(() => {});
        localStorage.setItem('toastTemplatesDraft', JSON.stringify(newDrafts));
        setHasUnsavedChanges(true);
      }
      
      return newConfig;
    });
  }, [liveUpdateEnabled, draftTemplates, selectedTemplate]);

  // Draft management functions
  const saveDraft = useCallback(() => {
    const newDrafts = { ...draftTemplates, [selectedTemplate]: toastConfig };
    setDraftTemplates(newDrafts);
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'toastTemplatesDraft', value: newDrafts })
    }).catch(() => {});
    localStorage.setItem('toastTemplatesDraft', JSON.stringify(newDrafts));
    setHasUnsavedChanges(false);
    
    // Add to history
    addToHistory(selectedTemplate, toastConfig'draft_saved');
    
    analytics.trackEvent('toast_draft_saved', {
      templateId: selectedTemplate,
      timestamp: Date.now()
    });
  }, [draftTemplates, selectedTemplate, toastConfig, analytics]);

  const publishTemplate = useCallback((templateId: string, config: any) => {
    const newPublished = { ...publishedTemplates, [templateId]: config };
    setPublishedTemplates(newPublished);
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'toastTemplatesPublished', value: newPublished })
    }).catch(() => {});
    localStorage.setItem('toastTemplatesPublished', JSON.stringify(newPublished));
    
    // Apply to UniversalShowcase if it's a showcase template
    if (templateId.startsWith('showcase-')) {
      localStorage.setItem(`showcaseToastTemplate_${templateId}`, JSON.stringify(config));
      
      // Trigger storage event for real-time updates
      window.dispatchEvent(new StorageEvent('storage', {
        key: `showcaseToastTemplate_${templateId}`,
        newValue: JSON.stringify(config)
      }));
    }
    
    analytics.trackEvent('toast_template_published', {
      templateId,
      timestamp: Date.now()
    });
  }, [publishedTemplates, analytics]);

  const publishAllDrafts = useCallback(() => {
    Object.entries(draftTemplates).forEach(([templateId, config]) => {
      publishTemplate(templateId, config);
    });
    
    // Clear drafts after publishing
    setDraftTemplates({});
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'toastTemplatesDraft', value: {} })
    }).catch(() => {});
    localStorage.removeItem('toastTemplatesDraft');
    setHasUnsavedChanges(false);
    
    analytics.trackEvent('toast_all_drafts_published', {
      count: Object.keys(draftTemplates).length,
      timestamp: Date.now()
    });
  }, [draftTemplates, publishTemplate, analytics]);

  const rollbackToPublished = useCallback((templateId: string) => {
    const publishedTemplate = publishedTemplates[templateId];
    if (publishedTemplate) {
      setToastConfig(publishedTemplate);
      
      // Remove from drafts
      const newDrafts = { ...draftTemplates };
      delete newDrafts[templateId];
      setDraftTemplates(newDrafts);
      localStorage.setItem('toastTemplatesDraft', JSON.stringify(newDrafts));
      setHasUnsavedChanges(false);
    }
  }, [publishedTemplates, draftTemplates]);

  const toggleLiveUpdate = useCallback((enabled: boolean) => {
    setLiveUpdateEnabled(enabled);
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'toastLiveUpdateEnabled', value: enabled.toString() })
    }).catch(() => {});
    localStorage.setItem('toastLiveUpdateEnabled', enabled.toString());
    
    if (enabled && hasUnsavedChanges) {
      // Auto-save current draft when enabling live update
      saveDraft();
    }
    
    analytics.trackEvent('toast_live_update_toggled', {
      enabled,
      timestamp: Date.now()
    });
  }, [hasUnsavedChanges, saveDraft, analytics]);

  // Template history and comparison functions
  const addToHistory = useCallback((templateId: string, config: any, action: string) => {
    const history = templateHistory[templateId] || [];
    const newEntry = {
      id: `history-${Date.now()}`,
      config: JSON.parse(JSON.stringify(config)), // Deep clone
      action,
      timestamp: Date.now(),
      user: 'current_user' // TODO: Get actual user
    };
    
    const newHistory = [newEntry, ...history].slice(0, 10); // Keep last 10 versions
    setTemplateHistory(prev => ({ ...prev, [templateId]: newHistory }));
    
    // Save to localStorage
    localStorage.setItem('toastTemplateHistory', JSON.stringify({
      ...templateHistory,
      [templateId]: newHistory
    }));
  }, [templateHistory]);

  const compareTemplates = useCallback((templateId: string) => {
    const draft = draftTemplates[templateId];
    const published = publishedTemplates[templateId];
    
    if (!draft || !published) return null;
    
    const differences = [];
    
    // Compare basic properties
    if (draft.message !== published.message) {
      differences.push({
        field: 'message',
        draft: draft.message,
        published: published.message
      });
    }
    
    if (draft.type !== published.type) {
      differences.push({
        field: 'type',
        draft: draft.type,
        published: published.type
      });
    }
    
    // Compare style properties
    Object.keys(draft.style || {}).forEach(key => {
      if (draft.style[key] !== published.style?.[key]) {
        differences.push({
          field: `style.${key}`,
          draft: draft.style[key],
          published: published.style?.[key]
        });
      }
    });
    
    // Compare actions
    if (JSON.stringify(draft.actions) !== JSON.stringify(published.actions)) {
      differences.push({
        field: 'actions',
        draft: draft.actions,
        published: published.actions
      });
    }
    
    return differences;
  }, [draftTemplates, publishedTemplates]);

  const restoreFromHistory = useCallback((templateId: string, historyId: string) => {
    const history = templateHistory[templateId];
    const entry = history?.find(h => h.id === historyId);
    
    if (entry) {
      setToastConfig(entry.config);
      addToHistory(templateId, entry.config'restored');
      
      analytics.trackEvent('toast_template_restored', {
        templateId,
        historyId,
        timestamp: Date.now()
      });
    }
  }, [templateHistory, addToHistory, analytics]);

  // Bulk operations
  const bulkPublish = useCallback((templateIds: string[]) => {
    const newPublished = { ...publishedTemplates };
    
    templateIds.forEach(templateId => {
      const draft = draftTemplates[templateId];
      if (draft) {
        newPublished[templateId] = draft;
        
        // Apply to UniversalShowcase if it's a showcase template
        if (templateId.startsWith('showcase-')) {
          localStorage.setItem(`showcaseToastTemplate_${templateId}`, JSON.stringify(draft));
        }
      }
    });
    
    setPublishedTemplates(newPublished);
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'toastTemplatesPublished', value: newPublished })
    }).catch(() => {});
    localStorage.setItem('toastTemplatesPublished', JSON.stringify(newPublished));
    
    // Remove from drafts
    const newDrafts = { ...draftTemplates };
    templateIds.forEach(templateId => {
      delete newDrafts[templateId];
    });
    setDraftTemplates(newDrafts);
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'toastTemplatesDraft', value: newDrafts })
    }).catch(() => {});
    localStorage.setItem('toastTemplatesDraft', JSON.stringify(newDrafts));
    
    analytics.trackEvent('toast_bulk_published', {
      count: templateIds.length,
      templateIds,
      timestamp: Date.now()
    });
  }, [draftTemplates, publishedTemplates, analytics]);

  const bulkDelete = useCallback((templateIds: string[]) => {
    // Remove from drafts
    const newDrafts = { ...draftTemplates };
    templateIds.forEach(templateId => {
      delete newDrafts[templateId];
    });
    setDraftTemplates(newDrafts);
    localStorage.setItem('toastTemplatesDraft', JSON.stringify(newDrafts));
    
    analytics.trackEvent('toast_bulk_deleted', {
      count: templateIds.length,
      templateIds,
      timestamp: Date.now()
    });
  }, [draftTemplates, analytics]);

  const bulkExport = useCallback((templateIds: string[]) => {
    const templatesToExport = templateIds.map(id => ({
      id,
      draft: draftTemplates[id],
      published: publishedTemplates[id]
    }));
    
    const exportData = {
      templates: templatesToExport,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toast-templates-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    analytics.trackEvent('toast_bulk_exported', {
      count: templateIds.length,
      templateIds,
      timestamp: Date.now()
    });
  }, [draftTemplates, publishedTemplates, analytics]);

  // Handle style updates
  const updateStyle = useCallback((styleUpdates: any) => {
    setToastConfig(prev => ({
      ...prev,
      style: { ...prev.style, ...styleUpdates }
    }));
  }, []);

  // Handle icon updates
  const updateIcon = useCallback((iconUpdates: any) => {
    setToastConfig(prev => ({
      ...prev,
      icon: { ...prev.icon, ...iconUpdates }
    }));
  }, []);

  // Handle actions updates
  const updateActions = useCallback((actionsUpdates: any) => {
    setToastConfig(prev => ({
      ...prev,
      actions: { ...prev.actions, ...actionsUpdates }
    }));
  }, []);

  // Add action button
  const addActionButton = useCallback(() => {
    const newButton = {
      id: `action-${Date.now()}`,
      label: 'Action',
      action: 'custom',
      style: 'secondary' as const,
      color: '#ffffff'
    };
    updateActions({
      buttons: [...toastConfig.actions.buttons, newButton]
    });
  }, [toastConfig.actions.buttons, updateActions]);

  // Remove action button
  const removeActionButton = useCallback((buttonId: string) => {
    updateActions({
      buttons: toastConfig.actions.buttons.filter(b => b.id !== buttonId)
    });
  }, [toastConfig.actions.buttons, updateActions]);

  // Update action button
  const updateActionButton = useCallback((buttonId: string, updates: any) => {
    updateActions({
      buttons: toastConfig.actions.buttons.map(b =>
        b.id === buttonId ? { ...b, ...updates } : b
      )
    });
  }, [toastConfig.actions.buttons, updateActions]);

  // Preview toast
  const previewToast = useCallback(() => {
    addToast({
      message: toastConfig.message,
      type: toastConfig.type,
      duration: toastConfig.duration,
      actions: toastConfig.actions.enabled ? toastConfig.actions.buttons.map(b => ({
        label: b.label,
        action: () => console.log(`Action: ${b.action}`)
      })) : undefined
    });

    analytics.trackEvent('toast_previewed', {
      toastType: toastConfig.type,
      hasActions: toastConfig.actions.enabled,
      actionCount: toastConfig.actions.buttons.length,
      duration: toastConfig.duration,
      timestamp: Date.now()
    });

    debugging.logIntegration('info', 'Toast previewed', {
      toastType: toastConfig.type,
      message: toastConfig.message,
      hasActions: toastConfig.actions.enabled
    });
  }, [toastConfig, addToast, analytics, debugging]);

  // Save toast template
  const saveTemplate = useCallback(() => {
    const templateName = prompt('Enter template name:');
    if (templateName) {
      // Save to localStorage or send to backend
      const templates = JSON.parse(localStorage.getItem('toastTemplates') || '[]');
      const newTemplate = {
        id: `custom-${Date.now()}`,
        name: templateName,
        description: 'Custom template',
        config: toastConfig,
        category: 'custom'
      };
      templates.push(newTemplate);
      localStorage.setItem('toastTemplates', JSON.stringify(templates));
      setCustomTemplates(templates);
      
      analytics.trackEvent('toast_template_saved', {
        templateId: newTemplate.id,
        templateName,
        config: toastConfig,
        timestamp: Date.now()
      });

      debugging.logIntegration('info', 'Toast template saved', {
        templateId: newTemplate.id,
        templateName,
        configKeys: Object.keys(toastConfig)
      });

      alert('Template saved successfully!');
    }
  }, [toastConfig, analytics, debugging]);

  // Export toast config
  const exportConfig = useCallback(() => {
    const configJson = JSON.stringify(toastConfig, null, 2);
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'toast-config.json';
    a.click();
    URL.revokeObjectURL(url);

    analytics.trackEvent('toast_config_exported', {
      configSize: configJson.length,
      configKeys: Object.keys(toastConfig),
      timestamp: Date.now()
    });

    debugging.logIntegration('info', 'Toast config exported', {
      configSize: configJson.length,
      fileName: 'toast-config.json'
    });
  }, [toastConfig, analytics, debugging]);

  // Import toast config
  const importConfig = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const config = JSON.parse(e.target?.result as string);
            setToastConfig(config);
            
            analytics.trackEvent('toast_config_imported', {
              fileName: file.name,
              fileSize: file.size,
              configKeys: Object.keys(config),
              timestamp: Date.now()
            });

            debugging.logIntegration('info', 'Toast config imported', {
              fileName: file.name,
              fileSize: file.size,
              configKeys: Object.keys(config)
            });

            alert('Config imported successfully!');
          } catch (error) {
            analytics.trackEvent('toast_config_import_failed', {
              fileName: file.name,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: Date.now()
            });

            debugging.logIntegration('error','Toast config import failed', {
              fileName: file.name,
              error: error instanceof Error ? error.message : 'Unknown error'
            });

            alert('Invalid config file!');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [analytics, debugging]);

  // Get icon component
  const getIconComponent = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle />;
      case 'error': return <Error />;
      case 'warning': return <Warning />;
      case 'info': return <Info />;
      default: return <CheckCircle />;
    }
  };

  // Render toast preview
  const renderToastPreview = () => (
    <Box
      sx={{
        position: 'relative',
        minHeight: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.palette.grey[100],
        borderRadius: 2,
        border: `2px dashed ${theme.palette.grey[300]}`,
        p: 2 }}
    >
      <Paper
        elevation={3}
        sx={{
          backgroundColor: toastConfig.style.backgroundColor,
          color: toastConfig.style.textColor,
          borderRadius: toastConfig.style.borderRadius,
          padding: toastConfig.style.padding,
          fontSize: toastConfig.style.fontSize,
          fontWeight: oastConfig.style.fontWeight,
          boxShadow: toastConfig.style.boxShadow,
          border: toastConfig.style.border,
          borderColor: toastConfig.style.borderColor,
          borderWidth: toastConfig.style.borderWidth,
          borderStyle: toastConfig.style.borderStyle,
          maxWidth: 400,
          minWidth: 300,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          {toastConfig.icon.enabled && (
            <Box
              sx={{
              display: 'flex',
              alignItems: 'center',
              color: toastConfig.icon.color,
              fontSize: toastConfig.icon.size
            }}
          >
              {getIconComponent(toastConfig.icon.type)}
            </Box>
          )}
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ color: 'inherit' }}>
              {toastConfig.message}
            </Typography>
          </Box>

          {toastConfig.actions.enabled && toastConfig.actions.buttons.length > 0 && (
            <Stack direction="row" spacing={1}>
              {toastConfig.actions.buttons.map((button) => (
                <Button
                  key={button.id}
                  size="small"
                  variant={button.style === 'primary' ? 'contained' : 'text'}
                  sx={{
                    color: button.color,
                    minWidth: 'auto',
                    px: 1 }}
                >
                  {button.label}
                </Button>
              ))}
            </Stack>
          )}
        </Stack>

        {toastConfig.progress.enabled && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: toastConfig.progress.height,
              backgroundColor: toastConfig.progress.color,
              opacity: 0.3 }}
          />
        )}
      </Paper>
    </Box>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Toast Designer</Typography>
            
            {/* Auto-save Status & Unsaved Changes */}
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              {isSaving && (
                <Chip 
                  label="Auto-saving..." 
                  size="small" 
                  color="primary"
                  // add once at top of the file
import { keyframes } from '@mui/system';
import Save from '@mui/icons-material/Save';

const pulse = keyframes`
  0% { transform: scale(1);, opacity: 1; }
  50% { transform: scale(1.1);, opacity: 0.7; }
  100% { transform: scale(1);, opacity: 1; }
`;

// line ~2881
icon={<Save sx={{ fontSize: 14, animation: `${pulse} 1s infinite` }} />}

              
              {!isSaving && lastSave > 0 && (
                <Chip 
                  label={`Saved v${currentVersion}`}
                  size="small" 
                  color="success"
                  icon={<CheckCircle sx={{ fontSize: 14 }} />}
                />
              )}
              
              {hasUnsavedChanges && !isSaving && (
                <Chip 
                  label="Unsaved Changes" 
                  size="small" 
                  color="warning" 
                />
              )}
              
              {saveCount > 0 && (
                <Chip 
                  label={`${saveCount} auto-saves`}
                  size="small" 
                  variant="outlined"
                />
              )}
            </Box>
            
            {/* Feature Analytics Display */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
              </Typography>
              <Chip 
                label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '10px', height: 18 }}
              />
            </Box>
          </Box>
          
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Live Update Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={liveUpdateEnabled}
                  onChange={(e) => toggleLiveUpdate(e.target.checked)}
                  size="small"
                />
            }
              label="Live Update"
              sx={{ mr: 2 }}
            />
            
            {/* Draft/Publish Controls */}
            {!liveUpdateEnabled && (
              <Stack direction="row" spacing={1}>
                <Tooltip title="Force save immediately">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SaveAlt />}
                    onClick={() => forceSave()}
                    disabled={isSaving}
                  >
                    Force Save
                  </Button>
                </Tooltip>
                
                <Tooltip title="Restore from backup">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Restore />}
                    onClick={() => {
                      if (confirm('Restore from last backup? This will overwrite current changes.')) {
                        const restored = restoreFromBackup();
                        if (restored) {
                          alert('Restored from backup!');
                        } else {
                          alert('No backup available');
                        }
                      }
                    }}
                  >
                    Restore
                  </Button>
                </Tooltip>
                
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={theming.getThemedIcon('save')}
                  onClick={saveDraft}
                  disabled={!hasUnsavedChanges}
                >
                  Save Draft
                </Button>
                <Button 
                  variant="contained"
                  size="small"
                  startIcon={<AutoAwesome />}
                  onClick={() => setShowPublishDialog(true)}
                  disabled={Object.keys(draftTemplates).length === 0}
                  sx={theming.getThemedButtonSx()}
                >
                  Publish ({Object.keys(draftTemplates).length})
                </Button>
              </Stack>
            )}
            
            {/* Standard Controls */}
            <Button
              variant="outlined"
              startIcon={<Preview />}
              onClick={previewToast}
            >
              Preview
            </Button>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('save')}
              onClick={saveTemplate}
            >
              Save Template
            </Button>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('download')}
              onClick={exportConfig}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('upload')}
              onClick={importConfig}
            >
              Import
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Design Controls */}
        <Box sx={{ width: 400, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
          <TabContext value={activeTab}>
            <TabList
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Design" value="design" />
              <Tab label="Style" value="style" />
              <Tab label="Actions" value="actions" />
              <Tab label="Animation" value="animation" />
              <Tab label="Templates" value="templates" />
            </TabList>

            <Box sx={{ p: 2 }}>
              {/* Design Tab */}
              <TabPanel value="design" sx={{ p: 0 }}>
                <Stack spacing={3}>
                  {/* Templates */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Templates
                    </Typography>
                    
                    {/* Template Categories */}
                    <Box sx={{ mb: 2 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Category</InputLabel>
                        <Select
                          value={templateCategory}
                          onChange={(e) => setTemplateCategory(e.target.value)}
                          label="Category"
                        >
                          {templateCategories.map((category) => (
                            <MenuItem key={category.id} value={category.id}>
                              {category.name} ({category.count})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>

                    {/* Template Grid */}
                    <Grid container spacing={1}>
                      {filteredTemplates.map((template) => (
                        <Grid item xs={12} key={template.id}>
                          <Card
                            sx={{
                              ...theming.getThemedCardSx(),
                              p: 1,
                              cursor: 'pointer',
                              border: selectedTemplate === template.id ? 2 : 1,
                              borderColor: selectedTemplate === template.id ? 'primary.main' : 'divider', '&:hover': { borderColor: 'primary.main' },
                              position: 'relative'
                            }}
                            onClick={() => handleTemplateSelect(template.id)}
                          >
                            {/* Template Type Badge */}
                            <Chip
                              label={template.config.type}
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                height: 16,
                                fontSize: '0.6rem',
                                bgcolor: template.config.type === 'success' ? 'success.main' :
                                         template.config.type === 'error' ? 'error.main' :
                                         template.config.type === 'warning' ? 'warning.main' : 'info.main',
                                color: 'white'
                              }}
                            />
                            
                            <Typography variant="caption" display="block" sx={{ pr: 4 }}>
                              {template.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {template.description}
                            </Typography>
                            
                            {/* Show actions indicator */}
                            {template.config.actions?.enabled && template.config.actions.buttons?.length > 0 && (
                              <Box sx={{ mt: 0.5 }}>
                                <Chip
                                  label={`${template.config.actions.buttons.length} actions`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 16, fontSize: '0.5rem' }}
                                />
                              </Box>
                            )}
                          </Card>
                        </Grid>
                      ))}
                    </Grid>

                    {filteredTemplates.length === 0 && (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography color="text.secondary">
                          No templates found in this category
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Basic Settings */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Basic Settings
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        label="Message"
                        value={toastConfig.message}
                        onChange={(e) => updateToastConfig({ message: e.target.value })}
                        multiline
                        rows={2}
                        size="small"
                      />
                      
                      <FormControl size="small">
                        <InputLabel>Type</InputLabel>
                        <Select
                          value={toastConfig.type}
                          onChange={(e) => updateToastConfig({ type: e.target.value })}
                          label="Type"
                        >
                          <MenuItem value="success">Success</MenuItem>
                          <MenuItem value="error">Error</MenuItem>
                          <MenuItem value="warning">Warning</MenuItem>
                          <MenuItem value="info">Info</MenuItem>
                        </Select>
                      </FormControl>

                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Duration: {toastConfig.duration}ms
                        </Typography>
                        <Slider
                          value={toastConfig.duration}
                          onChange={(_, value) => updateToastConfig({ duration: value as number })}
                          min={1000}
                          max={10000}
                          step={500}
                          size="small"
                        />
                      </Box>

                      <FormControl size="small">
                        <InputLabel>Position</InputLabel>
                        <Select
                          value={toastConfig.position}
                          onChange={(e) => updateToastConfig({ position: e.target.value })}
                          label="Position"
                        >
                          <MenuItem value="top-right">Top Right</MenuItem>
                          <MenuItem value="top-left">Top Left</MenuItem>
                          <MenuItem value="bottom-right">Bottom Right</MenuItem>
                          <MenuItem value="bottom-left">Bottom Left</MenuItem>
                          <MenuItem value="top-center">Top Center</MenuItem>
                          <MenuItem value="bottom-center">Bottom Center</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                  </Box>
                </Stack>
              </TabPanel>

              {/* Style Tab */}
              <TabPanel value="style" sx={{ p: 0 }}>
                <Stack spacing={3}>
                  {/* Colors */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Colors
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Background Color
                        </Typography>
                        <TextField
                          type="color"
                          value={toastConfig.style.backgroundColor}
                          onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                          size="small"
                          fullWidth
                        />
                      </Box>
                      
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Text Color
                        </Typography>
                        <TextField
                          type="color"
                          value={toastConfig.style.textColor}
                          onChange={(e) => updateStyle({ textColor: e.target.value })}
                          size="small"
                          fullWidth
                        />
                      </Box>
                    </Stack>
                  </Box>

                  {/* Typography */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Typography
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Font Size: {toastConfig.style.fontSize}px
                        </Typography>
                        <Slider
                          value={toastConfig.style.fontSize}
                          onChange={(_, value) => updateStyle({ fontSize: value as number })}
                          min={10}
                          max={24}
                          step={1}
                          size="small"
                        />
                      </Box>

                      <FormControl size="small">
                        <InputLabel>Font Weight</InputLabel>
                        <Select
                          value={toastConfig.style.fontWeight}
                          onChange={(e) => updateStyle({ fontWeight: .target.value })}
                          label="Font Weight"
                        >
                          <MenuItem value="normal">Normal</MenuItem>
                          <MenuItem value="bold">Bold</MenuItem>
                          <MenuItem value="lighter">Lighter</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                  </Box>

                  {/* Layout */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Layout
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Border Radius: {toastConfig.style.borderRadius}px
                        </Typography>
                        <Slider
                          value={toastConfig.style.borderRadius}
                          onChange={(_, value) => updateStyle({ borderRadius: value as number })}
                          min={0}
                          max={24}
                          step={1}
                          size="small"
                        />
                      </Box>

                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Padding: {toastConfig.style.padding}px
                        </Typography>
                        <Slider
                          value={toastConfig.style.padding}
                          onChange={(_, value) => updateStyle({ padding: value as number })}
                          min={8}
                          max={32}
                          step={2}
                          size="small"
                        />
                      </Box>
                    </Stack>
                  </Box>

                  {/* Icon Settings */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Icon
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={toastConfig.icon.enabled}
                            onChange={(e) => updateIcon({ enabled: e.target.checked })}
                          />
                      }
                        label="Enable Icon"
                      />

                      {toastConfig.icon.enabled && (
                        <>
                          <FormControl size="small">
                            <InputLabel>Icon Type</InputLabel>
                            <Select
                              value={toastConfig.icon.type}
                              onChange={(e) => updateIcon({ type: e.target.value })}
                              label="Icon Type"
                            >
                              <MenuItem value="success">Success</MenuItem>
                              <MenuItem value="error">Error</MenuItem>
                              <MenuItem value="warning">Warning</MenuItem>
                              <MenuItem value="info">Info</MenuItem>
                              <MenuItem value="custom">Custom</MenuItem>
                            </Select>
                          </FormControl>

                          <Box>
                            <Typography variant="body2" gutterBottom>
                              Icon Size: {toastConfig.icon.size}px
                            </Typography>
                            <Slider
                              value={toastConfig.icon.size}
                              onChange={(_, value) => updateIcon({ size: value as number })}
                              min={16}
                              max={32}
                              step={2}
                              size="small"
                            />
                          </Box>

                          <Box>
                            <Typography variant="body2" gutterBottom>
                              Icon Color
                            </Typography>
                            <TextField
                              type="color"
                              value={toastConfig.icon.color}
                              onChange={(e) => updateIcon({ color: e.target.value })}
                              size="small"
                              fullWidth
                            />
                          </Box>
                        </>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </TabPanel>

              {/* Actions Tab */}
              <TabPanel value="actions" sx={{ p: 0 }}>
                <Stack spacing={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={toastConfig.actions.enabled}
                        onChange={(e) => updateActions({ enabled: e.target.checked })}
                      />
                  }
                    label="Enable Actions"
                  />

                  {toastConfig.actions.enabled && (
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle2">
                          Action Buttons
                        </Typography>
                        <Button
                          size="small"
                          startIcon={theming.getThemedIcon('add')}
                          onClick={addActionButton}
                        >
                          Add Button
                        </Button>
                      </Stack>

                      <Stack spacing={1} sx={{ mt: 1 }}>
                        {toastConfig.actions.buttons.map((button) => (
                          <Card key={button.id} sx={{ ...theming.getThemedCardSx(), p: 1 }}>
                            <Stack spacing={1}>
                              <TextField
                                label="Label"
                                value={button.label}
                                onChange={(e) => updateActionButton(button.id, { label: e.target.value })}
                                size="small"
                              />
                              
                              <FormControl size="small">
                                <InputLabel>Style</InputLabel>
                                <Select
                                  value={button.style}
                                  onChange={(e) => updateActionButton(button.id, { style: e.target.value })}
                                  label="Style"
                                >
                                  <MenuItem value="primary">Primary</MenuItem>
                                  <MenuItem value="secondary">Secondary</MenuItem>
                                  <MenuItem value="text">Text</MenuItem>
                                </Select>
                              </FormControl>

                              <Box>
                                <Typography variant="body2" gutterBottom>
                                  Color
                                </Typography>
                                <TextField
                                  type="color"
                                  value={button.color}
                                  onChange={(e) => updateActionButton(button.id, { color: e.target.value })}
                                  size="small"
                                  fullWidth
                                />
                              </Box>

                              <Button
                                size="small"
                                color="error"
                                startIcon={theming.getThemedIcon('delete')}
                                onClick={() => removeActionButton(button.id)}
                              >
                                Remove
                              </Button>
                            </Stack>
                          </Card>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </TabPanel>

              {/* Animation Tab */}
              <TabPanel value="animation" sx={{ p: 0 }}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Animation Type
                    </Typography>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Animation</InputLabel>
                      <Select
                        value={toastConfig.animation}
                        onChange={(e) => updateToastConfig({ animation: e.target.value })}
                        label="Animation"
                      >
                        <MenuItem value="slide">Slide</MenuItem>
                        <MenuItem value="fade">Fade</MenuItem>
                        <MenuItem value="bounce">Bounce</MenuItem>
                        <MenuItem value="zoom">Zoom</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Progress Bar
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={toastConfig.progress.enabled}
                            onChange={(e) => updateToastConfig({
                              progress: { ...toastConfig.progress, enabled: e.target.checked }
                          })}
                          />
                      }
                        label="Enable Progress Bar"
                      />

                      {toastConfig.progress.enabled && (
                        <>
                          <Box>
                            <Typography variant="body2" gutterBottom>
                              Progress Color
                            </Typography>
                            <TextField
                              type="color"
                              value={toastConfig.progress.color}
                              onChange={(e) => updateToastConfig({
                                progress: { ...toastConfig.progress, color: e.target.value }
                            })}
                              size="small"
                              fullWidth
                            />
                          </Box>

                          <Box>
                            <Typography variant="body2" gutterBottom>
                              Progress Height: {toastConfig.progress.height}px
                            </Typography>
                            <Slider
                              value={toastConfig.progress.height}
                              onChange={(_, value) => updateToastConfig({
                                progress: { ...toastConfig.progress, height: value as number }
                            })}
                              min={2}
                              max={8}
                              step={1}
                              size="small"
                            />
                          </Box>
                        </>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </TabPanel>

              {/* Templates Tab */}
              <TabPanel value="templates" sx={{ p: 0 }}>
                <Stack spacing={3}>
                  {/* Template Management */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Template Management
                    </Typography>
                    
                    <Stack spacing={2}>
                      {/* Current Template Info */}
                      <Card sx={{ ...theming.getThemedCardSx(), p: 2, bgcolor: 'grey.50' }}>
                        <Typography variant="body2" gutterBottom>
                          <strong>Current Template: </strong> {selectedTemplate}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                          {draftTemplates[selectedTemplate] && (
                            <Chip label="Draft" size="small" color="warning" />
                          )}
                          {publishedTemplates[selectedTemplate] && (
                            <Chip label="Published" size="small" color="success" />
                          )}
                          {liveUpdateEnabled && (
                            <Chip label="Live Update" size="small" color="primary" />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          {liveUpdateEnabled 
                            ? 'Changes apply immediately to UniversalShowcase'
                            : 'Edit the template above and publish to update UniversalShowcase'
                          }
                        </Typography>
                      </Card>

                      {/* Template Actions */}
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={theming.getThemedIcon('save')}
                          onClick={saveTemplate}
                          fullWidth
                        >
                          Save Template
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Preview />}
                          onClick={previewToast}
                          fullWidth
                        >
                          Preview
                        </Button>
                      </Stack>

                      {/* Advanced Actions */}
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Compare />}
                          onClick={() => setShowComparisonDialog(true)}
                          disabled={!draftTemplates[selectedTemplate] || !publishedTemplates[selectedTemplate]}
                          fullWidth
                        >
                          Compare
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<History />}
                          onClick={() => {
                            // TODO: Show history dialog
                            console.log('Template history:', templateHistory[selectedTemplate]);
                          }}
                          disabled={!templateHistory[selectedTemplate]?.length}
                          fullWidth
                        >
                          History
                        </Button>
                      </Stack>

                      {/* Apply to UniversalShowcase */}
                      <Button 
                        size="small"
                        variant="contained"
                        startIcon={<AutoAwesome />}
                        onClick={() => {
                          // Apply current template to UniversalShowcase
                          const template = [...toastTemplates, ...customTemplates].find(t => t.id === selectedTemplate);
                          if (template) {
                            // Persist server-first so UniversalShowcase can load server-side, with local fallback
                            fetch('/api/user/kv', {
                              method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
                              body: JSON.stringify({ key: 'showcaseToastTemplate', value: template.config })
                            }).catch(() => {});
                            localStorage.setItem('showcaseToastTemplate', JSON.stringify(template.config));
                            
                            // Also save as specific template if it's a showcase template
                            if (template.id.startsWith('showcase-')) {
                              fetch('/api/user/kv', {
                                method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
                                body: JSON.stringify({ key: `showcaseToastTemplate_${template.id}`, value: template.config })
                              }).catch(() => {});
                              localStorage.setItem(`showcaseToastTemplate_${template.id}`, JSON.stringify(template.config));
                            }
                            
                            // Trigger storage event for real-time updates
                            window.dispatchEvent(new StorageEvent('storage', {
                              key: 'showcaseToastTemplate',
                              newValue: JSON.stringify(template.config)
                            }));
                            
                            addToast({
                              message: 'Template applied to UniversalShowcase!',
                              type: 'success',
                              duration: 3000 });
                          }
                        }}
                        fullWidth
                        sx={theming.getThemedButtonSx()}
                      >
                        Apply to UniversalShowcase
                      </Button>

                      {/* Apply All Showcase Templates */}
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AutoAwesomeMotion />}
                        onClick={() => {
                          // Apply all showcase templates
                          const showcaseTemplates = toastTemplates.filter(t => t.id.startsWith('showcase-'));
                          showcaseTemplates.forEach(template => {
                            fetch('/api/user/kv', {
                              method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
                              body: JSON.stringify({ key: `showcaseToastTemplate_${template.id}`, value: template.config })
                            }).catch(() => {});
                            localStorage.setItem(`showcaseToastTemplate_${template.id}`, JSON.stringify(template.config));
                          });
                          alert(`Applied ${showcaseTemplates.length} showcase templates!`);
                      }}
                        fullWidth
                      >
                        Apply All Showcase Templates
                      </Button>

                      {/* Bulk Operations */}
                      <Divider sx={{ my:  2 }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Bulk Operations
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={theming.getThemedIcon('autoAwesome')}
                          onClick={() => setShowBulkDialog(true)}
                          disabled={Object.keys(draftTemplates).length === 0}
                          fullWidth
                        >
                          Bulk Publish
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={theming.getThemedIcon('download')}
                          onClick={() => {
                            const allTemplateIds = Object.keys(draftTemplates);
                            if (allTemplateIds.length > 0) {
                              bulkExport(allTemplateIds);
                          }
                        }}
                          disabled={Object.keys(draftTemplates).length === 0}
                          fullWidth
                        >
                          Export All
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>

                  {/* Template Categories */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Browse Templates
                    </Typography>
                    
                    <FormControl size="small" fullWidth sx={{ mb:  2 }}>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={templateCategory}
                        onChange={(e) => setTemplateCategory(e.target.value)}
                        label="Category"
                      >
                        {templateCategories.map((category) => (
                          <MenuItem key={category.id} value={category.id}>
                            {category.name} ({category.count})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Template List */}
                    <List dense>
                      {filteredTemplates.map((template) => (
                        <ListItem
                          key={template.id}
                          button
                          selected={selectedTemplate === template.id}
                          onClick={() => handleTemplateSelect(template.id)}
                          sx={{
                            borderRadius: 1,
                            mb: 0.5'&.Mui-selected': { bgcolor: 'primary.light', '&:hover': { bgcolor: 'primary.light' }
                            }
                          }}
                        >
                          <ListItemText
                            primary={template.name}
                            secondary={template.description}
                          />
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Chip
                              label={template.config.type}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.6rem',
                                bgcolor: template.config.type === 'success' ? 'success.main' :
                                         template.config.type === 'error' ? 'error.main' :
                                         template.config.type === 'warning' ? 'warning.main' : 'info.main',
                                color: 'white'
                          }}
                            />
                            {template.config.actions?.enabled && (
                              <Chip
                                label={`${template.config.actions.buttons?.length || 0}`}
                                size="small"
                                variant="outlined"
                                sx={{ height:  20, fontSize: '0.6rem'}}
                              />
                            )}
                          </Box>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Stack>
              </TabPanel>
            </Box>
          </TabContext>
        </Box>

        {/* Right Panel - Preview */}
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Preview
          </Typography>
          {renderToastPreview()}
        </Box>
      </Box>

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onClose={() => setShowPublishDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <AutoAwesome color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Publish Template Changes</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {/* Publish Summary */}
            <Alert severity="info">
              You have {Object.keys(draftTemplates).length} draft template(s) ready to publish. 
              This will update the live templates used in UniversalShowcase.
            </Alert>

            {/* Draft Templates List */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Templates to Publish:
              </Typography>
              <List dense>
                {Object.entries(draftTemplates).map(([templateId, config]) => (
                  <ListItem key={templateId}>
                    <ListItemText
                      primary={templateId}
                      secondary={`Type: ${config.type} | Message: ${config.message?.substring(0, 50)}...`}
                    />
                    <Chip
                      label="Draft"
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            {/* Publish Options */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Publish Options:
              </Typography>
              <Stack spacing={1}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Apply to UniversalShowcase immediately"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Clear drafts after publishing"
                />
                <FormControlLabel
                  control={<Switch />}
                  label="Create backup of current published templates"
                />
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPublishDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              publishAllDrafts();
              setShowPublishDialog(false);
            }}
            variant="contained"
            startIcon={<AutoAwesome />}
          >
            Publish All ({Object.keys(draftTemplates).length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Comparison Dialog */}
      <Dialog open={showComparisonDialog} onClose={() => setShowComparisonDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <Compare color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Template Comparison</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {(() => {
            const differences = compareTemplates(selectedTemplate);
            const draft = draftTemplates[selectedTemplate];
            const published = publishedTemplates[selectedTemplate];
            
            if (!differences || differences.length === 0) {
              return (
                <Alert severity="info">
                  No differences found between draft and published versions.
                </Alert>
              );
            }
            
            return (
              <Stack spacing={3}>
                <Alert severity="info">
                  Found {differences.length} difference(s) between draft and published versions.
                </Alert>
                
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="h6" color="warning.main">
                      Draft Version
                    </Typography>
                    <Card sx={{ ...theming.getThemedCardSx(), p: 2, bgcolor: 'warning.light', opacity: 0.1 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {JSON.stringify(draft, null, 2)}
                      </Typography>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="h6" color="success.main">
                      Published Version
                    </Typography>
                    <Card sx={{ ...theming.getThemedCardSx(), p: 2, bgcolor: 'success.light', opacity: 0.1 }}>
                      <Typography variant="body2" sx={{ fontFamily:'monospace' }}>
                        {JSON.stringify(published, null, 2)}
                      </Typography>
                    </Card>
                  </Grid>
                </Grid>
                
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Differences:
                  </Typography>
                  <List dense>
                    {differences.map((diff, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={diff.field}
                          secondary={
                            <Stack direction="row" spacing={2}>
                              <Box>
                                <Typography variant="caption" color="warning.main">
                                  Draft: {JSON.stringify(diff.draft)}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" color="success.main">
                                  Published: {JSON.stringify(diff.published)}
                                </Typography>
                              </Box>
                            </Stack>
                        }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Stack>
            );
        })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowComparisonDialog(false)}>
            Close
          </Button>
          <Button 
            onClick={() => {
              // Restore published version
              if (publishedTemplates[selectedTemplate]) {
                setToastConfig(publishedTemplates[selectedTemplate]);
                setShowComparisonDialog(false);
              }
            }}
            variant="outlined"
            startIcon={<Restore />}
          >
            Restore Published
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Operations Dialog */}
      <Dialog open={showBulkDialog} onClose={() => setShowBulkDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <AutoAwesome color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Bulk Operations</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {/* Template Selection */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Select Templates ({selectedTemplates.length} selected):
              </Typography>
              <List dense>
                {Object.keys(draftTemplates).map((templateId) => (
                  <ListItem key={templateId}>
                    <ListItemButton
                      onClick={() => {
                        setSelectedTemplates(prev => 
                          prev.includes(templateId) 
                            ? prev.filter(id => id !== templateId)
                            : [...prev, templateId]
                        );
                    }}
                    >
                      <ListItemText
                        primary={templateId}
                        secondary={`Type: ${draftTemplates[templateId]?.type} | Message: ${draftTemplates[templateId]?.message?.substring(0, 50)}...`}
                      />
                      <Chip
                        label={selectedTemplates.includes(templateId) ? "Selected" : "Select"}
                        size="small"
                        color={selectedTemplates.includes(templateId) ? "primary" : "default"}
                        variant={selectedTemplates.includes(templateId) ? "filled" : "outlined"}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>

            {/* Bulk Actions */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Available Actions:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button 
                  variant="contained"
                  startIcon={<AutoAwesome />}
                  onClick={() => {
                    if (selectedTemplates.length > 0) {
                      bulkPublish(selectedTemplates);
                      setSelectedTemplates([]);
                      setShowBulkDialog(false);
                    }
                  }}
                  disabled={selectedTemplates.length === 0}
                  sx={theming.getThemedButtonSx()}
                >
                  Publish Selected ({selectedTemplates.length})
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={() => {
                    if (selectedTemplates.length > 0) {
                      bulkExport(selectedTemplates);
                    }
                  }}
                  disabled={selectedTemplates.length === 0}
                >
                  Export Selected
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => {
                    if (selectedTemplates.length > 0 && confirm(`Delete ${selectedTemplates.length} templates?`)) {
                      bulkDelete(selectedTemplates);
                      setSelectedTemplates([]);
                      setShowBulkDialog(false);
                    }
                  }}
                  disabled={selectedTemplates.length === 0}
                >
                  Delete Selected
                </Button>
              </Stack>
            </Box>

            {/* Quick Actions */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Quick Actions:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSelectedTemplates(Object.keys(draftTemplates))}
                >
                  Select All
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSelectedTemplates([])}
                >
                  Clear Selection
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const showcaseTemplates = Object.keys(draftTemplates).filter(id => id.startsWith('showcase-'));
                    setSelectedTemplates(showcaseTemplates);
                }}
                >
                  Select Showcase Only
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBulkDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
