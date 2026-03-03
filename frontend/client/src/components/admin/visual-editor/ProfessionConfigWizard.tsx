/// <reference path="./react-beautiful-dnd.d.ts" />
/**
 * 🧙 Profession Configuration Wizard
 * Easily add new professions and configure their features/plans
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '../../../integration/EnhancedMasterIntegrationProvider';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  AlertTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Grid,
  IconButton,
  Tooltip,
  RadioGroup,
  Radio,
  Badge,
  LinearProgress,
  Skeleton,
} from '@mui/material';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useAutoSave } from '@/hooks/useAutoSave';
import {
  ExpandMore,
  CheckCircle,
  RadioButtonUnchecked,
  Info,
  Settings,
  AttachMoney,
  Category as CategoryIcon,
  Palette,
  Work,
  Save,
  SaveAlt,
  History,
  Restore,
  Drafts,
  PhotoCamera as MuiPhotoCamera,
  Videocam as MuiVideocam,
  MusicNote as MuiMusicNote,
  Store as MuiStore,
  Home,
  Restaurant as MuiRestaurant,
  FitnessCenter,
  Spa,
  LocalHospital,
  Pets,
  SelfImprovement,
  Brush,
  DirectionsCar,
  LocalFlorist,
  ChildCare,
  Psychology as MuiPsychology,
  School as MuiSchool,
  Dashboard,
  ViewCompact,
  PhotoLibrary,
  Add,
  Delete,
  DragIndicator,
  Tab as TabIcon,
  BarChart,
  Folder,
  FileUpload,
  FileDownload,
  ContentCopy,
  Visibility as PreviewIcon,
  Analytics,
  Science as ABTestIcon,
  Upload,
  Download,
  CloudDownload,
  CloudUpload,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { LIBRARY_MAPPINGS, getLibrariesForFeature, calculateBundleSize } from '@shared/library-feature-mapping';
import { useVisualEditor } from './VisualEditorContext';
import {
  PhotographyIcon,
  VideographyIcon,
  MusicProductionIcon,
  YogaStudioIcon,
  TattooArtistIcon,
  HairdresserIcon,
  PersonalTrainerIcon,
  RestaurantIcon,
  FloristIcon,
  ChildcareIcon,
  PsychologistIcon,
  DrivingSchoolIcon,
  SpaWellnessIcon,
  PetHotelIcon,
  StoreIcon as CreatorHubStoreIcon,
  BusinessIcon
} from '@/components/shared/CreatorHubIcons';

interface ProfessionConfigWizardProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: ProfessionConfiguration) => void;
  existingProfession?: ProfessionConfiguration;
  enableClone?: boolean;
  enableImportExport?: boolean;
  enablePreview?: boolean;
  enableABTesting?: boolean;
  enableAnalytics?: boolean;
}

type LayoutTemplate = 'compact' | 'expanded' | 'visual_heavy';

interface DashboardTemplate {
  id: LayoutTemplate;
  name: string;
  description: string;
  icon: string;
  preview: string;
  headerConfig?: Record<string, unknown>;
  sidebarConfig?: Record<string, unknown>;
  gridLayout?: Record<string, unknown>;
}

interface TabConfig {
  tabId: string;
  label: string;
  icon: string;
  sortOrder: number;
  isEnabled: boolean;
  isDefault: boolean;
  requiredFeatures?: string[];
}

interface ProjectTypeConfig {
  typeId: string;
  displayName: string;
  description?: string;
  icon: string;
  color: string;
  isEnabled: boolean;
  sortOrder: number;
}

interface StatConfig {
  statId: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  dataSource: string;
  format: string;
  isEnabled: boolean;
  sortOrder: number;
  size: string;
  trendEnabled: boolean;
}

interface WizardDraftData {
  professionId: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  layoutTemplate: LayoutTemplate;
  selectedFeatures: string[];
  featurePlans: Record<string, 'basic' | 'pro' | 'enterprise'>;
  selectedTabs: TabConfig[];
  selectedProjectTypes: ProjectTypeConfig[];
  selectedStats: StatConfig[];
  activeStep?: number;
}

interface SavedDraft {
  id: number;
  professionId: string;
  displayName: string;
  timestamp: number;
  activeStep: number;
  data: WizardDraftData;
}

interface VersionEntry {
  version: number;
  timestamp: number;
  data: WizardDraftData;
  type: string;
}

interface TabAnalyticsData {
  mostUsedTab?: string;
  avgTabsPerSession?: number;
  totalTabs?: number;
  totalSessions?: number;
  tabUsage?: Record<string, number>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' ? value : fallback;

const toBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const toLayoutTemplate = (value: unknown, fallback: LayoutTemplate = 'expanded'): LayoutTemplate =>
  value === 'compact' || value === 'expanded' || value === 'visual_heavy' ? value : fallback;

const toTabConfig = (value: unknown, fallbackOrder = 0): TabConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  const tabId = toString(value.tabId);
  const label = toString(value.label);
  if (!tabId || !label) {
    return null;
  }

  return {
    tabId,
    label,
    icon: toString(value.icon, 'Tab'),
    sortOrder: toNumber(value.sortOrder, fallbackOrder),
    isEnabled: toBoolean(value.isEnabled, true),
    isDefault: toBoolean(value.isDefault, false),
  };
};

const toProjectTypeConfig = (value: unknown, fallbackOrder = 0): ProjectTypeConfig | null => {
  if (!isRecord(value)) {
    return null;
  }
  const typeId = toString(value.typeId);
  const displayName = toString(value.displayName);
  if (!typeId || !displayName) {
    return null;
  }

  return {
    typeId,
    displayName,
    description: toString(value.description),
    icon: toString(value.icon, 'Folder'),
    color: toString(value.color, '#2196f3'),
    isEnabled: toBoolean(value.isEnabled, true),
    sortOrder: toNumber(value.sortOrder, fallbackOrder),
  };
};

const toStatConfig = (value: unknown, fallbackOrder = 0): StatConfig | null => {
  if (!isRecord(value)) {
    return null;
  }
  const statId = toString(value.statId);
  const displayName = toString(value.displayName);
  if (!statId || !displayName) {
    return null;
  }

  return {
    statId,
    displayName,
    description: toString(value.description),
    icon: toString(value.icon, 'BarChart'),
    color: toString(value.color, '#2196f3'),
    dataSource: toString(value.dataSource),
    format: toString(value.format),
    isEnabled: toBoolean(value.isEnabled, true),
    sortOrder: toNumber(value.sortOrder, fallbackOrder),
    size: toString(value.size, 'medium'),
    trendEnabled: toBoolean(value.trendEnabled, false),
  };
};

const toDashboardTemplate = (value: unknown): DashboardTemplate | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id = toLayoutTemplate(value.id, 'expanded');
  const name = toString(value.name);
  if (!name) {
    return null;
  }
  return {
    id,
    name,
    description: toString(value.description),
    icon: toString(value.icon, 'Dashboard'),
    preview: toString(value.preview),
  };
};

const toWizardDraftData = (value: unknown): WizardDraftData | null => {
  if (!isRecord(value)) {
    return null;
  }

  const selectedFeatures = Array.isArray(value.selectedFeatures)
    ? value.selectedFeatures.filter((feature): feature is string => typeof feature === 'string')
    : [];

  const featurePlansEntries = isRecord(value.featurePlans)
    ? Object.entries(value.featurePlans).filter((entry): entry is [string, 'basic' | 'pro' | 'enterprise'] => (
      typeof entry[0] === 'string'
      && (entry[1] === 'basic' || entry[1] === 'pro' || entry[1] === 'enterprise')
    ))
    : [];

  const selectedTabs = Array.isArray(value.selectedTabs)
    ? value.selectedTabs.map((tab, index) => toTabConfig(tab, index)).filter((tab): tab is TabConfig => tab !== null)
    : [];

  const selectedProjectTypes = Array.isArray(value.selectedProjectTypes)
    ? value.selectedProjectTypes.map((type, index) => toProjectTypeConfig(type, index)).filter((type): type is ProjectTypeConfig => type !== null)
    : [];

  const selectedStats = Array.isArray(value.selectedStats)
    ? value.selectedStats.map((stat, index) => toStatConfig(stat, index)).filter((stat): stat is StatConfig => stat !== null)
    : [];

  return {
    professionId: toString(value.professionId),
    displayName: toString(value.displayName),
    description: toString(value.description),
    icon: toString(value.icon, 'Work'),
    color: toString(value.color, '#2196f3'),
    layoutTemplate: toLayoutTemplate(value.layoutTemplate, 'expanded'),
    selectedFeatures,
    featurePlans: Object.fromEntries(featurePlansEntries),
    selectedTabs,
    selectedProjectTypes,
    selectedStats,
    activeStep: toNumber(value.activeStep, 0),
  };
};

const toSavedDraft = (value: unknown): SavedDraft | null => {
  if (!isRecord(value)) {
    return null;
  }

  const data = toWizardDraftData(value.data);
  if (!data) {
    return null;
  }

  return {
    id: toNumber(value.id, Date.now()),
    professionId: toString(value.professionId, data.professionId),
    displayName: toString(value.displayName, data.displayName),
    timestamp: toNumber(value.timestamp, Date.now()),
    activeStep: toNumber(value.activeStep, 0),
    data,
  };
};

export interface ProfessionConfiguration {
  professionId: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  features: {
    [featureId: string]: {
      enabled: boolean;
      plan: 'basic' | 'pro' | 'enterprise';
      optional: boolean;
      required: boolean;
      impact: 'low' | 'medium' | 'high' | 'critical';
      customDescription?: string;
    };
  };
}

// Complete icon library (MUI + CreatorHub custom icons)
const ICON_LIBRARY = {
  'Material UI Icons': [
    { id: 'Work', name: 'Work', component: Work },
    { id: 'Home', name: 'Home', component: Home },
    { id: 'School', name: 'School', component: MuiSchool },
    { id: 'Store', name: 'Store', component: MuiStore },
    { id: 'PhotoCamera', name: 'Photo Camera', component: MuiPhotoCamera },
    { id: 'Videocam', name: 'Video Camera', component: MuiVideocam },
    { id: 'MusicNote', name: 'Music Note', component: MuiMusicNote },
    { id: 'Restaurant', name: 'Restaurant', component: MuiRestaurant },
    { id: 'FitnessCenter', name: 'Fitness', component: FitnessCenter },
    { id: 'Spa', name: 'Spa', component: Spa },
    { id: 'LocalHospital', name: 'Medical', component: LocalHospital },
    { id: 'Pets', name: 'Pets', component: Pets },
    { id: 'SelfImprovement', name: 'Yoga', component: SelfImprovement },
    { id: 'Brush', name: 'Brush/Art', component: Brush },
    { id: 'DirectionsCar', name: 'Driving', component: DirectionsCar },
    { id: 'LocalFlorist', name: 'Florist', component: LocalFlorist },
    { id: 'ChildCare', name: 'Childcare', component: ChildCare },
    { id: 'Psychology', name: 'Psychology', component: MuiPsychology },
  ],
  'CreatorHub Custom Icons': [
    { id: 'PhotographyIcon', name: 'Photography Pro', component: PhotographyIcon },
    { id: 'VideographyIcon', name: 'Videography Pro', component: VideographyIcon },
    { id: 'MusicProductionIcon', name: 'Music Production', component: MusicProductionIcon },
    { id: 'YogaStudioIcon', name: 'Yoga Studio', component: YogaStudioIcon },
    { id: 'TattooArtistIcon', name: 'Tattoo Artist', component: TattooArtistIcon },
    { id: 'HairdresserIcon', name: 'Hairdresser', component: HairdresserIcon },
    { id: 'PersonalTrainerIcon', name: 'Personal Trainer', component: PersonalTrainerIcon },
    { id: 'RestaurantIcon', name: 'Restaurant', component: RestaurantIcon },
    { id: 'FloristIcon', name: 'Florist', component: FloristIcon },
    { id: 'ChildcareIcon', name: 'Childcare', component: ChildcareIcon },
    { id: 'PsychologistIcon', name: 'Psychologist', component: PsychologistIcon },
    { id: 'DrivingSchoolIcon', name: 'Driving School', component: DrivingSchoolIcon },
    { id: 'SpaWellnessIcon', name: 'Spa/Wellness', component: SpaWellnessIcon },
    { id: 'PetHotelIcon', name: 'Pet Hotel', component: PetHotelIcon },
    { id: 'BusinessIcon', name: 'Business/Vendor', component: BusinessIcon },
  ]
};

// Flatten for easy lookup
const ALL_ICONS = Object.values(ICON_LIBRARY).flat();

// Get icon component by ID
const getIconComponent = (iconId: string) => {
  const icon = ALL_ICONS.find(i => i.id === iconId);
  return icon?.component || Work;
};

// All available features organized by category
const AVAILABLE_FEATURES = {
  'Core Platform': [
    { id: 'universal-showcase', name: 'Universal Showcase', description: 'Portfolio display system', defaultPlan: 'basic', defaultEnabled: true },
    { id: 'client-proofing', name: 'Client Proofing', description: 'Client image/video review', defaultPlan: 'basic', defaultEnabled: true },
    { id: 'project-management', name: 'Project Management', description: 'Project tracking & organization', defaultPlan: 'basic', defaultEnabled: true },
  ],
  'Media Management': [
    { id: 'photo-enhancement', name: 'Photo Enhancement', description: 'AI-powered photo tools', defaultPlan: 'pro', defaultEnabled: false },
    { id: 'video-editor-suite', name: 'Video Editor', description: 'Full video editing', defaultPlan: 'pro', defaultEnabled: false },
    { id: 'audio-enhancement-suite', name: 'Audio Enhancement', description: 'AI audio processing', defaultPlan: 'pro', defaultEnabled: false },
  ],
  'Video Editor': [
    { id: 'story-arc-studio', name: 'Story Arc Studio', description: 'Professional video editor', defaultPlan: 'basic', defaultEnabled: false },
    { id: '485-transitions', name: '485 Transitions', description: 'WebGL transitions', defaultPlan: 'basic', defaultEnabled: false },
    { id: '627-luts', name: '627 LUTs', description: 'Professional color grading', defaultPlan: 'basic', defaultEnabled: false },
    { id: 'ai-story-generation', name: 'AI Story Generation', description: 'GPT-4 Vision auto-timeline', defaultPlan: 'pro', defaultEnabled: false },
    { id: 'auto-captions', name: 'Auto-Captions', description: 'Whisper AI captions', defaultPlan: 'pro', defaultEnabled: false },
    { id: 'davinci-resolve-export', name: 'DaVinci Resolve Export', description: 'EDL/XML export', defaultPlan: 'pro', defaultEnabled: false },
  ],
  'Streaming & Import': [
    { id: 'streaming-setup', name: 'HLS/DASH Streaming', description: 'shaka-player, hls.js', defaultPlan: 'enterprise', defaultEnabled: false },
    { id: 'hls-import', name: 'HLS Import', description: 'YouTube/Vimeo import', defaultPlan: 'enterprise', defaultEnabled: false },
  ],
  'Google Integration': [
    { id: 'google-drive-sync', name: 'Google Drive Sync', description: 'Auto-sync to Drive', defaultPlan: 'pro', defaultEnabled: false },
    { id: 'google-photos-integration', name: 'Google Photos', description: 'Photos import/export', defaultPlan: 'pro', defaultEnabled: false },
    { id: 'google-contacts-sync', name: 'Google Contacts', description: 'Contact sync', defaultPlan: 'pro', defaultEnabled: false },
  ],
  'Analytics & SEO': [
    { id: 'showcase-analytics', name: 'Showcase Analytics', description: 'View statistics', defaultPlan: 'pro', defaultEnabled: false },
    { id: 'video-analytics', name: 'Video Analytics', description: 'Quality metrics', defaultPlan: 'pro', defaultEnabled: false },
  ],
  'PWA & Mobile': [
    { id: 'pwa-install', name: 'PWA Install', description: 'Add to home screen', defaultPlan: 'basic', defaultEnabled: true },
    { id: 'service-worker-offline', name: 'Offline Support', description: 'Work offline', defaultPlan: 'basic', defaultEnabled: true },
    { id: 'push-notifications', name: 'Push Notifications', description: 'Browser notifications', defaultPlan: 'basic', defaultEnabled: true },
    { id: 'websocket-realtime', name: 'Real-time Updates', description: 'WebSocket sync', defaultPlan: 'basic', defaultEnabled: true },
  ],
  'Wedding Day Execution': [
    { id: 'auto-adjust-timeline', name: 'Auto-Adjust Timeline', description: 'Delay ripple feature', defaultPlan: 'basic', defaultEnabled: false },
    { id: 'mobile-shot-list', name: 'Mobile Shot List', description: 'Wedding day checklist', defaultPlan: 'basic', defaultEnabled: false },
    { id: 'quick-message-templates', name: 'Quick Messages', description: 'One-tap team coordination', defaultPlan: 'basic', defaultEnabled: false },
    { id: 'client-timeline-requests', name: 'Client Timeline Requests', description: 'Client change requests', defaultPlan: 'basic', defaultEnabled: false },
  ],
  'Advanced Tools': [
    { id: 'lightroom-plugin', name: 'Lightroom Plugin', description: 'Adobe integration', defaultPlan: 'pro', defaultEnabled: false },
    { id: 'davinci-resolve-integration', name: 'DaVinci Resolve', description: 'Resolve scripting', defaultPlan: 'enterprise', defaultEnabled: false },
    { id: 'background-removal', name: 'Background Removal', description: 'AI background removal', defaultPlan: 'enterprise', defaultEnabled: false },
  ],
  'Testing & QA': [
    { id: 'bug-reporting', name: 'Bug Reporting', description: 'In-app bug reporting tool for users', defaultPlan: 'basic', defaultEnabled: false, testerOnly: false },
    { id: 'feature-voting', name: 'Feature Voting', description: 'Vote on upcoming features and improvements', defaultPlan: 'basic', defaultEnabled: false, testerOnly: false },
    { id: 'beta-features-access', name: 'Beta Features Access', description: 'Early access to beta features before release', defaultPlan: 'enterprise', defaultEnabled: false, testerOnly: false },
    { id: 'test-data-generator', name: 'Test Data Generator', description: 'Generate mock projects/clients for testing (Tester Only)', defaultPlan: 'enterprise', defaultEnabled: false, testerOnly: true },
    { id: 'prototype-tester-tools', name: 'Prototype Tester Tools', description: 'Advanced testing dashboard, missions, analytics (Tester Only)', defaultPlan: 'enterprise', defaultEnabled: false, testerOnly: true },
  ]
};

export default function ProfessionConfigWizard({
  open,
  onClose,
  onSave,
  existingProfession,
  enableClone = true,
  enableImportExport = true,
  enablePreview = true,
  enableABTesting = true,
  enableAnalytics = true
}: ProfessionConfigWizardProps) {
  const [activeStep, setActiveStep] = useState(0);

  // Toast notification system
  const { addToast } = useVisualEditor();
  const { auth } = useEnhancedMasterIntegration();
  
  // Advanced Features State
  const [showPreview, setShowPreview] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [exportedJson, setExportedJson] = useState('');
  const [availableProfessions, setAvailableProfessions] = useState<ProfessionConfiguration[]>([]);
  const [selectedProfessionToClone, setSelectedProfessionToClone] = useState<string>('');
  const [abTestVariant, setAbTestVariant] = useState<'A' | 'B'>('A');
  const [tabAnalytics, setTabAnalytics] = useState<TabAnalyticsData | null>(null);
  
  // Draft & Version Management
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([]);
  
  // Step 1: Basic Info
  const [professionId, setProfessionId] = useState(existingProfession?.professionId || '');
  const [displayName, setDisplayName] = useState(existingProfession?.displayName || '');
  const [description, setDescription] = useState(existingProfession?.description || '');
  const [icon, setIcon] = useState(existingProfession?.icon || 'Work');
  const [color, setColor] = useState(existingProfession?.color || '#2196f3');
  const [showIconPicker, setShowIconPicker] = useState(false);
  
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
      enableAutoSave: true,
      debounceDelay: 2000, // Auto-save 2 seconds after last change
      maxQueueSize: 50,
      conflictResolution: 'manual',
      backupInterval: 60000, // Backup every minute
      maxVersions: 10 },
    onDataSaved: (data) => {
      console.log('✅ Wizard config auto-saved: ', data);
      const savedData = toWizardDraftData(data.data);
      if (!savedData) {
        return;
      }
      
      // Add to version history
      setVersionHistory(prev => [{
        version: currentVersion,
        timestamp: Date.now(),
        data: savedData,
        type: data.type
      }, ...prev.slice(0, 19)]); // Keep last 20 versions
      
      // Show toast notification (subtle, non-intrusive)
      if (saveCount > 0 && saveCount % 10 === 0) {
        addToast({
          message: `Profession auto-saved (v${currentVersion})`,
          type: 'info',
          duration: 2000 });
      }
    },
    onBackupCreated: (data) => {
      console.log('💾 Backup created: ', data);
      addToast({
        message: 'Sikkerhetskopi opprettet',
        type: 'success',
        duration: 2000 });
    },
    onError: (error) => {
      console.error('❌ Auto-save error:', error);
      addToast({
        message: `Lagringsfeil: ${error}`,
        type: 'error',
        duration: 4000 });
    }
  });
  
  // Step 2: Feature Selection
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    existingProfession
      ? new Set(Object.keys(existingProfession.features).filter(f => existingProfession.features[f].enabled))
      : new Set(['universal-showcase','pwa-install','service-worker-offline'])
  );

  // Step 3: Plan Distribution
  const [featurePlans, setFeaturePlans] = useState<Map<string, 'basic' | 'pro' | 'enterprise'>>(
    existingProfession
      ? new Map(Object.entries(existingProfession.features).map(([id, config]) => [id, config.plan]))
      : new Map()
  );
  
  // Step 4: Dashboard Layout Template
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplate>('expanded');
  const [dashboardTemplates, setDashboardTemplates] = useState<DashboardTemplate[]>([]);
  
  // Step 5: Tab Configuration
  const [selectedTabs, setSelectedTabs] = useState<TabConfig[]>([]);
  const [tabPresets, setTabPresets] = useState<Record<string, TabConfig[]>>({});
  
  // Step 6: Project Types
  const [selectedProjectTypes, setSelectedProjectTypes] = useState<ProjectTypeConfig[]>([]);
  const [projectTypePresets, setProjectTypePresets] = useState<Record<string, ProjectTypeConfig[]>>({});
  
  // Step 7: Dashboard Stats
  const [selectedStats, setSelectedStats] = useState<StatConfig[]>([]);
  const [statPresets, setStatPresets] = useState<Record<string, StatConfig[]>>({});
  
  // Auto-save wizard state whenever it changes
  useEffect(() => {
    if (!open) return;
    
    const wizardState = {
      professionId,
      displayName,
      description,
      icon,
      color,
      layoutTemplate,
      selectedFeatures: Array.from(selectedFeatures),
      featurePlans: Object.fromEntries(featurePlans),
      selectedTabs,
      selectedProjectTypes,
      selectedStats,
      activeStep
    };
    
    // Auto-save as draft
    autoSave('wizard_draft', wizardState, {
      professionId: professionId || 'new_profession',
      step: activeStep,
      timestamp: Date.now()
    });
    
  }, [professionId, displayName, description, icon, color, layoutTemplate, 
      selectedFeatures, featurePlans, selectedTabs, selectedProjectTypes, 
      selectedStats, activeStep, open]);
  
  // Load saved draft on mount
  useEffect(() => {
    if (open && !existingProfession) {
      loadSavedDrafts();
    }
  }, [open]);
  
  // Fetch presets from API
  useEffect(() => {
    if (open) {
      fetchPresets();
    }
  }, [open]);
  
  const fetchPresets = async () => {
    try {
      const headers = await auth.getAuthHeader();
      const [templates, tabs, projectTypes, stats, professions] = await Promise.all([
        apiRequest('/api/dashboard-templates', { headers }),
        apiRequest('/api/dashboard-tab-presets', { headers }),
        apiRequest('/api/project-type-presets', { headers }),
        apiRequest('/api/stat-presets', { headers }),
        apiRequest('/api/professions/all', { headers })
      ]);

      const templatesRecord = isRecord(templates) ? templates : {};
      const templatesList = Array.isArray(templatesRecord.templates)
        ? templatesRecord.templates.map(toDashboardTemplate).filter((template): template is DashboardTemplate => template !== null)
        : [];
      setDashboardTemplates(templatesList);

      const tabsRecord = isRecord(tabs) ? tabs : {};
      const tabPresetsRaw = isRecord(tabsRecord.presets) ? tabsRecord.presets : {};
      const nextTabPresets: Record<string, TabConfig[]> = Object.fromEntries(
        Object.entries(tabPresetsRaw).map(([key, value]) => [
          key,
          Array.isArray(value)
            ? value.map((item, index) => toTabConfig(item, index)).filter((item): item is TabConfig => item !== null)
            : [],
        ]),
      );
      setTabPresets(nextTabPresets);

      const projectTypesRecord = isRecord(projectTypes) ? projectTypes : {};
      const projectTypePresetsRaw = isRecord(projectTypesRecord.presets) ? projectTypesRecord.presets : {};
      const nextProjectTypePresets: Record<string, ProjectTypeConfig[]> = Object.fromEntries(
        Object.entries(projectTypePresetsRaw).map(([key, value]) => [
          key,
          Array.isArray(value)
            ? value.map((item, index) => toProjectTypeConfig(item, index)).filter((item): item is ProjectTypeConfig => item !== null)
            : [],
        ]),
      );
      setProjectTypePresets(nextProjectTypePresets);

      const statsRecord = isRecord(stats) ? stats : {};
      const statPresetsRaw = isRecord(statsRecord.presets) ? statsRecord.presets : {};
      const nextStatPresets: Record<string, StatConfig[]> = Object.fromEntries(
        Object.entries(statPresetsRaw).map(([key, value]) => [
          key,
          Array.isArray(value)
            ? value.map((item, index) => toStatConfig(item, index)).filter((item): item is StatConfig => item !== null)
            : [],
        ]),
      );
      setStatPresets(nextStatPresets);

      const professionsRecord = isRecord(professions) ? professions : {};
      const professionsList = Array.isArray(professionsRecord.professions)
        ? professionsRecord.professions.filter((item): item is ProfessionConfiguration => (
          isRecord(item)
          && typeof item.professionId === 'string'
          && typeof item.displayName === 'string'
          && typeof item.description === 'string'
          && typeof item.icon === 'string'
          && typeof item.color === 'string'
          && isRecord(item.features)
        ))
        : [];
      setAvailableProfessions(professionsList);

      // Fetch tab analytics if enabled
      if (enableAnalytics) {
        try {
          const analytics = await apiRequest('/api/dashboard-analytics/tabs', { headers });
          const analyticsRecord = isRecord(analytics) ? analytics : {};
          const usage = isRecord(analyticsRecord.tabUsage)
            ? Object.fromEntries(
              Object.entries(analyticsRecord.tabUsage).filter((entry): entry is [string, number] => (
                typeof entry[0] === 'string' && typeof entry[1] === 'number'
              )),
            )
            : {};
          setTabAnalytics({
            mostUsedTab: toString(analyticsRecord.mostUsedTab, 'Overview'),
            avgTabsPerSession: toNumber(analyticsRecord.avgTabsPerSession, 4),
            totalTabs: toNumber(analyticsRecord.totalTabs, 0),
            totalSessions: toNumber(analyticsRecord.totalSessions, 0),
            tabUsage: usage,
          });
        } catch (err) {
          console.warn('Analytics not available:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching presets:', error);
    }
  };
  
  // Advanced Feature Handlers

  // 1. Clone Profession
  const handleClone = async (sourceProfessionId: string) => {
    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest(`/api/professions/${sourceProfessionId}/dashboard-config`, { headers });
      
      if (response.dashboardConfig) {
        // Copy all data from source profession
        setProfessionId(`${sourceProfessionId}_clone_${Date.now()}`);
        setDisplayName(`${response.dashboardConfig.displayName || sourceProfessionId} (Clone)`);
        setDescription(response.dashboardConfig.description || '');
        setLayoutTemplate(response.dashboardConfig.layoutTemplate || 'expanded');
        
        // Clone tabs
        if (response.tabs) {
          setSelectedTabs(response.tabs.map((tab: TabConfig, index: number) => ({
            tabId: tab.tabId,
            label: tab.label,
            icon: tab.icon,
            sortOrder: index,
            isEnabled: tab.isEnabled,
            isDefault: tab.isDefault || false
          })));
        }
        
        // Clone project types
        if (response.projectTypes) {
          setSelectedProjectTypes(response.projectTypes.map((type: ProjectTypeConfig, index: number) => ({
            typeId: type.typeId,
            displayName: type.displayName,
            description: type.description,
            icon: type.icon,
            color: type.color,
            isEnabled: type.isEnabled,
            sortOrder: index
          })));
        }
        
        // Clone stats
        if (response.stats) {
          setSelectedStats(response.stats.map((stat: StatConfig, index: number) => ({
            statId: stat.statId,
            displayName: stat.displayName,
            description: stat.description,
            icon: stat.icon,
            color: stat.color,
            dataSource: stat.dataSource,
            format: stat.format,
            isEnabled: stat.isEnabled,
            sortOrder: index,
            size: stat.size,
            trendEnabled: stat.trendEnabled
          })));
        }
        
        setShowCloneDialog(false);
        console.log(`✅ Cloned profession: ${sourceProfessionId}`);
        
        // Success toast
        addToast({
          message: `Profession, klonet: ${response.dashboardConfig.displayName || sourceProfessionId}`,
          type: 'success',
          duration: 3000 });
      }
    } catch (error) {
      console.error('Error cloning profession:', error);
      addToast({
        message: 'Kloning feilet. Prøv igjen.',
        type: 'error',
        duration: 4000 });
    }
  };
  
  // 2. Export Configuration
  const handleExport = () => {
    const exportConfig = {
      professionId,
      displayName,
      description,
      icon,
      color,
      layoutTemplate,
      selectedFeatures: Array.from(selectedFeatures),
      featurePlans: Object.fromEntries(featurePlans),
      tabs: selectedTabs,
      projectTypes: selectedProjectTypes,
      stats: selectedStats,
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        platform: 'CreatorHub Norge'
      }
    };
    
    const jsonString = JSON.stringify(exportConfig, null, 2);
    setExportedJson(jsonString);
    setShowExportDialog(true);
    
    // Success toast
    addToast({
      message: `Konfigurasjon klar for eksport (${(jsonString.length / 1024).toFixed(1)} KB)`,
      type: 'success',
      duration: 3000 });
  };
  
  // 3. Import Configuration
  const handleImport = () => {
    try {
      const importedConfig = JSON.parse(importJson);
      
      // Validate structure
      if (!importedConfig.professionId || !importedConfig.displayName) {
        throw new Error('Invalid profession configuration JSON');
      }
      
      // Apply imported config
      setProfessionId(importedConfig.professionId);
      setDisplayName(importedConfig.displayName);
      setDescription(importedConfig.description || '');
      setIcon(importedConfig.icon || 'Work');
      setColor(importedConfig.color || '#2196f3');
      setLayoutTemplate(toLayoutTemplate(importedConfig.layoutTemplate, 'expanded'));
      
      if (importedConfig.selectedFeatures) {
        setSelectedFeatures(new Set(importedConfig.selectedFeatures));
      }
      
      if (importedConfig.featurePlans) {
        setFeaturePlans(new Map(Object.entries(importedConfig.featurePlans)));
      }
      
      if (importedConfig.tabs) {
        setSelectedTabs(importedConfig.tabs);
      }
      
      if (importedConfig.projectTypes) {
        setSelectedProjectTypes(importedConfig.projectTypes);
      }
      
      if (importedConfig.stats) {
        setSelectedStats(importedConfig.stats);
      }
      
      setShowImportDialog(false);
      setImportJson('');
      console.log(`✅ Imported profession: ${importedConfig.professionId}`);
      
      // Success toast
      addToast({
        message: `Konfigurasjon, importert: ${importedConfig.displayName}`,
        type: 'success',
        duration: 3000 });
    } catch (error: unknown) {
      console.error('Import error:', error);
      const message = error instanceof Error ? error.message : 'Ukjent feil';
      addToast({
        message: `Import, feilet: ${message}`,
        type: 'error',
        duration: 4000 });
    }
  };
  
  // 4. Drag and Drop Handler for Tabs
  const handleTabDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(selectedTabs);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update sort order
    const reordered = items.map((tab, index) => ({
      ...tab,
      sortOrder: index
    }));
    
    setSelectedTabs(reordered);
  };
  
  // 5. Download JSON File
  const downloadJson = () => {
    const blob = new Blob([exportedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${professionId || 'profession'}-config.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    // Success toast
    addToast({
      message: `Fil, nedlastet: ${professionId || 'profession'}-config.json`,
      type: 'success',
      duration: 3000 });
  };
  
  // 6. Copy to Clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(exportedJson);
    
    addToast({
      message: 'Konfigurasjon kopiert til utklippstavle!',
      type: 'success',
      duration: 2000 });
  };
  
  // 7. Load Saved Drafts (server-first)
  const loadSavedDrafts = () => {
    (async () => {
      try {
        const r = await fetch('/api/user/kv/profession_wizard_drafts', { credentials: 'include' });
        const j = r.ok ? await r.json().catch(() => null) : null;
        const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
        if (Array.isArray(v)) {
          const drafts = v.map(toSavedDraft).filter((draft): draft is SavedDraft => draft !== null);
          setSavedDrafts(drafts);
          if (drafts.length > 0) setShowDraftDialog(true);
          return;
        }
      } catch {}
      try {
        const draftsJson = localStorage.getItem('profession_wizard_drafts');
        if (draftsJson) {
          const drafts = JSON.parse(draftsJson);
          const parsedDrafts = Array.isArray(drafts)
            ? drafts.map(toSavedDraft).filter((draft): draft is SavedDraft => draft !== null)
            : [];
          setSavedDrafts(parsedDrafts);
          if (parsedDrafts.length > 0) setShowDraftDialog(true);
        }
      } catch (error) {
        console.error('Error loading drafts:', error);
      }
    })();
  };
  
  // 8. Save Manual Draft
  const saveDraft = () => {
    const draft = {
      id: Date.now(),
      professionId: professionId || 'unnamed_profession',
      displayName: displayName || 'Unnamed Profession',
      timestamp: Date.now(),
      activeStep,
      data: {
        professionId,
        displayName,
        description,
        icon,
        color,
        layoutTemplate,
        selectedFeatures: Array.from(selectedFeatures),
        featurePlans: Object.fromEntries(featurePlans),
        selectedTabs,
        selectedProjectTypes,
        selectedStats
      }
    };
    
    const existingDrafts = savedDrafts;
    const newDrafts = [draft, ...existingDrafts].slice(0, 10); // Keep last 10 drafts
    
    // Persist server-first
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'profession_wizard_drafts', value: newDrafts })
    }).catch((err: unknown) => console.error('Operation failed:', err));
    localStorage.setItem('profession_wizard_drafts', JSON.stringify(newDrafts));
    setSavedDrafts(newDrafts);
    
    addToast({
      message: `Utkast, lagret: ${draft.displayName} (Step ${draft.activeStep + 1}/8)`,
      type: 'success',
      duration: 3000 });
  };
  
  // 9. Restore from Draft
  const restoreDraft = (draft: SavedDraft) => {
    const data = draft.data;
    
    setProfessionId(data.professionId);
    setDisplayName(data.displayName);
    setDescription(data.description);
    setIcon(data.icon);
    setColor(data.color);
    setLayoutTemplate(data.layoutTemplate);
    setSelectedFeatures(new Set(data.selectedFeatures));
    setFeaturePlans(new Map(Object.entries(data.featurePlans)));
    setSelectedTabs(data.selectedTabs);
    setSelectedProjectTypes(data.selectedProjectTypes);
    setSelectedStats(data.selectedStats);
    setActiveStep(draft.activeStep || 0);
    
    setShowDraftDialog(false);
    console.log(`✅ Restored draft: ${draft.displayName}`);
    
    addToast({
      message: `Utkast, gjenopprettet: ${draft.displayName}`,
      type: 'success',
      duration: 3000 });
  };
  
  // 10. Delete Draft
  const deleteDraft = (draftId: number) => {
    const draft = savedDrafts.find(d => d.id === draftId);
    const newDrafts = savedDrafts.filter(d => d.id !== draftId);
    // Persist server-first
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'profession_wizard_drafts', value: newDrafts })
    }).catch((err: unknown) => console.error('Operation failed:', err));
    localStorage.setItem('profession_wizard_drafts', JSON.stringify(newDrafts));
    setSavedDrafts(newDrafts);
    
    addToast({
      message: `Utkast, slettet: ${draft?.displayName || 'Ukjent'}`,
      type: 'info',
      duration: 2000 });
  };
  
  // 11. Restore from Version
  const restoreVersion = (version: VersionEntry) => {
    const data = version.data;
    
    setProfessionId(data.professionId);
    setDisplayName(data.displayName);
    setDescription(data.description);
    setIcon(data.icon);
    setColor(data.color);
    setLayoutTemplate(data.layoutTemplate);
    setSelectedFeatures(new Set(data.selectedFeatures));
    setFeaturePlans(new Map(Object.entries(data.featurePlans)));
    setSelectedTabs(data.selectedTabs);
    setSelectedProjectTypes(data.selectedProjectTypes);
    setSelectedStats(data.selectedStats);
    
    setShowVersionHistory(false);
    console.log(`✅ Restored version ${version.version}`);
    
    addToast({
      message: `Versjon ${version.version} gjenopprettet`,
      type: 'success',
      duration: 3000 });
  };
  
  // Calculate bundle impact
  const bundleImpact = useMemo(() => {
    const enabledFeatures = selectedFeatures;
    return calculateBundleSize(professionId || 'custom', enabledFeatures);
  }, [selectedFeatures, professionId]);
  
  // Count features by plan
  const planStats = useMemo(() => {
    const stats = { basic: 0, pro: 0, enterprise: 0 };
    selectedFeatures.forEach(featureId => {
      const plan = featurePlans.get(featureId) || 'basic';
      stats[plan]++;
    });
    return stats;
  }, [selectedFeatures, featurePlans]);
  
  // Handle feature toggle
  const toggleFeature = (featureId: string) => {
    setSelectedFeatures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(featureId)) {
        newSet.delete(featureId);
        featurePlans.delete(featureId);
      } else {
        newSet.add(featureId);
        // Set default plan based on feature
        const feature = Object.values(AVAILABLE_FEATURES)
          .flat()
          .find(f => f.id === featureId);
        if (feature) {
          featurePlans.set(featureId, feature.defaultPlan as 'basic' | 'pro' | 'enterprise');
        }
      }
      return newSet;
    });
  };
  
  // Handle plan change
  const changePlan = (featureId: string, plan: 'basic' | 'pro' | 'enterprise') => {
    setFeaturePlans(prev => new Map(prev).set(featureId, plan));
  };
  
  // Load default tabs when Step 5 is reached
  useEffect(() => {
    if (activeStep === 4 && selectedTabs.length === 0 && professionId) {
      // Load default tabs based on profession or use 'default'
      const presetKey = tabPresets[professionId] ? professionId : 'default';
      const defaultTabs = tabPresets[presetKey] || [];
      setSelectedTabs(defaultTabs.map((tab, index: number) => ({
        ...tab,
        sortOrder: index,
        isEnabled: true
      })));
    }
  }, [activeStep, selectedTabs.length, professionId, tabPresets]);
  
  // Load default project types when Step 6 is reached
  useEffect(() => {
    if (activeStep === 5 && selectedProjectTypes.length === 0 && professionId) {
      const presetKey = projectTypePresets[professionId] ? professionId : 'default';
      const defaultTypes = projectTypePresets[presetKey] || [];
      setSelectedProjectTypes(defaultTypes.map((type, index: number) => ({
        ...type,
        sortOrder: index,
        isEnabled: true
      })));
    }
  }, [activeStep, selectedProjectTypes.length, professionId, projectTypePresets]);
  
  // Load default stats when Step 7 is reached
  useEffect(() => {
    if (activeStep === 6 && selectedStats.length === 0) {
      const commonStats = statPresets.common || [];
      const professionStats = statPresets[professionId] || [];
      setSelectedStats([...commonStats, ...professionStats].map((stat, index) => ({
        ...stat,
        sortOrder: index,
        isEnabled: true
      })));
    }
  }, [activeStep, selectedStats.length, professionId, statPresets]);
  
  // Handle save
  const handleSave = async () => {
    const config: ProfessionConfiguration = {
      professionId,
      displayName,
      description,
      icon,
      color,
      features: {}
    };
    
    // Build features object
    selectedFeatures.forEach(featureId => {
      const feature = Object.values(AVAILABLE_FEATURES)
        .flat()
        .find(f => f.id === featureId);
      
      if (feature) {
        config.features[featureId] = {
          enabled: true,
          plan: (featurePlans.get(featureId) || feature.defaultPlan) as 'basic' | 'pro' | 'enterprise',
          optional: !feature.defaultEnabled,
          required: feature.defaultEnabled,
          impact: featureId.includes('critical') || featureId.includes('story-arc') ? 'critical' :
                  featureId.includes('analytics') || featureId.includes('integration') ? 'high' :
                  featureId.includes('sync') || featureId.includes('export') ? 'medium' : 'low',
        };
      }
    });
    
    // Call onSave with profession config (existing behavior)
    onSave(config);

    // Also save dashboard configuration to backend
    try {
      const headers = await auth.getAuthHeader();
      const selectedTemplate = dashboardTemplates.find(t => t.id === layoutTemplate);
      await apiRequest(`/api/professions/${professionId}/dashboard-config`, {
        method: 'POST',
        headers: {
          ...headers, 'Content-Type' : 'application/json'
        },
        body: JSON.stringify({
          dashboardConfig: {
            layoutTemplate,
            headerConfig: selectedTemplate?.headerConfig || {},
            sidebarConfig: selectedTemplate?.sidebarConfig || {},
            gridLayout: selectedTemplate?.gridLayout || {}
          },
          tabs: selectedTabs.map(tab => ({
            tabId: tab.tabId,
            label: tab.label,
            icon: tab.icon,
            sortOrder: tab.sortOrder,
            isEnabled: tab.isEnabled,
            isDefault: tab.isDefault || false,
            requiredFeatures: tab.requiredFeatures || []
          })),
          projectTypes: selectedProjectTypes.map(type => ({
            typeId: type.typeId,
            displayName: type.displayName,
            description: type.description,
            icon: type.icon,
            color: type.color,
            isEnabled: type.isEnabled,
            sortOrder: type.sortOrder
          })),
          stats: selectedStats.map(stat => ({
            statId: stat.statId,
            displayName: stat.displayName,
            description: stat.description,
            icon: stat.icon,
            color: stat.color,
            dataSource: stat.dataSource,
            format: stat.format,
            isEnabled: stat.isEnabled,
            sortOrder: stat.sortOrder,
            size: stat.size,
            trendEnabled: stat.trendEnabled
          }))
        })
      });
      
      console.log('✅ Dashboard configuration saved to backend');
      
      // Success toast with action buttons
      addToast({
        message: `Profession "${displayName}," opprettet vellykket!`,
        type: 'success',
        duration: 5000 });
    } catch (error) {
      console.error('Error saving dashboard configuration:', error);
      addToast({
        message: 'Profession lagret, men dashboard-konfigurasjonen feilet',
        type: 'warning',
        duration: 4000 });
    }
    
    onClose();
  };
  
  const steps = [
    'Basic Information','Select Features','Distribute Plans','Dashboard Layout','Tab Configuration','Project Types','Dashboard Stats','Review & Save'
  ];
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Settings sx={{ color }} />
            <Box>
              <Typography variant="h6">
                {existingProfession ? 'Edit Profession' : 'Add New Profession'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Configure features, plans, and libraries
              </Typography>
            </Box>
          </Box>
          
          {/* Advanced Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Auto-save Status Indicator */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1 }}>
              {isSaving ? (
                <Tooltip title="Auto-saving...">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Save sx={{ fontSize: 16, color: 'primary.main' }} />
                    <Typography variant="caption" color="primary.main">Saving...</Typography>
                  </Box>
                </Tooltip>
              ) : lastSave > 0 ? (
                <Tooltip title={`Last saved: ${new Date(lastSave).toLocaleTimeString()} (v${currentVersion})`}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                    <Typography variant="caption" color="success.main">
                      Saved v{currentVersion}
                    </Typography>
                  </Box>
                </Tooltip>
              ) : (
                <Tooltip title="Auto-save enabled">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SaveAlt sx={{ fontSize: 16, color: 'text.disabled' }} />
                    <Typography variant="caption" color="text.disabled">Auto-save</Typography>
                  </Box>
                </Tooltip>
              )}
            </Box>
            
            <Divider orientation="vertical" flexItem />
            
            {/* Draft & Version Management */}
            {savedDrafts.length > 0 && (
              <Tooltip title={`${savedDrafts.length} saved drafts`}>
                <IconButton size="small" onClick={() => setShowDraftDialog(true)}>
                  <Badge badgeContent={savedDrafts.length} color="info">
                    <Drafts fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            
            {versionHistory.length > 0 && (
              <Tooltip title={`${versionHistory.length} versions`}>
                <IconButton size="small" onClick={() => setShowVersionHistory(true)}>
                  <Badge badgeContent={versionHistory.length} color="secondary">
                    <History fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="Save draft manually">
              <IconButton size="small" onClick={saveDraft}>
                <SaveAlt fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Divider orientation="vertical" flexItem />
            
            {enableClone && availableProfessions.length > 0 && (
              <Tooltip title="Clone existing profession">
                <IconButton size="small" onClick={() => setShowCloneDialog(true)}>
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            {enableImportExport && (
              <>
                <Tooltip title="Import configuration">
                  <IconButton size="small" onClick={() => setShowImportDialog(true)}>
                    <CloudUpload fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Export configuration">
                  <IconButton size="small" onClick={handleExport}>
                    <CloudDownload fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
            
            {enablePreview && professionId && (
              <Tooltip title="Preview dashboard">
                <IconButton size="small" onClick={() => setShowPreview(true)}>
                  <PreviewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            {enableAnalytics && (
              <Tooltip title="View analytics">
                <Badge badgeContent={tabAnalytics?.totalTabs || 0} color="primary">
                  <IconButton size="small" onClick={() => setShowAnalyticsDialog(true)}>
                    <Analytics fontSize="small" />
                  </IconButton>
                </Badge>
              </Tooltip>
            )}
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {/* @ts-ignore - MUI Stepper typing issue */}
        <Stepper activeStep={activeStep} orientation="vertical">
          {/* STEP 1: BASIC INFO */}
          <Step>
            <StepLabel>Basic Information</StepLabel>
            <StepContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <TextField
                  label="Profession ID"
                  value={professionId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfessionId(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g., real_estate_agent"
                  helperText="Lowercase, underscores only"
                  fullWidth
                  required
                />
                
                <TextField
                  label="Display Name"
                  value={displayName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                  placeholder="e.g., Real Estate Agent"
                  fullWidth
                  required
                />
                
                <TextField
                  label="Description"
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                  placeholder="e.g., Manage property listings, client tours, and marketing"
                  fullWidth
                  multiline
                  rows={2}
                />
                
                {/* Icon & Color Selection */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  {/* Icon Picker */}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Icon
                    </Typography>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => setShowIconPicker(!showIconPicker)}
                      startIcon={React.createElement(getIconComponent(icon), { sx: { color } })}
                      sx={{ justifyContent: 'flex-start', textTransform: 'none', p: 1.5 }}
                    >
                      {ALL_ICONS.find(i => i.id === icon)?.name || 'Select Icon'}
                    </Button>
                    
                    {/* Icon Picker Dialog */}
                    {showIconPicker && (
                      <Paper sx={{ position: 'absolute', zIndex: 130, mt: 1, p: 2, maxHeight: 400, overflowY: 'auto', width: '500px' }}>
                        {Object.entries(ICON_LIBRARY).map(([category, icons]) => (
                          <Box key={category} sx={{ mb: 2 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1 }}>
                              {category}
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
                              {icons.map((iconDef) => {
                                const IconComp = iconDef.component;
                                const isSelected = icon === iconDef.id;
                                
                                return (
                                  <Button
                                    key={iconDef.id}
                                    onClick={() => {
                                      setIcon(iconDef.id);
                                      setShowIconPicker(false);
                                    }}
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    sx={{
                                      aspectRatio: '1',
                                      minWidth: 0,
                                      p: 1,
                                      flexDirection: 'column',
                                      gap: 0.5,
                                      bgcolor: isSelected ? color : 'transparent',
                                      borderColor: isSelected ? color : 'divider', 
                                      '&:hover': {
                                        bgcolor: isSelected ? color : 'action.hover',
                                        borderColor: color
                                      }
                                    }}
                                  >
                                    <IconComp sx={{ color: isSelected ? 'white' : color, fontSize: 28 }} />
                                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: isSelected ? 'white' : 'text.secondary' }}>
                                      {iconDef.name.split(', ')[0]}
                                    </Typography>
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        ))}
                      </Paper>
                    )}
                  </Box>
                  
                  {/* Color Picker */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Brand Color
                    </Typography>
                    <TextField
                      type="color"
                      value={color}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
                      sx={{ width: 120 }}
                    />
                  </Box>
                </Box>
                
                {/* Icon Preview */}
                <Paper sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Preview:
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {React.createElement(getIconComponent(icon), { sx: { fontSize: 48, color } })}
                    <Box>
                      <Typography variant="h6" sx={{ color }}>
                        {displayName || 'Your Profession'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {description || 'Add a description...'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
                
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button variant="contained" onClick={() => setActiveStep(1)}>
                    Continue
                  </Button>
                  <Button onClick={onClose}>Cancel</Button>
                </Box>
              </Box>
            </StepContent>
          </Step>
          
          {/* STEP 2: SELECT FEATURES */}
          <Step>
            <StepLabel>Select Features</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Select which features this profession should have</AlertTitle>
                You can distribute them across plans in the next step
              </Alert>
              
              {Object.entries(AVAILABLE_FEATURES).map(([category, features]) => (
                <Accordion key={category} defaultExpanded={category === 'Core Platform'}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                      <CategoryIcon color="primary" />
                      <Typography fontWeight={600}>{category}</Typography>
                      <Chip 
                        label={`${features.filter(f => selectedFeatures.has(f.id)).length}/${features.length}`}
                        size="small"
                        color={features.some(f => selectedFeatures.has(f.id)) ? 'primary' : 'default'}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <FormGroup>
                      {features.map(feature => {
                        const libraries = getLibrariesForFeature(feature.id);
                        const isSelected = selectedFeatures.has(feature.id);
                        
                        return (
                          <Box
                            key={feature.id}
                            sx={{
                              p: 1.5,
                              mb: 1,
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: isSelected ? 'primary.main' : 'divider',
                              bgcolor: isSelected ? 'rgba(33, 150, 243, 0.05)' : 'background.paper'
                            }}
                          >
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => toggleFeature(feature.id)}
                                  color="primary"
                                />
                              }
                              label={
                                <Box>
                                  <Typography variant="subtitle2" fontWeight={600}>
                                    {feature.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {feature.description}
                                  </Typography>
                                  {libraries.length > 0 && (
                                    <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                      {libraries.slice(0, 3).map(lib => (
                                        <Chip
                                          key={lib.npmPackage}
                                          label={`${lib.libraryName} (${lib.bundleSize >= 1000 ? `${(lib.bundleSize / 1024).toFixed(1)}MB` : `${lib.bundleSize}KB`})`}
                                          size="small"
                                          sx={{ height: 16, fontSize: '0.65rem' }}
                                        />
                                      ))}
                                      {libraries.length > 3 && (
                                        <Chip
                                          label={`+${libraries.length - 3} more`}
                                          size="small"
                                          sx={{ height: 16, fontSize: '0.65rem' }}
                                        />
                                      )}
                                    </Box>
                                  )}
                                </Box>
                              }
                            />
                          </Box>
                        );
                      })}
                    </FormGroup>
                  </AccordionDetails>
                </Accordion>
              ))}
              
              <Paper sx={{ mt: 2, p: 2, bgcolor: 'info.light' }}>
                <Typography variant="subtitle2" gutterBottom>
                  📊 Selected Features: {selectedFeatures.size}
                </Typography>
                <Typography variant="body2">
                  Bundle Impact: {bundleImpact.totalSizeMB} MB ({bundleImpact.breakdown.length} libraries)
                </Typography>
              </Paper>
              
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button variant="contained" onClick={() => setActiveStep(2)} disabled={selectedFeatures.size === 0}>
                  Continue
                </Button>
                <Button onClick={() => setActiveStep(0)}>Back</Button>
              </Box>
            </StepContent>
          </Step>
          
          {/* STEP 3: DISTRIBUTE PLANS */}
          <Step>
            <StepLabel>Distribute Across Plans</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Assign each feature to a plan</AlertTitle>
                Drag features between BASIC (FREE), PRO ($15/mo), and ENTERPRISE ($50/mo)
              </Alert>
              
              {/* Plan Distribution Cards */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
                {/* BASIC PLAN */}
                <Card sx={{ border: '2px solid #4caf50' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: '#4caf50' }}>
                      🟢 BASIC (FREE)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      {planStats.basic} features
                    </Typography>
                    
                    <List dense>
                      {Array.from(selectedFeatures)
                        .filter(f => featurePlans.get(f) === 'basic')
                        .map(featureId => {
                          const feature = Object.values(AVAILABLE_FEATURES)
                            .flat()
                            .find(f => f.id === featureId);
                          
                          return (
                            <ListItem key={featureId} sx={{ px: 0 }}>
                              <ListItemText
                                primary={feature?.name || featureId}
                                secondary={
                                  <ToggleButtonGroup
                                    value={featurePlans.get(featureId) || 'basic'}
                                    exclusive
                                    onChange={(_, newPlan) => {
                                      if (newPlan) changePlan(featureId, newPlan);
                                    }}
                                    size="small"
                                    sx={{ mt: 0.5 }}
                                  >
                                    <ToggleButton value="basic" sx={{ fontSize: '0.7rem', py: 0.25 }}>
                                      FREE
                                    </ToggleButton>
                                    <ToggleButton value="pro" sx={{ fontSize: '0.7rem', py: 0.25 }}>
                                      PRO
                                    </ToggleButton>
                                    <ToggleButton value="enterprise" sx={{ fontSize: '0.7rem', py: 0.25 }}>
                                      ENT
                                    </ToggleButton>
                                  </ToggleButtonGroup>
                                }
                              />
                            </ListItem>
                          );
                        })}
                    </List>
                  </CardContent>
                </Card>
                
                {/* PRO PLAN */}
                <Card sx={{ border: '2px solid #2196f3' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: '#2196f3' }}>
                      🔵 PRO ($15/mo)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      {planStats.pro} features
                    </Typography>
                    
                    <List dense>
                      {Array.from(selectedFeatures)
                        .filter(f => featurePlans.get(f) === 'pro')
                        .map(featureId => {
                          const feature = Object.values(AVAILABLE_FEATURES)
                            .flat()
                            .find(f => f.id === featureId);
                          
                          return (
                            <ListItem key={featureId} sx={{ px: 0 }}>
                              <ListItemText
                                primary={feature?.name || featureId}
                                secondary={
                                  <ToggleButtonGroup
                                    value={featurePlans.get(featureId) || 'pro'}
                                    exclusive
                                    onChange={(_, newPlan) => {
                                      if (newPlan) changePlan(featureId, newPlan);
                                    }}
                                    size="small"
                                    sx={{ mt: 0.5 }}
                                  >
                                    <ToggleButton value="basic" sx={{ fontSize: '0.7rem', py: 0.25 }}>
                                      FREE
                                    </ToggleButton>
                                    <ToggleButton value="pro" sx={{ fontSize: '0.7rem', py: 0.25 }}>
                                      PRO
                                    </ToggleButton>
                                    <ToggleButton value="enterprise" sx={{ fontSize: '0.7rem', py: 0.25 }}>
                                      ENT
                                    </ToggleButton>
                                  </ToggleButtonGroup>
                                }
                              />
                            </ListItem>
                          );
                        })}
                    </List>
                  </CardContent>
                </Card>
                
                {/* ENTERPRISE PLAN */}
                <Card sx={{ border: '2px solid #9c27b0' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: '#9c27b0' }}>
                      🟣 ENTERPRISE ($50/mo)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      {planStats.enterprise} features
                    </Typography>
                    
                    <List dense>
                      {Array.from(selectedFeatures)
                        .filter(f => featurePlans.get(f) === 'enterprise')
                        .map(featureId => {
                          const feature = Object.values(AVAILABLE_FEATURES)
                            .flat()
                            .find(f => f.id === featureId);
                          
                          return (
                            <ListItem key={featureId} sx={{ px: 0 }}>
                              <ListItemText
                                primary={feature?.name || featureId}
                                secondary={
                                  <ToggleButtonGroup
                                    value={featurePlans.get(featureId) || 'enterprise'}
                                    exclusive
                                    onChange={(_, newPlan) => {
                                      if (newPlan) changePlan(featureId, newPlan);
                                    }}
                                    size="small"
                                    sx={{ mt: 0.5 }}
                                  >
                                    <ToggleButton value="basic" sx={{ fontSize: '0.7rem', py: 0.25 }}>
                                      FREE
                                    </ToggleButton>
                                    <ToggleButton value="pro" sx={{ fontSize: '0.7rem', py: 0.25 }}>
                                      PRO
                                    </ToggleButton>
                                    <ToggleButton value="enterprise" sx={{ fontSize: '0.7rem', py: 0.25 }}>
                                      ENT
                                    </ToggleButton>
                                  </ToggleButtonGroup>
                                }
                              />
                            </ListItem>
                          );
                        })}
                    </List>
                  </CardContent>
                </Card>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button variant="contained" onClick={() => setActiveStep(3)}>
                  Continue
                </Button>
                <Button onClick={() => setActiveStep(1)}>Back</Button>
              </Box>
            </StepContent>
          </Step>
          
          {/* STEP 4: DASHBOARD LAYOUT */}
          <Step>
            <StepLabel>Dashboard Layout</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Choose a dashboard layout template</AlertTitle>
                This determines the overall look and feel of the dashboard
              </Alert>
              
              <RadioGroup value={layoutTemplate} onChange={(e) => setLayoutTemplate(toLayoutTemplate(e.target.value, layoutTemplate))}>
                <Grid container spacing={2}>
                  {dashboardTemplates.map((template) => {
                    const TemplateIcon = template.icon === 'ViewCompact' ? ViewCompact :
                                         template.icon === 'PhotoLibrary' ? PhotoLibrary : Dashboard;
                    const isSelected = layoutTemplate === template.id;
                    
                    return (
                      <Grid item xs={12} md={4} key={template.id}>
                        <Card 
                          sx={{ 
                            border: isSelected ? `2px solid ${color}` : '1px solid',
                            borderColor: isSelected ? color : 'divider',
                            cursor: 'pointer',
                            transition: 'all 0.2s','&:hover': {
                              borderColor: color,
                              transform: 'translateY(-2px)',
                              boxShadow: 2 }
                          }}
                          onClick={() => setLayoutTemplate(template.id)}
                        >
                          <CardContent>
                            <FormControlLabel
                              value={template.id}
                              control={<Radio />}
                              label={
                                <Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <TemplateIcon sx={{ color }} />
                                    <Typography variant="h6">
                                      {template.name}
                                    </Typography>
                                  </Box>
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    {template.description}
                                  </Typography>
                                  <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
                                    {template.preview}
                                  </Typography>
                                </Box>
                              }
                              sx={{ m: 0, width: '100%' }}
                            />
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </RadioGroup>
              
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button variant="contained" onClick={() => setActiveStep(4)}>
                  Continue
                </Button>
                <Button onClick={() => setActiveStep(2)}>Back</Button>
              </Box>
            </StepContent>
          </Step>
          
          {/* STEP 5: TAB CONFIGURATION */}
          <Step>
            <StepLabel>Tab Configuration</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>🎯 Drag and Drop Tab Editor</AlertTitle>
                Drag tabs to reorder, toggle to enable/disable, add analytics insights
              </Alert>
              
              {/* Analytics Summary if available */}
              {tabAnalytics && enableAnalytics && (
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.light' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    📊 Tab Usage Analytics
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip 
                      label={`Most Used: ${tabAnalytics.mostUsedTab || 'Overview'}`}
                      size="small"
                      color="primary"
                    />
                    <Chip 
                      label={`Avg Tabs/Session: ${tabAnalytics.avgTabsPerSession || 4}`}
                      size="small"
                    />
                  </Box>
                </Paper>
              )}
              
              {/* Drag and Drop Tab List */}
              <DragDropContext onDragEnd={handleTabDragEnd}>
                <Droppable droppableId="tabs-list">
                  {(provided, snapshot) => (
                    <List
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      sx={{
                        bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                        borderRadius: 1,
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {selectedTabs.map((tab, index) => (
                        <Draggable key={tab.tabId} draggableId={tab.tabId} index={index}>
                          {(provided, snapshot) => (
                            <ListItem
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              sx={{
                                bgcolor: snapshot.isDragging ? 'action.selected' : 'background.paper',
                                border: '1px solid',
                                borderColor: snapshot.isDragging ? color : 'divider',
                                borderRadius: 1,
                                mb: 1,
                                boxShadow: snapshot.isDragging ? 4 : 0,
                                transition: 'all 0.2s','&:hover': {
                                  bgcolor: 'action.hover'
                                }
                              }}
                            >
                              <ListItemIcon>
                                <DragIndicator sx={{ cursor: 'grab', color: color }} />
                              </ListItemIcon>
                              <Chip 
                                label={index + 1}
                                size="small"
                                sx={{ mr: 1, width: 32, fontWeight: 600}}
                              />
                              <ListItemIcon>
                                <TabIcon />
                              </ListItemIcon>
                              <ListItemText 
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {tab.label}
                                    {tab.isDefault && (
                                      <Chip 
                                        label="DEFAULT"
                                        size="small"
                                        color="primary"
                                        sx={{ height: 18, fontSize: '0.65rem' }}
                                      />
                                    )}
                                  </Box>
                                }
                                secondary={`Tab ID: ${tab.tabId}`}
                              />
                              
                              {/* Analytics for this tab if available */}
                              {tabAnalytics?.tabUsage?.[tab.tabId] && (
                                <Tooltip title={`Used ${tabAnalytics.tabUsage[tab.tabId]} times`}>
                                  <Chip 
                                    label={`${tabAnalytics.tabUsage[tab.tabId]} views`}
                                    size="small"
                                    sx={{ mr: 1, height: 20, fontSize: '0.7rem' }}
                                  />
                                </Tooltip>
                              )}
                              
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={tab.isEnabled}
                                    onChange={(e) => {
                                      const newTabs = [...selectedTabs];
                                      newTabs[index] = { ...tab, isEnabled: e.target.checked };
                                      setSelectedTabs(newTabs);
                                    }}
                                  />
                                }
                                label="Enabled"
                              />
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const newTabs = selectedTabs.filter((_, i) => i !== index);
                                  setSelectedTabs(newTabs);
                                }}
                              >
                                <Delete />
                              </IconButton>
                            </ListItem>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </List>
                  )}
                </Droppable>
              </DragDropContext>
              
              <Button 
                startIcon={<Add />} 
                onClick={() => {
                  setSelectedTabs([...selectedTabs, {
                    tabId: `custom_tab_${Date.now()}`,
                    label: 'New Tab',
                    icon: 'Tab',
                    sortOrder: selectedTabs.length,
                    isEnabled: true,
                    isDefault: false
                  }]);
                }}
                sx={{ mt: 2 }}
              >
                Add Custom Tab
              </Button>
              
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button variant="contained" onClick={() => setActiveStep(5)}>
                  Continue
                </Button>
                <Button onClick={() => setActiveStep(3)}>Back</Button>
              </Box>
            </StepContent>
          </Step>
          
          {/* STEP 6: PROJECT TYPES */}
          <Step>
            <StepLabel>Project Types</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Define project types for this profession</AlertTitle>
                These will appear in project creation and filters
              </Alert>
              
              <List>
                {selectedProjectTypes.map((type, index) => (
                  <ListItem 
                    key={type.typeId}
                    sx={{ 
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1 }}
                  >
                    <ListItemIcon>
                      <Folder sx={{ color: type.color || '#2196f3' }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={type.displayName}
                      secondary={`Type ID: ${type.typeId}`}
                    />
                    <Chip 
                      label={type.color || '#2196f3'}
                      size="small"
                      sx={{ bgcolor: type.color || '#2196f3', color: 'white', mr: 1 }}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={type.isEnabled}
                          onChange={(e) => {
                            const newTypes = [...selectedProjectTypes];
                            newTypes[index] = { ...type, isEnabled: e.target.checked };
                            setSelectedProjectTypes(newTypes);
                          }}
                        />
                      }
                      label="Enabled"
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newTypes = selectedProjectTypes.filter((_, i) => i !== index);
                        setSelectedProjectTypes(newTypes);
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
              
              <Button 
                startIcon={<Add />} 
                onClick={() => {
                  setSelectedProjectTypes([...selectedProjectTypes, {
                    typeId: `custom_type_${Date.now()}`,
                    displayName: 'New Project Type',
                    icon: 'Folder',
                    color: '#2196f3',
                    isEnabled: true,
                    sortOrder: selectedProjectTypes.length
                  }]);
                }}
                sx={{ mt: 2 }}
              >
                Add Custom Project Type
              </Button>
              
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button variant="contained" onClick={() => setActiveStep(6)}>
                  Continue
                </Button>
                <Button onClick={() => setActiveStep(4)}>Back</Button>
              </Box>
            </StepContent>
          </Step>
          
          {/* STEP 7: DASHBOARD STATS */}
          <Step>
            <StepLabel>Dashboard Stats</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Select statistics to display on the dashboard</AlertTitle>
                These metrics will appear as cards on the Overview tab
              </Alert>
              
              <List>
                {selectedStats.map((stat, index) => (
                  <ListItem 
                    key={stat.statId}
                    sx={{ 
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1 }}
                  >
                    <ListItemIcon>
                      <BarChart sx={{ color: stat.color || '#2196f3' }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={stat.displayName}
                      secondary={`Format: ${stat.format} • ${stat.description || ''}`}
                    />
                    <FormControl size="small" sx={{ minWidth: 100, mr: 1 }}>
                      <Select
                        value={stat.size || 'medium'}
                        onChange={(e) => {
                          const newStats = [...selectedStats];
                          newStats[index] = { ...stat, size: e.target.value };
                          setSelectedStats(newStats);
                        }}
                      >
                        <MenuItem value="small">Small</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="large">Large</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={stat.isEnabled}
                          onChange={(e) => {
                            const newStats = [...selectedStats];
                            newStats[index] = { ...stat, isEnabled: e.target.checked };
                            setSelectedStats(newStats);
                          }}
                        />
                      }
                      label="Enabled"
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newStats = selectedStats.filter((_, i) => i !== index);
                        setSelectedStats(newStats);
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
              
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button variant="contained" onClick={() => setActiveStep(7)}>
                  Continue to Review
                </Button>
                <Button onClick={() => setActiveStep(5)}>Back</Button>
              </Box>
            </StepContent>
          </Step>
          
          {/* STEP 8: REVIEW */}
          <Step>
            <StepLabel>Review & Save</StepLabel>
            <StepContent>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    📋 Configuration Summary
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 2 }}>
                    <Typography fontWeight={600}>Profession ID:</Typography>
                    <Typography>{professionId}</Typography>
                    
                    <Typography fontWeight={600}>Display Name:</Typography>
                    <Typography>{displayName}</Typography>
                    
                    <Typography fontWeight={600}>Description:</Typography>
                    <Typography>{description}</Typography>
                    
                    <Typography fontWeight={600}>Brand Color:</Typography>
                    <Chip label={color} size="small" sx={{ bgcolor: color, color: 'white' }} />
                    
                    <Typography fontWeight={600}>Total Features:</Typography>
                    <Typography>{selectedFeatures.size}</Typography>
                    
                    <Typography fontWeight={600}>Bundle Size:</Typography>
                    <Typography>
                      {bundleImpact.totalSizeMB} MB ({bundleImpact.breakdown.length} libraries)
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" gutterBottom>
                    Plan Distribution:
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip 
                      label={`BASIC: ${planStats.basic} features`}
                      sx={{ bgcolor: '#4caf50', color: 'white' }}
                    />
                    <Chip 
                      label={`PRO: ${planStats.pro} features`}
                      sx={{ bgcolor: '#2196f3', color: 'white' }}
                    />
                    <Chip 
                      label={`ENTERPRISE: ${planStats.enterprise} features`}
                      sx={{ bgcolor: '#9c27b0', color: 'white' }}
                    />
                  </Stack>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" gutterBottom>
                    Dashboard Configuration:
                  </Typography>
                  <Box sx={{ ml: 2, mt: 1 }}>
                    <Typography variant="body2">
                      • Layout Template: <strong>{layoutTemplate === 'visual_heavy' ? 'Visual Heavy' : layoutTemplate === 'compact' ? 'Compact' : 'Expanded'}</strong>
                    </Typography>
                    <Typography variant="body2">
                      • Tabs: <strong>{selectedTabs.filter(t => t.isEnabled).length}</strong> enabled
                    </Typography>
                    <Typography variant="body2">
                      • Project Types: <strong>{selectedProjectTypes.filter(t => t.isEnabled).length}</strong> types
                    </Typography>
                    <Typography variant="body2">
                      • Dashboard Stats: <strong>{selectedStats.filter(s => s.isEnabled).length}</strong> metrics
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" gutterBottom>
                    Top 5 Libraries Activated:
                  </Typography>
                  <List dense>
                    {bundleImpact.breakdown.slice(0, 5).map((item, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText
                          primary={`${index + 1}. ${item.library}`}
                          secondary={`${item.sizeKB >= 1000 ? `${(item.sizeKB / 1024).toFixed(1)}MB` : `${item.sizeKB}KB`} • Feature: ${item.feature}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
              
              <Alert severity="success">
                <AlertTitle>✅ Ready to Save!</AlertTitle>
                Click "Save Configuration" to add this profession to the platform with complete dashboard setup.
              </Alert>
              
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button variant="contained" color="success" onClick={handleSave}>
                  Save Configuration
                </Button>
                <Button onClick={() => setActiveStep(6)}>Back</Button>
                <Button onClick={onClose}>Cancel</Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
      
      {/* Advanced Feature Dialogs */}
      
      {/* Clone Profession Dialog */}
      <Dialog open={showCloneDialog} onClose={() => setShowCloneDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ContentCopy sx={{ color }} />
            <Typography variant="h6">Clone Existing Profession</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Quickly start from an existing profession</AlertTitle>
            All features, tabs, and settings will be copied. You can then customize.
          </Alert>
          
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Profession to Clone</InputLabel>
            <Select
              value={selectedProfessionToClone}
              onChange={(e) => setSelectedProfessionToClone(e.target.value)}
              label="Select Profession to Clone"
            >
              {availableProfessions.map((prof) => (
                <MenuItem key={prof.professionId} value={prof.professionId}>
                  {prof.displayName || prof.professionId}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCloneDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => handleClone(selectedProfessionToClone)}
            disabled={!selectedProfessionToClone}
            startIcon={<ContentCopy />}
          >
            Clone Profession
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Import Dialog */}
      <Dialog open={showImportDialog} onClose={() => setShowImportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUpload sx={{ color }} />
            <Typography variant="h6">Import Profession Configuration</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Paste JSON configuration</AlertTitle>
            Import a previously exported profession configuration or from another platform
          </Alert>
          
          <TextField
            fullWidth
            multiline
            rows={12}
            value={importJson}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setImportJson(e.target.value)}
            placeholder='{"professionId":"...","displayName" : "...", ...}, '
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.85rem', 
              '& .MuiInputBase-input': {
                fontFamily: 'monospace'
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleImport}
            disabled={!importJson.trim()}
            startIcon={<Upload />}
          >
            Import Configuration
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Export Dialog */}
      <Dialog open={showExportDialog} onClose={() => setShowExportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudDownload sx={{ color }} />
            <Typography variant="h6">Export Profession Configuration</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            <AlertTitle>Configuration ready to export</AlertTitle>
            Copy to clipboard or download as JSON file
          </Alert>
          
          <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'grey.100', borderRadius: 1, mb: 2 }}>
            <Typography variant="caption" color="grey.400" display="block" gutterBottom>
              {professionId || 'profession'}-config.json ({exportedJson.length} characters)
            </Typography>
            <Box sx={{ 
              maxHeight: 400, 
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {exportedJson}
            </Box>
          </Paper>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined" 
              startIcon={<ContentCopy />}
              onClick={copyToClipboard}
              fullWidth
            >
              Copy to Clipboard
            </Button>
            <Button 
              variant="contained" 
              startIcon={<Download />}
              onClick={downloadJson}
              fullWidth
            >
              Download JSON
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Preview Dashboard Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PreviewIcon sx={{ color }} />
              <Typography variant="h6">Dashboard Preview: {displayName}</Typography>
            </Box>
            
            {/* A/B Test Toggle */}
            {enableABTesting && (
              <ToggleButtonGroup
                value={abTestVariant}
                exclusive
                onChange={(_, newValue) => newValue && setAbTestVariant(newValue)}
                size="small"
              >
                <ToggleButton value="A">
                  Variant A
                </ToggleButton>
                <ToggleButton value="B">
                  Variant B
                </ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Live Dashboard Preview</AlertTitle>
            See how your dashboard will look before saving
          </Alert>
          
          {/* Mock Dashboard Preview */}
          <Paper sx={{ p: 3, bgcolor: 'grey.50', minHeight: 500 }}>
            {/* Header */}
            <Box sx={{ mb: 3, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
                {React.createElement(getIconComponent(icon), { sx: { fontSize: 48, color } })}
                <Typography variant="h4" sx={{ color }}>
                  {displayName || 'Your Profession'}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {description || 'Add a description...'}
              </Typography>
            </Box>
            
            {/* Mock Tabs */}
            <Paper sx={{ mb: 3 }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', overflowX: 'auto', gap: 2, p: 2 }}>
                {selectedTabs.filter(tab => tab.isEnabled).map((tab, index) => (
                  <Chip
                    key={tab.tabId}
                    label={tab.label}
                    icon={<TabIcon />}
                    sx={{
                      bgcolor: index === 0 ? color : 'transparent',
                      color: index === 0 ? 'white' : 'text.primary',
                      fontWeight: index === 0 ? 600 : 400 }}
                  />
                ))}
              </Box>
            </Paper>
            
            {/* Mock Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {selectedStats.filter(s => s.isEnabled).slice(0, 4).map((stat) => (
                <Grid item xs={6} md={3} key={stat.statId}>
                  <Card sx={{ height: stat.size === 'large' ? 150 : stat.size === 'small' ? 80 : 100 }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        {stat.displayName}
                      </Typography>
                      <Typography variant="h4" sx={{ color }}>
                        {stat.format === 'currency' ? '125,000 kr' : stat.format === 'percentage' ? '85%' : '24'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            
            {/* Layout Template Indicator */}
            <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2" gutterBottom>
                Layout Template: <strong>{layoutTemplate === 'visual_heavy' ? 'Visual Heavy' : layoutTemplate === 'compact' ? 'Compact' : 'Expanded'}</strong>
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={layoutTemplate === 'visual_heavy' ? 33 : layoutTemplate === 'compact' ? 100 : 66}
                sx={{ height: 8, borderRadius: 4, bgcolor: 'grey.300' }}
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                {layoutTemplate === 'visual_heavy' ? 'Large cards, gallery-style' : 
                 layoutTemplate === 'compact' ? 'Dense layout, minimal whitespace' : 
                 'Balanced, spacious cards'}
              </Typography>
            </Paper>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close Preview</Button>
          <Button variant="contained" onClick={() => {
            setShowPreview(false);
            setActiveStep(7); // Go to review
          }}>
            Looks Good, Continue
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Analytics Dashboard Dialog */}
      <Dialog open={showAnalyticsDialog} onClose={() => setShowAnalyticsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Analytics sx={{ color }} />
            <Typography variant="h6">Tab Usage Analytics</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Data-driven tab configuration</AlertTitle>
            See which tabs are most used to optimize your dashboard
          </Alert>
          
          {tabAnalytics ? (
            <Box>
              {/* Summary Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Total Tabs</Typography>
                      <Typography variant="h4">{tabAnalytics.totalTabs || 0}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Most Used</Typography>
                      <Typography variant="h6" sx={{ fontSize: '1rem' }}>{tabAnalytics.mostUsedTab || 'N/A'}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Avg/Session</Typography>
                      <Typography variant="h4">{tabAnalytics.avgTabsPerSession || 0}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Sessions</Typography>
                      <Typography variant="h4">{tabAnalytics.totalSessions || 0}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {/* Tab Usage Chart */}
              {tabAnalytics.tabUsage && (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Tab Usage Breakdown
                  </Typography>
                  <List dense>
                    {Object.entries(tabAnalytics.tabUsage)
                      .sort(([, a], [, b]) => b - a)
                      .map(([tabId, count], index) => (
                        <ListItem key={tabId}>
                          <Chip 
                            label={index + 1}
                            size="small"
                            sx={{ mr: 2, width: 32 }}
                          />
                          <ListItemText
                            primary={tabId}
                            secondary={`${count} views`}
                          />
                          <LinearProgress 
                            variant="determinate"
                            value={Math.min(100, (count / (tabAnalytics.totalSessions || 1)) * 100)}
                            sx={{ width: 100, mr: 2 }}
                          />
                          <Typography variant="caption">
                            {Math.round((count / (tabAnalytics.totalSessions || 1)) * 100)}%
                          </Typography>
                        </ListItem>
                      ))}
                  </List>
                </Paper>
              )}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Analytics sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No analytics data available yet
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Analytics will be collected once professions are in use
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalyticsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Draft Management Dialog */}
      <Dialog open={showDraftDialog} onClose={() => setShowDraftDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Drafts sx={{ color }} />
            <Typography variant="h6">Saved Drafts ({savedDrafts.length})</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Resume where you left off</AlertTitle>
            Found {savedDrafts.length} saved draft(s). Select one to restore or continue with a fresh start.
          </Alert>
          
          <List>
            {savedDrafts.map((draft) => (
              <ListItem
                key={draft.id}
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1, '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <ListItemIcon>
                  {React.createElement(getIconComponent(draft.data.icon), { sx: { color: draft.data.color } })}
                </ListItemIcon>
                <ListItemText
                  primary={draft.displayName}
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        Step {draft.activeStep + 1}/8 • Saved {new Date(draft.timestamp).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" display="block">
                        {draft.data.selectedFeatures?.length || 0} features • {draft.data.selectedTabs?.length || 0} tabs
                      </Typography>
                    </Box>
                  }
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Restore />}
                    onClick={() => restoreDraft(draft)}
                  >
                    Restore
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => deleteDraft(draft.id)}
                  >
                    <Delete />
                  </IconButton>
                </Box>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDraftDialog(false)}>
            Start Fresh
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Version History Dialog */}
      <Dialog open={showVersionHistory} onClose={() => setShowVersionHistory(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <History sx={{ color }} />
            <Typography variant="h6">Version History ({versionHistory.length})</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Auto-save version history</AlertTitle>
            Restore any previous version (last 20 auto-saves)
          </Alert>
          
          {versionHistory.length > 0 ? (
            <List>
              {versionHistory.map((version, index) => (
                <ListItem
                  key={version.version}
                  sx={{
                    bgcolor: index === 0 ? 'primary.light' : 'background.paper',
                    border: '1px solid',
                    borderColor: index === 0 ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    mb: 1 }}
                >
                  <ListItemIcon>
                    <History sx={{ color: index === 0 ? 'primary.main': 'text.secondary' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={index === 0 ? 600 : 400}>
                          Version {version.version}
                        </Typography>
                        {index === 0 && (
                          <Chip label="CURRENT" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption">
                        {new Date(version.timestamp).toLocaleString()} • Step {(version.data.activeStep ?? 0) + 1}/8
                      </Typography>
                    }
                  />
                  {index !== 0 && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Restore />}
                      onClick={() => restoreVersion(version)}
                    >
                      Restore
                    </Button>
                  )}
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <History sx={{ fontSize: 64, color:'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No version history yet
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Versions are created as you make changes
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVersionHistory(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
    </Dialog>
  );
}
