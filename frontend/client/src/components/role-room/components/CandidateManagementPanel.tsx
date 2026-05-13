// @ts-nocheck
import React, { useState, useId, useMemo, useEffect, memo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  IconButton,
  Chip,
  Grid,
  Tooltip,
  Collapse,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Checkbox,
  Stack,
  useTheme,
  useMediaQuery,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  CircularProgress,
  Tabs,
  Tab,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  FileDownload as ExportIcon,
  ContentCopy as DuplicateIcon,
  GridView as GridViewIcon,
  TableRows as TableViewIcon,
  Person as PersonIcon,
  PersonSearch as PersonSearchIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  SmsOutlined as SmsOutlinedIcon,
  WhatsApp as WhatsAppIcon,
  MarkEmailReadOutlined as MarkEmailReadOutlinedIcon,
  NotificationsOffOutlined as NotificationsOffOutlinedIcon,
  WarningAmber as WarningAmberIcon,
  ViewInAr as ViewInArIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Preview as PreviewIcon,
  Lightbulb as LightbulbIcon,
  Upload as UploadIcon,
  Inventory as InventoryIcon,
  FileDownload as DownloadIcon,
  ContactPhone as QuickContactIcon,
  CompareArrows as CompareArrowsIcon,
  Timeline as TimelineIcon,
  Collections as CollectionsIcon,
  Videocam as VideocamIcon,
  Gavel as GavelIcon,
  Tune as TuneIcon,
  DoneAll as DoneAllIcon,
  Rule as RuleIcon,
  ViewCarousel as ViewCarouselIcon,
} from '@mui/icons-material';
import { Virtuoso } from 'react-virtuoso';
import { CandidatesIcon as RecentActorsIcon, StatsIcon } from './icons/CastingIcons';
import { ConsentStatusBadge } from './ConsentStatusBadge';
import { candidatePoolService, type PoolCandidate } from '../services/candidatePoolService';
import { GLB3DPreview, PERSONALITY_TRAITS } from './GLB3DPreview';
import settingsService from '../services/settingsService';

interface LightingPreset {
  id: string;
  name: string;
  category: 'portrait' | 'dramatic' | 'beauty' | 'hollywood' | 'natural' | 'atmospheric';
  description: string;
  icon: 'rembrandt' | 'butterfly' | 'split' | 'loop' | 'clamshell' | 'natural' | 'dramatic' | 'soft' | 'campfire';
  lights: Array<{
    type: string;
    position: [number, number, number];
    rotation: [number, number, number];
    intensity: number;
    cct?: number;
  }>;
}

const LIGHTING_PRESETS: LightingPreset[] = [
  {
    id: 'rembrandt',
    name: 'Rembrandt',
    category: 'portrait',
    description: 'Klassisk portrettlys med trekant under øyet',
    icon: 'rembrandt',
    lights: [
      { type: 'key', position: [-2, 2.5, 2], rotation: [0, 45, 0], intensity: 1.0, cct: 5600 },
      { type: 'fill', position: [1.5, 1.8, 2], rotation: [0, -25, 0], intensity: 0.3, cct: 5600 },
    ]
  },
  {
    id: 'butterfly',
    name: 'Butterfly / Paramount',
    category: 'beauty',
    description: 'Glamorøs belysning forfra ovenfra',
    icon: 'butterfly',
    lights: [
      { type: 'key', position: [0, 3, 2], rotation: [-20, 0, 0], intensity: 1.0, cct: 5600 },
      { type: 'fill', position: [0, 0.5, 2], rotation: [15, 0, 0], intensity: 0.4, cct: 5600 },
    ]
  },
  {
    id: 'split',
    name: 'Split Lighting',
    category: 'dramatic',
    description: 'Dramatisk halvside-belysning',
    icon: 'split',
    lights: [
      { type: 'key', position: [-3, 2, 0], rotation: [0, 90, 0], intensity: 1.0, cct: 5600 },
    ]
  },
  {
    id: 'loop',
    name: 'Loop Lighting',
    category: 'portrait',
    description: 'Allsidig, flatterende portrettlys',
    icon: 'loop',
    lights: [
      { type: 'key', position: [-1.5, 2.2, 2], rotation: [0, 35, 0], intensity: 1.0, cct: 5600 },
      { type: 'fill', position: [1.5, 1.8, 2], rotation: [0, -25, 0], intensity: 0.4, cct: 5600 },
    ]
  },
  {
    id: 'clamshell',
    name: 'Clamshell',
    category: 'beauty',
    description: 'Beauty-oppsett med lys over og under',
    icon: 'clamshell',
    lights: [
      { type: 'key', position: [0, 2.5, 2], rotation: [-15, 0, 0], intensity: 0.9, cct: 5600 },
      { type: 'fill', position: [0, 0.8, 2], rotation: [15, 0, 0], intensity: 0.5, cct: 5600 },
    ]
  },
  {
    id: 'three-point',
    name: '3-punkt Studio',
    category: 'portrait',
    description: 'Klassisk nøkkel, fyll og rim-lys',
    icon: 'natural',
    lights: [
      { type: 'key', position: [-2, 2.5, 2], rotation: [0, 45, 0], intensity: 1.0, cct: 5600 },
      { type: 'fill', position: [2, 1.8, 2], rotation: [0, -30, 0], intensity: 0.4, cct: 5600 },
      { type: 'rim', position: [1, 2.5, -2], rotation: [0, 150, 0], intensity: 0.6, cct: 5600 },
    ]
  },
  {
    id: 'hollywood-noir',
    name: 'Hollywood Noir',
    category: 'hollywood',
    description: 'Film noir-inspirert dramatisk lys',
    icon: 'dramatic',
    lights: [
      { type: 'key', position: [-3, 3, 1], rotation: [-10, 60, 0], intensity: 1.2, cct: 4500 },
      { type: 'accent', position: [2, 2, -2], rotation: [0, -120, 0], intensity: 0.3, cct: 5600 },
    ]
  },
  {
    id: 'soft-natural',
    name: 'Myk Naturlig',
    category: 'natural',
    description: 'Bløt, naturlig vindusbelysning',
    icon: 'soft',
    lights: [
      { type: 'key', position: [-3, 2, 1], rotation: [0, 60, 0], intensity: 0.8, cct: 5200 },
      { type: 'fill', position: [2, 1.5, 1], rotation: [0, -40, 0], intensity: 0.3, cct: 5200 },
    ]
  },
  {
    id: 'campfire',
    name: 'Bålkveld',
    category: 'atmospheric',
    description: 'Varmt bållys rundt et bord',
    icon: 'campfire',
    lights: [
      { type: 'campfire-center', position: [0, 0.5, 0], rotation: [0, 0, 0], intensity: 0.8, cct: 2700 },
      { type: 'campfire-flicker-1', position: [0.3, 0.8, 0.2], rotation: [0, 0, 0], intensity: 0.5, cct: 2500 },
      { type: 'campfire-flicker-2', position: [-0.2, 0.6, -0.3], rotation: [0, 0, 0], intensity: 0.4, cct: 2800 },
      { type: 'ambient-moon', position: [5, 8, 5], rotation: [-30, -45, 0], intensity: 0.15, cct: 8000 },
    ]
  },
];
import type { Candidate, ContactInfo, Role } from '../models/casting';
import { getRoleTypeMeta } from '../config/roleType';
import { formatRelativeNb } from '../utils/formatRelativeNb';
import { castingService } from '../services/castingService';
import { castingToSceneService } from '../services/castingToSceneService';
import { getCandidatePhotoObjectPosition } from '../utils/candidatePhotoFocalPoint';
import { useToast } from './ToastStack';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import kandidaterPng from './icons/Keep/roleroom_kandidater.png';
import { TOUCH_TARGET_SIZE } from '../constants/accessibility';

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #b86bff',
    outlineOffset: 2,
  },
};

type SortField = 'name' | 'status' | 'roles' | 'createdAt';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';
type WorkspaceView = 'standard' | 'pro';
type StatusFilter = 'all' | 'pending' | 'requested' | 'shortlist' | 'selected' | 'confirmed' | 'rejected';
type ProSortField = 'fitScore' | 'name' | 'status' | 'updatedAt' | 'createdAt';
type ProGroupBy = 'none' | 'status';
type ProPreset = 'casting' | 'compliance' | 'final' | 'custom';
type ProDetailTab = 'overview' | 'media' | 'videos' | 'consent' | 'history' | 'actions' | 'compare';

type CandidateConsent = {
  id?: string;
  type?: string;
  title?: string;
  status?: string;
  required?: boolean;
  signedAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type ProListItem =
  | { type: 'header'; key: string; label: string; count: number }
  | { type: 'candidate'; key: string; candidate: Candidate };

const PRO_VIEW_NAMESPACE = 'virtualStudio_candidateProView';
const PRO_STATUS_ORDER: StatusFilter[] = ['confirmed', 'selected', 'shortlist', 'requested', 'pending', 'rejected'];

interface CandidateManagementPanelProps {
  projectId: string;
  candidates: Candidate[];
  roles: Role[];
  onCandidatesChange: () => void;
  onEditCandidate: (candidate: Candidate) => void;
  onCreateCandidate: () => void;
  profession?: 'photographer' | 'videographer' | null;
  quickContactIds?: Set<string>;
  onQuickContactsChange?: (ids: string[]) => void;
}

const isValidCandidate = (candidate: unknown): candidate is Candidate => {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const record = candidate as Record<string, unknown>;
  return typeof record.id === 'string'
    && record.id.trim().length > 0
    && typeof record.name === 'string'
    && record.name.trim().length > 0;
};

const isValidRole = (role: unknown): role is Role => {
  if (!role || typeof role !== 'object') {
    return false;
  }

  const record = role as Record<string, unknown>;
  return typeof record.id === 'string'
    && record.id.trim().length > 0
    && typeof record.name === 'string'
    && record.name.trim().length > 0;
};

function CandidateManagementPanelInner({
  projectId,
  candidates,
  roles,
  onCandidatesChange,
  onEditCandidate,
  onCreateCandidate,
  profession,
  quickContactIds,
  onQuickContactsChange,
}: CandidateManagementPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const titleId = useId();
  const statsId = useId();

  // Toast notifications
  const { showSuccess, showError, showInfo } = useToast();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>(() => (isDesktop ? 'table' : 'grid'));
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('standard');
  const [showStats, setShowStats] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  // Per-rad ⋮-meny: holder anchor-element OG hvilken kandidat
  // menyen gjelder. Lukkes ved menu-bytte (ny rad åpnes) eller
  // explisitt onClose. Robust mot stale-state: når kandidaten
  // slettes, settes til null automatisk via filter-update.
  const [rowActionMenuAnchor, setRowActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [rowActionMenuCandidate, setRowActionMenuCandidate] = useState<Candidate | null>(null);
  const [localQuickContacts, setLocalQuickContacts] = useState<Set<string>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<Candidate | null>(null);
  const [addingToScene, setAddingToScene] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [candidatesToPreview, setCandidatesToPreview] = useState<Candidate[]>([]);
  const [poolMode, setPoolMode] = useState<'project' | 'pool'>('project');
  const [poolSearchQuery, setPoolSearchQuery] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [poolCandidates, setPoolCandidates] = useState<PoolCandidate[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [proSortField, setProSortField] = useState<ProSortField>('fitScore');
  const [proSortDirection, setProSortDirection] = useState<SortDirection>('desc');
  const [proGroupBy, setProGroupBy] = useState<ProGroupBy>('status');
  const [proPreset, setProPreset] = useState<ProPreset>('casting');
  const [proDetailTab, setProDetailTab] = useState<ProDetailTab>('overview');
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [proMediaBusy, setProMediaBusy] = useState(false);
  const [proCompareMode, setProCompareMode] = useState(false);
  const focalPickerRef = useRef<HTMLDivElement | null>(null);

  const containerPadding = { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 };
  const roleTabAccent = '#b86bff';
  const roleTabAccentHover = '#a855f7';
  const roleTabAccentSoft = 'rgba(184,107,255,0.18)';
  const roleSurface = 'rgba(20,14,48,0.84)';
  const roleSurfaceMuted = 'rgba(33,24,70,0.72)';
  const roleBorder = 'rgba(184,107,255,0.32)';
  const roleText = '#f3eaff';
  const roleTextMuted = 'rgba(220,205,255,0.82)';
  const quickContactColor = '#46d9ff';
  const quickContactColorMuted = 'rgba(70,217,255,0.46)';
  const quickContactBackground = 'rgba(70,217,255,0.12)';
  const quickContacts = quickContactIds ?? localQuickContacts;
  const safeRoles = useMemo(
    () => (Array.isArray(roles) ? roles.filter(isValidRole) : []),
    [roles],
  );
  const safeCandidatesInput = useMemo(
    () => (Array.isArray(candidates) ? candidates.filter(isValidCandidate) : []),
    [candidates],
  );

  const FAVORITES_NAMESPACE = 'virtualStudio_candidateFavorites';
  const proViewNamespace = `${PRO_VIEW_NAMESPACE}:${projectId}`;

  const getCandidateDate = (candidate: Candidate, field: 'createdAt' | 'updatedAt') => {
    const camelCaseValue = candidate[field];
    const snakeCaseValue = candidate[`${field}_at`];
    const raw = typeof camelCaseValue === 'string'
      ? camelCaseValue
      : typeof snakeCaseValue === 'string'
        ? snakeCaseValue
        : undefined;
    const value = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(value) ? value : 0;
  };

  const getCandidateContactInfo = (candidate?: Candidate | null): ContactInfo => {
    if (!candidate) {
      return {};
    }

    const directContact = candidate.contactInfo;
    const snakeCaseContact = candidate.contact_info;
    const email = directContact?.email
      ?? snakeCaseContact?.email
      ?? (typeof candidate.email === 'string' ? candidate.email : undefined);
    const phone = directContact?.phone
      ?? snakeCaseContact?.phone
      ?? (typeof candidate.phone === 'string' ? candidate.phone : undefined);
    return { email, phone };
  };

  const getCandidateAssignedRoles = (candidate: Candidate): string[] => {
    const directRoles = candidate.assignedRoles;
    if (Array.isArray(directRoles)) {
      return directRoles.filter((roleId): roleId is string => typeof roleId === 'string' && roleId.length > 0);
    }
    const snakeCaseRoles = candidate.assigned_roles;
    if (Array.isArray(snakeCaseRoles)) {
      return snakeCaseRoles.filter((roleId): roleId is string => typeof roleId === 'string' && roleId.length > 0);
    }
    const fallbackRoleId = typeof candidate.roleId === 'string'
      ? candidate.roleId
      : typeof candidate.role_id === 'string'
        ? candidate.role_id
        : undefined;
    return fallbackRoleId ? [fallbackRoleId] : [];
  };

  const getCandidateAuditionNotes = (candidate: Candidate): string => {
    if (typeof candidate.auditionNotes === 'string' && candidate.auditionNotes.trim().length > 0) {
      return candidate.auditionNotes;
    }
    if (typeof candidate.audition_notes === 'string' && candidate.audition_notes.trim().length > 0) {
      return candidate.audition_notes;
    }
    if (typeof candidate.notes === 'string' && candidate.notes.trim().length > 0) {
      return candidate.notes;
    }
    return '';
  };

  const validCandidates = safeCandidatesInput;

  const getCandidateConsents = (candidate: Candidate): CandidateConsent[] => {
    const raw = candidate.consent;
    return Array.isArray(raw) ? (raw as CandidateConsent[]) : [];
  };

  const getConsentCompletionScore = (candidate: Candidate) => {
    const consents = getCandidateConsents(candidate);
    if (consents.length === 0) return 0;
    const signedCount = consents.filter((consent) => {
      const status = String(consent.status || '').toLowerCase();
      return status === 'signed' || status === 'approved' || status === 'accepted';
    }).length;
    return Math.round((signedCount / consents.length) * 100);
  };

  const getContactCoverageScore = (candidate: Candidate) => {
    const contactInfo = getCandidateContactInfo(candidate);
    const email = contactInfo.email;
    const phone = contactInfo.phone;
    if (email && phone) return 100;
    if (email || phone) return 50;
    return 0;
  };

  const getCandidateFitScore = (candidate: Candidate) => {
    const status = String(candidate.status || 'pending');
    const statusScoreMap: Record<string, number> = {
      confirmed: 30,
      selected: 26,
      shortlist: 20,
      requested: 15,
      pending: 12,
      rejected: 0,
    };
    const statusScore = statusScoreMap[status] ?? 10;
    const roleCount = getCandidateAssignedRoles(candidate).length;
    const roleScore = Math.min(20, roleCount * 7);
    const mediaCount = Array.isArray(candidate.photos) ? candidate.photos.length : 0;
    const mediaScore = Math.min(15, mediaCount * 5);
    const consentScore = Math.round(getConsentCompletionScore(candidate) * 0.2);
    const contactScore = Math.round(getContactCoverageScore(candidate) * 0.1);
    const favoriteScore = favorites.has(candidate.id) ? 4 : 0;
    const quickContactScore = quickContacts.has(candidate.id) ? 4 : 0;
    const recencyDays = getCandidateDate(candidate, 'updatedAt')
      ? (Date.now() - getCandidateDate(candidate, 'updatedAt')) / (1000 * 60 * 60 * 24)
      : 999;
    const recencyScore = recencyDays <= 3 ? 7 : recencyDays <= 14 ? 4 : 1;
    return Math.max(
      0,
      Math.min(100, statusScore + roleScore + mediaScore + consentScore + contactScore + favoriteScore + quickContactScore + recencyScore),
    );
  };

  // Load favorites from database (with settings cache fallback)
  useEffect(() => {
    const loadFavorites = async () => {
      if (!projectId) {
        setFavorites(new Set());
        setFavoritesLoaded(true);
        return;
      }
      try {
        const { favoritesApi } = await import('../services/castingApiService');
        const dbFavorites = await favoritesApi.get(projectId, 'candidate');
        if (dbFavorites.length > 0) {
          setFavorites(new Set(dbFavorites));
          await settingsService.setSetting(FAVORITES_NAMESPACE, dbFavorites, { projectId });
          setFavoritesLoaded(true);
          return;
        }
      } catch (error) {
        console.warn('Database unavailable, using settings cache:', error);
      }
      const cached = await settingsService.getSetting<string[]>(FAVORITES_NAMESPACE, { projectId });
      if (cached && cached.length > 0) {
        setFavorites(new Set(cached));
        setFavoritesLoaded(true);
        return;
      }
      setFavoritesLoaded(true);
    };
    loadFavorites();
  }, [projectId]);

  // Save favorites to database and settings cache
  useEffect(() => {
    const saveFavorites = async () => {
      if (!projectId) return;
      const values = [...favorites];
      await settingsService.setSetting(FAVORITES_NAMESPACE, values, { projectId });
      try {
        const { favoritesApi } = await import('../services/castingApiService');
        await favoritesApi.set(projectId, 'candidate', values);
      } catch (error) {
        console.warn('Database save failed:', error);
      }
    };
    if (!favoritesLoaded) return;
    saveFavorites();
  }, [favorites, projectId, favoritesLoaded]);

  useEffect(() => {
    if (!projectId) return;
    try {
      const raw = localStorage.getItem(proViewNamespace);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        sortField: ProSortField;
        sortDirection: SortDirection;
        groupBy: ProGroupBy;
        preset: ProPreset;
      }>;
      if (parsed.sortField) setProSortField(parsed.sortField);
      if (parsed.sortDirection) setProSortDirection(parsed.sortDirection);
      if (parsed.groupBy) setProGroupBy(parsed.groupBy);
      if (parsed.preset) setProPreset(parsed.preset);
    } catch (error) {
      console.warn('Unable to load Pro View settings:', error);
    }
  }, [projectId, proViewNamespace]);

  useEffect(() => {
    if (!projectId) return;
    try {
      localStorage.setItem(
        proViewNamespace,
        JSON.stringify({
          sortField: proSortField,
          sortDirection: proSortDirection,
          groupBy: proGroupBy,
          preset: proPreset,
        }),
      );
    } catch (error) {
      console.warn('Unable to save Pro View settings:', error);
    }
  }, [projectId, proGroupBy, proPreset, proSortDirection, proSortField, proViewNamespace]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n') { e.preventDefault(); onCreateCandidate(); }
        if (e.key === 'e') { e.preventDefault(); handleExportCSV(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#10b981';
      case 'selected': return '#8b5cf6';
      case 'shortlist': return '#ffb800';
      case 'rejected': return '#ef4444';
      case 'requested': return '#00d4ff';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Bekreftet';
      case 'selected': return 'Valgt';
      case 'shortlist': return 'Kortliste';
      case 'rejected': return 'Avvist';
      case 'requested': return 'Forespurt';
      default: return 'Venter';
    }
  };

  // Filter and sort
  const filteredAndSortedCandidates = useMemo(() => {
    let result = [...validCandidates];
    
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) ||
        (getCandidateContactInfo(c).email || '').toLowerCase().includes(q) ||
        (getCandidateContactInfo(c).phone || '').toLowerCase().includes(q) ||
        getCandidateAuditionNotes(c).toLowerCase().includes(q)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }
    
    // Sort - favorites first
    result.sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;

      const aQuickContact = quickContacts.has(a.id) ? 0 : 1;
      const bQuickContact = quickContacts.has(b.id) ? 0 : 1;
      if (aQuickContact !== bQuickContact) return aQuickContact - bQuickContact;
      
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'roles':
          comparison = getCandidateAssignedRoles(a).length - getCandidateAssignedRoles(b).length;
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [validCandidates, searchQuery, statusFilter, sortField, sortDirection, favorites, quickContacts]);

  // Statistics
  const statistics = useMemo(() => ({
    total: validCandidates.length,
    confirmed: validCandidates.filter(c => c.status === 'confirmed').length,
    selected: validCandidates.filter(c => c.status === 'selected').length,
    shortlist: validCandidates.filter(c => c.status === 'shortlist').length,
    pending: validCandidates.filter(c => c.status === 'pending' || c.status === 'requested').length,
    favorites: favorites.size,
  }), [validCandidates, favorites]);

  const filteredPoolCandidates = useMemo(() => {
    const query = poolSearchQuery.trim().toLowerCase();
    if (!query) return poolCandidates;
    return poolCandidates.filter((poolCandidate) => {
      const tags = poolCandidate.tags?.join(' ').toLowerCase() || '';
      return (
        poolCandidate.name.toLowerCase().includes(query)
        || (poolCandidate.notes || '').toLowerCase().includes(query)
        || (getCandidateContactInfo(poolCandidate).email || '').toLowerCase().includes(query)
        || tags.includes(query)
      );
    });
  }, [poolCandidates, poolSearchQuery]);

  const candidateFitScores = useMemo(() => {
    const scores = new Map<string, number>();
    validCandidates.forEach((candidate) => {
      scores.set(candidate.id, getCandidateFitScore(candidate));
    });
    return scores;
  }, [validCandidates, favorites, quickContacts]);

  const proCandidates = useMemo(() => {
    let result = [...filteredAndSortedCandidates];
    if (proPreset === 'casting') {
      result = result.filter((candidate) => candidate.status !== 'rejected');
    } else if (proPreset === 'compliance') {
      result = result.filter((candidate) => getConsentCompletionScore(candidate) < 100 || getContactCoverageScore(candidate) < 100);
    } else if (proPreset === 'final') {
      result = result.filter((candidate) => ['selected', 'confirmed', 'shortlist'].includes(String(candidate.status || 'pending')));
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (proSortField === 'fitScore') {
        comparison = (candidateFitScores.get(a.id) || 0) - (candidateFitScores.get(b.id) || 0);
      } else if (proSortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (proSortField === 'status') {
        const aRank = PRO_STATUS_ORDER.indexOf((a.status as StatusFilter) || 'pending');
        const bRank = PRO_STATUS_ORDER.indexOf((b.status as StatusFilter) || 'pending');
        comparison = (aRank === -1 ? PRO_STATUS_ORDER.length : aRank) - (bRank === -1 ? PRO_STATUS_ORDER.length : bRank);
      } else if (proSortField === 'updatedAt') {
        comparison = getCandidateDate(a, 'updatedAt') - getCandidateDate(b, 'updatedAt');
      } else if (proSortField === 'createdAt') {
        comparison = getCandidateDate(a, 'createdAt') - getCandidateDate(b, 'createdAt');
      }
      return proSortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [candidateFitScores, filteredAndSortedCandidates, proPreset, proSortDirection, proSortField]);

  const proListItems = useMemo<ProListItem[]>(() => {
    if (proGroupBy === 'none') {
      return proCandidates.map((candidate) => ({ type: 'candidate', key: candidate.id, candidate }));
    }
    const grouped: ProListItem[] = [];
    PRO_STATUS_ORDER.forEach((status) => {
      const items = proCandidates.filter((candidate) => (candidate.status || 'pending') === status);
      if (items.length === 0) return;
      grouped.push({
        type: 'header',
        key: `status-${status}`,
        label: getStatusLabel(status),
        count: items.length,
      });
      items.forEach((candidate) => grouped.push({ type: 'candidate', key: candidate.id, candidate }));
    });
    const unknownItems = proCandidates.filter((candidate) => !PRO_STATUS_ORDER.includes((candidate.status as StatusFilter) || 'pending'));
    if (unknownItems.length > 0) {
      grouped.push({
        type: 'header',
        key: 'status-unknown',
        label: 'Andre',
        count: unknownItems.length,
      });
      unknownItems.forEach((candidate) => grouped.push({ type: 'candidate', key: candidate.id, candidate }));
    }
    return grouped;
  }, [proCandidates, proGroupBy]);

  const activeCandidates = workspaceView === 'pro' ? proCandidates : filteredAndSortedCandidates;

  const selectedCandidate = useMemo(() => {
    if (activeCandidates.length === 0) return null;
    if (!selectedCandidateId) return activeCandidates[0];
    return activeCandidates.find((candidate) => candidate.id === selectedCandidateId) || activeCandidates[0];
  }, [activeCandidates, selectedCandidateId]);

  const selectedCandidateContact = useMemo(
    () => (selectedCandidate ? getCandidateContactInfo(selectedCandidate) : {}),
    [selectedCandidate],
  );

  const selectedCandidateAssignedRoles = useMemo(
    () => (selectedCandidate ? getCandidateAssignedRoles(selectedCandidate) : []),
    [selectedCandidate],
  );

  const selectedCandidateNotes = useMemo(
    () => (selectedCandidate ? getCandidateAuditionNotes(selectedCandidate) : ''),
    [selectedCandidate],
  );

  const compareCandidates = useMemo(
    () => proCandidates.filter((candidate) => selectedIds.has(candidate.id)).slice(0, 4),
    [proCandidates, selectedIds],
  );

  useEffect(() => {
    if (workspaceView !== 'pro') return;
    const handleProKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput = !!target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.getAttribute('contenteditable') === 'true'
      );
      if (isTextInput) return;
      const currentIndex = proCandidates.findIndex((candidate) => candidate.id === selectedCandidateId);
      if (event.key.toLowerCase() === 'j') {
        event.preventDefault();
        const nextIndex = Math.min(proCandidates.length - 1, Math.max(0, currentIndex + 1));
        if (proCandidates[nextIndex]) setSelectedCandidateId(proCandidates[nextIndex].id);
        return;
      }
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const nextIndex = Math.max(0, currentIndex <= 0 ? 0 : currentIndex - 1);
        if (proCandidates[nextIndex]) setSelectedCandidateId(proCandidates[nextIndex].id);
        return;
      }
      if (!selectedCandidate) return;
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        onEditCandidate(selectedCandidate);
        return;
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        toggleFavorite(selectedCandidate.id);
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        handleToggleSelect(selectedCandidate.id);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        void handleStatusUpdate(selectedCandidate, 'confirmed');
      }
    };

    window.addEventListener('keydown', handleProKeyboard);
    return () => window.removeEventListener('keydown', handleProKeyboard);
  }, [onEditCandidate, proCandidates, selectedCandidate, selectedCandidateId, workspaceView]);

  useEffect(() => {
    if (activeCandidates.length === 0) {
      if (selectedCandidateId !== null) setSelectedCandidateId(null);
      return;
    }
    if (!selectedCandidateId || !activeCandidates.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(activeCandidates[0].id);
    }
  }, [activeCandidates, selectedCandidateId]);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [selectedCandidateId]);

  const selectedPhotoIndex = useMemo(() => {
    if (!selectedCandidate || !Array.isArray(selectedCandidate.photos) || selectedCandidate.photos.length === 0) return 0;
    return Math.min(activePhotoIndex, selectedCandidate.photos.length - 1);
  }, [activePhotoIndex, selectedCandidate]);

  const selectedPhotoFocalPoint = useMemo(() => {
    if (!selectedCandidate || !Array.isArray(selectedCandidate.photoFocalPoints)) return { x: 50, y: 50 };
    return selectedCandidate.photoFocalPoints[selectedPhotoIndex] || { x: 50, y: 50 };
  }, [selectedCandidate, selectedPhotoIndex]);

  const selectedCandidateHistory = useMemo(() => {
    if (!selectedCandidate) return [] as Array<{ id: string; label: string; date: number; description: string }>;
    const events: Array<{ id: string; label: string; date: number; description: string }> = [];
    const createdAt = getCandidateDate(selectedCandidate, 'createdAt');
    const updatedAt = getCandidateDate(selectedCandidate, 'updatedAt');
    if (createdAt) {
      events.push({
        id: `${selectedCandidate.id}-created`,
        label: 'Kandidat opprettet',
        date: createdAt,
        description: `${selectedCandidate.name} ble lagt til i prosjektet.`,
      });
    }
    if (updatedAt) {
      events.push({
        id: `${selectedCandidate.id}-updated`,
        label: 'Sist oppdatert',
        date: updatedAt,
        description: 'Kandidatdata ble sist endret.',
      });
    }
    events.push({
      id: `${selectedCandidate.id}-status`,
      label: 'Nåværende status',
      date: updatedAt || createdAt || Date.now(),
      description: `Status er ${getStatusLabel(selectedCandidate.status || 'pending')}.`,
    });

    const statusHistory = Array.isArray((selectedCandidate as any).statusHistory)
      ? ((selectedCandidate as any).statusHistory as Array<{ status?: string; changedAt?: string; changedBy?: string }>)
      : [];
    statusHistory.forEach((entry, index) => {
      const timestamp = entry.changedAt ? new Date(entry.changedAt).getTime() : 0;
      if (!timestamp) return;
      events.push({
        id: `${selectedCandidate.id}-status-history-${index}`,
        label: 'Status endret',
        date: timestamp,
        description: `${getStatusLabel(entry.status || 'pending')}${entry.changedBy ? ` av ${entry.changedBy}` : ''}`,
      });
    });

    return events.sort((a, b) => b.date - a.date);
  }, [selectedCandidate]);

  useEffect(() => {
    if (!selectedCandidate || !Array.isArray(selectedCandidate.photos)) return;
    if (selectedCandidate.photos.length === 0 && activePhotoIndex !== 0) {
      setActivePhotoIndex(0);
      return;
    }
    if (activePhotoIndex > selectedCandidate.photos.length - 1) {
      setActivePhotoIndex(Math.max(0, selectedCandidate.photos.length - 1));
    }
  }, [activePhotoIndex, selectedCandidate]);

  useEffect(() => {
    if (selectedIds.size < 2) {
      setProCompareMode(false);
    }
  }, [selectedIds.size]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const updateQuickContacts = (next: Set<string>) => {
    if (onQuickContactsChange) {
      onQuickContactsChange([...next]);
      return;
    }
    setLocalQuickContacts(next);
  };

  const toggleQuickContact = (id: string) => {
    const next = new Set(quickContacts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateQuickContacts(next);
  };

  const handleSelectAll = () => {
    const source = workspaceView === 'pro' ? proCandidates : filteredAndSortedCandidates;
    if (selectedIds.size === source.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(source.map((candidate) => candidate.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedCandidateId(id);
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const saveCandidatePatch = async (candidate: Candidate, patch: Partial<Candidate>, successMessage?: string) => {
    try {
      const updatedCandidate: Candidate = {
        ...candidate,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveCandidate(projectId, updatedCandidate);
      onCandidatesChange();
      if (successMessage) showSuccess(successMessage, 2500);
      return true;
    } catch (error) {
      console.error('Failed to save candidate patch:', error);
      showError('Kunne ikke oppdatere kandidat', 3000);
      return false;
    }
  };

  const handleStatusUpdate = async (candidate: Candidate, status: StatusFilter) => {
    await saveCandidatePatch(candidate, { status }, `${candidate.name} satt til ${getStatusLabel(status)}`);
  };

  const handleBulkStatusUpdate = async (status: StatusFilter) => {
    const selectedCandidates = validCandidates.filter((candidate) => selectedIds.has(candidate.id));
    if (selectedCandidates.length === 0) {
      showInfo('Velg minst én kandidat først', 2500);
      return;
    }
    try {
      await Promise.all(selectedCandidates.map((candidate) => {
        const updatedCandidate: Candidate = {
          ...candidate,
          status,
          updatedAt: new Date().toISOString(),
        };
        return castingService.saveCandidate(projectId, updatedCandidate);
      }));
      onCandidatesChange();
      showSuccess(`${selectedCandidates.length} kandidater satt til ${getStatusLabel(status)}`, 3000);
    } catch (error) {
      console.error('Failed bulk status update:', error);
      showError('Kunne ikke oppdatere status for alle valgte kandidater', 3500);
    }
  };

  const handleSaveProPreset = () => {
    try {
      localStorage.setItem(
        proViewNamespace,
        JSON.stringify({
          sortField: proSortField,
          sortDirection: proSortDirection,
          groupBy: proGroupBy,
          preset: 'custom',
        }),
      );
      setProPreset('custom');
      showSuccess('Egendefinert pro-visning lagret', 2200);
    } catch (error) {
      console.error('Failed saving custom Pro View:', error);
      showError('Kunne ikke lagre egendefinert visning', 2600);
    }
  };

  const handleApplyProPreset = (preset: ProPreset) => {
    setProPreset(preset);
    if (preset === 'casting') {
      setProSortField('fitScore');
      setProSortDirection('desc');
      setProGroupBy('status');
      setStatusFilter('all');
    } else if (preset === 'compliance') {
      setProSortField('updatedAt');
      setProSortDirection('asc');
      setProGroupBy('status');
    } else if (preset === 'final') {
      setProSortField('fitScore');
      setProSortDirection('desc');
      setProGroupBy('none');
    }
  };

  const setSelectedCandidatePhotos = async (
    updater: (photos: string[], focalPoints: Array<{ x: number; y: number }>) => {
      photos: string[];
      focalPoints: Array<{ x: number; y: number }>;
    },
    successMessage: string,
  ) => {
    if (!selectedCandidate) return;
    const photos = Array.isArray(selectedCandidate.photos) ? [...selectedCandidate.photos] : [];
    const focalPoints = Array.isArray(selectedCandidate.photoFocalPoints)
      ? [...selectedCandidate.photoFocalPoints]
      : photos.map(() => ({ x: 50, y: 50 }));
    const next = updater(photos, focalPoints);
    setProMediaBusy(true);
    await saveCandidatePatch(
      selectedCandidate,
      {
        photos: next.photos,
        photoFocalPoints: next.focalPoints,
      },
      successMessage,
    );
    setProMediaBusy(false);
  };

  const handleSetPrimaryPhoto = async (photoIndex: number) => {
    if (!selectedCandidate || !selectedCandidate.photos || photoIndex <= 0) return;
    await setSelectedCandidatePhotos((photos, focalPoints) => {
      const nextPhotos = [...photos];
      const [primaryPhoto] = nextPhotos.splice(photoIndex, 1);
      nextPhotos.unshift(primaryPhoto);
      const nextFocalPoints = [...focalPoints];
      const [primaryFocal] = nextFocalPoints.splice(photoIndex, 1);
      nextFocalPoints.unshift(primaryFocal || { x: 50, y: 50 });
      return { photos: nextPhotos, focalPoints: nextFocalPoints };
    }, 'Primærbilde oppdatert');
    setActivePhotoIndex(0);
  };

  const handleDeletePhoto = async (photoIndex: number) => {
    if (!selectedCandidate || !selectedCandidate.photos || selectedCandidate.photos.length === 0) return;
    await setSelectedCandidatePhotos((photos, focalPoints) => {
      if (photoIndex < 0 || photoIndex >= photos.length) return { photos, focalPoints };
      const nextPhotos = [...photos];
      nextPhotos.splice(photoIndex, 1);
      const nextFocalPoints = [...focalPoints];
      nextFocalPoints.splice(photoIndex, 1);
      return { photos: nextPhotos, focalPoints: nextFocalPoints };
    }, 'Bilde slettet');
    if (activePhotoIndex > 0 && photoIndex <= activePhotoIndex) {
      setActivePhotoIndex((prev) => Math.max(0, prev - 1));
    }
  };

  const handleSetFocalPoint = async (event: any) => {
    if (!selectedCandidate || !selectedCandidate.photos || !selectedCandidate.photos[activePhotoIndex]) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    await setSelectedCandidatePhotos((photos, focalPoints) => {
      const nextFocalPoints = [...focalPoints];
      while (nextFocalPoints.length < photos.length) {
        nextFocalPoints.push({ x: 50, y: 50 });
      }
      nextFocalPoints[activePhotoIndex] = { x: Math.round(x), y: Math.round(y) };
      return { photos, focalPoints: nextFocalPoints };
    }, 'Fokuspunkt oppdatert');
  };

  const handleDeleteWithUndo = async (candidate: Candidate) => {
    setLastDeleted(candidate);
    try {
      await castingService.deleteCandidate(projectId, candidate.id);
      onCandidatesChange();
      setUndoSnackbarOpen(true);
      showInfo(`🗑️ ${candidate.name} slettet - klikk "Angre" for å gjenopprette`, 6000);
    } catch (error) {
      console.error('Failed to delete candidate:', error);
      setLastDeleted(null);
    }
  };

  const handleUndoDelete = async () => {
    if (lastDeleted) {
      try {
        await castingService.saveCandidate(projectId, lastDeleted);
        onCandidatesChange();
        showSuccess(`↩️ ${lastDeleted.name} gjenopprettet`, 3000);
      } catch (error) {
        console.error('Failed to restore candidate:', error);
      }
      setLastDeleted(null);
    }
    setUndoSnackbarOpen(false);
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Er du sikker på at du vil slette ${selectedIds.size} kandidater?`)) {
      const count = selectedIds.size;
      try {
        await Promise.all(
          Array.from(selectedIds).map(id => castingService.deleteCandidate(projectId, id))
        );
        onCandidatesChange();
        setSelectedIds(new Set());
        showInfo(`🗑️ ${count} kandidater slettet`, 4000);
      } catch (error) {
        console.error('Failed to bulk delete candidates:', error);
      }
    }
  };

  const handleOpenPreviewDialog = () => {
    const candidatesToAdd = selectedIds.size > 0
      ? validCandidates.filter(c => selectedIds.has(c.id))
      : validCandidates.filter(c => c.status === 'confirmed' || c.status === 'selected');
    
    if (candidatesToAdd.length === 0) {
      showInfo('Ingen kandidater å legge til. Velg kandidater eller bekreft noen først.', 4000);
      return;
    }

    setCandidatesToPreview(candidatesToAdd);
    setPreviewDialogOpen(true);
  };

  const handleClosePreviewDialog = () => {
    setPreviewDialogOpen(false);
    setCandidatesToPreview([]);
  };

  const handleConfirmAddToScene = async () => {
    if (candidatesToPreview.length === 0) return;

    setAddingToScene(true);
    try {
      const selectedPreset = LIGHTING_PRESETS.find(p => p.id === 'three-point');
      
      const options: {
        lightingPreset?: typeof selectedPreset;
      } = {};

      if (selectedPreset) {
        options.lightingPreset = selectedPreset;
      }
      
      const result = await castingToSceneService.addMultipleCandidatesToScene(
        candidatesToPreview,
        safeRoles,
        Object.keys(options).length > 0 ? options : undefined
      );
      
      if (result.success) {
        const presetName = selectedPreset?.name || 'standard';
        const message = `${result.candidatesAdded} kandidat(er) lagt til med "${presetName}" belysning!`;
        showSuccess(message, 4000);
        if (result.avatarsGenerated > 0) {
          showInfo(`Genererer ${result.avatarsGenerated} avatar(er) fra bilder...`, 5000);
        }
        setSelectedIds(new Set());
        handleClosePreviewDialog();
      } else {
        showError(`Kunne ikke legge til kandidater: ${result.errors.join(', ')}`, 5000);
      }
    } catch (error) {
      console.error('Error adding to scene:', error);
      showError('En feil oppstod ved overføring til 3D-scene', 4000);
    } finally {
      setAddingToScene(false);
    }
  };

  const handleRemoveFromPreview = (candidateId: string) => {
    setCandidatesToPreview(prev => prev.filter(c => c.id !== candidateId));
  };

  const handleDuplicate = async (candidate: Candidate) => {
    const newCandidate: Candidate = {
      ...candidate,
      id: `candidate-${Date.now()}`,
      name: `${candidate.name} (kopi)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await castingService.saveCandidate(projectId, newCandidate);
      onCandidatesChange();
    } catch (error) {
      console.error('Failed to duplicate candidate:', error);
    }
  };

  const handleSaveToPool = async (candidate: Candidate) => {
    try {
      const poolId = await candidatePoolService.saveCandidateToPool(candidate.id);
      if (poolId) {
        showSuccess(`${candidate.name} lagret til kandidatpool`, 3000);
        loadPoolCandidates();
      } else {
        showError('Kunne ikke lagre til pool', 3000);
      }
    } catch (error) {
      console.error('Error saving to pool:', error);
      showError('En feil oppstod', 3000);
    }
  };

  const loadPoolCandidates = async () => {
    setPoolLoading(true);
    try {
      const candidates = await candidatePoolService.getPoolCandidates();
      setPoolCandidates(candidates);
    } catch (error) {
      console.error('Error loading pool candidates:', error);
    } finally {
      setPoolLoading(false);
    }
  };

  useEffect(() => {
    loadPoolCandidates();
  }, []);

  const handleImportFromPool = async (poolCandidate: PoolCandidate) => {
    try {
      const newId = await candidatePoolService.importToProject(poolCandidate.id, projectId);
      if (newId) {
        showSuccess(`${poolCandidate.name} importert til prosjektet`, 3000);
        onCandidatesChange();
        setPoolMode('project');
      } else {
        showError('Kunne ikke importere kandidat', 3000);
      }
    } catch (error) {
      console.error('Error importing from pool:', error);
      showError('En feil oppstod', 3000);
    }
  };

  const handleDeleteFromPool = async (poolCandidateId: string) => {
    try {
      const success = await candidatePoolService.deleteFromPool(poolCandidateId);
      if (success) {
        showSuccess('Kandidat fjernet fra pool', 3000);
        loadPoolCandidates();
      } else {
        showError('Kunne ikke slette fra pool', 3000);
      }
    } catch (error) {
      console.error('Error deleting from pool:', error);
      showError('En feil oppstod', 3000);
    }
  };

  const handleExportCSV = () => {
    try {
      const project = castingService.getProject(projectId);
      if (!project) {
        showError('❌ Prosjekt ikke funnet');
        return;
      }

      const htmlContent = generateCandidatesHTML(project, filteredAndSortedCandidates, safeRoles);

      // Create a new window for printing/viewing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showError('⚠️ Kunne ikke åpne eksport-vindu. Vennligst tillat popups.');
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Trigger print (which allows saving as PDF)
      setTimeout(() => {
        printWindow.print();
      }, 250);

      showSuccess('📄 Eksport klar - velg "Lagre som PDF" i utskriftsdialogen', 5000);
    } catch (error) {
      console.error('Error exporting candidates:', error);
      showError('❌ Kunne ikke eksportere kandidater');
    }
  };

  const generateCandidatesHTML = (project: any, candidates: Candidate[], roles: Role[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calculate summary statistics
    const totalCandidates = candidates.length;
    const confirmedCandidates = candidates.filter(c => c.status === 'confirmed').length;
    const selectedCandidates = candidates.filter(c => c.status === 'selected').length;
    const confirmedPercent = totalCandidates > 0 ? Math.round((confirmedCandidates / totalCandidates) * 100) : 0;

    // SVG Icon for candidates (Person)
    const candidateIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>`;

    const getStatusBadgeClass = (status: Candidate['status']): string => {
      const classes: Record<string, string> = {
        pending: 'badge-pending',
        requested: 'badge-requested',
        shortlist: 'badge-shortlist',
        selected: 'badge-selected',
        confirmed: 'badge-confirmed',
        rejected: 'badge-rejected',
      };
      return classes[status] || 'badge-pending';
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.name} - Kandidater</title>
  <style>
    @page {
      margin: 0;
      counter-increment: page;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1a1a1a;
      line-height: 1.7;
      padding: 0;
      background: #fff;
      font-size: 14px;
    }
    .page {
      padding: 50px 60px 80px 60px;
      max-width: 210mm;
      margin: 0 auto;
      min-height: 297mm;
      position: relative;
    }
    .header {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-bottom: 5px solid #10b981;
      padding: 30px 35px;
      margin: -50px -60px 40px -60px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .title {
      font-size: 36px;
      font-weight: 800;
      color: #10b981;
      margin-bottom: 10px;
      letter-spacing: -1px;
      line-height: 1.2;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .title svg {
      flex-shrink: 0;
    }
    .subtitle {
      color: #64748b;
      font-size: 15px;
      font-weight: 500;
      margin-top: 5px;
    }
    .summary {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-left: 6px solid #10b981;
      padding: 30px;
      margin-bottom: 45px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .summary-title {
      font-size: 20px;
      font-weight: 700;
      color: #10b981;
      margin-bottom: 25px;
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .summary-title svg {
      flex-shrink: 0;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 25px;
    }
    .summary-item {
      background: white;
      padding: 25px 20px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }
    .summary-number {
      font-size: 36px;
      font-weight: 800;
      color: #10b981;
      display: block;
      margin-bottom: 8px;
      line-height: 1;
    }
    .summary-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 600;
      display: block;
    }
    .progress-bar {
      width: 100%;
      height: 6px;
      background: #e2e8f0;
      border-radius: 10px;
      margin-top: 10px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #059669 100%);
      border-radius: 10px;
    }
    .section {
      margin-bottom: 50px;
      page-break-inside: avoid;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 22px;
      padding-bottom: 15px;
      border-bottom: 3px solid #e2e8f0;
    }
    .section-title {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 12px;
      letter-spacing: -0.4px;
    }
    .section-icon {
      display: inline-flex;
      align-items: center;
    }
    .section-icon svg {
      flex-shrink: 0;
    }
    .section-count {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      background: #f1f5f9;
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
    }
    .section-content {
      background: #fafbfc;
      padding: 0;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      font-weight: 700;
      padding: 18px 20px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border: none;
    }
    th:first-child {
      border-top-left-radius: 10px;
    }
    th:last-child {
      border-top-right-radius: 10px;
    }
    td {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      font-size: 14px;
      font-weight: 400;
      vertical-align: top;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-pending { background: #f59e0b; color: white; }
    .badge-requested { background: #00d4ff; color: white; }
    .badge-shortlist { background: #8b5cf6; color: white; }
    .badge-selected { background: #10b981; color: white; }
    .badge-confirmed { background: #10b981; color: white; }
    .badge-rejected { background: #ef4444; color: white; }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 15px 60px;
      border-top: 2px solid #e2e8f0;
      background: #fafbfc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .footer-left {
      display: flex;
      gap: 20px;
    }
    .footer-right {
      display: flex;
      gap: 20px;
    }
    .page-number {
      font-weight: 600;
    }
    .page-number::after {
      content: counter(page);
    }
    .empty-state {
      padding: 50px;
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      font-size: 15px;
    }
    @media print {
      .page {
        padding: 30px 40px 70px 40px;
      }
      .section {
        page-break-inside: avoid;
        margin-bottom: 35px;
      }
      .summary {
        page-break-inside: avoid;
      }
      .footer {
        padding: 12px 40px;
      }
      .header {
        margin: -30px -40px 35px -40px;
        padding: 25px 30px;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title">
        ${candidateIconSVG}
        ${project.name} - Kandidater
      </div>
      <div class="subtitle">Eksportert: ${dateStr}</div>
    </div>

    <div class="summary">
      <div class="summary-title">
        ${candidateIconSVG}
        Oversikt
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalCandidates}</span>
          <span class="summary-label">Totale Kandidater</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${selectedCandidates}</span>
          <span class="summary-label">Valgte Kandidater</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${confirmedCandidates}</span>
          <span class="summary-label">Bekreftede Kandidater</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${confirmedPercent}%"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${candidateIconSVG}</span>
          Kandidater
        </div>
        <span class="section-count">${totalCandidates} kandidat${totalCandidates !== 1 ? 'er' : ''}</span>
      </div>
      <div class="section-content">
        ${
          candidates.length === 0
            ? '<div class="empty-state">Ingen kandidater ennå</div>'
            : `<table>
          <thead>
            <tr>
              <th style="width: 20%;">Navn</th>
              <th style="width: 18%;">E-post</th>
              <th style="width: 12%;">Telefon</th>
              <th style="width: 12%;">Status</th>
              <th style="width: 25%;">Roller</th>
              <th style="width: 13%;">Opprettet</th>
            </tr>
          </thead>
          <tbody>
            ${candidates
              .map(
                (c) => {
                  const contactInfo = getCandidateContactInfo(c);
                  const rolesList = getCandidateAssignedRoles(c).map(rid => roles.find(r => r.id === rid)?.name || '').filter(Boolean).join(', ') || '-';
                  return `<tr>
              <td><strong>${c.name}</strong></td>
              <td style="font-size: 13px;">${contactInfo.email || '-'}</td>
              <td style="font-size: 13px;">${contactInfo.phone || '-'}</td>
              <td><span class="badge ${getStatusBadgeClass(c.status)}">${getStatusLabel(c.status)}</span></td>
              <td style="font-size: 13px;">${rolesList.length > 60 ? rolesList.substring(0, 60) + '...' : rolesList}</td>
              <td style="font-size: 13px;">${new Date(c.createdAt).toLocaleDateString('nb-NO')}</td>
            </tr>`;
                }
              )
              .join('')}
          </tbody>
        </table>`
        }
      </div>
    </div>

    <div class="footer">
      <div class="footer-left">
        <span>${project.name}</span>
        <span>|</span>
        <span>ID: ${project.id.substring(0, 8)}</span>
      </div>
      <div class="footer-right">
        <span class="page-number">Side </span>
        <span>|</span>
        <span>${dateStr}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  const toggleCardExpanded = (id: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const getRoleName = (roleId: string) => safeRoles.find(r => r.id === roleId)?.name || 'Ukjent rolle';

  const renderProCandidateCard = (candidate: Candidate) => {
    const isSelectedCard = selectedCandidateId === candidate.id;
    const fitScore = candidateFitScores.get(candidate.id) || 0;
    return (
      <Card
        key={candidate.id}
        onClick={() => setSelectedCandidateId(candidate.id)}
        sx={{
          cursor: 'pointer',
          bgcolor: isSelectedCard ? 'rgba(184,107,255,0.16)' : roleSurfaceMuted,
          border: isSelectedCard ? `1px solid ${roleTabAccent}` : `1px solid ${roleBorder}`,
          borderRadius: 1.5,
          transition: 'all 0.2s ease',
          '&:hover': { borderColor: roleTabAccentSoft, transform: 'translateY(-1px)' },
        }}
      >
        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              src={candidate.photos?.[0]}
              sx={{
                width: 40,
                height: 40,
                bgcolor: `${getStatusColor(candidate.status)}20`,
                border: `1px solid ${roleBorder}`,
                '& .MuiAvatar-img': {
                  objectPosition: getCandidatePhotoObjectPosition(candidate, 0),
                },
              }}
            >
              <PersonIcon sx={{ color: getStatusColor(candidate.status), fontSize: 20 }} />
            </Avatar>
            <Checkbox
              checked={selectedIds.has(candidate.id)}
              onChange={() => handleToggleSelect(candidate.id)}
              onClick={(event) => event.stopPropagation()}
              sx={{ p: 0.25, color: roleTextMuted, '&.Mui-checked': { color: roleTabAccent } }}
            />
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                toggleFavorite(candidate.id);
              }}
              sx={{ color: favorites.has(candidate.id) ? '#ffc107' : 'rgba(255,255,255,0.3)', minWidth: 30, minHeight: 30 }}
            >
              {favorites.has(candidate.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
            <Tooltip title={quickContacts.has(candidate.id) ? 'Fjern fra hurtigkontakt' : 'Legg til hurtigkontakt'}>
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleQuickContact(candidate.id);
                }}
                sx={{
                  color: quickContacts.has(candidate.id) ? quickContactColor : quickContactColorMuted,
                  bgcolor: quickContacts.has(candidate.id) ? quickContactBackground : 'transparent',
                  border: quickContacts.has(candidate.id) ? `1px solid ${quickContactColorMuted}` : '1px solid transparent',
                  minWidth: 30,
                  minHeight: 30,
                  '&:hover': { bgcolor: quickContactBackground },
                }}
              >
                <QuickContactIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ color: roleText, fontWeight: 700 }} noWrap>
                {candidate.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
                <Chip
                  label={getStatusLabel(candidate.status)}
                  size="small"
                  sx={{
                    bgcolor: `${getStatusColor(candidate.status)}22`,
                    color: getStatusColor(candidate.status),
                    fontWeight: 700,
                    height: 22,
                  }}
                />
                <Chip label={`${getCandidateAssignedRoles(candidate).length} roller`} size="small" sx={{ height: 22 }} />
                <Chip
                  icon={<TuneIcon sx={{ color: `${roleTabAccent} !important`, fontSize: '0.9rem' }} />}
                  label={`Treffscore ${fitScore}`}
                  size="small"
                  sx={{ height: 22, bgcolor: 'rgba(184,107,255,0.14)', color: roleTabAccent, border: `1px solid ${roleBorder}` }}
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={fitScore}
                sx={{
                  mt: 0.75,
                  height: 6,
                  borderRadius: 999,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '& .MuiLinearProgress-bar': { bgcolor: roleTabAccent },
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              <Tooltip title="Rediger">
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditCandidate(candidate);
                  }}
                  sx={{ color: roleTabAccent, minWidth: 30, minHeight: 30 }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Dupliser">
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDuplicate(candidate);
                  }}
                  sx={{ color: roleTextMuted, minWidth: 30, minHeight: 30 }}
                >
                  <DuplicateIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{
        p: containerPadding,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        borderRadius: 2,
        border: `1px solid ${roleBorder}`,
        backgroundColor: roleSurface,
        backgroundImage: `
          linear-gradient(160deg, rgba(39,24,77,0.84) 0%, rgba(16,10,36,0.92) 62%, rgba(15,8,30,0.95) 100%)
        `,
      }}
    >
      {/* Header with Icon and Title - Enhanced to match ProductionDayView */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, flexWrap: 'wrap', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            py: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 },
          }}
        >
          <Box
            sx={{
              width: { xs: 48, sm: 56, md: 52, lg: 60, xl: 68 },
              height: { xs: 48, sm: 56, md: 52, lg: 60, xl: 68 },
              borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              background: 'linear-gradient(135deg, rgba(184,107,255,0.28) 0%, rgba(94,58,184,0.2) 100%)',
              border: '2px solid rgba(184,107,255,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(184,107,255,0.24)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 16px rgba(184,107,255,0.34)',
              },
            }}
          >
            <RecentActorsIcon
              sx={{
                color: roleTabAccent,
                fontSize: { xs: 26, sm: 32, md: 30, lg: 36, xl: 42 },
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
            />
          </Box>
          <Box>
            <Typography
              variant="h5"
              component="h2"
              id={titleId}
              sx={{
                color: '#fff',
                fontWeight: 800,
                fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.4rem', lg: '1.6rem', xl: '2rem' },
                lineHeight: 1.2,
                letterSpacing: '-0.5px',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                background: 'linear-gradient(135deg, #fff 0%, #d9c0ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Casting-kandidater
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.87)',
                fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' },
                fontWeight: 500,
                mt: 0.25,
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
              }}
            >
              <PersonSearchIcon sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 17, xl: 20 }, opacity: 0.7 }} />
              Administrer kandidater og auditions
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 }, flexWrap: 'wrap' }}>
          <Tooltip title="Eksporter til CSV (Ctrl+E)">
            <Button
              variant="outlined"
              startIcon={<ExportIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              onClick={handleExportCSV}
              sx={{
                borderColor: roleBorder,
                color: roleText,
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                '&:hover': { borderColor: roleTabAccent, bgcolor: roleTabAccentSoft },
                ...focusVisibleStyles,
              }}
            >
              {!isMobile && 'Eksporter'}
            </Button>
          </Tooltip>
          <Tooltip title="Vis statistikk">
            <Button
              variant={showStats ? 'contained' : 'outlined'}
              startIcon={<StatsIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              onClick={() => setShowStats(!showStats)}
              sx={{
                borderColor: roleBorder,
                color: showStats ? '#160a24' : roleText,
                bgcolor: showStats ? roleTabAccent : 'transparent',
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                '&:hover': {
                  bgcolor: showStats ? roleTabAccentHover : roleTabAccentSoft,
                  borderColor: roleTabAccent,
                },
                ...focusVisibleStyles,
              }}
            >
              {!isMobile && 'Statistikk'}
            </Button>
          </Tooltip>
          <Tooltip title={selectedIds.size > 0 ? `Forhåndsvis ${selectedIds.size} valgte før scene` : 'Forhåndsvis bekreftede/valgte før scene'}>
            <Button
              variant="outlined"
              startIcon={<PreviewIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              onClick={handleOpenPreviewDialog}
              disabled={addingToScene}
              sx={{
                borderColor: roleBorder,
                color: roleTabAccent,
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                '&:hover': {
                  borderColor: roleTabAccent,
                  bgcolor: roleTabAccentSoft,
                },
                ...focusVisibleStyles,
              }}
            >
              {addingToScene ? 'Legger til...' : (!isMobile && (selectedIds.size > 0 ? `Til scene (${selectedIds.size})` : 'Til scene'))}
            </Button>
          </Tooltip>
          <Tooltip title="Ny kandidat (Ctrl+N)">
            <Button
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              onClick={onCreateCandidate}
              sx={{
                bgcolor: roleTabAccent,
                color: '#160a24',
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                '&:hover': { bgcolor: roleTabAccentHover },
                ...focusVisibleStyles,
              }}
            >
              {isMobile ? '' : 'Ny kandidat'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Project/Templates Toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          mb: 2,
          p: 1,
          bgcolor: roleSurfaceMuted,
          borderRadius: 1.5,
          border: `1px solid ${roleBorder}`,
        }}
      >
        <Typography sx={{ color: roleTextMuted, fontSize: '0.875rem', mr: 1 }}>
          Vis:
        </Typography>
        <Button
          variant={poolMode === 'project' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setPoolMode('project')}
          sx={{
            minHeight: 36,
            bgcolor: poolMode === 'project' ? roleTabAccentSoft : 'transparent',
            color: poolMode === 'project' ? roleTabAccent : 'rgba(255,255,255,0.7)',
            borderColor: poolMode === 'project' ? roleTabAccent : roleBorder,
            '&:hover': {
              bgcolor: poolMode === 'project' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Prosjektkandidater ({validCandidates.length})
        </Button>
        <Button
          variant={poolMode === 'pool' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => { setPoolMode('pool'); loadPoolCandidates(); }}
          sx={{
            minHeight: 36,
            bgcolor: poolMode === 'pool' ? roleTabAccentSoft : 'transparent',
            color: poolMode === 'pool' ? roleTabAccent : 'rgba(255,255,255,0.7)',
            borderColor: poolMode === 'pool' ? roleTabAccent : roleBorder,
            '&:hover': {
              bgcolor: poolMode === 'pool' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Maler ({poolCandidates.length})
        </Button>
      </Box>

      {/* Workspace View Toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          mb: 2,
          p: 1,
          bgcolor: roleSurfaceMuted,
          borderRadius: 1.5,
          border: `1px solid ${roleBorder}`,
        }}
      >
        <Typography sx={{ color: roleTextMuted, fontSize: '0.875rem', mr: 1 }}>
          Visning:
        </Typography>
        <Button
          variant={workspaceView === 'standard' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setWorkspaceView('standard')}
          sx={{
            minHeight: 36,
            bgcolor: workspaceView === 'standard' ? roleTabAccentSoft : 'transparent',
            color: workspaceView === 'standard' ? roleTabAccent : 'rgba(255,255,255,0.7)',
            borderColor: workspaceView === 'standard' ? roleTabAccent : roleBorder,
            '&:hover': {
              bgcolor: workspaceView === 'standard' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Standard
        </Button>
        <Button
          variant={workspaceView === 'pro' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setWorkspaceView('pro')}
          sx={{
            minHeight: 36,
            bgcolor: workspaceView === 'pro' ? roleTabAccentSoft : 'transparent',
            color: workspaceView === 'pro' ? roleTabAccent : 'rgba(255,255,255,0.7)',
            borderColor: workspaceView === 'pro' ? roleTabAccent : roleBorder,
            '&:hover': {
              bgcolor: workspaceView === 'pro' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Pro-visning
        </Button>
      </Box>

      {workspaceView === 'pro' && (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: '1.4fr auto auto auto' },
              gap: 1,
              mb: 1.5,
              p: 1.25,
              borderRadius: 1.5,
              border: `1px solid ${roleBorder}`,
              bgcolor: roleSurfaceMuted,
              alignItems: 'center',
            }}
          >
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {([
                  { id: 'casting', label: 'Casting' },
                  { id: 'compliance', label: 'Etterlevelse' },
                  { id: 'final', label: 'Endelig utvalg' },
                  { id: 'custom', label: 'Egendefinert' },
                ] as Array<{ id: ProPreset; label: string }>).map((preset) => (
                <Button
                  key={preset.id}
                  size="small"
                  variant={proPreset === preset.id ? 'contained' : 'outlined'}
                  onClick={() => handleApplyProPreset(preset.id)}
                  sx={{
                    minHeight: 34,
                    color: proPreset === preset.id ? '#160a24' : roleText,
                    bgcolor: proPreset === preset.id ? roleTabAccent : 'transparent',
                    borderColor: roleBorder,
                    '&:hover': { bgcolor: proPreset === preset.id ? roleTabAccentHover : roleTabAccentSoft },
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </Stack>
            <FormControl size="small">
              <Select
                value={proSortField}
                onChange={(event) => setProSortField(event.target.value as ProSortField)}
                sx={{
                  color: roleText,
                  bgcolor: roleSurface,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
                }}
              >
                <MenuItem value="fitScore">Sorter: Treffscore</MenuItem>
                <MenuItem value="name">Sorter: Navn</MenuItem>
                <MenuItem value="status">Sorter: Status</MenuItem>
                <MenuItem value="updatedAt">Sorter: Oppdatert</MenuItem>
                <MenuItem value="createdAt">Sorter: Opprettet</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small">
              <Select
                value={proGroupBy}
                onChange={(event) => setProGroupBy(event.target.value as ProGroupBy)}
                sx={{
                  color: roleText,
                  bgcolor: roleSurface,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
                }}
              >
                <MenuItem value="status">Grupper: Status</MenuItem>
                <MenuItem value="none">Grupper: Ingen</MenuItem>
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setProSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                sx={{ color: roleText, borderColor: roleBorder }}
              >
                {proSortDirection === 'asc' ? 'Stigende' : 'Synkende'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleSaveProPreset}
                sx={{ color: roleTabAccent, borderColor: roleBorder }}
              >
                Lagre egendefinert
              </Button>
            </Stack>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: '320px minmax(0, 1fr) 380px' },
              gap: 2,
              mb: 2.5,
              minHeight: {
                xs: 'auto',
                lg: 'clamp(620px, 70vh, 820px)',
              },
            }}
          >
            <Box
              sx={{
                border: `1px solid ${roleBorder}`,
                borderRadius: 2,
                bgcolor: roleSurface,
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                minHeight: { lg: 0 },
              }}
            >
              <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '1.1rem' }}>
                Kandidatpool
              </Typography>
              <TextField
                size="small"
                value={poolSearchQuery}
                onChange={(event) => setPoolSearchQuery(event.target.value)}
                placeholder="Søk kandidater..."
                slotProps={{
                  input: {
                    startAdornment: <SearchIcon sx={{ color: roleTextMuted, mr: 1, fontSize: 18 }} />,
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: roleText,
                    bgcolor: roleSurfaceMuted,
                    '& fieldset': { borderColor: roleBorder },
                    '&:hover fieldset': { borderColor: roleTabAccentSoft },
                    '&.Mui-focused fieldset': { borderColor: roleTabAccent },
                  },
                }}
              />
              <Box sx={{ p: 1, borderRadius: 1.25, bgcolor: 'rgba(184,107,255,0.1)', border: `1px solid ${roleBorder}` }}>
                <Typography sx={{ color: roleText, fontSize: '0.8rem', fontWeight: 700, mb: 0.75 }}>Beste match nå</Typography>
                <Stack spacing={0.5}>
                  {proCandidates.slice(0, 3).map((candidate) => (
                    <Box key={`best-match-${candidate.id}`} sx={{ display: 'flex', justifyContent: 'space-between', color: roleTextMuted, fontSize: '0.78rem' }}>
                      <Typography sx={{ color: roleText, fontSize: '0.8rem' }} noWrap>{candidate.name}</Typography>
                      <Chip
                        size="small"
                        label={candidateFitScores.get(candidate.id) || 0}
                        sx={{ height: 20, bgcolor: roleTabAccentSoft, color: roleTabAccent, fontWeight: 700 }}
                      />
                    </Box>
                  ))}
                  {proCandidates.length === 0 && (
                    <Typography sx={{ color: roleTextMuted, fontSize: '0.78rem' }}>Ingen kandidater ennå.</Typography>
                  )}
                </Stack>
              </Box>
              <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0, pr: 0.5 }}>
                {poolLoading ? (
                  <Typography sx={{ color: roleTextMuted, py: 2 }}>Laster maler...</Typography>
                ) : filteredPoolCandidates.length === 0 ? (
                  <Typography sx={{ color: roleTextMuted, py: 2 }}>Ingen treff i kandidatpool.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {filteredPoolCandidates.map((poolCandidate) => (
                      <Card
                        key={poolCandidate.id}
                        sx={{
                          bgcolor: roleSurfaceMuted,
                          border: `1px solid ${roleBorder}`,
                          borderRadius: 1.5,
                        }}
                      >
                        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar
                              src={poolCandidate.photos?.[0]}
                              sx={{
                                width: 34,
                                height: 34,
                                bgcolor: 'rgba(184,107,255,0.16)',
                                border: `1px solid ${roleBorder}`,
                                '& .MuiAvatar-img': {
                                  objectPosition: getCandidatePhotoObjectPosition(poolCandidate, 0),
                                },
                              }}
                            >
                              <PersonIcon sx={{ color: roleTabAccent, fontSize: 18 }} />
                            </Avatar>
                            <Typography sx={{ color: roleText, fontWeight: 600, fontSize: '0.9rem' }}>
                              {poolCandidate.name}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                            <Button
                              size="small"
                              onClick={() => handleImportFromPool(poolCandidate)}
                              sx={{ color: roleTabAccent, minHeight: 34 }}
                            >
                              Importer
                            </Button>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteFromPool(poolCandidate.id)}
                              sx={{ color: roleTextMuted, minWidth: 34, minHeight: 34 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Box>
              <Button
                variant="outlined"
                onClick={() => setPoolMode('pool')}
                sx={{
                  mt: 'auto',
                  color: roleTabAccent,
                  borderColor: roleBorder,
                  '&:hover': { borderColor: roleTabAccent, bgcolor: roleTabAccentSoft },
                }}
              >
                Åpne mal-visning
              </Button>
            </Box>

            <Box
              sx={{
                border: `1px solid ${roleBorder}`,
                borderRadius: 2,
                bgcolor: roleSurface,
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                minHeight: { lg: 0 },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '1.35rem' }}>
                  Prosjektkandidater
                </Typography>
                <Button
                  variant="contained"
                  onClick={onCreateCandidate}
                  sx={{
                    bgcolor: roleTabAccent,
                    color: '#160a24',
                    fontWeight: 700,
                    '&:hover': { bgcolor: roleTabAccentHover },
                  }}
                >
                  Ny kandidat
                </Button>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.25fr 0.9fr auto auto' }, gap: 1 }}>
                <TextField
                  size="small"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Søk kandidater..."
                  slotProps={{
                    input: {
                      startAdornment: <SearchIcon sx={{ color: roleTextMuted, mr: 1, fontSize: 18 }} />,
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: roleText,
                      bgcolor: roleSurfaceMuted,
                      '& fieldset': { borderColor: roleBorder },
                      '&:hover fieldset': { borderColor: roleTabAccentSoft },
                      '&.Mui-focused fieldset': { borderColor: roleTabAccent },
                    },
                  }}
                />
                <FormControl size="small">
                  <Select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    sx={{
                      color: roleText,
                      bgcolor: roleSurfaceMuted,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
                    }}
                  >
                    <MenuItem value="all">Alle statuser</MenuItem>
                    <MenuItem value="pending">Venter</MenuItem>
                    <MenuItem value="requested">Forespurt</MenuItem>
                    <MenuItem value="shortlist">Kortliste</MenuItem>
                    <MenuItem value="selected">Valgt</MenuItem>
                    <MenuItem value="confirmed">Bekreftet</MenuItem>
                    <MenuItem value="rejected">Avvist</MenuItem>
                  </Select>
                </FormControl>
                <Chip
                  label={`${proCandidates.length} kandidater`}
                  sx={{
                    color: roleTabAccent,
                    bgcolor: 'rgba(184,107,255,0.14)',
                    border: `1px solid ${roleBorder}`,
                    fontWeight: 600,
                  }}
                />
                <Chip
                  label="J/K naviger • E rediger • F favoritt • Space velg • Cmd+Enter bekreft"
                  sx={{
                    color: roleTextMuted,
                    bgcolor: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${roleBorder}`,
                    fontWeight: 500,
                    maxWidth: '100%',
                  }}
                />
              </Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                {proListItems.length === 0 ? (
                  <Typography sx={{ color: roleTextMuted, py: 2 }}>Ingen kandidater matcher filter.</Typography>
                ) : (
                  <Virtuoso
                    style={{ height: '100%' }}
                    data={proListItems}
                    itemContent={(_, item) => {
                      if (item.type === 'header') {
                        return (
                          <Box
                            sx={{
                              py: 0.75,
                              px: 1,
                              mt: 1,
                              mb: 0.75,
                              borderRadius: 1,
                              bgcolor: 'rgba(184,107,255,0.12)',
                              border: `1px solid ${roleBorder}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '0.85rem' }}>{item.label}</Typography>
                            <Chip label={item.count} size="small" sx={{ height: 20, bgcolor: roleSurface, color: roleText }} />
                          </Box>
                        );
                      }
                      return <Box sx={{ pb: 1 }}>{renderProCandidateCard(item.candidate)}</Box>;
                    }}
                  />
                )}
              </Box>
            </Box>

            <Box
              sx={{
                border: `1px solid ${roleBorder}`,
                borderRadius: 2,
                bgcolor: roleSurface,
                p: 1.25,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                minHeight: { lg: 0 },
              }}
            >
              {selectedCandidate ? (
                <>
                  <Tabs
                    value={proDetailTab}
                    onChange={(_, value) => setProDetailTab(value as ProDetailTab)}
                    variant="scrollable"
                    allowScrollButtonsMobile
                    sx={{
                      minHeight: 38,
                      '& .MuiTab-root': { color: roleTextMuted, minHeight: 38, textTransform: 'none', fontWeight: 600, px: 1.25 },
                      '& .Mui-selected': { color: roleTabAccent },
                      '& .MuiTabs-indicator': { backgroundColor: roleTabAccent },
                    }}
                  >
                    <Tab value="overview" icon={<ViewCarouselIcon fontSize="small" />} iconPosition="start" label="Oversikt" />
                    <Tab value="media" icon={<CollectionsIcon fontSize="small" />} iconPosition="start" label="Bilder" />
                    <Tab value="videos" icon={<VideocamIcon fontSize="small" />} iconPosition="start" label="Video" />
                    <Tab value="consent" icon={<GavelIcon fontSize="small" />} iconPosition="start" label="Samtykke" />
                    <Tab value="history" icon={<TimelineIcon fontSize="small" />} iconPosition="start" label="Historikk" />
                    <Tab value="actions" icon={<TuneIcon fontSize="small" />} iconPosition="start" label="Handlinger" />
                    <Tab value="compare" icon={<CompareArrowsIcon fontSize="small" />} iconPosition="start" label={`Sammenlign (${compareCandidates.length})`} />
                  </Tabs>

                  {proDetailTab === 'overview' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {selectedCandidate.photos?.[0] && (
                        <Box
                          component="img"
                          src={selectedCandidate.photos[0]}
                          alt={selectedCandidate.name}
                          sx={{
                            width: '100%',
                            height: 170,
                            objectFit: 'cover',
                            objectPosition: getCandidatePhotoObjectPosition(selectedCandidate, 0),
                            borderRadius: 1.5,
                            border: `1px solid ${roleBorder}`,
                          }}
                        />
                      )}
                      <Typography sx={{ color: roleText, fontWeight: 800, fontSize: '1.2rem' }}>{selectedCandidate.name}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        <Chip label={getStatusLabel(selectedCandidate.status)} sx={{ bgcolor: `${getStatusColor(selectedCandidate.status)}24`, color: getStatusColor(selectedCandidate.status), fontWeight: 700 }} />
                        <Chip label={`${selectedCandidateAssignedRoles.length} roller`} sx={{ bgcolor: roleSurfaceMuted, color: roleText }} />
                        <Chip label={`Treffscore ${candidateFitScores.get(selectedCandidate.id) || 0}`} sx={{ bgcolor: roleTabAccentSoft, color: roleTabAccent, fontWeight: 700 }} />
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={candidateFitScores.get(selectedCandidate.id) || 0}
                        sx={{ height: 8, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: roleTabAccent } }}
                      />
                      <Typography sx={{ color: roleTextMuted, fontSize: '0.9rem' }}>
                        {selectedCandidateNotes || 'Ingen audition-notater lagt inn.'}
                      </Typography>
                      <Box>
                        <Typography sx={{ color: roleText, fontWeight: 600, mb: 0.5 }}>Kontakt</Typography>
                        <Typography sx={{ color: roleTextMuted, fontSize: '0.85rem' }}>
                          E-post: {selectedCandidateContact.email || 'Ikke satt'}
                        </Typography>
                        <Typography sx={{ color: roleTextMuted, fontSize: '0.85rem' }}>
                          Telefon: {selectedCandidateContact.phone || 'Ikke satt'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ color: roleText, fontWeight: 600, mb: 0.5 }}>Tilknyttede roller</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {selectedCandidateAssignedRoles.length > 0
                            ? selectedCandidateAssignedRoles.map((roleId) => (
                                <Chip key={roleId} label={getRoleName(roleId)} size="small" sx={{ bgcolor: roleTabAccentSoft, color: roleTabAccent }} />
                              ))
                            : <Typography sx={{ color: roleTextMuted, fontSize: '0.85rem' }}>Ingen roller satt</Typography>}
                        </Box>
                      </Box>
                    </Box>
                  )}

                  {proDetailTab === 'media' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {selectedCandidate.photos && selectedCandidate.photos.length > 0 ? (
                        <>
                          <Box
                            ref={focalPickerRef}
                            onClick={(event) => { void handleSetFocalPoint(event); }}
                            sx={{
                              position: 'relative',
                              borderRadius: 1.5,
                              overflow: 'hidden',
                              border: `1px solid ${roleBorder}`,
                              cursor: proMediaBusy ? 'wait' : 'crosshair',
                              opacity: proMediaBusy ? 0.7 : 1,
                            }}
                          >
                            <Box
                              component="img"
                              src={selectedCandidate.photos[selectedPhotoIndex]}
                              alt={`${selectedCandidate.name} ${selectedPhotoIndex + 1}`}
                              sx={{
                                width: '100%',
                                height: 230,
                                objectFit: 'cover',
                                objectPosition: `${selectedPhotoFocalPoint.x}% ${selectedPhotoFocalPoint.y}%`,
                              }}
                            />
                            <Box
                              sx={{
                                position: 'absolute',
                                left: `calc(${selectedPhotoFocalPoint.x}% - 11px)`,
                                top: `calc(${selectedPhotoFocalPoint.y}% - 11px)`,
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                border: '2px solid #fff',
                                boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                                pointerEvents: 'none',
                              }}
                            />
                            <Typography
                              sx={{
                                position: 'absolute',
                                left: 8,
                                bottom: 8,
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                bgcolor: 'rgba(0,0,0,0.6)',
                                color: '#fff',
                                fontSize: '0.75rem',
                              }}
                            >
                              Klikk for å sette fokuspunkt
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={proMediaBusy || selectedPhotoIndex === 0}
                              onClick={() => { void handleSetPrimaryPhoto(selectedPhotoIndex); }}
                              sx={{ color: roleText, borderColor: roleBorder }}
                            >
                              Sett som primær
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={proMediaBusy}
                              onClick={() => { void handleDeletePhoto(selectedPhotoIndex); }}
                            >
                              Slett bilde
                            </Button>
                          </Stack>
                          <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
                            {selectedCandidate.photos.map((photo, index) => (
                              <Box
                                key={`${selectedCandidate.id}-media-thumb-${index}`}
                                onClick={() => setActivePhotoIndex(index)}
                                sx={{
                                  minWidth: 64,
                                  width: 64,
                                  height: 64,
                                  borderRadius: 1.25,
                                  border: index === selectedPhotoIndex ? `2px solid ${roleTabAccent}` : `1px solid ${roleBorder}`,
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                }}
                              >
                                <Box
                                  component="img"
                                  src={photo}
                                  alt={`${selectedCandidate.name} thumb ${index + 1}`}
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    objectPosition: getCandidatePhotoObjectPosition(selectedCandidate, index),
                                  }}
                                />
                              </Box>
                            ))}
                          </Box>
                          <Typography sx={{ color: roleTextMuted, fontSize: '0.8rem' }}>
                            Fokuspunkt: {selectedPhotoFocalPoint.x}% x {selectedPhotoFocalPoint.y}%
                          </Typography>
                        </>
                      ) : (
                        <Typography sx={{ color: roleTextMuted }}>Ingen bilder lastet opp for kandidaten.</Typography>
                      )}
                    </Box>
                  )}

                  {proDetailTab === 'videos' && projectId && (
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <React.Suspense fallback={<Box sx={{ p: 3, textAlign: 'center' }}><Typography sx={{ color: roleTextMuted }}>Laster video-review…</Typography></Box>}>
                        {(() => {
                          const LazyCandidateVideoReview = React.lazy(() =>
                            import('./casting/CandidateVideoReview').then((m) => ({ default: m.CandidateVideoReview })),
                          );
                          return (
                            <LazyCandidateVideoReview
                              candidateId={selectedCandidate.id}
                              projectId={projectId}
                              candidateName={selectedCandidate.name}
                            />
                          );
                        })()}
                      </React.Suspense>
                    </Box>
                  )}

                  {proDetailTab === 'consent' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {(() => {
                        const consents = getCandidateConsents(selectedCandidate);
                        const completion = getConsentCompletionScore(selectedCandidate);
                        return (
                          <>
                            <Chip
                              icon={<RuleIcon />}
                              label={`Fullført ${completion}%`}
                              sx={{ alignSelf: 'flex-start', bgcolor: roleTabAccentSoft, color: roleTabAccent, fontWeight: 700 }}
                            />
                            <LinearProgress
                              variant="determinate"
                              value={completion}
                              sx={{ height: 8, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: roleTabAccent } }}
                            />
                            {consents.length === 0 ? (
                              <Typography sx={{ color: roleTextMuted, fontSize: '0.86rem' }}>Ingen samtykker registrert ennå.</Typography>
                            ) : (
                              <Stack spacing={0.75}>
                                {consents.map((consent, index) => (
                                  <Box
                                    key={`${selectedCandidate.id}-consent-${consent.id || index}`}
                                    sx={{
                                      p: 1,
                                      borderRadius: 1.25,
                                      bgcolor: roleSurfaceMuted,
                                      border: `1px solid ${roleBorder}`,
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      gap: 1,
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Box sx={{ minWidth: 0 }}>
                                      <Typography sx={{ color: roleText, fontWeight: 600, fontSize: '0.85rem' }} noWrap>
                                        {consent.title || consent.type || `Samtykke ${index + 1}`}
                                      </Typography>
                                      <Typography sx={{ color: roleTextMuted, fontSize: '0.76rem' }}>
                                        {consent.required ? 'Påkrevd' : 'Valgfri'} • {consent.signedAt ? `Signert ${new Date(consent.signedAt).toLocaleString('nb-NO')}` : 'Ikke signert'}
                                      </Typography>
                                    </Box>
                                    <Chip
                                      size="small"
                                      label={String(consent.status || 'pending')}
                                      sx={{ bgcolor: roleTabAccentSoft, color: roleTabAccent, textTransform: 'capitalize' }}
                                    />
                                  </Box>
                                ))}
                              </Stack>
                            )}
                            <Button
                              variant="outlined"
                              onClick={() => onEditCandidate(selectedCandidate)}
                              sx={{ color: roleTabAccent, borderColor: roleBorder, alignSelf: 'flex-start' }}
                            >
                              Åpne samtykkemodal
                            </Button>
                          </>
                        );
                      })()}
                    </Box>
                  )}

                  {proDetailTab === 'history' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {selectedCandidateHistory.length === 0 ? (
                        <Typography sx={{ color: roleTextMuted, fontSize: '0.86rem' }}>Ingen aktivitet registrert.</Typography>
                      ) : (
                        <Stack spacing={1}>
                          {selectedCandidateHistory.map((entry) => (
                            <Box
                              key={entry.id}
                              sx={{
                                p: 1,
                                borderRadius: 1.25,
                                bgcolor: roleSurfaceMuted,
                                border: `1px solid ${roleBorder}`,
                              }}
                            >
                              <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '0.84rem' }}>{entry.label}</Typography>
                              <Typography sx={{ color: roleTextMuted, fontSize: '0.76rem' }}>{entry.description}</Typography>
                              <Typography sx={{ color: roleTextMuted, fontSize: '0.72rem', mt: 0.25 }}>
                                {new Date(entry.date).toLocaleString('nb-NO')}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )}

                  {proDetailTab === 'actions' && (
                    <Stack spacing={1}>
                      <Button
                        variant="contained"
                        onClick={() => onEditCandidate(selectedCandidate)}
                        sx={{ bgcolor: roleTabAccent, color: '#160a24', fontWeight: 700, '&:hover': { bgcolor: roleTabAccentHover } }}
                      >
                        Rediger kandidat
                      </Button>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="outlined" onClick={() => { void handleStatusUpdate(selectedCandidate, 'shortlist'); }} sx={{ color: roleText, borderColor: roleBorder }}>
                          Kortliste
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => { void handleStatusUpdate(selectedCandidate, 'selected'); }} sx={{ color: roleText, borderColor: roleBorder }}>
                          Valgt
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => { void handleStatusUpdate(selectedCandidate, 'confirmed'); }} sx={{ color: roleText, borderColor: roleBorder }}>
                          Bekreft
                        </Button>
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={() => void handleSaveToPool(selectedCandidate)}
                          sx={{ color: roleTabAccent, borderColor: roleBorder }}
                        >
                          Lagre som mal
                        </Button>
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={() => void handleDuplicate(selectedCandidate)}
                          sx={{ color: roleText, borderColor: roleBorder }}
                        >
                          Dupliser
                        </Button>
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={() => void handleDeleteWithUndo(selectedCandidate)}
                          sx={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
                        >
                          Slett
                        </Button>
                      </Stack>
                    </Stack>
                  )}

                  {proDetailTab === 'compare' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {compareCandidates.length < 2 ? (
                        <Typography sx={{ color: roleTextMuted, fontSize: '0.86rem' }}>
                          Velg minst to kandidater i listen for å sammenligne side ved side.
                        </Typography>
                      ) : (
                        <Grid container spacing={1}>
                          {compareCandidates.map((candidate) => {
                            const fit = candidateFitScores.get(candidate.id) || 0;
                            const isTop = fit === Math.max(...compareCandidates.map((item) => candidateFitScores.get(item.id) || 0));
                            return (
                              <Grid key={`compare-${candidate.id}`} item xs={12} sm={6}>
                                <Card sx={{ bgcolor: roleSurfaceMuted, border: `1px solid ${isTop ? roleTabAccent : roleBorder}` }}>
                                  <CardContent sx={{ p: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                                      <Avatar src={candidate.photos?.[0]} sx={{ width: 34, height: 34 }}>
                                        <PersonIcon />
                                      </Avatar>
                                      <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '0.85rem' }} noWrap>
                                          {candidate.name}
                                        </Typography>
                                        <Typography sx={{ color: roleTextMuted, fontSize: '0.72rem' }}>{getStatusLabel(candidate.status)}</Typography>
                                      </Box>
                                      {isTop && (
                                        <Chip icon={<DoneAllIcon />} label="Beste" size="small" sx={{ ml: 'auto', bgcolor: roleTabAccentSoft, color: roleTabAccent }} />
                                      )}
                                    </Box>
                                    <Typography sx={{ color: roleText, fontSize: '0.78rem' }}>Treffscore: {fit}</Typography>
                                    <Typography sx={{ color: roleTextMuted, fontSize: '0.74rem' }}>Roller: {getCandidateAssignedRoles(candidate).length}</Typography>
                                    <Typography sx={{ color: roleTextMuted, fontSize: '0.74rem' }}>
                                      Samtykke: {getConsentCompletionScore(candidate)}%
                                    </Typography>
                                    <Typography sx={{ color: roleTextMuted, fontSize: '0.74rem' }}>
                                      Kontakt: {getContactCoverageScore(candidate)}%
                                    </Typography>
                                  </CardContent>
                                </Card>
                              </Grid>
                            );
                          })}
                        </Grid>
                      )}
                    </Box>
                  )}
                </>
              ) : (
                <Typography sx={{ color: roleTextMuted }}>Velg en kandidat for detaljer.</Typography>
              )}
            </Box>
          </Box>

          {selectedIds.size > 0 && (
            <Box
              sx={{
                position: 'sticky',
                bottom: 0,
                zIndex: 12,
                border: `1px solid ${roleBorder}`,
                borderRadius: 1.5,
                bgcolor: 'rgba(18,12,42,0.94)',
                backdropFilter: 'blur(8px)',
                p: 1.25,
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ color: roleText, fontWeight: 700 }}>
                  {selectedIds.size} kandidater valgt
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Button
                    size="small"
                    variant={proCompareMode ? 'contained' : 'outlined'}
                    startIcon={<CompareArrowsIcon />}
                    onClick={() => {
                      setProCompareMode(true);
                      setProDetailTab('compare');
                    }}
                    sx={{
                      color: proCompareMode ? '#160a24' : roleText,
                      bgcolor: proCompareMode ? roleTabAccent : 'transparent',
                      borderColor: roleBorder,
                    }}
                  >
                    Sammenlign
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => { void handleBulkStatusUpdate('shortlist'); }} sx={{ color: roleText, borderColor: roleBorder }}>
                    Kortliste
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => { void handleBulkStatusUpdate('requested'); }} sx={{ color: roleText, borderColor: roleBorder }}>
                    Be om samtykke
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => { void handleBulkStatusUpdate('confirmed'); }} sx={{ color: roleText, borderColor: roleBorder }}>
                    Bekreft
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<PreviewIcon />} onClick={handleOpenPreviewDialog} sx={{ color: roleTabAccent, borderColor: roleBorder }}>
                    Til scene
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setSelectedIds(new Set());
                      setProCompareMode(false);
                    }}
                    sx={{ color: roleTextMuted, borderColor: roleBorder }}
                  >
                    Tøm valg
                  </Button>
                </Stack>
              </Box>
            </Box>
          )}
        </>
      )}

      {workspaceView !== 'pro' && (
        <>
      {/* Statistics Panel */}
      <Collapse in={showStats}>
        <Box
          id={statsId}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
            gap: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            bgcolor: 'rgba(184,107,255,0.08)',
            borderRadius: 2,
            border: `1px solid ${roleBorder}`,
          }}
        >
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <RecentActorsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: roleTabAccent }} />
            </Box>
            <Typography variant="h4" sx={{ color: roleTabAccent, fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>{statistics.total}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Totalt</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <CheckIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#10b981' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>{statistics.confirmed}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Bekreftet</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <RecentActorsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#8b5cf6' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>{statistics.selected}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Valgt</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <RecentActorsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffb800' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffb800', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>{statistics.shortlist}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Kortliste</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <RecentActorsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#6b7280' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#6b7280', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>{statistics.pending}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Venter</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <StarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffc107' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffc107', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>{statistics.favorites}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Favoritter</Typography>
          </Box>
        </Box>
      </Collapse>

      {/* Search and Filter Controls */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 2 },
          mb: 2,
          alignItems: { xs: 'stretch', sm: 'center' },
        }}
      >
        <TextField
          placeholder={isMobile ? 'Søk...' : isTablet ? 'Søk kandidater...' : 'Søk på navn, e-post, telefon, notater...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)', mr: 1, fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />,
              sx: { minHeight: TOUCH_TARGET_SIZE },
            },
            htmlInput: { 'aria-label': 'Søk i kandidater' },
          }}
          sx={{
            flex: 1,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
              height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
              '& fieldset': { borderColor: roleBorder },
              '&:hover fieldset': { borderColor: roleTabAccentSoft },
              '&.Mui-focused fieldset': { borderColor: roleTabAccent },
            },
          }}
        />

        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140, md: 135, lg: 150, xl: 180 } }}>
          <InputLabel id="candidate-status-filter-label" sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Status
          </InputLabel>
          <Select
            labelId="candidate-status-filter-label"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filtrer etter status"
            sx={{
              color: '#fff',
              minHeight: TOUCH_TARGET_SIZE,
              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
              height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
            }}
          >
            <MenuItem value="all">Alle statuser</MenuItem>
            <MenuItem value="pending">Venter</MenuItem>
            <MenuItem value="requested">Forespurt</MenuItem>
            <MenuItem value="shortlist">Kortliste</MenuItem>
            <MenuItem value="selected">Valgt</MenuItem>
            <MenuItem value="confirmed">Bekreftet</MenuItem>
            <MenuItem value="rejected">Avvist</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
          <Tooltip title="Kortvisning">
            <Button
              variant={viewMode === 'grid' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('grid')}
              aria-label="Bytt til kortvisning"
              aria-pressed={viewMode === 'grid'}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: viewMode === 'grid' ? roleTabAccentSoft : 'transparent',
                color: viewMode === 'grid' ? roleTabAccent : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'grid' ? roleTabAccent : roleBorder,
                ...focusVisibleStyles,
              }}
            >
              <GridViewIcon />
            </Button>
          </Tooltip>
          <Tooltip title="Tabellvisning">
            <Button
              variant={viewMode === 'table' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('table')}
              aria-label="Bytt til tabellvisning"
              aria-pressed={viewMode === 'table'}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: viewMode === 'table' ? roleTabAccentSoft : 'transparent',
                color: viewMode === 'table' ? roleTabAccent : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'table' ? roleTabAccent : roleBorder,
                ...focusVisibleStyles,
              }}
            >
              <TableViewIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
            </Button>
          </Tooltip>
          {selectedIds.size > 0 && (
            <Tooltip title={`Slett ${selectedIds.size} valgte`}>
              <Button
                variant="contained"
                onClick={handleBulkDelete}
                sx={{
                  bgcolor: '#ff4444',
                  minHeight: TOUCH_TARGET_SIZE,
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                  py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                  ...focusVisibleStyles,
                  '&:hover': { bgcolor: '#cc0000' },
                }}
              >
                <DeleteIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                <Box component="span" sx={{ ml: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>{selectedIds.size}</Box>
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Results count */}
      {(searchQuery || statusFilter !== 'all') && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            bgcolor: 'rgba(184,107,255,0.12)',
            color: '#fff',
            '& .MuiAlert-icon': { color: roleTabAccent },
          }}
        >
          Viser {filteredAndSortedCandidates.length} av {validCandidates.length} kandidater
        </Alert>
      )}

      {/* Empty state */}
      {validCandidates.length === 0 ? (
        <RoleRoomEmptyState
          iconSrc={kandidaterPng}
          title="Legg til kandidater"
          subtitle={safeRoles.length > 0
            ? `Du har ${safeRoles.length} rolle${safeRoles.length > 1 ? 'r' : ''} som venter på kandidater.`
            : 'Start med å opprette roller, deretter legg til kandidater.'}
          color="#b86bff"
          buttonLabel="Legg til kandidat"
          onAction={onCreateCandidate}
        />
      ) : filteredAndSortedCandidates.length === 0 ? (
        <Box role="status" sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.87)' }}>
          <SearchIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
          <Typography variant="body1">Ingen treff på søket</Typography>
        </Box>
      ) : viewMode === 'table' ? (
        /* Table View */
        <TableContainer
          component={Paper}
          sx={{
            bgcolor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Table aria-label="Kandidater tabell" sx={{ minWidth: { xs: 600, sm: 700, md: 750, lg: 850, xl: 1100 } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <TableCell padding="checkbox" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedCandidates.length && filteredAndSortedCandidates.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedCandidates.length}
                    onChange={handleSelectAll}
                    inputProps={{ 'aria-label': 'Velg alle kandidater' }}
                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#b86bff' } }}
                  />
                </TableCell>
                <TableCell sx={{ color: '#fff', py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Favoritt</TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#b86bff' } }}
                  >
                    Kandidat
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'status'}
                    direction={sortField === 'status' ? sortDirection : 'asc'}
                    onClick={() => handleSort('status')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#b86bff' } }}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'roles'}
                    direction={sortField === 'roles' ? sortDirection : 'asc'}
                    onClick={() => handleSort('roles')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#b86bff' } }}
                  >
                    Roller
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff', py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Sist oppdatert</TableCell>
                <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedCandidates.map((candidate) => {
                const contactInfo = getCandidateContactInfo(candidate);
                const assignedRoles = getCandidateAssignedRoles(candidate);
                return (
                <TableRow
                  key={candidate.id}
                  sx={{
                    bgcolor: selectedIds.has(candidate.id) ? 'rgba(184,107,255,0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <TableCell padding="checkbox" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Checkbox
                      checked={selectedIds.has(candidate.id)}
                      onChange={() => handleToggleSelect(candidate.id)}
                      inputProps={{ 'aria-label': `Velg kandidat ${candidate.name}` }}
                      sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#b86bff' } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <IconButton
                        onClick={() => toggleFavorite(candidate.id)}
                        aria-label={favorites.has(candidate.id) ? `Fjern ${candidate.name} fra favoritter` : `Legg til ${candidate.name} i favoritter`}
                        sx={{ color: favorites.has(candidate.id) ? '#ffc107' : 'rgba(255,255,255,0.3)' }}
                      >
                        {favorites.has(candidate.id) ? <StarIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                      </IconButton>
                      <Tooltip title={quickContacts.has(candidate.id) ? 'Fjern fra hurtigkontakt' : 'Legg til hurtigkontakt'}>
                        <IconButton
                          onClick={() => toggleQuickContact(candidate.id)}
                          aria-label={quickContacts.has(candidate.id) ? `Fjern ${candidate.name} fra hurtigkontakt` : `Legg til ${candidate.name} i hurtigkontakt`}
                          sx={{
                            color: quickContacts.has(candidate.id) ? quickContactColor : quickContactColorMuted,
                            bgcolor: quickContacts.has(candidate.id) ? quickContactBackground : 'transparent',
                            border: quickContacts.has(candidate.id) ? `1px solid ${quickContactColorMuted}` : '1px solid transparent',
                          }}
                        >
                          <QuickContactIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  {/* Kombinert KANDIDAT-kolonne — foto + navn + email + telefon (matcher design) */}
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                      <Avatar
                        src={candidate.photos?.[0]}
                        alt={candidate.name}
                        sx={{
                          width: { xs: 36, sm: 40, md: 38, lg: 44, xl: 52 },
                          height: { xs: 36, sm: 40, md: 38, lg: 44, xl: 52 },
                          bgcolor: `${getStatusColor(candidate.status)}20`,
                          flexShrink: 0,
                          '& .MuiAvatar-img': {
                            objectPosition: getCandidatePhotoObjectPosition(candidate, 0),
                          },
                        }}
                      >
                        <PersonIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 22, xl: 26 }, color: getStatusColor(candidate.status) }} />
                      </Avatar>
                      <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          sx={{
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {candidate.name}
                        </Typography>
                        {contactInfo.email && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'rgba(255,255,255,0.6)',
                              fontSize: { xs: '0.7rem', sm: '0.72rem', md: '0.7rem', lg: '0.76rem', xl: '0.85rem' },
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {contactInfo.email}
                          </Typography>
                        )}
                        {contactInfo.phone && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'rgba(255,255,255,0.6)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.4,
                              fontSize: { xs: '0.7rem', sm: '0.72rem', md: '0.7rem', lg: '0.76rem', xl: '0.85rem' },
                            }}
                          >
                            {contactInfo.phone}
                            {!/^\+?\d[\d\s\-()]{6,18}$/.test(String(contactInfo.phone).trim()) && (
                              <Tooltip title="Telefonnummer er ikke i gyldig format — WhatsApp/SMS kan ikke leveres">
                                <WarningAmberIcon sx={{ fontSize: 13, color: '#fbbf24' }} />
                              </Tooltip>
                            )}
                            {!/^\+/.test(String(contactInfo.phone).trim()) && /^\d/.test(String(contactInfo.phone).trim()) && (
                              <Tooltip title="Mangler landskode (+47, …) — WhatsApp/SMS krever internasjonalt format">
                                <WarningAmberIcon sx={{ fontSize: 13, color: '#fbbf24' }} />
                              </Tooltip>
                            )}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Stack spacing={0.5}>
                      <Chip
                        label={getStatusLabel(candidate.status)}
                        size="small"
                        sx={{ bgcolor: `${getStatusColor(candidate.status)}20`, color: getStatusColor(candidate.status), fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 } }}
                      />
                      {(() => {
                        const prefs = (candidate.reminderPrefs ?? candidate.reminder_prefs) as
                          | {
                              sms24h?: boolean;
                              sms1h?: boolean;
                              email24h?: boolean;
                              email1h?: boolean;
                              whatsapp24h?: boolean;
                              whatsapp1h?: boolean;
                            }
                          | undefined;
                        const smsOn =
                          (prefs?.sms24h ?? true) || (prefs?.sms1h ?? true);
                        const emailOn =
                          (prefs?.email24h ?? true) || (prefs?.email1h ?? true);
                        const whatsappOn =
                          (prefs?.whatsapp24h ?? true) || (prefs?.whatsapp1h ?? true);
                        const hasPhone = Boolean(contactInfo.phone);
                        const hasEmail = Boolean(contactInfo.email);
                        const smsActive = smsOn && hasPhone;
                        const emailActive = emailOn && hasEmail;
                        const whatsappActive = whatsappOn && hasPhone;
                        if (!smsActive && !emailActive && !whatsappActive) {
                          return (
                            <Tooltip title="Audition-påminnelser slått av">
                              <NotificationsOffOutlinedIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }} />
                            </Tooltip>
                          );
                        }
                        return (
                          <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center', mt: 0.2 }}>
                            {whatsappActive && (
                              <Tooltip title="Mottar audition-WhatsApp">
                                <WhatsAppIcon sx={{ fontSize: 14, color: '#22c55e' }} />
                              </Tooltip>
                            )}
                            {smsActive && (
                              <Tooltip title="Mottar audition-SMS">
                                <SmsOutlinedIcon sx={{ fontSize: 14, color: '#7dd3fc' }} />
                              </Tooltip>
                            )}
                            {emailActive && (
                              <Tooltip title="Mottar audition-e-post">
                                <MarkEmailReadOutlinedIcon sx={{ fontSize: 14, color: '#a3e635' }} />
                              </Tooltip>
                            )}
                          </Box>
                        );
                      })()}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {assignedRoles.slice(0, 2).map(roleId => {
                        const role = safeRoles.find(r => r.id === roleId);
                        const meta = getRoleTypeMeta((role?.roleType ?? role?.role_type) as string | undefined);
                        return (
                          <Chip
                            key={roleId}
                            label={getRoleName(roleId)}
                            size="small"
                            sx={{
                              bgcolor: `${meta.color}22`,
                              color: meta.color,
                              border: `1px solid ${meta.color}55`,
                              fontWeight: 600,
                              fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.68rem', lg: '0.75rem', xl: '0.85rem' },
                              height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
                            }}
                            title={meta.canonical !== 'unknown' && meta.label ? meta.label : undefined}
                          />
                        );
                      })}
                      {assignedRoles.length > 2 && (
                        <Chip label={`+${assignedRoles.length - 2}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.68rem', lg: '0.75rem', xl: '0.85rem' }, height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255,255,255,0.72)',
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatRelativeNb(candidate.updatedAt ?? candidate.updated_at) || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Tooltip title="Handlinger">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          setRowActionMenuAnchor(e.currentTarget);
                          setRowActionMenuCandidate(candidate);
                        }}
                        aria-label={`Handlinger for ${candidate.name}`}
                        aria-haspopup="menu"
                        aria-expanded={rowActionMenuCandidate?.id === candidate.id ? 'true' : 'false'}
                        sx={{
                          color: 'rgba(255,255,255,0.78)',
                          minWidth: TOUCH_TARGET_SIZE,
                          minHeight: TOUCH_TARGET_SIZE,
                          '&:hover': { color: '#b86bff', bgcolor: 'rgba(184,107,255,0.1)' },
                        }}
                      >
                        <MoreVertIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* Grid View - Enhanced cards matching ProductionDayView */
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(3, minmax(0, 1fr))',
            },
            gap: { xs: 2.5, sm: 3, md: 3.25, lg: 3.5, xl: 4 },
            alignItems: 'stretch',
          }}
        >
          {filteredAndSortedCandidates.map((candidate) => {
            const statusColor = getStatusColor(candidate.status);
            const statusLabel = getStatusLabel(candidate.status);
            const contactInfo = getCandidateContactInfo(candidate);
            const assignedRoles = getCandidateAssignedRoles(candidate);
            const auditionNotes = getCandidateAuditionNotes(candidate);

            return (
              <Box key={candidate.id}>
                <Card
                  component="article"
                  sx={{
                    bgcolor: selectedIds.has(candidate.id) ? 'rgba(184,107,255,0.18)' : 'rgba(255,255,255,0.05)',
                    border: selectedIds.has(candidate.id) ? '2px solid #b86bff' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    transition: 'all 0.2s ease',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.08)',
                      borderColor: '#b86bff',
                      boxShadow: '0 8px 24px rgba(184,107,255,0.24)',
                      transform: 'translateY(-2px)',
                    },
                    ...focusVisibleStyles,
                  }}
                >
                  {/* Photo header with gradient overlay */}
                  <Box sx={{ position: 'relative' }}>
                    {candidate.modelUrl ? (
                      <Box
                        sx={{
                          width: '100%',
                          height: { xs: 180, sm: 200, md: 190, lg: 220, xl: 260 },
                          bgcolor: 'rgba(15,20,30,0.9)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                        }}
                      >
                        <GLB3DPreview
                          modelUrl={candidate.modelUrl}
                          width="100%"
                          height={200}
                          autoRotate={true}
                          lightingStyle="default"
                          personality={candidate.personality}
                          showAnimation={true}
                        />
                        {candidate.personality && PERSONALITY_TRAITS[candidate.personality] && (
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: { xs: 8, sm: 10, md: 9, lg: 10, xl: 12 },
                              left: { xs: 8, sm: 10, md: 9, lg: 10, xl: 12 },
                              px: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                              py: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                              bgcolor: 'rgba(0,0,0,0.7)',
                              borderRadius: 1,
                              border: `1px solid ${PERSONALITY_TRAITS[candidate.personality].color}`,
                            }}
                          >
                            <Typography variant="caption" sx={{ color: PERSONALITY_TRAITS[candidate.personality].color, fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                              {PERSONALITY_TRAITS[candidate.personality].name}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    ) : candidate.photos?.[0] ? (
                      <Box
                        component="img"
                        src={candidate.photos[0]}
                        alt={`${profession === 'videographer' ? 'Video' : 'Bilde'} av ${candidate.name}`}
                        sx={{
                          width: '100%',
                          height: { xs: 140, sm: 160, md: 150, lg: 180, xl: 220 },
                          objectFit: 'cover',
                          objectPosition: getCandidatePhotoObjectPosition(candidate, 0),
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: { xs: 100, sm: 120, md: 110, lg: 140, xl: 180 },
                          background: 'linear-gradient(135deg, rgba(184,107,255,0.25) 0%, rgba(93,67,191,0.16) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Box
                          sx={{
                            width: { xs: 60, sm: 70, md: 65, lg: 80, xl: 100 },
                            height: { xs: 60, sm: 70, md: 65, lg: 80, xl: 100 },
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #b86bff 0%, #5d43bf 100%)',
                            border: '3px solid rgba(255,255,255,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(184,107,255,0.36)',
                          }}
                        >
                          <RecentActorsIcon sx={{ fontSize: { xs: 30, sm: 36, md: 33, lg: 40, xl: 50 }, color: '#fff' }} />
                        </Box>
                      </Box>
                    )}
                    {/* Gradient overlay at bottom */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '50%',
                        background: 'linear-gradient(to top, rgba(17,24,39,0.95) 0%, transparent 100%)',
                      }}
                    />
                    {/* Status badge on photo */}
                    <Chip
                      label={statusLabel}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: { xs: 12, sm: 14, md: 13, lg: 16, xl: 20 },
                        right: { xs: 12, sm: 14, md: 13, lg: 16, xl: 20 },
                        bgcolor: `${statusColor}30`,
                        color: statusColor,
                        fontWeight: 700,
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                        height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                        border: `1px solid ${statusColor}50`,
                        backdropFilter: 'blur(8px)',
                      }}
                    />
                    {/* Consent status badge */}
                    <Box sx={{
                      position: 'absolute',
                      top: { xs: 12, sm: 14, md: 13, lg: 16, xl: 20 },
                      left: { xs: 12, sm: 14, md: 13, lg: 16, xl: 20 },
                    }}>
                      <ConsentStatusBadge
                        consents={candidate.consent || []}
                        size="small"
                        onClick={() => onEditCandidate(candidate)}
                      />
                    </Box>
                  </Box>

                  <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Card Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                        <Checkbox
                          checked={selectedIds.has(candidate.id)}
                          onChange={() => handleToggleSelect(candidate.id)}
                          inputProps={{ 'aria-label': `Velg kandidat ${candidate.name}` }}
                          sx={{ p: 0.5, color: 'rgba(255,255,255,0.6)', '&.Mui-checked': { color: '#b86bff' } }}
                        />
                        <Typography
                          variant="h6"
                          component="h3"
                          sx={{
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.125rem', xl: '1.25rem' },
                            lineHeight: 1.2,
                          }}
                        >
                          {candidate.name}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title={quickContacts.has(candidate.id) ? 'Fjern fra hurtigkontakt' : 'Legg til hurtigkontakt'}>
                          <IconButton
                            onClick={() => toggleQuickContact(candidate.id)}
                            aria-label={quickContacts.has(candidate.id) ? 'Fjern fra hurtigkontakt' : 'Legg til hurtigkontakt'}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: quickContacts.has(candidate.id) ? quickContactColor : quickContactColorMuted,
                              bgcolor: quickContacts.has(candidate.id) ? quickContactBackground : 'transparent',
                              border: quickContacts.has(candidate.id) ? `1px solid ${quickContactColorMuted}` : '1px solid transparent',
                              ...focusVisibleStyles,
                            }}
                          >
                            <QuickContactIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          onClick={() => toggleFavorite(candidate.id)}
                          aria-label={favorites.has(candidate.id) ? 'Fjern fra favoritter' : 'Legg til favoritter'}
                          sx={{
                            minWidth: TOUCH_TARGET_SIZE,
                            minHeight: TOUCH_TARGET_SIZE,
                            color: favorites.has(candidate.id) ? '#ffc107' : 'rgba(255,255,255,0.3)',
                            ...focusVisibleStyles,
                          }}
                        >
                          {favorites.has(candidate.id) ? <StarIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} />}
                        </IconButton>
                      </Box>
                    </Box>

                    {/* Contact Info Cards - Enhanced */}
                    <Stack spacing={{ xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }} sx={{ mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                      {contactInfo.email && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(184,107,255,0.12)',
                            border: '1px solid rgba(184,107,255,0.3)',
                          }}
                        >
                          <Box
                            sx={{
                              width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              borderRadius: 1.5,
                              bgcolor: 'rgba(184,107,255,0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <EmailIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 32 }, color: '#d6b5ff' }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              sx={{
                                color: 'rgba(255,255,255,0.87)',
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              E-post
                            </Typography>
                            <Typography
                              sx={{
                                color: '#fff',
                                fontSize: { xs: '0.85rem', sm: '0.95rem', md: '0.9rem', lg: '1rem', xl: '1.125rem' },
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {contactInfo.email}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      {contactInfo.phone && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(139,92,246,0.1)',
                            border: '1px solid rgba(139,92,246,0.25)',
                          }}
                        >
                          <Box
                            sx={{
                              width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              borderRadius: 1.5,
                              bgcolor: 'rgba(139,92,246,0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <PhoneIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 32 }, color: '#a78bfa' }} />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography
                              sx={{
                                color: 'rgba(255,255,255,0.87)',
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              Telefon
                            </Typography>
                            <Typography
                              sx={{
                                color: '#fff',
                                fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.025rem', lg: '1.15rem', xl: '1.25rem' },
                                fontWeight: 700,
                              }}
                            >
                              {contactInfo.phone}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Stack>

                    {/* Expandable content */}
                    <Collapse in={expandedCards.has(candidate.id)}>
                      <Box sx={{ mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                        {auditionNotes && (
                          <Box
                            sx={{
                              mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                              p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              borderRadius: 2,
                              bgcolor: 'rgba(184,107,255,0.1)',
                              border: '1px solid rgba(184,107,255,0.24)',
                            }}
                          >
                            <Typography
                              variant="subtitle2"
                              sx={{
                                color: '#b86bff',
                                fontWeight: 700,
                                mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                                fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              Audition-notater
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                              {auditionNotes}
                            </Typography>
                          </Box>
                        )}
                        {assignedRoles.length > 0 && (
                          <Box sx={{ mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                color: '#f48fb1',
                                fontWeight: 700,
                                mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                                fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              Tildelte roller
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                              {assignedRoles.map(roleId => (
                                <Chip
                                  key={roleId}
                                  label={getRoleName(roleId)}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(244,143,177,0.15)',
                                    color: '#f48fb1',
                                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                    height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                    fontWeight: 600,
                                    border: '1px solid rgba(244,143,177,0.3)',
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Collapse>

                    {/* Card Actions - Enhanced */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        pt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                        mt: 'auto',
                        borderTop: '2px solid rgba(184,107,255,0.24)',
                      }}
                    >
                      <Button
                        variant="contained"
                        size="medium"
                        onClick={() => toggleCardExpanded(candidate.id)}
                        endIcon={expandedCards.has(candidate.id) ? <CollapseIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <ExpandIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                        sx={{
                          bgcolor: expandedCards.has(candidate.id)
                            ? 'rgba(184,107,255,0.3)'
                            : 'rgba(184,107,255,0.18)',
                          color: expandedCards.has(candidate.id) ? '#e3c8ff' : '#fff',
                          fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                          fontWeight: 600,
                          minHeight: TOUCH_TARGET_SIZE,
                          px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                          py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                          border: expandedCards.has(candidate.id)
                            ? '2px solid rgba(184,107,255,0.58)'
                            : '2px solid rgba(184,107,255,0.38)',
                          borderRadius: 2,
                          textTransform: 'none',
                          boxShadow: expandedCards.has(candidate.id)
                            ? '0 4px 12px rgba(184,107,255,0.34)'
                            : '0 2px 8px rgba(184,107,255,0.26)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: 'rgba(184,107,255,0.35)',
                            borderColor: 'rgba(184,107,255,0.65)',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 6px 16px rgba(184,107,255,0.42)',
                          },
                          ...focusVisibleStyles,
                        }}
                      >
                        {expandedCards.has(candidate.id) ? 'Skjul detaljer' : 'Vis detaljer'}
                      </Button>
                      <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1, md: 0.75, lg: 1, xl: 1.25 } }}>
                        <Tooltip title="Lagre til pool">
                          <IconButton
                            onClick={() => handleSaveToPool(candidate)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: '#8b5cf6',
                              '&:hover': { bgcolor: 'rgba(184,107,255,0.12)' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <UploadIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Dupliser">
                          <IconButton
                            onClick={() => handleDuplicate(candidate)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: 'rgba(255,255,255,0.87)',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <DuplicateIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Rediger">
                          <IconButton
                            onClick={() => onEditCandidate(candidate)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: '#b86bff',
                              '&:hover': { bgcolor: 'rgba(184,107,255,0.1)' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <EditIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Slett">
                          <IconButton
                            onClick={() => handleDeleteWithUndo(candidate)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: '#ff4444',
                              '&:hover': { bgcolor: 'rgba(255,68,68,0.1)' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Templates View - shows saved candidate templates when in templates mode */}
      {poolMode === 'pool' && (
        <Box>
          {/* Guide Box */}
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: 'rgba(156, 39, 176, 0.08)',
              borderRadius: 2,
              border: '1px solid rgba(156, 39, 176, 0.2)',
            }}
          >
            <Typography variant="subtitle1" sx={{ color: '#9c27b0', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon sx={{ fontSize: 20 }} />
              Slik bruker du kandidatmaler
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
              Maler lar deg lagre favoritt-kandidater for rask tilgang i fremtidige prosjekter.
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'rgba(255,255,255,0.87)', '& li': { mb: 0.5, fontSize: '0.875rem' } }}>
              <li><strong>Lagre som mal:</strong> Klikk på lilla ikon på en prosjektkandidat</li>
              <li><strong>Importer:</strong> Klikk "Importer" for å kopiere kandidaten til prosjektet</li>
              <li><strong>Slett:</strong> Fjern maler du ikke trenger lenger</li>
            </Box>
          </Box>

          {poolLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>Laster maler...</Typography>
            </Box>
          ) : poolCandidates.length === 0 ? (
            <Box
              role="status"
              sx={{
                textAlign: 'center',
                py: { xs: 4, sm: 8 },
                px: 4,
                bgcolor: 'rgba(156, 39, 176, 0.03)',
                borderRadius: 3,
                border: '2px dashed rgba(156, 39, 176, 0.2)',
              }}
            >
              <Box
                sx={{
                  width: { xs: 60, sm: 80 },
                  height: { xs: 60, sm: 80 },
                  borderRadius: '50%',
                  bgcolor: 'rgba(156, 39, 176, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  mb: { xs: 2, sm: 3 },
                }}
              >
                <InventoryIcon sx={{ fontSize: { xs: 30, sm: 40 }, color: '#9c27b0' }} />
              </Box>
              <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600, mb: 1 }}>
                Ingen kandidatmaler ennå
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3, maxWidth: 400, mx: 'auto' }}>
                Lagre kandidater fra prosjekter som maler for gjenbruk i fremtidige produksjoner.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={{ xs: 1, sm: 2 }}>
              {poolCandidates.map((poolCandidate) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={poolCandidate.id}>
                  <Card
                    sx={{
                      bgcolor: 'rgba(156, 39, 176, 0.08)',
                      border: '1px solid rgba(156, 39, 176, 0.3)',
                      borderRadius: 2,
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: '#9c27b0',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(156, 39, 176, 0.2)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            src={poolCandidate.photos?.[0]}
                            sx={{
                              width: 48,
                              height: 48,
                              bgcolor: 'rgba(156, 39, 176, 0.2)',
                              border: '2px solid rgba(156, 39, 176, 0.4)',
                              '& .MuiAvatar-img': {
                                objectPosition: getCandidatePhotoObjectPosition(poolCandidate, 0),
                              },
                            }}
                          >
                            <PersonIcon sx={{ color: '#ce93d8' }} />
                          </Avatar>
                          <Box>
                            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                              {poolCandidate.name}
                            </Typography>
                            {getCandidateContactInfo(poolCandidate).email && (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <EmailIcon sx={{ fontSize: 12 }} />
                                {getCandidateContactInfo(poolCandidate).email}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Chip
                          icon={<InventoryIcon sx={{ fontSize: 14 }} />}
                          label="Mal"
                          size="small"
                          sx={{
                            bgcolor: 'rgba(156, 39, 176, 0.2)',
                            color: '#ce93d8',
                            fontSize: '0.7rem',
                            height: 24,
                          }}
                        />
                      </Box>
                      {poolCandidate.notes && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'rgba(255,255,255,0.87)',
                            mb: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {poolCandidate.notes}
                        </Typography>
                      )}
                      {poolCandidate.tags && poolCandidate.tags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                          {poolCandidate.tags.slice(0, 3).map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.87)', fontSize: '0.7rem' }}
                            />
                          ))}
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<DownloadIcon />}
                          onClick={() => handleImportFromPool(poolCandidate)}
                          sx={{
                            bgcolor: '#9c27b0',
                            color: '#fff',
                            flex: 1,
                            minHeight: TOUCH_TARGET_SIZE,
                            '&:hover': { bgcolor: '#7b1fa2' },
                          }}
                        >
                          Importer
                        </Button>
                        <Tooltip title="Slett fra pool">
                          <IconButton
                            onClick={() => handleDeleteFromPool(poolCandidate.id)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: '#ff4444',
                              '&:hover': { bgcolor: 'rgba(255,68,68,0.1)' },
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
        </>
      )}

      {/* Undo Delete Snackbar */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setUndoSnackbarOpen(false)}
        message="Kandidat slettet"
        action={
          <Button color="secondary" size="small" onClick={handleUndoDelete} sx={{ color: '#b86bff' }}>
            Angre
          </Button>
        }
        sx={{ '& .MuiSnackbarContent-root': { bgcolor: '#333' } }}
      />

      {/* Scene Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={handleClosePreviewDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            color: '#fff',
            borderRadius: 3,
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          pb: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ViewInArIcon sx={{ color: '#8b5cf6', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Forhåndsvisning - Legg til i scene
            </Typography>
          </Box>
          <IconButton 
            onClick={handleClosePreviewDialog}
            sx={{ color: 'rgba(255,255,255,0.87)', '&:hover': { color: '#fff' } }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 2 }}>
            {candidatesToPreview.length} kandidat(er) vil bli lagt til i 3D-scenen. 
            Velg lysoppsett for scenen.
          </Typography>

          {/* Lighting Preset Selector */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ 
              color: '#a78bfa', 
              mb: 1.5, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1 
            }}>
              <LightbulbIcon sx={{ fontSize: 18 }} />
              Velg lysoppsett
            </Typography>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: 1,
            }}>
              {LIGHTING_PRESETS.map((preset) => (
                <Card
                  key={preset.id}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 1.5,
                    p: 1.5,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.06)',
                      borderColor: 'rgba(255,255,255,0.2)',
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ 
                      fontWeight: 500, 
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: '0.8rem',
                    }}>
                      {preset.name}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ 
                    color: 'rgba(255,255,255,0.87)', 
                    fontSize: '0.65rem',
                    display: 'block',
                  }}>
                    {preset.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      label={`${preset.lights.length} lys`}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255,184,0,0.15)',
                        color: '#ffb800',
                        fontSize: '0.6rem',
                        height: 16,
                        '& .MuiChip-label': { px: 0.75 }
                      }}
                    />
                    <Chip
                      label={preset.category}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(184,107,255,0.15)',
                        color: '#b86bff',
                        fontSize: '0.6rem',
                        height: 16,
                        '& .MuiChip-label': { px: 0.75 }
                      }}
                    />
                  </Box>
                </Card>
              ))}
            </Box>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 2 }} />

          <Typography variant="subtitle2" sx={{ 
            color: 'rgba(255,255,255,0.87)', 
            mb: 1.5, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1 
          }}>
            <PersonIcon sx={{ fontSize: 18 }} />
            Kandidater ({candidatesToPreview.length})
          </Typography>

          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
            maxHeight: 400,
            overflowY: 'auto',
            pr: 1,
          }}>
            {candidatesToPreview.map((candidate) => {
              const candidateAssignedRoles = getCandidateAssignedRoles(candidate);
              const assignedRoles = safeRoles.filter(r => candidateAssignedRoles.includes(r.id));
              return (
                <Card
                  key={candidate.id}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: 2,
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'rgba(139, 92, 246, 0.5)',
                      transform: 'translateY(-2px)',
                    }
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveFromPreview(candidate.id)}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      color: 'rgba(255,255,255,0.87)',
                      bgcolor: 'rgba(0,0,0,0.3)',
                      '&:hover': { 
                        color: '#ff4444', 
                        bgcolor: 'rgba(255,68,68,0.2)' 
                      },
                      zIndex: 1,
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                      <Avatar
                        src={candidate.photos?.[0]}
                        sx={{ 
                          width: 56, 
                          height: 56,
                          bgcolor: '#8b5cf6',
                          border: '2px solid rgba(139, 92, 246, 0.5)',
                          '& .MuiAvatar-img': {
                            objectPosition: getCandidatePhotoObjectPosition(candidate, 0),
                          },
                        }}
                      >
                        {candidate.photos?.[0] ? null : <PersonIcon />}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="subtitle1" 
                          sx={{ 
                            fontWeight: 600, 
                            color: '#fff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {candidate.name}
                        </Typography>
                        <Chip
                          label={getStatusLabel(candidate.status)}
                          size="small"
                          sx={{
                            bgcolor: `${getStatusColor(candidate.status)}20`,
                            color: getStatusColor(candidate.status),
                            fontWeight: 500,
                            fontSize: '0.7rem',
                            height: 20,
                          }}
                        />
                      </Box>
                    </Box>

                    {assignedRoles.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                        {assignedRoles.slice(0, 2).map(role => (
                          <Chip
                            key={role.id}
                            label={role.name}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(139, 92, 246, 0.2)',
                              color: '#a78bfa',
                              fontSize: '0.65rem',
                              height: 18,
                            }}
                          />
                        ))}
                        {assignedRoles.length > 2 && (
                          <Chip
                            label={`+${assignedRoles.length - 2}`}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.1)',
                              color: 'rgba(255,255,255,0.87)',
                              fontSize: '0.65rem',
                              height: 18,
                            }}
                          />
                        )}
                      </Box>
                    )}

                    {candidate.photos?.[0] && (
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 0.5, 
                        mt: 1.5,
                        color: '#b86bff',
                        fontSize: '0.75rem',
                      }}>
                        <CheckIcon sx={{ fontSize: 14 }} />
                        <Typography variant="caption" sx={{ color: 'inherit' }}>
                          Bilde tilgjengelig for avatar
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Box>

          {candidatesToPreview.length === 0 && (
            <Box sx={{ 
              textAlign: 'center', 
              py: 4, 
              color: 'rgba(255,255,255,0.87)' 
            }}>
              <Typography>Ingen kandidater valgt</Typography>
            </Box>
          )}
        </DialogContent>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        <DialogActions sx={{ p: 2.5, gap: 1.5 }}>
          <Button
            onClick={handleClosePreviewDialog}
            variant="outlined"
            sx={{
              borderColor: 'rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.87)',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.4)',
                bgcolor: 'rgba(255,255,255,0.05)',
              }
            }}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleConfirmAddToScene}
            variant="contained"
            disabled={addingToScene || candidatesToPreview.length === 0}
            startIcon={addingToScene ? <CircularProgress size={18} color="inherit" /> : <ViewInArIcon />}
            sx={{
              bgcolor: '#8b5cf6',
              color: '#fff',
              fontWeight: 600,
              px: 3,
              '&:hover': { bgcolor: '#7c3aed' },
              '&:disabled': { 
                bgcolor: 'rgba(139, 92, 246, 0.3)',
                color: 'rgba(255,255,255,0.87)',
              }
            }}
          >
            {addingToScene ? 'Legger til...' : `Legg til i scene (${candidatesToPreview.length})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Per-rad ⋮-action-menu — konsoliderer 4 IconButtons til én anchorPos-meny */}
      <Menu
        anchorEl={rowActionMenuAnchor}
        open={Boolean(rowActionMenuAnchor && rowActionMenuCandidate)}
        onClose={() => {
          setRowActionMenuAnchor(null);
          setRowActionMenuCandidate(null);
        }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'rgba(15,23,42,0.98)',
              border: '1px solid rgba(168,85,247,0.32)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              minWidth: 200,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            if (rowActionMenuCandidate) onEditCandidate(rowActionMenuCandidate);
            setRowActionMenuAnchor(null);
            setRowActionMenuCandidate(null);
          }}
          sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(184,107,255,0.14)' } }}
        >
          <ListItemIcon sx={{ color: '#b86bff', minWidth: 36 }}>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rediger</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (rowActionMenuCandidate) void handleSaveToPool(rowActionMenuCandidate);
            setRowActionMenuAnchor(null);
            setRowActionMenuCandidate(null);
          }}
          sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(139,92,246,0.14)' } }}
        >
          <ListItemIcon sx={{ color: '#8b5cf6', minWidth: 36 }}>
            <UploadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Lagre til pool</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (rowActionMenuCandidate) void handleDuplicate(rowActionMenuCandidate);
            setRowActionMenuAnchor(null);
            setRowActionMenuCandidate(null);
          }}
          sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
        >
          <ListItemIcon sx={{ color: 'rgba(255,255,255,0.78)', minWidth: 36 }}>
            <DuplicateIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Dupliser</ListItemText>
        </MenuItem>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
        <MenuItem
          onClick={() => {
            if (rowActionMenuCandidate) void handleDeleteWithUndo(rowActionMenuCandidate);
            setRowActionMenuAnchor(null);
            setRowActionMenuCandidate(null);
          }}
          sx={{ color: '#fca5a5', '&:hover': { bgcolor: 'rgba(239,68,68,0.14)' } }}
        >
          <ListItemIcon sx={{ color: '#ef4444', minWidth: 36 }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Slett</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}

export const CandidateManagementPanel = memo(CandidateManagementPanelInner);
