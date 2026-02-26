import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense, memo, type FC, type MouseEvent, type ReactElement, type ReactNode, type SyntheticEvent } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { Z_INDEX } from '../config/zIndex';
import { useToast } from './ToastStack';
import { useBrandingSettings } from '../hooks/useBrandingSettings.ts';
import { ContextualNudgeBanner } from './ContextualNudgeBanner';
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

// Custom SVG icons for consistent visual language
import {
  DashboardCustomIcon as DashboardIcon,
  RolesIcon as TheaterComedyIcon,
  CandidatesIcon as RecentActorsIcon,
  AuditionsIcon as InterpreterModeIcon,
  TeamIcon as GroupsIcon,
  LocationsIcon as LocationIcon,
  EquipmentIcon as PropIcon,
  EquipmentIcon,
  CalendarCustomIcon as CalendarIcon,
  ShotListIcon,
  StoryArcIcon,
  ShareCustomIcon as ShareIcon,
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
  LearningTabIcon,
} from './icons';

import { CastingProject, Role, Candidate, Schedule } from '../models/casting';
import { RichTextEditor } from './RichTextEditor';
import type { StoryLogicState } from '../services/storyLogicService';
import { storyLogicService } from '../services/storyLogicService';

// Custom icon: Person holding camera with list/clipboard
import { castingService } from '../services/castingService';
import { resetMockCastingData } from '../data/mockCastingData';
import { sceneComposerService } from '../services/sceneComposerService';
import { consentService } from '../services/consentService';
import { castingAuthService } from '../services/castingAuthService';
import { Tutorial } from '../services/tutorialService';

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
const AuditionSchedulePanel = lazy(() => import('./AuditionSchedulePanel').then(m => ({ default: m.AuditionSchedulePanel })));
const SharingPanel = lazy(() => import('./SharingPanel').then(m => ({ default: m.SharingPanel })));
const LiveSetMode = lazy(() => import('./LiveSetMode').then(m => ({ default: m.LiveSetMode })));
const RoleRoomIntelligence = lazy(() => import('./RoleRoomIntelligence'));

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
const NewProjectCreationModal = lazy(() => import('./Planning/NewProjectCreationModal'));
const ProfessionOnboardingDialog = lazy(() => import('./ProfessionOnboardingDialog').then(m => ({ default: m.ProfessionOnboardingDialog })));

import { useProfessionOnboarding, ProfessionType } from './ProfessionOnboardingDialog';
import { useAuth } from '@/hooks/useAuth';
import authSessionService from '../services/authSessionService';
import settingsService from '../services/settingsService';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

interface CastingPlannerPanelProps {
  onClose?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isStandalone?: boolean;
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

export function CastingPlannerPanel({ onClose, isFullscreen = false, onToggleFullscreen, isStandalone = false }: CastingPlannerPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
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
    '& .MuiInputLabel-root': { 
      color: 'rgba(255,255,255,0.87)',
      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
    },
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
      minHeight: { xs: 40, sm: 44, md: 46, lg: 52, xl: 60 },
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '& input': {
        fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
        py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
      },
      '& textarea': {
        fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
        py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
      },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
      '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
    },
  }), []);
  
  // Shared InputLabel styling for Select components - memoized
  const inputLabelStyles = useMemo(() => ({
    color: 'rgba(255,255,255,0.87)',
    fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
  }), []);
  
  // Shared MenuProps for Select components - memoized with z-index tokens
  const selectMenuProps = useMemo(() => ({
    container: document.body,
    sx: {
      zIndex: Z_INDEX.dialogSelect,
    },
    PaperProps: {
      sx: {
        bgcolor: '#1c2128',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        mt: 0.5,
        maxHeight: { xs: 250, sm: 300, md: 280, lg: 320, xl: 400 },
        '& .MuiMenuItem-root': {
          fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
          minHeight: TOUCH_TARGET_SIZE,
          py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
          '&:hover': {
            bgcolor: 'rgba(139,92,246,0.15)',
          },
          '&.Mui-selected': {
            bgcolor: 'rgba(139,92,246,0.25)',
            '&:hover': {
              bgcolor: 'rgba(139,92,246,0.35)',
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
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const debouncedCandidateSearch = useDebounce(candidateSearchQuery, 250);
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<string>('all');
  const [scheduleDateFilter, setScheduleDateFilter] = useState<string>('');
  const [scheduleCandidateFilter, setScheduleCandidateFilter] = useState<string>('all');
  const [scheduleRoleFilter, setScheduleRoleFilter] = useState<string>('all');
  const [candidateViewMode, setCandidateViewMode] = useState<'list' | 'kanban'>('list');
  const [draggedCandidate, setDraggedCandidate] = useState<Candidate | null>(null);
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
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(true); // Open by default to let user choose project
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  
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
    { color: '#a855f7', icon: LearningTabIcon },
  ], [professionConfig?.color]);

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
      action: () => setProjectCreationModalOpen(true),
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
  ], [branding.tokens.labels, profession, professionConfig, tabConfig, currentProject]);

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
    } catch (error) {
      // Silently handle API failure
    }
    try {
      const cached = await settingsService.getSetting<string>('virtualStudio_castingProfession', { userId: getUserId() });
      if (cached && (cached === 'photographer' || cached === 'videographer')) {
        return cached;
      }
    } catch (error) {
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
    } catch (error) {
      // Silently handle API save failure
    }
    try {
      await settingsService.setSetting('virtualStudio_castingProfession', prof, { userId: getUserId() });
    } catch (error) {
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
        setProfessionDialogOpen(true);
      }
    };
    initProfession();
  }, [adminUser, loadProfession]);

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
            } catch (e) {
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
  }, [currentProject, adminUser]);

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
    setRoleDialogOpen(true);
  }, [currentProject, toast]);

  const handleSaveRole = useCallback(async () => {
    if (!currentProject || !selectedRole) return;
    
    if (!selectedRole.name.trim()) {
      toast.showWarning(branding.tokens.labels.roleNameRequired);
      return;
    }
    
    try {
      await castingService.saveRole(currentProject.id, selectedRole);
      await loadProjects();
      setRoleDialogOpen(false);
      setSelectedRole(null);
    } catch (error) {
      console.error('Error saving role:', error);
      toast.showError(branding.tokens.labels.roleSaveError);
    }
  }, [currentProject, selectedRole, toast, loadProjects]);

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
      videos: [],
      auditionNotes: '',
      status: 'pending',
      assignedRoles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSelectedCandidate(newCandidate);
    setCandidateDialogOpen(true);
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
          setConsentContractDialogOpen(true);
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
    setScheduleDialogOpen(true);
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
    const matchesSearch = !debouncedCandidateSearch || 
      c.name.toLowerCase().includes(debouncedCandidateSearch.toLowerCase()) ||
      c.contactInfo?.email?.toLowerCase().includes(debouncedCandidateSearch.toLowerCase()) ||
      c.contactInfo?.phone?.includes(debouncedCandidateSearch);
    const matchesStatus = candidateStatusFilter === 'all' || c.status === candidateStatusFilter;
    return matchesSearch && matchesStatus;
  }), [allCandidates, debouncedCandidateSearch, candidateStatusFilter]);
  
  // Memoized filtered schedules
  const schedules = useMemo(() => allSchedules.filter(s => {
    const matchesDate = !scheduleDateFilter || s.date === scheduleDateFilter;
    const matchesCandidate = scheduleCandidateFilter === 'all' || s.candidateId === scheduleCandidateFilter;
    const matchesRole = scheduleRoleFilter === 'all' || s.roleId === scheduleRoleFilter;
    return matchesDate && matchesCandidate && matchesRole;
  }), [allSchedules, scheduleDateFilter, scheduleCandidateFilter, scheduleRoleFilter]);

  const stats = useMemo(() => ({
    totalRoles: roles.length,
    openRoles: roles.filter(r => r.status === 'open' || r.status === 'casting').length,
    totalCandidates: candidates.length,
    upcomingSchedules: schedules.filter(s => s.status === 'scheduled' && new Date(s.date) >= new Date()).length,
  }), [roles, candidates, schedules]);

  return (
    <>
      <Suspense fallback={null}>
        <CastingProfessionDialog
          open={professionDialogOpen}
          onSelect={handleProfessionSelect}
        />
      </Suspense>
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
                    setProjectCreationModalOpen(true);
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
              setProjectCreationModalOpen(true);
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
            onClick={() => setShowTutorial(true)}
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
                onClick={() => setProfessionDialogOpen(true)}
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
                    onClick={() => setShowTutorialEditor(true)}
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
                    onClick={() => setAdminDashboardOpen(true)}
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
                  triggerProfessionOnboarding();
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
              onClick={() => setLoginDialogOpen(true)}
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
          onChange={(_: SyntheticEvent, v: number) => setActiveTab(v)}
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
              'Læring',
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
              'tab-laering',
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
              'tabpanel-laering',
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
            onNavigateToTab={setActiveTab}
            onCreateRole={handleCreateRole}
            onCreateCandidate={handleCreateCandidate}
            onCreateSchedule={handleCreateSchedule}
            onOpenSharing={() => setSharingDialogOpen(true)}
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
              setCandidateDialogOpen(true);
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
              setRoleDialogOpen(true);
            }}
            onCreateRole={handleCreateRole}
            profession={profession}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Candidate filters & view mode toolbar */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <TextField
                placeholder={branding.tokens.labels.searchCandidatesPlaceholder}
                size="small"
                value={candidateSearchQuery}
                onChange={(e) => setCandidateSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <RecentActorsIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ ...textFieldStyles, flex: 1, minWidth: 180 }}
              />
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
                  onClick={() => setCandidateViewMode('list')}
                  aria-label={branding.tokens.labels.listViewLabel}
                  sx={{ color: candidateViewMode === 'list' ? '#00d4ff' : 'rgba(255,255,255,0.5)', bgcolor: candidateViewMode === 'list' ? 'rgba(0,212,255,0.15)' : 'transparent', borderRadius: 1 }}
                >
                  <ViewListIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setCandidateViewMode('kanban')}
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
                    setCandidateDialogOpen(true);
                  }}
                  onCreateCandidate={handleCreateCandidate}
                  onNavigateToTab={setActiveTab}
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
              {/* Quick contact actions for selected candidates */}
              {candidates.filter(c => c.status === 'selected' || c.status === 'shortlist').length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mr: 0.5, fontSize: '0.75rem' }}>
                    {branding.tokens.labels.quickContactLabel}
                  </Typography>
                  {candidates
                    .filter(c => c.status === 'selected' || c.status === 'shortlist')
                    .slice(0, 5)
                    .map(c => (
                      <Box key={c.id} sx={{ display: 'inline-flex', gap: 0.25 }}>
                        {c.contactInfo?.email && (
                          <Tooltip title={`${branding.tokens.labels.emailTooltipPrefix}${c.contactInfo.email}`}>
                            <IconButton
                              size="small"
                              onClick={() => window.open(`mailto:${c.contactInfo.email}`, '_blank')}
                              sx={{ color: 'rgba(255,255,255,0.5)', p: 0.5 }}
                            >
                              <EmailIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {c.contactInfo?.phone && (
                          <Tooltip title={`${branding.tokens.labels.callTooltipPrefix}${c.contactInfo.phone}`}>
                            <IconButton
                              size="small"
                              onClick={() => window.open(`tel:${c.contactInfo.phone}`, '_blank')}
                              sx={{ color: 'rgba(255,255,255,0.5)', p: 0.5 }}
                            >
                              <PhoneIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    ))}
                </Box>
              )}
            <CandidateManagementPanel
              projectId={currentProject?.id || ''}
              candidates={candidates}
              roles={roles}
              onCandidatesChange={loadProjects}
              onEditCandidate={(candidate) => {
                setSelectedCandidate(candidate);
                setCandidateDialogOpen(true);
              }}
              onCreateCandidate={handleCreateCandidate}
              profession={profession}
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
          {/* Schedule filters */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
            <TextField
              label={branding.tokens.labels.dateLabel}
              type="date"
              size="small"
              value={scheduleDateFilter}
              onChange={(e) => setScheduleDateFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ ...textFieldStyles, minWidth: 160 }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.candidateLabel}</InputLabel>
              <Select
                value={scheduleCandidateFilter}
                onChange={(e) => setScheduleCandidateFilter(e.target.value)}
                MenuProps={selectMenuProps}
                sx={{ color: '#fff', fontSize: '0.875rem', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
              >
                <MenuItem value="all">{branding.tokens.labels.allCandidatesLabel}</MenuItem>
                {allCandidates.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.roleLabel}</InputLabel>
              <Select
                value={scheduleRoleFilter}
                onChange={(e) => setScheduleRoleFilter(e.target.value)}
                MenuProps={selectMenuProps}
                sx={{ color: '#fff', fontSize: '0.875rem', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
              >
                <MenuItem value="all">{branding.tokens.labels.allRolesLabel}</MenuItem>
                {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
              </Select>
            </FormControl>
            {(scheduleDateFilter || scheduleCandidateFilter !== 'all' || scheduleRoleFilter !== 'all') && (
              <Button
                size="small"
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                onClick={() => { setScheduleDateFilter(''); setScheduleCandidateFilter('all'); setScheduleRoleFilter('all'); }}
                sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none', fontSize: '0.8rem' }}
              >
                {branding.tokens.labels.resetFiltersLabel}
              </Button>
            )}
          </Box>
          <AuditionSchedulePanel
            projectId={currentProject?.id || ''}
            schedules={schedules}
            candidates={candidates}
            roles={roles}
            availableScenes={availableScenes}
            onSchedulesChange={loadProjects}
            onEditSchedule={(schedule) => {
              setSelectedSchedule(schedule);
              setScheduleDialogOpen(true);
            }}
            onCreateSchedule={handleCreateSchedule}
            onNavigateToTab={setActiveTab}
            profession={profession}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
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
                  onClick={() => setCalendarViewMode('production')}
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
                  onClick={() => setCalendarViewMode('crew')}
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

        <TabPanel value={activeTab} index={8}>
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
            <CastingShotListPanel
              projectId={currentProject.id}
              onUpdate={async () => {
                const updated = await castingService.getProject(currentProject.id);
                if (updated) setCurrentProject(updated);
              }}
              profession={profession}
            />
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={9}>
          {storyArcView === 'main' ? (
            <Box sx={{ p: 2 }}>
              {/* Story Arc Studio Header */}
              <ContextualNudgeBanner context="story-arc" accentColor="#ec4899" />
              <Box sx={{ mb: 3, textAlign: 'center' }}>
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
              <Grid container spacing={3} justifyContent="center">
                {/* Story Logic Card */}
                <Grid size={{ xs: 12, sm: 6, md: 5 }}>
                  <Card
                    sx={{
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
                    onClick={() => setStoryArcView('story-logic')}
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
                <Grid size={{ xs: 12, sm: 6, md: 5 }}>
                  <Card
                    sx={{
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
                    onClick={() => setStoryArcView('story-writer')}
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
                  onClick={() => setStoryArcView('main')}
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
                  onClick={() => setStoryArcView('main')}
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
            <SharingPanel
              project={currentProject}
              onOpenSharingDialog={() => setSharingDialogOpen(true)}
            />
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={11}>
          <LiveSetMode
            projectId={currentProject?.id ?? ''}
            projectName={currentProject?.title ?? undefined}
            shootingDay={new Date().toLocaleDateString('no-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            onExit={() => setActiveTab(0)}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={12}>
          <RoleRoomIntelligence userId={getUserId()} />
        </TabPanel>
        </Suspense>
        </ErrorBoundary>
        )}
      </Box>


      {/* Role Dialog - Optimized */}
      <Dialog
        open={!!roleDialogOpen}
        onClose={() => { setRoleDialogOpen(false); setSelectedRole(null); }}
        maxWidth="md"
        fullWidth
        container={() => document.body}
        TransitionComponent={Grow}
        PaperProps={{ sx: { bgcolor: '#1c2128', color: '#fff', borderRadius: 2 } }}
        sx={{ zIndex: Z_INDEX.dialog, '& .MuiBackdrop-root': { bgcolor: 'rgba(0,0,0,0.8)' } }}
      >
        <DialogTitle sx={{ 
          color: '#fff', 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2,
          px: 3,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TheaterComedyIcon sx={{ color: '#00d4ff', fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {selectedRole?.id && !selectedRole.name ? branding.tokens.labels.roleDialogNewTitle : branding.tokens.labels.roleDialogEditTitle}
              </Typography>
              {selectedRole?.name && (
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  {selectedRole.name}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton onClick={() => { setRoleDialogOpen(false); setSelectedRole(null); }} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, px: 3, pb: 2 }}>
          {selectedRole && (
            <Grid container spacing={3}>
              {/* Left Column - Basic Info */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <PersonNameIcon sx={{ color: '#00d4ff', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ color: '#00d4ff', fontWeight: 600 }}>
                    {branding.tokens.labels.roleBasicsSectionLabel}
                  </Typography>
                </Box>
                <Stack spacing={2}>
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
                  <TextField
                    label={branding.tokens.labels.roleDescriptionLabel}
                    value={selectedRole.description || ''}
                    onChange={(e) => setSelectedRole({ ...selectedRole, description: e.target.value })}
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                          <NotesIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
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
                      sx={{ flex: 1, ...textFieldStyles }}
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
                      sx={{ flex: 1, ...textFieldStyles }}
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
                      sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
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
                      sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                    >
                      <MenuItem value="draft">{branding.tokens.labels.roleStatusDraft}</MenuItem>
                      <MenuItem value="open">{branding.tokens.labels.roleStatusOpen}</MenuItem>
                      <MenuItem value="casting">{branding.tokens.labels.roleStatusCasting}</MenuItem>
                      <MenuItem value="filled">{branding.tokens.labels.roleStatusFilled}</MenuItem>
                      <MenuItem value="cancelled">{branding.tokens.labels.roleStatusCancelled}</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Grid>

              {/* Right Column - Requirements */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AssignmentIcon sx={{ color: '#00d4ff', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ color: '#00d4ff', fontWeight: 600 }}>
                    {branding.tokens.labels.roleRequirementsSectionLabel}
                  </Typography>
                </Box>
                <Stack spacing={2}>
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
                  <FormControl fullWidth size="small">
                    <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.roleScenesLabel}</InputLabel>
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
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((sceneId) => (
                            <Chip key={sceneId} label={availableScenes.find(s => s.id === sceneId)?.name || sceneId} size="small" sx={{ bgcolor: 'rgba(0,212,255,0.2)', color: '#00d4ff', height: 22 }} />
                          ))}
                        </Box>
                      )}
                      sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                    >
                      {availableScenes.map((scene) => (
                        <MenuItem key={scene.id} value={scene.id}>{scene.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {currentProject && (
                    <>
                      <FormControl fullWidth size="small">
                        <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.roleCrewLabel}</InputLabel>
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
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {(selected as string[]).map((crewId) => (
                                <Chip key={crewId} label={(currentProject?.crew || []).find(c => c.id === crewId)?.name || crewId} size="small" sx={{ bgcolor: 'rgba(0,212,255,0.2)', color: '#00d4ff', height: 22 }} />
                              ))}
                            </Box>
                          )}
                          sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                        >
                          {(currentProject?.crew || []).map((crew) => (
                            <MenuItem key={crew.id} value={crew.id}>{crew.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth size="small">
                        <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.roleLocationsLabel}</InputLabel>
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
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {(selected as string[]).map((locId) => (
                                <Chip key={locId} label={(currentProject?.locations || []).find(l => l.id === locId)?.name || locId} size="small" sx={{ bgcolor: 'rgba(0,212,255,0.2)', color: '#00d4ff', height: 22 }} />
                              ))}
                            </Box>
                          )}
                          sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                        >
                          {(currentProject?.locations || []).map((loc) => (
                            <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth size="small">
                        <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.rolePropsLabel}</InputLabel>
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
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {(selected as string[]).map((propId) => (
                                <Chip key={propId} label={(currentProject?.props || []).find(p => p.id === propId)?.name || propId} size="small" sx={{ bgcolor: 'rgba(0,212,255,0.2)', color: '#00d4ff', height: 22 }} />
                              ))}
                            </Box>
                          )}
                          sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                        >
                          {(currentProject?.props || []).map((prop) => (
                            <MenuItem key={prop.id} value={prop.id}>{prop.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </>
                  )}
                </Stack>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2, gap: 1 }}>
          <Button
            onClick={() => { setRoleDialogOpen(false); setSelectedRole(null); }}
            sx={{ color: 'rgba(255,255,255,0.87)', minHeight: TOUCH_TARGET_SIZE }}
          >
            {branding.tokens.labels.cancelLabel}
          </Button>
          <Button
            onClick={handleSaveRole}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{ bgcolor: '#00d4ff', color: '#000', fontWeight: 600, minHeight: TOUCH_TARGET_SIZE, '&:hover': { bgcolor: '#00b8e6' } }}
          >
            {branding.tokens.labels.saveRoleLabel}
          </Button>
          {selectedRole?.id && selectedRole.name && (
            <Button
              onClick={() => { handleDeleteRole(selectedRole.id); setRoleDialogOpen(false); setSelectedRole(null); }}
              startIcon={<DeleteIcon />}
              sx={{ color: '#ff4444', minHeight: TOUCH_TARGET_SIZE, '&:hover': { bgcolor: 'rgba(255,68,68,0.1)' } }}
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
        maxWidth="md"
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
            bgcolor: '#1c2128',
            color: '#fff',
            width: '100%',
            maxWidth: '90vw',
            zIndex: Z_INDEX.dialog,
            willChange: 'transform, opacity',
            transformOrigin: 'center center',
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
        <DialogTitle sx={{ 
          color: '#fff', 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          py: 2,
          px: 2.5,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <RecentActorsIcon sx={{ fontSize: '1.5rem', color: '#00d4ff' }} />
            <Typography variant="h6" sx={{ fontSize: '1.125rem', fontWeight: 600 }}>
              {selectedCandidate?.id && !selectedCandidate.name ? branding.tokens.labels.candidateDialogNewTitle : branding.tokens.labels.candidateDialogEditTitle}
            </Typography>
          </Box>
          <IconButton
            onClick={() => {
              setCandidateDialogOpen(false);
              setSelectedCandidate(null);
            }}
            size="small"
            sx={{ color: 'rgba(255,255,255,0.87)', '&:hover': { color: '#fff' } }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, px: 2.5, pb: 2, overflow: 'visible' }}>
          {selectedCandidate && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
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
                  <ImageIcon sx={{ color: '#00d4ff', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.3125rem', lg: '1.4375rem', xl: '1.5rem' } }} />
                  <Typography variant="subtitle2" sx={{ color: '#00d4ff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                    {branding.tokens.labels.mediaSectionLabel}
                  </Typography>
                </Box>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const newPhotos: string[] = [...selectedCandidate.photos];
                    const newVideos: string[] = [...selectedCandidate.videos];
                    
                    files.forEach((file) => {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const result = event.target?.result as string;
                        if (file.type.startsWith('image/')) {
                          newPhotos.push(result);
                        } else if (file.type.startsWith('video/')) {
                          newVideos.push(result);
                        }
                        setSelectedCandidate({
                          ...selectedCandidate,
                          photos: [...newPhotos],
                          videos: [...newVideos],
                        });
                      };
                      reader.readAsDataURL(file);
                    });
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
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#fff',
                      '&:hover': { borderColor: '#00d4ff' },
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
                  <Box sx={{ mt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, display: 'flex', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, flexWrap: 'wrap' }}>
                    {(selectedCandidate.photos || []).map((photo, idx) => (
                      <Box
                        key={idx}
                        component="img"
                        src={photo}
                        alt={branding.tokens.labels.candidatePhotoAltLabel.replace('{index}', String(idx + 1))}
                        sx={{
                          width: { xs: 60, sm: 70, md: 65, lg: 80, xl: 90 },
                          height: { xs: 60, sm: 70, md: 65, lg: 80, xl: 90 },
                          objectFit: 'cover',
                          borderRadius: 1,
                          border: '1px solid rgba(255,255,255,0.2)',
                        }}
                      />
                    ))}
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
              
              <FormControl fullWidth sx={{ mt: 2 }}>
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
                            sx={{ bgcolor: 'rgba(0,212,255,0.2)', color: '#00d4ff' }}
                          />
                        );
                      })}
                    </Box>
                  )}
                  sx={{
                    color: '#fff',
                    fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                    minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '& .MuiSelect-select': {
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                    },
                  }}
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
              
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.statusLabel}</InputLabel>
                <Select
                  value={selectedCandidate.status}
                  MenuProps={selectMenuProps}
                  onChange={(e) => setSelectedCandidate({
                    ...selectedCandidate,
                    status: e.target.value as Candidate['status'],
                  })}
                  sx={{
                    color: '#fff',
                    fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                    minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '& .MuiSelect-select': {
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                    },
                  }}
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
                <ContactEmergencyIcon sx={{ color: '#00d4ff', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.3125rem', lg: '1.4375rem', xl: '1.5rem' } }} />
                <Typography variant="subtitle2" sx={{ 
                  color: '#00d4ff', 
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
                  <ConsentManagementPanel
                    projectId={currentProject.id}
                    candidateId={selectedCandidate.id}
                    onUpdate={() => {
                      loadProjects();
                    }}
                  />
                </Box>
              ) : (
                /* For new candidates - show option to send consent on save */
                <Box sx={{ 
                  mt: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 },
                  p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                  bgcolor: 'rgba(0,212,255,0.05)',
                  borderRadius: 2,
                  border: '1px solid rgba(0,212,255,0.2)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                    <ConsentsIcon sx={{ color: '#00d4ff', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.3125rem', lg: '1.4375rem', xl: '1.5rem' } }} />
                    <Typography variant="subtitle2" sx={{ 
                      color: '#00d4ff', 
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
                          color: '#00d4ff', 
                          '&.Mui-checked': { color: '#00d4ff' },
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
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
          gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 },
        }}>
          <Button
            onClick={() => {
              setCandidateDialogOpen(false);
              setSelectedCandidate(null);
            }}
            startIcon={<CancelIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            sx={{ 
              color: 'rgba(255,255,255,0.87)',
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
              minHeight: TOUCH_TARGET_SIZE,
            }}
          >
            {branding.tokens.labels.cancelLabel}
          </Button>
          <Button
            onClick={handleSaveCandidate}
            variant="contained"
            startIcon={<SaveIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            sx={{
              bgcolor: '#00d4ff',
              color: '#000',
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 2.25, lg: 3, xl: 4 },
              py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
              minHeight: TOUCH_TARGET_SIZE,
              fontWeight: 600,
              '&:hover': { bgcolor: '#00b8e6' },
            }}
          >
            {branding.tokens.labels.saveLabel}
          </Button>
          {selectedCandidate?.id && selectedCandidate.name && (
            <Button
              onClick={() => { handleDeleteCandidate(selectedCandidate.id); setCandidateDialogOpen(false); setSelectedCandidate(null); }}
              startIcon={<DeleteIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              sx={{
                color: '#ff4444',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { bgcolor: 'rgba(255,68,68,0.1)' },
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
        maxWidth="md"
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
            bgcolor: '#1c2128',
            color: '#fff',
            width: '100%',
            maxWidth: '90vw',
            zIndex: Z_INDEX.dialog,
            willChange: 'transform, opacity',
            transformOrigin: 'center center',
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
        <DialogTitle sx={{ 
          color: '#fff', 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          py: 2,
          px: 2.5,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CalendarIcon sx={{ fontSize: '1.5rem', color: '#00d4ff' }} />
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
            sx={{ color: 'rgba(255,255,255,0.87)', '&:hover': { color: '#fff' } }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, px: 2.5, pb: 2, overflow: 'visible' }}>
          {selectedSchedule && currentProject && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? 3 : 2 }}>
              <FormControl fullWidth>
                <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.candidateLabel}</InputLabel>
                <Select
                  value={selectedSchedule.candidateId}
                  MenuProps={selectMenuProps}
                  onChange={(e) => setSelectedSchedule({ ...selectedSchedule, candidateId: e.target.value })}
                  sx={{
                    color: '#fff',
                    fontSize: isDesktop ? '1.25rem' : isTablet ? '1rem' : '0.875rem',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '& .MuiSelect-select': {
                      fontSize: isDesktop ? '1.25rem' : isTablet ? '1rem' : '0.875rem',
                    },
                  }}
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
              
              <FormControl fullWidth>
                <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.roleLabel}</InputLabel>
                <Select
                  value={selectedSchedule.roleId}
                  MenuProps={selectMenuProps}
                  onChange={(e) => setSelectedSchedule({ ...selectedSchedule, roleId: e.target.value })}
                  sx={{
                    color: '#fff',
                    fontSize: isDesktop ? '1.25rem' : isTablet ? '1rem' : '0.875rem',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '& .MuiSelect-select': {
                      fontSize: isDesktop ? '1.25rem' : isTablet ? '1rem' : '0.875rem',
                    },
                  }}
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
              
              <FormControl fullWidth>
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
                  sx={{
                    color: '#fff',
                    fontSize: isDesktop ? '1.25rem' : isTablet ? '1rem' : '0.875rem',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '& .MuiSelect-select': {
                      fontSize: isDesktop ? '1.25rem' : isTablet ? '1rem' : '0.875rem',
                    },
                  }}
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
              
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.sceneOptionalLabel}</InputLabel>
                <Select
                  value={selectedSchedule.sceneId || ''}
                  MenuProps={selectMenuProps}
                  onChange={(e) => setSelectedSchedule({
                    ...selectedSchedule,
                    sceneId: e.target.value || undefined,
                  })}
                  sx={{
                    color: '#fff',
                    fontSize: isDesktop ? '1.25rem' : isTablet ? '1rem' : '0.875rem',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '& .MuiSelect-select': {
                      fontSize: isDesktop ? '1.25rem' : isTablet ? '1rem' : '0.875rem',
                    },
                  }}
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
                    bgcolor: 'rgba(255,184,0,0.15)',
                    p: 1.5,
                    borderRadius: '8px',
                    border: '2px solid rgba(255,184,0,0.3)',
                    ...KEYFRAMES_STYLES,
                  }}
                >
                  <Box
                    sx={{
                      width: isDesktop ? 40 : 32,
                      height: isDesktop ? 40 : 32,
                      borderRadius: 2,
                      bgcolor: 'rgba(255,184,0,0.2)',
                      border: '2px solid rgba(255,184,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <NoteIcon
                      sx={{
                        color: '#ffb800',
                        fontSize: isDesktop ? '1.5rem' : '1.125rem',
                        animation: 'writing 2.5s ease-in-out infinite',
                        filter: 'drop-shadow(0 2px 4px rgba(255,184,0,0.3))',
                      }}
                    />
                  </Box>
                  <Typography sx={{ color: '#ffb800', fontWeight: 700, fontSize: isDesktop ? '1rem' : '0.875rem' }}>
                    {branding.tokens.labels.notesLabel}
                  </Typography>
                </Box>
                <RichTextEditor
                  value={selectedSchedule.notes || ''}
                  onChange={(value) => setSelectedSchedule({ ...selectedSchedule, notes: value })}
                  placeholder={branding.tokens.labels.notesPlaceholder}
                  minHeight={120}
                  accentColor="#ffb800"
                />
              </Box>
              
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel sx={inputLabelStyles}>{branding.tokens.labels.statusLabel}</InputLabel>
                <Select
                  value={selectedSchedule.status}
                  MenuProps={selectMenuProps}
                  onChange={(e) => setSelectedSchedule({
                    ...selectedSchedule,
                    status: e.target.value as Schedule['status'],
                  })}
                  sx={{
                    color: '#fff',
                    fontSize: isDesktop ? '1.25rem' : isTablet ? '1rem' : '0.875rem',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '& .MuiSelect-select': {
                      fontSize: isDesktop ? '1.25rem' : isTablet ? '1rem' : '0.875rem',
                    },
                  }}
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
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: isDesktop ? 3 : 2,
          gap: isDesktop ? 2 : 1,
        }}>
          <Button
            onClick={() => {
              setScheduleDialogOpen(false);
              setSelectedSchedule(null);
            }}
            startIcon={<CancelIcon />}
            sx={{ 
              color: 'rgba(255,255,255,0.87)',
              fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem',
              px: isDesktop ? 3 : 2,
              py: isDesktop ? 1.5 : 1,
            }}
          >
            {branding.tokens.labels.cancelLabel}
          </Button>
          <Button
            onClick={handleSaveSchedule}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{
              bgcolor: '#00d4ff',
              color: '#000',
              fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem',
              px: isDesktop ? 4 : 3,
              py: isDesktop ? 1.5 : 1,
              fontWeight: 600,
              '&:hover': { bgcolor: '#00b8e6' },
            }}
          >
            {branding.tokens.labels.saveLabel}
          </Button>
          {selectedSchedule?.id && selectedSchedule.date && (
            <Button
              onClick={() => { handleDeleteSchedule(selectedSchedule.id); setScheduleDialogOpen(false); setSelectedSchedule(null); }}
              startIcon={<DeleteIcon />}
              sx={{
                color: '#ff4444',
                fontSize: isDesktop ? '1.125rem' : isTablet ? '1rem' : '0.875rem',
                px: isDesktop ? 3 : 2,
                py: isDesktop ? 1.5 : 1,
                '&:hover': { bgcolor: 'rgba(255,68,68,0.1)' },
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
                          setProjectCreationModalOpen(true);
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
      {currentProject && (
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
                      } catch (error) {
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
                  setActiveTab(link.tabIndex);
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

      <Suspense fallback={null}>
        <AdminDashboard
          open={adminDashboardOpen}
          onClose={() => setAdminDashboardOpen(false)}
          projectName={currentProject?.name}
        />
      </Suspense>

      <Suspense fallback={null}>
        <LoginDialog
          open={loginDialogOpen}
          onClose={() => setLoginDialogOpen(false)}
          onLoginSuccess={(user) => setAdminUser(user)}
        />
      </Suspense>

      <Suspense fallback={null}>
        <CastingPlannerTutorial
          open={showTutorial || previewTutorial !== null}
          onClose={() => {
            setShowTutorial(false);
            setPreviewTutorial(null);
          }}
          onNavigateToTab={(tabIndex) => setActiveTab(tabIndex)}
          customTutorial={previewTutorial || undefined}
        />
      </Suspense>

      <Suspense fallback={null}>
        <TutorialEditorPanel
          open={showTutorialEditor}
          onClose={() => setShowTutorialEditor(false)}
          onPreviewTutorial={(tutorial) => {
            setShowTutorialEditor(false);
            setPreviewTutorial(tutorial);
          }}
        />
      </Suspense>

      {/* Consent Contract Dialog */}
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

      {onboardingProfession && (
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
