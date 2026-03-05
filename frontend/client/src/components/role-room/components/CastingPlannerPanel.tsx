import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense, startTransition, memo, type FC, type MouseEvent, type ReactElement, type ReactNode, type SyntheticEvent } from 'react';
import { Z_INDEX } from '../config/zIndex';
import { useToast } from './ToastStack';
import { useBrandingSettings } from '../hooks/useBrandingSettings.ts';
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
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Badge,
  useTheme,
  useMediaQuery,
  InputAdornment,
  Grow,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Stack,
  CircularProgress,
  Tooltip,
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
  Description as DescriptionIcon,
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

// PNG-based tab icons from /icons/Keep/
import {
  DashboardTabIcon,
  RolesTabIcon,
  CandidatesTabIcon,
  AuditionsTabIcon,
  TeamTabIcon,
  LocationsTabIcon,
  EquipmentTabIcon,
  CalendarTabIcon,
  ShotListTabIcon,
  StoryArcTabIcon,
  SharingTabIcon,
  LiveSetTabIcon,
} from './icons';

import type { CastingProject, Role, Candidate, Schedule } from '../models/casting';
import { RichTextEditor } from './RichTextEditor';
import { AuditionSchedulePanel } from './AuditionSchedulePanel';
import rolesBackdrop4 from './icons/Keep/roles_backdrop_4.png';
import { storyLogicService, type StoryLogicState } from '../services/storyLogicService';

// Custom icon: Person holding camera with list/clipboard
import { castingService } from '../services/castingService';
import { resetMockCastingData } from '../data/mockCastingData';
import { sceneComposerService } from '../services/sceneComposerService';
import { consentService } from '../services/consentService';
import { castingAuthService } from '../services/castingAuthService';
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
const OffersContractsPanel = lazy(() => import('./OffersContractsPanel'));
const ProductionCalendarPanel = lazy(() => import('./ProductionCalendarPanel'));
const CrewCalendarPanel = lazy(() => import('./production/CrewCalendarPanel').then(m => ({ default: m.CrewCalendarPanel })));

// Lazy load dialogs and modals for better initial load
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const LoginDialog = lazy(() => import('./LoginDialog'));
const CastingSharingDialog = lazy(() => import('./CastingSharingDialog').then(m => ({ default: m.CastingSharingDialog })));
const CastingProfessionDialog = lazy(() => import('./CastingProfessionDialog').then(m => ({ default: m.CastingProfessionDialog })));
const ProfessionOnboardingDialog = lazy(() => import('./ProfessionOnboardingDialog').then(m => ({ default: m.ProfessionOnboardingDialog })));

import { useProfessionOnboarding, type ProfessionType } from './ProfessionOnboardingDialog';
import { useAuth } from '@/hooks/useAuth';
import authSessionService from '../services/authSessionService';
import settingsService from '../services/settingsService';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import NewProjectCreationModal from './Planning/NewProjectCreationModal';

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
} as const;

interface CandidatePhotoFocalPoint {
  x: number;
  y: number;
}

const DEFAULT_CANDIDATE_FOCAL_POINT: CandidatePhotoFocalPoint = { x: 50, y: 50 };

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

const TAB_IDS = [
  'tabpanel-oversikt',
  'tabpanel-roller',
  'tabpanel-kandidater',
  'tabpanel-auditions',
  'tabpanel-team',
  'tabpanel-lokasjoner',
  'tabpanel-rekvisitter',
  'tabpanel-produksjonsplan',
  'tabpanel-shot-lists',
  'tabpanel-story-arc-studio',
  'tabpanel-deling',
  'tabpanel-live-set',
];
const TEAM_TAB_INDEX = 4;
const SHOT_LIST_TAB_INDEX = 8;

const TabPanel = memo(function TabPanel({ children, value, index }: TabPanelProps) {
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
        padding: isMobile ? '8px' : isTablet ? '12px' : '16px',
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
  onClose,
  isFullscreen = false,
  onToggleFullscreen,
  isStandalone = false,
  isGuestMode = false,
}: CastingPlannerPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  // Responsive quick-contact tiers (7-level layout scaling)
  const quickTier2 = useMediaQuery('(min-width:480px)');
  const quickTier3 = useMediaQuery('(min-width:768px)');
  const quickTier4 = useMediaQuery('(min-width:1024px)');
  const quickTier5 = useMediaQuery('(min-width:1280px)');
  const quickTier6 = useMediaQuery('(min-width:1600px)');
  const quickTier7 = useMediaQuery('(min-width:2000px)');
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
  
  const [activeTab, setActiveTab] = useState(0);
  const [teamDashboardOpenSignal, setTeamDashboardOpenSignal] = useState(0);
  const [teamDashboardDefaultSegment, setTeamDashboardDefaultSegment] = useState<'all' | 'technical'>('all');
  const [storyArcView, setStoryArcView] = useState<'main' | 'story-logic' | 'story-writer'>('main');
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
  const [sharingDialogOpen, setSharingDialogOpen] = useState(false);
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
  }>({
    canViewAll: false,
    canEditCasting: false,
    canEditProduction: false,
    canEditShotLists: false,
    canManageCrew: false,
    canManageLocations: false,
    canApprove: false,
  });
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  
  // Ref to track current project ID for stale response detection
  const currentProjectIdRef = useRef<string | null>(null);
  
  const [profession, setProfession] = useState<'photographer' | 'videographer' | null>(null);
  const [professionDialogOpen, setProfessionDialogOpen] = useState(false);
  
  // Map profession to onboarding profession type
  const getOnboardingProfession = (): ProfessionType | null => {
    if (!profession) return null;
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
  const normalizeAdminUser = (user?: { id: number | string; email: string; role: string; display_name: string } | null) => {
    if (!user) return null;
    const parsedId = Number(user.id);
    return {
      ...user,
      id: Number.isFinite(parsedId) ? parsedId : 0,
    };
  };
  const [adminUser, setAdminUser] = useState<{ id: number; email: string; role: string; display_name: string } | null>(
    () => normalizeAdminUser(authSessionService.getSessionSync().adminUser)
  );
  const [authLoaded, setAuthLoaded] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<CastingProject | null>(null);
  const [projectCreationModalOpen, setProjectCreationModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<CastingProject | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const handleOpenTechnicalTeamDashboard = useCallback(() => {
    setTeamDashboardDefaultSegment('technical');
    setTeamDashboardOpenSignal((current) => current + 1);
    setActiveTab(SHOT_LIST_TAB_INDEX);
  }, []);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(true); // Open by default to let user choose project
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  // Preload lazily-rendered dialog modules after initial mount so first open
  // does not suspend during a synchronous user interaction.
  useEffect(() => {
    void Promise.allSettled([
      import('./CastingProfessionDialog'),
      import('./CastingSharingDialog'),
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

  const navigateToTab = useCallback((tabIndex: number) => {
    startTransition(() => setActiveTab(tabIndex));
  }, []);

  const openRoleDialog = useCallback(() => {
    blurActiveElement();
    startTransition(() => setRoleDialogOpen(true));
  }, [blurActiveElement]);

  const openCandidateDialog = useCallback(() => {
    blurActiveElement();
    startTransition(() => setCandidateDialogOpen(true));
  }, [blurActiveElement]);

  const openScheduleDialog = useCallback(() => {
    blurActiveElement();
    startTransition(() => setScheduleDialogOpen(true));
  }, [blurActiveElement]);

  const openSharingDialog = useCallback(() => {
    blurActiveElement();
    startTransition(() => setSharingDialogOpen(true));
  }, [blurActiveElement]);

  const openProfessionDialog = useCallback(() => {
    blurActiveElement();
    startTransition(() => setProfessionDialogOpen(true));
  }, [blurActiveElement]);

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
    startTransition(() => setProjectCreationModalOpen(true));
  }, [blurActiveElement]);

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
    if (currentProject?.id) {
      const updated = await castingService.getProject(currentProject.id);
      if (updated) setCurrentProject(updated);
    }
  }, [currentProject?.id]);

  // Story Logic → Manuscript sync: capture story logic data when saved
  const handleStoryLogicSave = useCallback((data: StoryLogicState) => {
    setStoryLogicData(data);
  }, []);

  // Load story logic data when project changes
  useEffect(() => {
    if (currentProject?.id) {
      storyLogicService.getStoryLogic(currentProject.id).then(data => {
        if (data) setStoryLogicData(data);
      }).catch(err => console.warn('Failed to load story logic:', err));
    }
  }, [currentProject?.id]);
  
  // Sort projects by updatedAt (most recent first) and limit to 4 for header
  const recentProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .slice(0, 4);
  }, [projects]);
  
  const hasMoreProjects = projects.length > 4;
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
    };
    return labels[role] || role;
  };

  const mapAccountRoleToProjectRole = (role?: string | null): string | null => {
    if (!role) return null;
    const normalized = role.trim().toLowerCase();

    if (normalized === 'owner') return 'director';
    if (normalized === 'admin') return 'producer';
    if (normalized === 'director') return 'director';
    if (normalized === 'producer') return 'producer';
    if (normalized === 'casting_director') return 'casting_director';
    if (normalized === 'production_manager') return 'production_manager';
    if (normalized === 'camera_team' || normalized === 'camera_operator') return 'camera_team';
    if (normalized === 'writer') return 'writer';
    if (normalized === 'script_editor') return 'script_editor';
    if (normalized === 'reader') return 'reader';
    if (normalized === 'agency') return 'agency';

    // Map photo/video account roles to the closest project-role permission set
    if (['photographer', 'film_photographer', 'photo_director', 'photo_assistant'].includes(normalized)) {
      return 'camera_team';
    }

    return null;
  };

  const accountRoleLabel = adminUser?.role ? getHeaderRoleLabel(adminUser.role) : '';
  const projectRoleLabel = currentUserRole?.role ? getHeaderRoleLabel(currentUserRole.role) : '';
  const headerRoleLabel = projectRoleLabel && accountRoleLabel && projectRoleLabel !== accountRoleLabel
    ? `${accountRoleLabel} (konto) • ${projectRoleLabel} (prosjekt)`
    : projectRoleLabel || accountRoleLabel;
  const headerProfessionLabel = profession ? PROFESSION_CONFIG[profession]?.name : '';

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
    { color: professionConfig?.color || '#8b5cf6', icon: DashboardTabIcon },
    { color: '#f48fb1', icon: RolesTabIcon },
    { color: professionConfig?.color || '#10b981', icon: CandidatesTabIcon },
    { color: '#ffb800', icon: AuditionsTabIcon },
    { color: '#00d4ff', icon: TeamTabIcon },
    { color: '#4caf50', icon: LocationsTabIcon },
    { color: '#9333ea', icon: EquipmentTabIcon },
    { color: '#9c27b0', icon: CalendarTabIcon },
    { color: professionConfig?.color || '#e91e63', icon: ShotListTabIcon },
    { color: '#ec4899', icon: StoryArcTabIcon },
    { color: '#06b6d4', icon: SharingTabIcon },
    { color: '#ef4444', icon: LiveSetTabIcon },
  ], [professionConfig?.color]);
  const roleDialogAccentColor = '#b86bff';
  const roleDialogAccentSoftColor = alpha(roleDialogAccentColor, 0.2);
  const roleDialogBackdrop = `url(${rolesBackdrop4})`;

  // Quick navigation links for SpeedDial - matching tabConfig icons and colors
  // SpeedDial with direction="up" displays items from first to last (nearest to farthest from FAB)
  // Tab order: 0-Oversikt, 1-Roller, 2-Kandidater, 3-Auditions, 4-Team, 5-Steder, 6-Utstyr, 7-Kalender, 8-Shot-list, 9-Deling
  const quickNavigationLinks = useMemo(() => [
    { 
      title: branding.tokens.labels.newProjectTitle, 
      description: branding.tokens.labels.overviewDescription, 
      color: professionConfig?.color || '#8b5cf6', 
      icon: AddIcon, 
      tabIndex: -1, // Special action
      action: openProjectCreationModal,
      badge: null,
    },
    { 
      title: branding.tokens.labels.team, 
      description: branding.tokens.labels.teamDescription, 
      color: tabConfig[4].color, // #00d4ff
      icon: tabConfig[4].icon, // GroupsIcon
      tabIndex: 4,
      badge: currentProject?.crew?.length || 0,
    },
    { 
      title: branding.tokens.labels.locations, 
      description: branding.tokens.labels.locationsDescription, 
      color: tabConfig[5].color, // #4caf50
      icon: tabConfig[5].icon, // LocationIcon
      tabIndex: 5,
      badge: currentProject?.locations?.length || 0,
    },
    { 
      title: branding.tokens.labels.equipment, 
      description: branding.tokens.labels.equipmentDescription, 
      color: tabConfig[6].color, // #9333ea
      icon: tabConfig[6].icon, // PropIcon
      tabIndex: 6,
      badge: currentProject?.props?.length || 0,
    },
    { 
      title: branding.tokens.labels.schedule, 
      description: branding.tokens.labels.scheduleDescription, 
      color: tabConfig[7].color, // #9c27b0
      icon: tabConfig[7].icon, // CalendarIcon
      tabIndex: 7,
      badge: currentProject?.productionDays?.length || 0,
    },
    { 
      title: profession ? (PROFESSION_CONFIG[profession]?.terminology.shotList || branding.tokens.labels.shotList) : branding.tokens.labels.shotList, 
      description: profession === 'photographer'
        ? branding.tokens.labels.shotListDescriptionPhoto
        : branding.tokens.labels.shotListDescriptionVideo, 
      color: tabConfig[8].color, // professionConfig?.color || '#e91e63'
      icon: tabConfig[8].icon, // ShotListIcon
      tabIndex: 8,
      badge: currentProject?.shotLists?.length || 0,
    },
  ], [branding.tokens.labels, profession, professionConfig, tabConfig, currentProject, openProjectCreationModal]);

  const fabIconKey = branding.tokens.labels.fabIcon;
  const fabIconMap: Record<string, ReactElement> = {
    speedDial: <SpeedDialIcon />,
    add: <AddIcon />,
    list: <ViewListIcon />,
    home: <HomeIcon />,
    work: <WorkIcon />,
    schedule: <ScheduleIcon />,
  };
  const fabIcon = fabIconMap[fabIconKey] ?? <SpeedDialIcon />;

  // Get user ID (fallback to 'default' if not available)
  const getUserId = useCallback((): string => {
    const session = authSessionService.getSessionSync();
    if (session.currentUserId) return session.currentUserId;
    if (session.adminUser?.id !== undefined && session.adminUser?.id !== null) {
      return String(session.adminUser.id);
    }
    return 'default';
  }, []);

  // Load profession from API or settings cache
  const loadProfession = useCallback(async (): Promise<'photographer' | 'videographer' | null> => {
    try {
      const userId = getUserId();
      const response = await fetch(`/api/user/kv/casting-profession?user_id=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.value && (data.value === 'photographer' || data.value === 'videographer')) {
          await settingsService.setSetting('virtualStudio_castingProfession', data.value, { userId });
          return data.value;
        }
      }
    } catch (_error) {
      // Silently handle API failure
    }
    try {
      const cached = await settingsService.getSetting<string>('virtualStudio_castingProfession', { userId: getUserId() });
      if (cached && (cached === 'photographer' || cached === 'videographer')) {
        return cached;
      }
    } catch (_error) {
      // Silently handle settings cache failure
    }
    return null;
  }, [getUserId]);

  // Save profession to API and settings cache
  const saveProfession = useCallback(async (prof: 'photographer' | 'videographer'): Promise<void> => {
    try {
      const userId = getUserId();
      await fetch('/api/user/kv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'casting-profession',
          value: prof,
          user_id: userId,
        }),
      });
      await settingsService.setSetting('virtualStudio_castingProfession', prof, { userId });
    } catch (_error) {
      // Silently handle API save failure
    }
    try {
      await settingsService.setSetting('virtualStudio_castingProfession', prof, { userId: getUserId() });
    } catch (_error) {
      // Silently handle settings cache save failure
    }
  }, [getUserId]);

  // Handle profession selection
  const handleProfessionSelect = async (prof: 'foto' | 'video' | 'felles' | 'admin') => {
    // Map new profession types to internal types
    const internalProf = prof === 'foto' ? 'photographer' : 
                         prof === 'video' ? 'videographer' : 
                         prof === 'felles' ? 'photographer' : 'photographer';
    setProfession(internalProf);
    setProfessionDialogOpen(false);
    await saveProfession(internalProf);
  };

  // Authentication guard - redirect to landing page if not logged in
  useEffect(() => {
    authSessionService.loadSession().then(session => {
      setAdminUser(normalizeAdminUser(session.adminUser));
      setAuthLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!authLoaded) return;
    if (!adminUser && isStandalone) {
      // Only redirect if this is the standalone casting page — prevents redirect loops
      window.location.href = '/casting.html';
    }
  }, [adminUser, authLoaded, isStandalone]);

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
        // Show dialog if profession not set
        openProfessionDialog();
      }
    };
    initProfession();
  }, [adminUser, loadProfession, openProfessionDialog]);

  useEffect(() => {
    // Load projects regardless of profession being set
    // TROLL project should be accessible to all professions
    // Initialize mock data (TROLL) regardless of profession
    
    // Use async function to handle async getProjects
    const initializeData = async () => {
      setProjectsLoading(true);
      try {
        const projects = await castingService.getProjects();
        
        let shouldInitializeMock = false;
        
        if (projects.length === 0) {
          shouldInitializeMock = true;
        } else {
          // Check if the first project is empty (no candidates, roles, etc.)
          // Also check counts from backend (rolesCount, candidatesCount, etc.)
          const firstProject = projects[0];
          const hasArrayData = 
            (firstProject.candidates && firstProject.candidates.length > 0) ||
            (firstProject.roles && firstProject.roles.length > 0) ||
            (firstProject.crew && firstProject.crew.length > 0) ||
            (firstProject.locations && firstProject.locations.length > 0);
          
          // Backend may return counts instead of full arrays
          const hasCountData = 
            (firstProject.rolesCount && firstProject.rolesCount > 0) ||
            (firstProject.candidatesCount && firstProject.candidatesCount > 0) ||
            (firstProject.crewCount && firstProject.crewCount > 0) ||
            (firstProject.locationsCount && firstProject.locationsCount > 0);
          
          const isEmpty = !hasArrayData && !hasCountData;
          
          if (isEmpty) {
            // Delete empty project
            try {
              await castingService.deleteProject(firstProject.id);
            } catch (error) {
              console.error('Failed to delete empty project:', error);
            }
            shouldInitializeMock = true;
          }
        }
        
        if (shouldInitializeMock) {
          try {
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
            
            // Reload projects after mock data initialization
            const mockProjects = await castingService.getProjects();
            if (mockProjects.length > 0) {
              setProjects(mockProjects);
              // DON'T auto-select project - let user choose from the selector
              // setCurrentProject(mockProjects[0]);
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

    initializeData();
  }, []); // Run on mount - TROLL project is available to all professions

  const loadUserRole = useCallback(async () => {
    if (currentProject) {
      // Capture the project ID at the start of this async operation
      const projectIdForRequest = currentProject.id;
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
        });
        setPermissionsLoading(false);
        return;
      }
      
      try {
        // Check if logged in as admin/owner - grant full permissions
        if (adminUser && (adminUser.role === 'admin' || adminUser.role === 'owner')) {
          setCurrentUserRole({
            id: `role-${adminUser.id}-${projectIdForRequest}`,
            userId: String(adminUser.id),
            projectId: projectIdForRequest,
            role: adminUser.role === 'owner' ? 'director' : 'producer',
            permissions: {
              canViewAll: true,
              canEditCasting: true,
              canEditProduction: true,
              canEditShotLists: true,
              canManageCrew: true,
              canManageLocations: true,
              canApprove: true,
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
          });
          setPermissionsLoading(false);
          return;
        }

        // Standalone login sets an account role, but project userRoles may still be empty.
        // Auto-provision a project role from the logged-in account role so permission checks work.
        if (adminUser) {
          const mappedRole = mapAccountRoleToProjectRole(adminUser.role);
          if (mappedRole) {
            const userId = String(adminUser.id);
            const userRoles = await castingService.getUserRoles(projectIdForRequest);
            const existingRole = userRoles.find((ur) => String(ur.userId) === userId);

            if (!existingRole) {
              const now = new Date().toISOString();
              await castingService.saveUserRole(
                projectIdForRequest,
                {
                  id: `userrole-${userId}-${projectIdForRequest}`,
                  userId,
                  projectId: projectIdForRequest,
                  role: mappedRole as any,
                  permissions: castingAuthService.getDefaultPermissions(mappedRole as any),
                  createdAt: now,
                  updatedAt: now,
                } as any,
              );
            }
          }
        }
        
        const role = await castingAuthService.getUserRole(projectIdForRequest);
        
        // Check if the project has changed while we were fetching - discard stale response
        if (currentProjectIdRef.current !== projectIdForRequest) {
          return;
        }
        
        setCurrentUserRole(role);
        
        // Load all permissions in parallel
        const [
          canViewAll,
          canEditCasting,
          canEditProduction,
          canEditShotLists,
          canManageCrew,
          canManageLocations,
          canApprove
        ] = await Promise.all([
          castingAuthService.canViewAll(projectIdForRequest),
          castingAuthService.canEditCasting(projectIdForRequest),
          castingAuthService.canEditProduction(projectIdForRequest),
          castingAuthService.canEditShotLists(projectIdForRequest),
          castingAuthService.canManageCrew(projectIdForRequest),
          castingAuthService.canManageLocations(projectIdForRequest),
          castingAuthService.canApprove(projectIdForRequest),
        ]);
        
        // Check again after permissions fetch - discard stale response
        if (currentProjectIdRef.current !== projectIdForRequest) {
          return;
        }
        
        setPermissions({
          canViewAll,
          canEditCasting,
          canEditProduction,
          canEditShotLists,
          canManageCrew,
          canManageLocations,
          canApprove,
        });
      } catch (error) {
        console.error('Error loading user role:', error);
        // Only update state if this is still the current project
        if (currentProjectIdRef.current === projectIdForRequest) {
          setCurrentUserRole(null);
          setPermissions({
            canViewAll: false,
            canEditCasting: false,
            canEditProduction: false,
            canEditShotLists: false,
            canManageCrew: false,
            canManageLocations: false,
            canApprove: false,
          });
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
      });
    }
  }, [currentProject, adminUser, isGuestMode]);

  const loadAvailableScenes = useCallback(async () => {
    // Load scenes from casting service
    const castingScenes = castingService.getAvailableScenes();
    // Also load scenes from the scene composer for a more complete list
    try {
      const composerScenes = await sceneComposerService.getAllScenesAsync();
      const composerMapped = composerScenes.map(s => ({
        id: s.id,
        name: s.name || `${branding.tokens.labels.sceneFallbackPrefix} ${s.id}`,
        thumbnail: undefined,
      }));
      // Merge both sources, deduplicate by id
      const merged = [...castingScenes];
      for (const cs of composerMapped) {
        if (!merged.some(s => s.id === cs.id)) {
          merged.push(cs);
        }
      }
      setAvailableScenes(merged);
    } catch {
      // Fallback to casting scenes only
      setAvailableScenes(castingScenes);
    }
  }, []);

  // Re-run when profession changes in case UI needs updating
  useEffect(() => {
    if (profession && projects.length > 0) {
      loadAvailableScenes();
      loadUserRole();
    }
  }, [profession, loadAvailableScenes, loadUserRole]);

  useEffect(() => {
    if (currentProject) {
      loadUserRole();
    }
  }, [currentProject, adminUser, loadUserRole]);

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
    if (!currentProject || quickContactIds.size === 0) return;
    const candidateIds = new Set(currentProject.candidates.map(candidate => candidate.id));
    const prunedIds = [...quickContactIds].filter((candidateId) => candidateIds.has(candidateId));
    if (prunedIds.length !== quickContactIds.size) {
      setQuickContactIds(new Set(prunedIds));
    }
  }, [currentProject, quickContactIds]);

  const loadProjects = useCallback(async () => {
    try {
      const loadedProjects = await castingService.getProjects();
      setProjects(loadedProjects);
      
      // If we have a current project already selected, refresh its data
      // Otherwise, DON'T auto-select - let user choose from the project selector
      const projectIdToLoad = currentProject?.id;
      
      if (loadedProjects.length > 0 && projectIdToLoad) {
        // Only refresh data if user already selected a project
        const targetProject = loadedProjects.find(p => p.id === projectIdToLoad);
        
        if (targetProject) {
          // Fetch the full project with all nested data
          const fullProject = await castingService.getProject(targetProject.id);
          if (fullProject) {
            setCurrentProject(fullProject);
          } else {
            setCurrentProject(targetProject);
          }
        }
      } else if (loadedProjects.length === 0) {
        // Only create empty project if mock data initialization didn't work
        const defaultProject: CastingProject = {
          id: `project-${Date.now()}`,
          name: profession ? `${branding.tokens.labels.newProjectPrefix} ${getTerm('project')}` : branding.tokens.labels.newCastingProjectTitle,
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
    } catch (error) {
      console.error('Error loading projects:', error);
      // Fallback to sync version — wrap in try/catch to prevent double-throw
      try {
        const loadedProjects = await castingService.getProjects();
        setProjects(loadedProjects);
        if (loadedProjects.length > 0) {
          // Maintain current project if possible
          const targetProject = currentProject?.id 
            ? loadedProjects.find(p => p.id === currentProject.id) || loadedProjects[0]
            : loadedProjects[0];
          setCurrentProject(targetProject);
        }
      } catch (fallbackError) {
        console.error('Fallback project load also failed:', fallbackError);
        setProjects([]);
      }
    }
  }, [profession, currentProject?.id]);

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
          const remaining = await castingService.getProjects();
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
  }, [currentProject, confirmDeleteContext, toast, branding.tokens.labels]);

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

  const handleSaveCandidate = useCallback(async () => {
    if (!currentProject || !selectedCandidate) return;
    
    if (!selectedCandidate.name.trim()) {
      toast.showWarning(branding.tokens.labels.candidateNameRequired);
      return;
    }
    
    const isNewCandidate = !selectedCandidate.id || selectedCandidate.id.startsWith('candidate-');
    const shouldSendConsent = isNewCandidate && sendConsentOnSave;
    
    try {
      await castingService.saveCandidate(currentProject.id, selectedCandidate);
      await loadProjects();
      
      // If user wanted to send consent, open the consent dialog after save
      if (shouldSendConsent) {
        // Get the saved candidate to ensure we have the correct ID
        const updatedProject = await castingService.getProject(currentProject.id);
        const savedCandidate = updatedProject?.candidates.find(c => c.name === selectedCandidate.name);
        
        if (savedCandidate) {
          setSelectedCandidate(savedCandidate);
          setCandidateDialogOpen(false);
          setSendConsentOnSave(false);
          openConsentContractDialog();
        } else {
          setCandidateDialogOpen(false);
          setSelectedCandidate(null);
          setSendConsentOnSave(false);
        }
      } else {
        setCandidateDialogOpen(false);
        setSelectedCandidate(null);
        setSendConsentOnSave(false);
      }
    } catch (error) {
      console.error('Error saving candidate:', error);
      toast.showError(branding.tokens.labels.candidateSaveError);
    }
  }, [currentProject, selectedCandidate, toast, loadProjects, sendConsentOnSave]);

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

  // Use data directly from currentProject instead of async service calls
  const roles = currentProject?.roles || [];
  const allCandidates = currentProject?.candidates || [];
  const allSchedules = currentProject?.schedules || [];
  
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

  const stats = useMemo(() => ({
    totalRoles: roles.length,
    openRoles: roles.filter(r => r.status === 'open' || r.status === 'casting').length,
    totalCandidates: candidates.length,
    upcomingSchedules: schedules.filter(s => s.status === 'scheduled' && new Date(s.date) >= new Date()).length,
  }), [roles, candidates, schedules]);

  const candidatePhotoFocalPoints = useMemo(
    () => getCandidatePhotoFocalPoints(selectedCandidate),
    [getCandidatePhotoFocalPoints, selectedCandidate],
  );

  return (
    <>
      {professionDialogOpen && (
        <Suspense fallback={null}>
          <CastingProfessionDialog
            open={professionDialogOpen}
            onSelect={handleProfessionSelect}
          />
        </Suspense>
      )}
      <Box
        role="main"
        aria-label={branding.appName}
        sx={{
        ...KEYFRAMES_STYLES,
        width: '100%',
        height: '100%',
        bgcolor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // Responsive base font size: larger on desktop for better readability
        fontSize: isDesktop ? '16px' : isTablet ? '16px' : '14px', // Prevent zoom on iOS for tablet/mobile
        touchAction: 'pan-y',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Project Selector Header */}
      <Box sx={{ 
        bgcolor: 'linear-gradient(180deg, #1c2128 0%, #161b22 100%)',
        background: 'linear-gradient(180deg, #1c2128 0%, #161b22 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        px: { xs: 1.5, sm: 2, md: 3 },
        py: { xs: 1, sm: 1.5 },
      }}>
        {/* Project chips row */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: { xs: 0.75, sm: 1 },
          overflowX: 'auto',
          pb: 0.5,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
        }}>
          {/* The Role Room Logo */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.5, sm: 1 },
              mr: { xs: 0.5, sm: 1 },
              flexShrink: 0,
            }}
          >
            <img
              src={branding.iconUrl}
              alt={branding.appName}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                objectFit: 'cover',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
              }}
            />
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'rgba(255,255,255,0.87)', 
                textTransform: 'uppercase', 
                letterSpacing: 1,
                fontSize: { xs: '0.6rem', sm: '0.65rem' },
                fontWeight: 600,
                whiteSpace: 'nowrap',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {branding.tokens.labels.projects}
            </Typography>
          </Box>
          
          {recentProjects.map((project) => {
            const isActive = currentProject?.id === project.id;
            const candidateCount = project.candidates?.length || 0;
            return (
              <Box
                key={project.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 0.75, sm: 1.5 },
                  px: { xs: 1.5, sm: 2.5 },
                  py: { xs: 1, sm: 1.25 },
                  borderRadius: { xs: 2, sm: 2.5 },
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: isActive 
                    ? '2px solid #00d4ff' 
                    : '1px solid rgba(255,255,255,0.08)',
                  bgcolor: isActive 
                    ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 180, 230, 0.15) 100%)'
                    : 'rgba(255,255,255,0.02)',
                  background: isActive 
                    ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 180, 230, 0.15) 100%)'
                    : 'rgba(255,255,255,0.02)',
                  boxShadow: isActive 
                    ? '0 4px 20px rgba(0, 212, 255, 0.25), 0 0 0 1px rgba(0, 212, 255, 0.1), inset 0 1px 0 rgba(255,255,255,0.15)' 
                    : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  transform: isActive ? 'scale(1.02)' : 'scale(1)',
                  '&:hover, &:active': {
                    bgcolor: isActive 
                      ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 180, 230, 0.2) 100%)'
                      : 'rgba(255,255,255,0.06)',
                    background: isActive 
                      ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 180, 230, 0.2) 100%)'
                      : 'rgba(255,255,255,0.06)',
                    borderColor: isActive ? '#00d4ff' : 'rgba(255,255,255,0.15)',
                    transform: 'scale(1.02)',
                  },
                  flexShrink: 0,
                  minHeight: { xs: 44, sm: 48 },
                  touchAction: 'manipulation',
                  position: 'relative',
                  overflow: 'hidden',
                  // Active indicator bar at bottom
                  '&::after': isActive ? {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: '10%',
                    right: '10%',
                    height: '3px',
                    bgcolor: '#00d4ff',
                    borderRadius: '3px 3px 0 0',
                    boxShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
                  } : {},
                }}
              >
                <Box
                  onClick={() => setCurrentProject(project)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 0.75, sm: 1.25 },
                    cursor: 'pointer',
                    flex: 1,
                  }}
                >
                  {/* Active indicator dot with pulse animation */}
                  <Box sx={{ 
                    width: { xs: 10, sm: 12 }, 
                    height: { xs: 10, sm: 12 }, 
                    borderRadius: '50%', 
                    bgcolor: isActive ? '#00d4ff' : 'rgba(255,255,255,0.2)',
                    boxShadow: isActive ? '0 0 12px #00d4ff, 0 0 4px #00d4ff' : 'none',
                    flexShrink: 0,
                    border: isActive ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                    animation: isActive ? 'activePulse 2s ease-in-out infinite' : 'none',
                  }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <Typography 
                      sx={{ 
                        color: isActive ? '#fff' : 'rgba(255,255,255,0.75)',
                        fontSize: { xs: '0.8rem', sm: '0.9rem' },
                        fontWeight: isActive ? 700 : 500,
                        whiteSpace: 'nowrap',
                        maxWidth: { xs: '90px', sm: '130px', md: '180px' },
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        letterSpacing: isActive ? '0.02em' : 'normal',
                        textShadow: isActive ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                      }}
                    >
                      {project.name}
                    </Typography>
                    {isActive && (
                      <Typography 
                        sx={{ 
                          color: '#00d4ff',
                          fontSize: { xs: '0.6rem', sm: '0.65rem' },
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          mt: 0.25,
                        }}
                      >
                        {branding.tokens.labels.activeProjectLabel}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    size="small"
                    label={candidateCount}
                    sx={{
                      height: { xs: 22, sm: 24 },
                      minWidth: { xs: 28, sm: 32 },
                      bgcolor: isActive ? 'rgba(0, 212, 255, 0.35)' : 'rgba(255,255,255,0.08)',
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      fontWeight: 700,
                      border: isActive ? '1px solid rgba(0, 212, 255, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                      '& .MuiChip-label': { px: { xs: 0.75, sm: 1 } },
                      display: { xs: 'none', sm: 'flex' },
                    }}
                  />
                </Box>
                {/* Edit button */}
                <IconButton
                  size="small"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    setProjectToEdit(project);
                    openProjectCreationModal();
                  }}
                  aria-label={branding.tokens.labels.editProjectAriaLabel.replace('{project}', project.name)}
                  title={branding.tokens.labels.editProjectLabel}
                  sx={{
                    color: isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                    '&:hover, &:active': {
                      color: '#00d4ff',
                      bgcolor: 'rgba(0, 212, 255, 0.15)',
                    },
                    width: { xs: 28, sm: 32 },
                    height: { xs: 28, sm: 32 },
                    minWidth: { xs: 28, sm: 32 },
                    p: 0,
                    borderRadius: 1.5,
                  }}
                >
                  <EditIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />
                </IconButton>
                {/* Delete button */}
                <IconButton
                  size="small"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    setConfirmDeleteContext({ type: 'project', id: project.id, name: project.name });
                    setConfirmDeleteOpen(true);
                  }}
                  aria-label={branding.tokens.labels.deleteProjectAriaLabel.replace('{project}', project.name)}
                  title={branding.tokens.labels.deleteProjectLabel}
                  sx={{
                    color: isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)',
                    '&:hover, &:active': {
                      color: '#ff4444',
                      bgcolor: 'rgba(255, 68, 68, 0.15)',
                    },
                    width: { xs: 28, sm: 32 },
                    height: { xs: 28, sm: 32 },
                    minWidth: { xs: 28, sm: 32 },
                    p: 0,
                    borderRadius: 1.5,
                  }}
                >
                  <DeleteIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />
                </IconButton>
              </Box>
            );
          })}
          
          {/* Show all projects button when more than 4 */}
          {hasMoreProjects && (
            <Button
              size="small"
              onClick={() => setProjectSelectorOpen(true)}
              sx={{
                minWidth: 'auto',
                px: { xs: 1.5, sm: 2 },
                py: { xs: 0.5, sm: 0.75 },
                borderRadius: { xs: 1.5, sm: 2 },
                border: '1px solid rgba(139, 92, 246, 0.3)',
                bgcolor: 'rgba(139, 92, 246, 0.1)',
                color: '#a78bfa',
                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                fontWeight: 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: 'rgba(139, 92, 246, 0.2)',
                  borderColor: '#8b5cf6',
                },
              }}
            >
              +{projects.length - 4} til
            </Button>
          )}

          {/* Add new project button */}
          <IconButton
            size="small"
            onClick={() => {
              setProjectToEdit(null);
              openProjectCreationModal();
            }}
            aria-label={branding.tokens.labels.newProjectTitle}
            data-tutorial-target="create-project-button"
            sx={{
              width: { xs: 32, sm: 36 },
              height: { xs: 32, sm: 36 },
              minWidth: { xs: 32, sm: 36 },
              border: '1px dashed rgba(255,255,255,0.2)',
              borderRadius: { xs: 1.5, sm: 2 },
              color: 'rgba(255,255,255,0.87)',
              flexShrink: 0,
              '&:hover, &:active': {
                borderColor: '#00d4ff',
                color: '#00d4ff',
                bgcolor: 'rgba(0, 212, 255, 0.1)',
              },
            }}
          >
            <AddIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
          </IconButton>

          {/* Tutorial button */}
          <IconButton
            size="small"
            onClick={openTutorial}
            aria-label={branding.tokens.labels.tutorialLabel}
            title={branding.tokens.labels.tutorialTitle}
            sx={{
              width: { xs: 32, sm: 36 },
              height: { xs: 32, sm: 36 },
              minWidth: { xs: 32, sm: 36 },
              border: '1px solid rgba(233, 30, 99, 0.3)',
              borderRadius: { xs: 1.5, sm: 2 },
              color: '#e91e63',
              flexShrink: 0,
              bgcolor: 'rgba(233, 30, 99, 0.1)',
              '&:hover, &:active': {
                borderColor: '#e91e63',
                bgcolor: 'rgba(233, 30, 99, 0.2)',
              },
            }}
          >
            <TutorialIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
          </IconButton>

          <Box sx={{ flex: 1 }} />

          {adminUser ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  display: { xs: 'none', md: 'block' },
                }}
              >
                {adminUser.display_name || adminUser.email}
                {headerRoleLabel ? ` • ${headerRoleLabel}` : ''}
                {headerProfessionLabel ? ` • ${headerProfessionLabel}` : ''}
              </Typography>
              <Chip
                label={`${adminUser.display_name || adminUser.email}${headerRoleLabel ? ` • ${headerRoleLabel}` : ''}${headerProfessionLabel ? ` • ${headerProfessionLabel}` : ''}`}
                size="small"
                sx={{
                  display: { xs: 'inline-flex', md: 'none' },
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.8)',
                  maxWidth: 200,
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
              {/* Bytt profesjon - tilgjengelig for alle innloggede brukere */}
              <IconButton
                size="small"
                onClick={openProfessionDialog}
                aria-label={branding.tokens.labels.switchProfessionLabel}
                title={branding.tokens.labels.switchProfessionLabel}
                sx={{
                  color: '#10b981',
                  '&:hover': { bgcolor: 'rgba(16,185,129,0.1)' },
                }}
              >
                <SwapHorizIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
              </IconButton>
              {/* Admin Dashboard - kun for admin/owner */}
              {(adminUser.role === 'owner' || adminUser.role === 'admin') && (
                <>
                  <IconButton
                    size="small"
                    onClick={openTutorialEditor}
                    aria-label={branding.tokens.labels.editTutorialsLabel}
                    title={branding.tokens.labels.editTutorialsLabel}
                    sx={{
                      color: '#e91e63',
                      '&:hover': { bgcolor: 'rgba(233,30,99,0.1)' },
                    }}
                  >
                    <TutorialIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={openAdminDashboard}
                    aria-label={branding.tokens.labels.manageUsersLabel}
                    title={branding.tokens.labels.manageUsersLabel}
                    sx={{
                      color: '#8b5cf6',
                      '&:hover': { bgcolor: 'rgba(139,92,246,0.1)' },
                    }}
                  >
                    <AdminPanelSettingsIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={async () => {
                      setConfirmDeleteContext({ type: 'project', id: '__reset_demo__', name: 'Demo Data' });
                      setConfirmDeleteOpen(true);
                    }}
                    aria-label={branding.tokens.labels.resetDemoDataLabel}
                    title={branding.tokens.labels.resetDemoDataLabel}
                    sx={{
                      color: '#9333ea',
                      '&:hover': { bgcolor: 'rgba(147,51,234,0.1)' },
                    }}
                  >
                    <RefreshIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
                  </IconButton>
                </>
              )}
              {/* Onboarding controls */}
              <IconButton
                size="small"
                onClick={() => {
                  resetOnboarding();
                  startTransition(() => {
                    triggerProfessionOnboarding();
                  });
                }}
                aria-label={branding.tokens.labels.showIntroLabel}
                title={branding.tokens.labels.showIntroTitle}
                sx={{
                  color: '#ffb800',
                  '&:hover': { bgcolor: 'rgba(255,184,0,0.1)' },
                }}
              >
                <PlayArrowIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => {
                  authSessionService.clearSession().then(() => {
                    setAdminUser(null);
                    window.location.href = '/casting.html';
                  });
                }}
                aria-label={branding.tokens.labels.logoutLabel}
                title={branding.tokens.labels.logoutLabel}
                sx={{
                  color: 'rgba(255,255,255,0.87)',
                  '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' },
                }}
              >
                <LogoutIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
              </IconButton>
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
                '&:hover': { bgcolor: 'rgba(139,92,246,0.1)' },
              }}
            >
              <LoginIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
            </IconButton>
          )}
        </Box>

        {/* Current project info bar */}
        {currentProject && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 1, sm: 2 }, 
            mt: { xs: 1.5, sm: 2 },
            flexWrap: 'wrap',
          }}>
            {/* Stats summary chips */}
            <Chip
              icon={<TheaterComedyIcon sx={{ fontSize: 16 }} />}
              label={branding.tokens.labels.rolesStatLabel
                .replace('{total}', String(stats.totalRoles))
                .replace('{open}', String(stats.openRoles))}
              size="small"
              sx={{ bgcolor: 'rgba(244,143,177,0.15)', color: '#f48fb1', border: '1px solid rgba(244,143,177,0.3)', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
            />
            <Chip
              icon={<RecentActorsIcon sx={{ fontSize: 16 }} />}
              label={branding.tokens.labels.candidatesStatLabel.replace('{count}', String(stats.totalCandidates))}
              size="small"
              sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
            />
            <Chip
              icon={<CalendarIcon sx={{ fontSize: 16 }} />}
              label={branding.tokens.labels.upcomingStatLabel.replace('{count}', String(stats.upcomingSchedules))}
              size="small"
              sx={{ bgcolor: 'rgba(156,39,176,0.15)', color: '#ce93d8', border: '1px solid rgba(156,39,176,0.3)', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
            />
            {permissionsLoading && (
              <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.5)', ml: 1 }} />
            )}
            <Box sx={{ flex: 1 }} />
            {/* Panel controls: fullscreen toggle + close */}
            {!isStandalone && onToggleFullscreen && (
              <IconButton
                size="small"
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? branding.tokens.labels.exitFullscreenLabel : branding.tokens.labels.enterFullscreenLabel}
                title={isFullscreen ? branding.tokens.labels.exitFullscreenLabel : branding.tokens.labels.enterFullscreenLabel}
                sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#00d4ff', bgcolor: 'rgba(0,212,255,0.1)' } }}
              >
                {isFullscreen ? <CloseIcon sx={{ fontSize: 18 }} /> : <DescriptionIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            )}
            {!isStandalone && onClose && (
              <IconButton
                size="small"
                onClick={onClose}
                aria-label={branding.tokens.labels.closePanelLabel}
                title={branding.tokens.labels.closePanelLabel}
                sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#ff4444', bgcolor: 'rgba(255,68,68,0.1)' } }}
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>
        )}
      </Box>

      {/* Tabs */}
      <Box 
        role="navigation"
        aria-label={`${branding.appName} navigasjon`}
        sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', bgcolor: '#1c2128', flexShrink: 0 }}
      >
        <Tabs
          value={activeTab}
          onChange={(_: SyntheticEvent, v: number) => navigateToTab(v)}
          aria-label={`${branding.appName} faner`}
          variant="scrollable"
          scrollButtons={isMobile ? true : 'auto'}
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              minHeight: isDesktop ? 64 : isTablet ? 56 : 44,
              minWidth: isDesktop ? 120 : isTablet ? 80 : 'auto',
              fontSize: isDesktop ? '18px' : isTablet ? '14px' : '12px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.87)',
              padding: isDesktop ? '16px 20px' : isTablet ? '12px 16px' : '8px 10px',
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
              minWidth: isMobile ? 36 : 44,
              minHeight: isMobile ? 36 : 44,
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
                fontSize: isMobile ? '1.5rem' : '1.75rem',
              },
            },
            '& .MuiTabs-flexContainer': {
              gap: isMobile ? '2px' : '4px',
            },
          }}
        >
          {tabConfig.map((config, index) => {
            const IconComponent = config.icon;
            const isSelected = activeTab === index;
            const tabLabels = [
              branding.tokens.labels.dashboard,
              branding.tokens.labels.roles,
              branding.tokens.labels.candidates,
              branding.tokens.labels.auditions,
              branding.tokens.labels.team,
              branding.tokens.labels.locations,
              branding.tokens.labels.equipment,
              branding.tokens.labels.schedule,
              profession ? getTerm('shotList') : branding.tokens.labels.shotList,
              branding.tokens.labels.storyArcStudio,
              branding.tokens.labels.sharing,
              'Live Set',
            ];
            const tabIds = [
              'tab-oversikt',
              'tab-roller',
              'tab-kandidater',
              'tab-auditions',
              'tab-team',
              'tab-lokasjoner',
              'tab-rekvisitter',
              'tab-produksjonsplan',
              'tab-shot-lists',
              'tab-story-arc-studio',
              'tab-deling',
              'tab-live-set',
            ];
            const tabPanelIds = [
              'tabpanel-oversikt',
              'tabpanel-roller',
              'tabpanel-kandidater',
              'tabpanel-auditions',
              'tabpanel-team',
              'tabpanel-lokasjoner',
              'tabpanel-rekvisitter',
              'tabpanel-produksjonsplan',
              'tabpanel-shot-lists',
              'tabpanel-story-arc-studio',
              'tabpanel-deling',
              'tabpanel-live-set',
            ];
            
            return (
              <Tab
                key={index}
                icon={
                  <Box
                    sx={{
                      width: { xs: 18, sm: 20, md: 24 },
                      height: { xs: 18, sm: 20, md: 24 },
                      borderRadius: 1,
                      bgcolor: isSelected ? `${config.color}20` : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <IconComponent sx={{ fontSize: { xs: 16, sm: 18, md: 22 }, color: isSelected ? config.color : 'rgba(255,255,255,0.7)' }} />
                  </Box>
                }
                iconPosition="start"
                label={isMobile ? undefined : tabLabels[index]}
                aria-label={`${tabLabels[index]} fane`}
                id={tabIds[index]}
                aria-controls={tabPanelIds[index]}
                sx={{
                  bgcolor: isSelected ? `${config.color}15` : 'transparent',
                  border: isSelected ? `1px solid ${config.color}30` : '1px solid transparent',
                  borderRadius: 1,
                  mx: { xs: 0.25, sm: 0.5 },
                  mb: { xs: 0.5, sm: 1 },
                  mt: { xs: 0.5, sm: 1 },
                  minHeight: isDesktop ? 64 : isTablet ? 56 : 40,
                  minWidth: isMobile ? 40 : undefined,
                  px: isMobile ? 1.5 : undefined,
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
            project={currentProject}
            roles={roles}
            candidates={allCandidates}
            schedules={schedules}
            onNavigateToTab={navigateToTab}
            onCreateRole={handleCreateRole}
            onCreateCandidate={handleCreateCandidate}
            onCreateSchedule={handleCreateSchedule}
            onOpenSharing={openSharingDialog}
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

        <TabPanel value={activeTab} index={1}>
          <RoleManagementPanel
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

        <TabPanel value={activeTab} index={2}>
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
                          {candidate.contactInfo?.email && (
                            <Tooltip title={`${branding.tokens.labels.emailTooltipPrefix}${candidate.contactInfo.email}`}>
                              <IconButton
                                size="small"
                                onClick={() => window.open(`mailto:${candidate.contactInfo.email}`, '_blank')}
                                sx={{
                                  color: '#8ce6ff',
                                  p: { xs: 0.35, sm: 0.4, md: 0.45, lg: 0.5, xl: 0.55 },
                                }}
                              >
                                <EmailIcon sx={{ fontSize: { xs: 13, sm: 14, md: 15, lg: 15, xl: 16 } }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {candidate.contactInfo?.phone && (
                            <Tooltip title={`${branding.tokens.labels.callTooltipPrefix}${candidate.contactInfo.phone}`}>
                              <IconButton
                                size="small"
                                onClick={() => window.open(`tel:${candidate.contactInfo.phone}`, '_blank')}
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
            {currentProject && (
              <>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <OffersContractsPanel
                  projectId={currentProject.id}
                  candidates={currentProject.candidates}
                  roles={currentProject.roles}
                  onCandidateStatusChange={async (candidateId, status) => {
                    const candidate = currentProject.candidates.find(c => c.id === candidateId);
                    if (candidate) {
                      await castingService.saveCandidate(currentProject.id, { ...candidate, status: status as Candidate['status'] });
                      await loadProjects();
                    }
                  }}
                />
              </>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <AuditionSchedulePanel
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
                projectId={currentProject.id}
                onUpdate={async () => {
                  const updated = await castingService.getProject(currentProject.id);
                  if (updated) setCurrentProject(updated);
                }}
                profession={profession}
                onOpenTechnicalTeamDashboard={handleOpenTechnicalTeamDashboard}
                productionDays={currentProject.productionDays || []}
                scenes={currentProject.sceneBreakdowns || []}
              />
            </Box>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={5}>
          {!currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : !permissions.canManageLocations ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noAccessLocations}
              </Typography>
            </Box>
          ) : (
            <LocationManagementPanel
              projectId={currentProject.id}
              onUpdate={async () => {
                const updated = await castingService.getProject(currentProject.id);
                if (updated) setCurrentProject(updated);
              }}
            />
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={6}>
          {!currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : !permissions.canEditProduction ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noAccessEquipment}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <EquipmentManagementPanel
                projectId={currentProject.id}
                onUpdate={async () => {
                  const updated = await castingService.getProject(currentProject.id);
                  if (updated) setCurrentProject(updated);
                }}
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

        <TabPanel value={activeTab} index={7}>
          {!currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noProjectSelected}
              </Typography>
            </Box>
          ) : !permissions.canEditProduction ? (
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
                  <ProductionCalendarPanel projectId={currentProject.id} />
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                  <ProductionDayView
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

        <TabPanel value={activeTab} index={SHOT_LIST_TAB_INDEX}>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                    <ShotListIcon sx={{ color: '#fff', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
                      Shot list
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.78)' }}>
                      Role Room planlegging og progresjon
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
              <CastingShotListPanel
                projectId={currentProject.id}
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
        </TabPanel>

        <TabPanel value={activeTab} index={9}>
          {storyArcView === 'main' ? (
            <Box sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
              {/* Story Arc Studio Header */}
              <Box sx={{ mb: { xs: 3, sm: 4 }, textAlign: 'center' }}>
                <Typography variant="h5" sx={{ 
                  fontWeight: 700, 
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  mb: 1,
                }}>
                  <StoryArcIcon sx={{ color: '#ec4899', fontSize: 32 }} />
                  {branding.tokens.labels.storyArcStudio}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  {branding.tokens.labels.storyArcTagline}
                </Typography>
              </Box>

              {/* Two Cards Grid */}
              <Box
                sx={{
                  maxWidth: { xs: '100%', sm: 900 },
                  mx: 'auto',
                  px: { xs: 0, sm: 1 },
                }}
              >
              <Grid
                container
                rowSpacing={{ xs: 2.5, sm: 3 }}
                columnSpacing={{ xs: 2.5, sm: 4, md: 5 }}
                justifyContent="center"
              >
                {/* Story Logic Card */}
                <Grid size={{ xs: 12, sm: 6, md: 5 }} sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Card
                    sx={{
                      width: '100%',
                      maxWidth: { xs: 420, sm: 360, md: 380 },
                      bgcolor: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: 3,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)',
                        borderColor: '#8b5cf6',
                      },
                    }}
                    onClick={() => {
                      startTransition(() => setStoryArcView('story-logic'));
                    }}
                  >
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Box sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        bgcolor: 'rgba(139, 92, 246, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}>
                        <StoryLogicIcon sx={{ fontSize: 40, color: '#8b5cf6' }} />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff', mb: 1 }}>
                        {branding.tokens.labels.storyArcLogicTitle}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 2 }}>
                        {branding.tokens.labels.storyArcLogicSubtitle}
                      </Typography>
                      <Chip 
                        label={branding.tokens.labels.storyLogicChip} 
                        size="small" 
                        sx={{ 
                          bgcolor: 'rgba(139, 92, 246, 0.2)', 
                          color: '#8b5cf6',
                          fontSize: '0.75rem',
                        }} 
                      />
                    </CardContent>
                  </Card>
                </Grid>

                {/* Story Writer Card */}
                <Grid size={{ xs: 12, sm: 6, md: 5 }} sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Card
                    sx={{
                      width: '100%',
                      maxWidth: { xs: 420, sm: 360, md: 380 },
                      bgcolor: 'rgba(236, 72, 153, 0.1)',
                      border: '1px solid rgba(236, 72, 153, 0.3)',
                      borderRadius: 3,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 32px rgba(236, 72, 153, 0.3)',
                        borderColor: '#ec4899',
                      },
                    }}
                    onClick={() => {
                      startTransition(() => setStoryArcView('story-writer'));
                    }}
                  >
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Box sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        bgcolor: 'rgba(236, 72, 153, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}>
                        <StoryWriterIcon sx={{ fontSize: 40, color: '#ec4899' }} />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff', mb: 1 }}>
                        {branding.tokens.labels.storyWriterTitle}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 2 }}>
                        {branding.tokens.labels.storyWriterSubtitle}
                      </Typography>
                      <Chip 
                        label={branding.tokens.labels.storyWriterChip} 
                        size="small" 
                        sx={{ 
                          bgcolor: 'rgba(236, 72, 153, 0.2)', 
                          color: '#ec4899',
                          fontSize: '0.75rem',
                        }} 
                      />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              </Box>
            </Box>
          ) : storyArcView === 'story-logic' ? (
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
                  <StoryLogicPanel projectId={currentProject?.id} onSave={handleStoryLogicSave} />
                </Suspense>
              </Box>
            </Box>
          ) : (
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
                <StoryWriterIcon sx={{ color: '#ec4899' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
                  {branding.tokens.labels.storyWriterHeader}
                </Typography>
              </Box>
              {/* Story Writer Content - ManuscriptPanel */}
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <ErrorBoundary>
                  <Suspense fallback={
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <CircularProgress />
                    </Box>
                  }>
                    <ManuscriptPanel
                      projectId={currentProject?.id}
                      onManuscriptChange={handleManuscriptChange}
                      storyLogicData={storyLogicData}
                    />
                  </Suspense>
                </ErrorBoundary>
              </Box>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={10}>
          {!permissions.canApprove && currentProject ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography variant="body1" sx={{ fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem' }}>
                {branding.tokens.labels.noAccessSharing}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                    <_ShareIcon sx={{ color: '#fff', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
                      Deling
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.78)' }}>
                      Tilgang, lenker og samarbeid
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
              <SharingPanel
                project={currentProject}
                onOpenSharingDialog={openSharingDialog}
              />
            </Box>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={11}>
          <LiveSetMode
            projectId={currentProject?.id ?? ''}
            projectName={currentProject?.title ?? undefined}
            shootingDay={new Date().toLocaleDateString('no-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            onExit={() => navigateToTab(0)}
          />
        </TabPanel>
        </Suspense>
        </ErrorBoundary>
        )}
      </Box>


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
        onClose={() => {
          setCandidateDialogOpen(false);
          setSelectedCandidate(null);
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
            onClick={() => {
              setCandidateDialogOpen(false);
              setSelectedCandidate(null);
            }}
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
                value={selectedCandidate.contactInfo.email || ''}
                onChange={(e) => setSelectedCandidate({
                  ...selectedCandidate,
                  contactInfo: { ...selectedCandidate.contactInfo, email: e.target.value },
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
                value={selectedCandidate.contactInfo.phone || ''}
                onChange={(e) => setSelectedCandidate({
                  ...selectedCandidate,
                  contactInfo: { ...selectedCandidate.contactInfo, phone: e.target.value },
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
                value={selectedCandidate.contactInfo.address || ''}
                onChange={(e) => setSelectedCandidate({
                  ...selectedCandidate,
                  contactInfo: { ...selectedCandidate.contactInfo, address: e.target.value },
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
              
              <FormControl fullWidth size="small">
                <InputLabel sx={inputLabelStyles}>
                  {branding.tokens.labels.assignedRolesLabel}
                </InputLabel>
                <Select
                  multiple
                  value={selectedCandidate.assignedRoles}
                  MenuProps={selectMenuProps}
                  onChange={(e) => setSelectedCandidate({
                    ...selectedCandidate,
                    assignedRoles: e.target.value as string[],
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
                  value={selectedCandidate.status}
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
            onClick={() => {
              setCandidateDialogOpen(false);
              setSelectedCandidate(null);
            }}
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
              onClick={() => { handleDeleteCandidate(selectedCandidate.id); setCandidateDialogOpen(false); setSelectedCandidate(null); }}
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

      {/* Project Selector Dialog */}
      <Dialog
        open={projectSelectorOpen}
        onClose={() => setProjectSelectorOpen(false)}
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
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            py: 2,
            px: 3,
            bgcolor: '#161b22',
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
            {branding.tokens.labels.allProjectsLabel.replace('{count}', String(projects.length))}
          </Typography>
          <IconButton
            onClick={() => setProjectSelectorOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.87)' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
            {[...projects]
              .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
              .map((project) => {
                const isActive = currentProject?.id === project.id;
                const candidateCount = project.candidatesCount ?? project.candidates?.length ?? 0;
                const updatedDate = project.updatedAt 
                  ? new Date(project.updatedAt).toLocaleDateString('nb-NO', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : branding.tokens.labels.unknownLabel;
                return (
                  <Box
                    key={project.id}
                    onClick={async () => {
                      // Load full project data when user selects it
                      const fullProject = await castingService.getProject(project.id);
                      if (fullProject) {
                        setCurrentProject(fullProject);
                      } else {
                        setCurrentProject(project);
                      }
                      setProjectSelectorOpen(false);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 3,
                      py: 2,
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      bgcolor: isActive ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                      '&:hover': {
                        bgcolor: isActive ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255,255,255,0.05)',
                      },
                    }}
                  >
                    <Box sx={{ 
                      width: 10, 
                      height: 10, 
                      borderRadius: '50%', 
                      bgcolor: isActive ? '#00d4ff' : 'rgba(255,255,255,0.3)',
                      flexShrink: 0,
                    }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography 
                        sx={{ 
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? '#fff' : 'rgba(255,255,255,0.9)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {project.name}
                      </Typography>
                      <Typography 
                        sx={{ 
                          fontSize: '0.75rem',
                          color: 'rgba(255,255,255,0.87)',
                        }}
                      >
                        {branding.tokens.labels.lastUpdatedLabel} {updatedDate}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={branding.tokens.labels.candidatesCountLabel.replace('{count}', String(candidateCount))}
                      sx={{
                        height: 24,
                        bgcolor: 'rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.87)',
                        fontSize: '0.7rem',
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          setProjectToEdit(project);
                          openProjectCreationModal();
                          setProjectSelectorOpen(false);
                        }}
                        sx={{
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#00d4ff' },
                        }}
                      >
                        <EditIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={branding.tokens.labels.deleteProjectAriaLabel?.replace('{project}', project.name) || 'Delete project'}
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          setConfirmDeleteContext({ type: 'project', id: project.id, name: project.name });
                          setConfirmDeleteOpen(true);
                        }}
                        sx={{
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#ff4444' },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Sharing Dialog */}
      {currentProject && sharingDialogOpen && (
        <Suspense fallback={null}>
          <CastingSharingDialog
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

      {/* Project Creation Modal */}
      <Dialog
        open={projectCreationModalOpen}
        onClose={() => setProjectCreationModalOpen(false)}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, minWidth: 0 }}>
            <Typography
              component="span"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
                color: '#fff',
              }}
            >
              {projectToEdit ? branding.tokens.labels.editProjectTitle : branding.tokens.labels.newCastingProjectTitle}
            </Typography>
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
          {projectCreationModalOpen && (
            <QueryClientProvider client={queryClient}>
              <MemoryRouter>
                <ProjectProvider>
                  <Suspense fallback={<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.87)' }}>{branding.tokens.labels.loadingLabel}</Box>}>
                    <NewProjectCreationModal
                      profession={profession || 'photographer'}
                      userId={user?.id}
                      isCastingPlanner={true}
                      getTerm={getTerm}
                      initialData={projectToEdit || undefined}
                      onProjectIdChange={handleProjectIdChange}
                      onClose={() => {
                        setProjectCreationModalOpen(false);
                        setProjectToEdit(null);
                        setCurrentProjectId(null);
                      }}
                      onProjectCreated={async (projectData) => {
                        setProjectCreationModalOpen(false);
                        setProjectToEdit(null);
                        
                        // Use the project data returned from backend directly
                        // The ID should always be set (generated when modal opens)
                        if (projectData?.id) {
                          // Ensure crew is initialized as an array if missing
                          const projectWithCrew = {
                            ...projectData,
                            id: projectData.id, // Explicitly set ID to ensure it's used
                            crew: projectData.crew || [],
                          } as CastingProject;
                          
                          // Save to database
                          try {
                            await castingService.saveProject(projectWithCrew);
                          } catch (error) {
                            console.error('Failed to save project to database:', error);
                          }
                          
                          // Invalidate query cache to force refresh
                          queryClient.invalidateQueries({ queryKey: ['/api/casting/projects'] });
                          
                          // Set the newly created project as current immediately
                          // This ensures all child components (roles, candidates, locations, shots, etc.) use the same project ID
                          setCurrentProject(projectWithCrew);
                          
                          // Reload projects list in the background to update the list
                          try {
                            const loadedProjects = await castingService.getProjects();
                            setProjects(loadedProjects);
                            // Ensure the new project is still set as current (in case reload changed something)
                            const foundProject = loadedProjects.find(p => p.id === projectData.id);
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
                              const exists = prev.some(p => p.id === projectData.id);
                              if (exists) {
                                return prev.map(p => {
                                  if (p.id === projectData.id) {
                                    return projectWithCrew;
                                  }
                                  return p;
                                });
                              } else {
                                return [projectWithCrew, ...prev];
                              }
                            });
                          }
                        } else {
                          // Fallback: reload projects if no project data
                          try {
                            const loadedProjects = await castingService.getProjects();
                            setProjects(loadedProjects);
                            if (loadedProjects.length > 0) {
                              setCurrentProject(loadedProjects[0]);
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
              bgcolor: confirmDeleteContext?.id === '__reset_demo__' ? 'rgba(147, 51, 234, 0.15)' : 'rgba(255, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {confirmDeleteContext?.id === '__reset_demo__' ? (
              <RefreshIcon sx={{ fontSize: 28, color: '#9333ea' }} />
            ) : (
              <DeleteIcon sx={{ fontSize: 28, color: '#ff4444' }} />
            )}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
            {confirmDeleteContext?.id === '__reset_demo__' 
              ? branding.tokens.labels.resetDemoDataLabel
              : confirmDeleteContext?.type === 'project' 
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
            {confirmDeleteContext?.id === '__reset_demo__'
              ? branding.tokens.labels.confirmResetDemoProjects
              : confirmDeleteContext?.name 
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
              if (confirmDeleteContext?.id === '__reset_demo__') {
                resetMockCastingData();
                await loadProjects();
                toast.showSuccess(branding.tokens.labels.demoDataResetSuccess);
                setConfirmDeleteOpen(false);
                setConfirmDeleteContext(null);
              } else {
                executeConfirmedDelete();
              }
            }}
            variant="contained"
            startIcon={confirmDeleteContext?.id === '__reset_demo__' ? <RefreshIcon /> : <DeleteIcon />}
            sx={{
              bgcolor: confirmDeleteContext?.id === '__reset_demo__' ? '#9333ea' : '#ff4444',
              color: '#fff',
              textTransform: 'none',
              px: 3,
              py: 1,
              fontWeight: 600,
              '&:hover': {
                bgcolor: confirmDeleteContext?.id === '__reset_demo__' ? '#6d28d9' : '#ff3333',
              },
            }}
          >
            {confirmDeleteContext?.id === '__reset_demo__' 
              ? branding.tokens.labels.resetDemoDataLabel
              : branding.tokens.labels.deleteProjectLabel}
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
                  const remainingProjects = await castingService.getProjects();
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

      {/* Enhanced Quick Navigation SpeedDial FAB - 6-tier responsive optimized */}
      <SpeedDial
        ariaLabel={branding.tokens.labels.fabLabel}
        direction="up"
        sx={{
          position: 'fixed',
          bottom: { 
            xs: 'calc(80px + max(16px, env(safe-area-inset-bottom, 16px)))', 
            sm: 24, 
            md: 32, 
            lg: 40,
            xl: 48,
          },
          right: { 
            xs: 16, 
            sm: 24, 
            md: 32, 
            lg: 40,
            xl: 48,
          },
          zIndex: Z_INDEX.fab,
          '& .MuiSpeedDial-fab': {
            width: { xs: 64, sm: 64, md: 68, lg: 72, xl: 80 },
            height: { xs: 64, sm: 64, md: 68, lg: 72, xl: 80 },
            minWidth: { xs: 64, sm: 64, md: 68, lg: 72, xl: 80 },
            minHeight: { xs: 64, sm: 64, md: 68, lg: 72, xl: 80 },
            background: professionConfig
              ? `linear-gradient(135deg, ${professionConfig.color} 0%, ${professionConfig.color}cc 100%)`
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            boxShadow: professionConfig
              ? `0 8px 32px ${professionConfig.color}60, 0 0 0 4px ${professionConfig.color}20`
              : '0 8px 32px rgba(16, 185, 129, 0.5), 0 0 0 4px rgba(16, 185, 129, 0.15)',
            border: '3px solid rgba(255, 255, 255, 0.2)',
            '&:hover, &:active': {
              background: professionConfig
                ? `linear-gradient(135deg, ${professionConfig.color}dd 0%, ${professionConfig.color}aa 100%)`
                : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              boxShadow: professionConfig
                ? `0 12px 40px ${professionConfig.color}70, 0 0 0 6px ${professionConfig.color}30`
                : '0 12px 40px rgba(16, 185, 129, 0.6), 0 0 0 6px rgba(16, 185, 129, 0.25)',
              transform: 'scale(1.08)',
            },
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '& .MuiSpeedDialIcon-icon': {
              fontSize: { xs: '1.75rem', sm: '1.75rem', md: '2rem', lg: '2rem', xl: '2.25rem' },
              color: '#fff',
            },
          },
          '& .MuiSpeedDial-actions': {
            paddingBottom: { xs: '16px', sm: '14px', md: '12px' },
            gap: { xs: '14px', sm: '12px', md: '10px' },
          },
        }}
        icon={
          fabIconKey === 'speedDial'
            ? fabIcon
            : <SpeedDialIcon icon={fabIcon} openIcon={<CloseIcon />} />
        }
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        open={speedDialOpen}
      >
        {quickNavigationLinks.map((link, index) => {
          const IconComponent = link.icon;
          const hasBadge = link.badge !== null && link.badge > 0;
          
          return (
            <SpeedDialAction
              key={link.title}
              icon={
                <Badge 
                  badgeContent={hasBadge ? link.badge : 0} 
                  color="error"
                  sx={{
                    '& .MuiBadge-badge': {
                      bgcolor: '#fff',
                      color: link.color,
                      fontWeight: 'bold',
                      fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                      minWidth: { xs: '20px', sm: '22px', md: '24px', lg: '26px', xl: '28px' },
                      height: { xs: '20px', sm: '22px', md: '24px', lg: '26px', xl: '28px' },
                      padding: '0 5px',
                      border: `2px solid ${link.color}`,
                    },
                  }}
                >
                  <IconComponent sx={{ fontSize: { xs: '1.5rem', sm: '1.5rem', md: '1.75rem', lg: '2rem', xl: '2.25rem' }, color: '#fff' }} />
                </Badge>
              }
              tooltipTitle={link.title}
              tooltipOpen={speedDialOpen && (isDesktop || isTablet)}
              tooltipPlacement="left"
              onClick={() => {
                if (link.action) {
                  link.action();
                } else if (link.tabIndex >= 0) {
                  navigateToTab(link.tabIndex);
                }
                setSpeedDialOpen(false);
              }}
              sx={{
                color: '#fff',
                bgcolor: link.color,
                border: `3px solid rgba(255, 255, 255, 0.25)`,
                width: { xs: 56, sm: 56, md: 60, lg: 64, xl: 72 },
                height: { xs: 56, sm: 56, md: 60, lg: 64, xl: 72 },
                minWidth: { xs: 56, sm: 56, md: 60, lg: 64, xl: 72 },
                minHeight: { xs: 56, sm: 56, md: 60, lg: 64, xl: 72 },
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: `0 4px 20px ${link.color}50`,
                '&:hover, &:active': {
                  bgcolor: link.color,
                  filter: 'brightness(1.15)',
                  transform: 'scale(1.1)',
                  boxShadow: `0 8px 28px ${link.color}70`,
                },
                transition: `all 0.2s cubic-bezier(0.4, 0, 0.2, 1) ${index * 30}ms`,
                '& .MuiSpeedDialAction-staticTooltip': {
                  bgcolor: '#1c2128',
                  border: `2px solid ${link.color}60`,
                  borderRadius: '10px',
                  padding: { xs: '10px 14px', sm: '10px 14px', md: '12px 16px', lg: '12px 16px', xl: '14px 18px' },
                  maxWidth: { xs: '140px', sm: '160px', md: '180px', lg: '200px', xl: '240px' },
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                },
                '& .MuiSpeedDialAction-staticTooltipLabel': {
                  bgcolor: 'transparent',
                  color: '#fff',
                  fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.9rem', lg: '0.95rem', xl: '1rem' },
                  fontWeight: 600,
                  padding: 0,
                  whiteSpace: 'nowrap',
                },
              }}
            />
          );
        })}
      </SpeedDial>
    </Box>

      {adminDashboardOpen && (
        <Suspense fallback={null}>
          <AdminDashboard
            open={adminDashboardOpen}
            onClose={() => setAdminDashboardOpen(false)}
            projectName={currentProject?.name}
          />
        </Suspense>
      )}

      {loginDialogOpen && (
        <Suspense fallback={null}>
          <LoginDialog
            open={loginDialogOpen}
            onClose={() => setLoginDialogOpen(false)}
            onLoginSuccess={(user) => setAdminUser(user)}
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
