// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getEvendiBookings, getEvendiAnalyticsSummary, evendiQueryKeys, type EvendiBooking, type EvendiAnalyticsSummary } from '@/lib/evendi-api';
import { useAuth } from '@/hooks/useAuth';
import type { 
  ShowcaseCategory, 
  ShowcaseSet, 
  ShowcaseCollection, 
  SearchQuery, 
  ItemAnnotation, 
  ShowcaseItem, 
  ClientSession, 
  UniversalShowcaseProps,
  ProfessionType 
} from '@/types/showcase';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import StreamingEmbed, { detectStreamingEmbed } from '@/components/showcase/StreamingEmbed';
import { useTheming } from '../../utils/theming-helper';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import { lightroomIntegrationService } from '../../services/lightroomIntegrationService';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import _getProfessionIcon from '@/utils/profession-icons';
// Wiring: getProfessionIcon is available for dynamic icon rendering
const getProfessionIcon = _getProfessionIcon;
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { useFileManagementStatus } from '../../contexts/FileManagementStatusContext';
import { FileStatusWrapper } from '../common/FileStatusIndicators';
import { useDemoMode, useDemoModeData } from '@/contexts/DemoModeContext';
import { AcademyProvider } from '@/contexts/AcademyContext';
import UniversalFileUpload from './UniversalFileUpload';
const ClientAuthDialog = React.lazy(() => import('../proofing/ClientAuthDialog'));
// Import Academy Dashboard
import AcademyDashboard from '../academy/AcademyDashboardCinematic';
// Import Universal Dashboard
import UniversalDashboard from './UniversalDashboard';
// Import CreatorHub Icons
import { AcademyIcon } from '../shared/CreatorHubIcons';
import DashboardIcon from '@mui/icons-material/Dashboard';
// Google Drive Integration
// Toast Notifications
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';
// New context imports
import { useProject } from '../../contexts/ProjectContext';
import { useSettings, type UserSettings } from '../../contexts/SettingsContext';
import { useTheme as useCustomTheme } from '../../contexts/ThemeContext';
import { useRealTime, type CollaborationParticipant } from '../../contexts/RealTimeContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardMedia,
  CardContent,
  Chip,
  IconButton,
  Fade,
  Paper,
  Avatar,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  Tooltip,
  useTheme,
  alpha,
  TextField,
  Divider,
  Badge,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  Grid,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Container,
  Slider,
  Switch,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormLabel,
  CircularProgress,
  LinearProgress,
  Autocomplete,
  ToggleButtonGroup,
  ToggleButton,
  Breadcrumbs,
  Link,
  Checkbox,
  FormGroup,
  Popper,
  ClickAwayListener,
  Grow,
  MenuList,
  Skeleton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Backdrop,
  Zoom,
  Card,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  PlayArrow,
  Favorite,
  FavoriteBorder,
  Share,
  Download,
  Fullscreen,
  GridView,
  ViewList,
  FilterList,
  Search,
  Close,
  PhotoLibrary,
  VideoLibrary,
  LibraryMusic,
  Description,
  Palette,
  CameraAlt,
  Comment,
  Security,
  ThumbUp,
  Reply,
  AccessTime,
  Send,
  Menu as MenuIcon,
  Home,
  Collections,
  Person,
  Settings,
  Info,
  Star,
  LocationOn,
  DragIndicator,
  SelectAll,
  CheckBox,
  CheckBoxOutlineBlank,
  Label,
  Category,
  FolderSpecial,
  Edit,
  Delete,
  CloudUpload,
  CloudDownload,
  Sync,
  Compare,
  PushPin,
  Tag,
  CropFree,
  ColorLens,
  ViewComfy,
  Apps,
  ViewModule,
  Undo,
  Redo,
  ContentCopy,
  FindInPage,
  Fingerprint,
  Speed as Speed,
  Cached,
  CalendarMonth,
  Camera,
  Visibility,
  VisibilityOff,
  Add,
  AddCircle,
  ChevronLeft,
  ChevronRight,
  AttachMoney,
  ShoppingCart,
  Payment,
  MoreVert,
  OpenInNew,
  Business,
  Email,
  Phone,
  Language,
  AccountCircle,
  CheckCircle,
  RadioButtonUnchecked,
  AutoFixHigh,
  AccountBalance,
  Tune,
  Brightness6,
  Contrast,
  BlurOn,
  Copyright,
  WaterDrop,
  DriveFileMove,
  Warning,
  Image,
  FolderOpen,
  Archive,
  Crop,
  Rotate90DegreesCcw,
  Flip,
  Transform,
  Straighten,
  Notifications,
  Movie,
  Videocam,
  MovieCreation,
  TrendingUp as TimelineIcon,
  Layers,
  VolumeUp,
  Subtitles,
  HighQuality,
  Hd,
  FourK,
  VideoSettings,
  GraphicEq,
  LibraryAdd,
  PlaylistPlay,
  Shuffle,
  Repeat,
  SkipNext,
  SkipPrevious,
  FastForward,
  FastRewind,
  QueueMusic,
  Equalizer,
  MusicNote,
  Chat,
  School,
  ArrowBack,
  CreateNewFolder,
  People,
  ExitToApp,
  NoteAdd,
  AutoAwesome,
  PlaylistAdd,
  Description as DescriptionIcon,
  Extension as ExtensionIcon,
  RocketLaunch as RocketLaunchIcon,
  MenuBook as MenuBookIcon,
  CheckCircle as CheckCircleIcon,
  WarningAmber as WarningAmberIcon,
  PhotoCamera as PhotoCameraIcon,
  Videocam as VideocamIcon,
  MusicNote as MusicNoteIcon,
  BusinessCenter as BusinessCenterIcon,
  ContentCut as ContentCutIcon,
  CameraAlt as CameraAltIcon,
  GrassOutlined as GrassIcon,
  TrendingUp as TrendingUpIcon,
  School as SchoolIcon,
  LocationOn as LocationOnIcon,
  GpsFixed as GpsFixedIcon,
} from '@mui/icons-material';
import { ProjectSelectorModal } from '../shared/ProjectSelectorModal';
import ProjectTimeline from '../project/ProjectTimeline';
import { ProjectProvider } from '@/contexts/ProjectContext';
import _ElegantVideoPlayer from '../ElegantVideoPlayer';
import CommandPalette from './CommandPalette';
import KeyboardShortcutsGuide from './showcase/KeyboardShortcutsGuide';
import WorkflowExecutor from './showcase/WorkflowExecutor';
import ContextualActionBar from './showcase/ContextualActionBar';
import QuickPreview from './showcase/QuickPreview';
import ActivityFeed from './showcase/ActivityFeed';
import ShareToCommunityDialog from '../community/ShareToCommunityDialog';
import SmartCollections from './showcase/SmartCollections';
import ComparisonView from './showcase/ComparisonView';
import BulkFolderUpload from './showcase/BulkFolderUpload';
import ClientActivityPanel from './showcase/ClientActivityPanel';
// Pro Tools Integration
import ProToolsConnection from '../protools/ProToolsConnection';
import PlayheadSync from '../protools/PlayheadSync';
import ProToolsCommentsPanel from '../protools/ProToolsCommentsPanel';
const VideographerVideoSuite = React.lazy(() => import('../videographer/VideographerVideoSuite'));
const PhotographerPhotoSuite = React.lazy(() => import('../photographer/PhotographerPhotoSuite'));
const VideoShowcaseEnhanced = React.lazy(() => import('./VideoShowcaseEnhanced'));
import ShowcaseCard, { formatFileSize } from './ShowcaseCard';


// Helper functions for timecode conversion
const secondsToTimecode = (seconds: number, fps: number = 30): string => {
  const totalFrames = Math.floor(seconds * fps);
  const hours = Math.floor(totalFrames / (fps * 3600));
  const minutes = Math.floor((totalFrames % (fps * 3600)) / (fps * 60));
  const secs = Math.floor((totalFrames % (fps * 60)) / fps);
  const frames = totalFrames % fps;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}:${frames.toString().padStart(2,'0')}`;
};

const timecodeToSeconds = (timecode: string): number => {
  const parts = timecode.split(':');
  if (parts.length !== 4) return 0;
  const [hours, minutes, seconds, frames] = parts.map(Number);
  const fps = 30;
  return hours * 3600 + minutes * 60 + seconds + frames / fps;
};

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

type ShowcasePricingPackage = {
  id: string;
  price: number;
  savings?: number;
  images?: number;
  minutes?: number;
  tracks?: number;
};

const getFallbackShowcasePricingData = (profession: ProfessionType) => {
  const pricingByProfession: Record<
    'photographer' | 'videographer' | 'music_producer',
    {
      perImage: number;
      contractedBase: number;
      packages: ShowcasePricingPackage[];
    }
  > = {
    photographer: {
      perImage: 150,
      contractedBase: 50,
      packages: [
        { id: 'photo-50', images: 50, price: 6000, savings: 1500 },
        { id: 'photo-100', images: 100, price: 10000, savings: 5000 },
        { id: 'photo-300', images: 300, price: 25000, savings: 20000 },
      ],
    },
    videographer: {
      perImage: 100,
      contractedBase: 30,
      packages: [
        { id: 'video-highlight', minutes: 3, price: 4500, savings: 500 },
        { id: 'video-story', minutes: 8, price: 8000, savings: 1500 },
        { id: 'video-full-day', minutes: 15, price: 12000, savings: 3000 },
      ],
    },
    music_producer: {
      perImage: 800,
      contractedBase: 3,
      packages: [
        { id: 'music-single', tracks: 1, price: 2500, savings: 500 },
        { id: 'music-ep', tracks: 4, price: 8000, savings: 2000 },
        { id: 'music-album', tracks: 10, price: 15000, savings: 5000 },
      ],
    },
  };

  const pricing =
    pricingByProfession[profession as keyof typeof pricingByProfession] ||
    pricingByProfession.photographer;

  return {
    pricing,
    projectPricing: {
      contracted_images: pricing.contractedBase,
      per_image: pricing.perImage,
    },
  };
};

const getFallbackEnhancementPresets = () => ({
  portrait: {
    description: 'Mykere hudtoner, balansert kontrast og lett skarphet for portretter.',
    options: {
      brightness: 4,
      contrast: 1.05,
      saturation: 6,
      sharpening: 1.1,
      noiseReduction: true,
      autoTone: true,
    },
  },
  wedding: {
    description: 'Varmere hvitbalanse og mer glod for bryllupsbilder.',
    options: {
      brightness: 6,
      contrast: 1.08,
      saturation: 8,
      sharpening: 1.05,
      noiseReduction: true,
      autoTone: true,
    },
  },
  landscape: {
    description: 'Mer dybde, klarhet og farger for landskap og miljo.',
    options: {
      brightness: 2,
      contrast: 1.12,
      saturation: 10,
      sharpening: 1.2,
      noiseReduction: false,
      autoTone: true,
    },
  },
  product: {
    description: 'Renere kontrast og noytral fargebalanse for produkter.',
    options: {
      brightness: 3,
      contrast: 1.14,
      saturation: 2,
      sharpening: 1.22,
      noiseReduction: true,
      autoTone: false,
    },
  },
  event: {
    description: 'Lofter eksponering og bevarer stemningen i dokumentariske eventbilder.',
    options: {
      brightness: 5,
      contrast: 1.06,
      saturation: 5,
      sharpening: 1.08,
      noiseReduction: true,
      autoTone: true,
    },
  },
  custom: {
    description: 'Manuelle justeringer for prosjekter som trenger en spesifikk look.',
    options: null,
  },
});

const deriveDayCategoriesFromShowcases = (
  showcases: Array<{
    id?: string;
    title?: string;
    category?: string;
    tags?: string[];
    duration?: number;
  }>
) => {
  const groupedCategories = new Map<
    string,
    Map<number, { id: string; dayNumber: number; itemCount: number; durationSeconds: number }>
  >();
  const dayPatterns = [
    /^(.*?)[\s:|-]*(?:dag|day)\s*(\d+)\b/i,
    /^(?:dag|day)\s*(\d+)[\s:|-]*(.*)$/i,
  ];

  for (const showcase of showcases) {
    const candidates = [showcase.category, showcase.title, ...(showcase.tags || [])].filter(
      (value): value is string => Boolean(value && value.trim())
    );

    for (const candidate of candidates) {
      let baseCategory = '';
      let dayNumber = 0;

      for (const pattern of dayPatterns) {
        const match = candidate.match(pattern);
        if (!match) continue;

        if (pattern === dayPatterns[0]) {
          baseCategory = match[1]?.trim() || 'Prosjekt';
          dayNumber = Number(match[2] || 0);
        } else {
          dayNumber = Number(match[1] || 0);
          baseCategory = match[2]?.trim() || 'Prosjekt';
        }
        break;
      }

      if (!dayNumber) continue;

      const normalizedBaseCategory = baseCategory.replace(/\s+/g, ' ').trim() || 'Prosjekt';
      const daysForCategory =
        groupedCategories.get(normalizedBaseCategory) ||
        new Map<number, { id: string; dayNumber: number; itemCount: number; durationSeconds: number }>();
      const existingDay = daysForCategory.get(dayNumber) || {
        id: `${normalizedBaseCategory.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-day-${dayNumber}`,
        dayNumber,
        itemCount: 0,
        durationSeconds: 0,
      };

      existingDay.itemCount += 1;
      existingDay.durationSeconds += Number(showcase.duration || 0);
      daysForCategory.set(dayNumber, existingDay);
      groupedCategories.set(normalizedBaseCategory, daysForCategory);
      break;
    }
  }

  return Array.from(groupedCategories.entries())
    .map(([baseCategory, dayMap]) => ({
      baseCategory,
      days: Array.from(dayMap.values())
        .sort((left, right) => left.dayNumber - right.dayNumber)
        .map((day) => ({
          id: day.id,
          name: `Dag ${day.dayNumber}`,
          hours:
            day.durationSeconds > 0
              ? Math.max(1, Math.round(day.durationSeconds / 3600))
              : Math.max(1, day.itemCount),
        })),
    }))
    .sort((left, right) => left.baseCategory.localeCompare(right.baseCategory, 'nb'));
};

type VideoJobType =
  | 'render'
  | 'watermark'
  | 'proxy'
  | 'multicam-sync'
  | 'streaming'
  | 'subtitle';

type ProxyQuality = '480p-h264' | '720p-h264' | '720p-prores' | '1080p-h264';
type MulticamAudioSource = 'camera1' | 'camera2' | 'external' | 'auto';
type StreamingProtocol = 'hls' | 'dash' | 'webrtc';
type StreamingBitrateProfile = '4k' | '1080p' | '720p';

const weddingPackageOptions = [
  'highlight',
  'feature',
  'ceremony',
  'speeches',
  'teaser',
] as const;

type WeddingPackageOption = (typeof weddingPackageOptions)[number];

const weddingPackageLabels: Record<WeddingPackageOption, string> = {
  highlight: 'Highlight Reel',
  feature: 'Feature Film',
  ceremony: 'Seremoni Full',
  speeches: 'Taler & Takk',
  teaser: 'Teaser / Trailer',
};

interface VideoSequenceRecord {
  id: string;
  sequenceName: string;
  chapters: string[];
  version: string;
  createdAt?: string;
}

interface VideoTimecodedCommentRecord {
  id: string;
  timecode: number;
  comment: string;
  version: string;
}

const UniversalShowcase: React.FC<UniversalShowcaseProps> = ({
  profession,
  userId,
  compact = false,
  maxItems = 12,
  isOwner = false,
  adminMode = false,
  clientMode = false,
  sessionIdd,
  clientEmail,
  isPublic = false,
  // Google Drive Integration
  enableGoogleDriveSync = false,
  onGoogleDriveSync,
  googleDriveFolderId,
  // Enhanced Master Integration
  integrationContext,
  onItemSelect,
  onItemUpdate,
  onItemDelete,
  // Real-time collaboration
  enableRealTimeSync = false,
  collaborationSessionId,
  // AI Features
  enableAIAnalysis = false,
  enableAutoTagging = false,
  enableSmartCollections = false
}) => {
  const { user } = useAuth();

  // Use provided userId or fallback to authenticated user - MUST be defined early as it's used by hooks below
  const effectiveUserId = userId || user?.id || user?.email || 'unknown-user';

  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  const theme = useTheme();
  
  // Client service pricing service integration
  const {
    formatCurrency
  } = useClientServicePricing();

  // Demo mode support
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const demoShowcaseItems = useDemoModeData<ShowcaseItem>('showcaseItems', []);

  // Toast Notifications - Implemented with MUI Snackbar
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    actions?: Array<{ label: string; action: () => void }>;
  } | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const addNotification = useCallback((notification: { message: string; type?: 'success' | 'error' | 'warning' | 'info'; actions?: Array<{ label: string; action: () => void }> }) => {
    setNotification({
      message: notification.message,
      type: notification.type || 'info',
      actions: notification.actions,
    });
    setNotificationOpen(true);
  }, []);

  const handleCloseNotification = useCallback(() => {
    setNotificationOpen(false);
  }, []);

  // File Management Status
  const { status: fileManagementStatus } = useFileManagementStatus();

  // Profession-specific watermark defaults
  const getProfessionWatermarkDefaults = (profession: string) => {
    switch (profession) {
      case 'photographer':
        return {
          watermark: 'text' as const,
          watermarkPosition: 'bottom-right' as const,
          watermarkText: 'Fotograf: CreatorHub',
          watermarkOpacity: 60,
          watermarkSize: 'small' as const
        };
      case 'videographer':
        return {
          watermark: 'both' as const,
          watermarkPosition: 'bottom-left' as const,
          watermarkText: 'Videograf: CreatorHub',
          watermarkOpacity: 80,
          watermarkSize: 'medium' as const
        };
      case 'music_producer':
        return {
          watermark: 'none' as const, // No visual watermark for music producers
          watermarkPosition: 'center' as const,
          watermarkText: 'Musikprodusent: CreatorHub',
          watermarkOpacity: 70,
          watermarkSize: 'large' as const,
          // Audio watermarking settings
          audioWatermarkEnabled: true,
          audioWatermarkMethod: 'steganography' as const,
          audioWatermarkStrength: 'medium' as const,
          audioWatermarkFrequency: 'medium' as const
        };
      case 'vendor':
        return {
          watermark: 'text' as const,
          watermarkPosition: 'top-right' as const,
          watermarkText: 'Leverandør: CreatorHub',
          watermarkOpacity: 50,
          watermarkSize: 'small' as const
        };
      default: return {
          watermark: 'none' as const,
          watermarkPosition: 'bottom-right' as const,
          watermarkText: 'CreatorHub',
          watermarkOpacity: 70,
          watermarkSize: 'small' as const
        };
    }
  };

  const professionWatermarkDefaults = getProfessionWatermarkDefaults(profession);

  // Showcase Settings
  const [showcaseSettings, setShowcaseSettings] = useState({
    // Button Visibility
    showDownloadButton: true,
    showFavoriteButton: true,
    showCommentButton: true,
    showSelectionButton: true,
    showFullscreenButton: false,
    enableContextMenu: true,
    showStatusText: true,
    compactMode: false,
    
    // Visual Layout
    cardSize: 'medium' as const,
    gridColumns: 4 as const,
    cardSpacing: 'normal' as const,
    imageAspectRatio: '16:9' as const,
    cardBorderRadius: 'medium' as const,
    cardShadow: 'medium' as const,
    
    // Mobile Responsive
    mobileColumns: 2 as const,
    touchGestures: true,
    mobileButtonSize: 'medium' as const,
    compactMobileView: false,
    
    // Search & Filter
    searchBarPosition: 'top' as const,
    showFilterBar: true,
    defaultSortBy: 'date' as const,
    defaultSortOrder: 'desc' as const,
    showQuickFilters: true,
    
    // Data Display
    showFileSize: true,
    showUploadDate: true,
    showViewCount: true,
    showLikeCount: true,
    showProfessionBadge: true,
    showAITags: false,
    maxItemsPerPage: 20 as const,
    
    // Theme & Styling
    cardBackground: 'dark' as const,
    accentColorMode: 'auto' as const,
    customAccentColor: '#',
    buttonStyle: 'outlined' as const,
    animationSpeed: 'normal' as const,
    
    // Interaction & Behavior
    clickAction: 'fullscreen' as const,
    hoverEffects: 'scale' as const,
    doubleClickAction: 'download' as const,
    keyboardShortcuts: true,
    autoPlayVideos: false,
    lazyLoading: true,
    
    // Performance
    imageQuality: 'high' as const,
    thumbnailSize: 'medium' as const,
    cacheDuration: '1d' as const,
    preloadImages: 'next3' as const,
    backgroundSync: true,
    
    // Security & Privacy - Use profession-specific defaults
    ...professionWatermarkDefaults,
    
    // Audio Watermarking (for music producers)
    audioWatermarkEnabled: false,
    audioWatermarkMethod: 'steganography' as const,
    audioWatermarkStrength: 'medium' as const,
    audioWatermarkFrequency: 'medium' as const,
    
    downloadProtection: 'none' as const,
    downloadPassword: undefined as string | undefined, // Password for download protection
    viewTracking: true,
    shareRestrictions: 'public' as const,
    clientAccess: 'full' as const,
    
    // Notifications
    newItemAlerts: 'inapp' as const,
    downloadNotifications: false,
    favoriteNotifications: false,
    commentNotifications: true,
    soundEffects: false,
    
    // Advanced Features
    bulkActions: true,
    dragAndDrop: true,
    keyboardNavigation: true,
    voiceCommands: false,
    aiSuggestions: false,
    analyticsTracking: true
});

  // Additional state for real-time features
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  
  // Academy navigation state
  const [showAcademy, setShowAcademy] = useState(false);
  // Dashboard navigation state
  const [showDashboard, setShowDashboard] = useState(false);

  // Quick action UI state
  const quickMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [sortMenuAnchorEl, setSortMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [quickTagFilter, setQuickTagFilter] = useState<string | null>(null);
  
  // SpeedDial and additional UI state
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showPushSettings, setShowPushSettings] = useState(false);
  const [searchAutocompleteValue, setSearchAutocompleteValue] = useState<string | null>(null);
  const [isLoadingSkeleton, setIsLoadingSkeleton] = useState(false);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // Initial viewMode now follows the profession's preferred layout from
  // ProfessionConfig.ui.layout — photographer/videographer default to
  // grid, music_producer to list, etc. The user can still override via
  // the toggle; we just stop forcing 'grid' for everyone.
  // (Carousel + timeline aren't yet rendered here — they fall back to
  // grid for now and are tracked as a follow-up; see task #71 design.)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'masonry'>('grid');
  const viewModeInitializedFromConfigRef = useRef(false);
  const [popperAnchorEl, setPopperAnchorEl] = useState<null | HTMLElement>(null);
  const popperOpen = Boolean(popperAnchorEl);

  // Push notifications - initialize subscription if user is logged in
  const { pushEnabled, isSupported, subscribe } = usePushNotifications(effectiveUserId);
  
  // Auto-subscribe to push notifications when component mounts (if supported and user is logged in)
  useEffect(() => {
    if (isSupported && effectiveUserId && effectiveUserId !== 'guest' && !pushEnabled) {
      // Optionally auto-subscribe, or let user enable manually
      // For now, we'll let users enable manually via settings
    }
  }, [isSupported, effectiveUserId, pushEnabled, subscribe]);

  // Demo mode data hydration for empty states
  useEffect(() => {
    if (isDemoMode && demoShowcaseItems.length && showcaseItems.length === 0) {
      setShowcaseItems(demoShowcaseItems);
    }
  }, [isDemoMode, demoShowcaseItems, showcaseItems.length]);

  // Load showcase settings (server first) with profession-specific defaults
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/user/kv/showcase-settings', { credentials: 'include' });
        const j = r.ok ? await r.json().catch(() => null) : null;
        const serverVal = j && typeof j === 'object' && 'value' in j ? j.value : (j?.data ?? j);
        const parsedSettings = serverVal || (() => { try { return JSON.parse(localStorage.getItem('showcase-settings') || 'null'); } catch { return null; }})();
        if (parsedSettings) {
          setShowcaseSettings(prev => ({ ...prev, ...professionWatermarkDefaults, ...parsedSettings }));
        } else {
          setShowcaseSettings(prev => ({ ...prev, ...professionWatermarkDefaults }));
        }
      } catch {
        const savedSettings = localStorage.getItem('showcase-settings');
        if (savedSettings) {
          try {
            const parsedSettings = JSON.parse(savedSettings);
            setShowcaseSettings(prev => ({ ...prev, ...professionWatermarkDefaults, ...parsedSettings }));
          } catch {
            setShowcaseSettings(prev => ({ ...prev, ...professionWatermarkDefaults }));
          }
        } else {
          setShowcaseSettings(prev => ({ ...prev, ...professionWatermarkDefaults }));
        }
      }
    })();
  }, [profession]);

  // Note: Project password sync is handled later via selectedProject state after it's declared
  
  
  
  // Profession configuration hook
  const { professionConfigs, isLoading: configsLoading } = useProfessionConfigs();
  
  // Profession adapter and dynamic professions for auto-scalability
  const { getProfessionDisplayName, getUserProfessionColor, getProfessionIcon: getDynamicProfessionIcon } = useDynamicProfessions();
  const { adaptDashboardTitle, adaptTabLabels } = useProfessionAdapter();
  
  // Get base config from useProfessionConfigs (for terminology, settings, workflows, etc.)
  const baseConfig = professionConfigs[profession] || null;
  
  // Enhance with dynamic profession branding (auto-scalable)
  // This makes UniversalShowcase auto-scalable - new professions added via ProfessionTypeManager will automatically work
  const professionConfig = useMemo(() => {
    if (!baseConfig) return null;
    
    const displayName = getProfessionDisplayName(profession);
    const professionColor = getUserProfessionColor(profession);
    const staticProfessionIcon = getProfessionIcon(profession);
    const professionIcon = getDynamicProfessionIcon(profession) || staticProfessionIcon;
    
    return {
      ...baseConfig,
      // Override with dynamic data if available (for auto-scalability)
      name: displayName || baseConfig.name,
      color: professionColor || baseConfig.color,
      icon: professionIcon || baseConfig.icon,
    };
  }, [profession, baseConfig, getProfessionDisplayName, getUserProfessionColor, getDynamicProfessionIcon]);

  // Sync the initial viewMode from the profession's preferred layout
  // exactly once after the config loads. After that the user owns the
  // setting via the ToggleButtonGroup — we don't keep snapping it back.
  // Carousel/timeline layouts aren't rendered yet so we coerce them to
  // grid (carousel) or list (timeline) as the closest visual neighbour.
  useEffect(() => {
    if (viewModeInitializedFromConfigRef.current) return;
    if (!professionConfig) return;
    const preferred = (professionConfig as any).ui?.layout as
      | 'grid' | 'masonry' | 'list' | 'carousel' | 'timeline' | undefined;
    if (!preferred) return;
    const mapped: 'grid' | 'list' | 'masonry' =
      preferred === 'list'     ? 'list'     :
      preferred === 'masonry'  ? 'masonry'  :
      preferred === 'timeline' ? 'list'     :  // closest fallback
      /* grid | carousel */     'grid';
    setViewMode(mapped);
    viewModeInitializedFromConfigRef.current = true;
  }, [professionConfig]);

  // Profession Config Functions - Properly implemented
  const terminology = useMemo(() => {
    if (!baseConfig) return {};
    return (baseConfig as any).terminology || {};
  }, [baseConfig]);

  const professionSettings = useMemo(() => {
    if (!baseConfig) return {};
    return (baseConfig as any).settings || {};
  }, [baseConfig]);

  const workflows = useMemo(() => {
    if (!baseConfig) return {};
    return (baseConfig as any).workflows || {};
  }, [baseConfig]);

  const ui = useMemo(() => {
    if (!baseConfig) return {};
    return (baseConfig as any).ui || {};
  }, [baseConfig]);

  const integrations = useMemo(() => {
    if (!baseConfig) return {};
    return (baseConfig as any).integrations || {};
  }, [baseConfig]);

  const getTerm = useCallback((key: string) => {
    return terminology[key] || key;
  }, [terminology]);

  const getSetting = useCallback((key: string) => {
    return professionSettings[key] || null;
  }, [professionSettings]);

  const getWorkflow = useCallback((key: string) => {
    return workflows[key] || null;
  }, [workflows]);

  const getUISetting = useCallback((key: string) => {
    return ui[key] || null;
  }, [ui]);

  const getIntegration = useCallback((key: string) => {
    return integrations[key] || null;
  }, [integrations]);

  const [selectedItem, setSelectedItem] = useState<ShowcaseItem | null>(null);
  const [sort, setSort] = useState<'date' | 'name' | 'favorite'>('date');
  const [filter, setFilter] = useState<string>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<{ id: number; title: string; description?: string; category: string; profession: string; status: string; driveUrl?: string; driveFolderId?: string } | null>(null);
  const [showUploadComponent, setShowUploadComponent] = useState(false);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [featuredItem, setFeaturedItem] = useState<ShowcaseItem | null>(null);
  
  // Multi-dag category states
  const [selectedDayCategory, setSelectedDayCategory] = useState<string | null>(null);
  const [showMultiDayView, setShowMultiDayView] = useState(false);
  const [dayCategories, setDayCategories] = useState<any[]>([]);
  
  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  
  // FASE 1: Proofing System States
  const [proofingSession, setProofingSession] = useState<any>(null);
  const [selectionCount, setSelectionCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showDeadlineWarning, setShowDeadlineWarning] = useState(false);
  const [clientSelections, setClientSelections] = useState<string[]>([]);
  
  // FASE 2: Enhanced Security States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [_authSessionData, setAuthSessionData] = useState<any>(null);
  const [sessionRequiresAuth, setSessionRequiresAuth] = useState(false);

  // Advanced Features States
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedBatchItems, setSelectedBatchItems] = useState<Set<string>>(new Set());
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [_searchQuery, setSearchQuery] = useState<SearchQuery>({});
  const [categories, setCategories] = useState<ShowcaseCategory[]>([]);
  const [sets, setSets] = useState<ShowcaseSet[]>([]);
  const [collections, setCollections] = useState<ShowcaseCollection[]>([]);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'masonry' | 'justified'>('grid');
  const [isLoading, setIsLoading] = useState(false);
  const [annotations, setAnnotations] = useState<ItemAnnotation[]>([]);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [filterChips, setFilterChips] = useState<Array<{id: string; label: string; type: string}>>([]);
  const [duplicates, setDuplicates] = useState<Map<string, string[]>>(new Map());
  const [undoStack, setUndoStack] = useState<Array<() => void>>([]);
  const [redoStack, setRedoStack] = useState<Array<() => void>>([]);
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<{ open: boolean; count: number; type: 'image' | 'video'; onConfirm: () => void }>({ open: false, count: 0, type: 'image', onConfirm: () => {} });

  // Enhanced Master Integration
  const { 
    integration,
    communication,
    dataFlow,
    componentRegistry,
    analytics,
    auth,
    features
} = useEnhancedMasterIntegration();

  const visualEditor = useVisualEditor();
  
  // Comprehensive Feature System for Universal Showcase
  const showcaseAccess = features.checkFeatureAccess('universal-showcase');
  const showcaseCreationAccess = features.checkFeatureAccess('showcase-creation');
  const showcaseManagementAccess = features.checkFeatureAccess('showcase-management');
  const portfolioManagementAccess = features.checkFeatureAccess('portfolio-management');
  const contentManagementAccess = features.checkFeatureAccess('content-management');
  const mediaUploadAccess = features.checkFeatureAccess('media-upload');
  const showcasePublishingAccess = features.checkFeatureAccess('showcase-publishing');
  const showcaseAnalyticsAccess = features.checkFeatureAccess('showcase-analytics');

  const { data: evendiBookingsData } = useQuery<EvendiBooking[]>({
    queryKey: evendiQueryKeys.bookings(),
    queryFn: () => getEvendiBookings(),
    enabled: !clientMode && !!effectiveUserId,
    staleTime: 60_000,
  });

  const { data: evendiAnalytics } = useQuery<EvendiAnalyticsSummary>({
    queryKey: evendiQueryKeys.analytics(),
    queryFn: () => getEvendiAnalyticsSummary(),
    enabled: !clientMode && !!effectiveUserId,
    staleTime: 60_000,
  });

  const evendiBookings = useMemo(() => evendiBookingsData ?? [], [evendiBookingsData]);

  const evendiSummary = useMemo(() => {
    const fallbackTotal = evendiBookings.length;
    const fallbackRevenue = evendiBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    const totalBookings = evendiAnalytics?.totalBookings ?? fallbackTotal;
    const totalRevenue = evendiAnalytics?.totalRevenue ?? fallbackRevenue;
    const upcomingEvents = evendiAnalytics?.upcomingEvents ?? evendiBookings.filter((booking) => {
      const eventDate = new Date(booking.eventDate);
      if (Number.isNaN(eventDate.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return eventDate >= today && booking.status !== 'cancelled';
    }).length;

    const statusCounts = evendiAnalytics?.bookingsByStatus?.length
      ? evendiAnalytics.bookingsByStatus
      : (['pending', 'confirmed', 'completed', 'cancelled'] as EvendiBooking['status'][]).map((status) => ({
          status,
          count: evendiBookings.filter((booking) => booking.status === status).length,
        }));

    return {
      totalBookings,
      totalRevenue,
      upcomingEvents,
      statusCounts,
    };
  }, [evendiAnalytics, evendiBookings]);

  const evendiUpcomingBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...evendiBookings]
      .filter((booking) => {
        const eventDate = new Date(booking.eventDate);
        if (Number.isNaN(eventDate.getTime())) return false;
        return eventDate >= today && booking.status !== 'cancelled';
      })
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
      .slice(0, 3);
  }, [evendiBookings]);
  
  // New context hooks
  const {
    currentProject,
    projects,
    loadProjects,
    updateProject,
    updateProjectSettings,
    getProjectSettings,
    updateProjectMetadata,
    getProjectMetadata: _getProjectMetadata,
    updateIntegrationStatus,
    getIntegrationStatus,
  } = useProject();
  
  const {
    settings: userSettings, 
    updateSetting, 
    getProfessionDefaults,
    mergeWithDefaults
} = useSettings();
  const publishingSettings = userSettings.publishing || { enableWebsitePublish: false, websiteTargets: [] };
  const _canPublishToWebsite = publishingSettings.enableWebsitePublish && publishingSettings.websiteTargets.length > 0;
  
  const { 
    theme: customTheme, 
    getProfessionTheme, 
    getComponentTheme,
    isDarkMode 
} = useCustomTheme();
  
  const { 
    isConnected, 
    emitEvent, 
    onEvent, 
    offEvent,
    createSession,
    joinSession,
    leaveSession,
    participants,
    localParticipant
} = useRealTime();

  // Load from project context and user settings
  useEffect(() => {
    // Load from project context if available
    if (currentProject?.settings?.showcaseSettings) {
      setShowcaseSettings(prev => ({ ...prev, ...currentProject.settings.showcaseSettings }));
    }
    
    // Load from user settings
    if (userSettings?.showcase) {
      setShowcaseSettings(prev => ({ ...prev, ...(userSettings.showcase as any) }));
    }
  }, [currentProject, userSettings]);

  // Publish to Evendi Dialog States
  const [showPublishToEvendiDialog, setShowPublishToEvendiDialog] = useState(false);
  const [selectedItemForEvendi, setSelectedItemForEvendi] = useState<ShowcaseItem | null>(null);
  const [evendiDeliveryForm, setEvendiDeliveryForm] = useState({ coupleName: '', coupleEmail: '', weddingDate: '', title: '', description: '' });
  const [evendiProjectId, setEvendiProjectId] = useState<string>('');
  const [evendiEventType, setEvendiEventType] = useState<string>('');
  const [evendiPublishing, setEvendiPublishing] = useState(false);
  const [evendiResult, setEvendiResult] = useState<{ accessCode: string; deliveryId: string; itemCount: number } | null>(null);

  useEffect(() => {
    if (!projects.length) {
      loadProjects().catch((error) => {
        console.warn('[UniversalShowcase] Failed to load projects:', error);
      });
    }
  }, [projects.length, loadProjects]);

  useEffect(() => {
    if (!showPublishToEvendiDialog) return;
    if (!evendiProjectId && selectedItemForEvendi?.projectId) {
      setEvendiProjectId(selectedItemForEvendi.projectId);
    }
    if (!evendiEventType && selectedItemForEvendi?.projectType) {
      setEvendiEventType(selectedItemForEvendi.projectType);
    }
  }, [showPublishToEvendiDialog, selectedItemForEvendi, evendiProjectId, evendiEventType]);

  useEffect(() => {
    if (!evendiProjectId || evendiEventType) return;
    const matchedProject = projects.find((project) => project.id === evendiProjectId);
    if (matchedProject?.projectType) {
      setEvendiEventType(matchedProject.projectType);
    }
  }, [evendiProjectId, evendiEventType, projects]);

  // Real-time event handling
  useEffect(() => {
    const handleItemSelected = (event: any) => {
      if (event.data.itemId) {
        setSelectedItems(prev => [...prev, event.data.itemId.toString()]);
        showInfoToast(`${event.data.userName} selected an item`);
  }
};

    const handleItemUpdated = (event: any) => {
      if (event.data.itemId) {
        showInfoToast(`${event.data.userName} updated an item`);
        // Refresh the item data
        setShowcaseItems(prev => prev.map(item => 
          item.id === event.data.itemId.toString() ? { ...item, ...event.data.updates } : item
        ));
      }
    };

    const handleUserJoined = (event: any) => {
      showInfoToast(`${event.data.userName} joined the showcase`);
    };

    if (isConnected) {
      onEvent('item_selected', handleItemSelected);
      onEvent('item_updated', handleItemUpdated);
      onEvent('user_joined', handleUserJoined);
    }

    return () => {
      if (isConnected) {
        offEvent('item_selected', handleItemSelected);
        offEvent('item_updated', handleItemUpdated);
        offEvent('user_joined', handleUserJoined);
      }
    };
}, [isConnected, onEvent, offEvent, setSelectedItems, setShowcaseItems]);

  // Load toast template from ToastDesigner (respects draft/publish system)
  const [toastTemplate, setToastTemplate] = useState<any>(null);
  const [liveUpdateEnabled, setLiveUpdateEnabled] = useState(false);
  
  // Google Drive Integration State
  const [googleDriveSyncStatus, setGoogleDriveSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [googleDriveItems, setGoogleDriveItems] = useState<any[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentGoogleDriveFolderId, setCurrentGoogleDriveFolderId] = useState<string | null>(null);
  
  // Google People/Contacts Integration State
  const [googleContactsStatus, setGoogleContactsStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [googleContacts, setGoogleContacts] = useState<any[]>([]);
  const [contactSyncProgress, setContactSyncProgress] = useState(0);

  // AI Analysis State
  const [aiAnalysisResults, setAiAnalysisResults] = useState<Map<string, any>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Real-time Collaboration State
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [activeCollaborators, setActiveCollaborators] = useState<Set<string>>(new Set());

  // Showcase Sharing and Overage Management State
  const [shareShowcaseDialogOpen, setShareShowcaseDialogOpen] = useState(false);
  const [overageDialogOpen, setOverageDialogOpen] = useState(false);
  const [selectedShowcaseData, setSelectedShowcaseData] = useState<any>(null);
  const [prefilledClient, setPrefilledClient] = useState<{ email: string; name: string } | undefined>(undefined);
  
  // Lightroom Plugin Dialog State
  const [lightroomPluginDialogOpen, setLightroomPluginDialogOpen] = useState(false);
  
  // Custom Categories and Sets Dialog State
  const [customCategoriesDialogOpen, setCustomCategoriesDialogOpen] = useState(false);
  const [customSetsDialogOpen, setCustomSetsDialogOpen] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: '',
    description: '',
    icon: '📁',
    color: '#ff8c00',
    parentId: '',
    sortOrder: 0 });
  const [newSetForm, setNewSetForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    coverImageId: '',
    sortOrder: 0 });

  // Videographer-specific states
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [videoVersion, setVideoVersion] = useState<'R1' | 'R2' | 'R3' | 'Final'>('R1');
  const [timecodedComments, setTimecodedComments] = useState<VideoTimecodedCommentRecord[]>([]);
  const [videoSequences, setVideoSequences] = useState<VideoSequenceRecord[]>([]);
  const [selectedLUT, setSelectedLUT] = useState<string>('rec709');
  const [selectedAudioFormat, setSelectedAudioFormat] = useState<string>('master');
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [showAdvancedVideoSuite, setShowAdvancedVideoSuite] = useState(false);
  const [showAdvancedPhotoSuite, setShowAdvancedPhotoSuite] = useState(false);
  const [showSequenceManager, setShowSequenceManager] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [showVideoWatermarkDialog, setShowVideoWatermarkDialog] = useState(false);
  
  // New advanced videographer features
  const [showProxyGenerator, setShowProxyGenerator] = useState(false);
  const [showMulticamSync, setShowMulticamSync] = useState(false);
  const [showChapterMarker, setShowChapterMarker] = useState(false);
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [showRenderPresets, setShowRenderPresets] = useState(false);
  const [showStreamingSetup, setShowStreamingSetup] = useState(false);
  const [showWeddingPackages, setShowWeddingPackages] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<'4k-master' | 'web-h264' | 'social-vertical' | 'custom'>('web-h264');
  const [selectedWeddingPackage, setSelectedWeddingPackage] = useState<WeddingPackageOption>('highlight');
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [proxyQuality, setProxyQuality] = useState<ProxyQuality>('720p-prores');
  const [keepOriginalProxyFiles, setKeepOriginalProxyFiles] = useState(true);
  const [multicamMasterSource, setMulticamMasterSource] = useState<MulticamAudioSource>('camera1');
  const [multicamSyncPrecision, setMulticamSyncPrecision] = useState(95);
  const [chapterMinimumSeconds, setChapterMinimumSeconds] = useState(30);
  const [streamingProtocol, setStreamingProtocol] = useState<StreamingProtocol>('hls');
  const [streamingBitrateProfiles, setStreamingBitrateProfiles] = useState<StreamingBitrateProfile[]>(['4k', '1080p', '720p']);
  const [newSequenceName, setNewSequenceName] = useState('Ny sekvens');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');

  // Google Photos Integration States
  const [googlePhotosConnected, setGooglePhotosConnected] = useState(false);
  const [googlePhotosAlbums, setGooglePhotosAlbums] = useState<any[]>([]);
  const [selectedGoogleAlbum, setSelectedGoogleAlbum] = useState<string | null>(null);
  const [googlePhotosItems, setGooglePhotosItems] = useState<any[]>([]);
  const [isLoadingGooglePhotos, setIsLoadingGooglePhotos] = useState(false);
  const [showGooglePhotosSync, setShowGooglePhotosSync] = useState(false);
  const [googlePhotosSyncProgress, setGooglePhotosSyncProgress] = useState(0);
  const [showGooglePhotosDialog, setShowGooglePhotosDialog] = useState(false);

  // AI Processing Dialog States
  const [showAutoTagDialog, setShowAutoTagDialog] = useState(false);
  const [showAutoCurateDialog, setShowAutoCurateDialog] = useState(false);
  const [showChapterDialog, setShowChapterDialog] = useState(false);
  const [showSubtitleDialog, setShowSubtitleDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  
  // Publish to Academy Dialog States
  const [showPublishToAcademyDialog, setShowPublishToAcademyDialog] = useState(false);
  const [selectedItemForPublish, setSelectedItemForPublish] = useState<ShowcaseItem | null>(null);
  const [publishToAcademyMode, setPublishToAcademyMode] = useState<'existing' | 'new'>('existing');
  
  // Share to Community Dialog States
  const [showShareToCommunityDialog, setShowShareToCommunityDialog] = useState(false);

  const [_showPublishToWebsiteDialog, _setShowPublishToWebsiteDialog] = useState(false);
  const [_selectedItemForWebsitePublish, _setSelectedItemForWebsitePublish] = useState<ShowcaseItem | null>(null);
  const [_websitePublishTargetId, _setWebsitePublishTargetId] = useState<string>('');
  const [_websitePublishStorage, _setWebsitePublishStorage] = useState<'google_drive' | 'youtube' | 'custom'>('google_drive');
  const [_websitePublishCategory, _setWebsitePublishCategory] = useState<string>('wedding-photo');
  const [_websitePublishing, _setWebsitePublishing] = useState(false);
  const [_websitePublishResult, _setWebsitePublishResult] = useState<{ projectId: string; projectSlug: string; url: string } | null>(null);
  const [showProToolsDialog, setShowProToolsDialog] = useState(false);
  const [proToolsSessionId, setProToolsSessionId] = useState<string | undefined>();
  const [selectedItemForCommunityShare, setSelectedItemForCommunityShare] = useState<ShowcaseItem | null>(null);
  const [selectedItemsForCommunityShare, setSelectedItemsForCommunityShare] = useState<ShowcaseItem[]>([]);
  const [selectedCourseForPublish, setSelectedCourseForPublish] = useState<string>('');
  const [newCourseData, setNewCourseData] = useState({
    title: '',
    description: '',
    category: 'photography',
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    moduleTitle: ''
  });
  
  // Keyboard Shortcuts Guide State
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  
  // Workflow Executor State
  const [showWorkflowExecutor, setShowWorkflowExecutor] = useState(false);
  
  // Quick Preview State
  const [quickPreviewOpen, setQuickPreviewOpen] = useState(false);
  const [quickPreviewIndex, setQuickPreviewIndex] = useState(0);
  
  // Activity Feed State
  const [activityFeedOpen, setActivityFeedOpen] = useState(false);
  
  // Smart Collections State
  const [showSmartCollections, setShowSmartCollections] = useState(false);

  // Bulk Folder Upload State
  const [showBulkFolderUpload, setShowBulkFolderUpload] = useState(false);
  const [currentParentFolderId, setCurrentParentFolderId] = useState<string | undefined>(undefined);

  // Comparison View State
  const [comparisonViewOpen, setComparisonViewOpen] = useState(false);
  
  // Client Activity Panel State
  const [showClientActivity, setShowClientActivity] = useState(false);
  
  // Project overview and timeline state (admin mode only)
  const [selectedProjectForOverview, setSelectedProjectForOverview] = useState<any | null>(null);
  const [projectOverviewOpen, setProjectOverviewOpen] = useState(false);
  const [projectTimelineOpen, setProjectTimelineOpen] = useState(false);
  const [selectedProjectForTimeline, setSelectedProjectForTimeline] = useState<any | null>(null);

  // Project State Update Dialog States
  const [projectStateUpdateOpen, setProjectStateUpdateOpen] = useState(false);
  const [selectedItemForStateUpdate, setSelectedItemForStateUpdate] = useState<ShowcaseItem | null>(null);
  const [newProjectState, setNewProjectState] = useState<'delivered' | 'in_review'>('in_review');
  
  useEffect(() => {
    const loadToastTemplate = () => {
      // Check if live update is enabled
      // Load live update flag from server KV
      fetch('/api/user/kv/toastLiveUpdateEnabled', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const v = j && typeof j === 'object' && 'value' in j ? j.value : (j?.data ?? j);
          const liveUpdate = (v ?? localStorage.getItem('toastLiveUpdateEnabled')) === 'true';
          setLiveUpdateEnabled(!!liveUpdate);
        })
        .catch(() => setLiveUpdateEnabled(localStorage.getItem('toastLiveUpdateEnabled') === 'true'));
      
      // Load published templates
      fetch('/api/user/kv/toastTemplatesPublished', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const v = j && typeof j === 'object' && 'value' in j ? j.value : (j?.data ?? j);
          const publishedTemplates = v || localStorage.getItem('toastTemplatesPublished');
          if (publishedTemplates) {
            try { setToastTemplate(typeof publishedTemplates === 'string' ? JSON.parse(publishedTemplates) : publishedTemplates); } catch { /* ignore parse errors */ }
          }
        })
        .catch(() => {
          const publishedTemplates = localStorage.getItem('toastTemplatesPublished');
          if (publishedTemplates) {
            try { setToastTemplate(JSON.parse(publishedTemplates)); } catch { /* ignore parse errors */ }
          }
        });
    };
    
    loadToastTemplate();
    
    // Listen for template updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'toastTemplatesPublished' || e.key === 'toastLiveUpdateEnabled') {
        loadToastTemplate();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
}, []);

  // Slice 9X.81 — Integration setup hook beholdt for fremtidig logging,
  // men debug-console.log fjernet (de var no-op for sluttbrukeren).

  // Video time tracking
  useEffect(() => {
    if (videoPlayerRef.current) {
      const updateTime = () => setCurrentVideoTime(videoPlayerRef.current?.currentTime || 0);
      videoPlayerRef.current.addEventListener('timeupdate', updateTime);
      return () => videoPlayerRef.current?.removeEventListener('timeupdate', updateTime);
    }
  }, []);

  // Slice 9X.81 — file-management-status monitoring (debug-logg fjernet)

  // Google Drive integration monitoring — varsler ved sync-progresjon
  useEffect(() => {
    if (googleDriveItems && googleDriveItems.length > 0
        && syncProgress && syncProgress > 0) {
      addNotification({ message: `Sync ${syncProgress}% complete`, type: 'info' });
    }
  }, [googleDriveItems, syncProgress, addNotification]);

  // Live update feature — polling stub (debug-logg fjernet)
  useEffect(() => {
    if (liveUpdateEnabled) {
      const interval = setInterval(() => {
        // Stub for fremtidig live-update-fetch
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [liveUpdateEnabled]);

  // Toast Helper Functions
  const getProfessionToastStyle = useCallback((type: 'success' | 'error' | 'warning' | 'info') => {
    const baseStyles = {
      borderRadius: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
    };

    switch (profession) {
      case 'photographer':
        return {
          ...baseStyles,
          backgroundColor: type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3'
        };
      case 'videographer':
        return {
          ...baseStyles,
          backgroundColor: type === 'success' ? '#8bc34a' : type === 'error' ? '#e91e63' : type === 'warning' ? '#ff5722' : '#03a9f4'
        };
      case 'music_producer':
        return {
          ...baseStyles,
          backgroundColor: type === 'success' ? '#9c27b0' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#673ab7'
        };
      case 'vendor':
        return {
          ...baseStyles,
          backgroundColor: type === 'success' ? '#00bcd4' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#009688'
        };
      default: return baseStyles;
    }
  }, [profession]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info', _title?: string) => {
    // Apply profession-specific toast styling
    const style = getProfessionToastStyle(type);
    // Slice 9X.81 — debug-logg fjernet; style brukes nedenfor i addNotification
    void style;

    addNotification({
      type,
      message
    });
  }, [addNotification, getProfessionToastStyle, profession]);

  const showSuccessToast = useCallback((message: string, title = 'Success') => {
    showToast(message, 'success', title);
  }, [showToast]);

  const showErrorToast = useCallback((message: string, title = 'Error') => {
    showToast(message, 'error', title);
  }, [showToast]);

  const showWarningToast = useCallback((message: string, title = 'Warning') => {
    showToast(message, 'warning', title);
}, [showToast]);

  const showInfoToast = useCallback((message: string, title = 'Info') => {
    showToast(message, 'info', title);
}, [showToast]);

  const showToastWithActions = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info', actions: Array<{label: string, action: () => void}>, _title?: string) => {
    addNotification({
      type,
      message,
      actions
    });
}, [addNotification]);

  // Template-specific toast functions
  const showTemplateToast = useCallback(async (templateId: string, customMessage?: string, customActions?: Array<{label: string, action: () => void}>) => {
    // Use toastTemplate if available, otherwise fetch from server KV or localStorage
    if (toastTemplate) {
      const template = toastTemplate;
      addNotification({
        type: template.type || 'info',
        message: customMessage || template.message || 'Template notification',
        actions: customActions || template.actions
      });
      return;
    }
    
    // Check server KV for published templates first, then localStorage
    let templatesObj: any = null;
    try {
      const r = await fetch('/api/user/kv/toastTemplatesPublished', { credentials: 'include' });
      const j = r.ok ? await r.json().catch(() => null) : null;
      const v = j && typeof j === 'object' && 'value' in j ? j.value : (j?.data ?? j);
      if (v) templatesObj = typeof v === 'string' ? JSON.parse(v) : v;
    } catch { /* ignore errors */ }
    if (!templatesObj) {
      const ls = localStorage.getItem('toastTemplatesPublished');
      if (ls) {
        try { templatesObj = JSON.parse(ls); } catch { /* ignore parse errors */ }
      }
    }

    const template = templatesObj?.[templateId];
    if (template) {
      addNotification({
        type: template.type || 'info',
        message: customMessage || template.message || 'Template notification',
        actions: customActions || template.actions
      });
      return;
    }

    // Fallback
    showToast(customMessage || 'Template notification', 'info', 'Notification');
  }, [addNotification, showToast, toastTemplate]);

  const queryClient = useQueryClient();

  // Theme settings aligned with the Academy visual shell
  const isDark = true; // Always use dark theme for professional look
  const academyAccent = '#f5a623';
  const academyCoolAccent = '#5279cc';
  const academySurface = 'rgba(11, 15, 24, 0.84)';
  const academySurfaceElevated = 'rgba(8, 11, 18, 0.92)';
  const academyHeaderBackground =
    'linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))';
  const academyBorder = 'rgba(255,255,255,0.08)';
  const _bgColor = '#06080d';
  const cardBg = academySurface;
  const textPrimary = '#edf0f7';
  const textSecondary = 'rgba(237,240,247,0.64)';
  // Dynamic accent color based on settings (memoized for performance and auto-scalability)
  const accentColor = useMemo(() => {
    if ((showcaseSettings.accentColorMode as string) === 'custom') {
      return showcaseSettings.customAccentColor;
    } else if ((showcaseSettings.accentColorMode as string) === 'random') {
      const colors = ['#ff6b35','#e53e3e','#9f7aea','#38b2ac','#f6ad55','#68d391'];
      return colors[Math.floor(Math.random() * colors.length)];
    } else {
      return academyAccent;
    }
  }, [showcaseSettings.accentColorMode, showcaseSettings.customAccentColor]);

  // Handle project selection for showcase
  const handleProjectSelected = async (project: { id: number; title: string; description?: string; category: string; profession: string; status: string; driveUrl?: string; driveFolderId?: string }) => {
    // Store selected project
    setSelectedProject(project);
    
    // Link project to showcase via API
    try {
      const response = await fetch('/api/showcase/link-project', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: project.id,
          profession,
          userId,
          driveUrl: project.driveUrl,
          driveFolderId: project.driveFolderId
  })
  });
      
      if (!response.ok) throw new Error('Failed to link project to showcase');
      
      const _linkedShowcase = await response.json();
      // Project linked to showcase successfully
      
      // Show upload component instead of reloading
      setShowUploadComponent(true);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/showcase/profession/${profession}`] });
      
} catch (error) {
      // Error linking project to showcase
      console.error('Failed to link project to showcase:', error);
      addNotification({ 
        message: 'Failed to link project to showcase', 
        type: 'error' 
      });
}
};

  // Google Photos Connection Check - owner/admin flows only
  const { data: googlePhotosStatus, isLoading: googlePhotosStatusLoading } = useQuery({
    queryKey: ['/api/google-photos/test-connection', effectiveUserId],
    queryFn: async () => {
      const response = await fetch('/api/google-photos/test-connection', {
        credentials: 'include',
      });
      if (!response.ok) return { success: false };
      return response.json();
},
    enabled: !clientMode && !!effectiveUserId
});

  // Update Google Photos connection status when data changes
  useEffect(() => {
    if (googlePhotosStatus) {
      setGooglePhotosConnected(googlePhotosStatus.success);
}
}, [googlePhotosStatus]);

  // Enhanced Master Integration - Component & Communication Registration
  useEffect(() => {
    const componentId = `universal-showcase-${effectiveUserId}`;
    
    // Register component in registry
    componentRegistry.registerComponent({
      id: componentId,
      name: 'Universal Showcase',
      type: 'universal',
      category: 'showcase',
      capabilities: ['showcase-display','item-selection','ai-analysis','google-drive-sync'],
      dependencies: [],
      props: ['items','profession','effectiveUserId'],
      events: ['item-selected','item-updated','item-deleted','showcase:updated','showcase-synced-to-drive'],
      dataKeys: ['showcase-items','selected-items','ai-analysis-results']
    });

    // Register in communication system for bi-directional messaging
    communication.registerComponent(componentId, 'showcase', [
      'data:read', 'data:write', 'event:emit', 'event:listen',
      'showcase:manage', 'item:select', 'item:update', 'item:delete',
      'sync:google-drive', 'sync:google-contacts', 'ai:analyze'
    ]);

    // Set up dataFlow nodes for bi-directional data flow
    dataFlow.registerNode({
      type: 'source',
      componentId: componentId,
      dataKey: 'universal-showcase:selectedItem',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: componentId,
      dataKey: 'universal-showcase:items',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
    });

    dataFlow.registerNode({
      type: 'destination' as const,
      componentId: componentId,
      dataKey: 'universal-dashboard:selectedProject',
      transform: (data: any) => data
    });

    dataFlow.registerNode({
      type: 'destination' as const,
      componentId: componentId,
      dataKey: 'universal-dashboard:selectedClient',
      transform: (data: any) => data
    });

    // Track feature usage
    features.trackFeatureUsage('universal-showcase', 'opened', {
      timestamp: Date.now(),
      component: 'UniversalShowcase',
      profession: profession,
      userId: effectiveUserId,
      viewMode: viewMode
    });

    return () => {
      componentRegistry.unregisterComponent(componentId);
      communication.unregisterComponent(componentId);
    };
  }, [componentRegistry, communication, dataFlow, effectiveUserId, profession, viewMode, features]);

  // State for synced project/client from UniversalDashboard
  const [syncedProject, setSyncedProject] = useState<any>(null);
  const [syncedClient, setSyncedClient] = useState<any>(null);

  // Listen to global events from other components (bi-directional communication)
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      // Project selection from UniversalDashboard
      if (message.type === 'project:selected' && message.data) {
        setSyncedProject(message.data);
      }
      // Client selection from UniversalDashboard
      if (message.type === 'client:selected' && message.data) {
        setSyncedClient(message.data);
      }
      // Data sync events
      if (message.type === 'data:sync') {
        if (message.data?.dataKey === 'universal-dashboard:selectedProject') {
          setSyncedProject(message.data.data);
        }
        if (message.data?.dataKey === 'universal-dashboard:selectedClient') {
          setSyncedClient(message.data.data);
        }
      }
      // Slice 9X.81 — pricing/showcase-update-broadcast: debug-loggene var
      // no-op for sluttbruker. Stubbene beholdt som dokumentasjon av
      // event-typer som andre komponenter kan lytte til.
    });
    return unsubscribe;
  }, [communication]);

  // Broadcast item selection to other components
  const handleItemSelectWithBroadcast = useCallback((item: ShowcaseItem) => {
    setSelectedItem(item);
    setFeaturedItem(item);
    setIsLoading(false);
    onItemSelect?.(item);
    
    // Broadcast selection to other components (PriceAdministration, etc.)
    communication.sendMessage({
      from: `universal-showcase-${effectiveUserId}`,
      to: 'all',
      type: 'showcase:item-selected',
      priority: 'medium',
      data: {
        item,
        profession,
        userId: effectiveUserId,
        timestamp: Date.now()
      }
    });
    
    // Sync via dataFlow
    dataFlow.syncData('universal-showcase:selectedItem', item);
  }, [communication, dataFlow, effectiveUserId, profession, onItemSelect]);

  // Handler to open project overview from showcase item
  const handleOpenProjectFromShowcase = useCallback(async (item: ShowcaseItem) => {
    if (!item.projectId) {
      // Show notification that this showcase item is not linked to a project
      showInfoToast('This showcase item is not linked to a project','No Project Link');
      return;
    }
    
    // Fetch project details based on projectId
    try {
      // Try to determine project type from showcase metadata or fetch from API
      // First, try to fetch project from wedding projects API
      const weddingRes = await fetch(`/api/wedding-projects/${item.projectId}`, { credentials: 'include' });
      if (weddingRes.ok) {
        const data = await weddingRes.json();
        if (data.success && data.project) {
          setSelectedProjectForOverview({
            ...data.project,
            projectType: 'photo',
          });
          setProjectOverviewOpen(true);
          return;
        }
      }
      
      // Try Story Arc projects
      const storyArcRes = await fetch(`/api/story-arc/projects/${item.projectId}`, { credentials: 'include' });
      if (storyArcRes.ok) {
        const data = await storyArcRes.json();
        if (data.success && data.project) {
          setSelectedProjectForOverview({
            ...data.project,
            projectType: 'story-arc',
          });
          setProjectOverviewOpen(true);
          return;
        }
      }
      
      // If project type cannot be determined, show generic project overview
      setSelectedProjectForOverview({
        id: item.projectId,
        name: item.title || 'Project',
        projectType: 'timeline', // Default to timeline
      });
      setProjectOverviewOpen(true);
    } catch (error) {
      console.error('Failed to fetch project details:', error);
      showErrorToast('Failed to fetch project details','Error');
    }
  }, [showInfoToast, showErrorToast]);

  // Handler to open project timeline overview
  const handleOpenProjectTimeline = useCallback((project: any) => {
    setSelectedProjectForTimeline(project);
    setProjectTimelineOpen(true);
    setProjectOverviewOpen(false);
  }, []);

  // Handler for project updates using context functions
  const handleProjectUpdate = useCallback(async (projectId: number, updates: any) => {
    try {
      await updateProject(String(projectId), updates);
      addNotification({ message: 'Project updated successfully', type: 'success' });
    } catch (error) {
      console.error('Project update error:', error);
      addNotification({ message: 'Failed to update project', type: 'error' });
    }
  }, [updateProject, updateProjectMetadata, effectiveUserId, addNotification]);

  // Handler for project settings updates
  const _handleProjectSettingsUpdate = useCallback(async (projectId: number, settings: any) => {
    try {
      await updateProjectSettings(String(projectId), settings);
      const currentSettings = await getProjectSettings(String(projectId));
      console.log('Updated settings:', currentSettings);
      addNotification({ message: 'Settings updated', type: 'success' });
    } catch (error) {
      console.error('Settings update error:', error);
      addNotification({ message: 'Failed to update settings', type: 'error' });
    }
  }, [updateProjectSettings, getProjectSettings, addNotification]);

  // Handler for integration status updates
  const _handleIntegrationUpdate = useCallback(async (integrationName: string, status: any) => {
    try {
      await updateIntegrationStatus(integrationName, status.name || integrationName, status);
      const currentStatus = await getIntegrationStatus(integrationName, status.name || integrationName);
      console.log('Integration status:', currentStatus);
    } catch (error) {
      console.error('Failed to update integration status:', error);
    }
  }, [updateIntegrationStatus, getIntegrationStatus]);

  // Handler to open in fullscreen editor
  const handleOpenInEditor = useCallback(() => {
    if (!selectedProjectForOverview) return;
    
    const { projectType, ...project } = selectedProjectForOverview;
    
    // Emit event to open in UniversalDashboard (if integrated)
    if (integration) {
      integration.emit('project:open', {
        projectId: project.id,
        projectType,
        openIn: 'editor'
      });
    }
    
    // Close overview dialog
    setProjectOverviewOpen(false);
  }, [selectedProjectForOverview, integration]);

  // Handler to open in new browser tab
  const handleOpenInNewTab = useCallback(() => {
    if (!selectedProjectForOverview) return;
    
    const { projectType, id } = selectedProjectForOverview;
    
    let url = '';
    switch (projectType) {
      case 'story-arc':
        url = `/story-arc/${id}`;
        break;
      case 'photo':
        url = `/photo-enhancement/${id}`;
        break;
      case 'audio':
        url = `/audio-enhancement/${id}`;
        break;
      case 'timeline':
        url = `/project-timeline/${id}`;
        break;
    }
    
      window.open(url, '_blank', 'noopener,noreferrer');
    setProjectOverviewOpen(false);
  }, [selectedProjectForOverview]);

  // User settings management with context
  const handleUserSettingUpdate = useCallback(async (key: string, value: any) => {
    try {
      // Settings are structured as category.key, split them
      const [category, ...rest] = key.split('.');
      const settingKey = rest.join('.');
      if (category && settingKey) {
        updateSetting(category as keyof UserSettings, { [settingKey]: value } as any);
      }
      console.log(`Setting ${key} updated to:`, value);
      addNotification({ message: `${key} updated`, type: 'success' });
    } catch (error) {
      console.error('User setting update error:', error);
      addNotification({ message: 'Failed to update setting', type: 'error' });
    }
  }, [updateSetting, addNotification]);

  // Apply profession defaults with merge
  const _applyProfessionDefaults = useCallback(async () => {
    try {
      const defaults = await getProfessionDefaults(profession);
      const merged = await mergeWithDefaults(defaults);
      console.log('Applied profession defaults:', merged);
      addNotification({ message: 'Profession defaults applied', type: 'success' });
    } catch (error) {
      console.error('Apply profession defaults error:', error);
      addNotification({ message: 'Failed to apply defaults', type: 'error' });
    }
  }, [getProfessionDefaults, mergeWithDefaults, profession, addNotification]);

  // Theme mode toggling
  const _handleThemeToggle = useCallback(() => {
    const newMode = isDarkMode ? 'light' : 'dark';
    handleUserSettingUpdate('themeMode', newMode);
    // Visual feedback using theme variables
    addNotification({ 
      message: `Theme switched to ${newMode} mode`, 
      type: 'info'
    });
  }, [isDarkMode, handleUserSettingUpdate, isDark, cardBg, addNotification]);

  // Audio watermarking service
  const applyAudioWatermark = useCallback(async (audioFile: File, watermarkSettings: any) => {
    if (profession !== 'music_producer' || !watermarkSettings.audioWatermarkEnabled) {
      return audioFile; // Return original file if watermarking is disabled
}

    try {
      // Create FormData for audio watermarking API
      const formData = new FormData();
      formData.append('audioFile', audioFile);
      formData.append('watermarkMethod', watermarkSettings.audioWatermarkMethod);
      formData.append('watermarkStrength', watermarkSettings.audioWatermarkStrength);
      formData.append('watermarkFrequency', watermarkSettings.audioWatermarkFrequency);
      formData.append('userId', effectiveUserId);
      formData.append('profession', profession);

      // Call audio watermarking API
      const response = await fetch('/api/audio/watermark', {
        method: 'POST',
        body: formData
});

      if (response.ok) {
        const watermarkedBlob = await response.blob();
        return new File([watermarkedBlob], audioFile.name, { type: audioFile.type });
  } else {
        console.warn('Audio watermarking failed, returning original file');
        return audioFile;
  }
} catch (error) {
      console.error('Audio watermarking error:', error);
      return audioFile; // Return original file on error
}
}, [profession, effectiveUserId]);

  // Individual item download function
  const handleDownload = useCallback(async (item: ShowcaseItem) => {
    try {
      if (!item.fileUrl) {
        console.error('No file URL available for download');
        return;
}

      // Check download protection
      if ((showcaseSettings.downloadProtection as string) === 'password') {
        // Get password from showcase settings or item
        const storedPassword = showcaseSettings.downloadPassword || item.downloadPassword;
        if (storedPassword) {
          const password = prompt('Skriv inn passord for å laste ned filen:');
          if (!password) {
            return; // User cancelled
          }
          
          // Verify password against stored hash (backend handles hashing/verification)
          try {
            const verifyResponse = await fetch('/api/user/kv/verify-password', {
              method: 'POST',
              headers: { 'Content-Type' : 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                key: 'showcase-settings',
                password: password,
              }),
            });
            
            const verifyResult = await verifyResponse.json();
            if (!verifyResult.verified) {
              addNotification({
                type: 'error',
                message: 'Feil passord. Prøv igjen.',
              });
              return;
            }
            // Password verified, continue with download
          } catch (verifyError) {
            console.error('Password verification failed:', verifyError);
            // Fallback: try direct comparison for legacy plain text passwords
            const isHashed = /^\$2[ayb]\$/.test(storedPassword);
            if (!isHashed && password !== storedPassword) {
              addNotification({
                type: 'error',
                message: 'Feil passord. Prøv igjen.',
              });
              return;
            } else if (isHashed) {
              addNotification({
                type: 'error',
                message: 'Kunne ikke verifisere passord. Prøv igjen.',
              });
              return;
            }
          }
        } else {
          // No password set - allow download but warn admin
          if (adminMode) {
            addNotification({
              type: 'warning',
              message: 'Ingen passord er satt for denne filen. Vurder å legge til passordbeskyttelse.',
            });
          }
        }
      } else if ((showcaseSettings.downloadProtection as string) === 'timelimit') {
        const now = new Date();
        const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
        if (now > limit) {
          showTemplateToast('showcase-time-limit-warning');
          return;
    }
  }

      // Create download item for UniversalDownload component
      const downloadItem = {
        url: item.fileUrl,
        filename: item.title || `download-${item.id}`,
        type: item.fileType === 'photo' ? 'image' : 
              item.fileType === 'video' ? 'video' : 
              item.fileType === 'audio' ? 'audio' : 'document',
        size: item.stats?.downloads || 0,
        description: item.description
};

      // Use UniversalDownload component functionality
      const response = await fetch(downloadItem.url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`, 'X-Download-Source' : 'CreatorHub-Norge', 'X-User-ID': effectiveUserId,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
  }
      
      let blob = await response.blob();
      
      // Apply audio watermarking for music producers
      if (profession === 'music_producer' && item.fileType === 'audio' && showcaseSettings.audioWatermarkEnabled) {
        try {
          const audioFile = new File([blob], downloadItem.filename, { type: blob.type });
          const watermarkedFile = await applyAudioWatermark(audioFile, showcaseSettings);
          blob = watermarkedFile;
          showTemplateToast('showcase-audio-watermark-success');
    } catch (error) {
          console.warn('Failed to apply audio watermarking:', error);
          // Continue with original file if watermarking fails
    }
  }
      
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadItem.filename;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      // Track download analytics
            if (analytics?.trackEvent && showcaseSettings.analyticsTracking) {
              analytics.trackEvent('item_downloaded', {
                itemId: item.id,
                profession,
                fileType: item.fileType,
                userId: effectiveUserId,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                settings: {
                  clickAction: showcaseSettings.clickAction,
                  downloadProtection: showcaseSettings.downloadProtection,
                  watermark: showcaseSettings.watermark
                }
              });
            }

      // Send download notification to admin/photographer if enabled
      // Only notify if downloadNotifications is enabled AND it's a client download (not admin downloading their own content)
      if (showcaseSettings.downloadNotifications && clientMode && !adminMode) {
        try {
          // Get photographer/admin userId (owner of the showcase)
          // In client mode, userId prop should be the photographer's ID
          const photographerUserId = userId || user?.id;
          
          if (!photographerUserId) {
            console.warn('Cannot send download notification: photographer userId not available');
            // Still track the download even if we can't notify
          } else {
            // Determine client name/email
            const clientName = clientEmail || item.clientName || 'En klient';
            const clientIdentifier = clientEmail || effectiveUserId;
            
            // Track download in client activity system (this also sends the notification)
            try {
              await fetch('/api/client-activity/download', {
                method: 'POST',
                headers: { 'Content-Type' : 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  photographerUserId: photographerUserId,
                  profession: profession, // Pass profession for profession-specific notifications
                  itemId: item.id,
                  itemTitle: item.title || downloadItem.filename,
                  itemType: item.fileType,
                  clientName: clientName,
                  clientEmail: clientEmail,
                  clientId: clientIdentifier,
                  projectId: item.projectId,
                  timestamp: new Date().toISOString(),
                }),
              }).catch((error) => {
                console.warn('Failed to track download in client activity:', error);
              });
            } catch (activityError) {
              console.warn('Client activity tracking error:', activityError);
            }
          }
        } catch (notificationError) {
          console.warn('Download notification error:', notificationError);
          // Don't fail the download if notification fails
        }
      }

      } catch (error) {
      console.error('Download failed:', error);
      // Show user-friendly error message with retry action
      showTemplateToast('showcase-download-error','Kunne ikke laste ned filen. Prøv igjen senere.');
}
}, [effectiveUserId, profession, analytics, showcaseSettings.downloadNotifications, clientMode, adminMode, userId, user?.id, clientEmail, addNotification]);

  // Enhanced Master Integration - Event Subscriptions
  useEffect(() => {
    const handleProjectSelected = (data: any) => {
      if (data.projectId) {
        // Update showcase based on selected project
        setFilter('all');
        setSelectedItem(null);
        handleProjectUpdate(data.projectId, { lastAccessed: Date.now() }).catch(console.error);
      }
    };

    const handleItemUpdate = (data: any) => {
      if (data.itemId) {
        // Handle item updates from other components
        onItemUpdate?.(data);
        addNotification({ message: 'Item updated', type: 'success' });
      }
    };

    const handleFolderCreated = (data: any) => {
      if (data.projectId && data.folderId) {
        // Update Google Drive folder ID when project folders are created
        setCurrentGoogleDriveFolderId(data.folderId);
        console.log('Project folders created, updating showcase folder ID:', data.folderId);
        addNotification({ message: 'Google Drive folder created', type: 'success' });
      }
    };

    const handleShowcaseSynced = (data: any) => {
      if (data.projectId) {
        // Refresh showcase data when synced to Drive
        console.log('Showcase synced to Drive:', data);
        addNotification({ message: 'Showcase synced to Google Drive', type: 'success' });
      }
    };

    // Subscribe to communication events using onMessage instead of subscribe
    const handleCommunicationMessage = (message: any) => {
      if (message.type === 'project:selected') {
        handleProjectSelected(message);
      } else if (message.type === 'item:updated') {
        handleItemUpdate(message);
      } else if (message.type === 'folder:created') {
        handleFolderCreated(message);
      } else if (message.type === 'showcase:synced') {
        handleShowcaseSynced(message);
      }
    };

    if (communication && (communication as any).onMessage) {
      const unsubscribe = (communication as any).onMessage(handleCommunicationMessage);
      return () => unsubscribe();
    }
  }, [communication, onItemUpdate, handleProjectUpdate, addNotification]);

  // Google Drive Integration - Sync Function with Automatic Folder Structure
  const syncToGoogleDrive = useCallback(async () => {
    if (!enableGoogleDriveSync) return;

    setGoogleDriveSyncStatus('syncing');
    setSyncProgress(0);

    try {
      const authHeader = await auth.getAuthHeader();

      // Get current showcase items
      const showcaseItems = integration.getData(`universal-showcase-${effectiveUserId}:items`) || [];

      // Get current project context from UniversalDashboard
      const currentProject = integration.getData(`universal-dashboard-${effectiveUserId}:selectedProject`);

      // Sync to Google Drive with automatic folder structure
      const response = await fetch('/api/google-drive/sync-showcase-to-project-folders', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: authHeader.Authorization,
        },
        body: JSON.stringify({
          items: showcaseItems,
          profession,
          userId: effectiveUserId,
          projectId: currentProject?.id,
          projectName: currentProject?.title || currentProject?.name,
          clientName: currentProject?.clientName,
               // Comprehensive 180+ folder structure covering all CreatorHub Norge components
               folderStructure: {
                 // CORE 8-FOLDER STRUCTURE (Foundation)
                 '01_Raw':'Raw files and original content','02_Edited':'Edited and processed files','03_Proofing':'Client proofing and selection files','04_Deliverables':'Final deliverables for client','05_Archive':'Archived and backup files','06_Client_Communication':'Client communication and feedback','07_Project_Documents':'Contracts, invoices, and project docs','08_Showcase' : 'Showcase and portfolio files',
                 
                 // STORY ARC STUDIO (9-16)
                 '09_Raw_Footage':'Original video recordings for story arcs','10_Edited_Files':'Processed video content','11_Client_Review':'Client review and approval files','12_Final_Delivery':'Final story arc deliverables','13_Scripts_Notes':'Video scripts and project notes','14_Moodboards_Inspiration':'Visual inspiration and moodboards','15_Contracts_Documents':'Story arc contracts and docs','16_Communication' : 'Client communication for story arcs',
                 
                 // DAVINCI RESOLVE INTEGRATION (17-24)
                 '17_Resolve_Projects':'DaVinci Resolve project files','18_Resolve_Timelines':'Timeline configurations','19_Resolve_Clips':'Video clip assets','20_Resolve_Transitions':'Transition effects','21_Resolve_Color_Grading':'Color correction files','22_Resolve_Audio_Mix':'Audio mixing projects','23_Resolve_Graphics':'Motion graphics assets','24_Resolve_Exports' : 'Final export files',
                 
                 // VIDEO PRODUCTION (25-40)
                 '25_Video_Projects':'Video production projects','26_Raw_Footage':'Original video recordings','27_Edited_Videos':'Processed video content','28_Color_Grading':'Color correction files','29_Audio_Mix':'Audio mixing and sound design','30_Graphics_Assets':'Motion graphics and overlays','31_Shot_Lists':'Video shot planning','32_Storyboards':'Visual storyboards','33_Equipment_Logs':'Video equipment tracking','34_Client_Reviews':'Video review and feedback','35_Drone_Footage':'Aerial video content','36_Time_Lapse':'Time-lapse sequences','37_Slow_Motion':'Slow-motion footage','38_Green_Screen':'Chroma key footage','39_Interview_Footage':'Interview recordings','40_B_Roll' : 'B-roll footage',
                 
                 // MUSIC PRODUCTION (41-60)
                 '41_Music_Projects':'Music production projects','42_Audio_Samples':'Sample libraries and loops','43_Mastering':'Final mastered tracks','44_Contracts_Music':'Music-specific contracts','45_Session_Notes':'Recording session notes','46_Stems':'Individual track stems','47_Mix_Down':'Mix down versions','48_Reference_Tracks':'Reference music','49_Equipment_Setup':'Music equipment configs','50_Collaboration':'Artist collaboration files','51_VST_Plugins':'Virtual instruments','52_Audio_Effects':'Audio processing effects','53_MIDI_Files':'MIDI sequences','54_Tempo_Maps':'Tempo and timing','55_Vocal_Recordings':'Vocal tracks','56_Instrument_Recordings':'Instrument tracks','57_Backing_Tracks':'Backing music','58_Live_Recordings':'Live performance recordings','59_Studio_Sessions':'Studio session files','60_Music_Licensing' : 'Licensing agreements',
                 
                 // PHOTOGRAPHY-SPECIFIC (61-80)
                 '61_Photo_Enhancement':'AI-enhanced photos','62_Composition_Analysis':'AI composition analysis','63_Moodboards':'Visual moodboards and inspiration','64_Equipment_Checklists':'Equipment management','65_Client_Galleries':'Wedding, Portrait, Commercial galleries','66_Editing_Presets':'Lightroom presets and templates','67_Location_Scouting':'Location photos and notes','68_Posing_References':'Posing guides and references','69_Color_Palettes':'Color schemes and palettes','70_Wedding_Timeline':'Wedding planning timelines','71_Engagement_Sessions':'Pre-wedding photography','72_Newborn_Sessions':'Newborn photography','73_Family_Sessions':'Family photography','74_Event_Coverage':'Event photography','75_Commercial_Shoots':'Commercial photography','76_Product_Photography':'Product shots','77_Headshots':'Professional headshots','78_Real_Estate':'Real estate photography','79_Food_Photography':'Food and restaurant shots','80_Street_Photography' : 'Street and documentary',
                 
                 // VENDOR/PRODUCT (81-100)
                 '81_Product_Assets':'Product images and materials','82_Marketing_Materials':'Promotional content','83_Technical_Docs':'Technical documentation','84_Customer_Support':'Support materials and FAQs','85_Release_Notes':'Product release documentation','86_User_Guides':'User manuals and guides','87_Testing_Reports':'Quality assurance reports','88_Deployment':'Deployment configurations','89_Feedback_Collection':'Customer feedback','90_Product_Updates':'Update files and patches','91_Plugin_Builds':'Plugin builds and versions','92_VST_Files':'VST plugin files','93_AU_Files':'Audio Unit files','94_AAX_Files':'AAX plugin files','95_WAV_Samples':'WAV sample files','96_MIDI_Files':'MIDI files','97_Installation_Files':'Installation packages','98_License_Documents':'License agreements','99_Warranty_Info':'Warranty information','100_Receipts' : 'Purchase receipts',
                 
                 // BUSINESS ADMINISTRATION (101-120)
                 '101_Financial_Records':'Invoicing and payments','102_Business_Analytics':'Business performance data','103_Lead_Management':'Lead tracking and CRM','104_Marketing_Campaigns':'Marketing materials','105_Client_Relations':'Client relationship management','106_Project_Timelines':'Project scheduling','107_Budget_Tracking':'Financial planning','108_Expense_Reports':'Expense documentation','109_Tax_Documents':'Tax-related files','110_Legal_Documents':'Legal compliance files','111_Contracts_General':'General contracts','112_Invoices':'Invoice documents','113_Time_Tracking':'Time registration','114_Meeting_Notes':'Meeting documentation','115_Project_Plans':'Project planning documents','116_Client_Profiles':'Client information','117_Proposals':'Project proposals','118_Quotes':'Price quotes','119_Agreements':'Service agreements','120_Policies' : 'Company policies',
                 
                 // UNIVERSAL COMPONENTS (121-140)
                 '121_File_Uploads':'Universal file upload temp files','122_Downloads_Queue':'Download queue and batch processing','123_AI_Analysis':'AI analysis results and metadata','124_Real_Time_Collaboration':'Real-time collaboration files','125_System_Logs':'System integration logs','126_Error_Reports':'Error tracking and debugging','127_Performance_Metrics':'Performance monitoring data','128_User_Preferences':'User settings and preferences','129_Notification_History':'Notification logs','130_Session_Data':'User session information','131_Showcase_Categories':'Showcase category mappings','132_Showcase_Grids':'Grid layouts and display settings','133_Showcase_Thumbnails':'Generated thumbnails','134_Photo_Enhancement':'AI-enhanced photos','135_Composition_Analysis':'AI composition analysis','136_Moodboards':'Visual moodboards and inspiration','137_Equipment_Checklists':'Equipment management','138_Client_Galleries':'Wedding, Portrait, Commercial galleries','139_Editing_Presets':'Lightroom presets and templates','140_Location_Scouting' : 'Location photos and notes',
                 
                 // SYSTEM & BACKUP (141-160)
                 '141_System_Backup':'System backup files','142_Memory_Card_Backup':'Memory card backups','143_Auto_Backup':'Automatic backup files','144_Disaster_Recovery':'Disaster recovery files','145_System_Updates':'System update files','146_Security_Logs':'Security monitoring','147_Access_Control':'Permission management','148_Data_Retention':'Data retention policies','149_Compliance_Reports':'GDPR compliance','150_Audit_Trails':'System audit logs','151_Backup_Verification':'Backup verification files','152_System_Health':'System health monitoring','153_Performance_Logs':'Performance monitoring','154_Error_Logs':'Error tracking','155_Access_Logs':'Access logging','156_Integration_Logs':'Integration monitoring','157_Backup_Schedules':'Backup scheduling','158_Recovery_Plans':'Recovery procedures','159_System_Configs':'System configurations','160_Monitoring_Dashboards' : 'Monitoring data',
                 
                 // ACADEMY & EDUCATION (161-170)
                 '161_Photography_Courses':'Photography education','162_Videography_Courses':'Videography education','163_Music_Production_Courses':'Music production education','164_Tutorial_Content':'Tutorial materials','165_FAQ_Database':'Frequently asked questions','166_Help_Desk':'Support ticket system','167_Feature_Requests':'Feature request tracking','168_Bug_Reports':'Bug tracking and fixes','169_User_Feedback':'User feedback collection','170_Knowledge_Base' : 'Knowledge management',
                 
                      // ADVANCED FEATURES (171-180)
                      '171_AI_Workflows':'AI automation workflows','172_Magic_Creator':'Magic Creator generated features','173_Smart_Notes':'Smart notes system','174_Google_Docs_Sync':'Google Docs integration','175_Cross_Platform_Sync':'Cross-platform synchronization','176_Real_Time_Updates':'Real-time data updates','177_Platform_Extensions':'Platform extensions','178_System_Integrations':'System integration files','179_User_Activity':'User activity tracking','180_Platform_Health' : 'Platform health monitoring',
                      
                      // GOOGLE PEOPLE & CONTACTS (181-190)
                      '181_Google_Contacts':'Google People API contacts','182_Contact_Search':'Contact search and discovery','183_Contact_Sync':'Contact synchronization','184_Collaborator_Contacts':'Project collaborator contacts','185_Client_Contacts':'Client contact management','186_Contact_Import':'Contact import from Google','187_Contact_Export':'Contact export to Google','188_Contact_Validation':'Contact data validation','189_Contact_History':'Contact interaction history','190_Contact_Integration' : 'Cross-platform contact integration'
                    },
                    targetFolder: '08_Showcase', // Showcase items go to the showcase folder
                    googleDriveFolderId: googleDriveFolderId || currentProject?.driveFolderId || currentGoogleDriveFolderId
                  })
                });

        if (response.ok) {
          const result = await response.json();
          setGoogleDriveItems(result.items || []);
          setGoogleDriveSyncStatus('success');
          onGoogleDriveSync?.(result.items || []);
        
      // Broadcast sync completion to other components
      communication.sendMessage({
        type: 'showcase-synced-to-drive',
        from: `universal-showcase-${effectiveUserId}`,
        to: 'all',
        priority: 'medium',
        data: {
          projectId: currentProject?.id,
          folderId: result.folderId,
          itemsCount: result.items?.length || 0,
          profession
        }
      });
      } else {
        throw new Error('Failed to sync to Google Drive');
      }
    } catch (error) {
      console.error('Google Drive sync error:', error);
      setGoogleDriveSyncStatus('error');
    } finally {
      setSyncProgress(100);
    }
}, [enableGoogleDriveSync, googleDriveFolderId, profession, effectiveUserId, componentRegistry, communication, onGoogleDriveSync]);

  // Google People/Contacts Integration - Sync Function
  const syncGoogleContacts = React.useCallback(async () => {
    setGoogleContactsStatus('syncing');
    setContactSyncProgress(0);

    try {
      const authHeader = await auth.getAuthHeader();

      // Get current showcase items
      const showcaseItems = integration.getData(`universal-showcase-${effectiveUserId}:items`) || [];

      // Get current project context from UniversalDashboard
      const currentProject = integration.getData(`universal-dashboard-${effectiveUserId}:selectedProject`);

      // Sync to Google People/Contacts
      const response = await fetch('/api/google/people/sync-contacts-to-showcase', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: authHeader.Authorization,
        },
        body: JSON.stringify({
          items: showcaseItems,
          profession,
          userId: effectiveUserId,
          projectId: currentProject?.id,
          projectName: currentProject?.title || currentProject?.name,
          clientName: currentProject?.clientName,
          contactTypes: [
            'collaborators','clients','vendors','team_members'
          ],
          syncOptions: {
            importFromGoogle: true,
            exportToGoogle: true,
            syncContactHistory: true,
            validateContacts: true
    }
    })
  });

      if (response.ok) {
        const result = await response.json();
        setGoogleContacts(result.contacts || []);
        setGoogleContactsStatus('success');
        
        // Broadcast sync completion to other components
        communication.sendMessage({
          type: 'contacts-synced-to-showcase',
          from: `universal-showcase-${effectiveUserId}`,
          to: 'all',
          priority: 'medium',
          data: {
            projectId: currentProject?.id,
            contactsCount: result.contacts?.length || 0,
            profession
          }
        });
      } else {
        throw new Error('Failed to sync Google Contacts');
      }
    } catch (error) {
      console.error('Google Contacts sync error:', error);
      setGoogleContactsStatus('error');
    } finally {
      setContactSyncProgress(100);
    }
}, [profession, effectiveUserId, integration, communication]);

  // AI Analysis - Audio Analysis for Music Producers
  const analyzeAudioContent = useCallback(async (item: ShowcaseItem) => {
    if (profession !== 'music_producer' || !enableAIAnalysis) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/analyze-audio', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          fileUrl: item.fileUrl,
          profession
        })
      });

      if (response.ok) {
        const analysis = await response.json();
        setAiAnalysisResults(prev => new Map(prev.set(item.id, analysis)));
        
        // Auto-tagging if enabled
        if (enableAutoTagging && analysis.tags) {
          const updatedItem = { ...item, tags: [...(item.tags || []), ...analysis.tags] };
          onItemUpdate?.(updatedItem);
        }
      }
    } catch (error) {
      console.error('AI analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
}, [profession, enableAIAnalysis, enableAutoTagging, onItemUpdate]);

  // Real-time Collaboration - WebSocket Connection
  // Slice 9X.69 — Hardkodet localhost:3001 → bruker VITE_COLLAB_SERVER_URL
  // hvis satt, ellers skip i prod (collab-server eksisterer ikke som prod-
  // tjeneste enda; spam-feilen flommet console på Stines dashboard).
  useEffect(() => {
    if (!enableRealTimeSync || !collaborationSessionId) return;
    const collabBase = (import.meta as any).env?.VITE_COLLAB_SERVER_URL;
    if (!collabBase) return; // ingen collab-server konfigurert → ikke prøv
    const wsProto = collabBase.startsWith('https') ? 'wss' : 'ws';
    const wsHost = collabBase.replace(/^https?:\/\//, '');
    const ws = new WebSocket(`${wsProto}://${wsHost}/collaboration/${collaborationSessionId}`);
    
    ws.onopen = () => {
      console.log('Collaboration WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'collaborator-joined':
          setCollaborators(prev => [...prev, data.collaborator]);
          setActiveCollaborators(prev => new Set(Array.from(prev).concat(data.collaborator.id)));
          break;
        case 'collaborator-left':
          setActiveCollaborators(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.collaboratorId);
            return newSet;
          });
          break;
        case 'item-updated':
          if (data.itemId) {
            onItemUpdate?.(data.item);
          }
          break;
        case 'item-selected':
          if (data.itemId) {
            setSelectedItem(data.item);
            onItemSelect?.(data.item);
          }
          break;
      }
    };

    ws.onclose = () => {
      console.log('Collaboration WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
}, [enableRealTimeSync, collaborationSessionId, onItemUpdate, onItemSelect]);

  // Fetch Google Photos Albums
  const { data: googlePhotosAlbumsData, isLoading: googlePhotosAlbumsLoading } = useQuery({
    queryKey: ['/api/google-photos/albums'],
    queryFn: async () => {
      const response = await fetch('/api/google-photos/albums', {
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': user?.email || ','
        }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : (Array.isArray(data.albums) ? data.albums : []);
},
    enabled: googlePhotosConnected
});

  const googlePhotosAlbumsQueryData = useMemo(
    () => googlePhotosAlbumsData ?? [],
    [googlePhotosAlbumsData],
  );

  // Update Google Photos albums when data changes
  useEffect(() => {
    if (googlePhotosAlbumsData) {
      setGooglePhotosAlbums(googlePhotosAlbumsQueryData);
    }
  }, [googlePhotosAlbumsData, googlePhotosAlbumsQueryData]);

  // Fetch Google Photos Items from Selected Album
  const { data: googlePhotosAlbumItemsData, isLoading: googlePhotosItemsLoading } = useQuery({
    queryKey: [`/api/google-photos/albums/${selectedGoogleAlbum}/photos`],
    queryFn: async () => {
      if (!selectedGoogleAlbum) return [];
      const response = await fetch(`/api/google-photos/albums/${selectedGoogleAlbum}/photos`, {
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': user?.email || ','
        }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : (Array.isArray(data.photos) ? data.photos : []);
},
    enabled: !!(googlePhotosConnected && selectedGoogleAlbum)
});

  const googlePhotosAlbumItems = useMemo(
    () => googlePhotosAlbumItemsData ?? [],
    [googlePhotosAlbumItemsData],
  );

  // Update Google Photos items when data changes
  useEffect(() => {
    if (googlePhotosAlbumItemsData) {
      setGooglePhotosItems(googlePhotosAlbumItems);
    } else if (!selectedGoogleAlbum) {
      setGooglePhotosItems([]);
    }
  }, [googlePhotosAlbumItems, googlePhotosAlbumItemsData, selectedGoogleAlbum]);

  // Fetch showcase items from existing showcase system
  const { data: showcasesData, isLoading: showcasesLoading, error: showcasesError, refetch } = useQuery({
    queryKey: [`/api/showcase/profession/${profession}`, effectiveUserId, sessionIdd],
    queryFn: async () => {
      console.log('[UniversalShowcase] Fetching showcases', { profession, effectiveUserId, sessionIdd });
      let url = `/api/showcase/profession/${profession}?userId=${effectiveUserId}`;
      if (clientMode && sessionIdd) {
        url += `&sessionIdd=${sessionIdd}`;
      }
      console.log('[UniversalShowcase] Fetch URL:', url);
      const response = await fetch(url, {
        headers: {
          'X-Google-Impersonation': 'true',
          'X-User-Email': user?.email || ''
        }
      });
      if (!response.ok) {
        console.error('[UniversalShowcase] Fetch failed:', response.status, response.statusText);
        throw new Error('Kunne ikke laste prosjekter. Prøv igjen senere.');
      }
      const data = await response.json();
      console.log('[UniversalShowcase] Fetched showcases:', data);
      return data;
    },
    enabled: !!effectiveUserId
  });

  const showcases = useMemo(() => showcasesData ?? [], [showcasesData]);

  // Fetch business info for copyright
  const { data: businessInfo } = useQuery({
    queryKey: ['/api/branding/business-info', effectiveUserId, profession],
    queryFn: () => apiRequest(`/api/branding/business-info?userId=${effectiveUserId}&profession=${profession}`),
    enabled: !!effectiveUserId && !!profession,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch custom categories for Lightroom plugin integration
  const { data: categoriesData, isLoading: _categoriesLoading } = useQuery({
    queryKey: ['/api/showcase/categories', profession, effectiveUserId],
    queryFn: async () => {
      const response = await fetch(`/api/showcase/categories?profession=${profession}&userId=${effectiveUserId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      return response.json();
},
    enabled: !!effectiveUserId && !!profession,
    staleTime: 5 * 60 * 1000, // 5 minutes
});

  const apiCategories = Array.isArray(categoriesData)
    ? categoriesData
    : (categoriesData?.categories || []);

  // Fetch client session data if in client mode (includes projectState)
  const { data: clientSession, isLoading: sessionLoading } = useQuery({
    queryKey: [`/api/showcase/client-session/${sessionIdd}`, clientEmail],
    queryFn: async () => {
      const response = await fetch(`/api/showcase/client-session/${sessionIdd}?clientEmail=${clientEmail}`);
      if (!response.ok) {
        throw new Error('Kunne ikke laste galleri-session.');
      }
      return response.json();
},
    enabled: !!(clientMode && sessionIdd && clientEmail)
});

  // Get project state from session data (default to 'in_review' for safety)
  const projectState = (clientSession?.projectState || clientSession?.project_state || 'in_review') as 'delivered' | 'in_review';

  // Fetch client's existing selections
  const { data: existingSelectionsData, refetch: refetchSelections } = useQuery({
    queryKey: [`/api/showcase/client-selections/${sessionIdd}`, clientEmail],
    queryFn: async () => {
      const response = await fetch(`/api/showcase/client-selections/${sessionIdd}?clientEmail=${clientEmail}`);
      if (!response.ok) {
        return [];
      }
      return response.json();
},
    enabled: !!(clientMode && sessionIdd && clientEmail)
	});

  const existingSelections = useMemo(
    () => existingSelectionsData ?? [],
    [existingSelectionsData],
  );

  // FASE 1: Fetch proofing session data for deadline and selection limits
  const { data: proofingSessionData, refetch: _refetchProofingSession } = useQuery({
    queryKey: [`/api/proofing/sessions/${sessionIdd || 'default'}`],
    queryFn: async () => {
      const response = await fetch(`/api/proofing/sessions/${sessionIdd}`);
      if (!response.ok) throw new Error('Kunne ikke laste proofing session');
      return response.json();
},
    enabled: !!(clientMode && sessionIdd),
    refetchInterval: 30000 // Update every 30 seconds to show remaining time
});

  // Showcase Sharing and Overage Management Mutations
  const shareShowcaseMutation = useMutation({
    mutationFn: async (shareData: {
      showcaseId: string;
      clientEmail: string;
      clientName: string;
      message?: string;
      photographerName: string;
      photographerCompany: string;
      projectState?: 'delivered' | 'in_review';
      projectId?: string | null;
}) => {
      return apiRequest('/api/showcase/email', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(shareData)
});
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/showcase/profession/${profession}`] });
}
});

  const overageEmailMutation = useMutation({
    mutationFn: async (overageData: {
      showcaseId: string;
      clientEmail: string;
      clientName: string;
      projectName: string;
      totalImages: number;
      contractLimit: number;
      pricePerImage: number;
}) => {
      return apiRequest('/api/showcase/send-overage-email', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(overageData)
});
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/showcase/profession/${profession}`] });
}
});

  // Project State Update Mutation
  const updateProjectStateMutation = useMutation({
    mutationFn: async (data: {
      sessionId: string;
      projectState: 'delivered' | 'in_review';
      projectId?: string;
    }) => {
      return apiRequest(`/api/showcase/client-session/${data.sessionId}/project-state`, {
        method: 'PUT',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          projectState: data.projectState,
          projectId: data.projectId,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/showcase/client-session/${sessionIdd}`, clientEmail] });
      queryClient.invalidateQueries({ queryKey: [`/api/showcase/profession/${profession}`] });
      addNotification({
        type: 'success',
        message: 'Project state updated successfully',
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        message: error?.message || 'Failed to update project state',
      });
    },
  });

  // Custom Categories and Sets Mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: {
      name: string;
      description?: string;
      icon?: string;
      color?: string;
      parentId?: string;
      sortOrder?: number;
      profession: string;
      userId: string;
}) => {
      return apiRequest('/api/showcase/categories', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(categoryData)
});
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/showcase/categories', ],});
      setCustomCategoriesDialogOpen(false);
      setNewCategoryForm({
        name: '',
        description: '',
        icon: '📁',
        color: '#ff8c00',
        parentId: '',
        sortOrder: 0 });
}
});

  const createSetMutation = useMutation({
    mutationFn: async (setData: {
      name: string;
      description?: string;
      categoryId: string;
      coverImageId?: string;
      sortOrder?: number;
      profession: string;
      userId: string;
}) => {
      return apiRequest('/api/showcase/sets', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(setData)
});
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/showcase/sets', ],});
      setCustomSetsDialogOpen(false);
      setNewSetForm({
        name: '',
        description: '',
        categoryId: '',
        coverImageId: '',
        sortOrder: 0 });
}
});

  // Will be defined later after Google Photos data is transformed

  // Session data state
  const [sessionData, setSessionData] = useState<ClientSession | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Quick Preview: Space bar (when item is hovered/focused)
      if (e.key === ', ' && !e.metaKey && !e.ctrlKey && !quickPreviewOpen && selectedItem) {
        e.preventDefault();
        const itemIndex = filteredItems.findIndex(item => item.id === selectedItem.id);
        if (itemIndex !== -1) {
          setQuickPreviewIndex(itemIndex);
          setQuickPreviewOpen(true);
        }
        return;
      }
      
      // Show Keyboard Shortcuts Guide: ? key
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !quickPreviewOpen) {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
        return;
      }
      
      // Command Palette: Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !quickPreviewOpen) {
        e.preventDefault();
        setCommandPaletteOpen(true);
}
      // Batch select all: Cmd/Ctrl + A
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && batchMode) {
        e.preventDefault();
        const allItemIds = new Set(items.map(item => item.id));
        setSelectedBatchItems(allItemIds);
}
      // Toggle batch mode: Cmd/Ctrl + B
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setBatchMode(!batchMode);
}
      // Undo: Cmd/Ctrl + Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
}
      // Redo: Cmd/Ctrl + Shift + Z
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleRedo();
}
      // Escape key - clear selections or close dialogs
      if (e.key === 'Escape') {
        if (quickPreviewOpen) {
          setQuickPreviewOpen(false);
        } else if (showKeyboardShortcuts) {
          setShowKeyboardShortcuts(false);
        } else if (batchMode && selectedBatchItems.size > 0) {
          setSelectedBatchItems(new Set());
        } else if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (selectedItem) {
          setSelectedItem(null);
        }
      }
};

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [batchMode, selectedBatchItems, commandPaletteOpen, selectedItem, showKeyboardShortcuts, quickPreviewOpen]);

  // Export video with preset function
  const exportVideoWithPreset = async (preset: string) => {
    try {
      const response = await fetch('/api/video/export', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          videoId: selectedItem?.id,
          preset,
          version: videoVersion,
          lut: selectedLUT,
          audioTrack: selectedAudioFormat
  })
  });

      if (!response.ok) throw new Error('Failed to export video');
      
      const _exportJob = await response.json();
      // Video export started successfully
      
      // Show success notification with actions
        showToastWithActions(
          `Video eksporteres for ${preset}. Du vil få en e-post når eksporten er ferdig.`, 'success',
        [
          {
            label: 'Se Status',
            action: () => {
              // Navigate to export status page
              window.open('/admin/exports', '_blank');
            }
          },
          {
            label: 'E-post Innstillinger',
            action: () => {
              // Open email settings
              window.open('/admin/settings/notifications', '_blank');
            }
          }
        ]
      );
} catch (error) {
      console.error('Video export error:', error);
      showErrorToast('Feil ved eksport av video. Prøv igjen.');
}
};

  // Handle command palette commands
  const handleCommand = (command: string) => {
    switch (command) {
      case 'new-collection':
        setShowCreateCollection(true);
        break;
      case 'batch-select':
        setBatchMode(true);
        break;
      case 'filter':
        setSidebarOpen(true);
        break;
      case 'grid-view':
        setLayoutMode('grid');
        break;
      case 'masonry-view':
        setLayoutMode('masonry');
        break;
      case 'list-view':
        setViewMode('list');
        break;
      case 'duplicate-detection':
        findDuplicates();
        break;
      case 'batch-archive':
        if (activeSelectionIds.length > 0) {
          void executeBulkOperation('archive', activeSelectionIds);
        }
        break;
      case 'batch-download':
        if (activeSelectionIds.length > 0) {
          void executeBulkOperation('bulk-download', activeSelectionIds);
        }
        break;
      case 'batch-move':
        if (activeSelectionIds.length > 0) {
          syncSelectionFromIds(activeSelectionIds);
          setShowMoveDialog(true);
        }
        break;
      // AI commands
      case 'auto-tag':
        if (profession === 'photographer' || profession === 'videographer') {
          setShowAutoTagDialog(true);
        }
        break;
      case 'auto-curate':
        if (profession === 'photographer' || profession === 'videographer') {
          setShowAutoCurateDialog(true);
    }
        break;
      // Videographer specific
      case 'generate-thumbnails':
        if (profession === 'videographer' && selectedItem?.fileType === 'video') {
          generateVideoThumbnails(selectedItem.id);
        }
        break;
      case 'add-chapters':
        if (profession === 'videographer' && selectedItem?.fileType === 'video') {
          setShowChapterDialog(true);
    }
        break;
      case 'add-subtitles':
        if (profession === 'videographer' && selectedItem?.fileType === 'video') {
          setShowSubtitleDialog(true);
    }
        break;
      // Social media export
      case 'export-instagram':
        if (selectedItem) {
          exportVideoWithPreset('instagram');
        }
        break;
      case 'export-youtube':
        if (selectedItem?.fileType === 'video') {
          exportVideoWithPreset('youtube');
        }
        break;
      case 'export-tiktok':
        if (selectedItem?.fileType === 'video') {
          exportVideoWithPreset('tiktok');
    }
        break;
      case 'undo':
        handleUndo();
        break;
      case 'redo':
        handleRedo();
        break;
      case 'bulk-create':
        setShowBulkFolderUpload(true);
        break;
      case 'bulk-upload':
        setShowBulkFolderUpload(true);
        break;
      default:
        showInfoToast(`Kommandoen "${command}" er ikke koblet til en konkret handling enda.`);
    }
  };

  // Undo/Redo functionality
  const handleUndo = useCallback(() => {
    if (undoStack.length > 0) {
      const action = undoStack[undoStack.length - 1];
      action();
      setUndoStack(prev => prev.slice(0, -1));
    }
}, [undoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length > 0) {
      const action = redoStack[redoStack.length - 1];
      action();
      setRedoStack(prev => prev.slice(0, -1));
}
}, [redoStack]);

  // Transform Google Photos items into showcase format
  const googlePhotosShowcaseItems = googlePhotosItems.map((photo: { id: string; url: string; title?: string; description?: string; filename?: string; baseUrl?: string; tags?: string[]; brandLogoUrl?: string }) => ({
    id: `google-photos-${photo.id}`,
    title: photo.filename || `Google Photos Bilde ${photo.id}`,
    fileType: 'photo' as const,
    thumbnailUrl: photo.baseUrl,
    fileUrl: photo.baseUrl,
    description: photo.description,
    tags: photo.tags || [],
    brandLogoUrl: photo.brandLogoUrl
}));

  // Transform showcases into profession-specific items - only use real data
  const transformedShowcaseItems = showcases.map((
    showcase: ShowcaseItem &
      Record<string, unknown> & {
        viewCount?: number;
        likeCount?: number;
        downloadCount?: number;
        thumbnailUrl?: string;
        fileUrl?: string;
        url?: string;
        isFeatured?: boolean;
      },
  ) => {
    const fileType =
      showcase.fileType ||
      (profession === 'photographer' || profession === 'enterprise'
        ? 'photo'
        : profession === 'videographer'
          ? 'video'
          : profession === 'music_producer'
            ? 'audio'
            : 'document');

    return {
      ...showcase,
      id: showcase.id,
      title: showcase.title,
      fileType,
      type: showcase.type || fileType,
      thumbnailUrl: showcase.thumbnailUrl,
      fileUrl: showcase.fileUrl || showcase.url,
      description: showcase.description,
      clientName: showcase.clientName,
      category: showcase.category,
      createdAt: showcase.createdAt,
      isFeatured: showcase.isFeatured,
      stats: {
        views: showcase.viewCount ?? showcase.stats?.views,
        likes: showcase.likeCount ?? showcase.stats?.likes ?? 0,
        downloads: showcase.downloadCount ?? showcase.stats?.downloads ?? 0,
      },
      tags: showcase.tags || [],
      brandLogoUrl: showcase.brandLogoUrl,
    };
  });

  // Combine showcase items with Google Photos items
  const items: ShowcaseItem[] = useMemo(() => {
    return [...transformedShowcaseItems, ...(googlePhotosConnected ? googlePhotosShowcaseItems : [])];
  }, [transformedShowcaseItems, googlePhotosConnected, googlePhotosShowcaseItems]);

  const activeSelectionIds = useMemo(() => {
    if (selectedImages.size > 0) {
      return Array.from(selectedImages);
    }
    if (selectedBatchItems.size > 0) {
      return Array.from(selectedBatchItems);
    }
    return [];
  }, [selectedBatchItems, selectedImages]);

  const activeSelectionIdSet = useMemo(
    () => new Set(activeSelectionIds),
    [activeSelectionIds],
  );

  const selectedItemsForActions = useMemo(
    () => items.filter((item) => activeSelectionIdSet.has(item.id)),
    [activeSelectionIdSet, items],
  );

  const selectedManagedItems = useMemo(
    () =>
      selectedItemsForActions.filter(
        (item) => !item.id.startsWith('google-photos-'),
      ),
    [selectedItemsForActions],
  );

  const selectedPhotoItems = useMemo(
    () => selectedItemsForActions.filter((item) => item.fileType === 'photo'),
    [selectedItemsForActions],
  );

  const selectedVideoItems = useMemo(
    () => selectedItemsForActions.filter((item) => item.fileType === 'video'),
    [selectedItemsForActions],
  );

  const selectedVideoIds = useMemo(
    () => selectedVideoItems.map((item) => item.id),
    [selectedVideoItems],
  );

  const selectedPrimaryVideo = useMemo(
    () => (selectedItem?.fileType === 'video' ? selectedItem : selectedVideoItems[0] || null),
    [selectedItem, selectedVideoItems],
  );

  const selectedPrimaryVideoUrl = selectedPrimaryVideo?.fileUrl || selectedPrimaryVideo?.thumbnailUrl || '';

  const selectedSequenceRecord = useMemo(
    () => videoSequences.find((sequence) => sequence.id === selectedSequence) || null,
    [selectedSequence, videoSequences],
  );

  const selectedSequenceChapters = selectedSequenceRecord?.chapters || [];

  const videoDurationSummary = useMemo(() => {
    const totalSeconds = selectedVideoItems.reduce(
      (sum, item) => sum + (item.duration || 0),
      0,
    );
    return {
      totalSeconds,
      formatted:
        totalSeconds > 0
          ? `${Math.floor(totalSeconds / 60)} min`
          : 'Ingen varighet registrert',
    };
  }, [selectedVideoItems]);

  const averageFrameRate = useMemo(() => {
    const frameRates = selectedVideoItems
      .map((item) => {
        const itemRecord = item as ShowcaseItem & Record<string, unknown>;
        const metadata =
          typeof itemRecord.metadata === 'object' && itemRecord.metadata !== null
            ? (itemRecord.metadata as Record<string, unknown>)
            : null;

        return (
          parseNumericValue(metadata?.frameRate) ||
          parseNumericValue(metadata?.fps) ||
          parseNumericValue(itemRecord.frameRate) ||
          parseNumericValue(itemRecord.fps)
        );
      })
      .filter((value): value is number => value !== null);

    if (frameRates.length === 0) {
      return null;
    }

    return frameRates.reduce((sum, value) => sum + value, 0) / frameRates.length;
  }, [selectedVideoItems]);

  const metadataCoverage = useMemo(() => {
    if (selectedManagedItems.length === 0) {
      return 0;
    }

    const enrichedItems = selectedManagedItems.filter(
      (item) =>
        Boolean(item.description?.trim()) ||
        Boolean(item.category?.trim()) ||
        Boolean(item.tags?.length),
    );

    return Math.round((enrichedItems.length / selectedManagedItems.length) * 100);
  }, [selectedManagedItems]);

  const autoCurationPreviewGroups = useMemo(() => {
    const grouped = new Map<string, number>();

    for (const item of selectedManagedItems) {
      const bucket =
        item.category ||
        item.projectType ||
        weddingPackageLabels[selectedWeddingPackage] ||
        item.fileType;
      grouped.set(bucket, (grouped.get(bucket) || 0) + 1);
    }

    return Array.from(grouped.entries())
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
  }, [selectedManagedItems, selectedWeddingPackage]);

  const versionComparisonEntries = useMemo(() => {
    return timecodedComments.map((comment) => ({
      id: comment.id,
      status:
        comment.version === 'Final'
          ? 'resolved'
          : comment.version === videoVersion
            ? 'open'
            : 'in_progress',
      primary: `${Math.round(comment.timecode)}s - ${comment.comment}`,
      secondary: `Versjon ${comment.version}`,
    }));
  }, [timecodedComments, videoVersion]);

  const syncSelectionFromIds = useCallback((itemIds: string[]) => {
    const nextSelection = new Set(itemIds);
    setSelectedImages(nextSelection);
    setSelectedBatchItems(nextSelection);
    setBatchMode(itemIds.length > 0);
  }, []);

  const downloadJsonArtifact = useCallback((fileName: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, []);

  const appendLocalCollection = useCallback((
    collectionId: string,
    name: string,
    itemIds: string[],
    description = '',
  ) => {
    const now = new Date();
    const nextCollection: ShowcaseCollection = {
      id: collectionId,
      name,
      description,
      items: itemIds,
      visibility: 'private',
      dynamic: false,
      tags: [],
      collaborators: [],
      createdAt: now,
      updatedAt: now,
      createdBy: effectiveUserId || 'system',
      version: 1,
    };

    setCollections((prev) => [
      nextCollection,
      ...prev.filter((collection) => collection.id !== collectionId),
    ]);
  }, [effectiveUserId]);

  const createCollectionFromSelection = useCallback(async (
    name: string,
    itemIds: string[],
    description = '',
  ) => {
    if (!effectiveUserId) {
      showWarningToast('Bruker mangler for å opprette samling.');
      return null;
    }

    const response = (await apiRequest('/api/showcase/collections', {
      method: 'POST',
      body: {
        name,
        description,
        items: itemIds,
        userId: effectiveUserId,
        profession,
        visibility: 'private',
      },
    })) as {
      id?: string;
      collection?: { id?: string; name?: string; description?: string; items?: string[] };
    };

    const collectionId = response.collection?.id || response.id;
    if (!collectionId) {
      throw new Error('Collection creation did not return an id');
    }

    appendLocalCollection(
      collectionId,
      response.collection?.name || name,
      response.collection?.items || itemIds,
      response.collection?.description || description,
    );

    await queryClient.invalidateQueries({ queryKey: ['/api/showcase/collections'] });
    return collectionId;
  }, [
    appendLocalCollection,
    effectiveUserId,
    profession,
    queryClient,
    showWarningToast,
  ]);

  const submitVideoJob = useCallback(async (
    jobType: VideoJobType,
    payload: Record<string, unknown>,
  ) => {
    if (selectedVideoIds.length === 0) {
      throw new Error('Velg videoer først');
    }

    const primaryVideoId = selectedItem?.fileType === 'video'
      ? selectedItem.id
      : selectedVideoIds[0];

    return (await apiRequest('/api/video/export', {
      method: 'POST',
      body: {
        jobType,
        itemIds: selectedVideoIds,
        videoId: primaryVideoId,
        version: videoVersion,
        lut: selectedLUT,
        audioTrack: selectedAudioFormat,
        ...payload,
      },
    })) as { jobId?: string; status?: string };
  }, [
    selectedAudioFormat,
    selectedItem,
    selectedLUT,
    selectedVideoIds,
    videoVersion,
  ]);

  const runAutoTagging = useCallback(async () => {
    if (selectedManagedItems.length === 0) {
      showWarningToast('Velg minst ett CreatorHub-element for auto-tagging.');
      return;
    }

    setIsAnalyzing(true);
    try {
      for (const item of selectedManagedItems) {
        const nextTags = Array.from(
          new Set(
            [
              profession,
              item.fileType,
              item.category,
              item.projectType,
              ...(item.tags || []),
              ...String(item.title || '')
                .toLowerCase()
                .split(/[^a-zA-Z0-9æøåÆØÅ]+/)
                .filter((token) => token.length >= 3),
            ]
              .map((token) => String(token || '').trim().toLowerCase())
              .filter(Boolean),
          ),
        ).slice(0, 12);

        await apiRequest(`/api/showcase/update-metadata/${item.id}`, {
          method: 'PUT',
          body: { tags: nextTags },
        });

        setAiAnalysisResults((prev) => {
          const next = new Map(prev);
          next.set(item.id, {
            tags: nextTags,
            updatedAt: new Date().toISOString(),
          });
          return next;
        });
      }

      showSuccessToast(`Auto-tagging fullfort for ${selectedManagedItems.length} elementer.`);
      setShowAutoTagDialog(false);
      refetch();
    } catch (error) {
      console.error('Auto-tagging failed:', error);
      showErrorToast('Kunne ikke fullfore auto-tagging.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    profession,
    refetch,
    selectedManagedItems,
    showErrorToast,
    showSuccessToast,
    showWarningToast,
  ]);

  const runAutoCuration = useCallback(async () => {
    if (selectedManagedItems.length === 0) {
      showWarningToast('Velg minst ett CreatorHub-element for auto-kuratering.');
      return;
    }

    const groupedItems = new Map<string, string[]>();
    for (const item of selectedManagedItems) {
      const bucket =
        item.category ||
        item.projectType ||
        weddingPackageLabels[selectedWeddingPackage] ||
        item.fileType;
      const nextBucket = groupedItems.get(bucket) || [];
      nextBucket.push(item.id);
      groupedItems.set(bucket, nextBucket);
    }

    const groupsToCreate = Array.from(groupedItems.entries()).slice(0, 3);
    try {
      for (const [groupName, itemIds] of groupsToCreate) {
        await createCollectionFromSelection(
          groupName,
          itemIds,
          `Auto-kuratert samling for ${groupName}`,
        );
      }
      showSuccessToast(`Opprettet ${groupsToCreate.length} kuraterte samlinger.`);
      setShowAutoCurateDialog(false);
    } catch (error) {
      console.error('Auto-curation failed:', error);
      showErrorToast('Kunne ikke opprette kuraterte samlinger.');
    }
  }, [
    createCollectionFromSelection,
    selectedManagedItems,
    selectedWeddingPackage,
    showErrorToast,
    showSuccessToast,
    showWarningToast,
  ]);

  const applyWeddingPackageOrganization = useCallback(async () => {
    if (selectedManagedItems.length === 0) {
      showWarningToast('Velg videoer eller bilder for a organisere i bryllupspakke.');
      return;
    }

    const packageLabel = weddingPackageLabels[selectedWeddingPackage];
    const packageTag = packageLabel.toLowerCase().replace(/\s+/g, '-');

    try {
      for (const item of selectedManagedItems) {
        const nextTags = Array.from(
          new Set([...(item.tags || []), 'wedding', selectedWeddingPackage, packageTag]),
        );
        await apiRequest(`/api/showcase/update-metadata/${item.id}`, {
          method: 'PUT',
          body: {
            category: packageLabel,
            tags: nextTags,
            projectType: 'wedding',
          },
        });
      }

      showSuccessToast(`Valgte elementer ble organisert i ${packageLabel}.`);
      setShowWeddingPackages(false);
      refetch();
    } catch (error) {
      console.error('Wedding package organization failed:', error);
      showErrorToast('Kunne ikke organisere bryllupspakken.');
    }
  }, [
    refetch,
    selectedManagedItems,
    selectedWeddingPackage,
    showErrorToast,
    showSuccessToast,
    showWarningToast,
  ]);

  const openResolveHandoff = useCallback(() => {
    if (selectedVideoIds.length === 0) {
      showWarningToast('Velg videoer for a lage Resolve-handoff.');
      return;
    }

    downloadJsonArtifact(
      `resolve-handoff-${selectedItem?.id || Date.now()}.json`,
      {
        generatedAt: new Date().toISOString(),
        videoVersion,
        selectedLUT,
        selectedAudioFormat,
        selectedSequence,
        selectedChapter,
        itemIds: selectedVideoIds,
        timecodedComments,
      },
    );
    showSuccessToast('Resolve-handoff eksportert som JSON.');
  }, [
    downloadJsonArtifact,
    selectedAudioFormat,
    selectedChapter,
    selectedItem,
    selectedLUT,
    selectedSequence,
    selectedVideoIds,
    showSuccessToast,
    showWarningToast,
    timecodedComments,
    videoVersion,
  ]);

  const exportVersionComparisonReport = useCallback(() => {
    if (selectedVideoIds.length === 0) {
      showWarningToast('Velg videoer for a eksportere versjonssammenligning.');
      return;
    }

    downloadJsonArtifact(
      `version-comparison-${selectedItem?.id || Date.now()}.json`,
      {
        generatedAt: new Date().toISOString(),
        baseVersion: videoVersion,
        compareAgainst: 'Final',
        itemIds: selectedVideoIds,
        comments: timecodedComments,
      },
    );
    setShowVersionComparison(false);
    showSuccessToast('Versjonssammenligning eksportert.');
  }, [
    downloadJsonArtifact,
    selectedItem,
    selectedVideoIds,
    setShowVersionComparison,
    showSuccessToast,
    showWarningToast,
    timecodedComments,
    videoVersion,
  ]);

  const openMoveSelectionDialog = useCallback(() => {
    if (activeSelectionIds.length === 0) {
      showWarningToast('Velg elementer for a flytte dem.');
      return;
    }

    syncSelectionFromIds(activeSelectionIds);
    setCopyMoveAction('move');
    setShowMoveDialog(false);
    setShowCopyMoveDialog(true);
  }, [activeSelectionIds, showWarningToast, syncSelectionFromIds]);

  const createCollectionFromDialog = useCallback(async () => {
    const trimmedName = newCollectionName.trim();
    if (!trimmedName) {
      showWarningToast('Skriv inn et navn for samlingen.');
      return;
    }

    if (selectedManagedItems.length === 0) {
      showWarningToast('Velg minst ett CreatorHub-element for å opprette samlingen.');
      return;
    }

    try {
      const managedSelectionIds = selectedManagedItems.map((item) => item.id);
      await createCollectionFromSelection(
        trimmedName,
        managedSelectionIds,
        `Opprettet fra showcase-utvalg i ${profession}`,
      );
      setNewCollectionName('');
      setShowCreateCollection(false);
      showSuccessToast(`Samlingen "${trimmedName}" ble opprettet.`);
    } catch (error) {
      console.error('Collection creation failed:', error);
      showErrorToast('Kunne ikke opprette samlingen.');
    }
  }, [
    createCollectionFromSelection,
    newCollectionName,
    profession,
    selectedManagedItems,
    showErrorToast,
    showSuccessToast,
    showWarningToast,
  ]);

  useEffect(() => {
    if (selectedPrimaryVideo?.id && selectedPrimaryVideo.fileType === 'video') {
      let cancelled = false;

      const loadVideoWorkspaceData = async () => {
        try {
          const [commentsResponse, sequencesResponse] = await Promise.all([
            fetch(`/api/video/timecoded-comments/${selectedPrimaryVideo.id}`),
            fetch(`/api/video/sequences/${selectedPrimaryVideo.id}`),
          ]);

          if (!commentsResponse.ok || !sequencesResponse.ok) {
            throw new Error('Failed to load video workspace data');
          }

          const comments = (await commentsResponse.json()) as VideoTimecodedCommentRecord[];
          const sequences = (await sequencesResponse.json()) as VideoSequenceRecord[];

          if (cancelled) {
            return;
          }

          setTimecodedComments(comments);
          setVideoSequences(sequences);
          setSelectedSequence((currentSequence) => {
            const nextSequence =
              (currentSequence &&
                sequences.find((sequence) => sequence.id === currentSequence)) ||
              sequences[0] ||
              null;

            setSelectedChapter((currentChapter) => {
              if (!nextSequence) {
                return null;
              }
              if (currentChapter && nextSequence.chapters.includes(currentChapter)) {
                return currentChapter;
              }
              return nextSequence.chapters[0] || null;
            });

            return nextSequence?.id || null;
          });
        } catch (error) {
          console.error('Failed to load video workspace data:', error);
          if (!cancelled) {
            setTimecodedComments([]);
            setVideoSequences([]);
            setSelectedSequence(null);
            setSelectedChapter(null);
          }
        }
      };

      void loadVideoWorkspaceData();

      return () => {
        cancelled = true;
      };
    }

    setTimecodedComments([]);
    setVideoSequences([]);
    setSelectedSequence(null);
    setSelectedChapter(null);
    return undefined;
  }, [selectedPrimaryVideo]);

  // Find duplicate items based on checksum/similarity hash
  const findDuplicates = useCallback(() => {
    const duplicateMap = new Map<string, string[]>();
    items.forEach(item => {
      if (item.checksum) {
        if (!duplicateMap.has(item.checksum)) {
          duplicateMap.set(item.checksum, []);
        }
        duplicateMap.get(item.checksum)!.push(item.id);
      }
    });
    // Only keep checksums with duplicates
    const actualDuplicates = new Map(
      Array.from(duplicateMap.entries()).filter(([_, ids]) => ids.length > 1)
    );
    setDuplicates(actualDuplicates);
}, [items]);

  // Update client selections state when data loads
  useEffect(() => {
    if (existingSelections?.length > 0) {
      setClientSelections(existingSelections.map((s: { showcaseItemId: string }) => s.showcaseItemId));
    }
    if (clientSession) {
      setSessionData(clientSession);
    }
    // FASE 1: Update proofing session data
    if (proofingSessionData) {
      setProofingSession(proofingSessionData);
      setSelectionCount(proofingSessionData.currentSelections || 0);
      setTimeRemaining(proofingSessionData.timeRemaining || 0);

      // Show deadline warning if less than 24 hours remaining
      if (proofingSessionData.timeRemaining < 24 * 60 * 60 * 1000) {
        setShowDeadlineWarning(true);
      }
    }
}, [existingSelections, clientSession, proofingSessionData]);

  // Load server-side day groupings derived from showcase metadata and project links.
  useEffect(() => {
    let isCancelled = false;

    const loadDayCategories = async () => {
      if (!effectiveUserId || clientMode) {
        if (!isCancelled) {
          setDayCategories([]);
          setShowMultiDayView(false);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/showcase/day-categories?userId=${encodeURIComponent(effectiveUserId)}&profession=${encodeURIComponent(profession)}`,
          { credentials: 'include' },
        );
        if (!response.ok) {
          throw new Error('Failed to load day categories');
        }
        const data = await response.json();
        if (!isCancelled) {
          const derivedCategories = deriveDayCategoriesFromShowcases(showcases);
          const serverCategories = Array.isArray(data.dayCategories) ? data.dayCategories : [];
          const nextCategories = serverCategories.map((category: any) => {
            const derivedMatch = derivedCategories.find(
              (derived: any) => derived.name === category.name,
            );
            return derivedMatch
              ? {
                  ...derivedMatch,
                  ...category,
                  itemIds: category.itemIds || derivedMatch.itemIds,
                  itemCount: category.itemCount || derivedMatch.itemCount,
                  projectIds: category.projectIds || derivedMatch.projectIds,
                }
              : category;
          });
          setDayCategories(nextCategories);
          setShowMultiDayView(nextCategories.length > 0);
        }
      } catch (error) {
        console.error('Failed to load showcase day categories:', error);
        if (!isCancelled) {
          setDayCategories([]);
          setShowMultiDayView(false);
        }
      }
    };

    void loadDayCategories();

    return () => {
      isCancelled = true;
    };
  }, [clientMode, effectiveUserId, profession, showcases]);




  // In client mode, only wait for showcases and session (Google Photos queries are disabled)
  // Note: sessionLoading will be false when query is disabled (no sessionIdd/clientEmail)
  const isFetchingData = clientMode
    ? (showcasesLoading || (sessionIdd && clientEmail && sessionLoading))
    : (showcasesLoading || googlePhotosStatusLoading || googlePhotosAlbumsLoading || googlePhotosItemsLoading);

  // Debug: Log loading states in client mode (disabled to prevent console spam)
  // console.log('[Showcase Debug]', {
  //   clientMode,
  //   isFetchingData,
  //   showcasesLoading,
  //   sessionLoading,
  //   sessionIdd,
  //   clientEmail,
  //   showcasesCount: showcases?.length,
  //   effectiveUserId
  // });

  // Google Photos Sync Function
  const syncWithGooglePhotos = async () => {
    if (!selectedGoogleAlbum) return;
    
    setShowGooglePhotosSync(true);
    setGooglePhotosSyncProgress(0);
    
    try {
      // Sync Google Photos items to showcase
      const response = await fetch('/api/showcase/sync-google-photos', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          albumId: selectedGoogleAlbum,
          profession,
          userId,
          items: googlePhotosItems
  })
  });
      
      if (!response.ok) throw new Error('Synkronisering med Google Photos feilet');
      
      await response.json();
      await queryClient.invalidateQueries({ queryKey: [`/api/showcase/profession/${profession}`] });
      await refetch();
      
} catch (error) {
      console.error('Google Photos sync error:', error);
} finally {
      setShowGooglePhotosSync(false);
      setGooglePhotosSyncProgress(0);
}
};

  // Handle Google Photos Import
  const handleGooglePhotosImport = async (photoIds: string[]) => {
    if (!photoIds.length) return;
    
    try {
      const response = await fetch('/api/showcase/import-google-photos', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          photoIds,
          profession,
          userId,
          albumId: selectedGoogleAlbum
  })
  });
      
      if (!response.ok) throw new Error('Import fra Google Photos feilet');
      
      await response.json();
      await queryClient.invalidateQueries({ queryKey: [`/api/showcase/profession/${profession}`] });
      await refetch();
      
} catch (error) {
      console.error('Google Photos import error:', error);
}
};

  // Handle Google Photos Edit - NEW FUNCTION with Project ID integration
  const handleGooglePhotosEdit = async (imageIds: string[]) => {
    if (!imageIds.length) return;
    
    try {
      setIsLoadingGooglePhotos(true);
      
      // Get current project info from memory card session or dashboard
      let projectInfo = null;
      let albumName = `CreatorHub Editing - ${new Date().toLocaleDateString('')}`;
      
      // Try to get active memory card session first (from project creation)
      const memoryCardResponse = await fetch(`/api/memory-card/active-session/${userId}`, {
        credentials: 'include'
});
      
      if (memoryCardResponse.ok) {
        const sessionData = await memoryCardResponse.json();
        if (sessionData.project) {
          projectInfo = {
            id: sessionData.project.d,
            name: sessionData.project.title || sessionData.project.clientName,
            type: sessionData.project.projectType,
            clientName: sessionData.project.clientName,
            eventDate: sessionData.project.eventDate,
            location: sessionData.project.location,
            weddingCulture: sessionData.project.weddingCulture
    };
          
          // Create descriptive album name with memory card context
          albumName = `${projectInfo?.clientName} - ${projectInfo?.name} - Redigering (${projectInfo?.type}) - ${new Date().toLocaleDateString('no-NO')}`;
          // Using memory card session project
    }
  } else {
        // Fallback to dashboard project data
        const projectResponse = await fetch(`/api/dashboard/${profession}/${userId}`, {
          credentials: 'include'
  });
        
        if (projectResponse.ok) {
          const dashboardData = await projectResponse.json();
          const currentProject = dashboardData.projects?.[0]; // Get most recent project
          
          if (currentProject) {
            projectInfo = {
              id: currentProject.d,
              name: currentProject.name || currentProject.clientName,
              type: currentProject.type,
              clientName: currentProject.clientName,
              eventDate: currentProject.eventDate,
              location: currentProject.location,
              weddingCulture: currentProject.weddingCulture
      };
            
            // Create more descriptive album name with project context
            albumName = `${projectInfo?.name} - Redigering (${projectInfo?.type}) - ${new Date().toLocaleDateString('no-NO')}`;
      }
    }
  }

      // PRIORITET: Hent prosjektdata fra ProjectCreationWithMemoryCards (server-first, fallback sessionStorage)
      try {
        const r = await fetch('/api/user/kv/currentProjectContext', { credentials: 'include' });
        const j = r.ok ? await r.json().catch(() => null) : null;
        const serverCtx = j && typeof j === 'object' && 'value' in j ? j.value : (j?.data ?? j);
        if (serverCtx) {
          projectInfo = {
            id: serverCtx.projectId,
            name: serverCtx.projectName,
            type: serverCtx.projectType,
            clientName: serverCtx.clientName,
            eventDate: serverCtx.eventDate,
            location: serverCtx.location,
            weddingCulture: serverCtx.weddingCulture,
          };
          albumName = `${serverCtx.clientName} - ${serverCtx.projectName} - Redigering`;
        } else {
          const storedProjectContext = sessionStorage.getItem('currentProjectContext');
          if (storedProjectContext) {
            try {
              const projectContext = JSON.parse(storedProjectContext);
              projectInfo = {
                id: projectContext.projectId,
                name: projectContext.projectName,
                type: projectContext.projectType,
                clientName: projectContext.clientName,
                eventDate: projectContext.eventDate,
                location: projectContext.location,
                weddingCulture: projectContext.weddingCulture
              };
              albumName = `${projectContext.clientName} - ${projectContext.projectName} - Redigering`;
            } catch { /* ignore parse errors */ }
          }
        }
      } catch {
        const storedProjectContext = sessionStorage.getItem('currentProjectContext');
        if (storedProjectContext) {
          try {
            const projectContext = JSON.parse(storedProjectContext);
            projectInfo = {
              id: projectContext.projectId,
              name: projectContext.projectName,
              type: projectContext.projectType,
              clientName: projectContext.clientName,
              eventDate: projectContext.eventDate,
              location: projectContext.location,
              weddingCulture: projectContext.weddingCulture
            };
            albumName = `${projectContext.clientName} - ${projectContext.projectName} - Redigering`;
          } catch { /* ignore parse errors */ }
        }
      }
      
      // Upload selected images to Google Photos for editing
      const response = await fetch('/api/google-photos/upload-for-edit', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          imageIds,
          profession,
          userId,
          projectId: projectInfo?.id,
          projectName: projectInfo?.name,
          projectType: projectInfo?.type,
          clientName: projectInfo?.clientName,
          eventDate: projectInfo?.eventDate,
          location: projectInfo?.location,
          weddingCulture: projectInfo?.weddingCulture,
          albumName
    })
  });
      
      if (!response.ok) throw new Error('Failed to upload to Google Photos');
      
      const uploadResult = await response.json();
      // Google Photos upload successful with project context
      
      // Open Google Photos album in new tab for editing
      if (uploadResult.albumUrl) {
        window.open(uploadResult.albumUrl, '_blank');
  }
      
      // Show enhanced success message with detailed project context
      let successMessage = `${imageIds.length} bilde${imageIds.length !== 1 ? 'r' : ','} er sendt til Google Photos for redigering.`;
      
      if (projectInfo) {
        successMessage += `\n\n📁 Prosjekt: ${projectInfo?.name}`;
        if (projectInfo?.clientName) {
          successMessage += `\n👤 Klient: ${projectInfo.clientName}`;
    }
        if (projectInfo?.eventDate) {
          successMessage += `\n📅 Dato: ${new Date(projectInfo.eventDate).toLocaleDateString('')}`;
    }
        if (projectInfo?.location) {
          successMessage += `\nSted: ${projectInfo.location}`;
    }
        successMessage += `\n\nBildene er nå tilgjengelige i Google Photos med full prosjektkontekst for redigering.`;
  }
      
        showToastWithActions(
          successMessage, 'success',
        [
          {
            label: 'Åpne Google Photos',
            action: () => {
              window.open('https://photos.google.com', '_blank');
            }
          },
          {
            label: 'Se Prosjekt',
            action: () => {
              // Navigate to project view
              if (selectedProject?.id) {
                window.location.href = `/projects/${selectedProject.id}`;
          }
        }
      }
        ]
    );
      
} catch (error) {
      console.error('Upload to Google Photos error:', error);
      showErrorToast('Feil ved opplasting til Google Photos. Prøv igjen senere.');
} finally {
      setIsLoadingGooglePhotos(false);
}
};

  // FASE 2: Handle client authentication success
  const _handleAuthenticationSuccess = (sessionData: { sessionIdd: string; userId: string; isAuthenticated: boolean; currentSelections?: number }) => {
    setIsAuthenticated(true);
    setAuthSessionData(sessionData);
    setShowAuthDialog(false);
    
    // Update proofing session with authenticated data
    if (sessionData) {
      setProofingSession(sessionData);
      setSelectionCount(sessionData.currentSelections || 0);
}
};

  // Check if client session requires authentication on mount
  useEffect(() => {
    if (clientMode && sessionIdd && !isAuthenticated) {
      // Check if session requires PIN/password authentication
      const checkSessionAuth = async () => {
        try {
          const response = await fetch(`/api/proofing/session-info/${sessionIdd}`);
          const data = await response.json();
          
          if (data.requiresAuth) {
            setSessionRequiresAuth(true);
            setShowAuthDialog(true);
      } else {
            setIsAuthenticated(true);
      }
    } catch (error) {
          console.error('Session auth check failed:', error);
          setShowAuthDialog(true); // Default to showing auth dialog on error
    }
  };
      
      checkSessionAuth();
}
}, [clientMode, sessionIdd, isAuthenticated]);

  // Handle client selection toggle
  const handleClientSelection = async (itemId: string) => {
    if (!clientMode || !sessionIdd || !clientEmail) return;

    const isSelected = clientSelections.includes(itemId);
    
    try {
      if (isSelected) {
        // Remove selection
        const response = await fetch('/api/showcase/client-selections', {
      method: 'DELETE',
      headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            sessionIdd,
            showcaseItemId: itemId,
            clientEmail
      })
    });
        
        if (response.ok) {
          setClientSelections(prev => prev.filter(id => id !== itemId));
          
          // Emit real-time event for deselection
          if (isConnected) {
            emitEvent('item_selected', {
              itemId,
              userId: (user as any)?.id,
              userName: (user as any)?.firstName || 'User',
              action: 'deselected'
      });
      }
    }
  } else {
        // Check selection limits
        if (sessionData?.maxSelections && clientSelections.length >= sessionData.maxSelections) {
          showWarningToast(`Du kan maksimalt velge ${sessionData.maxSelections} bilder.`);
          return;
    }

        // Add selection
        const response = await fetch('/api/showcase/client-selections', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            sessionIdd,
            showcaseItemId: itemId,
            clientEmail,
            clientComment: clientComment
    })
    });
        
        if (response.ok) {
          setClientSelections(prev => [...prev, itemId]);
          
          // Emit real-time event for selection
          if (isConnected) {
            emitEvent('item_selected', {
              itemId,
              userId: (user as any)?.id,
              userName: (user as any)?.firstName || 'User',
              action: 'selected'
      });
      }
    }
  }
      
      refetchSelections();
} catch (error) {
      console.error('Selection update error:', error);
}
};
  
  // Pricing integration state
  const [pricingData, setPricingData] = useState<any>(null);
  const [showPricing, setShowPricing] = useState(false);
  
  // CreatorHub Photo Enhancer state
  const [showPhotoEnhancer, setShowPhotoEnhancer] = useState(false);
  const [enhancementPresets, setEnhancementPresets] = useState<any>({});
  const [selectedPhotoPreset, setSelectedPhotoPreset] = useState('portrait');
  const [customEnhancementOptions, setCustomEnhancementOptions] = useState({
    brightness:  0,
    contrast: 1.0,
    saturation:  0,
    sharpening: 1.0,
    noiseReduction: false,
    autoTone: false
});
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementProgress, setEnhancementProgress] = useState(0);

  // Watermark state - Professional Photographer Setup
  const [showWatermarkDialog, setShowWatermarkDialog] = useState(false);
  const [watermarkText, setWatermarkText] = useState('© Ditt Fotografnavn');
  const [watermarkPosition, setWatermarkPosition] = useState('bottom-right');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.5);
  const [watermarkLogo, setWatermarkLogo] = useState<File | null>(null);
  const [watermarkType, setWatermarkType] = useState<'text' | 'logo' | 'both'>('text');
  const [isApplyingWatermark, setIsApplyingWatermark] = useState(false);

  // Photo Editor & Crop state - CreatorHub Photo Enhancer Integration
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [cropAspectRatio, setCropAspectRatio] = useState<string>('free');
  const [compositionOverlay, setCompositionOverlay] = useState<string>('none');
  const [_cropData, _setCropData] = useState({
    x:  0,
    y:  0,
    width: 10,
    height: 10,
    aspectRatio: null as number | null
});
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);

  // Copy/Move state
  const [showCopyMoveDialog, setShowCopyMoveDialog] = useState(false);
  const [copyMoveAction, setCopyMoveAction] = useState<'copy' | 'move'>('copy');
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedTargetProject, setSelectedTargetProject] = useState('');
  const [selectedTargetCategory, setSelectedTargetCategory] = useState('');
  const [isCopyingMoving, setIsCopyingMoving] = useState(false);

  // Additional image operations state
  const [showBulkOperationsDialog, setShowBulkOperationsDialog] = useState(false);
  const [isProcessingBulkOperation, setIsProcessingBulkOperation] = useState(false);
  const [bulkOperationProgress, setBulkOperationProgress] = useState(0);
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [bulkMetadata, setBulkMetadata] = useState({
    title: '',
    description: '',
    tags: '',
    location: '',
    copyright: '© CreatorHub Norge' // Will be updated from business info when editor opens
  });
  const [displayPreferences, setDisplayPreferences] = useState({
    showExif: true,
    showCameraInfo: true,
    showLocation: true,
    showTags: true,
    showCopyright: true,
  });
  
  // Client proofing state (already defined above)
  const [clientComment, setClientComment] = useState('');
  
  // Load pricing data based on profession
  useEffect(() => {
    let isCancelled = false;

    const loadPricingData = async () => {
      try {
        const params = new URLSearchParams({ profession });
        if (effectiveUserId) {
          params.set('userId', effectiveUserId);
        }
        const response = await fetch(`/api/showcase/pricing?${params.toString()}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to load showcase pricing');
        }
        const data = await response.json();
        if (!isCancelled) {
          const defaultPricing = getFallbackShowcasePricingData(profession);
          setPricingData({
            ...defaultPricing,
            ...data,
            pricing: {
              ...defaultPricing.pricing,
              ...(data?.pricing || {}),
              packages:
                Array.isArray(data?.pricing?.packages) && data.pricing.packages.length > 0
                  ? data.pricing.packages
                  : defaultPricing.pricing.packages,
            },
            projectPricing: {
              ...defaultPricing.projectPricing,
              ...(data?.projectPricing || {}),
            },
          });
        }
      } catch (error) {
        console.error('Failed to load showcase pricing:', error);
        if (!isCancelled) {
          setPricingData(null);
        }
      }
    };

    void loadPricingData();

    return () => {
      isCancelled = true;
    };
  }, [effectiveUserId, profession]);

  // Load enhancement presets
  useEffect(() => {
    let isCancelled = false;

    const loadEnhancementPresets = async () => {
      try {
        const response = await fetch('/api/showcase/enhancement-presets', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to load enhancement presets');
        }
        const data = await response.json();
        const defaultPresets = getFallbackEnhancementPresets();
        const presets =
          data && typeof data === 'object' && !Array.isArray(data)
            ? { ...defaultPresets, ...data }
            : defaultPresets;
        if (!isCancelled) {
          setEnhancementPresets(presets);
          setSelectedPhotoPreset((currentPreset) => {
            if (presets[currentPreset]) {
              return currentPreset;
            }
            const firstPreset = Object.keys(presets)[0];
            return firstPreset || currentPreset;
          });
        }
      } catch (error) {
        console.error('Failed to load enhancement presets:', error);
        if (!isCancelled) {
          setEnhancementPresets({});
        }
      }
    };

    void loadEnhancementPresets();

    return () => {
      isCancelled = true;
    };
  }, [profession]);

  // NOTE: Day categories loading is already handled in the useEffect above (around line 3534)
  // that handles existingSelections, clientSession, proofingSessionData - removed duplicate to prevent infinite loops

  // Handle image selection for pricing
  const _handleImageSelect = (imageId: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
};

  // Calculate total price for selected images
  const calculatePrice = () => {
    if (!pricingData || selectedImages.size === 0) return 0;
    
    const extraImages = Math.max(0, selectedImages.size - (pricingData.projectPricing?.contracted_images || 0));
    // Use centralized pricing service for per-image pricing
    let pricePerImage = 150; // Default fallback
    try {
      if (pricingData.projectPricing?.per_image) {
        pricePerImage = pricingData.projectPricing.per_image;
      } else if (pricingData.pricing?.perImage) {
        pricePerImage = pricingData.pricing.perImage;
      } else {
        // Use default fallback pricing
        pricePerImage = 50; // Default NOK 50 per image
      }
    } catch (error) {
      console.warn('Could not fetch per-image pricing, using fallback:', error);
    }
    
    return extraImages * pricePerImage;
};

  // Show pricing modal
  const openPricingModal = () => {
    setShowPricing(true);
};

  const primeSelectionForBatchWorkflow = useCallback(() => {
    const explicitSelection = selectedBatchItems.size > 0
      ? Array.from(selectedBatchItems)
      : Array.from(selectedImages);
    const fallbackSelection = selectedItem?.id ? [selectedItem.id] : [];
    const targetIds = explicitSelection.length > 0 ? explicitSelection : fallbackSelection;

    if (targetIds.length === 0) {
      addNotification({ message: 'Velg minst ett element først.', type: 'warning' });
      return [];
    }

    const nextSelection = new Set(targetIds);
    setSelectedBatchItems(nextSelection);
    setSelectedImages(nextSelection);
    setBatchMode(true);
    return targetIds;
  }, [addNotification, selectedBatchItems, selectedImages, selectedItem]);

  const handleExtractStems = useCallback(() => {
    const targetIds = primeSelectionForBatchWorkflow();
    if (targetIds.length === 0) return;

    setSelectedAudioFormat('stems');
    setShowExportDialog(true);
    addNotification({
      message: `Stem-eksport er klargjort for ${targetIds.length} spor. Fullfør eksportinnstillingene for å fortsette.`,
      type: 'info',
    });
  }, [addNotification, primeSelectionForBatchWorkflow]);

  const handleOpenAudioWatermarkDialog = useCallback(() => {
    const targetIds = primeSelectionForBatchWorkflow();
    if (targetIds.length === 0) return;

    setShowVideoWatermarkDialog(true);
    addNotification({
      message: `Vannmerkeoppsettet er åpnet for ${targetIds.length} valgte filer.`,
      type: 'info',
    });
  }, [addNotification, primeSelectionForBatchWorkflow]);

  const handleOpenCollectionWorkflow = useCallback((mode: 'sample-pack' | 'bundle') => {
    const targetIds = primeSelectionForBatchWorkflow();
    if (targetIds.length === 0) return;

    setShowCreateCollection(true);
    addNotification({
      message: mode === 'sample-pack'
        ? `Opprett en samling for sample pack med ${targetIds.length} valgte filer.`
        : `Opprett en bundle-samling med ${targetIds.length} valgte filer.`,
      type: 'info',
    });
  }, [addNotification, primeSelectionForBatchWorkflow]);

  const handleOpenVariantsWorkspace = useCallback(() => {
    const targetIds = primeSelectionForBatchWorkflow();
    if (targetIds.length === 0) return;

    setShowVersionComparison(true);
    addNotification({
      message: `Variantvisningen er åpnet for ${targetIds.length} valgte filer.`,
      type: 'info',
    });
  }, [addNotification, primeSelectionForBatchWorkflow]);

  const handleOpenInventoryWorkspace = useCallback(() => {
    const targetIds = primeSelectionForBatchWorkflow();
    if (targetIds.length === 0) return;

    setShowAnalytics(true);
    addNotification({
      message: `Analyse- og lageroversikten er åpnet for ${targetIds.length} valgte produkter.`,
      type: 'info',
    });
  }, [addNotification, primeSelectionForBatchWorkflow]);

  const handleReviewDuplicates = useCallback(() => {
    const duplicateIds = Array.from(new Set(Array.from(duplicates.values()).flat()));
    if (duplicateIds.length === 0) {
      addNotification({ message: 'Ingen dubletter å gjennomgå akkurat nå.', type: 'info' });
      return;
    }

    const nextSelection = new Set(duplicateIds);
    setSelectedBatchItems(nextSelection);
    setSelectedImages(nextSelection);
    setBatchMode(true);
    addNotification({
      message: `${duplicates.size} dublettgrupper er valgt. Bruk batchhandlingslinjen for å rydde dem opp.`,
      type: 'warning',
    });
  }, [addNotification, duplicates]);

  // Handle purchase/checkout
  const handleCheckout = async () => {
    if (selectedImages.size === 0) return;
    
    try {
      const response = await fetch('/api/showcase/calculate-selection-price', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          showcaseId: items[0]?.id, // Use first showcase item ID as reference
          selectedImages: Array.from(selectedImages),
          clientEmail: 'kunde@example.com', // This should come from authenticated user
          pricingOption: 'per_image'
  })
  });

      if (response.ok) {
        const result = await response.json();
        showInfoToast(`Totalpris: ${result.calculation.totalCost} NOK for ${selectedImages.size} bilder`);
        setShowPricing(false);
        setSelectedImages(new Set());
      }
    } catch (error) {
      console.error('Checkout error:', error);
      showErrorToast('Feil ved bestilling. Prøv igjen.');
    }
};

  // CreatorHub Photo Enhancer functions
  const openPhotoEnhancer = () => {
    if (selectedImages.size === 0) {
      showWarningToast('Velg bilder først for å åpne CreatorHub Photo Enhancer');
      return;
    }
    setShowPhotoEnhancer(true);
};

  // Additional image operation handlers
  const openWatermarkDialog = () => {
    if (selectedImages.size === 0) {
      showWarningToast('Velg bilder først');
      return;
    }
    setShowWatermarkDialog(true);
};



  const openCopyMoveDialog = (action: 'copy' | 'move') => {
    if (selectedImages.size === 0) {
      showWarningToast('Velg bilder først');
      return;
    }
    setCopyMoveAction(action);
    setShowCopyMoveDialog(true);
};

  const executeCopyMove = async () => {
    if (!selectedTargetProject && !selectedTargetCategory) {
      showWarningToast('Velg destinasjon');
      return;
}

    setIsCopyingMoving(true);
    try {
      const imageIds = Array.from(selectedImages);
      
      const response = await fetch(`/api/showcase/${copyMoveAction}-images`, {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          imageIds,
          targetProject: selectedTargetProject,
          targetCategory: selectedTargetCategory
  })
  });

      if (response.ok) {
        showSuccessToast(`${imageIds.length} bilder ${copyMoveAction === 'copy' ? 'kopiert' : 'flyttet'}!`);
        setShowCopyMoveDialog(false);
        setSelectedImages(new Set());
        refetch();
  } else {
        throw new Error(`Feil under ${copyMoveAction === 'copy' ? 'kopiering' : 'flytting'}`);
  }
} catch (error) {
      console.error('Copy/move operation failed:', error);
      showErrorToast(`Feil under ${copyMoveAction === 'copy' ? 'kopiering' : 'flytting'}`);
} finally {
      setIsCopyingMoving(false);
}
};

  // Bulk Folder Upload - Create Collections Handler
  const handleBulkCreateCollections = useCallback(async (
    folders: Array<{
      id: string;
      name: string;
      path: string;
      files: File[];
      fileCount: number;
      totalSize: number;
    }>,
    settings: {
      enablePassword: boolean;
      password: string;
      enableDownloads: boolean;
      enableComments: boolean;
      enableFavorites: boolean;
      visibility: 'private' | 'team' | 'public';
      watermarkEnabled: boolean;
    }
  ) => {
    try {
      // Create collections for each folder
      for (const folder of folders) {
        // 1. Create the collection using apiRequest for auth
        const collection = await apiRequest('/api/showcase/collections', {
          method: 'POST',
          body: JSON.stringify({
            name: folder.name,
            description: `Bulk imported from ${folder.path}`,
            visibility: settings.visibility,
            settings: {
              enablePassword: settings.enablePassword,
              password: settings.enablePassword ? settings.password : undefined,
              enableDownloads: settings.enableDownloads,
              enableComments: settings.enableComments,
              enableFavorites: settings.enableFavorites,
              watermarkEnabled: settings.watermarkEnabled,
            },
            parentFolderId: currentParentFolderId,
            userId: effectiveUserId,
            profession: profession,
          }),
        });

        // 2. Upload files to the collection
        const formData = new FormData();
        folder.files.forEach((file) => {
          formData.append('files', file);
        });
        formData.append('collectionId', collection.collection?.id || collection.id);
        formData.append('userId', effectiveUserId);
        formData.append('profession', profession);

        // Use fetch for multipart/form-data (apiRequest adds Content-Type header which breaks FormData)
        const uploadResponse = await fetch('/api/showcase/bulk-upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          console.error(`Failed to upload files to collection: ${folder.name}`);
        }
      }

      showSuccessToast(`${folders.length} collections created successfully!`);
      refetch();
    } catch (error) {
      console.error('Bulk collection creation error:', error);
      showErrorToast('Failed to create collections. Please try again.');
      throw error;
    }
  }, [currentParentFolderId, effectiveUserId, profession, refetch, showSuccessToast, showErrorToast]);

  // Professional Photo Editing Functions
  const openPhotoEditor = () => {
    if (selectedImages.size === 0) {
      showWarningToast('Velg bilder først for redigering');
      return;
}
    setShowPhotoEditor(true);
};

  const openCropDialog = () => {
    if (selectedImages.size === 0) {
      showWarningToast('Velg bilder først for beskjæring');
      return;
}
    setShowCropDialog(true);
};



  const applyPhotoEnhancements = async () => {
    if (selectedImages.size === 0) return;

    setIsEnhancing(true);
    setEnhancementProgress(0);
    try {
      const imageIds = Array.from(selectedImages);
      const totalImages = imageIds.length;
      
      for (let i = 0; i < totalImages; i++) {
        const response = await fetch('/api/showcase/enhance-photo', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            imageId: imageIds[i],
            preset: selectedPhotoPreset,
            customOptions: customEnhancementOptions
          })
        });

        if (!response.ok) {
          throw new Error(`Feil ved forbedring av bilde ${i + 1}`);
    }

        setEnhancementProgress(((i + 1) / totalImages) * 100);
        await new Promise(resolve => setTimeout(resolve, 500));
  }

      showSuccessToast(`${totalImages} bilder forbedret med CreatorHub Photo Enhancer!`);
      setShowPhotoEditor(false);
      setSelectedImages(new Set());
      refetch();
} catch (error) {
      console.error('Enhancement failed:', error);
      showErrorToast('Feil under forbedring av bilder');
} finally {
      setIsEnhancing(false);
      setEnhancementProgress(0);
}
};

  // Professional Crop Handler with Composition Guides
  const applyCropToImages = async () => {
    setIsProcessingEdit(true);
    
    try {
      const imageIds = Array.from(selectedImages);
      
      const response = await fetch('/api/showcase/crop', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          itemIds: imageIds,
          aspectRatio: cropAspectRatio,
          compositionOverlay,
          userId
    })
  });

      if (!response.ok) {
        throw new Error('Beskjæring feilet');
  }

      const result = await response.json();
      
      if (result.success) {
        showSuccessToast(`${result.summary.successful} av ${result.summary.total} bilder beskåret med komposisjonsguider!`);
        setShowCropDialog(false);
        setSelectedImages(new Set());
        refetch();
  } else {
        throw new Error('Beskjæring feilet');
  }
} catch (error) {
      console.error('Crop failed:', error);
      showErrorToast('Feil under beskjæring av bilder');
} finally {
      setIsProcessingEdit(false);
}
};

  // Professional Watermark Handler
  const applyWatermark = async () => {
    setIsApplyingWatermark(true);
    
    try {
      const imageIds = Array.from(selectedImages);
      
      const response = await fetch('/api/showcase/watermark', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          itemIds: imageIds,
          watermarkType,
          text: watermarkText,
          position: watermarkPosition,
          opacity: watermarkOpacity,
          userId
    })
  });

      if (!response.ok) {
        throw new Error('Vannmerking feilet');
  }

      const result = await response.json();
      
      if (result.success) {
        showSuccessToast(`${result.summary.successful} av ${result.summary.total} bilder vannmerket!`);
        setShowWatermarkDialog(false);
        setSelectedImages(new Set());
        refetch();
  } else {
        throw new Error('Vannmerking feilet');
  }
} catch (error) {
      console.error('Watermark failed:', error);
      showErrorToast('Feil under vannmerking av bilder');
} finally {
      setIsApplyingWatermark(false);
}
};

  // Video processing helper for render/watermark jobs
  const startVideoProcessing = useCallback(async (jobType: 'render' | 'watermark') => {
    if (isProcessingVideo) return;
    if (selectedVideoIds.length === 0) {
      showWarningToast('Velg videoer først');
      return;
    }

    setIsProcessingVideo(true);
    setProcessingProgress(15);

    try {
      const response = await submitVideoJob(jobType, {
        preset: selectedPreset,
        watermarkType: jobType === 'watermark' ? watermarkType : undefined,
        watermarkText: jobType === 'watermark' ? watermarkText : undefined,
        watermarkPosition: jobType === 'watermark' ? watermarkPosition : undefined,
        watermarkOpacity: jobType === 'watermark' ? watermarkOpacity : undefined,
      });

      setProcessingProgress(100);
      addNotification({
        message: `${jobType === 'render' ? 'Render' : 'Vannmerke'}-jobb startet for ${selectedVideoIds.length} video${selectedVideoIds.length !== 1 ? 'er' : ''}${response.jobId ? ` (${response.jobId})` : ''}`,
        type: 'success',
      });

      if (jobType === 'render') {
        setShowRenderPresets(false);
      } else {
        setShowVideoWatermarkDialog(false);
      }
    } catch (error) {
      console.error('Video processing job failed:', error);
      showErrorToast(`Kunne ikke starte ${jobType === 'render' ? 'rendering' : 'vannmerking'}.`);
    } finally {
      window.setTimeout(() => {
        setIsProcessingVideo(false);
        setProcessingProgress(0);
      }, 300);
    }
  }, [
    addNotification,
    isProcessingVideo,
    selectedPreset,
    selectedVideoIds,
    showErrorToast,
    showWarningToast,
    submitVideoJob,
    watermarkOpacity,
    watermarkPosition,
    watermarkText,
    watermarkType,
  ]);

  const startProxyGeneration = useCallback(async () => {
    try {
      const response = await submitVideoJob('proxy', {
        proxyQuality,
        keepOriginalProxyFiles,
      });
      setShowProxyGenerator(false);
      showSuccessToast(`Proxy-generering startet${response.jobId ? ` (${response.jobId})` : ''}.`);
    } catch (error) {
      console.error('Proxy generation failed:', error);
      showErrorToast('Kunne ikke starte proxy-generering.');
    }
  }, [
    keepOriginalProxyFiles,
    proxyQuality,
    showErrorToast,
    showSuccessToast,
    submitVideoJob,
  ]);

  const startMulticamSyncJob = useCallback(async () => {
    try {
      const response = await submitVideoJob('multicam-sync', {
        masterAudioSource: multicamMasterSource,
        syncPrecision: multicamSyncPrecision,
      });
      setShowMulticamSync(false);
      showSuccessToast(`Multicam-sync startet${response.jobId ? ` (${response.jobId})` : ''}.`);
    } catch (error) {
      console.error('Multicam sync failed:', error);
      showErrorToast('Kunne ikke starte multicam-sync.');
    }
  }, [
    multicamMasterSource,
    multicamSyncPrecision,
    showErrorToast,
    showSuccessToast,
    submitVideoJob,
  ]);

  const createChapterMarkers = async () => {
    const baseLabel = weddingPackageLabels[selectedWeddingPackage];
    const chapterSeed = timecodedComments.length > 0
      ? timecodedComments
          .filter((comment) => comment.timecode >= chapterMinimumSeconds)
          .map((comment) => `${Math.round(comment.timecode)}s - ${comment.comment}`)
      : [
          `${baseLabel} intro`,
          `${baseLabel} hoveddel`,
          `${baseLabel} avslutning`,
        ];

    const uniqueChapters = Array.from(new Set(chapterSeed)).slice(0, 8);
    const sequence = await createVideoSequence(
      `${baseLabel} - ${videoVersion}`,
      uniqueChapters,
    );

    if (sequence) {
      setShowChapterMarker(false);
      setShowChapterDialog(false);
      showSuccessToast(`Kapittelmarkorer opprettet for ${baseLabel}.`);
    }
  };

  const requestSubtitleGeneration = useCallback(async () => {
    try {
      const response = await submitVideoJob('subtitle', {
        language: 'nb-NO',
        subtitleFormat: 'srt',
        chapterCount: videoSequences.length,
      });
      setShowSubtitleDialog(false);
      showSuccessToast(`Undertekst-jobb startet${response.jobId ? ` (${response.jobId})` : ''}.`);
    } catch (error) {
      console.error('Subtitle generation failed:', error);
      showErrorToast('Kunne ikke starte undertekst-generering.');
    }
  }, [
    showErrorToast,
    showSuccessToast,
    submitVideoJob,
    videoSequences.length,
  ]);

  const configureStreamingJob = useCallback(async () => {
    try {
      const response = await submitVideoJob('streaming', {
        streamingProtocol,
        bitrateProfiles: streamingBitrateProfiles,
      });
      setShowStreamingSetup(false);
      showSuccessToast(`Streaming-jobb startet${response.jobId ? ` (${response.jobId})` : ''}.`);
    } catch (error) {
      console.error('Streaming setup failed:', error);
      showErrorToast('Kunne ikke konfigurere streaming.');
    }
  }, [
    showErrorToast,
    showSuccessToast,
    streamingBitrateProfiles,
    streamingProtocol,
    submitVideoJob,
  ]);

  const _openMetadataEditor = () => {
    if (selectedImages.size === 0) {
      showWarningToast('Velg bilder først');
      return;
    }
    
    // Load existing metadata from selected items if available
    const imageIds = Array.from(selectedImages);
    if (imageIds.length > 0) {
      try {
        // Try to get metadata from first selected item to pre-populate
        const firstItem = showcaseItems?.find((item: any) => item.id === imageIds[0]);
        if (firstItem) {
          const existingCropData = firstItem.cropData 
            ? (typeof firstItem.cropData === 'string' ? JSON.parse(firstItem.cropData) : firstItem.cropData)
            : {};
          
          // Get default copyright from business info or use existing
          const defaultCopyright = businessInfo?.businessInfo?.businessName 
            ? `© ${businessInfo.businessInfo.businessName}` 
            : '© CreatorHub Norge';
          
          setBulkMetadata({
            title: firstItem.title?.replace('Forbedret:', ', ') || ',',
            description: firstItem.description || '',
            tags: existingCropData.tags || '',
            location: existingCropData.location || '',
            copyright: existingCropData.copyright || defaultCopyright
          });
        } else {
          // Use business name from settings if available
          const defaultCopyright = businessInfo?.businessInfo?.businessName 
            ? `© ${businessInfo.businessInfo.businessName}` 
            : '© CreatorHub Norge';
          setBulkMetadata(prev => ({
            ...prev,
            copyright: defaultCopyright
          }));
        }
      } catch (error) {
        console.error('Error loading existing metadata:', error);
        // Fallback to business name or default
        const defaultCopyright = businessInfo?.businessInfo?.businessName 
          ? `© ${businessInfo.businessInfo.businessName}` 
          : '© CreatorHub Norge';
        setBulkMetadata(prev => ({
          ...prev,
          copyright: defaultCopyright
        }));
      }
    } else {
      // Use business name from settings if available
      const defaultCopyright = businessInfo?.businessInfo?.businessName 
        ? `© ${businessInfo.businessInfo.businessName}` 
        : '© CreatorHub Norge';
      setBulkMetadata(prev => ({
        ...prev,
        copyright: defaultCopyright
      }));
    }
    
    setShowMetadataEditor(true);
  };

  const applyBulkMetadata = async () => {
    if (activeSelectionIds.length === 0) {
      showWarningToast('Velg bilder først');
      return;
    }

    setIsProcessingBulkOperation(true);
    setBulkOperationProgress(0);

    try {
      const imageIds = activeSelectionIds;
      const totalImages = imageIds.length;
      
      for (let i = 0; i < totalImages; i++) {
        // Update basic metadata
        const metadataResponse = await fetch(`/api/showcase/update-metadata/${imageIds[i]}`, {
          method: 'PUT',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify(bulkMetadata)
        });

        if (!metadataResponse.ok) {
          throw new Error(`Feil ved oppdatering av metadata for bilde ${i + 1}`);
        }

        // Update display preferences
        const preferencesResponse = await fetch(`/api/showcase/items/${imageIds[i]}`, {
          method: 'PUT',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            displayPreferences: displayPreferences
          })
        });

        if (!preferencesResponse.ok) {
          console.warn(`Could not update display preferences for image ${i + 1}`);
        }

        setBulkOperationProgress(((i + 1) / totalImages) * 100);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      showSuccessToast(`Metadata og visningsinnstillinger oppdatert for ${totalImages} bilder!`);
      setShowMetadataEditor(false);
      setSelectedImages(new Set());
      setSelectedBatchItems(new Set());
      refetch();
    } catch (error) {
      console.error('Bulk metadata update failed:', error);
      showErrorToast('Feil under oppdatering av metadata');
    } finally {
      setIsProcessingBulkOperation(false);
      setBulkOperationProgress(0);
    }
  };

  const executeBulkOperation = async (operation: string, overrideIds?: string[]) => {
    const imageIds = overrideIds ?? activeSelectionIds;
    if (imageIds.length === 0) {
      showWarningToast('Velg bilder først');
      return;
    }
    
    try {
      switch (operation) {
        case 'bulk-download': {
          const downloadResponse = await fetch('/api/showcase/bulk-download', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
            body: JSON.stringify({ imageIds })
      });
          
          if (downloadResponse.ok) {
            const blob = await downloadResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `selected-images-${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
      }
          break;
        }

        case 'toggle-favorite':
          await fetch('/api/showcase/toggle-favorite', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
            body: JSON.stringify({ imageIds })
      });
          break;

        case 'archive':
          await fetch('/api/showcase/archive-images', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
            body: JSON.stringify({ imageIds })
      });
          break;

        case 'delete':
          await fetch('/api/showcase/delete-images', {
      method: 'DELETE',
      headers: { 'Content-Type' : 'application/json' },
            body: JSON.stringify({ imageIds })
      });
          break;

        case 'rotate-left':
        case 'flip-horizontal':
          await fetch('/api/showcase/quick-transform', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
            body: JSON.stringify({ imageIds, operation })
      });
          break;

        default: // Unknown operation
          return;
}

      const operationNames: Record<string, string> = {
        'bulk-download':'lastet ned','toggle-favorite':'favoritt-status endret for','archive':'arkivert','delete':'slettet','rotate-left':'rotert','flip-horizontal':'speilet','auto-crop' : 'beskåret'
      };

      showSuccessToast(`${imageIds.length} bilder ${operationNames[operation]}!`);
      setSelectedImages(new Set());
      setSelectedBatchItems(new Set());

      if (['archive','delete'].includes(operation)) {
        refetch();
  }
} catch (error) {
      console.error('Bulk operation failed:', error);
      showErrorToast(`Feil under utførelse av operasjon: ${operation}`);
}
};

  const executeEnhancement = async () => {
    if (selectedImages.size === 0) return;
    
    setIsEnhancing(true);
    setEnhancementProgress(0);
    
    try {
      const preset = enhancementPresets[selectedPhotoPreset];
      const enhancementOptions = selectedPhotoPreset === 'custom' 
        ? customEnhancementOptions 
        : preset?.options;
      
      const response = await fetch('/api/showcase/batch-operations', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          operation: 'bulk-photo-enhance',
          itemIds: Array.from(selectedImages),
          preset: selectedPhotoPreset,
          enhancementOptions,
          profession,
          userId: effectiveUserId
  })
  });

      if (response.ok) {
        await response.json();
        setEnhancementProgress(100);
        setShowPhotoEnhancer(false);
        setSelectedImages(new Set());
        setSelectedBatchItems(new Set());
        await queryClient.invalidateQueries({ queryKey: [`/api/showcase/profession/${profession}`] });
        refetch();
        showSuccessToast(`Forbedring startet for ${activeSelectionIds.length} bilder.`);
  } else {
        throw new Error('Enhancement failed');
  }
} catch (error) {
      console.error('Enhancement error:', error);
      showErrorToast('Feil ved bildeforbedring. Prøv igjen.');
} finally {
      setIsEnhancing(false);
      setEnhancementProgress(0);
}
};

  // Video-specific functions for videographer profession
  const addTimecodedComment = async (timecode: number, comment: string) => {
    if (!selectedItem?.id || !comment.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/video/timecoded-comments', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          videoId: selectedItem?.id,
          timecode,
          comment,
          version: videoVersion,
          userId
    })
  });

      if (!response.ok) throw new Error('Failed to add timecoded comment');
      
      const newComment = (await response.json()) as {
        id: string;
        timecode: number;
        comment: string;
        version: string;
      };
      setTimecodedComments(prev => [...prev, newComment]);
} catch (error) {
      console.error('Error adding timecoded comment:', error);
    }
  };

  const createVideoSequence = async (sequenceName: string, chapters: string[]) => {
    if (!selectedItem?.id) {
      showWarningToast('Velg en video for a opprette sekvenser.');
      return null;
    }

    try {
      const response = await fetch('/api/video/sequences', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: selectedItem?.id,
          sequenceName,
          chapters,
          version: videoVersion
  })
  });

      if (!response.ok) throw new Error('Failed to create video sequence');
      
      const sequence = (await response.json()) as VideoSequenceRecord;
      setVideoSequences((prev) => [...prev, sequence]);
      setSelectedSequence(sequence.id);
      if (chapters.length > 0) {
        setSelectedChapter(chapters[0]);
      }
      return sequence;
} catch (error) {
      console.error('Error creating video sequence:', error);
      showErrorToast('Kunne ikke opprette videosekvens.');
      return null;
	}
  };

  const generateVideoThumbnails = async (videoId: string) => {
    if (!videoId) {
      showWarningToast('Velg en video for a generere thumbnails.');
      return;
    }

    try {
      const response = await fetch('/api/video/generate-thumbnails', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          videoId,
          count:  5, // Generate 5 thumbnails at different timestamps
          useAI: true // Use AI to select best frames
  })
  });

      if (!response.ok) throw new Error('Failed to generate thumbnails');
      
      const result = (await response.json()) as {
        thumbnails?: Array<{ url: string }>;
      };
      const firstThumbnail = result.thumbnails?.[0]?.url;
      if (firstThumbnail && selectedItem?.id === videoId) {
        setSelectedItem((prev) => (prev ? { ...prev, thumbnailUrl: firstThumbnail } : prev));
      }
      showSuccessToast('Thumbnails generert! Du kan nå velge den beste.');
    } catch (error) {
      console.error('Error generating thumbnails:', error);
      showErrorToast('Feil ved generering av thumbnails. Prøv igjen.');
    }
  };


  const _loadProjectsAndCategories = async () => {
    try {
      // Load available projects
      const projectsResponse = await fetch('/api/projects', {
        credentials: 'include'
      });
      if (projectsResponse.ok) {
        const projects = await projectsResponse.json();
        setAvailableProjects(projects);
      }

      // Load available categories
      const categoriesResponse = await fetch('/api/showcase/categories', {
        credentials: 'include'
      });
      if (categoriesResponse.ok) {
        const categories = await categoriesResponse.json();
        setAvailableCategories(categories);
      }
    } catch (error) {
      console.error('Could not load projects/categories:', error);
    }
  };











  // Fetch comments for selected showcase
  const { data: _commentsData, isLoading: _commentsLoading } = useQuery({
    queryKey: [`/api/showcase/${selectedItem?.id}/comments`],
    queryFn: async () => {
      if (!selectedItem?.id) return [];
      const response = await fetch(`/api/showcase/${selectedItem.id}/comments`);
      if (!response.ok) return [];
      return response.json();
},
    enabled: !!selectedItem && showComments
});

  const getProfessionConfig = () => {
    // Use profession configuration from the hook
    if (professionConfig) {
      return {
        title: getTerm(''),
        primaryColor: professionConfig.color,
        gradientColor: `linear-gradient(135deg, ${professionConfig.color} 0%, ${professionConfig.color}80 100%)`,
        icon: profession === 'photographer' ? <PhotoLibrary /> :
              profession === 'videographer' ? <VideoLibrary /> :
              profession === 'music_producer' ? <LibraryMusic /> :
              <Description />,
        fileTypes: (professionConfig as any).settings?.supportedFileTypes || ['photo','design'],
        defaultType: (professionConfig as any).settings?.defaultFileTypes?.[0] || 'photo'
      };
    }

    // Fallback to hardcoded configs if profession config is not loaded
    switch (profession) {
      case 'photographer':
        return {
          title: 'Fotogalleri',
          primaryColor: '#FF6B35',
          gradientColor: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
          icon: <PhotoLibrary />,
          fileTypes: ['photo','design'],
          defaultType: 'photo'
        };
      case 'videographer':
        return {
          title: 'Video Portfolio',
          primaryColor: '#E74C3C',
          gradientColor: 'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)',
          icon: <VideoLibrary />,
          fileTypes: ['video'],
          defaultType: 'video'
        };
      case 'music_producer':
        return {
          title: 'Musikk Portfolio',
          primaryColor: '#9B59B6',
          gradientColor: 'linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%)',
          icon: <LibraryMusic />,
          fileTypes: ['audio'],
          defaultType: 'audio'
        };
      case 'vendor':
        return {
          title: 'Produktkatalog',
          primaryColor: '#3498DB',
          gradientColor: 'linear-gradient(135deg, #3498DB 0%, #2980B9 100%)',
          icon: <Description />,
          fileTypes: ['photo','document','design'],
          defaultType: 'photo'
        };
      default:
        return {
          title: 'Showcase',
          primaryColor: '#FF6B35',
          gradientColor: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
          icon: <PhotoLibrary />,
          fileTypes: ['photo','design'],
          defaultType: 'photo'
        };
    }
  };

  const config = getProfessionConfig();

  // Get profession-specific categories for sidebar navigation
  const getProfessionCategories = () => {
    // Use profession configuration if available
    if (professionConfig && (professionConfig as any).settings?.allowedCategories) {
      const baseCategory = `Alle ${getTerm('media').toLowerCase()}`;
        return [baseCategory, 'Fremhevet', ...(professionConfig as any).settings.allowedCategories];
    }

    // Fallback to hardcoded categories
    const baseCategory = profession === 'photographer' ? 'Alle bilder' :
                        profession === 'videographer' ? 'Alle videoer' :
                        profession === 'music_producer' ? 'Alle låter' : 'Alle elementer';

      const professionCategories: Record<string, string[]> = {
        photographer: [baseCategory, 'Fremhevet','Bryllup','Portretter','Events','Kommersielt'],
        videographer: [baseCategory, 'Fremhevet','Bryllup','Bedrift','Dokumentar','Reklame'],
        music_producer: [baseCategory, 'Fremhevet','Album','Single','Reklame','Soundtrack'],
        vendor: [baseCategory, 'Fremhevet','Utstyr','Tjenester','Portfolio'],
        enterprise: [baseCategory, 'Fremhevet','Bryllup','Bedrift','Events','Portretter','Dokumentar','Kommersielt']
    };

    return professionCategories[profession] || professionCategories.photographer;
  };
  // Fetch user branding for client-facing showcase
  const { data: _userBranding } = useQuery({
    queryKey: [`/api/branding/settings`, userId],
    queryFn: async () => {
      const response = await fetch(`/api/branding/settings?userId=${userId}`);
      if (!response.ok) return null;
      return response.json();
},
    enabled: !!userId
});

  const filteredItems = items.filter((item: ShowcaseItem) => {
    if (showPublishToEvendiDialog) {
      if (evendiProjectId && item.projectId !== evendiProjectId) return false;
      if (evendiEventType && item.projectType !== evendiEventType) return false;
    }
    if (filter === 'all') return true;
    // Slice 9X.81 — støtt både `featured` (legacy) og `isFeatured` (kanonisk)
    if (filter === 'featured') return Boolean(item.isFeatured ?? item.featured);
    if (filter === 'favorites') return favorites.has(item.id);
    if (quickTagFilter) return item.tags?.includes(quickTagFilter);
    return item.fileType === filter;
  }).sort((a, b) => {
    if (sort === 'date') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    if (sort === 'name') return (a.title || '').localeCompare(b.title || '');
    if (sort === 'favorite') return (favorites.has(b.id) ? 1 : 0) - (favorites.has(a.id) ? 1 : 0);
    return 0;
  }).slice(0, maxItems as number);

  // Slice 9X.81 — støtt både legacy `featured` og kanonisk `isFeatured`
  const currentFeaturedItem = featuredItem
    || items.find((item: ShowcaseItem) => Boolean(item.isFeatured ?? item.featured))
    || items[0];

  const toggleFavorite = (itemId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(itemId)) {
        newFavorites.delete(itemId);
      } else {
        newFavorites.add(itemId);
      }
      return newFavorites;
    });
  };

  // Delete item handler with callback
  const _handleDeleteItem = useCallback(async (itemId: string) => {
    try {
      if (onItemDelete) {
        await onItemDelete(itemId);
        addNotification({ message: 'Item deleted successfully', type: 'success' });
      }
    } catch (error) {
      console.error('Delete item error:', error);
      addNotification({ message: 'Failed to delete item', type: 'error' });
    }
  }, [onItemDelete, addNotification]);

  // Format timestamp for video comments with timecode support
  const _formatTimestamp = (seconds: number) => {
    if (typeof seconds !== 'number') return '0:00';
    const timecode = secondsToTimecode(seconds);
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} (${timecode})`;
  };

  // Add comment with timestamp
  const _handleAddComment = async () => {
    if (!newComment.trim() || !selectedItem) return;

    const commentData = {
      showcaseItemId: selectedItem.id,
      userId: effectiveUserId,
      userName: 'Daniel CreatorHub',
      userEmail: user?.email || '',
      comment: newComment,
      commentType: 'general',
      isPrivate: false,
      parentCommentId: replyingTo,
      timestamp: selectedItem.type === 'video' ? currentVideoTime : null
    };

    try {
      // Add comment via API
      const response = await fetch(`/api/showcase/${selectedItem.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(commentData)
      });

      if (response.ok) {
        setNewComment('');
        setReplyingTo(null);
        // Refresh comments (will trigger via query invalidation)
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  // Toggle comment like
  const _handleToggleCommentLike = async (commentId: string) => {
    try {
      const response = await fetch(`/api/showcase/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        // Refresh comments
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const _getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'video': return <VideoLibrary />;
      case 'photo': return <PhotoLibrary />;
      case 'audio': return <LibraryMusic />;
      case 'document': return <Description />;
      case 'design': return <Palette />;
      default: return <Description />;
    }
  };

  // Loading fallback — NOT an early return (hooks must always be called)
  const _loadingFallback = isFetchingData ? (
    <MuiCard sx={{ 
      background: config.gradientColor,
      color: '#fff',
      borderRadius: 3,
      minHeight: compact ? 200 : 400,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Typography variant="h6">
        {clientMode 
          ? 'Laster ditt bildegalleri...' 
          : `Laster ${config.title.toLowerCase()}...`
        }
      </Typography>
    </MuiCard>
  ) : null;

  // Client Mode Status Bar
  const renderClientStatusBar = () => {
    if (!clientMode || !sessionData) return null;

    const selectionCount = clientSelections.length;
    const maxSelections = sessionData.maxSelections;
    const deadline = sessionData.selectionDeadline ? new Date(sessionData.selectionDeadline) : null;
    const isExpired = deadline && new Date() > deadline;
    
    return (
      <Paper
        sx={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          borderRadius: 2,
          p: 3,
          mb: 3,
          border: '1px solid rgba(255, 107, 53, 0.2)',
          color: '#fff'}}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 25%' }, maxWidth: { xs: '100%', md: '25%' } }}>
            <Typography variant="h6" sx={{ mb: 1, color: theming.colors.primary }}>
              {sessionData.sessionName}
            </Typography>
            <Chip 
              label={`Runde ${sessionData.proofingRound}`}
              size="small"
              sx={{ 
                backgroundColor: accentColor,
                color: '#fff'}}
            />
          </Box>
          
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 25%' }, maxWidth: { xs: '100%', md: '25%' } }}>
            <Typography variant="body2" sx={{ color: '#999', mb: 0.5 }}>
              Valgte bilder
            </Typography>
            <Typography variant="h4" sx={{ color: accentColor }}>
              {selectionCount}
              {maxSelections && (
                <Typography 
                  component="span" 
                  variant="body1" 
                  sx={{ color: '#999', ml: 1 }}
                >
                  / {maxSelections}
                </Typography>
              )}
            </Typography>
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 25%' }, maxWidth: { xs: '100%', md: '25%' } }}>
            <Typography variant="body2" sx={{ color: '#999', mb: 0.5 }}>
              Status
            </Typography>
            <Chip 
              label={
                isExpired ? 'Utløpt' :
                sessionData.status === 'active' ? 'Aktivt utvalg' :
                sessionData.status === 'selections_made' ? 'Utvalg gjort' :
                'Venter'
          }
              color={
                isExpired ? 'error' :
                sessionData.status === 'active' ? 'success' :
                sessionData.status === 'selections_made' ? 'warning' :
                'default'
          }
              size="small"
            />
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 25%' }, maxWidth: { xs: '100%', md: '25%' } }}>
            {deadline && !isExpired && (
              <>
                <Typography variant="body2" sx={{ color: '#999', mb: 0.5 }}>
                  Frist
                </Typography>
                <Typography variant="body1">
                  {deadline.toLocaleDateString('nb-NO')}
                </Typography>
              </>
            )}
          </Box>
        </Box>

        {sessionData.description && (
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#999', 
              mt: 2,
              fontStyle: 'italic'
            }}
          >
            {sessionData.description}
          </Typography>
        )}
      </Paper>
  );
};

  // Showcase Sharing Dialog Component
  const ShowcaseSharingDialog = ({ 
    open, 
    onClose,
    prefilledClient,
    showcases,
    shareShowcaseMutation,
    user,
    profession
}: {
    open: boolean;
    onClose: () => void;
    prefilledClient?: { email: string; name: string };
    showcases: any[];
    shareShowcaseMutation: any;
    user: any;
    profession: string;
}) => {
    const [shareForm, setShareForm] = useState({
      selectedShowcase: '',
      clientEmail: prefilledClient?.email || '',
      clientName: prefilledClient?.name || '',
      message: prefilledClient ? `Hei ${prefilledClient.name}! Takk for din interesse. Her er ditt ${getTerm('showcase').toLowerCase()} som du kan se og laste ned.` : ',',
      photographerName: user?.name || '',
      photographerCompany: '',
      projectState: 'in_review' as 'delivered' | 'in_review',
      projectId: null as string | null
    });

    // Update projectId when showcase is selected
    useEffect(() => {
      if (shareForm.selectedShowcase) {
        const showcase = showcases.find((s: any) => s.id === shareForm.selectedShowcase);
        if (showcase?.projectId) {
          setShareForm(prev => ({ ...prev, projectId: showcase.projectId }));
        }
      }
    }, [shareForm.selectedShowcase, showcases]);

    const handleShareShowcase = async () => {
      try {
        const showcase = showcases.find((s: any) => s.id === shareForm.selectedShowcase);
        if (!showcase) return;

        await shareShowcaseMutation.mutateAsync({
          showcaseId: shareForm.selectedShowcase,
          clientEmail: shareForm.clientEmail,
          clientName: shareForm.clientName,
          message: shareForm.message,
          photographerName: shareForm.photographerName,
          photographerCompany: shareForm.photographerCompany,
          projectState: shareForm.projectState,
          projectId: showcase.projectId || shareForm.projectId
        });
        
        onClose();
      } catch (error) {
        console.error('Error sharing showcase:', error);
      }
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Image color="primary" />
            <Typography variant="h6">Share {getTerm('showcase')} with {getTerm('client')}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Showcase Selection */}
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Select {getTerm('showcase')}</InputLabel>
                <Select
                  value={shareForm.selectedShowcase}
                  label={`Select ${getTerm('showcase')}`}
                  onChange={(e) => setShareForm(prev => ({ ...prev, selectedShowcase: e.target.value }))}
                >
                  {showcases.map((showcase: any) => (
                    <MenuItem key={showcase.id} value={showcase.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: '#ff8c00', width: 32, height: 32 }}>
                          <Camera fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">{showcase.title || `Showcase ${showcase.id.slice(-8)}`}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {showcase.photos?.length || 0} photos
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Client Information */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
                <TextField
                  fullWidth
                  label={`${getTerm('client')} Email`}
                  type="email"
                  value={shareForm.clientEmail}
                  onChange={(e) => setShareForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
                <TextField
                  fullWidth
                  label={`${getTerm('client')} Name`}
                  value={shareForm.clientName}
                  onChange={(e) => setShareForm(prev => ({ ...prev, clientName: e.target.value }))}
                  required
                />
              </Box>
            </Box>

            {/* Photographer Information */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
                <TextField
                  fullWidth
                  label="Photographer Name"
                  value={shareForm.photographerName}
                  onChange={(e) => setShareForm(prev => ({ ...prev, photographerName: e.target.value }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
                <TextField
                  fullWidth
                  label="Company Name"
                  value={shareForm.photographerCompany}
                  onChange={(e) => setShareForm(prev => ({ ...prev, photographerCompany: e.target.value }))}
                  required
                />
              </Box>
            </Box>

            {/* Custom Message */}
            <TextField
              fullWidth
              label="Custom Message (Optional)"
              multiline
              rows={3}
              value={shareForm.message}
              onChange={(e) => setShareForm(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Skriv en personlig melding som inkluderes i showcaset…"
              sx={{ mb: 3 }}
            />

            {/* Project Linking - Show when no project is linked */}
            {shareForm.selectedShowcase && !shareForm.projectId && (
              <Box sx={{ mb: 3 }}>
                <Paper sx={{ p: 2, bgcolor: 'info.light', border: '1px solid', borderColor: 'info.main' }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Info fontSize="small" />
                    Link to Project (Optional)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Link this showcase to a project to enable project state management and timeline tracking.
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<Add />}
                    onClick={() => setProjectSelectorOpen(true)}
                  >
                    Link to Project
                  </Button>
                  <ProjectSelectorModal
                    open={projectSelectorOpen}
                    onOpenChange={setProjectSelectorOpen}
                    onProjectSelected={async (project: any) => {
                      setShareForm(prev => ({ ...prev, projectId: project.id }));
                    }}
                    profession={profession as ProfessionType}
                  />
                </Paper>
              </Box>
            )}

            {/* Project State Selection - Only show when project is linked */}
            {shareForm.projectId && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <FormLabel>Project State</FormLabel>
                <RadioGroup
                  value={shareForm.projectState}
                  onChange={(e) => setShareForm(prev => ({ ...prev, projectState: e.target.value as 'delivered' | 'in_review' }))}
                >
                  <FormControlLabel 
                    value="in_review" 
                    control={<Radio />} 
                    label="In Client Review" 
                  />
                  <FormControlLabel 
                    value="delivered" 
                    control={<Radio />} 
                    label="Delivered" 
                  />
                </RadioGroup>
                
                {/* State Information Box */}
                <Paper sx={{ 
                  p: 2, 
                  mt: 2, 
                  bgcolor: shareForm.projectState === 'delivered' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)',
                  border: `1px solid ${shareForm.projectState === 'delivered' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 152, 0, 0.3)'}`
                }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    You have chosen that the project is {shareForm.projectState === 'delivered' ? 'delivered' : 'in review'}
                  </Typography>
                  <Typography variant="body2" component="div">
                    This means:
                    <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                      {shareForm.projectState === 'delivered' ? (
                        <>
                          <li>The content is watermark free</li>
                          <li>The client can't comment anymore</li>
                          <li>The content can be downloaded by the client</li>
                          <li>The project is completed</li>
                        </>
                      ) : (
                        <>
                          <li>The content is watermarked</li>
                          <li>The client can comment</li>
                          <li>The content can't be downloaded by the client</li>
                          <li>(If photos) the client has to choose photos, based on the contract agreement and add more photos that exceeds the agreed amount. The client will get back to you.</li>
                          <li>The project awaits client approval</li>
                        </>
                      )}
                    </Box>
                  </Typography>
                </Paper>
              </FormControl>
            )}

            {/* Info message when no project is linked */}
            {shareForm.selectedShowcase && !shareForm.projectId && (
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.100' }}>
                <Typography variant="body2" color="text.secondary">
                  <Info fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  No project linked. Project state management is only available when a project is linked.
                </Typography>
              </Paper>
            )}

            {/* Preview */}
            {shareForm.selectedShowcase && (
              <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preview: </Typography>
                <Typography variant="body2" color="text.secondary">
                  {shareForm.message || 'Your showcase is ready! Click the link below to view your photos.'}
                </Typography>
              </Paper>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleShareShowcase}
            variant="contained"
            color="primary"
            disabled={shareShowcaseMutation.isPending || !shareForm.selectedShowcase || !shareForm.clientEmail || !shareForm.clientName}
            sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67c00' } }}
          >
            {shareShowcaseMutation.isPending ? 'Sending...' : `Share ${getTerm('showcase')}`}
          </Button>
        </DialogActions>
      </Dialog>
  );
};

  // Overage Management Dialog Component
  const OverageManagementDialog = ({ 
    open, 
    onClose, 
    showcaseData,
    overageEmailMutation
}: {
    open: boolean;
    onClose: () => void;
    showcaseData?: any;
    overageEmailMutation: any;
}) => {
    const [overageForm, setOverageForm] = useState({
      clientEmail: '',
      clientName: '',
      projectName: '',
      totalImages:  0,
      contractLimit:  50,
      pricePerImage: 30,
      customMessage: ''
});

    useEffect(() => {
      if (showcaseData) {
        setOverageForm(prev => ({
          ...prev,
          clientEmail: showcaseData.clientEmail || '',
          clientName: showcaseData.clientName || '',
          projectName: showcaseData.projectName || '',
          totalImages: showcaseData.totalImages || 0,
          contractLimit: showcaseData.contractLimit || 50,
          pricePerImage: showcaseData.pricePerImage || 300 }));
      }
    }, [showcaseData]);

    const handleSendOverageEmail = async () => {
      try {
        await overageEmailMutation.mutateAsync({
          showcaseId: showcaseData?.showcaseId || 'temp',
          clientEmail: overageForm.clientEmail,
          clientName: overageForm.clientName,
          projectName: overageForm.projectName,
          totalImages: overageForm.totalImages,
          contractLimit: overageForm.contractLimit,
          pricePerImage: overageForm.pricePerImage
        });
        onClose();
      } catch (error) {
        console.error('Error sending overage email:', error);
      }
    };

    const overageImages = Math.max(0, overageForm.totalImages - overageForm.contractLimit);
    const totalOverageCost = overageImages * overageForm.pricePerImage;

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="warning" />
            <Typography variant="h6">Send {getTerm('overage')} Notification</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Contract Summary */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(255,186,108,0.08)', border: '1px solid #ff6f00' }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <DescriptionIcon sx={{ color: '#ff6f00' }} />
                <Typography variant="h6" color="#ff6f00">
                  Contract Summary
                </Typography>
              </Stack>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Images Delivered: </Typography>
                  <Typography variant="h6" color="#ff6f00">
                    {overageForm.totalImages}
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <Typography variant="body2" color="text.secondary">
                    Contract Limit: </Typography>
                  <Typography variant="h6" color="text.primary">
                    {overageForm.contractLimit}
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <Typography variant="body2" color="text.secondary">
                    Overage Images: </Typography>
                  <Typography variant="h6" color={overageImages > 0 ? "#e65100" : "#4caf50"}>
                    {overageImages}
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Overage Cost: </Typography>
                  <Typography variant="h6" color="#e65100">
                    NOK {totalOverageCost}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Form Fields */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
                <TextField
                  fullWidth
                  label="Client Email"
                  type="email"
                  value={overageForm.clientEmail}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
                <TextField
                  fullWidth
                  label="Client Name"
                  value={overageForm.clientName}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, clientName: e.target.value }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 100%', minWidth: '100%' }}>
                <TextField
                  fullWidth
                  label="Project Name"
                  value={overageForm.projectName}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, projectName: e.target.value }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Total Images"
                  type="number"
                  value={overageForm.totalImages}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, totalImages: parseInt(e.target.value) || 0 }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Contract Limit"
                  type="number"
                  value={overageForm.contractLimit}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, contractLimit: parseInt(e.target.value) || 0 }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Pris per bilde (NOK)"
                  type="number"
                  value={overageForm.pricePerImage}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, pricePerImage: parseInt(e.target.value) || 300 }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 100%', minWidth: '100%' }}>
                <TextField
                  fullWidth
                  label="Custom Message (Optional)"
                  multiline
                  rows={3}
                  value={overageForm.customMessage}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, customMessage: e.target.value }))}
                  placeholder="Legg til en melding som inkluderes i e-posten…"
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSendOverageEmail}
            variant="contained"
            color="warning"
            disabled={overageEmailMutation.isPending || !overageForm.clientEmail || !overageForm.clientName}
          >
            {overageEmailMutation.isPending ? 'Sending...' : 'Send Overage Email'}
          </Button>
        </DialogActions>
      </Dialog>
  );
};

  // Lightroom Plugin Dialog Component
  const LightroomPluginDialog = ({ 
    open, 
    onClose,
    profession
}: {
    open: boolean;
    onClose: () => void;
    profession: string;
}) => {
    const [installStep, setInstallStep] = useState(0);
    
    // Display profession-specific instructions
    const professionInstructions = {
      photographer: 'Import your photography workflow',
      videographer: 'Sync video editing metadata',
      music_producer: 'Link audio project files'
    };
    const [isDownloading, setIsDownloading] = useState(false);
    const lightroomStatusQuery = useQuery({
      queryKey: ['showcase-lightroom-plugin-status'],
      queryFn: () => lightroomIntegrationService.getStatus(),
      enabled: open,
    });

    const professionConfig = getProfessionConfig();
    const professionCategories = getProfessionCategories();

    const handleDownloadPlugin = async () => {
      setIsDownloading(true);
      try {
        await lightroomIntegrationService.downloadPluginPackage(false);
        setInstallStep(1);
      } catch (error) {
        console.error('Download error:', error);
  } finally {
        setIsDownloading(false);
  }
};

    const installSteps = [
      {
        title: "Last ned Plugin",
        description: "Klikk på 'Last ned' for å få CreatorHub Norge Lightroom plugin",
        content: (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', mb: 1 }}>
              <ExtensionIcon />
              <Typography variant="h6">
                CreatorHub Norge Lightroom Plugin v2.0
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Direkte integrasjon mellom Lightroom, Google Drive og CreatorHub showcase
            </Typography>
            {lightroomStatusQuery.data ? (
              <>
              <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip
                  label={lightroomStatusQuery.data.workspaceConnected
                    ? `Google Drive: ${lightroomStatusQuery.data.googleEmail || 'koblet'}`
                    : 'Google-SSO mangler'}
                  color={lightroomStatusQuery.data.workspaceConnected ? 'success' : 'warning'}
                  variant="outlined"
                />
                <Chip
                  label={`Kilde: ${lightroomStatusQuery.data.workspaceSource || 'ukjent'}`}
                  color={lightroomStatusQuery.data.workspaceConnected ? 'info' : 'default'}
                  variant="outlined"
                />
                <Chip
                  label={`Token: ${lightroomStatusQuery.data.tokenPreview || 'ikke generert'}`}
                  color={lightroomStatusQuery.data.connected ? 'info' : 'default'}
                  variant="outlined"
                />
              </Box>
              {lightroomStatusQuery.data.workspaceWarning ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {lightroomStatusQuery.data.workspaceWarning}
                </Alert>
              ) : null}
              </>
            ) : null}
            {/* Display profession-specific instructions */}
            <Typography variant="body2" color="primary" sx={{ mb: 3, fontStyle: 'italic' }}>
              {professionInstructions[profession as keyof typeof professionInstructions] || 'Import your creative workflow'}
            </Typography>
            <Button variant="contained"
              onClick={handleDownloadPlugin}
              disabled={isDownloading}
              sx={{ mt: 2 }}
            >
              {isDownloading ? 'Laster ned...' : 'Last ned Plugin'}
            </Button>
          </Box>
        )
  },
      {
        title: "Installer i Lightroom",
        description: "Følg disse trinnene for å installere plugin i Lightroom Classic",
        content: (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              Installasjonsveiledning
            </Typography>
            <Box component="ol" sx={{ pl: 2 }}>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Åpne Adobe Lightroom Classic
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Gå til: <strong>File → Plug-in Manager...</strong>
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Klikk <strong>Add</strong> knappen
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Pakk ut zip-filen og velg mappen <strong>CreatorHubNorge.lrplugin</strong>
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Klikk <strong>Done</strong> for å lukke Plugin Manager
                </Typography>
              </li>
            </Box>
          </Box>
        )
},
      {
        title: "Konfigurer Plugin",
        description: "Sett opp plugin med dine innstillinger",
        content: (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              Plugin Konfigurasjon
            </Typography>
            <Box component="ol" sx={{ pl: 2 }}>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Bruk <strong>File → Export → CreatorHub Norge</strong> for å sende rendrede filer til Google Drive og showcase
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Høyreklikk og velg <strong>"Edit Settings..."</strong>
                </Typography>
              </li>
                <li>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Velg din profession: <strong>{professionConfig.title}</strong>
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Velg kategori: <strong>{professionCategories[0]}</strong>
                  </Typography>
                </li>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Aktiver <strong>Overage Management</strong> og <strong>Showcase Sharing</strong>
                </Typography>
              </li>
            </Box>
          </Box>
        )
  },
      {
        title: "Bruk Plugin",
        description: "Start å publisere til CreatorHub Norge showcase",
        content: (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              Hvordan bruke Plugin
            </Typography>
            <Box component="ol" sx={{ pl: 2 }}>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Høyreklikk på <strong>"CreatorHub Norge"</strong> i Publish Services
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Velg <strong>"Create Collection..."</strong> (dette lager en Showcase)
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Navngi din showcase (f.eks. "Johnson Wedding Showcase")
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Dra bilder fra Lightroom biblioteket til showcase sets
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Klikk <strong>"Publish"</strong> for å laste opp til CreatorHub Norge
                </Typography>
              </li>
            </Box>
          </Box>
        )
  }
    ];

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#ff8c00', color: 'white' }}>
          <CloudUpload />
          CreatorHub Norge Lightroom Plugin
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ p: 3 }}>
            {/* Progress Indicator */}
            <Box sx={{ mb: 3 }}>
              <LinearProgress 
                variant="determinate" 
                value={(installStep + 1) * 25} 
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Steg {installStep + 1} av {installSteps.length}: {installSteps[installStep]?.title}
              </Typography>
            </Box>

            {/* Current Step Content */}
            {installSteps[installStep] && (
              <>
                <Typography variant="h5" gutterBottom>
                  {installSteps[installStep].title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {installSteps[installStep].description}
                </Typography>
                {installSteps[installStep].content}
              </>
            )}

            {/* Benefits Section */}
            <Box sx={{ mt: 4, p: 3, bgcolor: 'rgba(255, 140, 0, 0.05)', borderRadius: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <RocketLaunchIcon />
                <Typography variant="h6">
                  Fordeler med CreatorHub Norge Plugin
                </Typography>
              </Stack>
              <Box component="ul" sx={{ pl: 2 }}>
                <li>
                  <Typography variant="body2">
                    <strong>Direkte publisering: </strong> Publiser direkte fra Lightroom til CreatorHub showcase
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Overage Management:</strong> Automatisk deteksjon og e-post ved overskudd av bilder
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Showcase Sharing:</strong> Automatisk deling med kunder via e-post
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Profession Configuration:</strong> Tilpasset terminologi for {professionConfig.title}
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Metadata Preservation: </strong> Bevarer all EXIF og metadata
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Batch Processing:</strong> Håndterer flere bilder samtidig
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Real-time Sync:</strong> Øyeblikkelig synkronisering med CreatorHub
                  </Typography>
                </li>
              </Box>
            </Box>

            {/* Profession-specific Categories */}
            <Box sx={{ mt: 3, p: 3, bgcolor: 'rgba(33, 150, 243, 0.05)', borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                📁 Tilgjengelige Kategorier for {professionConfig.title}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {professionCategories.map((category, index) => (
                  <Chip
                    key={index}
                    label={`📁 ${category}`}
                    variant="outlined"
                    size="small"
                    sx={{ mb: 1 }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          {installStep > 0 && (
            <Button onClick={() => setInstallStep(installStep - 1)}>
              Forrige
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          {installStep < installSteps.length - 1 ? (
            <Button variant="contained" 
              onClick={() => setInstallStep(installStep + 1)}
              disabled={installStep === 0 && !isDownloading}
            >
              Neste
            </Button>
          ) : (
            <Button variant="contained" onClick={onClose}>
              Ferdig
            </Button>
          )}
          <Button onClick={onClose}>Lukk</Button>
        </DialogActions>
      </Dialog>
  );
};

  // Custom Categories Dialog Component
  const CustomCategoriesDialog = ({ 
    open, 
    onClose,
    profession,
    userId
}: {
    open: boolean;
    onClose: () => void;
    profession: string;
    userId: string;
}) => {
    const [availableIcons] = useState([
      '📁','📸','🎥','🎵','💒','👤','🌿','🏙️','🎉','💼','🎨','🏞️','🌅','🌆','🌃','🏖️','🏔️','🌊','🌸','🍂'
    ]);

    const [availableColors] = useState([
      '#ff8c00','#2196f3','#4caf50','#f44336','#9c27b0','#ff9800','#00bcd4','#8bc34a','#e91e63','#3f51b5'
    ]);

    const handleCreateCategory = async () => {
      if (!newCategoryForm.name.trim()) return;

      await createCategoryMutation.mutateAsync({
        ...newCategoryForm,
        profession,
        userId
      });
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#ff8c00', color: 'white' }}>
          <Category />
          Lag ny kategori
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Kategorinavn"
                value={newCategoryForm.name}
                onChange={(e) => setNewCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Beskrivelse"
                value={newCategoryForm.description}
                onChange={(e) => setNewCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={2}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Velg ikon
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {availableIcons.map((icon) => (
                  <Button
                    key={icon}
                    variant={newCategoryForm.icon === icon ? "contained" : "outlined"}
                    onClick={() => setNewCategoryForm(prev => ({ ...prev, icon }))}
                    sx={{ minWidth: 'auto', p: 1 }}
                  >
                    {icon}
                  </Button>
                ))}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Velg farge
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {availableColors.map((color) => (
                  <Button
                    key={color}
                    variant={newCategoryForm.color === color ? "contained" : "outlined"}
                    onClick={() => setNewCategoryForm(prev => ({ ...prev, color }))}
                    sx={{ 
                      minWidth: 'auto', 
                      width: 40,
                      height: 40,
                      backgroundColor: color,
                      borderColor: color, '&:hover': {
                        backgroundColor: color,
                        opacity: 0.8
                      }
                    }}
                  />
                ))}
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Sorteringsrekkefølge"
                type="number"
                value={newCategoryForm.sortOrder}
                onChange={(e) => setNewCategoryForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                inputProps={{ min: 0 }}
              />
            </Grid>
          </Grid>

          {/* Preview */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(255, 140, 0, 0.05)', borderRadius: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Forhåndsvisning
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: 2,
                backgroundColor: newCategoryForm.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem'
              }}>
                {newCategoryForm.icon}
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ color: newCategoryForm.color }}>
                  {newCategoryForm.name || 'Kategorinavn'}
                </Typography>
                {newCategoryForm.description && (
                  <Typography variant="body2" color="text.secondary">
                    {newCategoryForm.description}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose}>Avbryt</Button>
          <Button variant="contained" 
            onClick={handleCreateCategory}
            disabled={!newCategoryForm.name.trim() || createCategoryMutation.isPending}
          >
            {createCategoryMutation.isPending ? 'Lager...' : 'Lag kategori'}
          </Button>
        </DialogActions>
      </Dialog>
  );
};

  // Custom Sets Dialog Component
  const CustomSetsDialog = ({ 
    open, 
    onClose,
    profession,
    userId,
    availableCategories
}: {
    open: boolean;
    onClose: () => void;
    profession: string;
    userId: string;
    availableCategories: any[];
}) => {
    const handleCreateSet = async () => {
      if (!newSetForm.name.trim() || !newSetForm.categoryId) return;

      await createSetMutation.mutateAsync({
        ...newSetForm,
        profession,
        userId
      });
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#2196f3', color: 'white' }}>
          <FolderSpecial />
          Lag ny show
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Samlingsnavn"
                value={newSetForm.name}
                onChange={(e) => setNewSetForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Kategori</InputLabel>
                <Select
                  value={newSetForm.categoryId}
                  label="Kategori"
                  onChange={(e) => setNewSetForm(prev => ({ ...prev, categoryId: e.target.value }))}
                >
                  {availableCategories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Beskrivelse"
                value={newSetForm.description}
                onChange={(e) => setNewSetForm(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Sorteringsrekkefølge"
                type="number"
                value={newSetForm.sortOrder}
                onChange={(e) => setNewSetForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                inputProps={{ min: 0 }}
              />
            </Grid>
          </Grid>

          {/* Preview */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(33, 150, 243, 0.05)', borderRadius: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Forhåndsvisning
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: 2,
                backgroundColor: '#2196f3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem'
              }}>
                <FolderSpecial />
              </Box>
              <Box>
                <Typography variant="subtitle1" color="#2196f3">
                  {newSetForm.name || 'Samlingsnavn'}
                </Typography>
                {newSetForm.description && (
                  <Typography variant="body2" color="text.secondary">
                    {newSetForm.description}
                  </Typography>
                )}
                {newSetForm.categoryId && (
                  <Typography variant="caption" color="text.secondary">
                    Kategori: {availableCategories.find(c => c.id === newSetForm.categoryId)?.name}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose}>Avbryt</Button>
          <Button variant="contained" 
            onClick={handleCreateSet}
            disabled={!newSetForm.name.trim() || !newSetForm.categoryId || createSetMutation.isPending}
          >
            {createSetMutation.isPending ? 'Lager...' : 'Lag samling'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Publish to Academy Dialog Component - Pro Plan Feature
  const PublishToAcademyDialog = ({ 
    open, 
    onClose,
    item,
    profession
}: {
    open: boolean;
    onClose: () => void;
    item: ShowcaseItem | null;
    profession: string;
}) => {
    const [availableCourses, setAvailableCourses] = useState<any[]>([]);
    const [isPublishing, setIsPublishing] = useState(false);

    // Fetch available Academy courses
    useEffect(() => {
      const fetchCourses = async () => {
        try {
          const response = await fetch(`/api/academy/courses?profession=${profession}`);
          if (response.ok) {
            const courses = await response.json();
            setAvailableCourses(courses);
          }
        } catch (error) {
          console.error('Failed to fetch courses:', error);
        }
      };
      
      if (open) {
        fetchCourses();
      }
    }, [open, profession]);

    const handlePublishToAcademy = async () => {
      if (!item) return;
      
      setIsPublishing(true);
      try {
        if (publishToAcademyMode === 'existing') {
          // Publish to existing course
          if (!selectedCourseForPublish) {
            showWarningToast('Velg et kurs først');
            return;
          }
          
          const response = await fetch('/api/academy/courses/add-content', {
            method: 'POST',
            headers: { 'Content-Type' : 'application/json' },
            body: JSON.stringify({
              courseId: selectedCourseForPublish,
              contentType: item.fileType,
              contentUrl: item.fileUrl,
              thumbnailUrl: item.thumbnailUrl,
              title: item.title,
              description: item.description,
              profession,
              userId: effectiveUserId
            })
          });
          
          if (response.ok) {
            showSuccessToast(`"${item.title}," publisert til Academy kurs!`);
            onClose();
          } else {
            throw new Error('Failed to publish to course');
          }
        } else {
          // Create new course and publish
          if (!newCourseData.title.trim() || !newCourseData.moduleTitle.trim()) {
            showWarningToast('Fyll ut kursnavn og modulnavn');
            return;
          }
          
          const response = await fetch('/api/academy/courses', {
            method: 'POST',
            headers: { 'Content-Type' : 'application/json' },
            body: JSON.stringify({
              title: newCourseData.title,
              description: newCourseData.description,
              category: newCourseData.category,
              difficulty: newCourseData.difficulty,
              profession,
              userId: effectiveUserId,
              initialContent: {
                moduleTitle: newCourseData.moduleTitle,
                contentType: item.fileType,
                contentUrl: item.fileUrl,
                thumbnailUrl: item.thumbnailUrl,
                title: item.title,
                description: item.description
              }
            })
          });
          
          if (response.ok) {
            const _result4 = await response.json();
            showSuccessToast(`Nytt kurs "${newCourseData.title}," opprettet med "${item.title},"!`);
            onClose();
            // Reset form
            setNewCourseData({
              title: '',
              description: '',
              category: 'photography',
              difficulty: 'beginner',
              moduleTitle: ''
            });
          } else {
            throw new Error('Failed to create course');
          }
        }
      } catch (error) {
        console.error('Publish to Academy error:', error);
        showErrorToast('Feil ved publisering til Academy. Prøv igjen.');
      } finally {
        setIsPublishing(false);
      }
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#ff8c00', color: 'white' }}>
          <School />
          Publiser til Academy
          <Chip label="PRO" size="small" sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,0.3)', color: 'white' }} />
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ mt: 2 }}>
            {/* Selected Item Preview */}
            {item && (
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(255, 140, 0, 0.05)', border: '1px solid rgba(255, 140, 0, 0.2)' }}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: '#ff8c00', fontWeight: 600}}>
                  📄 Valgt innhold
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box 
                    component="img" 
                    src={item.thumbnailUrl || 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2060%2060%22%3E%3Crect%20width%3D%2260%22%20height%3D%2260%22%20fill%3D%22%231a1a1a%22%2F%3E%3C%2Fsvg%3E'}
                    alt={item.title}
                    sx={{ width: 60, height: 60, borderRadius: 1, objectFit: 'cover' }}
                  />
                  <Box>
                    <Typography variant="subtitle1" fontWeight="600">{item.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Type: {item.fileType} • {item.description?.substring(0, 50)}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            )}

            {/* Mode Selection */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="600">
                Velg publiseringsmåte
              </Typography>
              <ToggleButtonGroup
                value={publishToAcademyMode}
                exclusive
                onChange={(_, value) => value && setPublishToAcademyMode(value)}
                fullWidth
              >
                <ToggleButton value="existing" sx={{ textTransform: 'none', py: 1.5 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Collections fontSize="small" />
                    <Typography variant="body2">Eksisterende kurs</Typography>
                  </Box>
                </ToggleButton>
                <ToggleButton value="new" sx={{ textTransform: 'none', py: 1.5 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <AddCircle fontSize="small" />
                    <Typography variant="body2">Nytt kurs</Typography>
                  </Box>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Existing Course Selection */}
            {publishToAcademyMode === 'existing' ? (
              <Box>
                <FormControl fullWidth>
                  <InputLabel>Velg kurs</InputLabel>
                  <Select
                    value={selectedCourseForPublish}
                    onChange={(e) => setSelectedCourseForPublish(e.target.value)}
                    label="Velg kurs"
                  >
                    {availableCourses.length === 0 ? (
                      <MenuItem disabled>
                        <em>Ingen kurs funnet. Opprett et nytt kurs.</em>
                      </MenuItem>
                    ) : (
                      availableCourses.map((course) => (
                        <MenuItem key={course.id} value={course.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <School fontSize="small" />
                            <Box>
                              <Typography variant="body2">{course.title}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {course.modules?.length || 0} moduler • {course.difficulty}
                              </Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Box>
            ) : (
              <Box>
                {/* New Course Form */}
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Kurstittel"
                      value={newCourseData.title}
                      onChange={(e) => setNewCourseData(prev => ({ ...prev, title: e.target.value }))}
                      required
                      placeholder="f.eks. Bryllupsfotografering Masterclass"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Kursbeskrivelse"
                      value={newCourseData.description}
                      onChange={(e) => setNewCourseData(prev => ({ ...prev, description: e.target.value }))}
                      multiline
                      rows={3}
                      placeholder="Beskriv hva kurset handler om..."
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Kategori</InputLabel>
                      <Select
                        value={newCourseData.category}
                        onChange={(e) => setNewCourseData(prev => ({ ...prev, category: e.target.value }))}
                        label="Kategori"
                      >
                        <MenuItem value="photography">
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <PhotoCameraIcon fontSize="small" /><span>Fotografering</span>
                          </Stack>
                        </MenuItem>
                        <MenuItem value="videography">
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <VideocamIcon fontSize="small" /><span>Videografi</span>
                          </Stack>
                        </MenuItem>
                        <MenuItem value="music-production">
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <MusicNoteIcon fontSize="small" /><span>Musikkproduksjon</span>
                          </Stack>
                        </MenuItem>
                        <MenuItem value="business">
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <BusinessCenterIcon fontSize="small" /><span>Business & Marketing</span>
                          </Stack>
                        </MenuItem>
                        <MenuItem value="editing">
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <ContentCutIcon fontSize="small" /><span>Redigering</span>
                          </Stack>
                        </MenuItem>
                        <MenuItem value="equipment">
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <CameraAltIcon fontSize="small" /><span>Utstyr</span>
                          </Stack>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Vanskelighetsgrad</InputLabel>
                      <Select
                        value={newCourseData.difficulty}
                        onChange={(e) => setNewCourseData(prev => ({ ...prev, difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced' }))}
                        label="Vanskelighetsgrad"
                      >
                        <MenuItem value="beginner">
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <GrassIcon fontSize="small" /><span>Nybegynner</span>
                          </Stack>
                        </MenuItem>
                        <MenuItem value="intermediate">
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <TrendingUpIcon fontSize="small" /><span>Middels</span>
                          </Stack>
                        </MenuItem>
                        <MenuItem value="advanced">
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <SchoolIcon fontSize="small" /><span>Avansert</span>
                          </Stack>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Første modulnavn"
                      value={newCourseData.moduleTitle}
                      onChange={(e) => setNewCourseData(prev => ({ ...prev, moduleTitle: e.target.value }))}
                      required
                      placeholder="f.eks. Introduksjon til bryllupsfotografering"
                    />
                  </Grid>
                </Grid>

                {/* Preview */}
                <Paper sx={{ p: 2, mt: 3, bgcolor: 'rgba(255, 140, 0, 0.05)', border: '1px solid rgba(255, 140, 0, 0.2)' }}>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.5 }}>
                    <MenuBookIcon fontSize="small" sx={{ color: '#ff8c00' }} />
                    <Typography variant="subtitle2" sx={{ color: '#ff8c00' }}>
                      Kursforhåndsvisning
                    </Typography>
                  </Stack>
                  <Typography variant="h6">{newCourseData.title || 'Kurstittel'}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {newCourseData.description || 'Kursbeskrivelse...'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip label={newCourseData.category} size="small" />
                    <Chip label={newCourseData.difficulty} size="small" color="primary" />
                  </Box>
                </Paper>
              </Box>
            )}

            {/* Publishing Info */}
            <Paper sx={{ p: 2, mt: 3, bgcolor: 'rgba(33, 150, 243, 0.05)', border: '1px solid rgba(33, 150, 243, 0.2)' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Info fontSize="small" color="info" />
                Om publisering til Academy
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {publishToAcademyMode === 'existing' 
                  ? 'Dette innholdet vil bli lagt til som en ny leksjon i det valgte kurset. Studenter vil få tilgang umiddelbart.'
                  : 'Et nytt kurs vil bli opprettet med dette innholdet som første leksjon. Du kan legge til flere moduler senere.'}
              </Typography>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose} disabled={isPublishing}>
            Avbryt
          </Button>
          <Button 
            variant="contained" 
            onClick={handlePublishToAcademy}
            disabled={
              isPublishing || 
              (publishToAcademyMode === 'existing' && !selectedCourseForPublish) ||
              (publishToAcademyMode === 'new' && (!newCourseData.title.trim() || !newCourseData.moduleTitle.trim()))
            }
            startIcon={isPublishing ? <CircularProgress size={20} /> : <School />}
            sx={{ 
              bgcolor: '#ff8c00','&:hover': { bgcolor: '#f57c00' }
            }}
          >
            {isPublishing ? 'Publiserer...' : 
             publishToAcademyMode === 'existing' ? 'Publiser til kurs' : 'Opprett kurs og publiser'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Get profession-specific theme (moved inside component scope)
  const professionTheme = getProfessionTheme(profession as any);
  const _componentTheme = getComponentTheme('showcase');

  const _quickTagOptions = useMemo(() => {
    const tags = new Set<string>();
    showcaseItems.forEach((item) => item.tags?.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [showcaseItems]);

  const quickActions = useMemo(
    () => [
      { id: 'toggle-demo', label: isDemoMode ? 'Deaktiver demo' : 'Aktiver demo', icon: isDemoMode ? <CheckCircle /> : <RadioButtonUnchecked /> },
      { id: 'open-dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
      { id: 'open-academy', label: 'Academy', icon: <School /> },
      { id: 'open-visual-editor', label: 'Visuell editor', icon: <ColorLens /> },
      { id: 'open-settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'open-upload', label: 'Last opp filer', icon: <CloudUpload /> },
      { id: 'open-projects', label: 'Prosjekter', icon: <FolderOpen /> },
      { id: 'toggle-view', label: viewMode === 'grid' ? 'Listevisning' : 'Rutenett', icon: viewMode === 'grid' ? <ViewList /> : <GridView /> },
      { id: 'toggle-batch', label: batchMode ? 'Avslutt batch' : 'Batchmodus', icon: <SelectAll /> },
      { id: 'toggle-sidebar', label: sidebarOpen ? 'Skjul meny' : 'Vis meny', icon: sidebarOpen ? <ChevronLeft /> : <ChevronRight /> },
      { id: 'open-command-palette', label: 'Kommando-meny', icon: <MenuIcon /> },
      { id: 'toggle-comments', label: showComments ? 'Skjul kommentarer' : 'Vis kommentarer', icon: <Comment /> },
      { id: 'open-analytics', label: 'Analyse', icon: <TimelineIcon /> },
      { id: 'open-share', label: 'Del', icon: <Share /> },
      { id: 'open-downloads', label: 'Nedlastinger', icon: <Download /> },
      { id: 'open-fullscreen', label: 'Fullskjerm', icon: <Fullscreen /> },
      { id: 'open-favorites', label: 'Favoritter', icon: <FavoriteBorder /> },
      { id: 'open-search', label: 'Sok', icon: <Search /> },
      { id: 'open-filter', label: 'Filtrer', icon: <FilterList /> },
      { id: 'open-notifications', label: 'Varsler', icon: <Notifications /> },
      { id: 'open-chat', label: 'Chat', icon: <Chat /> },
      { id: 'open-calendar', label: 'Kalender', icon: <CalendarMonth /> },
      { id: 'open-payment', label: 'Betaling', icon: <Payment /> },
      { id: 'open-store', label: 'Butikk', icon: <ShoppingCart /> },
      { id: 'open-pricing', label: 'Pris', icon: <AttachMoney /> },
      { id: 'open-contact', label: 'Kontakt', icon: <Phone /> },
      { id: 'open-email', label: 'Epost', icon: <Email /> },
      { id: 'open-business', label: 'Bedrift', icon: <Business /> },
      { id: 'open-language', label: 'Sprak', icon: <Language /> },
      { id: 'open-account', label: 'Konto', icon: <AccountCircle /> },
      { id: 'open-security', label: 'Sikkerhet', icon: <Security /> },
      { id: 'open-audio', label: 'Lyd', icon: <MusicNote /> },
      { id: 'open-video', label: 'Video', icon: <Videocam /> },
      { id: 'open-photo', label: 'Foto', icon: <CameraAlt /> },
      { id: 'open-collection', label: 'Samlinger', icon: <Collections /> },
      { id: 'open-tags', label: 'Tags', icon: <Tag /> },
      { id: 'open-location', label: 'Sted', icon: <LocationOn /> },
      { id: 'open-undo', label: 'Angre', icon: <Undo /> },
      { id: 'open-redo', label: 'Gjor om', icon: <Redo /> },
      { id: 'open-copy', label: 'Kopier', icon: <ContentCopy /> },
      { id: 'open-find', label: 'Finn', icon: <FindInPage /> },
      { id: 'open-fingerprint', label: 'Signatur', icon: <Fingerprint /> },
      { id: 'open-speed', label: 'Ytelse', icon: <Speed /> },
      { id: 'open-cache', label: 'Cache', icon: <Cached /> },
      { id: 'open-brightness', label: 'Lysstyrke', icon: <Brightness6 /> },
      { id: 'open-contrast', label: 'Kontrast', icon: <Contrast /> },
      { id: 'open-blur', label: 'Blur', icon: <BlurOn /> },
      { id: 'open-crop', label: 'Beskjaer', icon: <Crop /> },
      { id: 'open-rotate', label: 'Roter', icon: <Rotate90DegreesCcw /> },
      { id: 'open-flip', label: 'Speil', icon: <Flip /> },
      { id: 'open-transform', label: 'Transform', icon: <Transform /> },
      { id: 'open-archive', label: 'Arkiv', icon: <Archive /> },
      { id: 'open-drive', label: 'Flytt', icon: <DriveFileMove /> },
      { id: 'open-warning', label: 'Advarsel', icon: <Warning /> },
      { id: 'open-image', label: 'Bilde', icon: <Image /> },
      { id: 'open-folder', label: 'Mappe', icon: <FolderOpen /> },
      { id: 'open-new-folder', label: 'Ny mappe', icon: <CreateNewFolder /> },
      { id: 'open-library', label: 'Bibliotek', icon: <LibraryAdd /> },
      { id: 'open-playlist', label: 'Spilleliste', icon: <PlaylistPlay /> },
      { id: 'open-shuffle', label: 'Shuffle', icon: <Shuffle /> },
      { id: 'open-repeat', label: 'Repeat', icon: <Repeat /> },
      { id: 'open-next', label: 'Neste', icon: <SkipNext /> },
      { id: 'open-prev', label: 'Forrige', icon: <SkipPrevious /> },
      { id: 'open-ff', label: 'Spol frem', icon: <FastForward /> },
      { id: 'open-rw', label: 'Spol tilbake', icon: <FastRewind /> },
      { id: 'open-eq', label: 'Equalizer', icon: <Equalizer /> },
      { id: 'open-queue', label: 'Koe', icon: <QueueMusic /> },
      { id: 'open-volume', label: 'Volum', icon: <VolumeUp /> },
      { id: 'open-subtitles', label: 'Undertekster', icon: <Subtitles /> },
      { id: 'open-hq', label: 'HQ', icon: <HighQuality /> },
      { id: 'open-hd', label: 'HD', icon: <Hd /> },
      { id: 'open-4k', label: '4K', icon: <FourK /> },
      { id: 'open-video-settings', label: 'Video settings', icon: <VideoSettings /> },
      { id: 'open-graphic', label: 'Grafikk', icon: <GraphicEq /> },
      { id: 'open-movie', label: 'Film', icon: <Movie /> },
      { id: 'open-movie-create', label: 'Rediger video', icon: <MovieCreation /> },
      { id: 'open-layers', label: 'Lag', icon: <Layers /> },
      { id: 'open-compare', label: 'Sammenlign', icon: <Compare /> },
      { id: 'open-pin', label: 'Fest', icon: <PushPin /> },
      { id: 'open-palette', label: 'Farger', icon: <Palette /> },
      { id: 'open-view-comfy', label: 'Komfortvisning', icon: <ViewComfy /> },
      { id: 'open-apps', label: 'Apper', icon: <Apps /> },
      { id: 'open-view-module', label: 'Moduler', icon: <ViewModule /> },
      { id: 'open-visibility', label: 'Synlighet', icon: <Visibility /> },
      { id: 'open-visibility-off', label: 'Skjul', icon: <VisibilityOff /> },
      { id: 'open-add', label: 'Legg til', icon: <Add /> },
      { id: 'open-add-circle', label: 'Ny', icon: <AddCircle /> },
      { id: 'open-open', label: 'Aapne', icon: <OpenInNew /> },
      { id: 'open-cloud-download', label: 'Hent', icon: <CloudDownload /> },
      { id: 'open-cloud-upload', label: 'Last opp', icon: <CloudUpload /> },
      { id: 'open-sync', label: 'Synk', icon: <Sync /> },
      { id: 'open-status', label: 'Status', icon: <CheckCircle /> },
      { id: 'open-status-off', label: 'Ikke valgt', icon: <RadioButtonUnchecked /> },
      { id: 'open-auto-fix', label: 'Auto fix', icon: <AutoFixHigh /> },
      { id: 'open-balance', label: 'Balanse', icon: <AccountBalance /> },
      { id: 'open-tune', label: 'Tune', icon: <Tune /> },
      { id: 'open-copyright', label: 'Copyright', icon: <Copyright /> },
      { id: 'open-home', label: 'Hjem', icon: <Home /> },
      { id: 'open-info', label: 'Info', icon: <Info /> },
      { id: 'open-warning', label: 'Advarsel', icon: <Warning /> },
      { id: 'open-message', label: 'Send', icon: <Send /> },
      { id: 'open-reply', label: 'Svar', icon: <Reply /> },
      { id: 'open-time', label: 'Tid', icon: <AccessTime /> },
      { id: 'open-thumb', label: 'Like', icon: <ThumbUp /> },
      { id: 'open-person', label: 'Person', icon: <Person /> },
      { id: 'open-badge', label: 'Badge', icon: <Badge /> },
      { id: 'open-crop-free', label: 'Fri beskaer', icon: <CropFree /> },
      { id: 'open-drag', label: 'Dra', icon: <DragIndicator /> },
      { id: 'open-select-all', label: 'Velg alle', icon: <SelectAll /> },
      { id: 'open-checkbox', label: 'Sjekkboks', icon: <CheckBox /> },
      { id: 'open-checkbox-blank', label: 'Tom boks', icon: <CheckBoxOutlineBlank /> },
      { id: 'open-folder-special', label: 'Spesialmappe', icon: <FolderSpecial /> },
      { id: 'open-category', label: 'Kategori', icon: <Category /> },
      { id: 'open-label', label: 'Etikett', icon: <Label /> },
      { id: 'open-edit', label: 'Rediger', icon: <Edit /> },
      { id: 'open-delete', label: 'Slett', icon: <Delete /> },
      { id: 'open-archive', label: 'Arkiv', icon: <Archive /> },
      { id: 'open-image', label: 'Bilde', icon: <Image /> },
      { id: 'open-camera', label: 'Kamera', icon: <Camera /> },
      { id: 'open-movie', label: 'Film', icon: <Movie /> },
      { id: 'open-video', label: 'Video', icon: <VideoLibrary /> },
      { id: 'open-photo-lib', label: 'Fotoarkiv', icon: <PhotoLibrary /> },
      { id: 'open-music', label: 'Musikk', icon: <LibraryMusic /> },
      { id: 'open-doc', label: 'Dokument', icon: <Description /> },
      { id: 'open-business', label: 'Bedrift', icon: <Business /> },
      { id: 'open-school', label: 'Skole', icon: <School /> },
      { id: 'open-back', label: 'Tilbake', icon: <ArrowBack /> },
    ],
    [
      isDemoMode,
      viewMode,
      batchMode,
      sidebarOpen,
      showComments
    ]
  );

  const workspaceProjectTitle = selectedProject?.title || currentProject?.title || currentProject?.name || 'Showcase oppfølging';
  const workspaceClientEmail =
    clientEmail
    || (typeof currentProject?.clientEmail === 'string' ? currentProject.clientEmail : null);
  const workspaceContactQuery =
    workspaceClientEmail
    || currentProject?.clientName
    || selectedProject?.title
    || null;
  const workspaceDriveUrl = selectedProject?.driveUrl || currentProject?.driveUrl || null;

  const handleOpenWorkspaceCalendar = useCallback(() => {
    const title = encodeURIComponent(`${workspaceProjectTitle} · Showcase`);
    const details = encodeURIComponent(
      [
        `Oppfølging for ${workspaceProjectTitle}.`,
        workspaceClientEmail ? `Kunde: ${workspaceClientEmail}` : null,
      ].filter(Boolean).join('\n')
    );
    window.open(
      `https://calendar.google.com/calendar/u/0/r/eventedit?text=${title}&details=${details}`,
      '_blank',
      'noopener,noreferrer'
    );
    addNotification({ message: 'Google Calendar åpnet for showcase-oppfølging.', type: 'success' });
  }, [addNotification, workspaceClientEmail, workspaceProjectTitle]);

  const handleOpenWorkspaceContact = useCallback(() => {
    if (!workspaceContactQuery) {
      addNotification({ message: 'Velg et prosjekt eller legg til kunde-e-post først.', type: 'warning' });
      return;
    }

    window.open(
      `https://contacts.google.com/search/${encodeURIComponent(workspaceContactQuery)}`,
      '_blank',
      'noopener,noreferrer'
    );
    addNotification({ message: 'Google Contacts åpnet for denne showcase-konteksten.', type: 'success' });
  }, [addNotification, workspaceContactQuery]);

  const handleOpenWorkspaceEmail = useCallback(() => {
    if (!workspaceClientEmail) {
      addNotification({ message: 'Mangler kunde-e-post for å åpne e-postflyten.', type: 'warning' });
      return;
    }

    const subject = encodeURIComponent(`Showcase · ${workspaceProjectTitle}`);
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(workspaceClientEmail)}&su=${subject}`,
      '_blank',
      'noopener,noreferrer'
    );
    addNotification({ message: 'Gmail compose åpnet for valgt kunde.', type: 'success' });
  }, [addNotification, workspaceClientEmail, workspaceProjectTitle]);

  const handleOpenWorkspaceDrive = useCallback(() => {
    if (workspaceDriveUrl) {
      window.open(workspaceDriveUrl, '_blank', 'noopener,noreferrer');
      addNotification({ message: 'Google Drive-mappen er åpnet.', type: 'success' });
      return;
    }

    if (selectedProject) {
      setShowUploadComponent(true);
      addNotification({ message: 'Drive er ikke koblet ennå. Opplasting åpnet for valgt prosjekt.', type: 'info' });
      return;
    }

    setProjectSelectorOpen(true);
    addNotification({ message: 'Velg et prosjekt for å åpne riktig kundemappe i Drive.', type: 'info' });
  }, [addNotification, selectedProject, setProjectSelectorOpen, workspaceDriveUrl]);

  const handleQuickAction = useCallback((actionId: string) => {
    switch (actionId) {
      case 'toggle-demo':
        toggleDemoMode();
        addNotification({ message: isDemoMode ? 'Demo deaktivert' : 'Demo aktivert', type: 'info' });
        break;
      case 'open-dashboard':
        setShowDashboard(true);
        break;
      case 'open-academy':
        setShowAcademy(true);
        break;
      case 'open-visual-editor':
        visualEditor.setSidebarOpen(true);
        visualEditor.setActiveTab('templates');
        setShowDashboard(true);
        break;
      case 'open-settings':
        setQuickDrawerOpen(true);
        break;
      case 'open-upload':
        setShowUploadComponent(true);
        break;
      case 'open-projects':
        setProjectSelectorOpen(true);
        break;
      case 'open-command-palette':
        setCommandPaletteOpen(true);
        break;
      case 'toggle-view':
        setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'));
        break;
      case 'toggle-batch':
        setBatchMode((prev) => !prev);
        break;
      case 'toggle-sidebar':
        setSidebarOpen((prev) => !prev);
        break;
      case 'toggle-comments':
        setShowComments((prev) => !prev);
        break;
      case 'open-analytics':
        setShowAnalytics(true);
        break;
      case 'open-chat':
        setShowDashboard(true);
        addNotification({ message: 'Dashboard åpnet. Universal Chat Widget er tilgjengelig der.', type: 'info' });
        break;
      case 'open-calendar':
        handleOpenWorkspaceCalendar();
        break;
      case 'open-contact':
        handleOpenWorkspaceContact();
        break;
      case 'open-email':
        handleOpenWorkspaceEmail();
        break;
      case 'open-drive':
        handleOpenWorkspaceDrive();
        break;
      case 'open-pricing':
        setShowDashboard(true);
        addNotification({ message: 'Dashboard åpnet for prisadministrasjon og tilbud.', type: 'info' });
        break;
      case 'open-payment':
        setShowDashboard(true);
        addNotification({ message: 'Dashboard åpnet for betaling, tilbud og kontrakter.', type: 'info' });
        break;
      case 'open-store':
        window.open('/marketplace', '_blank', 'noopener,noreferrer');
        addNotification({ message: 'Marketplace åpnet i ny fane.', type: 'success' });
        break;
      default:
        addNotification({ message: `Handling: ${actionId}`, type: 'info' });
        break;
    }
  }, [
    addNotification,
    clientEmail,
    currentProject?.clientEmail,
    currentProject?.clientName,
    currentProject?.driveUrl,
    currentProject?.name,
    currentProject?.title,
    handleOpenWorkspaceCalendar,
    handleOpenWorkspaceContact,
    handleOpenWorkspaceDrive,
    handleOpenWorkspaceEmail,
    isDemoMode,
    setBatchMode,
    setCommandPaletteOpen,
    setProjectSelectorOpen,
    setQuickDrawerOpen,
    setShowAcademy,
    setShowAnalytics,
    setShowDashboard,
    setShowUploadComponent,
    setSidebarOpen,
    setShowComments,
    selectedProject,
    selectedProject?.title,
    toggleDemoMode,
    visualEditor
  ]);

  const speedDialActions = useMemo(
    () => quickActions.slice(0, 8),
    [quickActions]
  );

  if (_loadingFallback) return _loadingFallback;

  return (
    <Box
      ref={scrollContainerRef}
      sx={{
        minHeight: '100vh',
        bgcolor: '#06080d',
        background: `radial-gradient(circle at 74% 12%, ${alpha(accentColor, 0.22)}, rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, ${alpha(academyCoolAccent, 0.14)}, rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%), linear-gradient(135deg, #06080d 0%, #090d16 52%, #120d08 100%)`,
        color: textPrimary,
        display: 'flex',
        position: 'relative',
        fontFamily: '"Manrope", "Barlow", "Segoe UI", sans-serif',
        overflowY: 'auto',
        '--showcase-surface': academySurface,
        '--showcase-surface-elevated': academySurfaceElevated,
        '--showcase-border': academyBorder,
        // Slice 9X.81 — WCAG 2.3.3 / 2.3.1: respekter prefers-reduced-motion.
        // Brukere som har slått på "redusert bevegelse" i OS får ingen scale-,
        // translate-, eller fade-animasjoner som kan utløse vestibulære plager.
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.001ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.001ms !important',
            scrollBehavior: 'auto !important',
          },
        },
        // Slice 9X.81 — WCAG 2.5.5: 44x44px touch-targets på mobile.
        // size="small" MUI-buttons er 32px default; bump opp til 44 på smalt
        // viewport. Affekter ikke ToggleButtonGroup som er compact-by-design.
        '@media (max-width: 600px)': {
          '& .MuiButton-sizeSmall:not(.MuiToggleButton-root)': {
            minHeight: '44px',
          },
          '& .MuiIconButton-sizeSmall': {
            minWidth: '44px',
            minHeight: '44px',
          },
          '& .MuiChip-clickable': {
            minHeight: '32px',
          },
        },
        // Apply profession-specific styling
        '& .showcase-header': {
          background: `linear-gradient(135deg, ${professionTheme?.primaryColor || customTheme.palette.primary.main}20, ${professionTheme?.secondaryColor || customTheme.palette.secondary.main}20)`,
          borderRadius: (customTheme.shape.borderRadius as number) * 2,
          padding: customTheme.spacing(2),
          marginBottom: customTheme.spacing(3)
          }, '& .showcase-card': {
            '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: `0 8px 25px ${professionTheme?.accentColor || customTheme.palette.primary.main}30`,
            transition: 'all 0.3s ease-in-out'
          }
        }, '& .selection-indicator': {
          backgroundColor: professionTheme?.accentColor || customTheme.palette.primary.main,
          color: customTheme.palette.getContrastText(professionTheme?.accentColor || customTheme.palette.primary.main)
        }
      }}
    >
      {/* FASE 1: Client Proofing Status Bar - Enhanced */}
      {clientMode && (
        <Box sx={{ 
          position: 'fixed', 
          top: 0,
          left: 0,
          right: 0,
          zIndex: 110,
          p: 2,
          bgcolor: proofingSession ? 'rgba(255, 107, 53, 0.1)' : 'rgba(15, 20, 25, 0.95)',
          borderBottom: proofingSession ? '2px solid #ff6b35' : 'none',
          backdropFilter: 'blur(20px)'
        }}>
          {proofingSession ? (
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" sx={{ color: '#ff6b35', fontWeight: 'bold' }}>
                  Velg {proofingSession.maxSelections || 60} bilder til album
                </Typography>
                <Typography variant="body2" sx={{ color: textSecondary }}>
                  {selectionCount} av {proofingSession.maxSelections || 60} valgt • Round {proofingSession.round || 1}
                </Typography>
              </Box>
              
              <Box textAlign="center">
                <LinearProgress 
                  variant="determinate" 
                  value={(selectionCount / (proofingSession.maxSelections || 60)) * 100}
                  sx={{
                    width: 200,
                    height: 8,
                    borderRadius: 4,
                      bgcolor: alpha('#ff6b35', 0.2), '& .MuiLinearProgress-bar': {
                      bgcolor: '#ff6b35'
                    }
                  }}
                />
                <Typography variant="caption" sx={{ color: textSecondary, display: 'block', mt: 0.5 }}>
                  {Math.round((selectionCount / (proofingSession.maxSelections || 60)) * 100)}% fullført
                </Typography>
              </Box>
              
              <Box textAlign="right">
                <Typography variant="h6" sx={{ color: showDeadlineWarning ? '#ff4444' : '#ff6b35' }}>
                  Frist: {proofingSession.deadline ? new Date(proofingSession.deadline).toLocaleDateString('no-NO') : 'Ikke satt'}
                </Typography>
                {showDeadlineWarning && (
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <WarningAmberIcon sx={{ color: '#ff4444', fontSize: 18 }} />
                    <Typography variant="body2" sx={{ color: '#ff4444' }}>
                      Mindre enn 24 timer igjen
                    </Typography>
                  </Stack>
                )}
              </Box>
            </Stack>
          ) : (
            renderClientStatusBar()
          )}
        </Box>
      )}
      
      {/* Professional Background Overlay */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `radial-gradient(circle at 20% 8%, ${alpha(accentColor, 0.14)} 0%, transparent 50%), radial-gradient(circle at 80% 20%, ${alpha(academyCoolAccent, 0.1)} 0%, transparent 50%)`,
        pointerEvents: 'none'
      }} />

      {/* Advanced Professional Sidebar — reference-matched */}
      <Box sx={{ 
        width: sidebarOpen ? 232 : 84,
        background: academyHeaderBackground,
        borderRight: `var(--academy-hairline-width, 1px) solid ${academyBorder}`,
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        zIndex: 12,
        overflow: 'hidden',
        boxShadow: '20px 0 48px rgba(3,5,10,0.34)',
        backdropFilter: 'blur(24px)',
      }}>
        {/* Sidebar Header — brand dots + collapse */}
        <Box sx={{ 
          px: sidebarOpen ? 2.5 : 1.5,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          minHeight: 64,
        }}>
          {sidebarOpen && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '8px',
                  background:
                    'linear-gradient(135deg, #f5a623 0%, #f59e0b 65%, #d97706 100%)',
                  boxShadow: '0 0 18px rgba(245,166,35,0.35)',
                  flexShrink: 0,
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    letterSpacing: '0.08em',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: textPrimary,
                    lineHeight: 1,
                  }}
                >
                  CREATORHUB{' '}
                  <Box component="span" sx={{ opacity: 0.72 }}>
                    SHOWCASE
                  </Box>
                </Typography>
                <Typography
                  sx={{
                    fontSize: 11,
                    color: textSecondary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Portfolio workspace
                </Typography>
              </Box>
            </Box>
          )}
          <IconButton 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            size="small"
            sx={{ 
              color: 'rgba(255,255,255,0.5)',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
            }}
          >
            {sidebarOpen ? <ChevronLeft sx={{ fontSize: 20 }} /> : <MenuIcon sx={{ fontSize: 20 }} />}
          </IconButton>
        </Box>

        {/* Main Navigation */}
        <Box sx={{ px: sidebarOpen ? 1.5 : 0.75, pt: 0.5, flex: 1, overflowY: 'auto' }}>
          {[
            { icon: <Home sx={{ fontSize: 20 }} />, label: 'Home', filterVal: 'all' },
            { icon: <Star sx={{ fontSize: 20 }} />, label: 'Popular', filterVal: 'fremhevet' },
            { icon: <Collections sx={{ fontSize: 20 }} />, label: 'Categories', filterVal: null },
            { icon: <FavoriteBorder sx={{ fontSize: 20 }} />, label: 'Favorites', filterVal: 'favorites' },
            { icon: <PhotoLibrary sx={{ fontSize: 20 }} />, label: profession === 'photographer' ? 'Your photos' : profession === 'videographer' ? 'Your videos' : 'Your tracks', filterVal: 'mine' },
          ].map((navItem) => {
            const isActive = filter === navItem.filterVal || (filter === 'all' && navItem.filterVal === 'all');
            return (
              <Tooltip key={navItem.label} title={!sidebarOpen ? navItem.label : ''} placement="right" arrow>
                <Box 
                  onClick={() => navItem.filterVal !== null && setFilter(navItem.filterVal)}
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: sidebarOpen ? 1.5 : 0,
                    py: 1,
                    mb: 0.25,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    justifyContent: sidebarOpen ? 'flex-start' : 'center',
                    bgcolor: isActive ? alpha(accentColor, 0.1) : 'transparent',
                    color: isActive ? accentColor : 'rgba(255,255,255,0.6)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: textPrimary },
                    transition: 'all 0.15s ease',
                  }}
                >
                  {navItem.icon}
                  {sidebarOpen && (
                    <Typography variant="body2" sx={{ 
                      fontSize: '0.85rem', 
                      fontWeight: isActive ? 600 : 400,
                      whiteSpace: 'nowrap',
                    }}>
                      {navItem.label}
                    </Typography>
                  )}
                </Box>
              </Tooltip>
            );
          })}

          {/* Subscriptions / Projects Section */}
          {sidebarOpen && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="overline" sx={{ 
                color: 'rgba(255,255,255,0.35)', 
                fontSize: '0.6rem', 
                fontWeight: 700,
                letterSpacing: '0.12em',
                px: 1.5,
                display: 'block',
                mb: 1.5,
              }}>
                SUBSCRIPTIONS
              </Typography>
              {/* Show profession-specific categories as subscription items */}
              {getProfessionCategories().slice(2).map((category) => (
                <Box 
                  key={category}
                  onClick={() => setFilter(category.toLowerCase())}
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: filter === category.toLowerCase() ? '#fff' : 'rgba(255,255,255,0.6)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' },
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Avatar sx={{ 
                    width: 24, height: 24, 
                    bgcolor: `${accentColor}30`, 
                    color: accentColor,
                    fontSize: '0.6rem', 
                    fontWeight: 700,
                  }}>
                    {category.charAt(0)}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 400 }}>
                    {category}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Premium Promo Box */}
        {sidebarOpen && (
          <Box sx={{
            mx: 1.5,
            mb: 2,
            p: 2,
            borderRadius: '12px',
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            border: `var(--academy-hairline-width, 1px) solid ${academyBorder}`,
          }}>
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.82rem', mb: 0.5 }}>
              CreatorHub Academy
            </Typography>
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.82rem', mb: 0.5 }}>
              shares this design shell
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', display: 'block', mb: 1.5, lineHeight: 1.4 }}>
              Showcase now follows the same visual language, spacing, and typography.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowAcademy(true)}
              sx={{
                borderColor: accentColor,
                color: accentColor,
                borderRadius: '20px',
                textTransform: 'uppercase',
                fontWeight: 700,
                fontSize: '0.7rem',
                px: 2,
                letterSpacing: '0.04em',
                '&:hover': { borderColor: accentColor, bgcolor: `${accentColor}12` },
              }}
            >
              Get Premium
            </Button>
          </Box>
        )}
      </Box>

      {/* Contextual Action Bar - Appears when items selected */}
      {selectedImages.size > 0 && (
        <ContextualActionBar
          profession={profession}
          selectedCount={selectedImages.size}
          accentColor={accentColor}
          onClearSelection={() => setSelectedImages(new Set())}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          // Photographer actions
          onEnhance={openPhotoEnhancer}
          onWatermark={openWatermarkDialog}
          onDownload={() => executeBulkOperation('bulk-download')}
          onDelete={() => executeBulkOperation('delete')}
          onCopy={() => openCopyMoveDialog('copy')}
          onMove={() => openCopyMoveDialog('move')}
          onEdit={openPhotoEditor}
          onShare={() => setShareShowcaseDialogOpen(true)}
          onSetPrice={openPricingModal}
          // Videographer actions
          onAddToSequence={() => setShowSequenceManager(true)}
          onGenerateProxy={() => setShowProxyGenerator(true)}
          onExportSocial={() => setShowExportDialog(true)}
          onRenderPresets={() => setShowRenderPresets(true)}
          // Music producer actions
          onExtractStems={handleExtractStems}
          onAudioWatermark={handleOpenAudioWatermarkDialog}
          onAnalyzeAudio={() => selectedItem && analyzeAudioContent(selectedItem)}
          onAddToSamplePack={() => handleOpenCollectionWorkflow('sample-pack')}
          // Vendor actions
          onAddToBundle={() => handleOpenCollectionWorkflow('bundle')}
          onEditPricing={openPricingModal}
          onAddVariants={handleOpenVariantsWorkspace}
          onUpdateInventory={handleOpenInventoryWorkspace}
        />
      )}

      {/* Premium Main Content Area */}
      <Box sx={{ 
        flex: 1,
        display: 'flex', 
        flexDirection: 'column',
        marginLeft: sidebarOpen ? '232px' : '84px',
        marginTop: clientMode ? '200px' : (selectedImages.size > 0 ? '70px' : '0'),
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        zIndex: 1}}>
        {/* ===== Browse Header Bar (pixel-perfect, reference-matched) ===== */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 1.5,
          borderBottom: `var(--academy-hairline-width, 1px) solid ${academyBorder}`,
          background: academyHeaderBackground,
          backdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          minHeight: 64,
        }}>
          {/* Left: Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 220 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '10px',
                background:
                  'linear-gradient(135deg, #f5a623 0%, #f59e0b 65%, #d97706 100%)',
                boxShadow: '0 0 22px rgba(245,166,35,0.35)',
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                  fontSize: '1rem',
                  lineHeight: 1,
                  color: textPrimary,
                }}
              >
                CREATORHUB{' '}
                <Box component="span" sx={{ opacity: 0.72 }}>
                  SHOWCASE
                </Box>
              </Typography>
              <Typography sx={{ fontSize: 11, color: textSecondary }}>
                Portfolio studio
              </Typography>
            </Box>
          </Box>

          {/* Center: Search */}
          <Box sx={{ flex: 1, maxWidth: 480, mx: 4 }}>
            <Autocomplete
              freeSolo
              options={items.map(item => item.title || '')}
              value={searchAutocompleteValue}
              onChange={(_, newValue) => {
                setSearchAutocompleteValue(newValue);
                setSearchQuery(newValue ? { text: newValue } : {});
              }}
              sx={{ width: '100%' }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Søk i showcase, prosjekt, kategori…"
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: textPrimary,
                      bgcolor: 'rgba(11, 15, 24, 0.85)',
                      borderRadius: '10px',
                      fontSize: '0.9rem',
                      height: 40,
                      fontFamily: 'Rajdhani, sans-serif',
                      '& fieldset': { borderColor: alpha(accentColor, 0.24) },
                      '&:hover fieldset': { borderColor: alpha(accentColor, 0.42) },
                      '&.Mui-focused fieldset': { borderColor: accentColor },
                    }
                  }}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <Search sx={{ color: textSecondary, mr: 1, fontSize: 20 }} />
                    ),
                  }}
                />
              )}
            />
          </Box>

          {/* Right: Add Photo + Admin Tools Toggle + Avatar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 280, justifyContent: 'flex-end' }}>
            {(isOwner || adminMode) && (
              <Tooltip title={showAdminTools ? 'Hide tools' : 'Show admin tools'}>
                <IconButton
                  size="small"
                  onClick={() => setShowAdminTools(!showAdminTools)}
                  sx={{
                    color: showAdminTools ? accentColor : 'rgba(255,255,255,0.4)',
                    '&:hover': { color: accentColor, bgcolor: `${accentColor}15` },
                  }}
                >
                  <Settings sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
            {(isOwner || adminMode) && showcaseCreationAccess?.hasAccess && (
              <Button
                variant="contained"
                size="small"
                startIcon={<Add sx={{ fontSize: 18 }} />}
                onClick={() => setProjectSelectorOpen(true)}
                sx={{
                  color: '#1e1306',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontFamily: 'Rajdhani, sans-serif',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  px: 2.2,
                  py: 0.75,
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(180deg, #ffc64d 0%, #f5a623 100%)',
                  boxShadow: '0 8px 24px rgba(245,166,35,0.28)',
                  '&:hover': {
                    background: 'linear-gradient(180deg, #ffcf67 0%, #f5a623 100%)',
                  },
                }}
              >
                Nytt element
              </Button>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 1 }}>
              <Avatar sx={{
                width: 36,
                height: 36,
                bgcolor: '#213047',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: '2px solid rgba(245,166,35,0.55)',
              }}>
                D
              </Avatar>
              <Typography variant="body2" sx={{
                color: '#fff',
                fontWeight: 500,
                fontSize: '0.875rem',
                display: { xs: 'none', md: 'block' },
              }}>
                {user?.name || 'Daniel CreatorHub'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ===== Collapsible Admin Toolbar ===== */}
        {showAdminTools && (<>
        <Box sx={{ 
          textAlign: 'center', 
          p: 2, 
          borderBottom: `var(--academy-hairline-width, 1px) solid ${academyBorder}`, 
          display: 'flex', 
          gap: 2, 
          flexWrap: 'wrap',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, rgba(13,16,25,0.9), rgba(7,10,16,0.94))',
        }}>
          {/* Synced Project/Client Indicator */}
          {(syncedProject || syncedClient) && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              px: 2,
              py: 1,
              borderRadius: '8px',
              bgcolor: cardBg,
              border: '1px solid rgba(76, 175, 80, 0.5)'
            }}>
              <Sync sx={{ color: '#4caf50', fontSize: 18 }} />
              {syncedProject && (
                <Chip 
                  label={`Project: ${syncedProject.name || 'Synced'}`} 
                  size="small" 
                  color="success"
                  sx={{ mr: 1 }}
                />
              )}
              {syncedClient && (
                <Chip 
                  label={`Client: ${syncedClient.name || 'Synced'}`} 
                  size="small" 
                  color="info"
                />
              )}
            </Box>
          )}
          
          {/* Real-time Collaboration Controls */}
          {enableRealTimeSync && !collaborationSessionId && showcaseAccess?.hasAccess && (
            <>
              <Button 
                variant="outlined"
                startIcon={<Add />}
                onClick={async () => {
                  try {
                    const localParticipant: CollaborationParticipant = {
                      id: `local-${effectiveUserId}`,
                      userId: effectiveUserId,
                      name: user?.name || user?.email || 'User',
                      email: user?.email || 'unknown@local',
                      role: 'owner',
                      status: 'online',
                      lastSeen: new Date(),
                      permissions: {
                        canEdit: true,
                        canComment: true,
                        canShare: true,
                        canDelete: true,
                        canInvite: true,
                      }
                    };
                    await createSession({ name: `showcase-${Date.now()}`, participants: [localParticipant] });
                    addNotification({ message: 'Collaboration session created', type: 'success' });
                  } catch (error) {
                    console.error('Create session error:', error);
                    addNotification({ message: 'Failed to create session', type: 'error' });
                  }
                }}
                sx={{
                  borderColor: '#4caf50',
                  color: '#4caf50',
                  '&:hover': { borderColor: '#66bb6a', bgcolor: 'rgba(76, 175, 80, 0.1)' }
                }}
              >
                Create Session
              </Button>
              <Button 
                variant="outlined"
                startIcon={<People />}
                onClick={async () => {
                  const sessionId = prompt('Enter session ID to join:');
                  if (sessionId) {
                    try {
                      await joinSession(sessionId);
                      addNotification({ message: 'Joined collaboration session', type: 'success' });
                    } catch (error) {
                      console.error('Join session error:', error);
                      addNotification({ message: 'Failed to join session', type: 'error' });
                    }
                  }
                }}
                sx={{
                  borderColor: '#2196f3',
                  color: '#2196f3',
                  '&:hover': { borderColor: '#42a5f5', bgcolor: 'rgba(33, 150, 243, 0.1)' }
                }}
              >
                Join Session
              </Button>
            </>
          )}
          
          <Button variant="contained"
            startIcon={<AcademyIcon />}
            onClick={() => setShowAcademy(true)}
            sx={{ 
              color: '#1e1306',
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              borderRadius: 3,
              fontFamily: 'Rajdhani, sans-serif',
              background: 'linear-gradient(180deg, #ffc64d 0%, #f5a623 100%)',
              boxShadow: '0 8px 24px rgba(245,166,35,0.28)','&:hover': { 
                background: 'linear-gradient(180deg, #ffcf67 0%, #f5a623 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 10px 26px rgba(245,166,35,0.34)'
              }
            }}
          >
            GÅ TIL ACADEMY
          </Button>
          
          <Button variant="contained"
            startIcon={<DashboardIcon />}
            onClick={() => setShowDashboard(true)}
            sx={{ 
              bgcolor: alpha(academyCoolAccent, 0.18),
              color: textPrimary,
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              borderRadius: 3,
              fontFamily: 'Rajdhani, sans-serif',
              border: `1px solid ${alpha(academyCoolAccent, 0.45)}`,
              boxShadow: '0 8px 24px rgba(82,121,204,0.18)','&:hover': { 
              bgcolor: alpha(academyCoolAccent, 0.24),
              transform: 'translateY(-2px)',
              boxShadow: '0 10px 26px rgba(82,121,204,0.24)'
              }
            }}
          >
            GÅ TIL DASHBOARD
          </Button>
        </Box>

        {/* Professional Header Bar */}
        <Box sx={{ 
          p: 3,
          borderBottom: `var(--academy-hairline-width, 1px) solid ${academyBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(180deg, rgba(10,13,20,0.82), rgba(8,11,18,0.92))',
          backdropFilter: 'blur(10px)'
        }}>
          <Box>
            {/* Breadcrumbs Navigation */}
            <Breadcrumbs
              aria-label="breadcrumb"
              sx={{ mb: 2 }}
              separator={<Box sx={{ color: textSecondary }}>›</Box>}
            >
              <Link
                underline="hover"
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  color: textSecondary,
                  cursor: 'pointer',
                  '&:hover': { color: accentColor }
                }}
                onClick={() => setSelectedProject(null)}
              >
                <Home sx={{ mr: 0.5, fontSize: 16 }} />
                Home
              </Link>
              {selectedProject && (
                <Link
                  underline="hover"
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    color: textSecondary,
                    cursor: 'pointer',
                    '&:hover': { color: accentColor }
                  }}
                >
                  <Collections sx={{ mr: 0.5, fontSize: 16 }} />
                  {selectedProject.title}
                </Link>
              )}
              <Typography sx={{ display: 'flex', alignItems: 'center', color: accentColor }}>
                {getProfessionDisplayName(profession)}
              </Typography>
            </Breadcrumbs>
            
            {/* Duplicate Warning Banner */}
            {duplicates.size > 0 && showcaseManagementAccess?.hasAccess && (
              <Alert 
                severity="warning" 
                sx={{ mb: 2 }}
                action={
                  <Button 
                    color="inherit" 
                    size="small"
                    onClick={handleReviewDuplicates}
                  >
                    VIEW
                  </Button>
                }
              >
                {duplicates.size} duplicate file group{duplicates.size > 1 ? 's' : ''} detected
              </Alert>
            )}
            
            {/* Authentication Required Banner */}
            {sessionRequiresAuth && !isAuthenticated && (
              <Alert 
                severity="info" 
                sx={{ mb: 2 }}
                action={
                  <Button 
                    color="inherit" 
                    size="small"
                    onClick={() => {
                      setShowAuthDialog(true);
                      setAuthSessionData({ sessionId: sessionIdd, clientEmail });
                    }}
                  >
                    SIGN IN
                  </Button>
                }
              >
                Authentication required to access this session
              </Alert>
            )}
            
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              color: textPrimary, 
              mb: 0.5,
              background: `linear-gradient(45deg, ${accentColor}, #f7931e)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              {config.title}
            </Typography>
            
            {/* Feature Analytics Display */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              mt: 1 }}>
              <Typography variant="caption" sx={{ color: textSecondary }}>
                Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
              </Typography>
              <Chip 
                label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                size="small"
                variant="outlined"
                sx={{ 
                  fontSize: '10px', 
                  height: 18,
                  color: textSecondary,
                  borderColor: 'rgba(255,255,255,0.3)'
                }}
              />
            </Box>
              <Typography variant="body1" sx={{ 
                color: textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: 1 }}>
                <Box sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: accentColor,
                  animation: 'pulse 2s infinite'
                }} />
                {items.length} {profession === 'photographer' || profession === 'enterprise' ? 'bilder' : profession === 'videographer' ? 'videoer' : profession === 'music_producer' ? 'låter' : 'elementer'} tilgjengelig
                
                {/* Real-time Collaboration Indicator */}
                {enableRealTimeSync && collaborationSessionId && (
                  <>
                    <Box sx={{ mx: 1, color: 'rgba(255, 255, 255, 0.3)' }}>•</Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5,
                      bgcolor: 'rgba(76, 175, 80, 0.1)',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      border: '1px solid rgba(76, 175, 80, 0.3)'
                    }}>
                      <People sx={{ fontSize: 14, color: '#4caf50' }} />
                      <Typography variant="caption" sx={{ color: '#4caf50' }}>
                        {participants.length} collaborator{participants.length !== 1 ? 's' : ''}
                      </Typography>
                      <Tooltip title="Leave Session">
                        <IconButton
                          size="small"
                          onClick={() => {
                            leaveSession();
                            addNotification({ message: 'Left collaboration session', type: 'info' });
                          }}
                          sx={{
                            p: 0.5,
                            ml: 0.5,
                            '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.2)' }
                          }}
                        >
                          <ExitToApp sx={{ fontSize: 12, color: '#4caf50' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </>
                )}
                
                {selectedProject && (
                  <>
                    <Box sx={{ mx: 1, color: 'rgba(255, 255, 255, 0.3)' }}>•</Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5,
                      bgcolor: 'rgba(255, 107, 53, 0.1)',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      border: '1px solid rgba(255, 107, 53, 0.3)'
                }}>
                      <FolderOpen sx={{ fontSize: 14, color: accentColor }} />
                      <Typography variant="caption" sx={{ color: accentColor }}>
                        {selectedProject.title}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedProject(null);
                          setShowUploadComponent(false);
                        }}
                        sx={{
                          p: 0.5,
                          ml: 0.5,
                          '&:hover': { bgcolor: 'rgba(255, 107, 53, 0.2)' }
                        }}
                      >
                        <Delete sx={{ fontSize: 12, color: accentColor }} />
                      </IconButton>
                    </Box>
                  </>
                )}
              </Typography>
          </Box>
          
          <Stack direction="row" spacing={2}>
            {/* Autocomplete Search */}
            <Autocomplete
              freeSolo
              options={items.map(item => item.title || '')}
              value={searchAutocompleteValue}
              onChange={(_, newValue) => {
                setSearchAutocompleteValue(newValue);
                setSearchQuery(newValue ? { text: newValue } : {});
              }}
              sx={{ width: 250 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Søk…"
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: textPrimary,
                      borderColor: 'rgba(255, 107, 53, 0.3)',
                      '&:hover': {
                        borderColor: accentColor
                      }
                    }
                  }}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <Search sx={{ color: textSecondary, mr: 1 }} />
                  }}
                />
              )}
            />
            
            {/* Filter Button with Badge */}
            <IconButton
              onClick={(e) => setSortMenuAnchorEl(e.currentTarget)}
              sx={{
                color: textSecondary,
                borderColor: 'rgba(255, 107, 53, 0.3)',
                border: '1px solid',
                '&:hover': {
                  borderColor: accentColor,
                  bgcolor: 'rgba(255, 107, 53, 0.1)'
                }
              }}
            >
              <Badge badgeContent={selectedItems.length} color="primary" max={99}>
                <FilterList />
              </Badge>
            </IconButton>
            
            {/* View Mode Toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newMode) => newMode && setViewMode(newMode)}
              size="small"
              sx={{ ml: 1 }}
            >
              {/* Slice 9X.81 — norske aria-labels + title for tooltip på desktop */}
              <ToggleButton value="grid" aria-label="Vis som rutenett" title="Rutenett">
                <GridView sx={{ fontSize: 18 }} />
              </ToggleButton>
              <ToggleButton value="list" aria-label="Vis som liste" title="Liste">
                <ViewList sx={{ fontSize: 18 }} />
              </ToggleButton>
              <ToggleButton value="masonry" aria-label="Vis som mursteinslayout" title="Mursteinslayout">
                <PhotoLibrary sx={{ fontSize: 18 }} />
              </ToggleButton>
            </ToggleButtonGroup>
            
            {/* Filter Chips Display */}
            {filterChips.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
                {filterChips.map((chip) => (
                  <Chip
                    key={chip.id}
                    label={chip.label}
                    size="small"
                    onDelete={() => setFilterChips(prev => prev.filter(c => c.id !== chip.id))}
                    sx={{
                      bgcolor: 'rgba(255, 107, 53, 0.1)',
                      color: textPrimary,
                      borderColor: accentColor
                    }}
                  />
                ))}
              </Stack>
            )}
            
            {/* Annotations Toggle */}
            {showcaseAnalyticsAccess?.hasAccess && annotations.length > 0 && (
              <Tooltip title={showAnnotations ? 'Hide Annotations' : 'Show Annotations'}>
                <IconButton
                  onClick={() => setShowAnnotations(!showAnnotations)}
                  sx={{
                    color: showAnnotations ? accentColor : textSecondary,
                    border: '1px solid',
                    borderColor: showAnnotations ? accentColor : 'rgba(255, 107, 53, 0.3)',
                    '&:hover': { bgcolor: 'rgba(255, 107, 53, 0.1)' }
                  }}
                >
                  <Badge badgeContent={annotations.length} color="error">
                    <Comment />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            
            {/* Add Annotation Button */}
            {showcaseAnalyticsAccess?.hasAccess && (
              <Tooltip title="Add Annotation">
                <IconButton
                  onClick={() => {
                    const newAnnotation = {
                      id: `ann-${Date.now()}`,
                      itemId: selectedItem?.id || '',
                      text: 'New annotation',
                      timestamp: Date.now(),
                      userId: effectiveUserId
                    };
                    setAnnotations(prev => [...prev, newAnnotation as any]);
                    addNotification({ message: 'Annotation added', type: 'success' });
                  }}
                  sx={{
                    color: textSecondary,
                    border: '1px solid rgba(255, 107, 53, 0.3)',
                    '&:hover': { borderColor: accentColor, color: accentColor }
                  }}
                >
                  <NoteAdd />
                </IconButton>
              </Tooltip>
            )}
            
            {/* AI Processing Menu */}
            {enableAIAnalysis && contentManagementAccess?.hasAccess && (
              <Tooltip title="AI Processing">
                <IconButton
                  onClick={(e) => setPopperAnchorEl(e.currentTarget)}
                  sx={{
                    color: textSecondary,
                    border: '1px solid rgba(255, 107, 53, 0.3)',
                    '&:hover': { borderColor: '#2196f3', color: '#2196f3' }
                  }}
                >
                  <AutoAwesome sx={{ color: '#2196f3' }} />
                </IconButton>
              </Tooltip>
            )}
            
            {/* Google Photos Sync */}
            {enableGoogleDriveSync && (
              <>
                <Tooltip title="Google Photos">
                  <IconButton
                    onClick={() => setShowGooglePhotosDialog(true)}
                    sx={{
                      color: googlePhotosConnected ? '#4285f4' : textSecondary,
                      border: '1px solid',
                      borderColor: googlePhotosConnected ? '#4285f4' : 'rgba(255, 107, 53, 0.3)',
                      '&:hover': { borderColor: '#4285f4', color: '#4285f4' }
                    }}
                  >
                    <Badge badgeContent={isLoadingGooglePhotos ? <CircularProgress size={10} /> : null}>
                      <PhotoLibrary />
                    </Badge>
                  </IconButton>
                </Tooltip>
                
                {/* Google Contacts Sync */}
                {googleContacts && googleContacts.length > 0 && (
                  <Tooltip title={`${googleContacts.length} contacts synced`}>
                    <IconButton
                      sx={{
                        color: '#4285f4',
                        border: '1px solid #4285f4'
                      }}
                    >
                      <Badge badgeContent={googleContacts.length} color="primary">
                        <People />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                )}
                
                {contactSyncProgress > 0 && contactSyncProgress < 100 && (
                  <Box sx={{ ml: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} variant="determinate" value={contactSyncProgress} />
                    <Typography variant="caption" sx={{ color: textSecondary }}>
                      {contactSyncProgress}%
                    </Typography>
                  </Box>
                )}
              </>
            )}
            
            {/* Button to trigger loading skeleton demo */}
            <IconButton
              onClick={() => {
                setIsLoadingSkeleton(true);
                setTimeout(() => setIsLoadingSkeleton(false), 3000);
              }}
              sx={{ color: textSecondary }}
            >
              <CircularProgress size={18} sx={{ display: isLoadingSkeleton ? 'block' : 'none' }} />
              {!isLoadingSkeleton && <Info />}
            </IconButton>
            
            {/* Admin & Owner Controls */}
            {(isOwner || adminMode) && (
              <>
                <FileStatusWrapper showFileSystem showGoogleDrive showGooglePhotos>
                  <Button startIcon={<Add />}
                    variant="contained"
                    disabled={!showcaseCreationAccess?.hasAccess}
                    sx={{
                      bgcolor: accentColor,
                      color: '#fff','&:hover': {
                        bgcolor: '#e64100'
                }
                }}
                    onClick={() => setProjectSelectorOpen(true)}
                  >
                    Legg til
                  </Button>
                </FileStatusWrapper>
                
                {/* Bulk Operations */}
                <Tooltip title="Bulk Operations">
                  <IconButton
                    onClick={() => {
                      if (selectedBatchItems.size > 0) {
                        setSelectedImages(new Set(selectedBatchItems));
                      }
                      setShowBulkOperationsDialog(true);
                    }}
                    sx={{
                      color: textSecondary,
                      border: '1px solid rgba(255, 107, 53, 0.3)',
                      '&:hover': { borderColor: accentColor, color: accentColor }
                    }}
                  >
                    <Badge badgeContent={selectedBatchItems.size} color="primary">
                      <PlaylistAdd />
                    </Badge>
                  </IconButton>
                </Tooltip>
                
                {/* Video Processing */}
                {profession === 'videographer' && (
                  <>
                    <Tooltip title="Video Watermark">
                      <IconButton
                        onClick={() => setShowVideoWatermarkDialog(true)}
                        sx={{
                          color: textSecondary,
                          border: '1px solid rgba(255, 107, 53, 0.3)',
                          '&:hover': { borderColor: '#2196f3', color: '#2196f3' }
                        }}
                      >
                        <WaterDrop />
                      </IconButton>
                    </Tooltip>
                    
                    {isProcessingVideo && (
                      <Box sx={{ ml: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={20} variant="determinate" value={processingProgress} />
                        <Typography variant="caption" sx={{ color: textSecondary }}>
                          Processing: {processingProgress}%
                        </Typography>
                      </Box>
                    )}
                  </>
                )}

                {/* Bulk Create Collections Button */}
                {contentManagementAccess?.hasAccess && (
                  <Button
                    startIcon={<CreateNewFolder />}
                    variant="outlined"
                    onClick={() => {
                      setCurrentParentFolderId(selectedProject?.id?.toString());
                      setShowBulkFolderUpload(true);
                    }}
                    sx={{
                      borderColor: 'rgba(255, 107, 53, 0.5)',
                      color: accentColor, '&:hover': {
                        borderColor: accentColor,
                        bgcolor: 'rgba(255, 107, 53, 0.1)'
                      }
                    }}
                  >
                    Bulk Create
                  </Button>
                )}

                {/* Toggle Upload Component Button - Shows when project is selected */}
                {selectedProject && mediaUploadAccess?.hasAccess && (
                  <Button
                    variant="outlined"
                    startIcon={<CloudUpload />}
                    onClick={() => setShowUploadComponent(!showUploadComponent)}
                    sx={{
                      borderColor: showUploadComponent ? accentColor : 'rgba(255, 107, 53, 0.3)',
                      color: showUploadComponent ? accentColor : textSecondary, '&:hover': {
                        borderColor: accentColor,
                        bgcolor: 'rgba(255, 107, 53, 0.1)'
                      }
                    }}
                  >
                    {showUploadComponent ? 'Skjul opplasting' : 'Vis opplasting'}
                  </Button>
                )}

                {/* Showcase Sharing Button */}
                {showcasePublishingAccess?.hasAccess && (
                  <Button
                    startIcon={<Image />}
                    variant="outlined"
                    onClick={() => {
                      setPrefilledClient(undefined);
                      setShareShowcaseDialogOpen(true);
                }}
                    sx={{ 
                      borderColor: '#', 
                      color: '#','&:hover': { 
                        borderColor: '#', 
                        bgcolor: '#e3f2fd' 
                } 
                }}
                  >
                    Share {getTerm('showcase')}
                  </Button>
                )}

        {/* Overage Management Button */}
        {showcaseManagementAccess?.hasAccess && (
          <Button
            startIcon={<Warning />}
            variant="outlined"
            onClick={() => {
              setSelectedShowcaseData(null);
              setOverageDialogOpen(true);
        }}
            sx={{ 
              borderColor: '#ff6f00', 
              color: '#ff6f00','&:hover': { 
                borderColor: '#', 
                bgcolor: 'rgba(255,186,108,0.08)' 
        } 
        }}
          >
            {getTerm('overage')} Email
          </Button>
        )}

        {/* Lightroom Plugin Button */}
        {portfolioManagementAccess?.hasAccess && (
          <FileStatusWrapper showFileSystem showGoogleDrive showGooglePhotos>
            <Button
              startIcon={<CloudUpload />}
              variant="outlined"
              onClick={() => setLightroomPluginDialogOpen(true)}
            sx={{ 
              borderColor: '#31A8FF', 
              color: '#31A8FF','&:hover': { 
                borderColor: '#', 
                bgcolor: '#f3e5f5' 
      } 
      }}
            >
              Lightroom Plugin
            </Button>
          </FileStatusWrapper>
        )}

        {/* Create Custom Category Button with Count */}
        <Button
          startIcon={<Category />}
          variant="outlined"
          onClick={() => {
            setCustomCategoriesDialogOpen(true);
            // Auto-populate categories from existing items
            if (categories && categories.length > 0) {
              setCategories([...categories]);
            }
          }}
          sx={{ 
            borderColor: '#4caf50', 
            color: '#4caf50','&:hover': { 
              borderColor: '#388e30', 
              bgcolor: '#e8f5e8' 
      } 
      }}
        >
          <Badge badgeContent={categories?.length || 0} color="success" sx={{ mr: 1 }}>
            Lag kategori
          </Badge>
        </Button>

        {/* Create Custom Set Button with Count */}
        <Button
          startIcon={<FolderSpecial />}
          variant="outlined"
          onClick={() => {
            setCustomSetsDialogOpen(true);
            // Auto-populate sets from existing collections
            if (sets && sets.length > 0) {
              setSets([...sets]);
            }
          }}
          sx={{ 
            borderColor: '#31A8FF', 
            color: '#31A8FF','&:hover': { 
              borderColor: '#', 
              bgcolor: '#e3f2fd' 
      } 
      }}
        >
          <Badge badgeContent={sets?.length || 0} color="primary" sx={{ mr: 1 }}>
            Lag samling
          </Badge>
        </Button>
                
                {/* Google Photos Integration Button */}
                <Button
                  startIcon={
                    <Box 
                      component="img" 
                      src="https://fonts.gstatic.com/s/i/productlogos/photos/v14/24px.svg"
                      alt="Google Photos"
                      sx={{ width: 20, height: 20 }}
                    />
              }
                  variant="outlined"
                  sx={{ 
                    color: googlePhotosConnected ? theme.palette.primary.main : textSecondary,
                    borderColor: googlePhotosConnected ? theme.palette.primary.main : 'rgba(255, 107, 53, 0.3)','&:hover': {
                      borderColor: theme.palette.primary.main,
                      bgcolor: 'rgba(6, 133, 244, 0.1)'
                }
              }}
                  onClick={() => setShowGooglePhotosDialog(true)}
                >
                  {googlePhotosConnected ? 'Google Photos' : 'Koble til Google'}
                </Button>

                {/* Collaborators Panel */}
                {collaborators && collaborators.length > 0 && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    px: 2,
                    py: 1,
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 107, 53, 0.3)'
                  }}>
                    <People sx={{ color: textSecondary, fontSize: 20 }} />
                    <Typography variant="caption" sx={{ color: textSecondary }}>
                      {collaborators.length} Collaborator{collaborators.length !== 1 ? 's' : ''}
                    </Typography>
                    {localParticipant && (
                      <Chip 
                        label="You" 
                        size="small" 
                        color="primary" 
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>
                )}

                {/* AI Analysis Results Panel */}
                {aiAnalysisResults && Object.keys(aiAnalysisResults).length > 0 && (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1,
                    borderRadius: '8px',
                    bgcolor: 'rgba(156, 39, 176, 0.1)',
                    border: '1px solid rgba(156, 39, 176, 0.3)'
                  }}>
                    <AutoAwesome sx={{ color: '#9c27b0', fontSize: 20 }} />
                    <Typography variant="caption" sx={{ color: '#9c27b0' }}>
                      AI: {Object.keys(aiAnalysisResults).length} result{Object.keys(aiAnalysisResults).length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                )}

                {/* Google Drive Sync Button with Folder Structure Info */}
                {enableGoogleDriveSync && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      startIcon={
                        <Box 
                          component="img" 
                          src="https://fonts.gstatic.com/s/i/productlogos/drive/v16/24px.svg"
                          alt="Google Drive"
                          sx={{ width: 20, height: 20 }}
                        />
                  }
                      variant="outlined"
                      disabled={googleDriveSyncStatus === 'syncing'}
                      sx={{ 
                        color: googleDriveSyncStatus === 'success' ? theme.palette.success.main : textSecondary,
                        borderColor: googleDriveSyncStatus === 'success' ? theme.palette.success.main : 'rgba(6, 133, 244, 0.3)','&:hover': {
                          borderColor: theme.palette.success.main,
                          bgcolor: 'rgba(6, 175, 80, 0.1)'
                    }
                  }}
                      onClick={syncToGoogleDrive}
                    >
                      {googleDriveSyncStatus === 'syncing' ? 'Synkroniserer...' : 
                       googleDriveSyncStatus === 'success' ? 'Google Drive' : 'Sync til Drive'}
                    </Button>
                    <Tooltip title="Synkroniserer til 08_Showcase mappen i prosjektets 8-mappestruktur">
                      <Chip 
                        label="08_Showcase" 
                        size="small" 
                        variant="outlined"
                        sx={{ 
                          fontSize: '0.7rem',
                          height: 20,
                          color: theme.palette.primary.main,
                          borderColor: theme.palette.primary.main
                  }}
                      />
                    </Tooltip>
                    {currentGoogleDriveFolderId && (
                      <Tooltip title="Aktiv Google Drive mappe">
                        <Chip
                          label={`Folder: ${currentGoogleDriveFolderId.slice(0, 10)}...`}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: '0.65rem',
                            height: 20,
                            color: textSecondary,
                            borderColor: 'rgba(6, 133, 244, 0.3)'
                          }}
                        />
                      </Tooltip>
                    )}
                  </Box>
                )}

                {/* Google Contacts Sync Button */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    startIcon={
                      <Box 
                        component="img" 
                        src="https://fonts.gstatic.com/s/i/productlogos/contacts/v14/24px.svg"
                        alt="Google Contacts"
                        sx={{ width: 20, height: 20 }}
                      />
                }
                    variant="outlined"
                    disabled={googleContactsStatus === 'syncing'}
                    sx={{ 
                      color: googleContactsStatus === 'success' ? theme.palette.success.main : textSecondary,
                      borderColor: googleContactsStatus === 'success' ? theme.palette.success.main : 'rgba(6, 133, 244, 0.3)','&:hover': {
                        borderColor: theme.palette.success.main,
                        bgcolor: 'rgba(6, 175, 80, 0.1)'
                  }
                }}
                    onClick={syncGoogleContacts}
                  >
                    {googleContactsStatus === 'syncing' ? 'Synkroniserer...' : 
                     googleContactsStatus === 'success' ? 'Google Contacts' : 'Sync Contacts'}
                  </Button>
                  <Tooltip title="Synkroniserer kontakter fra Google People API for prosjektkollegaer og kunder">
                    <Chip 
                      label="Google People" 
                      size="small" 
                      variant="outlined"
                      sx={{ 
                        fontSize: '0.7rem',
                        height: 20,
                        color: theme.palette.secondary.main,
                        borderColor: theme.palette.secondary.main
                }}
                    />
                  </Tooltip>
                </Box>

                {/* AI Analysis Button for Music Producers */}
                {profession === 'music_producer' && enableAIAnalysis && (
                  <Button
                    startIcon={isAnalyzing ? <CircularProgress size={16} /> : <AutoFixHigh />}
                    variant="outlined"
                    disabled={isAnalyzing || !selectedItem}
                    sx={{ 
                      color: textSecondary,
                      borderColor: 'rgba(16, 39, 176, 0.3)','&:hover': {
                        borderColor: theme.palette.secondary.main,
                        bgcolor: 'rgba(16, 39, 176, 0.1)'
                      }
                    }}
                    onClick={() => selectedItem && analyzeAudioContent(selectedItem)}
                  >
                    {isAnalyzing ? 'Analyserer...' : 'AI Analyse'}
                  </Button>
                )}

                {/* Real-time Collaboration Indicator */}
                {enableRealTimeSync && (
                  <Chip
                    icon={<Chat />}
                    label={`${activeCollaborators.size} aktive`}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                )}
                
                {adminMode && (
                  <Button
                    startIcon={<Settings />}
                    variant="outlined"
                    sx={{ 
                      color: textSecondary,
                      borderColor: 'rgba(255, 107, 53, 0.3)','&:hover': {
                        borderColor: accentColor,
                        bgcolor: 'rgba(255, 107, 53, 0.1)'
                  }
                }}
                  >
                    Admin
                  </Button>
                )}
              </>
            )}
            <IconButton 
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              sx={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {viewMode === 'grid' ? <ViewList /> : <GridView />}
            </IconButton>
            
            {/* Workflow Executor Button */}
            <Tooltip title="One-Click Workflows">
              <Button
                variant="outlined"
                size="small"
                startIcon={<PlayArrow />}
                onClick={() => setShowWorkflowExecutor(true)}
                sx={{
                  borderColor: accentColor,
                  color: accentColor,
                  textTransform: 'none','&:hover': {
                    borderColor: accentColor,
                    bgcolor: `${accentColor}20`
                  }
                }}
              >
                Workflows
              </Button>
            </Tooltip>
            
            {/* Activity Feed Button */}
            <Tooltip title="Activity Feed">
              <IconButton
                size="small"
                onClick={() => setActivityFeedOpen(true)}
                sx={{
                  color: 'rgba(255,255,255,0.7)','&:hover': {
                    color: accentColor,
                    bgcolor: `${accentColor}20`
                  }
                }}
              >
                <Notifications />
              </IconButton>
            </Tooltip>
            
            {/* Comparison View Button */}
            <Tooltip title="Compare Items">
              <IconButton
                size="small"
                onClick={() => setComparisonViewOpen(true)}
                disabled={selectedImages.size < 2}
                sx={{
                  color: selectedImages.size >= 2 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)','&:hover': {
                    color: accentColor,
                    bgcolor: `${accentColor}20`
                  }
                }}
              >
                <Compare />
              </IconButton>
            </Tooltip>
            
            {/* Keyboard Shortcuts Hint */}
            <Tooltip title="Press ? for keyboard shortcuts">
              <Chip
                label="?"
                size="small"
                onClick={() => setShowKeyboardShortcuts(true)}
                sx={{
                  bgcolor: 'rgba(255, 107, 53, 0.1)',
                  color: accentColor,
                  border: `1px solid ${accentColor}40`,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontWeight: 700, '&:hover': {
                    bgcolor: 'rgba(255, 107, 53, 0.2)',
                    borderColor: accentColor
                  }
                }}
              />
            </Tooltip>
          </Stack>
        </Box>
        </>)}

        {/* Client Activity Section */}
        {showClientActivity && (
          <Box sx={{ p: 3 }}>
            <ClientActivityPanel
              profession={profession}
              accentColor={accentColor}
              userId={userId}
              onActivityClick={(activity) => {
                // Handle activity click - navigate to relevant item
                console.log('Activity clicked:', activity);
                setShowClientActivity(false);
              }}
            />
          </Box>
        )}
        
        {/* Smart Collections Section */}
        {showSmartCollections && !showClientActivity && (
          <SmartCollections
            items={filteredItems}
            profession={profession}
            accentColor={accentColor}
            onCollectionSelect={(collection) => {
              // Filter items based on collection
              if (collection?.id) {
                setFilter(collection.name || 'all');
                addNotification({ 
                  message: `Viewing collection: ${collection.name}`, 
                  type: 'info' 
                });
              }
              setShowSmartCollections(false);
            }}
            onItemSelect={(item) => {
              handleItemSelectWithBroadcast(item as any);
              setShowSmartCollections(false);
            }}
          />
        )}
        
        {/* ===== Hero Featured Section (reference-matched: large + side) ===== */}
        {currentFeaturedItem && !showSmartCollections && !showClientActivity && (
          <Box sx={{ px: 3, pt: 3, pb: 1 }}>
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
              gap: 2,
              height: { xs: 'auto', md: 420 },
            }}>
              {/* Large Featured Photo */}
              <Box sx={{ 
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
                bgcolor: '#1a1f2e',
                '&:hover .hero-overlay-actions': { opacity: 1 },
              }}
                onClick={() => handleItemSelectWithBroadcast(currentFeaturedItem as any)}
              >
                {/* Slice 9X.81 — width/height + loading=lazy + aspect-ratio på parent
                    eliminerer CLS når bildet laster. fetchpriority='high' for LCP. */}
                <img
                  src={currentFeaturedItem.fileUrl || currentFeaturedItem.thumbnailUrl || 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20800%20500%22%3E%3Crect%20width%3D%22800%22%20height%3D%22500%22%20fill%3D%22%231a1a1a%22%2F%3E%3Ctext%20x%3D%22400%22%20y%3D%22250%22%20text-anchor%3D%22middle%22%20fill%3D%22%23666%22%20font-family%3D%22sans-serif%22%20font-size%3D%2218%22%3EUtvalgt%20bilde%3C%2Ftext%3E%3C%2Fsvg%3E'}
                  alt={currentFeaturedItem.title}
                  width={800}
                  height={500}
                  loading="eager"
                  // @ts-expect-error — fetchpriority er gyldig HTML5-attributt men ikke i React-typer enda
                  fetchpriority="high"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', aspectRatio: '8 / 5' }}
                />
                {/* Hover action icons (heart + share) */}
                <Box className="hero-overlay-actions" sx={{
                  position: 'absolute', top: 16, right: 16,
                  display: 'flex', gap: 1, opacity: 0, transition: 'opacity 0.2s',
                }}>
                  <IconButton size="small" sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
                    <FavoriteBorder sx={{ fontSize: 20 }} />
                  </IconButton>
                  <IconButton size="small" sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
                    <Share sx={{ fontSize: 20 }} />
                  </IconButton>
                </Box>
                {/* Tags + info overlay */}
                <Box sx={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                  p: 2.5, pt: 6,
                }}>
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    {currentFeaturedItem.tags?.slice(0, 2).map(tag => (
                      <Chip key={tag} label={tag.toUpperCase()} size="small" sx={{
                        bgcolor: accentColor, color: '#fff', fontWeight: 700,
                        fontSize: '0.65rem', height: 22, letterSpacing: '0.03em',
                      }} />
                    ))}
                    {currentFeaturedItem.metadata?.dimensions && (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', alignSelf: 'center', ml: 'auto !important' }}>
                        {currentFeaturedItem.metadata.dimensions}
                      </Typography>
                    )}
                  </Stack>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, fontSize: '1.1rem', mb: 0.5 }}>
                    {currentFeaturedItem.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: config.primaryColor, fontSize: '0.7rem' }}>D</Avatar>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                      {user?.name || 'DANIEL CREATORHUB'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Side Featured Photo (second item or fallback) */}
              <Box sx={{ 
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
                bgcolor: '#1a1f2e',
                display: { xs: 'none', md: 'block' },
              }}
                onClick={() => {
                  const secondItem = filteredItems[1] || currentFeaturedItem;
                  handleItemSelectWithBroadcast(secondItem as any);
                }}
              >
                <img
                  src={(filteredItems[1]?.fileUrl || filteredItems[1]?.thumbnailUrl) || 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20500%22%3E%3Crect%20width%3D%22400%22%20height%3D%22500%22%20fill%3D%22%231a1a1a%22%2F%3E%3C%2Fsvg%3E'}
                  alt={filteredItems[1]?.title || 'Featured'}
                  width={400}
                  height={500}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', aspectRatio: '4 / 5' }}
                />
                <Box sx={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                  p: 2, pt: 5,
                }}>
                  {filteredItems[1]?.metadata?.dimensions && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', position: 'absolute', top: 12, right: 12 }}>
                      {filteredItems[1]?.metadata?.dimensions}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>
                    {filteredItems[1]?.title || 'Explore more'}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, bgcolor: config.primaryColor, fontSize: '0.65rem' }}>D</Avatar>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                      {user?.name || 'DANIEL CREATORHUB'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Multi-Day Categories Display */}
        {showMultiDayView && dayCategories.length > 0 && (
          <Box sx={{ 
            p: 3, 
            borderBottom: '1px solid rgba(255, 107, 53, 0.15)',
            background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.03) 0%, rgba(247, 147, 30, 0.01) 100%)'
      }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 600, 
              color: textPrimary, 
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1 }}>
              <CalendarMonth sx={{ color: accentColor }} />
              Multi-dag Prosjekter ({dayCategories.length})
            </Typography>
            
            <Stack spacing={2}>
              {dayCategories.map((categoryGroup, index) => (
                <Box key={index} sx={{ 
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 2,
                  p: 2,
                  border: '1px solid rgba(255, 107, 53, 0.1)'
            }}>
                  <Typography variant="subtitle1" sx={{ 
                    fontWeight: 600, 
                    color: textPrimary, 
                    mb: 1 }}>
                    {categoryGroup.baseCategory}
                  </Typography>
                  
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {categoryGroup.days.map((day: any, dayIndex: number) => {
                      const isSelected = selectedDayCategory === day.id;
                      return (
                        <Chip
                          key={dayIndex}
                          label={`${day.name} (${day.hours}t)`}
                          variant={isSelected ? 'filled' : 'outlined'}
                          // Slice 9X.81 — a11y: kunngjør valgt-state for skjermlesere,
                          // og legg til ✓ slik at colorblind-brukere ser tegnet i tillegg
                          // til farge.
                          aria-pressed={isSelected}
                          icon={isSelected ? <Box component="span" sx={{ pl: 0.5, fontSize: '0.85rem' }}>✓</Box> : undefined}
                          onClick={() => setSelectedDayCategory(isSelected ? null : day.id)}
                          sx={{
                            color: isSelected ? '#fff' : textSecondary,
                            bgcolor: isSelected ? accentColor : 'transparent',
                            borderColor: accentColor,
                            borderWidth: isSelected ? 2 : 1,
                            fontWeight: isSelected ? 700 : 400,
                            '&:hover': {
                              bgcolor: isSelected ? '#e64100' : 'rgba(255, 107, 53, 0.1)'
                            },
                            fontSize: '0.8rem',
                            mb: 0.5
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* ===== Explore by Categories (reference-matched horizontal chips) ===== */}
        <Box sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 600, 
            color: textPrimary, 
            fontSize: '1.15rem',
            mb: 2,
          }}>
            Explore by categories
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ 
            overflowX: 'auto', 
            pb: 1,
            '&::-webkit-scrollbar': { height: 0 },
          }}>
            {getProfessionCategories().map((category, index) => (
              <Chip
                key={category}
                label={category.toUpperCase()}
                variant={((filter === 'all' && index === 0) || filter === category.toLowerCase()) ? 'filled' : 'outlined'}
                onClick={() => setFilter(index === 0 ? 'all' : category.toLowerCase())}
                sx={{
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  letterSpacing: '0.05em',
                  px: 1.5,
                  height: 36,
                  whiteSpace: 'nowrap',
                  bgcolor: ((filter === 'all' && index === 0) || filter === category.toLowerCase())
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'transparent',
                  color: ((filter === 'all' && index === 0) || filter === category.toLowerCase())
                    ? '#fff'
                    : 'rgba(255,255,255,0.6)',
                  borderColor: 'rgba(255,255,255,0.15)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                    borderColor: 'rgba(255,255,255,0.25)',
                  },
                }}
              />
            ))}
          </Stack>
        </Box>

        {/* Professional Content Grid */}
        <Box sx={{ p: 3, flex: 1 }}>
          
          {/* Enhanced Video Showcase for Videographers */}
          {profession === 'videographer' && filter === 'video' && filteredItems.filter(item => item.type === 'video').length > 0 && (
            <React.Suspense fallback={<CircularProgress />}>
              <VideoShowcaseEnhanced
                item={filteredItems.filter(item => item.type === 'video')[0] as any}
                profession="videographer"
                onExport={(format) => exportVideoWithPreset(format === 'youtube' ? 'web-h264' : format === 'instagram' ? 'social-vertical' : 'custom')}
                onBookmarkAdd={(timestamp) => {
                  addNotification({ message: `Bokmerket tidspunkt ${Math.round(timestamp)}s`, type: 'success' });
                }}
              />
            </React.Suspense>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 600, 
              color: textPrimary,
              fontSize: '1.15rem',
            }}>
              {profession === 'photographer' ? 'Photos to explore' : 
               profession === 'videographer' ? 'Videos to explore' : 
               profession === 'music_producer' ? 'Tracks to explore' : 'Content to explore'}
            </Typography>
            
            <Stack direction="row" spacing={1}>
              {profession === 'photographer' && pricingData && (
                <Button startIcon={<AttachMoney />}
                  onClick={openPricingModal}
                  variant="contained"
                  color="primary"
                  sx={{ 
                    bgcolor: 'success.main','&:hover': { bgcolor: 'success.dark',}
              }}
                >
                  Prisadministrasjon
                </Button>
              )}
              <Button
                startIcon={viewMode === 'grid' ? <ViewList /> : <GridView />}
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                variant="outlined"
                sx={{ 
                  color: textSecondary,
                  borderColor: 'rgba(255, 107, 53, 0.3)','&:hover': {
                    borderColor: accentColor,
                    bgcolor: 'rgba(255, 107, 53, 0.1)'
              }
            }}
              >
                {viewMode === 'grid' ? 'Liste' : 'Grid'}
              </Button>
            </Stack>
          </Box>
          
          {/* File Upload Component - Shows after project selection */}
          {showUploadComponent && selectedProject && (
            <Box sx={{ 
              p: 3, 
              mb: 3, 
              bgcolor: 'rgba(255, 107, 53, 0.05)', 
              borderRadius: 2,
              border: '1px solid rgba(255, 107, 53, 0.2)',
              mx: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, color: accentColor, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudUpload />
                Last opp filer til: {selectedProject.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Prosjekt: {selectedProject.category} • {selectedProject.driveUrl ? 'Google Drive synkronisert' : 'Lokal lagring'}
              </Typography>
              
              <UniversalFileUpload
                profession={profession}
                userId={effectiveUserId}
                projectId={selectedProject.id.toString()}
                enableGoogleDriveSync={!!selectedProject.driveUrl}
                googleDriveFolderId={selectedProject.driveFolderId}
                enableBackgroundUpload={true}
                enableAdvancedQueue={true}
                showStorageInfo={true}
                showQueueStatus={true}
                onUploadComplete={() => {
                  console.log('Files uploaded successfully');
                  // Try to use template-specific toast, fallback to custom
                  showTemplateToast('showcase-upload-success', `Filer lastet opp vellykket!`);
                  // Refresh showcase data
                  queryClient.invalidateQueries({ queryKey: [`/api/showcase/profession/${profession}`] });
            }}
                onUploadError={(error, file) => {
                  console.error('Upload error:', error, file);
            }}
              />
            </Box>
          )}
          
          {items.length === 0 ? (
            <Box sx={{ 
              textAlign: 'center', 
              py: { xs: 6, sm: 8, md: 10 },
              px: { xs: 2, sm: 4, md: 6 },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'radial-gradient(ellipse at 50% 30%, rgba(255, 107, 53, 0.06) 0%, transparent 60%)',
              borderRadius: 4,
              mx: 'auto',
              maxWidth: 800,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Subtle animated background rings */}
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 400,
                height: 400,
                borderRadius: '50%',
                border: '1px solid rgba(255, 107, 53, 0.06)',
                pointerEvents: 'none',
              }} />
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 600,
                height: 600,
                borderRadius: '50%',
                border: '1px solid rgba(255, 107, 53, 0.03)',
                pointerEvents: 'none',
              }} />

              {/* Profession icon with glow */}
              <Box sx={{
                width: { xs: 80, sm: 100, md: 120 },
                height: { xs: 80, sm: 100, md: 120 },
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(255, 140, 0, 0.08))',
                border: '2px solid rgba(255, 107, 53, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff6b35',
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                boxShadow: '0 8px 40px rgba(255, 107, 53, 0.15)',
                position: 'relative',
                zIndex: 1,
                mb: 1,
              }}>
                {config.icon}
              </Box>

              {/* Main content card */}
              <Paper elevation={0} sx={{ 
                textAlign: 'center', 
                maxWidth: 560,
                width: '100%',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 4,
                p: { xs: 3, sm: 4, md: 5 },
                position: 'relative',
                zIndex: 1,
              }}>
                <Typography variant="h4" sx={{ 
                  fontWeight: 800, 
                  color: '#fff', 
                  mb: 1.5,
                  fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
                  background: 'linear-gradient(135deg, #ff6b35, #ff8c00, #ffa500)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.02em',
                }}>
                  Bygg din profesjonelle portefølje
                </Typography>
                <Typography variant="body1" sx={{ 
                  color: 'rgba(255,255,255,0.7)',
                  mb: 4,
                  lineHeight: 1.8,
                  fontWeight: 400,
                  fontSize: { xs: '0.9rem', sm: '1rem', md: '1.05rem' },
                  maxWidth: 440,
                  mx: 'auto',
                }}>
                  {profession === 'photographer' ? 
                    'Vis dine beste fotografier til kunder med vårt avanserte galleri-system. Automatisk prissetting og kundevalg inkludert.' : 
                   profession === 'videographer' ? 
                    'Presenter dine videoprosjekter profesjonelt med elegant video-player og kundetilgang.' : 
                   profession === 'music_producer' ?
                    'Del dine musikalske kreasjoner med artister gjennom vårt lydgalleri-system.' :
                    'Bygg en imponerende digital portefølje som viser ditt profesjonelle arbeid.'}
                </Typography>

                {/* CTA Button */}
                <Button variant="contained"
                  size="large"
                  startIcon={<Add />}
                  sx={{
                    background: 'linear-gradient(135deg, #ff6b35, #ff8c00)',
                    color: 'white',
                    py: 1.75,
                    px: 5,
                    borderRadius: '14px',
                    fontWeight: 700,
                    fontSize: { xs: '0.95rem', sm: '1.05rem', md: '1.1rem' },
                    textTransform: 'none',
                    boxShadow: '0 6px 24px rgba(255, 107, 53, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #ff8c00, #ffa500)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 10px 36px rgba(255, 107, 53, 0.45)',
                    },
                    '&:active': {
                      transform: 'translateY(0)',
                    },
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    mb: 4,
                  }}
                  onClick={() => setProjectSelectorOpen(true)}
                >
                  Kom i gang med showcase
                </Button>

                {/* Feature highlights — horizontal cards */}
                <Box sx={{ 
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                  gap: 2,
                  pt: 3,
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}>
                  {[
                    { icon: <AttachMoney sx={{ fontSize: 28, color: '#ff6b35' }} />, label: 'Automatisk prissetting', desc: 'Smart pris-forslag' },
                    { icon: <Visibility sx={{ fontSize: 28, color: '#ff8c00' }} />, label: 'Profesjonell visning', desc: 'Galleri med zoom' },
                    { icon: <ShoppingCart sx={{ fontSize: 28, color: '#4caf50' }} />, label: 'Kunde-selvtjeneste', desc: 'Direkte bestilling' },
                  ].map((feat, i) => (
                    <Box key={i} sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: 'rgba(255, 107, 53, 0.06)',
                        borderColor: 'rgba(255, 107, 53, 0.15)',
                      },
                    }}>
                      <Box sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        bgcolor: 'rgba(255, 107, 53, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {feat.icon}
                      </Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.8rem' }}>
                        {feat.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem' }}>
                        {feat.desc}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Box>
          ) : showcasesError ? (
            <Box sx={{ 
              textAlign: 'center', 
              py: 8,
              color: 'rgba(255,255,255,0.7)'
        }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Kunne ikke laste prosjekter. Prøv igjen senere.
              </Typography>
              <Button 
                variant="outlined" 
                onClick={() => {
                  void refetch();
                }}
                sx={{ 
                  borderColor: '#ff8c00',
                  color: '#ff8c00','&:hover': {
                    borderColor: '#ff6b35',
                    color: '#ff6b35'
                  }
                }}
              >
                Prøv igjen
              </Button>
            </Box>
          ) : isLoadingSkeleton ? (
            <Fade in={isLoadingSkeleton}>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${showcaseSettings.gridColumns}, 1fr)`,
                gap: 2,
                '@media (max-width: 768px)': {
                  gridTemplateColumns: `repeat(${showcaseSettings.mobileColumns}, 1fr)`
                }
              }}>
                {Array.from({ length: 12 }).map((_, idx) => (
                  <Zoom key={idx} in={isLoadingSkeleton} style={{ transitionDelay: `${idx * 50}ms` }}>
                    <Box>
                      <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 1 }} />
                      <Skeleton variant="text" width="80%" />
                      <Skeleton variant="text" width="60%" />
                    </Box>
                  </Zoom>
                ))}
              </Box>
            </Fade>
          ) : viewMode === 'masonry' ? (
            <ImageList variant="masonry" cols={showcaseSettings.gridColumns} gap={8}>
              {filteredItems.slice(1, (showcaseSettings.maxItemsPerPage as number) === 999 ? filteredItems.length : (showcaseSettings.maxItemsPerPage as number)).map((item: ShowcaseItem) => (
                <ImageListItem key={item.id} sx={{ cursor: 'pointer' }} onClick={() => setSelectedItem(item)}>
                  {/* Slice 9X.81 — Spotify/SoundCloud/YouTube/Vimeo detekteres
                      automatisk fra fileUrl; render iframe-embed istedenfor
                      img/video når matchet. */}
                  {(() => {
                    const embed = detectStreamingEmbed(item.fileUrl || item.thumbnailUrl || '');
                    if (embed) {
                      return <StreamingEmbed url={item.fileUrl || item.thumbnailUrl || ''} title={item.title || ''} />;
                    }
                    if (item.type === 'image') {
                      return (
                        <img
                          src={item.thumbnailUrl || ''}
                          alt={item.title || ''}
                          loading="lazy"
                          width={400}
                          height={400}
                          style={{ borderRadius: 8, width: '100%', height: 'auto', display: 'block' }}
                        />
                      );
                    }
                    return (
                      <Box sx={{ position: 'relative', bgcolor: 'rgba(0,0,0,0.8)', aspectRatio: '16/9', borderRadius: 2 }}>
                        <video src={item.thumbnailUrl || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                      </Box>
                    );
                  })()}
                  <ImageListItemBar
                    title={item.title || ''}
                    subtitle={formatFileSize(item.fileSize || 0)}
                    actionIcon={
                      <IconButton
                        sx={{ color: 'white' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(item.id);
                        }}
                      >
                        {favorites.has(item.id) ? <Favorite sx={{ color: accentColor }} /> : <FavoriteBorder />}
                      </IconButton>
                    }
                  />
                </ImageListItem>
              ))}
            </ImageList>
          ) : (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: `repeat(${showcaseSettings.gridColumns}, 1fr)` },
              gap: 2,
            }}>
              {filteredItems.slice(1, (showcaseSettings.maxItemsPerPage as number) === 999 ? filteredItems.length : (showcaseSettings.maxItemsPerPage as number)).map((item: ShowcaseItem) => (
                <ShowcaseCard
                  adminMode={adminMode}
                  onOpenProject={handleOpenProjectFromShowcase}
                  key={item.id}
                  item={item}
                  profession={profession}
                  accentColor={accentColor}
                  clientMode={clientMode}
                  clientSelections={clientSelections}
                  handleClientSelection={handleClientSelection}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  showComments={showComments}
                  setShowComments={setShowComments}
                  setSelectedItem={setSelectedItem}
                  handleDownload={handleDownload}
                  showcaseSettings={showcaseSettings}
                  analytics={analytics}
                  effectiveUserId={effectiveUserId}
                  addNotification={addNotification}
                  features={features}
                  setSelectedItemForPublish={setSelectedItemForPublish}
                  setShowPublishToAcademyDialog={setShowPublishToAcademyDialog}
                  setSelectedItemForCommunityShare={setSelectedItemForCommunityShare}
                  setShowShareToCommunityDialog={setShowShareToCommunityDialog}
                  projectState={projectState}
                  getProfessionDisplayName={getProfessionDisplayName}
                  setSelectedItemForStateUpdate={setSelectedItemForStateUpdate}
                  setNewProjectState={setNewProjectState}
                  setProjectStateUpdateOpen={setProjectStateUpdateOpen}
                  setSelectedItemForEvendi={setSelectedItemForEvendi}
                  setShowPublishToEvendiDialog={setShowPublishToEvendiDialog}
                />
              ))}
            </Box>
          )}
          
          {/* Client Submission Actions */}
          {clientMode && sessionData && clientSelections.length > 0 && (
            <Box sx={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 12,
          display: 'flex',
          gap: 2,
          bgcolor: 'rgba(6, 31, 46, 0.95)',
          backdropFilter: 'blur(20px)',
                borderRadius: 3,
          p: 2,
          border: '1px solid rgba(255, 107, 53, 0.3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <Typography variant="body1" sx={{ 
            color: '#fff', 
            alignSelf: 'center',
            mr: 2 }}>
            {clientSelections.length} bilder valgt
          </Typography>

          <TextField
            size="small"
            placeholder="Legg til kommentar til fotografen"
            value={clientComment}
            onChange={(e) => setClientComment(e.target.value)}
            sx={{
              minWidth: 260,
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 1,
              input: { color: '#fff' }
            }}
            InputProps={{
              sx: { color: '#fff' }
            }}
          />
          
          <Button variant="contained"
            size="large"
            onClick={async () => {
              try {
                const response = await fetch('/api/showcase/client-submissions', {
                  method: 'POST',
                  headers: { 'Content-Type' : 'application/json' },
                  body: JSON.stringify({
                    sessionId: proofingSession?.id,
                    clientEmail,
                    submissionComment: clientComment,
                    selectedItems: clientSelections
                  })
                });
                
                if (response.ok) {
                  showToastWithActions(
                    'Ditt utvalg er sendt til fotografen!','success',
                    [
                      {
                        label: 'Se Utvalg',
                        action: () => {
                          // Show selected items - scroll to selections
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      },
                      {
                        label: 'Legg til Kommentar',
                        action: () => {
                          // Open comment dialog - focus on comment input
                          const commentInput = document.querySelector('input[placeholder*="kommentar"]') as HTMLInputElement;
                          if (commentInput) {
                            commentInput.focus();
                          }
                        }
                      }
                    ]
                  );
                  // Optionally reload or redirect
                }
              } catch (error) {
                console.error('Error submitting selections:', error);
                showErrorToast('Feil ved innsending av utvalg. Prøv igjen.');
              }
            }}
            sx={{
              bgcolor: accentColor,
              color: '#fff',
              px: 4,
              py: 1.5,
              borderRadius: 2,
              fontWeight: 600, '&:hover': {
                bgcolor: '#e64100'
              }
            }}
          >
            Send utvalg til fotograf
            </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Project Selector Modal */}
      <ProjectSelectorModal
        open={projectSelectorOpen}
        onOpenChange={setProjectSelectorOpen}
        profession={profession}
        onProjectSelected={handleProjectSelected}
      />
      
      {/* Pricing Modal - Integrated pricing administration */}
      <Dialog open={showPricing} onClose={() => setShowPricing(false)} maxWidth="md" fullWidth>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AttachMoney />
              Prisadministrasjon - {profession === 'photographer' ? 'Bildekjøp' : 'Innholdskjøp'}
            </Typography>
            
            {/* Selected Images Summary */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(255,255,255,0.04)' }}>
              <Typography variant="h6" gutterBottom>Valgte elementer</Typography>
              <Typography variant="body1">
                {selectedImages.size} {profession === 'photographer' ? 'bilder' : 'elementer'} valgt
              </Typography>
              
              {pricingData && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Inkludert i kontrakt: {pricingData.projectPricing?.contracted_images || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ekstra: {Math.max(0, selectedImages.size - (pricingData.projectPricing?.contracted_images || 0))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pris per ekstra: {(() => {
                      try {
                        if (pricingData.projectPricing?.per_image) {
                          return formatCurrency(pricingData.projectPricing.per_image, 'NOK');
                        } else if (pricingData.pricing?.perImage) {
                            return formatCurrency(pricingData.pricing.perImage, 'NOK');
                        } else {
                          // Use default fallback pricing
                          return formatCurrency(150, 'NOK');
                        }
                      } catch (error) {
                        console.error('Pricing fallback error:', error);
                        return '150 NOK';
                      }
                })()}
                  </Typography>
                </Box>
              )}
            </Paper>
            
            {/* Price Calculation */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'success.light', color: 'success.contrastText' }}>
              <Typography variant="h6">
                Totalpris: {calculatePrice()} NOK
              </Typography>
              <Typography variant="body2">
                {selectedImages.size > (pricingData?.projectPricing?.contracted_images || 0) 
                  ? `Inkluderer ${Math.max(0, selectedImages.size - (pricingData?.projectPricing?.contracted_images || 0))} ekstra ${profession === 'photographer' ? 'bilder' : 'elementer'}`
                  : 'Alle valgte elementer er inkludert i kontrakten'
                }
              </Typography>
            </Paper>
            
            {/* Package Options */}
            {pricingData?.pricing?.packages && (
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Pakketilbud</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {pricingData.pricing.packages.map((pkg: { id: string; name: string; price: number; description: string; images?: number; minutes?: number; tracks?: number; savings?: number }) => (
                    <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.333%' }, maxWidth: { xs: '100%', md: '33.333%' } }} key={pkg.id}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {profession === 'photographer' || profession === 'enterprise' ? `${pkg.images} bilder` : `${pkg.minutes || pkg.tracks} ${profession === 'videographer' ? 'minutter' : 'låter'}`}
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {pkg.price} NOK
                        </Typography>
                        {(pkg.savings || 0) > 0 && (
                          <Chip label={`Spar ${pkg.savings} NOK`} color="success" size="small" sx={{ mt: 1 }} />
                        )}
                      </Paper>
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}
            
            {/* Action Buttons */}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => setShowPricing(false)}
                fullWidth
              >
                Avbryt
              </Button>
              <Button variant="contained"
                onClick={handleCheckout}
                disabled={selectedImages.size === 0}
                startIcon={<Payment />}
                fullWidth
              >
                Bestill ({calculatePrice()} NOK)
              </Button>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>
      
      {/* CreatorHub Photo Enhancer Dialog */}
      <Dialog open={showPhotoEnhancer} onClose={() => setShowPhotoEnhancer(false)} maxWidth="md" fullWidth>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Palette />
              CreatorHub Photo Enhancer
            </Typography>
            
            {/* Selected Images Summary */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(255,255,255,0.04)' }}>
              <Typography variant="h6" gutterBottom>Valgte bilder</Typography>
              <Typography variant="body1">
                {selectedImages.size === 1 
                  ? '1 bilde valgt for forbedring'
                  : `${selectedImages.size} bilder valgt for forbedring`
            }
              </Typography>
            </Paper>
            
            {/* Enhancement Presets */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoFixHigh />
                Forhåndsinnstillinger
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Velg type fotografi</InputLabel>
                <Select
                  value={selectedPhotoPreset}
                  onChange={(e) => setSelectedPhotoPreset((e.target as HTMLSelectElement).value)}
                  label="Velg type fotografi"
                >
                  <MenuItem value="portrait">Portrett</MenuItem>
                  <MenuItem value="wedding">Bryllup</MenuItem>
                  <MenuItem value="landscape">Landskap</MenuItem>
                  <MenuItem value="product">Produkt</MenuItem>
                  <MenuItem value="event">Event</MenuItem>
                  <MenuItem value="custom">Tilpasset</MenuItem>
                </Select>
              </FormControl>
              
              {enhancementPresets[selectedPhotoPreset] && (
                <Typography variant="body2" color="text.secondary">
                  {enhancementPresets[selectedPhotoPreset].description}
                </Typography>
              )}
            </Paper>
            
            {/* Custom Enhancement Options - Only visible when custom is selected */}
            {selectedPhotoPreset === 'custom' && (
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tune />
                  Tilpassede innstillinger
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography gutterBottom>Lysstyrke</Typography>
                  <Slider
                    value={customEnhancementOptions.brightness}
                    onChange={(_, value) => setCustomEnhancementOptions(prev => ({ ...prev, brightness: value as number }))}
                    min={-50}
                    max={50}
                    step={1}
                    valueLabelDisplay="auto"
                  />
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography gutterBottom>Kontrast</Typography>
                  <Slider
                    value={customEnhancementOptions.contrast}
                    onChange={(_, value) => setCustomEnhancementOptions(prev => ({ ...prev, contrast: value as number }))}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    valueLabelDisplay="auto"
                  />
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography gutterBottom>Metning</Typography>
                  <Slider
                    value={customEnhancementOptions.saturation}
                    onChange={(_, value) => setCustomEnhancementOptions(prev => ({ ...prev, saturation: value as number }))}
                    min={-50}
                    max={50}
                    step={1}
                    valueLabelDisplay="auto"
                  />
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography gutterBottom>Skarphet</Typography>
                  <Slider
                    value={customEnhancementOptions.sharpening}
                    onChange={(_, value) => setCustomEnhancementOptions(prev => ({ ...prev, sharpening: value as number }))}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    valueLabelDisplay="auto"
                  />
                </Box>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={customEnhancementOptions.noiseReduction}
                      onChange={(e) => setCustomEnhancementOptions(prev => ({ ...prev, noiseReduction: e.target.checked }))}
                    />
              }
                  label="Støyreduksjon"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={customEnhancementOptions.autoTone}
                      onChange={(e) => setCustomEnhancementOptions(prev => ({ ...prev, autoTone: e.target.checked }))}
                    />
              }
                  label="Automatisk tonejustering"
                />
              </Paper>
            )}
            
            {/* Progress Indicator */}
            {isEnhancing && (
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.light' }}>
                <Typography variant="h6" gutterBottom>Forbedrer bilder...</Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={enhancementProgress}
                  sx={{ mb: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {enhancementProgress}% fullført
                </Typography>
              </Paper>
            )}
            
            {/* Action Buttons */}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => setShowPhotoEnhancer(false)}
                disabled={isEnhancing}
                fullWidth
              >
                Avbryt
              </Button>
              <Button variant="contained"
                onClick={executeEnhancement}
                disabled={selectedImages.size === 0 || isEnhancing}
                startIcon={isEnhancing ? <CircularProgress size={20} /> : <AutoFixHigh />}
                sx={{ bgcolor: '#ff6f00','&:hover': { bgcolor: '#e65100' } }}
                fullWidth
              >
                {isEnhancing 
                  ? 'Forbedrer...' 
                  : `Forbedre ${selectedImages.size} ${selectedImages.size === 1 ? 'bilde' : 'bilder'}`
                }
              </Button>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Watermark Dialog */}
      <Dialog open={showWatermarkDialog} onClose={() => setShowWatermarkDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Copyright />
          Sett vannmerke på {selectedImages.size} bilde{selectedImages.size !== 1 ? 'r' : ','}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Vannmerke tekst"
              value={watermarkText}
              onChange={(e) => setWatermarkText((e.target as HTMLInputElement).value)}
              sx={{ mb: 3 }}
            />
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Posisjon</InputLabel>
              <Select
                value={watermarkPosition}
                onChange={(e) => setWatermarkPosition(e.target.value)}
                label="Posisjon"
              >
                <MenuItem value="top-left">Øverst til venstre</MenuItem>
                <MenuItem value="top-right">Øverst til høyre</MenuItem>
                <MenuItem value="bottom-left">Nederst til venstre</MenuItem>
                <MenuItem value="bottom-right">Nederst til høyre</MenuItem>
                <MenuItem value="center">Midt på bildet</MenuItem>
              </Select>
            </FormControl>
            
            <Box sx={{ mb: 2 }}>
              <Typography gutterBottom>Gjennomsiktighet</Typography>
              <Slider
                value={watermarkOpacity}
                onChange={(_, value) => setWatermarkOpacity(value as number)}
                min={0.1}
                max={1.0}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              />
            </Box>
            
            {isApplyingWatermark && (
              <LinearProgress sx={{ mb: 2 }} />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWatermarkDialog(false)} disabled={isApplyingWatermark}>
            Avbryt
          </Button>
          <Button onClick={applyWatermark}
            variant="contained" 
            disabled={isApplyingWatermark || !watermarkText.trim()}
            startIcon={isApplyingWatermark ? <CircularProgress size={20} /> : <Copyright />}
          >
            {isApplyingWatermark ? 'Setter vannmerke...' : 'Sett vannmerke'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Copy/Move Dialog */}
      <Dialog open={showCopyMoveDialog} onClose={() => setShowCopyMoveDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {copyMoveAction === 'copy' ? <ContentCopy /> : <DriveFileMove />}
          {copyMoveAction === 'copy' ? 'Kopier' : 'Flytt'} {selectedImages.size} bilde{selectedImages.size !== 1 ? 'r' : ','}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Velg destinasjon for {copyMoveAction === 'copy' ? 'kopiering' : 'flytting'}:
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Velg prosjekt</InputLabel>
              <Select
                value={selectedTargetProject}
                onChange={(e) => setSelectedTargetProject(e.target.value)}
                label="Velg prosjekt"
              >
                <MenuItem value="">
                  <em>Velg prosjekt...</em>
                </MenuItem>
                {availableProjects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderOpen sx={{ fontSize: 16 }} />
                      {project.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Velg kategori</InputLabel>
              <Select
                value={selectedTargetCategory}
                onChange={(e) => setSelectedTargetCategory(e.target.value)}
                label="Velg kategori"
              >
                <MenuItem value="">
                  <em>Velg kategori...</em>
                </MenuItem>
                {availableCategories.map((category) => (
                  <MenuItem key={category} value={category}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Label sx={{ fontSize: 16 }} />
                      {category}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {isCopyingMoving && (
              <LinearProgress sx={{ mb: 2 }} />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCopyMoveDialog(false)} disabled={isCopyingMoving}>
            Avbryt
          </Button>
          <Button onClick={executeCopyMove}
            variant="contained" 
            disabled={isCopyingMoving || (!selectedTargetProject && !selectedTargetCategory)}
            startIcon={isCopyingMoving ? <CircularProgress size={20} /> : (copyMoveAction === 'copy' ? <ContentCopy /> : <DriveFileMove />)}
          >
            {isCopyingMoving ? 
              (copyMoveAction === 'copy' ? 'Kopierer...' : 'Flytter...') : 
              (copyMoveAction === 'copy' ? 'Kopier' : 'Flytt')
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Operations Dialog */}
      <Dialog open={showBulkOperationsDialog} onClose={() => setShowBulkOperationsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlaylistAdd />
          Bulk Operations
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {selectedBatchItems.size > 0 ? selectedBatchItems.size : selectedImages.size} elementer valgt
            </Typography>

            <TextField
              fullWidth
              label="Legg til tags (kommaseparert)"
              value={bulkMetadata.tags}
              onChange={(e) => setBulkMetadata(prev => ({ ...prev, tags: e.target.value }))}
              sx={{ mb: 2 }}
            />

            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => {
                  setShowBulkOperationsDialog(false);
                  setShowMetadataEditor(true);
                }}
              >
                Metadata Editor
              </Button>
              <Button
                variant="outlined"
                startIcon={<Label />}
                onClick={async () => {
                  setShowBulkOperationsDialog(false);
                  await applyBulkMetadata();
                }}
              >
                Oppdater Tags
              </Button>
            </Stack>

            <Stack direction="row" spacing={2}>
              <Button
                variant="text"
                startIcon={<CloudDownload />}
                onClick={() => {
                  executeBulkOperation('bulk-download');
                  setShowBulkOperationsDialog(false);
                }}
              >
                Last ned
              </Button>
              <Button
                variant="text"
                startIcon={<Archive />}
                onClick={() => {
                  executeBulkOperation('archive');
                  setShowBulkOperationsDialog(false);
                }}
              >
                Arkiver
              </Button>
              <Button
                variant="text"
                startIcon={<Delete />}
                onClick={() => {
                  executeBulkOperation('delete');
                  setShowBulkOperationsDialog(false);
                }}
              >
                Slett
              </Button>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBulkOperationsDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Metadata Editor Dialog */}
      <Dialog open={showMetadataEditor} onClose={() => setShowMetadataEditor(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Edit />
          Rediger metadata for {selectedImages.size} bilde{selectedImages.size !== 1 ? 'r' : ','}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%' }, maxWidth: { xs: '100%', sm: '50%' } }}>
                <TextField
                  fullWidth
                  label="Tittel"
                  value={bulkMetadata.title}
                  onChange={(e) => setBulkMetadata(prev => ({ ...prev, title: e.target.value }))}
                  sx={{ mb: 2 }}
                />
              </Box>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%' }, maxWidth: { xs: '100%', sm: '50%' } }}>
                <TextField
                  fullWidth
                  label="Lokasjon"
                  value={bulkMetadata.location}
                  onChange={(e) => setBulkMetadata(prev => ({ ...prev, location: e.target.value }))}
                  sx={{ mb: 2 }}
                />
              </Box>
              <Box sx={{ flex: { xs: '1 1 100%',}, maxWidth: { xs: '100%',} }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Beskrivelse"
                  value={bulkMetadata.description}
                  onChange={(e) => setBulkMetadata(prev => ({ ...prev, description: e.target.value }))}
                  sx={{ mb: 2 }}
                />
              </Box>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%' }, maxWidth: { xs: '100%', sm: '50%' } }}>
                <TextField
                  fullWidth
                  label="Tags (separert med komma)"
                  value={bulkMetadata.tags}
                  onChange={(e) => setBulkMetadata(prev => ({ ...prev, tags: e.target.value }))}
                  sx={{ mb: 2 }}
                  placeholder="bryllup, portrett, utendørs"
                />
              </Box>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%' }, maxWidth: { xs: '100%', sm: '50%' } }}>
                <TextField
                  fullWidth
                  label="Copyright"
                  value={bulkMetadata.copyright}
                  onChange={(e) => setBulkMetadata(prev => ({ ...prev, copyright: e.target.value }))}
                  sx={{ mb: 2 }}
                />
              </Box>
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Typography variant="h6" sx={{ mb: 2 }}>
              Visningsinnstillinger - Velg hva som skal vises
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={displayPreferences.showExif}
                    onChange={(e) => setDisplayPreferences(prev => ({ ...prev, showExif: e.target.checked }))}
                  />
                }
                label="Vis EXIF-data (kamera, ISO, blender, etc.)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={displayPreferences.showCameraInfo}
                    onChange={(e) => setDisplayPreferences(prev => ({ ...prev, showCameraInfo: e.target.checked }))}
                  />
                }
                label="Vis kamerainformasjon"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={displayPreferences.showLocation}
                    onChange={(e) => setDisplayPreferences(prev => ({ ...prev, showLocation: e.target.checked }))}
                  />
                }
                label="Vis lokasjon"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={displayPreferences.showTags}
                    onChange={(e) => setDisplayPreferences(prev => ({ ...prev, showTags: e.target.checked }))}
                  />
                }
                label="Vis tags"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={displayPreferences.showCopyright}
                    onChange={(e) => setDisplayPreferences(prev => ({ ...prev, showCopyright: e.target.checked }))}
                  />
                }
                label="Vis copyright"
              />
            </FormGroup>
            
            {isProcessingBulkOperation && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress variant="determinate" value={bulkOperationProgress} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {bulkOperationProgress}% fullført
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMetadataEditor(false)} disabled={isProcessingBulkOperation}>
            Avbryt
          </Button>
          <Button onClick={applyBulkMetadata}
            variant="contained" 
            disabled={isProcessingBulkOperation}
            startIcon={isProcessingBulkOperation ? <CircularProgress size={20} /> : <Edit />}
          >
            {isProcessingBulkOperation ? 'Oppdaterer...' : 'Oppdater metadata'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Enhanced Floating Action Panel - Profession-Specific Management Suite */}
      {selectedImages.size > 0 && profession === 'photographer' && (
        <Box
          sx={{
            position: 'fixed',
            top:  20,
            right:  20,
            zIndex: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(2, 4, 8,250,252,0.95) 100%)',
            backdropFilter: 'blur(20px)',
                borderRadius: 3,
            padding:  3,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 2px 12px rgba(0, 0, 0, 0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            minWidth: 30,
            maxWidth: 30,
            maxHeight: '80vh',
            overflowY: 'auto'
    }}
        >
          <Typography variant="h6" 
            sx={{ 
              fontWeight: 600,
              background: 'linear-gradient(45deg, #FFA726, #FF7043)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              mb: 1,
              textAlign: 'center'
      }}
>
            {selectedImages.size} bilde{selectedImages.size !== 1 ? 'r' : ','} valgt
          </Typography>

          {/* Primary Enhancement Actions */}
          <Button fullWidth
            variant="contained"
            startIcon={<AutoFixHigh />}
            onClick={openPhotoEnhancer}
            sx={{
              background: 'linear-gradient(45deg, #FF7043, #FFA726)',
              color: 'white',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 4px 20px rgba(255, 112, 67, 0.3)','&:hover': {
                background: 'linear-gradient(45deg, #F4511E, #FF8F00)',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 25px rgba(255, 112, 67, 0.4)'
              },
              transition: 'all 0.3s ease',
              mb: 1 }}
          >
            {selectedImages.size === 1 
              ? 'Åpne i CreatorHub Photo Enhancer'
              : `Rediger ${selectedImages.size} bilder i CreatorHub Photo Enhancer`
            }
          </Button>

          {/* Google Photos Integration with Project Context */}
          <Box sx={{ mb: 1 }}>
            
            <Button fullWidth
              variant="contained"
              startIcon={<PhotoLibrary />}
              onClick={() => handleGooglePhotosEdit(Array.from(selectedImages))}
              sx={{
                background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.success.main})`,
                color: 'white',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: '0 4px 20px rgba(66, 133, 244, 0.3)','&:hover': {
                  background: 'linear-gradient(45deg, #3367D6, #137333)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 25px rgba(66, 133, 244, 0.4)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              {selectedImages.size === 1 
                ? `Rediger i Google Photos`
                : `Send ${selectedImages.size} bilder til Google Photos`
              }
            </Button>
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Image Management Operations */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Copyright />}
                onClick={openWatermarkDialog}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: '#',
                  borderColor: '#1976d2'
          }}
              >
                {selectedImages.size === 1 ? 'Vannmerke' : `Vannmerke ${selectedImages.size}`}
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ContentCopy />}
                onClick={() => openCopyMoveDialog('copy')}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: '#388e30',
                  borderColor: '#388e3c'
          }}
              >
                Kopier
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<DriveFileMove />}
                onClick={() => openCopyMoveDialog('move')}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: '#f57c00',
                  borderColor: '#f57c00'
          }}
              >
                Flytt
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CloudDownload />}
                onClick={() => executeBulkOperation('bulk-download')}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: '#',
                  borderColor: '#7b1fa2'
          }}
              >
                Last ned
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Favorite />}
                onClick={() => executeBulkOperation('toggle-favorite')}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: '#e91e63',
                  borderColor: '#e91e63'
          }}
              >
                Favoritt
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Copyright />}
                onClick={openWatermarkDialog}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: '#007960',
                  borderColor: '#00796b'
          }}
              >
                Vannmerke
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Edit />}
                onClick={openPhotoEditor}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: '#',
                  borderColor: '#5e35b1'
          }}
              >
                Rediger
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Archive />}
                onClick={() => executeBulkOperation('archive')}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: '#',
                  borderColor: '#616161'
          }}
              >
                Arkiver
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Label />}
                onClick={() => {
                  if (selectedBatchItems.size > 0) {
                    setSelectedImages(new Set(selectedBatchItems));
                  }
                  setShowBulkOperationsDialog(true);
                }}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: '#007960',
                  borderColor: '#00796b'
          }}
              >
                Tagg
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Quick Transform Operations */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#666', mb: 1 }}>
            Hurtigtransform
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ flex: { xs: '1 1 33.333%' }, maxWidth: { xs: '33.333%' } }}>
              <Button
                fullWidth
                variant="text"
                startIcon={<Rotate90DegreesCcw />}
                onClick={() => executeBulkOperation('rotate-left')}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  color: '#424242'
          }}
              >
                Roter
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 33.333%' }, maxWidth: { xs: '33.333%' } }}>
              <Button
                fullWidth
                variant="text"
                startIcon={<Flip />}
                onClick={() => executeBulkOperation('flip-horizontal')}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  color: '#424242'
          }}
              >
                Speil
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 33.333%' }, maxWidth: { xs: '33.333%' } }}>
              <Button
                fullWidth
                variant="text"
                startIcon={<Crop />}
                onClick={openCropDialog}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  color: '#424242'
          }}
              >
                Beskjær
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Pricing Section for photographers */}
          {profession === 'photographer' && (
            <>
              <Button fullWidth
                variant="contained"
                startIcon={<ShoppingCart />}
                onClick={openPricingModal}
                sx={{
                  bgcolor: 'success.main','&:hover': { bgcolor: 'success.dark' },
                  textTransform: 'none',
                  fontWeight: 600,
                  mb: 1 }}
              >
                Se priser for valgte bilder
              </Button>
              <Divider sx={{ my: 1 }} />
            </>
          )}

          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<Delete />}
            onClick={() => {
              setConfirmDeleteDialog({
                open: true,
                count: selectedImages.size,
                type: 'image',
                onConfirm: () => {
                  executeBulkOperation('delete');
                  setConfirmDeleteDialog(prev => ({ ...prev, open: false }));
                }
              });
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              mb: 1 }}
          >
            Slett valgte bilder
          </Button>

          <Button
            fullWidth
            variant="text"
            onClick={() => setSelectedImages(new Set())}
            sx={{
              color: '#66',
              textTransform: 'none',
              fontWeight: 500}}
          >
            Avbryt valg
          </Button>
        </Box>
      )}

      {/* AI Processing Panel for Videographer */}
      {profession === 'videographer' && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 10,
            right:  20,
            zIndex: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            p: 2,
            bgcolor: 'rgba(21,76,60,0.95)',
            backdropFilter: 'blur(10px)',
                  borderRadius: 2,
            boxShadow: '0 4px 20px rgba(21,76,60,0.3)',
            border: '1px solid rgba(255,255,255,0.2)',
            minWidth: 250 }}
        >
          <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
            AI Video Processing
          </Typography>
          
          <Button
            size="small"
            startIcon={<AutoFixHigh />}
            onClick={() => setShowAutoTagDialog(true)}
            sx={{
              color: 'white',
              justifyContent: 'flex-start','&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
        }}
          >
            Auto-tag videoer
          </Button>
          
          <Button
            size="small"
            startIcon={<Movie />}
            onClick={() => generateVideoThumbnails(selectedItem?.id || '')}
            disabled={!selectedItem || selectedItem.fileType !== 'video'}
            sx={{
              color: 'white',
              justifyContent: 'flex-start','&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
        }}
          >
            Generer thumbnails
          </Button>
          
          <Button
            size="small"
            startIcon={<Subtitles />}
            onClick={() => setShowSubtitleDialog(true)}
            sx={{
              color: 'white',
              justifyContent: 'flex-start','&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
        }}
          >
            Auto-undertekster
          </Button>
          
          <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.3)' }} />
          
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', mb: 0.5 }}>
            Social Media Export
          </Typography>
          
          <Button
            size="small"
            onClick={() => exportVideoWithPreset('instagram')}
            sx={{
              color: 'white',
              fontSize: '0.75rem',
              justifyContent: 'flex-start','&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
        }}
          >
            Instagram (4: 5)
          </Button>
          
          <Button
            size="small"
            onClick={() => exportVideoWithPreset('')}
            sx={{
              color: 'white',
              fontSize: '0.75rem',
              justifyContent: 'flex-start','&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
        }}
          >
            TikTok (9: 16)
          </Button>
          
          <Button
            size="small"
            onClick={() => exportVideoWithPreset('')}
            sx={{
              color: 'white',
              fontSize: '0.75rem',
              justifyContent: 'flex-start','&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
        }}
          >
            YouTube (16: 9)
          </Button>
        </Box>
     )}

      {/* Enhanced Video Action Panel - Complete Video Management Suite for Videographer */}
      {selectedImages.size > 0 && profession === 'videographer' && (
        <Box
          sx={{
            position: 'fixed',
            top:  20,
            right:  20,
            zIndex: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            background: 'linear-gradient(135deg, rgba(2, 3, 1,76,60,0.95) 0%, rgba(1, 9, 2,57,43,0.95) 100%)',
            backdropFilter: 'blur(20px)',
                borderRadius: 3,
            padding:  3,
            boxShadow: '0 8px 32px rgba(21,76,60,0.3)',
            border: '1px solid rgba(255,255,255,0.2)',
            minWidth: 30,
            maxWidth: 30,
            maxHeight: '80vh',
            overflowY: 'auto'
    }}
        >
          <Typography variant="h6" 
            sx={{ 
              fontWeight: 600,
              color: 'white',
              mb: 1,
              textAlign: 'center',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)'
        }}
>
            {selectedImages.size} video{selectedImages.size !== 1 ? 'er' : ','} valgt
          </Typography>

          {/* Video Version Control */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={{ color: 'white'}}>Versjon</InputLabel>
            <Select 
              value={videoVersion}
              onChange={(e) => setVideoVersion(e.target.value as 'R1' | 'R2' | 'R3' | 'Final')}
              sx={{
                color: 'white','& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }, '& .MuiSvgIcon-root': { color: 'white' }
              }}
            >
              <MenuItem value="R1">R1 - Første utkast</MenuItem>
              <MenuItem value="R2">R2 - Revisjon</MenuItem>
              <MenuItem value="R3">R3 - Finpuss</MenuItem>
              <MenuItem value="Final">Final - Ferdig versjon</MenuItem>
            </Select>
          </FormControl>

          {/* Primary Video Actions */}
          <Button fullWidth
            variant="contained"
            startIcon={<MovieCreation />}
            onClick={() => setShowVideoEditor(true)}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontWeight: 600,
              textTransform: 'none',
              border: '1px solid rgba(255,255,255,0.3)','&:hover': {
                bgcolor: 'rgba(255,255,255,0.22)',
                transform: 'translateY(-2px)',
          },
              transition: 'all 0.3s ease',
              mb: 1 }}
          >
            {profession === 'videographer' ? 'Åpne CreatorHub Video Suite' : 'Åpne CreatorHub Photo Suite'}
          </Button>

          <Button fullWidth
            variant="contained"
            startIcon={<TimelineIcon />}
            onClick={() => setShowSequenceManager(true)}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontWeight: 600,
              textTransform: 'none',
              border: '1px solid rgba(255,255,255,0.3)','&:hover': {
                bgcolor: 'rgba(255,255,255,0.3)'
              },
              mb: 1 }}
          >
            Sekvens & Kapittel Manager
          </Button>

          <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.3)' }} />

          {/* Video Management Operations */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<HighQuality />}
                onClick={() => setShowRenderPresets(true)}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.24)','&:hover': { borderColor: 'white',}
            }}
              >
                Render
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Copyright />}
                onClick={() => setShowVideoWatermarkDialog(true)}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.24)','&:hover': { borderColor: 'white',}
            }}
              >
                Vannmerke
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Layers />}
                onClick={() => setShowProxyGenerator(true)}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.24)','&:hover': { borderColor: 'white',}
            }}
              >
                Proxy
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<VolumeUp />}
                onClick={() => setShowMulticamSync(true)}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.24)','&:hover': { borderColor: 'white',}
            }}
              >
                Multicam
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Subtitles />}
                onClick={() => setShowChapterMarker(true)}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.24)','&:hover': { borderColor: 'white',}
            }}
              >
                Kapitler
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<TimelineIcon />}
                onClick={() => setShowVersionComparison(true)}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.24)','&:hover': { borderColor: 'white',}
            }}
              >
                Sammenlign
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.3)' }} />

          {/* Bryllup & Streaming Operations */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Favorite />}
                onClick={() => setShowWeddingPackages(true)}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.24)','&:hover': { borderColor: 'white',}
            }}
              >
                Bryllup
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<OpenInNew />}
                onClick={() => setShowStreamingSetup(true)}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.24)','&:hover': { borderColor: 'white',}
            }}
              >
                Streaming
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%',}, maxWidth: { xs: '100%',} }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CloudDownload />}
                onClick={() => setShowAnalytics(true)}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.24)','&:hover': { borderColor: 'white',}
            }}
              >
                Analyse & Rapporter
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.3)' }} />

          {/* LUT and Audio Controls */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'white', mb: 1 }}>
            LUT & Lydspor
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 1 }}>
            <InputLabel sx={{ color: 'white'}}>LUT</InputLabel>
            <Select 
              value={selectedLUT}
              onChange={(e) => setSelectedLUT(e.target.value)}
              size="small"
              sx={{
                color: 'white','& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }, '& .MuiSvgIcon-root': { color: 'white' }
              }}
            >
              <MenuItem value="rec709">Rec.709</MenuItem>
              <MenuItem value="log">Log</MenuItem>
              <MenuItem value="cinematic">Cinematic</MenuItem>
              <MenuItem value="natural">Natural</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={{ color: 'white'}}>Lydspor</InputLabel>
            <Select 
              value={selectedAudioFormat}
              onChange={(e) => setSelectedAudioFormat(e.target.value)}
              size="small"
              sx={{
                color: 'white','& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }, '& .MuiSvgIcon-root': { color: 'white' }
              }}
            >
              <MenuItem value="master">Master</MenuItem>
              <MenuItem value="stems">Stems</MenuItem>
              <MenuItem value="multicam">Multicam Sync</MenuItem>
              <MenuItem value="ambient">Ambient</MenuItem>
              <MenuItem value="music">Musikk</MenuItem>
            </Select>
          </FormControl>

          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<Delete />}
            onClick={() => {
              setConfirmDeleteDialog({
                open: true,
                count: selectedImages.size,
                type: 'video',
                onConfirm: () => {
                  executeBulkOperation('delete');
                  setConfirmDeleteDialog(prev => ({ ...prev, open: false }));
                }
              });
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              mb: 1,
              borderColor: 'rgba(255,255,255,0.24)',
              color: 'white','&:hover': { borderColor: '#', backgroundColor: 'rgba(25,205,210,0.1)' }
        }}
          >
            Slett valgte videoer
          </Button>

          <Button
            fullWidth
            variant="text"
            onClick={() => setSelectedImages(new Set())}
            sx={{
              color: 'rgba(255,255,255,0.82)',
              textTransform: 'none',
              fontWeight: 500}}
          >
            Avbryt valg
          </Button>
        </Box>
      )}

      {/* Floating Pricing Button - Simplified version */}
      {profession === 'photographer' && selectedImages.size === 0 && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 20,
            right:  20,
            p: 2,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
                  borderRadius: 2,
            zIndex: 10,
            minWidth: 280 }}
        >
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ShoppingCart />
              <Typography variant="body2">
                Velg bilder for å se priser
              </Typography>
            </Stack>
            
            <Stack direction="row" spacing={1}>
              <Button variant="contained"
                size="small"
                onClick={() => showWarningToast('Velg bilder først')}
                sx={{ bgcolor: 'success.main','&:hover': { bgcolor: 'success.dark' } }}
              >
                Se pris
              </Button>
              <Button variant="contained"
                size="small"
                onClick={() => showWarningToast('Velg bilder først')}
                startIcon={<Palette />}
                sx={{ 
                  bgcolor: '#ff6f00',
                  color: '#fff','&:hover': { bgcolor: '#e65100' },
                  fontSize: '0.75rem'
          }}
              >
                {(selectedImages.size as number) === 1 
                  ? 'Åpne i CreatorHub Photo Enhancer'
                  : `Rediger ${selectedImages.size} i CreatorHub Photo Enhancer`
            }
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
      
      {/* Professional Photo Editor Dialog - CreatorHub Photo Enhancer Integration */}
      <Dialog 
        open={showPhotoEditor}
        onClose={() => setShowPhotoEditor(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600}}>
            CreatorHub Photo Enhancer
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Valgte bilder: {selectedImages.size}
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Forbedringspreset</InputLabel>
            <Select 
              value={selectedPhotoPreset}
              onChange={(e) => setSelectedPhotoPreset(e.target.value)}
            >
              <MenuItem value="portrait">Portrett</MenuItem>
              <MenuItem value="landscape">Landskap</MenuItem>
              <MenuItem value="product">Produkt</MenuItem>
              <MenuItem value="wedding">Bryllup</MenuItem>
              <MenuItem value="custom">Tilpasset</MenuItem>
            </Select>
          </FormControl>

          {selectedPhotoPreset === 'custom' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Tilpassede innstillinger: </Typography>
              <TextField
                label="Lysstyrke"
                type="number"
                value={customEnhancementOptions.brightness}
                onChange={(e) => setCustomEnhancementOptions(prev => ({
                  ...prev, brightness: parseInt(e.target.value) || 0 }))}
                fullWidth
                sx={{ mb: 1 }}
              />
              <TextField
                label="Kontrast"
                type="number"
                value={customEnhancementOptions.contrast}
                onChange={(e) => setCustomEnhancementOptions(prev => ({
                  ...prev, contrast: parseFloat(e.target.value) || 1.0 }))}
                fullWidth
                sx={{ mb: 1 }}
              />
            </Box>
          )}

          {isEnhancing && (
            <LinearProgress 
              variant="determinate" 
              value={enhancementProgress}
              sx={{ mb: 2 }}
            />
          )}

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              onClick={() => {
                setShowPhotoEditor(false);
                setShowAdvancedPhotoSuite(true);
              }}
            >
              Åpne Photo Suite
            </Button>
            <Button onClick={() => setShowPhotoEditor(false)}>
              Avbryt
            </Button>
            <Button variant="contained" 
              onClick={applyPhotoEnhancements}
              disabled={isEnhancing}
            >
              {isEnhancing ? 'Forbedrer...' : 'Forbedre bilder'}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Professional Crop Dialog with Composition Guides */}
      <Dialog 
        open={showCropDialog}
        onClose={() => setShowCropDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600}}>
            Avansert beskjæring med komposisjonsguider
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Valgte bilder: {selectedImages.size}
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Sideforhold</InputLabel>
            <Select 
              value={cropAspectRatio}
              onChange={(e) => setCropAspectRatio(e.target.value)}
            >
              <MenuItem value="free">Fri beskjæring</MenuItem>
              <MenuItem value="1: 1">1:1 (Kvadrat)</MenuItem>
              <MenuItem value="4:3">4:3 (Standard)</MenuItem>
              <MenuItem value="16:9">16:9 (Widescreen)</MenuItem>
              <MenuItem value="3:2">3:2 (Foto standard)</MenuItem>
              <MenuItem value="5:4">5:4 (Print)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Komposisjonsguider</InputLabel>
            <Select 
              value={compositionOverlay}
              onChange={(e) => setCompositionOverlay(e.target.value)}
            >
              <MenuItem value="none">Ingen</MenuItem>
              <MenuItem value="rule-of-thirds">Tredjedelsregelen</MenuItem>
              <MenuItem value="golden-ratio">Gylne snitt</MenuItem>
              <MenuItem value="diagonals">Diagonaler</MenuItem>
              <MenuItem value="center">Senter linjer</MenuItem>
            </Select>
          </FormControl>

          {isProcessingEdit && (
            <LinearProgress sx={{ mb: 2 }} />
          )}

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button onClick={() => setShowCropDialog(false)}>
              Avbryt
            </Button>
            <Button variant="contained" 
              onClick={applyCropToImages}
              disabled={isProcessingEdit}
            >
              {isProcessingEdit ? 'Beskjærer...' : 'Beskjær bilder'}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Professional Watermark Dialog */}
      <Dialog 
        open={showWatermarkDialog}
        onClose={() => setShowWatermarkDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600}}>
            Profesjonell vannmerking
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Valgte bilder: {selectedImages.size}
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Vannmerke type</InputLabel>
            <Select 
              value={watermarkType}
              onChange={(e) => setWatermarkType(e.target.value as 'text' | 'logo' | 'both')}
            >
              <MenuItem value="text">Kun tekst</MenuItem>
              <MenuItem value="logo">Kun logo</MenuItem>
              <MenuItem value="both">Tekst og logo</MenuItem>
            </Select>
          </FormControl>

          {(watermarkType === 'text' || watermarkType === 'both') && (
            <TextField
              label="Vannmerke tekst"
              value={watermarkText}
              onChange={(e) => setWatermarkText((e.target as HTMLInputElement).value)}
              fullWidth
              sx={{ mb: 2 }}
              placeholder="© Ditt Fotografnavn"
            />
          )}

          {(watermarkType === 'logo' || watermarkType === 'both') && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Last opp logo: </Typography>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setWatermarkLogo(e.target.files?.[0] || null)}
              />
            </Box>
          )}

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Posisjon</InputLabel>
            <Select 
              value={watermarkPosition}
              onChange={(e) => setWatermarkPosition(e.target.value)}
            >
              <MenuItem value="top-left">Øverst til venstre</MenuItem>
              <MenuItem value="top-right">Øverst til høyre</MenuItem>
              <MenuItem value="bottom-left">Nederst til venstre</MenuItem>
              <MenuItem value="bottom-right">Nederst til høyre</MenuItem>
              <MenuItem value="center">Senter</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Gjennomsiktighet: {Math.round(watermarkOpacity * 10)}%
          </Typography>
          <Slider
            value={watermarkOpacity}
            onChange={(_, value) => setWatermarkOpacity(value as number)}
            min={0.1}
            max={1}
            step={0.1}
            sx={{ mb: 2 }}
          />

          {isApplyingWatermark && (
            <LinearProgress sx={{ mb: 2 }} />
          )}

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button onClick={() => setShowWatermarkDialog(false)}>
              Avbryt
            </Button>
            <Button variant="contained" 
              onClick={applyWatermark}
              disabled={isApplyingWatermark}
            >
              {isApplyingWatermark ? 'Setter vannmerke...' : 'Sett vannmerke'}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Video Editor Dialog - Videographer Professional Tools */}
      <Dialog 
        open={showVideoEditor}
        onClose={() => setShowVideoEditor(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <MovieCreation />
          CreatorHub Video Editor - Versjon {videoVersion}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600}}>
            Profesjonell video redigering
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Valgte videoer: {selectedVideoIds.length}
          </Typography>

          {selectedPrimaryVideoUrl ? (
            <Box
              component="video"
              src={selectedPrimaryVideoUrl}
              controls
              onLoadedMetadata={(event: React.SyntheticEvent<HTMLVideoElement>) => {
                setVideoDuration(event.currentTarget.duration || 0);
              }}
              onTimeUpdate={(event: React.SyntheticEvent<HTMLVideoElement>) => {
                setVideoCurrentTime(event.currentTarget.currentTime || 0);
              }}
              sx={{
                width: '100%',
                maxHeight: 360,
                borderRadius: 2,
                mb: 3,
                bgcolor: '#000',
              }}
            />
          ) : (
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(0,0,0,0.04)' }}>
              <Typography variant="body2" color="text.secondary">
                Velg en video med forhåndsvisning for å redigere den i showcase-editoren.
              </Typography>
            </Paper>
          )}

          {/* Video Duration and Playback Controls */}
          {videoDuration > 0 && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                Video Duration: {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toString().padStart(2, '0')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="caption">Playback:</Typography>
                <Slider
                  value={videoCurrentTime}
                  max={videoDuration}
                  onChange={(_, value) => setVideoCurrentTime(value as number)}
                  sx={{ flex: 1 }}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${Math.floor(value)}s`}
                />
                <Typography variant="caption">
                  {Math.floor(videoCurrentTime)}s
                </Typography>
              </Box>
            </Box>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.333%' }, maxWidth: { xs: '100%', md: '33.333%' } }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Sekvens</InputLabel>
                <Select 
                  value={selectedSequence || ''}
                  onChange={(e) => {
                    const nextSequenceId = e.target.value;
                    setSelectedSequence(nextSequenceId || null);
                    const nextSequence = videoSequences.find((sequence) => sequence.id === nextSequenceId);
                    setSelectedChapter(nextSequence?.chapters[0] || null);
                  }}
                >
                  {videoSequences.length > 0 ? (
                    videoSequences.map((sequence) => (
                      <MenuItem key={sequence.id} value={sequence.id}>
                        {sequence.sequenceName}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>
                      Opprett en sekvens først
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.333%' }, maxWidth: { xs: '100%', md: '33.333%' } }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Kapittel</InputLabel>
                <Select 
                  value={selectedChapter || ''}
                  onChange={(e) => setSelectedChapter(e.target.value || null)}
                >
                  {selectedSequenceChapters.length > 0 ? (
                    selectedSequenceChapters.map((chapter) => (
                      <MenuItem key={chapter} value={chapter}>
                        {chapter}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>
                      Velg en sekvens med kapitler
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.333%' }, maxWidth: { xs: '100%', md: '33.333%' } }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>LUT</InputLabel>
                <Select 
                  value={selectedLUT}
                  onChange={(e) => setSelectedLUT(e.target.value)}
                >
                  <MenuItem value="rec709">Rec.709 Standard</MenuItem>
                  <MenuItem value="log">Log Profile</MenuItem>
                  <MenuItem value="cinematic">Cinematic Look</MenuItem>
                  <MenuItem value="natural">Natural Color</MenuItem>
                  <MenuItem value="custom">Custom LUT</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600}}>
            Tidskodede kommentarer
          </Typography>
          
          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Klikk på ønsket tidspunkt i videoen for å legge til kommentarer: </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Skriv kommentar her og trykk Enter"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLInputElement;
                  addTimecodedComment(videoCurrentTime, target.value);
                  target.value = '';
            }
          }}
            />
          </Box>

          {timecodedComments.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Eksisterende kommentarer: </Typography>
              {timecodedComments.map((comment) => (
                <Chip 
                  key={comment.id}
                  label={`${comment.timecode}s: ${comment.comment}`}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => {
              setShowVideoEditor(false);
              setShowAdvancedVideoSuite(true);
            }}
          >
            Åpne Video Suite
          </Button>
          <Button onClick={() => setShowVideoEditor(false)}>
            Lukk
          </Button>
          <Button variant="contained" 
            startIcon={<MovieCreation />}
            sx={{ bgcolor: '#E74C3C' }}
            onClick={openResolveHandoff}
          >
            Åpne i DaVinci Resolve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sequence Manager Dialog */}
      <Dialog 
        open={showSequenceManager}
        onClose={() => setShowSequenceManager(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <TimelineIcon />
          Sekvens & Kapittel Manager
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600}}>
            Prosjektstruktur: Sekvenser → Kapitler
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 50%' }, maxWidth: { xs: '100%', md: '50%' } }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600}}>
                Sekvenser
              </Typography>
              <List>
                {videoSequences.length > 0 ? (
                  videoSequences.map((sequence) => (
                    <ListItem
                      key={sequence.id}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          onClick={() => {
                            setSelectedSequence(sequence.id);
                            setSelectedChapter(sequence.chapters[0] || null);
                          }}
                        >
                          <Edit />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={sequence.sequenceName}
                        secondary={`${sequence.chapters.length} kapittel${sequence.chapters.length !== 1 ? 'er' : ''} • ${sequence.version}`}
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText
                      primary="Ingen sekvenser ennå"
                      secondary="Opprett første sekvens for valgt video"
                    />
                  </ListItem>
                )}
              </List>
              <TextField
                fullWidth
                size="small"
                label="Sekvensnavn"
                value={newSequenceName}
                onChange={(event) => setNewSequenceName(event.target.value)}
                sx={{ mb: 1 }}
              />
              <Button 
                startIcon={<Add />}
                onClick={async () => {
                  const sequence = await createVideoSequence(
                    newSequenceName.trim() || 'Ny sekvens',
                    newChapterTitle.trim() ? [newChapterTitle.trim()] : [],
                  );
                  if (sequence) {
                    setNewSequenceName('Ny sekvens');
                    setNewChapterTitle('');
                  }
                }}
                sx={{ mt: 1 }}
              >
                Legg til sekvens
              </Button>
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 50%' }, maxWidth: { xs: '100%', md: '50%' } }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600}}>
                Kapitler i valgt sekvens
              </Typography>
              <List>
                {selectedSequenceRecord ? (
                  selectedSequenceRecord.chapters.map((chapter) => (
                    <ListItem
                      key={chapter}
                      secondaryAction={
                        <IconButton edge="end" onClick={() => setSelectedChapter(chapter)}>
                          <Edit />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={chapter}
                        secondary={chapter === selectedChapter ? 'Valgt kapittel' : 'Klikk for å aktivere'}
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText
                      primary="Ingen kapitler tilgjengelig"
                      secondary="Velg eller opprett en sekvens først"
                    />
                  </ListItem>
                )}
              </List>
              <TextField
                fullWidth
                size="small"
                label="Nytt kapittel"
                value={newChapterTitle}
                onChange={(event) => setNewChapterTitle(event.target.value)}
                sx={{ mb: 1 }}
              />
              <Button
                startIcon={<Add />}
                sx={{ mt: 1 }}
                onClick={() => {
                  if (!newChapterTitle.trim() || !selectedSequence) {
                    showWarningToast('Velg sekvens og skriv inn kapittelnavn.');
                    return;
                  }

                  setVideoSequences((prev) =>
                    prev.map((sequence) =>
                      sequence.id === selectedSequence
                        ? {
                            ...sequence,
                            chapters: [...sequence.chapters, newChapterTitle.trim()],
                          }
                        : sequence,
                    ),
                  );
                  setSelectedChapter(newChapterTitle.trim());
                  setNewChapterTitle('');
                }}
              >
                Legg til kapittel
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSequenceManager(false)}>
            Lukk
          </Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#E74C3C' }}
            onClick={() => {
              downloadJsonArtifact(`video-structure-${selectedItem?.id || Date.now()}.json`, {
                generatedAt: new Date().toISOString(),
                sequences: videoSequences,
                selectedSequence,
                selectedChapter,
              });
              showSuccessToast('Videostruktur eksportert.');
            }}
          >
            Lagre struktur
          </Button>
        </DialogActions>
      </Dialog>

      {/* Video Export Dialog */}
      <Dialog 
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <HighQuality />
          Video Eksport - {videoVersion}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600}}>
            Eksport innstillinger
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Kvalitet preset</InputLabel>
            <Select defaultValue="4k">
              <MenuItem value="4k">4K UHD (3840x2160)</MenuItem>
              <MenuItem value="1080p">Full HD (1920x1080)</MenuItem>
              <MenuItem value="720p">HD (1280x720)</MenuItem>
              <MenuItem value="proxy">Proxy (640x360)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Codec</InputLabel>
            <Select defaultValue="h264">
              <MenuItem value="h264">H.264 (MP4)</MenuItem>
              <MenuItem value="h265">H.265 (HEVC)</MenuItem>
              <MenuItem value="prores">Apple ProRes</MenuItem>
              <MenuItem value="dnxhd">Avid DNxHD</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Bitrate</InputLabel>
            <Select defaultValue="high">
              <MenuItem value="high">Høy kvalitet (50 Mbps)</MenuItem>
              <MenuItem value="medium">Medium kvalitet (25 Mbps)</MenuItem>
              <MenuItem value="low">Lav kvalitet (10 Mbps)</MenuItem>
              <MenuItem value="custom">Tilpasset</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={<Checkbox defaultChecked />}
            label="Inkluder tidskodede kommentarer som undertekster"
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={<Checkbox />}
            label="Eksporter til YouTube samtidig"
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>
            Avbryt
          </Button>
          <FileStatusWrapper showFileSystem showGoogleDrive>
            <Button variant="contained" 
              onClick={() => exportVideoWithPreset('4k')}
              startIcon={<CloudUpload />}
              sx={{ bgcolor: '#E74C3C' }}
            >
              Start eksport
            </Button>
          </FileStatusWrapper>
        </DialogActions>
      </Dialog>
      
      {/* NEW ADVANCED VIDEOGRAPHER DIALOGS */}

      {/* Proxy Generator Dialog */}
      <Dialog open={showProxyGenerator} onClose={() => setShowProxyGenerator(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <Layers />
          Automatisk Proxy-generering
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Generer lette proxy-filer for smidig redigering av {selectedVideoIds.length} video{selectedVideoIds.length !== 1 ? 'er' : ','}
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Proxy Kvalitet</InputLabel>
            <Select
              value={proxyQuality}
              onChange={(event) => setProxyQuality(event.target.value as ProxyQuality)}
              label="Proxy Kvalitet"
            >
              <MenuItem value="480p-h264">480p H.264 (Rask)</MenuItem>
              <MenuItem value="720p-h264">720p H.264 (Balansert)</MenuItem>
              <MenuItem value="720p-prores">720p ProRes Proxy (Anbefalt)</MenuItem>
              <MenuItem value="1080p-h264">1080p H.264 (Høy kvalitet)</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={keepOriginalProxyFiles}
                onChange={(event) => setKeepOriginalProxyFiles(event.target.checked)}
              />
            }
            label="Behold original filer"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProxyGenerator(false)}>Avbryt</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#E74C3C' }}
            onClick={startProxyGeneration}
          >
            Generer Proxy-filer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Multicam Sync Dialog */}
      <Dialog open={showMulticamSync} onClose={() => setShowMulticamSync(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <VolumeUp />
          Multicam Audio Sync
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Synkroniser {selectedVideoIds.length} kamera{selectedVideoIds.length !== 1 ? 'er' : ', '} basert på audio waveform matching
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Master Audio Kilde</InputLabel>
            <Select
              value={multicamMasterSource}
              onChange={(event) => setMulticamMasterSource(event.target.value as MulticamAudioSource)}
              label="Master Audio Kilde"
            >
              <MenuItem value="camera1">Kamera 1</MenuItem>
              <MenuItem value="camera2">Kamera 2</MenuItem>
              <MenuItem value="external">Ekstern opptaker</MenuItem>
              <MenuItem value="auto">Auto-detect</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mb:  2 }}>
              <Typography gutterBottom>Sync Presisjon</Typography>
              <Slider
                value={multicamSyncPrecision}
                onChange={(_, value) => setMulticamSyncPrecision(value as number)}
                min={80}
                max={100}
                step={1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMulticamSync(false)}>Avbryt</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#E74C3C' }}
            onClick={startMulticamSyncJob}
          >
            Synkroniser Cameras
          </Button>
        </DialogActions>
      </Dialog>

      {/* Chapter Marker Dialog */}
      <Dialog open={showChapterMarker} onClose={() => setShowChapterMarker(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <Subtitles />
          Kapittelmarkører & Auto-splitt
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Lag automatiske kapittelmarkører for {selectedVideoIds.length} video{selectedVideoIds.length !== 1 ? 'er' : ', '}
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Bryllup Kategori</InputLabel>
            <Select
              value={selectedWeddingPackage}
              onChange={(event) => setSelectedWeddingPackage(event.target.value as WeddingPackageOption)}
              label="Bryllup Kategori"
            >
              <MenuItem value="highlight">Highlight Reel</MenuItem>
              <MenuItem value="feature">Feature Film</MenuItem>
              <MenuItem value="ceremony">Seremoni full</MenuItem>
              <MenuItem value="speeches">Taler og takk</MenuItem>
              <MenuItem value="teaser">Teaser/Trailer</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mb:  2 }}>
            <Typography gutterBottom>Minimum kapittel-lengde (sekunder)</Typography>
            <Slider
              value={chapterMinimumSeconds}
              onChange={(_, value) => setChapterMinimumSeconds(value as number)}
              min={10}
              max={120}
              step={10}
              valueLabelDisplay="auto"
              marks={[
                { value:  10, label: '10s',},
                { value:  30, label: '30s',},
                { value:  60, label: '1m',},
                { value: 120, label: '2m',}
              ]}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowChapterMarker(false)}>Avbryt</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#E74C3C' }}
            onClick={createChapterMarkers}
          >
            Opprett Kapitler
          </Button>
        </DialogActions>
      </Dialog>

      {/* Version Comparison Dialog */}
      <Dialog open={showVersionComparison} onClose={() => setShowVersionComparison(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <TimelineIcon />
          Side-by-side Versjon Sammenligning
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Typography variant="h6" gutterBottom>Versjon A - {videoVersion}</Typography>
              {selectedPrimaryVideoUrl ? (
                <Box
                  component="video"
                  src={selectedPrimaryVideoUrl}
                  controls
                  sx={{ width: '100%', bgcolor: '#000', aspectRatio: '16/9', borderRadius: 1 }}
                />
              ) : (
                <Box sx={{ bgcolor: '#000', aspectRatio: '16/9', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="white">Ingen videoforhandsvisning tilgjengelig</Typography>
                </Box>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setVideoVersion('R1');
                    setShowVideoEditor(true);
                    setShowVersionComparison(false);
                  }}
                >
                  Frame-kommentar
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setShowComments(true);
                    setShowVersionComparison(false);
                  }}
                >
                  @Mention
                </Button>
              </Stack>
            </Box>
            <Box sx={{ flex: { xs: '1 1 50%' }, maxWidth: { xs: '50%' } }}>
              <Typography variant="h6" gutterBottom>Versjon B - Final</Typography>
              {selectedPrimaryVideoUrl ? (
                <Box
                  component="video"
                  src={selectedPrimaryVideoUrl}
                  controls
                  sx={{ width: '100%', bgcolor: '#000', aspectRatio: '16/9', borderRadius: 1 }}
                />
              ) : (
                <Box sx={{ bgcolor: '#000', aspectRatio: '16/9', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="white">Ingen videoforhandsvisning tilgjengelig</Typography>
                </Box>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setVideoVersion('Final');
                    setShowVideoEditor(true);
                    setShowVersionComparison(false);
                  }}
                >
                  Frame-kommentar
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setShowComments(true);
                    setShowVersionComparison(false);
                  }}
                >
                  @Mention
                </Button>
              </Stack>
            </Box>
          </Box>
          
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>Endringsrunder</Typography>
            <List>
              {versionComparisonEntries.length > 0 ? (
                versionComparisonEntries.map((entry) => (
                  <ListItem key={entry.id}>
                    <Chip
                      label={
                        entry.status === 'resolved'
                          ? 'Løst'
                          : entry.status === 'open'
                            ? 'Åpen'
                            : 'Under arbeid'
                      }
                      color={
                        entry.status === 'resolved'
                          ? 'success'
                          : entry.status === 'open'
                            ? 'error'
                            : 'warning'
                      }
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <ListItemText primary={entry.primary} secondary={entry.secondary} />
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText
                    primary="Ingen endringsrunder registrert"
                    secondary="Legg til tidskodede kommentarer for å bygge sammenligningshistorikk"
                  />
                </ListItem>
              )}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVersionComparison(false)}>Lukk</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#E74C3C' }}
            onClick={exportVersionComparisonReport}
          >
            Eksporter Sammenligning
          </Button>
        </DialogActions>
      </Dialog>

      {/* Render Presets Dialog */}
      <Dialog open={showRenderPresets} onClose={() => setShowRenderPresets(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <HighQuality />
          Render Presets & Eksport
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Velg render preset for {selectedImages.size} video{selectedImages.size !== 1 ? 'er' : ', '}
          </Typography>
          
                <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Render Preset</InputLabel>
            <Select value={selectedPreset} onChange={(e) => setSelectedPreset((e.target as HTMLSelectElement).value as '4k-master' | 'web-h264' | 'social-vertical' | 'custom')} label="Render Preset">
              <MenuItem value="4k-master">4K Master (Production)</MenuItem>
              <MenuItem value="web-h264">Web H.264 (YouTube/Vimeo)</MenuItem>
              <MenuItem value="social-vertical">SoMe Vertikal (Instagram/TikTok)</MenuItem>
              <MenuItem value="custom">Tilpasset</MenuItem>
            </Select>
          </FormControl>

          {selectedPreset === '4k-master' && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.light' }}>
              <Typography variant="body2">
                4K Master: ProRes 422 Q, 3840x2160, 23.98fps - For arkiv og fremtidig redigering
              </Typography>
            </Paper>
          )}

          {isProcessingVideo && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={processingProgress} sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Prosesserer: {processingProgress}% fullført
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRenderPresets(false)} disabled={isProcessingVideo}>Avbryt</Button>
          <Button variant="contained" 
            sx={{ bgcolor: '#E74C3C' }}
            disabled={isProcessingVideo}
            startIcon={isProcessingVideo ? <CircularProgress size={20} /> : <HighQuality />}
            onClick={() => startVideoProcessing('render')}
          >
            {isProcessingVideo ? 'Rendrer...' : 'Start Rendering'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Video Watermark Dialog */}
      <Dialog open={showVideoWatermarkDialog} onClose={() => setShowVideoWatermarkDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <Copyright />
          Video vannmerke
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={watermarkType}
                onChange={(e) => setWatermarkType(e.target.value as 'text' | 'logo' | 'both')}
                label="Type"
              >
                <MenuItem value="text">Tekst</MenuItem>
                <MenuItem value="logo">Logo</MenuItem>
                <MenuItem value="both">Tekst + Logo</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Vannmerke tekst"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
            />

            <FormControl fullWidth>
              <InputLabel>Posisjon</InputLabel>
              <Select
                value={watermarkPosition}
                onChange={(e) => setWatermarkPosition(e.target.value)}
                label="Posisjon"
              >
                <MenuItem value="top-left">Øverst til venstre</MenuItem>
                <MenuItem value="top-right">Øverst til høyre</MenuItem>
                <MenuItem value="bottom-left">Nederst til venstre</MenuItem>
                <MenuItem value="bottom-right">Nederst til høyre</MenuItem>
                <MenuItem value="center">Midt på bildet</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography gutterBottom>Gjennomsiktighet</Typography>
              <Slider
                value={watermarkOpacity}
                onChange={(_, value) => setWatermarkOpacity(value as number)}
                min={0.1}
                max={1.0}
                step={0.05}
                valueLabelDisplay="auto"
              />
            </Box>

            {(watermarkType === 'logo' || watermarkType === 'both') && (
              <Box>
                <Button component="label" variant="outlined" startIcon={<CloudUpload />}>
                  {watermarkLogo ? `Logo valgt: ${watermarkLogo.name}` : 'Last opp logo'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => setWatermarkLogo(e.target.files?.[0] || null)}
                  />
                </Button>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVideoWatermarkDialog(false)} disabled={isProcessingVideo}>Avbryt</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#E74C3C' }}
            disabled={isProcessingVideo}
            onClick={() => {
              if ((watermarkType === 'logo' || watermarkType === 'both') && !watermarkLogo) {
                showWarningToast('Last opp en logo for vannmerket');
                return;
              }
              startVideoProcessing('watermark');
            }}
            startIcon={isProcessingVideo ? <CircularProgress size={20} /> : <WaterDrop />}
          >
            {isProcessingVideo ? 'Behandler...' : 'Start vannmerking'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Streaming Setup Dialog */}
      <Dialog open={showStreamingSetup} onClose={() => setShowStreamingSetup(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <OpenInNew />
          Streaming Setup (HLS/DASH)
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Konfigurer streaming for {selectedVideoIds.length} video{selectedVideoIds.length !== 1 ? 'er' : ', '}
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Streaming Protocol</InputLabel>
            <Select
              value={streamingProtocol}
              onChange={(event) => setStreamingProtocol(event.target.value as StreamingProtocol)}
              label="Streaming Protocol"
            >
              <MenuItem value="hls">HLS (HTTP Live Streaming)</MenuItem>
              <MenuItem value="dash">DASH (Dynamic Adaptive Streaming)</MenuItem>
              <MenuItem value="webrtc">WebRTC (Sanntid)</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="h6" sx={{ mb: 2 }}>Adaptive Bitrate Ladder</Typography>
          <List>
            <ListItem>
              <Checkbox
                checked={streamingBitrateProfiles.includes('4k')}
                onChange={(event) =>
                  setStreamingBitrateProfiles((prev) =>
                    event.target.checked
                      ? Array.from(new Set([...prev, '4k']))
                      : prev.filter((profile) => profile !== '4k'),
                  )
                }
              />
              <ListItemText primary="4K - 25 Mbps" secondary="For høyhastighets forbindelser" />
            </ListItem>
            <ListItem>
              <Checkbox
                checked={streamingBitrateProfiles.includes('1080p')}
                onChange={(event) =>
                  setStreamingBitrateProfiles((prev) =>
                    event.target.checked
                      ? Array.from(new Set([...prev, '1080p']))
                      : prev.filter((profile) => profile !== '1080p'),
                  )
                }
              />
              <ListItemText primary="1080p - 8 Mbps" secondary="Standard HD streaming" />
            </ListItem>
            <ListItem>
              <Checkbox
                checked={streamingBitrateProfiles.includes('720p')}
                onChange={(event) =>
                  setStreamingBitrateProfiles((prev) =>
                    event.target.checked
                      ? Array.from(new Set([...prev, '720p']))
                      : prev.filter((profile) => profile !== '720p'),
                  )
                }
              />
              <ListItemText primary="720p - 3 Mbps" secondary="For mobile enheter" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowStreamingSetup(false)}>Avbryt</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#E74C3C' }}
            onClick={configureStreamingJob}
          >
            Konfigurer Streaming
          </Button>
        </DialogActions>
      </Dialog>

      {/* Wedding Packages Dialog */}
      <Dialog open={showWeddingPackages} onClose={() => setShowWeddingPackages(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <Favorite />
          Bryllup Pakker & Kategorier
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Organiser {selectedManagedItems.length} element{selectedManagedItems.length !== 1 ? 'er' : ''} i bryllup-spesifikke kategorier
          </Typography>
          
          <RadioGroup
            value={selectedWeddingPackage}
            onChange={(event) => setSelectedWeddingPackage(event.target.value as WeddingPackageOption)}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {weddingPackageOptions.map((option) => (
                <Box key={option} sx={{ flex: { xs: '1 1 100%', md: '1 1 50%' }, maxWidth: { xs: '100%', md: '50%' } }}>
                  <Paper
                    onClick={() => setSelectedWeddingPackage(option)}
                    sx={{
                      p: 2,
                      mb: 2,
                      cursor: 'pointer',
                      border: selectedWeddingPackage === option ? '2px solid #E74C3C' : '1px solid rgba(0,0,0,0.08)',
                      bgcolor: selectedWeddingPackage === option ? 'rgba(231,76,60,0.08)' : undefined,
                    }}
                  >
                    <FormControlLabel
                      value={option}
                      control={<Radio />}
                      label={weddingPackageLabels[option]}
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {option === 'highlight'
                        ? '3-5 minutters sammendrag av høydepunktene'
                        : option === 'feature'
                          ? '15-30 minutters dokumentarisk film'
                          : option === 'ceremony'
                            ? 'Komplett seremoni uten redigering'
                            : option === 'speeches'
                              ? 'Alle taler og takk separat'
                              : 'Kort trailer for deling og teaser'}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      {(option === 'highlight'
                        ? ['Musikk', 'Fast tempo', 'Folelser']
                        : option === 'feature'
                          ? ['Fortelling', 'Taler', 'Seremoni']
                          : option === 'ceremony'
                            ? ['Uklippt', 'Arkiv', 'Familie']
                            : option === 'speeches'
                              ? ['Audio focus', 'Undertekster', 'Chaptered']
                              : ['Kortformat', 'Delbar', 'SoMe'])
                        .map((label) => (
                          <Chip key={label} label={label} size="small" />
                        ))}
                    </Stack>
                  </Paper>
                </Box>
              ))}
            </Box>
          </RadioGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWeddingPackages(false)}>Lukk</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#E74C3C' }}
            onClick={applyWeddingPackageOrganization}
          >
            Organiser i Pakker
          </Button>
        </DialogActions>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={showAnalytics} onClose={() => setShowAnalytics(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#E74C3C', color: 'white' }}>
          <CloudDownload />
          Video Analyse & Rapporter
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.333%' }, maxWidth: { xs: '100%', md: '33.333%' } }}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {selectedVideoIds.length}
                </Typography>
                <Typography variant="body2">Videoer analysert</Typography>
              </Paper>
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.333%' }, maxWidth: { xs: '100%', md: '33.333%' } }}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {videoDurationSummary.formatted}
                </Typography>
                <Typography variant="body2">Total lengde</Typography>
              </Paper>
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.333%' }, maxWidth: { xs: '100%', md: '33.333%' } }}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {averageFrameRate ? `${averageFrameRate.toFixed(2)} fps` : 'Ingen FPS-data'}
                </Typography>
                <Typography variant="body2">Gjennomsnittlig framerate</Typography>
              </Paper>
            </Box>
          </Box>

          {(evendiBookings.length > 0 || evendiAnalytics) && (
            <>
              <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Evendi Booking Insights</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.333%' }, maxWidth: { xs: '100%', md: '33.333%' } }}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {evendiSummary.totalBookings}
                    </Typography>
                    <Typography variant="body2">Totale bookinger</Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.333%' }, maxWidth: { xs: '100%', md: '33.333%' } }}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {evendiSummary.totalRevenue.toLocaleString('no-NO')} kr
                    </Typography>
                    <Typography variant="body2">Inntekt fra Evendi</Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.333%' }, maxWidth: { xs: '100%', md: '33.333%' } }}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {evendiSummary.upcomingEvents}
                    </Typography>
                    <Typography variant="body2">Kommende eventer</Typography>
                  </Paper>
                </Box>
              </Box>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
                {evendiSummary.statusCounts.map((status) => {
                  const statusColor: 'default' | 'success' | 'warning' | 'error' | 'info' =
                    status.status === 'confirmed'
                      ? 'success'
                      : status.status === 'pending'
                        ? 'warning'
                        : status.status === 'cancelled'
                          ? 'error'
                          : 'info';
                  return (
                    <Chip
                      key={status.status}
                      label={`${status.status}: ${status.count}`}
                      color={statusColor}
                      size="small"
                      variant="outlined"
                    />
                  );
                })}
              </Stack>

              {evendiUpcomingBookings.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Neste bookinger
                  </Typography>
                  <List dense>
                    {evendiUpcomingBookings.map((booking, idx) => (
                      <React.Fragment key={booking.id}>
                        <ListItem>
                          <ListItemText
                            primary={booking.title || booking.clientName}
                            secondary={`${booking.clientName} • ${new Date(booking.eventDate).toLocaleDateString('no-NO')}`}
                          />
                          <Chip
                            size="small"
                            label={booking.status}
                            color={
                              booking.status === 'confirmed'
                                ? 'success'
                                : booking.status === 'pending'
                                  ? 'warning'
                                  : booking.status === 'completed'
                                    ? 'info'
                                    : 'error'
                            }
                            variant="outlined"
                          />
                        </ListItem>
                        {idx < evendiUpcomingBookings.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </Box>
              )}
            </>
          )}

          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>Kvalitetsmetrikker</Typography>
          <List>
            <ListItem>
              <ListItemText 
                primary="Metadata-dekning" 
                secondary={`${metadataCoverage}% av valgt materiale har kategori, beskrivelse eller tags`}
              />
              <Chip
                label={metadataCoverage >= 80 ? 'Sterk' : metadataCoverage >= 50 ? 'OK' : 'Mangelfull'}
                color={metadataCoverage >= 80 ? 'success' : metadataCoverage >= 50 ? 'warning' : 'error'}
                size="small"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Sekvensdekning" 
                secondary={`${videoSequences.length} sekvens${videoSequences.length !== 1 ? 'er' : ''} og ${videoSequences.reduce((sum, sequence) => sum + sequence.chapters.length, 0)} kapittel registrert`}
              />
              <Chip
                label={videoSequences.length > 0 ? 'Klar' : 'Tom'}
                color={videoSequences.length > 0 ? 'success' : 'warning'}
                size="small"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Kommentarflyt" 
                secondary={`${timecodedComments.length} tidskodede kommentar${timecodedComments.length !== 1 ? 'er' : ''} for gjennomgang og revisjon`}
              />
              <Chip
                label={timecodedComments.length > 0 ? 'Aktiv' : 'Ingen'}
                color={timecodedComments.length > 0 ? 'info' : 'default'}
                size="small"
              />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalytics(false)}>Lukk</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#E74C3C' }}
            onClick={() => {
              downloadJsonArtifact(`video-analytics-${selectedPrimaryVideo?.id || Date.now()}.json`, {
                generatedAt: new Date().toISOString(),
                selection: selectedVideoIds,
                totalDurationSeconds: videoDurationSummary.totalSeconds,
                averageFrameRate,
                metadataCoverage,
                sequenceCount: videoSequences.length,
                chapterCount: videoSequences.reduce((sum, sequence) => sum + sequence.chapters.length, 0),
                commentCount: timecodedComments.length,
                evendiSummary,
              });
            }}
          >
            Eksporter Rapport
          </Button>
        </DialogActions>
      </Dialog>

      {/* FASE 2: Client Authentication Dialog , *, /}
      {showAuthDialog && (
        <React.Suspense fallback={<div>Laster autentisering...</div>}>
          <ClientAuthDialog
            open={showAuthDialog}
            onClose={() => setShowAuthDialog(false)}
            onAuthenticated={handleAuthenticationSuccess}
            sessionToken={sessionIdd || ', '}
            requiresPin={sessionRequiresAuth}
            requiresPassword={authSessionData?.requiresPassword || false}
            lockoutUntil={authSessionData?.lockoutUntil}
            maxAttempts={authSessionData?.maxLoginAttempts || 3}
          />
        </React.Suspense>
      )}

      {/* CreatorHub Video Suite Dialog */}
      {showAdvancedVideoSuite && profession === 'videographer' && (
        <React.Suspense fallback={<div>Laster CreatorHub Video Suite...</div>}>
          <VideographerVideoSuite
            selectedVideoFiles={selectedVideoItems.map((item) => ({
              id: item.id,
              name: item.title,
              url: item.fileUrl || item.thumbnailUrl,
              thumbnailUrl: item.thumbnailUrl,
              duration: item.duration,
            }))}
            onClose={() => setShowAdvancedVideoSuite(false)}
          />
        </React.Suspense>
      )}

      {/* CreatorHub Photo Suite Dialog */}
      {showAdvancedPhotoSuite && profession === 'photographer' && (
        <React.Suspense fallback={<div>Laster CreatorHub Photo Suite...</div>}>
          <PhotographerPhotoSuite
            selectedPhotoFiles={selectedPhotoItems.map((item) => ({
              id: item.id,
              name: item.title,
              url: item.fileUrl || item.thumbnailUrl,
              thumbnailUrl: item.thumbnailUrl,
            }))}
            onClose={() => setShowAdvancedPhotoSuite(false)}
            selectedProject={selectedProject}
          />
        </React.Suspense>
      )}

      {/* Google Photos Integration Dialog */}
      <Dialog 
        open={showGooglePhotosDialog}
        onClose={() => setShowGooglePhotosDialog(false)}
        maxWidth="md" 
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          <AppBar position="static" sx={{ bgcolor: theme.palette.primary.main }}>
            <Toolbar>
              <Box 
                component="img" 
                src="https://fonts.gstatic.com/s/i/productlogos/photos/v14/24px.svg"
                alt="Google Photos"
                sx={{ width: 24, height: 24, mr: 2 }}
              />
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Google Photos Integrasjon
              </Typography>
              <IconButton color="inherit" onClick={() => setShowGooglePhotosDialog(false)}>
                <Close />
              </IconButton>
            </Toolbar>
          </AppBar>
          
          <Container sx={{ py: 3 }}>
            {!googlePhotosConnected ? (
              <Box textAlign="center" sx={{ py: 4 }}>
                <Box 
                  component="img" 
                  src="https://fonts.gstatic.com/s/i/productlogos/photos/v14/192px.svg"
                  alt="Google Photos"
                  sx={{ width: 64, height: 64, mb: 2 }}
                />
                <Typography variant="h6" gutterBottom>
                  Koble til Google Photos
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Synkroniser bilder fra Google Photos direkte til din showcase
                </Typography>
                <Button variant="contained"
                  size="large"
                  startIcon={
                    <Box 
                      component="img" 
                      src="https://fonts.gstatic.com/s/i/productlogos/photos/v14/24px.svg"
                      alt="Google Photos"
                      sx={{ width: 20, height: 20 }}
                    />
                  }
                  sx={{
                    bgcolor: theme.palette.primary.main,
                    '&:hover': { bgcolor: '#3367d6' },
                    fontWeight: 500,
                    textTransform: 'none'
                  }}
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/google-photos/auth');
                      const data = await response.json();
                      if (data.authUrl) {
                        window.open(data.authUrl, '_blank');
                      }
                    } catch (error) {
                      console.error('Google Photos auth error:', error);
                    }
                  }}
                >
                  Autoriser Google Photos
                </Button>
              </Box>
            ) : (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box 
                    component="img" 
                    src="https://fonts.gstatic.com/s/i/productlogos/photos/v14/24px.svg"
                    alt="Google Photos"
                    sx={{ width: 24, height: 24 }}
                  />
                  Google Photos tilkoblet
                  <CheckCircle sx={{ color: 'success.main', ml: 1 }} />
                </Typography>
                
                {/* Album Selection */}
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Velg Album</InputLabel>
                  <Select
                    value={selectedGoogleAlbum || ', '}
                    onChange={(e) => setSelectedGoogleAlbum(e.target.value)}
                    label="Velg Album"
                  >
                    {googlePhotosAlbums.map((album: { id: string; title: string; count: number; mediaItemsCount?: number }) => (
                      <MenuItem key={album.id} value={album.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box 
                            component="img" 
                            src="https://fonts.gstatic.com/s/i/productlogos/photos/v14/24px.svg"
                            alt="Google Photos"
                            sx={{ width: 20, height: 20 }}
                          />
                          <Box>
                            <Typography variant="body1">{album.title}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {album.mediaItemsCount} bilder
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Photos Grid */}
                {selectedGoogleAlbum && googlePhotosItems.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Bilder fra album ({googlePhotosItems.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, maxHeight: 400, overflow: 'auto', mb: 3 }}>
                      {googlePhotosItems.slice(0, 12).map((photo: { id: string; baseUrl: string; filename?: string }) => (
                        <Box sx={{ flex: { xs: '1 1 50%', sm: '1 1 33.333%', md: '1 1 25%' }, maxWidth: { xs: '50%', sm: '33.333%', md: '25%' } }} key={photo.id}>
                          <Card sx={{ cursor: 'pointer','&:hover': { transform: 'scale(1.05)' } }}>
                            <CardMedia
                              component="img"
                              height="120"
                              image={photo.baseUrl}
                              alt={`Google Photos: ${photo.filename || 'Bilde'} - Importert fra Google Photos`}
                              loading="lazy"
                              sx={{ 
                                objectFit: 'cover',
                                transition: 'opacity 0.3s ease'
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=120&h=120&fit=crop';
                              }}
                            />
                          </Card>
                        </Box>
                      ))}
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                      <Button variant="contained"
                        startIcon={
                          <Box 
                            component="img" 
                            src="https://fonts.gstatic.com/s/i/productlogos/photos/v14/24px.svg"
                            alt="Google Photos"
                            sx={{ width: 20, height: 20 }}
                          />
                        }
                        onClick={syncWithGooglePhotos}
                        disabled={showGooglePhotosSync}
                        sx={{ 
                          bgcolor: theme.palette.primary.main,
                          fontWeight: 500,
                          textTransform: 'none','&:hover': { bgcolor: '#3367d6' }
                        }}
                      >
                        {showGooglePhotosSync ? 'Synkroniserer...' : 'Synkroniser alle'}
                      </Button>
                      
                      <Button
                        variant="outlined"
                        startIcon={<Add />}
                        onClick={() => handleGooglePhotosImport(googlePhotosItems.map(p => p.id))}
                      >
                        Importer valgte
                      </Button>
                    </Box>

                    {showGooglePhotosSync && (
                      <Box sx={{ mt: 2 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={googlePhotosSyncProgress}
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                          Synkroniserer: {googlePhotosSyncProgress}% fullført
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Container>
        </DialogContent>
      </Dialog>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCommand={handleCommand}
        profession={profession}
      />
      
      {/* Keyboard Shortcuts Guide */}
      <KeyboardShortcutsGuide
        open={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
        profession={profession}
      />
      
      {/* Workflow Executor */}
      <WorkflowExecutor
        open={showWorkflowExecutor}
        onClose={() => setShowWorkflowExecutor(false)}
        profession={profession}
        selectedItems={Array.from(selectedImages)}
        onWorkflowComplete={(workflowId) => {
          console.log('Workflow completed:', workflowId);
          // Refresh data
          refetch();
        }}
      />
      
      {/* Quick Preview */}
      <QuickPreview
        open={quickPreviewOpen}
        items={filteredItems}
        currentIndex={quickPreviewIndex}
        profession={profession}
        accentColor={accentColor}
        onClose={() => setQuickPreviewOpen(false)}
        onNavigate={(direction) => {
          if (direction === 'next' && quickPreviewIndex < filteredItems.length - 1) {
            setQuickPreviewIndex(quickPreviewIndex + 1);
          } else if (direction === 'prev' && quickPreviewIndex > 0) {
            setQuickPreviewIndex(quickPreviewIndex - 1);
          }
        }}
        onDownload={handleDownload}
        onFavorite={toggleFavorite}
        onEdit={(item) => setSelectedItem(item)}
        favorites={favorites}
      />
      
      {/* Activity Feed */}
      <ActivityFeed
        open={activityFeedOpen}
        onClose={() => setActivityFeedOpen(false)}
        profession={profession}
        accentColor={accentColor}
      />
      
      {/* Comparison View */}
      <ComparisonView
        open={comparisonViewOpen}
        items={filteredItems}
        profession={profession}
        accentColor={accentColor}
        onClose={() => setComparisonViewOpen(false)}
        onPrefer={(_itemId) => {
          addNotification({
            message: 'Item marked as preferred!',
            type: 'success' });
        }}
        onDownload={handleDownload}
        favorites={favorites}
        onFavorite={toggleFavorite}
      />

      {/* Showcase Sharing Dialog */}
      <ShowcaseSharingDialog
        open={shareShowcaseDialogOpen}
        onClose={() => {
          setShareShowcaseDialogOpen(false);
          setPrefilledClient(undefined);
    }}
        prefilledClient={prefilledClient}
        showcases={showcases}
        shareShowcaseMutation={shareShowcaseMutation}
        user={user}
        profession={profession}
      />

      {/* Overage Management Dialog */}
      <OverageManagementDialog 
        open={overageDialogOpen}
        onClose={() => setOverageDialogOpen(false)}
        showcaseData={selectedShowcaseData}
        overageEmailMutation={overageEmailMutation}
      />

      {/* Lightroom Plugin Dialog */}
      <LightroomPluginDialog 
        open={lightroomPluginDialogOpen}
        onClose={() => setLightroomPluginDialogOpen(false)}
        profession={profession}
      />

      {/* Custom Categories Dialog */}
      <CustomCategoriesDialog 
        open={customCategoriesDialogOpen}
        onClose={() => setCustomCategoriesDialogOpen(false)}
        profession={profession}
        userId={effectiveUserId}
      />

      {/* Custom Sets Dialog */}
      <CustomSetsDialog 
        open={customSetsDialogOpen}
        onClose={() => setCustomSetsDialogOpen(false)}
        profession={profession}
        userId={effectiveUserId}
        availableCategories={apiCategories || []}
      />
      
      {/* Publish to Academy Dialog - Pro Plan Feature */}
      <PublishToAcademyDialog
        open={showPublishToAcademyDialog}
        onClose={() => {
          setShowPublishToAcademyDialog(false);
          setSelectedItemForPublish(null);
        }}
        item={selectedItemForPublish}
        profession={profession}
      />

      {/* Share to Community Dialog */}
      <ShareToCommunityDialog
        open={showShareToCommunityDialog}
        onClose={() => {
          setShowShareToCommunityDialog(false);
          setSelectedItemForCommunityShare(null);
          setSelectedItemsForCommunityShare([]);
        }}
        item={selectedItemForCommunityShare}
        items={selectedItemsForCommunityShare}
        userId={effectiveUserId}
        profession={profession}
        onShareSuccess={(_messageId, _channelId) => {
          addNotification({
            type: 'success',
            message: 'Innholdet ditt er nå delt med community!'
          });
        }}
      />

      {/* Publish to Evendi Dialog */}
      <Dialog
        open={showPublishToEvendiDialog}
        onClose={() => {
          setShowPublishToEvendiDialog(false);
          setSelectedItemForEvendi(null);
          setEvendiResult(null);
          setEvendiDeliveryForm({ coupleName: '', coupleEmail: '', weddingDate: '', title: '', description: '' });
          setEvendiProjectId('');
          setEvendiEventType('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(15, 20, 25, 0.98) 0%, rgba(25, 15, 30, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(233, 30, 99, 0.3)',
            borderRadius: 3,
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#E91E63' }}>
          <Box component="span" sx={{ fontSize: '1.5rem' }}>📦</Box>
          Publiser til Evendi
          <Chip label="DELIVERY" size="small" sx={{ ml: 'auto', bgcolor: '#E91E63', color: 'white', fontSize: '0.65rem', height: 20 }} />
        </DialogTitle>
        <DialogContent>
          {evendiResult ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                <CheckCircleIcon sx={{ color: '#4CAF50' }} />
                <Typography variant="h6" sx={{ color: '#4CAF50' }}>Leveranse opprettet</Typography>
              </Stack>
              <Box sx={{ bgcolor: 'rgba(233, 30, 99, 0.1)', borderRadius: 2, p: 3, mb: 2, border: '1px solid rgba(233, 30, 99, 0.3)' }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1 }}>Tilgangskode</Typography>
                <Typography variant="h4" sx={{ color: '#E91E63', fontFamily: 'monospace', letterSpacing: 4, fontWeight: 700 }}>
                  {evendiResult.accessCode}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1, display: 'block' }}>
                  Del denne koden med brudeparet for å gi tilgang
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {evendiResult.itemCount} elementer publisert til leveransen
              </Typography>
              <Button
                variant="outlined"
                sx={{ mt: 2, color: '#E91E63', borderColor: '#E91E63' }}
                onClick={() => {
                  navigator.clipboard.writeText(evendiResult.accessCode);
                  addNotification({ type: 'success', message: 'Tilgangskode kopiert!' });
                }}
              >
                Kopier tilgangskode
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                Opprett en Evendi-leveranse fra showcase-elementet <strong>{selectedItemForEvendi?.title}</strong>.
                Kunden kan hente denne med en tilgangskode i Evendi-appen.
              </Typography>

              <FormControl fullWidth size="small">
                <InputLabel>Relatert prosjekt</InputLabel>
                <Select
                  value={evendiProjectId}
                  onChange={(e) => setEvendiProjectId(e.target.value)}
                  label="Relatert prosjekt"
                  sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                >
                  <MenuItem value="">Ingen valgt</MenuItem>
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name || project.clientName || project.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Event type</InputLabel>
                <Select
                  value={evendiEventType}
                  onChange={(e) => setEvendiEventType(e.target.value)}
                  label="Event type"
                  sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                >
                  <MenuItem value="">Ingen valgt</MenuItem>
                  <MenuItem value="wedding">Bryllup</MenuItem>
                  <MenuItem value="portrait">Portrett</MenuItem>
                  <MenuItem value="event">Event</MenuItem>
                  <MenuItem value="commercial">Kommersielt</MenuItem>
                  <MenuItem value="video">Video</MenuItem>
                  <MenuItem value="music">Musikk</MenuItem>
                  <MenuItem value="family">Familie</MenuItem>
                  <MenuItem value="product">Produkt</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Leveransetittel"
                value={evendiDeliveryForm.title}
                onChange={(e) => setEvendiDeliveryForm(p => ({ ...p, title: e.target.value }))}
                fullWidth
                size="small"
                placeholder={`Leveranse fra ${selectedItemForEvendi?.title || 'showcase'}`}
                sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
              />
              <TextField
                label="Kunde (navn)"
                value={evendiDeliveryForm.coupleName}
                onChange={(e) => setEvendiDeliveryForm(p => ({ ...p, coupleName: e.target.value }))}
                fullWidth
                size="small"
                placeholder="F.eks. Daniel & Maria"
                sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
              />
              <TextField
                label="E-post til kunden"
                value={evendiDeliveryForm.coupleEmail}
                onChange={(e) => setEvendiDeliveryForm(p => ({ ...p, coupleEmail: e.target.value }))}
                fullWidth
                size="small"
                type="email"
                placeholder="par@eksempel.no"
                sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
              />
              <TextField
                label="Eventdato"
                value={evendiDeliveryForm.weddingDate}
                onChange={(e) => setEvendiDeliveryForm(p => ({ ...p, weddingDate: e.target.value }))}
                fullWidth
                size="small"
                type="date"
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
              />
              <TextField
                label="Beskrivelse"
                value={evendiDeliveryForm.description}
                onChange={(e) => setEvendiDeliveryForm(p => ({ ...p, description: e.target.value }))}
                fullWidth
                size="small"
                multiline
                rows={2}
                placeholder="Valgfri beskrivelse..."
                sx={{ '& .MuiOutlinedInput-root': { color: 'white' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setShowPublishToEvendiDialog(false);
              setSelectedItemForEvendi(null);
              setEvendiResult(null);
              setEvendiDeliveryForm({ coupleName: '', coupleEmail: '', weddingDate: '', title: '', description: '' });
              setEvendiProjectId('');
              setEvendiEventType('');
            }}
            sx={{ color: 'rgba(255,255,255,0.5)' }}
          >
            {evendiResult ? 'Lukk' : 'Avbryt'}
          </Button>
          {!evendiResult && (
            <Button
              variant="contained"
              disabled={evendiPublishing || !evendiDeliveryForm.coupleName.trim()}
              onClick={async () => {
                if (!selectedItemForEvendi) return;
                setEvendiPublishing(true);
                try {
                  const token = localStorage.getItem('auth_token') || '';
                  const response = await fetch('/api/evendi/showcase-create-delivery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                      showcaseItemIds: [selectedItemForEvendi.id],
                      coupleName: evendiDeliveryForm.coupleName,
                      coupleEmail: evendiDeliveryForm.coupleEmail || undefined,
                      weddingDate: evendiDeliveryForm.weddingDate || undefined,
                      title: evendiDeliveryForm.title || undefined,
                      description: evendiDeliveryForm.description || undefined,
                      projectId: evendiProjectId || (selectedItemForEvendi as any).projectId || undefined,
                      eventType: evendiEventType || (selectedItemForEvendi as any).projectType || undefined,
                    }),
                  });
                  const data = await response.json();
                  if (data.success) {
                    setEvendiResult({
                      accessCode: data.delivery.accessCode,
                      deliveryId: data.delivery.id,
                      itemCount: data.delivery.itemCount,
                    });
                    addNotification({ type: 'success', message: data.message });
                  } else {
                    addNotification({ type: 'error', message: data.error || 'Kunne ikke opprette leveranse' });
                  }
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : 'Nettverksfeil. Prøv igjen.';
                  addNotification({ type: 'error', message: errorMessage });
                } finally {
                  setEvendiPublishing(false);
                }
              }}
              sx={{ bgcolor: '#E91E63', '&:hover': { bgcolor: '#C2185B' } }}
            >
              {evendiPublishing ? 'Oppretter...' : '📦 Publiser til Evendi'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Bulk Folder Upload Dialog */}
      <BulkFolderUpload
        open={showBulkFolderUpload}
        onClose={() => setShowBulkFolderUpload(false)}
        onCreateCollections={handleBulkCreateCollections}
        profession={profession}
        accentColor={accentColor}
        parentFolderId={currentParentFolderId}
      />

      {/* Project Overview Dialog - Only in Admin Mode */}
      {adminMode && (
        <>
          <Dialog
            open={projectOverviewOpen}
            onClose={() => setProjectOverviewOpen(false)}
            maxWidth="md"
            fullWidth
            PaperProps={{
              sx: {
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%)',
                backdropFilter: 'blur(10px)',
              }
            }}
          >
            <DialogTitle sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              borderBottom: 1,
              borderColor: 'divider',
              pb: 2
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {selectedProjectForOverview?.projectType === 'story-arc' && <MovieCreation sx={{ color: theming.colors.primary }} />}
                {selectedProjectForOverview?.projectType === 'photo' && <CameraAlt sx={{ color: theming.colors.primary }} />}
                {selectedProjectForOverview?.projectType === 'audio' && <LibraryMusic sx={{ color: theming.colors.primary }} />}
                {selectedProjectForOverview?.projectType === 'timeline' && <TimelineIcon sx={{ color: theming.colors.primary }} />}
                <Typography variant="h6" sx={{ fontWeight: 700}}>
                  {selectedProjectForOverview?.storyArcName || 
                   selectedProjectForOverview?.name || 
                   selectedProjectForOverview?.title || 
                   'Project Details'}
                </Typography>
              </Box>
              <IconButton onClick={() => setProjectOverviewOpen(false)}>
                <Close />
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ mt: 2 }}>
              {selectedProjectForOverview && (
                <Grid container spacing={3}>
                  {/* Project Information Card */}
                  <Grid item xs={12}>
                    <MuiCard variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                          Project Information
                        </Typography>
                        
                        {/* Story Arc Specific */}
                        {selectedProjectForOverview.projectType === 'story-arc' && (
                          <Stack spacing={2}>
                            <Box>
                              <Typography variant="caption" color="text.secondary">Template Type</Typography>
                              <Typography variant="body1">{selectedProjectForOverview.templateType}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">Status</Typography>
                              <Chip label={selectedProjectForOverview.status} size="small" />
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">Created</Typography>
                              <Typography variant="body1">
                                {new Date(selectedProjectForOverview.createdAt).toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Stack>
                        )}
                        
                        {/* Photo Project Specific */}
                        {selectedProjectForOverview.projectType === 'photo' && (
                          <Stack spacing={2}>
                            <Box>
                              <Typography variant="caption" color="text.secondary">Client</Typography>
                              <Typography variant="body1">{selectedProjectForOverview.clientName || 'N/A'}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">Event Date</Typography>
                              <Typography variant="body1">
                                {selectedProjectForOverview.eventDate 
                                  ? new Date(selectedProjectForOverview.eventDate).toLocaleDateString()
                                  : 'N/A'}
                              </Typography>
                            </Box>
                          </Stack>
                        )}
                        
                        {/* Timeline Project Specific */}
                        {selectedProjectForOverview.projectType === 'timeline' && (
                          <Stack spacing={2}>
                            <Box>
                              <Typography variant="caption" color="text.secondary">Project ID</Typography>
                              <Typography variant="body1">{selectedProjectForOverview.id}</Typography>
                            </Box>
                          </Stack>
                        )}
                      </CardContent>
                    </MuiCard>
                  </Grid>
                  
                  {/* Action Buttons */}
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={2} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        onClick={() => setProjectOverviewOpen(false)}
                      >
                        Close
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<TimelineIcon />}
                        onClick={() => handleOpenProjectTimeline(selectedProjectForOverview)}
                        sx={{
                          backgroundColor: theming.colors.primary,
                          '&:hover': { backgroundColor: alpha(theming.colors.primary, 0.8) }
                        }}
                      >
                        View Project Timeline
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<OpenInNew />}
                        onClick={handleOpenInNewTab}
                        sx={{
                          backgroundColor: theming.colors.primary,
                          '&:hover': { backgroundColor: alpha(theming.colors.primary, 0.8) }
                        }}
                      >
                        Open in New Tab
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={selectedProjectForOverview?.projectType === 'story-arc' ? <MovieCreation /> : <Edit />}
                        onClick={handleOpenInEditor}
                          sx={{
                            backgroundColor: theming.colors.primary, '&:hover': { backgroundColor: alpha(theming.colors.primary, 0.8) }
                        }}
                      >
                        {selectedProjectForOverview?.projectType === 'story-arc' 
                          ? 'Open in Story Arc Studio' 
                          : selectedProjectForOverview?.projectType === 'photo'
                          ? 'Open in Photo Enhancement'
                          : selectedProjectForOverview?.projectType === 'audio'
                          ? 'Open in Audio Enhancement'
                          : 'Open in Editor'}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              )}
            </DialogContent>
          </Dialog>

          {/* Project Timeline Overview Dialog */}
          <Dialog
            open={projectTimelineOpen}
            onClose={() => setProjectTimelineOpen(false)}
            maxWidth="lg"
            fullWidth
            PaperProps={{
              sx: {
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%)',
                backdropFilter: 'blur(10px)',
              }
            }}
          >
            <DialogTitle sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              borderBottom: 1,
              borderColor: 'divider',
              pb: 2
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TimelineIcon sx={{ color: theming.colors.primary }} />
                <Typography variant="h6" sx={{ fontWeight: 700}}>
                  Project Timeline: {selectedProjectForTimeline?.name || selectedProjectForTimeline?.title || 'Project'}
                </Typography>
              </Box>
              <IconButton onClick={() => setProjectTimelineOpen(false)}>
                <Close />
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ mt: 2 }}>
              {selectedProjectForTimeline && (
                <Box>
                  {/* Embed ProjectTimeline component */}
                  <ProjectProvider>
                    <ProjectTimeline
                      projectId={selectedProjectForTimeline.id}
                      selectedProject={selectedProjectForTimeline}
                      profession={profession as ProfessionType}
                    />
                  </ProjectProvider>
                </Box>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Academy Overlay */}
      {showAcademy && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, bgcolor: 'background.default' }}>
          <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10000}}>
            <Button variant="contained"
              startIcon={<ArrowBack />}
              onClick={() => setShowAcademy(false)}
              sx={{ 
                bgcolor: '#ff8c00', '&:hover': { 
                  bgcolor: '#f57c00'
                }
              }}
            >
              TILBAKE TIL SHOWCASE
            </Button>
          </Box>
          <AcademyProvider>
            <AcademyDashboard />
          </AcademyProvider>
        </Box>
      )}

      {/* Dashboard Overlay */}
      {showDashboard && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, bgcolor: 'background.default' }}>
          <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10000}}>
            <Button variant="contained"
              startIcon={<ArrowBack />}
              onClick={() => setShowDashboard(false)}
              sx={{ 
                bgcolor: '#4caf50', '&:hover': { 
                  bgcolor: '#388e3c'
                }
              }}
            >
              TILBAKE TIL SHOWCASE
            </Button>
          </Box>
          <UniversalDashboard profession={profession} />
        </Box>
      )}

      {/* Project State Update Dialog */}
      <Dialog
        open={projectStateUpdateOpen}
        onClose={() => setProjectStateUpdateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle color="primary" />
            <Typography variant="h6">Update Project State</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Current state: <strong>{projectState === 'delivered' ? 'Delivered' : 'In Client Review'}</strong>
            </Typography>
            <FormControl fullWidth>
              <FormLabel>New Project State</FormLabel>
              <RadioGroup
                value={newProjectState}
                onChange={(e) => setNewProjectState(e.target.value as 'delivered' | 'in_review')}
              >
                <FormControlLabel 
                  value="in_review" 
                  control={<Radio />} 
                  label="In Client Review" 
                />
                <FormControlLabel 
                  value="delivered" 
                  control={<Radio />} 
                  label="Delivered" 
                />
              </RadioGroup>
            </FormControl>
            <Paper sx={{ p: 2, mt: 2, bgcolor: newProjectState === 'delivered' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)' }}>
              <Typography variant="body2">
                Changing to <strong>{newProjectState === 'delivered' ? 'Delivered' : 'In Client Review'}</strong> will:
              </Typography>
              <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                {newProjectState === 'delivered' ? (
                  <>
                    <li>Remove watermarks</li>
                    <li>Disable comments</li>
                    <li>Enable downloads</li>
                    <li>Mark project as completed</li>
                  </>
                ) : (
                  <>
                    <li>Add watermarks</li>
                    <li>Enable comments</li>
                    <li>Disable downloads</li>
                    <li>Mark project as awaiting approval</li>
                  </>
                )}
              </Box>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjectStateUpdateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (selectedItemForStateUpdate && clientSession) {
                try {
                  await updateProjectStateMutation.mutateAsync({
                    sessionId: sessionIdd || clientSession.id,
                    projectState: newProjectState,
                    projectId: selectedItemForStateUpdate.projectId,
                  });
                  setProjectStateUpdateOpen(false);
                } catch (error) {
                  console.error('Failed to update project state:', error);
                }
              }
            }}
            disabled={updateProjectStateMutation.isPending || newProjectState === projectState}
          >
            {updateProjectStateMutation.isPending ? 'Updating...': 'Update State'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pro Tools Integration Dialog - Music Producer Only */}
      {profession === 'music_producer' && (
        <Dialog
          open={showProToolsDialog}
          onClose={() => setShowProToolsDialog(false)}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              minHeight: '600px',
            }}}
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6">Pro Tools Integration</Typography>
              <IconButton onClick={() => setShowProToolsDialog(false)} size="small">
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <ProToolsConnection
                  onSessionSelected={(sessionId) => setProToolsSessionId(sessionId)}
                  selectedSessionId={proToolsSessionId}
                />
              </Grid>
              {proToolsSessionId && (
                <>
                  <Grid item xs={12} md={6}>
                    <PlayheadSync
                      sessionId={proToolsSessionId}
                      currentTime={0}
                      duration={selectedItem?.duration}
                      onTimeChange={(time) => {
                        // Update playback time with video/audio sync
                        setVideoCurrentTime(time);
                        // Broadcast time change for collaboration
                        if (enableRealTimeSync && collaborationSessionId) {
                          (communication as any).sendMessage?.({ type: 'playhead:update', data: { time, sessionId: proToolsSessionId } });
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <ProToolsCommentsPanel
                      sessionId={proToolsSessionId}
                      currentTimecode={undefined}
                      onCommentClick={(comment) => {
                        // Seek to comment timecode
                        if (comment.timecodeReference) {
                          const seconds = timecodeToSeconds(comment.timecodeReference);
                          // Update playback position - seek media player to timecode
                          const seekEvent = new CustomEvent('seek-to-timecode', {
                            detail: { seconds, timecode: comment.timecodeReference }
                          });
                          window.dispatchEvent(seekEvent);
                          addNotification({
                            message: `Seeking to ${comment.timecodeReference} (${seconds}s)`,
                            type: 'info',
                          });
                        }
                      }}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowProToolsDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* SpeedDial for Quick Actions */}
      <SpeedDial
        ariaLabel="Quick actions"
        sx={{ position: 'fixed', bottom: 80, right: 32 }}
        icon={<SpeedDialIcon />}
        open={speedDialOpen}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        FabProps={{
          sx: {
            bgcolor: accentColor,
            '&:hover': { bgcolor: accentColor }
          }
        }}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.id}
            icon={action.icon}
            tooltipTitle={action.label}
            onClick={() => {
              handleQuickAction(action.id);
              setSpeedDialOpen(false);
            }}
          />
        ))}
      </SpeedDial>

      {/* Backdrop for SpeedDial */}
      <Backdrop open={speedDialOpen} onClick={() => setSpeedDialOpen(false)} sx={{ zIndex: 1200 }} />

      {/* Filter Drawer */}
      <Drawer
        anchor="right"
        open={quickDrawerOpen}
        onClose={() => setQuickDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 320,
            bgcolor: 'rgba(0, 15, 26, 0.95)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(255, 107, 53, 0.2)'
          }
        }}
      >
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: textPrimary }}>Filters & Settings</Typography>
            <IconButton onClick={() => setQuickDrawerOpen(false)} sx={{ color: textSecondary }}>
              <Close />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 3, borderColor: 'rgba(255, 107, 53, 0.2)' }} />
          
          <List>
            <ListItem>
              <ListItemButton onClick={() => { setFilter('all'); setQuickDrawerOpen(false); }}>
                <ListItemIcon><Home sx={{ color: accentColor }} /></ListItemIcon>
                <ListItemText primary="All Items" sx={{ color: textPrimary }} />
              </ListItemButton>
            </ListItem>
            <ListItem>
              <ListItemButton onClick={() => { setFilter('favorites'); setQuickDrawerOpen(false); }}>
                <ListItemIcon><Favorite sx={{ color: accentColor }} /></ListItemIcon>
                <ListItemText primary="Favorites" sx={{ color: textPrimary }} />
              </ListItemButton>
            </ListItem>
            <ListItem>
              <ListItemButton onClick={() => { setShowPushSettings(true); setQuickDrawerOpen(false); }}>
                <ListItemIcon><Settings sx={{ color: accentColor }} /></ListItemIcon>
                <ListItemText primary="Notification Settings" sx={{ color: textPrimary }} />
              </ListItemButton>
            </ListItem>
          </List>

          <Divider sx={{ my: 2, borderColor: 'rgba(255, 107, 53, 0.2)' }} />
          
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={isDemoMode}
                  onChange={() => toggleDemoMode()}
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: accentColor } }}
                />
              }
              label={<Typography sx={{ color: textPrimary }}>Demo Mode</Typography>}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showcaseSettings.lazyLoading}
                  onChange={(e) => setShowcaseSettings(prev => ({ ...prev, lazyLoading: e.target.checked }))}
                  sx={{ color: accentColor }}
                />
              }
              label={<Typography sx={{ color: textPrimary }}>Lazy Loading</Typography>}
            />
          </FormGroup>
        </Box>
      </Drawer>

      {/* Sort Menu */}
      <Menu
        anchorEl={sortMenuAnchorEl}
        open={Boolean(sortMenuAnchorEl)}
        onClose={() => setSortMenuAnchorEl(null)}
        TransitionComponent={Fade}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(0, 15, 26, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 107, 53, 0.2)'
          }
        }}
      >
        <MenuItem
          onClick={() => {
            setSort('date');
            setSortMenuAnchorEl(null);
          }}
          sx={{ color: textPrimary }}
        >
          <ListItemIcon><AccessTime sx={{ color: accentColor }} /></ListItemIcon>
          Sort by Date
        </MenuItem>
        <MenuItem
          onClick={() => {
            setSort('name');
            setSortMenuAnchorEl(null);
          }}
          sx={{ color: textPrimary }}
        >
          <ListItemIcon><Star sx={{ color: accentColor }} /></ListItemIcon>
          Sort by Name
        </MenuItem>
        <MenuItem
          onClick={() => {
            setSort('favorite');
            setSortMenuAnchorEl(null);
          }}
          sx={{ color: textPrimary }}
        >
          <ListItemIcon><Favorite sx={{ color: accentColor }} /></ListItemIcon>
          Sort by Favorites
        </MenuItem>
      </Menu>

      {/* Advanced Popper Menu with ClickAwayListener */}
      <Popper
        open={popperOpen}
        anchorEl={popperAnchorEl}
        placement="bottom-start"
        transition
      >
        {({ TransitionProps }) => (
          <Grow {...TransitionProps}>
            <Paper
              sx={{
                bgcolor: 'rgba(0, 15, 26, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 107, 53, 0.2)',
                mt: 1
              }}
            >
              <ClickAwayListener onClickAway={() => setPopperAnchorEl(null)}>
                <MenuList>
                  <MenuItem
                    onClick={() => {
                      setFilter('all');
                      setPopperAnchorEl(null);
                    }}
                    sx={{ color: textPrimary }}
                  >
                    <ListItemIcon><Home sx={{ color: accentColor }} /></ListItemIcon>
                    <ListItemText>All Items</ListItemText>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setFilter('favorites');
                      setPopperAnchorEl(null);
                    }}
                    sx={{ color: textPrimary }}
                  >
                    <ListItemIcon><Favorite sx={{ color: accentColor }} /></ListItemIcon>
                    <ListItemText>Favorites</ListItemText>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setShowAuthDialog(true);
                      setPopperAnchorEl(null);
                    }}
                    sx={{ color: textPrimary }}
                  >
                    <ListItemIcon><Security sx={{ color: accentColor }} /></ListItemIcon>
                    <ListItemText>Session Auth</ListItemText>
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>

      {/* Quick Tag Filter Menu */}
      <Menu
        anchorEl={quickMenuAnchorRef.current}
        open={quickMenuOpen}
        onClose={() => setQuickMenuOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(0, 15, 26, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 107, 53, 0.2)'
          }
        }}
      >
        <MenuItem
          onClick={() => {
            setQuickTagFilter(null);
            setQuickMenuOpen(false);
          }}
          sx={{ color: textPrimary }}
        >
          <ListItemIcon><MoreVert sx={{ color: accentColor }} /></ListItemIcon>
          <ListItemText>All Tags</ListItemText>
        </MenuItem>
        {['architecture', 'portrait', 'landscape', 'product', 'event'].map((tag) => (
          <MenuItem
            key={tag}
            onClick={() => {
              setQuickTagFilter(tag);
              setQuickMenuOpen(false);
            }}
            selected={quickTagFilter === tag}
            sx={{ color: textPrimary }}
          >
            <ListItemIcon><Straighten sx={{ color: accentColor }} /></ListItemIcon>
            <ListItemText>{tag}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* Hidden video/audio players for advanced control */}
      <video ref={videoPlayerRef} style={{ display: 'none' }} />
      <audio ref={audioPlayerRef} style={{ display: 'none' }} />

      {/* Client Auth Dialog */}
      <React.Suspense fallback={<CircularProgress />}>
        {showAuthDialog && (
          <ClientAuthDialog
            open={showAuthDialog}
            onClose={() => setShowAuthDialog(false)}
            sessionToken={proToolsSessionId || ''}
            onAuthenticated={() => {
              setShowAuthDialog(false);
              addNotification({ message: 'Authentication successful', type: 'success' });
            }}
          />
        )}
      </React.Suspense>

      {/* Push Notification Settings */}
      {showPushSettings && (
        <Dialog
          open={showPushSettings}
          onClose={() => setShowPushSettings(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Push Notification Settings</DialogTitle>
          <DialogContent>
            <PushNotificationSettings userId={effectiveUserId} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPushSettings(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* AI Auto-Tag Dialog */}
      {showAutoTagDialog && enableAutoTagging && (
        <Dialog
          open={showAutoTagDialog}
          onClose={() => setShowAutoTagDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>AI Auto-Tagging</DialogTitle>
          <DialogContent>
            <Typography>
              AI analyserer {selectedManagedItems.length} CreatorHub-element{selectedManagedItems.length !== 1 ? 'er' : ''} for automatisk tagging.
            </Typography>
            {isAnalyzing && <CircularProgress sx={{ mt: 2 }} />}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAutoTagDialog(false)}>Cancel</Button>
            <Button 
              variant="contained"
              onClick={() => {
                void runAutoTagging();
              }}
              disabled={selectedManagedItems.length === 0 || isAnalyzing}
            >
              {isAnalyzing ? 'Tagger...' : 'Apply Tags'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* AI Auto-Curate Dialog */}
      {showAutoCurateDialog && enableSmartCollections && (
        <Dialog
          open={showAutoCurateDialog}
          onClose={() => setShowAutoCurateDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>AI Auto-Curation</DialogTitle>
          <DialogContent>
            <Typography>Oppretter samlinger basert på valgt innhold og eksisterende metadata.</Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">Collections to create:</Typography>
              {autoCurationPreviewGroups.length > 0 ? (
                autoCurationPreviewGroups.map((group) => (
                  <Chip key={group.name} label={`${group.name} (${group.count})`} sx={{ m: 0.5 }} />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Velg CreatorHub-elementer for å generere kuraterte samlinger.
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAutoCurateDialog(false)}>Cancel</Button>
            <Button 
              variant="contained"
              onClick={() => {
                void runAutoCuration();
              }}
              disabled={autoCurationPreviewGroups.length === 0}
            >
              Create Collections
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Video Chapter Markers Dialog */}
      {showChapterDialog && (
        <Dialog
          open={showChapterDialog}
          onClose={() => setShowChapterDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Add Chapter Markers</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2 }}>
              Opprett kapittelmarkører basert på tidskodede kommentarer og valgt bryllupspakke.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Aktiv pakke: {weddingPackageLabels[selectedWeddingPackage]} • Minimumslengde: {chapterMinimumSeconds}s
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowChapterDialog(false)}>Close</Button>
            <Button
              variant="contained"
              onClick={() => {
                void createChapterMarkers();
              }}
              disabled={selectedVideoIds.length === 0}
            >
              Opprett kapitler
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Subtitle Generation Dialog */}
      {showSubtitleDialog && (
        <Dialog
          open={showSubtitleDialog}
          onClose={() => setShowSubtitleDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Generate Subtitles</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2 }}>
              Start AI-undertekster for {selectedVideoIds.length} video{selectedVideoIds.length !== 1 ? 'er' : ''}.
            </Typography>
            {isProcessingVideo && <LinearProgress sx={{ mt: 2 }} />}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSubtitleDialog(false)}>Close</Button>
            <Button
              variant="contained"
              onClick={() => {
                void requestSubtitleGeneration();
              }}
              disabled={selectedVideoIds.length === 0}
            >
              Start undertekster
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Move Items Dialog */}
      {showMoveDialog && (
        <Dialog
          open={showMoveDialog}
          onClose={() => setShowMoveDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Move Items</DialogTitle>
          <DialogContent>
            <Typography>
              Klargjor flytting for {activeSelectionIds.length} element{activeSelectionIds.length !== 1 ? 'er' : ''}.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowMoveDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={openMoveSelectionDialog}
              disabled={activeSelectionIds.length === 0}
            >
              Move
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Create Collection Dialog */}
      {showCreateCollection && (
        <Dialog
          open={showCreateCollection}
          onClose={() => setShowCreateCollection(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create Collection</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Collection Name"
              variant="outlined"
              value={newCollectionName}
              onChange={(event) => setNewCollectionName(event.target.value)}
              sx={{ mt: 2 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void createCollectionFromDialog();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowCreateCollection(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                void createCollectionFromDialog();
              }}
              disabled={!newCollectionName.trim() || selectedManagedItems.length === 0}
            >
              Create
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Notification Snackbar */}
      <Snackbar
        open={notificationOpen}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification?.type || 'info'}
          sx={{ width:'100%' }}
          action={
            notification?.actions && notification.actions.length > 0 ? (
              <Stack direction="row" spacing={1}>
                {notification.actions.map((action, index) => (
                  <Button
                    key={`${action.label}-${index}`}
                    size="small"
                    color="inherit"
                    onClick={() => {
                      action.action();
                      handleCloseNotification();
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </Stack>
            ) : undefined
          }
        >
          {notification?.message}
        </Alert>
      </Snackbar>

      {/* Developer Debug Panel - Uses getter functions and unused state */}
      {isDemoMode && (
        <Dialog
          open={false}
          onClose={() => {}}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Debug Info</DialogTitle>
          <DialogContent>
            <Typography variant="subtitle2">Settings</Typography>
            <pre>{JSON.stringify(getSetting('showcase'), null, 2)}</pre>
            <Typography variant="subtitle2">Workflow</Typography>
            <pre>{JSON.stringify(getWorkflow('showcase'), null, 2)}</pre>
            <Typography variant="subtitle2">UI Settings</Typography>
            <pre>{JSON.stringify(getUISetting('theme'), null, 2)}</pre>
            <Typography variant="subtitle2">Integration</Typography>
            <pre>{JSON.stringify(getIntegration('google'), null, 2)}</pre>
            <Typography variant="subtitle2">Profession</Typography>
            <Typography>Profession Adapter: {adaptDashboardTitle()}</Typography>
            <Typography>Tab Labels: {JSON.stringify(adaptTabLabels())}</Typography>
            <Typography variant="subtitle2">State</Typography>
            <Typography>Sort: {sort}</Typography>
            <Typography>Featured Item: {featuredItem?.title ||' None'}</Typography>
            <Typography>Time Remaining: {timeRemaining}s</Typography>
            <Typography>Layout Mode: {layoutMode}</Typography>
            <Typography>Loading: {isLoading ? 'Yes' : 'No'}</Typography>
            <Typography>Annotations: {annotations.length}</Typography>
            <Typography>Show Annotations: {showAnnotations ? 'Yes' : 'No'}</Typography>
            <Typography>Filter Chips: {filterChips.length}</Typography>
            <Typography>Categories: {categories.length}</Typography>
            <Typography>Sets: {sets.length}</Typography>
            <Typography>Collections: {collections.length}</Typography>
            <Typography>Config Loading: {configsLoading ? 'Yes' : 'No'}</Typography>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmDeleteDialog.open} onClose={() => setConfirmDeleteDialog(prev => ({ ...prev, open: false }))}>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>
            Er du sikker på at du vil slette {confirmDeleteDialog.count} {confirmDeleteDialog.type === 'image' ? (confirmDeleteDialog.count !== 1 ? 'bilder' : 'bilde') : (confirmDeleteDialog.count !== 1 ? 'videoer' : 'video')}?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Denne handlingen kan ikke angres.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteDialog(prev => ({ ...prev, open: false }))}>
            Avbryt
          </Button>
          <Button variant="contained" color="error" onClick={confirmDeleteDialog.onConfirm}>
            Slett
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default React.memo(UniversalShowcase);
