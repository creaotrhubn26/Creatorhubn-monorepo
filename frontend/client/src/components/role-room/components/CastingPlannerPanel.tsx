// @ts-nocheck
import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense, startTransition, memo, type FC, type MouseEvent, type ReactElement, type ReactNode, type SyntheticEvent } from 'react';
import { flushSync } from 'react-dom';
import { Z_INDEX } from '../config/zIndex';
import { useToast } from './ToastStack';
import { useBrandingSettings } from '../hooks/useBrandingSettings.ts';
import { getRoleRoomCanonicalPath, shouldUseRoleRoomLocalFallback } from '../utils/runtime';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Chip,
  TextField,
  Select,
  MenuItem,
  Menu,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  useTheme,
  useMediaQuery,
  InputAdornment,
  Grow,
  Stack,
  CircularProgress,
  Tooltip,
  Alert,
  Badge,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  PhotoCamera as PhotoCameraIcon,
  ViewList as ViewListIcon,
  Group as GroupIcon,
  Inventory as InventoryIcon,
  Movie as MovieIcon,
  Assignment as AssignmentIcon,
  Work as WorkIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  AccessTime as AccessTimeIcon,
  Image as ImageIcon,
  Save as SaveIcon,
  CloudUpload as CloudUploadIcon,
  Transgender as TransgenderIcon,
  PlayArrow as PlayArrowIcon,
  Business as BusinessIcon,
  SupervisorAccount as SupervisorAccountIcon,
  Videocam as VideocamIcon,
  CameraAlt as CameraAltIcon,
  Lightbulb as LightbulbIcon,
  GraphicEq as GraphicEqIcon,
  Face as FaceIcon,
  Checkroom as CheckroomIcon,
  Build as BuildIcon,
  Note as NoteIcon,
  ContactEmergency as ContactEmergencyIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  SwapHoriz as SwapHorizIcon,
  School as TutorialIcon,
  Folder,
  Timeline as TimelineIcon,
  AccountTree as StoryLogicIcon,
  Create as StoryWriterIcon,
  CalendarMonth as CalendarMonthIcon,
  Keyboard as KeyboardIcon,
  HowToVote as SelectionTabIcon,
  Casino as CasinoIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
  ViewCarousel as ViewCarouselIcon,
  Search as SearchIcon,
  AttachMoney as AttachMoneyIcon,
  FactCheck as FactCheckIcon,
  ImportExport as ImportExportIcon,
  PermMedia as PermMediaIcon,
  MoreHoriz as MoreHorizIcon,
  PushPin as PushPinIcon,
  DragIndicator as DragIndicatorIcon,
  FolderOpen as FolderOpenIcon,
  ContentCopy as ContentCopyIcon,
  Publish as PublishIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Inbox as InboxIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

// Custom SVG icons for consistent visual language
import {
  DashboardCustomIcon as _DashboardIcon,
  RolesIcon as TheaterComedyIcon,
  CandidatesIcon as RecentActorsIcon,
  AuditionsIcon as _InterpreterModeIcon,
  TeamIcon as GroupsIcon,
  LocationsIcon as LocationIcon,
  EquipmentIcon as _PropIcon,
  EquipmentIcon,
  CalendarCustomIcon as CalendarIcon,
  ShotListIcon,
  StoryArcIcon,
  ShareCustomIcon as _ShareIcon,
  PersonNameIcon,
  NotesIcon,
  EmailIcon as CustomEmailIcon,
  PhoneIcon as CustomPhoneIcon,
  AddressIcon,
  ConsentsIcon,
} from './icons/CastingIcons';

import type { CastingProject, Role, Candidate, ContactInfo, Schedule, UserRole, UserRoleType } from '../models/casting';
import { RichTextEditor } from './RichTextEditor';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import { AuditionSchedulePanel } from './AuditionSchedulePanel';
import rolesBackdrop4 from './icons/Keep/roles_backdrop_4.png';
import { storyLogicService, type StoryLogicState } from '../services/storyLogicService';

// Custom icon: Person holding camera with list/clipboard
import { castingService, type RoleRoomProjectCopyOptions, type RoleRoomProjectSyncMeta } from '../services/castingService';
import {
  googleWorkspaceApi,
  linkedInWorkspaceApi,
  roleRoomBillingApi,
  type RoleRoomCommercialBillingAccount,
  type RoleRoomGoogleStatusResponse,
} from '../services/castingApiService';
import { consentService } from '../services/consentService';
import { castingAuthService } from '../services/castingAuthService';
import { useProducerAccess } from '../hooks/useProducerAccess';
import { producerWorkflowService } from '../services/producerWorkflowService';
import {
  emitProducerWorkflowFocusEvent,
  type ProducerWorkflowFocusPayload,
} from '../services/producerWorkflowFocusEvents';
import { onProducerWorkflowEvent } from '../services/producerWorkflowEvents';
import { useProducerNotifications } from '../hooks/useProducerNotifications';
import {
  buildProducerWorkflowEntityOptions,
  buildProducerWorkflowOwnerOptions,
  makeProducerPackageEntityId,
} from '../utils/producerWorkflow';
import {
  buildClientPortalUrl,
  parseClientPortalIntentFromWindow,
  type ClientPortalWorkspaceFocus,
} from '../utils/clientPortal';
import {
  normalizeStoryArcNavigationFocus,
  type StoryArcNavigationFocus,
} from '../utils/storyArcFocus';
import {
  flattenProducerWorkspacePages,
  getClientVisibleProducerWorkspaceNavigation,
} from '../utils/producerProjectPlanning';
import type { Tutorial } from '../services/tutorialService';

// Lazy load heavy panels for better performance
const CrewManagementPanel = lazy(() => import('./CrewManagementPanel').then(m => ({ default: m.CrewManagementPanel })));
const LocationManagementPanel = lazy(() => import('./LocationManagementPanel').then(m => ({ default: m.LocationManagementPanel })));
const PropManagementPanel = lazy(() => import('./PropManagementPanel').then(m => ({ default: m.PropManagementPanel })));
const EquipmentManagementPanel = lazy(() => import('./EquipmentManagementPanel').then(m => ({ default: m.EquipmentManagementPanel })));
const ProductionDayView = lazy(() => import('./ProductionDayView').then(m => ({ default: m.ProductionDayView })));
const CastingShotListPanel = lazy(() => import('./CastingShotListPanel').then(m => ({ default: m.CastingShotListPanel })));
const ManuscriptPanel = lazy(() => import('./ManuscriptPanel').then(m => ({ default: m.ManuscriptPanel })));
const StoryLogicPanel = lazy(() => import('./screenplay/StoryLogicPanel').then(m => ({ default: m.StoryLogicPanel })));
const RoleManagementPanel = lazy(() => import('./RoleManagementPanel').then(m => ({ default: m.RoleManagementPanel })));
const CandidateManagementPanel = lazy(() => import('./CandidateManagementPanel').then(m => ({ default: m.CandidateManagementPanel })));
const DashboardPanel = lazy(() => import('./DashboardPanel').then(m => ({ default: m.DashboardPanel })));
const SharingPanel = lazy(() => import('./SharingPanel').then(m => ({ default: m.SharingPanel })));
const LiveSetMode = lazy(() => import('./LiveSetMode').then(m => ({ default: m.LiveSetMode })));

// Import ErrorBoundary for robustness
import { ErrorBoundary } from './ErrorBoundary';
const KanbanPanel = lazy(() => import('./KanbanPanel').then(m => ({ default: m.KanbanPanel })));
const CastingPlannerTutorial = lazy(() => import('./CastingPlannerTutorial').then(m => ({ default: m.CastingPlannerTutorial })));
const TutorialEditorPanel = lazy(() => import('./TutorialEditorPanel').then(m => ({ default: m.TutorialEditorPanel })));
const ConsentManagementPanel = lazy(() => import('./ConsentManagementPanel').then(m => ({ default: m.ConsentManagementPanel })));
const ConsentContractDialog = lazy(() => import('./ConsentContractDialog').then(m => ({ default: m.ConsentContractDialog })));
const ProjectEconomyHub = lazy(() => retryDynamicImport(() => import('./ProjectEconomyHub'), 'ProjectEconomyHub'));
const ProductionCalendarPanel = lazy(() => import('./ProductionCalendarPanel'));
const CrewCalendarPanel = lazy(() => import('./production/CrewCalendarPanel').then(m => ({ default: m.CrewCalendarPanel })));
const ProducerTimelinePanel = lazy(() => import('./producer/ProducerTimelinePanel'));
const ProducerPlannerStudio = lazy(() => import('./producer/ProducerPlannerStudio'));
const ProducerClientReviewPanel = lazy(() => import('./producer/ProducerClientReviewPanel'));
const ProducerMediaPanel = lazy(() => import('./producer/ProducerMediaPanel'));
const ProducerExtrasPanel = lazy(() => import('./producer/ProducerExtrasPanel'));
const ProducerExportHandoffPanel = lazy(() => import('./producer/ProducerExportHandoffPanel'));
import RoleRoomDiagnosticsProbe from './shared/RoleRoomDiagnosticsProbe';
import {
  clearRoleRoomDiagnostics,
  isRoleRoomDiagnosticsEnabled,
  logRoleRoomDiagnostic,
} from '../utils/roleRoomDiagnostics';

const retryDynamicImport = async <T,>(
  loadModule: () => Promise<T>,
  label: string,
  attempts = 2,
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await loadModule();
    } catch (error) {
      lastError = error;
      logRoleRoomDiagnostic('lazy-import:retry', {
        label,
        attempt: attempt + 1,
        message: error instanceof Error ? error.message : String(error),
      });
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 180 * (attempt + 1)));
      }
    }
  }
  throw lastError;
};

// Lazy load dialogs and modals for better initial load
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const LoginDialog = lazy(() => import('./LoginDialog'));
const CastingSharingDialog = lazy(() => import('./CastingSharingDialog').then(m => ({ default: m.CastingSharingDialog })));
const CastingProfessionDialog = lazy(() => import('./CastingProfessionDialog').then(m => ({ default: m.CastingProfessionDialog })));
import type { CastingProfessionSelection } from './CastingProfessionDialog';
const ProfessionOnboardingDialog = lazy(() => import('./ProfessionOnboardingDialog').then(m => ({ default: m.ProfessionOnboardingDialog })));

import { useProfessionOnboarding, type ProfessionType } from './ProfessionOnboardingDialog';
import { useAuth } from '@/hooks/useAuth';
import authSessionService from '../services/authSessionService';
import settingsService from '../services/settingsService';
import globalTagService from '../services/globalTagService';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import NewProjectCreationModal from './Planning/NewProjectCreationModal';
import RoleRoomBrandMark from './shared/RoleRoomBrandMark';
import RoleRoomBillingAccountDialog from './RoleRoomBillingAccountDialog';
import SelectionMeetPlannerCard from './SelectionMeetPlannerCard';

interface CastingPlannerPanelProps {
  onClose?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isStandalone?: boolean;
  isGuestMode?: boolean;
}

interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
  immersive?: boolean;
}

// Helper function to map CrewRole to Department for calendar
const mapRoleToDepartment = (role: string): 'regi' | 'produksjon' | 'kamera' | 'lys' | 'grip' | 'lyd' | 'art' | 'hmu' | 'kostyme' | 'personal' => {
  const roleMap: Record<string, 'regi' | 'produksjon' | 'kamera' | 'lys' | 'grip' | 'lyd' | 'art' | 'hmu' | 'kostyme' | 'personal'> = {
    director: 'regi',
    producer: 'produksjon',
    casting_director: 'produksjon',
    production_manager: 'produksjon',
    camera_operator: 'kamera',
    camera_assistant: 'kamera',
    cinematographer: 'kamera',
    drone_pilot: 'kamera',
    gaffer: 'lys',
    grip: 'grip',
    sound_engineer: 'lyd',
    audio_mixer: 'lyd',
    video_editor: 'produksjon',
    colorist: 'produksjon',
    vfx_artist: 'art',
    motion_graphics: 'art',
    production_assistant: 'produksjon',
    script_supervisor: 'regi',
    location_manager: 'produksjon',
    production_designer: 'art',
    makeup_artist: 'hmu',
    wardrobe: 'kostyme',
    stylist: 'kostyme',
    collaborator: 'produksjon',
    other: 'personal',
  };
  return roleMap[role] || 'personal';
};

// Helper function to get an icon for each crew role — used in crew calendars & team displays
const getCrewRoleIcon = (role: string): ReactElement => {
  const iconProps = { sx: { fontSize: 18 } };
  const roleIcons: Record<string, ReactElement> = {
    director: <MovieIcon {...iconProps} />,
    producer: <BusinessIcon {...iconProps} />,
    casting_director: <SupervisorAccountIcon {...iconProps} />,
    production_manager: <SupervisorAccountIcon {...iconProps} />,
    camera_operator: <CameraAltIcon {...iconProps} />,
    camera_assistant: <CameraAltIcon {...iconProps} />,
    cinematographer: <CameraAltIcon {...iconProps} />,
    drone_pilot: <CameraAltIcon {...iconProps} />,
    gaffer: <LightbulbIcon {...iconProps} />,
    grip: <BuildIcon {...iconProps} />,
    sound_engineer: <GraphicEqIcon {...iconProps} />,
    audio_mixer: <GraphicEqIcon {...iconProps} />,
    video_editor: <TimelineIcon {...iconProps} />,
    colorist: <TimelineIcon {...iconProps} />,
    vfx_artist: <MovieIcon {...iconProps} />,
    motion_graphics: <MovieIcon {...iconProps} />,
    photographer: <CameraAltIcon {...iconProps} />,
    stylist: <FaceIcon {...iconProps} />,
    makeup_artist: <FaceIcon {...iconProps} />,
    wardrobe: <CheckroomIcon {...iconProps} />,
    location_manager: <HomeIcon {...iconProps} />,
    other: <PersonIcon {...iconProps} />,
  };
  return roleIcons[role] || <PersonIcon {...iconProps} />;
};

// Extracted CSS keyframe animations (avoid recreating in render)
const KEYFRAMES_STYLES = {
  '@keyframes activePulse': {
    '0%, 100%': { boxShadow: '0 0 12px #00d4ff, 0 0 4px #00d4ff' },
    '50%': { boxShadow: '0 0 20px #00d4ff, 0 0 8px #00d4ff' },
  },
  '@keyframes writing': {
    '0%, 100%': { transform: 'rotate(-5deg) translateY(0px)' },
    '25%': { transform: 'rotate(0deg) translateY(-2px)' },
    '50%': { transform: 'rotate(5deg) translateY(0px)' },
    '75%': { transform: 'rotate(0deg) translateY(2px)' },
  },
  '@keyframes selectionCardReveal': {
    '0%': { opacity: 0, transform: 'translateY(14px) scale(0.97)' },
    '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
  },
  '@keyframes selectionCardSheen': {
    '0%': { backgroundPosition: '130% 0' },
    '100%': { backgroundPosition: '-30% 0' },
  },
} as const;

interface CandidatePhotoFocalPoint {
  x: number;
  y: number;
}

const DEFAULT_CANDIDATE_FOCAL_POINT: CandidatePhotoFocalPoint = { x: 50, y: 50 };

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

const TAB_IDS = [
  'tabpanel-oversikt',
  'tabpanel-story-arc-studio',
  'tabpanel-roller',
  'tabpanel-kandidater',
  'tabpanel-auditions',
  'tabpanel-utvelgelse',
  'tabpanel-lokasjoner',
  'tabpanel-produksjonsplan',
  'tabpanel-team',
  'tabpanel-rekvisitter',
  'tabpanel-live-set',
  'tabpanel-producer-media',
  'tabpanel-producer-okonomi',
  'tabpanel-producer-tidslinje',
  'tabpanel-producer-reviews',
  'tabpanel-producer-eksport',
];
const STORY_ARC_TAB_INDEX = 1;
const ROLES_TAB_INDEX = 2;
const CANDIDATES_TAB_INDEX = 3;
const AUDITIONS_TAB_INDEX = 4;
const SELECTION_TAB_INDEX = 5;
const LOCATIONS_TAB_INDEX = 6;
const CALENDAR_TAB_INDEX = 7;
const TEAM_TAB_INDEX = 8;
const EQUIPMENT_TAB_INDEX = 9;
// Legacy alias for opening Shot list from other modules; now redirected into Role Room Studio
const SHOT_LIST_TAB_INDEX = 99;
const LIVE_SET_TAB_INDEX = 10;
const PRODUCER_MEDIA_TAB_INDEX = 11;
const PRODUCER_ECONOMY_TAB_INDEX = 12;
const PRODUCER_TIMELINE_TAB_INDEX = 13;
const PRODUCER_REVIEWS_TAB_INDEX = 14;
const PRODUCER_EXPORT_TAB_INDEX = 15;

const PRODUCER_PROJECT_STATUS_LABELS: Record<NonNullable<CastingProject['producerWorkflowStatus']>, string> = {
  planning: 'Planlegging',
  awaiting_client: 'Venter på klient',
  changes_requested: 'Endringer ønsket',
  approved: 'Godkjent',
};

const PRODUCER_PROJECT_STATUS_COLORS: Record<NonNullable<CastingProject['producerWorkflowStatus']>, { background: string; color: string; border: string }> = {
  planning: {
    background: 'rgba(148,163,184,0.16)',
    color: '#cbd5e1',
    border: '1px solid rgba(148,163,184,0.3)',
  },
  awaiting_client: {
    background: 'rgba(59,130,246,0.16)',
    color: '#bfdbfe',
    border: '1px solid rgba(96,165,250,0.36)',
  },
  changes_requested: {
    background: 'rgba(251,191,36,0.16)',
    color: '#fde68a',
    border: '1px solid rgba(251,191,36,0.34)',
  },
  approved: {
    background: 'rgba(52,211,153,0.16)',
    color: '#86efac',
    border: '1px solid rgba(52,211,153,0.34)',
  },
};
type SelectionPhaseFilter = 'screening' | 'callbacks' | 'final' | 'all';
type SelectionStage = Exclude<SelectionPhaseFilter, 'all'>;

interface OpenCandidateProfileEventDetail {
  candidateId?: string;
  roleId?: string;
  characterName?: string;
}

interface SelectionDecisionLogEntry {
  id: string;
  candidateId: string;
  candidateName: string;
  action: string;
  actor: string;
  createdAt: string;
}

interface SelectionMeetDraftState {
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  location: string;
}

const DEFAULT_SELECTION_MEET_DRAFT: SelectionMeetDraftState = {
  title: '',
  date: '',
  time: '',
  durationMinutes: 45,
  location: 'Google Meet',
};

type RoleRoomAdminPreviewMode = 'admin' | 'production_team' | 'content_producer' | 'client';

const ROLE_ROOM_PREVIEW_MODE_LABELS: Record<RoleRoomAdminPreviewMode, string> = {
  admin: 'Administrator',
  production_team: 'Produksjon',
  content_producer: 'Innhold',
  client: 'Klient',
};

const SELECTION_STATUS_BY_STAGE: Record<SelectionStage, string> = {
  screening: 'auditioned',
  callbacks: 'awaiting_callback',
  final: 'selected',
};

const SELECTION_LABEL_BY_STAGE: Record<SelectionStage, string> = {
  screening: 'screening',
  callbacks: 'callbacks',
  final: 'final selection',
};

const MAX_SELECTION_COMPARE = 3;
const MAX_SELECTION_DECISION_LOG_ENTRIES = 120;
const SELECTION_SCORE_WEIGHTS = {
  scenePerformance: 40,
  chemistry: 25,
  availability: 20,
  risk: 15,
} as const;
const SELECTION_WEIGHT_TOTAL = Object.values(SELECTION_SCORE_WEIGHTS).reduce((sum, value) => sum + value, 0);

function isSelectionDecisionLogEntry(value: unknown): value is SelectionDecisionLogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string'
    && typeof entry.candidateId === 'string'
    && typeof entry.candidateName === 'string'
    && typeof entry.action === 'string'
    && typeof entry.actor === 'string'
    && typeof entry.createdAt === 'string';
}

function normalizeSelectionDecisionLog(value: unknown): SelectionDecisionLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isSelectionDecisionLogEntry)
    .slice(0, MAX_SELECTION_DECISION_LOG_ENTRIES);
}

const SELECTION_SHORTCUTS: Array<{
  keys: string;
  action: string;
  scope: 'Utvelgelse';
}> = [
  { keys: 'J', action: 'Neste kandidatkort', scope: 'Utvelgelse' },
  { keys: 'K', action: 'Forrige kandidatkort', scope: 'Utvelgelse' },
  { keys: '1', action: 'Flytt kandidat til Screening', scope: 'Utvelgelse' },
  { keys: '2', action: 'Flytt kandidat til Callbacks', scope: 'Utvelgelse' },
  { keys: '3', action: 'Flytt kandidat til Final selection', scope: 'Utvelgelse' },
  { keys: 'B', action: 'Åpne/lukk Casting board', scope: 'Utvelgelse' },
  { keys: '?', action: 'Åpne denne snarvei-dialogen', scope: 'Utvelgelse' },
];

const TabPanel = memo(function TabPanel({ children, value, index, immersive = false }: TabPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  if (value !== index) {
    return null;
  }
  return (
    <Box 
      role="tabpanel"
      id={TAB_IDS[index]}
      aria-labelledby={`tab-${TAB_IDS[index].replace('tabpanel-', '')}`}
      sx={{ 
        flex: 1, 
        overflow: 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: 0, 
        width: '100%',
        padding: immersive ? 0 : (isMobile ? '8px' : isTablet ? '12px' : '16px'),
      }}
    >
      {children}
    </Box>
  );
});

// Consent status summary using consentService
const ConsentStatusSummary: FC<{ projectId: string; candidateId: string }> = ({ projectId, candidateId }) => {
  const branding = useBrandingSettings();
  const [consentCount, setConsentCount] = useState(0);
  const [signedCount, setSignedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    consentService.getConsents(projectId, candidateId)
      .then(consents => {
        if (!cancelled) {
          setConsentCount(consents.length);
          setSignedCount(consents.filter(c => c.signed).length);
        }
      })
      .catch(error => {
        console.error('Failed to load consent status:', error);
      });
    return () => { cancelled = true; };
  }, [projectId, candidateId]);

  if (consentCount === 0) return null;

  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
      <Chip
        size="small"
        icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
        label={`${signedCount}/${consentCount} ${branding.tokens.labels.consentSignedLabel}`}
        sx={{
          bgcolor: signedCount === consentCount ? 'rgba(16,185,129,0.15)' : 'rgba(255,184,0,0.15)',
          color: signedCount === consentCount ? '#10b981' : '#ffb800',
          border: `1px solid ${signedCount === consentCount ? 'rgba(16,185,129,0.3)' : 'rgba(255,184,0,0.3)'}`,
          fontSize: '0.75rem',
        }}
      />
    </Box>
  );
};

export function CastingPlannerPanel({
  onClose: _onClose,
  isFullscreen: _isFullscreen = false,
  onToggleFullscreen: _onToggleFullscreen,
  isStandalone = false,
  isGuestMode = false,
}: CastingPlannerPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const useCompactHeaderLayout = isTablet;
  const isDenseDesktopViewport = useMediaQuery('(min-width: 1024px) and (max-width: 1720px)');
  // Responsive quick-contact tiers (7-level layout scaling)
  const quickTier2 = useMediaQuery('(min-width:480px)');
  const quickTier3 = useMediaQuery('(min-width:768px)');
  const quickTier4 = useMediaQuery('(min-width:1024px)');
  const quickTier5 = useMediaQuery('(min-width:1280px)');
  const quickTier6 = useMediaQuery('(min-width:1600px)');
  const quickTier7 = useMediaQuery('(min-width:2000px)');
  const isHiDpi = useMediaQuery('(min-resolution: 2dppx), (min-resolution: 192dpi), (-webkit-min-device-pixel-ratio: 2)');
  const useDenseDesktopHeader = !useCompactHeaderLayout && isDenseDesktopViewport;
  const toast = useToast();
  const branding = useBrandingSettings();
  
  // WCAG 2.2 - 2.5.5 Target Size: minimum 44x44px touch targets
  const TOUCH_TARGET_SIZE = 44;

  // Projects loading state
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Delete confirmation dialog state (replaces window.confirm)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteContext, setConfirmDeleteContext] = useState<{
    type: 'role' | 'candidate' | 'schedule' | 'project';
    id: string;
    name: string;
  } | null>(null);

  // Unified nav sizing for mobile -> 5K + HiDPI
  const navIconSizePx = useMemo(() => {
    let base = quickTier7 ? 26 : quickTier6 ? 24 : quickTier5 ? 22 : quickTier4 ? 21 : quickTier3 ? 20 : 18;
    if (!useCompactHeaderLayout && isHiDpi) base -= 1;
    if (useDenseDesktopHeader) base -= 1;
    base = Math.max(17, base);
    return base;
  }, [quickTier3, quickTier4, quickTier5, quickTier6, quickTier7, isHiDpi, useCompactHeaderLayout, useDenseDesktopHeader]);

  const projectChipActionSizePx = useMemo(() => {
    let base = quickTier7 ? 40 : quickTier6 ? 38 : quickTier5 ? 36 : quickTier4 ? 34 : quickTier3 ? 32 : 28;
    if (!useCompactHeaderLayout && isHiDpi) base -= 1;
    if (useDenseDesktopHeader) base -= 2;
    base = Math.max(28, base);
    return base;
  }, [quickTier3, quickTier4, quickTier5, quickTier6, quickTier7, isHiDpi, useCompactHeaderLayout, useDenseDesktopHeader]);

  const navActionButtonSizePx = useMemo(() => {
    let base = quickTier7 ? 48 : quickTier6 ? 46 : quickTier5 ? 44 : quickTier4 ? 42 : quickTier3 ? 40 : 44;
    if (!useCompactHeaderLayout && isHiDpi) base -= 2;
    if (useDenseDesktopHeader) base -= 4;
    base = Math.max(useCompactHeaderLayout ? TOUCH_TARGET_SIZE : 38, base);
    return base;
  }, [quickTier3, quickTier4, quickTier5, quickTier6, quickTier7, isHiDpi, useCompactHeaderLayout, useDenseDesktopHeader]);
  const MOBILE_TOUCH_TARGET_SIZE = 48;
  const safeHeaderActionButtonSizePx = isMobile
    ? Math.max(navActionButtonSizePx, MOBILE_TOUCH_TARGET_SIZE)
    : navActionButtonSizePx;
  const safeHeaderProjectActionSizePx = isMobile
    ? Math.max(projectChipActionSizePx, MOBILE_TOUCH_TARGET_SIZE)
    : projectChipActionSizePx;
  const headerMenuItemMinHeight = isMobile ? MOBILE_TOUCH_TARGET_SIZE : TOUCH_TARGET_SIZE;
  const headerMenuPaperWidth = isMobile ? 'min(280px, calc(100vw - 24px))' : undefined;

  const tabIconBoxSizePx = useMemo(() => {
    let base = quickTier7 ? 32 : quickTier6 ? 30 : quickTier5 ? 28 : quickTier4 ? 26 : quickTier3 ? 24 : 20;
    if (isHiDpi) base += 1;
    return base;
  }, [quickTier3, quickTier4, quickTier5, quickTier6, quickTier7, isHiDpi]);

  const tabIconGlyphSizePx = useMemo(
    () => Math.max(18, tabIconBoxSizePx - 2),
    [tabIconBoxSizePx],
  );

  const navTabMinHeightPx = useMemo(() => {
    let base = quickTier7 ? 76 : quickTier6 ? 72 : quickTier5 ? 68 : isDesktop ? 64 : isTablet ? 56 : 44;
    if (isHiDpi && base < 72) base += 2;
    return base;
  }, [quickTier5, quickTier6, quickTier7, isDesktop, isTablet, isHiDpi]);

  const navTabMinWidthPx = useMemo(() => {
    if (!isDesktop) return isTablet ? 90 : 80;
    return quickTier7 ? 152 : quickTier6 ? 142 : quickTier5 ? 132 : 120;
  }, [isDesktop, isTablet, quickTier5, quickTier6, quickTier7]);

  const navTabFontSizePx = useMemo(() => {
    let base = quickTier7 ? 20 : quickTier6 ? 19 : quickTier5 ? 18 : isDesktop ? 18 : isTablet ? 14 : 12;
    if (isHiDpi) base += 1;
    return base;
  }, [quickTier5, quickTier6, quickTier7, isDesktop, isTablet, isHiDpi]);

  const navTabLabelFontSizePx = useMemo(
    () => Math.max(14, navTabFontSizePx - 2),
    [navTabFontSizePx],
  );

  const navTabMetaFontSizePx = useMemo(
    () => Math.max(10, navTabFontSizePx - 8),
    [navTabFontSizePx],
  );

  const navTabPadding = useMemo(() => {
    if (quickTier7) return '18px 24px';
    if (quickTier6) return '17px 22px';
    if (quickTier5) return '16px 20px';
    if (isDesktop) return '16px 20px';
    if (isTablet) return '12px 16px';
    return '8px 10px';
  }, [quickTier5, quickTier6, quickTier7, isDesktop, isTablet]);
  
  // Shared TextField styling for dialogs with responsive font sizes - memoized
  // Responsive: xs (0.875rem), sm (1rem), md (0.95rem), lg (1.05rem), xl (1.125rem)
  const textFieldStyles = useMemo(() => ({
    '& .MuiFormLabel-root': { 
      color: 'var(--dialog-text, #ffffff) !important',
      fontSize: { xs: '0.82rem', sm: '0.86rem', md: '0.84rem', lg: '0.9rem', xl: '0.96rem' },
      '&.Mui-focused': {
        color: 'var(--dialog-text, #ffffff) !important',
      },
      '&.MuiInputLabel-shrink': {
        color: 'var(--dialog-text, #ffffff) !important',
      },
      '&.Mui-focused.MuiInputLabel-shrink': {
        color: 'var(--dialog-text, #ffffff) !important',
      },
    },
    '& .MuiInputBase-input::placeholder': {
      color: 'rgba(255,255,255,0.88)',
      opacity: 1,
    },
    '& .MuiOutlinedInput-root': {
      color: 'var(--dialog-text, #ffffff)',
      fontSize: { xs: '0.88rem', sm: '0.92rem', md: '0.9rem', lg: '0.95rem', xl: '1rem' },
      minHeight: { xs: 44, sm: 48, md: 50, lg: 52, xl: 56 },
      bgcolor: 'var(--dialog-surface-muted, rgba(33,24,70,0.72))',
      '& fieldset': { borderColor: 'var(--dialog-border-color, rgba(184,107,255,0.32))' },
      '& input': {
        fontSize: { xs: '0.88rem', sm: '0.92rem', md: '0.9rem', lg: '0.95rem', xl: '1rem' },
        py: { xs: 1, sm: 1.1, md: 1.15, lg: 1.2, xl: 1.25 },
      },
      '& textarea': {
        fontSize: { xs: '0.88rem', sm: '0.92rem', md: '0.9rem', lg: '0.95rem', xl: '1rem' },
        py: { xs: 1, sm: 1.1, md: 1.15, lg: 1.2, xl: 1.25 },
      },
      '&:hover fieldset': { borderColor: 'var(--dialog-accent-soft, rgba(184,107,255,0.45))' },
      '&.Mui-focused fieldset': { borderColor: 'var(--dialog-accent-color, #b86bff)', borderWidth: 2 },
    },
  }), []);
  
  // Shared InputLabel styling for Select components - memoized
  const inputLabelStyles = useMemo(() => ({
    color: 'var(--dialog-text, #ffffff) !important',
    fontSize: { xs: '0.82rem', sm: '0.86rem', md: '0.84rem', lg: '0.9rem', xl: '0.96rem' },
    '&.Mui-focused': {
      color: 'var(--dialog-text, #ffffff) !important',
    },
    '&.MuiInputLabel-shrink': {
      color: 'var(--dialog-text, #ffffff) !important',
    },
    '&.Mui-focused.MuiInputLabel-shrink': {
      color: 'var(--dialog-text, #ffffff) !important',
    },
  }), []);

  const attachmentInputLabelStyles = useMemo(() => ({
    ...inputLabelStyles,
    lineHeight: 1,
    transform: 'translate(14px, -9px) scale(0.84)',
    transformOrigin: 'top left',
    '&.MuiInputLabel-shrink': {
      transform: 'translate(14px, -9px) scale(0.84)',
      color: 'var(--dialog-text, #ffffff) !important',
    },
    '&.Mui-focused.MuiInputLabel-shrink': {
      transform: 'translate(14px, -9px) scale(0.84)',
      color: 'var(--dialog-text, #ffffff) !important',
    },
  }), [inputLabelStyles]);

  const roleDialogSelectStyles = useMemo(() => ({
    color: 'var(--dialog-text, #ffffff)',
    bgcolor: 'var(--dialog-surface-muted, rgba(33,24,70,0.72))',
    minHeight: { xs: 46, sm: 48, md: 50, lg: 52, xl: 56 },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--dialog-border-color, rgba(184,107,255,0.32))' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--dialog-accent-soft, rgba(184,107,255,0.45))' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--dialog-accent-color, #b86bff)', borderWidth: 2 },
    '& .MuiSelect-select': {
      display: 'flex',
      alignItems: 'center',
      minHeight: '0 !important',
      py: { xs: 1.1, sm: 1.2, md: 1.25, lg: 1.3, xl: 1.35 },
      pr: '36px !important',
    },
    '& .MuiSvgIcon-root': {
      color: 'var(--dialog-text, #ffffff)',
    },
  }), []);
  
  // Shared MenuProps for Select components - memoized with z-index tokens
  const selectMenuProps = useMemo(() => ({
    container: document.body,
    disablePortal: false,
    disableScrollLock: true,
    sx: {
      zIndex: Z_INDEX.dialogSelect,
    },
    PaperProps: {
      sx: {
        zIndex: Z_INDEX.dialogSelect + 1,
        bgcolor: 'var(--dialog-surface, rgba(20,14,48,0.95))',
        color: 'var(--dialog-text, #f3eaff)',
        border: '1px solid var(--dialog-border-color, rgba(184,107,255,0.32))',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        mt: 0.5,
        maxHeight: { xs: 250, sm: 300, md: 280, lg: 320, xl: 400 },
        '& .MuiMenuItem-root': {
          fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
          minHeight: TOUCH_TARGET_SIZE,
          py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
          '&:hover': {
            bgcolor: 'var(--dialog-accent-hover, rgba(139,92,246,0.15))',
          },
          '&.Mui-selected': {
            bgcolor: 'var(--dialog-accent-selected, rgba(139,92,246,0.25))',
            '&:hover': {
              bgcolor: 'var(--dialog-accent-selected-hover, rgba(139,92,246,0.35))',
            },
          },
        },
      },
    },
  }), [TOUCH_TARGET_SIZE]);
  
  // Profession configuration - memoized
  const PROFESSION_CONFIG = useMemo(() => ({
    photographer: {
      name: branding.tokens.labels.professionPhotographerName,
      color: '#10b981',
      icon: PhotoCameraIcon,
      terminology: {
        project: branding.tokens.labels.termPhotoProject,
        shot: branding.tokens.labels.termPhotoShot,
        shoot: branding.tokens.labels.termPhotoShoot,
        shootDay: branding.tokens.labels.termPhotoShootDay,
        shotList: branding.tokens.labels.termPhotoShotList,
        portfolio: branding.tokens.labels.termPhotoPortfolio,
        photo: branding.tokens.labels.termPhotoSingle,
        photos: branding.tokens.labels.termPhotoPlural,
      },
      defaultCrewRoles: ['photographer', 'assistant', 'stylist'],
      shotListFields: ['aperture', 'shutter', 'iso', 'focal_length'],
      candidateRequirements: ['portfolio', 'photos'],
    },
    videographer: {
      name: branding.tokens.labels.professionVideographerName,
      color: '#8b5cf6',
      icon: VideocamIcon,
      terminology: {
        project: branding.tokens.labels.termVideoProject,
        shot: branding.tokens.labels.termVideoShot,
        shoot: branding.tokens.labels.termVideoShoot,
        shootDay: branding.tokens.labels.termVideoShootDay,
        shotList: branding.tokens.labels.termVideoShotList,
        portfolio: branding.tokens.labels.termVideoPortfolio,
        photo: branding.tokens.labels.termVideoSingle,
        photos: branding.tokens.labels.termVideoPlural,
      },
      defaultCrewRoles: ['director', 'camera_operator', 'sound_engineer', 'gaffer'],
      shotListFields: ['fps', 'resolution', 'codec', 'audio_channels'],
      candidateRequirements: ['showreel', 'demo_reel'],
    },
  }), [branding.tokens.labels]);
  
type StoryArcView = 'main' | 'story-logic' | 'story-writer' | 'shot-list' | 'planning';
type ContentProducerPlannerSurface = 'overview' | 'project_room' | 'approval' | 'delivery' | 'economy';
type ContentProducerResumeTarget = {
  surface: ContentProducerPlannerSurface;
  mediaFocus?: ClientPortalWorkspaceFocus | null;
};
type RoleRoomWorkspaceSurfaceKey =
  | 'dashboard'
  | 'roles'
  | 'candidates'
  | 'auditions'
  | 'selection'
  | 'locations'
  | 'calendar'
  | 'team'
  | 'equipment'
  | 'live_set'
  | `story_arc:${StoryArcView}`
  | `planner:${ContentProducerPlannerSurface}`
  | 'producer_media'
  | 'producer_economy'
  | 'producer_timeline'
  | 'producer_reviews'
  | 'producer_export';
type RoleRoomWorkspaceScrollState = {
  top: number;
  left: number;
  updatedAt: string;
};
type RoleRoomWorkspaceFilterState = {
  candidateStatusFilter?: string;
  candidateViewMode?: 'list' | 'kanban';
  selectionPhaseFilter?: SelectionPhaseFilter;
  calendarViewMode?: 'production' | 'crew';
  contentProducerPlannerSurface?: ContentProducerPlannerSurface;
  producerMediaWorkspace?: string | null;
};
type RoleRoomWorkspaceSortState = {
  key: string;
  direction: 'asc' | 'desc';
};
type RoleRoomProjectWorkspaceState = {
  projectId: string;
  activeTab: number;
  storyArcView: StoryArcView;
  storyArcFocus?: StoryArcNavigationFocus | null;
  contentProducerPlannerSurface?: ContentProducerPlannerSurface;
  producerMediaFocus?: ClientPortalWorkspaceFocus | null;
  contentProducerResumeTarget?: ContentProducerResumeTarget | null;
  scrollBySurface?: Partial<Record<RoleRoomWorkspaceSurfaceKey, RoleRoomWorkspaceScrollState>>;
  filtersBySurface?: Partial<Record<RoleRoomWorkspaceSurfaceKey, RoleRoomWorkspaceFilterState>>;
  sortingBySurface?: Partial<Record<RoleRoomWorkspaceSurfaceKey, RoleRoomWorkspaceSortState>>;
  updatedAt: string;
};
  const CONTENT_PRODUCER_PLANNER_SURFACE_ITEMS: Array<{
    value: ContentProducerPlannerSurface;
    label: string;
    description: string;
  }> = [
    {
      value: 'overview',
      label: 'Oversikt',
      description: 'Se fremdrift, varsler, møter og administrative blokker i én samlet startflate.',
    },
    {
      value: 'project_room',
      label: 'Prosjektrom',
      description: 'Jobb med brief, materialer, storyboard, manus, shotlist og prosjektgrunnlag.',
    },
    {
      value: 'approval',
      label: 'Godkjenning',
      description: 'Samle klientfeedback, beslutninger og endringer som må avklares før neste steg.',
    },
    {
      value: 'delivery',
      label: 'Levering',
      description: 'Hold kontroll på leveranser, eksport, overlevering og hva som faktisk er klart til utsending.',
    },
    {
      value: 'economy',
      label: 'Økonomi',
      description: 'Følg budsjett, økonomiske beslutninger og hva som må godkjennes kommersielt.',
    },
  ];
  type RoleRoomWorkspaceState = {
    projectId: string | null;
    lastRealProjectId?: string | null;
    activeTab: number;
    storyArcView: StoryArcView;
    storyArcFocus?: StoryArcNavigationFocus | null;
    contentProducerPlannerSurface?: ContentProducerPlannerSurface;
    producerMediaFocus?: ClientPortalWorkspaceFocus | null;
    contentProducerResumeTarget?: ContentProducerResumeTarget | null;
    projectStates?: Record<string, RoleRoomProjectWorkspaceState>;
    updatedAt?: string;
  };
  const [activeTab, setActiveTab] = useState(() => {
    // Hydrate from URL on mount so hard-refresh / direct deep-link lands
    // on the same tab the user was on. Ignore in client-portal mode
    // (its own URL schema handles navigation).
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    if (params.get('portal') === 'client') return 0;
    const slug = params.get('tab');
    if (slug) {
      const byName = TAB_IDS.findIndex((id) => id === `tabpanel-${slug}`);
      if (byName >= 0) return byName;
      // Back-compat: older URLs used numeric tab index.
      const parsed = parseInt(slug, 10);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    return 0;
  });
  const [lastNonLiveTab, setLastNonLiveTab] = useState(0);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState<boolean>(() => (
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  ));
  const [teamDashboardOpenSignal, setTeamDashboardOpenSignal] = useState(0);
  const [teamDashboardDefaultSegment, setTeamDashboardDefaultSegment] = useState<'all' | 'technical'>('all');
  const [storyArcView, setStoryArcView] = useState<StoryArcView>('main');
  const [storyArcFocus, setStoryArcFocus] = useState<StoryArcNavigationFocus | null>(null);
  const [selectionPhaseFilter, setSelectionPhaseFilter] = useState<SelectionPhaseFilter>('screening');
  const [selectedSelectionCandidateId, setSelectedSelectionCandidateId] = useState<string | null>(null);
  const [selectionCompareCandidateIds, setSelectionCompareCandidateIds] = useState<string[]>([]);
  const [selectionDecisionLog, setSelectionDecisionLog] = useState<SelectionDecisionLogEntry[]>([]);
  const [selectionSelfTapeIndexByCandidate, setSelectionSelfTapeIndexByCandidate] = useState<Record<string, number>>({});
  const [selectionBoardMode, setSelectionBoardMode] = useState(false);
  const [selectionShortcutsOpen, setSelectionShortcutsOpen] = useState(false);
  const [selectionNotesDraft, setSelectionNotesDraft] = useState('');
  const [selectionNotesSaving, setSelectionNotesSaving] = useState(false);
  const [selectionNotesTagExclusions, setSelectionNotesTagExclusions] = useState<string[]>([]);
  const [contentProducerPlannerSurface, setContentProducerPlannerSurface] = useState<ContentProducerPlannerSurface>('overview');
  const [contentProducerResumeTarget, setContentProducerResumeTarget] = useState<ContentProducerResumeTarget | null>(null);
  const [selectionGoogleStatus, setSelectionGoogleStatus] = useState<RoleRoomGoogleStatusResponse | null>(null);
  const [selectionGoogleStatusLoading, setSelectionGoogleStatusLoading] = useState(false);
  const [selectionMeetBusy, setSelectionMeetBusy] = useState(false);
  const [selectionMeetDraft, setSelectionMeetDraft] = useState<SelectionMeetDraftState>(DEFAULT_SELECTION_MEET_DRAFT);
  const [globalTagRegistry, setGlobalTagRegistry] = useState<string[]>([]);
  const [globalTagRegistryLoaded, setGlobalTagRegistryLoaded] = useState(false);
  const [storyLogicData, setStoryLogicData] = useState<StoryLogicState | null>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'production' | 'crew'>('production');
  const [projects, setProjects] = useState<CastingProject[]>([]);
  const [currentProject, setCurrentProject] = useState<CastingProject | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  const [candidateDialogOpen, setCandidateDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [sharingDialogOpen, setSharingDialogOpen] = useState(false);
  const [calendarCreateIntent, setCalendarCreateIntent] = useState<null | 'location' | 'candidate' | 'crew' | 'equipment'>(null);
  const [calendarReopenSignal, setCalendarReopenSignal] = useState(0);
  const [calendarPreselectedFromCreate, setCalendarPreselectedFromCreate] = useState<{
    locationId?: string;
    candidateId?: string;
    crewId?: string;
    equipmentId?: string;
  } | null>(null);
  const [externalLocationCreateSignal, setExternalLocationCreateSignal] = useState(0);
  const [externalCrewCreateSignal, setExternalCrewCreateSignal] = useState(0);
  const [externalEquipmentCreateSignal, setExternalEquipmentCreateSignal] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showTutorialEditor, setShowTutorialEditor] = useState(false);
  const [previewTutorial, setPreviewTutorial] = useState<Tutorial | null>(null);

  const [availableScenes, setAvailableScenes] = useState<Array<{ id: string; name: string; thumbnail?: string }>>([]);
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<string>('all');
  const [candidateViewMode, setCandidateViewMode] = useState<'list' | 'kanban'>('list');
  const [draggedCandidate, setDraggedCandidate] = useState<Candidate | null>(null);
  const [quickContactIds, setQuickContactIds] = useState<Set<string>>(new Set());
  const [quickContactsLoaded, setQuickContactsLoaded] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<Awaited<ReturnType<typeof castingAuthService.getUserRole>> | null>(null);
  
  // Permissions state for role-based tab visibility
  const [permissions, setPermissions] = useState<{
    canViewAll: boolean;
    canEditCasting: boolean;
    canEditProduction: boolean;
    canEditShotLists: boolean;
    canManageCrew: boolean;
    canManageLocations: boolean;
    canApprove: boolean;
    canComment: boolean;
    canRequestChanges: boolean;
    canViewEconomy: boolean;
  }>({
    canViewAll: false,
    canEditCasting: false,
    canEditProduction: false,
    canEditShotLists: false,
    canManageCrew: false,
    canManageLocations: false,
    canApprove: false,
    canComment: false,
    canRequestChanges: false,
    canViewEconomy: false,
  });
  const producerAccess = useProducerAccess(currentUserRole, permissions);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [producerWorkflowBootstrapVersion, setProducerWorkflowBootstrapVersion] = useState(0);
  
  // Ref to track current project ID for stale response detection
  const currentProjectIdRef = useRef<string | null>(null);
  const currentProjectRef = useRef<CastingProject | null>(null);
  const persistedWorkspaceStateRef = useRef<RoleRoomWorkspaceState | null>(null);
  const workspaceRootRef = useRef<HTMLDivElement | null>(null);
  const workspaceRestoreProjectIdRef = useRef<string | null>(null);
  const workspacePersistTimerRef = useRef<number | null>(null);
  const projectSwitchInFlightRef = useRef<string | null>(null);
  const projectSwitchTraceRef = useRef<{
    fromProjectId: string | null;
    targetProjectId: string;
    startedAt: number;
    activeTab: number;
  } | null>(null);
  const lastPermissionsLoadingRef = useRef<boolean | null>(null);
  const producerWorkflowBootstrappedProjectsRef = useRef<Set<string>>(new Set());
  
  const [profession, setProfession] = useState<'photographer' | 'videographer' | null>(null);
  const [professionDialogOpen, setProfessionDialogOpen] = useState(false);
  
  // Map profession to onboarding profession type
  const getOnboardingProfession = (): ProfessionType | null => {
    if (!profession) return null;
    const sessionAdminUser = authSessionService.getSessionSync().adminUser;
    const normalizedLoginAs = String(sessionAdminUser?.loginAs || '').trim().toLowerCase();
    const normalizedRequestedRole = String(sessionAdminUser?.requestedRole || '').trim().toLowerCase();
    const normalizedRole = String(sessionAdminUser?.role || '').trim().toLowerCase();
    const isProducerLogin = normalizedLoginAs === 'content_producer'
      || normalizedRequestedRole === 'content_producer'
      || normalizedRequestedRole === 'client'
      || normalizedRole === 'content_producer'
      || normalizedRole === 'client_reviewer';
    if (isProducerLogin) return 'producer';
    if (profession === 'photographer') return 'photographer';
    if (profession === 'videographer') return 'director';
    return 'general';
  };
  
  // Profession onboarding hook
  const onboardingProfession = getOnboardingProfession();
  const { 
    showOnboarding, 
    closeOnboarding, 
    triggerOnboarding: triggerProfessionOnboarding,
    resetOnboarding 
  } = useProfessionOnboarding(onboardingProfession);
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [consentContractDialogOpen, setConsentContractDialogOpen] = useState(false);
  const [sendConsentOnSave, setSendConsentOnSave] = useState(false);
  const [adminDashboardOpen, setAdminDashboardOpen] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [billingAccountDialogOpen, setBillingAccountDialogOpen] = useState(false);
  const [billingAccount, setBillingAccount] = useState<RoleRoomCommercialBillingAccount | null>(null);
  const [billingAccountLoading, setBillingAccountLoading] = useState(false);
  const [billingAccountError, setBillingAccountError] = useState<string | null>(null);
  const [billingActionPending, setBillingActionPending] = useState(false);
  type RoleRoomAdminUser = {
    id: number | string;
    email: string;
    role: string;
    display_name: string;
    name?: string;
    loginAs?: string;
    requestedRole?: string | null;
  };
  const normalizeAdminUser = (user?: RoleRoomAdminUser | null) => {
    if (!user) return null;
    return {
      ...user,
      id: user.id,
      display_name: user.display_name || user.name || user.email.split('@')[0],
    };
  };
  const [adminUser, setAdminUser] = useState<RoleRoomAdminUser | null>(
    () => normalizeAdminUser(authSessionService.getSessionSync().adminUser)
  );
  const inferredSessionProjectRole = useMemo<UserRoleType | null>(() => {
    const normalizedLoginAs = String(adminUser?.loginAs || '').trim().toLowerCase();
    const normalizedRequestedRole = String(adminUser?.requestedRole || '').trim().toLowerCase();
    const normalizedRole = String(adminUser?.role || '').trim().toLowerCase();

    if (normalizedLoginAs === 'content_producer') {
      return normalizedRequestedRole === 'client' ? 'client_reviewer' : 'content_producer';
    }

    if (normalizedLoginAs === 'production_team' && normalizedRequestedRole) {
      if (normalizedRequestedRole === 'client') {
        return 'client_reviewer';
      }
      if (['film_photographer', 'photographer', 'photo_director', 'photo_assistant'].includes(normalizedRequestedRole)) {
        return 'content_producer';
      }
      if (
        [
          'director',
          'producer',
          'casting_director',
          'production_manager',
          'camera_team',
          'writer',
          'script_editor',
          'reader',
          'agency',
        ].includes(normalizedRequestedRole)
      ) {
        return normalizedRequestedRole as UserRoleType;
      }
    }

    if (!normalizedRole) return null;
    if (normalizedRole === 'owner' || normalizedRole === 'super_admin') return 'director';
    if (normalizedRole === 'admin') return 'producer';
    if (normalizedRole === 'content_producer') return 'content_producer';
    if (normalizedRole === 'client_reviewer' || normalizedRole === 'client') return 'client_reviewer';
    if (
      [
        'director',
        'producer',
        'casting_director',
        'production_manager',
        'camera_team',
        'writer',
        'script_editor',
        'reader',
        'agency',
      ].includes(normalizedRole)
    ) {
      return normalizedRole as UserRoleType;
    }
    if (['photographer', 'film_photographer', 'photo_director', 'photo_assistant'].includes(normalizedRole)) {
      return 'content_producer';
    }
    return null;
  }, [adminUser?.loginAs, adminUser?.requestedRole, adminUser?.role]);
  const isContentProducerMode = inferredSessionProjectRole === 'content_producer' || producerAccess.isContentProducerMode;
  const isClientReviewerMode = inferredSessionProjectRole === 'client_reviewer' || producerAccess.isClientReviewerMode;
  const canSwitchRoleRoomRole = adminUser?.role === 'owner' || adminUser?.role === 'admin';
  const [authLoaded, setAuthLoaded] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<CastingProject | null>(null);
  const [projectCreationModalOpen, setProjectCreationModalOpen] = useState(false);
  const [projectCreationModalKey, setProjectCreationModalKey] = useState(0);
  const [projectCreationDialogTab, setProjectCreationDialogTab] = useState<'new' | 'existing'>('new');
  const [projectToEdit, setProjectToEdit] = useState<CastingProject | null>(null);
  const [projectCreationPrefill, setProjectCreationPrefill] = useState<Partial<CastingProject> | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const clientPortalIntent = useMemo(
    () => parseClientPortalIntentFromWindow(),
    [],
  );
  const roleRoomGoogleIntent = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        status: null as string | null,
        transferId: null as string | null,
        mode: null as 'login' | 'link' | null,
        message: null as string | null,
      };
    }
    const params = new URLSearchParams(window.location.search);
    const modeValue = params.get('rrGoogleMode');
    return {
      status: params.get('rrGoogleStatus'),
      transferId: params.get('rrGoogleTransfer'),
      mode: modeValue === 'login' || modeValue === 'link' ? modeValue : null,
      message: params.get('rrGoogleMessage'),
    };
  }, []);
  const roleRoomLinkedInIntent = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        status: null as string | null,
        transferId: null as string | null,
        mode: null as 'link' | null,
        message: null as string | null,
      };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      status: params.get('rrLinkedInStatus'),
      transferId: params.get('rrLinkedInTransfer'),
      mode: params.get('rrLinkedInMode') === 'link' ? 'link' : null,
      message: params.get('rrLinkedInMessage'),
    };
  }, []);
  const isExternalClientPortalMode = Boolean(clientPortalIntent);
  const appliedClientPortalIntentRef = useRef<string | null>(null);
  const handledGoogleTransferRef = useRef<string | null>(null);
  const handledLinkedInTransferRef = useRef<string | null>(null);
  const selectionGoogleStatusRequestRef = useRef(0);
  const [producerMediaFocus, setProducerMediaFocus] = useState<ClientPortalWorkspaceFocus | null>(null);
  const lastProducerMediaFocusRef = useRef<ClientPortalWorkspaceFocus | null>(null);

  const handleOpenTechnicalTeamDashboard = useCallback(() => {
    setTeamDashboardDefaultSegment('technical');
    setTeamDashboardOpenSignal((current) => current + 1);
    setStoryArcView('shot-list');
    setActiveTab(STORY_ARC_TAB_INDEX);
  }, []);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
  const [projectSelectorQuery, setProjectSelectorQuery] = useState('');
  const [producerInboxOpen, setProducerInboxOpen] = useState(false);
  const [projectQuickActionsAnchorEl, setProjectQuickActionsAnchorEl] = useState<HTMLElement | null>(null);
  const [projectQuickActionsProject, setProjectQuickActionsProject] = useState<CastingProject | null>(null);
  const [projectCopyDialog, setProjectCopyDialog] = useState<{
    project: CastingProject;
    closeSelector?: boolean;
    name: string;
    includeClientData: boolean;
    includeReviewHistory: boolean;
    includeEconomy: boolean;
    includeTeam: boolean;
    includeProductionData: boolean;
  } | null>(null);
  const [projectCopySubmitting, setProjectCopySubmitting] = useState(false);
  const [headerToolsAnchorEl, setHeaderToolsAnchorEl] = useState<HTMLElement | null>(null);
  const [pinnedProjectIds, setPinnedProjectIds] = useState<string[]>([]);
  const [draggingPinnedProjectId, setDraggingPinnedProjectId] = useState<string | null>(null);
  const [publishedTemplates, setPublishedTemplates] = useState<CastingProject[]>([]);
  const [projectSyncMetaById, setProjectSyncMetaById] = useState<Record<string, RoleRoomProjectSyncMeta>>({});
  const [projectSyncActionProjectId, setProjectSyncActionProjectId] = useState<string | null>(null);
  const {
    items: producerInboxItems,
    loading: producerInboxLoading,
    error: producerInboxError,
    unreadCount: producerInboxUnreadCount,
    reload: reloadProducerInbox,
    markAsRead: markProducerInboxAsRead,
    markAllAsRead: markAllProducerInboxAsRead,
    archiveNotification: archiveProducerInboxNotification,
    resolveNotification: resolveProducerInboxNotification,
  } = useProducerNotifications(currentProject?.id, producerInboxOpen ? 15000 : 30000);
  const visibleProducerInboxItems = useMemo(
    () => producerInboxItems.filter((item) => !item.archived_at),
    [producerInboxItems],
  );
  const openProducerInbox = useCallback(() => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setProducerInboxOpen(true);
    void reloadProducerInbox();
  }, [reloadProducerInbox]);
  const unsavedProjectSwitchStateRef = useRef<Record<string, string>>({});

  // Keep the UI fallback aligned with settingsService/castingService demo seeds.
  const getUserId = useCallback((): string => {
    const session = authSessionService.getSessionSync();
    if (session.currentUserId) return session.currentUserId;
    if (session.adminUser?.id !== undefined && session.adminUser?.id !== null) {
      return String(session.adminUser.id);
    }
    return 'default-user';
  }, []);

  const getSettingsUserId = useCallback((): string => {
    if (adminUser?.id !== undefined && adminUser?.id !== null) {
      return String(adminUser.id);
    }
    return getUserId();
  }, [adminUser?.id, getUserId]);
  const setUnsavedProjectSwitchSource = useCallback((source: string, hasUnsaved: boolean, reason?: string) => {
    if (!source) {
      return;
    }
    if (hasUnsaved) {
      unsavedProjectSwitchStateRef.current[source] = reason || source;
      return;
    }
    delete unsavedProjectSwitchStateRef.current[source];
  }, []);
  const confirmProjectSwitchIfNeeded = useCallback((targetProject: CastingProject): boolean => {
    const activeUnsavedReasons = Array.from(new Set(
      Object.values(unsavedProjectSwitchStateRef.current)
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ));

    if (activeUnsavedReasons.length === 0) {
      return true;
    }

    const reasonText = activeUnsavedReasons.length === 1
      ? activeUnsavedReasons[0]
        : `${activeUnsavedReasons.slice(0, -1).join(', ')} og ${activeUnsavedReasons[activeUnsavedReasons.length - 1]}`;

    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      return true;
    }

    return window.confirm(
      `Du har ulagret arbeid i ${reasonText}. Hvis du bytter til "${targetProject.name}", kan endringene gå tapt. Vil du fortsette?`,
    );
  }, []);

  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);

  useEffect(() => {
    if (!producerMediaFocus) {
      return;
    }
    if (!producerMediaFocus.workspace && !producerMediaFocus.sectionId && !producerMediaFocus.pageId && !producerMediaFocus.artifactId) {
      return;
    }
    lastProducerMediaFocusRef.current = producerMediaFocus;
  }, [producerMediaFocus]);

  useEffect(() => {
    const persisted = persistedWorkspaceStateRef.current;
    const projectWorkspaceState = currentProject?.id
      ? persisted?.projectStates?.[currentProject.id] ?? null
      : null;
    workspaceRestoreProjectIdRef.current = currentProject?.id ?? null;
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        if (workspaceRestoreProjectIdRef.current === (currentProject?.id ?? null)) {
          workspaceRestoreProjectIdRef.current = null;
        }
      }, 0);
    } else {
      workspaceRestoreProjectIdRef.current = null;
    }
    lastProducerMediaFocusRef.current = projectWorkspaceState?.producerMediaFocus
      ?? (persisted?.projectId === (currentProject?.id ?? null) ? (persisted.producerMediaFocus ?? null) : null);
    setSelectedSelectionCandidateId(null);
    setSelectionCompareCandidateIds([]);
    setSelectionDecisionLog([]);
    setSelectionSelfTapeIndexByCandidate({});
    setSelectedRole(null);
    setSelectedCandidate(null);
    setSelectedSchedule(null);
    setSelectionPhaseFilter('screening');
    setSelectionNotesTagExclusions([]);
    setSelectionNotesSaving(false);
    setSelectionGoogleStatus(null);
    setSelectionGoogleStatusLoading(false);
    setSelectionMeetBusy(false);
    setSelectionMeetDraft(DEFAULT_SELECTION_MEET_DRAFT);
    setCalendarViewMode(projectWorkspaceState?.filtersBySurface?.calendar?.calendarViewMode ?? 'production');
    setCalendarCreateIntent(null);
    setCalendarPreselectedFromCreate(null);
    setStoryArcView(projectWorkspaceState?.storyArcView ?? 'main');
    setStoryArcFocus(projectWorkspaceState?.storyArcFocus ?? null);
    setAvailableScenes([]);
    setCandidateStatusFilter(projectWorkspaceState?.filtersBySurface?.candidates?.candidateStatusFilter ?? 'all');
    setCandidateViewMode(projectWorkspaceState?.filtersBySurface?.candidates?.candidateViewMode ?? 'list');
    setDraggedCandidate(null);
    setQuickContactIds(new Set());
    setQuickContactsLoaded(false);
    setRoleDialogOpen(false);
    setCandidateDialogOpen(false);
    setScheduleDialogOpen(false);
    setSharingModalOpen(false);
    setSharingDialogOpen(false);
    setConsentContractDialogOpen(false);
    setSendConsentOnSave(false);
    setSelectionBoardMode(false);
    setSelectionShortcutsOpen(false);
    setSelectionNotesDraft('');
    setSelectionPhaseFilter(projectWorkspaceState?.filtersBySurface?.selection?.selectionPhaseFilter ?? 'screening');
    setContentProducerPlannerSurface(projectWorkspaceState?.contentProducerPlannerSurface ?? 'overview');
    setContentProducerResumeTarget(projectWorkspaceState?.contentProducerResumeTarget ?? null);
    setProducerMediaFocus(projectWorkspaceState?.producerMediaFocus ?? null);
    setActiveTab(projectWorkspaceState?.activeTab ?? 0);
    setShowTutorial(false);
    setShowTutorialEditor(false);
    setPreviewTutorial(null);
    setAdminDashboardOpen(false);
    setBillingAccountDialogOpen(false);
    setProjectQuickActionsAnchorEl(null);
    setProjectQuickActionsProject(null);
    setProjectSelectorQuery('');
  }, [currentProject?.id]);

  useEffect(() => {
    const persisted = persistedWorkspaceStateRef.current;
    const projectWorkspaceState = currentProject?.id
      ? persisted?.projectStates?.[currentProject.id] ?? null
      : null;
    if (!currentProject || !projectWorkspaceState) {
      return;
    }
    if (projectWorkspaceState.producerMediaFocus) {
      setProducerMediaFocus(projectWorkspaceState.producerMediaFocus);
      lastProducerMediaFocusRef.current = projectWorkspaceState.producerMediaFocus;
    }
    if (projectWorkspaceState.storyArcFocus) {
      setStoryArcFocus(projectWorkspaceState.storyArcFocus);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    if (!isRoleRoomDiagnosticsEnabled()) {
      return;
    }
    clearRoleRoomDiagnostics();
    logRoleRoomDiagnostic('diagnostics:ready', {
      currentProjectId: currentProject?.id ?? null,
      note: 'Inspect window.__roleRoomDiagnostics or filter console on [RoleRoomDiag].',
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPinnedProjects = async () => {
      try {
        const stored = await settingsService.getSetting<string[]>(pinnedProjectsNamespace, { userId: getSettingsUserId() });
        if (!cancelled) {
          setPinnedProjectIds(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : []);
        }
      } catch (error) {
        if (!cancelled) {
          setPinnedProjectIds([]);
        }
        console.warn('Failed to load pinned projects:', error);
      }
    };

    void loadPinnedProjects();

    return () => {
      cancelled = true;
    };
  }, [getSettingsUserId]);

  // Preload lazily-rendered dialog modules after initial mount so first open
  // does not suspend during a synchronous user interaction.
  useEffect(() => {
    void Promise.allSettled([
      import('./CastingProfessionDialog'),
      import('./CastingSharingDialog'),
      import('./SharingPanel'),
      import('./AdminDashboard'),
      import('./LoginDialog'),
      import('./CastingPlannerTutorial'),
      import('./TutorialEditorPanel'),
      import('./ConsentContractDialog'),
      import('./ConsentManagementPanel'),
      import('./ProfessionOnboardingDialog'),
    ]);
  }, []);

  const blurActiveElement = useCallback(() => {
    if (typeof document === 'undefined') return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  }, []);

  const requestLiveSetFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      setIsBrowserFullscreen(true);
      return;
    }
    const root = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
    if (typeof root.requestFullscreen !== 'function') return;
    try {
      await root.requestFullscreen();
      setIsBrowserFullscreen(true);
    } catch {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
      toast.showInfo('Nettleseren blokkerte fullskjerm. Trykk fullskjerm-knappen igjen.');
    }
  }, [toast]);

  const exitLiveSetFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      setIsBrowserFullscreen(false);
      return;
    }
    try {
      await document.exitFullscreen();
    } catch {
      // ignore fullscreen exit errors
    } finally {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const navigateToTab = useCallback((
    tabIndex: number,
    options?: {
      storyArcView?: StoryArcView;
      storyArcFocus?: StoryArcNavigationFocus | null;
    },
  ) => {
    const commitTab = (nextTab: number) => {
      if (activeTab === LIVE_SET_TAB_INDEX && nextTab !== LIVE_SET_TAB_INDEX) {
        void exitLiveSetFullscreen();
        flushSync(() => setActiveTab(nextTab));
        return;
      }
      setActiveTab(nextTab);
    };

    if (tabIndex === SHOT_LIST_TAB_INDEX) {
      setStoryArcView('shot-list');
      if (options && 'storyArcFocus' in options) {
        setStoryArcFocus(normalizeStoryArcNavigationFocus(options.storyArcFocus));
      }
      commitTab(STORY_ARC_TAB_INDEX);
      return;
    }
    if (tabIndex === LIVE_SET_TAB_INDEX && !currentProject) {
      setProjectSelectorOpen(true);
      toast.showWarning('Velg prosjekt før du åpner Live Set.');
      return;
    }
    if (tabIndex === LIVE_SET_TAB_INDEX) {
      void requestLiveSetFullscreen();
    }
    if (tabIndex === STORY_ARC_TAB_INDEX) {
      setStoryArcView(options?.storyArcView ?? 'main');
      if (options && 'storyArcFocus' in options) {
        setStoryArcFocus(normalizeStoryArcNavigationFocus(options.storyArcFocus));
      }
    }
    commitTab(tabIndex);
  }, [activeTab, currentProject, exitLiveSetFullscreen, requestLiveSetFullscreen, toast]);

  const openContentProducerPlannerSurface = useCallback((
    surface: ContentProducerPlannerSurface,
    options?: {
      mediaFocus?: ClientPortalWorkspaceFocus | null;
      focusPayload?: Omit<ProducerWorkflowFocusPayload, 'projectId' | 'panel'>;
      focusPanel?: 'reviews' | 'economy';
    },
  ) => {
    if (options && 'mediaFocus' in options) {
      setProducerMediaFocus(options.mediaFocus ?? null);
    }
    setContentProducerPlannerSurface(surface);
    navigateToTab(STORY_ARC_TAB_INDEX, { storyArcView: 'planning' });

    if (currentProject && options?.focusPayload && options.focusPanel) {
      window.setTimeout(() => {
        emitProducerWorkflowFocusEvent({
          projectId: currentProject.id,
          panel: options.focusPanel,
          ...options.focusPayload,
        });
      }, 100);
    }
  }, [currentProject, navigateToTab]);

  const navigateToProducerWorkflowTabWithFocus = useCallback((
    tabIndex: number,
    focus?: Omit<ProducerWorkflowFocusPayload, 'projectId' | 'panel'>,
  ) => {
    if (isContentProducerMode) {
      if (tabIndex === PRODUCER_MEDIA_TAB_INDEX) {
        openContentProducerPlannerSurface('project_room');
        return;
      }
      if (tabIndex === PRODUCER_REVIEWS_TAB_INDEX) {
        openContentProducerPlannerSurface('approval', {
          focusPanel: 'reviews',
          focusPayload: focus,
        });
        return;
      }
      if (tabIndex === PRODUCER_EXPORT_TAB_INDEX) {
        openContentProducerPlannerSurface('delivery');
        return;
      }
      if (tabIndex === PRODUCER_ECONOMY_TAB_INDEX) {
        openContentProducerPlannerSurface('economy', {
          focusPanel: 'economy',
          focusPayload: focus,
        });
        return;
      }
      if (tabIndex === PRODUCER_TIMELINE_TAB_INDEX) {
        openContentProducerPlannerSurface('overview');
        return;
      }
    }

    if (!currentProject) {
      return;
    }

    const panel = tabIndex === PRODUCER_TIMELINE_TAB_INDEX
      ? 'timeline'
      : tabIndex === PRODUCER_REVIEWS_TAB_INDEX
        ? 'reviews'
        : 'economy';

    navigateToTab(tabIndex);
    window.setTimeout(() => {
      emitProducerWorkflowFocusEvent({
        projectId: currentProject.id,
        panel,
        ...focus,
      });
    }, 80);
  }, [currentProject, isContentProducerMode, navigateToTab, openContentProducerPlannerSurface]);

  const navigateToProducerMediaWorkspace = useCallback((focus?: ClientPortalWorkspaceFocus) => {
    if (isContentProducerMode) {
      openContentProducerPlannerSurface('project_room', {
        mediaFocus: focus ?? null,
      });
      return;
    }
    setProducerMediaFocus(focus ?? null);
    navigateToTab(PRODUCER_MEDIA_TAB_INDEX);
  }, [isContentProducerMode, navigateToTab, openContentProducerPlannerSurface]);

  const openContentProducerCreativeTool = useCallback((
    tool: 'storyboard' | 'story-writer' | 'shot-list' | 'story-logic',
  ) => {
    if (tool === 'storyboard') {
      openContentProducerPlannerSurface('project_room', {
        mediaFocus: { workspace: 'storyboard' },
      });
      return;
    }

    navigateToTab(STORY_ARC_TAB_INDEX, {
      storyArcView: tool,
      storyArcFocus: storyArcFocus ?? null,
    });
  }, [navigateToTab, openContentProducerPlannerSurface, storyArcFocus]);

  const queueProducerReviewCreate = useCallback(async (draft: {
    reviewType: string;
    title: string;
    description?: string;
    targetEntityType?: string;
    targetEntityId?: string;
    openReviewsAfterCreate?: boolean;
  }) => {
    if (!currentProject) {
      toast.showWarning('Velg prosjekt før du sender til klientgodkjenning.');
      return;
    }

    const approvalTemplate = draft.reviewType === 'storyboard'
      || draft.reviewType === 'manuscript'
      || draft.reviewType === 'shotlist'
      ? draft.reviewType
      : undefined;

    if (!approvalTemplate) {
      toast.showWarning('Denne klientgodkjenningen må opprettes fra økonomisenteret.');
      return;
    }

    toast.showSuccess(`${draft.title} er klargjort i økonomisenteret.`);
    navigateToProducerWorkflowTabWithFocus(PRODUCER_ECONOMY_TAB_INDEX, {
      economyView: 'approvals',
      approvalTemplate,
      linkedEntityType: draft.targetEntityType,
      linkedEntityId: draft.targetEntityId,
      focusedPhase: 'preproduction',
    });
  }, [currentProject, navigateToProducerWorkflowTabWithFocus, toast]);

  useEffect(() => {
    if (activeTab === LIVE_SET_TAB_INDEX && !currentProject) {
      void exitLiveSetFullscreen();
      setActiveTab(0);
    }
  }, [activeTab, currentProject, exitLiveSetFullscreen]);

  useEffect(() => {
    if (activeTab !== LIVE_SET_TAB_INDEX) {
      setLastNonLiveTab(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (projectSelectorOpen) {
      setProjectSelectorQuery('');
    }
  }, [projectSelectorOpen]);

  const getTabReturnLabel = useCallback((tabIndex: number): string => {
    const activePlannerSurfaceLabel = CONTENT_PRODUCER_PLANNER_SURFACE_ITEMS.find((item) => item.value === contentProducerPlannerSurface)?.label ?? 'Oversikt';
    switch (tabIndex) {
      case STORY_ARC_TAB_INDEX:
        return isContentProducerMode ? `Planner · ${activePlannerSurfaceLabel}` : 'Role Room Studio';
      case ROLES_TAB_INDEX:
        return branding.tokens.labels.roles;
      case CANDIDATES_TAB_INDEX:
        return branding.tokens.labels.candidates;
      case AUDITIONS_TAB_INDEX:
        return branding.tokens.labels.auditions;
      case SELECTION_TAB_INDEX:
        return 'Utvelgelse';
      case LOCATIONS_TAB_INDEX:
        return branding.tokens.labels.locations;
      case CALENDAR_TAB_INDEX:
        return branding.tokens.labels.schedule;
      case TEAM_TAB_INDEX:
        return branding.tokens.labels.team;
      case EQUIPMENT_TAB_INDEX:
        return branding.tokens.labels.equipment;
      case PRODUCER_MEDIA_TAB_INDEX:
        return 'Prosjektrom';
      case PRODUCER_ECONOMY_TAB_INDEX:
        return 'Økonomi';
      case PRODUCER_TIMELINE_TAB_INDEX:
        return isContentProducerMode ? 'Planner · Oversikt' : 'Planner';
      case PRODUCER_REVIEWS_TAB_INDEX:
        return 'Godkjenning';
      case PRODUCER_EXPORT_TAB_INDEX:
        return 'Levering';
      case 0:
      default:
        return branding.tokens.labels.dashboard;
    }
  }, [CONTENT_PRODUCER_PLANNER_SURFACE_ITEMS, branding.tokens.labels, contentProducerPlannerSurface, isContentProducerMode]);

  const handleExitLiveSet = useCallback(() => {
    const nextTab = lastNonLiveTab === LIVE_SET_TAB_INDEX ? 0 : lastNonLiveTab;
    void exitLiveSetFullscreen();
    if (nextTab === SHOT_LIST_TAB_INDEX) {
      setStoryArcView('shot-list');
      flushSync(() => setActiveTab(STORY_ARC_TAB_INDEX));
      return;
    }
    if (nextTab === STORY_ARC_TAB_INDEX) {
      setStoryArcView('main');
    }
    flushSync(() => setActiveTab(nextTab));
  }, [exitLiveSetFullscreen, lastNonLiveTab]);

  const openRoleDialog = useCallback(() => {
    blurActiveElement();
    startTransition(() => setRoleDialogOpen(true));
  }, [blurActiveElement]);

  const openCandidateDialog = useCallback(() => {
    blurActiveElement();
    startTransition(() => setCandidateDialogOpen(true));
  }, [blurActiveElement]);

  useEffect(() => {
    const handleOpenCandidateProfile = (event: Event) => {
      const customEvent = event as CustomEvent<OpenCandidateProfileEventDetail>;
      const candidateId = customEvent.detail?.candidateId;
      if (!candidateId || !currentProject) return;

      const candidate = currentProject.candidates.find((item) => item.id === candidateId);
      if (!candidate) return;

      navigateToTab(CANDIDATES_TAB_INDEX);
      setSelectedCandidate(candidate);
      openCandidateDialog();
    };

    window.addEventListener('role-room:open-candidate-profile', handleOpenCandidateProfile as EventListener);
    return () => {
      window.removeEventListener('role-room:open-candidate-profile', handleOpenCandidateProfile as EventListener);
    };
  }, [currentProject, navigateToTab, openCandidateDialog]);

  const openScheduleDialog = useCallback(() => {
    blurActiveElement();
    startTransition(() => setScheduleDialogOpen(true));
  }, [blurActiveElement]);

  const openSharingModal = useCallback(() => {
    blurActiveElement();
    startTransition(() => setSharingModalOpen(true));
  }, [blurActiveElement]);

  const openSharingDialog = useCallback(() => {
    blurActiveElement();
    startTransition(() => setSharingDialogOpen(true));
  }, [blurActiveElement]);

  const openProfessionDialog = useCallback(() => {
    if (!canSwitchRoleRoomRole) {
      return;
    }
    blurActiveElement();
    startTransition(() => setProfessionDialogOpen(true));
  }, [blurActiveElement, canSwitchRoleRoomRole]);

  const openAdminDashboard = useCallback(() => {
    blurActiveElement();
    startTransition(() => setAdminDashboardOpen(true));
  }, [blurActiveElement]);

  const openLoginDialog = useCallback(() => {
    blurActiveElement();
    startTransition(() => setLoginDialogOpen(true));
  }, [blurActiveElement]);

  const openProjectCreationModal = useCallback(() => {
    blurActiveElement();
    setProjectCreationModalKey((prev) => prev + 1);
    setProjectCreationModalOpen(true);
  }, [blurActiveElement]);

  const openNewProjectCreationModal = useCallback(() => {
    setProjectCreationDialogTab('new');
    setProjectToEdit(null);
    setProjectCreationPrefill(null);
    setCurrentProjectId(null);
    openProjectCreationModal();
  }, [openProjectCreationModal]);

  const openProjectCreationModalWithPrefill = useCallback((draft: Partial<CastingProject>) => {
    setProjectCreationDialogTab('new');
    setProjectToEdit(null);
    setProjectCreationPrefill(draft);
    setCurrentProjectId(null);
    openProjectCreationModal();
  }, [openProjectCreationModal]);

  const openProjectLibraryModal = useCallback(() => {
    blurActiveElement();
    setProjectCreationDialogTab('existing');
    setProjectToEdit(null);
    setProjectCreationPrefill(null);
    setCurrentProjectId(null);
    setProjectQuickActionsAnchorEl(null);
    setProjectQuickActionsProject(null);
    setProjectCreationModalOpen(true);
  }, [blurActiveElement]);

  const openProjectSelectorDialog = useCallback(() => {
    openProjectLibraryModal();
  }, [openProjectLibraryModal]);

  const openProjectEditModal = useCallback((project: CastingProject) => {
    setProjectCreationDialogTab('new');
    setProjectCreationPrefill(null);
    setProjectToEdit(project);
    setCurrentProjectId(project.id);
    openProjectCreationModal();
  }, [openProjectCreationModal]);

  const openConsentContractDialog = useCallback(() => {
    blurActiveElement();
    startTransition(() => setConsentContractDialogOpen(true));
  }, [blurActiveElement]);

  const openTutorial = useCallback(() => {
    blurActiveElement();
    startTransition(() => setShowTutorial(true));
  }, [blurActiveElement]);

  const openTutorialEditor = useCallback(() => {
    blurActiveElement();
    startTransition(() => setShowTutorialEditor(true));
  }, [blurActiveElement]);

  const openPreviewTutorial = useCallback((tutorial: Tutorial) => {
    startTransition(() => {
      setShowTutorialEditor(false);
      setPreviewTutorial(tutorial);
    });
  }, []);
  
  // Stable callback for project ID changes to prevent infinite loops
  const handleProjectIdChange = useCallback((projectId: string | null) => {
    setCurrentProjectId(projectId);
  }, []);

  // Stable callback for manuscript changes
  const handleManuscriptChange = useCallback(async () => {
    const activeProjectId = currentProjectRef.current?.id;
    if (activeProjectId) {
      const updated = await castingService.getProject(activeProjectId);
      if (updated) setCurrentProject(updated);
    }
  }, []);

  // Story Logic → Manuscript sync: capture story logic data when saved
  const handleStoryLogicSave = useCallback((data: StoryLogicState) => {
    setStoryLogicData(data);
  }, []);

  // Load story logic data when project changes
  useEffect(() => {
    let isMounted = true;
    setStoryLogicData(null);
    if (!currentProject?.id) {
      return () => {
        isMounted = false;
      };
    }
    if (!authSessionService.getAuthHeadersSync().Authorization) {
      return () => {
        isMounted = false;
      };
    }

    storyLogicService.getStoryLogic(currentProject.id).then(data => {
      if (isMounted) {
        setStoryLogicData(data ?? null);
      }
    }).catch(err => {
      console.warn('Failed to load story logic:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [currentProject?.id]);
  
  // Sort and filter project lists used by the quick-switch header and selector dialog
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [projects]);

  const orderedProjects = useMemo(() => {
    if (pinnedProjectIds.length === 0) {
      return sortedProjects;
    }

    const pinnedSet = new Set(pinnedProjectIds);
    const pinned = sortedProjects.filter((project) => pinnedSet.has(project.id));
    const rest = sortedProjects.filter((project) => !pinnedSet.has(project.id));
    return [...pinned, ...rest];
  }, [pinnedProjectIds, sortedProjects]);

  const isProtectedDemoProject = useCallback((project: CastingProject): boolean => {
    return castingService.isProtectedDemoProject(project);
  }, []);

  const isTemplateProject = useCallback((project: CastingProject): boolean => {
    return castingService.isTemplateProject(project);
  }, []);

  const canMutateProtectedDemoData = useMemo(
    () => castingService.canCurrentSessionMutateProtectedDemo(),
    [adminUser?.role],
  );

  const templateAudienceForSession = useMemo<'content_producer' | 'production_team'>(
    () => {
      const loginAs = String(adminUser?.loginAs || '').trim().toLowerCase();
      const requestedRole = String(adminUser?.requestedRole || '').trim().toLowerCase();
      const role = String(adminUser?.role || '').trim().toLowerCase();
      if (
        loginAs === 'content_producer'
        || requestedRole === 'content_producer'
        || requestedRole === 'client_reviewer'
        || role === 'content_producer'
        || role === 'client_reviewer'
      ) {
        return 'content_producer';
      }
      return 'production_team';
    },
    [adminUser?.loginAs, adminUser?.requestedRole, adminUser?.role],
  );

  const filteredPublishedTemplates = useMemo(() => {
    const matchingTemplates = publishedTemplates
      .filter((project) => {
        const audience = castingService.getProjectTemplateAudience(project);
        const status = castingService.getProjectTemplateStatus(project);
        return audience === templateAudienceForSession && status === 'published';
      })
      .reduce<CastingProject[]>((acc, project) => {
        const templateKey = `${templateAudienceForSession}:${String(project.templateSourceProjectId || project.id || '').trim().toLowerCase()}`;
        const existingIndex = acc.findIndex((entry) => (
          `${templateAudienceForSession}:${String(entry.templateSourceProjectId || entry.id || '').trim().toLowerCase()}`
        ) === templateKey);
        if (existingIndex === -1) {
          acc.push(project);
          return acc;
        }

        const existingProject = acc[existingIndex];
        const existingVersion = existingProject.templateVersion ?? 0;
        const nextVersion = project.templateVersion ?? 0;
        const existingUpdatedAt = new Date(existingProject.updatedAt || existingProject.createdAt || 0).getTime();
        const nextUpdatedAt = new Date(project.updatedAt || project.createdAt || 0).getTime();
        const shouldReplace = nextVersion > existingVersion || (
          nextVersion === existingVersion && nextUpdatedAt >= existingUpdatedAt
        );
        if (shouldReplace) {
          acc[existingIndex] = project;
        }
        return acc;
      }, []);
    const query = projectSelectorQuery.trim().toLowerCase();
    if (!query) {
      return matchingTemplates;
    }
    return matchingTemplates.filter((project) => {
      const name = (project.name || '').toLowerCase();
      const description = (project.description || '').toLowerCase();
      const sourceName = String(project.templateSourceProjectName || '').toLowerCase();
      return name.includes(query) || description.includes(query) || sourceName.includes(query);
    });
  }, [projectSelectorQuery, publishedTemplates, templateAudienceForSession]);

  const filteredProjectSelectorItems = useMemo(() => {
    const query = projectSelectorQuery.trim().toLowerCase();
    if (!query) return orderedProjects;
    return orderedProjects.filter((project) => {
      const name = (project.name || '').toLowerCase();
      const id = (project.id || '').toLowerCase();
      const description = (project.description || '').toLowerCase();
      const client = (project.clientName || '').toLowerCase();
      return (
        name.includes(query) ||
        id.includes(query) ||
        description.includes(query) ||
        client.includes(query)
      );
    });
  }, [orderedProjects, projectSelectorQuery]);

  const filteredPinnedProjectSelectorItems = useMemo(
    () => {
      const pinnedSet = new Set(pinnedProjectIds);
      return filteredProjectSelectorItems.filter((project) => pinnedSet.has(project.id));
    },
    [filteredProjectSelectorItems, pinnedProjectIds],
  );

  const filteredUnpinnedProjectSelectorItems = useMemo(
    () => {
      const pinnedSet = new Set(pinnedProjectIds);
      return filteredProjectSelectorItems.filter((project) => !pinnedSet.has(project.id));
    },
    [filteredProjectSelectorItems, pinnedProjectIds],
  );

  const latestCreatedProjectId = useMemo(() => {
    if (orderedProjects.length === 0) {
      return null;
    }

    const sortedByCreation = [...orderedProjects].sort((left, right) => {
      const leftTimestamp = new Date(left.createdAt || left.updatedAt || 0).getTime();
      const rightTimestamp = new Date(right.createdAt || right.updatedAt || 0).getTime();
      return rightTimestamp - leftTimestamp;
    });

    return sortedByCreation[0]?.id ?? null;
  }, [orderedProjects]);

  const headerProjects = useMemo(() => {
    const visibleProjects: CastingProject[] = [];
    const activeProjectId = currentProject?.id ?? null;
    const activeProject = activeProjectId
      ? orderedProjects.find((project) => project.id === activeProjectId) ?? currentProject
      : null;

    if (activeProject) {
      visibleProjects.push(activeProject);
    }

    for (const project of orderedProjects) {
      if (activeProject && project.id === activeProject.id) {
        continue;
      }
      visibleProjects.push(project);
      if (visibleProjects.length >= 3) {
        break;
      }
    }

    return visibleProjects;
  }, [currentProject, orderedProjects]);

  const compactHeaderProjects = useMemo(() => {
    if (!useCompactHeaderLayout) {
      return headerProjects;
    }

    if (headerProjects.length <= 1) {
      return headerProjects;
    }

    const activeProjectId = currentProject?.id ?? headerProjects[0]?.id ?? null;
    const activeProject = activeProjectId
      ? headerProjects.find((project) => project.id === activeProjectId) ?? headerProjects[0]
      : headerProjects[0];

    return activeProject ? [activeProject] : headerProjects.slice(0, 1);
  }, [currentProject, headerProjects, useCompactHeaderLayout]);

  const hiddenProjectsCount = Math.max(0, orderedProjects.length - headerProjects.length);
  const hasMoreProjects = hiddenProjectsCount > 0;
  const loadProjectSyncMeta = useCallback(async (projectIds: string[]) => {
    const uniqueProjectIds = Array.from(new Set(
      projectIds
        .map((projectId) => String(projectId || '').trim())
        .filter(Boolean),
    ));
    if (uniqueProjectIds.length === 0) {
      return;
    }

    const entries = await Promise.all(
      uniqueProjectIds.map(async (projectId) => {
        const meta = await castingService.getProjectSyncMeta(projectId);
        return [projectId, meta] as const;
      }),
    );

    setProjectSyncMetaById((previous) => ({
      ...previous,
      ...Object.fromEntries(entries),
    }));
  }, []);

  const getProjectSyncStatus = useCallback((projectId: string) => {
    const meta = projectSyncMetaById[projectId];
    if (!meta) {
      return {
        label: 'Sjekker lagring',
        helper: 'Åpne prosjektstatus for å hente siste sync-status.',
        bgcolor: 'rgba(148,163,184,0.12)',
        color: 'rgba(226,232,240,0.86)',
        border: '1px solid rgba(148,163,184,0.18)',
      };
    }
    if (meta.queuedChangeCount > 0) {
      return {
        label: `${meta.queuedChangeCount} venter på sync`,
        helper: meta.lastError || 'Prosjektet er lagret lokalt, men ikke bekreftet på server ennå.',
        bgcolor: 'rgba(251,191,36,0.16)',
        color: '#fde68a',
        border: '1px solid rgba(251,191,36,0.34)',
      };
    }
    if (meta.lastError) {
      return {
        label: 'Sync må sjekkes',
        helper: meta.lastError,
        bgcolor: 'rgba(248,113,113,0.14)',
        color: '#fecaca',
        border: '1px solid rgba(248,113,113,0.32)',
      };
    }
    if (meta.lastSyncedAt) {
      return {
        label: 'Lagret på server',
        helper: `Server bekreftet lagring ${new Date(meta.lastSyncedAt).toLocaleString('nb-NO')}.`,
        bgcolor: 'rgba(16,185,129,0.14)',
        color: '#bbf7d0',
        border: '1px solid rgba(16,185,129,0.28)',
      };
    }
    if (meta.lastLocalSaveAt) {
      return {
        label: 'Kun lokalt',
        helper: 'Prosjektet finnes lokalt, men serverlagring er ikke bekreftet ennå.',
        bgcolor: 'rgba(251,146,60,0.14)',
        color: '#fed7aa',
        border: '1px solid rgba(251,146,60,0.3)',
      };
    }
    return {
      label: 'Ikke verifisert',
      helper: 'Ingen lagringsbekreftelse er registrert for dette prosjektet.',
      bgcolor: 'rgba(148,163,184,0.12)',
      color: 'rgba(226,232,240,0.86)',
      border: '1px solid rgba(148,163,184,0.18)',
    };
  }, [projectSyncMetaById]);

  useEffect(() => {
    const projectIds = [
      currentProject?.id,
      ...(projectSelectorOpen ? filteredProjectSelectorItems.map((project) => project.id) : []),
    ].filter(Boolean) as string[];
    if (projectIds.length === 0) {
      return;
    }
    void loadProjectSyncMeta(projectIds);
  }, [currentProject?.id, currentProject?.updatedAt, filteredProjectSelectorItems, loadProjectSyncMeta, projectSelectorOpen]);

  const handleOpenProjectQuickActions = useCallback((event: MouseEvent<HTMLElement>, project: CastingProject) => {
    event.stopPropagation();
    setProjectQuickActionsAnchorEl(event.currentTarget);
    setProjectQuickActionsProject(project);
  }, []);

  const handleCloseProjectQuickActions = useCallback(() => {
    setProjectQuickActionsAnchorEl(null);
    setProjectQuickActionsProject(null);
  }, []);

  const handleOpenHeaderToolsMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setHeaderToolsAnchorEl(event.currentTarget);
  }, []);

  const handleCloseHeaderToolsMenu = useCallback(() => {
    setHeaderToolsAnchorEl(null);
  }, []);

  const handleRestartWorkspaceOnboarding = useCallback(() => {
    handleCloseHeaderToolsMenu();
    resetOnboarding();
    startTransition(() => {
      triggerProfessionOnboarding();
    });
  }, [handleCloseHeaderToolsMenu, resetOnboarding, triggerProfessionOnboarding]);

  const handleWorkspaceLogout = useCallback(async () => {
    handleCloseHeaderToolsMenu();
    if (_onClose) {
      _onClose();
      return;
    }
    await authSessionService.clearSession();
    setAdminUser(null);
    setCurrentProject(null);
    setProjects([]);
    setProjectSelectorOpen(false);
    setProjectCreationModalOpen(false);
    setProjectToEdit(null);
    setProjectCreationPrefill(null);
    setCurrentProjectId(null);
    setActiveTab(0);
    window.location.assign(getRoleRoomCanonicalPath(window.location));
  }, [handleCloseHeaderToolsMenu, _onClose]);

  const pinnedProjectIdSet = useMemo(() => new Set(pinnedProjectIds), [pinnedProjectIds]);
  const pinnedProjectAccentColorById = useMemo(() => {
    const accentMap = new Map<string, string>();
    pinnedProjectIds.forEach((projectId, index) => {
      accentMap.set(projectId, PINNED_PROJECT_ACCENT_COLORS[index % PINNED_PROJECT_ACCENT_COLORS.length]);
    });
    return accentMap;
  }, [pinnedProjectIds]);

  const persistPinnedProjects = useCallback(async (nextPinnedProjectIds: string[]) => {
    const sanitized = nextPinnedProjectIds.filter((value, index, array) => value && array.indexOf(value) === index);
    setPinnedProjectIds(sanitized);
    try {
      await settingsService.setSetting(pinnedProjectsNamespace, sanitized, { userId: getSettingsUserId() });
    } catch (error) {
      console.warn('Failed to persist pinned projects:', error);
    }
  }, [getSettingsUserId]);

  const handleTogglePinnedProject = useCallback(async (projectId: string) => {
    const nextPinnedProjectIds = pinnedProjectIdSet.has(projectId)
      ? pinnedProjectIds.filter((id) => id !== projectId)
      : [projectId, ...pinnedProjectIds].slice(0, 3);
    await persistPinnedProjects(nextPinnedProjectIds);
  }, [persistPinnedProjects, pinnedProjectIdSet, pinnedProjectIds]);

  const handleReorderPinnedProjects = useCallback(async (sourceProjectId: string, targetProjectId: string) => {
    if (!sourceProjectId || !targetProjectId || sourceProjectId === targetProjectId) {
      return;
    }

    const nextPinnedProjectIds = [...pinnedProjectIds];
    const sourceIndex = nextPinnedProjectIds.indexOf(sourceProjectId);
    const targetIndex = nextPinnedProjectIds.indexOf(targetProjectId);

    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const [moved] = nextPinnedProjectIds.splice(sourceIndex, 1);
    nextPinnedProjectIds.splice(targetIndex, 0, moved);
    await persistPinnedProjects(nextPinnedProjectIds);
  }, [persistPinnedProjects, pinnedProjectIds]);

  const { user } = useAuth();

  const getHeaderRoleLabel = (role?: string | null): string => {
    if (!role) return branding.tokens.labels.unknownRoleLabel;
    const labels: Record<string, string> = {
      owner: branding.tokens.labels.roleOwnerLabel,
      admin: branding.tokens.labels.roleAdminLabel,
      director: branding.tokens.labels.roleDirectorLabel,
      producer: branding.tokens.labels.roleProducerLabel,
      casting_director: branding.tokens.labels.roleCastingDirectorLabel,
      production_manager: branding.tokens.labels.roleProductionManagerLabel,
      camera_team: branding.tokens.labels.roleCameraTeamLabel,
      agency: branding.tokens.labels.roleAgencyLabel,
      content_producer: 'Innholdsprodusent',
      client_reviewer: 'Klient-revisor',
      client: 'Klient',
      film_photographer: 'Innholdsprodusent',
    };
    return labels[role] || role;
  };

  const mapAccountRoleToProjectRole = (
    role?: string | null,
    loginAs?: string | null,
    requestedRole?: string | null,
  ): UserRoleType | null => {
    const normalizedLoginAs = (loginAs || '').trim().toLowerCase();
    const normalizedRequestedRole = (requestedRole || '').trim().toLowerCase();

    if (normalizedLoginAs === 'content_producer') {
      if (normalizedRequestedRole === 'client') {
        return 'client_reviewer';
      }
      return 'content_producer';
    }
    if (normalizedLoginAs === 'production_team' && normalizedRequestedRole) {
      if (normalizedRequestedRole === 'client') {
        return 'client_reviewer';
      }
      if (['film_photographer', 'photographer', 'photo_director', 'photo_assistant'].includes(normalizedRequestedRole)) {
        return 'content_producer';
      }
      if ([
        'director',
        'producer',
        'casting_director',
        'production_manager',
        'camera_team',
        'writer',
        'script_editor',
        'reader',
        'agency',
      ].includes(normalizedRequestedRole)) {
        return normalizedRequestedRole as UserRoleType;
      }
    }

    if (!role) return null;
    const normalized = role.trim().toLowerCase();

    if (normalized === 'owner') return 'director';
    if (normalized === 'admin') return 'producer';
    if (normalized === 'super_admin') return 'director';
    if (normalized === 'director') return 'director';
    if (normalized === 'producer') return 'producer';
    if (normalized === 'content_producer') return 'content_producer';
    if (normalized === 'client_reviewer') return 'client_reviewer';
    if (normalized === 'casting_director') return 'casting_director';
    if (normalized === 'production_manager') return 'production_manager';
    if (normalized === 'camera_team' || normalized === 'camera_operator') return 'camera_team';
    if (normalized === 'writer') return 'writer';
    if (normalized === 'script_editor') return 'script_editor';
    if (normalized === 'reader') return 'reader';
    if (normalized === 'agency') return 'agency';

    // Map photo/video account roles to the closest project-role permission set
    if (['photographer', 'film_photographer', 'photo_director', 'photo_assistant'].includes(normalized)) {
      return 'content_producer';
    }
    if (normalized === 'client') {
      return 'client_reviewer';
    }

    return null;
  };

  const buildPermissionStateFromRole = useCallback((userRole: UserRole | null) => {
    if (!userRole) {
      return {
        canViewAll: false,
        canEditCasting: false,
        canEditProduction: false,
        canEditShotLists: false,
        canManageCrew: false,
        canManageLocations: false,
        canApprove: false,
        canComment: false,
        canRequestChanges: false,
        canViewEconomy: false,
      };
    }

    const defaultPermissions = castingAuthService.getDefaultPermissions(userRole.role);
    const mergedPermissions = {
      ...defaultPermissions,
      ...(userRole.permissions ?? {}),
    };

    return {
      canViewAll: Boolean(mergedPermissions.canViewAll),
      canEditCasting: Boolean(mergedPermissions.canEditCasting),
      canEditProduction: Boolean(mergedPermissions.canEditProduction),
      canEditShotLists: Boolean(mergedPermissions.canEditShotLists || mergedPermissions.canEditShots),
      canManageCrew: Boolean(mergedPermissions.canManageCrew),
      canManageLocations: Boolean(mergedPermissions.canManageLocations),
      canApprove: Boolean(mergedPermissions.canApprove),
      canComment: Boolean(mergedPermissions.canComment),
      canRequestChanges: Boolean(mergedPermissions.canRequestChanges),
      canViewEconomy: Boolean(mergedPermissions.canViewEconomy),
    };
  }, []);
  const buildProjectAccessLabel = useCallback((userRole: UserRole | null): string => {
    if (!userRole) {
      return 'Tilgang ikke satt opp';
    }

    const permissionState = buildPermissionStateFromRole(userRole);
    const hasEditAccess = permissionState.canEditCasting
      || permissionState.canEditProduction
      || permissionState.canEditShotLists
      || permissionState.canManageCrew
      || permissionState.canManageLocations;
    const hasDecisionAccess = permissionState.canApprove || permissionState.canRequestChanges;

    if (
      permissionState.canViewAll
      && permissionState.canEditCasting
      && permissionState.canEditProduction
      && permissionState.canApprove
      && permissionState.canViewEconomy
    ) {
      return 'Full tilgang';
    }

    if (hasEditAccess && hasDecisionAccess) {
      return 'Kan redigere og godkjenne';
    }

    if (hasEditAccess) {
      return 'Kan redigere';
    }

    if (hasDecisionAccess) {
      return permissionState.canComment ? 'Kan kommentere og godkjenne' : 'Kan godkjenne';
    }

    if (permissionState.canComment) {
      return 'Kan kommentere';
    }

    if (permissionState.canViewAll) {
      return 'Lesetilgang';
    }

    return 'Begrenset tilgang';
  }, [buildPermissionStateFromRole]);

  const accountRoleLabel = adminUser?.role ? getHeaderRoleLabel(adminUser.role) : '';
  const projectRoleLabel = currentUserRole?.role ? getHeaderRoleLabel(currentUserRole.role) : '';
  const headerRoleLabel = projectRoleLabel && accountRoleLabel && projectRoleLabel !== accountRoleLabel
    ? `${accountRoleLabel} (konto) • ${projectRoleLabel} (prosjekt)`
    : projectRoleLabel || accountRoleLabel;
  const normalizedAdminAccountRole = String(adminUser?.role || '').trim().toLowerCase();
  const isRoleRoomAdminSession = normalizedAdminAccountRole === 'admin'
    || normalizedAdminAccountRole === 'owner'
    || normalizedAdminAccountRole === 'super_admin';
  const mappedSessionProjectRole = useMemo(
    () => mapAccountRoleToProjectRole(adminUser?.role, adminUser?.loginAs, adminUser?.requestedRole),
    [adminUser?.role, adminUser?.loginAs, adminUser?.requestedRole],
  );
  const isScopedRoleRoomLogin = typeof adminUser?.loginAs === 'string'
    && adminUser.loginAs.trim().length > 0;
  const getProjectRoleDetails = useCallback((project: CastingProject): {
    roleLabel: string;
    accessLabel: string;
  } => {
    const sessionUserId = adminUser?.id !== undefined && adminUser?.id !== null
      ? String(adminUser.id)
      : getUserId();
    const sessionEmail = String(adminUser?.email || user?.email || '')
      .trim()
      .toLowerCase();
    const projectRoles = Array.isArray(project.userRoles) ? project.userRoles : [];
    const matchedRole = (
      currentProject?.id === project.id && currentUserRole
        ? currentUserRole
        : projectRoles.find((candidateRole) => {
            const candidateUserId = String(candidateRole.userId ?? candidateRole.user_id ?? '').trim();
            const candidateEmail = String(candidateRole.email || '').trim().toLowerCase();
            if (sessionUserId && candidateUserId && candidateUserId === sessionUserId) {
              return true;
            }
            if (sessionEmail && candidateEmail && candidateEmail === sessionEmail) {
              return true;
            }
            return false;
          }) ?? null
    );

    if (matchedRole) {
      return {
        roleLabel: getHeaderRoleLabel(matchedRole.role),
        accessLabel: buildProjectAccessLabel(matchedRole),
      };
    }

    if (isRoleRoomAdminSession && adminUser && !isScopedRoleRoomLogin) {
      const adminProjectRole: UserRole = {
        id: `project-selector-admin-${project.id}-${sessionUserId || 'session'}`,
        userId: sessionUserId || undefined,
        projectId: project.id,
        role: normalizedAdminAccountRole === 'owner' || normalizedAdminAccountRole === 'super_admin' ? 'director' : 'producer',
        permissions: {
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: true,
          canEditShotLists: true,
          canManageCrew: true,
          canManageLocations: true,
          canApprove: true,
          canComment: true,
          canRequestChanges: true,
          canViewEconomy: true,
        },
      };
      return {
        roleLabel: getHeaderRoleLabel(adminProjectRole.role),
        accessLabel: buildProjectAccessLabel(adminProjectRole),
      };
    }

    if (mappedSessionProjectRole) {
      const fallbackRole: UserRole = {
        id: `project-selector-fallback-${project.id}-${sessionUserId || 'session'}`,
        userId: sessionUserId || undefined,
        projectId: project.id,
        role: mappedSessionProjectRole,
        permissions: castingAuthService.getDefaultPermissions(mappedSessionProjectRole),
      };
      return {
        roleLabel: getHeaderRoleLabel(fallbackRole.role),
        accessLabel: buildProjectAccessLabel(fallbackRole),
      };
    }

    return {
      roleLabel: 'Ikke tildelt',
      accessLabel: 'Tilgang ikke satt opp',
    };
  }, [
    adminUser,
    buildProjectAccessLabel,
    currentProject?.id,
    currentUserRole,
    getHeaderRoleLabel,
    getUserId,
    isRoleRoomAdminSession,
    isScopedRoleRoomLogin,
    mappedSessionProjectRole,
    normalizedAdminAccountRole,
    user?.email,
  ]);
  const ensureScopedSessionProjectRole = useCallback(async (projectId: string) => {
    if (!adminUser) {
      return;
    }

    const mappedRole = mapAccountRoleToProjectRole(
      adminUser.role,
      adminUser.loginAs,
      adminUser.requestedRole,
    );

    if (!mappedRole) {
      return;
    }

    const userId = adminUser.id !== undefined && adminUser.id !== null
      ? String(adminUser.id)
      : getUserId();
    const userRoles = await castingService.getUserRoles(projectId);
    const existingRole = userRoles.find((userRole) => String(userRole.userId ?? userRole.user_id ?? '') === userId);
    const now = new Date().toISOString();

    if (existingRole?.role === mappedRole) {
      return;
    }

    await castingService.saveUserRole(projectId, {
      id: existingRole?.id || `userrole-${userId}-${projectId}`,
      userId,
      projectId,
      role: mappedRole,
      permissions: castingAuthService.getDefaultPermissions(mappedRole),
      createdAt: existingRole?.createdAt || existingRole?.created_at || now,
      updatedAt: now,
    });
  }, [adminUser, getUserId]);
  const isContentProducerSession = mappedSessionProjectRole === 'content_producer';
  const isClientReviewerSession = mappedSessionProjectRole === 'client_reviewer';
  const isProducerWorkspaceSession = isContentProducerSession || isClientReviewerSession;
  const currentCommercialPersona = useMemo<'production_team' | 'content_producer' | null>(() => {
    if (!adminUser) return null;
    const loginAs = (adminUser.loginAs || '').trim().toLowerCase();
    const requestedRole = (adminUser.requestedRole || '').trim().toLowerCase();
    const role = (adminUser.role || '').trim().toLowerCase();

    if (loginAs === 'production_team') {
      return 'production_team';
    }
    if (
      loginAs === 'content_producer'
      || requestedRole === 'content_producer'
      || role === 'content_producer'
      || role === 'client_reviewer'
    ) {
      return 'content_producer';
    }
    return null;
  }, [adminUser]);
  const isRoleRoomCommercialSession = currentCommercialPersona !== null;
  const activeTutorialCategory: Tutorial['category'] = isProducerWorkspaceSession
    ? 'content-producer'
    : 'casting-planner';
  const headerProfessionLabel = isContentProducerSession
    ? 'Innholdsprodusent'
    : isClientReviewerSession
      ? 'Klient'
      : profession
        ? PROFESSION_CONFIG[profession]?.name
        : '';
  const isReadOnlyProtectedDemoView = Boolean(
    currentProject && isProtectedDemoProject(currentProject) && !canMutateProtectedDemoData,
  );
  const canEditProducerWorkflow = !isReadOnlyProtectedDemoView && (isRoleRoomAdminSession || isContentProducerMode || producerAccess.canEditProductionData);
  const canManageProductionWorkspace = permissions.canEditProduction || isRoleRoomAdminSession;
  const canCommentInProducerWorkflow = !isReadOnlyProtectedDemoView && (isContentProducerMode || isClientReviewerMode || producerAccess.canComment);
  const canViewProducerEconomy = isContentProducerMode || producerAccess.canViewEconomy || permissions.canViewEconomy;
  const canApproveProducerReview = !isReadOnlyProtectedDemoView && (isClientReviewerSession || producerAccess.canApproveReview);
  const canRequestProducerReviewChanges = !isReadOnlyProtectedDemoView && (isClientReviewerSession || producerAccess.canRequestReviewChanges);
  const canMakeProducerReviewDecision = !isReadOnlyProtectedDemoView && (isClientReviewerSession || producerAccess.canMakeReviewDecision);
  const canSendBudgetReview = canEditProducerWorkflow && canViewProducerEconomy && !isClientReviewerMode;
  const producerWorkspaceBadgeLabel = isClientReviewerMode ? 'Klient' : 'Innholdsprodusent';
  const plannerAudience: 'production_team' | 'content_producer' = isContentProducerMode ? 'content_producer' : 'production_team';
  const producerCoreTabMetaLabel = isContentProducerMode || isClientReviewerMode
    ? producerWorkspaceBadgeLabel
    : 'Prosjektstyring';
  const isFreshProjectCreationFlow = projectCreationModalOpen && !projectToEdit;
  const headerActiveProject = isFreshProjectCreationFlow ? null : currentProject;
  const useFocusedWorkspaceHeader = !useCompactHeaderLayout && (isContentProducerMode || isClientReviewerMode);
  const showDenseDesktopHeaderUtilities = !useCompactHeaderLayout && useDenseDesktopHeader;
  const headerBrandSubtitle = isClientReviewerMode
    ? 'Klientrom'
    : isContentProducerMode
      ? 'Innholdsarbeid'
      : 'Produksjonsarbeid';
  const headerBrandDisplaySubtitle = isClientReviewerMode
    ? 'Klientrom'
    : isContentProducerMode
      ? 'Innhold'
      : 'Produksjon';
  const headerOpenProjectsButtonLabel = useDenseDesktopHeader ? 'Prosjekter' : 'Åpne prosjekter';
  const headerWorkspaceActionLabel = useFocusedWorkspaceHeader ? 'Prosjekter' : headerOpenProjectsButtonLabel;
  const headerProjectMetaHint = useDenseDesktopHeader
    ? 'Klikk for å bytte prosjekt'
    : 'Klikk for å bytte eller åpne eksisterende prosjekt';
  const workspaceAccountStatusColor = billingAccount?.paymentStatus === 'payment_failed'
    ? '#fb7185'
    : billingAccount?.paymentCompleted
      ? '#34d399'
      : '#38bdf8';
  const workspaceAccountStatusLabel = billingAccount?.paymentStatus === 'payment_failed'
    ? 'Betaling krever oppfølging'
    : billingAccount?.paymentCompleted
      ? 'Abonnement aktivt'
      : 'Workspace-oversikt';
  const workspaceAccountInitials = useMemo(() => {
    const source = adminUser?.display_name || adminUser?.email || branding.appName;
    return String(source)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'RR';
  }, [adminUser?.display_name, adminUser?.email, branding.appName]);
  const roleRoomWorkspaceStateNamespace = isClientReviewerMode
    ? 'roleRoom_workspaceState_client_reviewer'
    : isContentProducerMode
      ? 'roleRoom_workspaceState_content_producer'
      : 'roleRoom_workspaceState_production_team';

  const normalizeWorkspaceSurfaceKey = useCallback((value: unknown): RoleRoomWorkspaceSurfaceKey | null => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }
    const normalized = value.trim();
    const staticKeys = new Set<string>([
      'dashboard',
      'roles',
      'candidates',
      'auditions',
      'selection',
      'locations',
      'calendar',
      'team',
      'equipment',
      'live_set',
      'producer_media',
      'producer_economy',
      'producer_timeline',
      'producer_reviews',
      'producer_export',
    ]);
    if (staticKeys.has(normalized)) {
      return normalized as RoleRoomWorkspaceSurfaceKey;
    }
    if (
      normalized === 'story_arc:main'
      || normalized === 'story_arc:story-logic'
      || normalized === 'story_arc:story-writer'
      || normalized === 'story_arc:shot-list'
      || normalized === 'story_arc:planning'
      || normalized === 'planner:overview'
      || normalized === 'planner:project_room'
      || normalized === 'planner:approval'
      || normalized === 'planner:delivery'
      || normalized === 'planner:economy'
    ) {
      return normalized as RoleRoomWorkspaceSurfaceKey;
    }
    return null;
  }, []);

  const getWorkspaceSurfaceKey = useCallback((
    tabIndex = activeTab,
    nextStoryArcView = storyArcView,
    nextPlannerSurface = contentProducerPlannerSurface,
  ): RoleRoomWorkspaceSurfaceKey => {
    switch (tabIndex) {
      case STORY_ARC_TAB_INDEX:
        return isContentProducerMode && nextStoryArcView === 'planning'
          ? `planner:${nextPlannerSurface}`
          : `story_arc:${nextStoryArcView}`;
      case ROLES_TAB_INDEX:
        return 'roles';
      case CANDIDATES_TAB_INDEX:
        return 'candidates';
      case AUDITIONS_TAB_INDEX:
        return 'auditions';
      case SELECTION_TAB_INDEX:
        return 'selection';
      case LOCATIONS_TAB_INDEX:
        return 'locations';
      case CALENDAR_TAB_INDEX:
        return 'calendar';
      case TEAM_TAB_INDEX:
        return 'team';
      case EQUIPMENT_TAB_INDEX:
        return 'equipment';
      case LIVE_SET_TAB_INDEX:
        return 'live_set';
      case PRODUCER_MEDIA_TAB_INDEX:
        return 'producer_media';
      case PRODUCER_ECONOMY_TAB_INDEX:
        return 'producer_economy';
      case PRODUCER_TIMELINE_TAB_INDEX:
        return 'producer_timeline';
      case PRODUCER_REVIEWS_TAB_INDEX:
        return 'producer_reviews';
      case PRODUCER_EXPORT_TAB_INDEX:
        return 'producer_export';
      default:
        return 'dashboard';
    }
  }, [activeTab, contentProducerPlannerSurface, isContentProducerMode, storyArcView]);

  const buildWorkspaceFiltersForCurrentSurface = useCallback((): RoleRoomWorkspaceFilterState => ({
    candidateStatusFilter,
    candidateViewMode,
    selectionPhaseFilter,
    calendarViewMode,
    contentProducerPlannerSurface,
    producerMediaWorkspace: producerMediaFocus?.workspace ?? null,
  }), [
    calendarViewMode,
    candidateStatusFilter,
    candidateViewMode,
    contentProducerPlannerSurface,
    producerMediaFocus?.workspace,
    selectionPhaseFilter,
  ]);

  const buildWorkspaceSortingForCurrentSurface = useCallback((surfaceKey: RoleRoomWorkspaceSurfaceKey): RoleRoomWorkspaceSortState => {
    if (surfaceKey === 'selection') {
      return { key: selectionPhaseFilter === 'all' ? 'score' : selectionPhaseFilter, direction: 'desc' };
    }
    if (surfaceKey === 'calendar') {
      return { key: calendarViewMode === 'crew' ? 'crew-start' : 'production-start', direction: 'asc' };
    }
    if (surfaceKey === 'candidates') {
      return { key: candidateViewMode === 'kanban' ? 'status' : 'updatedAt', direction: 'desc' };
    }
    return { key: 'updatedAt', direction: 'desc' };
  }, [calendarViewMode, candidateViewMode, selectionPhaseFilter]);

  const scheduleWorkspaceStatePersist = useCallback((nextState: RoleRoomWorkspaceState) => {
    persistedWorkspaceStateRef.current = nextState;
    if (typeof window === 'undefined') {
      void settingsService.setSetting(roleRoomWorkspaceStateNamespace, nextState, { userId: getSettingsUserId() });
      return;
    }
    if (workspacePersistTimerRef.current !== null) {
      window.clearTimeout(workspacePersistTimerRef.current);
    }
    workspacePersistTimerRef.current = window.setTimeout(() => {
      workspacePersistTimerRef.current = null;
      const stateToPersist = persistedWorkspaceStateRef.current;
      if (!stateToPersist) {
        return;
      }
      void settingsService
        .setSetting(roleRoomWorkspaceStateNamespace, stateToPersist, { userId: getSettingsUserId() })
        .catch((error) => {
          console.warn('Failed to persist Role Room workspace state:', error);
        });
    }, 180);
  }, [getSettingsUserId, roleRoomWorkspaceStateNamespace]);

  const loadPersistedWorkspaceState = useCallback(async (): Promise<RoleRoomWorkspaceState | null> => {
    try {
      const stored = await settingsService.getSetting<RoleRoomWorkspaceState>(roleRoomWorkspaceStateNamespace, {
        userId: getSettingsUserId(),
      });
      if (!stored || typeof stored !== 'object') {
        return null;
      }
      const nextStoryArcView = stored.storyArcView;
      const nextStoryArcFocus = normalizeStoryArcNavigationFocus(stored.storyArcFocus);
      const nextContentProducerPlannerSurface = stored.contentProducerPlannerSurface;
      const nextProducerMediaFocus = stored.producerMediaFocus;
      const nextContentProducerResumeTarget = stored.contentProducerResumeTarget;
      const storedRecord = stored as RoleRoomWorkspaceState & Record<string, unknown>;
      const storyArcViewValid = nextStoryArcView === 'main'
        || nextStoryArcView === 'story-logic'
        || nextStoryArcView === 'story-writer'
        || nextStoryArcView === 'shot-list'
        || nextStoryArcView === 'planning';
      const plannerSurfaceValid = nextContentProducerPlannerSurface === 'overview'
        || nextContentProducerPlannerSurface === 'project_room'
        || nextContentProducerPlannerSurface === 'approval'
        || nextContentProducerPlannerSurface === 'delivery'
        || nextContentProducerPlannerSurface === 'economy';
      const producerMediaFocusValid = nextProducerMediaFocus && typeof nextProducerMediaFocus === 'object'
        ? {
            workspace: typeof nextProducerMediaFocus.workspace === 'string' && nextProducerMediaFocus.workspace.trim().length > 0
              ? nextProducerMediaFocus.workspace
              : undefined,
            sectionId: typeof nextProducerMediaFocus.sectionId === 'string' && nextProducerMediaFocus.sectionId.trim().length > 0
              ? nextProducerMediaFocus.sectionId.trim()
              : undefined,
            pageId: typeof nextProducerMediaFocus.pageId === 'string' && nextProducerMediaFocus.pageId.trim().length > 0
              ? nextProducerMediaFocus.pageId.trim()
              : undefined,
            artifactId: typeof nextProducerMediaFocus.artifactId === 'string' && nextProducerMediaFocus.artifactId.trim().length > 0
              ? nextProducerMediaFocus.artifactId.trim()
              : undefined,
          }
        : null;
      const contentProducerResumeTargetValid = nextContentProducerResumeTarget && typeof nextContentProducerResumeTarget === 'object'
        ? {
            surface:
              nextContentProducerResumeTarget.surface === 'overview'
              || nextContentProducerResumeTarget.surface === 'project_room'
              || nextContentProducerResumeTarget.surface === 'approval'
              || nextContentProducerResumeTarget.surface === 'delivery'
              || nextContentProducerResumeTarget.surface === 'economy'
                ? nextContentProducerResumeTarget.surface
                : 'overview',
            mediaFocus:
              nextContentProducerResumeTarget.surface === 'project_room'
                ? producerMediaFocusValid
                : null,
          }
        : null;
      const normalizeScrollBySurface = (value: unknown): RoleRoomProjectWorkspaceState['scrollBySurface'] => {
        if (!value || typeof value !== 'object') {
          return {};
        }
        return Object.entries(value as Record<string, unknown>).reduce<RoleRoomProjectWorkspaceState['scrollBySurface']>((acc, [key, entry]) => {
          const surfaceKey = normalizeWorkspaceSurfaceKey(key);
          if (!surfaceKey || !entry || typeof entry !== 'object') {
            return acc;
          }
          const record = entry as Record<string, unknown>;
          const top = typeof record.top === 'number' && Number.isFinite(record.top) ? Math.max(0, record.top) : 0;
          const left = typeof record.left === 'number' && Number.isFinite(record.left) ? Math.max(0, record.left) : 0;
          acc[surfaceKey] = {
            top,
            left,
            updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
          };
          return acc;
        }, {});
      };
      const normalizeFiltersBySurface = (value: unknown): RoleRoomProjectWorkspaceState['filtersBySurface'] => {
        if (!value || typeof value !== 'object') {
          return {};
        }
        return Object.entries(value as Record<string, unknown>).reduce<RoleRoomProjectWorkspaceState['filtersBySurface']>((acc, [key, entry]) => {
          const surfaceKey = normalizeWorkspaceSurfaceKey(key);
          if (!surfaceKey || !entry || typeof entry !== 'object') {
            return acc;
          }
          const record = entry as Record<string, unknown>;
          acc[surfaceKey] = {
            candidateStatusFilter: typeof record.candidateStatusFilter === 'string' ? record.candidateStatusFilter : undefined,
            candidateViewMode: record.candidateViewMode === 'kanban' ? 'kanban' : record.candidateViewMode === 'list' ? 'list' : undefined,
            selectionPhaseFilter:
              record.selectionPhaseFilter === 'screening'
              || record.selectionPhaseFilter === 'callbacks'
              || record.selectionPhaseFilter === 'final'
              || record.selectionPhaseFilter === 'all'
                ? record.selectionPhaseFilter
                : undefined,
            calendarViewMode: record.calendarViewMode === 'crew' ? 'crew' : record.calendarViewMode === 'production' ? 'production' : undefined,
            contentProducerPlannerSurface:
              record.contentProducerPlannerSurface === 'overview'
              || record.contentProducerPlannerSurface === 'project_room'
              || record.contentProducerPlannerSurface === 'approval'
              || record.contentProducerPlannerSurface === 'delivery'
              || record.contentProducerPlannerSurface === 'economy'
                ? record.contentProducerPlannerSurface
                : undefined,
            producerMediaWorkspace: typeof record.producerMediaWorkspace === 'string' ? record.producerMediaWorkspace : null,
          };
          return acc;
        }, {});
      };
      const normalizeSortingBySurface = (value: unknown): RoleRoomProjectWorkspaceState['sortingBySurface'] => {
        if (!value || typeof value !== 'object') {
          return {};
        }
        return Object.entries(value as Record<string, unknown>).reduce<RoleRoomProjectWorkspaceState['sortingBySurface']>((acc, [key, entry]) => {
          const surfaceKey = normalizeWorkspaceSurfaceKey(key);
          if (!surfaceKey || !entry || typeof entry !== 'object') {
            return acc;
          }
          const record = entry as Record<string, unknown>;
          const sortKey = typeof record.key === 'string' && record.key.trim().length > 0 ? record.key.trim() : 'updatedAt';
          acc[surfaceKey] = {
            key: sortKey,
            direction: record.direction === 'asc' ? 'asc' : 'desc',
          };
          return acc;
        }, {});
      };
      const normalizeProjectState = (projectId: string, value: unknown): RoleRoomProjectWorkspaceState | null => {
        if (!projectId || !value || typeof value !== 'object') {
          return null;
        }
        const record = value as RoleRoomProjectWorkspaceState & Record<string, unknown>;
        const projectStoryArcView = record.storyArcView;
        const projectStoryArcViewValid = projectStoryArcView === 'main'
          || projectStoryArcView === 'story-logic'
          || projectStoryArcView === 'story-writer'
          || projectStoryArcView === 'shot-list'
          || projectStoryArcView === 'planning';
        const projectPlannerSurface = record.contentProducerPlannerSurface;
        const projectPlannerSurfaceValid = projectPlannerSurface === 'overview'
          || projectPlannerSurface === 'project_room'
          || projectPlannerSurface === 'approval'
          || projectPlannerSurface === 'delivery'
          || projectPlannerSurface === 'economy';
        return {
          projectId,
          activeTab: Number.isFinite(record.activeTab) ? record.activeTab : 0,
          storyArcView: projectStoryArcViewValid ? projectStoryArcView : 'main',
          storyArcFocus: normalizeStoryArcNavigationFocus(record.storyArcFocus),
          contentProducerPlannerSurface: projectPlannerSurfaceValid ? projectPlannerSurface : 'overview',
          producerMediaFocus: record.producerMediaFocus && typeof record.producerMediaFocus === 'object'
            ? {
                workspace: typeof record.producerMediaFocus.workspace === 'string' ? record.producerMediaFocus.workspace : undefined,
                sectionId: typeof record.producerMediaFocus.sectionId === 'string' ? record.producerMediaFocus.sectionId : undefined,
                pageId: typeof record.producerMediaFocus.pageId === 'string' ? record.producerMediaFocus.pageId : undefined,
                artifactId: typeof record.producerMediaFocus.artifactId === 'string' ? record.producerMediaFocus.artifactId : undefined,
              }
            : null,
          contentProducerResumeTarget: record.contentProducerResumeTarget && typeof record.contentProducerResumeTarget === 'object'
            ? contentProducerResumeTargetValid
            : null,
          scrollBySurface: normalizeScrollBySurface(record.scrollBySurface),
          filtersBySurface: normalizeFiltersBySurface(record.filtersBySurface),
          sortingBySurface: normalizeSortingBySurface(record.sortingBySurface),
          updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
        };
      };
      const projectStatesRecord = storedRecord.projectStates && typeof storedRecord.projectStates === 'object'
        ? storedRecord.projectStates as Record<string, unknown>
        : {};
      const projectStates = Object.entries(projectStatesRecord).reduce<Record<string, RoleRoomProjectWorkspaceState>>((acc, [projectId, value]) => {
        const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
        const projectState = normalizeProjectState(normalizedProjectId, value);
        if (projectState) {
          acc[normalizedProjectId] = projectState;
        }
        return acc;
      }, {});
      const lastRealProjectId = typeof storedRecord.lastRealProjectId === 'string' && storedRecord.lastRealProjectId.trim().length > 0
        ? storedRecord.lastRealProjectId.trim()
        : typeof stored.projectId === 'string' && stored.projectId.trim().length > 0
          ? stored.projectId.trim()
          : null;
      return {
        projectId: lastRealProjectId,
        lastRealProjectId,
        activeTab: Number.isFinite(stored.activeTab) ? stored.activeTab : 0,
        storyArcView: storyArcViewValid ? nextStoryArcView : 'main',
        storyArcFocus: nextStoryArcFocus,
        contentProducerPlannerSurface: plannerSurfaceValid ? nextContentProducerPlannerSurface : 'overview',
        producerMediaFocus: producerMediaFocusValid,
        contentProducerResumeTarget: contentProducerResumeTargetValid,
        projectStates,
        updatedAt: typeof storedRecord.updatedAt === 'string' ? storedRecord.updatedAt : undefined,
      };
    } catch (error) {
      console.warn('Failed to load persisted Role Room workspace state:', error);
      return null;
    }
  }, [getSettingsUserId, normalizeWorkspaceSurfaceKey, roleRoomWorkspaceStateNamespace]);
  useEffect(() => {
    if (!authLoaded || !adminUser) {
      return;
    }

    let cancelled = false;

    const hydrateWorkspaceState = async () => {
      const stored = await loadPersistedWorkspaceState();
      if (cancelled || !stored) {
        return;
      }
      persistedWorkspaceStateRef.current = stored;
      setStoryArcView(stored.storyArcView);
      setStoryArcFocus(stored.storyArcFocus ?? null);
      setContentProducerPlannerSurface(stored.contentProducerPlannerSurface ?? 'overview');
      lastProducerMediaFocusRef.current = stored.producerMediaFocus ?? null;
      setContentProducerResumeTarget(stored.contentProducerResumeTarget ?? null);
      setActiveTab(stored.activeTab);
    };

    void hydrateWorkspaceState();

    return () => {
      cancelled = true;
    };
  }, [adminUser, authLoaded, loadPersistedWorkspaceState]);
  const currentProjectTeamMembers = useMemo(() => {
    const deduped = new Set<string>();
    return (currentProject?.crew ?? [])
      .map((member) => {
        const raw = member as Record<string, unknown>;
        const name = typeof raw.name === 'string' ? raw.name.trim() : '';
        const roleLabelCandidate = [
          raw.roleLabel,
          raw.role,
          raw.crewRole,
          raw.crew_role,
          raw.title,
        ].find((value) => typeof value === 'string' && value.trim().length > 0);
        if (!name) {
          return null;
        }
        const dedupeKey = `${name.toLowerCase()}::${String(roleLabelCandidate || '').trim().toLowerCase()}`;
        if (deduped.has(dedupeKey)) {
          return null;
        }
        deduped.add(dedupeKey);
        return {
          name,
          roleLabel: typeof roleLabelCandidate === 'string' ? roleLabelCandidate : null,
        };
      })
      .filter((member): member is { name: string; roleLabel: string | null } => Boolean(member))
      .slice(0, 12);
  }, [currentProject?.crew]);
  const visibleHeaderProjects = useMemo(() => {
    if (useCompactHeaderLayout) {
      return compactHeaderProjects;
    }
    if (useFocusedWorkspaceHeader) {
      return headerProjects.slice(0, 1);
    }
    return headerProjects;
  }, [compactHeaderProjects, headerProjects, useCompactHeaderLayout, useFocusedWorkspaceHeader]);
  const hiddenVisibleHeaderProjectsCount = Math.max(0, orderedProjects.length - visibleHeaderProjects.length);
  const hasMoreVisibleHeaderProjects = hiddenVisibleHeaderProjectsCount > 0;
  const producerWorkflowEntityOptions = useMemo(
    () => (currentProject ? buildProducerWorkflowEntityOptions(currentProject) : []),
    [currentProject],
  );
  const producerWorkflowOwnerOptions = useMemo(
    () => (currentProject ? buildProducerWorkflowOwnerOptions(currentProject) : []),
    [currentProject],
  );
  const producerProjectSwitchPending = Boolean(currentProject && isProducerWorkspaceSession && permissionsLoading);

  const isTrollProject = useCallback((project: CastingProject): boolean => {
    const projectId = String(project.id || '').trim().toLowerCase();
    const projectName = String(project.name || '').trim().toLowerCase();
    return projectId === 'troll-project-2026' || projectName === 'troll';
  }, []);

  const isContentProducerDemoProject = useCallback((project: CastingProject): boolean => {
    const projectId = String(project.id || '').trim().toLowerCase();
    return projectId === castingService.getContentProducerDemoProjectId();
  }, []);

  const getProjectCreatorLabel = useCallback((project: CastingProject | null | undefined): string | null => {
    if (!project) {
      return null;
    }

    const rawProject = project as Record<string, unknown>;
    const rawCreatorValue = [
      rawProject.created_by_label,
      rawProject.createdByLabel,
      rawProject.createdByEmail,
      rawProject.createdBy,
      rawProject.created_by,
      rawProject.templateCreatedBy,
    ].find((value) => typeof value === 'string' && value.trim().length > 0);

    if (typeof rawCreatorValue !== 'string') {
      return null;
    }

    const normalizedCreatorValue = rawCreatorValue.trim();
    const normalizedAdminId = String(adminUser?.id ?? '').trim();
    const normalizedAdminEmail = String(adminUser?.email ?? '').trim().toLowerCase();

    if (
      normalizedCreatorValue === normalizedAdminId
      || normalizedCreatorValue.toLowerCase() === normalizedAdminEmail
    ) {
      return adminUser?.display_name || adminUser?.name || adminUser?.email || 'Deg';
    }

    return normalizedCreatorValue;
  }, [adminUser?.display_name, adminUser?.email, adminUser?.id, adminUser?.name]);

  const getProjectOwnerLabel = useCallback((project: CastingProject | null | undefined): string | null => {
    if (!project) {
      return null;
    }
    const rawProject = project as Record<string, unknown>;
    const rawOwnerValue = [
      rawProject.ownerLabel,
      rawProject.owner_label,
      rawProject.ownerEmail,
      rawProject.owner_email,
      rawProject.ownerId,
      rawProject.owner_id,
    ].find((value) => typeof value === 'string' && value.trim().length > 0);

    if (typeof rawOwnerValue !== 'string') {
      return getProjectCreatorLabel(project);
    }

    const normalizedOwnerValue = rawOwnerValue.trim();
    const normalizedAdminId = String(adminUser?.id ?? '').trim();
    const normalizedAdminEmail = String(adminUser?.email ?? '').trim().toLowerCase();
    if (
      normalizedOwnerValue === normalizedAdminId
      || normalizedOwnerValue.toLowerCase() === normalizedAdminEmail
    ) {
      return adminUser?.display_name || adminUser?.name || adminUser?.email || 'Deg';
    }
    return normalizedOwnerValue;
  }, [adminUser?.display_name, adminUser?.email, adminUser?.id, adminUser?.name, getProjectCreatorLabel]);

  const isArchivedWorkspaceProject = useCallback((project: CastingProject | null | undefined): boolean => (
    castingService.isArchivedProject(project)
  ), []);

  const isRestorableWorkspaceProject = useCallback((project: CastingProject | null | undefined): project is CastingProject => {
    if (!project) {
      return false;
    }
    if (isTemplateProject(project)) {
      return false;
    }
    if (isTrollProject(project)) {
      return false;
    }
    if (isContentProducerDemoProject(project)) {
      return false;
    }
    if (isProtectedDemoProject(project)) {
      return false;
    }
    return true;
  }, [
    isContentProducerDemoProject,
    isProtectedDemoProject,
    isTemplateProject,
    isTrollProject,
  ]);

  const filterProjectsForSession = useCallback((projectList: CastingProject[]): CastingProject[] => {
    const workspaceProjects = projectList.filter((project) => !isTemplateProject(project));
    if (isClientReviewerMode || isClientReviewerSession) {
      return workspaceProjects.filter((project) => !isProtectedDemoProject(project));
    }
    if (isProducerWorkspaceSession) {
      return workspaceProjects.filter((project) => !isTrollProject(project));
    }

    return workspaceProjects.filter((project) => !isContentProducerDemoProject(project));
  }, [
    isClientReviewerMode,
    isClientReviewerSession,
    isContentProducerDemoProject,
    isProducerWorkspaceSession,
    isProtectedDemoProject,
    isTemplateProject,
    isTrollProject,
  ]);

  useEffect(() => onProducerWorkflowEvent((payload) => {
    if (payload.domain !== 'project') {
      return;
    }

    void (async () => {
      const refreshedProject = await castingService.getProject(payload.projectId);
      if (!refreshedProject) {
        return;
      }

      setProjects((previous) => {
        const nextProjects = previous.some((project) => project.id === refreshedProject.id)
          ? previous.map((project) => (project.id === refreshedProject.id ? refreshedProject : project))
          : [refreshedProject, ...previous];
        return filterProjectsForSession(nextProjects);
      });

      if (currentProjectRef.current?.id === refreshedProject.id) {
        setCurrentProject(refreshedProject);
      }
    })();
  }), [filterProjectsForSession]);

  const handleSelectProjectFromSelector = useCallback(async (project: CastingProject) => {
    if ((isClientReviewerMode || isClientReviewerSession) && isProtectedDemoProject(project)) {
      toast.showWarning('Demo-prosjekter er ikke tilgjengelige for klienter.');
      return;
    }

    if (isProducerWorkspaceSession && isTrollProject(project)) {
      toast.showWarning('TROLL-prosjektet er kun tilgjengelig for produksjonsteam.');
      return;
    }

    if (currentProjectRef.current?.id === project.id) {
      setProjectSelectorOpen(false);
      setProjectSelectorQuery('');
      setProjectQuickActionsAnchorEl(null);
      setProjectQuickActionsProject(null);
      return;
    }

    if (projectSwitchInFlightRef.current === project.id) {
      return;
    }

    if (!confirmProjectSwitchIfNeeded(project)) {
      return;
    }

    const switchStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    projectSwitchTraceRef.current = {
      fromProjectId: currentProjectRef.current?.id ?? null,
      targetProjectId: project.id,
      startedAt: switchStartedAt,
      activeTab,
    };
    logRoleRoomDiagnostic('project-switch:start', {
      fromProjectId: currentProjectRef.current?.id ?? null,
      targetProjectId: project.id,
      activeTab,
    });

    projectSwitchInFlightRef.current = project.id;
    setProjectSelectorOpen(false);
    setProjectSelectorQuery('');
    setProjectQuickActionsAnchorEl(null);
    setProjectQuickActionsProject(null);
    setCurrentProjectId(project.id);
    setPermissionsLoading(true);

    try {
      logRoleRoomDiagnostic('project-switch:scoped-role:start', {
        targetProjectId: project.id,
      });
      await ensureScopedSessionProjectRole(project.id);
      logRoleRoomDiagnostic('project-switch:scoped-role:done', {
        targetProjectId: project.id,
        elapsedMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - switchStartedAt),
      });
      const projectFetchStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      logRoleRoomDiagnostic('project-switch:project-fetch:start', {
        targetProjectId: project.id,
      });
      const fullProject = await castingService.getProject(project.id);
      logRoleRoomDiagnostic('project-switch:project-fetch:done', {
        targetProjectId: project.id,
        elapsedMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - projectFetchStartedAt),
        resolvedProjectId: fullProject?.id ?? project.id,
      });
      startTransition(() => {
        logRoleRoomDiagnostic('project-switch:commit-requested', {
          targetProjectId: project.id,
        });
        setCurrentProject(fullProject ?? project);
      });
    } finally {
      if (projectSwitchInFlightRef.current === project.id) {
        projectSwitchInFlightRef.current = null;
      }
    }
  }, [
    activeTab,
    confirmProjectSwitchIfNeeded,
    ensureScopedSessionProjectRole,
    isClientReviewerMode,
    isClientReviewerSession,
    isProducerWorkspaceSession,
    isProtectedDemoProject,
    isTrollProject,
    toast,
  ]);

  const applyProjectSyncResult = useCallback((project: CastingProject) => {
    setProjects((previous) => {
      const nextProjects = previous.some((entry) => entry.id === project.id)
        ? previous.map((entry) => (entry.id === project.id ? project : entry))
        : [project, ...previous];
      return filterProjectsForSession(nextProjects);
    });
    if (currentProjectRef.current?.id === project.id) {
      setCurrentProject(project);
    }
  }, [filterProjectsForSession]);

  const handleVerifyProjectStorage = useCallback(async (project: CastingProject) => {
    if (projectSyncActionProjectId) {
      return;
    }

    setProjectSyncActionProjectId(project.id);
    try {
      const syncMeta = projectSyncMetaById[project.id] ?? await castingService.getProjectSyncMeta(project.id);
      let nextProject: CastingProject | null = null;
      let notice = 'Prosjektlagring er verifisert.';

      if (syncMeta.queuedChangeCount > 0) {
        const result = await castingService.syncQueuedProjectChanges(project.id);
        if (result.failed.length > 0) {
          throw new Error(result.failed[0]?.error ?? 'Kunne ikke synkronisere lokale endringer.');
        }
        nextProject = await castingService.getProject(project.id);
        notice = 'Lokale endringer er synkronisert og bekreftet på server.';
      } else if (!syncMeta.lastSyncedAt) {
        await castingService.saveProject(project);
        nextProject = await castingService.getProject(project.id);
        notice = 'Prosjektet er sendt til server og bekreftet lagret.';
      } else {
        nextProject = await castingService.resyncProjectFromServer(project.id);
        notice = 'Prosjektet er hentet fra server uten hard refresh.';
      }

      if (nextProject) {
        applyProjectSyncResult(nextProject);
      }
      await loadProjectSyncMeta([project.id]);
      toast.showSuccess(notice);
    } catch (error) {
      console.error('Failed to verify project storage:', error);
      toast.showError(error instanceof Error ? error.message : 'Kunne ikke verifisere prosjektlagringen.');
      await loadProjectSyncMeta([project.id]).catch(() => undefined);
    } finally {
      setProjectSyncActionProjectId(null);
    }
  }, [applyProjectSyncResult, loadProjectSyncMeta, projectSyncActionProjectId, projectSyncMetaById, toast]);

  const handleOpenProjectCopyDialog = useCallback((
    project: CastingProject,
    options?: { closeSelector?: boolean },
  ) => {
    const copyName = isTemplateProject(project)
      ? `${String(project.templateSourceProjectName || project.name || 'Mal').replace(/^Template\s*·\s*/i, '')} · prosjekt`
      : `${project.name || 'Prosjekt'} · kopi`;
    setProjectCopyDialog({
      project,
      closeSelector: options?.closeSelector,
      name: copyName,
      includeClientData: false,
      includeReviewHistory: false,
      includeEconomy: false,
      includeTeam: true,
      includeProductionData: true,
    });
    setProjectQuickActionsAnchorEl(null);
    setProjectQuickActionsProject(null);
  }, [isTemplateProject]);

  const handleSubmitProjectCopy = useCallback(async () => {
    if (!projectCopyDialog) {
      return;
    }
    const { project } = projectCopyDialog;
    try {
      setProjectCopySubmitting(true);
      const copyOptions: RoleRoomProjectCopyOptions = {
        name: projectCopyDialog.name.trim() || undefined,
        includeClientData: projectCopyDialog.includeClientData,
        includeReviewHistory: projectCopyDialog.includeReviewHistory,
        includeEconomy: projectCopyDialog.includeEconomy,
        includeTeam: projectCopyDialog.includeTeam,
        includeProductionData: projectCopyDialog.includeProductionData,
        includeSecrets: false,
      };
      const copiedProject = await castingService.createProjectCopy(project.id, copyOptions);
      const rawProjects = await castingService.getProjects();
      setPublishedTemplates(rawProjects.filter((entry) => castingService.isTemplateProject(entry)));
      setProjects(filterProjectsForSession(rawProjects));
      setCurrentProject(copiedProject);
      setCurrentProjectId(copiedProject.id);
      await loadProjectSyncMeta([copiedProject.id]);
      if (projectCopyDialog.closeSelector) {
        setProjectSelectorOpen(false);
        setProjectSelectorQuery('');
      }
      setProjectQuickActionsAnchorEl(null);
      setProjectQuickActionsProject(null);
      setProjectCopyDialog(null);
      toast.showSuccess(
        isTemplateProject(project)
          ? 'Ny prosjektkopi ble opprettet fra malen.'
          : 'Ny trygg prosjektkopi ble opprettet.',
      );
    } catch (error) {
      console.error('Failed to create project copy:', error);
      toast.showError('Kunne ikke lage en kopi av prosjektet.');
    } finally {
      setProjectCopySubmitting(false);
    }
  }, [filterProjectsForSession, isTemplateProject, loadProjectSyncMeta, projectCopyDialog, toast]);

  const handlePublishProjectTemplate = useCallback(async (project: CastingProject) => {
    try {
      await castingService.publishProjectAsTemplate(project.id, {
        audience: templateAudienceForSession,
        status: 'published',
      });
      const rawProjects = await castingService.getProjects();
      setPublishedTemplates(rawProjects.filter((entry) => castingService.isTemplateProject(entry)));
      setProjects(filterProjectsForSession(rawProjects));
      setProjectQuickActionsAnchorEl(null);
      setProjectQuickActionsProject(null);
      toast.showSuccess(
        templateAudienceForSession === 'content_producer'
          ? 'Template for innholdsprodusent er publisert.'
          : 'Template for produksjonsteam er publisert.',
      );
    } catch (error) {
      console.error('Failed to publish project as template:', error);
      toast.showError('Kunne ikke publisere prosjektet som template.');
    }
  }, [filterProjectsForSession, templateAudienceForSession, toast]);

  const refreshProjectsAfterLifecycleChange = useCallback(async (updatedProject: CastingProject) => {
    const rawProjects = await castingService.getProjects();
    setPublishedTemplates(rawProjects.filter((entry) => castingService.isTemplateProject(entry)));
    setProjects(filterProjectsForSession(rawProjects));
    if (currentProject?.id === updatedProject.id) {
      setCurrentProject(updatedProject);
      setCurrentProjectId(updatedProject.id);
    }
    await loadProjectSyncMeta([updatedProject.id]).catch(() => undefined);
  }, [currentProject?.id, filterProjectsForSession, loadProjectSyncMeta]);

  const handleArchiveProject = useCallback(async (project: CastingProject) => {
    try {
      const archivedProject = await castingService.archiveProject(project.id);
      await refreshProjectsAfterLifecycleChange(archivedProject);
      handleCloseProjectQuickActions();
      toast.showSuccess('Prosjektet er arkivert.');
    } catch (error) {
      console.error('Failed to archive project:', error);
      toast.showError(error instanceof Error ? error.message : 'Kunne ikke arkivere prosjektet.');
    }
  }, [handleCloseProjectQuickActions, refreshProjectsAfterLifecycleChange, toast]);

  const handleRestoreArchivedProject = useCallback(async (project: CastingProject) => {
    try {
      const restoredProject = await castingService.restoreArchivedProject(project.id);
      await refreshProjectsAfterLifecycleChange(restoredProject);
      handleCloseProjectQuickActions();
      toast.showSuccess('Prosjektet er gjenopprettet.');
    } catch (error) {
      console.error('Failed to restore project:', error);
      toast.showError(error instanceof Error ? error.message : 'Kunne ikke gjenopprette prosjektet.');
    }
  }, [handleCloseProjectQuickActions, refreshProjectsAfterLifecycleChange, toast]);

  useEffect(() => {
    if (lastPermissionsLoadingRef.current === permissionsLoading) {
      return;
    }
    lastPermissionsLoadingRef.current = permissionsLoading;
    logRoleRoomDiagnostic('project-switch:permissions-loading', {
      loading: permissionsLoading,
      currentProjectId: currentProject?.id ?? null,
      inFlightProjectId: projectSwitchInFlightRef.current ?? null,
    });
  }, [currentProject?.id, permissionsLoading]);

  useEffect(() => {
    const trace = projectSwitchTraceRef.current;
    if (!trace || permissionsLoading || currentProject?.id !== trace.targetProjectId) {
      return;
    }

    logRoleRoomDiagnostic('project-switch:ready', {
      fromProjectId: trace.fromProjectId,
      targetProjectId: trace.targetProjectId,
      activeTab: trace.activeTab,
      elapsedMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - trace.startedAt),
    });
    projectSwitchTraceRef.current = null;
  }, [currentProject?.id, permissionsLoading]);

  // Get terminology helper (must be after profession state is defined)
  const getTerm = (key: string): string => {
    if (!profession) return key;
    const terminology = PROFESSION_CONFIG[profession]?.terminology as Record<string, string> | undefined;
    return terminology?.[key] || key;
  };

  // Get profession config helper (must be after profession state is defined)
  const getProfessionConfig = () => {
    if (!profession) return null;
    return PROFESSION_CONFIG[profession];
  };

  // Tab colors and icons matching quick navigation design (will be adapted based on profession)
  const professionConfig = getProfessionConfig();
  const tabConfig = useMemo(() => [
    { color: professionConfig?.color || '#8b5cf6', icon: _DashboardIcon },
    { color: '#ec4899', icon: StoryArcIcon },
    { color: '#f48fb1', icon: TheaterComedyIcon },
    { color: professionConfig?.color || '#10b981', icon: RecentActorsIcon },
    { color: '#ffb800', icon: _InterpreterModeIcon },
    { color: '#14b8a6', icon: SelectionTabIcon },
    { color: '#4caf50', icon: LocationIcon },
    { color: '#9c27b0', icon: CalendarIcon },
    { color: '#00d4ff', icon: GroupsIcon },
    { color: '#9333ea', icon: EquipmentIcon },
    { color: '#ef4444', icon: VideocamIcon },
    { color: '#60a5fa', icon: PermMediaIcon },
    { color: '#34d399', icon: AttachMoneyIcon },
    { color: '#38bdf8', icon: TimelineIcon },
    { color: '#c084fc', icon: FactCheckIcon },
    { color: '#fbbf24', icon: ImportExportIcon },
  ], [professionConfig?.color]);
  const visibleTabValues = useMemo<number[]>(() => {
    if (isExternalClientPortalMode) {
      return [
        PRODUCER_MEDIA_TAB_INDEX,
        PRODUCER_REVIEWS_TAB_INDEX,
        PRODUCER_EXPORT_TAB_INDEX,
      ];
    }

    if (isContentProducerMode) {
      const producerTabs = [
        STORY_ARC_TAB_INDEX,
        CANDIDATES_TAB_INDEX,
      ];
      return producerTabs;
    }

    if (isClientReviewerMode) {
      const reviewerTabs = [
        PRODUCER_TIMELINE_TAB_INDEX,
        PRODUCER_MEDIA_TAB_INDEX,
        PRODUCER_REVIEWS_TAB_INDEX,
        PRODUCER_EXPORT_TAB_INDEX,
      ];
      if (canViewProducerEconomy) {
        reviewerTabs.splice(1, 0, PRODUCER_ECONOMY_TAB_INDEX);
      }
      return reviewerTabs;
    }

    return [
      0,
      STORY_ARC_TAB_INDEX,
      ROLES_TAB_INDEX,
      CANDIDATES_TAB_INDEX,
      AUDITIONS_TAB_INDEX,
      SELECTION_TAB_INDEX,
      LOCATIONS_TAB_INDEX,
      CALENDAR_TAB_INDEX,
      TEAM_TAB_INDEX,
      EQUIPMENT_TAB_INDEX,
      ...(canViewProducerEconomy ? [PRODUCER_ECONOMY_TAB_INDEX] : []),
      LIVE_SET_TAB_INDEX,
    ];
  }, [canViewProducerEconomy, isClientReviewerMode, isContentProducerMode, isExternalClientPortalMode]);

  useEffect(() => {
    if (!visibleTabValues.includes(activeTab)) {
      setActiveTab(visibleTabValues[0] ?? 0);
    }
  }, [activeTab, visibleTabValues]);

  const displayedActiveTab = visibleTabValues.includes(activeTab)
    ? activeTab
    : (visibleTabValues[0] ?? 0);

  useEffect(() => {
    if (!isContentProducerMode && contentProducerPlannerSurface !== 'overview') {
      setContentProducerPlannerSurface('overview');
      return;
    }
    if (!canViewProducerEconomy && contentProducerPlannerSurface === 'economy') {
      setContentProducerPlannerSurface('overview');
    }
  }, [canViewProducerEconomy, contentProducerPlannerSurface, isContentProducerMode]);

  const contentProducerPlannerSurfaceItems = useMemo(
    () => (
      canViewProducerEconomy
        ? CONTENT_PRODUCER_PLANNER_SURFACE_ITEMS
        : CONTENT_PRODUCER_PLANNER_SURFACE_ITEMS.filter((item) => item.value !== 'economy')
    ),
    [CONTENT_PRODUCER_PLANNER_SURFACE_ITEMS, canViewProducerEconomy],
  );

  const activeContentProducerPlannerSurfaceItem = useMemo(
    () => contentProducerPlannerSurfaceItems.find((item) => item.value === contentProducerPlannerSurface)
      ?? contentProducerPlannerSurfaceItems[0]
      ?? CONTENT_PRODUCER_PLANNER_SURFACE_ITEMS[0],
    [CONTENT_PRODUCER_PLANNER_SURFACE_ITEMS, contentProducerPlannerSurface, contentProducerPlannerSurfaceItems],
  );

  useEffect(() => {
    if (!isContentProducerMode) {
      return;
    }

    if (contentProducerPlannerSurface === 'overview') {
      return;
    }

    setContentProducerResumeTarget((previous) => ({
      surface: contentProducerPlannerSurface,
      mediaFocus: contentProducerPlannerSurface === 'project_room'
        ? (producerMediaFocus ?? previous?.mediaFocus ?? lastProducerMediaFocusRef.current ?? null)
        : null,
    }));
  }, [contentProducerPlannerSurface, isContentProducerMode, producerMediaFocus]);

  const contentProducerWorkspaceLabels: Record<string, string> = {
    brief: 'Brief',
    materials: 'Materialer',
    storyboard: 'Storyboard',
    manuscript: 'Manus',
    shotlist: 'Shotlist',
    brand: 'Merkevare',
    accounts: 'Kontotilgang',
    delivery: 'Levering',
    meetings: 'Møter',
  };

  const contentProducerResumeCard = useMemo(() => {
    if (!isContentProducerMode || !contentProducerResumeTarget || contentProducerResumeTarget.surface === 'overview') {
      return null;
    }

    if (contentProducerResumeTarget.surface === 'project_room') {
      const workspaceLabel = contentProducerWorkspaceLabels[contentProducerResumeTarget.mediaFocus?.workspace ?? 'brief'] ?? 'Prosjektrom';
      const pageDetail = contentProducerResumeTarget.mediaFocus?.pageId?.trim()
        || contentProducerResumeTarget.mediaFocus?.sectionId?.trim()
        || contentProducerResumeTarget.mediaFocus?.artifactId?.trim()
        || '';
      return {
        title: workspaceLabel,
        detail: pageDetail
          ? `Sist jobbet du i ${workspaceLabel.toLowerCase()} · ${pageDetail}`
          : `Sist jobbet du i ${workspaceLabel.toLowerCase()}.`,
        actionLabel: `Fortsett i ${workspaceLabel.toLowerCase()}`,
      };
    }

    const surfaceLabel = CONTENT_PRODUCER_PLANNER_SURFACE_ITEMS.find((item) => item.value === contentProducerResumeTarget.surface)?.label
      ?? 'Oversikt';
    const surfaceDetails: Record<Exclude<ContentProducerPlannerSurface, 'overview' | 'project_room'>, string> = {
      approval: 'Gå tilbake til klientfeedback, åpne punkter og beslutninger som venter.',
      delivery: 'Fortsett med leveranser, eksport og hva som skal ut til kunden.',
      economy: 'Gå tilbake til budsjett, økonomiske avklaringer og godkjenninger.',
    };

    return {
      title: surfaceLabel,
      detail: surfaceDetails[contentProducerResumeTarget.surface as Exclude<ContentProducerPlannerSurface, 'overview' | 'project_room'>],
      actionLabel: `Fortsett i ${surfaceLabel.toLowerCase()}`,
    };
  }, [CONTENT_PRODUCER_PLANNER_SURFACE_ITEMS, contentProducerResumeTarget, contentProducerWorkspaceLabels, isContentProducerMode]);

  const handleResumeContentProducerWorkspace = useCallback(() => {
    const resumeTarget = contentProducerResumeTarget;
    if (!resumeTarget || resumeTarget.surface === 'overview') {
      openContentProducerPlannerSurface('project_room', {
        mediaFocus: producerMediaFocus ?? lastProducerMediaFocusRef.current ?? null,
      });
      return;
    }

    openContentProducerPlannerSurface(resumeTarget.surface, {
      mediaFocus: resumeTarget.surface === 'project_room'
        ? (resumeTarget.mediaFocus ?? producerMediaFocus ?? lastProducerMediaFocusRef.current ?? null)
        : null,
    });
  }, [contentProducerResumeTarget, openContentProducerPlannerSurface, producerMediaFocus]);

  useEffect(() => {
    if (!authLoaded || !adminUser) {
      return;
    }

    if (
      currentProject?.id
      && workspaceRestoreProjectIdRef.current === currentProject.id
    ) {
      return;
    }

    const previousState = persistedWorkspaceStateRef.current;
    const previousRealProjectId = previousState?.lastRealProjectId ?? previousState?.projectId ?? null;
    const isCurrentProjectRestorable = isRestorableWorkspaceProject(currentProject);
    const lastRealProjectId = isCurrentProjectRestorable ? currentProject.id : previousRealProjectId;
    const surfaceKey = getWorkspaceSurfaceKey(displayedActiveTab, storyArcView, contentProducerPlannerSurface);
    const now = new Date().toISOString();
    const previousProjectStates = previousState?.projectStates ?? {};
    const previousProjectState = isCurrentProjectRestorable
      ? previousProjectStates[currentProject.id] ?? null
      : null;
    const nextProjectStates = isCurrentProjectRestorable
      ? {
          ...previousProjectStates,
          [currentProject.id]: {
            projectId: currentProject.id,
            activeTab: displayedActiveTab,
            storyArcView: displayedActiveTab === STORY_ARC_TAB_INDEX
              ? storyArcView
              : previousProjectState?.storyArcView ?? 'main',
            storyArcFocus: displayedActiveTab === STORY_ARC_TAB_INDEX
              ? storyArcFocus
              : previousProjectState?.storyArcFocus ?? null,
            contentProducerPlannerSurface: isContentProducerMode
              ? contentProducerPlannerSurface
              : previousProjectState?.contentProducerPlannerSurface ?? 'overview',
            producerMediaFocus: lastProducerMediaFocusRef.current ?? previousProjectState?.producerMediaFocus ?? null,
            contentProducerResumeTarget: isContentProducerMode
              ? contentProducerResumeTarget
              : previousProjectState?.contentProducerResumeTarget ?? null,
            scrollBySurface: previousProjectState?.scrollBySurface ?? {},
            filtersBySurface: {
              ...(previousProjectState?.filtersBySurface ?? {}),
              [surfaceKey]: buildWorkspaceFiltersForCurrentSurface(),
            },
            sortingBySurface: {
              ...(previousProjectState?.sortingBySurface ?? {}),
              [surfaceKey]: buildWorkspaceSortingForCurrentSurface(surfaceKey),
            },
            updatedAt: now,
          },
        }
      : previousProjectStates;
    const nextState: RoleRoomWorkspaceState = {
      projectId: lastRealProjectId,
      lastRealProjectId,
      activeTab: displayedActiveTab,
      storyArcView: displayedActiveTab === STORY_ARC_TAB_INDEX ? storyArcView : 'main',
      storyArcFocus: displayedActiveTab === STORY_ARC_TAB_INDEX ? storyArcFocus : null,
      contentProducerPlannerSurface: isContentProducerMode ? contentProducerPlannerSurface : undefined,
      producerMediaFocus: lastProducerMediaFocusRef.current,
      contentProducerResumeTarget: isContentProducerMode ? contentProducerResumeTarget : undefined,
      projectStates: nextProjectStates,
      updatedAt: now,
    };

    scheduleWorkspaceStatePersist(nextState);
  }, [
    adminUser,
    authLoaded,
    buildWorkspaceFiltersForCurrentSurface,
    buildWorkspaceSortingForCurrentSurface,
    contentProducerPlannerSurface,
    contentProducerResumeTarget,
    currentProject,
    displayedActiveTab,
    getWorkspaceSurfaceKey,
    isContentProducerMode,
    isRestorableWorkspaceProject,
    scheduleWorkspaceStatePersist,
    storyArcFocus,
    storyArcView,
  ]);

  const persistWorkspaceScrollState = useCallback((top: number, left: number) => {
    if (!authLoaded || !adminUser) {
      return;
    }

    const project = currentProjectRef.current;
    if (!isRestorableWorkspaceProject(project)) {
      return;
    }

    const previousState = persistedWorkspaceStateRef.current;
    const previousProjectStates = previousState?.projectStates ?? {};
    const previousProjectState = previousProjectStates[project.id] ?? null;
    const surfaceKey = getWorkspaceSurfaceKey(displayedActiveTab, storyArcView, contentProducerPlannerSurface);
    const now = new Date().toISOString();
    const lastRealProjectId = previousState?.lastRealProjectId ?? previousState?.projectId ?? project.id;
    const nextProjectState: RoleRoomProjectWorkspaceState = {
      projectId: project.id,
      activeTab: displayedActiveTab,
      storyArcView: displayedActiveTab === STORY_ARC_TAB_INDEX
        ? storyArcView
        : previousProjectState?.storyArcView ?? 'main',
      storyArcFocus: displayedActiveTab === STORY_ARC_TAB_INDEX
        ? storyArcFocus
        : previousProjectState?.storyArcFocus ?? null,
      contentProducerPlannerSurface: isContentProducerMode
        ? contentProducerPlannerSurface
        : previousProjectState?.contentProducerPlannerSurface ?? 'overview',
      producerMediaFocus: lastProducerMediaFocusRef.current ?? previousProjectState?.producerMediaFocus ?? null,
      contentProducerResumeTarget: isContentProducerMode
        ? contentProducerResumeTarget
        : previousProjectState?.contentProducerResumeTarget ?? null,
      scrollBySurface: {
        ...(previousProjectState?.scrollBySurface ?? {}),
        [surfaceKey]: {
          top: Math.max(0, top),
          left: Math.max(0, left),
          updatedAt: now,
        },
      },
      filtersBySurface: previousProjectState?.filtersBySurface ?? {},
      sortingBySurface: previousProjectState?.sortingBySurface ?? {},
      updatedAt: now,
    };
    const nextState: RoleRoomWorkspaceState = {
      projectId: lastRealProjectId,
      lastRealProjectId,
      activeTab: previousState?.activeTab ?? displayedActiveTab,
      storyArcView: previousState?.storyArcView ?? storyArcView,
      storyArcFocus: previousState?.storyArcFocus ?? storyArcFocus,
      contentProducerPlannerSurface: previousState?.contentProducerPlannerSurface ?? contentProducerPlannerSurface,
      producerMediaFocus: previousState?.producerMediaFocus ?? lastProducerMediaFocusRef.current,
      contentProducerResumeTarget: previousState?.contentProducerResumeTarget ?? contentProducerResumeTarget,
      projectStates: {
        ...previousProjectStates,
        [project.id]: nextProjectState,
      },
      updatedAt: now,
    };

    scheduleWorkspaceStatePersist(nextState);
  }, [
    adminUser,
    authLoaded,
    contentProducerPlannerSurface,
    contentProducerResumeTarget,
    displayedActiveTab,
    getWorkspaceSurfaceKey,
    isContentProducerMode,
    isRestorableWorkspaceProject,
    scheduleWorkspaceStatePersist,
    storyArcFocus,
    storyArcView,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleWindowScroll = () => {
      persistWorkspaceScrollState(window.scrollY, window.scrollX);
    };
    const handlePanelScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      persistWorkspaceScrollState(target.scrollTop, target.scrollLeft);
    };
    const workspaceRoot = workspaceRootRef.current;

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    workspaceRoot?.addEventListener('scroll', handlePanelScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      workspaceRoot?.removeEventListener('scroll', handlePanelScroll, { capture: true });
    };
  }, [persistWorkspaceScrollState]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentProject?.id) {
      return;
    }

    const projectWorkspaceState = persistedWorkspaceStateRef.current?.projectStates?.[currentProject.id] ?? null;
    if (!projectWorkspaceState) {
      return;
    }

    const surfaceKey = getWorkspaceSurfaceKey(displayedActiveTab, storyArcView, contentProducerPlannerSurface);
    const scrollState = projectWorkspaceState.scrollBySurface?.[surfaceKey] ?? null;
    if (!scrollState) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.scrollTo({
        top: scrollState.top,
        left: scrollState.left,
        behavior: 'auto',
      });
      if (workspaceRootRef.current) {
        workspaceRootRef.current.scrollTop = scrollState.top;
        workspaceRootRef.current.scrollLeft = scrollState.left;
      }
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    contentProducerPlannerSurface,
    currentProject?.id,
    displayedActiveTab,
    getWorkspaceSurfaceKey,
    storyArcView,
  ]);

  const clientPortalTargetTab = useMemo(() => {
    if (!clientPortalIntent) {
      return null;
    }
    if (clientPortalIntent.tab === 'reviews') {
      return PRODUCER_REVIEWS_TAB_INDEX;
    }
    if (clientPortalIntent.tab === 'export') {
      return PRODUCER_EXPORT_TAB_INDEX;
    }
    return PRODUCER_MEDIA_TAB_INDEX;
  }, [clientPortalIntent]);

  const effectiveStoryArcView: StoryArcView = isContentProducerMode && storyArcView === 'main'
    ? 'planning'
    : storyArcView;

  useEffect(() => {
    if (!authLoaded || !isClientReviewerSession || !clientPortalIntent || projects.length === 0) {
      return;
    }

    const intentKey = [
      clientPortalIntent.projectId,
      clientPortalIntent.tab,
      clientPortalIntent.workspace,
      clientPortalIntent.sectionId ?? '',
      clientPortalIntent.pageId ?? '',
      clientPortalIntent.reviewId ?? '',
    ].join(':');
    if (appliedClientPortalIntentRef.current === intentKey) {
      return;
    }
    const targetProject = projects.find((project) => project.id === clientPortalIntent.projectId);
    if (!targetProject) {
      return;
    }

    if (currentProject?.id !== targetProject.id) {
      let isCancelled = false;
      void castingService.getProject(targetProject.id).then((resolvedProject) => {
        if (isCancelled) {
          return;
        }
        setCurrentProject(resolvedProject ?? targetProject);
        setCurrentProjectId(targetProject.id);
      });
      return () => {
        isCancelled = true;
      };
    }

    if (clientPortalTargetTab !== null && activeTab !== clientPortalTargetTab) {
      setActiveTab(clientPortalTargetTab);
      return;
    }

    appliedClientPortalIntentRef.current = intentKey;
    return undefined;
  }, [
    activeTab,
    authLoaded,
    clientPortalIntent,
    clientPortalTargetTab,
    currentProject?.id,
    isClientReviewerSession,
    projects,
  ]);

  // URL-state sync for activeTab + project. Each tab switch or project
  // swap writes `?tab=<slug>&project=<id>` via pushState so the browser
  // back button walks through the in-app navigation instead of jumping
  // straight to the landing page, and hard-refresh / shared links drop
  // the user back into the same place. Skipped when client-portal URL
  // schema owns the query string.
  useEffect(() => {
    if (isExternalClientPortalMode || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabId = TAB_IDS[activeTab];
    const desiredTabSlug = tabId ? tabId.replace(/^tabpanel-/, '') : String(activeTab);
    const desiredProject = currentProject?.id ?? '';
    const currentTabParam = params.get('tab') ?? '';
    const currentProjectParam = params.get('project') ?? '';
    if (currentTabParam === desiredTabSlug && currentProjectParam === desiredProject) return;
    if (desiredTabSlug) params.set('tab', desiredTabSlug);
    else params.delete('tab');
    if (desiredProject) params.set('project', desiredProject);
    else params.delete('project');
    const nextSearch = params.toString() ? `?${params.toString()}` : '';
    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
    if (nextUrl === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    window.history.pushState({ rrStateSync: true }, '', nextUrl);
  }, [activeTab, currentProject?.id, isExternalClientPortalMode]);

  // Rehydrate activeTab + currentProject when the user hits browser
  // back/forward. Without this, pushing URLs only *writes* history
  // entries; popping them would have no effect on state and the UI
  // would look stuck on whatever was last rendered.
  const projectsRef = useRef(projects);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  // On first mount, seed persistedWorkspaceStateRef from the URL's
  // project param so the existing loadProjects → projectIdToLoad path
  // picks the URL-specified project over whatever was last persisted.
  const urlProjectSeededRef = useRef(false);
  useEffect(() => {
    if (urlProjectSeededRef.current) return;
    if (isExternalClientPortalMode || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlProject = params.get('project');
    if (!urlProject) {
      urlProjectSeededRef.current = true;
      return;
    }
    const existing = persistedWorkspaceStateRef.current;
    persistedWorkspaceStateRef.current = {
      ...(existing ?? {}),
      lastRealProjectId: urlProject,
      projectId: existing?.projectId ?? urlProject,
    };
    urlProjectSeededRef.current = true;
  }, [isExternalClientPortalMode]);

  useEffect(() => {
    if (isExternalClientPortalMode || typeof window === 'undefined') return;
    const applyFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get('tab');
      if (slug) {
        const byName = TAB_IDS.findIndex((id) => id === `tabpanel-${slug}`);
        const parsed = byName >= 0 ? byName : parseInt(slug, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          setActiveTab((previous) => (previous === parsed ? previous : parsed));
        }
      }
      const urlProject = params.get('project');
      if (urlProject) {
        const found = projectsRef.current.find((project) => project.id === urlProject);
        if (found) {
          setCurrentProject((previous) => (previous?.id === found.id ? previous : found));
        }
      }
    };
    window.addEventListener('popstate', applyFromUrl);
    return () => window.removeEventListener('popstate', applyFromUrl);
  }, [isExternalClientPortalMode]);

  // Producer workspace sessions must not auto-select the demo project.
  // Demo stays an explicit choice in the project selector only.
  useEffect(() => {
    if (!isProducerWorkspaceSession) return;

    let cancelled = false;

    const syncProducerWorkspaceProjects = async () => {
      try {
        const loadedProjects = filterProjectsForSession(await castingService.getProjects());
        if (cancelled) return;

        setProjects(loadedProjects);

        const activeProject = currentProjectRef.current;
        const hasValidCurrentProject = isRestorableWorkspaceProject(activeProject);
        if (hasValidCurrentProject) {
          return;
        }

        const persistedWorkspaceState = persistedWorkspaceStateRef.current ?? await loadPersistedWorkspaceState();
        if (persistedWorkspaceState) {
          persistedWorkspaceStateRef.current = persistedWorkspaceState;
        }

        const persistedRealProjectId = persistedWorkspaceState?.lastRealProjectId ?? persistedWorkspaceState?.projectId ?? null;
        const preferredProject = (
          persistedRealProjectId
            ? loadedProjects.find((project) => (
              project.id === persistedRealProjectId
              && isRestorableWorkspaceProject(project)
            ))
            : null
        ) ?? loadedProjects.find((project) => isRestorableWorkspaceProject(project)) ?? null;

        setCurrentProject((previous) => {
          if ((previous?.id ?? null) === (preferredProject?.id ?? null)) {
            return previous;
          }
          return preferredProject;
        });
      } catch (error) {
        console.error('Failed to sync producer workspace projects:', error);
      }
    };

    void syncProducerWorkspaceProjects();

    return () => {
      cancelled = true;
    };
  }, [
    filterProjectsForSession,
    isProducerWorkspaceSession,
    isRestorableWorkspaceProject,
    loadPersistedWorkspaceState,
  ]);

  useEffect(() => {
    if (!currentProject || !isContentProducerDemoProject(currentProject) || !isContentProducerMode || permissionsLoading) {
      return;
    }

    const projectId = currentProject.id;
    if (producerWorkflowBootstrappedProjectsRef.current.has(projectId)) {
      return;
    }

    let cancelled = false;

    const bootstrapProducerWorkflow = async () => {
      try {
        await producerWorkflowService.initializeContentProducerDemoWorkflow(projectId);
        if (cancelled) {
          return;
        }
        producerWorkflowBootstrappedProjectsRef.current.add(projectId);
        setProducerWorkflowBootstrapVersion((value) => value + 1);
      } catch (error) {
        console.error('Failed to initialize producer workflow demo data:', error);
      }
    };

    void bootstrapProducerWorkflow();

    return () => {
      cancelled = true;
    };
  }, [currentProject, isContentProducerDemoProject, isContentProducerMode, permissionsLoading]);

  const roleDialogAccentColor = '#b86bff';
  const roleDialogAccentSoftColor = alpha(roleDialogAccentColor, 0.2);
  const roleDialogBackdrop = `url(${rolesBackdrop4})`;
  const standaloneRoleRoomMode = shouldUseRoleRoomLocalFallback();
  const currentRoleRoomProfessionNamespace = 'roleRoom_castingProfession';
  const legacyRoleRoomProfessionNamespace = 'virtualStudio_castingProfession';
  const pinnedProjectsNamespace = 'roleRoom_pinnedProjects';
  const PINNED_PROJECT_ACCENT_COLORS = ['#f59e0b', '#34d399', '#60a5fa'] as const;

  // Load profession from API or settings cache
  const loadProfession = useCallback(async (): Promise<'photographer' | 'videographer' | null> => {
    const userId = getUserId();

    const readCachedProfession = async (): Promise<'photographer' | 'videographer' | null> => {
      try {
        const cachedCurrent = await settingsService.getSetting<string>(currentRoleRoomProfessionNamespace, { userId });
        if (cachedCurrent === 'photographer' || cachedCurrent === 'videographer') {
          return cachedCurrent;
        }

        const cachedLegacy = await settingsService.getSetting<string>(legacyRoleRoomProfessionNamespace, { userId });
        if (cachedLegacy === 'photographer' || cachedLegacy === 'videographer') {
          await settingsService.setSetting(currentRoleRoomProfessionNamespace, cachedLegacy, { userId });
          return cachedLegacy;
        }
      } catch (_error) {
        // Silently handle settings cache failure
      }

      return null;
    };

    if (standaloneRoleRoomMode) {
      return readCachedProfession();
    }

    try {
      const response = await fetch(`/api/user/kv/casting-profession?user_id=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.value && (data.value === 'photographer' || data.value === 'videographer')) {
          await settingsService.setSetting(currentRoleRoomProfessionNamespace, data.value, { userId });
          return data.value;
        }
      }
    } catch (_error) {
      // Silently handle API failure
    }

    return readCachedProfession();
  }, [currentRoleRoomProfessionNamespace, getUserId, legacyRoleRoomProfessionNamespace, standaloneRoleRoomMode]);

  // Save profession to API and settings cache
  const saveProfession = useCallback(async (prof: 'photographer' | 'videographer'): Promise<void> => {
    const userId = getUserId();

    if (standaloneRoleRoomMode) {
      await settingsService.setSetting(currentRoleRoomProfessionNamespace, prof, { userId });
      return;
    }

    try {
      await fetch('/api/user/kv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'casting-profession',
          value: prof,
          user_id: userId,
        }),
      });
      await settingsService.setSetting(currentRoleRoomProfessionNamespace, prof, { userId });
    } catch (_error) {
      // Silently handle API save failure
    }
    try {
      await settingsService.setSetting(currentRoleRoomProfessionNamespace, prof, { userId });
    } catch (_error) {
      // Silently handle settings cache save failure
    }
  }, [currentRoleRoomProfessionNamespace, getUserId, standaloneRoleRoomMode]);

  const syncScopedRoleRoomSession = useCallback(async () => {
    const updatedSession = await authSessionService.loadSession();
    setAdminUser(normalizeAdminUser(updatedSession.adminUser));

    if (!currentProject?.id) {
      return;
    }

    setPermissionsLoading(true);
    try {
      await ensureScopedSessionProjectRole(currentProject.id);
      const refreshedProject = await castingService.getProject(currentProject.id);
      if (refreshedProject) {
        setCurrentProject(refreshedProject);
      }
    } finally {
      setPermissionsLoading(false);
    }
  }, [currentProject, ensureScopedSessionProjectRole]);

  const clearClientPortalIntentUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    const url = new URL(window.location.href);
    [
      'portal',
      'projectId',
      'tab',
      'workspace',
      'section',
      'page',
      'reviewId',
      'artifactId',
    ].forEach((key) => url.searchParams.delete(key));
    return url.toString();
  }, []);

  const currentAdminPreviewMode = useMemo<RoleRoomAdminPreviewMode>(() => {
    if (!canSwitchRoleRoomRole) {
      return 'admin';
    }

    const normalizedRequestedRole = String(adminUser?.requestedRole || '').trim().toLowerCase();
    const normalizedLoginAs = String(adminUser?.loginAs || '').trim().toLowerCase();

    if (normalizedRequestedRole === 'client') {
      return 'client';
    }
    if (normalizedLoginAs === 'content_producer') {
      return 'content_producer';
    }
    if (normalizedLoginAs === 'production_team') {
      return 'production_team';
    }
    return 'admin';
  }, [adminUser?.loginAs, adminUser?.requestedRole, canSwitchRoleRoomRole]);

  const currentClientPortalPreviewUrl = useMemo(
    () => {
      if (!currentProject?.id) {
        return '';
      }
      const navigation = getClientVisibleProducerWorkspaceNavigation(currentProject.producerPlanning?.workspaceNavigation);
      const firstVisibleSection = navigation.sections[0];
      const firstVisiblePage = firstVisibleSection ? flattenProducerWorkspacePages(firstVisibleSection)[0] : null;
      if (!firstVisiblePage) {
        return '';
      }
      return buildClientPortalUrl(currentProject.id, {
        tab: 'media',
        workspace: firstVisiblePage.surface,
        sectionId: firstVisibleSection?.id,
        pageId: firstVisiblePage.id,
      });
    },
    [currentProject?.id, currentProject?.producerPlanning?.workspaceNavigation],
  );

  const handleSelectAdminPreviewMode = useCallback(async (mode: RoleRoomAdminPreviewMode) => {
    if (!canSwitchRoleRoomRole) {
      toast.showError('Bare admin kan bytte visningsmodus.');
      return;
    }

    const nextContext =
      mode === 'client'
        ? {
            loginAs: 'content_producer',
            requestedRole: 'client',
            selectedProfession: 'client',
          }
        : mode === 'content_producer'
          ? {
              loginAs: 'content_producer',
              requestedRole: 'content_producer',
              selectedProfession: 'content_producer',
            }
          : mode === 'production_team'
            ? {
                loginAs: 'production_team',
                requestedRole: 'producer',
                selectedProfession: 'producer',
              }
            : {
                loginAs: null,
                requestedRole: null,
                selectedProfession: profession ?? null,
              };

    setBillingActionPending(true);
    try {
      await authSessionService.updateRoleContext(nextContext);
      await syncScopedRoleRoomSession();

      if (mode !== 'client' && clientPortalIntent) {
        const returnUrl = clearClientPortalIntentUrl();
        if (returnUrl && typeof window !== 'undefined') {
          window.location.assign(returnUrl);
          return;
        }
      }

      const modeLabel = ROLE_ROOM_PREVIEW_MODE_LABELS[mode];

      if (mode === currentAdminPreviewMode) {
        toast.showSuccess(`${modeLabel} er allerede aktivt.`);
        return;
      }

      toast.showSuccess(`${modeLabel} er aktivert for denne adminøkten.`);
    } catch (error) {
      console.error('Failed to switch Role Room preview mode:', error);
      toast.showError('Kunne ikke bytte visningsmodus.');
    } finally {
      setBillingActionPending(false);
    }
  }, [
    canSwitchRoleRoomRole,
    clearClientPortalIntentUrl,
    clientPortalIntent,
    currentAdminPreviewMode,
    profession,
    syncScopedRoleRoomSession,
    toast,
  ]);

  const handleOpenClientPortalPreview = useCallback(async () => {
    if (!canSwitchRoleRoomRole) {
      return;
    }

    if (!currentProject?.id || !currentClientPortalPreviewUrl) {
      toast.showError('Velg et prosjekt før du åpner klientportalen.');
      return;
    }

    if (currentAdminPreviewMode !== 'client') {
      await handleSelectAdminPreviewMode('client');
    }

    if (typeof window !== 'undefined') {
      window.location.assign(currentClientPortalPreviewUrl);
    }
  }, [
    canSwitchRoleRoomRole,
    currentAdminPreviewMode,
    currentClientPortalPreviewUrl,
    currentProject?.id,
    handleSelectAdminPreviewMode,
    toast,
  ]);

  // Handle role/persona switching from the header dialog.
  const handleProfessionSelect = useCallback(async ({ categoryId, roleId }: CastingProfessionSelection) => {
    if (!canSwitchRoleRoomRole) {
      setProfessionDialogOpen(false);
      toast.showError('Bare admin kan bytte rolle i The Role Room.');
      return;
    }

    const normalizedRoleId = roleId.trim().toLowerCase();
    const isPhotoRole = ['film_photographer', 'photographer', 'photo_director', 'photo_assistant'].includes(normalizedRoleId);
    const internalProf =
      categoryId === 'foto'
        ? 'photographer'
        : categoryId === 'video'
          ? 'videographer'
          : null;

    const nextRole =
      normalizedRoleId === 'camera_operator'
        ? 'camera_team'
        : normalizedRoleId === 'client'
          ? 'client_reviewer'
          : normalizedRoleId === 'agent'
            ? 'agency'
            : normalizedRoleId === 'talent'
              ? 'reader'
              : isPhotoRole
                ? 'content_producer'
                : normalizedRoleId;

    const nextLoginAs =
      normalizedRoleId === 'owner' || normalizedRoleId === 'admin'
        ? undefined
        : (isPhotoRole || normalizedRoleId === 'client')
          ? 'content_producer'
          : 'production_team';

    setProfession(internalProf);
    setProfessionDialogOpen(false);

    await authSessionService.updateRoleContext({
      role: nextRole,
      loginAs: nextLoginAs,
      requestedRole: normalizedRoleId,
      selectedProfession: normalizedRoleId,
    });

    if (internalProf) {
      await saveProfession(internalProf);
    }

    await syncScopedRoleRoomSession();
  }, [canSwitchRoleRoomRole, saveProfession, syncScopedRoleRoomSession, toast]);

  // Authentication guard - redirect to landing page if not logged in
  useEffect(() => {
    authSessionService.loadSession().then(session => {
      setAdminUser(normalizeAdminUser(session.adminUser));
      setAuthLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const clearGoogleIntentFromUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('rrGoogleStatus');
      url.searchParams.delete('rrGoogleTransfer');
      url.searchParams.delete('rrGoogleMode');
      url.searchParams.delete('rrGoogleMessage');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    };

    if (roleRoomGoogleIntent.status === 'error') {
      toast.showError(roleRoomGoogleIntent.message || 'Google Workspace-innlogging feilet');
      clearGoogleIntentFromUrl();
      return;
    }

    if (!authLoaded || roleRoomGoogleIntent.status !== 'success' || !roleRoomGoogleIntent.transferId || !roleRoomGoogleIntent.mode) {
      return;
    }

    const transferKey = `${roleRoomGoogleIntent.mode}:${roleRoomGoogleIntent.transferId}`;
    if (handledGoogleTransferRef.current === transferKey) {
      return;
    }
    handledGoogleTransferRef.current = transferKey;

    let cancelled = false;
    void (async () => {
      try {
        const transfer = await googleWorkspaceApi.getOauthSessionResult(roleRoomGoogleIntent.transferId!);

        if (cancelled) {
          return;
        }

        if (transfer.mode === 'login') {
          if (transfer.user && transfer.sessionToken) {
            await authSessionService.applyRoleRoomLogin(
              {
                id: transfer.user.id,
                email: transfer.user.email,
                role: transfer.user.role,
                display_name: transfer.user.display_name,
                name: transfer.user.name,
                loginAs: transfer.user.loginAs,
                requestedRole: transfer.user.requestedRole ?? null,
              },
              transfer.sessionToken,
            );
            setAdminUser(normalizeAdminUser(transfer.user));
            setLoginDialogOpen(false);
            toast.showSuccess(
              transfer.autoConfiguredProjectBinding
                ? 'Kontoen er oppdatert, og prosjektet er klargjort.'
                : 'Kontoen er oppdatert.',
            );
          } else {
            toast.showError('Google-innlogging manglet Role Room-sesjon');
          }
          clearGoogleIntentFromUrl();
          return;
        }

        if (!adminUser) {
        toast.showError('Du må være innlogget i Role Room før kontoprofilen kan oppdateres');
          clearGoogleIntentFromUrl();
          return;
        }

        const linkedStatus = await googleWorkspaceApi.completeLink(roleRoomGoogleIntent.transferId!);
        const linkedProjectReady = Boolean(
          linkedStatus.projectBinding?.driveRootFolderId && linkedStatus.projectBinding?.calendarId,
        );
        toast.showSuccess(
          linkedProjectReady
            ? 'Kontoprofilen er oppdatert, og prosjektet er klargjort.'
            : 'Kontoprofilen er oppdatert.',
        );
        clearGoogleIntentFromUrl();
      } catch (googleError) {
        if (cancelled) {
          return;
        }
        toast.showError(googleError instanceof Error ? googleError.message : 'Kunne ikke fullføre Google Workspace-flyten');
        clearGoogleIntentFromUrl();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    adminUser,
    authLoaded,
    roleRoomGoogleIntent.message,
    roleRoomGoogleIntent.mode,
    roleRoomGoogleIntent.status,
    roleRoomGoogleIntent.transferId,
    toast,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const clearLinkedInIntentFromUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('rrLinkedInStatus');
      url.searchParams.delete('rrLinkedInTransfer');
      url.searchParams.delete('rrLinkedInMode');
      url.searchParams.delete('rrLinkedInMessage');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    };

    if (roleRoomLinkedInIntent.status === 'error') {
      toast.showError(roleRoomLinkedInIntent.message || 'LinkedIn-kobling feilet');
      clearLinkedInIntentFromUrl();
      return;
    }

    if (!authLoaded || roleRoomLinkedInIntent.status !== 'success' || !roleRoomLinkedInIntent.transferId || !roleRoomLinkedInIntent.mode) {
      return;
    }

    const transferKey = `${roleRoomLinkedInIntent.mode}:${roleRoomLinkedInIntent.transferId}`;
    if (handledLinkedInTransferRef.current === transferKey) {
      return;
    }
    handledLinkedInTransferRef.current = transferKey;

    let cancelled = false;
    void (async () => {
      try {
        const transfer = await linkedInWorkspaceApi.getOauthSessionResult(roleRoomLinkedInIntent.transferId!);

        if (cancelled) {
          return;
        }

        if (!adminUser) {
          toast.showError('Du må være innlogget i Role Room før du kan koble LinkedIn');
          clearLinkedInIntentFromUrl();
          return;
        }

        await linkedInWorkspaceApi.completeLink(roleRoomLinkedInIntent.transferId!);
        toast.showSuccess(`LinkedIn koblet til ${transfer.linkedIn.name ?? transfer.linkedIn.email ?? transfer.linkedIn.memberId}`);
        clearLinkedInIntentFromUrl();
      } catch (linkedInError) {
        if (cancelled) {
          return;
        }
        toast.showError(linkedInError instanceof Error ? linkedInError.message : 'Kunne ikke fullføre LinkedIn-flyten');
        clearLinkedInIntentFromUrl();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    adminUser,
    authLoaded,
    roleRoomLinkedInIntent.message,
    roleRoomLinkedInIntent.mode,
    roleRoomLinkedInIntent.status,
    roleRoomLinkedInIntent.transferId,
    toast,
  ]);

  useEffect(() => {
    const handleAuthSessionUpdated = () => {
      authSessionService.loadSession().then((session) => {
        setAdminUser(normalizeAdminUser(session.adminUser));
        setAuthLoaded(true);
      });
    };

    window.addEventListener('auth-session-updated', handleAuthSessionUpdated);
    return () => {
      window.removeEventListener('auth-session-updated', handleAuthSessionUpdated);
    };
  }, []);

  useEffect(() => {
    if (!authLoaded) return;
    if (!adminUser && isStandalone) {
      // Only redirect if this is the standalone casting page — prevents redirect loops
      window.location.href = getRoleRoomCanonicalPath(window.location);
    }
  }, [adminUser, authLoaded, isStandalone]);

  useEffect(() => {
    if (!authLoaded || adminUser) return;
    persistedWorkspaceStateRef.current = null;
    setCurrentProject(null);
    setProjects([]);
    setProjectSelectorOpen(false);
    setProjectCreationModalOpen(false);
    setProjectToEdit(null);
    setProjectCreationPrefill(null);
    setCurrentProjectId(null);
    setActiveTab(0);
  }, [adminUser, authLoaded]);

  const clearRoleRoomBillingParams = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('rrBilling');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const loadBillingAccount = useCallback(async () => {
    if (!adminUser || !isRoleRoomCommercialSession) {
      setBillingAccount(null);
      setBillingAccountError(null);
      return null;
    }

    setBillingAccountLoading(true);
    setBillingAccountError(null);
    try {
      const account = await roleRoomBillingApi.getAccount();
      setBillingAccount(account);
      return account;
    } catch (billingError) {
      const message = billingError instanceof Error
        ? billingError.message
        : 'Kunne ikke hente abonnementsinformasjon';
      setBillingAccountError(message);
      return null;
    } finally {
      setBillingAccountLoading(false);
    }
  }, [adminUser, isRoleRoomCommercialSession]);

  const handleOpenBillingAccountDialog = useCallback(() => {
    startTransition(() => setBillingAccountDialogOpen(true));
    void loadBillingAccount();
  }, [loadBillingAccount]);

  const handleOpenBillingPortal = useCallback(async () => {
    if (!billingAccount?.canManageBilling) {
      toast.showError('Kun teamleder kan oppdatere betalingsinformasjon.');
      return;
    }

    setBillingActionPending(true);
    setBillingAccountError(null);
    try {
      const result = await roleRoomBillingApi.openBillingPortal({
        browserOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
        returnPath: typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : '/',
      });
      window.location.assign(result.url);
    } catch (billingError) {
      const message = billingError instanceof Error
        ? billingError.message
        : 'Kunne ikke åpne betalingsportalen';
      setBillingAccountError(message);
      toast.showError(message);
    } finally {
      setBillingActionPending(false);
    }
  }, [billingAccount?.canManageBilling, toast]);

  const handleRetryBillingPayment = useCallback(async () => {
    if (!adminUser) {
      return;
    }

    setBillingActionPending(true);
    setBillingAccountError(null);
    try {
      const result = await roleRoomBillingApi.retryPayment();
      if (result.paymentCompleted || result.alreadyPaid) {
        toast.showSuccess('Betalingen er registrert. Abonnementet er aktivt igjen.');
      } else {
        toast.showInfo('Stripe behandler fortsatt betalingen. Oppdater status om et øyeblikk.');
      }
      await loadBillingAccount();
    } catch (billingError) {
      const message = billingError instanceof Error
        ? billingError.message
        : 'Kunne ikke prøve betalingen på nytt';
      setBillingAccountError(message);
      toast.showError(message);
      await loadBillingAccount();
    } finally {
      setBillingActionPending(false);
    }
  }, [billingAccount?.canRetryPayment, loadBillingAccount, toast]);

  useEffect(() => {
    if (!adminUser || !isRoleRoomCommercialSession) {
      setBillingAccount(null);
      setBillingAccountError(null);
      return;
    }
    void loadBillingAccount();
  }, [adminUser, isRoleRoomCommercialSession, loadBillingAccount]);

  useEffect(() => {
    if (!adminUser || !isRoleRoomCommercialSession || typeof window === 'undefined') {
      return;
    }

    const params = new URL(window.location.href).searchParams;
    if (params.get('rrBilling') !== 'updated') {
      return;
    }

    clearRoleRoomBillingParams();
    setBillingAccountDialogOpen(true);
    void (async () => {
      const account = await loadBillingAccount();
      if (account?.canManageBilling) {
        await handleRetryBillingPayment();
      } else {
        toast.showInfo('Betalingsstatusen er oppdatert.');
      }
    })();
  }, [
    adminUser,
    clearRoleRoomBillingParams,
    handleRetryBillingPayment,
    isRoleRoomCommercialSession,
    loadBillingAccount,
    toast,
  ]);

  const defaultProfessionForSession = useMemo<'photographer' | 'videographer' | null>(() => {
    if (!adminUser) return null;
    if (isProducerWorkspaceSession) return 'videographer';

    const requestedRole = (adminUser.requestedRole || '').trim().toLowerCase();
    if (['film_photographer', 'director', 'producer', 'casting_director', 'camera_team', 'camera_operator'].includes(requestedRole)) {
      return 'videographer';
    }
    if (['photographer', 'photo_director', 'photo_assistant', 'client'].includes(requestedRole)) {
      return 'photographer';
    }
    return null;
  }, [adminUser, isProducerWorkspaceSession]);

  // Load profession on mount
  useEffect(() => {
    // Don't load profession if not authenticated
    if (!adminUser) {
      return;
    }
    
    const initProfession = async () => {
      const loadedProfession = await loadProfession();
      if (loadedProfession) {
        setProfession(loadedProfession);
      } else {
        if (defaultProfessionForSession) {
          setProfession(defaultProfessionForSession);
          await saveProfession(defaultProfessionForSession);
          setProfessionDialogOpen(false);
          return;
        }
        if (canSwitchRoleRoomRole) {
          openProfessionDialog();
        } else {
          setProfessionDialogOpen(false);
        }
      }
    };
    initProfession();
  }, [adminUser, canSwitchRoleRoomRole, defaultProfessionForSession, loadProfession, openProfessionDialog, saveProfession]);

  useEffect(() => {
    if (!adminUser) return;

    // Use async function to handle async getProjects
    const initializeData = async () => {
      setProjectsLoading(true);
      try {
        const loadedProjectsRaw = await castingService.getProjects();
        setPublishedTemplates(loadedProjectsRaw.filter((project) => castingService.isTemplateProject(project)));
        const projects = filterProjectsForSession(loadedProjectsRaw);
        
        const shouldInitializeMock = !isProducerWorkspaceSession
          && (
            projects.length === 0
            || !projects.some((project) => isTrollProject(project))
          );
        
        if (shouldInitializeMock) {
          try {
            if (!isProducerWorkspaceSession) {
              await castingService.initializeMockData();

              // Also initialize offers, contracts and consents for complete demo
              try {
                await fetch('/api/casting/demo/troll/offers-contracts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({})
                });
                // Offers initialized successfully
              } catch (_e) {
                // Offers/contracts may already exist or API unavailable
              }
            }
            
            // Reload projects after mock data initialization
            const mockProjects = filterProjectsForSession(await castingService.getProjects());
            if (mockProjects.length > 0) {
              setProjects(mockProjects);
              const preferredProject = mockProjects.find((project) => isTrollProject(project)) ?? mockProjects[0];
              const fullProject = preferredProject
                ? await castingService.getProject(preferredProject.id)
                : null;
              setCurrentProject(fullProject ?? preferredProject ?? null);
            }
            loadAvailableScenes();
            loadUserRole();
          } catch (error) {
            console.error('❌ Failed to initialize TROLL project:', error);
          }
        } else {
          await loadProjects();
          loadAvailableScenes();
          loadUserRole();
        }
      } catch (error) {
        console.error('❌ Error initializing data:', error);
      } finally {
        setProjectsLoading(false);
      }
    };

    void initializeData();
  }, [
    adminUser,
    filterProjectsForSession,
    isContentProducerDemoProject,
    isProducerWorkspaceSession,
    isTrollProject,
  ]);

  const loadUserRole = useCallback(async () => {
    const activeProject = currentProjectRef.current;

    if (activeProject) {
      // Capture the project ID at the start of this async operation
      const projectIdForRequest = activeProject.id;
      currentProjectIdRef.current = projectIdForRequest;
      
      // Reset permissions and show loading state when switching projects
      setPermissionsLoading(true);
      setPermissions({
        canViewAll: false,
        canEditCasting: false,
        canEditProduction: false,
        canEditShotLists: false,
        canManageCrew: false,
        canManageLocations: false,
        canApprove: false,
        canComment: false,
        canRequestChanges: false,
        canViewEconomy: false,
      });

      // Guest bypass mode should have full tab access across the Role Room.
      if (isGuestMode) {
        const now = new Date().toISOString();
        setCurrentUserRole({
          id: `role-guest-${projectIdForRequest}`,
          userId: 'guest',
          projectId: projectIdForRequest,
          role: 'producer',
          permissions: {
            canViewAll: true,
            canEditCasting: true,
            canEditProduction: true,
            canEditShotLists: true,
            canManageCrew: true,
            canManageLocations: true,
            canApprove: true,
            canComment: true,
            canRequestChanges: true,
            canViewEconomy: true,
          },
          createdAt: now,
          updatedAt: now,
        });
        setPermissions({
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: true,
          canEditShotLists: true,
          canManageCrew: true,
          canManageLocations: true,
          canApprove: true,
          canComment: true,
          canRequestChanges: true,
          canViewEconomy: true,
        });
        setPermissionsLoading(false);
        return;
      }

      if (isProtectedDemoProject(activeProject) && !canMutateProtectedDemoData) {
        setCurrentUserRole(null);
        setPermissions({
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: true,
        });
        setPermissionsLoading(false);
        return;
      }

      const sessionUserId = authSessionService.getSessionSync().currentUserId;
      const isUnauthenticatedDemoSession = !adminUser && (!sessionUserId || sessionUserId === 'default' || sessionUserId === 'default-user');
        if (isUnauthenticatedDemoSession && isContentProducerDemoProject(activeProject)) {
          const seededProducerRole = (activeProject.userRoles ?? []).find((role) => role?.role === 'content_producer');
          if (seededProducerRole) {
            const normalizedUserId = String(seededProducerRole.userId ?? seededProducerRole.user_id ?? 'default-user');
            const mergedPermissions = {
              ...castingAuthService.getDefaultPermissions('content_producer'),
              ...(seededProducerRole.permissions ?? {}),
            };
            const normalizedRole: UserRole = {
              ...seededProducerRole,
              userId: normalizedUserId,
              projectId: projectIdForRequest,
              permissions: mergedPermissions,
              createdAt: seededProducerRole.createdAt || seededProducerRole.created_at || new Date().toISOString(),
              updatedAt: seededProducerRole.updatedAt || seededProducerRole.updated_at || new Date().toISOString(),
            };

            setCurrentUserRole(normalizedRole);
            setPermissions(buildPermissionStateFromRole(normalizedRole));
            void authSessionService.setCurrentUserId(normalizedUserId);
            setPermissionsLoading(false);
            return;
          }
        }
      
      try {
        const isScopedRoleRoomLogin = typeof adminUser?.loginAs === 'string'
          && adminUser.loginAs.trim().length > 0;

        // Preserve admin bypass only for non-scoped sessions. Explicit Role Room personas
        // such as content producer and client reviewer must respect their mapped project role.
        if (isRoleRoomAdminSession && adminUser && !isScopedRoleRoomLogin) {
          setCurrentUserRole({
            id: `role-${adminUser.id}-${projectIdForRequest}`,
            userId: String(adminUser.id),
            projectId: projectIdForRequest,
            role: normalizedAdminAccountRole === 'owner' || normalizedAdminAccountRole === 'super_admin' ? 'director' : 'producer',
            permissions: {
              canViewAll: true,
              canEditCasting: true,
              canEditProduction: true,
              canEditShotLists: true,
              canManageCrew: true,
              canManageLocations: true,
              canApprove: true,
              canComment: true,
              canRequestChanges: true,
              canViewEconomy: true,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setPermissions({
            canViewAll: true,
            canEditCasting: true,
            canEditProduction: true,
            canEditShotLists: true,
            canManageCrew: true,
            canManageLocations: true,
            canApprove: true,
            canComment: true,
            canRequestChanges: true,
            canViewEconomy: true,
          });
          setPermissionsLoading(false);
          return;
        }

        // Standalone login sets an account role, but project userRoles may still be empty.
        // Auto-provision a project role from the logged-in account role so permission checks work.
        const resolvedUserId = adminUser?.id !== undefined && adminUser?.id !== null
          ? String(adminUser.id)
          : getUserId();

        if (adminUser) {
          const mappedRole = mapAccountRoleToProjectRole(
            adminUser.role,
            adminUser.loginAs,
            adminUser.requestedRole,
          );
          if (mappedRole) {
            const userId = resolvedUserId;
            const userRoles = await castingService.getUserRoles(projectIdForRequest);
            const existingRole = userRoles.find((ur) => String(ur.userId ?? ur.user_id ?? '') === userId);

            const now = new Date().toISOString();
            const needsRoleUpdate = !existingRole || existingRole.role !== mappedRole;
            if (needsRoleUpdate) {
              await castingService.saveUserRole(projectIdForRequest, {
                id: existingRole?.id || `userrole-${userId}-${projectIdForRequest}`,
                userId,
                projectId: projectIdForRequest,
                role: mappedRole,
                permissions: castingAuthService.getDefaultPermissions(mappedRole),
                createdAt: existingRole?.createdAt || existingRole?.created_at || now,
                updatedAt: now,
              });
            }
          }
        }

        const role = await castingAuthService.getUserRole(projectIdForRequest, resolvedUserId);
        
        // Check if the project has changed while we were fetching - discard stale response
        if (currentProjectIdRef.current !== projectIdForRequest) {
          return;
        }
        
        const resolvedRole = role ?? (
          isRoleRoomAdminSession && adminUser
            ? {
                id: `role-admin-fallback-${resolvedUserId}-${projectIdForRequest}`,
                userId: resolvedUserId,
                projectId: projectIdForRequest,
                role: normalizedAdminAccountRole === 'owner' || normalizedAdminAccountRole === 'super_admin' ? 'director' : 'producer',
                permissions: {
                  canViewAll: true,
                  canEditCasting: true,
                  canEditProduction: true,
                  canEditShotLists: true,
                  canManageCrew: true,
                  canManageLocations: true,
                  canApprove: true,
                  canComment: true,
                  canRequestChanges: true,
                  canViewEconomy: true,
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : null
        );

        setCurrentUserRole(resolvedRole);
        setPermissions(buildPermissionStateFromRole(resolvedRole));
      } catch (error) {
        console.error('Error loading user role:', error);
        // Only update state if this is still the current project
        if (currentProjectIdRef.current === projectIdForRequest) {
          const mappedRole = adminUser
            ? mapAccountRoleToProjectRole(adminUser.role, adminUser.loginAs, adminUser.requestedRole)
            : null;
          if (mappedRole) {
            const now = new Date().toISOString();
            const fallbackPermissions = castingAuthService.getDefaultPermissions(mappedRole);
            setCurrentUserRole({
              id: `role-fallback-${mappedRole}-${projectIdForRequest}`,
              userId: adminUser?.id !== undefined && adminUser?.id !== null ? String(adminUser.id) : getUserId(),
              projectId: projectIdForRequest,
              role: mappedRole,
              permissions: fallbackPermissions,
              createdAt: now,
              updatedAt: now,
            });
            setPermissions(buildPermissionStateFromRole({
              id: `role-fallback-${mappedRole}-${projectIdForRequest}`,
              userId: adminUser?.id !== undefined && adminUser?.id !== null ? String(adminUser.id) : getUserId(),
              projectId: projectIdForRequest,
              role: mappedRole,
              permissions: fallbackPermissions,
              createdAt: now,
              updatedAt: now,
            }));
          } else {
            setCurrentUserRole(null);
            setPermissions({
              canViewAll: false,
              canEditCasting: false,
              canEditProduction: false,
              canEditShotLists: false,
              canManageCrew: false,
              canManageLocations: false,
              canApprove: false,
              canComment: false,
              canRequestChanges: false,
              canViewEconomy: false,
            });
          }
        }
      } finally {
        // Only clear loading state if this is still the current project
        if (currentProjectIdRef.current === projectIdForRequest) {
          setPermissionsLoading(false);
        }
      }
    } else {
      currentProjectIdRef.current = null;
      setCurrentUserRole(null);
      setPermissionsLoading(false);
      setPermissions({
        canViewAll: false,
        canEditCasting: false,
        canEditProduction: false,
        canEditShotLists: false,
        canManageCrew: false,
        canManageLocations: false,
        canApprove: false,
        canComment: false,
        canRequestChanges: false,
        canViewEconomy: false,
      });
    }
  }, [adminUser, buildPermissionStateFromRole, canMutateProtectedDemoData, getUserId, isGuestMode, isContentProducerDemoProject, isProtectedDemoProject, isRoleRoomAdminSession, normalizedAdminAccountRole]);

  const loadAvailableScenes = useCallback(() => {
    const sceneMap = new Map<string, { id: string; name: string; thumbnail?: string }>();
    const registerScene = (scene: { id?: string; name?: string; thumbnail?: string }) => {
      if (typeof scene.id !== 'string' || scene.id.trim().length === 0) {
        return;
      }
      if (sceneMap.has(scene.id)) {
        return;
      }
      sceneMap.set(scene.id, {
        id: scene.id,
        name:
          typeof scene.name === 'string' && scene.name.trim().length > 0
            ? scene.name
            : `${branding.tokens.labels.sceneFallbackPrefix} ${scene.id}`,
        thumbnail: typeof scene.thumbnail === 'string' && scene.thumbnail.trim().length > 0 ? scene.thumbnail : undefined,
      });
    };

    castingService.getAvailableScenes().forEach(registerScene);

    (currentProject?.sceneBreakdowns ?? []).forEach((scene) => {
      const sceneId = typeof scene.id === 'string' && scene.id.trim().length > 0
        ? scene.id
        : typeof scene.sceneNumber === 'number' || typeof scene.sceneNumber === 'string'
          ? `scene-${String(scene.sceneNumber).trim()}`
          : undefined;
      const sceneName =
        scene.sceneName ||
        scene.heading ||
        (typeof scene.sceneNumber === 'number' || typeof scene.sceneNumber === 'string'
          ? `${branding.tokens.labels.sceneFallbackPrefix} ${String(scene.sceneNumber).trim()}`
          : undefined);
      registerScene({
        id: sceneId,
        name: sceneName,
      });
    });

    (currentProject?.shotLists ?? []).forEach((shotList) => {
      registerScene({
        id: shotList.sceneId || shotList.scene_id,
        name: shotList.sceneName,
      });
    });

    setAvailableScenes(Array.from(sceneMap.values()));
  }, [branding.tokens.labels.sceneFallbackPrefix, currentProject]);

  // Re-run the scene registry when profession changes. Project-role loading is handled
  // by the dedicated currentProject effect below and should not double-fire here.
  useEffect(() => {
    if (profession && currentProject) {
      loadAvailableScenes();
    }
  }, [profession, currentProject, loadAvailableScenes]);

  useEffect(() => {
    if (currentProject?.id) {
      loadUserRole();
    }
  }, [currentProject?.id, adminUser, loadUserRole]);

  // Preload frequently used lazy modules to avoid sync-input suspense errors
  useEffect(() => {
    void import('./ConsentContractDialog');
    void import('./ProfessionOnboardingDialog');
    void import('./CastingSharingDialog');
    void import('./LoginDialog');
    void import('./AdminDashboard');
    void import('./CastingPlannerTutorial');
    void import('./TutorialEditorPanel');
    void import('./RoleManagementPanel');
    void import('./CandidateManagementPanel');
    void import('./KanbanPanel');
    void import('./production/CrewCalendarPanel');
    void import('./screenplay/StoryLogicPanel');
    void import('./ManuscriptPanel');
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadQuickContacts = async () => {
      const projectId = currentProject?.id;
      if (!projectId) {
        if (isMounted) {
          setQuickContactIds(new Set());
          setQuickContactsLoaded(true);
        }
        return;
      }
      setQuickContactsLoaded(false);
      const cachedQuickContacts = await settingsService.getSetting<string[]>('virtualStudio_candidateQuickContacts', { projectId });
      if (isMounted) {
        setQuickContactIds(new Set(cachedQuickContacts || []));
        setQuickContactsLoaded(true);
      }
    };
    void loadQuickContacts();
    return () => {
      isMounted = false;
    };
  }, [currentProject?.id]);

  useEffect(() => {
    if (!quickContactsLoaded || !currentProject?.id) return;
    void settingsService.setSetting('virtualStudio_candidateQuickContacts', [...quickContactIds], { projectId: currentProject.id });
  }, [quickContactIds, currentProject?.id, quickContactsLoaded]);

  useEffect(() => {
    let isMounted = true;
    const loadGlobalTagRegistry = async () => {
      try {
        const tags = await globalTagService.load();
        if (isMounted) {
          setGlobalTagRegistry(tags);
        }
      } catch (error) {
        console.warn('Kunne ikke laste global tag-register:', error);
        if (isMounted) {
          setGlobalTagRegistry([]);
        }
      } finally {
        if (isMounted) {
          setGlobalTagRegistryLoaded(true);
        }
      }
    };
    void loadGlobalTagRegistry();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentProject || quickContactIds.size === 0) return;
    const candidateIds = new Set(currentProject.candidates.map(candidate => candidate.id));
    const prunedIds = [...quickContactIds].filter((candidateId) => candidateIds.has(candidateId));
    if (prunedIds.length !== quickContactIds.size) {
      setQuickContactIds(new Set(prunedIds));
    }
  }, [currentProject, quickContactIds]);

  const loadProjects = useCallback(async () => {
    try {
      const rawProjects = await castingService.getProjects();
      setPublishedTemplates(rawProjects.filter((project) => castingService.isTemplateProject(project)));
      const loadedProjects = filterProjectsForSession(rawProjects);
      setProjects(loadedProjects);
      const persistedWorkspaceState = persistedWorkspaceStateRef.current ?? await loadPersistedWorkspaceState();
      if (persistedWorkspaceState) {
        persistedWorkspaceStateRef.current = persistedWorkspaceState;
      }

      const activeRestorableProjectId = isRestorableWorkspaceProject(currentProjectRef.current)
        ? currentProjectRef.current.id
        : null;
      
      // If we have a current project already selected, refresh its data
      // Otherwise, DON'T auto-select - let user choose from the project selector
      const persistedRealProjectId = persistedWorkspaceState?.lastRealProjectId ?? persistedWorkspaceState?.projectId ?? null;
      const projectIdToLoad = activeRestorableProjectId ?? persistedRealProjectId;
      
      if (loadedProjects.length > 0 && projectIdToLoad) {
        // Only refresh data if user already selected a project
        const targetProject = loadedProjects.find((project) => (
          project.id === projectIdToLoad
          && isRestorableWorkspaceProject(project)
        ));
        const resolvedTargetProject =
          targetProject && isProducerWorkspaceSession && isContentProducerDemoProject(targetProject)
            ? loadedProjects.find((project) => !isContentProducerDemoProject(project)) ?? null
            : targetProject && !isProducerWorkspaceSession && isContentProducerDemoProject(targetProject)
              ? loadedProjects.find((project) => !isContentProducerDemoProject(project)) ?? targetProject
            : targetProject;
        
        if (resolvedTargetProject) {
          // Fetch the full project with all nested data
          const fullProject = await castingService.getProject(resolvedTargetProject.id);
          if (fullProject) {
            setCurrentProject(fullProject);
          } else {
            setCurrentProject(resolvedTargetProject);
          }
        } else {
          // Current project is no longer visible in this session (e.g. content producer + TROLL),
          // switch to the best available project instead of keeping stale state.
          const preferredProject = loadedProjects.find((project) => isRestorableWorkspaceProject(project))
            ?? (isProducerWorkspaceSession ? null : loadedProjects[0]);
          setCurrentProject(preferredProject ?? null);
        }
      } else if (loadedProjects.length > 0 && !projectIdToLoad && isProducerWorkspaceSession) {
        const preferredProject = loadedProjects.find((project) => isRestorableWorkspaceProject(project)) ?? null;
        setCurrentProject(preferredProject);
      } else if (loadedProjects.length > 0 && !projectIdToLoad && !isProducerWorkspaceSession) {
        const preferredProject =
          loadedProjects.find((project) => isRestorableWorkspaceProject(project)) ??
          loadedProjects.find((project) => isTrollProject(project)) ??
          (loadedProjects.length === 1 ? loadedProjects[0] : null);
        if (preferredProject) {
          const fullProject = await castingService.getProject(preferredProject.id);
          setCurrentProject(fullProject ?? preferredProject);
        }
      } else if (loadedProjects.length === 0) {
        // Client portal view is read-only against a specific projectId
        // supplied via URL. Do NOT synthesize a fresh `project-${Date.now()}`
        // fallback here — otherwise every render generates a new id, each
        // child effect fetches /api/projects/<new-id>/files → 404 → state
        // updates → URL rewrite → re-mount → new id → Chrome throttles
        // navigation. The client-portal-intent effect handles the URL-
        // specified project separately; if that project truly isn't
        // reachable, showing `currentProject = null` is the correct state.
        if (clientPortalIntent) {
          setProjects([]);
          setCurrentProject(null);
        } else {
          // Only create empty project if mock data initialization didn't work
          const defaultProject: CastingProject = {
            id: `project-${Date.now()}`,
            name: profession ? `${branding.tokens.labels.newProjectPrefix} ${getTerm('project')}` : 'Nytt Role Room prosjekt',
            description: '',
            roles: [],
            candidates: [],
            schedules: [],
            crew: [],
            locations: [],
            props: [],
            productionDays: [],
            shotLists: [],
            userRoles: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await castingService.saveProject(defaultProject);
          setProjects([defaultProject]);
          setCurrentProject(defaultProject);
        }
      }
    } catch (error) {
      logRoleRoomDiagnostic('projects:load-failed', {
        source: 'casting-planner',
        message: error instanceof Error ? error.message : String(error),
      });
      // Fallback to sync version — wrap in try/catch to prevent double-throw
      try {
        const rawProjects = await castingService.getProjects();
        setPublishedTemplates(rawProjects.filter((project) => castingService.isTemplateProject(project)));
        const loadedProjects = filterProjectsForSession(rawProjects);
        setProjects(loadedProjects);
        if (loadedProjects.length > 0) {
          const persistedWorkspaceState = persistedWorkspaceStateRef.current ?? await loadPersistedWorkspaceState();
          if (persistedWorkspaceState) {
            persistedWorkspaceStateRef.current = persistedWorkspaceState;
          }
          const activeRestorableProjectId = isRestorableWorkspaceProject(currentProjectRef.current)
            ? currentProjectRef.current.id
            : null;
          // Maintain current project if possible, otherwise choose a role-aware fallback.
          const roleAwareFallback = isProducerWorkspaceSession
            ? loadedProjects.find((project) => isRestorableWorkspaceProject(project)) ?? null
            : loadedProjects.find((project) => isRestorableWorkspaceProject(project)) ?? loadedProjects[0];
          const persistedRealProjectId = persistedWorkspaceState?.lastRealProjectId ?? persistedWorkspaceState?.projectId ?? null;
          const activeProjectId = activeRestorableProjectId ?? persistedRealProjectId;
          const targetProject = activeProjectId
            ? loadedProjects.find((project) => (
              project.id === activeProjectId
              && isRestorableWorkspaceProject(project)
            )) || roleAwareFallback || loadedProjects[0]
            : roleAwareFallback || loadedProjects[0];
          const resolvedTargetProject =
            targetProject && isProducerWorkspaceSession && isContentProducerDemoProject(targetProject)
              ? loadedProjects.find((project) => !isContentProducerDemoProject(project)) ?? null
              : targetProject && !isProducerWorkspaceSession && isContentProducerDemoProject(targetProject)
                ? loadedProjects.find((project) => !isContentProducerDemoProject(project)) ?? targetProject
              : targetProject;
          setCurrentProject(resolvedTargetProject ?? null);
        } else {
          setCurrentProject(null);
        }
      } catch (fallbackError) {
        console.error('Fallback project load also failed:', fallbackError);
        setProjects([]);
        setCurrentProject(null);
      }
    }
  }, [
    filterProjectsForSession,
    isContentProducerDemoProject,
    isProducerWorkspaceSession,
    isRestorableWorkspaceProject,
    isTrollProject,
    loadPersistedWorkspaceState,
    profession,
  ]);

  const handleQuickContactsChange = useCallback((ids: string[]) => {
    startTransition(() => {
      setQuickContactIds(new Set(ids));
    });
  }, []);

  const handleCreateRole = useCallback(() => {
    if (!currentProject) {
      toast.showWarning(branding.tokens.labels.mustCreateProject);
      return;
    }
    const newRole: Role = {
      id: `role-${Date.now()}`,
      name: '',
      description: '',
      requirements: {},
      status: 'draft',
    };
    setSelectedRole(newRole);
    openRoleDialog();
  }, [currentProject, toast]);

  const toRichTextContent = useCallback((value: string) => {
    if (!value) return '';
    const hasHtmlTags = /<[^>]+>/.test(value);
    if (hasHtmlTags) return value;
    const escaped = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<p>${escaped.replace(/\n/g, '<br/>')}</p>`;
  }, []);

  const toPlainTextDescription = useCallback((value: string) => {
    if (!value) return '';
    const withLineBreaks = value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
      .replace(/<[^>]*>/g, '');
    if (typeof window === 'undefined') {
      return withLineBreaks.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    }
    const parserNode = document.createElement('textarea');
    parserNode.innerHTML = withLineBreaks;
    return parserNode.value.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }, []);

  const getCandidatePhotoFocalPoints = useCallback((candidate: Candidate | null): CandidatePhotoFocalPoint[] => {
    const photos = Array.isArray(candidate?.photos) ? candidate.photos : [];
    const rawFocalPoints = Array.isArray(candidate?.photoFocalPoints) ? candidate.photoFocalPoints : [];
    return photos.map((_, index) => {
      const point = rawFocalPoints[index];
      return {
        x: clampPercent(typeof point?.x === 'number' ? point.x : DEFAULT_CANDIDATE_FOCAL_POINT.x),
        y: clampPercent(typeof point?.y === 'number' ? point.y : DEFAULT_CANDIDATE_FOCAL_POINT.y),
      };
    });
  }, []);

  const setCandidatePhotoFocalPoint = useCallback((photoIndex: number, nextPoint: CandidatePhotoFocalPoint) => {
    setSelectedCandidate(prev => {
      if (!prev) return prev;
      const photos = Array.isArray(prev.photos) ? prev.photos : [];
      if (photoIndex < 0 || photoIndex >= photos.length) return prev;
      const nextFocalPoints = getCandidatePhotoFocalPoints(prev);
      nextFocalPoints[photoIndex] = {
        x: clampPercent(nextPoint.x),
        y: clampPercent(nextPoint.y),
      };
      return {
        ...prev,
        photoFocalPoints: nextFocalPoints,
      };
    });
  }, [getCandidatePhotoFocalPoints]);

  const handleCandidatePhotoFocalPointClick = useCallback((event: MouseEvent<HTMLButtonElement>, photoIndex: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setCandidatePhotoFocalPoint(photoIndex, { x, y });
  }, [setCandidatePhotoFocalPoint]);

  const handleDeleteCandidatePhoto = useCallback((photoIndex: number) => {
    setSelectedCandidate(prev => {
      if (!prev) return prev;
      const nextPhotos = Array.isArray(prev.photos) ? [...prev.photos] : [];
      if (photoIndex < 0 || photoIndex >= nextPhotos.length) return prev;
      nextPhotos.splice(photoIndex, 1);

      const nextFocalPoints = getCandidatePhotoFocalPoints(prev);
      nextFocalPoints.splice(photoIndex, 1);

      return {
        ...prev,
        photos: nextPhotos,
        photoFocalPoints: nextFocalPoints,
      };
    });
  }, [getCandidatePhotoFocalPoints]);

  const handleSetPrimaryCandidatePhoto = useCallback((photoIndex: number) => {
    setSelectedCandidate(prev => {
      if (!prev) return prev;
      const nextPhotos = Array.isArray(prev.photos) ? [...prev.photos] : [];
      if (photoIndex <= 0 || photoIndex >= nextPhotos.length) return prev;

      const [primaryPhoto] = nextPhotos.splice(photoIndex, 1);
      nextPhotos.unshift(primaryPhoto);

      const nextFocalPoints = getCandidatePhotoFocalPoints(prev);
      const [primaryFocalPoint] = nextFocalPoints.splice(photoIndex, 1);
      nextFocalPoints.unshift(primaryFocalPoint || { ...DEFAULT_CANDIDATE_FOCAL_POINT });

      return {
        ...prev,
        photos: nextPhotos,
        photoFocalPoints: nextFocalPoints,
      };
    });
  }, [getCandidatePhotoFocalPoints]);

  const handleSaveRole = useCallback(async () => {
    if (!currentProject || !selectedRole) return;
    
    if (!selectedRole.name.trim()) {
      toast.showWarning(branding.tokens.labels.roleNameRequired);
      return;
    }
    
    try {
      const roleToSave: Role = {
        ...selectedRole,
        description: toPlainTextDescription(selectedRole.description || ''),
      };
      await castingService.saveRole(currentProject.id, roleToSave);
      await loadProjects();
      setRoleDialogOpen(false);
      setSelectedRole(null);
    } catch (error) {
      console.error('Error saving role:', error);
      toast.showError(branding.tokens.labels.roleSaveError);
    }
  }, [currentProject, selectedRole, toast, loadProjects, toPlainTextDescription]);

  const handleDeleteRole = useCallback(async (roleId: string) => {
    if (!currentProject) return;
    const role = currentProject.roles.find(r => r.id === roleId);
    setConfirmDeleteContext({ type: 'role', id: roleId, name: role?.name || '' });
    setConfirmDeleteOpen(true);
  }, [currentProject]);

  const executeConfirmedDelete = useCallback(async () => {
    if (!currentProject || !confirmDeleteContext) return;
    const { type, id } = confirmDeleteContext;
    try {
      if (type === 'role') {
        await castingService.deleteRole(currentProject.id, id);
        toast.showSuccess(branding.tokens.labels.roleDeleteSuccess || 'Rolle slettet');
      } else if (type === 'candidate') {
        await castingService.deleteCandidate(currentProject.id, id);
      } else if (type === 'schedule') {
        await castingService.deleteSchedule(currentProject.id, id);
      } else if (type === 'project') {
        await castingService.deleteProject(id);
        if (currentProject?.id === id) {
          const remaining = filterProjectsForSession(await castingService.getProjects());
          setCurrentProject(remaining.length > 0 ? remaining[0] : null);
        }
      }
      // Optimistic update: refresh only the current project data instead of full loadProjects
      const updated = await castingService.getProject(currentProject.id);
      if (updated) {
        setCurrentProject(updated);
        // Also update the projects list
        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p).filter(p => type !== 'project' || p.id !== id));
      } else if (type === 'project') {
        setProjects(prev => prev.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      toast.showError(type === 'role' ? branding.tokens.labels.roleDeleteError 
        : type === 'candidate' ? branding.tokens.labels.candidateDeleteError
        : type === 'schedule' ? branding.tokens.labels.scheduleDeleteError
        : branding.tokens.labels.projectDeleteError);
    } finally {
      setConfirmDeleteOpen(false);
      setConfirmDeleteContext(null);
    }
  }, [currentProject, confirmDeleteContext, toast, branding.tokens.labels, filterProjectsForSession]);

  const handleCreateCandidate = useCallback(() => {
    if (!currentProject) {
      toast.showWarning(branding.tokens.labels.mustCreateProject);
      return;
    }
    const newCandidate: Candidate = {
      id: `candidate-${Date.now()}`,
      name: '',
      contactInfo: {},
      photos: [],
      photoFocalPoints: [],
      videos: [],
      auditionNotes: '',
      status: 'pending',
      assignedRoles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSelectedCandidate(newCandidate);
    openCandidateDialog();
  }, [currentProject, toast]);

  const handleCalendarRequestLocationCreate = useCallback(() => {
    if (!currentProject) return;
    setCalendarCreateIntent('location');
    setExternalLocationCreateSignal((current) => current + 1);
  }, [currentProject]);

  const handleCalendarRequestCandidateCreate = useCallback(() => {
    if (!currentProject) return;
    setCalendarCreateIntent('candidate');
    handleCreateCandidate();
  }, [currentProject, handleCreateCandidate]);

  const handleCalendarRequestCrewCreate = useCallback(() => {
    if (!currentProject) return;
    setCalendarCreateIntent('crew');
    setExternalCrewCreateSignal((current) => current + 1);
  }, [currentProject]);

  const handleCalendarRequestEquipmentCreate = useCallback(() => {
    if (!currentProject) return;
    setCalendarCreateIntent('equipment');
    setExternalEquipmentCreateSignal((current) => current + 1);
  }, [currentProject]);

  const returnToCalendarWithSelection = useCallback((selection: {
    locationId?: string;
    candidateId?: string;
    crewId?: string;
    equipmentId?: string;
  }) => {
    setCalendarPreselectedFromCreate(selection);
    setCalendarReopenSignal((current) => current + 1);
    startTransition(() => setActiveTab(CALENDAR_TAB_INDEX));
  }, []);

  const handleExternalLocationCreated = useCallback((location: { id: string }) => {
    if (calendarCreateIntent !== 'location') return;
    setCalendarCreateIntent(null);
    returnToCalendarWithSelection({ locationId: location.id });
  }, [calendarCreateIntent, returnToCalendarWithSelection]);

  const handleExternalLocationCreateCancelled = useCallback(() => {
    if (calendarCreateIntent !== 'location') return;
    setCalendarCreateIntent(null);
  }, [calendarCreateIntent]);

  const handleExternalCrewCreated = useCallback((crewMember: { id: string }) => {
    if (calendarCreateIntent !== 'crew') return;
    setCalendarCreateIntent(null);
    returnToCalendarWithSelection({ crewId: crewMember.id });
  }, [calendarCreateIntent, returnToCalendarWithSelection]);

  const handleExternalCrewCreateCancelled = useCallback(() => {
    if (calendarCreateIntent !== 'crew') return;
    setCalendarCreateIntent(null);
  }, [calendarCreateIntent]);

  const handleExternalEquipmentCreated = useCallback((equipmentItem: { id: string }) => {
    if (calendarCreateIntent !== 'equipment') return;
    setCalendarCreateIntent(null);
    returnToCalendarWithSelection({ equipmentId: equipmentItem.id });
  }, [calendarCreateIntent, returnToCalendarWithSelection]);

  const handleExternalEquipmentCreateCancelled = useCallback(() => {
    if (calendarCreateIntent !== 'equipment') return;
    setCalendarCreateIntent(null);
  }, [calendarCreateIntent]);

  const closeCandidateDialog = useCallback(() => {
    setCandidateDialogOpen(false);
    setSelectedCandidate(null);
    setSendConsentOnSave(false);
    if (calendarCreateIntent === 'candidate') {
      setCalendarCreateIntent(null);
    }
  }, [calendarCreateIntent]);

  const handleSaveCandidate = useCallback(async () => {
    if (!currentProject || !selectedCandidate) return;
    
    if (!selectedCandidate.name.trim()) {
      toast.showWarning(branding.tokens.labels.candidateNameRequired);
      return;
    }
    
    const isNewCandidate = !selectedCandidate.id || selectedCandidate.id.startsWith('candidate-');
    const createdFromCalendarEvent = calendarCreateIntent === 'candidate';
    const shouldSendConsent = isNewCandidate && sendConsentOnSave && !createdFromCalendarEvent;
    
    try {
      const nowIso = new Date().toISOString();
      const existingCandidate = currentProject.candidates.find((candidate) => candidate.id === selectedCandidate.id);
      const previousAuditionNotes = typeof existingCandidate?.auditionNotes === 'string' ? existingCandidate.auditionNotes : '';
      const nextAuditionNotes = typeof selectedCandidate.auditionNotes === 'string' ? selectedCandidate.auditionNotes : '';
      const auditionNotesChanged = nextAuditionNotes !== previousAuditionNotes;
      const candidateToSave: Candidate = {
        ...selectedCandidate,
      };

      if (auditionNotesChanged) {
        candidateToSave.auditionNotesAuthorName = adminUser?.display_name || adminUser?.email || 'Crew';
        if (adminUser?.id !== undefined && adminUser?.id !== null) {
          candidateToSave.auditionNotesAuthorId = String(adminUser.id);
        }
        candidateToSave.auditionNotesUpdatedAt = nowIso;
      }

      await castingService.saveCandidate(currentProject.id, candidateToSave);

      if (auditionNotesChanged) {
        const globalSeed = [
          selectedCandidate.name,
          adminUser?.display_name,
          adminUser?.email,
          ...globalTagService.parseExplicitMentions(nextAuditionNotes),
        ]
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter((value) => value.length >= 2);
        if (globalSeed.length > 0) {
          try {
            const updatedGlobalTags = await globalTagService.add(globalSeed);
            setGlobalTagRegistry(updatedGlobalTags);
          } catch (tagError) {
            console.warn('Kunne ikke persistere globale tags fra audition-notater:', tagError);
          }
        }
      }

      await loadProjects();
      const refreshedProject = await castingService.getProject(currentProject.id);
      const savedCandidate =
        refreshedProject?.candidates.find((candidate) => candidate.id === candidateToSave.id) ??
        refreshedProject?.candidates.find((candidate) => candidate.name === candidateToSave.name);

      if (createdFromCalendarEvent) {
        closeCandidateDialog();
        if (savedCandidate?.id) {
          returnToCalendarWithSelection({ candidateId: savedCandidate.id });
        } else if (candidateToSave.id) {
          returnToCalendarWithSelection({ candidateId: candidateToSave.id });
        } else {
          returnToCalendarWithSelection({});
        }
        return;
      }
      
      // If user wanted to send consent, open the consent dialog after save
      if (shouldSendConsent) {
        if (savedCandidate) {
          setSelectedCandidate(savedCandidate);
          setCandidateDialogOpen(false);
          setSendConsentOnSave(false);
          openConsentContractDialog();
        } else {
          closeCandidateDialog();
        }
      } else {
        closeCandidateDialog();
      }
    } catch (error) {
      console.error('Error saving candidate:', error);
      toast.showError(branding.tokens.labels.candidateSaveError);
    }
  }, [adminUser, calendarCreateIntent, closeCandidateDialog, currentProject, loadProjects, openConsentContractDialog, returnToCalendarWithSelection, selectedCandidate, sendConsentOnSave, toast, branding.tokens.labels.candidateSaveError, branding.tokens.labels.candidateNameRequired]);

  const handleDeleteCandidate = useCallback(async (candidateId: string) => {
    if (!currentProject) return;
    const candidate = currentProject.candidates.find(c => c.id === candidateId);
    setConfirmDeleteContext({ type: 'candidate', id: candidateId, name: candidate?.name || '' });
    setConfirmDeleteOpen(true);
  }, [currentProject]);

  const handleCreateSchedule = useCallback(() => {
    if (!currentProject) {
      toast.showWarning(branding.tokens.labels.mustCreateProject);
      return;
    }
    if (currentProject.candidates.length === 0 || currentProject.roles.length === 0) {
      toast.showWarning(branding.tokens.labels.needCandidateAndRole);
      return;
    }
    
    const newSchedule: Schedule = {
      id: `schedule-${Date.now()}`,
      candidateId: currentProject.candidates[0].id,
      roleId: currentProject.roles[0].id,
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      location: '',
      status: 'scheduled',
    };
    setSelectedSchedule(newSchedule);
    openScheduleDialog();
  }, [currentProject, toast]);

  const handleSaveSchedule = useCallback(async () => {
    if (!currentProject || !selectedSchedule) return;

    try {
      await castingService.saveSchedule(currentProject.id, selectedSchedule);
      await loadProjects();
      setScheduleDialogOpen(false);
      setSelectedSchedule(null);
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.showError(branding.tokens.labels.scheduleSaveError);
    }
  }, [currentProject, selectedSchedule, toast, loadProjects]);

  const handleDeleteSchedule = useCallback(async (scheduleId: string) => {
    if (!currentProject) return;
    setConfirmDeleteContext({ type: 'schedule', id: scheduleId, name: '' });
    setConfirmDeleteOpen(true);
  }, [currentProject]);

  // Use sanitized project data directly from currentProject instead of async service calls
  const roles = useMemo(
    () => (currentProject?.roles ?? []).filter((role): role is Role => (
      !!role
      && typeof role === 'object'
      && typeof role.id === 'string'
      && role.id.trim().length > 0
      && typeof role.name === 'string'
      && role.name.trim().length > 0
    )),
    [currentProject?.roles],
  );
  const allCandidates = useMemo(
    () => (currentProject?.candidates ?? []).filter((candidate): candidate is Candidate => (
      !!candidate
      && typeof candidate === 'object'
      && typeof candidate.id === 'string'
      && candidate.id.trim().length > 0
      && typeof candidate.name === 'string'
      && candidate.name.trim().length > 0
    )),
    [currentProject?.candidates],
  );
  const allSchedules = currentProject?.schedules || [];

  const globalTagSeedList = useMemo(() => {
    const deduped = new Set<string>();
    [
      ...allCandidates.map((candidate) => candidate.name),
      ...(currentProject?.crew ?? []).map((crewMember) => crewMember?.name),
      adminUser?.display_name,
      adminUser?.email,
    ]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)
      .forEach((value) => deduped.add(value));
    return Array.from(deduped);
  }, [adminUser?.display_name, adminUser?.email, allCandidates, currentProject?.crew]);

  const globalTagSeedKey = useMemo(
    () =>
      globalTagSeedList
        .map((value) => value.toLocaleLowerCase('no-NO'))
        .sort((left, right) => left.localeCompare(right, 'no-NO'))
        .join('|'),
    [globalTagSeedList],
  );

  useEffect(() => {
    if (!globalTagRegistryLoaded || globalTagSeedList.length === 0) return;
    void globalTagService
      .add(globalTagSeedList)
      .then((tags) => {
        setGlobalTagRegistry((previous) => {
          if (previous.length === tags.length && previous.every((value, index) => value === tags[index])) {
            return previous;
          }
          return tags;
        });
      })
      .catch((error) => {
        console.warn('Kunne ikke oppdatere global tag-register fra utvelgelse:', error);
      });
  }, [globalTagRegistryLoaded, globalTagSeedKey]);
  
  // Memoized filtered candidates (using debounced search for performance)
  const candidates = useMemo(() => allCandidates.filter(c => {
    const matchesStatus = candidateStatusFilter === 'all' || c.status === candidateStatusFilter;
    return matchesStatus;
  }), [allCandidates, candidateStatusFilter]);

  const quickContactCandidates = useMemo(() => {
    const explicitlyMarked = candidates.filter((candidate) => quickContactIds.has(candidate.id));
    if (explicitlyMarked.length > 0) return explicitlyMarked;
    return candidates.filter((candidate) => candidate.status === 'selected' || candidate.status === 'shortlist');
  }, [candidates, quickContactIds]);

  const quickContactVisibleCount = useMemo(() => {
    if (quickTier7) return 16;
    if (quickTier6) return 14;
    if (quickTier5) return 12;
    if (quickTier4) return 10;
    if (quickTier3) return 8;
    if (quickTier2) return 6;
    return 4;
  }, [quickTier2, quickTier3, quickTier4, quickTier5, quickTier6, quickTier7]);

  const quickContactGridColumns = useMemo(() => {
    if (quickTier7) return 'repeat(8, minmax(0, 1fr))';
    if (quickTier6) return 'repeat(7, minmax(0, 1fr))';
    if (quickTier5) return 'repeat(6, minmax(0, 1fr))';
    if (quickTier4) return 'repeat(5, minmax(0, 1fr))';
    if (quickTier3) return 'repeat(4, minmax(0, 1fr))';
    if (quickTier2) return 'repeat(3, minmax(0, 1fr))';
    return 'repeat(1, minmax(0, 1fr))';
  }, [quickTier2, quickTier3, quickTier4, quickTier5, quickTier6, quickTier7]);
  
  const schedules = allSchedules;

  const getCandidateAuditionRating = useCallback((candidate: Candidate): number | null => {
    const candidateRecord = candidate as unknown as Record<string, unknown>;
    const rawRating = candidateRecord.auditionRating ?? candidateRecord.rating ?? candidateRecord.score;
    if (typeof rawRating !== 'number' || !Number.isFinite(rawRating)) return null;
    const normalized = rawRating > 10 && rawRating <= 100 ? rawRating / 10 : rawRating;
    return Math.max(1, Math.min(10, Math.round(normalized)));
  }, []);

  const getCandidateAuditionNotes = useCallback((candidate: Candidate): string => {
    const candidateRecord = candidate as unknown as Record<string, unknown>;
    if (typeof candidateRecord.auditionNotes === 'string') return candidateRecord.auditionNotes;
    if (typeof candidate.notes === 'string') return candidate.notes;
    return '';
  }, []);

  const getCandidateContactInfo = useCallback((candidate?: Candidate | null): ContactInfo => {
    if (!candidate) {
      return {};
    }

    const directContact = candidate.contactInfo;
    const snakeCaseContact = candidate.contact_info;
    const candidateRecord = candidate as unknown as Record<string, unknown>;
    const directEmail = typeof directContact?.email === 'string' ? directContact.email : undefined;
    const snakeCaseEmail = typeof snakeCaseContact?.email === 'string' ? snakeCaseContact.email : undefined;
    const fallbackEmail = typeof candidateRecord.email === 'string' ? candidateRecord.email : undefined;
    const directPhone = typeof directContact?.phone === 'string' ? directContact.phone : undefined;
    const snakeCasePhone = typeof snakeCaseContact?.phone === 'string' ? snakeCaseContact.phone : undefined;
    const fallbackPhone = typeof candidateRecord.phone === 'string' ? candidateRecord.phone : undefined;
    const directAddress = typeof directContact?.address === 'string' ? directContact.address : undefined;
    const snakeCaseAddress = typeof snakeCaseContact?.address === 'string' ? snakeCaseContact.address : undefined;
    const fallbackAddress = typeof candidateRecord.address === 'string' ? candidateRecord.address : undefined;

    return {
      ...(directContact || {}),
      ...(snakeCaseContact || {}),
      email: directEmail ?? snakeCaseEmail ?? fallbackEmail,
      phone: directPhone ?? snakeCasePhone ?? fallbackPhone,
      address: directAddress ?? snakeCaseAddress ?? fallbackAddress,
    };
  }, []);

  const getCandidateAssignedRoles = useCallback((candidate?: Candidate | null): string[] => {
    if (!candidate) {
      return [];
    }

    if (Array.isArray(candidate.assignedRoles)) {
      return candidate.assignedRoles.filter((roleId): roleId is string => typeof roleId === 'string' && roleId.length > 0);
    }

    if (Array.isArray(candidate.assigned_roles)) {
      return candidate.assigned_roles.filter((roleId): roleId is string => typeof roleId === 'string' && roleId.length > 0);
    }

    const fallbackRoleId = typeof candidate.roleId === 'string'
      ? candidate.roleId
      : typeof candidate.role_id === 'string'
        ? candidate.role_id
        : undefined;

    return fallbackRoleId ? [fallbackRoleId] : [];
  }, []);

  const getCandidateDialogStatus = useCallback((candidate?: Candidate | null): Candidate['status'] => {
    const rawStatus = typeof candidate?.status === 'string' ? candidate.status.toLowerCase() : '';
    switch (rawStatus) {
      case 'requested':
      case 'shortlist':
      case 'selected':
      case 'confirmed':
      case 'rejected':
      case 'pending':
        return rawStatus;
      case 'available':
      default:
        return 'pending';
    }
  }, []);

  const getCandidateSelectionStage = useCallback((candidate: Candidate): SelectionStage => {
    const status = String(candidate.status || '').toLowerCase();
    if (['selected', 'confirmed', 'offer_sent', 'contracted', 'production'].includes(status)) return 'final';
    if (['awaiting_callback', 'callback', 'shortlist', 'requested'].includes(status)) return 'callbacks';
    return 'screening';
  }, []);
  const selectionWorkspaceActive = activeTab === SELECTION_TAB_INDEX;

  const auditionSchedulesByCandidate = useMemo(() => {
    if (!selectionWorkspaceActive) {
      return new Map<string, Schedule[]>();
    }
    const map = new Map<string, Schedule[]>();
    schedules.forEach((schedule) => {
      const scheduleType = String(schedule.type || '').toLowerCase();
      const scheduleTitle = String(schedule.title || '').toLowerCase();
      const scheduleStatus = String(schedule.status || '').toLowerCase();
      const isAuditionRelated =
        scheduleType.includes('audition')
        || scheduleType.includes('callback')
        || scheduleTitle.includes('audition')
        || scheduleTitle.includes('callback')
        || scheduleStatus.includes('callback')
        || scheduleStatus.includes('audition');

      if (!isAuditionRelated) return;
      const candidateId = schedule.candidateId || schedule.candidate_id;
      if (!candidateId) return;
      const existing = map.get(candidateId) || [];
      existing.push(schedule);
      map.set(candidateId, existing);
    });
    return map;
  }, [schedules, selectionWorkspaceActive]);

  const selectionCandidates = useMemo(() => {
    if (!selectionWorkspaceActive) {
      return [] as Candidate[];
    }
    const selectionStatuses = new Set([
      'auditioned',
      'awaiting_callback',
      'shortlist',
      'selected',
      'confirmed',
      'offer_sent',
      'contracted',
    ]);

    return candidates
      .filter((candidate) => {
        const status = String(candidate.status || '').toLowerCase();
        const hasAuditionNotes = getCandidateAuditionNotes(candidate).trim().length > 0;
        const hasAuditionSchedules = (auditionSchedulesByCandidate.get(candidate.id)?.length || 0) > 0;
        return hasAuditionNotes || hasAuditionSchedules || selectionStatuses.has(status);
      })
      .sort((a, b) => {
        const ratingA = getCandidateAuditionRating(a) ?? 0;
        const ratingB = getCandidateAuditionRating(b) ?? 0;
        if (ratingA !== ratingB) return ratingB - ratingA;
        return a.name.localeCompare(b.name, 'no');
      });
  }, [candidates, getCandidateAuditionNotes, auditionSchedulesByCandidate, getCandidateAuditionRating, selectionWorkspaceActive]);

  const selectionCandidatesFiltered = useMemo(() => {
    if (!selectionWorkspaceActive) return [] as Candidate[];
    if (selectionPhaseFilter === 'all') return selectionCandidates;
    return selectionCandidates.filter((candidate) => getCandidateSelectionStage(candidate) === selectionPhaseFilter);
  }, [selectionCandidates, selectionPhaseFilter, getCandidateSelectionStage, selectionWorkspaceActive]);

  const selectionMetrics = useMemo(
    () => {
      if (!selectionWorkspaceActive) {
        return { screening: 0, callbacks: 0, final: 0, total: 0 };
      }
      return {
        screening: selectionCandidates.filter((candidate) => getCandidateSelectionStage(candidate) === 'screening').length,
        callbacks: selectionCandidates.filter((candidate) => getCandidateSelectionStage(candidate) === 'callbacks').length,
        final: selectionCandidates.filter((candidate) => getCandidateSelectionStage(candidate) === 'final').length,
        total: selectionCandidates.length,
      };
    },
    [selectionCandidates, getCandidateSelectionStage, selectionWorkspaceActive],
  );

  const getCandidatePrimaryPhoto = useCallback((candidate: Candidate): string | null => {
    const candidateRecord = candidate as unknown as Record<string, unknown>;
    const photoArray = Array.isArray(candidate.photos)
      ? candidate.photos
      : Array.isArray(candidateRecord.photoUrls)
        ? (candidateRecord.photoUrls as unknown[])
        : [];
    const firstPhoto = photoArray.find((photo) => typeof photo === 'string' && photo.trim().length > 0);
    return typeof firstPhoto === 'string' ? firstPhoto : null;
  }, []);

  const getCandidateSelfTapes = useCallback((candidate: Candidate): string[] => {
    const candidateRecord = candidate as unknown as Record<string, unknown>;
    const sources: unknown[] = [];
    if (Array.isArray(candidate.videos)) sources.push(...candidate.videos);
    if (Array.isArray(candidateRecord.selfTapes)) sources.push(...(candidateRecord.selfTapes as unknown[]));
    if (typeof candidateRecord.selfTapeUrl === 'string') sources.push(candidateRecord.selfTapeUrl);
    if (typeof candidateRecord.showreel === 'string') sources.push(candidateRecord.showreel);
    if (typeof candidateRecord.demoReel === 'string') sources.push(candidateRecord.demoReel);

    const unique = new Set<string>();
    sources.forEach((value) => {
      if (typeof value === 'string' && value.trim().length > 0) unique.add(value);
    });
    return Array.from(unique);
  }, []);

  const getCandidateSelectionSignals = useCallback((candidate: Candidate) => {
    const rating = getCandidateAuditionRating(candidate);
    const notes = getCandidateAuditionNotes(candidate);
    const schedulesForCandidate = auditionSchedulesByCandidate.get(candidate.id) || [];
    const callbackCount = schedulesForCandidate.filter((schedule) => {
      const status = String(schedule.status || '').toLowerCase();
      const type = String(schedule.type || '').toLowerCase();
      return status.includes('callback') || type.includes('callback');
    }).length;
    const status = String(candidate.status || '').toLowerCase();
    const positiveMatches = (notes.match(/sterk|god|overbevisende|naturlig|fantastisk|karisma|kjemi/gi) || []).length;
    const negativeMatches = (notes.match(/stiv|svak|usikker|mangler|uklar|risiko|tempo/gi) || []).length;

    const scenePerformance = clampPercent((rating ?? 5.8) * 10 + callbackCount * 3 + positiveMatches * 2 - negativeMatches * 2);
    const chemistry = clampPercent(58 + positiveMatches * 10 - negativeMatches * 11 + callbackCount * 5);

    let availability = 72;
    if (status.includes('unavailable')) availability = 28;
    else if (status.includes('tentative')) availability = 52;
    else if (status.includes('selected') || status.includes('confirmed')) availability = 86;
    if (schedulesForCandidate.length > 0) availability = clampPercent(availability + 6);

    const riskBase = 45 + negativeMatches * 12 - positiveMatches * 7;
    const riskFromRating = rating === null ? 14 : rating <= 5 ? 18 : rating >= 8 ? -10 : 0;
    const risk = clampPercent(riskBase + riskFromRating + (status.includes('unavailable') ? 25 : 0));

    return {
      scenePerformance,
      chemistry,
      availability,
      risk,
    };
  }, [auditionSchedulesByCandidate, getCandidateAuditionNotes, getCandidateAuditionRating]);

  const getCandidateSelectionScore = useCallback((candidate: Candidate): number => {
    const signals = getCandidateSelectionSignals(candidate);
    const weightedScore = (
      signals.scenePerformance * SELECTION_SCORE_WEIGHTS.scenePerformance
      + signals.chemistry * SELECTION_SCORE_WEIGHTS.chemistry
      + signals.availability * SELECTION_SCORE_WEIGHTS.availability
      + (100 - signals.risk) * SELECTION_SCORE_WEIGHTS.risk
    ) / SELECTION_WEIGHT_TOTAL;
    return Math.round(clampPercent(weightedScore));
  }, [getCandidateSelectionSignals]);

  const getSelectionReadiness = useCallback((score: number) => {
    if (score >= 82) {
      return {
        label: 'Klar for finale',
        description: 'Sterk kandidat for endelig beslutning.',
        color: '#86efac',
        bgcolor: 'rgba(22,101,52,0.28)',
        border: '1px solid rgba(74,222,128,0.44)',
      };
    }
    if (score >= 66) {
      return {
        label: 'Klar for callback',
        description: 'Bør videre til neste runde.',
        color: '#c4b5fd',
        bgcolor: 'rgba(91,33,182,0.26)',
        border: '1px solid rgba(167,139,250,0.44)',
      };
    }
    return {
      label: 'Trenger mer screening',
      description: 'Samle mer vurderingsgrunnlag.',
      color: '#fcd34d',
      bgcolor: 'rgba(120,53,15,0.26)',
      border: '1px solid rgba(251,191,36,0.42)',
    };
  }, []);

  const selectionActorLabel = useMemo(
    () => adminUser?.display_name || adminUser?.email || 'Crew',
    [adminUser],
  );

  const selectionDecisionLogFromProject = useMemo(() => {
    const source = currentProject as Record<string, unknown> | null;
    return normalizeSelectionDecisionLog(
      source?.selectionDecisionLog
      ?? source?.selectionDecisionLogs
      ?? source?.selectionLog,
    );
  }, [currentProject]);

  const selectionDecisionLogSnapshot = useMemo(
    () => JSON.stringify(selectionDecisionLog.slice(0, MAX_SELECTION_DECISION_LOG_ENTRIES)),
    [selectionDecisionLog],
  );
  const selectionProjectLogSnapshot = useMemo(
    () => JSON.stringify(selectionDecisionLogFromProject),
    [selectionDecisionLogFromProject],
  );

  useEffect(() => {
    if (!selectionWorkspaceActive) return;
    if (!currentProject?.id) {
      setSelectionDecisionLog([]);
      return;
    }
    setSelectionDecisionLog(selectionDecisionLogFromProject);
  }, [currentProject?.id, selectionDecisionLogFromProject, selectionWorkspaceActive]);

  useEffect(() => {
    if (!selectionWorkspaceActive) return;
    if (!currentProject?.id) return;
    if (selectionDecisionLogSnapshot === selectionProjectLogSnapshot) return;
    if (typeof window === 'undefined') return;

    let cancelled = false;
    const timerId = window.setTimeout(async () => {
      try {
        const freshestProject = await castingService.getProject(currentProject.id);
        if (!freshestProject) return;

        const source = freshestProject as Record<string, unknown>;
        const freshestLog = normalizeSelectionDecisionLog(
          source.selectionDecisionLog
          ?? source.selectionDecisionLogs
          ?? source.selectionLog,
        );
        if (JSON.stringify(freshestLog) === selectionDecisionLogSnapshot) return;

        const nextLog = normalizeSelectionDecisionLog(JSON.parse(selectionDecisionLogSnapshot));
        const nextUpdatedAt = new Date().toISOString();
        const nextProject: CastingProject = {
          ...freshestProject,
          selectionDecisionLog: nextLog,
          updatedAt: nextUpdatedAt,
        };
        await castingService.saveProject(nextProject);
        if (cancelled) return;

        setProjects((previous) =>
          previous.map((project) =>
            project.id === nextProject.id
              ? {
                  ...project,
                  selectionDecisionLog: nextLog,
                  updatedAt: nextUpdatedAt,
                }
              : project,
          ),
        );
        setCurrentProject((previous) => {
          if (!previous || previous.id !== nextProject.id) return previous;
          return {
            ...previous,
            selectionDecisionLog: nextLog,
            updatedAt: nextUpdatedAt,
          };
        });
      } catch (error) {
        console.warn('Kunne ikke lagre utvelgelseslogg i database:', error);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [
    currentProject?.id,
    selectionDecisionLogSnapshot,
    selectionProjectLogSnapshot,
    selectionWorkspaceActive,
  ]);

  const appendSelectionDecisionLog = useCallback((candidate: Candidate, action: string) => {
    const entry: SelectionDecisionLogEntry = {
      id: `selection-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      candidateId: candidate.id,
      candidateName: candidate.name || 'Ukjent kandidat',
      action,
      actor: selectionActorLabel,
      createdAt: new Date().toISOString(),
    };
    setSelectionDecisionLog((prev) => [entry, ...prev].slice(0, MAX_SELECTION_DECISION_LOG_ENTRIES));
  }, [selectionActorLabel]);

  const selectionCompareCandidates = useMemo(
    () => {
      if (!selectionWorkspaceActive) return [] as Candidate[];
      return selectionCandidates.filter((candidate) => selectionCompareCandidateIds.includes(candidate.id)).slice(0, MAX_SELECTION_COMPARE);
    },
    [selectionCandidates, selectionCompareCandidateIds, selectionWorkspaceActive],
  );
  const selectionCandidateIdSignature = useMemo(
    () => (selectionWorkspaceActive ? selectionCandidates.map((candidate) => candidate.id).join('|') : ''),
    [selectionCandidates, selectionWorkspaceActive],
  );
  const selectionCandidateIdSet = useMemo(
    () => new Set(selectionCandidateIdSignature ? selectionCandidateIdSignature.split('|') : []),
    [selectionCandidateIdSignature],
  );

  const handleToggleSelectionCompare = useCallback((candidate: Candidate) => {
    const isCompared = selectionCompareCandidateIds.includes(candidate.id);
    if (isCompared) {
      setSelectionCompareCandidateIds((prev) => prev.filter((id) => id !== candidate.id));
      appendSelectionDecisionLog(candidate, 'Fjernet fra sammenligning');
      return;
    }
    if (selectionCompareCandidateIds.length >= MAX_SELECTION_COMPARE) {
      toast.showInfo(`Du kan sammenligne maks ${MAX_SELECTION_COMPARE} kandidater samtidig.`, 3200);
      return;
    }
    setSelectionCompareCandidateIds((prev) => [...prev, candidate.id]);
    appendSelectionDecisionLog(candidate, 'Lagt til i sammenligning');
  }, [appendSelectionDecisionLog, selectionCompareCandidateIds, toast]);

  const handleSetSelectionSelfTapeIndex = useCallback((candidateId: string, index: number) => {
    setSelectionSelfTapeIndexByCandidate((prev) => ({
      ...prev,
      [candidateId]: Math.max(0, index),
    }));
  }, []);

  useEffect(() => {
    if (!selectionWorkspaceActive) return;
    if (selectionCandidateIdSet.size === 0) {
      setSelectionCompareCandidateIds((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setSelectionCompareCandidateIds((prev) => {
      const filtered = prev.filter((id) => selectionCandidateIdSet.has(id));
      if (filtered.length === prev.length && filtered.every((id, idx) => id === prev[idx])) return prev;
      return filtered.slice(0, MAX_SELECTION_COMPARE);
    });
  }, [selectionCandidateIdSet, selectionCandidateIdSignature, selectionWorkspaceActive]);

  useEffect(() => {
    if (!selectionWorkspaceActive) return;
    if (selectionCandidatesFiltered.length === 0) {
      if (selectedSelectionCandidateId !== null) setSelectedSelectionCandidateId(null);
      return;
    }
    const stillExists = selectionCandidatesFiltered.some((candidate) => candidate.id === selectedSelectionCandidateId);
    if (!stillExists) {
      setSelectedSelectionCandidateId(selectionCandidatesFiltered[0].id);
    }
  }, [selectionCandidatesFiltered, selectedSelectionCandidateId, selectionWorkspaceActive]);

  const selectedSelectionCandidate = useMemo(
    () => selectionCandidatesFiltered.find((candidate) => candidate.id === selectedSelectionCandidateId) ?? null,
    [selectionCandidatesFiltered, selectedSelectionCandidateId],
  );

  const selectedSelectionCandidateIndex = useMemo(() => {
    if (!selectedSelectionCandidate) return -1;
    return selectionCandidatesFiltered.findIndex((candidate) => candidate.id === selectedSelectionCandidate.id);
  }, [selectedSelectionCandidate, selectionCandidatesFiltered]);

  const handleStepSelectionCandidate = useCallback((direction: 1 | -1) => {
    if (selectionCandidatesFiltered.length === 0) return;
    const currentIndex = selectedSelectionCandidateIndex >= 0 ? selectedSelectionCandidateIndex : 0;
    const nextIndex = (currentIndex + direction + selectionCandidatesFiltered.length) % selectionCandidatesFiltered.length;
    const nextCandidate = selectionCandidatesFiltered[nextIndex];
    if (!nextCandidate) return;
    startTransition(() => setSelectedSelectionCandidateId(nextCandidate.id));
  }, [selectedSelectionCandidateIndex, selectionCandidatesFiltered]);

  const selectedSelectionCandidateSchedules = useMemo(() => {
    if (!selectedSelectionCandidate) return [];
    return auditionSchedulesByCandidate.get(selectedSelectionCandidate.id) || [];
  }, [selectedSelectionCandidate, auditionSchedulesByCandidate]);

  const selectedSelectionSummary = useMemo(() => {
    if (!selectedSelectionCandidate) return null;

    const rating = getCandidateAuditionRating(selectedSelectionCandidate);
    const notes = getCandidateAuditionNotes(selectedSelectionCandidate);
    const phase = getCandidateSelectionStage(selectedSelectionCandidate);
    const assignedRoleIds = getCandidateAssignedRoles(selectedSelectionCandidate);
    const assignedRoleNames = assignedRoleIds
      .map((roleId) => roles.find((role) => role.id === roleId)?.name)
      .filter((value): value is string => Boolean(value));

    const strengths: string[] = [];
    const risks: string[] = [];

    if (rating !== null) {
      if (rating >= 8) strengths.push(`Sterk audition-score (${rating}/10)`);
      if (rating <= 5) risks.push(`Lav audition-score (${rating}/10)`);
    } else {
      risks.push('Ingen registrert audition-score');
    }

    if (notes.trim().length > 0) {
      if (/(sterk|god|overbevisende|karismatisk|naturlig|perfekt|fantastisk)/i.test(notes)) {
        strengths.push('Notater peker på sterk sceneleveranse');
      }
      if (/(stiv|usikker|svak|mangler|uklar|tempo|kjemi)/i.test(notes)) {
        risks.push('Notater peker på forbedringspunkter i audition');
      }
    } else {
      risks.push('Mangler detaljerte audition-notater');
    }

    if (assignedRoleNames.length > 0) {
      strengths.push(`Tilknyttet rolle: ${assignedRoleNames.join(', ')}`);
    } else {
      risks.push('Ingen rolle-tilknytning satt');
    }

    if (selectedSelectionCandidateSchedules.length > 0) {
      strengths.push(`${selectedSelectionCandidateSchedules.length} audition-/callback-økter registrert`);
    } else {
      risks.push('Ingen audition-økter registrert');
    }

    const recommendation =
      phase === 'final'
        ? 'Klar for endelig casting-beslutning.'
        : phase === 'callbacks'
          ? 'Aktiv callback-kandidat. Evaluer kjemi og tilgjengelighet før finalen.'
          : 'Fortsett screening og vurder callback ved neste gjennomgang.';

    return { rating, notes, phase, assignedRoleNames, strengths, risks, recommendation };
  }, [
    selectedSelectionCandidate,
    getCandidateAuditionRating,
    getCandidateAssignedRoles,
    getCandidateAuditionNotes,
    getCandidateSelectionStage,
    roles,
    selectedSelectionCandidateSchedules,
  ]);

  const selectedSelectionCandidateSelfTapes = useMemo(
    () => (selectedSelectionCandidate ? getCandidateSelfTapes(selectedSelectionCandidate) : []),
    [getCandidateSelfTapes, selectedSelectionCandidate],
  );

  const selectedCandidateContactInfo = useMemo(
    () => getCandidateContactInfo(selectedCandidate),
    [getCandidateContactInfo, selectedCandidate],
  );

  const selectedCandidateAssignedRoles = useMemo(
    () => getCandidateAssignedRoles(selectedCandidate),
    [getCandidateAssignedRoles, selectedCandidate],
  );

  const selectedCandidateDialogStatus = useMemo(
    () => getCandidateDialogStatus(selectedCandidate),
    [getCandidateDialogStatus, selectedCandidate],
  );

  const selectedSelectionCandidatePhoto = useMemo(
    () => (selectedSelectionCandidate ? getCandidatePrimaryPhoto(selectedSelectionCandidate) : null),
    [getCandidatePrimaryPhoto, selectedSelectionCandidate],
  );

  const selectedSelectionCandidateSelfTapeIndex = useMemo(() => {
    if (!selectedSelectionCandidate) return 0;
    const savedIndex = selectionSelfTapeIndexByCandidate[selectedSelectionCandidate.id] ?? 0;
    const maxIndex = Math.max(selectedSelectionCandidateSelfTapes.length - 1, 0);
    return Math.min(savedIndex, maxIndex);
  }, [selectedSelectionCandidate, selectedSelectionCandidateSelfTapes.length, selectionSelfTapeIndexByCandidate]);

  const selectedSelectionActiveSelfTape = useMemo(
    () => selectedSelectionCandidateSelfTapes[selectedSelectionCandidateSelfTapeIndex] ?? null,
    [selectedSelectionCandidateSelfTapeIndex, selectedSelectionCandidateSelfTapes],
  );

  const selectedSelectionSignals = useMemo(
    () => (selectedSelectionCandidate ? getCandidateSelectionSignals(selectedSelectionCandidate) : null),
    [getCandidateSelectionSignals, selectedSelectionCandidate],
  );

  const selectedSelectionScore = useMemo(
    () => (selectedSelectionCandidate ? getCandidateSelectionScore(selectedSelectionCandidate) : 0),
    [getCandidateSelectionScore, selectedSelectionCandidate],
  );

  const selectedSelectionReadiness = useMemo(
    () => getSelectionReadiness(selectedSelectionScore),
    [getSelectionReadiness, selectedSelectionScore],
  );

  const selectedSelectionDecisionLog = useMemo(() => {
    if (!selectedSelectionCandidate) return selectionDecisionLog.slice(0, 10);
    const scopedEntries = selectionDecisionLog.filter((entry) => entry.candidateId === selectedSelectionCandidate.id);
    if (scopedEntries.length > 0) return scopedEntries.slice(0, 10);
    return selectionDecisionLog.slice(0, 10);
  }, [selectedSelectionCandidate, selectionDecisionLog]);

  const canManageSelectionMeet = Boolean(
    currentProject
    && !isReadOnlyProtectedDemoView
    && (permissions.canEditProduction || canEditProducerWorkflow),
  );

  const selectedSelectionCandidateContactInfo = useMemo(
    () => getCandidateContactInfo(selectedSelectionCandidate),
    [getCandidateContactInfo, selectedSelectionCandidate],
  );

  const readSelectionScheduleDateTime = useCallback((schedule?: Schedule | null): Date | null => {
    if (!schedule) {
      return null;
    }

    const scheduleRecord = schedule as unknown as Record<string, unknown>;
    const directStartValue = [
      schedule.startTime,
      scheduleRecord.startTime,
      scheduleRecord.start_time,
      scheduleRecord.startDateTime,
      scheduleRecord.start_date_time,
      scheduleRecord.start,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;

    if (directStartValue) {
      const directDate = new Date(directStartValue);
      if (!Number.isNaN(directDate.getTime())) {
        return directDate;
      }
    }

    const dateValue = [
      schedule.date,
      scheduleRecord.date,
      scheduleRecord.startDate,
      scheduleRecord.start_date,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;

    if (!dateValue) {
      return null;
    }

    const timeValue = [
      schedule.startTime,
      scheduleRecord.startTime,
      scheduleRecord.start_time,
      scheduleRecord.time,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;

    const normalizedDate = dateValue.includes('T') ? dateValue.slice(0, 10) : dateValue;
    const normalizedTime = (timeValue && timeValue.includes(':') ? timeValue.slice(0, 5) : '10:00');
    const combined = new Date(`${normalizedDate}T${normalizedTime}:00`);
    return Number.isNaN(combined.getTime()) ? null : combined;
  }, []);

  const readSelectionScheduleEndDateTime = useCallback((schedule?: Schedule | null): Date | null => {
    if (!schedule) {
      return null;
    }

    const scheduleRecord = schedule as unknown as Record<string, unknown>;
    const directEndValue = [
      schedule.endTime,
      scheduleRecord.endTime,
      scheduleRecord.end_time,
      scheduleRecord.endDateTime,
      scheduleRecord.end_date_time,
      scheduleRecord.end,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;

    if (directEndValue) {
      const directDate = new Date(directEndValue);
      if (!Number.isNaN(directDate.getTime())) {
        return directDate;
      }
    }

    const startDate = readSelectionScheduleDateTime(schedule);
    if (!startDate) {
      return null;
    }

    const timeValue = [
      schedule.endTime,
      scheduleRecord.endTime,
      scheduleRecord.end_time,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;

    if (!timeValue) {
      return null;
    }

    const normalizedTime = timeValue.includes(':') ? timeValue.slice(0, 5) : '11:00';
    const combined = new Date(`${startDate.toISOString().slice(0, 10)}T${normalizedTime}:00`);
    return Number.isNaN(combined.getTime()) ? null : combined;
  }, [readSelectionScheduleDateTime]);

  const formatDraftDateValue = useCallback((value: Date): string => value.toISOString().slice(0, 10), []);
  const formatDraftTimeValue = useCallback(
    (value: Date): string => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
    [],
  );

  const selectedSelectionPrimarySchedule = useMemo(() => {
    return [...selectedSelectionCandidateSchedules]
      .sort((left, right) => {
        const leftDate = readSelectionScheduleDateTime(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightDate = readSelectionScheduleDateTime(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
      })[0] ?? null;
  }, [readSelectionScheduleDateTime, selectedSelectionCandidateSchedules]);

  const selectedSelectionMeetArtifact = useMemo(() => {
    if (!selectedSelectionCandidate) {
      return null;
    }
    return [...(selectionGoogleStatus?.artifacts ?? [])]
      .filter((artifact) => (
        artifact.localEntityType === 'selection_meeting'
        && artifact.localEntityId === selectedSelectionCandidate.id
      ))
      .sort((left, right) => {
        const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? '');
        const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? '');
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
      })[0] ?? null;
  }, [selectedSelectionCandidate, selectionGoogleStatus?.artifacts]);

  const selectionMeetConnectionState = useMemo<'loading' | 'connected' | 'disconnected' | 'expired' | 'error'>(() => {
    if (selectionGoogleStatusLoading) {
      return 'loading';
    }
    switch (selectionGoogleStatus?.state) {
      case 'connected':
        return 'connected';
      case 'expired':
        return 'expired';
      case 'error':
        return 'error';
      default:
        return 'disconnected';
    }
  }, [selectionGoogleStatus?.state, selectionGoogleStatusLoading]);

  const selectionMeetScheduleHint = useMemo(() => {
    if (!selectedSelectionPrimarySchedule) {
      return null;
    }
    const startValue = readSelectionScheduleDateTime(selectedSelectionPrimarySchedule);
    const typeLabel = typeof selectedSelectionPrimarySchedule.type === 'string'
      ? selectedSelectionPrimarySchedule.type
      : 'Audition';
    if (!startValue) {
      return typeLabel;
    }
    return `${typeLabel} · ${startValue.toLocaleString('no-NO', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }, [readSelectionScheduleDateTime, selectedSelectionPrimarySchedule]);

  const loadSelectionGoogleStatus = useCallback(async () => {
    if (!selectionWorkspaceActive || !currentProject?.id || !canManageSelectionMeet) {
      setSelectionGoogleStatus(null);
      setSelectionGoogleStatusLoading(false);
      return;
    }

    const requestId = ++selectionGoogleStatusRequestRef.current;
    setSelectionGoogleStatusLoading(true);
    try {
      const status = await googleWorkspaceApi.getStatus(currentProject.id);
      if (requestId !== selectionGoogleStatusRequestRef.current) {
        return;
      }
      setSelectionGoogleStatus(status);
    } catch (error) {
      if (requestId !== selectionGoogleStatusRequestRef.current) {
        return;
      }
      console.error('[CastingPlannerPanel] Failed to load selection Google status', error);
      setSelectionGoogleStatus(null);
    } finally {
      if (requestId === selectionGoogleStatusRequestRef.current) {
        setSelectionGoogleStatusLoading(false);
      }
    }
  }, [canManageSelectionMeet, currentProject?.id, selectionWorkspaceActive]);

  useEffect(() => {
    if (!selectionWorkspaceActive || !currentProject?.id || !canManageSelectionMeet) {
      selectionGoogleStatusRequestRef.current += 1;
      setSelectionGoogleStatus(null);
      setSelectionGoogleStatusLoading(false);
      return;
    }
    void loadSelectionGoogleStatus();
  }, [
    canManageSelectionMeet,
    currentProject?.id,
    loadSelectionGoogleStatus,
    roleRoomGoogleIntent.status,
    roleRoomGoogleIntent.transferId,
    selectionWorkspaceActive,
  ]);

  useEffect(() => {
    if (!selectedSelectionCandidate) {
      setSelectionMeetDraft(DEFAULT_SELECTION_MEET_DRAFT);
      return;
    }

    const primaryScheduleStart = readSelectionScheduleDateTime(selectedSelectionPrimarySchedule);
    const primaryScheduleEnd = readSelectionScheduleEndDateTime(selectedSelectionPrimarySchedule);
    const fallbackStart = new Date();
    fallbackStart.setHours(10, 0, 0, 0);
    if (fallbackStart.getTime() <= Date.now()) {
      fallbackStart.setDate(fallbackStart.getDate() + 1);
    }
    const resolvedStart = primaryScheduleStart ?? fallbackStart;
    const derivedDuration = primaryScheduleStart && primaryScheduleEnd
      ? Math.max(15, Math.round((primaryScheduleEnd.getTime() - primaryScheduleStart.getTime()) / 60000))
      : 45;
    const scheduleLocation = typeof selectedSelectionPrimarySchedule?.location === 'string'
      ? selectedSelectionPrimarySchedule.location.trim()
      : '';
    const scheduleType = typeof selectedSelectionPrimarySchedule?.type === 'string'
      ? selectedSelectionPrimarySchedule.type.trim()
      : '';

    setSelectionMeetDraft({
      title: `${scheduleType || 'Callback'} · ${selectedSelectionCandidate.name}`,
      date: formatDraftDateValue(resolvedStart),
      time: formatDraftTimeValue(resolvedStart),
      durationMinutes: derivedDuration,
      location: scheduleLocation ? `${scheduleLocation} / Google Meet` : 'Google Meet',
    });
  }, [
    formatDraftDateValue,
    formatDraftTimeValue,
    readSelectionScheduleDateTime,
    readSelectionScheduleEndDateTime,
    selectedSelectionCandidate,
    selectedSelectionPrimarySchedule,
  ]);

  const handleCreateSelectionMeet = useCallback(async () => {
    if (!currentProject?.id || !selectedSelectionCandidate) {
      return;
    }
    if (!selectionMeetDraft.date || !selectionMeetDraft.time) {
      toast.showError('Velg dato og klokkeslett før møtet planlegges.');
      return;
    }

    const startValue = new Date(`${selectionMeetDraft.date}T${selectionMeetDraft.time}:00`);
    if (Number.isNaN(startValue.getTime())) {
      toast.showError('Møtetidspunktet kunne ikke tolkes.');
      return;
    }

    const endValue = new Date(startValue.getTime() + Math.max(15, selectionMeetDraft.durationMinutes || 45) * 60_000);
    const descriptionParts = [
      `Planlagt fra utvelgelse i The Role Room for ${selectedSelectionCandidate.name}.`,
      selectedSelectionMeetArtifact?.meetUrl ? `Forrige Meet: ${selectedSelectionMeetArtifact.meetUrl}` : null,
      selectedSelectionCandidateContactInfo.email ? `Kandidat: ${selectedSelectionCandidateContactInfo.email}` : null,
      selectedSelectionSummary?.recommendation ? `Neste steg: ${selectedSelectionSummary.recommendation}` : null,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    setSelectionMeetBusy(true);
    try {
      const response = await googleWorkspaceApi.createMeetSession(currentProject.id, {
        entityType: 'selection_meeting',
        entityId: selectedSelectionCandidate.id,
        title: selectionMeetDraft.title.trim() || `Callback · ${selectedSelectionCandidate.name}`,
        description: descriptionParts.join('\n'),
        start: startValue.toISOString(),
        end: endValue.toISOString(),
        location: selectionMeetDraft.location.trim() || 'Google Meet',
        phase: 'selection',
        includeMeet: true,
        attendees: selectedSelectionCandidateContactInfo.email
          ? [{
              email: selectedSelectionCandidateContactInfo.email,
              displayName: selectedSelectionCandidate.name,
            }]
          : [],
      });

      await loadSelectionGoogleStatus();

      const meetUrl = typeof response.event?.meetUrl === 'string' ? response.event.meetUrl : '';
      toast.showSuccess(meetUrl ? 'Google Meet er planlagt fra utvelgelsen.' : 'Kalenderhendelsen er opprettet.');
      if (meetUrl) {
        window.open(meetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : 'Kunne ikke opprette Google Meet fra utvelgelsen.');
    } finally {
      setSelectionMeetBusy(false);
    }
  }, [
    currentProject?.id,
    loadSelectionGoogleStatus,
    selectedSelectionCandidate,
    selectedSelectionCandidateContactInfo.email,
    selectedSelectionMeetArtifact?.meetUrl,
    selectedSelectionSummary?.recommendation,
    selectionMeetDraft,
    toast,
  ]);

  const handleOpenSelectionMeet = useCallback(() => {
    if (!selectedSelectionMeetArtifact?.meetUrl) {
      return;
    }
    window.open(selectedSelectionMeetArtifact.meetUrl, '_blank', 'noopener,noreferrer');
  }, [selectedSelectionMeetArtifact?.meetUrl]);

  const handleCopySelectionMeet = useCallback(async () => {
    if (!selectedSelectionMeetArtifact?.meetUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedSelectionMeetArtifact.meetUrl);
      toast.showSuccess('Meet-lenken er kopiert.');
    } catch {
      toast.showError('Kunne ikke kopiere Meet-lenken.');
    }
  }, [selectedSelectionMeetArtifact?.meetUrl, toast]);

  const renderSelectionMeetPlannerCard = useCallback((compact = false) => {
    if (!selectedSelectionCandidate || !canManageSelectionMeet || selectionMeetConnectionState !== 'connected') {
      return null;
    }

    return (
      <SelectionMeetPlannerCard
        compact={compact}
        candidateName={selectedSelectionCandidate.name}
        candidateEmail={selectedSelectionCandidateContactInfo.email}
        scheduleHint={selectionMeetScheduleHint}
        connectionState={selectionMeetConnectionState}
        title={selectionMeetDraft.title}
        onTitleChange={(value) => setSelectionMeetDraft((previous) => ({ ...previous, title: value }))}
        date={selectionMeetDraft.date}
        onDateChange={(value) => setSelectionMeetDraft((previous) => ({ ...previous, date: value }))}
        time={selectionMeetDraft.time}
        onTimeChange={(value) => setSelectionMeetDraft((previous) => ({ ...previous, time: value }))}
        durationMinutes={selectionMeetDraft.durationMinutes}
        onDurationChange={(value) => setSelectionMeetDraft((previous) => ({ ...previous, durationMinutes: value }))}
        location={selectionMeetDraft.location}
        onLocationChange={(value) => setSelectionMeetDraft((previous) => ({ ...previous, location: value }))}
        latestMeetUrl={selectedSelectionMeetArtifact?.meetUrl ?? null}
        latestMeetUpdatedAt={selectedSelectionMeetArtifact?.updatedAt ?? selectedSelectionMeetArtifact?.createdAt ?? null}
        busy={selectionMeetBusy}
        onCreateMeet={() => {
          void handleCreateSelectionMeet();
        }}
        onOpenMeet={selectedSelectionMeetArtifact?.meetUrl ? handleOpenSelectionMeet : undefined}
        onCopyMeet={selectedSelectionMeetArtifact?.meetUrl ? () => {
          void handleCopySelectionMeet();
        } : undefined}
      />
    );
  }, [
    adminUser,
    canManageSelectionMeet,
    currentProject?.id,
    handleCopySelectionMeet,
    handleCreateSelectionMeet,
    handleOpenSelectionMeet,
    selectedSelectionCandidate,
    selectedSelectionCandidateContactInfo.email,
    selectedSelectionMeetArtifact?.createdAt,
    selectedSelectionMeetArtifact?.meetUrl,
    selectedSelectionMeetArtifact?.updatedAt,
    selectionMeetConnectionState,
    selectionMeetDraft,
    selectionMeetBusy,
    selectionMeetScheduleHint,
  ]);

  const formatOptionalNoteTimestamp = useCallback((value: unknown): string => {
    if (typeof value !== 'string' || value.trim().length === 0) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('no-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const selectedSelectionNotes = useMemo(() => {
    if (!selectedSelectionCandidate) return '';
    const candidateRecord = selectedSelectionCandidate as unknown as Record<string, unknown>;
    const rawSelectionNotes =
      candidateRecord.selectionNotes
      ?? candidateRecord.selectionNote
      ?? candidateRecord.selectionComment
      ?? '';
    return typeof rawSelectionNotes === 'string' ? rawSelectionNotes : '';
  }, [selectedSelectionCandidate]);

  const selectedSelectionTagExclusions = useMemo(() => {
    if (!selectedSelectionCandidate) return [] as string[];
    const candidateRecord = selectedSelectionCandidate as unknown as Record<string, unknown>;
    const rawExclusions =
      candidateRecord.selectionNotesTagExclusions
      ?? candidateRecord.selectionNoteTagExclusions
      ?? [];
    if (Array.isArray(rawExclusions)) {
      return rawExclusions
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    }
    if (typeof rawExclusions === 'string') {
      return rawExclusions
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    }
    return [] as string[];
  }, [selectedSelectionCandidate]);

  const normalizeSelectionNoteToken = useCallback((value: string) => {
    return value
      .toLocaleLowerCase('no-NO')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9æøå\s-]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const normalizeSelectionTagKey = useCallback((values: string[]) => {
    return values
      .map((value) => normalizeSelectionNoteToken(value))
      .filter((value) => value.length > 0)
      .sort((a, b) => a.localeCompare(b, 'no-NO'))
      .join('|');
  }, [normalizeSelectionNoteToken]);

  const selectionMentionCandidates = useMemo(() => {
    if (!selectionWorkspaceActive) return [] as string[];
    const deduped = new Set<string>();
    for (const candidate of allCandidates) {
      if (candidate.name && candidate.name.trim().length > 0) {
        deduped.add(candidate.name.trim());
      }
    }
    for (const crewMember of currentProject?.crew ?? []) {
      if (typeof crewMember.name === 'string' && crewMember.name.trim().length > 0) {
        deduped.add(crewMember.name.trim());
      }
    }
    if (adminUser?.display_name && adminUser.display_name.trim().length > 0) {
      deduped.add(adminUser.display_name.trim());
    }
    for (const globalTag of globalTagRegistry) {
      if (typeof globalTag === 'string' && globalTag.trim().length > 0) {
        deduped.add(globalTag.trim());
      }
    }
    return Array.from(deduped).sort((left, right) => left.localeCompare(right, 'no-NO'));
  }, [adminUser?.display_name, allCandidates, currentProject?.crew, globalTagRegistry, selectionWorkspaceActive]);

  const escapeSelectionRegex = useCallback((value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), []);

  const doesSelectionNoteContainName = useCallback((noteText: string, name: string) => {
    if (!noteText.trim() || !name.trim()) return false;
    const escapedName = escapeSelectionRegex(name.trim());
    const boundaryPattern = new RegExp(`(^|[^A-Za-z0-9ÆØÅæøå])${escapedName}([^A-Za-z0-9ÆØÅæøå]|$)`, 'i');
    return boundaryPattern.test(noteText);
  }, [escapeSelectionRegex]);

  const selectionNotesDraftPlain = useMemo(
    () => toPlainTextDescription(selectionNotesDraft),
    [selectionNotesDraft, toPlainTextDescription],
  );

  const selectionTrailingToken = useMemo(() => {
    if (!selectionWorkspaceActive) return '';
    const match = selectionNotesDraftPlain.match(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u);
    return match?.[1] ?? '';
  }, [selectionNotesDraftPlain, selectionWorkspaceActive]);

  const levenshteinDistance = useCallback((left: string, right: string): number => {
    if (left === right) return 0;
    if (left.length === 0) return right.length;
    if (right.length === 0) return left.length;
    let previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 0; i < left.length; i += 1) {
      const currentRow = [i + 1];
      for (let j = 0; j < right.length; j += 1) {
        const insertCost = currentRow[j] + 1;
        const deleteCost = previousRow[j + 1] + 1;
        const replaceCost = previousRow[j] + (left[i] === right[j] ? 0 : 1);
        currentRow.push(Math.min(insertCost, deleteCost, replaceCost));
      }
      previousRow = currentRow;
    }
    return previousRow[right.length];
  }, []);

  const selectionDidYouMeanSuggestions = useMemo(() => {
    if (!selectionWorkspaceActive) return [] as string[];
    const normalizedToken = normalizeSelectionNoteToken(selectionTrailingToken);
    if (normalizedToken.length < 2) return [] as string[];
    const rankedMatches = selectionMentionCandidates
      .map((fullName) => {
        const nameTokens = fullName
          .split(/\s+/)
          .map((token) => normalizeSelectionNoteToken(token))
          .filter((token) => token.length >= 2);
        if (nameTokens.length === 0) return null;
        if (nameTokens.some((token) => token === normalizedToken)) return null;
        let bestDistance = Number.POSITIVE_INFINITY;
        let hasPrefixMatch = false;
        for (const token of nameTokens) {
          hasPrefixMatch ||= token.startsWith(normalizedToken);
          const distance = levenshteinDistance(normalizedToken, token);
          if (distance < bestDistance) {
            bestDistance = distance;
          }
        }
        if (!Number.isFinite(bestDistance)) return null;
        if (!hasPrefixMatch && bestDistance > 2) return null;
        if (doesSelectionNoteContainName(selectionNotesDraftPlain, fullName)) return null;
        return { fullName, hasPrefixMatch, bestDistance };
      })
      .filter((value): value is { fullName: string; hasPrefixMatch: boolean; bestDistance: number } => value !== null)
      .sort((left, right) => {
        if (left.hasPrefixMatch !== right.hasPrefixMatch) {
          return left.hasPrefixMatch ? -1 : 1;
        }
        if (left.bestDistance !== right.bestDistance) {
          return left.bestDistance - right.bestDistance;
        }
        return left.fullName.localeCompare(right.fullName, 'no-NO');
      });

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const match of rankedMatches) {
      const normalizedName = normalizeSelectionNoteToken(match.fullName);
      if (seen.has(normalizedName)) continue;
      seen.add(normalizedName);
      deduped.push(match.fullName);
      if (deduped.length >= 4) break;
    }
    return deduped;
  }, [
    doesSelectionNoteContainName,
    levenshteinDistance,
    normalizeSelectionNoteToken,
    selectionMentionCandidates,
    selectionNotesDraftPlain,
    selectionTrailingToken,
    selectionWorkspaceActive,
  ]);

  const selectionAutoTagChips = useMemo(() => {
    if (!selectionWorkspaceActive) return [] as string[];
    if (!selectionNotesDraftPlain.trim()) return [] as string[];
    const excluded = new Set(selectionNotesTagExclusions.map((value) => normalizeSelectionNoteToken(value)));
    return selectionMentionCandidates.filter((name) => {
      const normalizedName = normalizeSelectionNoteToken(name);
      if (!normalizedName || excluded.has(normalizedName)) return false;
      return doesSelectionNoteContainName(selectionNotesDraftPlain, name);
    });
  }, [
    doesSelectionNoteContainName,
    normalizeSelectionNoteToken,
    selectionMentionCandidates,
    selectionNotesDraftPlain,
    selectionNotesTagExclusions,
    selectionWorkspaceActive,
  ]);

  const selectedSelectionTagExclusionsKey = useMemo(
    () => normalizeSelectionTagKey(selectedSelectionTagExclusions),
    [normalizeSelectionTagKey, selectedSelectionTagExclusions],
  );

  const selectionNotesTagExclusionsKey = useMemo(
    () => normalizeSelectionTagKey(selectionNotesTagExclusions),
    [normalizeSelectionTagKey, selectionNotesTagExclusions],
  );

  const selectionNotesHasChanges = useMemo(() => {
    return selectionNotesDraft !== selectedSelectionNotes
      || selectionNotesTagExclusionsKey !== selectedSelectionTagExclusionsKey;
  }, [
    selectedSelectionNotes,
    selectedSelectionTagExclusionsKey,
    selectionNotesDraft,
    selectionNotesTagExclusionsKey,
  ]);

  const handleRemoveSelectionAutoTag = useCallback((name: string) => {
    const normalizedName = normalizeSelectionNoteToken(name);
    if (!normalizedName) return;
    setSelectionNotesTagExclusions((previous) => {
      const hasEntry = previous.some((entry) => normalizeSelectionNoteToken(entry) === normalizedName);
      if (hasEntry) return previous;
      return [...previous, name];
    });
  }, [normalizeSelectionNoteToken]);

  const handleApplySelectionSuggestion = useCallback((suggestedName: string) => {
    setSelectionNotesDraft((previous) => {
      const plainDraft = toPlainTextDescription(previous);
      if (!plainDraft.trim()) return toRichTextContent(suggestedName);
      const replaced = plainDraft.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, suggestedName);
      const nextPlain = replaced !== plainDraft ? replaced : `${plainDraft.trimEnd()} ${suggestedName}`;
      return toRichTextContent(nextPlain);
    });
    const normalizedSuggestion = normalizeSelectionNoteToken(suggestedName);
    setSelectionNotesTagExclusions((previous) => {
      const next = previous.filter((entry) => normalizeSelectionNoteToken(entry) !== normalizedSuggestion);
      return next.length === previous.length ? previous : next;
    });
  }, [normalizeSelectionNoteToken, toPlainTextDescription, toRichTextContent]);

  const handleApplyAuditionSuggestion = useCallback((suggestedName: string) => {
    setSelectedCandidate((previous) => {
      if (!previous) return previous;
      const plainDraft = toPlainTextDescription(
        typeof previous.auditionNotes === 'string' ? previous.auditionNotes : '',
      );
      if (!plainDraft.trim()) {
        return {
          ...previous,
          auditionNotes: suggestedName,
        };
      }
      const replaced = plainDraft.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, suggestedName);
      const nextPlain = replaced !== plainDraft ? replaced : `${plainDraft.trimEnd()} ${suggestedName}`;
      return {
        ...previous,
        auditionNotes: nextPlain,
      };
    });
  }, [toPlainTextDescription]);

  const selectedAuditionNotesMeta = useMemo(() => {
    if (!selectedSelectionCandidate) return { author: 'Ikke registrert', updatedAt: '' };
    const candidateRecord = selectedSelectionCandidate as unknown as Record<string, unknown>;
    const rawAuthor =
      candidateRecord.auditionNotesAuthorName
      ?? candidateRecord.auditionNotesAuthor
      ?? candidateRecord.auditionNotesBy
      ?? candidateRecord.auditionNotesUpdatedBy
      ?? '';
    const rawUpdatedAt =
      candidateRecord.auditionNotesUpdatedAt
      ?? candidateRecord.auditionNotesLastEditedAt
      ?? candidateRecord.auditionNotesTimestamp
      ?? '';
    return {
      author: typeof rawAuthor === 'string' && rawAuthor.trim().length > 0 ? rawAuthor : 'Ikke registrert',
      updatedAt: formatOptionalNoteTimestamp(rawUpdatedAt),
    };
  }, [formatOptionalNoteTimestamp, selectedSelectionCandidate]);

  const selectedSelectionNotesMeta = useMemo(() => {
    if (!selectedSelectionCandidate) return { author: 'Ikke registrert', updatedAt: '' };
    const candidateRecord = selectedSelectionCandidate as unknown as Record<string, unknown>;
    const rawAuthor =
      candidateRecord.selectionNotesAuthorName
      ?? candidateRecord.selectionNotesAuthor
      ?? candidateRecord.selectionNotesBy
      ?? '';
    const rawUpdatedAt =
      candidateRecord.selectionNotesUpdatedAt
      ?? candidateRecord.selectionNotesLastEditedAt
      ?? candidateRecord.selectionNotesTimestamp
      ?? '';
    return {
      author: typeof rawAuthor === 'string' && rawAuthor.trim().length > 0 ? rawAuthor : 'Ikke registrert',
      updatedAt: formatOptionalNoteTimestamp(rawUpdatedAt),
    };
  }, [formatOptionalNoteTimestamp, selectedSelectionCandidate]);

  useEffect(() => {
    setSelectionNotesDraft(selectedSelectionNotes);
    setSelectionNotesTagExclusions(selectedSelectionTagExclusions);
  }, [selectedSelectionCandidate?.id, selectedSelectionNotes, selectedSelectionTagExclusions]);

  useEffect(() => {
    setSelectionNotesTagExclusions((previous) => {
      if (previous.length === 0) return previous;
      const next = previous.filter((entry) => doesSelectionNoteContainName(selectionNotesDraftPlain, entry));
      return next.length === previous.length ? previous : next;
    });
  }, [doesSelectionNoteContainName, selectionNotesDraftPlain]);

  const handleSaveSelectionNotes = useCallback(async () => {
    if (!currentProject || !selectedSelectionCandidate) return;
    if (!selectionNotesHasChanges) {
      toast.showInfo('Ingen endringer i utvelgelsesnotatene.', 2500);
      return;
    }

    setSelectionNotesSaving(true);
    try {
      const nowIso = new Date().toISOString();
      await castingService.saveCandidate(currentProject.id, {
        ...selectedSelectionCandidate,
        selectionNotes: selectionNotesDraft,
        selectionNotesTagExclusions: selectionNotesTagExclusions,
        selectionNotesAuthorName: selectionActorLabel,
        selectionNotesAuthorId:
          adminUser?.id !== undefined && adminUser?.id !== null
            ? String(adminUser.id)
            : undefined,
        selectionNotesUpdatedAt: nowIso,
        updatedAt: nowIso,
      });

      const explicitMentions = globalTagService.parseExplicitMentions(selectionNotesDraftPlain);
      const globalTagSeed = [
        ...selectionAutoTagChips,
        ...explicitMentions,
        selectedSelectionCandidate.name,
        selectionActorLabel,
      ]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length >= 2);
      if (globalTagSeed.length > 0) {
        try {
          const updatedGlobalTags = await globalTagService.add(globalTagSeed);
          setGlobalTagRegistry(updatedGlobalTags);
        } catch (tagError) {
          console.warn('Kunne ikke persistere globale tags fra utvelgelsesnotater:', tagError);
        }
      }

      appendSelectionDecisionLog(selectedSelectionCandidate, 'Oppdaterte utvelgelsesnotater');
      toast.showSuccess('Utvelgelsesnotater lagret.', 2800);
      await loadProjects();
    } catch (error) {
      console.error('Error saving selection notes:', error);
      toast.showError('Kunne ikke lagre utvelgelsesnotater.');
    } finally {
      setSelectionNotesSaving(false);
    }
  }, [
    adminUser,
    appendSelectionDecisionLog,
    currentProject,
    loadProjects,
    selectedSelectionCandidate,
    selectionNotesHasChanges,
    selectionActorLabel,
    selectionAutoTagChips,
    selectionNotesDraft,
    selectionNotesDraftPlain,
    selectionNotesTagExclusions,
    toast,
  ]);

  const handleMoveCandidateToSelectionStage = useCallback(
    async (candidate: Candidate, stage: SelectionStage) => {
      if (!currentProject) return;
      try {
        await castingService.saveCandidate(currentProject.id, {
          ...candidate,
          status: SELECTION_STATUS_BY_STAGE[stage],
          updatedAt: new Date().toISOString(),
        });
        appendSelectionDecisionLog(candidate, `Flyttet til ${SELECTION_LABEL_BY_STAGE[stage]}`);
        toast.showSuccess(`${candidate.name} flyttet til ${SELECTION_LABEL_BY_STAGE[stage]}.`, 3500);
        await loadProjects();
        startTransition(() => {
          setSelectionPhaseFilter(stage);
          setSelectedSelectionCandidateId(candidate.id);
        });
      } catch (error) {
        console.error('Error updating selection stage:', error);
        toast.showError('Kunne ikke oppdatere utvelgelsesstatus.');
      }
    },
    [appendSelectionDecisionLog, currentProject, loadProjects, toast],
  );

  useEffect(() => {
    if (activeTab !== SELECTION_TAB_INDEX) return;
    setSelectionBoardMode(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== SELECTION_TAB_INDEX) return;

    const handleSelectionHotkeys = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        target?.isContentEditable
        || tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select';
      if (isEditable) return;

      const key = event.key.toLowerCase();
      if (key === 'j' || key === 'k') {
        if (selectionCandidatesFiltered.length === 0) return;
        event.preventDefault();
        const currentIndex = selectionCandidatesFiltered.findIndex((candidate) => candidate.id === selectedSelectionCandidateId);
        const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
        const delta = key === 'j' ? 1 : -1;
        const nextIndex = (fallbackIndex + delta + selectionCandidatesFiltered.length) % selectionCandidatesFiltered.length;
        const nextCandidate = selectionCandidatesFiltered[nextIndex];
        startTransition(() => setSelectedSelectionCandidateId(nextCandidate.id));
        return;
      }

      if (key === '?' || (key === '/' && event.shiftKey)) {
        event.preventDefault();
        startTransition(() => setSelectionShortcutsOpen(true));
        return;
      }

      if (!selectedSelectionCandidate) return;

      if (key === '1') {
        event.preventDefault();
        void handleMoveCandidateToSelectionStage(selectedSelectionCandidate, 'screening');
      } else if (key === '2') {
        event.preventDefault();
        void handleMoveCandidateToSelectionStage(selectedSelectionCandidate, 'callbacks');
      } else if (key === '3') {
        event.preventDefault();
        void handleMoveCandidateToSelectionStage(selectedSelectionCandidate, 'final');
      } else if (key === 'b') {
        event.preventDefault();
        startTransition(() => setSelectionBoardMode((prev) => !prev));
      }
    };

    window.addEventListener('keydown', handleSelectionHotkeys);
    return () => window.removeEventListener('keydown', handleSelectionHotkeys);
  }, [
    activeTab,
    handleMoveCandidateToSelectionStage,
    selectedSelectionCandidate,
    selectedSelectionCandidateId,
    selectionCandidatesFiltered,
  ]);

  const candidatePhotoFocalPoints = useMemo(
    () => getCandidatePhotoFocalPoints(selectedCandidate),
    [getCandidatePhotoFocalPoints, selectedCandidate],
  );
  const isLiveSetImmersive = activeTab === LIVE_SET_TAB_INDEX && isBrowserFullscreen;

  return (
    <>
      {canSwitchRoleRoomRole && professionDialogOpen && (
        <Suspense fallback={null}>
          <CastingProfessionDialog
            open={professionDialogOpen}
            onSelect={handleProfessionSelect}
          />
        </Suspense>
      )}
      <Box
        ref={workspaceRootRef}
        role="main"
        aria-label={branding.appName}
        sx={{
        ...KEYFRAMES_STYLES,
        width: '100%',
        minHeight: '100vh',
        height: 'auto',
        bgcolor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        // Responsive base font size: larger on desktop for better readability
        fontSize: isDesktop ? '16px' : isTablet ? '16px' : '14px', // Prevent zoom on iOS for tablet/mobile
        touchAction: 'pan-y',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Project Selector Header */}
      <Box sx={{ 
        display: isLiveSetImmersive ? 'none' : 'block',
        bgcolor: 'linear-gradient(180deg, #1c2128 0%, #161b22 100%)',
        background: 'linear-gradient(180deg, #1c2128 0%, #161b22 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        px: useDenseDesktopHeader ? { xs: 1.5, sm: 2, md: 2.25, lg: 2.5 } : { xs: 1.5, sm: 2, md: 3 },
        py: useDenseDesktopHeader ? { xs: 0.6, sm: 0.75 } : { xs: 0.65, sm: 0.85 },
        position: 'relative',
      }}>
        {/* Project chips row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: useCompactHeaderLayout ? 'stretch' : 'center',
            flexWrap: useCompactHeaderLayout ? 'wrap' : 'nowrap',
            gap: useDenseDesktopHeader ? 0.75 : { xs: 0.75, sm: 1 },
            minWidth: 0,
            pt: useDenseDesktopHeader ? { xs: 0.2, sm: 0.28 } : { xs: 0.35, sm: 0.5 },
            pb: useDenseDesktopHeader ? { xs: 0.35, sm: 0.45 } : { xs: 0.55, sm: 0.75 },
          }}
        >
          {!useCompactHeaderLayout ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: useDenseDesktopHeader ? { md: 0.75, lg: 0.9 } : { md: 1, lg: 1.25 },
                minWidth: 0,
                flexShrink: 0,
                order: 0,
                pr: useDenseDesktopHeader ? { md: 0.25, lg: 0.5 } : { md: 0.5, lg: 1 },
              }}
            >
              <RoleRoomBrandMark
                appearance="header"
                showLabel={false}
                sx={{
                  width: useDenseDesktopHeader ? { md: 104, lg: 114, xl: 122 } : { md: 112, lg: 124, xl: 136 },
                  flexShrink: 0,
                  opacity: 0.94,
                }}
              />
              <Box sx={{ minWidth: 0, display: useDenseDesktopHeader ? 'none' : { xs: 'none', lg: 'block' } }}>
                <Typography
                  sx={{
                    color: '#f8fafc',
                    fontSize: { lg: '0.92rem', xl: '0.96rem' },
                    fontWeight: 800,
                    lineHeight: 1.05,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {branding.appName}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.25,
                    color: 'rgba(148,163,184,0.88)',
                    fontSize: { lg: '0.7rem', xl: '0.74rem' },
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {headerBrandDisplaySubtitle}
                </Typography>
              </Box>
            </Box>
          ) : null}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: useDenseDesktopHeader ? 0.6 : { xs: 0.75, sm: 1 },
              flexShrink: 0,
              order: useCompactHeaderLayout ? 1 : 2,
            }}
          >
            {/* Add new project button */}
            <IconButton
              size="small"
              onClick={openNewProjectCreationModal}
              aria-label={branding.tokens.labels.newProjectTitle}
              data-tutorial-target="create-project-button"
              sx={{
                width: safeHeaderActionButtonSizePx,
                height: safeHeaderActionButtonSizePx,
                minWidth: safeHeaderActionButtonSizePx,
                border: '1px dashed rgba(255,255,255,0.2)',
                borderRadius: { xs: 1.5, sm: 2 },
                color: 'rgba(255,255,255,0.87)',
                flexShrink: 0,
                p: 0,
                '&:hover, &:active': {
                  borderColor: '#00d4ff',
                  color: '#00d4ff',
                  bgcolor: 'rgba(0, 212, 255, 0.1)',
                },
              }}
            >
              <AddIcon sx={{ fontSize: navIconSizePx }} />
            </IconButton>

            <IconButton
              size="small"
              onClick={openProducerInbox}
              aria-label="Åpne innboks"
              title="Innboks"
              data-testid="role-room-inbox-button"
              sx={{
                width: safeHeaderActionButtonSizePx,
                height: safeHeaderActionButtonSizePx,
                minWidth: safeHeaderActionButtonSizePx,
                border: '1px solid rgba(56,189,248,0.26)',
                borderRadius: { xs: 1.5, sm: 2 },
                color: '#bae6fd',
                flexShrink: 0,
                bgcolor: 'rgba(14,165,233,0.08)',
                p: 0,
                '&:hover, &:active': {
                  borderColor: '#38bdf8',
                  color: '#e0f2fe',
                  bgcolor: 'rgba(14,165,233,0.16)',
                },
              }}
            >
              <Badge
                color="error"
                badgeContent={producerInboxUnreadCount > 99 ? '99+' : producerInboxUnreadCount}
                invisible={producerInboxUnreadCount === 0}
              >
                <InboxIcon sx={{ fontSize: Math.max(18, navIconSizePx - 1) }} />
              </Badge>
            </IconButton>

            {!showDenseDesktopHeaderUtilities ? (
              <IconButton
                size="small"
                onClick={openTutorial}
                aria-label={branding.tokens.labels.tutorialLabel}
                title={branding.tokens.labels.tutorialTitle}
                sx={{
                  width: safeHeaderActionButtonSizePx,
                  height: safeHeaderActionButtonSizePx,
                  minWidth: safeHeaderActionButtonSizePx,
                  border: '1px solid rgba(233, 30, 99, 0.3)',
                  borderRadius: { xs: 1.5, sm: 2 },
                  color: '#e91e63',
                  flexShrink: 0,
                  bgcolor: 'rgba(233, 30, 99, 0.1)',
                  p: 0,
                  '&:hover, &:active': {
                    borderColor: '#e91e63',
                    bgcolor: 'rgba(233, 30, 99, 0.2)',
                  },
                }}
              >
                <TutorialIcon sx={{ fontSize: navIconSizePx }} />
              </IconButton>
            ) : null}
          </Box>

          {useCompactHeaderLayout && !isMobile ? (
            <Box
              onClick={openProjectSelectorDialog}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openProjectSelectorDialog();
                }
              }}
              sx={{
                order: 2,
                minWidth: 0,
                flex: '1 1 0',
                display: 'flex',
                alignItems: 'center',
                gap: 0.9,
                px: 1.05,
                py: 0.72,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(255,255,255,0.06)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: 'rgba(0,212,255,0.3)',
                  bgcolor: 'rgba(0,212,255,0.08)',
                },
              }}
            >
              <RoleRoomBrandMark appearance="header" showLabel={false} sx={{ width: { xs: 88, sm: 108 }, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  sx={{
                    color: '#f8fafc',
                    fontSize: { xs: '0.82rem', sm: '0.88rem' },
                    fontWeight: 700,
                    lineHeight: 1.15,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {headerActiveProject?.name || branding.appName}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.22,
                    color: 'rgba(226,232,240,0.64)',
                    fontSize: { xs: '0.64rem', sm: '0.68rem' },
                    fontWeight: 600,
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {[
                    adminUser?.display_name || adminUser?.email,
                    headerProfessionLabel || headerRoleLabel,
                  ]
                    .filter(Boolean)
                    .join(' • ') || 'Åpne prosjekter og arbeidsflater'}
                </Typography>
              </Box>
            </Box>
          ) : null}

          <Box
            sx={{
              display: 'flex',
              alignItems: useFocusedWorkspaceHeader ? 'center' : 'stretch',
              gap: useDenseDesktopHeader ? 0.75 : { xs: 0.75, sm: 1 },
              rowGap: useDenseDesktopHeader ? 0.75 : { xs: 0.75, sm: 1, md: 1.25 },
              flex: useCompactHeaderLayout ? '1 1 100%' : 1,
              minWidth: 0,
              order: useCompactHeaderLayout ? 4 : 1,
              // Narrow viewports keep the horizontal scroll (mobile-first),
              // but md+ wraps cards to multiple rows so a 1920/4K viewport
              // shows 4-6 cards per row instead of clipping at the edge
              // of a single-row strip.
              flexWrap: useCompactHeaderLayout ? 'nowrap' : { xs: 'nowrap', md: 'wrap' },
              overflowX: useCompactHeaderLayout ? 'auto' : { xs: 'auto', md: 'visible' },
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: useCompactHeaderLayout ? 'thin' : 'none',
              scrollSnapType: useCompactHeaderLayout ? 'x proximity' : { xs: 'x proximity', md: 'none' },
              pr: 0.25,
              '&::-webkit-scrollbar': useCompactHeaderLayout ? { height: 4 } : { display: 'none', height: 0 },
              '&::-webkit-scrollbar-thumb': useCompactHeaderLayout
                ? { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }
                : undefined,
            }}
          >
            {useFocusedWorkspaceHeader ? (
              <>
                <Box
                  onClick={openProjectSelectorDialog}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openProjectSelectorDialog();
                    }
                  }}
                  data-testid="role-room-active-project"
                  sx={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    maxWidth: { md: 520, lg: 600, xl: 680 },
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr)',
                    gap: useDenseDesktopHeader ? 0.85 : 1.1,
                    alignItems: 'center',
                    px: useDenseDesktopHeader ? { md: 1, lg: 1.15 } : { md: 1.15, lg: 1.35 },
                    py: useDenseDesktopHeader ? { md: 0.68, lg: 0.78 } : { md: 0.8, lg: 0.92 },
                    minHeight: { md: 54, lg: 58 },
                    borderRadius: { md: 2, lg: 2.25 },
                    border: headerActiveProject ? '1px solid rgba(34,211,238,0.28)' : '1px solid rgba(255,255,255,0.08)',
                    background: headerActiveProject
                      ? 'linear-gradient(135deg, rgba(8,47,73,0.34) 0%, rgba(17,24,39,0.78) 100%)'
                      : 'rgba(255,255,255,0.03)',
                    boxShadow: headerActiveProject
                      ? '0 8px 20px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease',
                    '&:hover': {
                      borderColor: 'rgba(34,211,238,0.52)',
                      background: headerActiveProject
                        ? 'linear-gradient(135deg, rgba(8,47,73,0.5) 0%, rgba(17,24,39,0.9) 100%)'
                        : 'rgba(255,255,255,0.05)',
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: useDenseDesktopHeader ? 0.65 : 0.9, minWidth: 0, flexWrap: 'wrap' }}>
                      <Box
                        sx={{
                          width: useDenseDesktopHeader ? 8 : 10,
                          height: useDenseDesktopHeader ? 8 : 10,
                          borderRadius: '50%',
                          bgcolor: headerActiveProject ? '#22d3ee' : 'rgba(255,255,255,0.22)',
                          border: headerActiveProject ? '2px solid rgba(255,255,255,0.28)' : '1px solid rgba(255,255,255,0.1)',
                          boxShadow: headerActiveProject ? '0 0 12px rgba(34,211,238,0.45)' : 'none',
                          flexShrink: 0,
                        }}
                      />
                      <Typography
                        sx={{
                          color: '#f8fafc',
                          fontSize: useDenseDesktopHeader ? { md: '0.84rem', lg: '0.9rem', xl: '0.96rem' } : { md: '0.9rem', lg: '0.98rem', xl: '1.02rem' },
                          fontWeight: 800,
                          lineHeight: 1.1,
                          minWidth: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {headerActiveProject?.name || 'Velg aktivt prosjekt'}
                      </Typography>
                      {headerActiveProject?.producerWorkflowStatus && !useDenseDesktopHeader ? (
                        <Chip
                          size="small"
                          label={PRODUCER_PROJECT_STATUS_LABELS[headerActiveProject.producerWorkflowStatus] || 'Klar for arbeid'}
                          sx={{
                            height: 20,
                            bgcolor: 'rgba(246,195,88,0.12)',
                            color: '#fcd34d',
                            border: '1px solid rgba(246,195,88,0.22)',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            maxWidth: 150,
                            '& .MuiChip-label': {
                              px: 0.75,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            },
                          }}
                        />
                      ) : null}
                      {headerActiveProject && isProtectedDemoProject(headerActiveProject) && !useDenseDesktopHeader ? (
                        <Chip
                          size="small"
                          label="Låst demo-mal"
                          sx={{
                            height: 22,
                            bgcolor: 'rgba(244,114,182,0.12)',
                            color: '#f9a8d4',
                            border: '1px solid rgba(244,114,182,0.22)',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                          }}
                        />
                      ) : null}
                    </Box>
                    <Typography
                      sx={{
                        mt: useDenseDesktopHeader ? 0.18 : 0.28,
                        color: 'rgba(226,232,240,0.64)',
                        fontSize: useDenseDesktopHeader ? { md: '0.64rem', lg: '0.68rem' } : { md: '0.68rem', lg: '0.72rem' },
                        fontWeight: 600,
                        lineHeight: 1.25,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {[
                        headerActiveProject?.clientName,
                        producerWorkspaceBadgeLabel,
                        headerActiveProject && isProtectedDemoProject(headerActiveProject) && !canMutateProtectedDemoData
                          ? 'Demoen er låst. Lag kopi for å jobbe videre.'
                          : headerActiveProject
                            ? headerProjectMetaHint
                            : 'Åpne arbeidsbiblioteket',
                      ].filter(Boolean).join(' • ')}
                    </Typography>
                  </Box>

                </Box>

                {headerActiveProject ? (
                  <IconButton
                    size="small"
                    onClick={(event: MouseEvent<HTMLElement>) => handleOpenProjectQuickActions(event, headerActiveProject)}
                    aria-label={`Flere handlinger for ${headerActiveProject.name}`}
                    title="Flere handlinger"
                    sx={{
                      color: 'rgba(255,255,255,0.68)',
                      width: projectChipActionSizePx,
                      height: projectChipActionSizePx,
                      minWidth: projectChipActionSizePx,
                      alignSelf: 'center',
                      borderRadius: 1.5,
                      border: '1px solid rgba(255,255,255,0.08)',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      flexShrink: 0,
                      '&:hover': {
                        color: '#7dd3fc',
                        bgcolor: 'rgba(96,165,250,0.12)',
                        borderColor: 'rgba(96,165,250,0.24)',
                      },
                    }}
                  >
                    <MoreHorizIcon sx={{ fontSize: Math.max(18, navIconSizePx) }} />
                  </IconButton>
                ) : null}
              </>
            ) : (
              <>
                {visibleHeaderProjects.map((project) => {
              const isActive = currentProject?.id === project.id;
              const isPinned = pinnedProjectIdSet.has(project.id);
              const useSlimProjectCard = useFocusedWorkspaceHeader && visibleHeaderProjects.length === 1;
              const pinnedAccentColor = pinnedProjectAccentColorById.get(project.id) ?? '#fbbf24';
              const candidateCount = project.candidates?.length || 0;
              const workflowStatus = project.producerWorkflowStatus;
              const workflowStatusLabel = workflowStatus
                ? PRODUCER_PROJECT_STATUS_LABELS[workflowStatus]
                : 'Klar for arbeid';
              const workflowStatusStyle = workflowStatus
                ? PRODUCER_PROJECT_STATUS_COLORS[workflowStatus]
                : {
                    background: 'rgba(148, 163, 184, 0.12)',
                    color: 'rgba(226, 232, 240, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                  };

              return (
                <Box
                  key={project.id}
                  sx={{
                    width: useSlimProjectCard
                      ? { xs: 252, sm: 284, md: 308, lg: 328, xl: 344 }
                      : { xs: 252, sm: 294, md: 320 },
                    minWidth: useSlimProjectCard
                      ? { xs: 252, sm: 284, md: 308, lg: 328, xl: 344 }
                      : { xs: 252, sm: 294, md: 320 },
                    maxWidth: useSlimProjectCard
                      ? { xs: 252, sm: 284, md: 308, lg: 328, xl: 344 }
                      : { xs: 252, sm: 294, md: 320 },
                    minHeight: useSlimProjectCard ? { xs: 60, sm: 64 } : { xs: 62, sm: 68 },
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    columnGap: { xs: 1, sm: 1.25 },
                    alignItems: 'center',
                    px: useSlimProjectCard ? { xs: 1.15, sm: 1.3 } : { xs: 1.25, sm: 1.5 },
                    py: useSlimProjectCard ? { xs: 0.82, sm: 0.92 } : { xs: 1, sm: 1.1 },
                    borderRadius: { xs: 2, sm: 2.5 },
                    border: isActive ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.06)',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.18) 0%, rgba(0, 180, 230, 0.12) 100%)'
                      : 'rgba(255,255,255,0.018)',
                    boxShadow: isActive
                      ? '0 4px 20px rgba(0, 212, 255, 0.18), inset 0 1px 0 rgba(255,255,255,0.12)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                    transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    flexShrink: 0,
                    scrollSnapAlign: 'start',
                    '&::after': isActive ? {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: '8%',
                      right: '8%',
                      height: '3px',
                      backgroundColor: '#00d4ff',
                      borderRadius: '3px 3px 0 0',
                      boxShadow: '0 0 10px rgba(0, 212, 255, 0.4)',
                    } : {},
                    '&::before': isPinned ? {
                      content: '""',
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      width: 7,
                      height: 7,
                      borderRadius: '999px',
                      backgroundColor: pinnedAccentColor,
                      boxShadow: `0 0 10px ${pinnedAccentColor}55`,
                    } : {},
                    '&:hover': {
                      borderColor: isActive ? '#00d4ff' : 'rgba(255,255,255,0.16)',
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.22) 0%, rgba(0, 180, 230, 0.16) 100%)'
                        : 'rgba(255,255,255,0.04)',
                    },
                  }}
                >
                  <Box
                    onClick={() => { void handleSelectProjectFromSelector(project); }}
                    sx={{
                      display: 'grid',
                      rowGap: 0.75,
                      minWidth: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: { xs: 10, sm: 12 },
                          height: { xs: 10, sm: 12 },
                          borderRadius: '50%',
                          bgcolor: isActive ? '#00d4ff' : 'rgba(255,255,255,0.2)',
                          border: isActive ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                          boxShadow: isActive ? '0 0 12px rgba(0, 212, 255, 0.45)' : 'none',
                          flexShrink: 0,
                        }}
                      />
                      <Typography
                        sx={{
                          color: isActive ? '#fff' : 'rgba(255,255,255,0.74)',
                          fontSize: useSlimProjectCard ? { xs: '0.8rem', sm: '0.88rem' } : { xs: '0.84rem', sm: '0.95rem' },
                          fontWeight: isActive ? 700 : 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          minWidth: 0,
                        }}
                      >
                        {project.name}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                      {isActive ? (
                        <Typography
                          sx={{
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: useSlimProjectCard ? { xs: '0.6rem', sm: '0.64rem' } : { xs: '0.64rem', sm: '0.68rem' },
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            minWidth: 0,
                            flexShrink: 1,
                          }}
                        >
                          {[project.clientName, headerRoleLabel].filter(Boolean).join(' • ') || branding.tokens.labels.activeProjectLabel}
                        </Typography>
                      ) : (
                        <Typography
                          sx={{
                            color: 'rgba(255,255,255,0.56)',
                            fontSize: { xs: '0.62rem', sm: '0.66rem' },
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          Prosjekt
                        </Typography>
                      )}
                      <Chip
                        size="small"
                        label={workflowStatusLabel}
                        sx={{
                          height: useSlimProjectCard ? 22 : 24,
                          maxWidth: useSlimProjectCard ? { xs: 118, sm: 128, md: 138 } : { xs: 132, sm: 144, md: 156 },
                          bgcolor: isActive ? workflowStatusStyle.background : 'rgba(255,255,255,0.04)',
                          color: isActive ? workflowStatusStyle.color : 'rgba(255,255,255,0.68)',
                          border: isActive ? workflowStatusStyle.border : '1px solid rgba(255,255,255,0.08)',
                          fontSize: useSlimProjectCard ? { xs: '0.62rem', sm: '0.66rem' } : { xs: '0.66rem', sm: '0.7rem' },
                          fontWeight: isActive ? 700 : 600,
                          '& .MuiChip-label': {
                            px: useSlimProjectCard ? 0.7 : 0.9,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          },
                        }}
                      />
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: useSlimProjectCard ? 0.2 : 0.35,
                      flexShrink: 0,
                    }}
                  >
                    {!useSlimProjectCard ? (
                      <Box
                        sx={{
                          minWidth: { xs: 28, sm: 32 },
                          height: { xs: 28, sm: 30 },
                          px: 0.75,
                          borderRadius: 999,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: isActive ? 'rgba(0, 212, 255, 0.22)' : 'rgba(255,255,255,0.04)',
                          border: isActive ? '1px solid rgba(0, 212, 255, 0.35)' : '1px solid rgba(255,255,255,0.06)',
                          color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                          fontSize: { xs: '0.72rem', sm: '0.78rem' },
                          fontWeight: 700,
                        }}
                      >
                        {candidateCount}
                      </Box>
                    ) : null}

                    <IconButton
                      size="small"
                      onClick={(event: MouseEvent<HTMLElement>) => handleOpenProjectQuickActions(event, project)}
                      aria-label={`Flere handlinger for ${project.name}`}
                      title="Flere handlinger"
                      sx={{
                        color: isActive ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.34)',
                        '&:hover, &:active': {
                          color: isActive ? '#00d4ff' : 'rgba(255,255,255,0.88)',
                          bgcolor: isActive ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255,255,255,0.08)',
                        },
                        width: safeHeaderProjectActionSizePx,
                        height: safeHeaderProjectActionSizePx,
                        minWidth: safeHeaderProjectActionSizePx,
                        p: 0,
                        borderRadius: 1.5,
                      }}
                    >
                      <MoreHorizIcon sx={{ fontSize: Math.max(18, navIconSizePx) }} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })}

                {hasMoreVisibleHeaderProjects && (
              <Button
                size="small"
                onClick={openProjectSelectorDialog}
                sx={{
                  minWidth: useFocusedWorkspaceHeader ? { xs: 126, sm: 136 } : { xs: 136, sm: 148 },
                  minHeight: safeHeaderActionButtonSizePx,
                  px: { xs: 1.25, sm: 1.5 },
                  borderRadius: { xs: 2, sm: 2.5 },
                  border: '1px solid rgba(139, 92, 246, 0.28)',
                  bgcolor: 'rgba(139, 92, 246, 0.08)',
                  color: '#c4b5fd',
                  fontSize: useFocusedWorkspaceHeader ? { xs: '0.68rem', sm: '0.72rem' } : { xs: '0.72rem', sm: '0.76rem' },
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  '&:hover': {
                    bgcolor: 'rgba(139, 92, 246, 0.16)',
                    borderColor: 'rgba(167, 139, 250, 0.55)',
                  },
                }}
              >
                {hiddenVisibleHeaderProjectsCount > 0 ? `Prosjekter · ${orderedProjects.length}` : 'Prosjekter'}
              </Button>
                )}
              </>
            )}
          </Box>

          <Menu
            anchorEl={projectQuickActionsAnchorEl}
            open={Boolean(projectQuickActionsAnchorEl && projectQuickActionsProject)}
            onClose={handleCloseProjectQuickActions}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{
              paper: {
                sx: {
                  mt: 0.75,
                  minWidth: isMobile ? 232 : 180,
                  width: headerMenuPaperWidth,
                  maxWidth: isMobile ? 'calc(100vw - 24px)' : undefined,
                  borderRadius: isMobile ? 2.5 : 2,
                  border: '1px solid rgba(255,255,255,0.08)',
                  bgcolor: 'rgba(18, 24, 33, 0.96)',
                  color: '#fff',
                  backdropFilter: 'blur(14px)',
                  boxShadow: '0 18px 40px rgba(0,0,0,0.42)',
                },
              },
            }}
          >
            {projectQuickActionsProject && (isProtectedDemoProject(projectQuickActionsProject) || isTemplateProject(projectQuickActionsProject)) ? (
              <MenuItem
                onClick={() => {
                  if (!projectQuickActionsProject) return;
                  handleOpenProjectCopyDialog(projectQuickActionsProject, { closeSelector: true });
                }}
                sx={{ minHeight: headerMenuItemMinHeight, fontSize: isMobile ? '0.94rem' : '0.86rem', gap: 1.2, py: isMobile ? 1 : 0.5 }}
              >
                <ContentCopyIcon sx={{ fontSize: 18, color: '#f9a8d4' }} />
                {isTemplateProject(projectQuickActionsProject) ? 'Lag prosjekt fra mal' : 'Lag kopi av demo'}
              </MenuItem>
            ) : null}
            <MenuItem
              onClick={() => {
                if (!projectQuickActionsProject) return;
                void handleTogglePinnedProject(projectQuickActionsProject.id);
                handleCloseProjectQuickActions();
              }}
              sx={{ minHeight: headerMenuItemMinHeight, fontSize: isMobile ? '0.94rem' : '0.86rem', gap: 1.2, py: isMobile ? 1 : 0.5 }}
            >
              <PushPinIcon
                sx={{
                  fontSize: 18,
                  color: pinnedProjectIdSet.has(projectQuickActionsProject?.id ?? '')
                    ? '#fbbf24'
                    : 'rgba(255,255,255,0.72)',
                  transform: pinnedProjectIdSet.has(projectQuickActionsProject?.id ?? '') ? 'rotate(0deg)' : 'rotate(35deg)',
                }}
              />
              {pinnedProjectIdSet.has(projectQuickActionsProject?.id ?? '') ? 'Løsne fra toppen' : 'Fest til toppen'}
            </MenuItem>
            {projectQuickActionsProject && canSwitchRoleRoomRole && !isTemplateProject(projectQuickActionsProject) ? (
              <MenuItem
                onClick={() => {
                  if (!projectQuickActionsProject) return;
                  void handlePublishProjectTemplate(projectQuickActionsProject);
                }}
                sx={{ minHeight: headerMenuItemMinHeight, fontSize: isMobile ? '0.94rem' : '0.86rem', gap: 1.2, py: isMobile ? 1 : 0.5 }}
              >
                <PublishIcon sx={{ fontSize: 18, color: '#c084fc' }} />
                Publiser som template
              </MenuItem>
            ) : null}
            {(!projectQuickActionsProject || !isProtectedDemoProject(projectQuickActionsProject) || canMutateProtectedDemoData) ? (
              <>
                <MenuItem
                  onClick={() => {
                    if (!projectQuickActionsProject) return;
                    openProjectEditModal(projectQuickActionsProject);
                    handleCloseProjectQuickActions();
                  }}
                  sx={{ minHeight: headerMenuItemMinHeight, fontSize: isMobile ? '0.94rem' : '0.86rem', gap: 1.2, py: isMobile ? 1 : 0.5 }}
                >
                  <EditIcon sx={{ fontSize: 18, color: '#7dd3fc' }} />
                  Rediger prosjekt
                </MenuItem>
                {projectQuickActionsProject && !isTemplateProject(projectQuickActionsProject) && !isProtectedDemoProject(projectQuickActionsProject) ? (
                  <MenuItem
                    onClick={() => {
                      if (!projectQuickActionsProject) return;
                      if (isArchivedWorkspaceProject(projectQuickActionsProject)) {
                        void handleRestoreArchivedProject(projectQuickActionsProject);
                        return;
                      }
                      void handleArchiveProject(projectQuickActionsProject);
                    }}
                    sx={{ minHeight: headerMenuItemMinHeight, fontSize: isMobile ? '0.94rem' : '0.86rem', gap: 1.2, py: isMobile ? 1 : 0.5 }}
                  >
                    {isArchivedWorkspaceProject(projectQuickActionsProject) ? (
                      <UnarchiveIcon sx={{ fontSize: 18, color: '#86efac' }} />
                    ) : (
                      <ArchiveIcon sx={{ fontSize: 18, color: '#fbbf24' }} />
                    )}
                    {isArchivedWorkspaceProject(projectQuickActionsProject) ? 'Gjenopprett prosjekt' : 'Arkiver prosjekt'}
                  </MenuItem>
                ) : null}
                <MenuItem
                  onClick={() => {
                    if (!projectQuickActionsProject) return;
                    setConfirmDeleteContext({
                      type: 'project',
                      id: projectQuickActionsProject.id,
                      name: projectQuickActionsProject.name,
                    });
                    setConfirmDeleteOpen(true);
                    handleCloseProjectQuickActions();
                  }}
                  sx={{ minHeight: headerMenuItemMinHeight, fontSize: isMobile ? '0.94rem' : '0.86rem', gap: 1.2, py: isMobile ? 1 : 0.5, color: '#fda4af' }}
                >
                  <DeleteIcon sx={{ fontSize: 18 }} />
                  Slett prosjekt
                </MenuItem>
              </>
            ) : null}
          </Menu>

          {!useCompactHeaderLayout && !useFocusedWorkspaceHeader ? <Box sx={{ flex: 1 }} /> : null}

          {adminUser ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: useCompactHeaderLayout ? 0.5 : showDenseDesktopHeaderUtilities ? 0.4 : 1,
                flexShrink: 0,
                order: useCompactHeaderLayout ? 3 : 5,
                flex: useCompactHeaderLayout ? '1 1 100%' : '0 0 auto',
                minWidth: useCompactHeaderLayout ? 0 : 'auto',
                overflowX: useCompactHeaderLayout ? 'auto' : 'visible',
                overflowY: 'hidden',
                scrollbarWidth: useCompactHeaderLayout ? 'thin' : 'auto',
                pb: useCompactHeaderLayout ? 0.15 : 0,
                px: useFocusedWorkspaceHeader && !useCompactHeaderLayout ? 0.6 : 0,
                py: useFocusedWorkspaceHeader && !useCompactHeaderLayout ? 0.45 : 0,
                borderRadius: useFocusedWorkspaceHeader && !useCompactHeaderLayout ? 2.25 : 0,
                border: useFocusedWorkspaceHeader && !useCompactHeaderLayout ? '1px solid rgba(255,255,255,0.08)' : 'none',
                background: useFocusedWorkspaceHeader && !useCompactHeaderLayout
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.035) 0%, rgba(15,23,42,0.28) 100%)'
                  : 'transparent',
                '&::-webkit-scrollbar': useCompactHeaderLayout ? { height: 4 } : undefined,
                '&::-webkit-scrollbar-thumb': useCompactHeaderLayout
                  ? { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999 }
                  : undefined,
              }}
            >
              <Tooltip title={`${workspaceAccountStatusLabel} · ${adminUser.display_name || adminUser.email}`}>
                <IconButton
                  onClick={handleOpenBillingAccountDialog}
                  aria-label="Åpne konto, abonnement og team"
                  data-testid="role-room-account-button"
                  sx={{
                    width: safeHeaderActionButtonSizePx,
                    height: safeHeaderActionButtonSizePx,
                    borderRadius: 2,
                    border: '1px solid rgba(125,211,252,0.24)',
                    bgcolor: 'rgba(15,23,42,0.88)',
                    color: '#e2e8f0',
                    p: 0,
                    '&:hover': {
                      bgcolor: 'rgba(30,41,59,0.96)',
                      borderColor: 'rgba(125,211,252,0.44)',
                    },
                  }}
                >
                  <Badge
                    overlap="circular"
                    variant="dot"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    sx={{
                      '& .MuiBadge-badge': {
                        backgroundColor: workspaceAccountStatusColor,
                        boxShadow: '0 0 0 2px rgba(15,23,42,0.92)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: Math.max(28, safeHeaderActionButtonSizePx - 10),
                        height: Math.max(28, safeHeaderActionButtonSizePx - 10),
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        background: 'linear-gradient(135deg, rgba(56,189,248,0.18) 0%, rgba(30,41,59,0.92) 100%)',
                        color: '#e0f2fe',
                        fontSize: { xs: '0.72rem', sm: '0.76rem' },
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                      }}
                    >
                      {workspaceAccountInitials}
                    </Box>
                  </Badge>
                </IconButton>
              </Tooltip>
              {showDenseDesktopHeaderUtilities ? (
                <IconButton
                  onClick={handleOpenHeaderToolsMenu}
                  aria-label="Flere kontohandlinger"
                  title="Flere handlinger"
                  sx={{
                    color: 'rgba(255,255,255,0.74)',
                    width: safeHeaderActionButtonSizePx,
                    height: safeHeaderActionButtonSizePx,
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.08)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    p: 0,
                    '&:hover': {
                      color: '#7dd3fc',
                      bgcolor: 'rgba(96,165,250,0.12)',
                      borderColor: 'rgba(96,165,250,0.22)',
                    },
                  }}
                >
                  <MoreHorizIcon sx={{ fontSize: Math.max(18, navIconSizePx) }} />
                </IconButton>
              ) : (
                <>
                  {canSwitchRoleRoomRole && (
                    <IconButton
                      onClick={openProfessionDialog}
                      aria-label={branding.tokens.labels.switchProfessionLabel}
                      title={branding.tokens.labels.switchProfessionLabel}
                      sx={{
                        color: '#10b981',
                        width: safeHeaderActionButtonSizePx,
                        height: safeHeaderActionButtonSizePx,
                        p: 0,
                        '&:hover': { bgcolor: 'rgba(16,185,129,0.1)' },
                      }}
                    >
                      <SwapHorizIcon sx={{ fontSize: navIconSizePx }} />
                    </IconButton>
                  )}
                  {(adminUser.role === 'owner' || adminUser.role === 'admin') && (
                    <>
                      <IconButton
                        onClick={openTutorialEditor}
                        aria-label={branding.tokens.labels.editTutorialsLabel}
                        title={branding.tokens.labels.editTutorialsLabel}
                        sx={{
                          color: '#e91e63',
                          width: safeHeaderActionButtonSizePx,
                          height: safeHeaderActionButtonSizePx,
                          p: 0,
                          '&:hover': { bgcolor: 'rgba(233,30,99,0.1)' },
                        }}
                      >
                        <TutorialIcon sx={{ fontSize: navIconSizePx }} />
                      </IconButton>
                      <IconButton
                        onClick={openAdminDashboard}
                        aria-label={branding.tokens.labels.manageUsersLabel}
                        title={branding.tokens.labels.manageUsersLabel}
                        sx={{
                          color: '#8b5cf6',
                          width: safeHeaderActionButtonSizePx,
                          height: safeHeaderActionButtonSizePx,
                          p: 0,
                          '&:hover': { bgcolor: 'rgba(139,92,246,0.1)' },
                        }}
                      >
                        <AdminPanelSettingsIcon sx={{ fontSize: navIconSizePx }} />
                      </IconButton>
                    </>
                  )}
                  <IconButton
                    onClick={handleRestartWorkspaceOnboarding}
                    aria-label={branding.tokens.labels.showIntroLabel}
                    title={branding.tokens.labels.showIntroTitle}
                    sx={{
                      color: '#ffb800',
                      width: safeHeaderActionButtonSizePx,
                      height: safeHeaderActionButtonSizePx,
                      p: 0,
                      '&:hover': { bgcolor: 'rgba(255,184,0,0.1)' },
                    }}
                  >
                    <PlayArrowIcon sx={{ fontSize: navIconSizePx }} />
                  </IconButton>
                  <IconButton
                    onClick={handleWorkspaceLogout}
                    aria-label={branding.tokens.labels.logoutLabel}
                    title={branding.tokens.labels.logoutLabel}
                    sx={{
                      color: 'rgba(255,255,255,0.87)',
                      width: safeHeaderActionButtonSizePx,
                      height: safeHeaderActionButtonSizePx,
                      p: 0,
                      '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' },
                    }}
                  >
                    <LogoutIcon sx={{ fontSize: navIconSizePx }} />
                  </IconButton>
                </>
              )}
            </Box>
          ) : (
            <IconButton
              size="small"
              onClick={openLoginDialog}
              aria-label={branding.tokens.labels.loginLabel}
              title={branding.tokens.labels.loginLabel}
              sx={{
                color: '#8b5cf6',
                flexShrink: 0,
                width: safeHeaderActionButtonSizePx,
                height: safeHeaderActionButtonSizePx,
                minWidth: safeHeaderActionButtonSizePx,
                p: 0,
                '&:hover': { bgcolor: 'rgba(139,92,246,0.1)' },
              }}
            >
              <LoginIcon sx={{ fontSize: navIconSizePx }} />
            </IconButton>
          )}
          {adminUser && showDenseDesktopHeaderUtilities ? (
            <Menu
              anchorEl={headerToolsAnchorEl}
              open={Boolean(headerToolsAnchorEl)}
              onClose={handleCloseHeaderToolsMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
              paper: {
                sx: {
                  mt: 0.75,
                  minWidth: isMobile ? 240 : 220,
                  width: headerMenuPaperWidth,
                  maxWidth: isMobile ? 'calc(100vw - 24px)' : undefined,
                  borderRadius: isMobile ? 2.5 : 2,
                  border: '1px solid rgba(255,255,255,0.08)',
                  bgcolor: 'rgba(18, 24, 33, 0.96)',
                  color: '#fff',
                    backdropFilter: 'blur(14px)',
                    boxShadow: '0 18px 40px rgba(0,0,0,0.42)',
                  },
                },
              }}
            >
              {canSwitchRoleRoomRole ? (
                <MenuItem
                  onClick={() => {
                    handleCloseHeaderToolsMenu();
                    openProfessionDialog();
                  }}
                  sx={{ minHeight: headerMenuItemMinHeight, fontSize: isMobile ? '0.94rem' : '0.86rem', gap: 1.2, py: isMobile ? 1 : 0.5 }}
                >
                  <SwapHorizIcon sx={{ fontSize: 18, color: '#10b981' }} />
                  Bytt visning
                </MenuItem>
              ) : null}
                <MenuItem
                  onClick={handleRestartWorkspaceOnboarding}
                  sx={{ minHeight: headerMenuItemMinHeight, fontSize: isMobile ? '0.94rem' : '0.86rem', gap: 1.2, py: isMobile ? 1 : 0.5 }}
                >
                <PlayArrowIcon sx={{ fontSize: 18, color: '#fbbf24' }} />
                Start intro på nytt
              </MenuItem>
              {(adminUser.role === 'owner' || adminUser.role === 'admin') ? (
                <MenuItem
                  onClick={() => {
                    handleCloseHeaderToolsMenu();
                    openTutorialEditor();
                  }}
                  sx={{ minHeight: headerMenuItemMinHeight, fontSize: isMobile ? '0.94rem' : '0.86rem', gap: 1.2, py: isMobile ? 1 : 0.5 }}
                >
                  <TutorialIcon sx={{ fontSize: 18, color: '#f472b6' }} />
                  Rediger opplæring
                </MenuItem>
              ) : null}
              {(adminUser.role === 'owner' || adminUser.role === 'admin') ? (
                <MenuItem
                  onClick={() => {
                    handleCloseHeaderToolsMenu();
                    openAdminDashboard();
                  }}
                  sx={{ minHeight: headerMenuItemMinHeight, fontSize: isMobile ? '0.94rem' : '0.86rem', gap: 1.2, py: isMobile ? 1 : 0.5 }}
                >
                  <AdminPanelSettingsIcon sx={{ fontSize: 18, color: '#a78bfa' }} />
                  Åpne adminpanel
                </MenuItem>
              ) : null}
              <MenuItem
                onClick={handleWorkspaceLogout}
                sx={{ minHeight: headerMenuItemMinHeight, fontSize: isMobile ? '0.94rem' : '0.86rem', gap: 1.2, py: isMobile ? 1 : 0.5, color: '#fda4af' }}
              >
                <LogoutIcon sx={{ fontSize: 18 }} />
                Logg ut
              </MenuItem>
            </Menu>
          ) : null}
        </Box>

      </Box>

      {adminUser && isRoleRoomCommercialSession && billingAccount?.paymentStatus === 'payment_failed' && (
        <Box sx={{ px: { xs: 1.25, sm: 1.75 }, pt: 1.1, pb: 0.35 }}>
          <Alert
            severity="warning"
            action={billingAccount.canManageBilling ? (
              <Button
                color="inherit"
                size="small"
                onClick={handleOpenBillingAccountDialog}
                sx={{ fontWeight: 700 }}
              >
                Oppdater
              </Button>
            ) : undefined}
            sx={{
              borderRadius: 2,
              border: '1px solid rgba(248,113,113,0.26)',
              bgcolor: 'rgba(127,29,29,0.16)',
              color: '#ffe4e6',
              '& .MuiAlert-icon': { color: '#fda4af' },
            }}
          >
            {billingAccount.paymentFailureMessage || billingAccount.paymentMessage}
          </Alert>
        </Box>
      )}

      {/* Tabs */}
      <Box 
        role="navigation"
        aria-label={`${branding.appName} navigasjon`}
        sx={{
          display: isLiveSetImmersive ? 'none' : 'block',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          bgcolor: '#1c2128',
          flexShrink: 0,
        }}
      >
        <Tabs
          value={displayedActiveTab}
          onChange={(_: SyntheticEvent, v: number) => navigateToTab(v)}
          aria-label={`${branding.appName} faner`}
          variant="scrollable"
          scrollButtons={isMobile ? true : 'auto'}
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              minHeight: navTabMinHeightPx,
              minWidth: isMobile ? 44 : navTabMinWidthPx,
              fontSize: `${navTabFontSizePx}px`,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.87)',
              padding: navTabPadding,
              textTransform: 'none',
              flexShrink: 0,
              '&.Mui-selected': {
                color: '#fff',
              },
              '&:focus-visible': {
                outline: '3px solid #00d4ff',
                outlineOffset: '-2px',
                borderRadius: '4px',
              },
              '& .MuiTab-iconWrapper': {
                marginRight: isMobile ? 0.5 : 1,
              },
            },
            '& .MuiTabs-indicator': {
              display: 'none',
            },
            '& .MuiTabs-scrollButtons': {
              minWidth: Math.max(36, navActionButtonSizePx),
              minHeight: Math.max(36, navActionButtonSizePx),
              color: 'rgba(255,255,255,0.9)',
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: 1,
              mx: 0.5,
              '&.Mui-disabled': {
                opacity: 0.3,
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
              '&:focus-visible': {
                outline: '3px solid #00d4ff',
                outlineOffset: '2px',
              },
              '& svg': {
                fontSize: `${Math.max(22, navIconSizePx + 6)}px`,
              },
            },
            '& .MuiTabs-flexContainer': {
              gap: isMobile ? '2px' : (isContentProducerMode || isClientReviewerMode ? '3px' : '4px'),
            },
          }}
        >
          {tabConfig.map((config, index) => {
            const tabValues = [
              0,
              STORY_ARC_TAB_INDEX,
              ROLES_TAB_INDEX,
              CANDIDATES_TAB_INDEX,
              AUDITIONS_TAB_INDEX,
              SELECTION_TAB_INDEX,
              LOCATIONS_TAB_INDEX,
              CALENDAR_TAB_INDEX,
              TEAM_TAB_INDEX,
              EQUIPMENT_TAB_INDEX,
              LIVE_SET_TAB_INDEX,
              PRODUCER_MEDIA_TAB_INDEX,
              PRODUCER_ECONOMY_TAB_INDEX,
              PRODUCER_TIMELINE_TAB_INDEX,
              PRODUCER_REVIEWS_TAB_INDEX,
              PRODUCER_EXPORT_TAB_INDEX,
            ];
            const IconComponent = config.icon;
            const tabValue = tabValues[index];
            if (!visibleTabValues.includes(tabValue)) {
              return null;
            }
            const isSelected = displayedActiveTab === tabValue;
            const isPreProductionTab = tabValue === STORY_ARC_TAB_INDEX;
            const isCastingCoreTab = tabValue >= ROLES_TAB_INDEX && tabValue <= SELECTION_TAB_INDEX;
            const isProductionPlanCoreTab = tabValue >= LOCATIONS_TAB_INDEX && tabValue <= CALENDAR_TAB_INDEX;
            const isResourcesCoreTab = tabValue >= TEAM_TAB_INDEX && tabValue <= EQUIPMENT_TAB_INDEX;
            const isLiveSetTab = tabValue === LIVE_SET_TAB_INDEX;
            const isProducerCoreTab =
              tabValue >= PRODUCER_MEDIA_TAB_INDEX && tabValue <= PRODUCER_EXPORT_TAB_INDEX;
            const useCompactProducerTab = (isContentProducerMode || isClientReviewerMode) && !isMobile;
            const showTabMeta = !isMobile && (!useCompactProducerTab || quickTier6 || isSelected);
            const effectiveTabMinWidth = isMobile
              ? 44
              : useCompactProducerTab
                ? Math.max(98, navTabMinWidthPx - (quickTier6 ? 10 : 20))
                : navTabMinWidthPx;
            const effectiveTabLabelFontSize = useCompactProducerTab
              ? Math.max(13, navTabLabelFontSizePx - 1)
              : navTabLabelFontSizePx;
            const effectiveTabMetaFontSize = useCompactProducerTab
              ? Math.max(9, navTabMetaFontSizePx - 1)
              : navTabMetaFontSizePx;
            const tabLabels = [
              branding.tokens.labels.dashboard,
              isContentProducerMode ? 'Planner' : 'Role Room Studio',
              branding.tokens.labels.roles,
              isContentProducerMode ? 'Medvirkende' : branding.tokens.labels.candidates,
              branding.tokens.labels.auditions,
              'Utvelgelse',
              branding.tokens.labels.locations,
              branding.tokens.labels.schedule,
              branding.tokens.labels.team,
              isContentProducerMode ? 'Utstyr' : branding.tokens.labels.equipment,
              'Live Set',
              isExternalClientPortalMode ? 'Workspace' : isClientReviewerMode ? 'Klientflate' : 'Prosjektrom',
              'Økonomi',
              'Planner',
              'Godkjenning',
              'Levering',
            ];
            const tabIds = [
              'tab-oversikt',
              'tab-story-arc-studio',
              'tab-roller',
              'tab-kandidater',
              'tab-auditions',
              'tab-utvelgelse',
              'tab-lokasjoner',
              'tab-produksjonsplan',
              'tab-team',
              'tab-rekvisitter',
              'tab-live-set',
              'tab-producer-media',
              'tab-producer-okonomi',
              'tab-producer-tidslinje',
              'tab-producer-reviews',
              'tab-producer-eksport',
            ];
            const tabPanelIds = [
              'tabpanel-oversikt',
              'tabpanel-story-arc-studio',
              'tabpanel-roller',
              'tabpanel-kandidater',
              'tabpanel-auditions',
              'tabpanel-utvelgelse',
              'tabpanel-lokasjoner',
              'tabpanel-produksjonsplan',
              'tabpanel-team',
              'tabpanel-rekvisitter',
              'tabpanel-live-set',
              'tabpanel-producer-media',
              'tabpanel-producer-okonomi',
              'tabpanel-producer-tidslinje',
              'tabpanel-producer-reviews',
              'tabpanel-producer-eksport',
            ];
            
            return (
              <Tab
                key={tabValue}
                value={tabValue}
                icon={
                  <Box
                    sx={{
                      width: tabIconBoxSizePx,
                      height: tabIconBoxSizePx,
                      borderRadius: 1,
                      bgcolor: isSelected ? `${config.color}20` : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <IconComponent sx={{ fontSize: tabIconGlyphSizePx, color: isSelected ? config.color : 'rgba(255,255,255,0.7)' }} />
                  </Box>
                }
                iconPosition="start"
                label={isMobile ? undefined : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
                    <Box component="span" sx={{ fontWeight: 700, fontSize: `${effectiveTabLabelFontSize}px` }}>
                      {tabLabels[index]}
                    </Box>
                    {showTabMeta && isCastingCoreTab && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.2,
                          fontSize: `${effectiveTabMetaFontSize}px`,
                          lineHeight: 1,
                          letterSpacing: 0.35,
                          textTransform: 'uppercase',
                          color: isSelected ? '#fde68a' : '#fcd34d',
                          fontWeight: 800,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: '#ffb800',
                            boxShadow: '0 0 10px rgba(255,184,0,0.6)',
                          }}
                        />
                        Casting
                      </Box>
                    )}
                    {showTabMeta && isPreProductionTab && !isContentProducerMode && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.2,
                          fontSize: `${effectiveTabMetaFontSize}px`,
                          lineHeight: 1,
                          letterSpacing: 0.35,
                          textTransform: 'uppercase',
                          color: isSelected ? '#fbcfe8' : '#f9a8d4',
                          fontWeight: 800,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: '#ec4899',
                            boxShadow: '0 0 10px rgba(236,72,153,0.56)',
                          }}
                        />
                        Pre-produksjon
                      </Box>
                    )}
                    {showTabMeta && isProductionPlanCoreTab && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.2,
                          fontSize: `${effectiveTabMetaFontSize}px`,
                          lineHeight: 1,
                          letterSpacing: 0.35,
                          textTransform: 'uppercase',
                          color: isSelected ? '#bae6fd' : '#7dd3fc',
                          fontWeight: 800,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: '#38bdf8',
                            boxShadow: '0 0 10px rgba(56,189,248,0.56)',
                          }}
                        />
                        Produksjonsplan
                      </Box>
                    )}
                    {showTabMeta && isResourcesCoreTab && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.2,
                          fontSize: `${effectiveTabMetaFontSize}px`,
                          lineHeight: 1,
                          letterSpacing: 0.35,
                          textTransform: 'uppercase',
                          color: isSelected ? '#e9d5ff' : '#d8b4fe',
                          fontWeight: 800,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: '#a855f7',
                            boxShadow: '0 0 10px rgba(168,85,247,0.56)',
                          }}
                        />
                        Ressurser
                      </Box>
                    )}
                    {showTabMeta && isLiveSetTab && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.2,
                          fontSize: `${effectiveTabMetaFontSize}px`,
                          lineHeight: 1,
                          letterSpacing: 0.35,
                          textTransform: 'uppercase',
                          color: isSelected ? '#fecaca' : '#fca5a5',
                          fontWeight: 800,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: '#ef4444',
                            boxShadow: '0 0 10px rgba(239,68,68,0.56)',
                          }}
                        />
                        Produksjon
                      </Box>
                    )}
                    {showTabMeta && isProducerCoreTab && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.2,
                          fontSize: `${effectiveTabMetaFontSize}px`,
                          lineHeight: 1,
                          letterSpacing: 0.35,
                          textTransform: 'uppercase',
                          color: isSelected ? '#dbeafe' : '#bfdbfe',
                          fontWeight: 800,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: '#60a5fa',
                            boxShadow: '0 0 10px rgba(96,165,250,0.56)',
                          }}
                        />
                        {producerCoreTabMetaLabel}
                      </Box>
                    )}
                  </Box>
                )}
                aria-label={`${tabLabels[index]} fane`}
                id={tabIds[index]}
                aria-controls={tabPanelIds[index]}
                sx={{
                  bgcolor: isSelected
                    ? `${config.color}15`
                    : isCastingCoreTab
                      ? 'rgba(255,184,0,0.06)'
                      : isProducerCoreTab
                        ? 'rgba(96,165,250,0.08)'
                      : 'transparent',
                  border: isSelected ? `1px solid ${config.color}30` : '1px solid transparent',
                  borderRadius: 1,
                  mx: { xs: 0.25, sm: 0.5 },
                  ml: tabValue === ROLES_TAB_INDEX ? { xs: 0.75, sm: 1 } : undefined,
                  mr: tabValue === SELECTION_TAB_INDEX ? { xs: 0.75, sm: 1 } : undefined,
                  mb: { xs: 0.5, sm: 1 },
                  mt: { xs: 0.5, sm: 1 },
                  minHeight: navTabMinHeightPx,
                  minWidth: effectiveTabMinWidth,
                  px: isMobile ? 1.5 : undefined,
                  boxShadow: isCastingCoreTab
                    ? 'inset 0 -2px 0 rgba(255,184,0,0.22)'
                    : isProducerCoreTab
                      ? 'inset 0 -2px 0 rgba(96,165,250,0.22)'
                      : 'none',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: isSelected ? `${config.color}20` : `${config.color}10`,
                    border: `1px solid ${config.color}40`,
                    transform: isDesktop ? 'translateY(-2px)' : 'none',
                  },
                  color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)',
                  '&.Mui-selected': {
                    color: '#fff',
                  },
                }}
              />
            );
          })}
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', bgcolor: '#0d1117', display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%' }}>
        <ProjectProvider key={currentProject?.id ?? 'no-project'}>
          {producerProjectSwitchPending ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.25,
                px: 2,
                py: 1.5,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                bgcolor: 'rgba(8,12,20,0.88)',
              }}
            >
              <CircularProgress size={18} sx={{ color: '#60a5fa' }} />
              <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.74)', fontWeight: 600 }}>
                Bytter prosjekt og laster tilgang for workspace
              </Typography>
            </Box>
          ) : null}
          {projectsLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
              <CircularProgress size={40} sx={{ color: '#8b5cf6' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                {branding.tokens.labels.loadingLabel || 'Loading...'}
              </Typography>
            </Box>
          ) : (
          <ErrorBoundary>
          <Suspense fallback={<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.87)' }}>{branding.tokens.labels.loadingLabel}</Box>}>
        <TabPanel value={activeTab} index={0}>
          <DashboardPanel
            key={currentProject?.id ?? 'no-project'}
            project={currentProject}
            roles={roles}
            candidates={allCandidates}
            schedules={schedules}
            onNavigateToTab={navigateToTab}
            onCreateRole={handleCreateRole}
            onCreateCandidate={handleCreateCandidate}
            onCreateSchedule={handleCreateSchedule}
            onOpenSharing={openSharingModal}
            onUpdate={async () => {
              if (currentProject) {
                const updated = await castingService.getProject(currentProject.id);
                if (updated) {
                  setCurrentProject(updated);
                }
              }
            }}
            onEditCandidate={(candidate) => {
              setSelectedCandidate(candidate);
              openCandidateDialog();
            }}
            onCandidatesChange={loadProjects}
            profession={profession}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={ROLES_TAB_INDEX}>
          <RoleManagementPanel
            key={currentProject?.id ?? 'no-project'}
            projectId={currentProject?.id || ''}
            roles={roles}
            onRolesChange={loadProjects}
            onEditRole={(role) => {
              setSelectedRole(role);
              openRoleDialog();
            }}
            onCreateRole={handleCreateRole}
            profession={profession}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={CANDIDATES_TAB_INDEX}>
          {isContentProducerMode ? (
            <ProducerExtrasPanel>
              <CandidateManagementPanel
                key={currentProject?.id ?? 'no-project'}
                projectId={currentProject?.id || ''}
                candidates={candidates}
                roles={roles}
                onCandidatesChange={loadProjects}
                onEditCandidate={(candidate) => {
                  setSelectedCandidate(candidate);
                  openCandidateDialog();
                }}
                onCreateCandidate={handleCreateCandidate}
                profession={profession}
                quickContactIds={quickContactIds}
                onQuickContactsChange={handleQuickContactsChange}
              />
            </ProducerExtrasPanel>
          ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Candidate filters & view mode toolbar */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <Select
                  value={candidateStatusFilter}
                  onChange={(e) => setCandidateStatusFilter(e.target.value)}
                  displayEmpty
                  MenuProps={selectMenuProps}
                  sx={{ color: '#fff', fontSize: '0.875rem', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                >
                  <MenuItem value="all">{branding.tokens.labels.candidateStatusAll}</MenuItem>
                  <MenuItem value="pending">{branding.tokens.labels.candidateStatusPending}</MenuItem>
                  <MenuItem value="requested">{branding.tokens.labels.candidateStatusRequested}</MenuItem>
                  <MenuItem value="shortlist">{branding.tokens.labels.candidateStatusShortlist}</MenuItem>
                  <MenuItem value="selected">{branding.tokens.labels.candidateStatusSelected}</MenuItem>
                  <MenuItem value="confirmed">{branding.tokens.labels.candidateStatusConfirmed}</MenuItem>
                  <MenuItem value="rejected">{branding.tokens.labels.candidateStatusRejected}</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                <IconButton
                  size="small"
                  onClick={() => {
                    startTransition(() => setCandidateViewMode('list'));
                  }}
                  aria-label={branding.tokens.labels.listViewLabel}
                  sx={{ color: candidateViewMode === 'list' ? '#00d4ff' : 'rgba(255,255,255,0.5)', bgcolor: candidateViewMode === 'list' ? 'rgba(0,212,255,0.15)' : 'transparent', borderRadius: 1 }}
                >
                  <ViewListIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => {
                    startTransition(() => setCandidateViewMode('kanban'));
                  }}
                  aria-label={branding.tokens.labels.kanbanViewLabel}
                  sx={{ color: candidateViewMode === 'kanban' ? '#00d4ff' : 'rgba(255,255,255,0.5)', bgcolor: candidateViewMode === 'kanban' ? 'rgba(0,212,255,0.15)' : 'transparent', borderRadius: 1 }}
                >
                  <GroupIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Box>
            </Box>
            {candidateViewMode === 'kanban' ? (
              <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} sx={{ color: '#00d4ff' }} /></Box>}>
                <KanbanPanel
                  key={currentProject?.id ?? 'no-project'}
                  project={currentProject}
                  candidates={candidates}
                  roles={roles}
                  onCandidatesChange={loadProjects}
                  onEditCandidate={(candidate: Candidate) => {
                    setSelectedCandidate(candidate);
                    openCandidateDialog();
                  }}
                  onCreateCandidate={handleCreateCandidate}
                  onNavigateToTab={navigateToTab}
                />
              </Suspense>
            ) : (
            <>
              {/* Drag status banner */}
              {draggedCandidate && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
                  bgcolor: 'rgba(0,212,255,0.1)', borderRadius: 1, border: '1px dashed rgba(0,212,255,0.4)',
                }}>
                  <SwapHorizIcon sx={{ fontSize: 18, color: '#00d4ff' }} />
                  <Typography variant="body2" sx={{ color: '#00d4ff', fontSize: '0.8rem' }}>
                    {branding.tokens.labels.draggingCandidateLabel.replace('{name}', draggedCandidate.name)}
                  </Typography>
                  <Button size="small" onClick={() => setDraggedCandidate(null)} sx={{ ml: 'auto', color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontSize: '0.75rem' }}>
                    {branding.tokens.labels.cancelLabel}
                  </Button>
                </Box>
              )}
              {/* Quick contact actions */}
              {quickContactCandidates.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: { xs: 1, sm: 1.1, md: 1.2, lg: 1.25, xl: 1.4 },
                    p: { xs: 1, sm: 1.2, md: 1.3, lg: 1.4, xl: 1.6 },
                    borderRadius: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2, xl: 2.2 },
                    border: '1px solid rgba(0,212,255,0.3)',
                    bgcolor: 'rgba(0,212,255,0.08)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#a8ecff',
                        fontWeight: 700,
                        fontSize: { xs: '0.74rem', sm: '0.76rem', md: '0.78rem', lg: '0.8rem', xl: '0.84rem' },
                        letterSpacing: '0.04em',
                      }}
                    >
                      {branding.tokens.labels.quickContactLabel}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${quickContactCandidates.length}`}
                      sx={{
                        height: { xs: 21, sm: 22, md: 23, lg: 24, xl: 25 },
                        color: '#a8ecff',
                        bgcolor: 'rgba(0,212,255,0.14)',
                        border: '1px solid rgba(0,212,255,0.28)',
                        fontWeight: 700,
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: quickContactGridColumns,
                      gap: { xs: 0.65, sm: 0.7, md: 0.8, lg: 0.9, xl: 1 },
                    }}
                  >
                    {quickContactCandidates.slice(0, quickContactVisibleCount).map((candidate) => (
                      <Box
                        key={candidate.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: { xs: 0.45, sm: 0.5, md: 0.6, lg: 0.65, xl: 0.75 },
                          px: { xs: 0.72, sm: 0.8, md: 0.9, lg: 1, xl: 1.1 },
                          py: { xs: 0.5, sm: 0.55, md: 0.62, lg: 0.68, xl: 0.72 },
                          borderRadius: 999,
                          bgcolor: 'rgba(4,21,33,0.62)',
                          border: '1px solid rgba(0,212,255,0.26)',
                          minWidth: 0,
                        }}
                      >
                        <Typography
                          sx={{
                            color: 'rgba(255,255,255,0.92)',
                            fontSize: { xs: '0.69rem', sm: '0.72rem', md: '0.74rem', lg: '0.76rem', xl: '0.8rem' },
                            fontWeight: 600,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {candidate.name}
                        </Typography>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.15 }}>
                          {getCandidateContactInfo(candidate).email && (
                            <Tooltip title={`${branding.tokens.labels.emailTooltipPrefix}${getCandidateContactInfo(candidate).email}`}>
                              <IconButton
                                size="small"
                                onClick={() => window.open(`mailto:${getCandidateContactInfo(candidate).email}`, '_blank')}
                                sx={{
                                  color: '#8ce6ff',
                                  p: { xs: 0.35, sm: 0.4, md: 0.45, lg: 0.5, xl: 0.55 },
                                }}
                              >
                                <EmailIcon sx={{ fontSize: { xs: 13, sm: 14, md: 15, lg: 15, xl: 16 } }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {getCandidateContactInfo(candidate).phone && (
                            <Tooltip title={`${branding.tokens.labels.callTooltipPrefix}${getCandidateContactInfo(candidate).phone}`}>
                              <IconButton
                                size="small"
                                onClick={() => window.open(`tel:${getCandidateContactInfo(candidate).phone}`, '_blank')}
                                sx={{
                                  color: '#8ce6ff',
                                  p: { xs: 0.35, sm: 0.4, md: 0.45, lg: 0.5, xl: 0.55 },
                                }}
                              >
                                <PhoneIcon sx={{ fontSize: { xs: 13, sm: 14, md: 15, lg: 15, xl: 16 } }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                  {quickContactCandidates.length > quickContactVisibleCount && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Chip
                        size="small"
                        label={`+${quickContactCandidates.length - quickContactVisibleCount}`}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontWeight: 700,
                          height: { xs: 21, sm: 22, md: 23, lg: 24, xl: 25 },
                        }}
                      />
                    </Box>
                  )}
                </Box>
              )}
            <CandidateManagementPanel
              key={currentProject?.id ?? 'no-project'}
              projectId={currentProject?.id || ''}
              candidates={candidates}
              roles={roles}
              onCandidatesChange={loadProjects}
              onEditCandidate={(candidate) => {
                setSelectedCandidate(candidate);
                openCandidateDialog();
              }}
              onCreateCandidate={handleCreateCandidate}
              profession={profession}
              quickContactIds={quickContactIds}
              onQuickContactsChange={handleQuickContactsChange}
            />
            </>
            )}
          </Box>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={AUDITIONS_TAB_INDEX}>
          <AuditionSchedulePanel
            key={currentProject?.id ?? 'no-project'}
            projectId={currentProject?.id || ''}
            schedules={schedules}
            candidates={candidates}
            roles={roles}
            availableScenes={availableScenes}
            onSchedulesChange={loadProjects}
            onEditSchedule={(schedule) => {
              setSelectedSchedule(schedule);
              openScheduleDialog();
            }}
            onCreateSchedule={handleCreateSchedule}
            onNavigateToTab={navigateToTab}
            profession={profession}
            userId={adminUser ? String(adminUser.id) : undefined}
            enableRoleRoomApi={!isGuestMode}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={SELECTION_TAB_INDEX}>
          {!currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2.25,
                ...(selectionBoardMode
                  ? {
                      position: 'fixed',
                      top: { xs: 8, sm: 14, md: 18 },
                      right: { xs: 8, sm: 14, md: 18 },
                      bottom: { xs: 8, sm: 14, md: 18 },
                      left: { xs: 8, sm: 14, md: 18 },
                      zIndex: Z_INDEX.dialog + 20,
                      p: { xs: 1.25, sm: 2 },
                      borderRadius: 2.8,
                      border: '1px solid rgba(45,212,191,0.38)',
                      bgcolor: 'rgba(2,6,23,0.96)',
                      boxShadow: '0 24px 70px rgba(2,6,23,0.72)',
                      backdropFilter: 'blur(8px)',
                      overflow: 'auto',
                    }
                  : {}),
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  px: { xs: 1.5, sm: 2 },
                  py: { xs: 1.25, sm: 1.5 },
                  borderRadius: 2.5,
                  border: '1px solid rgba(20,184,166,0.32)',
                  background: 'linear-gradient(120deg, rgba(20,184,166,0.2) 0%, rgba(56,189,248,0.1) 55%, rgba(15,23,42,0.22) 100%)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      background: 'linear-gradient(135deg, #14b8a6, #0ea5e9)',
                      border: '1px solid rgba(153,246,228,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px rgba(20,184,166,0.3)',
                    }}
                  >
                    <CasinoIcon sx={{ color: '#fff', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
                      Utvelgelse
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.78)' }}>
                      Lightbox-screening med self-tapes
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.85 }}>
                  <Chip
                    size="small"
                    label="CASTING BOARD"
                    sx={{
                      bgcolor: 'rgba(14,116,144,0.24)',
                      color: '#7dd3fc',
                      border: '1px solid rgba(125,211,252,0.46)',
                      fontWeight: 700,
                    }}
                  />
                  <Button
                    size="small"
                    variant={selectionBoardMode ? 'contained' : 'outlined'}
                    onClick={() => {
                      startTransition(() => setSelectionBoardMode((prev) => !prev));
                    }}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 999,
                      fontWeight: 700,
                      px: 1.4,
                      borderColor: 'rgba(56,189,248,0.48)',
                      bgcolor: selectionBoardMode ? 'rgba(14,116,144,0.82)' : 'transparent',
                      color: '#e0f2fe',
                    }}
                  >
                    {selectionBoardMode ? 'Lukk board' : 'Åpne board'}
                  </Button>
                  <Tooltip title="Tastatursnarveier (?)">
                    <IconButton
                      size="small"
                      onClick={() => setSelectionShortcutsOpen(true)}
                      aria-label="Åpne utvelgelse-snarveier"
                      sx={{
                        color: '#bae6fd',
                        border: '1px solid rgba(125,211,252,0.46)',
                        borderRadius: 1.4,
                        width: 30,
                        height: 30,
                        bgcolor: 'rgba(14,116,144,0.24)',
                      }}
                    >
                      <KeyboardIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                {([
                  ['screening', `Screening (${selectionMetrics.screening})`],
                  ['callbacks', `Callbacks (${selectionMetrics.callbacks})`],
                  ['final', `Final selection (${selectionMetrics.final})`],
                  ['all', `Alle (${selectionMetrics.total})`],
                ] as const).map(([phase, label]) => (
                  <Button
                    key={phase}
                    size="small"
                    variant={selectionPhaseFilter === phase ? 'contained' : 'outlined'}
                    onClick={() => {
                      startTransition(() => setSelectionPhaseFilter(phase));
                    }}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 999,
                      px: 1.5,
                      borderColor: 'rgba(20,184,166,0.48)',
                      bgcolor: selectionPhaseFilter === phase ? 'rgba(20,184,166,0.3)' : 'transparent',
                      color: selectionPhaseFilter === phase ? '#e0fdf4' : 'rgba(226,232,240,0.9)',
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </Box>

              {selectionCandidatesFiltered.length === 0 ? (
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 2.5,
                    border: '1px dashed rgba(20,184,166,0.38)',
                    bgcolor: 'rgba(6,95,70,0.18)',
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ color: '#e2e8f0', fontWeight: 700, mb: 0.5 }}>
                    Ingen kandidater klare for utvelgelse enda
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.75)' }}>
                    Legg inn audition-notater eller planlegg auditions for å aktivere screening.
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    ...(selectionBoardMode ? { flex: 1, minHeight: 0 } : {}),
                  }}
                >
                  {selectionBoardMode ? (
                    <Box
                      sx={{
                        p: { xs: 1.2, sm: 1.45 },
                        borderRadius: 2.3,
                        border: '1px solid rgba(56,189,248,0.42)',
                        background:
                          'radial-gradient(circle at 50% 0%, rgba(56,189,248,0.18), transparent 42%), linear-gradient(180deg, rgba(2,6,23,0.92), rgba(2,8,16,0.96))',
                        boxShadow: '0 14px 40px rgba(2,6,23,0.6)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.15,
                        flex: 1,
                        minHeight: 0,
                      }}
                    >
                      {!selectedSelectionCandidate || !selectedSelectionSummary ? (
                        <Box
                          sx={{
                            p: 2.2,
                            borderRadius: 2,
                            border: '1px dashed rgba(56,189,248,0.45)',
                            bgcolor: 'rgba(15,23,42,0.74)',
                            textAlign: 'center',
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography sx={{ color: '#e0f2fe', fontWeight: 700, mb: 0.4 }}>
                            Board er klart
                          </Typography>
                          <Typography sx={{ color: 'rgba(186,230,253,0.86)', fontSize: '0.84rem' }}>
                            Velg en kandidat for å starte gjennomgang av self-tapes og notater.
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.15, flex: 1, minHeight: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Button size="small" variant="outlined" onClick={() => handleStepSelectionCandidate(-1)} startIcon={<NavigateBeforeIcon />} sx={{ textTransform: 'none', borderRadius: 999, color: '#e0f2fe' }}>
                              Forrige
                            </Button>
                            <Chip
                              size="small"
                              icon={<ViewCarouselIcon sx={{ color: '#bae6fd !important', fontSize: 14 }} />}
                              label={`Kandidat ${Math.max(selectedSelectionCandidateIndex + 1, 1)} av ${selectionCandidatesFiltered.length}`}
                              sx={{ bgcolor: 'rgba(14,116,144,0.22)', color: '#bae6fd', border: '1px solid rgba(125,211,252,0.44)', fontWeight: 700 }}
                            />
                            <Button size="small" variant="outlined" onClick={() => handleStepSelectionCandidate(1)} endIcon={<NavigateNextIcon />} sx={{ textTransform: 'none', borderRadius: 999, color: '#e0f2fe' }}>
                              Neste
                            </Button>
                          </Box>

                          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.2, flex: 1, minHeight: 0 }}>
                            <Box sx={{ flex: { xs: '1 1 auto', md: '1 1 68%' }, p: 1.1, borderRadius: 1.8, border: '1px solid rgba(56,189,248,0.3)', bgcolor: 'rgba(2,6,23,0.6)', display: 'flex', flexDirection: 'column', gap: 0.8, minHeight: 0 }}>
                              <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                                {selectedSelectionActiveSelfTape ? (
                                  <Box
                                    component="video"
                                    src={selectedSelectionActiveSelfTape}
                                    controls
                                    preload="metadata"
                                    sx={{
                                      width: '100%',
                                      aspectRatio: '16 / 9',
                                      borderRadius: 1.6,
                                      bgcolor: '#000',
                                      border: '1px solid rgba(56,189,248,0.34)',
                                      display: 'block',
                                    }}
                                  />
                                ) : (
                                  <Box
                                    sx={{
                                      width: '100%',
                                      aspectRatio: '16 / 9',
                                      borderRadius: 1.6,
                                      border: '1px dashed rgba(56,189,248,0.42)',
                                      bgcolor: 'rgba(15,23,42,0.74)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      textAlign: 'center',
                                      p: 2,
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <Typography sx={{ color: 'rgba(186,230,253,0.86)', fontSize: '0.82rem', maxWidth: 420 }}>
                                      Ingen self-tape registrert. Legg video på kandidaten for komplett gjennomgang.
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.92rem', lineHeight: 1.2, textAlign: 'left' }}>
                                {selectedSelectionCandidate.name}
                              </Typography>
                              {selectedSelectionCandidateSelfTapes.length > 1 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.55 }}>
                                  {selectedSelectionCandidateSelfTapes.slice(0, 8).map((_, tapeIndex) => (
                                    <Button
                                      key={`board-tape-${selectedSelectionCandidate.id}-${tapeIndex}`}
                                      size="small"
                                      variant={selectedSelectionCandidateSelfTapeIndex === tapeIndex ? 'contained' : 'outlined'}
                                      onClick={() => handleSetSelectionSelfTapeIndex(selectedSelectionCandidate.id, tapeIndex)}
                                      sx={{ minWidth: 'auto', borderRadius: 999, textTransform: 'none', fontWeight: 700, px: 0.95, py: 0.2, fontSize: '0.68rem' }}
                                    >
                                      Tape {tapeIndex + 1}
                                    </Button>
                                  ))}
                                </Box>
                              )}
                            </Box>

                            <Box sx={{ flex: { xs: '1 1 auto', md: '1 1 32%' }, p: 1.05, borderRadius: 1.8, border: '1px solid rgba(148,163,184,0.24)', bgcolor: 'rgba(15,23,42,0.66)', display: 'flex', flexDirection: 'column', gap: 0.8, minHeight: 0, overflow: 'auto' }}>
                              {renderSelectionMeetPlannerCard(true)}
                              <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.82rem' }}>
                                Audition-notater
                              </Typography>
                              <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                                {selectedSelectionSummary.notes.trim() || 'Ingen detaljerte notater registrert.'}
                              </Typography>
                              <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.67rem' }}>
                                Skrevet av (audition): {selectedAuditionNotesMeta.author}
                                {selectedAuditionNotesMeta.updatedAt ? ` • ${selectedAuditionNotesMeta.updatedAt}` : ''}
                              </Typography>

                              <Divider sx={{ borderColor: 'rgba(148,163,184,0.24)' }} />

                              <Typography sx={{ color: '#bae6fd', fontWeight: 700, fontSize: '0.8rem' }}>
                                Utvelgelsesnotater
                              </Typography>
                              <Box
                                sx={{
                                  '& > .MuiBox-root': {
                                    borderColor: 'rgba(56,189,248,0.24)',
                                    bgcolor: 'rgba(2,6,23,0.52)',
                                  },
                                  '& > .MuiBox-root:focus-within': {
                                    borderColor: 'rgba(56,189,248,0.8)',
                                  },
                                  '& .tiptap': {
                                    color: '#e2e8f0',
                                    fontSize: '0.82rem',
                                    lineHeight: 1.55,
                                    minHeight: { xs: 120, md: 140 },
                                    p: 1.35,
                                  },
                                  '& .tiptap p.is-editor-empty:first-of-type::before': {
                                    color: 'rgba(186,230,253,0.62)',
                                  },
                                  '& .MuiIconButton-root': {
                                    color: '#bae6fd',
                                  },
                                }}
                              >
                                <RichTextEditor
                                  value={toRichTextContent(selectionNotesDraft)}
                                  onChange={setSelectionNotesDraft}
                                  placeholder="Skriv ekstra notater fra utvelgelsen her..."
                                  minHeight={{ xs: 120, md: 140 }}
                                  accentColor="#38bdf8"
                                />
                              </Box>
                              {selectionAutoTagChips.length > 0 && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                                  <Typography sx={{ color: 'rgba(125,211,252,0.95)', fontSize: '0.66rem', fontWeight: 700 }}>
                                    Taggede personer
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                                    {selectionAutoTagChips.map((name) => (
                                      <Chip
                                        key={`selection-tag-chip-board-${name}`}
                                        label={`@${name}`}
                                        size="small"
                                        onDelete={() => handleRemoveSelectionAutoTag(name)}
                                        sx={{
                                          height: 22,
                                          color: '#bae6fd',
                                          bgcolor: 'rgba(14,116,144,0.2)',
                                          border: '1px solid rgba(56,189,248,0.36)',
                                          '& .MuiChip-deleteIcon': { color: 'rgba(186,230,253,0.9)' },
                                        }}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              )}
                              {selectionDidYouMeanSuggestions.length > 0 && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                                  <Typography sx={{ color: 'rgba(251,191,36,0.95)', fontSize: '0.66rem', fontWeight: 700 }}>
                                    Mener du?
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                                    {selectionDidYouMeanSuggestions.map((name) => (
                                      <Chip
                                        key={`selection-did-you-mean-board-${name}`}
                                        label={name}
                                        size="small"
                                        clickable
                                        onClick={() => handleApplySelectionSuggestion(name)}
                                        sx={{
                                          height: 22,
                                          color: '#fde68a',
                                          bgcolor: 'rgba(120,53,15,0.28)',
                                          border: '1px solid rgba(251,191,36,0.45)',
                                        }}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              )}
                              <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.67rem' }}>
                                Skrevet av (utvelgelse): {selectedSelectionNotesMeta.author}
                                {selectedSelectionNotesMeta.updatedAt ? ` • ${selectedSelectionNotesMeta.updatedAt}` : ''}
                              </Typography>
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={selectionNotesSaving ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 14 }} />}
                                disabled={selectionNotesSaving || !selectionNotesHasChanges}
                                onClick={() => {
                                  void handleSaveSelectionNotes();
                                }}
                                sx={{
                                  alignSelf: 'flex-start',
                                  textTransform: 'none',
                                  borderRadius: 999,
                                  fontWeight: 700,
                                  px: 1.25,
                                  py: 0.35,
                                  background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)',
                                  color: '#ecfeff',
                                }}
                              >
                                Lagre utvelgelsesnotat
                              </Button>
                            </Box>
                          </Box>

                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                            {([
                              ['screening', 'Til screening', '#38bdf8'],
                              ['callbacks', 'Send til callbacks', '#c084fc'],
                              ['final', 'Marker som finalist', '#34d399'],
                            ] as const).map(([stage, label, color]) => {
                              const isCurrentStage = selectedSelectionSummary.phase === stage;
                              return (
                                <Button
                                  key={`board-stage-${stage}`}
                                  size="small"
                                  variant={isCurrentStage ? 'contained' : 'outlined'}
                                  disabled={isCurrentStage}
                                  onClick={() => handleMoveCandidateToSelectionStage(selectedSelectionCandidate, stage)}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    borderRadius: 999,
                                    px: 1.25,
                                    borderColor: alpha(color, 0.45),
                                    color: isCurrentStage ? '#001018' : color,
                                    bgcolor: isCurrentStage ? alpha(color, 0.88) : 'transparent',
                                  }}
                                >
                                  {label}
                                </Button>
                              );
                            })}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', xl: 'row' }, gap: 1.2 }}>
                        <Box
                          sx={{
                            flex: { xs: '1 1 auto', xl: '1 1 62%' },
                            p: 1.15,
                            borderRadius: 1.8,
                            border: '1px solid rgba(20,184,166,0.3)',
                            bgcolor: 'rgba(2,6,23,0.58)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.9,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Typography sx={{ color: '#99f6e4', fontWeight: 700, fontSize: '0.8rem' }}>
                              Standardvisning
                            </Typography>
                            <Typography sx={{ color: 'rgba(153,246,228,0.78)', fontSize: '0.67rem', fontWeight: 600 }}>
                              Klikk kort for full vurdering
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.85 }}>
                            {selectionCandidatesFiltered.map((candidate) => {
                              const score = getCandidateSelectionScore(candidate);
                              const readiness = getSelectionReadiness(score);
                              const phase = getCandidateSelectionStage(candidate);
                              const isActive = selectedSelectionCandidateId === candidate.id;
                              const isCompared = selectionCompareCandidateIds.includes(candidate.id);
                              const auditionCount = auditionSchedulesByCandidate.get(candidate.id)?.length || 0;
                              const candidatePhoto = getCandidatePrimaryPhoto(candidate);
                              const assignedRoleIds = getCandidateAssignedRoles(candidate);
                              const assignedRoleNames = assignedRoleIds
                                .map((roleId) => roles.find((role) => role.id === roleId)?.name)
                                .filter((value): value is string => Boolean(value));
                              const roleLabel = assignedRoleNames[0] || 'Ingen rolle valgt';
                              const notePreview = getCandidateAuditionNotes(candidate).trim() || 'Ingen audition-notater.';

                              return (
                                <Box
                                  key={`selection-standard-${candidate.id}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    startTransition(() => setSelectedSelectionCandidateId(candidate.id));
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      startTransition(() => setSelectedSelectionCandidateId(candidate.id));
                                    }
                                  }}
                                  sx={{
                                    flex: { xs: '1 1 100%', md: '1 1 calc(50% - 6px)' },
                                    minWidth: 0,
                                    borderRadius: 1.5,
                                    border: isActive ? '1px solid rgba(94,234,212,0.84)' : '1px solid rgba(148,163,184,0.26)',
                                    bgcolor: isActive ? 'rgba(6,95,70,0.33)' : 'rgba(15,23,42,0.66)',
                                    p: 0.8,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.62,
                                    cursor: 'pointer',
                                    transition: 'all 0.18s ease',
                                    '&:hover': {
                                      borderColor: 'rgba(94,234,212,0.66)',
                                      bgcolor: isActive ? 'rgba(6,95,70,0.4)' : 'rgba(30,41,59,0.76)',
                                      transform: 'translateY(-1px)',
                                    },
                                  }}
                                >
                                  <Box sx={{ position: 'relative', width: '100%', borderRadius: 1.15, overflow: 'hidden', border: '1px solid rgba(56,189,248,0.24)', bgcolor: 'rgba(2,6,23,0.9)', minHeight: 86 }}>
                                    {candidatePhoto ? (
                                      <Box
                                        component="img"
                                        src={candidatePhoto}
                                        alt={`${candidate.name} profilbilde`}
                                        sx={{ width: '100%', height: 86, objectFit: 'cover', display: 'block' }}
                                      />
                                    ) : (
                                      <Box sx={{ width: '100%', height: 86, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(15,23,42,0.86)' }}>
                                        <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.68rem', fontWeight: 700 }}>
                                          Ingen bilde
                                        </Typography>
                                      </Box>
                                    )}
                                    <Chip
                                      size="small"
                                      label={`Score ${score}`}
                                      sx={{
                                        position: 'absolute',
                                        top: 6,
                                        left: 6,
                                        height: 20,
                                        fontSize: '0.63rem',
                                        fontWeight: 800,
                                        bgcolor: 'rgba(2,6,23,0.84)',
                                        color: '#dbeafe',
                                        border: '1px solid rgba(125,211,252,0.45)',
                                      }}
                                    />
                                  </Box>

                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.55 }}>
                                    <Typography sx={{ color: '#fff', fontSize: '0.83rem', fontWeight: 700, lineHeight: 1.2 }}>
                                      {candidate.name}
                                    </Typography>
                                    <Chip
                                      size="small"
                                      label={phase === 'final' ? 'Final selection' : phase === 'callbacks' ? 'Callbacks' : 'Screening'}
                                      sx={{
                                        height: 19,
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        bgcolor:
                                          phase === 'final'
                                            ? 'rgba(16,185,129,0.22)'
                                            : phase === 'callbacks'
                                              ? 'rgba(192,132,252,0.2)'
                                              : 'rgba(56,189,248,0.22)',
                                        color:
                                          phase === 'final'
                                            ? '#6ee7b7'
                                            : phase === 'callbacks'
                                              ? '#d8b4fe'
                                              : '#7dd3fc',
                                        border: '1px solid rgba(148,163,184,0.32)',
                                      }}
                                    />
                                  </Box>

                                  <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.66rem' }}>
                                    {roleLabel}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(226,232,240,0.84)', fontSize: '0.67rem', lineHeight: 1.3 }}>
                                    {notePreview.slice(0, 108)}
                                    {notePreview.length > 108 ? '...' : ''}
                                  </Typography>

                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.6 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55, flexWrap: 'wrap' }}>
                                      <Chip
                                        size="small"
                                        label={readiness.label}
                                        sx={{
                                          height: 19,
                                          fontSize: '0.61rem',
                                          fontWeight: 700,
                                          bgcolor: readiness.bgcolor,
                                          color: readiness.color,
                                          border: readiness.border,
                                        }}
                                      />
                                      <Chip
                                        size="small"
                                        label={`${auditionCount} auditions`}
                                        sx={{
                                          height: 19,
                                          fontSize: '0.6rem',
                                          fontWeight: 700,
                                          bgcolor: 'rgba(14,165,233,0.2)',
                                          color: '#7dd3fc',
                                          border: '1px solid rgba(56,189,248,0.44)',
                                        }}
                                      />
                                    </Box>
                                    <Button
                                      size="small"
                                      variant={isCompared ? 'contained' : 'outlined'}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleToggleSelectionCompare(candidate);
                                      }}
                                      sx={{
                                        minWidth: 'auto',
                                        px: 0.9,
                                        py: 0.15,
                                        textTransform: 'none',
                                        borderRadius: 999,
                                        fontSize: '0.63rem',
                                        fontWeight: 700,
                                        borderColor: 'rgba(148,163,184,0.46)',
                                        color: isCompared ? '#0f172a' : 'rgba(226,232,240,0.88)',
                                        bgcolor: isCompared ? 'rgba(186,230,253,0.92)' : 'transparent',
                                      }}
                                    >
                                      {isCompared ? 'Sammenlignes' : 'Sammenlign'}
                                    </Button>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>

                        <Box
                          sx={{
                            flex: { xs: '1 1 auto', xl: '1 1 38%' },
                            p: 1.1,
                            borderRadius: 1.8,
                            border: '1px solid rgba(56,189,248,0.28)',
                            bgcolor: 'rgba(15,23,42,0.62)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.8,
                          }}
                        >
                          {!selectedSelectionCandidate || !selectedSelectionSummary ? (
                            <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.82rem' }}>
                              Velg en kandidat for detaljer.
                            </Typography>
                          ) : (
                            <>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.7 }}>
                                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>
                                  {selectedSelectionCandidate.name}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={selectedSelectionSummary.phase === 'final' ? 'Final selection' : selectedSelectionSummary.phase === 'callbacks' ? 'Callbacks' : 'Screening'}
                                  sx={{
                                    height: 20,
                                    fontSize: '0.63rem',
                                    fontWeight: 700,
                                    bgcolor:
                                      selectedSelectionSummary.phase === 'final'
                                        ? 'rgba(16,185,129,0.22)'
                                        : selectedSelectionSummary.phase === 'callbacks'
                                          ? 'rgba(192,132,252,0.2)'
                                          : 'rgba(56,189,248,0.2)',
                                    color:
                                      selectedSelectionSummary.phase === 'final'
                                        ? '#6ee7b7'
                                        : selectedSelectionSummary.phase === 'callbacks'
                                          ? '#d8b4fe'
                                          : '#7dd3fc',
                                    border: '1px solid rgba(148,163,184,0.3)',
                                  }}
                                />
                              </Box>

                              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.6 }}>
                                <Chip
                                  size="small"
                                  label={`Score ${selectedSelectionScore}/100`}
                                  sx={{
                                    height: 20,
                                    fontSize: '0.62rem',
                                    fontWeight: 800,
                                    bgcolor: 'rgba(15,118,110,0.28)',
                                    color: '#99f6e4',
                                    border: '1px solid rgba(45,212,191,0.45)',
                                  }}
                                />
                                <Chip
                                  size="small"
                                  label={selectedSelectionReadiness.label}
                                  sx={{
                                    height: 20,
                                    fontSize: '0.61rem',
                                    fontWeight: 700,
                                    bgcolor: selectedSelectionReadiness.bgcolor,
                                    color: selectedSelectionReadiness.color,
                                    border: selectedSelectionReadiness.border,
                                  }}
                                />
                                <Chip
                                  size="small"
                                  label={`${selectedSelectionCandidateSchedules.length} auditions`}
                                  sx={{
                                    height: 20,
                                    fontSize: '0.61rem',
                                    fontWeight: 700,
                                    bgcolor: 'rgba(14,165,233,0.2)',
                                    color: '#7dd3fc',
                                    border: '1px solid rgba(56,189,248,0.44)',
                                  }}
                                />
                              </Box>

                              <Box
                                sx={{
                                  width: '100%',
                                  borderRadius: 1.35,
                                  border: '1px solid rgba(56,189,248,0.24)',
                                  overflow: 'hidden',
                                  minHeight: { xs: 220, md: 300 },
                                  bgcolor: 'rgba(2,6,23,0.82)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {selectedSelectionCandidatePhoto ? (
                                  <Box
                                    component="img"
                                    src={selectedSelectionCandidatePhoto}
                                    alt={`${selectedSelectionCandidate.name} profilbilde`}
                                    sx={{ width: '100%', height: '100%', minHeight: { xs: 220, md: 300 }, objectFit: 'cover', display: 'block' }}
                                  />
                                ) : (
                                  <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.72rem', fontWeight: 700 }}>
                                    Ingen bilde tilgjengelig
                                  </Typography>
                                )}
                              </Box>

                              <Button
                                fullWidth
                                variant="contained"
                                onClick={() => {
                                  startTransition(() => setSelectionBoardMode(true));
                                }}
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: 1.2,
                                  fontWeight: 800,
                                  py: 0.8,
                                  background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)',
                                  color: '#ecfeff',
                                  border: '1px solid rgba(125,211,252,0.45)',
                                  '&:hover': {
                                    background: 'linear-gradient(135deg, #0284c7, #0f766e)',
                                  },
                                }}
                              >
                                Se self-tape i Casting board
                              </Button>
                              {!selectedSelectionActiveSelfTape && (
                                <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.67rem' }}>
                                  Ingen self-tape registrert på kandidaten ennå.
                                </Typography>
                              )}
                              {selectedSelectionCandidateSelfTapes.length > 1 && (
                                <Typography sx={{ color: 'rgba(125,211,252,0.9)', fontSize: '0.66rem', fontWeight: 600 }}>
                                  {selectedSelectionCandidateSelfTapes.length} self-tapes tilgjengelig
                                </Typography>
                              )}

                              {selectedSelectionSignals && (
                                <Box
                                  sx={{
                                    borderRadius: 1.3,
                                    border: '1px solid rgba(56,189,248,0.24)',
                                    bgcolor: 'rgba(2,6,23,0.65)',
                                    p: 0.78,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.42,
                                  }}
                                >
                                  <Typography sx={{ color: '#bae6fd', fontWeight: 700, fontSize: '0.69rem', mb: 0.1 }}>
                                    Vurderingssignal
                                  </Typography>
                                  {([
                                    ['Sceneleveranse', selectedSelectionSignals.scenePerformance, '#22d3ee'],
                                    ['Kjemi', selectedSelectionSignals.chemistry, '#c084fc'],
                                    ['Tilgjengelighet', selectedSelectionSignals.availability, '#4ade80'],
                                    ['Risiko', selectedSelectionSignals.risk, '#fb7185'],
                                  ] as const).map(([label, value, color]) => (
                                    <Box key={`signal-${label}`} sx={{ display: 'flex', flexDirection: 'column', gap: 0.18 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.45 }}>
                                        <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.65rem' }}>{label}</Typography>
                                        <Typography sx={{ color, fontSize: '0.63rem', fontWeight: 700 }}>{value}</Typography>
                                      </Box>
                                      <Box sx={{ width: '100%', height: 4.5, borderRadius: 999, bgcolor: 'rgba(51,65,85,0.66)', overflow: 'hidden' }}>
                                        <Box sx={{ width: `${value}%`, height: '100%', borderRadius: 999, bgcolor: color }} />
                                      </Box>
                                    </Box>
                                  ))}
                                </Box>
                              )}

                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.55 }}>
                                {([
                                  ['screening', 'Til screening', '#38bdf8'],
                                  ['callbacks', 'Send til callbacks', '#c084fc'],
                                  ['final', 'Marker som finalist', '#34d399'],
                                ] as const).map(([stage, label, color]) => {
                                  const isCurrentStage = selectedSelectionSummary.phase === stage;
                                  return (
                                    <Button
                                      key={`standard-stage-${stage}`}
                                      size="small"
                                      variant={isCurrentStage ? 'contained' : 'outlined'}
                                      disabled={isCurrentStage}
                                      onClick={() => handleMoveCandidateToSelectionStage(selectedSelectionCandidate, stage)}
                                      sx={{
                                        textTransform: 'none',
                                        fontWeight: 700,
                                        borderRadius: 999,
                                        px: 1,
                                        borderColor: alpha(color, 0.45),
                                        color: isCurrentStage ? '#001018' : color,
                                        bgcolor: isCurrentStage ? alpha(color, 0.88) : 'transparent',
                                      }}
                                    >
                                      {label}
                                    </Button>
                                  );
                                })}
                              </Box>

                              {renderSelectionMeetPlannerCard(false)}

                              <Box sx={{ borderRadius: 1.25, border: '1px solid rgba(148,163,184,0.24)', bgcolor: 'rgba(15,23,42,0.56)', p: 0.7 }}>
                                <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.69rem', mb: 0.35 }}>
                                  Audition-notater
                                </Typography>
                                <Typography sx={{ color: 'rgba(226,232,240,0.84)', fontSize: '0.69rem', lineHeight: 1.4 }}>
                                  {selectedSelectionSummary.notes.trim() || 'Ingen detaljerte notater registrert.'}
                                </Typography>
                                <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.63rem', mt: 0.35 }}>
                                  Skrevet av (audition): {selectedAuditionNotesMeta.author}
                                  {selectedAuditionNotesMeta.updatedAt ? ` • ${selectedAuditionNotesMeta.updatedAt}` : ''}
                                </Typography>
                              </Box>

                              <Box sx={{ borderRadius: 1.25, border: '1px solid rgba(56,189,248,0.3)', bgcolor: 'rgba(2,6,23,0.6)', p: 0.7, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography sx={{ color: '#7dd3fc', fontWeight: 700, fontSize: '0.69rem' }}>
                                  Utvelgelsesnotater
                                </Typography>
                                <Box
                                  sx={{
                                    '& > .MuiBox-root': {
                                      borderColor: 'rgba(56,189,248,0.24)',
                                      bgcolor: 'rgba(15,23,42,0.58)',
                                    },
                                    '& > .MuiBox-root:focus-within': {
                                      borderColor: 'rgba(56,189,248,0.8)',
                                    },
                                    '& .tiptap': {
                                      color: '#e2e8f0',
                                      fontSize: '0.76rem',
                                      lineHeight: 1.52,
                                      minHeight: { xs: 110, md: 130 },
                                      p: 1.2,
                                    },
                                    '& .tiptap p.is-editor-empty:first-of-type::before': {
                                      color: 'rgba(186,230,253,0.6)',
                                    },
                                    '& .MuiIconButton-root': {
                                      color: '#bae6fd',
                                    },
                                  }}
                                >
                                  <RichTextEditor
                                    value={toRichTextContent(selectionNotesDraft)}
                                    onChange={setSelectionNotesDraft}
                                    placeholder="Skriv ekstra notater for utvelgelse..."
                                    minHeight={{ xs: 110, md: 130 }}
                                    accentColor="#38bdf8"
                                  />
                                </Box>
                                {selectionAutoTagChips.length > 0 && (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.38 }}>
                                    <Typography sx={{ color: 'rgba(125,211,252,0.95)', fontSize: '0.64rem', fontWeight: 700 }}>
                                      Taggede personer
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.35 }}>
                                      {selectionAutoTagChips.map((name) => (
                                        <Chip
                                          key={`selection-tag-chip-standard-${name}`}
                                          label={`@${name}`}
                                          size="small"
                                          onDelete={() => handleRemoveSelectionAutoTag(name)}
                                          sx={{
                                            height: 21,
                                            color: '#bae6fd',
                                            bgcolor: 'rgba(14,116,144,0.2)',
                                            border: '1px solid rgba(56,189,248,0.36)',
                                            '& .MuiChip-deleteIcon': { color: 'rgba(186,230,253,0.9)' },
                                          }}
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                )}
                                {selectionDidYouMeanSuggestions.length > 0 && (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                                    <Typography sx={{ color: 'rgba(251,191,36,0.95)', fontSize: '0.64rem', fontWeight: 700 }}>
                                      Mener du?
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.35 }}>
                                      {selectionDidYouMeanSuggestions.map((name) => (
                                        <Chip
                                          key={`selection-did-you-mean-standard-${name}`}
                                          label={name}
                                          size="small"
                                          clickable
                                          onClick={() => handleApplySelectionSuggestion(name)}
                                          sx={{
                                            height: 21,
                                            color: '#fde68a',
                                            bgcolor: 'rgba(120,53,15,0.28)',
                                            border: '1px solid rgba(251,191,36,0.45)',
                                          }}
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                )}
                                <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.63rem' }}>
                                  Skrevet av (utvelgelse): {selectedSelectionNotesMeta.author}
                                  {selectedSelectionNotesMeta.updatedAt ? ` • ${selectedSelectionNotesMeta.updatedAt}` : ''}
                                </Typography>
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={selectionNotesSaving ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 14 }} />}
                                  disabled={selectionNotesSaving || !selectionNotesHasChanges}
                                  onClick={() => {
                                    void handleSaveSelectionNotes();
                                  }}
                                  sx={{
                                    alignSelf: 'flex-start',
                                    textTransform: 'none',
                                    borderRadius: 999,
                                    fontWeight: 700,
                                    px: 1.1,
                                    py: 0.3,
                                    background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)',
                                    color: '#ecfeff',
                                  }}
                                >
                                  Lagre utvelgelsesnotat
                                </Button>
                              </Box>

                              <Box sx={{ borderRadius: 1.25, border: '1px solid rgba(34,197,94,0.3)', bgcolor: 'rgba(6,78,59,0.22)', p: 0.7 }}>
                                <Typography sx={{ color: '#86efac', fontWeight: 700, fontSize: '0.69rem', mb: 0.35 }}>
                                  Hva var bra
                                </Typography>
                                {selectedSelectionSummary.strengths.length === 0 ? (
                                  <Typography sx={{ color: 'rgba(134,239,172,0.86)', fontSize: '0.68rem' }}>
                                    Ingen styrker registrert ennå.
                                  </Typography>
                                ) : (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.22 }}>
                                    {selectedSelectionSummary.strengths.slice(0, 4).map((item, index) => (
                                      <Typography key={`strength-${index}`} sx={{ color: 'rgba(134,239,172,0.9)', fontSize: '0.67rem', lineHeight: 1.35 }}>
                                        • {item}
                                      </Typography>
                                    ))}
                                  </Box>
                                )}
                              </Box>

                              <Box sx={{ borderRadius: 1.25, border: '1px solid rgba(251,113,133,0.3)', bgcolor: 'rgba(127,29,29,0.2)', p: 0.7 }}>
                                <Typography sx={{ color: '#fda4af', fontWeight: 700, fontSize: '0.69rem', mb: 0.35 }}>
                                  Hva var svakt / risiko
                                </Typography>
                                {selectedSelectionSummary.risks.length === 0 ? (
                                  <Typography sx={{ color: 'rgba(253,164,175,0.88)', fontSize: '0.68rem' }}>
                                    Ingen tydelige risikoflagg.
                                  </Typography>
                                ) : (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.22 }}>
                                    {selectedSelectionSummary.risks.slice(0, 4).map((item, index) => (
                                      <Typography key={`risk-${index}`} sx={{ color: 'rgba(253,164,175,0.9)', fontSize: '0.67rem', lineHeight: 1.35 }}>
                                        • {item}
                                      </Typography>
                                    ))}
                                  </Box>
                                )}
                              </Box>

                              <Box sx={{ borderRadius: 1.25, border: '1px solid rgba(56,189,248,0.3)', bgcolor: 'rgba(3,37,65,0.3)', p: 0.7 }}>
                                <Typography sx={{ color: '#7dd3fc', fontWeight: 700, fontSize: '0.69rem', mb: 0.2 }}>
                                  Anbefalt neste steg
                                </Typography>
                                <Typography sx={{ color: 'rgba(186,230,253,0.92)', fontSize: '0.69rem', lineHeight: 1.35 }}>
                                  {selectedSelectionSummary.recommendation}
                                </Typography>
                              </Box>

                              <Box sx={{ borderRadius: 1.25, border: '1px solid rgba(148,163,184,0.24)', bgcolor: 'rgba(2,6,23,0.64)', p: 0.7 }}>
                                <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.69rem', mb: 0.28 }}>
                                  Beslutningslogg
                                </Typography>
                                {selectedSelectionDecisionLog.length === 0 ? (
                                  <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.67rem' }}>
                                    Ingen beslutningshendelser registrert ennå.
                                  </Typography>
                                ) : (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.26 }}>
                                    {selectedSelectionDecisionLog.slice(0, 5).map((entry) => (
                                      <Box key={entry.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.05 }}>
                                        <Typography sx={{ color: '#cbd5e1', fontSize: '0.65rem', lineHeight: 1.3 }}>
                                          {entry.action}
                                        </Typography>
                                        <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.6rem', lineHeight: 1.2 }}>
                                          {entry.actor} • {new Date(entry.createdAt).toLocaleString('no-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Box>
                                )}
                              </Box>
                            </>
                          )}
                        </Box>
                      </Box>

                      {selectionCompareCandidates.length > 1 && (
                        <Box
                          sx={{
                            p: 0.95,
                            borderRadius: 1.7,
                            border: '1px solid rgba(192,132,252,0.3)',
                            bgcolor: 'rgba(46,16,101,0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.68,
                          }}
                        >
                          <Typography sx={{ color: '#e9d5ff', fontWeight: 700, fontSize: '0.74rem' }}>
                            Side-by-side sammenligning ({selectionCompareCandidates.length})
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
                            {selectionCompareCandidates.map((candidate) => {
                              const signals = getCandidateSelectionSignals(candidate);
                              const score = getCandidateSelectionScore(candidate);
                              const readiness = getSelectionReadiness(score);
                              return (
                                <Box
                                  key={`selection-compare-${candidate.id}`}
                                  sx={{
                                    flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 6px)' },
                                    minWidth: 0,
                                    borderRadius: 1.25,
                                    border: '1px solid rgba(216,180,254,0.32)',
                                    bgcolor: 'rgba(30,41,59,0.62)',
                                    p: 0.7,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.32,
                                  }}
                                >
                                  <Typography sx={{ color: '#fff', fontSize: '0.73rem', fontWeight: 700, lineHeight: 1.2 }}>
                                    {candidate.name}
                                  </Typography>
                                  <Typography sx={{ color: readiness.color, fontSize: '0.63rem', fontWeight: 700 }}>
                                    {readiness.label} • {score}/100
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.62rem' }}>
                                    Scene: {signals.scenePerformance} • Kjemi: {signals.chemistry}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.62rem' }}>
                                    Tilgjengelighet: {signals.availability} • Risiko: {signals.risk}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={TEAM_TAB_INDEX}>
          {!currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : !permissions.canManageCrew ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noAccessTeam}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Crew Role Legend */}
              {currentProject.crew && currentProject.crew.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 2, pt: 1 }}>
                  {Array.from(new Set(currentProject.crew.map(c => c.role))).map(role => (
                    <Chip
                      key={role}
                      icon={getCrewRoleIcon(role)}
                      label={role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.87)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        '& .MuiChip-icon': { color: 'rgba(255,255,255,0.7)' },
                      }}
                    />
                  ))}
                </Box>
              )}
              <CrewManagementPanel
                key={currentProject.id}
                projectId={currentProject.id}
                onUpdate={async () => {
                  const updated = await castingService.getProject(currentProject.id);
                  if (updated) setCurrentProject(updated);
                }}
                profession={profession}
                onOpenTechnicalTeamDashboard={handleOpenTechnicalTeamDashboard}
                productionDays={currentProject.productionDays || []}
                scenes={currentProject.sceneBreakdowns || []}
                externalCreateSignal={externalCrewCreateSignal}
                onExternalCreated={handleExternalCrewCreated}
                onExternalCreateCancelled={handleExternalCrewCreateCancelled}
              />
            </Box>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={LOCATIONS_TAB_INDEX}>
          {!currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: branding.colors.textPrimary }}>
              <Typography
                variant="body1"
                sx={{
                  fontSize: { xs: '0.875rem', sm: '0.95rem', md: '1rem', lg: '1.1rem', xl: '1.15rem' },
                  '@media (min-width: 2048px)': { fontSize: '1.25rem' },
                  '@media (min-width: 3840px)': { fontSize: '1.4rem' },
                  '@media (min-width: 5120px)': { fontSize: '1.5rem' },
                }}
              >
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : !permissions.canManageLocations ? (
            <Box sx={{ p: 3, textAlign: 'center', color: branding.colors.textPrimary }}>
              <Typography
                variant="body1"
                sx={{
                  fontSize: { xs: '0.875rem', sm: '0.95rem', md: '1rem', lg: '1.1rem', xl: '1.15rem' },
                  '@media (min-width: 2048px)': { fontSize: '1.25rem' },
                  '@media (min-width: 3840px)': { fontSize: '1.4rem' },
                  '@media (min-width: 5120px)': { fontSize: '1.5rem' },
                }}
              >
                {branding.tokens.labels.noAccessLocations}
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                width: '100%',
                mx: 'auto',
                maxWidth: { xs: '100%', lg: 1560, xl: 1880 },
                borderRadius: 2,
                border: `1px solid ${branding.colors.border}`,
                background: `linear-gradient(180deg, ${branding.colors.surface} 0%, ${branding.colors.background} 100%)`,
                p: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 2 },
                '@media (min-width: 1024px)': {
                  p: 1.5,
                },
                '@media (min-width: 2048px)': {
                  maxWidth: 2200,
                  p: 2.25,
                  borderRadius: 2.5,
                },
                '@media (min-width: 3840px)': {
                  maxWidth: 3300,
                  p: 2.75,
                  borderRadius: 3,
                },
                '@media (min-width: 5120px)': {
                  maxWidth: 4300,
                  p: 3.25,
                  borderRadius: 3.5,
                },
                '& .MuiPaper-root, & .MuiCard-root': {
                  background: `${branding.colors.surface}cc`,
                  borderColor: branding.colors.border,
                  color: branding.colors.textPrimary,
                },
                '& .MuiTypography-root': {
                  color: branding.colors.textPrimary,
                  '@media (min-width: 2048px)': { fontSize: '1.03em' },
                  '@media (min-width: 3840px)': { fontSize: '1.12em' },
                  '@media (min-width: 5120px)': { fontSize: '1.2em' },
                },
                '& .MuiTypography-colorTextSecondary': {
                  color: branding.colors.textSecondary,
                },
                '& .MuiInputBase-root': {
                  color: branding.colors.textPrimary,
                },
                '& .MuiInputLabel-root': {
                  color: branding.colors.textSecondary,
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: branding.colors.border,
                },
                '& .MuiButton-outlined': {
                  borderColor: `${branding.colors.primary}66`,
                  color: branding.colors.textPrimary,
                },
                '& .MuiButton-outlined:hover': {
                  borderColor: branding.colors.primary,
                  backgroundColor: `${branding.colors.primary}1a`,
                },
                '& .MuiButton-contained': {
                  backgroundColor: branding.colors.primary,
                  color: branding.colors.textPrimary,
                },
                '& .MuiButton-contained:hover': {
                  backgroundColor: branding.colors.secondary,
                },
                '& .MuiButton-root': {
                  '@media (min-width: 3840px)': {
                    minHeight: 44,
                    fontSize: '1rem',
                  },
                  '@media (min-width: 5120px)': {
                    minHeight: 48,
                    fontSize: '1.08rem',
                  },
                },
                '& .MuiIconButton-root': {
                  '@media (min-width: 5120px)': {
                    width: 44,
                    height: 44,
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: branding.colors.primary,
                },
                '& .MuiTab-root': {
                  color: branding.colors.textSecondary,
                },
                '& .MuiTab-root.Mui-selected': {
                  color: branding.colors.textPrimary,
                },
                '& .MuiChip-root': {
                  borderColor: branding.colors.border,
                  '@media (min-width: 3840px)': {
                    height: 32,
                  },
                  '@media (min-width: 5120px)': {
                    height: 36,
                  },
                },
                '& .MuiTableContainer-root': {
                  maxHeight: { xs: '60vh', md: '66vh', xl: '70vh' },
                  '@media (min-width: 2048px)': { maxHeight: '74vh' },
                  '@media (min-width: 3840px)': { maxHeight: '76vh' },
                },
              }}
            >
              <LocationManagementPanel
                key={currentProject.id}
                projectId={currentProject.id}
                onUpdate={async () => {
                  const updated = await castingService.getProject(currentProject.id);
                  if (updated) setCurrentProject(updated);
                }}
                externalCreateSignal={externalLocationCreateSignal}
                onExternalCreated={handleExternalLocationCreated}
                onExternalCreateCancelled={handleExternalLocationCreateCancelled}
              />
            </Box>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={EQUIPMENT_TAB_INDEX}>
          {!currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : !canManageProductionWorkspace ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noAccessEquipment}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <EquipmentManagementPanel
                key={currentProject.id}
                projectId={currentProject.id}
                onUpdate={async () => {
                  const updated = await castingService.getProject(currentProject.id);
                  if (updated) setCurrentProject(updated);
                }}
                externalCreateSignal={externalEquipmentCreateSignal}
                onExternalCreated={handleExternalEquipmentCreated}
                onExternalCreateCancelled={handleExternalEquipmentCreateCancelled}
              />
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <InventoryIcon sx={{ color: '#9333ea', fontSize: 22 }} />
                  <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                    {branding.tokens.labels.propsHeaderLabel}
                  </Typography>
                </Box>
                <PropManagementPanel
                  key={currentProject.id}
                  projectId={currentProject.id}
                  onUpdate={async () => {
                    const updated = await castingService.getProject(currentProject.id);
                    if (updated) setCurrentProject(updated);
                  }}
                />
              </Box>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={CALENDAR_TAB_INDEX}>
          {!currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : !canManageProductionWorkspace ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noAccessSchedule}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, height: '100%' }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  px: { xs: 1.5, sm: 2 },
                  py: { xs: 1.25, sm: 1.5 },
                  borderRadius: 2.5,
                  border: '1px solid rgba(148,163,184,0.24)',
                  background: 'linear-gradient(120deg, rgba(124,58,237,0.16) 0%, rgba(56,189,248,0.1) 52%, rgba(15,23,42,0.22) 100%)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                      border: '1px solid rgba(233,213,255,0.34)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px rgba(147,51,234,0.28)',
                    }}
                  >
                    <CalendarIcon sx={{ color: '#fff', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
                      Kalender
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.78)' }}>
                      Role Room produksjonsplan
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  size="small"
                  label="PRO-VISNING"
                  sx={{
                    bgcolor: 'rgba(192,132,252,0.2)',
                    color: '#f5d0fe',
                    border: '1px solid rgba(192,132,252,0.45)',
                    fontWeight: 700,
                    letterSpacing: 0.4,
                  }}
                />
              </Box>
              {/* Calendar View Toggle */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: 1, 
                p: 1,
                borderRadius: 2,
                bgcolor: 'rgba(0,0,0,0.2)',
              }}>
                <Button
                  variant={calendarViewMode === 'production' ? 'contained' : 'outlined'}
                  onClick={() => {
                    startTransition(() => setCalendarViewMode('production'));
                  }}
                  startIcon={<CalendarMonthIcon />}
                  size={isMobile ? 'small' : 'medium'}
                  sx={{
                    bgcolor: calendarViewMode === 'production' ? 'rgba(139,92,246,0.9)' : 'transparent',
                    borderColor: 'rgba(139,92,246,0.5)',
                    color: calendarViewMode === 'production' ? '#fff' : 'rgba(255,255,255,0.7)',
                    '&:hover': {
                      bgcolor: calendarViewMode === 'production' ? 'rgba(139,92,246,1)' : 'rgba(139,92,246,0.1)',
                    },
                  }}
                >
                  {branding.tokens.labels.scheduleProductionLabel}
                </Button>
                <Button
                  variant={calendarViewMode === 'crew' ? 'contained' : 'outlined'}
                  onClick={() => {
                    startTransition(() => setCalendarViewMode('crew'));
                  }}
                  startIcon={<GroupsIcon />}
                  size={isMobile ? 'small' : 'medium'}
                  sx={{
                    bgcolor: calendarViewMode === 'crew' ? 'rgba(16,185,129,0.9)' : 'transparent',
                    borderColor: 'rgba(16,185,129,0.5)',
                    color: calendarViewMode === 'crew' ? '#fff' : 'rgba(255,255,255,0.7)',
                    '&:hover': {
                      bgcolor: calendarViewMode === 'crew' ? 'rgba(16,185,129,1)' : 'rgba(16,185,129,0.1)',
                    },
                  }}
                >
                  {branding.tokens.labels.crewCalendar}
                </Button>
              </Box>

              {/* Calendar Content */}
              {calendarViewMode === 'production' ? (
                <>
                  <ProductionCalendarPanel
                    key={currentProject.id}
                    projectId={currentProject.id}
                    candidates={(currentProject.candidates || []).map((candidate) => ({
                      id: candidate.id,
                      name: candidate.name,
                    }))}
                    crew={(currentProject.crew || []).map((member) => {
                      const rawMember = member as Record<string, unknown>;
                      const nested = (rawMember.crew_data as Record<string, unknown> | undefined)
                        ?? (rawMember.crewData as Record<string, unknown> | undefined);
                      const resolvedRoleCandidates = [
                        rawMember.role,
                        rawMember.crewRole,
                        rawMember.crew_role,
                        rawMember.position,
                        rawMember.title,
                        rawMember.jobTitle,
                        rawMember.job_title,
                        nested?.role,
                        nested?.crewRole,
                        nested?.position,
                        nested?.title,
                        rawMember.department,
                      ];
                      const resolvedRole = resolvedRoleCandidates.find(
                        (value) => typeof value === 'string' && value.trim().length > 0,
                      ) as string | undefined;
                      return {
                        id: member.id,
                        name: member.name,
                        role: resolvedRole?.trim() || 'Crew-medlem',
                      };
                    })}
                    locations={(currentProject.locations || []).map((location) => ({
                      id: location.id,
                      name: location.name,
                    }))}
                    onRequestLocationCreate={handleCalendarRequestLocationCreate}
                    onRequestCandidateCreate={handleCalendarRequestCandidateCreate}
                    onRequestCrewCreate={handleCalendarRequestCrewCreate}
                    onRequestEquipmentCreate={handleCalendarRequestEquipmentCreate}
                    reopenDialogSignal={calendarReopenSignal}
                    preselectedFromCreate={calendarPreselectedFromCreate}
                  />
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                  <ProductionDayView
                    key={`${currentProject.id}:calendar-production-day`}
                    projectId={currentProject.id}
                    onUpdate={async () => {
                      const updated = await castingService.getProject(currentProject.id);
                      if (updated) setCurrentProject(updated);
                    }}
                    profession={profession}
                  />
                </>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <Suspense fallback={
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <CircularProgress sx={{ color: 'rgba(16,185,129,0.8)' }} />
                    </Box>
                  }>
                    <CrewCalendarPanel 
                      key={`${currentProject.id}:crew-calendar`}
                      projectId={currentProject.id}
                      projectName={currentProject.name}
                      crew={currentProject.crew?.map(c => ({
                        id: c.id,
                        name: c.name,
                        role: c.role,
                        department: mapRoleToDepartment(c.role),
                        avatar: '',
                        email: c.contactInfo?.email,
                        phone: c.contactInfo?.phone,
                      }))}
                      events={currentProject.productionDays?.map(pd => ({
                        id: pd.id,
                        title: `${branding.tokens.labels.productionDayLabel} - ${pd.status === 'completed'
                          ? branding.tokens.labels.productionDayStatusWrapped
                          : pd.status === 'in_progress'
                            ? branding.tokens.labels.productionDayStatusInProgress
                            : branding.tokens.labels.productionDayStatusPlanned}`,
                        description: pd.notes || `${branding.tokens.labels.productionScenesLabel} ${pd.scenes?.length || 0}`,
                        date: new Date(pd.date),
                        startTime: pd.callTime || '09:00',
                        endTime: pd.wrapTime || '17:00',
                        department: 'produksjon' as const,
                        eventType: 'shooting' as const,
                        crewIds: pd.crew || [],
                        locationName: currentProject.locations?.find(l => l.id === pd.locationId)?.name,
                        projectName: currentProject.name,
                      }))}
                    />
                  </Suspense>
                </Box>
              )}
            </Box>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={STORY_ARC_TAB_INDEX}>
          {effectiveStoryArcView === 'main' ? (
            <Box sx={{ p: { xs: 2, sm: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.5 } }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  px: { xs: 1.5, sm: 2 },
                  py: { xs: 1.25, sm: 1.5 },
                  borderRadius: 2.5,
                  border: '1px solid rgba(148,163,184,0.24)',
                  background:
                    'linear-gradient(120deg, rgba(124,58,237,0.16) 0%, rgba(56,189,248,0.1) 52%, rgba(15,23,42,0.22) 100%)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                      border: '1px solid rgba(233,213,255,0.34)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px rgba(147,51,234,0.28)',
                    }}
                  >
                    <StoryArcIcon sx={{ color: '#fff', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
                      Role Room Studio
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.78)' }}>
                      {branding.tokens.labels.storyArcTagline}
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  size="small"
                  label="PRO-VISNING"
                  sx={{
                    bgcolor: 'rgba(192,132,252,0.2)',
                    color: '#f5d0fe',
                    border: '1px solid rgba(192,132,252,0.45)',
                    fontWeight: 700,
                    letterSpacing: 0.4,
                  }}
                />
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'stretch',
                  gap: { xs: 2, sm: 2.5, md: 3 },
                  width: '100%',
                  maxWidth: 980,
                  mx: 'auto',
                }}
              >
                <Card
                  sx={{
                    flex: '1 1 320px',
                    minWidth: { xs: '100%', sm: 320 },
                    maxWidth: 460,
                    borderRadius: 3,
                    cursor: 'pointer',
                    background: 'linear-gradient(160deg, rgba(124,58,237,0.22) 0%, rgba(15,23,42,0.82) 100%)',
                    border: '1px solid rgba(167,139,250,0.42)',
                    boxShadow: '0 12px 32px rgba(76,29,149,0.32)',
                    transition: 'all 0.28s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: 'rgba(196,181,253,0.82)',
                      boxShadow: '0 18px 36px rgba(109,40,217,0.38)',
                    },
                  }}
                  onClick={() => {
                    startTransition(() => setStoryArcView('story-logic'));
                  }}
                >
                  <CardContent sx={{ p: 3, textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 76,
                        height: 76,
                        borderRadius: '50%',
                        bgcolor: 'rgba(139,92,246,0.22)',
                        border: '1px solid rgba(167,139,250,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <StoryLogicIcon sx={{ fontSize: 38, color: '#c4b5fd' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                      {branding.tokens.labels.storyArcLogicTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.88)', mb: 2 }}>
                      {branding.tokens.labels.storyArcLogicSubtitle}
                    </Typography>
                    <Chip
                      label={branding.tokens.labels.storyLogicChip}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(139,92,246,0.24)',
                        color: '#ddd6fe',
                        border: '1px solid rgba(196,181,253,0.45)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    />
                  </CardContent>
                </Card>

                <Card
                  sx={{
                    flex: '1 1 320px',
                    minWidth: { xs: '100%', sm: 320 },
                    maxWidth: 460,
                    borderRadius: 3,
                    cursor: 'pointer',
                    background: 'linear-gradient(160deg, rgba(236,72,153,0.18) 0%, rgba(15,23,42,0.84) 100%)',
                    border: '1px solid rgba(244,114,182,0.4)',
                    boxShadow: '0 12px 32px rgba(131,24,67,0.28)',
                    transition: 'all 0.28s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: 'rgba(251,207,232,0.82)',
                      boxShadow: '0 18px 36px rgba(190,24,93,0.34)',
                    },
                  }}
                  onClick={() => {
                    startTransition(() => setStoryArcView('story-writer'));
                  }}
                >
                  <CardContent sx={{ p: 3, textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 76,
                        height: 76,
                        borderRadius: '50%',
                        bgcolor: 'rgba(236,72,153,0.22)',
                        border: '1px solid rgba(244,114,182,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <StoryWriterIcon sx={{ fontSize: 38, color: '#f9a8d4' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                      {branding.tokens.labels.storyWriterTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.88)', mb: 2 }}>
                      {branding.tokens.labels.storyWriterSubtitle}
                    </Typography>
                    <Chip
                      label={branding.tokens.labels.storyWriterChip}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(236,72,153,0.24)',
                        color: '#fbcfe8',
                        border: '1px solid rgba(249,168,212,0.45)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    />
                  </CardContent>
                </Card>

                <Card
                  sx={{
                    flex: '1 1 320px',
                    minWidth: { xs: '100%', sm: 320 },
                    maxWidth: 460,
                    borderRadius: 3,
                    cursor: 'pointer',
                    background: 'linear-gradient(160deg, rgba(14,165,233,0.2) 0%, rgba(15,23,42,0.86) 100%)',
                    border: '1px solid rgba(56,189,248,0.42)',
                    boxShadow: '0 12px 32px rgba(3,105,161,0.3)',
                    transition: 'all 0.28s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: 'rgba(125,211,252,0.84)',
                      boxShadow: '0 18px 36px rgba(2,132,199,0.34)',
                    },
                  }}
                  onClick={() => {
                    startTransition(() => setStoryArcView('shot-list'));
                  }}
                >
                  <CardContent sx={{ p: 3, textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 76,
                        height: 76,
                        borderRadius: '50%',
                        bgcolor: 'rgba(14,165,233,0.22)',
                        border: '1px solid rgba(56,189,248,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <ShotListIcon sx={{ fontSize: 38, color: '#7dd3fc' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                      {profession ? getTerm('shotList') : branding.tokens.labels.shotList}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.88)', mb: 2 }}>
                      Role Room planlegging og progresjon per scene
                    </Typography>
                    <Chip
                      label="SHOT LIST"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(14,165,233,0.24)',
                        color: '#bae6fd',
                        border: '1px solid rgba(125,211,252,0.45)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    />
                  </CardContent>
                </Card>

                <Card
                  sx={{
                    flex: '1 1 320px',
                    minWidth: { xs: '100%', sm: 320 },
                    maxWidth: 460,
                    borderRadius: 3,
                    cursor: 'pointer',
                    background: 'linear-gradient(160deg, rgba(245,158,11,0.18) 0%, rgba(15,23,42,0.88) 100%)',
                    border: '1px solid rgba(251,191,36,0.36)',
                    boxShadow: '0 12px 32px rgba(120,53,15,0.28)',
                    transition: 'all 0.28s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: 'rgba(252,211,77,0.84)',
                      boxShadow: '0 18px 36px rgba(180,83,9,0.32)',
                    },
                  }}
                  onClick={() => {
                    startTransition(() => setStoryArcView('planning'));
                  }}
                >
                  <CardContent sx={{ p: 3, textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 76,
                        height: 76,
                        borderRadius: '50%',
                        bgcolor: 'rgba(245,158,11,0.18)',
                        border: '1px solid rgba(251,191,36,0.44)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <CalendarMonthIcon sx={{ fontSize: 38, color: '#fcd34d' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                      The Role Room Planning
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.88)', mb: 2 }}>
                      {plannerAudience === 'content_producer'
                        ? 'Samle brief, leveranser, reviews og møtepunkter i én planflate for innholdsarbeidet.'
                        : 'Samle produksjonsdager, teamrytme og møtelogikk i én planflate for studioet.'}
                    </Typography>
                    <Chip
                      label="PLANNING"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(245,158,11,0.22)',
                        color: '#fde68a',
                        border: '1px solid rgba(252,211,77,0.45)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    />
                  </CardContent>
                </Card>
              </Box>
            </Box>
          ) : effectiveStoryArcView === 'planning' ? (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.25,
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {plannerAudience === 'content_producer' ? null : (
                    <>
                      <Button
                        startIcon={<CloseIcon />}
                        onClick={() => {
                          startTransition(() => setStoryArcView('main'));
                        }}
                        size="small"
                        sx={{ color: 'rgba(255,255,255,0.87)' }}
                      >
                        {branding.tokens.labels.storyArcBackLabel}
                      </Button>
                      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                    </>
                  )}
                  <RoleRoomBrandMark width={28} height={28} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.15 }}>
                      {plannerAudience === 'content_producer' ? 'Planner' : 'The Role Room Planning'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.72)' }}>
                      {plannerAudience === 'content_producer'
                        ? 'Prosjektrom, godkjenning og levering samlet i én operativ flate.'
                        : 'Produksjonsplan, Meet-flyt og teamrytme i ett studio.'}
                    </Typography>
                  </Box>
                </Box>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {plannerAudience === 'content_producer' ? (
                    <>
                      <Chip
                        size="small"
                        label={`${currentProject?.shotLists?.length ?? 0} shotlists`}
                        sx={{
                          bgcolor: 'rgba(245,158,11,0.18)',
                          color: '#fde68a',
                          border: '1px solid rgba(252,211,77,0.42)',
                          fontWeight: 700,
                        }}
                      />
                      <Chip
                        size="small"
                        label={`${currentProject?.sceneBreakdowns?.length ?? 0} storyboardseksjoner`}
                        sx={{
                          bgcolor: 'rgba(59,130,246,0.18)',
                          color: '#bfdbfe',
                          border: '1px solid rgba(96,165,250,0.42)',
                          fontWeight: 700,
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Chip
                        size="small"
                        label={`${currentProject?.productionDays?.length ?? 0} produksjonsdager`}
                        sx={{
                          bgcolor: 'rgba(245,158,11,0.18)',
                          color: '#fde68a',
                          border: '1px solid rgba(252,211,77,0.42)',
                          fontWeight: 700,
                        }}
                      />
                      <Chip
                        size="small"
                        label={`${currentProject?.crew?.length ?? 0} crew`}
                        sx={{
                          bgcolor: 'rgba(59,130,246,0.18)',
                          color: '#bfdbfe',
                          border: '1px solid rgba(96,165,250,0.42)',
                          fontWeight: 700,
                        }}
                      />
                      <Chip
                        size="small"
                        label={`${selectionMetrics.callbacks} callbacks`}
                        sx={{
                          bgcolor: 'rgba(168,85,247,0.18)',
                          color: '#e9d5ff',
                          border: '1px solid rgba(192,132,252,0.42)',
                          fontWeight: 700,
                        }}
                      />
                    </>
                  )}
                </Stack>
              </Box>

              <Box
                sx={{
                  px: 1.5,
                  py: 1.2,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  background: 'linear-gradient(90deg, rgba(245,158,11,0.08) 0%, rgba(15,23,42,0.12) 100%)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.1,
                }}
              >
                <Box sx={{ maxWidth: 720 }}>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.35 }}>
                    {plannerAudience === 'content_producer'
                      ? `Planner · ${activeContentProducerPlannerSurfaceItem?.label ?? 'Oversikt'}`
                      : 'Planlegg dager, samarbeid og møter fra samme operasjonsflate'}
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.76)', fontSize: '0.82rem', lineHeight: 1.55 }}>
                    {plannerAudience === 'content_producer'
                      ? activeContentProducerPlannerSurfaceItem?.description ?? 'Planner er hovedhjemmet for innholdsprodusent.'
                      : 'Bruk denne flaten som planning-leddet i Role Room Studio. Produksjonsteamet kan hoppe direkte til utvelgelse for Meet-planlegging, videre til produksjonsplanen for dagsstyring og til teamet for bemanning.'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {plannerAudience === 'content_producer' ? (
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
                      <Box sx={{ width: '100%', overflowX: 'auto' }}>
                        <Tabs
                          value={contentProducerPlannerSurface}
                          onChange={(_, nextValue: ContentProducerPlannerSurface) => {
                            setContentProducerPlannerSurface(nextValue);
                          }}
                          variant="scrollable"
                          allowScrollButtonsMobile
                          sx={{
                            minHeight: 0,
                            '& .MuiTabs-flexContainer': {
                              gap: 0.75,
                              flexWrap: 'wrap',
                            },
                            '& .MuiTabs-indicator': {
                              display: 'none',
                            },
                          }}
                        >
                          {contentProducerPlannerSurfaceItems.map((item) => (
                            <Tab
                              key={item.value}
                              value={item.value}
                              label={item.label}
                              sx={{
                                minHeight: 0,
                                px: 1.6,
                                py: 0.8,
                                borderRadius: 999,
                                textTransform: 'none',
                                fontWeight: 700,
                                color: contentProducerPlannerSurface === item.value ? '#0f172a' : '#e2e8f0',
                                bgcolor: contentProducerPlannerSurface === item.value ? '#f8fafc' : 'rgba(15,23,42,0.42)',
                                border: '1px solid rgba(148,163,184,0.22)',
                                minWidth: 'fit-content',
                              }}
                            />
                          ))}
                        </Tabs>
                      </Box>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label="Storyboard"
                          onClick={() => {
                            openContentProducerCreativeTool('storyboard');
                          }}
                          sx={{
                            bgcolor: contentProducerPlannerSurface === 'project_room' && producerMediaFocus?.workspace === 'storyboard'
                              ? 'rgba(244,114,182,0.22)'
                              : 'rgba(15,23,42,0.42)',
                            color: '#fce7f3',
                            border: '1px solid rgba(244,114,182,0.32)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        />
                        <Chip
                          size="small"
                          label="Story Writer"
                          onClick={() => {
                            openContentProducerCreativeTool('story-writer');
                          }}
                          sx={{
                            bgcolor: storyArcView === 'story-writer'
                              ? 'rgba(129,140,248,0.22)'
                              : 'rgba(15,23,42,0.42)',
                            color: '#e0e7ff',
                            border: '1px solid rgba(129,140,248,0.32)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        />
                        <Chip
                          size="small"
                          label="Sceneliste"
                          onClick={() => {
                            openContentProducerCreativeTool('shot-list');
                          }}
                          sx={{
                            bgcolor: storyArcView === 'shot-list'
                              ? 'rgba(56,189,248,0.22)'
                              : 'rgba(15,23,42,0.42)',
                            color: '#bae6fd',
                            border: '1px solid rgba(56,189,248,0.32)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        />
                        <Chip
                          size="small"
                          label="Story Logic"
                          onClick={() => {
                            openContentProducerCreativeTool('story-logic');
                          }}
                          sx={{
                            bgcolor: storyArcView === 'story-logic'
                              ? 'rgba(167,139,250,0.22)'
                              : 'rgba(15,23,42,0.42)',
                            color: '#ede9fe',
                            border: '1px solid rgba(167,139,250,0.32)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        />
                      </Stack>
                    </Box>
                  ) : (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<SelectionTabIcon />}
                        onClick={() => {
                          navigateToTab(SELECTION_TAB_INDEX);
                        }}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 999 }}
                      >
                        Til utvelgelse
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<CalendarMonthIcon />}
                        onClick={() => {
                          navigateToTab(CALENDAR_TAB_INDEX);
                        }}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 999 }}
                      >
                        Produksjonsplan
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<GroupsIcon />}
                        onClick={() => {
                          navigateToTab(TEAM_TAB_INDEX);
                        }}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 999 }}
                      >
                        Team
                      </Button>
                    </>
                  )}
                </Stack>
              </Box>

              {!currentProject ? (
                <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
                  <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                    {branding.tokens.labels.noProjectSelected}
                  </Typography>
                </Box>
              ) : !canManageProductionWorkspace ? (
                <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
                  <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                    Du mangler tilgang til å styre The Role Room Planning for dette prosjektet.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', pt: 1 }}>
                  {plannerAudience !== 'content_producer' || contentProducerPlannerSurface === 'overview' ? (
                    <ProducerPlannerStudio
                      key={`${currentProject.id}:${producerWorkflowBootstrapVersion}:planner-studio`}
                      project={currentProject}
                      readOnly={!canManageProductionWorkspace}
                      audience={plannerAudience}
                      ownerOptions={producerWorkflowOwnerOptions}
                      entityOptions={producerWorkflowEntityOptions}
                      onProjectUpdated={async (updatedProject) => {
                        setCurrentProject(updatedProject);
                        await loadProjects();
                      }}
                      onOpenSelection={plannerAudience === 'content_producer' ? undefined : () => {
                        navigateToTab(SELECTION_TAB_INDEX);
                      }}
                      onOpenTeam={plannerAudience === 'content_producer' ? undefined : () => {
                        navigateToTab(TEAM_TAB_INDEX);
                      }}
                      onOpenShotList={(focus) => {
                        startTransition(() => setStoryArcView('shot-list'));
                        if (focus?.phase) {
                          logRoleRoomDiagnostic('planning-open-shotlist', {
                            projectId: currentProject.id,
                            phase: focus.phase,
                          });
                        }
                      }}
                      onOpenReviews={(focus) => {
                        if (plannerAudience === 'content_producer') {
                          openContentProducerPlannerSurface('approval', {
                            focusPanel: 'reviews',
                            focusPayload: focus,
                          });
                          return;
                        }
                        navigateToProducerWorkflowTabWithFocus(PRODUCER_REVIEWS_TAB_INDEX, focus);
                      }}
                      onOpenEconomy={(focus) => {
                        if (plannerAudience === 'content_producer') {
                          openContentProducerPlannerSurface('economy', {
                            focusPanel: 'economy',
                            focusPayload: focus,
                          });
                          return;
                        }
                        navigateToProducerWorkflowTabWithFocus(PRODUCER_ECONOMY_TAB_INDEX, focus);
                      }}
                      onOpenMedia={(focus) => {
                        if (plannerAudience === 'content_producer') {
                          openContentProducerPlannerSurface('project_room', {
                            mediaFocus: focus ?? null,
                          });
                          return;
                        }
                        navigateToProducerMediaWorkspace(focus);
                      }}
                      resumeCard={plannerAudience === 'content_producer' ? contentProducerResumeCard : null}
                      onResumeWorkspace={plannerAudience === 'content_producer' ? handleResumeContentProducerWorkspace : undefined}
                    />
                  ) : null}

                  {plannerAudience === 'content_producer' && contentProducerPlannerSurface === 'project_room' ? (
                    <RoleRoomDiagnosticsProbe
                      name="ProducerMediaPanel"
                      projectId={currentProject.id}
                      detail={{ activeTab, bootstrapVersion: producerWorkflowBootstrapVersion, plannerSurface: contentProducerPlannerSurface }}
                    >
                      <ProducerMediaPanel
                        key={`${currentProject.id}:${producerWorkflowBootstrapVersion}:planner-media`}
                        project={currentProject}
                        projectId={currentProject.id}
                        projectName={currentProject.name}
                        mediaCount={(currentProject.props?.length ?? 0) + (currentProject.shotLists?.length ?? 0)}
                        storyboardCount={currentProject.sceneBreakdowns?.length ?? 0}
                        shotCount={currentProject.shotLists?.length ?? 0}
                        shotLists={currentProject.shotLists ?? []}
                        readOnly={!canCommentInProducerWorkflow && !canEditProducerWorkflow}
                        canContributeClientInput={canCommentInProducerWorkflow || canEditProducerWorkflow}
                        isClientReviewerMode={isClientReviewerMode}
                        initialWorkspace={producerMediaFocus?.workspace}
                        initialSectionId={producerMediaFocus?.sectionId}
                        initialPageId={producerMediaFocus?.pageId}
                        initialArtifactId={producerMediaFocus?.artifactId}
                        onWorkspaceFocusChange={(focus) => {
                          setProducerMediaFocus((previous) => (
                            previous?.workspace === focus.workspace
                            && previous?.sectionId === focus.sectionId
                            && previous?.pageId === focus.pageId
                            && previous?.artifactId === focus.artifactId
                              ? previous
                              : focus
                          ));
                        }}
                        onUnsavedStateChange={(hasUnsaved, reason) => {
                          setUnsavedProjectSwitchSource('project_room', hasUnsaved, reason);
                        }}
                        onProjectUpdated={async (updatedProject) => {
                          setCurrentProject(updatedProject);
                          await loadProjects();
                        }}
                        onCreateProjectFromAgent={openProjectCreationModalWithPrefill}
                        onOpenStoryboard={(focus) => {
                          navigateToTab(STORY_ARC_TAB_INDEX, {
                            storyArcView: 'main',
                            storyArcFocus: focus ?? storyArcFocus,
                          });
                        }}
                        onOpenManuscript={(focus) => {
                          navigateToTab(STORY_ARC_TAB_INDEX, {
                            storyArcView: 'story-writer',
                            storyArcFocus: focus ?? storyArcFocus,
                          });
                        }}
                        onOpenShotList={(focus) => {
                          navigateToTab(STORY_ARC_TAB_INDEX, {
                            storyArcView: 'shot-list',
                            storyArcFocus: focus ?? storyArcFocus,
                          });
                        }}
                        onOpenSceneNotes={() => {
                          navigateToTab(STORY_ARC_TAB_INDEX, { storyArcView: 'story-logic' });
                        }}
                        onPrepareStoryboardReview={() => {
                          if (!currentProject) {
                            return;
                          }
                          queueProducerReviewCreate({
                            reviewType: 'storyboard',
                            title: 'Storyboard klar for klientgodkjenning',
                            description: 'Vennligst gjennomgå storyboard og gi godkjenning eller endringsønsker.',
                            targetEntityType: 'storyboard',
                            targetEntityId: makeProducerPackageEntityId('storyboard', currentProject.id),
                          });
                        }}
                        onPrepareManuscriptReview={() => {
                          if (!currentProject) {
                            return;
                          }
                          queueProducerReviewCreate({
                            reviewType: 'manuscript',
                            title: 'Manus klar for klientgodkjenning',
                            description: 'Vennligst gjennomgå manus og gi godkjenning eller endringsønsker.',
                            targetEntityType: 'manuscript',
                            targetEntityId: makeProducerPackageEntityId('manuscript', currentProject.id),
                          });
                        }}
                        onPrepareShotListReview={() => {
                          if (!currentProject) {
                            return;
                          }
                          queueProducerReviewCreate({
                            reviewType: 'shotlist',
                            title: 'Shotlist klar for klientgodkjenning',
                            description: 'Vennligst gjennomgå shotlist og gi godkjenning eller endringsønsker.',
                            targetEntityType: 'shotlist',
                            targetEntityId: makeProducerPackageEntityId('shotlist', currentProject.id),
                          });
                        }}
                      />
                    </RoleRoomDiagnosticsProbe>
                  ) : null}

                  {plannerAudience === 'content_producer' && contentProducerPlannerSurface === 'approval' ? (
                    <RoleRoomDiagnosticsProbe
                      name="ProducerClientReviewPanel"
                      projectId={currentProject.id}
                      detail={{ activeTab, bootstrapVersion: producerWorkflowBootstrapVersion, plannerSurface: contentProducerPlannerSurface }}
                    >
                      <ProducerClientReviewPanel
                        key={`${currentProject.id}:${producerWorkflowBootstrapVersion}:planner-reviews`}
                        projectId={currentProject.id}
                        projectName={currentProject.name}
                        project={currentProject}
                        projectWorkflowStatus={currentProject.producerWorkflowStatus}
                        projectWorkflowMeta={currentProject.producerWorkflowMeta}
                        canEdit={canEditProducerWorkflow}
                        canComment={canCommentInProducerWorkflow}
                        canDecide={canMakeProducerReviewDecision}
                        canApproveReview={canApproveProducerReview}
                        canRequestReviewChanges={canRequestProducerReviewChanges}
                        entityOptions={producerWorkflowEntityOptions}
                        onOpenMedia={(focus) => {
                          openContentProducerPlannerSurface('project_room', {
                            mediaFocus: focus ?? null,
                          });
                        }}
                        onOpenTimeline={() => {
                          openContentProducerPlannerSurface('overview');
                        }}
                        onOpenEconomy={(focus) => {
                          openContentProducerPlannerSurface('economy', {
                            focusPanel: 'economy',
                            focusPayload: focus,
                          });
                        }}
                      />
                    </RoleRoomDiagnosticsProbe>
                  ) : null}

                  {plannerAudience === 'content_producer' && contentProducerPlannerSurface === 'delivery' ? (
                    <RoleRoomDiagnosticsProbe
                      name="ProducerExportHandoffPanel"
                      projectId={currentProject.id}
                      detail={{ activeTab, bootstrapVersion: producerWorkflowBootstrapVersion, plannerSurface: contentProducerPlannerSurface }}
                    >
                      <ProducerExportHandoffPanel
                        key={`${currentProject.id}:${producerWorkflowBootstrapVersion}:planner-export`}
                        project={currentProject}
                        onOpenManuscript={() => {
                          setStoryArcView('story-writer');
                          navigateToTab(STORY_ARC_TAB_INDEX);
                        }}
                        onOpenShotList={() => {
                          setStoryArcView('shot-list');
                          navigateToTab(STORY_ARC_TAB_INDEX);
                        }}
                        onOpenMedia={(focus) => {
                          openContentProducerPlannerSurface('project_room', {
                            mediaFocus: focus ?? null,
                          });
                        }}
                        onOpenReviews={() => {
                          openContentProducerPlannerSurface('approval');
                        }}
                        onOpenTimeline={() => {
                          openContentProducerPlannerSurface('overview');
                        }}
                        onSendToClient={async () => {
                          openSharingModal();
                        }}
                      />
                    </RoleRoomDiagnosticsProbe>
                  ) : null}

                  {plannerAudience === 'content_producer' && contentProducerPlannerSurface === 'economy' && canViewProducerEconomy ? (
                    <RoleRoomDiagnosticsProbe
                      name="ProjectEconomyHub"
                      projectId={currentProject.id}
                      detail={{ activeTab, bootstrapVersion: producerWorkflowBootstrapVersion, plannerSurface: contentProducerPlannerSurface }}
                    >
                      <ProjectEconomyHub
                        key={`${currentProject.id}:${producerWorkflowBootstrapVersion}:planner-economy`}
                        project={currentProject}
                        profession={profession ?? 'videographer'}
                        readOnly={!canEditProducerWorkflow}
                        canSendBudgetReview={canSendBudgetReview}
                        onProjectUpdated={async (updatedProject) => {
                          setCurrentProject(updatedProject);
                          await loadProjects();
                        }}
                        onOpenReviews={(focus) => {
                          openContentProducerPlannerSurface('approval', {
                            focusPanel: 'reviews',
                            focusPayload: focus,
                          });
                        }}
                        onOpenTimeline={() => {
                          openContentProducerPlannerSurface('overview');
                        }}
                        onOpenMedia={(focus) => {
                          openContentProducerPlannerSurface('project_room', {
                            mediaFocus: focus ?? null,
                          });
                        }}
                        onOpenDeliverableSource={(target) => {
                          if (target === 'shotlist') {
                            navigateToTab(STORY_ARC_TAB_INDEX, { storyArcView: 'shot-list' });
                            return;
                          }
                          if (target === 'manuscript') {
                            navigateToTab(STORY_ARC_TAB_INDEX, { storyArcView: 'story-writer' });
                            return;
                          }
                          navigateToTab(STORY_ARC_TAB_INDEX, { storyArcView: 'main' });
                        }}
                      />
                    </RoleRoomDiagnosticsProbe>
                  ) : null}
                </Box>
              )}
            </Box>
          ) : effectiveStoryArcView === 'story-logic' ? (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Back button header */}
              <Box sx={{ 
                p: 1.5, 
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
                <Button
                  startIcon={<CloseIcon />}
                  onClick={() => {
                    startTransition(() => setStoryArcView('main'));
                  }}
                  size="small"
                  sx={{ color: 'rgba(255,255,255,0.87)' }}
                >
                  {branding.tokens.labels.storyArcBackLabel}
                </Button>
                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                <StoryLogicIcon sx={{ color: '#8b5cf6' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
                  {branding.tokens.labels.storyLogicHeader}
                </Typography>
              </Box>
              {/* Story Logic Panel */}
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <Suspense fallback={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <CircularProgress size={32} sx={{ color: '#8b5cf6' }} />
                  </Box>
                }>
                  <StoryLogicPanel
                    key={currentProject?.id ?? 'no-project'}
                    projectId={currentProject?.id}
                    onSave={handleStoryLogicSave}
                    onUnsavedStateChange={(hasUnsaved, reason) => {
                      setUnsavedProjectSwitchSource('story_logic', hasUnsaved, reason);
                    }}
                  />
                </Suspense>
              </Box>
            </Box>
          ) : effectiveStoryArcView === 'shot-list' ? (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box
                sx={{
                  p: 1.5,
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.25,
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    startIcon={<CloseIcon />}
                    onClick={() => {
                      startTransition(() => setStoryArcView('main'));
                    }}
                    size="small"
                    sx={{ color: 'rgba(255,255,255,0.87)' }}
                  >
                    {branding.tokens.labels.storyArcBackLabel}
                  </Button>
                  <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                  <ShotListIcon sx={{ color: '#38bdf8' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
                    {profession ? getTerm('shotList') : branding.tokens.labels.shotList}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label="PRO-VISNING"
                  sx={{
                    bgcolor: 'rgba(56,189,248,0.2)',
                    color: '#bae6fd',
                    border: '1px solid rgba(125,211,252,0.5)',
                    fontWeight: 700,
                    letterSpacing: 0.3,
                  }}
                />
              </Box>
              {!currentProject ? (
                <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
                  <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                    {branding.tokens.labels.noProjectSelected}
                  </Typography>
                </Box>
              ) : !permissions.canEditShotLists ? (
                <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
                  <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                    {branding.tokens.labels.noAccessShotList}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, overflow: 'hidden', pt: 1 }}>
                  <CastingShotListPanel
                    key={currentProject.id}
                    projectId={currentProject.id}
                    initialSceneId={storyArcFocus?.sceneId}
                    initialShotId={storyArcFocus?.shotId}
                    onStoryArcFocusChange={(focus) => {
                      setStoryArcFocus(normalizeStoryArcNavigationFocus(focus));
                    }}
                    onUpdate={async () => {
                      const updated = await castingService.getProject(currentProject.id);
                      if (updated) setCurrentProject(updated);
                    }}
                    profession={profession}
                    teamDashboardOpenSignal={teamDashboardOpenSignal}
                    teamDashboardDefaultSegment={teamDashboardDefaultSegment}
                  />
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Story Writer Content - ManuscriptPanel */}
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <ErrorBoundary>
                  <Suspense fallback={
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <CircularProgress />
                    </Box>
                  }>
                    <ManuscriptPanel
                      key={currentProject?.id ?? 'no-project'}
                      projectId={currentProject?.id}
                      initialSceneId={storyArcFocus?.sceneId}
                      onStoryArcFocusChange={(focus) => {
                        setStoryArcFocus(normalizeStoryArcNavigationFocus(focus));
                      }}
                      onManuscriptChange={handleManuscriptChange}
                      storyLogicData={storyLogicData}
                      onUnsavedStateChange={(hasUnsaved, reason) => {
                        setUnsavedProjectSwitchSource('manuscript', hasUnsaved, reason);
                      }}
                      headerLeftContent={
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            minWidth: 0,
                            px: 0.75,
                            py: 0.25,
                            borderRadius: 1.5,
                            border: `1px solid ${branding.colors.border}`,
                            background: `linear-gradient(90deg, ${branding.colors.gradientStart}1a 0%, ${branding.colors.gradientEnd}1a 100%)`,
                          }}
                        >
                          <Button
                            startIcon={<CloseIcon />}
                            onClick={() => {
                              startTransition(() => setStoryArcView('main'));
                            }}
                            size="small"
                            sx={{
                              color: branding.colors.textPrimary,
                              whiteSpace: 'nowrap',
                              '&:hover': {
                                bgcolor: `${branding.colors.primary}1a`,
                                color: branding.colors.primary,
                              },
                            }}
                          >
                            {branding.tokens.labels.storyArcBackLabel}
                          </Button>
                          <Divider
                            orientation="vertical"
                            flexItem
                            sx={{ mx: 0.5, borderColor: branding.colors.border }}
                          />
                          <StoryWriterIcon sx={{ color: branding.colors.primary, flexShrink: 0 }} />
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: branding.colors.textPrimary,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {branding.tokens.labels.storyWriterHeader}
                          </Typography>
                        </Box>
                      }
                    />
                  </Suspense>
                </ErrorBoundary>
              </Box>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={PRODUCER_MEDIA_TAB_INDEX}>
          {producerProjectSwitchPending ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <CircularProgress size={28} sx={{ color: '#60a5fa', mb: 1.25 }} />
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                Laster nytt prosjektgrunnlag
              </Typography>
            </Box>
          ) : !currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : (
            <RoleRoomDiagnosticsProbe
              name="ProducerMediaPanel"
              projectId={currentProject.id}
              detail={{ activeTab, bootstrapVersion: producerWorkflowBootstrapVersion }}
            >
              <ProducerMediaPanel
                key={`${currentProject.id}:${producerWorkflowBootstrapVersion}:media`}
                project={currentProject}
                projectId={currentProject.id}
                projectName={currentProject.name}
                mediaCount={(currentProject.props?.length ?? 0) + (currentProject.shotLists?.length ?? 0)}
                storyboardCount={currentProject.sceneBreakdowns?.length ?? 0}
                shotCount={currentProject.shotLists?.length ?? 0}
                shotLists={currentProject.shotLists ?? []}
                readOnly={!canCommentInProducerWorkflow && !canEditProducerWorkflow}
                canContributeClientInput={canCommentInProducerWorkflow || canEditProducerWorkflow}
                isClientReviewerMode={isClientReviewerMode}
                initialWorkspace={
                  producerMediaFocus?.workspace
                  ?? (
                    isClientReviewerSession
                    && clientPortalIntent
                    && clientPortalIntent.projectId === currentProject.id
                      ? clientPortalIntent.workspace
                      : undefined
                  )
                }
                initialSectionId={
                  producerMediaFocus?.sectionId
                  ?? (
                    isClientReviewerSession
                    && clientPortalIntent
                    && clientPortalIntent.projectId === currentProject.id
                      ? clientPortalIntent.sectionId
                      : undefined
                  )
                }
                initialPageId={
                  producerMediaFocus?.pageId
                  ?? (
                    isClientReviewerSession
                    && clientPortalIntent
                    && clientPortalIntent.projectId === currentProject.id
                      ? clientPortalIntent.pageId
                      : undefined
                  )
                }
                initialArtifactId={
                  producerMediaFocus?.artifactId
                  ?? (
                    isClientReviewerSession
                    && clientPortalIntent
                    && clientPortalIntent.projectId === currentProject.id
                      ? clientPortalIntent.artifactId
                      : undefined
                  )
                }
                onWorkspaceFocusChange={(focus) => {
                  setProducerMediaFocus((previous) => (
                    previous?.workspace === focus.workspace
                    && previous?.sectionId === focus.sectionId
                    && previous?.pageId === focus.pageId
                    && previous?.artifactId === focus.artifactId
                      ? previous
                      : focus
                  ));
                }}
                onUnsavedStateChange={(hasUnsaved, reason) => {
                  setUnsavedProjectSwitchSource('project_room', hasUnsaved, reason);
                }}
                onProjectUpdated={async (updatedProject) => {
                  setCurrentProject(updatedProject);
                  await loadProjects();
                }}
                onCreateProjectFromAgent={openProjectCreationModalWithPrefill}
                onOpenStoryboard={(focus) => {
                  navigateToTab(STORY_ARC_TAB_INDEX, {
                    storyArcView: 'main',
                    storyArcFocus: focus ?? storyArcFocus,
                  });
                }}
                onOpenManuscript={(focus) => {
                  navigateToTab(STORY_ARC_TAB_INDEX, {
                    storyArcView: 'story-writer',
                    storyArcFocus: focus ?? storyArcFocus,
                  });
                }}
                onOpenShotList={(focus) => {
                  navigateToTab(STORY_ARC_TAB_INDEX, {
                    storyArcView: 'shot-list',
                    storyArcFocus: focus ?? storyArcFocus,
                  });
                }}
                onOpenSceneNotes={() => {
                  navigateToTab(STORY_ARC_TAB_INDEX, { storyArcView: 'story-logic' });
                }}
                onPrepareStoryboardReview={() => {
                  if (!currentProject) {
                    return;
                  }
                  queueProducerReviewCreate({
                    reviewType: 'storyboard',
                    title: 'Storyboard klar for klientgodkjenning',
                    description: 'Vennligst gjennomgå storyboard og gi godkjenning eller endringsønsker.',
                    targetEntityType: 'storyboard',
                    targetEntityId: makeProducerPackageEntityId('storyboard', currentProject.id),
                  });
                }}
                onPrepareManuscriptReview={() => {
                  if (!currentProject) {
                    return;
                  }
                  queueProducerReviewCreate({
                    reviewType: 'manuscript',
                    title: 'Manus klar for klientgodkjenning',
                    description: 'Vennligst gjennomgå manus og gi godkjenning eller endringsønsker.',
                    targetEntityType: 'manuscript',
                    targetEntityId: makeProducerPackageEntityId('manuscript', currentProject.id),
                  });
                }}
                onPrepareShotListReview={() => {
                  if (!currentProject) {
                    return;
                  }
                  queueProducerReviewCreate({
                    reviewType: 'shotlist',
                    title: 'Shotlist klar for klientgodkjenning',
                    description: 'Vennligst gjennomgå shotlist og gi godkjenning eller endringsønsker.',
                    targetEntityType: 'shotlist',
                    targetEntityId: makeProducerPackageEntityId('shotlist', currentProject.id),
                  });
                }}
              />
            </RoleRoomDiagnosticsProbe>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={PRODUCER_ECONOMY_TAB_INDEX}>
          {producerProjectSwitchPending ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <CircularProgress size={28} sx={{ color: '#60a5fa', mb: 1.25 }} />
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                Laster nytt prosjektgrunnlag
              </Typography>
            </Box>
          ) : !currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : (
            <RoleRoomDiagnosticsProbe
              name="ProjectEconomyHub"
              projectId={currentProject.id}
              detail={{ activeTab, bootstrapVersion: producerWorkflowBootstrapVersion }}
            >
              <ProjectEconomyHub
              key={`${currentProject.id}:${producerWorkflowBootstrapVersion}:economy-hub`}
              project={currentProject}
              profession={profession ?? 'videographer'}
              readOnly={!canEditProducerWorkflow}
              canSendBudgetReview={canSendBudgetReview}
              onProjectUpdated={async (updatedProject) => {
                setCurrentProject(updatedProject);
                await loadProjects();
              }}
              onOpenTeam={!isContentProducerMode && !isClientReviewerMode ? () => {
                navigateToTab(TEAM_TAB_INDEX);
              } : undefined}
              onOpenReviews={isContentProducerMode || isClientReviewerMode ? (focus) => {
                navigateToProducerWorkflowTabWithFocus(PRODUCER_REVIEWS_TAB_INDEX, focus);
              } : undefined}
              onOpenTimeline={isContentProducerMode || isClientReviewerMode ? (focus) => {
                navigateToProducerWorkflowTabWithFocus(PRODUCER_TIMELINE_TAB_INDEX, focus);
              } : undefined}
              onOpenMedia={isContentProducerMode || isClientReviewerMode ? (focus) => {
                navigateToProducerMediaWorkspace(focus);
              } : undefined}
              onOpenDeliverableSource={isContentProducerMode || isClientReviewerMode ? (target) => {
                if (target === 'shotlist') {
                  navigateToTab(STORY_ARC_TAB_INDEX, { storyArcView: 'shot-list' });
                  return;
                }
                if (target === 'manuscript') {
                  navigateToTab(STORY_ARC_TAB_INDEX, { storyArcView: 'story-writer' });
                  return;
                }
                navigateToTab(STORY_ARC_TAB_INDEX, { storyArcView: 'main' });
              } : undefined}
              />
            </RoleRoomDiagnosticsProbe>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={PRODUCER_TIMELINE_TAB_INDEX}>
          {producerProjectSwitchPending ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <CircularProgress size={28} sx={{ color: '#60a5fa', mb: 1.25 }} />
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                Laster nytt prosjektgrunnlag
              </Typography>
            </Box>
          ) : !currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : (
            <RoleRoomDiagnosticsProbe
              name="ProducerTimelinePanel"
              projectId={currentProject.id}
              detail={{ activeTab, bootstrapVersion: producerWorkflowBootstrapVersion }}
            >
              <ProducerTimelinePanel
              key={`${currentProject.id}:${producerWorkflowBootstrapVersion}:timeline`}
              projectId={currentProject.id}
              readOnly={!canEditProducerWorkflow}
              entityOptions={producerWorkflowEntityOptions}
              ownerOptions={producerWorkflowOwnerOptions}
              onProjectUpdated={async (updatedProject) => {
                setCurrentProject(updatedProject);
                await loadProjects();
              }}
              onOpenReviews={isContentProducerMode || isClientReviewerMode ? (focus) => {
                navigateToProducerWorkflowTabWithFocus(PRODUCER_REVIEWS_TAB_INDEX, focus);
              } : undefined}
              onOpenEconomy={isContentProducerMode || isClientReviewerMode ? (focus) => {
                navigateToProducerWorkflowTabWithFocus(PRODUCER_ECONOMY_TAB_INDEX, focus);
              } : undefined}
              onOpenShotList={isContentProducerMode || isClientReviewerMode ? () => {
                navigateToTab(STORY_ARC_TAB_INDEX, { storyArcView: 'shot-list' });
              } : undefined}
              onOpenMedia={isContentProducerMode || isClientReviewerMode ? (focus) => {
                navigateToProducerMediaWorkspace(focus);
              } : undefined}
              />
            </RoleRoomDiagnosticsProbe>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={PRODUCER_REVIEWS_TAB_INDEX}>
          {producerProjectSwitchPending ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <CircularProgress size={28} sx={{ color: '#60a5fa', mb: 1.25 }} />
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                Laster nytt prosjektgrunnlag
              </Typography>
            </Box>
          ) : !currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : (
            <RoleRoomDiagnosticsProbe
              name="ProducerClientReviewPanel"
              projectId={currentProject.id}
              detail={{ activeTab, bootstrapVersion: producerWorkflowBootstrapVersion }}
            >
              <ProducerClientReviewPanel
              key={`${currentProject.id}:${producerWorkflowBootstrapVersion}:reviews`}
              projectId={currentProject.id}
              projectName={currentProject.name}
              project={currentProject}
              projectWorkflowStatus={currentProject.producerWorkflowStatus}
              projectWorkflowMeta={currentProject.producerWorkflowMeta}
              canEdit={canEditProducerWorkflow}
              canComment={canCommentInProducerWorkflow}
              canDecide={canMakeProducerReviewDecision}
              canApproveReview={canApproveProducerReview}
              canRequestReviewChanges={canRequestProducerReviewChanges}
              entityOptions={producerWorkflowEntityOptions}
              initialReviewId={
                isClientReviewerSession
                && clientPortalIntent
                && clientPortalIntent.projectId === currentProject.id
                && clientPortalIntent.tab === 'reviews'
                  ? clientPortalIntent.reviewId
                  : undefined
              }
              onOpenMedia={isContentProducerMode || isClientReviewerMode ? (focus) => {
                navigateToProducerMediaWorkspace(focus);
              } : undefined}
              onOpenTimeline={isContentProducerMode || isClientReviewerMode ? (focus) => {
                navigateToProducerWorkflowTabWithFocus(PRODUCER_TIMELINE_TAB_INDEX, focus);
              } : undefined}
              onOpenEconomy={isContentProducerMode || isClientReviewerMode ? (focus) => {
                navigateToProducerWorkflowTabWithFocus(PRODUCER_ECONOMY_TAB_INDEX, focus);
              } : undefined}
              />
            </RoleRoomDiagnosticsProbe>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={PRODUCER_EXPORT_TAB_INDEX}>
          {producerProjectSwitchPending ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <CircularProgress size={28} sx={{ color: '#60a5fa', mb: 1.25 }} />
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                Laster nytt prosjektgrunnlag
              </Typography>
            </Box>
          ) : !currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : (
            <RoleRoomDiagnosticsProbe
              name="ProducerExportHandoffPanel"
              projectId={currentProject.id}
              detail={{ activeTab, bootstrapVersion: producerWorkflowBootstrapVersion }}
            >
              <ProducerExportHandoffPanel
                key={`${currentProject.id}:${producerWorkflowBootstrapVersion}:export`}
                project={currentProject}
                onOpenManuscript={() => {
                  setStoryArcView('story-writer');
                  navigateToTab(STORY_ARC_TAB_INDEX);
                }}
                onOpenShotList={() => {
                  setStoryArcView('shot-list');
                  navigateToTab(STORY_ARC_TAB_INDEX);
                }}
                onOpenMedia={isContentProducerMode || isClientReviewerMode ? (focus) => {
                  navigateToProducerMediaWorkspace(focus);
                } : undefined}
                onOpenReviews={isContentProducerMode || isClientReviewerMode ? () => {
                  navigateToProducerWorkflowTabWithFocus(PRODUCER_REVIEWS_TAB_INDEX);
                } : undefined}
                onOpenTimeline={isContentProducerMode || isClientReviewerMode ? () => {
                  navigateToProducerWorkflowTabWithFocus(PRODUCER_TIMELINE_TAB_INDEX);
                } : undefined}
                onSendToClient={isContentProducerMode || isClientReviewerMode ? async () => {
                openSharingModal();
                } : undefined}
              />
            </RoleRoomDiagnosticsProbe>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={LIVE_SET_TAB_INDEX} immersive={isLiveSetImmersive}>
          {!isLiveSetImmersive && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                flexWrap: 'wrap',
                mb: 1,
                px: { xs: 0.5, sm: 0.75 },
              }}
            >
              <Chip
                size="small"
                label={`Live Set aktiv • Tilbake: ${getTabReturnLabel(lastNonLiveTab)}`}
                sx={{
                  color: '#fecaca',
                  bgcolor: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  fontWeight: 700,
                }}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  void requestLiveSetFullscreen();
                }}
                sx={{
                  color: isBrowserFullscreen ? '#34d399' : '#93c5fd',
                  borderColor: isBrowserFullscreen ? 'rgba(52,211,153,0.5)' : 'rgba(147,197,253,0.45)',
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': {
                    borderColor: isBrowserFullscreen ? '#10b981' : '#60a5fa',
                    bgcolor: isBrowserFullscreen ? 'rgba(16,185,129,0.14)' : 'rgba(59,130,246,0.14)',
                  },
                }}
              >
                {isBrowserFullscreen ? 'Fullskjerm aktiv' : 'Gå i fullskjerm'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleExitLiveSet}
                sx={{
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.28)',
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': {
                    borderColor: '#ef4444',
                    bgcolor: 'rgba(239,68,68,0.14)',
                  },
                }}
              >
                Tilbake til The Role Room
              </Button>
            </Box>
          )}
          {isLiveSetImmersive && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleExitLiveSet}
              sx={{
                position: 'fixed',
                top: 12,
                right: 12,
                zIndex: 3000,
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.4)',
                bgcolor: 'rgba(7,10,20,0.72)',
                backdropFilter: 'blur(6px)',
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': {
                  borderColor: '#ef4444',
                  bgcolor: 'rgba(239,68,68,0.16)',
                },
              }}
            >
              Avslutt Live Set
            </Button>
          )}
          <LiveSetMode
            key={currentProject?.id ?? 'no-project'}
            projectId={currentProject?.id ?? ''}
            projectName={
              typeof currentProject?.title === 'string'
                ? currentProject.title
                : (typeof currentProject?.name === 'string' ? currentProject.name : undefined)
            }
            shootingDay={new Date().toLocaleDateString('no-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            onExit={handleExitLiveSet}
          />
        </TabPanel>
          </Suspense>
          </ErrorBoundary>
          )}
        </ProjectProvider>
      </Box>

      {currentProject && (
        <Box sx={{ display: 'none' }} aria-hidden>
          <ErrorBoundary>
            <Suspense fallback={null}>
              {calendarCreateIntent === 'location' && activeTab !== LOCATIONS_TAB_INDEX && (
                <LocationManagementPanel
                  key={`${currentProject.id}:calendar-create-location`}
                  projectId={currentProject.id}
                  onUpdate={async () => {
                    const updated = await castingService.getProject(currentProject.id);
                    if (updated) setCurrentProject(updated);
                  }}
                  externalCreateSignal={externalLocationCreateSignal}
                  onExternalCreated={handleExternalLocationCreated}
                  onExternalCreateCancelled={handleExternalLocationCreateCancelled}
                />
              )}
              {calendarCreateIntent === 'crew' && activeTab !== TEAM_TAB_INDEX && (
                <CrewManagementPanel
                  key={`${currentProject.id}:calendar-create-crew`}
                  projectId={currentProject.id}
                  onUpdate={async () => {
                    const updated = await castingService.getProject(currentProject.id);
                    if (updated) setCurrentProject(updated);
                  }}
                  profession={profession}
                  onOpenTechnicalTeamDashboard={handleOpenTechnicalTeamDashboard}
                  productionDays={currentProject.productionDays || []}
                  scenes={currentProject.sceneBreakdowns || []}
                  externalCreateSignal={externalCrewCreateSignal}
                  onExternalCreated={handleExternalCrewCreated}
                  onExternalCreateCancelled={handleExternalCrewCreateCancelled}
                />
              )}
              {calendarCreateIntent === 'equipment' && activeTab !== EQUIPMENT_TAB_INDEX && (
                <EquipmentManagementPanel
                  key={`${currentProject.id}:calendar-create-equipment`}
                  projectId={currentProject.id}
                  onUpdate={async () => {
                    const updated = await castingService.getProject(currentProject.id);
                    if (updated) setCurrentProject(updated);
                  }}
                  externalCreateSignal={externalEquipmentCreateSignal}
                  onExternalCreated={handleExternalEquipmentCreated}
                  onExternalCreateCancelled={handleExternalEquipmentCreateCancelled}
                />
              )}
            </Suspense>
          </ErrorBoundary>
        </Box>
      )}


      {/* Role Dialog - Optimized */}
      <Dialog
        open={!!roleDialogOpen}
        onClose={() => { setRoleDialogOpen(false); setSelectedRole(null); }}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
        container={() => document.body}
        TransitionComponent={Grow}
        PaperProps={{
          sx: {
            '--dialog-accent-color': roleDialogAccentColor,
            '--dialog-accent-soft': alpha(roleDialogAccentColor, 0.45),
            '--dialog-accent-hover': alpha(roleDialogAccentColor, 0.15),
            '--dialog-accent-selected': alpha(roleDialogAccentColor, 0.25),
            '--dialog-accent-selected-hover': alpha(roleDialogAccentColor, 0.35),
            '--dialog-surface': 'rgba(20,14,48,0.94)',
            '--dialog-surface-muted': 'rgba(33,24,70,0.74)',
            '--dialog-border-color': 'rgba(184,107,255,0.34)',
            '--dialog-text': '#ffffff',
            '--dialog-text-muted': '#ffffff',
            bgcolor: 'var(--dialog-surface)',
            color: 'var(--dialog-text)',
            border: '1px solid var(--dialog-border-color)',
            borderRadius: { xs: 0, sm: 2.5 },
            width: '100%',
            maxWidth: { xs: '100vw', sm: '92vw', md: '90vw', lg: 1180 },
            zIndex: Z_INDEX.dialog,
            backgroundImage: [
              'linear-gradient(180deg, rgba(8,5,20,0.9) 0%, rgba(10,7,28,0.9) 100%)',
              'radial-gradient(circle at 16% -24%, rgba(184,107,255,0.28), transparent 55%)',
              'radial-gradient(circle at 82% -10%, rgba(106,76,207,0.24), transparent 48%)',
              roleDialogBackdrop,
            ].join(', '),
            backgroundSize: 'auto, auto, auto, cover',
            backgroundPosition: 'center, center, center, center',
            backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
            boxShadow: '0 28px 52px rgba(0,0,0,0.46)',
            overflow: 'hidden',
          },
        }}
        sx={{
          zIndex: Z_INDEX.dialog,
          '& .MuiBackdrop-root': {
            bgcolor: 'rgba(8,5,20,0.86)',
            backdropFilter: 'blur(3px)',
            zIndex: Z_INDEX.backdrop,
          },
        }}
      >
        <DialogTitle sx={{ 
          color: 'var(--dialog-text)', 
          borderBottom: '1px solid var(--dialog-border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: { xs: 2.25, sm: 2.5 },
          px: { xs: 2.5, sm: 3.5 },
          background: 'linear-gradient(180deg, rgba(184,107,255,0.14) 0%, rgba(184,107,255,0.04) 100%)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TheaterComedyIcon sx={{ color: roleDialogAccentColor, fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {selectedRole?.id && !selectedRole.name ? branding.tokens.labels.roleDialogNewTitle : branding.tokens.labels.roleDialogEditTitle}
              </Typography>
              {selectedRole?.name && (
                <Typography variant="body2" sx={{ color: 'var(--dialog-text)' }}>
                  {selectedRole.name}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton
            onClick={() => { setRoleDialogOpen(false); setSelectedRole(null); }}
            sx={{
              color: 'var(--dialog-text)',
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            pt: { xs: 3, sm: 3.5 },
            px: { xs: 2.5, sm: 3.5, md: 4 },
            pb: { xs: 3.25, sm: 3.75 },
            maxHeight: { xs: 'none', sm: '72vh' },
            overflowY: 'auto',
          }}
        >
          {selectedRole && (
            <Grid
              container
              alignItems="flex-start"
              rowSpacing={{ xs: 3.5, md: 0 }}
              columnSpacing={{ xs: 0, md: 0 }}
            >
              {/* Left Column - Basic Info */}
              <Grid size={{ xs: 12, md: 5 }} sx={{ pr: { md: 2.5 } }}>
                <Box
                  sx={{
                    height: '100%',
                    p: { xs: 2, sm: 2.25, md: 2.5 },
                    borderRadius: 2.25,
                    border: '1px solid var(--dialog-border-color)',
                    bgcolor: 'transparent',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                  }}
                >
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2.5, px: 1, ml: -1, mt: -3.2, bgcolor: 'var(--dialog-surface)' }}>
                  <PersonNameIcon sx={{ color: roleDialogAccentColor, fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ color: 'var(--dialog-text)', fontWeight: 600 }}>
                    {branding.tokens.labels.roleBasicsSectionLabel}
                  </Typography>
                </Box>
                <Stack spacing={{ xs: 2.75, sm: 3, md: 3.25 }}>
                  <TextField
                    label={branding.tokens.labels.roleNameLabel}
                    value={selectedRole.name}
                    onChange={(e) => setSelectedRole({ ...selectedRole, name: e.target.value })}
                    fullWidth
                    required
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <TheaterComedyIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                  <Box>
                    <Typography
                      sx={{
                        color: 'var(--dialog-text)',
                        fontSize: { xs: '0.82rem', sm: '0.86rem', md: '0.84rem', lg: '0.9rem', xl: '0.96rem' },
                        mb: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <NotesIcon sx={{ color: 'rgba(255,255,255,0.92)', fontSize: 20 }} />
                      {branding.tokens.labels.roleDescriptionLabel}
                    </Typography>
                    <Box
                      sx={{
                        '& > .MuiBox-root': {
                          borderColor: 'var(--dialog-border-color)',
                        },
                        '& > .MuiBox-root:focus-within': {
                          borderColor: 'var(--dialog-accent-color)',
                        },
                        '& .tiptap': {
                          color: '#ffffff',
                          minHeight: { xs: 220, sm: 250, md: 280 },
                          fontSize: { xs: '0.92rem', sm: '0.95rem', md: '1rem' },
                          lineHeight: 1.65,
                        },
                        '& .tiptap p, & .tiptap li, & .tiptap h2': {
                          color: '#ffffff',
                        },
                        '& .tiptap p.is-editor-empty:first-of-type::before': {
                          color: 'rgba(255,255,255,0.72)',
                        },
                        '& .MuiIconButton-root': {
                          color: '#ffffff',
                        },
                      }}
                    >
                      <RichTextEditor
                        value={toRichTextContent(selectedRole.description || '')}
                        onChange={(value) => setSelectedRole({ ...selectedRole, description: value })}
                        placeholder="Skriv rollebeskrivelse, bakgrunn, tone og viktig informasjon..."
                        minHeight={{ xs: 220, sm: 250, md: 280 }}
                        accentColor={roleDialogAccentColor}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2.25 }}>
                    <TextField
                      label={branding.tokens.labels.roleMinAgeLabel}
                      type="number"
                      value={selectedRole.requirements.age?.min || ''}
                      onChange={(e) => setSelectedRole({
                        ...selectedRole,
                        requirements: { ...selectedRole.requirements, age: { ...selectedRole.requirements.age, min: e.target.value ? parseInt(e.target.value) : undefined } },
                      })}
                      size="small"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccessTimeIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 18 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={textFieldStyles}
                    />
                    <TextField
                      label={branding.tokens.labels.roleMaxAgeLabel}
                      type="number"
                      value={selectedRole.requirements.age?.max || ''}
                      onChange={(e) => setSelectedRole({
                        ...selectedRole,
                        requirements: { ...selectedRole.requirements, age: { ...selectedRole.requirements.age, max: e.target.value ? parseInt(e.target.value) : undefined } },
                      })}
                      size="small"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccessTimeIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 18 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={textFieldStyles}
                    />
                  </Box>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.genderLabel}</InputLabel>
                    <Select
                      value={selectedRole.requirements.gender?.[0] || ''}
                      MenuProps={selectMenuProps}
                      onChange={(e) => setSelectedRole({
                        ...selectedRole,
                        requirements: { ...selectedRole.requirements, gender: e.target.value ? [e.target.value as string] : undefined },
                      })}
                      startAdornment={
                        <InputAdornment position="start">
                          <TransgenderIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20, ml: 1 }} />
                        </InputAdornment>
                      }
                      sx={roleDialogSelectStyles}
                    >
                      <MenuItem value="mann">{branding.tokens.labels.genderMaleLabel}</MenuItem>
                      <MenuItem value="kvinne">{branding.tokens.labels.genderFemaleLabel}</MenuItem>
                      <MenuItem value="ikke-binær">{branding.tokens.labels.genderNonBinaryLabel}</MenuItem>
                      <MenuItem value="alle">{branding.tokens.labels.genderAllLabel}</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.statusLabel}</InputLabel>
                    <Select
                      value={selectedRole.status}
                      MenuProps={selectMenuProps}
                      onChange={(e) => setSelectedRole({ ...selectedRole, status: e.target.value as Role['status'] })}
                      startAdornment={
                        <InputAdornment position="start">
                          <CheckCircleOutlineIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20, ml: 1 }} />
                        </InputAdornment>
                      }
                      sx={roleDialogSelectStyles}
                    >
                      <MenuItem value="draft">{branding.tokens.labels.roleStatusDraft}</MenuItem>
                      <MenuItem value="open">{branding.tokens.labels.roleStatusOpen}</MenuItem>
                      <MenuItem value="casting">{branding.tokens.labels.roleStatusCasting}</MenuItem>
                      <MenuItem value="filled">{branding.tokens.labels.roleStatusFilled}</MenuItem>
                      <MenuItem value="cancelled">{branding.tokens.labels.roleStatusCancelled}</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                </Box>
              </Grid>

              {/* Right Column - Requirements */}
              <Grid
                size={{ xs: 12, md: 7 }}
                sx={{
                  pl: { md: 2.5 },
                  borderLeft: { md: '1px solid var(--dialog-border-color)' },
                  minHeight: { md: '100%' },
                  display: 'flex',
                }}
              >
                <Box
                  sx={{
                    width: { xs: '100%', md: 360, lg: 390, xl: 420 },
                    p: { xs: 2.25, sm: 2.5, md: 2.75 },
                    borderRadius: 2.25,
                    border: '1px solid var(--dialog-border-color)',
                    bgcolor: 'transparent',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                  }}
                >
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2.5, px: 1, ml: -1, mt: -3.2, bgcolor: 'var(--dialog-surface)' }}>
                  <AssignmentIcon sx={{ color: roleDialogAccentColor, fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ color: 'var(--dialog-text)', fontWeight: 600 }}>
                    {branding.tokens.labels.roleRequirementsSectionLabel}
                  </Typography>
                </Box>
                <Stack spacing={{ xs: 3, sm: 3.5, md: 3.75 }}>
                  <TextField
                    label={branding.tokens.labels.roleAppearanceLabel}
                    value={selectedRole.requirements.appearance?.join(', ') || ''}
                    onChange={(e) => setSelectedRole({
                      ...selectedRole,
                      requirements: { ...selectedRole.requirements, appearance: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(s => s) : undefined },
                    })}
                    fullWidth
                    size="small"
                    placeholder={branding.tokens.labels.roleAppearancePlaceholder}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <FaceIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                  <TextField
                    label={branding.tokens.labels.roleSkillsLabel}
                    value={selectedRole.requirements.skills?.join(', ') || ''}
                    onChange={(e) => setSelectedRole({
                      ...selectedRole,
                      requirements: { ...selectedRole.requirements, skills: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(s => s) : undefined },
                    })}
                    fullWidth
                    size="small"
                    placeholder={branding.tokens.labels.roleSkillsPlaceholder}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <WorkIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                  <TextField
                    label={branding.tokens.labels.roleSpecialNeedsLabel}
                    value={selectedRole.requirements.specialNeeds?.join(', ') || ''}
                    onChange={(e) => setSelectedRole({
                      ...selectedRole,
                      requirements: { ...selectedRole.requirements, specialNeeds: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(s => s) : undefined },
                    })}
                    fullWidth
                    size="small"
                    placeholder={branding.tokens.labels.roleSpecialNeedsPlaceholder}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CheckroomIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      pt: { xs: 1.5, sm: 1.75, md: 2.1 },
                      pb: { xs: 0.75, sm: 1.1, md: 1.35 },
                      borderTop: '1px solid var(--dialog-border-color)',
                    }}
                  >
                    <AssignmentIcon sx={{ color: roleDialogAccentColor, fontSize: 18 }} />
                    <Typography variant="caption" sx={{ color: 'var(--dialog-text)', letterSpacing: 0.3, fontWeight: 700, textTransform: 'uppercase' }}>
                      Tilknytninger
                    </Typography>
                  </Box>
                  <Stack spacing={{ xs: 2.35, sm: 2.6, md: 2.9 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel shrink sx={attachmentInputLabelStyles}>{branding.tokens.labels.roleScenesLabel}</InputLabel>
                      <Select
                        multiple
                        value={selectedRole.sceneIds || []}
                        MenuProps={selectMenuProps}
                        onChange={(e) => setSelectedRole({ ...selectedRole, sceneIds: e.target.value as string[] })}
                        startAdornment={
                          <InputAdornment position="start">
                            <ShotListIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20, ml: 1 }} />
                          </InputAdornment>
                        }
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, py: 0.2 }}>
                            {(selected as string[]).map((sceneId) => (
                              <Chip key={sceneId} label={availableScenes.find(s => s.id === sceneId)?.name || sceneId} size="small" sx={{ bgcolor: roleDialogAccentSoftColor, color: '#ffffff', height: 22 }} />
                            ))}
                          </Box>
                        )}
                        sx={roleDialogSelectStyles}
                      >
                        {availableScenes.map((scene) => (
                          <MenuItem key={scene.id} value={scene.id}>{scene.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {currentProject && (
                      <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 2.2, sm: 2.4, md: 2.7 } }}>
                          <FormControl fullWidth size="small">
                            <InputLabel shrink sx={attachmentInputLabelStyles}>{branding.tokens.labels.roleCrewLabel}</InputLabel>
                            <Select
                              multiple
                              value={selectedRole.crewRequirements || []}
                              MenuProps={selectMenuProps}
                              onChange={(e) => setSelectedRole({ ...selectedRole, crewRequirements: e.target.value as string[] })}
                              startAdornment={
                                <InputAdornment position="start">
                                  <GroupsIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20, ml: 1 }} />
                                </InputAdornment>
                              }
                              renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, py: 0.2 }}>
                                  {(selected as string[]).map((crewId) => (
                                    <Chip key={crewId} label={(currentProject?.crew || []).find(c => c.id === crewId)?.name || crewId} size="small" sx={{ bgcolor: roleDialogAccentSoftColor, color: '#ffffff', height: 22 }} />
                                  ))}
                                </Box>
                              )}
                              sx={roleDialogSelectStyles}
                            >
                              {(currentProject?.crew || []).map((crew) => (
                                <MenuItem key={crew.id} value={crew.id}>{crew.name}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl fullWidth size="small">
                            <InputLabel shrink sx={attachmentInputLabelStyles}>{branding.tokens.labels.roleLocationsLabel}</InputLabel>
                            <Select
                              multiple
                              value={selectedRole.locationRequirements || []}
                              MenuProps={selectMenuProps}
                              onChange={(e) => setSelectedRole({ ...selectedRole, locationRequirements: e.target.value as string[] })}
                              startAdornment={
                                <InputAdornment position="start">
                                  <LocationIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20, ml: 1 }} />
                                </InputAdornment>
                              }
                              renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, py: 0.2 }}>
                                  {(selected as string[]).map((locId) => (
                                    <Chip key={locId} label={(currentProject?.locations || []).find(l => l.id === locId)?.name || locId} size="small" sx={{ bgcolor: roleDialogAccentSoftColor, color: '#ffffff', height: 22 }} />
                                  ))}
                                </Box>
                              )}
                              sx={roleDialogSelectStyles}
                            >
                              {(currentProject?.locations || []).map((loc) => (
                                <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl fullWidth size="small" sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                            <InputLabel shrink sx={attachmentInputLabelStyles}>{branding.tokens.labels.rolePropsLabel}</InputLabel>
                            <Select
                              multiple
                              value={selectedRole.propRequirements || []}
                              MenuProps={selectMenuProps}
                              onChange={(e) => setSelectedRole({ ...selectedRole, propRequirements: e.target.value as string[] })}
                              startAdornment={
                                <InputAdornment position="start">
                                  <EquipmentIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20, ml: 1 }} />
                                </InputAdornment>
                              }
                              renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, py: 0.2 }}>
                                  {(selected as string[]).map((propId) => (
                                    <Chip key={propId} label={(currentProject?.props || []).find(p => p.id === propId)?.name || propId} size="small" sx={{ bgcolor: roleDialogAccentSoftColor, color: '#ffffff', height: 22 }} />
                                  ))}
                                </Box>
                              )}
                              sx={roleDialogSelectStyles}
                            >
                              {(currentProject?.props || []).map((prop) => (
                                <MenuItem key={prop.id} value={prop.id}>{prop.name}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      </>
                    )}
                  </Stack>
                </Stack>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: '1px solid var(--dialog-border-color)',
            px: { xs: 2.25, sm: 3, md: 3.25 },
            py: { xs: 1.6, sm: 1.85, md: 1.95 },
            gap: 1.2,
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
            justifyContent: 'flex-end',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.03) 100%)',
          }}
        >
          <Button
            onClick={() => { setRoleDialogOpen(false); setSelectedRole(null); }}
            sx={{
              color: 'var(--dialog-text)',
              minHeight: TOUCH_TARGET_SIZE,
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
            }}
          >
            {branding.tokens.labels.cancelLabel}
          </Button>
          <Button
            onClick={handleSaveRole}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{
              bgcolor: roleDialogAccentColor,
              color: '#ffffff',
              fontWeight: 700,
              minHeight: TOUCH_TARGET_SIZE,
              px: 2.25,
              boxShadow: '0 8px 20px rgba(0,0,0,0.24)',
              '&:hover': { bgcolor: roleDialogAccentColor, filter: 'brightness(0.92)', boxShadow: '0 10px 24px rgba(0,0,0,0.3)' },
            }}
          >
            {branding.tokens.labels.saveRoleLabel}
          </Button>
          {selectedRole?.id && selectedRole.name && (
            <Button
              onClick={() => { handleDeleteRole(selectedRole.id); setRoleDialogOpen(false); setSelectedRole(null); }}
              startIcon={<DeleteIcon />}
              sx={{
                color: '#ffffff',
                minHeight: TOUCH_TARGET_SIZE,
                border: '1px solid rgba(239,68,68,0.36)',
                bgcolor: 'rgba(239,68,68,0.08)',
                '&:hover': { bgcolor: 'rgba(239,68,68,0.15)' },
              }}
            >
              {branding.tokens.labels.deleteLabel}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Candidate Dialog */}
      <Dialog
        open={candidateDialogOpen}
        onClose={closeCandidateDialog}
        maxWidth="lg"
        fullWidth
        container={() => document.body}
        TransitionComponent={Grow}
        TransitionProps={{
          timeout: { enter: 225, exit: 150 },
          enter: true,
          exit: true,
        }}
        PaperProps={{
          sx: {
            '--dialog-accent-color': roleDialogAccentColor,
            '--dialog-accent-soft': alpha(roleDialogAccentColor, 0.45),
            '--dialog-accent-hover': alpha(roleDialogAccentColor, 0.15),
            '--dialog-accent-selected': alpha(roleDialogAccentColor, 0.25),
            '--dialog-accent-selected-hover': alpha(roleDialogAccentColor, 0.35),
            '--dialog-surface': 'rgba(20,14,48,0.94)',
            '--dialog-surface-muted': 'rgba(33,24,70,0.74)',
            '--dialog-border-color': 'rgba(184,107,255,0.34)',
            '--dialog-text': '#ffffff',
            '--dialog-text-muted': '#ffffff',
            bgcolor: 'var(--dialog-surface)',
            color: 'var(--dialog-text)',
            border: '1px solid var(--dialog-border-color)',
            borderRadius: { xs: 0, sm: 2.5 },
            width: '100%',
            maxWidth: { xs: '100vw', sm: '92vw', md: '90vw', lg: 1180 },
            zIndex: Z_INDEX.dialog,
            backgroundImage: [
              'linear-gradient(180deg, rgba(8,5,20,0.9) 0%, rgba(10,7,28,0.9) 100%)',
              'radial-gradient(circle at 16% -24%, rgba(184,107,255,0.28), transparent 55%)',
              'radial-gradient(circle at 82% -10%, rgba(106,76,207,0.24), transparent 48%)',
              roleDialogBackdrop,
            ].join(', '),
            backgroundSize: 'auto, auto, auto, cover',
            backgroundPosition: 'center, center, center, center',
            backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
            boxShadow: '0 28px 52px rgba(0,0,0,0.46)',
            overflow: 'hidden',
          },
        }}
        sx={{
          zIndex: Z_INDEX.dialog,
          '& .MuiBackdrop-root': {
            zIndex: Z_INDEX.backdrop,
            bgcolor: 'rgba(8,5,20,0.86)',
            backdropFilter: 'blur(3px)',
          },
        }}
      >
        <DialogTitle sx={{ 
          color: 'var(--dialog-text)',
          borderBottom: '1px solid var(--dialog-border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: { xs: 2.25, sm: 2.5 },
          px: { xs: 2.5, sm: 3.5 },
          background: 'linear-gradient(180deg, rgba(184,107,255,0.14) 0%, rgba(184,107,255,0.04) 100%)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <RecentActorsIcon sx={{ fontSize: '1.5rem', color: roleDialogAccentColor }} />
            <Typography variant="h6" sx={{ fontSize: '1.125rem', fontWeight: 700 }}>
              {selectedCandidate?.id && !selectedCandidate.name ? branding.tokens.labels.candidateDialogNewTitle : branding.tokens.labels.candidateDialogEditTitle}
            </Typography>
          </Box>
          <IconButton
            onClick={closeCandidateDialog}
            sx={{
              color: 'var(--dialog-text)',
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: { xs: 3, sm: 3.5 }, px: { xs: 2.5, sm: 3.5, md: 4 }, pb: { xs: 3.25, sm: 3.75 }, maxHeight: { xs: 'none', sm: '72vh' }, overflowY: 'auto', overflowX: 'hidden' }}>
          {selectedCandidate && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: { xs: 2.5, sm: 2.75, md: 3 },
                p: { xs: 2, sm: 2.5, md: 2.75 },
                borderRadius: 2.25,
                border: '1px solid var(--dialog-border-color)',
                bgcolor: 'var(--dialog-surface-muted)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
              }}
            >
              <TextField
                label={branding.tokens.labels.nameLabel}
                value={selectedCandidate.name}
                onChange={(e) => setSelectedCandidate({ ...selectedCandidate, name: e.target.value })}
                fullWidth
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonNameIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' } }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  ...textFieldStyles,
                  mt: { xs: 0.5, sm: 0.75 },
                }}
              />
              
              <TextField
                label={branding.tokens.labels.emailLabel}
                value={selectedCandidateContactInfo.email || ''}
                onChange={(e) => setSelectedCandidate({
                  ...selectedCandidate,
                  contactInfo: { ...selectedCandidateContactInfo, email: e.target.value },
                })}
                fullWidth
                type="email"
                inputMode="email"
                autoComplete="email"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CustomEmailIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' } }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  ...textFieldStyles,
                }}
              />
              
              <TextField
                label={branding.tokens.labels.phoneLabel}
                value={selectedCandidateContactInfo.phone || ''}
                onChange={(e) => setSelectedCandidate({
                  ...selectedCandidate,
                  contactInfo: { ...selectedCandidateContactInfo, phone: e.target.value },
                })}
                fullWidth
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CustomPhoneIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' } }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  ...textFieldStyles,
                }}
              />
              
              <TextField
                label={branding.tokens.labels.addressLabel}
                value={selectedCandidateContactInfo.address || ''}
                onChange={(e) => setSelectedCandidate({
                  ...selectedCandidate,
                  contactInfo: { ...selectedCandidateContactInfo, address: e.target.value },
                })}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AddressIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' } }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  ...textFieldStyles,
                }}
              />
              
              <Box sx={{ mt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <ImageIcon sx={{ color: 'var(--dialog-accent-color)', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.3125rem', lg: '1.4375rem', xl: '1.5rem' } }} />
                  <Typography variant="subtitle2" sx={{ color: 'var(--dialog-accent-color)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                    {branding.tokens.labels.mediaSectionLabel}
                  </Typography>
                </Box>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    const nextPhotos: string[] = [...(selectedCandidate.photos || [])];
                    const nextVideos: string[] = [...(selectedCandidate.videos || [])];
                    const nextPhotoFocalPoints: CandidatePhotoFocalPoint[] = [
                      ...getCandidatePhotoFocalPoints(selectedCandidate),
                    ];
                    
                    files.forEach((file) => {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const result = event.target?.result;
                        if (typeof result !== 'string') return;
                        if (file.type.startsWith('image/')) {
                          nextPhotos.push(result);
                          nextPhotoFocalPoints.push({ ...DEFAULT_CANDIDATE_FOCAL_POINT });
                        } else if (file.type.startsWith('video/')) {
                          nextVideos.push(result);
                        }
                        setSelectedCandidate(prev => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            photos: [...nextPhotos],
                            videos: [...nextVideos],
                            photoFocalPoints: [...nextPhotoFocalPoints],
                          };
                        });
                      };
                      reader.readAsDataURL(file);
                    });
                    e.currentTarget.value = '';
                  }}
                  style={{ display: 'none' }}
                  id="candidate-media-upload"
                />
                <label htmlFor="candidate-media-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<CloudUploadIcon />}
                    sx={{
                      borderColor: 'var(--dialog-border-color)',
                      color: '#fff',
                      '&:hover': { borderColor: 'var(--dialog-accent-color)', bgcolor: 'var(--dialog-accent-hover)' },
                      minHeight: TOUCH_TARGET_SIZE,
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                      py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                    }}
                  >
                    {branding.tokens.labels.uploadMediaLabel}
                  </Button>
                </label>
                {(selectedCandidate.photos?.length ?? 0) > 0 && (
                  <Box sx={{ mt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mb: 1,
                        color: 'rgba(255,255,255,0.8)',
                      }}
                    >
                      Klikk på et bilde for å velge fokuspunkt. Første bilde brukes som profilbilde.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, flexWrap: 'wrap' }}>
                      {(selectedCandidate.photos || []).map((photo, idx) => {
                        const focalPoint = candidatePhotoFocalPoints[idx] || DEFAULT_CANDIDATE_FOCAL_POINT;
                        return (
                          <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Box
                              component="button"
                              type="button"
                              onClick={(event: MouseEvent<HTMLButtonElement>) => handleCandidatePhotoFocalPointClick(event, idx)}
                              title="Velg fokuspunkt"
                              sx={{
                                position: 'relative',
                                display: 'block',
                                p: 0,
                                m: 0,
                                width: { xs: 60, sm: 70, md: 65, lg: 80, xl: 90 },
                                height: { xs: 60, sm: 70, md: 65, lg: 80, xl: 90 },
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 1,
                                overflow: 'hidden',
                                background: 'transparent',
                                cursor: 'crosshair',
                              }}
                            >
                              <Box
                                component="img"
                                src={photo}
                                alt={branding.tokens.labels.candidatePhotoAltLabel.replace('{index}', String(idx + 1))}
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  objectPosition: `${focalPoint.x}% ${focalPoint.y}%`,
                                }}
                              />
                              <Box
                                sx={{
                                  position: 'absolute',
                                  left: `${focalPoint.x}%`,
                                  top: `${focalPoint.y}%`,
                                  transform: 'translate(-50%, -50%)',
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--dialog-accent-color)',
                                  border: '2px solid #ffffff',
                                  boxShadow: '0 0 0 2px rgba(0,0,0,0.45)',
                                  pointerEvents: 'none',
                                }}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.7rem' }}>
                              Fokus: {Math.round(focalPoint.x)}% / {Math.round(focalPoint.y)}%
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                              {idx === 0 ? (
                                <Chip
                                  size="small"
                                  label="Primær"
                                  sx={{
                                    height: 22,
                                    bgcolor: 'rgba(184,107,255,0.25)',
                                    color: '#fff',
                                    border: '1px solid rgba(184,107,255,0.45)',
                                  }}
                                />
                              ) : (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleSetPrimaryCandidatePhoto(idx)}
                                  sx={{
                                    minWidth: 0,
                                    px: 1,
                                    py: 0.25,
                                    fontSize: '0.7rem',
                                    borderColor: 'rgba(184,107,255,0.4)',
                                    color: 'rgba(255,255,255,0.87)',
                                  }}
                                >
                                  Sett som primær
                                </Button>
                              )}
                              <Button
                                size="small"
                                variant="text"
                                startIcon={<DeleteIcon sx={{ fontSize: 14 }} />}
                                onClick={() => handleDeleteCandidatePhoto(idx)}
                                sx={{
                                  minWidth: 0,
                                  px: 0.75,
                                  py: 0.25,
                                  fontSize: '0.7rem',
                                  color: 'rgba(255,130,130,0.95)',
                                  '&:hover': { bgcolor: 'rgba(255,82,82,0.12)' },
                                }}
                              >
                                Slett
                              </Button>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </Box>
              
              <TextField
                label={branding.tokens.labels.auditionNotesLabel}
                value={selectedCandidate.auditionNotes}
                onChange={(e) => setSelectedCandidate({ ...selectedCandidate, auditionNotes: e.target.value })}
                fullWidth
                multiline
                rows={4}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <NoteIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: isDesktop ? '1.25rem' : '1rem' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mt: 2,
                  ...textFieldStyles,
                }}
              />

              <GlobalMentionHelper
                text={typeof selectedCandidate.auditionNotes === 'string' ? selectedCandidate.auditionNotes : ''}
                localCandidates={selectionMentionCandidates}
                autoTagTitle="Auto-tagget"
                suggestionTitle="Mener du?"
                onApplySuggestion={handleApplyAuditionSuggestion}
              />
              
              <FormControl fullWidth size="small">
                <InputLabel sx={inputLabelStyles}>
                  {branding.tokens.labels.assignedRolesLabel}
                </InputLabel>
                <Select
                  multiple
                  value={selectedCandidateAssignedRoles}
                  MenuProps={selectMenuProps}
                  onChange={(e) => setSelectedCandidate({
                    ...selectedCandidate,
                    assignedRoles: e.target.value as string[],
                    assigned_roles: e.target.value as string[],
                  })}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((roleId) => {
                        const role = roles.find(r => r.id === roleId);
                        return (
                          <Chip
                            key={roleId}
                            label={role?.name || roleId}
                            size="small"
                            sx={{ bgcolor: roleDialogAccentSoftColor, color: '#ffffff' }}
                          />
                        );
                      })}
                    </Box>
                  )}
                  sx={roleDialogSelectStyles}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id} sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                        <AssignmentIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />
                        <span>{role.name}</span>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth size="small">
                <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.statusLabel}</InputLabel>
                <Select
                  value={selectedCandidateDialogStatus}
                  MenuProps={selectMenuProps}
                  onChange={(e) => setSelectedCandidate({
                    ...selectedCandidate,
                    status: e.target.value as Candidate['status'],
                  })}
                  sx={roleDialogSelectStyles}
                >
                  <MenuItem value="pending" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      <ScheduleIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />
                      <span>{branding.tokens.labels.candidateStatusPending}</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="requested" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      <PeopleIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />
                      <span>{branding.tokens.labels.candidateStatusRequested}</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="shortlist" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      <CheckCircleOutlineIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />
                      <span>{branding.tokens.labels.candidateStatusShortlist}</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="selected" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      <CheckCircleIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />
                      <span>{branding.tokens.labels.candidateStatusSelected}</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="confirmed" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      <CheckCircleIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />
                      <span>{branding.tokens.labels.candidateStatusConfirmed}</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="rejected" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      <CancelIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />
                      <span>{branding.tokens.labels.candidateStatusRejected}</span>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, mt: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 }, mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                <ContactEmergencyIcon sx={{ color: 'var(--dialog-accent-color)', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.3125rem', lg: '1.4375rem', xl: '1.5rem' } }} />
                <Typography variant="subtitle2" sx={{ 
                  color: 'var(--dialog-accent-color)', 
                  fontSize: { xs: '1rem', sm: '1.0625rem', md: '1.03125rem', lg: '1.09375rem', xl: '1.125rem' },
                  fontWeight: 600,
                }}>
                  {branding.tokens.labels.emergencyContactSectionLabel}
                </Typography>
              </Box>
              <TextField
                label={branding.tokens.labels.nameLabel}
                value={selectedCandidate.emergencyContact?.name || ''}
                onChange={(e) => setSelectedCandidate({
                  ...selectedCandidate,
                  emergencyContact: {
                    ...selectedCandidate.emergencyContact,
                    name: e.target.value,
                  },
                })}
                fullWidth
                sx={{
                  ...textFieldStyles,
                }}
              />
              <TextField
                label={branding.tokens.labels.phoneLabel}
                value={selectedCandidate.emergencyContact?.phone || ''}
                onChange={(e) => setSelectedCandidate({
                  ...selectedCandidate,
                  emergencyContact: {
                    ...selectedCandidate.emergencyContact,
                    phone: e.target.value,
                  },
                })}
                fullWidth
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                sx={{
                  mt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                  ...textFieldStyles,
                }}
              />
              <TextField
                label={branding.tokens.labels.relationshipLabel}
                value={selectedCandidate.emergencyContact?.relationship || ''}
                onChange={(e) => setSelectedCandidate({
                  ...selectedCandidate,
                  emergencyContact: {
                    ...selectedCandidate.emergencyContact,
                    relationship: e.target.value,
                  },
                })}
                fullWidth
                sx={{
                  mt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                  ...textFieldStyles,
                }}
              />

              {/* Consent Section */}
              {selectedCandidate.id && currentProject ? (
                <Box sx={{ mt: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 } }}>
                  {/* Quick consent status check via consentService */}
                  <ConsentStatusSummary projectId={currentProject.id} candidateId={selectedCandidate.id} />
                  <Suspense
                    fallback={
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={24} sx={{ color: 'var(--dialog-accent-color)' }} />
                      </Box>
                    }
                  >
                    <ConsentManagementPanel
                      key={`${currentProject.id}:${selectedCandidate.id}`}
                      projectId={currentProject.id}
                      candidateId={selectedCandidate.id}
                      onUpdate={() => {
                        loadProjects();
                      }}
                    />
                  </Suspense>
                </Box>
              ) : (
                /* For new candidates - show option to send consent on save */
                <Box sx={{ 
                  mt: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 },
                  p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                  bgcolor: 'var(--dialog-accent-hover)',
                  borderRadius: 2,
                  border: '1px solid var(--dialog-border-color)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                    <ConsentsIcon sx={{ color: 'var(--dialog-accent-color)', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.3125rem', lg: '1.4375rem', xl: '1.5rem' } }} />
                    <Typography variant="subtitle2" sx={{ 
                      color: 'var(--dialog-accent-color)', 
                      fontSize: { xs: '1rem', sm: '1.0625rem', md: '1.03125rem', lg: '1.09375rem', xl: '1.125rem' },
                      fontWeight: 600,
                    }}>
                      {branding.tokens.labels.consentSectionLabel}
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={sendConsentOnSave}
                        onChange={(e) => setSendConsentOnSave(e.target.checked)}
                        sx={{ 
                          color: 'var(--dialog-accent-color)', 
                          '&.Mui-checked': { color: 'var(--dialog-accent-color)' },
                        }}
                      />
                    }
                    label={
                      <Typography sx={{ 
                        color: 'rgba(255,255,255,0.87)', 
                        fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      }}>
                        {branding.tokens.labels.sendConsentOnSaveLabel}
                      </Typography>
                    }
                  />
                  <Typography variant="caption" sx={{ 
                    display: 'block', 
                    color: 'rgba(255,255,255,0.87)', 
                    mt: 0.5,
                    ml: 4,
                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.875rem' },
                  }}>
                    {branding.tokens.labels.consentSendHelpText}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid var(--dialog-border-color)',
          px: { xs: 2.25, sm: 3, md: 3.25 },
          py: { xs: 1.6, sm: 1.85, md: 1.95 },
          gap: 1.2,
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
          justifyContent: 'flex-end',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.03) 100%)',
        }}>
          <Button
            onClick={closeCandidateDialog}
            startIcon={<CancelIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            sx={{ 
              color: 'var(--dialog-text)',
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(255,255,255,0.02)',
              px: 2.25,
              py: 1.15,
              minHeight: TOUCH_TARGET_SIZE,
              '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
            }}
          >
            {branding.tokens.labels.cancelLabel}
          </Button>
          <Button
            onClick={handleSaveCandidate}
            variant="contained"
            startIcon={<SaveIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            sx={{
              bgcolor: roleDialogAccentColor,
              color: '#ffffff',
              px: 2.25,
              py: 1.15,
              minHeight: TOUCH_TARGET_SIZE,
              fontWeight: 700,
              boxShadow: '0 8px 20px rgba(0,0,0,0.24)',
              '&:hover': { bgcolor: roleDialogAccentColor, filter: 'brightness(0.92)', boxShadow: '0 10px 24px rgba(0,0,0,0.3)' },
            }}
          >
            {branding.tokens.labels.saveLabel}
          </Button>
          {selectedCandidate?.id && selectedCandidate.name && (
            <Button
              onClick={() => { handleDeleteCandidate(selectedCandidate.id); closeCandidateDialog(); }}
              startIcon={<DeleteIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              sx={{
                color: '#ffffff',
                border: '1px solid rgba(239,68,68,0.36)',
                bgcolor: 'rgba(239,68,68,0.08)',
                px: 2.25,
                py: 1.15,
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { bgcolor: 'rgba(239,68,68,0.15)' },
              }}
            >
              {branding.tokens.labels.deleteLabel}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog
        open={scheduleDialogOpen}
        onClose={() => {
          setScheduleDialogOpen(false);
          setSelectedSchedule(null);
        }}
        maxWidth="lg"
        fullWidth
        container={() => document.body}
        TransitionComponent={Grow}
        TransitionProps={{
          timeout: { enter: 225, exit: 150 },
          enter: true,
          exit: true,
        }}
        PaperProps={{
          sx: {
            '--dialog-accent-color': roleDialogAccentColor,
            '--dialog-accent-soft': alpha(roleDialogAccentColor, 0.45),
            '--dialog-accent-hover': alpha(roleDialogAccentColor, 0.15),
            '--dialog-accent-selected': alpha(roleDialogAccentColor, 0.25),
            '--dialog-accent-selected-hover': alpha(roleDialogAccentColor, 0.35),
            '--dialog-surface': 'rgba(20,14,48,0.94)',
            '--dialog-surface-muted': 'rgba(33,24,70,0.74)',
            '--dialog-border-color': 'rgba(184,107,255,0.34)',
            '--dialog-text': '#ffffff',
            '--dialog-text-muted': '#ffffff',
            bgcolor: 'var(--dialog-surface)',
            color: 'var(--dialog-text)',
            border: '1px solid var(--dialog-border-color)',
            borderRadius: { xs: 0, sm: 2.5 },
            width: '100%',
            maxWidth: { xs: '100vw', sm: '92vw', md: '90vw', lg: 1120 },
            zIndex: Z_INDEX.dialog,
            willChange: 'transform, opacity',
            transformOrigin: 'center center',
            backgroundImage: [
              'linear-gradient(180deg, rgba(8,5,20,0.9) 0%, rgba(10,7,28,0.9) 100%)',
              'radial-gradient(circle at 16% -24%, rgba(184,107,255,0.28), transparent 55%)',
              'radial-gradient(circle at 82% -10%, rgba(106,76,207,0.24), transparent 48%)',
              roleDialogBackdrop,
            ].join(', '),
            backgroundSize: 'auto, auto, auto, cover',
            backgroundPosition: 'center, center, center, center',
            backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
            boxShadow: '0 28px 52px rgba(0,0,0,0.46)',
            overflow: 'hidden',
          },
        }}
        sx={{
          zIndex: Z_INDEX.dialog,
          '& .MuiBackdrop-root': {
            zIndex: Z_INDEX.backdrop,
            bgcolor: 'rgba(8,5,20,0.86)',
            backdropFilter: 'blur(3px)',
            willChange: 'opacity',
          },
        }}
      >
        <DialogTitle sx={{ 
          color: 'var(--dialog-text)', 
          borderBottom: '1px solid var(--dialog-border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          py: { xs: 2.25, sm: 2.5 },
          px: { xs: 2.5, sm: 3.5 },
          background: 'linear-gradient(180deg, rgba(184,107,255,0.14) 0%, rgba(184,107,255,0.04) 100%)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CalendarIcon sx={{ fontSize: '1.5rem', color: roleDialogAccentColor }} />
            <Typography variant="h6" sx={{ fontSize: '1.125rem', fontWeight: 600 }}>
              {selectedSchedule?.id && !selectedSchedule.date ? branding.tokens.labels.scheduleDialogNewTitle : branding.tokens.labels.scheduleDialogEditTitle}
            </Typography>
          </Box>
          <IconButton
            onClick={() => {
              setScheduleDialogOpen(false);
              setSelectedSchedule(null);
            }}
            size="small"
            sx={{
              color: 'var(--dialog-text)',
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: { xs: 3, sm: 3.5 }, px: { xs: 2.5, sm: 3.5, md: 4 }, pb: { xs: 3.25, sm: 3.75 }, maxHeight: { xs: 'none', sm: '72vh' }, overflowY: 'auto', overflowX: 'hidden' }}>
          {selectedSchedule && currentProject && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: { xs: 2.5, sm: 2.75, md: 3 },
                p: { xs: 2, sm: 2.5, md: 2.75 },
                borderRadius: 2.25,
                border: '1px solid var(--dialog-border-color)',
                bgcolor: 'var(--dialog-surface-muted)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.candidateLabel}</InputLabel>
                  <Select
                    value={selectedSchedule.candidateId}
                    MenuProps={selectMenuProps}
                    onChange={(e) => setSelectedSchedule({ ...selectedSchedule, candidateId: e.target.value })}
                    sx={roleDialogSelectStyles}
                  >
                    {candidates.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon sx={{ fontSize: '1rem' }} />
                          <span>{c.name}</span>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl fullWidth size="small">
                  <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.roleLabel}</InputLabel>
                  <Select
                    value={selectedSchedule.roleId}
                    MenuProps={selectMenuProps}
                    onChange={(e) => setSelectedSchedule({ ...selectedSchedule, roleId: e.target.value })}
                    sx={roleDialogSelectStyles}
                  >
                    {roles.map((r) => (
                      <MenuItem key={r.id} value={r.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AssignmentIcon sx={{ fontSize: '1rem' }} />
                          <span>{r.name}</span>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              
              <TextField
                label={branding.tokens.labels.dateLabel}
                type="date"
                value={selectedSchedule.date}
                onChange={(e) => setSelectedSchedule({ ...selectedSchedule, date: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: isDesktop ? '1.25rem' : '1rem' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  ...textFieldStyles,
                }}
              />
              
              <TextField
                label={branding.tokens.labels.timeLabel}
                type="time"
                value={selectedSchedule.time}
                onChange={(e) => setSelectedSchedule({ ...selectedSchedule, time: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AccessTimeIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: isDesktop ? '1.25rem' : '1rem' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  ...textFieldStyles,
                }}
              />
              
              <FormControl fullWidth size="small">
                <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.locationLabel}</InputLabel>
                <Select
                  value={selectedSchedule.locationId || ''}
                  MenuProps={selectMenuProps}
                  onChange={(e) => {
                    const locationId = e.target.value;
                    const selectedLocation = currentProject.locations?.find(l => l.id === locationId);
                    setSelectedSchedule({
                      ...selectedSchedule,
                      locationId: locationId || undefined,
                      location: selectedLocation?.name || '',
                    });
                  }}
                  sx={roleDialogSelectStyles}
                >
                  <MenuItem value="">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CloseIcon sx={{ fontSize: '1rem' }} />
                      <span>{branding.tokens.labels.noLocationLabel}</span>
                    </Box>
                  </MenuItem>
                  {(currentProject.locations || []).map((loc) => (
                    <MenuItem key={loc.id} value={loc.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationIcon sx={{ fontSize: '1rem', color: '#10b981' }} />
                        <Box>
                          <Typography sx={{ fontSize: 'inherit' }}>{loc.name}</Typography>
                          {loc.address && (
                            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.87)' }}>
                              {loc.address}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {/* Fritekst lokasjon som alternativ */}
              <TextField
                label={branding.tokens.labels.locationFallbackLabel}
                value={selectedSchedule.locationId ? '' : selectedSchedule.location}
                onChange={(e) => setSelectedSchedule({ 
                  ...selectedSchedule, 
                  location: e.target.value,
                  locationId: undefined 
                })}
                fullWidth
                disabled={!!selectedSchedule.locationId}
                placeholder={branding.tokens.labels.locationFallbackPlaceholder}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: isDesktop ? '1.25rem' : '1rem' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  ...textFieldStyles,
                  opacity: selectedSchedule.locationId ? 0.5 : 1,
                }}
              />
              
              <FormControl fullWidth size="small">
                <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.sceneOptionalLabel}</InputLabel>
                <Select
                  value={selectedSchedule.sceneId || ''}
                  MenuProps={selectMenuProps}
                  onChange={(e) => setSelectedSchedule({
                    ...selectedSchedule,
                    sceneId: e.target.value || undefined,
                  })}
                  sx={roleDialogSelectStyles}
                >
                  <MenuItem value="">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CloseIcon sx={{ fontSize: '1rem' }} />
                      <span>{branding.tokens.labels.noSceneLabel}</span>
                    </Box>
                  </MenuItem>
                  {availableScenes.map((scene) => (
                    <MenuItem key={scene.id} value={scene.id}>
                      {scene.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {/* Notes field - matching ProductionDayView style with animated icon */}
              <Box sx={{ mt: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    mb: 1,
                    bgcolor: 'var(--dialog-accent-hover)',
                    p: 1.5,
                    borderRadius: '8px',
                    border: '2px solid var(--dialog-border-color)',
                    ...KEYFRAMES_STYLES,
                  }}
                >
                  <Box
                    sx={{
                      width: isDesktop ? 40 : 32,
                      height: isDesktop ? 40 : 32,
                      borderRadius: 2,
                      bgcolor: 'rgba(184,107,255,0.2)',
                      border: '2px solid rgba(184,107,255,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <NoteIcon
                      sx={{
                        color: 'var(--dialog-accent-color)',
                        fontSize: isDesktop ? '1.5rem' : '1.125rem',
                        animation: 'writing 2.5s ease-in-out infinite',
                        filter: 'drop-shadow(0 2px 4px rgba(184,107,255,0.3))',
                      }}
                    />
                  </Box>
                  <Typography sx={{ color: 'var(--dialog-accent-color)', fontWeight: 700, fontSize: isDesktop ? '1rem' : '0.875rem' }}>
                    {branding.tokens.labels.notesLabel}
                  </Typography>
                </Box>
                <RichTextEditor
                  value={selectedSchedule.notes || ''}
                  onChange={(value) => setSelectedSchedule({ ...selectedSchedule, notes: value })}
                  placeholder={branding.tokens.labels.notesPlaceholder}
                  minHeight={120}
                  accentColor={roleDialogAccentColor}
                />
              </Box>
              
              <FormControl fullWidth size="small">
                <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.statusLabel}</InputLabel>
                <Select
                  value={selectedSchedule.status}
                  MenuProps={selectMenuProps}
                  onChange={(e) => setSelectedSchedule({
                    ...selectedSchedule,
                    status: e.target.value as Schedule['status'],
                  })}
                  sx={roleDialogSelectStyles}
                >
                  <MenuItem value="scheduled">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon sx={{ fontSize: '1rem' }} />
                      <span>{branding.tokens.labels.scheduleStatusScheduled}</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="completed">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon sx={{ fontSize: '1rem' }} />
                      <span>{branding.tokens.labels.scheduleStatusCompleted}</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="cancelled">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CancelIcon sx={{ fontSize: '1rem' }} />
                      <span>{branding.tokens.labels.scheduleStatusCancelled}</span>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid var(--dialog-border-color)',
          px: { xs: 2.25, sm: 3, md: 3.25 },
          py: { xs: 1.6, sm: 1.85, md: 1.95 },
          gap: 1.2,
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
          justifyContent: 'flex-end',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.03) 100%)',
        }}>
          <Button
            onClick={() => {
              setScheduleDialogOpen(false);
              setSelectedSchedule(null);
            }}
            startIcon={<CancelIcon />}
            sx={{ 
              color: 'var(--dialog-text)',
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(255,255,255,0.02)',
              px: 2.25,
              py: 1.15,
              minHeight: TOUCH_TARGET_SIZE,
              '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
            }}
          >
            {branding.tokens.labels.cancelLabel}
          </Button>
          <Button
            onClick={handleSaveSchedule}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{
              bgcolor: roleDialogAccentColor,
              color: '#ffffff',
              px: 2.25,
              py: 1.15,
              minHeight: TOUCH_TARGET_SIZE,
              fontWeight: 700,
              boxShadow: '0 8px 20px rgba(0,0,0,0.24)',
              '&:hover': { bgcolor: roleDialogAccentColor, filter: 'brightness(0.92)', boxShadow: '0 10px 24px rgba(0,0,0,0.3)' },
            }}
          >
            {branding.tokens.labels.saveLabel}
          </Button>
          {selectedSchedule?.id && selectedSchedule.date && (
            <Button
              onClick={() => { handleDeleteSchedule(selectedSchedule.id); setScheduleDialogOpen(false); setSelectedSchedule(null); }}
              startIcon={<DeleteIcon />}
              sx={{
                color: '#ffffff',
                border: '1px solid rgba(239,68,68,0.36)',
                bgcolor: 'rgba(239,68,68,0.08)',
                px: 2.25,
                py: 1.15,
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { bgcolor: 'rgba(239,68,68,0.15)' },
              }}
            >
              {branding.tokens.labels.deleteLabel}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={producerInboxOpen}
        onClose={() => setProducerInboxOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#111827',
            color: '#fff',
            borderRadius: 3,
            border: '1px solid rgba(125,211,252,0.14)',
            maxHeight: '82vh',
          },
        }}
        data-testid="role-room-inbox-dialog"
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(135deg, rgba(8,47,73,0.34) 0%, rgba(17,24,39,0.9) 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Badge color="error" badgeContent={producerInboxUnreadCount} invisible={producerInboxUnreadCount === 0}>
              <InboxIcon sx={{ color: '#7dd3fc' }} />
            </Badge>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 850, lineHeight: 1.15 }}>
                Innboks
              </Typography>
              <Typography sx={{ mt: 0.2, fontSize: '0.75rem', color: 'rgba(226,232,240,0.62)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentProject ? currentProject.name : 'Velg prosjekt for varsler'}
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Button
              size="small"
              onClick={() => { void reloadProducerInbox(); }}
              startIcon={producerInboxLoading ? <CircularProgress size={13} color="inherit" /> : <RefreshIcon sx={{ fontSize: 16 }} />}
              sx={{ textTransform: 'none', color: '#bae6fd', fontWeight: 800 }}
            >
              Oppdater
            </Button>
            <IconButton onClick={() => setProducerInboxOpen(false)} aria-label="Lukk innboks" sx={{ color: 'rgba(255,255,255,0.78)' }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {producerInboxError ? (
            <Alert severity="warning" sx={{ m: 2, bgcolor: 'rgba(120,53,15,0.28)', color: '#fde68a' }}>
              {producerInboxError}
            </Alert>
          ) : null}
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Typography sx={{ color: 'rgba(226,232,240,0.68)', fontSize: '0.82rem' }}>
                {visibleProducerInboxItems.length === 0
                  ? 'Ingen aktive meldinger akkurat nå.'
                  : `${visibleProducerInboxItems.length} aktive meldinger · ${producerInboxUnreadCount} uleste`}
              </Typography>
              {producerInboxUnreadCount > 0 ? (
                <Button
                  size="small"
                  onClick={() => { void markAllProducerInboxAsRead(); }}
                  sx={{ textTransform: 'none', color: '#86efac', fontWeight: 800, alignSelf: { xs: 'flex-start', sm: 'center' } }}
                >
                  Merk alle lest
                </Button>
              ) : null}
            </Stack>

            {producerInboxLoading && visibleProducerInboxItems.length === 0 ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={24} sx={{ color: '#38bdf8' }} />
              </Box>
            ) : null}

            {!producerInboxLoading && visibleProducerInboxItems.length === 0 ? (
              <Box sx={{ p: 2.25, borderRadius: 2.4, border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.04)' }}>
                <Typography sx={{ color: '#fff', fontWeight: 800 }}>Innboksen er tom</Typography>
                <Typography sx={{ mt: 0.35, color: 'rgba(226,232,240,0.62)', fontSize: '0.82rem' }}>
                  Klientbrief, godkjenninger, endringsønsker og leveransevarsler samles her når de oppstår.
                </Typography>
              </Box>
            ) : null}

            {visibleProducerInboxItems.map((item) => {
              const createdAtLabel = item.created_at
                ? new Date(item.created_at).toLocaleString('nb-NO', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                : '';
              const isResolved = Boolean(item.resolved_at);
              return (
                <Box
                  key={item.id}
                  sx={{
                    p: 1.25,
                    borderRadius: 2.2,
                    border: item.read ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(56,189,248,0.34)',
                    bgcolor: item.read ? 'rgba(15,23,42,0.52)' : 'rgba(8,47,73,0.32)',
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'flex-start' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label={item.inbox_type || item.event_type || 'Varsel'}
                          sx={{ height: 21, bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe', fontWeight: 800 }}
                        />
                        {!item.read ? <Chip size="small" label="Ulest" sx={{ height: 21, bgcolor: 'rgba(248,113,113,0.16)', color: '#fecaca', fontWeight: 800 }} /> : null}
                        {isResolved ? <Chip size="small" label="Løst" sx={{ height: 21, bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0', fontWeight: 800 }} /> : null}
                      </Stack>
                      <Typography sx={{ mt: 0.75, color: '#fff', fontWeight: 850, lineHeight: 1.25 }}>
                        {item.title}
                      </Typography>
                      {item.message ? (
                        <Typography sx={{ mt: 0.35, color: 'rgba(226,232,240,0.68)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                          {item.message}
                        </Typography>
                      ) : null}
                      <Typography sx={{ mt: 0.55, color: 'rgba(148,163,184,0.72)', fontSize: '0.72rem' }}>
                        {[item.client_name, createdAtLabel, item.assigned_to_label ? `Ansvar: ${item.assigned_to_label}` : null].filter(Boolean).join(' • ')}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                      {!item.read ? (
                        <Button
                          size="small"
                          onClick={() => { void markProducerInboxAsRead(item.id); }}
                          sx={{ textTransform: 'none', color: '#bae6fd', fontWeight: 800 }}
                        >
                          Lest
                        </Button>
                      ) : null}
                      {!isResolved ? (
                        <Button
                          size="small"
                          onClick={() => { void resolveProducerInboxNotification(item.id, true); }}
                          sx={{ textTransform: 'none', color: '#86efac', fontWeight: 800 }}
                        >
                          Løs
                        </Button>
                      ) : null}
                      <Button
                        size="small"
                        onClick={() => { void archiveProducerInboxNotification(item.id, true); }}
                        sx={{ textTransform: 'none', color: 'rgba(226,232,240,0.68)', fontWeight: 800 }}
                      >
                        Arkiver
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Project Selector Dialog */}
      <Dialog
        open={projectSelectorOpen}
        onClose={() => {
          setProjectSelectorOpen(false);
          setProjectSelectorQuery('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            borderRadius: 2,
            maxHeight: '80vh',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            py: 2,
            px: 3,
            bgcolor: '#161b22',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <RoleRoomBrandMark appearance="header" showLabel={false} sx={{ width: { xs: 68, sm: 84 } }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.15 }}>
                Eksisterende prosjekter
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                Velg aktivt prosjekt raskt, eller opprett et nytt hvis du starter fra blankt.
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Button
              size="small"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                setProjectSelectorOpen(false);
                setProjectSelectorQuery('');
                openNewProjectCreationModal();
              }}
              sx={{
                textTransform: 'none',
                minHeight: 34,
                px: 1.2,
                bgcolor: 'rgba(0,212,255,0.14)',
                border: '1px solid rgba(0,212,255,0.38)',
                color: '#7dd3fc',
                '&:hover': {
                  bgcolor: 'rgba(0,212,255,0.22)',
                  borderColor: '#22d3ee',
                },
              }}
            >
              Nytt prosjekt
            </Button>
            <IconButton
              onClick={() => {
                setProjectSelectorOpen(false);
                setProjectSelectorQuery('');
              }}
              aria-label={branding.tokens.labels.closeLabel}
              sx={{ color: 'rgba(255,255,255,0.87)' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ px: 2, pt: 1.5, pb: 1.25, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <TextField
              fullWidth
              size="small"
              autoFocus
              value={projectSelectorQuery}
              onChange={(e) => setProjectSelectorQuery(e.target.value)}
              placeholder="Søk på prosjektnavn, ID eller klient"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.14)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.28)' },
                  '&.Mui-focused fieldset': { borderColor: '#22d3ee' },
                },
                '& .MuiInputBase-input::placeholder': {
                  color: 'rgba(255,255,255,0.58)',
                  opacity: 1,
                },
              }}
            />
          </Box>
          {headerActiveProject ? (
            <Box
              sx={{
                px: 2,
                py: 1.25,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'linear-gradient(180deg, rgba(34,211,238,0.06) 0%, rgba(255,255,255,0) 100%)',
              }}
            >
	              {(() => {
	                const { roleLabel, accessLabel } = getProjectRoleDetails(headerActiveProject);
		                const creatorLabel = getProjectCreatorLabel(headerActiveProject);
		                const ownerLabel = getProjectOwnerLabel(headerActiveProject);
		                const showOwnerLabel = Boolean(ownerLabel && ownerLabel !== creatorLabel);
		                const isArchived = isArchivedWorkspaceProject(headerActiveProject);
		                const syncStatus = getProjectSyncStatus(headerActiveProject.id);
	                const syncActionPending = projectSyncActionProjectId === headerActiveProject.id;
	                return (
	                  <>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.56)' }}>
                      Aktivt nå
                    </Typography>
                    <Box
                      sx={{
                        mt: 1,
                        px: 1.4,
                        py: 1.2,
                        borderRadius: 2,
                        border: '1px solid rgba(34,211,238,0.18)',
                        bgcolor: 'rgba(15,23,42,0.48)',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: 1,
                        alignItems: 'center',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {headerActiveProject.name}
                        </Typography>
                        <Box sx={{ mt: 0.7, display: 'flex', alignItems: 'center', gap: 0.7, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            label={`Rolle: ${roleLabel}`}
                            sx={{
                              height: 22,
                              bgcolor: 'rgba(99,102,241,0.14)',
                              color: '#c7d2fe',
                              border: '1px solid rgba(99,102,241,0.26)',
                              fontSize: '0.66rem',
                              fontWeight: 700,
                            }}
                          />
	                          <Chip
	                            size="small"
	                            label={`Tilgang: ${accessLabel}`}
	                            sx={{
	                              height: 22,
                              bgcolor: 'rgba(16,185,129,0.14)',
                              color: '#bbf7d0',
                              border: '1px solid rgba(16,185,129,0.24)',
                              fontSize: '0.66rem',
	                              fontWeight: 700,
	                            }}
	                          />
	                          {isArchived ? (
	                            <Chip
	                              size="small"
	                              label="Arkivert"
	                              sx={{
	                                height: 22,
	                                bgcolor: 'rgba(251,191,36,0.12)',
	                                color: '#fde68a',
	                                border: '1px solid rgba(251,191,36,0.24)',
	                                fontSize: '0.66rem',
	                                fontWeight: 800,
	                              }}
	                            />
	                          ) : null}
	                        </Box>
                        <Typography sx={{ mt: 0.55, fontSize: '0.78rem', color: 'rgba(255,255,255,0.64)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {[
                            headerActiveProject.clientName,
                            headerActiveProject.producerWorkflowStatus ? PRODUCER_PROJECT_STATUS_LABELS[headerActiveProject.producerWorkflowStatus] : null,
                          ].filter(Boolean).join(' • ')}
                        </Typography>
	                        {creatorLabel ? (
	                          <Typography sx={{ mt: 0.45, fontSize: '0.74rem', color: 'rgba(255,255,255,0.54)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
	                            Opprettet av {creatorLabel}
	                          </Typography>
	                        ) : null}
	                        {showOwnerLabel ? (
	                          <Typography sx={{ mt: 0.25, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
	                            Eier {ownerLabel}
	                          </Typography>
	                        ) : null}
	                      </Box>
	                      <Stack spacing={0.75} alignItems="flex-end">
	                        <Chip
	                          size="small"
	                          label="Aktivt prosjekt"
	                          sx={{
	                            bgcolor: 'rgba(34,211,238,0.12)',
	                            color: '#67e8f9',
	                            border: '1px solid rgba(34,211,238,0.24)',
	                            fontWeight: 700,
	                          }}
	                        />
	                        <Tooltip title={syncStatus.helper}>
	                          <Chip
	                            size="small"
	                            label={syncStatus.label}
	                            sx={{
	                              bgcolor: syncStatus.bgcolor,
	                              color: syncStatus.color,
	                              border: syncStatus.border,
	                              fontWeight: 800,
	                            }}
	                          />
	                        </Tooltip>
	                        <Button
	                          size="small"
	                          startIcon={syncActionPending ? <CircularProgress size={12} color="inherit" /> : <RefreshIcon sx={{ fontSize: 15 }} />}
	                          onClick={(event: MouseEvent) => {
	                            event.stopPropagation();
	                            void handleVerifyProjectStorage(headerActiveProject);
	                          }}
	                          disabled={syncActionPending}
	                          sx={{
	                            minHeight: 26,
	                            px: 0.9,
	                            textTransform: 'none',
	                            fontSize: '0.68rem',
	                            color: '#bae6fd',
	                            border: '1px solid rgba(125,211,252,0.28)',
	                            '&:hover': { bgcolor: 'rgba(56,189,248,0.12)' },
	                          }}
	                        >
	                          Verifiser
	                        </Button>
	                      </Stack>
	                    </Box>
	                  </>
                );
              })()}
            </Box>
          ) : null}
          <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
            {filteredPublishedTemplates.length > 0 ? (
              <Box sx={{ px: 2, pt: 1.25, pb: 0.6, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.56)' }}>
                  Templates
                </Typography>
                <Typography sx={{ mt: 0.35, fontSize: '0.76rem', color: 'rgba(255,255,255,0.52)' }}>
                  Publiserte maler for {templateAudienceForSession === 'content_producer' ? 'innholdsprodusent' : 'produksjonsteam'}.
                </Typography>
                <Stack spacing={1} sx={{ mt: 1.1 }}>
                  {filteredPublishedTemplates.map((template) => (
                    <Box
                      key={`template-${template.id}`}
                      sx={{
                        px: 1.4,
                        py: 1.2,
                        borderRadius: 2.25,
                        border: '1px solid rgba(192,132,252,0.18)',
                        background: 'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(30,41,59,0.72) 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: 1,
                        alignItems: 'center',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            label="Publisert mal"
                            sx={{
                              height: 21,
                              bgcolor: 'rgba(216,180,254,0.12)',
                              color: '#e9d5ff',
                              border: '1px solid rgba(216,180,254,0.22)',
                              fontSize: '0.64rem',
                              fontWeight: 700,
                            }}
                          />
                          <Typography sx={{ color: '#fff', fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(template.templateSourceProjectName || template.name).replace(/^Template\s*·\s*/i, '')}
                          </Typography>
                        </Box>
                        <Typography sx={{ mt: 0.55, fontSize: '0.76rem', color: 'rgba(255,255,255,0.66)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {template.description || 'Klargjort av admin som gjenbrukbar prosjektmal.'}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        onClick={() => { handleOpenProjectCopyDialog(template, { closeSelector: true }); }}
                        startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
                        sx={{
                          textTransform: 'none',
                          minHeight: 30,
                          px: 1.05,
                          color: '#f5d0fe',
                          border: '1px solid rgba(216,180,254,0.32)',
                          bgcolor: 'rgba(168,85,247,0.14)',
                          '&:hover': { bgcolor: 'rgba(168,85,247,0.22)', borderColor: 'rgba(216,180,254,0.48)' },
                        }}
                      >
                        Bruk mal
                      </Button>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}
            {filteredPinnedProjectSelectorItems.length > 0 ? (
              <Box sx={{ px: 2, pt: 1.25, pb: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.56)' }}>
                  Pinnet
                </Typography>
                <Typography sx={{ mt: 0.35, fontSize: '0.76rem', color: 'rgba(255,255,255,0.52)' }}>
                  Maks tre prosjekter kan ligge fast øverst.
                </Typography>
                <Box
                  sx={{
                    mt: 1.1,
                    display: 'flex',
                    gap: 1,
                    rowGap: { xs: 1, md: 1.25 },
                    flexWrap: { xs: 'nowrap', md: 'wrap' },
                    overflowX: { xs: 'auto', md: 'visible' },
                    pb: 0.35,
                    scrollbarWidth: 'thin',
                    '&::-webkit-scrollbar': { height: 4 },
                    '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2 },
                  }}
                >
                  {filteredPinnedProjectSelectorItems.map((project) => {
                    const isActive = currentProject?.id === project.id;
                    const isLatestCreated = latestCreatedProjectId === project.id;
                    const pinnedAccentColor = pinnedProjectAccentColorById.get(project.id) ?? '#fbbf24';
                    const workflowStatus = project.producerWorkflowStatus;
                    const workflowStatusLabel = workflowStatus
                      ? PRODUCER_PROJECT_STATUS_LABELS[workflowStatus]
                      : 'Klar for arbeid';
		                    const { roleLabel, accessLabel } = getProjectRoleDetails(project);
		                    const creatorLabel = getProjectCreatorLabel(project);
		                    const ownerLabel = getProjectOwnerLabel(project);
		                    const showOwnerLabel = Boolean(ownerLabel && ownerLabel !== creatorLabel);
		                    const isArchived = isArchivedWorkspaceProject(project);
		                    const isDragging = draggingPinnedProjectId === project.id;
	                    const syncStatus = getProjectSyncStatus(project.id);

	                    return (
                      <Box
                        key={`pinned-hero-${project.id}`}
                        onClick={() => { void handleSelectProjectFromSelector(project); }}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', project.id);
                          setDraggingPinnedProjectId(project.id);
                        }}
                        onDragEnd={() => {
                          setDraggingPinnedProjectId(null);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const sourceProjectId = event.dataTransfer.getData('text/plain');
                          void handleReorderPinnedProjects(sourceProjectId, project.id);
                          setDraggingPinnedProjectId(null);
                        }}
                        sx={{
                          width: 236,
                          minWidth: 236,
                          maxWidth: 236,
                          px: 1.4,
                          py: 1.2,
                          borderRadius: 2.5,
                          cursor: isDragging ? 'grabbing' : 'grab',
                          border: isActive ? '1px solid rgba(0, 212, 255, 0.45)' : `1px solid ${pinnedAccentColor}44`,
                          background: isActive
                            ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.14) 0%, rgba(0, 180, 230, 0.08) 100%)'
                            : `linear-gradient(135deg, ${pinnedAccentColor}1f 0%, ${pinnedAccentColor}0d 100%)`,
                          boxShadow: isActive
                            ? '0 10px 24px rgba(0,0,0,0.22)'
                            : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                          opacity: isDragging ? 0.66 : 1,
                          '&:hover': {
                            background: isActive
                              ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.17) 0%, rgba(0, 180, 230, 0.1) 100%)'
                              : `linear-gradient(135deg, ${pinnedAccentColor}29 0%, ${pinnedAccentColor}12 100%)`,
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.35, color: 'rgba(255,255,255,0.48)', flexShrink: 0 }}>
                            <PushPinIcon sx={{ fontSize: 15, color: pinnedAccentColor }} />
                            <DragIndicatorIcon sx={{ fontSize: 15 }} />
                          </Box>
                          <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {project.name}
                          </Typography>
                          {isLatestCreated ? (
                            <Chip
                              size="small"
                              label="Siste"
                              sx={{
                                height: 20,
                                bgcolor: 'rgba(16,185,129,0.16)',
                                color: '#86efac',
                                border: '1px solid rgba(16,185,129,0.32)',
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            />
                          ) : null}
                        </Box>
                        <Typography sx={{ mt: 0.7, fontSize: '0.72rem', color: 'rgba(255,255,255,0.64)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {project.clientName || 'Uten klientnavn'}
                        </Typography>
		                        {creatorLabel ? (
		                          <Typography sx={{ mt: 0.45, fontSize: '0.7rem', color: 'rgba(255,255,255,0.54)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
		                            Opprettet av {creatorLabel}
		                          </Typography>
		                        ) : null}
		                        {showOwnerLabel ? (
		                          <Typography sx={{ mt: 0.25, fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
		                            Eier {ownerLabel}
		                          </Typography>
		                        ) : null}
                        <Box sx={{ mt: 0.8, display: 'flex', alignItems: 'center', gap: 0.55, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            label={`Rolle: ${roleLabel}`}
                            sx={{
                              height: 20,
                              bgcolor: 'rgba(99,102,241,0.14)',
                              color: '#c7d2fe',
                              border: '1px solid rgba(99,102,241,0.22)',
                              fontSize: '0.62rem',
                              fontWeight: 700,
                            }}
                          />
		                          <Chip
		                            size="small"
		                            label={`Tilgang: ${accessLabel}`}
                            sx={{
                              height: 20,
                              bgcolor: 'rgba(16,185,129,0.14)',
                              color: '#bbf7d0',
                              border: '1px solid rgba(16,185,129,0.22)',
                              fontSize: '0.62rem',
                              fontWeight: 700,
		                            }}
		                          />
		                          {isArchived ? (
		                            <Chip
		                              size="small"
		                              label="Arkivert"
		                              sx={{
		                                height: 20,
		                                bgcolor: 'rgba(251,191,36,0.12)',
		                                color: '#fde68a',
		                                border: '1px solid rgba(251,191,36,0.24)',
		                                fontSize: '0.62rem',
		                                fontWeight: 800,
		                              }}
		                            />
		                          ) : null}
		                          <Tooltip title={syncStatus.helper}>
	                            <Chip
	                              size="small"
	                              label={syncStatus.label}
	                              sx={{
	                                height: 20,
	                                bgcolor: syncStatus.bgcolor,
	                                color: syncStatus.color,
	                                border: syncStatus.border,
	                                fontSize: '0.62rem',
	                                fontWeight: 800,
	                              }}
	                            />
	                          </Tooltip>
	                        </Box>
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          <Chip
                            size="small"
                            label={workflowStatusLabel}
                            sx={{
                              height: 22,
                              maxWidth: 132,
                              bgcolor: isActive ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.06)',
                              color: isActive ? '#7dd3fc' : 'rgba(255,255,255,0.72)',
                              border: isActive ? '1px solid rgba(0,212,255,0.28)' : '1px solid rgba(255,255,255,0.08)',
                              fontSize: '0.66rem',
                              fontWeight: 700,
                            }}
                          />
                          <Button
                            size="small"
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation();
                              void handleTogglePinnedProject(project.id);
                            }}
                            sx={{
                              minWidth: 'auto',
                              px: 0.75,
                              color: pinnedAccentColor,
                              fontSize: '0.68rem',
                              textTransform: 'none',
                              '&:hover': { bgcolor: `${pinnedAccentColor}14` },
                            }}
                          >
                            Løsne
                          </Button>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ) : null}
            {filteredProjectSelectorItems.length === 0 && filteredPublishedTemplates.length === 0 ? (
              <Box sx={{ px: 3, py: 3.5 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontWeight: 600 }}>
                  Ingen prosjekter eller templates matcher søket
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: '0.82rem', color: 'rgba(255,255,255,0.64)' }}>
                  Prøv et annet søkeord, eller opprett et nytt prosjekt.
                </Typography>
              </Box>
            ) : (
              [
                {
                  key: 'pinned',
                  title: 'Pinnet',
                  description: 'Prosjekter du holder faste øverst i arbeidsflaten.',
                  items: filteredPinnedProjectSelectorItems,
                },
                {
                  key: 'all',
                  title: filteredPinnedProjectSelectorItems.length > 0 ? 'Andre prosjekter' : 'Prosjekter',
                  description: filteredPinnedProjectSelectorItems.length > 0 ? 'Resterende prosjekter i arbeidsbiblioteket.' : null,
                  items: filteredPinnedProjectSelectorItems.length > 0 ? filteredUnpinnedProjectSelectorItems : filteredProjectSelectorItems,
                },
              ]
                .filter((section) => section.items.length > 0)
                .map((section) => (
                  <Box key={section.key} sx={{ py: 0.75 }}>
                    <Box sx={{ px: 2.5, pt: 0.75, pb: 0.25 }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.56)' }}>
                        {section.title}
                      </Typography>
                      {section.description ? (
                        <Typography sx={{ mt: 0.35, fontSize: '0.76rem', color: 'rgba(255,255,255,0.52)' }}>
                          {section.description}
                        </Typography>
                      ) : null}
                    </Box>
                    {section.items.map((project) => {
                      const isActive = currentProject?.id === project.id;
                      const isLatestCreated = latestCreatedProjectId === project.id;
                      const isPinned = pinnedProjectIdSet.has(project.id);
                      const isProtectedDemo = isProtectedDemoProject(project);
                      const pinnedAccentColor = pinnedProjectAccentColorById.get(project.id) ?? '#fbbf24';
                      const candidateCount = project.candidatesCount ?? project.candidates?.length ?? 0;
                      const workflowStatus = project.producerWorkflowStatus;
                      const workflowStatusLabel = workflowStatus
                        ? PRODUCER_PROJECT_STATUS_LABELS[workflowStatus]
                        : 'Klar for arbeid';
                      const workflowStatusStyle = workflowStatus
                        ? PRODUCER_PROJECT_STATUS_COLORS[workflowStatus]
                        : {
                            background: 'rgba(148, 163, 184, 0.12)',
                            color: 'rgba(226, 232, 240, 0.9)',
                            border: '1px solid rgba(148, 163, 184, 0.18)',
                          };
		                      const { roleLabel, accessLabel } = getProjectRoleDetails(project);
		                      const creatorLabel = getProjectCreatorLabel(project);
		                      const ownerLabel = getProjectOwnerLabel(project);
		                      const showOwnerLabel = Boolean(ownerLabel && ownerLabel !== creatorLabel);
		                      const isArchived = isArchivedWorkspaceProject(project);
		                      const syncStatus = getProjectSyncStatus(project.id);
	                      const syncActionPending = projectSyncActionProjectId === project.id;
	                      const updatedDate = project.updatedAt
	                        ? new Date(project.updatedAt).toLocaleDateString('nb-NO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : branding.tokens.labels.unknownLabel;
                      const primaryActionLabel = isProtectedDemo && !canMutateProtectedDemoData ? 'Lag kopi' : 'Åpne';
                      const handlePrimaryAction = () => {
                        if (isProtectedDemo && !canMutateProtectedDemoData) {
                          handleOpenProjectCopyDialog(project, { closeSelector: true });
                          return;
                        }
                        void handleSelectProjectFromSelector(project);
                      };

                      return (
                        <Box
                          key={project.id}
                          onClick={() => { void handleSelectProjectFromSelector(project); }}
                          sx={{
                            mx: 1.5,
                            my: 1,
                            px: 2,
                            py: 1.6,
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) auto',
                            gap: 1.5,
                            cursor: 'pointer',
                            borderRadius: 2.5,
                            border: isActive ? '1px solid rgba(0, 212, 255, 0.45)' : '1px solid rgba(255,255,255,0.08)',
                            bgcolor: isActive
                              ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.12) 0%, rgba(0, 180, 230, 0.08) 100%)'
                              : 'rgba(255,255,255,0.025)',
                            background: isActive
                              ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.12) 0%, rgba(0, 180, 230, 0.08) 100%)'
                              : 'rgba(255,255,255,0.025)',
                            boxShadow: isActive
                              ? '0 12px 28px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)'
                              : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                            '&:hover': {
                              bgcolor: isActive ? undefined : 'rgba(255,255,255,0.04)',
                              background: isActive
                                ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.14) 0%, rgba(0, 180, 230, 0.1) 100%)'
                                : 'rgba(255,255,255,0.04)',
                            },
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                              <Box sx={{ 
                                width: 10, 
                                height: 10, 
                                borderRadius: '50%', 
                                bgcolor: isActive ? '#00d4ff' : isPinned ? pinnedAccentColor : 'rgba(255,255,255,0.3)',
                                boxShadow: isActive ? '0 0 10px rgba(0,212,255,0.4)' : 'none',
                                flexShrink: 0,
                              }} />
                              <Typography 
                                sx={{ 
                                  fontWeight: isActive ? 700 : 600,
                                  color: isActive ? '#fff' : 'rgba(255,255,255,0.9)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  minWidth: 0,
                                }}
                              >
                                {project.name}
                              </Typography>
                              {isLatestCreated ? (
                                <Chip
                                  size="small"
                                  label="Siste opprettet"
                                  sx={{
                                    height: 22,
                                    bgcolor: 'rgba(16,185,129,0.14)',
                                    color: '#86efac',
                                    border: '1px solid rgba(16,185,129,0.28)',
                                    fontSize: '0.64rem',
                                    fontWeight: 800,
                                    flexShrink: 0,
                                  }}
                                />
                              ) : null}
                              {isPinned ? (
                                <PushPinIcon sx={{ fontSize: 15, color: pinnedAccentColor, flexShrink: 0 }} />
                              ) : null}
	                              {isProtectedDemo ? (
	                                <Chip
	                                  size="small"
                                  label="Demo-mal"
                                  sx={{
                                    height: 20,
                                    bgcolor: 'rgba(244,114,182,0.12)',
                                    color: '#f9a8d4',
                                    border: '1px solid rgba(244,114,182,0.22)',
                                    fontSize: '0.62rem',
                                    fontWeight: 800,
                                    flexShrink: 0,
	                                  }}
	                                />
	                              ) : null}
	                              {isArchived ? (
	                                <Chip
	                                  size="small"
	                                  label="Arkivert"
	                                  sx={{
	                                    height: 20,
	                                    bgcolor: 'rgba(251,191,36,0.12)',
	                                    color: '#fde68a',
	                                    border: '1px solid rgba(251,191,36,0.22)',
	                                    fontSize: '0.62rem',
	                                    fontWeight: 800,
	                                    flexShrink: 0,
	                                  }}
	                                />
	                              ) : null}
	                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.7, minWidth: 0, flexWrap: 'wrap' }}>
                              <Chip
                                size="small"
                                label={workflowStatusLabel}
                                sx={{
                                  height: 23,
                                  bgcolor: isActive ? workflowStatusStyle.background : 'rgba(255,255,255,0.04)',
                                  color: isActive ? workflowStatusStyle.color : 'rgba(255,255,255,0.72)',
                                  border: isActive ? workflowStatusStyle.border : '1px solid rgba(255,255,255,0.08)',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                }}
                              />
                              <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)', minWidth: 0 }}>
                                {project.clientName ? `${project.clientName} • ` : ''}{branding.tokens.labels.lastUpdatedLabel} {updatedDate}
                              </Typography>
                            </Box>
                            {creatorLabel ? (
                              <Typography sx={{ mt: 0.55, fontSize: '0.72rem', color: 'rgba(255,255,255,0.52)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
	                                Opprettet av {creatorLabel}
	                              </Typography>
	                            ) : null}
	                            {showOwnerLabel ? (
	                              <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
	                                Eier {ownerLabel}
	                              </Typography>
	                            ) : null}
	                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mt: 0.8, minWidth: 0, flexWrap: 'wrap' }}>
                              <Chip
                                size="small"
                                label={`Rolle: ${roleLabel}`}
                                sx={{
                                  height: 22,
                                  bgcolor: 'rgba(99,102,241,0.14)',
                                  color: '#c7d2fe',
                                  border: '1px solid rgba(99,102,241,0.22)',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                }}
                              />
	                              <Chip
	                                size="small"
	                                label={`Tilgang: ${accessLabel}`}
                                sx={{
                                  height: 22,
                                  bgcolor: 'rgba(16,185,129,0.14)',
                                  color: '#bbf7d0',
                                  border: '1px solid rgba(16,185,129,0.22)',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
	                                }}
	                              />
	                              <Tooltip title={syncStatus.helper}>
	                                <Chip
	                                  size="small"
	                                  label={syncStatus.label}
	                                  sx={{
	                                    height: 22,
	                                    bgcolor: syncStatus.bgcolor,
	                                    color: syncStatus.color,
	                                    border: syncStatus.border,
	                                    fontSize: '0.66rem',
	                                    fontWeight: 800,
	                                  }}
	                                />
	                              </Tooltip>
	                            </Box>
	                          </Box>

	                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            <Box
                              sx={{
                                minWidth: 34,
                                height: 28,
                                px: 0.9,
                                borderRadius: 999,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: isActive ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.06)',
                                border: isActive ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                                color: isActive ? '#fff' : 'rgba(255,255,255,0.76)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}
                            >
                              {candidateCount}
                            </Box>
	                            <Button
	                              size="small"
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation();
                                handlePrimaryAction();
                              }}
                              sx={{
                                textTransform: 'none',
                                minHeight: 28,
                                px: 1,
                                color: isProtectedDemo && !canMutateProtectedDemoData ? '#fbcfe8' : '#7dd3fc',
                                border: isProtectedDemo && !canMutateProtectedDemoData
                                  ? '1px solid rgba(244,114,182,0.32)'
                                  : '1px solid rgba(125,211,252,0.32)',
                                bgcolor: isProtectedDemo && !canMutateProtectedDemoData
                                  ? 'rgba(244,114,182,0.08)'
                                  : 'rgba(56,189,248,0.08)',
                                '&:hover': {
                                  bgcolor: isProtectedDemo && !canMutateProtectedDemoData
                                    ? 'rgba(244,114,182,0.18)'
                                    : 'rgba(56,189,248,0.18)',
                                  borderColor: isProtectedDemo && !canMutateProtectedDemoData
                                    ? 'rgba(244,114,182,0.52)'
                                    : 'rgba(56,189,248,0.65)',
                                },
                              }}
	                            >
	                              {primaryActionLabel}
	                            </Button>
	                            <Tooltip title={syncActionPending ? 'Verifiserer prosjektlagring...' : syncStatus.helper}>
	                              <span>
	                                <IconButton
	                                  size="small"
	                                  onClick={(e: MouseEvent) => {
	                                    e.stopPropagation();
	                                    void handleVerifyProjectStorage(project);
	                                  }}
	                                  disabled={syncActionPending || (isProtectedDemo && !canMutateProtectedDemoData)}
	                                  sx={{
	                                    color: syncStatus.color,
	                                    '&:hover': { bgcolor: 'rgba(125,211,252,0.12)' },
	                                    '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)' },
	                                  }}
	                                >
	                                  {syncActionPending
	                                    ? <CircularProgress size={16} color="inherit" />
	                                    : <RefreshIcon sx={{ fontSize: 18 }} />}
	                                </IconButton>
	                              </span>
	                            </Tooltip>
	                            <IconButton
	                              size="small"
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation();
                                void handleTogglePinnedProject(project.id);
                              }}
                              sx={{
                                color: isPinned ? pinnedAccentColor : 'rgba(255,255,255,0.56)',
                                '&:hover': { color: isPinned ? pinnedAccentColor : '#fbbf24', bgcolor: isPinned ? `${pinnedAccentColor}14` : 'rgba(251,191,36,0.08)' },
                              }}
                            >
                              <PushPinIcon sx={{ fontSize: 18, transform: isPinned ? 'rotate(0deg)' : 'rotate(35deg)' }} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation();
                                handleOpenProjectQuickActions(e, project);
                              }}
                              sx={{
                                color: 'rgba(255,255,255,0.64)',
                                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
                              }}
                            >
                              <MoreHorizIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                ))
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Sharing Modal (from Overview + Deling tab) */}
      <Dialog
        open={sharingModalOpen}
        onClose={() => setSharingModalOpen(false)}
        maxWidth="xl"
        fullWidth
        fullScreen={isMobile}
        container={() => document.body}
        TransitionComponent={Grow}
        PaperProps={{
          sx: {
            bgcolor: '#111827',
            color: '#fff',
            border: '1px solid rgba(168,85,247,0.28)',
            borderRadius: isMobile ? 0 : 2,
            overflow: 'hidden',
            backgroundImage: 'linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(15,23,42,0.98) 100%)',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            borderBottom: '1px solid rgba(148,163,184,0.2)',
            py: 1.25,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <_ShareIcon sx={{ color: '#a855f7', fontSize: 22 }} />
            <Typography sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.05rem' } }}>
              Deling
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setSharingModalOpen(false)}
            aria-label={branding.tokens.labels.closePanelLabel}
            sx={{
              color: 'rgba(255,255,255,0.72)',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {currentProject ? (
            <Box sx={{ minHeight: isMobile ? 'calc(100vh - 140px)' : 'min(78vh, 860px)', overflow: 'auto' }}>
              <Suspense
                fallback={(
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280 }}>
                    <CircularProgress size={28} sx={{ color: '#a855f7' }} />
                  </Box>
                )}
              >
                <SharingPanel
                  key={currentProject.id}
                  project={currentProject}
                  onOpenSharingDialog={openSharingDialog}
                />
              </Suspense>
            </Box>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.85)' }}>
              <Typography variant="body1">{branding.tokens.labels.noProjectSelected}</Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Sharing Invite Dialog */}
      {currentProject && sharingDialogOpen && (
        <Suspense fallback={null}>
          <CastingSharingDialog
            key={currentProject.id}
            open={sharingDialogOpen}
            projectId={currentProject.id}
            onClose={() => setSharingDialogOpen(false)}
            onUpdate={async () => {
              if (currentProject) {
                const updated = await castingService.getProject(currentProject.id);
                if (updated) setCurrentProject(updated);
              }
            }}
          />
        </Suspense>
      )}

      <Dialog
        open={selectionShortcutsOpen}
        onClose={() => setSelectionShortcutsOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0f172a',
            color: '#fff',
            border: '1px solid rgba(125,211,252,0.3)',
            borderRadius: 2,
            backgroundImage: 'linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(3,7,18,0.98) 100%)',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            borderBottom: '1px solid rgba(148,163,184,0.2)',
            py: 1.25,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyboardIcon sx={{ color: '#7dd3fc', fontSize: 21 }} />
            <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.96rem', sm: '1.02rem' } }}>
              Utvelgelse-snarveier
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setSelectionShortcutsOpen(false)}
            aria-label={branding.tokens.labels.closePanelLabel}
            sx={{
              color: 'rgba(255,255,255,0.72)',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 1.2, sm: 1.4 }, mt: 0.6 }}>
          <Typography sx={{ color: 'rgba(186,230,253,0.9)', fontSize: '0.78rem', mb: 1 }}>
            Hurtigtaster for Utvelgelse og Casting board.
          </Typography>
          <Stack spacing={0.65}>
            {SELECTION_SHORTCUTS.map((shortcut) => (
              <Box
                key={`${shortcut.scope}-${shortcut.keys}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 0.85,
                  p: 0.7,
                  borderRadius: 1.1,
                  border: '1px solid rgba(125,211,252,0.22)',
                  bgcolor: 'rgba(14,116,144,0.12)',
                }}
              >
                <Chip
                  size="small"
                  label={shortcut.keys}
                  sx={{
                    bgcolor: 'rgba(56,189,248,0.16)',
                    color: '#bae6fd',
                    border: '1px solid rgba(125,211,252,0.48)',
                    fontWeight: 700,
                    minWidth: 52,
                    '& .MuiChip-label': { px: 0.9 },
                  }}
                />
                <Typography sx={{ color: 'rgba(226,232,240,0.92)', fontSize: '0.74rem', flex: 1 }}>
                  {shortcut.action}
                </Typography>
                <Chip
                  size="small"
                  label={shortcut.scope}
                  sx={{
                    bgcolor: 'rgba(20,184,166,0.16)',
                    color: '#99f6e4',
                    border: '1px solid rgba(45,212,191,0.44)',
                    '& .MuiChip-label': { px: 0.7, fontSize: '0.64rem' },
                  }}
                />
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 1.6, pb: 1.3 }}>
          <Button
            onClick={() => setSelectionShortcutsOpen(false)}
            variant="outlined"
            sx={{
              textTransform: 'none',
              color: '#bae6fd',
              borderColor: 'rgba(125,211,252,0.4)',
              '&:hover': {
                borderColor: 'rgba(125,211,252,0.7)',
                bgcolor: 'rgba(14,116,144,0.16)',
              },
            }}
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Project Creation Modal */}
      <Dialog
        open={projectCreationModalOpen}
        onClose={() => {
          setProjectCreationModalOpen(false);
          setProjectToEdit(null);
          setCurrentProjectId(null);
        }}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
        container={() => document.body}
        TransitionComponent={Grow}
        TransitionProps={{
          timeout: { enter: 225, exit: 150 },
          enter: true,
          exit: true,
        }}
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            width: '100%',
            maxWidth: isMobile ? '100%' : '90vw',
            maxHeight: isMobile ? '100%' : '90vh',
            m: isMobile ? 0 : undefined,
            borderRadius: isMobile ? 0 : 2,
            zIndex: Z_INDEX.dialog,
            willChange: 'transform, opacity',
            transformOrigin: 'center center',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        sx={{
          zIndex: Z_INDEX.dialog,
          '& .MuiBackdrop-root': {
            zIndex: Z_INDEX.backdrop,
            bgcolor: 'rgba(0,0,0,0.8)',
            willChange: 'opacity',
          },
        }}
      >
        {/* Header with close button */}
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            py: { xs: 1.5, sm: 2 },
            px: { xs: 2, sm: 3 },
            bgcolor: '#161b22',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.85, flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <RoleRoomBrandMark appearance="header" showLabel={false} sx={{ width: { xs: 88, sm: 112 } }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '1.1rem', sm: '1.25rem' },
                    color: '#fff',
                    display: 'block',
                    lineHeight: 1.2,
                  }}
                >
                  {projectToEdit
                    ? branding.tokens.labels.editProjectTitle
                    : projectCreationDialogTab === 'existing'
                      ? 'Prosjektbibliotek'
                      : 'Nytt Role Room prosjekt'}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.68)' }}>
                  {projectCreationDialogTab === 'existing' && !projectToEdit
                    ? 'Åpne eksisterende prosjekt eller bytt tilbake for å starte nytt.'
                    : 'The Role Room flyt: grunnlag, team, økonomi og lagring.'}
                </Typography>
              </Box>
            </Box>
            {(projectToEdit?.id || currentProjectId) && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                bgcolor: 'rgba(0, 212, 255, 0.15)',
                border: '1.5px solid rgba(0, 212, 255, 0.4)',
                alignSelf: 'flex-start',
              }}>
                <Folder sx={{ color: '#00d4ff', fontSize: { xs: '0.875rem', sm: '1rem' } }} />
                <Box>
                  <Typography variant="caption" sx={{
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    color: '#00d4ff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'block',
                    lineHeight: 1,
                  }}>
                    {branding.tokens.labels.projectIdLabel}
                  </Typography>
                  <Typography variant="caption" sx={{
                    fontWeight: 700,
                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    color: '#00d4ff',
                    fontFamily: 'monospace',
                    letterSpacing: '0.3px',
                    display: 'block',
                    lineHeight: 1.2,
                    mt: 0.25,
                  }}>
                    {projectToEdit?.id || currentProjectId}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
          <IconButton
            onClick={() => {
              setProjectCreationModalOpen(false);
              setProjectToEdit(null);
              setProjectCreationPrefill(null);
              setCurrentProjectId(null);
            }}
            aria-label={branding.tokens.labels.closeLabel}
            sx={{
              color: 'rgba(255,255,255,0.87)',
              '&:hover': {
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            p: 0,
            overflow: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {!projectToEdit ? (
            <Box
              sx={{
                px: { xs: 1.4, sm: 2 },
                pt: 1.25,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(2,6,23,0.32)',
              }}
            >
              <Tabs
                value={projectCreationDialogTab}
                onChange={(_event, value) => setProjectCreationDialogTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  minHeight: 42,
                  '& .MuiTab-root': {
                    minHeight: 42,
                    textTransform: 'none',
                    color: 'rgba(226,232,240,0.68)',
                    fontWeight: 800,
                  },
                  '& .Mui-selected': { color: '#7dd3fc' },
                  '& .MuiTabs-indicator': { bgcolor: '#38bdf8' },
                }}
              >
                <Tab value="new" label="Nytt prosjekt" />
                <Tab value="existing" label={`Eksisterende (${orderedProjects.length})`} />
              </Tabs>
            </Box>
          ) : null}

          {projectCreationDialogTab === 'existing' && !projectToEdit ? (
            <Box sx={{ p: { xs: 1.5, sm: 2.25 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField
                  fullWidth
                  size="small"
                  value={projectSelectorQuery}
                  onChange={(event) => setProjectSelectorQuery(event.target.value)}
                  placeholder="Søk på prosjektnavn, ID eller klient"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.64)' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.14)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.28)' },
                      '&.Mui-focused fieldset': { borderColor: '#38bdf8' },
                    },
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setProjectSelectorQuery('');
                    setProjectCreationDialogTab('new');
                  }}
                  sx={{
                    minHeight: 40,
                    borderRadius: 999,
                    px: 1.5,
                    textTransform: 'none',
                    fontWeight: 800,
                    bgcolor: '#38bdf8',
                    color: '#082f49',
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: '#7dd3fc' },
                  }}
                >
                  Opprett nytt
                </Button>
              </Box>

              {filteredPublishedTemplates.length > 0 ? (
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 2.5,
                    border: '1px solid rgba(192,132,252,0.18)',
                    bgcolor: 'rgba(88,28,135,0.12)',
                  }}
                >
                  <Typography sx={{ color: '#e9d5ff', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Templates
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 1 }}>
                    {filteredPublishedTemplates.slice(0, 4).map((template) => (
                      <Box
                        key={`project-modal-template-${template.id}`}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          gap: 1,
                          alignItems: 'center',
                          p: 1,
                          borderRadius: 1.8,
                          bgcolor: 'rgba(15,23,42,0.48)',
                          border: '1px solid rgba(216,180,254,0.14)',
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ color: '#fff', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(template.templateSourceProjectName || template.name).replace(/^Template\s*·\s*/i, '')}
                          </Typography>
                          <Typography sx={{ mt: 0.2, color: 'rgba(226,232,240,0.58)', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {template.description || 'Publisert prosjektmal'}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          startIcon={<ContentCopyIcon sx={{ fontSize: 15 }} />}
                          onClick={() => {
                            setProjectCreationModalOpen(false);
                            handleOpenProjectCopyDialog(template, { closeSelector: true });
                          }}
                          sx={{ textTransform: 'none', fontWeight: 800, color: '#f5d0fe', border: '1px solid rgba(216,180,254,0.3)' }}
                        >
                          Bruk mal
                        </Button>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ) : null}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.85 }}>
                {filteredProjectSelectorItems.length === 0 ? (
                  <Box sx={{ p: 2.5, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 800 }}>Ingen prosjekter matcher søket</Typography>
                    <Typography sx={{ mt: 0.35, color: 'rgba(226,232,240,0.64)', fontSize: '0.84rem' }}>
                      Opprett et nytt prosjekt, eller prøv et annet søkeord.
                    </Typography>
                  </Box>
                ) : filteredProjectSelectorItems.map((project) => {
                  const isActive = currentProject?.id === project.id;
                  const isPinned = pinnedProjectIdSet.has(project.id);
                  const isProtectedDemo = isProtectedDemoProject(project);
                  const { roleLabel, accessLabel } = getProjectRoleDetails(project);
                  const creatorLabel = getProjectCreatorLabel(project);
                  const syncStatus = getProjectSyncStatus(project.id);
                  const primaryActionLabel = isProtectedDemo && !canMutateProtectedDemoData ? 'Lag kopi' : (isActive ? 'Åpent' : 'Åpne');

                  return (
                    <Box
                      key={`project-modal-existing-${project.id}`}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) auto' },
                        gap: 1,
                        alignItems: 'center',
                        p: 1.15,
                        borderRadius: 2.2,
                        border: isActive ? '1px solid rgba(34,211,238,0.45)' : '1px solid rgba(255,255,255,0.08)',
                        bgcolor: isActive ? 'rgba(8,47,73,0.28)' : 'rgba(15,23,42,0.48)',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, minWidth: 0, flexWrap: 'wrap' }}>
                          {isPinned ? <PushPinIcon sx={{ color: '#fbbf24', fontSize: 16 }} /> : null}
                          <Typography sx={{ color: '#fff', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {project.name}
                          </Typography>
                          {isActive ? <Chip size="small" label="Aktivt" sx={{ height: 21, bgcolor: 'rgba(34,211,238,0.14)', color: '#7dd3fc', fontWeight: 800 }} /> : null}
                        </Box>
                        <Typography sx={{ mt: 0.45, color: 'rgba(226,232,240,0.62)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[project.clientName, `Rolle: ${roleLabel}`, `Tilgang: ${accessLabel}`].filter(Boolean).join(' • ')}
                        </Typography>
                        {creatorLabel ? (
                          <Typography sx={{ mt: 0.25, color: 'rgba(226,232,240,0.48)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Opprettet av {creatorLabel}
                          </Typography>
                        ) : null}
                      </Box>
                      <Stack direction="row" spacing={0.65} alignItems="center" justifyContent={{ xs: 'flex-start', sm: 'flex-end' }} flexWrap="wrap" useFlexGap>
                        <Tooltip title={syncStatus.helper}>
                          <Chip
                            size="small"
                            label={syncStatus.label}
                            sx={{
                              bgcolor: syncStatus.bgcolor,
                              color: syncStatus.color,
                              border: syncStatus.border,
                              fontWeight: 800,
                            }}
                          />
                        </Tooltip>
                        <Button
                          size="small"
                          disabled={isActive && !(isProtectedDemo && !canMutateProtectedDemoData)}
                          startIcon={isProtectedDemo && !canMutateProtectedDemoData ? <ContentCopyIcon sx={{ fontSize: 15 }} /> : <FolderOpenIcon sx={{ fontSize: 15 }} />}
                          onClick={() => {
                            if (isProtectedDemo && !canMutateProtectedDemoData) {
                              setProjectCreationModalOpen(false);
                              handleOpenProjectCopyDialog(project, { closeSelector: true });
                              return;
                            }
                            setProjectCreationModalOpen(false);
                            setProjectSelectorQuery('');
                            void handleSelectProjectFromSelector(project);
                          }}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 800,
                            color: isActive ? 'rgba(226,232,240,0.58)' : '#bae6fd',
                            border: '1px solid rgba(125,211,252,0.26)',
                            '&:hover': { bgcolor: 'rgba(56,189,248,0.12)' },
                          }}
                        >
                          {primaryActionLabel}
                        </Button>
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ) : projectCreationModalOpen && (
            <QueryClientProvider client={queryClient}>
              <MemoryRouter>
                <ProjectProvider key={projectToEdit?.id ?? 'new-project'}>
                  <Suspense fallback={<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.87)' }}>{branding.tokens.labels.loadingLabel}</Box>}>
                    <NewProjectCreationModal
                      key={`${projectCreationModalKey}-${projectToEdit?.id ?? 'new'}`}
                      profession={profession || 'photographer'}
                      userId={user?.id}
                      isCastingPlanner={true}
                      isContentProducerSession={isProducerWorkspaceSession}
                      getTerm={getTerm}
                      initialData={projectToEdit || projectCreationPrefill || undefined}
                      onProjectIdChange={handleProjectIdChange}
                      onOpenEconomy={(projectId) => {
                        const targetProjectId = projectId ?? currentProjectId ?? projectToEdit?.id ?? null;
                        if (targetProjectId) {
                          const targetProject = projects.find((project) => project.id === targetProjectId)
                            ?? (currentProjectId === targetProjectId && currentProject?.id === targetProjectId ? currentProject : null)
                            ?? (projectToEdit?.id === targetProjectId ? projectToEdit : null);
                          if (targetProject) {
                            setCurrentProject(targetProject);
                          }
                        }
                        navigateToTab(PRODUCER_ECONOMY_TAB_INDEX);
                      }}
                      onClose={() => {
                        setProjectCreationModalOpen(false);
                        setProjectToEdit(null);
                        setProjectCreationPrefill(null);
                        setCurrentProjectId(null);
                      }}
                      onProjectCreated={async (projectData) => {
                        const deferCloseForInvite = Boolean(projectData?.__deferCloseForInvite);
                        const normalizedProjectData = projectData && typeof projectData === 'object'
                          ? Object.fromEntries(
                              Object.entries(projectData as Record<string, unknown>).filter(([key]) => !key.startsWith('__')),
                            )
                          : projectData;

                        if (!deferCloseForInvite) {
                          setProjectCreationModalOpen(false);
                          setProjectToEdit(null);
                          setProjectCreationPrefill(null);
                        }
                        
                        // Use the project data returned from backend directly
                        // The ID should always be set (generated when modal opens)
                        if (normalizedProjectData && typeof normalizedProjectData === 'object' && 'id' in normalizedProjectData && normalizedProjectData.id) {
                          const normalizedProjectId = String((normalizedProjectData as Record<string, unknown>).id);
                          // Ensure crew is initialized as an array if missing
                          const projectWithCrew = {
                            ...(normalizedProjectData as Record<string, unknown>),
                            id: normalizedProjectId,
                            crew: (normalizedProjectData as Record<string, unknown>).crew || [],
                          } as CastingProject;
                          
                          // Save to database
	                          try {
	                            await castingService.saveProject(projectWithCrew);
	                            await loadProjectSyncMeta([normalizedProjectId]);
	                        } catch (error) {
	                            logRoleRoomDiagnostic('project-save:failed', {
	                              source: 'casting-planner',
	                              projectId: completeProject.id,
	                              message: error instanceof Error ? error.message : String(error),
	                            });
	                        }
                          
                          // Invalidate query cache to force refresh
                          queryClient.invalidateQueries({ queryKey: ['/api/casting/projects'] });
                          
                          // Set the newly created project as current immediately
                          // This ensures all child components (roles, candidates, locations, shots, etc.) use the same project ID
                          setCurrentProject(projectWithCrew);
                          
                          // Reload projects list in the background to update the list
                          try {
                            const loadedProjects = filterProjectsForSession(await castingService.getProjects());
                            setProjects(loadedProjects);
                            // Ensure the new project is still set as current (in case reload changed something)
                            const foundProject = loadedProjects.find((project) => project.id === normalizedProjectId);
                            if (foundProject) {
                              // Ensure crew is initialized
                              const projectWithCrewFromDb = {
                                ...foundProject,
                                crew: foundProject.crew || [],
                              } as CastingProject;
                              setCurrentProject(projectWithCrewFromDb);
                            }
                          } catch (_error) {
                            // If reload fails, still use the returned project data
                            // Also try to update projects list with the new project
                            setProjects(prev => {
                              if (isProducerWorkspaceSession && isTrollProject(projectWithCrew)) {
                                return prev.filter((project) => !isTrollProject(project));
                              }
                              const exists = prev.some((project) => project.id === normalizedProjectId);
                              if (exists) {
                                return prev.map((project) => {
                                  if (project.id === normalizedProjectId) {
                                    return projectWithCrew;
                                  }
                                  return project;
                                });
                              } else {
                                return [projectWithCrew, ...prev];
                              }
                            });
                          }
                        } else {
                          // Fallback: reload projects if no project data
                          try {
                            const loadedProjects = filterProjectsForSession(await castingService.getProjects());
                            setProjects(loadedProjects);
                            if (loadedProjects.length > 0) {
                              const preferredProject = isProducerWorkspaceSession
                                ? loadedProjects.find((project) => !isContentProducerDemoProject(project)) ?? null
                                : loadedProjects[0];
                              setCurrentProject(preferredProject);
                            }
                          } catch (error) {
                            console.error('Failed to reload projects:', error);
                          }
                        }
                      }}
                    />
                  </Suspense>
                </ProjectProvider>
              </MemoryRouter>
            </QueryClientProvider>
          )}
        </DialogContent>
      </Dialog>

      {/* Universal Confirmation Dialog (replaces all window.confirm calls) */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={() => {
          setConfirmDeleteOpen(false);
          setConfirmDeleteContext(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
          },
        }}
        sx={{ zIndex: Z_INDEX.dialog }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            pb: 2,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'rgba(255, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DeleteIcon sx={{ fontSize: 28, color: '#ff4444' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
            {confirmDeleteContext?.type === 'project' 
              ? branding.tokens.labels.deleteProjectLabel
              : confirmDeleteContext?.type === 'role'
                ? (branding.tokens.labels.roleDialogEditTitle || 'Delete Role')
                : confirmDeleteContext?.type === 'candidate'
                  ? (branding.tokens.labels.candidateLabel || 'Delete Candidate')
                  : (branding.tokens.labels.scheduleLabel || 'Delete Schedule')}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, px: 3, pb: 2 }}>
          <Typography variant="body1" sx={{ mb: 2, color: 'rgba(255,255,255,0.9)', fontSize: '1rem' }}>
            {confirmDeleteContext?.name 
              ? `${branding.tokens.labels.confirmDeleteProjectDialogBody?.replace('{project}', confirmDeleteContext.name) || `Are you sure you want to delete "${confirmDeleteContext.name}"?`}`
              : (branding.tokens.labels.confirmDeleteRole || 'Are you sure you want to delete this item?')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
            {branding.tokens.labels.deleteProjectWarning || 'This action cannot be undone.'}
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            gap: 2,
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Button
            onClick={() => {
              setConfirmDeleteOpen(false);
              setConfirmDeleteContext(null);
            }}
            variant="outlined"
            sx={{
              color: 'rgba(255,255,255,0.8)',
              borderColor: 'rgba(255,255,255,0.2)',
              textTransform: 'none',
              px: 3,
              py: 1,
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.3)',
                bgcolor: 'rgba(255,255,255,0.05)',
              },
            }}
          >
            {branding.tokens.labels.cancelLabel}
          </Button>
          <Button
            onClick={async () => {
              executeConfirmedDelete();
            }}
            variant="contained"
            startIcon={<DeleteIcon />}
            sx={{
              bgcolor: '#ff4444',
              color: '#fff',
              textTransform: 'none',
              px: 3,
              py: 1,
              fontWeight: 600,
              '&:hover': {
                bgcolor: '#ff3333',
              },
            }}
          >
            {branding.tokens.labels.deleteProjectLabel}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(projectCopyDialog)}
        onClose={() => {
          if (!projectCopySubmitting) {
            setProjectCopyDialog(null);
          }
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#111827',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1.5 }}>
          Lag prosjektkopi
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Stack spacing={2}>
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#dbeafe', border: '1px solid rgba(96,165,250,0.25)' }}>
              Secrets og Client Access Vault kopieres aldri. Klientdata, reviewhistorikk og økonomi er av som standard.
            </Alert>
            <TextField
              label="Navn på ny kopi"
              value={projectCopyDialog?.name ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setProjectCopyDialog((current) => current ? { ...current, name: value } : current);
              }}
              fullWidth
              autoFocus
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.62)' } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.28)' },
                  '&.Mui-focused fieldset': { borderColor: '#38bdf8' },
                },
              }}
            />
            <Stack spacing={0.75}>
              <FormControlLabel
                control={<Checkbox checked={projectCopyDialog?.includeClientData ?? false} />}
                onChange={(_, checked) => setProjectCopyDialog((current) => current ? { ...current, includeClientData: checked } : current)}
                label="Ta med klientdata"
              />
              <FormControlLabel
                control={<Checkbox checked={projectCopyDialog?.includeReviewHistory ?? false} />}
                onChange={(_, checked) => setProjectCopyDialog((current) => current ? { ...current, includeReviewHistory: checked } : current)}
                label="Ta med reviewhistorikk og godkjenninger"
              />
              <FormControlLabel
                control={<Checkbox checked={projectCopyDialog?.includeEconomy ?? false} />}
                onChange={(_, checked) => setProjectCopyDialog((current) => current ? { ...current, includeEconomy: checked } : current)}
                label="Ta med økonomi, avtaler og utlegg"
              />
              <FormControlLabel
                control={<Checkbox checked={projectCopyDialog?.includeTeam ?? true} />}
                onChange={(_, checked) => setProjectCopyDialog((current) => current ? { ...current, includeTeam: checked } : current)}
                label="Ta med team og møteplan"
              />
              <FormControlLabel
                control={<Checkbox checked={projectCopyDialog?.includeProductionData ?? true} />}
                onChange={(_, checked) => setProjectCopyDialog((current) => current ? { ...current, includeProductionData: checked } : current)}
                label="Ta med produksjonsdata, scener og shotlist"
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Button
            onClick={() => setProjectCopyDialog(null)}
            disabled={projectCopySubmitting}
            sx={{ color: 'rgba(255,255,255,0.72)', textTransform: 'none' }}
          >
            Avbryt
          </Button>
          <Button
            onClick={() => { void handleSubmitProjectCopy(); }}
            disabled={projectCopySubmitting || !projectCopyDialog?.name.trim()}
            variant="contained"
            startIcon={projectCopySubmitting ? <CircularProgress size={16} /> : <ContentCopyIcon />}
            sx={{ bgcolor: '#38bdf8', color: '#07111f', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#7dd3fc' } }}
          >
            Lag kopi
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog
        open={deleteProjectDialogOpen}
        onClose={() => {
          setDeleteProjectDialogOpen(false);
          setProjectToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            pb: 2,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'rgba(255, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DeleteIcon sx={{ fontSize: 28, color: '#ff4444' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
            {branding.tokens.labels.deleteProjectLabel}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, px: 3, pb: 2 }}>
          <Typography variant="body1" sx={{ mb: 2, color: 'rgba(255,255,255,0.9)', fontSize: '1rem' }}>
            {branding.tokens.labels.confirmDeleteProjectDialogBody.replace('{project}', projectToDelete?.name || '')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.875rem' }}>
            {branding.tokens.labels.deleteProjectWarning}
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            gap: 2,
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Button
            onClick={() => {
              setDeleteProjectDialogOpen(false);
              setProjectToDelete(null);
            }}
            variant="outlined"
            sx={{
              color: 'rgba(255,255,255,0.8)',
              borderColor: 'rgba(255,255,255,0.2)',
              textTransform: 'none',
              px: 3,
              py: 1,
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.3)',
                bgcolor: 'rgba(255,255,255,0.05)',
              },
            }}
          >
            {branding.tokens.labels.cancelLabel}
          </Button>
          <Button
            onClick={async () => {
              if (!projectToDelete) return;
              
              try {
                await castingService.deleteProject(projectToDelete.id);
                await loadProjects();
                // If we deleted the current project, select the first available one
                if (currentProject?.id === projectToDelete.id) {
                  const remainingProjects = filterProjectsForSession(await castingService.getProjects());
                  if (remainingProjects.length > 0) {
                    setCurrentProject(remainingProjects[0]);
                  } else {
                    setCurrentProject(null);
                  }
                }
                setDeleteProjectDialogOpen(false);
                setProjectToDelete(null);
              } catch (error) {
                console.error('Error deleting project:', error);
                toast.showError(branding.tokens.labels.projectDeleteError);
              }
            }}
            variant="contained"
            startIcon={<DeleteIcon />}
            sx={{
              bgcolor: '#ff4444',
              color: '#fff',
              textTransform: 'none',
              px: 3,
              py: 1,
              fontWeight: 600,
              '&:hover': {
                bgcolor: '#ff3333',
              },
            }}
          >
            {branding.tokens.labels.deleteProjectLabel}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>

      {adminDashboardOpen && (
        <Suspense fallback={null}>
          <AdminDashboard
            key={headerActiveProject?.id ?? 'no-project'}
            open={adminDashboardOpen}
            onClose={() => setAdminDashboardOpen(false)}
            projectName={headerActiveProject?.name}
          />
        </Suspense>
      )}

      <RoleRoomBillingAccountDialog
        key={headerActiveProject?.id ?? 'no-project'}
        open={billingAccountDialogOpen}
        onClose={() => setBillingAccountDialogOpen(false)}
        account={billingAccount}
        loading={billingAccountLoading}
        error={billingAccountError}
        actionPending={billingActionPending}
        onRefresh={loadBillingAccount}
        onManageBilling={handleOpenBillingPortal}
        onRetryPayment={handleRetryBillingPayment}
        currentUser={{
          name: adminUser?.display_name || adminUser?.email || 'Role Room-bruker',
          email: adminUser?.email || '',
          roleLabel: headerRoleLabel,
          professionLabel: headerProfessionLabel,
          workspaceLabel: headerBrandSubtitle,
        }}
        currentProject={headerActiveProject ? {
          id: headerActiveProject.id,
          name: headerActiveProject.name,
          clientName: headerActiveProject.clientName,
          workflowLabel: headerActiveProject.producerWorkflowStatus
            ? PRODUCER_PROJECT_STATUS_LABELS[headerActiveProject.producerWorkflowStatus]
            : null,
          teamMembers: currentProjectTeamMembers,
        } : null}
        adminPreview={canSwitchRoleRoomRole ? {
          enabled: true,
          selectedMode: currentAdminPreviewMode,
          clientPortalAvailable: Boolean(currentClientPortalPreviewUrl),
          onSelectMode: handleSelectAdminPreviewMode,
          onOpenClientPortal: handleOpenClientPortalPreview,
        } : null}
        onProjectUpdated={async (updatedProject) => {
          if (updatedProject) {
            setCurrentProject(updatedProject);
          }
          await loadProjects();
        }}
      />

      {loginDialogOpen && (
        <Suspense fallback={null}>
          <LoginDialog
            open={loginDialogOpen}
            onClose={() => setLoginDialogOpen(false)}
            onLoginSuccess={(user) => {
              setAdminUser(normalizeAdminUser(user));
              setLoginDialogOpen(false);
            }}
          />
        </Suspense>
      )}

      {(showTutorial || previewTutorial !== null) && (
        <Suspense fallback={null}>
          <CastingPlannerTutorial
            open={showTutorial || previewTutorial !== null}
            onClose={() => {
              setShowTutorial(false);
              setPreviewTutorial(null);
            }}
            onNavigateToTab={navigateToTab}
            customTutorial={previewTutorial || undefined}
            category={previewTutorial?.category || activeTutorialCategory}
          />
        </Suspense>
      )}

      {showTutorialEditor && (
        <Suspense fallback={null}>
          <TutorialEditorPanel
            open={showTutorialEditor}
            onClose={() => setShowTutorialEditor(false)}
            onPreviewTutorial={openPreviewTutorial}
          />
        </Suspense>
      )}

      {/* Consent Contract Dialog */}
      {consentContractDialogOpen && (
        <Suspense fallback={null}>
          <ConsentContractDialog
            key={`${currentProject?.id ?? 'no-project'}:${selectedCandidate?.id ?? 'no-candidate'}`}
            open={consentContractDialogOpen}
            onClose={() => {
              setConsentContractDialogOpen(false);
              setSelectedCandidate(null);
            }}
            candidate={selectedCandidate}
            project={currentProject}
            onConsentSent={() => {
              loadProjects();
            }}
            onConsentUpdated={() => {
              loadProjects();
            }}
          />
        </Suspense>
      )}

      {onboardingProfession && showOnboarding && (
        <Suspense fallback={null}>
          <ProfessionOnboardingDialog
            open={showOnboarding}
            onClose={closeOnboarding}
            profession={onboardingProfession}
            userName={adminUser?.display_name}
          />
        </Suspense>
      )}
    </>
  );
}
